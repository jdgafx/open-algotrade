#!/bin/bash
chmod +x scripts/*.sh

echo -e "\033[0;32m"
echo "🌑 KAIROS COMMAND CENTER"
echo "========================"
echo -e "\033[0m"

echo "1) 🛠️  INSTALL / UPDATE (Run this first)"
echo "2) 🖥️  LAUNCH UI (Wallet Manager)"
echo "3) 📈 LAUNCH TRADING ENGINE"
echo "4) 🚪 Exit"
echo ""
read -p "Select [1-4]: " choice

case $choice in
    1) ./scripts/1_install.sh ;;
    2) ./scripts/2_ui.sh ;;
    3) ./scripts/3_trade.sh ;;
    4) exit 0 ;;
    *) echo "Invalid option." ;;
esac
