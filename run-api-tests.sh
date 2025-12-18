#!/bin/bash

# ESP RGBWW API Test Runner
# Convenience script for running API integration tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default controller URL
DEFAULT_CONTROLLER="http://192.168.29.31"
CONTROLLER_URL="${TEST_CONTROLLER_URL:-$DEFAULT_CONTROLLER}"

echo -e "${BLUE}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ESP RGBWW Firmware API Integration Tests   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# Check if controller URL is provided
if [ -z "$TEST_CONTROLLER_URL" ]; then
    echo -e "${YELLOW}⚠ No TEST_CONTROLLER_URL set, using default: ${DEFAULT_CONTROLLER}${NC}"
    echo -e "${YELLOW}  Set custom URL: export TEST_CONTROLLER_URL=http://your-ip${NC}"
else
    echo -e "${GREEN}✓ Using controller: ${CONTROLLER_URL}${NC}"
fi
echo ""

# Test connectivity
echo -e "${BLUE}Testing controller connectivity...${NC}"
if curl -s --max-time 5 "${CONTROLLER_URL}/ping" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Controller reachable at ${CONTROLLER_URL}${NC}"

    # Get controller info
    DEVICE_INFO=$(curl -s "${CONTROLLER_URL}/info" | grep -o '"deviceid":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$DEVICE_INFO" ]; then
        echo -e "${GREEN}✓ Device ID: ${DEVICE_INFO}${NC}"
    fi
else
    echo -e "${RED}✗ Cannot reach controller at ${CONTROLLER_URL}${NC}"
    echo -e "${RED}  Please check:${NC}"
    echo -e "${RED}  1. Controller is powered on${NC}"
    echo -e "${RED}  2. Controller is connected to network${NC}"
    echo -e "${RED}  3. IP address is correct${NC}"
    echo -e "${RED}  4. Try: ping ${CONTROLLER_URL#http://}${NC}"
    exit 1
fi
echo ""

# Parse command line arguments
TEST_FILTER=""
WATCH_MODE=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--test)
            TEST_FILTER="$2"
            shift 2
            ;;
        -w|--watch)
            WATCH_MODE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./run-api-tests.sh [options]"
            echo ""
            echo "Options:"
            echo "  -t, --test <pattern>   Run tests matching pattern"
            echo "  -w, --watch           Run in watch mode"
            echo "  -v, --verbose         Verbose output"
            echo "  -h, --help            Show this help"
            echo ""
            echo "Examples:"
            echo "  ./run-api-tests.sh                    # Run all tests"
            echo "  ./run-api-tests.sh -t 'GET /data'     # Run data endpoint tests"
            echo "  ./run-api-tests.sh -t 'Color' -v      # Run color tests (verbose)"
            echo "  ./run-api-tests.sh -w                 # Watch mode"
            echo ""
            echo "Test Suites:"
            echo "  - 'System Information'   (ping, info)"
            echo "  - 'GET /data'            (retrieve app data)"
            echo "  - 'POST /data'           (update app data)"
            echo "  - 'Configuration'        (config endpoints)"
            echo "  - 'Color'                (color control)"
            echo "  - 'Animation'            (animation control)"
            echo "  - 'Network'              (network management)"
            echo "  - 'System Control'       (system commands)"
            echo "  - 'OTA'                  (OTA updates)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Build test command
TEST_CMD="npm test -- src/services/__tests__/api.integration.spec.js"

if [ -n "$TEST_FILTER" ]; then
    echo -e "${BLUE}Running tests matching: '${TEST_FILTER}'${NC}"
    TEST_CMD="$TEST_CMD -t \"$TEST_FILTER\""
else
    echo -e "${BLUE}Running all API integration tests...${NC}"
fi

if [ "$WATCH_MODE" = true ]; then
    echo -e "${YELLOW}Watch mode enabled (press 'q' to quit)${NC}"
    TEST_CMD="$TEST_CMD --watch"
fi

if [ "$VERBOSE" = true ]; then
    TEST_CMD="$TEST_CMD --reporter=verbose"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# Export controller URL for tests
export TEST_CONTROLLER_URL="$CONTROLLER_URL"

# Run tests
eval $TEST_CMD

TEST_EXIT_CODE=$?

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
else
    echo -e "${RED}✗ Some tests failed (exit code: $TEST_EXIT_CODE)${NC}"
    echo -e "${YELLOW}  Check output above for details${NC}"
fi

exit $TEST_EXIT_CODE
