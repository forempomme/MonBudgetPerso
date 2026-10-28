// ─────────────────────────────────────────────────────────────────
//  v1.79.0 — Récap fiscal (Rapport › Année) + réglages
//  Estimation seulement ; règles par année dans taxRules.js, toutes
//  modifiables par l'utilisateur (taxSettings.overrides[année]).
// ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import { fmt, fmtInt } from "../utils.js";
import { Modal } from "../components/index.jsx";
import { computeTaxRecap, rulesFor, TAX_RULES, EDITABLE } from "../taxRules.js";

const LBL = { fontSize: ".54rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "10px 2px 5px" };
const BOX = { fontFamily: "monospace", fontSize: ".56rem", fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: "var(--surface3)", color: "var(--text)" };

export function TaxRecapCard({ data, year, onOpenSettings }) {
  const r = computeTaxRecap(data, year);
  return (
    <div data-testid="tax-card" style={{ borderRadius: 14, padding: "10px 12px", marginBottom: 8, border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)", background: "color-mix(in srgb, var(--accent) 6%, var(--surface))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>🧾</span><b style={{ flex: 1, fontSize: ".82rem" }}>Récap fiscal {year}</b>
        <span style={{ fontSize: ".56rem", color: "var(--text2)" }}>déclaration printemps {year + 1}</span>
      </div>
      {!r.known && (
        <div data-testid="tax-estimated" style={{ fontSize: ".58rem", lineHeight: 1.4, padding: "6px 8px", borderRadius: 9, marginTop: 7, color: "var(--text)", background: "color-mix(in srgb, var(--warning) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)" }}>
          ⚠️ Taux {year} pas encore intégrés : estimation basée sur {r.baseYear}. Tu peux les corriger dans les réglages.
        </div>
      )}
      {!r.configured ? (
        <div style={{ fontSize: ".66rem", color: "var(--text2)", margin: "8px 0 2px", lineHeight: 1.5 }}>
          Indique les catégories concernées (crèche, assistante maternelle, dons, ménage…) pour estimer tes crédits et réductions d'impôt.
        </div>
      ) : (<>
        {r.items.map(x => (
          <div key={x.id} data-tax={x.id} style={{ marginTop: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".7rem" }}>
              <span>{x.icon}</span><span style={{ flex: 1, minWidth: 0 }}>{x.label}</span><span style={BOX}>{x.box}</span>
              <b style={{ fontVariantNumeric: "tabular-nums", minWidth: 62, textAlign: "right" }}>{fmtInt(x.base)}</b>
            </div>
            <div style={{ fontSize: ".58rem", color: "var(--text2)", margin: "2px 0 0 22px", lineHeight: 1.45 }}>
              {fmtInt(x.spent)} {x.id === "garde" ? "payés" : "versés"}{x.aids ? ` − ${fmtInt(x.aids)} d'aides` : ""}
              {x.cap != null ? ` · plafond ${fmtInt(x.cap)}` : ""} · {Math.round(x.rate * 100)} % →{" "}
              <b style={{ color: "var(--success)" }}>{x.kind} estimé{x.kind === "réduction" ? "e" : ""} {fmtInt(x.benefit)}</b>
              {x.note && <><br />{x.note}</>}
            </div>
            {x.cap != null && x.cap > 0 && (
              <div style={{ height: 6, borderRadius: 3, background: "var(--surface3)", overflow: "hidden", marginTop: 4 }}>
                <div data-pv="" style={{ width: `${Math.min(100, x.base / x.cap * 100)}%`, height: "100%", background: "var(--success)", borderRadius: 3 }} />
              </div>
            )}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-soft)", fontSize: ".72rem" }}>
          <span style={{ flex: 1 }}>Total estimé</span><b data-testid="tax-total" style={{ color: "var(--success)", fontSize: ".9rem", fontVariantNumeric: "tabular-nums" }}>{fmtInt(r.total)}</b>
        </div>
      </>)}
      <div style={{ fontSize: ".56rem", color: "var(--text3)", marginTop: 6, lineHeight: 1.4 }}>
        ⚠️ Estimation, pas un conseil fiscal. Vérifie sur impots.gouv.fr.{r.modified ? " Taux modifiés par toi." : ""}
      </div>
      <button data-testid="tax-settings-open" className="btn btn-outline" onClick={onOpenSettings} style={{ width: "100%", marginTop: 8, fontSize: ".7rem" }}>⚙️ Régler le récap fiscal</button>
    </div>
  );
}

export function TaxSettingsModal({ data, year, onSave, onClose }) {
  const S0 = data.taxSettings || {};
  const [S, setS] = useState(() => JSON.parse(JSON.stringify(S0)));
  const [showRates, setShowRates] = useState(false);
  const cats = (data.categories || []).filter(c => c.type === "expense" && !c.archived)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" }));
  const parentName = c => c.parentId ? (data.categories || []).find(p => p.id === c.parentId)?.name : null;
  const set = (k, patch) => setS(s => ({ ...s, [k]: { ...(s[k] || {}), ...patch } }));
  const toggleCat = (k, id) => { const cur = S[k]?.catIds || []; set(k, { catIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] }); };
  const chips = k => (
    <div data-testid={`tax-cats-${k}`} style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 132, overflowY: "auto" }}>
      {cats.map(c => {
        const on = (S[k]?.catIds || []).includes(c.id);
        return (
          <span key={c.id} role="button" data-cat={c.id} onClick={() => toggleCat(k, c.id)}
            style={{ fontSize: ".62rem", fontWeight: 700, padding: "5px 8px", borderRadius: 11, cursor: "pointer", touchAction: "manipulation",
              color: on ? "var(--accent)" : "var(--text2)", background: on ? "color-mix(in srgb, var(--accent) 13%, transparent)" : "var(--surface2)",
              border: `1px solid ${on ? "var(--accent)" : "var(--border)"}` }}>{c.icon} {parentName(c) ? `${parentName(c)} › ` : ""}{c.name}</span>
        );
      })}
    </div>
  );
  const nums = (vals, cur, onPick, testid) => (
    <div data-testid={testid} style={{ display: "flex", gap: 5 }}>
      {vals.map(n => <span key={n} role="button" data-v={n} onClick={() => onPick(n)}
        style={{ minWidth: 36, textAlign: "center", fontSize: ".7rem", fontWeight: 800, padding: "6px 0", borderRadius: 10, cursor: "pointer",
          color: cur === n ? "var(--accent)" : "var(--text2)", background: cur === n ? "color-mix(in srgb, var(--accent) 13%, transparent)" : "var(--surface2)",
          border: `1px solid ${cur === n ? "var(--accent)" : "var(--border)"}` }}>{n}</span>)}
    </div>
  );
  const money = (val, onChange, testid, ph) => (
    <input data-testid={testid} type="text" inputMode="decimal" placeholder={ph} value={val ?? ""} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", boxSizing: "border-box", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 11, padding: "8px 10px", color: "var(--text)", fontSize: ".78rem", fontFamily: "inherit" }} />
  );
  const card = (title, sub, children) => (
    <div style={{ borderRadius: 14, padding: "10px 11px", marginBottom: 8, border: "1px solid var(--border)", background: "var(--surface)" }}>
      <b style={{ fontSize: ".74rem" }}>{title}</b>
      <div style={{ fontSize: ".58rem", color: "var(--text2)", lineHeight: 1.45, marginTop: 2 }}>{sub}</div>
      {children}
    </div>
  );
  const { rules, baseYear, known } = rulesFor(year, S.overrides);
  const builtIn = TAX_RULES[baseYear];
  const ovY = S.overrides?.[year] || {};
  const setRate = (key, raw, unit) => {
    const v = parseFloat(String(raw).replace(",", "."));
    setS(s => {
      const o = { ...(s.overrides || {}) }; const y = { ...(o[year] || {}) };
      if (raw === "" || isNaN(v)) delete y[key]; else y[key] = unit === "%" ? v / 100 : v;
      o[year] = y; return { ...s, overrides: o };
    });
  };
  const resetRates = () => setS(s => { const o = { ...(s.overrides || {}) }; delete o[year]; return { ...s, overrides: o }; });
  const num = v => (parseFloat(String(v ?? "").replace(",", ".")) || 0);
  function save() {
    const out = { ...S };
    if (out.aids) out.aids = Object.fromEntries(Object.entries(out.aids).map(([y, v]) => [y, num(v)]).filter(([, v]) => v > 0));
    if (out.income) out.income = Object.fromEntries(Object.entries(out.income).map(([y, v]) => [y, num(v)]).filter(([, v]) => v > 0));
    onSave(out);
  }
  return (
    <Modal onClose={onClose} title="">
      <div data-testid="tax-settings">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: "1.1rem" }}>🧾</span><b style={{ flex: 1, fontSize: "1rem" }}>Récap fiscal · réglages</b>
          <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>✕</button>
        </div>
        {card("👶 Garde d'enfant hors domicile", "Crèche, assistante maternelle, garderie · enfant de moins de 6 ans au 1ᵉʳ janvier de l'année", <>
          <div style={LBL}>Catégories</div>{chips("garde")}
          <div style={LBL}>Enfants concernés</div>{nums([1, 2, 3, 4], parseInt(S.garde?.kids, 10) || 1, n => set("garde", { kids: n }), "tax-kids")}
          <div style={LBL}>Aides reçues en {year} à déduire (CMG CAF, employeur)</div>
          {money(S.aids?.[year], v => setS(s => ({ ...s, aids: { ...(s.aids || {}), [year]: v } })), "tax-aids", "0 €")}
        </>)}
        {card("🤝 Dons · aide aux personnes en difficulté", "Restos du cœur, Secours populaire… · au-delà du plafond, le reste passe à 66 %", <>
          <div style={LBL}>Catégories</div>{chips("dons75")}
        </>)}
        {card("💝 Autres dons d'intérêt général", "Associations, fondations… · dans la limite d'une part du revenu imposable", <>
          <div style={LBL}>Catégories</div>{chips("dons66")}
          <div style={LBL}>Revenu imposable {year} (facultatif, pour vérifier la limite)</div>
          {money(S.income?.[year], v => setS(s => ({ ...s, income: { ...(s.income || {}), [year]: v } })), "tax-income", "ex. 32 000 €")}
        </>)}
        {card("🏠 Emploi à domicile", "Ménage, jardinage, soutien scolaire…", <>
          <div style={LBL}>Catégories</div>{chips("dom")}
          <div style={LBL}>Enfants à charge (majoration du plafond)</div>{nums([0, 1, 2, 3], parseInt(S.dom?.kids, 10) || 0, n => set("dom", { kids: n }), "tax-dom-kids")}
        </>)}
        {/* Taux et plafonds — toujours modifiables */}
        <div role="button" data-testid="tax-rates-toggle" onClick={() => setShowRates(v => !v)}
          style={{ ...LBL, color: "var(--accent)", cursor: "pointer", margin: "12px 2px 6px" }}>{showRates ? "▾" : "▸"} Taux et plafonds {year}{known ? "" : ` (basés sur ${baseYear})`}</div>
        {showRates && (
          <div data-testid="tax-rates" style={{ borderRadius: 14, padding: "8px 10px", border: "1px solid var(--border)", background: "var(--surface)", marginBottom: 8 }}>
            {EDITABLE.map(([d, f, label, unit]) => {
              const key = `${d}.${f}`, def = builtIn?.[d]?.[f], cur = rules[d][f], changed = key in ovY;
              const shown = unit === "%" ? Math.round(cur * 1000) / 10 : cur;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: "1px solid var(--border-soft)", fontSize: ".64rem" }}>
                  <span style={{ flex: 1, color: changed ? "var(--accent)" : "var(--text2)" }}>{label}{changed ? " ✎" : ""}</span>
                  <input data-rate={key} type="text" inputMode="decimal" defaultValue={shown} key={`${key}-${changed}-${cur}`}
                    onBlur={e => { const v = e.target.value.trim(); const n = parseFloat(v.replace(",", ".")); const back = unit === "%" ? Math.round(def * 1000) / 10 : def; setRate(key, v === "" || n === back ? "" : v, unit); }}
                    style={{ width: 70, textAlign: "right", background: "var(--surface2)", border: `1px solid ${changed ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, padding: "5px 7px", color: "var(--text)", fontSize: ".7rem", fontFamily: "inherit" }} />
                  <span style={{ width: 12, color: "var(--text3)" }}>{unit}</span>
                </div>
              );
            })}
            <div style={{ fontSize: ".56rem", color: "var(--text3)", marginTop: 6, lineHeight: 1.45 }}>
              Valeurs de l'appli pour {baseYear}. Modifie-les si la loi change ; une valeur effacée revient à celle de l'appli.
              {rules.dons75.capBefore ? ` En ${year}, les dons « aide aux personnes » versés jusqu'au ${rules.dons75.capBefore.until.slice(8)}/${rules.dons75.capBefore.until.slice(5, 7)} restent plafonnés à ${fmt(rules.dons75.capBefore.cap)}.` : ""}
            </div>
            {Object.keys(ovY).length > 0 && <button data-testid="tax-rates-reset" className="btn btn-outline" onClick={resetRates} style={{ width: "100%", marginTop: 7, fontSize: ".66rem" }}>↺ Rétablir les valeurs de l'appli</button>}
          </div>
        )}
        <div className="grid-2" style={{ marginTop: 10, marginBottom: 0 }}>
          <button className="btn btn-outline" style={{ width: "100%" }} onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" data-testid="tax-save" style={{ width: "100%" }} onClick={save}>Enregistrer</button>
        </div>
      </div>
    </Modal>
  );
}
