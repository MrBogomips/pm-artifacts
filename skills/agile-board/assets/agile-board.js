/* agile-board.js: boot of the agile board. Builds the page head, summary, findings and toolbar,
   routes the five views, opens the details drawer and, while editing, applies changes to the model
   (drag a card to another sprint or to the backlog; change sprint, assignee, status, release or
   estimate in the drawer). Every change builds a new model and goes through PM.save.change. */
(function () {
  "use strict";
  const PM = window.PM, AB = window.AB, V = window.ABV, esc = PM.esc, t = PM.t, num = PM.num;

  PM.i18n({
    it: { vSprint: "Sprint", vEpics: "Epiche", vRoadmap: "Roadmap", vProgress: "Avanzamento", vPeople: "Allocazioni",
      epics: "epiche", items: "elementi", estimated: "stimato", completed: "completato", atRisk: "a rischio o bloccati", sprints: "sprint",
      people: "persone", unplanned: "fuori dagli sprint", allReleases: "Tutte le release", allPeople: "Tutte le persone", unassigned: "Non assegnato",
      today: "Oggi", source: "Fonte", backlog: "Fuori dagli sprint", backlogSub: "Da pianificare", emptyCol: "Nessun elemento.",
      emptyBacklog: "Tutto è pianificato.", days: "gg lav.", title: "Titolo", type: "Tipo", status: "Stato", sprint: "Sprint", assignee: "Assegnatario",
      release: "Release", estimate: "Stima", epic: "Epica", area: "Area", reqs: "Requisiti", deps: "Dipende da", dependents: "Richiesto da",
      details: "dettaglio", noMatch: "Nessun elemento corrisponde ai filtri.", notPlanned: "non pianificata", unplannedShort: "fuori sprint",
      burnup: "Burn-up", scope: "Perimetro totale", capCum: "Capacità cumulata", planCum: "Pianificato cumulato", doneCum: "Completato",
      fits: "Ci sta", notFits: "Non ci sta", whyCap: "{est} {u} pianificati per {cap} {u} di capacità negli sprint entro la data",
      whyLate: "{n} elementi in sprint che finiscono dopo la data", whyUnplanned: "{n} elementi fuori dagli sprint",
      whyMissing: "{n} elementi senza stima: il conto è parziale", itemsDone: "elementi completati", epicDone: "Completamento per epica",
      person: "Persona", allocNote: "Il carico conta le stime degli elementi negli sprint. {n} elementi sono fuori dagli sprint.",
      findings: "Da decidere ({n})", goal: "Obiettivo", progress: "Avanzamento", none: "nessuno", openSource: "Apri la fonte",
      fOver: "{who} è sovrallocato in {sprint}: {load} pianificati per {cap} disponibili",
      fDepLate: "{a} dipende da {b}, pianificato in uno sprint successivo", fDepNone: "{a} dipende da {b}, che non è pianificato",
      fSlip: "{a} è in {sprint}, che finisce dopo la release {rel}", fEst: "{n} elementi senza stima: {ids}",
      cellTitle: "{who} · {sprint}", areas: "Aree",
      ty_story: "Storia", ty_task: "Attività", ty_bug: "Bug", ty_spike: "Spike",
      st_todo: "Da fare", st_active: "In corso", st_done: "Fatto", st_risk: "A rischio", st_blocked: "Bloccato", u_gg: "gg", u_pt: "pt" },
    en: { vSprint: "Sprints", vEpics: "Epics", vRoadmap: "Roadmap", vProgress: "Progress", vPeople: "Allocation",
      epics: "epics", items: "items", estimated: "estimated", completed: "completed", atRisk: "at risk or blocked", sprints: "sprints",
      people: "people", unplanned: "outside sprints", allReleases: "All releases", allPeople: "All people", unassigned: "Unassigned",
      today: "Today", source: "Source", backlog: "Outside sprints", backlogSub: "To be planned", emptyCol: "No items.",
      emptyBacklog: "Everything is planned.", days: "work days", title: "Title", type: "Type", status: "Status", sprint: "Sprint", assignee: "Assignee",
      release: "Release", estimate: "Estimate", epic: "Epic", area: "Area", reqs: "Requirements", deps: "Depends on", dependents: "Needed by",
      details: "details", noMatch: "No item matches the filters.", notPlanned: "not planned", unplannedShort: "outside sprints",
      burnup: "Burn-up", scope: "Total scope", capCum: "Cumulative capacity", planCum: "Cumulative plan", doneCum: "Completed",
      fits: "Fits", notFits: "Does not fit", whyCap: "{est} {u} planned for {cap} {u} of capacity in the sprints up to the date",
      whyLate: "{n} items in sprints that end after the date", whyUnplanned: "{n} items outside sprints",
      whyMissing: "{n} items without an estimate: the count is partial", itemsDone: "items completed", epicDone: "Completion by epic",
      person: "Person", allocNote: "Load counts the estimates of the items in sprints. {n} items are outside sprints.",
      findings: "To decide ({n})", goal: "Goal", progress: "Progress", none: "none", openSource: "Open the source",
      fOver: "{who} is over capacity in {sprint}: {load} planned for {cap} available",
      fDepLate: "{a} depends on {b}, planned in a later sprint", fDepNone: "{a} depends on {b}, which is not planned",
      fSlip: "{a} is in {sprint}, which ends after release {rel}", fEst: "{n} items without an estimate: {ids}",
      cellTitle: "{who} · {sprint}", areas: "Areas",
      ty_story: "Story", ty_task: "Task", ty_bug: "Bug", ty_spike: "Spike",
      st_todo: "To do", st_active: "In progress", st_done: "Done", st_risk: "At risk", st_blocked: "Blocked", u_gg: "d", u_pt: "pt" },
  });

  const TABS = [{ id: "sprint", label: t("vSprint") }, { id: "epics", label: t("vEpics") }, { id: "roadmap", label: t("vRoadmap") },
    { id: "progress", label: t("vProgress") }, { id: "people", label: t("vPeople") }];
  const st = { tab: PM.currentTab(TABS), areas: null, release: "", person: "", q: "", open: new Set(), drawer: null };
  if ((PM.model.areas || []).length) st.areas = new Set(PM.model.areas.map((a) => a.id));
  const VIEWS = { sprint: V.sprintView, epics: V.epicsView, roadmap: V.roadmapView, progress: V.progressView, people: V.peopleView };

  function head(m) {
    const meta = m.meta;
    const sub = [meta.project && esc(meta.project), meta.today && `${t("today")}: ${PM.fmtDate(meta.today)}`,
      meta.sourceLink && `<a href="${esc(meta.sourceLink)}" target="_blank" rel="noopener">${t("source")}</a>`].filter(Boolean).join(" · ");
    const notes = (meta.notes || []).map((n) => `<p class="pm-sub">${esc(n)}</p>`).join("");
    return `<header class="pm-head"><div><h1>${esc(meta.title)}</h1><p class="pm-sub">${sub}</p>${notes}</div>` +
      `<div class="pm-actions" id="ab-actions">${PM.save.controls()}${PM.darkToggle()}</div></header>`;
  }

  function summary(m) {
    const p = AB.progress(m.items);
    const u = V.unit();
    const tiles = PM.tiles([
      { value: m.epics.length, label: t("epics") }, { value: m.items.length, label: t("items") },
      { value: `${num(p.est)} ${u}`, label: t("estimated") }, { value: `${Math.round(p.pct * 100)}%`, label: t("completed"), tone: "done" },
      { value: p.risk, label: t("atRisk"), tone: p.risk ? "risk" : "" }, { value: m.sprints.length, label: t("sprints") },
      { value: (m.people || []).length, label: t("people") },
      { value: m.items.filter((it) => !it.sprint).length, label: t("unplanned"), tone: m.items.some((it) => !it.sprint) ? "risk" : "" }]);
    const f = AB.findings(m);
    const findings = f.length ? `<details class="pm-findings" open><summary>${t("findings", { n: f.length })}</summary><ul>${f.map((x) =>
      `<li${x.item ? ` data-id="${esc(x.item)}" class="ab-link"` : x.person ? ` data-cell="${esc(x.person)}|${esc(x.sprint)}" class="ab-link"` : ""}>${esc(x.text)}</li>`).join("")}</ul></details>` : "";
    return tiles + findings;
  }

  function bar(m) {
    const chips = st.areas ? `<span class="ab-chips" role="group" aria-label="${t("areas")}">${m.areas.map((a, i) =>
      `<button class="pm-chip${st.areas.has(a.id) ? " on" : ""}" data-area="${esc(a.id)}" style="--c:var(--group-${(i % 5) + 1})" aria-pressed="${st.areas.has(a.id)}"><i></i>${esc(a.name)}</button>`).join("")}</span>` : "";
    const rel = (m.releases || []).length ? `<select id="ab-rel" aria-label="${t("release")}"><option value="">${t("allReleases")}</option>${m.releases.map((r) =>
      `<option value="${esc(r.id)}"${st.release === r.id ? " selected" : ""}>${esc(r.name)}</option>`).join("")}</select>` : "";
    const ppl = (m.people || []).length ? `<select id="ab-person" aria-label="${t("assignee")}"><option value="">${t("allPeople")}</option>${m.people.map((p) =>
      `<option value="${esc(p.id)}"${st.person === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("")}<option value="_none"${st.person === "_none" ? " selected" : ""}>${t("unassigned")}</option></select>` : "";
    return `<div class="pm-bar">${PM.tabsHtml(TABS, st.tab)}${chips}${rel}${ppl}<input type="search" id="ab-q" placeholder="${esc(t("search"))}" value="${esc(st.q)}" aria-label="${esc(t("search"))}"></div>`;
  }

  function legend(m) {
    const areas = (m.areas || []).map((a, i) => `<span><i style="--c:var(--group-${(i % 5) + 1})"></i>${esc(a.name)}</span>`).join("");
    const sts = ["todo", "active", "done", "risk", "blocked"].map((s) => V.status(s)).join("");
    return `<div class="pm-legend">${areas}${sts}</div>`;
  }

  function renderView() {
    const m = PM.model, ix = AB.index(m);
    st.editing = PM.save.isEditing();
    document.getElementById("ab-view").innerHTML = VIEWS[st.tab](m, ix, st);
  }
  function render() {
    const m = PM.model;
    PM.root.innerHTML = head(m) + summary(m) + bar(m) + `<main id="ab-view" class="ab-view${PM.save.isEditing() ? " editing" : ""}"></main>` + legend(m);
    renderView();
    if (st.drawer) st.drawer();
  }

  /* ---- drawer ---- */
  function field(label, value) { return `<dt>${esc(label)}</dt><dd>${value}</dd>`; }
  function select(name, options, current) {
    return `<select id="ab-f-${name}" data-edit="${name}" aria-label="${esc(name)}">${options.map(([v, l]) => `<option value="${esc(v)}"${(current ?? "") === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  }
  const idLinks = (ids) => ids.length ? ids.map((d) => `<a href="#" data-id="${esc(d)}">${esc(d)}</a>`).join(", ") : t("none");

  function showItem(id) {
    const m = PM.model, ix = AB.index(m), it = ix.items[id];
    if (!it) return;
    const ed = PM.save.isEditing(), e = ix.epics[it.epic];
    const opt = (arr, key) => [["", "—"]].concat((arr || []).map((x) => [x.id, x[key]]));
    const dependents = m.items.filter((x) => (x.deps || []).includes(id)).map((x) => x.id);
    const rows = [
      field(t("type"), esc(t("ty_" + (it.type || "story")))),
      field(t("epic"), `<a href="#" data-epic="${esc(it.epic)}">${esc(e ? e.title : it.epic)}</a>`),
      field(t("status"), ed ? select("status", ["todo", "active", "done", "risk", "blocked"].map((s) => [s, t("st_" + s)]), it.status || "todo") : V.status(it.status)),
      field(t("estimate"), ed ? `<input type="number" id="ab-f-estimate" min="0" step="0.5" data-edit="estimate" aria-label="${esc(t("estimate"))}" value="${it.estimate ?? ""}">` : `${it.estimate == null ? "?" : num(it.estimate)} ${V.unit()}`),
      field(t("sprint"), ed ? select("sprint", opt(m.sprints, "name"), it.sprint) : esc((ix.sprints[it.sprint] || {}).name || t("backlog"))),
      field(t("release"), ed ? select("release", opt(m.releases, "name"), it.release) : esc((ix.releases[it.release] || {}).name || "—")),
      field(t("assignee"), ed ? select("assignee", opt(m.people, "name"), it.assignee) : esc((ix.people[it.assignee] || {}).name || t("none"))),
      it.reqs ? field(t("reqs"), esc(it.reqs)) : "",
      field(t("deps"), idLinks(it.deps || [])), field(t("dependents"), idLinks(dependents)),
    ].join("");
    const el = PM.openDrawer(`<div class="pm-muted">${esc(it.id)}</div><h3>${esc(it.title)}</h3><dl>${rows}</dl>${it.desc ? `<div class="pm-desc">${esc(it.desc)}</div>` : ""}`);
    el.dataset.item = id;
    st.drawer = () => PM.drawerOpen() && showItem(id);
  }

  function showEpic(id) {
    const m = PM.model, ix = AB.index(m), e = ix.epics[id];
    if (!e) return;
    const its = m.items.filter((it) => it.epic === id), p = AB.progress(its);
    const rows = [field(t("area"), esc((ix.areas[e.area] || {}).name || "—")),
      field(t("release"), esc((e.releases || []).map((r) => (ix.releases[r] || {}).name || r).join(", ") || "—")),
      field(t("progress"), `${p.done}/${p.count} · ${num(p.estDone)}/${num(p.est)} ${V.unit()}`), e.reqs ? field(t("reqs"), esc(e.reqs)) : ""].join("");
    PM.openDrawer(`<div class="pm-muted">${t("epic")}</div><h3>${esc(e.title)}</h3><dl>${rows}</dl>${e.goal ? `<div class="pm-desc">${esc(e.goal)}</div>` : ""}` +
      `<div class="pm-scroll"><table class="pm-table">${V.itemHead()}${V.itemRows(its, ix)}</table></div>`);
    st.drawer = () => PM.drawerOpen() && showEpic(id);
  }

  function showCell(pid, sid) {
    const m = PM.model, ix = AB.index(m);
    const its = m.items.filter((it) => it.sprint === sid && (it.assignee || "") === pid);
    const who = pid ? ix.people[pid].name : t("unassigned");
    PM.openDrawer(`<div class="pm-muted">${t("vPeople")}</div><h3>${esc(t("cellTitle", { who, sprint: ix.sprints[sid].name }))}</h3>` +
      `<div class="pm-scroll"><table class="pm-table">${V.itemHead()}${V.itemRows(its, ix)}</table></div>`);
    st.drawer = () => PM.drawerOpen() && showCell(pid, sid);
  }

  /* ---- edits: always a new model ---- */
  function updateItem(id, patch) {
    const m = PM.model;
    PM.save.change({ ...m, items: m.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
    render();
  }

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.id === "ab-rel") { st.release = el.value; renderView(); return; }
    if (el.id === "ab-person") { st.person = el.value; renderView(); return; }
    const key = el.dataset && el.dataset.edit;
    const drawer = el.closest(".pm-drawer");
    if (!key || !drawer || !drawer.dataset.item) return;
    let value = el.value === "" ? null : el.value;
    if (key === "estimate" && value != null) { value = Number(value); if (!(value >= 0)) return; }
    updateItem(drawer.dataset.item, { [key]: value });
  });

  document.addEventListener("input", (ev) => {
    if (ev.target.id === "ab-q") { st.q = ev.target.value.trim().toLowerCase(); renderView(); }
  });

  document.addEventListener("click", (ev) => {
    const el = ev.target;
    const tab = el.closest("[data-tab]");
    if (tab) { st.tab = tab.dataset.tab; history.replaceState(null, "", "#" + st.tab); render(); return; }
    const area = el.closest("[data-area]");
    if (area) { const k = area.dataset.area; st.areas.has(k) ? st.areas.delete(k) : st.areas.add(k); render(); return; }
    const ep = el.closest("[data-epic]");
    if (ep) { ev.preventDefault(); showEpic(ep.dataset.epic); return; }
    const it = el.closest("[data-id]");
    if (it && !el.closest("select,input")) { ev.preventDefault(); showItem(it.dataset.id); return; }
    const cell = el.closest("[data-cell]");
    if (cell) { const [p, s] = cell.dataset.cell.split("|"); showCell(p, s); }
  });
  document.addEventListener("toggle", (ev) => {
    const box = ev.target.closest && ev.target.closest("[data-epic-box]");
    if (box) (box.open ? st.open.add(box.dataset.epicBox) : st.open.delete(box.dataset.epicBox));
  }, true);
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter") return;
    const el = ev.target.closest && ev.target.closest(".ab-card[data-id], [data-cell]");
    if (el) el.click();
  });
  window.addEventListener("hashchange", () => { const next = PM.currentTab(TABS); if (next !== st.tab) { st.tab = next; render(); } });

  /* drag a card to another sprint column or to the backlog (editing only) */
  document.addEventListener("dragstart", (ev) => {
    const c = ev.target.closest && ev.target.closest(".ab-card");
    if (c && PM.save.isEditing()) { ev.dataTransfer.setData("text/plain", c.dataset.id); ev.dataTransfer.effectAllowed = "move"; }
  });
  document.addEventListener("dragover", (ev) => {
    const col = PM.save.isEditing() && ev.target.closest && ev.target.closest("[data-drop]");
    if (col) { ev.preventDefault(); col.classList.add("over"); }
  });
  document.addEventListener("dragleave", (ev) => { const col = ev.target.closest && ev.target.closest("[data-drop]"); if (col) col.classList.remove("over"); });
  document.addEventListener("drop", (ev) => {
    const col = ev.target.closest && ev.target.closest("[data-drop]");
    if (!col || !PM.save.isEditing()) return;
    ev.preventDefault();
    const id = ev.dataTransfer.getData("text/plain");
    const target = col.dataset.drop || null;
    const cur = AB.index(PM.model).items[id];
    if (cur && (cur.sprint || null) !== target) updateItem(id, { sprint: target });
    else col.classList.remove("over");
  });

  PM.save.onChange(() => {
    const box = document.getElementById("ab-actions");
    if (box) box.innerHTML = PM.save.controls() + PM.darkToggle();
    const view = document.getElementById("ab-view");
    if (view && view.classList.contains("editing") !== PM.save.isEditing()) render();
  });

  render();
})();
