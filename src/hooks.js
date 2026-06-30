import { useMemo } from "react";
import { currentYM, getPrevMonth, isIncome } from "./utils.js";

// ─────────────────────────────────────────────────────────────────
//  Helper : montant effectif des frais fixes pour un mois donné
//  Tient compte des monthlyOverrides (modifications ponctuelles
//  depuis l'Historique qui n'impactent que ce mois).
// ─────────────────────────────────────────────────────────────────
function effectiveFixesForMonth(fixedExpenses, ym) {
  return fixedExpenses.reduce((s, f) => {
    const ov = f.monthlyOverrides?.[ym];
    return s + ((ov?.amount ?? f.amount) || 0);
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
export function useMonthStats(transactions, fixedExpenses, ym) {
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
export function useBalance(transactions, fixedExpenses) {
  return useMemo(() => {
    let bal = 0;
    transactions.forEach(t => {
      const a = parseFloat(t.amount) || 0;
      if (isIncome(t.type))          bal += a;
      else if (t.type === "expense") bal -= a;
      else if (t.type === "epargne") bal -= a;
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
      });
    } else {
      bal -= effectiveFixesForMonth(fixedExpenses, currentYM());
    }

    return bal;
  }, [transactions, fixedExpenses]);
}

// ─────────────────────────────────────────────────────────────────
//  Balance with pending recurring transactions for current month
//
//  Pour chaque modèle récurrent non encore confirmé ce mois-ci,
//  déduit son montant du solde. Tient compte de occurrences restantes.
//
//  Règle demandée :
//   - Si la récurrente s'applique ce mois (mensuelle non confirmée
//     ce mois, ou annuelle non confirmée cette année) → on la déduit
//   - On respecte le plafond d'occurrences si défini
// ─────────────────────────────────────────────────────────────────
export function useBalanceWithRecurring(transactions, fixedExpenses, recurringTemplates) {
  const balance = useBalance(transactions, fixedExpenses);

  return useMemo(() => {
    if (!recurringTemplates || recurringTemplates.length === 0) return balance;

    const now   = new Date();
    const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const curY  = now.getFullYear().toString();

    let pending = 0;

    recurringTemplates.forEach(tpl => {
      const amount = parseFloat(tpl.amount) || 0;
      if (amount <= 0) return;

      // Occurrences déjà confirmées (toutes transactions liées à ce template)
      const confirmed = transactions.filter(t => t.templateId === tpl.id);
      const confirmedCount = confirmed.length;

      // Si occurrences définies et déjà atteintes → skip
      if (tpl.occurrences != null && confirmedCount >= tpl.occurrences) return;

      if (tpl.frequency === "yearly") {
        // Annuelle : confirmée cette année ?
        const doneThisYear = confirmed.some(t => t.date.startsWith(curY));
        if (!doneThisYear) pending += amount;
      } else {
        // Mensuelle : confirmée ce mois ?
        const doneThisMonth = confirmed.some(t => t.date.startsWith(curYM));
        if (!doneThisMonth) pending += amount;
      }
    });

    return balance - pending;
  }, [balance, transactions, recurringTemplates]);
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
      if (ym === curYM) exp += effectiveFixesForMonth(fixedExpenses, ym);
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
