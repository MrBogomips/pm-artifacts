/* agile-board-panel.js: the estimation assumptions (one slider per rule) and the release verdicts.
   The sliders are what-if controls for every viewer; while editing, a change is written into the
   model's rule and saved with the page. */
(function () {
  "use strict";
  const PM = window.PM, AB = window.AB, esc = PM.esc, t = PM.t, num = PM.num;

  function bounds(r) {
    const v = r.value || 1;
    const step = r.step != null ? r.step : (v >= 2 ? 0.5 : 0.05);
    return { min: r.min != null ? r.min : Math.max(step, Math.round(v / 3 / step) * step), max: r.max != null ? r.max : v * 3, step };
  }

  /* m: the raw model; ov: current overrides; editing: whether changes go into the model. */
  function estimationPanel(m, ov, editing) {
    const rs = (m.estimation && m.estimation.rules) || [];
    const auto = m.meta.planning === "auto";
    if (!rs.length && !auto) return "";
    const unit = t("u_" + (m.meta.unit || "gg"));
    const rows = rs.map((r) => {
      const b = bounds(r), v = ov[r.id] != null ? ov[r.id] : r.value;
      const per = r.per === "size" ? t("perSize", { what: r.sizeLabel || t("sizeDefault") }) : t("perItem");
      const changed = ov[r.id] != null && ov[r.id] !== r.value;
      return `<label class="ab-rule" for="ab-r-${esc(r.id)}"><span class="ab-rule-l">${esc(r.label)}</span>` +
        `<input type="range" id="ab-r-${esc(r.id)}" data-rule="${esc(r.id)}" min="${b.min}" max="${b.max}" step="${b.step}" value="${v}">` +
        `<b id="ab-rv-${esc(r.id)}">${num(v)} ${unit}</b><span class="pm-muted">${esc(per)}${changed ? ` · ${t("modelValue", { v: num(r.value) })}` : ""}</span></label>`;
    }).join("");
    const actions = [
      Object.keys(ov).length && !editing ? `<button class="pm-btn" id="ab-reset">${t("resetRules")}</button>` : "",
      auto && editing ? `<button class="pm-btn" id="ab-freeze" title="${esc(t("freezeHint"))}">${t("freeze")}</button>` : "",
    ].join("");
    return `<section class="pm-panel ab-est" aria-label="${esc(t("estTitle"))}"><h2>${t("estTitle")}</h2>` +
      `${rows ? `<div class="ab-rules">${rows}</div>` : ""}` +
      `<p class="pm-muted">${auto ? t("autoNote") : t("manualNote")}${editing || !rs.length ? "" : " " + t("whatIfNote")}</p>` +
      `${actions ? `<div class="pm-actions">${actions}</div>` : ""}</section>`;
  }

  /* One pill per release: fits or not, and why, on the effective model. */
  function releaseStrip(em) {
    const rels = em.releases || [];
    if (!rels.length) return "";
    return `<div class="ab-verdicts">${rels.map((r) => {
      const f = AB.releaseFit(em, r);
      const why = [];
      if (f.late.length) why.push(t("vLate", { n: f.late.length }));
      if (f.unplanned.length) why.push(t("vOut", { n: f.unplanned.length }));
      if (f.cap != null && f.p.est > f.cap) why.push(t("vCap", { est: num(f.p.est), cap: num(f.cap) }));
      return `<div class="ab-verdict ${f.fits ? "ok" : "ko"}"><b>${esc(r.name)}${r.date ? " · " + PM.fmtDate(r.date) : ""}</b>` +
        `<span>${f.fits ? t("fits") : t("notFits")}</span>${why.length ? `<span class="pm-muted">${esc(why.join(" · "))}</span>` : ""}</div>`;
    }).join("")}</div>`;
  }

  window.ABP = { estimationPanel, releaseStrip, bounds };
})();
