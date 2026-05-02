import { useSpark } from "../hooks.js";
import { fmt, txLabel, txTypeClass, txSign, deltaInfo } from "../utils.js";

// ─────────────────────────────────────────────────────────────────
//  Delta badge
// ─────────────────────────────────────────────────────────────────
/** @param {{ cur: number, prev: number }} */
export function Delta({ cur, prev }) {
  const d = deltaInfo(cur, prev);
  if (!d) return null;
  return <span className={d.cls}>{d.text}</span>;
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
//  Sparkline — last 6 months net
// ─────────────────────────────────────────────────────────────────
export function Sparkline({ transactions, fixedExpenses }) {
  const spark = useSpark(transactions, fixedExpenses);
  const sMax  = Math.max(...spark.map(Math.abs), 1);
  const W = 90, H = 28;
  const points = spark.map((v, i) => {
    const x = i * (W / 5);
    const y = H / 2 - (v / sMax) * (H / 2 - 3);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const color = spark[5] >= 0 ? "#34d399" : "#f87171";

  return (
    <svg viewBox="0 0 90 28" width="90" height="28" style={{ overflow: "visible" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {spark.map((v, i) => {
        const x = (i * (W / 5)).toFixed(1);
        const y = (H / 2 - (v / sMax) * (H / 2 - 3)).toFixed(1);
        return <circle key={i} cx={x} cy={y} r="1.8" fill={color} />;
      })}
    </svg>
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
