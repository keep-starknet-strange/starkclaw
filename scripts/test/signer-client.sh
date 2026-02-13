#!/bin/bash
#
# Signer Client Test Runner
#
# Runs signer client tests only (fast path for CI)
# Issue: #54
#

set -e

echo "========================================="
echo "Signer Client Tests"
echo "========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "apps/mobile/lib/signer" ]; then
  echo -e "${RED}Error: Must run from repository root${NC}"
  exit 1
fi

echo -e "${YELLOW}Running signer client unit tests...${NC}"
npm --prefix apps/mobile test -- --run lib/signer/__tests__/client.test.ts

echo ""
echo -e "${YELLOW}Running signer client mock server integration tests...${NC}"
npm --prefix apps/mobile test -- --run lib/signer/__tests__/client.mock-server.test.ts

echo ""
echo -e "${GREEN}✓ All signer client tests passed!${NC}"
echo ""

# Optional: Run with coverage
if [ "${1:-}" = "--coverage" ]; then
  echo -e "${YELLOW}Generating coverage report...${NC}"
  npm --prefix apps/mobile test -- --run --coverage lib/signer
fi

echo "========================================="
echo "Test Summary"
echo "========================================="
echo "Module: Signer Client"
echo "Scope: #54 groundwork only"
echo "Status: ✅ PASSED"
echo ""
