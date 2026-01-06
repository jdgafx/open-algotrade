# Configuration Management System

## Overview

A centralized configuration management system that provides dynamic, environment-aware configuration for all trading strategies and system components. Designed for runtime parameter updates without service restarts and comprehensive audit trails.

## Configuration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Configuration Gateway                                 │
│                     (Validation, Versioning, Distribution)                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Configuration Store                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Strategy  │ │   System    │ │   Risk      │ │   Exchange  │ │  Monitoring ││
│  │  Configs    │ │  Configs    │ │  Configs    │ │  Configs    │ │  Configs    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Configuration Sources                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │    Files    │ │ Environment │ │    Database │ │   Secrets   │ │   Remote    ││
│  │   (YAML)    │ │ Variables   │ │   Store     │ │   Manager   │ │   Config    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Core Configuration Components

### Configuration Manager
```python
import asyncio
import json
import yaml
import os
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
import logging
from pathlib import Path

class ConfigType(Enum):
    STRATEGY = "strategy"
    SYSTEM = "system"
    RISK = "risk"
    EXCHANGE = "exchange"
    MONITORING = "monitoring"

class Environment(Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

@dataclass
class ConfigurationVersion:
    version: str
    timestamp: datetime
    author: str
    changes: str
    config_type: ConfigType

@dataclass
class ConfigurationSchema:
    name: str
    schema: Dict[str, Any]
    validation_rules: Dict[str, Any]
    default_values: Dict[str, Any]

class ConfigurationManager:
    def __init__(self, environment: Environment = Environment.DEVELOPMENT):
        self.environment = environment
        self.configs = {}
        self.schemas = {}
        self.version_history = {}
        self.watchers = {}
        self.logger = logging.getLogger(__name__)

        # Configuration paths
        self.base_path = Path("/home/chris/dev/moondev-algotrade/config")
        self.env_path = self.base_path / environment.value

        # Initialize configuration
        self._load_schemas()
        self._load_configurations()

    def _load_schemas(self):
        """Load configuration schemas"""
        schema_files = {
            ConfigType.STRATEGY: "strategy_schema.yaml",
            ConfigType.SYSTEM: "system_schema.yaml",
            ConfigType.RISK: "risk_schema.yaml",
            ConfigType.EXCHANGE: "exchange_schema.yaml",
            ConfigType.MONITORING: "monitoring_schema.yaml"
        }

        for config_type, filename in schema_files.items():
            schema_path = self.base_path / "schemas" / filename
            if schema_path.exists():
                with open(schema_path, 'r') as f:
                    schema_data = yaml.safe_load(f)
                    self.schemas[config_type] = ConfigurationSchema(
                        name=config_type.value,
                        schema=schema_data['schema'],
                        validation_rules=schema_data.get('validation_rules', {}),
                        default_values=schema_data.get('default_values', {})
                    )

    def _load_configurations(self):
        """Load all configurations for current environment"""
        config_files = {
            ConfigType.STRATEGY: "strategies.yaml",
            ConfigType.SYSTEM: "system.yaml",
            ConfigType.RISK: "risk.yaml",
            ConfigType.EXCHANGE: "exchanges.yaml",
            ConfigType.MONITORING: "monitoring.yaml"
        }

        for config_type, filename in config_files.items():
            config_path = self.env_path / filename
            if config_path.exists():
                with open(config_path, 'r') as f:
                    config_data = yaml.safe_load(f)
                    self.configs[config_type] = config_data
            else:
                # Create default config
                if config_type in self.schemas:
                    self.configs[config_type] = self.schemas[config_type].default_values.copy()

    async def get_config(self, config_type: ConfigType, key: str = None) -> Any:
        """Get configuration value"""

        if config_type not in self.configs:
            raise ValueError(f"Configuration type {config_type} not found")

        config = self.configs[config_type]

        if key is None:
            return config

        # Navigate nested keys with dot notation
        keys = key.split('.')
        value = config
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                # Check environment variables for override
                env_key = f"{config_type.value.upper()}_{key.upper().replace('.', '_')}"
                env_value = os.getenv(env_key)
                if env_value:
                    return self._parse_env_value(env_value)

                # Return default if available
                if config_type in self.schemas and key in self.schemas[config_type].default_values:
                    return self.schemas[config_type].default_values[key]

                raise ValueError(f"Configuration key {key} not found in {config_type}")

        return value

    async def update_config(self, config_type: ConfigType, key: str, value: Any, author: str = "system") -> bool:
        """Update configuration value"""

        if config_type not in self.configs:
            raise ValueError(f"Configuration type {config_type} not found")

        # Validate against schema
        if not self._validate_config_value(config_type, key, value):
            raise ValueError(f"Invalid configuration value for {key}")

        # Create backup
        await self._create_backup(config_type)

        # Update configuration
        keys = key.split('.')
        config = self.configs[config_type]
        current = config

        for k in keys[:-1]:
            if k not in current:
                current[k] = {}
            current = current[k]

        old_value = current.get(keys[-1])
        current[keys[-1]] = value

        # Save to file
        await self._save_config(config_type)

        # Log change
        await self._log_config_change(config_type, key, old_value, value, author)

        # Notify watchers
        await self._notify_watchers(config_type, key, value)

        return True

    async def get_strategy_config(self, strategy_id: str) -> Dict[str, Any]:
        """Get configuration for a specific strategy"""
        strategy_configs = await self.get_config(ConfigType.STRATEGY)
        return strategy_configs.get('strategies', {}).get(strategy_id, {})

    async def update_strategy_param(self, strategy_id: str, param_name: str, value: Any, author: str = "system"):
        """Update specific strategy parameter"""
        key = f"strategies.{strategy_id}.parameters.{param_name}"
        return await self.update_config(ConfigType.STRATEGY, key, value, author)

    async def reload_config(self, config_type: ConfigType):
        """Reload configuration from file"""
        config_files = {
            ConfigType.STRATEGY: "strategies.yaml",
            ConfigType.SYSTEM: "system.yaml",
            ConfigType.RISK: "risk.yaml",
            ConfigType.EXCHANGE: "exchanges.yaml",
            ConfigType.MONITORING: "monitoring.yaml"
        }

        if config_type in config_files:
            config_path = self.env_path / config_files[config_type]
            if config_path.exists():
                with open(config_path, 'r') as f:
                    config_data = yaml.safe_load(f)
                    self.configs[config_type] = config_data
                await self._notify_watchers(config_type, "reload", config_data)

    def _validate_config_value(self, config_type: ConfigType, key: str, value: Any) -> bool:
        """Validate configuration value against schema"""
        if config_type not in self.schemas:
            return True

        schema = self.schemas[config_type]
        keys = key.split('.')
        current_schema = schema.schema

        try:
            # Navigate schema
            for k in keys[:-1]:
                if k in current_schema and 'properties' in current_schema[k]:
                    current_schema = current_schema[k]['properties']
                else:
                    return True  # No schema validation available

            final_key = keys[-1]
            if final_key in current_schema:
                field_schema = current_schema[final_key]

                # Type validation
                if 'type' in field_schema:
                    expected_type = field_schema['type']
                    if expected_type == 'number':
                        return isinstance(value, (int, float))
                    elif expected_type == 'integer':
                        return isinstance(value, int)
                    elif expected_type == 'string':
                        return isinstance(value, str)
                    elif expected_type == 'boolean':
                        return isinstance(value, bool)
                    elif expected_type == 'array':
                        return isinstance(value, list)
                    elif expected_type == 'object':
                        return isinstance(value, dict)

                # Range validation
                if 'minimum' in field_schema and value < field_schema['minimum']:
                    return False
                if 'maximum' in field_schema and value > field_schema['maximum']:
                    return False

                # Enum validation
                if 'enum' in field_schema and value not in field_schema['enum']:
                    return False

        except Exception as e:
            self.logger.error(f"Configuration validation error: {e}")
            return False

        return True

    async def _save_config(self, config_type: ConfigType):
        """Save configuration to file"""
        config_files = {
            ConfigType.STRATEGY: "strategies.yaml",
            ConfigType.SYSTEM: "system.yaml",
            ConfigType.RISK: "risk.yaml",
            ConfigType.EXCHANGE: "exchanges.yaml",
            ConfigType.MONITORING: "monitoring.yaml"
        }

        if config_type in config_files:
            config_path = self.env_path / config_files[config_type]
            with open(config_path, 'w') as f:
                yaml.dump(self.configs[config_type], f, default_flow_style=False)

    async def _create_backup(self, config_type: ConfigType):
        """Create backup of current configuration"""
        backup_dir = self.env_path / "backups"
        backup_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = backup_dir / f"{config_type.value}_{timestamp}.yaml"

        with open(backup_file, 'w') as f:
            yaml.dump(self.configs[config_type], f, default_flow_style=False)

    async def _log_config_change(self, config_type: ConfigType, key: str, old_value: Any, new_value: Any, author: str):
        """Log configuration change"""
        change_log = {
            'timestamp': datetime.now().isoformat(),
            'config_type': config_type.value,
            'key': key,
            'old_value': old_value,
            'new_value': new_value,
            'author': author
        }

        log_file = self.env_path / "config_changes.log"
        with open(log_file, 'a') as f:
            f.write(json.dumps(change_log) + '\n')

    def register_watcher(self, config_type: ConfigType, callback):
        """Register callback for configuration changes"""
        if config_type not in self.watchers:
            self.watchers[config_type] = []
        self.watchers[config_type].append(callback)

    async def _notify_watchers(self, config_type: ConfigType, key: str, value: Any):
        """Notify all registered watchers"""
        if config_type in self.watchers:
            for callback in self.watchers[config_type]:
                try:
                    await callback(key, value)
                except Exception as e:
                    self.logger.error(f"Error notifying config watcher: {e}")
```

### Strategy Configuration Templates
```python
# config/templates/strategy_template.yaml
strategy_template:
  name: "template_strategy"
  version: "1.0.0"
  enabled: true
  parameters:
    # Trading parameters
    position_size: 0.02
    max_positions: 5
    leverage: 2.0

    # Technical indicators
    timeframe: "5m"
    lookback_period: 20

    # Risk parameters
    stop_loss: 0.02
    take_profit: 0.04
    max_drawdown: 0.15

    # Execution parameters
    order_type: "limit"
    slippage_tolerance: 0.001

  schedule:
    enabled: true
    timezone: "UTC"
    trading_hours:
      start: "00:00"
      end: "23:59"
    exclude_weekends: false

# config/development/strategies.yaml
strategies:
  market_maker:
    name: "Market Maker"
    version: "1.0.0"
    enabled: true
    exchange: "hyperliquid"
    symbols: ["BTC-USD", "ETH-USD"]

    parameters:
      size: 1000
      symbol: "BTC-USD"
      perc_from_lh: 0.35
      close_seconds: 2820
      trade_pause_mins: 15
      max_lh: 1250
      timeframe: "5m"
      num_bars: 180
      max_risk: 1100
      sl_perc: 0.1
      exit_perc: 0.004
      max_tr: 550
      quartile: 0.33
      time_limit: 120
      sleep: 30

  mean_reversion:
    name: "Mean Reversion"
    version: "1.0.0"
    enabled: true
    exchange: "hyperliquid"
    symbols: ["BTC-USD", "ETH-USD", "SOL-USD"]

    parameters:
      lookback_period: 20
      deviation_threshold: 2.0
      position_size: 0.015
      max_positions: 3
      stop_loss: 0.025
      take_profit: 0.03
      timeframe: "15m"

  correlation_arbitrage:
    name: "Correlation Arbitrage"
    version: "1.0.0"
    enabled: false  # Disabled until ready
    exchange: ["hyperliquid", "phemex"]
    symbol_pairs: [["BTC-USD", "BTC/USDT"]]

    parameters:
      correlation_window: 100
      min_correlation: 0.8
      divergence_threshold: 0.02
      position_size: 0.01
      max_positions: 2
      profit_target: 0.005
      timeframe: "5m"
```

### System Configuration
```python
# config/development/system.yaml
system:
  # Core system settings
  environment: "development"
  debug: true
  log_level: "INFO"

  # Database settings
  database:
    host: "localhost"
    port: 5432
    name: "moondev_dev"
    username: "postgres"
    pool_size: 5
    max_overflow: 10

  # Redis settings
  redis:
    host: "localhost"
    port: 6379
    db: 0
    password: null

  # API settings
  api:
    host: "0.0.0.0"
    port: 8000
    workers: 4
    cors_origins: ["http://localhost:3000"]

  # Strategy orchestrator
  orchestrator:
    max_concurrent_strategies: 10
    strategy_timeout: 300
    health_check_interval: 30
    restart_on_failure: true

  # Performance settings
  performance:
    max_latency_ms: 100
    throughput_target: 1000
    memory_limit_mb: 2048

# config/production/system.yaml
system:
  environment: "production"
  debug: false
  log_level: "WARNING"

  database:
    host: "${DB_HOST}"
    port: "${DB_PORT}"
    name: "${DB_NAME}"
    username: "${DB_USER}"
    password: "${DB_PASSWORD}"
    pool_size: 20
    max_overflow: 40
    ssl_mode: "require"

  redis:
    host: "${REDIS_HOST}"
    port: "${REDIS_PORT}"
    db: 0
    password: "${REDIS_PASSWORD}"

  api:
    host: "0.0.0.0"
    port: 8000
    workers: 12
    cors_origins: ["https://dashboard.moondev.com"]

  orchestrator:
    max_concurrent_strategies: 50
    strategy_timeout: 180
    health_check_interval: 15
    restart_on_failure: true

  performance:
    max_latency_ms: 50
    throughput_target: 5000
    memory_limit_mb: 8192
```

### Risk Configuration
```python
# config/development/risk.yaml
risk:
  # Global risk limits
  global:
    max_portfolio_risk: 0.25      # 25% max portfolio drawdown
    max_position_size: 0.10       # 10% of portfolio per position
    max_strategy_drawdown: 0.15   # 15% max per strategy
    max_leverage: 3.0             # 3x maximum leverage for dev
    max_correlation: 0.7          # Max correlation between strategies
    min_liquidity: 5000           # Minimum liquidity in USD
    max_daily_loss: 0.08          # 8% max daily loss
    position_timeout: 7200        # 2 hours max position time

  # Position sizing
  position_sizing:
    base_size: 0.02               # 2% of portfolio
    max_size: 0.05                # 5% of portfolio
    volatility_adjustment: true
    correlation_adjustment: true
    kelly_fraction: 0.25          # Quarter Kelly

  # Circuit breakers
  circuit_breakers:
    loss_threshold: 0.10          # 10% loss triggers
    profit_target: 0.20           # 20% profit triggers
    timeout_period: 300           # 5 minutes timeout

  # Exchange-specific risks
  exchange_limits:
    hyperliquid:
      max_open_orders: 20
      max_position_value: 50000
      rate_limit_per_second: 10

    phemex:
      max_open_orders: 15
      max_position_value: 30000
      rate_limit_per_second: 5
```

### Configuration REST API
```python
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional

class ConfigUpdateRequest(BaseModel):
    key: str
    value: Any
    author: Optional[str] = "api_user"

class ConfigManagerAPI:
    def __init__(self, config_manager: ConfigurationManager):
        self.app = FastAPI(title="Configuration Manager API")
        self.config_manager = config_manager
        self._setup_routes()

    def _setup_routes(self):
        @self.app.get("/config/{config_type}")
        async def get_config(config_type: str, key: Optional[str] = None):
            try:
                config_type_enum = ConfigType(config_type)
                config = await self.config_manager.get_config(config_type_enum, key)
                return {"status": "success", "data": config}
            except ValueError as e:
                raise HTTPException(status_code=404, detail=str(e))

        @self.app.put("/config/{config_type}")
        async def update_config(config_type: str, request: ConfigUpdateRequest):
            try:
                config_type_enum = ConfigType(config_type)
                success = await self.config_manager.update_config(
                    config_type_enum, request.key, request.value, request.author
                )
                return {"status": "success" if success else "failed"}
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

        @self.app.get("/strategy/{strategy_id}")
        async def get_strategy_config(strategy_id: str):
            try:
                config = await self.config_manager.get_strategy_config(strategy_id)
                return {"status": "success", "data": config}
            except ValueError as e:
                raise HTTPException(status_code=404, detail=str(e))

        @self.app.put("/strategy/{strategy_id}/parameters")
        async def update_strategy_parameter(
            strategy_id: str,
            param_name: str,
            value: Any,
            author: Optional[str] = "api_user"
        ):
            try:
                success = await self.config_manager.update_strategy_param(
                    strategy_id, param_name, value, author
                )
                return {"status": "success" if success else "failed"}
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

        @self.app.post("/config/{config_type}/reload")
        async def reload_config(config_type: str):
            try:
                config_type_enum = ConfigType(config_type)
                await self.config_manager.reload_config(config_type_enum)
                return {"status": "success", "message": f"Reloaded {config_type} configuration"}
            except ValueError as e:
                raise HTTPException(status_code=404, detail=str(e))

        @self.app.get("/config/{config_type}/schema")
        async def get_config_schema(config_type: str):
            try:
                config_type_enum = ConfigType(config_type)
                if config_type_enum in self.config_manager.schemas:
                    schema = self.config_manager.schemas[config_type_enum]
                    return {
                        "status": "success",
                        "data": {
                            "schema": schema.schema,
                            "validation_rules": schema.validation_rules,
                            "default_values": schema.default_values
                        }
                    }
                else:
                    raise HTTPException(status_code=404, detail="Schema not found")
            except ValueError as e:
                raise HTTPException(status_code=404, detail=str(e))
```

This configuration management system provides a robust, flexible foundation for managing all aspects of the trading system with runtime updates, comprehensive validation, and full audit trails.