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
export function useBalance(transactions, fixedExpenses, refBalance = null, refDate = null) {
  return useMemo(() => {
    const now  = new Date();
    const endYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    if (refBalance !== null && refDate) {
      // ── Calcul ancré depuis la référence ────────────────────────
      let bal = refBalance;

      // Transactions depuis la date de référence
      transactions
        .filter(t => t.date >= refDate)
        .forEach(t => {
          const a = parseFloat(t.amount) || 0;
          if (isIncome(t.type))          bal += a;
          else if (t.type === "expense") bal -= a;
          else if (t.type === "epargne") bal -= a;
        });

      // Frais fixes pour les mois STRICTEMENT APRÈS le mois de référence
      // (le mois de référence est déjà dans le solde réel saisi)
      const [refY, refM] = refDate.slice(0, 7).split('-').map(Number);
      let nm = refM + 1, ny = refY;
      if (nm > 12) { nm = 1; ny++; }
      const fixStartYM = `${ny}-${String(nm).padStart(2, "0")}`;
      if (fixStartYM <= endYM) {
        monthRange(fixStartYM, endYM).forEach(ym => {
          bal -= effectiveFixesForMonth(fixedExpenses, ym);
        });
      }
      return bal;
    }

    // ── Calcul classique depuis la première transaction ──────────
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
      monthRange(startYM, endYM).forEach(ym => {
        bal -= effectiveFixesForMonth(fixedExpenses, ym);
      });
    } else {
      bal -= effectiveFixesForMonth(fixedExpenses, currentYM());
    }

    return bal;
  }, [transactions, fixedExpenses, refBalance, refDate]);
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
