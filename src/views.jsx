import { useState, useMemo, useEffect, useRef } from "react";
import { ItemRow, Delta, Sparkline } from "./components/index.jsx";
import { ChartSVG, PatrimoineSVG } from "./components/charts.jsx";
import { fmt, currentYM, getPrevMonth, isIncome, PALETTE, MONTHS_SHORT, APP_NAME, APP_VERSION } from "./utils.js";
import {
  useBalance, useMonthStats, useYearMonths, useYearTotals,
  usePriorYearStats, useTotalFixes,
} from "./hooks.js";

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
export function AccueilView({ data, onShowDetail, onShowMonthDetail, onEditTrans, onDeleteTrans, onSwitchTab, onSaveProvisional, onDeleteProvisional }) {
  const { transactions, cagnottes, fixedExpenses } = data;
  const provisionalExpenses = data.provisionalExpenses || [];
  const curM      = currentYM();
  const prevM     = getPrevMonth(curM);
  const curY      = new Date().getFullYear().toString();

  const balance   = useBalance(transactions, fixedExpenses);
  const curMonth  = useMonthStats(transactions, fixedExpenses, curM);
  const prevMonth = useMonthStats(transactions, fixedExpenses, prevM);
  const tf        = useTotalFixes(fixedExpenses);

  // Year stats (memoised)
  const { yInc, yExp, yExpVar, yDecag } = useMemo(() => {
    let yInc=0, yExp=0, yExpVar=0, yDecag=0;
    transactions.filter(t => t.date.startsWith(curY)).forEach(t => {
      const a = parseFloat(t.amount) || 0;
      if (isIncome(t.type))              { yInc += a; }
      else if (t.type === "expense")     { yExp += a; yExpVar += a; }
      else if (t.type === "decagnottage") yDecag += a;
    });
    yExp += tf;
    return { yInc, yExp, yExpVar, yDecag };
  }, [transactions, curY, tf]);

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
          background: "linear-gradient(135deg, #3a5520 0%, #507028 50%, #403a14 100%)",
          border: "none",
          boxShadow: "0 4px 24px rgba(168,200,64,.4)",
          overflow: "hidden",
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
          background: "radial-gradient(circle, rgba(168,220,80,.28) 0%, transparent 70%)",
          animation: "pulse-orb 3.5s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: -20, left: 10, width: 90, height: 90,
          borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(220,180,60,.2) 0%, transparent 70%)",
          animation: "pulse-orb 4.5s ease-in-out infinite reverse",
        }} />

        {/* Indicateur Smart */}
        <SmartIndicator
          balance={balance}
          curMonthInc={curMonth.inc}
          curMonthExp={curMonth.exp}
          lastBackupDate={data.lastBackupDate}
          onSwitchTab={onSwitchTab}
        />

        <div className="hero-label" style={{ color: "rgba(255,255,255,.72)", fontWeight: 700, position: "relative" }}>
          Solde Bancaire Estimé
        </div>
        <div className="hero-value" style={{ color: balanceColor, position: "relative" }}>
          <CountUp target={balance} color={balanceColor} duration={1000} />
        </div>
        {provTotal > 0 && (
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2, position: "relative" }}>
            <div style={{ fontSize: ".62rem", color: "rgba(255,255,255,.55)", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600 }}>
              Après {provisionalExpenses.length} prévision{provisionalExpenses.length > 1 ? "s" : ""}
            </div>
            <div style={{
              fontFamily: "var(--mono)", fontSize: "1.25rem", fontWeight: 700,
              color: afterProvColor, fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em",
            }}>
              <CountUp target={balanceAfterProv} color={afterProvColor} duration={1100} />
            </div>
          </div>
        )}
        <div style={{ position: "absolute", bottom: 14, right: 16, opacity: .45, pointerEvents: "none" }}>
          <Sparkline transactions={transactions} fixedExpenses={fixedExpenses} />
        </div>
      </div>

      {/* ── 🐷 Cagnottes + 📌 Fixes ── */}
      <div className="grid-2">
        <div className="stat-mini dash-cagnotte" onClick={() => onShowDetail("cagnottes", "all")}>
          <div className="stat-label">🐷 Cagnottes</div>
          <div className="stat-val" style={{ color: "var(--khaki)" }}>{fmt(cagTotal)}</div>
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-fixe">
          <div className="stat-label">📌 Fixes / mois</div>
          <div className="stat-val" style={{ color: "var(--accent2)" }}>{fmt(tf)}</div>
        </div>
      </div>

      <SectionTitle>🗓️ Mois en cours</SectionTitle>
      <div className="grid-2">
        <div className="stat-mini dash-revenu" onClick={() => onShowDetail("income", "month")}>
          <div className="stat-label">Revenus</div>
          <div className="stat-val type-income">{fmt(curMonth.inc)}</div>
          <Delta cur={curMonth.inc}    prev={prevMonth.inc}    />
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-depense" onClick={() => onShowDetail("expense", "month")}>
          <div className="stat-label">Dépenses</div>
          <div className="stat-val type-expense">{fmt(curMonth.exp)}</div>
          <Delta cur={curMonth.exp}    prev={prevMonth.exp}    />
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-decag" onClick={() => onShowDetail("decagnottage", "month")}>
          <div className="stat-label">Décagnottages</div>
          <div className="stat-val" style={{ color: "var(--sapin)" }}>{fmt(curMonth.decag)}</div>
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-dep-var" onClick={() => onShowDetail("expense_var", "month")}>
          <div className="stat-label">Dép. hors fixes</div>
          <div className="stat-val" style={{ color: "var(--warning)" }}>{fmt(curMonth.expVar)}</div>
          <Delta cur={curMonth.expVar} prev={prevMonth.expVar} />
          <span className="stat-arrow">›</span>
        </div>
      </div>

      <SectionTitle>📅 Année en cours</SectionTitle>
      <div className="grid-2">
        <div className="stat-mini dash-revenu" onClick={() => onShowDetail("income", "year")}>
          <div className="stat-label">Revenus</div>
          <div className="stat-val type-income">{fmt(yInc)}</div>
          <Delta cur={yInc}    prev={pyStats.inc}    />
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-depense" onClick={() => onShowDetail("expense", "year")}>
          <div className="stat-label">Dépenses</div>
          <div className="stat-val type-expense">{fmt(yExp)}</div>
          <Delta cur={yExp}    prev={pyStats.exp}    />
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-decag" onClick={() => onShowDetail("decagnottage", "year")}>
          <div className="stat-label">Décagnottages</div>
          <div className="stat-val" style={{ color: "var(--sapin)" }}>{fmt(yDecag)}</div>
          <Delta cur={yDecag}  prev={pyStats.decag}  />
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-dep-var" onClick={() => onShowDetail("expense_var", "year")}>
          <div className="stat-label">Dép. hors fixes</div>
          <div className="stat-val" style={{ color: "var(--warning)" }}>{fmt(yExpVar)}</div>
          <Delta cur={yExpVar} prev={pyStats.expVar} />
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
//  HISTORIQUE
// ─────────────────────────────────────────────────────────────────
export function HistoriqueView({ data, onEditTrans, onDeleteTrans }) {
  const [month,  setMonth]  = useState(() => currentYM());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort,   setSort]   = useState("date");
  const [catId,  setCatId]  = useState("");

  const { transactions, categories, cagnottes, fixedExpenses } = data;
  const tf      = useTotalFixes(fixedExpenses);
  const isCurM  = month === currentYM();
  const mStats  = useMonthStats(transactions, fixedExpenses, month);

  const usedCats = useMemo(() =>
    [...new Set(transactions.filter(t => t.date.startsWith(month)).map(t => t.categoryId).filter(Boolean))]
      .map(id => categories.find(c => c.id === id)).filter(Boolean),
    [transactions, categories, month]
  );

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
        return (t.note || "").toLowerCase().includes(q) || (cat?.name || "").toLowerCase().includes(q);
      });
    }
    if (sort === "date")  list.sort((a,b) => new Date(b.date)    - new Date(a.date));
    if (sort === "amt_d") list.sort((a,b) => parseFloat(b.amount) - parseFloat(a.amount));
    if (sort === "amt_a") list.sort((a,b) => parseFloat(a.amount) - parseFloat(b.amount));
    return list;
  }, [transactions, categories, month, filter, catId, search, sort]);

  const net = mStats.inc - mStats.exp;

  return (
    <div>
      <div className="card">
        <input type="month" value={month} onChange={e => { setMonth(e.target.value); setCatId(""); }} style={{ marginBottom: 8 }} />
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
        {usedCats.length > 0 && (
          <div className="filter-row" style={{ marginBottom: 6 }}>
            {usedCats.map(c => (
              <div key={c.id} className={`filter-chip${catId===c.id?" active":""}`}
                style={{ fontSize: ".62rem" }}
                onClick={() => setCatId(catId === c.id ? "" : c.id)}>
                {c.icon} {c.name}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: ".6rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>Tri :</span>
          {[["date","Date ↓"],["amt_d","Montant ↓"],["amt_a","Montant ↑"]].map(([k,l]) => (
            <span key={k} className={`sort-chip${sort===k?" active":""}`} onClick={() => setSort(k)}>{l}</span>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div style={{ background: "var(--success-glow)", border: "1px solid rgba(52,211,153,.25)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
          <div className="stat-label">Revenus</div>
          <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--success)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{fmt(mStats.inc)}</div>
        </div>
        <div style={{ background: "var(--danger-glow)", border: "1px solid rgba(248,113,113,.25)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
          <div className="stat-label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Dépenses</span>
            <span style={{ color: net >= 0 ? "var(--success)" : "var(--danger)", fontSize: ".6rem" }}>{net >= 0 ? "+" : ""}{fmt(net)}</span>
          </div>
          <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--danger)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{fmt(mStats.exp)}</div>
        </div>
      </div>

      <div className="card" style={{ padding: "0 16px" }}>
        {filtered.length === 0
          ? <EmptyIllustration type="historique" title="Aucun mouvement" sub="Aucune transaction ne correspond à ces filtres" />
          : filtered.map(t => (
              <ItemRow key={t.id} t={t} categories={categories} cagnottes={cagnottes}
                onEdit={onEditTrans} onDelete={onDeleteTrans} />
            ))
        }
      </div>
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
        background: "linear-gradient(135deg, #1e2d3d 0%, #2d3d52 100%)",
        borderRadius: 14, padding: "13px 16px", marginBottom: 12,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        boxShadow: "0 4px 18px rgba(126,207,255,.15)",
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
//  RAPPORT
// ─────────────────────────────────────────────────────────────────
export function RapportView({ data, currentYear, setCurrentYear, onShowMonthDetail }) {
  const { transactions, categories, fixedExpenses } = data;
  const months = useYearMonths(transactions, fixedExpenses, currentYear);
  const yearly = useYearTotals(transactions, fixedExpenses, currentYear);
  const prevY  = useYearTotals(transactions, fixedExpenses, currentYear - 1);

  const yInc = yearly.inc, yExp = yearly.exp, ySav = yearly.sav;
  const yNet  = yInc - yExp;
  const savRate = yInc > 0 ? Math.min(100, (ySav / yInc) * 100) : 0;

  const active = useMemo(() => months.filter(m => m.inc > 0 || m.exp > 0), [months]);
  const sorted = useMemo(() => [...active].sort((a, b) => b.net - a.net), [active]);
  const best   = sorted[0];
  const worst  = sorted.length > 1 ? sorted[sorted.length - 1] : null;

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
    { label: "💰 Revenus",   v1: yInc,  v0: prevY.inc,           color: "var(--success)", higherIsBetter: true  },
    { label: "💸 Dépenses",  v1: yExp,  v0: prevY.exp,           color: "var(--danger)",  higherIsBetter: false },
    { label: "🎯 Épargne",   v1: ySav,  v0: prevY.sav,           color: "var(--khaki)",   higherIsBetter: true  },
    { label: "📊 Solde net", v1: yNet,  v0: prevY.inc - prevY.exp, color: "var(--accent)", higherIsBetter: true  },
  ];

  return (
    <div>
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button className="year-nav-btn" onClick={() => setCurrentYear(y => y - 1)}>◀</button>
        <span style={{ fontFamily: "var(--display)", fontSize: "1.3rem", fontWeight: 800 }}>{currentYear}</span>
        <button className="year-nav-btn" onClick={() => setCurrentYear(y => y + 1)}>▶</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div className="stat-mini dash-revenu">
          <div className="stat-label">Revenus</div>
          <div className="stat-val type-income" style={{ fontSize: ".82rem" }}>{fmt(yInc)}</div>
        </div>
        <div className="stat-mini dash-depense">
          <div className="stat-label">Dépenses</div>
          <div className="stat-val type-expense" style={{ fontSize: ".82rem" }}>{fmt(yExp)}</div>
        </div>
        <div className="stat-mini" style={{ borderLeft: `3px solid ${yNet >= 0 ? "var(--success)" : "var(--danger)"}`, background: yNet >= 0 ? "var(--success-glow)" : "var(--danger-glow)" }}>
          <div className="stat-label">Solde net</div>
          <div className="stat-val" style={{ fontSize: ".82rem", color: yNet >= 0 ? "var(--success)" : "var(--danger)" }}>
            {yNet >= 0 ? "+" : ""}{fmt(yNet)}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 14 }}>
        {ySav === 0 ? (
          <div style={{ fontSize: ".78rem", color: "var(--text3)", textAlign: "center", padding: "4px 0 8px" }}>
            Aucune épargne enregistrée sur {currentYear}
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div className="stat-label">Taux d'épargne</div>
              <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: "1.1rem", color: "var(--khaki)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                {savRate.toFixed(1)}%
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="stat-label">Épargne totale</div>
              <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: ".9rem", color: "var(--khaki)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                {fmt(ySav)}
              </div>
            </div>
          </div>
        )}
        <div className="savings-bar-bg"><div className="savings-bar-fill" style={{ width: `${savRate}%` }} /></div>
      </div>

      {active.length > 0 && (
        <div className={worst ? "grid-2" : ""}>
          {[
            { label: "🏆 Meilleur mois", m: best,  bgVar: "var(--success-glow)", borderVar: "var(--success)", color: "var(--success)" },
            worst ? { label: "📉 Pire mois", m: worst, bgVar: "var(--danger-glow)",  borderVar: "var(--danger)",  color: "var(--danger)"  } : null,
          ].filter(Boolean).map(({ label, m, bgVar, borderVar, color }) => (
            <div key={label}
              className="stat-mini"
              style={{ borderLeft: `3px solid ${borderVar}`, background: bgVar, cursor: "pointer" }}
              onClick={() => onShowMonthDetail(currentYear, m.idx)}>
              <div className="stat-label">{label}</div>
              <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: ".9rem", marginTop: 6 }}>{m.label}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: ".78rem", color, fontWeight: 700, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
                {m.net >= 0 ? "+" : ""}{fmt(m.net)}
              </div>
              <span className="stat-arrow">›</span>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 14 }}>
        <div className="stat-label" style={{ marginBottom: 10 }}>Flux mensuels — clique sur un mois</div>
        <ChartSVG months={months} chartFilter="all" onMonthClick={i => onShowMonthDetail(currentYear, i)} />
        <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: "var(--success)" }}>■ Revenus</span>
          <span style={{ color: "var(--danger)"  }}>■ Dépenses</span>
          <span style={{ color: "var(--accent)"  }}>— Solde net</span>
        </div>
      </div>

      <SectionTitle>Top 5 dépenses</SectionTitle>
      <div className="card" style={{ padding: 14 }}>
        {top5.length === 0
          ? <p style={{ fontSize: ".78rem", color: "var(--text3)", textAlign: "center", padding: "12px 0" }}>Aucune dépense enregistrée</p>
          : top5.map(([id, val], i) => {
              const cat  = categories.find(c => c.id === id);
              const name = id === "__fixes__"  ? "🔄 Frais fixes"
                         : id === "__other__"  ? "❓ Sans catégorie"
                         : `${cat?.icon ?? ""} ${cat?.name ?? id}`;
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
  const [catFilter,   setCatFilter]   = useState("all");
  const filtered = useMemo(
    () => data.categories.filter(c => catFilter === "all" || c.type === catFilter),
    [data.categories, catFilter]
  );

  return (
    <div>
      <SectionTitle>Gestion Catégories</SectionTitle>
      <div className="filter-row">
        {[["all","Toutes"],["expense","Dépenses"],["income","Revenus"]].map(([k,l]) => (
          <div key={k} className={`filter-chip${catFilter===k?" active":""}`} onClick={() => setCatFilter(k)}>{l}</div>
        ))}
      </div>
      <div className="cat-grid">
        {filtered.length === 0
          ? <EmptyIllustration type="transactions" title="Aucune catégorie" sub="Crée des catégories pour organiser tes dépenses" ctaColor="var(--accent)" style={{ gridColumn:"1/-1" }} />
          : filtered.map(c => (
              <div key={c.id} className="cat-card-opt" onClick={() => onEditCat(c.id)}>
                <div style={{ position:"absolute", top:5, left:5, width:6, height:6, borderRadius:"50%",
                  background: c.type==="expense" ? "var(--danger)" : "var(--success)" }} />
                <span style={{ fontSize:"1.05rem", lineHeight:1, marginTop:6 }}>{c.icon}</span>
                <span style={{ fontSize:".6rem", fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"100%", padding:"0 2px" }}>{c.name}</span>
                <button className="btn-action btn-del" style={{ fontSize:".68rem", padding:"1px 4px", marginTop:2, lineHeight:1.4 }}
                  onClick={e => { e.stopPropagation(); onDeleteCat(c.id); }}>✕</button>
              </div>
            ))
        }
      </div>
      <button className="btn btn-outline" style={{ width:"100%", marginTop:10 }} onClick={onNewCat}>+ Créer une catégorie</button>

      <SectionTitle style={{ marginTop: 20 }}>Sauvegarde & Sécurité</SectionTitle>
      <div className="grid-2">
        <button className="btn btn-primary"  onClick={onExport}>⬇ Exporter JSON</button>
        <button className="btn btn-outline"  onClick={onImport}>⬆ Importer JSON</button>
      </div>
      <button className="btn btn-danger-outline" style={{ width:"100%", marginTop:12 }} onClick={onReset}>
        ⚠️ Réinitialiser toutes les données
      </button>

      {/* ── Version ── */}
      <div style={{
        marginTop: 32,
        textAlign: "center",
        color: "var(--text3)",
        fontSize: ".65rem",
        letterSpacing: ".06em",
        fontWeight: 600,
      }}>
        {APP_NAME} — v{APP_VERSION}
      </div>
    </div>
  );
}
