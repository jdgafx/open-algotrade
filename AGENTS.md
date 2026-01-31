# AGENTS.md - Algorithmic Trading Platform

**Generated:** 2026-01-29 06:53 AM  
**Commit:** edd30ad  
**Branch:** main

## OVERVIEW

Enterprise-grade algorithmic trading platform with security management, strategy validation, and automated trading systems. Uses SPARC methodology with Claude-Flow orchestration.

## STRUCTURE

```
.
├── src/                          # Core source code (93 Python files)
│   ├── engine/                   # Trading and backtest engines
│   ├── brain/                    # AI/memory management
│   ├── strategies/               # Trading strategies
│   ├── ui/                       # User interface components
│   ├── security/                 # Security management
│   ├── utils/                    # Utility functions
│   └── atc_bootcamp/             # Trading bootcamp materials
├── ultimate-trading-platform/    # Production trading platform
├── scripts/                      # Legacy trading scripts (42 files)
├── solana-sniper-2025-main/      # Solana DEX sniper bot
├── tests/                        # Test suite
└── docs/                         # Documentation
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Trading Engine | `src/engine/` | Core backtest and live trading |
| Strategy Code | `src/strategies/`, `ultimate-trading-platform/strategies/` | Algorithm implementations |
| UI Components | `src/ui/components/` | Dashboard and interface |
| Security | `src/security/` | Threat detection, key management |
| Bootcamp | `src/atc_bootcamp/` | Learning materials |
| Legacy Scripts | `scripts/legacy/` | Older trading algorithms |

## ENTRY POINTS

| File | Purpose |
|------|---------|
| `src/engine/trading_engine.py` | Main trading execution |
| `src/engine/backtest_engine.py` | Strategy backtesting |
| `setup_real_trading.py` | Real trading setup |

## CONVENTIONS

### Python Style
- **Imports**: Standard lib → Third-party → Local
- **Type Hints**: Required for all functions
- **Naming**: `snake_case` variables/functions, `PascalCase` classes, `UPPER_SNAKE` constants
- **Docstrings**: Google-style or Sphinx-style
- **Error Handling**: Explicit try/except with specific exceptions

### File Organization
- Files under 500 lines
- Never save working files to root folder
- Use `/src`, `/tests`, `/docs`, `/scripts` subdirectories
- Configuration in `/config`

### Trading Code
- Risk management required in all strategies
- Stop-loss mandatory for live trading
- Position sizing calculations explicit
- API keys via secure storage (never hardcoded)

## ANTI-PATTERNS

| Forbidden | Reason |
|-----------|--------|
| Hardcoded API keys | Security risk |
| `as any`, `@ts-ignore` | Type safety |
| Empty catch blocks | Silent failures |
| Root-level files | Disorganized |
| Files >500 lines | Maintainability |
| Sequential operations | Performance |
| Saving to root folder | Project hygiene |

## COMMANDS

```bash
# Install dependencies
pip install -r requirements.txt

# Run main engine
python src/engine/trading_engine.py

# Run backtests
python src/engine/backtest_engine.py

# Run tests
pytest tests/ -v
pytest tests/ --tb=short

# SPARC workflow
npx claude-flow sparc tdd "feature name"
npx claude-flow sparc batch modes "task"
```

## UNIQUE PATTERNS

### Claude-Flow Integration
- Use `Task()` tool for parallel agent execution
- Batch all operations in single messages
- MCP tools for coordination, Task tool for execution
- Hooks: `pre-task`, `post-edit`, `post-task`

### Trading Specifics
- `nice_funcs.py` pattern: Shared utility functions
- `config.py` + `config_ex.py`: Configuration templates
- HyperLiquid integration: `hyperliquid_client.py`
- Funding/liquidation monitoring: `data-streams/`

## NOTES

- **Security**: Uses AES-256-GCM encryption for keys
- **Monitoring**: 5-second security monitoring intervals
- **Testing**: 85%+ coverage requirement
- **Deployment**: Pre-deployment security checks mandatory
- **Multi-exchange**: Supports Binance, HyperLiquid, Solana DEX

## AGENTS LOCATIONS

- `./AGENTS.md` (this file) - Root knowledge
- `./src/AGENTS.md` - Core source conventions
- `./ultimate-trading-platform/AGENTS.md` - Production platform
- `./scripts/AGENTS.md` - Legacy scripts
