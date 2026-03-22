import yfinance as yf
import pandas as pd
import pandas_ta as ta
import xgboost as xgb
import joblib

from stocks_list import STOCKS

print("Downloading data for training...")

all_data = []

for stock in STOCKS:

    print("Fetching:", stock)

    df = yf.download(stock, period="60d", interval="15m")

    if df.empty:
        print("Skipping", stock)
        continue

    # Fix multi-index columns
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df.columns = [c.lower() for c in df.columns]

    # Indicators
    df["SMA"] = ta.sma(df["close"], length=20)
    df["EMA9"] = ta.ema(df["close"], length=9)
    df["RSI"] = ta.rsi(df["close"], length=14)
    
    macd = ta.macd(df["close"])
    if macd is not None:
        df["MACD"] = macd.iloc[:,0]

    # Bollinger Bands (safe detection)
    bb = ta.bbands(df["close"], length=20)
    if bb is not None:
        upper = [c for c in bb.columns if "BBU" in c]
        lower = [c for c in bb.columns if "BBL" in c]

        if upper:
            df["BB_U"] = bb[upper[0]]
        if lower:
            df["BB_L"] = bb[lower[0]]

    df.dropna(inplace=True)

    if df.empty:
        print("Skipping after indicators:", stock)
        continue

    all_data.append(df)

# Safety check
if len(all_data) == 0:
    raise ValueError("No stock data downloaded")

print("Combining datasets...")

data = pd.concat(all_data)

features = ["close","SMA","EMA9","RSI","MACD","BB_U","BB_L","volume"]

X = data[features]
y = data["close"].shift(-1) - data["close"]

X = X[:-1]
y = y[:-1]

print("Training XGBoost model...")

model = xgb.XGBRegressor(
    n_estimators=400,
    max_depth=8,
    learning_rate=0.03,
    subsample=0.9,
    colsample_bytree=0.9
)

model.fit(X,y)

joblib.dump(model,"model.pkl")

print("Model trained and saved as model.pkl")