// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import { fmt, isIncome, APP_NAME, APP_VERSION, touchMoved } from "../utils.js";
import { EmptyIllustration, TagsModal, sha256hex } from "./shared.jsx";
import { useGroceryBudget, groceryCategoryIds } from "../hooks.js";

// ─────────────────────────────────────────────────────────────────
//  SideAmountTypesModal — v1.39.32
//  Gestion des types de "montants à part" (tickets resto, carte
//  cadeau…) configurables, sur le même principe que les tags.
// ─────────────────────────────────────────────────────────────────
const SAT_ICONS = ["🎫","🎁","💳","🪙","🏷️","💰","🎟️","🧾"];

function SideAmountTypesModal({ onClose, sideAmountTypes, transactions, offAccountEntries = [], onSaveType, onDeleteType }) {
  const [editingId, setEditingId] = useState(null);
  const [newLabel,  setNewLabel]  = useState("");
  const [newIcon,   setNewIcon]   = useState(SAT_ICONS[0]);
  const [creating,  setCreating]  = useState(false);
  const [newTrack,  setNewTrack]  = useState(false);   // v1.42.0 : « Suivre le solde » (porte-monnaie)
  const [confirmId, setConfirmId] = useState(null);

  function startEdit(st) {
    setEditingId(st.id); setNewLabel(st.label); setNewIcon(st.icon); setNewTrack(!!st.trackBalance); setCreating(true);
  }
  function startCreate() {
    setEditingId(null); setNewLabel(""); setNewIcon(SAT_ICONS[0]); setNewTrack(false); setCreating(true);
  }
  function save() {
    if (!newLabel.trim()) return;
    onSaveType?.({ id: editingId || null, label: newLabel.trim(), icon: newIcon, trackBalance: newTrack });
    setCreating(false); setEditingId(null); setNewLabel("");
  }

  return (
    <div className="modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <div className="modal-title" style={{ marginBottom:0 }}>🎫 Montants à part</div>
          <button onClick={onClose} style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:8, padding:"6px 10px", color:"var(--text2)", cursor:"pointer", fontSize:".75rem" }}>✕</button>
        </div>
        <div style={{ fontSize:".62rem", color:"var(--text3)", marginBottom:14, lineHeight:1.5 }}>
          Ces montants (tickets resto, carte cadeau…) sont purement informatifs — jamais comptés dans ton solde. Ils apparaissent comme des boutons lors de la saisie d'une dépense.
        </div>

        {sideAmountTypes.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:12 }}>
            {sideAmountTypes.map(st => {
              const count = transactions.filter(t => t.sideAmounts && st.id in t.sideAmounts).length
                + offAccountEntries.filter(e => e.satId === st.id).length;
              return (
                <div key={st.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"var(--surface)", border:"1px solid var(--border)", borderLeft:"3px solid var(--tr)", borderRadius:10 }}>
                  <span style={{ fontSize:"1rem" }}>{st.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:".72rem", fontWeight:700 }}>{st.label}</div>
                    <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>{count} opération{count!==1?"s":""}{st.trackBalance ? " · 👛 solde suivi" : ""}</div>
                  </div>
                  <button onClick={()=>startEdit(st)} style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:7, padding:"5px 9px", color:"var(--text2)", fontSize:".7rem", cursor:"pointer" }}>✏️</button>
                  <button onClick={()=>{ if (count > 0 && confirmId !== st.id) { setConfirmId(st.id); return; } setConfirmId(null); onDeleteType?.(st.id); }} style={{ border:"1px solid var(--border)", borderRadius:7, padding:"5px 9px", color: confirmId===st.id ? "#fff" : "var(--text3)", background: confirmId===st.id ? "var(--danger)" : "transparent", fontSize:".72rem", cursor:"pointer" }}>{confirmId===st.id ? `Supprimer ${count} op. ?` : "✕"}</button>
                </div>
              );
            })}
          </div>
        )}

        {!creating ? (
          <button onClick={startCreate} style={{ width:"100%", background:"transparent", border:"1.5px dashed var(--tr)", borderRadius:10, padding:"11px", color:"var(--tr)", fontWeight:700, fontSize:".75rem", cursor:"pointer" }}>
            ＋ Créer un nouveau type
          </button>
        ) : (
          <div style={{ background:"var(--surface)", border:"1.5px solid var(--tr)", borderRadius:12, padding:14 }}>
            <div style={{ fontSize:".65rem", fontWeight:800, color:"var(--tr)", marginBottom:10 }}>{editingId ? "Modifier le type" : "Nouveau type"}</div>
            <input value={newLabel} onChange={e=>setNewLabel(e.target.value)} placeholder="Ex: Carte cadeau"
              style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--accent)", borderRadius:8, padding:"9px 12px", color:"var(--text)", fontSize:".8rem", marginBottom:10, boxSizing:"border-box" }} />
            <div style={{ fontSize:".6rem", color:"var(--text2)", fontWeight:700, marginBottom:6 }}>Icône</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:12 }}>
              {SAT_ICONS.map(ic=>(
                <button key={ic} onClick={()=>setNewIcon(ic)} style={{ width:32, height:32, background:newIcon===ic?"var(--accent-glow)":"transparent", border:`1px solid ${newIcon===ic?"var(--accent)":"var(--border)"}`, borderRadius:7, fontSize:"1rem", cursor:"pointer" }}>{ic}</button>
              ))}
            </div>
            <div onClick={()=>setNewTrack(v=>!v)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, padding:"9px 11px", borderRadius:10, border:"1px solid var(--border)", marginBottom:12, cursor:"pointer" }}>
              <div>
                <div style={{ fontSize:".7rem", fontWeight:700 }}>👛 Suivre le solde</div>
                <div style={{ fontSize:".58rem", color:"var(--text3)", marginTop:2, lineHeight:1.4 }}>Porte-monnaie sur l'accueil : rechargements − dépenses. À activer pour une carte TR ou cadeau.</div>
              </div>
              <span style={{ width:38, height:21, borderRadius:20, flexShrink:0, position:"relative", background: newTrack ? "var(--tr)" : "var(--surface3)", transition:"background .15s" }}>
                <span style={{ position:"absolute", top:2, left: newTrack ? 19 : 2, width:17, height:17, borderRadius:"50%", background:"#fff", transition:"left .15s" }} />
              </span>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>{setCreating(false); setEditingId(null);}} style={{ flex:1, background:"transparent", border:"1px solid var(--border)", borderRadius:9, padding:"9px", color:"var(--text3)", fontWeight:700, fontSize:".72rem", cursor:"pointer" }}>Annuler</button>
              <button onClick={save} style={{ flex:2, background:newLabel.trim()?"var(--tr)":"var(--surface2)", border:"none", borderRadius:9, padding:"9px", color:newLabel.trim()?"var(--bg)":"var(--text3)", fontWeight:800, fontSize:".75rem", cursor:"pointer" }}>{editingId ? "Enregistrer" : "Créer"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  OPTIONS
// ─────────────────────────────────────────────────────────────────
// Formulaire d'ajout de liaison — composant séparé pour son propre état
// ─────────────────────────────────────────────────────────────────
//  Bottom Sheet générique
// ─────────────────────────────────────────────────────────────────
function Sheet({ open, onClose, title, children }) {
  const scrollRef = useRef(null);
  // Sur ce WebView Android, un position:fixed niché à l'intérieur de
  // .container (la zone qui défile) hérite visuellement de son scroll au
  // lieu de rester fixe par rapport à l'écran — confirmé en reproduisant :
  // plus on défile avant d'ouvrir le Sheet, plus il s'ouvre "monté". Un
  // portail vers document.body fait sortir le Sheet de cette zone
  // défilante, pour qu'il ne puisse plus jamais en hériter.
  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [open]);
  if (!open) return null;
  // v1.74.0 : feuille qui monte du bas (poignée, titre + ✕), comme les autres fenêtres
  return createPortal(
    <div data-testid="opt-sheet"
      style={{ position:"fixed", inset:0, background:"rgba(2,6,14,.6)", backdropFilter:"blur(3px)", WebkitBackdropFilter:"blur(3px)", zIndex:600, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={scrollRef} className="app-sheet"
        style={{ width:"100%", maxWidth:560, margin:"0 auto", maxHeight:"92vh", overflowY:"auto", WebkitOverflowScrolling:"touch",
          background:"var(--sheet-bg, var(--bg))", borderTop:"1px solid var(--border)", borderRadius:"24px 24px 0 0",
          padding:"10px 14px calc(24px + env(safe-area-inset-bottom))", boxShadow:"0 -20px 50px rgba(0,0,0,.6)", animation:"slideUp .22s ease" }}>
        <div style={{ width:40, height:4, borderRadius:3, background:"var(--border)", margin:"0 auto 10px" }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:12 }}>
          <div style={{ fontSize:"1rem", fontWeight:800 }}>{title}</div>
          <button onClick={onClose} aria-label="Fermer" style={{ width:32, height:32, flexShrink:0, background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, color:"var(--text2)", cursor:"pointer", fontSize:".78rem", touchAction:"manipulation" }}>✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function LinkForm({ categories, onLink }) {
  const [srcId, setSrcId] = useState("");
  const [dstId, setDstId] = useState("");
  const canLink = srcId && dstId && srcId !== dstId;
  function doLink() {
    if (!canLink) return;
    onLink({ id: srcId, linkedToId: dstId });
    setSrcId(""); setDstId("");
  }
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:7, borderTop:"1px solid var(--border-soft)", paddingTop:10 }}>
      <select value={srcId} onChange={e => setSrcId(e.target.value)}
        style={{ background:"var(--bg)", border:`1px solid ${srcId ? "var(--accent)" : "var(--border)"}`, borderRadius:8, padding:"10px 12px", color:"var(--text)", fontSize:".78rem" }}>
        <option value="">↩ Source (remboursement / partage…)</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
      </select>
      <select value={dstId} onChange={e => setDstId(e.target.value)}
        style={{ background:"var(--bg)", border:`1px solid ${dstId ? "var(--accent)" : "var(--border)"}`, borderRadius:8, padding:"10px 12px", color:"var(--text)", fontSize:".78rem" }}>
        <option value="">💸 Cible (catégorie de dépense…)</option>
        {categories.filter(c => c.id !== srcId).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
      </select>
      <button
        disabled={!canLink}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); doLink(); }}
        onClick={doLink}
        style={{
          background: canLink ? "var(--accent)" : "var(--surface2)",
          border:"none", borderRadius:9, padding:"11px",
          color: canLink ? "var(--bg)" : "var(--text3)",
          fontWeight:800, fontSize:".78rem",
          cursor: canLink ? "pointer" : "default",
          touchAction:"manipulation",
        }}>
        🔗 Créer la liaison
      </button>
    </div>
  );
}

export function OptionsView({ data, onEditCat, onDeleteCat, onNewCat, onExport, onImport, onReset, onDeleteRecurring, alertEnabled = false, alertThreshold = 500, onSaveAlertSettings, roundingEnabled = false, roundingCagnotteId = null, roundingRule = "ceil", onSaveRoundingSettings, autoSavings = [], onSaveAutoSaving, onDeleteAutoSaving, pinEnabled = false, pinHash = null, bioEnabled = false, onSaveSecuritySettings, notifSettings = {}, onSaveNotifSettings, onScheduleNotifications, onPushBack, onPopBack, onOpenQuickTemplates, onOpenCagTypes, onOpenReleve, onSaveSideAmountType, onDeleteSideAmountType, onSaveTag, onDeleteTag, onSaveGroceryBudget, onSaveRestSettings, onSaveAppearance }) {
  const [catFilter,     setCatFilter]     = useState("all");
  const [catSearch,     setCatSearch]     = useState("");      // v1.74.0
  const [catSel,        setCatSel]        = useState(null);
  const [showSideAmountTypesModal, setShowSideAmountTypesModal] = useState(false);
  const [showTagsModalOpt, setShowTagsModalOpt] = useState(false);
  const [alertOn,       setAlertOn]       = useState(alertEnabled);
  const [thresh,        setThresh]        = useState(String(alertThreshold));
  const [roundOn,       setRoundOn]       = useState(roundingEnabled);
  const [roundCagId,    setRoundCagId]    = useState(roundingCagnotteId || "");
  const [roundRule,     setRoundRule]     = useState(roundingRule);
  // Notifications
  const [notifOn,       setNotifOn]       = useState(notifSettings.enabled      ?? false);
  const [notifRecurring,setNotifRecurring]= useState(notifSettings.recurring    ?? true);
  const [notifAuto,     setNotifAuto]     = useState(notifSettings.autoSaving   ?? true);
  const [notifAlert,    setNotifAlert]    = useState(notifSettings.alertSolde   ?? true);
  const [notifSched,    setNotifSched]    = useState(notifSettings.scheduled    ?? true);
  const [notifBackup,   setNotifBackup]   = useState(notifSettings.backup       ?? true);
  const [notifCheques,  setNotifCheques]  = useState(notifSettings.cheques      ?? true);
  const [chequeDelay,   setChequeDelay]   = useState(notifSettings.chequeDelay  ?? 30);
  // v1.48.0 : rappel du soir + remboursements en retard
  const [notifEvening,  setNotifEvening]  = useState(!!notifSettings.evening);
  const [eveningHour,   setEveningHour]   = useState(notifSettings.eveningHour ?? 21);
  const [eveningDays,   setEveningDays]   = useState(notifSettings.eveningDays || "all");
  const [notifReimb,    setNotifReimb]    = useState(notifSettings.reimbursements ?? true);

  function saveNotif(field, val) {
    const next = { enabled:notifOn, recurring:notifRecurring, autoSaving:notifAuto, alertSolde:notifAlert, scheduled:notifSched, backup:notifBackup, cheques:notifCheques, chequeDelay, [field]:val };
    onSaveNotifSettings?.(next);
  }
  function toggleNotifMain(val) {
    const next = { enabled:val, recurring:notifRecurring, autoSaving:notifAuto, alertSolde:notifAlert, scheduled:notifSched, backup:notifBackup, cheques:notifCheques, chequeDelay };
    setNotifOn(val);
    onSaveNotifSettings?.(next);
    // Action explicite : programme les rappels si activé, les annule tous sinon
    onScheduleNotifications?.(next);
  }

  // Versement auto
  const [addingPlan,    setAddingPlan]    = useState(false);
  const [planDraft,     setPlanDraft]     = useState({ cagnotteId:"", amount:"", dayOfMonth:"1" });
  // Sécurité
  const [pinOn,         setPinOn]         = useState(pinEnabled);
  const [bioOn,         setBioOn]         = useState(bioEnabled);
  const [pinSetup,      setPinSetup]      = useState(null); // null | "enter" | "confirm"
  const [pinEntry,      setPinEntry]      = useState("");
  const [pinFirst,      setPinFirst]      = useState("");
  const [pinError,      setPinError]      = useState("");

  function saveAlert(enabled, value) {
    const t = parseFloat(value) || 0;
    setAlertOn(enabled); setThresh(String(t));
    onSaveAlertSettings?.(enabled, t);
  }
  const filtered = useMemo(
    () => data.categories.filter(c => catFilter === "all" || c.type === catFilter),
    [data.categories, catFilter]
  );

  // ⑦ Stats globales
  const globalStats = useMemo(() => {
    const txs = data.transactions;
    if (!txs.length) return null;
    const earliest = txs.reduce((min, t) => t.date < min ? t.date : min, txs[0].date);
    const totalGere = txs.reduce((s, t) => s + (parseFloat(t.amount)||0), 0);
    return { count: txs.length, earliest, totalGere };
  }, [data.transactions]);

  // ⑩ Compteur d'usage par catégorie
  const catUsage = useMemo(() => {
    const map = {};
    data.transactions.forEach(t => {
      if (t.categoryId) map[t.categoryId] = (map[t.categoryId] || 0) + 1;
    });
    return map;
  }, [data.transactions]);

  // ⑧ Jours depuis dernière sauvegarde
  const daysSinceBackup = data.lastBackupDate
    ? Math.floor((Date.now() - new Date(data.lastBackupDate)) / 86400000)
    : null;
  const backupOk = daysSinceBackup !== null && daysSinceBackup <= 7;

  // Feuille ouverte
  const [openSheet, setOpenSheet] = useState(null);
  const [showBackupHist, setShowBackupHist] = useState(false);

  const close = () => setOpenSheet(null);

  // Enregistre/désenregistre dans le back stack quand un sheet est ouvert
  useEffect(() => {
    if (!openSheet) return;
    onPushBack?.(() => setOpenSheet(null));
    return () => onPopBack?.();
  }, [openSheet]);

  // Détection scroll vs tap
  const touchPosRef  = useRef({ x: 0, y: 0 });
  const touchMovedRef = useRef(false);

  // Tooltip "non configuré"
  const [tooltip, setTooltip] = useState(null);
  const tooltipTimer = useRef(null);
  function showTooltip(msg) {
    clearTimeout(tooltipTimer.current);
    setTooltip(msg);
    tooltipTimer.current = setTimeout(() => setTooltip(null), 2500);
  }

  // Badges
  const autoCount   = autoSavings.filter(p=>p.enabled).length;
  const roundCag    = data.cagnottes.find(c=>c.id===roundingCagnotteId);
  const linkedCount = data.categories.filter(c=>c.linkedToId).length;
  const recurCount  = (data.recurringTemplates||[]).length;
  const quickTplCount = (data.quickTemplates||[]).length;
  const sideAmountTypesCount = (data.sideAmountTypes||[]).length;
  const tagsCount = (data.tags||[]).length;
  const cagTypesCount = (data.cagTypes||[]).length;
  const last        = (data.backupHistory||[])[0];
  // Reste à vivre (v1.48.0)
  const restCfg = data.restSettings || { enabled: true, margin: 0 };
  // Budget courses (v1.46.0) — informatif
  const groceryCfg  = data.groceryBudget || { enabled: true, categoryIds: null, months: 2 };
  const grocery     = useGroceryBudget(data.transactions, data.categories, groceryCfg, data.reimbursements || []);
  const groceryCats = groceryCategoryIds(data.categories, groceryCfg);

  const backupLate = !last || daysSinceBackup > 7;
  const GROUPS = [
    {
      title:"💶 Budget & prévisions",
      items:[
        { id:"grocery", icon:"🛒", label:"Budget courses",
          badge: groceryCfg.enabled === false ? "Désactivé" : groceryCats.length === 0 ? "Aucune catégorie" : grocery ? `${Math.round(grocery.average)} €/mois` : "Actif",
          configured: groceryCfg.enabled !== false && groceryCats.length > 0,
          hint: "Choisis la catégorie de tes courses",
          desc: "Reste à dépenser en courses ce mois" },
        { id:"rest", icon:"💶", label:"Reste à vivre",
          badge: restCfg.enabled === false ? "Masqué" : `Marge ${Math.round(parseFloat(restCfg.margin) || 0)} €`,
          configured: restCfg.enabled !== false,
          hint: "Reste à vivre masqué",
          desc: "Par jour jusqu'à la paie" },
        { id:"reimb", icon:"↩️", label:"Remboursements attendus",
          badge: `retard après ${parseInt(restCfg.reimbLateDays, 10) || 15} j`,
          configured: true, hint: "",
          desc: "Comptés dans le solde jusqu'à leur réception" },
        { id:"alert", icon:"🔔", label:"Alerte solde bas",
          badge: alertOn ? `${thresh} €` : "Désactivé",
          configured: alertOn,
          hint: "Aucune alerte de solde définie",
          desc: "Avertit quand le solde estimé passe sous un seuil" },
      ]
    },
    {
      title:"🐷 Épargne automatique",
      items:[
        { id:"autoSavings", icon:"🎯", label:"Versements automatiques",
          badge: autoCount > 0 ? `${autoCount} plan${autoCount>1?"s":""}` : "Inactif",
          configured: autoCount > 0,
          hint: "Aucun versement automatique actif",
          desc: "Montant fixe chaque mois vers une cagnotte" },
        { id:"rounding", icon:"🪙", label:"Arrondi automatique",
          badge: roundOn && roundCag ? roundCag.name : "Désactivé",
          configured: roundOn && !!roundCag,
          hint: "Arrondi automatique désactivé",
          desc: "Arrondit chaque dépense vers une cagnotte" },
        { id:"cagTypes", icon:"🗂️", label:"Types de cagnotte",
          badge: `${cagTypesCount} type${cagTypesCount>1?"s":""}`,
          configured: true, hint: "",
          desc: "Projet, urgence, plaisir… à ta façon",
          action: onOpenCagTypes },
      ]
    },
    {
      title:"✍️ Saisie & classement",
      items:[
        { id:"categories", icon:"🏷️", label:"Catégories",
          badge: `${data.categories.length} cat.`,
          configured: true,
          hint: "",
          desc: "Créer, modifier, sous-catégories" },
        { id:"links", icon:"🔗", label:"Liaisons",
          badge: linkedCount > 0 ? `${linkedCount} lien${linkedCount>1?"s":""}` : "Aucune",
          configured: linkedCount > 0,
          hint: "Aucune liaison de catégorie créée",
          desc: "Compter 2 catégories ensemble" },
        { id:"tags", icon:"🔖", label:"Tags",
          badge: tagsCount > 0 ? `${tagsCount} tag${tagsCount>1?"s":""}` : "Aucun",
          configured: tagsCount > 0,
          hint: "Aucun tag créé",
          desc: "Étiquettes libres (vacances, pro…)",
          action: () => setShowTagsModalOpt(true) },
        { id:"sideAmountTypes", icon:"🎫", label:"Montants à part",
          badge: sideAmountTypesCount > 0 ? `${sideAmountTypesCount} type${sideAmountTypesCount>1?"s":""}` : "Aucun",
          configured: sideAmountTypesCount > 0,
          hint: "Aucun type de montant à part créé",
          desc: "Tickets resto, cartes cadeaux… hors solde",
          action: () => setShowSideAmountTypesModal(true) },
        { id:"quickTemplates", icon:"⚡", label:"Templates rapides",
          badge: quickTplCount > 0 ? `${quickTplCount} template${quickTplCount>1?"s":""}` : "Aucun",
          configured: quickTplCount > 0,
          hint: "Aucun template rapide créé",
          desc: "Appui long sur le bouton +",
          action: onOpenQuickTemplates },
        { id:"recurring", icon:"🔄", label:"Récurrentes",
          badge: recurCount > 0 ? `${recurCount} modèle${recurCount>1?"s":""}` : "Aucune",
          configured: recurCount > 0,
          hint: "Aucune transaction récurrente définie",
          desc: "Opérations qui reviennent" },
      ]
    },
    {
      title:"🔔 Notifications",
      items:[
        { id:"notif", icon:"🔔", label:"Notifications locales",
          badge: notifOn ? "Actif" : "Désactivé",
          configured: notifOn,
          hint: "Notifications locales désactivées",
          desc: "Rappels de sauvegarde, programmées, chèques…" },
      ]
    },
    {
      title:"🔒 Sécurité",
      items:[
        { id:"security", icon:"🔒", label:"PIN & biométrie",
          badge: pinOn?"PIN actif":"Désactivé",
          configured: pinOn,
          hint: "PIN et biométrie non configurés",
          desc: "Protège l'ouverture de l'appli" },
      ]
    },
    {
      title:"💾 Mes données",
      items:[
        { id:"backup", icon:"💾", label:"Sauvegarder",
          badge: last ? (daysSinceBackup === 0 ? "aujourd'hui" : `il y a ${daysSinceBackup} j`) : "Jamais",
          configured: !backupLate,
          hint: "",
          desc: "Exporter un fichier à garder en lieu sûr" },
        { id:"releve", icon:"🏦", label:"Comparer avec un relevé",
          configured: true, hint: "",
          desc: "PDF de ta banque · lecture seule, rien n'est gardé",
          action: onOpenReleve },
        { id:"import", icon:"⬆️", label:"Importer une sauvegarde",
          configured: true, hint: "",
          desc: "Remplace les données actuelles",
          action: onImport },
        { id:"reset", icon:"⚠️", label:"Réinitialiser toutes les données", danger: true,
          configured: true, hint: "",
          desc: "Efface tout — irréversible",
          action: onReset },
      ]
    },
  ];

  const openItem = item => { if (item.action) item.action(); else setOpenSheet(item.id); };

  return (
    <div>
      {(() => {
        // ── v1.72.0 : « État de l'appli » + Mes données (boutons) + Apparence (vignettes) + réglages en tuiles ──
        const ITEM = Object.fromEntries(GROUPS.flatMap(g => g.items).map(it => [it.id, it]));
        const tap = item => ({
          onTouchStart: e => { e.stopPropagation(); touchPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; touchMovedRef.current = false; },
          onTouchMove:  e => { const dx = Math.abs(e.touches[0].clientX - touchPosRef.current.x); const dy = Math.abs(e.touches[0].clientY - touchPosRef.current.y); if (dx > 8 || dy > 8) touchMovedRef.current = true; },
          onTouchEnd:   e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); if (touchMovedRef.current) return; if (!item.configured && item.hint) showTooltip(item.hint); openItem(item); },
          onClick: () => openItem(item),
        });
        const OK = "var(--success)", KO = "var(--warning)";
        const secT = t => <div style={{ fontSize: ".6rem", fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em", margin: "14px 2px 6px" }}>{t}</div>;
        const backupTxt = last ? (daysSinceBackup === 0 ? "faite aujourd'hui" : `il y a ${daysSinceBackup} j`) : "jamais faite";
        const STATE = [
          { id: "backup",   icon: "💾", label: "Sauvegarde",     txt: backupTxt, ok: !backupLate },
          { id: "security", icon: "🔒", label: "Verrouillage",   txt: pinOn ? "PIN actif" : "PIN désactivé", ok: pinOn },
          { id: "notif",    icon: "🔔", label: "Notifications",  txt: notifOn ? "actives" : "désactivées", ok: notifOn },
          { id: "grocery",  icon: "🛒", label: "Budget courses", txt: ITEM.grocery.badge, ok: ITEM.grocery.configured },
        ];
        const nOk = STATE.filter(x => x.ok).length;
        const ringC = nOk === STATE.length ? OK : KO, R = 19, C = 2 * Math.PI * R;
        const cur = ["abysse", "glacier", "aube"].includes(data.appTheme) ? data.appTheme : "abysse";
        const glassOn = data.glassEffects !== false;
        const THEMES = [
          { id: "abysse",  name: "Abysse",  desc: "bleu marine profond",    sw: "radial-gradient(80% 80% at 0% 0%,#123a6e,transparent 70%),radial-gradient(80% 80% at 100% 100%,#0a5576,transparent 70%),#050b18" },
          { id: "glacier", name: "Glacier", desc: "bleu acier, plus clair", sw: "radial-gradient(80% 80% at 0% 0%,#1d5a8f,transparent 70%),radial-gradient(80% 80% at 100% 100%,#13788f,transparent 70%),#071321" },
          { id: "aube",    name: "Aube",    desc: "thème d'origine",        sw: "linear-gradient(160deg,#1b1530,#060810)" },
        ];
        const TILE_GROUPS = [GROUPS[0], GROUPS[1], GROUPS[2], { title: "🔔 Notifications & 🔒 Sécurité", items: [...GROUPS[3].items, ...GROUPS[4].items] }];
        const tile = item => (
          <div key={item.id} data-opt={item.id} className="card" {...tap(item)}
            style={{ margin: 0, padding: "9px 10px", borderRadius: 14, cursor: "pointer", touchAction: "manipulation", display: "flex", flexDirection: "column", minHeight: 92, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
              <span style={{ fontSize: "1.05rem" }}>{item.icon}</span>
              {item.badge && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: ".52rem", fontWeight: 800, padding: "2px 6px", borderRadius: 8, minWidth: 0, maxWidth: "72%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  color: item.configured ? OK : KO, background: `color-mix(in srgb, ${item.configured ? OK : KO} 13%, transparent)` }}>
                  <i style={{ width: 6, height: 6, borderRadius: "50%", background: item.configured ? OK : KO, flexShrink: 0 }} />{item.badge}
                </span>
              )}
            </div>
            <span style={{ display: "block", fontSize: ".72rem", fontWeight: 700, marginTop: 4, lineHeight: 1.2 }}>{item.label}</span>
            <span style={{ fontSize: ".56rem", lineHeight: 1.3, color: "var(--text3)", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.desc}</span>
          </div>
        );
        const dataBtn = (item, pri, sub) => (
          <div key={item.id} data-opt={item.id} {...tap(item)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, padding: "8px 4px", borderRadius: 12, cursor: "pointer", touchAction: "manipulation", textAlign: "center", minWidth: 0,
              background: pri ? "var(--btn-pri-bg, var(--accent))" : "var(--surface2)", border: `1px solid ${pri ? "var(--btn-pri-border, var(--accent))" : "var(--border)"}`, color: pri ? "var(--btn-pri-text, #06121c)" : "var(--text)" }}>
            <span style={{ fontSize: "1.05rem" }}>{item.icon}</span>
            <b style={{ fontSize: ".68rem" }}>{item.short}</b>
            <span style={{ fontSize: ".52rem", fontWeight: 600, opacity: .8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{sub}</span>
          </div>
        );
        return (
          <>
            {/* État de l'appli */}
            <div className="card" data-testid="app-state" style={{ padding: "11px 12px", marginBottom: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="46" height="46" viewBox="0 0 46 46" style={{ flexShrink: 0 }}>
                  <circle cx="23" cy="23" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="4" />
                  <circle cx="23" cy="23" r={R} fill="none" stroke={ringC} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(nOk / STATE.length * C).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 23 23)" />
                  <text x="23" y="26.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--text)">{nOk}/{STATE.length}</text>
                </svg>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: ".82rem", fontWeight: 800 }}>État de l'appli</span>
                  <span style={{ display: "block", fontSize: ".6rem", color: "var(--text2)" }}>{nOk === STATE.length ? "Tout est en ordre ✓" : `${STATE.length - nOk} point${STATE.length - nOk > 1 ? "s" : ""} à regarder pour être tranquille`}</span>
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginTop: 9 }}>
                {STATE.map(x => (
                  <div key={x.id} data-state={x.id} {...tap(ITEM[x.id])}
                    style={{ display: "flex", gap: 7, alignItems: "center", padding: "7px 8px", borderRadius: 11, cursor: "pointer", touchAction: "manipulation", minWidth: 0,
                      background: `color-mix(in srgb, ${x.ok ? OK : KO} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${x.ok ? OK : KO} 35%, transparent)` }}>
                    <span>{x.icon}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: ".66rem", fontWeight: 700 }}>{x.label}</span>
                      <span style={{ display: "block", fontSize: ".56rem", fontWeight: 800, color: x.ok ? OK : KO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.ok ? "✓ " : ""}{x.txt}</span>
                    </span>
                  </div>
                ))}
              </div>
              {backupLate && (
                <div data-testid="backup-alert" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-soft)" }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: ".58rem", color: "var(--text2)" }}>
                    <b style={{ color: "var(--danger)" }}>{last ? `Dernière sauvegarde il y a ${daysSinceBackup} jours` : "Aucune sauvegarde"}</b> — si le téléphone est perdu, tes données le sont aussi.
                  </span>
                  <button onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); onExport?.(); }} onClick={() => onExport?.()}
                    style={{ border: "1px solid var(--btn-pri-border, var(--accent))", background: "var(--btn-pri-bg, var(--accent))", color: "var(--btn-pri-text, #06121c)", borderRadius: 9, padding: "7px 10px", fontSize: ".66rem", fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0, cursor: "pointer" }}>
                    Sauvegarder
                  </button>
                </div>
              )}
            </div>

            {/* Mes données */}
            {secT("💾 Mes données")}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
              {dataBtn({ ...ITEM.backup, short: "Sauvegarder" }, true, last ? (daysSinceBackup === 0 ? "faite aujourd'hui" : `dernière il y a ${daysSinceBackup} j`) : "jamais faite")}
              {dataBtn({ ...ITEM.releve, short: "Relevé PDF" }, false, "rien n'est gardé")}
              {dataBtn({ ...ITEM.import, short: "Importer" }, false, "remplace tout")}
            </div>

            {/* Apparence (v1.70.0) */}
            {secT("🎨 Apparence")}
            <div className="card" data-testid="appearance" style={{ padding: "9px 10px", marginBottom: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                {THEMES.map(t => (
                  <div key={t.id} data-theme-opt={t.id} onClick={() => onSaveAppearance?.({ appTheme: t.id })} style={{ cursor: "pointer", textAlign: "center", minWidth: 0 }}>
                    <div style={{ position: "relative", height: 48, borderRadius: 12, background: t.sw, border: `2px solid ${cur === t.id ? "var(--accent)" : "rgba(255,255,255,.15)"}` }}>
                      {cur === t.id && <span style={{ position: "absolute", right: 5, top: 3, color: "var(--accent)", fontWeight: 900, fontSize: ".75rem" }}>✓</span>}
                    </div>
                    <span style={{ display: "block", fontSize: ".66rem", fontWeight: 700, marginTop: 3, color: cur === t.id ? "var(--text)" : "var(--text2)" }}>{t.name}</span>
                    <span style={{ display: "block", fontSize: ".52rem", color: "var(--text3)" }}>{t.desc}</span>
                  </div>
                ))}
              </div>
              {cur !== "aube" && (
                <div data-testid="glass-toggle" onClick={() => onSaveAppearance?.({ glassEffects: !glassOn })}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 2px 2px", marginTop: 7, borderTop: "1px solid var(--border-soft)", cursor: "pointer" }}>
                  <span style={{ fontSize: ".95rem" }}>🫧</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: ".72rem", fontWeight: 600 }}>Effets de verre</span>
                    <span style={{ display: "block", fontSize: ".56rem", color: "var(--text3)", marginTop: 1 }}>Flou derrière les cartes · à couper si l'appli rame</span>
                  </span>
                  <span style={{ width: 40, height: 22, borderRadius: 11, background: glassOn ? "var(--accent)" : "var(--border)", position: "relative", flexShrink: 0 }}>
                    <span style={{ position: "absolute", top: 3, left: glassOn ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                  </span>
                </div>
              )}
            </div>

            {/* Réglages en tuiles, avec leur petite description */}
            {TILE_GROUPS.map(g => (
              <div key={g.title}>
                {secT(g.title)}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>{g.items.map(tile)}</div>
              </div>
            ))}

            {/* Réinitialiser — à part, en bas */}
            <div data-opt="reset" {...tap(ITEM.reset)}
              style={{ marginTop: 16, padding: "9px 12px", borderRadius: 12, textAlign: "center", cursor: "pointer", touchAction: "manipulation",
                border: "1px solid rgba(200,112,112,.45)", background: "rgba(200,112,112,.06)" }}>
              <span style={{ display: "block", fontSize: ".74rem", fontWeight: 800, color: "var(--danger)" }}>⚠️ {ITEM.reset.label}</span>
              <span style={{ display: "block", fontSize: ".56rem", color: "var(--text2)", marginTop: 1 }}>{ITEM.reset.desc} · confirmation demandée</span>
            </div>
          </>
        );
      })()}

      {/* Toast "non configuré" */}
      {tooltip && (
        <div style={{
          position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)",
          background:"#3a2500", border:"1px solid var(--warning)", color:"var(--warning)",
          borderRadius:10, padding:"9px 16px", fontSize:".7rem", fontWeight:700,
          zIndex:9999, maxWidth:"80vw", textAlign:"center",
          boxShadow:"0 4px 20px rgba(0,0,0,.5)",
          pointerEvents:"none",
        }}>
          ⚙️ {tooltip}
        </div>
      )}

      {/* ── Statistiques + version, en pied de page ── */}
      <div data-testid="opt-foot" style={{ marginTop:16, textAlign:"center", color:"var(--text3)", fontSize:".62rem", lineHeight:1.6, fontWeight:600 }}>
        {globalStats && (
          <div>
            {globalStats.count} opération{globalStats.count>1?"s":""} depuis {new Date(globalStats.earliest+"T12:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"})} · {fmt(globalStats.totalGere)} gérés · {data.categories.length} catégorie{data.categories.length>1?"s":""}
          </div>
        )}
        <div style={{ letterSpacing:".06em" }}>{APP_NAME} — v{APP_VERSION}</div>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* SHEETS                                                 */}
      {/* ══════════════════════════════════════════════════════ */}

      {/* 🔒 Sécurité */}
      <Sheet open={openSheet==="security"} onClose={close} title="🔒 Sécurité">
        <div onClick={()=>{const n=!bioOn;setBioOn(n);onSaveSecuritySettings?.(pinOn,pinHash,n);}}
          style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:bioOn?"rgba(112,184,224,.06)":"var(--surface2)", border:`1px solid ${bioOn?"rgba(112,184,224,.2)":"var(--border)"}`, borderRadius:10, marginBottom:10, cursor:"pointer", touchAction:"manipulation" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:".76rem", fontWeight:700, color:bioOn?"var(--accent)":"var(--text2)" }}>Empreinte / FaceID</div>
            <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>Déverrouillage biométrique Android</div>
          </div>
          <div style={{ width:40, height:22, borderRadius:11, background:bioOn?"var(--accent)":"var(--border)", position:"relative", transition:"background .2s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:3, left:bioOn?19:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
          </div>
        </div>
        <div onClick={()=>{if(pinOn){setPinOn(false);onSaveSecuritySettings?.(false,null,bioOn);}else setPinSetup("enter");}}
          style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:pinOn?"rgba(112,184,224,.06)":"var(--surface2)", border:`1px solid ${pinOn?"rgba(112,184,224,.2)":"var(--border)"}`, borderRadius:10, marginBottom:pinSetup||pinOn?10:0, cursor:"pointer", touchAction:"manipulation" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:".76rem", fontWeight:700, color:pinOn?"var(--accent)":"var(--text2)" }}>Code PIN (4 chiffres)</div>
            <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>{pinOn?"Verrou actif à l'ouverture":"Fallback si biométrie indisponible"}</div>
          </div>
          <div style={{ width:40, height:22, borderRadius:11, background:pinOn?"var(--accent)":"var(--border)", position:"relative", transition:"background .2s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:3, left:pinOn?19:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
          </div>
        </div>
        {pinSetup && (
          <div style={{ background:"var(--surface2)", border:"1.5px solid var(--accent)", borderRadius:10, padding:14, marginBottom:10 }}>
            <div style={{ fontSize:".68rem", fontWeight:800, color:"var(--accent)", marginBottom:10 }}>
              {pinSetup==="enter"?"Choisir un code PIN":"Confirmer le code PIN"}
            </div>
            <div style={{ display:"flex", gap:14, marginBottom:12, justifyContent:"center" }}>
              {[0,1,2,3].map(i=>(
                <div key={i} style={{ width:14, height:14, borderRadius:"50%", background:i<pinEntry.length?"var(--accent)":"transparent", border:"2px solid rgba(112,184,224,.4)", transition:"background .1s" }} />
              ))}
            </div>
            {pinError && <div style={{ fontSize:".62rem", color:"var(--danger)", marginBottom:8, textAlign:"center" }}>{pinError}</div>}
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center", maxWidth:210, margin:"0 auto 12px" }}>
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k,i)=>(
                k===""
                  ? <div key={i} style={{ width:54, height:42 }} />
                  : <button key={i}
                      onTouchStart={e=>e.stopPropagation()}
                      onTouchEnd={e=>{ e.stopPropagation();if (touchMoved()) return; e.preventDefault();
                        if(k==="⌫"){setPinEntry(p=>p.slice(0,-1));setPinError("");return;}
                        const next=pinEntry+k; if(next.length>4)return; setPinEntry(next);
                        if(next.length===4){
                          if(pinSetup==="enter"){setPinFirst(next);setPinEntry("");setPinSetup("confirm");}
                          else{ if(next===pinFirst){sha256hex(next).then(h=>{onSaveSecuritySettings?.(true,h,bioOn);setPinOn(true);setPinSetup(null);setPinEntry("");setPinFirst("");});} else{setPinEntry("");setPinError("Les codes ne correspondent pas");} }
                        }
                      }}
                      onClick={()=>{}}
                      style={{ width:54, height:42, background:"var(--bg)", border:"1px solid var(--border)", borderRadius:9, color:"#e8f0e8", fontSize:k==="⌫"?"1rem":"1.1rem", fontWeight:700, cursor:"pointer", touchAction:"manipulation" }}>
                      {k}
                    </button>
              ))}
            </div>
            <button onClick={()=>{setPinSetup(null);setPinEntry("");setPinFirst("");setPinError("");}} style={{ width:"100%", background:"transparent", border:"1px solid var(--border)", borderRadius:8, padding:"8px", color:"var(--text3)", fontSize:".7rem", cursor:"pointer" }}>Annuler</button>
          </div>
        )}
        {pinOn && !pinSetup && (
          <button onClick={()=>{setPinSetup("enter");setPinEntry("");}}
            style={{ width:"100%", background:"transparent", border:"1px solid var(--border)", borderRadius:9, padding:"10px", color:"var(--text2)", fontSize:".72rem", fontWeight:700, cursor:"pointer", touchAction:"manipulation" }}>
            ✏️ Modifier le code PIN
          </button>
        )}
      </Sheet>

      {/* 🎯 Versements automatiques */}
      <Sheet open={openSheet==="autoSavings"} onClose={close} title="🎯 Versements automatiques">
        <div style={{ fontSize:".65rem", color:"var(--text3)", lineHeight:1.6, marginBottom:12 }}>
          Virement mensuel planifié vers une cagnotte. Il apparaît dans l'Historique pour confirmation.
        </div>
        {autoSavings.map(plan => {
          const cag = data.cagnottes.find(c=>c.id===plan.cagnotteId);
          return (
            <div key={plan.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", background:"var(--surface2)", border:`1px solid ${plan.enabled?"rgba(176,144,224,.25)":"var(--border)"}`, borderRadius:9, marginBottom:6 }}>
              <span style={{ fontSize:".9rem" }}>{cag?.icon||"🐷"}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:".74rem", fontWeight:700 }}>{cag?.name||"—"}</div>
                <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>{fmt(plan.amount)} le {plan.dayOfMonth} de chaque mois</div>
              </div>
              <div onClick={()=>onSaveAutoSaving?.({...plan,enabled:!plan.enabled})}
                style={{ width:36, height:20, borderRadius:10, background:plan.enabled?"var(--purple)":"var(--border)", position:"relative", cursor:"pointer", transition:"background .2s", flexShrink:0 }}>
                <div style={{ position:"absolute", top:2, left:plan.enabled?17:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
              </div>
              <button onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();if (touchMoved()) return; e.preventDefault();onDeleteAutoSaving?.(plan.id);}} onClick={()=>onDeleteAutoSaving?.(plan.id)}
                style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:6, padding:"4px 8px", color:"var(--text3)", fontSize:".65rem", cursor:"pointer", minHeight:28, touchAction:"manipulation" }}>✕</button>
            </div>
          );
        })}
        {!addingPlan ? (
          <button onClick={()=>setAddingPlan(true)} style={{ width:"100%", background:"transparent", border:"1.5px dashed var(--purple)", borderRadius:9, padding:"10px", color:"var(--purple)", fontWeight:700, fontSize:".75rem", cursor:"pointer", marginTop:4, touchAction:"manipulation" }}>
            ＋ Planifier un versement
          </button>
        ) : (
          <div style={{ background:"var(--surface2)", border:"1.5px solid var(--purple)", borderRadius:10, padding:12, marginTop:4 }}>
            <select value={planDraft.cagnotteId} onChange={e=>setPlanDraft(d=>({...d,cagnotteId:e.target.value}))}
              style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--accent)", borderRadius:8, padding:"9px 10px", color:"var(--text)", fontSize:".78rem", marginBottom:8 }}>
              <option value="">Choisir une cagnotte…</option>
              {data.cagnottes.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:".58rem", color:"var(--text2)", marginBottom:3 }}>Montant (€)</div>
                <input type="number" value={planDraft.amount} min="1" placeholder="50" onChange={e=>setPlanDraft(d=>({...d,amount:e.target.value}))}
                  style={{ width:"100%", background:"var(--bg)", border:`1px solid ${planDraft.amount?"var(--purple)":"var(--border)"}`, borderRadius:7, padding:"8px 10px", color:"var(--text)", fontSize:".85rem", fontFamily:"var(--mono)", boxSizing:"border-box" }} />
              </div>
              <div>
                <div style={{ fontSize:".58rem", color:"var(--text2)", marginBottom:3 }}>Jour du mois</div>
                <select value={planDraft.dayOfMonth} onChange={e=>setPlanDraft(d=>({...d,dayOfMonth:e.target.value}))}
                  style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--border)", borderRadius:7, padding:"8px 10px", color:"var(--text)", fontSize:".78rem" }}>
                  {[1,5,10,15,20,25,28].map(d=><option key={d} value={d}>Le {d}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={()=>setAddingPlan(false)} style={{ flex:1, background:"transparent", border:"1px solid var(--border)", borderRadius:8, padding:"8px", color:"var(--text3)", fontSize:".7rem", cursor:"pointer" }}>Annuler</button>
              <button onClick={()=>{if(!planDraft.cagnotteId||!planDraft.amount)return;onSaveAutoSaving?.({cagnotteId:planDraft.cagnotteId,amount:parseFloat(planDraft.amount),dayOfMonth:parseInt(planDraft.dayOfMonth),enabled:true});setAddingPlan(false);setPlanDraft({cagnotteId:"",amount:"",dayOfMonth:"1"});}}
                style={{ flex:2, background:planDraft.cagnotteId&&planDraft.amount?"var(--purple)":"var(--surface2)", border:"none", borderRadius:8, padding:"8px", color:planDraft.cagnotteId&&planDraft.amount?"var(--bg)":"var(--text3)", fontWeight:800, fontSize:".75rem", cursor:"pointer", touchAction:"manipulation" }}>
                Créer
              </button>
            </div>
          </div>
        )}
      </Sheet>

      {/* 🐷 Arrondi automatique */}
      <Sheet open={openSheet==="rounding"} onClose={close} title="🐷 Arrondi automatique">
        <div style={{ fontSize:".65rem", color:"var(--text3)", lineHeight:1.6, marginBottom:12 }}>
          À chaque dépense, verse la différence jusqu'à l'arrondi dans une cagnotte.
        </div>
        <div onClick={()=>{const n=!roundOn;setRoundOn(n);onSaveRoundingSettings?.(n,roundCagId||null,roundRule);}}
          style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:roundOn?"rgba(104,212,152,.06)":"var(--surface2)", border:`1px solid ${roundOn?"rgba(104,212,152,.2)":"var(--border)"}`, borderRadius:10, marginBottom:roundOn?12:0, cursor:"pointer", touchAction:"manipulation" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:".76rem", fontWeight:700, color:roundOn?"var(--success)":"var(--text2)" }}>Arrondi automatique {roundOn?"activé":"désactivé"}</div>
            <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>Verse la différence dans une cagnotte</div>
          </div>
          <div style={{ width:40, height:22, borderRadius:11, background:roundOn?"var(--success)":"var(--border)", position:"relative", transition:"background .2s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:3, left:roundOn?19:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
          </div>
        </div>
        {roundOn && (<>
          <div style={{ fontSize:".62rem", color:"var(--text2)", fontWeight:700, marginBottom:6 }}>Cagnotte cible</div>
          <select value={roundCagId} onChange={e=>{setRoundCagId(e.target.value);onSaveRoundingSettings?.(roundOn,e.target.value,roundRule);}}
            style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--border)", borderRadius:8, padding:"9px 10px", color:"var(--text)", fontSize:".78rem", marginBottom:12 }}>
            <option value="">Choisir une cagnotte…</option>
            {data.cagnottes.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <div style={{ fontSize:".62rem", color:"var(--text2)", fontWeight:700, marginBottom:6 }}>Arrondir à</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
            {[["ceil","L'euro sup."],["5","5 € sup."],["10","10 € sup."]].map(([k,l])=>(
              <button key={k} onClick={()=>{setRoundRule(k);onSaveRoundingSettings?.(roundOn,roundCagId,k);}} style={{
                background:roundRule===k?"rgba(104,212,152,.12)":"transparent",
                border:`1px solid ${roundRule===k?"var(--success)":"var(--border)"}`,
                borderRadius:8, padding:"9px 0", color:roundRule===k?"var(--success)":"var(--text2)", fontSize:".68rem", fontWeight:700, cursor:"pointer",
              }}>{l}</button>
            ))}
          </div>
        </>)}
      </Sheet>

      {/* 🔔 Alerte solde bas */}
      <Sheet open={openSheet==="alert"} onClose={close} title="🔔 Alerte solde bas">
        <div onClick={()=>saveAlert(!alertOn, thresh)}
          style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:alertOn?"rgba(200,184,96,.06)":"var(--surface2)", border:`1px solid ${alertOn?"rgba(200,184,96,.2)":"var(--border)"}`, borderRadius:10, marginBottom:alertOn?12:0, cursor:"pointer", touchAction:"manipulation" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:".76rem", fontWeight:700, color:alertOn?"var(--warning)":"var(--text2)" }}>Alerte {alertOn?"activée":"désactivée"}</div>
            <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>Notification si le solde passe sous le seuil</div>
          </div>
          <div style={{ width:40, height:22, borderRadius:11, background:alertOn?"var(--warning)":"var(--border)", position:"relative", transition:"background .2s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:3, left:alertOn?19:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
          </div>
        </div>
        {alertOn && (
          <div>
            <div style={{ fontSize:".62rem", color:"var(--text2)", fontWeight:700, marginBottom:6 }}>Seuil d'alerte (€)</div>
            <input type="number" value={thresh} min="0" step="50"
              onChange={e=>{setThresh(e.target.value);onSaveAlertSettings?.(alertOn,parseFloat(e.target.value)||0);}}
              style={{ width:"100%", background:"var(--bg)", border:"1.5px solid var(--warning)", borderRadius:9, padding:"11px 14px", color:"var(--text)", fontSize:"1.1rem", fontFamily:"var(--mono)", boxSizing:"border-box", marginBottom:10 }} />
            <div style={{ display:"flex", gap:6 }}>
              {[200,500,1000].map(v=>(
                <button key={v} onClick={()=>{setThresh(String(v));onSaveAlertSettings?.(alertOn,v);}}
                  style={{ flex:1, background:thresh===String(v)?"rgba(200,184,96,.15)":"transparent", border:`1px solid ${thresh===String(v)?"var(--warning)":"var(--border)"}`, borderRadius:8, padding:"8px 0", color:thresh===String(v)?"var(--warning)":"var(--text3)", fontSize:".68rem", fontWeight:700, cursor:"pointer" }}>
                  {v} €
                </button>
              ))}
            </div>
          </div>
        )}
      </Sheet>

      {/* 💶 Reste à vivre (v1.48.0) */}
      <Sheet open={openSheet==="rest"} onClose={close} title="💶 Reste à vivre">
        {(() => {
          const on = restCfg.enabled !== false;
          const margin = parseFloat(restCfg.margin) || 0;
          return (
            <>
              <div onClick={() => onSaveRestSettings?.({ enabled: !on })}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:on?"rgba(92,200,192,.07)":"var(--surface2)", border:`1px solid ${on?"rgba(92,200,192,.35)":"var(--border)"}`, borderRadius:10, marginBottom:12, cursor:"pointer" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:".76rem", fontWeight:700, color:on?"#5cc8c0":"var(--text2)" }}>Pastille {on?"affichée":"masquée"} sur l'accueil</div>
                  <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>(solde estimé − courses prévues − prélèvements avant la paie − marge) ÷ jours restants</div>
                </div>
                <div style={{ width:40, height:22, borderRadius:11, background:on?"#5cc8c0":"var(--border)", position:"relative", flexShrink:0 }}>
                  <div style={{ position:"absolute", top:3, left:on?19:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
                </div>
              </div>
              <div style={{ fontSize:".62rem", color:"var(--text2)", fontWeight:700, marginBottom:6 }}>🛟 Marge de sécurité (€)</div>
              <input type="number" min="0" step="10" value={margin || ""} placeholder="0"
                onChange={e => onSaveRestSettings?.({ margin: Math.max(0, parseFloat(e.target.value) || 0) })}
                style={{ width:"100%", background:"var(--bg)", border:"1.5px solid #5cc8c0", borderRadius:9, padding:"11px 14px", color:"var(--text)", fontSize:"1.1rem", fontFamily:"var(--mono)", boxSizing:"border-box", marginBottom:10 }} />
              <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                {[0,100,200,500].map(v => (
                  <button key={v} onClick={() => onSaveRestSettings?.({ margin: v })}
                    style={{ flex:1, background:margin===v?"rgba(92,200,192,.15)":"transparent", border:`1px solid ${margin===v?"#5cc8c0":"var(--border)"}`, borderRadius:8, padding:"8px 0", color:margin===v?"#5cc8c0":"var(--text3)", fontSize:".68rem", fontWeight:700, cursor:"pointer" }}>{v} €</button>
                ))}
              </div>
              <div style={{ fontSize:".6rem", color:"var(--text3)", lineHeight:1.5 }}>
                Somme que tu veux garder de côté sur le compte : elle est retirée avant de diviser par le nombre de jours. La date de paie vient du « jour de versement » de ton revenu fixe le plus élevé (Fixes → ✏️) ; sans elle, le calcul va jusqu'à la fin du mois.
              </div>
            </>
          );
        })()}
      </Sheet>

      {/* ↩️ Remboursements attendus (v1.69.0) */}
      <Sheet open={openSheet==="reimb"} onClose={close} title="↩️ Remboursements attendus">
        {(() => {
          const days = parseInt(restCfg.reimbLateDays, 10) || 15;
          return (
            <>
              <div style={{ fontSize:".66rem", color:"var(--text2)", lineHeight:1.5, marginBottom:12 }}>
                Un remboursement attendu (dépense marquée « sera remboursée » ou « À recevoir » saisi seul) compte dans le <b style={{ color:"var(--text)" }}>solde estimé</b>, le reste à vivre et la projection dès sa saisie ; la part remboursée d'une dépense ne compte pas dans tes courses. Quand tu touches « Reçu », il devient une opération normale : jamais compté deux fois.
              </div>
              <div style={{ fontSize:".62rem", color:"var(--text2)", fontWeight:700, marginBottom:6 }}>⚠️ En retard après (jours)</div>
              <input data-testid="reimb-late-days" type="number" min="1" step="1" value={days}
                onChange={e => onSaveRestSettings?.({ reimbLateDays: Math.max(1, parseInt(e.target.value, 10) || 15) })}
                style={{ width:"100%", background:"var(--bg)", border:"1.5px solid var(--success)", borderRadius:9, padding:"11px 14px", color:"var(--text)", fontSize:"1.1rem", fontFamily:"var(--mono)", boxSizing:"border-box", marginBottom:10 }} />
              <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                {[7,15,30,45].map(v => (
                  <button key={v} onClick={() => onSaveRestSettings?.({ reimbLateDays: v })}
                    style={{ flex:1, background:days===v?"rgba(104,212,152,.15)":"transparent", border:`1px solid ${days===v?"var(--success)":"var(--border)"}`, borderRadius:8, padding:"8px 0", color:days===v?"var(--success)":"var(--text3)", fontSize:".68rem", fontWeight:700, cursor:"pointer" }}>{v} j</button>
                ))}
              </div>
              <div style={{ fontSize:".6rem", color:"var(--text3)", lineHeight:1.5 }}>
                Compté à partir de la date prévue du remboursement (ou de la dépense si aucune date). En retard, il reste compté mais s'affiche ⚠️ sur l'accueil : annule-le s'il ne viendra pas.
              </div>
            </>
          );
        })()}
      </Sheet>

      {/* 🛒 Budget courses (v1.46.0) */}
      <Sheet open={openSheet==="grocery"} onClose={close} title="🛒 Budget courses">
        {(() => {
          const on = groceryCfg.enabled !== false;
          const save = patch => onSaveGroceryBudget?.(patch);
          const expCats = data.categories.filter(c => c.type === "expense" || !c.type);
          const months = parseInt(groceryCfg.months, 10) || 2;
          return (
            <>
              <div onClick={() => save({ enabled: !on })}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:on?"rgba(224,136,112,.07)":"var(--surface2)", border:`1px solid ${on?"rgba(224,136,112,.3)":"var(--border)"}`, borderRadius:10, marginBottom:on?12:0, cursor:"pointer", touchAction:"manipulation" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:".76rem", fontWeight:700, color:on?"var(--coral)":"var(--text2)" }}>Budget courses {on?"affiché":"masqué"}</div>
                  <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>Pastille sur l'accueil + détail dans le calcul du solde. N'est jamais déduit du solde estimé.</div>
                </div>
                <div style={{ width:40, height:22, borderRadius:11, background:on?"var(--coral)":"var(--border)", position:"relative", transition:"background .2s", flexShrink:0 }}>
                  <div style={{ position:"absolute", top:3, left:on?19:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
                </div>
              </div>
              {on && (
                <>
                  <div style={{ fontSize:".6rem", fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:".1em", margin:"4px 0 6px" }}>Catégories comptées comme courses</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                    {expCats.map(c => {
                      const sel = groceryCats.includes(c.id);
                      return (
                        <button key={c.id} type="button"
                          onClick={() => save({ categoryIds: sel ? groceryCats.filter(id => id !== c.id) : [...groceryCats, c.id] })}
                          style={{ padding:"6px 10px", borderRadius:14, fontSize:".66rem", fontWeight:700, cursor:"pointer", touchAction:"manipulation",
                            border:`1px solid ${sel?"var(--purple)":"var(--border)"}`, color:sel?"var(--purple)":"var(--text2)", background:sel?"rgba(176,144,224,.14)":"transparent" }}>
                          {c.icon} {c.name}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize:".6rem", fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>Moyenne : derniers mois complets + mois en cours (au prorata)</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:12 }}>
                    {[1,2,3].map(n => (
                      <button key={n} type="button" onClick={() => save({ months: n })}
                        style={{ padding:"8px 2px", borderRadius:20, fontSize:".66rem", cursor:"pointer", touchAction:"manipulation",
                          border:`1.5px solid ${months===n?"var(--accent)":"var(--border)"}`, color:months===n?"var(--accent)":"var(--text2)",
                          background:months===n?"rgba(112,184,224,.14)":"transparent", fontWeight:months===n?700:400 }}>
                        {n} mois + en cours
                      </button>
                    ))}
                  </div>
                  <div style={{ padding:"10px 12px", borderRadius:10, background:"rgba(224,136,112,.07)", border:"1px solid rgba(224,136,112,.3)", fontSize:".68rem", color:"var(--text2)", lineHeight:1.7 }}>
                    {groceryCats.length === 0
                      ? "Choisis au moins une catégorie ci-dessus."
                      : !grocery
                        ? "Pas encore assez d'historique : il faut au moins un mois complet d'opérations."
                        : <>Moyenne : <b style={{ color:"var(--text)" }}>{fmt(grocery.average)}</b> / mois{grocery.months.length < months ? ` (sur ${grocery.months.length} mois disponible${grocery.months.length>1?"s":""})` : ""}<br/>
                            Déjà dépensé ce mois : <b style={{ color:"var(--text)" }}>{fmt(grocery.spent)}</b><br/>
                            {grocery.over > 0
                              ? <>Dépassé de : <b style={{ color:"var(--danger)" }}>{fmt(grocery.over)}</b></>
                              : <>Reste à prévoir : <b style={{ color:"var(--coral)" }}>{fmt(grocery.remaining)}</b></>}</>}
                  </div>
                  <div style={{ fontSize:".58rem", color:"var(--text3)", lineHeight:1.5, marginTop:8 }}>
                    Seule la part payée par la banque compte (tickets resto et hors compte exclus). Les récurrentes et arrondis ne sont pas comptés.
                  </div>
                </>
              )}
            </>
          );
        })()}
      </Sheet>

      {/* 🏷️ Gestion catégories */}
      <Sheet open={openSheet==="categories"} onClose={close} title="🏷️ Catégories">
        {/* v1.74.0 : recherche, tri A → Z, groupes Dépenses / Revenus, actions au toucher d'une ligne */}
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <div style={{ flex:1, display:"flex", alignItems:"center", gap:7, borderRadius:12, padding:"8px 11px", background:"var(--surface2)", border:"1px solid var(--border)" }}>
            <span>🔍</span>
            <input data-testid="cat-search" value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="Rechercher une catégorie…"
              style={{ flex:1, minWidth:0, background:"none", border:"none", outline:"none", color:"var(--text)", fontSize:".78rem", fontFamily:"inherit" }} />
            {catSearch && <span onClick={() => setCatSearch("")} style={{ color:"var(--text3)", cursor:"pointer" }}>✕</span>}
          </div>
          <button data-testid="cat-create" onClick={() => onNewCat()} style={{ display:"flex", alignItems:"center", gap:4, background:"var(--btn-pri-bg, var(--accent))", border:"1px solid var(--btn-pri-border, var(--accent))", borderRadius:12, padding:"9px 12px", color:"var(--btn-pri-text, var(--bg))", fontWeight:800, fontSize:".72rem", cursor:"pointer", flexShrink:0, touchAction:"manipulation" }}>
            ＋ Créer
          </button>
        </div>
        <div style={{ display:"flex", gap:5, margin:"8px 0 2px" }}>
          {[["all","Toutes"],["expense","💸 Dépenses"],["income","💰 Revenus"]].map(([k,l])=>(
            <span key={k} role="button" onClick={()=>setCatFilter(k)} style={{ fontSize:".64rem", fontWeight:800, padding:"5px 10px", borderRadius:12, cursor:"pointer",
              color: catFilter===k ? "var(--accent)" : "var(--text2)", border:`1px solid ${catFilter===k ? "color-mix(in srgb, var(--accent) 45%, transparent)" : "var(--border)"}`,
              background: catFilter===k ? "color-mix(in srgb, var(--accent) 13%, transparent)" : "transparent" }}>{l}</span>
          ))}
        </div>
        {filtered.length === 0
          ? <EmptyIllustration type="transactions" title="Aucune catégorie" sub="Crée des catégories pour organiser tes dépenses" ctaColor="var(--accent)" />
          : (() => {
              const AZ = (a, b) => (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" });
              const q = catSearch.trim().toLowerCase();
              const hit = c => !q || (c.name || "").toLowerCase().includes(q);
              const isTop = c => !c.parentId || !data.categories.some(p => p.id === c.parentId);
              const kids  = id => filtered.filter(c => c.parentId === id).sort(AZ);
              const actBtn = (color) => ({ background:"var(--surface2)", border:`1px solid ${color ? `color-mix(in srgb, ${color} 40%, transparent)` : "var(--border)"}`, borderRadius:10, padding:"7px 10px", color: color || "var(--text)", fontSize:".66rem", fontWeight:800, cursor:"pointer", touchAction:"manipulation", whiteSpace:"nowrap" });
              const row = (c, child) => {
                const own = catUsage[c.id] || 0;
                const total = own + (child ? 0 : kids(c.id).reduce((s, k) => s + (catUsage[k.id] || 0), 0));
                const nk = child ? 0 : kids(c.id).length;
                const linkedTo = data.categories.find(x => x.id === c.linkedToId);
                const tint = c.color || (c.type === "income" ? "var(--success)" : "var(--danger)");
                const sel = catSel === c.id;
                return (
                  <div key={c.id} data-cat={c.id}>
                    <div role="button" onClick={() => setCatSel(sel ? null : c.id)}
                      style={{ position:"relative", display:"flex", alignItems:"center", gap:9, padding: child ? "8px 12px 8px 34px" : "9px 12px", cursor:"pointer",
                        borderTop:"1px solid rgba(255,255,255,.06)", background: sel ? "rgba(112,184,224,.08)" : "transparent" }}>
                      {child && <span style={{ position:"absolute", left:18, top:0, bottom:"50%", width:9, borderLeft:"2px solid var(--border)", borderBottom:"2px solid var(--border)", borderRadius:"0 0 0 6px" }} />}
                      <span style={{ width:30, height:30, borderRadius:9, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:".95rem", background:`color-mix(in srgb, ${tint} 18%, transparent)` }}>{c.icon}</span>
                      <span style={{ flex:1, minWidth:0 }}>
                        <span style={{ display:"block", fontSize:".76rem", fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
                        <span style={{ display:"flex", gap:4, alignItems:"center", marginTop:1, flexWrap:"wrap" }}>
                          {total === 0
                            ? <span style={{ fontSize:".52rem", fontWeight:800, padding:"1px 6px", borderRadius:7, color:"var(--warning)", background:"color-mix(in srgb, var(--warning) 15%, transparent)" }}>jamais utilisée</span>
                            : <span style={{ fontSize:".58rem", color:"var(--text2)" }}>{total} opération{total > 1 ? "s" : ""}{nk ? ` · ${nk} sous-cat.` : ""}</span>}
                          {linkedTo && <span style={{ fontSize:".52rem", fontWeight:800, padding:"1px 6px", borderRadius:7, color:"var(--accent)", background:"color-mix(in srgb, var(--accent) 15%, transparent)" }}>🔗 {linkedTo.name}</span>}
                        </span>
                      </span>
                      <span style={{ color:"var(--text3)" }}>›</span>
                    </div>
                    {sel && (
                      <div data-testid="cat-actions" style={{ display:"flex", gap:5, flexWrap:"wrap", padding:"7px 9px", margin:"0 8px 8px", borderRadius:12, background:"var(--fab-menu-bg, var(--surface2))", border:"1px solid var(--accent)" }}>
                        {!child && <button style={actBtn()} onClick={() => onNewCat(c.id)}>＋ Sous-cat.</button>}
                        <button style={actBtn()} onClick={() => onEditCat(c.id)}>✏️ Modifier</button>
                        <button style={actBtn()} onClick={() => setOpenSheet("links")}>🔗 Lier</button>
                        <button style={actBtn("var(--danger)")}
                          onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();if (touchMoved()) return; e.preventDefault();onDeleteCat(c.id);}}
                          onClick={()=>{ if (!("ontouchstart" in window)) onDeleteCat(c.id); }}>🗑 Supprimer</button>
                      </div>
                    )}
                  </div>
                );
              };
              const group = (type, title, color) => {
                const tops = filtered.filter(c => c.type === type && isTop(c)).filter(c => hit(c) || kids(c.id).some(hit)).sort(AZ);
                if (!tops.length) return null;
                return (
                  <div key={type}>
                    <div style={{ fontSize:".58rem", fontWeight:800, letterSpacing:".1em", textTransform:"uppercase", color, margin:"14px 2px 6px" }}>{title} <span style={{ color:"var(--text3)", letterSpacing:0, textTransform:"none" }}>({tops.length})</span></div>
                    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, overflow:"hidden" }}>
                      {tops.map(c => <div key={c.id} style={{ marginTop:-1 }}>{row(c, false)}{kids(c.id).filter(k => !q || hit(k) || hit(c)).map(k => row(k, true))}</div>)}
                    </div>
                  </div>
                );
              };
              return (
                <>
                  {group("expense", "💸 Dépenses", "var(--danger)")}
                  {group("income", "💰 Revenus", "var(--success)")}
                  <div style={{ fontSize:".58rem", color:"var(--text3)", margin:"8px 4px 0" }}>Rangées de A à Z. Toucher une catégorie : sous-catégorie, modifier, lier, supprimer.</div>
                </>
              );
            })()
        }
      </Sheet>

      {/* 🔗 Liaisons */}
      <Sheet open={openSheet==="links"} onClose={close} title="🔗 Liaisons de catégories">
        <div style={{ fontSize:".65rem", color:"var(--text3)", lineHeight:1.5, marginBottom:12 }}>
          Lie une catégorie de remboursement à une catégorie de dépense pour calculer les coûts nets.
        </div>
        {data.categories.filter(c=>c.linkedToId).map(c => {
          const target = data.categories.find(x=>x.id===c.linkedToId);
          if (!target) return null;
          return (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", background:"rgba(104,212,152,.06)", border:"1px solid rgba(104,212,152,.2)", borderRadius:8, marginBottom:6 }}>
              <span style={{ fontSize:".85rem" }}>{c.icon}</span>
              <span style={{ fontSize:".72rem", fontWeight:700, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
              <span style={{ fontSize:".7rem", color:"var(--text3)", flexShrink:0 }}>→</span>
              <span style={{ fontSize:".85rem" }}>{target.icon}</span>
              <span style={{ fontSize:".72rem", fontWeight:700, color:"var(--success)", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{target.name}</span>
              <button onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();if (touchMoved()) return; e.preventDefault();onEditCat({id:c.id,linkedToId:null});}} onClick={()=>onEditCat({id:c.id,linkedToId:null})}
                style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:6, padding:"6px 10px", color:"var(--text3)", fontSize:".75rem", cursor:"pointer", minHeight:32, touchAction:"manipulation" }}>✕</button>
            </div>
          );
        })}
        {data.categories.filter(c=>c.linkedToId).length===0 && (
          <div style={{ fontSize:".65rem", color:"var(--text3)", fontStyle:"italic", textAlign:"center", padding:"8px 0 12px" }}>Aucune liaison définie</div>
        )}
        <LinkForm categories={data.categories} onLink={onEditCat} />
      </Sheet>

      {/* 🔄 Récurrentes */}
      <Sheet open={openSheet==="recurring"} onClose={close} title="🔄 Récurrentes">
        {(data.recurringTemplates||[]).length === 0 ? (
          <div style={{ textAlign:"center", padding:"20px 0", color:"var(--text3)", fontSize:".75rem" }}>Aucun modèle récurrent</div>
        ) : (data.recurringTemplates||[]).map(tpl => {
          const cat  = data.categories.find(c=>c.id===tpl.categoryId);
          const isInc = isIncome(tpl.type);
          const done  = (data.transactions||[]).filter(t=>t.templateId===tpl.id).length;
          return (
            <div key={tpl.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, marginBottom:6 }}>
              <div style={{ width:32, height:32, borderRadius:9, background:"var(--surface2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"1rem" }}>
                {cat?.icon ?? (isInc?"💰":"💸")}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:".74rem", fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{tpl.label}</div>
                <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>
                  {cat?.name ?? "—"} · <span style={{ color:"var(--accent)" }}>{tpl.frequency==="yearly"?"Annuelle":"Mensuelle"}</span>
                  {tpl.occurrences!=null && <span> · {done}/{tpl.occurrences} fois</span>}
                </div>
              </div>
              <div style={{ fontFamily:"var(--mono)", fontWeight:800, color:isInc?"var(--success)":"var(--danger)", fontSize:".78rem", flexShrink:0 }}>{fmt(tpl.amount)}</div>
              <button onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();if (touchMoved()) return; e.preventDefault();onDeleteRecurring?.(tpl.id);}} onClick={()=>onDeleteRecurring?.(tpl.id)}
                style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:7, padding:"5px 8px", color:"var(--text3)", fontSize:".72rem", cursor:"pointer", minHeight:28, touchAction:"manipulation" }}>✕</button>
            </div>
          );
        })}
      </Sheet>

      {/* 💾 Sauvegarde */}
      <Sheet open={openSheet==="notif"} onClose={close} title="🔔 Notifications locales">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, padding:"10px 14px", background:"var(--surface2)", borderRadius:10 }}>
          <div>
            <div style={{ fontSize:".78rem", fontWeight:700, color:"var(--text)" }}>Activer les notifications</div>
            <div style={{ fontSize:".62rem", color:"var(--text3)", marginTop:2 }}>Rappels locaux Android — 100% hors-ligne</div>
          </div>
          <div onClick={()=>toggleNotifMain(!notifOn)} style={{
            width:42, height:24, borderRadius:12, cursor:"pointer",
            background:notifOn?"rgba(200,184,96,.25)":"var(--surface3,var(--surface2))",
            border:`1px solid ${notifOn?"var(--warning)":"var(--border)"}`,
            position:"relative", transition:"all .2s", flexShrink:0,
          }}>
            <div style={{ position:"absolute", top:3, left:notifOn?18:3, width:16, height:16, borderRadius:"50%", background:notifOn?"var(--warning)":"var(--text3)", transition:"all .2s" }}/>
          </div>
        </div>
        {notifOn && (
          <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
            {[
              ["recurring",  notifRecurring, setNotifRecurring, "🔄", "Récurrentes à confirmer",  "Le 1er du mois si non confirmées"],
              ["autoSaving", notifAuto,      setNotifAuto,      "🐷", "Versements auto cagnotte",  "Le jour J si non appliqué"],
              ["alertSolde", notifAlert,     setNotifAlert,     "🔔", "Alerte solde bas",          "Quand le solde passe sous le seuil"],
              ["scheduled",  notifSched,     setNotifSched,     "📅", "Dépenses programmées",      "La veille de chaque dépense prévue"],
              ["backup",     notifBackup,    setNotifBackup,    "💾", "Rappel sauvegarde",         "Si aucune sauvegarde depuis 7 jours"],
              ["cheques",    notifCheques,   setNotifCheques,   "🧾", "Chèques non encaissés",     `Tous les ${chequeDelay} jours, et 1 mois avant péremption`],
              ["reimbursements", notifReimb, setNotifReimb,     "↩️", "Remboursements en retard",  "15 jours après la date prévue, s'il n'est pas reçu"],
              ["evening",    notifEvening,   setNotifEvening,   "🌙", "Rappel du soir",            "Seulement si rien n'a été saisi ce jour-là"],
            ].map(([key, val, setter, ico, lbl, desc]) => (
              <div key={key} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:"var(--surface2)", borderRadius:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:"rgba(200,184,96,.1)", border:"1px solid rgba(200,184,96,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:".85rem", flexShrink:0 }}>{ico}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:".72rem", fontWeight:700, color:"var(--text)" }}>{lbl}</div>
                  <div style={{ fontSize:".6rem", color:"var(--text3)", marginTop:1 }}>{desc}</div>
                </div>
                <div onClick={()=>{ setter(!val); saveNotif(key,!val); }} style={{
                  width:36, height:20, borderRadius:10, cursor:"pointer", flexShrink:0,
                  background:val?"rgba(200,184,96,.2)":"var(--surface3,var(--surface2))",
                  border:`1px solid ${val?"var(--warning)":"var(--border)"}`,
                  position:"relative", transition:"all .2s",
                }}>
                  <div style={{ position:"absolute", top:2, left:val?16:2, width:14, height:14, borderRadius:"50%", background:val?"var(--warning)":"var(--text3)", transition:"all .2s" }}/>
                </div>
              </div>
            ))}
            {notifEvening && (
              <div style={{ marginTop:8, padding:"9px 12px", background:"var(--surface2)", borderRadius:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                  <span style={{ fontSize:".62rem", color:"var(--text2)", flex:1 }}>🌙 Heure</span>
                  {[20, 21, 22].map(h => (
                    <button key={h} onClick={() => { setEveningHour(h); saveNotif("eveningHour", h); }} style={{
                      padding:"5px 10px", borderRadius:14, fontSize:".62rem", fontWeight:800, cursor:"pointer",
                      border:`1px solid ${eveningHour===h ? "var(--accent)" : "var(--border)"}`, color: eveningHour===h ? "var(--accent)" : "var(--text2)",
                      background: eveningHour===h ? "var(--accent-glow)" : "transparent" }}>{h} h</button>
                  ))}
                  <select value={[20,21,22].includes(eveningHour) ? "" : eveningHour} onChange={e => { const h = parseInt(e.target.value, 10); if (!isNaN(h)) { setEveningHour(h); saveNotif("eveningHour", h); } }}
                    style={{ width:72, padding:"4px 6px", fontSize:".62rem", borderRadius:14 }}>
                    <option value="">Autre…</option>
                    {[17,18,19,23].map(h => <option key={h} value={h}>{h} h</option>)}
                  </select>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:".62rem", color:"var(--text2)", flex:1 }}>Jours</span>
                  {[["all","Tous"],["week","Semaine"],["weekend","Week-end"]].map(([k,l]) => (
                    <button key={k} onClick={() => { setEveningDays(k); saveNotif("eveningDays", k); }} style={{
                      padding:"5px 10px", borderRadius:14, fontSize:".62rem", fontWeight:800, cursor:"pointer",
                      border:`1px solid ${eveningDays===k ? "var(--accent)" : "var(--border)"}`, color: eveningDays===k ? "var(--accent)" : "var(--text2)",
                      background: eveningDays===k ? "var(--accent-glow)" : "transparent" }}>{l}</button>
                  ))}
                </div>
                <div style={{ fontSize:".56rem", color:"var(--text3)", marginTop:6, lineHeight:1.4 }}>Les 7 prochains soirs sont programmés ; celui du jour est annulé dès qu'une opération est saisie. Sans ouvrir l'app pendant 7 jours, les rappels s'arrêtent.</div>
              </div>
            )}
            {notifCheques && (
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, padding:"9px 12px", background:"var(--surface2)", borderRadius:10 }}>
                <span style={{ fontSize:".62rem", color:"var(--text2)", flex:1 }}>🧾 Rappel chèque tous les</span>
                {[15, 30, 60].map(n => (
                  <button key={n} onClick={() => { setChequeDelay(n); saveNotif("chequeDelay", n); }} style={{
                    padding:"5px 10px", borderRadius:14, fontSize:".62rem", fontWeight:800, cursor:"pointer",
                    border:`1px solid ${chequeDelay===n ? "var(--chq)" : "var(--border)"}`, color: chequeDelay===n ? "var(--chq)" : "var(--text2)",
                    background: chequeDelay===n ? "var(--chq-glow)" : "transparent",
                  }}>{n} j</button>
                ))}
              </div>
            )}
          </div>
        )}
        {!notifOn && (
          <div style={{ textAlign:"center", color:"var(--text3)", fontSize:".72rem", padding:"20px 0" }}>
            Activez les notifications pour configurer les rappels.
          </div>
        )}
        <div style={{ marginTop:12, padding:"10px 12px", background:"rgba(90,184,224,.06)", border:"1px solid rgba(90,184,224,.12)", borderRadius:9 }}>
          <div style={{ fontSize:".62rem", color:"var(--accent)", lineHeight:1.5, marginBottom:8 }}>
            ℹ️ Les notifications utilisent <strong>@capacitor/local-notifications</strong>. Elles fonctionnent entièrement hors-ligne et ne transmettent aucune donnée.
          </div>
          <button
            className="btn btn-outline"
            style={{ width:"100%", fontSize:".68rem", color:"var(--accent)", borderColor:"var(--accent)" }}
            onClick={() => onScheduleNotifications?.({ enabled:notifOn, recurring:notifRecurring, autoSaving:notifAuto, alertSolde:notifAlert, scheduled:notifSched, backup:notifBackup, cheques:notifCheques, chequeDelay }, { test: true })}>
            🔔 Planifier + envoyer une notification de test
          </button>
        </div>
      </Sheet>

      <Sheet open={openSheet==="backup"} onClose={close} title="💾 Sauvegarde">
        {/* Dernière sauvegarde */}
        <div style={{ background:"var(--surface)", border:`1.5px solid ${backupOk?"rgba(104,212,152,.3)":last?"rgba(200,184,96,.3)":"rgba(200,112,112,.3)"}`, borderLeft:`3px solid ${backupOk?"var(--success)":last?"var(--warning)":"var(--danger)"}`, borderRadius:12, padding:14, marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div>
              <div style={{ fontSize:".65rem", fontWeight:800, color:backupOk?"var(--success)":last?"var(--warning)":"var(--danger)" }}>
                {!last?"⚠️ Aucune sauvegarde":backupOk?`✅ il y a ${daysSinceBackup} jour${daysSinceBackup>1?"s":""}`:`⚠️ il y a ${daysSinceBackup} jours`}
              </div>
              {last && <div style={{ fontFamily:"var(--mono)", fontSize:".82rem", fontWeight:800, marginTop:4 }}>{new Date(last.date).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})} à {last.date.slice(11,16)}</div>}
            </div>
            {last && <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:".72rem", fontWeight:800, color:"var(--accent)" }}>{last.sizeKo} ko</div>
              <div style={{ fontSize:".58rem", color:"var(--text3)", marginTop:1 }}>{last.txCount} transactions</div>
            </div>}
          </div>
          <button className="btn btn-primary" style={{ width:"100%" }} onClick={onExport}>💾 Sauvegarder maintenant</button>
        </div>
        {/* Historique */}
        {(data.backupHistory||[]).length > 0 && (
          <div>
            <button onClick={()=>setShowBackupHist(h=>!h)} style={{ width:"100%", background:"transparent", border:"1px solid var(--border)", borderRadius:8, padding:"9px 12px", color:"var(--text3)", fontSize:".68rem", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6, touchAction:"manipulation" }}>
              <span>📋 Historique ({(data.backupHistory||[]).length})</span>
              <span style={{ transform:showBackupHist?"rotate(90deg)":"none", transition:"transform .2s" }}>›</span>
            </button>
            {showBackupHist && (
              <div style={{ borderRadius:8, overflow:"hidden", border:"1px solid var(--border)" }}>
                {(data.backupHistory||[]).map((b,i) => (
                  <div key={b.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", borderBottom:i<(data.backupHistory||[]).length-1?"1px solid var(--border-soft)":"none" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <span style={{ fontSize:".7rem", fontWeight:700 }}>{new Date(b.date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} à {b.date.slice(11,16)}</span>
                        {i===0 && <span style={{ fontSize:".48rem", background:"rgba(104,212,152,.12)", color:"var(--success)", padding:"1px 5px", borderRadius:6, fontWeight:800 }}>DERNIER</span>}
                      </div>
                      <div style={{ fontSize:".58rem", color:"var(--text3)", marginTop:1 }}>{b.txCount} transactions · {b.sizeKo} ko</div>
                    </div>
                    <button onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();if (touchMoved()) return; e.preventDefault();onExport();}} onClick={onExport}
                      style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:7, padding:"5px 10px", color:"var(--accent)", fontSize:".7rem", cursor:"pointer", minHeight:32, touchAction:"manipulation" }}>📥</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Sheet>
      {showSideAmountTypesModal && (
        <SideAmountTypesModal
          onClose={() => setShowSideAmountTypesModal(false)}
          sideAmountTypes={data.sideAmountTypes || []}
          transactions={data.transactions || []}
          offAccountEntries={data.offAccountEntries || []}
          onSaveType={onSaveSideAmountType}
          onDeleteType={onDeleteSideAmountType}
        />
      )}
      {showTagsModalOpt && (
        <TagsModal
          onClose={() => setShowTagsModalOpt(false)}
          tags={data.tags || []}
          transactions={data.transactions || []}
          fixedExpenses={data.fixedExpenses || []}
          categories={data.categories || []}
          onSaveTag={onSaveTag}
          onDeleteTag={onDeleteTag}
        />
      )}
    </div>
  );
}
