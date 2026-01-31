#!/bin/bash

# OpenAlgo Platform - One-Command Launcher
# This script sets up the entire environment and starts the platform

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=========================================="
echo "  OpenAlgo Trading Platform"
echo "=========================================="
echo ""

# =============================================================================
# STEP 1: Check System Dependencies
# =============================================================================
log_info "Checking system dependencies..."

# Check Python version
if ! command -v python3 &> /dev/null; then
    log_error "Python 3 is not installed!"
    log_info "Install with: sudo apt install python3 python3-pip python3-venv"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1-2)
log_success "Python version: $PYTHON_VERSION"

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed!"
    log_info "Install with: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node --version)
log_success "Node.js version: $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm is not installed!"
    exit 1
fi

log_success "npm version: $(npm --version)"

# =============================================================================
# STEP 2: Setup Python Virtual Environment
# =============================================================================
log_info "Setting up Python virtual environment..."

VENV_DIR="$SCRIPT_DIR/.venv"

# Create venv if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    log_info "Creating virtual environment..."
    python3 -m venv "$VENV_DIR" --system-site-packages || {
        log_warn "Standard venv creation failed, trying without system packages..."
        python3 -m venv "$VENV_DIR"
    }
    log_success "Virtual environment created"
else
    log_info "Virtual environment already exists"
fi

# Activate venv
log_info "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Verify we're in venv
if [ -z "$VIRTUAL_ENV" ]; then
    log_error "Failed to activate virtual environment!"
    exit 1
fi

log_success "Virtual environment activated: $VIRTUAL_ENV"

# =============================================================================
# STEP 3: Install/Upgrade pip and core tools
# =============================================================================
log_info "Upgrading pip and setuptools..."
pip install --quiet --upgrade pip setuptools wheel 2>&1 || {
    log_warn "Standard pip upgrade failed, trying with --break-system-packages..."
    pip install --quiet --upgrade pip setuptools wheel --break-system-packages 2>&1 || true
}
log_success "pip upgraded to: $(pip --version | cut -d' ' -f2)"

# =============================================================================
# STEP 4: Install Python Dependencies
# =============================================================================
log_info "Installing Python dependencies (this may take a few minutes)..."

# Install from requirements.txt
if [ -f "$SCRIPT_DIR/requirements.txt" ]; then
    log_info "Installing from requirements.txt..."
    pip install --quiet -r "$SCRIPT_DIR/requirements.txt" 2>&1 || {
        log_warn "Some packages failed, trying individually..."
        # Try core packages individually
        pip install --quiet fastapi uvicorn pandas numpy ccxt 2>&1 || true
        pip install --quiet hyperliquid-python-sdk eth-account web3 2>&1 || true
        pip install --quiet aiohttp websockets requests termcolor 2>&1 || true
        pip install --quiet pydantic python-dotenv pytz 2>&1 || true
    }
    log_success "Python dependencies installed"
else
    log_warn "requirements.txt not found, installing core packages..."
    pip install --quiet fastapi uvicorn pandas numpy ccxt hyperliquid-python-sdk eth-account web3 aiohttp websockets requests termcolor pydantic python-dotenv 2>&1 || true
fi

# Verify critical packages
log_info "Verifying critical packages..."
python3 -c "import fastapi, pandas, numpy, ccxt" 2>&1 && log_success "Core packages verified"

# =============================================================================
# STEP 5: Install Node.js Dependencies
# =============================================================================
log_info "Setting up Node.js frontend..."

UI_DIR="$SCRIPT_DIR/src/ui"
if [ -d "$UI_DIR" ]; then
    cd "$UI_DIR"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        log_info "Installing npm dependencies (this may take a few minutes)..."
        npm install --silent 2>&1 || {
            log_warn "npm install had issues, trying with legacy peer deps..."
            npm install --silent --legacy-peer-deps 2>&1 || true
        }
        log_success "Node.js dependencies installed"
    else
        log_info "Node.js dependencies already installed"
    fi
    
    cd "$SCRIPT_DIR"
else
    log_error "Frontend directory not found: $UI_DIR"
    exit 1
fi

# =============================================================================
# STEP 6: Start Backend (FastAPI)
# =============================================================================
log_info "Starting FastAPI backend..."

# Check if main.py exists
if [ -f "$SCRIPT_DIR/src/api/main.py" ]; then
    log_info "Starting Python backend on http://localhost:8000"
    cd "$SCRIPT_DIR"
    python3 -m src.api.main &
    BACKEND_PID=$!
    sleep 3
    
    # Check if backend started
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        log_success "Backend started (PID: $BACKEND_PID)"
    else
        log_warn "Backend may have failed to start, check logs"
        BACKEND_PID=""
    fi
else
    log_error "Backend main.py not found!"
    BACKEND_PID=""
fi

# =============================================================================
# STEP 7: Start Frontend (Next.js)
# =============================================================================
log_info "Starting Next.js frontend..."

cd "$UI_DIR"
npm run dev &
FRONTEND_PID=$!
sleep 5

# Check if frontend started
if ps -p $FRONTEND_PID > /dev/null 2>&1; then
    log_success "Frontend started (PID: $FRONTEND_PID)"
else
    log_warn "Frontend may have failed to start"
fi

cd "$SCRIPT_DIR"

# =============================================================================
# STEP 8: Display Status
# =============================================================================
echo ""
echo "=========================================="
echo "  OpenAlgo Platform is Running!"
echo "=========================================="
echo ""
echo -e "  ${GREEN}Dashboard:${NC}   http://localhost:3000"
echo -e "  ${GREEN}API Docs:${NC}    http://localhost:8000/docs"
echo -e "  ${GREEN}API:${NC}         http://localhost:8000"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "=========================================="
echo ""

# Cleanup function
cleanup() {
    echo ""
    log_info "Shutting down services..."
    
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>&1 || true
        log_info "Backend stopped"
    fi
    
    if [ -n "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>&1 || true
        log_info "Frontend stopped"
    fi
    
    log_success "All services stopped"
    exit 0
}

trap cleanup INT TERM

# Keep script running
wait
