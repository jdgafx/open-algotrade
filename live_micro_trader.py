#!/usr/bin/env python3
"""
Live $25 Hyperliquid Trading Bot with Real Order Execution
WARNING: This bot uses REAL money - start with minimum amounts!
"""

import requests
import json
import time
import os
from datetime import datetime, timedelta
import hmac
import hashlib
from eth_account import Account
from eth_account.messages import encode_defunct

# Import configuration (you need to create this file)
try:
    from config_keys import HYPERLIQUID_PRIVATE_KEY, HYPERLIQUID_ADDRESS, TRADING_CONFIG, RISK_LIMITS, DISCORD_WEBHOOK_URL
except ImportError:
    print("❌ CONFIG ERROR: Create 'config_keys.py' from 'config_keys.py.example'")
    print("❌ Fill in your Hyperliquid API keys first!")
    exit(1)

class LiveMicroTrader:
    def __init__(self):
        self.base_url = "https://api.hyperliquid.xyz/info"
        self.exchange_url = "https://api.hyperliquid.xyz/exchange"

        # Configuration
        self.capital = TRADING_CONFIG["capital"]
        self.leverage = TRADING_CONFIG["leverage"]
        self.max_position_value = TRADING_CONFIG["max_position_value"]
        self.position_size_dollars = TRADING_CONFIG["position_size_dollars"]
        self.symbol = TRADING_CONFIG["symbol"]
        self.stop_loss_pct = TRADING_CONFIG["stop_loss_pct"]
        self.take_profit_pct = TRADING_CONFIG["take_profit_pct"]
        self.max_daily_loss = TRADING_CONFIG["max_daily_loss"]

        # Risk management
        self.risk_limits = RISK_LIMITS

        # Account setup
        self.private_key = HYPERLIQUID_PRIVATE_KEY
        self.address = HYPERLIQUID_ADDRESS

        # Trading state
        self.daily_trades = 0
        self.daily_pnl = 0.0
        self.last_trade_time = None
        self.current_position = None

        # Safety checks
        if not self.private_key or not self.address:
            print("❌ ERROR: Missing API keys in config_keys.py")
            exit(1)

        print(f"🚀 LIVE MICRO TRADER - ${self.capital} CAPITAL")
        print(f"⚠️  WARNING: REAL MONEY TRADING ACTIVE")
        print(f"💰 Position size: ${self.position_size_dollars}")
        print(f"📈 Leverage: {self.leverage}x")
        print(f"🎯 Max daily loss: ${self.max_daily_loss}")

    def get_price(self):
        """Get current WIF price"""
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

    def get_account_info(self):
        """Get account information and positions"""
        try:
            data = {"type": "clearinghouseState", "user": self.address}
            response = requests.post(self.base_url,
                                   headers={'Content-Type': 'application/json'},
                                   data=json.dumps(data))

            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            print(f"❌ Account info error: {e}")
            return None

    def calculate_position_size(self, price):
        """Calculate position size based on allocated dollars"""
        if price is None:
            return 0
        size = self.position_size_dollars / price
        return round(size, 6)  # Round to 6 decimal places for precision

    def send_alert(self, message):
        """Send Discord alert"""
        if not DISCORD_WEBHOOK_URL:
            return

        try:
            data = {
                "content": f"🤖 MicroTrader Alert: {message}",
                "username": "MicroTrader Bot"
            }
            requests.post(DISCORD_WEBHOOK_URL, json=data)
        except:
            print("⚠️  Failed to send Discord alert")

    def check_daily_limits(self):
        """Check if we've hit daily trading limits"""
        if self.daily_pnl <= -self.max_daily_loss:
            print("🛑 DAILY LOSS LIMIT REACHED - STOPPING TRADING")
            self.send_alert("Daily loss limit reached - trading stopped")
            return False

        if self.daily_trades >= self.risk_limits["max_daily_trades"]:
            print("🛑 DAILY TRADE LIMIT REACHED")
            return False

        return True

    def check_risk_limits(self, price, position_size):
        """Risk management checks before trading"""
        position_value = position_size * price

        # Check position size
        if position_value > self.max_position_value:
            print(f"❌ Position too large: ${position_value:.2f} > ${self.max_position_value}")
            return False

        # Check if we already have position
        if self.current_position:
            print("⚠️  Already in position - wait for exit")
            return False

        return True

    def execute_market_order(self, side, size, price):
        """Execute a market order on Hyperliquid"""
        try:
            timestamp = int(time.time() * 1000)

            # Order data
            order_data = {
                "order": {
                    "a": self.symbol,  # asset
                    "b": str(size),    # size
                    "p": str(price),   # price
                    "s": side,         # side: "B" for buy, "S" for sell
                    "r": "GTC",        # time in force: Good Till Cancelled
                    "t": {"limit": {"tif": "GTC"}},  # order type
                },
                "nonce": timestamp
            }

            # Create signature
            message = json.dumps(order_data, separators=(',', ':'))
            message_hash = hashlib.sha256(message.encode()).hexdigest()

            account = Account.from_key(self.private_key)
            signature = account.sign_message(encode_defunct(text=message))

            # Request payload
            payload = {
                "order": order_data["order"],
                "signature": signature.signature.hex(),
                "nonce": timestamp
            }

            # Send order
            response = requests.post(
                self.exchange_url,
                headers={'Content-Type': 'application/json'},
                data=json.dumps(payload)
            )

            if response.status_code == 200:
                result = response.json()
                if result.get("status") == "ok":
                    print(f"✅ {side.upper()} order executed: {size} {self.symbol} at ${price}")
                    self.send_alert(f"Executed {side.upper()}: {size} {self.symbol} @ ${price}")
                    return True
                else:
                    print(f"❌ Order rejected: {result.get('response', 'Unknown error')}")
                    return False
            else:
                print(f"❌ Order failed: HTTP {response.status_code}")
                print(f"Response: {response.text}")
                return False

        except Exception as e:
            print(f"❌ Order execution error: {e}")
            return False

    def simple_strategy(self):
        """Simple mean reversion strategy for testing"""
        price, bid, ask = self.get_price()
        if price is None:
            return False

        position_size = self.calculate_position_size(price)

        print(f"📊 Current WIF: ${price:.6f} | Bid: ${bid:.6f} | Ask: ${ask:.6f}")

        # Check daily limits
        if not self.check_daily_limits():
            return False

        # Risk management check
        if not self.check_risk_limits(price, position_size):
            return False

        # Get account info to check current positions
        account_info = self.get_account_info()
        if account_info and 'assetPositions' in account_info:
            # Check if we have open WIF position
            wif_position = next((pos for pos in account_info['assetPositions']
                                if pos['position']['coin'] == self.symbol), None)
            if wif_position:
                size = float(wif_position['position']['szi'])
                if abs(size) > 0:
                    self.current_position = {
                        'size': abs(size),
                        'side': 'long' if size > 0 else 'short',
                        'entry_price': float(wif_position['position']['entryPx'])
                    }
                    print(f"📈 Current position: {self.current_position['side']} {self.current_position['size']} @ ${self.current_position['entry_price']:.6f}")
                else:
                    self.current_position = None

        # Simple strategy logic
        if self.current_position:
            # Check for exit conditions
            pnl_pct = 0
            if self.current_position['side'] == 'long':
                pnl_pct = (price - self.current_position['entry_price']) / self.current_position['entry_price']
            else:
                pnl_pct = (self.current_position['entry_price'] - price) / self.current_position['entry_price']

            if pnl_pct >= self.take_profit_pct:
                print(f"🎯 TAKE PROFIT: {pnl_pct*100:.2f}% gain")
                side = "S" if self.current_position['side'] == 'long' else "B"
                return self.execute_market_order(side, self.current_position['size'], ask if side == "S" else bid)
            elif pnl_pct <= -self.stop_loss_pct:
                print(f"🛑 STOP LOSS: {pnl_pct*100:.2f}% loss")
                side = "S" if self.current_position['side'] == 'long' else "B"
                return self.execute_market_order(side, self.current_position['size'], ask if side == "S" else bid)
        else:
            # Check for entry conditions (simple momentum)
            # Buy if price seems "low" (arbitrary threshold for testing)
            if price < 0.5:  # Buy WIF under $0.50
                print(f"📈 ENTRY SIGNAL: BUY at ${price:.6f}")
                return self.execute_market_order("B", position_size, ask)
            elif price > 0.8:  # Short WIF over $0.80
                print(f"📉 ENTRY SIGNAL: SHORT at ${price:.6f}")
                return self.execute_market_order("S", position_size, bid)

        return False

    def run(self):
        """Main trading loop"""
        print(f"\n🚀 STARTING LIVE TRADING")
        print(f"⚠️  REAL MONEY MODE - CAPITAL: ${self.capital}")
        print(f"📊 Monitoring {self.symbol} every 30 seconds")
        print("=" * 50)

        self.send_alert("MicroTrader started - Live trading mode activated")

        try:
            while True:
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"\n⏰ {timestamp}")

                # Execute strategy
                if self.simple_strategy():
                    self.daily_trades += 1
                    self.last_trade_time = datetime.now()

                # Sleep before next check
                time.sleep(30)

        except KeyboardInterrupt:
            print(f"\n⏹️  Trading stopped by user")
            self.send_alert("Trading stopped by user")
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            self.send_alert(f"Trading error: {e}")

def main():
    print("🎯 $25 Hyperliquid LIVE Micro Trader")
    print("=" * 50)
    print("⚠️  WARNING: THIS USES REAL MONEY!")
    print("⚠️  START WITH MINIMUM AMOUNTS!")
    print("=" * 50)

    # Safety check
    confirm = input("Type 'LIVE' to confirm you want to trade with real money: ")
    if confirm != "LIVE":
        print("❌ Aborted - Not starting live trading")
        return

    trader = LiveMicroTrader()
    trader.run()

if __name__ == "__main__":
    main()