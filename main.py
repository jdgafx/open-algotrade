#!/usr/bin/env python3
"""
Main Entry Point for MoonDev Algo Trading System
High-performance cryptocurrency trading with multiple strategies
"""

import asyncio
import logging
import json
import argparse
from pathlib import Path
from decimal import Decimal
from typing import Optional

from src.engine.trading_engine import TradingEngine, TradingEngineConfig
from src.utils.hyperliquid_client import HyperliquidClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/trading_engine.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def load_config(config_path: str) -> TradingEngineConfig:
    """Load configuration from JSON file"""
    try:
        with open(config_path, 'r') as f:
            config_data = json.load(f)

        return TradingEngineConfig(
            hyperliquid_api_key=config_data.get('hyperliquid_api_key', ''),
            hyperliquid_secret_key=config_data.get('hyperliquid_secret_key', ''),
            sandbox_mode=config_data.get('sandbox_mode', True),
            max_portfolio_risk=Decimal(str(config_data.get('max_portfolio_risk', '10000'))),
            max_total_leverage=config_data.get('max_total_leverage', 10),
            daily_loss_limit=Decimal(str(config_data.get('daily_loss_limit', '2000'))),
            emergency_stop_enabled=config_data.get('emergency_stop_enabled', True),
            enable_market_making=config_data.get('enable_market_making', True),
            enable_turtle_trading=config_data.get('enable_turtle_trading', True),
            enable_correlation=config_data.get('enable_correlation', True),
            enable_mean_reversion=config_data.get('enable_mean_reversion', True),
            high_frequency_mode=config_data.get('high_frequency_mode', True),
            parallel_execution=config_data.get('parallel_execution', True),
            monitoring_enabled=config_data.get('monitoring_enabled', True),
            discord_webhook_url=config_data.get('discord_webhook_url'),
            email_alerts=config_data.get('email_alerts', False),
            alert_email_address=config_data.get('alert_email_address')
        )
    except Exception as e:
        logger.error(f"Error loading config: {e}")
        raise

async def run_trading_engine(config: TradingEngineConfig):
    """Run the trading engine"""
    try:
        logger.info("🚀 Starting MoonDev Algo Trading System")
        logger.info(f"📊 Configuration: {config}")

        async with TradingEngine(config) as engine:
            await engine.start()

    except KeyboardInterrupt:
        logger.info("🛑 Trading engine stopped by user")
    except Exception as e:
        logger.error(f"💥 Fatal error in trading engine: {e}")
    finally:
        logger.info("📊 Trading engine shutdown complete")

async def test_api_connection(api_key: str, secret_key: str, sandbox: bool = True):
    """Test API connection to Hyperliquid"""
    try:
        logger.info("🔍 Testing API connection...")

        client = HyperliquidClient(api_key, secret_key, sandbox)
        await client.connect()

        # Test basic API calls
        account_info = await client.get_account_info()
        positions = await client.get_positions()
        market_data = await client.get_market_data("ETH")

        logger.info("✅ API connection successful!")
        logger.info(f"   Account Value: ${account_info.get('account_value', 0):.2f}")
        logger.info(f"   Available Balance: ${account_info.get('available_balance', 0):.2f}")
        logger.info(f"   Active Positions: {len([p for p in positions if abs(p.size) > 0])}")
        logger.info(f"   ETH Price: ${market_data.last_price:.2f}")

        await client.disconnect()

        return True

    except Exception as e:
        logger.error(f"❌ API connection failed: {e}")
        return False

def setup_directories():
    """Create necessary directories"""
    directories = [
        'logs',
        'data/performance',
        'data/trades',
        'data/market_data',
        'backups'
    ]

    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        logger.info(f"📁 Created directory: {directory}")

async def run_backtest():
    """Run backtesting mode (placeholder)"""
    logger.info("📈 Running backtest mode...")
    logger.info("⚠️ Backtesting functionality not yet implemented")
    # TODO: Implement backtesting module

def print_banner():
    """Print application banner"""
    banner = """
    ╔══════════════════════════════════════════════════════════════╗
    ║                    MoonDev Algo Trading                     ║
    ║                 High-Performance Crypto Trading              ║
    ║                                                              ║
    ║  Strategies: Market Making, Turtle Trading, Correlation,    ║
    ║             Mean Reversion, Arbitrage                       ║
    ║                                                              ║
    ║  Features: Real-time Risk Management, Performance Monitoring ║
    ║           Discord Alerts, Emergency Stop System             ║
    ╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='MoonDev Algo Trading System')
    parser.add_argument('--config', '-c', type=str, default='config.json',
                       help='Configuration file path')
    parser.add_argument('--test-api', action='store_true',
                       help='Test API connection only')
    parser.add_argument('--backtest', action='store_true',
                       help='Run backtesting mode')
    parser.add_argument('--sandbox', action='store_true', default=True,
                       help='Use sandbox environment (default: True)')
    parser.add_argument('--live', action='store_true',
                       help='Use live environment (overrides --sandbox)')

    args = parser.parse_args()

    print_banner()

    # Setup directories
    setup_directories()

    # Handle live mode
    if args.live:
        args.sandbox = False
        logger.warning("⚠️ LIVE MODE ENABLED - REAL MONEY AT RISK!")

    # Test API connection
    if args.test_api:
        # Load config for API credentials
        try:
            config = load_config(args.config)
            success = asyncio.run(test_api_connection(
                config.hyperliquid_api_key,
                config.hyperliquid_secret_key,
                args.sandbox
            ))
            if not success:
                exit(1)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            exit(1)
        return

    # Run backtest
    if args.backtest:
        asyncio.run(run_backtest())
        return

    # Run trading engine
    try:
        config = load_config(args.config)
        # Override sandbox mode if specified via command line
        if not args.sandbox:
            config.sandbox_mode = False

        logger.info(f"🔧 Loading configuration from: {args.config}")
        logger.info(f"🌐 Environment: {'SANDBOX' if config.sandbox_mode else 'LIVE'}")

        asyncio.run(run_trading_engine(config))

    except FileNotFoundError:
        logger.error(f"❌ Configuration file not found: {args.config}")
        logger.info("💡 Create a config.json file with your API credentials")
        exit(1)
    except Exception as e:
        logger.error(f"❌ Failed to start trading engine: {e}")
        exit(1)

if __name__ == "__main__":
    main()