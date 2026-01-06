#!/bin/bash

# Ultimate Trading Platform - Zero Touch Setup Script
# This script sets up the entire environment, installs dependencies, and verifies the installation.

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

# Banner
echo -e "${BLUE}"
echo "=================================================="
echo "   Ultimate Trading Platform - Setup Assistant    "
echo "=================================================="
echo -e "${NC}"

# Step 1: System Check
log_info "Step 1: Checking system requirements..."

check_command node
check_command npm

NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)

log_success "Node.js $NODE_VERSION detected"
log_success "npm $NPM_VERSION detected"

# Step 2: Clean Installation
log_info "Step 2: Preparing for fresh installation..."

if [ -d "node_modules" ]; then
    log_warn "Removing existing node_modules..."
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    log_info "Installing dependencies via npm ci..."
    npm ci
else
    log_info "Installing dependencies via npm install..."
    npm install
fi

log_success "Dependencies installed successfully"

# Step 3: Environment Setup
log_info "Step 3: Configuring environment..."

# Ensure required directories exist
mkdir -p logs
mkdir -p artifacts
mkdir -p data

# Check for .env file (if applicable in future, currently not strictly required by verification checks but good practice)
if [ ! -f ".env" ]; then
    log_warn "No .env file found. Creating default configuration..."
    cat > .env << EOL
# Ultimate Trading Platform Configuration
NODE_ENV=production
PORT=3000
# Add your Hyperliquid credentials below when ready
# HYPERLIQUID_API_KEY=your_key_here
# HYPERLIQUID_API_SECRET=your_secret_here
EOL
    log_success "Created .env file"
else
    log_success ".env file already exists"
fi

# Step 4: Verification
log_info "Step 4: Running system verification..."

log_info "Executing test suite..."
if npm test; then
    log_success "All tests passed!"
else
    log_error "Tests failed! Please check the output above."
    exit 1
fi

# Step 5: Finalization
echo -e "${BLUE}"
echo "=================================================="
echo "           Setup Complete Successfully!           "
echo "=================================================="
echo -e "${NC}"
echo -e "You can now start the platform using:"
echo -e "  ${GREEN}npm start${NC}    (Production mode)"
echo -e "  ${GREEN}npm run dev${NC}  (Development mode)"
echo ""
echo -e "Access the dashboard at: ${BLUE}http://localhost:3000${NC}"
echo ""
