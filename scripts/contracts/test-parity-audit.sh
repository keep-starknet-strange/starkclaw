#!/usr/bin/env bash
# test-parity-audit.sh — TDD-style tests for check-session-account-parity.sh
# Run as: ./scripts/contracts/test-parity-audit.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARITY_SCRIPT="$SCRIPT_DIR/check-session-account-parity.sh"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
UPSTREAM_REAL="${UPSTREAM_SESSION_ACCOUNT_PATH:-$ROOT_DIR/../starknet-agentic/contracts/session-account}"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

run_test() {
  local name="$1"
  local expected_exit="$2"
  shift 2
  local actual_exit=0
  local output_file
  output_file=$(mktemp)
  if "$@" >"$output_file" 2>&1; then
    actual_exit=0
  else
    actual_exit=$?
  fi
  if [[ "$actual_exit" -eq "$expected_exit" ]]; then
    echo -e "${GREEN}PASS${NC}: $name"
    rm -f "$output_file"
    return 0
  else
    echo -e "${RED}FAIL${NC}: $name (expected exit $expected_exit, got $actual_exit)"
    echo "--- Command output ($name) ---"
    sed -n '1,120p' "$output_file"
    echo "--- End output ---"
    rm -f "$output_file"
    return 1
  fi
}

run_test_json() {
  local name="$1"
  local jq_filter="$2"
  shift 2
  local out
  out=$("$@" 2>/dev/null) || true
  if echo "$out" | jq -e "$jq_filter" >/dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}: $name"
    return 0
  else
    echo -e "${RED}FAIL${NC}: $name (jq filter: $jq_filter)"
    echo "$out" | head -3
    return 1
  fi
}

FAILED=0

echo "=== Parity script TDD audit ==="
echo "Using UPSTREAM_REAL=$UPSTREAM_REAL"
if [[ -d "$UPSTREAM_REAL" ]]; then
  echo "Upstream path exists. Listing key files:"
  ls -1 "$UPSTREAM_REAL"/src/lib.cairo "$UPSTREAM_REAL"/src/account.cairo "$UPSTREAM_REAL"/src/spending_policy.cairo "$UPSTREAM_REAL"/src/spending_policy/interface.cairo "$UPSTREAM_REAL"/src/spending_policy/component.cairo "$UPSTREAM_REAL"/Scarb.toml 2>/dev/null || true
else
  echo "WARNING: upstream path does not exist"
fi

# 1. Valid upstream → exit 0, pass=true
run_test "Valid upstream exits 0" 0 \
  env UPSTREAM_SESSION_ACCOUNT_PATH="$UPSTREAM_REAL" "$PARITY_SCRIPT" || ((FAILED++))
run_test_json "Valid upstream pass=true" '.pass == true' \
  env UPSTREAM_SESSION_ACCOUNT_PATH="$UPSTREAM_REAL" "$PARITY_SCRIPT" || ((FAILED++))

# 2. Missing upstream → exit 1, pass=false
run_test "Missing upstream exits 1" 1 \
  env UPSTREAM_SESSION_ACCOUNT_PATH="/nonexistent/path/xyz" "$PARITY_SCRIPT" || ((FAILED++))
run_test_json "Missing upstream pass=false" '.pass == false' \
  env UPSTREAM_SESSION_ACCOUNT_PATH="/nonexistent/path/xyz" "$PARITY_SCRIPT" 2>/dev/null || true
[[ $(env UPSTREAM_SESSION_ACCOUNT_PATH="/nonexistent" "$PARITY_SCRIPT" 2>/dev/null | jq -r '.pass') == "false" ]] && echo -e "${GREEN}PASS${NC}: Missing upstream pass=false" || { echo -e "${RED}FAIL${NC}: Missing upstream pass"; ((FAILED++)); }

# 3. JSON output is valid
run_test_json "Output is valid JSON" '.' \
  env UPSTREAM_SESSION_ACCOUNT_PATH="$UPSTREAM_REAL" "$PARITY_SCRIPT" || ((FAILED++))

# 4. Required keys in JSON
run_test_json "JSON has required keys" '. | keys | index("upstream_path") and index("pass") and index("missing_files") and index("summary")' \
  env UPSTREAM_SESSION_ACCOUNT_PATH="$UPSTREAM_REAL" "$PARITY_SCRIPT" || ((FAILED++))

# 5. OUTPUT_JSON writes file
TMP_JSON=$(mktemp)
env UPSTREAM_SESSION_ACCOUNT_PATH="$UPSTREAM_REAL" PARITY_OUTPUT_JSON="$TMP_JSON" "$PARITY_SCRIPT" >/dev/null
if [[ -f "$TMP_JSON" ]] && jq -e '.' "$TMP_JSON" >/dev/null; then
  echo -e "${GREEN}PASS${NC}: OUTPUT_JSON writes valid file"
else
  echo -e "${RED}FAIL${NC}: OUTPUT_JSON"
  ((FAILED++))
fi
rm -f "$TMP_JSON"

# 6. OUTPUT_MD writes file
TMP_MD=$(mktemp)
env UPSTREAM_SESSION_ACCOUNT_PATH="$UPSTREAM_REAL" PARITY_OUTPUT_MD="$TMP_MD" "$PARITY_SCRIPT" >/dev/null
if [[ -f "$TMP_MD" ]] && grep -q "Session Account Parity Report" "$TMP_MD"; then
  echo -e "${GREEN}PASS${NC}: OUTPUT_MD writes report"
else
  echo -e "${RED}FAIL${NC}: OUTPUT_MD"
  ((FAILED++))
fi
rm -f "$TMP_MD"

# 7. Partial upstream (missing file) → fail
TMP_PARTIAL=$(mktemp -d)
mkdir -p "$TMP_PARTIAL/src/spending_policy"
touch "$TMP_PARTIAL/Scarb.toml" "$TMP_PARTIAL/src/lib.cairo" "$TMP_PARTIAL/src/account.cairo"
touch "$TMP_PARTIAL/src/spending_policy.cairo" "$TMP_PARTIAL/src/spending_policy/interface.cairo"
# Missing component.cairo
run_test "Partial upstream (missing file) exits 1" 1 \
  env UPSTREAM_SESSION_ACCOUNT_PATH="$TMP_PARTIAL" "$PARITY_SCRIPT" || ((FAILED++))
run_test_json "Partial upstream missing_files non-empty" '.missing_files | length > 0' \
  env UPSTREAM_SESSION_ACCOUNT_PATH="$TMP_PARTIAL" "$PARITY_SCRIPT" 2>/dev/null || true
rm -rf "$TMP_PARTIAL"

# 8. Determinism: same input → same output
OUT1=$(env UPSTREAM_SESSION_ACCOUNT_PATH="$UPSTREAM_REAL" "$PARITY_SCRIPT" 2>/dev/null)
OUT2=$(env UPSTREAM_SESSION_ACCOUNT_PATH="$UPSTREAM_REAL" "$PARITY_SCRIPT" 2>/dev/null)
if [[ "$OUT1" == "$OUT2" ]]; then
  echo -e "${GREEN}PASS${NC}: Deterministic output"
else
  echo -e "${RED}FAIL${NC}: Non-deterministic output"
  ((FAILED++))
fi

echo ""
if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}All tests passed.${NC}"
  exit 0
else
  echo -e "${RED}$FAILED test(s) failed.${NC}"
  exit 1
fi
