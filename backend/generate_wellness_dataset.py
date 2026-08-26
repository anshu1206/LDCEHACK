import pandas as pd
import random

# Categories, priorities, SLAs and resolutions definitions
categories = ["Product", "Packaging", "Trade"]
priorities = ["High", "Medium", "Low"]

# Detailed resolution recommendations based on Category & Priority
resolution_rules = {
    ("Product", "High"): "Contact the customer immediately to assess health/safety impact. Issue a full refund, ship a free replacement, and escalate to the QA team to investigate batch contamination.",
    ("Product", "Medium"): "Apologize for the sub-standard quality. Email a prepaid return label to retrieve the item and issue a prompt refund or replacement.",
    ("Product", "Low"): "Acknowledge feedback and share details with the R&D team for flavor/texture improvements. Provide a 15% discount coupon for the next order.",
    
    ("Packaging", "High"): "Apologize for the safety hazard of damaged packaging. Issue a refund or replacement immediately, and escalate to shipping/QA to review bottle durability.",
    ("Packaging", "Medium"): "Apologize for the inconvenience. Ship a replacement pump/dispenser or a new product, and report the transit damage to the logistics department.",
    ("Packaging", "Low"): "Log the aesthetic packaging issue and notify the production team. Thank the customer for bringing it to our attention.",
    
    ("Trade", "High"): "Contact the distributor/retailer immediately. Conduct an internal audit of the billing/shipping system, correct the invoice error, and escalate to the Sales Director.",
    ("Trade", "Medium"): "Investigate shipment status with the courier partner. Provide an updated tracking link, and process a shipping fee refund if delayed beyond SLA.",
    ("Trade", "Low"): "Acknowledge the distributor inquiry. Provide catalog/stock details, and update them with estimated replenishment timelines."
}

# SLA mapping
sla_rules = {
    "High": "24 hours",
    "Medium": "48 hours",
    "Low": "72 hours"
}

# Templates for generating data variations
templates = {
    ("Product", "High"): [
        "Consumed the protein powder and experienced severe stomach cramps, nausea, and vomiting.",
        "The multivitamin gummies have mold growing inside the jar. This is extremely hazardous.",
        "Experienced an intense allergic skin reaction, redness, and itching after applying the face cream.",
        "The lavender oil gave me a terrible chemical burn and skin irritation. Please look into this batch.",
        "Found tiny metal shavings/wire inside the capsules of my herbal supplement bottle. Very dangerous!",
        "The collagen drink smelled rotten and gave my wife severe food poisoning. She had to visit the hospital.",
        "This product is contaminated. There are dark particles floating in the liquid wellness syrup.",
        "The weight loss capsules caused extreme heart palpitations and dizziness immediately after consumption.",
        "The vitamin C drops taste like pure chemicals and made my tongue swell up. I need this checked.",
        "The massage oil caused a severe rash and hives across my back. I am demanding a refund."
    ],
    ("Product", "Medium"): [
        "The protein powder has a horrible, extremely sweet artificial taste. I cannot drink it.",
        "Have been using the hair regrowth serum for 6 weeks as directed but have seen zero improvement.",
        "The flavor of the herbal tea is completely bland and taste-free. It smells stale.",
        "The anti-aging cream is greasy, leaves a white cast, and does not absorb at all.",
        "The product arrived with an expiry date of next week. I cannot finish the bottle in time.",
        "The color of the vitamin C serum has turned completely dark brown, meaning it has oxidized.",
        "The supplement powder has clumped into hard solid rocks that won't dissolve in water.",
        "The fish oil capsules smell extremely fishy and rancid, unlike the previous bottles I bought.",
        "The ashwagandha drops have a weird muddy texture and taste very bitter.",
        "The consistency of the face lotion is very watery, it keeps leaking out of the bottle."
    ],
    ("Product", "Low"): [
        "The face wash texture is slightly more liquid than the previous tube, but it still works okay.",
        "The flavor of the orange protein shake is a bit too sour for my liking.",
        "Would like to know if the herbal capsules are suitable for a vegan diet.",
        "The tea leaves are ground a bit too fine, so they pass through my strainer.",
        "The aroma of the chamomile tea is not as strong as I expected from the label description.",
        "Just wanted to give feedback that the protein bars are a little too hard to chew.",
        "Can you confirm if this aloe vera gel is oil-free and non-comedogenic?",
        "The skin serum feels slightly sticky for the first few minutes after application.",
        "Is there a minor recipe change in the vanilla health shake? The color looks lighter.",
        "Could you provide more details about the source of the marine collagen in the cream?"
    ],
    ("Packaging", "High"): [
        "The glass dropper bottle of facial oil arrived completely shattered. Shattered glass is everywhere inside the box.",
        "The safety seal on the wellness supplement bottle was torn and open when I opened the parcel.",
        "The lotion bottle was crushed during transit, and the liquid leaked, destroying other items in my delivery.",
        "The glass jar of skin ointment is cracked, leaving the product exposed. I cannot use this safely.",
        "The child-resistant safety cap on the supplement bottle was cracked, causing pills to spill out.",
        "The body wash bottle cap was broken, and the entire liquid leaked out, soaking the cardboard box.",
        "The seal under the cap was missing completely on this protein powder tub. Is it safe to use?",
        "The glass bottle of massage oil broke in transit, and oil ruined my table where the box was kept.",
        "Received a damaged and opened tube of cream with product oozing out of the side seam.",
        "The packaging box arrived open, and the bottle inside was cracked, causing liquid to spill."
    ],
    ("Packaging", "Medium"): [
        "The pump on the face serum bottle is jammed and won't dispense any liquid.",
        "The child-lock mechanism on the vitamin bottle is defective; it spins freely and won't open.",
        "The spray nozzle on the rose water mist is blocked and shoots a stream instead of a fine mist.",
        "The printed dosage instructions on the back of the package are extremely blurry and unreadable.",
        "The cap on the oil bottle does not close tightly, causing it to slow-leak when stored horizontally.",
        "The dropper bulb is torn and does not suck up the liquid oil from the bottle.",
        "The label on the supplement bottle is peeling off, and I can't read the allergy warnings.",
        "The flip-top lid on the tube of face scrub snapped off on the first day of use.",
        "The package design makes it very difficult to squeeze out the thick paste from the tube.",
        "The scoop inside the protein powder tub was broken in half."
    ],
    ("Packaging", "Low"): [
        "The outer cardboard box was slightly dented, but the bottle inside was perfectly fine.",
        "The logo print on the shampoo bottle is misaligned and looks slightly cheap.",
        "The packaging is a bit bulky and takes up too much space in my medicine cabinet.",
        "The plastic wrap around the bottle was scratched, although the seal was intact.",
        "The color of the pump dispenser cap is different from what was shown in the website image.",
        "The box had some glue residue on the surface, making it sticky to hold.",
        "The text font on the packaging is a bit too small to read easily without glasses.",
        "Just a minor suggestion to use eco-friendly paper packaging instead of plastic wraps.",
        "The dispenser cap has a minor scratch, but the product works fine.",
        "The outer packaging box did not have the new brand logo on it."
    ],
    ("Trade", "High"): [
        "Our pharmacy order was double billed on the credit card. Charge shows $1500 twice.",
        "Ordered 200 bulk units of protein shakes for our retail store, but the invoice shows we paid for 200 and received only 100.",
        "The wholesale invoice does not reflect the 25% distributor discount we agreed upon in our contract.",
        "We sent a payment of $5000 for order #TR8932 two weeks ago, but your warehouse team is withholding shipping.",
        "We received a invoice billing us for 50 boxes of skin creams that we never ordered or received.",
        "Our wholesale distributor account was charged for a shipment that was cancelled in writing last month.",
        "As a retail partner, we are losing sales because your system keeps generating incorrect trade prices.",
        "Our warehouse received a shipment where half the bulk boxes were empty. We need immediate billing correction.",
        "There is a pricing error on the B2B portal charging us double the distributor list price for wellness teas.",
        "We paid for express trade delivery, but our shipment has been stuck at your fulfillment center for 10 days."
    ],
    ("Trade", "Medium"): [
        "The bulk delivery to our Surat store is delayed by 5 days, and our shelves are running out of stock.",
        "The wholesale shipment arrived with 10 units of chocolate flavor instead of the vanilla flavor we ordered.",
        "The tracking link for our retail store order is broken and shows an error message.",
        "We received a consignment of health supplements, but 5 jars had expired date labels.",
        "The courier partner left the wholesale package outside our warehouse in the rain, damaging the outer cases.",
        "We requested a credit note for returned stock last month, but it has not been issued to our trade account yet.",
        "Our retail order was shipped to our old Pune office address instead of our new Ahmedabad warehouse.",
        "The delivery driver refused to unload the bulk pallet at our loading dock as agreed.",
        "We received the shipping notification for our wholesale order, but the courier has not picked it up yet.",
        "Could you update the delivery date for retail order #TR992? We need to schedule staff for unloading."
    ],
    ("Trade", "Low"): [
        "Please send the updated wholesale product catalog and retail pricing sheet for 2026.",
        "We want to know when the organic herbal tea will be back in stock for wholesale ordering.",
        "Can we request a copy of the monthly statement for our distributor account?",
        "Do you offer free shipping for retail partner orders exceeding $2000?",
        "We would like to register a new retail outlet under our distributor profile.",
        "Could you change the primary contact email for our trade billing department?",
        "We wanted to inquire about the minimum order quantity (MOQ) for the new collagen creams.",
        "Does the trade discount apply to the holiday wellness bundle as well?",
        "Is there a retail training module available for your new range of vitamins?",
        "We need an excel version of the product ingredient list for our retail website."
    ]
}

# Expand the templates by adding prefixes, suffixes, locations, and batch number variations to make 450+ rows
data = []
random.seed(42)

cities = ["Surat", "Ahmedabad", "Pune", "Mumbai", "Delhi"]
areas_pool = ["Adajan", "Satellite", "Kothrud", "Bandra", "Dwarka", "Vesu", "Navrangpura", "Baner", "Juhu", "Saket"]

channels = ["Text", "Email", "Call Summary"]

for (cat, prio), texts in templates.items():
    res = resolution_rules[(cat, prio)]
    sla = sla_rules[prio]
    
    # Generate 50 examples for each combination -> 9 * 50 = 450 examples total
    for i in range(50):
        base_text = texts[i % len(texts)]
        
        # Add some variations
        variation = random.choice([
            lambda t: f"Dear Support, {t} Please resolve this.",
            lambda t: f"Complaint: {t} Batch No: BATCH-{random.randint(1000, 9999)}.",
            lambda t: f"Urgent: {t}",
            lambda t: f"{t} I am very disappointed.",
            lambda t: t,
            lambda t: f"Hello team, {t} Need a response soon. Thanks.",
        ])
        
        text = variation(base_text)
        city = random.choice(cities)
        area = random.choice(areas_pool)
        
        data.append({
            "text": text,
            "category": cat,
            "priority": prio,
            "recommendation": res,
            "sla": sla,
            "city": city,
            "area": area
        })

df = pd.DataFrame(data)
df.to_csv("ai_complaint_dataset_2000.csv", index=False)
print(f"Generated {len(df)} wellness complaints and saved to 'ai_complaint_dataset_2000.csv'")
df.to_csv("wellness_complaint_dataset.csv", index=False)
print("Saved a copy as 'wellness_complaint_dataset.csv'")
