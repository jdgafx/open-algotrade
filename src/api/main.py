"""
FastAPI Trading Engine - Unified API for all MoonDev strategies
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from decimal import Decimal
import asyncio
import json
from datetime import datetime

from src.utils.hyperliquid_client import HyperliquidClient, MarketData, Position
from src.strategies.adapters.base import StrategyAdapter, StrategyConfig

app = FastAPI(title="OpenAlgo Trading Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TradingRequest(BaseModel):
    strategy_id: str
    symbol: str
    size: float
    timeframe: str = "1h"
    take_profit: Optional[float] = None
    stop_loss: Optional[float] = None
    api_key: str
    api_secret: str
    sandbox: bool = True


class StrategyInfo(BaseModel):
    id: str
    name: str
    description: str
    timeframe_options: List[str]
    default_params: Dict[str, Any]


active_strategies: Dict[str, StrategyAdapter] = {}
connected_clients: List[WebSocket] = []


@app.get("/")
async def root():
    return {"status": "OpenAlgo Trading Engine Online", "version": "1.0.0"}


@app.get("/strategies", response_model=List[StrategyInfo])
async def list_strategies():
    """List all available trading strategies"""
    return [
        StrategyInfo(
            id="turtle_trending",
            name="Turtle Trending",
            description="55-bar breakout strategy with 2x ATR stop loss",
            timeframe_options=["1m", "5m", "15m", "1h", "4h"],
            default_params={"take_profit": 0.2, "atr_multiplier": 2},
        ),
        StrategyInfo(
            id="consolidation_pop",
            name="Consolidation Pop",
            description="Range trading - buy low 1/3 of consolidation",
            timeframe_options=["1m", "3m", "5m", "15m", "1h"],
            default_params={
                "take_profit": 0.3,
                "stop_loss": 0.25,
                "consolidation_bars": 10,
            },
        ),
        StrategyInfo(
            id="nadarya_watson",
            name="Nadarya-Watson",
            description="Stoch RSI + Nadarya signals for high-probability entries",
            timeframe_options=["1h", "4h", "1d"],
            default_params={"rsi_window": 14, "oversold": 10, "overbought": 90},
        ),
        StrategyInfo(
            id="correlation",
            name="Correlation Arbitrage",
            description="Cross-asset correlation statistical arbitrage",
            timeframe_options=["5m", "15m", "1h"],
            default_params={"correlation_threshold": 0.8, "lookback": 100},
        ),
        StrategyInfo(
            id="market_maker",
            name="Market Maker",
            description="Order book microstructure spread capture",
            timeframe_options=["1m", "5m"],
            default_params={"spread_target": 0.1, "max_position": 1000},
        ),
        StrategyInfo(
            id="mean_reversion",
            name="Mean Reversion",
            description="74-ticker universe oversold bounce strategy",
            timeframe_options=["15m", "1h", "4h"],
            default_params={"zscore_threshold": -2.0, "lookback": 50},
        ),
        StrategyInfo(
            id="solana_sniper",
            name="Solana Sniper",
            description="New token launch sniper with anti-rug security filters",
            timeframe_options=["1m", "5m", "15m"],
            default_params={
                "hours_to_look": 0.2,
                "max_market_cap": 30000,
                "max_top10_percent": 0.7,
                "min_liquidity": 400,
                "min_trades_1h": 9,
                "min_unique_wallets": 30,
            },
        ),
        StrategyInfo(
            id="arbitrage",
            name="High-Frequency Arbitrage",
            description="Triangular and statistical arbitrage with sub-100ms execution",
            timeframe_options=["1s", "5s", "15s", "1m"],
            default_params={
                "min_profit_pct": 0.1,
                "max_slippage": 0.05,
                "base_size": 1000,
            },
        ),
    ]


@app.post("/strategy/start")
async def start_strategy(request: TradingRequest):
    """Start a trading strategy"""
    try:
        client = HyperliquidClient(
            wallet_address=request.api_key,
            private_key=request.api_secret,
            sandbox=request.sandbox,
        )

        config = StrategyConfig(
            strategy_id=request.strategy_id,
            symbol=request.symbol,
            size=Decimal(str(request.size)),
            timeframe=request.timeframe,
            take_profit=request.take_profit,
            stop_loss=request.stop_loss,
        )

        adapter_class = get_strategy_adapter(request.strategy_id)
        adapter = adapter_class(client, config)

        strategy_key = f"{request.strategy_id}_{request.symbol}_{request.api_key[:8]}"
        active_strategies[strategy_key] = adapter

        asyncio.create_task(adapter.run())

        return {
            "status": "started",
            "strategy_key": strategy_key,
            "message": f"Strategy {request.strategy_id} started on {request.symbol}",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/strategy/stop/{strategy_key}")
async def stop_strategy(strategy_key: str):
    """Stop a running strategy"""
    if strategy_key not in active_strategies:
        raise HTTPException(status_code=404, detail="Strategy not found")

    adapter = active_strategies[strategy_key]
    await adapter.stop()
    del active_strategies[strategy_key]

    return {"status": "stopped", "strategy_key": strategy_key}


@app.get("/portfolio/{wallet_address}")
async def get_portfolio(wallet_address: str, api_secret: str, sandbox: bool = True):
    """Get current portfolio state"""
    try:
        client = HyperliquidClient(
            wallet_address=wallet_address, private_key=api_secret, sandbox=sandbox
        )

        positions = await client.get_positions()
        account = await client.get_account_info()

        return {
            "wallet": wallet_address,
            "account_value": float(account["account_value"]),
            "available_balance": float(account["available_balance"]),
            "positions": [
                {
                    "symbol": p.symbol,
                    "size": float(p.size),
                    "side": p.side,
                    "entry_price": float(p.entry_price),
                    "mark_price": float(p.mark_price),
                    "unrealized_pnl": float(p.unrealized_pnl),
                    "leverage": float(p.leverage),
                }
                for p in positions
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/kill-switch")
async def kill_switch(
    wallet_address: str,
    api_secret: str,
    symbol: Optional[str] = None,
    sandbox: bool = True,
):
    """Emergency kill switch - close all positions"""
    try:
        client = HyperliquidClient(
            wallet_address=wallet_address, private_key=api_secret, sandbox=sandbox
        )

        result = await client.kill_switch(symbol)

        for key, adapter in list(active_strategies.items()):
            if wallet_address[:8] in key:
                await adapter.stop()
                del active_strategies[key]

        return {"status": "kill_switch_activated", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.websocket("/ws/trades")
async def websocket_trades(websocket: WebSocket):
    """WebSocket for real-time trade updates"""
    await websocket.accept()
    connected_clients.append(websocket)

    try:
        while True:
            for strategy_key, adapter in active_strategies.items():
                updates = adapter.get_updates()
                if updates:
                    await websocket.send_json(
                        {
                            "timestamp": datetime.utcnow().isoformat(),
                            "strategy": strategy_key,
                            "updates": updates,
                        }
                    )
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        connected_clients.remove(websocket)


def get_strategy_adapter(strategy_id: str):
    """Get the strategy adapter class by ID"""
    from src.strategies.adapters.turtle import TurtleAdapter
    from src.strategies.adapters.consolidation import ConsolidationAdapter
    from src.strategies.adapters.nadarya import NadaryaAdapter
    from src.strategies.adapters.correlation import CorrelationAdapter
    from src.strategies.adapters.market_maker import MarketMakerAdapter
    from src.strategies.adapters.mean_reversion import MeanReversionAdapter
    from src.strategies.adapters.solana_sniper import SolanaSniperAdapter
    from src.strategies.adapters.arbitrage import ArbitrageAdapter

    adapters = {
        "turtle_trending": TurtleAdapter,
        "consolidation_pop": ConsolidationAdapter,
        "nadarya_watson": NadaryaAdapter,
        "correlation": CorrelationAdapter,
        "market_maker": MarketMakerAdapter,
        "mean_reversion": MeanReversionAdapter,
        "solana_sniper": SolanaSniperAdapter,
        "arbitrage": ArbitrageAdapter,
    }

    if strategy_id not in adapters:
        raise ValueError(f"Unknown strategy: {strategy_id}")

    return adapters[strategy_id]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
