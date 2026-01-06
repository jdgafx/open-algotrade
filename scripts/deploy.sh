#!/bin/bash

# MoonDev Algo Trading System Deployment Script
# This script handles deployment to different environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="moondev-algotrade"
REPO_URL="https://github.com/your-repo/moondev-algotrade.git"
DEPLOYMENT_DIR="/opt/$PROJECT_NAME"
SERVICE_NAME="moondev-trading"
BACKUP_DIR="/opt/backups/$PROJECT_NAME"

# Environment variables
ENVIRONMENT=${1:-development}
BRANCH=${2:-main}

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

# Check deployment environment
check_environment() {
    print_status "Checking deployment environment: $ENVIRONMENT"

    case $ENVIRONMENT in
        "development"|"testing"|"staging"|"production")
            print_success "Valid environment: $ENVIRONMENT"
            ;;
        *)
            print_error "Invalid environment. Use: development, testing, staging, or production"
            exit 1
            ;;
    esac

    # Check if running as root for production deployment
    if [ "$ENVIRONMENT" = "production" ] && [ "$EUID" -ne 0 ]; then
        print_error "Production deployment requires root privileges"
        exit 1
    fi
}

# Create backup of current deployment
create_backup() {
    if [ -d "$DEPLOYMENT_DIR" ]; then
        print_status "Creating backup of current deployment..."

        BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_PATH="$BACKUP_DIR/$BACKUP_TIMESTAMP"

        mkdir -p "$BACKUP_PATH"
        cp -r "$DEPLOYMENT_DIR"/* "$BACKUP_PATH/"

        # Backup configuration separately
        if [ -f "$DEPLOYMENT_DIR/config.json" ]; then
            cp "$DEPLOYMENT_DIR/config.json" "$BACKUP_PATH/config.json.backup"
        fi

        print_success "Backup created: $BACKUP_PATH"
    else
        print_warning "No existing deployment to backup"
    fi
}

# Update code from repository
update_code() {
    print_status "Updating code from repository..."

    if [ ! -d "$DEPLOYMENT_DIR" ]; then
        print_status "Cloning repository for first-time deployment..."
        sudo mkdir -p "$DEPLOYMENT_DIR"
        sudo git clone "$REPO_URL" "$DEPLOYMENT_DIR"
    else
        print_status "Pulling latest changes..."
        cd "$DEPLOYMENT_DIR"
        sudo git fetch origin
        sudo git checkout "$BRANCH"
        sudo git pull origin "$BRANCH"
    fi

    cd "$DEPLOYMENT_DIR"
    sudo chown -R $USER:$USER "$DEPLOYMENT_DIR"
    print_success "Code updated successfully"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."

    cd "$DEPLOYMENT_DIR"

    # Activate virtual environment or create if doesn't exist
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi

    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt

    print_success "Dependencies installed"
}

# Setup configuration
setup_configuration() {
    print_status "Setting up configuration..."

    cd "$DEPLOYMENT_DIR"

    # Copy environment-specific configuration
    ENV_CONFIG_FILE="config.$ENVIRONMENT.json"
    if [ -f "$ENV_CONFIG_FILE" ]; then
        cp "$ENV_CONFIG_FILE" config.json
        print_success "Environment-specific configuration loaded"
    elif [ ! -f "config.json" ] && [ -f "config.example.json" ]; then
        cp config.example.json config.json
        print_warning "Using example configuration - please update with real values"
    fi

    # Set up environment variables
    if [ ! -f ".env" ]; then
        cat > .env << EOF
# Environment: $ENVIRONMENT
ENVIRONMENT=$ENVIRONMENT
DEPLOYMENT_TIME=$(date)
PYTHONPATH=$DEPLOYMENT_DIR
LOG_LEVEL=$([ "$ENVIRONMENT" = "production" ] && echo "WARNING" || echo "INFO")
EOF
        print_success "Environment variables configured"
    fi

    # Create necessary directories
    mkdir -p logs data/{performance,trades,market_data} backups
    print_success "Directories created"
}

# Setup systemd service (production only)
setup_service() {
    if [ "$ENVIRONMENT" = "production" ]; then
        print_status "Setting up systemd service..."

        SERVICE_CONTENT="[Unit]
Description=MoonDev Algo Trading System ($ENVIRONMENT)
After=network.target

[Service]
Type=simple
User=trading
Group=trading
WorkingDirectory=$DEPLOYMENT_DIR
Environment=PATH=$DEPLOYMENT_DIR/venv/bin
EnvironmentFile=$DEPLOYMENT_DIR/.env
ExecStart=$DEPLOYMENT_DIR/venv/bin/python $DEPLOYMENT_DIR/main.py --config config.json
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target"

        echo "$SERVICE_CONTENT" | sudo tee /etc/systemd/system/$SERVICE_NAME.service

        # Create trading user if doesn't exist
        if ! id "trading" &>/dev/null; then
            sudo useradd -r -s /bin/false trading
        fi

        # Set ownership
        sudo chown -R trading:trading "$DEPLOYMENT_DIR"

        # Reload systemd and enable service
        sudo systemctl daemon-reload
        sudo systemctl enable $SERVICE_NAME

        print_success "Systemd service configured"
    else
        print_status "Skipping systemd service setup (non-production environment)"
    fi
}

# Run health checks
health_check() {
    print_status "Running health checks..."

    cd "$DEPLOYMENT_DIR"
    source venv/bin/activate

    # Test imports
    python -c "
import sys
try:
    from src.engine.trading_engine import TradingEngine
    from src.utils.hyperliquid_client import HyperliquidClient
    print('✅ Core modules imported successfully')
except ImportError as e:
    print(f'❌ Import error: {e}')
    sys.exit(1)
"

    # Test configuration
    if [ -f "config.json" ]; then
        python -c "
import json
try:
    with open('config.json', 'r') as f:
        config = json.load(f)
    required_keys = ['hyperliquid_api_key', 'hyperliquid_secret_key']
    for key in required_keys:
        if key not in config or not config[key]:
            print(f'❌ Missing required config key: {key}')
            exit(1)
    print('✅ Configuration valid')
except Exception as e:
    print(f'❌ Configuration error: {e}')
    exit(1)
"
    else
        print_error "Configuration file not found"
        return 1
    fi

    print_success "Health checks passed"
}

# Deploy application
deploy_application() {
    print_status "Deploying application..."

    cd "$DEPLOYMENT_DIR"

    if [ "$ENVIRONMENT" = "production" ]; then
        print_status "Starting production service..."
        sudo systemctl start $SERVICE_NAME
        sudo systemctl status $SERVICE_NAME --no-pager
        print_success "Application deployed and started"
    else
        print_status "Starting application in background..."
        nohup python main.py --config config.json > logs/deployment.log 2>&1 &
        echo $! > trading.pid
        print_success "Application started in background (PID: $(cat trading.pid))"
    fi
}

# Show deployment status
show_status() {
    print_status "Deployment status:"

    if [ "$ENVIRONMENT" = "production" ]; then
        sudo systemctl status $SERVICE_NAME --no-pager
        sudo journalctl -u $SERVICE_NAME --no-pager -n 20
    else
        if [ -f "trading.pid" ]; then
            PID=$(cat trading.pid)
            if ps -p $PID > /dev/null; then
                print_success "Application running (PID: $PID)"
            else
                print_error "Application not running"
            fi
        else
            print_warning "No PID file found"
        fi
    fi

    # Show recent logs
    if [ -f "logs/trading_engine.log" ]; then
        print_status "Recent log entries:"
        tail -n 20 logs/trading_engine.log
    fi
}

# Rollback function
rollback() {
    if [ -z "$1" ]; then
        print_error "Please specify backup timestamp to rollback to"
        print "Available backups:"
        ls -la "$BACKUP_DIR"
        exit 1
    fi

    BACKUP_TIMESTAMP=$1
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_TIMESTAMP"

    if [ ! -d "$BACKUP_PATH" ]; then
        print_error "Backup not found: $BACKUP_PATH"
        exit 1
    fi

    print_status "Rolling back to: $BACKUP_TIMESTAMP"

    # Stop current application
    if [ "$ENVIRONMENT" = "production" ]; then
        sudo systemctl stop $SERVICE_NAME
    else
        if [ -f "trading.pid" ]; then
            kill $(cat trading.pid) || true
        fi
    fi

    # Restore backup
    sudo rm -rf "$DEPLOYMENT_DIR"/*
    sudo cp -r "$BACKUP_PATH"/* "$DEPLOYMENT_DIR/"

    # Restore configuration if it exists
    if [ -f "$BACKUP_PATH/config.json.backup" ]; then
        sudo cp "$BACKUP_PATH/config.json.backup" "$DEPLOYMENT_DIR/config.json"
    fi

    print_success "Rollback completed"
}

# Main deployment function
main() {
    case "${1:-deploy}" in
        "deploy")
            check_environment
            create_backup
            update_code
            install_dependencies
            setup_configuration
            setup_service
            health_check
            deploy_application
            show_status
            ;;
        "rollback")
            rollback "$2"
            ;;
        "status")
            show_status
            ;;
        "health")
            cd "$DEPLOYMENT_DIR" 2>/dev/null || cd "$(pwd)"
            source venv/bin/activate 2>/dev/null || true
            health_check
            ;;
        "stop")
            if [ "$ENVIRONMENT" = "production" ]; then
                sudo systemctl stop $SERVICE_NAME
            else
                if [ -f "trading.pid" ]; then
                    kill $(cat trading.pid) || true
                    rm trading.pid
                fi
            fi
            print_success "Application stopped"
            ;;
        "restart")
            $0 stop
            sleep 5
            $0 deploy
            ;;
        *)
            echo "Usage: $0 {deploy|rollback [timestamp]|status|health|stop|restart} [environment] [branch]"
            echo ""
            echo "Examples:"
            echo "  $0 deploy production main"
            echo "  $0 deploy development"
            echo "  $0 rollback 20231201_120000"
            echo "  $0 status"
            exit 1
            ;;
    esac
}

# Script information
echo "🚀 MoonDev Algo Trading System Deployment Script"
echo "Environment: $ENVIRONMENT"
echo "Branch: $BRANCH"
echo "Deployment Directory: $DEPLOYMENT_DIR"
echo ""

# Run main function
main "$@"