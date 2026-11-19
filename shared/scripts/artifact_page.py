#!/usr/bin/env python3
"""Assemble a PM artifact page (python3, standard library only).

    artifact_page.py --type agile-board --model <file> [--theme default|alt|<path>] --out <file> [--standalone]

Loads the artifact type from skills/<type>/: its validator scripts/<type with - as _>_model.py
(validate(model) -> list of errors, optional warnings(model) -> list of warnings), its renderer
(helper files assets/<type>-*.js in name order, then assets/<type>.js) and optional styles assets/<type>.css. Validates the model, checks the theme against
the default theme's token set, and writes ONE page. Nothing is written unless every check passes; on
failure every problem is printed and the exit status is 1 (2 for a usage error). Warnings are printed
and do not stop the page: they are planning findings for the PM.

The page is in Artifact form: page content only, no doctype/html/head/body, because the Artifact tool
wraps it in its own skeleton when it publishes. Its shape is fixed, and shared/page/pm-save.js
regenerates exactly this shape when the page republishes itself:

    <title>…</title><meta name="claude:viewport-fit-sides" content="cover">
    <style id="pm-style">theme + pm.css + type css</style>
    <div id="pm-root"></div>
    <script type="application/json" id="pm-model">model</script>
    <script id="pm-app">pm-core.js + pm-save.js + type renderer</script>

--standalone wraps the same content in a minimal document, for opening the file locally.
"""
import argparse
import html
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import theme_tokens  # noqa: E402

THEME_NAME = re.compile(r"^[a-z0-9][a-z0-9-]*$")
TYPE_NAME = re.compile(r"^[a-z][a-z0-9-]*$")
SHARED_JS = ("pm-core.js", "pm-save.js")
STANDALONE_HEAD = ('<!doctype html><html><head><meta charset="utf-8">'
                   '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
                   '<style>body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style>'
                   '</head><body>')


class AssemblyError(Exception):
    """Carries every problem found; nothing is written."""

    def __init__(self, problems):
        super().__init__("; ".join(problems))
        self.problems = problems


def read_text(path, problems, what):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    except OSError as exc:
        problems.append("%s: cannot read %s: %s" % (path, what, exc.strerror or exc))
        return None


def load_validator(type_dir, art_type, problems):
    """The validator module of a type, or None after reporting why."""
    module_name = "%s_model" % art_type.replace("-", "_")
    path = os.path.join(type_dir, "scripts", "%s.py" % module_name)
    if not os.path.isfile(path):
        problems.append("%s: the artifact type has no validator" % path)
        return None
    sys.path.insert(0, os.path.dirname(path))
    spec = importlib.util.spec_from_file_location(module_name, path)
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as exc:  # a broken validator is reported, not a crash
        problems.append("%s: cannot load the validator: %s" % (path, exc))
        return None
    if not callable(getattr(module, "validate", None)):
        problems.append("%s: the validator has no validate(model) function" % path)
        return None
    return module


def resolve_theme(root, theme):
    """Path of a theme given by shipped name or by file path."""
    themes_dir = os.path.join(root, "shared", "themes")
    if THEME_NAME.match(theme):
        shipped = os.path.join(themes_dir, theme + ".css")
        if os.path.isfile(shipped):
            return shipped
        if not os.path.isfile(theme):
            known = sorted(f[:-4] for f in os.listdir(themes_dir) if f.endswith(".css"))
            raise AssemblyError(["theme \"%s\" is neither a shipped theme (%s) nor a file" % (theme, ", ".join(known))])
    if os.path.isfile(theme):
        return theme
    raise AssemblyError(["theme file %s does not exist" % theme])


def read_renderer(type_dir, art_type, problems):
    """The renderer: helper files assets/<type>-*.js in name order, then assets/<type>.js."""
    assets = os.path.join(type_dir, "assets")
    names = sorted(n for n in os.listdir(assets) if n.startswith(art_type + "-") and n.endswith(".js")) \
        if os.path.isdir(assets) else []
    parts = [read_text(os.path.join(assets, n), problems, "the renderer") for n in names + [art_type + ".js"]]
    return None if None in parts else "\n".join(parts)


def json_for_script(model):
    """JSON safe inside <script type=application/json>. pm-save.js escapes the same way."""
    text = json.dumps(model, ensure_ascii=False, indent=1)
    return (text.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
            .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def check_inline(parts, problems):
    for label, text, closer in parts:
        if re.search(r"</\s*%s" % closer, text, re.I):
            problems.append("%s contains </%s, which cannot be inlined" % (label, closer))


def known_types(root):
    sk = os.path.join(root, "skills")
    return sorted(d for d in os.listdir(sk) if os.path.isdir(os.path.join(sk, d))) if os.path.isdir(sk) else []


def load_model(model_path, problems):
    raw = read_text(model_path, problems, "the model")
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except ValueError as exc:
        problems.append("%s: the model is not valid JSON: %s" % (model_path, exc))
        return None


def load_theme(root, theme, problems):
    try:
        path = resolve_theme(root, theme)
    except AssemblyError as exc:
        problems.extend(exc.problems)
        return None
    text = read_text(path, problems, "the theme")
    default = read_text(os.path.join(root, "shared", "themes", "default.css"), problems, "the default theme")
    if text is not None and default is not None:
        for p in theme_tokens.missing_tokens(default, text):
            problems.append("theme %s: %s" % (path, p))
    return text


def assemble(root, art_type, model_path, theme):
    """Return (page content, warnings), or raise AssemblyError with every problem."""
    problems = []
    type_dir = os.path.join(root, "skills", art_type)
    if not TYPE_NAME.match(art_type) or not os.path.isdir(type_dir):
        raise AssemblyError(["unknown artifact type \"%s\" (known: %s)" % (art_type, ", ".join(known_types(root)))])

    model = load_model(model_path, problems)
    validator = load_validator(type_dir, art_type, problems)
    warnings = []
    if model is not None and validator is not None:
        problems.extend("%s: %s" % (model_path, e) for e in validator.validate(model))
        if not problems and callable(getattr(validator, "warnings", None)):
            warnings = list(validator.warnings(model))
    theme_text = load_theme(root, theme, problems)

    page_dir = os.path.join(root, "shared", "page")
    pm_css = read_text(os.path.join(page_dir, "pm.css"), problems, "the page styles")
    shared_js = [read_text(os.path.join(page_dir, n), problems, "a page script") for n in SHARED_JS]
    type_js = read_renderer(type_dir, art_type, problems)
    css_path = os.path.join(type_dir, "assets", art_type + ".css")
    type_css = read_text(css_path, problems, "the type styles") if os.path.isfile(css_path) else ""

    if problems or None in [model, theme_text, pm_css, type_js, type_css] + shared_js:
        raise AssemblyError(problems)

    style = "\n".join([theme_text, pm_css, type_css])
    app = "\n".join(shared_js + [type_js])
    check_inline([("the styles", style, "style"), ("the scripts", app, "script")], problems)
    if problems:
        raise AssemblyError(problems)

    title = str((model.get("meta") or {}).get("title") or art_type)
    page = ('<title>%s</title><meta name="claude:viewport-fit-sides" content="cover">\n'
            '<style id="pm-style">%s</style>\n'
            '<div id="pm-root"></div>\n'
            '<script type="application/json" id="pm-model">%s</script>\n'
            '<script id="pm-app">%s</script>\n') % (html.escape(title), style, json_for_script(model), app)
    return page, warnings


def parse_args(argv):
    p = argparse.ArgumentParser(description="Assemble a PM artifact page from a model, a type and a theme.")
    p.add_argument("--type", required=True, help="artifact type, a folder under skills/ (for example agile-board)")
    p.add_argument("--model", required=True, help="the model file")
    p.add_argument("--theme", default="default", help="a shipped theme name (default, alt) or a path to a theme file")
    p.add_argument("--out", required=True, help="the output html file")
    p.add_argument("--standalone", action="store_true", help="wrap the page in a document, for local viewing only")
    p.add_argument("--plugin-root", default=os.path.dirname(os.path.dirname(HERE)), help=argparse.SUPPRESS)
    return p.parse_args(argv)


def main(argv):
    args = parse_args(argv)
    try:
        page, warnings = assemble(args.plugin_root, args.type, args.model, args.theme)
    except AssemblyError as exc:
        for problem in exc.problems:
            print("error: %s" % problem, file=sys.stderr)
        print("no page written (%d problem%s)" % (len(exc.problems), "" if len(exc.problems) == 1 else "s"),
              file=sys.stderr)
        return 1
    if args.standalone:
        page = STANDALONE_HEAD + page + "</body></html>\n"
    out = os.path.abspath(args.out)
    try:
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(page)
    except OSError as exc:
        print("error: cannot write %s: %s" % (out, exc.strerror or exc), file=sys.stderr)
        return 1
    for w in warnings:
        print("warning: %s" % w, file=sys.stderr)
    print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
