// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { fmt, currentYM, isIncome, txLabel, txTypeClass, txSign, todayISO, recurringRefDate, daysBetweenISO, touchMoved, fixedAmountFor, resolveFixedDay, pv } from "../utils.js";
import { useMonthStats, isPointable, isActiveForMonth, isIncomeDirection } from "../hooks.js";
import { EmptyIllustration, MONTHS_FR } from "./shared.jsx";

// v1.74.0 : bouton d'action rond (glissement d'une ligne, feuille d'actions) — même famille que le menu du +
export function RoundAct({ icon, label, color, size = 32, onClick, testid }) {
  return (
    <div role="button" data-testid={testid} onClick={onClick}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", minWidth: size + 8, touchAction: "manipulation" }}>
      <span style={{ width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size > 36 ? "1.05rem" : ".85rem",
        background: "var(--fab-menu-bg, var(--surface2))", border: `2px solid ${color}`, boxShadow: "0 3px 10px rgba(0,0,0,.35)" }}>{icon}</span>
      <span style={{ fontSize: size > 36 ? ".58rem" : ".48rem", fontWeight: 800, color, whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  HISTORIQUE — ligne pointable (transactions + frais fixes)
// ─────────────────────────────────────────────────────────────────
function PointRow({ item, onToggle, isFixed = false, onEditFixed, onEdit, onDelete }) {
  const [editing,     setEditing]     = useState(false);
  const [draftName,   setDraftName]   = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const isInc = item.type === "income" || item.type === "dissolution_cagnotte"
    || (item.type === "balance_adjustment" && item.adjSign === "+");

  // Swipe gauche → révèle Edit + Delete
  const swipeStart = useRef({ x:0, y:0 });
  const isHSwipe   = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const REVEAL_W = onEdit || onDelete ? 112 : 0;

  function onSwipeStart(e) {
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isHSwipe.current = false;
  }
  function onSwipeMove(e) {
    const dx = e.touches[0].clientX - swipeStart.current.x;
    const dy = e.touches[0].clientY - swipeStart.current.y;
    if (!isHSwipe.current && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (!isHSwipe.current) {
      isHSwipe.current = Math.abs(dx) > Math.abs(dy);
      if (!isHSwipe.current) return;
    }
    if (dx < 0 && REVEAL_W) {
      e.preventDefault();
      setSwipeOffset(Math.max(dx, -REVEAL_W));
    } else if (dx > 0 && swipeOffset < 0) {
      e.preventDefault();
      setSwipeOffset(Math.min(0, swipeOffset + dx));
    }
  }
  function onSwipeEnd(e) {
    if (isHSwipe.current && REVEAL_W) {
      setSwipeOffset(swipeOffset < -REVEAL_W / 2 ? -REVEAL_W : 0);
    }
    isHSwipe.current = false;
  }
  function closeSwipe() { setSwipeOffset(0); }

  function startEdit() {
    setDraftName(item.name || "");
    setDraftAmount(String(item.amount || ""));
    setEditing(true);
  }
  function saveEdit() {
    const a = parseFloat(draftAmount);
    if (!isNaN(a) && a > 0) onEditFixed?.(item.id, { name: draftName.trim() || item.name, amount: a });
    setEditing(false);
  }

  return (
    <div style={{ position:"relative", overflow:"hidden" }}>
      {/* Boutons d'action révélés par swipe gauche */}
      {/* v1.62.1 : boutons rendus seulement pendant/après un glissement — avant, ils
          restaient dessous en permanence et se voyaient à travers le fond
          semi-transparent des lignes pointées (filtre « Pointées »). */}
      {REVEAL_W > 0 && swipeOffset < 0 && (
        <div style={{ position:"absolute", top:0, right:0, bottom:0, width:REVEAL_W, display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
          {onEdit && <RoundAct icon="✏️" label="Modifier" color="var(--accent)" onClick={() => { closeSwipe(); onEdit(item.id); }} />}
          {onDelete && <RoundAct icon="🗑" label="Supprimer" color="var(--danger)" onClick={() => { closeSwipe(); onDelete(item.id); }} />}
        </div>
      )}

      {/* Ligne principale */}
      <div
        onTouchStart={onSwipeStart}
        onTouchMove={onSwipeMove}
        onTouchEnd={onSwipeEnd}
        style={{
          transform:`translateX(${swipeOffset}px)`,
          transition: (swipeOffset === 0 || swipeOffset === -REVEAL_W) ? "transform .22s ease" : "none",
        }}>
      {/* v1.73.0 : même présentation que les lignes de la frise (icône teintée, rond de pointage à droite) ;
           frais / revenu fixe : toucher la ligne = corriger pour ce mois */}
      <div data-testid={isFixed ? "fix-row" : undefined}
        onClick={isFixed && onEditFixed ? () => (editing ? setEditing(false) : startEdit()) : undefined}
        style={{
        display: "flex", alignItems: "center", gap: 9, padding: "8px 10px",
        borderBottom: editing ? "none" : "1px solid rgba(255,255,255,.06)",
        background: swipeOffset < 0 ? "var(--bg)" : "transparent",
        cursor: isFixed && onEditFixed ? "pointer" : "default",
      }}>
        {(() => {
          const tint = item.cat?.color || (isInc ? "var(--success)" : isFixed ? "#e8944a" : "var(--text3)");
          return (
            <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".95rem",
              background: `color-mix(in srgb, ${tint} 18%, transparent)` }}>
              {item.cat?.icon ?? (isInc ? "💰" : isFixed ? "📌" : "💸")}
            </div>
          );
        })()}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: ".74rem", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.name || item.note || "—"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, overflow: "hidden" }}>
            {isFixed && <span style={{ fontSize: ".5rem", fontWeight: 800, padding: "1px 6px", borderRadius: 7, color: "#e8944a", background: "color-mix(in srgb, #e8944a 15%, transparent)", flexShrink: 0 }}>{item.dayNum ? `FIXE · le ${item.dayNum}` : "FIXE"}</span>}
            {item.isAutoSaving  && <span style={{ fontSize: ".5rem", fontWeight: 800, padding: "1px 6px", borderRadius: 7, color: "var(--purple)",  background: "color-mix(in srgb, var(--purple) 15%, transparent)", flexShrink: 0 }}>AUTO</span>}
            {item.fromScheduled && <span style={{ fontSize: ".5rem", fontWeight: 800, padding: "1px 6px", borderRadius: 7, color: "var(--warning)", background: "color-mix(in srgb, var(--warning) 15%, transparent)", flexShrink: 0 }}>PROG</span>}
            {isFixed && item.isOverridden && <span style={{ fontSize: ".5rem", fontWeight: 800, padding: "1px 6px", borderRadius: 7, color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 15%, transparent)", flexShrink: 0 }}>✏️ modifié</span>}
            {item.date && <span style={{ fontSize: ".58rem", color: "var(--text2)", flexShrink: 0 }}>{dayLabel(item.date)}</span>}
          </div>
        </div>
        <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".8rem", flexShrink: 0, color: isInc ? "var(--success)" : "var(--danger)", opacity: item.pointed ? 1 : .7, fontVariantNumeric: "tabular-nums" }}>
          {isInc ? "+" : "−"}{fmt(item.amount)}
        </span>
        {/* Rond de pointage (à droite, comme la frise) */}
        <button aria-label={item.pointed ? "Dépointer" : "Pointer"}
          onTouchStart={e => e.stopPropagation()}
          onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); onToggle(item.id); }}
          onClick={e => { e.stopPropagation(); if (!("ontouchstart" in window)) onToggle(item.id); }}
          style={{ width: 34, height: 34, margin: "-6px -6px -6px -2px", flexShrink: 0, background: "transparent", border: "none", padding: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".62rem", fontWeight: 900,
            background: item.pointed ? "var(--success)" : "transparent", border: `1.8px solid ${item.pointed ? "var(--success)" : "var(--text3)"}`, color: "#04140c", transition: "all .15s" }}>{item.pointed ? "✓" : ""}</span>
        </button>
      </div>

      {/* Formulaire édition inline — ce mois uniquement */}
      {editing && (
        <div onClick={e => e.stopPropagation()} style={{ padding: "10px 12px 12px", background: "rgba(112,184,224,.06)", borderBottom: "1px solid rgba(255,255,255,.06)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)" }}>
          <div style={{ fontSize: ".6rem", color: "var(--accent)", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
            ✏️ Modifier pour ce mois uniquement
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8, marginBottom: 8 }}>
            <input type="text" value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="Nom"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 10px", color: "var(--text)", fontSize: ".75rem", fontFamily: "inherit" }}/>
            <input type="number" value={draftAmount} min="0" step="0.01" onChange={e => setDraftAmount(e.target.value)} placeholder="Montant"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 7, padding: "7px 8px", color: "var(--text)", fontSize: ".75rem", fontFamily: "var(--mono)" }}/>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={() => setEditing(false)} style={{ flex:1, background:"transparent", border:"1px solid var(--border)", borderRadius:8, padding:"7px", color:"var(--text2)", fontSize:".7rem", fontWeight:700, cursor:"pointer" }}>
              Annuler
            </button>
            {item.isOverridden && (
              <button onClick={() => { onEditFixed?.(item.id, null); setEditing(false); }} style={{ flex:1, background:"transparent", border:"1px solid var(--warning)", borderRadius:8, padding:"7px", color:"var(--warning)", fontSize:".7rem", fontWeight:700, cursor:"pointer" }}>
                ↺ Réinitialiser
              </button>
            )}
            <button onClick={saveEdit} style={{ flex:1, background:"var(--accent)", border:"none", borderRadius:8, padding:"7px", color:"var(--bg)", fontSize:".7rem", fontWeight:800, cursor:"pointer" }}>
              Enregistrer
            </button>
          </div>
        </div>
      )}
      </div>{/* end swipe translateX */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  HISTORIQUE
// ── v1.49.0 : sous-ligne d'une opération sans doublon de catégorie ──
// Sans note, le titre EST déjà la catégorie : la sous-ligne ne montre que
// « jour date » (précédé de la catégorie parente pour une sous-catégorie).
// Avec une note : « Catégorie · jour date » (inchangé, + le jour).
const WEEKDAYS_SHORT = ["dim.","lun.","mar.","mer.","jeu.","ven.","sam."];
export function dayLabel(iso) {
  const [y, m, d] = (iso || "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${WEEKDAYS_SHORT[new Date(y, m - 1, d).getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}
export function txSubLabel(note, cat, categories, iso) {
  const day = iso ? dayLabel(iso) : "";
  if (note) return [cat?.name ?? "—", day].filter(Boolean).join(" · ");
  const parent = cat?.parentId ? (categories || []).find(c => c.id === cat.parentId) : null;
  return `${parent ? `${parent.name} › ` : ""}${day}`;
}

// ─────────────────────────────────────────────────────────────────
export function HistoriqueView({ data, onOpenReleve, onEditOffAccount, onEditTrans, onDeleteTrans, onDuplicateTrans, onTogglePointTx, onTogglePointFix, onTogglePointIncome, onOverrideFixMonth, onOverrideIncomeMonth, onConfirmRecurring, onDeleteRecurring, onApplyAutoSaving, onSkipAutoSaving, onConfirmScheduled, onDeleteScheduled, initPointFilter = "all", onClearPointFilter, onMonthChange, initYM = null }) {
  const now = new Date();
  // v1.80.1 : peut s'ouvrir sur un mois donné (fenêtre « En attente » de l'Accueil)
  const [year,     setYear]     = useState(initYM ? parseInt(initYM.slice(0, 4), 10) : now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(initYM ? parseInt(initYM.slice(5, 7), 10) - 1 : now.getMonth());
  // v1.49.0 : remonte le mois affiché à App.jsx (sous-titre de l'en-tête)
  useEffect(() => { onMonthChange?.(year, monthIdx); }, [year, monthIdx]); // eslint-disable-line react-hooks/exhaustive-deps
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [sort,     setSort]     = useState("date");
  const [catId,    setCatId]    = useState("");
  const [viewMode, setViewMode] = useState("frise");  // v1.71.0 : « Frise » par jour par défaut
  const [txSheet,  setTxSheet]  = useState(null);     // v1.71.0 : feuille d'actions d'une opération
  const [openTypes, setOpenTypes] = useState({ expense: true });
  const [closedWeeks, setClosedWeeks] = useState({});
  const [calSelectedDay, setCalSelectedDay] = useState(null);
  const [minAmt,   setMinAmt]   = useState("");
  const [maxAmt,   setMaxAmt]   = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [hideOff,   setHideOff]   = useState(false);   // v1.42.0 : masquer les dépenses hors compte
  const [showAmtFilter, setShowAmtFilter] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Filtre pointage — initialisé depuis la hero card
  const [pointFilter, setPointFilter] = useState(initPointFilter);
  // Sync si la prop change (navigation depuis hero card)
  useEffect(() => { setPointFilter(initPointFilter); }, [initPointFilter]);

  const month = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;

  function prevMonth() {
    if (monthIdx === 0) { setYear(y => y - 1); setMonthIdx(11); }
    else setMonthIdx(m => m - 1);
    setCatId("");
  }
  function nextMonth() {
    const nextYM = monthIdx === 11 ? `${year + 1}-01` : `${year}-${String(monthIdx + 2).padStart(2, "0")}`;
    if (nextYM > currentYM()) return;
    if (monthIdx === 11) { setYear(y => y + 1); setMonthIdx(0); }
    else setMonthIdx(m => m + 1);
    setCatId("");
  }
  const isCurrentMonth = month === currentYM();

  const [globalSearch, setGlobalSearch] = useState(false);

  const { transactions, categories, cagnottes, fixedExpenses } = data;
  const allTags = data.tags || [];
  const recurringTemplates = data.recurringTemplates || [];

  // Versements auto à confirmer ce mois
  const autoSavingsPending = useMemo(() => {
    const plans = data.autoSavings || [];
    const today = new Date();
    return plans.filter(plan => {
      if (!plan.enabled) return false;
      const alreadyDone = transactions.some(t =>
        t.autoSavingId === plan.id && t.date.startsWith(month)
      );
      return !alreadyDone && plan.dayOfMonth <= today.getDate();
    });
  }, [data.autoSavings, transactions, month]);

  const scheduledPending = useMemo(() => {
    const today = todayISO();
    return (data.scheduledTransactions || []).filter(s =>
      !s.confirmed && s.date.startsWith(month) && s.date > today
    );
  }, [data.scheduledTransactions, month]);
  const recurringPending = useMemo(() => {
    if (!recurringTemplates.length) return [];
    return recurringTemplates.filter(tpl => {
      // Compter les confirmations existantes
      const confirmed = transactions.filter(t => t.templateId === tpl.id);

      // Si limite d'occurrences atteinte → ne plus afficher
      if (tpl.occurrences != null && confirmed.length >= tpl.occurrences) return false;

      if (tpl.frequency === "yearly") {
        const year = month.slice(0, 4);
        return !transactions.some(t => t.templateId === tpl.id && recurringRefDate(t).startsWith(year));
      }
      // monthly
      return !transactions.some(t => t.templateId === tpl.id && recurringRefDate(t).startsWith(month));
    });
  }, [recurringTemplates, transactions, month]);
  const mStats = useMonthStats(transactions, fixedExpenses, month, data.fixedIncomes || []);

  // Premier mois d'utilisation = mois de la première transaction
  const startYM = useMemo(() => {
    if (!transactions.length) return currentYM();
    return transactions.reduce((min, t) => t.date < min ? t.date : min, transactions[0].date).slice(0, 7);
  }, [transactions]);

  // Frais fixes — visibles uniquement depuis le mois de démarrage DE CHAQUE frais fixe
  // (avant : ne vérifiait que le tout premier mois d'utilisation de l'app, pas le
  // `startYM` propre à chaque frais fixe → un frais configuré pour démarrer plus tard
  // apparaissait quand même dans les mois précédents)
  const monthFixes = useMemo(() =>
    month >= startYM ? fixedExpenses.filter(f => isActiveForMonth(f, month)) : [],
    [fixedExpenses, month, startYM]
  );

  // Revenus fixes — même logique que les frais fixes (respecte le startYM
  // propre à chaque revenu). Pas de pointage pour eux (aucun mécanisme
  // dédié, comme pour les frais fixes) : affichage informatif uniquement.
  const monthIncomes = useMemo(() => {
    const fixedIncomes = data.fixedIncomes || [];
    return month >= startYM ? fixedIncomes.filter(f => isActiveForMonth(f, month)) : [];
  }, [data.fixedIncomes, month, startYM]);

  // Handler local : passe le mois courant pour le pointage par mois
  const handleTogglePointFix = useCallback(id => {
    onTogglePointFix?.(id, month);
  }, [onTogglePointFix, month]);

  const handleTogglePointIncome = useCallback(id => {
    onTogglePointIncome?.(id, month);
  }, [onTogglePointIncome, month]);

  // Handler édition frais fixe — override pour ce mois uniquement
  const handleOverrideFix = useCallback((id, override) => {
    onOverrideFixMonth?.(id, month, override);
  }, [onOverrideFixMonth, month]);
  const handleOverrideIncome = useCallback((id, override) => {
    onOverrideIncomeMonth?.(id, month, override);
  }, [onOverrideIncomeMonth, month]);

  // Rapprochement du mois affiché
  const { soldePointe, soldeAttente, nbPointed, totalPointable } = useMemo(() => {
    const txMonth = transactions.filter(t => t.date.startsWith(month) && isPointable(t.type));
    let pt = 0, noPt = 0;
    txMonth.forEach(t => {
      const a = parseFloat(t.amount) || 0;
      const val = isIncomeDirection(t) ? a : -a;
      if (t.pointed) pt   += val;
      else           noPt += val;
    });
    monthFixes.forEach(f => {
      const a  = fixedAmountFor(f, month);
      const isPointed = !!f.pointedMonths?.[month];
      if (isPointed) pt   -= a;
      else           noPt -= a;
    });
    return {
      soldePointe:    pt,
      soldeAttente:   noPt,
      nbPointed:      txMonth.filter(t => t.pointed).length + monthFixes.filter(f => f.pointedMonths?.[month]).length,
      totalPointable: txMonth.length + monthFixes.length,
    };
  }, [transactions, fixedExpenses, month, monthFixes]);

  const filtered = useMemo(() => {
    // Recherche globale : ignore le mois, cherche sur toutes les transactions
    let list = (globalSearch && search.trim())
      ? [...transactions]
      : transactions.filter(t => t.date.startsWith(month));

    if (filter !== "all") list = list.filter(t => {
      if (filter === "income")  return isIncome(t.type);
      if (filter === "expense") return t.type === "expense";
      if (filter === "savings") return ["epargne","decagnottage","transfer"].includes(t.type);
      return true;
    });
    if (catId) list = list.filter(t => t.categoryId === catId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        // v1.51.0 : aussi par montant (« 67,48 », « 67.48 » ou « 67 »)
        const qa = q.replace(/\s/g, "").replace(".", ",");
        const amtStr = (parseFloat(t.amount) || 0).toFixed(2).replace(".", ",");
        const amtHit = /^\d+(,\d{0,2})?$/.test(qa) && (qa.includes(",") ? amtStr.startsWith(qa) : amtStr.split(",")[0] === qa);
        return (t.note||"").toLowerCase().includes(q) || (cat?.name||"").toLowerCase().includes(q) || amtHit;
      });
    }
    if (minAmt) list = list.filter(t => parseFloat(t.amount) >= parseFloat(minAmt));
    if (maxAmt) list = list.filter(t => parseFloat(t.amount) <= parseFloat(maxAmt));
    if (tagFilter) list = list.filter(t => (t.tagIds || []).includes(tagFilter));
    if (pointFilter === "pointed")   list = list.filter(t => isPointable(t.type) &&  t.pointed);
    if (pointFilter === "unpointed") list = list.filter(t => isPointable(t.type) && !t.pointed);
    // v1.50.1 : plus récentes d'abord ; à date égale, la dernière saisie en premier
    // (les opérations sont ajoutées à la fin du tableau → index plus grand = plus récente)
    if (sort === "date") {
      const order = new Map(transactions.map((t, i) => [t.id, i]));
      list.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0));
    }
    if (sort === "amt_d") list.sort((a,b) => parseFloat(b.amount) - parseFloat(a.amount));
    if (sort === "amt_a") list.sort((a,b) => parseFloat(a.amount) - parseFloat(b.amount));
    return list;
  }, [transactions, categories, month, filter, catId, search, sort, minAmt, maxAmt, pointFilter, tagFilter, globalSearch]);

  // Dépenses 100 % hors compte (v1.42.0) — liste séparée, affichée entre
  // les opérations du même jour mais JAMAIS comptée dans les totaux,
  // le pointage ou le rapprochement. Masquées dès qu'un filtre bancaire
  // (revenus, cagnottes, pointage, tag) est actif.
  const filteredOff = useMemo(() => {
    if (hideOff || tagFilter || pointFilter !== "all" || (filter !== "all" && filter !== "expense")) return [];
    let list = (data.offAccountEntries || []).filter(e => e.kind === "expense");
    list = (globalSearch && search.trim()) ? list : list.filter(e => (e.date || "").startsWith(month));
    if (catId) list = list.filter(e => e.categoryId === catId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => (e.note || "").toLowerCase().includes(q) || (categories.find(c => c.id === e.categoryId)?.name || "").toLowerCase().includes(q));
    }
    if (minAmt) list = list.filter(e => parseFloat(e.amount) >= parseFloat(minAmt));
    if (maxAmt) list = list.filter(e => parseFloat(e.amount) <= parseFloat(maxAmt));
    // v1.50.1 : plus récentes d'abord (même règle que les opérations bancaires)
    const order = new Map((data.offAccountEntries || []).map((e, i) => [e.id, i]));
    return [...list].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0));
  }, [data.offAccountEntries, hideOff, tagFilter, pointFilter, filter, globalSearch, search, month, catId, categories, minAmt, maxAmt]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  // v1.71.0 : remboursements encore attendus, par opération (badge « ↩️ X € attendus »)
  const reimbPending = useMemo(() => {
    const m = {};
    (data.reimbursements || []).forEach(r => { if (r.txId && r.status !== "received") m[r.txId] = (m[r.txId] || 0) + (parseFloat(r.amount) || 0); });
    return m;
  }, [data.reimbursements]);

  // Cartes frais fixes / revenus fixes du mois — partagées par Frise, Liste et Par type
  // v1.73.0 : lignes au style de la frise, rangées par jour ; `inSec` = dans une section
  // repliable (le titre est alors dans l'en-tête de section, pas dans la carte).
  const fixedCard = (kind, inSec) => {
    const isInc = kind === "income";
    const all = isInc ? monthIncomes : monthFixes;
    const list = (pointFilter === "unpointed" ? all.filter(f => !f.pointedMonths?.[month]) : all)
      .map(f => ({ f, dayNum: resolveFixedDay(f.day, month, !!f.satWorkday) || null }))
      .sort((a, b) => (a.dayNum || 99) - (b.dayNum || 99));
    const nPt = all.filter(f => f.pointedMonths?.[month]).length;
    const total = all.reduce((s, f) => s + fixedAmountFor(f, month), 0);
    const col = isInc ? "var(--success)" : "var(--danger)";
    return (
      <div className="card" data-testid={isInc ? "hist-incomes-card" : "hist-fixes-card"} style={{ padding: 0, overflow: "hidden", margin: 0 }}>
        {!inSec ? (
          <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: ".6rem", fontWeight: 800, color: isInc ? "var(--success)" : "#e8944a", textTransform: "uppercase", letterSpacing: ".08em" }}>{isInc ? "💰 Revenus fixes du mois" : "📌 Frais fixes du mois"}</div>
              <div style={{ fontSize: ".55rem", color: "var(--text3)", marginTop: 2 }}>{isInc ? "Pointe-les quand ils créditent sur ton compte" : "Pointe-les quand ils débitent sur ton compte"} · touche une ligne pour la corriger ce mois-ci</div>
            </div>
            <span style={{ fontSize: ".62rem", color: nPt === all.length ? "var(--success)" : "var(--warning)", fontWeight: 800 }}>{nPt}/{all.length}</span>
          </div>
        ) : (
          <div style={{ padding: "7px 12px", fontSize: ".56rem", color: "var(--text3)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            {isInc ? "Pointe-les quand ils créditent sur ton compte" : "Pointe-les quand ils débitent sur ton compte"} · touche une ligne pour la corriger ce mois-ci
          </div>
        )}
        {list.length === 0 && pointFilter === "unpointed"
          ? <div style={{ padding: "12px 14px", fontSize: ".7rem", color: "var(--success)", textAlign: "center" }}>✅ Tous les {isInc ? "revenus" : "frais"} fixes sont pointés</div>
          : list.map(({ f, dayNum }) => {
              const cat = (data.categories || []).find(c => c.id === f.categoryId);
              const ov  = f.monthlyOverrides?.[month];  // correction du mois si elle existe
              return (
                <PointRow key={f.id}
                  item={{ ...f, ...(isInc ? { type: "income" } : {}), name: ov?.name ?? f.name, amount: fixedAmountFor(f, month), cat, date: null, dayNum,
                    pointed: !!f.pointedMonths?.[month], isOverridden: !!ov }}
                  onToggle={isInc ? handleTogglePointIncome : handleTogglePointFix}
                  onEditFixed={isInc ? handleOverrideIncome : handleOverrideFix}
                  isFixed={true} />
              );
            })}
        <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", fontSize: ".65rem" }}>
          <span style={{ color: "var(--text3)" }}>Total {isInc ? "revenus fixes" : "fixes"}</span>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: col }}>{isInc ? "+" : "−"}{fmt(total)}</span>
        </div>
      </div>
    );
  };
  const renderFixesCard   = () => fixedCard("expense", false);
  const renderIncomesCard = () => fixedCard("income", false);

  // ── v1.73.0 : sections repliables (Frise et Liste) — pliage mémorisé sur le téléphone ──
  const HFOLD_KEY = "hist_fold_v1";
  const [hFold, setHFold] = useState(() => { try { return JSON.parse(localStorage.getItem(HFOLD_KEY)) || {}; } catch { return {}; } });
  const toggleHFold = k => setHFold(o => {
    const n = { ...o, [k]: !o[k] };
    try { localStorage.setItem(HFOLD_KEY, JSON.stringify(n)); } catch { /* stockage indisponible : gardé en mémoire */ }
    return n;
  });
  const foldSec = (k, title, count, right, body, opts = {}) => {
    const folded = !!hFold[k];
    const dim = !!opts.dim;   // partie vide (ex. « rien à confirmer ») : visible mais grisée, rien à déplier
    return (
      <div key={k} data-hsec={k} style={{ marginBottom: dim ? 0 : 8 }}>
        <div role="button" data-hsec-head={k} onClick={() => { if (!dim) toggleHFold(k); }}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".6rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: opts.color || "var(--text3)", margin: "12px 2px 6px", cursor: dim ? "default" : "pointer", userSelect: "none", opacity: dim ? .5 : 1 }}>
          <span style={{ width: 12, color: "var(--text2)", fontSize: ".62rem" }}>{dim ? "·" : folded ? "▸" : "▾"}</span>
          <span>{title}</span>
          {count != null && <span style={{ fontSize: ".56rem", letterSpacing: 0, textTransform: "none", fontWeight: 700 }}>({count})</span>}
          {right && <span style={{ marginLeft: "auto", letterSpacing: 0, textTransform: "none", fontSize: ".66rem", fontWeight: 800, fontFamily: "var(--mono)" }}>{right}</span>}
        </div>
        {!folded && !dim && body}
      </div>
    );
  };
  const groupTitle = t => <div style={{ fontSize: ".6rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text2)", margin: "18px 2px 0" }}>{t}</div>;
  const FRISE_KEYS = ["exp", "inc", "cag", "adj", "off", "recur", "sched", "auto", "fixes", "incomes"];
  const setAllFold = v => setHFold(() => { const n = Object.fromEntries(FRISE_KEYS.map(k => [k, v])); try { localStorage.setItem(HFOLD_KEY, JSON.stringify(n)); } catch { /* mémoire seulement */ } return n; });
  // Petite ligne « à confirmer » (épargnes auto, programmées, récurrentes) au style de la frise
  const pendRow = ({ key, icon, tint, name, sub, amount, amtCol, okLabel, okCol, onOk, onNo }) => (
    <div key={key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".95rem", background: `color-mix(in srgb, ${tint} 18%, transparent)` }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: ".74rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: ".58rem", color: "var(--text2)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
      </div>
      {amount && <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".78rem", color: amtCol, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{amount}</span>}
      <button onTouchStart={e => e.stopPropagation()} onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); onOk(); }} onClick={() => { if (!("ontouchstart" in window)) onOk(); }}
        style={{ minWidth: 32, height: 28, padding: "0 8px", borderRadius: 14, border: "none", background: okCol, color: "var(--bg)", fontWeight: 800, fontSize: ".7rem", cursor: "pointer", touchAction: "manipulation", flexShrink: 0 }}>{okLabel}</button>
      <button onTouchStart={e => e.stopPropagation()} onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); onNo(); }} onClick={() => { if (!("ontouchstart" in window)) onNo(); }}
        style={{ width: 28, height: 28, borderRadius: 14, border: "1px solid var(--border)", background: "transparent", color: "var(--text3)", fontSize: ".7rem", cursor: "pointer", touchAction: "manipulation", flexShrink: 0 }}>✕</button>
    </div>
  );  const autoRow = plan => {
    const cag = cagnottes.find(c => c.id === plan.cagnotteId);
    return pendRow({ key: plan.id, icon: cag?.icon || "🐷", tint: "var(--purple)", name: cag?.name || "—", sub: "versement mensuel",
      amount: fmt(plan.amount), amtCol: "var(--purple)", okLabel: "＋", okCol: "var(--purple)",
      onOk: () => onApplyAutoSaving?.(plan.id), onNo: () => onSkipAutoSaving?.(plan.id) });
  };
  const schedRow = sc => {
    const cat = categories.find(c => c.id === sc.categoryId);
    return pendRow({ key: sc.id, icon: cat?.icon ?? "📅", tint: cat?.color || "var(--warning)", name: sc.note || cat?.name || "Dépense programmée", sub: `prévu le ${dayLabel(sc.date)}`,
      amount: `−${fmt(sc.amount)}`, amtCol: "var(--danger)", okLabel: "✓", okCol: "var(--warning)",
      onOk: () => onConfirmScheduled?.(sc.id), onNo: () => onDeleteScheduled?.(sc.id) });
  };
  const recurRow = tpl => {
    const cat = categories.find(c => c.id === tpl.categoryId);
    const isInc = isIncome(tpl.type);
    const done = transactions.filter(t => t.templateId === tpl.id).length;
    const left = tpl.occurrences != null ? tpl.occurrences - done : null;
    return pendRow({ key: tpl.id, icon: cat?.icon ?? (isInc ? "💰" : "💸"), tint: cat?.color || (isInc ? "var(--success)" : "var(--accent)"), name: tpl.label,
      sub: `${cat?.name ?? "—"} · ${tpl.frequency === "yearly" ? "Annuelle" : "Mensuelle"}${left != null ? ` · ${done}/${tpl.occurrences} (${left} restant${left > 1 ? "s" : ""})` : ""}`,
      amount: `${isInc ? "+" : "−"}${fmt(tpl.amount)}`, amtCol: isInc ? "var(--success)" : "var(--danger)", okLabel: "＋", okCol: "var(--success)",
      onOk: () => onConfirmRecurring?.(tpl, month), onNo: () => onDeleteRecurring?.(tpl.id) });
  };


  // Ligne « hors compte » (v1.42.0) — partagée par les vues Liste et Par type
  const renderOffRow = e => {
                      const cat = categories.find(c => c.id === e.categoryId);
                      const st  = (data.sideAmountTypes || []).find(x => x.id === e.satId);
                      return (
                        <div key={e.id} onClick={() => onEditOffAccount?.(e)} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer",
                          borderBottom: "1px solid var(--border-soft)", background: "var(--tr-glow)",
                          borderLeft: "2px dashed var(--tr-border)",
                        }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{cat?.icon || st?.icon || "🎫"}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: ".76rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note || cat?.name || "Dépense hors compte"}</div>
                            <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 2 }}>
                              <span style={{ fontSize: ".6rem", color: "var(--text3)" }}>{e.note || cat ? txSubLabel(e.note, cat, categories, e.date) : dayLabel(e.date)}</span>
                              <span style={{ fontSize: ".5rem", padding: "1px 6px", borderRadius: 8, fontWeight: 800, color: "var(--tr)", background: "var(--tr-glow)", border: "1px solid var(--tr-border)" }}>{st?.icon || "🎫"} Hors compte</span>
                            </div>
                          </div>
                          <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".85rem", color: "var(--tr)", flexShrink: 0 }}>{fmt(e.amount)}</div>
                        </div>
                      );
  };


  // ── v1.51.0 : barre du haut ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    const h = document.querySelector(".bp-header");
    const upd = () => setStickyTop(h ? Math.round(h.getBoundingClientRect().height) : 0);
    upd(); window.addEventListener("resize", upd);
    const ro = typeof ResizeObserver !== "undefined" && h ? new ResizeObserver(upd) : null;
    ro?.observe(h);
    return () => { window.removeEventListener("resize", upd); ro?.disconnect(); };
  }, []);
  const barBtn = on => ({
    width: 34, height: 34, flexShrink: 0, borderRadius: 9, cursor: "pointer", touchAction: "manipulation",
    background: on ? "var(--accent-glow)" : "var(--surface2)", border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
    color: "var(--accent)", fontSize: ".85rem", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
  });
  const chipSt = (col, bg, clickable, on = false) => ({
    display: "inline-flex", alignItems: "center", gap: 4, fontSize: ".64rem", fontWeight: 800, padding: "5px 9px", borderRadius: 10,
    whiteSpace: "nowrap", flexShrink: 0, color: col, background: bg, fontVariantNumeric: "tabular-nums",
    border: `1px solid ${clickable ? (on ? col : "rgba(255,255,255,.1)") : "transparent"}`,
    cursor: clickable ? "pointer" : "default",
  });
  const activeCount = [
    filter !== "all", pointFilter !== "all", tagFilter !== "", hideOff,
    sort !== "date", minAmt !== "", maxAmt !== "", viewMode !== "frise",
  ].filter(Boolean).length;
  const activePills = [
    filter !== "all"       && { label: filter === "expense" ? "Dépenses" : filter === "income" ? "Revenus" : "Cagnottes", clear: () => setFilter("all") },
    pointFilter !== "all"  && { label: pointFilter === "pointed" ? "✓ Pointées" : "⏳ Attente", clear: () => { setPointFilter("all"); onClearPointFilter?.(); } },
    hideOff                && { label: "🎫 Hors compte masqué", clear: () => setHideOff(false) },
    tagFilter              && (() => { const tg = (data.tags||[]).find(t=>t.id===tagFilter); return tg && { label: `${tg.icon} ${tg.name}`, clear: () => setTagFilter("") }; })(),
    sort !== "date"        && { label: sort === "amt_d" ? "Montant ↓" : "Montant ↑", clear: () => setSort("date") },
    (minAmt || maxAmt)     && { label: `${minAmt||"0"}–${maxAmt||"∞"} €`, clear: () => { setMinAmt(""); setMaxAmt(""); } },
    viewMode === "type"     && { label: "🗂️ Par type", clear: () => setViewMode("frise") },
    viewMode === "list"     && { label: "📋 Liste", clear: () => setViewMode("frise") },
    viewMode === "cats"     && { label: "📊 Catégories", clear: () => setViewMode("frise") },
    viewMode === "calendar" && { label: "📅 Calendrier", clear: () => setViewMode("frise") },
  ].filter(Boolean);




  return (
    <div>
      {/* ── v1.51.0 : barre unique collée en haut (mois, recherche, filtres) + pastilles du mois ──
           (remplace navigation mois, donut/budget, rapprochement et zone de recherche) */}
      <div style={{ position: "sticky", top: stickyTop, zIndex: 50, background: "var(--bg)", margin: "-16px -16px 10px", padding: "8px 16px 8px", borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={prevMonth} style={barBtn(false)}>◀</button>
          <div style={{ flex: 1, minWidth: 0, paddingLeft: 4, fontFamily: "var(--display)", fontSize: "1rem", fontWeight: 800, whiteSpace: "nowrap" }}>
            {MONTHS_FR[monthIdx]} <span style={{ fontFamily: "var(--ui)", fontSize: ".62rem", color: "var(--text3)", fontWeight: 700 }}>{year}</span>
          </div>
          <button onClick={nextMonth} style={{ ...barBtn(false), opacity: isCurrentMonth ? .35 : 1, cursor: isCurrentMonth ? "default" : "pointer" }}>▶</button>
          {onOpenReleve && <button onClick={onOpenReleve} title="Comparer avec un relevé" data-testid="open-releve" style={barBtn(false)}>🏦</button>}
          <button onClick={() => setSearchOpen(o => !o)} style={barBtn(searchOpen || !!search.trim())}>🔍</button>
          <button onClick={() => setShowFilterPanel(p => !p)} style={{ ...barBtn(activeCount > 0 || showFilterPanel), position: "relative" }}>⚙️
            {activeCount > 0 && <span style={{ position: "absolute", top: -5, right: -5, background: "var(--accent)", color: "var(--bg)", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".52rem", fontWeight: 800 }}>{activeCount}</span>}
          </button>
          {viewMode === "type" && (
            <button onClick={() => setOpenTypes(o => Object.values(o).some(Boolean) ? {} : { expense: true, income: true, fixed: true, savings: true, adjust: true, off: true })}
              style={{ ...barBtn(false), fontSize: ".8rem", color: "var(--text2)" }}>{Object.values(openTypes).some(Boolean) ? "⊟" : "⊞"}</button>
          )}
        </div>
        {(searchOpen || search.trim()) && (
          <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
            <div className="hist-search-wrap" style={{ flex: 1, marginBottom: 0 }}>
              <span className="hist-search-icon">🔍</span>
              <input className="hist-search" type="text" placeholder="Nom, catégorie ou montant…" autoFocus
                value={search} onChange={e => setSearch(e.target.value)} style={{ padding: "7px 30px 7px 32px", fontSize: ".8rem" }} />
              {search && <span onClick={() => setSearch("")} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", cursor: "pointer", fontSize: ".8rem" }}>✕</span>}
            </div>
            <button onClick={() => setGlobalSearch(g => !g)} title="Rechercher sur tous les mois"
              style={{ ...barBtn(globalSearch), width: "auto", padding: "0 9px", fontSize: ".62rem", fontWeight: 700, whiteSpace: "nowrap" }}>{globalSearch ? "🌐 Tous les mois" : "🌐"}</button>
          </div>
        )}
        {globalSearch && search.trim() && (
          <div style={{ fontSize: ".58rem", color: "var(--accent)", fontWeight: 700, marginTop: 5 }}>
            🌐 Recherche sur toutes les périodes — {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
          </div>
        )}
        {/* Pastilles du mois : revenus / dépenses (mêmes chiffres que le Bilan) + rapprochement (tap = filtre) */}
        <div style={{ display: "flex", gap: 5, marginTop: 7, overflowX: "auto", scrollbarWidth: "none" }}>
          <span style={chipSt("var(--success)", "rgba(104,212,152,.1)", false)}>+{fmt(mStats.inc)}</span>
          <span style={chipSt("var(--danger)", "rgba(200,112,112,.1)", false)}>−{fmt(mStats.exp)}</span>
          {totalPointable > 0 && <>
            <span onClick={() => setPointFilter(f => f === "pointed" ? "all" : "pointed")} style={chipSt("var(--success)", "rgba(104,212,152,.1)", true, pointFilter === "pointed")}>✓ {nbPointed}/{totalPointable}</span>
            {nbPointed < totalPointable && (
              <span onClick={() => setPointFilter(f => f === "unpointed" ? "all" : "unpointed")} style={chipSt("var(--warning)", "rgba(200,184,96,.1)", true, pointFilter === "unpointed")}>⏳ {soldeAttente >= 0 ? "+" : "−"}{fmt(Math.abs(soldeAttente))}</span>
            )}
          </>}
        </div>
      </div>

      <div>
        {/* ── Filtres compacts ── */}
        {(() => {
          return (
            <div>
              {/* Chips filtres actifs */}
              {!showFilterPanel && activePills.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                  {activePills.map((p, i) => (
                    <span key={i} onClick={p.clear} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: ".58rem", padding: "2px 8px", background: "var(--accent-glow)", border: "1px solid var(--accent)", borderRadius: 10, color: "var(--accent)", cursor: "pointer" }}>
                      {p.label} <span style={{ opacity: .7 }}>✕</span>
                    </span>
                  ))}
                  <span onClick={() => { setFilter("all"); setPointFilter("all"); setSort("date"); setMinAmt(""); setMaxAmt(""); setViewMode("frise"); setTagFilter(""); setHideOff(false); onClearPointFilter?.(); }} style={{ fontSize: ".58rem", padding: "2px 8px", background: "transparent", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text3)", cursor: "pointer" }}>
                    ✕ Tout reset
                  </span>
                </div>
              )}

              {/* Panneau expansible */}
              {showFilterPanel && (
                <div style={{ background: "var(--surface2)", borderRadius: 10, padding: 10, marginBottom: 8, display: "flex", flexDirection: "column", gap: 9 }}>
                  {/* Type */}
                  <div>
                    <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Type</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                      {[["all","Tout"],["income","Revenus"],["expense","Dépenses"],["savings","Cagnottes"]].map(([k,l]) => (
                        <button key={k} onClick={() => { setFilter(k); setCatId(""); }} style={{
                          background: filter===k ? "var(--accent-glow)" : "transparent",
                          border: `1px solid ${filter===k ? "var(--accent)" : "var(--border)"}`,
                          borderRadius: 6, padding: "6px 0",
                          color: filter===k ? "var(--accent)" : "var(--text2)",
                          fontSize: ".58rem", fontWeight: 700, cursor: "pointer",
                        }}>{l}</button>
                      ))}
                    </div>
                  </div>
                  {/* Pointage */}
                  <div>
                    <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Pointage</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                      {[["all","Toutes",""],["pointed","✓ Pointées","var(--success)"],["unpointed","⏳ Attente","var(--warning)"]].map(([k,l,col]) => (
                        <button key={k} onClick={() => { setPointFilter(k); onClearPointFilter?.(); }} style={{
                          background: pointFilter===k ? "var(--accent-glow)" : "transparent",
                          border: `1px solid ${pointFilter===k ? (col||"var(--accent)") : "var(--border)"}`,
                          borderRadius: 6, padding: "6px 0",
                          color: pointFilter===k ? (col||"var(--accent)") : "var(--text2)",
                          fontSize: ".58rem", fontWeight: 700, cursor: "pointer",
                        }}>{l}</button>
                      ))}
                    </div>
                  </div>
                  {/* Hors compte (v1.42.0) */}
                  {(data.offAccountEntries || []).some(e => e.kind === "expense") && (
                    <div>
                      <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Hors compte</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[[false, "🎫 Afficher"], [true, "Masquer"]].map(([v, l]) => (
                          <button key={l} onClick={() => setHideOff(v)} style={{
                            background: hideOff === v ? "var(--tr-glow)" : "transparent",
                            border: `1px solid ${hideOff === v ? "var(--tr)" : "var(--border)"}`,
                            borderRadius: 6, padding: "5px 10px", color: hideOff === v ? "var(--tr)" : "var(--text2)",
                            fontSize: ".58rem", fontWeight: 700, cursor: "pointer",
                          }}>{l}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Tags */}
                  {(data.tags || []).length > 0 && (
                    <div>
                      <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Tags</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button onClick={() => setTagFilter("")} style={{
                          background: !tagFilter ? "var(--accent-glow)" : "transparent",
                          border: `1px solid ${!tagFilter ? "var(--accent)" : "var(--border)"}`,
                          borderRadius: 6, padding: "5px 10px",
                          color: !tagFilter ? "var(--accent)" : "var(--text2)",
                          fontSize: ".58rem", fontWeight: 700, cursor: "pointer",
                        }}>Tous</button>
                        {(data.tags || []).map(tag => (
                          <button key={tag.id} onClick={() => setTagFilter(v => v === tag.id ? "" : tag.id)} style={{
                            background: tagFilter===tag.id ? `${tag.color}22` : "transparent",
                            border: `1px solid ${tagFilter===tag.id ? tag.color : "var(--border)"}`,
                            borderRadius: 6, padding: "5px 10px",
                            color: tagFilter===tag.id ? tag.color : "var(--text2)",
                            fontSize: ".58rem", fontWeight: 700, cursor: "pointer",
                          }}>{tag.icon} {tag.name}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Tri + Montant */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Tri</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {[["date","Date ↓"],["amt_d","Montant ↓"],["amt_a","Montant ↑"]].map(([k,l]) => (
                          <button key={k} onClick={() => setSort(k)} style={{
                            background: sort===k ? "var(--accent-glow)" : "transparent",
                            border: `1px solid ${sort===k ? "var(--accent)" : "var(--border)"}`,
                            borderRadius: 6, padding: "5px 0",
                            color: sort===k ? "var(--accent)" : "var(--text2)",
                            fontSize: ".62rem", fontWeight: 700, cursor: "pointer",
                          }}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Montant</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {[["min","Min €", minAmt, setMinAmt],["max","Max €", maxAmt, setMaxAmt]].map(([id,ph,val,setter]) => (
                          <input key={id} type="number" value={val} min="0" step="10" placeholder={ph}
                            onChange={e => setter(e.target.value)}
                            style={{ background: "var(--bg)", border: `1px solid ${val ? "var(--accent)" : "var(--border)"}`, borderRadius: 6, padding: "5px 8px", color: "var(--text)", fontSize: ".7rem", fontFamily: "var(--mono)" }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Vue */}
                  <div>
                    <div style={{ fontSize: ".55rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Vue</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                      {[["frise","🗓️ Frise"],["type","🗂️ Par type"],["list","📋 Liste"],["cats","📊 Catégories"],["calendar","📅 Calendrier"]].map(([k,l]) => (
                        <button key={k} data-view={k} onClick={() => setViewMode(k)} style={{
                          background: viewMode===k ? "var(--accent-glow)" : "transparent",
                          border: `1.5px solid ${viewMode===k ? "var(--accent)" : "var(--border)"}`,
                          borderRadius: 6, padding: "7px 0",
                          color: viewMode===k ? "var(--accent)" : "var(--text2)",
                          fontSize: ".65rem", fontWeight: 700, cursor: "pointer",
                        }}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── 6. Vue Catégories ── */}
      {viewMode === "cats" && (
        <CatBreakdown txs={filtered} allTxs={transactions.filter(t => t.date.startsWith(month))} categories={categories}
          onSelectCat={id => { setCatId(id); setFilter("expense"); setViewMode("type"); }} />
      )}

      {/* ── 6b. Vue Calendrier ── */}
      {viewMode === "calendar" && (() => {
        const [y, mo] = month.split("-").map(Number);
        const firstDow   = new Date(y, mo - 1, 1).getDay();
        const firstMon   = firstDow === 0 ? 6 : firstDow - 1; // lundi = 0
        const daysInMonth = new Date(y, mo, 0).getDate();
        const today      = new Date();
        const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === mo;
        const todayDay   = today.getDate();

        // Grouper les transactions par jour
        const byDay = {};
        transactions.filter(t => t.date.startsWith(month)).forEach(t => {
          const d = parseInt(t.date.slice(8), 10);
          if (!byDay[d]) byDay[d] = [];
          byDay[d].push(t);
        });

        const cells = [];
        for (let i = 0; i < firstMon; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        const selTxs = calSelectedDay ? (byDay[calSelectedDay] || []) : [];
        const selNet = selTxs.reduce((s, t) => s + (isIncomeDirection(t) ? 1 : -1) * (parseFloat(t.amount) || 0), 0);

        return (
          <div>
            <div className="card" style={{ padding: "12px 10px 8px" }}>
              {/* En-têtes jours */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
                {["L","M","M","J","V","S","D"].map((d, i) => (
                  <div key={i} style={{ textAlign: "center", fontSize: ".52rem", fontWeight: 700, color: i >= 5 ? "var(--accent)" : "var(--text3)", padding: "2px 0" }}>{d}</div>
                ))}
              </div>
              {/* Cases */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const txs  = byDay[day] || [];
                  const net  = txs.reduce((s, t) => s + (isIncomeDirection(t) ? 1 : -1) * (parseFloat(t.amount) || 0), 0);
                  const hasTx = txs.length > 0;
                  const isPos = net >= 0;
                  const isSel = calSelectedDay === day;
                  const isTod = isCurrentMonth && day === todayDay;

                  return (
                    <div key={day}
                      onClick={() => setCalSelectedDay(isSel ? null : day)}
                      style={{
                        borderRadius: 7, padding: "5px 2px 4px",
                        background: isSel ? "var(--accent-glow)" : isTod ? "rgba(200,184,96,.10)" : hasTx ? (isPos ? "rgba(104,200,122,.08)" : "rgba(224,104,112,.08)") : "transparent",
                        border: isTod ? "1.5px solid var(--warning)" : isSel ? "1px solid var(--accent)" : hasTx ? `1px solid ${isPos ? "rgba(104,200,122,.22)" : "rgba(224,104,112,.18)"}` : "1px solid transparent",
                        cursor: hasTx ? "pointer" : "default",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5,
                        transition: "background .12s",
                      }}>
                      <span style={{ fontSize: ".6rem", fontWeight: isTod ? 800 : 500, color: isSel ? "var(--accent)" : isTod ? "var(--warning)" : hasTx ? "var(--text)" : "var(--text3)" }}>
                        {day}
                      </span>
                      {hasTx && (
                        <div style={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
                          {txs.slice(0, 4).map((t, j) => (
                            <div key={j} style={{ width: 3, height: 3, borderRadius: "50%", background: isIncomeDirection(t) ? "var(--success)" : "var(--danger)", opacity: .85 }} />
                          ))}
                        </div>
                      )}
                      {hasTx && (
                        <span style={{ fontSize: ".38rem", fontWeight: 700, color: isPos ? "var(--success)" : "var(--danger)", fontFamily: "var(--mono)" }}>
                          {isPos ? "+" : ""}{pv(Math.round(net))}€
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Légende */}
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-soft)" }}>
                {[["var(--success)","Revenus"],["var(--danger)","Dépenses"],["var(--warning)","Aujourd'hui"]].map(([color, label]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
                    <span style={{ fontSize: ".48rem", color: "var(--text3)" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Détail du jour sélectionné */}
            {calSelectedDay && selTxs.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: 8 }}>
                <div style={{ padding: "8px 14px", background: "var(--surface2)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: ".62rem", fontWeight: 800, color: "var(--accent)" }}>
                    {calSelectedDay} {["Jan","Fév","Mar","Avr","Mai","Jui","Jul","Aoû","Sep","Oct","Nov","Déc"][mo - 1]} {y}
                  </span>
                  <span style={{ fontSize: ".62rem", fontWeight: 700, color: selNet >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--mono)" }}>
                    {selNet >= 0 ? "+" : ""}{pv(selNet.toFixed(2))} €
                  </span>
                </div>
                {selTxs.map((t, i) => {
                  const cat = categories.find(c => c.id === t.categoryId);
                  const inc = isIncomeDirection(t);
                  return (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < selTxs.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem", flexShrink: 0 }}>
                        {cat?.icon ?? (inc ? "💰" : "💸")}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: ".72rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.note || cat?.name || "—"}</div>
                        {(() => { const sub = txSubLabel(t.note, cat, categories, null).replace(/ › $/, ""); return sub ? <div style={{ fontSize: ".56rem", color: "var(--text3)", marginTop: 1 }}>{sub}</div> : null; })()}
                      </div>
                      <span style={{ fontSize: ".72rem", fontWeight: 800, color: inc ? "var(--success)" : "var(--danger)", fontFamily: "var(--mono)", flexShrink: 0 }}>
                        {inc ? "+" : "−"}{fmt(t.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Filtre catégorie actif ── */}
      {(viewMode === "list" || viewMode === "type" || viewMode === "frise") && catId && (() => {
        const activeCat = categories.find(c => c.id === catId);
        return activeCat ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "6px 12px", background: "var(--accent-glow)", border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)" }}>
            <span style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--accent)", flex: 1 }}>{activeCat.icon} {activeCat.name}</span>
            <button onClick={() => setCatId("")} style={{ background: "transparent", border: "none", color: "var(--accent)", fontSize: ".8rem", cursor: "pointer" }}>✕</button>
          </div>
        ) : null;
      })()}

      {/* ── Vue « Par type » (v1.47.0, variante B) : type → semaine ── */}
      {viewMode === "type" && (() => {
        const rowsOf = list => pointFilter === "all"
          ? list.map(t => (
              <SwipeRow key={t.id} t={t} categories={categories} cagnottes={cagnottes}
                onEdit={onEditTrans} onDelete={onDeleteTrans} onTogglePoint={onTogglePointTx} onDuplicate={onDuplicateTrans}
                allTags={allTags} allSideAmountTypes={data.sideAmountTypes || []} />
            ))
          : list.map(t => (
              <PointRow key={t.id}
                item={{ ...t, name: txLabel(t, categories, cagnottes), cat: categories.find(c => c.id === t.categoryId) }}
                onToggle={onTogglePointTx} onEdit={id => onEditTrans(id)} onDelete={id => onDeleteTrans(id)} />
            ));
        const signed = t => (isIncomeDirection(t) ? 1 : -1) * (parseFloat(t.amount) || 0);
        const mLbl = MONTHS_FR[monthIdx].slice(0, 3).toLowerCase() + (MONTHS_FR[monthIdx].length > 4 ? "." : "");
        const lastDay = new Date(year, monthIdx + 1, 0).getDate();
        const weekOf = d => { const n = parseInt((d || "").slice(8, 10), 10) || 1; return n <= 7 ? 0 : n <= 14 ? 1 : n <= 21 ? 2 : 3; };
        const weekLbl = w => [`1–7 ${mLbl}`, `8–14 ${mLbl}`, `15–21 ${mLbl}`, `22–${lastDay} ${mLbl}`][w];
        const fixesCount = (pointFilter !== "pointed" ? monthFixes.length + monthIncomes.length : 0);
        const fixesNet = monthIncomes.reduce((s, f) => s + ((f.monthlyOverrides?.[month]?.amount) ?? f.amount ?? 0), 0)
                       - monthFixes.reduce((s, f) => s + ((f.monthlyOverrides?.[month]?.amount) ?? f.amount ?? 0), 0);
        const fixesToPoint = monthFixes.filter(f => !f.pointedMonths?.[month]).length + monthIncomes.filter(f => !f.pointedMonths?.[month]).length;
        const SECTIONS = [
          { k: "expense", icon: "💸", label: "Dépenses",  color: "var(--danger)",  list: filtered.filter(t => t.type === "expense") },
          { k: "income",  icon: "💰", label: "Revenus",   color: "var(--success)", list: filtered.filter(t => t.type === "income" || t.type === "dissolution_cagnotte") },
          { k: "fixed",   icon: "📌", label: "Frais & revenus fixes", color: "#e8944a", fixed: true },
          { k: "savings", icon: "🐷", label: "Cagnottes", color: "var(--purple)",  list: filtered.filter(t => ["epargne", "decagnottage", "transfer"].includes(t.type)) },
          { k: "adjust",  icon: "⚖️", label: "Équilibres", color: "var(--sapin)",  list: filtered.filter(t => t.type === "balance_adjustment") },
          { k: "off",     icon: "🎫", label: "Hors compte", color: "var(--tr)",    off: filteredOff },
        ];
        const visible = SECTIONS.filter(sec => sec.fixed ? fixesCount > 0 : sec.off ? sec.off.length > 0 : sec.list.length > 0);
        if (visible.length === 0) return <EmptyIllustration type="historique" title="Aucun mouvement" sub="Aucune transaction ne correspond à ces filtres" />;
        return (
          <div style={{ marginBottom: 10 }}>
            {/* v1.51.0 : « Tout replier / déplier » déplacé dans la barre du haut (⊟ / ⊞) */}
            {visible.map(sec => {
              const open = !!openTypes[sec.k];
              const items = sec.fixed ? [] : sec.off ? sec.off : sec.list;
              const count = sec.fixed ? fixesCount : items.length;
              const total = sec.fixed ? fixesNet : sec.off ? -items.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) : items.reduce((s, t) => s + signed(t), 0);
              const toPoint = sec.fixed ? fixesToPoint : sec.off ? 0 : items.filter(t => isPointable(t.type) && !t.pointed).length;
              return (
                <div key={sec.k} style={{ borderRadius: "var(--radius)", border: `1px solid color-mix(in srgb, ${sec.color} 45%, transparent)`, background: "var(--surface)", marginBottom: 8, overflow: "hidden" }}>
                  <div role="button"
                    onTouchEnd={e => { if (touchMoved()) return; e.preventDefault(); setOpenTypes(o => ({ ...o, [sec.k]: !o[sec.k] })); }}
                    onClick={() => { if (!("ontouchstart" in window)) setOpenTypes(o => ({ ...o, [sec.k]: !o[sec.k] })); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: `color-mix(in srgb, ${sec.color} 8%, transparent)`, cursor: "pointer", touchAction: "manipulation" }}>
                    <span style={{ fontSize: "1rem" }}>{sec.icon}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: ".82rem", fontWeight: 700 }}>{sec.label}</span>
                      <span style={{ display: "block", fontSize: ".6rem", color: "var(--text3)" }}>
                        {count} opération{count > 1 ? "s" : ""}{toPoint > 0 ? ` · ${toPoint} à pointer` : ""}{sec.off ? " · hors solde" : ""}
                      </span>
                    </span>
                    <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".88rem", color: sec.color, fontVariantNumeric: "tabular-nums" }}>{total >= 0 ? "+" : "−"}{fmt(Math.abs(total))}</span>
                    <span style={{ fontSize: ".65rem", color: "var(--text3)", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
                  </div>
                  {open && sec.fixed && (
                    <div style={{ borderTop: "1px solid var(--border-soft)", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                      {monthFixes.length > 0 && renderFixesCard()}
                      {monthIncomes.length > 0 && renderIncomesCard()}
                    </div>
                  )}
                  {open && !sec.fixed && [3, 2, 1, 0].map(w => {   /* v1.50.1 : semaine la plus récente en haut */
                    const wItems = items.filter(x => weekOf(x.date) === w);
                    if (wItems.length === 0) return null;
                    const wk = `${sec.k}-${w}`;
                    const wOpen = !closedWeeks[wk];
                    const wTotal = sec.off ? -wItems.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) : wItems.reduce((s, t) => s + signed(t), 0);
                    return (
                      <div key={w} style={{ borderTop: "1px solid var(--border-soft)" }}>
                        <div role="button"
                          onTouchEnd={e => { if (touchMoved()) return; e.preventDefault(); setClosedWeeks(o => ({ ...o, [wk]: !o[wk] })); }}
                          onClick={() => { if (!("ontouchstart" in window)) setClosedWeeks(o => ({ ...o, [wk]: !o[wk] })); }}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px 7px 18px", background: "var(--surface2)", cursor: "pointer", touchAction: "manipulation" }}>
                          <span style={{ flex: 1, fontSize: ".6rem", fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".06em" }}>Semaine du {weekLbl(w)}</span>
                          <span style={{ fontSize: ".58rem", color: "var(--text3)" }}>{wItems.length} op.</span>
                          <span style={{ fontSize: ".66rem", fontWeight: 700, fontFamily: "var(--mono)", color: sec.color }}>{wTotal >= 0 ? "+" : "−"}{fmt(Math.abs(wTotal))}</span>
                          <span style={{ fontSize: ".6rem", color: "var(--text3)", transform: wOpen ? "rotate(180deg)" : "none" }}>▾</span>
                        </div>
                        {wOpen && (sec.off ? wItems.map(renderOffRow) : rowsOf(wItems))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── v1.74.0 : vue « Frise » — une partie repliable par type d'opération, chacune avec sa frise
           par jour et sa couleur (dépenses, revenus, cagnottes, équilibres, hors compte) ── */}
      {viewMode === "frise" && (() => {
        const today = todayISO();
        const TYPES = [
          { k: "exp", icon: "💸", label: "Dépenses",    color: "var(--danger)",  test: t => t.type === "expense" },
          { k: "inc", icon: "💰", label: "Revenus",     color: "var(--success)", test: t => t.type === "income" || t.type === "dissolution_cagnotte" },
          { k: "cag", icon: "🐷", label: "Cagnottes",   color: "var(--purple)",  test: t => ["epargne", "decagnottage", "transfer"].includes(t.type) },
          { k: "adj", icon: "⚖️", label: "Équilibres",  color: "var(--sapin)",   test: t => t.type === "balance_adjustment" },
          { k: "off", icon: "🎫", label: "Hors compte", color: "var(--tr)",      off: true },
        ];
        const signedOf = t => (isIncomeDirection(t) ? 1 : -1) * (parseFloat(t.amount) || 0);
        const offRow = e => {
          const cat = categories.find(c => c.id === e.categoryId);
          const st  = (data.sideAmountTypes || []).find(x => x.id === e.satId);
          return (
            <div key={e.id} onClick={() => onEditOffAccount?.(e)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".95rem", background: "color-mix(in srgb, var(--tr) 16%, transparent)", border: "1px dashed var(--tr-border)" }}>{cat?.icon || st?.icon || "🎫"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: ".74rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note || cat?.name || "Dépense hors compte"}</div>
                <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}>
                  {e.note && cat && <span style={{ fontSize: ".58rem", color: "var(--text2)" }}>{cat.name}</span>}
                  <span style={{ fontSize: ".5rem", padding: "1px 6px", borderRadius: 7, fontWeight: 800, color: "var(--tr)", background: "var(--tr-glow)" }}>{st?.icon || "🎫"} Hors compte</span>
                </div>
              </div>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".8rem", color: "var(--tr)", flexShrink: 0 }}>{fmt(e.amount)}</span>
              <div style={{ width: 26, flexShrink: 0 }} />
            </div>
          );
        };
        // Une frise par jour, teintée de la couleur du type
        const frise = (items, isOff, col) => {
          const byDay = {};
          items.forEach(x => (byDay[x.date] = byDay[x.date] || []).push(x));
          const days = Object.keys(byDay).sort((a, b) => sort === "date" ? b.localeCompare(a) : b.localeCompare(a));
          return (
            <div data-testid="hist-frise" style={{ position: "relative", paddingLeft: 36, marginBottom: 4 }}>
              <div style={{ position: "absolute", left: 14, top: 6, bottom: 6, width: 2, borderRadius: 1, background: `color-mix(in srgb, ${col} 45%, transparent)` }} />
              {days.map(date => {
                const list = byDay[date];
                const d = new Date(date + "T12:00:00");
                const isToday = date === today;
                const net = isOff ? -list.reduce((a, e) => a + (parseFloat(e.amount) || 0), 0) : list.reduce((a, t) => a + signedOf(t), 0);
                const allPointed = !isOff && list.filter(t => isPointable(t.type)).length > 0 && list.filter(t => isPointable(t.type)).every(t => t.pointed);
                const lbl = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", ...(date.slice(0, 4) !== String(year) ? { year: "numeric" } : {}) });
                return (
                  <div key={date} data-day={date} style={{ position: "relative", marginBottom: 10 }}>
                    <span style={{ position: "absolute", left: -35, top: 0, width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: ".66rem", fontWeight: 800, fontVariantNumeric: "tabular-nums",
                      background: isToday ? "var(--accent)" : `color-mix(in srgb, ${col} 22%, var(--bg))`, color: isToday ? "#04121c" : col,
                      boxShadow: "0 0 0 2px var(--bg)" }}>{d.getDate()}</span>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: ".6rem", fontWeight: 800, color: `color-mix(in srgb, ${col} 65%, var(--text2))`, margin: "6px 2px 5px", minHeight: 16 }}>
                      <span>{isToday ? `Aujourd'hui · ${lbl}` : lbl}</span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {allPointed && <span style={{ color: "var(--success)" }}>✓</span>}
                        <span style={{ fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums", color: "var(--text2)" }}>{net >= 0 ? "+" : "−"}{fmt(Math.abs(net))}</span>
                      </span>
                    </div>
                    <div className="card" style={{ padding: 0, overflow: "hidden", margin: 0, borderRadius: 14,
                      background: `color-mix(in srgb, ${col} 7%, var(--surface))`, border: `1px solid color-mix(in srgb, ${col} 45%, transparent)` }}>
                      {isOff ? list.map(offRow) : list.map(t => (
                        <SwipeRow key={t.id} t={t} variant="frise" categories={categories} cagnottes={cagnottes}
                          onEdit={onEditTrans} onDelete={onDeleteTrans} onTogglePoint={onTogglePointTx} onDuplicate={onDuplicateTrans}
                          onOpen={tx => setTxSheet(tx.id)} reimbAmt={reimbPending[t.id] || 0}
                          allTags={allTags} allSideAmountTypes={data.sideAmountTypes || []} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        };
        const parts = TYPES.map(T => {
          const items = T.off ? filteredOff : filtered.filter(T.test);
          const total = T.off ? -items.reduce((a, e) => a + (parseFloat(e.amount) || 0), 0) : items.reduce((a, t) => a + signedOf(t), 0);
          return { ...T, items, total };
        }).filter(P => P.items.length > 0);
        return (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, margin: "-2px 0 0" }}>
              <span role="button" data-testid="fold-all" onClick={() => setAllFold(true)} style={{ fontSize: ".6rem", fontWeight: 800, padding: "4px 9px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>⊟ Tout replier</span>
              <span role="button" data-testid="unfold-all" onClick={() => setAllFold(false)} style={{ fontSize: ".6rem", fontWeight: 800, padding: "4px 9px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>⊞ Tout déplier</span>
            </div>
            {parts.length === 0
              ? <EmptyIllustration type="historique" title="Aucun mouvement" sub="Aucune transaction ne correspond à ces filtres" />
              : parts.map(P => foldSec(P.k, `${P.icon} ${P.label}`, P.items.length,
                  <span style={{ color: P.color }}>{P.total >= 0 ? "+" : "−"}{fmt(Math.abs(P.total))}</span>,
                  frise(P.items, !!P.off, P.color), { color: P.color }))}
          </>
        );
      })()}

      {/* ── Liste avec pointage ── */}
      {viewMode === "list" && foldSec("ops", "💸 Opérations", filtered.length + filteredOff.length, null,
        filtered.length === 0 && filteredOff.length === 0
          ? <EmptyIllustration type="historique" title="Aucun mouvement" sub="Aucune transaction ne correspond à ces filtres" />
          : (
            <div className="card" style={{ padding: 0, overflow: "hidden", margin: 0 }}>
              {(() => {
                // Jours des opérations bancaires + jours n'ayant que du hors compte
                const offByDate = {};
                filteredOff.forEach(e => (offByDate[e.date] = offByDate[e.date] || []).push(e));
                const bankDates = new Set(grouped.map(([d]) => d));
                const merged = [...grouped, ...Object.keys(offByDate).filter(d => !bankDates.has(d)).map(d => [d, []])];
                if (sort === "date") merged.sort((a, b) => b[0].localeCompare(a[0]));
                return merged;
              })().map(([date, dayTxs]) => {
                const dayOff = filteredOff.filter(e => e.date === date);
                const allPointed = dayTxs.length > 0 && dayTxs.every(t => t.pointed);
                const dayNet = dayTxs.reduce((s, t) => isIncomeDirection(t) ? s + (parseFloat(t.amount)||0) : s - (parseFloat(t.amount)||0), 0);
                return (
                  <div key={date}>
                    <div style={{ padding: "7px 14px", background: "var(--surface2)", fontSize: ".6rem", fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em", display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-soft)" }}>
                      <span>{dateLabel(date)}</span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {allPointed && <span style={{ color: "var(--success)" }}>✓</span>}
                        {dayTxs.length > 0 && (
                        <span style={{ color: dayNet >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>
                          {dayNet >= 0 ? "+" : ""}{fmt(dayNet)}
                        </span>
                        )}
                      </div>
                    </div>
                    {pointFilter === "all"
                      ? dayTxs.map(t => (
                          <SwipeRow key={t.id} t={t} categories={categories} cagnottes={cagnottes}
                            onEdit={onEditTrans} onDelete={onDeleteTrans}
                            onTogglePoint={onTogglePointTx}
                            onDuplicate={onDuplicateTrans}
                            allTags={allTags} allSideAmountTypes={data.sideAmountTypes || []} />
                        ))
                      : dayTxs.map(t => (
                          <PointRow key={t.id}
                            item={{ ...t, name: txLabel(t, categories, cagnottes), cat: categories.find(c => c.id === t.categoryId) }}
                            onToggle={onTogglePointTx}
                            onEdit={id => onEditTrans(id)}
                            onDelete={id => onDeleteTrans(id)} />
                        ))
                    }
                    {dayOff.map(renderOffRow)}
                  </div>
                );
              })}
            </div>
          )
      )}

      {/* ── v1.73.0 : sections repliables « à confirmer » + fixes du mois, au style de la frise ── */}
      {viewMode === "frise" && !globalSearch && groupTitle("⏳ À confirmer")}
      {viewMode === "frise" && !globalSearch && foldSec("recur", "🔄 Récurrentes à confirmer", recurringPending.length,
        recurringPending.length === 0 ? <span style={{ color: "var(--text3)", fontWeight: 600, fontFamily: "inherit" }}>rien à confirmer</span> : null,
        <div className="card" style={{ padding: 0, overflow: "hidden", margin: 0 }}>
          <div style={{ padding: "7px 12px", fontSize: ".56rem", color: "var(--text3)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>Opérations habituelles pas encore saisies ce mois</div>
          {recurringPending.map(tpl => recurRow(tpl))}
        </div>, { dim: recurringPending.length === 0 })}
      {viewMode === "frise" && !globalSearch && foldSec("sched", "📅 Programmées ce mois", scheduledPending.length,
        scheduledPending.length === 0 ? <span style={{ color: "var(--text3)", fontWeight: 600, fontFamily: "inherit" }}>rien à confirmer</span> : null,
        <div className="card" style={{ padding: 0, overflow: "hidden", margin: 0 }}>{scheduledPending.map(sc => schedRow(sc))}</div>, { dim: scheduledPending.length === 0 })}
      {viewMode === "frise" && !globalSearch && foldSec("auto", "🎯 Épargnes à confirmer", autoSavingsPending.length,
        autoSavingsPending.length === 0 ? <span style={{ color: "var(--text3)", fontWeight: 600, fontFamily: "inherit" }}>rien à confirmer</span> : null,
        <div className="card" style={{ padding: 0, overflow: "hidden", margin: 0 }}>{autoSavingsPending.map(plan => autoRow(plan))}</div>, { dim: autoSavingsPending.length === 0 })}
      {viewMode === "frise" && (monthFixes.length > 0 || monthIncomes.length > 0) && pointFilter !== "pointed" && groupTitle("📌 Fixes du mois")}

      {(viewMode === "list" || viewMode === "type") && !globalSearch && autoSavingsPending.length > 0 &&
        foldSec("auto", "🎯 Épargnes à confirmer", autoSavingsPending.length, null, (
          <div className="card" style={{ padding: 0, overflow: "hidden", margin: 0 }}>
            {autoSavingsPending.map(autoRow)}
          </div>
        ))}

      {(viewMode === "list" || viewMode === "type") && !globalSearch && scheduledPending.length > 0 &&
        foldSec("sched", "📅 Programmées ce mois", scheduledPending.length, null, (
          <div className="card" style={{ padding: 0, overflow: "hidden", margin: 0 }}>
            {scheduledPending.map(schedRow)}
          </div>
        ))}

      {(viewMode === "list" || viewMode === "type") && recurringPending.length > 0 &&
        foldSec("recur", "🔄 Récurrentes à confirmer", recurringPending.length, null, (
          <div className="card" style={{ padding: 0, overflow: "hidden", margin: 0 }}>
            <div style={{ padding: "7px 12px", fontSize: ".56rem", color: "var(--text3)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>Opérations habituelles pas encore saisies ce mois</div>
            {recurringPending.map(recurRow)}
          </div>
        ))}

      {/* ── Frais et revenus fixes du mois (Frise et Liste ; la vue Par type les a dans sa section) ── */}
      {(viewMode === "list" || viewMode === "frise") && monthFixes.length > 0 && pointFilter !== "pointed" && (() => {
        const n = monthFixes.filter(f => f.pointedMonths?.[month]).length;
        return foldSec("fixes", "📌 Frais fixes du mois", null,
          <span style={{ color: n === monthFixes.length ? "var(--success)" : "var(--warning)" }}>{n}/{monthFixes.length} pointés</span>, fixedCard("expense", true));
      })()}
      {(viewMode === "list" || viewMode === "frise") && monthIncomes.length > 0 && pointFilter !== "pointed" && (() => {
        const n = monthIncomes.filter(f => f.pointedMonths?.[month]).length;
        return foldSec("incomes", "💰 Revenus fixes du mois", null,
          <span style={{ color: n === monthIncomes.length ? "var(--success)" : "var(--warning)" }}>{n}/{monthIncomes.length} reçus</span>, fixedCard("income", true));
      })()}

      {txSheet && (() => {
        const t = transactions.find(x => x.id === txSheet);
        if (!t) return null;
        return <TxActionSheet t={t} categories={categories} cagnottes={cagnottes} allTags={allTags} allSideAmountTypes={data.sideAmountTypes || []}
          reimbAmt={reimbPending[t.id] || 0} onClose={() => setTxSheet(null)}
          onTogglePoint={onTogglePointTx} onEdit={onEditTrans} onDuplicate={onDuplicateTrans} onDelete={onDeleteTrans} />;
      })()}
    </div>
  );
}

function groupByDate(txs) {
  const groups = {};
  txs.forEach(t => { if (!groups[t.date]) groups[t.date] = []; groups[t.date].push(t); });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

function dateLabel(dateStr) {
  const today = new Date();
  const d     = new Date(dateStr + "T12:00:00");
  const diff  = Math.floor((today.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  return new Date(dateStr + "T12:00:00")
    .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function SwipeRow({ t, categories, cagnottes, onEdit, onDelete, onTogglePoint, onDuplicate, allTags = [], allSideAmountTypes = [], variant = "row", onOpen, reimbAmt = 0 }) {
  const [offset,   setOffset]   = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startX  = useRef(null);
  const startY  = useRef(null);
  const isHoriz = useRef(false);
  const cat    = categories.find(c => c.id === t.categoryId);
  const { label, cls, sign } = (() => {
    const l = txLabel(t, categories, cagnottes);
    // Pour dissolution_cagnotte : utiliser directement t.note qui contient le bon libellé
    const finalLabel = t.type === "dissolution_cagnotte" && t.note ? t.note : l;
    // Une opération d'équilibre peut ajouter OU soustraire selon adjSign —
    // txSign() ne connaît pas ce champ, donc on corrige le signe ici (la
    // couleur reste neutre/sapin dans les deux cas, cohérent avec le reste
    // de l'app pour ce type d'opération).
    const finalSign = t.type === "balance_adjustment"
      ? (t.adjSign === "+" ? "+" : "−")
      : txSign(t.type);
    return { label: finalLabel, cls: txTypeClass(t.type), sign: finalSign };
  })();
  const icon = cat?.icon ?? (t.type === "dissolution_cagnotte" ? "🏦" : t.type === "epargne" ? "🐷" : t.type === "decagnottage" ? "↩️" : "💸");

  const PANEL = 150; // v1.74.0 : 3 boutons ronds

  return (
    <div style={{ position: "relative", overflow: "hidden", borderBottom: variant === "frise" ? "1px solid rgba(255,255,255,.06)" : "1px solid var(--border-soft)" }}>
      {/* Actions cachées — ✏️ 📋 🗑️ */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: PANEL, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, visibility: offset === 0 ? "hidden" : "visible" }}>
        <RoundAct icon="✏️" label="Modifier"  color="var(--accent)"  testid="swipe-edit" onClick={() => { setOffset(0); setRevealed(false); onEdit?.(t.id); }} />
        <RoundAct icon="⧉"  label="Dupliquer" color="var(--success)" testid="swipe-dup"  onClick={() => { setOffset(0); setRevealed(false); onDuplicate?.(t); }} />
        <RoundAct icon="🗑" label="Supprimer" color="var(--danger)"  testid="swipe-del"  onClick={() => { setOffset(0); setRevealed(false); onDelete?.(t.id); }} />
      </div>
      {/* Ligne */}
      <div
        onTouchStart={e => {
          startX.current  = e.touches[0].clientX;
          startY.current  = e.touches[0].clientY;
          isHoriz.current = false;
        }}
        onTouchMove={e => {
          const dx = e.touches[0].clientX - startX.current;
          const dy = e.touches[0].clientY - startY.current;
          if (!isHoriz.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
            isHoriz.current = Math.abs(dx) > Math.abs(dy);
          }
          if (!isHoriz.current) return;
          if (dx < 0) setOffset(Math.max(-PANEL, dx));
          else if (revealed) setOffset(Math.min(0, -PANEL + dx));
        }}
        onTouchEnd={() => {
          if (!isHoriz.current) return;
          if (offset < -PANEL / 2) { setOffset(-PANEL); setRevealed(true); }
          else { setOffset(0); setRevealed(false); }
        }}
        onClick={() => { if (revealed) { setOffset(0); setRevealed(false); } else if (variant === "frise") onOpen?.(t); }}
        data-testid={variant === "frise" ? "frise-row" : undefined}
        style={variant === "frise" ? {
          transform: `translateX(${offset}px)`,
          transition: (offset === 0 || offset === -PANEL) ? "transform .2s" : "none",
          background: offset === 0 ? "transparent" : "var(--bg)",
          display: "flex", alignItems: "center", gap: 9, padding: "8px 10px",
          cursor: "pointer",
        } : {
          transform: `translateX(${offset}px)`,
          transition: (offset === 0 || offset === -PANEL) ? "transform .2s" : "none",
          background: t.type === "dissolution_cagnotte" ? "#080f0c"
                    : t.type === "decagnottage"         ? "#0e0906"
                    : t.type === "epargne"              ? "#0b080f"
                    : "var(--bg)",
          boxShadow: t.type === "dissolution_cagnotte" ? "inset 3px 0 0 rgba(104,212,152,.35)"
                   : t.type === "decagnottage"         ? "inset 3px 0 0 rgba(224,136,112,.35)"
                   : t.type === "epargne"              ? "inset 3px 0 0 rgba(176,144,224,.35)"
                   : "none",
          display: "flex", alignItems: "center", gap: 8, padding: "11px 14px",
          cursor: "pointer",
        }}>
        {variant === "frise" ? (
          <FriseRowContent t={t} cat={cat} icon={icon} label={label} sign={sign} categories={categories}
            onTogglePoint={onTogglePoint} allTags={allTags} allSideAmountTypes={allSideAmountTypes} reimbAmt={reimbAmt} />
        ) : (<>
        {/* Bouton pointage — masqué pour decagnottage et transfer, spacer pour alignement */}
        {onTogglePoint && isPointable(t.type) ? (
          <button
            onTouchStart={e => e.stopPropagation()}
            onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); onTogglePoint(t.id); }}
            onClick={e => { e.stopPropagation(); }}
            style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: t.pointed ? "var(--success)" : "transparent",
              border: `2px solid ${t.pointed ? "var(--success)" : "var(--border)"}`,
              color: t.pointed ? "var(--bg)" : "var(--text3)",
              fontSize: ".88rem", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .15s",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}>{t.pointed ? "✓" : ""}</button>
        ) : (
          /* Spacer — même largeur que le bouton, invisible, pour garder l'alignement */
          <div style={{ width: 32, height: 32, flexShrink: 0 }}/>
        )}
        {/* Icône — fond coloré pour les types spéciaux */}
        {(() => {
          const TYPE_COLOR = {
            dissolution_cagnotte: "var(--success)",
            decagnottage:         "var(--coral)",
            epargne:              "var(--purple)",
          };
          const specialColor = TYPE_COLOR[t.type];
          return (
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: specialColor ? `color-mix(in srgb,${specialColor} 14%,var(--surface2))` : "var(--surface2)",
              border: specialColor ? `1.5px solid color-mix(in srgb,${specialColor} 35%,transparent)` : `1.5px solid var(--border)`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem",
            }}>
              {icon}
            </div>
          );
        })()}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: ".76rem", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1, flexWrap: "nowrap", overflow: "hidden" }}>
            {/* Sous-texte : pour les types spéciaux, badge type + raison */}
            {(() => {
              const TYPE_BADGE = {
                dissolution_cagnotte: { label:"↑ Retrait cagnotte", bg:"rgba(104,212,152,.1)",  color:"var(--success)" },
                decagnottage:         { label:"↩ Retrait cagnotte", bg:"rgba(224,136,112,.1)",  color:"var(--coral)"   },
                epargne:              { label:"↓ Épargne",           bg:"rgba(176,144,224,.1)",  color:"var(--purple)"  },
              };
              const badge = TYPE_BADGE[t.type];
              if (badge) {
                return (
                  <>
                    <span style={{ fontSize:".5rem", fontWeight:700, padding:"1px 5px", borderRadius:3, background:badge.bg, color:badge.color, flexShrink:0 }}>{badge.label}</span>
                    {t.note && t.type === "dissolution_cagnotte" && (
                      <span style={{ fontSize:".55rem", color:"var(--text2)", fontStyle:"italic", flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {t.note.includes(" — ") ? t.note.split(" — ").slice(1).join(" — ") : ""}
                      </span>
                    )}
                    <span style={{ fontSize:".58rem", color:"var(--text3)", flexShrink:0 }}>{t.date.slice(8)}/{t.date.slice(5,7)}</span>
                  </>
                );
              }
              return (
                <>
                  <span style={{ fontSize: ".6rem", color: "var(--text3)", flexShrink: 0 }}>{txSubLabel(t.note, cat, categories, t.date)}</span>
                  {t.paymentMethod === "cheque" && (
                    <span style={{ fontSize: ".5rem", padding: "1px 5px", background: "var(--chq-glow)", color: "var(--chq)", border: "1px solid var(--chq-border)", borderRadius: 10, fontWeight: 700, flexShrink: 0 }}>
                      🧾 {t.pointed ? "Encaissé" : `En attente · ${Math.max(0, daysBetweenISO(t.issuedDate || t.date, todayISO()))} j`}
                    </span>
                  )}
                  {Object.entries(t.sideAmounts || {}).map(([satId, amt]) => {
                    if (!(amt > 0)) return null;
                    const st = allSideAmountTypes.find(s => s.id === satId);
                    return (
                      <span key={satId} style={{ fontSize: ".5rem", padding: "1px 5px", background: "var(--tr-glow)", color: "var(--tr)", borderRadius: 10, fontWeight: 700, flexShrink: 0 }}>
                        {st?.icon || "🎫"} +{fmt(amt)}
                      </span>
                    );
                  })}
                  {(t.tagIds || []).map(tid => {
                    const tag = allTags.find(tg => tg.id === tid);
                    if (!tag) return null;
                    return (
                      <span key={tid} style={{ fontSize: ".5rem", padding: "1px 5px", background: `${tag.color}22`, color: tag.color, borderRadius: 10, fontWeight: 700, flexShrink: 0 }}>
                        {tag.icon} {tag.name}
                      </span>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
          <div className={`item-amount ${cls}`} style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".85rem" }}>
            {sign}{fmt(t.amount)}
          </div>
          {(() => {
            const sideTotal = Object.values(t.sideAmounts || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
            return sideTotal > 0 && (
              <div style={{ fontSize: ".52rem", color: "var(--text3)" }}>
                budget : {fmt((parseFloat(t.amount)||0) + sideTotal)}
              </div>
            );
          })()}
        </div>
        <span style={{ color: "var(--text3)", fontSize: ".7rem", marginLeft: 2 }}>‹</span>
        </>)}
      </div>
    </div>
  );
}

// ── v1.71.0 : vue « Frise » — badges partagés par la ligne et la feuille d'actions ──
const FRISE_TYPE_COLOR = { epargne: "var(--purple)", decagnottage: "var(--purple)", transfer: "var(--accent)", balance_adjustment: "var(--sapin)", dissolution_cagnotte: "var(--success)" };
export function friseAmountColor(t) {
  return FRISE_TYPE_COLOR[t.type] || (isIncomeDirection(t) ? "var(--success)" : "var(--danger)");
}
function TxBadges({ t, allTags, allSideAmountTypes, reimbAmt }) {
  const b = (key, text, color, extra = {}) => (
    <span key={key} style={{ fontSize: ".5rem", fontWeight: 800, padding: "1px 6px", borderRadius: 7, flexShrink: 0, whiteSpace: "nowrap",
      color, background: `color-mix(in srgb, ${color} 15%, transparent)`, ...extra }}>{text}</span>
  );
  const TYPE_BADGE = { dissolution_cagnotte: ["↑ Retrait cagnotte", "var(--success)"], decagnottage: ["↩ Retrait cagnotte", "var(--coral)"], epargne: ["↓ Épargne", "var(--purple)"], transfer: ["🔄 Transfert", "var(--accent)"], balance_adjustment: ["⚖️ Équilibre", "var(--sapin)"] };
  const out = [];
  if (TYPE_BADGE[t.type]) out.push(b("type", TYPE_BADGE[t.type][0], TYPE_BADGE[t.type][1]));
  if (t.paymentMethod === "cheque") out.push(b("chq", `🧾 ${t.pointed ? "Encaissé" : `En attente · ${Math.max(0, daysBetweenISO(t.issuedDate || t.date, todayISO()))} j`}`, "var(--chq)"));
  if (reimbAmt > 0) out.push(b("rb", `↩️ ${fmt(reimbAmt)} attendus`, "var(--success)"));
  Object.entries(t.sideAmounts || {}).forEach(([satId, amt]) => {
    if (!(amt > 0)) return;
    const st = allSideAmountTypes.find(x => x.id === satId);
    out.push(b(`sa-${satId}`, `${st?.icon || "🎫"} +${fmt(amt)}`, "var(--tr)"));
  });
  (t.tagIds || []).forEach(tid => {
    const tag = allTags.find(tg => tg.id === tid);
    if (tag) out.push(b(`tg-${tid}`, `${tag.icon} ${tag.name}`, tag.color));
  });
  return out;
}
function friseSub(t, cat, categories) {
  if (t.type === "dissolution_cagnotte" && t.note && t.note.includes(" — ")) return t.note.split(" — ").slice(1).join(" — ");
  if (t.note) return cat?.name || "";
  const parent = cat?.parentId ? (categories || []).find(c => c.id === cat.parentId) : null;
  return parent ? parent.name : "";
}
function FriseRowContent({ t, cat, icon, label, sign, categories, onTogglePoint, allTags, allSideAmountTypes, reimbAmt }) {
  const tint = cat?.color || FRISE_TYPE_COLOR[t.type] || "var(--text3)";
  const sub = friseSub(t, cat, categories);
  const badges = TxBadges({ t, allTags, allSideAmountTypes, reimbAmt });
  const sideTotal = Object.values(t.sideAmounts || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  return (
    <>
      <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".95rem",
        background: `color-mix(in srgb, ${tint} 18%, transparent)` }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: ".74rem", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        {(sub || badges.length > 0) && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, flexWrap: "nowrap", overflow: "hidden" }}>
            {sub && <span style={{ fontSize: ".58rem", color: "var(--text2)", flexShrink: 0, maxWidth: "55%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
            {badges}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".8rem", color: friseAmountColor(t), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{sign}{fmt(t.amount)}</span>
        {sideTotal > 0 && <span style={{ fontSize: ".5rem", color: "var(--text3)" }}>budget : {fmt((parseFloat(t.amount) || 0) + sideTotal)}</span>}
      </div>
      {onTogglePoint && isPointable(t.type) ? (
        <button data-testid="frise-check" aria-label={t.pointed ? "Dépointer" : "Pointer"}
          onTouchStart={e => e.stopPropagation()}
          onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); onTogglePoint(t.id); }}
          onClick={e => { e.stopPropagation(); if (!("ontouchstart" in window)) onTogglePoint(t.id); }}
          style={{ width: 34, height: 34, margin: "-6px -6px -6px -2px", flexShrink: 0, background: "transparent", border: "none", padding: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".62rem", fontWeight: 900,
            background: t.pointed ? "var(--success)" : "transparent", border: `1.8px solid ${t.pointed ? "var(--success)" : "var(--text3)"}`, color: "#04140c", transition: "all .15s" }}>{t.pointed ? "✓" : ""}</span>
        </button>
      ) : <div style={{ width: 26, flexShrink: 0 }} />}
    </>
  );
}

// Feuille d'actions d'une opération (toucher une ligne de la frise)
function TxActionSheet({ t, categories, cagnottes, allTags, allSideAmountTypes, reimbAmt, onClose, onTogglePoint, onEdit, onDuplicate, onDelete }) {
  const cat = categories.find(c => c.id === t.categoryId);
  const label = t.type === "dissolution_cagnotte" && t.note ? t.note : txLabel(t, categories, cagnottes);
  const icon = cat?.icon ?? (t.type === "dissolution_cagnotte" ? "🏦" : t.type === "epargne" ? "🐷" : t.type === "decagnottage" ? "↩️" : "💸");
  const sign = t.type === "balance_adjustment" ? (t.adjSign === "+" ? "+" : "−") : txSign(t.type);
  const longDate = new Date(t.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const act = fn => () => { onClose(); fn(); };
  return createPortal(
    <div data-testid="tx-sheet" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(2,6,14,.6)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", animation: "fadeIn .2s ease" }} />
      <div style={{
        position: "relative", width: "100%", maxHeight: "86vh", overflowY: "auto",
        background: "var(--panel-solid, var(--surface))", border: "1px solid var(--border)", borderRadius: 22,
        padding: 14, boxShadow: "0 20px 60px rgba(0,0,0,.65)",
        animation: "slideUp .22s ease", maxWidth: 520, margin: "0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: "1.2rem" }}>{icon}</span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--display)", fontSize: "1rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: ".64rem", color: "var(--text2)" }}>{[cat?.name, longDate].filter(Boolean).join(" · ")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>{TxBadges({ t, allTags, allSideAmountTypes, reimbAmt })}</div>
          </div>
          <b style={{ fontFamily: "var(--mono)", fontSize: "1.1rem", color: friseAmountColor(t), whiteSpace: "nowrap" }}>{sign}{fmt(t.amount)}</b>
        </div>
        <div style={{ display: "flex", justifyContent: "space-around", gap: 6, marginTop: 14 }}>
          {onTogglePoint && isPointable(t.type) && (
            <RoundAct size={44} testid="sheet-point" icon={t.pointed ? "↩" : "✓"} label={t.pointed ? "Dépointer" : "Pointer"} color="var(--success)" onClick={act(() => onTogglePoint(t.id))} />
          )}
          <RoundAct size={44} testid="sheet-edit" icon="✏️" label="Modifier"  color="var(--accent)"  onClick={act(() => onEdit?.(t.id))} />
          <RoundAct size={44} testid="sheet-dup"  icon="⧉"  label="Dupliquer" color="var(--success)" onClick={act(() => onDuplicate?.(t))} />
          <RoundAct size={44} testid="sheet-del"  icon="🗑" label="Supprimer" color="var(--danger)"  onClick={act(() => onDelete?.(t.id))} />
        </div>
        <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 10 }}>Glisser une ligne vers la gauche donne aussi Modifier / Dupliquer / Supprimer.</div>
      </div>
    </div>,
    document.body
  );
}

// 6. Répartition catégories
function CatBreakdown({ txs, allTxs, categories, onSelectCat }) {
  const source = allTxs || txs;

  // Dépenses par catégorie
  const bycat = {};
  source.filter(t => t.type === "expense").forEach(t => {
    const c   = categories.find(c => c.id === t.categoryId);
    const key = c?.id || "__other__";
    if (!bycat[key]) bycat[key] = { id: c?.id||null, name: c?.name||"Sans catégorie", icon: c?.icon||"❓", color: c?.color||"var(--text3)", exp:0, inc:0, count:0 };
    bycat[key].exp   += parseFloat(t.amount)||0;
    bycat[key].count++;
  });

  // Revenus en déduction — même catégorie OU catégorie liée (linkedToId)
  source.filter(t => isIncome(t.type) && t.type !== "dissolution_cagnotte").forEach(t => {
    const a   = parseFloat(t.amount)||0;
    const cat = categories.find(c => c.id === t.categoryId);
    // Catégorie liée → déduire de la cible
    if (cat?.linkedToId && bycat[cat.linkedToId]) {
      bycat[cat.linkedToId].inc += a;
    } else if (t.categoryId && bycat[t.categoryId]) {
      // Même catégorie directe
      bycat[t.categoryId].inc += a;
    }
  });

  const sorted    = Object.values(bycat).map(c => ({ ...c, net: Math.max(0, c.exp - c.inc) })).sort((a,b) => b.net - a.net);
  const totalNet  = sorted.reduce((s, c) => s + c.net, 0) || 1;

  if (sorted.length === 0) return (
    <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text3)", fontSize: ".75rem" }}>Aucune dépense ce mois</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.map(c => {
        const hasOffset = c.inc > 0;
        return (
          <div key={c.name}
            onClick={() => c.id && onSelectCat?.(c.id)}
            style={{
              background: "var(--surface)", border: `1px solid color-mix(in srgb, ${c.color} 45%, transparent)`,
              borderRadius: 14,
              padding: "10px 12px", cursor: c.id ? "pointer" : "default",
            }}>
            {/* En-tête : nom + montants */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: hasOffset ? 4 : 6, alignItems: "center" }}>
              <span style={{ fontSize: ".75rem", fontWeight: 700 }}>{c.icon} {c.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {hasOffset
                  ? <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--success)", fontSize: ".78rem", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(c.net)}
                    </span>
                  : <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: c.color, fontSize: ".78rem", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(c.exp)}
                    </span>
                }
                <span style={{ fontSize: ".58rem", color: "var(--text3)" }}>{c.count} op.</span>
                {c.id && <span style={{ color: "var(--text3)", fontSize: ".75rem" }}>›</span>}
              </div>
            </div>
            {/* Ligne de déduction si remboursement */}
            {hasOffset && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, padding: "3px 6px", background: "rgba(104,212,152,.07)", borderRadius: 5 }}>
                <span style={{ fontSize: ".6rem", color: "var(--success)" }}>↩ Remboursé / partagé</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: ".62rem", fontWeight: 700, color: "var(--success)" }}>−{fmt(c.inc)}</span>
              </div>
            )}
            {/* Barre de progression — basée sur le net */}
            <div style={{ height: 5, background: "var(--surface3)", borderRadius: 99 }}>
              <div data-pv="" style={{ width: `${(c.net / totalNet * 100).toFixed(0)}%`, height: "100%", background: c.color, borderRadius: 99 }}/>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".55rem", color: "var(--text3)", marginTop: 2 }}>
              <span>{hasOffset ? `Brut : ${fmt(c.exp)}` : ""}</span>
              <span>{pv((c.net / totalNet * 100).toFixed(0))}% des dépenses nettes</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
