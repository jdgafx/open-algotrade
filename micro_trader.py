#!/usr/bin/env python3
"""
$25 Hyperliquid Trading Bot
Minimal viable bot for testing with small capital
"""

import requests
import json
import time
import os
from datetime import datetime

class MicroTrader:
    def __init__(self):
        self.base_url = "https://api.hyperliquid.xyz/info"
        self.exchange_url = "https://api.hyperliquid.xyz/exchange"

        # Trading parameters for $25 capital
        self.capital = 25.0
        self.leverage = 10  # Conservative leverage
        self.max_position_value = self.capital * self.leverage  # $250 effective

        # WIF settings (good for micro trading)
        self.symbol = "WIF"
        self.position_size_dollars = 5.0  # Start with $5 positions

        print(f"🚀 Micro Trader initialized with ${self.capital} capital")
        print(f"💰 Effective buying power: ${self.max_position_value} (10x leverage)")
        print(f"📈 Starting position size: ${self.position_size_dollars}")

    def get_price(self):
        """Get current price of WIF"""
        try:
            data = {"type": "l2Book", "coin": self.symbol}
            response = requests.post(self.base_url,
                                   headers={'Content-Type': 'application/json'},
                                   data=json.dumps(data))

            if response.status_code == 200:
                book = response.json()
                if 'levels' in book and len(book['levels']) >= 2:
                    bid = float(book['levels'][0][0]['px'])
                    ask = float(book['levels'][1][0]['px'])
                    mid_price = (bid + ask) / 2
                    return mid_price, bid, ask
            return None, None, None
        except Exception as e:
            print(f"❌ Price fetch error: {e}")
            return None, None, None

    def get_metadata(self):
        """Get trading metadata for WIF"""
        try:
            data = {"type": "meta"}
            response = requests.post(self.base_url,
                                   headers={'Content-Type': 'application/json'},
                                   data=json.dumps(data))

            if response.status_code == 200:
                meta = response.json()
                for symbol_data in meta['universe']:
                    if symbol_data['name'] == self.symbol:
                        return symbol_data
            return None
        except Exception as e:
            print(f"❌ Metadata fetch error: {e}")
            return None

    def calculate_position_size(self, price):
        """Calculate position size based on price and allocated dollars"""
        if price is None:
            return 0

        # For WIF, calculate how many coins we can buy with our allocated amount
        size = self.position_size_dollars / price
        return round(size, 4)  # Round to 4 decimal places

    def simulate_trade(self):
        """Simulate a trade without actual API keys"""
        print("\n📊 SIMULATION MODE - Testing strategy logic")

        price, bid, ask = self.get_price()
        if price is None:
            print("❌ Cannot fetch price - simulation failed")
            return False

        metadata = self.get_metadata()
        if metadata is None:
            print("❌ Cannot fetch metadata - simulation failed")
            return False

        position_size = self.calculate_position_size(price)

        print(f"💡 Current WIF price: ${price:.6f}")
        print(f"💡 Bid: ${bid:.6f} | Ask: ${ask:.6f}")
        print(f"💡 Spread: {((ask-bid)/price)*100:.3f}%")
        print(f"💡 Calculated position size: {position_size} WIF")
        print(f"💡 Position value: ${position_size * price:.2f}")

        # Simple strategy: Buy when price is "low" (for demo)
        if price < 1.5:  # Arbitrary low price for WIF
            print(f"✅ SIGNAL: BUY at ${price:.6f}")
            print(f"📈 Potential profit if price goes to $2.00: ${(2.0 - price) * position_size:.2f}")
        elif price > 2.5:  # Arbitrary high price
            print(f"✅ SIGNAL: SELL at ${price:.6f}")
        else:
            print(f"⏳ HOLD: Price ${price:.6f} is in neutral range")

        return True

    def run_paper_trading(self):
        """Run paper trading simulation"""
        print("\n📝 PAPER TRADING MODE")
        print("=" * 50)

        trades = []
        portfolio_value = self.capital

        for i in range(10):  # Simulate 10 price checks
            price, bid, ask = self.get_price()
            if price is None:
                continue

            timestamp = datetime.now().strftime("%H:%M:%S")

            # Simple momentum strategy
            if len(trades) == 0 or trades[-1]['action'] == 'SELL':
                # Look to buy
                if price < 1.8:  # Buy signal
                    size = self.calculate_position_size(price)
                    trades.append({
                        'time': timestamp,
                        'action': 'BUY',
                        'price': price,
                        'size': size,
                        'value': size * price
                    })
                    print(f"📈 {timestamp} BUY {size:.4f} WIF at ${price:.6f} = ${size*price:.2f}")

            elif trades[-1]['action'] == 'BUY':
                # Look to sell
                last_buy = trades[-1]
                if price > last_buy['price'] * 1.02:  # 2% profit target
                    trades.append({
                        'time': timestamp,
                        'action': 'SELL',
                        'price': price,
                        'size': last_buy['size'],
                        'value': last_buy['size'] * price
                    })
                    profit = (price - last_buy['price']) * last_buy['size']
                    portfolio_value += profit
                    print(f"💰 {timestamp} SELL {last_buy['size']:.4f} WIF at ${price:.6f}")
                    print(f"🎉 Profit: ${profit:.4f} | Portfolio: ${portfolio_value:.2f}")

            time.sleep(2)  # Wait 2 seconds between checks

        print("\n" + "=" * 50)
        print(f"📊 PAPER TRADING COMPLETE")
        print(f"💼 Starting capital: ${self.capital:.2f}")
        print(f"💼 Ending value: ${portfolio_value:.2f}")
        print(f"📈 Total P&L: ${portfolio_value - self.capital:.2f}")
        print(f"📈 Return: {((portfolio_value - self.capital) / self.capital) * 100:.2f}%")

def main():
    print("🎯 $25 Hyperliquid Micro Trader")
    print("=" * 40)

    trader = MicroTrader()

    print("\n🔍 Testing API connectivity...")
    price, bid, ask = trader.get_price()

    if price:
        print(f"✅ Connected to Hyperliquid!")
        print(f"💡 WIF Current Price: ${price:.6f}")

        print("\n📊 Running simulation...")
        if trader.simulate_trade():
            print("\n📝 Would you like to run paper trading? (y/n)")
            # In real usage, you'd get user input here
            print("📝 Running paper trading simulation...")
            trader.run_paper_trading()
    else:
        print("❌ Failed to connect to Hyperliquid API")

if __name__ == "__main__":
    main()