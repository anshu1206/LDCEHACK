def get_recommendation(category, priority):

    if category == "Product":
        return f"{priority} priority: Replace product within 24 hours"

    elif category == "Packaging":
        return f"{priority} priority: Replace item and audit packaging process"

    elif category == "Trade":
        return f"{priority} priority: Escalate to sales team"

    return "Manual review required"