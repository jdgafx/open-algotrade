"""
Machine Learning Trading Optimizer
Advanced ML models for signal prediction, position sizing, and market regime detection
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
import warnings
warnings.filterwarnings('ignore')

# ML imports
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split, TimeSeriesSplit
from sklearn.metrics import accuracy_score, precision_score, recall_score, mean_squared_error
import xgboost as xgb
import lightgbm as lgb

# Deep learning imports (optional)
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

import joblib
import logging
from dataclasses import dataclass
from enum import Enum
import asyncio
from datetime import datetime, timedelta

@dataclass
class PredictionResult:
    symbol: str
    prediction: float
    confidence: float
    prediction_type: str  # 'direction', 'volatility', 'regime'
    timestamp: float
    features_used: List[str]

@dataclass
class MLModelConfig:
    model_type: str
    features: List[str]
    target_column: str
    lookback_period: int
    prediction_horizon: int
    retrain_frequency: int  # hours

class MarketRegime(Enum):
    TRENDING_UP = "trending_up"
    TRENDING_DOWN = "trending_down"
    RANGING = "ranging"
    VOLATILE = "volatile"
    QUIET = "quiet"

class NeuralPricePredictor(nn.Module):
    """Neural network for price prediction using PyTorch"""

    def __init__(self, input_size: int, hidden_sizes: List[int], output_size: int = 1):
        super(NeuralPricePredictor, self).__init__()

        layers = []
        prev_size = input_size

        for hidden_size in hidden_sizes:
            layers.extend([
                nn.Linear(prev_size, hidden_size),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.BatchNorm1d(hidden_size)
            ])
            prev_size = hidden_size

        layers.append(nn.Linear(prev_size, output_size))

        self.network = nn.Sequential(*layers)

    def forward(self, x):
        return self.network(x)

class TradingMLOptimizer:
    """
    Comprehensive ML system for trading optimization with multiple model types
    """

    def __init__(self, config: Dict):
        self.config = config
        self.models = {}
        self.scalers = {}
        self.feature_cache = {}
        self.prediction_cache = {}
        self.performance_metrics = {}

        # ML configuration
        self.models_dir = config.get('models_dir', './models')
        self.data_dir = config.get('data_dir', './data')
        self.retrain_threshold = config.get('retrain_threshold', 0.7)  # accuracy threshold

        # Setup logging
        self.logger = logging.getLogger(__name__)

        # Initialize model configurations
        self.model_configs = self._initialize_model_configs()

    def _initialize_model_configs(self) -> Dict[str, MLModelConfig]:
        """Initialize configurations for different ML models"""
        configs = {
            'direction_predictor': MLModelConfig(
                model_type='xgboost',
                features=['price_change', 'volume_change', 'volatility', 'rsi', 'macd',
                         'bb_position', 'atr_ratio', 'volume_ratio'],
                target_column='future_direction',
                lookback_period=50,
                prediction_horizon=5,  # 5 periods ahead
                retrain_frequency=24
            ),
            'volatility_predictor': MLModelConfig(
                model_type='gradient_boost',
                features=['volatility', 'volume_change', 'price_range', 'high_low_ratio',
                         'volume_volatility', 'price_acceleration'],
                target_column='future_volatility',
                lookback_period=30,
                prediction_horizon=10,
                retrain_frequency=48
            ),
            'regime_classifier': MLModelConfig(
                model_type='random_forest',
                features=['trend_strength', 'volatility_ratio', 'volume_trend',
                         'price_momentum', 'range_width', 'breakout_strength'],
                target_column='market_regime',
                lookback_period=100,
                prediction_horizon=1,
                retrain_frequency=168  # weekly
            )
        }

        # Add neural network config if PyTorch is available
        if TORCH_AVAILABLE:
            configs['neural_predictor'] = MLModelConfig(
                model_type='neural_network',
                features=['price_change', 'volume_change', 'volatility', 'rsi', 'macd',
                         'bb_position', 'atr_ratio', 'volume_ratio', 'momentum', 'acceleration'],
                target_column='future_return',
                lookback_period=60,
                prediction_horizon=3,
                retrain_frequency=12
            )

        return configs

    def prepare_features(self, df: pd.DataFrame, symbol: str) -> pd.DataFrame:
        """
        Prepare comprehensive technical analysis features for ML models
        """
        try:
            # Basic price features
            df['price_change'] = df['close'].pct_change()
            df['log_return'] = np.log(df['close'] / df['close'].shift(1))
            df['high_low_ratio'] = df['high'] / df['low']
            df['close_open_ratio'] = df['close'] / df['open']

            # Volume features
            if 'volume' in df.columns:
                df['volume_change'] = df['volume'].pct_change()
                df['volume_ratio'] = df['volume'] / df['volume'].rolling(20).mean()
                df['volume_volatility'] = df['volume_change'].rolling(10).std()
                df['volume_price_trend'] = (df['volume'] * df['price_change']).rolling(10).mean()

            # Volatility features
            df['volatility'] = df['price_change'].rolling(20).std()
            df['atr'] = self._calculate_atr(df)
            df['atr_ratio'] = df['atr'] / df['close']

            # Technical indicators
            df = self._add_technical_indicators(df)

            # Momentum and acceleration
            df['momentum'] = df['price_change'].rolling(10).mean()
            df['acceleration'] = df['price_change'] - df['price_change'].shift(1)
            df['price_acceleration'] = df['momentum'] - df['momentum'].shift(5)

            # Trend features
            df['trend_strength'] = abs(df['close'].rolling(50).apply(lambda x: np.polyfit(range(len(x)), x, 1)[0]))
            df['price_momentum'] = (df['close'] / df['close'].shift(10)) - 1

            # Range features
            df['range_width'] = (df['high'] - df['low']) / df['close']
            df['breakout_strength'] = (df['close'] - df['close'].shift(20)) / df['close'].shift(20)

            # Market regime features
            df['volatility_ratio'] = df['volatility'] / df['volatility'].rolling(100).mean()
            df['volume_trend'] = df['volume'].rolling(20).apply(lambda x: np.polyfit(range(len(x)), x, 1)[0]) if 'volume' in df.columns else 0

            # Future targets for supervised learning
            df['future_direction'] = np.where(df['close'].shift(-5) > df['close'], 1, 0)
            df['future_return'] = df['close'].shift(-5) / df['close'] - 1
            df['future_volatility'] = df['price_change'].shift(-10).rolling(10).std()

            # Market regime classification
            df['market_regime'] = self._classify_market_regime(df)

            # Cache features for the symbol
            self.feature_cache[symbol] = df

            return df

        except Exception as e:
            self.logger.error(f"Error preparing features for {symbol}: {e}")
            return df

    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate Average True Range"""
        high = df['high']
        low = df['low']
        close = df['close']

        tr1 = high - low
        tr2 = abs(high - close.shift())
        tr3 = abs(low - close.shift())

        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.rolling(period).mean()

        return atr

    def _add_technical_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add technical indicators to the dataframe"""
        try:
            # RSI
            delta = df['close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df['rsi'] = 100 - (100 / (1 + rs))

            # MACD
            exp1 = df['close'].ewm(span=12).mean()
            exp2 = df['close'].ewm(span=26).mean()
            df['macd'] = exp1 - exp2
            df['macd_signal'] = df['macd'].ewm(span=9).mean()
            df['macd_histogram'] = df['macd'] - df['macd_signal']

            # Bollinger Bands
            df['bb_middle'] = df['close'].rolling(20).mean()
            bb_std = df['close'].rolling(20).std()
            df['bb_upper'] = df['bb_middle'] + (bb_std * 2)
            df['bb_lower'] = df['bb_middle'] - (bb_std * 2)
            df['bb_position'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])

            # Moving averages
            df['sma_20'] = df['close'].rolling(20).mean()
            df['sma_50'] = df['close'].rolling(50).mean()
            df['ema_12'] = df['close'].ewm(span=12).mean()
            df['ema_26'] = df['close'].ewm(span=26).mean()

            # Stochastic Oscillator
            low_min = df['low'].rolling(14).min()
            high_max = df['high'].rolling(14).max()
            df['stoch_k'] = 100 * (df['close'] - low_min) / (high_max - low_min)
            df['stoch_d'] = df['stoch_k'].rolling(3).mean()

            # Williams %R
            df['williams_r'] = -100 * (high_max - df['close']) / (high_max - low_min)

        except Exception as e:
            self.logger.error(f"Error adding technical indicators: {e}")

        return df

    def _classify_market_regime(self, df: pd.DataFrame) -> pd.Series:
        """Classify market regime based on price action and volatility"""
        try:
            regimes = []

            for i in range(len(df)):
                if i < 50:  # Not enough data
                    regimes.append(MarketRegime.QUIET.value)
                    continue

                # Calculate trend
                recent_prices = df['close'].iloc[i-20:i]
                trend_slope = np.polyfit(range(len(recent_prices)), recent_prices, 1)[0]

                # Calculate volatility
                recent_volatility = df['volatility'].iloc[i-10:i].mean()
                long_volatility = df['volatility'].iloc[i-50:i].mean()

                # Determine regime
                if abs(trend_slope) > 0.1:  # Strong trend
                    if trend_slope > 0:
                        regimes.append(MarketRegime.TRENDING_UP.value)
                    else:
                        regimes.append(MarketRegime.TRENDING_DOWN.value)
                elif recent_volatility > long_volatility * 1.5:
                    regimes.append(MarketRegime.VOLATILE.value)
                elif recent_volatility < long_volatility * 0.5:
                    regimes.append(MarketRegime.QUIET.value)
                else:
                    regimes.append(MarketRegime.RANGING.value)

            return pd.Series(regimes, index=df.index)

        except Exception as e:
            self.logger.error(f"Error classifying market regime: {e}")
            return pd.Series([MarketRegime.QUIET.value] * len(df), index=df.index)

    def train_model(self, model_name: str, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Train a specific ML model
        """
        try:
            config = self.model_configs[model_name]

            # Prepare data
            feature_df = df[config.features].copy()
            target_df = df[config.target_column].copy()

            # Remove NaN values
            valid_mask = ~(feature_df.isna().any(axis=1) | target_df.isna())
            features = feature_df[valid_mask]
            targets = target_df[valid_mask]

            if len(features) < 100:  # Not enough data
                self.logger.warning(f"Insufficient data for {model_name}: {len(features)} samples")
                return {"error": "Insufficient data"}

            # Split data
            if model_name == 'regime_classifier':
                # Use stratified split for classification
                X_train, X_test, y_train, y_test = train_test_split(
                    features, targets, test_size=0.2, random_state=42, stratify=targets
                )
            else:
                # Use time series split for regression/prediction
                tscv = TimeSeriesSplit(n_splits=3)
                splits = list(tscv.split(features))
                train_idx, test_idx = splits[-1]  # Use last split
                X_train, X_test = features.iloc[train_idx], features.iloc[test_idx]
                y_train, y_test = targets.iloc[train_idx], targets.iloc[test_idx]

            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)

            # Train model based on type
            if config.model_type == 'xgboost':
                model = xgb.XGBClassifier(
                    n_estimators=100,
                    max_depth=6,
                    learning_rate=0.1,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    random_state=42
                )
            elif config.model_type == 'gradient_boost':
                model = GradientBoostingRegressor(
                    n_estimators=100,
                    max_depth=6,
                    learning_rate=0.1,
                    subsample=0.8,
                    random_state=42
                )
            elif config.model_type == 'random_forest':
                model = RandomForestClassifier(
                    n_estimators=100,
                    max_depth=10,
                    random_state=42,
                    class_weight='balanced'
                )
            elif config.model_type == 'neural_network' and TORCH_AVAILABLE:
                model = self._train_neural_network(X_train_scaled, y_train.values, X_test_scaled, y_test.values)
            else:
                raise ValueError(f"Unsupported model type: {config.model_type}")

            # Train the model
            if config.model_type != 'neural_network':
                model.fit(X_train_scaled, y_train)

            # Evaluate model
            if model_name == 'regime_classifier':
                predictions = model.predict(X_test_scaled)
                accuracy = accuracy_score(y_test, predictions)
                precision = precision_score(y_test, predictions, average='weighted')
                recall = recall_score(y_test, predictions, average='weighted')

                metrics = {
                    'accuracy': accuracy,
                    'precision': precision,
                    'recall': recall,
                    'samples': len(X_test)
                }
            else:
                if hasattr(model, 'predict'):
                    predictions = model.predict(X_test_scaled)
                else:
                    predictions = model(torch.FloatTensor(X_test_scaled)).detach().numpy().flatten()

                mse = mean_squared_error(y_test, predictions)
                rmse = np.sqrt(mse)

                # For direction accuracy
                actual_direction = np.where(y_test > 0, 1, 0)
                pred_direction = np.where(predictions > 0, 1, 0)
                direction_accuracy = accuracy_score(actual_direction, pred_direction)

                metrics = {
                    'mse': mse,
                    'rmse': rmse,
                    'direction_accuracy': direction_accuracy,
                    'samples': len(X_test)
                }

            # Save model and scaler
            self.models[model_name] = model
            self.scalers[model_name] = scaler
            self.performance_metrics[model_name] = metrics

            # Save to disk
            self._save_model(model_name, model, scaler)

            self.logger.info(f"Trained {model_name} - Metrics: {metrics}")

            return {
                'success': True,
                'metrics': metrics,
                'samples_trained': len(X_train),
                'samples_tested': len(X_test)
            }

        except Exception as e:
            self.logger.error(f"Error training {model_name}: {e}")
            return {"error": str(e)}

    def _train_neural_network(self, X_train, y_train, X_test, y_test):
        """Train neural network model"""
        try:
            input_size = X_train.shape[1]
            model = NeuralPricePredictor(input_size, [64, 32, 16])

            # Convert to tensors
            X_train_tensor = torch.FloatTensor(X_train)
            y_train_tensor = torch.FloatTensor(y_train).unsqueeze(1)
            X_test_tensor = torch.FloatTensor(X_test)
            y_test_tensor = torch.FloatTensor(y_test).unsqueeze(1)

            # Training setup
            criterion = nn.MSELoss()
            optimizer = optim.Adam(model.parameters(), lr=0.001)

            # Training loop
            epochs = 100
            batch_size = 32

            for epoch in range(epochs):
                model.train()
                total_loss = 0

                for i in range(0, len(X_train_tensor), batch_size):
                    batch_X = X_train_tensor[i:i+batch_size]
                    batch_y = y_train_tensor[i:i+batch_size]

                    optimizer.zero_grad()
                    outputs = model(batch_X)
                    loss = criterion(outputs, batch_y)
                    loss.backward()
                    optimizer.step()

                    total_loss += loss.item()

                if epoch % 20 == 0:
                    model.eval()
                    with torch.no_grad():
                        test_outputs = model(X_test_tensor)
                        test_loss = criterion(test_outputs, y_test_tensor)
                    self.logger.info(f"Epoch {epoch}, Train Loss: {total_loss:.4f}, Test Loss: {test_loss:.4f}")

            model.eval()
            return model

        except Exception as e:
            self.logger.error(f"Error training neural network: {e}")
            raise

    def predict(self, model_name: str, features: pd.DataFrame) -> PredictionResult:
        """
        Make prediction using trained model
        """
        try:
            if model_name not in self.models:
                # Try to load model from disk
                if not self._load_model(model_name):
                    raise ValueError(f"Model {model_name} not found")

            model = self.models[model_name]
            scaler = self.scalers[model_name]
            config = self.model_configs[model_name]

            # Prepare features
            feature_data = features[config.features].copy().iloc[-1:]  # Use most recent data

            # Scale features
            feature_data_scaled = scaler.transform(feature_data)

            # Make prediction
            if config.model_type == 'neural_network' and TORCH_AVAILABLE:
                model.eval()
                with torch.no_grad():
                    prediction = model(torch.FloatTensor(feature_data_scaled)).detach().numpy()[0][0]
            else:
                prediction = model.predict(feature_data_scaled)[0]

            # Calculate confidence
            if hasattr(model, 'predict_proba') and config.target_column in ['future_direction', 'market_regime']:
                confidence = np.max(model.predict_proba(feature_data_scaled)[0])
            else:
                # For regression models, use feature similarity as confidence
                confidence = min(1.0, max(0.5, 1.0 - np.std(feature_data_scaled) / 2.0))

            return PredictionResult(
                symbol=features.index[-1] if hasattr(features, 'index') else 'unknown',
                prediction=float(prediction),
                confidence=float(confidence),
                prediction_type=config.target_column,
                timestamp=time.time(),
                features_used=config.features
            )

        except Exception as e:
            self.logger.error(f"Error making prediction with {model_name}: {e}")
            raise

    def ensemble_predict(self, features: pd.DataFrame) -> Dict[str, PredictionResult]:
        """
        Make ensemble predictions using all available models
        """
        results = {}

        for model_name in self.models.keys():
            try:
                prediction = self.predict(model_name, features)
                results[model_name] = prediction
            except Exception as e:
                self.logger.warning(f"Failed to predict with {model_name}: {e}")

        return results

    def should_retrain(self, model_name: str) -> bool:
        """
        Determine if a model should be retrained based on performance
        """
        if model_name not in self.performance_metrics:
            return True

        metrics = self.performance_metrics[model_name]

        # Check accuracy for classification models
        if 'accuracy' in metrics:
            return metrics['accuracy'] < self.retrain_threshold

        # Check direction accuracy for regression models
        if 'direction_accuracy' in metrics:
            return metrics['direction_accuracy'] < self.retrain_threshold

        # Check MSE for regression models
        if 'mse' in metrics:
            return metrics['mse'] > 0.01  # Arbitrary threshold

        return False

    def optimize_position_size(self, symbol: str, base_size: float, confidence: float,
                              volatility: float, max_risk: float = 0.02) -> float:
        """
        Optimize position size based on ML predictions and risk management
        """
        try:
            # Kelly Criterion with safety factor
            kelly_fraction = confidence * 0.5  # Conservative Kelly (50% of optimal)

            # Volatility adjustment
            volatility_adjustment = min(1.0, 0.02 / max(volatility, 0.001))

            # Calculate optimal size
            optimal_size = base_size * kelly_fraction * volatility_adjustment

            # Apply maximum risk constraint
            max_size = max_risk / volatility  # Maximum size based on risk tolerance
            optimal_size = min(optimal_size, max_size)

            # Ensure minimum size
            min_size = base_size * 0.1
            optimal_size = max(optimal_size, min_size)

            return optimal_size

        except Exception as e:
            self.logger.error(f"Error optimizing position size: {e}")
            return base_size

    def _save_model(self, model_name: str, model, scaler):
        """Save model and scaler to disk"""
        try:
            import os
            os.makedirs(self.models_dir, exist_ok=True)

            model_path = f"{self.models_dir}/{model_name}_model.joblib"
            scaler_path = f"{self.models_dir}/{model_name}_scaler.joblib"

            joblib.dump(model, model_path)
            joblib.dump(scaler, scaler_path)

            self.logger.info(f"Saved {model_name} model to disk")

        except Exception as e:
            self.logger.error(f"Error saving {model_name} model: {e}")

    def _load_model(self, model_name: str) -> bool:
        """Load model and scaler from disk"""
        try:
            model_path = f"{self.models_dir}/{model_name}_model.joblib"
            scaler_path = f"{self.models_dir}/{model_name}_scaler.joblib"

            if not (os.path.exists(model_path) and os.path.exists(scaler_path)):
                return False

            model = joblib.load(model_path)
            scaler = joblib.load(scaler_path)

            self.models[model_name] = model
            self.scalers[model_name] = scaler

            self.logger.info(f"Loaded {model_name} model from disk")
            return True

        except Exception as e:
            self.logger.error(f"Error loading {model_name} model: {e}")
            return False

    async def auto_retrain_models(self, data_manager):
        """
        Automatically retrain models when performance degrades
        """
        while True:
            try:
                for model_name in self.model_configs.keys():
                    if self.should_retrain(model_name):
                        self.logger.info(f"Retraining {model_name} model...")

                        # Get recent data
                        recent_data = await data_manager.get_recent_data(
                            symbols=['BTCUSD'],  # Get data for primary symbol
                            lookback_period=200
                        )

                        if not recent_data.empty:
                            result = self.train_model(model_name, recent_data)
                            if result.get('success'):
                                self.logger.info(f"Successfully retrained {model_name}")
                            else:
                                self.logger.error(f"Failed to retrain {model_name}: {result}")

                # Check every 6 hours
                await asyncio.sleep(21600)

            except Exception as e:
                self.logger.error(f"Error in auto-retrain loop: {e}")
                await asyncio.sleep(3600)

# Example usage
async def example_ml_optimizer():
    """Example of using the ML optimizer"""

    config = {
        'models_dir': './models',
        'data_dir': './data',
        'retrain_threshold': 0.7
    }

    # Create sample data
    np.random.seed(42)
    dates = pd.date_range(start='2023-01-01', end='2023-12-31', freq='H')

    # Generate synthetic OHLCV data
    price = 50000 + np.cumsum(np.random.randn(len(dates)) * 100)
    df = pd.DataFrame({
        'timestamp': dates,
        'open': price,
        'high': price + np.random.rand(len(dates)) * 200,
        'low': price - np.random.rand(len(dates)) * 200,
        'close': price + np.random.randn(len(dates)) * 50,
        'volume': np.random.randint(100, 1000, len(dates))
    })
    df.set_index('timestamp', inplace=True)

    # Initialize optimizer
    optimizer = TradingMLOptimizer(config)

    # Prepare features
    df_features = optimizer.prepare_features(df, 'BTCUSD')

    # Train models
    for model_name in ['direction_predictor', 'volatility_predictor', 'regime_classifier']:
        print(f"Training {model_name}...")
        result = optimizer.train_model(model_name, df_features)
        print(f"Result: {result}")

    # Make predictions
    recent_features = df_features.tail(1)
    predictions = optimizer.ensemble_predict(recent_features)

    print("\nPredictions:")
    for model_name, pred in predictions.items():
        print(f"{model_name}: {pred.prediction:.4f} (confidence: {pred.confidence:.2f})")

    # Optimize position size
    base_size = 1000
    if 'direction_predictor' in predictions:
        pred = predictions['direction_predictor']
        optimal_size = optimizer.optimize_position_size(
            'BTCUSD', base_size, pred.confidence, 0.02
        )
        print(f"\nOptimal position size: {optimal_size:.2f} (base: {base_size})")

if __name__ == "__main__":
    asyncio.run(example_ml_optimizer())