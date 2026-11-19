/* agile-board-data.js: figures derived from the model. Pure functions of a model; the same rules as
   scripts/agile_board_model.py (capacity, warnings), so the page and the validator agree. */
(function () {
  "use strict";
  const PM = window.PM;
  const DAY = 86400000;
  const iso = (s) => new Date(s + "T00:00:00Z");

  function sprintDays(s) {
    if (s.days != null) return s.days;
    let n = 0;
    for (let d = iso(s.start); d <= iso(s.end); d = new Date(d.getTime() + DAY)) n += d.getUTCDay() % 6 !== 0 ? 1 : 0;
    return n;
  }

  /* Capacity of a person in a sprint: sprintCapacity, else capacity, else (unit gg) days x availability. */
  function capacity(m, p, s) {
    const o = (p.sprintCapacity || {})[s.id];
    if (o != null) return o;
    if (p.capacity != null) return p.capacity;
    if ((m.meta.unit || "gg") === "gg") return Math.round(sprintDays(s) * (p.availability ?? 1) * 100) / 100;
    return null;
  }

  function index(m) {
    const by = (arr) => Object.fromEntries((arr || []).map((x) => [x.id, x]));
    const areaColor = {};
    (m.areas || []).forEach((a, i) => { areaColor[a.id] = `var(--group-${(i % 5) + 1})`; });
    const sprintOrder = Object.fromEntries(m.sprints.map((s, i) => [s.id, i]));
    return { sprints: by(m.sprints), people: by(m.people), epics: by(m.epics), items: by(m.items),
      releases: by(m.releases), areas: by(m.areas), sprintOrder,
      color: (epic) => (epic && areaColor[epic.area]) || "var(--accent)" };
  }

  const est = (it) => (it.estimate == null ? 0 : it.estimate);

  /* load[personId|""][sprintId] = sum of estimates; "" is the unassigned row. */
  function loads(m) {
    const out = { "": {} };
    (m.people || []).forEach((p) => { out[p.id] = {}; });
    m.items.forEach((it) => {
      if (!it.sprint) return;
      const row = out[it.assignee || ""] || out[""];
      row[it.sprint] = (row[it.sprint] || 0) + est(it);
    });
    return out;
  }

  function sprintTotals(m) {
    const L = loads(m);
    return m.sprints.map((s) => {
      let load = 0, cap = 0, known = (m.people || []).length > 0;
      Object.values(L).forEach((row) => { load += row[s.id] || 0; });
      (m.people || []).forEach((p) => { const c = capacity(m, p, s); if (c == null) known = false; else cap += c; });
      return { sprint: s, load, cap: known ? cap : null };
    });
  }

  function progress(items) {
    const r = { count: items.length, done: 0, est: 0, estDone: 0, risk: 0, missing: 0 };
    items.forEach((it) => {
      r.est += est(it);
      if (it.status === "done") { r.done++; r.estDone += est(it); }
      if (it.status === "risk" || it.status === "blocked") r.risk++;
      if (it.estimate == null && it.status !== "done") r.missing++;
    });
    r.pct = r.est > 0 ? r.estDone / r.est : (r.count ? r.done / r.count : 0);
    return r;
  }

  /* Does a release fit? Scope against the capacity of the sprints that end by its date. */
  function releaseFit(m, rel) {
    const items = m.items.filter((it) => it.release === rel.id);
    const p = progress(items);
    const ix = index(m);
    const inTime = rel.date ? m.sprints.filter((s) => s.end <= rel.date) : m.sprints;
    const totals = sprintTotals(m);
    const cap = totals.filter((t) => inTime.includes(t.sprint)).reduce((a, t) => (t.cap == null || a == null ? null : a + t.cap), 0);
    const late = items.filter((it) => it.sprint && rel.date && ix.sprints[it.sprint].end > rel.date);
    const unplanned = items.filter((it) => !it.sprint);
    return { rel, items, p, cap, late, unplanned, fits: late.length === 0 && unplanned.length === 0 && (cap == null || p.est <= cap) };
  }

  function findings(m) {
    const ix = index(m), out = [], t = PM.t, L = loads(m), slips = {};
    (m.people || []).forEach((p) => m.sprints.forEach((s) => {
      const c = capacity(m, p, s), v = L[p.id][s.id] || 0;
      if (c != null && v > c) out.push({ kind: "over", text: t("fOver", { who: p.name, sprint: s.name, load: PM.num(v), cap: PM.num(c) }), person: p.id, sprint: s.id });
    }));
    m.items.forEach((it) => {
      const mine = ix.sprintOrder[it.sprint];
      if (mine == null) return;
      (it.deps || []).forEach((d) => {
        const dep = ix.items[d];
        const theirs = dep ? ix.sprintOrder[dep.sprint] : undefined;
        if (theirs == null || theirs > mine) out.push({ kind: "dep", text: t(theirs == null ? "fDepNone" : "fDepLate", { a: it.id, b: d }), item: it.id });
      });
      const r = ix.releases[it.release];
      if (r && r.date && ix.sprints[it.sprint].end > r.date) {
        const key = r.id + "|" + it.sprint;
        (slips[key] = slips[key] || { rel: r, sprint: ix.sprints[it.sprint], ids: [] }).ids.push(it.id);
      }
    });
    Object.values(slips).forEach((g) => out.push({ kind: "slip", text: t("fSlip", { n: g.ids.length, ids: g.ids.join(", "), sprint: g.sprint.name, rel: g.rel.name }) }));
    const missing = m.items.filter((it) => it.estimate == null && it.status !== "done").map((it) => it.id);
    if (missing.length) out.push({ kind: "est", text: t("fEst", { n: missing.length, ids: missing.join(", ") }) });
    return out;
  }

  /* Timeline geometry: a date as a fraction of the span that holds every sprint, release date and today. */
  function timeline(m) {
    const dates = m.sprints.flatMap((s) => [s.start, s.end]).concat((m.releases || []).map((r) => r.date), [m.meta.today]).filter(Boolean).sort();
    const t0 = iso(dates[0]).getTime(), t1 = iso(dates[dates.length - 1]).getTime() + DAY;
    const at = (d, endOfDay) => Math.min(1, Math.max(0, (iso(d).getTime() + (endOfDay ? DAY : 0) - t0) / (t1 - t0)));
    return { at };
  }

  window.AB = { sprintDays, capacity, index, loads, sprintTotals, progress, releaseFit, findings, timeline, est };
})();
