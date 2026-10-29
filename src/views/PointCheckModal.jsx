// ─────────────────────────────────────────────────────────────────
//  v1.80.0 — Contrôle au pointage (Historique)
//  Fenêtre ouverte quand on pointe une opération qui mérite une vérif :
//  chèque (date d'encaissement), remboursement attendu / reçu non pointé,
//  dépense d'origine non pointée, doublon déjà pointé. Voir pointCheck (hooks.js).
// ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import { fmt, todayISO, daysAgoISO, txLabel } from "../utils.js";
import { Modal, Toggle } from "../components/index.jsx";
import { dupKey } from "../hooks.js";

const MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const JS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const dLbl = iso => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return `${JS[new Date(y, m - 1, d).getDay()]} ${d} ${MS[m - 1]}`; };

function DateChips({ value, onChange, testid }) {
  const [custom, setCustom] = useState(false);
  const opts = [["Aujourd'hui", todayISO()], ["Hier", daysAgoISO(1)], ["Avant-hier", daysAgoISO(2)]];
  const isOpt = opts.some(([, d]) => d === value);
  const chip = on => ({ fontSize: ".66rem", fontWeight: 700, padding: "6px 10px", borderRadius: 11, cursor: "pointer", touchAction: "manipulation",
    border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, color: on ? "var(--accent)" : "var(--text2)",
    background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface2)" });
  return (
    <div data-testid={testid} style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
      {opts.map(([l, d]) => <span key={l} role="button" data-d={d} style={chip(value === d && !custom)} onClick={() => { setCustom(false); onChange(d); }}>{l}</span>)}
      {custom || !isOpt
        ? <input type="date" value={value} max={todayISO()} onChange={e => e.target.value && onChange(e.target.value)}
            style={{ ...chip(true), fontFamily: "inherit", colorScheme: "dark" }} />
        : <span role="button" style={chip(false)} onClick={() => setCustom(true)}>Autre…</span>}
    </div>
  );
}

export function PointCheckModal({ check: c, data, onClose, onCashCheque, onReceiveReimb, onLinkReimb, onPointTx, onDeleteTx, onDismissDup }) {
  const [date, setDate] = useState(todayISO());
  const [alsoPoint, setAlsoPoint] = useState(true);
  const [linking, setLinking] = useState(false);
  const cats = data.categories || [];
  const label = t => txLabel(t, cats, data.cagnottes || []);
  const ico = t => cats.find(x => x.id === t.categoryId)?.icon || (t.paymentMethod === "cheque" ? "🧾" : t.type === "income" ? "💶" : "💸");
  const sgn = t => `${t.type === "income" ? "+" : "−"}${fmt(parseFloat(t.amount) || 0)}`;
  const col = t => t.type === "income" ? "var(--success)" : "var(--danger)";
  const box = (k, t, sub, tone) => (
    <div key={k} style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 14, padding: "9px 11px", marginBottom: 7, fontSize: ".72rem",
      border: `1px solid color-mix(in srgb, ${tone} 45%, transparent)`, background: `color-mix(in srgb, ${tone} 7%, var(--surface))` }}>
      <span>{ico(t)}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label(t)}</b>
        <span style={{ fontSize: ".6rem", color: "var(--text2)" }}>{sub}</span>
      </span>
      <b style={{ color: col(t), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{sgn(t)}</b>
    </div>
  );
  const btn = (txt, onClick, kind, testid) => (
    <button data-testid={testid} onClick={onClick} style={{ display: "block", width: "100%", marginTop: 8, padding: 11, borderRadius: 12, fontSize: ".74rem", fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
      background: kind === "ok" ? "#2f9d6a" : kind === "pri" ? "var(--btn-pri-bg, #3b84cf)" : "var(--surface2)",
      border: `1px solid ${kind === "ok" ? "#68d498" : kind === "pri" ? "var(--btn-pri-border, #5aa0e4)" : kind === "del" ? "color-mix(in srgb, var(--danger) 50%, transparent)" : "var(--border)"}`,
      color: kind === "ok" || kind === "pri" ? "#fff" : kind === "del" ? "var(--danger)" : "var(--text)" }}>{txt}</button>
  );
  const note = txt => <div style={{ fontSize: ".64rem", color: "var(--text2)", lineHeight: 1.45, margin: "2px 2px 8px" }}>{txt}</div>;
  const lab = txt => <div style={{ fontSize: ".56rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "10px 2px 6px" }}>{txt}</div>;
  const r = c.r;
  const reimbWho = r ? [r.from, r.note].filter(Boolean).join(" · ") || "Remboursement" : "";

  let icon = "✓", title = "", body = null;
  if (c.kind === "cheque") {
    icon = "🧾"; title = "Chèque encaissé quand ?";
    body = <>
      {box("t", c.t, `émis le ${dLbl(c.t.issuedDate || c.t.date)}${c.t.chequeNumber ? ` · n° ${c.t.chequeNumber}` : ""}`, "var(--chq)")}
      {note("L'opération sera datée du jour de l'encaissement (la date de ton relevé).")}
      {lab("Encaissé le")}
      <DateChips value={date} onChange={setDate} testid="chq-date" />
      {btn(`✓ Pointer · encaissé le ${dLbl(date)}`, () => onCashCheque(c.t.id, date), "ok", "chq-confirm")}
      {btn("Annuler", onClose)}
    </>;
  } else if (c.kind === "reimbPending" && !linking) {
    icon = "↩️"; title = "Et le remboursement ?";
    body = <>
      {box("t", c.t, `${dLbl(c.t.date)} · pointée ✓`, "var(--success)")}
      <div style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 14, padding: "9px 11px", marginBottom: 7, fontSize: ".72rem", border: "1px solid color-mix(in srgb, var(--warning) 45%, transparent)", background: "color-mix(in srgb, var(--warning) 7%, var(--surface))" }}>
        <span>↩️</span><span style={{ flex: 1 }}><b>Remboursement attendu</b><div style={{ fontSize: ".6rem", color: "var(--text2)" }}>{reimbWho}{r.expectedDate ? ` · prévu vers le ${dLbl(r.expectedDate)}` : ""}</div></span>
        <b style={{ color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>+{fmt(parseFloat(r.amount) || 0)}</b>
      </div>
      {note("Il est compté dans ton solde estimé jusqu'à sa réception. Est-il arrivé ?")}
      {lab("Reçu le")}
      <DateChips value={date} onChange={setDate} testid="rb-date" />
      <div role="button" data-testid="rb-also-point" onClick={() => setAlsoPoint(v => !v)} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: ".7rem", cursor: "pointer" }}>
        <span style={{ flex: 1 }}>Le pointer aussi (vu sur le relevé)</span><Toggle on={alsoPoint} color="var(--success)" />
      </div>
      {btn(`✓ Reçu · ajouter le revenu de ${fmt(parseFloat(r.amount) || 0)}`, () => onReceiveReimb(r.id, date, alsoPoint), "ok", "rb-receive")}
      {c.candidates?.length > 0 && btn("🔗 Déjà saisi · le relier", () => setLinking(true), null, "rb-link")}
      {btn("Pas encore reçu", onClose, null, "rb-later")}
    </>;
  } else if (c.kind === "reimbPending" && linking) {
    icon = "🔗"; title = "Relier un revenu";
    body = <>
      {note(`Revenus de ${fmt(parseFloat(r.amount) || 0)} saisis depuis la dépense, pas encore reliés :`)}
      {c.candidates.map(t => (
        <div key={t.id} role="button" data-testid="rb-candidate" onClick={() => onLinkReimb(r.id, t.id, alsoPoint && !t.pointed)} style={{ cursor: "pointer" }}>
          {box(t.id, t, `${dLbl(t.date)} · ${t.pointed ? "pointé" : "non pointé"}`, "var(--success)")}
        </div>
      ))}
      {btn("Retour", () => setLinking(false))}
    </>;
  } else if (c.kind === "reimbUnpointed") {
    icon = "↩️"; title = "Remboursement pas pointé";
    body = <>
      {box("t", c.t, `${dLbl(c.t.date)} · pointée ✓`, "var(--success)")}
      {box("o", c.other, `reçu le ${dLbl(c.other.date)} · pas encore pointé`, "var(--warning)")}
      {note("Il apparaît sur ton relevé ?")}
      {btn("✓ Le pointer aussi", () => onPointTx(c.other.id, "✓ Remboursement pointé aussi"), "ok", "pc-point-other")}
      {btn("Plus tard", onClose)}
    </>;
  } else if (c.kind === "origUnpointed") {
    icon = "↩️"; title = "Et la dépense d'origine ?";
    const net = (parseFloat(c.other.amount) || 0) - (parseFloat(c.t.amount) || 0);
    body = <>
      {box("t", c.t, `${dLbl(c.t.date)} · pointé ✓`, "var(--success)")}
      {box("o", c.other, `${dLbl(c.other.date)} · pas encore pointée`, "var(--warning)")}
      {note(<>Coût réel pour toi : <b style={{ color: "var(--text)" }}>{fmt(Math.max(0, net))}</b>. La dépense apparaît sur ton relevé ?</>)}
      {btn("✓ La pointer aussi", () => onPointTx(c.other.id, "✓ Dépense pointée aussi"), "ok", "pc-point-other")}
      {btn("Plus tard", onClose)}
    </>;
  } else if (c.kind === "dup") {
    icon = "👯"; title = "Doublon ?";
    body = <>
      {note("Une opération identique est déjà pointée :")}
      {box("o", c.other, `${dLbl(c.other.date)} · pointée`, "var(--success)")}
      {box("t", c.t, `${dLbl(c.t.date)} · celle que tu viens de pointer`, "var(--warning)")}
      {note(`Si c'est le même achat saisi deux fois, ton solde compte ${fmt(parseFloat(c.t.amount) || 0)} en trop.`)}
      {btn(`🗑 Supprimer celle du ${dLbl(c.t.date)}`, () => onDeleteTx(c.t.id), "del", "dup-delete")}
      {btn(c.t.type === "income" ? "Non, ce sont deux revenus" : "Non, ce sont deux achats", () => onDismissDup(dupKey([c.other, c.t])), "pri", "dup-keep")}
    </>;
  }

  return (
    <Modal onClose={onClose} title="">
      <div data-testid="point-check" data-kind={c.kind}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: "1.1rem" }}>{icon}</span><b style={{ flex: 1, fontSize: "1rem" }}>{title}</b>
          <button onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>✕</button>
        </div>
        {body}
      </div>
    </Modal>
  );
}
