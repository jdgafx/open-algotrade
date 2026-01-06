"""
Integration Tests for Exchange APIs and Data Feeds

This module tests the integration with various cryptocurrency exchanges
including rate limiting, error handling, data consistency, and real-time feeds.
"""

import unittest
import asyncio
import aiohttp
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
import warnings
warnings.filterwarnings('ignore')

# Exchange connectors (these would be actual implementations)
from src.connectors.binance_connector import BinanceConnector
from src.connectors.phemex_connector import PhemexConnector
from src.connectors.hyperliquid_connector import HyperliquidConnector
from src.data_feeds.realtime_feed import RealtimeFeed
from src.data_feeds.historical_feed import HistoricalFeed

class TestBinanceConnector(unittest.TestCase):
    """Integration tests for Binance API connector"""

    def setUp(self):
        """Set up test fixtures"""
        self.connector = BinanceConnector(testnet=True)
        self.symbol = "BTCUSDT"
        self.timeframe = "1h"

    def test_api_authentication(self):
        """Test API key authentication"""
        # Test with valid credentials (mock)
        with patch.object(self.connector, 'session') as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_session.get.return_value.__aenter__.return_value = mock_response

            async def test_auth():
                return await self.connector.test_connection()

            result = asyncio.run(test_auth())
            self.assertTrue(result)

    def test_get_market_data(self):
        """Test fetching market data"""
        with patch.object(self.connector, 'session') as mock_session:
            # Mock OHLCV response
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json.return_value = [
                [1640995200000, "47000.00", "47500.00", "46800.00", "47200.00", "1000.0"],
                [1640998800000, "47200.00", "47800.00", "47000.00", "47600.00", "1200.0"]
            ]
            mock_session.get.return_value.__aenter__.return_value = mock_response

            async def test_market_data():
                data = await self.connector.get_ohlcv(self.symbol, self.timeframe, limit=2)
                return data

            result = asyncio.run(test_market_data())

            self.assertIsInstance(result, pd.DataFrame)
            self.assertEqual(len(result), 2)
            expected_columns = ['timestamp', 'open', 'high', 'low', 'close', 'volume']
            self.assertTrue(all(col in result.columns for col in expected_columns))

    def test_get_order_book(self):
        """Test fetching order book"""
        with patch.object(self.connector, 'session') as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json.return_value = {
                "lastUpdateId": 123456,
                "bids": [
                    ["47000.00", "1.5"],
                    ["46999.00", "2.0"]
                ],
                "asks": [
                    ["47001.00", "1.2"],
                    ["47002.00", "1.8"]
                ]
            }
            mock_session.get.return_value.__aenter__.return_value = mock_response

            async def test_order_book():
                order_book = await self.connector.get_order_book(self.symbol, limit=2)
                return order_book

            result = asyncio.run(test_order_book())

            self.assertIn('bids', result)
            self.assertIn('asks', result)
            self.assertEqual(len(result['bids']), 2)
            self.assertEqual(len(result['asks']), 2)

    def test_place_order(self):
        """Test order placement"""
        with patch.object(self.connector, 'session') as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json.return_value = {
                "symbol": "BTCUSDT",
                "orderId": 123456,
                "clientOrderId": "test_order_123",
                "status": "NEW"
            }
            mock_session.post.return_value.__aenter__.return_value = mock_response

            async def test_place_order():
                order = await self.connector.place_order(
                    symbol=self.symbol,
                    side="BUY",
                    type="LIMIT",
                    quantity=0.001,
                    price=47000
                )
                return order

            result = asyncio.run(test_place_order())

            self.assertEqual(result['symbol'], self.symbol)
            self.assertEqual(result['side'], "BUY")
            self.assertEqual(result['status'], "NEW")

    def test_cancel_order(self):
        """Test order cancellation"""
        with patch.object(self.connector, 'session') as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json.return_value = {
                "symbol": "BTCUSDT",
                "orderId": 123456,
                "clientOrderId": "test_order_123",
                "status": "CANCELED"
            }
            mock_session.delete.return_value.__aenter__.return_value = mock_response

            async def test_cancel_order():
                result = await self.connector.cancel_order(self.symbol, 123456)
                return result

            result = asyncio.run(test_cancel_order())

            self.assertEqual(result['status'], "CANCELED")

    def test_get_account_info(self):
        """Test fetching account information"""
        with patch.object(self.connector, 'session') as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json.return_value = {
                "makerCommission": 15,
                "takerCommission": 15,
                "buyerCommission": 0,
                "sellerCommission": 0,
                "canTrade": True,
                "canWithdraw": True,
                "canDeposit": True,
                "updateTime": 123456789,
                "accountType": "SPOT",
                "balances": [
                    {"asset": "BTC", "free": "1.234567", "locked": "0.000000"},
                    {"asset": "USDT", "free": "12345.67890", "locked": "1000.000000"}
                ]
            }
            mock_session.get.return_value.__aenter__.return_value = mock_response

            async def test_account_info():
                account_info = await self.connector.get_account_info()
                return account_info

            result = asyncio.run(test_account_info())

            self.assertIn('balances', result)
            self.assertTrue(result['canTrade'])
            self.assertEqual(len(result['balances']), 2)

    def test_rate_limiting(self):
        """Test rate limiting functionality"""
        call_count = 0

        async def mock_request(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.1)  # Simulate network delay
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json.return_value = {"success": True}
            return mock_response

        with patch.object(self.connector, 'session') as mock_session:
            mock_session.get.return_value.__aenter__.side_effect = mock_request

            async def test_rate_limit():
                tasks = []
                # Make multiple concurrent requests
                for _ in range(10):
                    task = self.connector.get_ticker_24hr(self.symbol)
                    tasks.append(task)

                results = await asyncio.gather(*tasks, return_exceptions=True)
                return results, call_count

            results, final_call_count = asyncio.run(test_rate_limit())

            # Should handle rate limiting gracefully
            successful_results = [r for r in results if not isinstance(r, Exception)]
            self.assertGreater(len(successful_results), 0)

    def test_error_handling(self):
        """Test error handling for various scenarios"""
        error_scenarios = [
            (401, "Invalid API key"),
            (429, "Rate limit exceeded"),
            (500, "Internal server error"),
            (503, "Service unavailable")
        ]

        for status_code, error_msg in error_scenarios:
            with self.subTest(status_code=status_code):
                with patch.object(self.connector, 'session') as mock_session:
                    mock_response = AsyncMock()
                    mock_response.status = status_code
                    mock_response.json.return_value = {"msg": error_msg}
                    mock_session.get.return_value.__aenter__.return_value = mock_response

                    async def test_error():
                        try:
                            await self.connector.get_ticker_24hr(self.symbol)
                            return False  # Should have raised exception
                        except Exception as e:
                            return True

                    result = asyncio.run(test_error())
                    self.assertTrue(result)

class TestPhemexConnector(unittest.TestCase):
    """Integration tests for Phemex API connector"""

    def setUp(self):
        """Set up test fixtures"""
        self.connector = PhemexConnector(testnet=True)
        self.symbol = "BTCUSD"

    def test_get_positions(self):
        """Test fetching open positions"""
        with patch.object(self.connector, 'session') as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json.return_value = {
                "code": 0,
                "msg": "OK",
                "data": {
                    "positions": [
                        {
                            "symbol": "BTCUSD",
                            "side": "Buy",
                            "size": 100,
                            "avgEntryPrice": 47000,
                            "markPrice": 47200,
                            "unrealisedPnl": 200
                        }
                    ]
                }
            }
            mock_session.get.return_value.__aenter__.return_value = mock_response

            async def test_positions():
                positions = await self.connector.get_positions()
                return positions

            result = asyncio.run(test_positions())

            self.assertIsInstance(result, list)
            if result:  # If there are positions
                self.assertIn('symbol', result[0])
                self.assertIn('side', result[0])
                self.assertIn('size', result[0])

    def test_get_balance(self):
        """Test fetching account balance"""
        with patch.object(self.connector, 'session') as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json.return_value = {
                "code": 0,
                "msg": "OK",
                "data": {
                    "accounts": [
                        {
                            "accountBalanceRate": 1.0,
                            "totalEquityValue": 10000.0,
                            "totalPositionValue": 5000.0,
                            "totalUsedBalance": 5000.0,
                            "totalAvailableBalance": 5000.0
                        }
                    ]
                }
            }
            mock_session.get.return_value.__aenter__.return_value = mock_response

            async def test_balance():
                balance = await self.connector.get_balance()
                return balance

            result = asyncio.run(test_balance())

            self.assertIn('totalEquityValue', result)
            self.assertIn('totalAvailableBalance', result)

class TestHyperliquidConnector(unittest.TestCase):
    """Integration tests for Hyperliquid API connector"""

    def setUp(self):
        """Set up test fixtures"""
        self.connector = HyperliquidConnector(testnet=True)

    def test_get_meta_and_state(self):
        """Test fetching market metadata and state"""
        with patch.object(self.connector, 'session') as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json.return_value = {
                "universe": [
                    {"name": "BTC", "szDecimals": 3}
                ],
                "response": {
                    "type": "meta",
                    "universe": [
                        {"name": "BTC", "szDecimals": 3}
                    ]
                }
            }
            mock_session.post.return_value.__aenter__.return_value = mock_response

            async def test_meta():
                meta = await self.connector.get_meta()
                return meta

            result = asyncio.run(test_meta())

            self.assertIn('universe', result)

class TestRealtimeFeed(unittest.TestCase):
    """Integration tests for real-time data feeds"""

    def setUp(self):
        """Set up test fixtures"""
        self.feed = RealtimeFeed()
        self.symbol = "BTCUSDT"

    def test_websocket_connection(self):
        """Test WebSocket connection and data reception"""
        with patch('websockets.connect') as mock_connect:
            mock_ws = AsyncMock()
            mock_connect.return_value.__aenter__.return_value = mock_ws

            # Mock WebSocket messages
            mock_ws.recv.side_effect = [
                '{"stream":"btcusdt@ticker","data":{"c":"47000.0","v":"1000.0"}}',
                '{"stream":"btcusdt@depth","data":{"b":[["46999.0","1.5"]],"a":[["47001.0","1.2"]]}}'
            ]

            async def test_websocket():
                messages = []
                async for message in self.feed.subscribe_ticker(self.symbol):
                    messages.append(message)
                    if len(messages) >= 2:
                        break
                return messages

            result = asyncio.run(test_websocket())

            self.assertEqual(len(result), 2)
            self.assertIn('stream', result[0])
            self.assertIn('data', result[0])

    def test_data_validation(self):
        """Test real-time data validation"""
        # Valid ticker data
        valid_ticker = {
            'stream': 'btcusdt@ticker',
            'data': {
                'c': '47000.0',  # Current price
                'v': '1000.0',   # Volume
                'h': '47500.0',  # High price
                'l': '46500.0',  # Low price
                'o': '46800.0'   # Open price
            }
        }

        self.assertTrue(self.feed.validate_ticker_data(valid_ticker))

        # Invalid data (missing fields)
        invalid_ticker = {
            'stream': 'btcusdt@ticker',
            'data': {
                'c': '47000.0'
                # Missing other required fields
            }
        }

        self.assertFalse(self.feed.validate_ticker_data(invalid_ticker))

    def test_reconnection_logic(self):
        """Test automatic reconnection on connection loss"""
        with patch('websockets.connect') as mock_connect:
            mock_ws = AsyncMock()
            mock_connect.return_value.__aenter__.return_value = mock_ws

            # Simulate connection failure and recovery
            connection_attempts = 0

            async def mock_connection(*args, **kwargs):
                nonlocal connection_attempts
                connection_attempts += 1
                if connection_attempts == 1:
                    raise ConnectionError("Connection failed")
                return mock_ws

            mock_connect.side_effect = mock_connection

            async def test_reconnection():
                try:
                    async for message in self.feed.subscribe_ticker(self.symbol):
                        break
                    return True
                except Exception:
                    return False

            # Should handle reconnection
            result = asyncio.run(test_reconnection())
            self.assertGreaterEqual(connection_attempts, 1)

class TestHistoricalFeed(unittest.TestCase):
    """Integration tests for historical data feeds"""

    def setUp(self):
        """Set up test fixtures"""
        self.feed = HistoricalFeed()
        self.symbol = "BTCUSDT"

    def test_historical_data_download(self):
        """Test downloading historical data"""
        with patch.object(self.feed, 'session') as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200

            # Mock CSV data
            csv_data = """timestamp,open,high,low,close,volume
2023-01-01 00:00:00,47000.0,47500.0,46800.0,47200.0,1000.0
2023-01-01 01:00:00,47200.0,47800.0,47000.0,47600.0,1200.0"""

            mock_response.text.return_value = csv_data
            mock_session.get.return_value.__aenter__.return_value = mock_response

            async def test_download():
                data = await self.feed.download_historical_data(
                    self.symbol,
                    start_date=datetime(2023, 1, 1),
                    end_date=datetime(2023, 1, 2),
                    interval='1h'
                )
                return data

            result = asyncio.run(test_download())

            self.assertIsInstance(result, pd.DataFrame)
            self.assertEqual(len(result), 2)
            expected_columns = ['timestamp', 'open', 'high', 'low', 'close', 'volume']
            self.assertTrue(all(col in result.columns for col in expected_columns))

    def test_data_quality_check(self):
        """Test historical data quality validation"""
        # Create test data with quality issues
        bad_data = pd.DataFrame({
            'timestamp': [datetime(2023, 1, 1), datetime(2023, 1, 2), datetime(2023, 1, 3)],
            'open': [47000, 0, 46000],  # Zero price (data quality issue)
            'high': [47500, 47550, 46500],
            'low': [46800, 46550, 45500],
            'close': [47200, 47000, 45800],
            'volume': [1000, -100, 900]  # Negative volume (data quality issue)
        })

        quality_issues = self.feed.check_data_quality(bad_data)

        self.assertGreater(len(quality_issues), 0)
        self.assertTrue(any('zero' in issue.lower() for issue in quality_issues))
        self.assertTrue(any('negative' in issue.lower() for issue in quality_issues))

    def test_data_gap_detection(self):
        """Test detection of gaps in historical data"""
        # Create data with gaps
        dates = pd.date_range(start='2023-01-01', periods=10, freq='1h')
        # Remove some dates to create gaps
        dates = dates.drop([2, 5, 8])  # Remove hour 3, 6, 9

        data_with_gaps = pd.DataFrame({
            'timestamp': dates,
            'close': range(len(dates))
        })

        gaps = self.feed.detect_data_gaps(data_with_gaps, expected_interval='1h')

        self.assertGreater(len(gaps), 0)

    def test_data_compression(self):
        """Test data compression (e.g., 1m to 1h)"""
        # Create minute data
        minute_dates = pd.date_range(start='2023-01-01', periods=60, freq='1min')
        minute_data = pd.DataFrame({
            'timestamp': minute_dates,
            'open': 47000 + np.random.uniform(-100, 100, 60),
            'high': 47100 + np.random.uniform(0, 100, 60),
            'low': 46900 + np.random.uniform(-100, 0, 60),
            'close': 47000 + np.random.uniform(-100, 100, 60),
            'volume': np.random.uniform(10, 100, 60)
        })

        hourly_data = self.feed.compress_data(minute_data, target_interval='1h')

        # Should compress 60 minutes to approximately 1 hour
        self.assertLess(len(hourly_data), len(minute_data))
        self.assertGreater(len(hourly_data), 0)

        # Compressed data should have proper OHLC aggregation
        for i in range(len(hourly_data)):
            self.assertGreaterEqual(hourly_data.iloc[i]['high'], hourly_data.iloc[i]['low'])
            self.assertGreaterEqual(hourly_data.iloc[i]['high'], hourly_data.iloc[i]['close'])
            self.assertGreaterEqual(hourly_data.iloc[i]['high'], hourly_data.iloc[i]['open'])
            self.assertLessEqual(hourly_data.iloc[i]['low'], hourly_data.iloc[i]['close'])
            self.assertLessEqual(hourly_data.iloc[i]['low'], hourly_data.iloc[i]['open'])

class TestConnectorIntegration(unittest.TestCase):
    """Integration tests for multiple connectors working together"""

    def setUp(self):
        """Set up integration test fixtures"""
        self.connectors = {
            'binance': BinanceConnector(testnet=True),
            'phemex': PhemexConnector(testnet=True)
        }

    def test_cross_exchange_arbitrage_detection(self):
        """Test arbitrage opportunity detection across exchanges"""
        # Mock prices for different exchanges
        exchange_prices = {
            'binance': {'BTCUSDT': 47000.0},
            'phemex': {'BTCUSD': 47150.0}  # Higher price for arbitrage
        }

        with patch('src.connectors.binance_connector.BinanceConnector.get_ticker_24hr') as mock_binance, \
             patch('src.connectors.phemex_connector.PhemexConnector.get_ticker_24hr') as mock_phemex:

            mock_binance.return_value = {'symbol': 'BTCUSDT', 'lastPrice': '47000.0'}
            mock_phemex.return_value = {'symbol': 'BTCUSD', 'lastPrice': '47150.0'}

            async def test_arbitrage():
                opportunities = []
                for exchange_name, connector in self.connectors.items():
                    ticker = await connector.get_ticker_24hr('BTC' + ('USDT' if exchange_name == 'binance' else 'USD'))
                    opportunities.append((exchange_name, float(ticker['lastPrice'])))

                # Check for arbitrage
                if len(opportunities) == 2:
                    price_diff = abs(opportunities[0][1] - opportunities[1][1])
                    arbitrage_pct = price_diff / min(opportunities[0][1], opportunities[1][1])
                    return arbitrage_pct > 0.001  # 0.1% threshold

                return False

            result = asyncio.run(test_arbitrage())
            self.assertIsInstance(result, bool)

    def test_concurrent_data_fetching(self):
        """Test fetching data from multiple exchanges concurrently"""
        async def test_concurrent():
            tasks = []
            for connector in self.connectors.values():
                task = connector.get_server_time()
                tasks.append(task)

            results = await asyncio.gather(*tasks, return_exceptions=True)
            return results

        # Mock server time responses
        with patch('src.connectors.binance_connector.BinanceConnector.get_server_time') as mock_binance_time, \
             patch('src.connectors.phemex_connector.PhemexConnector.get_server_time') as mock_phemex_time:

            mock_binance_time.return_value = {'serverTime': 1234567890000}
            mock_phemex_time.return_value = {'timestamp': 1234567890}

            results = asyncio.run(test_concurrent())

            self.assertEqual(len(results), 2)
            # Should not have exceptions
            successful_results = [r for r in results if not isinstance(r, Exception)]
            self.assertEqual(len(successful_results), 2)

    def test_data_consistency_validation(self):
        """Test data consistency across exchanges"""
        # Create similar price data from different exchanges
        binance_data = pd.DataFrame({
            'timestamp': [datetime(2023, 1, 1)],
            'price': [47000.0],
            'volume': [1000.0]
        })

        phemex_data = pd.DataFrame({
            'timestamp': [datetime(2023, 1, 1)],
            'price': [47100.0],  # Slightly different price
            'volume': [900.0]     # Different volume
        })

        # Convert to common format for comparison
        normalized_data = {
            'binance': self._normalize_exchange_data(binance_data, 'binance'),
            'phemex': self._normalize_exchange_data(phemex_data, 'phemex')
        }

        # Check price consistency (within reasonable range)
        price_diff = abs(normalized_data['binance']['price'] - normalized_data['phemex']['price'])
        price_diff_pct = price_diff / normalized_data['binance']['price']

        # Prices should be within 1% of each other
        self.assertLess(price_diff_pct, 0.01)

    def _normalize_exchange_data(self, data, exchange_name):
        """Normalize data format for cross-exchange comparison"""
        if exchange_name == 'binance':
            return {
                'timestamp': data['timestamp'].iloc[0],
                'price': data['price'].iloc[0],
                'volume': data['volume'].iloc[0]
            }
        elif exchange_name == 'phemex':
            # Phemex might have different field names
            return {
                'timestamp': data['timestamp'].iloc[0],
                'price': data['price'].iloc[0],
                'volume': data['volume'].iloc[0]
            }

if __name__ == '__main__':
    # Run all integration tests
    unittest.main(verbosity=2)