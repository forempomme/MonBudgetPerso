import { uid, todayISO, getPrevMonth, currentYM, DEFAULT_CAG_TYPES, autoIncomeAmount } from "./utils.js";

// v1.64.0 : montant prévu « automatique » = moyenne des 3 derniers montants réels
const withAutoAmount = (f, transactions) => {
  if (f.amountMode !== "auto") return f;
  const a = autoIncomeAmount(f, transactions);
  return a != null ? { ...f, amount: a } : f;
};

// ─────────────────────────────────────────────────────────────────
//  JSDoc Types
// ─────────────────────────────────────────────────────────────────
/**
 * @typedef {'income'|'expense'|'epargne'|'decagnottage'|'dissolution_cagnotte'|'transfer'|'balance_adjustment'} TxType
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
 * @property {string|null}  cagType     – id d'un type de data.cagTypes (défaut : "projet"|"urgence"|"plaisir"|"investissement") ou null
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
 * @property {string}  [startYM]     – "YYYY-MM" : premier mois où ce frais s'applique (optionnel)
 *
 * @typedef {Object} FixedIncome
 * @property {string}  id
 * @property {string}  name
 * @property {number}  amount
 * @property {string}  [categoryId]
 * @property {string}  [startYM]     – "YYYY-MM" : premier mois où ce revenu s'applique (optionnel)
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
  SAVE_FIXED_INCOME:    "SAVE_FIXED_INCOME",
  DELETE_FIXED_INCOME:  "DELETE_FIXED_INCOME",
  EXECUTE_TRANSFER:  "EXECUTE_TRANSFER",
  SAVE_CATEGORY:     "SAVE_CATEGORY",
  DELETE_CATEGORY:   "DELETE_CATEGORY",
  SAVE_PROVISIONAL:  "SAVE_PROVISIONAL",
  DELETE_PROVISIONAL:"DELETE_PROVISIONAL",
  ADD_BACKUP_ENTRY:  "ADD_BACKUP_ENTRY",
  SAVE_MONTH_NOTE:   "SAVE_MONTH_NOTE",
  TOGGLE_POINT_TX:     "TOGGLE_POINT_TX",
  TOGGLE_POINT_FIX:    "TOGGLE_POINT_FIX",
  TOGGLE_POINT_INCOME: "TOGGLE_POINT_INCOME",
  SET_FIXED_DAY:       "SET_FIXED_DAY",       // v1.58.0 : jour choisi depuis une tuile des Fixes
  POINT_INCOME_AMOUNT: "POINT_INCOME_AMOUNT", // v1.64.0 : pointer un revenu fixe avec son montant réel
  SAVE_PAY_RECAP:      "SAVE_PAY_RECAP",      // v1.67.0 : photo du récap pris à la paie (bilan du 1er)
  OVERRIDE_FIX_MONTH:  "OVERRIDE_FIX_MONTH",
  OVERRIDE_INCOME_MONTH: "OVERRIDE_INCOME_MONTH",   // v1.50.0
  SAVE_RECURRING:      "SAVE_RECURRING",
  DEL_RECURRING:       "DEL_RECURRING",
  SAVE_ALERT_SETTINGS:      "SAVE_ALERT_SETTINGS",
  SAVE_AUTO_SAVING:         "SAVE_AUTO_SAVING",
  DELETE_AUTO_SAVING:       "DELETE_AUTO_SAVING",
  APPLY_AUTO_SAVING:        "APPLY_AUTO_SAVING",
  SAVE_SCHEDULED:           "SAVE_SCHEDULED",
  DELETE_SCHEDULED:         "DELETE_SCHEDULED",
  CONFIRM_SCHEDULED:        "CONFIRM_SCHEDULED",
  SAVE_SECURITY_SETTINGS:   "SAVE_SECURITY_SETTINGS",
  SAVE_SECURITY_EXTRA:      "SAVE_SECURITY_EXTRA",
  SAVE_ROUNDING_SETTINGS:   "SAVE_ROUNDING_SETTINGS",
  MARK_ROUNDING_TRANSFERRED:"MARK_ROUNDING_TRANSFERRED",
  SAVE_NOTIF_SETTINGS:      "SAVE_NOTIF_SETTINGS",
  SAVE_TAG:                 "SAVE_TAG",
  DELETE_TAG:               "DELETE_TAG",
  SAVE_SIDE_AMOUNT_TYPE:    "SAVE_SIDE_AMOUNT_TYPE",
  SAVE_CAG_TYPE:            "SAVE_CAG_TYPE",      // v1.56.0
  DELETE_CAG_TYPE:          "DELETE_CAG_TYPE",    // v1.56.0
  DELETE_SIDE_AMOUNT_TYPE:  "DELETE_SIDE_AMOUNT_TYPE",
  SAVE_CATEGORY_THRESHOLD:  "SAVE_CATEGORY_THRESHOLD",
  IMPORT_DATA:              "IMPORT_DATA",
  CLEAR_WARNING:            "CLEAR_WARNING",
  SAVE_PROJECTION_SNAPSHOT: "SAVE_PROJECTION_SNAPSHOT",
  SAVE_QUICK_TEMPLATE:      "SAVE_QUICK_TEMPLATE",
  SAVE_OFF_ACCOUNT:         "SAVE_OFF_ACCOUNT",
  DELETE_OFF_ACCOUNT:       "DELETE_OFF_ACCOUNT",
  CASH_CHEQUE:              "CASH_CHEQUE",
  SAVE_GROCERY_BUDGET:      "SAVE_GROCERY_BUDGET",
  MARK_MONTH_RECAP:         "MARK_MONTH_RECAP",
  MARK_YEAR_RECAP:          "MARK_YEAR_RECAP",     // v1.68.0
  SET_APPEARANCE:           "SET_APPEARANCE",      // v1.70.0 : { appTheme?, glassEffects? }
  SAVE_REIMBURSEMENT:       "SAVE_REIMBURSEMENT",
  DELETE_REIMBURSEMENT:     "DELETE_REIMBURSEMENT",
  RECEIVE_REIMBURSEMENT:    "RECEIVE_REIMBURSEMENT",
  SAVE_REST_SETTINGS:       "SAVE_REST_SETTINGS",
  DISMISS_INSIGHT:          "DISMISS_INSIGHT",        // v1.50.0
  SAVE_SAVINGS_GOAL:        "SAVE_SAVINGS_GOAL",      // v1.52.0
  SAVE_PROJECT:             "SAVE_PROJECT",
  DELETE_PROJECT:           "DELETE_PROJECT",
  DELETE_QUICK_TEMPLATE:    "DELETE_QUICK_TEMPLATE",
  RESET:               "RESET",
});

// ─────────────────────────────────────────────────────────────────
//  withPauseHistory — v1.45.1
//  Avant : réactiver un frais/revenu fixe effaçait pausedFrom → la pause
//  disparaissait et les mois passés en pause redevenaient « dus »
//  (en attente) dans le solde estimé. Désormais, chaque pause terminée
//  est archivée dans pauseHistory [{ from, until }] et isActiveForMonth
//  continue de l'exclure. Appliqué dans le reducer → couvre le bouton
//  ▶️ de la liste ET le formulaire.
// ─────────────────────────────────────────────────────────────────
export function withPauseHistory(old, next, curYM = currentYM()) {
  const history = [...(old.pauseHistory || [])];
  const push = (from, until) => {
    if (!from || !until || from > until) return;
    if (!history.some(p => p.from === from && p.until === until)) history.push({ from, until });
  };
  if (old.paused && old.pausedFrom) {
    if (!next.paused) {
      // Réactivation : la pause couvrait jusqu'au mois précédent (ou jusqu'à
      // sa date de reprise prévue si celle-ci est déjà passée)
      const lastPaused = old.pausedUntil && old.pausedUntil < curYM ? old.pausedUntil : getPrevMonth(curYM);
      push(old.pausedFrom, lastPaused);
    } else if (next.pausedFrom && next.pausedFrom !== old.pausedFrom) {
      // Nouvelle pause qui remplace une ancienne : on garde l'ancienne période
      const end = old.pausedUntil && old.pausedUntil < next.pausedFrom ? old.pausedUntil : getPrevMonth(next.pausedFrom);
      push(old.pausedFrom, end);
    }
  }
  history.sort((a, b) => a.from.localeCompare(b.from));
  return history.length ? history : undefined;
}

// ─────────────────────────────────────────────────────────────────
//  Default state
// ─────────────────────────────────────────────────────────────────
/** @type {AppData} */
export const DEFAULT_DATA = {
  // Remboursements attendus (v1.48.0) — n'entrent dans aucun solde tant
  // qu'ils ne sont pas reçus (le revenu reçu, lui, est une vraie opération)
  reimbursements: [],
  // Reste à vivre (v1.48.0) — indicatif ; marge de sécurité modifiable
  restSettings: { enabled: true, margin: 0 },
  // « Repéré pour toi » / surplus (v1.50.0) : { [clé]: valeur au moment du « Ignorer » }
  insightDismissed: {},
  // Objectif d'épargne annuel (v1.52.0) : { [année]: montant } — avant, non enregistré
  savingsGoals: {},
  // Projets avec échéance (v1.47.0) : relient une cagnotte et un tag
  projects: [],
  // Budget courses (v1.46.0) — informatif, n'entre dans aucun solde.
  // categoryIds null = catégories nommées « Courses ».
  groceryBudget: { enabled: true, categoryIds: null, months: 2 },
  transactions: [],
  categories: [
    { id: "1", name: "Loyer",   icon: "🏠", type: "expense" },
    { id: "2", name: "Courses", icon: "🛒", type: "expense" },
    { id: "3", name: "Salaire", icon: "💰", type: "income"  },
  ],
  cagnottes: [],
  fixedExpenses: [],
  fixedIncomes:  [],
  provisionalExpenses: [],
  lastBackupDate:        null,
  backupHistory:         [],   // [{ id, date, txCount, sizeKo }] — 10 dernières
  monthNotes: {},
  recurringTemplates: [],
  alertEnabled:         false,
  alertThreshold:       500,
  categoryThresholds:   {},
  autoSavings:          [],   // [{ id, cagnotteId, amount, dayOfMonth, enabled }]
  scheduledTransactions:[],    // [{ id, amount, date, categoryId, note, confirmed }]
  pinEnabled:           false,
  pinHash:              null,  // SHA-256 hex
  bioEnabled:           false,
  // v1.75.0 — sécurité
  relockDelay:          5,     // minutes hors de l'appli avant de redemander le PIN (0 = immédiat, -1 = jamais)
  pinMaxTries:          5,     // erreurs de PIN avant une attente (0 = illimité)
  openHidden:           false, // ouvrir l'appli en mode discret
  backupKey:            null,  // { v, salt, iter, check } — vérificateur du mot de passe de sauvegarde (jamais le mot de passe)
  tags:                 [],
  roundingEnabled:           false,
  roundingCagnotteId:        null,
  roundingRule:              "ceil",
  roundingLastTransferDate:  null,
  // Message d'avertissement ponctuel (ex: cagnotte d'arrondi introuvable) —
  // lu et affiché en toast par App.jsx, puis effacé via CLEAR_WARNING.
  warning:                   null,
  // Fiabilité de la projection (v1.39.14) : figé au tout premier calcul pour
  // chaque mois futur — { [ym]: { predictedValue, predictedOn } } — jamais
  // réécrit ensuite, pour comparer "ce qu'on avait annoncé" vs la réalité
  // une fois le mois passé.
  projectionSnapshots:       {},
  payRecaps:                 {},
  appTheme:                  "abysse",   // v1.70.0 : "abysse" (verre bleu, défaut) | "glacier" | "aube" (thème d'origine)
  glassEffects:              true,       // v1.70.0 : flou derrière les cartes (thèmes en verre)   // v1.67.0 : { [ym]: { rest, saved, date } } — récap pris à la paie
  // Templates de saisie rapide (v1.39.18) — [{ id, icon, name, categoryId, type }]
  // Déclenchés par un appui long sur le bouton +. Le montant et la date
  // restent à saisir à chaque fois (jamais mémorisés).
  quickTemplates:            [],
  // Types de cagnotte (v1.56.0) — [{ id, icon, label, color }], gérés dans Options.
  // Purement visuels : n'entrent dans aucun calcul.
  cagTypes:                  DEFAULT_CAG_TYPES,
  // Types de "montants à part" (v1.39.32) — [{ id, label, icon }]. Purement
  // informatif : jamais compté dans aucun calcul de solde. "Tickets resto"
  // préconfiguré comme premier type, d'autres peuvent être ajoutés depuis
  // Options (ex: carte cadeau, remboursement attendu…).
  sideAmountTypes:           [{ id: "tr", label: "Tickets resto", icon: "🎫", trackBalance: true }],
  // Dépenses payées 100 % hors compte (tickets resto…) et rechargements
  // (v1.42.0) — liste SÉPARÉE des transactions : aucun calcul de solde,
  // rapprochement, fixe ou projection ne la lit. Jamais.
  // { id, kind: "expense"|"recharge", satId, amount, date, categoryId?, note? }
  offAccountEntries:         [],
  notifSettings: {
    enabled:    false,
    recurring:  true,
    autoSaving: true,
    alertSolde: true,
    scheduled:  true,
    backup:     true,
    cheques: true, chequeDelay: 30,   // v1.43.0 : rappels chèques non encaissés
    // v1.48.0 : rappel du soir (seulement si rien n'a été saisi ce jour-là)
    evening: false, eveningHour: 21, eveningDays: "all",   // "all" | "week" | "weekend"
    reimbursements: true,             // v1.48.0 : rappel des remboursements en retard
  },
};

// ─────────────────────────────────────────────────────────────────
//  Arrondi automatique : calcule le montant à mettre de côté pour une
//  dépense donnée, selon les réglages actuels. Retourne null si aucun
//  arrondi ne doit s'appliquer (désactivé, cagnotte manquante, ou
//  montant déjà rond).
// ─────────────────────────────────────────────────────────────────
function computeRoundAmount(state, amount) {
  if (!state.roundingEnabled || !state.roundingCagnotteId) return null;
  if (!state.cagnottes.some(c => c.id === state.roundingCagnotteId)) return null;
  const rule    = state.roundingRule || "ceil";
  const rounded = rule === "5"  ? Math.ceil(amount / 5)  * 5
                : rule === "10" ? Math.ceil(amount / 10) * 10
                :                 Math.ceil(amount);
  const roundAmt = parseFloat((rounded - amount).toFixed(2));
  return roundAmt > 0.005 ? roundAmt : null;
}

// ─────────────────────────────────────────────────────────────────
//  Reducer
// ─────────────────────────────────────────────────────────────────
/**
 * @param {AppData} state
 * @param {{ type: string, [key: string]: any }} action
 * @returns {AppData}
 */
// ─────────────────────────────────────────────────────────────────
//  normalizeData — v1.40.0
//  Source unique pour transformer des données brutes (localStorage OU
//  fichier de sauvegarde importé) en state valide. Avant, le chargement
//  et l'import avaient chacun leur propre fusion, et l'import pouvait
//  écraser les sous-réglages de notifications avec un objet incomplet.
// ─────────────────────────────────────────────────────────────────
export function normalizeData(saved) {
  const src = saved && typeof saved === "object" ? saved : {};
  const data = {
    ...DEFAULT_DATA,
    ...src,
    notifSettings: { ...DEFAULT_DATA.notifSettings, ...(src.notifSettings || {}) },
    fixedIncomes:  src.fixedIncomes || DEFAULT_DATA.fixedIncomes,
    sideAmountTypes: (src.sideAmountTypes || DEFAULT_DATA.sideAmountTypes)
      // Le type TR historique suit son solde par défaut (porte-monnaie)
      .map(st => st.id === "tr" && st.trackBalance === undefined ? { ...st, trackBalance: true } : st),
    offAccountEntries: src.offAccountEntries || [],
    groceryBudget: { ...DEFAULT_DATA.groceryBudget, ...(src.groceryBudget || {}) },
    projects: src.projects || [],
    reimbursements: src.reimbursements || [],
    restSettings: { ...DEFAULT_DATA.restSettings, ...(src.restSettings || {}) },
    insightDismissed: src.insightDismissed || {},
    savingsGoals: src.savingsGoals || {},
    cagTypes: Array.isArray(src.cagTypes) ? src.cagTypes : DEFAULT_CAG_TYPES,
  };

  // Migration v1.39.31 → v1.39.32 : les tickets resto saisis dans l'ancien
  // champ unique `mealVoucherAmount` n'étaient plus affichés depuis le
  // passage aux montants à part génériques (`sideAmounts`). On les
  // rapatrie dans sideAmounts.tr — sans jamais écraser une valeur existante.
  let migrated = false;
  data.transactions = (data.transactions || []).map(t => {
    if (!(parseFloat(t.mealVoucherAmount) > 0)) return t;
    migrated = true;
    const { mealVoucherAmount, ...rest } = t;
    const sideAmounts = { ...(t.sideAmounts || {}) };
    if (sideAmounts.tr == null) sideAmounts.tr = parseFloat(mealVoucherAmount);
    return { ...rest, sideAmounts };
  });
  // Si le type "Tickets resto" avait été supprimé, on le recrée pour que
  // les montants migrés restent lisibles (icône + libellé).
  if (migrated && !data.sideAmountTypes.some(st => st.id === "tr")) {
    data.sideAmountTypes = [...data.sideAmountTypes, { id: "tr", label: "Tickets resto", icon: "🎫" }];
  }
  return data;
}

function saveTransactionCore(state, action) {
  return reducer(state, { ...action, type: "__SAVE_TRANSACTION_CORE__", reimbursement: undefined, receiveReimbursementId: undefined });
}

export function reducer(state, action) {
  switch (action.type) {

    // ── Transactions ──────────────────────────────────────────────
    case A.SAVE_TRANSACTION: {
      // v1.48.0 : options « sera remboursé » / « c'est le remboursement de… »
      const next = saveTransactionCore(state, action);
      if (!action.reimbursement && !action.receiveReimbursementId) return next;
      const known = new Set(state.transactions.map(t => t.id));
      const txId = action.tx.id || (next.transactions.find(t => !known.has(t.id) && !t.isRounding) || {}).id;
      let reimbursements = next.reimbursements || [];
      if (action.reimbursement) {
        const r = action.reimbursement;
        const existing = reimbursements.find(x => (r.id && x.id === r.id) || (x.txId && x.txId === txId && x.status === "pending"));
        if (r.remove) reimbursements = reimbursements.filter(x => x !== existing);
        else if (existing) reimbursements = reimbursements.map(x => x === existing ? { ...x, ...r, id: x.id, txId } : x);
        else reimbursements = [...reimbursements, { ...r, id: uid("rb"), txId, status: "pending", createdAt: todayISO() }];
      }
      if (action.receiveReimbursementId) {
        reimbursements = reimbursements.map(x => x.id === action.receiveReimbursementId
          ? { ...x, status: "received", receivedTxId: txId, receivedDate: action.tx.date || todayISO() } : x);
      }
      return { ...next, reimbursements };
    }

    case A.SAVE_REIMBURSEMENT: {
      const r = action.reimbursement;
      const list = state.reimbursements || [];
      return { ...state, reimbursements: r.id && list.some(x => x.id === r.id)
        ? list.map(x => x.id === r.id ? { ...x, ...r } : x)
        : [...list, { ...r, id: uid("rb"), status: "pending", createdAt: todayISO() }] };
    }

    case A.DELETE_REIMBURSEMENT:
      return { ...state, reimbursements: (state.reimbursements || []).filter(x => x.id !== action.id) };

    case A.RECEIVE_REIMBURSEMENT: {
      // Marque reçu ET crée le revenu correspondant (sinon l'argent reçu
      // n'apparaîtrait pas dans le solde) — même catégorie que la dépense
      // d'origine pour que le Rapport calcule le coût net.
      const r = (state.reimbursements || []).find(x => x.id === action.id);
      if (!r) return state;
      const src = state.transactions.find(t => t.id === r.txId);
      const income = { id: uid("t"), type: "income", amount: parseFloat(r.amount) || 0, date: action.date || todayISO(),
        categoryId: src?.categoryId || "", note: `Remboursement ${r.from ? "· " + r.from : ""}${r.note ? " — " + r.note : ""}`.trim(), pointed: false };
      return { ...state, transactions: [...state.transactions, income],
        reimbursements: state.reimbursements.map(x => x.id === r.id ? { ...x, status: "received", receivedTxId: income.id, receivedDate: income.date } : x) };
    }

    case A.SAVE_SAVINGS_GOAL: {
      const g = { ...(state.savingsGoals || {}) };
      if (action.amount > 0) g[action.year] = action.amount; else delete g[action.year];
      return { ...state, savingsGoals: g };
    }

    case A.DISMISS_INSIGHT:
      return { ...state, insightDismissed: { ...(state.insightDismissed || {}), [action.key]: action.value } };

    case A.SAVE_REST_SETTINGS:
      return { ...state, restSettings: { ...(state.restSettings || DEFAULT_DATA.restSettings), ...action.settings } };

    case "__SAVE_TRANSACTION_CORE__": {
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

        // Le lien avec la récurrente (templateId) n'est JAMAIS effacé par une
        // édition : le formulaire ne le connaît pas et envoyait undefined, ce qui
        // faisait recompter la récurrente comme « à confirmer » (double
        // comptage dans le solde estimé). Corrigé en v1.44.1.
        let transactions = state.transactions.map(t =>
          t.id === tx.id ? { ...t, ...tx, templateId: tx.templateId ?? t.templateId } : t
        );
        let warning = state.warning;

        // ── Arrondi lié à cette dépense : on le recalcule (ou on l'enlève) ──
        const linkedRound = state.transactions.find(t => t.isRounding && t.sourceTxId === tx.id);
        if (linkedRound) {
          // On annule d'abord son ancien effet sur la cagnotte
          cagnottes = cagnottes.map(c =>
            c.id === linkedRound.targetCagId ? { ...c, current: c.current - linkedRound.amount } : c
          );
          const newRoundAmt = tx.type === "expense" ? computeRoundAmount(state, parseFloat(tx.amount) || 0) : null;
          if (newRoundAmt != null) {
            cagnottes = cagnottes.map(c =>
              c.id === state.roundingCagnotteId ? { ...c, current: c.current + newRoundAmt } : c
            );
            transactions = transactions.map(t =>
              t.id === linkedRound.id
                ? { ...t, amount: newRoundAmt, date: tx.date, note: `Arrondi · ${tx.note || ""}`.trim() }
                : t
            );
          } else {
            // Plus d'arrondi à appliquer (montant devenu rond, type changé, ou cagnotte manquante)
            transactions = transactions.filter(t => t.id !== linkedRound.id);
            if (state.roundingEnabled && state.roundingCagnotteId && tx.type === "expense" &&
                !state.cagnottes.some(c => c.id === state.roundingCagnotteId)) {
              warning = "Ta cagnotte d'arrondi n'existe plus — vérifie tes réglages dans Options.";
            }
          }
        }

        return { ...state, cagnottes, transactions, warning };
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
      let warning = state.warning;
      if (
        state.roundingEnabled &&
        tx.type === "expense" &&
        state.roundingCagnotteId &&
        !tx.isRounding
      ) {
        if (!state.cagnottes.some(c => c.id === state.roundingCagnotteId)) {
          // La cagnotte visée par l'arrondi n'existe plus : on ne crée pas de
          // transaction fantôme qui n'irait nulle part, on prévient l'utilisateur.
          warning = "Ta cagnotte d'arrondi n'existe plus — vérifie tes réglages dans Options.";
        } else {
          const roundAmt = computeRoundAmount(state, parseFloat(tx.amount) || 0);
          if (roundAmt != null) {
            const roundTx = {
              id: uid("rtx"), type: "epargne",
              amount: roundAmt, date: tx.date,
              targetCagId: state.roundingCagnotteId,
              note: `Arrondi · ${tx.note || ""}`.trim(),
              isRounding: true, sourceTxId: newTx.id,
            };
            newTxs = [...newTxs, roundTx];
            cagnottes = cagnottes.map(c =>
              c.id === state.roundingCagnotteId ? { ...c, current: c.current + roundAmt } : c
            );
          }
        }
      }

      return { ...state, cagnottes, transactions: newTxs, warning };
    }

    case A.DELETE_TRANSACTION: {
      const tx = state.transactions.find(t => t.id === action.id);
      let cagnottes = state.cagnottes;
      // Restaurer l'effet sur la cagnotte si applicable
      if (tx?.type === "epargne") {
        cagnottes = cagnottes.map(c =>
          c.id === tx.targetCagId
            ? { ...c, current: c.current - (parseFloat(tx.amount) || 0) }
            : c
        );
      } else if (tx?.type === "decagnottage") {
        cagnottes = cagnottes.map(c =>
          c.id === tx.targetCagId
            ? { ...c, current: c.current + (parseFloat(tx.amount) || 0) }
            : c
        );
      }
      return {
        ...state,
        cagnottes,
        transactions: state.transactions.filter(t => t.id !== action.id),
      };
    }
    // ── Cagnottes ─────────────────────────────────────────────────
    case A.SAVE_CAGNOTTE: {
      const { cag } = action;
      if (cag.id) {
        return {
          ...state,
          cagnottes: state.cagnottes.map(c => {
            if (c.id !== cag.id) return c;
            // v1.58.0 : un changement manuel de « Déjà épargné » laisse une trace
            // dans l'historique de la cagnotte (c.adjustments). Ce n'est PAS une
            // transaction : aucun effet sur le solde bancaire ni sur le versé/retiré.
            const before = parseFloat(c.current) || 0;
            const after  = cag.current != null ? (parseFloat(cag.current) || 0) : before;
            const diff   = Math.round((after - before) * 100) / 100;
            const adjustments = diff !== 0
              ? [...(c.adjustments || []), { id: uid("adj"), date: todayISO(), amount: diff, before, after }]
              : c.adjustments;
            return { ...c, ...cag, ...(adjustments ? { adjustments } : {}) };
          }),
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
        const old = newFixed[idx];
        const amountChanged = fixed.amount !== undefined && fixed.amount !== old.amount;
        const now = new Date();
        const curYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
        newFixed[idx] = {
          ...old,
          ...fixed,
          // Liste éditée dans le formulaire (si envoyée) + archivage automatique d'une pause qu'on vient d'arrêter
          pauseHistory: withPauseHistory({ ...old, pauseHistory: fixed.pauseHistory !== undefined ? fixed.pauseHistory : old.pauseHistory }, { ...old, ...fixed }, curYM),
          // Préserver les champs non envoyés par le modal (startYM, monthlyOverrides)
          startYM:        fixed.startYM !== undefined ? fixed.startYM : old.startYM,
          monthlyOverrides: old.monthlyOverrides,
          prevAmount:   amountChanged ? old.amount  : old.prevAmount,
          prevAmountYM: amountChanged ? curYM        : old.prevAmountYM,
        };
      } else {
        newFixed.push({ ...fixed, id: uid("f"), startYM: fixed.startYM || null });
      }
      return { ...state, fixedExpenses: newFixed };
    }

    case A.DELETE_FIXED: {
      const newFixed = [...state.fixedExpenses];
      newFixed.splice(action.idx, 1);
      return { ...state, fixedExpenses: newFixed };
    }

    case A.SAVE_FIXED_INCOME: {
      const { idx, income } = action;
      const newIncomes = [...(state.fixedIncomes || [])];
      if (idx != null) {
        const old = newIncomes[idx];
        newIncomes[idx] = withAutoAmount({
          ...old,
          ...income,
          pauseHistory: withPauseHistory({ ...old, pauseHistory: income.pauseHistory !== undefined ? income.pauseHistory : old.pauseHistory }, { ...old, ...income }),
          startYM: income.startYM !== undefined ? income.startYM : old.startYM,
          monthlyOverrides: old.monthlyOverrides,   // v1.50.0 : corrections « ce mois uniquement » conservées
        }, state.transactions || []);
      } else {
        newIncomes.push(withAutoAmount({ ...income, id: uid("fi"), startYM: income.startYM || null }, state.transactions || []));
      }
      return { ...state, fixedIncomes: newIncomes };
    }

    case A.DELETE_FIXED_INCOME: {
      const newIncomes = [...(state.fixedIncomes || [])];
      newIncomes.splice(action.idx, 1);
      return { ...state, fixedIncomes: newIncomes };
    }

    // ── Transfer between cagnottes ────────────────────────────────
    case A.EXECUTE_TRANSFER: {
      const { fromId, toId, amt, date, reason } = action;

      // Retrait vers le compte courant
      if (toId === "__account__") {
        const cag = state.cagnottes.find(c => c.id === fromId);
        const label = `Transfert ${cag?.name ?? "cagnotte"} → compte`;
        const newTx = {
          id: uid("ret"),
          type: "dissolution_cagnotte",
          amount: amt,
          date: date || (() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })(),
          targetCagId: fromId,
          note: reason ? `${label} — ${reason}` : label,
          withdrawReason: reason || null,
        };
        return {
          ...state,
          cagnottes: state.cagnottes.map(c =>
            c.id === fromId ? { ...c, current: c.current - amt } : c
          ),
          transactions: [...state.transactions, newTx],
        };
      }

      // Transfert entre cagnottes (comportement existant)
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
      // v1.47.0 : un seul niveau de sous-catégories — une catégorie qui a
      // déjà des sous-catégories ne peut pas devenir elle-même sous-catégorie.
      let { cat } = action;
      if ("parentId" in cat) {
        const hasChildren = cat.id && state.categories.some(c => c.parentId === cat.id);
        const parent = state.categories.find(c => c.id === cat.parentId);
        if (!cat.parentId || hasChildren || !parent || parent.parentId || parent.id === cat.id) {
          const { parentId, ...rest } = cat; cat = { ...rest, parentId: undefined };
        }
      }
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

    case A.DELETE_CATEGORY: {
      // v1.47.0 : suppression protégée — tout ce qui est rattaché est
      // déplacé vers `moveTo` (ou laissé sans catégorie si moveTo absent).
      // Avant : seules la catégorie disparaissait, les opérations gardaient
      // un categoryId orphelin.
      const { id } = action;
      const cats = state.categories || [];
      const target = action.moveTo && action.moveTo !== id ? cats.find(c => c.id === action.moveTo) : null;
      const to = target ? target.id : "";
      const fix = list => (list || []).map(x => x.categoryId === id ? { ...x, categoryId: to } : x);
      // Les sous-catégories suivent : elles passent sous la catégorie principale
      // de la cible, ou redeviennent principales sans cible.
      const newParent = target ? (target.parentId && target.parentId !== id ? target.parentId : target.id) : null;
      const categories = cats.filter(c => c.id !== id).map(c => {
        let n = c;
        if (c.parentId === id) {
          n = { ...n };
          if (newParent && newParent !== c.id) n.parentId = newParent; else delete n.parentId;
        }
        if (c.linkedToId === id) {
          n = { ...n };
          if (to && to !== c.id) n.linkedToId = to; else delete n.linkedToId;
        }
        return n;
      });
      const thresholds = { ...(state.categoryThresholds || {}) };
      if (thresholds[id]) {
        if (to && !thresholds[to]) thresholds[to] = thresholds[id];
        delete thresholds[id];
      }
      const gb = state.groceryBudget;
      const groceryBudget = gb && Array.isArray(gb.categoryIds) && gb.categoryIds.includes(id)
        ? { ...gb, categoryIds: [...new Set(gb.categoryIds.map(x => x === id ? to : x).filter(Boolean))] }
        : gb;
      return {
        ...state,
        categories,
        transactions:          fix(state.transactions),
        fixedExpenses:         fix(state.fixedExpenses),
        fixedIncomes:          fix(state.fixedIncomes),
        recurringTemplates:    fix(state.recurringTemplates),
        scheduledTransactions: fix(state.scheduledTransactions),
        quickTemplates:        fix(state.quickTemplates),
        offAccountEntries:     fix(state.offAccountEntries),
        provisionalExpenses:   fix(state.provisionalExpenses),
        categoryThresholds:    thresholds,
        groceryBudget,
      };
    }

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
    case A.ADD_BACKUP_ENTRY: {
      const entry = action.entry;
      const history = [entry, ...(state.backupHistory || [])].slice(0, 10);
      return { ...state, lastBackupDate: entry.date, backupHistory: history };
    }

    case A.TOGGLE_POINT_TX:
      return {
        ...state,
        transactions: state.transactions.map(t => {
          if (t.id !== action.id) return t;
          // Chèque (v1.43.0) : pointer = encaisser → l'opération passe à la date
          // du jour (règle : dépense datée à l'encaissement) ; dépointer la
          // ramène à sa date d'émission. La date d'émission n'est jamais perdue.
          if (t.paymentMethod === "cheque") {
            const issuedDate = t.issuedDate || t.date;
            return t.pointed
              ? { ...t, pointed: false, date: issuedDate, issuedDate }
              : { ...t, pointed: true, date: todayISO(), issuedDate };
          }
          return { ...t, pointed: !t.pointed };
        }),
      };

    // Encaissement d'un chèque à une date choisie (v1.43.0)
    case A.SAVE_PROJECT: {
      // v1.47.0 : crée au besoin la cagnotte et/ou le tag du projet (newCag /
      // newTag) et les relie au projet dans la même action.
      let { project, newCag, newTag } = action;
      let cagnottes = state.cagnottes, tags = state.tags || [];
      if (newCag) {
        const id = uid("cg");
        cagnottes = [...cagnottes, { ...newCag, id }];
        project = { ...project, cagId: id };
      }
      if (newTag) {
        const id = uid("tag");
        tags = [...tags, { ...newTag, id }];
        project = { ...project, tagId: id };
      }
      const list = state.projects || [];
      const projects = project.id && list.some(p => p.id === project.id)
        ? list.map(p => p.id === project.id ? { ...p, ...project } : p)
        : [...list, { ...project, id: uid("pj") }];
      return { ...state, cagnottes, tags, projects };
    }

    case A.DELETE_PROJECT:
      // La cagnotte et le tag sont conservés (l'argent et l'historique restent)
      return { ...state, projects: (state.projects || []).filter(p => p.id !== action.id) };

    case A.MARK_MONTH_RECAP:
      // v1.47.0 : mois (YYYY-MM) où la clôture a déjà été affichée → une seule fois
      return { ...state, lastMonthRecapShown: action.ym };

    case A.SET_APPEARANCE:
      return { ...state, ...(action.patch.appTheme ? { appTheme: action.patch.appTheme } : {}), ...(action.patch.glassEffects != null ? { glassEffects: !!action.patch.glassEffects } : {}) };

    case A.MARK_YEAR_RECAP:
      // v1.68.0 : année dont le bilan a déjà été proposé le 1er janvier
      return { ...state, lastYearRecapShown: action.year };

    case A.SAVE_GROCERY_BUDGET:
      return { ...state, groceryBudget: { ...(state.groceryBudget || DEFAULT_DATA.groceryBudget), ...action.settings } };

    case A.CASH_CHEQUE:
      return {
        ...state,
        transactions: state.transactions.map(t => t.id !== action.id ? t
          : { ...t, pointed: true, issuedDate: t.issuedDate || t.date, date: action.date }),
      };

    // v1.58.0 : change uniquement le jour de prélèvement/versement (aucun autre champ touché)
    case A.SET_FIXED_DAY: {
      const key = action.kind === "income" ? "fixedIncomes" : "fixedExpenses";
      // v1.64.0 : -1 / -2 = dernier / avant-dernier jour ouvré
      const n = parseInt(action.day, 10) || 1;
      const day = n === -1 || n === -2 ? n : Math.min(31, Math.max(1, n));
      return { ...state, [key]: (state[key] || []).map(f => f.id === action.id ? { ...f, day } : f) };
    }

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

    case A.TOGGLE_POINT_INCOME:
      return {
        ...state,
        fixedIncomes: (state.fixedIncomes || []).map(f => {
          if (f.id !== action.id) return f;
          const pointedMonths = { ...(f.pointedMonths || {}) };
          pointedMonths[action.ym] = !pointedMonths[action.ym];
          // Mode automatique : le montant d'un mois pointé est figé (sinon il suivrait la moyenne)
          const monthlyOverrides = f.amountMode === "auto" && pointedMonths[action.ym] && f.monthlyOverrides?.[action.ym]?.amount == null
            ? { ...(f.monthlyOverrides || {}), [action.ym]: { ...(f.monthlyOverrides?.[action.ym] || {}), amount: f.amount } }
            : f.monthlyOverrides;
          return withAutoAmount({ ...f, pointedMonths, monthlyOverrides }, state.transactions || []);
        }),
      };

    // v1.64.0 : pointé avec le montant réellement reçu (figé pour ce mois),
    // puis montant prévu recalculé si le revenu est en mode automatique
    case A.POINT_INCOME_AMOUNT:
      return {
        ...state,
        fixedIncomes: (state.fixedIncomes || []).map(f => {
          if (f.id !== action.id) return f;
          const amount = Math.round((parseFloat(action.amount) || 0) * 100) / 100;
          if (amount <= 0) return f;
          const monthlyOverrides = { ...(f.monthlyOverrides || {}), [action.ym]: { ...(f.monthlyOverrides?.[action.ym] || {}), amount } };
          const pointedMonths = { ...(f.pointedMonths || {}), [action.ym]: true };
          // v1.67.0 : mois exceptionnel (congé, prime…) → exclu de la moyenne du montant prévu
          const avgExcluded = { ...(f.avgExcluded || {}) };
          if (action.exclude) avgExcluded[action.ym] = true; else delete avgExcluded[action.ym];
          return withAutoAmount({ ...f, monthlyOverrides, pointedMonths, avgExcluded }, state.transactions || []);
        }),
      };

    case A.SAVE_PAY_RECAP:
      return { ...state, payRecaps: { ...(state.payRecaps || {}), [action.ym]: { ...(state.payRecaps?.[action.ym] || {}), ...action.patch } } };

    // v1.50.0 : correction d'un revenu fixe pour un seul mois (même format que les frais fixes)
    case A.OVERRIDE_INCOME_MONTH:
      return {
        ...state,
        fixedIncomes: (state.fixedIncomes || []).map(f => {
          if (f.id !== action.id) return f;
          const monthlyOverrides = { ...(f.monthlyOverrides || {}) };
          if (action.override) monthlyOverrides[action.ym] = action.override; // { amount, name }
          else delete monthlyOverrides[action.ym];
          return { ...f, monthlyOverrides };
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

    case A.MARK_ROUNDING_TRANSFERRED:
      return { ...state, roundingLastTransferDate: action.date };

    case A.SAVE_NOTIF_SETTINGS: {
      return { ...state, notifSettings: { ...state.notifSettings, ...action.settings } };
    }

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

    case A.SAVE_CAG_TYPE: {
      const { cagType } = action;
      const list = state.cagTypes || DEFAULT_CAG_TYPES;
      if (cagType.id && list.some(t => t.id === cagType.id)) {
        return { ...state, cagTypes: list.map(t => t.id === cagType.id ? { ...t, ...cagType } : t) };
      }
      return { ...state, cagTypes: [...list, { ...cagType, id: uid("ct") }] };
    }

    // Supprime un type : les cagnottes qui l'utilisaient passent « sans type »
    // (argent, objectif et historique inchangés).
    case A.DELETE_CAG_TYPE:
      return {
        ...state,
        cagTypes: (state.cagTypes || DEFAULT_CAG_TYPES).filter(t => t.id !== action.id),
        cagnottes: state.cagnottes.map(c => c.cagType === action.id ? { ...c, cagType: null } : c),
      };

    case A.SAVE_SIDE_AMOUNT_TYPE: {
      const { sat } = action;
      const list = state.sideAmountTypes || [];
      if (sat.id) {
        return { ...state, sideAmountTypes: list.map(s => s.id === sat.id ? { ...s, ...sat } : s) };
      }
      return { ...state, sideAmountTypes: [...list, { ...sat, id: uid("sat") }] };
    }

    case A.DELETE_SIDE_AMOUNT_TYPE:
      return {
        ...state,
        sideAmountTypes: (state.sideAmountTypes || []).filter(s => s.id !== action.id),
        offAccountEntries: (state.offAccountEntries || []).filter(e => e.satId !== action.id),
        transactions: state.transactions.map(t => {
          if (!t.sideAmounts || !(action.id in t.sideAmounts)) return t;
          const sideAmounts = { ...t.sideAmounts };
          delete sideAmounts[action.id];
          return { ...t, sideAmounts };
        }),
      };

    case A.SAVE_SCHEDULED: {
      const { scheduled } = action;
      if (scheduled.id) {
        return { ...state, scheduledTransactions: (state.scheduledTransactions||[]).map(s => s.id===scheduled.id ? {...s,...scheduled} : s) };
      }
      return { ...state, scheduledTransactions: [...(state.scheduledTransactions||[]), { ...scheduled, id: uid("sch"), confirmed: false }] };
    }

    case A.DELETE_SCHEDULED:
      return { ...state, scheduledTransactions: (state.scheduledTransactions||[]).filter(s => s.id !== action.id) };

    case A.CONFIRM_SCHEDULED: {
      const s = (state.scheduledTransactions||[]).find(s => s.id === action.id);
      if (!s) return state;
      const newTx = {
        id: uid("scht"),
        type: "expense",
        amount: parseFloat(s.amount),
        date: s.date,
        categoryId: s.categoryId,
        note: s.note || "",
        fromScheduled: true,
      };
      return {
        ...state,
        transactions: [...state.transactions, newTx],
        scheduledTransactions: (state.scheduledTransactions||[]).filter(s => s.id !== action.id),
      };
    }

    case A.SAVE_AUTO_SAVING: {
      const { plan } = action;
      if (plan.id) {
        return { ...state, autoSavings: (state.autoSavings||[]).map(p => p.id===plan.id ? {...p,...plan} : p) };
      }
      // Nouveau plan : si le jour déclencheur est déjà passé ce mois-ci,
      // on marque le mois courant comme appliqué → démarrage le mois prochain
      const now    = new Date();
      const today  = now.getDate();
      const curYM  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
      const lastAppliedYm = today >= plan.dayOfMonth ? curYM : null;
      return { ...state, autoSavings: [...(state.autoSavings||[]), { ...plan, id: uid("as"), lastAppliedYm }] };
    }

    case A.DELETE_AUTO_SAVING:
      return { ...state, autoSavings: (state.autoSavings||[]).filter(p => p.id !== action.id) };

    case A.APPLY_AUTO_SAVING: {
      const plan = (state.autoSavings||[]).find(p => p.id === action.planId);
      if (!plan) return state;
      const newTx = {
        id: uid("ast"),
        type: "epargne",
        amount: parseFloat(plan.amount),
        date: action.date,
        targetCagId: plan.cagnotteId,
        note: "Versement automatique",
        isAutoSaving: true,
        autoSavingId: plan.id,
      };
      return {
        ...state,
        transactions: [...state.transactions, newTx],
        cagnottes: state.cagnottes.map(c =>
          c.id === plan.cagnotteId ? { ...c, current: c.current + parseFloat(plan.amount) } : c
        ),
        autoSavings: state.autoSavings.map(p =>
          p.id === action.planId ? { ...p, lastAppliedYm: action.ym } : p
        ),
      };
    }

    // v1.75.0 : réglages de sécurité complémentaires (liste blanche des champs)
    case A.SAVE_SECURITY_EXTRA: {
      const p = action.patch || {};
      const out = { ...state };
      if ([0, 1, 5, 15, -1].includes(p.relockDelay)) out.relockDelay = p.relockDelay;
      if ([0, 3, 5, 10].includes(p.pinMaxTries))     out.pinMaxTries = p.pinMaxTries;
      if (typeof p.openHidden === "boolean")         out.openHidden  = p.openHidden;
      if ("backupKey" in p)                          out.backupKey   = p.backupKey || null;
      return out;
    }
    case A.SAVE_SECURITY_SETTINGS:
      return { ...state, pinEnabled: action.pinEnabled, pinHash: action.pinHash, bioEnabled: action.bioEnabled };

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
      return normalizeData(action.data);

    case A.CLEAR_WARNING:
      return { ...state, warning: null };

    case A.SAVE_PROJECTION_SNAPSHOT: {
      const { ym, predictedValue } = action;
      // Déjà figé pour ce mois : on ne réécrit jamais — et on renvoie le MÊME
      // state (pas de copie) pour ne pas déclencher de re-render en boucle.
      // v1.62.0 : seule la projection faite le mois d'avant (horizon 1) est
      // figée ; une ancienne valeur (faite jusqu'à 3 mois avant, sans horizon)
      // est remplacée une fois, puis plus jamais.
      if (state.projectionSnapshots?.[ym]?.horizon === 1) return state;
      return {
        ...state,
        projectionSnapshots: {
          ...state.projectionSnapshots,
          [ym]: { predictedValue, predictedOn: todayISO(), horizon: 1 },
        },
      };
    }

    case A.SAVE_QUICK_TEMPLATE: {
      const tpl = action.tpl;
      const existing = (state.quickTemplates || []).find(t => t.id === tpl.id);
      if (existing) {
        return {
          ...state,
          quickTemplates: state.quickTemplates.map(t => t.id === tpl.id ? { ...t, ...tpl } : t),
        };
      }
      return {
        ...state,
        quickTemplates: [...(state.quickTemplates || []), { ...tpl, id: tpl.id || uid("qt") }],
      };
    }

    case A.SAVE_OFF_ACCOUNT: {
      const e = action.entry;
      const list = state.offAccountEntries || [];
      if (e.id && list.some(x => x.id === e.id)) {
        return { ...state, offAccountEntries: list.map(x => x.id === e.id ? { ...x, ...e } : x) };
      }
      return { ...state, offAccountEntries: [...list, { ...e, id: uid("off") }] };
    }

    case A.DELETE_OFF_ACCOUNT:
      return { ...state, offAccountEntries: (state.offAccountEntries || []).filter(x => x.id !== action.id) };

    case A.DELETE_QUICK_TEMPLATE:
      return { ...state, quickTemplates: (state.quickTemplates || []).filter(t => t.id !== action.id) };

    case A.RESET:
      return DEFAULT_DATA;

    default:
      return state;
  }
}
