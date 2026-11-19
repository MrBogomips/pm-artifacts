# pm-artifacts

A Claude Code plugin of decision boards for project managers. Hand over a plan, an epics file or a
backlog, and a skill turns it into one self-contained page that shows where the plan holds and where
it does not: who is over capacity, which release does not fit, which dependency comes too late, what
is still unestimated. Published as a claude.ai artifact, the page can be edited by the PM and saved;
the next session reads the changes back.

- **Made for the decision, not the decoration.** Tables, timelines and meters, with the findings to
  decide on at the top.
- **Editable where it is published.** On a claude.ai artifact the PM drags stories between sprints,
  changes assignee, status and estimate, and saves a new version of the page.
- **One family with eng-artifacts.** Same theme tokens, a light/dark toggle, replaceable themes.
- **Cheap to produce.** The agent writes a small JSON model; a script validates it and builds the page.

## Skills

| Skill | What it produces |
|---|---|
| [`agile-board`](skills/agile-board/SKILL.md) | Agile board: sprints with load against capacity and team allocation, epics and stories, roadmap with releases, progress with burn-up and release fit, people allocation per sprint, estimation sliders with automatic re-planning |

## Install

```
claude plugin marketplace add MrBogomips/claude-plugins
claude plugin install pm-artifacts@mrbogomips
```

The repository is also a single-plugin marketplace of its own (`claude plugin marketplace add
MrBogomips/pm-artifacts`, then `claude plugin install pm-artifacts@pm-artifacts`); use one or the other.

## Requirements

- Claude Code with plugin support.
- `python3` 3.8 or later, standard library only: it validates the model and assembles the page.
- Editing and saving need the page published as a claude.ai artifact; a local file is read-only.

## Usage

```
Prepara la board agile di questo piano: <epiche, storie, sprint, team>
```

The skill writes `./pm/<name>.board.json` (the model, data only) and `./pm/<name>.html` (the page),
and publishes the page when the session can. Ask for changes later in plain words, or say that the
PM has edited the board: the skill reads the published page back before changing anything.

Build a page yourself:

```
python3 shared/scripts/artifact_page.py --type agile-board --model plan.board.json --theme default --out plan.html
python3 shared/scripts/artifact_page.py --type agile-board --model plan.board.json --out plan-local.html --standalone   # to open locally
python3 shared/scripts/extract_model.py saved-page.html --out plan.board.json   # read back the PM's edits
```

The model format is in [skills/agile-board/references/model.md](skills/agile-board/references/model.md).
Two themes ship, `default` and `alt`; a theme of your own is a copy of `shared/themes/default.css`
with every token kept, passed by path.

## Development

```
bash tests/run-structural-tests.sh   # needs python3 and jq; node runs the page-logic tests when installed
```
