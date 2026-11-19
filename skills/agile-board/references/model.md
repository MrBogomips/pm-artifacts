# Agile board model (`<name>.board.json`)

One JSON object. Only `meta.title`, `sprints`, `epics` and `items` are required; everything else
makes the board richer. Ids are short strings of letters, digits, `.`, `_`, `-`, unique within their
list. Dates are `YYYY-MM-DD`. Unknown fields are kept and ignored.

## Fields

| Path | Type | Notes |
|---|---|---|
| `meta.title` | string, **required** | page title: the name of the plan (`"Prenotazione Sale"`) |
| `meta.project` | string | subtitle |
| `meta.lang` | `it` \| `en` | interface language, default `it` |
| `meta.today` | date | the "today" line and what counts as completed so far |
| `meta.unit` | `gg` \| `pt` | unit of estimates and capacity: working days (default) or story points |
| `meta.sourceLink` | http(s) URL | link to the source document (backlog, epics file) |
| `meta.notes` | string[] | short lines under the title (assumptions, caveats) |
| `releases[]` | `{id, name, date?, desc?}` | a release line on the roadmap; fit check in Progress |
| `sprints[]` **required** | `{id, name, start, end, days?, note?}` | in order. `days` = working days; default: weekdays from start to end |
| `people[]` | `{id, name, role?, availability?, capacity?, sprintCapacity?}` | see Capacity |
| `areas[]` | `{id, name}` | colors cycle through the theme's five group colors, in order |
| `epics[]` **required** | `{id, title, area?, releases?[], goal?, reqs?}` | `area` and `releases` name ids |
| `items[]` **required** | see below | stories, tasks, bugs, spikes |

Item: `{id, epic, title, type?, status?, estimate?, sprint?, release?, assignee?, deps?[], reqs?, desc?}`

- `epic` **required**, an epic id. `sprint` a sprint id, or `null`/absent for "outside sprints".
- `type`: `story` (default), `task`, `bug`, `spike`.
- `status`: `todo` (default), `active`, `done`, `risk`, `blocked`.
- `estimate`: number ≥ 0 in `meta.unit`; leave it out when unknown (the board counts the gaps).
- `assignee` a person id; `release` a release id; `deps` item ids this item needs first.
- `reqs` free text (requirement ids); `desc` free text (user story, notes), shown in the drawer.

## Capacity

Per person and sprint, the first that applies: `sprintCapacity[<sprint id>]`, then `capacity`
(same for every sprint), then, with unit `gg` only, `days × availability` (`availability` 0..1,
default 1). With unit `pt` and no capacity the load is shown without a limit.

## What the validator says

Errors (no page): broken references, repeated ids, bad dates, a sprint ending before it starts,
values outside the lists above. Warnings (page drawn, also listed on the page under "To decide"):
a person over capacity in a sprint, a dependency planned later or not at all, an item in a sprint
that ends after its release date, items without an estimate.

## Example

```json
{
 "meta": {"title": "Prenotazione Sale", "project": "Portale prenotazione sale", "lang": "it", "today": "2026-12-09", "unit": "gg"},
 "releases": [{"id": "R1", "name": "R1", "date": "2026-12-31", "desc": "Prenotazione di base"}],
 "sprints": [
  {"id": "S1", "name": "Sprint 1", "start": "2026-11-23", "end": "2026-12-04"},
  {"id": "S2", "name": "Sprint 2", "start": "2026-12-07", "end": "2026-12-18", "days": 9, "note": "08/12 festivo"}
 ],
 "people": [
  {"id": "lf", "name": "Laura Ferri", "role": "Sviluppo"},
  {"id": "mt", "name": "Marco Testa", "role": "Analisi", "availability": 0.6, "sprintCapacity": {"S2": 3}}
 ],
 "areas": [{"id": "core", "name": "Prenotazioni"}],
 "epics": [{"id": "E1", "title": "Catalogo sale", "area": "core", "releases": ["R1"], "goal": "Le sedi pubblicano le sale."}],
 "items": [
  {"id": "1.1", "epic": "E1", "title": "Registrare una sala", "estimate": 5, "status": "done", "sprint": "S1", "release": "R1", "assignee": "lf"},
  {"id": "1.2", "epic": "E1", "type": "task", "title": "Verificare il tracciato delle sedi", "status": "blocked", "sprint": "S2", "assignee": "mt", "deps": ["1.1"]},
  {"id": "1.3", "epic": "E1", "title": "Importare le sale esistenti", "release": "R1"}
 ]
}
```
