// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useMemo } from "react";
import { fmt, currentYM } from "../utils.js";
import { EmptyIllustration } from "./shared.jsx";

// ─────────────────────────────────────────────────────────────────
const CAG_TYPES_MAP = {
  projet:         { icon:"🎯", label:"Projet",         color:"var(--accent)"  },
  urgence:        { icon:"🛡️", label:"Urgence",        color:"var(--danger)"  },
  plaisir:        { icon:"✈️", label:"Plaisir",        color:"var(--purple)"  },
  investissement: { icon:"📈", label:"Investissement", color:"var(--success)" },
};

export function CagnottesView({ data, onNewCag, onEditCag, onDeleteCag, onTransfer, onShowCagHistory }) {
  const { cagnottes, transactions } = data;
  const curM = currentYM();
  const curY = new Date().getFullYear().toString();
  const [typeFilter, setTypeFilter] = useState("all");

  // ── Stats épargne + décagnottage ─────────────────────────────
  const { savMonth, savYear, decagMonth, decagYear } = useMemo(() => {
    let savMonth = 0, savYear = 0, decagMonth = 0, decagYear = 0;
    transactions.forEach(t => {
      const a = parseFloat(t.amount) || 0;
      const inMonth = t.date.startsWith(curM);
      const inYear  = t.date.startsWith(curY);
      if (t.type === "epargne") {
        if (inMonth) savMonth += a;
        if (inYear)  savYear  += a;
      } else if (t.type === "decagnottage") {
        if (inMonth) decagMonth += a;
        if (inYear)  decagYear  += a;
      }
    });
    return { savMonth, savYear, decagMonth, decagYear };
  }, [transactions, curM, curY]);

  return (
    <div>
      {/* ── Bloc stats ── */}
      <div className="card" style={{
        borderLeft: "3px solid var(--accent)",
        background: "var(--accent-glow, rgba(124,58,237,.1))",
        padding: "12px 14px",
        marginBottom: 10,
      }}>
        <div style={{ fontSize: ".67rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>
          📊 Épargne &amp; Mouvements
        </div>
        {[
          { label: "💰 Épargné ce mois",         value: savMonth,   color: "var(--success)" },
          { label: "💰 Épargné cette année",      value: savYear,    color: "var(--success)" },
          { label: "↩️ Décagnottage ce mois",     value: decagMonth, color: "var(--warning)" },
          { label: "↩️ Décagnottage cette année", value: decagYear,  color: "var(--warning)" },
        ].map(({ label, value, color }, i, arr) => (
          <div key={label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "5px 0",
            borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none",
          }}>
            <span style={{ fontSize: ".75rem", color: "var(--text2)" }}>{label}</span>
            <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: ".78rem", color, fontVariantNumeric: "tabular-nums" }}>
              {fmt(value)}
            </span>
          </div>
        ))}
      </div>

      {/* ── Boutons ── */}
      <div className="grid-2" style={{ marginBottom: 12 }}>
        <button className="btn btn-outline" style={{ width: "100%", borderColor: "var(--accent)", color: "var(--accent)" }} onClick={onTransfer}>
          🔄 Transfert
        </button>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={onNewCag}>
          ＋ Nouvelle
        </button>
      </div>

      {/* ★ Filtre par type */}
      {cagnottes.some(c => c.cagType) && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
          <button onClick={()=>setTypeFilter("all")} style={{
            padding:"4px 10px", borderRadius:20, fontSize:".62rem", fontWeight:700, cursor:"pointer",
            border:`1.5px solid ${typeFilter==="all"?"var(--accent)":"var(--border)"}`,
            background:typeFilter==="all"?"rgba(90,184,224,.12)":"var(--surface2)",
            color:typeFilter==="all"?"var(--accent)":"var(--text2)",
          }}>Toutes ({cagnottes.length})</button>
          {Object.entries(CAG_TYPES_MAP).filter(([k])=>cagnottes.some(c=>c.cagType===k)).map(([k,t])=>(
            <button key={k} onClick={()=>setTypeFilter(k)} style={{
              padding:"4px 10px", borderRadius:20, fontSize:".62rem", fontWeight:700, cursor:"pointer",
              border:`1.5px solid ${typeFilter===k?t.color:"var(--border)"}`,
              background:typeFilter===k?`color-mix(in srgb,${t.color} 14%,var(--surface2))`:"var(--surface2)",
              color:typeFilter===k?t.color:"var(--text2)",
            }}>{t.icon} {t.label}</button>
          ))}
        </div>
      )}
      {cagnottes.length === 0
        ? <EmptyIllustration type="cagnottes" title="Aucune cagnotte" sub="Crée ta première cagnotte pour commencer à épargner" cta="＋ Créer une cagnotte" onCta={onNewCag} ctaColor="var(--success)" />
        : (
          <div className="grid-2">
            {cagnottes.filter(c => typeFilter==="all" || c.cagType===typeFilter).map(c => {
              const pct = c.target ? Math.min(100, (c.current / c.target) * 100) : 0;
              const neededPerMonth = (() => {
                if (!c.target || !c.targetDate) return null;
                const rem    = c.target - c.current;
                const today  = new Date(), tgt = new Date(c.targetDate);
                const months = Math.max(1,
                  (tgt.getFullYear() - today.getFullYear()) * 12 + (tgt.getMonth() - today.getMonth())
                );
                return rem > 0 ? fmt(rem / months) : null;
              })();

              return (
                <div key={c.id} className="cag-card" onClick={() => onShowCagHistory(c.id)}>
                  <span className="cag-del-btn" onClick={e => { e.stopPropagation(); onDeleteCag(c.id); }}>✕</span>
                  <button className="cag-edit-btn" onClick={e => { e.stopPropagation(); onEditCag(c.id); }}>✏️</button>
                  {/* ★ Badge type */}
                  {c.cagType && CAG_TYPES_MAP[c.cagType] && (
                    <div style={{
                      fontSize:".5rem", fontWeight:700, padding:"1px 6px", borderRadius:3,
                      background:`color-mix(in srgb,${CAG_TYPES_MAP[c.cagType].color} 14%,transparent)`,
                      color:CAG_TYPES_MAP[c.cagType].color,
                      border:`1px solid color-mix(in srgb,${CAG_TYPES_MAP[c.cagType].color} 30%,transparent)`,
                      display:"inline-flex", alignItems:"center", gap:3, marginBottom:3,
                    }}>
                      {CAG_TYPES_MAP[c.cagType].icon} {CAG_TYPES_MAP[c.cagType].label}
                    </div>
                  )}
                  <div className="cag-name">🎯 {c.name}</div>
                  <div className="cag-amt">{fmt(c.current)}{c.target ? ` / ${fmt(c.target)}` : ""}</div>
                  {c.target && (
                    <>
                      <div className="progress-bg" style={{ marginTop:8, height:6 }}>
                        <div className="progress-fill" style={{ width:`${pct}%`, boxShadow:`0 0 8px var(--khaki)44` }} />
                      </div>
                      <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:4, fontWeight:700, display:"flex", justifyContent:"space-between" }}>
                        <span style={{ color: pct >= 100 ? "var(--success)" : "var(--khaki)", fontWeight:800 }}>{pct.toFixed(0)}%</span>
                        <span>{fmt(Math.max(0, c.target - c.current))} restant</span>
                      </div>
                    </>
                  )}
                  {!c.target && (
                    <div style={{ fontSize:".55rem", color:"var(--accent)", marginTop:6, opacity:.7 }}
                      onClick={e => { e.stopPropagation(); onEditCag(c.id); }}>
                      ＋ Définir un objectif
                    </div>
                  )}
                  {neededPerMonth && (
                    <div style={{ fontSize: ".58rem", color: "var(--accent)", marginTop: 5, fontFamily: "var(--mono)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      ≈ {neededPerMonth}/mois
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
