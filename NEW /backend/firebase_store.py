from firebase_config import db

def store_stock_data(symbol, df):

    records = df.to_dict(orient="records")

    for r in records:

        doc_id = str(r["time"])

        db.collection("stocks") \
          .document(symbol) \
          .collection("ohlcv") \
          .document(doc_id) \
          .set(r)