// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState } from "react";
import { fmt, isIncome } from "../utils.js";
import { isIncomeDirection } from "../hooks.js";

// ─────────────────────────────────────────────────────────────────
//  SectionTitle — police renforcée, appliquée partout
// ─────────────────────────────────────────────────────────────────
export function SectionTitle({ children, style }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, ...style }}>
      <div style={{ width:3, height:16, background:"var(--accent)", borderRadius:2, flexShrink:0 }}/>
      <span style={{ fontWeight:800, fontSize:".54rem", letterSpacing:".1em", textTransform:"uppercase", color:"var(--text2)" }}>
        {children}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  EmptyIllustration — empty states avec SVG contextuel
// ─────────────────────────────────────────────────────────────────
export const EMPTY_SVG = {
  transactions: (
    <svg viewBox="0 0 120 90" width="110" height="82">
      <rect x="15" y="20" width="90" height="55" rx="10" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1.5"/>
      <rect x="15" y="20" width="90" height="16" rx="10" fill="var(--surface3)"/>
      <rect x="15" y="28" width="90" height="8" fill="var(--surface3)"/>
      <rect x="26" y="44" width="40" height="5" rx="2.5" fill="var(--border)"/>
      <rect x="26" y="54" width="28" height="4" rx="2"   fill="var(--border-soft)"/>
      <rect x="26" y="63" width="35" height="4" rx="2"   fill="var(--border-soft)"/>
      <rect x="80" y="44" width="18" height="5" rx="2.5" fill="var(--border)"/>
      <rect x="82" y="54" width="14" height="4" rx="2"   fill="var(--border-soft)"/>
      <circle cx="86" cy="25" r="10" fill="var(--bg)" stroke="var(--accent)" strokeWidth="1.5"/>
      <circle cx="86" cy="25" r="5.5" fill="none" stroke="var(--accent)" strokeWidth="1.5"/>
      <line x1="90" y1="29" x2="94" y2="33" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
      <text x="86" y="27.5" textAnchor="middle" fontSize="5.5" fill="var(--accent)" fontWeight="800">?</text>
    </svg>
  ),
  cagnottes: (
    <svg viewBox="0 0 120 90" width="110" height="82">
      <ellipse cx="58" cy="52" rx="28" ry="22" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1.5"/>
      <ellipse cx="84" cy="46" rx="6"  ry="5"  fill="var(--surface2)" stroke="var(--border)" strokeWidth="1.5"/>
      <ellipse cx="58" cy="28" rx="7"  ry="3"  fill="var(--warning)" opacity=".9"/>
      <line x1="58" y1="31" x2="58" y2="36" stroke="var(--warning)" strokeWidth="1.5" strokeDasharray="2,2"/>
      <rect x="51" y="30" width="14" height="2.5" rx="1.25" fill="var(--border)"/>
      <circle cx="50" cy="48" r="2.5" fill="var(--accent)"/>
      <circle cx="64" cy="48" r="2.5" fill="var(--accent)"/>
      <path d="M50 56 Q57 62 66 56" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="42" y="70" width="6" height="8" rx="3" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1.2"/>
      <rect x="52" y="70" width="6" height="8" rx="3" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1.2"/>
      <rect x="62" y="70" width="6" height="8" rx="3" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1.2"/>
      <rect x="72" y="70" width="6" height="8" rx="3" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1.2"/>
      <path d="M86 54 Q96 50 94 58 Q92 66 86 62" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  fixes: (
    <svg viewBox="0 0 120 90" width="110" height="82">
      <rect x="20" y="22" width="80" height="58" rx="8" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1.5"/>
      <rect x="20" y="22" width="80" height="18" rx="8" fill="var(--surface3)"/>
      <rect x="20" y="30" width="80" height="10" fill="var(--surface3)"/>
      <rect x="38" y="16" width="5" height="12" rx="2.5" fill="var(--accent2)"/>
      <rect x="77" y="16" width="5" height="12" rx="2.5" fill="var(--accent2)"/>
      <text x="60" y="36" textAnchor="middle" fontSize="6" fill="var(--text)" fontWeight="700">MENSUEL</text>
      {[0,1,2,3,4,5,6].map(i => (
        <rect key={i} x={27+i*10} y="48" width="7" height="7" rx="2"
          fill={i===0 ? "var(--accent)" : "var(--border-soft)"} opacity={i===0?1:.7}/>
      ))}
      {[0,1,2,3,4,5,6].map(i => (
        <rect key={i} x={27+i*10} y="59" width="7" height="7" rx="2" fill="var(--border-soft)" opacity=".5"/>
      ))}
      <circle cx="90" cy="22" r="10" fill="var(--bg)" stroke="var(--accent2)" strokeWidth="1.5"/>
      <text x="90" y="26" textAnchor="middle" fontSize="11">📌</text>
    </svg>
  ),
  historique: (
    <svg viewBox="0 0 120 90" width="110" height="82">
      <rect x="18" y="15" width="84" height="62" rx="9" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1.5"/>
      {[0,1,2,3].map(i => (
        <g key={i}>
          <rect x="28" y={26+i*12} width="32" height="4" rx="2" fill="var(--border)" opacity={1-.15*i}/>
          <rect x="28" y={31+i*12} width="22" height="3" rx="1.5" fill="var(--border-soft)" opacity={.7-.1*i}/>
          <rect x="82" y={26+i*12} width="14" height="4" rx="2" fill={i===0?"var(--success)":i===1?"var(--danger)":"var(--border)"} opacity={i<2?".4":".25"}/>
        </g>
      ))}
      <circle cx="92" cy="18" r="11" fill="var(--bg)" stroke="var(--warning)" strokeWidth="1.5"/>
      <text x="92" y="22.5" textAnchor="middle" fontSize="11">📋</text>
    </svg>
  ),
  operations: (
    <svg viewBox="0 0 120 90" width="110" height="82">
      <rect x="10" y="25" width="100" height="16" rx="8" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1.5" opacity=".9"/>
      <rect x="10" y="46" width="100" height="16" rx="8" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1.5" opacity=".65"/>
      <rect x="10" y="67" width="100" height="16" rx="8" fill="var(--surface2)" stroke="var(--border)" strokeWidth="1.5" opacity=".35"/>
      <circle cx="25" cy="33" r="5" fill="var(--border)"/>
      <rect x="35" y="29" width="28" height="3.5" rx="1.75" fill="var(--border)"/>
      <rect x="35" y="35" width="18" height="2.5" rx="1.25" fill="var(--border-soft)"/>
      <rect x="88" y="30" width="16" height="5" rx="2.5" fill="var(--border)"/>
      <text x="60" y="10" textAnchor="middle" fontSize="14">💸</text>
    </svg>
  ),
};

export function EmptyIllustration({ type = "transactions", title, sub, cta, onCta, ctaColor = "var(--accent)" }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "28px 20px 24px", textAlign: "center",
      animation: "fade-in .35s ease",
    }}>
      <div style={{ marginBottom: 14, filter: "drop-shadow(0 0 14px rgba(126,207,255,.1))" }}>
        {EMPTY_SVG[type] || EMPTY_SVG.transactions}
      </div>
      <div style={{ fontSize: ".85rem", fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>{title}</div>
      {sub && <div style={{ fontSize: ".7rem", color: "var(--text2)", lineHeight: 1.5, maxWidth: 220, marginBottom: cta ? 16 : 0 }}>{sub}</div>}
      {cta && (
        <button onClick={onCta} style={{
          background: "transparent", border: `1.5px solid ${ctaColor}`,
          borderRadius: 10, padding: "8px 22px",
          color: ctaColor, fontWeight: 700, fontSize: ".78rem", cursor: "pointer",
        }}>{cta}</button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  ACCUEIL
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
//  Écran de verrou PIN
// ─────────────────────────────────────────────────────────────────
export async function sha256hex(str) {
  const buf  = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}
// ─────────────────────────────────────────────────────────────────
export const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

// ─────────────────────────────────────────────────────────────────
//  Modal Tags transversaux
// ─────────────────────────────────────────────────────────────────
export const TAG_COLORS = ["#70b8e0","#68d498","#b090e0","#c87070","#c8b860","#88c880","#e08870"];
export const TAG_ICONS  = ["🏖️","🎉","🔨","✈️","🎓","🏥","🎁","🍽️","🏠","💼","🌿","🎮"];

export function TagsModal({ onClose, tags, transactions, fixedExpenses, categories, onSaveTag, onDeleteTag }) {
  const [selTagId, setSelTagId]  = useState(tags[0]?.id || null);
  const [newName,  setNewName]   = useState("");
  const [newIcon,  setNewIcon]   = useState("🏷️");
  const [newColor, setNewColor]  = useState(TAG_COLORS[0]);
  const [creating, setCreating]  = useState(false);
  const [tab,      setTab]       = useState(tags.length > 0 ? "view" : "manage");

  const selTag = tags.find(t => t.id === selTagId);
  const tagTxs = selTagId ? transactions.filter(t => (t.tagIds || []).includes(selTagId)) : [];
  const totalExp = tagTxs.filter(t => t.type === "expense").reduce((s,t)=>s+(parseFloat(t.amount)||0),0);
  const totalInc = tagTxs.filter(t => isIncome(t.type)).reduce((s,t)=>s+(parseFloat(t.amount)||0),0);

  function createTag() {
    if (!newName.trim()) return;
    onSaveTag?.({ name: newName.trim(), icon: newIcon, color: newColor });
    setNewName(""); setCreating(false);
  }

  return (
    <div className="modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div className="modal-title" style={{ marginBottom:0 }}>🏷️ Tags</div>
          <button onClick={onClose} style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:8, padding:"6px 10px", color:"var(--text2)", cursor:"pointer", fontSize:".75rem" }}>✕</button>
        </div>

        {/* Onglets */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:14 }}>
          {[["view","📊 Par tag"],["manage","⚙️ Gérer"]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              background:tab===k?"rgba(176,144,224,.1)":"transparent",
              border:`1.5px solid ${tab===k?"var(--purple)":"var(--border)"}`,
              borderRadius:10, padding:"9px 0",
              color:tab===k?"var(--purple)":"var(--text2)",
              fontWeight:700, fontSize:".7rem", cursor:"pointer",
            }}>{l}</button>
          ))}
        </div>

        {/* ── Vue par tag ── */}
        {tab === "view" && (
          tags.length === 0 ? (
            <div style={{ textAlign:"center", padding:"24px 0", color:"var(--text3)" }}>
              <div style={{ fontSize:"2rem", marginBottom:10 }}>🏷️</div>
              <div style={{ fontSize:".78rem", fontWeight:700, marginBottom:6 }}>Aucun tag créé</div>
              <button onClick={()=>setTab("manage")} style={{ background:"var(--purple)", border:"none", borderRadius:9, padding:"9px 20px", color:"var(--bg)", fontWeight:800, fontSize:".72rem", cursor:"pointer" }}>
                Créer un tag →
              </button>
            </div>
          ) : (
            <div>
              {/* Sélecteur de tags */}
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:12 }}>
                {tags.map(tag=>(
                  <button key={tag.id} onClick={()=>setSelTagId(tag.id)} style={{
                    display:"flex", alignItems:"center", gap:4,
                    padding:"5px 12px",
                    background: selTagId===tag.id ? `${tag.color}22` : "transparent",
                    border:`1.5px solid ${selTagId===tag.id ? tag.color : "var(--border)"}`,
                    borderRadius:20, cursor:"pointer",
                    color: selTagId===tag.id ? tag.color : "var(--text2)",
                    fontSize:".68rem", fontWeight:700,
                  }}>
                    <span>{tag.icon}</span> {tag.name}
                  </button>
                ))}
              </div>

              {selTag && (
                <div>
                  {/* Hero résumé */}
                  <div style={{ background:"linear-gradient(135deg,#0c1830,#182a48)", borderRadius:12, padding:"12px 14px", marginBottom:10, borderLeft:`3px solid ${selTag.color}` }}>
                    <div style={{ fontSize:".58rem", color:"rgba(255,255,255,.5)", marginBottom:6 }}>{selTag.icon} {selTag.name} · {tagTxs.length} opération{tagTxs.length!==1?"s":""}</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                      {[
                        {l:"Dépenses",   v:totalExp, c:"var(--danger)"},
                        {l:"Remboursé",  v:totalInc, c:"var(--success)", hidden:totalInc===0},
                        {l:"Net",        v:totalExp-totalInc, c:"#fff"},
                      ].map(s=>(
                        <div key={s.l} style={{ opacity:s.hidden?.4:1 }}>
                          <div style={{ fontSize:".52rem", color:"rgba(255,255,255,.4)", marginBottom:2 }}>{s.l}</div>
                          <div style={{ fontFamily:"var(--mono)", fontWeight:800, color:s.c, fontSize:".82rem" }}>{fmt(s.v)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Transactions */}
                  {tagTxs.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"14px 0", fontSize:".68rem", color:"var(--text3)" }}>Aucune transaction avec ce tag</div>
                  ) : (
                    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
                      {[...tagTxs].sort((a,b)=>b.date.localeCompare(a.date)).map((t,i)=>{
                        const cat = categories.find(c=>c.id===t.categoryId);
                        const isInc = isIncomeDirection(t);
                        return (
                          <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", borderBottom:i<tagTxs.length-1?"1px solid var(--border-soft)":"none" }}>
                            <span style={{ fontSize:".85rem" }}>{cat?.icon||"💸"}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:".72rem", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.note || cat?.name || "—"}</div>
                              <div style={{ fontSize:".58rem", color:"var(--text3)", marginTop:1 }}>{t.date} · {cat?.name}</div>
                            </div>
                            <span style={{ fontFamily:"var(--mono)", fontWeight:800, fontSize:".75rem", color:isInc?"var(--success)":"var(--danger)", flexShrink:0 }}>
                              {isInc?"+":"−"}{fmt(t.amount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        )}

        {/* ── Gérer les tags ── */}
        {tab === "manage" && (
          <div>
            {/* Liste existants */}
            {tags.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:12 }}>
                {tags.map(tag=>{
                  const count = transactions.filter(t=>(t.tagIds||[]).includes(tag.id)).length;
                  return (
                    <div key={tag.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"var(--surface)", border:"1px solid var(--border)", borderLeft:`3px solid ${tag.color}`, borderRadius:10 }}>
                      <span style={{ fontSize:"1rem" }}>{tag.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:".72rem", fontWeight:700 }}>{tag.name}</div>
                        <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>{count} transaction{count!==1?"s":""}</div>
                      </div>
                      <button
                        onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();e.preventDefault();onDeleteTag?.(tag.id);}}
                        onClick={()=>onDeleteTag?.(tag.id)}
                        style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:7, padding:"5px 9px", color:"var(--text3)", fontSize:".72rem", cursor:"pointer", minHeight:30, touchAction:"manipulation" }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Créer nouveau */}
            {!creating ? (
              <button onClick={()=>setCreating(true)} style={{ width:"100%", background:"transparent", border:"1.5px dashed var(--purple)", borderRadius:10, padding:"11px", color:"var(--purple)", fontWeight:700, fontSize:".75rem", cursor:"pointer" }}>
                ＋ Créer un nouveau tag
              </button>
            ) : (
              <div style={{ background:"var(--surface)", border:"1.5px solid var(--purple)", borderRadius:12, padding:14 }}>
                <div style={{ fontSize:".65rem", fontWeight:800, color:"var(--purple)", marginBottom:10 }}>Nouveau tag</div>
                <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nom du tag…"
                  style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--accent)", borderRadius:8, padding:"9px 12px", color:"var(--text)", fontSize:".8rem", marginBottom:10, boxSizing:"border-box" }} />
                <div style={{ fontSize:".6rem", color:"var(--text2)", fontWeight:700, marginBottom:6 }}>Icône</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
                  {TAG_ICONS.map(ic=>(
                    <button key={ic} onClick={()=>setNewIcon(ic)} style={{ width:32, height:32, background:newIcon===ic?"var(--accent-glow)":"transparent", border:`1px solid ${newIcon===ic?"var(--accent)":"var(--border)"}`, borderRadius:7, fontSize:"1rem", cursor:"pointer" }}>{ic}</button>
                  ))}
                </div>
                <div style={{ fontSize:".6rem", color:"var(--text2)", fontWeight:700, marginBottom:6 }}>Couleur</div>
                <div style={{ display:"flex", gap:5, marginBottom:12 }}>
                  {TAG_COLORS.map(col=>(
                    <div key={col} onClick={()=>setNewColor(col)} style={{ width:26, height:26, borderRadius:"50%", background:col, border:`2.5px solid ${newColor===col?"#fff":"transparent"}`, cursor:"pointer" }} />
                  ))}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>setCreating(false)} style={{ flex:1, background:"transparent", border:"1px solid var(--border)", borderRadius:9, padding:"9px", color:"var(--text3)", fontWeight:700, fontSize:".72rem", cursor:"pointer" }}>Annuler</button>
                  <button onClick={createTag} style={{ flex:2, background:newName.trim()?"var(--purple)":"var(--surface2)", border:"none", borderRadius:9, padding:"9px", color:newName.trim()?"var(--bg)":"var(--text3)", fontWeight:800, fontSize:".75rem", cursor:"pointer" }}>Créer</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
