// ─────────────────────────────────────────────────────────────────
//  YearRecapSheet — v1.68.0 : « 2026 en bref »
//  Ouvert le 1er janvier (après le bilan de décembre), retrouvable dans
//  Rapport › Année. Données : computeYearRecap (hooks.js).
// ─────────────────────────────────────────────────────────────────
import { createPortal } from "react-dom";
import { fmt } from "../utils.js";
import { MONTHS_FR } from "./shared.jsx";

const signed = v => (v > 0.004 ? "+" : v < -0.004 ? "−" : "") + fmt(Math.abs(v));
const round = v => fmt(Math.round(v)).replace(",00", "");
const mName = ym => MONTHS_FR[parseInt(ym.slice(5, 7), 10) - 1].toLowerCase();

function Kpi({ label, value, color, sub, subColor }) {
  return (
    <div style={{ borderRadius: 11, padding: "9px 10px", background: "var(--surface2)", border: "1px solid var(--border)", minWidth: 0 }}>
      <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontSize: ".95rem", fontWeight: 800, marginTop: 2, color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      {sub && <div style={{ fontSize: ".6rem", fontWeight: 700, color: subColor || "var(--text3)" }}>{sub}</div>}
    </div>
  );
}
const Label = ({ children }) => <div style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "12px 0 6px" }}>{children}</div>;
const Row = ({ children }) => <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 6, fontSize: ".72rem" }}>{children}</div>;

export function YearRecapSheet({ recap: r, categories = [], onClose, onOpenRapport }) {
  const vs = (p, higherIsGood) => {
    if (p == null) return { t: r.hasPrev ? "" : null, c: "var(--text3)" };
    const good = higherIsGood ? p > 0 : p < 0;
    return { t: `${p > 0 ? "▲" : p < 0 ? "▼" : "="} ${Math.abs(p)} %`, c: Math.abs(p) < 3 ? "var(--text3)" : good ? "var(--success)" : "var(--danger)" };
  };
  const inc = vs(r.incomesPct, true), exp = vs(r.expensesPct, false);
  const cat = id => categories.find(c => c.id === id);
  const cagDelta = r.cagEnd - r.cagStart;
  return createPortal(
    <div data-testid="year-recap" style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fadeIn .2s ease" }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "92vh", overflowY: "auto",
        background: "var(--surface)", borderTop: "1.5px solid var(--border)", borderRadius: "20px 20px 0 0",
        padding: "10px 14px calc(16px + env(safe-area-inset-bottom))", boxShadow: "0 -20px 50px rgba(0,0,0,.7)",
        animation: "slideUp .22s ease", maxWidth: 520, margin: "0 auto",
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 3, background: "var(--border)", margin: "0 auto 10px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ flex: 1, fontFamily: "var(--display)", fontSize: "1.05rem", fontWeight: 700 }}>🎆 {r.year} en bref</span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ fontSize: ".64rem", color: "var(--text3)", margin: "2px 0 10px" }}>
          {r.partial ? `Du 1ᵉʳ janvier à aujourd'hui (${r.monthsCount} mois)` : `Du 1ᵉʳ janvier au 31 décembre ${r.year}`}
          {r.hasPrev ? ` · comparé à ${r.year - 1}` : ` · pas de données ${r.year - 1} à comparer`}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <Kpi label="Revenus" value={round(r.incomes)} color="var(--success)" sub={inc.t} subColor={inc.c} />
          <Kpi label="Dépenses" value={round(r.expenses)} color="var(--danger)" sub={exp.t} subColor={exp.c} />
          <Kpi label="Épargné" value={round(r.saved)} color="var(--purple)" sub={r.rate != null ? `${Math.round(r.rate * 100)} % des revenus` : ""} />
          <Kpi label="Cagnottes" value={`${round(r.cagStart)} → ${round(r.cagEnd)}`} color="var(--text)"
            sub={signed(Math.round(cagDelta)).replace(",00", "")} subColor={cagDelta >= 0 ? "var(--success)" : "var(--danger)"} />
        </div>

        {(r.best || r.worst) && <>
          <Label>Les mois</Label>
          {r.best && <Row><span>🏆</span><span style={{ flex: 1 }}>Meilleur : <b>{mName(r.best.ym)}</b> · {signed(r.best.rest)} de reste</span></Row>}
          {r.worst && r.worst.ym !== r.best?.ym && <Row><span>🌧️</span><span style={{ flex: 1 }}>Plus dur : <b>{mName(r.worst.ym)}</b> · {signed(r.worst.rest)}</span></Row>}
        </>}

        {r.cats.length > 0 && <>
          <Label>{r.hasPrev ? `Ce qui a le plus bougé vs ${r.year - 1}` : "Les plus grosses dépenses"}</Label>
          {r.cats.map(x => {
            const c = cat(x.catId);
            return (
              <Row key={x.catId}>
                <span>{c?.icon || "❔"}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c?.name || "Sans catégorie"}</span>
                {r.hasPrev && <b style={{ color: x.diff > 0 ? "var(--danger)" : "var(--success)" }}>{x.pct == null ? "nouveau" : `${x.pct > 0 ? "+" : "−"}${Math.abs(x.pct)} %`}</b>}
                <b style={{ marginLeft: 6, fontVariantNumeric: "tabular-nums" }}>{round(x.amount)}</b>
              </Row>
            );
          })}
        </>}

        {r.fixedYear > 0 && <>
          <Label>Abonnements & fixes</Label>
          <Row><span>📌</span><span style={{ flex: 1 }}>{round(r.fixedYear)} sur l'année{r.rises > 0 ? ` · ${r.rises} hausse${r.rises > 1 ? "s" : ""} (${signed(r.riseYear).replace(",00", "")}/an)` : " · aucune hausse"}</span></Row>
        </>}

        <div style={{ fontSize: ".56rem", color: "var(--text3)", margin: "4px 2px 0", lineHeight: 1.5 }}>Cagnottes au 1ᵉʳ janvier et {r.partial ? "aujourd'hui" : "au 31 décembre"} : recalculées depuis leur solde actuel et les versements / retraits.</div>
        <div className="grid-2" style={{ marginTop: 12, marginBottom: 0 }}>
          <button className="btn btn-outline" style={{ width: "100%" }} onClick={onOpenRapport || onClose}>{onOpenRapport ? "Voir le rapport" : "Fermer"}</button>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={onClose}>👍 Compris</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
