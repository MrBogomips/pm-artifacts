---
name: new-artifact
description: "Development skill of the pm-artifacts repository: add a new artifact type (a PM board or report) to the plugin with the lightweight workflow, from brief to merged PR. Use when the user asks to add, create, scaffold or start a new artifact, board, report or skill in this repository (RAID log, status report, Gantt, budget tracker, risk matrix, OKR board and the like)."
---

# New artifact type

Argument: the type name, kebab-case (`raid-log`). The agile-board type is the reference
implementation: copy its shape, not its views.

## 1. Brief (before any file)

Settle with the user, in one short exchange, and record on a GitHub issue (`gh issue create`):
purpose and the decisions the page supports; the views (tabs); the input data and its fields;
what the PM edits on the page, if anything; the findings the validator should raise as warnings.
Then branch `feature/<type>` from `main`.

## 2. Scaffold

```
skills/<type>/SKILL.md                    copy agile-board's shape: data-only contract, steps, changing
skills/<type>/references/model.md         fields table, rules, one complete example (it is tested)
skills/<type>/scripts/<type_>_model.py    validate(model) -> errors, warnings(model) -> findings; import model_common
skills/<type>/assets/<type>.css           only what this type draws; theme tokens only
skills/<type>/assets/<type>[-*].js        helpers first (data, views), <type>.js last (boot, drawer, edits)
samples/<type>/sample.<ext>.json          synthetic data only, never from _reference/
tests/py/test_<type_>_model.py            copy test_agile_board_model.py's structure
```

Reuse, do not copy: `shared/scripts/model_common.py` (ids, dates, references, enums, numbers),
`PM` from `pm-core.js` (`t`, `i18n`, `esc`, `num`, `fmtDate`, `tiles`, `tabsHtml`, `currentTab`,
`openDrawer`, `darkToggle`) and `PM.save` from `pm-save.js` (`controls`, `change`, `isEditing`,
`onChange`). A new shared helper goes to `shared/` only when a second type needs it.

## 3. Build (tests first)

1. Write the validator tests and the sample; run `python3 -m unittest discover -s tests/py`: they fail.
2. Write the validator until they pass.
3. Write the renderer. Labels in both `it` and `en` via `PM.i18n`. Edits always build a new model
   and go through `PM.save.change`. Hash routes are ASCII names, never claude.ai reserved words.
4. `bash tests/run-structural-tests.sh` passes; add the type to the README skills table.

## 4. Visual gate (once)

```
python3 shared/scripts/artifact_page.py --type <type> --model samples/<type>/<sample> --out out/<type>-default.html --standalone
python3 shared/scripts/artifact_page.py --type <type> --model samples/<type>/<sample> --theme alt --out out/<type>-alt.html --standalone
```

Check in a browser (`chrome-devtools-axi`): every view, light and dark, 390px width without
horizontal scroll, drawer, console clean; if the page edits, the save flow with a stub
`window.claude` whose `use("artifact")` returns `{publish}`. Then publish the artifact-form page
(without `--standalone`) as a private artifact with the capabilities it needs, and let the user
approve. Two rounds of fixes at most.

## 5. Finish

Code review (`pr-review-toolkit:code-reviewer`), SKILL.md review for context cost (`skill-creator`),
bump the minor version in `plugin.json`, PR referencing the issue, merge.
