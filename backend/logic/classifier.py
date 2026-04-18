def classify_complaint(text):
    text = text.lower()
    
    score = {"Product": 0, "Packaging": 0, "Trade": 0}

    for word in ["damaged", "broken", "defective"]:
        if word in text:
            score["Product"] += 2

    for word in ["leak", "box", "packaging"]:
        if word in text:
            score["Packaging"] += 2

    for word in ["price", "order", "dealer"]:
        if word in text:
            score["Trade"] += 2

    return max(score, key=score.get)