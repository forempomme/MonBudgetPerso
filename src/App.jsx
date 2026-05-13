import { useReducer, useEffect, useState, useCallback, useRef } from "react";
import "./styles.css";
import { reducer, DEFAULT_DATA, A } from "./store.js";
import { LS_KEY, uid, APP_NAME } from "./utils.js";
import { ToastCtx } from "./context.js";
import { ToastContainer } from "./components/index.jsx";
import {
  TransModal, FixedModal, CagModal, TransferModal, CatModal,
  ConfirmModal, DetailModal, MonthDetailModal, CagHistModal,
} from "./components/modals.jsx";
import {
  AccueilView, CagnottesView, HistoriqueView,
  FixesView, RapportView, OptionsView,
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

  // ── Navigation avec historique ───────────────────────────────
  const [tabHistory, setTabHistory] = useState(["accueil"]);
  const tab = tabHistory[tabHistory.length - 1];
  const [slideDir, setSlideDir]     = useState(0); // -1 gauche, 1 droite
  const [animKey,  setAnimKey]      = useState(0);

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
  const saveMonthNote = useCallback((ym, note) => {
    dispatch({ type: A.SAVE_MONTH_NOTE, ym, note });
  }, []);

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

  // ── Bouton retour physique Android via @capacitor/app ────────
  // Ref toujours fraîche pour éviter les stale closures dans le listener
  const backHandlerRef = useRef(null);

  backHandlerRef.current = () => {
    // Priorité 1 : fermer le modal le plus récent
    if (confirmModal)  { setConfirmModal(null);   return; }
    if (cagHistModal)  { setCagHistModal(null);   return; }
    if (monthModal)    { setMonthModal(null);     return; }
    if (detailModal)   { setDetailModal(null);    return; }
    if (catModal)      { setCatModal(null);       return; }
    if (transferModal) { setTransferModal(false); return; }
    if (cagModal)      { setCagModal(null);       return; }
    if (fixedModal)    { setFixedModal(null);     return; }
    if (transModal)    { setTransModal(null);     return; }
    // Priorité 2 : onglet précédent
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

    // ── APK Capacitor ────────────────────────────────────────────
    // 1. Écrire en cache  2. Ouvrir la feuille de partage Android
    //    → l'utilisateur choisit : Téléchargements, Drive, email…
    if (window.Capacitor?.isNativePlatform?.()) {
      try {
        const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");

        // Écriture dans le cache de l'app (temporaire, juste pour le partage)
        const { uri } = await Filesystem.writeFile({
          path:      fileName,
          data:      json,
          directory: Directory.Cache,
          encoding:  Encoding.UTF8,
        });

        // Feuille de partage native Android : l'utilisateur choisit l'emplacement
        await Share.share({
          title:       "Budget Pro — Sauvegarde",
          url:         uri,
          dialogTitle: "Enregistrer la sauvegarde",
        });

        dispatch({ type: A.SET_BACKUP_DATE, date: newDate });
        addToast("✓ Sauvegarde exportée");
      } catch (err) {
        // AbortError = l'utilisateur a annulé le sélecteur → silence
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
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      dispatch({ type: A.SET_BACKUP_DATE, date: newDate });
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
      <HistoriqueView data={data}
        onEditTrans={id => setTransModal({ editingId: id })}
        onDeleteTrans={deleteTransaction}
        onTogglePointTx={togglePointTx}
        onTogglePointFix={togglePointFix}
        onOverrideFixMonth={overrideFixMonth}
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
        onShowMonthDetail={(y, i) => setMonthModal({ year: y, monthIdx: i })}
        monthNotes={data.monthNotes || {}}
        onSaveMonthNote={saveMonthNote}
      />
    ),
    options: (
      <OptionsView data={data}
        onEditCat={id  => { const c = data.categories.find(x => x.id === id); setCatModal(c ?? {}); }}
        onDeleteCat={deleteCat}
        onNewCat={()   => setCatModal({})}
        onExport={handleExport}
        onImport={() => importRef.current?.click()}
        onReset={handleReset}
      />
    ),
  };

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
        <button className="theme-btn" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
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
          editingId={transModal.editingId}
          onSave={tx => { saveTransaction(tx); setTransModal(null); }}
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
