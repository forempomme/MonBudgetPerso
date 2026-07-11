import { useMemo } from "react";
import { currentYM, getPrevMonth, isIncome } from "./utils.js";

// ─────────────────────────────────────────────────────────────────
//  Helper : montant effectif des frais fixes pour un mois donné
//  Tient compte des monthlyOverrides (modifications ponctuelles
//  depuis l'Historique qui n'impactent que ce mois).
// ─────────────────────────────────────────────────────────────────
function effectiveFixesForMonth(fixedExpenses, ym) {
  return fixedExpenses.reduce((s, f) => {
    if (f.startYM && ym < f.startYM) return s;
    const ov = f.monthlyOverrides?.[ym];
    return s + ((ov?.amount ?? f.amount) || 0);
  }, 0);
}

function effectiveIncomesForMonth(fixedIncomes, ym) {
  return (fixedIncomes || []).reduce((s, f) => {
    if (f.startYM && ym < f.startYM) return s;
    return s + (parseFloat(f.amount) || 0);
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
export function useTotalFixes(fixedExpenses) {
  return useMemo(
    () => fixedExpenses.reduce((s, f) => s + (f.amount || 0), 0),
    [fixedExpenses]
  );
}

// ─────────────────────────────────────────────────────────────────
//  Single-month stats
//  Returns { inc, exp, expVar, decag, net }
// ─────────────────────────────────────────────────────────────────
export function useMonthStats(transactions, fixedExpenses, ym, fixedIncomes) {
  return useMemo(() => {
    const isCur = ym === currentYM();
    let inc = 0, exp = 0, decag = 0;

    transactions
      .filter(t => t.date.startsWith(ym))
      .forEach(t => {
        const a = parseFloat(t.amount) || 0;
        if (isIncome(t.type))               inc   += a;
        else if (t.type === "expense")      exp   += a;
        else if (t.type === "decagnottage") decag += a;
      });

    const fixContrib = isCur ? effectiveFixesForMonth(fixedExpenses, ym) : 0;
    exp += fixContrib;

    return {
      inc,
      exp,
      expVar: exp - fixContrib,
      decag,
      net: inc - exp,
    };
  }, [transactions, fixedExpenses, ym]);
}

// ─────────────────────────────────────────────────────────────────
//  12-month array for a given year
// ─────────────────────────────────────────────────────────────────
export function useYearMonths(transactions, fixedExpenses, year) {
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear  = now.getFullYear();

  return useMemo(() => {
    const MONTHS_SHORT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
    const MONTHS_MINI  = ["J","F","M","A","M","J","J","A","S","O","N","D"];
    const isCurYear = year === curYear;

    return Array.from({ length: 12 }, (_, i) => {
      const mStr = `${year}-${(i + 1).toString().padStart(2, "0")}`;
      let inc = 0, exp = 0, sav = 0;

      transactions.filter(t => t.date.startsWith(mStr)).forEach(t => {
        const a = parseFloat(t.amount) || 0;
        if (isIncome(t.type))          inc += a;
        else if (t.type === "expense") exp += a;
        else if (t.type === "epargne") sav += a;
      });

      if (isCurYear && i === curMonth) {
        exp += effectiveFixesForMonth(fixedExpenses, mStr);
      }

      return { inc, exp, sav, net: inc - exp, label: MONTHS_SHORT[i], mini: MONTHS_MINI[i], idx: i };
    });
  }, [transactions, fixedExpenses, year, curYear, curMonth]);
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
//  Sparkline: last 6 months net values
// ─────────────────────────────────────────────────────────────────
export function useSpark(transactions, fixedExpenses) {
  const curYM = currentYM();

  return useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d  = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      let inc = 0, exp = 0;
      transactions.filter(t => t.date.startsWith(ym)).forEach(t => {
        const a = parseFloat(t.amount) || 0;
        if (isIncome(t.type))          inc += a;
        else if (t.type === "expense") exp += a;
      });
      if (ym === curYM) {
        exp += effectiveFixesForMonth(fixedExpenses, ym);
        inc += effectiveIncomesForMonth(fixedIncomes, ym);
      }
      return inc - exp;
    });
  }, [transactions, fixedExpenses, curYM]);
}

// ─────────────────────────────────────────────────────────────────
//  Year totals
// ─────────────────────────────────────────────────────────────────
export function useYearTotals(transactions, fixedExpenses, year) {
  const now = new Date();

  return useMemo(() => {
    const isCur = year === now.getFullYear();
    let inc = 0, exp = 0, sav = 0;
    transactions.filter(t => t.date.startsWith(year.toString())).forEach(t => {
      const a = parseFloat(t.amount) || 0;
      if (isIncome(t.type))          inc += a;
      else if (t.type === "expense") exp += a;
      else if (t.type === "epargne") sav += a;
    });
    if (isCur) {
      const curM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      exp += effectiveFixesForMonth(fixedExpenses, curM);
    }
    return { inc, exp, sav };
  }, [transactions, fixedExpenses, year]);
}

// ─────────────────────────────────────────────────────────────────
//  Prior year for delta comparison (same elapsed months)
// ─────────────────────────────────────────────────────────────────
export function usePriorYearStats(transactions, fixedExpenses) {
  const now = new Date();
  const elapsed  = now.getMonth() + 1;
  const prevYear = (now.getFullYear() - 1).toString();

  return useMemo(() => {
    let inc = 0, exp = 0, expVar = 0, decag = 0;
    transactions
      .filter(t => t.date.startsWith(prevYear))
      .forEach(t => {
        const mo = parseInt(t.date.slice(5, 7), 10);
        if (mo > elapsed) return;
        const a = parseFloat(t.amount) || 0;
        if (isIncome(t.type))               inc  += a;
        else if (t.type === "expense")     { exp  += a; expVar += a; }
        else if (t.type === "decagnottage") decag += a;
      });
    const prevYMEnd = `${prevYear}-${String(elapsed).padStart(2, "0")}`;
    const fixTotal = monthRange(`${prevYear}-01`, prevYMEnd)
      .reduce((s, ym) => s + effectiveFixesForMonth(fixedExpenses, ym), 0);
    exp    += fixTotal;
    expVar += fixTotal;
    return { inc, exp, expVar, decag };
  }, [transactions, fixedExpenses, prevYear, elapsed]);
}

// ─────────────────────────────────────────────────────────────────
//  Balance with pending recurring transactions for current month
//  Déduit du solde les récurrentes non encore confirmées ce mois,
//  ainsi que les programmées dont l'échéance est ce mois-ci ou déjà
//  passée mais pas encore confirmée (ex: précommande payée à la sortie —
//  ça ne pèse sur le solde estimé qu'à partir du mois de l'échéance).
// ─────────────────────────────────────────────────────────────────
export function useBalanceWithRecurring(transactions, fixedExpenses, fixedIncomes, recurringTemplates, scheduledTransactions) {
  const balance = useBalance(transactions, fixedExpenses, fixedIncomes);

  return useMemo(() => {
    const now   = new Date();
    const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const curY  = now.getFullYear().toString();

    let pending = 0;

    (recurringTemplates || []).forEach(tpl => {
      const amount = parseFloat(tpl.amount) || 0;
      if (amount <= 0) return;

      const confirmed      = transactions.filter(t => t.templateId === tpl.id);
      const confirmedCount = confirmed.length;

      if (tpl.occurrences != null && confirmedCount >= tpl.occurrences) return;

      if (tpl.frequency === "yearly") {
        const doneThisYear = confirmed.some(t => t.date.startsWith(curY));
        if (!doneThisYear) pending += amount;
      } else {
        const doneThisMonth = confirmed.some(t => t.date.startsWith(curYM));
        if (!doneThisMonth) pending += amount;
      }
    });

    // Une programmée reste dans scheduledTransactions tant qu'elle n'est pas
    // confirmée (CONFIRM_SCHEDULED la retire du tableau) — donc tout ce qui
    // s'y trouve encore ET dont l'échéance est atteinte doit être anticipé.
    (scheduledTransactions || []).forEach(s => {
      const amount = parseFloat(s.amount) || 0;
      if (amount <= 0) return;
      if (s.date.slice(0, 7) <= curYM) pending += amount;
    });

    return balance - pending;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, transactions, recurringTemplates, scheduledTransactions]);
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

      const fixExp = (fixedExpenses || []).reduce((s, f) => {
        const ov = f.monthlyOverrides?.[ym];
        return s + ((ov?.amount ?? f.amount) || 0);
      }, 0);
      const fixInc = (fixedIncomes || []).reduce((s, f) => {
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
          const doneThisMonth  = confirmed.some(t => t.date.startsWith(curYM));
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
