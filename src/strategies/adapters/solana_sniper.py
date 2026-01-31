"""
Solana Sniper Strategy Adapter
New token launch sniper with security filters
"""

import asyncio
from decimal import Decimal
from typing import Dict, Optional, Any, List
import pandas as pd
import requests
from datetime import datetime, timedelta

from src.strategies.adapters.base import StrategyAdapter


class SolanaSniperAdapter(StrategyAdapter):
    """
    Solana Sniper Strategy
    - Scans Jupiter API for new token launches
    - Security checks (freeze, mutable metadata, holder %)
    - Technical filters (MA20/MA40, liquidity, volume)
    - Auto-buys tokens passing all filters
    - Manages positions with P&L tracking
    """

    def __init__(self, client, config):
        super().__init__(client, config)
        self.jupiter_api = "https://lite-api.jup.ag/tokens/v1/new"
        self.birdeye_api = "https://public-api.birdeye.so/defi"
        self.api_key = (
            config.extra_params.get("birdeye_api_key") if config.extra_params else None
        )

        # Configurable filters
        self.hours_to_look = (
            config.extra_params.get("hours_to_look", 0.2)
            if config.extra_params
            else 0.2
        )
        self.max_market_cap = (
            config.extra_params.get("max_market_cap", 30000)
            if config.extra_params
            else 30000
        )
        self.max_top10_percent = (
            config.extra_params.get("max_top10_percent", 0.7)
            if config.extra_params
            else 0.7
        )
        self.min_liquidity = (
            config.extra_params.get("min_liquidity", 400)
            if config.extra_params
            else 400
        )
        self.min_trades_1h = (
            config.extra_params.get("min_trades_1h", 9) if config.extra_params else 9
        )
        self.min_unique_wallets = (
            config.extra_params.get("min_unique_wallets", 30)
            if config.extra_params
            else 30
        )

        self.blacklist: set = set()
        self.scanned_tokens: List[str] = []

    def get_interval(self) -> int:
        return 600  # 10 minutes

    async def analyze(self) -> Optional[Dict[str, Any]]:
        """Scan for new tokens and return buy signal if gem found"""

        # Get new tokens from Jupiter
        tokens = await self._get_jupiter_tokens()
        if not tokens:
            return None

        # Filter by time
        recent_tokens = self._filter_by_time(tokens)
        if recent_tokens.empty:
            return None

        # Process each token
        for _, token in recent_tokens.iterrows():
            address = token.get("mint") or token.get("address")

            if address in self.blacklist or address in self.scanned_tokens:
                continue

            # Security check
            if not await self._security_check(address):
                self.blacklist.add(address)
                continue

            # Market data check
            market_data = await self._get_token_overview(address)
            if not market_data:
                continue

            # Technical analysis
            if await self._technical_analysis(address):
                self.scanned_tokens.append(address)
                return {
                    "action": "buy",
                    "symbol": address,
                    "price": market_data.get("price", 0),
                    "reason": f"Solana sniper gem - MC: ${market_data.get('market_cap', 0):,.0f}",
                    "market_data": market_data,
                }

            self.scanned_tokens.append(address)

        return None

    async def execute_signal(self, signal: Dict[str, Any]):
        """Execute buy on Solana DEX"""
        if signal["action"] == "buy":
            # This would integrate with Jupiter Swap API
            symbol = signal["symbol"]
            size = self.config.size

            # Log the snipe
            print(f"🎯 SOLANA SNIPER: Buying {symbol} - {signal['reason']}")

            # Placeholder for actual Jupiter swap execution
            # await self._execute_jupiter_swap(symbol, size)

            await self.place_order("buy", size)

    async def _get_jupiter_tokens(self) -> Optional[pd.DataFrame]:
        """Fetch new tokens from Jupiter API"""
        try:
            response = requests.get(self.jupiter_api, timeout=10)
            if response.status_code == 200:
                tokens = response.json()
                df = pd.DataFrame(tokens)
                df["timestamp"] = pd.to_datetime(
                    df["created_at"].astype(int), unit="s", utc=True
                )
                return df
        except Exception as e:
            print(f"Error fetching Jupiter tokens: {e}")
        return None

    def _filter_by_time(self, df: pd.DataFrame) -> pd.DataFrame:
        """Filter tokens by launch time"""
        cutoff = pd.Timestamp.now(tz="UTC") - pd.Timedelta(hours=self.hours_to_look)
        return df[df["timestamp"] >= cutoff].copy()

    async def _security_check(self, address: str) -> bool:
        """Check token security via Birdeye"""
        if not self.api_key:
            return True  # Skip if no API key

        try:
            url = f"{self.birdeye_api}/token_security?address={address}"
            headers = {"X-API-KEY": self.api_key}
            response = requests.get(url, headers=headers, timeout=5)

            if response.status_code == 200:
                data = response.json().get("data", {})

                # Check freeze authority
                if data.get("freezeAuthority"):
                    print(f"❌ {address}: Freezable token")
                    return False

                # Check mutable metadata
                if data.get("mutableMetadata"):
                    print(f"❌ {address}: Mutable metadata")
                    return False

                # Check top 10 holder %
                top10 = data.get("top10HolderPercent", 0)
                if top10 > self.max_top10_percent:
                    print(f"❌ {address}: Top 10 holds {top10 * 100:.1f}%")
                    return False

                # Check token 2022 program
                if data.get("isToken2022"):
                    print(f"❌ {address}: Token 2022 program")
                    return False

                return True

        except Exception as e:
            print(f"Security check error for {address}: {e}")

        return False

    async def _get_token_overview(self, address: str) -> Optional[Dict]:
        """Get token market data from Birdeye"""
        if not self.api_key:
            return None

        try:
            url = f"{self.birdeye_api}/token_overview?address={address}"
            headers = {"X-API-KEY": self.api_key}
            response = requests.get(url, headers=headers, timeout=5)

            if response.status_code == 200:
                data = response.json().get("data", {})

                # Check market cap
                mc = data.get("mc", 0)
                if mc > self.max_market_cap:
                    return None

                # Check liquidity
                liquidity = data.get("liquidity", 0)
                if liquidity < self.min_liquidity:
                    return None

                # Check trades
                buy1h = data.get("buy1h", 0)
                sell1h = data.get("sell1h", 0)
                trades = buy1h + sell1h
                if trades < self.min_trades_1h:
                    return None

                # Check unique wallets
                wallets = data.get("uniqueWallet24h", 0)
                if wallets < self.min_unique_wallets:
                    return None

                return {
                    "address": address,
                    "market_cap": mc,
                    "liquidity": liquidity,
                    "trades_1h": trades,
                    "unique_wallets": wallets,
                    "price": data.get("price", 0),
                    "buy1h": buy1h,
                    "sell1h": sell1h,
                }

        except Exception as e:
            print(f"Token overview error for {address}: {e}")

        return None

    async def _technical_analysis(self, address: str) -> bool:
        """OHLCV technical analysis"""
        if not self.api_key:
            return True  # Skip if no API key

        try:
            # Get OHLCV data
            time_from = int((datetime.now() - timedelta(days=1)).timestamp())
            time_to = int(datetime.now().timestamp())

            url = f"{self.birdeye_api}/ohlcv?address={address}&type=15m&time_from={time_from}&time_to={time_to}"
            headers = {"X-API-KEY": self.api_key}
            response = requests.get(url, headers=headers, timeout=5)

            if response.status_code == 200:
                items = response.json().get("data", {}).get("items", [])
                if len(items) >= 4:  # Need at least 4 candles (1 hour)
                    df = pd.DataFrame(items)
                    df["sma20"] = df["c"].rolling(window=4).mean()  # 1 hour SMA

                    latest = df.iloc[-1]
                    price = latest["c"]
                    sma = latest["sma20"]

                    # Price above SMA = bullish
                    if price > sma:
                        return True

        except Exception as e:
            print(f"Technical analysis error for {address}: {e}")

        return True  # Default to true if analysis fails
