#!/usr/bin/env bash
# Python unit tests: the validators, the page assembler and the model read-back (tests/py/test_*.py).
set -u
. "$(dirname "$0")/lib.sh"
need python3
out=$(cd "$ROOT" && python3 -m unittest discover -s tests/py -p 'test_*.py' 2>&1)
rc=$?
if [ "$rc" -ne 0 ]; then printf '%s\n' "$out"; FAILURES=1; fi
finish test-python
