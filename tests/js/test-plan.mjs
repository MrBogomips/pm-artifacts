// Tests of the agile board's estimation and automatic planning (assets/agile-board-plan.js), run with
// `node --test tests/js/`. The page scripts run in a vm context with a minimal window and PM stub.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

function load() {
  const ctx = { window: {}, console };
  ctx.window.PM = { t: (k) => k, num: (n) => String(n) };
  vm.createContext(ctx);
  for (const f of ["skills/agile-board/assets/agile-board-data.js", "skills/agile-board/assets/agile-board-plan.js"]) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx.window.AB;
}
const AB = load();

const base = () => ({
  meta: { title: "T", unit: "gg", planning: "auto" },
  estimation: { rules: [
    { id: "dev", label: "Dev", per: "size", value: 0.5, floor: 1 },
    { id: "cons", label: "Cons", per: "item", value: 3 },
  ] },
  releases: [{ id: "R1", name: "R1", date: "2026-01-16" }, { id: "R2", name: "R2", notBefore: "S2" }],
  sprints: [
    { id: "S1", name: "S1", start: "2026-01-05", end: "2026-01-09", days: 5 },
    { id: "S2", name: "S2", start: "2026-01-12", end: "2026-01-16", days: 5 },
  ],
  people: [{ id: "a", name: "A" }, { id: "b", name: "B", availability: 0.5 }],
  epics: [{ id: "E1", title: "E" }],
  items: [],
});
const item = (id, extra) => ({ id, epic: "E1", title: id, ...extra });
const byId = (plan) => Object.fromEntries(plan.items.map((i) => [i.id, i]));

test("estimate: explicit beats the rule, size rule has a floor, item rule is fixed", () => {
  const m = base();
  m.items = [item("x", { kind: "dev", size: 6, estimate: 2 }), item("y", { kind: "dev", size: 1 }), item("z", { kind: "cons" }), item("w", { kind: "dev", size: 6 })];
  const p = byId(AB.plan(m));
  assert.equal(p.x.estimate, 2);
  assert.equal(p.x._est.source, "explicit");
  assert.equal(p.y.estimate, 1);          // 1 x 0.5 = 0.5, floor 1
  assert.equal(p.z.estimate, 3);
  assert.equal(p.w.estimate, 3);
  assert.equal(p.w._est.source, "rule");
});

test("estimate: kind falls back to the item type, unknown rule leaves no estimate", () => {
  const m = base();
  m.estimation.rules.push({ id: "bug", label: "Bug", per: "item", value: 0.5 });
  m.items = [item("b", { type: "bug" }), item("n", { type: "spike" })];
  const p = byId(AB.plan(m));
  assert.equal(p.b.estimate, 0.5);
  assert.equal(p.n.estimate, null);
});

test("overrides change the rule value (the sliders)", () => {
  const m = base();
  m.items = [item("w", { kind: "dev", size: 6 })];
  assert.equal(byId(AB.plan(m, { dev: 1 })).w.estimate, 6);
});

test("auto: items fill a person's capacity in order and spill into the next sprint", () => {
  const m = base();
  m.items = [item("i1", { estimate: 3, assignee: "a" }), item("i2", { estimate: 4, assignee: "a" }), item("i3", { estimate: 4, assignee: "a" })];
  const plan = AB.plan(m);
  const p = byId(plan);
  assert.equal(p.i1.sprint, "S1");
  assert.equal(p.i2.sprint, "S1");        // starts in S1 (2 days free), ends in S2
  assert.equal(p.i3.sprint, "S2");
  assert.equal(plan.used.a.S1, 5);
  assert.equal(plan.used.a.S2, 5);
  assert.equal(p.i3._beyond, true);       // 1 day left over after the last sprint
  assert.deepEqual([...p.i2._spans], ["S1", "S2"]);
});

test("auto: availability scales capacity", () => {
  const m = base();
  m.items = [item("i1", { estimate: 3, assignee: "b" })];
  const plan = AB.plan(m);
  assert.equal(plan.used.b.S1, 2.5);
  assert.equal(plan.used.b.S2, 0.5);
});

test("auto: done, active and pinned items keep their sprint and use capacity first", () => {
  const m = base();
  m.items = [item("late", { estimate: 2, assignee: "a" }), item("pin", { estimate: 4, assignee: "a", sprint: "S1", pinned: true }),
    item("done", { estimate: 1, assignee: "a", sprint: "S2", status: "done" })];
  const plan = AB.plan(m);
  const p = byId(plan);
  assert.equal(p.pin.sprint, "S1");
  assert.equal(p.done.sprint, "S2");
  assert.equal(p.late.sprint, "S1");      // 1 day free in S1, then S2
  assert.equal(plan.used.a.S1, 5);
  assert.equal(plan.used.a.S2, 2);
});

test("auto: dependencies and notBefore delay the start", () => {
  const m = base();
  m.items = [item("d2", { estimate: 1, assignee: "b", deps: ["d1"] }), item("d1", { estimate: 3, assignee: "a" }),
    item("r2", { estimate: 1, assignee: "a", release: "R2" }), item("nb", { estimate: 1, assignee: "b", notBefore: "S2" })];
  const p = byId(AB.plan(m));
  assert.equal(p.d1.sprint, "S1");
  assert.equal(p.d2.sprint, "S1");        // d1 finishes inside S1
  assert.equal(p.r2.sprint, "S2");        // release R2 not before S2
  assert.equal(p.nb.sprint, "S2");
});

test("auto: unassigned or unestimated items stay outside sprints", () => {
  const m = base();
  m.items = [item("u", { estimate: 1 }), item("q", { assignee: "a" })];
  const p = byId(AB.plan(m));
  assert.equal(p.u.sprint, null);
  assert.equal(p.q.sprint, null);
});

test("manual: sprints are kept, load is the sum of estimates", () => {
  const m = base();
  m.meta.planning = "manual";
  m.items = [item("i1", { estimate: 7, assignee: "a", sprint: "S1" })];
  const plan = AB.plan(m);
  assert.equal(byId(plan).i1.sprint, "S1");
  assert.equal(plan.used.a.S1, 7);
});

test("auto: a done item without a sprint is not scheduled and uses no capacity", () => {
  const m = base();
  m.items = [item("old", { estimate: 5, assignee: "a", status: "done" }), item("x", { estimate: 1, assignee: "a" })];
  const plan = AB.plan(m), p = byId(plan);
  assert.equal(p.old.sprint, null);
  assert.equal(p.x.sprint, "S1");
  assert.equal(plan.used.a.S1, 1);
});

test("auto: a pinned item spills from its sprint instead of overloading it", () => {
  const m = base();
  m.items = [item("pin", { estimate: 8, assignee: "a", sprint: "S1", pinned: true })];
  const plan = AB.plan(m);
  assert.equal(plan.used.a.S1, 5);
  assert.equal(plan.used.a.S2, 3);
  assert.deepEqual([...byId(plan).pin._spans], ["S1", "S2"]);
});

test("auto: an item whose dependency is not planned is not planned either", () => {
  const m = base();
  m.items = [item("dep", { estimate: 1 }), item("x", { estimate: 1, assignee: "a", deps: ["dep"] }),
    item("ok", { estimate: 1, assignee: "a", deps: ["fin"] }), item("fin", { estimate: 1, status: "done" })];
  const p = byId(AB.plan(m));
  assert.equal(p.x.sprint, null);
  assert.equal(p.ok.sprint, "S1");        // a done dependency counts as finished
});

test("release fit counts the last sprint an item uses", () => {
  const m = base();
  m.items = [item("big", { estimate: 8, assignee: "a", release: "R1" })];
  m.releases[0].date = "2026-01-09";      // end of S1
  const em = AB.effective(m);
  const f = AB.releaseFit(em, em.releases[0]);
  assert.equal(f.fits, false);
  assert.equal(f.late.length, 1);
  assert.ok(AB.findings(em).some((x) => x.kind === "slip"));
});
