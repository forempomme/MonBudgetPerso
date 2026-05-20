import { uid, todayISO } from "./utils.js";

// ─────────────────────────────────────────────────────────────────
//  JSDoc Types
// ─────────────────────────────────────────────────────────────────
/**
 * @typedef {'income'|'expense'|'epargne'|'decagnottage'|'dissolution_cagnotte'|'transfer'} TxType
 *
 * @typedef {Object} Transaction
 * @property {string}  id
 * @property {TxType}  type
 * @property {number}  amount
 * @property {string}  date        – ISO "YYYY-MM-DD"
 * @property {string}  [categoryId]
 * @property {string}  [targetCagId]
 * @property {string}  [note]
 *
 * @typedef {Object} Cagnotte
 * @property {string}  id
 * @property {string}  name
 * @property {number}  current
 * @property {number|null}  target
 * @property {string|null}  targetDate  – ISO "YYYY-MM-DD"
 *
 * @typedef {Object} Category
 * @property {string}  id
 * @property {string}  name
 * @property {string}  icon
 * @property {'expense'|'income'} type
 *
 * @typedef {Object} FixedExpense
 * @property {string}  id
 * @property {string}  name
 * @property {number}  amount
 * @property {string}  [categoryId]
 *
 * @property {Object.<string,string>} monthNotes   – clé "YYYY-MM", valeur texte libre
 *
 * @typedef {Object} AppData
 * @property {Transaction[]}   transactions
 * @property {Category[]}      categories
 * @property {Cagnotte[]}      cagnottes
 * @property {FixedExpense[]}  fixedExpenses
 * @property {string|null}     lastBackupDate
 * @property {Object.<string,string>} monthNotes
 */

// ─────────────────────────────────────────────────────────────────
//  Action types
// ─────────────────────────────────────────────────────────────────
export const A = /** @type {const} */ ({
  SAVE_TRANSACTION:  "SAVE_TRANSACTION",
  DELETE_TRANSACTION:"DELETE_TRANSACTION",
  SAVE_CAGNOTTE:     "SAVE_CAGNOTTE",
  DELETE_CAGNOTTE:   "DELETE_CAGNOTTE",
  SAVE_FIXED:        "SAVE_FIXED",
  DELETE_FIXED:      "DELETE_FIXED",
  EXECUTE_TRANSFER:  "EXECUTE_TRANSFER",
  SAVE_CATEGORY:     "SAVE_CATEGORY",
  DELETE_CATEGORY:   "DELETE_CATEGORY",
  SAVE_PROVISIONAL:  "SAVE_PROVISIONAL",
  DELETE_PROVISIONAL:"DELETE_PROVISIONAL",
  SET_BACKUP_DATE:   "SET_BACKUP_DATE",
  SAVE_MONTH_NOTE:   "SAVE_MONTH_NOTE",
  TOGGLE_POINT_TX:     "TOGGLE_POINT_TX",
  TOGGLE_POINT_FIX:    "TOGGLE_POINT_FIX",
  OVERRIDE_FIX_MONTH:  "OVERRIDE_FIX_MONTH",
  SAVE_RECURRING:      "SAVE_RECURRING",
  DEL_RECURRING:       "DEL_RECURRING",
  SAVE_ALERT_SETTINGS:      "SAVE_ALERT_SETTINGS",
  SAVE_ROUNDING_SETTINGS:   "SAVE_ROUNDING_SETTINGS",
  SAVE_TAG:                 "SAVE_TAG",
  DELETE_TAG:               "DELETE_TAG",
  SAVE_CATEGORY_THRESHOLD:  "SAVE_CATEGORY_THRESHOLD",
  IMPORT_DATA:              "IMPORT_DATA",
  RESET:               "RESET",
});

// ─────────────────────────────────────────────────────────────────
//  Default state
// ─────────────────────────────────────────────────────────────────
/** @type {AppData} */
export const DEFAULT_DATA = {
  transactions: [],
  categories: [
    { id: "1", name: "Loyer",   icon: "🏠", type: "expense" },
    { id: "2", name: "Courses", icon: "🛒", type: "expense" },
    { id: "3", name: "Salaire", icon: "💰", type: "income"  },
  ],
  cagnottes: [],
  fixedExpenses: [],
  provisionalExpenses: [],
  lastBackupDate: null,
  monthNotes: {},
  recurringTemplates: [],
  alertEnabled:         false,
  alertThreshold:       500,
  categoryThresholds:   {},
  tags:                 [],
  roundingEnabled:      false,
  roundingCagnotteId:   null,
  roundingRule:         "ceil",
};

// ─────────────────────────────────────────────────────────────────
//  Reducer
// ─────────────────────────────────────────────────────────────────
/**
 * @param {AppData} state
 * @param {{ type: string, [key: string]: any }} action
 * @returns {AppData}
 */
export function reducer(state, action) {
  switch (action.type) {

    // ── Transactions ──────────────────────────────────────────────
    case A.SAVE_TRANSACTION: {
      const { tx } = action;

      // ── Edit existing ──
      if (tx.id) {
        const old = state.transactions.find(t => t.id === tx.id);
        let cagnottes = state.cagnottes;

        // Reverse the old cagnotte effect before applying the new one
        if (old?.type === "epargne") {
          cagnottes = cagnottes.map(c =>
            c.id === old.targetCagId
              ? { ...c, current: c.current - (parseFloat(old.amount) || 0) }
              : c
          );
        } else if (old?.type === "decagnottage") {
          cagnottes = cagnottes.map(c =>
            c.id === old.targetCagId
              ? { ...c, current: c.current + (parseFloat(old.amount) || 0) }
              : c
          );
        }

        // Apply the new cagnotte effect
        if (tx.type === "epargne") {
          cagnottes = cagnottes.map(c =>
            c.id === tx.targetCagId ? { ...c, current: c.current + tx.amount } : c
          );
        } else if (tx.type === "decagnottage") {
          cagnottes = cagnottes.map(c =>
            c.id === tx.targetCagId ? { ...c, current: c.current - tx.amount } : c
          );
        }

        return {
          ...state,
          cagnottes,
          transactions: state.transactions.map(t =>
            t.id === tx.id ? { ...t, ...tx } : t
          ),
        };
      }

      // ── New transaction ──
      const newTx = { ...tx, id: uid("t") };
      let cagnottes = state.cagnottes;

      if (tx.type === "epargne") {
        cagnottes = cagnottes.map(c =>
          c.id === tx.targetCagId ? { ...c, current: c.current + tx.amount } : c
        );
      } else if (tx.type === "decagnottage") {
        cagnottes = cagnottes.map(c =>
          c.id === tx.targetCagId ? { ...c, current: c.current - tx.amount } : c
        );
      }

      let newTxs = [...state.transactions, newTx];

      // ── Arrondi automatique ──────────────────────────────────
      if (
        state.roundingEnabled &&
        tx.type === "expense" &&
        state.roundingCagnotteId &&
        !tx.isRounding
      ) {
        const amount  = parseFloat(tx.amount) || 0;
        const rule    = state.roundingRule || "ceil";
        const rounded = rule === "5"  ? Math.ceil(amount / 5)  * 5
                      : rule === "10" ? Math.ceil(amount / 10) * 10
                      :                 Math.ceil(amount);
        const roundAmt = parseFloat((rounded - amount).toFixed(2));
        if (roundAmt > 0.005) {
          const roundTx = {
            id: uid("rtx"), type: "epargne",
            amount: roundAmt, date: tx.date,
            targetCagId: state.roundingCagnotteId,
            note: `Arrondi · ${tx.note || ""}`.trim(),
            isRounding: true,
          };
          newTxs = [...newTxs, roundTx];
          cagnottes = cagnottes.map(c =>
            c.id === state.roundingCagnotteId ? { ...c, current: c.current + roundAmt } : c
          );
        }
      }

      return { ...state, cagnottes, transactions: newTxs };
    }

    case A.DELETE_TRANSACTION:
      return {
        ...state,
        transactions: state.transactions.filter(t => t.id !== action.id),
      };
    // ── Cagnottes ─────────────────────────────────────────────────
    case A.SAVE_CAGNOTTE: {
      const { cag } = action;
      if (cag.id) {
        return {
          ...state,
          cagnottes: state.cagnottes.map(c =>
            c.id === cag.id ? { ...c, ...cag } : c
          ),
        };
      }
      return {
        ...state,
        cagnottes: [...state.cagnottes, { ...cag, id: uid("cg") }],
      };
    }

    case A.DELETE_CAGNOTTE: {
      const target = state.cagnottes.find(c => c.id === action.id);
      if (!target) return state;

      const cagnottes = state.cagnottes.filter(c => c.id !== action.id);
      const transactions = target.current > 0
        ? [...state.transactions, {
            id: uid("t"),
            type: "dissolution_cagnotte",
            amount: target.current,
            date: todayISO(),
            categoryId: "",
            note: target.name,
            targetCagId: "",
          }]
        : state.transactions;

      return { ...state, cagnottes, transactions };
    }

    // ── Fixed expenses ────────────────────────────────────────────
    case A.SAVE_FIXED: {
      const { idx, fixed } = action;
      const newFixed = [...state.fixedExpenses];
      if (idx != null) {
        newFixed[idx] = { ...newFixed[idx], ...fixed };
      } else {
        newFixed.push({ ...fixed, id: uid("f") });
      }
      return { ...state, fixedExpenses: newFixed };
    }

    case A.DELETE_FIXED: {
      const newFixed = [...state.fixedExpenses];
      newFixed.splice(action.idx, 1);
      return { ...state, fixedExpenses: newFixed };
    }

    // ── Transfer between cagnottes ────────────────────────────────
    case A.EXECUTE_TRANSFER: {
      const { fromId, toId, amt } = action;
      return {
        ...state,
        cagnottes: state.cagnottes.map(c =>
          c.id === fromId ? { ...c, current: c.current - amt } :
          c.id === toId   ? { ...c, current: c.current + amt } : c
        ),
      };
    }

    // ── Categories ────────────────────────────────────────────────
    case A.SAVE_CATEGORY: {
      const { cat } = action;
      if (cat.id) {
        return {
          ...state,
          categories: state.categories.map(c =>
            c.id === cat.id ? { ...c, ...cat } : c
          ),
        };
      }
      return {
        ...state,
        categories: [...state.categories, { ...cat, id: uid("cat") }],
      };
    }

    case A.DELETE_CATEGORY:
      return {
        ...state,
        categories: state.categories.filter(c => c.id !== action.id),
      };

    // ── Provisional expenses ──────────────────────────────────────
    case A.SAVE_PROVISIONAL: {
      const { provisional } = action;
      if (provisional.id) {
        return {
          ...state,
          provisionalExpenses: (state.provisionalExpenses || []).map(p =>
            p.id === provisional.id ? { ...p, ...provisional } : p
          ),
        };
      }
      return {
        ...state,
        provisionalExpenses: [...(state.provisionalExpenses || []), { ...provisional, id: uid("pv") }],
      };
    }

    case A.DELETE_PROVISIONAL:
      return {
        ...state,
        provisionalExpenses: (state.provisionalExpenses || []).filter(p => p.id !== action.id),
      };

    // ── Misc ──────────────────────────────────────────────────────
    case A.SET_BACKUP_DATE:
      return { ...state, lastBackupDate: action.date };

    case A.TOGGLE_POINT_TX:
      return {
        ...state,
        transactions: state.transactions.map(t =>
          t.id === action.id ? { ...t, pointed: !t.pointed } : t
        ),
      };

    case A.TOGGLE_POINT_FIX:
      return {
        ...state,
        fixedExpenses: state.fixedExpenses.map(f => {
          if (f.id !== action.id) return f;
          const pointedMonths = { ...(f.pointedMonths || {}) };
          pointedMonths[action.ym] = !pointedMonths[action.ym];
          return { ...f, pointedMonths };
        }),
      };

    case A.OVERRIDE_FIX_MONTH:
      return {
        ...state,
        fixedExpenses: state.fixedExpenses.map(f => {
          if (f.id !== action.id) return f;
          const monthlyOverrides = { ...(f.monthlyOverrides || {}) };
          if (action.override) {
            monthlyOverrides[action.ym] = action.override; // { amount, name }
          } else {
            delete monthlyOverrides[action.ym]; // reset → valeur par défaut
          }
          return { ...f, monthlyOverrides };
        }),
      };

    case A.SAVE_RECURRING: {
      const tpl = action.tpl;
      const existing = (state.recurringTemplates || []).find(r => r.id === tpl.id);
      if (existing) {
        return { ...state, recurringTemplates: state.recurringTemplates.map(r => r.id === tpl.id ? { ...r, ...tpl } : r) };
      }
      return { ...state, recurringTemplates: [...(state.recurringTemplates || []), { ...tpl, id: tpl.id || uid("rc") }] };
    }

    case A.DEL_RECURRING:
      return { ...state, recurringTemplates: (state.recurringTemplates || []).filter(r => r.id !== action.id) };

    case A.SAVE_ALERT_SETTINGS:
      return { ...state, alertEnabled: action.enabled, alertThreshold: action.threshold };

    case A.SAVE_CATEGORY_THRESHOLD: {
      const thresholds = { ...(state.categoryThresholds || {}) };
      if (!action.threshold || action.threshold <= 0) {
        delete thresholds[action.catId];
      } else {
        thresholds[action.catId] = action.threshold;
      }
      return { ...state, categoryThresholds: thresholds };
    }

    case A.SAVE_ROUNDING_SETTINGS:
      return { ...state, roundingEnabled: action.enabled, roundingCagnotteId: action.cagnotteId, roundingRule: action.rule };

    case A.SAVE_TAG: {
      const { tag } = action;
      if (tag.id) {
        return { ...state, tags: state.tags.map(t => t.id === tag.id ? { ...t, ...tag } : t) };
      }
      return { ...state, tags: [...(state.tags || []), { ...tag, id: uid("tag") }] };
    }

    case A.DELETE_TAG:
      return {
        ...state,
        tags: (state.tags || []).filter(t => t.id !== action.id),
        transactions: state.transactions.map(t => ({
          ...t, tagIds: (t.tagIds || []).filter(tid => tid !== action.id)
        })),
      };

    case A.SAVE_MONTH_NOTE: {
      const notes = { ...(state.monthNotes || {}) };
      if (action.note.trim()) {
        notes[action.ym] = action.note.trim();
      } else {
        delete notes[action.ym];
      }
      return { ...state, monthNotes: notes };
    }

    case A.IMPORT_DATA:
      return { ...DEFAULT_DATA, ...action.data };

    case A.RESET:
      return DEFAULT_DATA;

    default:
      return state;
  }
}
