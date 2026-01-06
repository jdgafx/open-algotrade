#!/bin/bash

# Ultimate Trading Platform - Auto-Runner
# Automates the setup and startup of the trading platform.

# Exit on error
set -e

# Directory of the platform
PLATFORM_DIR="ultimate-trading-platform"
CURRENT_DIR=$(pwd)

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=================================================="
echo "   🚀 Ultimate Trading Platform Launcher 🚀      "
echo "=================================================="
echo -e "${NC}"

# Check if we are in the right place
if [ ! -d "$PLATFORM_DIR" ]; then
    echo -e "${RED}Error: Platform directory '$PLATFORM_DIR' not found!${NC}"
    echo "Please run this script from the project root."
    exit 1
fi

cd "$PLATFORM_DIR"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    exit 1
fi

# Install dependencies if missing
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Dependencies not found. Installing...${NC}"
    npm install
    echo -e "${GREEN}Dependencies installed.${NC}"
else
    echo -e "${GREEN}Dependencies already installed.${NC}"
fi

# Build artifacts (optional but good for consistency)
# echo -e "${BLUE}Building assets...${NC}"
# npm run build  # Uncomment if minification is desired every run

echo -e "${BLUE}--------------------------------------------------${NC}"
echo -e "Select Mode:"
echo -e "1) ${GREEN}Development${NC} (Live Reload, Debugging) - Recommended for testing"
echo -e "2) ${BLUE}Production${NC} (Optimized, Static Serve)"
echo -e "${BLUE}--------------------------------------------------${NC}"
read -p "Enter choice [1]: " choice
choice=${choice:-1}

if [ "$choice" -eq 1 ]; then
    echo -e "${GREEN}Starting in Development Mode...${NC}"
    echo -e "Opening http://localhost:3000..."
    npm run dev
elif [ "$choice" -eq 2 ]; then
    echo -e "${BLUE}Starting in Production Mode...${NC}"
    echo -e "Opening http://localhost:3000..."
    npm start
else
    echo -e "${RED}Invalid choice. Exiting.${NC}"
    exit 1
fi
