# AGENTS.md - Legacy Trading Scripts

**Location:** `scripts/`

## OVERVIEW

Legacy trading scripts and educational algorithms. 42 Python files including bootcamp exercises and bonus strategies.

## STRUCTURE

```
scripts/legacy/
├── Bonus_algos_6ofthem/    # Advanced algorithms
│   ├── 1_turtle_trending_algo/
│   ├── 2_correlation_algo/
│   ├── 3_consolidation_pop_algo/
│   ├── 4_nadarya_watson_algo/
│   ├── 5_market_maker/
│   └── 6_mean_reversion/
├── 9_more_indicators/      # Technical analysis
└── 5_risk/                 # Risk management examples
```

## WHERE TO LOOK

| Algorithm | Location | Type |
|-----------|----------|------|
| Turtle Trending | `1_turtle_trending_algo/` | Breakout system |
| Correlation | `2_correlation_algo/` | Pair trading |
| Consolidation Pop | `3_consolidation_pop_algo/` | Volatility expansion |
| Nadarya-Watson | `4_nadarya_watson_algo/` | ML-based |
| Market Maker | `5_market_maker/` | HFT strategy |
| Mean Reversion | `6_mean_reversion/` | Statistical arb |

## CONVENTIONS

### Config Pattern
```python
# config.py - production values (gitignored)
API_KEY = ""
SECRET = ""

# config_ex.py - template with placeholders
API_KEY = "your_api_key_here"
```

### Functions Pattern
```python
# functions.py alongside main bot
from config import API_KEY
from nice_funcs import calculate_size

def run_bot():
    pass
```

## ANTI-PATTERNS

| Forbidden | Reason |
|-----------|--------|
| Commit config.py with keys | Security breach |
| Use legacy in production | Unmaintained code |
| Skip config_ex.py | Blocks other developers |

## NOTES

- **Educational**: These are learning materials, not production-ready
- **Pattern**: Each algo has `config.py`, `config_ex.py`, `functions.py`
- **Risk**: Always paper trade before live with legacy scripts
