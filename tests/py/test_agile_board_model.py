"""Tests of the agile-board validator: errors stop the page, warnings are findings for the PM.

Run: python3 -m unittest discover -s tests/py   (or pytest tests/py)
"""
import copy
import importlib.util
import json
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAMPLE = os.path.join(ROOT, "samples", "agile-board", "sample.board.json")
VALIDATOR = os.path.join(ROOT, "skills", "agile-board", "scripts", "agile_board_model.py")


def load_validator():
    spec = importlib.util.spec_from_file_location("agile_board_model", VALIDATOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


V = load_validator()
with open(SAMPLE, encoding="utf-8") as fh:
    BASE = json.load(fh)


def model(**changes):
    m = copy.deepcopy(BASE)
    for key, fn in changes.items():
        fn(m)
    return m


def item(m, ident):
    return next(i for i in m["items"] if i["id"] == ident)


class ValidModels(unittest.TestCase):
    def test_sample_is_valid(self):
        self.assertEqual(V.validate(BASE), [])

    def test_minimal_model_is_valid(self):
        m = {"meta": {"title": "T"}, "sprints": [{"id": "S1", "name": "S1", "start": "2026-01-05", "end": "2026-01-16"}],
             "epics": [{"id": "E1", "title": "E"}], "items": [{"id": "1", "epic": "E1", "title": "x"}]}
        self.assertEqual(V.validate(m), [])

    def test_reference_example_is_valid(self):
        import re
        with open(os.path.join(ROOT, "skills", "agile-board", "references", "model.md"), encoding="utf-8") as fh:
            example = json.loads(re.search(r"```json\n(.*?)```", fh.read(), re.S).group(1))
        self.assertEqual(V.validate(example), [])

    def test_unplanned_item_is_valid(self):
        self.assertEqual(V.validate(model(a=lambda m: item(m, "1.4").update(sprint=None))), [])


class Errors(unittest.TestCase):
    def assertError(self, m, fragment):
        errors = V.validate(m)
        self.assertTrue(any(fragment in e for e in errors), "no error containing %r in %r" % (fragment, errors))

    def test_not_an_object(self):
        self.assertEqual(len(V.validate([])), 1)

    def test_title_required(self):
        self.assertError(model(a=lambda m: m["meta"].pop("title")), "\"title\"")

    def test_duplicate_item_id(self):
        self.assertError(model(a=lambda m: item(m, "1.2").update(id="1.1")), "used twice")

    def test_unknown_epic(self):
        self.assertError(model(a=lambda m: item(m, "1.1").update(epic="E9")), "epic \"E9\"")

    def test_unknown_sprint(self):
        self.assertError(model(a=lambda m: item(m, "1.1").update(sprint="S9")), "sprint \"S9\"")

    def test_unknown_assignee(self):
        self.assertError(model(a=lambda m: item(m, "1.1").update(assignee="zz")), "person \"zz\"")

    def test_unknown_dependency(self):
        self.assertError(model(a=lambda m: item(m, "1.1").update(deps=["9.9"])), "item \"9.9\"")

    def test_self_dependency(self):
        self.assertError(model(a=lambda m: item(m, "1.1").update(deps=["1.1"])), "depends on itself")

    def test_unknown_area(self):
        self.assertError(model(a=lambda m: m["epics"][0].update(area="nope")), "area \"nope\"")

    def test_unknown_release_on_epic(self):
        self.assertError(model(a=lambda m: m["epics"][0].update(releases=["R9"])), "release \"R9\"")

    def test_bad_date(self):
        self.assertError(model(a=lambda m: m["sprints"][0].update(start="23/11/2026")), "YYYY-MM-DD")

    def test_sprint_ends_before_start(self):
        self.assertError(model(a=lambda m: m["sprints"][0].update(end="2026-11-01")), "ends before")

    def test_bad_status(self):
        self.assertError(model(a=lambda m: item(m, "1.1").update(status="wip")), "\"status\"")

    def test_bad_type(self):
        self.assertError(model(a=lambda m: item(m, "1.1").update(type="feature")), "\"type\"")

    def test_bad_lang(self):
        self.assertError(model(a=lambda m: m["meta"].update(lang="fr")), "\"lang\"")

    def test_bad_estimate(self):
        self.assertError(model(a=lambda m: item(m, "1.1").update(estimate=-1)), "\"estimate\"")

    def test_bad_availability(self):
        self.assertError(model(a=lambda m: m["people"][0].update(availability=1.5)), "\"availability\"")

    def test_sprint_capacity_names_unknown_sprint(self):
        self.assertError(model(a=lambda m: m["people"][0].update(sprintCapacity={"S9": 3})), "sprint \"S9\"")

    def test_sprints_required(self):
        self.assertError(model(a=lambda m: m.update(sprints=[])), "\"sprints\"")


class Warnings(unittest.TestCase):
    def assertWarning(self, m, fragment):
        self.assertEqual(V.validate(m), [])
        found = V.warnings(m)
        self.assertTrue(any(fragment in w for w in found), "no warning containing %r in %r" % (fragment, found))

    def test_over_allocation(self):
        # Giorgio Rizzo has 3 days in Sprint 3 and an 8-day item there
        self.assertWarning(BASE, "Giorgio Rizzo")

    def test_missing_estimates(self):
        self.assertWarning(BASE, "without an estimate")

    def test_dependency_planned_later(self):
        self.assertWarning(model(a=lambda m: item(m, "1.1").update(sprint="S4")), "depends on 1.1")

    def test_release_slip(self):
        self.assertWarning(model(a=lambda m: item(m, "1.3").update(sprint="S4")), "after release R1")

    def test_capacity_from_days_and_availability(self):
        caps = V.capacities(BASE)
        self.assertEqual(caps["mt"]["S1"], 6.0)   # 10 days x 0.6
        self.assertEqual(caps["gr"]["S3"], 3)     # explicit override


if __name__ == "__main__":
    unittest.main()
