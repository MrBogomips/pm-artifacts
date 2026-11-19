#!/usr/bin/env python3
"""Validator of an agile-board model (<name>.board.json), python3 standard library only.

    agile_board_model.py <file>.board.json   -> prints errors and warnings; exit 1 on errors

validate(model) -> errors: the model cannot be drawn until they are fixed.
warnings(model) -> planning findings for the PM (over-allocation, missing estimates, dependencies
planned too late, items planned after their release): the page is drawn and shows them too.
capacities(model) -> {person id: {sprint id: capacity or None}}, the same rule the page uses.

The model format is in ../references/model.md.
"""
import datetime
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "shared", "scripts"))
import model_common as mc  # noqa: E402

TYPES = ("story", "task", "bug", "spike")
STATUSES = ("todo", "active", "done", "risk", "blocked")
UNITS = ("gg", "pt")


def _meta(model: Dict[str, Any], errors: List[str]) -> None:
    meta = model.get("meta")
    if not isinstance(meta, dict):
        errors.append("\"meta\" is required and must be an object with at least \"title\"")
        return
    mc.text(meta, "title", "meta", errors, required=True)
    mc.enum(meta, "lang", mc.LANGS, "meta", errors)
    mc.enum(meta, "unit", UNITS, "meta", errors)
    mc.date(meta, "today", "meta", errors)
    mc.texts(meta, ("project",), "meta", errors)
    link = meta.get("sourceLink")
    if link is not None and not (isinstance(link, str) and re.match(r"^https?://", link)):
        errors.append("meta: \"sourceLink\" must be an http(s) URL, got %r" % (link,))
    notes = meta.get("notes")
    if notes is not None and not (isinstance(notes, list) and all(isinstance(n, str) for n in notes)):
        errors.append("meta: \"notes\" must be a list of strings")


def _sprints(sprints: List[Dict[str, Any]], errors: List[str]) -> None:
    for i, s in enumerate(sprints):
        loc = mc.where("sprints", s, i)
        mc.text(s, "name", loc, errors, required=True)
        start = mc.date(s, "start", loc, errors, required=True)
        end = mc.date(s, "end", loc, errors, required=True)
        if start and end and end < start:
            errors.append("%s: the sprint ends before it starts" % loc)
        mc.number(s, "days", loc, errors)
        mc.texts(s, ("note",), loc, errors)


def _people(people: List[Dict[str, Any]], sprint_ids: set, errors: List[str]) -> None:
    for i, p in enumerate(people):
        loc = mc.where("people", p, i)
        mc.text(p, "name", loc, errors, required=True)
        mc.number(p, "capacity", loc, errors)
        mc.texts(p, ("role",), loc, errors)
        av = p.get("availability")
        if av is not None and (isinstance(av, bool) or not isinstance(av, (int, float)) or not 0 <= av <= 1):
            errors.append("%s: \"availability\" must be a number from 0 to 1, got %r" % (loc, av))
        sc = p.get("sprintCapacity")
        if sc is None:
            continue
        if not isinstance(sc, dict):
            errors.append("%s: \"sprintCapacity\" must be an object {sprint id: capacity}" % loc)
            continue
        for sid, cap in sc.items():
            if sid not in sprint_ids:
                errors.append("%s: \"sprintCapacity\" names sprint \"%s\", which does not exist" % (loc, sid))
            mc.number({"v": cap}, "v", "%s: sprintCapacity.%s" % (loc, sid), errors)


def _items(model: Dict[str, Any], ids: Dict[str, set], errors: List[str]) -> None:
    for i, it in enumerate(model["_items"]):
        loc = mc.where("items", it, i)
        mc.text(it, "title", loc, errors, required=True)
        mc.ref(it, "epic", ids["epics"], "epic", loc, errors, required=True)
        mc.ref(it, "sprint", ids["sprints"], "sprint", loc, errors)
        mc.ref(it, "release", ids["releases"], "release", loc, errors)
        mc.ref(it, "assignee", ids["people"], "person", loc, errors)
        mc.refs(it, "deps", ids["items"], "item", loc, errors)
        mc.texts(it, ("desc", "reqs"), loc, errors)
        if isinstance(it.get("deps"), list) and it.get("id") in it["deps"]:
            errors.append("%s: the item depends on itself" % loc)
        mc.enum(it, "type", TYPES, loc, errors)
        mc.enum(it, "status", STATUSES, loc, errors)
        mc.number(it, "estimate", loc, errors)


def _collect(model: Dict[str, Any], errors: List[str]) -> Dict[str, set]:
    ids = {}
    for key, required in (("releases", False), ("sprints", True), ("people", False), ("areas", False),
                          ("epics", True), ("items", True)):
        model["_" + key] = mc.collection(model, key, errors, required=required)
        ids[key] = mc.unique_ids(key, model["_" + key], errors)
    return ids


def validate(model: Any) -> List[str]:
    """Every error of the model, as readable messages; empty when the page can be drawn."""
    if not isinstance(model, dict):
        return ["the model must be a JSON object"]
    errors: List[str] = []
    work = dict(model)
    _meta(work, errors)
    ids = _collect(work, errors)
    for i, r in enumerate(work["_releases"]):
        mc.text(r, "name", mc.where("releases", r, i), errors, required=True)
        mc.date(r, "date", mc.where("releases", r, i), errors)
        mc.texts(r, ("desc",), mc.where("releases", r, i), errors)
    _sprints(work["_sprints"], errors)
    _people(work["_people"], ids["sprints"], errors)
    for i, a in enumerate(work["_areas"]):
        mc.text(a, "name", mc.where("areas", a, i), errors, required=True)
    for i, e in enumerate(work["_epics"]):
        loc = mc.where("epics", e, i)
        mc.text(e, "title", loc, errors, required=True)
        mc.ref(e, "area", ids["areas"], "area", loc, errors)
        mc.refs(e, "releases", ids["releases"], "release", loc, errors)
        mc.texts(e, ("goal", "reqs"), loc, errors)
    _items(work, ids, errors)
    return errors


# ---- derived figures (the page computes the same) -------------------------------------------------

def _iso(value: str) -> datetime.date:
    return datetime.date.fromisoformat(value)


def sprint_days(sprint: Dict[str, Any]) -> float:
    """Working days of a sprint: its "days", else the weekdays from start to end."""
    if sprint.get("days") is not None:
        return sprint["days"]
    d, end, n = _iso(sprint["start"]), _iso(sprint["end"]), 0
    while d <= end:
        n += d.weekday() < 5
        d += datetime.timedelta(days=1)
    return n


def capacities(model: Dict[str, Any]) -> Dict[str, Dict[str, Optional[float]]]:
    """Capacity of each person in each sprint: sprintCapacity, else capacity, else (unit gg) days x availability."""
    unit = (model.get("meta") or {}).get("unit") or "gg"
    out: Dict[str, Dict[str, Optional[float]]] = {}
    for p in model.get("people") or []:
        row: Dict[str, Optional[float]] = {}
        for s in model["sprints"]:
            override = (p.get("sprintCapacity") or {}).get(s["id"])
            if override is not None:
                row[s["id"]] = override
            elif p.get("capacity") is not None:
                row[s["id"]] = p["capacity"]
            elif unit == "gg":
                avail = p.get("availability")
                row[s["id"]] = round(sprint_days(s) * (1 if avail is None else avail), 2)
            else:
                row[s["id"]] = None
        out[p["id"]] = row
    return out


def _over_allocation(model: Dict[str, Any]) -> List[str]:
    caps = capacities(model)
    names = {p["id"]: p["name"] for p in model.get("people") or []}
    sprint_name = {s["id"]: s["name"] for s in model["sprints"]}
    load: Dict[tuple, float] = {}
    for it in model["items"]:
        if it.get("assignee") and it.get("sprint") and it.get("estimate") is not None:
            key = (it["assignee"], it["sprint"])
            load[key] = load.get(key, 0) + it["estimate"]
    out = []
    for (pid, sid), value in sorted(load.items()):
        cap = caps.get(pid, {}).get(sid)
        if cap is not None and value > cap:
            out.append("%s is over capacity in %s: %g planned for %g available"
                       % (names[pid], sprint_name[sid], value, cap))
    return out


def _dependencies(model: Dict[str, Any]) -> List[str]:
    order = {s["id"]: i for i, s in enumerate(model["sprints"])}
    by_id = {it["id"]: it for it in model["items"]}
    out = []
    for it in model["items"]:
        mine = order.get(it.get("sprint"))
        if mine is None:
            continue
        for dep in it.get("deps") or []:
            theirs = order.get(by_id[dep].get("sprint"))
            if theirs is None or theirs > mine:
                where = "is not planned" if theirs is None else "is planned in a later sprint"
                out.append("%s depends on %s, which %s" % (it["id"], dep, where))
    return out


def _release_slips(model: Dict[str, Any]) -> List[str]:
    """One line per release and sprint: the items planned in a sprint that ends after the release date."""
    rel = {r["id"]: r for r in model.get("releases") or [] if r.get("date")}
    sprints = {s["id"]: s for s in model["sprints"]}
    groups: Dict[tuple, List[str]] = {}
    for it in model["items"]:
        r, s = rel.get(it.get("release")), sprints.get(it.get("sprint"))
        if r and s and _iso(s["end"]) > _iso(r["date"]):
            groups.setdefault((r["id"], s["id"]), []).append(it["id"])
    return ["%d item(s) of release %s are planned in %s, which ends after %s: %s"
            % (len(ids), rel[rid]["name"], sprints[sid]["name"], rel[rid]["date"], ", ".join(ids))
            for (rid, sid), ids in groups.items()]


def warnings(model: Dict[str, Any]) -> List[str]:
    """Planning findings of a valid model, for the PM to decide on."""
    out = _over_allocation(model) + _dependencies(model) + _release_slips(model)
    missing = [it["id"] for it in model["items"] if it.get("estimate") is None and it.get("status") != "done"]
    if missing:
        out.append("%d item(s) without an estimate: %s" % (len(missing), ", ".join(missing)))
    return out


def main(argv: List[str]) -> int:
    if len(argv) != 1:
        print("usage: agile_board_model.py <file>.board.json", file=sys.stderr)
        return 2
    try:
        with open(argv[0], encoding="utf-8") as fh:
            model = json.load(fh)
    except (OSError, ValueError) as exc:
        print("error: %s: %s" % (argv[0], exc), file=sys.stderr)
        return 1
    errors = validate(model)
    for e in errors:
        print("error: %s" % e, file=sys.stderr)
    if errors:
        return 1
    for w in warnings(model):
        print("warning: %s" % w)
    print("ok")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
