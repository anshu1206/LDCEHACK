from flask import Flask, request, jsonify
from pymongo import MongoClient

#from logic.classifier import classify_complaint
#from logic.priority import get_priority
#from logic.recommendation import get_recommendation
from flask_cors import CORS
from bson import ObjectId

app = Flask(__name__)
CORS(app)
# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client["complaint_db"]
collection = db["complaints"]

import joblib

model = joblib.load("complaint_model.pkl")

def predict_complaint(text):
    prediction = model.predict([text])

    return {
        "category": prediction[0][0],
        "priority": prediction[0][1],
        "resolution": prediction[0][2]
    }
@app.route('/analyze', methods=['POST'])
def analyze():
    print("API HIT ✅")

    data = request.get_json()

    if not data or "complaint" not in data:
        return jsonify({"error": "Complaint text missing"}), 400

    text = data.get("complaint")
    city = data.get("city")
    area = data.get("area")

    
    # 🔥 USE ML MODEL HERE
    result = predict_complaint(text)
    text_lower = text.lower()
        # 🚰 Drinking water / supply issue
    if any(word in text_lower for word in ["drinking water", "no water", "water supply", "water not available"]):
        category = "Infrastructure"
        priority = "High"
        recommendation = "Restore drinking water supply immediately and ensure regular availability"
    # 💧 Leakage issue (separate)
    elif any(word in text_lower for word in ["leak", "leakage", "pipe burst"]):
        category = "Infrastructure"
        priority = "Medium"
        recommendation = "Inform maintenance team to fix water leakage and plumbing issues"
    elif any(word in text_lower for word in ["ventilation", "fan", "air", "classroom", "bench", "infrastructure"]):
        category = "Infrastructure"
        priority = "Medium"
        recommendation = "Inspect classroom facilities and improve ventilation and maintenance"
    elif any(word in text_lower for word in ["wifi", "internet", "network", "portal", "server"]):
        category = "IT Services"
        priority = "Medium"
        recommendation = "Check network infrastructure and resolve WiFi connectivity issues"
    elif any(word in text_lower for word in ["job", "internship", "placement", "career"]):
        category = "Career"
        priority = "Medium"
        recommendation = "Provide career counseling and placement support"
    elif any(word in text_lower for word in ["security", "unauthorized", "intruder", "safety"]):
        category = "Security"
        priority = "High"
        recommendation = "Alert security and increase monitoring in the area"
    else:
        # 👉 ML MODEL ONLY IF RULE DOESN'T MATCH
        result = predict_complaint(text)
        category = result["category"]
        priority = result["priority"]
        recommendation = result["resolution"]
        recommendation_map = {
        "Cleanliness": "Notify housekeeping staff and schedule immediate cleaning",
        "Hostel": "Inform hostel warden and resolve the issue promptly",
        "Transport": "Contact transport department and review schedule",
        "Career": "Provide career counseling and placement support",
        "Food": "Conduct food quality inspection, review hygiene standards, and improve mess services",
        "IT Services": "Check network infrastructure and resolve WiFi connectivity issues",
        "Infrastructure": "Inspect classroom facilities and improve ventilation and maintenance"
    }

        if category in recommendation_map:
            recommendation = recommendation_map[category]

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
        "city": city,     
        "area": area,   
        "status": "Pending"
    }

    result = collection.insert_one(complaint_data)
    complaint_data["_id"] = str(result.inserted_id)

    return jsonify(complaint_data)

@app.route('/complaints', methods=['GET'])
def get_complaints():
    data = list(collection.find())

    for c in data:
        c["_id"] = str(c["_id"])

    return jsonify(data)

@app.route('/update-status', methods=['POST'])
def update_status():
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data received"}), 400

    complaint_id = data.get("id")
    status = data.get("status")

    if not complaint_id or not status:
        return jsonify({"error": "Missing id or status"}), 400

    result = collection.update_one(
        {"_id": ObjectId(complaint_id)},
        {"$set": {"status": status}}
    )

    if result.matched_count == 0:
        return jsonify({"error": "Complaint not found"}), 404

    return jsonify({"message": "Status updated successfully"})

import pandas as pd
from flask import Response

@app.route('/export/csv')
def export_csv():
    data = list(collection.find({}, {"_id": 0}))

    df = pd.DataFrame(data)

    file_path = "complaints.csv"
    df.to_csv(file_path, index=False)

    return send_file(file_path, as_attachment=True)
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from flask import send_file
import io
@app.route('/export/pdf')
def export_pdf():
    data = list(collection.find({}, {"_id": 0}))

    file_path = "complaints.pdf"
    doc = SimpleDocTemplate(file_path)

    table_data = [["Text", "Category", "Priority", "City", "Area", "Status"]]

    for c in data:
        table_data.append([
            c.get("text", ""),
            c.get("category", ""),
            c.get("priority", ""),
            c.get("city", ""),
            c.get("area", ""),
            c.get("status", "")
        ])

    table = Table(table_data)
    doc.build([table])

    return send_file(file_path, as_attachment=True)


@app.route('/stats', methods=['GET'])
def stats():
    total = collection.count_documents({})

    high = collection.count_documents({"priority": "High"})
    medium = collection.count_documents({"priority": "Medium"})
    low = collection.count_documents({"priority": "Low"})

    # 🔥 City-wise counts
    cities = ["Ahmedabad", "Surat", "Pune", "Mumbai", "Delhi"]
    city_data = {city: collection.count_documents({"city": city}) for city in cities}

    # 🔥 Category-wise counts
    categories = ["Cleanliness", "Transport", "Academics", "Security", "Library", "Food", "IT Services", "Hostel", "Infrastructure", "Career"]
    category_data = {cat: collection.count_documents({"category": cat}) for cat in categories}

    resolved = collection.count_documents({"status": "Resolved"})
    pending = collection.count_documents({"status": "Pending"})
    return jsonify({
    "total": total,
    "priority": {
        "high": high,
        "medium": medium,
        "low": low
    },
    "city": city_data,
    "category": category_data,
    "status": {
        "resolved": resolved,
        "pending": pending
    }
})
if __name__ == "__main__":
    app.run(debug=True)