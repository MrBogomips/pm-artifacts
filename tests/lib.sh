#!/usr/bin/env bash
# Shared helpers for the structural tests. Source it; do not run it.
# Output convention: one "file: problem" line per failure.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILURES=0

fail() { # fail <file> <problem>
    printf '%s: %s\n' "$1" "$2"
    FAILURES=$((FAILURES + 1))
}

finish() { # finish <name>
    if [ "$FAILURES" -gt 0 ]; then
        printf '%s: %d problem(s)\n' "$1" "$FAILURES" >&2
        exit 1
    fi
    printf '%s: ok\n' "$1"
}

need() { # need <tool>
    command -v "$1" >/dev/null 2>&1 || { printf 'tests: %s is required\n' "$1" >&2; exit 2; }
}
