#!/usr/bin/env python3
"""
Main Entry Point for KAIROS Algorithmic Trading System
Intelligence • Speed • Precision
"""

import asyncio
import logging
import json
import argparse
import sys
import os
from pathlib import Path
from decimal import Decimal
from typing import Optional
from datetime import datetime
from termcolor import colored

from src.engine.trading_engine import TradingEngine, TradingEngineConfig
from src.utils.hyperliquid_client import HyperliquidClient
from src.brain.memory_manager import MemoryManager


def setup_logging():
    """Configure logging for the application"""
    if not os.path.exists("logs"):
        os.makedirs("logs")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.FileHandler(
                f"logs/kairos_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
            ),
            logging.StreamHandler(sys.stdout),
        ],
    )


def print_banner():
    """Print the KAIROS banner"""
    banner = """
    ██   ██  █████  ██ ██████   ██████  ███████
    ██  ██  ██   ██ ██ ██   ██ ██    ██ ██     
    █████   ███████ ██ ██████  ██    ██ ███████
    ██  ██  ██   ██ ██ ██   ██ ██    ██      ██
    ██   ██ ██   ██ ██ ██   ██  ██████  ███████
    
    >>> KAIROS ALGORITHMIC TRADING SYSTEM <<<
    >>> INTELLIGENCE • SPEED • PRECISION <<<
    """
    print(colored(banner, "cyan"))
    print(colored("    v2.0.0 - Neural Integration Active", "green"))
    print(
        colored("    Warning: Trading involves significant financial risk.", "yellow")
    )
    print()


def load_config(config_path: str) -> dict:
    """Load raw configuration"""
    try:
        with open(config_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(colored(f"Error: Config file {config_path} not found.", "red"))
        sys.exit(1)


async def main():
    """Main execution loop"""
    parser = argparse.ArgumentParser(description="KAIROS Algo Trading System")
    parser.add_argument(
        "--config", "-c", default="config.json", help="Configuration file path"
    )
    parser.add_argument(
        "--test-api", action="store_true", help="Test API connection only"
    )
    parser.add_argument("--backtest", action="store_true", help="Run backtesting mode")
    parser.add_argument(
        "--sandbox", action="store_true", help="Use sandbox environment (default: True)"
    )
    parser.add_argument(
        "--live", action="store_true", help="Use live environment (overrides --sandbox)"
    )

    args = parser.parse_args()

    setup_logging()
    print_banner()
    logger = logging.getLogger(__name__)

    config_data = load_config(args.config)

    sandbox_mode = True
    if args.live:
        sandbox_mode = False
        logger.warning("🚨 LIVE TRADING MODE ACTIVATED - REAL FUNDS AT RISK 🚨")
    elif args.sandbox:
        sandbox_mode = True
        logger.info("🧪 Sandbox Mode Active")

    memory = MemoryManager()
    logger.info("🧠 KAIROS Neural Memory Initialized")

    if args.backtest:
        logger.info("📈 Running backtest mode...")
        from src.engine.backtest_engine import BacktestEngine

        # Backtesting logic here
        return

    try:
        client = HyperliquidClient(
            wallet_address=config_data.get("wallet_address", ""),
            private_key=config_data.get("private_key", ""),
            sandbox=sandbox_mode,
        )

        if args.test_api:
            await client.connect()
            account_info = await client.get_account_info()
            print(colored("\n✅ API Connection Successful!", "green"))
            print(f"Account Value: ${account_info['account_value']}")
            await client.disconnect()
            return

    except Exception as e:
        logger.error(f"Failed to initialize client: {e}")
        return

    engine_config = TradingEngineConfig(
        hyperliquid_api_key="",
        hyperliquid_secret_key="",
        sandbox_mode=sandbox_mode,
        max_portfolio_risk=Decimal(str(config_data.get("max_portfolio_risk", "1000"))),
        max_total_leverage=config_data.get("max_total_leverage", 10),
        daily_loss_limit=Decimal(str(config_data.get("daily_loss_limit", "100"))),
        emergency_stop_enabled=True,
        enable_market_making=config_data.get("enable_market_making", False),
        enable_turtle_trading=config_data.get("enable_turtle_trading", False),
        enable_correlation=config_data.get("enable_correlation", False),
        enable_mean_reversion=config_data.get("enable_mean_reversion", False),
        high_frequency_mode=config_data.get("high_frequency_mode", False),
        parallel_execution=True,
    )

    engine = TradingEngine(client, engine_config)

    try:
        await engine.start()
    except KeyboardInterrupt:
        logger.info("🛑 KAIROS Shutting Down...")
        await engine.stop()


if __name__ == "__main__":
    asyncio.run(main())
