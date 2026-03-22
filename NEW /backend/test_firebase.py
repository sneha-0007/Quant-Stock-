from firebase_config import db

data = {
    "stock": "RELIANCE",
    "price": 2500
}

db.collection("test").document("sample").set(data)

print("Firebase Connected Successfully")