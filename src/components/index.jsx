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
export function Modal({ onClose, title, children }) {
  return (
    <div className="modal"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        {title && <div className="modal-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}
