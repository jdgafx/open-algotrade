# AGENTS.md - Production Trading Platform

**Location:** `ultimate-trading-platform/`

## OVERVIEW

Production-grade trading platform with live execution capabilities. 34 code files focused on real-money trading.

## STRUCTURE

```
ultimate-trading-platform/
├── strategies/       # Production strategy implementations
├── services/         # Exchange integration services
└── tests/            # Platform-specific tests
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Live Strategies | `strategies/` | Production-ready algorithms |
| Exchange Services | `services/` | API wrappers, order management |
| Strategy Tests | `tests/` | Platform-specific validation |

## CONVENTIONS

### Production Safety
```python
# Always validate before live trade
if not self.validate_risk_limits(order):
    logger.error("Risk limit exceeded - blocking trade")
    return False
```

### Strategy Interface
```python
class Strategy:
    def __init__(self, config: dict):
        self.validate_config(config)
        
    def execute(self, signal: Signal) -> Order:
        raise NotImplementedError
```

## ANTI-PATTERNS

| Forbidden | Reason |
|-----------|--------|
| Skip risk validation | Account blow-up risk |
| Test code in production | Unpredictable behavior |
| Hardcoded position sizes | Violates risk management |
| No logging | Debugging impossible |

## NOTES

- **Live Trading**: All strategies must pass validation before deployment
- **Risk First**: Position sizing calculated before every trade
- **Monitoring**: Real-time P&L tracking required
