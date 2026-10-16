// ─── App identity ────────────────────────────────────────────────
export const APP_NAME    = "Gestion du budget";
/** À bumper à chaque release — sync avec package.json
 *  MAJOR.MINOR.PATCH
 *  major : refonte breaking (structure données, navigation)
 *  minor : nouvelle fonctionnalité visible
 *  patch : correction de bug, retouche visuelle mineure
 */
export const APP_VERSION = "1.66.0";

// ─── Constants ───────────────────────────────────────────────────
export const MONTHS_SHORT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
export const MONTHS_MINI  = ["J","F","M","A","M","J","J","A","S","O","N","D"];
export const LS_KEY = "budget_ultimate_2026_v10";

// ─── Types de cagnotte (v1.56.0 : personnalisables dans Options) ──
// Purement visuels (icône, couleur de bordure, filtre) : n'entrent dans aucun calcul.
export const DEFAULT_CAG_TYPES = [
  { id: "projet",         icon: "🎯", label: "Projet",         color: "#70b8e0" },
  { id: "urgence",        icon: "🛡️", label: "Urgence",        color: "#c87070" },
  { id: "plaisir",        icon: "✈️", label: "Plaisir",        color: "#b090e0" },
  { id: "investissement", icon: "📈", label: "Investissement", color: "#68d498" },
];
export const CAG_TYPE_COLORS = ["#70b8e0","#68d498","#b090e0","#c87070","#c8b860","#88c880","#e08870","#5cc8c0","#e8944a","#a8b4c2"];
/** Type d'une cagnotte (ou null si aucun / type supprimé) */
export function cagTypeOf(cagTypes, id) {
  if (!id) return null;
  return (cagTypes || DEFAULT_CAG_TYPES).find(t => t.id === id) || null;
}
/** Icône d'une cagnotte selon son type (🐷 si sans type) */
export function cagIconOf(cagTypes, c) {
  return cagTypeOf(cagTypes, c?.cagType)?.icon || "🐷";
}

// ─── Formatting ──────────────────────────────────────────────────
/** @param {number} n */
export function fmt(n) {
  return (Number(n) || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
}

// ─── ID generator ────────────────────────────────────────────────
export function uid(prefix = "id") {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Date helpers ────────────────────────────────────────────────
/** "2026-04" → "2026-03" */
export function getPrevMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Returns today's date as "YYYY-MM-DD" in LOCAL time.
 * ⚠ Correction : remplace toISOString() (UTC) par heure locale pour éviter
 *   le décalage d'un jour pour les utilisateurs en UTC+.
 */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Date locale "YYYY-MM-DD" décalée de N jours par rapport à aujourd'hui
 * (ex : daysAgoISO(1) = hier). Source unique pour les raccourcis
 * Hier / Avant-hier des formulaires de saisie.
 */
export function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Returns the current year-month as "YYYY-MM" in LOCAL time.
 * ⚠ Correction : remplace toISOString() (UTC) par heure locale pour éviter
 *   que le mois courant soit incorrect entre minuit et 1-2h du matin en UTC+.
 */
export function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Delta badge ─────────────────────────────────────────────────
/**
 * Returns badge info for a % change between cur and prev.
 * @returns {{ cls: string, text: string } | null}
 */
export function deltaInfo(cur, prev) {
  if (prev === 0) return null;
  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return { cls: "delta-neu", text: "→ 0%" };
  return pct > 0
    ? { cls: "delta-pos", text: `▲ ${Math.abs(pct).toFixed(1)}%` }
    : { cls: "delta-neg", text: `▼ ${Math.abs(pct).toFixed(1)}%` };
}

// ─── Transaction helpers ─────────────────────────────────────────
/** True for types that add to income */
export function isIncome(type) {
  return type === "income" || type === "dissolution_cagnotte";
  // balance_adjustment exclu ici : son sens (+/−) dépend de adjSign.
  // Pour tout calcul de signe, utiliser isIncomeDirection(t) (hooks.js).
}

/** Human-readable label for a transaction */
export function txLabel(t, categories, cagnottes) {
  const cat = categories.find(c => c.id === t.categoryId);
  switch (t.type) {
    case "dissolution_cagnotte": return `Dissolution : ${t.note || ""}`;
    case "epargne": {
      const cag = cagnottes.find(c => c.id === t.targetCagId);
      return `Épargne ➔ ${cag?.name || "Cagnotte"}`;
    }
    case "decagnottage": {
      const cag = cagnottes.find(c => c.id === t.targetCagId);
      return `Décagnottage : ${cag?.name || "Cagnotte"}`;
    }
    case "transfer":            return "Transfert inter-cagnotte";
    case "balance_adjustment":  return t.note || "Ajustement de solde";
    default: return t.note || cat?.name || "Inconnu";
  }
}

export function txTypeClass(type) {
  switch (type) {
    case "income":
    case "dissolution_cagnotte": return "type-income";
    case "expense":              return "type-expense";
    case "epargne":              return "type-savings";
    case "decagnottage":         return "type-decag";
    case "transfer":             return "type-transfer";
    case "balance_adjustment":   return "type-balance";
    default:                     return "type-expense";
  }
}

export function txSign(type) {
  if (type === "income" || type === "dissolution_cagnotte" || type === "balance_adjustment") return "+";
  if (type === "decagnottage" || type === "transfer")       return "";
  return "−";
}

// ─── Chèques (v1.43.0) ───────────────────────────────────────────
/**
 * Date de référence d'une opération pour savoir quel mois elle « confirme »
 * (récurrentes). Un chèque encaissé est déplacé à sa date d'encaissement :
 * sans ça, le loyer de septembre payé par chèque encaissé en octobre
 * compterait comme le loyer d'octobre. On garde donc la date d'émission.
 */
export function recurringRefDate(t) {
  return t.issuedDate || t.date;
}

/** Date limite d'encaissement d'un chèque en France : émission + 1 an et 8 jours. */
export function chequeExpiryISO(issuedISO) {
  const [y, m, d] = issuedISO.split("-").map(Number);
  const e = new Date(y + 1, m - 1, d + 8);
  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
}

/** Nombre de jours entiers entre deux dates locales "YYYY-MM-DD". */
export function daysBetweenISO(fromISO, toISO) {
  const a = new Date(fromISO + "T12:00:00"), b = new Date(toISO + "T12:00:00");
  return Math.round((b - a) / 86400000);
}

// ─── Tap vs glissement (v1.44.2) ─────────────────────────────────
// Beaucoup de boutons réagissent au relâcher du doigt (onTouchEnd) pour
// éviter le délai du clic sur Android. Sans précaution, commencer à faire
// défiler l'écran en posant le doigt sur un bouton le déclenchait (ouverture
// d'un menu, pointage, confirmation…). Un écouteur global, en phase de
// capture, mémorise si le doigt a bougé de plus de 10 px depuis qu'il s'est
// posé : les gestionnaires onTouchEnd appellent touchMoved() et ne font rien
// si c'était un défilement.
const _tap = { x: 0, y: 0, moved: false };
if (typeof document !== "undefined") {
  document.addEventListener("touchstart", e => {
    const t = e.touches[0]; if (!t) return;
    _tap.x = t.clientX; _tap.y = t.clientY; _tap.moved = false;
  }, { capture: true, passive: true });
  document.addEventListener("touchmove", e => {
    const t = e.touches[0]; if (!t) return;
    if (Math.abs(t.clientX - _tap.x) > 10 || Math.abs(t.clientY - _tap.y) > 10) _tap.moved = true;
  }, { capture: true, passive: true });
}
/** true si le geste en cours est un glissement (défilement), pas un tap. */
export function touchMoved() { return _tap.moved; }

// ─── Jour des frais / revenus fixes (v1.64.0) ────────────────────
// `day` vaut 1–31 (ramené au dernier jour d'un mois plus court) ou une règle :
//   -1 = dernier jour ouvré du mois, -2 = avant-dernier jour ouvré.
// Jour ouvré = lundi–vendredi hors jours fériés français.
// v1.65.0 : le jour obtenu ne peut pas être un LUNDI (banques fermées, pas de
// virement) → il est avancé au jour ouvré précédent (le vendredi en général).
export const DAY_LAST_BD = -1;
export const DAY_PREV_LAST_BD = -2;
const _pad2 = n => String(n).padStart(2, "0");
const _isoOf = d => `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}`;
const _holidayCache = {};
/** Jours fériés français (métropole) d'une année, en "YYYY-MM-DD" */
export function frenchHolidays(year) {
  if (_holidayCache[year]) return _holidayCache[year];
  // Dimanche de Pâques (algorithme de Meeus/Jones/Butcher)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);
  const plus = n => _isoOf(new Date(year, easter.getMonth(), easter.getDate() + n));
  const set = new Set([
    `${year}-01-01`, plus(1), `${year}-05-01`, `${year}-05-08`, plus(39), plus(50),
    `${year}-07-14`, `${year}-08-15`, `${year}-11-01`, `${year}-11-11`, `${year}-12-25`,
  ]);
  return (_holidayCache[year] = set);
}
export function isBusinessDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return wd !== 0 && wd !== 6 && !frenchHolidays(y).has(iso);
}
/** Jour où un virement (salaire) peut arriver : mardi–vendredi hors fériés */
export function isBankCreditDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay() !== 1 && isBusinessDay(iso);
}
/** Jour (1–31) correspondant à `day` dans le mois `ym` ; null si aucun jour */
export function resolveFixedDay(day, ym) {
  const n = parseInt(day, 10);
  if (!n) return null;
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  if (n > 0) return Math.min(n, last);
  let skip = -n;  // 1 = dernier jour ouvré, 2 = avant-dernier
  for (let d = last; d >= 1; d--) {
    if (isBusinessDay(`${ym}-${_pad2(d)}`) && --skip === 0) {
      while (d > 1 && !isBankCreditDay(`${ym}-${_pad2(d)}`)) d--;   // lundi → vendredi
      return d;
    }
  }
  return last;
}
/** Libellé court du jour : "le 5", "dern. j. ouvré", "av.-dern. j. ouvré" */
export function fixedDayLabel(day, { long = false } = {}) {
  const n = parseInt(day, 10);
  if (!n) return null;
  if (n === DAY_LAST_BD) return long ? "Dernier jour ouvré" : "dern. j. ouvré";
  if (n === DAY_PREV_LAST_BD) return long ? "Avant-dernier jour ouvré" : "av.-dern. j. ouvré";
  return long ? `Le ${n}` : `le ${n}`;
}
/** "2026-10" + n mois */
export function ymShift(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}`;
}
// Revenu « compté dans le budget du mois suivant » (f.advance) : l'occurrence
// du mois M (budget, rapports, pointage) est versée sur le compte en M−1.
/** Mois où l'argent de l'occurrence `ym` arrive sur le compte */
export function fixedCashYM(f, ym) { return f?.advance ? ymShift(ym, -1) : ym; }
/** Occurrence (mois de budget) dont l'argent arrive pendant le mois `cashYM` */
export function fixedOccurrenceYM(f, cashYM) { return f?.advance ? ymShift(cashYM, 1) : cashYM; }
/** Date réelle (YYYY-MM-DD) de l'occurrence `ym`, ou null sans jour */
export function fixedCashDateISO(f, ym) {
  const cym = fixedCashYM(f, ym);
  const d = resolveFixedDay(f?.day, cym);
  return d ? `${cym}-${_pad2(d)}` : null;
}

// ─── Montant prévu automatique d'un revenu fixe (v1.64.0) ────────
// Moyenne des 3 derniers montants réels : occurrences pointées (montant saisi
// au pointage), complétées au début par les opérations de la même catégorie.
export function autoIncomeHistory(f, transactions = []) {
  const items = [];
  Object.entries(f?.pointedMonths || {}).forEach(([ym, on]) => {
    if (!on) return;
    const a = parseFloat(f.monthlyOverrides?.[ym]?.amount ?? f.amount) || 0;
    if (a > 0) items.push({ key: fixedCashDateISO(f, ym) || `${fixedCashYM(f, ym)}-28`, ym, amount: a, src: "fixed" });
  });
  if (f?.categoryId) transactions.forEach(t => {
    if (t.type !== "income" || t.categoryId !== f.categoryId) return;
    const a = parseFloat(t.amount) || 0;
    if (a > 0) items.push({ key: t.date, ym: t.date.slice(0, 7), amount: a, src: "tx" });
  });
  items.sort((a, b) => b.key.localeCompare(a.key));
  return items.slice(0, 3);
}
export function autoIncomeAmount(f, transactions = []) {
  const h = autoIncomeHistory(f, transactions);
  if (!h.length) return null;
  return Math.round(h.reduce((s, x) => s + x.amount, 0) / h.length * 100) / 100;
}
