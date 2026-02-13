#!/usr/bin/env bash
# check-session-account-parity.sh
# Deterministic script that checks expected upstream session-account files/interfaces exist.
# Outputs machine-readable summary (JSON + optional markdown).
#
# Usage:
#   ./scripts/contracts/check-session-account-parity.sh
#   UPSTREAM_SESSION_ACCOUNT_PATH=/path/to/session-account ./scripts/contracts/check-session-account-parity.sh
#
# Env:
#   UPSTREAM_SESSION_ACCOUNT_PATH - Path to starknet-agentic/contracts/session-account
#     Default: ../starknet-agentic/contracts/session-account (relative to script dir)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
UPSTREAM="${UPSTREAM_SESSION_ACCOUNT_PATH:-$ROOT_DIR/../starknet-agentic/contracts/session-account}"
OUTPUT_JSON="${PARITY_OUTPUT_JSON:-}"
OUTPUT_MD="${PARITY_OUTPUT_MD:-}"

# Expected files (relative to upstream root)
EXPECTED_FILES=(
  "src/lib.cairo"
  "src/account.cairo"
  "src/spending_policy.cairo"
  "src/spending_policy/interface.cairo"
  "src/spending_policy/component.cairo"
  "Scarb.toml"
)

# Expected selectors / symbols (grep patterns)
EXPECTED_SYMBOLS=(
  "add_or_update_session_key"
  "revoke_session_key"
  "get_session_data"
  "set_spending_policy"
  "get_spending_policy"
  "remove_spending_policy"
  "set_agent_id"
  "get_agent_id"
  "SessionData"
  "SpendingPolicy"
  "ISessionKeyManager"
  "ISessionSpendingPolicy"
)

# Results
declare -a MISSING_FILES
declare -a MISSING_SYMBOLS
declare -a FOUND_FILES
declare -a FOUND_SYMBOLS

for f in "${EXPECTED_FILES[@]}"; do
  if [[ -f "$UPSTREAM/$f" ]]; then
    FOUND_FILES+=("$f")
  else
    MISSING_FILES+=("$f")
  fi
done

for sym in "${EXPECTED_SYMBOLS[@]}"; do
  if grep -rq --include="*.cairo" "$sym" "$UPSTREAM" 2>/dev/null; then
    FOUND_SYMBOLS+=("$sym")
  else
    MISSING_SYMBOLS+=("$sym")
  fi
done

PASS=0
if [[ ${#MISSING_FILES[@]} -eq 0 && ${#MISSING_SYMBOLS[@]} -eq 0 ]]; then
  PASS=1
fi

# Build JSON (set +u for empty array expansion with bash set -u)
to_json_array() {
  if [[ $# -eq 0 ]]; then
    echo "[]"
    return
  fi
  printf '%s\n' "$@" | jq -R . | jq -s .
}

set +u
MISSING_FILES_JSON=$(to_json_array "${MISSING_FILES[@]}")
MISSING_SYMBOLS_JSON=$(to_json_array "${MISSING_SYMBOLS[@]}")
FOUND_FILES_JSON=$(to_json_array "${FOUND_FILES[@]}")
FOUND_SYMBOLS_JSON=$(to_json_array "${FOUND_SYMBOLS[@]}")
set -u

JSON=$(jq -n \
  --arg upstream "$UPSTREAM" \
  --argjson pass "$PASS" \
  --argjson missing_files "$MISSING_FILES_JSON" \
  --argjson missing_symbols "$MISSING_SYMBOLS_JSON" \
  --argjson found_files "$FOUND_FILES_JSON" \
  --argjson found_symbols "$FOUND_SYMBOLS_JSON" \
  '{
    upstream_path: $upstream,
    pass: ($pass == 1),
    missing_files: $missing_files,
    missing_symbols: $missing_symbols,
    found_files: $found_files,
    found_symbols: $found_symbols,
    summary: (if $pass == 1 then "PASS" else "FAIL" end)
  }')

# Output
if [[ -n "$OUTPUT_JSON" ]]; then
  echo "$JSON" > "$OUTPUT_JSON"
fi

echo "$JSON"

# Optional markdown
if [[ -n "$OUTPUT_MD" ]]; then
  set +u
  {
    echo "# Session Account Parity Report"
    echo ""
    echo "**Upstream path:** \`$UPSTREAM\`"
    echo "**Result:** $([ "$PASS" -eq 1 ] && echo "PASS" || echo "FAIL")"
    echo ""
    echo "## Missing files"
    if [[ ${#MISSING_FILES[@]} -eq 0 ]]; then
      echo "- None"
    else
      printf -- '- %s\n' "${MISSING_FILES[@]}"
    fi
    echo ""
    echo "## Missing symbols"
    if [[ ${#MISSING_SYMBOLS[@]} -eq 0 ]]; then
      echo "- None"
    else
      printf -- '- %s\n' "${MISSING_SYMBOLS[@]}"
    fi
  } > "$OUTPUT_MD"
  set -u
fi

# Exit
if [[ "$PASS" -eq 1 ]]; then
  exit 0
else
  set +u
  echo "Parity check FAILED. Missing: ${MISSING_FILES[*]} ${MISSING_SYMBOLS[*]}" >&2
  set -u
  exit 1
fi
