#!/bin/bash
echo -e "\033[0;34m🌑 MOONDEV: Launching Trading Engine...\033[0m"

if [ -d "trading_env" ]; then
    source trading_env/bin/activate
else
    echo "⚠️ Virtual environment not found. Run scripts/1_install.sh first."
    exit 1
fi

echo "Select Mode:"
echo "1) 🧪 Sandbox Test (Safe)"
echo "2) 💸 LIVE TRADING (Real Money)"
echo "3) 🔌 API Connection Test"
read -p "Choose [1-3]: " choice

case $choice in
    1)
        python main.py --sandbox
        ;;
    2)
        echo -e "\033[0;31m⚠️ WARNING: YOU ARE ABOUT TO TRADE REAL MONEY.\033[0m"
        read -p "Type 'I UNDERSTAND' to continue: " confirm
        if [ "$confirm" == "I UNDERSTAND" ]; then
            python main.py --live
        else
            echo "Aborted."
        fi
        ;;
    3)
        python main.py --test-api
        ;;
    *)
        echo "Invalid choice."
        ;;
esac
