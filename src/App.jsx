import { useReducer, useEffect, useState, useCallback, useRef } from "react";
import "./styles.css";
import { reducer, DEFAULT_DATA, A } from "./store.js";
import { LS_KEY, uid, APP_NAME, APP_VERSION } from "./utils.js";
import appLogo from "../Assets/android-icons/mipmap-xxxhdpi/ic_launcher_round.png";
import { ToastCtx } from "./context.js";
import { ToastContainer } from "./components/index.jsx";
import {
  TransModal, FixedModal, CagModal, TransferModal, CatModal,
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
    return s ? { ...DEFAULT_DATA, ...JSON.parse(s) } : DEFAULT_DATA;
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
  const markRoundingTransferred   = useCallback(() =>
    dispatch({ type: A.MARK_ROUNDING_TRANSFERRED, date: new Date().toISOString().slice(0, 10) }), []);
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

  // ── Versements automatiques : applique au démarrage si conditions remplies ──
  useEffect(() => {
    const now    = new Date();
    const ym     = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const today  = now.getDate();
    const date   = now.toISOString().slice(0, 10);
    (data.autoSavings || []).forEach(plan => {
      if (!plan.enabled)                  return; // plan désactivé
      if (plan.lastAppliedYm === ym)      return; // déjà appliqué ce mois-ci
      if (today < plan.dayOfMonth)        return; // pas encore le bon jour
      dispatch({ type: A.APPLY_AUTO_SAVING, planId: plan.id, ym, date });
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

  // ── File import ref ──────────────────────────────────────────
  const importRef = useRef();

  // ── Back stack : couches internes aux vues (sheets, panels) ─────
  const backStackRef = useRef([]);
  const pushBack = useCallback(fn => { backStackRef.current = [...backStackRef.current, fn]; }, []);
  const popBack  = useCallback(()  => { backStackRef.current = backStackRef.current.slice(0, -1); }, []);

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
    if (fixedModal)    { setFixedModal(null);     return; }
    if (transModal)    { setTransModal(null);     return; }
    // Priorité 2 : fermer la couche interne à la vue (sheet, panel…)
    if (backStackRef.current.length > 0) {
      const fn = backStackRef.current[backStackRef.current.length - 1];
      backStackRef.current = backStackRef.current.slice(0, -1);
      fn();
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
  const [transModal,    setTransModal]    = useState(null); // null | { editingId: string|null }
  const [fixedModal,    setFixedModal]    = useState(null); // null | { editingIdx: number|null }
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
    }});
    addToast("Transaction dupliquée à aujourd'hui", "success");
  }, [addToast]);

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

  const saveProvisional = useCallback((provisional) => {
    dispatch({ type: A.SAVE_PROVISIONAL, provisional });
  }, []);

  const deleteProvisional = useCallback((id) => {
    dispatch({ type: A.DELETE_PROVISIONAL, id });
    addToast("Frais prévisionnel supprimé", "error");
  }, [addToast]);

  function executeTransfer(payload) {
    dispatch({ type: A.EXECUTE_TRANSFER, ...payload });
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
  const views = {
    accueil: (
      <AccueilView data={data}
        onShowDetail={(type, period) => setDetailModal({ type, period })}
        onShowMonthDetail={(y, i) => setMonthModal({ year: y, monthIdx: i })}
        onEditTrans={id => setTransModal({ editingId: id })}
        onDeleteTrans={deleteTransaction}
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
      />
    ),
    cagnottes: (
      <CagnottesView data={data}
        onNewCag={()    => setCagModal({ editingId: null })}
        onEditCag={id   => setCagModal({ editingId: id  })}
        onDeleteCag={deleteCag}
        onTransfer={()  => setTransferModal(true)}
        onShowCagHistory={id => setCagHistModal(id)}
      />
    ),
    historique: (
      <HistoriqueView data={{...data, autoSavings: data.autoSavings||[]}}
        onEditTrans={id => setTransModal({ editingId: id })}
        onDeleteTrans={deleteTransaction}
        onDuplicateTrans={duplicateTransaction}
        onTogglePointTx={togglePointTx}
        onTogglePointFix={togglePointFix}
        onOverrideFixMonth={overrideFixMonth}
        onDeleteRecurring={deleteRecurring}
        onConfirmRecurring={(tpl, month) => {
          const [y, m] = month.split("-").map(Number);
          const lastDay = new Date(y, m, 0).getDate(); // dernier jour du mois
          const day = Math.min(new Date().getDate(), lastDay);
          dispatch({ type: A.SAVE_TRANSACTION, tx: {
            type: tpl.type, amount: tpl.amount,
            date: `${month}-${String(day).padStart(2,"0")}`,
            categoryId: tpl.categoryId, note: tpl.label, templateId: tpl.id,
          }});
        }}
        initPointFilter={histPointFilter}
        onClearPointFilter={() => setHistPointFilter("all")}
      />
    ),
    fixes: (
      <FixesView data={data}
        onNewFixed={()    => setFixedModal({ editingIdx: null })}
        onEditFixed={idx  => setFixedModal({ editingIdx: idx  })}
        onDeleteFixed={deleteFixed}
        onSaveProvisional={saveProvisional}
        onDeleteProvisional={deleteProvisional}
      />
    ),
    rapport: (
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
    ),
    options: (
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
        onPushBack={pushBack}
        onPopBack={popBack}
      />
    ),
  };

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
            <img src={appLogo} style={{ width:20, height:20, borderRadius:"50%", opacity:.85 }} alt="logo" />
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
      }}>{views[tab]}</div>

      {/* ── Tab bar ── */}
      <div className="tabs">
        {TABS.map(([k, icon, label]) => (
          <button key={k} className={`tab-btn${tab === k ? " active" : ""}`} onClick={() => navigateTo(k)}>
            <span className="tab-icon">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* ── FAB ── */}
      <button className="fab" onClick={() => setTransModal({ editingId: null })}>＋</button>

      {/* ── Hidden file input ── */}
      <input ref={importRef} type="file" hidden accept=".json" onChange={handleImportFile} />

      {/* ── Modals ── */}
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
