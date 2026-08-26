# LDCE Hackathon — ResolveBot AI 🤖

## 📌 Overview
AI-powered complaint management system built for the LDCE Hackathon. Automatically classifies complaints by **category**, **priority**, and generates **resolution recommendations** using a trained ML model.

---

## 🧠 Features

### Frontend
- 🎨 Cyberpunk dark theme with animated grid, particles & custom cursor
- 📝 Complaint input with **voice input** support (Web Speech API)
- 🔍 Real-time AI analysis with **loading state** and full error handling
- 💬 Character counter for complaint text
- 📋 Complaints list with **search**, **filter by category/priority/status**, and **pagination**
- 📊 Analytics dashboard with 4 interactive charts (Chart.js)
- 🔄 **Auto-refresh** every 30 seconds on Analytics page
- 🗑️ Delete complaint with smooth animation
- ✅ Toggle Resolved / Reopen complaint status
- 📥 Export as CSV or PDF
- 🕒 "Time ago" timestamps on complaint cards
- 🍞 Toast notifications for all actions

### Backend (Flask + MongoDB)
- 🤖 ML model (Random Forest + TF-IDF) for multi-output classification
- 📋 Rule-based override layer for common complaint patterns
- ⏱️ SLA assignment based on priority (High: 24h, Medium: 48h, Low: 72h)
- 📄 Paginated `/complaints` endpoint with filtering support
- 🗑️ DELETE `/complaints/<id>` endpoint
- 🕒 Timestamps saved with every complaint
- ✅ Input validation (length, empty check, test inputs)
- 📤 CSV & PDF export with styled table
- 🌍 MongoDB URI via environment variable

---

## 🚀 Getting Started

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### Frontend
Open `Frontend/splash.html` in your browser (or use Live Server in VS Code).

---

## 📁 Project Structure
```
LDCE HACKATHON/
├── Frontend/
│   ├── splash.html       # Animated intro screen
│   ├── index.html        # Complaint analyzer
│   ├── complaints.html   # Complaints list with search/filter
│   ├── stats.html        # Analytics dashboard
│   ├── script.js         # All frontend logic
│   └── style.css         # Cyberpunk theme
├── backend/
│   ├── app.py            # Flask API
│   ├── model.py          # ML training script
│   ├── requirements.txt  # Python dependencies
│   └── complaint_model.pkl
└── README.md
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze` | Analyze & classify a complaint |
| GET | `/complaints` | List complaints (paginated, filterable) |
| POST | `/update-status` | Toggle complaint status |
| DELETE | `/complaints/<id>` | Delete a complaint |
| GET | `/stats` | Get aggregate statistics |
| GET | `/export/csv` | Download CSV |
| GET | `/export/pdf` | Download PDF |