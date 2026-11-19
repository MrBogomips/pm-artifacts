/* agile-board-views2.js: the Progress and Allocation views (loaded after agile-board-views.js). */
(function () {
  "use strict";
  const PM = window.PM, AB = window.AB, V = window.ABV, esc = PM.esc, t = PM.t, num = PM.num;

  /* Burn-up: cumulative capacity, planned and completed work at each sprint end, against the scope. */
  function burnup(m) {
    const totals = AB.sprintTotals(m);
    const today = m.meta.today;
    let cap = 0, plan = 0, done = 0, capKnown = true;
    const pts = [{ cap: 0, plan: 0, done: 0, label: "" }];
    totals.forEach(({ sprint: s, load, cap: c }) => {
      if (c == null) capKnown = false; else cap += c;
      plan += load;
      done += m.items.filter((it) => it.sprint === s.id && it.status === "done").reduce((a, it) => a + AB.est(it), 0);
      pts.push({ cap, plan, done: !today || s.start <= today ? done : null, label: s.name });
    });
    const scope = m.items.reduce((a, it) => a + AB.est(it), 0);
    const W = 760, H = 280, L = 44, R = 48, T = 14, B = 34;
    const max = Math.max(scope, capKnown ? cap : 0, plan, 1) * 1.08;
    const x = (i) => L + (i * (W - L - R)) / (pts.length - 1);
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const line = (key, cls) => {
      const p = pts.map((d, i) => (d[key] == null ? null : `${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`)).filter(Boolean);
      return p.length > 1 ? `<polyline class="${cls}" points="${p.join(" ")}"/>` : "";
    };
    const raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
    let grid = "";
    for (let v = 0; v <= max; v += step) grid += `<line class="g" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`;
    const labels = pts.map((d, i) => (i ? `<text class="ax" x="${x(i)}" y="${H - 12}" text-anchor="middle">${esc(d.label)}</text>` : "")).join("");
    const last = pts.filter((d) => d.done != null).length - 1;
    const endDot = last > 0 ? `<circle class="dot" cx="${x(last)}" cy="${y(pts[last].done)}" r="4"/>` : "";
    return `<svg class="ab-burn" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("burnup"))}">${grid}` +
      `<line class="scope" x1="${L}" x2="${W - R}" y1="${y(scope)}" y2="${y(scope)}"/>` +
      `${capKnown ? line("cap", "cap") : ""}${line("plan", "plan")}${line("done", "done")}${endDot}${labels}</svg>` +
      `<div class="pm-legend"><span><i style="--c:var(--ink-2)"></i>${t("scope")} (${num(scope)})</span>` +
      `${capKnown ? `<span><i style="--c:var(--line)"></i>${t("capCum")}</span>` : ""}<span><i style="--c:var(--accent)"></i>${t("planCum")}</span>` +
      `<span><i style="--c:var(--status-done)"></i>${t("doneCum")}</span></div>`;
  }

  function releaseCard(m, f) {
    const verdict = f.fits ? `<b class="ab-ok">${t("fits")}</b>` : `<b class="ab-ko">${t("notFits")}</b>`;
    const why = [];
    if (f.cap != null && f.p.est > f.cap) why.push(t("whyCap", { est: num(f.p.est), cap: num(f.cap), u: V.unit() }));
    if (f.late.length) why.push(t("whyLate", { n: f.late.length }));
    if (f.unplanned.length) why.push(t("whyUnplanned", { n: f.unplanned.length }));
    if (f.p.missing) why.push(t("whyMissing", { n: f.p.missing }));
    return `<div class="pm-panel ab-rel"><h3>${esc(f.rel.name)}${f.rel.date ? ` · ${PM.fmtDate(f.rel.date)}` : ""}</h3>` +
      `<div class="pm-muted">${esc(f.rel.desc || "")}</div><p>${verdict}</p><ul>${why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` +
      `<div class="pm-muted">${f.p.done}/${f.p.count} ${t("itemsDone")} · ${num(f.p.estDone)}/${num(f.p.est)} ${V.unit()}</div>` +
      `<div class="pm-meter"><i style="width:${Math.round(f.p.pct * 100)}%"></i></div></div>`;
  }

  function progressView(m, ix) {
    const rels = (m.releases || []).map((r) => releaseCard(m, AB.releaseFit(m, r))).join("");
    const rows = m.epics.map((e) => {
      const p = AB.progress(m.items.filter((it) => it.epic === e.id));
      return `<tr data-epic="${esc(e.id)}"><td><span class="ab-dot" style="--c:${ix.color(e)}"></span>${esc(e.title)}</td><td class="pm-num">${p.done}/${p.count}</td>` +
        `<td class="pm-num">${num(p.estDone)}/${num(p.est)}</td><td class="ab-wide"><div class="pm-meter"><i style="width:${Math.round(p.pct * 100)}%;--c:${ix.color(e)}"></i></div></td>` +
        `<td class="pm-num">${p.risk ? `<span class="pm-status st-risk">${p.risk}</span>` : ""}</td></tr>`;
    }).join("");
    return `${rels ? `<div class="ab-rels">${rels}</div>` : ""}<div class="pm-panel"><h3>${t("burnup")}</h3><div class="pm-scroll">${burnup(m)}</div></div>` +
      `<div class="pm-panel"><h3>${t("epicDone")}</h3><div class="pm-scroll"><table class="pm-table"><tr><th>${t("epic")}</th><th class="pm-num">${t("items")}</th>` +
      `<th class="pm-num">${V.unit()}</th><th></th><th class="pm-num">${t("st_risk")}</th></tr>${rows}</table></div></div>`;
  }

  /* persons x sprints: load against capacity and the items themselves, plus what is outside sprints */
  function peopleView(m, ix, st) {
    const L = AB.loads(m);
    const cols = m.sprints.concat([{ id: "", name: t("backlog") }]);
    const head = `<tr><th>${t("person")}</th>${cols.map((s) => `<th>${esc(s.name)}${s.id ? `<div class="pm-muted">${PM.fmtDate(s.start)} · ${num(AB.sprintDays(s))} ${t("days")}</div>` : ""}</th>`).join("")}</tr>`;
    const cell = (pid, s, cap) => {
      const inCell = (it) => (s.id && it._spans && it._spans.length ? it._spans.includes(s.id) : (it.sprint || "") === s.id);
      const its = m.items.filter((it) => inCell(it) && (it.assignee || "") === pid && V.match(it, ix, st));
      const load = s.id ? (L[pid] || {})[s.id] || 0 : its.reduce((a, it) => a + AB.est(it), 0);
      return `<td class="ab-cell"${s.id ? ` data-cell="${esc(pid)}|${esc(s.id)}"` : ""}>${s.id ? V.meter(load, cap) : (its.length ? `<div class="pm-muted">${num(load)} ${V.unit()}</div>` : "")}` +
        `${its.map((it) => V.chip(it, ix, s.id && it.sprint !== s.id)).join("")}</td>`;
    };
    const people = (m.people || []).filter((p) => !st.person || st.person === p.id);
    const rows = people.map((p) => `<tr><th class="ab-person">${esc(p.name)}<div class="pm-muted">${esc(p.role || "")}${p.availability != null && p.availability !== 1 ? ` · ${Math.round(p.availability * 100)}%` : ""}</div></th>` +
      cols.map((s) => cell(p.id, s, s.id ? AB.capacity(m, p, s) : null)).join("") + "</tr>").join("");
    const none = (!st.person || st.person === "_none") ? `<tr><th class="ab-person">${t("unassigned")}</th>${cols.map((s) => cell("", s, null)).join("")}</tr>` : "";
    return `<div class="pm-panel pm-scroll"><table class="pm-table ab-alloc">${head}${rows}${none}</table></div>` +
      `<p class="pm-muted">${t("allocNote", { n: m.items.filter((it) => !it.sprint).length })}</p>`;
  }

  window.ABV = Object.assign(window.ABV, { progressView, peopleView });
})();
