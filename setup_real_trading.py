#!/usr/bin/env python3
"""
Setup Script for Real Trading
Creates config file and guides through API setup
"""

import os
import getpass
import requests
import json

def setup_hyperliquid_config():
    """Guide through Hyperliquid API setup"""
    print("🔧 HYPERLIQUID API SETUP")
    print("=" * 40)
    print("\n📋 STEPS TO GET YOUR API KEYS:")
    print("1. Go to hyperliquid.xyz and login")
    print("2. Go to Account > API")
    print("3. Create new API key")
    print("4. Copy your private key")
    print("5. Get your wallet address\n")

    # Get user input
    private_key = getpass.getpass("🔑 Enter your Hyperliquid Private Key: ")
    address = input("📧 Enter your Hyperliquid Wallet Address: ")

    # Discord webhook (optional)
    discord_webhook = input("📱 Discord Webhook URL (optional, press Enter to skip): ")

    # Create config file
    config_content = f'''# Hyperliquid API Configuration
HYPERLIQUID_PRIVATE_KEY = "{private_key}"
HYPERLIQUID_ADDRESS = "{address}"
DISCORD_WEBHOOK_URL = "{discord_webhook}"

# Trading Parameters for $25 capital
TRADING_CONFIG = {{
    "capital": 25.0,           # Your starting capital
    "leverage": 10,            # Conservative leverage
    "max_position_value": 250, # $25 * 10 leverage
    "position_size_dollars": 5, # $5 per trade
    "symbol": "WIF",           # Trading symbol
    "stop_loss_pct": 0.05,     # 5% stop loss
    "take_profit_pct": 0.10,   # 10% take profit
    "max_daily_loss": 2.5,     # $2.5 max daily loss (10% of capital)
}}

# Risk Management
RISK_LIMITS = {{
    "max_positions": 1,        # Max open positions
    "max_daily_trades": 10,    # Max trades per day
    "emergency_stop": True,    # Enable emergency stop
}}
'''

    # Write config file
    with open('config_keys.py', 'w') as f:
        f.write(config_content)

    print("\n✅ Configuration saved to 'config_keys.py'")
    return private_key, address

def test_api_connection(private_key, address):
    """Test API connection"""
    print("\n🔍 Testing API connection...")

    try:
        # Test basic info endpoint
        response = requests.post('https://api.hyperliquid.xyz/info',
                               headers={'Content-Type': 'application/json'},
                               data=json.dumps({'type': 'meta'}))

        if response.status_code == 200:
            print("✅ Hyperliquid API reachable")

            # Test account info
            account_data = {"type": "clearinghouseState", "user": address}
            account_response = requests.post('https://api.hyperliquid.xyz/info',
                                           headers={'Content-Type': 'application/json'},
                                           data=json.dumps(account_data))

            if account_response.status_code == 200:
                account_info = account_response.json()
                print("✅ Account accessible")

                # Show some account info
                if 'marginSummary' in account_info:
                    margin = account_info['marginSummary']
                    total_value = float(margin.get('accountValue', 0))
                    print(f"💼 Account value: ${total_value:.2f}")

                    if total_value >= 25:
                        print("✅ Sufficient balance for $25 trading")
                    else:
                        print(f"⚠️  Low balance: ${total_value:.2f} (need at least $25)")

                return True
            else:
                print(f"❌ Account access failed: {account_response.status_code}")
                return False
        else:
            print(f"❌ API connection failed: {response.status_code}")
            return False

    except Exception as e:
        print(f"❌ Connection error: {e}")
        return False

def safety_checklist():
    """Safety checklist before live trading"""
    print("\n🛡️  SAFETY CHECKLIST")
    print("=" * 30)

    checks = [
        "✅ I have tested the bot in paper trading mode",
        "✅ I understand the risks of leveraged trading",
        "✅ I am starting with only $25 or less",
        "✅ I have set up proper stop losses",
        "✅ I will monitor the bot closely",
        "✅ I can afford to lose this $25",
        "✅ I have saved my API keys securely"
    ]

    for check in checks:
        print(f"  {check}")

    confirm = input("\n⚠️  Type 'I UNDERSTAND' to confirm you've read the safety checklist: ")
    return confirm == "I UNDERSTAND"

def main():
    print("🎯 REAL TRADING SETUP WIZARD")
    print("=" * 40)
    print("This will set up your $25 Hyperliquid trading bot")

    # Safety warning
    print("\n⚠️  IMPORTANT SAFETY WARNINGS:")
    print("• Start with MINIMUM amounts ($25 or less)")
    print("• Use CONSERVATIVE leverage (10x or less)")
    print("• Set proper STOP LOSSES")
    print("• Monitor the bot constantly")
    print("• Never trade money you can't afford to lose")

    proceed = input("\nDo you understand these risks and want to continue? (y/n): ")
    if proceed.lower() != 'y':
        print("❌ Setup cancelled")
        return

    # Setup configuration
    private_key, address = setup_hyperliquid_config()

    # Test connection
    if test_api_connection(private_key, address):
        print("\n✅ Setup successful!")

        # Safety checklist
        if safety_checklist():
            print("\n🚀 READY FOR LIVE TRADING!")
            print("Run: python3 live_micro_trader.py")
            print("Start with PAPER TRADING first to test!")
        else:
            print("\n❌ Setup cancelled - safety confirmation required")
    else:
        print("\n❌ Setup failed - check your API keys")

if __name__ == "__main__":
    main()