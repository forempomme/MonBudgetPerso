// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState } from "react";
import { fmt, currentYM } from "../utils.js";
import { effectiveFixesForMonth, effectiveIncomesForMonth } from "../hooks.js";
import { EmptyIllustration, SectionTitle } from "./shared.jsx";

// ─────────────────────────────────────────────────────────────────
//  FIXES
// ─────────────────────────────────────────────────────────────────
export function FixesView({ data, onNewFixed, onEditFixed, onDeleteFixed, onQuickPauseFixed, onNewFixedIncome, onEditFixedIncome, onDeleteFixedIncome, onQuickPauseIncome, onSaveProvisional, onDeleteProvisional }) {
  const { fixedExpenses, categories } = data;
  const fixedIncomes         = data.fixedIncomes || [];
  const provisionalExpenses  = data.provisionalExpenses || [];
  const [selected,     setSelected]    = useState(null);
  const [activeSection,setActiveSection]= useState("depenses");
  const [showProvForm, setShowProvForm] = useState(false);
  const [provName,     setProvName]    = useState("");
  const [provAmt,      setProvAmt]     = useState("");
  const [provErr,      setProvErr]     = useState({});
  const [pauseFilterOn,setPauseFilterOn]= useState(false);
  const [pauseTooltipId, setPauseTooltipId] = useState(null);
  const pausedFixCount = fixedExpenses.filter(f => f.paused).length;
  const pausedIncCount = fixedIncomes.filter(f => f.paused).length;
  const pausedCount    = pausedFixCount + pausedIncCount;
  const curYM        = currentYM();
  const totalFixes    = effectiveFixesForMonth(fixedExpenses, curYM);
  const totalIncomes  = effectiveIncomesForMonth(fixedIncomes, curYM);
  const provTotal    = provisionalExpenses.reduce((s, p) => s + (p.amount || 0), 0);
  const total = totalFixes; // alias pour compatibilité

  function handleAddProv() {
    const e = {};
    if (!provName.trim()) e.name = "Nom requis";
    const a = parseFloat(provAmt);
    if (!provAmt || isNaN(a) || a <= 0) e.amt = "Montant requis > 0";
    setProvErr(e);
    if (Object.keys(e).length) return;
    onSaveProvisional({ name: provName.trim(), amount: a });
    setProvName(""); setProvAmt(""); setShowProvForm(false); setProvErr({});
  }

  // Style partagé pour une carte 4-col
  const card4 = (selKey, accentColor) => ({
    background: accentColor === "var(--danger)"
      ? "linear-gradient(135deg,rgba(200,112,112,.07),rgba(200,112,112,.02))"
      : accentColor === "var(--success)"
      ? "linear-gradient(135deg,rgba(104,212,152,.07),rgba(104,212,152,.02))"
      : "var(--card-bg, #1e1e2e)",
    borderRadius: 10,
    borderTop: `3px solid ${accentColor}`,
    padding: "8px 5px 6px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    cursor: "pointer",
    outline: selected === selKey ? `2px solid ${accentColor}` : "none",
    transition: "outline .1s",
    position: "relative",
  });

  return (
    <div>
      {/* ── Hero récap charges / revenus / net ── */}
      <div style={{
        background: "linear-gradient(135deg, #0c1830 0%, #182a48 100%)",
        borderRadius: 14, padding: "13px 16px", marginBottom: 12,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        boxShadow: "0 4px 18px rgba(112,184,224,.15)",
      }}>
        <div>
          <div style={{ fontSize: ".58rem", color: "rgba(255,255,255,.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>📌 Charges</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: "1.2rem", fontWeight: 800, color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>−{fmt(totalFixes)}</div>
          <div style={{ fontSize: ".55rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>{fixedExpenses.length} récurrentes</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: ".58rem", color: "rgba(255,255,255,.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>💰 Revenus fixes</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: "1.2rem", fontWeight: 800, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>+{fmt(totalIncomes)}</div>
          <div style={{ fontSize: ".55rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>{fixedIncomes.length} récurrents</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: ".58rem", color: "rgba(255,255,255,.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>= Net fixe</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: "1.2rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: totalIncomes - totalFixes >= 0 ? "var(--success)" : "var(--danger)" }}>
            {totalIncomes - totalFixes >= 0 ? "+" : "−"}{fmt(Math.abs(totalIncomes - totalFixes))}
          </div>
          {provTotal > 0 && <div style={{ fontSize: ".55rem", color: "var(--warning)", marginTop: 1 }}>−{fmt(provTotal)} prév.</div>}
        </div>
      </div>

      {/* ── Badge en pause ── */}
      {pausedCount > 0 && (
        <button onClick={() => setPauseFilterOn(v => !v)} style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
          padding: "6px 12px", borderRadius: 20, cursor: "pointer",
          background: pauseFilterOn ? "rgba(200,184,96,.18)" : "rgba(200,184,96,.1)",
          border: `1px solid ${pauseFilterOn ? "var(--warning)" : "rgba(200,184,96,.3)"}`,
          color: "var(--warning)", fontSize: ".66rem", fontWeight: 800,
        }}>
          ⏸️ {pausedCount} en pause {pauseFilterOn ? "· afficher tout" : ""}
        </button>
      )}

      {/* ── Onglets Charges / Revenus ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <button onClick={() => { setActiveSection("depenses"); setSelected(null); }} style={{
          padding: "11px 8px", borderRadius: 12, cursor: "pointer",
          border: `2px solid ${activeSection === "depenses" ? "var(--danger)" : "rgba(200,112,112,.25)"}`,
          background: activeSection === "depenses" ? "rgba(200,112,112,.12)" : "var(--surface2)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        }}>
          <span style={{ fontSize: "1.1rem" }}>📌</span>
          <span style={{ fontSize: ".68rem", fontWeight: 800, color: activeSection === "depenses" ? "var(--danger)" : "rgba(200,112,112,.55)" }}>Charges fixes</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: ".6rem", fontWeight: 700, color: "var(--danger)" }}>−{fmt(totalFixes)}</span>
        </button>
        <button onClick={() => { setActiveSection("revenus"); setSelected(null); }} style={{
          padding: "11px 8px", borderRadius: 12, cursor: "pointer",
          border: `2px solid ${activeSection === "revenus" ? "var(--success)" : "rgba(104,212,152,.25)"}`,
          background: activeSection === "revenus" ? "rgba(104,212,152,.12)" : "var(--surface2)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        }}>
          <span style={{ fontSize: "1.1rem" }}>💰</span>
          <span style={{ fontSize: ".68rem", fontWeight: 800, color: activeSection === "revenus" ? "var(--success)" : "rgba(104,212,152,.55)" }}>Revenus fixes</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: ".6rem", fontWeight: 700, color: "var(--success)" }}>+{fmt(totalIncomes)}</span>
        </button>
      </div>

      {/* ── Section Charges ── */}
      {activeSection === "depenses" && (
        fixedExpenses.length === 0
          ? <EmptyIllustration type="fixes" title="Aucune charge fixe" sub="Ajoute tes charges récurrentes pour les déduire automatiquement" cta="+ Ajouter" onCta={onNewFixed} ctaColor="var(--danger)" />
          : (() => {
            const visibleExp = fixedExpenses
              .map((f, idx) => ({ f, idx }))
              .filter(({ f }) => !pauseFilterOn || f.paused);
            return visibleExp.length === 0 ? (
              <div style={{ textAlign:"center", padding:"24px 0", color:"var(--text3)", fontSize:".72rem" }}>Aucune charge en pause</div>
            ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7, marginBottom: 10 }}>
              {visibleExp.map(({ f, idx }) => {
                const cat    = categories.find(c => c.id === f.categoryId);
                const selKey = f.id ?? idx;
                return (
                  <div key={selKey} style={{ ...card4(selKey, "var(--danger)"), opacity: f.paused ? .5 : 1 }}
                    onClick={() => setSelected(selected === selKey ? null : selKey)}>
                    <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>{cat?.icon ?? "📌"}</span>
                  {/* Nom sur 2 lignes max, jamais tronqué */}
                  <div style={{
                    fontSize: ".6rem", fontWeight: 700, color: "var(--text1)",
                    textAlign: "center", lineHeight: 1.3, wordBreak: "break-word",
                    width: "100%", padding: "0 2px",
                    minHeight: "2.6em", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {f.name}
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".65rem", color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(f.amount)}
                  </div>
                  {f.prevAmount != null && f.prevAmount !== f.amount && f.prevAmountYM !== currentYM() && (
                    <div style={{
                      fontSize: ".5rem", fontWeight: 800,
                      color: f.amount > f.prevAmount ? "var(--danger)" : "var(--success)",
                      display: "flex", alignItems: "center", gap: 2, marginTop: 1,
                    }}>
                      {f.amount > f.prevAmount ? "▲" : "▼"}
                      {Math.abs(f.amount - f.prevAmount).toFixed(2)} €
                    </div>
                  )}
                  {/* Badge en pause */}
                  {f.paused && (
                    <div style={{
                      fontSize: ".48rem", fontWeight: 700,
                      color: "var(--warning)", marginTop: 2,
                      background: "rgba(200,184,96,.12)", borderRadius: 3,
                      padding: "1px 4px", border: "1px solid rgba(200,184,96,.25)",
                    }}>
                      ⏸️ En pause{f.pausedUntil ? ` jusqu'à ${f.pausedUntil}` : ""}
                    </div>
                  )}
                  {/* Badge startYM */}
                  {f.startYM && !f.paused && (
                    <div style={{
                      fontSize: ".48rem", fontWeight: 700,
                      color: "var(--accent)", marginTop: 2,
                      background: "rgba(90,184,224,.1)", borderRadius: 3,
                      padding: "1px 4px", border: "1px solid rgba(90,184,224,.2)",
                    }}>
                      📅 {f.startYM}
                    </div>
                  )}
                  {/* Boutons visibles au tap uniquement */}
                  {selected === selKey && (
                    <div style={{ display: "flex", gap: 4, marginTop: 4, position: "relative" }}>
                      <button className="btn-action" style={{ fontSize: ".65rem", padding: "3px 6px" }}
                        onClick={e => { e.stopPropagation(); onQuickPauseFixed?.(idx); }}
                        onDoubleClick={e => e.stopPropagation()}
                        title={f.paused ? "Réactiver" : "Mettre en pause"}>{f.paused ? "▶️" : "⏸️"}</button>
                      {f.paused && (
                        <button className="btn-action" style={{ fontSize: ".65rem", padding: "3px 6px" }}
                          onClick={e => { e.stopPropagation(); setPauseTooltipId(v => v === selKey ? null : selKey); }}
                          title="Depuis quand ?">ℹ️</button>
                      )}
                      <button className="btn-action" style={{ fontSize: ".65rem", padding: "3px 6px" }}
                        onClick={e => { e.stopPropagation(); onEditFixed(idx); }}>✏️</button>
                      <button className="btn-action btn-del" style={{ fontSize: ".65rem", padding: "3px 6px" }}
                        onClick={e => { e.stopPropagation(); onDeleteFixed(idx); }}>✕</button>
                      {pauseTooltipId === selKey && f.paused && (
                        <div onClick={e => e.stopPropagation()} style={{
                          position: "absolute", top: 28, left: 0, zIndex: 20, width: 190,
                          background: "var(--surface3)", border: "1px solid var(--warning)", borderRadius: 10,
                          padding: "10px 12px", boxShadow: "0 8px 24px rgba(0,0,0,.5)",
                        }}>
                          <div style={{ fontSize: ".62rem", fontWeight: 800, color: "var(--warning)", marginBottom: 4 }}>
                            ⏸️ En pause depuis {f.pausedFrom || "?"}
                          </div>
                          <div style={{ fontSize: ".58rem", color: "var(--text2)", lineHeight: 1.5 }}>
                            {f.pausedUntil
                              ? `Reprend automatiquement après ${f.pausedUntil}.`
                              : "Aucune reprise programmée — réactive-la toi-même avec ▶️."}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          );
          })()
      )}

      {/* ── Bouton ajouter charge fixe ── */}
      {activeSection === "depenses" && (
        <button style={{
          width:"100%", padding:"11px", borderRadius:12, marginBottom:16,
          border:"2px dashed rgba(200,112,112,.35)",
          background:"rgba(200,112,112,.06)",
          color:"var(--danger)", fontSize:".75rem", fontWeight:700, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        }} onClick={onNewFixed}>
          <span style={{ fontSize:"1.1rem" }}>＋</span> Ajouter une charge fixe
        </button>
      )}

      {/* ── Section Revenus fixes ── */}
      {activeSection === "revenus" && (
        fixedIncomes.length === 0
          ? <EmptyIllustration type="fixes" title="Aucun revenu fixe" sub="Ajoute tes revenus récurrents (salaire, loyer perçu…)" cta="+ Ajouter" onCta={onNewFixedIncome} ctaColor="var(--success)" />
          : (() => {
            const visibleInc = fixedIncomes
              .map((f, idx) => ({ f, idx }))
              .filter(({ f }) => !pauseFilterOn || f.paused);
            return visibleInc.length === 0 ? (
              <div style={{ textAlign:"center", padding:"24px 0", color:"var(--text3)", fontSize:".72rem" }}>Aucun revenu en pause</div>
            ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7, marginBottom: 10 }}>
              {visibleInc.map(({ f, idx }) => {
                const cat    = categories.find(c => c.id === f.categoryId);
                const selKey = `inc_${f.id ?? idx}`;
                return (
                  <div key={selKey} style={{ ...card4(selKey, "var(--success)"), opacity: f.paused ? .5 : 1 }}
                    onClick={() => setSelected(selected === selKey ? null : selKey)}>
                    <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>{cat?.icon ?? "💰"}</span>
                    <div style={{
                      fontSize: ".6rem", fontWeight: 700, color: "var(--text1)",
                      textAlign: "center", lineHeight: 1.3, wordBreak: "break-word",
                      width: "100%", padding: "0 2px",
                      minHeight: "2.6em", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{f.name}</div>
                    <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".65rem", color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>
                      +{fmt(f.amount)}
                    </div>
                    {f.paused && (
                      <div style={{ fontSize:".48rem", fontWeight:700, color:"var(--warning)", marginTop:2, background:"rgba(200,184,96,.12)", borderRadius:3, padding:"1px 4px", border:"1px solid rgba(200,184,96,.25)" }}>
                        ⏸️ En pause{f.pausedUntil ? ` jusqu'à ${f.pausedUntil}` : ""}
                      </div>
                    )}
                    {f.startYM && !f.paused && (
                      <div style={{ fontSize:".48rem", fontWeight:700, color:"var(--accent)", marginTop:2, background:"rgba(90,184,224,.1)", borderRadius:3, padding:"1px 4px", border:"1px solid rgba(90,184,224,.2)" }}>
                        📅 {f.startYM}
                      </div>
                    )}
                    {selected === selKey && (
                      <div style={{ display: "flex", gap: 4, marginTop: 4, position: "relative" }}>
                        <button className="btn-action" style={{ fontSize: ".65rem", padding: "3px 6px" }}
                          onClick={e => { e.stopPropagation(); onQuickPauseIncome?.(idx); }}
                          title={f.paused ? "Réactiver" : "Mettre en pause"}>{f.paused ? "▶️" : "⏸️"}</button>
                        {f.paused && (
                          <button className="btn-action" style={{ fontSize: ".65rem", padding: "3px 6px" }}
                            onClick={e => { e.stopPropagation(); setPauseTooltipId(v => v === selKey ? null : selKey); }}
                            title="Depuis quand ?">ℹ️</button>
                        )}
                        <button className="btn-action" style={{ fontSize: ".65rem", padding: "3px 6px" }}
                          onClick={e => { e.stopPropagation(); onEditFixedIncome(idx); }}>✏️</button>
                        <button className="btn-action btn-del" style={{ fontSize: ".65rem", padding: "3px 6px" }}
                          onClick={e => { e.stopPropagation(); onDeleteFixedIncome(idx); }}>✕</button>
                        {pauseTooltipId === selKey && f.paused && (
                          <div onClick={e => e.stopPropagation()} style={{
                            position: "absolute", top: 28, left: 0, zIndex: 20, width: 190,
                            background: "var(--surface3)", border: "1px solid var(--warning)", borderRadius: 10,
                            padding: "10px 12px", boxShadow: "0 8px 24px rgba(0,0,0,.5)",
                          }}>
                            <div style={{ fontSize: ".62rem", fontWeight: 800, color: "var(--warning)", marginBottom: 4 }}>
                              ⏸️ En pause depuis {f.pausedFrom || "?"}
                            </div>
                            <div style={{ fontSize: ".58rem", color: "var(--text2)", lineHeight: 1.5 }}>
                              {f.pausedUntil
                                ? `Reprend automatiquement après ${f.pausedUntil}.`
                                : "Aucune reprise programmée — réactive-le toi-même avec ▶️."}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            );
          })()
      )}

      {/* ── Bouton ajouter revenu fixe ── */}
      {activeSection === "revenus" && (
        <button style={{
          width:"100%", padding:"11px", borderRadius:12, marginBottom:16,
          border:"2px dashed rgba(104,212,152,.35)",
          background:"rgba(104,212,152,.06)",
          color:"var(--success)", fontSize:".75rem", fontWeight:700, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        }} onClick={onNewFixedIncome}>
          <span style={{ fontSize:"1.1rem" }}>＋</span> Ajouter un revenu fixe
        </button>
      )}

      {/* ── Section prévisionnels ── */}
      <SectionTitle style={{ marginTop: 4 }}>🔮 Frais prévisionnels</SectionTitle>
      <div className="card" style={{
        fontSize: ".75rem", color: "var(--text2)",
        borderLeft: "3px solid var(--warning)", background: "var(--warning-glow)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10,
      }}>
        <span>Dépenses ponctuelles — déduites du solde estimé.</span>
        {provTotal > 0 && (
          <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--warning)", fontVariantNumeric: "tabular-nums", flexShrink: 0, marginLeft: 10 }}>
            −{fmt(provTotal)}
          </span>
        )}
      </div>

      {/* ── Grille 4 colonnes — prévisionnels ── */}
      {provisionalExpenses.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7, marginBottom: 10 }}>
          {provisionalExpenses.map(p => {
            const selKey = `p_${p.id}`;
            return (
              <div key={p.id} style={card4(selKey, "var(--warning)")}
                onClick={() => setSelected(selected === selKey ? null : selKey)}>
                <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>📋</span>
                <div style={{
                  fontSize: ".6rem", fontWeight: 700, color: "var(--text1)",
                  textAlign: "center", lineHeight: 1.3, wordBreak: "break-word",
                  width: "100%", padding: "0 2px",
                  minHeight: "2.6em", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {p.name}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".65rem", color: "var(--warning)", fontVariantNumeric: "tabular-nums" }}>
                  −{fmt(p.amount)}
                </div>
                {selected === selKey && (
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <button className="btn-action btn-del" style={{ fontSize: ".65rem", padding: "3px 6px" }}
                      onClick={e => { e.stopPropagation(); onDeleteProvisional(p.id); }}>✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Formulaire / bouton ajout prévision ── */}
      {showProvForm ? (
        <div className="card" style={{ padding: 14, borderLeft: "3px solid var(--warning)", background: "var(--warning-glow)" }}>
          <div className="form-group">
            <label>Nom</label>
            <input type="text" value={provName} placeholder="Ex : Réparation voiture"
              className={provErr.name ? "error" : ""}
              onChange={e => { setProvName(e.target.value); setProvErr(v => ({...v, name: ""})); }} />
            {provErr.name && <div className="field-error">⚠ {provErr.name}</div>}
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Montant (€)</label>
            <input type="number" step="0.01" min="0" value={provAmt}
              className={provErr.amt ? "error" : ""}
              onChange={e => { setProvAmt(e.target.value); setProvErr(v => ({...v, amt: ""})); }} />
            {provErr.amt && <div className="field-error">⚠ {provErr.amt}</div>}
          </div>
          <div className="grid-2" style={{ marginTop: 12, marginBottom: 0 }}>
            <button className="btn btn-outline" style={{ width: "100%" }}
              onClick={() => { setShowProvForm(false); setProvName(""); setProvAmt(""); setProvErr({}); }}>
              Annuler
            </button>
            <button className="btn btn-primary" style={{ width: "100%", background: "var(--warning)" }}
              onClick={handleAddProv}>
              Ajouter
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-outline"
          style={{ width: "100%", borderColor: "var(--warning)", color: "var(--warning)" }}
          onClick={() => setShowProvForm(true)}>
          + Ajouter une prévision
        </button>
      )}
    </div>
  );
}
