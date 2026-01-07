#!/bin/bash
set -e

echo -e "\033[0;34m🌑 MOONDEV: Initializing System...\033[0m"

echo -e "\n\033[0;36m[1/3] Setting up Trading Engine (Python)...\033[0m"
if [ ! -d "trading_env" ]; then
    python3 -m venv trading_env
    echo "    Created virtual environment."
fi

source trading_env/bin/activate
pip install --upgrade pip
pip install pandas numpy aiohttp websockets eth-account eth_utils msgpack hexbytes hyperliquid-python-sdk ccxt schedule requests colorama termcolor
echo "    Python dependencies installed."

echo -e "\n\033[0;36m[2/3] Setting up KAIROS Neural Center (Graph DB)...\033[0m"
mkdir -p data/memory
# Initialize the graph DB by running a python one-liner using the new module
python3 -c "from src.brain.knowledge_graph import KnowledgeGraph; KnowledgeGraph()"
echo "    Knowledge Graph initialized."

echo -e "\n\033[0;36m[3/3] Setting up Command Center (UI)...\033[0m"
if [ -d "src/ui" ]; then
    cd src/ui
    if [ ! -d "node_modules" ]; then
        echo "    Installing UI dependencies (this may take a minute)..."
        npm install
    else
        echo "    UI dependencies already installed."
    fi
    cd ../..
else
    echo "    ⚠️ UI directory not found! Skipping."
fi

echo -e "\n\033[0;36m[3/3] Finalizing...\033[0m"
chmod +x scripts/*.sh
chmod +x start.sh 2>/dev/null || true

echo -e "\n\033[0;32m✅ MOONDEV SYSTEM READY.\033[0m"
echo "Run './start.sh' to begin."
