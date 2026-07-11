import { useReducer, useEffect, useState, useCallback, useRef } from "react";
import "./styles.css";
import { reducer, DEFAULT_DATA, A } from "./store.js";
import { LS_KEY, uid, APP_NAME, APP_VERSION } from "./utils.js";
import { ToastCtx } from "./context.js";
import { ToastContainer } from "./components/index.jsx";
import {
  TransModal, FixedModal, FixedIncomeModal, CagModal, TransferModal, CatModal,
  ScheduledModal,
  ConfirmModal, DetailModal, MonthDetailModal, CagHistModal,
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
const PAGE_TITLES = Object.fromEntries(
  [["accueil","Tableau de bord"],["cagnottes","🐷 Cagnottes"],["historique","Historique"],
   ["fixes","Frais Fixes"],["rapport","Rapport Annuel"],["options","Options"]]
);

// ─────────────────────────────────────────────────────────────────
//  Load initial state
// ─────────────────────────────────────────────────────────────────
function loadState() {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (!s) return DEFAULT_DATA;
    const saved = JSON.parse(s);
    // Merge profond pour les objets imbriqués — évite qu'une MAJ écrase un sous-objet entier
    return {
      ...DEFAULT_DATA,
      ...saved,
      notifSettings: { ...DEFAULT_DATA.notifSettings, ...(saved.notifSettings || {}) },
      fixedIncomes: saved.fixedIncomes || DEFAULT_DATA.fixedIncomes,
    };
  } catch {
    return DEFAULT_DATA;
  }
}

// ─────────────────────────────────────────────────────────────────
//  App
// ─────────────────────────────────────────────────────────────────
export default function App() {
  const [data, dispatch] = useReducer(reducer, undefined, loadState);
  const [year, setYear]  = useState(new Date().getFullYear());

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
  const scheduleNotifications = useCallback(async (ns) => {
    try {
      const LN = window?.Capacitor?.Plugins?.LocalNotifications;
      if (!LN) return;
      const perm = await LN.requestPermissions();
      if (perm.display !== "granted") return;
      await LN.cancel({ notifications: Array.from({length:30},(_,i)=>({id:i+1})) });
      const pending = [];
      const now = new Date();
      const fmtAmt = n => new Intl.NumberFormat("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(n))+" €";
      if (ns.recurring && (data.recurringTemplates||[]).length > 0) {
        const d = new Date(now.getFullYear(), now.getMonth()+1, 1, 9, 0, 0);
        pending.push({ id:1, title:"🔄 Récurrentes à confirmer", body:`${(data.recurringTemplates||[]).length} modèle(s) à confirmer ce mois`, schedule:{at:d}, channelId:"budget" });
      }
      (data.autoSavings||[]).filter(p=>p.enabled && ns.autoSaving).forEach((p,i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), p.dayOfMonth, 9, 0, 0);
        if (d > now) {
          const cag = data.cagnottes.find(c=>c.id===p.cagnotteId);
          pending.push({ id:10+i, title:"🐷 Versement automatique", body:`${fmtAmt(p.amount)} → ${cag?.name||"cagnotte"}`, schedule:{at:d}, channelId:"budget" });
        }
      });
      if (ns.scheduled) {
        (data.scheduledTransactions||[]).filter(s=>!s.confirmed).forEach((s,i) => {
          const veille = new Date(new Date(s.date+"T09:00:00").getTime()-86400000);
          if (veille > now) pending.push({ id:20+i, title:"📅 Dépense prévue demain", body:`${fmtAmt(s.amount)}${s.note?" — "+s.note:""}`, schedule:{at:veille}, channelId:"budget" });
        });
      }
      if (ns.backup && data.lastBackupDate) {
        const days = Math.floor((Date.now()-new Date(data.lastBackupDate))/86400000);
        if (days >= 7) pending.push({ id:5, title:"💾 Sauvegarde recommandée", body:`Dernière sauvegarde il y a ${days} jours`, schedule:{at:new Date(Date.now()+30000)}, channelId:"budget" });
      }
      if (pending.length > 0) await LN.schedule({ notifications:pending });
    } catch(e) { console.warn("LocalNotifications:", e); }
  }, [data.recurringTemplates, data.autoSavings, data.scheduledTransactions, data.lastBackupDate, data.cagnottes]);
  const markRoundingTransferred   = useCallback(() =>
    dispatch({ type: A.MARK_ROUNDING_TRANSFERRED, date: (() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })() }), []);
  const saveTag                = useCallback(tag  => dispatch({ type: A.SAVE_TAG,    tag  }), []);
  const deleteTag              = useCallback(id   => dispatch({ type: A.DELETE_TAG,  id   }), []);

  const togglePointTx  = useCallback(id => dispatch({ type: A.TOGGLE_POINT_TX,  id }), []);
  const togglePointFix    = useCallback((id, ym) => dispatch({ type: A.TOGGLE_POINT_FIX, id, ym }), []);
  const overrideFixMonth  = useCallback((id, ym, override) => dispatch({ type: A.OVERRIDE_FIX_MONTH, id, ym, override }), []);

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
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  useEffect(() => {
    document.documentElement.className = theme === "light" ? "light" : "";
    localStorage.setItem("theme", theme);
  }, [theme]);

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
    if (cagHistModal)  { setCagHistModal(null);   return; }
    if (monthModal)    { setMonthModal(null);     return; }
    if (detailModal)   { setDetailModal(null);    return; }
    if (catModal)      { setCatModal(null);       return; }
    if (transferModal) { setTransferModal(false); return; }
    if (cagModal)      { setCagModal(null);       return; }
    if (fixedModal)    { setFixedModal(null);       return; }
    if (fixedIncomeModal) { setFixedIncomeModal(null); return; }
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
  const [fixedModal,       setFixedModal]       = useState(null);
  const [fixedIncomeModal, setFixedIncomeModal] = useState(null); // null | { editingIdx: number|null }
  const [cagModal,      setCagModal]      = useState(null); // null | { editingId: string|null }
  const [transferModal, setTransferModal] = useState(false);
  const [catModal,      setCatModal]      = useState(null); // null | Category object (or {})
  const [confirmModal,  setConfirmModal]  = useState(null); // null | { title, msg, onConfirm }
  const [detailModal,   setDetailModal]   = useState(null); // null | { type, period }
  const [monthModal,    setMonthModal]    = useState(null); // null | { year, monthIdx }
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
      t => t.templateId === tpl.id && t.date.startsWith(month)
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

  function deleteCat(id) {
    setConfirmModal({
      title: "Supprimer cette catégorie ?",
      msg:   "Les opérations liées perdront leur catégorie.",
      onConfirm: () => {
        dispatch({ type: A.DELETE_CATEGORY, id });
        addToast("Catégorie supprimée", "error");
      },
    });
  }

  // ── Export / Import ──────────────────────────────────────────
  async function handleExport() {
    const newDate  = new Date().toISOString();
    const snapshot = { ...data, lastBackupDate: newDate };
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
      } catch (err) {
        if (!err?.message?.includes("canceled") && err?.name !== "AbortError") {
          addToast(`Erreur export : ${err?.message ?? err}`, "error");
        }
      }
      return;
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
    } catch {
      addToast("Erreur lors de l'export", "error");
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
        dispatch({ type: A.IMPORT_DATA, data: imported });
        addToast(`✓ Import réussi — ${imported.transactions.length} opération(s) chargée(s)`);
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
        onShowDetail={(type, period) => setDetailModal({ type, period })}
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
        onSaveProjectionSnapshot={(ym, predictedValue) => dispatch({ type: A.SAVE_PROJECTION_SNAPSHOT, ym, predictedValue })}
      />
  );
  case "cagnottes": return (
      <CagnottesView data={data}
        onNewCag={()    => setCagModal({ editingId: null })}
        onEditCag={id   => setCagModal({ editingId: id  })}
        onDeleteCag={deleteCag}
        onTransfer={()  => setTransferModal(true)}
        onShowCagHistory={id => setCagHistModal(id)}
      />
  );
  case "historique": return (
      <HistoriqueView data={{...data, autoSavings: data.autoSavings||[]}}
        onEditTrans={id => setTransModal({ editingId: id })}
        onDeleteTrans={deleteTransaction}
        onDuplicateTrans={duplicateTransaction}
        onTogglePointTx={togglePointTx}
        onTogglePointFix={togglePointFix}
        onOverrideFixMonth={overrideFixMonth}
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
        initPointFilter={histPointFilter}
        onClearPointFilter={() => setHistPointFilter("all")}
      />
  );
  case "fixes": return (
      <FixesView data={data}
        onNewFixed={()    => setFixedModal({ editingIdx: null })}
        onEditFixed={idx  => setFixedModal({ editingIdx: idx  })}
        onDeleteFixed={deleteFixed}
        onNewFixedIncome={()    => setFixedIncomeModal({ editingIdx: null })}
        onEditFixedIncome={idx  => setFixedIncomeModal({ editingIdx: idx  })}
        onDeleteFixedIncome={deleteFixedIncome}
        onSaveProvisional={saveProvisional}
        onDeleteProvisional={deleteProvisional}
      />
  );
  case "rapport": return (
      <RapportView data={data} currentYear={year} setCurrentYear={setYear}
        categoryThresholds={data.categoryThresholds || {}}
        onSaveCategoryThreshold={saveCategoryThreshold}
        tags={data.tags || []}
        onSaveTag={saveTag}
        onDeleteTag={deleteTag}
        onShowMonthDetail={(y, i) => setMonthModal({ year: y, monthIdx: i })}
        monthNotes={data.monthNotes || {}}
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
        onNewCat={()   => setCatModal({})}
        onExport={handleExport}
        onImport={() => importRef.current?.click()}
        onReset={handleReset}
        onDeleteRecurring={deleteRecurring}
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
  if (locked) {
    return (
      <LockScreen
        pinHash={data.pinHash}
        bioEnabled={data.bioEnabled}
        onUnlock={() => setLocked(false)}
      />
    );
  }

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
          <h1 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {PAGE_TITLES[tab] ?? tab}
          </h1>
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
          <button className="theme-btn" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="container" key={animKey} style={{
        animation: slideDir !== 0 ? `tab-slide-${slideDir > 0 ? "right" : "left"} .28s ease both` : "none",
      }}>{renderView(tab)}</div>

      {/* ── Tab bar ── */}
      <div className="tabs">
        {TABS.map(([k, icon, label]) => (
          <button key={k} className={`tab-btn${tab === k ? " active" : ""}`} onClick={() => navigateTo(k)}>
            <span className="tab-icon">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* ── FAB + quick menu ── */}
      {fabOpen && (
        <div onClick={() => setFabOpen(false)}
          style={{ position:"fixed", inset:0, zIndex:89 }} />
      )}
      <div style={{ position:"fixed", bottom:110, right:18, zIndex:90, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:10 }}>
        {fabOpen && (
          <div style={{
            background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:14, padding:"8px",
            boxShadow:"0 8px 32px rgba(0,0,0,.6)",
            display:"flex", flexDirection:"column", gap:6,
            animation:"fabItemIn .15s cubic-bezier(.34,1.56,.64,1) both",
          }}>
          {[
            { type:"expense",            icon:"💸", label:"Dépense",    color:"var(--danger)"  },
            { type:"income",             icon:"💰", label:"Revenu",     color:"var(--success)" },
            { type:"epargne",            icon:"🐷", label:"Épargne",    color:"var(--purple)"  },
            { type:"scheduled",          icon:"📅", label:"Programmée", color:"var(--warning)" },
            { type:"balance_adjustment", icon:"⚖️", label:"Équilibre",  color:"var(--sapin)"   },
          ].map((item, i) => (
            <div key={item.type}
              onClick={() => {
                setFabOpen(false);
                if (item.type === "scheduled") setScheduledModal(true);
                else setTransModal({ editingId: null, defaultType: item.type });
              }}
              style={{
                display:"flex", alignItems:"center", gap:10, cursor:"pointer",
                padding:"6px 8px", borderRadius:9,
                background:"var(--surface2)",
                border:`1px solid var(--border)`,
                animation:`fabItemIn .2s ${i * 0.04}s both cubic-bezier(.34,1.56,.64,1)`,
              }}>
              <span style={{
                flex:1,
                fontSize:".68rem", fontWeight:700, color:item.color,
              }}>{item.label}</span>
              <div style={{
                width:34, height:34, borderRadius:"50%",
                background:`${item.color}18`, border:`1.5px solid ${item.color}44`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:".95rem",
              }}>{item.icon}</div>
            </div>
          ))}
          </div>
        )}
        {/* Le bouton .fab a position:fixed dans le CSS — on l'override avec position:relative */}
        <button className="fab"
          onClick={() => setFabOpen(o => !o)}
          style={{ position:"relative", bottom:"auto", right:"auto", background:"linear-gradient(135deg,#5ab8e0,#3090c0)", boxShadow:"0 6px 24px rgba(80,160,210,.5)", transform: fabOpen ? "rotate(45deg)" : "none", transition:"transform .2s cubic-bezier(.34,1.56,.64,1)" }}>
          ＋
        </button>
      </div>
      <style>{`
        @keyframes fabItemIn {
          from { opacity:0; transform:scale(.7) translateY(10px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
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
          roundingEnabled={data.roundingEnabled}
          roundingCagnotteId={data.roundingCagnotteId}
          roundingRule={data.roundingRule || "ceil"}
          editingId={transModal.editingId}
          defaultType={transModal.defaultType || "expense"}
          onSave={tx => { saveTransaction(tx); setTransModal(null); }}
          onSaveRecurring={tpl => saveRecurring(tpl)}
          onClose={() => setTransModal(null)}
        />
      )}
      {fixedModal && (
        <FixedModal
          categories={data.categories}
          fixedExpenses={data.fixedExpenses}
          editingIdx={fixedModal.editingIdx}
          onSave={payload => { saveFixed(payload); setFixedModal(null); }}
          onClose={() => setFixedModal(null)}
        />
      )}
      {fixedIncomeModal && (
        <FixedIncomeModal
          categories={data.categories}
          fixedIncomes={data.fixedIncomes || []}
          editingIdx={fixedIncomeModal.editingIdx}
          onSave={payload => { saveFixedIncome(payload); setFixedIncomeModal(null); }}
          onClose={() => setFixedIncomeModal(null)}
        />
      )}
      {cagModal && (
        <CagModal
          cagnottes={data.cagnottes}
          editingId={cagModal.editingId}
          onSave={cag => { saveCag(cag); setCagModal(null); }}
          onClose={() => setCagModal(null)}
        />
      )}
      {transferModal && (
        <TransferModal
          cagnottes={data.cagnottes}
          onSave={executeTransfer}
          onClose={() => setTransferModal(false)}
        />
      )}
      {catModal && (
        <CatModal
          editingCat={catModal?.id ? catModal : null}
          onSave={cat => { saveCat(cat); setCatModal(null); }}
          onClose={() => setCatModal(null)}
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
          onClose={() => setDetailModal(null)}
        />
      )}
      {monthModal && (
        <MonthDetailModal
          config={monthModal}
          transactions={data.transactions}
          categories={data.categories}
          cagnottes={data.cagnottes}
          fixedExpenses={data.fixedExpenses}
          onClose={() => setMonthModal(null)}
        />
      )}
      {cagHistModal && (
        <CagHistModal
          cagId={cagHistModal}
          transactions={data.transactions}
          categories={data.categories}
          cagnottes={data.cagnottes}
          onClose={() => setCagHistModal(null)}
        />
      )}

      {/* ── Toast notifications ── */}
      <ToastContainer toasts={toasts} />
    </ToastCtx.Provider>
  );
}
