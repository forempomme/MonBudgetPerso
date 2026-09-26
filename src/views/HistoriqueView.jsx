// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { fmt, currentYM, isIncome, txLabel, txTypeClass, txSign, todayISO } from "../utils.js";
import { useMonthStats, isPointable, isActiveForMonth, isIncomeDirection } from "../hooks.js";
import { EmptyIllustration, MONTHS_FR } from "./shared.jsx";

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
  const REVEAL_W = onEdit || onDelete ? 120 : 0;

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
      {REVEAL_W > 0 && (
        <div style={{ position:"absolute", top:0, right:0, bottom:0, width:REVEAL_W, display:"flex" }}>
          {onEdit && (
            <button onClick={() => { closeSwipe(); onEdit(item.id); }} style={{
              flex:1, background:"var(--accent)", border:"none",
              color:"var(--bg)", fontSize:".65rem", fontWeight:800, cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2,
            }}>✏️<span>Modifier</span></button>
          )}
          {onDelete && (
            <button onClick={() => { closeSwipe(); onDelete(item.id); }} style={{
              flex:1, background:"var(--danger)", border:"none",
              color:"#fff", fontSize:".65rem", fontWeight:800, cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2,
            }}>🗑<span>Supprimer</span></button>
          )}
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
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
        borderBottom: editing ? "none" : "1px solid var(--border-soft)",
        background: item.pointed ? "rgba(104,212,152,.04)" : "var(--surface)",
        transition: "background .2s",
      }}>
        {/* Bouton pointage */}
        <button
          onTouchStart={e => e.stopPropagation()}
          onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); onToggle(item.id); }}
          onClick={e => e.stopPropagation()}
          style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: item.pointed ? "var(--success)" : "transparent",
            border: `2px solid ${item.pointed ? "var(--success)" : "var(--border)"}`,
            color: item.pointed ? "var(--bg)" : "var(--text3)",
            fontSize: ".88rem", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .15s", touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}>{item.pointed ? "✓" : ""}</button>

        <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {item.cat?.icon ?? (isInc ? "💰" : isFixed ? "📌" : "💸")}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: ".74rem", fontWeight: 700, color: "var(--text)", opacity: item.pointed ? 1 : .75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {item.name || item.note || "—"}
            </span>
            {isFixed && <span style={{ fontSize: ".5rem", background: "var(--warning-glow)", color: "var(--warning)", padding: "1px 5px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>FIXE</span>}
            {item.isAutoSaving  && <span style={{ fontSize: ".5rem", background: "rgba(160,120,224,.15)", color: "var(--purple)",  padding: "1px 5px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>AUTO</span>}
            {item.fromScheduled && <span style={{ fontSize: ".5rem", background: "rgba(200,184,96,.15)",  color: "var(--warning)", padding: "1px 5px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>PROG</span>}
            {isFixed && item.isOverridden && <span style={{ fontSize: ".5rem", background: "var(--accent-glow)", color: "var(--accent)", padding: "1px 5px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>modifié</span>}
          </div>
          {item.date && <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 1 }}>{item.date.slice(8)}/{item.date.slice(5,7)}</div>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".8rem", color: isInc ? "var(--success)" : "var(--danger)", opacity: item.pointed ? 1 : .55 }}>
            {isInc ? "+" : "−"}{fmt(item.amount)}
          </div>
          {isFixed && onEditFixed && (
            <button
              onTouchStart={e => e.stopPropagation()}
              onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); startEdit(); }}
              onClick={e => { e.stopPropagation(); startEdit(); }}
              style={{
                background: "var(--accent-glow)", border: "1px solid var(--border)",
                borderRadius: 7, padding: "4px 7px", color: "var(--accent)",
                fontSize: ".7rem", cursor: "pointer",
                touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
              }}>✏️</button>
          )}
        </div>
      </div>

      {/* Formulaire édition inline — ce mois uniquement */}
      {editing && (
        <div style={{ padding: "10px 14px 12px", background: "rgba(112,184,224,.06)", borderBottom: "1px solid var(--border-soft)", borderLeft: "3px solid var(--accent)" }}>
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
// ─────────────────────────────────────────────────────────────────
export function HistoriqueView({ data, onEditOffAccount, onEditTrans, onDeleteTrans, onDuplicateTrans, onTogglePointTx, onTogglePointFix, onTogglePointIncome, onOverrideFixMonth, onConfirmRecurring, onDeleteRecurring, onApplyAutoSaving, onSkipAutoSaving, onConfirmScheduled, onDeleteScheduled, initPointFilter = "all", onClearPointFilter }) {
  const now = new Date();
  const [year,     setYear]     = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [sort,     setSort]     = useState("date");
  const [catId,    setCatId]    = useState("");
  const [viewMode, setViewMode] = useState("list");
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
        return !transactions.some(t => t.templateId === tpl.id && t.date.startsWith(year));
      }
      // monthly
      return !transactions.some(t => t.templateId === tpl.id && t.date.startsWith(month));
    });
  }, [recurringTemplates, transactions, month]);
  const mStats = useMonthStats(transactions, fixedExpenses, month);
  const savMonth = useMemo(() =>
    transactions.filter(t => t.date.startsWith(month) && t.type === "epargne")
      .reduce((s, t) => s + (parseFloat(t.amount)||0), 0), [transactions, month]);

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
      const ov = f.monthlyOverrides?.[month];
      const a  = (ov?.amount ?? f.amount) || 0;
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
        return (t.note||"").toLowerCase().includes(q) || (cat?.name||"").toLowerCase().includes(q);
      });
    }
    if (minAmt) list = list.filter(t => parseFloat(t.amount) >= parseFloat(minAmt));
    if (maxAmt) list = list.filter(t => parseFloat(t.amount) <= parseFloat(maxAmt));
    if (tagFilter) list = list.filter(t => (t.tagIds || []).includes(tagFilter));
    if (pointFilter === "pointed")   list = list.filter(t => isPointable(t.type) &&  t.pointed);
    if (pointFilter === "unpointed") list = list.filter(t => isPointable(t.type) && !t.pointed);
    if (sort === "date")  list.sort((a,b) => new Date(b.date) - new Date(a.date));
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
    return list;
  }, [data.offAccountEntries, hideOff, tagFilter, pointFilter, filter, globalSearch, search, month, catId, categories, minAmt, maxAmt]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <div>
      {/* ── 5. Navigation mois ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 16px", marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ background: "var(--accent-glow)", border: "none", borderRadius: 8, width: 36, height: 36, color: "var(--accent)", fontSize: "1.1rem", cursor: "pointer" }}>◀</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--display)", fontSize: "1rem", fontWeight: 800 }}>{MONTHS_FR[monthIdx]}</div>
          <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 1 }}>{year}</div>
        </div>
        <button onClick={nextMonth} style={{ background: isCurrentMonth ? "var(--surface3)" : "var(--accent-glow)", border: "none", borderRadius: 8, width: 36, height: 36, color: isCurrentMonth ? "var(--text3)" : "var(--accent)", fontSize: "1.1rem", cursor: isCurrentMonth ? "default" : "pointer", opacity: isCurrentMonth ? .4 : 1 }}>▶</button>
      </div>

      {/* ── Donut + barre budget ── */}
      <div className="card" style={{ padding: 14, marginBottom: 10 }}>
        <HistDonut inc={mStats.inc} exp={mStats.exp} sav={savMonth} />
        <BudgetBar exp={mStats.exp} inc={mStats.inc} />
      </div>

      {/* ── Mini récap rapprochement ── */}
      {totalPointable > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: ".62rem", fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".08em" }}>📊 Rapprochement</div>
            <span style={{ fontSize: ".6rem", color: nbPointed === totalPointable ? "var(--success)" : "var(--warning)", fontWeight: 700 }}>
              {nbPointed === totalPointable ? "✓ Complet" : `${nbPointed}/${totalPointable}`}
            </span>
          </div>

          {/* Deux mini-cartes clickables */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 8 }}>
            {[
              { label: "✓ Pointé",     value: soldePointe,  color: "var(--success)", bg: "rgba(104,212,152,.1)", filter: "pointed",   sub: `${nbPointed} op.` },
              { label: "⏳ En attente", value: soldeAttente, color: "var(--warning)",  bg: "rgba(200,184,96,.08)", filter: "unpointed", sub: `${totalPointable - nbPointed} op.` },
            ].map(s => (
              <div key={s.label}
                onClick={() => setPointFilter(f => f === s.filter ? "all" : s.filter)}
                style={{
                  background: s.bg, borderRadius: 8, padding: "7px 9px",
                  border: `1px solid ${pointFilter === s.filter ? s.color : "transparent"}`,
                  cursor: "pointer", transition: "border-color .15s",
                }}>
                <div style={{ fontSize: ".55rem", color: s.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 800, color: s.color, fontSize: ".82rem", fontVariantNumeric: "tabular-nums" }}>
                  {s.value >= 0 ? "+" : ""}{fmt(s.value)}
                </div>
                <div style={{ fontSize: ".52rem", color: "var(--text3)", marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Barre de progression */}
          <div style={{ height: 5, background: "var(--surface3)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${totalPointable > 0 ? (nbPointed / totalPointable) * 100 : 0}%`, height: "100%", background: "linear-gradient(90deg, var(--success), var(--accent))", borderRadius: 99, transition: "width .3s" }} />
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
          <div className="hist-search-wrap" style={{ flex: 1, marginBottom: 0 }}>
            <span className="hist-search-icon">🔍</span>
            <input className="hist-search" type="text" placeholder="Rechercher…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {/* Toggle recherche globale */}
          <button
            onClick={() => setGlobalSearch(g => !g)}
            title="Rechercher sur tous les mois"
            style={{
              background: globalSearch ? "var(--accent-glow)" : "transparent",
              border: `1px solid ${globalSearch ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8, padding: "7px 10px",
              color: globalSearch ? "var(--accent)" : "var(--text3)",
              fontSize: ".65rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            }}>
            {globalSearch ? "🌐 Global" : "🌐"}
          </button>
        </div>
        {globalSearch && search.trim() && (
          <div style={{ fontSize: ".6rem", color: "var(--accent)", fontWeight: 700, marginBottom: 6, padding: "4px 8px", background: "var(--accent-glow)", borderRadius: 6 }}>
            🌐 Recherche sur toutes les périodes — {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
          </div>
        )}

        {/* ── Filtres compacts ── */}
        {(() => {
          const activeCount = [
            filter !== "all", pointFilter !== "all", tagFilter !== "", hideOff,
            sort !== "date", minAmt !== "", maxAmt !== "", viewMode !== "list",
          ].filter(Boolean).length;
          const activePills = [
            filter !== "all"       && { label: filter === "expense" ? "Dépenses" : filter === "income" ? "Revenus" : "Cagnottes", clear: () => setFilter("all") },
            pointFilter !== "all"  && { label: pointFilter === "pointed" ? "✓ Pointées" : "⏳ Attente", clear: () => { setPointFilter("all"); onClearPointFilter?.(); } },
            hideOff                && { label: "🎫 Hors compte masqué", clear: () => setHideOff(false) },
            tagFilter              && (() => { const tg = (data.tags||[]).find(t=>t.id===tagFilter); return tg && { label: `${tg.icon} ${tg.name}`, clear: () => setTagFilter("") }; })(),
            sort !== "date"        && { label: sort === "amt_d" ? "Montant ↓" : "Montant ↑", clear: () => setSort("date") },
            (minAmt || maxAmt)     && { label: `${minAmt||"0"}–${maxAmt||"∞"} €`, clear: () => { setMinAmt(""); setMaxAmt(""); } },
            viewMode !== "list"    && { label: "📊 Catégories", clear: () => setViewMode("list") },
            viewMode === "calendar" && { label: "📅 Calendrier", clear: () => setViewMode("list") },
          ].filter(Boolean);

          return (
            <div>
              {/* Barre unique */}
              <div style={{ display: "flex", gap: 5, marginBottom: showFilterPanel || activePills.length > 0 ? 6 : 0 }}>
                <button onClick={() => setShowFilterPanel(p => !p)} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: activeCount > 0 ? "var(--accent-glow)" : "var(--surface2)",
                  border: `1px solid ${activeCount > 0 ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 8, padding: "0 10px", height: 36,
                  color: activeCount > 0 ? "var(--accent)" : "var(--text2)",
                  fontWeight: 700, fontSize: ".68rem", cursor: "pointer", flexShrink: 0, touchAction: "manipulation",
                }}>
                  <span>⚙️</span>
                  <span>Filtres</span>
                  {activeCount > 0 && (
                    <span style={{ background: "var(--accent)", color: "var(--bg)", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".52rem", fontWeight: 800 }}>{activeCount}</span>
                  )}
                </button>
                <button onClick={() => setGlobalSearch(g => !g)} style={{
                  width: 36, height: 36, flexShrink: 0,
                  background: globalSearch ? "var(--accent-glow)" : "var(--surface2)",
                  border: `1px solid ${globalSearch ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 8, fontSize: ".78rem", cursor: "pointer", color: globalSearch ? "var(--accent)" : "var(--text2)", touchAction: "manipulation",
                }}>🌐</button>
              </div>

              {/* Chips filtres actifs */}
              {!showFilterPanel && activePills.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                  {activePills.map((p, i) => (
                    <span key={i} onClick={p.clear} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: ".58rem", padding: "2px 8px", background: "var(--accent-glow)", border: "1px solid var(--accent)", borderRadius: 10, color: "var(--accent)", cursor: "pointer" }}>
                      {p.label} <span style={{ opacity: .7 }}>✕</span>
                    </span>
                  ))}
                  <span onClick={() => { setFilter("all"); setPointFilter("all"); setSort("date"); setMinAmt(""); setMaxAmt(""); setViewMode("list"); onClearPointFilter?.(); }} style={{ fontSize: ".58rem", padding: "2px 8px", background: "transparent", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text3)", cursor: "pointer" }}>
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
                      {[["list","📋 Liste"],["cats","📊 Catégories"],["calendar","📅 Calendrier"]].map(([k,l]) => (
                        <button key={k} onClick={() => setViewMode(k)} style={{
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
          onSelectCat={id => { setCatId(id); setFilter("expense"); setViewMode("list"); }} />
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
                          {isPos ? "+" : ""}{Math.round(net)}€
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
                    {selNet >= 0 ? "+" : ""}{selNet.toFixed(2)} €
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
                        <div style={{ fontSize: ".56rem", color: "var(--text3)", marginTop: 1 }}>{cat?.name ?? "—"}</div>
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
      {viewMode === "list" && catId && (() => {
        const activeCat = categories.find(c => c.id === catId);
        return activeCat ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "6px 12px", background: "var(--accent-glow)", border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)" }}>
            <span style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--accent)", flex: 1 }}>{activeCat.icon} {activeCat.name}</span>
            <button onClick={() => setCatId("")} style={{ background: "transparent", border: "none", color: "var(--accent)", fontSize: ".8rem", cursor: "pointer" }}>✕</button>
          </div>
        ) : null;
      })()}

      {/* ── Liste avec pointage ── */}
      {viewMode === "list" && (
        filtered.length === 0 && filteredOff.length === 0
          ? <EmptyIllustration type="historique" title="Aucun mouvement" sub="Aucune transaction ne correspond à ces filtres" />
          : (
            <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 10 }}>
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
                    {dayOff.map(e => {
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
                              <span style={{ fontSize: ".6rem", color: "var(--text3)" }}>{cat?.name ?? "—"} · {e.date.slice(8)}/{e.date.slice(5, 7)}</span>
                              <span style={{ fontSize: ".5rem", padding: "1px 6px", borderRadius: 8, fontWeight: 800, color: "var(--tr)", background: "var(--tr-glow)", border: "1px solid var(--tr-border)" }}>{st?.icon || "🎫"} Hors compte</span>
                            </div>
                          </div>
                          <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".85rem", color: "var(--tr)", flexShrink: 0 }}>{fmt(e.amount)}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )
      )}

      {/* ── Section récurrentes en attente ── */}
      {/* ── Versements auto à confirmer ── */}
      {viewMode === "list" && !globalSearch && autoSavingsPending.length > 0 && (
        <div className="card" style={{ padding:0, overflow:"hidden", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid var(--border-soft)" }}>
            <div style={{ fontSize:".6rem", fontWeight:800, color:"var(--purple)", textTransform:"uppercase", letterSpacing:".08em" }}>🎯 Épargnes à confirmer</div>
            <span style={{ fontSize:".62rem", color:"var(--text3)" }}>{autoSavingsPending.length}</span>
          </div>
          {autoSavingsPending.map(plan => {
            const cag = cagnottes.find(c => c.id === plan.cagnotteId);
            return (
              <div key={plan.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:"1px solid var(--border-soft)" }}>
                <span style={{ fontSize:"1rem" }}>{cag?.icon||"🐷"}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:".72rem", fontWeight:700 }}>{cag?.name||"—"}</div>
                  <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>{fmt(plan.amount)} · versement mensuel</div>
                </div>
                <div style={{ display:"flex", gap:5 }}>
                  <button
                    onTouchStart={e=>e.stopPropagation()}
                    onTouchEnd={e=>{ e.stopPropagation();e.preventDefault(); onApplyAutoSaving?.(plan.id); }}
                    onClick={() => onApplyAutoSaving?.(plan.id)}
                    style={{ background:"var(--purple)", border:"none", borderRadius:7, padding:"7px 12px", color:"var(--bg)", fontWeight:800, fontSize:".7rem", cursor:"pointer", minHeight:32, touchAction:"manipulation" }}>＋</button>
                  <button
                    onTouchStart={e=>e.stopPropagation()}
                    onTouchEnd={e=>{ e.stopPropagation();e.preventDefault(); onSkipAutoSaving?.(plan.id); }}
                    onClick={() => onSkipAutoSaving?.(plan.id)}
                    style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:7, padding:"7px 10px", color:"var(--text3)", fontSize:".7rem", cursor:"pointer", minHeight:32, touchAction:"manipulation" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Programmées en attente ce mois ── */}
      {viewMode === "list" && !globalSearch && scheduledPending.length > 0 && (
        <div className="card" style={{ padding:0, overflow:"hidden", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid var(--border-soft)" }}>
            <div style={{ fontSize:".6rem", fontWeight:800, color:"var(--warning)", textTransform:"uppercase", letterSpacing:".08em" }}>📅 Programmées ce mois</div>
            <span style={{ fontSize:".62rem", color:"var(--text3)" }}>{scheduledPending.length}</span>
          </div>
          {scheduledPending.map(s => {
            const cat = categories.find(c => c.id === s.categoryId);
            return (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:"1px solid var(--border-soft)" }}>
                <span style={{ fontSize:"1rem" }}>{cat?.icon ?? "📅"}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:".72rem", fontWeight:700 }}>{s.note || cat?.name || "Dépense programmée"}</div>
                  <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>{fmt(s.amount)} · prévu le {s.date.slice(8)}</div>
                </div>
                <div style={{ display:"flex", gap:5 }}>
                  <button
                    onTouchStart={e=>e.stopPropagation()}
                    onTouchEnd={e=>{ e.stopPropagation();e.preventDefault(); onConfirmScheduled?.(s.id); }}
                    onClick={() => onConfirmScheduled?.(s.id)}
                    style={{ background:"var(--warning)", border:"none", borderRadius:7, padding:"7px 12px", color:"var(--bg)", fontWeight:800, fontSize:".7rem", cursor:"pointer", minHeight:32, touchAction:"manipulation" }}>✓</button>
                  <button
                    onTouchStart={e=>e.stopPropagation()}
                    onTouchEnd={e=>{ e.stopPropagation();e.preventDefault(); onDeleteScheduled?.(s.id); }}
                    onClick={() => onDeleteScheduled?.(s.id)}
                    style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:7, padding:"7px 10px", color:"var(--text3)", fontSize:".7rem", cursor:"pointer", minHeight:32, touchAction:"manipulation" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Récurrentes à confirmer ── */}
        <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ padding: "8px 14px", background: "var(--surface2)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: ".6rem", fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".08em" }}>🔄 Récurrentes à confirmer</div>
              <div style={{ fontSize: ".55rem", color: "var(--text3)", marginTop: 2 }}>Opérations habituelles non encore saisies ce mois</div>
            </div>
            <span style={{ fontSize: ".62rem", color: "var(--text3)" }}>{recurringPending.length}</span>
          </div>
          {recurringPending.map(tpl => {
            const cat = categories.find(c => c.id === tpl.categoryId);
            const isInc = isIncome(tpl.type);
            const freqLabel = tpl.frequency === "yearly" ? "Annuelle" : "Mensuelle";
            return (
              <div key={tpl.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border-soft)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1rem" }}>
                  {cat?.icon ?? (isInc ? "💰" : "💸")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: ".74rem", fontWeight: 700 }}>{tpl.label}</div>
                  <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 1 }}>
                    {cat?.name ?? "—"} · <span style={{ color: "var(--accent)" }}>{freqLabel}</span>
                    {tpl.occurrences != null && (() => {
                      const done = transactions.filter(t => t.templateId === tpl.id).length;
                      const left = tpl.occurrences - done;
                      return <span style={{ color: left <= 1 ? "var(--warning)" : "var(--text3)" }}> · {done}/{tpl.occurrences} ({left} restant{left > 1 ? "s" : ""})</span>;
                    })()}
                  </div>
                </div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: ".8rem", color: isInc ? "var(--success)" : "var(--danger)", flexShrink: 0 }}>
                  {isInc ? "+" : "−"}{fmt(tpl.amount)}
                </div>
                <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                  <button
                    onClick={() => onConfirmRecurring?.(tpl, month)}
                    style={{ background: "var(--success)", border: "none", borderRadius: 7, padding: "5px 10px", color: "var(--bg)", fontSize: ".68rem", fontWeight: 800, cursor: "pointer" }}>
                    ＋
                  </button>
                  <button
                    onClick={() => onDeleteRecurring?.(tpl.id)}
                    style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 8px", color: "var(--text3)", fontSize: ".68rem", cursor: "pointer" }}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      {/* ── Section frais fixes ── */}
      {viewMode === "list" && monthFixes.length > 0 && pointFilter !== "pointed" && (        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", background: "var(--surface2)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: ".6rem", fontWeight: 800, color: "var(--warning)", textTransform: "uppercase", letterSpacing: ".08em" }}>📌 Frais fixes du mois</div>
              <div style={{ fontSize: ".55rem", color: "var(--text3)", marginTop: 2 }}>Pointe-les quand ils débitent sur ton compte</div>
            </div>
            <span style={{ fontSize: ".62rem", color: monthFixes.every(f => f.pointedMonths?.[month]) ? "var(--success)" : "var(--warning)", fontWeight: 800 }}>
              {monthFixes.filter(f => f.pointedMonths?.[month]).length}/{monthFixes.length}
            </span>
          </div>
          {(pointFilter === "unpointed"
            ? monthFixes.filter(f => !f.pointedMonths?.[month])
            : monthFixes
          ).length === 0 && pointFilter === "unpointed"
            ? <div style={{ padding:"12px 14px", fontSize:".7rem", color:"var(--success)", textAlign:"center" }}>✅ Tous les frais fixes sont pointés</div>
            : (pointFilter === "unpointed"
                ? monthFixes.filter(f => !f.pointedMonths?.[month])
                : monthFixes
              ).map(f => {
            const cat = (data.categories || []).find(c => c.id === f.categoryId);
            const ov  = f.monthlyOverrides?.[month];  // override du mois si existe
            return (
              <PointRow key={f.id}
                item={{
                  ...f,
                  name:        ov?.name   ?? f.name,
                  amount:      ov?.amount ?? f.amount,
                  cat,
                  date:        null,
                  pointed:     !!f.pointedMonths?.[month],
                  isOverridden: !!ov,
                }}
                onToggle={handleTogglePointFix}
                onEditFixed={handleOverrideFix}
                isFixed={true} />
            );
          })}
          <div style={{ padding: "8px 14px", background: "rgba(200,184,96,.05)", display: "flex", justifyContent: "space-between", fontSize: ".65rem" }}>
            <span style={{ color: "var(--text3)" }}>Total fixes</span>
            <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--warning)" }}>−{fmt(monthFixes.reduce((s,f) => s+(f.amount||0), 0))}</span>
          </div>
        </div>
      )}

      {/* ── Section revenus fixes ── */}
      {viewMode === "list" && monthIncomes.length > 0 && pointFilter !== "pointed" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", background: "var(--surface2)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: ".6rem", fontWeight: 800, color: "var(--success)", textTransform: "uppercase", letterSpacing: ".08em" }}>💰 Revenus fixes du mois</div>
              <div style={{ fontSize: ".55rem", color: "var(--text3)", marginTop: 2 }}>Pointe-les quand ils créditent sur ton compte</div>
            </div>
            <span style={{ fontSize: ".62rem", color: monthIncomes.every(f => f.pointedMonths?.[month]) ? "var(--success)" : "var(--warning)", fontWeight: 800 }}>
              {monthIncomes.filter(f => f.pointedMonths?.[month]).length}/{monthIncomes.length}
            </span>
          </div>
          {(pointFilter === "unpointed"
            ? monthIncomes.filter(f => !f.pointedMonths?.[month])
            : monthIncomes
          ).length === 0 && pointFilter === "unpointed"
            ? <div style={{ padding:"12px 14px", fontSize:".7rem", color:"var(--success)", textAlign:"center" }}>✅ Tous les revenus fixes sont pointés</div>
            : (pointFilter === "unpointed"
                ? monthIncomes.filter(f => !f.pointedMonths?.[month])
                : monthIncomes
              ).map(f => {
            const cat = (data.categories || []).find(c => c.id === f.categoryId);
            const ov  = f.monthlyOverrides?.[month];
            return (
              <PointRow key={f.id}
                item={{
                  ...f,
                  type:        "income",
                  name:        ov?.name   ?? f.name,
                  amount:      ov?.amount ?? f.amount,
                  cat,
                  date:        null,
                  pointed:     !!f.pointedMonths?.[month],
                  isOverridden: !!ov,
                }}
                onToggle={handleTogglePointIncome}
                isFixed={true} />
            );
          })}
          <div style={{ padding: "8px 14px", background: "rgba(104,212,152,.05)", display: "flex", justifyContent: "space-between", fontSize: ".65rem" }}>
            <span style={{ color: "var(--text3)" }}>Total revenus fixes</span>
            <span style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--success)" }}>+{fmt(monthIncomes.reduce((s,f) => s+((f.monthlyOverrides?.[month]?.amount) ?? f.amount ?? 0), 0))}</span>
          </div>
        </div>
      )}
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

// 1. Mini Donut
function HistDonut({ inc, exp, sav }) {
  const total = inc + exp + sav || 1;
  const R = 36, cx = 44, cy = 44, stroke = 10;
  const circ = 2 * Math.PI * R;
  let offset = 0;
  const segs = [
    { pct: inc / total, color: "var(--success)" },
    { pct: exp / total, color: "var(--danger)"  },
    { pct: sav / total, color: "var(--purple)"  },
  ].map(s => {
    const dash = s.pct * circ, gap = circ - dash;
    const rot  = offset * 360 - 90;
    offset    += s.pct;
    return { ...s, dash, gap, rot };
  });
  const net = inc - exp;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="88" height="88" viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--surface3)" strokeWidth={stroke}/>
        {segs.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none"
            stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${s.gap}`}
            transform={`rotate(${s.rot} ${cx} ${cy})`}/>
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="8"  fill="var(--text3)" fontWeight="700">NET</text>
        <text x={cx} y={cy + 7} textAnchor="middle" fontSize="9.5" fill={net >= 0 ? "var(--success)" : "var(--danger)"} fontWeight="800">
          {net >= 0 ? "+" : ""}{Math.round(net)}€
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
        {[
          { l: "💰 Revenus",  v: inc, c: "var(--success)" },
          { l: "💸 Dépenses", v: exp, c: "var(--danger)"  },
          { l: "🐷 Épargne",  v: sav, c: "var(--purple)"  },
        ].map(s => (
          <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.c, flexShrink: 0 }}/>
            <span style={{ fontSize: ".6rem", color: "var(--text2)", flex: 1 }}>{s.l}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: ".63rem", fontWeight: 800, color: s.c, fontVariantNumeric: "tabular-nums" }}>{fmt(s.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. Barre budget
function BudgetBar({ exp, inc }) {
  const pct   = inc > 0 ? Math.min(100, (exp / inc) * 100) : 0;
  const color = pct > 90 ? "var(--danger)" : pct > 70 ? "var(--warning)" : "var(--success)";
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: ".6rem", color: "var(--text2)", fontWeight: 700 }}>
        <span>Budget consommé</span>
        <span style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 6, background: "var(--surface3)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, var(--success), ${color})`, borderRadius: 99, transition: "width .5s ease" }}/>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: ".55rem", color: "var(--text3)" }}>
        <span>0 €</span><span>{fmt(inc)}</span>
      </div>
    </div>
  );
}

// 4. SwipeRow — avec bouton pointage intégré
function SwipeRow({ t, categories, cagnottes, onEdit, onDelete, onTogglePoint, onDuplicate, allTags = [], allSideAmountTypes = [] }) {
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

  const PANEL = 165; // 3 × 55px

  return (
    <div style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--border-soft)" }}>
      {/* Actions cachées — ✏️ 📋 🗑️ */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: PANEL, display: "flex" }}>
        <div onClick={() => { setOffset(0); setRevealed(false); onEdit?.(t.id); }}
          style={{ width: 55, height: "100%", background: "rgba(112,184,224,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", cursor: "pointer" }}>✏️</div>
        <div onClick={() => { setOffset(0); setRevealed(false); onDuplicate?.(t); }}
          style={{ width: 55, height: "100%", background: "rgba(104,212,152,.2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer" }}>
          <span style={{ fontSize: "1rem" }}>📋</span>
          <span style={{ fontSize: ".44rem", color: "var(--success)", fontWeight: 700 }}>Dupliquer</span>
        </div>
        <div onClick={() => { setOffset(0); setRevealed(false); onDelete?.(t.id); }}
          style={{ width: 55, height: "100%", background: "rgba(200,112,112,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", cursor: "pointer" }}>🗑️</div>
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
        onClick={() => { if (revealed) { setOffset(0); setRevealed(false); } }}
        style={{
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
        {/* Bouton pointage — masqué pour decagnottage et transfer, spacer pour alignement */}
        {onTogglePoint && isPointable(t.type) ? (
          <button
            onTouchStart={e => e.stopPropagation()}
            onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); onTogglePoint(t.id); }}
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
                  <span style={{ fontSize: ".6rem", color: "var(--text3)", flexShrink: 0 }}>{cat?.name ?? "—"} · {t.date.slice(8)}/{t.date.slice(5,7)}</span>
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
      </div>
    </div>
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
              background: "var(--surface)", border: "1px solid var(--border)",
              borderLeft: `3px solid ${c.color}`, borderRadius: "var(--radius-sm)",
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
              <div style={{ width: `${(c.net / totalNet * 100).toFixed(0)}%`, height: "100%", background: c.color, borderRadius: 99 }}/>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".55rem", color: "var(--text3)", marginTop: 2 }}>
              <span>{hasOffset ? `Brut : ${fmt(c.exp)}` : ""}</span>
              <span>{(c.net / totalNet * 100).toFixed(0)}% des dépenses nettes</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
