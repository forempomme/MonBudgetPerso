import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Delta, Sparkline } from "./components/index.jsx";
import { ChartSVG, PatrimoineSVG } from "./components/charts.jsx";
import { fmt, currentYM, getPrevMonth, isIncome, PALETTE, MONTHS_SHORT, APP_NAME, APP_VERSION, txLabel, txTypeClass, txSign } from "./utils.js";
import {
  useBalanceWithRecurring, useMonthStats, useYearMonths, useYearTotals,
  usePriorYearStats, useTotalFixes,
} from "./hooks.js";

// ─────────────────────────────────────────────────────────────────
//  Pointage — types exclus du rapprochement bancaire
//  decagnottage et transfer sont des mouvements internes
//  entre cagnottes : ils n'apparaissent pas sur un relevé.
// ─────────────────────────────────────────────────────────────────
function isPointable(type) {
  return type !== "decagnottage" && type !== "transfer";
}

// ─────────────────────────────────────────────────────────────────
//  SectionTitle — police renforcée, appliquée partout
// ─────────────────────────────────────────────────────────────────
function SectionTitle({ children, style }) {
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
//  CountUp — chiffre animé de 0 à target
// ─────────────────────────────────────────────────────────────────
function CountUp({ target, duration = 1100, color, style = {} }) {
  const [val, setVal] = useState(0);
  const raf  = useRef(null);
  const t0   = useRef(null);
  useEffect(() => {
    t0.current = null;
    const step = ts => {
      if (!t0.current) t0.current = ts;
      const p    = Math.min((ts - t0.current) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(target * ease);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return <span style={{ color, fontVariantNumeric: "tabular-nums", ...style }}>{fmt(val)}</span>;
}

// ─────────────────────────────────────────────────────────────────
//  SmartIndicator — point coloré Option D (priorité descendante)
// ─────────────────────────────────────────────────────────────────
function SmartIndicator({ balance, curMonthInc, curMonthExp, lastBackupDate, onSwitchTab, alertEnabled, alertThreshold }) {
  const [open, setOpen] = useState(false);

  const daysSinceBackup = lastBackupDate
    ? (Date.now() - new Date(lastBackupDate)) / 86400000
    : 999;

  const status = useMemo(() => {
    if (balance < 0)
      return { color: "#ef4444", glow: "rgba(239,68,68,.5)",   label: "🔴 Solde négatif",              sub: `${fmt(balance)} — revoir les dépenses` };
    if (balance < 100)
      return { color: "#ef4444", glow: "rgba(239,68,68,.4)",   label: "🔴 Solde critique",              sub: `Moins de 100 € restants` };
    if (alertEnabled && alertThreshold > 0 && balance <= alertThreshold)
      return { color: "#ef4444", glow: "rgba(239,68,68,.45)",  label: "🔴 Seuil d'alerte atteint",      sub: `Solde (${fmt(balance)}) sous le seuil de ${fmt(alertThreshold)}`, action: "options" };
    if (daysSinceBackup > 14)
      return { color: "#ef4444", glow: "rgba(239,68,68,.35)",  label: "🔴 Sauvegarde urgente",          sub: `${Math.floor(daysSinceBackup)} jours sans backup`, action: "options" };
    if (curMonthExp > curMonthInc && curMonthInc > 0)
      return { color: "#fbbf24", glow: "rgba(251,191,36,.5)",  label: "🟡 Dépenses > revenus",          sub: `Ce mois : −${fmt(curMonthExp - curMonthInc)}` };
    if (balance < 500)
      return { color: "#fbbf24", glow: "rgba(251,191,36,.4)",  label: "🟡 Solde faible",                sub: `Moins de 500 € — sois vigilant` };
    if (daysSinceBackup > 7)
      return { color: "#fbbf24", glow: "rgba(251,191,36,.35)", label: "🟡 Sauvegarde recommandée",      sub: `${Math.floor(daysSinceBackup)} jours sans backup`, action: "options" };
    return   { color: "#4ade80", glow: "rgba(74,222,128,.5)",  label: "🟢 Tout va bien",               sub: `Budget équilibré, solde sain` };
  }, [balance, curMonthInc, curMonthExp, daysSinceBackup, alertEnabled, alertThreshold]);

  return (
    <div style={{ position: "absolute", top: 18, right: 18, zIndex: 10 }}>
      {/* Point */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          width: 11, height: 11, borderRadius: "50%",
          background: status.color,
          boxShadow: `0 0 8px ${status.glow}`,
          cursor: "pointer",
          animation: "pulse-indicator 2s infinite",
        }}
      />
      {/* Bulle tooltip */}
      {open && (
        <div style={{
          position: "absolute", top: 18, right: 0,
          background: "#141618", border: `1px solid ${status.color}`,
          borderRadius: 10, padding: "10px 12px", width: 200,
          boxShadow: `0 4px 20px rgba(0,0,0,.5)`,
          animation: "fade-in-down .15s ease",
          zIndex: 50,
        }}>
          <div style={{ fontSize: ".72rem", fontWeight: 800, color: status.color, marginBottom: 4 }}>
            {status.label}
          </div>
          <div style={{ fontSize: ".65rem", color: "#8899aa", lineHeight: 1.5 }}>
            {status.sub}
          </div>
          {status.action && (
            <button
              onClick={() => { setOpen(false); onSwitchTab?.(status.action); }}
              style={{
                marginTop: 8, background: "transparent",
                border: `1px solid ${status.color}`, borderRadius: 6,
                padding: "4px 10px", color: status.color,
                fontSize: ".65rem", fontWeight: 700, cursor: "pointer", width: "100%",
              }}
            >
              Aller aux options →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  EmptyIllustration — empty states avec SVG contextuel
// ─────────────────────────────────────────────────────────────────
const EMPTY_SVG = {
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

function EmptyIllustration({ type = "transactions", title, sub, cta, onCta, ctaColor = "var(--accent)" }) {
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
async function sha256hex(str) {
  const buf  = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

export function LockScreen({ pinHash, bioEnabled, onUnlock }) {
  const [pin,   setPin]   = useState("");
  const [error, setError] = useState(false);

  async function tryBio() {
    try {
      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
      await BiometricAuth.authenticate({ reason: "Accéder à Gestion du Budget" });
      onUnlock();
    } catch {
      // Biométrie indisponible ou refusée → PIN de secours affiché
    }
  }

  // Déclenche automatiquement la biométrie à l'ouverture
  // Délai 300ms : le bridge Capacitor n'est pas encore initialisé au premier render
  useEffect(() => {
    if (!bioEnabled) return;
    const timer = setTimeout(() => tryBio(), 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pressKey(k) {
    if (k === "⌫") { setPin(p => p.slice(0,-1)); setError(false); return; }
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      const h = await sha256hex(next);
      if (h === pinHash) { onUnlock(); }
      else { setTimeout(() => { setPin(""); setError(true); }, 200); }
    }
  }

  const KEYS = [[1,2,3],[4,5,6],[7,8,9],["",0,"⌫"]];

  return (
    <div style={{ position:"fixed", inset:0, background:"#060810", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, zIndex:9999 }}>
      <div style={{ fontSize:"2.8rem", marginBottom:12 }}>🐷</div>
      <div style={{ fontSize:".95rem", fontWeight:800, marginBottom:4 }}>Gestion du Budget</div>
      <div style={{ fontSize:".65rem", color:"var(--text3)", marginBottom:28 }}>Entre ton code PIN pour continuer</div>

      {/* Points PIN */}
      <div style={{ display:"flex", gap:14, marginBottom:28 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width:14, height:14, borderRadius:"50%", background:i<pin.length?"#fff":"transparent", border:"2px solid rgba(255,255,255,.35)", transition:"background .1s" }} />
        ))}
      </div>

      {error && <div style={{ fontSize:".65rem", color:"var(--danger)", marginBottom:12, fontWeight:700 }}>PIN incorrect, réessaie</div>}

      {/* Biométrie */}
      {bioEnabled && (
        <button onClick={tryBio} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(112,184,224,.1)", border:"1.5px solid var(--accent)", borderRadius:30, padding:"10px 22px", color:"var(--accent)", fontWeight:700, fontSize:".75rem", cursor:"pointer", marginBottom:20, touchAction:"manipulation" }}>
          <span style={{ fontSize:"1.2rem" }}>👆</span> Empreinte digitale
        </button>
      )}

      {/* Clavier */}
      <div style={{ display:"flex", flexDirection:"column", gap:8, width:"100%", maxWidth:240 }}>
        {KEYS.map((row, ri) => (
          <div key={ri} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {row.map((k, ki) => (
              k === ""
                ? <div key={ki} />
                : <button key={ki} onClick={() => pressKey(String(k))}
                    style={{ height:58, background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.1)", borderRadius:12, color:"#fff", fontSize:k==="⌫"?"1.2rem":"1.2rem", fontWeight:700, cursor:"pointer", touchAction:"manipulation" }}>
                    {k}
                  </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AccueilView({ data, onShowDetail, onSwitchTab, onSaveProvisional, onDeleteProvisional, onGoToHistorique, alertEnabled, alertThreshold, roundingEnabled, roundingCagnotteId, roundingLastTransferDate, onMarkRoundingTransferred, editMode = false, onExitEditMode, onDeleteScheduled, onConfirmRecurring }) {

  // Sections masquables — persistées en localStorage
  const [hidden, setHidden] = useState(() => {
    try { return JSON.parse(localStorage.getItem("accueil_hidden") || "[]"); }
    catch { return []; }
  });
  function toggleSection(id) {
    setHidden(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem("accueil_hidden", JSON.stringify(next));
      return next;
    });
  }

  // Wrapper de section masquable
  function Sec({ id, children }) {
    const isHidden = hidden.includes(id);
    if (isHidden && !editMode) return null;
    return (
      <div style={{ position:"relative", opacity: isHidden ? .25 : 1, transition:"opacity .2s" }}>
        {editMode && (
          <button onClick={() => toggleSection(id)} style={{
            position:"absolute", top:4, right:4, zIndex:10,
            background: isHidden ? "var(--accent)" : "var(--surface2)",
            border:`1px solid ${isHidden ? "var(--accent)" : "var(--border)"}`,
            borderRadius:6, padding:"2px 8px",
            fontSize:".52rem", fontWeight:700,
            color: isHidden ? "var(--bg)" : "var(--text3)",
            cursor:"pointer", pointerEvents:"all",
          }}>{isHidden ? "👁 Afficher" : "🚫 Masquer"}</button>
        )}
        {children}
      </div>
    );
  }
  const { transactions, cagnottes, fixedExpenses } = data;
  const provisionalExpenses = data.provisionalExpenses || [];
  const curM      = currentYM();
  const prevM     = getPrevMonth(curM);
  const curY      = new Date().getFullYear().toString();

  const balance   = useBalanceWithRecurring(transactions, fixedExpenses, data.recurringTemplates || []);

  // ── Arrondi stats ─────────────────────────────────────────────
  const roundStats = useMemo(() => {
    if (!roundingEnabled || !roundingCagnotteId) return null;
    const rtxs = transactions.filter(t => t.isRounding && t.targetCagId === roundingCagnotteId);
    const month = rtxs.filter(t => t.date.startsWith(curM)).reduce((s,t)=>s+(parseFloat(t.amount)||0),0);
    const year  = rtxs.filter(t => t.date.startsWith(curY)).reduce((s,t)=>s+(parseFloat(t.amount)||0),0);
    const pending = rtxs
      .filter(t => !roundingLastTransferDate || t.date > roundingLastTransferDate)
      .reduce((s,t)=>s+(parseFloat(t.amount)||0),0);
    const cag = cagnottes.find(c => c.id === roundingCagnotteId);
    return { month, year, pending: parseFloat(pending.toFixed(2)), cagName: cag?.name || "", cagIcon: cag?.icon || "🐷" };
  }, [transactions, roundingEnabled, roundingCagnotteId, roundingLastTransferDate, curM, curY, cagnottes]);
  const curMonth  = useMonthStats(transactions, fixedExpenses, curM);
  const prevMonth = useMonthStats(transactions, fixedExpenses, prevM);
  const tf        = useTotalFixes(fixedExpenses);

  // ── Rapprochement bancaire ────────────────────────────────────
  const { soldePointe, soldeAttente, nbPointed, totalPointable } = useMemo(() => {
    if (!transactions.length) return { soldePointe: 0, soldeAttente: 0, nbPointed: 0, totalPointable: 0 };

    function monthRange(start, end) {
      const list = [];
      let [y, m] = start.split('-').map(Number);
      const [ey, em] = end.split('-').map(Number);
      while (y < ey || (y === ey && m <= em)) {
        list.push(`${y}-${String(m).padStart(2,'0')}`);
        if (++m > 12) { m = 1; y++; }
      }
      return list;
    }
    const startYM = transactions.reduce(
      (min, t) => t.date < min ? t.date : min, transactions[0].date
    ).slice(0, 7);
    const allMonths = monthRange(startYM, curM);

    let ptInc = 0, ptExp = 0, noPtInc = 0, noPtExp = 0;

    // Transactions (toutes périodes)
    transactions.filter(t => isPointable(t.type)).forEach(t => {
      const a = parseFloat(t.amount) || 0;
      const isInc = isIncome(t.type);
      if (t.pointed) { if (isInc) ptInc += a; else ptExp += a; }
      else           { if (isInc) noPtInc += a; else noPtExp += a; }
    });

    // Frais fixes — un état de pointage par mois
    allMonths.forEach(ym => {
      fixedExpenses.forEach(f => {
        const ov = f.monthlyOverrides?.[ym];
        const a  = (ov?.amount ?? f.amount) || 0;
        if (f.pointedMonths?.[ym]) ptExp   += a;
        else                       noPtExp += a;
      });
    });

    const pointableTxs = transactions.filter(t => isPointable(t.type));
    const nbPtTx  = pointableTxs.filter(t => t.pointed).length;
    const nbPtFix = allMonths.reduce((n, ym) =>
      n + fixedExpenses.filter(f => f.pointedMonths?.[ym]).length, 0);
    const totalFix = allMonths.length * fixedExpenses.length;

    return {
      soldePointe:    ptInc  - ptExp,
      soldeAttente:   noPtInc - noPtExp,
      nbPointed:      nbPtTx + nbPtFix,
      totalPointable: pointableTxs.length + totalFix,
    };
  }, [transactions, fixedExpenses, curM]);

  // Year stats (memoised)
  const { yInc, yExp, yExpVar, yDecag, ySav } = useMemo(() => {
    let yInc=0, yExp=0, yExpVar=0, yDecag=0, ySav=0;
    transactions.filter(t => t.date.startsWith(curY)).forEach(t => {
      const a = parseFloat(t.amount) || 0;
      if (isIncome(t.type))               { yInc += a; }
      else if (t.type === "expense")      { yExp += a; yExpVar += a; }
      else if (t.type === "decagnottage")   yDecag += a;
      else if (t.type === "epargne")        ySav   += a;
    });
    yExp += tf;
    return { yInc, yExp, yExpVar, yDecag, ySav };
  }, [transactions, curY, tf]);

  // Épargne mois en cours
  const savMonth = useMemo(() =>
    transactions.filter(t => t.date.startsWith(curM) && t.type === "epargne")
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0),
    [transactions, curM]
  );
  const prevSavMonth = useMemo(() =>
    transactions.filter(t => t.date.startsWith(prevM) && t.type === "epargne")
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0),
    [transactions, prevM]
  );

  const pyStats = usePriorYearStats(transactions, fixedExpenses);
  const cagTotal = useMemo(() => cagnottes.reduce((s,c) => s + c.current, 0), [cagnottes]);

  // ── Récap cagnotte par période ────────────────────────────────
  const [cagSheet, setCagSheet] = useState(null); // null | "month" | "year"

  const cagBreakdown = useMemo(() => {
    const prefix = cagSheet === "month" ? curM : cagSheet === "year" ? curY : null;
    if (!prefix) return [];
    const byId = {};
    transactions.filter(t => t.date.startsWith(prefix) && (t.type === "epargne" || t.type === "decagnottage")).forEach(t => {
      const id = t.targetCagId || "__other__";
      if (!byId[id]) byId[id] = { added: 0, withdrawn: 0 };
      if (t.type === "epargne")      byId[id].added     += parseFloat(t.amount) || 0;
      if (t.type === "decagnottage") byId[id].withdrawn += parseFloat(t.amount) || 0;
    });
    return Object.entries(byId).map(([id, vals]) => ({
      cag: cagnottes.find(c => c.id === id) || null,
      ...vals,
    })).sort((a, b) => (b.added - b.withdrawn) - (a.added - a.withdrawn));
  }, [cagSheet, curM, curY, transactions, cagnottes]);
  const provTotal = useMemo(() => provisionalExpenses.reduce((s,p) => s + (p.amount || 0), 0), [provisionalExpenses]);
  const balanceAfterProv = balance - provTotal;
  const showBackup = !data.lastBackupDate ||
    (Date.now() - new Date(data.lastBackupDate)) / 86400000 > 7;

  // Transactions programmées futures (hors mois courant)
  const upcomingScheduled = useMemo(() => {
    const nextM = currentYM().slice(0, 7);
    return (data.scheduledTransactions || [])
      .filter(s => !s.confirmed && s.date > (nextM + "-99"))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data.scheduledTransactions]);

  const upcomingRecurring = useMemo(() => {
    const recurringTemplates = data.recurringTemplates || [];
    if (!recurringTemplates.length) return [];
    return recurringTemplates.filter(tpl => {
      const confirmed = (data.transactions || []).filter(t => t.templateId === tpl.id);
      if (tpl.occurrences != null && confirmed.length >= tpl.occurrences) return false;
      if (tpl.frequency === "yearly") {
        return !(data.transactions || []).some(t => t.templateId === tpl.id && t.date.startsWith(curY));
      }
      return !(data.transactions || []).some(t => t.templateId === tpl.id && t.date.startsWith(curM));
    });
  }, [data.recurringTemplates, data.transactions, curM, curY]);

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [tabUpcoming,   setTabUpcoming]   = useState("both");
  const [openUpcoming,  setOpenUpcoming]  = useState(false);

  // Frais fixes non pointés ce mois
  const unpointedFixes = useMemo(() =>
    fixedExpenses.filter(f => !f.pointedMonths?.[curM]),
    [fixedExpenses, curM]
  );

  function daysUntil(dateStr) {
    const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
    if (diff <= 1)  return "demain";
    if (diff < 7)   return `dans ${diff} j`;
    if (diff < 60)  return `dans ${Math.round(diff/7)} sem.`;
    return `dans ${Math.round(diff/30)} mois`;
  }

  // ── Couleur dynamique du solde ────────────────────────────────
  // Blanc par défaut, jaune sous 100 €, rouge en négatif
  const balanceColor = balance < 0 ? "#ef4444" : balance < 100 ? "#fbbf24" : "#ffffff";
  const afterProvColor = balanceAfterProv < 0 ? "#ef4444" : balanceAfterProv < 100 ? "#fbbf24" : "rgba(255,255,255,.75)";

  return (
    <div>
      {editMode && (
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          background:"rgba(200,184,96,.1)", border:"1px solid var(--warning)44",
          borderRadius:10, padding:"8px 14px", marginBottom:10,
        }}>
          <span style={{ fontSize:".62rem", color:"var(--warning)", fontWeight:700 }}>
            ✏️ Mode édition — masquez les sections inutiles
          </span>
          <button onClick={onExitEditMode} style={{
            background:"var(--warning)", border:"none", borderRadius:7,
            padding:"4px 12px", color:"var(--bg)", fontSize:".6rem", fontWeight:800, cursor:"pointer",
          }}>✓ Terminer</button>
        </div>
      )}

      {showBackup && (
        <div className="backup-alert" onClick={() => onSwitchTab("options")}>
          ⚠️ AUCUNE SAUVEGARDE JSON DEPUIS 7 JOURS
        </div>
      )}

      {/* ── Carte solde animée ── */}
      <div
        className="hero-card"
        style={{
          background: "linear-gradient(135deg, #0c1830 0%, #182a48 45%, #101e38 100%)",
          border: "none",
          boxShadow: "0 4px 24px rgba(112,184,224,.2)",
          overflow: "hidden",
          paddingBottom: 18,
        }}
      >
        {/* Shimmer */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,.1) 50%, transparent 65%)",
          backgroundSize: "200% 100%",
          animation: "hero-shimmer 3s ease-in-out infinite",
        }} />
        {/* Orbes */}
        <div style={{
          position: "absolute", top: -30, right: -30, width: 130, height: 130,
          borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(112,184,224,.2) 0%, transparent 70%)",
          animation: "pulse-orb 3.5s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: -20, left: 10, width: 90, height: 90,
          borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(136,200,128,.12) 0%, transparent 70%)",
          animation: "pulse-orb 4.5s ease-in-out infinite reverse",
        }} />

        {/* SmartIndicator */}
        <SmartIndicator
          balance={balance}
          curMonthInc={curMonth.inc}
          curMonthExp={curMonth.exp}
          lastBackupDate={data.lastBackupDate}
          onSwitchTab={onSwitchTab}
          alertEnabled={alertEnabled}
          alertThreshold={alertThreshold}
        />

        <div style={{ position: "relative", display: "flex", gap: 8 }}>
          {/* ── Gauche : solde + rapprochement ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hero-label" style={{ color: "rgba(255,255,255,.72)", fontWeight: 700 }}>
            Solde Bancaire Estimé
          </div>

          {/* ── Solde + badge delta vs même jour mois précédent ── */}
          {(() => {
            const now      = new Date();
            const todayDay = now.getDate();
            const curYM    = currentYM();
            const prevYM   = getPrevMonth(curYM);

            // Solde cumulé au jour J du mois précédent
            // = somme de toutes les transactions jusqu'au prevYM-todayDay inclus
            const prevDayStr = `${prevYM}-${String(todayDay).padStart(2, "0")}`;
            let balPrev = 0;
            transactions.forEach(t => {
              if (t.date > prevDayStr) return;
              const a = parseFloat(t.amount) || 0;
              if (isIncome(t.type))          balPrev += a;
              else if (t.type === "expense") balPrev -= a;
              else if (t.type === "epargne") balPrev -= a;
            });
            // Soustraire les fixes pour chaque mois jusqu'au mois précédent inclus
            if (transactions.length > 0) {
              const earliest = transactions.reduce((m, t) => t.date < m ? t.date : m, transactions[0].date);
              const startYM  = earliest.slice(0, 7);
              let [y, m] = startYM.split("-").map(Number);
              const [ey, em] = prevYM.split("-").map(Number);
              while (y < ey || (y === ey && m <= em)) {
                const ym = `${y}-${String(m).padStart(2, "0")}`;
                balPrev -= fixedExpenses.reduce((s, f) => {
                  const ov = f.monthlyOverrides?.[ym];
                  return s + ((ov?.amount ?? f.amount) || 0);
                }, 0);
                if (++m > 12) { m = 1; y++; }
              }
            }

            const deltaAbs = balance - balPrev;
            const deltaPct = balPrev !== 0 ? Math.round((deltaAbs / Math.abs(balPrev)) * 100) : null;
            const isPos    = deltaAbs >= 0;
            const dColor   = isPos ? "var(--success)" : "var(--danger)";

            // Sparkline : solde au même jour sur les 6 derniers mois
            const sparkData = Array.from({ length: 6 }, (_, i) => {
              const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
              const ym  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              const dayStr = `${ym}-${String(todayDay).padStart(2, "0")}`;
              let bal = 0;
              transactions.forEach(t => {
                if (t.date > dayStr) return;
                const a = parseFloat(t.amount) || 0;
                if (isIncome(t.type))          bal += a;
                else if (t.type === "expense") bal -= a;
                else if (t.type === "epargne") bal -= a;
              });
              if (transactions.length > 0) {
                const earliest = transactions.reduce((mn, t) => t.date < mn ? t.date : mn, transactions[0].date);
                const startYM  = earliest.slice(0, 7);
                let [y, m] = startYM.split("-").map(Number);
                const [ey, em] = ym.split("-").map(Number);
                while (y < ey || (y === ey && m <= em)) {
                  const loopYM = `${y}-${String(m).padStart(2, "0")}`;
                  bal -= fixedExpenses.reduce((s, f) => {
                    const ov = f.monthlyOverrides?.[loopYM];
                    return s + ((ov?.amount ?? f.amount) || 0);
                  }, 0);
                  if (++m > 12) { m = 1; y++; }
                }
              }
              const mLabel = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"][d.getMonth()];
              return { val: bal, mois: mLabel, isLast: i === 5 };
            });

            const sparkMax = Math.max(...sparkData.map(b => Math.abs(b.val)), 1);

            return (
              <>
                {/* Solde + badge delta inline */}
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:10 }}>
                  <div className="hero-value" style={{ color: balanceColor, marginBottom: 0 }}>
                    <CountUp target={balance} color={balanceColor} duration={1000} />
                  </div>
                  {deltaPct !== null && (
                    <div style={{
                      display:"flex", flexDirection:"column", gap:1,
                      padding:"4px 9px", borderRadius:8,
                      background:`${isPos ? "rgba(104,212,152" : "rgba(200,112,112"},.12)`,
                      border:`1px solid ${isPos ? "rgba(104,212,152" : "rgba(200,112,112"},.3)`,
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                        <span style={{ fontSize:".72rem" }}>{isPos ? "🔼" : "🔽"}</span>
                        <span style={{ fontSize:".72rem", fontWeight:800, color:dColor, fontFamily:"var(--mono)" }}>
                          {Math.abs(deltaPct)}%
                        </span>
                      </div>
                      <div style={{ fontSize:".48rem", color:"rgba(255,255,255,.35)", lineHeight:1.2 }}>
                        {fmt(balPrev)} le {todayDay} {["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"][new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth()]}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sparkline variante B — barres + labels rotatés */}
                {sparkData.some(b => b.val !== 0) && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:".5rem", color:"rgba(255,255,255,.28)", marginBottom:4, letterSpacing:".06em" }}>
                      Solde au {todayDay} de chaque mois
                    </div>
                    {/* Barres */}
                    <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:38, marginBottom:5 }}>
                      {sparkData.map((b, i) => {
                        const h = Math.max(3, Math.abs(b.val) / sparkMax * 34);
                        return (
                          <div key={i} style={{ flex:1, display:"flex", alignItems:"flex-end", height:38 }}>
                            <div style={{
                              width:"100%", height:h, borderRadius:3,
                              background: b.isLast ? "var(--accent)"
                                        : b.val >= 0 ? "rgba(104,212,152,.5)"
                                        : "rgba(200,112,112,.4)",
                              boxShadow: b.isLast ? "0 0 8px rgba(90,184,224,.5)" : "none",
                            }}/>
                          </div>
                        );
                      })}
                    </div>
                    {/* Labels mois */}
                    <div style={{ display:"flex", gap:4, marginBottom:3 }}>
                      {sparkData.map((b, i) => (
                        <div key={i} style={{ flex:1, textAlign:"center", fontSize:".48rem", color: b.isLast ? "var(--accent)" : "rgba(255,255,255,.22)", fontWeight: b.isLast ? 700 : 400 }}>
                          {b.mois}
                        </div>
                      ))}
                    </div>
                    {/* Montants rotatés */}
                    <div style={{ display:"flex", gap:4 }}>
                      {sparkData.map((b, i) => {
                        const isPrev = i === sparkData.length - 2;
                        const color  = b.isLast ? "rgba(90,184,224,.9)" : isPrev ? "rgba(255,255,255,.45)" : "rgba(255,255,255,.18)";
                        return (
                          <div key={i} style={{ flex:1, textAlign:"center", overflow:"hidden" }}>
                            <div style={{
                              fontSize:".42rem", color, fontFamily:"var(--mono)",
                              fontWeight: b.isLast || isPrev ? 700 : 400,
                              transform:"rotate(-35deg)", transformOrigin:"center top",
                              marginTop:2, whiteSpace:"nowrap",
                              display:"inline-block",
                            }}>
                              {b.val < 0 ? "−" : ""}{new Intl.NumberFormat("fr-FR",{minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.abs(b.val))}€
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {provTotal > 0 && (
            <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: ".62rem", color: "rgba(255,255,255,.55)", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600 }}>
                Après {provisionalExpenses.length} prévision{provisionalExpenses.length > 1 ? "s" : ""}
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "1.1rem", fontWeight: 700, color: afterProvColor, fontVariantNumeric: "tabular-nums" }}>
                <CountUp target={balanceAfterProv} color={afterProvColor} duration={1100} />
              </div>
            </div>
          )}

          {/* ── Séparateur ── */}
          <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "12px 0" }} />

          {/* ── Rapprochement bancaire ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[
              { label: "✓ Solde pointé",  value: soldePointe,  color: "var(--success)", bg: "rgba(104,212,152,.12)", bord: "rgba(104,212,152,.25)", filter: "pointed",   sub: `${nbPointed} op. confirmées` },
              { label: "⏳ En attente",   value: soldeAttente, color: "var(--warning)",  bg: "rgba(200,184,96,.08)",  bord: "rgba(200,184,96,.25)",  filter: "unpointed", sub: `${totalPointable - nbPointed} op. restantes` },
            ].map(s => (
              <div key={s.label}
                onClick={() => onGoToHistorique?.(s.filter)}
                style={{
                  background: s.bg, borderRadius: 9, padding: "8px 10px",
                  border: `1px solid ${s.bord}`, cursor: "pointer",
                  transition: "opacity .15s",
                }}>
                <div style={{ fontSize: ".55rem", color: s.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 3 }}>
                  {s.label} ›
                </div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 800, color: s.color, fontSize: ".85rem", fontVariantNumeric: "tabular-nums" }}>
                  {s.value >= 0 ? "+" : ""}{fmt(s.value)}
                </div>
                <div style={{ fontSize: ".52rem", color: "rgba(255,255,255,.35)", marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Barre de progression rapprochement ── */}
          {totalPointable > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".58rem", color: "rgba(255,255,255,.4)", marginBottom: 4 }}>
                <span>Rapprochement</span>
                <span style={{ color: nbPointed === totalPointable ? "var(--success)" : "rgba(255,255,255,.5)", fontWeight: 700 }}>
                  {nbPointed === totalPointable ? "✓ Complet" : `${nbPointed}/${totalPointable}`}
                </span>
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,.1)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  width: `${(nbPointed / totalPointable) * 100}%`, height: "100%",
                  background: "linear-gradient(90deg, var(--success), var(--accent))",
                  borderRadius: 99, transition: "width .4s ease",
                }} />
              </div>
            </div>
          )}
          </div>{/* fin gauche */}

          {/* ── Droite : arrondis vertical (si activé) ── */}
          {roundStats && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0, width: 58 }}>
              <div style={{ fontSize: ".4rem", color: "rgba(255,255,255,.3)", textAlign: "center", marginBottom: 1 }}>🐷</div>
              {/* Ce mois */}
              <div style={{ background: "rgba(104,212,152,.1)", border: "1px solid rgba(104,212,152,.2)", borderRadius: 5, padding: "3px 5px", textAlign: "center" }}>
                <div style={{ fontSize: ".38rem", color: "rgba(104,212,152,.7)", fontWeight: 700, textTransform: "uppercase", marginBottom: 1 }}>Mois</div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--success)", fontSize: ".58rem", lineHeight: 1.2 }}>{fmt(roundStats.month)}</div>
              </div>
              {/* Cette année */}
              <div style={{ background: "rgba(112,184,224,.08)", border: "1px solid rgba(112,184,224,.15)", borderRadius: 5, padding: "3px 5px", textAlign: "center" }}>
                <div style={{ fontSize: ".38rem", color: "rgba(112,184,224,.7)", fontWeight: 700, textTransform: "uppercase", marginBottom: 1 }}>Année</div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--accent)", fontSize: ".58rem", lineHeight: 1.2 }}>{fmt(roundStats.year)}</div>
              </div>
              {/* À virer */}
              <div
                onClick={() => roundStats.pending > 0.005 && onMarkRoundingTransferred?.()}
                style={{
                  background: roundStats.pending > 0.005 ? "rgba(200,184,96,.12)" : "rgba(104,212,152,.08)",
                  border: `1px solid ${roundStats.pending > 0.005 ? "rgba(200,184,96,.3)" : "rgba(104,212,152,.2)"}`,
                  borderRadius: 5, padding: "3px 5px", textAlign: "center",
                  cursor: roundStats.pending > 0.005 ? "pointer" : "default",
                }}>
                <div style={{ fontSize: ".38rem", color: roundStats.pending > 0.005 ? "rgba(200,184,96,.8)" : "rgba(104,212,152,.7)", fontWeight: 700, textTransform: "uppercase", marginBottom: 1 }}>
                  {roundStats.pending > 0.005 ? "À virer" : "Viré ✓"}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 800, color: roundStats.pending > 0.005 ? "var(--warning)" : "var(--success)", fontSize: ".58rem", lineHeight: 1.2 }}>
                  {roundStats.pending > 0.005 ? fmt(roundStats.pending) : "—"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 🐷 Cagnottes + 📌 Fixes ── */}
      <Sec id="cagnottes_fixes">
      <div className="grid-2">
        <div className="stat-mini dash-cagnotte2" onClick={() => onShowDetail("cagnottes", "all")} style={{ height:80 }}>
          <div className="stat-label">🐷 Cagnottes</div>
          <div className="stat-val" style={{ color:"var(--purple)" }}>{fmt(cagTotal)}</div>
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-fixe2" style={{ height:80 }}>
          <div className="stat-label">📌 Fixes / mois</div>
          <div className="stat-val" style={{ color:"#e8944a" }}>{fmt(tf)}</div>
        </div>
      </div>
      </Sec>

      {/* ── À venir ── v1.33.3 tailles réduites */}
      {(unpointedFixes.length > 0 || upcomingScheduled.length > 0 || upcomingRecurring.length > 0) && (() => {
        const C = "#e8f2ff", Cbord = "rgba(210,225,245,.22)";
        const fixItems   = unpointedFixes.map(f  => ({ ...f, _type:"fix"       }));
        const schedItems = upcomingScheduled.map(s=> ({ ...s, _type:"scheduled" }));
        const recurItems = upcomingRecurring.map(r => ({ ...r, _type:"recurring" }));
        const allItems   = [...recurItems, ...fixItems, ...schedItems];
        const visibleItems = tabUpcoming==="fixes" ? fixItems : tabUpcoming==="scheduled" ? schedItems : tabUpcoming==="recurring" ? recurItems : allItems;
        const total = allItems.reduce((s,i) => s+(parseFloat(i.amount)||0), 0);
        return (
          <>
            <style>{`@keyframes av-sh{0%{left:-60%;opacity:0}20%{opacity:1}80%{opacity:1}100%{left:110%;opacity:0}}`}</style>
            <div style={{ overflow:"hidden", borderRadius:14, border:`1px solid ${Cbord}`, background:"linear-gradient(135deg,rgba(220,228,240,.09),rgba(200,215,235,.03))", position:"relative", marginBottom:12 }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,rgba(255,255,255,.18),rgba(200,220,255,.08),transparent)", zIndex:1 }}/>
              <div style={{ position:"absolute", top:0, left:"-60%", width:"55%", height:"100%", background:"linear-gradient(105deg,transparent 30%,rgba(255,255,255,.07) 50%,transparent 70%)", animation:"av-sh 4s ease-in-out infinite", pointerEvents:"none", zIndex:1 }}/>
              <div style={{ position:"absolute", top:-20, right:-20, width:70, height:70, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,255,255,.06) 0%,transparent 70%)", pointerEvents:"none" }}/>

              {/* Header */}
              <div onClick={()=>setOpenUpcoming(o=>!o)} style={{ cursor:"pointer", userSelect:"none", position:"relative", zIndex:2 }}>
                <div style={{ display:"flex", alignItems:"center", gap:9, padding:"11px 14px", borderBottom:openUpcoming?`1px solid ${Cbord}`:"none" }}>
                  <span style={{ fontSize:".9rem" }}>⏳</span>
                  <span style={{ fontSize:".68rem", fontWeight:800, color:C, textTransform:"uppercase", letterSpacing:".08em", flex:1 }}>À venir</span>
                  {!openUpcoming && (
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      {recurItems.length>0 && <span style={{ fontSize:".58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(220,228,240,.10)", color:C, border:`1px solid ${Cbord}` }}>🔄 {recurItems.length}</span>}
                      {fixItems.length>0   && <span style={{ fontSize:".58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(90,184,224,.10)", color:"var(--accent)", border:"1px solid rgba(90,184,224,.2)" }}>↻ {fixItems.length}</span>}
                      {schedItems.length>0 && <span style={{ fontSize:".58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(200,184,96,.10)", color:"var(--warning)", border:"1px solid rgba(200,184,96,.2)" }}>📅 {schedItems.length}</span>}
                      <span style={{ fontFamily:"var(--mono)", fontSize:".68rem", fontWeight:800, color:C }}>−{fmt(total)}</span>
                    </div>
                  )}
                  {openUpcoming && <span style={{ fontFamily:"var(--mono)", fontSize:".68rem", fontWeight:800, color:C }}>−{fmt(total)}</span>}
                  <span style={{ color:C, fontSize:".8rem", transform:openUpcoming?"rotate(90deg)":"none", transition:"transform .2s", marginLeft:2, opacity:.7 }}>›</span>
                </div>

                {/* Onglets */}
                {openUpcoming && (
                  <div style={{ display:"flex", padding:"0 10px", borderBottom:`1px solid ${Cbord}` }}>
                    {[["both","Tout"],["recurring","Récurrents"],["fixes","Fixes"],["scheduled","Programmés"]].map(([k,l])=>(
                      <button key={k} onClick={e=>{e.stopPropagation();setTabUpcoming(k);}} style={{
                        padding:"6px 10px 7px", fontSize:".62rem", fontWeight:700,
                        background:"none", border:"none", borderRadius:0, cursor:"pointer",
                        color:tabUpcoming===k ? C : "rgba(200,220,245,.5)",
                        borderBottom:tabUpcoming===k ? `2px solid ${C}` : "2px solid transparent",
                        transition:"all .15s",
                      }}>{l}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lignes */}
              <div style={{ position:"relative", zIndex:2 }}>
                {openUpcoming && visibleItems.map((item,i)=>{
                  const isFix=item._type==="fix", isRec=item._type==="recurring", isSch=item._type==="scheduled";
                  const cat=data.categories?.find(c=>c.id===item.categoryId);
                  const icon=isFix?(cat?.icon??"📌"):isRec?(cat?.icon??"🔄"):(cat?.icon??"📅");
                  const label=isFix?item.name:isRec?(item.label||cat?.name||"Récurrente"):(item.note||cat?.name||"Dépense programmée");
                  const sub=isFix?"Ce mois · non pointé":isRec?`Ce mois · ${item.frequency==="yearly"?"annuelle":"mensuelle"}`:new Date(item.date).toLocaleDateString("fr-FR",{day:"numeric",month:"long"});
                  const badge=isSch?daysUntil(item.date):null;
                  // Occurrences restantes pour les récurrentes
                  const recurBadge = isRec && item.occurrences != null ? (() => {
                    const done = (data.transactions||[]).filter(t => t.templateId === item.id).length;
                    const remaining = item.occurrences - done;
                    return remaining > 0 ? `${remaining} fois restante${remaining > 1 ? "s" : ""}` : null;
                  })() : null;
                  const isConf=isSch&&deleteConfirm===item.id;
                  const ibg=isRec?"rgba(220,228,240,.08)":isFix?"rgba(90,184,224,.08)":"rgba(200,184,96,.08)";
                  const ibord=isRec?"rgba(210,225,245,.18)":isFix?"rgba(90,184,224,.2)":"rgba(200,184,96,.2)";
                  const dot=isRec?C:isFix?"var(--accent)":"var(--warning)";
                  const dotL=isRec?"🔄":isFix?"↻":"·";
                  return (
                    <div key={(item.id||item._type)+i} style={{ borderBottom:i<visibleItems.length-1?`1px solid rgba(210,225,245,.08)`:"none" }}>
                      {isConf?(
                        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"11px 14px", background:"rgba(224,104,112,.06)" }}>
                          <span style={{ fontSize:".65rem", color:"var(--text2)", flex:1 }}>Supprimer "{item.note||"cette programmée"}" ?</span>
                          <button onClick={()=>{onDeleteScheduled?.(item.id);setDeleteConfirm(null);}} style={{ background:"var(--danger)", border:"none", borderRadius:7, padding:"5px 12px", color:"#fff", fontSize:".62rem", fontWeight:800, cursor:"pointer" }}>Oui</button>
                          <button onClick={()=>setDeleteConfirm(null)} style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:7, padding:"5px 10px", color:"var(--text3)", fontSize:".62rem", cursor:"pointer" }}>Non</button>
                        </div>
                      ):(
                        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px" }}>
                          {/* Icône */}
                          <div style={{ position:"relative", flexShrink:0 }}>
                            <div style={{ width:34, height:34, borderRadius:9, background:ibg, border:`1px solid ${ibord}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:".95rem" }}>{icon}</div>
                            <div style={{ position:"absolute", bottom:-2, right:-3, width:12, height:12, borderRadius:"50%", background:dot, border:"1.5px solid var(--bg)", fontSize:".35rem", color:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900 }}>{dotL}</div>
                          </div>
                          {/* Texte */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:".75rem", fontWeight:700, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>{label}</div>
                            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                              <span style={{ fontSize:".62rem", color:"rgba(200,220,245,.65)" }}>{sub}</span>
                              {badge && <span style={{ fontSize:".58rem", fontWeight:700, padding:"1px 6px", borderRadius:4, background:"rgba(200,184,96,.15)", color:"var(--warning)", border:"1px solid rgba(200,184,96,.25)" }}>{badge}</span>}
                              {recurBadge && <span style={{ fontSize:".58rem", fontWeight:700, padding:"1px 6px", borderRadius:4, background:"rgba(200,220,245,.08)", color:"rgba(200,220,245,.7)", border:"1px solid rgba(200,220,245,.2)" }}>🔢 {recurBadge}</span>}
                            </div>
                          </div>
                          {/* Montant + actions */}
                          <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
                            <span style={{ fontFamily:"var(--mono)", fontSize:".75rem", fontWeight:800, color:C }}>−{fmt(item.amount)}</span>
                            {isRec && <button onTouchEnd={e=>{e.stopPropagation();e.preventDefault();onConfirmRecurring?.(item,curM);}} onClick={()=>onConfirmRecurring?.(item,curM)} style={{ width:22, height:22, borderRadius:"50%", background:"rgba(220,228,240,.12)", border:`1px solid ${Cbord}`, color:C, fontSize:".6rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, fontWeight:900 }}>✓</button>}
                            {isSch && <button onTouchEnd={e=>{e.stopPropagation();e.preventDefault();setDeleteConfirm(item.id);}} onClick={()=>setDeleteConfirm(item.id)} style={{ width:22, height:22, borderRadius:"50%", background:"transparent", border:"1px solid rgba(255,255,255,.25)", color:"rgba(200,220,245,.7)", fontSize:".6rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>✕</button>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              {openUpcoming && allItems.length > 1 && (
                <div style={{ padding:"8px 14px", borderTop:`1px solid ${Cbord}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(220,228,240,.04)", position:"relative", zIndex:2 }}>
                  <span style={{ fontSize:".62rem", color:"rgba(200,220,245,.6)" }}>Total à venir</span>
                  <span style={{ fontFamily:"var(--mono)", fontSize:".68rem", fontWeight:800, color:C }}>−{fmt(total)}</span>
                </div>
              )}
            </div>
          </>
        );
      })()}

      <Sec id="mois">
      <SectionTitle>🗓️ Mois en cours</SectionTitle>
      <div className="grid-2">
        <div className="stat-mini dash-revenu" onClick={() => onShowDetail("income", "month")}
          style={{ background:"linear-gradient(135deg,rgba(104,200,122,.1),rgba(104,200,122,.03))", border:"1px solid rgba(104,200,122,.2)", position:"relative", overflow:"hidden", height:80 }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,rgba(104,200,122,.7),transparent)" }}/>
          <div className="stat-label" style={{ color:"rgba(104,200,122,.75)" }}>💰 Revenus</div>
          <div className="stat-val type-income">{fmt(curMonth.inc)}</div>
          <Delta cur={curMonth.inc} prev={prevMonth.inc} />
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-depense" onClick={() => onShowDetail("expense", "month")}
          style={{ background:"linear-gradient(135deg,rgba(224,104,112,.1),rgba(224,104,112,.03))", border:"1px solid rgba(224,104,112,.2)", position:"relative", overflow:"hidden", height:80 }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,rgba(224,104,112,.7),transparent)" }}/>
          <div className="stat-label" style={{ color:"rgba(224,104,112,.75)" }}>💸 Dépenses</div>
          <div className="stat-val type-expense">{fmt(curMonth.exp)}</div>
          <Delta cur={curMonth.exp} prev={prevMonth.exp} inverted />
          <span className="stat-arrow">›</span>
        </div>

        {/* Option B — Épargne + Retraits sur une carte */}
        <div className="stat-mini" style={{ background:"linear-gradient(135deg,rgba(160,120,224,.08),rgba(160,120,224,.02))", border:"1px solid rgba(160,120,224,.2)", borderLeft:"3px solid var(--purple)", cursor:"pointer", position:"relative", overflow:"hidden" }} onClick={() => setCagSheet("month")}>
          <div className="stat-label" style={{ marginBottom: 6 }}>🐷 Cagnotte</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 5, borderBottom: "1px solid var(--border-soft)", marginBottom: 5 }}>
            <span style={{ fontSize: ".6rem", color: "var(--text2)" }}>↑ Épargné</span>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--purple)", fontSize: ".78rem", fontVariantNumeric: "tabular-nums" }}>{fmt(savMonth)}</span>
              <div><Delta cur={savMonth} prev={prevSavMonth} /></div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: ".6rem", color: "var(--text2)" }}>↩️ Retiré</span>
            <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--coral)", fontSize: ".78rem", fontVariantNumeric: "tabular-nums" }}>{fmt(curMonth.decag)}</span>
          </div>
        </div>

        <div className="stat-mini dash-dep-var" onClick={() => onShowDetail("expense_var", "month")}
          style={{ background:"linear-gradient(135deg,rgba(112,184,224,.08),rgba(112,184,224,.02))", border:"1px solid rgba(112,184,224,.2)", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,rgba(112,184,224,.6),transparent)" }}/>
          <div className="stat-label">📊 Dép. variables</div>
          <div className="stat-val" style={{ color: "var(--accent)" }}>{fmt(curMonth.expVar)}</div>
          <Delta cur={curMonth.expVar} prev={prevMonth.expVar} inverted />
          <span className="stat-arrow">›</span>
        </div>
      </div>

      </Sec>

      <Sec id="annee">
      <SectionTitle>📅 Année en cours</SectionTitle>
      <div className="grid-2">
        <div className="stat-mini dash-revenu" onClick={() => onShowDetail("income", "year")}
          style={{ background:"linear-gradient(135deg,rgba(104,200,122,.1),rgba(104,200,122,.03))", border:"1px solid rgba(104,200,122,.2)", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,rgba(104,200,122,.7),transparent)" }}/>
          <div className="stat-label" style={{ color:"rgba(104,200,122,.75)" }}>💰 Revenus</div>
          <div className="stat-val type-income">{fmt(yInc)}</div>
          <Delta cur={yInc} prev={pyStats.inc} />
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-depense" onClick={() => onShowDetail("expense", "year")}
          style={{ background:"linear-gradient(135deg,rgba(224,104,112,.1),rgba(224,104,112,.03))", border:"1px solid rgba(224,104,112,.2)", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,rgba(224,104,112,.7),transparent)" }}/>
          <div className="stat-label" style={{ color:"rgba(224,104,112,.75)" }}>💸 Dépenses</div>
          <div className="stat-val type-expense">{fmt(yExp)}</div>
          <Delta cur={yExp} prev={pyStats.exp} inverted />
          <span className="stat-arrow">›</span>
        </div>

        {/* Option B — Épargne + Retraits année */}
        <div className="stat-mini" style={{ background:"linear-gradient(135deg,rgba(160,120,224,.08),rgba(160,120,224,.02))", border:"1px solid rgba(160,120,224,.2)", borderLeft:"3px solid var(--purple)", cursor:"pointer", position:"relative", overflow:"hidden" }} onClick={() => setCagSheet("year")}>
          <div className="stat-label" style={{ marginBottom: 6 }}>🐷 Cagnotte</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 5, borderBottom: "1px solid var(--border-soft)", marginBottom: 5 }}>
            <span style={{ fontSize: ".6rem", color: "var(--text2)" }}>↑ Épargné</span>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--purple)", fontSize: ".78rem", fontVariantNumeric: "tabular-nums" }}>{fmt(ySav)}</span>
              <div><Delta cur={ySav} prev={pyStats.sav ?? 0} /></div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: ".6rem", color: "var(--text2)" }}>↩️ Retiré</span>
            <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--coral)", fontSize: ".78rem", fontVariantNumeric: "tabular-nums" }}>{fmt(yDecag)}</span>
          </div>
        </div>

        <div className="stat-mini dash-dep-var" onClick={() => onShowDetail("expense_var", "year")}
          style={{ background:"linear-gradient(135deg,rgba(112,184,224,.08),rgba(112,184,224,.02))", border:"1px solid rgba(112,184,224,.2)", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,rgba(112,184,224,.6),transparent)" }}/>
          <div className="stat-label">📊 Dép. variables</div>
          <div className="stat-val" style={{ color: "var(--accent)" }}>{fmt(yExpVar)}</div>
          <Delta cur={yExpVar} prev={pyStats.expVar} inverted />
          <span className="stat-arrow">›</span>
        </div>
      </div>

      </Sec>

      {/* ── Récap cagnotte ── */}
      {cagSheet && (
        <div style={{ position:"fixed", inset:0, background:"rgba(6,8,16,.75)", backdropFilter:"blur(5px)", zIndex:200, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}
          onClick={() => setCagSheet(null)}>
          <div style={{ background:"var(--surface)", borderRadius:"18px 18px 0 0", border:"1px solid var(--border)", padding:"16px 16px 32px" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:32, height:3, background:"var(--border)", borderRadius:2, margin:"0 auto 14px" }}/>

            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:".75rem", fontWeight:800, color:"var(--text)" }}>
                  🐷 {cagSheet === "month" ? `Épargne — ${MONTHS_FR[new Date().getMonth()]} ${new Date().getFullYear()}` : `Épargne — ${new Date().getFullYear()}`}
                </div>
                <div style={{ fontSize:".55rem", color:"var(--text3)", marginTop:2 }}>Répartition par cagnotte</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"var(--mono)", fontSize:".82rem", fontWeight:800, color:"var(--purple)" }}>
                  {fmt(cagBreakdown.reduce((s,c) => s + c.added, 0))}
                </div>
                {cagBreakdown.some(c => c.withdrawn > 0) && (
                  <div style={{ fontSize:".52rem", color:"var(--danger)", marginTop:1 }}>
                    −{fmt(cagBreakdown.reduce((s,c) => s + c.withdrawn, 0))} retiré
                  </div>
                )}
              </div>
            </div>

            {/* Lignes par cagnotte */}
            {cagBreakdown.length === 0 ? (
              <div style={{ textAlign:"center", padding:"20px 0", fontSize:".65rem", color:"var(--text3)" }}>
                Aucun mouvement sur cette période
              </div>
            ) : cagBreakdown.map((row, i) => (
              <div key={i} style={{
                display:"flex", alignItems:"center", gap:10,
                padding:"10px 12px", borderRadius:10,
                background:"var(--surface2)", border:"1px solid var(--border-soft)",
                marginBottom:6,
              }}>
                <div style={{ width:32, height:32, borderRadius:9, background:"rgba(160,120,224,.12)", border:"1px solid rgba(160,120,224,.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:".85rem", flexShrink:0 }}>
                  🎯
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:".66rem", fontWeight:700, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {row.cag?.name ?? "Cagnotte supprimée"}
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:2 }}>
                    {row.added > 0 && <span style={{ fontSize:".5rem", color:"var(--success)", fontWeight:700 }}>+{fmt(row.added)}</span>}
                    {row.withdrawn > 0 && <span style={{ fontSize:".5rem", color:"var(--danger)", fontWeight:700 }}>−{fmt(row.withdrawn)}</span>}
                  </div>
                </div>
                <div style={{ fontFamily:"var(--mono)", fontSize:".66rem", fontWeight:800, color: row.added - row.withdrawn >= 0 ? "var(--purple)" : "var(--danger)", flexShrink:0 }}>
                  {row.added - row.withdrawn >= 0 ? "+" : "−"}{fmt(Math.abs(row.added - row.withdrawn))}
                </div>
              </div>
            ))}

            <button onClick={() => setCagSheet(null)} style={{ width:"100%", marginTop:4, background:"none", border:"1px solid var(--border)", borderRadius:10, padding:"9px", color:"var(--text3)", fontSize:".63rem", cursor:"pointer" }}>
              Fermer
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
// ─────────────────────────────────────────────────────────────────
export function CagnottesView({ data, onNewCag, onEditCag, onDeleteCag, onTransfer, onShowCagHistory }) {
  const { cagnottes, transactions } = data;
  const curM = currentYM();
  const curY = new Date().getFullYear().toString();

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

      {cagnottes.length === 0
        ? <EmptyIllustration type="cagnottes" title="Aucune cagnotte" sub="Crée ta première cagnotte pour commencer à épargner" cta="＋ Créer une cagnotte" onCta={onNewCag} ctaColor="var(--success)" />
        : (
          <div className="grid-2">
            {cagnottes.map(c => {
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

// ─────────────────────────────────────────────────────────────────
//  HISTORIQUE — ligne pointable (transactions + frais fixes)
// ─────────────────────────────────────────────────────────────────
function PointRow({ item, onToggle, isFixed = false, onEditFixed, onEdit, onDelete }) {
  const [editing,     setEditing]     = useState(false);
  const [draftName,   setDraftName]   = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const isInc = item.type === "income" || item.type === "dissolution_cagnotte";

  // Swipe gauche → révèle Edit + Delete
  const swipeStart = useRef({ x:0, y:0 });
  const isHSwipe   = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const REVEAL_W = onEdit || onDelete ? 120 : 0;

  function onSwipeStart(e) {
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isHSwipe.current = false;
  }
  function onSwipeMove(e) {
    const dx = e.touches[0].clientX - swipeStart.current.x;
    const dy = e.touches[0].clientY - swipeStart.current.y;
    if (!isHSwipe.current && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (!isHSwipe.current) {
      isHSwipe.current = Math.abs(dx) > Math.abs(dy);
      if (!isHSwipe.current) return;
    }
    if (dx < 0 && REVEAL_W) {
      e.preventDefault();
      setSwipeOffset(Math.max(dx, -REVEAL_W));
    } else if (dx > 0 && swipeOffset < 0) {
      e.preventDefault();
      setSwipeOffset(Math.min(0, swipeOffset + dx));
    }
  }
  function onSwipeEnd(e) {
    if (isHSwipe.current && REVEAL_W) {
      setSwipeOffset(swipeOffset < -REVEAL_W / 2 ? -REVEAL_W : 0);
    }
    isHSwipe.current = false;
  }
  function closeSwipe() { setSwipeOffset(0); }

  function startEdit() {
    setDraftName(item.name || "");
    setDraftAmount(String(item.amount || ""));
    setEditing(true);
  }
  function saveEdit() {
    const a = parseFloat(draftAmount);
    if (!isNaN(a) && a > 0) onEditFixed?.(item.id, { name: draftName.trim() || item.name, amount: a });
    setEditing(false);
  }

  return (
    <div style={{ position:"relative", overflow:"hidden" }}>
      {/* Boutons d'action révélés par swipe gauche */}
      {REVEAL_W > 0 && (
        <div style={{ position:"absolute", top:0, right:0, bottom:0, width:REVEAL_W, display:"flex" }}>
          {onEdit && (
            <button onClick={() => { closeSwipe(); onEdit(item.id); }} style={{
              flex:1, background:"var(--accent)", border:"none",
              color:"var(--bg)", fontSize:".65rem", fontWeight:800, cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2,
            }}>✏️<span>Modifier</span></button>
          )}
          {onDelete && (
            <button onClick={() => { closeSwipe(); onDelete(item.id); }} style={{
              flex:1, background:"var(--danger)", border:"none",
              color:"#fff", fontSize:".65rem", fontWeight:800, cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2,
            }}>🗑<span>Supprimer</span></button>
          )}
        </div>
      )}

      {/* Ligne principale */}
      <div
        onTouchStart={onSwipeStart}
        onTouchMove={onSwipeMove}
        onTouchEnd={onSwipeEnd}
        style={{
          transform:`translateX(${swipeOffset}px)`,
          transition: (swipeOffset === 0 || swipeOffset === -REVEAL_W) ? "transform .22s ease" : "none",
        }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
        borderBottom: editing ? "none" : "1px solid var(--border-soft)",
        background: item.pointed ? "rgba(104,212,152,.04)" : "var(--surface)",
        transition: "background .2s",
      }}>
        {/* Bouton pointage */}
        <button
          onTouchStart={e => e.stopPropagation()}
          onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); onToggle(item.id); }}
          onClick={e => e.stopPropagation()}
          style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: item.pointed ? "var(--success)" : "transparent",
            border: `2px solid ${item.pointed ? "var(--success)" : "var(--border)"}`,
            color: item.pointed ? "var(--bg)" : "var(--text3)",
            fontSize: ".88rem", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .15s", touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}>{item.pointed ? "✓" : ""}</button>

        <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {item.cat?.icon ?? (isFixed ? "📌" : isInc ? "💰" : "💸")}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: ".74rem", fontWeight: 700, color: "var(--text)", opacity: item.pointed ? 1 : .75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {item.name || item.note || "—"}
            </span>
            {isFixed && <span style={{ fontSize: ".5rem", background: "var(--warning-glow)", color: "var(--warning)", padding: "1px 5px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>FIXE</span>}
            {item.isAutoSaving  && <span style={{ fontSize: ".5rem", background: "rgba(160,120,224,.15)", color: "var(--purple)",  padding: "1px 5px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>AUTO</span>}
            {item.fromScheduled && <span style={{ fontSize: ".5rem", background: "rgba(200,184,96,.15)",  color: "var(--warning)", padding: "1px 5px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>PROG</span>}
            {isFixed && item.isOverridden && <span style={{ fontSize: ".5rem", background: "var(--accent-glow)", color: "var(--accent)", padding: "1px 5px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>modifié</span>}
          </div>
          {item.date && <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 1 }}>{item.date.slice(8)}/{item.date.slice(5,7)}</div>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".8rem", color: isFixed || !isInc ? "var(--danger)" : "var(--success)", opacity: item.pointed ? 1 : .55 }}>
            {isInc && !isFixed ? "+" : "−"}{fmt(item.amount)}
          </div>
          {isFixed && onEditFixed && (
            <button
              onTouchStart={e => e.stopPropagation()}
              onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); startEdit(); }}
              onClick={e => { e.stopPropagation(); startEdit(); }}
              style={{
                background: "var(--accent-glow)", border: "1px solid var(--border)",
                borderRadius: 7, padding: "4px 7px", color: "var(--accent)",
                fontSize: ".7rem", cursor: "pointer",
                touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
              }}>✏️</button>
          )}
        </div>
      </div>

      {/* Formulaire édition inline — ce mois uniquement */}
      {editing && (
        <div style={{ padding: "10px 14px 12px", background: "rgba(112,184,224,.06)", borderBottom: "1px solid var(--border-soft)", borderLeft: "3px solid var(--accent)" }}>
          <div style={{ fontSize: ".6rem", color: "var(--accent)", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
            ✏️ Modifier pour ce mois uniquement
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8, marginBottom: 8 }}>
            <input type="text" value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="Nom"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 10px", color: "var(--text)", fontSize: ".75rem", fontFamily: "inherit" }}/>
            <input type="number" value={draftAmount} min="0" step="0.01" onChange={e => setDraftAmount(e.target.value)} placeholder="Montant"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 8px", color: "var(--text)", fontSize: ".75rem", fontFamily: "var(--mono)" }}/>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={() => setEditing(false)} style={{ flex:1, background:"transparent", border:"1px solid var(--border)", borderRadius:8, padding:"7px", color:"var(--text2)", fontSize:".7rem", fontWeight:700, cursor:"pointer" }}>
              Annuler
            </button>
            {item.isOverridden && (
              <button onClick={() => { onEditFixed?.(item.id, null); setEditing(false); }} style={{ flex:1, background:"transparent", border:"1px solid var(--warning)", borderRadius:8, padding:"7px", color:"var(--warning)", fontSize:".7rem", fontWeight:700, cursor:"pointer" }}>
                ↺ Réinitialiser
              </button>
            )}
            <button onClick={saveEdit} style={{ flex:1, background:"var(--accent)", border:"none", borderRadius:8, padding:"7px", color:"var(--bg)", fontSize:".7rem", fontWeight:800, cursor:"pointer" }}>
              Enregistrer
            </button>
          </div>
        </div>
      )}
      </div>{/* end swipe translateX */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  HISTORIQUE
// ─────────────────────────────────────────────────────────────────
export function HistoriqueView({ data, onEditTrans, onDeleteTrans, onDuplicateTrans, onTogglePointTx, onTogglePointFix, onOverrideFixMonth, onConfirmRecurring, onDeleteRecurring, onApplyAutoSaving, onSkipAutoSaving, onConfirmScheduled, onDeleteScheduled, initPointFilter = "all", onClearPointFilter }) {
  const now = new Date();
  const [year,     setYear]     = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [sort,     setSort]     = useState("date");
  const [catId,    setCatId]    = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [calSelectedDay, setCalSelectedDay] = useState(null);
  const [minAmt,   setMinAmt]   = useState("");
  const [maxAmt,   setMaxAmt]   = useState("");
  const [showAmtFilter, setShowAmtFilter] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Filtre pointage — initialisé depuis la hero card
  const [pointFilter, setPointFilter] = useState(initPointFilter);
  // Sync si la prop change (navigation depuis hero card)
  useEffect(() => { setPointFilter(initPointFilter); }, [initPointFilter]);

  const month = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;

  function prevMonth() {
    if (monthIdx === 0) { setYear(y => y - 1); setMonthIdx(11); }
    else setMonthIdx(m => m - 1);
    setCatId("");
  }
  function nextMonth() {
    const nextYM = monthIdx === 11 ? `${year + 1}-01` : `${year}-${String(monthIdx + 2).padStart(2, "0")}`;
    if (nextYM > currentYM()) return;
    if (monthIdx === 11) { setYear(y => y + 1); setMonthIdx(0); }
    else setMonthIdx(m => m + 1);
    setCatId("");
  }
  const isCurrentMonth = month === currentYM();

  const [globalSearch, setGlobalSearch] = useState(false);

  const { transactions, categories, cagnottes, fixedExpenses } = data;
  const allTags = data.tags || [];
  const recurringTemplates = data.recurringTemplates || [];

  // Versements auto à confirmer ce mois
  const autoSavingsPending = useMemo(() => {
    const plans = data.autoSavings || [];
    const today = new Date();
    return plans.filter(plan => {
      if (!plan.enabled) return false;
      const alreadyDone = transactions.some(t =>
        t.autoSavingId === plan.id && t.date.startsWith(month)
      );
      return !alreadyDone && plan.dayOfMonth <= today.getDate();
    });
  }, [data.autoSavings, transactions, month]);

  const scheduledPending = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (data.scheduledTransactions || []).filter(s =>
      !s.confirmed && s.date.startsWith(month) && s.date > today
    );
  }, [data.scheduledTransactions, month]);
  const recurringPending = useMemo(() => {
    if (!recurringTemplates.length) return [];
    return recurringTemplates.filter(tpl => {
      // Compter les confirmations existantes
      const confirmed = transactions.filter(t => t.templateId === tpl.id);

      // Si limite d'occurrences atteinte → ne plus afficher
      if (tpl.occurrences != null && confirmed.length >= tpl.occurrences) return false;

      if (tpl.frequency === "yearly") {
        const year = month.slice(0, 4);
        return !transactions.some(t => t.templateId === tpl.id && t.date.startsWith(year));
      }
      // monthly
      return !transactions.some(t => t.templateId === tpl.id && t.date.startsWith(month));
    });
  }, [recurringTemplates, transactions, month]);
  const mStats = useMonthStats(transactions, fixedExpenses, month);
  const savMonth = useMemo(() =>
    transactions.filter(t => t.date.startsWith(month) && t.type === "epargne")
      .reduce((s, t) => s + (parseFloat(t.amount)||0), 0), [transactions, month]);

  // Premier mois d'utilisation = mois de la première transaction
  const startYM = useMemo(() => {
    if (!transactions.length) return currentYM();
    return transactions.reduce((min, t) => t.date < min ? t.date : min, transactions[0].date).slice(0, 7);
  }, [transactions]);

  // Frais fixes — visibles uniquement depuis le mois de démarrage
  const monthFixes = useMemo(() =>
    month >= startYM ? fixedExpenses : [],
    [fixedExpenses, month, startYM]
  );

  // Handler local : passe le mois courant pour le pointage par mois
  const handleTogglePointFix = useCallback(id => {
    onTogglePointFix?.(id, month);
  }, [onTogglePointFix, month]);

  // Handler édition frais fixe — override pour ce mois uniquement
  const handleOverrideFix = useCallback((id, override) => {
    onOverrideFixMonth?.(id, month, override);
  }, [onOverrideFixMonth, month]);

  // Rapprochement du mois affiché
  const { soldePointe, soldeAttente, nbPointed, totalPointable } = useMemo(() => {
    const txMonth = transactions.filter(t => t.date.startsWith(month) && isPointable(t.type));
    let pt = 0, noPt = 0;
    txMonth.forEach(t => {
      const a = parseFloat(t.amount) || 0;
      const val = isIncome(t.type) ? a : -a;
      if (t.pointed) pt   += val;
      else           noPt += val;
    });
    monthFixes.forEach(f => {
      const ov = f.monthlyOverrides?.[month];
      const a  = (ov?.amount ?? f.amount) || 0;
      const isPointed = !!f.pointedMonths?.[month];
      if (isPointed) pt   -= a;
      else           noPt -= a;
    });
    return {
      soldePointe:    pt,
      soldeAttente:   noPt,
      nbPointed:      txMonth.filter(t => t.pointed).length + monthFixes.filter(f => f.pointedMonths?.[month]).length,
      totalPointable: txMonth.length + monthFixes.length,
    };
  }, [transactions, fixedExpenses, month, monthFixes]);

  const filtered = useMemo(() => {
    // Recherche globale : ignore le mois, cherche sur toutes les transactions
    let list = (globalSearch && search.trim())
      ? [...transactions]
      : transactions.filter(t => t.date.startsWith(month));

    if (filter !== "all") list = list.filter(t => {
      if (filter === "income")  return isIncome(t.type);
      if (filter === "expense") return t.type === "expense";
      if (filter === "savings") return ["epargne","decagnottage","transfer"].includes(t.type);
      return true;
    });
    if (catId) list = list.filter(t => t.categoryId === catId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        return (t.note||"").toLowerCase().includes(q) || (cat?.name||"").toLowerCase().includes(q);
      });
    }
    if (minAmt) list = list.filter(t => parseFloat(t.amount) >= parseFloat(minAmt));
    if (maxAmt) list = list.filter(t => parseFloat(t.amount) <= parseFloat(maxAmt));
    if (pointFilter === "pointed")   list = list.filter(t => isPointable(t.type) &&  t.pointed);
    if (pointFilter === "unpointed") list = list.filter(t => isPointable(t.type) && !t.pointed);
    if (sort === "date")  list.sort((a,b) => new Date(b.date) - new Date(a.date));
    if (sort === "amt_d") list.sort((a,b) => parseFloat(b.amount) - parseFloat(a.amount));
    if (sort === "amt_a") list.sort((a,b) => parseFloat(a.amount) - parseFloat(b.amount));
    return list;
  }, [transactions, categories, month, filter, catId, search, sort, minAmt, maxAmt, pointFilter, globalSearch]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <div>
      {/* ── 5. Navigation mois ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 16px", marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ background: "var(--accent-glow)", border: "none", borderRadius: 8, width: 36, height: 36, color: "var(--accent)", fontSize: "1.1rem", cursor: "pointer" }}>◀</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--display)", fontSize: "1rem", fontWeight: 800 }}>{MONTHS_FR[monthIdx]}</div>
          <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 1 }}>{year}</div>
        </div>
        <button onClick={nextMonth} style={{ background: isCurrentMonth ? "var(--surface3)" : "var(--accent-glow)", border: "none", borderRadius: 8, width: 36, height: 36, color: isCurrentMonth ? "var(--text3)" : "var(--accent)", fontSize: "1.1rem", cursor: isCurrentMonth ? "default" : "pointer", opacity: isCurrentMonth ? .4 : 1 }}>▶</button>
      </div>

      {/* ── Donut + barre budget ── */}
      <div className="card" style={{ padding: 14, marginBottom: 10 }}>
        <HistDonut inc={mStats.inc} exp={mStats.exp} sav={savMonth} />
        <BudgetBar exp={mStats.exp} inc={mStats.inc} />
      </div>

      {/* ── Mini récap rapprochement ── */}
      {totalPointable > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: ".62rem", fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em" }}>📊 Rapprochement</div>
            <span style={{ fontSize: ".6rem", color: nbPointed === totalPointable ? "var(--success)" : "var(--warning)", fontWeight: 700 }}>
              {nbPointed === totalPointable ? "✓ Complet" : `${nbPointed}/${totalPointable}`}
            </span>
          </div>

          {/* Deux mini-cartes clickables */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 8 }}>
            {[
              { label: "✓ Pointé",     value: soldePointe,  color: "var(--success)", bg: "rgba(104,212,152,.1)", filter: "pointed",   sub: `${nbPointed} op.` },
              { label: "⏳ En attente", value: soldeAttente, color: "var(--warning)",  bg: "rgba(200,184,96,.08)", filter: "unpointed", sub: `${totalPointable - nbPointed} op.` },
            ].map(s => (
              <div key={s.label}
                onClick={() => setPointFilter(f => f === s.filter ? "all" : s.filter)}
                style={{
                  background: s.bg, borderRadius: 8, padding: "7px 9px",
                  border: `1px solid ${pointFilter === s.filter ? s.color : "transparent"}`,
                  cursor: "pointer", transition: "border-color .15s",
                }}>
                <div style={{ fontSize: ".55rem", color: s.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 800, color: s.color, fontSize: ".82rem", fontVariantNumeric: "tabular-nums" }}>
                  {s.value >= 0 ? "+" : ""}{fmt(s.value)}
                </div>
                <div style={{ fontSize: ".52rem", color: "var(--text3)", marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Barre de progression */}
          <div style={{ height: 5, background: "var(--surface3)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${totalPointable > 0 ? (nbPointed / totalPointable) * 100 : 0}%`, height: "100%", background: "linear-gradient(90deg, var(--success), var(--accent))", borderRadius: 99, transition: "width .3s" }} />
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
          <div className="hist-search-wrap" style={{ flex: 1, marginBottom: 0 }}>
            <span className="hist-search-icon">🔍</span>
            <input className="hist-search" type="text" placeholder="Rechercher…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {/* Toggle recherche globale */}
          <button
            onClick={() => setGlobalSearch(g => !g)}
            title="Rechercher sur tous les mois"
            style={{
              background: globalSearch ? "var(--accent-glow)" : "transparent",
              border: `1px solid ${globalSearch ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8, padding: "7px 10px",
              color: globalSearch ? "var(--accent)" : "var(--text3)",
              fontSize: ".65rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            }}>
            {globalSearch ? "🌐 Global" : "🌐"}
          </button>
        </div>
        {globalSearch && search.trim() && (
          <div style={{ fontSize: ".6rem", color: "var(--accent)", fontWeight: 700, marginBottom: 6, padding: "4px 8px", background: "var(--accent-glow)", borderRadius: 6 }}>
            🌐 Recherche sur toutes les périodes — {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
          </div>
        )}

        {/* ── Filtres compacts ── */}
        {(() => {
          const activeCount = [
            filter !== "all", pointFilter !== "all",
            sort !== "date", minAmt !== "", maxAmt !== "", viewMode !== "list",
          ].filter(Boolean).length;
          const activePills = [
            filter !== "all"       && { label: filter === "expense" ? "Dépenses" : filter === "income" ? "Revenus" : "Cagnottes", clear: () => setFilter("all") },
            pointFilter !== "all"  && { label: pointFilter === "pointed" ? "✓ Pointées" : "⏳ Attente", clear: () => { setPointFilter("all"); onClearPointFilter?.(); } },
            sort !== "date"        && { label: sort === "amt_d" ? "Montant ↓" : "Montant ↑", clear: () => setSort("date") },
            (minAmt || maxAmt)     && { label: `${minAmt||"0"}–${maxAmt||"∞"} €`, clear: () => { setMinAmt(""); setMaxAmt(""); } },
            viewMode !== "list"    && { label: "📊 Catégories", clear: () => setViewMode("list") },
            viewMode === "calendar" && { label: "📅 Calendrier", clear: () => setViewMode("list") },
          ].filter(Boolean);

          return (
            <div>
              {/* Barre unique */}
              <div style={{ display: "flex", gap: 5, marginBottom: showFilterPanel || activePills.length > 0 ? 6 : 0 }}>
                <button onClick={() => setShowFilterPanel(p => !p)} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: activeCount > 0 ? "var(--accent-glow)" : "var(--surface2)",
                  border: `1px solid ${activeCount > 0 ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 8, padding: "0 10px", height: 36,
                  color: activeCount > 0 ? "var(--accent)" : "var(--text2)",
                  fontWeight: 700, fontSize: ".68rem", cursor: "pointer", flexShrink: 0, touchAction: "manipulation",
                }}>
                  <span>⚙️</span>
                  <span>Filtres</span>
                  {activeCount > 0 && (
                    <span style={{ background: "var(--accent)", color: "var(--bg)", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".52rem", fontWeight: 800 }}>{activeCount}</span>
                  )}
                </button>
                <button onClick={() => setGlobalSearch(g => !g)} style={{
                  width: 36, height: 36, flexShrink: 0,
                  background: globalSearch ? "var(--accent-glow)" : "var(--surface2)",
                  border: `1px solid ${globalSearch ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 8, fontSize: ".78rem", cursor: "pointer", color: globalSearch ? "var(--accent)" : "var(--text2)", touchAction: "manipulation",
                }}>🌐</button>
              </div>

              {/* Chips filtres actifs */}
              {!showFilterPanel && activePills.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                  {activePills.map((p, i) => (
                    <span key={i} onClick={p.clear} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: ".58rem", padding: "2px 8px", background: "var(--accent-glow)", border: "1px solid var(--accent)", borderRadius: 10, color: "var(--accent)", cursor: "pointer" }}>
                      {p.label} <span style={{ opacity: .7 }}>✕</span>
                    </span>
                  ))}
                  <span onClick={() => { setFilter("all"); setPointFilter("all"); setSort("date"); setMinAmt(""); setMaxAmt(""); setViewMode("list"); onClearPointFilter?.(); }} style={{ fontSize: ".58rem", padding: "2px 8px", background: "transparent", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text3)", cursor: "pointer" }}>
                    ✕ Tout reset
                  </span>
                </div>
              )}

              {/* Panneau expansible */}
              {showFilterPanel && (
                <div style={{ background: "var(--surface2)", borderRadius: 10, padding: 10, marginBottom: 8, display: "flex", flexDirection: "column", gap: 9 }}>
                  {/* Type */}
                  <div>
                    <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Type</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                      {[["all","Tout"],["income","Revenus"],["expense","Dépenses"],["savings","Cagnottes"]].map(([k,l]) => (
                        <button key={k} onClick={() => { setFilter(k); setCatId(""); }} style={{
                          background: filter===k ? "var(--accent-glow)" : "transparent",
                          border: `1px solid ${filter===k ? "var(--accent)" : "var(--border)"}`,
                          borderRadius: 6, padding: "6px 0",
                          color: filter===k ? "var(--accent)" : "var(--text2)",
                          fontSize: ".58rem", fontWeight: 700, cursor: "pointer",
                        }}>{l}</button>
                      ))}
                    </div>
                  </div>
                  {/* Pointage */}
                  <div>
                    <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Pointage</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                      {[["all","Toutes",""],["pointed","✓ Pointées","var(--success)"],["unpointed","⏳ Attente","var(--warning)"]].map(([k,l,col]) => (
                        <button key={k} onClick={() => { setPointFilter(k); onClearPointFilter?.(); }} style={{
                          background: pointFilter===k ? "var(--accent-glow)" : "transparent",
                          border: `1px solid ${pointFilter===k ? (col||"var(--accent)") : "var(--border)"}`,
                          borderRadius: 6, padding: "6px 0",
                          color: pointFilter===k ? (col||"var(--accent)") : "var(--text2)",
                          fontSize: ".58rem", fontWeight: 700, cursor: "pointer",
                        }}>{l}</button>
                      ))}
                    </div>
                  </div>
                  {/* Tri + Montant */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Tri</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {[["date","Date ↓"],["amt_d","Montant ↓"],["amt_a","Montant ↑"]].map(([k,l]) => (
                          <button key={k} onClick={() => setSort(k)} style={{
                            background: sort===k ? "var(--accent-glow)" : "transparent",
                            border: `1px solid ${sort===k ? "var(--accent)" : "var(--border)"}`,
                            borderRadius: 6, padding: "5px 0",
                            color: sort===k ? "var(--accent)" : "var(--text2)",
                            fontSize: ".62rem", fontWeight: 700, cursor: "pointer",
                          }}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Montant</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {[["min","Min €", minAmt, setMinAmt],["max","Max €", maxAmt, setMaxAmt]].map(([id,ph,val,setter]) => (
                          <input key={id} type="number" value={val} min="0" step="10" placeholder={ph}
                            onChange={e => setter(e.target.value)}
                            style={{ background: "var(--bg)", border: `1px solid ${val ? "var(--accent)" : "var(--border)"}`, borderRadius: 6, padding: "5px 8px", color: "var(--text)", fontSize: ".7rem", fontFamily: "var(--mono)" }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Vue */}
                  <div>
                    <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Vue</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                      {[["list","📋 Liste"],["cats","📊 Catégories"],["calendar","📅 Calendrier"]].map(([k,l]) => (
                        <button key={k} onClick={() => setViewMode(k)} style={{
                          background: viewMode===k ? "var(--accent-glow)" : "transparent",
                          border: `1.5px solid ${viewMode===k ? "var(--accent)" : "var(--border)"}`,
                          borderRadius: 6, padding: "7px 0",
                          color: viewMode===k ? "var(--accent)" : "var(--text2)",
                          fontSize: ".65rem", fontWeight: 700, cursor: "pointer",
                        }}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── 6. Vue Catégories ── */}
      {viewMode === "cats" && (
        <CatBreakdown txs={filtered} allTxs={transactions.filter(t => t.date.startsWith(month))} categories={categories}
          onSelectCat={id => { setCatId(id); setFilter("expense"); setViewMode("list"); }} />
      )}

      {/* ── 6b. Vue Calendrier ── */}
      {viewMode === "calendar" && (() => {
        const [y, mo] = month.split("-").map(Number);
        const firstDow   = new Date(y, mo - 1, 1).getDay();
        const firstMon   = firstDow === 0 ? 6 : firstDow - 1; // lundi = 0
        const daysInMonth = new Date(y, mo, 0).getDate();
        const today      = new Date();
        const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === mo;
        const todayDay   = today.getDate();

        // Grouper les transactions par jour
        const byDay = {};
        transactions.filter(t => t.date.startsWith(month)).forEach(t => {
          const d = parseInt(t.date.slice(8), 10);
          if (!byDay[d]) byDay[d] = [];
          byDay[d].push(t);
        });

        const cells = [];
        for (let i = 0; i < firstMon; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        const selTxs = calSelectedDay ? (byDay[calSelectedDay] || []) : [];
        const selNet = selTxs.reduce((s, t) => s + (isIncome(t.type) ? 1 : -1) * (parseFloat(t.amount) || 0), 0);

        return (
          <div>
            <div className="card" style={{ padding: "12px 10px 8px" }}>
              {/* En-têtes jours */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
                {["L","M","M","J","V","S","D"].map((d, i) => (
                  <div key={i} style={{ textAlign: "center", fontSize: ".52rem", fontWeight: 700, color: i >= 5 ? "var(--accent)" : "var(--text3)", padding: "2px 0" }}>{d}</div>
                ))}
              </div>
              {/* Cases */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const txs  = byDay[day] || [];
                  const net  = txs.reduce((s, t) => s + (isIncome(t.type) ? 1 : -1) * (parseFloat(t.amount) || 0), 0);
                  const hasTx = txs.length > 0;
                  const isPos = net >= 0;
                  const isSel = calSelectedDay === day;
                  const isTod = isCurrentMonth && day === todayDay;

                  return (
                    <div key={day}
                      onClick={() => setCalSelectedDay(isSel ? null : day)}
                      style={{
                        borderRadius: 7, padding: "5px 2px 4px",
                        background: isSel ? "var(--accent-glow)" : isTod ? "rgba(200,184,96,.10)" : hasTx ? (isPos ? "rgba(104,200,122,.08)" : "rgba(224,104,112,.08)") : "transparent",
                        border: isTod ? "1.5px solid var(--warning)" : isSel ? "1px solid var(--accent)" : hasTx ? `1px solid ${isPos ? "rgba(104,200,122,.22)" : "rgba(224,104,112,.18)"}` : "1px solid transparent",
                        cursor: hasTx ? "pointer" : "default",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5,
                        transition: "background .12s",
                      }}>
                      <span style={{ fontSize: ".6rem", fontWeight: isTod ? 800 : 500, color: isSel ? "var(--accent)" : isTod ? "var(--warning)" : hasTx ? "var(--text)" : "var(--text3)" }}>
                        {day}
                      </span>
                      {hasTx && (
                        <div style={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
                          {txs.slice(0, 4).map((t, j) => (
                            <div key={j} style={{ width: 3, height: 3, borderRadius: "50%", background: isIncome(t.type) ? "var(--success)" : "var(--danger)", opacity: .85 }} />
                          ))}
                        </div>
                      )}
                      {hasTx && (
                        <span style={{ fontSize: ".38rem", fontWeight: 700, color: isPos ? "var(--success)" : "var(--danger)", fontFamily: "var(--mono)" }}>
                          {isPos ? "+" : ""}{Math.round(net)}€
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Légende */}
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-soft)" }}>
                {[["var(--success)","Revenus"],["var(--danger)","Dépenses"],["var(--warning)","Aujourd'hui"]].map(([color, label]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
                    <span style={{ fontSize: ".48rem", color: "var(--text3)" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Détail du jour sélectionné */}
            {calSelectedDay && selTxs.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: 8 }}>
                <div style={{ padding: "8px 14px", background: "var(--surface2)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: ".62rem", fontWeight: 800, color: "var(--accent)" }}>
                    {calSelectedDay} {["Jan","Fév","Mar","Avr","Mai","Jui","Jul","Aoû","Sep","Oct","Nov","Déc"][mo - 1]} {y}
                  </span>
                  <span style={{ fontSize: ".62rem", fontWeight: 700, color: selNet >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--mono)" }}>
                    {selNet >= 0 ? "+" : ""}{selNet.toFixed(2)} €
                  </span>
                </div>
                {selTxs.map((t, i) => {
                  const cat = categories.find(c => c.id === t.categoryId);
                  const inc = isIncome(t.type);
                  return (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < selTxs.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem", flexShrink: 0 }}>
                        {cat?.icon ?? (inc ? "💰" : "💸")}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: ".72rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.note || cat?.name || "—"}</div>
                        <div style={{ fontSize: ".56rem", color: "var(--text3)", marginTop: 1 }}>{cat?.name ?? "—"}</div>
                      </div>
                      <span style={{ fontSize: ".72rem", fontWeight: 800, color: inc ? "var(--success)" : "var(--danger)", fontFamily: "var(--mono)", flexShrink: 0 }}>
                        {inc ? "+" : "−"}{fmt(t.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Filtre catégorie actif ── */}
      {viewMode === "list" && catId && (() => {
        const activeCat = categories.find(c => c.id === catId);
        return activeCat ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "6px 12px", background: "var(--accent-glow)", border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)" }}>
            <span style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--accent)", flex: 1 }}>{activeCat.icon} {activeCat.name}</span>
            <button onClick={() => setCatId("")} style={{ background: "transparent", border: "none", color: "var(--accent)", fontSize: ".8rem", cursor: "pointer" }}>✕</button>
          </div>
        ) : null;
      })()}

      {/* ── Liste avec pointage ── */}
      {viewMode === "list" && (
        filtered.length === 0
          ? <EmptyIllustration type="historique" title="Aucun mouvement" sub="Aucune transaction ne correspond à ces filtres" />
          : (
            <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 10 }}>
              {grouped.map(([date, dayTxs]) => {
                const allPointed = dayTxs.every(t => t.pointed);
                const dayNet = dayTxs.reduce((s, t) => isIncome(t.type) ? s + (parseFloat(t.amount)||0) : s - (parseFloat(t.amount)||0), 0);
                return (
                  <div key={date}>
                    <div style={{ padding: "7px 14px", background: "var(--surface2)", fontSize: ".6rem", fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-soft)" }}>
                      <span>{dateLabel(date)}</span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {allPointed && <span style={{ color: "var(--success)" }}>✓</span>}
                        <span style={{ color: dayNet >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>
                          {dayNet >= 0 ? "+" : ""}{fmt(dayNet)}
                        </span>
                      </div>
                    </div>
                    {pointFilter === "all"
                      ? dayTxs.map(t => (
                          <SwipeRow key={t.id} t={t} categories={categories} cagnottes={cagnottes}
                            onEdit={onEditTrans} onDelete={onDeleteTrans}
                            onTogglePoint={onTogglePointTx}
                            onDuplicate={onDuplicateTrans}
                            allTags={allTags} />
                        ))
                      : dayTxs.map(t => (
                          <PointRow key={t.id}
                            item={{ ...t, name: txLabel(t, categories, cagnottes), cat: categories.find(c => c.id === t.categoryId) }}
                            onToggle={onTogglePointTx}
                            onEdit={id => onEditTrans(id)}
                            onDelete={id => onDeleteTrans(id)} />
                        ))
                    }
                  </div>
                );
              })}
            </div>
          )
      )}

      {/* ── Section récurrentes en attente ── */}
      {/* ── Versements auto à confirmer ── */}
      {viewMode === "list" && !globalSearch && autoSavingsPending.length > 0 && (
        <div className="card" style={{ padding:0, overflow:"hidden", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid var(--border-soft)" }}>
            <div style={{ fontSize:".6rem", fontWeight:800, color:"var(--purple)", textTransform:"uppercase", letterSpacing:".08em" }}>🎯 Épargnes à confirmer</div>
            <span style={{ fontSize:".62rem", color:"var(--text3)" }}>{autoSavingsPending.length}</span>
          </div>
          {autoSavingsPending.map(plan => {
            const cag = cagnottes.find(c => c.id === plan.cagnotteId);
            return (
              <div key={plan.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:"1px solid var(--border-soft)" }}>
                <span style={{ fontSize:"1rem" }}>{cag?.icon||"🐷"}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:".72rem", fontWeight:700 }}>{cag?.name||"—"}</div>
                  <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>{fmt(plan.amount)} · versement mensuel</div>
                </div>
                <div style={{ display:"flex", gap:5 }}>
                  <button
                    onTouchStart={e=>e.stopPropagation()}
                    onTouchEnd={e=>{ e.stopPropagation();e.preventDefault(); onApplyAutoSaving?.(plan.id); }}
                    onClick={() => onApplyAutoSaving?.(plan.id)}
                    style={{ background:"var(--purple)", border:"none", borderRadius:7, padding:"7px 12px", color:"var(--bg)", fontWeight:800, fontSize:".7rem", cursor:"pointer", minHeight:32, touchAction:"manipulation" }}>＋</button>
                  <button
                    onTouchStart={e=>e.stopPropagation()}
                    onTouchEnd={e=>{ e.stopPropagation();e.preventDefault(); onSkipAutoSaving?.(plan.id); }}
                    onClick={() => onSkipAutoSaving?.(plan.id)}
                    style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:7, padding:"7px 10px", color:"var(--text3)", fontSize:".7rem", cursor:"pointer", minHeight:32, touchAction:"manipulation" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Programmées en attente ce mois ── */}
      {viewMode === "list" && !globalSearch && scheduledPending.length > 0 && (
        <div className="card" style={{ padding:0, overflow:"hidden", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid var(--border-soft)" }}>
            <div style={{ fontSize:".6rem", fontWeight:800, color:"var(--warning)", textTransform:"uppercase", letterSpacing:".08em" }}>📅 Programmées ce mois</div>
            <span style={{ fontSize:".62rem", color:"var(--text3)" }}>{scheduledPending.length}</span>
          </div>
          {scheduledPending.map(s => {
            const cat = categories.find(c => c.id === s.categoryId);
            return (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:"1px solid var(--border-soft)" }}>
                <span style={{ fontSize:"1rem" }}>{cat?.icon ?? "📅"}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:".72rem", fontWeight:700 }}>{s.note || cat?.name || "Dépense programmée"}</div>
                  <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>{fmt(s.amount)} · prévu le {s.date.slice(8)}</div>
                </div>
                <div style={{ display:"flex", gap:5 }}>
                  <button
                    onTouchStart={e=>e.stopPropagation()}
                    onTouchEnd={e=>{ e.stopPropagation();e.preventDefault(); onConfirmScheduled?.(s.id); }}
                    onClick={() => onConfirmScheduled?.(s.id)}
                    style={{ background:"var(--warning)", border:"none", borderRadius:7, padding:"7px 12px", color:"var(--bg)", fontWeight:800, fontSize:".7rem", cursor:"pointer", minHeight:32, touchAction:"manipulation" }}>✓</button>
                  <button
                    onTouchStart={e=>e.stopPropagation()}
                    onTouchEnd={e=>{ e.stopPropagation();e.preventDefault(); onDeleteScheduled?.(s.id); }}
                    onClick={() => onDeleteScheduled?.(s.id)}
                    style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:7, padding:"7px 10px", color:"var(--text3)", fontSize:".7rem", cursor:"pointer", minHeight:32, touchAction:"manipulation" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Récurrentes à confirmer ── */}
        <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ padding: "8px 14px", background: "var(--surface2)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: ".6rem", fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".08em" }}>🔄 Récurrentes à confirmer</div>
              <div style={{ fontSize: ".55rem", color: "var(--text3)", marginTop: 2 }}>Opérations habituelles non encore saisies ce mois</div>
            </div>
            <span style={{ fontSize: ".62rem", color: "var(--text3)" }}>{recurringPending.length}</span>
          </div>
          {recurringPending.map(tpl => {
            const cat = categories.find(c => c.id === tpl.categoryId);
            const isInc = isIncome(tpl.type);
            const freqLabel = tpl.frequency === "yearly" ? "Annuelle" : "Mensuelle";
            return (
              <div key={tpl.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border-soft)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1rem" }}>
                  {cat?.icon ?? (isInc ? "💰" : "💸")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: ".74rem", fontWeight: 700 }}>{tpl.label}</div>
                  <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 1 }}>
                    {cat?.name ?? "—"} · <span style={{ color: "var(--accent)" }}>{freqLabel}</span>
                    {tpl.occurrences != null && (() => {
                      const done = transactions.filter(t => t.templateId === tpl.id).length;
                      const left = tpl.occurrences - done;
                      return <span style={{ color: left <= 1 ? "var(--warning)" : "var(--text3)" }}> · {done}/{tpl.occurrences} ({left} restant{left > 1 ? "s" : ""})</span>;
                    })()}
                  </div>
                </div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".8rem", color: isInc ? "var(--success)" : "var(--danger)", flexShrink: 0 }}>
                  {isInc ? "+" : "−"}{fmt(tpl.amount)}
                </div>
                <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                  <button
                    onClick={() => onConfirmRecurring?.(tpl, month)}
                    style={{ background: "var(--success)", border: "none", borderRadius: 7, padding: "5px 10px", color: "var(--bg)", fontSize: ".68rem", fontWeight: 800, cursor: "pointer" }}>
                    ＋
                  </button>
                  <button
                    onClick={() => onDeleteRecurring?.(tpl.id)}
                    style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 8px", color: "var(--text3)", fontSize: ".68rem", cursor: "pointer" }}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      {/* ── Section frais fixes ── */}
      {viewMode === "list" && monthFixes.length > 0 && pointFilter !== "pointed" && (        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", background: "var(--surface2)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: ".6rem", fontWeight: 800, color: "var(--warning)", textTransform: "uppercase", letterSpacing: ".08em" }}>📌 Frais fixes du mois</div>
              <div style={{ fontSize: ".55rem", color: "var(--text3)", marginTop: 2 }}>Pointe-les quand ils débitent sur ton compte</div>
            </div>
            <span style={{ fontSize: ".62rem", color: monthFixes.every(f => f.pointedMonths?.[month]) ? "var(--success)" : "var(--warning)", fontWeight: 800 }}>
              {monthFixes.filter(f => f.pointedMonths?.[month]).length}/{monthFixes.length}
            </span>
          </div>
          {(pointFilter === "unpointed"
            ? monthFixes.filter(f => !f.pointedMonths?.[month])
            : monthFixes
          ).length === 0 && pointFilter === "unpointed"
            ? <div style={{ padding:"12px 14px", fontSize:".7rem", color:"var(--success)", textAlign:"center" }}>✅ Tous les frais fixes sont pointés</div>
            : (pointFilter === "unpointed"
                ? monthFixes.filter(f => !f.pointedMonths?.[month])
                : monthFixes
              ).map(f => {
            const cat = (data.categories || []).find(c => c.id === f.categoryId);
            const ov  = f.monthlyOverrides?.[month];  // override du mois si existe
            return (
              <PointRow key={f.id}
                item={{
                  ...f,
                  name:        ov?.name   ?? f.name,
                  amount:      ov?.amount ?? f.amount,
                  cat,
                  date:        null,
                  pointed:     !!f.pointedMonths?.[month],
                  isOverridden: !!ov,
                }}
                onToggle={handleTogglePointFix}
                onEditFixed={handleOverrideFix}
                isFixed={true} />
            );
          })}
          <div style={{ padding: "8px 14px", background: "rgba(200,184,96,.05)", display: "flex", justifyContent: "space-between", fontSize: ".65rem" }}>
            <span style={{ color: "var(--text3)" }}>Total fixes</span>
            <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--warning)" }}>−{fmt(monthFixes.reduce((s,f) => s+(f.amount||0), 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function groupByDate(txs) {
  const groups = {};
  txs.forEach(t => { if (!groups[t.date]) groups[t.date] = []; groups[t.date].push(t); });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

function dateLabel(dateStr) {
  const today = new Date();
  const d     = new Date(dateStr + "T12:00:00");
  const diff  = Math.floor((today.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  return new Date(dateStr + "T12:00:00")
    .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

// 1. Mini Donut
function HistDonut({ inc, exp, sav }) {
  const total = inc + exp + sav || 1;
  const R = 36, cx = 44, cy = 44, stroke = 10;
  const circ = 2 * Math.PI * R;
  let offset = 0;
  const segs = [
    { pct: inc / total, color: "var(--success)" },
    { pct: exp / total, color: "var(--danger)"  },
    { pct: sav / total, color: "var(--purple)"  },
  ].map(s => {
    const dash = s.pct * circ, gap = circ - dash;
    const rot  = offset * 360 - 90;
    offset    += s.pct;
    return { ...s, dash, gap, rot };
  });
  const net = inc - exp;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="88" height="88" viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--surface3)" strokeWidth={stroke}/>
        {segs.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none"
            stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${s.gap}`}
            transform={`rotate(${s.rot} ${cx} ${cy})`}/>
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="8"  fill="var(--text3)" fontWeight="700">NET</text>
        <text x={cx} y={cy + 7} textAnchor="middle" fontSize="9.5" fill={net >= 0 ? "var(--success)" : "var(--danger)"} fontWeight="800">
          {net >= 0 ? "+" : ""}{Math.round(net)}€
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
        {[
          { l: "💰 Revenus",  v: inc, c: "var(--success)" },
          { l: "💸 Dépenses", v: exp, c: "var(--danger)"  },
          { l: "🐷 Épargne",  v: sav, c: "var(--purple)"  },
        ].map(s => (
          <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.c, flexShrink: 0 }}/>
            <span style={{ fontSize: ".6rem", color: "var(--text2)", flex: 1 }}>{s.l}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: ".63rem", fontWeight: 800, color: s.c, fontVariantNumeric: "tabular-nums" }}>{fmt(s.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. Barre budget
function BudgetBar({ exp, inc }) {
  const pct   = inc > 0 ? Math.min(100, (exp / inc) * 100) : 0;
  const color = pct > 90 ? "var(--danger)" : pct > 70 ? "var(--warning)" : "var(--success)";
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: ".6rem", color: "var(--text2)", fontWeight: 700 }}>
        <span>Budget consommé</span>
        <span style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 6, background: "var(--surface3)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, var(--success), ${color})`, borderRadius: 99, transition: "width .5s ease" }}/>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: ".55rem", color: "var(--text3)" }}>
        <span>0 €</span><span>{fmt(inc)}</span>
      </div>
    </div>
  );
}

// 4. SwipeRow — avec bouton pointage intégré
function SwipeRow({ t, categories, cagnottes, onEdit, onDelete, onTogglePoint, onDuplicate, allTags = [] }) {
  const [offset,   setOffset]   = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startX  = useRef(null);
  const startY  = useRef(null);
  const isHoriz = useRef(false);
  const cat    = categories.find(c => c.id === t.categoryId);
  const { label, cls, sign } = (() => {
    const l = txLabel(t, categories, cagnottes);
    return { label: l, cls: txTypeClass(t.type), sign: txSign(t.type) };
  })();
  const icon = cat?.icon ?? (t.type === "dissolution_cagnotte" ? "🏦" : t.type === "epargne" ? "🐷" : t.type === "decagnottage" ? "↩️" : "💸");

  const PANEL = 165; // 3 × 55px

  return (
    <div style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--border-soft)" }}>
      {/* Actions cachées — ✏️ 📋 🗑️ */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: PANEL, display: "flex" }}>
        <div onClick={() => { setOffset(0); setRevealed(false); onEdit?.(t.id); }}
          style={{ width: 55, height: "100%", background: "rgba(112,184,224,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", cursor: "pointer" }}>✏️</div>
        <div onClick={() => { setOffset(0); setRevealed(false); onDuplicate?.(t); }}
          style={{ width: 55, height: "100%", background: "rgba(104,212,152,.2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer" }}>
          <span style={{ fontSize: "1rem" }}>📋</span>
          <span style={{ fontSize: ".44rem", color: "var(--success)", fontWeight: 700 }}>Dupliquer</span>
        </div>
        <div onClick={() => { setOffset(0); setRevealed(false); onDelete?.(t.id); }}
          style={{ width: 55, height: "100%", background: "rgba(200,112,112,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", cursor: "pointer" }}>🗑️</div>
      </div>
      {/* Ligne */}
      <div
        onTouchStart={e => {
          startX.current  = e.touches[0].clientX;
          startY.current  = e.touches[0].clientY;
          isHoriz.current = false;
        }}
        onTouchMove={e => {
          const dx = e.touches[0].clientX - startX.current;
          const dy = e.touches[0].clientY - startY.current;
          if (!isHoriz.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
            isHoriz.current = Math.abs(dx) > Math.abs(dy);
          }
          if (!isHoriz.current) return;
          if (dx < 0) setOffset(Math.max(-PANEL, dx));
          else if (revealed) setOffset(Math.min(0, -PANEL + dx));
        }}
        onTouchEnd={() => {
          if (!isHoriz.current) return;
          if (offset < -PANEL / 2) { setOffset(-PANEL); setRevealed(true); }
          else { setOffset(0); setRevealed(false); }
        }}
        onClick={() => { if (revealed) { setOffset(0); setRevealed(false); } }}
        style={{
          transform: `translateX(${offset}px)`,
          transition: (offset === 0 || offset === -PANEL) ? "transform .2s" : "none",
          background: "var(--bg)",
          display: "flex", alignItems: "center", gap: 8, padding: "11px 14px",
          cursor: "pointer",
        }}>
        {/* Bouton pointage — masqué pour decagnottage et transfer */}
        {onTogglePoint && isPointable(t.type) && (
          <button
            onTouchStart={e => e.stopPropagation()}
            onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); onTogglePoint(t.id); }}
            onClick={e => { e.stopPropagation(); }}
            style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: t.pointed ? "var(--success)" : "transparent",
              border: `2px solid ${t.pointed ? "var(--success)" : "var(--border)"}`,
              color: t.pointed ? "var(--bg)" : "var(--text3)",
              fontSize: ".88rem", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .15s",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}>{t.pointed ? "✓" : ""}</button>
        )}
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--surface2)", border: `1.5px solid var(--border)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: ".76rem", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1, flexWrap: "nowrap", overflow: "hidden" }}>
            <span style={{ fontSize: ".6rem", color: "var(--text3)", flexShrink: 0 }}>{cat?.name ?? "—"} · {t.date.slice(8)}/{t.date.slice(5,7)}</span>
            {(t.tagIds || []).map(tid => {
              const tag = allTags.find(tg => tg.id === tid);
              if (!tag) return null;
              return (
                <span key={tid} style={{ fontSize: ".5rem", padding: "1px 5px", background: `${tag.color}22`, color: tag.color, borderRadius: 10, fontWeight: 700, flexShrink: 0 }}>
                  {tag.icon} {tag.name}
                </span>
              );
            })}
          </div>
        </div>
        <div className={`item-amount ${cls}`} style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".85rem", flexShrink: 0 }}>
          {sign}{fmt(t.amount)}
        </div>
        <span style={{ color: "var(--text3)", fontSize: ".7rem", marginLeft: 2 }}>‹</span>
      </div>
    </div>
  );
}

// 6. Répartition catégories
function CatBreakdown({ txs, allTxs, categories, onSelectCat }) {
  const source = allTxs || txs;

  // Dépenses par catégorie
  const bycat = {};
  source.filter(t => t.type === "expense").forEach(t => {
    const c   = categories.find(c => c.id === t.categoryId);
    const key = c?.id || "__other__";
    if (!bycat[key]) bycat[key] = { id: c?.id||null, name: c?.name||"Sans catégorie", icon: c?.icon||"❓", color: c?.color||"var(--text3)", exp:0, inc:0, count:0 };
    bycat[key].exp   += parseFloat(t.amount)||0;
    bycat[key].count++;
  });

  // Revenus en déduction — même catégorie OU catégorie liée (linkedToId)
  source.filter(t => isIncome(t.type) && t.type !== "dissolution_cagnotte").forEach(t => {
    const a   = parseFloat(t.amount)||0;
    const cat = categories.find(c => c.id === t.categoryId);
    // Catégorie liée → déduire de la cible
    if (cat?.linkedToId && bycat[cat.linkedToId]) {
      bycat[cat.linkedToId].inc += a;
    } else if (t.categoryId && bycat[t.categoryId]) {
      // Même catégorie directe
      bycat[t.categoryId].inc += a;
    }
  });

  const sorted    = Object.values(bycat).map(c => ({ ...c, net: Math.max(0, c.exp - c.inc) })).sort((a,b) => b.net - a.net);
  const totalNet  = sorted.reduce((s, c) => s + c.net, 0) || 1;

  if (sorted.length === 0) return (
    <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text3)", fontSize: ".75rem" }}>Aucune dépense ce mois</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.map(c => {
        const hasOffset = c.inc > 0;
        return (
          <div key={c.name}
            onClick={() => c.id && onSelectCat?.(c.id)}
            style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderLeft: `3px solid ${c.color}`, borderRadius: "var(--radius-sm)",
              padding: "10px 12px", cursor: c.id ? "pointer" : "default",
            }}>
            {/* En-tête : nom + montants */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: hasOffset ? 4 : 6, alignItems: "center" }}>
              <span style={{ fontSize: ".75rem", fontWeight: 700 }}>{c.icon} {c.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {hasOffset
                  ? <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--success)", fontSize: ".78rem", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(c.net)}
                    </span>
                  : <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: c.color, fontSize: ".78rem", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(c.exp)}
                    </span>
                }
                <span style={{ fontSize: ".58rem", color: "var(--text3)" }}>{c.count} op.</span>
                {c.id && <span style={{ color: "var(--text3)", fontSize: ".75rem" }}>›</span>}
              </div>
            </div>
            {/* Ligne de déduction si remboursement */}
            {hasOffset && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, padding: "3px 6px", background: "rgba(104,212,152,.07)", borderRadius: 5 }}>
                <span style={{ fontSize: ".6rem", color: "var(--success)" }}>↩ Remboursé / partagé</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: ".62rem", fontWeight: 700, color: "var(--success)" }}>−{fmt(c.inc)}</span>
              </div>
            )}
            {/* Barre de progression — basée sur le net */}
            <div style={{ height: 5, background: "var(--surface3)", borderRadius: 99 }}>
              <div style={{ width: `${(c.net / totalNet * 100).toFixed(0)}%`, height: "100%", background: c.color, borderRadius: 99 }}/>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".55rem", color: "var(--text3)", marginTop: 2 }}>
              <span>{hasOffset ? `Brut : ${fmt(c.exp)}` : ""}</span>
              <span>{(c.net / totalNet * 100).toFixed(0)}% des dépenses nettes</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  FIXES
// ─────────────────────────────────────────────────────────────────
export function FixesView({ data, onNewFixed, onEditFixed, onDeleteFixed, onSaveProvisional, onDeleteProvisional }) {
  const { fixedExpenses, categories } = data;
  const provisionalExpenses = data.provisionalExpenses || [];
  const [selected,    setSelected]    = useState(null); // id carte sélectionnée (tap)
  const [showProvForm, setShowProvForm] = useState(false);
  const [provName,    setProvName]    = useState("");
  const [provAmt,     setProvAmt]     = useState("");
  const [provErr,     setProvErr]     = useState({});
  const total     = fixedExpenses.reduce((s, f) => s + (f.amount || 0), 0);
  const provTotal = provisionalExpenses.reduce((s, p) => s + (p.amount || 0), 0);

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
    background: "var(--card-bg, #1e1e2e)",
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
      {/* ── Carte récap totaux ── */}
      <div style={{
        background: "linear-gradient(135deg, #0c1830 0%, #182a48 100%)",
        borderRadius: 14, padding: "13px 16px", marginBottom: 12,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        boxShadow: "0 4px 18px rgba(112,184,224,.15)",
      }}>
        <div>
          <div style={{ fontSize: ".6rem", color: "rgba(255,255,255,.55)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>
            📌 Fixes / mois
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: "1.4rem", fontWeight: 800, color: "#fff", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
            {fmt(total)}
          </div>
          <div style={{ fontSize: ".62rem", color: "rgba(255,255,255,.4)", marginTop: 2 }}>
            {fixedExpenses.length} frais récurrents
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: ".6rem", color: "rgba(255,255,255,.55)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>
            🔮 Prévisions
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: "1rem", fontWeight: 700, color: "var(--warning)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
            −{fmt(provTotal)}
          </div>
          <div style={{ fontSize: ".62rem", color: "rgba(255,255,255,.4)", marginTop: 2 }}>
            {provisionalExpenses.length} prévision{provisionalExpenses.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* ── Bouton ajouter frais fixe ── */}
      <button className="btn btn-outline" style={{ width: "100%", marginBottom: 10 }} onClick={onNewFixed}>
        + Ajouter un frais fixe
      </button>

      {/* ── Grille 4 colonnes — frais fixes ── */}
      {fixedExpenses.length === 0
        ? <EmptyIllustration type="fixes" title="Aucun frais fixe" sub="Ajoute tes charges récurrentes pour les déduire automatiquement" cta="+ Ajouter" onCta={onNewFixed} ctaColor="var(--accent2)" />
        : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7, marginBottom: 16 }}>
            {fixedExpenses.map((f, idx) => {
              const cat    = categories.find(c => c.id === f.categoryId);
              const selKey = f.id ?? idx;
              return (
                <div key={selKey} style={card4(selKey, "var(--accent)")}
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
                  {/* Boutons visibles au tap uniquement */}
                  {selected === selKey && (
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                      <button className="btn-action" style={{ fontSize: ".65rem", padding: "3px 6px" }}
                        onClick={e => { e.stopPropagation(); onEditFixed(idx); }}>✏️</button>
                      <button className="btn-action btn-del" style={{ fontSize: ".65rem", padding: "3px 6px" }}
                        onClick={e => { e.stopPropagation(); onDeleteFixed(idx); }}>✕</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      }

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
  const tf    = useTotalFixes(fixedExpenses);
  const curYM = currentYM();

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
//  Modal Tags transversaux
// ─────────────────────────────────────────────────────────────────
const TAG_COLORS = ["#70b8e0","#68d498","#b090e0","#c87070","#c8b860","#88c880","#e08870"];
const TAG_ICONS  = ["🏖️","🎉","🔨","✈️","🎓","🏥","🎁","🍽️","🏠","💼","🌿","🎮"];

function TagsModal({ onClose, tags, transactions, fixedExpenses, categories, onSaveTag, onDeleteTag }) {
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
                        const isInc = isIncome(t.type);
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
        .filter(f => f.categoryId === selCatId)
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
        const ov = f.monthlyOverrides?.[ym];
        total += (ov?.amount ?? f.amount) || 0;
      }
      return s + total;
    }, 0);
  const monthsWithFix = Array.from({ length: monthsElapsed }, (_, i) => {
    const ym = `${yearStr}-${String(i + 1).padStart(2, "0")}`;
    return ym >= startYM ? 1 : 0;
  }).reduce((s, v) => s + v, 0);
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
            return (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: ".6rem", color: "var(--warning)", padding: "5px 9px", background: "var(--warning-glow)", borderRadius: "6px 6px 0 0" }}>
                  📌 Dont {fmt(yearFixExp)} de frais fixes ({monthsWithFix} mois)
                </div>
                <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 6px 6px", padding: "6px 9px", display: "flex", flexDirection: "column", gap: 3 }}>
                  {fixes.map(f => (
                    <div key={f.id} style={{ display: "flex", justifyContent: "space-between", fontSize: ".6rem" }}>
                      <span style={{ color: "var(--text2)" }}>• {f.name}</span>
                      <span style={{ fontFamily: "var(--mono)", color: "var(--warning)", fontWeight: 700 }}>{monthsWithFix} × {fmt(f.amount)} = {fmt(f.amount * monthsWithFix)}</span>
                    </div>
                  ))}
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
                const isInc = isIncome(t.type);
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
    const tf    = fixedExpenses.reduce((s, f) => s + f.amount, 0);
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
              + data.fixedExpenses.filter(f=>f.categoryId===c.id)
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
  const tf     = fixedExpenses.reduce((s, f) => s + f.amount, 0);
  const now    = new Date();
  const isCurY = currentYear === now.getFullYear();
  // ⚠ Correction UTC : utilise l'heure locale au lieu de toISOString()
  const curYM  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

// ─────────────────────────────────────────────────────────────────
//  OPTIONS
// ─────────────────────────────────────────────────────────────────
// Formulaire d'ajout de liaison — composant séparé pour son propre état
// ─────────────────────────────────────────────────────────────────
//  Bottom Sheet générique
// ─────────────────────────────────────────────────────────────────
function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.65)", zIndex:600, overflowY:"auto", WebkitOverflowScrolling:"touch" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"var(--bg)", width:"100%", maxWidth:560, margin:"0 auto", minHeight:"100%", padding:"20px 16px 48px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ fontSize:".9rem", fontWeight:800 }}>{title}</div>
          <button onClick={onClose} style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:8, padding:"7px 12px", color:"var(--text2)", cursor:"pointer", fontSize:".78rem", touchAction:"manipulation" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LinkForm({ categories, onLink }) {
  const [srcId, setSrcId] = useState("");
  const [dstId, setDstId] = useState("");
  const canLink = srcId && dstId && srcId !== dstId;
  function doLink() {
    if (!canLink) return;
    onLink({ id: srcId, linkedToId: dstId });
    setSrcId(""); setDstId("");
  }
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:7, borderTop:"1px solid var(--border-soft)", paddingTop:10 }}>
      <select value={srcId} onChange={e => setSrcId(e.target.value)}
        style={{ background:"var(--bg)", border:`1px solid ${srcId ? "var(--accent)" : "var(--border)"}`, borderRadius:8, padding:"10px 12px", color:"var(--text)", fontSize:".78rem" }}>
        <option value="">↩ Source (remboursement / partage…)</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
      </select>
      <select value={dstId} onChange={e => setDstId(e.target.value)}
        style={{ background:"var(--bg)", border:`1px solid ${dstId ? "var(--accent)" : "var(--border)"}`, borderRadius:8, padding:"10px 12px", color:"var(--text)", fontSize:".78rem" }}>
        <option value="">💸 Cible (catégorie de dépense…)</option>
        {categories.filter(c => c.id !== srcId).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
      </select>
      <button
        disabled={!canLink}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); doLink(); }}
        onClick={doLink}
        style={{
          background: canLink ? "var(--accent)" : "var(--surface2)",
          border:"none", borderRadius:9, padding:"11px",
          color: canLink ? "var(--bg)" : "var(--text3)",
          fontWeight:800, fontSize:".78rem",
          cursor: canLink ? "pointer" : "default",
          touchAction:"manipulation",
        }}>
        🔗 Créer la liaison
      </button>
    </div>
  );
}

export function OptionsView({ data, onEditCat, onDeleteCat, onNewCat, onExport, onImport, onReset, onDeleteRecurring, alertEnabled = false, alertThreshold = 500, onSaveAlertSettings, roundingEnabled = false, roundingCagnotteId = null, roundingRule = "ceil", onSaveRoundingSettings, autoSavings = [], onSaveAutoSaving, onDeleteAutoSaving, pinEnabled = false, pinHash = null, bioEnabled = false, onSaveSecuritySettings, onPushBack, onPopBack }) {
  const [catFilter,     setCatFilter]     = useState("all");
  const [alertOn,       setAlertOn]       = useState(alertEnabled);
  const [thresh,        setThresh]        = useState(String(alertThreshold));
  const [roundOn,       setRoundOn]       = useState(roundingEnabled);
  const [roundCagId,    setRoundCagId]    = useState(roundingCagnotteId || "");
  const [roundRule,     setRoundRule]     = useState(roundingRule);
  // Versement auto
  const [addingPlan,    setAddingPlan]    = useState(false);
  const [planDraft,     setPlanDraft]     = useState({ cagnotteId:"", amount:"", dayOfMonth:"1" });
  // Sécurité
  const [pinOn,         setPinOn]         = useState(pinEnabled);
  const [bioOn,         setBioOn]         = useState(bioEnabled);
  const [pinSetup,      setPinSetup]      = useState(null); // null | "enter" | "confirm"
  const [pinEntry,      setPinEntry]      = useState("");
  const [pinFirst,      setPinFirst]      = useState("");
  const [pinError,      setPinError]      = useState("");

  function saveAlert(enabled, value) {
    const t = parseFloat(value) || 0;
    setAlertOn(enabled); setThresh(String(t));
    onSaveAlertSettings?.(enabled, t);
  }
  const filtered = useMemo(
    () => data.categories.filter(c => catFilter === "all" || c.type === catFilter),
    [data.categories, catFilter]
  );

  // ⑦ Stats globales
  const globalStats = useMemo(() => {
    const txs = data.transactions;
    if (!txs.length) return null;
    const earliest = txs.reduce((min, t) => t.date < min ? t.date : min, txs[0].date);
    const totalGere = txs.reduce((s, t) => s + (parseFloat(t.amount)||0), 0);
    return { count: txs.length, earliest, totalGere };
  }, [data.transactions]);

  // ⑩ Compteur d'usage par catégorie
  const catUsage = useMemo(() => {
    const map = {};
    data.transactions.forEach(t => {
      if (t.categoryId) map[t.categoryId] = (map[t.categoryId] || 0) + 1;
    });
    return map;
  }, [data.transactions]);

  // ⑧ Jours depuis dernière sauvegarde
  const daysSinceBackup = data.lastBackupDate
    ? Math.floor((Date.now() - new Date(data.lastBackupDate)) / 86400000)
    : null;
  const backupOk = daysSinceBackup !== null && daysSinceBackup <= 7;

  // Feuille ouverte
  const [openSheet, setOpenSheet] = useState(null);
  const [showBackupHist, setShowBackupHist] = useState(false);

  const close = () => setOpenSheet(null);

  // Enregistre/désenregistre dans le back stack quand un sheet est ouvert
  useEffect(() => {
    if (!openSheet) return;
    onPushBack?.(() => setOpenSheet(null));
    return () => onPopBack?.();
  }, [openSheet]);

  // Détection scroll vs tap
  const touchPosRef  = useRef({ x: 0, y: 0 });
  const touchMovedRef = useRef(false);

  // Tooltip "non configuré"
  const [tooltip, setTooltip] = useState(null);
  const tooltipTimer = useRef(null);
  function showTooltip(msg) {
    clearTimeout(tooltipTimer.current);
    setTooltip(msg);
    tooltipTimer.current = setTimeout(() => setTooltip(null), 2500);
  }

  // Badges
  const autoCount   = autoSavings.filter(p=>p.enabled).length;
  const roundCag    = data.cagnottes.find(c=>c.id===roundingCagnotteId);
  const linkedCount = data.categories.filter(c=>c.linkedToId).length;
  const recurCount  = (data.recurringTemplates||[]).length;
  const last        = (data.backupHistory||[])[0];

  const GROUPS = [
    {
      title:"🔒 Sécurité", color:"var(--accent)",
      items:[
        { id:"security", icon:"🔒", label:"PIN & biométrie",
          badge: pinOn?"PIN actif":"Désactivé",
          configured: pinOn,
          hint: "PIN et biométrie non configurés" },
      ]
    },
    {
      title:"🐷 Épargne", color:"var(--success)",
      items:[
        { id:"autoSavings", icon:"🎯", label:"Versements automatiques",
          badge: autoCount > 0 ? `${autoCount} plan${autoCount>1?"s":""}` : "Inactif",
          configured: autoCount > 0,
          hint: "Aucun versement automatique actif" },
        { id:"rounding", icon:"🐷", label:"Arrondi automatique",
          badge: roundOn && roundCag ? roundCag.name : "Désactivé",
          configured: roundOn && !!roundCag,
          hint: "Arrondi automatique désactivé" },
        { id:"alert", icon:"🔔", label:"Alerte solde bas",
          badge: alertOn ? `${thresh} €` : "Désactivé",
          configured: alertOn,
          hint: "Aucune alerte de solde définie" },
      ]
    },
    {
      title:"🏷️ Catégories", color:"var(--purple)",
      items:[
        { id:"categories", icon:"🏷️", label:"Gestion catégories",
          badge: `${data.categories.length} cat.`,
          configured: true,
          hint: "" },
        { id:"links", icon:"🔗", label:"Liaisons",
          badge: linkedCount > 0 ? `${linkedCount} lien${linkedCount>1?"s":""}` : "Aucune",
          configured: linkedCount > 0,
          hint: "Aucune liaison de catégorie créée" },
        { id:"recurring", icon:"🔄", label:"Récurrentes",
          badge: recurCount > 0 ? `${recurCount} modèle${recurCount>1?"s":""}` : "Aucune",
          configured: recurCount > 0,
          hint: "Aucune transaction récurrente définie" },
      ]
    },
    {
      title:"💾 Données", color:"#c8b860",
      items:[
        { id:"backup", icon:"💾", label:"Sauvegarde",
          badge: last ? `il y a ${daysSinceBackup}j` : "Jamais",
          configured: !!last,
          hint: "Aucune sauvegarde effectuée" },
      ]
    },
  ];

  return (
    <div>
      {/* ── Menu groupé ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {GROUPS.map(group => (
          <div key={group.title}>
            <div style={{ fontSize:".6rem", fontWeight:800, color:"var(--text3)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:6, paddingLeft:4 }}>
              {group.title}
            </div>
            <div style={{ background:"var(--surface)", borderRadius:12, overflow:"hidden", border:"1px solid var(--border)" }}>
              {group.items.map((item, i) => (
                <div key={item.id}
                  onTouchStart={e=>{ e.stopPropagation(); touchPosRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; touchMovedRef.current=false; }}
                  onTouchMove={e=>{ const dx=Math.abs(e.touches[0].clientX-touchPosRef.current.x); const dy=Math.abs(e.touches[0].clientY-touchPosRef.current.y); if(dx>8||dy>8) touchMovedRef.current=true; }}
                  onTouchEnd={e=>{ e.stopPropagation(); e.preventDefault(); if(touchMovedRef.current) return; if(!item.configured && item.hint) showTooltip(item.hint + " · Paramétrez ci-dessous"); setOpenSheet(item.id); }}
                  onClick={()=>setOpenSheet(item.id)}
                  style={{
                    display:"flex", alignItems:"center", gap:10, padding:"14px 16px",
                    borderBottom: i<group.items.length-1 ? "1px solid var(--border-soft)" : "none",
                    cursor:"pointer", touchAction:"manipulation",
                  }}>
                  <span style={{ fontSize:"1rem", width:22, textAlign:"center" }}>{item.icon}</span>
                  <span style={{ flex:1, fontSize:".76rem", fontWeight:600 }}>{item.label}</span>
                  <span style={{ fontSize:".58rem", fontWeight:700, color: item.configured ? "var(--success)" : "var(--warning)", padding:"2px 8px", background: item.configured ? "#1a3a2a" : "#3a2500", borderRadius:10, flexShrink:0 }}>
                    {item.badge}
                  </span>
                  <span style={{ color:"var(--text3)", fontSize:".8rem", flexShrink:0 }}>›</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Actions directes */}
        <div style={{ background:"var(--surface)", borderRadius:12, overflow:"hidden", border:"1px solid var(--border)" }}>

      {/* Toast "non configuré" */}
      {tooltip && (
        <div style={{
          position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)",
          background:"#3a2500", border:"1px solid var(--warning)", color:"var(--warning)",
          borderRadius:10, padding:"9px 16px", fontSize:".7rem", fontWeight:700,
          zIndex:9999, maxWidth:"80vw", textAlign:"center",
          boxShadow:"0 4px 20px rgba(0,0,0,.5)",
          pointerEvents:"none",
        }}>
          ⚙️ {tooltip}
        </div>
      )}
          <div onClick={onImport} style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", borderBottom:"1px solid var(--border-soft)", cursor:"pointer" }}>
            <span style={{ fontSize:"1rem", width:22, textAlign:"center" }}>⬆️</span>
            <span style={{ flex:1, fontSize:".76rem", fontWeight:600 }}>Importer des données</span>
            <span style={{ color:"var(--text3)", fontSize:".8rem" }}>›</span>
          </div>
          <div onClick={onReset} style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", cursor:"pointer" }}>
            <span style={{ fontSize:"1rem", width:22, textAlign:"center" }}>⚠️</span>
            <span style={{ flex:1, fontSize:".76rem", fontWeight:600, color:"var(--danger)" }}>Réinitialiser toutes les données</span>
            <span style={{ color:"var(--danger)", fontSize:".8rem", opacity:.5 }}>›</span>
          </div>
        </div>
      </div>

      {/* ── Stats globales ── */}
      {globalStats && (
        <div style={{ background:"linear-gradient(135deg,#0c1830,#182a48)", borderRadius:"var(--radius)", padding:"14px 16px", marginTop:16, boxShadow:"0 4px 18px rgba(112,184,224,.12)" }}>
          <div style={{ fontSize:".58rem", color:"rgba(255,255,255,.5)", fontWeight:700, textTransform:"uppercase", letterSpacing:".12em", marginBottom:10 }}>
            📊 Statistiques globales
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[
              { icon:"📋", label:"Transactions",       value:globalStats.count },
              { icon:"📅", label:"Première opération", value:new Date(globalStats.earliest+"T12:00:00").toLocaleDateString("fr-FR",{month:"short",year:"numeric"}) },
              { icon:"💶", label:"Total géré",         value:fmt(globalStats.totalGere) },
              { icon:"🏷️", label:"Catégories",         value:data.categories.length },
            ].map(s=>(
              <div key={s.label} style={{ background:"rgba(255,255,255,.06)", borderRadius:10, padding:"10px 12px" }}>
                <div style={{ fontSize:".58rem", color:"rgba(255,255,255,.45)", marginBottom:4 }}>{s.icon} {s.label}</div>
                <div style={{ fontFamily:"var(--mono)", fontWeight:800, color:"#fff", fontSize:".85rem" }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Version */}
      <div style={{ marginTop:32, textAlign:"center", color:"var(--text3)", fontSize:".65rem", letterSpacing:".06em", fontWeight:600 }}>
        {APP_NAME} — v{APP_VERSION}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* SHEETS                                                 */}
      {/* ══════════════════════════════════════════════════════ */}

      {/* 🔒 Sécurité */}
      <Sheet open={openSheet==="security"} onClose={close} title="🔒 Sécurité">
        <div onClick={()=>{const n=!bioOn;setBioOn(n);onSaveSecuritySettings?.(pinOn,pinHash,n);}}
          style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:bioOn?"rgba(112,184,224,.06)":"var(--surface2)", border:`1px solid ${bioOn?"rgba(112,184,224,.2)":"var(--border)"}`, borderRadius:10, marginBottom:10, cursor:"pointer", touchAction:"manipulation" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:".76rem", fontWeight:700, color:bioOn?"var(--accent)":"var(--text2)" }}>Empreinte / FaceID</div>
            <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>Déverrouillage biométrique Android</div>
          </div>
          <div style={{ width:40, height:22, borderRadius:11, background:bioOn?"var(--accent)":"var(--border)", position:"relative", transition:"background .2s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:3, left:bioOn?19:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
          </div>
        </div>
        <div onClick={()=>{if(pinOn){setPinOn(false);onSaveSecuritySettings?.(false,null,bioOn);}else setPinSetup("enter");}}
          style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:pinOn?"rgba(112,184,224,.06)":"var(--surface2)", border:`1px solid ${pinOn?"rgba(112,184,224,.2)":"var(--border)"}`, borderRadius:10, marginBottom:pinSetup||pinOn?10:0, cursor:"pointer", touchAction:"manipulation" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:".76rem", fontWeight:700, color:pinOn?"var(--accent)":"var(--text2)" }}>Code PIN (4 chiffres)</div>
            <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>{pinOn?"Verrou actif à l'ouverture":"Fallback si biométrie indisponible"}</div>
          </div>
          <div style={{ width:40, height:22, borderRadius:11, background:pinOn?"var(--accent)":"var(--border)", position:"relative", transition:"background .2s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:3, left:pinOn?19:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
          </div>
        </div>
        {pinSetup && (
          <div style={{ background:"var(--surface2)", border:"1.5px solid var(--accent)", borderRadius:10, padding:14, marginBottom:10 }}>
            <div style={{ fontSize:".68rem", fontWeight:800, color:"var(--accent)", marginBottom:10 }}>
              {pinSetup==="enter"?"Choisir un code PIN":"Confirmer le code PIN"}
            </div>
            <div style={{ display:"flex", gap:14, marginBottom:12, justifyContent:"center" }}>
              {[0,1,2,3].map(i=>(
                <div key={i} style={{ width:14, height:14, borderRadius:"50%", background:i<pinEntry.length?"var(--accent)":"transparent", border:"2px solid rgba(112,184,224,.4)", transition:"background .1s" }} />
              ))}
            </div>
            {pinError && <div style={{ fontSize:".62rem", color:"var(--danger)", marginBottom:8, textAlign:"center" }}>{pinError}</div>}
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center", maxWidth:210, margin:"0 auto 12px" }}>
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k,i)=>(
                k===""
                  ? <div key={i} style={{ width:54, height:42 }} />
                  : <button key={i}
                      onTouchStart={e=>e.stopPropagation()}
                      onTouchEnd={e=>{ e.stopPropagation();e.preventDefault();
                        if(k==="⌫"){setPinEntry(p=>p.slice(0,-1));setPinError("");return;}
                        const next=pinEntry+k; if(next.length>4)return; setPinEntry(next);
                        if(next.length===4){
                          if(pinSetup==="enter"){setPinFirst(next);setPinEntry("");setPinSetup("confirm");}
                          else{ if(next===pinFirst){sha256hex(next).then(h=>{onSaveSecuritySettings?.(true,h,bioOn);setPinOn(true);setPinSetup(null);setPinEntry("");setPinFirst("");});} else{setPinEntry("");setPinError("Les codes ne correspondent pas");} }
                        }
                      }}
                      onClick={()=>{}}
                      style={{ width:54, height:42, background:"var(--bg)", border:"1px solid var(--border)", borderRadius:9, color:"#e8f0e8", fontSize:k==="⌫"?"1rem":"1.1rem", fontWeight:700, cursor:"pointer", touchAction:"manipulation" }}>
                      {k}
                    </button>
              ))}
            </div>
            <button onClick={()=>{setPinSetup(null);setPinEntry("");setPinFirst("");setPinError("");}} style={{ width:"100%", background:"transparent", border:"1px solid var(--border)", borderRadius:8, padding:"8px", color:"var(--text3)", fontSize:".7rem", cursor:"pointer" }}>Annuler</button>
          </div>
        )}
        {pinOn && !pinSetup && (
          <button onClick={()=>{setPinSetup("enter");setPinEntry("");}}
            style={{ width:"100%", background:"transparent", border:"1px solid var(--border)", borderRadius:9, padding:"10px", color:"var(--text2)", fontSize:".72rem", fontWeight:700, cursor:"pointer", touchAction:"manipulation" }}>
            ✏️ Modifier le code PIN
          </button>
        )}
      </Sheet>

      {/* 🎯 Versements automatiques */}
      <Sheet open={openSheet==="autoSavings"} onClose={close} title="🎯 Versements automatiques">
        <div style={{ fontSize:".65rem", color:"var(--text3)", lineHeight:1.6, marginBottom:12 }}>
          Virement mensuel planifié vers une cagnotte. Il apparaît dans l'Historique pour confirmation.
        </div>
        {autoSavings.map(plan => {
          const cag = data.cagnottes.find(c=>c.id===plan.cagnotteId);
          return (
            <div key={plan.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", background:"var(--surface2)", border:`1px solid ${plan.enabled?"rgba(176,144,224,.25)":"var(--border)"}`, borderRadius:9, marginBottom:6 }}>
              <span style={{ fontSize:".9rem" }}>{cag?.icon||"🐷"}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:".74rem", fontWeight:700 }}>{cag?.name||"—"}</div>
                <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>{fmt(plan.amount)} le {plan.dayOfMonth} de chaque mois</div>
              </div>
              <div onClick={()=>onSaveAutoSaving?.({...plan,enabled:!plan.enabled})}
                style={{ width:36, height:20, borderRadius:10, background:plan.enabled?"var(--purple)":"var(--border)", position:"relative", cursor:"pointer", transition:"background .2s", flexShrink:0 }}>
                <div style={{ position:"absolute", top:2, left:plan.enabled?17:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
              </div>
              <button onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();e.preventDefault();onDeleteAutoSaving?.(plan.id);}} onClick={()=>onDeleteAutoSaving?.(plan.id)}
                style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:6, padding:"4px 8px", color:"var(--text3)", fontSize:".65rem", cursor:"pointer", minHeight:28, touchAction:"manipulation" }}>✕</button>
            </div>
          );
        })}
        {!addingPlan ? (
          <button onClick={()=>setAddingPlan(true)} style={{ width:"100%", background:"transparent", border:"1.5px dashed var(--purple)", borderRadius:9, padding:"10px", color:"var(--purple)", fontWeight:700, fontSize:".75rem", cursor:"pointer", marginTop:4, touchAction:"manipulation" }}>
            ＋ Planifier un versement
          </button>
        ) : (
          <div style={{ background:"var(--surface2)", border:"1.5px solid var(--purple)", borderRadius:10, padding:12, marginTop:4 }}>
            <select value={planDraft.cagnotteId} onChange={e=>setPlanDraft(d=>({...d,cagnotteId:e.target.value}))}
              style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--accent)", borderRadius:8, padding:"9px 10px", color:"var(--text)", fontSize:".78rem", marginBottom:8 }}>
              <option value="">Choisir une cagnotte…</option>
              {data.cagnottes.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:".58rem", color:"var(--text2)", marginBottom:3 }}>Montant (€)</div>
                <input type="number" value={planDraft.amount} min="1" placeholder="50" onChange={e=>setPlanDraft(d=>({...d,amount:e.target.value}))}
                  style={{ width:"100%", background:"var(--bg)", border:`1px solid ${planDraft.amount?"var(--purple)":"var(--border)"}`, borderRadius:7, padding:"8px 10px", color:"var(--text)", fontSize:".85rem", fontFamily:"var(--mono)", boxSizing:"border-box" }} />
              </div>
              <div>
                <div style={{ fontSize:".58rem", color:"var(--text2)", marginBottom:3 }}>Jour du mois</div>
                <select value={planDraft.dayOfMonth} onChange={e=>setPlanDraft(d=>({...d,dayOfMonth:e.target.value}))}
                  style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--border)", borderRadius:7, padding:"8px 10px", color:"var(--text)", fontSize:".78rem" }}>
                  {[1,5,10,15,20,25,28].map(d=><option key={d} value={d}>Le {d}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={()=>setAddingPlan(false)} style={{ flex:1, background:"transparent", border:"1px solid var(--border)", borderRadius:8, padding:"8px", color:"var(--text3)", fontSize:".7rem", cursor:"pointer" }}>Annuler</button>
              <button onClick={()=>{if(!planDraft.cagnotteId||!planDraft.amount)return;onSaveAutoSaving?.({cagnotteId:planDraft.cagnotteId,amount:parseFloat(planDraft.amount),dayOfMonth:parseInt(planDraft.dayOfMonth),enabled:true});setAddingPlan(false);setPlanDraft({cagnotteId:"",amount:"",dayOfMonth:"1"});}}
                style={{ flex:2, background:planDraft.cagnotteId&&planDraft.amount?"var(--purple)":"var(--surface2)", border:"none", borderRadius:8, padding:"8px", color:planDraft.cagnotteId&&planDraft.amount?"var(--bg)":"var(--text3)", fontWeight:800, fontSize:".75rem", cursor:"pointer", touchAction:"manipulation" }}>
                Créer
              </button>
            </div>
          </div>
        )}
      </Sheet>

      {/* 🐷 Arrondi automatique */}
      <Sheet open={openSheet==="rounding"} onClose={close} title="🐷 Arrondi automatique">
        <div style={{ fontSize:".65rem", color:"var(--text3)", lineHeight:1.6, marginBottom:12 }}>
          À chaque dépense, verse la différence jusqu'à l'arrondi dans une cagnotte.
        </div>
        <div onClick={()=>{const n=!roundOn;setRoundOn(n);onSaveRoundingSettings?.(n,roundCagId||null,roundRule);}}
          style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:roundOn?"rgba(104,212,152,.06)":"var(--surface2)", border:`1px solid ${roundOn?"rgba(104,212,152,.2)":"var(--border)"}`, borderRadius:10, marginBottom:roundOn?12:0, cursor:"pointer", touchAction:"manipulation" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:".76rem", fontWeight:700, color:roundOn?"var(--success)":"var(--text2)" }}>Arrondi automatique {roundOn?"activé":"désactivé"}</div>
            <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>Verse la différence dans une cagnotte</div>
          </div>
          <div style={{ width:40, height:22, borderRadius:11, background:roundOn?"var(--success)":"var(--border)", position:"relative", transition:"background .2s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:3, left:roundOn?19:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
          </div>
        </div>
        {roundOn && (<>
          <div style={{ fontSize:".62rem", color:"var(--text2)", fontWeight:700, marginBottom:6 }}>Cagnotte cible</div>
          <select value={roundCagId} onChange={e=>{setRoundCagId(e.target.value);onSaveRoundingSettings?.(roundOn,e.target.value,roundRule);}}
            style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--border)", borderRadius:8, padding:"9px 10px", color:"var(--text)", fontSize:".78rem", marginBottom:12 }}>
            <option value="">Choisir une cagnotte…</option>
            {data.cagnottes.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <div style={{ fontSize:".62rem", color:"var(--text2)", fontWeight:700, marginBottom:6 }}>Arrondir à</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
            {[["ceil","L'euro sup."],["5","5 € sup."],["10","10 € sup."]].map(([k,l])=>(
              <button key={k} onClick={()=>{setRoundRule(k);onSaveRoundingSettings?.(roundOn,roundCagId,k);}} style={{
                background:roundRule===k?"rgba(104,212,152,.12)":"transparent",
                border:`1px solid ${roundRule===k?"var(--success)":"var(--border)"}`,
                borderRadius:8, padding:"9px 0", color:roundRule===k?"var(--success)":"var(--text2)", fontSize:".68rem", fontWeight:700, cursor:"pointer",
              }}>{l}</button>
            ))}
          </div>
        </>)}
      </Sheet>

      {/* 🔔 Alerte solde bas */}
      <Sheet open={openSheet==="alert"} onClose={close} title="🔔 Alerte solde bas">
        <div onClick={()=>saveAlert(!alertOn, thresh)}
          style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:alertOn?"rgba(200,184,96,.06)":"var(--surface2)", border:`1px solid ${alertOn?"rgba(200,184,96,.2)":"var(--border)"}`, borderRadius:10, marginBottom:alertOn?12:0, cursor:"pointer", touchAction:"manipulation" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:".76rem", fontWeight:700, color:alertOn?"var(--warning)":"var(--text2)" }}>Alerte {alertOn?"activée":"désactivée"}</div>
            <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>Notification si le solde passe sous le seuil</div>
          </div>
          <div style={{ width:40, height:22, borderRadius:11, background:alertOn?"var(--warning)":"var(--border)", position:"relative", transition:"background .2s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:3, left:alertOn?19:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
          </div>
        </div>
        {alertOn && (
          <div>
            <div style={{ fontSize:".62rem", color:"var(--text2)", fontWeight:700, marginBottom:6 }}>Seuil d'alerte (€)</div>
            <input type="number" value={thresh} min="0" step="50"
              onChange={e=>{setThresh(e.target.value);onSaveAlertSettings?.(alertOn,parseFloat(e.target.value)||0);}}
              style={{ width:"100%", background:"var(--bg)", border:"1.5px solid var(--warning)", borderRadius:9, padding:"11px 14px", color:"var(--text)", fontSize:"1.1rem", fontFamily:"var(--mono)", boxSizing:"border-box", marginBottom:10 }} />
            <div style={{ display:"flex", gap:6 }}>
              {[200,500,1000].map(v=>(
                <button key={v} onClick={()=>{setThresh(String(v));onSaveAlertSettings?.(alertOn,v);}}
                  style={{ flex:1, background:thresh===String(v)?"rgba(200,184,96,.15)":"transparent", border:`1px solid ${thresh===String(v)?"var(--warning)":"var(--border)"}`, borderRadius:8, padding:"8px 0", color:thresh===String(v)?"var(--warning)":"var(--text3)", fontSize:".68rem", fontWeight:700, cursor:"pointer" }}>
                  {v} €
                </button>
              ))}
            </div>
          </div>
        )}
      </Sheet>

      {/* 🏷️ Gestion catégories */}
      <Sheet open={openSheet==="categories"} onClose={close} title="🏷️ Catégories">
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:10 }}>
          {[["all","Toutes"],["expense","Dépenses"],["income","Revenus"]].map(([k,l])=>(
            <div key={k} className={`filter-chip${catFilter===k?" active":""}`} onClick={()=>setCatFilter(k)}>{l}</div>
          ))}
          <button onClick={onNewCat} style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4, background:"var(--accent)", border:"none", borderRadius:20, padding:"6px 14px", color:"var(--bg)", fontWeight:800, fontSize:".7rem", cursor:"pointer", flexShrink:0, touchAction:"manipulation" }}>
            ＋ Créer
          </button>
        </div>
        <div className="cat-grid">
          {filtered.length === 0
            ? <EmptyIllustration type="transactions" title="Aucune catégorie" sub="Crée des catégories pour organiser tes dépenses" ctaColor="var(--accent)" style={{ gridColumn:"1/-1" }} />
            : filtered.map(c => {
                const usage    = catUsage[c.id] || 0;
                const linkedTo = data.categories.find(x => x.id === c.linkedToId);
                return (
                  <div key={c.id} className="cat-card-opt" onClick={() => onEditCat(c.id)}>
                    <div style={{ position:"absolute", top:5, left:5, width:6, height:6, borderRadius:"50%", background:c.type==="expense"?"var(--danger)":"var(--success)" }} />
                    <div style={{ position:"absolute", top:4, right:4, fontSize:".48rem", fontWeight:800, lineHeight:1, color:usage===0?"var(--danger)":"var(--text3)", background:usage===0?"var(--danger-glow)":"var(--surface3)", padding:"2px 4px", borderRadius:4 }}>
                      {usage===0?"✕":usage}
                    </div>
                    <span style={{ fontSize:"1.05rem", lineHeight:1, marginTop:6 }}>{c.icon}</span>
                    <span style={{ fontSize:".6rem", fontWeight:700, wordBreak:"break-word", whiteSpace:"normal", textAlign:"center", lineHeight:1.3, width:"100%", padding:"0 3px" }}>{c.name}</span>
                    {linkedTo && <span style={{ fontSize:".46rem", color:"var(--success)", background:"rgba(104,212,152,.1)", padding:"1px 4px", borderRadius:3, fontWeight:700, lineHeight:1.6 }}>🔗</span>}
                    <button className="btn-action btn-del" style={{ fontSize:".68rem", padding:"2px 6px", marginTop:2, lineHeight:1.4, minWidth:24, minHeight:24 }}
                      onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();e.preventDefault();onDeleteCat(c.id);}} onClick={e=>e.stopPropagation()}>✕</button>
                  </div>
                );
              })
          }
        </div>
      </Sheet>

      {/* 🔗 Liaisons */}
      <Sheet open={openSheet==="links"} onClose={close} title="🔗 Liaisons de catégories">
        <div style={{ fontSize:".65rem", color:"var(--text3)", lineHeight:1.5, marginBottom:12 }}>
          Lie une catégorie de remboursement à une catégorie de dépense pour calculer les coûts nets.
        </div>
        {data.categories.filter(c=>c.linkedToId).map(c => {
          const target = data.categories.find(x=>x.id===c.linkedToId);
          if (!target) return null;
          return (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", background:"rgba(104,212,152,.06)", border:"1px solid rgba(104,212,152,.2)", borderRadius:8, marginBottom:6 }}>
              <span style={{ fontSize:".85rem" }}>{c.icon}</span>
              <span style={{ fontSize:".72rem", fontWeight:700, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
              <span style={{ fontSize:".7rem", color:"var(--text3)", flexShrink:0 }}>→</span>
              <span style={{ fontSize:".85rem" }}>{target.icon}</span>
              <span style={{ fontSize:".72rem", fontWeight:700, color:"var(--success)", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{target.name}</span>
              <button onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();e.preventDefault();onEditCat({id:c.id,linkedToId:null});}} onClick={()=>onEditCat({id:c.id,linkedToId:null})}
                style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:6, padding:"6px 10px", color:"var(--text3)", fontSize:".75rem", cursor:"pointer", minHeight:32, touchAction:"manipulation" }}>✕</button>
            </div>
          );
        })}
        {data.categories.filter(c=>c.linkedToId).length===0 && (
          <div style={{ fontSize:".65rem", color:"var(--text3)", fontStyle:"italic", textAlign:"center", padding:"8px 0 12px" }}>Aucune liaison définie</div>
        )}
        <LinkForm categories={data.categories} onLink={onEditCat} />
      </Sheet>

      {/* 🔄 Récurrentes */}
      <Sheet open={openSheet==="recurring"} onClose={close} title="🔄 Récurrentes">
        {(data.recurringTemplates||[]).length === 0 ? (
          <div style={{ textAlign:"center", padding:"20px 0", color:"var(--text3)", fontSize:".75rem" }}>Aucun modèle récurrent</div>
        ) : (data.recurringTemplates||[]).map(tpl => {
          const cat  = data.categories.find(c=>c.id===tpl.categoryId);
          const isInc = isIncome(tpl.type);
          const done  = (data.transactions||[]).filter(t=>t.templateId===tpl.id).length;
          return (
            <div key={tpl.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, marginBottom:6 }}>
              <div style={{ width:32, height:32, borderRadius:9, background:"var(--surface2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"1rem" }}>
                {cat?.icon ?? (isInc?"💰":"💸")}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:".74rem", fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{tpl.label}</div>
                <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>
                  {cat?.name ?? "—"} · <span style={{ color:"var(--accent)" }}>{tpl.frequency==="yearly"?"Annuelle":"Mensuelle"}</span>
                  {tpl.occurrences!=null && <span> · {done}/{tpl.occurrences} fois</span>}
                </div>
              </div>
              <div style={{ fontFamily:"var(--mono)", fontWeight:800, color:isInc?"var(--success)":"var(--danger)", fontSize:".78rem", flexShrink:0 }}>{fmt(tpl.amount)}</div>
              <button onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();e.preventDefault();onDeleteRecurring?.(tpl.id);}} onClick={()=>onDeleteRecurring?.(tpl.id)}
                style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:7, padding:"5px 8px", color:"var(--text3)", fontSize:".72rem", cursor:"pointer", minHeight:28, touchAction:"manipulation" }}>✕</button>
            </div>
          );
        })}
      </Sheet>

      {/* 💾 Sauvegarde */}
      <Sheet open={openSheet==="backup"} onClose={close} title="💾 Sauvegarde">
        {/* Dernière sauvegarde */}
        <div style={{ background:"var(--surface)", border:`1.5px solid ${backupOk?"rgba(104,212,152,.3)":last?"rgba(200,184,96,.3)":"rgba(200,112,112,.3)"}`, borderLeft:`3px solid ${backupOk?"var(--success)":last?"var(--warning)":"var(--danger)"}`, borderRadius:12, padding:14, marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div>
              <div style={{ fontSize:".65rem", fontWeight:800, color:backupOk?"var(--success)":last?"var(--warning)":"var(--danger)" }}>
                {!last?"⚠️ Aucune sauvegarde":backupOk?`✅ il y a ${daysSinceBackup} jour${daysSinceBackup>1?"s":""}`:`⚠️ il y a ${daysSinceBackup} jours`}
              </div>
              {last && <div style={{ fontFamily:"var(--mono)", fontSize:".82rem", fontWeight:800, marginTop:4 }}>{new Date(last.date).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})} à {last.date.slice(11,16)}</div>}
            </div>
            {last && <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:".72rem", fontWeight:800, color:"var(--accent)" }}>{last.sizeKo} ko</div>
              <div style={{ fontSize:".58rem", color:"var(--text3)", marginTop:1 }}>{last.txCount} transactions</div>
            </div>}
          </div>
          <button className="btn btn-primary" style={{ width:"100%" }} onClick={onExport}>💾 Sauvegarder maintenant</button>
        </div>
        {/* Historique */}
        {(data.backupHistory||[]).length > 0 && (
          <div>
            <button onClick={()=>setShowBackupHist(h=>!h)} style={{ width:"100%", background:"transparent", border:"1px solid var(--border)", borderRadius:8, padding:"9px 12px", color:"var(--text3)", fontSize:".68rem", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6, touchAction:"manipulation" }}>
              <span>📋 Historique ({(data.backupHistory||[]).length})</span>
              <span style={{ transform:showBackupHist?"rotate(90deg)":"none", transition:"transform .2s" }}>›</span>
            </button>
            {showBackupHist && (
              <div style={{ borderRadius:8, overflow:"hidden", border:"1px solid var(--border)" }}>
                {(data.backupHistory||[]).map((b,i) => (
                  <div key={b.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", borderBottom:i<(data.backupHistory||[]).length-1?"1px solid var(--border-soft)":"none" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <span style={{ fontSize:".7rem", fontWeight:700 }}>{new Date(b.date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} à {b.date.slice(11,16)}</span>
                        {i===0 && <span style={{ fontSize:".48rem", background:"rgba(104,212,152,.12)", color:"var(--success)", padding:"1px 5px", borderRadius:6, fontWeight:800 }}>DERNIER</span>}
                      </div>
                      <div style={{ fontSize:".58rem", color:"var(--text3)", marginTop:1 }}>{b.txCount} transactions · {b.sizeKo} ko</div>
                    </div>
                    <button onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();e.preventDefault();onExport();}} onClick={onExport}
                      style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:7, padding:"5px 10px", color:"var(--accent)", fontSize:".7rem", cursor:"pointer", minHeight:32, touchAction:"manipulation" }}>📥</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
