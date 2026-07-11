// ─── App identity ────────────────────────────────────────────────
export const APP_NAME    = "Gestion du budget";
/** À bumper à chaque release — sync avec package.json
 *  MAJOR.MINOR.PATCH
 *  major : refonte breaking (structure données, navigation)
 *  minor : nouvelle fonctionnalité visible
 *  patch : correction de bug, retouche visuelle mineure
 */
export const APP_VERSION = "1.39.14";

// ─── Constants ───────────────────────────────────────────────────
export const MONTHS_SHORT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
export const MONTHS_MINI  = ["J","F","M","A","M","J","J","A","S","O","N","D"];
export const PALETTE = [
  "#4d9fff","#a78bfa","#fb923c","#34d399","#f87171",
  "#38bdf8","#c084fc","#4ade80","#fbbf24","#f472b6","#22d3ee","#a3e635",
];
export const LS_KEY = "budget_ultimate_2026_v10";

// ─── Formatting ──────────────────────────────────────────────────
/** @param {number} n */
export function fmt(n) {
  return (Number(n) || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
}

// ─── Geometry (donut chart) ──────────────────────────────────────
/** @returns {{ x: number, y: number }} */
export function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
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
  // balance_adjustment intentionnellement exclu — n'impacte pas le solde estimé
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
