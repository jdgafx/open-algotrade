"""
Alert System for Trading Engine
Real-time notifications for critical events and performance updates
"""

import asyncio
import logging
from typing import Optional, Dict, Any
from datetime import datetime
import aiohttp
import json
from enum import Enum

logger = logging.getLogger(__name__)

class AlertLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

class AlertSystem:
    """
    Advanced alert system with multiple notification channels
    Features:
    - Discord webhook notifications
    - Email alerts (optional)
    - Customizable alert levels
    - Rate limiting to prevent spam
    - Alert history tracking
    """

    def __init__(self,
                 discord_webhook_url: Optional[str] = None,
                 email_enabled: bool = False,
                 email_address: Optional[str] = None):
        self.discord_webhook_url = discord_webhook_url
        self.email_enabled = email_enabled
        self.email_address = email_address

        # Alert history and rate limiting
        self.alert_history: list = []
        self.last_alerts: Dict[str, float] = {}  # For rate limiting
        self.rate_limit_minutes = 5  # Minimum time between similar alerts

        logger.info("Alert System initialized")

    async def send_alert(self, title: str, message: str, level: AlertLevel = AlertLevel.INFO,
                        symbol: Optional[str] = None, strategy: Optional[str] = None):
        """Send alert through all configured channels"""
        try:
            # Check rate limiting
            alert_key = f"{title}_{symbol}_{strategy}" if symbol or strategy else title
            current_time = datetime.now().timestamp()

            if alert_key in self.last_alerts:
                time_since_last = current_time - self.last_alerts[alert_key]
                if time_since_last < self.rate_limit_minutes * 60:
                    logger.debug(f"Alert rate limited: {title}")
                    return

            # Update rate limiting
            self.last_alerts[alert_key] = current_time

            # Create alert data
            alert_data = {
                "title": title,
                "message": message,
                "level": level.value,
                "timestamp": datetime.now().isoformat(),
                "symbol": symbol,
                "strategy": strategy
            }

            # Add to history
            self.alert_history.append(alert_data)
            if len(self.alert_history) > 1000:
                self.alert_history = self.alert_history[-1000:]

            # Send to Discord
            if self.discord_webhook_url:
                await self._send_discord_alert(alert_data)

            # Send email (if configured)
            if self.email_enabled and self.email_address:
                await self._send_email_alert(alert_data)

            # Log alert
            logger.info(f"🚨 ALERT [{level.value.upper()}] {title}: {message}")

        except Exception as e:
            logger.error(f"Error sending alert: {e}")

    async def send_pnl_alert(self, pnl_amount: float, symbol: Optional[str] = None):
        """Send PnL alert"""
        try:
            if pnl_amount > 0:
                title = "Profit Alert"
                message = f"Profit of ${pnl_amount:.2f} realized"
                level = AlertLevel.INFO
            else:
                title = "Loss Alert"
                message = f"Loss of ${abs(pnl_amount):.2f} realized"
                level = AlertLevel.WARNING if abs(pnl_amount) < 1000 else AlertLevel.CRITICAL

            await self.send_alert(title, message, level, symbol)

        except Exception as e:
            logger.error(f"Error sending PnL alert: {e}")

    async def send_position_alert(self, action: str, symbol: str, size: float, price: float, strategy: Optional[str] = None):
        """Send position opening/closing alert"""
        try:
            title = f"Position {action.title()}"
            message = f"{action.title()} {size:.2f} {symbol} at ${price:.2f}"
            level = AlertLevel.INFO

            await self.send_alert(title, message, level, symbol, strategy)

        except Exception as e:
            logger.error(f"Error sending position alert: {e}")

    async def send_risk_alert(self, risk_type: str, current_value: float, threshold: float):
        """Send risk management alert"""
        try:
            title = f"Risk Alert: {risk_type}"
            message = f"{risk_type}: {current_value:.2f} (threshold: {threshold:.2f})"
            level = AlertLevel.CRITICAL

            await self.send_alert(title, message, level)

        except Exception as e:
            logger.error(f"Error sending risk alert: {e}")

    async def send_system_alert(self, message: str, level: AlertLevel = AlertLevel.WARNING):
        """Send system-level alert"""
        try:
            title = "System Alert"
            await self.send_alert(title, message, level)

        except Exception as e:
            logger.error(f"Error sending system alert: {e}")

    async def _send_discord_alert(self, alert_data: Dict[str, Any]):
        """Send alert to Discord via webhook"""
        try:
            if not self.discord_webhook_url:
                return

            # Choose color based on alert level
            colors = {
                "info": 0x00ff00,      # Green
                "warning": 0xffff00,   # Yellow
                "critical": 0xff0000   # Red
            }
            color = colors.get(alert_data["level"], 0x00ff00)

            # Create Discord embed
            embed = {
                "title": alert_data["title"],
                "description": alert_data["message"],
                "color": color,
                "timestamp": alert_data["timestamp"],
                "fields": []
            }

            # Add additional fields
            if alert_data.get("symbol"):
                embed["fields"].append({
                    "name": "Symbol",
                    "value": alert_data["symbol"],
                    "inline": True
                })

            if alert_data.get("strategy"):
                embed["fields"].append({
                    "name": "Strategy",
                    "value": alert_data["strategy"],
                    "inline": True
                })

            # Prepare webhook payload
            payload = {
                "embeds": [embed],
                "username": "Trading Bot Alerts"
            }

            # Send webhook
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.discord_webhook_url,
                    json=payload,
                    timeout=10
                ) as response:
                    if response.status == 204:
                        logger.debug("Discord alert sent successfully")
                    else:
                        logger.warning(f"Discord webhook failed: {response.status}")

        except Exception as e:
            logger.error(f"Error sending Discord alert: {e}")

    async def _send_email_alert(self, alert_data: Dict[str, Any]):
        """Send email alert (placeholder - would need email service integration)"""
        try:
            if not self.email_enabled or not self.email_address:
                return

            # This is a placeholder for email integration
            # In practice, you would integrate with services like:
            # - SendGrid
            - AWS SES
            - SMTP server
            # Or use a service like Resend, Mailgun, etc.

            logger.info(f"Email alert would be sent to {self.email_address}: {alert_data['title']}")

        except Exception as e:
            logger.error(f"Error sending email alert: {e}")

    async def send_daily_summary(self, performance_metrics: Dict[str, Any]):
        """Send daily performance summary"""
        try:
            title = "Daily Trading Summary"

            # Create summary message
            message = f"""
**Daily Performance Summary**

Total PnL: ${performance_metrics.get('daily_pnl', 0):.2f}
Win Rate: {performance_metrics.get('win_rate', 0):.1f}%
Total Trades: {performance_metrics.get('total_trades', 0)}
Active Positions: {performance_metrics.get('active_positions', 0)}
Max Drawdown: {performance_metrics.get('max_drawdown', 0):.2%}

*Report generated at {datetime.now().strftime('%H:%M:%S')}*
            """

            await self.send_alert(title, message, AlertLevel.INFO)

        except Exception as e:
            logger.error(f"Error sending daily summary: {e}")

    async def send_strategy_status(self, strategy_name: str, status: str, details: Optional[str] = None):
        """Send strategy status update"""
        try:
            title = f"Strategy Status: {strategy_name}"
            message = status
            if details:
                message += f"\n\nDetails: {details}"

            level = AlertLevel.INFO
            if "error" in status.lower() or "failed" in status.lower():
                level = AlertLevel.WARNING
            elif "stopped" in status.lower() or "emergency" in status.lower():
                level = AlertLevel.CRITICAL

            await self.send_alert(title, message, level, strategy=strategy_name)

        except Exception as e:
            logger.error(f"Error sending strategy status: {e}")

    async def get_alert_history(self, limit: int = 100) -> list:
        """Get recent alert history"""
        return self.alert_history[-limit:] if self.alert_history else []

    async def get_alert_stats(self) -> Dict[str, Any]:
        """Get alert statistics"""
        try:
            if not self.alert_history:
                return {}

            # Count by level
            level_counts = {}
            for alert in self.alert_history:
                level = alert.get("level", "info")
                level_counts[level] = level_counts.get(level, 0) + 1

            # Count by time period
            now = datetime.now().timestamp()
            last_hour = sum(1 for alert in self.alert_history if now - alert.get("timestamp", 0) < 3600)
            last_day = sum(1 for alert in self.alert_history if now - alert.get("timestamp", 0) < 86400)

            return {
                "total_alerts": len(self.alert_history),
                "alerts_last_hour": last_hour,
                "alerts_last_day": last_day,
                "alerts_by_level": level_counts
            }

        except Exception as e:
            logger.error(f"Error getting alert stats: {e}")
            return {}

    async def clear_alert_history(self):
        """Clear alert history"""
        self.alert_history.clear()
        self.last_alerts.clear()
        logger.info("Alert history cleared")

    async def test_alerts(self):
        """Test alert system by sending test alerts"""
        try:
            logger.info("Testing alert system...")

            await self.send_alert(
                "Test Alert - Info",
                "This is a test info alert",
                AlertLevel.INFO
            )

            await self.send_alert(
                "Test Alert - Warning",
                "This is a test warning alert",
                AlertLevel.WARNING
            )

            await self.send_pnl_alert(150.50, "BTC")

            await self.send_position_alert("OPENED", "ETH", 1.5, 2500.25, "Market Maker")

            logger.info("✅ Alert system test completed")

        except Exception as e:
            logger.error(f"Error testing alert system: {e}")