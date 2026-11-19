/* agile-board.js: boot of the agile board. Builds the page head, the estimation panel, the summary
   (tiles, release verdicts, findings) and the toolbar, routes the five views, opens the details
   drawer and, while editing, applies changes to the model: drag a card to another sprint or to the
   backlog; change sprint, assignee, status, release, estimate, size, rule or pinning in the drawer;
   move a slider; freeze an automatic plan. Views draw the effective model (estimates used and planned
   sprints, agile-board-plan.js); edits always build a new raw model and go through PM.save.change. */
(function () {
  "use strict";
  const PM = window.PM, AB = window.AB, V = window.ABV, P = window.ABP, esc = PM.esc, t = PM.t, num = PM.num;

  const TABS = [{ id: "sprint", label: t("vSprint") }, { id: "epics", label: t("vEpics") }, { id: "roadmap", label: t("vRoadmap") },
    { id: "progress", label: t("vProgress") }, { id: "people", label: t("vPeople") }];
  const st = { tab: PM.currentTab(TABS), areas: null, release: "", person: "", q: "", open: new Set(), drawer: null, ov: {} };
  if ((PM.model.areas || []).length) st.areas = new Set(PM.model.areas.map((a) => a.id));
  const VIEWS = { sprint: V.sprintView, epics: V.epicsView, roadmap: V.roadmapView, progress: V.progressView, people: V.peopleView };
  const isAuto = () => PM.model.meta.planning === "auto";
  const eff = () => AB.effective(PM.model, st.ov);

  function head(m) {
    const meta = m.meta;
    const sub = [meta.project && esc(meta.project), meta.today && `${t("today")}: ${PM.fmtDate(meta.today)}`,
      /^https?:\/\//i.test(meta.sourceLink || "") && `<a href="${esc(meta.sourceLink)}" target="_blank" rel="noopener">${t("source")}</a>`].filter(Boolean).join(" · ");
    const notes = (Array.isArray(meta.notes) ? meta.notes : []).map((n) => `<p class="pm-sub">${esc(n)}</p>`).join("");
    return `<header class="pm-head"><div><h1>${esc(meta.title)}</h1><p class="pm-sub">${sub}</p>${notes}</div>` +
      `<div class="pm-actions" id="ab-actions">${PM.save.controls()}${PM.darkToggle()}</div></header>`;
  }

  function summary(m) {
    const p = AB.progress(m.items);
    const u = V.unit();
    const out = m.items.filter((it) => !it.sprint).length;
    const tiles = PM.tiles([
      { value: m.epics.length, label: t("epics") }, { value: m.items.length, label: t("items") },
      { value: `${num(p.est)} ${u}`, label: t("estimated") }, { value: `${Math.round(p.pct * 100)}%`, label: t("completed"), tone: "done" },
      { value: p.risk, label: t("atRisk"), tone: p.risk ? "risk" : "" }, { value: m.sprints.length, label: t("sprints") },
      { value: (m.people || []).length, label: t("people") }, { value: out, label: t("unplanned"), tone: out ? "risk" : "" }]);
    const f = AB.findings(m);
    const li = (x) => `<li${x.item ? ` data-id="${esc(x.item)}" class="ab-link"` : x.person ? ` data-cell="${esc(x.person)}|${esc(x.sprint)}" class="ab-link"` : ""}>${esc(x.text)}</li>`;
    const groups = ["over", "dep", "slip", "est"].map((k) => [k, f.filter((x) => x.kind === k)]).filter(([, xs]) => xs.length);
    const findings = f.length ? `<details class="pm-findings" open><summary>${t("findings", { n: f.length })}</summary>${groups.map(([k, xs]) =>
      `<details class="ab-fgroup"${xs.length <= 4 ? " open" : ""}><summary>${t("k_" + k)} (${xs.length})</summary><ul>${xs.map(li).join("")}</ul></details>`).join("")}</details>` : "";
    return tiles + P.releaseStrip(m) + findings;
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

  function renderView(em) {
    const m = em || eff();
    st.editing = PM.save.isEditing();
    st.auto = isAuto();
    document.getElementById("ab-view").innerHTML = VIEWS[st.tab](m, AB.index(m), st);
  }
  /* What depends on estimates and plan; the sliders themselves are left in place while dragged. */
  function renderLive() {
    const m = eff();
    document.getElementById("ab-live").innerHTML = summary(m);
    renderView(m);
    if (st.drawer) st.drawer();
  }
  function render() {
    const m = eff();
    PM.root.innerHTML = head(m) + P.estimationPanel(PM.model, st.ov, PM.save.isEditing()) + `<div id="ab-live">${summary(m)}</div>` + bar(m) +
      `<main id="ab-view" class="ab-view${PM.save.isEditing() ? " editing" : ""}"></main>` + legend(m);
    renderView(m);
    if (st.drawer) st.drawer();
  }

  /* ---- drawer ---- */
  function field(label, value) { return `<dt>${esc(label)}</dt><dd>${value}</dd>`; }
  function select(name, options, current) {
    return `<select id="ab-f-${name}" data-edit="${name}" aria-label="${esc(name)}">${options.map(([v, l]) => `<option value="${esc(v)}"${(current ?? "") === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  }
  const numInput = (name, value, label) => `<input type="number" id="ab-f-${name}" min="0" step="0.5" data-edit="${name}" aria-label="${esc(label)}" value="${value ?? ""}">`;
  const idLinks = (ids) => ids.length ? ids.map((d) => `<a href="#" data-id="${esc(d)}">${esc(d)}</a>`).join(", ") : t("none");

  function estimateText(it) {
    const e = it._est || {};
    const val = it.estimate == null ? "?" : `${num(it.estimate)} ${V.unit()}`;
    if (e.source === "explicit") return `${val} · ${t("estExplicit")}`;
    if (e.source === "rule") return `${val} · ${esc(e.size != null ? t("estRuleSize", { rule: e.rule.label, size: num(e.size), v: num(e.rule.value) }) : t("estRule", { rule: e.rule.label }))}`;
    return t("estNone");
  }

  function showItem(id) {
    const raw = PM.model, em = eff(), ix = AB.index(em), it = ix.items[id], src = raw.items.find((x) => x.id === id);
    if (!it || !src) return;
    const ed = PM.save.isEditing(), e = ix.epics[it.epic], auto = isAuto();
    const opt = (arr, key) => [["", "—"]].concat((arr || []).map((x) => [x.id, x[key]]));
    const rules = (raw.estimation && raw.estimation.rules) || [];
    const dependents = raw.items.filter((x) => (x.deps || []).includes(id)).map((x) => x.id);
    const sprintName = it.sprint ? (ix.sprints[it.sprint] || {}).name : (it._beyond ? t("beyond") : t("backlog"));
    const rows = [
      field(t("type"), esc(t("ty_" + (it.type || "story")))),
      field(t("epic"), `<a href="#" data-epic="${esc(it.epic)}">${esc(e ? e.title : it.epic)}</a>`),
      field(t("status"), ed ? select("status", ["todo", "active", "done", "risk", "blocked"].map((s) => [s, t("st_" + s)]), src.status || "todo") : V.status(it.status)),
      field(t("estUsed"), estimateText(it)),
      ed ? field(t("estimate"), numInput("estimate", src.estimate, t("estimate"))) : "",
      rules.length ? field(t("size"), ed ? numInput("size", src.size, t("size")) : esc(src.size == null ? "—" : num(src.size))) : "",
      rules.length && ed ? field(t("kind"), select("kind", [["", "—"]].concat(rules.map((r) => [r.id, r.label])), src.kind)) : "",
      field(t("sprint"), ed ? select("sprint", opt(raw.sprints, "name"), src.sprint) : esc(sprintName)),
      auto ? field(t("planning"), ed ? select("pinned", [["", t("plAuto")], ["true", t("plPinned")]], src.pinned ? "true" : "") : esc(src.pinned ? t("plPinned") : t("plAuto"))) : "",
      field(t("release"), ed ? select("release", opt(raw.releases, "name"), src.release) : esc((ix.releases[it.release] || {}).name || "—")),
      field(t("assignee"), ed ? select("assignee", opt(raw.people, "name"), src.assignee) : esc((ix.people[it.assignee] || {}).name || t("none"))),
      it.reqs ? field(t("reqs"), esc(it.reqs)) : "",
      field(t("deps"), idLinks(it.deps || [])), field(t("dependents"), idLinks(dependents)),
    ].join("");
    const el = PM.openDrawer(`<div class="pm-muted">${esc(it.id)}</div><h3>${esc(it.title)}</h3><dl>${rows}</dl>${it.desc ? `<div class="pm-desc">${esc(it.desc)}</div>` : ""}`);
    el.dataset.item = id;
    st.drawer = () => PM.drawerOpen() && showItem(id);
  }

  function itemsTable(its, ix) { return `<div class="pm-scroll"><table class="pm-table">${V.itemHead()}${V.itemRows(its, ix)}</table></div>`; }

  function showEpic(id) {
    const m = eff(), ix = AB.index(m), e = ix.epics[id];
    if (!e) return;
    const its = m.items.filter((it) => it.epic === id), p = AB.progress(its);
    const rows = [field(t("area"), esc((ix.areas[e.area] || {}).name || "—")),
      field(t("release"), esc((e.releases || []).map((r) => (ix.releases[r] || {}).name || r).join(", ") || "—")),
      field(t("progress"), `${p.done}/${p.count} · ${num(p.estDone)}/${num(p.est)} ${V.unit()}`), e.reqs ? field(t("reqs"), esc(e.reqs)) : ""].join("");
    PM.openDrawer(`<div class="pm-muted">${t("epic")}</div><h3>${esc(e.title)}</h3><dl>${rows}</dl>${e.goal ? `<div class="pm-desc">${esc(e.goal)}</div>` : ""}${itemsTable(its, ix)}`);
    st.drawer = () => PM.drawerOpen() && showEpic(id);
  }

  function showCell(pid, sid) {
    const m = eff(), ix = AB.index(m);
    const its = m.items.filter((it) => it.sprint === sid && (it.assignee || "") === pid);
    const who = pid ? ix.people[pid].name : t("unassigned");
    PM.openDrawer(`<div class="pm-muted">${t("vPeople")}</div><h3>${esc(t("cellTitle", { who, sprint: ix.sprints[sid].name }))}</h3>${itemsTable(its, ix)}`);
    st.drawer = () => PM.drawerOpen() && showCell(pid, sid);
  }

  /* ---- edits: always a new model ---- */
  function updateItem(id, patch) {
    const m = PM.model;
    const extra = isAuto() && "sprint" in patch ? { pinned: patch.sprint != null } : {};   /* placing an item by hand pins it */
    PM.save.change({ ...m, items: m.items.map((it) => (it.id === id ? { ...it, ...patch, ...extra } : it)) });
    render();
  }

  function setRule(ruleId, value) {
    if (PM.save.isEditing()) {
      const m = PM.model;
      const rules = m.estimation.rules.map((r) => (r.id === ruleId ? { ...r, value } : r));
      PM.save.change({ ...m, estimation: { ...m.estimation, rules } });
      delete st.ov[ruleId];
    } else {
      st.ov = { ...st.ov, [ruleId]: value };
    }
    const out = document.getElementById("ab-rv-" + ruleId);
    if (out) out.textContent = `${num(value)} ${V.unit()}`;
    renderLive();
  }

  function freezePlan() {
    const em = eff(), planned = Object.fromEntries(em.items.map((it) => [it.id, it.sprint || null]));
    const m = PM.model;
    PM.save.change({ ...m, meta: { ...m.meta, planning: "manual" },
      items: m.items.map((it) => { const { pinned, ...rest } = it; return { ...rest, sprint: planned[it.id] }; }) });
    render();
  }

  function editValue(el, key) {
    let value = el.value === "" ? null : el.value;
    if (key === "pinned") return value === "true";
    if (key === "estimate" || key === "size") {
      if (value == null && el.validity && el.validity.badInput) return undefined;   /* unparsable entry: keep the value */
      if (value != null) { value = Number(value); if (!(value >= 0)) return undefined; }
    }
    return value;
  }

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.id === "ab-rel") { st.release = el.value; renderView(); return; }
    if (el.id === "ab-person") { st.person = el.value; renderView(); return; }
    if (el.dataset && el.dataset.rule) { setRule(el.dataset.rule, Number(el.value)); if (PM.save.isEditing()) render(); return; }
    const key = el.dataset && el.dataset.edit;
    const drawer = el.closest(".pm-drawer");
    if (!key || !drawer || !drawer.dataset.item) return;
    const value = editValue(el, key);
    if (value === undefined) return;
    if (key === "pinned") {
      const em = eff(), cur = em.items.find((x) => x.id === drawer.dataset.item);
      const m = PM.model;   /* pinning keeps the sprint the plan gives it now */
      PM.save.change({ ...m, items: m.items.map((it) => (it.id === drawer.dataset.item ? { ...it, pinned: value, sprint: value ? (cur.sprint || null) : it.sprint } : it)) });
      render();
      return;
    }
    updateItem(drawer.dataset.item, { [key]: value });
  });

  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.id === "ab-q") { st.q = el.value.trim().toLowerCase(); renderView(); return; }
    if (el.dataset && el.dataset.rule && !PM.save.isEditing()) setRule(el.dataset.rule, Number(el.value));   /* live what-if */
  });

  document.addEventListener("click", (ev) => {
    const el = ev.target;
    if (el.closest("#ab-reset")) { st.ov = {}; render(); return; }
    if (el.closest("#ab-freeze")) { freezePlan(); return; }
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
    const cur = AB.index(eff()).items[id];
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
