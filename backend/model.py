import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.multioutput import MultiOutputClassifier
from sklearn.pipeline import Pipeline
import joblib

# Load dataset
df = pd.read_csv("ai_complaint_dataset_2000.csv")

# Rename columns to match your old code (IMPORTANT FIX)
df = df.rename(columns={
    "text": "Complaint_Text",
    "category": "Category",
    "priority": "Priority",
    "recommendation": "Suggested_Resolution"
})

# Basic cleaning
df["Complaint_Text"] = df["Complaint_Text"].str.lower()

# Features & labels
X = df["Complaint_Text"]
y = df[["Category", "Priority", "Suggested_Resolution"]]

# Split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Pipeline
model = Pipeline([
    ("tfidf", TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2)
    )),
    ("clf", MultiOutputClassifier(
        RandomForestClassifier(
            n_estimators=100,
            class_weight="balanced"
        )
    ))
])

# Train
model.fit(X_train, y_train)

# Debug
print(df["Category"].value_counts())

# Save model
joblib.dump(model, "complaint_model.pkl")

print("✅ Model trained and saved successfully!")