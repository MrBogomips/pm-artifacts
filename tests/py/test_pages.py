"""Tests of the page assembler and of reading the model back from a saved page."""
import json
import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCRIPTS = os.path.join(ROOT, "shared", "scripts")
SAMPLE = os.path.join(ROOT, "samples", "agile-board", "sample.board.json")
sys.path.insert(0, SCRIPTS)
import extract_model  # noqa: E402


def run(*args):
    return subprocess.run([sys.executable, *args], capture_output=True, text=True)


def assemble(tmp, model=SAMPLE, theme="default", *extra):
    out = os.path.join(tmp, "page.html")
    res = run(os.path.join(SCRIPTS, "artifact_page.py"), "--type", "agile-board", "--model", model,
              "--theme", theme, "--out", out, *extra)
    return res, out


class Assembler(unittest.TestCase):
    def test_artifact_form(self):
        with tempfile.TemporaryDirectory() as tmp:
            res, out = assemble(tmp)
            self.assertEqual(res.returncode, 0, res.stderr)
            page = open(out, encoding="utf-8").read()
            self.assertTrue(page.startswith("<title>Prenotazione Sale</title>"))
            self.assertFalse(page.lower().startswith("<!doctype"), "the page must not carry its own skeleton")
            for marker in ('<style id="pm-style">', '<div id="pm-root"></div>', 'id="pm-model"', '<script id="pm-app">'):
                self.assertIn(marker, page)
            self.assertIn("warning:", res.stderr)

    def test_model_round_trip(self):
        with tempfile.TemporaryDirectory() as tmp:
            assemble(tmp)
            with open(SAMPLE, encoding="utf-8") as fh:
                self.assertEqual(extract_model.extract(open(os.path.join(tmp, "page.html"), encoding="utf-8").read()), json.load(fh))

    def test_alt_theme_and_standalone(self):
        with tempfile.TemporaryDirectory() as tmp:
            res, out = assemble(tmp, SAMPLE, "alt", "--standalone")
            self.assertEqual(res.returncode, 0, res.stderr)
            self.assertTrue(open(out, encoding="utf-8").read().startswith("<!doctype html>"))

    def test_invalid_model_writes_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = os.path.join(tmp, "bad.board.json")
            with open(bad, "w") as fh:
                json.dump({"meta": {}, "sprints": [], "epics": [], "items": []}, fh)
            res, out = assemble(tmp, bad)
            self.assertEqual(res.returncode, 1)
            self.assertFalse(os.path.exists(out))
            self.assertIn("no page written", res.stderr)

    def test_unknown_theme(self):
        with tempfile.TemporaryDirectory() as tmp:
            res, _ = assemble(tmp, SAMPLE, "nope")
            self.assertEqual(res.returncode, 1)
            self.assertIn("shipped theme", res.stderr)


class Extract(unittest.TestCase):
    def test_diff_reports_moves(self):
        with open(SAMPLE, encoding="utf-8") as fh:
            old = json.load(fh)
        new = json.loads(json.dumps(old))
        new["items"][0]["sprint"] = "S4"
        new["items"].pop()
        lines = extract_model.diff(old, new)
        self.assertTrue(any(l.startswith("~ 1.1") and "S1 -> S4" in l for l in lines))
        self.assertTrue(any(l.startswith("- ") for l in lines))

    def test_cli_writes_model_and_summary(self):
        with tempfile.TemporaryDirectory() as tmp:
            assemble(tmp)
            out = os.path.join(tmp, "m.json")
            with open(out, "w") as fh:
                fh.write(open(SAMPLE, encoding="utf-8").read())
            res = run(os.path.join(SCRIPTS, "extract_model.py"), os.path.join(tmp, "page.html"), "--out", out)
            self.assertEqual(res.returncode, 0, res.stderr)
            self.assertIn("no changes", res.stdout)

    def test_not_a_page(self):
        self.assertIsNone(extract_model.extract("<p>hello</p>"))


if __name__ == "__main__":
    unittest.main()
