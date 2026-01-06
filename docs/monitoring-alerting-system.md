# Real-Time Monitoring and Alerting System

## Overview

A comprehensive monitoring and alerting system that provides real-time visibility into trading operations, system health, and performance metrics. Designed for immediate issue detection and rapid response capabilities.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Alert Gateway                                       │
│                   (Centralized alert routing and filtering)                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Monitoring Layer                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Trading   │ │   System    │ │Performance  │ │   Security  │ │   Business  ││
│  │  Metrics    │ │   Health    ││   Metrics    │ │  Alerts     │ │  Metrics    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             Data Collection                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │Prometheus   │ │   Metrics   │ │   Logs      │ │   Traces    │ │   Events    ││
│  │   Server    │ │  Collectors ││  Aggregator ││  Collector  ││  Stream     ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Alert Channels                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Discord   │ │   Telegram  │ │   Email     │ │    SMS      │ │  Dashboard  ││
│  │  Webhook    │ │    Bot      │ │   Alerts    │ │  Alerts     │ │  Alerts     ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Core Monitoring Components

### Trading Metrics Monitor
```python
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

class AlertSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

@dataclass
class Alert:
    id: str
    timestamp: datetime
    severity: AlertSeverity
    category: str
    message: str
    metrics: Dict[str, float]
    action_required: bool
    acknowledged: bool = False
    resolved: bool = False

@dataclass
class TradingMetrics:
    timestamp: datetime
    total_pnl: float
    daily_pnl: float
    open_positions: int
    total_volume: float
    win_rate: float
    sharpe_ratio: float
    max_drawdown: float
    latency_ms: float
    error_rate: float

class TradingMonitor:
    def __init__(self, alert_manager):
        self.alert_manager = alert_manager
        self.metrics_history = []
        self.thresholds = {
            'daily_loss': -0.05,      # -5% daily loss
            'max_drawdown': 0.15,     # 15% max drawdown
            'latency': 500,           # 500ms max latency
            'error_rate': 0.05,       # 5% max error rate
            'position_timeout': 3600, # 1 hour position timeout
            'min_win_rate': 0.40      # 40% minimum win rate
        }

    async def collect_metrics(self, portfolio_data: Dict, system_data: Dict) -> TradingMetrics:
        """Collect and process trading metrics"""

        metrics = TradingMetrics(
            timestamp=datetime.now(),
            total_pnl=portfolio_data.get('total_pnl', 0.0),
            daily_pnl=portfolio_data.get('daily_pnl', 0.0),
            open_positions=len(portfolio_data.get('positions', [])),
            total_volume=portfolio_data.get('daily_volume', 0.0),
            win_rate=portfolio_data.get('win_rate', 0.0),
            sharpe_ratio=portfolio_data.get('sharpe_ratio', 0.0),
            max_drawdown=portfolio_data.get('max_drawdown', 0.0),
            latency_ms=system_data.get('avg_latency', 0.0),
            error_rate=system_data.get('error_rate', 0.0)
        )

        self.metrics_history.append(metrics)
        await self._check_thresholds(metrics)

        return metrics

    async def _check_thresholds(self, metrics: TradingMetrics):
        """Check metrics against thresholds and generate alerts"""

        alerts = []

        # Daily loss check
        if metrics.daily_pnl < self.thresholds['daily_loss']:
            alerts.append(Alert(
                id=f"daily_loss_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                severity=AlertSeverity.ERROR,
                category="trading",
                message=f"Daily loss of {metrics.daily_pnl:.2%} exceeds threshold",
                metrics={'daily_pnl': metrics.daily_pnl},
                action_required=True
            ))

        # Max drawdown check
        if metrics.max_drawdown > self.thresholds['max_drawdown']:
            alerts.append(Alert(
                id=f"drawdown_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                severity=AlertSeverity.CRITICAL,
                category="risk",
                message=f"Max drawdown of {metrics.max_drawdown:.2%} exceeds threshold",
                metrics={'max_drawdown': metrics.max_drawdown},
                action_required=True
            ))

        # Latency check
        if metrics.latency_ms > self.thresholds['latency']:
            alerts.append(Alert(
                id=f"latency_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                severity=AlertSeverity.WARNING,
                category="performance",
                message=f"Average latency of {metrics.latency_ms}ms exceeds threshold",
                metrics={'latency_ms': metrics.latency_ms},
                action_required=True
            ))

        # Error rate check
        if metrics.error_rate > self.thresholds['error_rate']:
            alerts.append(Alert(
                id=f"error_rate_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                severity=AlertSeverity.ERROR,
                category="system",
                message=f"Error rate of {metrics.error_rate:.2%} exceeds threshold",
                metrics={'error_rate': metrics.error_rate},
                action_required=True
            ))

        # Win rate check
        if metrics.win_rate < self.thresholds['min_win_rate'] and metrics.open_positions > 10:
            alerts.append(Alert(
                id=f"win_rate_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                severity=AlertSeverity.WARNING,
                category="performance",
                message=f"Win rate of {metrics.win_rate:.2%} below threshold",
                metrics={'win_rate': metrics.win_rate, 'positions': metrics.open_positions},
                action_required=False
            ))

        # Send alerts
        for alert in alerts:
            await self.alert_manager.send_alert(alert)
```

### System Health Monitor
```python
import psutil
import aiohttp
from typing import Dict, List

class SystemMonitor:
    def __init__(self, alert_manager):
        self.alert_manager = alert_manager
        self.component_status = {}
        self.last_check = {}

    async def check_system_health(self) -> Dict:
        """Comprehensive system health check"""

        health_status = {
            'timestamp': datetime.now(),
            'overall_status': 'healthy',
            'components': {}
        }

        # CPU and Memory
        health_status['components']['system_resources'] = await self._check_system_resources()

        # Database connectivity
        health_status['components']['database'] = await self._check_database_connectivity()

        # Exchange APIs
        health_status['components']['exchanges'] = await self._check_exchange_connectivity()

        # WebSocket connections
        health_status['components']['websockets'] = await self._check_websocket_connections()

        # Strategy processes
        health_status['components']['strategies'] = await self._check_strategy_processes()

        # Determine overall status
        failed_components = [name for name, status in health_status['components'].items()
                           if status['status'] != 'healthy']

        if failed_components:
            if len(failed_components) == 1:
                health_status['overall_status'] = 'degraded'
            else:
                health_status['overall_status'] = 'unhealthy'

            await self._generate_health_alerts(failed_components)

        return health_status

    async def _check_system_resources(self) -> Dict:
        """Check CPU, memory, disk usage"""
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        status = 'healthy'
        issues = []

        if cpu_percent > 90:
            status = 'critical'
            issues.append(f"High CPU usage: {cpu_percent}%")
        elif cpu_percent > 75:
            status = 'warning'
            issues.append(f"Elevated CPU usage: {cpu_percent}%")

        if memory.percent > 90:
            status = 'critical'
            issues.append(f"High memory usage: {memory.percent}%")
        elif memory.percent > 75:
            status = 'warning'
            issues.append(f"Elevated memory usage: {memory.percent}%")

        if disk.percent > 90:
            status = 'critical'
            issues.append(f"High disk usage: {disk.percent}%")
        elif disk.percent > 80:
            status = 'warning'
            issues.append(f"Elevated disk usage: {disk.percent}%")

        return {
            'status': status,
            'cpu_percent': cpu_percent,
            'memory_percent': memory.percent,
            'disk_percent': disk.percent,
            'issues': issues
        }

    async def _check_database_connectivity(self) -> Dict:
        """Check database connectivity and performance"""
        try:
            # Database health check query
            start_time = datetime.now()

            # Simulated database check - replace with actual DB connection
            await asyncio.sleep(0.01)  # Simulate query
            query_time = (datetime.now() - start_time).total_seconds() * 1000

            if query_time > 1000:  # 1 second
                status = 'warning'
                issues = [f"Slow database response: {query_time:.2f}ms"]
            else:
                status = 'healthy'
                issues = []

            return {
                'status': status,
                'response_time_ms': query_time,
                'issues': issues
            }

        except Exception as e:
            return {
                'status': 'critical',
                'response_time_ms': 0,
                'issues': [f"Database connection failed: {str(e)}"]
            }

    async def _check_exchange_connectivity(self) -> Dict:
        """Check connectivity to all exchanges"""
        exchanges = ['hyperliquid', 'phemex', 'binance']
        results = {}

        for exchange in exchanges:
            try:
                start_time = datetime.now()

                # Simulate exchange API ping
                await asyncio.sleep(0.05)  # Simulate network latency
                response_time = (datetime.now() - start_time).total_seconds() * 1000

                if response_time > 5000:  # 5 seconds
                    status = 'warning'
                elif response_time > 10000:  # 10 seconds
                    status = 'critical'
                else:
                    status = 'healthy'

                results[exchange] = {
                    'status': status,
                    'response_time_ms': response_time
                }

            except Exception as e:
                results[exchange] = {
                    'status': 'critical',
                    'response_time_ms': 0,
                    'error': str(e)
                }

        overall_status = 'healthy'
        failed_exchanges = [ex for ex, data in results.items() if data['status'] == 'critical']

        if failed_exchanges:
            if len(failed_exchanges) == 1:
                overall_status = 'degraded'
            else:
                overall_status = 'critical'

        return {
            'status': overall_status,
            'exchanges': results,
            'failed_count': len(failed_exchanges)
        }

    async def _generate_health_alerts(self, failed_components: List[str]):
        """Generate alerts for failed health checks"""
        for component in failed_components:
            alert = Alert(
                id=f"health_{component}_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                severity=AlertSeverity.ERROR,
                category="system_health",
                message=f"System health check failed for component: {component}",
                metrics={'component': component},
                action_required=True
            )
            await self.alert_manager.send_alert(alert)
```

### Alert Manager
```python
import aiohttp
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
from typing import Dict, List

class AlertManager:
    def __init__(self, config: Dict):
        self.config = config
        self.alert_history = []
        self.rate_limiter = {}  # Prevent alert spamming
        self.channels = {
            'discord': DiscordAlertChannel(config['discord']),
            'telegram': TelegramAlertChannel(config['telegram']),
            'email': EmailAlertChannel(config['email']),
            'dashboard': DashboardAlertChannel()
        }

    async def send_alert(self, alert: Alert):
        """Send alert through appropriate channels"""

        # Check rate limiting
        if await self._is_rate_limited(alert):
            return

        # Log alert
        self.alert_history.append(alert)

        # Send to channels based on severity and category
        channels_to_use = self._determine_channels(alert)

        for channel_name in channels_to_use:
            if channel_name in self.channels:
                try:
                    await self.channels[channel_name].send_alert(alert)
                except Exception as e:
                    print(f"Failed to send alert to {channel_name}: {e}")

    def _determine_channels(self, alert: Alert) -> List[str]:
        """Determine which channels to use based on alert severity and category"""
        channels = ['dashboard']  # Always send to dashboard

        if alert.severity == AlertSeverity.CRITICAL:
            channels.extend(['discord', 'telegram', 'email'])
        elif alert.severity == AlertSeverity.ERROR:
            channels.extend(['discord', 'telegram'])
        elif alert.severity == AlertSeverity.WARNING:
            channels.extend(['discord'])

        return channels

    async def _is_rate_limited(self, alert: Alert) -> bool:
        """Check if alert should be rate limited"""
        key = f"{alert.category}_{alert.severity.value}"
        now = datetime.now()

        if key not in self.rate_limiter:
            self.rate_limiter[key] = now
            return False

        # Rate limit: max 1 alert per 5 minutes for same category/severity
        if (now - self.rate_limiter[key]).total_seconds() < 300:
            return True

        self.rate_limiter[key] = now
        return False

class DiscordAlertChannel:
    def __init__(self, config: Dict):
        self.webhook_url = config['webhook_url']
        self.channel_mappings = config.get('channel_mappings', {})

    async def send_alert(self, alert: Alert):
        """Send alert to Discord"""

        # Determine Discord channel
        channel = self.channel_mappings.get(alert.category, 'alerts')

        # Format message
        color = self._get_discord_color(alert.severity)
        embed = {
            "title": f"🚨 {alert.severity.value.upper()} Alert",
            "description": alert.message,
            "color": color,
            "fields": [
                {"name": "Category", "value": alert.category, "inline": True},
                {"name": "Time", "value": alert.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"), "inline": True},
                {"name": "Action Required", "value": "Yes" if alert.action_required else "No", "inline": True}
            ],
            "footer": {"text": f"Alert ID: {alert.id}"}
        }

        if alert.metrics:
            for key, value in alert.metrics.items():
                embed["fields"].append({
                    "name": key.replace('_', ' ').title(),
                    "value": str(value),
                    "inline": True
                })

        payload = {
            "content": f"Alert in #{channel}",
            "embeds": [embed]
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(self.webhook_url, json=payload) as response:
                if response.status != 204:
                    raise Exception(f"Discord webhook failed: {response.status}")

    def _get_discord_color(self, severity: AlertSeverity) -> int:
        """Get Discord color for alert severity"""
        colors = {
            AlertSeverity.INFO: 0x3498db,      # Blue
            AlertSeverity.WARNING: 0xf39c12,   # Yellow
            AlertSeverity.ERROR: 0xe74c3c,     # Red
            AlertSeverity.CRITICAL: 0x8b0000   # Dark Red
        }
        return colors.get(severity, 0x3498db)

class TelegramAlertChannel:
    def __init__(self, config: Dict):
        self.bot_token = config['bot_token']
        self.chat_id = config['chat_id']

    async def send_alert(self, alert: Alert):
        """Send alert to Telegram"""

        # Format message
        emoji = self._get_emoji(alert.severity)
        message = f"{emoji} *{alert.severity.value.upper()} Alert*\n\n"
        message += f"**Category:** {alert.category}\n"
        message += f"**Message:** {alert.message}\n"
        message += f"**Time:** {alert.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}\n"

        if alert.action_required:
            message += "⚠️ *Action Required*\n"

        if alert.metrics:
            message += "\n**Metrics:**\n"
            for key, value in alert.metrics.items():
                message += f"• {key.replace('_', ' ').title()}: {value}\n"

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": message,
            "parse_mode": "Markdown",
            "disable_web_page_preview": True
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                if response.status != 200:
                    raise Exception(f"Telegram bot failed: {response.status}")

    def _get_emoji(self, severity: AlertSeverity) -> str:
        """Get emoji for alert severity"""
        emojis = {
            AlertSeverity.INFO: "ℹ️",
            AlertSeverity.WARNING: "⚠️",
            AlertSeverity.ERROR: "❌",
            AlertSeverity.CRITICAL: "🚨"
        }
        return emojis.get(severity, "ℹ️")
```

### Real-Time Dashboard
```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import json

class DashboardServer:
    def __init__(self):
        self.app = FastAPI()
        self.active_connections = []
        self._setup_routes()

    def _setup_routes(self):
        @self.app.get("/", response_class=HTMLResponse)
        async def get_dashboard():
            return self._get_dashboard_html()

        @self.app.websocket("/ws")
        async def websocket_endpoint(websocket: WebSocket):
            await websocket.accept()
            self.active_connections.append(websocket)
            try:
                while True:
                    await websocket.receive_text()  # Keep connection alive
            except WebSocketDisconnect:
                self.active_connections.remove(websocket)

    async def broadcast_update(self, data: Dict):
        """Broadcast update to all connected dashboard clients"""
        message = json.dumps(data)
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                disconnected.append(connection)

        for connection in disconnected:
            self.active_connections.remove(connection)

    def _get_dashboard_html(self) -> str:
        """Return dashboard HTML"""
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>MoonDev Trading Dashboard</title>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a1a; color: white; }
                .dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .card { background: #2a2a2a; padding: 20px; border-radius: 8px; }
                .metric { display: flex; justify-content: space-between; margin: 10px 0; }
                .alert { padding: 10px; margin: 5px 0; border-radius: 4px; }
                .alert.critical { background: #e74c3c; }
                .alert.error { background: #c0392b; }
                .alert.warning { background: #f39c12; }
                .alert.info { background: #3498db; }
            </style>
        </head>
        <body>
            <h1>🚀 MoonDev Trading Dashboard</h1>
            <div class="dashboard">
                <div class="card">
                    <h2>Portfolio Metrics</h2>
                    <div id="portfolio-metrics"></div>
                </div>
                <div class="card">
                    <h2>System Health</h2>
                    <div id="system-health"></div>
                </div>
                <div class="card">
                    <h2>Active Alerts</h2>
                    <div id="alerts"></div>
                </div>
                <div class="card">
                    <h2>Performance Chart</h2>
                    <canvas id="performance-chart"></canvas>
                </div>
            </div>

            <script>
                const ws = new WebSocket('ws://localhost:8000/ws');
                const performanceChart = new Chart(document.getElementById('performance-chart'), {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: 'Portfolio Value',
                            data: [],
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52, 152, 219, 0.1)'
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: { beginAtZero: false }
                        }
                    }
                });

                ws.onmessage = function(event) {
                    const data = JSON.parse(event.data);

                    if (data.type === 'metrics') {
                        updatePortfolioMetrics(data.metrics);
                        updatePerformanceChart(data.metrics);
                    } else if (data.type === 'health') {
                        updateSystemHealth(data.health);
                    } else if (data.type === 'alert') {
                        addAlert(data.alert);
                    }
                };

                function updatePortfolioMetrics(metrics) {
                    document.getElementById('portfolio-metrics').innerHTML = `
                        <div class="metric"><span>Total PnL:</span><span style="color: ${metrics.total_pnl >= 0 ? '#2ecc71' : '#e74c3c'}">$${metrics.total_pnl.toFixed(2)}</span></div>
                        <div class="metric"><span>Daily PnL:</span><span style="color: ${metrics.daily_pnl >= 0 ? '#2ecc71' : '#e74c3c'}">$${metrics.daily_pnl.toFixed(2)}</span></div>
                        <div class="metric"><span>Win Rate:</span><span>${(metrics.win_rate * 100).toFixed(1)}%</span></div>
                        <div class="metric"><span>Sharpe Ratio:</span><span>${metrics.sharpe_ratio.toFixed(2)}</span></div>
                        <div class="metric"><span>Max Drawdown:</span><span style="color: '#e74c3c'}">${(metrics.max_drawdown * 100).toFixed(1)}%</span></div>
                        <div class="metric"><span>Open Positions:</span><span>${metrics.open_positions}</span></div>
                    `;
                }

                function updateSystemHealth(health) {
                    const statusColor = health.overall_status === 'healthy' ? '#2ecc71' :
                                      health.overall_status === 'degraded' ? '#f39c12' : '#e74c3c';

                    document.getElementById('system-health').innerHTML = `
                        <div class="metric"><span>System Status:</span><span style="color: ${statusColor}">${health.overall_status.toUpperCase()}</span></div>
                    `;
                }

                function addAlert(alert) {
                    const alertsDiv = document.getElementById('alerts');
                    const alertDiv = document.createElement('div');
                    alertDiv.className = `alert ${alert.severity}`;
                    alertDiv.innerHTML = `
                        <strong>${alert.category.toUpperCase()}</strong><br>
                        ${alert.message}<br>
                        <small>${alert.timestamp}</small>
                    `;
                    alertsDiv.insertBefore(alertDiv, alertsDiv.firstChild);

                    // Keep only last 10 alerts
                    while (alertsDiv.children.length > 10) {
                        alertsDiv.removeChild(alertsDiv.lastChild);
                    }
                }

                function updatePerformanceChart(metrics) {
                    const now = new Date().toLocaleTimeString();
                    performanceChart.data.labels.push(now);
                    performanceChart.data.datasets[0].data.push(metrics.total_pnl);

                    // Keep only last 20 data points
                    if (performanceChart.data.labels.length > 20) {
                        performanceChart.data.labels.shift();
                        performanceChart.data.datasets[0].data.shift();
                    }

                    performanceChart.update();
                }
            </script>
        </body>
        </html>
        """
```

This monitoring and alerting system provides comprehensive real-time visibility into all aspects of the trading operation, enabling rapid detection and response to issues while maintaining a clear view of system performance and trading metrics.