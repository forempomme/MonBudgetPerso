import { useMemo } from "react";
import { currentYM, getPrevMonth, isIncome } from "./utils.js";

// ─────────────────────────────────────────────────────────────────
//  Primitive hook: total fixed expenses
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
  const totalFixes = useTotalFixes(fixedExpenses);

  return useMemo(() => {
    const isCur = ym === currentYM();
    let inc = 0, exp = 0, decag = 0;

    transactions
      .filter(t => t.date.startsWith(ym))
      .forEach(t => {
        const a = parseFloat(t.amount) || 0;
        if (isIncome(t.type))         inc   += a;
        else if (t.type === "expense") exp   += a;
        else if (t.type === "decagnottage") decag += a;
      });

    const fixContrib = isCur ? totalFixes : 0;
    exp += fixContrib;

    return {
      inc,
      exp,
      expVar: exp - fixContrib,
      decag,
      net: inc - exp,
    };
  }, [transactions, fixedExpenses, ym, totalFixes]);
}

// ─────────────────────────────────────────────────────────────────
//  12-month array for a given year
//  Each entry: { inc, exp, sav, net, label, mini, idx }
// ─────────────────────────────────────────────────────────────────
export function useYearMonths(transactions, fixedExpenses, year) {
  const totalFixes = useTotalFixes(fixedExpenses);
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
        if (isIncome(t.type))              inc += a;
        else if (t.type === "expense")     exp += a;
        else if (t.type === "epargne")     sav += a;
      });

      if (isCurYear && i === curMonth) exp += totalFixes;

      return {
        inc, exp, sav,
        net: inc - exp,
        label: MONTHS_SHORT[i],
        mini: MONTHS_MINI[i],
        idx: i,
      };
    });
  }, [transactions, fixedExpenses, year, totalFixes, curYear, curMonth]);
}

// ─────────────────────────────────────────────────────────────────
//  Current balance (all-time)
// ─────────────────────────────────────────────────────────────────
export function useBalance(transactions, fixedExpenses) {
  const totalFixes = useTotalFixes(fixedExpenses);

  return useMemo(() => {
    let bal = 0;
    transactions.forEach(t => {
      const a = parseFloat(t.amount) || 0;
      if (isIncome(t.type))              bal += a;
      else if (t.type === "expense")     bal -= a;
      else if (t.type === "epargne")     bal -= a;
    });
    return bal - totalFixes;
  }, [transactions, totalFixes]);
}

// ─────────────────────────────────────────────────────────────────
//  Sparkline: last 6 months net values
// ─────────────────────────────────────────────────────────────────
export function useSpark(transactions, fixedExpenses) {
  const totalFixes = useTotalFixes(fixedExpenses);
  const curYM = currentYM();

  return useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d  = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const ym = d.toISOString().slice(0, 7);
      const isCur = ym === curYM;
      let inc = 0, exp = 0;
      transactions.filter(t => t.date.startsWith(ym)).forEach(t => {
        const a = parseFloat(t.amount) || 0;
        if (isIncome(t.type))          inc += a;
        else if (t.type === "expense") exp += a;
      });
      if (isCur) exp += totalFixes;
      return inc - exp;
    });
  }, [transactions, totalFixes, curYM]);
}

// ─────────────────────────────────────────────────────────────────
//  Year comparison data
// ─────────────────────────────────────────────────────────────────
export function useYearTotals(transactions, fixedExpenses, year) {
  const totalFixes = useTotalFixes(fixedExpenses);
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
    if (isCur) exp += totalFixes;
    return { inc, exp, sav };
  }, [transactions, fixedExpenses, year, totalFixes]);
}

// ─────────────────────────────────────────────────────────────────
//  Prior year for delta comparison (same elapsed months)
// ─────────────────────────────────────────────────────────────────
export function usePriorYearStats(transactions, fixedExpenses) {
  const totalFixes = useTotalFixes(fixedExpenses);
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
    exp    += totalFixes;
    expVar += totalFixes;
    return { inc, exp, expVar, decag };
  }, [transactions, totalFixes, prevYear, elapsed]);
}
