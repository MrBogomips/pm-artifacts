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
| `meta.planning` | `manual` \| `auto` | `manual` (default): sprints as written. `auto`: the page plans; see Planning. Needs unit `gg` |
| `meta.sourceLink` | http(s) URL | link to the source document (backlog, epics file) |
| `meta.notes` | string[] | short lines under the title (assumptions, caveats) |
| `releases[]` | `{id, name, date?, desc?, notBefore?}` | a release line on the roadmap, verdict at the top; `notBefore` a sprint id (auto planning) |
| `estimation.rules[]` | see Estimation | one slider per rule on the page |
| `sprints[]` **required** | `{id, name, start, end, days?, note?}` | in order. `days` = working days; default: weekdays from start to end |
| `people[]` | `{id, name, role?, availability?, capacity?, sprintCapacity?}` | see Capacity |
| `areas[]` | `{id, name}` | colors cycle through the theme's five group colors, in order |
| `epics[]` **required** | `{id, title, area?, releases?[], goal?, reqs?}` | `area` and `releases` name ids |
| `items[]` **required** | see below | stories, tasks, bugs, spikes |

Item: `{id, epic, title, type?, status?, estimate?, kind?, size?, sprint?, pinned?, notBefore?, release?, assignee?, deps?[], reqs?, desc?}`

- `epic` **required**, an epic id. `sprint` a sprint id, or `null`/absent for "outside sprints".
- `type`: `story` (default), `task`, `bug`, `spike`.
- `status`: `todo` (default), `active`, `done`, `risk`, `blocked`.
- `estimate`: number ≥ 0 in `meta.unit`; it wins over any rule. Leave it out when unknown.
- `kind`: the id of an estimation rule; default: the rule whose id is the item's `type`.
- `size`: the quantity a `per: "size"` rule multiplies (acceptance scenarios, screens, endpoints).
- `pinned`: with auto planning, keeps the item in its `sprint`. `notBefore`: earliest sprint id.
- `assignee` a person id; `release` a release id; `deps` item ids this item needs first.
- `reqs` free text (requirement ids); `desc` free text (user story, notes), shown in the drawer.

## Capacity

Per person and sprint, the first that applies: `sprintCapacity[<sprint id>]`, then `capacity`
(same for every sprint), then, with unit `gg` only, `days × availability` (`availability` 0..1,
default 1). With unit `pt` and no capacity the load is shown without a limit.

## Estimation

`estimation.rules[]`: `{id, label, per, value, sizeLabel?, floor?, min?, max?, step?}`.

- `per: "item"`: every item of the rule takes `value`.
- `per: "size"`: `size × value`, at least `floor`; `sizeLabel` names the unit ("scenario di accettazione").
- `min`, `max`, `step`: the slider's range (defaults around `value`).

Estimate used = `estimate`, else the rule of `kind` (else of `type`), else none. On the page the sliders
are a what-if for every viewer; while editing, a change is saved into the rule.

## Planning

With `meta.planning: "auto"` the page computes the sprints, again at every slider change:

1. `done` items stay where they happened. `active` and `pinned` items start in their sprint, use
   capacity first and spill into the next sprints when they do not fit.
2. Every other item with an assignee and an estimate, in list order with its `deps` first, queues
   after its assignee's previous item, never before its deps finish (never at all if a dep is not
   planned) nor its `notBefore` (or its release's). A long item spills into the following sprints.
3. What does not fit before the last sprint ends goes outside sprints, as do unassigned items.

The PM can drag a card to pin it, and "Freeze the plan" pins every planned item to the sprint where
it starts (planning stays `auto`, so long items keep their spill). Release verdicts and findings use
the sprint where an item finishes. The validator does not repeat the schedule: with `auto` its warnings say so.

## What the validator says

Errors (no page): broken references, repeated ids, bad dates, a sprint ending before it starts,
values outside the lists above, a malformed rule, `auto` planning with unit `pt`. Warnings (page drawn, also listed on the page under "To decide"):
a person over capacity in a sprint, a dependency planned later or not at all, an item in a sprint
that ends after its release date, items without an estimate.

## Example

```json
{
 "meta": {"title": "Prenotazione Sale", "project": "Portale prenotazione sale", "lang": "it", "today": "2026-12-09", "unit": "gg", "planning": "auto"},
 "estimation": {"rules": [
  {"id": "story", "label": "Storie", "per": "size", "sizeLabel": "scenario di accettazione", "value": 0.5, "floor": 1, "min": 0.2, "max": 1, "step": 0.05},
  {"id": "task", "label": "Attività", "per": "item", "value": 1}
 ]},
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
  {"id": "1.3", "epic": "E1", "title": "Importare le sale esistenti", "size": 6, "release": "R1", "assignee": "lf"}
 ]
}
```
