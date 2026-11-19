#!/usr/bin/env bash
# JavaScript unit tests of the page logic (tests/js/*.mjs), run with node's test runner. Skipped
# with a notice when node is not installed: the page itself needs no node.
set -u
. "$(dirname "$0")/lib.sh"
if ! command -v node >/dev/null 2>&1; then
    echo "test-js: skipped (node not on PATH)"
    exit 0
fi
out=$(cd "$ROOT" && node --test tests/js/*.mjs 2>&1)
rc=$?
if [ "$rc" -ne 0 ]; then printf '%s\n' "$out"; FAILURES=1; fi
finish test-js
