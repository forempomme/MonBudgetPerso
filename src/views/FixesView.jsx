// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
// v1.55.0 : écran refait en « échéancier en tuiles » — barre collée (charges /
// revenus / net, bascule, ＋), avancement du mois, tuiles compactes 3 par ligne
// rangées par statut (passés non pointés / à venir / pointés / en pause /
// commencent plus tard), groupes pliables, pointage direct depuis une tuile.
import { useState, useEffect, Fragment } from "react";
import { fmt, currentYM, todayISO, resolveFixedDay, fixedDayLabel, fixedOccurrenceYM, DAY_LAST_BD, DAY_PREV_LAST_BD } from "../utils.js";
import { effectiveFixesForMonth, effectiveIncomesForMonth, isActiveForMonth } from "../hooks.js";
import { EmptyIllustration } from "./shared.jsx";
import { InsightsList } from "./InsightPanels.jsx";

const FOLD_KEY = "fixes_fold_v1";
const MONTHS_SHORT_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_LONG_FR  = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const ymShort = ym => { if (!ym) return ""; const [y, m] = ym.split("-").map(Number); return `${MONTHS_SHORT_FR[m - 1]}${y !== new Date().getFullYear() ? " " + String(y).slice(2) : ""}`; };

// Classe un frais/revenu fixe pour le mois courant (source : isActiveForMonth + pointedMonths)
//   late  : jour passé (ou aujourd'hui), pas encore pointé
//   next  : à venir ce mois (ou jour non renseigné), pas pointé
//   ok    : pointé ce mois
//   pause : en pause ce mois
//   later : commence un mois futur (startYM)
// v1.64.0 : `ym` = mois du compte ; un revenu compté dans le budget du mois suivant
// présente ici l'occurrence de M+1 (versée en M). Jours « ouvrés » résolus.
export function fixedStatusForMonth(f, ym, todayDay) {
  const occ = fixedOccurrenceYM(f, ym);
  if (!isActiveForMonth(f, occ)) return (f.startYM && occ < f.startYM) ? "later" : "pause";
  if (f.pointedMonths?.[occ]) return "ok";
  const d = resolveFixedDay(f.day, ym);
  if (!d) return "next";
  return d <= todayDay ? "late" : "next";
}

const GROUPS = [
  { g: "late",  title: "⏳ Passés, pas encore pointés", color: "var(--warning)" },
  { g: "next",  title: "📅 À venir ce mois",            color: "var(--text2)" },
  { g: "ok",    title: "✓ Déjà pointés",                color: "var(--success)" },
  { g: "pause", title: "⏸️ En pause",                   color: "var(--text3)", noTotal: true },
  { g: "later", title: "🗓️ Commencent plus tard",       color: "var(--text3)", noTotal: true },
];

export function FixesView({ data, onNewFixed, onEditFixed, onDeleteFixed, onQuickPauseFixed, onNewFixedIncome, onEditFixedIncome, onDeleteFixedIncome, onQuickPauseIncome, onTogglePointFix, onTogglePointIncome, onSetFixedDay, onSaveProvisional, onDeleteProvisional, insights = [], onDismissInsight, onUpdateRecurringInsight, onCreateFixedInsight }) {
  const { fixedExpenses, categories } = data;
  const fixedIncomes        = data.fixedIncomes || [];
  const provisionalExpenses = data.provisionalExpenses || [];
  const [selected,      setSelected]      = useState(null);
  const [activeSection, setActiveSection] = useState("depenses");
  const [showInsights,  setShowInsights]  = useState(false);
  const [dayPick,       setDayPick]       = useState(false);   // v1.58.0 : grille 1–31 ouverte sous la tuile
  const [showProvForm,  setShowProvForm]  = useState(false);
  const [provName,      setProvName]      = useState("");
  const [provAmt,       setProvAmt]       = useState("");
  const [provErr,       setProvErr]       = useState({});
  // Groupes pliés — mémorisés sur le téléphone (tout déplié par défaut)
  const [fold, setFold] = useState(() => { try { return JSON.parse(localStorage.getItem(FOLD_KEY)) || {}; } catch { return {}; } });
  const toggleFold = key => setFold(o => {
    const n = { ...o, [key]: !o[key] };
    try { localStorage.setItem(FOLD_KEY, JSON.stringify(n)); } catch { /* stockage indisponible : on garde en mémoire */ }
    return n;
  });

  const curYM    = currentYM();
  const todayDay = parseInt(todayISO().slice(8, 10), 10);
  const totalFixes   = effectiveFixesForMonth(fixedExpenses, curYM);
  const totalIncomes = effectiveIncomesForMonth(fixedIncomes, curYM);
  const net          = totalIncomes - totalFixes;
  const provTotal    = provisionalExpenses.reduce((s, p) => s + (p.amount || 0), 0);
  const isExp        = activeSection === "depenses";
  const list         = isExp ? fixedExpenses : fixedIncomes;
  const mainColor    = isExp ? "var(--danger)" : "var(--success)";
  const sign         = isExp ? "−" : "+";

  // Barre collée sous l'en-tête (même principe que l'Historique, le Rapport et les Cagnottes)
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    const h = document.querySelector(".bp-header");
    const upd = () => setStickyTop(h ? Math.round(h.getBoundingClientRect().height) : 0);
    upd(); window.addEventListener("resize", upd);
    const ro = typeof ResizeObserver !== "undefined" && h ? new ResizeObserver(upd) : null;
    ro?.observe(h);
    return () => { window.removeEventListener("resize", upd); ro?.disconnect(); };
  }, []);

  // Éléments enrichis + rangés par groupe
  const items = list.map((f, idx) => {
    const occ = fixedOccurrenceYM(f, curYM);   // occurrence versée ce mois-ci
    const ov  = f.monthlyOverrides?.[occ];
    const amt = parseFloat(ov?.amount ?? f.amount) || 0;
    return { f, idx, amt, occ, dayNum: resolveFixedDay(f.day, curYM), st: fixedStatusForMonth(f, curYM, todayDay), icon: categories.find(c => c.id === f.categoryId)?.icon ?? (isExp ? "📌" : "💰") };
  });
  const byGroup = {};
  GROUPS.forEach(({ g }) => { byGroup[g] = items.filter(x => x.st === g).sort((a, b) => (a.dayNum || 99) - (b.dayNum || 99)); });
  const active    = items.filter(x => x.st === "late" || x.st === "next" || x.st === "ok");
  const doneCount = byGroup.ok.length;
  const remaining = [...byGroup.late, ...byGroup.next].reduce((s, x) => s + x.amt, 0);
  const pct       = active.length ? Math.round(doneCount / active.length * 100) : 0;
  const monthName = MONTHS_LONG_FR[parseInt(curYM.slice(5, 7), 10) - 1];

  function handleAddProv() {
    const e = {};
    if (!provName.trim()) e.name = "Nom requis";
    const a = parseFloat(provAmt);
    if (!provAmt || isNaN(a) || a <= 0) e.amt = "Montant requis > 0";
    setProvErr(e);
    if (Object.keys(e).length) return;
    onSaveProvisional({ name: provName.trim(), amount: a });
    setProvName(""); setProvAmt(""); setProvErr({}); setShowProvForm(false);
  }

  // ── Styles ──
  const kp = { borderRadius: 9, padding: "5px 8px", background: "var(--surface2)", border: "1px solid var(--border-soft)", minWidth: 0 };
  const kpL = { display: "block", fontSize: ".53rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text3)" };
  const kpV = col => ({ display: "block", fontFamily: "var(--mono)", fontSize: ".8rem", fontWeight: 800, color: col, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" });
  const segBtn = (on, col, bg) => ({ flex: 1, textAlign: "center", fontSize: ".69rem", fontWeight: 800, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer", whiteSpace: "nowrap", background: on ? bg : "transparent", color: on ? col : "var(--text2)" });
  const grid = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 };
  const actBtn = col => ({ fontSize: ".66rem", fontWeight: 800, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: col || "var(--text2)", whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0 });

  const tile = ({ key, icon, name, amount, dayLabel, dot, top, late, dim, extra }) => (
    <div key={key} data-tile={key} onClick={() => { setSelected(selected === key ? null : key); setDayPick(false); }}
      style={{
        position: "relative", minWidth: 0, cursor: "pointer", textAlign: "center",
        background: late ? "rgba(200,184,96,.07)" : "var(--surface)", border: "1px solid var(--border)", borderTop: `3px solid ${top}`,
        borderRadius: 10, padding: "4px 6px 5px", opacity: dim ? .5 : 1,
        outline: selected === key ? "2px solid var(--accent)" : "none", outlineOffset: 1,
      }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 16 }}>
        <span style={{ fontSize: ".53rem", fontWeight: 800, color: "var(--text3)", minWidth: 28, textAlign: "left", whiteSpace: "nowrap" }}>{dayLabel}</span>
        <span style={{ fontSize: ".82rem", lineHeight: 1 }}>{icon}</span>
        <span style={{ minWidth: 28, display: "flex", justifyContent: "flex-end" }}>{dot && <i style={{ width: 7, height: 7, borderRadius: "50%", background: dot, display: "block" }} />}</span>
      </div>
      <div style={{ fontSize: ".66rem", fontWeight: 700, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: ".69rem", fontWeight: 800, color: top, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        {amount}{extra}
      </div>
    </div>
  );

  const actionBar = (x, g) => {
    const { f, idx } = x;
    const onPause  = isExp ? onQuickPauseFixed  : onQuickPauseIncome;
    const onEdit   = isExp ? onEditFixed        : onEditFixedIncome;
    const onDelete = isExp ? onDeleteFixed      : onDeleteFixedIncome;
    const onPoint  = isExp ? onTogglePointFix   : onTogglePointIncome;
    const canPoint = g === "late" || g === "next" || g === "ok";
    return (
      <div key="abar" data-testid="fix-actions" onClick={e => e.stopPropagation()}
        style={{ gridColumn: "1 / -1", padding: "7px 8px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--accent)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: ".69rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.icon} {f.name}</span>
          {canPoint && f.id && (
            <button style={actBtn(g === "ok" ? "var(--text2)" : "var(--success)")}
              onClick={() => { onPoint?.(f.id, x.occ); setSelected(null); }}>
              {g === "ok" ? "↩ Dépointer" : "✓ Pointer"}
            </button>
          )}
          {onSetFixedDay && f.id && (
            <button data-testid="fix-day-btn" style={{ ...actBtn(f.day ? undefined : "var(--warning)"), ...(f.day ? {} : { borderColor: "var(--warning)" }) }}
              onClick={() => setDayPick(v => !v)}>📅 {f.day ? (parseInt(f.day, 10) > 0 ? `Le ${f.day}` : fixedDayLabel(f.day, { long: true }).replace("Avant-dernier jour", "Av.-dern. j.").replace("Dernier jour", "Dern. j.")) : "Jour ?"}</button>
          )}
          {g !== "later" && <button style={actBtn()} title={f.paused ? "Reprendre" : "Mettre en pause"} onClick={() => onPause?.(idx)}>{f.paused ? "▶️" : "⏸️"}</button>}
          <button style={actBtn()} onClick={() => onEdit(idx)}>✏️</button>
          <button style={actBtn("var(--danger)")} onClick={() => { onDelete(idx); setSelected(null); }}>🗑</button>
        </div>
        {f.advance && (
          <div data-testid="fix-advance-badge" style={{ fontSize: ".6rem", color: "var(--text2)", marginTop: 6 }}>
            <span style={{ fontWeight: 800, padding: "2px 7px", borderRadius: 8, background: "rgba(88,192,144,.15)", color: "var(--sapin)" }}>→ budget {ymShort(x.occ)}</span>{" "}
            versé ce mois-ci, compté dans le budget du mois suivant
          </div>
        )}
        {dayPick && onSetFixedDay && f.id && (
          <div data-testid="fix-day-grid" style={{ marginTop: 7 }}>
            <div style={{ fontSize: ".6rem", color: "var(--text2)", marginBottom: 5 }}>Jour de {isExp ? "prélèvement" : "versement"} :</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4 }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(n => {
                const on = parseInt(f.day, 10) === n;
                return (
                  <button key={n} onClick={() => { onSetFixedDay(isExp ? "expense" : "income", f.id, n); setDayPick(false); }}
                    style={{ fontSize: ".7rem", fontWeight: 700, padding: "6px 0", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
                      border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "rgba(112,184,224,.2)" : "var(--surface)", color: on ? "var(--accent)" : "var(--text)" }}>{n}</button>
                );
              })}
            </div>
            {/* v1.64.0 : règles « jour ouvré » (week-ends et jours fériés sautés) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginTop: 5 }}>
              {[[DAY_LAST_BD, "Dernier jour ouvré"], [DAY_PREV_LAST_BD, "Avant-dernier jour ouvré"]].map(([v, l]) => {
                const on = parseInt(f.day, 10) === v;
                return (
                  <button key={v} data-testid={`fix-day-rule-${-v}`} onClick={() => { onSetFixedDay(isExp ? "expense" : "income", f.id, v); setDayPick(false); }}
                    style={{ fontSize: ".64rem", fontWeight: 700, padding: "7px 2px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                      border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "rgba(112,184,224,.2)" : "var(--surface)", color: on ? "var(--accent)" : "var(--text)" }}>{l}</button>
                );
              })}
            </div>
            <div style={{ fontSize: ".56rem", color: "var(--text3)", marginTop: 5 }}>
              {parseInt(f.day, 10) < 0 && <>Ce mois-ci : le {resolveFixedDay(f.day, curYM)} · </>}Le 29, 30 ou 31 tombe le dernier jour des mois plus courts.
            </div>
          </div>
        )}
        {(g === "pause" || g === "later" || x.amt !== (parseFloat(f.amount) || 0)) && (
          <div style={{ fontSize: ".6rem", color: "var(--text2)", marginTop: 5, lineHeight: 1.45 }}>
            {g === "pause" && <>⏸️ En pause depuis {ymShort(f.pausedFrom) || "?"} · {f.pausedUntil ? `reprend automatiquement après ${ymShort(f.pausedUntil)}` : "aucune reprise programmée"}</>}
            {g === "later" && <>🗓️ Commence en {ymShort(f.startYM)}</>}
            {g !== "pause" && g !== "later" && <>✏️ Montant corrigé pour ce mois : {fmt(x.amt)} (habituellement {fmt(parseFloat(f.amount) || 0)})</>}
          </div>
        )}
      </div>
    );
  };

  const group = ({ g, title, color, noTotal }) => {
    const L = byGroup[g];
    if (!L.length) return null;
    const fk = `${activeSection}_${g}`;
    const folded = !!fold[fk];
    const cells = L.map(x => {
      const key = `${activeSection}_${x.f.id ?? x.idx}`;
      const rise = isExp && x.f.prevAmount != null && x.f.prevAmount !== x.f.amount && x.f.prevAmountYM !== curYM;
      return {
        key, x,
        el: tile({
          key, icon: x.icon, name: x.f.name, amount: fmt(x.amt), top: mainColor,
          dayLabel: g === "pause" ? (x.f.pausedUntil ? `→ ${ymShort(x.f.pausedUntil)}` : "⏸️") : g === "later" ? `dès ${ymShort(x.f.startYM)}` : (x.dayNum ? `le ${x.dayNum}` : <span style={{ color: "var(--warning)" }}>jour ?</span>),
          dot: g === "ok" ? "var(--success)" : (g === "pause" || g === "later") ? "var(--text3)" : "var(--warning)",
          late: g === "late", dim: g === "pause" || g === "later",
          extra: rise ? <span style={{ marginLeft: 3, fontSize: ".53rem", color: x.f.amount > x.f.prevAmount ? "var(--danger)" : "var(--success)" }}>{x.f.amount > x.f.prevAmount ? "▲" : "▼"}</span> : null,
        }),
      };
    });
    const out = cells.map(c => c.el);
    const si = cells.findIndex(c => c.key === selected);
    if (si >= 0) out.splice(Math.min(Math.floor(si / 3) * 3 + 3, out.length), 0, actionBar(cells[si].x, g));
    return (
      <Fragment key={g}>
        <div data-group={g} onClick={() => { toggleFold(fk); setSelected(null); }}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".6rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "12px 2px 6px", cursor: "pointer", userSelect: "none" }}>
          <span style={{ width: 12, color: "var(--text2)", fontSize: ".62rem" }}>{folded ? "▸" : "▾"}</span>
          <span>{title}</span>
          <span style={{ fontSize: ".56rem", letterSpacing: 0, textTransform: "none", fontWeight: 700 }}>({L.length})</span>
          {!noTotal && <span style={{ marginLeft: "auto", letterSpacing: 0, fontSize: ".69rem", fontFamily: "var(--mono)", color, fontVariantNumeric: "tabular-nums" }}>{sign}{fmt(L.reduce((s, x) => s + x.amt, 0))}</span>}
        </div>
        {!folded && <div style={grid}>{out}</div>}
      </Fragment>
    );
  };

  return (
    <div>
      {/* ── Barre collée : charges / revenus / net + bascule + ＋ ── */}
      <div style={{ position: "sticky", top: stickyTop, zIndex: 50, background: "var(--bg)", margin: "-16px -16px 10px", padding: "8px 16px", borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 7 }}>
          <div style={kp}><small style={kpL}>Charges</small><b style={kpV("var(--danger)")}>−{fmt(totalFixes)}</b></div>
          <div style={kp}><small style={kpL}>Revenus</small><b style={kpV("var(--success)")}>+{fmt(totalIncomes)}</b></div>
          <div style={kp}><small style={kpL}>Net / mois</small><b style={kpV(net >= 0 ? "var(--success)" : "var(--danger)")}>{net >= 0 ? "+" : "−"}{fmt(Math.abs(net))}</b></div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", flex: 1, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 11, padding: 3, gap: 3 }}>
            <button style={segBtn(isExp, "var(--danger)", "rgba(200,112,112,.2)")} onClick={() => { setActiveSection("depenses"); setSelected(null); }}>📌 Charges ({fixedExpenses.length})</button>
            <button style={segBtn(!isExp, "var(--success)", "rgba(104,212,152,.18)")} onClick={() => { setActiveSection("revenus"); setSelected(null); }}>💰 Revenus ({fixedIncomes.length})</button>
          </div>
          <button aria-label={isExp ? "Ajouter une charge fixe" : "Ajouter un revenu fixe"} onClick={isExp ? onNewFixed : onNewFixedIncome}
            style={{ height: 36, minWidth: 36, padding: "0 11px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#06121c", fontSize: ".8rem", fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>＋</button>
        </div>
      </div>

      {list.length === 0 ? (
        isExp
          ? <EmptyIllustration type="fixes" title="Aucune charge fixe" sub="Ajoute tes charges récurrentes pour les déduire automatiquement" cta="+ Ajouter" onCta={onNewFixed} ctaColor="var(--danger)" />
          : <EmptyIllustration type="fixes" title="Aucun revenu fixe" sub="Ajoute tes revenus récurrents (salaire, loyer perçu…)" cta="+ Ajouter" onCta={onNewFixedIncome} ctaColor="var(--success)" />
      ) : (
        <>
          {/* ── Avancement du mois ── */}
          {active.length > 0 && (
            <div className="card" data-testid="fix-progress" style={{ padding: "9px 11px", marginBottom: 9 }}>
              <div style={{ display: "flex", fontSize: ".72rem", gap: 6 }}>
                <span style={{ flex: 1 }}>{monthName} : <b>{doneCount}/{active.length}</b> {isExp ? "prélevés" : "reçus"}</span>
                <span style={{ color: "var(--text2)", whiteSpace: "nowrap" }}>{isExp ? "reste à prélever" : "reste à recevoir"} <b style={{ fontFamily: "var(--mono)", color: mainColor, fontVariantNumeric: "tabular-nums" }}>{fmt(remaining)}</b></span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: "var(--surface3)", overflow: "hidden", marginTop: 6 }}>
                <i style={{ display: "block", height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,var(--success),var(--accent))" }} />
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 🔍 Repéré pour toi : une ligne, détail au toucher ── */}
      {insights.length > 0 && (
        <>
          <div data-testid="insights-line" onClick={() => setShowInsights(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", marginBottom: showInsights ? 8 : 0, borderRadius: 13, border: "1px solid rgba(112,184,224,.45)", background: "rgba(112,184,224,.06)", fontSize: ".69rem", cursor: "pointer" }}>
            <span>🔍</span>
            <span style={{ flex: 1 }}>{insights.length} élément{insights.length > 1 ? "s" : ""} repéré{insights.length > 1 ? "s" : ""} pour toi</span>
            <b style={{ color: "var(--accent)" }}>{showInsights ? "Masquer ▴" : "Voir ›"}</b>
          </div>
          {showInsights && (
            <InsightsList items={insights} categories={categories}
              onDismiss={onDismissInsight} onUpdateRecurring={onUpdateRecurringInsight} onCreateFixed={onCreateFixedInsight} />
          )}
        </>
      )}

      {/* ── Groupes de l'échéancier ── */}
      {GROUPS.map(group)}

      {/* ── 🔮 Prévisions ponctuelles (dépenses seulement) ── */}
      {isExp && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".6rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "14px 2px 6px" }}>
            <span>🔮 Prévisions ponctuelles</span>
            {provTotal > 0 && <span style={{ letterSpacing: 0, fontFamily: "var(--mono)", fontSize: ".69rem", color: "var(--warning)" }}>−{fmt(provTotal)}</span>}
            <span onClick={() => setShowProvForm(v => !v)} style={{ marginLeft: "auto", letterSpacing: 0, textTransform: "none", fontSize: ".69rem", color: "var(--accent)", cursor: "pointer" }}>{showProvForm ? "Annuler" : "＋ prévision"}</span>
          </div>
          {provisionalExpenses.length === 0 && !showProvForm && (
            <div style={{ fontSize: ".64rem", color: "var(--text3)", padding: "0 2px" }}>Dépenses ponctuelles à venir — déduites du solde estimé.</div>
          )}
          {provisionalExpenses.length > 0 && (() => {
            const out = provisionalExpenses.map(p => tile({ key: `p_${p.id}`, icon: "📋", name: p.name, amount: fmt(p.amount), top: "var(--warning)", dayLabel: "", dot: null }));
            const si = provisionalExpenses.findIndex(p => `p_${p.id}` === selected);
            if (si >= 0) {
              const p = provisionalExpenses[si];
              out.splice(Math.min(Math.floor(si / 3) * 3 + 3, out.length), 0,
                <div key="abar" onClick={e => e.stopPropagation()} style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 6, padding: "7px 8px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--accent)" }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: ".69rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📋 {p.name} · déduite du solde estimé</span>
                  <button style={actBtn("var(--danger)")} onClick={() => { onDeleteProvisional(p.id); setSelected(null); }}>🗑</button>
                </div>);
            }
            return <div style={grid}>{out}</div>;
          })()}
          {showProvForm && (
            <div className="card" style={{ padding: 14, marginTop: 8, borderLeft: "3px solid var(--warning)", background: "var(--warning-glow)" }}>
              <div className="form-group">
                <label>Nom</label>
                <input type="text" value={provName} placeholder="Ex : Réparation voiture"
                  className={provErr.name ? "error" : ""}
                  onChange={e => { setProvName(e.target.value); setProvErr(v => ({ ...v, name: "" })); }} />
                {provErr.name && <div className="field-error">⚠ {provErr.name}</div>}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Montant (€)</label>
                <input type="number" step="0.01" min="0" value={provAmt}
                  className={provErr.amt ? "error" : ""}
                  onChange={e => { setProvAmt(e.target.value); setProvErr(v => ({ ...v, amt: "" })); }} />
                {provErr.amt && <div className="field-error">⚠ {provErr.amt}</div>}
              </div>
              <button className="btn btn-primary" style={{ width: "100%", marginTop: 12, background: "var(--warning)" }} onClick={handleAddProv}>
                Ajouter
              </button>
            </div>
          )}
        </>
      )}
      <div style={{ height: 12 }} />
    </div>
  );
}
