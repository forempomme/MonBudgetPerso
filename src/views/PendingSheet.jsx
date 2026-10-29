// ─────────────────────────────────────────────────────────────────
//  v1.80.1 — « En attente » : tout ce qui n'est pas pointé, TOUS MOIS CONFONDUS
//  Ouvert depuis la pastille « ⏳ … en attente › » de l'Accueil. Liste
//  exactement les éléments du chiffre (computeReconciliation, même source que
//  useReconciliation) : opérations, chèques, frais et revenus fixes non pointés,
//  groupés par mois. Le ○ pointe directement (mêmes contrôles qu'ailleurs).
//  La paie attendue est rappelée HORS total (non comptée tant que non pointée).
// ─────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { fmt, txLabel, fixedCashDateISO, touchMoved } from "../utils.js";
import { Modal } from "../components/index.jsx";
import { computeReconciliation } from "../hooks.js";

const MF = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const JS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const dLbl = iso => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return `${JS[new Date(y, m - 1, d).getDay()]} ${d} ${MS[m - 1]}`; };
const signed = v => `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v))}`;
const ymLbl = ym => `${MF[parseInt(ym.slice(5, 7), 10) - 1]} ${ym.slice(0, 4)}`;

export function PendingSheet({ data, onClose, onTogglePointTx, onTogglePointFix, onTogglePointIncome, onGoToMonth }) {
  const cats = data.categories || [];
  const rec = useMemo(() => computeReconciliation(data.transactions || [], data.fixedExpenses || [], data.fixedIncomes || []),
    [data.transactions, data.fixedExpenses, data.fixedIncomes]);
  const items = useMemo(() => {
    const out = [];
    rec.pendingTx.forEach(({ t, signed: v }) => {
      const cat = cats.find(c => c.id === t.categoryId);
      const cheque = t.paymentMethod === "cheque";
      const label = cheque ? `Chèque${t.chequeNumber ? " n° " + t.chequeNumber : ""}${t.note ? " · " + t.note : ""}` : txLabel(t, cats, data.cagnottes || []);
      out.push({ key: "t" + t.id, ym: (t.date || "").slice(0, 7), sort: t.date || "", v,
        icon: cat?.icon || (cheque ? "🧾" : "💸"), label,
        sub: cheque ? `émis le ${dLbl(t.issuedDate || t.date)} · non encaissé` : `${dLbl(t.date)}${cat && !label.includes(cat.name) ? " · " + cat.name : ""}`,
        point: () => onTogglePointTx?.(t.id) });
    });
    rec.pendingFixes.forEach(({ f, ym, signed: v }) => {
      const d = fixedCashDateISO(f, ym) || `${ym}-01`;
      out.push({ key: "f" + (f.id || f.name) + ym, ym, sort: d, v, icon: cats.find(c => c.id === f.categoryId)?.icon || "📌",
        label: f.name, sub: `frais fixe${f.day ? ` · ${dLbl(d)}` : ""}`, point: () => onTogglePointFix?.(f.id, ym) });
    });
    rec.pendingIncomes.forEach(({ f, ym, signed: v }) => {
      const d = fixedCashDateISO(f, ym) || `${ym}-01`;
      out.push({ key: "i" + (f.id || f.name) + ym, ym: d.slice(0, 7), sort: d, v, icon: cats.find(c => c.id === f.categoryId)?.icon || "💼",
        label: f.name, sub: `revenu fixe${f.day ? ` · ${dLbl(d)}` : ""}`, point: () => onTogglePointIncome?.(f.id, ym) });
    });
    return out.sort((a, b) => b.sort.localeCompare(a.sort));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec, cats]);
  const months = [...new Set(items.map(i => i.ym))].sort((a, b) => b.localeCompare(a));
  const total = Math.round(rec.soldeAttente * 100) / 100;
  const pay = rec.awaitingPay || [];

  return (
    <Modal onClose={onClose} title="">
      <div data-testid="pending-sheet">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.1rem" }}>⏳</span><b style={{ flex: 1, fontSize: "1rem" }}>En attente</b>
          <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ fontSize: ".62rem", color: "var(--text2)", margin: "2px 0 4px" }}>
          {items.length ? `${items.length} élément${items.length > 1 ? "s" : ""} pas encore vu${items.length > 1 ? "s" : ""} sur ton relevé · tous les mois` : "Rien en attente"}
        </div>
        {items.length === 0 && <div data-testid="pending-empty" style={{ textAlign: "center", padding: "20px 0", fontSize: ".78rem", color: "var(--text2)" }}>✅ Tout est pointé</div>}
        {months.map(ym => {
          const list = items.filter(i => i.ym === ym);
          const sub = list.reduce((s, i) => s + i.v, 0);
          return (
            <div key={ym} data-pending-month={ym}>
              <div style={{ display: "flex", alignItems: "center", fontSize: ".56rem", letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 800, color: "var(--text3)", margin: "12px 2px 6px" }}>
                <span style={{ flex: 1 }}>{ymLbl(ym)}</span>
                <b style={{ letterSpacing: 0, fontSize: ".66rem", color: "var(--warning)", fontVariantNumeric: "tabular-nums" }}>{signed(sub)}</b>
              </div>
              {list.map(i => (
                <div key={i.key} data-testid="pending-item" style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 13, marginBottom: 6, background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "1.05rem" }}>{i.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: "block", fontSize: ".74rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.label}</b>
                    <span style={{ display: "block", fontSize: ".58rem", color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.sub}</span>
                  </span>
                  <b style={{ color: i.v >= 0 ? "var(--success)" : "var(--danger)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontSize: ".78rem" }}>{signed(i.v)}</b>
                  <button data-testid="pending-point" aria-label="Pointer"
                    onTouchStart={e => e.stopPropagation()}
                    onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); i.point(); }}
                    onClick={e => { e.stopPropagation(); if (!("ontouchstart" in window)) i.point(); }}
                    style={{ width: 34, height: 34, margin: "-6px -6px -6px -2px", flexShrink: 0, background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", border: "1.8px solid var(--text3)" }} />
                  </button>
                </div>
              ))}
              <div role="button" data-testid="pending-goto" onClick={() => onGoToMonth?.(ym)}
                style={{ fontSize: ".62rem", fontWeight: 800, color: "var(--accent)", textAlign: "right", margin: "-1px 2px 4px", cursor: "pointer" }}>
                Voir {MF[parseInt(ym.slice(5, 7), 10) - 1].toLowerCase()} dans l'Historique ›
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 12px", borderRadius: 13, marginTop: 10, background: "rgba(200,184,96,.08)", border: "1.5px solid rgba(200,184,96,.45)" }}>
          <span style={{ fontSize: ".74rem", fontWeight: 800 }}>Total en attente</span>
          <b data-testid="pending-total" style={{ color: "var(--warning)", fontSize: ".95rem", fontVariantNumeric: "tabular-nums" }}>{signed(total)}</b>
        </div>
        {pay.map(({ f, ym, date, signed: v }) => (
          <div key={f.id + ym} data-testid="pending-pay" style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 13, marginTop: 8, border: "1px dashed rgba(200,184,96,.5)", fontSize: ".68rem", color: "var(--text2)" }}>
            <span>💰</span>
            <span style={{ flex: 1 }}>Paie attendue{date ? ` · prévue le ${parseInt(date.slice(8, 10), 10)}/${date.slice(5, 7)}` : ""}
              <span style={{ display: "block", fontSize: ".56rem", color: "var(--text3)" }}>non comptée tant qu'elle n'est pas pointée</span></span>
            <b style={{ fontVariantNumeric: "tabular-nums" }}>({signed(v)})</b>
          </div>
        ))}
      </div>
    </Modal>
  );
}
