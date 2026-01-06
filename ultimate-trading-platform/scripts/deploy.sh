#!/bin/bash

# Deployment Script for Ultimate Trading Platform
# Supports both Puter.js cloud deployment and manual deployment

set -e

echo "🚀 Starting deployment of Ultimate Trading Platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."

    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 16+ and try again."
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js version 16+ is required. Current version: $(node -v)"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi

    print_status "All dependencies satisfied ✓"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."

    if [ ! -d "node_modules" ]; then
        npm install
        print_status "Dependencies installed ✓"
    else
        print_status "Dependencies already installed ✓"
    fi
}

# Run linting
run_linting() {
    print_status "Running linter..."

    if npm run lint; then
        print_status "Linting passed ✓"
    else
        print_warning "Linting issues found. Fixing automatically..."
        # ESLint can auto-fix some issues
        npx eslint *.js services/*.js --fix
        print_status "Auto-fix applied ✓"
    fi
}

# Run tests
run_tests() {
    print_status "Running tests..."

    if npm test; then
        print_status "All tests passed ✓"
        return 0
    else
        print_error "Tests failed. Please fix issues before deployment."
        return 1
    fi
}

# Build for production
build_project() {
    print_status "Building for production..."

    # Clean previous builds
    rm -rf dist/

    # Create dist directory
    mkdir -p dist

    # Copy files
    cp -r assets dist/
    cp -r services dist/
    cp -r config dist/
    cp -r examples dist/
    cp -r docs dist/
    cp *.html dist/
    cp *.js dist/
    cp *.json dist/
    cp *.md dist/

    # Minify JavaScript (if minification tools are available)
    if command -v uglifyjs &> /dev/null; then
        print_status "Minifying JavaScript..."
        uglifyjs dist/ultimate-trading-app.js -o dist/ultimate-trading-app.min.js
        uglifyjs dist/services/*.js -o dist/services/bundle.min.js
        print_status "JavaScript minified ✓"
    else
        print_warning "uglifyjs not found. Skipping minification."
    fi

    # Minify CSS (if minification tools are available)
    if command -v cleancss &> /dev/null; then
        print_status "Minifying CSS..."
        cleancss -o dist/assets/styles.min.css dist/assets/styles.css
        print_status "CSS minified ✓"
    else
        print_warning "cleancss not found. Skipping CSS minification."
    fi

    print_status "Build completed ✓"
}

# Deploy to Puter.js
deploy_to_puter() {
    print_status "Deploying to Puter.js..."

    if ! command -v puter &> /dev/null; then
        print_warning "Puter.js CLI not found. Installing..."
        npm install -g puter
    fi

    # Check if user is logged in
    if ! puter auth status &> /dev/null; then
        print_status "Please log in to Puter.js..."
        puter auth login
    fi

    # Deploy
    print_status "Deploying application..."
    puter deploy \
        --app-path . \
        --app-name "Ultimate Trading Platform" \
        --description "Professional algorithmic trading platform with AI-powered strategies"

    print_status "Deployment successful! ✓"
    print_status "Your app is now available at: https://app.puter.com/[username]/ultimate-trading-platform"
}

# Deploy manually to web server
deploy_manual() {
    print_status "Preparing manual deployment..."

    DEPLOY_DIR="${1:-./dist}"

    if [ ! -d "$DEPLOY_DIR" ]; then
        print_error "Deployment directory not found: $DEPLOY_DIR"
        print_status "Please run build first: npm run build"
        exit 1
    fi

    print_status "Deployment package ready at: $DEPLOY_DIR"
    print_status "Copy contents to your web server's document root"
    print_status "Ensure your web server supports:"
    print_status "  - HTTPS (required for WebSocket connections)"
    print_status "  - GZIP compression"
    print_status "  - Cache headers for static assets"
}

# Main deployment flow
main() {
    echo "======================================"
    echo "  Ultimate Trading Platform Deployer"
    echo "======================================"
    echo

    # Parse command line arguments
    DEPLOY_TARGET="puter"
    while [[ $# -gt 0 ]]; do
        case $1 in
            --target)
                DEPLOY_TARGET="$2"
                shift 2
                ;;
            --manual)
                DEPLOY_TARGET="manual"
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo
                echo "Options:"
                echo "  --target TYPE    Deployment target (puter|manual) [default: puter]"
                echo "  --manual         Deploy to local directory"
                echo "  --skip-tests     Skip running tests"
                echo "  --help           Show this help message"
                echo
                echo "Examples:"
                echo "  $0                           # Deploy to Puter.js"
                echo "  $0 --target manual           # Manual deployment"
                echo "  $0 --skip-tests              # Skip tests"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                print_status "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    # Run deployment steps
    check_dependencies
    install_dependencies
    run_linting

    if [ "$SKIP_TESTS" != true ]; then
        if ! run_tests; then
            print_error "Deployment aborted due to test failures"
            exit 1
        fi
    else
        print_warning "Skipping tests as requested"
    fi

    build_project

    # Deploy based on target
    case $DEPLOY_TARGET in
        puter)
            deploy_to_puter
            ;;
        manual)
            deploy_manual "./dist"
            ;;
        *)
            print_error "Unknown deployment target: $DEPLOY_TARGET"
            exit 1
            ;;
    esac

    echo
    echo "======================================"
    print_status "Deployment completed successfully! 🎉"
    echo "======================================"
    echo
    print_status "Next steps:"
    echo "  1. Visit your deployed application"
    echo "  2. Configure your API keys in settings"
    echo "  3. Select a subscription tier"
    echo "  4. Deploy your first trading strategy"
    echo
    print_status "Documentation: ./docs/API.md"
    print_status "Examples: ./examples/demo-config.json"
    echo
}

# Run main function
main "$@"
