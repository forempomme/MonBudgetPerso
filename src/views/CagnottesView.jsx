// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useMemo, useEffect } from "react";
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
  // v1.53.0 — « grille compacte » : barre collée (total, transfert, nouvelle), pastilles
  // du mois, projets en bandeau horizontal (détail complet au toucher), cartes basses.
  // Suppression d'une cagnotte : dans la fenêtre ✏️ (plus de ✕ sur les cartes).
  const { cagnottes, transactions } = data;
  const curM = currentYM();
  const curY = new Date().getFullYear().toString();
  const [typeFilter, setTypeFilter] = useState("all");
  const [openProject, setOpenProject] = useState(null);

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
  const total = cagnottes.reduce((s, c) => s + (parseFloat(c.current) || 0), 0);

  // Barre collée sous l'en-tête (même principe que l'Historique et le Rapport)
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    const h = document.querySelector(".bp-header");
    const upd = () => setStickyTop(h ? Math.round(h.getBoundingClientRect().height) : 0);
    upd(); window.addEventListener("resize", upd);
    const ro = typeof ResizeObserver !== "undefined" && h ? new ResizeObserver(upd) : null;
    ro?.observe(h);
    return () => { window.removeEventListener("resize", upd); ro?.disconnect(); };
  }, []);

  const chip = (col, bg) => ({ display: "inline-flex", alignItems: "center", fontSize: ".64rem", fontWeight: 800, padding: "5px 9px", borderRadius: 10, whiteSpace: "nowrap", flexShrink: 0, color: col, background: bg, fontVariantNumeric: "tabular-nums" });
  const btn = pri => ({ height: 34, minWidth: 34, padding: "0 11px", borderRadius: 9, border: pri ? "none" : "1px solid var(--border)", background: pri ? "var(--accent)" : "var(--surface2)", color: pri ? "#06121c" : "var(--accent)", fontSize: ".72rem", fontWeight: 800, cursor: "pointer", flexShrink: 0 });
  const secT = (txt, right) => (
    <div style={{ display: "flex", alignItems: "center", fontSize: ".56rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "4px 2px 6px" }}>
      <span style={{ flex: 1 }}>{txt}</span>{right}
    </div>
  );
  const projects = data.projects || [];
  const projOpen = projects.find(p => p.id === openProject);
  const plans = data.autoSavings || [];
  const filtered = cagnottes.filter(c => typeFilter === "all" || c.cagType === typeFilter);

  return (
    <div>
      {/* ── Barre collée : total + actions + pastilles ── */}
      <div style={{ position: "sticky", top: stickyTop, zIndex: 50, background: "var(--bg)", margin: "-16px -16px 10px", padding: "8px 16px", borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: ".54rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)" }}>Total mis de côté</div>
            <div style={{ fontFamily: "var(--display)", fontSize: "1.15rem", fontWeight: 800, color: "var(--purple)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(total)}</div>
          </div>
          <button onClick={onTransfer} style={btn(false)} title="Transfert">🔄</button>
          <button onClick={onNewCag} style={btn(true)}>＋ Cagnotte</button>
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 7, overflowX: "auto", scrollbarWidth: "none" }}>
          <span style={chip("var(--success)", "rgba(104,212,152,.1)")}>↑ +{fmt(savMonth)} ce mois</span>
          {decagMonth > 0 && <span style={chip("var(--coral)", "rgba(224,136,112,.1)")}>↩ −{fmt(decagMonth)} retirés</span>}
          <span style={chip("var(--purple)", "rgba(176,144,224,.1)")}>{curY} : +{fmt(savYear)}{decagYear > 0 ? ` · −${fmt(decagYear)}` : ""}</span>
        </div>
      </div>

      {/* ── Projets : bandeau horizontal, détail complet au toucher ── */}
      {onNewProject && (
        <div style={{ marginBottom: 10 }}>
          {secT("🎯 Projets", <span onClick={onNewProject} style={{ color: "var(--accent)", textTransform: "none", letterSpacing: 0, fontSize: ".66rem", cursor: "pointer" }}>＋ projet</span>)}
          {projects.length === 0 ? (
            <button onClick={onNewProject} style={{ width: "100%", padding: 10, borderRadius: 12, border: "1.5px dashed var(--border)", background: "none", color: "var(--text2)", fontSize: ".7rem", fontWeight: 700, cursor: "pointer" }}>＋ Nouveau projet</button>
          ) : (
            <div style={{ display: "flex", gap: 7, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
              {projects.map(p => {
                const st = computeProjectStatus(p, data);
                const [label, col] = PROJECT_STATUS[st.status];
                const on = openProject === p.id;
                return (
                  <div key={p.id} onClick={() => setOpenProject(on ? null : p.id)}
                    style={{ minWidth: projects.length === 1 ? "100%" : 240, flexShrink: 0, background: "var(--surface)", border: `1px solid ${on ? "var(--purple)" : "rgba(176,144,224,.35)"}`, borderRadius: 12, padding: "9px 10px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span>{p.icon}</span>
                      <b style={{ flex: 1, minWidth: 0, fontSize: ".74rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</b>
                      <span style={{ fontSize: ".5rem", fontWeight: 800, padding: "2px 6px", borderRadius: 7, color: col, background: `color-mix(in srgb, ${col} 14%, transparent)`, whiteSpace: "nowrap" }}>{label}</span>
                      <span style={{ color: "var(--text3)", fontSize: ".6rem" }}>{on ? "▴" : "▾"}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "var(--surface3)", position: "relative", marginTop: 6 }}>
                      <div style={{ width: `${Math.min(100, st.savedPct)}%`, height: "100%", borderRadius: 3, background: "var(--purple)" }} />
                      {st.status !== "done" && <span style={{ position: "absolute", top: -3, left: `calc(${Math.min(100, st.expectedPct)}% - 1px)`, width: 2, height: 11, background: "#fff", opacity: .8 }} />}
                    </div>
                    <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                      {fmt(st.saved)} / {fmt(st.target)}{st.remaining > 0 && st.status !== "late-deadline" ? <> · <b style={{ color: "var(--purple)" }}>{fmt(st.perMonth)}/mois</b></> : null}
                    </div>
                  </div>
                );
              })}
              {projects.length > 1 && (
                <div onClick={onNewProject} style={{ minWidth: 120, flexShrink: 0, border: "1.5px dashed var(--border)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)", fontSize: ".66rem", fontWeight: 700, cursor: "pointer" }}>＋ Nouveau</div>
              )}
            </div>
          )}
          {projOpen && (
            <div style={{ marginTop: 7 }}>
              <ProjectCard project={projOpen} data={data} onEdit={onEditProject} onDelete={pp => { setOpenProject(null); onDeleteProject(pp); }} onAutoSaving={onProjectAutoSaving} />
            </div>
          )}
        </div>
      )}

      {/* ── Cagnottes : filtre par type + grille compacte ── */}
      {secT("🐷 Cagnottes")}
      {cagnottes.some(c => c.cagType) && (
        <div style={{ display: "flex", gap: 5, overflowX: "auto", scrollbarWidth: "none", marginBottom: 8 }}>
          {[["all", `Toutes (${cagnottes.length})`, "var(--accent)"], ...Object.entries(CAG_TYPES_MAP).filter(([k]) => cagnottes.some(c => c.cagType === k)).map(([k, t]) => [k, `${t.icon} ${t.label}`, t.color])].map(([k, l, col]) => (
            <button key={k} onClick={() => setTypeFilter(k)} style={{
              padding: "5px 10px", borderRadius: 11, fontSize: ".62rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              border: `1px solid ${typeFilter === k ? col : "var(--border)"}`, background: typeFilter === k ? `color-mix(in srgb, ${col} 14%, var(--surface2))` : "var(--surface2)",
              color: typeFilter === k ? col : "var(--text2)",
            }}>{l}</button>
          ))}
        </div>
      )}
      {cagnottes.length === 0
        ? <EmptyIllustration type="cagnottes" title="Aucune cagnotte" sub="Crée ta première cagnotte pour commencer à épargner" cta="＋ Créer une cagnotte" onCta={onNewCag} ctaColor="var(--success)" />
        : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
            {filtered.map(c => {
              const t = CAG_TYPES_MAP[c.cagType];
              const pct = c.target ? Math.min(100, (c.current / c.target) * 100) : 0;
              const perMonth = (() => {
                if (!c.target || !c.targetDate) return null;
                const rem = c.target - c.current;
                const today = new Date(), tgt = new Date(c.targetDate);
                const months = Math.max(1, (tgt.getFullYear() - today.getFullYear()) * 12 + (tgt.getMonth() - today.getMonth()));
                return rem > 0 ? rem / months : null;
              })();
              const plan = plans.find(a => a.cagnotteId === c.id && a.enabled);
              const proj = projects.find(p => p.cagId === c.id);
              const isRounding = data.roundingEnabled && data.roundingCagnotteId === c.id;
              const sub = [
                c.target ? `${Math.round(pct)} % de ${fmt(c.target)}` : "pas d'objectif",
                perMonth ? `≈ ${fmt(perMonth)}/mois` : null,
              ].filter(Boolean).join(" · ");
              const extra = [plan ? `🔁 ${fmt(plan.amount)} le ${plan.dayOfMonth}` : null, isRounding ? "🪙 arrondis" : null, proj ? `${proj.icon} ${proj.name}` : null].filter(Boolean).join(" · ");
              return (
                <div key={c.id} onClick={() => onShowCagHistory(c.id)}
                  style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${t ? t.color : "var(--khaki)"}`, borderRadius: 12, padding: "9px 10px", cursor: "pointer", minWidth: 0 }}>
                  <button onClick={e => { e.stopPropagation(); onEditCag(c.id); }}
                    style={{ position: "absolute", right: 4, top: 4, background: "none", border: "none", fontSize: ".72rem", padding: 4, cursor: "pointer", opacity: .75 }}>✏️</button>
                  <div style={{ fontSize: ".74rem", fontWeight: 700, paddingRight: 22, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t ? t.icon : "🐷"} {c.name}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: ".84rem", fontWeight: 800, color: "var(--khaki)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{fmt(c.current)}</div>
                  {c.target ? (
                    <div style={{ height: 5, borderRadius: 3, background: "var(--surface3)", overflow: "hidden", marginTop: 5 }}>
                      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: pct >= 100 ? "var(--success)" : "var(--khaki)" }} />
                    </div>
                  ) : null}
                  <div style={{ fontSize: ".56rem", color: "var(--text3)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    onClick={!c.target ? e => { e.stopPropagation(); onEditCag(c.id); } : undefined}>
                    {c.target ? sub : <span style={{ color: "var(--accent)" }}>＋ Définir un objectif</span>}
                  </div>
                  {extra && <div style={{ fontSize: ".54rem", color: "var(--text2)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{extra}</div>}
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
