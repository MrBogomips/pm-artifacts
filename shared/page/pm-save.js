/* pm-save.js: editing and saving through the Artifact `artifact` capability.
   The page is the record: the model lives in #pm-model. An edit replaces PM.model with a new object
   (PM.change) and marks the page dirty; Save regenerates the whole document from the model plus the
   page's own inline style and script, and publishes it as the artifact's new version. Every open
   view reloads to it. The live DOM is never serialized.
   Without the capability (local file, a viewer who cannot edit) the page stays read-only. */
(function () {
  "use strict";
  const PM = window.PM;
  const S = { capability: null, editing: false, dirty: false, busy: false, message: "", tone: "", listeners: [] };

  /* Same escaping as shared/scripts/artifact_page.py json_for_script. */
  function jsonForScript(model) {
    return JSON.stringify(model, null, 1)
      .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  }

  /* The document in the exact shape the Artifact tool publishes, so a later publish from the tool
     replaces the skeleton instead of nesting it. The reset is the skeleton's own, read from <head>. */
  function documentHtml(model) {
    const reset = (document.head.querySelector("style") || {}).textContent || "";
    const style = document.getElementById("pm-style").textContent;
    const app = document.getElementById("pm-app").textContent;
    const title = PM.esc((model.meta && model.meta.title) || document.title);
    const content = `<title>${title}</title><meta name="claude:viewport-fit-sides" content="cover">\n` +
      `<style id="pm-style">${style}</style>\n<div id="pm-root"></div>\n` +
      `<script type="application/json" id="pm-model">${jsonForScript(model)}</` + `script>\n` +
      `<script id="pm-app">${app}</` + `script>\n`;
    return "<!doctype html><html><head><meta charset=utf8>" +
      '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">' +
      `<style>${reset}</style></head><body>${content}</body></html>`;
  }

  function notify() { S.listeners.forEach((fn) => fn()); }
  function setMessage(message, tone) { S.message = message; S.tone = tone || ""; notify(); }

  /* Replace the model with a new one (the caller builds it immutably) and mark the page dirty. */
  function change(nextModel) {
    if (!S.editing) return;
    PM.model = nextModel;
    S.dirty = true;
    setMessage(PM.t("unsaved"), "dirty");
  }

  async function save() {
    if (!S.capability || !S.dirty || S.busy) return;
    S.busy = true;
    setMessage(PM.t("saving"), "");
    try {
      await S.capability.publish(documentHtml(PM.model));
      S.dirty = false;
      setMessage(PM.t("saved"), "");
    } catch (err) {
      const code = err && err.code;
      if (code === "conflict") setMessage(PM.t("conflict"), "error");
      else if (code === "not_granted" || code === "not_writer") { S.editing = false; S.capability = null; setMessage(PM.t("readonly"), "error"); }
      else setMessage(PM.t("saveError", { msg: (err && (err.message || code)) || "?" }), "error");
    } finally {
      S.busy = false;
      notify();
    }
  }

  function toggleEditing() {
    if (!S.capability) { setMessage(PM.t("localOnly"), "error"); return; }
    S.editing = !S.editing;
    notify();
  }

  /* Toolbar fragment: Edit / Save buttons and the state line. */
  function controls() {
    const edit = `<button class="pm-btn${S.editing ? " on" : ""}" id="pm-edit" aria-pressed="${S.editing}">${PM.t(S.editing ? "editing" : "edit")}</button>`;
    const save = S.editing ? `<button class="pm-btn primary" id="pm-save" ${S.dirty && !S.busy ? "" : "disabled"}>${PM.t("save")}</button>` : "";
    const state = S.message ? `<span class="pm-state ${S.tone}" role="status">${PM.esc(S.message)}</span>` : "";
    return edit + save + state;
  }

  document.addEventListener("click", (ev) => {
    if (ev.target.closest("#pm-edit")) toggleEditing();
    else if (ev.target.closest("#pm-save")) save();
  });

  /* The capability resolves after the first render, or never (null after the viewer's timeout). */
  const claude = window.claude;
  if (claude && typeof claude.use === "function") {
    claude.use("artifact").then((cap) => { S.capability = cap; notify(); }, () => {});
  }

  PM.save = {
    controls, change, save,
    isEditing: () => S.editing,
    isDirty: () => S.dirty,
    onChange: (fn) => S.listeners.push(fn),
    documentHtml,
  };
})();
