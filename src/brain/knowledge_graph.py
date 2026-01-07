"""
KAIROS Cortex - Local Semantic Knowledge Graph
Implements a graph database using SQLite to store complex relationships between
trading events, market conditions, and strategy outcomes.
"""

import sqlite3
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class KnowledgeGraph:
    def __init__(self, db_path: str = "data/memory/kairos_graph.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        """Initialize the Graph Schema (Nodes and Edges)"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS nodes (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    attributes JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS edges (
                    source_id TEXT,
                    target_id TEXT,
                    relation TEXT,
                    weight REAL DEFAULT 1.0,
                    attributes JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (source_id, target_id, relation),
                    FOREIGN KEY(source_id) REFERENCES nodes(id),
                    FOREIGN KEY(target_id) REFERENCES nodes(id)
                )
            """)
            conn.commit()

    def add_node(self, node_id: str, node_type: str, attributes: Dict[str, Any] = None):
        """Create or update a node in the graph"""
        attr_json = json.dumps(attributes or {})
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO nodes (id, type, attributes, last_seen)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    attributes = json_patch(attributes, ?),
                    last_seen = CURRENT_TIMESTAMP
            """,
                (node_id, node_type, attr_json, attr_json),
            )
            conn.commit()

    def add_edge(
        self,
        source_id: str,
        target_id: str,
        relation: str,
        weight: float = 1.0,
        attributes: Dict[str, Any] = None,
    ):
        """Create or update a relationship between nodes"""
        attr_json = json.dumps(attributes or {})
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            self.add_node(source_id, "Unknown")
            self.add_node(target_id, "Unknown")

            cursor.execute(
                """
                INSERT INTO edges (source_id, target_id, relation, weight, attributes)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(source_id, target_id, relation) DO UPDATE SET
                    weight = ?,
                    attributes = json_patch(attributes, ?)
            """,
                (source_id, target_id, relation, weight, attr_json, weight, attr_json),
            )
            conn.commit()

    def query_relationships(
        self, node_id: str, relation: Optional[str] = None
    ) -> List[Dict]:
        """Find what a node is connected to"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = """
                SELECT target_id, relation, weight, nodes.type as target_type, nodes.attributes as target_attrs
                FROM edges 
                JOIN nodes ON edges.target_id = nodes.id
                WHERE source_id = ?
            """
            params = [node_id]

            if relation:
                query += " AND relation = ?"
                params.append(relation)

            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def log_trade_event(
        self,
        strategy: str,
        symbol: str,
        action: str,
        price: float,
        conditions: Dict[str, Any],
    ):
        """Semantic logging of a trade event"""

        strat_node = f"Strategy:{strategy}"
        asset_node = f"Asset:{symbol}"
        event_node = f"Event:{action}_{symbol}_{int(datetime.now().timestamp())}"

        self.add_node(strat_node, "Strategy", {"status": "active"})
        self.add_node(asset_node, "Asset", {"symbol": symbol})
        self.add_node(event_node, "TradeEvent", {"action": action, "price": price})

        for cond, val in conditions.items():
            cond_node = f"Condition:{cond}_{val}"
            self.add_node(cond_node, "MarketCondition", {"value": val})
            self.add_edge(cond_node, event_node, "INFLUENCED")

        self.add_edge(strat_node, event_node, "EXECUTED")
        self.add_edge(event_node, asset_node, "TRADED_ON")

        logger.info(
            f"🧠 Graph Memory Encoded: {strat_node} -> {event_node} -> {asset_node}"
        )
