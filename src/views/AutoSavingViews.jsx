// ─────────────────────────────────────────────────────────────────
//  v1.81.0 — Versements automatiques & programmées : réglage, liste,
//  fenêtres de pointage. Moteur (dates, échéances, fin) : hooks.js
//  (autoSavingDate, dueAutoSavings, nextAutoSavings…).
// ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import { fmt, todayISO, daysAgoISO, cagIconOf, DEFAULT_CAG_TYPES } from "../utils.js";
import { Modal, Toggle } from "../components/index.jsx";
import { nextAutoSavings, firstAutoSavingKey, autoSavingCount, autoSavingFinished, mainPayIncome } from "../hooks.js";

const MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const JS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
export const dLbl = iso => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return `${JS[new Date(y, m - 1, d).getDay()]} ${d === 1 ? "1ᵉʳ" : d} ${MS[m - 1]}`; };
const ymLbl = ym => ym ? `${MS[parseInt(ym.slice(5, 7), 10) - 1]} ${ym.slice(0, 4)}` : "";
const ymAdd = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const AFTER = [[0, "Le jour même"], [1, "Le lendemain"], [2, "2 jours après"], [3, "3 jours après"]];

/** « le lendemain de la paie » / « le 5 (décalé au jour ouvré suivant) » */
export function autoSavingWhen(plan) {
  if (plan.mode === "pay") {
    const n = parseInt(plan.afterPay, 10) || 0;
    return n === 0 ? "le jour de la paie" : n === 1 ? "le lendemain de la paie" : `${n} jours après la paie`;
  }
  return `le ${plan.dayOfMonth || 1}${plan.shiftBD ? " (jour ouvré)" : ""}`;
}

const chip = (on, col = "var(--accent)") => ({ fontSize: ".66rem", fontWeight: 700, padding: "6px 10px", borderRadius: 12, cursor: "pointer", touchAction: "manipulation",
  border: `1px solid ${on ? col : "var(--border)"}`, color: on ? col : "var(--text2)", background: on ? `color-mix(in srgb, ${col} 13%, transparent)` : "var(--surface2)" });
const lab = (t, extra) => <div style={{ fontSize: ".56rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent)", margin: "11px 2px 5px" }}>{t}{extra}</div>;
const head = (icon, title, onClose) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
    <span style={{ fontSize: "1.1rem" }}>{icon}</span><b style={{ flex: 1, fontSize: "1rem" }}>{title}</b>
    <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>✕</button>
  </div>
);
const bigBtn = (txt, onClick, kind, testid) => (
  <button data-testid={testid} onClick={onClick} style={{ display: "block", width: "100%", marginTop: 8, padding: 11, borderRadius: 12, fontSize: ".74rem", fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
    background: kind === "ok" ? "#2f9d6a" : kind === "pur" ? "var(--purple)" : "var(--surface2)",
    border: `1px solid ${kind === "ok" ? "#68d498" : kind === "pur" ? "var(--purple)" : kind === "del" ? "color-mix(in srgb, var(--danger) 50%, transparent)" : "var(--border)"}`,
    color: kind === "ok" || kind === "pur" ? "#fff" : kind === "del" ? "var(--danger)" : "var(--text)" }}>{txt}</button>
);

// ─── Réglage d'un versement (création / modification) ───────────────
export function AutoSavingModal({ plan = null, data, onSave, onDelete, onClose }) {
  const cagTypes = data.cagTypes || DEFAULT_CAG_TYPES;
  const hasPay = !!mainPayIncome(data);
  const [cagId, setCagId] = useState(plan?.cagnotteId || "");
  const [amt, setAmt] = useState(plan?.amount != null ? String(plan.amount).replace(".", ",") : "");
  const [mode, setMode] = useState(plan?.mode === "pay" && hasPay ? "pay" : "day");
  const [day, setDay] = useState(parseInt(plan?.dayOfMonth, 10) || 5);
  const [shiftBD, setShiftBD] = useState(plan ? !!plan.shiftBD : true);
  const [afterPay, setAfterPay] = useState(parseInt(plan?.afterPay, 10) || 1);
  const [endYM, setEndYM] = useState(plan?.endYM || "");
  const [customDay, setCustomDay] = useState(false);
  const [customEnd, setCustomEnd] = useState(false);
  const [askDel, setAskDel] = useState(false);
  const cur = todayISO().slice(0, 7);
  const amount = Math.round((parseFloat(String(amt).replace(",", ".")) || 0) * 100) / 100;
  const draft = { ...(plan || {}), cagnotteId: cagId, amount, mode, dayOfMonth: day, shiftBD, afterPay, endYM: endYM || null, enabled: plan ? plan.enabled : true };
  if (!plan) draft.startKey = firstAutoSavingKey(draft, data);
  const next = nextAutoSavings({ ...draft, enabled: true }, data, 3);
  const count = autoSavingCount(draft);
  const ok = cagId && amount > 0;
  const endOpts = [["", "Aucune"], [ymAdd(cur, 5), "Dans 6 mois"], [ymAdd(cur, 11), "Dans 1 an"]];
  const endIsOpt = endOpts.some(([v]) => v === endYM);
  return (
    <Modal onClose={onClose} title="">
      <div data-testid="auto-saving-modal">
        {head("🎯", plan ? "Versement automatique" : "Nouveau versement", onClose)}
        {lab("Cagnotte")}
        <div data-testid="as-cags" style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {(data.cagnottes || []).map(c => (
            <span key={c.id} role="button" data-cag={c.id} style={chip(cagId === c.id, "var(--purple)")} onClick={() => setCagId(c.id)}>{cagIconOf(cagTypes, c)} {c.name}</span>
          ))}
        </div>
        {lab("Montant chaque mois")}
        <input data-testid="as-amount" type="text" inputMode="decimal" placeholder="150" value={amt} onChange={e => setAmt(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", background: "var(--surface2)", border: `1px solid ${amount > 0 ? "var(--purple)" : "var(--border)"}`, borderRadius: 12, padding: "9px 11px", color: "var(--text)", fontSize: ".9rem", fontWeight: 800, fontFamily: "inherit" }} />
        {lab("Quand")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <span role="button" data-testid="as-mode-day" style={{ ...chip(mode === "day", "var(--purple)"), textAlign: "center", padding: 8 }} onClick={() => setMode("day")}>📅 Jour fixe</span>
          <span role="button" data-testid="as-mode-pay" style={{ ...chip(mode === "pay", "var(--purple)"), textAlign: "center", padding: 8, opacity: hasPay ? 1 : .45 }} onClick={() => hasPay && setMode("pay")}>💰 Après la paie</span>
        </div>
        {!hasPay && <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 4 }}>« Après la paie » demande un salaire en revenu fixe avec un jour de versement.</div>}
        {mode === "day" ? <>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
            {[1, 5, 10, 15].map(d => <span key={d} role="button" data-day={d} style={chip(day === d && !customDay)} onClick={() => { setCustomDay(false); setDay(d); }}>Le {d}</span>)}
            {customDay || ![1, 5, 10, 15].includes(day)
              ? <select value={day} onChange={e => setDay(parseInt(e.target.value, 10))} style={{ ...chip(true), fontFamily: "inherit" }}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Le {d}</option>)}
                </select>
              : <span role="button" style={chip(false)} onClick={() => setCustomDay(true)}>Autre…</span>}
          </div>
          <div role="button" data-testid="as-shift" onClick={() => setShiftBD(v => !v)} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, padding: "8px 11px", borderRadius: 12, cursor: "pointer", background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <span style={{ flex: 1, fontSize: ".7rem" }}><b>Décaler au jour ouvré suivant</b>
              <span style={{ display: "block", fontSize: ".58rem", color: "var(--text3)" }}>Si le jour tombe un week-end ou un jour férié (comme ta banque)</span></span>
            <Toggle on={shiftBD} color="var(--purple)" />
          </div>
        </> : <>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
            {AFTER.map(([v, l]) => <span key={v} role="button" data-after={v} style={chip(afterPay === v)} onClick={() => setAfterPay(v)}>{l}</span>)}
          </div>
          <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 5, lineHeight: 1.45 }}>En jours de virement (mardi → vendredi, hors fériés), à partir de la date de ta paie : suit automatiquement ses changements de date.</div>
        </>}
        {lab("Date de fin")}
        <div data-testid="as-end" style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          {endOpts.map(([v, l]) => <span key={l} role="button" data-end={v} style={chip(endYM === v && !customEnd)} onClick={() => { setCustomEnd(false); setEndYM(v); }}>{l}</span>)}
          {customEnd || !endIsOpt
            ? <input type="month" value={endYM} min={cur} onChange={e => setEndYM(e.target.value)} style={{ ...chip(true), fontFamily: "inherit", colorScheme: "dark" }} />
            : <span role="button" style={chip(false)} onClick={() => { setCustomEnd(true); if (!endYM) setEndYM(ymAdd(cur, 2)); }}>Autre…</span>}
        </div>
        {endYM && <div data-testid="as-count" style={{ fontSize: ".62rem", color: "var(--text2)", marginTop: 6 }}>
          Dernier versement en <b style={{ color: "var(--text)" }}>{ymLbl(endYM)}</b>{count != null ? <> · {count} versement{count > 1 ? "s" : ""}{amount > 0 ? <> · <b style={{ color: "var(--purple)" }}>{fmt(count * amount)}</b> au total</> : null}</> : null}. Ensuite, il passe en « Terminé ».
        </div>}
        <div data-testid="as-next" style={{ borderRadius: 13, padding: "9px 11px", marginTop: 10, fontSize: ".64rem", color: "var(--text2)", border: "1px solid color-mix(in srgb, var(--purple) 40%, transparent)", background: "color-mix(in srgb, var(--purple) 7%, var(--surface))" }}>
          {next.length ? <>Prochaines dates : <b style={{ color: "var(--text)" }}>{next.map(x => dLbl(x.date)).join(" · ")}</b></> : "Aucune date à venir (date de fin passée)."}
        </div>
        {bigBtn("Enregistrer", () => { if (ok) onSave(draft); }, ok ? "pur" : null, "as-save")}
        {plan && !askDel && bigBtn("🗑 Supprimer ce versement", () => setAskDel(true), "del")}
        {plan && askDel && bigBtn("Confirmer la suppression (les versements déjà faits restent)", () => onDelete(plan.id), "del", "as-delete")}
      </div>
    </Modal>
  );
}

// ─── Liste (Options › Versements automatiques) ──────────────────────
export function AutoSavingList({ data, onEdit, onNew, onToggle }) {
  const cagTypes = data.cagTypes || DEFAULT_CAG_TYPES;
  const plans = data.autoSavings || [];
  return (
    <div data-testid="auto-saving-list">
      {plans.map(p => {
        const cag = (data.cagnottes || []).find(c => c.id === p.cagnotteId);
        const done = autoSavingFinished(p, data);
        const nx = p.enabled && !done ? nextAutoSavings(p, data, 1)[0] : null;
        return (
          <div key={p.id} data-plan={p.id} role="button" onClick={() => onEdit(p)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, marginBottom: 8, cursor: "pointer",
            background: "var(--surface2)", border: `1px ${done ? "dashed" : "solid"} ${p.enabled && !done ? "rgba(176,144,224,.35)" : "var(--border)"}`, opacity: done || !p.enabled ? .65 : 1 }}>
            <span style={{ fontSize: "1.1rem" }}>{cag ? cagIconOf(cagTypes, cag) : "🐷"}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: "block", fontSize: ".76rem" }}>{cag?.name || "Cagnotte supprimée"} · {fmt(parseFloat(p.amount) || 0)}</b>
              <span style={{ display: "block", fontSize: ".6rem", color: "var(--text2)", lineHeight: 1.4 }}>
                {done ? <>✓ Terminé en {ymLbl(p.endYM)}</> : <>{autoSavingWhen(p)} · {p.endYM ? `jusqu'en ${ymLbl(p.endYM)}` : "sans fin"}</>}
                {nx && <><br />Prochain : <b style={{ color: "var(--text)" }}>{dLbl(nx.date)}</b></>}
              </span>
            </span>
            <span onClick={e => e.stopPropagation()}><Toggle on={p.enabled && !done} color="var(--purple)" onClick={() => onToggle(p, !(p.enabled && !done))} /></span>
          </div>
        );
      })}
      <button data-testid="as-new" onClick={onNew} style={{ width: "100%", background: "transparent", border: "1.5px dashed var(--purple)", borderRadius: 12, padding: 10, color: "var(--purple)", fontWeight: 800, fontSize: ".72rem", cursor: "pointer" }}>＋ Planifier un versement</button>
    </div>
  );
}

// ─── Pointer un versement automatique ───────────────────────────────
export function AutoSavingPointModal({ tx, data, onPoint, onSkip, onClose }) {
  const plan = (data.autoSavings || []).find(p => p.id === tx.autoSavingId);
  const cag = (data.cagnottes || []).find(c => c.id === (tx.targetCagId || plan?.cagnotteId));
  const key = tx.autoSavingKey || (tx.date || "").slice(0, 7);
  return (
    <Modal onClose={onClose} title="">
      <div data-testid="as-point">
        {head("🐷", `Versement de ${fmt(parseFloat(tx.amount) || 0)}`, onClose)}
        <div style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 14, padding: "9px 11px", marginBottom: 8, border: "1px solid color-mix(in srgb, var(--purple) 45%, transparent)", background: "color-mix(in srgb, var(--purple) 7%, var(--surface))", fontSize: ".72rem" }}>
          <span>{cag ? cagIconOf(data.cagTypes || DEFAULT_CAG_TYPES, cag) : "🐷"}</span>
          <span style={{ flex: 1 }}><b>{cag?.name || "Cagnotte"}</b><span style={{ display: "block", fontSize: ".6rem", color: "var(--text2)" }}>prévu le {dLbl(tx.date)} · déjà déduit du solde estimé</span></span>
          <b style={{ color: "var(--purple)", fontVariantNumeric: "tabular-nums" }}>−{fmt(parseFloat(tx.amount) || 0)}</b>
        </div>
        <div style={{ fontSize: ".64rem", color: "var(--text2)" }}>Il apparaît sur ton relevé ?</div>
        {bigBtn("✓ Pointer", () => onPoint(tx.id), "ok", "as-point-ok")}
        {plan && bigBtn(`Pas ce mois-ci (annule ce versement)`, () => onSkip(plan.id, key), null, "as-point-skip")}
        {bigBtn("Plus tard", onClose)}
      </div>
    </Modal>
  );
}

// ─── Pointer une programmée ─────────────────────────────────────────
export function ScheduledPointModal({ tx, data, onPointAt, onCancel, onClose }) {
  const [date, setDate] = useState(tx.date || todayISO());
  const cat = (data.categories || []).find(c => c.id === tx.categoryId);
  const opts = [[tx.date, dLbl(tx.date)], [daysAgoISO(1), "Hier"], [todayISO(), "Aujourd'hui"]].filter((x, i, a) => x[0] && a.findIndex(y => y[0] === x[0]) === i);
  return (
    <Modal onClose={onClose} title="">
      <div data-testid="sch-point">
        {head("📅", `${tx.note || cat?.name || "Programmée"} · ${fmt(parseFloat(tx.amount) || 0)}`, onClose)}
        <div style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 14, padding: "9px 11px", marginBottom: 8, border: "1px solid color-mix(in srgb, var(--accent) 45%, transparent)", background: "color-mix(in srgb, var(--accent) 7%, var(--surface))", fontSize: ".72rem" }}>
          <span>{cat?.icon || "📅"}</span>
          <span style={{ flex: 1 }}><b>{tx.note || cat?.name || "Programmée"}</b><span style={{ display: "block", fontSize: ".6rem", color: "var(--text2)" }}>programmée le {dLbl(tx.date)} · déjà déduite du solde</span></span>
          <b style={{ color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>−{fmt(parseFloat(tx.amount) || 0)}</b>
        </div>
        {lab("Prélevée le")}
        <div data-testid="sch-date" style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {opts.map(([d, l]) => <span key={d} role="button" data-d={d} style={chip(date === d)} onClick={() => setDate(d)}>{l}</span>)}
          <input type="date" value={date} max={todayISO()} onChange={e => e.target.value && setDate(e.target.value)} style={{ ...chip(!opts.some(([d]) => d === date)), fontFamily: "inherit", colorScheme: "dark" }} />
        </div>
        {bigBtn("✓ Pointer", () => onPointAt(tx.id, date), "ok", "sch-point-ok")}
        {bigBtn("Annuler cette dépense", () => onCancel(tx.id), "del", "sch-cancel")}
        {bigBtn("Plus tard", onClose)}
      </div>
    </Modal>
  );
}
