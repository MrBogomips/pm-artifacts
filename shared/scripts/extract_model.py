#!/usr/bin/env python3
"""Read back the model of a saved PM artifact page (python3, standard library only).

    extract_model.py <page.html> [--out <model.json>] [--against <model.json>]

A published page keeps its model in <script type="application/json" id="pm-model">. After the PM
edits and saves the artifact, fetch the page to a file (the Artifact tool's read action saves it)
and run this script: it prints the model, or writes it to --out, and with --against (or --out on
an existing file) prints a short summary of what changed item by item. The page's HTML never needs
to be read into an agent's context.
Exit status: 0 on success, 1 when the page holds no readable model.
"""
import argparse
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional

MODEL_RE = re.compile(r'<script type="application/json" id="pm-model">(.*?)</script>', re.S)
TRACKED = ("sprint", "assignee", "status", "estimate", "release", "title", "epic")


def extract(page: str) -> Optional[Dict[str, Any]]:
    """The model held by a page, or None."""
    m = MODEL_RE.search(page)
    if not m:
        return None
    try:
        model = json.loads(m.group(1))
    except ValueError:
        return None
    return model if isinstance(model, dict) else None


def diff(old: Dict[str, Any], new: Dict[str, Any]) -> List[str]:
    """One line per added, removed or changed item (only the fields a PM edits on the page)."""
    before = {i.get("id"): i for i in old.get("items", []) if isinstance(i, dict)}
    after = {i.get("id"): i for i in new.get("items", []) if isinstance(i, dict)}
    out = []
    for ident in after:
        if ident not in before:
            out.append("+ %s %s" % (ident, after[ident].get("title", "")))
            continue
        changes = ["%s: %s -> %s" % (f, before[ident].get(f), after[ident].get(f))
                   for f in TRACKED if before[ident].get(f) != after[ident].get(f)]
        if changes:
            out.append("~ %s %s" % (ident, "; ".join(changes)))
    out.extend("- %s %s" % (i, before[i].get("title", "")) for i in before if i not in after)
    for key in ("meta", "releases", "sprints", "people", "areas", "epics"):
        if old.get(key) != new.get(key):
            out.append("~ %s changed" % key)
    return out


def read_json(path: str) -> Optional[Dict[str, Any]]:
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def main(argv: List[str]) -> int:
    p = argparse.ArgumentParser(description="Read back the model of a saved PM artifact page.")
    p.add_argument("page", help="the saved page (.html)")
    p.add_argument("--out", help="write the model here (an existing file is compared first)")
    p.add_argument("--against", help="compare with this model instead of --out")
    args = p.parse_args(argv)
    try:
        with open(args.page, encoding="utf-8") as fh:
            model = extract(fh.read())
    except OSError as exc:
        print("error: cannot read %s: %s" % (args.page, exc.strerror or exc), file=sys.stderr)
        return 1
    if model is None:
        print("error: %s holds no pm-model script: is it a pm-artifacts page?" % args.page, file=sys.stderr)
        return 1
    base_path = args.against or (args.out if args.out and os.path.isfile(args.out) else None)
    if base_path:
        base = read_json(base_path)
        if base is None:
            print("warning: cannot read %s as JSON; no comparison" % base_path, file=sys.stderr)
        else:
            changes = diff(base, model)
            print("\n".join(changes) if changes else "no changes")
    text = json.dumps(model, ensure_ascii=False, indent=1) + "\n"
    if args.out:
        with open(args.out, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        print(args.out)
    elif not base_path:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
