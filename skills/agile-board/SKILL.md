---
name: agile-board
description: "Build an agile planning board for a project manager as one self-contained page: sprints with load against capacity, epics and stories, a roadmap timeline with releases, progress with burn-up and release fit, and people allocation per sprint, with findings to decide on (over-allocation, late dependencies, release slips, missing estimates). Published as a claude.ai artifact, the PM can drag stories between sprints, change assignee, status and estimates, and save. Use when the user asks for an agile board, a sprint plan or sprint board, a release plan, a roadmap of epics, a team allocation or capacity view, or wants to see or review a backlog, a set of epics and stories, or a plan being prepared for Jira. Also use to change a board made earlier, or to read back what the PM changed on the published page."
---

# Agile board

You write one JSON model; a script validates it and produces the page. Never write HTML, CSS or
scripts yourself: they come from the plugin, and the page's views, filters, editing and saving
depend on them. Model the whole plan the sources give you; the page has filters, so never trim
items for an audience.

## Steps

1. **Check python3** (`python3 --version`). If it is missing, say that it is required and stop.
2. **Choose where to write.** A file or folder the user names; otherwise `./pm/<name>.board.json`
   and `./pm/<name>.html`, `<name>` from the subject (`prenotazione-sale`).
3. **Read the model format** in `${CLAUDE_PLUGIN_ROOT}/skills/agile-board/references/model.md`,
   once, before writing the first model. This file does not repeat it.
4. **Write the model** `<name>.board.json`, the only file you write by hand.
   - Take epics, stories, releases, sprints and people from the user's sources (an epics file, a
     backlog, a Jira export, a description). Keep their ids and titles; put requirement ids in `reqs`.
   - In an analysis phase estimates are often missing: leave `estimate` out rather than invent one,
     and leave `sprint` out for what is not planned yet. Never invent people, dates or capacities;
     ask, or leave them out (the page shows what is unknown).
   - Use `meta.lang` `en` only when the user writes in English or asks for it.
5. **Produce the page** (theme `default` unless the user names `alt` or a theme file):
   ```
   python3 "${CLAUDE_PLUGIN_ROOT}/shared/scripts/artifact_page.py" --type agile-board --model <name>.board.json --theme default --out <name>.html
   ```
   On failure nothing is written and every problem is listed: fix the model and run it again.
   Warnings are planning findings, not errors: the page shows them under "Da decidere".
6. **Publish** when the session has the Artifact tool and the user wants it shared or edited:
   publish `<name>.html` with `capabilities: {"artifact": {}}` (that is what lets the PM edit and
   save the page) and `icon: "board"`. Never patch the page by hand before publishing.
7. **Report** the paths (and the link), what the board holds in one sentence, and the warnings as
   decisions for the PM, briefly. For a local look, the same command with `--standalone` writes a
   file a browser opens directly; saving works only on the published page.

## Changing a board

- **The user asks for a change**: edit the existing `.board.json` (keep everything else), run step
  5, and republish to the same file path or artifact URL. Read model.md only for a field the file
  does not use yet.
- **The PM edited the published page**: first read it back, so their changes are not lost. Read the
  artifact with the Artifact tool (`action: "read"`), which saves the page to a file, then run
  ```
  python3 "${CLAUDE_PLUGIN_ROOT}/shared/scripts/extract_model.py" <saved page> --out <name>.board.json
  ```
  It rewrites the local model and prints what changed (moves, assignees, estimates). Do not read the
  page's HTML yourself. Then apply the user's request and continue from step 5.
