// ─────────────────────────────────────────────────────────────────
//  releve.js — v1.63.0 : comparaison LECTURE SEULE avec un relevé bancaire PDF
//
//  Confidentialité (exigence) :
//   • le PDF est lu en mémoire sur le téléphone, jamais envoyé, jamais copié ;
//   • seules les lignes d'opérations (date, libellé, montant), les soldes et le
//     solde du livret sont extraits — nom, adresse, IBAN, numéros de compte
//     sont ignorés (on ne lit que ce qui est entre l'en-tête du tableau
//     « Date / Date de Valeur / Opération / Débit / Crédit » et le total) ;
//   • rien n'est enregistré (ni localStorage, ni sauvegarde, ni données de
//     l'appli) : le résultat vit dans l'état de l'écran et disparaît à la
//     fermeture ;
//   • rien n'est créé, modifié, pointé ni partagé.
//
//  Format validé : relevé « Crédit Mutuel de Bretagne / Arkéa » (Eurocompte) :
//  colonnes Date | Date de Valeur | Opération | Débit | Crédit, sections avec
//  sous-total, lignes de détail sous l'opération, « CARTE jj/mm » = date d'achat.
// ─────────────────────────────────────────────────────────────────

import { resolveFixedDay, fixedOccurrenceYM } from "./utils.js";

const NUM = /^-?\+?\d{1,3}(?:[  .]\d{3})*,\d{2}(?:\s*€)?$/;
const toNum = s => parseFloat(String(s).replace(/[€\s  ]/g, "").replace(/\./g, "").replace(",", "."));
const MONTHS = { JANVIER: 1, FEVRIER: 2, FÉVRIER: 2, MARS: 3, AVRIL: 4, MAI: 5, JUIN: 6, JUILLET: 7, AOUT: 8, AOÛT: 8, SEPTEMBRE: 9, OCTOBRE: 10, NOVEMBRE: 11, DECEMBRE: 12, DÉCEMBRE: 12 };
const pad2 = n => String(n).padStart(2, "0");
const r2 = n => Math.round(n * 100) / 100;
const cents = n => Math.round(n * 100);

/** Lit le PDF (ArrayBuffer) avec pdf.js, chargé à la demande, sans réseau. Retourne les pages en lignes de texte positionnées. */
export async function readPdfRows(arrayBuffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.min.mjs");
  const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    isEvalSupported: false,      // aucun code exécuté depuis le PDF
    disableFontFace: true,       // on ne dessine rien : pas de polices chargées
    useSystemFonts: false,
    disableAutoFetch: true, disableStream: true, disableRange: true,
    enableXfa: false,
  });
  const doc = await task.promise;
  try {
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      pages.push(itemsToRows(tc.items.map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))));
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();         // libère le document et le worker
  }
}

/** Regroupe les morceaux de texte d'une page en lignes (même hauteur ±2) triées de haut en bas */
export function itemsToRows(items) {
  const rows = [];
  items.filter(it => it.str && it.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x).forEach(it => {
    let row = rows.find(r => Math.abs(r.y - it.y) <= 2);
    if (!row) { row = { y: it.y, cells: [] }; rows.push(row); }
    row.cells.push({ x: it.x, s: it.str.trim() });
  });
  rows.forEach(r => r.cells.sort((a, b) => a.x - b.x));
  return rows.sort((a, b) => b.y - a.y);
}

const isDM = s => /^\d{2}\/\d{2}$/.test(s);
const isDMY = s => /^\d{2}\/\d{2}\/\d{4}$/.test(s);

/**
 * Transforme les lignes du PDF en relevé structuré.
 * @returns {{ ok, error?, start, end, openingBalance, closingBalance, lines[], sections[], totals, checks[], savingsBalance }}
 */
export function parseStatement(pages) {
  const lines = [], sections = [], checks = [];
  let openingBalance = null, closingBalance = null, start = null, end = null, totals = null, savingsBalance = null;
  let cur = null, section = null, debitX = null, creditX = null;
  const dateFromText = t => { const m = t.match(/AU\s+(\d{1,2})\s+([A-ZÉÛ]+)\s+(\d{4})/i); return m && MONTHS[m[2].toUpperCase()] ? `${m[3]}-${pad2(MONTHS[m[2].toUpperCase()])}-${pad2(m[1])}` : null; };

  pages.forEach(rows => {
    let inTable = false;
    rows.forEach(row => {
      const txt = row.cells.map(c => c.s).join(" ");
      const first = row.cells[0]?.s || "";
      // En-tête du tableau : repère les colonnes Débit / Crédit (par position)
      if (/^Date$/.test(first) && row.cells.some(c => /^Débit$/i.test(c.s)) && row.cells.some(c => /^Crédit$/i.test(c.s))) {
        debitX = row.cells.find(c => /^Débit$/i.test(c.s)).x;
        creditX = row.cells.find(c => /^Crédit$/i.test(c.s)).x;
        inTable = true; return;
      }
      if (/ANCIEN SOLDE/i.test(txt)) {
        const amt = row.cells.filter(c => NUM.test(c.s)).pop();
        if (amt) openingBalance = (/DÉBITEUR|DEBITEUR/i.test(txt) ? -1 : 1) * toNum(amt.s);
        const d = dateFromText(txt); if (d) { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + 1); start = `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`; }
        return;
      }
      if (/NOUVEAU SOLDE/i.test(txt)) {
        const amt = row.cells.filter(c => NUM.test(c.s)).pop();
        if (amt) closingBalance = (/DÉBITEUR|DEBITEUR/i.test(txt) ? -1 : 1) * toNum(amt.s);
        end = dateFromText(txt);
        inTable = false; cur = null; return;
      }
      if (/^TOTAL DES OPÉRATIONS/i.test(txt)) {
        const nums = row.cells.filter(c => NUM.test(c.s));
        if (nums.length === 2) totals = { debit: toNum(nums[0].s), credit: toNum(nums[1].s) };
        inTable = false; cur = null; return;
      }
      if (inTable === false && totals === null && lines.length && row.cells.length === 2 && row.cells.every(c => NUM.test(c.s))) {
        totals = { debit: toNum(row.cells[0].s), credit: toNum(row.cells[1].s) }; return;
      }
      // Livret (compte d'épargne) : « L.E.P. | n° | solde » — seul le solde est gardé
      if (/^L\.?E\.?P\.?$|^LIVRET/i.test(first)) {
        const amt = row.cells.find(c => NUM.test(c.s) && /€/.test(c.s));
        if (amt) savingsBalance = toNum(amt.s);
        return;
      }
      if (!inTable) return;
      if (/^Émis le|^Page \d/i.test(txt)) { cur = null; return; }
      // Titre de section (avec ou sans sous-total, « (Suite) » sur la page suivante)
      // (dans la 1ʳᵉ colonne seulement : un détail en majuscules sous une opération n'est pas une section)
      if (!isDM(first) && row.cells[0].x < 90 && /^[A-ZÉÈÀÂÊÎÔÛÇ' ]{6,}$/.test(first.replace(/\s*\(Suite\)\s*$/i, "")) && first === first.toUpperCase()) {
        const name = first.replace(/\s*\(Suite\)\s*$/i, "").trim();
        section = sections.find(s => s.name === name);
        if (!section) {
          const st = row.cells.find(c => /^[+-]?\d.*€$/.test(c.s.replace(/\s/g, "")) || NUM.test(c.s));
          section = { name, subtotal: st ? toNum(st.s) * (/^-/.test(st.s) ? 1 : 1) : null, sum: 0, count: 0 };
          if (st && /^-/.test(st.s.trim())) section.subtotal = -Math.abs(toNum(st.s.replace("-", "")));
          sections.push(section);
        }
        cur = null; return;
      }
      // Ligne d'opération : jj/mm | jj/mm/aaaa | libellé | montant (colonne débit ou crédit)
      if (isDM(first) && isDMY(row.cells[1]?.s || "")) {
        const amt = row.cells.slice(2).filter(c => NUM.test(c.s)).pop();
        if (!amt) return;
        const label = row.cells.slice(2).filter(c => c !== amt).map(c => c.s).join(" ").trim();
        const yv = row.cells[1].s.slice(6, 10), [dd, mm] = first.split("/");
        // année de la date d'opération : celle de la date de valeur (± passage d'année)
        let year = parseInt(yv, 10);
        if (mm === "12" && row.cells[1].s.slice(3, 5) === "01") year -= 1;
        if (mm === "01" && row.cells[1].s.slice(3, 5) === "12") year += 1;
        const date = `${year}-${mm}-${dd}`;
        const isCredit = creditX != null && debitX != null ? amt.x > (debitX + creditX) / 2 + 20 : false;
        const amount = (isCredit ? 1 : -1) * toNum(amt.s);
        const card = label.match(/^CARTE\s+(\d{2})\/(\d{2})\s+(.*)$/i);
        let opDate = date;
        if (card) {
          let cy = year; if (card[2] === "12" && mm === "01") cy -= 1;
          opDate = `${cy}-${card[2]}-${card[1]}`;
        }
        cur = { id: `b${lines.length}`, date, opDate, valueDate: row.cells[1].s, label: card ? card[3].trim() : label, rawLabel: label, details: [], amount: r2(amount), section: section?.name || "", kind: card ? "card" : /^PRLV/i.test(label) ? "prlv" : /CHEQUE|CHQ/i.test(label) ? "cheque" : /^VIR|^vers /i.test(label) ? "vir" : /^F |FRAIS|COTISATION/i.test(label) ? "fee" : "other" };
        lines.push(cur);
        if (section) { section.sum = r2(section.sum + cur.amount); section.count++; }
        return;
      }
      // Ligne de détail sous l'opération (motif du virement, références)
      if (cur && row.cells.length === 1 && row.cells[0].x > 100) {
        const d = row.cells[0].s;
        // garde les détails lisibles (mots), ignore les références techniques
        if (/[a-zàâéèêëîïôöûüç]{3,}/i.test(d) && !/^[A-Z0-9]{10,}$/.test(d) && !/^[0-9a-f]{16,}$/i.test(d) && !/ZZZ|RUM:|IP1RT|SEPA\/|\/PAYPAL$|^[A-Z0-9-]{12,}$/.test(d)) cur.details.push(d);
      }
    });
  });

  // Contrôles : chaque sous-total, le total général, et ancien solde + mouvements = nouveau solde
  sections.forEach(s => { if (s.subtotal != null) checks.push({ label: s.name, expected: s.subtotal, found: s.sum, ok: cents(s.subtotal) === cents(s.sum) }); });
  const debit = r2(-lines.filter(l => l.amount < 0).reduce((s, l) => s + l.amount, 0));
  const credit = r2(lines.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0));
  if (totals) {
    checks.push({ label: "Total débits", expected: totals.debit, found: debit, ok: cents(totals.debit) === cents(debit) });
    checks.push({ label: "Total crédits", expected: totals.credit, found: credit, ok: cents(totals.credit) === cents(credit) });
  }
  if (openingBalance != null && closingBalance != null) {
    const comp = r2(openingBalance - debit + credit);
    checks.push({ label: "Ancien solde + mouvements = nouveau solde", expected: closingBalance, found: comp, ok: cents(comp) === cents(closingBalance) });
  }
  const ok = lines.length > 0 && checks.length > 0 && checks.every(c => c.ok) && !!start && !!end;
  return {
    ok, error: !lines.length ? "Aucune opération trouvée — ce PDF n'a pas le format attendu (relevé Crédit Mutuel / Arkéa)." : (!ok ? "La lecture ne correspond pas exactement aux totaux du relevé." : null),
    start, end, openingBalance, closingBalance, lines, sections, totals, checks, savingsBalance, debit, credit,
  };
}

// ─────────────────────────────────────────────────────────────────
//  Comparaison avec les données de l'appli (aucune modification)
// ─────────────────────────────────────────────────────────────────
const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`; };
const dayDiff = (a, b) => Math.round((new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 86400000);
const lastDayOf = ym => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").split(/\s+/).filter(w => w.length > 2 && !["vir", "inst", "prlv", "sepa", "carte", "les", "des", "par", "sur", "vers"].includes(w));
const similarity = (a, b) => { const A = new Set(norm(a)), B = norm(b); if (!A.size || !B.length) return 0; return B.filter(w => A.has(w) || [...A].some(x => x.length > 3 && (x.startsWith(w) || w.startsWith(x)))).length / Math.max(A.size, B.length); };
const sameDigits = (a, b) => { const s = n => Math.abs(cents(n)).toString().split("").sort().join(""); return s(a) === s(b); };

/**
 * Opérations de l'appli qui passent par le compte courant, entre start−margin et end+margin.
 * Sens : dépense / versement en cagnotte (virement vers le livret) = négatif ;
 *        revenu / retrait de cagnotte / dissolution (virement depuis le livret) = positif.
 */
export function appMovements(data, start, end, margin = 5) {
  const from = addDays(start, -margin), to = addDays(end, margin);
  const cats = data.categories || [], cags = data.cagnottes || [];
  const out = [];
  (data.transactions || []).forEach(t => {
    const sign = t.type === "expense" || t.type === "epargne" ? -1
      : t.type === "income" || t.type === "decagnottage" || t.type === "dissolution_cagnotte" ? 1 : 0;
    if (!sign) return;                          // équilibre, virements entre cagnottes : ignorés
    const date = t.date || "";
    const isCheque = t.paymentMethod === "cheque";
    if (date > to || (date < from && !isCheque)) return;
    if (isCheque && date < addDays(start, -90)) return;
    const a = parseFloat(t.amount) || 0;
    if (!a) return;
    const cat = cats.find(c => c.id === t.categoryId);
    const cag = cags.find(c => c.id === t.targetCagId);
    const label = t.type === "epargne" ? `Épargne → ${cag?.name || "cagnotte"}` : t.type === "decagnottage" ? `Retrait ← ${cag?.name || "cagnotte"}` : (t.note || cat?.name || "—");
    out.push({ id: `t_${t.id}`, date, amount: r2(sign * a), label, icon: cat?.icon || (t.type === "epargne" || t.type === "decagnottage" ? "🐷" : "💸"), kind: isCheque ? "cheque" : "tx", category: cat?.name || "" });
  });
  // Frais et revenus fixes : une occurrence par mois touché par la période
  const months = [];
  for (let ym = from.slice(0, 7); ym <= to.slice(0, 7); ) { months.push(ym); const [y, m] = ym.split("-").map(Number); const n = new Date(y, m, 1); ym = `${n.getFullYear()}-${pad2(n.getMonth() + 1)}`; }
  const isActive = (f, ym) => {
    if (f.startYM && ym < f.startYM) return false;
    if (f.pauseHistory?.some(p => ym >= p.from && ym <= p.until)) return false;
    if (f.paused && ym >= (f.pausedFrom || "0000-00") && ym <= (f.pausedUntil || "9999-99")) return false;
    return true;
  };
  // `ym` = mois du compte ; `oym` = occurrence versée ce mois-là (v1.64.0 : revenu
  // compté dans le budget du mois suivant, jours « dernier / avant-dernier ouvré »)
  [["fixedExpenses", -1, "📌"], ["fixedIncomes", 1, "💰"]].forEach(([key, sign, ic]) => (data[key] || []).forEach(f => months.forEach(ym => {
    const oym = fixedOccurrenceYM(f, ym);
    if (!isActive(f, oym)) return;
    const a = parseFloat(f.monthlyOverrides?.[oym]?.amount ?? f.amount) || 0;
    if (!a) return;
    const day = resolveFixedDay(f.day, ym);
    const date = day ? `${ym}-${pad2(day)}` : null;
    if (date && (date < from || date > to)) return;
    if (!date && (`${ym}-${pad2(lastDayOf(ym))}` < start || `${ym}-01` > end)) return;
    out.push({ id: `f_${f.id}_${oym}`, date: date || `${ym}-15`, noDay: !date, ym, amount: r2(sign * a), label: f.name, icon: cats.find(c => c.id === f.categoryId)?.icon || ic, kind: "fixed", category: "fixe" });
  })));
  return out;
}

/** Tolérance de date selon le type de ligne bancaire */
function window(b, a) {
  if (a.kind === "cheque") return { min: 0, max: 90 };                 // le chèque passe après son émission
  if (a.noDay) return { min: -40, max: 40 };                            // jour non renseigné : tout le mois
  if (b.kind === "card") return { min: -2, max: 2 };                    // date d'achat écrite dans le libellé
  return { min: -4, max: 4 };
}

export function compareStatement(stmt, data) {
  const bank = stmt.lines.map(l => ({ ...l }));
  const app = appMovements(data, stmt.start, stmt.end);
  const used = new Set(), matched = [];
  const cand = [];
  bank.forEach(b => app.forEach(a => {
    if (cents(a.amount) !== cents(b.amount)) return;
    const d = dayDiff(b.opDate, a.date), w = window(b, a);
    if (d < w.min || d > w.max) return;
    cand.push({ b, a, d: Math.abs(d), sim: similarity(`${b.label} ${b.details.join(" ")}`, `${a.label} ${a.category}`) });
  }));
  cand.sort((x, y) => x.d - y.d || y.sim - x.sim);
  const bankDone = new Set();
  cand.forEach(c => { if (bankDone.has(c.b.id) || used.has(c.a.id)) return; bankDone.add(c.b.id); used.add(c.a.id); matched.push({ bank: c.b, app: c.a, dayGap: c.d }); });

  // Presque pareilles : même sens, dates proches, montant à ≤ 5 % (max 10 €) ou chiffres inversés
  const near = [];
  const leftB = () => bank.filter(b => !bankDone.has(b.id));
  const leftA = () => app.filter(a => !used.has(a.id));
  const nc = [];
  leftB().forEach(b => leftA().forEach(a => {
    if (Math.sign(a.amount) !== Math.sign(b.amount)) return;
    const d = dayDiff(b.opDate, a.date), w = window(b, a);
    if (d < w.min - 1 || d > w.max + 1) return;
    const diff = Math.abs(a.amount - b.amount);
    const swapped = sameDigits(a.amount, b.amount) && cents(a.amount) !== cents(b.amount);
    if (!(swapped || (diff <= Math.min(10, Math.abs(b.amount) * 0.05)))) return;
    nc.push({ b, a, diff, d: Math.abs(d), swapped });
  }));
  nc.sort((x, y) => (y.swapped - x.swapped) || x.diff - y.diff || x.d - y.d);
  nc.forEach(c => { if (bankDone.has(c.b.id) || used.has(c.a.id)) return; bankDone.add(c.b.id); used.add(c.a.id); near.push({ bank: c.b, app: c.a, diff: r2(c.b.amount - c.a.amount), hint: c.swapped ? "chiffres inversés ?" : "montant différent" }); });

  const missing = leftB();                                         // à la banque, pas dans l'appli
  const aside = [], extra = [];
  const seenNoDay = new Set();
  leftA().forEach(a => {
    if (a.kind === "cheque") return aside.push({ ...a, reason: "chèque pas encore encaissé" });
    if (a.kind === "fixed" && a.noDay) {               // jour inconnu : signalé une seule fois, pour vérifier
      const fid = a.id.split("_").slice(1, -1).join("_");
      if (!seenNoDay.has(fid) && a.date >= stmt.start && a.date.slice(0, 7) <= stmt.end.slice(0, 7)) { seenNoDay.add(fid); aside.push({ ...a, reason: "frais fixe sans jour renseigné — introuvable au même montant" }); }
      return;
    }
    if (a.kind === "fixed" && (a.date > stmt.end || a.date < stmt.start)) return;   // hors période : normal
    if (a.date > stmt.end) return aside.push({ ...a, reason: `après la fin du relevé (${stmt.end.slice(8)}/${stmt.end.slice(5, 7)})` });
    if (a.date < stmt.start) return;                               // avant le relevé : pas concerné
    const dup = app.some(o => o !== a && cents(o.amount) === cents(a.amount) && Math.abs(dayDiff(o.date, a.date)) <= 1 && used.has(o.id));
    extra.push({ ...a, hint: dup ? "saisie en double ?" : a.amount < 0 ? "payé en liquide ou avec un autre compte ?" : "reçu sur un autre compte ?" });
  });
  // Opérations de la marge avant le début : déjà sur le relevé précédent → pas d'alerte
  const inPeriod = x => x.date >= stmt.start && x.date <= stmt.end;

  const sum = arr => r2(arr.reduce((s, x) => s + x, 0));
  const missingTotal = sum(missing.map(b => b.amount));
  const extraTotal = sum(extra.filter(inPeriod).map(a => a.amount));
  const nearTotal = sum(near.map(n => n.bank.amount - n.app.amount));
  // Écart de la période : mouvements du relevé − mouvements de l'appli (rapprochés ou non) sur les mêmes dates
  const bankNet = r2(stmt.credit - stmt.debit);
  const appNet = r2(bankNet - missingTotal + extraTotal - nearTotal);
  return {
    matched: matched.sort((x, y) => x.bank.opDate.localeCompare(y.bank.opDate)),
    missing, extra, near, aside,
    totals: { bankNet, appNet, gap: r2(bankNet - appNet), missingTotal, extraTotal, nearTotal },
  };
}

/** Solde des cagnottes de l'appli (pour le comparer au livret) */
export const cagnottesTotal = data => r2((data.cagnottes || []).reduce((s, c) => s + (parseFloat(c.current) || 0), 0));
