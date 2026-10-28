// ─────────────────────────────────────────────────────────────────
//  v1.79.0 — Récap fiscal : règles par ANNÉE DE REVENUS
//
//  ⚠️ Mise à jour annuelle : après le vote de la loi de finances (fin
//  décembre / janvier), ajouter l'année suivante dans TAX_RULES. Si
//  l'année consultée n'y est pas, l'appli reprend la dernière année
//  connue et affiche « estimation basée sur … ». L'utilisateur peut à
//  tout moment remplacer n'importe quelle valeur (taxSettings.overrides).
//
//  Sources (vérifiées le 28/10/2026) :
//  • Garde d'enfant < 6 ans hors domicile : crédit 50 %, plafond de
//    dépenses 3 500 € par enfant (depuis les revenus 2022) — cases 7GA à 7GD.
//  • Dons « Coluche » (aide aux personnes en difficulté) : 75 %, plafond
//    porté de 1 000 € à 2 000 € par la loi de finances 2026 (art. 28) pour
//    les dons versés à partir du 14/10/2025 ; au-delà → régime 66 % — case 7UD.
//  • Autres dons d'intérêt général : 66 % dans la limite de 20 % du revenu
//    imposable — case 7UF.
//  • Emploi à domicile : crédit 50 %, plafond 12 000 € + 1 500 € par enfant
//    à charge, dans la limite de 15 000 € — case 7DB.
// ─────────────────────────────────────────────────────────────────
import { fixedLinesForPeriod, livedMonths } from "./hooks.js";

export const TAX_RULES = {
  2025: {
    garde:  { rate: 0.5,  capPerChild: 3500 },
    dons75: { rate: 0.75, cap: 2000, capBefore: { until: "2025-10-13", cap: 1000 } },
    dons66: { rate: 0.66, incomeShare: 0.20 },
    dom:    { rate: 0.5,  cap: 12000, perChild: 1500, max: 15000 },
  },
  2026: {
    garde:  { rate: 0.5,  capPerChild: 3500 },
    dons75: { rate: 0.75, cap: 2000 },
    dons66: { rate: 0.66, incomeShare: 0.20 },
    dom:    { rate: 0.5,  cap: 12000, perChild: 1500, max: 15000 },
  },
};

/** Champs modifiables par l'utilisateur : [dispositif, clé, libellé, unité] */
export const EDITABLE = [
  ["garde",  "rate",        "Garde · taux du crédit",           "%"],
  ["garde",  "capPerChild", "Garde · plafond par enfant",       "€"],
  ["dons75", "rate",        "Dons aide aux personnes · taux",   "%"],
  ["dons75", "cap",         "Dons aide aux personnes · plafond", "€"],
  ["dons66", "rate",        "Autres dons · taux",               "%"],
  ["dons66", "incomeShare", "Autres dons · limite du revenu",   "%"],
  ["dom",    "rate",        "Emploi à domicile · taux",         "%"],
  ["dom",    "cap",         "Emploi à domicile · plafond",      "€"],
  ["dom",    "perChild",    "Emploi à domicile · + par enfant", "€"],
  ["dom",    "max",         "Emploi à domicile · maximum",      "€"],
];

const clone = o => JSON.parse(JSON.stringify(o));

/** Règles d'une année : intégrées (ou dernière année connue) + modifications de l'utilisateur. */
export function rulesFor(year, overrides = {}) {
  const years = Object.keys(TAX_RULES).map(Number).sort((a, b) => a - b);
  const known = TAX_RULES[year] != null;
  const baseYear = known ? year : (years.filter(y => y <= year).pop() || years[0]);
  const rules = clone(TAX_RULES[baseYear]);
  const ov = overrides?.[year] || {};
  let modified = false;
  Object.entries(ov).forEach(([k, v]) => {
    const [d, f] = k.split(".");
    if (rules[d] && typeof v === "number" && isFinite(v)) { if (rules[d][f] !== v) modified = true; rules[d][f] = v; }
  });
  return { rules, baseYear, known, modified };
}

/** Montant dépensé dans une liste de catégories (et leurs sous-catégories) sur l'année : opérations + frais fixes. */
function spentIn(data, catIds, year, splitDate) {
  const cats = data.categories || [];
  const fam = new Set();
  (catIds || []).forEach(id => { fam.add(id); cats.forEach(c => { if (c.parentId === id) fam.add(c.id); }); });
  let total = 0, before = 0;
  (data.transactions || []).forEach(t => {
    if (t.type !== "expense" || !fam.has(t.categoryId) || !(t.date || "").startsWith(String(year))) return;
    const a = parseFloat(t.amount) || 0;
    total += a; if (splitDate && t.date <= splitDate) before += a;
  });
  const months = livedMonths(data.transactions || [], `${year}-01`, `${year}-12`);
  fixedLinesForPeriod((data.fixedExpenses || []).filter(f => fam.has(f.categoryId)), months, "expense").forEach(l => {
    total += l.total;
    if (splitDate) before += l.total * months.filter(m => `${m}-28` <= splitDate).length / Math.max(1, l.n || months.length);
  });
  return { total, before };
}

/** Récap fiscal d'une année → { year, rules, baseYear, known, modified, items: [...], total, configured } */
export function computeTaxRecap(data, year) {
  const S = data.taxSettings || {};
  const { rules, baseYear, known, modified } = rulesFor(year, S.overrides);
  const items = [];
  // Garde d'enfant
  const g = S.garde || {};
  if ((g.catIds || []).length) {
    const spent = spentIn(data, g.catIds, year).total;
    const aids = parseFloat(S.aids?.[year]) || 0;
    const kids = Math.max(1, parseInt(g.kids, 10) || 1);
    const base = Math.max(0, spent - aids), cap = rules.garde.capPerChild * kids;
    items.push({ id: "garde", icon: "👶", label: "Garde d'enfant < 6 ans", box: kids > 1 ? "7GA–7GC" : "7GA", kind: "crédit",
      spent, aids, base, cap, rate: rules.garde.rate, benefit: Math.min(base, cap) * rules.garde.rate });
  }
  // Dons 75 % puis 66 %
  const d75 = S.dons75 || {}, d66 = S.dons66 || {};
  let excess = 0;
  if ((d75.catIds || []).length) {
    const cb = rules.dons75.capBefore;
    const { total, before } = spentIn(data, d75.catIds, year, cb?.until);
    const eligible = Math.min(cb ? Math.min(before, cb.cap) + (total - before) : total, rules.dons75.cap);
    excess = Math.max(0, total - eligible);
    items.push({ id: "dons75", icon: "🤝", label: "Dons · aide aux personnes", box: "7UD", kind: "réduction",
      spent: total, base: eligible, cap: rules.dons75.cap, rate: rules.dons75.rate, benefit: eligible * rules.dons75.rate,
      note: excess > 0 ? `${Math.round(excess)} € au-delà du plafond → comptés à 66 %` : null });
  }
  if ((d66.catIds || []).length || excess > 0) {
    const spent = (d66.catIds || []).length ? spentIn(data, d66.catIds, year).total : 0;
    const pool = spent + excess;
    const income = parseFloat(S.income?.[year]) || 0;
    const limit = income > 0 ? income * rules.dons66.incomeShare : Infinity;
    items.push({ id: "dons66", icon: "💝", label: "Autres dons", box: "7UF", kind: "réduction",
      spent: pool, base: Math.min(pool, limit), cap: isFinite(limit) ? limit : null, rate: rules.dons66.rate, benefit: Math.min(pool, limit) * rules.dons66.rate,
      note: income > 0 ? null : `limite de ${Math.round(rules.dons66.incomeShare * 100)} % du revenu imposable non vérifiée (revenu non renseigné)` });
  }
  // Emploi à domicile
  const dm = S.dom || {};
  if ((dm.catIds || []).length) {
    const spent = spentIn(data, dm.catIds, year).total;
    const kids = Math.max(0, parseInt(dm.kids, 10) || 0);
    const cap = Math.min(rules.dom.cap + rules.dom.perChild * kids, rules.dom.max);
    items.push({ id: "dom", icon: "🏠", label: "Emploi à domicile", box: "7DB", kind: "crédit",
      spent, base: Math.min(spent, cap), cap, rate: rules.dom.rate, benefit: Math.min(spent, cap) * rules.dom.rate });
  }
  const total = items.reduce((s, x) => s + x.benefit, 0);
  return { year, rules, baseYear, known, modified, items, total, configured: items.length > 0 };
}
