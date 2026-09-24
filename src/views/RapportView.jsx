// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useMemo, useEffect } from "react";
import { ChartSVG, PatrimoineSVG } from "../components/charts.jsx";
import { fmt, currentYM, isIncome, PALETTE } from "../utils.js";
import { useYearMonths, useYearTotals, useTotalFixes, isActiveForMonth, isIncomeDirection, computeTagBudgets } from "../hooks.js";
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
function SavingsRateModal({ onClose, transactions, fixedExpenses, currentYear }) {
  const now = new Date();

  // 6 derniers mois
  const months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d  = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "short" });
      let inc = 0, sav = 0;
      transactions.filter(t => t.date.startsWith(ym)).forEach(t => {
        const a = parseFloat(t.amount) || 0;
        if (isIncome(t.type))          inc += a;
        else if (t.type === "epargne") sav += a;
      });
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
      .forEach(t => { map[t.categoryId] = (map[t.categoryId] || 0) + (parseFloat(t.amount) || 0); });
    fixedExpenses.forEach(f => {
      if (!isActiveForMonth(f, curYM)) return;
      const ov = f.monthlyOverrides?.[curYM];
      const a  = (ov?.amount ?? f.amount) || 0;
      map[f.categoryId] = (map[f.categoryId] || 0) + a;
    });
    return map;
  }, [transactions, fixedExpenses, curYM]);

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
                        onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); saveThreshold(cat.id); }}
                        onClick={() => saveThreshold(cat.id)}
                        style={{ background: "var(--accent)", border: "none", borderRadius: 7, padding: "7px 10px", color: "var(--bg)", fontWeight: 800, fontSize: ".75rem", cursor: "pointer", minHeight: 32, touchAction: "manipulation" }}>✓</button>
                      <button
                        onTouchStart={e => e.stopPropagation()}
                        onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); setEditId(null); }}
                        onClick={() => setEditId(null)}
                        style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 9px", color: "var(--text3)", fontSize: ".75rem", cursor: "pointer", minHeight: 32, touchAction: "manipulation" }}>✕</button>
                    </div>
                  ) : (
                    <button
                      onTouchStart={e => e.stopPropagation()}
                      onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); setEditId(cat.id); setDraft(thresholds[cat.id] > 0 ? String(thresholds[cat.id]) : ""); }}
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
function CategoryDetailModal({ onClose, categories, transactions, fixedExpenses }) {
  const now       = new Date();
  const curYM     = currentYM();
  const [selCatId, setSelCatId] = useState(categories[0]?.id || "");

  const cat = categories.find(c => c.id === selCatId);

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
        .filter(t => t.date.startsWith(ym) && t.type === "expense" && t.categoryId === selCatId)
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const fixExp = inRange ? fixedExpenses
        .filter(f => f.categoryId === selCatId && isActiveForMonth(f, ym))
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
    .filter(t => t.date.startsWith(yearStr) && t.type === "expense" && t.categoryId === selCatId)
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const yearFixExp = fixedExpenses
    .filter(f => f.categoryId === selCatId)
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
  const txCount    = transactions.filter(t => t.date.startsWith(yearStr) && t.categoryId === selCatId).length;
  const fixBaseAmount = fixedExpenses
    .filter(f => f.categoryId === selCatId)
    .reduce((s, f) => s + (f.amount || 0), 0);

  // Top 5 transactions récentes
  const recent = [...transactions]
    .filter(t => t.categoryId === selCatId)
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
            const fixes = fixedExpenses.filter(f => f.categoryId === selCatId);
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
export function RapportView({ data, currentYear, setCurrentYear, onShowMonthDetail, monthNotes = {}, onSaveMonthNote, categoryThresholds = {}, onSaveCategoryThreshold, tags = [], onSaveTag, onDeleteTag, onPushBack, onPopBack }) {
  const { transactions, categories, fixedExpenses } = data;
  const months  = useYearMonths(transactions, fixedExpenses, currentYear);
  const yearly  = useYearTotals(transactions, fixedExpenses, currentYear);
  const prevY   = useYearTotals(transactions, fixedExpenses, currentYear - 1);
  const [rapportTab,    setRapportTab]    = useState("bilan");
  const [chartFilter,   setChartFilter]   = useState("all");
  const [showSavModal,  setShowSavModal]  = useState(false);
  const [showCatModal,  setShowCatModal]  = useState(false);
  const [showSuiviModal,setShowSuiviModal]= useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [savGoal,     setSavGoal]     = useState(0);
  const [editGoal,    setEditGoal]    = useState(false);
  const [goalInput,   setGoalInput]   = useState("");

  // Enregistre les modals locaux dans le back stack
  useEffect(() => { if (!showSavModal)   return; onPushBack?.(() => setShowSavModal(false));   return () => onPopBack?.(); }, [showSavModal]);
  useEffect(() => { if (!showCatModal)   return; onPushBack?.(() => setShowCatModal(false));   return () => onPopBack?.(); }, [showCatModal]);
  useEffect(() => { if (!showSuiviModal) return; onPushBack?.(() => setShowSuiviModal(false)); return () => onPopBack?.(); }, [showSuiviModal]);
  useEffect(() => { if (!showTagsModal)  return; onPushBack?.(() => setShowTagsModal(false));  return () => onPopBack?.(); }, [showTagsModal]);
  useEffect(() => { if (!editGoal)       return; onPushBack?.(() => setEditGoal(false));       return () => onPopBack?.(); }, [editGoal]);

  const yInc = yearly.inc, yExp = yearly.exp, ySav = yearly.sav;
  const yNet = yInc - yExp;

  // Moyennes
  const active  = useMemo(() => months.filter(m => m.inc > 0 || m.exp > 0), [months]);
  const n       = active.length || 1;
  const avgInc  = active.reduce((s,m) => s + m.inc, 0) / n;
  const avgExp  = active.reduce((s,m) => s + m.exp, 0) / n;
  const avgNet  = active.reduce((s,m) => s + m.net, 0) / n;

  // Classement mois
  const ranked  = useMemo(() =>
    [...active].sort((a, b) => b.net - a.net),
    [active]
  );

  const { top5, topTotal } = useMemo(() => {
    const nowYM = currentYM();
    const tf    = fixedExpenses.filter(f => isActiveForMonth(f, nowYM)).reduce((s, f) => s + f.amount, 0);
    const isCur = currentYear === new Date().getFullYear();
    const yearStr = currentYear.toString();
    const expMap = {};
    const incMap = {};
    if (isCur && tf > 0) expMap["__fixes__"] = tf;
    // Dépenses
    transactions
      .filter(t => t.date.startsWith(yearStr) && t.type === "expense")
      .forEach(t => {
        const k = t.categoryId || "__other__";
        expMap[k] = (expMap[k] || 0) + (parseFloat(t.amount) || 0);
      });
    // Revenus de même catégorie OU catégorie liée = déductions
    transactions
      .filter(t => t.date.startsWith(yearStr) && isIncome(t.type) && t.type !== "dissolution_cagnotte")
      .forEach(t => {
        const a   = parseFloat(t.amount)||0;
        const cat = categories.find(c => c.id === t.categoryId);
        if (cat?.linkedToId && expMap[cat.linkedToId]) {
          incMap[cat.linkedToId] = (incMap[cat.linkedToId]||0) + a;
        } else if (t.categoryId && expMap[t.categoryId]) {
          incMap[t.categoryId] = (incMap[t.categoryId]||0) + a;
        }
      });
    // Coût net par catégorie
    const netMap = {};
    Object.keys(expMap).forEach(k => {
      netMap[k] = Math.max(0, expMap[k] - (incMap[k] || 0));
    });
    const entries = Object.entries(netMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total   = Object.values(netMap).reduce((s, v) => s + v, 0) || 1;
    return { top5: entries, topTotal: total };
  }, [transactions, fixedExpenses, currentYear]);

  const compRows = [
    { label: "💰 Revenus",   v1: yInc,  v0: prevY.inc,             color: "var(--success)", higherIsBetter: true  },
    { label: "💸 Dépenses",  v1: yExp,  v0: prevY.exp,             color: "var(--danger)",  higherIsBetter: false },
    { label: "🐷 Épargne",   v1: ySav,  v0: prevY.sav,             color: "var(--purple)",  higherIsBetter: true  },
    { label: "📊 Solde net", v1: yNet,  v0: prevY.inc - prevY.exp, color: "var(--accent)",  higherIsBetter: true  },
  ];

  return (
    <div>
      {/* ── Navigation année ── */}
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button className="year-nav-btn" onClick={() => setCurrentYear(y => y - 1)}>◀</button>
        <span style={{ fontFamily: "var(--display)", fontSize: "1.3rem", fontWeight: 800 }}>{currentYear}</span>
        <button className="year-nav-btn" onClick={() => setCurrentYear(y => Math.min(y + 1, new Date().getFullYear()))}>▶</button>
      </div>

      {/* ── Tabs internes ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
        {[
          ["bilan",       "📊 Bilan"],
          ["analyse",     "🔍 Analyse"],
          ["comparaison", "🔀 Périodes"],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setRapportTab(k)} style={{
            background: rapportTab===k ? "var(--accent-glow)" : "transparent",
            border: `1.5px solid ${rapportTab===k ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)", padding: "9px 0",
            color: rapportTab===k ? "var(--accent)" : "var(--text2)",
            fontWeight: 700, fontSize: ".7rem", cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>

      {/* ══ BILAN : hero + moyennes + graphique + classement + objectif ══ */}
      {rapportTab === "bilan" && (<>

        {/* Bouton suivi catégories */}
        {(() => {
          const curYM  = currentYM();
          const alerts = data.categories.filter(c => {
            const limit = categoryThresholds[c.id];
            if (!limit) return false;
            const spent = data.transactions
              .filter(t => t.date.startsWith(curYM) && t.type === "expense" && t.categoryId === c.id)
              .reduce((s, t) => s + (parseFloat(t.amount)||0), 0)
              + data.fixedExpenses.filter(f=>f.categoryId===c.id && isActiveForMonth(f, curYM))
                  .reduce((s,f)=>{ const ov=f.monthlyOverrides?.[curYM]; return s+((ov?.amount??f.amount)||0); }, 0);
            return spent >= limit * 0.8;
          });
          return (
            <>
              <button onClick={() => setShowSuiviModal(true)} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "var(--surface)",
                border: `1px solid ${alerts.length > 0 ? "rgba(200,112,112,.4)" : "var(--border)"}`,
                borderLeft: `3px solid ${alerts.length > 0 ? "var(--danger)" : "var(--accent)"}`,
                borderRadius: "var(--radius-sm)",
                padding: "11px 14px", marginBottom: 12, cursor: "pointer", touchAction: "manipulation",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "1.1rem" }}>🎯</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text)" }}>Suivi des catégories</span>
                      {alerts.length > 0 && (
                        <span style={{ fontSize: ".52rem", background: "rgba(200,112,112,.2)", color: "var(--danger)", padding: "2px 7px", borderRadius: 10, fontWeight: 800 }}>
                          {alerts.length} alerte{alerts.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 1 }}>
                      {(() => {
                        const tracked = Object.keys(categoryThresholds).filter(k => categoryThresholds[k] > 0);
                        return tracked.length > 0
                          ? `${tracked.length} catégorie${tracked.length > 1 ? "s" : ""} suivie${tracked.length > 1 ? "s" : ""}  · Tap pour le détail`
                          : "Aucun seuil configuré · Tap pour commencer";
                      })()}
                    </div>
                  </div>
                </div>
                <span style={{ color: alerts.length > 0 ? "var(--danger)" : "var(--accent)", fontSize: ".85rem" }}>›</span>
              </button>
              {showSuiviModal && (
                <SuiviModal
                  onClose={() => setShowSuiviModal(false)}
                  categories={data.categories}
                  transactions={data.transactions}
                  fixedExpenses={data.fixedExpenses}
                  thresholds={categoryThresholds}
                  onSaveThreshold={onSaveCategoryThreshold}
                />
              )}
            </>
          );
        })()}

        {/* Budgets par tag (v1.41.0) — mois en cours pour les budgets mensuels */}
        {(() => {
          const ym = currentYM();
          return <TagBudgetBars
            items={computeTagBudgets(data.tags, data.transactions, ym)}
            monthLabel={MONTHS_FR[parseInt(ym.slice(5, 7), 10) - 1].toLowerCase()} />;
        })()}

        {/* Montants à part — agrégat annuel, purement informatif */}
        {(() => {
          const yearStr = currentYear.toString();
          const curYM   = currentYM();
          const isCurYear = yearStr === curYM.slice(0, 4);
          const sideTypes = data.sideAmountTypes || [];

          const sideTxs = (data.transactions || []).filter(t =>
            t.date.startsWith(yearStr) && t.type === "expense" &&
            Object.values(t.sideAmounts || {}).some(v => (parseFloat(v) || 0) > 0)
          );
          if (sideTxs.length === 0) return null;

          const txSideTotal = t => Object.values(t.sideAmounts || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);

          const totalSide  = sideTxs.reduce((s, t) => s + txSideTotal(t), 0);
          const totalPaid  = sideTxs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
          const totalBudget = totalPaid + totalSide;
          const thisMonthSide = isCurYear
            ? sideTxs.filter(t => t.date.startsWith(curYM)).reduce((s, t) => s + txSideTotal(t), 0)
            : null;

          // Répartition par type de montant à part (TR, carte cadeau…)
          const byType = {};
          sideTxs.forEach(t => Object.entries(t.sideAmounts || {}).forEach(([satId, amt]) => {
            byType[satId] = (byType[satId] || 0) + (parseFloat(amt) || 0);
          }));
          const typeRows = Object.entries(byType)
            .sort((a, b) => b[1] - a[1])
            .map(([satId, amt]) => ({ st: sideTypes.find(s => s.id === satId), amt }));

          // Répartition par catégorie (toutes types de montant à part confondus)
          const byCat = {};
          sideTxs.forEach(t => { byCat[t.categoryId] = (byCat[t.categoryId] || 0) + txSideTotal(t); });
          const catRows = Object.entries(byCat)
            .sort((a, b) => b[1] - a[1])
            .map(([catId, amt]) => ({ cat: data.categories.find(c => c.id === catId), amt }));

          return (
            <div style={{
              background: "linear-gradient(135deg,#1a1508,#241c0a)", border: "1px solid rgba(200,184,96,.25)",
              borderRadius: 16, padding: 16, marginBottom: 12,
            }}>
              <div style={{ fontSize: ".64rem", color: "rgba(255,255,255,.6)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                🎫 Montants à part — {currentYear}
              </div>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--warning)" }}>{fmt(totalSide)}</div>
              <div style={{ fontSize: ".62rem", color: "rgba(255,255,255,.5)", marginTop: 4 }}>
                Sur {sideTxs.length} opération{sideTxs.length > 1 ? "s" : ""} cette année
                {thisMonthSide != null && thisMonthSide > 0 && ` · dont ${fmt(thisMonthSide)} ce mois-ci`}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <div style={{ flex: 1, textAlign: "center", padding: "9px 4px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
                  <div style={{ fontSize: ".56rem", color: "rgba(255,255,255,.5)", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Payé (banque)</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: ".78rem", fontWeight: 800, color: "var(--danger)" }}>{fmt(totalPaid)}</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", padding: "9px 4px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
                  <div style={{ fontSize: ".56rem", color: "rgba(255,255,255,.5)", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Montants à part</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: ".78rem", fontWeight: 800, color: "var(--warning)" }}>{fmt(totalSide)}</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", padding: "9px 4px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
                  <div style={{ fontSize: ".56rem", color: "rgba(255,255,255,.5)", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Budget réel</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: ".78rem", fontWeight: 800, color: "#fff" }}>{fmt(totalBudget)}</div>
                </div>
              </div>

              {typeRows.length > 1 && (
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  {typeRows.map(({ st, amt }) => (
                    <div key={st?.id || "—"} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" }}>
                      <span style={{ fontSize: ".68rem" }}>{st?.icon || "🎫"}</span>
                      <span style={{ fontSize: ".62rem", color: "rgba(255,255,255,.7)" }}>{st?.label || "—"}</span>
                      <span style={{ fontSize: ".64rem", fontWeight: 800, color: "var(--warning)" }}>{fmt(amt)}</span>
                    </div>
                  ))}
                </div>
              )}

              {catRows.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.1)" }}>
                  {catRows.map(({ cat, amt }) => (
                    <div key={cat?.id || "—"} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: ".64rem", color: "rgba(255,255,255,.75)" }}>
                      <span>{cat?.icon || "🎫"} {cat?.name || "Sans catégorie"}</span>
                      <span style={{ fontWeight: 800, color: "var(--warning)" }}>{fmt(amt)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: ".58rem", color: "rgba(255,255,255,.4)", marginTop: 10, lineHeight: 1.5 }}>
                "Budget réel" = ce qui est sorti de ton compte + montants à part. N'affecte jamais ton solde.
              </div>
            </div>
          );
        })()}

        <button onClick={() => setShowTagsModal(true)} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderLeft: "3px solid var(--purple)", borderRadius: "var(--radius-sm)",
          padding: "11px 14px", marginBottom: 12, cursor: "pointer",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.1rem" }}>🏷️</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text)" }}>
                Tags
                {tags.length > 0 && <span style={{ marginLeft: 7, fontSize: ".58rem", background: "rgba(176,144,224,.15)", color: "var(--purple)", padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>{tags.length}</span>}
              </div>
              <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 1 }}>Suivi par projet, événement ou période</div>
            </div>
          </div>
          <span style={{ color: "var(--purple)", fontSize: ".85rem" }}>›</span>
        </button>
        {showTagsModal && (
          <TagsModal
            onClose={() => setShowTagsModal(false)}
            tags={tags}
            transactions={data.transactions}
            fixedExpenses={data.fixedExpenses}
            categories={data.categories}
            onSaveTag={onSaveTag}
            onDeleteTag={onDeleteTag}
          />
        )}

        {/* Bouton analyse catégorie */}
        <button onClick={() => setShowCatModal(true)} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderLeft: "3px solid var(--accent)", borderRadius: "var(--radius-sm)",
          padding: "11px 14px", marginBottom: 12, cursor: "pointer",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.1rem" }}>📊</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text)" }}>Analyse par catégorie</div>
              <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 1 }}>Détail mensuel et annuel d'un poste</div>
            </div>
          </div>
          <span style={{ color: "var(--accent)", fontSize: ".85rem" }}>›</span>
        </button>

        {/* Modal analyse catégorie */}
        {showCatModal && (
          <CategoryDetailModal
            onClose={() => setShowCatModal(false)}
            categories={data.categories}
            transactions={data.transactions}
            fixedExpenses={data.fixedExpenses}
          />
        )}
        <button onClick={() => setShowSavModal(true)} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderLeft: "3px solid var(--purple)", borderRadius: "var(--radius-sm)",
          padding: "11px 14px", marginBottom: 12, cursor: "pointer",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.1rem" }}>🐷</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text)" }}>Taux d'épargne</div>
              <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 1 }}>Voir l'évolution et les objectifs</div>
            </div>
          </div>
          <span style={{ color: "var(--purple)", fontSize: ".85rem" }}>›</span>
        </button>

        {/* Modal taux d'épargne */}
        {showSavModal && (
          <SavingsRateModal
            onClose={() => setShowSavModal(false)}
            transactions={data.transactions}
            fixedExpenses={data.fixedExpenses}
            currentYear={currentYear}
          />
        )}

      {/* ① Hero card avec donut */}
      <div style={{
        background: "linear-gradient(135deg, #0c1830 0%, #182a48 100%)",
        borderRadius: "var(--radius)", padding: 16, marginBottom: 12,
        boxShadow: "0 4px 24px rgba(112,184,224,.15)", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160, borderRadius:"50%", background:"radial-gradient(circle, rgba(112,184,224,.15) 0%, transparent 70%)", pointerEvents:"none" }}/>
        <div style={{ position:"absolute", bottom:-30, left:10, width:100, height:100, borderRadius:"50%", background:"radial-gradient(circle, rgba(176,144,224,.1) 0%, transparent 70%)", pointerEvents:"none" }}/>
        <div style={{ fontSize: ".58rem", color: "rgba(255,255,255,.55)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 12, position: "relative" }}>
          📊 Bilan {currentYear}
        </div>
        <div style={{ position: "relative" }}>
          <RapportDonut inc={yInc} exp={yExp} sav={ySav} />
        </div>
      </div>

      {/* ④ Moyennes mensuelles */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <SectionTitle style={{ marginBottom: 10 }}>📈 Moyennes / mois ({n} mois actifs)</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { l: "💰 Revenu",  v: avgInc, c: "var(--success)" },
            { l: "💸 Dépense", v: avgExp, c: "var(--danger)"  },
            { l: "📊 Solde",   v: avgNet, c: avgNet>=0?"var(--success)":"var(--danger)" },
          ].map(s => (
            <div key={s.l} style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "10px 8px", textAlign: "center", borderTop: `2.5px solid ${s.c}` }}>
              <div style={{ fontSize: ".55rem", color: "var(--text2)", fontWeight: 700, marginBottom: 5, lineHeight: 1.3 }}>{s.l}</div>
              <div style={{ fontFamily: "var(--mono)", fontWeight: 800, color: s.c, fontSize: ".72rem", fontVariantNumeric: "tabular-nums" }}>
                {s.l==="📊 Solde"&&s.v>=0?"+":""}{fmt(s.v)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ② Graphique avec filtre */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="stat-label">Flux mensuels — tape un mois</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[["all","Tout"],["inc","💰"],["exp","💸"]].map(([k,l]) => (
              <button key={k} onClick={() => setChartFilter(k)} style={{
                background: chartFilter===k ? "var(--accent-glow)" : "transparent",
                border: `1px solid ${chartFilter===k ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 7, padding: "4px 9px",
                color: chartFilter===k ? "var(--accent)" : "var(--text3)",
                fontSize: ".65rem", fontWeight: 700, cursor: "pointer",
              }}>{l}</button>
            ))}
          </div>
        </div>
        <ChartSVG months={months} chartFilter={chartFilter} onMonthClick={i => onShowMonthDetail(currentYear, i)} />
        <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {chartFilter !== "exp" && <span style={{ color: "var(--success)" }}>■ Revenus</span>}
          {chartFilter !== "inc" && <span style={{ color: "var(--danger)"  }}>■ Dépenses</span>}
          {chartFilter === "all" && <span style={{ color: "var(--accent)"  }}>— Solde net</span>}
        </div>
      </div>

      {/* ③ Classement des mois */}
      {ranked.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <SectionTitle style={{ marginBottom: 10 }}>🏆 Classement des mois</SectionTitle>
          {ranked.map((m, i) => {
            const maxAbs = Math.max(...ranked.map(r => Math.abs(r.net)), 1);
            const pct    = (Math.abs(m.net) / maxAbs) * 100;
            const medal  = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            const color  = m.net >= 0 ? "var(--success)" : "var(--danger)";
            return (
              <div key={m.label}
                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}
                onClick={() => onShowMonthDetail(currentYear, m.idx)}>
                <span style={{ fontSize: medal ? ".9rem" : ".65rem", width: 22, textAlign: "center", color: "var(--text3)", fontWeight: 700, flexShrink: 0 }}>
                  {medal || `${i+1}`}
                </span>
                <span style={{ fontSize: ".72rem", fontWeight: 700, width: 30, flexShrink: 0 }}>{m.label}</span>
                <div style={{ flex: 1, height: 5, background: "var(--surface3)", borderRadius: 99 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99 }}/>
                </div>
                <span style={{ fontFamily: "var(--mono)", fontSize: ".68rem", fontWeight: 800, color, width: 75, textAlign: "right", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                  {m.net >= 0 ? "+" : ""}{fmt(m.net)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ⑤ Objectif épargne annuel */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <SectionTitle>🎯 Objectif épargne {currentYear}</SectionTitle>
          <button onClick={() => { setGoalInput(String(savGoal)); setEditGoal(e => !e); }} style={{
            background: "var(--accent-glow)", border: "1px solid var(--accent-glow)",
            borderRadius: 7, padding: "4px 10px", color: "var(--accent)",
            fontSize: ".62rem", fontWeight: 700, cursor: "pointer",
          }}>{editGoal ? "✓ OK" : "✏️"}</button>
        </div>
        {editGoal && (
          <input type="number" value={goalInput} min="0" step="100"
            onChange={e => setGoalInput(e.target.value)}
            onBlur={() => { setSavGoal(parseFloat(goalInput)||0); setEditGoal(false); }}
            placeholder="Ex : 5000"
            style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontSize: ".9rem", fontFamily: "var(--mono)", boxSizing: "border-box", marginBottom: 10 }}
            autoFocus/>
        )}
        {savGoal > 0 ? (() => {
          const pct   = Math.min(100, (ySav / savGoal) * 100);
          const color = pct >= 100 ? "var(--success)" : pct >= 60 ? "var(--accent)" : "var(--warning)";
          return (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".62rem", color: "var(--text2)", marginBottom: 5 }}>
                <span>{fmt(ySav)} épargné</span>
                <span style={{ color, fontWeight: 800 }}>{pct.toFixed(0)}%</span>
              </div>
              <div style={{ height: 8, background: "var(--surface3)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, var(--accent), ${color})`, borderRadius: 99, transition: "width .5s" }}/>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".58rem", color: "var(--text3)", marginTop: 4 }}>
                <span>0 €</span><span>Objectif : {fmt(savGoal)}</span>
              </div>
            </>
          );
        })() : (
          <div style={{ fontSize: ".72rem", color: "var(--text3)", textAlign: "center", padding: "8px 0" }}>
            Tape ✏️ pour définir un objectif d'épargne annuel
          </div>
        )}
      </div>
      </>)}

      {/* ══ ANALYSE : top 5 + évolution + comparaison N/N-1 + analyses ══ */}
      {rapportTab === "analyse" && (<>
        <SectionTitle>Top 5 dépenses</SectionTitle>
        <div className="card" style={{ padding: 14 }}>
          {top5.length === 0
            ? <p style={{ fontSize: ".78rem", color: "var(--text3)", textAlign: "center", padding: "12px 0" }}>Aucune dépense enregistrée</p>
            : top5.map(([id, val], i) => {
                const cat  = categories.find(c => c.id === id);
                const name = id === "__fixes__" ? "📌 Frais fixes" : id === "__other__" ? "❓ Sans catégorie" : `${cat?.icon ?? ""} ${cat?.name ?? id}`;
                const pct  = (val / topTotal * 100).toFixed(0);
                const rank = ["🥇","🥈","🥉","4️⃣","5️⃣"][i];
                return (
                  <div key={id} className="top3-item">
                    <span className="top3-rank">{rank}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: ".78rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                      <div className="top3-bar-bg" style={{ marginTop: 5 }}>
                        <div className="top3-bar-fill" style={{ width: `${pct}%`, background: PALETTE[i] }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                      <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: ".78rem", fontVariantNumeric: "tabular-nums", color: PALETTE[i] }}>{fmt(val)}</div>
                      <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 1 }}>{pct}%</div>
                    </div>
                  </div>
                );
              })
          }
        </div>

        <SectionTitle>Évolution du solde net</SectionTitle>
        <div className="card" style={{ padding: 14 }}>
          <PatrimoineSVG months={months} />
          <div style={{ display: "flex", gap: 12, fontSize: ".58rem", color: "var(--text3)", marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ color: "var(--success)" }}>■ Positif</span>
            <span style={{ color: "var(--danger)"  }}>■ Négatif</span>
          </div>
        </div>

        <SectionTitle>Comparaison Annuelle</SectionTitle>
        <div className="card" style={{ padding: 10 }}>
          <table className="comp-table">
            <thead>
              <tr>
                <th>Poste</th>
                <th style={{ textAlign: "right" }}>{currentYear}</th>
                <th style={{ textAlign: "right" }}>{currentYear - 1}</th>
              </tr>
            </thead>
            <tbody>
              {compRows.map(r => {
                const diff = r.v1 - r.v0;
                const isGood = diff === 0 ? null : (r.higherIsBetter ? diff > 0 : diff < 0);
                const arrowColor = isGood === null ? "var(--text3)" : isGood ? "var(--success)" : "var(--danger)";
                const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "—";
                return (
                  <tr key={r.label}>
                    <td style={{ fontWeight: 600, fontSize: ".78rem" }}>{r.label}</td>
                    <td style={{ color: r.color }}>{fmt(r.v1)}</td>
                    <td style={{ color: "var(--text2)" }}>
                      {fmt(r.v0)}{" "}
                      <span style={{ color: arrowColor, fontSize: ".65rem" }}>{arrow}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <AnalysteLocal data={data} currentYear={currentYear} months={months} />
      </>)}

      {/* ══ COMPARAISON : 2 périodes + notes ══ */}
      {rapportTab === "comparaison" && (<>
        <PeriodCompare transactions={data.transactions} fixedExpenses={data.fixedExpenses} />
        <MonthNotes currentYear={currentYear} monthNotes={monthNotes} onSave={onSaveMonthNote} />
      </>)}
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

  let inc = 0, exp = 0, sav = 0;
  const byMonth = {};
  transactions.filter(t => t.date.startsWith(yStr)).forEach(t => {
    const a = parseFloat(t.amount) || 0;
    const mon = t.date.slice(0, 7);
    if (!byMonth[mon]) byMonth[mon] = { inc: 0, exp: 0, net: 0 };
    if (isIncome(t.type))          { inc += a; byMonth[mon].inc += a; }
    else if (t.type === "expense") {
      exp += a; byMonth[mon].exp += a;
    }
    else if (t.type === "epargne") sav += a;
  });
  if (isCurY) {
    if (!byMonth[curYM]) byMonth[curYM] = { inc: 0, exp: 0, net: 0 };
    byMonth[curYM].exp += tf;
  }
  Object.values(byMonth).forEach(m => { m.net = m.inc - m.exp; });

  const totalExp   = exp + (isCurY ? tf : 0);
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
