def get_priority(text):
    text = text.lower()
    score = 0

    urgent_words = ["urgent", "immediately", "worst", "asap"]
    medium_words = ["delay", "late", "issue"]

    for word in urgent_words:
        if word in text:
            score += 2

    for word in medium_words:
        if word in text:
            score += 1

    if score >= 3:
        return "High"
    elif score == 2:
        return "Medium"
    else:
        return "Low"
    