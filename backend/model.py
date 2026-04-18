import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.multioutput import MultiOutputClassifier
from sklearn.pipeline import Pipeline
import joblib

# Load dataset
df = pd.read_csv("ai_complaint_dataset_2000.csv")

# Features & labels
X = df["Complaint_Text"]
y = df[["Category", "Priority", "Suggested_Resolution"]]

# Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# Pipeline
model = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("clf", MultiOutputClassifier(LogisticRegression()))
])

# Train
model.fit(X_train, y_train)
print(df["Category"].value_counts())
# Save model
joblib.dump(model, "complaint_model.pkl")