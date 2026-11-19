"""Validation helpers shared by the PM artifact validators (python3, standard library only).

Every helper appends readable messages to an error list and returns what the caller needs next
(an id set, a parsed date). Messages name the collection, the element id and the field, so the
person fixing a model finds the spot without reading the validator.
"""
import datetime
import re
from typing import Any, Dict, Iterable, List, Optional, Set

ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
LANGS = ("it", "en")


def where(coll: str, item: Any, idx: int) -> str:
    """'items[3] (1.2)': the position and, when present, the id of an element."""
    ident = item.get("id") if isinstance(item, dict) else None
    return "%s[%d]%s" % (coll, idx, " (%s)" % ident if ident else "")


def collection(model: Dict[str, Any], key: str, errors: List[str], required: bool = False) -> List[Dict[str, Any]]:
    """The list under `key`, keeping only objects; reports a wrong shape."""
    value = model.get(key)
    if value is None:
        if required:
            errors.append("\"%s\" is required and must be a non-empty list" % key)
        return []
    if not isinstance(value, list):
        errors.append("\"%s\" must be a list" % key)
        return []
    if required and not value:
        errors.append("\"%s\" must not be empty" % key)
    out = []
    for i, item in enumerate(value):
        if isinstance(item, dict):
            out.append(item)
        else:
            errors.append("%s[%d] must be an object" % (key, i))
    return out


def unique_ids(coll: str, items: Iterable[Dict[str, Any]], errors: List[str]) -> Set[str]:
    """The ids of a collection; reports a missing, malformed or repeated id."""
    seen: Set[str] = set()
    for i, item in enumerate(items):
        ident = item.get("id")
        if not isinstance(ident, str) or not ID_RE.match(ident):
            errors.append("%s: \"id\" must be a string of letters, digits, '.', '_' or '-'" % where(coll, item, i))
            continue
        if ident in seen:
            errors.append("%s: id \"%s\" is used twice" % (where(coll, item, i), ident))
        seen.add(ident)
    return seen


def text(item: Dict[str, Any], field: str, loc: str, errors: List[str], required: bool = False) -> None:
    value = item.get(field)
    if value is None:
        if required:
            errors.append("%s: \"%s\" is required" % (loc, field))
        return
    if not isinstance(value, str) or (required and not value.strip()):
        errors.append("%s: \"%s\" must be a non-empty string" % (loc, field))


def texts(item: Dict[str, Any], fields: Iterable[str], loc: str, errors: List[str]) -> None:
    """Optional free-text fields: each, when present, a string."""
    for field in fields:
        value = item.get(field)
        if value is not None and not isinstance(value, str):
            errors.append("%s: \"%s\" must be text, got %r" % (loc, field, value))


def date(item: Dict[str, Any], field: str, loc: str, errors: List[str], required: bool = False) -> Optional[datetime.date]:
    """The parsed ISO date (YYYY-MM-DD) of a field, or None after reporting a problem."""
    value = item.get(field)
    if value is None:
        if required:
            errors.append("%s: \"%s\" is required (YYYY-MM-DD)" % (loc, field))
        return None
    if not isinstance(value, str) or not ISO_DATE.match(value):
        errors.append("%s: \"%s\" must be a date written YYYY-MM-DD, got %r" % (loc, field, value))
        return None
    try:
        return datetime.date.fromisoformat(value)
    except ValueError:
        errors.append("%s: \"%s\" is not a real date: %s" % (loc, field, value))
        return None


def ref(item: Dict[str, Any], field: str, known: Set[str], target: str, loc: str, errors: List[str],
        required: bool = False) -> None:
    """A field naming an element of another collection (null allowed unless required)."""
    value = item.get(field)
    if value is None:
        if required:
            errors.append("%s: \"%s\" is required" % (loc, field))
        return
    if not isinstance(value, str):
        errors.append("%s: \"%s\" must be the id of a %s, got %r" % (loc, field, target, value))
    elif value not in known:
        errors.append("%s: \"%s\" names %s \"%s\", which does not exist" % (loc, field, target, value))


def refs(item: Dict[str, Any], field: str, known: Set[str], target: str, loc: str, errors: List[str]) -> None:
    """A field holding a list of references."""
    value = item.get(field)
    if value is None:
        return
    if not isinstance(value, list):
        errors.append("%s: \"%s\" must be a list" % (loc, field))
        return
    for v in value:
        if not isinstance(v, str):
            errors.append("%s: \"%s\" must list %s ids, got %r" % (loc, field, target, v))
        elif v not in known:
            errors.append("%s: \"%s\" names %s \"%s\", which does not exist" % (loc, field, target, v))


def enum(item: Dict[str, Any], field: str, allowed: Iterable[str], loc: str, errors: List[str]) -> None:
    value = item.get(field)
    allowed = tuple(allowed)
    if value is not None and value not in allowed:
        errors.append("%s: \"%s\" must be one of %s, got %r" % (loc, field, ", ".join(allowed), value))


def number(item: Dict[str, Any], field: str, loc: str, errors: List[str]) -> None:
    """An optional number, zero or more (booleans are not numbers)."""
    value = item.get(field)
    if value is None:
        return
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
        errors.append("%s: \"%s\" must be a number, zero or more, got %r" % (loc, field, value))
