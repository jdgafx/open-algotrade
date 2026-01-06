#!/bin/bash

# MoonDev Algo Trading System Setup Script
# This script sets up the environment and installs dependencies

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Print banner
print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║            MoonDev Algo Trading System Setup               ║"
    echo "║                Automated Installation Script               ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check if Python is installed
check_python() {
    print_status "Checking Python installation..."

    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        print_success "Python $PYTHON_VERSION found"

        # Check if version is 3.8 or higher
        PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
        PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)

        if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 8 ]; then
            print_success "Python version meets requirements (>= 3.8)"
        else
            print_error "Python version $PYTHON_VERSION is too old. Please install Python 3.8 or higher."
            exit 1
        fi
    else
        print_error "Python 3 is not installed. Please install Python 3.8 or higher."
        exit 1
    fi
}

# Create virtual environment
create_venv() {
    print_status "Creating Python virtual environment..."

    if [ ! -d "venv" ]; then
        python3 -m venv venv
        print_success "Virtual environment created"
    else
        print_warning "Virtual environment already exists"
    fi
}

# Activate virtual environment
activate_venv() {
    print_status "Activating virtual environment..."
    source venv/bin/activate
    print_success "Virtual environment activated"
}

# Upgrade pip
upgrade_pip() {
    print_status "Upgrading pip..."
    pip install --upgrade pip
    print_success "Pip upgraded"
}

# Install dependencies
install_dependencies() {
    print_status "Installing Python dependencies..."

    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
        print_success "Dependencies installed"
    else
        print_error "requirements.txt not found"
        exit 1
    fi
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."

    directories=(
        "logs"
        "data/performance"
        "data/trades"
        "data/market_data"
        "backups"
        "tests"
    )

    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_status "Created directory: $dir"
        fi
    done

    print_success "All directories created"
}

# Setup configuration file
setup_config() {
    print_status "Setting up configuration file..."

    if [ ! -f "config.json" ]; then
        if [ -f "config.example.json" ]; then
            cp config.example.json config.json
            print_success "Configuration file created from template"
            print_warning "Please edit config.json with your API credentials"
        else
            print_error "Configuration template not found"
            exit 1
        fi
    else
        print_warning "Configuration file already exists"
    fi
}

# Set up logging configuration
setup_logging() {
    print_status "Setting up logging configuration..."

    # Create log rotation config for production
    cat > logging.conf << EOF
[loggers]
keys=root,trading_engine,strategies,monitoring

[handlers]
keys=consoleHandler,fileHandler

[formatters]
keys=simpleFormatter

[logger_root]
level=INFO
handlers=consoleHandler,fileHandler

[logger_trading_engine]
level=INFO
handlers=consoleHandler,fileHandler
qualname=trading_engine
propagate=0

[logger_strategies]
level=INFO
handlers=consoleHandler,fileHandler
qualname=strategies
propagate=0

[logger_monitoring]
level=INFO
handlers=consoleHandler,fileHandler
qualname=monitoring
propagate=0

[handler_consoleHandler]
class=StreamHandler
level=INFO
formatter=simpleFormatter
args=(sys.stdout,)

[handler_fileHandler]
class=handlers.RotatingFileHandler
level=INFO
formatter=simpleFormatter
args=('logs/trading_engine.log', 'a', 10485760, 5, 'utf-8')

[formatter_simpleFormatter]
format=%(asctime)s - %(name)s - %(levelname)s - %(message)s
datefmt=%Y-%m-%d %H:%M:%S
EOF

    print_success "Logging configuration created"
}

# Run initial tests
run_tests() {
    print_status "Running initial setup tests..."

    # Test Python imports
    python3 -c "
import sys
try:
    import aiohttp
    import pandas
    import numpy
    import websockets
    print('✅ All core dependencies imported successfully')
except ImportError as e:
    print(f'❌ Import error: {e}')
    sys.exit(1)
"

    if [ $? -eq 0 ]; then
        print_success "Initial tests passed"
    else
        print_error "Initial tests failed"
        exit 1
    fi
}

# Create systemd service file (optional)
create_systemd_service() {
    if [ "$1" = "--systemd" ]; then
        print_status "Creating systemd service file..."

        SERVICE_CONTENT="[Unit]
Description=MoonDev Algo Trading System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/venv/bin
ExecStart=$(pwd)/venv/bin/python main.py --config config.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target"

        echo "$SERVICE_CONTENT" > moondev-trading.service
        print_success "Systemd service file created: moondev-trading.service"
        print_warning "To install: sudo cp moondev-trading.service /etc/systemd/system/"
        print_warning "To enable: sudo systemctl enable moondev-trading"
        print_warning "To start: sudo systemctl start moondev-trading"
    fi
}

# Final setup steps
final_setup() {
    print_status "Performing final setup..."

    # Create .env file for environment variables
    if [ ! -f ".env" ]; then
        cat > .env << EOF
# MoonDev Trading Environment Variables
PYTHONPATH=$(pwd)
LOG_LEVEL=INFO
DATA_DIR=$(pwd)/data
EOF
        print_success "Environment file created"
    fi

    # Make scripts executable
    chmod +x scripts/*.sh
    print_success "Made scripts executable"

    # Create startup script
    cat > start_trading.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
python main.py "$@"
EOF
    chmod +x start_trading.sh
    print_success "Startup script created: start_trading.sh"
}

# Print final instructions
print_instructions() {
    echo ""
    print_success "🎉 Setup completed successfully!"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Edit config.json with your Hyperliquid API credentials"
    echo "2. Test the API connection:"
    echo "   ./start_trading.sh --test-api --sandbox"
    echo "3. Run in sandbox mode:"
    echo "   ./start_trading.sh --config config.json --sandbox"
    echo "4. Monitor logs:"
    echo "   tail -f logs/trading_engine.log"
    echo ""
    echo -e "${YELLOW}Important reminders:${NC}"
    echo "- Always start in sandbox mode first"
    echo "- Never risk more than you can afford to lose"
    echo "- Monitor positions closely"
    echo "- Keep emergency stop mechanisms active"
    echo ""
    echo -e "${GREEN}Happy trading! 🚀${NC}"
}

# Main execution
main() {
    print_banner

    # Check if running as root (not recommended)
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root is not recommended. Consider using a regular user."
    fi

    # Run setup steps
    check_python
    create_venv
    activate_venv
    upgrade_pip
    install_dependencies
    create_directories
    setup_config
    setup_logging
    run_tests
    create_systemd_service "$1"
    final_setup

    print_instructions
}

# Run main function with all arguments
main "$@"