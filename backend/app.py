import os
import io
import joblib
import pandas as pd

from datetime import datetime
from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet

# ──────────────────────────────────────────────
# App & DB setup
# ──────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["complaint_db"]
collection = db["complaints"]

# ──────────────────────────────────────────────
# ML Model
# ──────────────────────────────────────────────
model = joblib.load("complaint_model.pkl")

# Extract TF-IDF feature vocabulary for out-of-domain validation
try:
    tfidf = model.named_steps["tfidf"]
    MODEL_VOCABULARY = set(tfidf.get_feature_names_out())
except Exception:
    MODEL_VOCABULARY = set()

# Curated recommendation mapping for wellness categories
RECOMMENDATION_MAP = {
    "Product":   "Investigate product formulation, R&D feedback, and batch quality. Issue a replacement or full refund as appropriate.",
    "Packaging": "Check container seal, dispenser, and lid durability. Replace damaged packaging items and notify production.",
    "Trade":     "Verify transaction details in the billing/B2B portal, correct invoice discrepancies, and coordinate with courier."
}

def predict_complaint(text):
    """Run ML model and return category, priority, resolution."""
    prediction = model.predict([text])
    category  = prediction[0][0]
    priority  = prediction[0][1]
    resolution = prediction[0][2]

    # Override resolution with a curated recommendation if available
    resolution = RECOMMENDATION_MAP.get(category, resolution)
    return {"category": category, "priority": priority, "resolution": resolution}


# ──────────────────────────────────────────────
# Rule-based overrides (applied BEFORE ML)
# ──────────────────────────────────────────────
RULE_OVERRIDES = [
    {
        "keywords": ["allergic", "allergy", "rash", "hives", "stomach pain", "nausea", "vomiting", "cramps", "sick", "poisoning", "swelling", "hospital"],
        "category": "Product",
        "priority": "High",
        "recommendation": "Contact the customer immediately to assess health/safety impact. Issue a full refund, ship a free replacement, and escalate to the QA team to investigate batch contamination.",
    },
    {
        "keywords": ["glass shattered", "shattered glass", "safety seal torn", "seal open", "leaked", "leakage", "crushed bottle", "cracked jar", "broken seal", "spilled"],
        "category": "Packaging",
        "priority": "High",
        "recommendation": "Apologize for the safety hazard of damaged packaging. Issue a refund or replacement immediately, and escalate to shipping/QA to review bottle durability.",
    },
    {
        "keywords": ["double billed", "charged twice", "invoice error", "pricing error", "invoice discrepancy", "billing discrepancy", "payment pending", "overcharged"],
        "category": "Trade",
        "priority": "High",
        "recommendation": "Contact the distributor/retailer immediately. Conduct an internal audit of the billing/shipping system, correct the invoice error, and escalate to the Sales Director.",
    },
    {
        "keywords": ["pump jammed", "child lock defective", "nozzle blocked", "peeling label", "broken lid", "broken scoop", "cap broken", "stuck cap"],
        "category": "Packaging",
        "priority": "Medium",
        "recommendation": "Apologize for the inconvenience. Ship a replacement pump/dispenser or a new product, and report the transit damage to the logistics department.",
    },
    {
        "keywords": ["delivery delayed", "delayed shipment", "wrong flavor", "wrong item", "expired", "consignment delayed", "wrong address"],
        "category": "Trade",
        "priority": "Medium",
        "recommendation": "Investigate shipment status with the courier partner. Provide an updated tracking link, and process a shipping fee refund if delayed beyond SLA.",
    },
    {
        "keywords": ["taste sweet", "bland taste", "oxidized", "clumped", "watery lotion", "unpleasant smell", "bad smell", "sour taste", "bitter taste"],
        "category": "Product",
        "priority": "Medium",
        "recommendation": "Apologize for the sub-standard quality. Email a prepaid return label to retrieve the item and issue a prompt refund or replacement.",
    },
]

INVALID_INPUTS = {"hello", "hi", "test", "hey", "ok", "okay", "thanks", "yes", "no"}

SLA_MAP = {
    "High":   "24 hours",
    "Medium": "48 hours",
    "Low":    "72 hours",
    "None":   "None",
}


def apply_rules(text_lower):
    """Return (category, priority, recommendation) if a rule matches, else None."""
    for rule in RULE_OVERRIDES:
        if any(kw in text_lower for kw in rule["keywords"]):
            return rule["category"], rule["priority"], rule["recommendation"]
    return None


def calculate_sla_status(complaint):
    """Dynamically determine if the complaint is within SLA or breached."""
    priority = complaint.get("priority", "Low")
    if priority not in ["High", "Medium", "Low"]:
        return "N/A"
        
    limit_hours = {"High": 24, "Medium": 48, "Low": 72}.get(priority, 72)
    
    try:
        sub_time = datetime.fromisoformat(complaint["timestamp"])
    except Exception:
        return "Compliant"
        
    res_time_str = complaint.get("resolved_timestamp")
    if res_time_str:
        try:
            res_time = datetime.fromisoformat(res_time_str)
        except Exception:
            res_time = datetime.utcnow()
    else:
        res_time = datetime.utcnow()
        
    duration = res_time - sub_time
    duration_hours = duration.total_seconds() / 3600.0
    
    if duration_hours > limit_hours:
        return "Breached"
    else:
        return "Compliant"


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()

    if not data or "complaint" not in data:
        return jsonify({"error": "Complaint text missing"}), 400

    text = data.get("complaint", "").strip()
    city = data.get("city", "")
    area = data.get("area", "")
    
    # New fields for input type and email data
    input_type = data.get("type", "Text")
    subject    = data.get("subject", "").strip()
    sender     = data.get("sender", "").strip()

    # ── Input validation ────────────────────────
    if not text:
        return jsonify({"error": "Complaint text is empty"}), 400

    if len(text) < 5:
        return jsonify({"error": "Complaint too short. Please describe the issue."}), 400

    if len(text) > 2000:
        return jsonify({"error": "Complaint too long. Max 2000 characters."}), 400

    text_lower = text.lower().strip()

    # ── Out-of-Domain Validation ─────────────────
    import re
    # Filter out common/uninformative words to prevent false positives in overlap check
    COMMON_WORDS = {
        'hello', 'team', 'support', 'please', 'resolve', 'urgent', 'thanks', 'need', 'soon',
        'about', 'also', 'have', 'has', 'had', 'how', 'if', 'in', 'into', 'it', 'its', 'not',
        'no', 'yes', 'ok', 'okay', 'like', 'would', 'want', 'received', 'receipt', 'get',
        'got', 'give', 'giveback', 'sent', 'send', 'use', 'using', 'used', 'after', 'before',
        'from', 'with', 'this', 'that', 'these', 'those', 'they', 'them', 'their', 'there',
        'here', 'were', 'been', 'was', 'are', 'is', 'am', 'be', 'do', 'does', 'did', 'done',
        'doing', 'make', 'made', 'take', 'took', 'taken', 'put', 'find', 'found', 'go',
        'went', 'gone', 'come', 'came', 'back', 'again', 'then', 'than', 'or', 'and', 'but',
        'so', 'because', 'as', 'at', 'by', 'for', 'on', 'off', 'out', 'over', 'under',
        'again', 'further', 'then', 'once', 'the', 'to', 'your', 'my', 'our', 'an', 'a',
        'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
        'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in',
        'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
        'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
        'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
        'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now'
    }

    raw_words = re.findall(r'\b[a-z]{2,}\b', text_lower)
    content_words = [w for w in raw_words if w not in COMMON_WORDS]
    
    if MODEL_VOCABULARY:
        overlap_words = set(content_words).intersection(MODEL_VOCABULARY)
        vocabulary_overlap = len(overlap_words)
        overlap_ratio = len(overlap_words) / len(content_words) if content_words else 0
    else:
        # Fallback if vocabulary failed to load
        vocabulary_overlap = 5
        overlap_ratio = 1.0

    # Determine if out-of-domain based on content words and overlap metrics
    is_out_of_domain = False
    if text_lower in INVALID_INPUTS:
        is_out_of_domain = True
    elif len(content_words) == 0:
        is_out_of_domain = True
    elif vocabulary_overlap == 0:
        is_out_of_domain = True
    elif len(content_words) >= 4 and overlap_ratio <= 0.25:
        # A longer text with very few domain-specific words
        is_out_of_domain = True

    # ── Check invalid / test inputs or unrelated inputs ─────────────
    if is_out_of_domain:
        return jsonify({
            "category": "None",
            "priority": "None",
            "recommendation": "This input does not appear to be related to wellness products, packaging, or trade operations. Please describe a valid wellness complaint.",
            "sla": "None",
            "city": city,
            "area": area,
            "type": input_type,
            "subject": subject,
            "sender": sender,
            "status": "Pending",
            "timestamp": datetime.utcnow().isoformat(),
            "sla_status": "N/A"
        }), 200

    # ── Apply rule overrides first ───────────────
    rule_result = apply_rules(text_lower)
    if rule_result:
        category, priority, recommendation = rule_result
    else:
        # ── Fall back to ML model ────────────────
        result = predict_complaint(text_lower)
        category       = result["category"]
        priority       = result["priority"]
        recommendation = result["resolution"]

    sla = SLA_MAP.get(priority, "72 hours")
    timestamp = datetime.utcnow().isoformat()

    # ── Store in MongoDB ─────────────────────────
    complaint_data = {
        "text":           text,
        "type":           input_type,
        "subject":        subject,
        "sender":         sender,
        "category":       category,
        "priority":       priority,
        "recommendation": recommendation,
        "sla":            sla,
        "city":           city,
        "area":           area,
        "status":         "Pending",
        "timestamp":      timestamp,
        "resolved_timestamp": None
    }

    insert_result = collection.insert_one(complaint_data)
    complaint_data["_id"] = str(insert_result.inserted_id)
    complaint_data["sla_status"] = calculate_sla_status(complaint_data)

    return jsonify(complaint_data)


@app.route('/complaints', methods=['GET'])
def get_complaints():
    page  = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))
    skip  = (page - 1) * limit

    # Optional filters
    category_filter = request.args.get("category", "")
    priority_filter = request.args.get("priority", "")
    status_filter   = request.args.get("status", "")
    search_query    = request.args.get("search", "")

    query = {}
    if category_filter:
        query["category"] = category_filter
    if priority_filter:
        query["priority"] = priority_filter
    if status_filter:
        query["status"] = status_filter
    if search_query:
        # Match against text, subject, or sender
        query["$or"] = [
            {"text": {"$regex": search_query, "$options": "i"}},
            {"subject": {"$regex": search_query, "$options": "i"}},
            {"sender": {"$regex": search_query, "$options": "i"}}
        ]

    total = collection.count_documents(query)
    data  = list(collection.find(query).sort("timestamp", -1).skip(skip).limit(limit))

    for c in data:
        c["_id"] = str(c["_id"])
        c["sla_status"] = calculate_sla_status(c)

    return jsonify({
        "data":  data,
        "total": total,
        "page":  page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    })


@app.route('/complaints/<complaint_id>', methods=['DELETE'])
def delete_complaint(complaint_id):
    try:
        result = collection.delete_one({"_id": ObjectId(complaint_id)})
    except Exception:
        return jsonify({"error": "Invalid complaint ID"}), 400

    if result.deleted_count == 0:
        return jsonify({"error": "Complaint not found"}), 404

    return jsonify({"message": "Complaint deleted successfully"})


@app.route('/update-status', methods=['POST'])
def update_status():
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data received"}), 400

    complaint_id = data.get("id")
    status       = data.get("status")

    if not complaint_id or not status:
        return jsonify({"error": "Missing id or status"}), 400

    if status not in ("Pending", "In Progress", "Resolved"):
        return jsonify({"error": "Invalid status value"}), 400

    try:
        update_fields = {"status": status}
        if status == "Resolved":
            update_fields["resolved_timestamp"] = datetime.utcnow().isoformat()
        else:
            update_fields["resolved_timestamp"] = None

        result = collection.update_one(
            {"_id": ObjectId(complaint_id)},
            {"$set": update_fields}
        )
    except Exception as e:
        return jsonify({"error": f"Invalid complaint ID or database error: {str(e)}"}), 400

    if result.matched_count == 0:
        return jsonify({"error": "Complaint not found"}), 404

    return jsonify({"message": "Status updated successfully"})


@app.route('/export/csv')
def export_csv():
    data = list(collection.find({}, {"_id": 0}))
    for c in data:
        c["sla_status"] = calculate_sla_status(c)
    
    df = pd.DataFrame(data)

    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=complaints.csv"}
    )


@app.route('/export/pdf')
def export_pdf():
    data = list(collection.find({}, {"_id": 0}))

    buffer = io.BytesIO()
    doc    = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()

    table_data = [["Complaint Text", "Category", "Priority", "Channel", "Status", "SLA", "SLA Status"]]
    for c in data:
        txt = str(c.get("text", ""))[:80] + ("…" if len(str(c.get("text", ""))) > 80 else "")
        table_data.append([
            txt,
            c.get("category", ""),
            c.get("priority", ""),
            c.get("type", "Text"),
            c.get("status", ""),
            c.get("sla", ""),
            calculate_sla_status(c),
        ])

    table = Table(table_data)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#00c8ff")),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.black),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f8ff")]),
        ("GRID",       (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("WORDWRAP",   (0, 0), (-1, -1), "CJK"),
    ]))

    doc.build([table])
    buffer.seek(0)

    return send_file(buffer, as_attachment=True, download_name="complaints.pdf", mimetype="application/pdf")


@app.route('/stats', methods=['GET'])
def stats():
    city_filter     = request.args.get("city", "")
    category_filter = request.args.get("category", "")
    priority_filter = request.args.get("priority", "")

    base_query = {}
    if city_filter:
        base_query["city"] = city_filter
    if category_filter:
        base_query["category"] = category_filter
    if priority_filter:
        base_query["priority"] = priority_filter

    total  = collection.count_documents(base_query)
    high   = collection.count_documents({**base_query, "priority": "High"})
    medium = collection.count_documents({**base_query, "priority": "Medium"})
    low    = collection.count_documents({**base_query, "priority": "Low"})

    cities = ["Ahmedabad", "Surat", "Pune", "Mumbai", "Delhi"]
    city_data = {city: collection.count_documents({**base_query, "city": city}) for city in cities}

    categories = ["Product", "Packaging", "Trade"]
    category_data = {cat: collection.count_documents({**base_query, "category": cat}) for cat in categories}

    resolved = collection.count_documents({**base_query, "status": "Resolved"})
    in_progress = collection.count_documents({**base_query, "status": "In Progress"})
    pending  = collection.count_documents({**base_query, "status": "Pending"})

    # Channel stats (type count)
    channels = ["Text", "Email", "Call Summary"]
    channel_data = {ch: collection.count_documents({**base_query, "type": ch}) for ch in channels}

    # SLA compliant vs breached
    all_docs = list(collection.find(base_query))
    sla_compliant = 0
    sla_breached = 0
    for doc in all_docs:
        sla_stat = calculate_sla_status(doc)
        if sla_stat == "Compliant":
            sla_compliant += 1
        elif sla_stat == "Breached":
            sla_breached += 1

    # Timeline aggregation (last 10 dates with data)
    pipeline = [
        {"$match": base_query},
        {"$project": {
            "date": {
                "$cond": {
                    "if": {"$and": [{"$ifNull": ["$timestamp", False]}, {"$eq": [{"$type": "$timestamp"}, "string"]}]},
                    "then": {"$substr": ["$timestamp", 0, 10]},
                    "else": "Pre-system"
                }
            }
        }},
        {"$group": {
            "_id": "$date",
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 10}
    ]

    timeline_res = list(collection.aggregate(pipeline))
    timeline_data = {item["_id"]: item["count"] for item in timeline_res if item["_id"]}

    return jsonify({
        "total": total,
        "priority": {"high": high, "medium": medium, "low": low},
        "city": city_data,
        "category": category_data,
        "status": {"resolved": resolved, "in_progress": in_progress, "pending": pending},
        "channel": channel_data,
        "sla": {"compliant": sla_compliant, "breached": sla_breached},
        "timeline": timeline_data
    })


if __name__ == "__main__":
    app.run(debug=True)