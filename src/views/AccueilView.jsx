// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Delta, Modal } from "../components/index.jsx";
import { fmt, currentYM, getPrevMonth, isIncome, MONTHS_SHORT, recurringRefDate, todayISO, daysAgoISO } from "../utils.js";
import { useBalanceWithRecurring, useMonthStats, usePriorYearStats, useTotalFixes, useBalanceProjection, useProjectionAccuracy, effectiveFixesForMonth, effectiveIncomesForMonth, useReconciliation, isActiveForMonth, computeTagBudgets, computeWallets, pendingCheques } from "../hooks.js";
import { MONTHS_FR, SectionTitle } from "./shared.jsx";

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
export function AccueilView({ data, onOpenOffAccount, onCashCheque, onDeleteTrans, onShowDetail, onSwitchTab, onSaveProvisional, onDeleteProvisional, onGoToHistorique, alertEnabled, alertThreshold, roundingEnabled, roundingCagnotteId, roundingLastTransferDate, onMarkRoundingTransferred, onDeleteScheduled, onConfirmRecurring, onTogglePointFix, onTogglePointIncome, onSaveProjectionSnapshot }) {

  // Sections masquables — persistées en localStorage
  const [hidden, setHidden] = useState(() => {
    try { return JSON.parse(localStorage.getItem("accueil_hidden") || "[]"); }
    catch { return []; }
  });
  function Sec({ id, children }) {
    if (hidden.includes(id)) return null;
    return <div>{children}</div>;
  }
  function toggleSection(id) {
    setHidden(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem("accueil_hidden", JSON.stringify(next));
      return next;
    });
  }

  // Wrapper de section masquable

  const { transactions, cagnottes, fixedExpenses } = data;
  const provisionalExpenses = data.provisionalExpenses || [];
  const curM      = currentYM();
  const prevM     = getPrevMonth(curM);
  const curY      = new Date().getFullYear().toString();

  const balance   = useBalanceWithRecurring(transactions, fixedExpenses, data.fixedIncomes || [], data.recurringTemplates || [], data.scheduledTransactions || []);

  // v1.39.10 : projection du solde sur les prochains mois (médiane des
  // dépenses courantes + fixes/récurrentes/programmées déjà connus)
  const projection = useBalanceProjection(
    balance, transactions, fixedExpenses, data.fixedIncomes || [],
    data.recurringTemplates || [], data.scheduledTransactions || [], 3, alertThreshold
  );
  const [heroIndex, setHeroIndex] = useState(0);
  const heroCarouselRef = useRef(null);
  const onHeroScroll = () => {
    const el = heroCarouselRef.current;
    if (!el) return;
    setHeroIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  // v1.39.14 : on fige la toute première projection vue pour chaque mois —
  // le reducer ignore lui-même les mois déjà figés (no-op), donc pas de
  // souci à rappeler ça à chaque render.
  useEffect(() => {
    projection.months.forEach(m => {
      if (!data.projectionSnapshots?.[m.ym]) {
        onSaveProjectionSnapshot?.(m.ym, m.value);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection.months]);

  // Fiabilité : compare les projections passées à la réalité une fois le mois écoulé
  const projectionAccuracy = useProjectionAccuracy(
    transactions, fixedExpenses, data.fixedIncomes || [], data.projectionSnapshots || {}
  );

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
  const curMonth  = useMonthStats(transactions, fixedExpenses, curM, data.fixedIncomes || []);
  const prevMonth = useMonthStats(transactions, fixedExpenses, prevM, data.fixedIncomes || []);
  const tf        = useTotalFixes(fixedExpenses, curM);

  // ── Rapprochement bancaire ────────────────────────────────────
  // Même source que le solde estimé (useBalanceWithRecurring) : les deux
  // ne peuvent plus diverger, puisqu'ils partagent ce même calcul.
  const { soldePointe, soldeAttente, nbPointed, totalPointable } =
    useReconciliation(transactions, fixedExpenses, data.fixedIncomes || []);

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
  // Porte-monnaie hors compte (v1.42.0) — purement informatif
  const [walletOpen, setWalletOpen] = useState(false);
  // Chèques non encaissés (v1.43.0)
  const [chequesOpen, setChequesOpen] = useState(false);
  const [cashing,     setCashing]     = useState(null);   // { id, date } en cours d'encaissement

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
      const amount = parseFloat(tpl.amount) || 0;
      if (amount <= 0) return false;
      const confirmed = (data.transactions || []).filter(t => t.templateId === tpl.id);
      if (tpl.occurrences != null && confirmed.length >= tpl.occurrences) return false;
      if (tpl.frequency === "yearly") {
        return !(data.transactions || []).some(t => t.templateId === tpl.id && recurringRefDate(t).startsWith(curY));
      }
      return !(data.transactions || []).some(t => t.templateId === tpl.id && recurringRefDate(t).startsWith(curM));
    });
  }, [data.recurringTemplates, data.transactions, curM, curY]);

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [tabUpcoming,   setTabUpcoming]   = useState("both");
  const [openUpcoming,  setOpenUpcoming]  = useState(false);

  // Le bouton "retour" (navigateur / geste Android) doit aussi fermer ce modal :
  // on pousse une entrée d'historique factice à l'ouverture, et on écoute "popstate".
  const upcomingHistoryPushed = useRef(false);
  useEffect(() => {
    if (!openUpcoming) return;
    window.history.pushState({ upcomingModal: true }, "");
    upcomingHistoryPushed.current = true;
    const onPopState = () => { upcomingHistoryPushed.current = false; setOpenUpcoming(false); };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [openUpcoming]);

  // Fermeture via le bouton ✕ (ou clic en dehors) : si une entrée a été poussée,
  // on la consomme aussi pour que le prochain "retour" ne soit pas neutralisé.
  const closeUpcoming = useCallback(() => {
    if (upcomingHistoryPushed.current) {
      upcomingHistoryPushed.current = false;
      window.history.back();
    }
    setOpenUpcoming(false);
  }, []);

  // Frais fixes non pointés ce mois (respecte startYM : pas encore commencé = pas affiché)
  const unpointedFixes = useMemo(() =>
    fixedExpenses.filter(f => isActiveForMonth(f, curM) && !f.pointedMonths?.[curM]),
    [fixedExpenses, curM]
  );

  // Revenus fixes non pointés ce mois — même logique, désormais pointables
  const unpointedIncomes = useMemo(() => {
    const fixedIncomes = data.fixedIncomes || [];
    return fixedIncomes.filter(f => isActiveForMonth(f, curM) && !f.pointedMonths?.[curM]);
  }, [data.fixedIncomes, curM]);

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


      {showBackup && (
        <div className="backup-alert" onClick={() => onSwitchTab("options")}>
          ⚠️ AUCUNE SAUVEGARDE JSON DEPUIS 7 JOURS
        </div>
      )}

      {/* ── Carrousel : solde ↔ projection ── */}
      <div className="hero-carousel" ref={heroCarouselRef} onScroll={onHeroScroll}>
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
            // Soustraire les fixes et ajouter les revenus fixes pour chaque mois
            // jusqu'au mois précédent inclus (même logique que useBalance, via
            // les helpers partagés — respecte le startYM propre à chaque fixe)
            if (transactions.length > 0) {
              const earliest = transactions.reduce((m, t) => t.date < m ? t.date : m, transactions[0].date);
              const startYM  = earliest.slice(0, 7);
              let [y, m] = startYM.split("-").map(Number);
              const [ey, em] = prevYM.split("-").map(Number);
              while (y < ey || (y === ey && m <= em)) {
                const ym = `${y}-${String(m).padStart(2, "0")}`;
                balPrev -= effectiveFixesForMonth(fixedExpenses, ym);
                balPrev += effectiveIncomesForMonth(data.fixedIncomes || [], ym);
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
              const mLabel = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"][d.getMonth()];

              // Le dernier point (mois en cours) doit toujours correspondre
              // EXACTEMENT au solde estimé affiché au-dessus — sinon les deux
              // divergent dès que la définition du solde estimé évolue.
              if (i === 5) {
                return { val: balance, mois: mLabel, isLast: true };
              }

              // Mois passés : solde "brut" à cette date-là — pas de notion de
              // récurrente/programmée "en attente" pour un mois déjà terminé.
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
                  bal -= effectiveFixesForMonth(fixedExpenses, loopYM);
                  bal += effectiveIncomesForMonth(data.fixedIncomes || [], loopYM);
                  if (++m > 12) { m = 1; y++; }
                }
              }
              return { val: bal, mois: mLabel, isLast: false };
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

          {/* ── Rapprochement bancaire (+ porte-monnaie TR en 3ᵉ mini-carte, v1.42.0) ── */}
          {(() => { const w = computeWallets(data.sideAmountTypes, data.offAccountEntries, transactions, curM)[0]; return (
          <div style={{ display: "grid", gridTemplateColumns: w ? "1fr 1fr 1fr" : "1fr 1fr", gap: w ? 6 : 8, marginBottom: 10 }}>
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
            {w && (
              <div onClick={() => setWalletOpen(true)} className="tr-metal-box"
                style={{ borderRadius: 9, padding: "8px 8px", cursor: "pointer", "--tr-fill": "rgba(30,40,58,.9)" }}>
                <div style={{ fontSize: ".55rem", color: "var(--tr)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {w.st.icon} {w.st.label.length > 8 ? (w.st.id === "tr" ? "TR" : w.st.label.slice(0, 8)) : w.st.label} ›
                </div>
                <div className="tr-metal-text" style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".85rem", fontVariantNumeric: "tabular-nums" }}>
                  {fmt(w.balance)}
                </div>
                <div style={{ fontSize: ".52rem", color: "rgba(255,255,255,.35)", marginTop: 2 }}>restant</div>
              </div>
            )}
          </div>
          ); })()}

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

      {/* ── Carte Projection (médiane des dépenses courantes) ── */}
      <div className="hero-card" style={{
        background: "linear-gradient(135deg, #101f18 0%, #16321f 45%, #0e1e18 100%)",
        border: "none", boxShadow: "0 4px 24px rgba(104,212,152,.15)",
        overflow: "hidden", paddingBottom: 18,
      }}>
        <div style={{
          position: "absolute", top: -30, right: -30, width: 130, height: 130,
          borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(104,212,152,.18) 0%, transparent 70%)",
        }} />
        <div className="hero-label" style={{ color: "rgba(255,255,255,.72)", fontWeight: 700, position: "relative" }}>
          Projection à 3 mois
        </div>

        {/* Alerte : passera sous le seuil configuré */}
        {projection.thresholdBreachMonth && (
          <div style={{ display: "flex", alignItems: "center", gap:6, marginTop: 8, padding: "6px 9px", borderRadius: 8, background: "rgba(200,112,112,.14)", border: "1px solid rgba(200,112,112,.35)", position: "relative" }}>
            <span style={{ fontSize: ".75rem" }}>⚠️</span>
            <span style={{ fontSize: ".62rem", color: "#ffd4d4", fontWeight: 700 }}>
              Passera sous ton seuil d'alerte ({fmt(alertThreshold)}) dès {projection.thresholdBreachMonth.label}
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: 7, marginTop: 12, position: "relative" }}>
          {projection.months.map((m, i) => {
            const color = m.value < 0 ? "var(--danger)" : m.value < (alertThreshold || 0) ? "var(--warning)" : "var(--success)";
            return (
              <div key={m.ym} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                {i > 0 && <div style={{ color: "rgba(255,255,255,.3)", fontSize: ".65rem", marginRight: 7 }}>→</div>}
                <div style={{ flex: 1, textAlign: "center", padding: "9px 4px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
                  <div style={{ fontSize: ".56rem", color: "rgba(255,255,255,.55)", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: ".8rem", fontWeight: 800, color }}>{fmt(m.value)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Explication : la plus grosse programmée qui pèse sur la projection */}
        {projection.biggestSchedItem && (
          <div style={{ fontSize: ".6rem", color: "rgba(255,255,255,.55)", marginTop: 9, position: "relative" }}>
            💡 <b style={{ color: "#fff" }}>{projection.biggestSchedMonth.label}</b> : ta programmée "{projection.biggestSchedItem.note || "sans nom"}" de {fmt(projection.biggestSchedItem.amount)} tombe ce mois-là.
          </div>
        )}

        <div style={{ marginTop: 9, paddingTop: 9, borderTop: "1px solid rgba(255,255,255,.1)", display: "flex", justifyContent: "space-between", fontSize: ".6rem", color: "rgba(255,255,255,.55)", position: "relative" }}>
          <span>Flux courant net estimé (médiane/6 mois)</span>
          <span style={{ fontWeight: 800, color: projection.variableNetMedian >= 0 ? "var(--success)" : "var(--danger)" }}>
            {projection.variableNetMedian >= 0 ? "+" : ""}{fmt(projection.variableNetMedian)}/mois
          </span>
        </div>
        <div style={{ fontSize: ".58rem", color: "rgba(255,255,255,.4)", marginTop: 8, lineHeight: 1.5, position: "relative" }}>
          Dépenses et revenus ponctuels (courses, freelance, remboursements…), fixes/récurrentes/programmées connues incluses. Ne peut pas deviner un imprévu ponctuel (réparation, cadeau…).
        </div>

        {/* Fiabilité : ce qu'on avait annoncé vs la réalité, mois par mois */}
        {projectionAccuracy.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.1)", position: "relative" }}>
            <div style={{ fontSize: ".6rem", fontWeight: 700, color: "rgba(255,255,255,.6)", marginBottom: 6 }}>Fiabilité de la projection</div>
            {projectionAccuracy.slice(0, 3).map(a => {
              const good = Math.abs(a.delta) <= 50;
              return (
                <div key={a.ym} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: ".6rem", padding: "3px 0", color: "rgba(255,255,255,.65)" }}>
                  <span>{a.ym}</span>
                  <span>Prévu {fmt(a.predicted)} → Réel {fmt(a.actual)}</span>
                  <span style={{ fontWeight: 800, color: good ? "var(--success)" : Math.abs(a.delta) <= 150 ? "var(--warning)" : "var(--danger)" }}>
                    {a.delta >= 0 ? "+" : ""}{fmt(a.delta)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* Dots du carrousel solde ↔ projection */}
      <div className="hero-dots">
        <div className={`hero-dot ${heroIndex === 0 ? "active" : ""}`} />
        <div className={`hero-dot ${heroIndex === 1 ? "active" : ""}`} />
      </div>

      {/* ── 🧾 Chèques non encaissés (v1.43.0) — n'apparaît que s'il y en a ── */}
      {(() => {
        const pend = pendingCheques(transactions);
        if (pend.length === 0) return null;
        const total = pend.reduce((s, c) => s + (parseFloat(c.t.amount) || 0), 0);
        const oldest = pend[0];
        const alertCol = oldest.level === "expired" || oldest.level === "veryold" ? "var(--danger)" : oldest.level === "old" ? "var(--warning)" : "var(--text2)";
        return (
          <div onClick={() => setChequesOpen(true)} style={{
            display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px", padding: "10px 13px", borderRadius: 14,
            background: "var(--chq-glow)", border: "1px solid var(--chq-border)", cursor: "pointer",
          }}>
            <span style={{ fontSize: "1rem" }}>🧾</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: ".7rem", fontWeight: 800, color: "var(--chq)" }}>
                {pend.length} chèque{pend.length > 1 ? "s" : ""} non encaissé{pend.length > 1 ? "s" : ""} · {fmt(total)}
              </div>
              <div style={{ fontSize: ".58rem", color: alertCol, marginTop: 2 }}>
                {oldest.level === "expired" ? "⚠️ Au moins un chèque n'est plus encaissable"
                  : pend.length > 1 ? `Le plus ancien : il y a ${oldest.age} jour${oldest.age > 1 ? "s" : ""}` : `Émis il y a ${oldest.age} jour${oldest.age > 1 ? "s" : ""}`}
              </div>
            </div>
            <span style={{ color: "var(--text2)" }}>›</span>
          </div>
        );
      })()}

      {chequesOpen && (() => {
        const pend = pendingCheques(transactions);
        const cats = data.categories || [];
        const total = pend.reduce((s, c) => s + (parseFloat(c.t.amount) || 0), 0);
        const lvl = { recent: ["var(--chq)", "var(--chq-glow)"], old: ["var(--warning)", "rgba(200,184,96,.15)"], veryold: ["var(--danger)", "rgba(200,112,112,.14)"], expired: ["var(--danger)", "rgba(200,112,112,.14)"] };
        const close = () => { setChequesOpen(false); setCashing(null); };
        const shortcuts = [["Aujourd'hui", todayISO()], ["Hier", daysAgoISO(1)], ["Avant-hier", daysAgoISO(2)]];
        const dd = iso => `${iso.slice(8)}/${iso.slice(5, 7)}`;
        return (
          <Modal onClose={close} title="">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontWeight: 800, fontSize: ".85rem" }}>🧾 Chèques non encaissés</div>
              <button onClick={close} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", color: "var(--text2)", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ fontSize: ".6rem", color: "var(--text2)", marginBottom: 6, lineHeight: 1.5 }}>
              {pend.length === 0 ? "Tous tes chèques sont encaissés ✓" : `${fmt(total)} déjà déduits de ton solde estimé, pas encore sortis de ton compte.`}
            </div>
            <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
              {pend.map(({ t, issued, age, expiry, level }) => {
                const cat = cats.find(c => c.id === t.categoryId);
                const [col, bg] = lvl[level];
                const isCashing = cashing?.id === t.id;
                return (
                  <div key={t.id} style={{ padding: "11px 2px", borderBottom: "1px solid var(--border-soft)" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: ".74rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat?.icon || "🧾"} {t.note || cat?.name || "Chèque"}</div>
                        <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 2 }}>{t.chequeNumber ? `n°${t.chequeNumber} · ` : ""}émis le {dd(issued)}</div>
                        <span style={{ display: "inline-block", marginTop: 4, fontSize: ".54rem", fontWeight: 800, padding: "1px 7px", borderRadius: 8, color: col, background: bg }}>
                          {level === "expired" ? `Périmé depuis le ${dd(expiry)}` : `il y a ${age} j`}
                        </span>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".8rem", color: "var(--danger)" }}>−{fmt(t.amount)}</div>
                        {!isCashing && level !== "expired" && (
                          <button onClick={() => setCashing({ id: t.id, date: todayISO() })} style={{ marginTop: 6, padding: "6px 10px", borderRadius: 16, border: "1px solid var(--success)", color: "var(--success)", background: "rgba(104,212,152,.08)", fontSize: ".6rem", fontWeight: 800, cursor: "pointer" }}>✓ Encaissé</button>
                        )}
                        {level === "expired" && (
                          <button onClick={() => onDeleteTrans?.(t.id)} style={{ marginTop: 6, padding: "6px 10px", borderRadius: 16, border: "1px solid var(--danger)", color: "var(--danger)", background: "transparent", fontSize: ".6rem", fontWeight: 800, cursor: "pointer" }}>Annuler le chèque</button>
                        )}
                      </div>
                    </div>
                    {level === "expired" && (
                      <div style={{ fontSize: ".58rem", color: "var(--text2)", marginTop: 6, lineHeight: 1.5 }}>Supprime la dépense : les {fmt(t.amount)} reviennent dans ton solde estimé. « Annuler » ne sert que si le bénéficiaire ne l'a jamais encaissé.</div>
                    )}
                    {isCashing && (
                      <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: ".56rem", color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Encaissé le</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {shortcuts.map(([l, v]) => (
                            <button key={v} onClick={() => setCashing({ id: t.id, date: v })} style={{ padding: "5px 10px", borderRadius: 16, fontSize: ".6rem", fontWeight: 700, cursor: "pointer", border: `1px solid ${cashing.date === v ? "var(--chq)" : "var(--border)"}`, color: cashing.date === v ? "var(--chq)" : "var(--text2)", background: cashing.date === v ? "var(--chq-glow)" : "transparent" }}>{l}</button>
                          ))}
                          <input type="date" value={cashing.date} min={issued} onChange={e => e.target.value && setCashing({ id: t.id, date: e.target.value })} style={{ fontSize: ".62rem", padding: "4px 6px" }} />
                        </div>
                        {cashing.date < issued && <div style={{ fontSize: ".58rem", color: "var(--danger)", marginTop: 6 }}>La date d'encaissement est avant l'émission ({dd(issued)}).</div>}
                        <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 6, lineHeight: 1.5 }}>La dépense passera au {dd(cashing.date)} et sera pointée.</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <button onClick={() => setCashing(null)} style={{ flex: 1, padding: 8, borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text2)", fontWeight: 700, fontSize: ".64rem", cursor: "pointer" }}>Annuler</button>
                          <button disabled={cashing.date < issued} onClick={() => { onCashCheque?.(t.id, cashing.date); setCashing(null); }} style={{ flex: 2, padding: 8, borderRadius: 9, border: "none", background: cashing.date < issued ? "var(--surface3)" : "var(--success)", color: "#06121c", fontWeight: 800, fontSize: ".66rem", cursor: "pointer" }}>✓ Marquer encaissé</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: ".56rem", color: "var(--text3)", marginTop: 10, lineHeight: 1.6 }}>
              <span style={{ color: "var(--chq)" }}>■</span> moins de 30 j · <span style={{ color: "var(--warning)" }}>■</span> 30 j à 3 mois · <span style={{ color: "var(--danger)" }}>■</span> plus de 3 mois.<br/>
              Un chèque n'est plus encaissable 1 an et 8 jours après son émission. Pointer un chèque dans l'Historique l'encaisse à la date du jour.
            </div>
          </Modal>
        );
      })()}

      {/* ── 🐷 Cagnottes + 📌 Fixes ── */}
      <Sec id="cagnottes_fixes">
      <div className="grid-2">
        <div className="stat-mini dash-cagnotte2" onClick={() => onShowDetail("cagnottes", "all")} style={{ height:80 }}>
          <div className="stat-label">🐷 Cagnottes</div>
          <div className="stat-val" style={{ color:"var(--purple)" }}>{fmt(cagTotal)}</div>
          {/* ★ Taux d'épargne */}
          {curMonth.inc > 0 && (() => {
            const rate     = Math.round((savMonth / curMonth.inc) * 100);
            const prevRate = prevMonth.inc > 0 ? Math.round((prevSavMonth / prevMonth.inc) * 100) : null;
            const delta    = prevRate !== null ? rate - prevRate : null;
            return (
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                <span style={{ fontFamily:"var(--mono)", fontSize:".62rem", fontWeight:800, color:"var(--purple)" }}>
                  🐷 {rate}%
                </span>
                {delta !== null && (
                  <span style={{ fontSize:".55rem", fontWeight:700, color: delta >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {delta >= 0 ? "▲" : "▼"}{Math.abs(delta)}%
                  </span>
                )}
              </div>
            );
          })()}
          <span className="stat-arrow">›</span>
        </div>
        <div className="stat-mini dash-fixe2" style={{ height:80 }}>
          <div className="stat-label">📌 Fixes / mois</div>
          <div className="stat-val" style={{ color:"#e8944a" }}>{fmt(tf)}</div>
        </div>
      </div>
      </Sec>

      {/* ── À venir ── v1.39.8 : ouvre un modal au lieu d'un dépliant inline */}
      {/* Panneau porte-monnaie (v1.42.0) — ouvert depuis la 3ᵉ mini-carte */}
      {walletOpen && (() => {
        const wallets = computeWallets(data.sideAmountTypes, data.offAccountEntries, transactions, curM);
        const cats = data.categories || [];
        return (
          <Modal onClose={() => setWalletOpen(false)} title="">
            {wallets.map((w, wi) => (
              <div key={w.st.id} style={{ marginBottom: wi < wallets.length - 1 ? 18 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 800, fontSize: ".8rem" }}>{w.st.icon} {w.st.label}</div>
                  {wi === 0 && <button onClick={() => setWalletOpen(false)} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", color: "var(--text2)", cursor: "pointer" }}>✕</button>}
                </div>
                <div className="tr-metal-text" style={{ fontSize: "1.8rem", fontWeight: 800, fontFamily: "var(--mono)", marginTop: 4 }}>{fmt(w.balance)}</div>
                <div style={{ fontSize: ".6rem", color: "var(--text2)" }}>restant sur la carte</div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <div style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border-soft)" }}>
                    <div style={{ fontSize: ".52rem", color: "var(--text2)", fontWeight: 700, textTransform: "uppercase" }}>Rechargé ce mois</div>
                    <div style={{ fontSize: ".78rem", fontWeight: 800, color: "var(--success)", marginTop: 3 }}>+{fmt(w.rechargedMonth)}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border-soft)" }}>
                    <div style={{ fontSize: ".52rem", color: "var(--text2)", fontWeight: 700, textTransform: "uppercase" }}>Dépensé ce mois</div>
                    <div style={{ fontSize: ".78rem", fontWeight: 800, color: "var(--tr)", marginTop: 3 }}>−{fmt(w.spentMonth)}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, maxHeight: "34vh", overflowY: "auto" }}>
                  {w.moves.length === 0 && <div style={{ fontSize: ".64rem", color: "var(--text3)", textAlign: "center", padding: 10 }}>Aucun mouvement — commence par un rechargement.</div>}
                  {w.moves.slice(0, 30).map(m => {
                    const cat = cats.find(c => c.id === m.categoryId);
                    const label = m.kind === "recharge" ? (m.note || (m.amount < 0 ? "Correction" : "Rechargement"))
                      : `${m.note || cat?.name || "Dépense"}${m.kind === "complement" ? " (complément)" : ""}`;
                    const icon = m.kind === "recharge" ? "💳" : (cat?.icon || w.st.icon);
                    const editable = m.kind !== "complement";
                    return (
                      <div key={m.id} onClick={() => editable && onOpenOffAccount?.(m.kind, w.st.id, m.entry)}
                        style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: ".66rem", padding: "8px 0", borderBottom: "1px solid var(--border-soft)", cursor: editable ? "pointer" : "default" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{icon} {label} · {m.date.slice(8)}/{m.date.slice(5, 7)}</span>
                        <span style={{ fontFamily: "var(--mono)", fontWeight: 800, flexShrink: 0, color: m.amount >= 0 ? "var(--success)" : "var(--tr)" }}>{m.amount >= 0 ? "+" : "−"}{fmt(Math.abs(m.amount))}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button onClick={() => { setWalletOpen(false); onOpenOffAccount?.("recharge", w.st.id); }} style={{ flex: 1, padding: 9, borderRadius: 18, background: "transparent", border: "1px solid var(--success)", color: "var(--success)", fontWeight: 800, fontSize: ".66rem", cursor: "pointer" }}>＋ Rechargement</button>
                  <button onClick={() => { setWalletOpen(false); onOpenOffAccount?.("expense", w.st.id); }} style={{ flex: 1, padding: 9, borderRadius: 18, background: "transparent", border: "1px solid var(--tr)", color: "var(--tr)", fontWeight: 800, fontSize: ".66rem", cursor: "pointer" }}>− Dépense</button>
                </div>
              </div>
            ))}
            <div style={{ fontSize: ".56rem", color: "var(--text3)", marginTop: 10, lineHeight: 1.5 }}>Informatif : n'impacte ni ton solde bancaire ni le rapprochement. Tape une ligne pour la modifier.</div>
          </Modal>
        );
      })()}

      {/* Alerte budgets par tag (v1.41.0) — dès 80 % consommés ; tap → Rapport */}
      {(() => {
        const alerts = computeTagBudgets(data.tags, transactions, curM).filter(b => b.level !== "ok");
        if (alerts.length === 0) return null;
        return (
          <div onClick={() => onSwitchTab?.("rapport")} style={{
            marginBottom: 12, padding: "10px 14px", borderRadius: 14, cursor: "pointer",
            background: "rgba(200,184,96,.07)", border: "1px solid rgba(200,184,96,.28)",
          }}>
            {alerts.map(({ tag, spent, budget, pct, level }) => (
              <div key={tag.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".68rem", padding: "2px 0" }}>
                <span>{level === "over" ? "🔴" : "⚠️"}</span>
                <span style={{ flex: 1 }}>Budget <b>{tag.icon} {tag.name}</b> {level === "over" ? "dépassé" : `à ${Math.round(pct)} %`}</span>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: level === "over" ? "var(--danger)" : "var(--warning)" }}>{fmt(spent)} / {fmt(budget)}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {(unpointedFixes.length > 0 || unpointedIncomes.length > 0 || upcomingScheduled.length > 0 || upcomingRecurring.length > 0) && (() => {
        const C = "#e8f2ff", Cbord = "rgba(210,225,245,.22)";
        const fixItems   = unpointedFixes.map(f  => ({ ...f, _type:"fix"       }));
        const incItems   = unpointedIncomes.map(f=> ({ ...f, _type:"fixIncome" }));
        const schedItems = upcomingScheduled.map(s=> ({ ...s, _type:"scheduled" }));
        const recurItems = upcomingRecurring.map(r => ({ ...r, _type:"recurring" }));
        const allItems   = [...recurItems, ...fixItems, ...incItems, ...schedItems];
        // Contribution signée d'un item au total : + pour un revenu (fixe ou
        // récurrente de type revenu), − pour tout le reste.
        const signedAmt = i => {
          const a = parseFloat(i.amount) || 0;
          const isPositive = i._type === "fixIncome" || (i._type === "recurring" && i.type === "income");
          return isPositive ? a : -a;
        };
        const visibleItems = tabUpcoming==="fixes" ? [...fixItems, ...incItems] : tabUpcoming==="scheduled" ? schedItems : tabUpcoming==="recurring" ? recurItems : allItems;
        const total = allItems.reduce((s,i) => s+signedAmt(i), 0);
        const unpointedVisibleFixes = visibleItems.filter(i => i._type === "fix" || i._type === "fixIncome");

        // Répartition "ce mois" vs mois suivants — les récurrentes et fixes en
        // attente sont toujours "ce mois" ; seules les programmées peuvent
        // être datées dans un mois futur (v1.39.19)
        const thisMonthTotal =
          recurItems.reduce((s,i)=>s+signedAmt(i),0) +
          fixItems.reduce((s,i)=>s+signedAmt(i),0) +
          incItems.reduce((s,i)=>s+signedAmt(i),0) +
          schedItems.filter(s=>s.date.startsWith(curM)).reduce((s,i)=>s+signedAmt(i),0);
        const futureByMonth = {};
        schedItems.filter(s=>!s.date.startsWith(curM)).forEach(s => {
          const ym = s.date.slice(0,7);
          futureByMonth[ym] = (futureByMonth[ym]||0) + (parseFloat(s.amount)||0);
        });
        const futureMonthsSorted = Object.keys(futureByMonth).sort();
        const nearestFutureYM    = futureMonthsSorted[0];
        const nearestFutureTotal = nearestFutureYM ? futureByMonth[nearestFutureYM] : null;
        const extraFutureMonths  = Math.max(0, futureMonthsSorted.length - 1);
        const monthLabel = ym => MONTHS_SHORT[parseInt(ym.slice(5,7),10)-1];

        return (
          <>
            <style>{`@keyframes av-sh{0%{left:-60%;opacity:0}20%{opacity:1}80%{opacity:1}100%{left:110%;opacity:0}}`}</style>

            {/* Carte déclencheur — état fermé, inchangée visuellement */}
            <div onClick={()=>setOpenUpcoming(true)} style={{ overflow:"hidden", borderRadius:14, border:`1px solid ${Cbord}`, background:"linear-gradient(135deg,rgba(220,228,240,.09),rgba(200,215,235,.03))", position:"relative", marginBottom:12, cursor:"pointer", userSelect:"none" }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,rgba(255,255,255,.18),rgba(200,220,255,.08),transparent)", zIndex:1 }}/>
              <div style={{ position:"absolute", top:0, left:"-60%", width:"55%", height:"100%", background:"linear-gradient(105deg,transparent 30%,rgba(255,255,255,.07) 50%,transparent 70%)", animation:"av-sh 4s ease-in-out infinite", pointerEvents:"none", zIndex:1 }}/>
              <div style={{ position:"absolute", top:-20, right:-20, width:70, height:70, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,255,255,.06) 0%,transparent 70%)", pointerEvents:"none" }}/>
              <div style={{ display:"flex", alignItems:"center", gap:9, padding:"11px 14px 4px", position:"relative", zIndex:2 }}>
                <span style={{ fontSize:".9rem" }}>⏳</span>
                <span style={{ fontSize:".68rem", fontWeight:800, color:C, textTransform:"uppercase", letterSpacing:".08em", flex:1 }}>À venir</span>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  {recurItems.length>0 && <span style={{ fontSize:".58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(220,228,240,.10)", color:C, border:`1px solid ${Cbord}` }}>🔄 {recurItems.length}</span>}
                  {fixItems.length>0   && <span style={{ fontSize:".58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(90,184,224,.10)", color:"var(--accent)", border:"1px solid rgba(90,184,224,.2)" }}>↻ {fixItems.length}</span>}
                  {incItems.length>0   && <span style={{ fontSize:".58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(104,212,152,.10)", color:"var(--success)", border:"1px solid rgba(104,212,152,.2)" }}>💰 {incItems.length}</span>}
                  {schedItems.length>0 && <span style={{ fontSize:".58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(200,184,96,.10)", color:"var(--warning)", border:"1px solid rgba(200,184,96,.2)" }}>📅 {schedItems.length}</span>}
                </div>
                <span style={{ color:C, fontSize:".8rem", opacity:.7 }}>›</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:8, padding:"0 14px 11px", position:"relative", zIndex:2 }}>
                <span style={{ fontSize:".62rem", color:"rgba(200,220,245,.65)" }}>
                  Ce mois <b style={{ fontFamily:"var(--mono)", color: thisMonthTotal >= 0 ? "var(--success)" : C, fontWeight:800 }}>{thisMonthTotal >= 0 ? "+" : ""}{fmt(thisMonthTotal)}</b>
                </span>
                {nearestFutureYM && (
                  <span style={{ fontSize:".62rem", color:"rgba(200,220,245,.65)" }}>
                    · {monthLabel(nearestFutureYM)} <b style={{ fontFamily:"var(--mono)", color:"var(--warning)", fontWeight:800 }}>−{fmt(nearestFutureTotal)}</b>
                    {extraFutureMonths>0 && <span style={{ color:"rgba(200,220,245,.4)" }}> +{extraFutureMonths}</span>}
                  </span>
                )}
              </div>
            </div>

            {/* Modal — remplace l'ancien dépliant inline */}
            {openUpcoming && (
              <Modal onClose={closeUpcoming} title="">
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <div className="modal-title" style={{ marginBottom:0 }}>⏳ À venir</div>
                  <button onClick={closeUpcoming} style={{ width:26, height:26, borderRadius:"50%", background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text2)", fontSize:".7rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>✕</button>
                </div>

                {/* Filtres */}
                <div style={{ display:"flex", gap:6, overflowX:"auto", marginBottom:12, paddingBottom:2 }}>
                  {[["both","Tout"],["recurring","Récurrents"],["fixes","Fixes"],["scheduled","Programmés"]].map(([k,l])=>(
                    <button key={k} onClick={()=>setTabUpcoming(k)} className={`sort-chip ${tabUpcoming===k?"active":""}`} style={{ flexShrink:0 }}>{l}</button>
                  ))}
                </div>

                {/* Tout pointer — fixes ET revenus fixes non pointés visibles */}
                {unpointedVisibleFixes.length > 0 && (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, padding:"9px 12px", borderRadius:10, background:"rgba(104,212,152,.05)", border:"1px solid rgba(104,212,152,.2)", marginBottom:10 }}>
                    <span style={{ fontSize:".65rem", color:"var(--text2)" }}>{unpointedVisibleFixes.length} élément{unpointedVisibleFixes.length>1?"s":""} non pointé{unpointedVisibleFixes.length>1?"s":""}</span>
                    <button onClick={()=>unpointedVisibleFixes.forEach(f=>(f._type==="fixIncome" ? onTogglePointIncome : onTogglePointFix)?.(f.id, curM))} style={{ padding:"6px 12px", borderRadius:20, background:"rgba(104,212,152,.15)", border:"1px solid rgba(104,212,152,.4)", color:"var(--success)", fontSize:".64rem", fontWeight:800, cursor:"pointer" }}>✓ Tout pointer</button>
                  </div>
                )}

                {/* Liste */}
                <div>
                  {visibleItems.map((item,i)=>{
                    const isFix=item._type==="fix", isInc=item._type==="fixIncome", isRec=item._type==="recurring", isSch=item._type==="scheduled";
                    const isRecIncome = isRec && item.type === "income";
                    const cat=data.categories?.find(c=>c.id===item.categoryId);
                    const icon=isFix?(cat?.icon??"📌"):isInc?(cat?.icon??"💰"):isRec?(cat?.icon??"🔄"):(cat?.icon??"📅");
                    const label=(isFix||isInc)?item.name:isRec?(item.label||cat?.name||"Récurrente"):(item.note||cat?.name||"Dépense programmée");
                    const sub=(isFix||isInc)?"Ce mois · non pointé":isRec?`Ce mois · ${item.frequency==="yearly"?"annuelle":"mensuelle"}`:new Date(item.date).toLocaleDateString("fr-FR",{day:"numeric",month:"long"});
                    const badge=isSch?daysUntil(item.date):null;
                    const recurBadge = isRec && item.occurrences != null ? (() => {
                      const done = (data.transactions||[]).filter(t => t.templateId === item.id).length;
                      const remaining = item.occurrences - done;
                      return remaining > 0 ? `${remaining} fois restante${remaining > 1 ? "s" : ""}` : null;
                    })() : null;
                    const isConf=isSch&&deleteConfirm===item.id;
                    const ibg=isRec?"rgba(220,228,240,.08)":isFix?"rgba(90,184,224,.08)":isInc?"rgba(104,212,152,.08)":"rgba(200,184,96,.08)";
                    const ibord=isRec?"rgba(210,225,245,.18)":isFix?"rgba(90,184,224,.2)":isInc?"rgba(104,212,152,.2)":"rgba(200,184,96,.2)";
                    const dot=isRec?C:isFix?"var(--accent)":isInc?"var(--success)":"var(--warning)";
                    const dotL=isRec?"🔄":(isFix||isInc)?"↻":"·";
                    const amtColor = isInc || isRecIncome ? "var(--success)" : "var(--text)";
                    const amtSign  = isInc || isRecIncome ? "+" : "−";
                    return (
                      <div key={(item.id||item._type)+i} style={{ borderBottom:i<visibleItems.length-1?`1px solid rgba(210,225,245,.08)`:"none" }}>
                        {isConf?(
                          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"11px 4px", background:"rgba(224,104,112,.06)" }}>
                            <span style={{ fontSize:".65rem", color:"var(--text2)", flex:1 }}>Supprimer "{item.note||"cette programmée"}" ?</span>
                            <button onClick={()=>{onDeleteScheduled?.(item.id);setDeleteConfirm(null);}} style={{ background:"var(--danger)", border:"none", borderRadius:7, padding:"5px 12px", color:"#fff", fontSize:".62rem", fontWeight:800, cursor:"pointer" }}>Oui</button>
                            <button onClick={()=>setDeleteConfirm(null)} style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:7, padding:"5px 10px", color:"var(--text3)", fontSize:".62rem", cursor:"pointer" }}>Non</button>
                          </div>
                        ):(
                          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 4px" }}>
                            <div style={{ position:"relative", flexShrink:0 }}>
                              <div style={{ width:34, height:34, borderRadius:9, background:ibg, border:`1px solid ${ibord}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:".95rem" }}>{icon}</div>
                              <div style={{ position:"absolute", bottom:-2, right:-3, width:12, height:12, borderRadius:"50%", background:dot, border:"1.5px solid var(--surface)", fontSize:".35rem", color:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900 }}>{dotL}</div>
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:".75rem", fontWeight:700, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>{label}</div>
                              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                                <span style={{ fontSize:".62rem", color:"var(--text2)" }}>{sub}</span>
                                {badge && <span style={{ fontSize:".58rem", fontWeight:700, padding:"1px 6px", borderRadius:4, background:"rgba(200,184,96,.15)", color:"var(--warning)", border:"1px solid rgba(200,184,96,.25)" }}>{badge}</span>}
                                {recurBadge && <span style={{ fontSize:".58rem", fontWeight:700, padding:"1px 6px", borderRadius:4, background:"rgba(200,220,245,.08)", color:"var(--text2)", border:"1px solid rgba(200,220,245,.2)" }}>🔢 {recurBadge}</span>}
                              </div>
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
                              <span style={{ fontFamily:"var(--mono)", fontSize:".75rem", fontWeight:800, color:amtColor }}>{amtSign}{fmt(item.amount)}</span>
                              {isFix && <button onClick={()=>onTogglePointFix?.(item.id, curM)} title="Marquer comme pointé" style={{ width:22, height:22, borderRadius:"50%", background:"transparent", border:"2px solid var(--border)", color:"var(--text3)", fontSize:".6rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, fontWeight:900 }}></button>}
                              {isInc && <button onClick={()=>onTogglePointIncome?.(item.id, curM)} title="Marquer comme pointé" style={{ width:22, height:22, borderRadius:"50%", background:"transparent", border:"2px solid var(--border)", color:"var(--text3)", fontSize:".6rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, fontWeight:900 }}></button>}
                              {isRec && <button onTouchEnd={e=>{e.stopPropagation();e.preventDefault();onConfirmRecurring?.(item,curM);}} onClick={()=>onConfirmRecurring?.(item,curM)} style={{ width:22, height:22, borderRadius:"50%", background:"rgba(220,228,240,.12)", border:`1px solid ${Cbord}`, color:C, fontSize:".6rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, fontWeight:900 }}>✓</button>}
                              {isSch && <button onTouchEnd={e=>{e.stopPropagation();e.preventDefault();setDeleteConfirm(item.id);}} onClick={()=>setDeleteConfirm(item.id)} style={{ width:22, height:22, borderRadius:"50%", background:"transparent", border:"1px solid rgba(255,255,255,.25)", color:"var(--text2)", fontSize:".6rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>✕</button>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                {allItems.length > 1 && (
                  <div style={{ padding:"10px 4px 0", marginTop:8, borderTop:`1px solid var(--border-soft)`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:".62rem", color:"var(--text2)" }}>Total à venir (net)</span>
                    <span style={{ fontFamily:"var(--mono)", fontSize:".68rem", fontWeight:800, color: total >= 0 ? "var(--success)" : "var(--text)" }}>{total >= 0 ? "+" : ""}{fmt(total)}</span>
                  </div>
                )}
              </Modal>
            )}
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
