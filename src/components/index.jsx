import { createPortal } from "react-dom";
import { fmt, txLabel, txTypeClass, txSign, deltaInfo } from "../utils.js";

// ─────────────────────────────────────────────────────────────────
//  Delta badge
// ─────────────────────────────────────────────────────────────────
/** @param {{ cur: number, prev: number, inverted?: boolean }} */
export function Delta({ cur, prev, inverted = false }) {
  const d = deltaInfo(cur, prev);
  if (!d) return null;
  // Pour les dépenses : la hausse est mauvaise → inverser les couleurs
  let cls = d.cls;
  if (inverted) {
    if (cls === "delta-pos") cls = "delta-neg";
    else if (cls === "delta-neg") cls = "delta-pos";
  }
  return <span className={cls}>{d.text}</span>;
}

// ─────────────────────────────────────────────────────────────────
//  Transaction row
// ─────────────────────────────────────────────────────────────────
/**
 * @param {{
 *   t: import('../store.js').Transaction,
 *   categories: import('../store.js').Category[],
 *   cagnottes: import('../store.js').Cagnotte[],
 *   onEdit?: (id: string) => void,
 *   onDelete?: (id: string) => void,
 * }}
 */
export function ItemRow({ t, categories, cagnottes, onEdit, onDelete }) {
  const cat   = categories.find(c => c.id === t.categoryId);
  const label = txLabel(t, categories, cagnottes);
  const cls   = txTypeClass(t.type);
  const sign  = txSign(t.type);
  const icon  = cat?.icon ?? (t.type === "dissolution_cagnotte" ? "🏦" : "🎯");

  return (
    <div className="item-row">
      <div className="item-icon">{icon}</div>
      <div className="item-info">
        <div className="item-title">{label}</div>
        <div className="item-sub">{t.date}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div className={`item-amount ${cls}`}>{sign}{fmt(t.amount)}</div>
        {(onEdit || onDelete) && (
          <div style={{ marginTop: 3 }}>
            {onEdit   && <button className="btn-action"          onClick={() => onEdit(t.id)}>✏️</button>}
            {onDelete && <button className="btn-action btn-del"  onClick={() => onDelete(t.id)}>✕</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Toast container
// ─────────────────────────────────────────────────────────────────
/** @param {{ toasts: import('../context.js').Toast[] }} */
export function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Base modal wrapper
// ─────────────────────────────────────────────────────────────────
/** @param {{ onClose: () => void, title: string, children: React.ReactNode }} */
export function Modal({ onClose, title, children, center = false }) {
  // v1.53.1 : rendu directement dans <body> — la fenêtre reste centrée à l'écran
  // quel que soit l'écran qui l'ouvre (plus besoin de défiler pour la voir).
  return createPortal(
    <div className={center ? "modal modal-center" : "modal"}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        {title && <div className="modal-title">{title}</div>}
        {children}
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────
//  v1.78.0 — Interrupteur unique (avant : 11 dessins différents)
//  42 × 24, bouton blanc de 18 px ; couleur « allumé » propre au réglage.
// ─────────────────────────────────────────────────────────────────
export function Toggle({ on, color = "var(--accent)", onClick, testid, style }) {
  return (
    <span role="switch" aria-checked={!!on} data-testid={testid} data-toggle={on ? "on" : "off"} onClick={onClick}
      style={{ width: 42, height: 24, borderRadius: 12, flexShrink: 0, position: "relative", display: "inline-block", boxSizing: "border-box",
        cursor: onClick ? "pointer" : "inherit", transition: "background .2s, border-color .2s", touchAction: "manipulation",
        background: on ? color : "var(--surface3)", border: `1px solid ${on ? color : "var(--border)"}`, ...style }}>
      <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%",
        background: on ? "#fff" : "#cfd8e3", boxShadow: "0 1px 3px rgba(0,0,0,.35)", transition: "left .2s" }} />
    </span>
  );
}
