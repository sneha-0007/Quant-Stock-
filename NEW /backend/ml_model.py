import xgboost as xgb
import pandas as pd
import numpy as np
import joblib
import os

model = None
MODEL_PATH = "model.pkl"


def train_model(df):

    global model

    features = ["close","SMA","EMA9","RSI","MACD","BB_U","BB_L","volume"]

    df = df.dropna()

    X = df[features]
    y = df["close"].shift(-3)

    X = X[:-1]
    y = y[:-1]

    model = xgb.XGBRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.05
    )

    model.fit(X, y)

    # Save trained model
    joblib.dump(model, MODEL_PATH)

    print("ML model trained and saved.")

def predict_price(df):

    global model

    features = ["close","SMA","EMA9","RSI","MACD","BB_U","BB_L","volume"]

    # Load trained model
    if model is None:

        if os.path.exists(MODEL_PATH):
            model = joblib.load(MODEL_PATH)
            print("Loaded trained ML model")

        else:
            print("Training ML model...")
            train_model(df)

    last_row = df[features].tail(1)

    # Ensure no NaN
    last_row = last_row.ffill()
    
    price_change = model.predict(last_row)[0]

    current_price = df["close"].iloc[-1]

    prediction = current_price + price_change
    prediction = (prediction + current_price) / 2

    # Direction signal
    direction = "BUY" if prediction > current_price else "SELL"

    # Confidence based on prediction error
    error = abs(prediction - current_price)
    confidence = max(60, 100 - error*2)
    confidence = round(confidence)

    return {
        "predicted": round(float(prediction),2),
        "confidence": confidence,
        "direction": direction
    }
