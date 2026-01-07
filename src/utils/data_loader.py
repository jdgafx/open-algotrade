"""
Data Loader for Backtesting
Handles loading of OHLCV data from various sources (CSV, API, etc.)
"""

import pandas as pd
from typing import Optional, Dict, List, Tuple
from pathlib import Path
from decimal import Decimal


class DataLoader:
    def __init__(self, data_dir: str = "data/market_data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def load_csv(self, filepath: str, symbol: str) -> pd.DataFrame:
        """
        Load OHLCV data from CSV file.
        Expected columns: timestamp, open, high, low, close, volume
        """
        df = pd.read_csv(filepath)

        # Standardize columns
        df.columns = [col.lower() for col in df.columns]

        required_cols = ["timestamp", "open", "high", "low", "close", "volume"]
        if not all(col in df.columns for col in required_cols):
            raise ValueError(f"CSV must contain columns: {required_cols}")

        # Ensure timestamp is sorted
        df = df.sort_values("timestamp")

        return df

    def get_ticker_data(
        self, symbol: str, timeframe: str = "1h", days: int = 30
    ) -> pd.DataFrame:
        """
        Get data for a specific ticker.
        Currently supports local CSVs matching pattern {symbol}_{timeframe}.csv
        """
        filename = f"{symbol}_{timeframe}.csv"
        filepath = self.data_dir / filename

        if filepath.exists():
            return self.load_csv(str(filepath), symbol)

        raise FileNotFoundError(f"No data found for {symbol} {timeframe} at {filepath}")

    @staticmethod
    def dataframe_to_iterator(df: pd.DataFrame):
        """Convert DataFrame to iterator of dicts for backtesting"""
        return df.to_dict("records")
