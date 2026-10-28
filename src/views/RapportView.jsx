// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useMemo, useEffect } from "react";
import { fmt, currentYM, isIncome, fixedAmountFor, pv, fmtInt } from "../utils.js";
import { useYearMonths, computeMonthTotals, computePeriodTotals, isActiveForMonth, isIncomeDirection, computeSidePaidByCategory, catFamilyIds, computeMonthRecap, categorySpentForMonth, firstDataYM, livedMonths, computeCategoryBreakdown, computeSavingsRates } from "../hooks.js";
import { TagsModal, MONTHS_FR } from "./shared.jsx";
import { TaxRecapCard, TaxSettingsModal } from "./TaxRecap.jsx";

// ─────────────────────────────────────────────────────────────────
//  Helper : résoudre les déductions liées pour une catégorie
// ─────────────────────────────────────────────────────────────────
function getLinkedIncomeForCat(catId, categories, transactions, period) {
  // Catégories qui pointent vers catId (liaison "Remboursement courses" → "Courses")
  const linkedCatIds = categories
    .filter(c => c.linkedToId === catId)
    .map(c => c.id);
  // Aussi : revenus avec exactement la même catégorie (ancien comportement)
  return transactions
    .filter(t => {
      if (!t.date.startsWith(period)) return false;
      if (!isIncome(t.type) || t.type === "dissolution_cagnotte") return false;
      return t.categoryId === catId || linkedCatIds.includes(t.categoryId);
    })
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
}

// ─────────────────────────────────────────────────────────────────
//  Modal détail catégorie
// ─────────────────────────────────────────────────────────────────
function CategoryDetailModal({ onClose, categories, transactions, fixedExpenses, initialCatId }) {
  const now       = new Date();
  const curYM     = currentYM();
  const [selCatId, setSelCatId] = useState(initialCatId || categories[0]?.id || "");

  const cat = categories.find(c => c.id === selCatId);
  // v1.47.0 : une catégorie principale inclut ses sous-catégories
  const fam = useMemo(() => catFamilyIds(categories, selCatId), [categories, selCatId]);

  // Catégories liées à celle sélectionnée
  const linkedCats = categories.filter(c => c.linkedToId === selCatId);

  // Premier mois d'utilisation (première transaction)
  const startYM = useMemo(() => {
    if (!transactions.length) return currentYM();
    return transactions.reduce((min, t) => t.date < min ? t.date : min, transactions[0].date).slice(0, 7);
  }, [transactions]);

  // 6 derniers mois de stats — frais fixes uniquement depuis startYM et jusqu'au mois courant
  const monthStats = useMemo(() => {
    const curYM = currentYM();
    return Array.from({ length: 6 }, (_, i) => {
      const d      = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const ym     = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const inRange = ym >= startYM && ym <= curYM;
      const exp    = transactions
        .filter(t => t.date.startsWith(ym) && t.type === "expense" && fam.includes(t.categoryId))
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const fixExp = inRange ? fixedExpenses
        .filter(f => fam.includes(f.categoryId) && isActiveForMonth(f, ym))
        .reduce((s, f) => s + fixedAmountFor(f, ym), 0) : 0;
      const inc    = getLinkedIncomeForCat(selCatId, categories, transactions, ym);
      const total  = exp + fixExp;
      return { ym, label: d.toLocaleDateString("fr-FR", { month: "short" }), exp: total, fixExp, inc, net: Math.max(0, total - inc) };
    });
  }, [selCatId, transactions, fixedExpenses, categories, startYM]);

  // Totaux année — frais fixes depuis startYM jusqu'au mois courant inclus
  const yearStr       = now.getFullYear().toString();
  const monthsElapsed = now.getMonth() + 1;
  const yearExp    = transactions
    .filter(t => t.date.startsWith(yearStr) && t.type === "expense" && fam.includes(t.categoryId))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const yearFixExp = fixedExpenses
    .filter(f => fam.includes(f.categoryId))
    .reduce((s, f) => {
      let total = 0;
      for (let m = 1; m <= monthsElapsed; m++) {
        const ym = `${yearStr}-${String(m).padStart(2, "0")}`;
        if (ym < startYM) continue; // avant le démarrage de l'app
        if (!isActiveForMonth(f, ym)) continue; // avant le démarrage ou en pause pour ce frais précis
        total += fixedAmountFor(f, ym);
      }
      return s + total;
    }, 0);
  const yearTotal  = yearExp + yearFixExp;
  const yearInc    = getLinkedIncomeForCat(selCatId, categories, transactions, yearStr);
  const yearNet    = Math.max(0, yearTotal - yearInc);
  const txCount    = transactions.filter(t => t.date.startsWith(yearStr) && fam.includes(t.categoryId)).length;
  const fixBaseAmount = fixedExpenses
    .filter(f => fam.includes(f.categoryId))
    .reduce((s, f) => s + (f.amount || 0), 0);

  // Top 5 transactions récentes
  const recent = [...transactions]
    .filter(t => fam.includes(t.categoryId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const maxNet = Math.max(...monthStats.map(m => m.exp), 1);

  return (
    <div className="modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div className="modal-title">📊 Analyse par catégorie</div>

        {/* Sélecteur */}
        <div style={{ marginBottom: 14 }}>
          <select value={selCatId} onChange={e => setSelCatId(e.target.value)}
            style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--accent)", borderRadius: 9, padding: "9px 12px", color: "var(--text)", fontSize: ".82rem" }}>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        {cat && (<>
          {/* Catégorie liée */}
          {linkedCats.length > 0 && (
            <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
              {linkedCats.map(lc => (
                <div key={lc.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", background: "rgba(104,212,152,.1)", border: "1px solid rgba(104,212,152,.25)", borderRadius: 20, fontSize: ".62rem", color: "var(--success)" }}>
                  🔗 Déductions depuis : <strong>{lc.icon} {lc.name}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Totaux année */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: yearFixExp > 0 ? 6 : 14 }}>
            {[
              { l: "💸 Dépensé", v: yearTotal, c: "var(--danger)" },
              { l: "↩ Récupéré", v: yearInc,   c: "var(--success)", hidden: yearInc === 0 },
              { l: "📊 Net",     v: yearNet,    c: yearInc > 0 ? "var(--accent)" : "var(--warning)" },
            ].map(s => (
              <div key={s.l} style={{ background: "var(--surface2)", borderRadius: 9, padding: "8px 10px", opacity: s.hidden ? .35 : 1 }}>
                <div style={{ fontSize: ".55rem", color: "var(--text2)", fontWeight: 700, marginBottom: 3 }}>{s.l}</div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 800, color: s.c, fontSize: ".78rem", fontVariantNumeric: "tabular-nums" }}>{fmt(s.v)}</div>
              </div>
            ))}
          </div>
          {yearFixExp > 0 && (() => {
            const fixes = fixedExpenses.filter(f => fam.includes(f.categoryId));
            // Nombre de mois propre à CHAQUE frais (peut différer d'un frais à l'autre
            // dans la même catégorie si l'un a démarré plus tard que l'autre)
            const monthsForFix = (f) => Array.from({ length: monthsElapsed }, (_, i) => {
              const ym = `${yearStr}-${String(i + 1).padStart(2, "0")}`;
              return ym >= startYM && isActiveForMonth(f, ym) ? 1 : 0;
            }).reduce((s, v) => s + v, 0);
            return (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: ".6rem", color: "var(--warning)", padding: "5px 9px", background: "var(--warning-glow)", borderRadius: "6px 6px 0 0" }}>
                  📌 Dont {fmt(yearFixExp)} de frais fixes
                </div>
                <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 6px 6px", padding: "6px 9px", display: "flex", flexDirection: "column", gap: 3 }}>
                  {fixes.map(f => {
                    const nMonths = monthsForFix(f);
                    return (
                      <div key={f.id} style={{ display: "flex", justifyContent: "space-between", fontSize: ".6rem" }}>
                        <span style={{ color: "var(--text2)" }}>• {f.name}</span>
                        <span style={{ fontFamily: "var(--mono)", color: "var(--warning)", fontWeight: 700 }}>{nMonths} × {fmt(f.amount)} = {fmt(f.amount * nMonths)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {(() => {
            const activeMonths = monthStats.filter(m => m.exp > 0).length;
            const avg = activeMonths > 0 ? yearTotal / activeMonths : 0;
            return (
              <div style={{ fontSize: ".6rem", color: "var(--text3)", marginBottom: 12 }}>
                {txCount} transaction{txCount !== 1 ? "s" : ""} cette année · moy. {fmt(avg)}/mois actif
              </div>
            );
          })()}

          {/* Barres 6 mois */}
          <div style={{ fontSize: ".62rem", fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>Évolution 6 mois</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {monthStats.map(m => (
              <div key={m.ym} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: ".65rem", fontWeight: 700, width: 28, flexShrink: 0, textTransform: "capitalize" }}>{m.label}</span>
                <div style={{ flex: 1, position: "relative", height: 12 }}>
                  {/* Barre dépense */}
                  <div style={{ position: "absolute", inset: 0, background: "var(--surface3)", borderRadius: 99 }} />
                  <div data-pv="" style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${(m.exp / maxNet * 100)}%`, background: "var(--danger)", borderRadius: 99, opacity: .7 }} />
                  {/* Barre net (par dessus) */}
                  {m.inc > 0 && (
                    <div data-pv="" style={{ position: "absolute", top: 2, left: 0, height: "calc(100% - 4px)", width: `${(m.net / maxNet * 100)}%`, background: "var(--accent)", borderRadius: 99 }} />
                  )}
                </div>
                <div style={{ width: 72, textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: ".65rem", fontWeight: 800, color: m.net > 0 ? (m.inc > 0 ? "var(--accent)" : "var(--danger)") : "var(--text3)" }}>
                    {m.net > 0 ? fmt(m.net) : "—"}
                  </span>
                  {m.inc > 0 && <div style={{ fontSize: ".52rem", color: "var(--success)" }}>↩ {fmt(m.inc)}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Transactions récentes */}
          {recent.length > 0 && (<>
            <div style={{ fontSize: ".62rem", fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Dernières opérations</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border)" }}>
              {recent.map((t, i) => {
                const isInc = isIncomeDirection(t);
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: i < recent.length-1 ? "1px solid var(--border-soft)" : "none", background: "var(--surface)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: ".7rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.note || "—"}</div>
                      <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 1 }}>{t.date}</div>
                    </div>
                    <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".75rem", color: isInc ? "var(--success)" : "var(--danger)", flexShrink: 0 }}>
                      {isInc ? "+" : "−"}{fmt(t.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>)}
        </>)}

        <button className="btn btn-outline" style={{ width: "100%", marginTop: 14 }} onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  RAPPORT
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
//  v1.68.0 — Taux d'épargne des 12 derniers mois (barres + moyenne)
// ─────────────────────────────────────────────────────────────────
const MINI = ["J","F","M","A","M","J","J","A","S","O","N","D"];
export function SavingsRateChart({ data, endYM, sel, onSel }) {
  const { months, avg } = useMemo(() => computeSavingsRates(data, endYM, 12), [data, endYM]);
  const pct = r => `${pv(Math.round(r * 100))} %`;
  const lived = months.filter(m => m.rate != null);
  const top = Math.max(0.1, avg || 0, ...lived.map(m => m.rate));
  const cur = months.find(m => m.ym === sel) || [...lived].pop();
  const best = lived.length ? lived.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;
  const H = 100;
  return (
    <div data-testid="savings-rate" style={{ marginTop: 11, paddingTop: 9, borderTop: "1px solid var(--border-soft)" }}>
      <div style={{ display: "flex", alignItems: "baseline", fontSize: ".72rem" }}>
        <span style={{ flex: 1, fontWeight: 800 }}>🐷 Taux d'épargne <small style={{ color: "var(--text3)", fontWeight: 400 }}>12 mois</small></span>
        {avg != null && <span style={{ fontSize: ".64rem", color: "var(--text2)" }}>moyenne <b style={{ color: "var(--purple)" }}>{pct(avg)}</b></span>}
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 5, height: H, marginTop: 8 }}>
        {avg != null && avg > 0 && <div style={{ position: "absolute", left: 0, right: 0, bottom: `${avg / top * 100}%`, borderTop: "1px dashed var(--text2)", pointerEvents: "none" }} />}
        {months.map(m => {
          const on = cur && m.ym === cur.ym;
          const h = m.rate == null ? 2 : m.rate <= 0 ? 6 : Math.max(4, m.rate / top * H);
          return (
            <div key={m.ym} onClick={() => m.rate != null && onSel?.(m.ym)} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", cursor: m.rate != null ? "pointer" : "default" }}>
              <div style={{ width: "100%", height: h, borderRadius: "4px 4px 0 0", opacity: m.rate == null ? .25 : .9,
                background: m.rate == null ? "var(--surface3)" : m.rate < 0 ? "var(--danger)" : "var(--purple)",
                outline: on ? "2px solid var(--purple)" : "none", outlineOffset: 1 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
        {months.map(m => <span key={m.ym} style={{ flex: 1, textAlign: "center", fontSize: ".52rem", color: "var(--text3)" }}>{MINI[parseInt(m.ym.slice(5, 7), 10) - 1]}</span>)}
      </div>
      {cur && (
        <div data-testid="savings-rate-detail" style={{ fontSize: ".62rem", color: "var(--text2)", marginTop: 7, lineHeight: 1.5 }}>
          {MONTHS_FR[parseInt(cur.ym.slice(5, 7), 10) - 1]} : <b style={{ color: cur.rate < 0 ? "var(--danger)" : "var(--text)" }}>{pct(cur.rate)}</b> ({fmt(cur.saved)} sur {fmt(cur.inc)})
          {cur.rate < 0 && " · plus retiré des cagnottes que versé"}
          {best && best.ym !== cur.ym && best.rate > 0 && <> · meilleur mois : {MONTHS_FR[parseInt(best.ym.slice(5, 7), 10) - 1].toLowerCase()} {pct(best.rate)}</>}
        </div>
      )}
      <div style={{ fontSize: ".56rem", color: "var(--text3)", marginTop: 4 }}>Taux = (versements en cagnottes − retraits) ÷ revenus du mois. Touche une barre pour son détail.</div>
    </div>
  );
}

export function RapportView({ data, currentYear, setCurrentYear, monthNotes = {}, onSaveMonthNote, categoryThresholds = {}, onSaveCategoryThreshold, tags = [], onSaveTag, onDeleteTag, onSaveSavingsGoal, onGoToHistorique, onSubtitle, onPushBack, onPopBack, onOpenYearRecap, onSaveTaxSettings, onOpenPatrimoine }) {
  // ── v1.52.0 : 3 onglets organisés par question ──
  //  📅 Mois        « Comment s'est passé ce mois ? »
  //  📆 Année       « Où j'en suis sur l'année ? »
  //  🗂️ Catégories  « Où part mon argent ? »
  const { transactions, categories, fixedExpenses } = data;
  const fixedIncomes = data.fixedIncomes || [];
  const curYM = currentYM();
  const nowY = new Date().getFullYear();
  const [tab, setTab] = useState("mois");
  const [ym, setYm] = useState(curYM);                    // mois affiché (onglets Mois et Catégories)
  const [catPer, setCatPer] = useState("month");          // Catégories : "month" | "year"
  const [cmpYM, setCmpYM] = useState(null);               // Mois : comparaison avec un autre mois
  const [catModal, setCatModal] = useState(null);         // id de catégorie → analyse détaillée
  const [tagsModal, setTagsModal] = useState(null);       // { tagId } | {}
  const [taxOpen, setTaxOpen] = useState(false);          // v1.79.0 : réglages du récap fiscal
  const [editBudget, setEditBudget] = useState(null);     // { catId, draft }
  const [noteDraft, setNoteDraft] = useState(null);
  const [goalDraft, setGoalDraft] = useState(null);
  const [sideType, setSideType] = useState("all");
  const [rateSel, setRateSel] = useState(null);           // v1.68.0 : mois touché dans le graphique du taux d'épargne

  // Bouton retour Android : ferme d'abord les fenêtres ouvertes
  useEffect(() => { if (!catModal) return; onPushBack?.(() => setCatModal(null)); return () => onPopBack?.(); }, [catModal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!tagsModal) return; onPushBack?.(() => setTagsModal(null)); return () => onPopBack?.(); }, [tagsModal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!taxOpen) return; onPushBack?.(() => setTaxOpen(false)); return () => onPopBack?.(); }, [taxOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Barre collée sous l'en-tête (même principe que l'Historique)
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    const h = document.querySelector(".bp-header");
    const upd = () => setStickyTop(h ? Math.round(h.getBoundingClientRect().height) : 0);
    upd(); window.addEventListener("resize", upd);
    const ro = typeof ResizeObserver !== "undefined" && h ? new ResizeObserver(upd) : null;
    ro?.observe(h);
    return () => { window.removeEventListener("resize", upd); ro?.disconnect(); };
  }, []);

  const [yy, mm] = ym.split("-").map(Number);
  const ymLabel = `${MONTHS_FR[mm - 1]} ${yy}`;
  const showYear = tab === "annee" || (tab === "cats" && catPer === "year");
  useEffect(() => { onSubtitle?.(showYear ? `année ${currentYear}` : ymLabel.toLowerCase()); }, [showYear, currentYear, ymLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  const shiftYM = (v, n) => { const d = new Date(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const goPrev = () => { if (showYear) setCurrentYear(y => y - 1); else { setYm(v => shiftYM(v, -1)); setCmpYM(null); } };
  const goNext = () => { if (showYear) setCurrentYear(y => Math.min(y + 1, nowY)); else if (ym < curYM) { setYm(v => shiftYM(v, 1)); setCmpYM(null); } };
  const atEnd = showYear ? currentYear >= nowY : ym >= curYM;

  // ═════ Données « Mois » ═════
  const firstYM = useMemo(() => firstDataYM(transactions), [transactions]);
  const mT = useMemo(() => computeMonthTotals(transactions, fixedExpenses, fixedIncomes, ym), [transactions, fixedExpenses, fixedIncomes, ym]);
  const mAvg = useMemo(() => {
    const prev = [1, 2, 3].map(i => shiftYM(ym, -i)).filter(m => m >= firstYM);
    if (!prev.length) return null;
    const t = prev.map(m => computeMonthTotals(transactions, fixedExpenses, fixedIncomes, m));
    const a = k => t.reduce((s, x) => s + x[k], 0) / t.length;
    return { inc: a("inc"), exp: a("exp"), net: a("net"), n: t.length };
  }, [transactions, fixedExpenses, fixedIncomes, ym, firstYM]); // eslint-disable-line react-hooks/exhaustive-deps
  const recap = useMemo(() => computeMonthRecap(data, ym), [data, ym]);
  const cmpT = useMemo(() => cmpYM ? computeMonthTotals(transactions, fixedExpenses, fixedIncomes, cmpYM) : null, [transactions, fixedExpenses, fixedIncomes, cmpYM]);
  const catBudgets = useMemo(() => categories
    .filter(c => categoryThresholds[c.id] > 0)
    .map(c => ({ c, spent: categorySpentForMonth(categories, transactions, fixedExpenses, c.id, ym), limit: categoryThresholds[c.id] }))
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit), [categories, categoryThresholds, transactions, fixedExpenses, ym]);

  // ═════ Données « Année » ═════
  const months = useYearMonths(transactions, fixedExpenses, currentYear, fixedIncomes);
  const yearly = useMemo(() => computePeriodTotals(transactions, fixedExpenses, fixedIncomes, `${currentYear}-01`, `${currentYear}-12`), [transactions, fixedExpenses, fixedIncomes, currentYear]);
  const isCurYear = currentYear === nowY;
  const prevSame = useMemo(() => {
    const to = isCurYear ? `${currentYear - 1}-${String(new Date().getMonth() + 1).padStart(2, "0")}` : `${currentYear - 1}-12`;
    return computePeriodTotals(transactions, fixedExpenses, fixedIncomes, `${currentYear - 1}-01`, to);
  }, [transactions, fixedExpenses, fixedIncomes, currentYear, isCurYear]);
  const lived = months.filter(m => m.hasData);
  const nM = yearly.months || lived.length || 1;
  const ranked = [...lived].sort((a, b) => b.net - a.net);
  const goal = parseFloat((data.savingsGoals || {})[currentYear]) || 0;
  const monthsLeft = isCurYear ? 12 - (new Date().getMonth() + 1) : 0;

  // ═════ Données « Catégories » ═════
  const catFrom = catPer === "year" ? `${currentYear}-01` : ym;
  const catTo   = catPer === "year" ? `${currentYear}-12` : ym;
  const breakdown = useMemo(() => computeCategoryBreakdown(data, catFrom, catTo), [data, catFrom, catTo]);
  const catLivedMonths = useMemo(() => livedMonths(transactions, catFrom, catTo), [transactions, catFrom, catTo]);
  const catSpentPeriod = id => catLivedMonths.reduce((s, m) => s + categorySpentForMonth(categories, transactions, fixedExpenses, id, m), 0);
  const prefix = catPer === "year" ? String(currentYear) : ym;
  // v1.72.0 : « Où est parti l'argent » (onglet Mois) — toujours le mois affiché
  const monthBreakdown = useMemo(() => computeCategoryBreakdown(data, ym, ym), [data, ym]);
  const CAT_PALETTE = ["#d9a066", "#e08870", "#70b8e0", "#5cc8c0", "#9fb4e6", "#b090e0", "#68d498", "#c8b860", "#8fa9bd"];
  // Couleur stable par catégorie (sa couleur, sinon une teinte fixe d'après sa place dans la liste) → même teinte dans Mois et Catégories
  const rowColor = r => r.id === "__fixes__" ? "#e8944a" : r.id === "__other__" ? "#8fa9bd" : (categories.find(c => c.id === r.id)?.color || CAT_PALETTE[Math.max(0, categories.findIndex(c => c.id === r.id)) % CAT_PALETTE.length]);
  const rowName = r => r.id === "__fixes__" ? "Frais fixes" : r.id === "__other__" ? "Sans catégorie" : categories.find(c => c.id === r.id)?.name || "Catégorie supprimée";
  const rowIcon = r => r.id === "__fixes__" ? "📌" : categories.find(c => c.id === r.id)?.icon || "❔";
  const fmt0 = v => fmtInt(v);
  const MONTH_ABBR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  // Barre empilée par catégorie + légende (Mois : « Où est parti l'argent », Catégories : en-tête)
  const stackBar = (rows, total, h = 14) => (
    <div data-testid="cat-stack" style={{ display: "flex", height: h, borderRadius: 6, overflow: "hidden", gap: 2, background: "var(--surface3)" }}>
      {rows.filter(r => r.net > 0).map((r, i) => (
        <i data-pv="" key={r.id} title={rowName(r)} onClick={() => !r.id.startsWith("__") && setCatModal(r.id)}
          style={{ display: "block", width: `${r.net / total * 100}%`, background: rowColor(r), cursor: r.id.startsWith("__") ? "default" : "pointer" }} />
      ))}
    </div>
  );

  // ── petits éléments d'interface ──
  const segBtn = on => ({ flex: 1, textAlign: "center", fontSize: ".66rem", fontWeight: 800, padding: "7px 0", borderRadius: 8, cursor: "pointer", border: "none",
    background: on ? "var(--seg-on-bg, var(--accent))" : "transparent", color: on ? "var(--seg-on-text, #06121c)" : "var(--text2)" });
  const navBtn = off => ({ width: 32, height: 32, flexShrink: 0, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--accent)",
    fontSize: ".8rem", cursor: off ? "default" : "pointer", opacity: off ? .35 : 1, padding: 0 });
  const secT = (txt, right) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".56rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "12px 0 6px" }}>
      <span style={{ flex: 1 }}>{txt}</span>{right}
    </div>
  );
  const link = (txt, on) => <span onClick={on} style={{ color: "var(--accent)", textTransform: "none", letterSpacing: 0, fontSize: ".64rem", cursor: "pointer" }}>{txt}</span>;
  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "4px 11px", marginBottom: 6 };
  const rowSt = first => ({ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: first ? "none" : "1px solid var(--border-soft)", fontSize: ".72rem" });
  const bar = (pct, col, h = 5) => (
    <div style={{ height: h, borderRadius: 3, background: "var(--surface3)", overflow: "hidden", marginTop: 4 }}>
      <div data-pv="" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", borderRadius: 3, background: col }} />
    </div>
  );
  // v1.76.0 : barre dont la partie « frais fixes » est hachurée
  const fixBar = (pct, fixShare, col, h = 5) => {
    const w = Math.max(0, Math.min(100, pct));
    return (
      <div style={{ height: h, borderRadius: 3, background: "var(--surface3)", overflow: "hidden", marginTop: 4, display: "flex" }}>
        <div data-pv="" data-testid="fix-hatch" style={{ width: `${w * fixShare}%`, height: "100%", background: `repeating-linear-gradient(45deg, ${col} 0 4px, color-mix(in srgb, ${col} 40%, transparent) 4px 8px)` }} />
        <div data-pv="" style={{ width: `${w * (1 - fixShare)}%`, height: "100%", background: col }} />
      </div>
    );
  };
  const budCol = (spent, limit) => spent > limit + 0.004 ? "var(--danger)" : spent / limit >= .8 ? "var(--warning)" : "var(--success)";
  const vsTxt = (v, avg, higherIsGood) => {
    if (avg == null) return { t: "", c: "var(--text3)" };
    if (Math.abs(v - avg) < Math.max(1, Math.abs(avg) * .03)) return { t: "= moyenne", c: "var(--text3)" };
    const up = v > avg, good = higherIsGood ? up : !up;
    const p = avg !== 0 ? Math.round(Math.abs((v - avg) / avg) * 100) : null;
    return { t: `${up ? "▲" : "▼"} ${p != null && Math.abs(avg) > 50 ? `${pv(p)} %` : fmt(Math.abs(v - avg))} vs moy. ${mAvg?.n} mois`, c: good ? "var(--success)" : "var(--danger)" };
  };
  const signed = v => `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v))}`;
  const catOf = id => categories.find(c => c.id === id);

  return (
    <div>
      {/* ── Barre collée : onglets + période ── */}
      <div style={{ position: "sticky", top: stickyTop, zIndex: 50, background: "var(--bg)", margin: "-16px -16px 10px", padding: "8px 16px", borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 11, padding: 3, gap: 3 }}>
          {[["mois", "📅 Mois"], ["annee", "📆 Année"], ["cats", "🗂️ Catégories"]].map(([k, l]) => {
            const alerts = k === "cats" ? catBudgets.filter(b => b.spent > b.limit + 0.004).length : 0;
            return (
              <button key={k} onClick={() => setTab(k)} style={segBtn(tab === k)}>{l}
                {alerts > 0 && <span style={{ marginLeft: 4, background: "var(--danger)", color: "#fff", borderRadius: 8, padding: "0 5px", fontSize: ".52rem" }}>{alerts}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
          <button onClick={goPrev} style={navBtn(false)}>◀</button>
          {tab === "cats"
            ? <div style={{ flex: 1, display: "flex", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: 2, gap: 2 }}>
                <button onClick={() => setCatPer("month")} style={{ ...segBtn(catPer === "month"), padding: "6px 0" }}>{ymLabel}</button>
                <button onClick={() => setCatPer("year")} style={{ ...segBtn(catPer === "year"), padding: "6px 0" }}>Année {currentYear}</button>
              </div>
            : <div style={{ flex: 1, textAlign: "center", fontFamily: "var(--display)", fontSize: ".98rem", fontWeight: 800 }}>{tab === "annee" ? currentYear : ymLabel}</div>}
          <button onClick={goNext} style={navBtn(atEnd)}>▶</button>
        </div>
      </div>

      {/* ══════════════ 📅 MOIS ══════════════ */}
      {tab === "mois" && (<>
        {/* v1.72.0 : le mois raconté en une phrase (mêmes chiffres que les anciennes cases) */}
        {(() => {
          const vI = vsTxt(mT.inc, mAvg?.inc, true), vE = vsTxt(mT.exp, mAvg?.exp, false), vN = vsTxt(mT.net, mAvg?.net, true);
          const small = v => v.t ? <span style={{ fontSize: ".6rem", fontWeight: 700, color: v.c, whiteSpace: "nowrap" }}> ({v.t})</span> : null;
          const pctInc = mT.inc > 0 ? Math.round(mT.sav / mT.inc * 100) : null;
          const past = ym < curYM;
          return (
            <div className="card" data-testid="rap-story" style={{ padding: "12px 13px", marginBottom: 0 }}>
              <div style={{ fontSize: ".56rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text2)" }}>{MONTHS_FR[mm - 1]} en bref</div>
              <div style={{ fontSize: ".86rem", lineHeight: 1.6, marginTop: 5 }}>
                Tu as {past ? "gagné" : "gagné jusqu'ici"} <b style={{ color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>{fmt(mT.inc)}</b>{small(vI)},{" "}
                dépensé <b style={{ color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>{fmt(mT.exp)}</b>{small(vE)}{" "}
                {mT.sav > 0 ? <>et mis <b style={{ color: "var(--purple)", fontVariantNumeric: "tabular-nums" }}>{fmt(mT.sav)}</b> de côté</>
                  : mT.sav < 0 ? <>et repris <b style={{ color: "var(--purple)", fontVariantNumeric: "tabular-nums" }}>{fmt(-mT.sav)}</b> des cagnottes</>
                  : <>et rien mis de côté</>}
                {pctInc != null && mT.sav !== 0 && <span style={{ fontSize: ".66rem", color: "var(--text2)" }}> ({pv(pctInc)} % des revenus)</span>}.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, paddingTop: 8, borderTop: "1px solid var(--border-soft)" }}>
                <span style={{ flex: 1, fontSize: ".68rem", color: "var(--text2)" }}>{mT.net >= 0 ? "Il te reste" : "Il te manque"}{vN.t && <span style={{ display: "block", fontSize: ".58rem", fontWeight: 700, color: vN.c }}>{vN.t}</span>}</span>
                <b data-testid="rap-net" style={{ fontFamily: "var(--mono)", fontSize: "1.25rem", color: mT.net >= 0 ? "var(--success)" : "var(--danger)", fontVariantNumeric: "tabular-nums" }}>{signed(mT.net)}</b>
              </div>
            </div>
          );
        })()}

        {!cmpYM ? (
          <div style={{ textAlign: "right", marginTop: 6 }}>
            {ym > firstYM && link("🔀 Comparer à un autre mois ›", () => setCmpYM(shiftYM(ym, -1)))}
          </div>
        ) : (
          <div style={{ ...card, marginTop: 8, padding: "8px 11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".68rem", marginBottom: 4 }}>
              <b style={{ flex: 1 }}>Comparé à</b>
              <select value={cmpYM} onChange={e => setCmpYM(e.target.value)}
                style={{ background: "var(--surface2)", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 8, padding: "4px 6px", fontSize: ".66rem", fontWeight: 700, fontFamily: "inherit" }}>
                {Array.from({ length: 24 }, (_, i) => shiftYM(curYM, -i)).filter(m => m !== ym && m >= firstYM).map(m => (
                  <option key={m} value={m}>{MONTHS_FR[Number(m.slice(5, 7)) - 1]} {m.slice(0, 4)}</option>
                ))}
              </select>
            </div>
            {[["💰 Revenus", mT.inc, cmpT.inc, true], ["💸 Dépenses", mT.exp, cmpT.exp, false], ["🐷 Épargné", mT.sav, cmpT.sav, true], ["📊 Net", mT.net, cmpT.net, true]].map(([l, a, b, hi], i) => {
              const d = a - b, good = Math.abs(d) < .005 ? null : (hi ? d > 0 : d < 0);
              return (
                <div key={l} style={{ ...rowSt(i === 0), fontSize: ".68rem", padding: "6px 0" }}>
                  <span style={{ flex: 1 }}>{l}</span>
                  <b style={{ width: 84, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(a)}</b>
                  <span style={{ width: 78, textAlign: "right", color: "var(--text3)", fontVariantNumeric: "tabular-nums" }}>{fmt(b)}</span>
                  <span style={{ width: 70, textAlign: "right", fontSize: ".6rem", fontWeight: 800, color: good == null ? "var(--text3)" : good ? "var(--success)" : "var(--danger)" }}>{good == null ? "=" : `${d > 0 ? "▲" : "▼"} ${fmt(Math.abs(d))}`}</span>
                </div>
              );
            })}
            <div style={{ textAlign: "right", marginTop: 2 }}>{link("✕ Fermer la comparaison", () => setCmpYM(null))}</div>
          </div>
        )}

        {monthBreakdown.total > 0 && <>
          {secT("Où est parti l'argent", link("détail ›", () => { setCatPer("month"); setTab("cats"); }))}
          <div style={{ ...card, padding: "10px 11px" }}>
            {stackBar(monthBreakdown.rows, monthBreakdown.total, 16)}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 11px", marginTop: 8 }}>
              {monthBreakdown.rows.filter(r => r.net > 0).map((r, i) => (
                <span key={r.id} onClick={() => !r.id.startsWith("__") && setCatModal(r.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: ".6rem", cursor: r.id.startsWith("__") ? "default" : "pointer", whiteSpace: "nowrap" }}>
                  <i style={{ width: 7, height: 7, borderRadius: "50%", background: rowColor(r) }} />{rowIcon(r)} {rowName(r)} <b style={{ fontVariantNumeric: "tabular-nums" }}>{fmt0(r.net)}</b>
                </span>
              ))}
            </div>
            {monthBreakdown.fixTotal > 0 && (
              <div data-testid="month-fix-total" style={{ fontSize: ".6rem", color: "var(--text2)", marginTop: 7, paddingTop: 6, borderTop: "1px solid var(--border-soft)" }}>
                📌 dont frais fixes <b style={{ color: "#e8944a", fontVariantNumeric: "tabular-nums" }}>{fmt(monthBreakdown.fixTotal)}</b>, comptés dans leurs catégories
              </div>
            )}
          </div>
        </>}

        {recap.movers.length > 0 && <>
          {secT(<>Ce qui a bougé <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>· vs moyenne {recap.monthsCompared} mois</span></>)}
          <div style={card}>
            {recap.movers.map((x, i) => {
              const c = catOf(x.catId);
              return (
                <div key={x.catId} style={{ ...rowSt(i === 0), cursor: c ? "pointer" : "default" }} onClick={() => c && setCatModal(c.id)}>
                  <span>{c?.icon || "❔"}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c?.name || "Sans catégorie"} <small style={{ color: "var(--text3)" }}>{x.pct == null ? "" : x.diff > 0 ? "plus que d'habitude" : "moins que d'habitude"}</small></span>
                  <span style={{ fontSize: ".62rem", fontWeight: 800, color: x.diff > 0 ? "var(--danger)" : "var(--success)" }}>{x.pct == null ? "nouveau" : `${x.pct > 0 ? "▲ +" : "▼ −"}${pv(Math.abs(x.pct))} %`}</span>
                  <b style={{ width: 82, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(x.amount)}</b>
                </div>
              );
            })}
          </div>
        </>}

        {(catBudgets.length > 0 || recap.grocery || recap.tagBudgets.length > 0) && <>
          {secT("Budgets du mois", link("gérer ›", () => { setCatPer("month"); setTab("cats"); }))}
          <div style={card}>
            {[
              ...catBudgets.map(b => ({ k: b.c.id, label: `${b.c.icon || ""} ${b.c.name}`, spent: b.spent, limit: b.limit })),
              ...(recap.grocery ? [{ k: "__groc", label: "🛒 Courses", tag: "budget courses", spent: recap.grocery.spent, limit: recap.grocery.average }] : []),
              ...recap.tagBudgets.map(b => ({ k: b.tag.id, label: `${b.tag.icon} ${b.tag.name}`, tag: "tag", spent: b.spent, limit: b.budget })),
            ].map((b, i) => {
              const col = budCol(b.spent, b.limit);
              return (
                <div key={b.k} style={{ ...rowSt(i === 0), display: "block" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{b.label}{b.tag && <span style={{ marginLeft: 5, fontSize: ".52rem", fontWeight: 800, padding: "1px 6px", borderRadius: 7, background: "var(--surface3)", color: "var(--text3)" }}>{b.tag}</span>}</span>
                    <b style={{ color: col, fontVariantNumeric: "tabular-nums" }}>{fmt(b.spent)} / {fmt(b.limit)}</b>
                  </div>
                  {bar(b.spent / b.limit * 100, col, 6)}
                </div>
              );
            })}
          </div>
        </>}

        {(recap.unpointed > 0 || recap.cheques > 0) && <>
          {secT("À faire")}
          <div style={card}>
            {recap.unpointed > 0 && (
              <div style={{ ...rowSt(true), cursor: "pointer" }} onClick={() => onGoToHistorique?.("unpointed")}>
                <span>⏳</span><span style={{ flex: 1 }}>{recap.unpointed} opération{recap.unpointed > 1 ? "s" : ""} pas pointée{recap.unpointed > 1 ? "s" : ""}</span>
                <b style={{ color: "var(--accent)", fontSize: ".66rem" }}>Voir ›</b>
              </div>
            )}
            {recap.cheques > 0 && (
              <div style={rowSt(recap.unpointed === 0)}>
                <span>🧾</span><span style={{ flex: 1 }}>{recap.cheques} chèque{recap.cheques > 1 ? "s" : ""} non encaissé{recap.cheques > 1 ? "s" : ""}{recap.oldestChequeDays != null ? ` (${recap.oldestChequeDays} j)` : ""}</span>
              </div>
            )}
          </div>
        </>}

        {secT("📝 Note du mois")}
        {noteDraft == null ? (
          <div onClick={() => setNoteDraft(monthNotes[ym] || "")} style={{ ...card, padding: "9px 11px", fontSize: ".7rem", cursor: "pointer", color: monthNotes[ym] ? "var(--text)" : "var(--text3)", display: "flex", gap: 8 }}>
            <span style={{ flex: 1, whiteSpace: "pre-wrap" }}>{monthNotes[ym] || `Ajouter une note pour ${MONTHS_FR[mm - 1].toLowerCase()}…`}</span>
            <span style={{ color: "var(--accent)" }}>✏️</span>
          </div>
        ) : (
          <div style={{ ...card, padding: 9 }}>
            <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} autoFocus rows={3}
              style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: 8, padding: 8, color: "var(--text)", fontSize: ".74rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button className="btn btn-outline" style={{ flex: 1, padding: 7 }} onClick={() => setNoteDraft(null)}>Annuler</button>
              <button className="btn btn-primary" style={{ flex: 1, padding: 7 }} onClick={() => { onSaveMonthNote?.(ym, noteDraft); setNoteDraft(null); }}>Enregistrer</button>
            </div>
          </div>
        )}
      </>)}

      {/* ══════════════ 📆 ANNÉE ══════════════ */}
      {tab === "annee" && (() => {
        const hasPrev = prevSame.inc + prevSame.exp > 0;
        const vsY = (v, p, hi) => {
          if (!hasPrev || !p) return { t: "", c: "var(--text3)" };
          const d = (v - p) / Math.abs(p) * 100, good = hi ? d > 0 : d < 0;
          return { t: `${d > 0 ? "▲" : "▼"} ${pv(Math.abs(Math.round(d)))} % vs ${currentYear - 1}`, c: Math.abs(d) < 3 ? "var(--text3)" : good ? "var(--success)" : "var(--danger)" };
        };
        const rate = yearly.inc > 0 ? (yearly.sav - (yearly.decag || 0)) / yearly.inc * 100 : 0;   // v1.68.0 : net des retraits
        const best = ranked[0], worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
        const rem = Math.max(0, goal - yearly.sav);
        const proj = isCurYear && lived.length > 0 ? {
          inc: yearly.inc + yearly.inc / nM * monthsLeft, exp: yearly.exp + yearly.exp / nM * monthsLeft,
        } : null;
        return (<>
          {/* v1.72.0 : l'année racontée + courbe du net cumulé (projection en pointillés) */}
          {(() => {
            const vI = vsY(yearly.inc, prevSame.inc, true), vE = vsY(yearly.exp, prevSame.exp, false), vN = vsY(yearly.net, prevSame.net, true);
            const small = v => v.t ? <span style={{ fontSize: ".6rem", fontWeight: 700, color: v.c, whiteSpace: "nowrap" }}> ({v.t})</span> : null;
            let cum = 0;
            const pts = months.map((m, i) => (m.hasData ? { i, v: (cum += m.net) } : null)).filter(Boolean);
            const lastP = pts[pts.length - 1];
            const projNet = proj ? proj.inc - proj.exp : null;
            const vals = [0, ...pts.map(p => p.v), ...(projNet != null ? [projNet] : [])];
            const lo = Math.min(...vals), hi = Math.max(...vals), span = Math.max(1, hi - lo);
            const W = 300, H = 86, X = i => 8 + i * ((W - 16) / 11), Y = v => 8 + (hi - v) / span * (H - 20);
            return (
              <div className="card" data-testid="rap-year-story" style={{ padding: "12px 13px", marginBottom: 0 }}>
                <div style={{ fontSize: ".56rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text2)" }}>{currentYear} en bref</div>
                <div style={{ fontSize: ".84rem", lineHeight: 1.6, marginTop: 5 }}>
                  En {nM} mois : <b style={{ color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>{fmt(yearly.inc)}</b> gagnés{small(vI)},{" "}
                  <b style={{ color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>{fmt(yearly.exp)}</b> dépensés{small(vE)},{" "}
                  <b style={{ color: "var(--purple)", fontVariantNumeric: "tabular-nums" }}>{fmt(yearly.sav)}</b> épargnés <span style={{ fontSize: ".66rem", color: "var(--text2)" }}>(taux : {pv(rate.toFixed(1).replace(".", ","))} %)</span>.
                </div>
                <div style={{ fontSize: ".6rem", color: "var(--text2)", marginTop: 2 }}>
                  Soit {fmt(yearly.inc / nM)}/mois de revenus et {fmt(yearly.exp / nM)}/mois de dépenses · net <b style={{ color: yearly.net >= 0 ? "var(--success)" : "var(--danger)" }}>{signed(yearly.net)}</b>{small(vN)}
                </div>
                {!hasPrev && <div style={{ fontSize: ".56rem", color: "var(--text3)", marginTop: 2 }}>{currentYear - 1} : pas de données à comparer pour l'instant.</div>}
                {pts.length > 0 && (
                  <>
                    <svg data-pv="" viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, marginTop: 6, display: "block" }}>
                      <line x1="8" x2={W - 8} y1={Y(0)} y2={Y(0)} stroke="rgba(255,255,255,.12)" />
                      <polyline fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinejoin="round" points={pts.map(p => `${X(p.i)},${Y(p.v)}`).join(" ")} />
                      {pts.map(p => <circle key={p.i} cx={X(p.i)} cy={Y(p.v)} r="2.2" fill="var(--success)" />)}
                      {projNet != null && lastP && lastP.i < 11 && <>
                        <polyline fill="none" stroke="var(--success)" strokeWidth="2" strokeDasharray="4 4" opacity=".6" points={`${X(lastP.i)},${Y(lastP.v)} ${X(11)},${Y(projNet)}`} />
                        <circle cx={X(11)} cy={Y(projNet)} r="3.5" fill="var(--success)" />
                        <text x={X(11) - 4} y={Math.max(10, Y(projNet) - 6)} textAnchor="end" fontSize="9" fontWeight="800" fill="var(--success)">{signed(projNet).replace(",00", "")} au 31 déc.</text>
                      </>}
                    </svg>
                    <div style={{ fontSize: ".54rem", color: "var(--text3)" }}>Courbe = net cumulé depuis janvier{projNet != null ? " · pointillés = projection au rythme moyen" : ""}</div>
                  </>
                )}
              </div>
            );
          })()}
          {onOpenYearRecap && lived.length > 0 && (
            <button data-testid="open-year-recap" onClick={() => onOpenYearRecap(currentYear)}
              style={{ width: "100%", marginTop: 8, padding: "9px 12px", borderRadius: 11, border: "1px solid rgba(176,144,224,.45)", background: "rgba(176,144,224,.08)", color: "var(--text)", fontSize: ".72rem", fontWeight: 800, cursor: "pointer", textAlign: "left" }}>
              🎆 Bilan de l'année {currentYear}{isCurYear ? " (jusqu'ici)" : ""} <span style={{ float: "right", color: "var(--purple)" }}>›</span>
            </button>
          )}

          {secT(<>Calendrier <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>· net de chaque mois · touche pour l'ouvrir</span></>)}
          {(() => {
            const avgNet = lived.length ? lived.reduce((a, m) => a + m.net, 0) / lived.length : 0;
            const mxF = Math.max(1, ...months.map(m => Math.max(m.inc, m.exp)));
            return (
              <div data-testid="rap-calendar" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 5 }}>
                {months.map((m, i) => {
                  const ymI = `${currentYear}-${String(i + 1).padStart(2, "0")}`;
                  const col = !m.hasData ? "var(--text3)" : m.net < 0 ? "var(--danger)" : m.net >= avgNet ? "var(--success)" : "var(--sapin)";
                  const isCur = ymI === curYM;
                  return (
                    <div key={i} data-month={ymI} onClick={() => { if (m.hasData) { setYm(ymI); setCmpYM(null); setTab("mois"); } }}
                      style={{ borderRadius: 11, padding: "6px 7px 7px", minWidth: 0, cursor: m.hasData ? "pointer" : "default", opacity: m.hasData ? 1 : .35,
                        background: m.hasData ? `color-mix(in srgb, ${col} 11%, var(--surface))` : "var(--surface)", border: `1px solid ${isCur ? "var(--accent)" : "var(--border)"}` }}>
                      <div style={{ fontSize: ".56rem", fontWeight: 800, color: "var(--text2)" }}>{MONTH_ABBR[i]}</div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: ".7rem", fontWeight: 800, color: col, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>{m.hasData ? `${m.net >= 0 ? "+" : "−"}${fmt0(Math.abs(m.net))}` : "—"}</div>
                      {m.hasData && (
                        <div style={{ display: "grid", gap: 2, marginTop: 4 }} title={`Revenus ${fmt(m.inc)} · Dépenses ${fmt(m.exp)}`}>
                          <i data-pv="" style={{ display: "block", height: 3, borderRadius: 2, width: `${m.inc / mxF * 100}%`, background: "rgba(104,212,152,.75)" }} />
                          <i data-pv="" style={{ display: "block", height: 3, borderRadius: 2, width: `${m.exp / mxF * 100}%`, background: "rgba(200,112,112,.75)" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: ".58rem", color: "var(--text3)", margin: "6px 2px 0" }}>
            <span><i style={{ display: "inline-block", width: 10, height: 3, borderRadius: 2, background: "rgba(104,212,152,.75)", verticalAlign: "middle" }} /> revenus · <i style={{ display: "inline-block", width: 10, height: 3, borderRadius: 2, background: "rgba(200,112,112,.75)", verticalAlign: "middle" }} /> dépenses</span>
            {best && <span>🥇 <b style={{ color: "var(--success)" }}>{MONTHS_FR[months.indexOf(best)].toLowerCase()} {signed(best.net)}</b>{worst && <> · moins bon : <b style={{ color: worst.net < 0 ? "var(--danger)" : "var(--warning)" }}>{MONTHS_FR[months.indexOf(worst)].toLowerCase()} {signed(worst.net)}</b></>}</span>}
          </div>

          {secT("🐷 Épargne")}
          <div style={{ ...card, padding: "10px 11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".72rem" }}>
              <span style={{ flex: 1 }}>Objectif {currentYear}</span>
              {goalDraft == null
                ? <><b style={{ fontVariantNumeric: "tabular-nums" }}>{goal > 0 ? `${fmt(yearly.sav)} / ${fmt(goal)}` : "aucun"}</b>
                    <span onClick={() => setGoalDraft(goal ? String(goal) : "")} style={{ color: "var(--accent)", cursor: "pointer" }}>✏️</span></>
                : <><input value={goalDraft} onChange={e => setGoalDraft(e.target.value)} inputMode="decimal" autoFocus placeholder="Ex : 3000"
                      style={{ width: 90, background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: 7, padding: "4px 7px", color: "var(--text)", fontSize: ".74rem", fontFamily: "var(--mono)", textAlign: "right" }} />
                    <button onClick={() => { onSaveSavingsGoal?.(currentYear, parseFloat(String(goalDraft).replace(",", ".")) || 0); setGoalDraft(null); }}
                      style={{ background: "var(--accent)", color: "var(--bg)", border: "none", borderRadius: 7, padding: "5px 9px", fontSize: ".64rem", fontWeight: 800, cursor: "pointer" }}>OK</button></>}
            </div>
            {goal > 0 && <>
              {bar(yearly.sav / goal * 100, "var(--purple)", 7)}
              <div style={{ fontSize: ".6rem", marginTop: 5, color: rem > 0 ? "var(--warning)" : "var(--success)" }}>
                {rem <= 0 ? "✅ Objectif atteint" : monthsLeft > 0 ? <>Pour l'atteindre : <b>{fmt(rem / monthsLeft)}/mois</b> sur les {monthsLeft} mois restants</> : <>Il manque <b>{fmt(rem)}</b></>}
              </div>
            </>}
            {/* v1.68.0 : taux d'épargne sur 12 mois (versements − retraits) ÷ revenus, moyenne en pointillés, détail au toucher */}
            <SavingsRateChart data={data} endYM={isCurYear ? curYM : `${currentYear}-12`} sel={rateSel} onSel={setRateSel} />
          </div>

          {proj && <>
            {secT("🔮 Fin d'année prévue")}
            <div style={card}>
              <div style={rowSt(true)}><span style={{ flex: 1 }}>Revenus prévus</span><b style={{ color: "var(--success)" }}>{fmt(proj.inc)}</b></div>
              <div style={rowSt(false)}><span style={{ flex: 1 }}>Dépenses prévues</span><b style={{ color: "var(--danger)" }}>{fmt(proj.exp)}</b></div>
              <div style={rowSt(false)}><span style={{ flex: 1 }}>Net prévu au 31 déc.<small style={{ display: "block", color: "var(--text3)", fontSize: ".56rem" }}>au rythme moyen des {nM} mois</small></span>
                <b style={{ color: proj.inc - proj.exp >= 0 ? "var(--success)" : "var(--danger)" }}>{signed(proj.inc - proj.exp)}</b></div>
            </div>
          </>}

          {/* v1.79.0 : courbe du patrimoine (compte + cagnottes, 12 mois) */}
          {onOpenPatrimoine && <>
            {secT("📈 Patrimoine")}
            <div data-testid="rap-patrimoine" style={{ ...card, padding: "9px 11px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={onOpenPatrimoine}>
              <span style={{ fontSize: "1.2rem" }}>📈</span>
              <span style={{ flex: 1, fontSize: ".72rem" }}><b>Évolution sur 12 mois</b><div style={{ fontSize: ".6rem", color: "var(--text3)" }}>compte courant + cagnottes, mois par mois</div></span>
              <b style={{ color: "var(--accent)", fontSize: ".7rem" }}>Voir ›</b>
            </div>
          </>}

          {/* v1.79.0 : récap fiscal de l'année (estimation, règles modifiables) */}
          {onSaveTaxSettings && <>
            {secT("🧾 Impôts")}
            <TaxRecapCard data={data} year={currentYear} onOpenSettings={() => setTaxOpen(true)} />
          </>}
        </>);
      })()}

      {/* ══════════════ 🗂️ CATÉGORIES ══════════════ */}
      {tab === "cats" && (() => {
        const nMonths = Math.max(1, catLivedMonths.length);
        const sideTypes = data.sideAmountTypes || [];
        const txSide = t => Object.entries(t.sideAmounts || {}).reduce((s, [k, v]) => s + (sideType === "all" || k === sideType ? (parseFloat(v) || 0) : 0), 0);
        const sideTxs = transactions.filter(t => t.type === "expense" && (t.date || "").startsWith(prefix) && Object.values(t.sideAmounts || {}).some(v => parseFloat(v) > 0));
        const offExp = (data.offAccountEntries || []).filter(x => x.kind === "expense" && (x.date || "").startsWith(prefix));
        const anySide = sideTxs.length > 0 || offExp.length > 0;
        const byType = {};
        sideTxs.forEach(t => Object.entries(t.sideAmounts || {}).forEach(([k, v]) => { byType[k] = (byType[k] || 0) + (parseFloat(v) || 0); }));
        offExp.forEach(x => { byType[x.satId] = (byType[x.satId] || 0) + (parseFloat(x.amount) || 0); });
        const sidePaidBank = sideTxs.filter(t => txSide(t) > 0 || sideType === "all").reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const sideTotal = sideTxs.reduce((s, t) => s + txSide(t), 0) + offExp.filter(x => sideType === "all" || x.satId === sideType).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
        const sideRows = computeSidePaidByCategory(transactions, data.offAccountEntries, sideType, prefix);
        const tagRows = tags.map(tag => {
          const txs = transactions.filter(t => t.type === "expense" && (t.tagIds || []).includes(tag.id) && (t.date || "").startsWith(prefix));
          const spent = txs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
          const b = parseFloat(tag.budget) || 0;
          const limit = b > 0 ? (tag.budgetPeriod === "total" ? b : b * (catPer === "year" ? nMonths : 1)) : 0;
          const spentForBudget = tag.budgetPeriod === "total" ? transactions.filter(t => t.type === "expense" && (t.tagIds || []).includes(tag.id)).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0) : spent;
          return { tag, count: txs.length, spent, limit, spentForBudget };
        }).sort((a, b) => b.spent - a.spent);
        return (<>
          {/* v1.72.0 : total + barre empilée, puis une carte par catégorie (liseré de sa couleur) */}
          <div style={{ ...card, padding: "10px 11px" }} data-testid="cat-total">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: ".56rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text2)" }}>Total dépensé · {catPer === "year" ? currentYear : MONTHS_FR[mm - 1].toLowerCase()}</span>
              <b style={{ fontFamily: "var(--mono)", fontSize: "1.05rem", fontVariantNumeric: "tabular-nums" }}>{fmt(breakdown.total)}</b>
            </div>
            {breakdown.fixTotal > 0 && (
              <div data-testid="cat-fix-total" style={{ fontSize: ".6rem", color: "var(--text2)", marginTop: 2 }}>
                📌 dont frais fixes <b style={{ color: "#e8944a", fontVariantNumeric: "tabular-nums" }}>{fmt(breakdown.fixTotal)}</b> · variables <b style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(Math.max(0, breakdown.total - breakdown.fixTotal))}</b>
                <span style={{ color: "var(--text3)" }}> — rangés dans leurs catégories (▨)</span>
              </div>
            )}
            {breakdown.total > 0 && <div style={{ marginTop: 7 }}>{stackBar(breakdown.rows, breakdown.total)}</div>}
            {breakdown.rows.length === 0 && <div style={{ fontSize: ".7rem", color: "var(--text3)", textAlign: "center", padding: "10px 0 4px" }}>Aucune dépense sur cette période.</div>}
          </div>
          <div>
            {breakdown.rows.map((r, i) => {
              const c = r.id.startsWith("__") ? null : catOf(r.id);
              const name = r.id === "__fixes__" ? "Frais fixes" : r.id === "__other__" ? "Sans catégorie" : c?.name || "Catégorie supprimée";
              const icon = r.id === "__fixes__" ? "📌" : c?.icon || "❔";
              const pct = breakdown.total > 0 ? r.net / breakdown.total * 100 : 0;
              const lim = c ? (categoryThresholds[c.id] || 0) : 0;
              const limP = lim * (catPer === "year" ? nMonths : 1);
              const spentB = lim > 0 ? catSpentPeriod(c.id) : 0;
              const editing = editBudget?.catId === r.id;
              return (
                <div key={r.id} data-cat-row={r.id} style={{ ...card, padding: "8px 11px", border: `1px solid color-mix(in srgb, ${rowColor(r)} 45%, transparent)`, fontSize: ".72rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: c ? "pointer" : "default" }} onClick={() => c && setCatModal(c.id)}>
                    <span>{icon}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}
                      {r.id === "__fixes__" && <span style={{ marginLeft: 5, fontSize: ".52rem", fontWeight: 800, padding: "1px 6px", borderRadius: 7, background: "var(--surface3)", color: "var(--text3)" }}>fixes</span>}</span>
                    <span style={{ fontSize: ".58rem", color: "var(--text3)" }}>{pv(Math.round(pct))} %</span>
                    <b style={{ width: 84, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.net)}</b>
                    <span style={{ color: "var(--text3)", width: 8 }}>{c ? "›" : ""}</span>
                  </div>
                  {r.fixed > 0 && (
                    <div data-testid="cat-row-fix" style={{ fontSize: ".56rem", color: "var(--text3)", margin: "1px 0 0 24px", lineHeight: 1.45 }}>
                      📌 dont fixes <b style={{ color: "#e8944a" }}>{fmt(r.fixed)}</b> ({r.fixes.map(x => `${x.name} ${fmt(x.amount)}`).join(" · ")}){r.gross - r.fixed > 0.004 ? <> · variables {fmt(r.gross - r.fixed)}</> : null}
                    </div>
                  )}
                  {(r.subs.length > 0 || r.deducted > 0) && (
                    <div style={{ fontSize: ".56rem", color: "var(--text3)", margin: "1px 0 0 24px" }}>
                      {r.subs.length > 0 && <>dont {r.subs.map(s => `${catOf(s.id)?.icon || ""} ${catOf(s.id)?.name || "?"} ${fmt(s.amount)}`).join(" · ")}</>}
                      {r.deducted > 0 && <>{r.subs.length > 0 ? " · " : ""}− {fmt(r.deducted)} de revenus liés déduits</>}
                    </div>
                  )}
                  {r.fixed > 0 ? fixBar(pct, r.gross > 0 ? r.fixed / r.gross : 0, rowColor(r)) : bar(pct, rowColor(r))}
                  {c && (editing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: ".6rem", color: "var(--text2)" }}>🎯 Budget / mois</span>
                      <input value={editBudget.draft} onChange={e => setEditBudget({ ...editBudget, draft: e.target.value })} inputMode="decimal" autoFocus placeholder="0 = aucun"
                        style={{ flex: 1, minWidth: 0, background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: 7, padding: "5px 8px", color: "var(--text)", fontSize: ".72rem", fontFamily: "var(--mono)" }} />
                      <button onClick={() => { onSaveCategoryThreshold?.(c.id, Math.max(0, parseFloat(String(editBudget.draft).replace(",", ".")) || 0)); setEditBudget(null); }}
                        style={{ background: "var(--accent)", color: "var(--bg)", border: "none", borderRadius: 7, padding: "6px 10px", fontSize: ".62rem", fontWeight: 800, cursor: "pointer" }}>OK</button>
                      <button onClick={() => setEditBudget(null)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}>✕</button>
                    </div>
                  ) : lim > 0 ? (
                    <div onClick={() => setEditBudget({ catId: c.id, draft: String(lim) })} style={{ fontSize: ".58rem", marginTop: 3, fontWeight: 700, color: budCol(spentB, limP), cursor: "pointer" }}>
                      🎯 {fmt(spentB)} / {fmt(limP)}{catPer === "year" ? ` (${fmt(lim)} × ${nMonths} mois)` : ""} · {spentB > limP ? `dépassé de ${fmt(spentB - limP)}` : `reste ${fmt(limP - spentB)}`}{spentB - r.gross > 0.5 ? " · fixes compris" : ""} ✏️
                    </div>
                  ) : (
                    <div onClick={() => setEditBudget({ catId: c.id, draft: "" })} style={{ fontSize: ".58rem", marginTop: 3, color: "var(--text3)", cursor: "pointer" }}>+ ajouter un budget</div>
                  ))}
                </div>
              );
            })}
          </div>

          {anySide && <>
            {secT("🎫 Montants à part & hors banque")}
            <div style={{ ...card, padding: "9px 11px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                {[["Payé banque", sidePaidBank, "var(--danger)"], ["Hors banque", sideTotal, "var(--tr)"], ["Budget réel", sidePaidBank + sideTotal, "var(--text)"]].map(([l, v, col]) => (
                  <div key={l} style={{ borderRadius: 9, padding: "6px 7px", background: "var(--surface2)", border: "1px solid var(--border-soft)", minWidth: 0 }}>
                    <div style={{ fontSize: ".5rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text3)" }}>{l}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: ".74rem", fontWeight: 800, color: col, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fmt(v)}</div>
                  </div>
                ))}
              </div>
              {Object.keys(byType).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {[["all", "Tous", null], ...sideTypes.filter(st => byType[st.id]).map(st => [st.id, `${st.icon} ${st.label}`, byType[st.id]])].map(([k, l, v]) => (
                    <span key={k} onClick={() => setSideType(k)} style={{ fontSize: ".6rem", fontWeight: 700, padding: "4px 9px", borderRadius: 10, cursor: "pointer",
                      border: `1px solid ${sideType === k ? "var(--tr)" : "var(--border)"}`, color: sideType === k ? "var(--tr)" : "var(--text2)", background: sideType === k ? "var(--tr-glow)" : "transparent" }}>
                      {l}{v != null ? ` · ${fmt(v)}` : ""}
                    </span>
                  ))}
                </div>
              )}
              {sideRows.map((r, i) => {
                const c = catOf(r.categoryId);
                return (
                  <div key={r.categoryId || i} style={rowSt(i === 0 && Object.keys(byType).length === 0)}>
                    <span>{c?.icon || "❔"}</span><span style={{ flex: 1 }}>{c?.name || "Sans catégorie"}</span>
                    <span style={{ fontSize: ".56rem", color: "var(--text3)" }}>{pv(Math.round(r.pct))} % du total</span>
                    <b style={{ color: "var(--tr)", fontVariantNumeric: "tabular-nums" }}>{fmt(r.side)}</b>
                  </div>
                );
              })}
              <div style={{ fontSize: ".54rem", color: "var(--text3)", marginTop: 6 }}>« Budget réel » = payé par la banque + hors banque, sur les achats concernés. N'affecte jamais ton solde.</div>
            </div>
          </>}

          {secT("🏷️ Tags", link("gérer ›", () => setTagsModal({})))}
          <div style={card}>
            {tagRows.length === 0 && <div style={{ fontSize: ".66rem", color: "var(--text3)", padding: "8px 0" }}>Aucun tag — « gérer » pour en créer.</div>}
            {tagRows.map((r, i) => {
              const col = r.limit > 0 ? budCol(r.spentForBudget, r.limit) : "var(--text)";
              return (
                <div key={r.tag.id} style={{ ...rowSt(i === 0), display: "block", cursor: "pointer" }} onClick={() => setTagsModal({ tagId: r.tag.id })}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{r.tag.icon} {r.tag.name} <small style={{ color: "var(--text3)" }}>· {r.count} opération{r.count > 1 ? "s" : ""}</small></span>
                    <b style={{ color: col, fontVariantNumeric: "tabular-nums" }}>{r.limit > 0 ? `${fmt(r.spentForBudget)} / ${fmt(r.limit)}` : fmt(r.spent)}</b>
                    <span style={{ color: "var(--text3)" }}>›</span>
                  </div>
                  {r.limit > 0 && bar(r.spentForBudget / r.limit * 100, col)}
                  {r.limit > 0 && r.tag.budgetPeriod === "total" && <div style={{ fontSize: ".54rem", color: "var(--text3)", marginTop: 2 }}>budget global (toutes périodes)</div>}
                </div>
              );
            })}
          </div>
        </>);
      })()}

      {catModal && (
        <CategoryDetailModal onClose={() => setCatModal(null)} initialCatId={catModal}
          categories={categories} transactions={transactions} fixedExpenses={fixedExpenses} />
      )}
      {taxOpen && (
        <TaxSettingsModal data={data} year={currentYear} onClose={() => setTaxOpen(false)}
          onSave={st => { onSaveTaxSettings?.(st); setTaxOpen(false); }} />
      )}
      {tagsModal && (
        <TagsModal onClose={() => setTagsModal(null)} initialTagId={tagsModal.tagId}
          tags={tags} transactions={transactions} fixedExpenses={fixedExpenses} categories={categories}
          onSaveTag={onSaveTag} onDeleteTag={onDeleteTag} />
      )}
    </div>
  );
}
