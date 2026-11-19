#!/usr/bin/env bash
# Runs every structural test (tests/validate-*.sh and tests/test-*.sh) and, when `claude` is on
# PATH, `claude plugin validate . --strict`. Needs bash, jq and python3. Exits non-zero if any fails.
set -u

TESTS_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$TESTS_DIR/.." && pwd)"
failed=0
ran=0

for tool in jq python3; do
    command -v "$tool" >/dev/null 2>&1 || { echo "tests: $tool is required" >&2; exit 2; }
done

run() { # run <label> <command...>
    local label="$1"; shift
    ran=$((ran + 1))
    echo "--- $label"
    if "$@"; then
        :
    else
        echo "--- FAILED: $label"
        failed=$((failed + 1))
    fi
}

for script in "$TESTS_DIR"/validate-*.sh "$TESTS_DIR"/test-*.sh; do
    [ -f "$script" ] || continue
    run "$(basename "$script")" bash "$script"
done

# `claude plugin validate --strict` on the plugin as installed: a copy of the repository without the
# development files. Validated in place, the repository's own CLAUDE.md (development guidance, not
# shipped) is reported as a warning, which --strict turns into a failure.
validate_plugin() {
    local stage rc entry
    stage=$(mktemp -d "${TMPDIR:-/tmp}/pm-artifacts-plugin.XXXXXX") || return 1
    for entry in .claude-plugin shared skills README.md LICENSE; do
        [ -e "$ROOT/$entry" ] && cp -R "$ROOT/$entry" "$stage/"
    done
    (cd "$stage" && claude plugin validate . --strict)
    rc=$?
    rm -rf "$stage"
    return $rc
}

if command -v claude >/dev/null 2>&1; then
    run "claude plugin validate --strict (installed content)" validate_plugin
else
    echo "--- skipped: claude plugin validate (claude not on PATH)"
fi

echo
if [ "$failed" -gt 0 ]; then
    echo "$failed of $ran check(s) failed"
    exit 1
fi
echo "all $ran check(s) passed"
