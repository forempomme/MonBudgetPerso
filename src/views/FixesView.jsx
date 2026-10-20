// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
// v1.55.0 : écran refait en « échéancier en tuiles » — barre collée (charges /
// revenus / net, bascule, ＋), avancement du mois, tuiles compactes 3 par ligne
// rangées par statut (passés non pointés / à venir / pointés / en pause /
// commencent plus tard), groupes pliables, pointage direct depuis une tuile.
import { useState, Fragment } from "react";
import { fmt, currentYM, todayISO, resolveFixedDay, fixedDayLabel, fixedOccurrenceYM, fixedCashDateISO, DAY_LAST_BD, DAY_PREV_LAST_BD, fixedAmountFor } from "../utils.js";
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
  // v1.67.0 : revenus comptés dans le budget du mois suivant mais versés CE mois-ci
  const advanceItems = fixedIncomes.filter(f => f.advance).map(f => {
    const occ = fixedOccurrenceYM(f, curYM);
    if (!isActiveForMonth(f, occ)) return null;
    return { f, occ, amt: fixedAmountFor(f, occ), received: !!f.pointedMonths?.[occ], date: fixedCashDateISO(f, occ) };
  }).filter(Boolean);
  const advanceTotal = advanceItems.reduce((s, x) => s + x.amt, 0);
  const advanceAllReceived = advanceItems.length > 0 && advanceItems.every(x => x.received);
  const provTotal    = provisionalExpenses.reduce((s, p) => s + (p.amount || 0), 0);
  const isExp        = activeSection === "depenses";
  const list         = isExp ? fixedExpenses : fixedIncomes;
  const mainColor    = isExp ? "var(--danger)" : "var(--success)";
  const sign         = isExp ? "−" : "+";

  // Éléments enrichis + rangés par groupe
  const items = list.map((f, idx) => {
    const occ = fixedOccurrenceYM(f, curYM);   // occurrence versée ce mois-ci
    const amt = fixedAmountFor(f, occ);
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
  const kp = { borderRadius: 12, padding: "7px 9px", background: "var(--surface)", border: "1px solid var(--border)", minWidth: 0 };
  const kpL = { display: "block", fontSize: ".53rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text3)" };
  const kpV = col => ({ display: "block", fontFamily: "var(--mono)", fontSize: ".8rem", fontWeight: 800, color: col, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" });
  const segBtn = (on, col, bg) => ({ flex: 1, textAlign: "center", fontSize: ".69rem", fontWeight: 800, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer", whiteSpace: "nowrap", background: on ? bg : "transparent", color: on ? col : "var(--text2)" });
  const actBtn = col => ({ fontSize: ".66rem", fontWeight: 800, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: col || "var(--text2)", whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0 });

  // v1.71.0 : ligne de l'échéancier (frise) — bulle du jour à gauche, statut à droite
  const ST = {
    ok:    { txt: "✓",        col: "var(--success)", bub: "color-mix(in srgb, var(--success) 25%, transparent)" },
    late:  { txt: "à pointer", col: "var(--warning)", bub: "color-mix(in srgb, var(--warning) 30%, transparent)" },
    next:  { txt: "à venir",   col: "var(--text2)",   bub: "var(--surface3)" },
    pause: { txt: "en pause",  col: "var(--text3)",   bub: "var(--surface3)" },
    later: { txt: "plus tard", col: "var(--text3)",   bub: "var(--surface3)" },
  };
  const badge = (txt, col, k) => <span key={k} style={{ fontSize: ".5rem", fontWeight: 800, padding: "1px 6px", borderRadius: 7, whiteSpace: "nowrap", color: col, background: `color-mix(in srgb, ${col} 15%, transparent)` }}>{txt}</span>;
  const row = (x, g) => {
    const { f } = x;
    const key = `${activeSection}_${f.id ?? x.idx}`;
    const sel = selected === key;
    const st = ST[g];
    const rise = isExp && f.prevAmount != null && f.prevAmount !== f.amount && f.prevAmountYM !== curYM;
    const bubTxt = g === "pause" ? "⏸" : g === "later" ? "→" : (x.dayNum || "?");
    const badges = [
      f.advance && (g === "ok" || g === "late" || g === "next") ? badge(`→ budget ${ymShort(x.occ)}`, "var(--sapin)", "adv") : null,
      rise ? badge(f.amount > f.prevAmount ? "▲ hausse" : "▼ baisse", f.amount > f.prevAmount ? "var(--danger)" : "var(--success)", "rise") : null,
      !x.dayNum && g !== "pause" && g !== "later" ? badge("jour ?", "var(--warning)", "day") : null,
      g === "pause" ? badge(f.pausedUntil ? `reprise ${ymShort(f.pausedUntil)}` : "sans reprise", "var(--text3)", "pz") : null,
      g === "later" ? badge(`dès ${ymShort(f.startYM)}`, "var(--text3)", "lt") : null,
      x.amt !== (parseFloat(f.amount) || 0) && g !== "pause" && g !== "later" ? badge("✏️ ce mois", "var(--accent)", "ov") : null,
    ].filter(Boolean);
    return (
      <div key={key} style={{ position: "relative", marginBottom: 5 }}>
        <span style={{ position: "absolute", left: -35, top: 6, width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: ".64rem", fontWeight: 800, background: st.bub, color: g === "next" ? "var(--text2)" : st.col, boxShadow: "0 0 0 2px var(--bg)", fontVariantNumeric: "tabular-nums" }}>{bubTxt}</span>
        <div data-tile={key} className="card" onClick={() => { setSelected(sel ? null : key); setDayPick(false); }}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", margin: 0, borderRadius: 12, cursor: "pointer",
            opacity: g === "ok" ? .78 : (g === "pause" || g === "later") ? .6 : 1,
            borderColor: sel ? "var(--accent)" : g === "late" ? "color-mix(in srgb, var(--warning) 45%, transparent)" : undefined }}>
          <span style={{ fontSize: ".95rem", flexShrink: 0 }}>{x.icon}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b style={{ display: "block", fontSize: ".72rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</b>
            {badges.length > 0 && <span style={{ display: "flex", gap: 4, marginTop: 2, overflow: "hidden" }}>{badges}</span>}
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: ".76rem", fontWeight: 800, color: mainColor, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{sign}{fmt(x.amt)}</span>
          <span style={{ fontSize: ".56rem", fontWeight: 800, width: 44, textAlign: "right", color: st.col, flexShrink: 0 }}>{st.txt}</span>
        </div>
        {sel && actionBar(x, g)}
      </div>
    );
  };

  const actionBar = (x, g) => {
    const { f, idx } = x;
    const onPause  = isExp ? onQuickPauseFixed  : onQuickPauseIncome;
    const onEdit   = isExp ? onEditFixed        : onEditFixedIncome;
    const onDelete = isExp ? onDeleteFixed      : onDeleteFixedIncome;
    const onPoint  = isExp ? onTogglePointFix   : onTogglePointIncome;
    const canPoint = g === "late" || g === "next" || g === "ok";
    return (
      <div key="abar" data-testid="fix-actions" onClick={e => e.stopPropagation()}
        style={{ padding: "7px 8px", borderRadius: 12, background: "var(--fab-menu-bg, var(--surface2))", border: "1px solid var(--accent)", margin: "4px 0 6px" }}>
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

  // Sections pliables (mémorisées sur le téléphone) : échéancier du mois, en pause, plus tard
  const section = (gk, title, L, right) => {
    if (!L.length) return null;
    const fk = `${activeSection}_${gk}`;
    const folded = !!fold[fk];
    return (
      <Fragment key={gk}>
        <div data-group={gk} onClick={() => { toggleFold(fk); setSelected(null); }}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".6rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "12px 2px 6px", cursor: "pointer", userSelect: "none" }}>
          <span style={{ width: 12, color: "var(--text2)", fontSize: ".62rem" }}>{folded ? "▸" : "▾"}</span>
          <span>{title}</span>
          <span style={{ fontSize: ".56rem", letterSpacing: 0, textTransform: "none", fontWeight: 700 }}>({L.length})</span>
          {right && <span style={{ marginLeft: "auto", letterSpacing: 0, textTransform: "none", fontSize: ".64rem", fontWeight: 700 }}>{right}</span>}
        </div>
        {!folded && (
          <div style={{ position: "relative", paddingLeft: 36 }}>
            <div style={{ position: "absolute", left: 14, top: 4, bottom: 4, width: 2, borderRadius: 1, background: "var(--border)" }} />
            {L.map(x => row(x, x.st))}
          </div>
        )}
      </Fragment>
    );
  };
  const schedule = [...byGroup.late, ...byGroup.next, ...byGroup.ok].sort((a, b) => (a.dayNum || 99) - (b.dayNum || 99));
  const [cy, cm] = curYM.split("-").map(Number);
  const lastDay = new Date(cy, cm, 0).getDate();
  const dayPct = d => ((Math.min(d, lastDay) - 1) / Math.max(1, lastDay - 1)) * 100;

  return (
    <div>
      {/* ── Charges / revenus / net + bascule + ＋ (v1.71.0 : plus collé, cartes du thème) ── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 7 }}>
          <div style={kp}><small style={kpL}>Charges</small><b style={kpV("var(--danger)")}>−{fmt(totalFixes)}</b></div>
          <div style={kp} data-testid="fix-kpi-income"><small style={kpL}>Revenus{advanceItems.length ? ` ${MONTHS_SHORT_FR[parseInt(curYM.slice(5, 7), 10) - 1]}` : ""}</small><b style={kpV("var(--success)")}>+{fmt(totalIncomes)}</b>
            {advanceItems.length > 0 && <i style={{ display: "block", fontStyle: "normal", fontSize: ".52rem", fontWeight: 700, color: "var(--sapin)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>+{fmt(Math.round(advanceTotal)).replace(",00", "")} {advanceAllReceived ? "reçus" : "attendus"} → {ymShort(advanceItems[0].occ)}</i>}
          </div>
          <div style={kp}><small style={kpL}>Net / mois</small><b style={kpV(net >= 0 ? "var(--success)" : "var(--danger)")}>{net >= 0 ? "+" : "−"}{fmt(Math.abs(net))}</b></div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", flex: 1, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 11, padding: 3, gap: 3 }}>
            <button style={segBtn(isExp, "var(--danger)", "rgba(200,112,112,.2)")} onClick={() => { setActiveSection("depenses"); setSelected(null); }}>📌 Charges ({fixedExpenses.length})</button>
            <button style={segBtn(!isExp, "var(--success)", "rgba(104,212,152,.18)")} onClick={() => { setActiveSection("revenus"); setSelected(null); }}>💰 Revenus ({fixedIncomes.length})</button>
          </div>
          <button aria-label={isExp ? "Ajouter une charge fixe" : "Ajouter un revenu fixe"} onClick={isExp ? onNewFixed : onNewFixedIncome}
            style={{ height: 36, minWidth: 44, padding: "0 13px", borderRadius: 11, border: "1px solid var(--btn-pri-border, var(--accent))", background: "var(--btn-pri-bg, var(--accent))", color: "var(--btn-pri-text, #06121c)", fontSize: ".95rem", fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>＋</button>
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
                <span style={{ flex: 1 }}>{monthName} : <b>{doneCount}/{active.length}</b> {isExp ? "prélevés" : "reçus"} <span style={{ color: "var(--text3)", fontSize: ".62rem" }}>· {pct} %</span></span>
                <span style={{ color: "var(--text2)", whiteSpace: "nowrap" }}>{isExp ? "reste à prélever" : "reste à recevoir"} <b style={{ fontFamily: "var(--mono)", color: mainColor, fontVariantNumeric: "tabular-nums" }}>{fmt(remaining)}</b></span>
              </div>
              {/* v1.71.0 : frise du mois — un point par échéance, trait = aujourd'hui */}
              <div data-testid="fix-frise" style={{ position: "relative", height: 26, marginTop: 7 }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: 11, height: 3, borderRadius: 2, background: "var(--surface3)" }} />
                <div style={{ position: "absolute", left: 0, width: `${dayPct(todayDay)}%`, top: 11, height: 3, borderRadius: 2, background: "linear-gradient(90deg,var(--success),var(--accent))" }} />
                {[...schedule].filter(x => x.dayNum).sort((a, b) => (a.st === "ok") - (b.st === "ok")).reverse().map(x => {
                  const okd = x.st === "ok", sz = okd ? 11 : 14;
                  return <span key={x.f.id ?? x.idx} title={`${x.f.name} · le ${x.dayNum}`} style={{ position: "absolute", left: `calc(${dayPct(x.dayNum)}% - ${sz / 2}px)`, top: 12.5 - sz / 2, width: sz, height: sz, borderRadius: "50%",
                    background: okd ? "var(--success)" : x.st === "late" ? "var(--warning)" : "color-mix(in srgb, var(--warning) 55%, var(--surface3))", border: "2px solid var(--bg)" }} />;
                })}
                <span data-testid="fix-today" style={{ position: "absolute", left: `calc(${dayPct(todayDay)}% - 1px)`, top: 0, bottom: 0, width: 2, borderRadius: 1, background: "var(--accent)" }} />
              </div>
              <div style={{ position: "relative", height: 12, fontSize: ".54rem", color: "var(--text3)", fontVariantNumeric: "tabular-nums" }}>
                {[1, 10, 20, lastDay].map(d => <span key={d} style={{ position: "absolute", left: `${dayPct(d)}%`, transform: d === 1 ? "none" : d === lastDay ? "translateX(-100%)" : "translateX(-50%)" }}>{d}</span>)}
              </div>
              {!isExp && advanceItems.map(x => (
                <div key={x.f.id} data-testid="fix-advance-note" style={{ fontSize: ".6rem", color: "var(--text2)", marginTop: 6 }}>
                  💼 {x.f.name} versé le {x.date ? `${parseInt(x.date.slice(8, 10), 10)} ${MONTHS_SHORT_FR[parseInt(x.date.slice(5, 7), 10) - 1]}` : "ce mois-ci"} : compté dans le budget de <b style={{ color: "var(--sapin)" }}>{MONTHS_LONG_FR[parseInt(x.occ.slice(5, 7), 10) - 1].toLowerCase()}</b>.
                </div>
              ))}
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

      {/* ── Échéancier du mois, rangé par jour (v1.71.0) ── */}
      {section("sched", "📅 Échéancier", schedule, byGroup.late.length > 0 ? <span style={{ color: "var(--warning)" }}>{byGroup.late.length} à pointer</span> : null)}
      {section("pause", "⏸️ En pause", byGroup.pause)}
      {section("later", "🗓️ Commencent plus tard", byGroup.later)}

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
          {provisionalExpenses.map(p => {
            const key = `p_${p.id}`, sel = selected === key;
            return (
              <div key={key} style={{ marginBottom: 5 }}>
                <div className="card" data-prov={p.id} onClick={() => setSelected(sel ? null : key)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", margin: 0, borderRadius: 12, cursor: "pointer", borderColor: sel ? "var(--accent)" : undefined }}>
                  <span style={{ fontSize: ".95rem" }}>📋</span>
                  <b style={{ flex: 1, minWidth: 0, fontSize: ".72rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</b>
                  <span style={{ fontFamily: "var(--mono)", fontSize: ".76rem", fontWeight: 800, color: "var(--warning)", whiteSpace: "nowrap" }}>−{fmt(p.amount)}</span>
                </div>
                {sel && (
                  <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 8px", borderRadius: 12, background: "var(--fab-menu-bg, var(--surface2))", border: "1px solid var(--accent)", margin: "4px 0 6px" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: ".66rem", color: "var(--text2)" }}>Déduite du solde estimé</span>
                    <button style={actBtn("var(--danger)")} onClick={() => { onDeleteProvisional(p.id); setSelected(null); }}>🗑 Supprimer</button>
                  </div>
                )}
              </div>
            );
          })}
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
