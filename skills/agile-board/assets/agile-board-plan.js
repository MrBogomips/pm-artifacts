/* agile-board-plan.js: estimates and planning, pure functions of a model.
   Estimate used: the item's explicit `estimate`, else its rule (`kind`, else `type`): a fixed value
   per item, or `size` x value with a floor. Overrides (the page's sliders) replace rule values.
   Planning `manual`: sprints as written. Planning `auto`: done items stay where they happened;
   active and pinned items start in their sprint and use capacity first; every other assigned and
   estimated item queues, in backlog order with its dependencies first, after its assignee's previous
   item, no earlier than its dependencies' finish (never, if one is not planned) and its own or its
   release's `notBefore` sprint, spilling over sprint
   ends (_spans lists the sprints it uses). What does not fit before the last sprint ends is marked
   _beyond and has no sprint. */
(function () {
  "use strict";
  const AB = window.AB;
  const EPS = 1e-9;
  const round2 = (v) => Math.round(v * 100) / 100;

  function rules(m, overrides) {
    const out = {};
    ((m.estimation && m.estimation.rules) || []).forEach((r) => {
      const o = overrides && overrides[r.id];
      out[r.id] = o == null ? r : { ...r, value: o };
    });
    return out;
  }

  function estimateOf(it, rs) {
    if (it.estimate != null) return { value: it.estimate, source: "explicit" };
    const r = rs[it.kind || it.type || "story"];
    if (!r) return { value: null, source: "none" };
    if (r.per === "size") {
      if (it.size == null) return { value: null, source: "none", rule: r };
      return { value: Math.max(r.floor || 0, round2(it.size * r.value)), source: "rule", rule: r, size: it.size };
    }
    return { value: r.value, source: "rule", rule: r };
  }

  /* Dependencies first, otherwise backlog order; a cycle is broken where it is met. */
  function topoOrder(items) {
    const by = Object.fromEntries(items.map((it) => [it.id, it]));
    const seen = new Set(), out = [];
    const visit = (it) => {
      if (seen.has(it.id)) return;
      seen.add(it.id);
      (it.deps || []).forEach((d) => by[d] && visit(by[d]));
      out.push(it);
    };
    items.forEach(visit);
    return out;
  }

  function emptyUse(m) {
    const used = { "": {} };
    (m.people || []).forEach((p) => { used[p.id] = {}; });
    return used;
  }
  const add = (used, pid, sid, v) => { const row = used[pid] || used[""]; row[sid] = round2((row[sid] || 0) + v); };

  function autoPlan(m, items, used) {
    const sprints = m.sprints, n = sprints.length;
    const idx = Object.fromEntries(sprints.map((s, i) => [s.id, i]));
    const people = Object.fromEntries((m.people || []).map((p) => [p.id, p]));
    const releases = Object.fromEntries((m.releases || []).map((r) => [r.id, r]));
    const cap = (pid, i) => AB.capacity(m, people[pid], sprints[i]) || 0;
    const fixed = (it) => it.sprint && idx[it.sprint] != null && (it.pinned || it.status === "done" || it.status === "active");
    const finish = {}, cursor = {};

    /* Consume a person's free capacity from sprint index s on; returns the index where it ended. */
    function fill(it, s) {
      let rem = it.estimate, first = null;
      it._spans = [];
      if (rem <= EPS && s < n) { first = s; it._spans.push(sprints[s].id); }
      while (rem > EPS && s < n) {
        const free = round2(cap(it.assignee, s) - (used[it.assignee][sprints[s].id] || 0));
        const take = Math.min(free, rem);
        if (take > EPS) { add(used, it.assignee, sprints[s].id, take); rem = round2(rem - take); if (first == null) first = s; it._spans.push(sprints[s].id); }
        if (rem > EPS) s++;
      }
      it._beyond = rem > EPS;
      return { first, end: it._beyond ? n : s };
    }

    /* 1. What is fixed: done work stays where it happened; active and pinned work starts in its sprint and spills. */
    items.forEach((it) => {
      if (it.status === "done") {
        finish[it.id] = 0;
        if (fixed(it) && it.estimate != null) add(used, it.assignee || "", it.sprint, it.estimate);
        if (!fixed(it)) it.sprint = it.sprint && idx[it.sprint] != null ? it.sprint : null;
        return;
      }
      if (!fixed(it)) return;
      if (it.estimate == null || !people[it.assignee]) {
        finish[it.id] = idx[it.sprint];
        if (it.estimate != null) add(used, it.assignee || "", it.sprint, it.estimate);
        return;
      }
      finish[it.id] = fill(it, idx[it.sprint]).end;
    });

    /* 2. Everything else, dependencies first, queued on its assignee after the previous item. */
    topoOrder(items).forEach((it) => {
      if (it.status === "done" || fixed(it)) return;
      it.sprint = null;
      if (!it.assignee || !people[it.assignee] || it.estimate == null) { finish[it.id] = n; return; }   /* never finishes */
      const nb = it.notBefore || (releases[it.release] || {}).notBefore;
      const start = Math.max(cursor[it.assignee] || 0, nb && idx[nb] != null ? idx[nb] : 0,
        ...(it.deps || []).map((d) => (finish[d] == null ? 0 : finish[d])));
      const r = fill(it, start);
      it.sprint = r.first == null ? null : sprints[r.first].id;
      if (r.first == null) it._beyond = true;
      finish[it.id] = r.end;
      if (r.first != null) cursor[it.assignee] = Math.min(r.end, n);   /* an item that never started holds no one up */
    });
  }

  /* The last sprint an item uses: where it finishes. */
  const lastSprint = (it) => (it._spans && it._spans.length ? it._spans[it._spans.length - 1] : it.sprint);

  function plan(m, overrides) {
    const rs = rules(m, overrides);
    const auto = (m.meta && m.meta.planning) === "auto";
    const items = m.items.map((it) => {
      const est = estimateOf(it, rs);
      return { ...it, estimate: est.value, _est: est };
    });
    const used = emptyUse(m);
    if (auto) autoPlan(m, items, used);
    else items.forEach((it) => { if (it.sprint && it.estimate != null) add(used, it.assignee || "", it.sprint, it.estimate); });
    return { items, used, auto, rules: rs };
  }

  /* The model the views draw: items with the estimate used and the planned sprint, plus the plan. */
  function effective(m, overrides) {
    const p = plan(m, overrides);
    return { ...m, items: p.items, _plan: p };
  }

  Object.assign(AB, { rules, estimateOf, plan, effective, lastSprint });
})();
