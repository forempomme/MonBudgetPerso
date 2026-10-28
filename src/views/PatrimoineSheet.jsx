// ─────────────────────────────────────────────────────────────────
//  v1.79.0 — Courbe du patrimoine (compte courant + cagnottes, 12 mois)
//  Ouverte depuis l'Accueil (titre « Patrimoine ») et le Rapport › Année.
// ─────────────────────────────────────────────────────────────────
import { useState, useMemo } from "react";
import { fmt, fmtInt, pv, isPrivacy } from "../utils.js";
import { Modal } from "../components/index.jsx";
import { computePatrimoine } from "../hooks.js";

const MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const ACC = "rgba(112,184,224,.5)", CAG = "rgba(176,144,224,.5)";

export function PatrimoineSheet({ data, currentBalance, onClose }) {
  const pts = useMemo(() => computePatrimoine(data, currentBalance, 12), [data, currentBalance]);
  const [sel, setSel] = useState(pts.length - 1);
  const p = pts[sel] || pts[pts.length - 1];
  const first = pts[0], last = pts[pts.length - 1];
  const delta = last.total - first.total;
  const pct = first.total !== 0 ? Math.round(delta / Math.abs(first.total) * 100) : null;
  const W = 340, H = 150, padX = 12;
  const vals = pts.flatMap(x => [x.total, x.account, Math.max(0, x.account) + x.cag, 0]);
  const max = Math.max(...vals, 1), min = Math.min(...vals, 0);
  const X = i => padX + i * (W - 2 * padX) / Math.max(1, pts.length - 1);
  const Y = v => 6 + (max - v) / (max - min || 1) * (H - 14);
  const area = (lo, hi) => `M${lo.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" L")} L${hi.map((v, i) => [i, v]).reverse().map(([i, v]) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" L")} Z`;
  // Compte : de 0 à son solde (sous la ligne 0 s'il est négatif) ; cagnottes empilées au-dessus du compte positif
  const accS = pts.map(x => x.account), accA = pts.map(x => Math.max(0, x.account)), base = pts.map(() => 0), top = pts.map((x, i) => accA[i] + x.cag);
  const ymLabel = ym => `${MS[parseInt(ym.slice(5, 7), 10) - 1]} ${ym.slice(0, 4)}`;
  return (
    <Modal onClose={onClose} title="">
      <div data-testid="patrimoine">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: "1.1rem" }}>📈</span><b style={{ flex: 1, fontSize: "1rem" }}>Patrimoine</b>
          <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontSize: ".64rem", color: "var(--text2)" }}>Aujourd'hui</span>
          <b data-testid="patri-total" style={{ fontSize: "1.3rem", fontVariantNumeric: "tabular-nums" }}>{fmt(last.total)}</b>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", fontSize: ".66rem" }}>
          <span style={{ color: "var(--text2)" }}>sur 12 mois</span>
          <b style={{ color: delta >= 0 ? "var(--success)" : "var(--danger)" }}>{delta >= 0 ? "+" : "−"}{fmtInt(Math.abs(delta))}{pct != null ? ` (${delta >= 0 ? "+" : "−"}${pv(Math.abs(pct))} %)` : ""}</b>
        </div>
        <svg data-pv="" viewBox={`0 0 ${W} ${H + 14}`} width="100%" style={{ display: "block", marginTop: 8 }}>
          <path d={area(base, accS)} fill={ACC} />
          {min < 0 && <line x1={padX} x2={W - padX} y1={Y(0)} y2={Y(0)} stroke="var(--text3)" strokeWidth="1" strokeDasharray="2 3" />}
          <path d={area(accA, top)} fill={CAG} />
          <polyline points={pts.map((x, i) => `${X(i).toFixed(1)},${Y(x.total).toFixed(1)}`).join(" ")} fill="none" stroke="var(--text)" strokeWidth="2" strokeLinejoin="round" />
          <line x1={X(sel)} x2={X(sel)} y1="4" y2={H - 6} stroke="var(--accent)" strokeDasharray="3 3" />
          <circle cx={X(sel)} cy={Y(p.total)} r="4" fill="var(--accent)" />
          {pts.map((x, i) => (
            <g key={x.ym}>
              <rect data-pm={x.ym} x={X(i) - 13} y="0" width="26" height={H + 14} fill="transparent" style={{ cursor: "pointer" }} onClick={() => setSel(i)} />
              <text x={X(i)} y={H + 11} fontSize="8" textAnchor="middle" fill={i === sel ? "var(--text)" : "var(--text3)"}>{MS[parseInt(x.ym.slice(5, 7), 10) - 1].replace(".", "")}</text>
            </g>
          ))}
        </svg>
        <div style={{ display: "flex", gap: 12, fontSize: ".6rem", marginTop: 4, color: "var(--text2)" }}>
          <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: ACC, marginRight: 4, verticalAlign: -1 }} />Compte courant</span>
          <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: CAG, marginRight: 4, verticalAlign: -1 }} />Cagnottes</span>
          <span><i style={{ display: "inline-block", width: 9, height: 2, background: "var(--text)", marginRight: 4, verticalAlign: 2 }} />Total</span>
        </div>
        <div data-testid="patri-detail" style={{ borderRadius: 14, padding: "9px 11px", marginTop: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: ".7rem" }}>
          <div style={{ display: "flex", marginBottom: 4 }}><b style={{ flex: 1 }}>{ymLabel(p.ym)}</b><span style={{ fontSize: ".58rem", color: "var(--text3)" }}>{sel === pts.length - 1 ? "aujourd'hui (solde estimé)" : "fin de mois"}</span></div>
          <div style={{ display: "flex" }}><span style={{ flex: 1 }}>🏦 Compte courant</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(p.account)}</b></div>
          <div style={{ display: "flex" }}><span style={{ flex: 1 }}>🐷 Cagnottes</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(p.cag)}</b></div>
          <div style={{ display: "flex", borderTop: "1px solid var(--border-soft)", marginTop: 4, paddingTop: 4 }}><span style={{ flex: 1 }}>Total</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(p.total)}</b></div>
        </div>
        <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 7, lineHeight: 1.45 }}>
          Touche un mois pour son détail. Compte : solde en fin de mois (le mois en cours = solde estimé de l'accueil). Cagnottes : leur montant à cette date.{isPrivacy() ? " Mode discret : courbe floutée." : ""}
        </div>
      </div>
    </Modal>
  );
}
