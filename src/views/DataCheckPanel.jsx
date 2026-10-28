// ─────────────────────────────────────────────────────────────────
//  v1.79.0 — Vérification des données (contenu de la fenêtre 🩺)
//  Chaque point a son bouton ; rien n'est corrigé sans un toucher.
// ─────────────────────────────────────────────────────────────────
import { fmt } from "../utils.js";
import { computeDataChecks, dupKey } from "../hooks.js";

const MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dLabel = iso => iso ? `${parseInt(iso.slice(8, 10), 10)} ${MS[parseInt(iso.slice(5, 7), 10) - 1]} ${iso.slice(0, 4)}` : "sans date";
const TYPE = { expense: "Dépense", income: "Revenu", epargne: "Épargne", decagnottage: "Retrait cagnotte", dissolution_cagnotte: "Dissolution", transfer: "Transfert", balance_adjustment: "Équilibre" };

export function DataCheckPanel({ data, onEditTrans, onDeleteTrans, onEditFixed, onEditFixedIncome, onDismissDuplicate }) {
  const r = computeDataChecks(data);
  const catOf = id => (data.categories || []).find(c => c.id === id);
  const label = t => { const c = catOf(t.categoryId); return `${c ? c.icon + " " + c.name : t.note || TYPE[t.type] || "Opération"}`; };
  const btn = (txt, onClick, kind, testid) => (
    <button data-testid={testid} onClick={onClick}
      style={{ fontSize: ".6rem", fontWeight: 800, padding: "6px 9px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", touchAction: "manipulation",
        background: "var(--surface2)", color: kind === "p" ? "var(--accent)" : kind === "d" ? "var(--danger)" : "var(--text)",
        border: `1px solid ${kind === "p" ? "var(--accent)" : kind === "d" ? "color-mix(in srgb, var(--danger) 50%, transparent)" : "var(--border)"}` }}>{txt}</button>
  );
  const item = (key, title, sub, actions) => (
    <div key={key} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 0", borderTop: "1px solid var(--border-soft)", fontSize: ".7rem" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ fontSize: ".58rem", color: "var(--text2)" }}>{sub}</div>
      </div>
      {actions}
    </div>
  );
  const block = (k, col, icon, title, list, render) => list.length === 0 ? null : (
    <div key={k} data-check={k} style={{ borderRadius: 14, padding: "9px 11px", marginBottom: 7, border: `1px solid color-mix(in srgb, ${col} 40%, transparent)`, background: `color-mix(in srgb, ${col} 7%, var(--surface))` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".74rem" }}>
        <span>{icon}</span><b style={{ flex: 1 }}>{title}</b>
        <span style={{ fontSize: ".6rem", fontWeight: 900, padding: "2px 8px", borderRadius: 9, background: `color-mix(in srgb, ${col} 22%, transparent)`, color: col }}>{list.length}</span>
      </div>
      <div style={{ marginTop: 4 }}>{list.slice(0, 20).map(render)}</div>
      {list.length > 20 && <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 4 }}>… et {list.length - 20} autre(s) — corrige les premières, la liste se met à jour.</div>}
    </div>
  );
  const nTx = (data.transactions || []).length, nFix = (data.fixedExpenses || []).length + (data.fixedIncomes || []).length;
  return (
    <div data-testid="data-check">
      <div style={{ fontSize: ".64rem", color: "var(--text2)", margin: "-4px 0 10px" }}>
        {r.total
          ? <><b style={{ color: "var(--warning)" }}>{r.total} point{r.total > 1 ? "s" : ""} à vérifier</b> · rien n'est corrigé sans ton accord</>
          : <>Analyse de {nTx} opération{nTx > 1 ? "s" : ""} et {nFix} frais/revenu{nFix > 1 ? "s" : ""} fixe{nFix > 1 ? "s" : ""}</>}
      </div>
      {r.total === 0 && (
        <div data-testid="data-ok" style={{ textAlign: "center", padding: "22px 10px", fontSize: ".78rem", color: "var(--text2)" }}>
          ✅ <b style={{ color: "var(--text)" }}>Tout est en ordre</b><br />Aucune anomalie trouvée.
        </div>
      )}
      {block("orphans", "var(--danger)", "❔", "Catégorie supprimée", r.orphans, t =>
        item(t.id, `${t.note || TYPE[t.type] || "Opération"} · ${fmt(parseFloat(t.amount) || 0)}`, `${dLabel(t.date)} · sa catégorie n'existe plus`,
          btn("Choisir…", () => onEditTrans?.(t.id), "p", "fix-orphan")))}
      {block("zero", "var(--warning)", "0️⃣", "Montant à 0 €", r.zero, t =>
        item(t.id, `${label(t)} · ${fmt(parseFloat(t.amount) || 0)}`, dLabel(t.date),
          <>{btn("Modifier", () => onEditTrans?.(t.id))}{btn("Suppr.", () => onDeleteTrans?.(t.id), "d")}</>))}
      {block("future", "var(--warning)", "📅", "Date dans le futur", r.future, t =>
        item(t.id, `${label(t)} · ${fmt(parseFloat(t.amount) || 0)}`, `daté du ${dLabel(t.date)} — faute de frappe ?`,
          btn("Modifier", () => onEditTrans?.(t.id))))}
      {block("dups", "var(--purple)", "👯", "Doublons probables", r.dups, g =>
        item(dupKey(g), `${label(g[0])} · ${fmt(parseFloat(g[0].amount) || 0)} × ${g.length}`, `${dLabel(g[0].date)} · même montant, même jour, même catégorie`,
          <>{btn("Voir", () => onEditTrans?.(g[g.length - 1].id))}{btn("Pas un doublon", () => onDismissDuplicate?.(dupKey(g)), undefined, "dup-dismiss")}</>))}
      {block("fixNoCat", "#e8944a", "📌", "Frais / revenus fixes sans catégorie", r.fixNoCat, x =>
        item(`${x.kind}${x.idx}`, `${x.f.name} · ${fmt(parseFloat(x.f.amount) || 0)}/mois`, x.kind === "income" ? "revenu fixe · absent des catégories" : "absent des catégories du Rapport",
          btn("Choisir…", () => (x.kind === "income" ? onEditFixedIncome : onEditFixed)?.(x.idx), "p")))}
    </div>
  );
}
