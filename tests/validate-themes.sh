#!/usr/bin/env bash
# Theme completeness: light block and both dark blocks, the default token set, identical dark blocks,
# font sources on Google Fonts only. Usage: validate-themes.sh [theme-dir]  (default: shared/themes)
set -u
. "$(dirname "$0")/lib.sh"
need python3
DIR="${1:-$ROOT/shared/themes}"
out=$(python3 -I "$ROOT/tests/py/check_themes.py" "$ROOT" "$DIR" 2>&1)
rc=$?
[ -z "$out" ] || printf '%s\n' "$out"
[ "$rc" -eq 0 ] || FAILURES=1
finish validate-themes
