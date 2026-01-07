import pytest
import pandas as pd
import numpy as np
from decimal import Decimal
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime
import os
import tempfile
import asyncio

from src.testing.mock_client import MockHyperliquidClient
from src.engine.backtest_engine import BacktestEngine
from src.utils.data_loader import DataLoader
from src.engine.trading_engine import TradingEngineConfig
from src.utils.hyperliquid_client import Position

# -----------------------------------------------------------------------------
# Test MockHyperliquidClient
# -----------------------------------------------------------------------------


@pytest.fixture
def mock_client():
    return MockHyperliquidClient(sandbox=True)


@pytest.mark.asyncio
async def test_mock_client_connection(mock_client):
    """Test connect and disconnect methods."""
    await mock_client.connect()
    await mock_client.disconnect()


def test_update_market_state(mock_client):
    """Test updating market state affects current prices and history."""
    symbol = "ETH"
    candle = {
        "timestamp": 1600000000000,
        "open": 100,
        "high": 110,
        "low": 90,
        "close": 105,
        "volume": 1000,
    }

    mock_client.update_market_state(symbol, candle)

    assert mock_client.current_prices[symbol] == Decimal("105")
    assert mock_client.current_time == 1600000000000
    assert symbol in mock_client.price_history
    assert len(mock_client.price_history[symbol]) == 1

    history_item = mock_client.price_history[symbol][0]
    assert history_item[0] == 1600000000000
    assert history_item[4] == Decimal("105")


@pytest.mark.asyncio
async def test_get_ohlcv(mock_client):
    """Test retrieval of OHLCV data."""
    symbol = "BTC"
    mock_client.price_history[symbol] = []
    for i in range(5):
        candle = {
            "timestamp": 1000 + i,
            "open": 100 + i,
            "high": 110 + i,
            "low": 90 + i,
            "close": 105 + i,
            "volume": 1000,
        }
        mock_client.update_market_state(symbol, candle)

    ohlcv = await mock_client.get_ohlcv(symbol, "1h", limit=3)
    assert len(ohlcv) == 3
    assert ohlcv[-1][0] == 1004


@pytest.mark.asyncio
async def test_place_market_order_buy(mock_client):
    """Test placing a market buy order executes immediately."""
    symbol = "ETH"
    mock_client.current_prices[symbol] = Decimal("2000")
    mock_client.current_time = 123456789

    initial_cash = mock_client.cash
    size = Decimal("1.0")

    result = await mock_client.place_order(symbol, "buy", size, "market")

    assert result["status"] == "ok"
    assert result["response"]["statuses"][0]["status"] == "filled"

    positions = await mock_client.get_positions()
    assert len(positions) == 1
    pos = positions[0]
    assert pos.symbol == symbol
    assert pos.side == "long"
    assert pos.size == size
    assert pos.entry_price == Decimal("2000")

    expected_fee = (size * Decimal("2000")) * Decimal("0.00025")
    assert mock_client.cash == initial_cash - expected_fee


@pytest.mark.asyncio
async def test_place_market_order_sell_short(mock_client):
    """Test placing a market sell (short) order."""
    symbol = "ETH"
    mock_client.current_prices[symbol] = Decimal("2000")

    size = Decimal("0.5")
    await mock_client.place_order(symbol, "sell", size, "market")

    positions = await mock_client.get_positions()
    assert len(positions) == 1
    assert positions[0].side == "short"
    assert positions[0].size == size


@pytest.mark.asyncio
async def test_place_limit_order_open(mock_client):
    """Test placing a limit order that does NOT execute immediately."""
    symbol = "ETH"
    mock_client.current_prices[symbol] = Decimal("2000")

    result = await mock_client.place_order(
        symbol, "buy", Decimal("1"), "limit", price=Decimal("1900")
    )

    assert result["status"] == "ok"
    assert result["response"]["statuses"][0]["status"] == "open"
    assert len(mock_client.open_orders) == 1
    assert mock_client.open_orders[0]["price"] == Decimal("1900")
    assert len(mock_client.positions) == 0


@pytest.mark.asyncio
async def test_place_limit_order_immediate_fill(mock_client):
    """Test placing a limit order that fills immediately (marketable limit)."""
    symbol = "ETH"
    mock_client.current_prices[symbol] = Decimal("2000")

    result = await mock_client.place_order(
        symbol, "buy", Decimal("1"), "limit", price=Decimal("2100")
    )

    assert result["status"] == "ok"
    assert result["response"]["statuses"][0]["status"] == "filled"
    assert len(mock_client.open_orders) == 0
    assert len(mock_client.positions) == 1


@pytest.mark.asyncio
async def test_pnl_updates(mock_client):
    """Test PnL calculation when price changes."""
    symbol = "ETH"
    mock_client.current_prices[symbol] = Decimal("2000")
    await mock_client.place_order(symbol, "buy", Decimal("1"), "market")

    mock_client.update_market_state(
        symbol,
        {
            "timestamp": 123,
            "open": 2000,
            "high": 2100,
            "low": 2000,
            "close": 2100,
            "volume": 100,
        },
    )

    pos = mock_client.positions[symbol]
    assert pos.unrealized_pnl == Decimal("100")

    expected_fee = Decimal("0.5")
    expected_val = Decimal("100000") - expected_fee + Decimal("100")

    account_info = await mock_client.get_account_info()
    assert account_info["account_value"] == expected_val


@pytest.mark.asyncio
async def test_reduce_position(mock_client):
    """Test partially closing a position."""
    symbol = "ETH"
    mock_client.current_prices[symbol] = Decimal("2000")

    await mock_client.place_order(symbol, "buy", Decimal("2"), "market")

    mock_client.current_prices[symbol] = Decimal("2100")
    await mock_client.place_order(symbol, "sell", Decimal("1"), "market")

    pos = mock_client.positions[symbol]
    assert pos.size == Decimal("1")

    assert mock_client.cash > Decimal("100000")


# -----------------------------------------------------------------------------
# Test DataLoader
# -----------------------------------------------------------------------------


@pytest.fixture
def temp_data_dir():
    with tempfile.TemporaryDirectory() as tmpdirname:
        yield tmpdirname


def test_data_loader_load_csv_success(temp_data_dir):
    """Test loading a valid CSV file."""
    loader = DataLoader(data_dir=temp_data_dir)
    symbol = "TEST"

    csv_path = os.path.join(temp_data_dir, "TEST_1h.csv")
    df = pd.DataFrame(
        {
            "timestamp": [1000, 2000, 3000],
            "open": [100, 101, 102],
            "high": [110, 111, 112],
            "low": [90, 91, 92],
            "close": [105, 106, 107],
            "volume": [1000, 1100, 1200],
        }
    )
    df.to_csv(csv_path, index=False)

    loaded_df = loader.get_ticker_data(symbol, "1h")

    assert len(loaded_df) == 3
    assert list(loaded_df.columns) == [
        "timestamp",
        "open",
        "high",
        "low",
        "close",
        "volume",
    ]
    assert loaded_df.iloc[0]["timestamp"] == 1000


def test_data_loader_missing_file(temp_data_dir):
    """Test error when file does not exist."""
    loader = DataLoader(data_dir=temp_data_dir)
    with pytest.raises(FileNotFoundError):
        loader.get_ticker_data("NONEXISTENT")


def test_data_loader_missing_columns(temp_data_dir):
    """Test error when CSV lacks required columns."""
    loader = DataLoader(data_dir=temp_data_dir)
    csv_path = os.path.join(temp_data_dir, "BAD_1h.csv")
    df = pd.DataFrame({"timestamp": [1000], "price": [100]})
    df.to_csv(csv_path, index=False)

    with pytest.raises(ValueError) as excinfo:
        loader.load_csv(csv_path, "BAD")
    assert "must contain columns" in str(excinfo.value)


# -----------------------------------------------------------------------------
# Test BacktestEngine
# -----------------------------------------------------------------------------


@pytest.fixture
def mock_config():
    config = MagicMock(spec=TradingEngineConfig)
    config.enable_market_making = False
    config.enable_turtle_trading = False
    return config


@pytest.fixture
def backtest_engine(mock_config, temp_data_dir):
    loader = DataLoader(data_dir=temp_data_dir)
    return BacktestEngine(mock_config, loader)


@pytest.mark.asyncio
async def test_backtest_engine_setup(backtest_engine, mock_config):
    """Test engine setup with strategies enabled."""
    mock_config.enable_market_making = True
    mock_config.enable_turtle_trading = True

    await backtest_engine.setup()

    assert len(backtest_engine.strategies) == 2


@pytest.mark.asyncio
async def test_backtest_run_with_synthetic_data(backtest_engine):
    """Test running backtest when no CSV exists (uses synthetic data)."""
    mock_strategy = AsyncMock()
    backtest_engine.strategies = [mock_strategy]

    start = "2023-01-01"
    end = "2023-01-02"

    results = await backtest_engine.run("ETH", start, end)

    assert mock_strategy.iteration.called
    assert results is not None
    assert "final_value" in results
    assert "history" in results


@pytest.mark.asyncio
async def test_backtest_run_with_csv_data(backtest_engine, temp_data_dir):
    """Test running backtest with provided CSV data."""
    symbol = "ETH"
    csv_path = os.path.join(temp_data_dir, "ETH_1h.csv")

    data = {
        "timestamp": [1600000000000 + i * 3600000 for i in range(10)],
        "open": [100] * 10,
        "high": [105] * 10,
        "low": [95] * 10,
        "close": [100] * 10,
        "volume": [1000] * 10,
    }
    df = pd.DataFrame(data)
    df.to_csv(csv_path, index=False)

    await backtest_engine.setup()
    results = await backtest_engine.run(symbol, "2023-01-01", "2023-01-02")

    assert results is not None
    assert backtest_engine.mock_client.current_time == data["timestamp"][-1]


def test_generate_synthetic_data(backtest_engine):
    """Test the synthetic data generation method."""
    df = backtest_engine._generate_synthetic_data("2023-01-01", "2023-01-05")

    assert isinstance(df, pd.DataFrame)
    assert not df.empty
    expected_cols = ["timestamp", "open", "high", "low", "close", "volume"]
    assert all(col in df.columns for col in expected_cols)
    assert len(df) > 0
    assert df["close"].nunique() > 1
