#!/bin/bash

# OpenAlgo Platform Launcher with Comprehensive Logging
# Creates a new timestamped log file on every run

# Ensure non-interactive mode for all commands
export CI=true
export DEBIAN_FRONTEND=noninteractive
export DEBIAN_PRIORITY=critical
export DEBCONF_NOWARNINGS=yes
export PIP_NO_INPUT=1
export PYTHONUNBUFFERED=1

# Generate unique log filename with timestamp and random component
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RANDOM_ID=$(printf "%04d" $((RANDOM % 10000)))
LOG_FILE="${PWD}/openalgo_launch_${TIMESTAMP}_${RANDOM_ID}.log"

# Initialize log file with header
cat > "$LOG_FILE" << EOF
==========================================
OpenAlgo - Algorithmic Trading Platform
Launch Log
==========================================
Log File: $LOG_FILE
Working Directory: $PWD
Started: $(date "+%Y-%m-%d %H:%M:%S")
User: $(whoami)
Hostname: $(hostname)
==========================================

EOF

# Function to log messages with timestamps
log_message() {
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

# Function to log command output
cmd_with_log() {
    local cmd="$1"
    local description="$2"
    
    log_message ""
    log_message "=== $description ==="
    log_message "Command: $cmd"
    log_message "---"
    
    # Execute command and capture both stdout and stderr to log
    if eval "$cmd" >> "$LOG_FILE" 2>&1; then
        log_message "STATUS: SUCCESS"
        return 0
    else
        local exit_code=$?
        log_message "STATUS: FAILED (Exit Code: $exit_code)"
        return $exit_code
    fi
}

# Function to handle errors gracefully
handle_error() {
    local context="$1"
    local error_msg="$2"
    local continue_execution="${3:-true}"
    
    log_message ""
    log_message "*** ERROR in $context ***"
    log_message "Error: $error_msg"
    
    if [ "$continue_execution" = "true" ]; then
        log_message "CONTINUING despite error (continue_on_error=true)"
        return 0
    else
        log_message "FATAL ERROR - Exiting"
        log_message "=========================================="
        log_message "Launch failed at: $(date "+%Y-%m-%d %H:%M:%S")"
        log_message "Full log saved to: $LOG_FILE"
        log_message "=========================================="
        exit 1
    fi
}

# Print header to console and log
cat << EOF | tee -a "$LOG_FILE"

==========================================
OpenAlgo - Algorithmic Trading Platform
==========================================

Log file: $LOG_FILE
Working directory: $PWD

EOF

log_message "Starting OpenAlgo Platform..."
log_message ""

# Log environment information
log_message "=== Environment Information ==="
log_message "BASH_VERSION: $BASH_VERSION"
log_message "PATH: $PATH"
log_message "PWD: $PWD"
log_message "HOME: $HOME"
log_message "SHELL: $SHELL"

# Check system dependencies
log_message ""
log_message "=== Checking System Dependencies ==="

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    log_message "Python3: FOUND - $PYTHON_VERSION"
    PYTHON_CMD="python3"
else
    log_message "Python3: NOT FOUND"
    handle_error "Python Check" "Python 3 is not installed or not in PATH" "true"
    PYTHON_CMD=""
fi

# Check pip
if command -v pip3 &> /dev/null; then
    PIP_VERSION=$(pip3 --version 2>&1)
    log_message "pip3: FOUND - $PIP_VERSION"
    PIP_CMD="pip3"
elif command -v pip &> /dev/null; then
    PIP_VERSION=$(pip --version 2>&1)
    log_message "pip: FOUND - $PIP_VERSION"
    PIP_CMD="pip"
else
    log_message "pip: NOT FOUND"
    log_message "Attempting to install pip (this may take a moment)..."
    export DEBIAN_FRONTEND=noninteractive
    export CI=true
    export DEBIAN_FRONTEND=noninteractive
    sudo -n apt-get update -qq >> "$LOG_FILE" 2>&1 || log_message "WARNING: apt-get update failed or requires password"
    sudo -n apt-get install -y -qq python3-pip >> "$LOG_FILE" 2>&1 || log_message "WARNING: pip install failed or requires password"
    if command -v pip3 &> /dev/null; then
        PIP_CMD="pip3"
        log_message "pip3 found after install attempt"
    elif command -v pip &> /dev/null; then
        PIP_CMD="pip"
        log_message "pip found after install attempt"
    else
        log_message "WARNING: pip installation may have failed - continuing anyway"
        PIP_CMD="pip3"
    fi
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1)
    log_message "Node.js: FOUND - $NODE_VERSION"
else
    log_message "Node.js: NOT FOUND"
    handle_error "Node.js Check" "Node.js is not installed" "true"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version 2>&1)
    log_message "npm: FOUND - v$NPM_VERSION"
else
    log_message "npm: NOT FOUND"
    handle_error "npm Check" "npm is not installed" "true"
fi

log_message ""
log_message "=== Setting Up Python Environment ==="

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    log_message "Creating Python virtual environment..."
    if [ -n "$PYTHON_CMD" ]; then
        cmd_with_log "$PYTHON_CMD -m venv venv" "Creating venv"
        if [ $? -ne 0 ]; then
            handle_error "Venv Creation" "Failed to create virtual environment" "true"
        fi
    else
        handle_error "Venv Creation" "Cannot create venv - Python not available" "true"
    fi
else
    log_message "Virtual environment already exists"
fi

# Activate virtual environment
log_message "Activating virtual environment..."
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    log_message "Virtual environment activated"
    
    # Check which python/pip in venv
    VENV_PYTHON=$(which python)
    VENV_PIP=$(which pip)
    log_message "Venv Python: $VENV_PYTHON"
    log_message "Venv pip: $VENV_PIP"
else
    handle_error "Venv Activation" "venv/bin/activate not found" "true"
fi

# Install Python dependencies
log_message ""
log_message "=== Installing Python Dependencies ==="
if command -v pip &> /dev/null; then
    cmd_with_log "pip install --upgrade pip" "Upgrading pip"
    cmd_with_log "pip install -r requirements.txt" "Installing requirements from requirements.txt"
    if [ $? -ne 0 ]; then
        log_message "requirements.txt install failed, trying individual packages..."
        cmd_with_log "pip install fastapi uvicorn pandas numpy ccxt eth-account hyperliquid-python-sdk websockets python-dotenv pydantic" "Installing core Python packages"
    fi
else
    handle_error "Python Dependencies" "pip not available in venv" "true"
fi

# Start FastAPI backend
log_message ""
log_message "=== Starting FastAPI Trading Engine ==="
log_message "Attempting to start backend on http://localhost:8000"

# Check if main.py exists
if [ -f "src/api/main.py" ]; then
    log_message "Found: src/api/main.py"
elif [ -f "main.py" ]; then
    log_message "Found: main.py"
else
    log_message "WARNING: main.py not found in expected locations"
    log_message "Searching for main.py..."
    find . -name "main.py" -type f 2>/dev/null | head -5 | while read line; do
        log_message "  Found: $line"
    done
fi

# Try to start Python backend
log_message "Starting Python backend process..."
if [ -f "src/api/main.py" ]; then
    python -m src.api.main >> "$LOG_FILE" 2>&1 &
    BACKEND_PID=$!
elif [ -f "main.py" ]; then
    python main.py >> "$LOG_FILE" 2>&1 &
    BACKEND_PID=$!
else
    log_message "ERROR: Cannot find main.py to start backend"
    BACKEND_PID=""
fi

if [ -n "$BACKEND_PID" ]; then
    log_message "Backend started with PID: $BACKEND_PID"
    
    # Wait for backend to initialize
    log_message "Waiting 5 seconds for backend initialization..."
    sleep 5
    
    # Check if process is still running
    if ps -p $BACKEND_PID > /dev/null; then
        log_message "Backend process is running (PID: $BACKEND_PID)"
    else
        log_message "WARNING: Backend process exited early"
        log_message "Check log file for errors: $LOG_FILE"
    fi
else
    log_message "WARNING: Backend not started - will continue with frontend only"
fi

# Setup and start Node.js frontend
log_message ""
log_message "=== Setting Up Node.js Frontend ==="

# Check if UI directory exists
if [ -d "src/ui" ]; then
    log_message "Found: src/ui directory"
    cd src/ui
    log_message "Changed to directory: $PWD"
else
    handle_error "UI Directory" "src/ui directory not found" "true"
fi

# Install Node.js dependencies
log_message "Installing Node.js dependencies..."
cmd_with_log "npm install" "npm install"

if [ $? -ne 0 ]; then
    log_message "WARNING: npm install had errors, attempting to continue..."
    log_message "Trying npm install with legacy peer deps..."
    cmd_with_log "npm install --legacy-peer-deps" "npm install --legacy-peer-deps"
fi

log_message ""
log_message "=== Installing Missing Dependencies ==="

log_message "Installing pino-pretty..."
npm install pino-pretty --save-dev --force >> "$LOG_FILE" 2>&1 || log_message "WARNING: pino-pretty install had issues"

log_message "Installing async-storage..."
npm install @react-native-async-storage/async-storage --save-dev --force >> "$LOG_FILE" 2>&1 || log_message "WARNING: async-storage install had issues"

log_message "Installing walletconnect packages..."
npm install @walletconnect/ethereum-provider @walletconnect/universal-provider --save --legacy-peer-deps >> "$LOG_FILE" 2>&1 || log_message "WARNING: walletconnect install had issues"

log_message "Dependency installation complete"

# Start Next.js frontend
log_message ""
log_message "=== Starting Next.js Dashboard ==="
log_message "Attempting to start frontend on http://localhost:3000"

npm run dev >> "$LOG_FILE" 2>&1 &
FRONTEND_PID=$!
log_message "Frontend started with PID: $FRONTEND_PID"

# Wait for frontend to initialize
log_message "Waiting 5 seconds for frontend initialization..."
sleep 5

# Check if frontend process is running
if ps -p $FRONTEND_PID > /dev/null; then
    log_message "Frontend process is running (PID: $FRONTEND_PID)"
else
    log_message "WARNING: Frontend process exited early"
    log_message "Check log file for errors: $LOG_FILE"
fi

# Final status report
cat << EOF | tee -a "$LOG_FILE"

==========================================
OpenAlgo Launch Status Report
==========================================
Log File: $LOG_FILE
Completed: $(date "+%Y-%m-%d %H:%M:%S")
Working Directory: $PWD

Process Status:
EOF

if [ -n "$BACKEND_PID" ] && ps -p $BACKEND_PID > /dev/null; then
    log_message "✓ Backend (FastAPI): RUNNING (PID: $BACKEND_PID)"
else
    log_message "✗ Backend (FastAPI): NOT RUNNING"
fi

if ps -p $FRONTEND_PID > /dev/null; then
    log_message "✓ Frontend (Next.js): RUNNING (PID: $FRONTEND_PID)"
else
    log_message "✗ Frontend (Next.js): NOT RUNNING"
fi

cat << EOF | tee -a "$LOG_FILE"

Access Points:
- Dashboard: http://localhost:3000 (or next available port)
- API Docs: http://localhost:8000/docs

Log File Location:
$LOG_FILE

Press Ctrl+C to stop all services
==========================================

IMPORTANT NOTES:
- This script created a NEW log file: $LOG_FILE
- Each run creates a unique timestamped log
- Previous logs are preserved
- All output (stdout + stderr) is captured
- Errors are logged but execution continues

EOF

# Setup cleanup trap
cleanup() {
    log_message ""
    log_message "=========================================="
    log_message "Shutdown initiated at $(date "+%Y-%m-%d %H:%M:%S")"
    log_message "Stopping services..."
    
    if [ -n "$BACKEND_PID" ]; then
        log_message "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null
        sleep 1
    fi
    
    log_message "Stopping frontend (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null
    sleep 1
    
    log_message "Services stopped"
    log_message "Final log saved to: $LOG_FILE"
    log_message "=========================================="
    exit 0
}

trap cleanup INT TERM

# Wait for processes
echo ""
echo "Services are running. Press Ctrl+C to stop."
echo "Monitor the log file: tail -f $LOG_FILE"
echo ""

# Keep script running and monitor processes
while true; do
    sleep 5
    
    # Check if both processes are still running
    BACKEND_RUNNING=false
    FRONTEND_RUNNING=false
    
    if [ -n "$BACKEND_PID" ] && ps -p $BACKEND_PID > /dev/null; then
        BACKEND_RUNNING=true
    fi
    
    if ps -p $FRONTEND_PID > /dev/null; then
        FRONTEND_RUNNING=true
    fi
    
    if [ "$BACKEND_RUNNING" = false ] && [ "$FRONTEND_RUNNING" = false ]; then
        log_message ""
        log_message "=========================================="
        log_message "WARNING: Both processes have exited"
        log_message "Time: $(date "+%Y-%m-%d %H:%M:%S")"
        log_message "Check log file for errors: $LOG_FILE"
        log_message "=========================================="
        break
    fi
done

wait
