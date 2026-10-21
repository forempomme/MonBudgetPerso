import { useReducer, useEffect, useState, useCallback, useRef, useMemo } from "react";
import "./styles.css";
import { reducer, DEFAULT_DATA, A, normalizeData } from "./store.js";
import { LS_KEY, uid, fmt, todayISO, APP_NAME, APP_VERSION, currentYM, getPrevMonth, recurringRefDate, chequeExpiryISO, fixedCashYM, fixedCashDateISO, MONTHS_SHORT, fixedAmountFor, DEFAULT_CAG_TYPES } from "./utils.js";
import { useBalanceWithRecurring, categoryUsage, computeMonthRecap, detectInsights, computePayRecap, mainPayIncome, computeBalanceBreakdown, computeProjection, computeYearRecap } from "./hooks.js";
import { PayRecapSheet } from "./views/PayRecapSheet.jsx";
import { YearRecapSheet } from "./views/YearRecapSheet.jsx";
import { MonthRecapSheet } from "./views/MonthRecapSheet.jsx";
import { ToastCtx } from "./context.js";
import { ToastContainer } from "./components/index.jsx";
import { ReleveCompare } from "./views/ReleveCompare.jsx";
import {
  TransModal, FixedModal, FixedIncomeModal, CagModal, TransferModal, CatModal,
  ScheduledModal, DeleteCategoryModal, ImportPreviewModal, ProjectModal, ReimbursementModal,
  ConfirmModal, DetailModal, CagHistModal,
  QuickTemplateSheet, QuickTemplateManagerModal, OffAccountModal, CagTypesModal, PointIncomeModal,
} from "./components/modals.jsx";
import {
  AccueilView, CagnottesView, HistoriqueView,
  FixesView, RapportView, OptionsView, LockScreen,
} from "./views.jsx";

// ─────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────
const TABS = [
  ["accueil",    "🏠", "Accueil"],
  ["cagnottes",  "🐷", "Cagnottes"],
  ["historique", "📋", "Historique"],
  ["fixes",      "📌", "Fixes"],
  ["rapport",    "📊", "Rapport"],
  ["options",    "⚙️",  "Options"],
];
const getNextYM = ym => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
// v1.49.0 : le titre d'une page = son emoji + son libellé du menu du bas
// (avant : « Tableau de bord », « Frais Fixes », « Rapport Annuel »… ≠ menu).
// Le sous-titre de contexte est calculé dans le rendu (pageSubtitle).
const PAGE_TITLES = Object.fromEntries(TABS.map(([k, icon, label]) => [k, { icon, label }]));
const MONTHS_LC = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

// ─────────────────────────────────────────────────────────────────
//  Load initial state
// ─────────────────────────────────────────────────────────────────
function loadState() {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (!s) return DEFAULT_DATA;
    // Même normalisation que l'import d'une sauvegarde (store.js)
    return normalizeData(JSON.parse(s));
  } catch {
    return DEFAULT_DATA;
  }
}

// ─────────────────────────────────────────────────────────────────
//  App
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
//  Rappel du soir (v1.48.0) : les 7 prochains soirs à l'heure choisie,
//  sauf les jours où une opération (ou une dépense hors compte) existe déjà.
// ─────────────────────────────────────────────────────────────────
function eveningReminders(ns, data, now) {
  if (!ns?.enabled || !ns.evening) return [];
  const hour = Math.min(23, Math.max(0, parseInt(ns.eveningHour, 10) || 21));
  const days = ns.eveningDays || "all";
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const used = new Set([...(data.transactions || []), ...(data.offAccountEntries || [])].map(t => t.date));
  const out = [];
  for (let i = 0; i < 7; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, 0, 0);
    if (at <= now) continue;
    const dow = at.getDay();   // 0 = dimanche
    if (days === "week" && (dow === 0 || dow === 6)) continue;
    if (days === "weekend" && dow !== 0 && dow !== 6) continue;
    if (used.has(iso(at))) continue;
    const jour = at.toLocaleDateString("fr-FR", { weekday: "long" });
    out.push({ id: 900 + i, title: "🌙 Une dépense aujourd'hui ?", body: `Rien n'a été saisi ce ${jour}. Un petit tap pour garder ton solde juste.`,
      schedule: { at, allowWhileIdle: true }, channelId: "budget", actionTypeId: "EVENING" });
  }
  return out;
}

export default function App() {
  const [data, dispatch] = useReducer(reducer, undefined, loadState);
  const [year, setYear]  = useState(new Date().getFullYear());
  // Mois affiché dans l'Historique — remonté par HistoriqueView pour le sous-titre (v1.49.0)
  const [rapSub, setRapSub] = useState("");   // v1.52.0 : sous-titre du Rapport (mois ou année affichés)
  const [histYM, setHistYM] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  // Nécessaire pour l'alerte "solde bas" des notifications — même formule
  // que le solde estimé affiché sur l'accueil (voir hooks.js)
  const currentBalance = useBalanceWithRecurring(
    data.transactions, data.fixedExpenses, data.fixedIncomes || [],
    data.recurringTemplates || [], data.scheduledTransactions || [],
    data.reimbursements || [], (parseInt(data.restSettings?.reimbLateDays, 10) || 15)
  );

  const [tabHistory, setTabHistory] = useState(["accueil"]);
  const tab = tabHistory[tabHistory.length - 1];
  const [slideDir, setSlideDir]     = useState(0);
  const [animKey,  setAnimKey]      = useState(0);

  // Scroll en haut à chaque changement d'onglet — après la définition de tab
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.querySelector(".container")?.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);

  const TAB_ORDER = ["accueil","cagnottes","historique","fixes","rapport","options"];

  // Naviguer vers un onglet : empiler si différent du courant
  const navigateTo = useCallback((newTab) => {
    setTabHistory(prev => {
      const cur = prev[prev.length - 1];
      if (cur === newTab) return prev;
      const curIdx = TAB_ORDER.indexOf(cur);
      const newIdx = TAB_ORDER.indexOf(newTab);
      setSlideDir(newIdx > curIdx ? 1 : -1);
      setAnimKey(k => k + 1);
      return [...prev, newTab];
    });
  }, []);

  // Retour arrière : dépiler
  const saveMonthNote   = useCallback((ym, note) => dispatch({ type: A.SAVE_MONTH_NOTE, ym, note }), []);
  const saveRecurring      = useCallback(tpl => dispatch({ type: A.SAVE_RECURRING, tpl }), []);
  const deleteRecurring    = useCallback(id  => dispatch({ type: A.DEL_RECURRING,  id  }), []);
  const saveAutoSaving        = useCallback(plan => dispatch({ type: A.SAVE_AUTO_SAVING, plan }), []);
  const deleteAutoSaving      = useCallback(id   => dispatch({ type: A.DELETE_AUTO_SAVING, id }), []);
  const saveSecuritySettings  = useCallback((pinEnabled, pinHash, bioEnabled) =>
    dispatch({ type: A.SAVE_SECURITY_SETTINGS, pinEnabled, pinHash, bioEnabled }), []);

  // ── Verrou PIN ────────────────────────────────────────────────
  const [locked, setLocked] = useState(() => !!(data.pinEnabled && data.pinHash));

  const saveAlertSettings      = useCallback((enabled, threshold) =>
    dispatch({ type: A.SAVE_ALERT_SETTINGS, enabled, threshold }), []);
  const saveCategoryThreshold  = useCallback((catId, threshold) =>
    dispatch({ type: A.SAVE_CATEGORY_THRESHOLD, catId, threshold }), []);
  const saveRoundingSettings      = useCallback((enabled, cagnotteId, rule) =>
    dispatch({ type: A.SAVE_ROUNDING_SETTINGS, enabled, cagnotteId, rule }), []);
  const saveNotifSettings = useCallback(settings => dispatch({ type: A.SAVE_NOTIF_SETTINGS, settings }), []);

  // Planification des notifs — appelée UNIQUEMENT depuis Options (action utilisateur explicite)
  // Jamais au démarrage pour éviter l'écran noir post-biométrie
  // ── Notifications locales (v1.40.0) ────────────────────────────
  // opts.silent  : replanification automatique au démarrage — pas de popup
  //                de permission, pas de toast (voir useEffect plus bas).
  // opts.test    : ajoute une notification de test dans 5 s (bouton Options).
  const scheduleNotifications = useCallback(async (ns, opts = {}) => {
    const { silent = false, test = false } = opts;
    // v1.48.0 : les réglages passés depuis Options ne contiennent pas tous les champs
    ns = { ...(data.notifSettings || {}), ...(ns || {}) };
    const say = (msg, type) => { if (!silent) addToast(msg, type); };
    try {
      let LN = null;
      try { LN = (await import("@capacitor/local-notifications")).LocalNotifications; } catch { /* navigateur */ }
      if (!LN || !window?.Capacitor?.isNativePlatform?.()) {
        say("Notifications indisponibles hors de l'app Android", "error");
        return;
      }
      // Au démarrage on ne fait QUE vérifier (jamais de popup système, cause
      // de l'écran noir post-biométrie en 1.39.1) ; la demande n'a lieu que
      // sur une action explicite dans Options.
      const perm = silent ? await LN.checkPermissions() : await LN.requestPermissions();
      if (perm.display !== "granted") {
        say("Notifications refusées — autorise-les dans les réglages Android de l'app", "error");
        return;
      }
      // Canal obligatoire sur Android 8+ : sans lui, rien ne s'affiche.
      try {
        await LN.createChannel({
          id: "budget", name: "Gestion du Budget",
          description: "Rappels : récurrentes, versements automatiques, dépenses prévues, sauvegarde, solde bas",
          importance: 4, visibility: 1, vibration: true,
        });
      } catch (e) { console.warn("createChannel:", e); }

      // On annule TOUT ce qui est en attente (et plus seulement les ids 1→30,
      // qui laissaient des doublons au-delà de 10 dépenses programmées).
      const { notifications: already = [] } = await LN.getPending();
      if (already.length) await LN.cancel({ notifications: already.map(n => ({ id: n.id })) });
      if (!ns?.enabled) { say("Notifications désactivées", "info"); return; }

      const pending = [];
      const now = new Date();
      const fmtAmt = n => new Intl.NumberFormat("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(n))+" €";
      const at9 = (y, m, d) => new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()), 9, 0, 0);
      const tomorrowAt = h => { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d; };
      const push = (id, title, body, at) => pending.push({ id, title, body, schedule: { at, allowWhileIdle: true }, channelId: "budget" });

      // v1.46.2 : ne compte que les récurrentes qui tomberont vraiment le mois
      // prochain (avant : le nombre total de modèles, même terminés)
      if (ns.recurring) {
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const curYMn = currentYM();
        const due = (data.recurringTemplates || []).filter(tpl => {
          if (!(parseFloat(tpl.amount) > 0)) return false;
          if (tpl.frequency === "yearly") return nextMonth.getMonth() === 0;   // revient en janvier
          const confirmed = (data.transactions || []).filter(t => t.templateId === tpl.id);
          const doneThisMonth = confirmed.some(t => recurringRefDate(t).startsWith(curYMn));
          const effective = confirmed.length + (doneThisMonth ? 0 : 1);       // ce mois-ci compte comme fait
          return tpl.occurrences == null || effective < tpl.occurrences;
        }).length;
        if (due > 0) push(1, "🔄 Récurrentes à confirmer", `${due} récurrente${due > 1 ? "s" : ""} à confirmer ce mois`,
          at9(now.getFullYear(), now.getMonth() + 1, 1));
      }
      // Prochaine occurrence : ce mois-ci si le jour n'est pas passé, sinon le
      // mois suivant (avant : rien n'était programmé si le jour était passé).
      if (ns.autoSaving) {
        (data.autoSavings||[]).filter(p => p.enabled).forEach((p, i) => {
          let d = at9(now.getFullYear(), now.getMonth(), p.dayOfMonth);
          if (d <= now) d = at9(now.getFullYear(), now.getMonth() + 1, p.dayOfMonth);
          const cag = data.cagnottes.find(c => c.id === p.cagnotteId);
          push(100 + i, "🐷 Versement automatique", `${fmtAmt(p.amount)} → ${cag?.name || "cagnotte"}`, d);
        });
      }
      if (ns.scheduled) {
        (data.scheduledTransactions||[]).filter(s => !s.confirmed).forEach((s, i) => {
          const veille = new Date(new Date(s.date + "T09:00:00").getTime() - 86400000);
          if (veille > now) push(200 + i, "📅 Dépense prévue demain", `${fmtAmt(s.amount)}${s.note ? " — " + s.note : ""}`, veille);
        });
      }
      // Sauvegarde : aussi quand il n'y en a JAMAIS eu (avant : aucun rappel).
      if (ns.backup) {
        const days = data.lastBackupDate ? Math.floor((Date.now() - new Date(data.lastBackupDate)) / 86400000) : null;
        if (days == null || days >= 7) {
          push(5, "💾 Sauvegarde recommandée",
            days == null ? "Tu n'as encore jamais sauvegardé tes données" : `Dernière sauvegarde il y a ${days} jours`,
            tomorrowAt(19));
        }
      }
      // Solde bas : rappel le lendemain matin (replanifié à chaque ouverture,
      // donc pas de notification à chaque lancement de l'app).
      if (ns.alertSolde && data.alertEnabled && currentBalance < (data.alertThreshold ?? 500)) {
        push(6, "🔔 Solde bas", `Ton solde estimé est de ${fmtAmt(currentBalance)}, sous ton seuil de ${fmtAmt(data.alertThreshold ?? 500)}`,
          tomorrowAt(9));
      }
      // Chèques non encaissés (v1.43.0) : un rappel tous les N jours (30 par
      // défaut) tant que le chèque n'est pas encaissé — jamais quotidien —, et
      // un rappel un mois avant qu'il ne soit plus encaissable (1 an et 8 j).
      if (ns.cheques !== false) {
        const delay = Math.max(7, parseInt(ns.chequeDelay, 10) || 30);
        (data.transactions || []).filter(t => t.paymentMethod === "cheque" && !t.pointed).slice(0, 50).forEach((t, i) => {
          const issued = t.issuedDate || t.date;
          const [y, m, d] = issued.split("-").map(Number);
          const label = `${t.note || "Chèque"} · ${fmtAmt(t.amount)}${t.chequeNumber ? " · n°" + t.chequeNumber : ""}`;
          // Prochain multiple de `delay` jours après l'émission, dans le futur
          let k = 1, at;
          do { at = new Date(y, m - 1, d + delay * k, 9, 0, 0); k++; } while (at <= now && k < 60);
          if (at > now) push(300 + i, `🧾 Chèque non encaissé depuis ${delay * (k - 1)} jours`, label, at);
          const exp = chequeExpiryISO(issued).split("-").map(Number);
          const warn = new Date(exp[0], exp[1] - 1, exp[2] - 30, 9, 0, 0);
          if (warn > now) push(400 + i, "🧾 Chèque bientôt périmé", `${label} — plus encaissable après le ${String(exp[2]).padStart(2, "0")}/${String(exp[1]).padStart(2, "0")}/${exp[0]}`, warn);
        });
      }
      // v1.48.0 : remboursements attendus en retard (15 j après la date prévue, puis chaque semaine)
      if (ns.reimbursements !== false) {
        (data.reimbursements || []).filter(r => r.status !== "received" && r.expectedDate).slice(0, 50).forEach((r, i) => {
          const [y, m, d] = r.expectedDate.split("-").map(Number);
          let k = 0, at;
          do { at = new Date(y, m - 1, d + 15 + 7 * k, 9, 0, 0); k++; } while (at <= now && k < 60);
          if (at > now) push(500 + i, "↩️ Remboursement en attente",
            `${r.from || "Remboursement"} : ${fmtAmt(r.amount)} attendus depuis le ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`, at);
        });
      }
      // v1.48.0 : rappel du soir (7 prochains soirs, sauf ceux où une opération existe déjà)
      eveningReminders(ns, data, now).forEach(n => pending.push(n));
      if (test) push(9, "✅ Notifications actives", "Tes rappels Gestion du Budget fonctionnent.", new Date(Date.now() + 5000));

      if (pending.length > 0) await LN.schedule({ notifications: pending });
      say(test ? `Notification de test dans 5 s · ${pending.length - 1} rappel(s) programmé(s)` : `${pending.length} rappel(s) programmé(s)`, "success");
    } catch (e) {
      console.warn("LocalNotifications:", e);
      say("Erreur lors de la programmation des notifications", "error");
    }
  // addToast est défini plus bas mais stable (useCallback sans dépendance) :
  // il est lu au moment de l'appel, jamais au rendu — pas dans les deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.recurringTemplates, data.autoSavings, data.scheduledTransactions, data.lastBackupDate, data.cagnottes, currentBalance, data.alertEnabled, data.alertThreshold, data.transactions, data.reimbursements, data.notifSettings, data.offAccountEntries]);

  // ── Rappel du soir (v1.48.0) : reprogrammé à chaque saisie, pour annuler
  // celui du jour dès qu'une opération est enregistrée ───────────────
  useEffect(() => {
    if (!window?.Capacitor?.isNativePlatform?.()) return;
    const id = setTimeout(async () => {
      try {
        const { LocalNotifications: LN } = await import("@capacitor/local-notifications");
        const perm = await LN.checkPermissions();
        if (perm.display !== "granted") return;
        await LN.cancel({ notifications: Array.from({ length: 7 }, (_, i) => ({ id: 900 + i })) });
        const ns = data.notifSettings || {};
        if (!ns.enabled) return;
        const list = eveningReminders(ns, data, new Date());
        if (list.length) await LN.schedule({ notifications: list });
      } catch (e) { console.warn("evening reminders:", e); }
    }, 1500);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.transactions, data.offAccountEntries, data.notifSettings]);

  // Boutons de la notification du soir : « Saisir » / « Rien aujourd'hui »
  useEffect(() => {
    if (!window?.Capacitor?.isNativePlatform?.()) return;
    let handle = null;
    (async () => {
      try {
        const { LocalNotifications: LN } = await import("@capacitor/local-notifications");
        await LN.registerActionTypes({ types: [{ id: "EVENING", actions: [
          { id: "add", title: "Saisir", foreground: true },
          { id: "none", title: "Rien aujourd'hui" },
        ] }] });
        handle = await LN.addListener("localNotificationActionPerformed", ev => {
          const nid = ev?.notification?.id;
          if (nid >= 900 && nid <= 906 && ev.actionId !== "none") setTransModal({ editingId: null, defaultType: "expense" });
        });
      } catch (e) { console.warn("notification actions:", e); }
    })();
    return () => { handle?.remove?.(); };
  }, []);
  const markRoundingTransferred   = useCallback(() =>
    dispatch({ type: A.MARK_ROUNDING_TRANSFERRED, date: (() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })() }), []);
  const saveTag                = useCallback(tag  => dispatch({ type: A.SAVE_TAG,    tag  }), []);
  const deleteTag              = useCallback(id   => dispatch({ type: A.DELETE_TAG,  id   }), []);
  const saveSideAmountType     = useCallback(sat  => dispatch({ type: A.SAVE_SIDE_AMOUNT_TYPE,   sat }), []);
  const deleteSideAmountType   = useCallback(id   => dispatch({ type: A.DELETE_SIDE_AMOUNT_TYPE, id  }), []);

  const togglePointTx  = useCallback(id => dispatch({ type: A.TOGGLE_POINT_TX,  id }), []);
  const togglePointFix    = useCallback((id, ym) => dispatch({ type: A.TOGGLE_POINT_FIX, id, ym }), []);
  // v1.64.0 : un revenu au montant « automatique » se pointe avec son montant réel
  const [pointIncome, setPointIncome] = useState(null); // null | { id, ym }
  // v1.66.0 : récap du mois affiché quand on pointe la paie (revenu fixe principal)
  const [payRecap, setPayRecap] = useState(null);       // null | { id, ym, amount }
  const togglePointIncome = useCallback((id, ym) => {
    const f = (data.fixedIncomes || []).find(x => x.id === id);
    if (f?.amountMode === "auto" && !f.pointedMonths?.[ym]) { setPointIncome({ id, ym }); return; }
    dispatch({ type: A.TOGGLE_POINT_INCOME, id, ym });
    if (f && !f.pointedMonths?.[ym] && mainPayIncome(data)?.id === id)
      setPayRecap({ id, ym, amount: fixedAmountFor(f, ym) });
  }, [data]);
  const saveQuickTemplate   = useCallback(tpl => dispatch({ type: A.SAVE_QUICK_TEMPLATE, tpl }), []);
  const deleteQuickTemplate = useCallback(id  => dispatch({ type: A.DELETE_QUICK_TEMPLATE, id }), []);

  const overrideFixMonth  = useCallback((id, ym, override) => dispatch({ type: A.OVERRIDE_FIX_MONTH, id, ym, override }), []);
  const overrideIncomeMonth = useCallback((id, ym, override) => dispatch({ type: A.OVERRIDE_INCOME_MONTH, id, ym, override }), []);

  // Filtre pointage partagé entre AccueilView et HistoriqueView
  const [histPointFilter, setHistPointFilter] = useState("all");

  const goToHistoriqueWithFilter = useCallback((filter) => {
    setHistPointFilter(filter);
    navigateTo("historique");
  }, [navigateTo]);

  const goBack = useCallback(() => {
    setTabHistory(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  }, []);

  const canGoBack = tabHistory.length > 1;

  // ── React-controlled theme ───────────────────────────────────
  // v1.49.0 : bouton ☀️ retiré de l'en-tête (thème clair inutilisé). Le thème
  // clair reste dans styles.css, mais l'appli démarre toujours en sombre pour
  // que personne ne reste bloqué en clair sans bouton pour revenir.
  const [theme] = useState("dark");
  useEffect(() => {
    document.documentElement.className = theme === "light" ? "light" : "";
    localStorage.setItem("theme", theme);
  }, [theme]);
  // v1.70.0 : apparence — « Verre bleu » Abysse (défaut), Glacier, ou Aube (thème d'origine, inchangé)
  useEffect(() => {
    const t = ["abysse", "glacier", "aube"].includes(data.appTheme) ? data.appTheme : "abysse";
    document.documentElement.dataset.theme = t;
    document.documentElement.dataset.glass = data.glassEffects === false ? "off" : "on";
  }, [data.appTheme, data.glassEffects]);

  // ── App title ────────────────────────────────────────────────
  useEffect(() => { document.title = APP_NAME; }, []);

  // ── Versements automatiques ───────────────────────────────────
  // Déclenchement au démarrage uniquement (cold start)
  useEffect(() => {
    const now   = new Date();
    // ⚠️ Heure LOCALE (pas toISOString UTC) — cohérent avec currentYM() partout dans l'app
    const ym    = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const today = now.getDate();
    const date  = `${ym}-${String(today).padStart(2,"0")}`;

    (data.autoSavings || []).forEach(plan => {
      if (!plan.enabled)             return;
      if (plan.lastAppliedYm === ym) return;
      if (today < plan.dayOfMonth)   return;
      // Double-garde : vérifier qu'aucune transaction autoSaving pour ce plan ce mois n'existe déjà
      // Protège contre un double déclenchement si lastAppliedYm était mal enregistré (bug UTC)
      const alreadyApplied = (data.transactions || []).some(
        t => t.isAutoSaving && t.autoSavingId === plan.id && t.date.startsWith(ym)
      );
      if (alreadyApplied) return;
      dispatch({ type: A.APPLY_AUTO_SAVING, planId: plan.id, ym, date });
    });

    // Confirmation automatique des transactions programmées du mois courant
    (data.scheduledTransactions || []).forEach(s => {
      if (s.confirmed) return;
      if (!s.date.startsWith(ym)) return;
      const scheduledDay = parseInt(s.date.slice(8), 10);
      if (today < scheduledDay) return;
      dispatch({ type: A.CONFIRM_SCHEDULED, id: s.id });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist to localStorage on every data change ─────────────
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }, [data]);

  // ── Toast system ─────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((msg, type = "success") => {
    const id = uid("toast");
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // ── Avertissements ponctuels émis par le reducer (ex: cagnotte d'arrondi
  //    introuvable) : on les affiche en toast puis on les efface aussitôt,
  //    pour ne pas les réafficher au prochain render.
  useEffect(() => {
    if (data.warning) {
      addToast(data.warning, "error");
      dispatch({ type: A.CLEAR_WARNING });
    }
  }, [data.warning, addToast]);

  // ── File import ref ──────────────────────────────────────────
  const importRef = useRef();

  // ── Back stack : couches internes aux vues (sheets, panels) ─────
  const backStackRef = useRef([]);
  const backIdRef    = useRef(0);
  const pushBack = useCallback(fn => {
    const id = ++backIdRef.current;
    backStackRef.current = [...backStackRef.current, { id, fn }];
  }, []);
  const popBack = useCallback(() => {
    backStackRef.current = backStackRef.current.slice(0, -1);
  }, []);

  // ── Bouton retour physique Android via @capacitor/app ────────
  // Ref toujours fraîche pour éviter les stale closures dans le listener
  const backHandlerRef = useRef(null);

  backHandlerRef.current = () => {
    // Priorité 1 : fermer le modal le plus récent (niveau app)
    if (confirmModal)  { setConfirmModal(null);   return; }
    if (cagTypesOpen)  { setCagTypesOpen(false);  return; }
    if (releveOpen)    { setReleveOpen(false);    return; }
    if (cagHistModal)  { setCagHistModal(null);   return; }
    if (detailModal)   { setDetailModal(null);    return; }
    if (deleteCatId)   { setDeleteCatId(null);    return; }
    if (importPreview) { setImportPreview(null);  return; }
    if (yearRecap)     { setYearRecap(null);      return; }
    if (recapYM)       { closeMonthRecap();       return; }
    if (projectModal)  { setProjectModal(null);   return; }
    if (reimbModal)    { setReimbModal(null);     return; }
    if (catModal)      { setCatModal(null);       return; }
    if (transferModal) { setTransferModal(false); return; }
    if (cagModal)      { setCagModal(null);       return; }
    if (fixedModal)    { setFixedModal(null);       return; }
    if (fixedIncomeModal) { setFixedIncomeModal(null); return; }
    if (pointIncome)   { setPointIncome(null);    return; }
    if (payRecap)      { setPayRecap(null);       return; }
    if (transModal)    { setTransModal(null);     return; }
    // Priorité 2 : fermer la couche interne à la vue (sheet, panel…)
    if (backStackRef.current.length > 0) {
      const top = backStackRef.current[backStackRef.current.length - 1];
      backStackRef.current = backStackRef.current.slice(0, -1);
      top.fn();
      return;
    }
    // Priorité 3 : onglet précédent
    if (canGoBack) { goBack(); return; }
    // Rien → quitter l'app (Capacitor gère le comportement système)
  };

  useEffect(() => {
    let listener = null;
    async function register() {
      if (window.Capacitor?.isNativePlatform?.()) {
        const { App: CapApp } = await import("@capacitor/app");
        listener = await CapApp.addListener("backButton", () => {
          backHandlerRef.current();
        });
      } else {
        // Fallback web : touche Échap
        const onKey = (e) => { if (e.key === "Escape") backHandlerRef.current(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }
    }
    const cleanup = register();
    return () => {
      cleanup?.then?.(fn => fn?.());
      listener?.remove?.();
    };
  }, []);

  // Using a discriminated union pattern: null = closed, object = open with config
  const [transModal,    setTransModal]    = useState(null);
  const [scheduledModal,setScheduledModal]= useState(false); // null | { editingId: string|null, defaultType?: string }
  const [fabOpen,       setFabOpen]       = useState(false);
  const [quickFanOpen,   setQuickFanOpen]   = useState(false);   // éventail de templates (appui long sur +)
  // Appui long sur le FAB (450ms) : ouvre l'éventail de templates au lieu
  // du menu habituel. Un tap court garde le comportement existant.
  const fabPressTimer   = useRef(null);
  const fabLongPressed  = useRef(false);
  const handleFabPressStart = useCallback((e) => {
    e?.preventDefault?.(); // évite la sélection de texte / le menu contextuel natif sur l'appui long
    fabLongPressed.current = false;
    // v1.74.0 : si un menu (éventail ou opérations) est déjà ouvert, le prochain appui sert à le fermer
    if (quickFanOpen || fabOpen) return;
    fabPressTimer.current = setTimeout(() => {
      fabLongPressed.current = true;
      setQuickFanOpen(true);
    }, 450);
  }, [quickFanOpen, fabOpen]);
  const handleFabPressEnd = useCallback(() => {
    clearTimeout(fabPressTimer.current);
  }, []);
  const handleFabClick = useCallback(() => {
    if (fabLongPressed.current) { fabLongPressed.current = false; return; }
    // v1.74.0 : appui sur + avec l'éventail des modèles ouvert → on le ferme (avant : le menu s'ouvrait par-dessus)
    if (quickFanOpen) { setQuickFanOpen(false); return; }
    setFabOpen(o => !o);
  }, [quickFanOpen]);
  // Dépenses hors compte / rechargements (v1.42.0) : null | { mode, entry?, satId? }
  const [offModal,       setOffModal]       = useState(null);
  const [quickEditTpl,   setQuickEditTpl]   = useState(null);    // template en cours de saisie (sheet montant/date)
  const [releveOpen, setReleveOpen] = useState(false);   // v1.63.0 : comparaison avec un relevé (lecture seule)
  const [cagTypesOpen, setCagTypesOpen] = useState(false); // v1.56.0 : gestion des types de cagnotte
  const [quickManagerOpen, setQuickManagerOpen] = useState(false); // gestion des templates (⚙️ dans l'éventail)
  const [fixedModal,       setFixedModal]       = useState(null);
  const [fixedIncomeModal, setFixedIncomeModal] = useState(null); // null | { editingIdx: number|null }
  const [cagModal,      setCagModal]      = useState(null); // null | { editingId: string|null }
  const [transferModal, setTransferModal] = useState(false);
  const [catModal,      setCatModal]      = useState(null); // null | Category object (or {}) | { parentId } pour une sous-catégorie
  const [deleteCatId,   setDeleteCatId]   = useState(null); // v1.47.0
  const [importPreview, setImportPreview] = useState(null); // v1.47.0 : { fileName, data }
  const [recapYM,       setRecapYM]       = useState(null); // v1.47.0 : clôture du mois affichée
  const [yearRecap,     setYearRecap]     = useState(null); // v1.68.0 : année du bilan annuel affiché
  const pendingYearRef = useRef(null);                      // v1.68.0 : bilan annuel à ouvrir après celui de décembre
  const [projectModal,  setProjectModal]  = useState(null); // v1.47.0 : {} (nouveau) | projet
  const [reimbModal,    setReimbModal]    = useState(null); // v1.48.0 : {} (nouveau) | remboursement attendu
  const [confirmModal,  setConfirmModal]  = useState(null); // null | { title, msg, onConfirm }
  const [detailModal,   setDetailModal]   = useState(null); // null | { type, period }
  const [cagHistModal,  setCagHistModal]  = useState(null); // null | cagId string

  // ── Dispatch helpers ─────────────────────────────────────────
  const saveTransaction = useCallback((tx) => {
    dispatch({ type: A.SAVE_TRANSACTION, tx });
  }, []);

  const deleteTransaction = useCallback((id) => {
    setConfirmModal({
      title: "Supprimer l'opération ?",
      msg:   "Cette opération sera retirée de l'historique définitivement.",
      onConfirm: () => {
        dispatch({ type: A.DELETE_TRANSACTION, id });
        addToast("Opération supprimée", "error");
      },
    });
  }, [addToast]);

  const duplicateTransaction = useCallback((tx) => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    dispatch({ type: A.SAVE_TRANSACTION, tx: {
      type: tx.type, amount: tx.amount,
      date: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(Math.min(now.getDate(), lastDay)).padStart(2,"0")}`,
      categoryId: tx.categoryId, note: tx.note,
      targetCagId: tx.targetCagId, tagIds: tx.tagIds,
    }});
    addToast("Transaction dupliquée à aujourd'hui", "success");
  }, [addToast]);

  // Confirmation d'une opération récurrente (utilisée depuis Accueil ET Historique)
  const confirmRecurring = useCallback((tpl, month) => {
    // Garde anti-double-clic : vérifier qu'aucune transaction avec ce templateId n'existe déjà ce mois
    const alreadyConfirmed = (data.transactions || []).some(
      t => t.templateId === tpl.id && recurringRefDate(t).startsWith(month)
    );
    if (alreadyConfirmed) return;
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const day = Math.min(new Date().getDate(), lastDay);
    dispatch({ type: A.SAVE_TRANSACTION, tx: {
      type: tpl.type, amount: tpl.amount,
      date: `${month}-${String(day).padStart(2, "0")}`,
      categoryId: tpl.categoryId, note: tpl.label, templateId: tpl.id,
    }});
  }, [data.transactions]);

  const saveCag = useCallback((cag) => {
    dispatch({ type: A.SAVE_CAGNOTTE, cag });
  }, []);

  function deleteCag(id) {
    const c = data.cagnottes.find(x => x.id === id);
    if (!c) return;
    setConfirmModal({
      title: "Supprimer la cagnotte ?",
      msg: c.current > 0
        ? `La cagnotte "${c.name}" sera supprimée et ${(c.current).toLocaleString("fr-FR",{minimumFractionDigits:2})} € seront recrédités dans votre solde.`
        : `La cagnotte "${c.name}" sera supprimée (solde à 0).`,
      onConfirm: () => {
        dispatch({ type: A.DELETE_CAGNOTTE, id });
        addToast("Cagnotte supprimée", "error");
      },
    });
  }

  const saveFixed = useCallback((payload) => {
    dispatch({ type: A.SAVE_FIXED, ...payload });
  }, []);

  const quickPauseFixed = useCallback((idx) => {
    const f = data.fixedExpenses?.[idx];
    if (!f) return;
    const willPause = !f.paused;
    saveFixed({ idx, fixed: {
      paused: willPause,
      pausedFrom:  willPause ? currentYM() : null,
      pausedUntil: null,
    }});
    addToast(f.paused ? "Frais réactivé" : "Frais mis en pause (dès ce mois-ci)", f.paused ? "success" : "warning");
  }, [data.fixedExpenses, saveFixed, addToast]);

  const deleteFixed = useCallback((idx) => {
    setConfirmModal({
      title: "Supprimer ce frais fixe ?",
      msg:   "Ce frais ne sera plus comptabilisé dans le solde.",
      onConfirm: () => {
        dispatch({ type: A.DELETE_FIXED, idx });
        addToast("Frais fixe supprimé", "error");
      },
    });
  }, [addToast]);

  const saveFixedIncome = useCallback((payload) => {
    dispatch({ type: A.SAVE_FIXED_INCOME, ...payload });
  }, []);

  const quickPauseIncome = useCallback((idx) => {
    const f = data.fixedIncomes?.[idx];
    if (!f) return;
    const willPause = !f.paused;
    saveFixedIncome({ idx, income: {
      paused: willPause,
      pausedFrom:  willPause ? currentYM() : null,
      pausedUntil: null,
    }});
    addToast(f.paused ? "Revenu réactivé" : "Revenu mis en pause (dès ce mois-ci)", f.paused ? "success" : "warning");
  }, [data.fixedIncomes, saveFixedIncome, addToast]);

  const deleteFixedIncome = useCallback((idx) => {
    setConfirmModal({
      title: "Supprimer ce revenu fixe ?",
      msg:   "Ce revenu ne sera plus comptabilisé dans le solde.",
      onConfirm: () => {
        dispatch({ type: A.DELETE_FIXED_INCOME, idx });
        addToast("Revenu fixe supprimé", "error");
      },
    });
  }, [addToast]);

  const saveProvisional = useCallback((provisional) => {
    dispatch({ type: A.SAVE_PROVISIONAL, provisional });
  }, []);

  const deleteProvisional = useCallback((id) => {
    dispatch({ type: A.DELETE_PROVISIONAL, id });
    addToast("Frais prévisionnel supprimé", "error");
  }, [addToast]);

  function executeTransfer(payload) {
    dispatch({ type: A.EXECUTE_TRANSFER, ...payload, reason: payload.reason || null, date: (() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })() });
    setTransferModal(false);
  }

  function saveCat(cat) {
    dispatch({ type: A.SAVE_CATEGORY, cat });
  }

  // v1.47.0 : suppression protégée (liste ce qui est rattaché + choix déplacer / sans catégorie)
  function deleteCat(id) {
    setDeleteCatId(id);
  }

  // ── Export / Import ──────────────────────────────────────────
  async function handleExport() {
    const newDate  = new Date().toISOString();
    // v1.47.0 : la version de l'app est notée dans le fichier (affichée à l'import)
    const snapshot = { ...data, lastBackupDate: newDate, appVersion: APP_VERSION };
    const json     = JSON.stringify(snapshot, null, 2);
    const fileName = `budget_backup_${newDate.slice(0, 10)}.json`;
    const sizeKo   = Math.round(json.length / 1024 * 10) / 10;
    const entry    = { id: `bk_${Date.now()}`, date: newDate, txCount: data.transactions.length, sizeKo };

    // ── APK Capacitor ────────────────────────────────────────────
    if (window.Capacitor?.isNativePlatform?.()) {
      try {
        const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        const { uri } = await Filesystem.writeFile({
          path: fileName, data: json,
          directory: Directory.Cache, encoding: Encoding.UTF8,
        });
        await Share.share({ title: "Budget Pro — Sauvegarde", url: uri, dialogTitle: "Enregistrer la sauvegarde" });
        dispatch({ type: A.ADD_BACKUP_ENTRY, entry });
        addToast("✓ Sauvegarde exportée");
        return true;
      } catch (err) {
        if (!err?.message?.includes("canceled") && err?.name !== "AbortError") {
          addToast(`Erreur export : ${err?.message ?? err}`, "error");
        }
        return false;
      }
    }

    // ── Web / desktop ────────────────────────────────────────────
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = fileName; a.style.display = "none";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      dispatch({ type: A.ADD_BACKUP_ENTRY, entry });
      addToast(`✓ Export : ${fileName}`);
      return true;
    } catch {
      addToast("Erreur lors de l'export", "error");
      return false;
    }
  }

  function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!imported.transactions || !imported.categories) {
          addToast("Fichier invalide — structure incorrecte", "error");
          return;
        }
        // v1.47.0 : aperçu + comparaison avant de remplacer quoi que ce soit
        setImportPreview({ fileName: file.name, data: imported });
      } catch {
        addToast("Fichier invalide — JSON malformé", "error");
      }
    };
    reader.onerror = () => addToast("Impossible de lire le fichier", "error");
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleReset() {
    setConfirmModal({
      title: "TOUT EFFACER ?",
      msg:   "Cette action est irréversible. Toutes vos données seront supprimées.",
      onConfirm: () => {
        dispatch({ type: A.RESET });
        addToast("Données réinitialisées", "error");
      },
    });
  }

  // ── View map ─────────────────────────────────────────────────
  // Fonction (pas un objet) : seule la vue active est construite à chaque render,
  // au lieu de recréer les 6 vues (avec tous leurs callbacks) à chaque interaction.
  function renderView(tab) {
  switch (tab) {
  case "accueil": return (
      <AccueilView data={data}
        onOpenReimbursement={r => setReimbModal(r || {})}
        onCashCheque={(id, date) => dispatch({ type: A.CASH_CHEQUE, id, date })}
        onDeleteTrans={deleteTransaction}
        onOpenOffAccount={(mode, satId, entry) => setOffModal({ mode, satId, entry })}
        onShowDetail={(type, period, extra) => setDetailModal({ type, period, extra })}
        onSwitchTab={navigateTo}
        onSaveProvisional={saveProvisional}
        onDeleteProvisional={deleteProvisional}
        onGoToHistorique={goToHistoriqueWithFilter}
        alertEnabled={data.alertEnabled}
        alertThreshold={data.alertThreshold}
        roundingEnabled={data.roundingEnabled}
        roundingCagnotteId={data.roundingCagnotteId}
        roundingLastTransferDate={data.roundingLastTransferDate}
        onMarkRoundingTransferred={markRoundingTransferred}
        onDeleteScheduled={id => dispatch({ type: A.DELETE_SCHEDULED, id })}
        onConfirmRecurring={confirmRecurring}
        onTogglePointFix={togglePointFix}
        onTogglePointIncome={togglePointIncome}
        onSaveProjectionSnapshot={(ym, predictedValue) => dispatch({ type: A.SAVE_PROJECTION_SNAPSHOT, ym, predictedValue })}
        onDismissInsight={(key, value) => dispatch({ type: A.DISMISS_INSIGHT, key, value })}
        onSaveSurplus={(cagId, amount, cycleEnd) => {
          dispatch({ type: A.SAVE_TRANSACTION, tx: { type: "epargne", amount, date: todayISO(), targetCagId: cagId, note: "Surplus de fin de cycle" } });
          dispatch({ type: A.DISMISS_INSIGHT, key: "surplus", value: cycleEnd });
          const cag = data.cagnottes.find(c => c.id === cagId);
          addToast(`🐷 ${fmt(amount)} versés dans « ${cag?.name || "cagnotte"} »`);
        }}
      />
  );
  case "cagnottes": return (
      <CagnottesView data={data}
        onNewCag={()    => setCagModal({ editingId: null })}
        onEditCag={id   => setCagModal({ editingId: id  })}
        onDeleteCag={deleteCag}
        onTransfer={()  => setTransferModal(true)}
        onShowCagHistory={id => setCagHistModal(id)}
        onNewProject={() => setProjectModal({})}
        onEditProject={p => setProjectModal(p)}
        onDeleteProject={p => setConfirmModal({
          title: `Supprimer le projet « ${p.name} » ?`,
          msg: "La cagnotte et le tag liés sont conservés (argent et historique intacts).",
          onConfirm: () => { dispatch({ type: A.DELETE_PROJECT, id: p.id }); addToast("Projet supprimé", "error"); },
        })}
        onProjectAutoSaving={(p, amount, plan) => {
          dispatch({ type: A.SAVE_AUTO_SAVING, plan: plan ? { ...plan, amount } : { cagnotteId: p.cagId, amount, dayOfMonth: 1, enabled: true } });
          addToast(plan ? `Versement auto ajusté à ${amount.toFixed(2).replace(".", ",")} €` : `Versement auto créé : ${amount.toFixed(2).replace(".", ",")} € le 1ᵉʳ du mois (modifiable dans Options)`);
        }}
      />
  );
  case "historique": return (
      <HistoriqueView data={{...data, autoSavings: data.autoSavings||[]}}
        onOpenReleve={() => setReleveOpen(true)}
        onEditOffAccount={entry => setOffModal({ mode: entry.kind, entry })}
        onEditTrans={id => setTransModal({ editingId: id })}
        onDeleteTrans={deleteTransaction}
        onDuplicateTrans={duplicateTransaction}
        onTogglePointTx={togglePointTx}
        onTogglePointFix={togglePointFix}
        onTogglePointIncome={togglePointIncome}
        onOverrideFixMonth={overrideFixMonth}
        onOverrideIncomeMonth={overrideIncomeMonth}
        onDeleteRecurring={deleteRecurring}
        onConfirmRecurring={confirmRecurring}
        onApplyAutoSaving={planId => {
          const now  = new Date();
          const ym   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
          const date = `${ym}-${String(now.getDate()).padStart(2,"0")}`;
          dispatch({ type: A.APPLY_AUTO_SAVING, planId, ym, date });
        }}
        onSkipAutoSaving={planId => {
          const now = new Date();
          const ym  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
          dispatch({ type: A.SAVE_AUTO_SAVING, plan: { id: planId, lastAppliedYm: ym } });
        }}
        onConfirmScheduled={id => dispatch({ type: A.CONFIRM_SCHEDULED, id })}
        onDeleteScheduled={id  => dispatch({ type: A.DELETE_SCHEDULED,  id })}
        onMonthChange={(y, m) => setHistYM(p => (p.y === y && p.m === m ? p : { y, m }))}
        initPointFilter={histPointFilter}
        onClearPointFilter={() => setHistPointFilter("all")}
      />
  );
  case "fixes": return (
      <FixesView data={data}
        onNewFixed={()    => setFixedModal({ editingIdx: null })}
        onEditFixed={idx  => setFixedModal({ editingIdx: idx  })}
        onDeleteFixed={deleteFixed}
        onQuickPauseFixed={quickPauseFixed}
        onNewFixedIncome={()    => setFixedIncomeModal({ editingIdx: null })}
        onEditFixedIncome={idx  => setFixedIncomeModal({ editingIdx: idx  })}
        onDeleteFixedIncome={deleteFixedIncome}
        onQuickPauseIncome={quickPauseIncome}
        onTogglePointFix={togglePointFix}
        onTogglePointIncome={togglePointIncome}
        onSetFixedDay={(kind, id, day) => dispatch({ type: A.SET_FIXED_DAY, kind, id, day })}
        onSaveProvisional={saveProvisional}
        onDeleteProvisional={deleteProvisional}
        insights={insights}
        onDismissInsight={it => { dispatch({ type: A.DISMISS_INSIGHT, key: it.key, value: it.value }); addToast("Ignoré — ne sera plus signalé (sauf si le montant change)"); }}
        onUpdateRecurringInsight={it => { dispatch({ type: A.SAVE_RECURRING, tpl: { ...it.tpl, amount: it.last } }); addToast(`✓ Récurrente mise à jour à ${fmt(it.last)}`); }}
        onCreateFixedInsight={it => {
          const cat = data.categories.find(c => c.id === it.catId);
          // Si la dépense de ce mois est déjà saisie, le frais fixe démarre le mois prochain (pas de double compte)
          const startYM = it.thisMonth ? getNextYM(currentYM()) : currentYM();
          dispatch({ type: A.SAVE_FIXED, idx: null, fixed: { name: it.note || cat?.name || "Dépense régulière", amount: it.ref, categoryId: it.catId, day: it.day, startYM } });
          addToast(`✓ Frais fixe créé (${fmt(it.ref)} le ${it.day})${it.thisMonth ? " — à partir du mois prochain" : ""}`);
        }}
      />
  );
  case "rapport": return (
      <RapportView data={data} currentYear={year} setCurrentYear={setYear}
        onOpenYearRecap={y => setYearRecap(y)}
        categoryThresholds={data.categoryThresholds || {}}
        onSaveCategoryThreshold={saveCategoryThreshold}
        tags={data.tags || []}
        onSaveTag={saveTag}
        onDeleteTag={deleteTag}
        monthNotes={data.monthNotes || {}}
        onSaveSavingsGoal={(year, amount) => dispatch({ type: A.SAVE_SAVINGS_GOAL, year, amount })}
        onGoToHistorique={goToHistoriqueWithFilter}
        onSubtitle={setRapSub}
        onSaveMonthNote={saveMonthNote}
        onPushBack={pushBack}
        onPopBack={popBack}
      />
  );
  case "options": return (
      <OptionsView data={data}
        onEditCat={idOrObj => {
          // Si c'est un objet avec id → sauvegarde directe (ex: mise à jour du linkedToId)
          if (idOrObj && typeof idOrObj === "object" && idOrObj.id) {
            dispatch({ type: A.SAVE_CATEGORY, cat: idOrObj });
          } else {
            const c = data.categories.find(x => x.id === idOrObj);
            setCatModal(c ?? {});
          }
        }}
        onDeleteCat={deleteCat}
        onNewCat={parentId => setCatModal(typeof parentId === "string" ? { parentId } : {})}
        onExport={handleExport}
        onImport={() => importRef.current?.click()}
        onReset={handleReset}
        onDeleteRecurring={deleteRecurring}
        onOpenQuickTemplates={() => setQuickManagerOpen(true)}
        onOpenCagTypes={() => setCagTypesOpen(true)}
        onOpenReleve={() => setReleveOpen(true)}
        onSaveSideAmountType={saveSideAmountType}
        onDeleteSideAmountType={deleteSideAmountType}
        onSaveTag={saveTag}
        onDeleteTag={deleteTag}
        onSaveGroceryBudget={settings => dispatch({ type: A.SAVE_GROCERY_BUDGET, settings })}
        onSaveRestSettings={settings => dispatch({ type: A.SAVE_REST_SETTINGS, settings })}
        onSaveAppearance={patch => dispatch({ type: A.SET_APPEARANCE, patch })}
        alertEnabled={data.alertEnabled}
        alertThreshold={data.alertThreshold}
        onSaveAlertSettings={saveAlertSettings}
        roundingEnabled={data.roundingEnabled}
        roundingCagnotteId={data.roundingCagnotteId}
        roundingRule={data.roundingRule || "ceil"}
        onSaveRoundingSettings={saveRoundingSettings}
        autoSavings={data.autoSavings || []}
        onSaveAutoSaving={saveAutoSaving}
        onDeleteAutoSaving={deleteAutoSaving}
        pinEnabled={data.pinEnabled}
        pinHash={data.pinHash}
        bioEnabled={data.bioEnabled}
        onSaveSecuritySettings={saveSecuritySettings}
        notifSettings={data.notifSettings || {}}
        onSaveNotifSettings={saveNotifSettings}
        onScheduleNotifications={scheduleNotifications}
        onPushBack={pushBack}
        onPopBack={popBack}
      />
  );
  default: return null;
  }
  }

  // ── Écran de verrou ──────────────────────────────────────────
  // Replanification automatique des rappels à chaque ouverture (v1.40.0) :
  // sans ça, chaque notification ne partait qu'une fois. Uniquement APRÈS
  // déverrouillage, différée de 4 s, sans popup de permission (silent) —
  // pour ne pas reproduire l'écran noir post-biométrie de la 1.39.1.
  const notifReplannedRef = useRef(false);
  useEffect(() => {
    if (locked || notifReplannedRef.current || !data.notifSettings?.enabled) return;
    notifReplannedRef.current = true;
    const t = setTimeout(() => scheduleNotifications(data.notifSettings, { silent: true }), 4000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  const closeMonthRecap = () => {
    setRecapYM(null);
    if (pendingYearRef.current) { const y = pendingYearRef.current; pendingYearRef.current = null; setTimeout(() => setYearRecap(y), 250); }
  };

  // ── Clôture du mois (v1.47.0) ─────────────────────────────────
  // Le 1er de chaque mois, au premier démarrage de la journée (après
  // déverrouillage), on affiche le bilan du mois écoulé — une seule fois :
  // le mois est noté dès l'affichage (même si l'app est rouverte ensuite).
  useEffect(() => {
    if (locked) return;
    const now = new Date();
    if (now.getDate() !== 1) return;
    const cur = currentYM();
    if (data.lastMonthRecapShown === cur) return;
    const prev = getPrevMonth(cur);
    if (!(data.transactions || []).some(t => (t.date || "") < `${cur}-01`)) return; // pas d'historique
    dispatch({ type: A.MARK_MONTH_RECAP, ym: cur });
    // v1.68.0 : le 1er janvier, le bilan de l'année suit celui de décembre
    const year = now.getFullYear() - 1;
    if (now.getMonth() === 0 && data.lastYearRecapShown !== year) { dispatch({ type: A.MARK_YEAR_RECAP, year }); pendingYearRef.current = year; }
    const id = setTimeout(() => setRecapYM(prev), 600);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  // ── 🔍 Repéré pour toi (v1.50.0) : calculé ici pour le point sur l'onglet Fixes ──
  // v1.58.0 : recalculé seulement quand les données changent (avant : à chaque
  // rendu, donc à chaque chiffre tapé sur le clavier de saisie).
  const insights = useMemo(() => detectInsights(data), [data]);

  if (locked) {
    return (
      <LockScreen
        pinHash={data.pinHash}
        bioEnabled={data.bioEnabled}
        onUnlock={() => setLocked(false)}
      />
    );
  }


  // ── Sous-titre de contexte sous le titre de page (v1.49.0) ──
  const pageSubtitle = (() => {
    const now = new Date();
    switch (tab) {
      case "accueil":    return `${MONTHS_LC[now.getMonth()]} ${now.getFullYear()}`;
      case "cagnottes": {
        const n = (data.cagnottes || []).length;
        if (!n) return "aucune cagnotte";
        const tot = data.cagnottes.reduce((s, c) => s + (c.current || 0), 0);
        return `${n} cagnotte${n > 1 ? "s" : ""} · ${fmt(tot)}`;
      }
      case "historique": return `${MONTHS_LC[histYM.m]} ${histYM.y}`;
      case "fixes":      return "frais & revenus fixes";
      case "rapport":    return rapSub || `année ${year}`;
      default:           return "";
    }
  })();

  return (
    <ToastCtx.Provider value={addToast}>

      {/* ── Header ── */}
      <header className="bp-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {canGoBack && (
            <button className="back-btn" onClick={() => backHandlerRef.current()}>
              ‹
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
              <span style={{ fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}>{PAGE_TITLES[tab]?.icon}</span>
              <h1 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {PAGE_TITLES[tab]?.label ?? tab}
              </h1>
            </div>
            {pageSubtitle && (
              <div style={{ fontSize: ".6rem", fontWeight: 700, color: "var(--text3)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {pageSubtitle}
              </div>
            )}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{
            display:"flex", alignItems:"center", gap:6,
            background:"var(--surface2)", border:"1px solid var(--border)",
            borderRadius:20, padding:"4px 10px 4px 5px",
          }}>
            <img src="/ic_launcher_round.png" style={{ width:20, height:20, borderRadius:"50%", opacity:.85 }} alt="logo" />
            <span style={{
              fontSize:".58rem", fontWeight:700, color:"var(--text2)",
              fontFamily:"'Courier New',monospace", letterSpacing:".06em",
            }}>v{APP_VERSION}</span>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="container" key={animKey} style={{
        // v1.53.1 : « backwards » et non « both » — un transform laissé actif après l'animation
        // faisait de ce conteneur la référence des position: fixed → les fenêtres ouvertes
        // depuis un écran (Options, Rapport…) s'affichaient en haut de page, hors de vue.
        animation: slideDir !== 0 ? `tab-slide-${slideDir > 0 ? "right" : "left"} .28s ease backwards` : "none",
      }}>{renderView(tab)}</div>

      {/* ── Tab bar ── */}
      <div className="tabs">
        {TABS.map(([k, icon, label]) => (
          <button key={k} className={`tab-btn${tab === k ? " active" : ""}`} onClick={() => navigateTo(k)}>
            <span className="tab-icon" style={{ position: "relative" }}>{icon}
              {k === "fixes" && insights.length > 0 && <span style={{ position: "absolute", top: -2, right: -5, width: 8, height: 8, borderRadius: "50%", background: "var(--teal, #5cc8c0)", boxShadow: "0 0 0 2px var(--bg)" }} />}
            </span>
            {label}
          </button>
        ))}
      </div>

      {/* ── FAB + quick menu ── */}
      {fabOpen && (
        <div onClick={() => setFabOpen(false)} data-testid="fab-overlay"
          style={{ position:"fixed", inset:0, zIndex:101,
            background:"rgba(2,6,14,.45)", backdropFilter:"blur(3px)", WebkitBackdropFilter:"blur(3px)",
            animation:"fabOvIn .15s ease-out both" }} />
      )}
      {quickFanOpen && (
        <>
          <div onClick={() => setQuickFanOpen(false)}
            style={{
              position:"fixed", inset:0, zIndex:101,
              background:"rgba(0,0,0,.6)", backdropFilter:"blur(3px)", WebkitBackdropFilter:"blur(3px)",
            }} />
          {/* Halo autour du FAB pour signaler que l'éventail en part */}
          <div style={{
            position:"fixed", bottom:0, right:0, width:220, height:220, zIndex:102,
            borderRadius:"50%", pointerEvents:"none",
            background:"radial-gradient(circle, rgba(112,184,224,.28) 0%, transparent 70%)",
          }} />
        </>
      )}
      {quickFanOpen && (() => {
        const items = [...(data.quickTemplates || []), { id: "__manage__", icon: "⚙️", isManage: true }];
        const n = items.length;
        // Angle mesuré depuis "tout à gauche" (0°) vers "tout en haut" (90°) —
        // le FAB étant collé au coin bas-droit, l'éventail doit uniquement
        // s'ouvrir vers la gauche et le haut pour rester à l'écran.
        const startAngle = 15, endAngle = 100;
        return items.map((t, i) => {
          const angle = n === 1 ? (startAngle + endAngle) / 2 : startAngle + (endAngle - startAngle) * (i / (n - 1));
          const rad  = angle * Math.PI / 180;
          const dist = 92;
          const dx = Math.cos(rad) * dist; // positif = plus vers la gauche → augmente `right`
          const dy = Math.sin(rad) * dist; // positif = plus vers le haut  → augmente `bottom`
          return (
            <div key={t.id}
              onClick={() => {
                setQuickFanOpen(false);
                if (t.isManage) setQuickManagerOpen(true);
                else setQuickEditTpl(t);
              }}
              style={{
                position: "fixed", bottom: 110 + 26 + dy, right: 18 + 26 + dx,
                width: 48, height: 48, borderRadius: "50%",
                background: t.isManage ? "var(--fab-menu-bg, #0e1e36)" : "var(--fab-menu-bg, var(--surface2))",
                border: `1.5px solid ${t.isManage ? "var(--accent)" : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.15rem",
                boxShadow: "0 4px 16px rgba(0,0,0,.45)", zIndex: 103, cursor: "pointer",
                animation: `fanItemIn .2s ${i * 0.03}s both cubic-bezier(.34,1.56,.64,1)`,
              }}>
              {t.icon}
            </div>
          );
        });
      })()}
      <div style={{ position:"fixed", bottom:110, right:18, zIndex:104, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:10 }}>
        {fabOpen && (
          /* v1.73.0 : comme le mockup — pas de panneau, une étiquette + une pastille ronde par type */
          <div data-testid="fab-menu" style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
          {[
            { type:"reimbursement",      icon:"↩️", label:"À recevoir", color:"#5cc8c0"        },
            { type:"balance_adjustment", icon:"⚖️", label:"Équilibre",  color:"var(--sapin)"   },
            { type:"scheduled",          icon:"📅", label:"Programmée", color:"var(--warning)" },
            { type:"epargne",            icon:"🐷", label:"Épargne",    color:"var(--purple)"  },
            { type:"offAccount",         icon:"🎫", label:"Hors compte", color:"var(--tr)"     },
            { type:"income",             icon:"💰", label:"Revenu",     color:"var(--success)" },
            { type:"expense",            icon:"💸", label:"Dépense",    color:"var(--danger)"  },
          ].map((item, i) => (
            <div key={item.type} data-fab-item={item.type}
              onClick={() => {
                setFabOpen(false);
                if (item.type === "scheduled") setScheduledModal(true);
                else if (item.type === "offAccount") setOffModal({ mode: "expense" });
                else if (item.type === "reimbursement") setReimbModal({});
                else setTransModal({ editingId: null, defaultType: item.type });
              }}
              style={{
                display:"flex", alignItems:"center", gap:9, cursor:"pointer",
                animation:`fabItemIn .2s ${i * 0.035}s both cubic-bezier(.34,1.56,.64,1)`,
              }}>
              <span style={{
                fontSize:".72rem", fontWeight:800, color:"var(--text)", whiteSpace:"nowrap",
                padding:"6px 11px", borderRadius:11, background:"var(--fab-menu-bg, var(--surface2))", border:"1px solid var(--border)",
                boxShadow:"0 4px 14px rgba(0,0,0,.4)",
              }}>{item.label}</span>
              <span style={{
                width:44, height:44, borderRadius:"50%", flexShrink:0,
                background:"var(--fab-menu-bg, var(--surface2))", border:`2px solid ${item.color}`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.15rem",
                boxShadow:"0 4px 14px rgba(0,0,0,.4)",
              }}>{item.icon}</span>
            </div>
          ))}
          <div style={{ fontSize:".58rem", color:"var(--text2)", marginTop:1, marginRight:4 }}>Appui long sur + : modèles rapides</div>
          </div>
        )}
        {/* Le bouton .fab a position:fixed dans le CSS — on l'override avec position:relative.
            Tap court = menu habituel. Appui long (450ms) = éventail de templates rapides. */}
        <button className="fab"
          onMouseDown={handleFabPressStart}
          onMouseUp={handleFabPressEnd}
          onMouseLeave={handleFabPressEnd}
          onTouchStart={handleFabPressStart}
          onTouchEnd={handleFabPressEnd}
          onClick={handleFabClick}
          style={{ position:"relative", bottom:"auto", right:"auto",
            background: fabOpen ? "var(--fab-solid-open, linear-gradient(135deg,#5ab8e0,#3090c0))" : "var(--fab-solid, linear-gradient(135deg,#5ab8e0,#3090c0))",
            border: "var(--fab-border, none)",
            boxShadow: "var(--fab-shadow, 0 6px 24px rgba(80,160,210,.5))",
            transform: fabOpen ? "rotate(45deg)" : "none", transition:"transform .2s cubic-bezier(.34,1.56,.64,1), background .2s" }}>
          ＋
        </button>
      </div>
      <style>{`
        @keyframes fabItemIn {
          from { opacity:0; transform:scale(.7) translateY(10px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes fabOvIn { from { opacity:0; } to { opacity:1; } }
        @keyframes fanItemIn {
          from { opacity:0; transform:scale(.5); }
          to   { opacity:1; transform:scale(1); }
        }
      `}</style>

      {/* ── Hidden file input ── */}
      <input ref={importRef} type="file" hidden accept=".json" onChange={handleImportFile} />

      {/* ── Modals ── */}
      {scheduledModal && (
        <ScheduledModal
          categories={data.categories}
          onSave={s => { dispatch({ type: A.SAVE_SCHEDULED, scheduled: s }); setScheduledModal(false); }}
          onClose={() => setScheduledModal(false)}
        />
      )}

      {transModal && (
        <TransModal
          transactions={data.transactions}
          categories={data.categories}
          cagnottes={data.cagnottes}
          tags={data.tags || []}
          sideAmountTypes={data.sideAmountTypes || []}
          roundingEnabled={data.roundingEnabled}
          roundingCagnotteId={data.roundingCagnotteId}
          roundingRule={data.roundingRule || "ceil"}
          editingId={transModal.editingId}
          defaultType={transModal.defaultType || "expense"}
          defaultCagId={transModal.defaultCagId || null}
          reimbursements={data.reimbursements || []}
          categoryThresholds={data.categoryThresholds || {}}
          fixedExpenses={data.fixedExpenses || []}
          fixedIncomes={data.fixedIncomes || []}
          onPointIncome={(id, ym) => { setTransModal(null); togglePointIncome(id, ym); }}
          onSave={(tx, extra) => { dispatch({ type: A.SAVE_TRANSACTION, tx, ...(extra || {}) }); setTransModal(null); }}
          onSaveRecurring={tpl => saveRecurring(tpl)}
          onClose={() => setTransModal(null)}
        />
      )}
      {fixedModal && (
        <FixedModal
          categories={data.categories}
          fixedExpenses={data.fixedExpenses}
          fixedIncomes={data.fixedIncomes || []}
          transactions={data.transactions}
          editingIdx={fixedModal.editingIdx}
          onSave={payload => { saveFixed(payload); setFixedModal(null); }}
          onSaveIncome={payload => { saveFixedIncome(payload); setFixedModal(null); }}
          onClose={() => setFixedModal(null)}
        />
      )}
      {offModal && (
        <OffAccountModal
          mode={offModal.mode}
          entry={offModal.entry || null}
          defaultSatId={offModal.satId}
          sideAmountTypes={data.sideAmountTypes || []}
          categories={data.categories}
          onSave={entry => dispatch({ type: A.SAVE_OFF_ACCOUNT, entry })}
          onDelete={id => dispatch({ type: A.DELETE_OFF_ACCOUNT, id })}
          onClose={() => setOffModal(null)}
        />
      )}
      {quickEditTpl && (
        <QuickTemplateSheet
          template={quickEditTpl}
          categories={data.categories}
          sideAmountTypes={data.sideAmountTypes || []}
          onSave={tx => { saveTransaction(tx); setQuickEditTpl(null); }}
          onClose={() => setQuickEditTpl(null)}
        />
      )}
      {quickManagerOpen && (
        <QuickTemplateManagerModal
          templates={data.quickTemplates || []}
          categories={data.categories}
          onSave={tpl => saveQuickTemplate(tpl)}
          onDelete={id => deleteQuickTemplate(id)}
          onClose={() => setQuickManagerOpen(false)}
        />
      )}
      {fixedIncomeModal && (
        <FixedIncomeModal
          categories={data.categories}
          fixedIncomes={data.fixedIncomes || []}
          fixedExpenses={data.fixedExpenses}
          transactions={data.transactions}
          previewLow={draft => {
            // v1.68.0 : projection 3 mois avec le revenu modifié (changements prévus) → point bas
            const d2 = { ...data, fixedIncomes: (data.fixedIncomes || []).map(x => x.id === draft.id ? draft : x) };
            const bd = computeBalanceBreakdown(d2.transactions, d2.fixedExpenses, d2.fixedIncomes, d2.recurringTemplates, d2.scheduledTransactions, new Date(), d2.reimbursements || [], (parseInt(data.restSettings?.reimbLateDays, 10) || 15));
            const P = computeProjection(d2, bd, { monthsAhead: 3 });
            const pays = [...(P.current.events || []), ...P.months.flatMap(m => m.lines)].filter(e => e.isPay || (e.kind === "inc" && e.id === draft.id)).map(e => e.date);
            return { days: P.days, pays };
          }}
          editingIdx={fixedIncomeModal.editingIdx}
          onSave={payload => { saveFixedIncome(payload); setFixedIncomeModal(null); }}
          onSaveExpense={payload => { saveFixed(payload); setFixedIncomeModal(null); }}
          onClose={() => setFixedIncomeModal(null)}
        />
      )}
      {pointIncome && (() => {
        const inc = (data.fixedIncomes || []).find(x => x.id === pointIncome.id);
        return inc ? (
          <PointIncomeModal income={inc} ym={pointIncome.ym} transactions={data.transactions}
            onConfirm={(amount, exclude) => {
              dispatch({ type: A.POINT_INCOME_AMOUNT, id: inc.id, ym: pointIncome.ym, amount, exclude }); setPointIncome(null);
              if (mainPayIncome(data)?.id === inc.id) setPayRecap({ id: inc.id, ym: pointIncome.ym, amount });
              else addToast(`✓ ${inc.name} pointé : ${fmt(amount)}`);
            }}
            onClose={() => setPointIncome(null)} />
        ) : null;
      })()}
      {payRecap && (() => {
        const inc = (data.fixedIncomes || []).find(x => x.id === payRecap.id);
        if (!inc) return null;
        const recapYM = fixedCashYM(inc, payRecap.ym);   // mois qui se termine (versé fin octobre → bilan d'octobre)
        return (
          <PayRecapSheet recap={computePayRecap(data, recapYM)} income={inc} amount={payRecap.amount}
            paidDate={fixedCashDateISO(inc, payRecap.ym)} nextYM={payRecap.ym}
            cagnottes={data.cagnottes || []} cagTypes={data.cagTypes}
            onSnapshot={rest => { if (data.payRecaps?.[recapYM]?.rest == null) dispatch({ type: A.SAVE_PAY_RECAP, ym: recapYM, patch: { rest, date: fixedCashDateISO(inc, payRecap.ym) || todayISO() } }); }}
            onSave={(cagId, amount) => {
              dispatch({ type: A.SAVE_TRANSACTION, tx: { type: "epargne", amount, date: todayISO(), targetCagId: cagId, note: `Reste de ${MONTHS_SHORT[parseInt(recapYM.slice(5, 7), 10) - 1].toLowerCase()}.` } });
              dispatch({ type: A.SAVE_PAY_RECAP, ym: recapYM, patch: { saved: Math.round(((data.payRecaps?.[recapYM]?.saved || 0) + amount) * 100) / 100 } });
              const cag = data.cagnottes.find(c => c.id === cagId);
              addToast(`🐷 ${fmt(amount)} versés dans « ${cag?.name || "cagnotte"} »`);
              setPayRecap(null);
            }}
            onClose={() => setPayRecap(null)} />
        );
      })()}
      {cagModal && (
        <CagModal
          cagnottes={data.cagnottes}
          cagTypes={data.cagTypes}
          onManageTypes={() => setCagTypesOpen(true)}
          editingId={cagModal.editingId}
          onSave={cag => { saveCag(cag); setCagModal(null); }}
          onDelete={id => { setCagModal(null); deleteCag(id); }}
          onClose={() => setCagModal(null)}
        />
      )}
      {transferModal && (
        <TransferModal
          cagnottes={data.cagnottes}
          cagTypes={data.cagTypes}
          onSave={executeTransfer}
          onClose={() => setTransferModal(false)}
        />
      )}
      {catModal && (
        <CatModal
          editingCat={catModal?.id ? catModal : null}
          categories={data.categories}
          defaultParentId={catModal?.parentId || null}
          onSave={cat => { saveCat(cat); setCatModal(null); }}
          onClose={() => setCatModal(null)}
        />
      )}
      {reimbModal && (
        <ReimbursementModal reimbursement={reimbModal.id ? reimbModal : null}
          onSave={r => { dispatch({ type: A.SAVE_REIMBURSEMENT, reimbursement: r }); setReimbModal(null); }}
          onDelete={r => setConfirmModal({
            title: "Supprimer ce remboursement attendu ?", msg: "Il ne sera plus suivi. La dépense d'origine n'est pas modifiée.",
            onConfirm: () => { dispatch({ type: A.DELETE_REIMBURSEMENT, id: r.id }); setReimbModal(null); addToast("Remboursement supprimé", "error"); },
          })}
          onReceive={r => { dispatch({ type: A.RECEIVE_REIMBURSEMENT, id: r.id }); setReimbModal(null);
            addToast(`↩️ Reçu : revenu de ${(parseFloat(r.amount) || 0).toFixed(2).replace(".", ",")} € ajouté (à pointer)`); }}
          onClose={() => setReimbModal(null)} />
      )}
      {projectModal && (
        <ProjectModal project={projectModal.id ? projectModal : null} cagnottes={data.cagnottes} cagTypes={data.cagTypes} tags={data.tags || []}
          onSave={payload => { dispatch({ type: A.SAVE_PROJECT, ...payload }); setProjectModal(null); }}
          onClose={() => setProjectModal(null)} />
      )}
      {recapYM && (
        <MonthRecapSheet recap={computeMonthRecap(data, recapYM)} categories={data.categories}
          onClose={closeMonthRecap}
          onOpenRapport={() => { closeMonthRecap(); navigateTo("rapport"); }}
          onGoUnpointed={() => { closeMonthRecap(); goToHistoriqueWithFilter("unpointed"); }} />
      )}
      {yearRecap && (
        <YearRecapSheet recap={computeYearRecap(data, yearRecap)} categories={data.categories}
          onClose={() => setYearRecap(null)}
          onOpenRapport={() => { setYearRecap(null); navigateTo("rapport"); }} />
      )}
      {importPreview && (
        <ImportPreviewModal fileName={importPreview.fileName} fileData={importPreview.data} currentData={data} appVersion={APP_VERSION}
          onConfirm={async backupFirst => {
            if (backupFirst) {
              const ok = await handleExport();
              if (!ok) { addToast("Import annulé : la sauvegarde de tes données actuelles n'a pas été faite", "error"); return; }
            }
            dispatch({ type: A.IMPORT_DATA, data: importPreview.data });
            addToast(`✓ Import réussi — ${importPreview.data.transactions.length} opération(s) chargée(s)`);
            setImportPreview(null);
          }}
          onClose={() => setImportPreview(null)} />
      )}
      {deleteCatId && data.categories.some(c => c.id === deleteCatId) && (
        <DeleteCategoryModal
          category={data.categories.find(c => c.id === deleteCatId)}
          categories={data.categories}
          usage={categoryUsage(data, deleteCatId)}
          onConfirm={moveTo => {
            dispatch({ type: A.DELETE_CATEGORY, id: deleteCatId, moveTo });
            addToast(moveTo ? "Catégorie supprimée — éléments déplacés" : "Catégorie supprimée", "error");
            setDeleteCatId(null);
          }}
          onClose={() => setDeleteCatId(null)}
        />
      )}
      {releveOpen && <ReleveCompare data={data} onClose={() => setReleveOpen(false)} />}
      {cagTypesOpen && (
        <CagTypesModal
          cagTypes={data.cagTypes}
          cagnottes={data.cagnottes}
          onSave={cagType => { dispatch({ type: A.SAVE_CAG_TYPE, cagType }); addToast(cagType.id ? "Type modifié" : "Type créé"); }}
          onDelete={(t, n) => setConfirmModal({
            title: `Supprimer le type « ${t.label} » ?`,
            msg: n > 0
              ? `${n} cagnotte${n > 1 ? "s passeront" : " passera"} « sans type » (🐷). Leur argent et leurs objectifs ne changent pas.`
              : "Aucune cagnotte n'utilise ce type.",
            onConfirm: () => { dispatch({ type: A.DELETE_CAG_TYPE, id: t.id }); addToast("Type supprimé"); },
          })}
          onClose={() => setCagTypesOpen(false)}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          {...confirmModal}
          onClose={() => setConfirmModal(null)}
        />
      )}
      {detailModal && (
        <DetailModal
          config={detailModal}
          transactions={data.transactions}
          categories={data.categories}
          cagnottes={data.cagnottes}
          fixedExpenses={data.fixedExpenses}
          fixedIncomes={data.fixedIncomes || []}
          onClose={() => setDetailModal(null)}
        />
      )}
      {cagHistModal && (
        <CagHistModal
          cagId={cagHistModal}
          transactions={data.transactions}
          categories={data.categories}
          cagnottes={data.cagnottes}
          cagTypes={data.cagTypes || DEFAULT_CAG_TYPES}
          extras={(() => {
            const plan = (data.autoSavings || []).find(a => a.cagnotteId === cagHistModal && a.enabled);
            const proj = (data.projects || []).find(p => p.cagId === cagHistModal);
            const rounding = data.roundingEnabled && data.roundingCagnotteId === cagHistModal;
            return [plan ? `🔁 ${fmt(plan.amount)} le ${plan.dayOfMonth}` : null, rounding ? "🪙 arrondis" : null, proj ? `${proj.icon} ${proj.name}` : null].filter(Boolean).join(" · ") || null;
          })()}
          onDeposit={id  => { setCagHistModal(null); setTransModal({ editingId: null, defaultType: "epargne", defaultCagId: id }); }}
          onWithdraw={id => { setCagHistModal(null); setTransModal({ editingId: null, defaultType: "decagnottage", defaultCagId: id }); }}
          onTransfer={() => { setCagHistModal(null); setTransferModal(true); }}
          onEdit={id     => { setCagHistModal(null); setCagModal({ editingId: id }); }}
          onClose={() => setCagHistModal(null)}
        />
      )}

      {/* ── Toast notifications ── */}
      <ToastContainer toasts={toasts} />
    </ToastCtx.Provider>
  );
}
