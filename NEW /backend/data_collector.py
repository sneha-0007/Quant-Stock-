import time
from stocks_list import STOCKS
from app import fetch_ohlcv

INTERVAL = "5m"

while True:

    for stock in STOCKS:

        try:
            print("Fetching:", stock)
            fetch_ohlcv(stock, INTERVAL)

        except Exception as e:
            print("Error:", stock, e)

    time.sleep(300)