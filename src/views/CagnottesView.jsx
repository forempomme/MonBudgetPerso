// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useMemo } from "react";
import { fmt, currentYM, cagTypeOf, DEFAULT_CAG_TYPES } from "../utils.js";
import { EmptyIllustration } from "./shared.jsx";
import { computeProjectStatus, computeCagnottesSummary } from "../hooks.js";

// ─────────────────────────────────────────────────────────────────


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

// v1.71.0 : petit anneau de progression vers l'objectif (cartes compactes)
function ProgressRing({ ratio }) {
  const C = 72.3, done = ratio >= 1;
  const col = done ? "var(--success)" : "var(--purple)";
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" style={{ flexShrink: 0 }} data-testid="cag-ring">
      <circle cx="15" cy="15" r="11.5" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3.5" />
      <circle cx="15" cy="15" r="11.5" fill="none" stroke={col} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={`${(Math.min(1, ratio) * C).toFixed(1)} ${C}`} transform="rotate(-90 15 15)" />
      <text x="15" y="18.3" textAnchor="middle" fontSize="8" fontWeight="800" fill="var(--text)">{done ? "✓" : Math.round(ratio * 100)}</text>
    </svg>
  );
}

export function CagnottesView({ data, onNewCag, onEditCag, onDeleteCag, onTransfer, onShowCagHistory, onNewProject, onEditProject, onDeleteProject, onProjectAutoSaving }) {
  // v1.53.0 — « grille compacte » : barre collée (total, transfert, nouvelle), récap
  // (v1.57.0 : net du mois, répartition par type, détail au toucher), projets en bandeau horizontal (détail complet au toucher), cartes basses.
  // Suppression d'une cagnotte : dans la fenêtre ✏️ (plus de ✕ sur les cartes).
  const { cagnottes, transactions } = data;
  const curM = currentYM();
  const [typeFilter, setTypeFilter] = useState("all");
  const [openProject, setOpenProject] = useState(null);

  // ── Récap (v1.57.0) : une seule source, computeCagnottesSummary (hooks.js) ──
  const sum = useMemo(() => computeCagnottesSummary(data, curM), [data, curM]);
  const RECAP_KEY = "cag_recap_open_v1";
  const [recapOpen, setRecapOpen] = useState(() => { try { return localStorage.getItem(RECAP_KEY) === "1"; } catch { return false; } });
  const toggleRecap = () => setRecapOpen(o => { try { localStorage.setItem(RECAP_KEY, o ? "0" : "1"); } catch { /* préférence non mémorisée */ } return !o; });
  const MONTHS_ABBR = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
  const MONTHS_FULL = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const mIdx = ym => parseInt(ym.slice(5, 7), 10) - 1;
  const signed = n => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
  const netCol = n => n >= 0 ? "var(--success)" : "var(--coral)";

  const btn = pri => ({ height: 34, minWidth: 34, padding: "0 11px", borderRadius: 11, border: pri ? "1px solid var(--btn-pri-border, var(--accent))" : "1px solid var(--border)", background: pri ? "var(--btn-pri-bg, var(--accent))" : "var(--surface2)", color: pri ? "var(--btn-pri-text, #06121c)" : "var(--accent)", fontSize: ".72rem", fontWeight: 800, cursor: "pointer", flexShrink: 0 });
  const secT = (txt, right) => (
    <div style={{ display: "flex", alignItems: "center", fontSize: ".56rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "4px 2px 6px" }}>
      <span style={{ flex: 1 }}>{txt}</span>{right}
    </div>
  );
  const projects = data.projects || [];
  const projOpen = projects.find(p => p.id === openProject);
  const plans = data.autoSavings || [];
  const cagTypes = data.cagTypes || DEFAULT_CAG_TYPES;
  // Filtre sur un type supprimé ou plus utilisé → retour à « Toutes »
  const activeFilter = typeFilter !== "all" && cagnottes.some(c => c.cagType === typeFilter && cagTypeOf(cagTypes, typeFilter)) ? typeFilter : "all";
  const filtered = cagnottes.filter(c => activeFilter === "all" || c.cagType === activeFilter);

  return (
    <div>
      {/* ── v1.71.0 : carte « Total mis de côté » (n'est plus collée) : total, net du mois, répartition, résumé, actions ── */}
      <div data-testid="cag-total-card" className="card" style={{ padding: "11px 12px", marginBottom: 10, borderColor: "color-mix(in srgb, var(--purple) 40%, transparent)" }}>
        <div style={{ fontSize: ".54rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)" }}>Total mis de côté</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 2 }}>
          <span data-testid="cag-total" style={{ fontFamily: "var(--display)", fontSize: "1.45rem", fontWeight: 800, color: "var(--purple)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(sum.total)}</span>
          {(sum.month.sav > 0 || sum.month.decag > 0) && (
            <span data-testid="cag-month-net" style={{ fontSize: ".6rem", fontWeight: 800, padding: "3px 8px", borderRadius: 10, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
              color: netCol(sum.month.net), background: `color-mix(in srgb, ${netCol(sum.month.net)} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${netCol(sum.month.net)} 40%, transparent)` }}>{signed(sum.month.net)} ce mois</span>
          )}
        </div>
        {sum.total > 0 && sum.byType.some(t => t.amount > 0) && (
          <div data-testid="cag-type-bar" style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", marginTop: 9, background: "var(--surface3)" }}>
            {sum.byType.filter(t => t.amount > 0).map(t => <i key={t.id || "none"} title={`${t.label} ${Math.round(t.pct)} %`} style={{ display: "block", height: "100%", width: `${t.pct}%`, background: t.color }} />)}
          </div>
        )}
        <div data-testid="cag-recap-line" onClick={toggleRecap} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, fontSize: ".64rem", color: "var(--text2)", cursor: "pointer" }}>
          <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>
            {MONTHS_ABBR[mIdx(sum.ym)]} <b style={{ color: netCol(sum.month.net) }}>{signed(sum.month.net)}</b>
            {sum.goal > 0
              ? <> · {sum.year} <b style={{ color: "var(--purple)" }}>{Math.round(sum.goalPct)} %</b> de l'objectif</>
              : <> · {sum.year} <b style={{ color: netCol(sum.yearFlows.net) }}>{signed(sum.yearFlows.net)}</b></>}
            {sum.auto.monthly > 0 && <> · 🔁 {fmt(sum.auto.monthly)}/mois</>}
          </span>
          <b style={{ color: "var(--accent)", flexShrink: 0 }}>{recapOpen ? "Moins ▴" : "Détail ▾"}</b>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button data-testid="cag-new" onClick={onNewCag} style={{ ...btn(true), flex: 1, height: 36 }}>＋ Cagnotte</button>
          <button data-testid="cag-transfer" onClick={onTransfer} style={{ ...btn(false), flex: 1, height: 36, color: "var(--text)" }}>🔄 Transférer</button>
        </div>
      </div>

      {/* ── Détail du récap : défile avec la page (pas collé) ── */}
      {recapOpen && (() => {
        const h6 = (t, first) => <div style={{ margin: first ? "0 0 3px" : "8px 0 3px", fontSize: ".54rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)" }}>{t}</div>;
        const row = (l, v, k) => (
          <div key={k || l} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", borderTop: "1px solid var(--border-soft)", fontSize: ".7rem" }}>
            <span style={{ color: "var(--text2)", whiteSpace: "nowrap" }}>{l}</span>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v}</span>
          </div>
        );
        const flow = f => <><span style={{ color: "var(--success)" }}>+{fmt(f.sav)}</span> / <span style={{ color: "var(--coral)" }}>−{fmt(f.decag)}</span> = <b style={{ color: netCol(f.net) }}>{signed(f.net)}</b></>;
        return (
          <div data-testid="cag-recap-detail" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "9px 11px", marginBottom: 10 }}>
            {h6("Répartition", true)}
            {sum.byType.length === 0 && row("Aucune cagnotte", "—")}
            {sum.byType.map(t => row(<>{t.icon} {t.label} <span style={{ color: "var(--text3)" }}>· {t.count}</span></>, <><b>{fmt(t.amount)}</b> <span style={{ color: "var(--text3)" }}>· {Math.round(t.pct)} %</span></>, t.id || "none"))}
            {h6("Mouvements")}
            {row(MONTHS_FULL[mIdx(sum.ym)], flow(sum.month))}
            {row(MONTHS_FULL[mIdx(sum.prevYM)], <span style={{ color: "var(--text2)" }}>{signed(sum.prev.net)} net</span>)}
            {row(`Année ${sum.year}`, flow(sum.yearFlows))}
            {row(`Objectif ${sum.year}`, sum.goal > 0
              ? <><b>{Math.round(sum.goalPct)} %</b> de {fmt(sum.goal)}{sum.goal > sum.yearFlows.sav ? ` · reste ${fmt(sum.goal - sum.yearFlows.sav)}` : " · atteint 🎉"}</>
              : <span style={{ color: "var(--text3)" }}>aucun (à fixer dans le Rapport)</span>)}
            {h6("Objectifs & automatique")}
            {row("Objectifs des cagnottes", sum.objectives.count > 0
              ? <><b>{Math.round(sum.objectives.pct)} %</b> · {fmt(sum.objectives.saved)} / {fmt(sum.objectives.target)}</>
              : <span style={{ color: "var(--text3)" }}>aucun objectif</span>)}
            {row("Versements auto", sum.auto.count > 0 ? <>{fmt(sum.auto.monthly)}/mois ({sum.auto.count})</> : <span style={{ color: "var(--text3)" }}>aucun</span>)}
            {row("Arrondis ce mois", sum.rounding.cag ? <>{fmt(sum.rounding.month)} → {cagTypeOf(cagTypes, sum.rounding.cag.cagType)?.icon || "🐷"} {sum.rounding.cag.name}</> : <span style={{ color: "var(--text3)" }}>désactivés</span>)}
          </div>
        );
      })()}

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
      {cagnottes.some(c => cagTypeOf(cagTypes, c.cagType)) && (
        <div style={{ display: "flex", gap: 5, overflowX: "auto", scrollbarWidth: "none", marginBottom: 8 }}>
          {[["all", `Toutes (${cagnottes.length})`, "var(--accent)"], ...cagTypes.filter(t => cagnottes.some(c => c.cagType === t.id)).map(t => [t.id, `${t.icon} ${t.label}`, t.color])].map(([k, l, col]) => (
            <button key={k} onClick={() => setTypeFilter(k)} style={{
              padding: "5px 10px", borderRadius: 11, fontSize: ".62rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              border: `1px solid ${activeFilter === k ? col : "var(--border)"}`, background: activeFilter === k ? `color-mix(in srgb, ${col} 14%, var(--surface2))` : "var(--surface2)",
              color: activeFilter === k ? col : "var(--text2)",
            }}>{l}</button>
          ))}
        </div>
      )}
      {cagnottes.length === 0
        ? <EmptyIllustration type="cagnottes" title="Aucune cagnotte" sub="Crée ta première cagnotte pour commencer à épargner" cta="＋ Créer une cagnotte" onCta={onNewCag} ctaColor="var(--success)" />
        : (
          <div data-testid="cag-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
            {filtered.map(c => {
              const t = cagTypeOf(cagTypes, c.cagType);
              const ratio = c.target ? Math.max(0, c.current / c.target) : 0;
              const plan = plans.find(a => a.cagnotteId === c.id && a.enabled);
              const proj = projects.find(p => p.cagId === c.id);
              const isRounding = data.roundingEnabled && data.roundingCagnotteId === c.id;
              const marks = [plan ? "🔁" : null, isRounding ? "🪙" : null, proj ? proj.icon : null].filter(Boolean).join(" ");
              return (
                <div key={c.id} data-cag={c.id} onClick={() => onShowCagHistory(c.id)} className="card"
                  style={{ position: "relative", margin: 0, borderRadius: 14, padding: "8px 9px 8px 12px", cursor: "pointer", minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ position: "absolute", left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, background: t ? t.color : "var(--success)" }} />
                  <span style={{ fontSize: "1.05rem", flexShrink: 0 }}>{t ? t.icon : "🐷"}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: ".66rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 0 }}>
                      <b style={{ fontFamily: "var(--mono)", fontSize: ".8rem", fontWeight: 800, color: "var(--purple)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(c.current)}</b>
                      {marks && <span style={{ fontSize: ".55rem", opacity: .85, whiteSpace: "nowrap", overflow: "hidden" }}>{marks}</span>}
                    </span>
                  </span>
                  {c.target ? <ProgressRing ratio={ratio} /> : null}
                </div>
              );
            })}
          </div>
        )
      }
      {cagnottes.length > 0 && <div style={{ fontSize: ".58rem", color: "var(--text3)", margin: "7px 4px 0" }}>Toucher une cagnotte : verser, retirer, transférer, objectif, historique, modifier.</div>}
    </div>
  );
}
