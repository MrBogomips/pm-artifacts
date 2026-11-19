/* agile-board-views.js: the five views. Each takes (m, ix, st) and returns HTML; st holds the
   filters and whether the page is being edited. Filters narrow the cards and rows shown; loads,
   capacities and release fit always count the whole plan. */
(function () {
  "use strict";
  const PM = window.PM, AB = window.AB, esc = PM.esc, t = PM.t, num = PM.num;

  function match(it, ix, st) {
    const e = ix.epics[it.epic];
    if (st.areas && e && e.area && !st.areas.has(e.area)) return false;
    if (st.release && it.release !== st.release) return false;
    if (st.person === "_none" ? !!it.assignee : st.person && it.assignee !== st.person) return false;
    if (!st.q) return true;
    return [it.id, it.title, it.reqs, e && e.title].join(" ").toLowerCase().includes(st.q);
  }
  const status = (s) => `<span class="pm-status st-${esc(s || "todo")}">${esc(t("st_" + (s || "todo")))}</span>`;
  const unit = () => t("u_" + (PM.model.meta.unit || "gg"));
  const meter = (load, cap) => {
    if (cap == null) return `<div class="pm-muted">${num(load)} ${unit()}</div>`;
    const pct = cap > 0 ? Math.min(100, (load / cap) * 100) : (load > 0 ? 100 : 0);
    return `<div class="ab-load${load > cap ? " over" : ""}"><span>${num(load)} / ${num(cap)} ${unit()}</span><div class="pm-meter${load > cap ? " over" : ""}"><i style="width:${pct}%"></i></div></div>`;
  };

  const estLabel = (it) => (it.estimate == null ? "?" : (it._est && it._est.source === "rule" ? "≈" : "") + num(it.estimate));

  function card(it, ix, st) {
    const p = ix.people[it.assignee];
    return `<div class="ab-card${it._beyond ? " beyond" : ""}" data-id="${esc(it.id)}" style="--c:${ix.color(ix.epics[it.epic])}"${st.editing ? ' draggable="true"' : ""} tabindex="0">` +
      `<div class="ab-card-t">${esc(it.id)} ${esc(it.title)}</div><div class="ab-card-m">` +
      `<span class="pm-tag">${esc(t("ty_" + (it.type || "story")))}</span>${status(it.status)}` +
      `<span>${estLabel(it)} ${unit()}</span>${p ? `<span class="ab-who">${esc(p.name)}</span>` : ""}` +
      `${it.release ? `<span class="pm-tag" style="--c:var(--neutral)">${esc((ix.releases[it.release] || {}).name || it.release)}</span>` : ""}` +
      `${it.pinned && st.auto ? `<span class="pm-tag" style="--c:var(--accent)">${esc(t("plPinned"))}</span>` : ""}</div></div>`;
  }

  /* compact card for the people grid */
  function chip(it, ix, continued) {
    return `<div class="ab-mini${continued ? " cont" : ""}" data-id="${esc(it.id)}" style="--c:${ix.color(ix.epics[it.epic])}" tabindex="0" title="${esc(it.title)}">` +
      `${continued ? "↪ " : ""}<b>${esc(it.id)}</b> ${esc(it.title)} <span class="pm-muted">${estLabel(it)}</span></div>`;
  }

  /* one row per person in a sprint column: load against capacity */
  function teamRows(m, s, L) {
    if (!(m.people || []).length) return "";
    const rows = m.people.map((p) => {
      const load = (L[p.id] || {})[s.id] || 0, cap = AB.capacity(m, p, s);
      const over = cap != null && load > cap + 0.01, pct = cap ? Math.min(100, (load / cap) * 100) : (load ? 100 : 0);
      return `<span class="ab-cap-n">${esc(p.name)}</span><span class="pm-meter${over ? " over" : ""}"><i style="width:${pct}%"></i></span>` +
        `<span class="ab-cap-v${over ? " over" : ""}">${num(load)}${cap != null ? "/" + num(cap) : ""}</span>`;
    }).join("");
    return `<details class="ab-cap" open><summary>${t("teamLoad")}</summary><div class="ab-cap-g">${rows}</div></details>`;
  }

  function column(id, head, sub, metre, items, ix, st, note, team) {
    const groups = {};
    items.forEach((it) => (groups[it.epic] = groups[it.epic] || []).push(it));
    const body = Object.keys(groups).map((eid) => {
      const e = ix.epics[eid];
      return `<div class="ab-grp">${esc(e ? e.title : eid)} · ${groups[eid].length}</div>` + groups[eid].map((it) => card(it, ix, st)).join("");
    }).join("");
    return `<section class="ab-col" data-drop="${esc(id)}"><h3>${esc(head)} · ${items.length}</h3><div class="pm-muted">${sub}</div>${metre}${team || ""}` +
      `${body || `<div class="pm-empty">${esc(note || t("emptyCol"))}</div>`}</section>`;
  }

  function sprintView(m, ix, st) {
    const totals = AB.sprintTotals(m), L = AB.loads(m);
    const cols = totals.map(({ sprint: s, load, cap }) => column(s.id, s.name,
      `${PM.fmtDate(s.start)} – ${PM.fmtDate(s.end)} · ${num(AB.sprintDays(s))} ${t("days")}${s.note ? " · " + esc(s.note) : ""}`,
      meter(load, cap), m.items.filter((it) => it.sprint === s.id && match(it, ix, st)), ix, st, null, teamRows(m, s, L)));
    const back = m.items.filter((it) => !it.sprint && match(it, ix, st));
    cols.push(column("", t("backlog"), esc(st.auto ? t("backlogAuto") : t("backlogSub")), "", back, ix, st, t("emptyBacklog")));
    return `<div class="ab-cols" style="--n:${cols.length}">${cols.join("")}</div>`;
  }

  function itemRows(items, ix) {
    return items.map((it) => `<tr data-id="${esc(it.id)}"><td>${esc(it.id)}</td><td>${esc(it.title)}</td><td>${esc(t("ty_" + (it.type || "story")))}</td>` +
      `<td>${status(it.status)}</td><td class="pm-num">${estLabel(it)}</td>` +
      `<td>${esc((ix.sprints[it.sprint] || {}).name || (it._beyond ? t("beyond") : "—"))}</td><td>${esc((ix.people[it.assignee] || {}).name || "—")}</td></tr>`).join("");
  }
  const itemHead = () => `<tr><th></th><th>${t("title")}</th><th>${t("type")}</th><th>${t("status")}</th><th class="pm-num">${unit()}</th><th>${t("sprint")}</th><th>${t("assignee")}</th></tr>`;

  function epicsView(m, ix, st) {
    return m.epics.map((e) => {
      if (st.areas && e.area && !st.areas.has(e.area)) return "";
      const all = m.items.filter((it) => it.epic === e.id);
      const shown = all.filter((it) => match(it, ix, st));
      if ((st.q || st.release || st.person) && !shown.length) return "";
      const p = AB.progress(all);
      const area = ix.areas[e.area];
      return `<details class="ab-epic" style="--c:${ix.color(e)}" ${st.open.has(e.id) ? "open" : ""} data-epic-box="${esc(e.id)}"><summary>` +
        `<span class="ab-epic-t">${esc(e.title)}</span>${area ? `<span class="pm-tag">${esc(area.name)}</span>` : ""}` +
        `${(e.releases || []).map((r) => `<span class="pm-tag" style="--c:var(--neutral)">${esc((ix.releases[r] || {}).name || r)}</span>`).join("")}` +
        `<span class="ab-epic-p"><span class="pm-muted">${p.done}/${p.count} · ${num(p.estDone)}/${num(p.est)} ${unit()}</span><span class="pm-meter"><i style="width:${Math.round(p.pct * 100)}%"></i></span></span>` +
        `<button class="pm-chip on" data-epic="${esc(e.id)}">${t("details")}</button></summary>` +
        `<div class="ab-epic-b">${e.goal ? `<p class="pm-muted">${esc(e.goal)}</p>` : ""}<div class="pm-scroll"><table class="pm-table">${itemHead()}${itemRows(shown, ix)}</table></div></div></details>`;
    }).join("") || `<div class="pm-empty">${t("noMatch")}</div>`;
  }

  function roadmapView(m, ix, st) {
    const tl = AB.timeline(m);
    const pos = (a, b) => `left:${(a * 100).toFixed(2)}%;width:${Math.max(0.6, (b - a) * 100).toFixed(2)}%`;
    const head = m.sprints.map((s) => `<div class="ab-tl-sprint" style="${pos(tl.at(s.start), tl.at(s.end, true))}">${esc(s.name)}</div>`).join("");
    const marks = (m.releases || []).filter((r) => r.date).map((r) => `<div class="ab-tl-mark rel${tl.at(r.date, true) > 0.9 ? " end" : ""}" style="left:${(tl.at(r.date, true) * 100).toFixed(2)}%"><span>${esc(r.name)} · ${PM.fmtDate(r.date)}</span></div>`).join("") +
      (m.meta.today ? `<div class="ab-tl-mark today" style="left:${(tl.at(m.meta.today) * 100).toFixed(2)}%"><span>${t("today")}</span></div>` : "");
    const rows = m.epics.filter((e) => !(st.areas && e.area && !st.areas.has(e.area))).map((e) => {
      const its = m.items.filter((it) => it.epic === e.id && match(it, ix, st));
      const planned = its.filter((it) => it.sprint).map((it) => ix.sprints[it.sprint]);
      const p = AB.progress(its);
      let bar = `<span class="pm-muted ab-tl-none">${t("notPlanned")}</span>`;
      if (planned.length) {
        const a = tl.at(planned.reduce((x, s) => (s.start < x ? s.start : x), planned[0].start));
        const b = tl.at(planned.reduce((x, s) => (s.end > x ? s.end : x), planned[0].end), true);
        bar = `<div class="ab-tl-bar" data-epic="${esc(e.id)}" style="${pos(a, b)};--c:${ix.color(e)}" title="${esc(e.title)}"><i style="width:${Math.round(p.pct * 100)}%"></i><span>${p.done}/${p.count}</span></div>`;
      }
      const unpl = its.length - its.filter((it) => it.sprint).length;
      return `<div class="ab-tl-label"><b>${esc(e.title)}</b>${unpl ? `<span class="pm-muted"> · ${unpl} ${t("unplannedShort")}</span>` : ""}</div><div class="ab-tl-track">${bar}</div>`;
    }).join("");
    return `<div class="pm-panel pm-scroll"><div class="ab-tl"><div></div><div class="ab-tl-track ab-tl-head">${head}</div>${rows}<div class="ab-tl-marks" aria-hidden="true">${marks}</div></div></div>`;
  }

  window.ABV = { match, card, chip, estLabel, meter, status, unit, sprintView, epicsView, roadmapView, itemRows, itemHead };
})();
