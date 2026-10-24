import { useMemo } from "react";
import { currentYM, isIncome, recurringRefDate, chequeExpiryISO, daysBetweenISO, todayISO, getPrevMonth, DEFAULT_CAG_TYPES, resolveFixedDay, fixedOccurrenceYM, fixedCashDateISO, isActiveForMonth, fixedAmountFor } from "./utils.js";

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
// v1.66.1 : déplacée dans utils.js (pure, partagée avec releve.js) — ré-exportée ici
export { isActiveForMonth };

export function effectiveFixesForMonth(fixedExpenses, ym) {
  return fixedExpenses.reduce((s, f) => {
    if (!isActiveForMonth(f, ym)) return s;
    return s + fixedAmountFor(f, ym);
  }, 0);
}

export function effectiveIncomesForMonth(fixedIncomes, ym) {
  // v1.50.0 : respecte la correction ponctuelle d'un mois (monthlyOverrides),
  // comme effectiveFixesForMonth — déjà le cas dans le rapprochement et la projection.
  return (fixedIncomes || []).reduce((s, f) => {
    if (!isActiveForMonth(f, ym)) return s;
    return s + (fixedAmountFor(f, ym));
  }, 0);
}

/**
 * v1.64.0 — Revenus fixes ARRIVÉS SUR LE COMPTE pendant le mois `cashYM`.
 * Identique à effectiveIncomesForMonth sauf pour un revenu « compté dans le
 * budget du mois suivant » (advance) : l'occurrence de M+1 est versée en M.
 * À utiliser pour tout calcul de SOLDE ; effectiveIncomesForMonth reste la
 * source pour le BUDGET (rapports, bilans).
 */
export function cashIncomesForMonth(fixedIncomes, cashYM) {
  return (fixedIncomes || []).reduce((s, f) => {
    const ym = fixedOccurrenceYM(f, cashYM);
    if (!isActiveForMonth(f, ym)) return s;
    return s + (fixedAmountFor(f, ym));
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
        return s + fixedAmountFor(f, ym);
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
        bal += cashIncomesForMonth(fixedIncomes, ym);
      });
    } else {
      bal -= effectiveFixesForMonth(fixedExpenses, currentYM());
      bal += cashIncomesForMonth(fixedIncomes, currentYM());
    }

    return bal;
  }, [transactions, fixedExpenses]);
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
export function computeReconciliation(transactions, fixedExpenses, fixedIncomes, curYM = currentYM(), today = null) {
  // v1.65.0 : un revenu fixe DATÉ n'entre dans le solde qu'à sa date de versement
  // (ou dès qu'il est pointé, s'il arrive en avance) — jamais « dès le 1er du mois ».
  // Sans `today` : aujourd'hui pour le mois en cours, fin de mois pour un mois passé.
  const asOf = today || (curYM === currentYM() ? todayISO() : `${curYM}-31`);
  let ptInc = 0, ptExp = 0, noPtInc = 0, noPtExp = 0;
  const pendingTx = [], pendingFixes = [], pendingIncomes = [], futureIncomes = [];

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
  allMonths.forEach(cym => {
    (fixedExpenses || []).forEach(f => {
      const ym = cym;
      if (!isActiveForMonth(f, ym)) return;
      totalFix++;
      const a  = fixedAmountFor(f, ym);
      if (f.pointedMonths?.[ym]) { ptExp += a; nbPtFix++; }
      else { noPtExp += a; pendingFixes.push({ f, ym, signed: -a }); }
    });
    // Revenus fixes : pointables au même titre que les frais fixes, avec
    // leur propre suivi mensuel (pointedMonths). v1.64.0 : `allMonths` sont des
    // mois de COMPTE → un revenu compté le mois suivant (advance) apporte ici
    // l'occurrence de M+1, versée en M (pointage et montant de M+1).
    (fixedIncomes || []).forEach(f => {
      const ym = fixedOccurrenceYM(f, cym);
      if (!isActiveForMonth(f, ym)) return;
      totalInc++;
      const a  = fixedAmountFor(f, ym);
      if (f.pointedMonths?.[ym]) { ptInc += a; nbPtInc++; return; }
      const date = fixedCashDateISO(f, ym);
      if (date && date > asOf) { totalInc--; futureIncomes.push({ f, ym, date, signed: a }); return; }
      noPtInc += a; pendingIncomes.push({ f, ym, signed: a });
    });
  });

  const pointableTxs = transactions.filter(t => isPointable(t.type));
  const nbPtTx = pointableTxs.filter(t => t.pointed).length;

  return {
    soldePointe:    ptInc  - ptExp,
    soldeAttente:   noPtInc - noPtExp,
    nbPointed:      nbPtTx + nbPtFix + nbPtInc,
    totalPointable: pointableTxs.length + totalFix + totalInc,
    pendingTx, pendingFixes, pendingIncomes, futureIncomes,
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
export function computeBalanceBreakdown(transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions, now = new Date(), reimbursements = [], lateDays = 15) {
  const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const curY  = now.getFullYear().toString();
  const pad = n => String(n).padStart(2, "0");
  const rec = computeReconciliation(transactions, fixedExpenses, fixedIncomes, curYM, `${curYM}-${pad(now.getDate())}`);

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
  // v1.69.0 : remboursements attendus (liés à une dépense) comptés dès qu'ils sont marqués,
  // jusqu'à leur réception (ils deviennent alors un revenu normal → jamais deux fois)
  const todayStr = `${curYM}-${String(now.getDate()).padStart(2, "0")}`;
  const expected = expectedReimbursements(reimbursements, transactions, todayStr, lateDays);
  const total = rec.soldePointe + pendingTotal + recurring.reduce((s, x) => s + x.signed, 0) + scheduled.reduce((s, x) => s + x.signed, 0) + expected.reduce((s, x) => s + x.signed, 0);

  return {
    pointed:   { total: rec.soldePointe, count: rec.nbPointed },
    pending:   {
      total:   pendingTotal,
      cheques: { total: sum(cheques), items: cheques },
      others:  { total: sum(others),  items: others },
      fixes:   { total: sum(rec.pendingFixes),   items: rec.pendingFixes },
      incomes: { total: sum(rec.pendingIncomes), items: rec.pendingIncomes },
    },
    futureIncomes: { total: sum(rec.futureIncomes), items: rec.futureIncomes },   // v1.65.0 : pas encore dans le solde
    recurring: { total: sum(recurring), items: recurring },
    scheduled: { total: sum(scheduled), items: scheduled },
    reimbursements: { total: sum(expected), items: expected },
    total,
  };
}

export function useBalanceBreakdown(transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions, reimbursements = [], lateDays = 15) {
  return useMemo(
    () => computeBalanceBreakdown(transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions, new Date(), reimbursements, lateDays),
    [transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions, reimbursements, lateDays]
  );
}

/**
 * v1.69.0 — Remboursements attendus comptés dans le solde estimé : liés à une
 * dépense existante, pas encore reçus. `late` = jours écoulés depuis la date
 * prévue (ou la dépense) au-delà du délai réglable (Options, 15 j par défaut).
 */
export function expectedReimbursements(reimbursements, transactions, today = todayISO(), lateDays = 15) {
  const byId = new Map((transactions || []).map(t => [t.id, t]));
  // v1.69.1 : un « À recevoir » saisi seul (sans dépense liée) est compté aussi
  return (reimbursements || []).filter(r => r.status !== "received").map(r => {
    const tx = (r.txId && byId.get(r.txId)) || null;
    const ref = r.expectedDate || tx?.date || r.createdAt;
    const age = ref && ref < today ? daysBetweenISO(ref, today) : 0;
    return { r, tx, signed: Math.round((parseFloat(r.amount) || 0) * 100) / 100, late: age > lateDays ? age : 0 };
  });
}
/** v1.69.0 — Montant remboursé (attendu ou reçu) par dépense : { [txId]: montant } */
export function reimbursedByTx(reimbursements) {
  const m = {};
  (reimbursements || []).forEach(r => { if (r.txId) m[r.txId] = (m[r.txId] || 0) + (parseFloat(r.amount) || 0); });
  return m;
}

export function useBalanceWithRecurring(transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions, reimbursements = [], lateDays = 15) {
  // Le solde estimé = total de computeBalanceBreakdown : le chiffre de la
  // carte et le panneau « Calcul du solde » viennent du même calcul.
  return useBalanceBreakdown(transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions, reimbursements, lateDays).total;
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

// v1.62.0 : useVariableCashflowMedian et useBalanceProjection remplacés par
// computeProjection (plus bas), qui corrige la fin du mois en cours, les mois
// sans données, les récurrentes annuelles et cherche le point bas jour par jour.

// ─────────────────────────────────────────────────────────────────
//  Fiabilité de la projection (v1.39.14)
//  Compare, pour chaque mois désormais PASSÉ, ce que la toute première
//  projection avait annoncé (projectionSnapshots, figé une fois pour
//  toutes) avec le solde réellement atteint à la fin de ce mois-là.
// ─────────────────────────────────────────────────────────────────
function balanceAsOfEndOfMonth(transactions, fixedExpenses, fixedIncomes, targetYM) {
  // v1.62.0 : même définition que le solde estimé (rapprochement) — opérations
  // d'équilibre comprises (avant : ignorées → faux écarts dans la fiabilité)
  let bal = 0;
  transactions.forEach(t => {
    if (t.date.slice(0, 7) > targetYM || !isPointable(t.type)) return;
    const a = parseFloat(t.amount) || 0;
    bal += isIncomeDirection(t) ? a : -a;
  });
  if (transactions.length > 0) {
    const startYM = firstDataYM(transactions);
    if (startYM <= targetYM) {
      monthRange(startYM, targetYM).forEach(ym => {
        bal -= effectiveFixesForMonth(fixedExpenses, ym);
        bal += cashIncomesForMonth(fixedIncomes, ym);
      });
    }
  }
  return bal;
}

/** v1.62.0 : seules les projections faites le mois d'avant (horizon 1) sont comparées */
export function computeProjectionAccuracy(transactions, fixedExpenses, fixedIncomes, projectionSnapshots, curYM = currentYM()) {
  const items = [];
  Object.entries(projectionSnapshots || {}).forEach(([ym, snap]) => {
    if (ym >= curYM || snap?.horizon !== 1) return;
    const actual = balanceAsOfEndOfMonth(transactions, fixedExpenses, fixedIncomes, ym);
    items.push({ ym, predicted: snap.predictedValue, actual, delta: actual - snap.predictedValue });
  });
  items.sort((a, b) => b.ym.localeCompare(a.ym));
  const last = items.slice(0, 6);
  const avgAbs = last.length ? last.reduce((s, a) => s + Math.abs(a.delta), 0) / last.length : null;
  const avgSigned = last.length ? last.reduce((s, a) => s + a.delta, 0) / last.length : null;
  return { items, avgAbs, avgSigned, n: last.length };
}

export function useProjectionAccuracy(transactions, fixedExpenses, fixedIncomes, projectionSnapshots) {
  return useMemo(() => computeProjectionAccuracy(transactions, fixedExpenses, fixedIncomes, projectionSnapshots),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [transactions, fixedExpenses, fixedIncomes, projectionSnapshots]);
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

export function computeGroceryBudget(transactions, categories, settings, now = new Date(), reimbursements = []) {
  if (settings && settings.enabled === false) return null;
  const catIds = groceryCategoryIds(categories, settings);
  if (catIds.length === 0) return null;
  const cats = new Set(catIds);
  const ymOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const curYM = ymOf(now);
  const txs = transactions || [];
  const firstYM = txs.length ? txs.reduce((m, t) => (t.date < m ? t.date : m), txs[0].date).slice(0, 7) : curYM;
  const isGrocery = t => t.type === "expense" && cats.has(t.categoryId) && !t.templateId && !t.isRounding;
  // v1.69.0 : la part remboursée (attendue ou reçue) d'une dépense n'est pas « tes » courses
  const reimb = reimbursedByTx(reimbursements);
  const sumMonth = ym => {
    let total = 0, count = 0, refunded = 0;
    const items = [];
    txs.forEach(t => {
      if (!isGrocery(t) || !t.date.startsWith(ym)) return;
      const a = parseFloat(t.amount) || 0, back = Math.min(a, reimb[t.id] || 0);
      total += a - back; refunded += back; count++;
      if (back > 0) items.push({ t, amount: Math.round(back * 100) / 100 });
    });
    return { ym, total: Math.round(total * 100) / 100, count, refunded: Math.round(refunded * 100) / 100, refundItems: items };
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
           refunded: current.refunded, refundItems: current.refundItems,
           day: now.getDate(), daysInMonth, weight };
}

export function useGroceryBudget(transactions, categories, settings, reimbursements = []) {
  return useMemo(() => computeGroceryBudget(transactions, categories, settings, new Date(), reimbursements),
    [transactions, categories, settings, reimbursements]);
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
    .reduce((s, f) => s + (fixedAmountFor(f, ym)), 0);
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
  // v1.53.1 : mêmes revenus / dépenses que le Rapport et le Bilan (source unique)
  const t = computeMonthTotals(data.transactions || [], data.fixedExpenses || [], data.fixedIncomes || [], ym);
  return { exp: t.exp, inc: t.inc, sav: t.sav - t.decag, txs };
}
function catSpend(data, ym) {
  const map = {};
  const add = (id, a) => { const k = id ? catRootId(data.categories, id) : "__none__"; map[k] = (map[k] || 0) + a; };
  (data.transactions || []).forEach(t => { if (t.type === "expense" && (t.date || "").startsWith(ym)) add(t.categoryId, parseFloat(t.amount) || 0); });
  (data.fixedExpenses || []).forEach(f => {
    if (!isActiveForMonth(f, ym)) return;
    add(f.categoryId, fixedAmountFor(f, ym));
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
      bal += cashIncomesForMonth(data.fixedIncomes || [], m);
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
  const grocery = computeGroceryBudget(data.transactions, data.categories, data.groceryBudget, lastDay, data.reimbursements);
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
    savingsRate: cur.inc > 0 ? cur.sav / cur.inc : null,   // v1.68.0
    savingsCags: new Set(cur.txs.filter(t => t.type === "epargne").map(t => t.targetCagId)).size,
    endBalance: endBal, balanceDelta: startBal == null ? null : endBal - startBal,
    movers, grocery, tagBudgets,
    unpointed: unpointedTx + unpointedFix,
    cheques: cheques.length, oldestChequeDays: cheques[0]?.age ?? null,
    hasData: cur.txs.length > 0 || cur.exp > 0 || cur.inc > 0,
    payCheck: payRecapCheck(data, ym),
  };
}

/**
 * v1.67.0 — Bilan du 1er : reste du mois photographié à la paie vs reste final.
 * Le reste final est compté AVANT la mise de côté faite à la paie (sinon on
 * comparerait un montant déjà épargné), pour mesurer ce qui a été dépensé depuis.
 */
export function payRecapCheck(data, ym) {
  const snap = data.payRecaps?.[ym];
  if (!snap || snap.rest == null) return null;
  const saved = snap.saved || 0;
  const r2 = n => Math.round(n * 100) / 100;
  const finalRest = r2(computePayRecap(data, ym).rest + saved);
  return { date: snap.date, rest: snap.rest, saved, finalRest, diff: r2(finalRest - snap.rest), over: saved > 0 && saved > finalRest ? r2(saved - finalRest) : 0 };
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
    // v1.53.1 : une dissolution de cagnotte n'est PAS un revenu (c'est ton argent
    // qui revient sur le compte) → comptée avec les retraits de cagnotte, comme
    // dans le bilan du 1ᵉʳ du mois. Les soldes, eux, la comptent toujours.
    if (t.type === "income")            incTx += a;
    else if (t.type === "expense")      expTx += a;
    else if (t.type === "epargne")      sav   += a;
    else if (t.type === "decagnottage" || t.type === "dissolution_cagnotte") decag += a;
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
        ? fixedAmountFor(f, ym)
        : (fixedAmountFor(f, ym));
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
  // v1.64.0 : accepte aussi les règles « dernier / avant-dernier jour ouvré » (-1 / -2)
  const d = resolveFixedDay(day, ym) || 1;
  return `${ym}-${pad2(d)}`;
}
const addDaysISO = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`; };

/** Prochaine paie = prochaine date du revenu fixe daté le plus élevé */
export function nextPayday(data, today = todayISO()) {
  const curYM = today.slice(0, 7);
  const main = mainPayIncome(data);
  if (!main) return null;
  // v1.64.0 : occurrences par date réelle de versement (revenu compté le mois suivant compris)
  for (let i = 0; i <= 3; i++) {
    const ym = fixedOccurrenceYM(main, ymAdd(curYM, i));
    if (!isActiveForMonth(main, ym) || main.pointedMonths?.[ym]) continue;
    const d = fixedCashDateISO(main, ym);
    if (d > today) return { date: d, income: main, ym };
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
/**
 * v1.62.0 — Mois en cours : ce que le solde estimé a DÉJÀ compté (fixes et revenus
 * fixes non pointés datés après aujourd'hui, récurrentes, programmées du mois),
 * ré-étalé à sa date. Retourne le solde de départ « avant ces opérations » et la
 * liste des opérations datées. Source unique pour le solde jour par jour
 * (computeDailyForecast) et la projection (computeProjection).
 */
export function pendingEventsThisMonth(data, breakdown, today = todayISO()) {
  const curYM = today.slice(0, 7);
  const cats = data.categories || [];
  const events = [];
  let addBack = 0;
  const ev = (date, amount, label, kind, extra = {}) => events.push({ date, amount, label, kind, ...extra });
  (data.fixedExpenses || []).forEach(f => {
    if (!f.day || !isActiveForMonth(f, curYM) || f.pointedMonths?.[curYM]) return;
    const d = dayInMonthISO(f.day, curYM); if (d <= today) return;
    const a = fixedAmountFor(f, curYM);
    ev(d, -a, f.name, "fix", { icon: cats.find(c => c.id === f.categoryId)?.icon || "📌" }); addBack += a;
  });
  (data.fixedIncomes || []).forEach(f => {
    const ym = fixedOccurrenceYM(f, curYM);   // v1.64.0 : occurrence versée ce mois-ci
    if (!f.day || !isActiveForMonth(f, ym) || f.pointedMonths?.[ym]) return;
    const d = fixedCashDateISO(f, ym); if (d <= today) return;
    const a = fixedAmountFor(f, ym);
    // v1.65.0 : un revenu daté après aujourd'hui n'est PAS dans le solde estimé → rien à retirer
    ev(d, a, f.name, "inc", { icon: cats.find(c => c.id === f.categoryId)?.icon || "💰", id: f.id, occYM: ym });
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
  return { start: (breakdown?.total || 0) + addBack, events };
}

export function computeDailyForecast(data, breakdown, grocery, today = todayISO()) {
  const curYM = today.slice(0, 7);
  const pay = nextPayday(data, today);
  const end = pay ? pay.date : `${curYM}-${pad2(lastDayOf(curYM))}`;
  const cats = data.categories || [];
  // 1) Mois en cours : ce que le solde estimé a déjà compté, ré-étalé à sa date
  const cur = pendingEventsThisMonth(data, breakdown, today);
  const events = cur.events;
  // v1.64.0 : la paie peut tomber ce mois-ci (ex. avant-dernier jour ouvré)
  events.forEach(e => { if (pay && e.kind === "inc" && e.id === pay.income.id && e.date === pay.date) e.isPay = true; });
  const ev = (date, amount, label, kind, extra = {}) => events.push({ date, amount, label, kind, ...extra });
  const start = cur.start;

  // 2) Mois suivants jusqu'à la paie (pas encore dans le solde estimé)
  if (end.slice(0, 7) > curYM) {
    monthRange(ymAdd(curYM, 1), end.slice(0, 7)).forEach(ym => {
      (data.fixedExpenses || []).forEach(f => {
        if (!f.day || !isActiveForMonth(f, ym)) return;
        const d = dayInMonthISO(f.day, ym); if (d > end) return;
        ev(d, -(fixedAmountFor(f, ym)), f.name, "fix", { icon: cats.find(c => c.id === f.categoryId)?.icon || "📌", next: true });
      });
      (data.fixedIncomes || []).forEach(f => {
        const oym = fixedOccurrenceYM(f, ym);
        if (!f.day || !isActiveForMonth(f, oym)) return;
        const d = fixedCashDateISO(f, oym); if (d > end) return;
        ev(d, fixedAmountFor(f, oym), f.name, "inc", { icon: cats.find(c => c.id === f.categoryId)?.icon || "💰", next: true, isPay: pay && f.id === pay.income.id && d === pay.date });
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
  // v1.65.0 : les revenus datés ne sont dans le solde qu'à leur date → ceux qui
  // arrivent AVANT la paie (ex. une allocation le 20) s'ajoutent au disponible.
  const incBeforePay = payday ? (forecast.events || []).filter(e => e.kind === "inc" && e.amount > 0 && e.date > today && e.date < payday).reduce((s, e) => s + e.amount, 0) : 0;
  const available = breakdown.total + incBeforePay - groceries - nextBeforePay - margin;
  return { base: breakdown.total, incBeforePay: Math.round(incBeforePay * 100) / 100, groceries: Math.round(groceries * 100) / 100, nextBeforePay: Math.round(nextBeforePay * 100) / 100, margin,
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
    const covered = (data.fixedExpenses || []).some(f => f.categoryId === catId && (isActiveForMonth(f, curYM) || (f.startYM && f.startYM > curYM)) && near(fixedAmountFor(f, curYM), ref))
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

// ─────────────────────────────────────────────────────────────────
//  Répartition par catégorie sur une période — v1.52.0 (Rapport → Catégories)
//  Même règle que l'ancien « Top 5 dépenses » : une sous-catégorie compte
//  dans sa catégorie principale, et les revenus de la même catégorie (ou
//  d'une catégorie liée) sont déduits (coût net).
//  v1.76.0 : chaque frais fixe compte dans SA catégorie (avant : une ligne
//  « Frais fixes » à part) — même règle que les budgets, « Ce qui a bougé »
//  et le détail d'une catégorie. Un frais fixe sans catégorie va dans
//  « Sans catégorie ». Total inchangé ; fixTotal = somme des frais fixes.
//  → { rows: [{ id, gross, deducted, net, subs, fixed, fixes }], total, fixTotal }
// ─────────────────────────────────────────────────────────────────
export function computeCategoryBreakdown(data, fromYM, toYM) {
  const cats = data.categories || [];
  const inP = d => { const ym = (d || "").slice(0, 7); return ym >= fromYM && ym <= toYM; };
  const exp = {}, sub = {}, ded = {}, dedSeen = new Set();
  (data.transactions || []).forEach(t => {
    if (t.type !== "expense" || !inP(t.date)) return;
    const a = parseFloat(t.amount) || 0;
    const root = (t.categoryId && catRootId(cats, t.categoryId)) || "__other__";
    exp[root] = (exp[root] || 0) + a;
    if (t.categoryId && root !== t.categoryId) {
      sub[root] = sub[root] || {};
      sub[root][t.categoryId] = (sub[root][t.categoryId] || 0) + a;
    }
  });
  (data.transactions || []).forEach(t => {
    if (!isIncome(t.type) || t.type === "dissolution_cagnotte" || !inP(t.date)) return;
    const a = parseFloat(t.amount) || 0;
    const cat = cats.find(c => c.id === t.categoryId);
    const lk = cat?.linkedToId ? catRootId(cats, cat.linkedToId) : null;
    const own = t.categoryId ? catRootId(cats, t.categoryId) : null;
    if (lk && exp[lk]) { ded[lk] = (ded[lk] || 0) + a; dedSeen.add(t.id); }
    else if (own && exp[own]) { ded[own] = (ded[own] || 0) + a; dedSeen.add(t.id); }
  });
  // v1.69.0 : remboursement attendu (pas encore reçu) déduit de la catégorie de sa dépense
  const txById = new Map((data.transactions || []).map(t => [t.id, t]));
  (data.reimbursements || []).forEach(r => {
    if (r.status === "received" || !r.txId) return;
    const t = txById.get(r.txId);
    if (!t || t.type !== "expense" || !inP(t.date)) return;
    const root = (t.categoryId && catRootId(cats, t.categoryId)) || "__other__";
    if (exp[root]) ded[root] = (ded[root] || 0) + (parseFloat(r.amount) || 0);
  });
  // Frais fixes : mêmes mois et mêmes montants que computePeriodTotals (fixExp)
  const fixAmt = {}, fixList = {};
  let fixTotal = 0;
  fixedLinesForPeriod(data.fixedExpenses || [], livedMonths(data.transactions || [], fromYM, toYM), "expense").forEach(({ f, total }) => {
    if (!(total > 0)) return;
    const known = f.categoryId && cats.some(c => c.id === f.categoryId);
    const root = known ? catRootId(cats, f.categoryId) : "__other__";
    exp[root] = (exp[root] || 0) + total;
    fixAmt[root] = (fixAmt[root] || 0) + total;
    (fixList[root] = fixList[root] || []).push({ id: f.id, name: f.name, categoryId: known ? f.categoryId : null, amount: total });
    if (known && root !== f.categoryId) {
      sub[root] = sub[root] || {};
      sub[root][f.categoryId] = (sub[root][f.categoryId] || 0) + total;
    }
    fixTotal += total;
  });
  // Revenus liés : déduits aussi d'une catégorie qui n'a que des frais fixes
  (data.transactions || []).forEach(t => {
    if (!isIncome(t.type) || t.type === "dissolution_cagnotte" || !inP(t.date)) return;
    const a = parseFloat(t.amount) || 0;
    const cat = cats.find(c => c.id === t.categoryId);
    const lk = cat?.linkedToId ? catRootId(cats, cat.linkedToId) : null;
    const own = t.categoryId ? catRootId(cats, t.categoryId) : null;
    const target = lk && exp[lk] ? lk : own && exp[own] ? own : null;
    if (target && !dedSeen.has(t.id)) ded[target] = (ded[target] || 0) + a;
  });
  const rows = Object.keys(exp).map(id => ({
    id, gross: exp[id], deducted: Math.min(exp[id], ded[id] || 0), net: Math.max(0, exp[id] - (ded[id] || 0)),
    subs: Object.entries(sub[id] || {}).map(([cid, amount]) => ({ id: cid, amount })).sort((a, b) => b.amount - a.amount),
    fixed: fixAmt[id] || 0,
    fixes: (fixList[id] || []).sort((a, b) => b.amount - a.amount),
  }));
  rows.sort((a, b) => b.net - a.net);
  return { rows, total: rows.reduce((s, r) => s + r.net, 0), fixTotal };
}

// ─────────────────────────────────────────────────────────────────
//  computeCagnottesSummary — v1.57.0 : récap de l'écran Cagnottes
//  Versé / retiré = mêmes règles que le Rapport (computeMonthTotals /
//  computePeriodTotals : épargne vs décagnottage + dissolution).
//  Objectif annuel = savingsGoals[année] comparé au versé de l'année,
//  exactement comme la carte « Objectif » du Rapport.
//  Purement informatif : ne modifie aucun solde.
// ─────────────────────────────────────────────────────────────────
export function computeCagnottesSummary(data, ym = currentYM()) {
  const txs = data.transactions || [];
  const cags = data.cagnottes || [];
  const types = data.cagTypes || DEFAULT_CAG_TYPES;
  const amt = c => parseFloat(c.current) || 0;
  const total = cags.reduce((s, c) => s + amt(c), 0);

  // Répartition par type (types dans l'ordre choisi, « Sans type » en dernier)
  const known = new Set(types.map(t => t.id));
  const byType = types
    .map(t => { const list = cags.filter(c => c.cagType === t.id); return { id: t.id, icon: t.icon, label: t.label, color: t.color, count: list.length, amount: list.reduce((s, c) => s + amt(c), 0) }; })
    .filter(t => t.count > 0);
  const untyped = cags.filter(c => !c.cagType || !known.has(c.cagType));
  if (untyped.length) byType.push({ id: null, icon: "🐷", label: "Sans type", color: "var(--khaki)", count: untyped.length, amount: untyped.reduce((s, c) => s + amt(c), 0) });
  const pos = byType.reduce((s, t) => s + Math.max(0, t.amount), 0);
  byType.forEach(t => { t.pct = pos > 0 ? Math.max(0, t.amount) / pos * 100 : 0; });

  const flows = (sav, decag) => ({ sav, decag, net: sav - decag });
  const m = computeMonthTotals(txs, data.fixedExpenses, data.fixedIncomes, ym);
  const prevYM = getPrevMonth(ym);
  const p = computeMonthTotals(txs, data.fixedExpenses, data.fixedIncomes, prevYM);
  const year = ym.slice(0, 4);
  const y = computePeriodTotals(txs, data.fixedExpenses, data.fixedIncomes, `${year}-01`, `${year}-12`);
  const goal = parseFloat((data.savingsGoals || {})[year]) || 0;

  // Objectifs des cagnottes : part atteinte (plafonnée à l'objectif de chacune)
  const withTarget = cags.filter(c => parseFloat(c.target) > 0);
  const objTarget = withTarget.reduce((s, c) => s + parseFloat(c.target), 0);
  const objSaved  = withTarget.reduce((s, c) => s + Math.min(Math.max(0, amt(c)), parseFloat(c.target)), 0);

  const plans = (data.autoSavings || []).filter(a => a.enabled && cags.some(c => c.id === a.cagnotteId));
  const roundCag = data.roundingEnabled ? cags.find(c => c.id === data.roundingCagnotteId) : null;
  const roundingMonth = txs.filter(t => t.isRounding && (t.date || "").startsWith(ym)).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  return {
    total, byType, ym, prevYM, year,
    month: flows(m.sav, m.decag),
    prev:  flows(p.sav, p.decag),
    yearFlows: flows(y.sav, y.decag),
    goal, goalPct: goal > 0 ? y.sav / goal * 100 : null,
    objectives: { count: withTarget.length, saved: objSaved, target: objTarget, pct: objTarget > 0 ? objSaved / objTarget * 100 : null },
    auto: { count: plans.length, monthly: plans.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0) },
    rounding: { cag: roundCag || null, month: roundingMonth },
  };
}

// ─────────────────────────────────────────────────────────────────
//  computeProjection — v1.62.0 : projection du solde JOUR PAR JOUR
//  (remplace useBalanceProjection / useVariableCashflowMedian).
//  Corrections par rapport à l'ancienne projection :
//   • le reste des dépenses courantes du mois en cours est déduit
//     (avant : la projection partait du solde du jour et ajoutait des
//     mois complets → trop optimiste de ~la moitié d'un mois) ;
//   • le flux courant ne compte que les mois réellement vécus (avant :
//     les mois sans aucune donnée comptaient pour 0 dans la médiane) ;
//   • les récurrentes annuelles retombent au mois de leur dernière
//     occurrence ;
//   • le point bas est cherché jour par jour (souvent la veille de la paie),
//     pas seulement en fin de mois ;
//   • fourchette (quartiles du flux courant) et détail ligne par ligne.
//  Part du solde estimé (breakdown.total) : même source que la carte.
// ─────────────────────────────────────────────────────────────────
const PROJ_MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
function quantile(sorted, p) {
  if (sorted.length < 3) return null;
  const pos = (sorted.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
/** Flux courant net d'un mois : dépenses et revenus ponctuels (hors récurrentes, arrondis, cagnottes) */
export function variableNetForMonth(transactions, ym, excludeIncomeCats = null) {
  return (transactions || []).reduce((s, t) => {
    if (t.templateId || t.isRounding || !(t.date || "").startsWith(ym)) return s;
    // v1.68.0 : un revenu saisi à la main dans la catégorie d'un revenu fixe (ancien salaire
    // saisi le 1er) n'est pas du « flux courant » : le revenu fixe le compte déjà
    if (t.type === "income" && excludeIncomeCats?.has(t.categoryId)) return s;
    const a = parseFloat(t.amount) || 0;
    return t.type === "expense" ? s - a : t.type === "income" ? s + a : s;
  }, 0);
}

export function computeProjection(data, breakdown, { today = todayISO(), monthsAhead = 3, alertThreshold = null } = {}) {
  const tx = data.transactions || [];
  const cats = data.categories || [];
  const icon = (id, def) => cats.find(c => c.id === id)?.icon || def;
  const curYM = today.slice(0, 7);
  const first = firstDataYM(tx);
  const r2 = n => Math.round(n * 100) / 100;

  // 1) Flux courant : mois COMPLETS réellement vécus (6 au plus)
  const hist = [];
  const fixedIncCats = new Set((data.fixedIncomes || []).map(f => f.categoryId).filter(Boolean));
  for (let i = 1; i <= 6; i++) { const ym = ymAdd(curYM, -i); if (ym < first) break; hist.push(variableNetForMonth(tx, ym, fixedIncCats)); }
  const med = median(hist);
  const sorted = [...hist].sort((a, b) => a - b);
  const p25 = quantile(sorted, .25), p75 = quantile(sorted, .75);

  // 2) Mois en cours : opérations déjà comptées dans le solde, ré-étalées à leur date,
  //    + reste des dépenses courantes habituelles (jamais un ajout : on ne compte pas
  //    sur un revenu ponctuel pas encore reçu)
  const cur = pendingEventsThisMonth(data, breakdown, today);
  const soFar = variableNetForMonth(tx, curYM, fixedIncCats);
  const remCur = Math.min(0, med - soFar);
  const daysLeftCur = lastDayOf(curYM) - parseInt(today.slice(8, 10), 10);

  // 3) Mois suivants : opérations connues + flux courant habituel
  const pay = nextPayday(data, today);
  const payId = pay?.income?.id;
  const months = [];
  const evByDate = {};
  const addEv = e => { (evByDate[e.date] = evByDate[e.date] || []).push(e); };
  cur.events.forEach(e => addEv({ ...e, ym: curYM, isPay: e.kind === "inc" && !!payId && e.id === payId }));
  const recConfirmed = tpl => tx.filter(t => t.templateId === tpl.id);
  for (let i = 1; i <= monthsAhead; i++) {
    const ym = ymAdd(curYM, i);
    const lines = [];
    const push = (date, amount, label, kind, ic, extra = {}) => {
      if (!amount) return;
      const e = { date, amount, label, kind, icon: ic, ym, ...extra };
      lines.push(e); addEv(e);
    };
    (data.fixedIncomes || []).forEach(f => {
      const oym = fixedOccurrenceYM(f, ym);   // v1.64.0 : occurrence versée ce mois-là
      if (!isActiveForMonth(f, oym)) return;
      const a = fixedAmountFor(f, oym);
      push(f.day ? fixedCashDateISO(f, oym) : `${ym}-01`, a, f.name, "inc", icon(f.categoryId, "💰"), { isPay: f.id === payId });
    });
    (data.fixedExpenses || []).forEach(f => {
      if (!isActiveForMonth(f, ym)) return;
      const a = fixedAmountFor(f, ym);
      push(dayInMonthISO(f.day || 1, ym), -a, f.name, "fix", icon(f.categoryId, "📌"));
    });
    (data.recurringTemplates || []).forEach(tpl => {
      const amount = parseFloat(tpl.amount) || 0;
      if (amount <= 0) return;
      const conf = recConfirmed(tpl);
      const last = conf.map(recurringRefDate).sort().pop();
      const signed = tpl.type === "income" ? amount : -amount;
      const label = tpl.label || tpl.note || cats.find(c => c.id === tpl.categoryId)?.name || "Récurrente";
      if (tpl.frequency === "yearly") {
        // Retombe au mois de sa dernière occurrence, si pas déjà faite cette année-là
        if (!last || last.slice(5, 7) !== ym.slice(5, 7)) return;
        if (tpl.occurrences != null && conf.length >= tpl.occurrences) return;
        if (conf.some(t => recurringRefDate(t).startsWith(ym.slice(0, 4)))) return;
        push(dayInMonthISO(parseInt(last.slice(8, 10), 10), ym), signed, label, "rec", icon(tpl.categoryId, "🔄"), { yearly: true });
        return;
      }
      if (tpl.frequency !== "monthly") return;
      if (tpl.occurrences != null) {
        // le mois en cours non confirmé est déjà anticipé dans le solde → compte pour une occurrence
        const doneThisMonth = conf.some(t => recurringRefDate(t).startsWith(curYM));
        if ((doneThisMonth ? conf.length : conf.length + 1) + i > tpl.occurrences) return;
      }
      push(dayInMonthISO(last ? parseInt(last.slice(8, 10), 10) : 1, ym), signed, label, "rec", icon(tpl.categoryId, "🔄"));
    });
    (data.scheduledTransactions || []).forEach(s => {
      if (!(s.date || "").startsWith(ym)) return;
      push(s.date, -(parseFloat(s.amount) || 0), s.note || "Programmée", "sch", icon(s.categoryId, "📅"), { s });
    });
    months.push({ ym, label: PROJ_MONTHS[parseInt(ym.slice(5, 7), 10) - 1], lines, variable: med });
  }

  // 4) Simulation jour par jour (dépenses du jour avant les rentrées : point bas = veille de paie)
  const lastYM = ymAdd(curYM, monthsAhead);
  const end = `${lastYM}-${pad2(lastDayOf(lastYM))}`;
  let bal = cur.start;
  let low = null, breach = null;
  const days = [];
  const monthEnd = {};
  for (let d = today; d <= end; d = addDaysISO(d, 1)) {
    const ym = d.slice(0, 7);
    if (d > today) bal += ym === curYM ? (daysLeftCur > 0 ? remCur / daysLeftCur : 0) : med / lastDayOf(ym);
    const evs = evByDate[d] || [];
    bal += evs.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    if (low == null || bal < low.balance) low = { date: d, balance: r2(bal), beforePay: evs.some(e => e.isPay) };
    if (breach == null && alertThreshold != null && alertThreshold > 0 && bal < alertThreshold) breach = { date: d, ym };
    bal += evs.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    days.push({ date: d, balance: r2(bal) });
    if (d === `${ym}-${pad2(lastDayOf(ym))}`) monthEnd[ym] = bal;
  }
  // Point bas la veille d'une paie : on le signale
  if (low && !low.beforePay) {
    const next = evByDate[addDaysISO(low.date, 1)] || [];
    low.beforePay = next.some(e => e.isPay);
  }

  // 5) Résultat par mois (fin de mois) + fourchette (quartiles du flux courant)
  const curEnd = monthEnd[curYM] ?? cur.start + remCur;
  const outMonths = months.map((m, k) => {
    const value = r2(monthEnd[m.ym]);
    const prev = k === 0 ? curEnd : monthEnd[months[k - 1].ym];
    const range = p25 != null ? { low: r2(value + (k + 1) * (p25 - med)), high: r2(value + (k + 1) * (p75 - med)) } : null;
    const schedItems = m.lines.filter(l => l.kind === "sch").map(l => l.s);
    return { ...m, value, start: r2(prev), delta: r2(value - prev), range, schedItems };
  });
  let biggestSchedMonth = null, biggestSchedItem = null;
  outMonths.forEach(m => m.schedItems.forEach(sc => {
    if (!biggestSchedItem || (parseFloat(sc.amount) || 0) > (parseFloat(biggestSchedItem.amount) || 0)) { biggestSchedItem = sc; biggestSchedMonth = m; }
  }));
  const lowYM = low?.date.slice(0, 7);
  const lowK = outMonths.findIndex(m => m.ym === lowYM);
  const lowRange = p25 != null && low ? { low: r2(low.balance + (lowK + 1) * (p25 - med)), high: r2(low.balance + (lowK + 1) * (p75 - med)) } : null;

  return {
    start: r2(breakdown?.total || 0),
    current: { ym: curYM, label: PROJ_MONTHS[parseInt(curYM.slice(5, 7), 10) - 1], value: r2(curEnd), remainingVariable: r2(remCur), soFarVariable: r2(soFar), events: cur.events },
    months: outMonths,
    days,
    low: low ? { ...low, ym: lowYM, label: PROJ_MONTHS[parseInt(lowYM.slice(5, 7), 10) - 1], range: lowRange } : null,
    variableNetMedian: r2(med), historyMonths: hist.length,
    thresholdBreachMonth: breach ? { ...breach, label: PROJ_MONTHS[parseInt(breach.ym.slice(5, 7), 10) - 1] } : null,
    biggestSchedMonth, biggestSchedItem,
  };
}

// ─────────────────────────────────────────────────────────────────
//  v1.66.0 — Récap affiché au pointage du salaire : bilan simple du mois
//  qui se termine (mois de BUDGET, mêmes chiffres que Rapport / Bilan via
//  computeMonthTotals) et somme à mettre de côté = reste du mois (après
//  l'épargne déjà versée), arrondi à la dizaine inférieure.
// ─────────────────────────────────────────────────────────────────
export function computePayRecap(data, ym) {
  const tx = data.transactions || [];
  const t = computeMonthTotals(tx, data.fixedExpenses || [], data.fixedIncomes || [], ym);
  const r2 = n => Math.round(n * 100) / 100;
  const saved = r2(t.sav - t.decag);
  const rest = r2(t.inc - t.exp - saved);
  const toSave = rest > 0 ? Math.floor(rest / 10) * 10 : 0;
  return { ym, incomes: r2(t.inc), fixed: r2(t.fixExp), variable: r2(t.expVar), saved, rest, toSave,
    // v1.68.0 : taux d'épargne avant / après la mise de côté proposée + moyenne 12 mois
    rate: t.inc > 0 ? saved / t.inc : null, rateAfter: t.inc > 0 ? (saved + toSave) / t.inc : null,
    avg12: computeSavingsRates(data, ym, 12).avg };
}

/** Revenu fixe principal (la paie) : le revenu daté le plus élevé — même règle que nextPayday */
export function mainPayIncome(data) {
  const dated = (data.fixedIncomes || []).filter(f => f.day);
  return dated.length ? [...dated].sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))[0] : null;
}

// ─────────────────────────────────────────────────────────────────
//  v1.68.0 — Taux d'épargne = (versements en cagnottes − retraits) ÷ revenus
//  du mois (mois de budget, mêmes chiffres que Rapport / Bilan). Source unique
//  pour le récap à la paie, le bilan du 1er, le Rapport et le bilan de l'année.
// ─────────────────────────────────────────────────────────────────
export function savingsRateOf(t) {
  return t && t.inc > 0 ? (t.sav - t.decag) / t.inc : null;
}
/** Taux des `n` mois finissant à `endYM` (mois vécus seulement) + moyenne pondérée */
export function computeSavingsRates(data, endYM, n = 12) {
  const tx = data.transactions || [];
  const first = firstDataYM(tx), cur = currentYM();
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const ym = ymAdd(endYM, -i);
    if (ym < first || ym > cur) { months.push({ ym, rate: null, saved: 0, inc: 0 }); continue; }
    const t = computeMonthTotals(tx, data.fixedExpenses || [], data.fixedIncomes || [], ym, first, cur);
    months.push({ ym, inc: t.inc, saved: t.sav - t.decag, rate: savingsRateOf(t) });
  }
  const lived = months.filter(m => m.rate != null);
  const inc = lived.reduce((s, m) => s + m.inc, 0), saved = lived.reduce((s, m) => s + m.saved, 0);
  return { months, avg: inc > 0 ? saved / inc : null };
}

// ─────────────────────────────────────────────────────────────────
//  v1.68.0 — Bilan de l'année (ouvert le 1er janvier, retrouvable dans le
//  Rapport › Année). Mêmes totaux que le Rapport (computePeriodTotals).
// ─────────────────────────────────────────────────────────────────
/** Mouvements nets vers les cagnottes APRÈS une date (versements − retraits ± ajustements manuels) */
function cagnotteFlowsAfter(data, iso) {
  let s = 0;
  (data.transactions || []).forEach(t => {
    if (!t.date || t.date <= iso) return;
    const a = parseFloat(t.amount) || 0;
    if (t.type === "epargne") s += a;
    else if (t.type === "decagnottage" || t.type === "dissolution_cagnotte") s -= a;
  });
  (data.cagnottes || []).forEach(c => (c.adjustments || []).forEach(a => {
    if (a.date && a.date > iso) s += (parseFloat(a.after) || 0) - (parseFloat(a.before) || 0);
  }));
  return s;
}
export function computeYearRecap(data, year) {
  const tx = data.transactions || [], fe = data.fixedExpenses || [], fi = data.fixedIncomes || [];
  const y = String(year), py = String(year - 1);
  const t = computePeriodTotals(tx, fe, fi, `${y}-01`, `${y}-12`);
  const p = computePeriodTotals(tx, fe, fi, `${py}-01`, `${py}-12`);
  const hasPrev = p.months > 0;
  const pct = (v, a) => (hasPrev && a > 0 ? Math.round((v - a) / a * 100) : null);
  const r2 = n => Math.round(n * 100) / 100;
  const first = firstDataYM(tx), cur = currentYM();
  // Mois : reste du mois (revenus − dépenses − épargne nette), comme le récap à la paie
  const months = monthRange(`${y}-01`, `${y}-12`).filter(ym => ym >= first && ym <= cur).map(ym => ({ ym, rest: computePayRecap(data, ym).rest }));
  const best = months.length ? months.reduce((a, b) => (b.rest > a.rest ? b : a)) : null;
  const worst = months.length > 1 ? months.reduce((a, b) => (b.rest < a.rest ? b : a)) : null;
  // Catégories : ce qui a le plus bougé vs l'an passé (sinon : les plus grosses)
  const sumCats = yy => monthRange(`${yy}-01`, `${yy}-12`).filter(ym => ym >= first && ym <= cur).reduce((acc, ym) => {
    Object.entries(catSpend(data, ym)).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v; }); return acc; }, {});
  const cc = sumCats(y), pc = hasPrev ? sumCats(py) : {};
  const keys = [...new Set([...Object.keys(cc), ...Object.keys(pc)])].filter(k => k !== "__none__");
  const cats = (hasPrev
    ? keys.map(k => ({ catId: k, amount: r2(cc[k] || 0), diff: (cc[k] || 0) - (pc[k] || 0), pct: pc[k] > 0 ? Math.round(((cc[k] || 0) - pc[k]) / pc[k] * 100) : null }))
        .filter(x => Math.abs(x.diff) >= 30).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    : keys.map(k => ({ catId: k, amount: r2(cc[k] || 0), diff: 0, pct: null })).sort((a, b) => b.amount - a.amount)
  ).slice(0, 3);
  // Frais fixes de l'année + hausses de prix survenues dans l'année
  const rises = fe.filter(f => f.prevAmount != null && (f.prevAmountYM || "").startsWith(y) && parseFloat(f.amount) !== parseFloat(f.prevAmount));
  const riseYear = r2(rises.reduce((s, f) => s + ((parseFloat(f.amount) || 0) - (parseFloat(f.prevAmount) || 0)) * 12, 0));
  // Cagnottes au 1er janvier et au 31 décembre (reconstruit depuis le total actuel)
  const now = (data.cagnottes || []).reduce((s, c) => s + (parseFloat(c.current) || 0), 0);
  const cagEnd = r2(now - cagnotteFlowsAfter(data, `${y}-12-31`));
  const cagStart = r2(now - cagnotteFlowsAfter(data, `${py}-12-31`));
  const saved = t.sav - t.decag;
  return {
    year, hasPrev, partial: y === cur.slice(0, 4), monthsCount: t.months,
    incomes: r2(t.inc), incomesPct: pct(t.inc, p.inc),
    expenses: r2(t.exp), expensesPct: pct(t.exp, p.exp),
    saved: r2(saved), rate: t.inc > 0 ? saved / t.inc : null,
    cagStart, cagEnd, best, worst, cats,
    fixedYear: r2(t.fixExp), rises: rises.length, riseYear,
  };
}
