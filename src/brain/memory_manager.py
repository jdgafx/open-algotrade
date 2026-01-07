"""
KAIROS Memory Manager
The hippocampus of the trading system. Persists experience to drive future intelligence.
"""

import json
import logging
import time
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict

from src.brain.knowledge_graph import KnowledgeGraph

logger = logging.getLogger(__name__)


@dataclass
class TradeMemory:
    timestamp: float
    strategy: str
    symbol: str
    side: str
    entry_price: float
    exit_price: float
    pnl: float
    pnl_percent: float
    market_conditions: Dict[str, Any]
    notes: str = ""


class MemoryManager:
    def __init__(self, data_dir: str = "data/memory"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.memory_file = self.data_dir / "trade_history.json"
        self.stats_file = self.data_dir / "strategy_stats.json"

        self.graph = KnowledgeGraph(str(self.data_dir / "kairos_graph.db"))
        self._load_memory()

    def _load_memory(self):
        """Load persistent memory"""
        if self.memory_file.exists():
            try:
                with open(self.memory_file, "r") as f:
                    self.trades = [TradeMemory(**t) for t in json.load(f)]
            except Exception as e:
                logger.error(f"Failed to load memory: {e}")
                self.trades = []
        else:
            self.trades = []

    def _save_memory(self):
        """Persist memory to disk"""
        try:
            with open(self.memory_file, "w") as f:
                json.dump([asdict(t) for t in self.trades], f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save memory: {e}")

    def log_trade(self, trade: TradeMemory):
        """Commit a new experience to long-term memory"""
        self.trades.append(trade)
        self._save_memory()
        self._update_stats()

        self.graph.log_trade_event(
            strategy=trade.strategy,
            symbol=trade.symbol,
            action=f"TRADE_{trade.side.upper()}",
            price=trade.entry_price,
            conditions=trade.market_conditions,
        )

        logger.info(
            f"🧠 KAIROS learned from trade: {trade.strategy} on {trade.symbol} (PnL: {trade.pnl_percent}%)"
        )

    def _update_stats(self):
        """Update aggregate statistics for reinforcement learning"""
        stats = {}
        for trade in self.trades:
            strat = trade.strategy
            if strat not in stats:
                stats[strat] = {
                    "wins": 0,
                    "losses": 0,
                    "total_pnl": 0.0,
                    "best_market_condition": {},
                }

            stats[strat]["total_pnl"] += trade.pnl
            if trade.pnl > 0:
                stats[strat]["wins"] += 1
            else:
                stats[strat]["losses"] += 1

        try:
            with open(self.stats_file, "w") as f:
                json.dump(stats, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save stats: {e}")

    def get_intelligence(self, strategy: str) -> Dict[str, Any]:
        """Retrieve insights for a specific strategy"""
        winning_trades = [
            t for t in self.trades if t.strategy == strategy and t.pnl > 0
        ]
        if not winning_trades:
            return {"confidence": 0, "suggestion": "Insufficient data"}

        avg_vol = sum(
            t.market_conditions.get("volatility_atr", 0) for t in winning_trades
        ) / len(winning_trades)

        related_conditions = self.graph.query_relationships(
            f"Strategy:{strategy}", "INFLUENCED"
        )

        return {
            "confidence": len(winning_trades)
            / (len([t for t in self.trades if t.strategy == strategy]) + 1),
            "optimal_volatility_atr": avg_vol,
            "graph_insights": len(related_conditions),
            "suggestion": "Increase size in similar conditions",
        }
