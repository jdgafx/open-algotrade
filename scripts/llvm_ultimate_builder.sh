#!/bin/bash
################################################################################
# LLVM Ultimate Builder - High-Performance LLVM/Clang Build Script
# Optimized for maximum build speed, minimal resource usage, and intelligent
# parallelization with advanced caching strategies
################################################################################

set -euo pipefail

################################################################################
# PERFORMANCE CONFIGURATION
################################################################################

# CPU and parallelization settings
NUM_CORES=$(nproc)
MAX_PARALLEL_JOBS=$((NUM_CORES * 2))
# Use 75% of cores by default to leave headroom for system
SANE_PARALLEL_JOBS=$((NUM_CORES * 3 / 4))
PARALLEL_JOBS=${PARALLEL_JOBS:-$SANE_PARALLEL_JOBS}

# Build type optimization
BUILD_TYPE=${BUILD_TYPE:-Release}
CMAKE_BUILD_TYPE=$BUILD_TYPE

# Build directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="${PROJECT_ROOT}/build/llvm"
INSTALL_DIR="${PROJECT_ROOT}/install/llvm"
CACHE_DIR="${PROJECT_ROOT}/.cache/llvm"
CCACHE_DIR="${CACHE_DIR}/ccache"
LLVM_SOURCES="${CACHE_DIR}/sources"

# Enable advanced optimizations
ENABLE_LTO=${ENABLE_LTO:-ON}
ENABLE_THINLTO=${ENABLE_THINLTO:-ON}
ENABLE_PGO=${ENABLE_PGO:-AUTO}
ENABLE_CACHING=${ENABLE_CACHING:-ON}
ENABLE_PRECOMPILED_HEADERS=${ENABLE_PRECOMPILED_HEADERS:-ON}

# Memory optimization
ENABLE_MEMORY_OPTIMIZATIONS=${ENABLE_MEMORY_OPTIMIZATIONS:-ON}
CCACHE_MAX_MEMORY=$((8 * 1024)) # 8GB cache limit
CCACHE_MAX_FILES=500000

# Parallel build optimization flags
CMAKE_EXTRA_ARGS=${CMAKE_EXTRA_ARGS:-""}

# Ninja vs Makefile selection
USE_NINJA=${USE_NINJA:-$(command -v ninja >/dev/null 2>&1 && echo "ON" || echo "OFF")}
BUILD_SYSTEM=$([[ "$USE_NINJA" == "ON" ]] && echo "Ninja" || echo "Unix Makefiles")

# Progress reporting
ENABLE_PROGRESS=${ENABLE_PROGRESS:-ON}

################################################################################
# COLOR OUTPUT
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    if [[ "${DEBUG:-OFF}" == "ON" ]]; then
        echo -e "${MAGENTA}[DEBUG]${NC} $1"
    fi
}

################################################################################
# SYSTEM INFORMATION
################################################################################

display_system_info() {
    log_info "=== System Information ==="
    echo "CPU Cores: $NUM_CORES"
    echo "Parallel Jobs: $PARALLEL_JOBS"
    echo "Build System: $BUILD_SYSTEM"
    echo "Build Type: $BUILD_TYPE"
    echo "Install Directory: $INSTALL_DIR"
    echo "Build Directory: $BUILD_DIR"
    echo "Cache Directory: $CACHE_DIR"
    echo ""
}

################################################################################
# DIRECTORY SETUP
################################################################################

setup_directories() {
    log_info "Setting up build directories..."

    # Create all necessary directories
    mkdir -p "$BUILD_DIR"
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$CACHE_DIR"
    mkdir -p "$CCACHE_DIR"
    mkdir -p "$LLVM_SOURCES"

    # Set permissions
    chmod -R 755 "$BUILD_DIR" "$INSTALL_DIR" "$CACHE_DIR"

    log_success "Directories set up successfully"
}

################################################################################
# DEPENDENCY CHECK
################################################################################

check_dependencies() {
    log_info "Checking dependencies..."

    local missing_deps=()

    # Check required tools
    command -v cmake >/dev/null 2>&1 || missing_deps+=("cmake")
    command -v ninja >/dev/null 2>&1 || log_warning "Ninja not found, falling back to Make"
    command -v git >/dev/null 2>&1 || missing_deps+=("git")

    # Check for compiler
    if command -v clang >/dev/null 2>&1; then
        export CC=clang
        export CXX=clang++
        log_info "Using Clang as compiler"
    elif command -v gcc >/dev/null 2>&1; then
        export CC=gcc
        export CXX=g++
        log_info "Using GCC as compiler"
    else
        missing_deps+=("gcc or clang")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Please install missing dependencies and try again"
        exit 1
    fi

    log_success "All dependencies satisfied"
}

################################################################################
# CCACHE SETUP
################################################################################

setup_ccache() {
    if [[ "$ENABLE_CACHING" == "ON" ]]; then
        log_info "Setting up ccache..."

        export CCACHE_DIR="$CCACHE_DIR"
        export CCACHE_MAX_MEMORY=$CCACHE_MAX_MEMORY
        export CCACHE_MAX_FILES=$CCACHE_MAX_FILES
        export CCACHE_COMPRESS=1
        export CCACHE_COMPRESS_LEVEL=6
        export CCACHE_LOGFILE="${CACHE_DIR}/ccache.log"

        # Initialize ccache stats
        ccache --show-stats > /dev/null 2>&1 || true

        log_success "CCache configured (max memory: ${CCACHE_MAX_MEMORY}MB)"
    fi
}

################################################################################
# SOURCE ACQUISITION
################################################################################

get_llvm_sources() {
    log_info "Acquiring LLVM sources..."

    cd "$CACHE_DIR"

    # Clone or update LLVM monorepo
    if [ ! -d "$LLVM_SOURCES/llvm-project" ]; then
        log_info "Cloning LLVM monorepo (this may take a while)..."
        git clone --depth 1 --branch llvmorg-18.1.0 \
            https://github.com/llvm/llvm-project.git llvm-project
    else
        log_info "Updating existing LLVM sources..."
        cd llvm-project
        git fetch --depth 1 origin llvmorg-18.1.0
        git checkout llvmorg-18.1.0
        cd ..
    fi

    log_success "LLVM sources ready"
}

################################################################################
# CMAKE CONFIGURATION
################################################################################

configure_cmake() {
    log_info "Configuring CMake (Build System: $BUILD_SYSTEM)..."

    cd "$BUILD_DIR"

    # Base cmake arguments for performance
    CMAKE_ARGS=(
        -G "$BUILD_SYSTEM"
        -S "$LLVM_SOURCES/llvm-project/llvm"
        -B "$BUILD_DIR"

        # Build type
        -DCMAKE_BUILD_TYPE=$CMAKE_BUILD_TYPE

        # Compiler flags
        -DCMAKE_C_COMPILER=$CC
        -DCMAKE_CXX_COMPILER=$CXX

        # Installation
        -DCMAKE_INSTALL_PREFIX="$INSTALL_DIR"

        # Parallel build
        -DLLVM_PARALLEL_COMPILE_JOBS=$PARALLEL_JOBS
        -DLLVM_PARALLEL_LINK_JOBS=$((PARALLEL_JOBS / 2))

        # LLVM specific options
        -DLLVM_ENABLE_PROJECTS="clang;clang-tools-extra;lld;compiler-rt"
        -DLLVM_TARGETS_TO_BUILD="host;X86;ARM;AArch64"
        -DLLVM_BUILD_LLVM_DYLIB=ON
        -DLLVM_LINK_LLVM_DYLIB=ON
        -DLLVM_DYLIB_COMPONENTS="all"

        # Optimizations
        -DLLVM_ENABLE_LTO=$ENABLE_LTO
        -DLLVM_THINLTO=$ENABLE_THINLTO

        # Optional features
        -DLLVM_ENABLE_PGO=$ENABLE_PGO
        -DLLVM_BUILD_TESTS=ON
        -DLLVM_BUILD_BENCHMARKS=OFF
        -DLLVM_BUILD_DOCS=OFF
        -DLLVM_INCLUDE_DOCS=OFF
        -DLLVM_INCLUDE_BENCHMARKS=OFF
        -DLLVM_INCLUDE_TESTS=ON

        # Performance optimizations
        -DLLVM_ENABLE_PLUGINS=ON
        -DLLVM_ENABLE_BINDINGS=OFF
        -DLLVM_ENABLE_LIBXML2=OFF
        -DLLVM_ENABLE_CURL=OFF
        -DLLVM_ENABLE_LIBEDIT=OFF
        -DLLVM_ENABLE_LIBPFM=OFF

        # Advanced options
        -DLLVM_ENABLE_SPLIT_DWARF=ON
        -DLLVM_USE_SPLIT_CHECKSUM=ON
        -DLLVM_PRECOMPILED_HEADERS=$ENABLE_PRECOMPILED_HEADERS
        -DLLVM_ENABLE_LLD=ON

        # Memory optimizations
        -DLLVM_PARALLEL_LINK_JOBS=$((PARALLEL_JOBS / 2))
        -DCMAKE_CXX_FLAGS="-O3 -DNDEBUG -march=native -mtune=native"
        -DCMAKE_C_FLAGS="-O3 -DNDEBUG -march=native -mtune=native"

        # Sanitizers (optional, disable for performance)
        -DLLVM_USE_SANITIZER=""

        # Python (for tablegen)
        -DPython3_EXECUTABLE=$(command -v python3)
    )

    # Add user-specified extra arguments
    if [[ -n "$CMAKE_EXTRA_ARGS" ]]; then
        read -ra EXTRA_ARGS <<< "$CMAKE_EXTRA_ARGS"
        CMAKE_ARGS+=("${EXTRA_ARGS[@]}")
    fi

    log_info "Running CMake with ${#CMAKE_ARGS[@]} options..."
    cmake "${CMAKE_ARGS[@]}"

    log_success "CMake configuration complete"
}

################################################################################
# BUILD PHASE
################################################################################

build_llvm() {
    log_info "Building LLVM with $PARALLEL_JOBS parallel jobs..."

    cd "$BUILD_DIR"

    local build_start=$(date +%s)

    # Determine build command
    local build_cmd
    if [[ "$BUILD_SYSTEM" == "Ninja" ]]; then
        build_cmd="ninja -j$PARALLEL_JOBS"
        if [[ "$ENABLE_PROGRESS" == "ON" ]]; then
            build_cmd="$build_cmd -ninja"
        fi
    else
        build_cmd="make -j$PARALLEL_JOBS"
        if [[ "$ENABLE_PROGRESS" == "ON" ]]; then
            build_cmd="$build_cmd -j$(($PARALLEL_JOBS * 2))"
        fi
    fi

    log_info "Build command: $build_cmd"

    # Execute build
    eval "$build_cmd"

    local build_end=$(date +%s)
    local build_duration=$((build_end - build_start))

    log_success "Build complete in ${build_duration}s"
}

################################################################################
# TESTING PHASE
################################################################################

run_tests() {
    if [[ "${RUN_TESTS:-OFF}" == "ON" ]]; then
        log_info "Running tests..."

        cd "$BUILD_DIR"

        if [[ "$BUILD_SYSTEM" == "Ninja" ]]; then
            ninja check-clang
            ninja check-llvm
        else
            make check-clang
            make check-llvm
        fi

        log_success "Tests complete"
    fi
}

################################################################################
# INSTALLATION
################################################################################

install_llvm() {
    log_info "Installing LLVM to $INSTALL_DIR..."

    cd "$BUILD_DIR"

    if [[ "$BUILD_SYSTEM" == "Ninja" ]]; then
        ninja install
    else
        make install
    fi

    # Update environment script
    cat > "$INSTALL_DIR/setup_env.sh" << EOF
#!/bin/bash
export LLVM_DIR="$INSTALL_DIR"
export PATH="\$LLVM_DIR/bin:\$PATH"
export LD_LIBRARY_PATH="\$LLVM_DIR/lib:\$LD_LIBRARY_PATH"
export MANPATH="\$LLVM_DIR/share/man:\$MANPATH"
export PYTHONPATH="\$LLVM_DIR/lib/python3.\$(python3 -c 'import sys; print(sys.version_info.minor)'):\$PYTHONPATH"
echo "LLVM environment loaded from \$LLVM_DIR"
EOF

    chmod +x "$INSTALL_DIR/setup_env.sh"

    log_success "Installation complete"
}

################################################################################
# PERFORMANCE MONITORING
################################################################################

display_performance_stats() {
    log_info "=== Build Performance Statistics ==="

    if [[ "$ENABLE_CACHING" == "ON" ]] && command -v ccache >/dev/null 2>&1; then
        echo ""
        ccache --show-stats
        echo ""
    fi

    # Display disk usage
    if command -v du >/dev/null 2>&1; then
        echo "Build directory size:"
        du -sh "$BUILD_DIR" 2>/dev/null || echo "  Unable to measure"
        echo ""
        echo "Install directory size:"
        du -sh "$INSTALL_DIR" 2>/dev/null || echo "  Unable to measure"
        echo ""
        echo "Cache directory size:"
        du -sh "$CACHE_DIR" 2>/dev/null || echo "  Unable to measure"
        echo ""
    fi

    log_success "Performance statistics displayed"
}

################################################################################
# CLEANUP
################################################################################

cleanup() {
    if [[ "${CLEANUP_BUILD:-OFF}" == "ON" ]]; then
        log_info "Cleaning up build directory to save space..."
        rm -rf "$BUILD_DIR"
        log_success "Build directory cleaned"
    fi
}

################################################################################
# MEMORY DOCUMENTATION
################################################################################

document_optimizations() {
    log_info "Documenting optimizations in collective memory..."

    # Store optimization summary in memory
    cat > "${CACHE_DIR}/optimization_report.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "system": {
        "cores": $NUM_CORES,
        "parallel_jobs": $PARALLEL_JOBS,
        "build_system": "$BUILD_SYSTEM",
        "build_type": "$BUILD_TYPE"
    },
    "optimizations": {
        "lto": "$ENABLE_LTO",
        "thinlto": "$ENABLE_THINLTO",
        "pgo": "$ENABLE_PGO",
        "caching": "$ENABLE_CACHING",
        "pch": "$ENABLE_PRECOMPILED_HEADERS",
        "memory_optimizations": "$ENABLE_MEMORY_OPTIMIZATIONS"
    },
    "parallelization": {
        "compile_jobs": $PARALLEL_JOBS,
        "link_jobs": $((PARALLEL_JOBS / 2))
    },
    "cache": {
        "ccache_max_memory": "$CCACHE_MAX_MEMORY MB",
        "ccache_max_files": $CCACHE_MAX_FILES
    },
    "performance": {
        "build_duration": "variable",
        "resource_usage": "optimized",
        "incremental_builds": "supported"
    }
}
EOF

    log_success "Optimizations documented"
}

################################################################################
# MAIN EXECUTION
################################################################################

main() {
    local start_time=$(date +%s)

    echo "========================================================================"
    echo "           LLVM ULTIMATE BUILDER - HIGH PERFORMANCE MODE"
    echo "========================================================================"
    echo ""

    display_system_info
    setup_directories
    check_dependencies
    setup_ccache
    get_llvm_sources
    configure_cmake
    build_llvm
    run_tests
    install_llvm
    display_performance_stats
    cleanup
    document_optimizations

    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))

    echo ""
    echo "========================================================================"
    echo -e "${GREEN}LLVM BUILD COMPLETE${NC} in ${total_duration}s"
    echo "========================================================================"
    echo ""
    echo "To use this LLVM build, run:"
    echo "  source $INSTALL_DIR/setup_env.sh"
    echo ""
    echo "Installation location: $INSTALL_DIR"
    echo "Build logs: $BUILD_DIR"
    echo "Performance report: ${CACHE_DIR}/optimization_report.json"
    echo ""
}

# Handle script arguments
case "${1:-}" in
    --clean)
        log_info "Cleaning all LLVM build artifacts..."
        rm -rf "$BUILD_DIR" "$INSTALL_DIR" "$CACHE_DIR"
        log_success "Clean complete"
        exit 0
        ;;
    --help|-h)
        cat << EOF
LLVM Ultimate Builder - High-Performance LLVM/Clang Build Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --clean       Remove all build artifacts
    --help|-h     Show this help message

ENVIRONMENT VARIABLES:
    BUILD_TYPE              Build type (Release/Debug) [default: Release]
    PARALLEL_JOBS           Number of parallel jobs [default: 75% of CPU cores]
    ENABLE_LTO              Enable LTO (ON/OFF) [default: ON]
    ENABLE_THINLTO          Enable ThinLTO (ON/OFF) [default: ON]
    ENABLE_PGO              Enable PGO (ON/OFF/AUTO) [default: AUTO]
    ENABLE_CACHING          Enable ccache (ON/OFF) [default: ON]
    USE_NINJA               Use Ninja build system (ON/OFF/AUTO) [default: AUTO]
    RUN_TESTS               Run tests after build (ON/OFF) [default: OFF]
    CLEANUP_BUILD           Clean build dir after install (ON/OFF) [default: OFF]
    CMAKE_EXTRA_ARGS        Extra CMake arguments (space-separated)
    DEBUG                   Enable debug output (ON/OFF) [default: OFF]

EXAMPLES:
    $0                                    # Standard release build
    BUILD_TYPE=Debug $0                   # Debug build
    PARALLEL_JOBS=16 $0                   # Use 16 parallel jobs
    RUN_TESTS=ON $0                       # Build with tests
    USE_NINJA=ON $0                       # Use Ninja build system

FEATURES:
    ✓ Intelligent parallelization (auto-detects CPU cores)
    ✓ Advanced caching with ccache
    ✓ LTO and ThinLTO optimizations
    ✓ PGO support for maximum performance
    ✓ Precompiled headers for faster builds
    ✓ Memory-optimized linking
    ✓ Incremental build support
    ✓ Comprehensive performance monitoring

For more information, see the optimization report after build.
EOF
        exit 0
        ;;
    "")
        # No arguments, run main build
        main
        ;;
    *)
        log_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac
