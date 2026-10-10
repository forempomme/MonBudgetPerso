// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useMemo } from "react";
import { fmt, currentYM } from "../utils.js";
import { EmptyIllustration } from "./shared.jsx";
import { computeProjectStatus } from "../hooks.js";

// ─────────────────────────────────────────────────────────────────
const CAG_TYPES_MAP = {
  projet:         { icon:"🎯", label:"Projet",         color:"var(--accent)"  },
  urgence:        { icon:"🛡️", label:"Urgence",        color:"var(--danger)"  },
  plaisir:        { icon:"✈️", label:"Plaisir",        color:"var(--purple)"  },
  investissement: { icon:"📈", label:"Investissement", color:"var(--success)" },
};


// ─────────────────────────────────────────────────────────────────
//  ProjectCard — v1.47.0 : projet avec échéance
// ─────────────────────────────────────────────────────────────────
const PROJECT_STATUS = {
  done:            ["ATTEINT",         "var(--success)"],
  ahead:           ["EN AVANCE",       "var(--success)"],
  ontrack:         ["DANS LES TEMPS",  "var(--accent)"],
  behind:          ["EN RETARD",       "var(--danger)"],
  "late-deadline": ["ÉCHÉANCE PASSÉE", "var(--warning)"],
};
function ProjectCard({ project: p, data, onEdit, onDelete, onAutoSaving }) {
  const st = computeProjectStatus(p, data);
  const [label, col] = PROJECT_STATUS[st.status];
  const dl = new Date(p.deadline + "T12:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const plan = (data.autoSavings || []).find(a => a.cagnotteId === p.cagId && a.enabled);
  const bar = (pct, color, marker) => (
    <div style={{ height: 8, borderRadius: 5, background: "var(--surface3)", position: "relative", margin: "4px 0 3px" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 5, background: color }} />
      {marker != null && <span style={{ position: "absolute", top: -3, left: `calc(${marker}% - 1px)`, width: 2, height: 14, background: "#fff", opacity: .8 }} />}
    </div>
  );
  const btn = { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text2)", fontSize: ".66rem", fontWeight: 700, cursor: "pointer" };
  return (
    <div className="card" style={{ marginBottom: 10, borderColor: "rgba(176,144,224,.35)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: "1.4rem" }}>{p.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: ".85rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
          <div style={{ fontSize: ".6rem", color: "var(--text3)" }}>Objectif {fmt(st.target)} · pour le {dl}{st.status !== "late-deadline" && st.status !== "done" ? ` · ${st.monthsLeft} mois restant${st.monthsLeft > 1 ? "s" : ""}` : ""}</div>
        </div>
        <span style={{ fontSize: ".55rem", fontWeight: 800, padding: "3px 8px", borderRadius: 9, color: col, background: `color-mix(in srgb, ${col} 14%, transparent)`, whiteSpace: "nowrap" }}>{label}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".66rem", color: "var(--text2)" }}>
        <span>🐷 Mis de côté{st.cag ? ` (« ${st.cag.name} »)` : " — cagnotte supprimée"}</span><b style={{ color: "var(--purple)" }}>{fmt(st.saved)}</b>
      </div>
      {bar(st.savedPct, "var(--purple)", st.status === "done" ? null : st.expectedPct)}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".58rem", color: "var(--text3)", marginBottom: 8 }}>
        <span>{Math.round(st.savedPct)} %</span>{st.status !== "done" && <span>prévu à ce jour : {fmt(st.expected)} (trait blanc)</span>}
      </div>
      {st.tag && <>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".66rem", color: "var(--text2)" }}>
          <span>{st.tag.icon} Déjà dépensé (tag « {st.tag.name} »)</span><b style={{ color: "var(--coral)" }}>{fmt(st.spent)}</b>
        </div>
        {bar(st.spentPct, "var(--coral)")}
        <div style={{ fontSize: ".58rem", color: "var(--text3)", marginBottom: 8 }}>{Math.round(st.spentPct)} % du budget · {st.spentCount} achat{st.spentCount > 1 ? "s" : ""}</div>
      </>}
      {st.remaining > 0 && st.status !== "late-deadline" && (
        <div style={{ padding: "8px 10px", borderRadius: 10, fontSize: ".66rem", color: "var(--text2)", background: "var(--purple-glow)", border: "1px solid rgba(176,144,224,.3)", marginBottom: 8 }}>
          💡 Reste à mettre de côté : <b style={{ color: "var(--text)" }}>{fmt(st.remaining)}</b> → <b style={{ color: "var(--purple)" }}>{fmt(st.perMonth)} / mois</b>
          {st.status === "behind" ? " pour rattraper le retard" : ` pendant ${Math.max(1, st.monthsLeft)} mois`}
          {plan && <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 3 }}>Versement auto actuel : {fmt(plan.amount)} le {plan.dayOfMonth} du mois</div>}
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button style={btn} onClick={() => onEdit(p)}>✏️</button>
        <button style={{ ...btn, color: "var(--danger)" }} onClick={() => onDelete(p)}>🗑</button>
        {st.cag && st.perMonth > 0 && st.status !== "late-deadline" && (!plan || Math.abs(plan.amount - st.perMonth) > 0.009) && (
          <button style={{ ...btn, flex: 1, background: "var(--purple)", border: "none", color: "#fff" }} onClick={() => onAutoSaving(p, st.perMonth, plan)}>
            🎯 {plan ? `Ajuster le versement auto à ${fmt(st.perMonth)}` : `Versement auto ${fmt(st.perMonth)} / mois`}
          </button>
        )}
      </div>
    </div>
  );
}

export function CagnottesView({ data, onNewCag, onEditCag, onDeleteCag, onTransfer, onShowCagHistory, onNewProject, onEditProject, onDeleteProject, onProjectAutoSaving }) {
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

      {/* ── Projets avec échéance (v1.47.0) ── */}
      {onNewProject && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: ".6rem", fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em", margin: "4px 0 6px 2px" }}>🎯 Projets</div>
          {(data.projects || []).map(p => (
            <ProjectCard key={p.id} project={p} data={data} onEdit={onEditProject} onDelete={onDeleteProject} onAutoSaving={onProjectAutoSaving} />
          ))}
          <button onClick={onNewProject} style={{ width: "100%", padding: 11, borderRadius: 12, border: "1.5px dashed var(--border)", background: "none", color: "var(--text2)", fontSize: ".72rem", fontWeight: 700, cursor: "pointer" }}>
            ＋ Nouveau projet
          </button>
        </div>
      )}

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
