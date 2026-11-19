# CLAUDE.md

Guidance for working in the pm-artifacts plugin repository.

## Purpose

A Claude Code plugin (`pm-artifacts`): skills that turn a project plan into decision boards and
reports for project managers, as self-contained pages built to be published as claude.ai artifacts
and to use their runtime capabilities. The sibling of `eng-artifacts` (software engineering
diagrams): same theme tokens, simpler development workflow. Pages are tables, timelines and meters
more than drawings.

## Product rules

1. **The agent writes data, never markup.** A skill's agent writes one JSON model; the plugin's
   scripts validate it and assemble the page. This is what keeps production cheap.
2. **Artifact form.** A page is content only (no doctype/html/head/body), in the fixed shape
   documented in `shared/scripts/artifact_page.py`, because the Artifact tool adds its own
   skeleton. `shared/page/pm-save.js` regenerates exactly that shape when a page republishes itself.
3. **Editable through the `artifact` capability.** A page that the PM edits keeps its state in
   `#pm-model`; edits build a new model (never mutate) and Save publishes the regenerated document.
   The agent reads changes back with `shared/scripts/extract_model.py`, never by reading the HTML.
4. **Theme tokens only.** Colors, fonts and geometry come from `shared/themes/*.css`, copied from
   eng-artifacts; keep the two copies aligned. Every theme works in light and in dark, and every
   page has the Dark toggle.
5. **Interface languages it and en**, chosen by `meta.lang` (default `it`); labels live in the
   dictionaries of `pm-core.js` and of each renderer.

## Layout

```
.claude-plugin/          plugin.json (source of truth for the version) + one-entry marketplace.json (shipped)
shared/themes/           default.css, alt.css (shipped)
shared/page/             pm.css (components), pm-core.js (i18n, Dark toggle, tabs, drawer, tiles), pm-save.js (edit and save) (shipped)
shared/scripts/          artifact_page.py (assembler), model_common.py (shared validation), extract_model.py (read back), theme_tokens.py (shipped)
skills/<type>/           SKILL.md, references/model.md, scripts/<type with _>_model.py, assets/<type>.css and <type>[-*].js (shipped)
samples/<type>/          the synthetic sample model of each type (not shipped)
tests/                   structural tests, tests/py and tests/js unit tests (not shipped)
.claude/skills/new-artifact/  development skill: add an artifact type (not shipped)
_reference/              local reference material with client data (gitignored, never committed)
```

The assembler inlines, in order: theme, `pm.css`, the type's css; then `pm-core.js`, `pm-save.js`,
the type's helper scripts `assets/<type>-*.js` in name order, `assets/<type>.js`. A validator
exposes `validate(model) -> errors` and may expose `warnings(model)`.

## Commands

```bash
bash tests/run-structural-tests.sh    # manifests, themes, python and js unit tests, `claude plugin validate --strict` when claude is on PATH
python3 -m unittest discover -s tests/py   # Python unit tests only
node --test tests/js/*.mjs                 # page-logic tests (estimation, planning), run in a vm
python3 shared/scripts/artifact_page.py --type agile-board --model samples/agile-board/sample.board.json --out out/sample.html [--theme alt] [--standalone]
python3 skills/agile-board/scripts/agile_board_model.py <file>.board.json   # validate a model
python3 shared/scripts/extract_model.py <saved page> [--out <model>] [--against <model>]
```

Scripts are python3 standard library only and macOS/Linux compatible: no `grep -P`, no `sed -i`.

## Workflow (lightweight by decision)

No OpenSpec, no agent harness, no exploration sketches, no A/B evaluations. For a new artifact type:

1. **Brief** on a GitHub issue: purpose, views, input data, decisions it supports.
2. Branch `feature/<type>`, then `/new-artifact <type>` for the scaffold and checklist.
3. Validator tests first (they must fail), then the validator, then the renderer.
   `bash tests/run-structural-tests.sh` must pass.
4. **One visual gate**: render the sample with `default` and `alt` into `out/`, check it in a
   browser (views, light and dark, 390px width, console clean), publish it as a private artifact
   for the user, who approves (two rounds at most).
5. Review the code (`pr-review-toolkit:code-reviewer`) and the SKILL.md for context cost
   (`skill-creator`), then PR, merge, minor version bump in both manifests.

A change to an existing type follows steps 3 to 5.

## Working documents

- **Briefs and decisions**: the GitHub issue of each artifact type.
- **Scratch**: the session scratchpad. Tool defaults such as `docs/superpowers/...` go there.
- **Generated pages**: `out/` (gitignored); samples are rendered again, never committed.
- **Reference material**: `_reference/` (gitignored), may hold client data: never copy it into
  committed files, samples or published artifacts.

## Git / PR Working Policy
- Worktree usage: disabled
- Worktree location: n/a (topic branch in main checkout)
- Base branch: main
- Recorded on: 2026-11-19

## Reference repositories

- `MrBogomips/eng-artifacts` (sibling checkout): the assembler, theme tokens and test helpers this
  plugin was ported from; its heavier workflow is deliberately not adopted.
