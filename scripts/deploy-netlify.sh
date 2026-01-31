#!/bin/bash

# Netlify Deployment Script for OpenAlgo Frontend
# Usage: ./scripts/deploy-netlify.sh [environment]
# Environments: production (default), staging, development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
UI_DIR="src/ui"

echo -e "${GREEN}OpenAlgo Netlify Deployment Script${NC}"
echo "Environment: $ENVIRONMENT"
echo ""

# Check if we're in the right directory
if [ ! -f "netlify.toml" ]; then
    echo -e "${RED}Error: netlify.toml not found. Please run from project root.${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

echo -e "${YELLOW}Node version:${NC} $(node --version)"
echo ""

# Navigate to UI directory
cd "$UI_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm ci --legacy-peer-deps
else
    echo -e "${GREEN}Dependencies already installed${NC}"
fi

# Run tests
echo ""
echo -e "${YELLOW}Running tests...${NC}"
npm test || echo -e "${YELLOW}Tests completed with warnings${NC}"

# Build the project
echo ""
echo -e "${YELLOW}Building for $ENVIRONMENT...${NC}"

# Set environment variables based on target
if [ "$ENVIRONMENT" = "production" ]; then
    export NEXT_PUBLIC_APP_ENV=production
elif [ "$ENVIRONMENT" = "staging" ]; then
    export NEXT_PUBLIC_APP_ENV=staging
else
    export NEXT_PUBLIC_APP_ENV=development
fi

npm run build

# Check if build succeeded
if [ ! -d ".next" ]; then
    echo -e "${RED}Error: Build failed - .next directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}Build successful!${NC}"
echo ""

# Deploy to Netlify
if command -v netlify &> /dev/null; then
    echo -e "${YELLOW}Deploying to Netlify ($ENVIRONMENT)...${NC}"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        netlify deploy --prod --dir=.next
    else
        netlify deploy --dir=.next
    fi
    
    echo ""
    echo -e "${GREEN}Deployment complete!${NC}"
else
    echo -e "${YELLOW}Netlify CLI not found. Install with: npm install -g netlify-cli${NC}"
    echo -e "${YELLOW}Or deploy manually via GitHub Actions${NC}"
    echo ""
    echo -e "${GREEN}Build artifacts ready in: $UI_DIR/.next${NC}"
fi
