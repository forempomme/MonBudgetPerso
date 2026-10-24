// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Delta, Modal } from "../components/index.jsx";
import { fmt, currentYM, getPrevMonth, isIncome, MONTHS_SHORT, recurringRefDate, todayISO, daysAgoISO, touchMoved, resolveFixedDay, fixedOccurrenceYM, fixedAmountFor, pv, isPrivacy, MASK } from "../utils.js";
import { useBalanceBreakdown, useGroceryBudget, computePeriodTotals, computeDailyForecast, computeRestToLive, computeSurplus, pendingReimbursements, useMonthStats, usePriorYearStats, useTotalFixes, computeProjection, useProjectionAccuracy, effectiveFixesForMonth, effectiveIncomesForMonth, useReconciliation, isActiveForMonth, computeTagBudgets, computeWallets, pendingCheques, isIncomeDirection } from "../hooks.js";
import { MONTHS_FR, SectionTitle } from "./shared.jsx";
import { BalanceBreakdownSheet } from "./BalanceBreakdownSheet.jsx";
import { ForecastPanel, RestToLiveSheet, ReimbursementsSheet } from "./ForecastPanels.jsx";
import { SimulationSheet, SimulationBlock, SurplusCard, SurplusSheet } from "./InsightPanels.jsx";

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
  }, [balance, curMonthInc, curMonthExp, daysSinceBackup, alertEnabled, alertThreshold, isPrivacy()]); // v1.75.0 : texte refait au passage en mode discret

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
          background: "var(--tooltip-bg, #141618)", border: `1px solid ${status.color}`,
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
export function AccueilView({ data, onOpenReimbursement, onOpenOffAccount, onCashCheque, onDeleteTrans, onShowDetail, onSwitchTab, onSaveProvisional, onDeleteProvisional, onGoToHistorique, alertEnabled, alertThreshold, roundingEnabled, roundingCagnotteId, roundingLastTransferDate, onMarkRoundingTransferred, onDeleteScheduled, onConfirmRecurring, onTogglePointFix, onTogglePointIncome, onSaveProjectionSnapshot, onDismissInsight, onSaveSurplus }) {

  // Sections masquables — persistées en localStorage
  // v1.49.0 : période du bloc Bilan — pas mémorisée, revient toujours sur le mois
  const [bilanPer, setBilanPer] = useState("month");
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

  // v1.45.0 : le détail du calcul (panneau ouvert en touchant le montant)
  // et le montant lui-même viennent de la même fonction.
  const reimbLateDays = parseInt(data.restSettings?.reimbLateDays, 10) || 15;   // v1.69.0 : délai de retard réglable
  const breakdown = useBalanceBreakdown(transactions, fixedExpenses, data.fixedIncomes || [], data.recurringTemplates || [], data.scheduledTransactions || [], data.reimbursements || [], reimbLateDays);
  const balance   = breakdown.total;
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  // v1.46.0 : budget courses restant — informatif, jamais déduit du solde
  const grocery = useGroceryBudget(transactions, data.categories, data.groceryBudget, data.reimbursements || []);
  // v1.48.0 : solde jour par jour, reste à vivre, remboursements attendus
  const forecast = useMemo(() => computeDailyForecast(data, breakdown, grocery), [data, breakdown, grocery]);
  const rest     = useMemo(() => computeRestToLive(data, breakdown, grocery, forecast), [data, breakdown, grocery, forecast]);
  const reimbs   = useMemo(() => pendingReimbursements(data), [data]);
  const [avTab, setAvTab] = useState("list");   // panneau À venir : liste par défaut
  const [restOpen, setRestOpen] = useState(false);
  const [reimbOpen, setReimbOpen] = useState(false);

  // v1.39.10 : projection du solde sur les prochains mois (médiane des
  // dépenses courantes + fixes/récurrentes/programmées déjà connus)
  // v1.62.0 : computeProjection — jour par jour, reste du mois en cours déduit,
  // récurrentes annuelles, point bas avant la paie, fourchette, détail par mois
  const projection = useMemo(() => computeProjection(data, breakdown, { monthsAhead: 3, alertThreshold: alertEnabled ? alertThreshold : null }),
    [data, breakdown, alertEnabled, alertThreshold]);
  // v1.50.0 : « Et si… ? » — projection sur 6 mois servant de base à la
  // simulation (jamais figée dans projectionSnapshots), scénarios en mémoire seulement
  const projection6 = useMemo(() => computeProjection(data, breakdown, { monthsAhead: 6 }), [data, breakdown]);
  const [simScenarios, setSimScenarios] = useState([]);
  const [simOn,        setSimOn]        = useState(false);
  const [simSheet,     setSimSheet]     = useState(false);
  // v1.50.0 : surplus de fin de cycle → cagnotte
  const surplus = useMemo(() => computeSurplus(data, breakdown, grocery, forecast), [data, breakdown, grocery, forecast]);
  const [surplusSheet, setSurplusSheet] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroCarouselRef = useRef(null);
  const onHeroScroll = () => {
    const el = heroCarouselRef.current;
    if (!el) return;
    setHeroIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  // v1.62.0 : on fige la projection du MOIS SUIVANT (horizon 1), une seule fois,
  // pour mesurer la fiabilité à horizon constant (le reducer ignore les doublons).
  useEffect(() => {
    const m = projection.months[0];
    if (m && data.projectionSnapshots?.[m.ym]?.horizon !== 1) onSaveProjectionSnapshot?.(m.ym, m.value);
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
  // v1.47.1 : année en cours = somme des mêmes totaux mensuels que partout
  // (frais ET revenus fixes de chaque mois vécu — avant : seulement le mois en cours)
  const { yInc, yExp, yExpVar, yDecag, ySav } = useMemo(() => {
    const t = computePeriodTotals(transactions, fixedExpenses, data.fixedIncomes || [], `${curY}-01`, curM);
    return { yInc: t.inc, yExp: t.exp, yExpVar: t.expVar, yDecag: t.decag, ySav: t.sav };
  }, [transactions, fixedExpenses, data.fixedIncomes, curY, curM]);

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

  const pyStats = usePriorYearStats(transactions, fixedExpenses, data.fixedIncomes || []);
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
    // v1.64.0 : occurrence versée ce mois-ci (revenu compté dans le budget du mois suivant → M+1)
    return fixedIncomes.map(f => ({ f, ym: fixedOccurrenceYM(f, curM) }))
      .filter(({ f, ym }) => isActiveForMonth(f, ym) && !f.pointedMonths?.[ym])
      .map(({ f, ym }) => ({ ...f, _ym: ym, amount: fixedAmountFor(f, ym) }));
  }, [data.fixedIncomes, curM]);

  function daysUntil(dateStr) {
    const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
    if (diff <= 1)  return "demain";
    if (diff < 7)   return `dans ${diff} j`;
    if (diff < 60)  return `dans ${Math.round(diff/7)} sem.`;
    return `dans ${Math.round(diff/30)} mois`;
  }

  // ── v1.59.0 : écart vs même jour du mois dernier + solde au même jour sur 6 mois ──
  // (calcul inchangé, sorti de la carte pour alimenter la pastille et la fenêtre « Évolution du solde »)
  const evo = useMemo(() => {
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
      // v1.46.2 : opération d'équilibre (+/−) comptée comme dans le solde actuel
      else if (t.type === "balance_adjustment") balPrev += isIncomeDirection(t) ? a : -a;
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
        else if (t.type === "balance_adjustment") bal += isIncomeDirection(t) ? a : -a;
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

    const monthsShort = ["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];
    const prevShort = monthsShort[new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth()];
    return { balPrev, deltaAbs, deltaPct, isPos, sparkData, todayDay, prevShort };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, fixedExpenses, data.fixedIncomes, balance]);
  const [evoOpen, setEvoOpen] = useState(false);
  const [projInfo, setProjInfo] = useState(false);   // v1.61.0 : explication du calcul (ⓘ)
  const [accOpen,  setAccOpen]  = useState(false);   // v1.61.0 : détail de la fiabilité
  const [projSel,  setProjSel]  = useState(null);    // v1.62.0 : fin de mois dont on montre le détail

  // Bascule Solde / Projection (remplace les points du carrousel)
  const heroCardRefs = [useRef(null), useRef(null)];
  const goHero = i => { const el = heroCarouselRef.current, c = heroCardRefs[i].current; if (el && c) el.scrollTo({ left: c.offsetLeft - el.firstElementChild.offsetLeft, behavior: "smooth" }); setHeroIndex(i); };
  const heroSwitch = cur => (
    <div data-testid={`hero-switch-${cur}`} style={{ display: "flex", flexShrink: 0, background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 9, padding: 2, gap: 2 }}>
      {[["Solde", 0], ["Projection", 1]].map(([l, k]) => (
        <button key={k} onClick={() => goHero(k)} style={{ border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: ".6rem", fontWeight: 800, padding: "4px 9px", borderRadius: 7,
          background: cur === k ? "var(--accent)" : "transparent", color: cur === k ? "#06121c" : "rgba(255,255,255,.6)" }}>{l}</button>
      ))}
    </div>
  );
  // Hauteur du carrousel = hauteur de la carte affichée (sinon la carte du solde, plus basse,
  // serait étirée à la hauteur de la carte Projection)
  const [heroH, setHeroH] = useState(null);
  useEffect(() => {
    const c = heroCardRefs[heroIndex].current;
    if (!c) return;
    const upd = () => setHeroH(c.offsetHeight);
    upd();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(upd) : null;
    ro?.observe(c);
    return () => ro?.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroIndex]);
  const heroPill = (col, bg) => ({ display: "inline-flex", alignItems: "center", gap: 4, fontSize: ".66rem", fontWeight: 700, cursor: "pointer", padding: "5px 10px", borderRadius: 11, whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
    color: col, background: bg, border: `1px solid color-mix(in srgb, ${col} 35%, transparent)`, fontVariantNumeric: "tabular-nums" });
  // v1.59.1 : pastilles qui passent à la ligne (plus de défilement horizontal), carte plus aérée
  const heroRowTitle = { fontSize: ".54rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.45)", margin: "16px 0 7px" };
  const heroRow = { display: "flex", flexWrap: "wrap", gap: 7 };

  // ── v1.60.0 : cartes différenciées (fond teinté + pastille d'icône + titres de section) ──
  const CARD_COL = { chq: "#8fb4f0", ven: "#d2dff5", cag: "#b090e0", fix: "#e8944a", bil: "#70b8e0" };
  // v1.73.0 : cartes harmonisées avec le reste de l'appli (verre + liseré teinté, plus de pastille d'icône)
  const tintCard = col => ({ background: `color-mix(in srgb, ${col} 6%, var(--surface))`, border: `1px solid color-mix(in srgb, ${col} 42%, transparent)` });
  const secTitle = (txt, id) => (
    <div data-testid={id} style={{ fontSize: ".56rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text3)", margin: "14px 3px 6px" }}>{txt}</div>
  );
  const hasTodo = !!surplus?.show || pendingCheques(transactions).length > 0
    || unpointedFixes.length > 0 || unpointedIncomes.length > 0 || upcomingScheduled.length > 0 || upcomingRecurring.length > 0;

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
      <div className="hero-carousel" ref={heroCarouselRef} onScroll={onHeroScroll}
        style={{ alignItems: "flex-start", height: heroH ? heroH + 2 : undefined, transition: "height .25s ease" }}>
      {/* ── Carte solde animée ── */}
      <div
        className="hero-card"
        ref={heroCardRefs[0]}
        data-testid="hero-card"
        style={{
          background: "var(--hero-solde, linear-gradient(135deg, #0c1830 0%, #182a48 45%, #101e38 100%))",
          border: "none",
          boxShadow: "0 4px 24px rgba(112,184,224,.2)",
          overflow: "hidden",
          padding: "18px 16px 16px",
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

        {/* v1.59.0 — carte du solde ramassée (variante B validée) : solde + écart vs mois dernier
            (touche → fenêtre « Évolution du solde » avec le graphe des 6 mois), pastilles
            « Ce mois-ci » et « Rapprochement », bascule Solde / Projection. */}
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 18 }}>
            <div className="hero-label" role="button" onClick={() => { if (touchMoved()) return; setBreakdownOpen(true); }}
              style={{ color: "rgba(255,255,255,.72)", fontWeight: 700, flex: 1, minWidth: 0, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Solde bancaire estimé <span style={{ color: "var(--accent)" }}>ⓘ</span>
            </div>
            {heroSwitch(0)}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <div className="hero-value" role="button" data-testid="hero-balance"
              onClick={() => { if (touchMoved()) return; setBreakdownOpen(true); }}
              style={{ color: balanceColor, margin: 0, cursor: "pointer" }}>
              <CountUp target={balance} color={balanceColor} duration={1000} />
            </div>
            {evo.deltaPct !== null && (
              <span role="button" data-testid="hero-delta" onClick={() => { if (touchMoved()) return; setEvoOpen(true); }} style={heroPill(evo.isPos ? "var(--success)" : "var(--danger)", evo.isPos ? "rgba(104,212,152,.12)" : "rgba(200,112,112,.12)")}>
                {evo.isPos ? "▲" : "▼"} {pv(Math.abs(evo.deltaPct))} % vs {evo.todayDay} {evo.prevShort} ›
              </span>
            )}
          </div>

          {/* ── Ce mois-ci : courses, reste à vivre, à recevoir, prévisions, arrondis ── */}
          {(grocery || rest || reimbs.length > 0 || provTotal > 0 || roundStats) && (
            <>
              <div style={heroRowTitle}>Ce mois-ci</div>
              <div data-testid="hero-row-month" style={heroRow}>
                {grocery && (
                  <span role="button" onClick={() => { if (touchMoved()) return; setBreakdownOpen(true); }}
                    style={heroPill(grocery.over > 0 ? "var(--danger)" : "var(--coral)", grocery.over > 0 ? "rgba(200,112,112,.1)" : "rgba(224,136,112,.1)")}>
                    🛒 {grocery.over > 0
                      ? `Budget courses dépassé de ${fmt(grocery.over)}`
                      : grocery.remaining > 0 ? `${fmt(grocery.remaining)} de courses à prévoir` : "Budget courses du mois atteint"}
                  </span>
                )}
                {rest && (
                  <span role="button" onClick={() => { if (touchMoved()) return; setRestOpen(true); }}
                    style={heroPill(rest.perDay >= 0 ? "#5cc8c0" : "var(--danger)", rest.perDay >= 0 ? "rgba(92,200,192,.12)" : "rgba(200,112,112,.1)")}>
                    💶 {fmt(rest.perDay)}/jour {rest.payday ? "jusqu'à la paie" : "jusqu'à fin du mois"}
                  </span>
                )}
                {reimbs.length > 0 && (
                  <span role="button" onClick={() => { if (touchMoved()) return; setReimbOpen(true); }} style={heroPill("#a6e3a1", "rgba(104,212,152,.1)")}>
                    ↩️ {fmt(reimbs.reduce((t, r) => t + (parseFloat(r.amount) || 0), 0))} à recevoir{breakdown.reimbursements.total > 0 ? " · comptés" : ""}{reimbs.some(r => r.late > reimbLateDays) || breakdown.reimbursements.items.some(x => x.late) ? " ⚠️" : ""}
                  </span>
                )}
                {provTotal > 0 && (
                  <span style={heroPill(afterProvColor === "rgba(255,255,255,.75)" ? "var(--warning)" : afterProvColor, "rgba(200,184,96,.08)")}>
                    🔮 {fmt(balanceAfterProv)} après {provisionalExpenses.length} prévision{provisionalExpenses.length > 1 ? "s" : ""}
                  </span>
                )}
                {roundStats && (
                  <span style={heroPill("var(--success)", "rgba(104,212,152,.08)")}>
                    🪙 {fmt(roundStats.month)} d'arrondis · {curY} : {fmt(roundStats.year)}
                  </span>
                )}
                {roundStats && roundStats.pending > 0.005 && (
                  <span role="button" onClick={() => { if (touchMoved()) return; onMarkRoundingTransferred?.(); }} style={heroPill("var(--warning)", "rgba(200,184,96,.12)")}>
                    🪙 {fmt(roundStats.pending)} à virer · marquer viré ›
                  </span>
                )}
              </div>
            </>
          )}

          {/* ── Rapprochement : pointé, en attente, porte-monnaie (TR…) ── */}
          {(() => { const w = computeWallets(data.sideAmountTypes, data.offAccountEntries, transactions, curM)[0]; return (
            <>
              <div style={{ ...heroRowTitle, display: "flex" }}>
                <span style={{ flex: 1 }}>Rapprochement</span>
                {totalPointable > 0 && <span style={{ letterSpacing: 0, color: nbPointed === totalPointable ? "var(--success)" : "rgba(255,255,255,.55)" }}>{nbPointed === totalPointable ? "✓ Complet" : `${nbPointed}/${totalPointable}`}</span>}
              </div>
              <div data-testid="hero-row-rec" style={heroRow}>
                <span role="button" onClick={() => onGoToHistorique?.("pointed")} title={`${nbPointed} op. confirmées`} style={heroPill("var(--success)", "rgba(104,212,152,.1)")}>
                  ✓ {soldePointe >= 0 ? "+" : ""}{fmt(soldePointe)} pointé ›
                </span>
                <span role="button" onClick={() => onGoToHistorique?.("unpointed")} title={`${totalPointable - nbPointed} op. restantes`} style={heroPill("var(--warning)", "rgba(200,184,96,.1)")}>
                  ⏳ {soldeAttente >= 0 ? "+" : ""}{fmt(soldeAttente)} en attente ›
                </span>
                {w && (
                  <span role="button" onClick={() => setWalletOpen(true)} style={heroPill("var(--tr, var(--warning))", "rgba(200,184,96,.06)")}>
                    {w.st.icon} {fmt(w.balance)} {w.st.id === "tr" ? "TR" : w.st.label} ›
                  </span>
                )}
              </div>
              {totalPointable > 0 && (
                <div style={{ height: 5, background: "rgba(255,255,255,.1)", borderRadius: 99, overflow: "hidden", marginTop: 14 }}>
                  <div data-pv="" style={{ width: `${(nbPointed / totalPointable) * 100}%`, height: "100%", background: "linear-gradient(90deg, var(--success), var(--accent))", borderRadius: 99, transition: "width .4s ease" }} />
                </div>
              )}
            </>
          ); })()}
        </div>
      </div>

      {/* ── Carte Projection (médiane des dépenses courantes) ── */}
      <div className="hero-card" ref={heroCardRefs[1]} style={{
        background: "var(--hero-proj, linear-gradient(135deg, #101f18 0%, #16321f 45%, #0e1e18 100%))",
        border: "none", boxShadow: "0 4px 24px rgba(104,212,152,.15)",
        overflow: "hidden", padding: "18px 16px 16px",
      }}>
        <div style={{
          position: "absolute", top: -30, right: -30, width: 130, height: 130,
          borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(104,212,152,.18) 0%, transparent 70%)",
        }} />
        <div className="hero-label" style={{ color: "rgba(255,255,255,.72)", fontWeight: 700, position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1, cursor: simOn ? "default" : "pointer" }} onClick={() => { if (!simOn) setProjInfo(v => !v); }}>{simOn ? "Projection à 6 mois" : "Projection à 3 mois"}{!simOn && <span style={{ color: "var(--accent)" }}> ⓘ</span>}</span>
          {simOn && <span style={{ fontSize: ".56rem", fontWeight: 800, color: "var(--purple)", border: "1px solid rgba(176,144,224,.5)", background: "rgba(176,144,224,.12)", borderRadius: 10, padding: "2px 8px", letterSpacing: 0, textTransform: "none" }}>🧪 simulation</span>}
          <span style={{ letterSpacing: 0, textTransform: "none" }}>{heroSwitch(1)}</span>
        </div>

        {simOn && (
          <SimulationBlock baseMonths={projection6.months} startBalance={balance} scenarios={simScenarios}
            margin={Math.max(0, parseFloat(data.restSettings?.margin) || 0)}
            onEdit={() => setSimSheet(true)} onQuit={() => { setSimOn(false); setSimScenarios([]); }} />
        )}
        {!simOn && (() => {
          // v1.62.0 — projection jour par jour (computeProjection) : point bas réel
          // (souvent la veille de la paie) + fourchette, courbe quotidienne avec fins
          // de mois (touche un point → détail ligne par ligne), fiabilité à 1 mois.
          const P = projection;
          if (!P.months.length || !P.low) return null;
          const th  = alertEnabled && alertThreshold > 0 ? alertThreshold : null;
          const lvl = v => v < 0 ? "#c87070" : th != null && v < th ? "#c8b860" : "#68d498";
          const MF = MONTHS_FR.map(m => m.toLowerCase());
          const MA = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
          const dLabel = iso => `${parseInt(iso.slice(8, 10), 10)} ${MA[parseInt(iso.slice(5, 7), 10) - 1]}`;
          const n0 = v => isPrivacy() ? MASK + " €" : `${v < 0 ? "−" : ""}${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.abs(v))} €`;
          const days = P.days;
          const ends = [{ ym: P.current.ym, label: P.current.label, value: P.current.value, isCur: true }, ...P.months];
          const endIdx = e => days.findIndex(d => d.date.slice(0, 7) === e.ym && d.date === days.filter(x => x.date.slice(0, 7) === e.ym).pop()?.date);
          const W = 340, H = 104, padL = 14, padR = 14;
          const vals = days.map(d => d.balance).concat(th != null ? [th] : []).concat(P.months.flatMap(m => m.range ? [m.range.low, m.range.high] : []));
          const rawMx = Math.max(...vals), rawMn = Math.min(...vals), rng = Math.max(rawMx - rawMn, Math.abs(rawMx) * .05, 50);
          const mx = rawMx + rng * .18, mn = rawMn - rng * .12, span = mx - mn;
          const X = k => padL + k * (W - padL - padR) / Math.max(1, days.length - 1);
          const Y = v => H - 16 - (v - mn) / span * (H - 32);
          const line = days.map((d, k) => `${X(k).toFixed(1)},${Y(d.balance).toFixed(1)}`).join(" ");
          const ranged = P.months.filter(m => m.range);
          const band = ranged.length ? (() => {
            const pts = [{ k: 0, lo: days[0].balance, hi: days[0].balance }, { k: endIdx(ends[0]), lo: P.current.value, hi: P.current.value },
              ...P.months.map(m => ({ k: endIdx(m), lo: m.range?.low ?? m.value, hi: m.range?.high ?? m.value }))];
            return pts.map(p => `${X(p.k)},${Y(p.hi)}`).join(" ") + " " + [...pts].reverse().map(p => `${X(p.k)},${Y(p.lo)}`).join(" ");
          })() : null;
          const lowK = days.findIndex(d => d.date === P.low.date);
          const acc = projectionAccuracy;
          const pill = (col, bg) => ({ ...heroPill(col, bg), marginRight: 0 });
          const sel = ends.find(e => e.ym === projSel);
          return (
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <span data-testid="proj-low" style={{ fontFamily: "var(--mono)", fontSize: "1.75rem", fontWeight: 800, color: lvl(P.low.balance), fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em" }}>{fmt(P.low.balance)}</span>
                <span style={{ fontSize: ".64rem", color: "rgba(255,255,255,.65)" }}>au plus bas, le {dLabel(P.low.date)}{P.low.beforePay ? " · juste avant la paie" : ""}</span>
              </div>
              <div data-testid="proj-range" style={{ fontSize: ".6rem", color: "rgba(255,255,255,.5)", marginTop: 2 }}>
                {P.low.range
                  ? <>Fourchette selon tes {P.historyMonths} derniers mois : <b style={{ color: "rgba(255,255,255,.8)" }}>{fmt(Math.min(P.low.range.low, P.low.range.high))} à {fmt(Math.max(P.low.range.low, P.low.range.high))}</b></>
                  : <>Fourchette disponible après 3 mois complets d'historique</>}
              </div>
              {projInfo && (
                <div style={{ fontSize: ".6rem", color: "rgba(255,255,255,.55)", lineHeight: 1.5, margin: "6px 0 2px" }}>
                  Calcul jour par jour : ton solde estimé d'aujourd'hui, le reste de tes dépenses courantes de {MF[parseInt(P.current.ym.slice(5, 7), 10) - 1]}, puis chaque mois tes revenus et frais fixes à leur jour, tes récurrentes (annuelles comprises) et programmées, et tes dépenses courantes habituelles (médiane de tes {P.historyMonths || 0} derniers mois complets) réparties sur le mois. Touche un point de la courbe pour voir le détail. Ne peut pas deviner un imprévu.
                </div>
              )}
              <svg data-pv="" data-testid="proj-curve" viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block", marginTop: 6, overflow: "visible" }}>
                {band && <polygon points={band} fill="rgba(104,212,152,.10)" />}
                {th != null && <>
                  <line x1="0" x2={W} y1={Y(th)} y2={Y(th)} stroke="#c8b860" strokeDasharray="4 4" strokeWidth="1" opacity=".7" />
                  <text x={2} y={Y(th) + 11} fill="#c8b860" fontSize="8.5" textAnchor="start" opacity=".9">seuil {n0(th)}</text>
                </>}
                <polyline points={line} fill="none" stroke="#68d498" strokeWidth="2" strokeLinejoin="round" />
                {lowK >= 0 && <circle cx={X(lowK)} cy={Y(P.low.balance)} r="6" fill="none" stroke={lvl(P.low.balance)} strokeWidth="1.5" />}
                <circle cx={X(0)} cy={Y(days[0].balance)} r="3.5" fill="#70b8e0" stroke="#0e1e18" strokeWidth="2" />
                {ends.map(e => {
                  const k = endIdx(e); if (k < 0) return null;
                  const on = projSel === e.ym;
                  return (
                    <g key={e.ym} data-testid={`proj-pt-${e.ym}`} onClick={() => setProjSel(on ? null : e.ym)} style={{ cursor: "pointer" }}>
                      <rect x={X(k) - 22} y="0" width="44" height={H} fill="transparent" />
                      <circle cx={X(k)} cy={Y(e.value)} r={on ? 5.5 : 4.5} fill={lvl(e.value)} stroke={on ? "#fff" : "#0e1e18"} strokeWidth="2" />
                      <text x={Math.min(W - 16, Math.max(16, X(k)))} y={Y(e.value) - 9} fill={lvl(e.value)} fontSize="10" fontWeight="800" textAnchor="middle">{n0(e.value)}</text>
                      <text x={Math.min(W - 12, Math.max(12, X(k)))} y={H - 2} fill={on ? "#fff" : "rgba(255,255,255,.55)"} fontSize="9" fontWeight="700" textAnchor="middle">{e.isCur ? `fin ${e.label}` : e.label}</text>
                    </g>
                  );
                })}
              </svg>
              {!sel && <div style={{ fontSize: ".54rem", color: "rgba(255,255,255,.4)", textAlign: "center", marginTop: 2 }}>Touche une fin de mois pour voir son détail</div>}

              {sel && (
                <div data-testid="proj-detail" style={{ marginTop: 8, padding: "9px 11px", borderRadius: 11, background: "rgba(0,0,0,.22)", border: "1px solid rgba(255,255,255,.1)" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 5 }}>
                    <b style={{ flex: 1, fontSize: ".7rem" }}>{MONTHS_FR[parseInt(sel.ym.slice(5, 7), 10) - 1]} {sel.ym.slice(0, 4)}</b>
                    <span onClick={() => setProjSel(null)} style={{ cursor: "pointer", color: "rgba(255,255,255,.5)", fontSize: ".7rem" }}>✕</span>
                  </div>
                  {(() => {
                    const row = (k, l, v, sub, strong) => (
                      <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "3px 0", fontSize: ".62rem", borderTop: strong ? "1px solid rgba(255,255,255,.15)" : "none", marginTop: strong ? 3 : 0 }}>
                        <span style={{ flex: 1, minWidth: 0, color: strong ? "#fff" : "rgba(255,255,255,.75)", fontWeight: strong ? 800 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}{sub && <span style={{ color: "rgba(255,255,255,.4)" }}> · {sub}</span>}</span>
                        <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: strong ? lvl(v) : v >= 0 ? "#68d498" : "#e08870", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{!strong && v >= 0 ? "+" : ""}{fmt(v)}</span>
                      </div>
                    );
                    if (sel.isCur) return <>
                      {row("s", "Solde estimé aujourd'hui", P.start, "fixes, récurrentes et programmées du mois déjà comptés", true)}
                      {row("v", "🛒 Dépenses courantes restantes (estimation)", P.current.remainingVariable, P.current.remainingVariable === 0 ? "déjà au niveau habituel" : `habituel ${fmt(P.variableNetMedian)}, déjà ${fmt(P.current.soFarVariable)}`)}
                      {row("e", `= Fin ${sel.label}`, sel.value, null, true)}
                    </>;
                    const lines = [...sel.lines].sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
                    return <>
                      {row("s", "Solde de départ", sel.start, `fin du mois précédent`, true)}
                      {lines.map((l, k) => row(k, `${l.icon} ${l.label}`, l.amount, `le ${parseInt(l.date.slice(8, 10), 10)}${l.yearly ? " · annuelle" : ""}`))}
                      {row("v", "🛒 Dépenses courantes (estimation)", sel.variable, `médiane de ${P.historyMonths} mois`)}
                      {row("e", "= Fin de mois", sel.value, sel.range ? `fourchette ${n0(Math.min(sel.range.low, sel.range.high))} à ${n0(Math.max(sel.range.low, sel.range.high))}` : null, true)}
                    </>;
                  })()}
                </div>
              )}

              {(P.thresholdBreachMonth || P.biggestSchedItem || P.low.balance < 0) && (
                <>
                  <div style={heroRowTitle}>Points d'attention</div>
                  <div data-testid="proj-row-alert" style={heroRow}>
                    {P.low.balance < 0 && <span style={pill("#c87070", "rgba(200,112,112,.12)")}>🚨 Découvert possible le {dLabel(P.low.date)}</span>}
                    {P.thresholdBreachMonth && P.low.balance >= 0 && (
                      <span style={pill("#c87070", "rgba(200,112,112,.12)")}>⚠️ Sous ton seuil ({fmt(alertThreshold)}) dès le {dLabel(P.thresholdBreachMonth.date)}</span>
                    )}
                    {P.biggestSchedItem && (
                      <span style={pill("#c8b860", "rgba(200,184,96,.1)")}>📅 {P.biggestSchedItem.note || "Programmée"} −{fmt(P.biggestSchedItem.amount)} le {dLabel(P.biggestSchedItem.date)}</span>
                    )}
                  </div>
                </>
              )}

              <div style={heroRowTitle}>Hypothèses</div>
              <div data-testid="proj-row-hyp" style={heroRow}>
                <span style={pill(P.variableNetMedian >= 0 ? "#68d498" : "#e08870", "rgba(104,212,152,.08)")}>
                  〰 Courant hors fixes {P.variableNetMedian >= 0 ? "+" : ""}{fmt(P.variableNetMedian)}/mois{P.historyMonths ? ` (${P.historyMonths} mois)` : ""}
                </span>
                {acc.n > 0 ? (
                  <span role="button" data-testid="proj-acc" onClick={() => setAccOpen(o => !o)} style={pill("#70b8e0", "rgba(112,184,224,.1)")}>
                    🎯 Erreur moyenne ±{fmt(acc.avgAbs)}{Math.abs(acc.avgSigned) >= 10 ? (acc.avgSigned < 0 ? " · plutôt optimiste" : " · plutôt prudente") : ""} {accOpen ? "▴" : "›"}
                  </span>
                ) : (
                  <span data-testid="proj-acc" style={{ ...pill("rgba(255,255,255,.55)", "rgba(255,255,255,.04)"), cursor: "default" }}>🎯 Fiabilité mesurée dès fin {MF[parseInt(P.months[0].ym.slice(5, 7), 10) - 1]}</span>
                )}
                <span role="button" data-testid="proj-sim" onClick={() => setSimSheet(true)} style={pill("#b090e0", "rgba(176,144,224,.12)")}>🧪 Et si… ? ›</span>
              </div>
              {accOpen && acc.n > 0 && (
                <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 10, background: "rgba(0,0,0,.2)", border: "1px solid rgba(255,255,255,.08)" }}>
                  <div style={{ fontSize: ".56rem", color: "rgba(255,255,255,.5)", marginBottom: 4 }}>Fin de mois annoncée le mois d'avant, comparée à la réalité :</div>
                  {acc.items.slice(0, 6).map(a => (
                    <div key={a.ym} style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: ".6rem", padding: "3px 0", color: "rgba(255,255,255,.65)", fontVariantNumeric: "tabular-nums" }}>
                      <span>{MONTHS_FR[parseInt(a.ym.slice(5, 7), 10) - 1]}</span>
                      <span>Prévu {fmt(a.predicted)} → Réel {fmt(a.actual)}</span>
                      <span style={{ fontWeight: 800, color: Math.abs(a.delta) <= 50 ? "var(--success)" : Math.abs(a.delta) <= 150 ? "var(--warning)" : "var(--danger)" }}>{a.delta >= 0 ? "+" : ""}{fmt(a.delta)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
      </div>
      {simSheet && (
        <SimulationSheet months={projection6.months} scenarios={simScenarios} onChange={setSimScenarios}
          onApply={list => { setSimScenarios(list); setSimOn(list.length > 0); setSimSheet(false); }}
          onClose={() => { setSimSheet(false); if (!simScenarios.length) setSimOn(false); }} />
      )}

      <div style={{ height: 4 }} />

      {/* v1.59.0 : fenêtre « Évolution du solde » (le graphe des 6 mois quitte la carte) */}
      {evoOpen && (
        <Modal onClose={() => setEvoOpen(false)} title="">
          <div data-testid="evo-modal">
            <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
              <div className="modal-title" style={{ marginBottom: 0, flex: 1 }}>📈 Évolution du solde</div>
              <button onClick={() => setEvoOpen(false)} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "var(--text2)", cursor: "pointer", fontSize: ".75rem" }}>✕</button>
            </div>
            <div style={{ fontSize: ".72rem", color: "var(--text2)", lineHeight: 1.6 }}>
              Aujourd'hui <b style={{ color: "var(--text)" }}>{fmt(balance)}</b> · le {evo.todayDay} {evo.prevShort} <b style={{ color: "var(--text)" }}>{fmt(evo.balPrev)}</b><br />
              <b style={{ color: evo.isPos ? "var(--success)" : "var(--danger)" }}>{evo.deltaAbs >= 0 ? "+" : "−"}{fmt(Math.abs(evo.deltaAbs))}{evo.deltaPct !== null ? ` (${evo.deltaAbs >= 0 ? "+" : "−"}${pv(Math.abs(evo.deltaPct))} %)` : ""}</b> en un mois
            </div>
            {(() => {
              const sd = evo.sparkData, mx = Math.max(...sd.map(b => Math.abs(b.val)), 1);
              const n0 = v => isPrivacy() ? MASK : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.abs(v));
              return (
                <>
                  <div style={{ fontSize: ".58rem", color: "var(--text3)", margin: "12px 0 6px" }}>Solde au {evo.todayDay} de chaque mois</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
                    {sd.map((b, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-end", height: 120 }}>
                        <div data-pv="" style={{ width: "100%", height: Math.max(3, Math.abs(b.val) / mx * 116), borderRadius: 4,
                          background: b.isLast ? "var(--accent)" : b.val >= 0 ? "rgba(104,212,152,.55)" : "rgba(200,112,112,.5)" }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    {sd.map((b, i) => (
                      <div key={i} style={{ flex: 1, textAlign: "center", fontSize: ".56rem", lineHeight: 1.35, color: b.isLast ? "var(--accent)" : "var(--text3)", fontWeight: b.isLast ? 800 : 500 }}>
                        {b.mois}<br /><span style={{ fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>{b.val < 0 ? "−" : ""}{n0(b.val)} €</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 5, marginTop: 12, flexWrap: "wrap" }}>
                    {sd.slice(1).map((b, i) => {
                      const d = b.val - sd[i].val;
                      return (
                        <span key={i} style={{ flex: "1 1 0", minWidth: 0, textAlign: "center", fontSize: ".56rem", padding: "4px 2px", borderRadius: 7, background: "var(--surface2)", color: d >= 0 ? "var(--success)" : "var(--danger)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                          {b.mois} {d >= 0 ? "+" : "−"}{n0(d)} €
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 8 }}>Variation d'un mois sur l'autre, au même jour du mois.</div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {hasTodo && secTitle("À traiter", "sec-todo")}

      {/* ── 💡 Surplus de fin de cycle → cagnotte (v1.50.0) ── */}
      {surplus?.show && (
        <SurplusCard key={surplus.cycleEnd + surplus.amount} surplus={surplus} cagnottes={cagnottes} cagTypes={data.cagTypes}
          onDetail={() => setSurplusSheet(true)}
          onDismiss={() => onDismissInsight?.("surplus", surplus.cycleEnd)}
          onSave={(cagId, amount) => onSaveSurplus?.(cagId, amount, surplus.cycleEnd)} />
      )}
      {surplusSheet && surplus && <SurplusSheet surplus={surplus} onClose={() => setSurplusSheet(false)} />}

      {/* ── 🧾 Chèques non encaissés (v1.43.0) — n'apparaît que s'il y en a ── */}
      {(() => {
        const pend = pendingCheques(transactions);
        if (pend.length === 0) return null;
        const total = pend.reduce((s, c) => s + (parseFloat(c.t.amount) || 0), 0);
        const oldest = pend[0];
        const alertCol = oldest.level === "expired" || oldest.level === "veryold" ? "var(--danger)" : oldest.level === "old" ? "var(--warning)" : "var(--text2)";
        return (
          <div data-testid="card-cheques" onClick={() => setChequesOpen(true)} style={{
            display: "flex", alignItems: "center", gap: 10, margin: "0 0 7px", padding: "10px 12px", borderRadius: 16,
            ...tintCard(CARD_COL.chq), cursor: "pointer",
          }}>
            <span style={{ fontSize: "1.1rem" }}>🧾</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: ".7rem", fontWeight: 800, color: CARD_COL.chq }}>
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

      {/* v1.59.0 : « À venir » juste sous la carte chèque */}
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

            {/* Carte déclencheur — état fermé, inchangée visuellement */}
            <div data-testid="card-upcoming" onClick={()=>setOpenUpcoming(true)} style={{ overflow:"hidden", borderRadius:16, background:"var(--surface)", border:"1px solid var(--border)", position:"relative", marginBottom:7, cursor:"pointer", userSelect:"none" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px 3px", position:"relative", zIndex:2 }}>
                <span style={{ fontSize:"1.05rem" }}>⏳</span>
                <span style={{ fontSize:".68rem", fontWeight:800, color:C, textTransform:"uppercase", letterSpacing:".08em", flex:1 }}>À venir</span>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  {recurItems.length>0 && <span style={{ fontSize:".58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(220,228,240,.10)", color:C, border:`1px solid ${Cbord}` }}>🔄 {recurItems.length}</span>}
                  {fixItems.length>0   && <span style={{ fontSize:".58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(90,184,224,.10)", color:"var(--accent)", border:"1px solid rgba(90,184,224,.2)" }}>↻ {fixItems.length}</span>}
                  {incItems.length>0   && <span style={{ fontSize:".58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(104,212,152,.10)", color:"var(--success)", border:"1px solid rgba(104,212,152,.2)" }}>💰 {incItems.length}</span>}
                  {schedItems.length>0 && <span style={{ fontSize:".58rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(200,184,96,.10)", color:"var(--warning)", border:"1px solid rgba(200,184,96,.2)" }}>📅 {schedItems.length}</span>}
                </div>
                <span style={{ color:C, fontSize:".8rem", opacity:.7 }}>›</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:8, padding:"0 12px 10px", position:"relative", zIndex:2 }}>
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

                {/* v1.48.0 : Liste (par défaut) / Calendrier & solde */}
                <div style={{ display: "flex", gap: 4, background: "var(--surface2)", padding: 3, borderRadius: 12, border: "1px solid var(--border-soft)", marginBottom: 12 }}>
                  {[["list", "📋 Liste"], ["cal", "📅 Calendrier & solde"]].map(([k, l]) => (
                    <button key={k} onClick={() => setAvTab(k)} style={{ flex: 1, padding: "7px 2px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: ".66rem", fontWeight: 700,
                      background: avTab === k ? "rgba(112,184,224,.16)" : "transparent", color: avTab === k ? "var(--accent)" : "var(--text2)" }}>{l}</button>
                  ))}
                </div>
                {avTab === "cal" ? <ForecastPanel forecast={forecast} /> : <>
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
                    <button onClick={()=>unpointedVisibleFixes.forEach(f=>(f._type==="fixIncome" ? onTogglePointIncome : onTogglePointFix)?.(f.id, f._ym || curM))} style={{ padding:"6px 12px", borderRadius:20, background:"rgba(104,212,152,.15)", border:"1px solid rgba(104,212,152,.4)", color:"var(--success)", fontSize:".64rem", fontWeight:800, cursor:"pointer" }}>✓ Tout pointer</button>
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
                    // v1.48.0 : date de prélèvement quand elle est connue
                    const recDay = isRec ? (breakdown.recurring.items.find(x => x.tpl.id === item.id)?.day || null) : null;
                    const dayLbl = (isFix||isInc) && item.day ? `le ${resolveFixedDay(item.day, curM)}` : recDay ? `le ${recDay}` : null;
                    const sub=(isFix||isInc)?`${dayLbl ? dayLbl + " · " : "Ce mois · "}non pointé`:isRec?`${dayLbl ? dayLbl + " · " : "Ce mois · "}${item.frequency==="yearly"?"annuelle":"mensuelle"}`:new Date(item.date).toLocaleDateString("fr-FR",{day:"numeric",month:"long"});
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
                              {isInc && <button onClick={()=>onTogglePointIncome?.(item.id, item._ym || curM)} title="Marquer comme pointé" style={{ width:22, height:22, borderRadius:"50%", background:"transparent", border:"2px solid var(--border)", color:"var(--text3)", fontSize:".6rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, fontWeight:900 }}></button>}
                              {isRec && <button onTouchEnd={e=>{e.stopPropagation();if (touchMoved()) return; e.preventDefault();onConfirmRecurring?.(item,curM);}} onClick={()=>onConfirmRecurring?.(item,curM)} style={{ width:22, height:22, borderRadius:"50%", background:"rgba(220,228,240,.12)", border:`1px solid ${Cbord}`, color:C, fontSize:".6rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, fontWeight:900 }}>✓</button>}
                              {isSch && <button onTouchEnd={e=>{e.stopPropagation();if (touchMoved()) return; e.preventDefault();setDeleteConfirm(item.id);}} onClick={()=>setDeleteConfirm(item.id)} style={{ width:22, height:22, borderRadius:"50%", background:"transparent", border:"1px solid rgba(255,255,255,.25)", color:"var(--text2)", fontSize:".6rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>✕</button>}
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
                </>}
              </Modal>
            )}
          </>
        );
      })()}

      {/* ── 🐷 Cagnottes + 📌 Fixes ── v1.49.0 : cartes sur une ligne ;
           le taux d'épargne du mois est affiché dans le détail (tap). */}
      <Sec id="cagnottes_fixes">
      {secTitle("Patrimoine", "sec-patrimoine")}
      <div className="grid-2" style={{ marginBottom: 6, gap: 6 }}>
        <div className="stat-mini" data-testid="card-cagnottes" style={{ padding: "10px 11px", display: "flex", alignItems: "center", gap: 9, borderRadius: 16, ...tintCard(CARD_COL.cag) }}
          onClick={() => {
            const rate     = curMonth.inc > 0 ? Math.round((savMonth / curMonth.inc) * 100) : null;
            const prevRate = prevMonth.inc > 0 ? Math.round((prevSavMonth / prevMonth.inc) * 100) : null;
            onShowDetail("cagnottes", "all", { rate, prevRate });
          }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stat-label" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: ".03em", color: CARD_COL.cag }}>🐷 Cagnottes</div>
            <div className="stat-val" style={{ margin: "2px 0 0", color: CARD_COL.cag, whiteSpace: "nowrap" }}>{fmt(cagTotal)}</div>
          </div>
        </div>
        <div className="stat-mini" data-testid="card-fixes" style={{ padding: "10px 11px", display: "flex", alignItems: "center", gap: 9, borderRadius: 16, ...tintCard(CARD_COL.fix), cursor: "default" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stat-label" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: ".03em", color: CARD_COL.fix }}>📌 Fixes / mois</div>
            <div className="stat-val" style={{ margin: "2px 0 0", color: CARD_COL.fix, whiteSpace: "nowrap" }}>{fmt(tf)}</div>
          </div>
        </div>
      </div>
      </Sec>


      {/* ── À venir ── v1.39.8 : ouvre un modal au lieu d'un dépliant inline */}
      {restOpen && rest && <RestToLiveSheet rest={rest} onClose={() => setRestOpen(false)} />}
      {reimbOpen && (
        <ReimbursementsSheet items={reimbs} onClose={() => setReimbOpen(false)}
          onOpen={r => { setReimbOpen(false); onOpenReimbursement?.(r); }}
          onAdd={() => { setReimbOpen(false); onOpenReimbursement?.(null); }} />
      )}
      {breakdownOpen && (
        <BalanceBreakdownSheet breakdown={breakdown} grocery={grocery} categories={data.categories || []} cagnottes={cagnottes}
          onClose={() => setBreakdownOpen(false)} />
      )}

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
                <span style={{ flex: 1 }}>Budget <b>{tag.icon} {tag.name}</b> {level === "over" ? "dépassé" : `à ${pv(Math.round(pct))} %`}</span>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: level === "over" ? "var(--danger)" : "var(--warning)" }}>{fmt(spent)} / {fmt(budget)}</span>
              </div>
            ))}
          </div>
        );
      })()}


      {/* ── 📊 Bilan ── v1.49.0 : « Mois en cours » + « Année en cours » fusionnés,
           sélecteur Mois | Année (revient toujours sur le mois à l'ouverture). */}
      <Sec id="mois">
      {secTitle("Résultats", "sec-resultats")}
      {(() => {
        const isM = bilanPer === "month";
        const B = isM
          ? { inc: curMonth.inc, pInc: prevMonth.inc, exp: curMonth.exp, pExp: prevMonth.exp,
              sav: savMonth, pSav: prevSavMonth, dec: curMonth.decag, var: curMonth.expVar, pVar: prevMonth.expVar }
          : { inc: yInc, pInc: pyStats.inc, exp: yExp, pExp: pyStats.exp,
              sav: ySav, pSav: pyStats.sav ?? 0, dec: yDecag, var: yExpVar, pVar: pyStats.expVar };
        const per = isM ? "month" : "year";
        const now = new Date();
        const cell = (extra) => ({ padding: "10px 11px", position: "relative", cursor: "pointer", minWidth: 0, ...extra });
        const lab  = color => ({ fontSize: ".56rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color });
        const val  = color => ({ fontFamily: "var(--mono)", fontSize: ".98rem", fontWeight: 800, marginTop: 3, color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });
        const arrow = <span className="stat-arrow">›</span>;
        return (
          <div className="card" data-testid="card-bilan" style={{ padding: "10px 11px", overflow: "hidden", marginBottom: 12, borderRadius: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>📊</span>
              <span style={{ flex: 1, fontWeight: 800, fontSize: ".64rem", letterSpacing: ".08em", textTransform: "uppercase" }}>Bilan</span>
              <div style={{ display: "flex", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 11, padding: 3, gap: 2, width: 160 }}>
                {[["month", MONTHS_FR[now.getMonth()]], ["year", String(now.getFullYear())]].map(([k, l]) => (
                  <button key={k} onClick={() => setBilanPer(k)}
                    style={{ flex: 1, border: "none", borderRadius: 8, padding: "5px 0", fontSize: ".64rem", fontWeight: 800, cursor: "pointer",
                      background: bilanPer === k ? "var(--seg-on-bg, var(--accent))" : "transparent", color: bilanPer === k ? "var(--seg-on-text, #06121c)" : "var(--text2)" }}>{l}</button>
                ))}
              </div>
            </div>
            {/* v1.73.0 : 4 tuiles teintées (comme le mockup), mêmes chiffres et mêmes détails au toucher */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginTop: 9 }}>
              {[
                { k: "inc", col: "var(--success)", lbl: "💰 Revenus", v: B.inc, d: <Delta cur={B.inc} prev={B.pInc} />, on: () => onShowDetail("income", per) },
                { k: "exp", col: "var(--danger)",  lbl: "💸 Dépenses", v: B.exp, d: <Delta cur={B.exp} prev={B.pExp} inverted />, on: () => onShowDetail("expense", per) },
                { k: "sav", col: "var(--purple)",  lbl: "🐷 Épargné", v: B.sav, d: <><Delta cur={B.sav} prev={B.pSav} />{B.dec > 0 && <span style={{ fontSize: ".54rem", fontWeight: 700, color: "var(--coral)", fontVariantNumeric: "tabular-nums" }}>↩️ {fmt(B.dec)} retiré</span>}</>, on: () => setCagSheet(per) },
                { k: "var", col: "var(--accent)",  lbl: "📊 Dép. variables", v: B.var, d: <Delta cur={B.var} prev={B.pVar} inverted />, on: () => onShowDetail("expense_var", per) },
              ].map(t => (
                <div key={t.k} data-bilan={t.k} onClick={t.on} style={cell({ borderRadius: 12, padding: "7px 9px", background: `color-mix(in srgb, ${t.col} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${t.col} 30%, transparent)` })}>
                  <div style={lab(t.col)}>{t.lbl}</div>
                  <div style={val(t.col)}>{fmt(t.v)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>{t.d}</div>
                  {arrow}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      </Sec>

      {/* ── Récap cagnotte ── */}
      {cagSheet && (
        <div style={{ position:"fixed", inset:0, background:"rgba(6,8,16,.75)", backdropFilter:"blur(5px)", zIndex:200, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}
          onClick={() => setCagSheet(null)}>
          <div style={{ background: "var(--panel-solid, var(--surface))", borderRadius:"18px 18px 0 0", border:"1px solid var(--border)", padding:"16px 16px 32px" }}
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
