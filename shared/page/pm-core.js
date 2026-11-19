/* pm-core.js: the runtime every pm-artifacts page shares.
   Reads the model from #pm-model and exposes window.PM: translations (it/en), escaping, the
   light/dark toggle, hash-routed tabs, the details drawer and summary tiles. A type renderer
   builds its views on top of it and never touches the theme or the page shape. */
(function () {
  "use strict";
  const model = JSON.parse(document.getElementById("pm-model").textContent);
  const lang = (model.meta && model.meta.lang) === "en" ? "en" : "it";
  const DICT = {
    it: { dark: "Scuro", close: "Chiudi", search: "Cerca", all: "Tutti", none: "nessuno", edit: "Modifica",
      editing: "In modifica", save: "Salva", saving: "Salvataggio…", saved: "Salvato", unsaved: "Modifiche non salvate",
      readonly: "Sola lettura: non hai i permessi di modifica su questa pagina.", conflict: "Qualcun altro ha salvato prima: la pagina si aggiorna alla sua versione.",
      saveError: "Salvataggio non riuscito: {msg}", localOnly: "Anteprima locale: il salvataggio funziona solo sulla pagina pubblicata come artifact." },
    en: { dark: "Dark", close: "Close", search: "Search", all: "All", none: "none", edit: "Edit",
      editing: "Editing", save: "Save", saving: "Saving…", saved: "Saved", unsaved: "Unsaved changes",
      readonly: "Read only: you cannot edit this page.", conflict: "Someone else saved first: the page reloads to their version.",
      saveError: "Save failed: {msg}", localOnly: "Local preview: saving works only on the page published as an artifact." },
  };

  function t(key, vars) {
    const s = (DICT[lang] && DICT[lang][key]) || DICT.it[key] || key;
    return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "")) : s;
  }
  function i18n(extra) {
    for (const l of Object.keys(extra)) DICT[l] = Object.assign(DICT[l] || {}, extra[l]);
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => (n == null ? "—" : (Math.round(n * 10) / 10).toLocaleString(lang));
  const fmtDate = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return lang === "en" ? `${y}-${m}-${d}` : `${d}/${m}/${y}`;
  };

  /* light/dark: a two-state toggle over the system preference, remembered per viewer when storage works */
  const root = document.documentElement;
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
    return null;
  }
  const savedTheme = store("pm-theme");
  if (savedTheme === "dark" || savedTheme === "light") root.setAttribute("data-theme", savedTheme);
  const isDark = () => root.getAttribute("data-theme") === "dark" || (!root.hasAttribute("data-theme") && !!(mq && mq.matches));
  function darkToggle() {
    return `<button class="pm-btn${isDark() ? " on" : ""}" id="pm-dark" aria-pressed="${isDark()}">${t("dark")}</button>`;
  }
  function flipDark(btn) {
    const next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store("pm-theme", next);
    btn.classList.toggle("on", next === "dark");
    btn.setAttribute("aria-pressed", String(next === "dark"));
  }

  /* tabs routed on location.hash (#name only) */
  function currentTab(tabs) {
    const h = location.hash.replace(/^#/, "");
    return tabs.some((x) => x.id === h) ? h : tabs[0].id;
  }
  function tabsHtml(tabs, active) {
    return `<nav class="pm-tabs" aria-label="views">${tabs.map((x) =>
      `<button class="pm-btn${x.id === active ? " on" : ""}" data-tab="${esc(x.id)}">${esc(x.label)}</button>`).join("")}</nav>`;
  }

  /* drawer */
  let drawer;
  function openDrawer(html) {
    if (!drawer) {
      drawer = document.createElement("aside");
      drawer.className = "pm-drawer";
      drawer.setAttribute("aria-live", "polite");
      document.body.appendChild(drawer);
    }
    drawer.innerHTML = `<button class="pm-x" data-close aria-label="${esc(t("close"))}">×</button>${html}`;
    drawer.classList.add("on");
    return drawer;
  }
  function closeDrawer() { if (drawer) drawer.classList.remove("on"); }
  const drawerOpen = () => !!(drawer && drawer.classList.contains("on"));

  function tiles(list) {
    return `<div class="pm-tiles">${list.map((x) =>
      `<div class="pm-tile ${x.tone || ""}"><b>${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join("")}</div>`;
  }

  document.addEventListener("click", (ev) => {
    const el = ev.target;
    if (el.closest("[data-close]")) { closeDrawer(); return; }
    const dark = el.closest("#pm-dark");
    if (dark) flipDark(dark);
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeDrawer(); });

  window.PM = { model, lang, t, i18n, esc, num, fmtDate, store, darkToggle, currentTab, tabsHtml,
    openDrawer, closeDrawer, drawerOpen, tiles, root: document.getElementById("pm-root") };
})();
