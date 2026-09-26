// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import { fmt, isIncome, APP_NAME, APP_VERSION } from "../utils.js";
import { EmptyIllustration, TagsModal, sha256hex } from "./shared.jsx";

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
  return createPortal(
    <div ref={scrollRef}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.65)", zIndex:600, overflowY:"auto", WebkitOverflowScrolling:"touch" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"var(--bg)", width:"100%", maxWidth:560, margin:"0 auto", minHeight:"100%", padding:"20px 16px 48px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ fontSize:".9rem", fontWeight:800 }}>{title}</div>
          <button onClick={onClose} style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:8, padding:"7px 12px", color:"var(--text2)", cursor:"pointer", fontSize:".78rem", touchAction:"manipulation" }}>✕</button>
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
        onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); doLink(); }}
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

export function OptionsView({ data, onEditCat, onDeleteCat, onNewCat, onExport, onImport, onReset, onDeleteRecurring, alertEnabled = false, alertThreshold = 500, onSaveAlertSettings, roundingEnabled = false, roundingCagnotteId = null, roundingRule = "ceil", onSaveRoundingSettings, autoSavings = [], onSaveAutoSaving, onDeleteAutoSaving, pinEnabled = false, pinHash = null, bioEnabled = false, onSaveSecuritySettings, notifSettings = {}, onSaveNotifSettings, onScheduleNotifications, onPushBack, onPopBack, onOpenQuickTemplates, onSaveSideAmountType, onDeleteSideAmountType, onSaveTag, onDeleteTag }) {
  const [catFilter,     setCatFilter]     = useState("all");
  const [infoOpenId,    setInfoOpenId]    = useState(null);
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

  function saveNotif(field, val) {
    const next = { enabled:notifOn, recurring:notifRecurring, autoSaving:notifAuto, alertSolde:notifAlert, scheduled:notifSched, backup:notifBackup, [field]:val };
    onSaveNotifSettings?.(next);
  }
  function toggleNotifMain(val) {
    const next = { enabled:val, recurring:notifRecurring, autoSaving:notifAuto, alertSolde:notifAlert, scheduled:notifSched, backup:notifBackup };
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
  const last        = (data.backupHistory||[])[0];

  const GROUPS = [
    {
      title:"🔒 Sécurité", color:"var(--accent)",
      items:[
        { id:"security", icon:"🔒", label:"PIN & biométrie",
          badge: pinOn?"PIN actif":"Désactivé",
          configured: pinOn,
          hint: "PIN et biométrie non configurés",
          desc: "Protège l'ouverture de l'app par code ou empreinte/FaceID." },
      ]
    },
    {
      title:"🐷 Épargne", color:"var(--success)",
      items:[
        { id:"autoSavings", icon:"🎯", label:"Versements automatiques",
          badge: autoCount > 0 ? `${autoCount} plan${autoCount>1?"s":""}` : "Inactif",
          configured: autoCount > 0,
          hint: "Aucun versement automatique actif",
          desc: "Vire un montant fixe chaque mois vers une cagnotte, sans y penser." },
        { id:"rounding", icon:"🐷", label:"Arrondi automatique",
          badge: roundOn && roundCag ? roundCag.name : "Désactivé",
          configured: roundOn && !!roundCag,
          hint: "Arrondi automatique désactivé",
          desc: "Arrondit chaque dépense et met la différence de côté dans une cagnotte." },
        { id:"alert", icon:"🔔", label:"Alerte solde bas",
          badge: alertOn ? `${thresh} €` : "Désactivé",
          configured: alertOn,
          hint: "Aucune alerte de solde définie",
          desc: "Prévient sur l'accueil quand ton solde estimé passe sous un seuil choisi." },
      ]
    },
    {
      title:"🏷️ Catégories", color:"var(--purple)",
      items:[
        { id:"categories", icon:"🏷️", label:"Gestion catégories",
          badge: `${data.categories.length} cat.`,
          configured: true,
          hint: "",
          desc: "Crée, modifie ou supprime les catégories utilisées pour classer tes opérations." },
        { id:"links", icon:"🔗", label:"Liaisons",
          badge: linkedCount > 0 ? `${linkedCount} lien${linkedCount>1?"s":""}` : "Aucune",
          configured: linkedCount > 0,
          hint: "Aucune liaison de catégorie créée",
          desc: "Relie deux catégories pour les compter ensemble dans les statistiques." },
        { id:"recurring", icon:"🔄", label:"Récurrentes",
          badge: recurCount > 0 ? `${recurCount} modèle${recurCount>1?"s":""}` : "Aucune",
          configured: recurCount > 0,
          hint: "Aucune transaction récurrente définie",
          desc: "Liste les dépenses/revenus qui reviennent chaque mois ou chaque année." },
        { id:"quickTemplates", icon:"⚡", label:"Templates rapides",
          badge: quickTplCount > 0 ? `${quickTplCount} template${quickTplCount>1?"s":""}` : "Aucun",
          configured: quickTplCount > 0,
          hint: "Aucun template rapide créé",
          desc: "Enregistre une dépense fréquente en 2 taps, via un appui long sur le bouton +.",
          action: onOpenQuickTemplates },
        { id:"sideAmountTypes", icon:"🎫", label:"Montants à part",
          badge: sideAmountTypesCount > 0 ? `${sideAmountTypesCount} type${sideAmountTypesCount>1?"s":""}` : "Aucun",
          configured: sideAmountTypesCount > 0,
          hint: "Aucun type de montant à part créé",
          desc: "Note un montant payé autrement (tickets resto…), sans toucher ton solde.",
          action: () => setShowSideAmountTypesModal(true) },
        { id:"tags", icon:"🏷️", label:"Tags",
          badge: tagsCount > 0 ? `${tagsCount} tag${tagsCount>1?"s":""}` : "Aucun",
          configured: tagsCount > 0,
          hint: "Aucun tag créé",
          desc: "Étiquette tes opérations pour les retrouver facilement (vacances, pro…).",
          action: () => setShowTagsModalOpt(true) },
      ]
    },
    {
      title:"🔔 Notifications", color:"var(--warning)",
      items:[
        { id:"notif", icon:"🔔", label:"Notifications locales",
          badge: notifOn ? "Actif" : "Désactivé",
          configured: notifOn,
          hint: "Notifications locales désactivées",
          desc: "Reçois un rappel sur ton téléphone pour certains événements de l'app." },
      ]
    },
    {
      title:"💾 Données", color:"#c8b860",
      items:[
        { id:"backup", icon:"💾", label:"Sauvegarde",
          badge: last ? `il y a ${daysSinceBackup}j` : "Jamais",
          configured: !!last,
          hint: "Aucune sauvegarde effectuée",
          desc: "Exporte toutes tes données dans un fichier à conserver en lieu sûr." },
      ]
    },
  ];

  return (
    <div>
      {/* ── Menu groupé ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {GROUPS.map(group => (
          <div key={group.title}>
            <div style={{ fontSize:".6rem", fontWeight:800, color:"var(--text3)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:6, paddingLeft:4 }}>
              {group.title}
            </div>
            <div style={{ background:"var(--surface)", borderRadius:12, overflow:"hidden", border:"1px solid var(--border)" }}>
              {group.items.map((item, i) => (
                <Fragment key={item.id}>
                <div
                  onTouchStart={e=>{ e.stopPropagation(); touchPosRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; touchMovedRef.current=false; }}
                  onTouchMove={e=>{ const dx=Math.abs(e.touches[0].clientX-touchPosRef.current.x); const dy=Math.abs(e.touches[0].clientY-touchPosRef.current.y); if(dx>8||dy>8) touchMovedRef.current=true; }}
                  onTouchEnd={e=>{ e.stopPropagation(); e.preventDefault(); if(touchMovedRef.current) return; if(!item.configured && item.hint) showTooltip(item.hint + " · Paramétrez ci-dessous"); if (item.action) item.action(); else setOpenSheet(item.id); }}
                  onClick={()=> item.action ? item.action() : setOpenSheet(item.id)}
                  style={{
                    display:"flex", alignItems:"center", gap:10, padding:"14px 16px",
                    borderBottom: (i<group.items.length-1 && infoOpenId!==item.id) ? "1px solid var(--border-soft)" : "none",
                    cursor:"pointer", touchAction:"manipulation",
                  }}>
                  <span style={{ fontSize:"1rem", width:22, textAlign:"center" }}>{item.icon}</span>
                  <span style={{ display:"flex", alignItems:"center", gap:5, flex:1, minWidth:0 }}>
                    <span style={{ fontSize:".76rem", fontWeight:600 }}>{item.label}</span>
                    {item.desc && (
                      <span
                        onClick={e=>{ e.stopPropagation(); setInfoOpenId(id => id===item.id ? null : item.id); }}
                        onTouchEnd={e=>{ e.stopPropagation(); e.preventDefault(); setInfoOpenId(id => id===item.id ? null : item.id); }}
                        style={{
                          width:15, height:15, borderRadius:"50%",
                          background: infoOpenId===item.id ? "var(--accent-glow)" : "var(--surface2)",
                          border: `1px solid ${infoOpenId===item.id ? "var(--accent)" : "var(--border)"}`,
                          color: infoOpenId===item.id ? "var(--accent)" : "var(--text2)",
                          fontSize:".52rem", fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center",
                          flexShrink:0, cursor:"pointer",
                        }}>ⓘ</span>
                    )}
                  </span>
                  <span style={{ fontSize:".58rem", fontWeight:700, color: item.configured ? "var(--success)" : "var(--warning)", padding:"2px 8px", background: item.configured ? "#1a3a2a" : "#3a2500", borderRadius:10, flexShrink:0 }}>
                    {item.badge}
                  </span>
                  <span style={{ color:"var(--text3)", fontSize:".8rem", flexShrink:0 }}>›</span>
                </div>
                {infoOpenId === item.id && (
                  <div
                    onClick={e=>e.stopPropagation()}
                    onTouchEnd={e=>{ e.stopPropagation(); e.preventDefault(); }}
                    style={{
                      padding:"2px 16px 12px", background:"var(--surface)",
                      borderBottom: i<group.items.length-1 ? "1px solid var(--border-soft)" : "none",
                    }}>
                    <div style={{
                      background:"var(--surface3)", border:"1px solid var(--accent)", borderRadius:10,
                      padding:"9px 12px", fontSize:".62rem", color:"var(--text2)", lineHeight:1.5,
                    }}>
                      {item.desc}
                    </div>
                  </div>
                )}
                </Fragment>
              ))}
            </div>
          </div>
        ))}

        {/* Actions directes */}
        <div style={{ background:"var(--surface)", borderRadius:12, overflow:"hidden", border:"1px solid var(--border)" }}>

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
          <div onClick={onImport} style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", borderBottom:"1px solid var(--border-soft)", cursor:"pointer" }}>
            <span style={{ fontSize:"1rem", width:22, textAlign:"center" }}>⬆️</span>
            <span style={{ flex:1, fontSize:".76rem", fontWeight:600 }}>Importer des données</span>
            <span style={{ color:"var(--text3)", fontSize:".8rem" }}>›</span>
          </div>
          <div onClick={onReset} style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", cursor:"pointer" }}>
            <span style={{ fontSize:"1rem", width:22, textAlign:"center" }}>⚠️</span>
            <span style={{ flex:1, fontSize:".76rem", fontWeight:600, color:"var(--danger)" }}>Réinitialiser toutes les données</span>
            <span style={{ color:"var(--danger)", fontSize:".8rem", opacity:.5 }}>›</span>
          </div>
        </div>
      </div>

      {/* ── Stats globales ── */}
      {globalStats && (
        <div style={{ background:"linear-gradient(135deg,#0c1830,#182a48)", borderRadius:"var(--radius)", padding:"14px 16px", marginTop:16, boxShadow:"0 4px 18px rgba(112,184,224,.12)" }}>
          <div style={{ fontSize:".58rem", color:"rgba(255,255,255,.5)", fontWeight:700, textTransform:"uppercase", letterSpacing:".12em", marginBottom:10 }}>
            📊 Statistiques globales
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[
              { icon:"📋", label:"Transactions",       value:globalStats.count },
              { icon:"📅", label:"Première opération", value:new Date(globalStats.earliest+"T12:00:00").toLocaleDateString("fr-FR",{month:"short",year:"numeric"}) },
              { icon:"💶", label:"Total géré",         value:fmt(globalStats.totalGere) },
              { icon:"🏷️", label:"Catégories",         value:data.categories.length },
            ].map(s=>(
              <div key={s.label} style={{ background:"rgba(255,255,255,.06)", borderRadius:10, padding:"10px 12px" }}>
                <div style={{ fontSize:".58rem", color:"rgba(255,255,255,.45)", marginBottom:4 }}>{s.icon} {s.label}</div>
                <div style={{ fontFamily:"var(--mono)", fontWeight:800, color:"#fff", fontSize:".85rem" }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Version */}
      <div style={{ marginTop:32, textAlign:"center", color:"var(--text3)", fontSize:".65rem", letterSpacing:".06em", fontWeight:600 }}>
        {APP_NAME} — v{APP_VERSION}
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
                      onTouchEnd={e=>{ e.stopPropagation();e.preventDefault();
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
              <button onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();e.preventDefault();onDeleteAutoSaving?.(plan.id);}} onClick={()=>onDeleteAutoSaving?.(plan.id)}
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

      {/* 🏷️ Gestion catégories */}
      <Sheet open={openSheet==="categories"} onClose={close} title="🏷️ Catégories">
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:10 }}>
          {[["all","Toutes"],["expense","Dépenses"],["income","Revenus"]].map(([k,l])=>(
            <div key={k} className={`filter-chip${catFilter===k?" active":""}`} onClick={()=>setCatFilter(k)}>{l}</div>
          ))}
          <button onClick={onNewCat} style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4, background:"var(--accent)", border:"none", borderRadius:20, padding:"6px 14px", color:"var(--bg)", fontWeight:800, fontSize:".7rem", cursor:"pointer", flexShrink:0, touchAction:"manipulation" }}>
            ＋ Créer
          </button>
        </div>
        <div className="cat-grid">
          {filtered.length === 0
            ? <EmptyIllustration type="transactions" title="Aucune catégorie" sub="Crée des catégories pour organiser tes dépenses" ctaColor="var(--accent)" style={{ gridColumn:"1/-1" }} />
            : filtered.map(c => {
                const usage    = catUsage[c.id] || 0;
                const linkedTo = data.categories.find(x => x.id === c.linkedToId);
                return (
                  <div key={c.id} className="cat-card-opt" onClick={() => onEditCat(c.id)}>
                    <div style={{ position:"absolute", top:5, left:5, width:6, height:6, borderRadius:"50%", background:c.type==="expense"?"var(--danger)":"var(--success)" }} />
                    <div style={{ position:"absolute", top:4, right:4, fontSize:".48rem", fontWeight:800, lineHeight:1, color:usage===0?"var(--danger)":"var(--text3)", background:usage===0?"var(--danger-glow)":"var(--surface3)", padding:"2px 4px", borderRadius:4 }}>
                      {usage===0?"✕":usage}
                    </div>
                    <span style={{ fontSize:"1.05rem", lineHeight:1, marginTop:6 }}>{c.icon}</span>
                    <span style={{ fontSize:".6rem", fontWeight:700, wordBreak:"break-word", whiteSpace:"normal", textAlign:"center", lineHeight:1.3, width:"100%", padding:"0 3px" }}>{c.name}</span>
                    {linkedTo && <span style={{ fontSize:".46rem", color:"var(--success)", background:"rgba(104,212,152,.1)", padding:"1px 4px", borderRadius:3, fontWeight:700, lineHeight:1.6 }}>🔗</span>}
                    <button className="btn-action btn-del" style={{ fontSize:".68rem", padding:"2px 6px", marginTop:2, lineHeight:1.4, minWidth:24, minHeight:24 }}
                      onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();e.preventDefault();onDeleteCat(c.id);}} onClick={e=>e.stopPropagation()}>✕</button>
                  </div>
                );
              })
          }
        </div>
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
              <button onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();e.preventDefault();onEditCat({id:c.id,linkedToId:null});}} onClick={()=>onEditCat({id:c.id,linkedToId:null})}
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
              <button onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();e.preventDefault();onDeleteRecurring?.(tpl.id);}} onClick={()=>onDeleteRecurring?.(tpl.id)}
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
            onClick={() => onScheduleNotifications?.({ enabled:notifOn, recurring:notifRecurring, autoSaving:notifAuto, alertSolde:notifAlert, scheduled:notifSched, backup:notifBackup }, { test: true })}>
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
                    <button onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.stopPropagation();e.preventDefault();onExport();}} onClick={onExport}
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
