// ─────────────────────────────────────────────────────────────────
//  PayRecapSheet — v1.66.0 : « Salaire reçu · bilan du mois »
//  Ouvert juste après le pointage de la paie (revenu fixe principal).
//  Bilan du mois qui se termine + somme à mettre de côté (= reste du mois,
//  arrondi à la dizaine inférieure) + versement direct vers une cagnotte.
//  Données : computePayRecap (hooks.js).
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { fmt, cagIconOf, pv } from "../utils.js";
import { MONTHS_FR } from "./shared.jsx";

const pctTxt = r => `${pv(Math.round(r * 100))} %`;
const signed = v => (v > 0.004 ? "+" : v < -0.004 ? "−" : "") + fmt(Math.abs(v));
const shortDate = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }); };

export function PayRecapSheet({ recap: r, income, amount, paidDate, nextYM, cagnottes = [], cagTypes, onSave, onSnapshot, onClose }) {
  // v1.67.0 : photo du reste au moment de la paie (comparée au reste final dans le bilan du 1er)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onSnapshot?.(r.rest); }, []);
  const mName = MONTHS_FR[parseInt(r.ym.slice(5, 7), 10) - 1];
  const nextName = nextYM ? MONTHS_FR[parseInt(nextYM.slice(5, 7), 10) - 1].toLowerCase() : null;
  const [cagId, setCagId] = useState(cagnottes[0]?.id || "");
  const can = r.toSave > 0 && cagnottes.length > 0;
  const row = (label, value, color, total) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".74rem", padding: "7px 0", borderBottom: total ? "none" : "1px solid rgba(30,46,72,.6)", fontWeight: total ? 800 : 400 }}>
      <span>{label}</span><b style={{ color, fontVariantNumeric: "tabular-nums" }}>{value}</b>
    </div>
  );
  return createPortal(
    <div data-testid="pay-recap" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(2,6,14,.6)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", animation: "fadeIn .2s ease" }} />
      <div style={{
        position: "relative", width: "100%", maxHeight: "86vh", overflowY: "auto",
        background: "var(--panel-solid, var(--surface))", border: "1px solid var(--border)", borderRadius: 22,
        padding: 14, boxShadow: "0 20px 60px rgba(0,0,0,.65)",
        animation: "slideUp .22s ease", maxWidth: 520, margin: "0 auto",
      }}>
        <div style={{ fontFamily: "var(--display)", fontSize: "1.05rem", fontWeight: 700 }}>💼 {income.name} reçu · bilan {/^[AEIOU]/.test(mName) ? "d'" : "de "}{mName.toLowerCase()}</div>
        <div style={{ fontSize: ".64rem", color: "var(--text2)", margin: "2px 0 12px" }}>
          {fmt(amount)} versés{paidDate ? ` le ${shortDate(paidDate)}` : ""}{income.advance && nextName ? ` → budget de ${nextName}` : ""}
        </div>

        <div style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text2)", marginBottom: 4 }}>{mName} en bref</div>
        {row("💰 Revenus", signed(r.incomes), "var(--success)")}
        {row("📌 Frais fixes", signed(-r.fixed), "var(--danger)")}
        {row("🛒 Dépenses courantes", signed(-r.variable), "var(--danger)")}
        {r.saved !== 0 && row(r.saved > 0 ? "🐷 Déjà mis de côté" : "🐷 Repris des cagnottes", signed(-r.saved), "var(--purple)")}
        {row(`= Reste ${/^[AEIOU]/.test(mName) ? "d'" : "de "}${mName.toLowerCase()}`, signed(r.rest), r.rest >= 0 ? "var(--success)" : "var(--danger)", true)}

        {r.rate != null && (
          <div data-testid="pay-recap-rate" style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8, padding: "8px 10px", borderRadius: 10, fontSize: ".72rem",
            background: "rgba(176,144,224,.08)", border: "1px solid rgba(176,144,224,.4)" }}>
            <span>📈</span>
            <span style={{ flex: 1, lineHeight: 1.5 }}>
              Taux d'épargne : <b>{pctTxt(r.rate)}</b>
              {r.toSave > 0 && <> → <b style={{ color: "var(--purple)" }}>{pctTxt(r.rateAfter)}</b> si tu verses {fmt(r.toSave).replace(",00", "")}</>}
              {r.avg12 != null && <><br /><span style={{ color: "var(--text2)", fontSize: ".62rem" }}>Ta moyenne sur 12 mois : {pctTxt(r.avg12)}</span></>}
            </span>
          </div>
        )}

        <div data-testid="pay-recap-save" style={{ marginTop: 10, borderRadius: 14, padding: "12px 14px",
          background: r.toSave > 0 ? "rgba(176,144,224,.08)" : "rgba(200,184,96,.07)", border: `1.5px solid ${r.toSave > 0 ? "rgba(176,144,224,.45)" : "rgba(200,184,96,.4)"}` }}>
          <div style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: r.toSave > 0 ? "var(--purple)" : "var(--warning)" }}>À mettre de côté maintenant</div>
          <div style={{ fontSize: "1.7rem", fontWeight: 800, color: r.toSave > 0 ? "var(--purple)" : "var(--warning)", margin: "2px 0" }}>{fmt(r.toSave).replace(",00", "")}</div>
          <div style={{ fontSize: ".62rem", color: "var(--text2)", lineHeight: 1.55 }}>
            {r.toSave > 0
              ? <>Reste {/^[AEIOU]/.test(mName) ? "d'" : "de "}{mName.toLowerCase()} {fmt(r.rest)}, arrondi à la dizaine inférieure.</>
              : r.rest < 0 ? <>{mName} a coûté {fmt(-r.rest)} de plus que ses revenus.</> : <>Rien de plus à mettre de côté ce mois-ci.</>}
          </div>
          {can && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {cagnottes.map(c => (
                <span key={c.id} onClick={() => setCagId(c.id)}
                  style={{ padding: "5px 10px", borderRadius: 14, fontSize: ".64rem", fontWeight: 700, cursor: "pointer",
                    border: `1px solid ${cagId === c.id ? "var(--purple)" : "var(--border)"}`, color: cagId === c.id ? "var(--purple)" : "var(--text2)",
                    background: cagId === c.id ? "rgba(176,144,224,.14)" : "transparent" }}>{cagIconOf(cagTypes, c)} {c.name}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {can ? <>
            <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--text2)", fontWeight: 700, fontSize: ".74rem", cursor: "pointer" }}>Plus tard</button>
            <button data-testid="pay-recap-verser" disabled={!cagId} onClick={() => onSave(cagId, r.toSave)}
              style={{ flex: 2, padding: 11, borderRadius: 12, border: "none", background: "var(--purple)", color: "#140c22", fontWeight: 800, fontSize: ".74rem", cursor: "pointer" }}>🐷 Verser {fmt(r.toSave).replace(",00", "")}</button>
          </> : (
            <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 12, border: "none", background: "var(--surface3)", color: "var(--text)", fontWeight: 800, fontSize: ".74rem", cursor: "pointer" }}>Fermer</button>
          )}
        </div>
        {can && <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 8, lineHeight: 1.5 }}>« Verser » crée une opération 🐷 Épargne vers la cagnotte choisie. Le bilan complet reste dans Rapport.</div>}
      </div>
    </div>,
    document.body
  );
}
