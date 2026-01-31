# AGENTS.md - Core Source Code

**Location:** `src/`

## OVERVIEW

Core Python source code for the algorithmic trading platform. Contains 93 Python files across 7 subdirectories.

## STRUCTURE

```
src/
├── engine/           # Trading execution engines
├── brain/            # AI/memory management systems
├── strategies/       # Trading strategy implementations
├── ui/               # Dashboard and UI components
├── security/         # Threat detection, key management
├── utils/            # Shared utilities (data_loader, hyperliquid_client)
└── atc_bootcamp/     # Learning materials & examples
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Trading Execution | `engine/trading_engine.py` | Live trading orchestration |
| Backtesting | `engine/backtest_engine.py` | Strategy testing |
| Strategy Logic | `strategies/` | Algorithm implementations |
| Data Fetching | `utils/data_loader.py` | Exchange data loading |
| HyperLiquid API | `utils/hyperliquid_client.py` | Exchange client wrapper |
| Memory Management | `brain/memory_manager.py` | AI context management |
| Knowledge Graph | `brain/knowledge_graph.py` | Data relationships |
| UI Components | `ui/components/` | React/Vue dashboard |
| Security | `security/` | Encryption, monitoring |

## CONVENTIONS

### Python Imports
```python
# Order: stdlib → third-party → local
import os
from typing import List, Dict

import pandas as pd
from hyperliquid import Client

from src.utils.data_loader import load_data
```

### Type Hints (Required)
```python
def fetch_ohlcv(symbol: str, timeframe: str = "1h") -> pd.DataFrame:
    """Fetch OHLCV data for symbol."""
    pass
```

### Trading Function Pattern
```python
# nice_funcs.py pattern used across codebase
def calculate_position_size(account_value: float, risk_pct: float, 
                           stop_distance: float) -> float:
    """Calculate position size based on risk."""
    return (account_value * risk_pct) / stop_distance
```

## ANTI-PATTERNS

| Forbidden | Reason |
|-----------|--------|
| Hardcoded credentials | Security - use KeyManager |
| Synchronous API calls | Blocks event loop |
| No stop-loss validation | Risk management failure |
| Files >500 lines | Maintainability |

## NOTES

- **Engine Pattern**: `trading_engine.py` orchestrates, strategies implement `execute()`
- **Bootcamp Code**: `atc_bootcamp/` contains educational examples - don't use in production
- **Utils Reuse**: `nice_funcs.py` pattern - shared calculations across modules
