from flask import Flask, request, jsonify
from pymongo import MongoClient

from logic.classifier import classify_complaint
from logic.priority import get_priority
from logic.recommendation import get_recommendation

app = Flask(__name__)

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client["complaint_db"]
collection = db["complaints"]

@app.route('/')
def home():
    return "Backend is running ✅"

@app.route('/analyze', methods=['POST'])
def analyze():
    print("API HIT ✅")

    data = request.get_json()
    print("DATA RECEIVED:", data)

    # Safety check
    if not data or "complaint" not in data:
        return jsonify({"error": "Complaint text missing"}), 400

    text = data.get("complaint")

    # AI logic
    category = classify_complaint(text)
    priority = get_priority(text)
    recommendation = get_recommendation(category, priority)

    # SLA logic
    if priority == "High":
        sla = "24 hours"
    elif priority == "Medium":
        sla = "48 hours"
    else:
        sla = "72 hours"

    # Store in MongoDB
    complaint_data = {
        "text": text,
        "category": category,
        "priority": priority,
        "recommendation": recommendation,
        "sla": sla,
        "status": "Pending"
    }

    collection.insert_one(complaint_data)

    # fix for ObjectId error
    complaint_data.pop("_id", None)

    return jsonify(complaint_data)

@app.route('/complaints', methods=['GET'])
def get_complaints():
    data = list(collection.find({}, {"_id": 0}))
    return jsonify(data)

@app.route('/update-status', methods=['POST'])
def update_status():
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data received"}), 400

    text = data.get("text")
    status = data.get("status")

    if not text or not status:
        return jsonify({"error": "Missing text or status"}), 400

    result = collection.update_one(
        {"text": text},
        {"$set": {"status": status}}
    )

    if result.matched_count == 0:
        return jsonify({"error": "Complaint not found"}), 404

    return jsonify({"message": "Status updated successfully"})

@app.route('/stats', methods=['GET'])
def stats():
    total = collection.count_documents({})

    high = collection.count_documents({"priority": "High"})
    medium = collection.count_documents({"priority": "Medium"})
    low = collection.count_documents({"priority": "Low"})

    product = collection.count_documents({"category": "Product"})
    packaging = collection.count_documents({"category": "Packaging"})
    trade = collection.count_documents({"category": "Trade"})

    return jsonify({
        "total": total,
        "priority": {
            "high": high,
            "medium": medium,
            "low": low
        },
        "category": {
            "product": product,
            "packaging": packaging,
            "trade": trade
        }
    })


if __name__ == "__main__":
    app.run(debug=True) //app.py