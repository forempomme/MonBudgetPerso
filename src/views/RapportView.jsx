// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useMemo, useEffect } from "react";
import { ChartSVG, PatrimoineSVG } from "../components/charts.jsx";
import { fmt, currentYM, getPrevMonth, isIncome, PALETTE, touchMoved } from "../utils.js";
import { useYearMonths, useYearTotals, computeMonthTotals, computePeriodTotals, useTotalFixes, isActiveForMonth, isIncomeDirection, computeTagBudgets, computeSidePaidByCategory, catRootId, catFamilyIds, computeMonthRecap, categorySpentForMonth, firstDataYM, livedMonths, computeCategoryBreakdown } from "../hooks.js";
import { MonthRecapSheet } from "./MonthRecapSheet.jsx";
import { SectionTitle, TagsModal, TagBudgetBars, MONTHS_FR } from "./shared.jsx";

// ─────────────────────────────────────────────────────────────────
//  RAPPORT — Comparaison de deux périodes
// ─────────────────────────────────────────────────────────────────
function PeriodCompare({ transactions, fixedExpenses }) {
  const now = new Date();
  const [p1, setP1] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
  const [p2, setP2] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });
  const curYM = currentYM();
  const tf    = useTotalFixes(fixedExpenses, curYM);

  const months = useMemo(() => {
    const list = [];
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
    }
    return list;
  }, []);

  function stats(ym) {
    let inc = 0, exp = 0, sav = 0;
    transactions.filter(t => t.date.startsWith(ym)).forEach(t => {
      const a = parseFloat(t.amount) || 0;
      if (isIncome(t.type))          inc += a;
      else if (t.type === "expense") exp += a;
      else if (t.type === "epargne") sav += a;
    });
    if (ym === curYM) exp += tf;
    return { inc, exp, sav, net: inc - exp };
  }

  const d1 = stats(p1), d2 = stats(p2);
  const rows = [
    { label: "💰 Revenus",  v1: d1.inc, v2: d2.inc, higher: true  },
    { label: "💸 Dépenses", v1: d1.exp, v2: d2.exp, higher: false },
    { label: "🐷 Épargne",  v1: d1.sav, v2: d2.sav, higher: true  },
    { label: "📊 Solde",    v1: d1.net, v2: d2.net, higher: true  },
  ];

  return (
    <div className="card" style={{ padding: 14 }}>
      <SectionTitle style={{ marginBottom: 12 }}>🔀 Comparaison de périodes</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[[p1,setP1,"var(--accent)","Période A"],[p2,setP2,"var(--purple)","Période B"]].map(([val,setter,col,lbl]) => (
          <div key={lbl}>
            <div style={{ fontSize:".58rem", color:col, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", marginBottom:5 }}>{lbl}</div>
            <select value={val} onChange={e => setter(e.target.value)} style={{
              width:"100%", background:"var(--bg)", border:`1.5px solid ${col}`,
              borderRadius:9, padding:"7px 10px", color:"var(--text)", fontSize:".7rem", fontFamily:"var(--mono)",
            }}>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div style={{ background:"var(--surface2)", borderRadius:10, overflow:"hidden", marginBottom:12 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", background:"var(--surface3)", padding:"7px 12px", borderBottom:`1px solid var(--border)` }}>
          {[["Poste","var(--text3)","left"],["p1","var(--accent)","right"],["p2","var(--purple)","right"],["Écart","var(--text3)","right"]].map(([l,c,a],i) => (
            <div key={i} style={{ fontSize:".55rem", color:c, fontWeight:800, textTransform:"uppercase", textAlign:a }}>
              {l==="p1"?p1:l==="p2"?p2:l}
            </div>
          ))}
        </div>
        {rows.map((r,i) => {
          const diff  = r.v1 - r.v2;
          const pct   = r.v2 !== 0 ? Math.abs((diff/Math.abs(r.v2))*100).toFixed(0) : "—";
          const good  = Math.abs(diff)<0.01 ? null : r.higher ? diff>0 : diff<0;
          const col   = good===null ? "var(--text3)" : good ? "var(--success)" : "var(--danger)";
          const arrow = diff>0?"▲":diff<0?"▼":"—";
          const net   = r.label.includes("Solde");
          return (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", padding:"9px 12px", borderBottom:i<rows.length-1?"1px solid var(--border-soft)":"none", alignItems:"center" }}>
              <div style={{ fontSize:".68rem", fontWeight:700 }}>{r.label}</div>
              <div style={{ fontFamily:"var(--mono)", fontWeight:800, color:"var(--accent)", fontSize:".65rem", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{net&&r.v1>=0?"+":""}{fmt(r.v1)}</div>
              <div style={{ fontFamily:"var(--mono)", fontWeight:800, color:"var(--purple)", fontSize:".65rem", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{net&&r.v2>=0?"+":""}{fmt(r.v2)}</div>
              <div style={{ textAlign:"right" }}><span style={{ fontSize:".6rem", fontWeight:800, color:col }}>{arrow} {pct}%</span></div>
            </div>
          );
        })}
      </div>
      {rows.slice(0,2).map(r => {
        const max = Math.max(r.v1, r.v2, 1);
        return (
          <div key={r.label} style={{ marginBottom:8 }}>
            <div style={{ fontSize:".58rem", color:"var(--text3)", fontWeight:700, marginBottom:4 }}>{r.label}</div>
            {[[r.v1,"var(--accent)",p1],[r.v2,"var(--purple)",p2]].map(([v,c,l]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                <span style={{ fontSize:".52rem", color:c, width:52, flexShrink:0 }}>{l}</span>
                <div style={{ flex:1, height:5, background:"var(--surface3)", borderRadius:99 }}>
                  <div style={{ width:`${(v/max)*100}%`, height:"100%", background:c, borderRadius:99, transition:"width .4s" }}/>
                </div>
                <span style={{ fontFamily:"var(--mono)", fontSize:".55rem", color:c, width:58, textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{fmt(v)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  RAPPORT — Notes sur les mois
// ─────────────────────────────────────────────────────────────────
function MonthNotes({ currentYear, monthNotes, onSave }) {
  const [editing, setEditing] = useState(null);
  const [draft,   setDraft]   = useState("");
  const now   = new Date();
  const maxMo = currentYear === now.getFullYear() ? now.getMonth() : 11;
  const months = Array.from({ length: maxMo + 1 }, (_, i) => {
    const m = maxMo - i;
    return `${currentYear}-${String(m + 1).padStart(2, "0")}`;
  });
  return (
    <div className="card" style={{ padding: 14 }}>
      <SectionTitle style={{ marginBottom: 12 }}>📝 Notes sur les mois</SectionTitle>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {months.map(ym => {
          const note   = monthNotes[ym] || "";
          const isEdit = editing === ym;
          const label  = new Date(ym + "-01T12:00:00")
            .toLocaleDateString("fr-FR", { month:"long", year:"numeric" });
          return (
            <div key={ym} style={{ background:"var(--surface2)", borderRadius:10, padding:"10px 12px", borderLeft:`3px solid ${note?"var(--accent)":"var(--border)"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:(isEdit||note)?8:0 }}>
                <span style={{ fontSize:".7rem", fontWeight:800, color:note?"var(--accent)":"var(--text3)", textTransform:"capitalize" }}>{label}</span>
                {!isEdit && (
                  <button onClick={() => { setDraft(note); setEditing(ym); }} style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:6, padding:"3px 8px", color:"var(--text2)", fontSize:".6rem", cursor:"pointer" }}>
                    {note?"✏️ Modifier":"+ Note"}
                  </button>
                )}
              </div>
              {isEdit ? (
                <div>
                  <textarea value={draft} onChange={e => setDraft(e.target.value)}
                    placeholder="Ex : Vacances Italie, prime exceptionnelle..."
                    rows={2} style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--accent)", borderRadius:8, padding:"7px 10px", color:"var(--text)", fontSize:".72rem", resize:"none", fontFamily:"inherit", boxSizing:"border-box" }} autoFocus/>
                  <div style={{ display:"flex", gap:6, marginTop:6 }}>
                    <button onClick={() => setEditing(null)} style={{ flex:1, background:"transparent", border:"1px solid var(--border)", borderRadius:7, padding:"6px 0", color:"var(--text2)", fontSize:".65rem", fontWeight:700, cursor:"pointer" }}>Annuler</button>
                    <button onClick={() => { onSave(ym, draft); setEditing(null); }} style={{ flex:1, background:"var(--accent)", border:"none", borderRadius:7, padding:"6px 0", color:"var(--bg)", fontSize:".65rem", fontWeight:800, cursor:"pointer" }}>Enregistrer</button>
                  </div>
                </div>
              ) : note ? (
                <div style={{ fontSize:".7rem", color:"var(--text)", lineHeight:1.5 }}>💬 {note}</div>
              ) : (
                <div style={{ fontSize:".62rem", color:"var(--text3)", fontStyle:"italic" }}>Aucune note</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Modal taux d'épargne
// ─────────────────────────────────────────────────────────────────
function SavingsRateModal({ onClose, transactions, fixedExpenses, fixedIncomes = [], currentYear }) {
  const now = new Date();

  // 6 derniers mois
  const months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d  = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "short" });
      // v1.47.1 : revenus fixes inclus (même calcul que partout)
      const { inc, sav } = computeMonthTotals(transactions, fixedExpenses, fixedIncomes, ym);
      const rate = inc > 0 ? (sav / inc) * 100 : 0;
      return { ym, label, inc, sav, rate };
    });
  }, [transactions]);

  const curRate  = months[months.length - 1]?.rate ?? 0;
  const avgRate  = months.reduce((s, m) => s + m.rate, 0) / (months.length || 1);
  const maxRate  = Math.max(...months.map(m => m.rate), 1);
  const R = 52, cx = 60, cy = 60, stroke = 12;
  const circ  = 2 * Math.PI * R;
  const dash  = Math.min(curRate / 100, 1) * circ;
  const color = curRate >= 20 ? "var(--success)" : curRate >= 10 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div className="modal-title">📊 Taux d'épargne</div>

        {/* Jauge + stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--surface3)" strokeWidth={stroke} />
            <circle cx={cx} cy={cy} r={R} fill="none"
              stroke={color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`} />
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill={color}>{Math.round(curRate)}%</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="var(--text2)">ce mois</text>
          </svg>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { l: "🐷 Épargné ce mois",   v: fmt(months[months.length-1]?.sav ?? 0),   c: "var(--purple)"  },
              { l: "💰 Revenus ce mois",    v: fmt(months[months.length-1]?.inc ?? 0),   c: "var(--success)" },
              { l: "📈 Moy. 6 mois",        v: `${avgRate.toFixed(1)}%`,                  c: "var(--accent)"  },
            ].map(s => (
              <div key={s.l} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: ".62rem", color: "var(--text2)" }}>{s.l}</span>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: s.c, fontSize: ".68rem" }}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Barres par mois */}
        <div style={{ fontSize: ".62rem", fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
          Évolution sur 6 mois
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {months.map(m => {
            const col = m.rate >= 20 ? "var(--success)" : m.rate >= 10 ? "var(--warning)" : m.rate > 0 ? "var(--danger)" : "var(--border)";
            return (
              <div key={m.ym} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: ".65rem", fontWeight: 700, width: 28, flexShrink: 0, textTransform: "capitalize" }}>{m.label}</span>
                <div style={{ flex: 1, height: 7, background: "var(--surface3)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${m.rate > 0 ? (m.rate / Math.max(maxRate, 20)) * 100 : 0}%`, height: "100%", background: col, borderRadius: 99, transition: "width .4s" }} />
                </div>
                <span style={{ fontFamily: "var(--mono)", fontSize: ".65rem", fontWeight: 800, color: col, width: 36, textAlign: "right" }}>
                  {m.rate > 0 ? `${m.rate.toFixed(0)}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Objectif */}
        <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: ".68rem", color: "var(--text2)" }}>🎯 Objectif recommandé</span>
          <span style={{ fontSize: ".72rem", fontWeight: 800, color: avgRate >= 20 ? "var(--success)" : "var(--warning)" }}>
            {avgRate >= 20 ? "✅ 20% atteint" : `${(20 - avgRate).toFixed(1)}% à gagner`}
          </span>
        </div>

        <button className="btn btn-outline" style={{ width: "100%", marginTop: 12 }} onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Modal suivi des catégories
// ─────────────────────────────────────────────────────────────────
function SuiviModal({ onClose, categories, transactions, fixedExpenses, thresholds, onSaveThreshold }) {
  const [tab,    setTab]    = useState("suivi");
  const [editId, setEditId] = useState(null);
  const [draft,  setDraft]  = useState("");

  const curYM = currentYM();

  // Dépenses du mois courant par catégorie (transactions + frais fixes)
  const spentBycat = useMemo(() => {
    const map = {};
    transactions
      .filter(t => t.date.startsWith(curYM) && t.type === "expense")
      .forEach(t => add(t.categoryId, parseFloat(t.amount) || 0));
    fixedExpenses.forEach(f => {
      if (!isActiveForMonth(f, curYM)) return;
      const ov = f.monthlyOverrides?.[curYM];
      add(f.categoryId, (ov?.amount ?? f.amount) || 0);
    });
    return map;
    // v1.47.0 : une dépense en sous-catégorie compte aussi dans le seuil de sa catégorie principale
    function add(id, a) {
      map[id] = (map[id] || 0) + a;
      const root = catRootId(categories, id);
      if (root && root !== id) map[root] = (map[root] || 0) + a;
    }
  }, [transactions, fixedExpenses, curYM, categories]);

  const tracked = categories.filter(c => thresholds[c.id] > 0);

  function saveThreshold(id) {
    const v = parseFloat(draft);
    onSaveThreshold?.(id, isNaN(v) || v <= 0 ? 0 : v);
    setEditId(null); setDraft("");
  }

  return (
    <div className="modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div className="modal-title" style={{ marginBottom: 0 }}>🎯 Suivi des catégories</div>
            <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 2 }}>
              {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "var(--text2)", cursor: "pointer", fontSize: ".75rem" }}>✕</button>
        </div>

        {/* Onglets internes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
          {[["suivi","📊 Suivi du mois"],["config","⚙️ Configurer"]].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              background: tab===k ? "rgba(112,184,224,.1)" : "transparent",
              border: `1.5px solid ${tab===k ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 10, padding: "9px 0",
              color: tab===k ? "var(--accent)" : "var(--text2)",
              fontWeight: 700, fontSize: ".7rem", cursor: "pointer",
            }}>{l}</button>
          ))}
        </div>

        {/* ── SUIVI ── */}
        {tab === "suivi" && (
          tracked.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: "2rem", marginBottom: 10 }}>🎯</div>
              <div style={{ fontSize: ".78rem", fontWeight: 700, marginBottom: 6 }}>Aucune catégorie suivie</div>
              <div style={{ fontSize: ".65rem", color: "var(--text3)", marginBottom: 14 }}>Configure des seuils dans l'onglet ⚙️</div>
              <button onClick={() => setTab("config")} style={{ background: "var(--accent)", border: "none", borderRadius: 9, padding: "9px 20px", color: "var(--bg)", fontWeight: 800, fontSize: ".72rem", cursor: "pointer" }}>
                Configurer →
              </button>
            </div>
          ) : (
            <div>
              {/* Résumé 3 chiffres */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 14 }}>
                {[
                  { l: "Suivies",   v: tracked.length,                                                          c: "var(--accent)" },
                  { l: "Dépassées", v: tracked.filter(c => (spentBycat[c.id]||0) >= thresholds[c.id]).length,   c: "var(--danger)" },
                  { l: "Proches",   v: tracked.filter(c => { const p=(spentBycat[c.id]||0)/thresholds[c.id]; return p>=.8&&p<1; }).length, c: "var(--warning)" },
                ].map(s => (
                  <div key={s.l} style={{ background: "var(--surface2)", borderRadius: 9, padding: "8px 0", textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: "1.1rem", color: s.c }}>{s.v}</div>
                    <div style={{ fontSize: ".55rem", color: "var(--text3)", marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Cartes par catégorie suivie */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tracked.map(cat => {
                  const spent    = spentBycat[cat.id] || 0;
                  const limit    = thresholds[cat.id];
                  const pct      = Math.min(spent / limit * 100, 100);
                  const over     = spent >= limit;
                  const near     = !over && pct >= 80;
                  const barColor = over ? "var(--danger)" : near ? "var(--warning)" : (cat.color || "var(--accent)");
                  return (
                    <div key={cat.id} style={{
                      background: "var(--bg)", borderRadius: 12, padding: "12px 14px",
                      border: `1px solid ${over ? "rgba(200,112,112,.35)" : "var(--border)"}`,
                      borderLeft: `3px solid ${barColor}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontSize: ".9rem" }}>{cat.icon}</span>
                          <span style={{ fontSize: ".73rem", fontWeight: 700 }}>{cat.name}</span>
                        </div>
                        {over
                          ? <span style={{ fontSize: ".52rem", background: "rgba(200,112,112,.2)", color: "var(--danger)", padding: "2px 7px", borderRadius: 20, fontWeight: 800 }}>⚠️ Dépassé</span>
                          : near
                            ? <span style={{ fontSize: ".52rem", background: "rgba(200,184,96,.15)", color: "var(--warning)", padding: "2px 7px", borderRadius: 20, fontWeight: 800 }}>⚡ Proche</span>
                            : <span style={{ fontSize: ".52rem", background: "rgba(104,212,152,.1)", color: "var(--success)", padding: "2px 7px", borderRadius: 20, fontWeight: 800 }}>✓ OK</span>
                        }
                      </div>
                      <div style={{ height: 6, background: "var(--surface2)", borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 99 }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".63rem" }}>
                        <span style={{ color: "var(--text2)" }}>
                          <strong style={{ color: barColor }}>{fmt(spent)}</strong> dépensés
                        </span>
                        <span style={{ color: over ? "var(--danger)" : "var(--text3)" }}>
                          {over
                            ? <><strong style={{ color: "var(--danger)" }}>+{fmt(spent - limit)}</strong> dépassé</>
                            : <><strong style={{ color: "var(--success)" }}>{fmt(limit - spent)}</strong> restants</>
                          }
                        </span>
                        <span style={{ color: "var(--text3)" }}>/ {fmt(limit)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* ── CONFIGURATION ── */}
        {tab === "config" && (
          <div>
            <div style={{ fontSize: ".62rem", color: "var(--text3)", lineHeight: 1.5, marginBottom: 12 }}>
              Définis un seuil mensuel par catégorie. Tu seras alerté si tu t'en approches ou le dépasses.
            </div>
            <div style={{ background: "var(--bg)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
              {categories.map((cat, i) => (
                <div key={cat.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 14px",
                  borderBottom: i < categories.length - 1 ? "1px solid rgba(30,46,72,.5)" : "none",
                }}>
                  <span style={{ fontSize: ".9rem", width: 24, textAlign: "center" }}>{cat.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: ".72rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</div>
                    {thresholds[cat.id] > 0 && editId !== cat.id && (
                      <div style={{ fontSize: ".58rem", color: "var(--accent)", marginTop: 1 }}>Seuil : {fmt(thresholds[cat.id])}</div>
                    )}
                  </div>
                  {editId === cat.id ? (
                    <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                      <input type="number" value={draft} min="0" step="10"
                        onChange={e => setDraft(e.target.value)}
                        placeholder="€ / mois"
                        style={{ width: 80, background: "var(--surface2)", border: "1.5px solid var(--accent)", borderRadius: 7, padding: "6px 8px", color: "var(--text)", fontSize: ".78rem", fontFamily: "var(--mono)" }} />
                      <button
                        onTouchStart={e => e.stopPropagation()}
                        onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); saveThreshold(cat.id); }}
                        onClick={() => saveThreshold(cat.id)}
                        style={{ background: "var(--accent)", border: "none", borderRadius: 7, padding: "7px 10px", color: "var(--bg)", fontWeight: 800, fontSize: ".75rem", cursor: "pointer", minHeight: 32, touchAction: "manipulation" }}>✓</button>
                      <button
                        onTouchStart={e => e.stopPropagation()}
                        onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); setEditId(null); }}
                        onClick={() => setEditId(null)}
                        style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 9px", color: "var(--text3)", fontSize: ".75rem", cursor: "pointer", minHeight: 32, touchAction: "manipulation" }}>✕</button>
                    </div>
                  ) : (
                    <button
                      onTouchStart={e => e.stopPropagation()}
                      onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); setEditId(cat.id); setDraft(thresholds[cat.id] > 0 ? String(thresholds[cat.id]) : ""); }}
                      onClick={() => { setEditId(cat.id); setDraft(thresholds[cat.id] > 0 ? String(thresholds[cat.id]) : ""); }}
                      style={{
                        background: thresholds[cat.id] > 0 ? "rgba(112,184,224,.1)" : "transparent",
                        border: `1px solid ${thresholds[cat.id] > 0 ? "var(--accent)" : "var(--border)"}`,
                        borderRadius: 8, padding: "6px 10px", flexShrink: 0,
                        color: thresholds[cat.id] > 0 ? "var(--accent)" : "var(--text3)",
                        fontSize: ".68rem", fontWeight: thresholds[cat.id] > 0 ? 700 : 400,
                        cursor: "pointer", minHeight: 32, touchAction: "manipulation",
                      }}>
                      {thresholds[cat.id] > 0 ? `✏️ ${fmt(thresholds[cat.id])}` : "＋ Ajouter"}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 8, textAlign: "center" }}>
              Vide ou 0 = pas de suivi pour cette catégorie
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Helper : résoudre les déductions liées pour une catégorie
// ─────────────────────────────────────────────────────────────────
function getLinkedIncomeForCat(catId, categories, transactions, period) {
  // Catégories qui pointent vers catId (liaison "Remboursement courses" → "Courses")
  const linkedCatIds = categories
    .filter(c => c.linkedToId === catId)
    .map(c => c.id);
  // Aussi : revenus avec exactement la même catégorie (ancien comportement)
  return transactions
    .filter(t => {
      if (!t.date.startsWith(period)) return false;
      if (!isIncome(t.type) || t.type === "dissolution_cagnotte") return false;
      return t.categoryId === catId || linkedCatIds.includes(t.categoryId);
    })
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
}

// ─────────────────────────────────────────────────────────────────
//  Modal détail catégorie
// ─────────────────────────────────────────────────────────────────
function CategoryDetailModal({ onClose, categories, transactions, fixedExpenses, initialCatId }) {
  const now       = new Date();
  const curYM     = currentYM();
  const [selCatId, setSelCatId] = useState(initialCatId || categories[0]?.id || "");

  const cat = categories.find(c => c.id === selCatId);
  // v1.47.0 : une catégorie principale inclut ses sous-catégories
  const fam = useMemo(() => catFamilyIds(categories, selCatId), [categories, selCatId]);

  // Catégories liées à celle sélectionnée
  const linkedCats = categories.filter(c => c.linkedToId === selCatId);

  // Premier mois d'utilisation (première transaction)
  const startYM = useMemo(() => {
    if (!transactions.length) return currentYM();
    return transactions.reduce((min, t) => t.date < min ? t.date : min, transactions[0].date).slice(0, 7);
  }, [transactions]);

  // 6 derniers mois de stats — frais fixes uniquement depuis startYM et jusqu'au mois courant
  const monthStats = useMemo(() => {
    const curYM = currentYM();
    return Array.from({ length: 6 }, (_, i) => {
      const d      = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const ym     = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const inRange = ym >= startYM && ym <= curYM;
      const exp    = transactions
        .filter(t => t.date.startsWith(ym) && t.type === "expense" && fam.includes(t.categoryId))
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const fixExp = inRange ? fixedExpenses
        .filter(f => fam.includes(f.categoryId) && isActiveForMonth(f, ym))
        .reduce((s, f) => { const ov = f.monthlyOverrides?.[ym]; return s + ((ov?.amount ?? f.amount) || 0); }, 0) : 0;
      const inc    = getLinkedIncomeForCat(selCatId, categories, transactions, ym);
      const total  = exp + fixExp;
      return { ym, label: d.toLocaleDateString("fr-FR", { month: "short" }), exp: total, fixExp, inc, net: Math.max(0, total - inc) };
    });
  }, [selCatId, transactions, fixedExpenses, categories, startYM]);

  // Totaux année — frais fixes depuis startYM jusqu'au mois courant inclus
  const yearStr       = now.getFullYear().toString();
  const monthsElapsed = now.getMonth() + 1;
  const yearExp    = transactions
    .filter(t => t.date.startsWith(yearStr) && t.type === "expense" && fam.includes(t.categoryId))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const yearFixExp = fixedExpenses
    .filter(f => fam.includes(f.categoryId))
    .reduce((s, f) => {
      let total = 0;
      for (let m = 1; m <= monthsElapsed; m++) {
        const ym = `${yearStr}-${String(m).padStart(2, "0")}`;
        if (ym < startYM) continue; // avant le démarrage de l'app
        if (!isActiveForMonth(f, ym)) continue; // avant le démarrage ou en pause pour ce frais précis
        const ov = f.monthlyOverrides?.[ym];
        total += (ov?.amount ?? f.amount) || 0;
      }
      return s + total;
    }, 0);
  const yearTotal  = yearExp + yearFixExp;
  const yearInc    = getLinkedIncomeForCat(selCatId, categories, transactions, yearStr);
  const yearNet    = Math.max(0, yearTotal - yearInc);
  const txCount    = transactions.filter(t => t.date.startsWith(yearStr) && fam.includes(t.categoryId)).length;
  const fixBaseAmount = fixedExpenses
    .filter(f => fam.includes(f.categoryId))
    .reduce((s, f) => s + (f.amount || 0), 0);

  // Top 5 transactions récentes
  const recent = [...transactions]
    .filter(t => fam.includes(t.categoryId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const maxNet = Math.max(...monthStats.map(m => m.exp), 1);

  return (
    <div className="modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div className="modal-title">📊 Analyse par catégorie</div>

        {/* Sélecteur */}
        <div style={{ marginBottom: 14 }}>
          <select value={selCatId} onChange={e => setSelCatId(e.target.value)}
            style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--accent)", borderRadius: 9, padding: "9px 12px", color: "var(--text)", fontSize: ".82rem" }}>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        {cat && (<>
          {/* Catégorie liée */}
          {linkedCats.length > 0 && (
            <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
              {linkedCats.map(lc => (
                <div key={lc.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", background: "rgba(104,212,152,.1)", border: "1px solid rgba(104,212,152,.25)", borderRadius: 20, fontSize: ".62rem", color: "var(--success)" }}>
                  🔗 Déductions depuis : <strong>{lc.icon} {lc.name}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Totaux année */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: yearFixExp > 0 ? 6 : 14 }}>
            {[
              { l: "💸 Dépensé", v: yearTotal, c: "var(--danger)" },
              { l: "↩ Récupéré", v: yearInc,   c: "var(--success)", hidden: yearInc === 0 },
              { l: "📊 Net",     v: yearNet,    c: yearInc > 0 ? "var(--accent)" : "var(--warning)" },
            ].map(s => (
              <div key={s.l} style={{ background: "var(--surface2)", borderRadius: 9, padding: "8px 10px", opacity: s.hidden ? .35 : 1 }}>
                <div style={{ fontSize: ".55rem", color: "var(--text2)", fontWeight: 700, marginBottom: 3 }}>{s.l}</div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 800, color: s.c, fontSize: ".78rem", fontVariantNumeric: "tabular-nums" }}>{fmt(s.v)}</div>
              </div>
            ))}
          </div>
          {yearFixExp > 0 && (() => {
            const fixes = fixedExpenses.filter(f => fam.includes(f.categoryId));
            // Nombre de mois propre à CHAQUE frais (peut différer d'un frais à l'autre
            // dans la même catégorie si l'un a démarré plus tard que l'autre)
            const monthsForFix = (f) => Array.from({ length: monthsElapsed }, (_, i) => {
              const ym = `${yearStr}-${String(i + 1).padStart(2, "0")}`;
              return ym >= startYM && isActiveForMonth(f, ym) ? 1 : 0;
            }).reduce((s, v) => s + v, 0);
            return (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: ".6rem", color: "var(--warning)", padding: "5px 9px", background: "var(--warning-glow)", borderRadius: "6px 6px 0 0" }}>
                  📌 Dont {fmt(yearFixExp)} de frais fixes
                </div>
                <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 6px 6px", padding: "6px 9px", display: "flex", flexDirection: "column", gap: 3 }}>
                  {fixes.map(f => {
                    const nMonths = monthsForFix(f);
                    return (
                      <div key={f.id} style={{ display: "flex", justifyContent: "space-between", fontSize: ".6rem" }}>
                        <span style={{ color: "var(--text2)" }}>• {f.name}</span>
                        <span style={{ fontFamily: "var(--mono)", color: "var(--warning)", fontWeight: 700 }}>{nMonths} × {fmt(f.amount)} = {fmt(f.amount * nMonths)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {(() => {
            const activeMonths = monthStats.filter(m => m.exp > 0).length;
            const avg = activeMonths > 0 ? yearTotal / activeMonths : 0;
            return (
              <div style={{ fontSize: ".6rem", color: "var(--text3)", marginBottom: 12 }}>
                {txCount} transaction{txCount !== 1 ? "s" : ""} cette année · moy. {fmt(avg)}/mois actif
              </div>
            );
          })()}

          {/* Barres 6 mois */}
          <div style={{ fontSize: ".62rem", fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>Évolution 6 mois</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {monthStats.map(m => (
              <div key={m.ym} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: ".65rem", fontWeight: 700, width: 28, flexShrink: 0, textTransform: "capitalize" }}>{m.label}</span>
                <div style={{ flex: 1, position: "relative", height: 12 }}>
                  {/* Barre dépense */}
                  <div style={{ position: "absolute", inset: 0, background: "var(--surface3)", borderRadius: 99 }} />
                  <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${(m.exp / maxNet * 100)}%`, background: "var(--danger)", borderRadius: 99, opacity: .7 }} />
                  {/* Barre net (par dessus) */}
                  {m.inc > 0 && (
                    <div style={{ position: "absolute", top: 2, left: 0, height: "calc(100% - 4px)", width: `${(m.net / maxNet * 100)}%`, background: "var(--accent)", borderRadius: 99 }} />
                  )}
                </div>
                <div style={{ width: 72, textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: ".65rem", fontWeight: 800, color: m.net > 0 ? (m.inc > 0 ? "var(--accent)" : "var(--danger)") : "var(--text3)" }}>
                    {m.net > 0 ? fmt(m.net) : "—"}
                  </span>
                  {m.inc > 0 && <div style={{ fontSize: ".52rem", color: "var(--success)" }}>↩ {fmt(m.inc)}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Transactions récentes */}
          {recent.length > 0 && (<>
            <div style={{ fontSize: ".62rem", fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Dernières opérations</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border)" }}>
              {recent.map((t, i) => {
                const isInc = isIncomeDirection(t);
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: i < recent.length-1 ? "1px solid var(--border-soft)" : "none", background: "var(--surface)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: ".7rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.note || "—"}</div>
                      <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 1 }}>{t.date}</div>
                    </div>
                    <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".75rem", color: isInc ? "var(--success)" : "var(--danger)", flexShrink: 0 }}>
                      {isInc ? "+" : "−"}{fmt(t.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>)}
        </>)}

        <button className="btn btn-outline" style={{ width: "100%", marginTop: 14 }} onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  RAPPORT — helpers locaux
// ─────────────────────────────────────────────────────────────────
function RapportDonut({ inc, exp, sav }) {
  const total = inc + exp + sav || 1;
  const R = 38, cx = 46, cy = 46, stroke = 11, size = 92;
  const circ = 2 * Math.PI * R;
  let offset = 0;
  const segs = [
    { pct: inc/total, c: "var(--success)" },
    { pct: exp/total, c: "var(--danger)"  },
    { pct: sav/total, c: "var(--purple)"  },
  ].map(s => {
    const dash = s.pct * circ, gap = circ - dash;
    const rot  = offset * 360 - 90;
    offset    += s.pct;
    return { ...s, dash, gap, rot };
  });
  const net = inc - exp;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke}/>
        {segs.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none"
            stroke={s.c} strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${s.gap}`}
            transform={`rotate(${s.rot} ${cx} ${cy})`}/>
        ))}
        <text x={cx} y={cy-4} textAnchor="middle" fontSize="7.5" fill="rgba(255,255,255,.5)" fontWeight="700">NET</text>
        <text x={cx} y={cy+8} textAnchor="middle" fontSize="9" fill={net>=0?"#68d498":"#c87070"} fontWeight="800">
          {net>=0?"+":""}{net>=1000||net<=-1000 ? (net/1000).toFixed(1)+"k" : Math.round(net)}€
        </text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          { l: "💰 Revenus",  v: inc, c: "var(--success)" },
          { l: "💸 Dépenses", v: exp, c: "var(--danger)"  },
          { l: "🐷 Épargne",  v: sav, c: "var(--purple)"  },
          { l: "📊 Solde",    v: net, c: net>=0?"var(--success)":"var(--danger)" },
        ].map(s => (
          <div key={s.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: ".6rem", color: "rgba(255,255,255,.55)" }}>{s.l}</span>
            <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: s.c, fontSize: ".68rem", fontVariantNumeric: "tabular-nums" }}>
              {s.l==="📊 Solde"&&s.v>=0?"+":""}{fmt(s.v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  RAPPORT
// ─────────────────────────────────────────────────────────────────
export function RapportView({ data, currentYear, setCurrentYear, monthNotes = {}, onSaveMonthNote, categoryThresholds = {}, onSaveCategoryThreshold, tags = [], onSaveTag, onDeleteTag, onSaveSavingsGoal, onGoToHistorique, onSubtitle, onPushBack, onPopBack }) {
  // ── v1.52.0 : 3 onglets organisés par question ──
  //  📅 Mois        « Comment s'est passé ce mois ? »
  //  📆 Année       « Où j'en suis sur l'année ? »
  //  🗂️ Catégories  « Où part mon argent ? »
  const { transactions, categories, fixedExpenses } = data;
  const fixedIncomes = data.fixedIncomes || [];
  const curYM = currentYM();
  const nowY = new Date().getFullYear();
  const [tab, setTab] = useState("mois");
  const [ym, setYm] = useState(curYM);                    // mois affiché (onglets Mois et Catégories)
  const [catPer, setCatPer] = useState("month");          // Catégories : "month" | "year"
  const [cmpYM, setCmpYM] = useState(null);               // Mois : comparaison avec un autre mois
  const [catModal, setCatModal] = useState(null);         // id de catégorie → analyse détaillée
  const [tagsModal, setTagsModal] = useState(null);       // { tagId } | {}
  const [editBudget, setEditBudget] = useState(null);     // { catId, draft }
  const [noteDraft, setNoteDraft] = useState(null);
  const [goalDraft, setGoalDraft] = useState(null);
  const [sideType, setSideType] = useState("all");

  // Bouton retour Android : ferme d'abord les fenêtres ouvertes
  useEffect(() => { if (!catModal) return; onPushBack?.(() => setCatModal(null)); return () => onPopBack?.(); }, [catModal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!tagsModal) return; onPushBack?.(() => setTagsModal(null)); return () => onPopBack?.(); }, [tagsModal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Barre collée sous l'en-tête (même principe que l'Historique)
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    const h = document.querySelector(".bp-header");
    const upd = () => setStickyTop(h ? Math.round(h.getBoundingClientRect().height) : 0);
    upd(); window.addEventListener("resize", upd);
    const ro = typeof ResizeObserver !== "undefined" && h ? new ResizeObserver(upd) : null;
    ro?.observe(h);
    return () => { window.removeEventListener("resize", upd); ro?.disconnect(); };
  }, []);

  const [yy, mm] = ym.split("-").map(Number);
  const ymLabel = `${MONTHS_FR[mm - 1]} ${yy}`;
  const showYear = tab === "annee" || (tab === "cats" && catPer === "year");
  useEffect(() => { onSubtitle?.(showYear ? `année ${currentYear}` : ymLabel.toLowerCase()); }, [showYear, currentYear, ymLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  const shiftYM = (v, n) => { const d = new Date(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const goPrev = () => { if (showYear) setCurrentYear(y => y - 1); else { setYm(v => shiftYM(v, -1)); setCmpYM(null); } };
  const goNext = () => { if (showYear) setCurrentYear(y => Math.min(y + 1, nowY)); else if (ym < curYM) { setYm(v => shiftYM(v, 1)); setCmpYM(null); } };
  const atEnd = showYear ? currentYear >= nowY : ym >= curYM;

  // ═════ Données « Mois » ═════
  const firstYM = useMemo(() => firstDataYM(transactions), [transactions]);
  const mT = useMemo(() => computeMonthTotals(transactions, fixedExpenses, fixedIncomes, ym), [transactions, fixedExpenses, fixedIncomes, ym]);
  const mAvg = useMemo(() => {
    const prev = [1, 2, 3].map(i => shiftYM(ym, -i)).filter(m => m >= firstYM);
    if (!prev.length) return null;
    const t = prev.map(m => computeMonthTotals(transactions, fixedExpenses, fixedIncomes, m));
    const a = k => t.reduce((s, x) => s + x[k], 0) / t.length;
    return { inc: a("inc"), exp: a("exp"), net: a("net"), n: t.length };
  }, [transactions, fixedExpenses, fixedIncomes, ym, firstYM]); // eslint-disable-line react-hooks/exhaustive-deps
  const recap = useMemo(() => computeMonthRecap(data, ym), [data, ym]);
  const cmpT = useMemo(() => cmpYM ? computeMonthTotals(transactions, fixedExpenses, fixedIncomes, cmpYM) : null, [transactions, fixedExpenses, fixedIncomes, cmpYM]);
  const catBudgets = useMemo(() => categories
    .filter(c => categoryThresholds[c.id] > 0)
    .map(c => ({ c, spent: categorySpentForMonth(categories, transactions, fixedExpenses, c.id, ym), limit: categoryThresholds[c.id] }))
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit), [categories, categoryThresholds, transactions, fixedExpenses, ym]);

  // ═════ Données « Année » ═════
  const months = useYearMonths(transactions, fixedExpenses, currentYear, fixedIncomes);
  const yearly = useMemo(() => computePeriodTotals(transactions, fixedExpenses, fixedIncomes, `${currentYear}-01`, `${currentYear}-12`), [transactions, fixedExpenses, fixedIncomes, currentYear]);
  const isCurYear = currentYear === nowY;
  const prevSame = useMemo(() => {
    const to = isCurYear ? `${currentYear - 1}-${String(new Date().getMonth() + 1).padStart(2, "0")}` : `${currentYear - 1}-12`;
    return computePeriodTotals(transactions, fixedExpenses, fixedIncomes, `${currentYear - 1}-01`, to);
  }, [transactions, fixedExpenses, fixedIncomes, currentYear, isCurYear]);
  const lived = months.filter(m => m.hasData);
  const nM = yearly.months || lived.length || 1;
  const ranked = [...lived].sort((a, b) => b.net - a.net);
  const goal = parseFloat((data.savingsGoals || {})[currentYear]) || 0;
  const monthsLeft = isCurYear ? 12 - (new Date().getMonth() + 1) : 0;

  // ═════ Données « Catégories » ═════
  const catFrom = catPer === "year" ? `${currentYear}-01` : ym;
  const catTo   = catPer === "year" ? `${currentYear}-12` : ym;
  const breakdown = useMemo(() => computeCategoryBreakdown(data, catFrom, catTo), [data, catFrom, catTo]);
  const catLivedMonths = useMemo(() => livedMonths(transactions, catFrom, catTo), [transactions, catFrom, catTo]);
  const catSpentPeriod = id => catLivedMonths.reduce((s, m) => s + categorySpentForMonth(categories, transactions, fixedExpenses, id, m), 0);
  const prefix = catPer === "year" ? String(currentYear) : ym;

  // ── petits éléments d'interface ──
  const segBtn = on => ({ flex: 1, textAlign: "center", fontSize: ".66rem", fontWeight: 800, padding: "7px 0", borderRadius: 8, cursor: "pointer", border: "none",
    background: on ? "var(--accent)" : "transparent", color: on ? "#06121c" : "var(--text2)" });
  const navBtn = off => ({ width: 32, height: 32, flexShrink: 0, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--accent)",
    fontSize: ".8rem", cursor: off ? "default" : "pointer", opacity: off ? .35 : 1, padding: 0 });
  const secT = (txt, right) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".56rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "12px 0 6px" }}>
      <span style={{ flex: 1 }}>{txt}</span>{right}
    </div>
  );
  const link = (txt, on) => <span onClick={on} style={{ color: "var(--accent)", textTransform: "none", letterSpacing: 0, fontSize: ".64rem", cursor: "pointer" }}>{txt}</span>;
  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "4px 11px", marginBottom: 6 };
  const rowSt = first => ({ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: first ? "none" : "1px solid var(--border-soft)", fontSize: ".72rem" });
  const bar = (pct, col, h = 5) => (
    <div style={{ height: h, borderRadius: 3, background: "var(--surface3)", overflow: "hidden", marginTop: 4 }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", borderRadius: 3, background: col }} />
    </div>
  );
  const budCol = (spent, limit) => spent > limit + 0.004 ? "var(--danger)" : spent / limit >= .8 ? "var(--warning)" : "var(--success)";
  const vsTxt = (v, avg, higherIsGood) => {
    if (avg == null) return { t: "", c: "var(--text3)" };
    if (Math.abs(v - avg) < Math.max(1, Math.abs(avg) * .03)) return { t: "= moyenne", c: "var(--text3)" };
    const up = v > avg, good = higherIsGood ? up : !up;
    const p = avg !== 0 ? Math.round(Math.abs((v - avg) / avg) * 100) : null;
    return { t: `${up ? "▲" : "▼"} ${p != null && Math.abs(avg) > 50 ? `${p} %` : fmt(Math.abs(v - avg))} vs moy. ${mAvg?.n} mois`, c: good ? "var(--success)" : "var(--danger)" };
  };
  const kpi = (label, val, color, sub, subCol) => (
    <div style={{ borderRadius: 11, padding: "8px 10px", background: "var(--surface2)", border: "1px solid var(--border-soft)", minWidth: 0 }}>
      <div style={{ fontSize: ".54rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color }}>{label}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: "1rem", fontWeight: 800, color, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val}</div>
      {sub && <div style={{ fontSize: ".58rem", fontWeight: 700, color: subCol || "var(--text3)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
  const signed = v => `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v))}`;
  const catOf = id => categories.find(c => c.id === id);

  return (
    <div>
      {/* ── Barre collée : onglets + période ── */}
      <div style={{ position: "sticky", top: stickyTop, zIndex: 50, background: "var(--bg)", margin: "-16px -16px 10px", padding: "8px 16px", borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 11, padding: 3, gap: 3 }}>
          {[["mois", "📅 Mois"], ["annee", "📆 Année"], ["cats", "🗂️ Catégories"]].map(([k, l]) => {
            const alerts = k === "cats" ? catBudgets.filter(b => b.spent > b.limit + 0.004).length : 0;
            return (
              <button key={k} onClick={() => setTab(k)} style={segBtn(tab === k)}>{l}
                {alerts > 0 && <span style={{ marginLeft: 4, background: "var(--danger)", color: "#fff", borderRadius: 8, padding: "0 5px", fontSize: ".52rem" }}>{alerts}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
          <button onClick={goPrev} style={navBtn(false)}>◀</button>
          {tab === "cats"
            ? <div style={{ flex: 1, display: "flex", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: 2, gap: 2 }}>
                <button onClick={() => setCatPer("month")} style={{ ...segBtn(catPer === "month"), padding: "6px 0" }}>{ymLabel}</button>
                <button onClick={() => setCatPer("year")} style={{ ...segBtn(catPer === "year"), padding: "6px 0" }}>Année {currentYear}</button>
              </div>
            : <div style={{ flex: 1, textAlign: "center", fontFamily: "var(--display)", fontSize: ".98rem", fontWeight: 800 }}>{tab === "annee" ? currentYear : ymLabel}</div>}
          <button onClick={goNext} style={navBtn(atEnd)}>▶</button>
        </div>
      </div>

      {/* ══════════════ 📅 MOIS ══════════════ */}
      {tab === "mois" && (<>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {(() => { const v = vsTxt(mT.inc, mAvg?.inc, true); return kpi("💰 Revenus", fmt(mT.inc), "var(--success)", v.t, v.c); })()}
          {(() => { const v = vsTxt(mT.exp, mAvg?.exp, false); return kpi("💸 Dépenses", fmt(mT.exp), "var(--danger)", v.t, v.c); })()}
          {kpi("🐷 Épargné", fmt(mT.sav), "var(--purple)", mT.inc > 0 ? `${Math.round(mT.sav / mT.inc * 100)} % des revenus` : "", "var(--text3)")}
          {(() => { const v = vsTxt(mT.net, mAvg?.net, true); return kpi("📊 Net", signed(mT.net), mT.net >= 0 ? "var(--success)" : "var(--danger)", v.t, v.c); })()}
        </div>

        {!cmpYM ? (
          <div style={{ textAlign: "right", marginTop: 6 }}>
            {ym > firstYM && link("🔀 Comparer à un autre mois ›", () => setCmpYM(shiftYM(ym, -1)))}
          </div>
        ) : (
          <div style={{ ...card, marginTop: 8, padding: "8px 11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".68rem", marginBottom: 4 }}>
              <b style={{ flex: 1 }}>Comparé à</b>
              <select value={cmpYM} onChange={e => setCmpYM(e.target.value)}
                style={{ background: "var(--surface2)", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 8, padding: "4px 6px", fontSize: ".66rem", fontWeight: 700, fontFamily: "inherit" }}>
                {Array.from({ length: 24 }, (_, i) => shiftYM(curYM, -i)).filter(m => m !== ym && m >= firstYM).map(m => (
                  <option key={m} value={m}>{MONTHS_FR[Number(m.slice(5, 7)) - 1]} {m.slice(0, 4)}</option>
                ))}
              </select>
            </div>
            {[["💰 Revenus", mT.inc, cmpT.inc, true], ["💸 Dépenses", mT.exp, cmpT.exp, false], ["🐷 Épargné", mT.sav, cmpT.sav, true], ["📊 Net", mT.net, cmpT.net, true]].map(([l, a, b, hi], i) => {
              const d = a - b, good = Math.abs(d) < .005 ? null : (hi ? d > 0 : d < 0);
              return (
                <div key={l} style={{ ...rowSt(i === 0), fontSize: ".68rem", padding: "6px 0" }}>
                  <span style={{ flex: 1 }}>{l}</span>
                  <b style={{ width: 84, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(a)}</b>
                  <span style={{ width: 78, textAlign: "right", color: "var(--text3)", fontVariantNumeric: "tabular-nums" }}>{fmt(b)}</span>
                  <span style={{ width: 70, textAlign: "right", fontSize: ".6rem", fontWeight: 800, color: good == null ? "var(--text3)" : good ? "var(--success)" : "var(--danger)" }}>{good == null ? "=" : `${d > 0 ? "▲" : "▼"} ${fmt(Math.abs(d))}`}</span>
                </div>
              );
            })}
            <div style={{ textAlign: "right", marginTop: 2 }}>{link("✕ Fermer la comparaison", () => setCmpYM(null))}</div>
          </div>
        )}

        {recap.movers.length > 0 && <>
          {secT(<>Ce qui a bougé <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>· vs moyenne {recap.monthsCompared} mois</span></>)}
          <div style={card}>
            {recap.movers.map((x, i) => {
              const c = catOf(x.catId);
              return (
                <div key={x.catId} style={{ ...rowSt(i === 0), cursor: c ? "pointer" : "default" }} onClick={() => c && setCatModal(c.id)}>
                  <span>{c?.icon || "❔"}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c?.name || "Sans catégorie"}</span>
                  <span style={{ fontSize: ".62rem", fontWeight: 800, color: x.diff > 0 ? "var(--danger)" : "var(--success)" }}>{x.pct == null ? "nouveau" : `${x.pct > 0 ? "▲ +" : "▼ −"}${Math.abs(x.pct)} %`}</span>
                  <b style={{ width: 82, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(x.amount)}</b>
                </div>
              );
            })}
          </div>
        </>}

        {(catBudgets.length > 0 || recap.grocery || recap.tagBudgets.length > 0) && <>
          {secT("Budgets du mois", link("gérer ›", () => { setCatPer("month"); setTab("cats"); }))}
          <div style={card}>
            {[
              ...catBudgets.map(b => ({ k: b.c.id, label: `${b.c.icon || ""} ${b.c.name}`, spent: b.spent, limit: b.limit })),
              ...(recap.grocery ? [{ k: "__groc", label: "🛒 Courses", tag: "budget courses", spent: recap.grocery.spent, limit: recap.grocery.average }] : []),
              ...recap.tagBudgets.map(b => ({ k: b.tag.id, label: `${b.tag.icon} ${b.tag.name}`, tag: "tag", spent: b.spent, limit: b.budget })),
            ].map((b, i) => {
              const col = budCol(b.spent, b.limit);
              return (
                <div key={b.k} style={{ ...rowSt(i === 0), display: "block" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{b.label}{b.tag && <span style={{ marginLeft: 5, fontSize: ".52rem", fontWeight: 800, padding: "1px 6px", borderRadius: 7, background: "var(--surface3)", color: "var(--text3)" }}>{b.tag}</span>}</span>
                    <b style={{ color: col, fontVariantNumeric: "tabular-nums" }}>{fmt(b.spent)} / {fmt(b.limit)}</b>
                  </div>
                  {bar(b.spent / b.limit * 100, col)}
                </div>
              );
            })}
          </div>
        </>}

        {(recap.unpointed > 0 || recap.cheques > 0) && <>
          {secT("À faire")}
          <div style={card}>
            {recap.unpointed > 0 && (
              <div style={{ ...rowSt(true), cursor: "pointer" }} onClick={() => onGoToHistorique?.("unpointed")}>
                <span>⏳</span><span style={{ flex: 1 }}>{recap.unpointed} opération{recap.unpointed > 1 ? "s" : ""} pas pointée{recap.unpointed > 1 ? "s" : ""}</span>
                <b style={{ color: "var(--accent)", fontSize: ".66rem" }}>Voir ›</b>
              </div>
            )}
            {recap.cheques > 0 && (
              <div style={rowSt(recap.unpointed === 0)}>
                <span>🧾</span><span style={{ flex: 1 }}>{recap.cheques} chèque{recap.cheques > 1 ? "s" : ""} non encaissé{recap.cheques > 1 ? "s" : ""}{recap.oldestChequeDays != null ? ` (${recap.oldestChequeDays} j)` : ""}</span>
              </div>
            )}
          </div>
        </>}

        {secT("📝 Note du mois")}
        {noteDraft == null ? (
          <div onClick={() => setNoteDraft(monthNotes[ym] || "")} style={{ ...card, padding: "9px 11px", fontSize: ".7rem", cursor: "pointer", color: monthNotes[ym] ? "var(--text)" : "var(--text3)", display: "flex", gap: 8 }}>
            <span style={{ flex: 1, whiteSpace: "pre-wrap" }}>{monthNotes[ym] || `Ajouter une note pour ${MONTHS_FR[mm - 1].toLowerCase()}…`}</span>
            <span style={{ color: "var(--accent)" }}>✏️</span>
          </div>
        ) : (
          <div style={{ ...card, padding: 9 }}>
            <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} autoFocus rows={3}
              style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: 8, padding: 8, color: "var(--text)", fontSize: ".74rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button className="btn btn-outline" style={{ flex: 1, padding: 7 }} onClick={() => setNoteDraft(null)}>Annuler</button>
              <button className="btn btn-primary" style={{ flex: 1, padding: 7 }} onClick={() => { onSaveMonthNote?.(ym, noteDraft); setNoteDraft(null); }}>Enregistrer</button>
            </div>
          </div>
        )}
      </>)}

      {/* ══════════════ 📆 ANNÉE ══════════════ */}
      {tab === "annee" && (() => {
        const hasPrev = prevSame.inc + prevSame.exp > 0;
        const vsY = (v, p, hi) => {
          if (!hasPrev || !p) return { t: "", c: "var(--text3)" };
          const d = (v - p) / Math.abs(p) * 100, good = hi ? d > 0 : d < 0;
          return { t: `${d > 0 ? "▲" : "▼"} ${Math.abs(Math.round(d))} % vs ${currentYear - 1}`, c: Math.abs(d) < 3 ? "var(--text3)" : good ? "var(--success)" : "var(--danger)" };
        };
        const mx = Math.max(1, ...months.map(m => Math.max(m.inc, m.exp)));
        const rate = yearly.inc > 0 ? yearly.sav / yearly.inc * 100 : 0;
        const best = ranked[0], worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
        const rem = Math.max(0, goal - yearly.sav);
        const proj = isCurYear && lived.length > 0 ? {
          inc: yearly.inc + yearly.inc / nM * monthsLeft, exp: yearly.exp + yearly.exp / nM * monthsLeft,
        } : null;
        return (<>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {(() => { const v = vsY(yearly.inc, prevSame.inc, true); return kpi("💰 Revenus", fmt(yearly.inc), "var(--success)", v.t || `${nM} mois · ${fmt(yearly.inc / nM)}/mois`, v.c); })()}
            {(() => { const v = vsY(yearly.exp, prevSame.exp, false); return kpi("💸 Dépenses", fmt(yearly.exp), "var(--danger)", v.t || `${fmt(yearly.exp / nM)}/mois`, v.c); })()}
            {kpi("🐷 Épargné", fmt(yearly.sav), "var(--purple)", `taux : ${rate.toFixed(1).replace(".", ",")} %`)}
            {(() => { const v = vsY(yearly.net, prevSame.net, true); return kpi("📊 Net", signed(yearly.net), yearly.net >= 0 ? "var(--success)" : "var(--danger)", v.t || `${signed(yearly.net / nM)}/mois`, v.c); })()}
          </div>
          {!hasPrev && <div style={{ fontSize: ".6rem", color: "var(--text3)", margin: "6px 2px 0" }}>{currentYear - 1} : pas de données à comparer pour l'instant.</div>}

          {secT(<>Mois par mois <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>· touche un mois pour l'ouvrir</span></>)}
          <div style={{ ...card, padding: "10px 8px 6px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 92 }}>
              {months.map((m, i) => {
                const ymI = `${currentYear}-${String(i + 1).padStart(2, "0")}`;
                return (
                  <div key={i} onClick={() => { if (m.hasData) { setYm(ymI); setCmpYM(null); setTab("mois"); } }}
                    style={{ flex: 1, display: "flex", gap: 1, alignItems: "flex-end", height: "100%", opacity: m.hasData ? 1 : .25, cursor: m.hasData ? "pointer" : "default" }}>
                    {m.hasData
                      ? <><i style={{ flex: 1, height: `${m.inc / mx * 100}%`, background: "rgba(104,212,152,.7)", borderRadius: "2px 2px 0 0" }} />
                          <i style={{ flex: 1, height: `${m.exp / mx * 100}%`, background: "rgba(200,112,112,.7)", borderRadius: "2px 2px 0 0" }} /></>
                      : <i style={{ flex: 1, height: 3, background: "var(--surface3)" }} />}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              {"JFMAMJJASOND".split("").map((l, i) => <span key={i} style={{ flex: 1, textAlign: "center", fontSize: ".54rem", color: "var(--text3)" }}>{l}</span>)}
            </div>
            {best && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: ".6rem", marginTop: 8, paddingTop: 7, borderTop: "1px solid var(--border-soft)" }}>
                <span>🥇 Meilleur : <b style={{ color: "var(--success)" }}>{MONTHS_FR[months.indexOf(best)].toLowerCase()} {signed(best.net)}</b></span>
                {worst && <span>Moins bon : <b style={{ color: worst.net < 0 ? "var(--danger)" : "var(--warning)" }}>{MONTHS_FR[months.indexOf(worst)].toLowerCase()} {signed(worst.net)}</b></span>}
              </div>
            )}
          </div>

          {secT("🐷 Épargne")}
          <div style={{ ...card, padding: "10px 11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".72rem" }}>
              <span style={{ flex: 1 }}>Objectif {currentYear}</span>
              {goalDraft == null
                ? <><b style={{ fontVariantNumeric: "tabular-nums" }}>{goal > 0 ? `${fmt(yearly.sav)} / ${fmt(goal)}` : "aucun"}</b>
                    <span onClick={() => setGoalDraft(goal ? String(goal) : "")} style={{ color: "var(--accent)", cursor: "pointer" }}>✏️</span></>
                : <><input value={goalDraft} onChange={e => setGoalDraft(e.target.value)} inputMode="decimal" autoFocus placeholder="Ex : 3000"
                      style={{ width: 90, background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: 7, padding: "4px 7px", color: "var(--text)", fontSize: ".74rem", fontFamily: "var(--mono)", textAlign: "right" }} />
                    <button onClick={() => { onSaveSavingsGoal?.(currentYear, parseFloat(String(goalDraft).replace(",", ".")) || 0); setGoalDraft(null); }}
                      style={{ background: "var(--accent)", color: "var(--bg)", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: ".64rem", fontWeight: 800, cursor: "pointer" }}>OK</button></>}
            </div>
            {goal > 0 && <>
              {bar(yearly.sav / goal * 100, "var(--purple)", 7)}
              <div style={{ fontSize: ".6rem", marginTop: 5, color: rem > 0 ? "var(--warning)" : "var(--success)" }}>
                {rem <= 0 ? "✅ Objectif atteint" : monthsLeft > 0 ? <>Pour l'atteindre : <b>{fmt(rem / monthsLeft)}/mois</b> sur les {monthsLeft} mois restants</> : <>Il manque <b>{fmt(rem)}</b></>}
              </div>
            </>}
            <div style={{ display: "flex", alignItems: "center", fontSize: ".72rem", marginTop: 11, paddingTop: 9, borderTop: "1px solid var(--border-soft)" }}>
              <span style={{ flex: 1 }}>Taux d'épargne <small style={{ color: "var(--text3)" }}>(épargné ÷ revenus)</small></span>
              <b style={{ color: "var(--purple)" }}>{rate.toFixed(1).replace(".", ",")} %</b>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 44, marginTop: 6 }}>
              {months.map((m, i) => {
                const r = m.hasData && m.inc > 0 ? Math.max(0, m.sav / m.inc * 100) : null;
                return (
                  <div key={i} style={{ flex: 1, textAlign: "center", opacity: r == null ? .25 : 1 }}>
                    <div style={{ height: r == null ? 2 : Math.max(3, Math.min(30, r * 1.5)), background: "rgba(176,144,224,.6)", borderRadius: "3px 3px 0 0" }} />
                    <div style={{ fontSize: ".46rem", color: "var(--text3)", marginTop: 2 }}>{r == null ? "" : `${Math.round(r)}%`}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 5 }}>🎯 Repère courant : 10 % des revenus ({fmt(yearly.inc / nM * .1)}/mois)</div>
          </div>

          {proj && <>
            {secT("🔮 Fin d'année prévue")}
            <div style={card}>
              <div style={rowSt(true)}><span style={{ flex: 1 }}>Revenus prévus</span><b style={{ color: "var(--success)" }}>{fmt(proj.inc)}</b></div>
              <div style={rowSt(false)}><span style={{ flex: 1 }}>Dépenses prévues</span><b style={{ color: "var(--danger)" }}>{fmt(proj.exp)}</b></div>
              <div style={rowSt(false)}><span style={{ flex: 1 }}>Net prévu au 31 déc.<small style={{ display: "block", color: "var(--text3)", fontSize: ".56rem" }}>au rythme moyen des {nM} mois</small></span>
                <b style={{ color: proj.inc - proj.exp >= 0 ? "var(--success)" : "var(--danger)" }}>{signed(proj.inc - proj.exp)}</b></div>
            </div>
          </>}
        </>);
      })()}

      {/* ══════════════ 🗂️ CATÉGORIES ══════════════ */}
      {tab === "cats" && (() => {
        const nMonths = Math.max(1, catLivedMonths.length);
        const sideTypes = data.sideAmountTypes || [];
        const txSide = t => Object.entries(t.sideAmounts || {}).reduce((s, [k, v]) => s + (sideType === "all" || k === sideType ? (parseFloat(v) || 0) : 0), 0);
        const sideTxs = transactions.filter(t => t.type === "expense" && (t.date || "").startsWith(prefix) && Object.values(t.sideAmounts || {}).some(v => parseFloat(v) > 0));
        const offExp = (data.offAccountEntries || []).filter(x => x.kind === "expense" && (x.date || "").startsWith(prefix));
        const anySide = sideTxs.length > 0 || offExp.length > 0;
        const byType = {};
        sideTxs.forEach(t => Object.entries(t.sideAmounts || {}).forEach(([k, v]) => { byType[k] = (byType[k] || 0) + (parseFloat(v) || 0); }));
        offExp.forEach(x => { byType[x.satId] = (byType[x.satId] || 0) + (parseFloat(x.amount) || 0); });
        const sidePaidBank = sideTxs.filter(t => txSide(t) > 0 || sideType === "all").reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const sideTotal = sideTxs.reduce((s, t) => s + txSide(t), 0) + offExp.filter(x => sideType === "all" || x.satId === sideType).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
        const sideRows = computeSidePaidByCategory(transactions, data.offAccountEntries, sideType, prefix);
        const tagRows = tags.map(tag => {
          const txs = transactions.filter(t => t.type === "expense" && (t.tagIds || []).includes(tag.id) && (t.date || "").startsWith(prefix));
          const spent = txs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
          const b = parseFloat(tag.budget) || 0;
          const limit = b > 0 ? (tag.budgetPeriod === "total" ? b : b * (catPer === "year" ? nMonths : 1)) : 0;
          const spentForBudget = tag.budgetPeriod === "total" ? transactions.filter(t => t.type === "expense" && (t.tagIds || []).includes(tag.id)).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0) : spent;
          return { tag, count: txs.length, spent, limit, spentForBudget };
        }).sort((a, b) => b.spent - a.spent);
        return (<>
          <div style={card}>
            {breakdown.rows.length === 0 && <div style={{ fontSize: ".7rem", color: "var(--text3)", textAlign: "center", padding: 14 }}>Aucune dépense sur cette période.</div>}
            {breakdown.rows.map((r, i) => {
              const c = r.id.startsWith("__") ? null : catOf(r.id);
              const name = r.id === "__fixes__" ? "Frais fixes" : r.id === "__other__" ? "Sans catégorie" : c?.name || "Catégorie supprimée";
              const icon = r.id === "__fixes__" ? "📌" : c?.icon || "❔";
              const pct = breakdown.total > 0 ? r.net / breakdown.total * 100 : 0;
              const lim = c ? (categoryThresholds[c.id] || 0) : 0;
              const limP = lim * (catPer === "year" ? nMonths : 1);
              const spentB = lim > 0 ? catSpentPeriod(c.id) : 0;
              const editing = editBudget?.catId === r.id;
              return (
                <div key={r.id} style={{ ...rowSt(i === 0), display: "block" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: c ? "pointer" : "default" }} onClick={() => c && setCatModal(c.id)}>
                    <span>{icon}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}
                      {r.id === "__fixes__" && <span style={{ marginLeft: 5, fontSize: ".52rem", fontWeight: 800, padding: "1px 6px", borderRadius: 7, background: "var(--surface3)", color: "var(--text3)" }}>fixes</span>}</span>
                    <span style={{ fontSize: ".58rem", color: "var(--text3)" }}>{Math.round(pct)} %</span>
                    <b style={{ width: 84, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.net)}</b>
                    <span style={{ color: "var(--text3)", width: 8 }}>{c ? "›" : ""}</span>
                  </div>
                  {(r.subs.length > 0 || r.deducted > 0) && (
                    <div style={{ fontSize: ".56rem", color: "var(--text3)", margin: "1px 0 0 24px" }}>
                      {r.subs.length > 0 && <>dont {r.subs.map(s => `${catOf(s.id)?.icon || ""} ${catOf(s.id)?.name || "?"} ${fmt(s.amount)}`).join(" · ")}</>}
                      {r.deducted > 0 && <>{r.subs.length > 0 ? " · " : ""}− {fmt(r.deducted)} de revenus liés déduits</>}
                    </div>
                  )}
                  {bar(pct, "rgba(112,184,224,.7)")}
                  {c && (editing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: ".6rem", color: "var(--text2)" }}>🎯 Budget / mois</span>
                      <input value={editBudget.draft} onChange={e => setEditBudget({ ...editBudget, draft: e.target.value })} inputMode="decimal" autoFocus placeholder="0 = aucun"
                        style={{ flex: 1, minWidth: 0, background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: 7, padding: "5px 8px", color: "var(--text)", fontSize: ".72rem", fontFamily: "var(--mono)" }} />
                      <button onClick={() => { onSaveCategoryThreshold?.(c.id, Math.max(0, parseFloat(String(editBudget.draft).replace(",", ".")) || 0)); setEditBudget(null); }}
                        style={{ background: "var(--accent)", color: "var(--bg)", border: "none", borderRadius: 7, padding: "6px 10px", fontSize: ".62rem", fontWeight: 800, cursor: "pointer" }}>OK</button>
                      <button onClick={() => setEditBudget(null)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}>✕</button>
                    </div>
                  ) : lim > 0 ? (
                    <div onClick={() => setEditBudget({ catId: c.id, draft: String(lim) })} style={{ fontSize: ".58rem", marginTop: 3, fontWeight: 700, color: budCol(spentB, limP), cursor: "pointer" }}>
                      🎯 {fmt(spentB)} / {fmt(limP)}{catPer === "year" ? ` (${fmt(lim)} × ${nMonths} mois)` : ""} · {spentB > limP ? `dépassé de ${fmt(spentB - limP)}` : `reste ${fmt(limP - spentB)}`}{spentB - r.gross > 0.5 ? " · fixes compris" : ""} ✏️
                    </div>
                  ) : (
                    <div onClick={() => setEditBudget({ catId: c.id, draft: "" })} style={{ fontSize: ".58rem", marginTop: 3, color: "var(--text3)", cursor: "pointer" }}>+ ajouter un budget</div>
                  ))}
                </div>
              );
            })}
            {breakdown.rows.length > 0 && (
              <div style={{ ...rowSt(false), fontWeight: 800 }}><span style={{ flex: 1 }}>Total</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(breakdown.total)}</span></div>
            )}
          </div>

          {anySide && <>
            {secT("🎫 Montants à part & hors banque")}
            <div style={{ ...card, padding: "9px 11px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                {[["Payé banque", sidePaidBank, "var(--danger)"], ["Hors banque", sideTotal, "var(--tr)"], ["Budget réel", sidePaidBank + sideTotal, "var(--text)"]].map(([l, v, col]) => (
                  <div key={l} style={{ borderRadius: 9, padding: "6px 7px", background: "var(--surface2)", border: "1px solid var(--border-soft)", minWidth: 0 }}>
                    <div style={{ fontSize: ".5rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text3)" }}>{l}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: ".74rem", fontWeight: 800, color: col, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fmt(v)}</div>
                  </div>
                ))}
              </div>
              {Object.keys(byType).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {[["all", "Tous", null], ...sideTypes.filter(st => byType[st.id]).map(st => [st.id, `${st.icon} ${st.label}`, byType[st.id]])].map(([k, l, v]) => (
                    <span key={k} onClick={() => setSideType(k)} style={{ fontSize: ".6rem", fontWeight: 700, padding: "4px 9px", borderRadius: 10, cursor: "pointer",
                      border: `1px solid ${sideType === k ? "var(--tr)" : "var(--border)"}`, color: sideType === k ? "var(--tr)" : "var(--text2)", background: sideType === k ? "var(--tr-glow)" : "transparent" }}>
                      {l}{v != null ? ` · ${fmt(v)}` : ""}
                    </span>
                  ))}
                </div>
              )}
              {sideRows.map((r, i) => {
                const c = catOf(r.categoryId);
                return (
                  <div key={r.categoryId || i} style={rowSt(i === 0 && Object.keys(byType).length === 0)}>
                    <span>{c?.icon || "❔"}</span><span style={{ flex: 1 }}>{c?.name || "Sans catégorie"}</span>
                    <span style={{ fontSize: ".56rem", color: "var(--text3)" }}>{Math.round(r.pct)} % du total</span>
                    <b style={{ color: "var(--tr)", fontVariantNumeric: "tabular-nums" }}>{fmt(r.side)}</b>
                  </div>
                );
              })}
              <div style={{ fontSize: ".54rem", color: "var(--text3)", marginTop: 6 }}>« Budget réel » = payé par la banque + hors banque, sur les achats concernés. N'affecte jamais ton solde.</div>
            </div>
          </>}

          {secT("🏷️ Tags", link("gérer ›", () => setTagsModal({})))}
          <div style={card}>
            {tagRows.length === 0 && <div style={{ fontSize: ".66rem", color: "var(--text3)", padding: "8px 0" }}>Aucun tag — « gérer » pour en créer.</div>}
            {tagRows.map((r, i) => {
              const col = r.limit > 0 ? budCol(r.spentForBudget, r.limit) : "var(--text)";
              return (
                <div key={r.tag.id} style={{ ...rowSt(i === 0), display: "block", cursor: "pointer" }} onClick={() => setTagsModal({ tagId: r.tag.id })}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{r.tag.icon} {r.tag.name} <small style={{ color: "var(--text3)" }}>· {r.count} opération{r.count > 1 ? "s" : ""}</small></span>
                    <b style={{ color: col, fontVariantNumeric: "tabular-nums" }}>{r.limit > 0 ? `${fmt(r.spentForBudget)} / ${fmt(r.limit)}` : fmt(r.spent)}</b>
                    <span style={{ color: "var(--text3)" }}>›</span>
                  </div>
                  {r.limit > 0 && bar(r.spentForBudget / r.limit * 100, col)}
                  {r.limit > 0 && r.tag.budgetPeriod === "total" && <div style={{ fontSize: ".54rem", color: "var(--text3)", marginTop: 2 }}>budget global (toutes périodes)</div>}
                </div>
              );
            })}
          </div>
        </>);
      })()}

      {catModal && (
        <CategoryDetailModal onClose={() => setCatModal(null)} initialCatId={catModal}
          categories={categories} transactions={transactions} fixedExpenses={fixedExpenses} />
      )}
      {tagsModal && (
        <TagsModal onClose={() => setTagsModal(null)} initialTagId={tagsModal.tagId}
          tags={tags} transactions={transactions} fixedExpenses={fixedExpenses} categories={categories}
          onSaveTag={onSaveTag} onDeleteTag={onDeleteTag} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  ANALYSTE LOCAL — analyses 100% locales, sans internet
// ─────────────────────────────────────────────────────────────────
function buildInsights(data, currentYear, months) {
  const { transactions, categories, fixedExpenses, cagnottes } = data;
  const yStr   = currentYear.toString();
  const now    = new Date();
  const curYM  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const tf     = fixedExpenses.filter(f => isActiveForMonth(f, curYM)).reduce((s, f) => s + f.amount, 0);
  const isCurY = currentYear === now.getFullYear();
  // ⚠ Correction UTC : utilise l'heure locale au lieu de toISOString()
  const MOIS   = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

  // v1.47.1 : totaux repris des mois du Rapport (même calcul partout :
  // revenus et frais fixes inclus, uniquement les mois vécus)
  let inc = 0, totalExp = 0;
  const byMonth = {};
  (months || []).forEach(m => {
    if (!m.hasData) return;
    inc += m.inc; totalExp += m.exp;
    byMonth[m.idx] = { inc: m.inc, exp: m.exp, net: m.net };
  });

  const net        = inc - totalExp;
  const active     = Object.values(byMonth).filter(m => m.inc > 0 || m.exp > 0);
  const n          = active.length || 1;

  const insights = [];

  if (isCurY && n > 0 && inc > 0) {
    const moisRestants = 12 - now.getMonth() - 1;
    const avgNet = net / n;
    const projNet = net + avgNet * moisRestants;
    const projInc = inc + (inc / n) * moisRestants;
    const projExp = totalExp + (totalExp / n) * moisRestants;
    const projAlert = projNet >= 0
      ? "✅ Projection positive à fin " + currentYear + "."
      : "⚠️ Projection négative — attention aux dépenses.";
    insights.push({
      id: "projection",
      icon: "🔮",
      title: "Projection fin " + currentYear,
      color: projNet >= 0 ? "var(--success)" : "var(--danger)",
      lines: [
        { label: "Mois restants",    value: moisRestants + " mois",                        color: "var(--text2)"   },
        { label: "Revenus projetés", value: fmt(projInc),                                   color: "var(--success)" },
        { label: "Dépenses projetées",value: fmt(projExp),                                  color: "var(--danger)"  },
        { label: "Solde projeté",    value: (projNet >= 0 ? "+" : "") + fmt(projNet),       color: projNet >= 0 ? "var(--success)" : "var(--danger)" },
      ],
      alert: projAlert,
    });
  }

  if (cagnottes.length > 0) {
    const totalCag = cagnottes.reduce((s, c) => s + c.current, 0);
    const done     = cagnottes.filter(c => c.target && c.current >= c.target);
    const inProg   = cagnottes.filter(c => c.target && c.current < c.target);
    insights.push({
      id: "cagnottes",
      icon: "🏦",
      title: "Cagnottes",
      color: "var(--khaki)",
      lines: [
        { label: "Total épargné",   value: fmt(totalCag),             color: "var(--khaki)" },
        { label: "Nb cagnottes",    value: cagnottes.length + "",     color: "var(--text2)" },
        done.length   > 0 ? { label: "Objectifs atteints",  value: done.length + " 🎉",  color: "var(--success)" } : null,
        inProg.length > 0 ? { label: "En cours",            value: inProg.length + "",    color: "var(--accent)"  } : null,
      ].filter(Boolean),
      alert: done.length > 0 ? "🎉 " + done.map(c => c.name).join(", ") + " — objectif(s) atteint(s) !" : null,
    });
  }

  return insights;
}

function AnalysteLocal({ data, currentYear, months }) {
  const insights = useMemo(
    () => buildInsights(data, currentYear, months),
    [data, currentYear, months]
  );

  return (
    <div style={{ marginTop: 8 }}>
      <SectionTitle>Analyses financières ✨</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {insights.map(ins => (
          <div key={ins.id} className="card" style={{ padding: 14, borderLeft: "3px solid " + ins.color }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: "1rem" }}>{ins.icon}</span>
              <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: ".85rem" }}>{ins.title}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {ins.lines.map((l, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: ".78rem" }}>
                  <span style={{ color: "var(--text2)" }}>{l.label}</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: l.color, fontVariantNumeric: "tabular-nums" }}>{l.value}</span>
                </div>
              ))}
            </div>
            {ins.alert && (
              <div style={{ marginTop: 10, padding: "7px 10px", background: "rgba(0,0,0,.15)", borderRadius: 7, fontSize: ".72rem", color: "var(--text2)", lineHeight: 1.5 }}>
                {ins.alert}
              </div>
            )}
          </div>
        ))}
        {insights.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>Ajoute des transactions pour voir les analyses.</p>
          </div>
        )}
      </div>
    </div>
  );
}
