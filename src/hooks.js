import { useMemo } from "react";
import { currentYM, isIncome, recurringRefDate, chequeExpiryISO, daysBetweenISO, todayISO } from "./utils.js";

// ─────────────────────────────────────────────────────────────────
//  Helper : montant effectif des frais fixes pour un mois donné
//  Tient compte des monthlyOverrides (modifications ponctuelles
//  depuis l'Historique qui n'impactent que ce mois).
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
//  isActiveForMonth — un frais/revenu fixe est actif pour un mois donné
//  si : il a démarré (startYM) ET il n'est pas en pause ce mois-là
//  (paused + pausedUntil optionnel pour une reprise automatique).
//  Source unique utilisée PARTOUT où un frais/revenu fixe est filtré
//  par mois, pour que "démarrage" et "pause" soient toujours respectés
//  de façon cohérente (accueil, historique, rapport, popups…).
// ─────────────────────────────────────────────────────────────────
export function isActiveForMonth(f, ym) {
  if (f.startYM && ym < f.startYM) return false;
  // Pauses terminées (v1.45.1) : restent exclues après réactivation
  if (f.pauseHistory?.some(p => ym >= p.from && ym <= p.until)) return false;
  if (f.paused) {
    // La pause ne s'applique qu'à partir du mois où elle a été activée
    // (pausedFrom) — jamais rétroactivement sur les mois déjà passés,
    // qui doivent rester tels qu'ils ont réellement eu lieu.
    const from  = f.pausedFrom  || "0000-00";
    const until = f.pausedUntil || "9999-99";
    if (ym >= from && ym <= until) return false;
  }
  return true;
}

export function effectiveFixesForMonth(fixedExpenses, ym) {
  return fixedExpenses.reduce((s, f) => {
    if (!isActiveForMonth(f, ym)) return s;
    const ov = f.monthlyOverrides?.[ym];
    return s + ((ov?.amount ?? f.amount) || 0);
  }, 0);
}

export function effectiveIncomesForMonth(fixedIncomes, ym) {
  // v1.50.0 : respecte la correction ponctuelle d'un mois (monthlyOverrides),
  // comme effectiveFixesForMonth — déjà le cas dans le rapprochement et la projection.
  return (fixedIncomes || []).reduce((s, f) => {
    if (!isActiveForMonth(f, ym)) return s;
    return s + (parseFloat(f.monthlyOverrides?.[ym]?.amount ?? f.amount) || 0);
  }, 0);
}

// ─────────────────────────────────────────────────────────────────
//  Helper : liste des mois entre deux YYYY-MM (inclus)
// ─────────────────────────────────────────────────────────────────
function monthRange(startYM, endYM) {
  const list = [];
  let [y, m] = startYM.split("-").map(Number);
  const [ey, em] = endYM.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    list.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return list;
}

// ─────────────────────────────────────────────────────────────────
//  Primitive hook: total frais fixes (montant de base, sans override)
//  Utilisé uniquement pour l'affichage de la card récap Fixes.
// ─────────────────────────────────────────────────────────────────
export function useTotalFixes(fixedExpenses, ym = null) {
  return useMemo(
    () => fixedExpenses
      .filter(f => !ym || isActiveForMonth(f, ym))
      .reduce((s, f) => {
        const ov = ym ? f.monthlyOverrides?.[ym] : null;
        return s + ((ov?.amount ?? f.amount) || 0);
      }, 0),
    [fixedExpenses, ym]
  );
}

// ─────────────────────────────────────────────────────────────────
//  Single-month stats
//  Returns { inc, exp, expVar, decag, net }
// ─────────────────────────────────────────────────────────────────
export function useMonthStats(transactions, fixedExpenses, ym, fixedIncomes) {
  // v1.47.1 : même calcul pour tous les mois (computeMonthTotals) — avant,
  // les frais fixes n'étaient comptés que pour le mois en cours et les
  // revenus fixes jamais → comparaisons faussées (« Dépenses ▲ 117 % »).
  return useMemo(() => computeMonthTotals(transactions, fixedExpenses, fixedIncomes, ym),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [transactions, fixedExpenses, fixedIncomes, ym]);
}

// ─────────────────────────────────────────────────────────────────
//  12-month array for a given year
// ─────────────────────────────────────────────────────────────────
export function useYearMonths(transactions, fixedExpenses, year, fixedIncomes = []) {
  // v1.47.1 : revenus fixes inclus ; aucun mois avant la 1ʳᵉ opération
  // (hasData = false → grisé / exclu du classement), aucun mois futur.
  return useMemo(() => {
    const MONTHS_SHORT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
    const MONTHS_MINI  = ["J","F","M","A","M","J","J","A","S","O","N","D"];
    const first = firstDataYM(transactions);
    return Array.from({ length: 12 }, (_, i) => {
      const mStr = `${year}-${(i + 1).toString().padStart(2, "0")}`;
      const t = computeMonthTotals(transactions, fixedExpenses, fixedIncomes, mStr, first);
      return { inc: t.inc, exp: t.exp, sav: t.sav, net: t.net, hasData: t.hasData, label: MONTHS_SHORT[i], mini: MONTHS_MINI[i], idx: i };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, fixedExpenses, fixedIncomes, year]);
}

// ─────────────────────────────────────────────────────────────────
//  Current balance (all-time)
// ─────────────────────────────────────────────────────────────────
export function useBalance(transactions, fixedExpenses, fixedIncomes) {
  return useMemo(() => {
    let bal = 0;
    transactions.forEach(t => {
      const a = parseFloat(t.amount) || 0;
      if (isIncome(t.type))          bal += a;
      else if (t.type === "expense") bal -= a;
      else if (t.type === "epargne") bal -= a;
      // balance_adjustment n'impacte PAS le solde estimé (useBalance)
      // Il impacte uniquement le solde pointé (rapprochement bancaire)
    });

    if (transactions.length > 0) {
      const earliest = transactions.reduce(
        (min, t) => (t.date < min ? t.date : min),
        transactions[0].date
      );
      const startYM = earliest.slice(0, 7);
      const now = new Date();
      const endYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      monthRange(startYM, endYM).forEach(ym => {
        bal -= effectiveFixesForMonth(fixedExpenses, ym);
        bal += effectiveIncomesForMonth(fixedIncomes, ym);
      });
    } else {
      bal -= effectiveFixesForMonth(fixedExpenses, currentYM());
      bal += effectiveIncomesForMonth(fixedIncomes, currentYM());
    }

    return bal;
  }, [transactions, fixedExpenses]);
}

// ─────────────────────────────────────────────────────────────────
//  Year totals
// ─────────────────────────────────────────────────────────────────
export function useYearTotals(transactions, fixedExpenses, year, fixedIncomes = []) {
  // v1.47.1 : somme des mêmes totaux mensuels que partout (revenus fixes
  // inclus, rien avant la 1ʳᵉ opération ni dans le futur)
  return useMemo(() => {
    const t = computePeriodTotals(transactions, fixedExpenses, fixedIncomes, `${year}-01`, `${year}-12`);
    return { inc: t.inc, exp: t.exp, sav: t.sav };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, fixedExpenses, fixedIncomes, year]);
}

// ─────────────────────────────────────────────────────────────────
//  Prior year for delta comparison (same elapsed months)
// ─────────────────────────────────────────────────────────────────
export function usePriorYearStats(transactions, fixedExpenses, fixedIncomes = []) {
  // Même période l'an dernier (janvier → mois actuel), même calcul (v1.47.1)
  const now = new Date();
  const elapsed  = now.getMonth() + 1;
  const prevYear = now.getFullYear() - 1;
  return useMemo(() => {
    const t = computePeriodTotals(transactions, fixedExpenses, fixedIncomes, `${prevYear}-01`, `${prevYear}-${String(elapsed).padStart(2, "0")}`);
    return { inc: t.inc, exp: t.exp, expVar: t.expVar, decag: t.decag, sav: t.sav };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, fixedExpenses, fixedIncomes, prevYear, elapsed]);
}

// ─────────────────────────────────────────────────────────────────
//  Balance with pending recurring transactions for current month
//  Déduit du solde les récurrentes non encore confirmées ce mois,
//  ainsi que les programmées dont l'échéance est ce mois-ci ou déjà
//  passée mais pas encore confirmée (ex: précommande payée à la sortie —
//  ça ne pèse sur le solde estimé qu'à partir du mois de l'échéance).
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
//  Rapprochement bancaire (v1.39.24)
//  Source UNIQUE pour "pointé" / "en attente" — utilisée à la fois pour
//  l'affichage du rapprochement ET comme base du solde estimé, pour que
//  les deux ne puissent plus diverger. Inclut les revenus fixes (toujours
//  comptés "pointés" : pas de pointage manuel pour eux, contrairement aux
//  frais fixes).
// ─────────────────────────────────────────────────────────────────
export function isPointable(type) {
  return type !== "decagnottage" && type !== "transfer";
}

// ─────────────────────────────────────────────────────────────────
//  isIncomeDirection — comme isIncome(t.type), mais respecte le sens
//  choisi (adjSign) pour une opération d'équilibre, qui peut ajouter OU
//  soustraire. Source unique pour ne plus jamais coder en dur "une
//  opération d'équilibre va toujours dans le sens dépense".
// ─────────────────────────────────────────────────────────────────
export function isIncomeDirection(t) {
  if (t.type === "balance_adjustment") return t.adjSign === "+";
  return isIncome(t.type);
}

// ─────────────────────────────────────────────────────────────────
//  computeReconciliation — v1.45.0
//  Version « pure » (sans hook) du rapprochement, qui garde en plus le
//  DÉTAIL de chaque ligne : c'est elle qui alimente à la fois les chiffres
//  de l'accueil (useReconciliation) et le panneau « Calcul du solde
//  estimé ». Un seul calcul → les deux ne peuvent jamais diverger.
// ─────────────────────────────────────────────────────────────────
export function computeReconciliation(transactions, fixedExpenses, fixedIncomes, curYM = currentYM()) {
  let ptInc = 0, ptExp = 0, noPtInc = 0, noPtExp = 0;
  const pendingTx = [], pendingFixes = [], pendingIncomes = [];

  transactions.filter(t => isPointable(t.type)).forEach(t => {
    const a = parseFloat(t.amount) || 0;
    const isInc = isIncomeDirection(t);
    if (t.pointed) { if (isInc) ptInc += a; else ptExp += a; }
    else {
      if (isInc) noPtInc += a; else noPtExp += a;
      pendingTx.push({ t, signed: isInc ? a : -a });
    }
  });

  const startYM = transactions.length
    ? transactions.reduce((min, t) => (t.date < min ? t.date : min), transactions[0].date).slice(0, 7)
    : curYM;
  const allMonths = monthRange(startYM, curYM);

  let nbPtFix = 0, totalFix = 0, nbPtInc = 0, totalInc = 0;
  allMonths.forEach(ym => {
    (fixedExpenses || []).forEach(f => {
      if (!isActiveForMonth(f, ym)) return;
      totalFix++;
      const ov = f.monthlyOverrides?.[ym];
      const a  = (ov?.amount ?? f.amount) || 0;
      if (f.pointedMonths?.[ym]) { ptExp += a; nbPtFix++; }
      else { noPtExp += a; pendingFixes.push({ f, ym, signed: -a }); }
    });
    // Revenus fixes : pointables au même titre que les frais fixes, avec
    // leur propre suivi mensuel (pointedMonths).
    (fixedIncomes || []).forEach(f => {
      if (!isActiveForMonth(f, ym)) return;
      totalInc++;
      const ov = f.monthlyOverrides?.[ym];
      const a  = (ov?.amount ?? f.amount) || 0;
      if (f.pointedMonths?.[ym]) { ptInc += a; nbPtInc++; }
      else { noPtInc += a; pendingIncomes.push({ f, ym, signed: a }); }
    });
  });

  const pointableTxs = transactions.filter(t => isPointable(t.type));
  const nbPtTx = pointableTxs.filter(t => t.pointed).length;

  return {
    soldePointe:    ptInc  - ptExp,
    soldeAttente:   noPtInc - noPtExp,
    nbPointed:      nbPtTx + nbPtFix + nbPtInc,
    totalPointable: pointableTxs.length + totalFix + totalInc,
    pendingTx, pendingFixes, pendingIncomes,
  };
}

export function useReconciliation(transactions, fixedExpenses, fixedIncomes) {
  return useMemo(() => {
    const r = computeReconciliation(transactions, fixedExpenses, fixedIncomes);
    return { soldePointe: r.soldePointe, soldeAttente: r.soldeAttente, nbPointed: r.nbPointed, totalPointable: r.totalPointable };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, fixedExpenses, fixedIncomes]);
}

// ─────────────────────────────────────────────────────────────────
//  computeBalanceBreakdown — v1.45.0
//  LE calcul du solde bancaire estimé, ligne par ligne :
//    solde pointé
//  + en attente (chèques non encaissés, autres opérations non pointées,
//    frais fixes et revenus fixes non pointés)
//  + récurrentes du mois/de l'année pas encore confirmées (revenu → +,
//    dépense → −)
//  − programmées dont l'échéance est atteinte
//  = solde estimé
//  Les frais fixes non pointés sont dans « en attente » et UNIQUEMENT là :
//  jamais comptés deux fois.
// ─────────────────────────────────────────────────────────────────
export function computeBalanceBreakdown(transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions, now = new Date()) {
  const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const curY  = now.getFullYear().toString();
  const rec = computeReconciliation(transactions, fixedExpenses, fixedIncomes, curYM);

  const sum = list => Math.round(list.reduce((s, x) => s + x.signed, 0) * 100) / 100;
  const cheques = rec.pendingTx.filter(x => x.t.paymentMethod === "cheque");
  const others  = rec.pendingTx.filter(x => x.t.paymentMethod !== "cheque");

  const recurring = [];
  (recurringTemplates || []).forEach(tpl => {
    const amount = parseFloat(tpl.amount) || 0;
    if (amount <= 0) return;
    const confirmed = transactions.filter(t => t.templateId === tpl.id);
    if (tpl.occurrences != null && confirmed.length >= tpl.occurrences) return;
    // Une récurrente peut être un revenu (bonus) ou une dépense (abonnement)
    const signed = tpl.type === "income" ? amount : -amount;
    const prefix = tpl.frequency === "yearly" ? curY : curYM;
    if (confirmed.some(t => recurringRefDate(t).startsWith(prefix))) return;
    // Jour habituel = jour de la dernière occurrence confirmée (indicatif)
    const last = confirmed.map(recurringRefDate).sort().pop();
    recurring.push({ tpl, signed, day: last ? parseInt(last.slice(8, 10), 10) : null });
  });

  // Une programmée reste dans scheduledTransactions tant qu'elle n'est pas
  // confirmée (CONFIRM_SCHEDULED la retire) → tout ce qui s'y trouve encore
  // ET dont l'échéance est atteinte (mois en cours ou passé) est anticipé.
  const scheduled = (scheduledTransactions || [])
    .filter(s => (parseFloat(s.amount) || 0) > 0 && s.date.slice(0, 7) <= curYM)
    .map(s => ({ s, signed: -(parseFloat(s.amount) || 0) }));

  const pendingTotal = rec.soldeAttente;
  const total = rec.soldePointe + pendingTotal + recurring.reduce((s, x) => s + x.signed, 0) + scheduled.reduce((s, x) => s + x.signed, 0);

  return {
    pointed:   { total: rec.soldePointe, count: rec.nbPointed },
    pending:   {
      total:   pendingTotal,
      cheques: { total: sum(cheques), items: cheques },
      others:  { total: sum(others),  items: others },
      fixes:   { total: sum(rec.pendingFixes),   items: rec.pendingFixes },
      incomes: { total: sum(rec.pendingIncomes), items: rec.pendingIncomes },
    },
    recurring: { total: sum(recurring), items: recurring },
    scheduled: { total: sum(scheduled), items: scheduled },
    total,
  };
}

export function useBalanceBreakdown(transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions) {
  return useMemo(
    () => computeBalanceBreakdown(transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions),
    [transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions]
  );
}

export function useBalanceWithRecurring(transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions) {
  // Le solde estimé = total de computeBalanceBreakdown : le chiffre de la
  // carte et le panneau « Calcul du solde » viennent du même calcul.
  return useBalanceBreakdown(transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions).total;
}

// ─────────────────────────────────────────────────────────────────
//  Médiane du flux courant NET (v1.39.11)
//  "Courant" = ni fixe (vit dans fixedExpenses/fixedIncomes, pas dans
//  transactions), ni récurrent (templateId posé), ni arrondi auto
//  (isRounding), ni mouvement de cagnotte (épargne/décagnottage — déjà
//  suivi ailleurs). Ce qui reste : les dépenses ET revenus ponctuels
//  du quotidien (courses, sorties, freelance, remboursement…), dont le
//  montant varie d'un mois à l'autre. On calcule le NET (revenus moins
//  dépenses) de chaque mois, puis on prend la médiane de cette série —
//  pour qu'un mois avec un imprévu ponctuel (grosse réparation, gros
//  extra) ne fausse pas l'estimation des mois suivants.
//  Retourne un nombre signé : positif si le mois "type" est plutôt
//  excédentaire, négatif s'il est plutôt déficitaire.
// ─────────────────────────────────────────────────────────────────
function median(nums) {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function useVariableCashflowMedian(transactions, monthsWindow = 6) {
  return useMemo(() => {
    const now = new Date();
    const monthlyNet = [];
    for (let i = 1; i <= monthsWindow; i++) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      let net = 0;
      transactions.forEach(t => {
        if (t.templateId || t.isRounding || !t.date.startsWith(ym)) return;
        const a = parseFloat(t.amount) || 0;
        if      (t.type === "expense") net -= a;
        else if (t.type === "income")  net += a;
        // épargne / décagnottage / ajustement : exclus, déjà suivis via les cagnottes
      });
      monthlyNet.push(net);
    }
    return median(monthlyNet);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, monthsWindow]);
}

// ─────────────────────────────────────────────────────────────────
//  Projection du solde sur les prochains mois (v1.39.11)
//  Intègre les montants CONNUS (fixes, récurrentes mensuelles — revenu
//  ou dépense selon leur type, programmées déjà datées) + une
//  estimation du flux courant net (médiane ci-dessus). Les récurrentes
//  annuelles ne sont pas anticipées ici : on ne sait pas de façon
//  fiable à quel mois futur elles retomberont. C'est une estimation,
//  pas une prévision exacte — elle ne peut pas deviner un imprévu
//  ponctuel.
// ─────────────────────────────────────────────────────────────────
const PROJ_MONTHS_SHORT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

export function useBalanceProjection(balance, transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions, monthsAhead = 3, alertThreshold = null) {
  const variableNetMedian = useVariableCashflowMedian(transactions, 6);

  return useMemo(() => {
    const now = new Date();
    const months = [];
    let running = balance;
    let deltaFromPrev = 0; // pour repérer le mois qui baisse le plus

    for (let i = 1; i <= monthsAhead; i++) {
      const d  = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      // v1.46.2 : respecte début (startYM), pause en cours et pauses passées
      // — comme partout ailleurs (avant : un frais en pause restait projeté)
      const fixExp = (fixedExpenses || []).reduce((s, f) => {
        if (!isActiveForMonth(f, ym)) return s;
        const ov = f.monthlyOverrides?.[ym];
        return s + ((ov?.amount ?? f.amount) || 0);
      }, 0);
      const fixInc = (fixedIncomes || []).reduce((s, f) => {
        if (!isActiveForMonth(f, ym)) return s;
        const ov = f.monthlyOverrides?.[ym];
        return s + ((ov?.amount ?? f.amount) || 0);
      }, 0);

      // Une récurrente peut être un revenu (ex: bonus mensuel) ou une
      // dépense (ex: abonnement) — on respecte son type, pas une
      // hypothèse "toujours dépense". On tient aussi compte du fait
      // qu'une récurrente à occurrences limitées peut se terminer
      // AVANT la fin de la fenêtre de projection : une fois le nombre
      // de fois atteint, elle arrête de peser sur les mois suivants.
      const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const recNet = (recurringTemplates || []).reduce((s, tpl) => {
        if (tpl.frequency !== "monthly") return s;
        const amount = parseFloat(tpl.amount) || 0;
        if (amount <= 0) return s;
        if (tpl.occurrences != null) {
          const confirmed  = transactions.filter(t => t.templateId === tpl.id);
          const doneSoFar  = confirmed.length;
          // Si le mois en cours n'est pas encore confirmé, le solde de
          // départ (balance) l'anticipe déjà comme "fait" — il compte
          // donc pour 1 occurrence de plus que ce qui est dans les données.
          const doneThisMonth  = confirmed.some(t => recurringRefDate(t).startsWith(curYM));
          const effectiveDone  = doneThisMonth ? doneSoFar : doneSoFar + 1;
          if (effectiveDone + i > tpl.occurrences) return s;
        }
        return s + (tpl.type === "income" ? amount : -amount);
      }, 0);

      // Les programmées sont toujours des dépenses (l'app ne propose que
      // des catégories de dépense pour ce type de transaction). On garde
      // le détail (pas juste le total) pour pouvoir expliquer le mois.
      const schedItems = (scheduledTransactions || []).filter(sc => sc.date.slice(0, 7) === ym);
      const schedDue   = schedItems.reduce((s, sc) => s + (parseFloat(sc.amount) || 0), 0);

      const prevRunning = running;
      running = running + fixInc - fixExp + recNet - schedDue + variableNetMedian;

      months.push({
        ym, label: PROJ_MONTHS_SHORT[d.getMonth()], value: running,
        delta: running - prevRunning, schedItems,
      });
    }

    // Repère le premier mois où la projection passe sous le seuil d'alerte
    let thresholdBreachMonth = null;
    if (alertThreshold != null && alertThreshold > 0) {
      thresholdBreachMonth = months.find(m => m.value < alertThreshold) || null;
    }

    // Repère le mois qui explique le mieux une baisse (la plus grosse
    // programmée parmi tous les mois projetés, s'il y en a une)
    let biggestSchedMonth = null, biggestSchedItem = null;
    months.forEach(m => {
      m.schedItems.forEach(sc => {
        const a = parseFloat(sc.amount) || 0;
        if (!biggestSchedItem || a > (parseFloat(biggestSchedItem.amount) || 0)) {
          biggestSchedItem = sc; biggestSchedMonth = m;
        }
      });
    });

    return { months, variableNetMedian, thresholdBreachMonth, biggestSchedMonth, biggestSchedItem };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions, monthsAhead, variableNetMedian, alertThreshold]);
}

// ─────────────────────────────────────────────────────────────────
//  Fiabilité de la projection (v1.39.14)
//  Compare, pour chaque mois désormais PASSÉ, ce que la toute première
//  projection avait annoncé (projectionSnapshots, figé une fois pour
//  toutes) avec le solde réellement atteint à la fin de ce mois-là.
// ─────────────────────────────────────────────────────────────────
function balanceAsOfEndOfMonth(transactions, fixedExpenses, fixedIncomes, targetYM) {
  let bal = 0;
  transactions.forEach(t => {
    if (t.date.slice(0, 7) > targetYM) return;
    const a = parseFloat(t.amount) || 0;
    if      (isIncome(t.type))      bal += a;
    else if (t.type === "expense")  bal -= a;
    else if (t.type === "epargne")  bal -= a;
  });
  if (transactions.length > 0) {
    const earliest = transactions.reduce(
      (min, t) => (t.date < min ? t.date : min), transactions[0].date
    );
    const startYM = earliest.slice(0, 7);
    if (startYM <= targetYM) {
      monthRange(startYM, targetYM).forEach(ym => {
        bal -= effectiveFixesForMonth(fixedExpenses, ym);
        bal += effectiveIncomesForMonth(fixedIncomes, ym);
      });
    }
  }
  return bal;
}

export function useProjectionAccuracy(transactions, fixedExpenses, fixedIncomes, projectionSnapshots) {
  return useMemo(() => {
    const curYM = currentYM();
    const results = [];
    Object.entries(projectionSnapshots || {}).forEach(([ym, snap]) => {
      if (ym >= curYM) return; // le mois n'est pas encore passé
      const actual = balanceAsOfEndOfMonth(transactions, fixedExpenses, fixedIncomes, ym);
      results.push({ ym, predicted: snap.predictedValue, actual, delta: actual - snap.predictedValue });
    });
    results.sort((a, b) => b.ym.localeCompare(a.ym));
    return results;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, fixedExpenses, fixedIncomes, projectionSnapshots]);
}

// ─────────────────────────────────────────────────────────────────
//  Budgets par tag (v1.41.0) — source unique pour Rapport ET Accueil.
//  budgetPeriod "month" : dépenses du mois ym ; "total" : depuis toujours.
//  Ne compte que les dépenses (type "expense"), montant débité en banque
//  (hors montants à part). Purement informatif : n'impacte aucun solde.
// ─────────────────────────────────────────────────────────────────
export function computeTagBudgets(tags, transactions, ym) {
  return (tags || [])
    .filter(tag => (parseFloat(tag.budget) || 0) > 0)
    .map(tag => {
      const period = tag.budgetPeriod === "total" ? "total" : "month";
      const spent = (transactions || [])
        .filter(t => t.type === "expense" && (t.tagIds || []).includes(tag.id)
          && (period === "total" || (t.date || "").startsWith(ym)))
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const budget = parseFloat(tag.budget);
      const pct = spent / budget * 100;
      return { tag, period, spent, budget, pct, remaining: budget - spent,
        level: pct > 100 ? "over" : pct >= 80 ? "warn" : "ok" };
    })
    .sort((a, b) => b.pct - a.pct);
}

// ─────────────────────────────────────────────────────────────────
//  Porte-monnaie hors compte (v1.42.0) — un par type de montant à part
//  dont « Suivre le solde » est activé.
//  Solde = rechargements − dépenses 100 % hors compte − montants à part
//  utilisés en complément d'une dépense bancaire (même carte, même argent).
//  Purement informatif : ne lit ni n'influence aucun solde bancaire.
// ─────────────────────────────────────────────────────────────────
export function computeWallets(sideAmountTypes, offEntries, transactions, ym) {
  return (sideAmountTypes || []).filter(st => st.trackBalance).map(st => {
    const moves = [];
    (offEntries || []).filter(e => e.satId === st.id).forEach(e => {
      const a = parseFloat(e.amount) || 0;
      moves.push({ id: e.id, date: e.date, amount: e.kind === "recharge" ? a : -a,
        kind: e.kind, note: e.note, categoryId: e.categoryId, entry: e });
    });
    (transactions || []).forEach(t => {
      const a = parseFloat(t.sideAmounts?.[st.id]) || 0;
      if (a > 0) moves.push({ id: "tx_" + t.id, date: t.date, amount: -a, kind: "complement",
        note: t.note, categoryId: t.categoryId });
    });
    moves.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const inMonth = m => (m.date || "").startsWith(ym);
    return {
      st,
      balance:        moves.reduce((s, m) => s + m.amount, 0),
      // Les corrections (rechargement négatif) modifient le solde mais ne sont
      // ni un rechargement ni une dépense du mois.
      rechargedMonth: moves.filter(m => inMonth(m) && m.kind === "recharge" && m.amount > 0).reduce((s, m) => s + m.amount, 0),
      spentMonth:     -moves.filter(m => inMonth(m) && m.kind !== "recharge").reduce((s, m) => s + m.amount, 0),
      moves,
    };
  });
}

// Payé hors banque (montants à part + dépenses 100 % hors compte) par
// catégorie, face au budget réel de la catégorie (banque + hors banque).
// satFilter : id d'un type ou "all" ; periodPrefix : "2026-09" ou "2026".
export function computeSidePaidByCategory(transactions, offEntries, satFilter, periodPrefix) {
  const inP = d => (d || "").startsWith(periodPrefix);
  const match = id => satFilter === "all" || id === satFilter;
  const map = {};
  const row = c => (map[c] = map[c] || { categoryId: c, side: 0, bank: 0 });
  (transactions || []).filter(t => t.type === "expense" && inP(t.date)).forEach(t => {
    const r = row(t.categoryId);
    r.bank += parseFloat(t.amount) || 0;
    Object.entries(t.sideAmounts || {}).forEach(([k, v]) => { if (match(k)) r.side += parseFloat(v) || 0; });
  });
  (offEntries || []).filter(e => e.kind === "expense" && inP(e.date) && match(e.satId)).forEach(e => {
    row(e.categoryId).side += parseFloat(e.amount) || 0;
  });
  return Object.values(map)
    .filter(r => r.side > 0)
    .map(r => ({ ...r, total: r.bank + r.side, pct: r.side / (r.bank + r.side) * 100 }))
    .sort((a, b) => b.side - a.side);
}

// ─────────────────────────────────────────────────────────────────
//  Chèques non encaissés (v1.43.0) — une dépense payée par chèque et
//  pas encore pointée. Aucun calcul nouveau : elle est déjà déduite du
//  solde estimé et comptée « en attente » comme toute dépense non pointée.
//  level : "recent" < 30 j · "old" 30 j–3 mois · "veryold" > 3 mois
//          · "expired" au-delà d'1 an et 8 jours (plus encaissable).
// ─────────────────────────────────────────────────────────────────
export function pendingCheques(transactions, today = todayISO()) {
  return (transactions || [])
    .filter(t => t.paymentMethod === "cheque" && !t.pointed)
    .map(t => {
      const issued = t.issuedDate || t.date;
      const age    = Math.max(0, daysBetweenISO(issued, today));
      const expiry = chequeExpiryISO(issued);
      const level  = today > expiry ? "expired" : age > 90 ? "veryold" : age >= 30 ? "old" : "recent";
      return { t, issued, age, expiry, level };
    })
    .sort((a, b) => b.age - a.age);
}

// ─────────────────────────────────────────────────────────────────
//  computeGroceryBudget — v1.46.0
//  Budget courses restant ce mois = moyenne des N derniers mois complets
//  (2 par défaut) + le mois en cours au prorata (v1.46.1) − déjà dépensé
//  ce mois, dans la ou les catégories
//  « courses ». PUREMENT INFORMATIF : n'entre dans AUCUN solde (décision
//  de Julien) — affiché en pastille sur la hero card et dans le panneau
//  « Calcul du solde estimé », sous le total.
//  • Seule la part payée par la banque compte (dépenses `expense`) : les
//    tickets resto (sideAmounts) et le hors compte ne sont pas lus.
//  • Récurrentes (templateId) et arrondis (isRounding) exclus, comme pour
//    la projection.
//  • Seuls les mois depuis la 1ʳᵉ opération enregistrée sont pris en
//    compte (un mois avant l'utilisation de l'app ne vaut pas 0 €).
//  Catégories : settings.categoryIds, ou à défaut celles nommées
//  « Courses » (insensible à la casse/accents).
// ─────────────────────────────────────────────────────────────────
const normName = n => String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export function groceryCategoryIds(categories, settings) {
  const valid = new Set((categories || []).map(c => c.id));
  const base = Array.isArray(settings?.categoryIds)
    ? settings.categoryIds.filter(id => valid.has(id))
    : (categories || []).filter(c => normName(c.name) === "courses").map(c => c.id);
  // v1.47.0 : une catégorie choisie inclut ses sous-catégories (Courses › Drive…)
  const out = new Set(base);
  (categories || []).forEach(c => { if (c.parentId && out.has(c.parentId)) out.add(c.id); });
  return [...out];
}

export function computeGroceryBudget(transactions, categories, settings, now = new Date()) {
  if (settings && settings.enabled === false) return null;
  const catIds = groceryCategoryIds(categories, settings);
  if (catIds.length === 0) return null;
  const cats = new Set(catIds);
  const ymOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const curYM = ymOf(now);
  const txs = transactions || [];
  const firstYM = txs.length ? txs.reduce((m, t) => (t.date < m ? t.date : m), txs[0].date).slice(0, 7) : curYM;
  const isGrocery = t => t.type === "expense" && cats.has(t.categoryId) && !t.templateId && !t.isRounding;
  const sumMonth = ym => {
    let total = 0, count = 0;
    txs.forEach(t => { if (isGrocery(t) && t.date.startsWith(ym)) { total += parseFloat(t.amount) || 0; count++; } });
    return { ym, total: Math.round(total * 100) / 100, count };
  };

  const n = Math.max(1, Math.min(3, parseInt(settings?.months, 10) || 2));
  const months = [];
  for (let i = 1; i <= n; i++) {
    const ym = ymOf(new Date(now.getFullYear(), now.getMonth() - i, 1));
    if (ym >= firstYM) months.push(sumMonth(ym));
  }
  if (months.length === 0) return null;          // pas encore un mois complet d'historique
  months.reverse();                              // ordre chronologique

  // v1.46.1 : le mois en cours entre aussi dans la moyenne, AU PRORATA de
  // la part du mois écoulée (le 10 octobre il pèse 10/31 d'un mois, le 31
  // un mois entier). Sans ça, en début de mois un octobre presque vide
  // tirerait la moyenne vers le bas. Le dernier jour, cela revient à la
  // moyenne simple des N mois + le mois en cours.
  const current = sumMonth(curYM);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const weight = Math.min(1, now.getDate() / daysInMonth);
  const average = Math.round((months.reduce((s, m) => s + m.total, 0) + current.total) / (months.length + weight) * 100) / 100;
  const remaining = Math.max(0, Math.round((average - current.total) * 100) / 100);
  const over      = Math.max(0, Math.round((current.total - average) * 100) / 100);
  return { catIds, months, monthsWanted: n, average, spent: current.total, count: current.count, remaining, over, curYM,
           day: now.getDate(), daysInMonth, weight };
}

export function useGroceryBudget(transactions, categories, settings) {
  return useMemo(() => computeGroceryBudget(transactions, categories, settings),
    [transactions, categories, settings]);
}

// ─────────────────────────────────────────────────────────────────
//  Sous-catégories — v1.47.0
//  Une catégorie peut avoir un parentId (un seul niveau). Les opérations
//  gardent leur categoryId (parent OU sous-catégorie) ; les totaux par
//  catégorie additionnent les sous-catégories dans leur parent.
// ─────────────────────────────────────────────────────────────────
/** Id de la catégorie principale (elle-même si pas de parent valide) */
export function catRootId(categories, id) {
  const c = (categories || []).find(x => x.id === id);
  if (c?.parentId && (categories || []).some(x => x.id === c.parentId)) return c.parentId;
  return id;
}
/** v1.50.0 — Budget (seuil) qui s'applique à une catégorie : le sien, sinon celui
 *  de sa catégorie principale. → { catId, limit } ou null. */
export function categoryBudgetFor(categories, thresholds, catId) {
  if (!catId || !thresholds) return null;
  if (thresholds[catId] > 0) return { catId, limit: thresholds[catId] };
  const root = catRootId(categories, catId);
  if (root && root !== catId && thresholds[root] > 0) return { catId: root, limit: thresholds[root] };
  return null;
}
/** v1.50.0 — Dépensé un mois donné dans une catégorie ET ses sous-catégories :
 *  opérations « dépense » + frais fixes actifs (correction du mois comprise).
 *  Même calcul que le suivi des catégories du Rapport. excludeTxId : opération
 *  en cours de modification (sa nouvelle valeur est ajoutée à part). */
export function categorySpentForMonth(categories, transactions, fixedExpenses, catId, ym, excludeTxId = null) {
  const fam = catFamilyIds(categories, catId);
  const tx = (transactions || []).filter(t => t.id !== excludeTxId && t.type === "expense" && (t.date || "").startsWith(ym) && fam.includes(t.categoryId))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const fx = (fixedExpenses || []).filter(f => fam.includes(f.categoryId) && isActiveForMonth(f, ym))
    .reduce((s, f) => s + ((f.monthlyOverrides?.[ym]?.amount ?? f.amount) || 0), 0);
  return tx + fx;
}
/** [id, ...ids de ses sous-catégories] */
export function catFamilyIds(categories, id) {
  return [id, ...(categories || []).filter(c => c.parentId === id).map(c => c.id)];
}

// ─────────────────────────────────────────────────────────────────
//  categoryUsage — v1.47.0 : tout ce qui est rattaché à une catégorie,
//  affiché AVANT sa suppression (protection contre les orphelins).
// ─────────────────────────────────────────────────────────────────
export function categoryUsage(data, id) {
  const cnt = list => (list || []).filter(x => x.categoryId === id).length;
  const fixes = (data.fixedExpenses || []).filter(f => f.categoryId === id);
  return {
    transactions:  cnt(data.transactions),
    fixedExpenses: fixes.length,
    fixedNames:    fixes.map(f => f.name),
    fixedIncomes:  cnt(data.fixedIncomes),
    recurring:     cnt(data.recurringTemplates),
    scheduled:     cnt(data.scheduledTransactions),
    quickTemplates: cnt(data.quickTemplates),
    offAccount:    cnt(data.offAccountEntries),
    provisional:   cnt(data.provisionalExpenses),
    threshold:     (data.categoryThresholds || {})[id] || 0,
    grocery:       Array.isArray(data.groceryBudget?.categoryIds) && data.groceryBudget.categoryIds.includes(id),
    linked:        (data.categories || []).filter(c => c.linkedToId === id).map(c => c.name),
    children:      (data.categories || []).filter(c => c.parentId === id),
  };
}

// ─────────────────────────────────────────────────────────────────
//  computeMonthRecap — v1.47.0 : « Clôture du mois »
//  Bilan d'un mois terminé (ym) : dépenses/revenus/épargne comparés à la
//  moyenne des 3 mois précédents, solde de fin de mois, catégories qui
//  ont le plus bougé, budgets (courses, tags), ce qui reste à pointer.
//  Dépenses/revenus = opérations du mois + frais/revenus fixes actifs.
// ─────────────────────────────────────────────────────────────────
function prevYMs(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 2 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}
function monthFlows(data, ym) {
  const txs = (data.transactions || []).filter(t => (t.date || "").startsWith(ym));
  const sum = f => txs.filter(f).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const exp = sum(t => t.type === "expense") + effectiveFixesForMonth(data.fixedExpenses || [], ym);
  const inc = sum(t => t.type === "income") + effectiveIncomesForMonth(data.fixedIncomes || [], ym);
  const sav = sum(t => t.type === "epargne") - sum(t => t.type === "decagnottage");
  return { exp, inc, sav, txs };
}
function catSpend(data, ym) {
  const map = {};
  const add = (id, a) => { const k = id ? catRootId(data.categories, id) : "__none__"; map[k] = (map[k] || 0) + a; };
  (data.transactions || []).forEach(t => { if (t.type === "expense" && (t.date || "").startsWith(ym)) add(t.categoryId, parseFloat(t.amount) || 0); });
  (data.fixedExpenses || []).forEach(f => {
    if (!isActiveForMonth(f, ym)) return;
    add(f.categoryId, (f.monthlyOverrides?.[ym]?.amount ?? f.amount) || 0);
  });
  return map;
}
/** Solde « brut » au dernier jour du mois (même logique que la courbe de la hero card) */
function endOfMonthBalance(data, ym) {
  const end = `${ym}-31`;
  const txs = data.transactions || [];
  let bal = 0;
  txs.forEach(t => {
    if (!t.date || t.date > end) return;
    const a = parseFloat(t.amount) || 0;
    if (isIncome(t.type)) bal += a;
    else if (t.type === "expense" || t.type === "epargne") bal -= a;
    else if (t.type === "balance_adjustment") bal += isIncomeDirection(t) ? a : -a;
  });
  if (txs.length) {
    const start = txs.reduce((m, t) => (t.date < m ? t.date : m), txs[0].date).slice(0, 7);
    monthRange(start, ym).forEach(m => {
      bal -= effectiveFixesForMonth(data.fixedExpenses || [], m);
      bal += effectiveIncomesForMonth(data.fixedIncomes || [], m);
    });
  }
  return bal;
}

export function computeMonthRecap(data, ym) {
  const cur = monthFlows(data, ym);
  const firstYM = (data.transactions || []).reduce((m, t) => (t.date && t.date < m ? t.date : m), "9999").slice(0, 7);
  const prev = prevYMs(ym, 3).filter(m => m >= firstYM);
  const prevFlows = prev.map(m => monthFlows(data, m));
  const avg = k => prevFlows.length ? prevFlows.reduce((s, f) => s + f[k], 0) / prevFlows.length : null;
  const pct = (v, a) => (a && a > 0 ? Math.round((v - a) / a * 100) : null);

  // Catégories qui ont le plus bougé (vs moyenne des mois précédents, ≥ 15 € d'écart)
  const curCats = catSpend(data, ym);
  const prevCats = prev.map(m => catSpend(data, m));
  const keys = new Set([...Object.keys(curCats), ...prevCats.flatMap(o => Object.keys(o))]);
  const movers = [...keys].filter(k => k !== "__none__").map(k => {
    const a = prevCats.length ? prevCats.reduce((s, o) => s + (o[k] || 0), 0) / prevCats.length : 0;
    const v = curCats[k] || 0;
    return { catId: k, amount: v, avg: a, diff: v - a, pct: a > 0 ? Math.round((v - a) / a * 100) : null };
  }).filter(x => Math.abs(x.diff) >= 15 && (x.avg > 0 || x.amount > 0))
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff)).slice(0, 3);

  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0);
  const grocery = computeGroceryBudget(data.transactions, data.categories, data.groceryBudget, lastDay);
  const tagBudgets = computeTagBudgets(data.tags, data.transactions, ym).filter(b => b.period === "month");

  const unpointedTx = cur.txs.filter(t => isPointable(t.type) && !t.pointed).length;
  const unpointedFix = (data.fixedExpenses || []).filter(f => isActiveForMonth(f, ym) && !f.pointedMonths?.[ym]).length
                     + (data.fixedIncomes || []).filter(f => isActiveForMonth(f, ym) && !f.pointedMonths?.[ym]).length;
  const cheques = pendingCheques(data.transactions);
  const endBal = endOfMonthBalance(data, ym);
  const prevYM = prevYMs(ym, 1)[0];
  const startBal = prevYM >= firstYM ? endOfMonthBalance(data, prevYM) : null;

  return {
    ym, monthsCompared: prev.length,
    expenses: cur.exp, expensesAvg: avg("exp"), expensesPct: pct(cur.exp, avg("exp")),
    incomes: cur.inc, incomesAvg: avg("inc"), incomesPct: pct(cur.inc, avg("inc")),
    savings: cur.sav,
    savingsCags: new Set(cur.txs.filter(t => t.type === "epargne").map(t => t.targetCagId)).size,
    endBalance: endBal, balanceDelta: startBal == null ? null : endBal - startBal,
    movers, grocery, tagBudgets,
    unpointed: unpointedTx + unpointedFix,
    cheques: cheques.length, oldestChequeDays: cheques[0]?.age ?? null,
    hasData: cur.txs.length > 0 || cur.exp > 0 || cur.inc > 0,
  };
}

// ─────────────────────────────────────────────────────────────────
//  computeProjectStatus — v1.47.0 : projet avec échéance
//  Mis de côté = solde de la cagnotte liée ; dépensé = dépenses portant
//  le tag lié. Rythme régulier entre la création et l'échéance : le
//  « prévu à ce jour » sert à dire en avance / dans les temps / en retard.
// ─────────────────────────────────────────────────────────────────
export function computeProjectStatus(p, data, today = todayISO()) {
  const cag = (data.cagnottes || []).find(c => c.id === p.cagId) || null;
  const tag = (data.tags || []).find(t => t.id === p.tagId) || null;
  const target = parseFloat(p.target) || 0;
  const saved = cag ? (parseFloat(cag.current) || 0) : 0;
  const tagTx = tag ? (data.transactions || []).filter(t => t.type === "expense" && (t.tagIds || []).includes(tag.id)) : [];
  const spent = tagTx.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const start = p.createdAt || today;
  const deadline = p.deadline || today;
  const totalDays = Math.max(1, daysBetweenISO(start, deadline));
  const elapsed = Math.min(totalDays, Math.max(0, daysBetweenISO(start, today)));
  const startSaved = Math.min(target, parseFloat(p.startSaved) || 0);
  const expected = Math.round((startSaved + (target - startSaved) * elapsed / totalDays) * 100) / 100;
  const [ty, tm] = deadline.split("-").map(Number);
  const [ny, nm] = today.split("-").map(Number);
  const monthsLeft = (ty - ny) * 12 + (tm - nm);
  const remaining = Math.max(0, Math.round((target - saved) * 100) / 100);
  const perMonth = remaining > 0 ? Math.ceil(remaining / Math.max(1, monthsLeft) * 100) / 100 : 0;
  const tol = target * 0.02;
  const status = saved >= target ? "done"
    : today > deadline ? "late-deadline"
    : saved >= expected + tol ? "ahead"
    : saved >= expected - tol ? "ontrack" : "behind";
  return { cag, tag, target, saved, spent, spentCount: tagTx.length, expected, monthsLeft: Math.max(0, monthsLeft), remaining, perMonth, status,
    savedPct: target > 0 ? Math.min(100, saved / target * 100) : 0, expectedPct: target > 0 ? Math.min(100, expected / target * 100) : 0,
    spentPct: target > 0 ? Math.min(100, spent / target * 100) : 0 };
}

// ─────────────────────────────────────────────────────────────────
//  Totaux d'un mois — v1.47.1 : SOURCE UNIQUE pour Accueil (mois/année),
//  Historique (donut), Rapport (mois, année, classement, taux d'épargne).
//  = opérations du mois + frais fixes + revenus fixes actifs ce mois-là,
//  seulement pour un mois « vécu » : depuis la 1ʳᵉ opération enregistrée
//  et jusqu'au mois en cours (même règle que le rapprochement).
// ─────────────────────────────────────────────────────────────────
export function firstDataYM(transactions) {
  const txs = transactions || [];
  if (!txs.length) return currentYM();
  return txs.reduce((m, t) => (t.date && t.date < m ? t.date : m), txs[0].date || "9999").slice(0, 7);
}

export function computeMonthTotals(transactions, fixedExpenses, fixedIncomes, ym, firstYM = firstDataYM(transactions), curYM = currentYM()) {
  let incTx = 0, expTx = 0, sav = 0, decag = 0;
  (transactions || []).forEach(t => {
    if (!(t.date || "").startsWith(ym)) return;
    const a = parseFloat(t.amount) || 0;
    if (isIncome(t.type))               incTx += a;
    else if (t.type === "expense")      expTx += a;
    else if (t.type === "epargne")      sav   += a;
    else if (t.type === "decagnottage") decag += a;
  });
  const lived = ym >= firstYM && ym <= curYM;
  const fixExp = lived ? effectiveFixesForMonth(fixedExpenses || [], ym) : 0;
  const fixInc = lived ? effectiveIncomesForMonth(fixedIncomes || [], ym) : 0;
  const inc = incTx + fixInc, exp = expTx + fixExp;
  return { inc, exp, expVar: expTx, sav, decag, net: inc - exp, fixExp, fixInc, hasData: lived };
}

/** v1.49.1 — Mois « vécus » d'une période (depuis la 1ʳᵉ opération, jusqu'au mois en cours) :
 *  ce sont les seuls mois où computeMonthTotals compte les frais/revenus fixes. */
export function livedMonths(transactions, fromYM, toYM) {
  const first = firstDataYM(transactions), cur = currentYM();
  return monthRange(fromYM, toYM).filter(ym => ym >= first && ym <= cur);
}
/** v1.49.1 — Détail ligne par ligne des frais (kind "expense") ou revenus (kind "income")
 *  fixes sur une liste de mois. Mêmes règles que effectiveFixesForMonth /
 *  effectiveIncomesForMonth → la somme des lignes = fixExp / fixInc de computePeriodTotals.
 *  Retourne [{ f, total, n }] (n = nombre de mois actifs), sans les lignes jamais actives. */
export function fixedLinesForPeriod(list, months, kind) {
  return (list || []).map(f => {
    let total = 0, n = 0;
    months.forEach(ym => {
      if (!isActiveForMonth(f, ym)) return;
      n++;
      total += kind === "expense"
        ? (((f.monthlyOverrides?.[ym])?.amount ?? f.amount) || 0)
        : (parseFloat(f.monthlyOverrides?.[ym]?.amount ?? f.amount) || 0);
    });
    return { f, total, n };
  }).filter(l => l.n > 0);
}

export function computePeriodTotals(transactions, fixedExpenses, fixedIncomes, fromYM, toYM) {
  const first = firstDataYM(transactions), cur = currentYM();
  const out = { inc: 0, exp: 0, expVar: 0, sav: 0, decag: 0, fixExp: 0, fixInc: 0, months: 0 };
  monthRange(fromYM, toYM).forEach(ym => {
    const t = computeMonthTotals(transactions, fixedExpenses, fixedIncomes, ym, first, cur);
    if (!t.hasData && t.inc === 0 && t.exp === 0) return;
    ["inc", "exp", "expVar", "sav", "decag", "fixExp", "fixInc"].forEach(k => { out[k] += t[k]; });
    if (t.hasData) out.months++;
  });
  out.net = out.inc - out.exp;
  return out;
}

// ─────────────────────────────────────────────────────────────────
//  Jour de prélèvement, paie, solde jour par jour, reste à vivre — v1.48.0
//  Un frais/revenu fixe peut avoir un `day` (1–31, ramené au dernier jour
//  d'un mois plus court). Le revenu fixe daté le plus élevé = la paie.
// ─────────────────────────────────────────────────────────────────
const pad2 = n => String(n).padStart(2, "0");
const ymAdd = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };
const lastDayOf = ym => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
/** Date (YYYY-MM-DD) d'un jour de prélèvement dans un mois donné */
export function dayInMonthISO(day, ym) {
  const d = Math.min(Math.max(1, parseInt(day, 10) || 1), lastDayOf(ym));
  return `${ym}-${pad2(d)}`;
}
const addDaysISO = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`; };

/** Prochaine paie = prochaine date du revenu fixe daté le plus élevé */
export function nextPayday(data, today = todayISO()) {
  const curYM = today.slice(0, 7);
  const dated = (data.fixedIncomes || []).filter(f => f.day);
  if (!dated.length) return null;
  const main = [...dated].sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))[0];
  for (let i = 0; i <= 2; i++) {
    const ym = ymAdd(curYM, i);
    if (!isActiveForMonth(main, ym)) continue;
    const d = dayInMonthISO(main.day, ym);
    if (d > today && !(i === 0 && main.pointedMonths?.[ym])) return { date: d, income: main };
  }
  return null;
}

/**
 * Solde prévu jour par jour, d'aujourd'hui jusqu'à la paie (ou la fin du
 * mois sans paie datée). Part du solde estimé et ré-étale dans le temps ce
 * qu'il a déjà déduit (fixes datés après aujourd'hui, récurrentes, programmées),
 * puis ajoute les opérations du mois suivant qui tombent avant la paie.
 * Les courses restantes sont réparties uniformément sur les jours.
 */
export function computeDailyForecast(data, breakdown, grocery, today = todayISO()) {
  const curYM = today.slice(0, 7);
  const pay = nextPayday(data, today);
  const end = pay ? pay.date : `${curYM}-${pad2(lastDayOf(curYM))}`;
  const cats = data.categories || [];
  const events = [];
  let addBack = 0;
  const ev = (date, amount, label, kind, extra = {}) => events.push({ date, amount, label, kind, ...extra });

  // 1) Mois en cours : ce que le solde estimé a déjà compté, ré-étalé à sa date
  (data.fixedExpenses || []).forEach(f => {
    if (!f.day || !isActiveForMonth(f, curYM) || f.pointedMonths?.[curYM]) return;
    const d = dayInMonthISO(f.day, curYM); if (d <= today) return;
    const a = (f.monthlyOverrides?.[curYM]?.amount ?? f.amount) || 0;
    ev(d, -a, f.name, "fix", { icon: cats.find(c => c.id === f.categoryId)?.icon || "📌" }); addBack += a;
  });
  (data.fixedIncomes || []).forEach(f => {
    if (!f.day || !isActiveForMonth(f, curYM) || f.pointedMonths?.[curYM]) return;
    const d = dayInMonthISO(f.day, curYM); if (d <= today) return;
    const a = (f.monthlyOverrides?.[curYM]?.amount ?? f.amount) || 0;
    ev(d, a, f.name, "inc", { icon: cats.find(c => c.id === f.categoryId)?.icon || "💰" }); addBack -= a;
  });
  (breakdown?.recurring?.items || []).forEach(({ tpl, signed, day }) => {
    if (!day || tpl.frequency === "yearly") return;
    const d = dayInMonthISO(day, curYM); if (d <= today) return;
    ev(d, signed, tpl.label || tpl.note || "Récurrente", "rec", { icon: cats.find(c => c.id === tpl.categoryId)?.icon || "🔄" }); addBack -= signed;
  });
  (breakdown?.scheduled?.items || []).forEach(({ s, signed }) => {
    if (s.date <= today || !s.date.startsWith(curYM)) return;
    ev(s.date, signed, s.note || "Programmée", "sch", { icon: cats.find(c => c.id === s.categoryId)?.icon || "📅" }); addBack -= signed;
  });
  const start = (breakdown?.total || 0) + addBack;

  // 2) Mois suivants jusqu'à la paie (pas encore dans le solde estimé)
  if (end.slice(0, 7) > curYM) {
    monthRange(ymAdd(curYM, 1), end.slice(0, 7)).forEach(ym => {
      (data.fixedExpenses || []).forEach(f => {
        if (!f.day || !isActiveForMonth(f, ym)) return;
        const d = dayInMonthISO(f.day, ym); if (d > end) return;
        ev(d, -((f.monthlyOverrides?.[ym]?.amount ?? f.amount) || 0), f.name, "fix", { icon: cats.find(c => c.id === f.categoryId)?.icon || "📌", next: true });
      });
      (data.fixedIncomes || []).forEach(f => {
        if (!f.day || !isActiveForMonth(f, ym)) return;
        const d = dayInMonthISO(f.day, ym); if (d > end) return;
        ev(d, (f.monthlyOverrides?.[ym]?.amount ?? f.amount) || 0, f.name, "inc", { icon: cats.find(c => c.id === f.categoryId)?.icon || "💰", next: true, isPay: pay && f.id === pay.income.id && d === pay.date });
      });
      (data.scheduledTransactions || []).forEach(s => {
        if (!s.date.startsWith(ym) || s.date > end) return;
        ev(s.date, -(parseFloat(s.amount) || 0), s.note || "Programmée", "sch", { icon: cats.find(c => c.id === s.categoryId)?.icon || "📅", next: true });
      });
    });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));

  // 3) Courses : reste du mois réparti sur les jours restants, puis moyenne/jour
  const daysLeftCur = lastDayOf(curYM) - parseInt(today.slice(8, 10), 10);
  const grocCur = grocery && daysLeftCur > 0 ? grocery.remaining / daysLeftCur : 0;
  const grocNext = grocery ? grocery.average / 30 : 0;

  const days = [];
  let bal = start, low = null;
  for (let d = today; d <= end; d = addDaysISO(d, 1)) {
    const evs = events.filter(e => e.date === d);
    if (d > today) bal -= d.startsWith(curYM) ? grocCur : grocNext;
    const payToday = evs.some(e => e.isPay);
    // Point bas : juste avant la paie le jour de la paie (on retire d'abord les dépenses)
    const out = evs.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    const inn = evs.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    bal += out;
    if (low == null || bal < low.balance) low = { date: d, balance: Math.round(bal * 100) / 100 };
    bal += inn;
    if (!payToday && inn > 0 && (low == null || bal < low.balance)) low = { date: d, balance: Math.round(bal * 100) / 100 };
    days.push({ date: d, balance: Math.round(bal * 100) / 100, events: evs });
  }
  return { start: Math.round(start * 100) / 100, end, payday: pay?.date || null, payIncome: pay?.income || null, events, days, low };
}

/** Reste à vivre par jour jusqu'à la paie (indicatif, n'entre dans aucun solde) */
export function computeRestToLive(data, breakdown, grocery, forecast, today = todayISO()) {
  const st = data.restSettings || {};
  if (st.enabled === false || !breakdown) return null;
  const curYM = today.slice(0, 7);
  const endCur = `${curYM}-${pad2(lastDayOf(curYM))}`;
  const payday = forecast?.payday || null;
  const days = payday ? Math.max(1, daysBetweenISO(today, payday)) : Math.max(1, lastDayOf(curYM) - parseInt(today.slice(8, 10), 10) + 1);
  // Dépenses du mois suivant qui tombent AVANT la paie (le solde estimé ne les connaît pas)
  const nextBeforePay = payday ? -(forecast.events || []).filter(e => e.date > endCur && e.date < payday && e.amount < 0).reduce((s, e) => s + e.amount, 0) : 0;
  const nextGroc = payday && payday > endCur && grocery ? grocery.average / 30 * daysBetweenISO(endCur, payday) : 0;
  const margin = Math.max(0, parseFloat(st.margin) || 0);
  const groceries = grocery ? grocery.remaining + nextGroc : 0;
  const available = breakdown.total - groceries - nextBeforePay - margin;
  return { base: breakdown.total, groceries: Math.round(groceries * 100) / 100, nextBeforePay: Math.round(nextBeforePay * 100) / 100, margin,
    available: Math.round(available * 100) / 100, days, payday, perDay: Math.round(available / days * 100) / 100 };
}

/** Remboursements attendus en cours (le plus ancien d'abord) */
export function pendingReimbursements(data, today = todayISO()) {
  return (data.reimbursements || []).filter(r => r.status !== "received")
    .map(r => ({ ...r, late: r.expectedDate && r.expectedDate < today ? daysBetweenISO(r.expectedDate, today) : 0 }))
    .sort((a, b) => (a.expectedDate || "9999").localeCompare(b.expectedDate || "9999"));
}

// ─────────────────────────────────────────────────────────────────
//  Simulation « Et si… ? » — v1.50.0
//  Changements temporaires appliqués PAR-DESSUS la projection, jamais
//  enregistrés dans les données. Scénario :
//   { kind: "incDown" | "incUp" | "expMonthly" | "expOnce", amount, fromYM, months (null = toujours) }
//  Effet d'un mois = cumul des effets de tous les mois projetés jusqu'à lui.
// ─────────────────────────────────────────────────────────────────
export function scenarioEffectForMonth(sc, ym) {
  const a = Math.abs(parseFloat(sc.amount) || 0);
  if (!a || !sc.fromYM || ym < sc.fromYM) return 0;
  if (sc.kind === "expOnce") return ym === sc.fromYM ? -a : 0;
  if (sc.months != null) {
    const [y0, m0] = sc.fromYM.split("-").map(Number), [y1, m1] = ym.split("-").map(Number);
    if ((y1 - y0) * 12 + (m1 - m0) >= sc.months) return 0;
  }
  return sc.kind === "incUp" ? a : -a;
}
export function simulateProjection(months, scenarios = []) {
  let cum = 0;
  return (months || []).map(m => {
    const eff = scenarios.reduce((s, sc) => s + scenarioEffectForMonth(sc, m.ym), 0);
    cum += eff;
    return { ...m, base: m.value, value: m.value + cum, effect: eff, cumEffect: cum };
  });
}


// ─────────────────────────────────────────────────────────────────
//  « Repéré pour toi » — v1.50.0 (page Fixes)
//  • rise    : récurrente dont le dernier montant confirmé dépasse la moyenne
//              des confirmations précédentes (≥ +5 % ET ≥ +1 €) et reste
//              supérieur au montant du modèle.
//  • regular : dépense sans modèle, même catégorie (+ même note), montant à
//              ±10 % de la médiane, présente au moins 3 des 4 derniers mois
//              (mois en cours compris), 1 fois par mois, jour à ±5 j, et non
//              couverte par un frais fixe / une récurrente de montant proche.
//  data.insightDismissed = { [clé]: valeur au moment du « Ignorer » }.
// ─────────────────────────────────────────────────────────────────
const normNote = n => (n || "").trim().toLowerCase().replace(/\s+/g, " ");
const near = (a, b, pct = 0.10) => b > 0 && Math.abs(a - b) <= b * pct;

export function detectInsights(data, today = todayISO()) {
  const out = [];
  const tx = data.transactions || [];
  const dis = data.insightDismissed || {};
  const curYM = today.slice(0, 7);

  // ── Hausses de prix sur les récurrentes ──
  (data.recurringTemplates || []).forEach(tpl => {
    if (tpl.type === "income") return;
    const conf = tx.filter(t => t.templateId === tpl.id).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (conf.length < 2) return;
    const last = parseFloat(conf[conf.length - 1].amount) || 0;
    const prevList = conf.slice(-7, -1).map(t => parseFloat(t.amount) || 0);
    const prev = prevList.reduce((s, a) => s + a, 0) / prevList.length;
    const tplAmt = parseFloat(tpl.amount) || 0;
    if (!(last >= prev * 1.05 && last - prev >= 1 && last > tplAmt + 0.004)) return;
    const key = `rise:${tpl.id}`;
    if (dis[key] != null && Math.abs(dis[key] - last) < 0.01) return;
    out.push({ kind: "rise", key, value: last, tpl, last, prev: Math.round(prev * 100) / 100,
      pct: Math.round((last - prev) / prev * 100), lastYM: (conf[conf.length - 1].date || "").slice(0, 7), count: prevList.length });
  });

  // ── Dépenses régulières non déclarées ──
  const win = [ymAdd(curYM, -3), ymAdd(curYM, -2), ymAdd(curYM, -1), curYM];
  const groups = {};
  tx.forEach(t => {
    if (t.type !== "expense" || t.templateId || t.isRounding || !t.categoryId) return;
    const ym = (t.date || "").slice(0, 7);
    if (!win.includes(ym)) return;
    const k = `${t.categoryId}|${normNote(t.note)}`;
    (groups[k] = groups[k] || []).push(t);
  });
  Object.entries(groups).forEach(([k, list]) => {
    const [catId, note] = k.split("|");
    const ref = median(list.map(t => parseFloat(t.amount) || 0));
    if (!(ref >= 5)) return;
    const hits = list.filter(t => near(parseFloat(t.amount) || 0, ref));
    const byMonth = {};
    hits.forEach(t => { const ym = t.date.slice(0, 7); (byMonth[ym] = byMonth[ym] || []).push(t); });
    const months = Object.keys(byMonth).sort();
    if (months.length < 3) return;
    if (months.some(ym => byMonth[ym].length > 1)) return;          // 1 fois par mois, pas des achats répétés
    if (list.length > hits.length + 1) return;                        // la catégorie+note n'est pas « régulière » à elle seule
    const days = months.map(ym => parseInt(byMonth[ym][0].date.slice(8, 10), 10));
    const day = Math.round(median(days));
    if (days.some(d => Math.abs(d - day) > 5)) return;
    const covered = (data.fixedExpenses || []).some(f => f.categoryId === catId && (isActiveForMonth(f, curYM) || (f.startYM && f.startYM > curYM)) && near(parseFloat(f.monthlyOverrides?.[curYM]?.amount ?? f.amount) || 0, ref))
      || (data.recurringTemplates || []).some(r => r.categoryId === catId && r.type !== "income" && near(parseFloat(r.amount) || 0, ref));
    if (covered) return;
    const key = `reg:${catId}:${note}`;
    if (dis[key] != null && near(ref, dis[key])) return;
    out.push({ kind: "regular", key, value: Math.round(ref * 100) / 100, catId, note: list.find(t => normNote(t.note) === note)?.note?.trim() || "",
      ref: Math.round(ref * 100) / 100, day, months: months.map(ym => ({ ym, amount: parseFloat(byMonth[ym][0].amount) || 0 })),
      thisMonth: !!byMonth[curYM] });
  });
  return out;
}

// ─────────────────────────────────────────────────────────────────
//  Surplus de fin de cycle → cagnotte — v1.50.0
//  = reste à vivre « disponible » (solde estimé − courses prévues −
//    prélèvements avant la paie − marge) − dépenses courantes estimées
//    jusqu'à la paie (médiane/jour des 3 derniers mois complets, hors
//    courses, récurrentes et arrondis). Proposé les 5 derniers jours du
//    cycle (avant la paie, ou fin de mois sans paie datée), si ≥ 20 €,
//    arrondi à la dizaine inférieure.
// ─────────────────────────────────────────────────────────────────
export function dailyVariableSpend(data, excludeCatIds = [], today = todayISO()) {
  const curYM = today.slice(0, 7);
  const first = firstDataYM(data.transactions || []);
  const ex = new Set(excludeCatIds);
  const vals = [1, 2, 3].map(i => ymAdd(curYM, -i)).filter(ym => ym >= first).map(ym => {
    const tot = (data.transactions || []).filter(t => t.type === "expense" && !t.templateId && !t.isRounding && !ex.has(t.categoryId) && (t.date || "").startsWith(ym))
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    return tot / lastDayOf(ym);
  });
  return vals.length ? Math.round(median(vals) * 100) / 100 : 0;
}

export function computeSurplus(data, breakdown, grocery, forecast, today = todayISO()) {
  if (!breakdown) return null;
  const r = computeRestToLive({ ...data, restSettings: { ...(data.restSettings || {}), enabled: true } }, breakdown, grocery, forecast, today);
  if (!r) return null;
  const curYM = today.slice(0, 7);
  const cycleEnd = r.payday || `${curYM}-${pad2(lastDayOf(curYM))}`;
  const daysLeft = r.payday ? daysBetweenISO(today, r.payday) : daysBetweenISO(today, cycleEnd) + 1;
  const perDay = dailyVariableSpend(data, grocery?.catIds || [], today);
  const daily = Math.round(perDay * r.days * 100) / 100;
  const raw = r.available - daily;
  const amount = Math.max(0, Math.floor(raw / 10) * 10);
  const inWindow = daysLeft >= 1 && daysLeft <= 5;
  const dismissed = (data.insightDismissed || {}).surplus === cycleEnd;
  return { ...r, cycleEnd, daysLeft, perDayVar: perDay, daily, raw: Math.round(raw * 100) / 100, amount,
    show: inWindow && amount >= 20 && !dismissed && (data.cagnottes || []).length > 0 };
}
