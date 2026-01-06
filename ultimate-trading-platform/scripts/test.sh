#!/bin/bash

# Test runner for Ultimate Trading Platform

set -e

echo "🧪 Running Ultimate Trading Platform Tests..."
echo

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

print_fail() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run Jest tests
echo "Running unit tests..."
if npm test; then
    print_pass "All unit tests passed"
else
    print_fail "Some tests failed"
    exit 1
fi

# Run linting
echo
echo "Running linter..."
if npm run lint; then
    print_pass "Linting passed"
else
    print_fail "Linting issues found"
    exit 1
fi

# Run type checking (if available)
echo
echo "Checking code quality..."
npx eslint *.js services/*.js --quiet
print_pass "Code quality check passed"

# Generate coverage report
echo
echo "Generating coverage report..."
npx jest --coverage --coverageReporters=text-lcov > coverage/lcov.info 2>/dev/null || true
print_pass "Coverage report generated"

echo
echo "================================"
print_pass "All tests completed successfully!"
echo "================================"
