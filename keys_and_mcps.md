# Open AlgoTrade - Keys & MCP Configuration

> **⚠️ SECURITY WARNING:** This file contains SENSITIVE CREDENTIALS.
> DO NOT commit this file to public repositories if you fill in real values.
> This file is intended for local configuration management.

## 🔐 Secrets & API Keys (Fill these in locally)

```bash
# --- Application Security ---
NEXT_PUBLIC_APP_NAME="Open AlgoTrade"
JWT_SECRET="<generate-secure-random-string>"
ENCRYPTION_KEY="<32-char-aes-key>"

# --- Exchange Keys (Required for Trading) ---
# Hyperliquid
HYPERLIQUID_API_KEY=""
HYPERLIQUID_SECRET_KEY=""
HYPERLIQUID_ADDRESS=""

# Binance (Optional)
BINANCE_API_KEY=""
BINANCE_SECRET_KEY=""

# --- AI & Intelligence ---
CLAUDE_CODE_OAUTH_TOKEN=""
ANTHROPIC_API_KEY=""

# --- Infrastructure ---
SLACK_WEBHOOK_URL=""
ALERT_EMAIL=""
DB_PASSWORD=""
```

## 🔌 MCP Servers (Model Context Protocol)

Configuration for connecting AI agents to external tools.

```json
{
  "mcpServers": {
    "claude-flow": {
      "command": "npx",
      "args": ["claude-flow@alpha", "mcp", "start"]
    },
    "flow-nexus": {
      "command": "npx",
      "args": ["flow-nexus@latest", "mcp", "start"]
    },
    "sqlite": {
      "command": "uvx",
      "args": ["mcp-server-sqlite", "--db-path", "kairos_trading.db"]
    }
  }
}
```

## 🛠️ Setup Instructions

1. **Copy Secrets**: Copy the values above into your `.env` file (do not commit `.env`).
2. **Install MCPs**: Run the commands in the `mcpServers` section to verify connectivity.
3. **Rotate Keys**: If you suspect a leak, rotate keys immediately using the dashboard.
