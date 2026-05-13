import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ItemRow, Delta, Sparkline } from "./components/index.jsx";
import { ChartSVG, PatrimoineSVG } from "./components/charts.jsx";
import { fmt, currentYM, getPrevMonth, isIncome, PALETTE, MONTHS_SHORT, APP_NAME, APP_VERSION, txLabel, txTypeClass, txSign } from "./utils.js";
import {
  useBalance, useMonthStats, useYearMonths, useYearTotals,
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
    <div
      className="section-title"
      style={{
        fontFamily: "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif",
        fontWeight: 800,
        fontSize: ".8rem",
        letterSpacing: ".07em",
        textTransform: "uppercase",
        color: "var(--text1)",
        ...style,
      }}
    >
      {children}
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
function SmartIndicator({ balance, curMonthInc, curMonthExp, lastBackupDate, onSwitchTab }) {
  const [open, setOpen] = useState(false);

  const daysSinceBackup = lastBackupDate
    ? (Date.now() - new Date(lastBackupDate)) / 86400000
    : 999;

  // Priorité : problème le plus urgent en premier
  const status = useMemo(() => {
    if (balance < 0)
      return { color: "#ef4444", glow: "rgba(239,68,68,.5)",   label: "🔴 Solde négatif",              sub: `${fmt(balance)} — revoir les dépenses` };
    if (balance < 100)
      return { color: "#ef4444", glow: "rgba(239,68,68,.4)",   label: "🔴 Solde critique",              sub: `Moins de 100 € restants` };
    if (daysSinceBackup > 14)
      return { color: "#ef4444", glow: "rgba(239,68,68,.35)",  label: "🔴 Sauvegarde urgente",          sub: `${Math.floor(daysSinceBackup)} jours sans backup`, action: "options" };
    if (curMonthExp > curMonthInc && curMonthInc > 0)
      return { color: "#fbbf24", glow: "rgba(251,191,36,.5)",  label: "🟡 Dépenses > revenus",          sub: `Ce mois : −${fmt(curMonthExp - curMonthInc)}` };
    if (balance < 500)
      return { color: "#fbbf24", glow: "rgba(251,191,36,.4)",  label: "🟡 Solde faible",                sub: `Moins de 500 € — sois vigilant` };
    if (daysSinceBackup > 7)
      return { color: "#fbbf24", glow: "rgba(251,191,36,.35)", label: "🟡 Sauvegarde recommandée",      sub: `${Math.floor(daysSinceBackup)} jours sans backup`, action: "options" };
    return   { color: "#4ade80", glow: "rgba(74,222,128,.5)",  label: "🟢 Tout va bien",               sub: `Budget équilibré, solde sain` };
  }, [balance, curMonthInc, curMonthExp, daysSinceBackup]);

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
export function AccueilView({ data, onShowDetail, onShowMonthDetail, onEditTrans, onDeleteTrans, onSwitchTab, onSaveProvisional, onDeleteProvisional, onGoToHistorique }) {
  const { transactions, cagnottes, fixedExpenses } = data;
  const provisionalExpenses = data.provisionalExpenses || [];
  const curM      = currentYM();
  const prevM     = getPrevMonth(curM);
  const curY      = new Date().getFullYear().toString();

  const balance   = useBalance(transactions, fixedExpenses);
  const curMonth  = useMonthStats(transactions, fixedExpenses, curM);
  const prevMonth = useMonthStats(transactions, fixedExpenses, prevM);
  const tf        = useTotalFixes(fixedExpenses);

  // ── Rapprochement bancaire ────────────────────────────────────
  const { soldePointe, soldeAttente, nbPointed, totalPointable } = useMemo(() => {
    let ptInc = 0, ptExp = 0, noPtInc = 0, noPtExp = 0;
    transactions.filter(t => isPointable(t.type)).forEach(t => {
      const a = parseFloat(t.amount) || 0;
      const isInc = isIncome(t.type);
      if (t.pointed) { if (isInc) ptInc += a; else ptExp += a; }
      else           { if (isInc) noPtInc += a; else noPtExp += a; }
    });
    fixedExpenses.forEach(f => {
      const a = f.amount || 0;
      const isPointed = !!f.pointedMonths?.[curM];
      if (isPointed) ptExp   += a;
      else           noPtExp += a;
    });
    const pointableTxs = transactions.filter(t => isPointable(t.type));
    const nbPt  = pointableTxs.filter(t => t.pointed).length + fixedExpenses.filter(f => f.pointedMonths?.[curM]).length;
    const total = pointableTxs.length + fixedExpenses.length;
    return {
      soldePointe:    ptInc  - ptExp,
      soldeAttente:   noPtInc - noPtExp,
      nbPointed:      nbPt,
      totalPointable: total,
    };
  }, [transactions, fixedExpenses]);

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
  const provTotal = useMemo(() => provisionalExpenses.reduce((s,p) => s + (p.amount || 0), 0), [provisionalExpenses]);
  const balanceAfterProv = balance - provTotal;
  const recent   = useMemo(() =>
    [...transactions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5),
    [transactions]
  );
  const curYearNum = new Date().getFullYear();
  const months     = useYearMonths(transactions, fixedExpenses, curYearNum);
  const showBackup = !data.lastBackupDate ||
    (Date.now() - new Date(data.lastBackupDate)) / 86400000 > 7;

  // ── Couleur dynamique du solde ────────────────────────────────
  // Blanc par défaut, jaune sous 100 €, rouge en négatif
  const balanceColor = balance < 0 ? "#ef4444" : balance < 100 ? "#fbbf24" : "#ffffff";
  const afterProvColor = balanceAfterProv < 0 ? "#ef4444" : balanceAfterProv < 100 ? "#fbbf24" : "rgba(255,255,255,.75)";

  return (
    <div>
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
        />

        <div style={{ position: "relative" }}>
          <div className="hero-label" style={{ color: "rgba(255,255,255,.72)", fontWeight: 700 }}>
            Solde Bancaire Estimé
          </div>
          <div className="hero-value" style={{ color: balanceColor }}>
            <CountUp target={balance} color={balanceColor} duration={1000} />
          </div>
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
        </div>
      </div>

      {/* ── 🐷 Cagnottes + 📌 Fixes ── */}
      <div className="grid-2">
        <div className="stat-mini dash-cagnotte" onClick={() => onShowDetail("cagnottes", "all")}>
          <div className="stat-label">🐷 Cagnottes</div>
          <div className="stat-val" style={{ color: "var(--purple)" }}>{fmt(cagTotal)}</div>
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-fixe">
          <div className="stat-label">📌 Fixes / mois</div>
          <div className="stat-val" style={{ color: "var(--warning)" }}>{fmt(tf)}</div>
        </div>
      </div>

      <SectionTitle>🗓️ Mois en cours</SectionTitle>
      <div className="grid-2">
        <div className="stat-mini dash-revenu" onClick={() => onShowDetail("income", "month")}>
          <div className="stat-label">💰 Revenus</div>
          <div className="stat-val type-income">{fmt(curMonth.inc)}</div>
          <Delta cur={curMonth.inc} prev={prevMonth.inc} />
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-depense" onClick={() => onShowDetail("expense", "month")}>
          <div className="stat-label">💸 Dépenses</div>
          <div className="stat-val type-expense">{fmt(curMonth.exp)}</div>
          <Delta cur={curMonth.exp} prev={prevMonth.exp} inverted />
          <span className="stat-arrow">›</span>
        </div>

        {/* Option B — Épargne + Retraits sur une carte */}
        <div className="stat-mini" style={{ borderLeft: "3px solid var(--purple)" }}>
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

        <div className="stat-mini dash-dep-var" onClick={() => onShowDetail("expense_var", "month")}>
          <div className="stat-label">📊 Dép. variables</div>
          <div className="stat-val" style={{ color: "var(--accent)" }}>{fmt(curMonth.expVar)}</div>
          <Delta cur={curMonth.expVar} prev={prevMonth.expVar} inverted />
          <span className="stat-arrow">›</span>
        </div>
      </div>

      <SectionTitle>📅 Année en cours</SectionTitle>
      <div className="grid-2">
        <div className="stat-mini dash-revenu" onClick={() => onShowDetail("income", "year")}>
          <div className="stat-label">💰 Revenus</div>
          <div className="stat-val type-income">{fmt(yInc)}</div>
          <Delta cur={yInc} prev={pyStats.inc} />
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-depense" onClick={() => onShowDetail("expense", "year")}>
          <div className="stat-label">💸 Dépenses</div>
          <div className="stat-val type-expense">{fmt(yExp)}</div>
          <Delta cur={yExp} prev={pyStats.exp} inverted />
          <span className="stat-arrow">›</span>
        </div>

        {/* Option B — Épargne + Retraits année */}
        <div className="stat-mini" style={{ borderLeft: "3px solid var(--purple)" }}>
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

        <div className="stat-mini dash-dep-var" onClick={() => onShowDetail("expense_var", "year")}>
          <div className="stat-label">📊 Dép. variables</div>
          <div className="stat-val" style={{ color: "var(--accent)" }}>{fmt(yExpVar)}</div>
          <Delta cur={yExpVar} prev={pyStats.expVar} inverted />
          <span className="stat-arrow">›</span>
        </div>
      </div>

      <SectionTitle>📊 Flux mensuels {curY}</SectionTitle>
      <div className="card" style={{ padding: 14 }}>
        <ChartSVG months={months} chartFilter="all"
          onMonthClick={i => onShowMonthDetail?.(curYearNum, i)} />
        <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: "var(--success)" }}>■ Revenus</span>
          <span style={{ color: "var(--danger)"  }}>■ Dépenses</span>
          <span style={{ color: "var(--accent)"  }}>— Solde net</span>
        </div>
      </div>

      <SectionTitle>5 Dernières opérations</SectionTitle>
      <div className="card" style={{ padding: "0 16px" }}>
        {recent.length === 0
          ? <EmptyIllustration type="operations" title="Aucune opération" sub="Ajoute un revenu ou une dépense pour commencer" />
          : recent.map(t => (
              <ItemRow key={t.id} t={t}
                categories={data.categories} cagnottes={cagnottes}
                onEdit={onEditTrans} onDelete={onDeleteTrans} />
            ))
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  CAGNOTTES
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
                      <div className="progress-bg"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                      <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 4, fontWeight: 700 }}>{pct.toFixed(0)}%</div>
                    </>
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
function PointRow({ item, onToggle, isFixed = false, onEditFixed }) {
  const [editing,     setEditing]     = useState(false);
  const [draftName,   setDraftName]   = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const isInc = item.type === "income" || item.type === "dissolution_cagnotte";

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
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
        borderBottom: editing ? "none" : "1px solid var(--border-soft)",
        background: item.pointed ? "rgba(104,212,152,.04)" : "transparent",
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  HISTORIQUE
// ─────────────────────────────────────────────────────────────────
export function HistoriqueView({ data, onEditTrans, onDeleteTrans, onTogglePointTx, onTogglePointFix, onOverrideFixMonth, initPointFilter = "all", onClearPointFilter }) {
  const now = new Date();
  const [year,     setYear]     = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [sort,     setSort]     = useState("date");
  const [catId,    setCatId]    = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [minAmt,   setMinAmt]   = useState("");
  const [maxAmt,   setMaxAmt]   = useState("");
  const [showAmtFilter, setShowAmtFilter] = useState(false);

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

  const { transactions, categories, cagnottes, fixedExpenses } = data;
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
    let list = transactions.filter(t => t.date.startsWith(month));
    if (filter !== "all") list = list.filter(t => {
      if (filter === "income")  return isIncome(t.type);
      if (filter === "expense") return t.type === "expense";
      if (filter === "savings") return ["epargne","decagnottage","transfer"].includes(t.type);
      return true;
    });
    if (catId)  list = list.filter(t => t.categoryId === catId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        return (t.note||"").toLowerCase().includes(q) || (cat?.name||"").toLowerCase().includes(q);
      });
    }
    if (minAmt) list = list.filter(t => parseFloat(t.amount) >= parseFloat(minAmt));
    if (maxAmt) list = list.filter(t => parseFloat(t.amount) <= parseFloat(maxAmt));
    // Filtre pointage — exclut decagnottage et transfer (mouvements internes)
    if (pointFilter === "pointed")   list = list.filter(t => isPointable(t.type) &&  t.pointed);
    if (pointFilter === "unpointed") list = list.filter(t => isPointable(t.type) && !t.pointed);
    if (sort === "date")  list.sort((a,b) => new Date(b.date) - new Date(a.date));
    if (sort === "amt_d") list.sort((a,b) => parseFloat(b.amount) - parseFloat(a.amount));
    if (sort === "amt_a") list.sort((a,b) => parseFloat(a.amount) - parseFloat(b.amount));
    return list;
  }, [transactions, categories, month, filter, catId, search, sort, minAmt, maxAmt, pointFilter]);

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

      {/* ── Filtres ── */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="hist-search-wrap">
          <span className="hist-search-icon">🔍</span>
          <input className="hist-search" type="text" placeholder="Rechercher…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-row">
          {[["all","Tout"],["income","Revenus"],["expense","Dépenses"],["savings","Cagnottes"]].map(([k,l]) => (
            <div key={k} className={`filter-chip${filter===k?" active":""}`}
              onClick={() => { setFilter(k); setCatId(""); }}>{l}</div>
          ))}
        </div>

        {/* ── Filtre pointage ── */}
        <div className="filter-row" style={{ marginBottom: 6 }}>
          {[
            ["all",      "Toutes",       ""],
            ["pointed",  "✓ Pointées",   "var(--success)"],
            ["unpointed","⏳ En attente", "var(--warning)"],
          ].map(([k, l, col]) => (
            <div key={k}
              className={`filter-chip${pointFilter===k?" active":""}`}
              style={{ color: pointFilter===k && col ? col : undefined }}
              onClick={() => { setPointFilter(k); onClearPointFilter?.(); }}>
              {l}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontSize: ".6rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>Tri :</span>
          {[["date","Date ↓"],["amt_d","Montant ↓"],["amt_a","Montant ↑"]].map(([k,l]) => (
            <span key={k} className={`sort-chip${sort===k?" active":""}`} onClick={() => setSort(k)}>{l}</span>
          ))}
          <span className={`sort-chip${showAmtFilter?" active":""}`} onClick={() => setShowAmtFilter(s => !s)} style={{ marginLeft: "auto" }}>
            💶 {(minAmt||maxAmt) ? "Montant ✦" : "Montant"}
          </span>
        </div>
        {showAmtFilter && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
            {[["Min (€)", minAmt, setMinAmt],["Max (€)", maxAmt, setMaxAmt]].map(([label, val, setter]) => (
              <div key={label}>
                <div style={{ fontSize: ".58rem", color: "var(--text3)", marginBottom: 3 }}>{label}</div>
                <input type="number" value={val} min="0" step="10"
                  onChange={e => setter(e.target.value)}
                  style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 8px", color: "var(--text)", fontSize: ".75rem", fontFamily: "var(--mono)", boxSizing: "border-box" }}/>
              </div>
            ))}
            {(minAmt||maxAmt) && (
              <button onClick={() => { setMinAmt(""); setMaxAmt(""); }}
                style={{ gridColumn: "span 2", background: "transparent", border: "1px solid var(--border)", borderRadius: 7, padding: "5px", color: "var(--text3)", fontSize: ".65rem", cursor: "pointer" }}>
                ✕ Effacer le filtre montant
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Toggle Liste / Catégories ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        {[["list","📋 Liste"],["cats","📊 Catégories"]].map(([k,l]) => (
          <button key={k} onClick={() => setViewMode(k)} style={{
            background: viewMode===k ? "var(--accent-glow)" : "transparent",
            border: `1.5px solid ${viewMode===k ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)", padding: "9px 0",
            color: viewMode===k ? "var(--accent)" : "var(--text2)",
            fontWeight: 700, fontSize: ".72rem", cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>

      {/* ── 6. Vue Catégories ── */}
      {viewMode === "cats" && (
        <CatBreakdown txs={filtered} categories={categories}
          onSelectCat={id => { setCatId(id); setFilter("expense"); setViewMode("list"); }} />
      )}

      {/* Filtre catégorie actif */}
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
                            onTogglePoint={onTogglePointTx} />
                        ))
                      : dayTxs.map(t => (
                          <PointRow key={t.id}
                            item={{ ...t, name: txLabel(t, categories, cagnottes), cat: categories.find(c => c.id === t.categoryId) }}
                            onToggle={onTogglePointTx} />
                        ))
                    }
                  </div>
                );
              })}
            </div>
          )
      )}

      {/* ── Section frais fixes ── */}
      {viewMode === "list" && monthFixes.length > 0 && pointFilter !== "pointed" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
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
function SwipeRow({ t, categories, cagnottes, onEdit, onDelete, onTogglePoint }) {
  const [offset,   setOffset]   = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startX  = useRef(null);
  const startY  = useRef(null);
  const isHoriz = useRef(false); // vrai si le geste est horizontal
  const cat    = categories.find(c => c.id === t.categoryId);
  const { label, cls, sign } = (() => {
    const l = txLabel(t, categories, cagnottes);
    return { label: l, cls: txTypeClass(t.type), sign: txSign(t.type) };
  })();
  const icon = cat?.icon ?? (t.type === "dissolution_cagnotte" ? "🏦" : t.type === "epargne" ? "🐷" : t.type === "decagnottage" ? "↩️" : "💸");

  return (
    <div style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--border-soft)" }}>
      {/* Actions cachées */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 110, display: "flex" }}>
        <div onClick={() => { setOffset(0); setRevealed(false); onEdit?.(t.id); }}
          style={{ width: 55, height: "100%", background: "rgba(112,184,224,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", cursor: "pointer" }}>✏️</div>
        <div onClick={() => { setOffset(0); setRevealed(false); onDelete?.(t.id); }}
          style={{ width: 55, height: "100%", background: "rgba(200,112,112,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", cursor: "pointer" }}>🗑️</div>
      </div>
      {/* Ligne */}
      <div
        onTouchStart={e => {
          startX.current  = e.touches[0].clientX;
          startY.current  = e.touches[0].clientY;
          isHoriz.current = false; // réinitialise à chaque toucher
        }}
        onTouchMove={e => {
          const dx = e.touches[0].clientX - startX.current;
          const dy = e.touches[0].clientY - startY.current;

          // Détermine la direction dominante au premier mouvement significatif
          if (!isHoriz.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
            isHoriz.current = Math.abs(dx) > Math.abs(dy);
          }

          // Ne déplace que si le geste est majoritairement horizontal
          if (!isHoriz.current) return;

          if (dx < 0) setOffset(Math.max(-110, dx));
          else if (revealed) setOffset(Math.min(0, -110 + dx));
        }}
        onTouchEnd={() => {
          if (!isHoriz.current) return; // scroll vertical : rien à faire
          if (offset < -55) { setOffset(-110); setRevealed(true); }
          else { setOffset(0); setRevealed(false); }
        }}
        onClick={() => { if (revealed) { setOffset(0); setRevealed(false); } }}
        style={{
          transform: `translateX(${offset}px)`,
          transition: (offset === 0 || offset === -110) ? "transform .2s" : "none",
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
          <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 1 }}>{cat?.name ?? "—"} · {t.date.slice(8)}/{t.date.slice(5,7)}</div>
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
function CatBreakdown({ txs, categories, onSelectCat }) {
  const bycat = {};
  const totalExp = txs.filter(t => t.type === "expense").reduce((s, t) => s + (parseFloat(t.amount)||0), 0) || 1;
  txs.filter(t => t.type === "expense").forEach(t => {
    const c   = categories.find(c => c.id === t.categoryId);
    const key = c?.id || "__other__";
    if (!bycat[key]) bycat[key] = { id: c?.id || null, name: c?.name||"Sans catégorie", icon: c?.icon||"❓", color: c?.color||"var(--text3)", total: 0, count: 0 };
    bycat[key].total += parseFloat(t.amount)||0;
    bycat[key].count++;
  });
  const sorted = Object.values(bycat).sort((a,b) => b.total - a.total);
  if (sorted.length === 0) return (
    <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text3)", fontSize: ".75rem" }}>Aucune dépense ce mois</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.map(c => (
        <div key={c.name}
          onClick={() => c.id && onSelectCat?.(c.id)}
          style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderLeft: `3px solid ${c.color}`, borderRadius: "var(--radius-sm)",
            padding: "10px 12px", cursor: c.id ? "pointer" : "default",
            position: "relative",
          }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
            <span style={{ fontSize: ".75rem", fontWeight: 700 }}>{c.icon} {c.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: c.color, fontSize: ".78rem", fontVariantNumeric: "tabular-nums" }}>{fmt(c.total)}</span>
              <span style={{ fontSize: ".58rem", color: "var(--text3)" }}>{c.count} op.</span>
              {c.id && <span style={{ color: "var(--text3)", fontSize: ".75rem" }}>›</span>}
            </div>
          </div>
          <div style={{ height: 5, background: "var(--surface3)", borderRadius: 99 }}>
            <div style={{ width: `${(c.total / totalExp * 100).toFixed(0)}%`, height: "100%", background: c.color, borderRadius: 99 }}/>
          </div>
          <div style={{ fontSize: ".55rem", color: "var(--text3)", marginTop: 2, textAlign: "right" }}>{(c.total / totalExp * 100).toFixed(0)}% des dépenses</div>
        </div>
      ))}
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
export function RapportView({ data, currentYear, setCurrentYear, onShowMonthDetail, monthNotes = {}, onSaveMonthNote }) {
  const { transactions, categories, fixedExpenses } = data;
  const months  = useYearMonths(transactions, fixedExpenses, currentYear);
  const yearly  = useYearTotals(transactions, fixedExpenses, currentYear);
  const prevY   = useYearTotals(transactions, fixedExpenses, currentYear - 1);
  const [chartFilter, setChartFilter] = useState("all");
  const [savGoal,     setSavGoal]     = useState(0);
  const [editGoal,    setEditGoal]    = useState(false);
  const [goalInput,   setGoalInput]   = useState("");

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
    const map   = {};
    if (isCur && tf > 0) map["__fixes__"] = tf;
    transactions
      .filter(t => t.date.startsWith(currentYear.toString()) && t.type === "expense")
      .forEach(t => {
        const k = t.categoryId || "__other__";
        map[k] = (map[k] || 0) + (parseFloat(t.amount) || 0);
      });
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total   = Object.values(map).reduce((s, v) => s + v, 0) || 1;
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
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button className="year-nav-btn" onClick={() => setCurrentYear(y => y - 1)}>◀</button>
        <span style={{ fontFamily: "var(--display)", fontSize: "1.3rem", fontWeight: 800 }}>{currentYear}</span>
        <button className="year-nav-btn" onClick={() => setCurrentYear(y => y + 1)}>▶</button>
      </div>

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

      {/* Top 5 dépenses */}
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

      {/* Évolution solde net */}
      <SectionTitle>Évolution du solde net</SectionTitle>
      <div className="card" style={{ padding: 14 }}>
        <PatrimoineSVG months={months} />
        <div style={{ display: "flex", gap: 12, fontSize: ".58rem", color: "var(--text3)", marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ color: "var(--success)" }}>■ Positif</span>
          <span style={{ color: "var(--danger)"  }}>■ Négatif</span>
        </div>
      </div>

      {/* Comparaison annuelle */}
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
      <PeriodCompare transactions={data.transactions} fixedExpenses={data.fixedExpenses} />
      <MonthNotes currentYear={currentYear} monthNotes={monthNotes} onSave={onSaveMonthNote} />
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
export function OptionsView({ data, onEditCat, onDeleteCat, onNewCat, onExport, onImport, onReset }) {
  const [catFilter, setCatFilter] = useState("all");
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

  return (
    <div>

      {/* ⑦ Stats globales */}
      {globalStats && (
        <div style={{
          background: "linear-gradient(135deg, #0c1830 0%, #182a48 100%)",
          borderRadius: "var(--radius)", padding: "14px 16px", marginBottom: 14,
          boxShadow: "0 4px 18px rgba(112,184,224,.12)",
        }}>
          <div style={{ fontSize: ".58rem", color: "rgba(255,255,255,.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 10 }}>
            📊 Statistiques globales
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { icon: "📋", label: "Transactions",       value: globalStats.count },
              { icon: "📅", label: "Première opération", value: new Date(globalStats.earliest + "T12:00:00").toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) },
              { icon: "💶", label: "Total géré",         value: fmt(globalStats.totalGere) },
              { icon: "🏷️", label: "Catégories",         value: data.categories.length },
            ].map(s => (
              <div key={s.label} style={{ background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: ".58rem", color: "rgba(255,255,255,.45)", marginBottom: 4 }}>{s.icon} {s.label}</div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "#fff", fontSize: ".85rem", fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⑧ Sauvegarde avec date visible */}
      <div className="card" style={{
        borderLeft: `3px solid ${backupOk ? "var(--success)" : "var(--danger)"}`,
        background: backupOk ? "var(--success-glow)" : "var(--danger-glow)",
        marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
            background: backupOk ? "var(--success)" : "var(--danger)",
            boxShadow: `0 0 8px ${backupOk ? "rgba(104,212,152,.6)" : "rgba(200,112,112,.6)"}`,
          }}/>
          <div>
            <div style={{ fontSize: ".72rem", fontWeight: 700, color: backupOk ? "var(--success)" : "var(--danger)" }}>
              {daysSinceBackup === null
                ? "⚠️ Aucune sauvegarde enregistrée"
                : backupOk
                  ? `✅ Sauvegardé il y a ${daysSinceBackup} jour${daysSinceBackup > 1 ? "s" : ""}`
                  : `⚠️ Dernière sauvegarde il y a ${daysSinceBackup} jours`
              }
            </div>
            {data.lastBackupDate && (
              <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 2 }}>{data.lastBackupDate}</div>
            )}
          </div>
        </div>
        <div className="grid-2">
          <button className="btn btn-primary" onClick={onExport}>⬇ Exporter JSON</button>
          <button className="btn btn-outline"  onClick={onImport}>⬆ Importer JSON</button>
        </div>
      </div>

      {/* ⑩ Catégories avec compteur d'usage — layout grille conservé */}
      <SectionTitle>Gestion Catégories</SectionTitle>
      <div className="filter-row">
        {[["all","Toutes"],["expense","Dépenses"],["income","Revenus"]].map(([k,l]) => (
          <div key={k} className={`filter-chip${catFilter===k?" active":""}`} onClick={() => setCatFilter(k)}>{l}</div>
        ))}
      </div>
      <div className="cat-grid">
        {filtered.length === 0
          ? <EmptyIllustration type="transactions" title="Aucune catégorie" sub="Crée des catégories pour organiser tes dépenses" ctaColor="var(--accent)" style={{ gridColumn:"1/-1" }} />
          : filtered.map(c => {
              const usage = catUsage[c.id] || 0;
              return (
                <div key={c.id} className="cat-card-opt" onClick={() => onEditCat(c.id)}>
                  {/* Point couleur type */}
                  <div style={{ position:"absolute", top:5, left:5, width:6, height:6, borderRadius:"50%",
                    background: c.type==="expense" ? "var(--danger)" : "var(--success)" }} />
                  {/* Badge usage */}
                  <div style={{
                    position:"absolute", top:4, right:4,
                    fontSize:".48rem", fontWeight:800, lineHeight:1,
                    color: usage === 0 ? "var(--danger)" : "var(--text3)",
                    background: usage === 0 ? "var(--danger-glow)" : "var(--surface3)",
                    padding:"2px 4px", borderRadius:4,
                  }}>
                    {usage === 0 ? "✕" : usage}
                  </div>
                  <span style={{ fontSize:"1.05rem", lineHeight:1, marginTop:6 }}>{c.icon}</span>
                  <span style={{ fontSize:".6rem", fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"100%", padding:"0 2px" }}>{c.name}</span>
                  <button className="btn-action btn-del" style={{ fontSize:".68rem", padding:"1px 4px", marginTop:2, lineHeight:1.4 }}
                    onClick={e => { e.stopPropagation(); onDeleteCat(c.id); }}>✕</button>
                </div>
              );
            })
        }
      </div>
      <button className="btn btn-outline" style={{ width:"100%", marginTop:10 }} onClick={onNewCat}>+ Créer une catégorie</button>

      <button className="btn btn-danger-outline" style={{ width:"100%", marginTop:20 }} onClick={onReset}>
        ⚠️ Réinitialiser toutes les données
      </button>

      {/* Version */}
      <div style={{ marginTop: 32, textAlign: "center", color: "var(--text3)", fontSize: ".65rem", letterSpacing: ".06em", fontWeight: 600 }}>
        {APP_NAME} — v{APP_VERSION}
      </div>
    </div>
  );
}
