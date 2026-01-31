#!/bin/bash

# OpenAlgo Dependency Installer
# Handles all Python and Node.js dependencies properly

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[INSTALL]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=========================================="
echo "  OpenAlgo Dependency Installer"
echo "=========================================="
echo ""

# =============================================================================
# CHECK PYTHON
# =============================================================================
log "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    error "Python 3 is not installed!"
    echo "Install with:"
    echo "  sudo apt update"
    echo "  sudo apt install -y python3 python3-pip python3-venv"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
log "Found Python $PYTHON_VERSION"

# =============================================================================
# CREATE VIRTUAL ENVIRONMENT
# =============================================================================
VENV_DIR="$SCRIPT_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
    log "Creating virtual environment..."
    python3 -m venv "$VENV_DIR" 2>&1 || {
        error "Failed to create virtual environment"
        echo "Try: sudo apt install -y python3-venv"
        exit 1
    }
    success "Virtual environment created"
else
    log "Virtual environment already exists"
fi

# =============================================================================
# ACTIVATE VENV
# =============================================================================
log "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

if [ -z "$VIRTUAL_ENV" ]; then
    error "Failed to activate virtual environment"
    exit 1
fi
success "Virtual environment activated"

# =============================================================================
# UPGRADE PIP
# =============================================================================
log "Upgrading pip..."
pip install --quiet --upgrade pip setuptools wheel 2>&1 | grep -v "WARNING: Running pip as the 'root' user" || true
success "pip upgraded to $(pip --version | cut -d' ' -f2)"

# =============================================================================
# INSTALL PYTHON DEPENDENCIES
# =============================================================================
log "Installing Python dependencies..."
log "This may take 3-5 minutes depending on your system..."
echo ""

# Core packages first
log "Installing core packages (1/3)..."
pip install --quiet \
    fastapi>=0.104.0 \
    uvicorn[standard]>=0.24.0 \
    python-multipart>=0.0.6 \
    2>&1 | tail -5 || warn "Some core packages had warnings"

# Data processing
log "Installing data processing packages (2/3)..."
pip install --quiet \
    pandas>=2.0.0 \
    numpy>=1.24.0 \
    scipy>=1.10.0 \
    pandas-ta>=0.3.14b \
    2>&1 | tail -5 || warn "Some data packages had warnings"

# Exchange APIs
log "Installing exchange APIs (3/3)..."
pip install --quiet \
    ccxt>=4.0.0 \
    hyperliquid-python-sdk>=0.8.0 \
    requests>=2.31.0 \
    aiohttp>=3.8.0 \
    websockets>=11.0.0 \
    2>&1 | tail -5 || warn "Some exchange packages had warnings"

# Web3 and utilities
log "Installing Web3 and utilities..."
pip install --quiet \
    eth-account>=0.10.0 \
    web3>=6.0.0 \
    pydantic>=2.0.0 \
    pydantic-settings>=2.0.0 \
    python-dotenv>=1.0.0 \
    python-dateutil>=2.8.2 \
    pytz>=2023.3 \
    termcolor>=2.3.0 \
    2>&1 | tail -5 || warn "Some utility packages had warnings"

# =============================================================================
# VERIFY PYTHON INSTALLATION
# =============================================================================
echo ""
log "Verifying Python installation..."

python3 << 'EOF'
import sys
errors = []

def check_import(module, name=None):
    if name is None:
        name = module
    try:
        __import__(module)
        print(f"  ✓ {name}")
        return True
    except ImportError as e:
        print(f"  ✗ {name}: {e}")
        errors.append(name)
        return False

check_import("fastapi")
check_import("uvicorn")
check_import("pandas")
check_import("numpy")
check_import("ccxt")
check_import("aiohttp")
check_import("websockets")
check_import("requests")
check_import("pydantic")
check_import("dotenv", "python-dotenv")

if errors:
    print(f"\n⚠️  {len(errors)} package(s) failed to import")
    sys.exit(1)
else:
    print("\n✅ All Python packages verified!")
    sys.exit(0)
EOF

if [ $? -ne 0 ]; then
    error "Some Python packages failed to install properly"
    error "Check the output above for details"
    exit 1
fi

success "Python dependencies installed and verified"

# =============================================================================
# INSTALL NODE.JS DEPENDENCIES
# =============================================================================
echo ""
log "Checking Node.js..."

if ! command -v node &> /dev/null; then
    error "Node.js is not installed!"
    echo "Install with:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt install -y nodejs"
    exit 1
fi

log "Node.js version: $(node --version)"
log "npm version: $(npm --version)"

UI_DIR="$SCRIPT_DIR/src/ui"
if [ -d "$UI_DIR" ]; then
    cd "$UI_DIR"
    
    if [ ! -d "node_modules" ]; then
        log "Installing Node.js dependencies..."
        log "This may take 2-3 minutes..."
        npm install 2>&1 | tail -10 || {
            warn "npm install had issues, trying with --legacy-peer-deps..."
            npm install --legacy-peer-deps 2>&1 | tail -10
        }
        success "Node.js dependencies installed"
    else
        log "Node.js dependencies already installed"
        log "Run 'cd src/ui && npm update' to update packages"
    fi
else
    warn "Frontend directory not found: $UI_DIR"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo ""
success "All dependencies installed successfully"
echo ""
echo "Virtual Environment: $VENV_DIR"
echo ""
echo "Next steps:"
echo "  1. Copy environment template:"
echo "     cp .env.example .env"
echo ""
echo "  2. Edit .env with your API keys"
echo ""
echo "  3. Start the platform:"
echo "     ./start.sh"
echo ""
echo "=========================================="
