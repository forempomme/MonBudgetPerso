// ─────────────────────────────────────────────────────────────────
//  MonthRecapSheet — v1.47.0 : « Clôture du mois »
//  Affiché automatiquement le 1er de chaque mois (une seule fois, au
//  premier démarrage de la journée) pour le mois qui vient de se
//  terminer ; retrouvable dans le Rapport (« Bilans mensuels »).
//  Données : computeMonthRecap (hooks.js).
// ─────────────────────────────────────────────────────────────────
import { createPortal } from "react-dom";
import { fmt, pv } from "../utils.js";
import { MONTHS_FR } from "./shared.jsx";

const MONTHS_ABBR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const signed = v => (v > 0.004 ? "+" : v < -0.004 ? "−" : "") + fmt(Math.abs(v));

function Kpi({ label, value, color, sub, subColor }) {
  return (
    <div style={{ borderRadius: 11, padding: "9px 10px", background: "var(--surface2)", border: "1px solid var(--border)", minWidth: 0 }}>
      <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontSize: "1rem", fontWeight: 800, marginTop: 2, color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      {sub && <div style={{ fontSize: ".6rem", fontWeight: 700, color: subColor || "var(--text3)" }}>{sub}</div>}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: ".58rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "12px 0 6px" }}>{children}</div>;
}

function Row({ children, border, onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: "var(--surface2)",
      border: `1px solid ${border || "var(--border)"}`, marginBottom: 6, fontSize: ".72rem", cursor: onClick ? "pointer" : "default" }}>{children}</div>
  );
}

function BudgetBar({ label, spent, budget }) {
  const pct = budget > 0 ? Math.min(100, spent / budget * 100) : 100;
  const over = spent > budget;
  return (
    <div style={{ padding: "8px 10px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 6 }}>
      <div style={{ display: "flex", fontSize: ".72rem" }}><span style={{ flex: 1 }}>{label}</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(spent)} / {fmt(budget)}</b></div>
      <div style={{ height: 7, borderRadius: 5, background: "var(--surface3)", overflow: "hidden", marginTop: 6 }}>
        <div data-pv="" style={{ width: `${pct}%`, height: "100%", borderRadius: 5, background: over ? "var(--danger)" : pct >= 80 ? "var(--warning)" : "var(--success)" }} />
      </div>
      {over && <div style={{ fontSize: ".6rem", color: "var(--danger)", marginTop: 3 }}>dépassé de {fmt(spent - budget)}</div>}
    </div>
  );
}

export function MonthRecapSheet({ recap: r, categories = [], onClose, onOpenRapport, onGoUnpointed, onPrevMonth, onNextMonth }) {
  const [y, m] = r.ym.split("-").map(Number);
  const mName = MONTHS_FR[m - 1];
  const cmp = (pct, higherIsGood) => {
    if (pct == null) return { sub: r.monthsCompared ? "" : "pas encore de comparaison", col: "var(--text3)" };
    if (Math.abs(pct) < 3) return { sub: `= stable vs moyenne ${r.monthsCompared} mois`, col: "var(--text3)" };
    const good = higherIsGood ? pct > 0 : pct < 0;
    return { sub: `${pct > 0 ? "▲" : "▼"} ${pv(Math.abs(pct))} % vs moyenne ${r.monthsCompared} mois`, col: good ? "var(--success)" : "var(--danger)" };
  };
  const e = cmp(r.expensesPct, false), i = cmp(r.incomesPct, true);
  const cat = id => categories.find(c => c.id === id);
  const navBtn = { width: 28, height: 28, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fadeIn .2s ease" }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "92vh", overflowY: "auto",
        background: "var(--panel-solid, var(--surface))", borderTop: "1.5px solid var(--border)", borderRadius: "20px 20px 0 0",
        padding: "10px 14px calc(16px + env(safe-area-inset-bottom))", boxShadow: "0 -20px 50px rgba(0,0,0,.7)",
        animation: "slideUp .22s ease", maxWidth: 520, margin: "0 auto",
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 3, background: "var(--border)", margin: "0 auto 10px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ flex: 1, fontFamily: "var(--display)", fontSize: "1.05rem", fontWeight: 700 }}>📊 {mName} en bref</span>
          {onPrevMonth && <button style={navBtn} onClick={onPrevMonth}>‹</button>}
          {onNextMonth && <button style={navBtn} onClick={onNextMonth}>›</button>}
          <button style={navBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: ".64rem", color: "var(--text3)", margin: "2px 0 10px" }}>Bilan du 1ᵉʳ au {new Date(y, m, 0).getDate()} {mName.toLowerCase()} {y}</div>

        {!r.hasData ? (
          <div style={{ fontSize: ".72rem", color: "var(--text3)", textAlign: "center", padding: 20 }}>Aucune opération ce mois-là.</div>
        ) : <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <Kpi label="Dépenses" value={fmt(r.expenses)} color="var(--danger)" sub={e.sub} subColor={e.col} />
            <Kpi label="Revenus" value={fmt(r.incomes)} color="var(--success)" sub={i.sub} subColor={i.col} />
            <Kpi label="Épargné" value={signed(r.savings)} color="var(--purple)"
              sub={[r.savingsRate != null && r.savings !== 0 ? `${pv(Math.round(r.savingsRate * 100))} % des revenus` : null,
                r.savingsCags ? `${r.savingsCags} cagnotte${r.savingsCags > 1 ? "s" : ""}` : "aucun versement"].filter(Boolean).join(" · ")} />
            <Kpi label="Solde fin de mois" value={fmt(r.endBalance)}
              sub={r.balanceDelta == null ? "" : `${r.balanceDelta >= 0 ? "▲" : "▼"} ${signed(r.balanceDelta)} sur le mois`}
              subColor={r.balanceDelta >= 0 ? "var(--success)" : "var(--danger)"} />
          </div>

          {/* v1.67.0 : reste photographié à la paie vs reste final */}
          {r.payCheck && (() => {
            const c = r.payCheck, dd = c.date ? `${parseInt(c.date.slice(8, 10), 10)} ${MONTHS_ABBR[parseInt(c.date.slice(5, 7), 10) - 1]}` : "";
            return (
              <div data-testid="recap-paycheck" style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 10, marginTop: 6, fontSize: ".72rem",
                background: "var(--surface2)", border: `1px solid ${c.over > 0 ? "rgba(200,184,96,.5)" : "var(--border)"}` }}>
                <span>💼</span>
                <span style={{ flex: 1, lineHeight: 1.5 }}>
                  À la paie{dd ? ` du ${dd}` : ""} : reste <b style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(c.rest)}</b>
                  {c.saved > 0 && <>, mis de côté <b style={{ color: "var(--purple)", fontVariantNumeric: "tabular-nums" }}>{fmt(c.saved)}</b></>}
                  <br /><span style={{ color: "var(--text2)" }}>Reste final : <b style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{fmt(c.finalRest)}</b>
                  {Math.abs(c.diff) >= 0.01 && <> · <span style={{ color: c.diff < 0 ? "var(--warning)" : "var(--success)" }}>{signed(c.diff)}</span> {c.diff < 0 ? "dépensés" : "de mieux"} depuis</>}</span>
                  {c.over > 0 && <><br /><span style={{ color: "var(--warning)", fontWeight: 700 }}>{fmt(c.over)} de trop mis de côté, à reprendre si besoin</span></>}
                </span>
              </div>
            );
          })()}

          {r.movers.length > 0 && <>
            <Label>Ce qui a le plus bougé</Label>
            {r.movers.map(x => {
              const c = cat(x.catId);
              return (
                <Row key={x.catId}>
                  <span>{c?.icon || "❔"}</span><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c?.name || "Sans catégorie"}</span>
                  <span style={{ fontWeight: 800, color: x.diff > 0 ? "var(--danger)" : "var(--success)" }}>
                    {x.pct == null ? "nouveau" : `${x.pct > 0 ? "+" : "−"}${pv(Math.abs(x.pct))} %`}
                  </span>
                  <b style={{ marginLeft: 6, fontVariantNumeric: "tabular-nums" }}>{fmt(x.amount)}</b>
                </Row>
              );
            })}
          </>}

          {(r.grocery || r.tagBudgets.length > 0) && <>
            <Label>Budgets</Label>
            {r.grocery && <BudgetBar label="🛒 Courses" spent={r.grocery.spent} budget={r.grocery.average} />}
            {r.tagBudgets.map(b => <BudgetBar key={b.tag.id} label={`${b.tag.icon} ${b.tag.name} (tag)`} spent={b.spent} budget={b.budget} />)}
          </>}

          {(r.unpointed > 0 || r.cheques > 0) && <>
            <Label>À faire</Label>
            {r.unpointed > 0 && (
              <Row border="rgba(200,184,96,.4)" onClick={onGoUnpointed}>
                <span>⏳</span><span style={{ flex: 1 }}>{r.unpointed} opération{r.unpointed > 1 ? "s" : ""} de {mName.toLowerCase()} pas pointée{r.unpointed > 1 ? "s" : ""}</span>
                {onGoUnpointed && <b style={{ color: "var(--accent)" }}>Voir ›</b>}
              </Row>
            )}
            {r.cheques > 0 && (
              <Row border="rgba(159,180,230,.4)">
                <span>🧾</span><span style={{ flex: 1 }}>{r.cheques} chèque{r.cheques > 1 ? "s" : ""} non encaissé{r.cheques > 1 ? "s" : ""}{r.oldestChequeDays != null ? ` (le plus ancien : ${r.oldestChequeDays} j)` : ""}</span>
              </Row>
            )}
          </>}
        </>}

        <div className="grid-2" style={{ marginTop: 12, marginBottom: 0 }}>
          <button className="btn btn-outline" style={{ width: "100%" }} onClick={onOpenRapport || onClose}>{onOpenRapport ? "Voir le rapport" : "Fermer"}</button>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={onClose}>👍 Compris</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
