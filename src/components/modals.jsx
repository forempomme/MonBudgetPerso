// modals.jsx — v1.29.4
// Changelog v1.29.4 : Fix récurrentes — se répétaient une fois de trop.
//   • La 1ère opération n'était jamais reliée au modèle récurrent (templateId absent)
//   • Elle ne comptait donc pas dans le compteur "Nombre de fois", qui se déclenchait
//     un mois trop tard → une confirmation supplémentaire était proposée
//   • Fix : l'id du modèle est généré avant l'enregistrement et attaché dès la 1ère opération
//
// Changelog v1.29.3 : Fix écran noir à l'ouverture du bouton + (FAB).
//   • `isAdj` était utilisé dans NumPad() sans y être défini (variable du composant parent)
//   • ReferenceError au montage → crash React non rattrapé → écran noir, app figée
//   • Fix : `isAdj` calculé localement dans NumPad
//
// Changelog v1.29.2 : Fix grille catégorie — scroll + sélection fantôme.
//   • Overlay onTouchMove + e.preventDefault() → bloque le scroll du fond (page + modal)
//   • Drag détecté sur chaque cellule via catTouchRef (startY/startX/moved)
//     Si le pouce a bougé de >6px, onTouchEnd n'applique pas la sélection
//   • La grille elle-même stoppe la propagation de tous les touch events
//     pour éviter que l'overlay les reçoive et se ferme intempestivement
//   • touchAction: "pan-y" sur les cellules (scroll interne si grille longue)
//
// Changelog v1.29.0 : Catégorie — chips scrollables → grille dépliable 4 colonnes.
//   • Tap sur le champ → grille s'ouvre sous le trigger (border-radius adapté)
//   • Grille 4 colonnes : icône + nom, sélection ferme automatiquement
//   • Chip "Aucune" en pleine largeur en tête de grille
//   • Fermeture sur tap extérieur (onBlur sur le wrapper)
//   • Toutes les fonctionnalités v1.28.0 conservées
//
// Changelog v1.28.0 : TransModal redessiné — layout compact tenant sur un écran sans scroll.
//   • Sélecteur type : pills visuels
//   • NumPad : hauteur touches 50px → 43px (-28px total)
//   • Date : <input type="date"> remplacé par 4 boutons pills en ligne
//   • Labels de section : style UPPERCASE 10px
//   • Note : champ sans label séparé (placeholder suffit)
//   • Récurrente : toggle identique, conservé
//   • Alerte doublon : conservée
//   • Tous les autres modals : inchangés

import { useState, useRef } from "react";
import { Modal, ItemRow } from "./index.jsx";
import { fmt, todayISO, isIncome, MONTHS_SHORT, uid, currentYM } from "../utils.js";
import { useToast } from "../context.js";
import { useTotalFixes } from "../hooks.js";

// ─── Helper : parse un montant saisi avec virgule ou point ────────
const parseAmt = s => parseFloat(String(s ?? "").replace(",", ".")) || 0;

// ─── Shared field-error display ──────────────────────────────────
function FieldError({ msg }) {
  if (!msg) return null;
  return <div className="field-error">⚠ {msg}</div>;
}

// ─── Field wrapper (conservé pour les autres modals) ─────────────
function Field({ label, error, children }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
      <FieldError msg={error} />
    </div>
  );
}

// ─── Section label compact (style app) ───────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: ".6rem", fontWeight: 700, color: "var(--text3)",
      letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 5,
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  NumPad — clavier numérique custom (touches réduites à 43px)
// ─────────────────────────────────────────────────────────────────
function NumPad({ value, onChange, type, onTypeChange }) {
  const OPERATORS = ["+", "-"];
  const isAdj = type === "balance_adjustment";
  const isSimpleType = (type === "expense" || type === "income") && !isAdj;

  function evalSimple(expr) {
    try {
      const tokens = expr.match(/(\d+\.?\d*|\+|-)/g);
      if (!tokens) return null;
      let result = parseFloat(tokens[0]);
      for (let i = 1; i < tokens.length; i += 2) {
        const op  = tokens[i];
        const nxt = parseFloat(tokens[i + 1]);
        if (isNaN(nxt)) break;
        if (op === "+") result += nxt;
        else if (op === "-") result -= nxt;
      }
      return isNaN(result) ? null : Math.round(result * 100) / 100;
    } catch { return null; }
  }

  function press(k) {
    onChange(prev => {
      const last = prev.slice(-1);
      if (k === "⌫") return prev.slice(0, -1);
      if (k === "=") {
        const clean = prev.replace(/,/g, ".");
        const r = evalSimple(clean);
        return r !== null ? String(Math.abs(r)).replace(".", ",") : prev;
      }
      if (OPERATORS.includes(k)) {
        if (!prev) return prev;
        if (OPERATORS.includes(last)) return prev.slice(0, -1) + k;
        return prev + k;
      }
      if (k === ",") {
        const lastOpIdx = Math.max(...OPERATORS.map(op => prev.lastIndexOf(op)), -1);
        const segment = lastOpIdx >= 0 ? prev.slice(lastOpIdx + 1) : prev;
        if (segment.includes(",")) return prev;
        if (!segment) return prev + "0,";
        return prev + ",";
      }
      return prev + k;
    });
  }

  const val         = String(value ?? "");
  const hasOperator = OPERATORS.some(op => val.includes(op));
  const displayVal  = val || "0";
  const preview     = hasOperator ? (() => {
    const r = evalSimple(val.replace(/,/g, "."));
    return r !== null ? fmt(Math.abs(r)) : null;
  })() : null;

  const isExpense   = type === "expense";
  const accentColor = isExpense ? "var(--danger)" : "var(--success)";

  // ── Disposition touches : ⌫ en haut à droite, opérateurs à droite ──
  const KEYS = [
    ["7", "8", "9", "⌫"],
    ["4", "5", "6", "+"],
    ["1", "2", "3", "-"],
    [",", "0", "=", " "],
  ];

  return (
    <div>
      {/* Affichage montant + bascule type */}
      <div style={{
        background: isExpense ? "rgba(200,112,112,.06)" : "rgba(104,212,152,.06)",
        border: `1px solid ${isExpense ? "rgba(200,112,112,.2)" : "rgba(104,212,152,.2)"}`,
        borderRadius: 12, padding: "8px 12px", marginBottom: 8,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          {hasOperator && (
            <div style={{ fontSize: ".58rem", color: "var(--text3)", fontFamily: "var(--mono)", marginBottom: 2 }}>
              {value} =
            </div>
          )}
          <div style={{ fontFamily: "var(--mono)", fontSize: "1.8rem", fontWeight: 800, color: accentColor, lineHeight: 1 }}>
            {isExpense ? "−" : "+"}{displayVal} €
          </div>
          {preview && (
            <div style={{ fontSize: ".62rem", color: "var(--text3)", marginTop: 3 }}>
              = {isExpense ? "−" : "+"}{preview}
            </div>
          )}
        </div>
        {isSimpleType && (
          <button onClick={() => onTypeChange(isExpense ? "income" : "expense")} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            background: isExpense ? "rgba(104,212,152,.1)" : "rgba(200,112,112,.1)",
            border: `1px solid ${isExpense ? "rgba(104,212,152,.25)" : "rgba(200,112,112,.25)"}`,
            borderRadius: 9, padding: "6px 10px", cursor: "pointer", flexShrink: 0, touchAction: "manipulation",
          }}>
            <span style={{ fontSize: ".5rem", color: "var(--text3)" }}>Passer en</span>
            <span style={{ fontSize: ".65rem", fontWeight: 800, color: isExpense ? "var(--success)" : "var(--danger)" }}>
              {isExpense ? "Revenu ↑" : "Dépense ↓"}
            </span>
          </button>
        )}
      </div>

      {/* Grille touches — hauteur réduite 50→43px */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {KEYS.map((row, ri) => (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5 }}>
            {row.map((k, ki) => {
              if (k === " ") return <div key={ki} />;
              const isOp  = OPERATORS.includes(k);
              const isEq  = k === "=";
              const isDel = k === "⌫";
              return (
                <button key={ki}
                  onTouchStart={e => e.stopPropagation()}
                  onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); press(k); }}
                  onClick={() => press(k)}
                  style={{
                    height: 43,                          // ← 50→43px
                    background: isOp  ? "rgba(112,184,224,.1)"
                               : isEq  ? "rgba(104,212,152,.15)"
                               : isDel ? "rgba(200,112,112,.1)"
                               : "var(--surface2)",
                    border: `1px solid ${isOp ? "var(--accent)" : isEq ? "var(--success)" : isDel ? "rgba(200,112,112,.3)" : "var(--border)"}`,
                    borderRadius: 9,
                    color: isOp ? "var(--accent)" : isEq ? "var(--success)" : isDel ? "var(--danger)" : "var(--text)",
                    fontSize: "1.05rem", fontWeight: 700, cursor: "pointer", touchAction: "manipulation",
                  }}>{k}</button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Transaction modal — redessiné v1.28.0
// ─────────────────────────────────────────────────────────────────
export function TransModal({
  transactions, categories, cagnottes, tags = [],
  roundingEnabled = false, roundingCagnotteId = null, roundingRule = "ceil",
  editingId, defaultType = "expense",
  onSave, onSaveRecurring, onClose,
}) {
  const toast = useToast();
  const tx    = editingId ? transactions.find(t => t.id === editingId) : null;

  const [type,        setType]        = useState(tx?.type || defaultType);
  const [amount,      setAmount]      = useState(tx?.amount != null ? String(tx.amount) : "");
  const [date,        setDate]        = useState(tx?.date         || todayISO());
  const [catId,       setCatId]       = useState(tx?.categoryId   || "");
  const [cagId,       setCagId]       = useState(tx?.targetCagId  || cagnottes[0]?.id || "");
  const [note,        setNote]        = useState(tx?.note         || (defaultType === "balance_adjustment" ? "Ajustement de solde" : ""));
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency,   setFrequency]   = useState("monthly");
  const [occurrences, setOccurrences] = useState("");
  const [tagIds,      setTagIds]      = useState(tx?.tagIds || []);
  const [errors,      setErrors]      = useState({});
  const [dupWarning,  setDupWarning]  = useState(null);
  const [catOpen,     setCatOpen]     = useState(false);
  // Ref pour détecter un drag (scroll) vs un tap sur la grille catégorie
  const catTouchRef = useRef({ startY: 0, startX: 0, moved: false });

  const isCag = type === "epargne" || type === "decagnottage";
  const isInc = type === "income";
  const cats  = categories.filter(c => isInc ? c.type === "income" : c.type === "expense");

  // Couleur accentuée selon le type
  const isAdj = type === "balance_adjustment";
  const accentColor = isAdj ? "var(--sapin)" : isInc ? "var(--success)" : isCag ? "var(--purple)" : "var(--danger)";

  // Raccourcis date
  const todayStr     = todayISO();
  const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const beforeStr    = (() => { const d = new Date(); d.setDate(d.getDate()-2); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const dateIsShortcut = [todayStr, yesterdayStr, beforeStr].includes(date);

  function findDuplicate(amt, catId, txDate, txType) {
    if (!amt || editingId) return null;
    const d = new Date(txDate + "T12:00:00");
    return transactions.find(t => {
      if (t.type !== txType) return false;
      if (Math.abs((parseFloat(t.amount)||0) - parseAmt(amt)) > 0.01) return false;
      if (t.categoryId !== catId) return false;
      const td = new Date(t.date + "T12:00:00");
      return Math.abs((d - td) / 86400000) <= 7;
    }) || null;
  }

  function validate() {
    const e = {};
    const a = parseAmt(amount);
    if (!amount || isNaN(a) || a <= 0)  e.amount = "Montant requis et doit être > 0";
    if (!date)                           e.date   = "Date requise";
    if (isCag && !cagId)                 e.cag    = "Sélectionnez une cagnotte";
    if (type === "decagnottage" && !editingId) {
      const c = cagnottes.find(x => x.id === cagId);
      if (c && c.current < a)            e.amount = `Fonds insuffisants (${fmt(c.current)} disponible)`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave(force = false) {
    if (!validate()) return;
    const parsedAmt = parseAmt(amount);
    if (!force && !isCag) {
      const dup = findDuplicate(amount, catId, date, type);
      if (dup) {
        const cat = categories.find(c => c.id === dup.categoryId);
        setDupWarning({ tx: dup, catName: cat?.name || "—" });
        return;
      }
    }
    setDupWarning(null);
    // On génère l'id du modèle récurrent ICI (avant l'enregistrement) pour pouvoir
    // relier la toute première opération à ce modèle — sinon elle ne compte pas
    // dans le nombre de fois choisi (bug : la récurrente se répétait une fois de trop).
    const recurringId = (isRecurring && !editingId && !isCag) ? uid("rc") : undefined;
    onSave({ id: editingId || null, type, amount: parsedAmt, date, categoryId: catId, targetCagId: cagId, note, tagIds: tagIds.length > 0 ? tagIds : undefined, templateId: recurringId });
    if (recurringId) {
      onSaveRecurring?.({
        id: recurringId,
        type, amount: parsedAmt, categoryId: catId, note, frequency,
        occurrences: frequency === "monthly" && occurrences !== "" ? parseInt(occurrences, 10) : null,
        label: note || (categories.find(c => c.id === catId)?.name) || "Récurrente",
      });
    }
    if (isCag) {
      const cag = cagnottes.find(x => x.id === cagId);
      if (cag) {
        let newBal = cag.current;
        if (editingId && tx && tx.targetCagId === cagId) {
          if (tx.type === "epargne")      newBal -= parseFloat(tx.amount) || 0;
          if (tx.type === "decagnottage") newBal += parseFloat(tx.amount) || 0;
        }
        if (type === "epargne")      newBal += parsedAmt;
        if (type === "decagnottage") newBal -= parsedAmt;
        toast(`🎯 ${cag.name} : ${fmt(newBal)}`);
        return;
      }
    }
    toast(editingId ? "Opération modifiée" : "Opération ajoutée");
  }

  // Label et emoji du bouton valider
  const saveLabel = isAdj ? "Enregistrer l'équilibre"
    : isInc ? "Enregistrer le revenu"
    : type === "epargne" ? "Déposer dans la cagnotte"
    : type === "decagnottage" ? "Retirer de la cagnotte"
    : "Enregistrer la dépense";
  const saveEmoji = isAdj ? "⚖️" : isInc ? "💰" : type === "epargne" ? "🐷" : "💸";

  return (
    <Modal onClose={onClose} title={editingId ? "Modifier l'opération" : "Nouvelle opération"}>

      {/* ── Pills type ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[
          { k: "expense",            emoji: "💸", label: "Dépense"   },
          { k: "income",             emoji: "💰", label: "Revenu"    },
          { k: "epargne",            emoji: "🐷", label: "Cagnotte"  },
          { k: "balance_adjustment", emoji: "⚖️", label: "Équilibre" },
        ].map(({ k, emoji, label }) => {
          const sel = type === k || (k === "epargne" && isCag);
          const c   = k === "income" ? "var(--success)" : k === "epargne" ? "var(--purple)" : k === "balance_adjustment" ? "var(--sapin)" : "var(--danger)";
          return (
            <button key={k}
              onTouchStart={e => e.stopPropagation()}
              onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); setType(k); setErrors({}); setCatId(""); }}
              onClick={() => { setType(k); setErrors({}); setCatId(""); }}
              style={{
                padding: "9px 4px 7px",
                borderRadius: "var(--radius)",
                border: `1.5px solid ${sel ? c : "var(--border)"}`,
                background: sel ? `color-mix(in srgb, ${c} 14%, var(--surface2))` : "var(--surface2)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                cursor: "pointer", touchAction: "manipulation",
              }}>
              <span style={{ fontSize: "1.2rem" }}>{emoji}</span>
              <span style={{ fontSize: ".65rem", fontWeight: 700, color: sel ? c : "var(--text3)" }}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Sous-toggle épargne / décagnottage ── */}
      {isCag && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
          {[["epargne", "↑ Dépôt"], ["decagnottage", "↓ Retrait"]].map(([k, l]) => (
            <button key={k}
              onTouchStart={e => e.stopPropagation()}
              onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); setType(k); setErrors({}); }}
              onClick={() => { setType(k); setErrors({}); }}
              style={{
                padding: "7px", borderRadius: 10, fontSize: ".68rem", fontWeight: 700, cursor: "pointer", touchAction: "manipulation",
                background: type === k ? "rgba(176,144,224,.15)" : "var(--surface2)",
                border: `1.5px solid ${type === k ? "var(--purple)" : "var(--border)"}`,
                color: type === k ? "var(--purple)" : "var(--text3)",
              }}>{l}</button>
          ))}
        </div>
      )}

      {/* ── Info équilibre ── */}
      {isAdj && (
        <div style={{ marginBottom: 10, padding: "9px 12px", background: "rgba(88,192,144,.08)", border: "1px solid rgba(88,192,144,.2)", borderRadius: 10 }}>
          <div style={{ fontSize: ".68rem", color: "var(--sapin)", fontWeight: 700, marginBottom: 2 }}>⚖️ Opération d'équilibre</div>
          <div style={{ fontSize: ".62rem", color: "var(--text3)", lineHeight: 1.5 }}>
            Ajuste le solde pointé sans impacter le solde estimé. Utile pour corriger un écart bancaire.
          </div>
        </div>
      )}
      {/* ── NumPad (inclut l'affichage montant) ── */}
      <div style={{ marginBottom: 10 }}>
        {errors.amount && <FieldError msg={errors.amount} />}
        <NumPad
          value={amount}
          onChange={val => { setAmount(typeof val === "function" ? val(amount) : val); setErrors(v => ({ ...v, amount: "" })); }}
          type={type}
          onTypeChange={t => { setType(t); setErrors({}); }}
        />
      </div>

      {/* ── Catégorie — overlay fixed, scroll bloqué, drag détecté ── */}
      {!isCag && !isAdj && (
        <div style={{ marginBottom: 10 }}>
          <SectionLabel>Catégorie</SectionLabel>

          {/* Trigger */}
          <button
            onTouchStart={e => e.stopPropagation()}
            onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); setCatOpen(o => !o); }}
            onClick={() => { if (!('ontouchstart' in window)) setCatOpen(o => !o); }}
            style={{
              width: "100%", padding: "9px 12px", boxSizing: "border-box",
              background: "var(--surface2)",
              border: `1.5px solid ${catId ? accentColor : "var(--border)"}`,
              borderRadius: 10,
              color: catId ? "var(--text)" : "var(--text3)",
              fontSize: ".78rem", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 8,
              cursor: "pointer", touchAction: "manipulation",
            }}>
            {(() => {
              const cat = cats.find(c => c.id === catId);
              return cat
                ? <><span style={{ fontSize: "1rem" }}>{cat.icon}</span><span style={{ flex: 1, textAlign: "left" }}>{cat.name}</span></>
                : <span style={{ flex: 1, textAlign: "left", color: "var(--text3)" }}>Aucune catégorie</span>;
            })()}
            <span style={{
              color: "var(--text2)", fontSize: ".7rem",
              display: "inline-block", transition: "transform .2s",
              transform: catOpen ? "rotate(180deg)" : "none",
            }}>▾</span>
          </button>

          {catOpen && (
            <>
              {/* Overlay — bloque le scroll du fond via onTouchMove passive:false */}
              <div
                style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)" }}
                onTouchStart={e => { e.stopPropagation(); e.preventDefault(); }}
                onTouchMove={e => { e.stopPropagation(); e.preventDefault(); }}
                onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); setCatOpen(false); }}
                onClick={() => setCatOpen(false)}
              />

              {/* Grille centrée */}
              <div
                style={{
                  position: "fixed",
                  top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 201,
                  width: "min(92vw, 380px)",
                  background: "var(--surface)",
                  border: "1.5px solid var(--border)",
                  borderRadius: 16,
                  padding: 12,
                  boxShadow: "0 24px 60px rgba(0,0,0,.8)",
                }}
                // Empêche les events de buller vers l'overlay
                onTouchStart={e => e.stopPropagation()}
                onTouchMove={e => e.stopPropagation()}
                onTouchEnd={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
              >
                {/* En-tête */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: ".68rem", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em" }}>
                    Catégorie
                  </span>
                  <button
                    onTouchStart={e => e.stopPropagation()}
                    onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); setCatOpen(false); }}
                    onClick={() => { if (!('ontouchstart' in window)) setCatOpen(false); }}
                    style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: "var(--surface2)", border: "1px solid var(--border)",
                      color: "var(--text2)", fontSize: 13, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      touchAction: "manipulation",
                    }}>✕</button>
                </div>

                {/* Grille 4 colonnes — drag détecté pour éviter sélection au scroll */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>

                  {/* Aucune */}
                  <button
                    onTouchStart={e => {
                      e.stopPropagation();
                      catTouchRef.current = { startY: e.touches[0].clientY, startX: e.touches[0].clientX, moved: false };
                    }}
                    onTouchMove={e => {
                      const dy = Math.abs(e.touches[0].clientY - catTouchRef.current.startY);
                      const dx = Math.abs(e.touches[0].clientX - catTouchRef.current.startX);
                      if (dy > 6 || dx > 6) catTouchRef.current.moved = true;
                    }}
                    onTouchEnd={e => {
                      e.stopPropagation(); e.preventDefault();
                      if (!catTouchRef.current.moved) { setCatId(""); setCatOpen(false); }
                    }}
                    onClick={() => { if (!('ontouchstart' in window)) { setCatId(""); setCatOpen(false); } }}
                    style={{
                      gridColumn: "1 / -1", padding: "7px 10px", borderRadius: 9,
                      border: `1px solid ${!catId ? accentColor : "var(--border)"}`,
                      background: !catId ? `color-mix(in srgb, ${accentColor} 14%, var(--surface2))` : "var(--surface2)",
                      color: !catId ? accentColor : "var(--text3)",
                      fontSize: ".68rem", fontWeight: 700, cursor: "pointer", touchAction: "pan-y",
                    }}>⊘ Aucune</button>

                  {cats.map(c => (
                    <button key={c.id}
                      onTouchStart={e => {
                        e.stopPropagation();
                        catTouchRef.current = { startY: e.touches[0].clientY, startX: e.touches[0].clientX, moved: false };
                      }}
                      onTouchMove={e => {
                        const dy = Math.abs(e.touches[0].clientY - catTouchRef.current.startY);
                        const dx = Math.abs(e.touches[0].clientX - catTouchRef.current.startX);
                        if (dy > 6 || dx > 6) catTouchRef.current.moved = true;
                      }}
                      onTouchEnd={e => {
                        e.stopPropagation(); e.preventDefault();
                        if (!catTouchRef.current.moved) { setCatId(c.id); setCatOpen(false); }
                      }}
                      onClick={() => { if (!('ontouchstart' in window)) { setCatId(c.id); setCatOpen(false); } }}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        padding: "8px 4px", gap: 4, borderRadius: 10,
                        border: `1.5px solid ${catId === c.id ? accentColor : "var(--border)"}`,
                        background: catId === c.id ? `color-mix(in srgb, ${accentColor} 14%, var(--surface2))` : "var(--surface2)",
                        cursor: "pointer", touchAction: "pan-y",
                      }}>
                      <span style={{ fontSize: "1.2rem" }}>{c.icon}</span>
                      <span style={{
                        fontSize: ".55rem", lineHeight: 1.2, textAlign: "center",
                        color: catId === c.id ? accentColor : "var(--text3)",
                        fontWeight: catId === c.id ? 700 : 400,
                        maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Cagnotte cible — chips scrollables ── */}
      {isCag && (
        <div style={{ marginBottom: 10 }}>
          <SectionLabel>Cagnotte cible</SectionLabel>
          {errors.cag && <FieldError msg={errors.cag} />}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
            {cagnottes.length === 0
              ? <span style={{ fontSize: ".68rem", color: "var(--text3)" }}>Aucune cagnotte disponible</span>
              : cagnottes.map(c => (
                <button key={c.id}
                  onTouchStart={e => e.stopPropagation()}
                  onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); setCagId(c.id); setErrors(v => ({ ...v, cag: "" })); }}
                  onClick={() => { setCagId(c.id); setErrors(v => ({ ...v, cag: "" })); }}
                  style={{
                    flexShrink: 0, padding: "5px 13px", borderRadius: 20,
                    border: `1.5px solid ${cagId === c.id ? "var(--purple)" : "var(--border)"}`,
                    background: cagId === c.id ? "rgba(176,144,224,.15)" : "var(--surface2)",
                    color: cagId === c.id ? "var(--purple)" : "var(--text2)",
                    fontSize: ".68rem", fontWeight: cagId === c.id ? 700 : 400,
                    cursor: "pointer", touchAction: "manipulation",
                  }}>
                  {c.name} <span style={{ color: "var(--text3)", marginLeft: 3 }}>({fmt(c.current)})</span>
                </button>
              ))
            }
          </div>
        </div>
      )}

      {/* ── Date — 4 boutons pills ── */}
      <div style={{ marginBottom: 10 }}>
        <SectionLabel>Date</SectionLabel>
        {errors.date && <FieldError msg={errors.date} />}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
          {[
            ["Aujourd'hui", todayStr],
            ["Hier",        yesterdayStr],
            ["Avant-hier",  beforeStr],
            ["Autre…",      null],
          ].map(([label, d]) => {
            const sel = d ? date === d : !dateIsShortcut;
            return (
              <button key={label}
                onTouchStart={e => e.stopPropagation()}
                onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); if (d) { setDate(d); setErrors(v => ({ ...v, date: "" })); } }}
                onClick={() => { if (d) { setDate(d); setErrors(v => ({ ...v, date: "" })); } }}
                style={{
                  padding: "6px 2px", borderRadius: 20, fontSize: ".65rem",
                  border: `1.5px solid ${sel ? accentColor : "var(--border)"}`,
                  background: sel ? `color-mix(in srgb, ${accentColor} 14%, var(--surface2))` : "var(--surface2)",
                  color: sel ? accentColor : "var(--text2)",
                  fontWeight: sel ? 700 : 400, cursor: "pointer", touchAction: "manipulation",
                }}>{label}</button>
            );
          })}
        </div>
        {/* Champ date natif affiché uniquement si "Autre…" sélectionné */}
        {!dateIsShortcut && (
          <input type="date" value={date}
            className={errors.date ? "error" : ""}
            onChange={e => { setDate(e.target.value); setErrors(v => ({ ...v, date: "" })); }}
            style={{ marginTop: 6, width: "100%", boxSizing: "border-box" }}
          />
        )}
      </div>

      {/* ── Note ── */}
      <div style={{ marginBottom: 10 }}>
        <input type="text" placeholder={isAdj ? "Ex: Écart bancaire, arrondi…" : "Note (optionnel)…"} value={note}
          onChange={e => setNote(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box" }}
        />

        {/* Tags */}
        {tags.length > 0 && !isCag && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: ".6rem", color: "var(--text3)", fontWeight: 700, marginBottom: 6 }}>
              🏷️ Tags <span style={{ fontWeight: 400 }}>(optionnel)</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {tags.map(tag => {
                const selected = tagIds.includes(tag.id);
                return (
                  <div key={tag.id}
                    onClick={() => setTagIds(ids => selected ? ids.filter(i => i !== tag.id) : [...ids, tag.id])}
                    style={{
                      display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
                      background: selected ? `${tag.color}22` : "var(--surface2)",
                      border: `1px solid ${selected ? tag.color : "var(--border)"}`,
                      borderRadius: 20, cursor: "pointer",
                    }}>
                    <span style={{ fontSize: ".7rem" }}>{tag.icon}</span>
                    <span style={{ fontSize: ".65rem", fontWeight: selected ? 700 : 400, color: selected ? tag.color : "var(--text2)" }}>{tag.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Preview arrondi automatique */}
        {roundingEnabled && type === "expense" && roundingCagnotteId && (() => {
          const parsedA = parseAmt(amount);
          if (isNaN(parsedA) || parsedA <= 0) return null;
          const rounded  = roundingRule === "5"  ? Math.ceil(parsedA / 5)  * 5
                         : roundingRule === "10" ? Math.ceil(parsedA / 10) * 10
                         :                         Math.ceil(parsedA);
          const roundAmt = parseFloat((rounded - parsedA).toFixed(2));
          if (roundAmt < 0.01) return null;
          const cag = cagnottes.find(c => c.id === roundingCagnotteId);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(104,212,152,.08)", border: "1px solid rgba(104,212,152,.2)", borderRadius: 9, marginTop: 6 }}>
              <span style={{ fontSize: ".95rem" }}>🐷</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: ".65rem", fontWeight: 700, color: "var(--success)" }}>
                  +{String(roundAmt.toFixed(2)).replace(".", ",")} € → {cag?.icon} {cag?.name}
                </div>
                <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 1 }}>Arrondi automatique activé</div>
              </div>
              <div style={{ fontSize: ".6rem", color: "var(--text3)", fontFamily: "var(--mono)" }}>
                {String(parsedA.toFixed(2)).replace(".", ",")} → {String(rounded.toFixed(2)).replace(".", ",")}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Récurrence ── */}
      {!isCag && !isAdj && !editingId && (
        <div style={{ marginBottom: 10 }}>
          <div
            onClick={() => setIsRecurring(r => !r)}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
              background: isRecurring ? "var(--accent-glow)" : "var(--surface2)",
              border: `1px solid ${isRecurring ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "var(--radius-sm)", cursor: "pointer",
            }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: isRecurring ? "var(--accent)" : "transparent",
              border: `2px solid ${isRecurring ? "var(--accent)" : "var(--border)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: ".7rem", color: "var(--bg)", flexShrink: 0, transition: "all .15s",
            }}>{isRecurring ? "✓" : ""}</div>
            <div>
              <div style={{ fontSize: ".72rem", fontWeight: 700, color: isRecurring ? "var(--accent)" : "var(--text2)" }}>
                🔄 Récurrente
              </div>
              <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 1 }}>
                Mémorise cette opération pour la retrouver chaque mois
              </div>
            </div>
          </div>
          {isRecurring && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[["monthly", "Mensuelle"], ["yearly", "Annuelle"]].map(([k, l]) => (
                  <button key={k} onClick={() => setFrequency(k)} style={{
                    flex: 1, background: frequency === k ? "var(--accent-glow)" : "transparent",
                    border: `1px solid ${frequency === k ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 8, padding: "6px 0", fontSize: ".68rem", fontWeight: 700,
                    color: frequency === k ? "var(--accent)" : "var(--text2)", cursor: "pointer",
                  }}>{l}</button>
                ))}
              </div>
              {frequency === "monthly" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--surface2)", borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: ".65rem", fontWeight: 700, color: "var(--text2)", marginBottom: 2 }}>Nombre de fois</div>
                    <div style={{ fontSize: ".58rem", color: "var(--text3)" }}>Laisser vide = illimité</div>
                  </div>
                  <input
                    type="number" min="2" max="120" placeholder="∞"
                    value={occurrences} onChange={e => setOccurrences(e.target.value)}
                    style={{
                      width: 64, background: "var(--bg)", border: `1px solid ${occurrences ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: 7, padding: "6px 8px", color: "var(--text)",
                      fontSize: ".85rem", fontFamily: "var(--mono)", textAlign: "center",
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Alerte doublon ── */}
      {dupWarning && (
        <div style={{ background: "rgba(200,184,96,.1)", border: "1.5px solid rgba(200,184,96,.4)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: "1rem" }}>⚠️</span>
            <div>
              <div style={{ fontSize: ".72rem", fontWeight: 800, color: "var(--warning)" }}>Transaction similaire détectée</div>
              <div style={{ fontSize: ".6rem", color: "var(--text2)", marginTop: 2 }}>
                {dupWarning.catName} · {fmt(dupWarning.tx.amount)} · {dupWarning.tx.date}
              </div>
            </div>
          </div>
          <div style={{ fontSize: ".65rem", color: "var(--text2)", marginBottom: 10, lineHeight: 1.5 }}>
            Une transaction identique existe déjà dans les 7 derniers jours. S'agit-il d'un doublon ?
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <button className="btn btn-outline" style={{ width: "100%" }} onClick={() => setDupWarning(null)}>✕ Annuler</button>
            <button className="btn btn-primary" style={{ width: "100%", background: "var(--warning)", color: "#060810" }} onClick={() => handleSave(true)}>
              ✓ Ajouter quand même
            </button>
          </div>
        </div>
      )}

      {/* ── Boutons Annuler / Valider ── */}
      {!dupWarning && (
        <div className="grid-2" style={{ marginBottom: 0 }}>
          <button className="btn btn-outline" style={{ width: "100%" }} onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            onClick={() => handleSave()}>
            <span>{saveEmoji}</span>
            <span>{saveLabel}</span>
          </button>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Fixed expense modal
// ─────────────────────────────────────────────────────────────────
export function FixedModal({ categories, fixedExpenses, editingIdx, onSave, onClose }) {
  const toast  = useToast();
  const f      = editingIdx != null ? fixedExpenses[editingIdx] : null;
  const expCats = categories.filter(c => c.type === "expense");

  const [name,     setName]     = useState(f?.name       || "");
  const [amt,      setAmt]      = useState(f?.amount      || "");
  const [catId,    setCatId]    = useState(f?.categoryId  || expCats[0]?.id || "");
  const [startYM,  setStartYM]  = useState(f?.startYM    || "");
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!name.trim())                               e.name = "Nom requis";
    const a = parseAmt(amt);
    if (!amt || isNaN(a) || a <= 0)                 e.amt  = "Montant requis et doit être > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ idx: editingIdx, fixed: {
      name: name.trim(),
      amount: parseAmt(amt),
      categoryId: catId,
      startYM: startYM || null,
    }});
    toast(editingIdx != null ? "Frais fixe modifié" : "Frais fixe ajouté");
  }

  return (
    <Modal onClose={onClose} title={editingIdx != null ? "Modifier le frais fixe" : "Nouveau frais fixe"}>
      <Field label="Nom" error={errors.name}>
        <input type="text" value={name} className={errors.name ? "error" : ""}
          onChange={e => { setName(e.target.value); setErrors(v => ({...v, name: ""})); }} />
      </Field>
      <Field label="Montant (€)" error={errors.amt}>
        <input type="number" step="0.01" min="0" value={amt} className={errors.amt ? "error" : ""}
          onChange={e => { setAmt(e.target.value); setErrors(v => ({...v, amt: ""})); }} />
      </Field>
      <Field label="Catégorie">
        <select value={catId} onChange={e => setCatId(e.target.value)}>
          {expCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </Field>
      {/* ★ Champ startYM — date de début optionnelle */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <label style={{ fontSize: ".72rem", color: "var(--text2)", fontWeight: 600 }}>
            📅 Début (optionnel)
          </label>
          <span style={{ fontSize: ".6rem", color: "var(--text3)" }}>
            — mois à partir duquel ce frais est déduit
          </span>
        </div>
        {startYM
          ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="month" value={startYM} onChange={e => setStartYM(e.target.value)}
                style={{ flex: 1 }} />
              <button className="btn btn-outline" style={{ padding: "6px 10px", fontSize: ".65rem" }}
                onClick={() => setStartYM("")}>
                ✕ Retirer
              </button>
            </div>
          )
          : (
            <button className="btn btn-outline" style={{ width: "100%", fontSize: ".68rem", color: "var(--text2)" }}
              onClick={() => setStartYM(currentYM())}>
              ＋ Définir une date de début
            </button>
          )
        }
        {startYM && (
          <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 4, lineHeight: 1.5 }}>
            Ce frais ne sera pas déduit avant {startYM}. Utile si tu l'as souscrit en cours d'année.
          </div>
        )}
      </div>
      <div className="grid-2" style={{ marginBottom: 0 }}>
        <button className="btn btn-outline"  style={{ width: "100%" }} onClick={onClose}>Annuler</button>
        <button className="btn btn-primary"  style={{ width: "100%" }} onClick={handleSave}>Valider</button>
      </div>
    </Modal>
  );
}


// ─────────────────────────────────────────────────────────────────
//  Fixed income modal
// ─────────────────────────────────────────────────────────────────
export function FixedIncomeModal({ categories, fixedIncomes, editingIdx, onSave, onClose }) {
  const toast   = useToast();
  const f       = editingIdx != null ? fixedIncomes[editingIdx] : null;
  const incCats = categories.filter(c => c.type === "income");
  const fallbackCat = incCats[0]?.id || "";

  const [name,     setName]     = useState(f?.name       || "");
  const [amt,      setAmt]      = useState(f?.amount      || "");
  const [catId,    setCatId]    = useState(f?.categoryId  || fallbackCat);
  const [startYM,  setStartYM]  = useState(f?.startYM    || "");
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!name.trim())                              e.name = "Nom requis";
    const a = parseAmt(amt);
    if (!amt || isNaN(a) || a <= 0)                e.amt  = "Montant requis et doit être > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ idx: editingIdx, income: {
      name: name.trim(),
      amount: parseAmt(amt),
      categoryId: catId,
      startYM: startYM || null,
    }});
    toast(editingIdx != null ? "Revenu fixe modifié" : "Revenu fixe ajouté");
  }

  return (
    <Modal onClose={onClose} title={editingIdx != null ? "Modifier le revenu fixe" : "Nouveau revenu fixe"}>
      <Field label="Nom" error={errors.name}>
        <input type="text" value={name} className={errors.name ? "error" : ""}
          onChange={e => { setName(e.target.value); setErrors(v => ({...v, name: ""})); }} />
      </Field>
      <Field label="Montant (€)" error={errors.amt}>
        <input type="number" step="0.01" min="0" value={amt} className={errors.amt ? "error" : ""}
          onChange={e => { setAmt(e.target.value); setErrors(v => ({...v, amt: ""})); }} />
      </Field>
      <Field label="Catégorie">
        <select value={catId} onChange={e => setCatId(e.target.value)}>
          <option value="">— Sans catégorie —</option>
          {incCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </Field>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <label style={{ fontSize: ".72rem", color: "var(--text2)", fontWeight: 600 }}>📅 Début (optionnel)</label>
          <span style={{ fontSize: ".6rem", color: "var(--text3)" }}>— mois à partir duquel ce revenu s'applique</span>
        </div>
        {startYM
          ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="month" value={startYM} onChange={e => setStartYM(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-outline" style={{ padding: "6px 10px", fontSize: ".65rem" }} onClick={() => setStartYM("")}>✕ Retirer</button>
            </div>
          )
          : (
            <button className="btn btn-outline" style={{ width: "100%", fontSize: ".68rem", color: "var(--text2)" }}
              onClick={() => setStartYM(currentYM())}>
              ＋ Définir une date de début
            </button>
          )
        }
      </div>
      <div className="grid-2" style={{ marginBottom: 0 }}>
        <button className="btn btn-outline" style={{ width: "100%" }} onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" style={{ width: "100%", background: "var(--success)" }} onClick={handleSave}>Valider</button>
      </div>
    </Modal>
  );
}
// ─────────────────────────────────────────────────────────────────
//  Cagnotte modal
// ─────────────────────────────────────────────────────────────────

const CAG_TYPES = [
  { id:"projet",         icon:"🎯", label:"Projet",          color:"var(--accent)"   },
  { id:"urgence",        icon:"🛡️", label:"Urgence",         color:"var(--danger)"   },
  { id:"plaisir",        icon:"✈️", label:"Plaisir",         color:"var(--purple)"   },
  { id:"investissement", icon:"📈", label:"Investissement",  color:"var(--success)"  },
];
export function CagModal({ cagnottes, editingId, onSave, onClose }) {
  const toast = useToast();
  const c     = editingId ? cagnottes.find(x => x.id === editingId) : null;

  const [name,       setName]       = useState(c?.name       || "");
  const [target,     setTarget]     = useState(c?.target      || "");
  const [targetDate, setTargetDate] = useState(c?.targetDate  || "");
  const [current,    setCurrent]    = useState(c?.current     ?? 0);
  const [cagType,    setCagType]    = useState(c?.cagType     || null);
  const [errors,     setErrors]     = useState({});

  const calcInfo = (() => {
    const t = parseAmt(target), cur = parseAmt(current) || 0;
    if (!t || !targetDate) return null;
    const rem = t - cur;
    const today = new Date(), tgt = new Date(targetDate);
    const months = Math.max(1,
      (tgt.getFullYear() - today.getFullYear()) * 12 + (tgt.getMonth() - today.getMonth())
    );
    return rem > 0
      ? `📅 Objectif le ${tgt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} — à épargner : ${fmt(rem / months)}/mois pendant ${months} mois`
      : "🎉 Objectif déjà atteint !";
  })();

  function validate() {
    const e = {};
    if (!name.trim()) e.name = "Nom requis";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id: editingId || null,
      name: name.trim(),
      target: parseAmt(target) || null,
      targetDate: targetDate || null,
      current: parseAmt(current) || 0,
      cagType: cagType || null,
    });
    toast(editingId ? "Cagnotte modifiée" : "Cagnotte créée");
  }

  return (
    <Modal onClose={onClose} title={editingId ? "Modifier la cagnotte" : "Nouvelle cagnotte"}>
      <Field label="Nom" error={errors.name}>
        <input type="text" value={name} className={errors.name ? "error" : ""}
          onChange={e => { setName(e.target.value); setErrors(v => ({...v, name: ""})); }} />
      </Field>
      <Field label="Objectif (€) — Optionnel">
        <input type="number" min="0" value={target} onChange={e => setTarget(e.target.value)} />
      </Field>
      <Field label="Date objectif — Optionnel">
        <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
      </Field>
      <Field label="Montant actuel (€)">
        <input type="number" step="0.01" min="0" value={current} onChange={e => setCurrent(e.target.value)} />
      </Field>
      {calcInfo && <div className="cag-target-info" style={{ marginBottom: 14 }}>{calcInfo}</div>}
      {/* ★ Type de cagnotte */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: ".72rem", color: "var(--text2)", fontWeight: 600, display: "block", marginBottom: 8 }}>
          Type (optionnel)
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {CAG_TYPES.map(t => (
            <button key={t.id}
              onClick={() => setCagType(cagType === t.id ? null : t.id)}
              style={{
                padding: "7px 10px", borderRadius: 9, cursor: "pointer",
                border: `1.5px solid ${cagType === t.id ? t.color : "var(--border)"}`,
                background: cagType === t.id ? `color-mix(in srgb, ${t.color} 14%, var(--surface2))` : "var(--surface2)",
                display: "flex", alignItems: "center", gap: 7,
                touchAction: "manipulation",
              }}>
              <span style={{ fontSize: ".9rem" }}>{t.icon}</span>
              <span style={{ fontSize: ".65rem", fontWeight: cagType === t.id ? 700 : 400, color: cagType === t.id ? t.color : "var(--text2)" }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid-2" style={{ marginBottom: 0 }}>
        <button className="btn btn-outline" style={{ width: "100%" }} onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleSave}>Enregistrer</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Transfer modal
// ─────────────────────────────────────────────────────────────────
export function TransferModal({ cagnottes, onSave, onClose }) {
  const toast  = useToast();
  const [mode,   setMode]  = useState("transfer"); // "transfer" | "withdraw"
  const [amt,    setAmt]   = useState("");
  const [fromId, setFrom]  = useState(cagnottes[0]?.id || "");
  const [toId,   setTo]    = useState(cagnottes[1]?.id || cagnottes[0]?.id || "");
  const [reason, setReason]= useState("");
  const [errors, setErrors] = useState({});

  const isWithdraw = mode === "withdraw";

  function validate() {
    const e = {};
    const a = parseAmt(amt);
    if (!amt || isNaN(a) || a <= 0) e.amt = "Montant requis et doit être > 0";
    if (!isWithdraw && fromId === toId) e.from = "Source et destination identiques";
    if (!e.amt) {
      const from = cagnottes.find(c => c.id === fromId);
      if (from && from.current < a) e.amt = `Fonds insuffisants (${fmt(from.current)} disponible)`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ amt: parseAmt(amt), fromId, toId: isWithdraw ? "__account__" : toId, reason: reason.trim() || null });
    toast(isWithdraw ? "Retrait effectué" : "Transfert effectué");
  }

  return (
    <Modal onClose={onClose} title={isWithdraw ? "Retrait vers le compte" : "Transfert entre cagnottes"}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:16 }}>
        {[["transfer","↔ Entre cagnottes"],["withdraw","↑ Vers le compte"]].map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setErrors({}); }} style={{
            padding:"8px 6px", borderRadius:9, border:`1px solid ${mode===m ? "var(--accent)" : "var(--border)"}`,
            background: mode===m ? "var(--accent-glow)" : "var(--surface2)",
            color: mode===m ? "var(--accent)" : "var(--text3)",
            fontSize:".65rem", fontWeight:700, cursor:"pointer",
          }}>{label}</button>
        ))}
      </div>
      <Field label="Montant (€)" error={errors.amt}>
        <input type="number" step="0.01" min="0" value={amt} className={errors.amt ? "error" : ""}
          onChange={e => { setAmt(e.target.value); setErrors(v => ({...v, amt: ""})); }} />
      </Field>
      <Field label="Retirer de…" error={errors.from}>
        <select value={fromId} className={errors.from ? "error" : ""}
          onChange={e => { setFrom(e.target.value); setErrors(v => ({...v, from: ""})); }}>
          {cagnottes.map(c => <option key={c.id} value={c.id}>{c.name} ({fmt(c.current)})</option>)}
        </select>
      </Field>
      {!isWithdraw && (
        <Field label="Ajouter à…">
          <select value={toId} onChange={e => setTo(e.target.value)}>
            {cagnottes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}
      {isWithdraw && (
        <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:9, padding:"10px 14px", fontSize:".65rem", color:"var(--text3)", marginBottom:12 }}>
          🏦 Le montant sera ajouté à votre solde bancaire estimé
        </div>
      )}
      {/* ★ Raison optionnelle */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: ".72rem", color: "var(--text2)", fontWeight: 600, display: "block", marginBottom: 6 }}>
          Raison <span style={{ fontWeight: 400, color: "var(--text3)" }}>(optionnel)</span>
        </label>
        <input type="text" value={reason} placeholder="Ex : Billet avion, remboursement…"
          onChange={e => setReason(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box" }} />
      </div>
      <div className="grid-2" style={{ marginBottom: 0 }}>
        <button className="btn btn-outline" style={{ width: "100%" }} onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleSave}>
          {isWithdraw ? "Retirer" : "Transférer"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Scheduled transaction modal
// ─────────────────────────────────────────────────────────────────
export function ScheduledModal({ categories, onSave, onClose }) {
  const toast = useToast();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,"0")}-${String(tomorrow.getDate()).padStart(2,"0")}`;

  const [amount, setAmount]   = useState("");
  const [date,   setDate]     = useState(defaultDate);
  const [catId,  setCatId]    = useState("");
  const [note,   setNote]     = useState("");
  const [errors, setErrors]   = useState({});

  const expenseCats = categories.filter(c => c.type === "expense" || !c.type);
  const today = todayISO();

  function validate() {
    const e = {};
    const a = parseAmt(amount);
    if (!amount || isNaN(a) || a <= 0) e.amount = "Montant requis";
    if (!date || date <= today)        e.date   = "La date doit être dans le futur";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ amount: parseAmt(amount), date, categoryId: catId || null, note });
    toast("Transaction programmée ajoutée");
  }

  return (
    <Modal onClose={onClose} title="📅 Transaction programmée">
      <Field label="Montant (€)" error={errors.amount}>
        <input type="number" step="0.01" min="0" value={amount}
          className={errors.amount ? "error" : ""}
          onChange={e => { setAmount(e.target.value); setErrors(v => ({...v, amount:""})); }} />
      </Field>
      <Field label="Date prévue" error={errors.date}>
        <input type="date" value={date} min={today}
          className={errors.date ? "error" : ""}
          onChange={e => { setDate(e.target.value); setErrors(v => ({...v, date:""})); }} />
      </Field>
      <Field label="Catégorie (optionnel)">
        <select value={catId} onChange={e => setCatId(e.target.value)}>
          <option value="">— Sans catégorie —</option>
          {expenseCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </Field>
      <Field label="Note (optionnel)">
        <input type="text" value={note} placeholder="Ex: Précommande Switch 2"
          onChange={e => setNote(e.target.value)} />
      </Field>
      <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:9, padding:"9px 14px", fontSize:".62rem", color:"var(--text3)", marginBottom:12 }}>
        📅 Cette dépense sera automatiquement confirmée à la date prévue et décomptée de votre solde.
      </div>
      <div className="grid-2" style={{ marginBottom:0 }}>
        <button className="btn btn-outline" style={{ width:"100%" }} onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" style={{ width:"100%" }} onClick={handleSave}>Programmer</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Category modal
// ─────────────────────────────────────────────────────────────────
export function CatModal({ editingCat, onSave, onClose }) {
  const toast  = useToast();
  const [name,   setName]   = useState(editingCat?.name || "");
  const [icon,   setIcon]   = useState(editingCat?.icon || "");
  const [type,   setType]   = useState(editingCat?.type || "expense");
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!name.trim()) e.name = "Nom requis";
    if (!icon.trim()) e.icon = "Icône requise";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ id: editingCat?.id || null, name: name.trim(), icon: icon.trim(), type });
    toast(editingCat ? "Catégorie modifiée" : "Catégorie créée");
  }

  return (
    <Modal onClose={onClose} title={editingCat ? "Modifier la catégorie" : "Nouvelle catégorie"}>
      <Field label="Nom" error={errors.name}>
        <input type="text" value={name} className={errors.name ? "error" : ""}
          onChange={e => { setName(e.target.value); setErrors(v => ({...v, name: ""})); }} />
      </Field>
      <Field label="Icône (émoji)" error={errors.icon}>
        <input type="text" maxLength={4} value={icon} className={errors.icon ? "error" : ""}
          onChange={e => { setIcon(e.target.value); setErrors(v => ({...v, icon: ""})); }} />
      </Field>
      <Field label="Type">
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="expense">Dépense</option>
          <option value="income">Revenu</option>
        </select>
      </Field>
      <div className="grid-2" style={{ marginBottom: 0 }}>
        <button className="btn btn-outline" style={{ width: "100%" }} onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleSave}>Valider</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Confirm modal
// ─────────────────────────────────────────────────────────────────
export function ConfirmModal({ title, msg, onConfirm, onClose }) {
  return (
    <Modal onClose={onClose} title="">
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "1.8rem", marginBottom: 12 }}>⚠️</div>
        <div className="modal-title" style={{ marginBottom: 8 }}>{title}</div>
        <p style={{ color: "var(--text2)", fontSize: ".82rem", marginBottom: 22, lineHeight: 1.5 }}>{msg}</p>
        <div className="grid-2" style={{ marginBottom: 0 }}>
          <button className="btn btn-outline"        style={{ width: "100%" }} onClick={onClose}>Annuler</button>
          <button className="btn btn-danger-outline" style={{ width: "100%" }}
            onClick={() => { onConfirm(); onClose(); }}>Confirmer</button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Detail drill-down modal
// ─────────────────────────────────────────────────────────────────
export function DetailModal({ config, transactions, categories, cagnottes, fixedExpenses, onClose }) {
  const { type, period } = config;
  const now     = new Date();
  const curM    = currentYM();
  const curY    = now.getFullYear().toString();
  const tf      = useTotalFixes(fixedExpenses, curM);
  const prefix  = period === "month" ? curM : period === "year" ? curY : "";

  const CFG = {
    income:      { label: "Revenus",          icon: "💰", color: "var(--success)", badge: "rgba(52,211,153,.15)"  },
    expense:     { label: "Dépenses",         icon: "💸", color: "var(--danger)",  badge: "rgba(248,113,113,.15)" },
    expense_var: { label: "Dép. hors fixes",  icon: "📉", color: "var(--warning)", badge: "rgba(251,146,60,.15)"  },
    decagnottage:{ label: "Décagnottages",    icon: "🎯", color: "var(--sapin)",   badge: "rgba(46,125,82,.18)"   },
    cagnottes:   { label: "Cagnottes",        icon: "🏦", color: "var(--khaki)",   badge: "rgba(138,173,90,.15)"  },
  };
  const cfg = CFG[type] ?? CFG.income;
  const periodLabel = period === "month" ? "Mois en cours" : period === "year" ? "Année en cours" : "Total";

  let items = [], total = 0;

  if (type === "cagnottes") {
    total = cagnottes.reduce((s, c) => s + c.current, 0);
    items = null;
  } else {
    const filtered = transactions.filter(t => {
      if (prefix && !t.date.startsWith(prefix)) return false;
      if (type === "income")        return isIncome(t.type);
      if (type === "expense")       return t.type === "expense";
      if (type === "expense_var")   return t.type === "expense";
      if (type === "decagnottage")  return t.type === "decagnottage";
      return false;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    total = filtered.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    if (type === "expense") total += tf;
    items = filtered;
  }

  return (
    <Modal onClose={onClose} title="">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", background: cfg.badge }}>
          {cfg.icon}
        </div>
        <div>
          <div style={{ fontSize: ".65rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600 }}>{periodLabel}</div>
          <div className="modal-title" style={{ marginBottom: 0 }}>{cfg.label}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: "1.4rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: cfg.color }}>{fmt(total)}</div>
        </div>
      </div>

      <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
        {type === "cagnottes" && (
          cagnottes.length === 0
            ? <div className="empty-state"><div className="empty-icon">🎯</div><p>Aucune cagnotte</p></div>
            : cagnottes.map(c => (
                <div key={c.id} className="item-row">
                  <div className="item-icon">🎯</div>
                  <div className="item-info">
                    <div className="item-title">{c.name}</div>
                    <div className="item-sub">
                      {c.target ? `${((c.current / c.target) * 100).toFixed(0)}% — objectif ${fmt(c.target)}` : "Pas d'objectif"}
                    </div>
                  </div>
                  <div className="item-amount" style={{ color: "var(--khaki)" }}>{fmt(c.current)}</div>
                </div>
              ))
        )}

        {type === "expense" && (
          <>
            {fixedExpenses.length > 0 && (
              <>
                <div style={{ fontSize: ".65rem", color: "var(--text3)", textTransform: "uppercase", fontWeight: 700, padding: "10px 0 6px", borderBottom: "1px solid var(--border-soft)" }}>
                  Frais fixes — {fmt(tf)}
                </div>
                {fixedExpenses.map((f, i) => {
                  const cat = categories.find(c => c.id === f.categoryId);
                  return (
                    <div key={i} className="item-row">
                      <div className="item-icon">{cat?.icon ?? "🔄"}</div>
                      <div className="item-info"><div className="item-title">{f.name}</div><div className="item-sub">Mensuel récurrent</div></div>
                      <div className="item-amount type-expense">−{fmt(f.amount)}</div>
                    </div>
                  );
                })}
              </>
            )}
            {items.length > 0 && (
              <div style={{ fontSize: ".65rem", color: "var(--text3)", textTransform: "uppercase", fontWeight: 700, padding: "10px 0 6px", borderBottom: "1px solid var(--border-soft)" }}>
                Dépenses variables
              </div>
            )}
            {items.map(t => <ItemRow key={t.id} t={t} categories={categories} cagnottes={cagnottes} />)}
            {items.length === 0 && <p style={{ textAlign: "center", fontSize: ".78rem", color: "var(--text3)", padding: "16px 0" }}>Aucune dépense variable</p>}
          </>
        )}

        {type !== "cagnottes" && type !== "expense" && (
          items.length === 0
            ? <div className="empty-state"><div className="empty-icon">📭</div><p>Aucune opération</p></div>
            : items.map(t => <ItemRow key={t.id} t={t} categories={categories} cagnottes={cagnottes} />)
        )}
      </div>

      <button className="btn btn-outline" style={{ width: "100%", marginTop: 16 }} onClick={onClose}>Fermer</button>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Month detail modal (from chart click)
// ─────────────────────────────────────────────────────────────────
export function MonthDetailModal({ config, transactions, categories, cagnottes, fixedExpenses, onClose }) {
  const { year, monthIdx } = config;
  const mStr  = `${year}-${(monthIdx + 1).toString().padStart(2, "0")}`;
  const tf    = useTotalFixes(fixedExpenses, mStr);
  const isCurM = mStr === currentYM();
  let inc = 0, exp = 0;
  const txs = transactions.filter(t => t.date.startsWith(mStr));
  txs.forEach(t => {
    const a = parseFloat(t.amount) || 0;
    if (isIncome(t.type)) inc += a;
    else if (t.type === "expense") exp += a;
  });
  if (isCurM) exp += tf;
  const net = inc - exp;

  return (
    <Modal onClose={onClose} title="">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", background: "rgba(77,159,255,.15)" }}>📅</div>
        <div>
          <div style={{ fontSize: ".65rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600 }}>Détail du mois</div>
          <div className="modal-title" style={{ marginBottom: 0 }}>{MONTHS_SHORT[monthIdx]} {year}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: "1.4rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: net >= 0 ? "var(--success)" : "var(--danger)" }}>
            {net >= 0 ? "+" : ""}{fmt(net)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[["Revenus", inc, "var(--success)"], ["Dépenses", exp, "var(--danger)"]].map(([l, v, c]) => (
          <div key={l} style={{
            border: `1px solid ${c}`, borderRadius: 8, padding: 10,
          }}>
            <div style={{ fontSize: ".6rem", color: "var(--text2)", textTransform: "uppercase", fontWeight: 700 }}>{l}</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: c, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</div>
          </div>
        ))}
      </div>

      <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
        {isCurM && fixedExpenses.length > 0 && (
          <>
            <div style={{ fontSize: ".65rem", color: "var(--text3)", textTransform: "uppercase", fontWeight: 700, padding: "8px 0 6px", borderBottom: "1px solid var(--border-soft)" }}>
              Frais fixes — {fmt(tf)}
            </div>
            {fixedExpenses.map((f, i) => {
              const cat = categories.find(c => c.id === f.categoryId);
              return (
                <div key={i} className="item-row">
                  <div className="item-icon">{cat?.icon ?? "🔄"}</div>
                  <div className="item-info"><div className="item-title">{f.name}</div><div className="item-sub">Mensuel récurrent</div></div>
                  <div className="item-amount type-expense">−{fmt(f.amount)}</div>
                </div>
              );
            })}
          </>
        )}
        {txs.length > 0 && (
          <>
            <div style={{ fontSize: ".65rem", color: "var(--text3)", textTransform: "uppercase", fontWeight: 700, padding: "8px 0 6px", borderBottom: "1px solid var(--border-soft)" }}>
              Opérations ({txs.length})
            </div>
            {[...txs].sort((a, b) => new Date(b.date) - new Date(a.date))
              .map(t => <ItemRow key={t.id} t={t} categories={categories} cagnottes={cagnottes} />)
            }
          </>
        )}
        {txs.length === 0 && (!isCurM || fixedExpenses.length === 0) && (
          <div className="empty-state"><div className="empty-icon">📭</div><p>Aucune opération ce mois</p></div>
        )}
      </div>
      <button className="btn btn-outline" style={{ width: "100%", marginTop: 16 }} onClick={onClose}>Fermer</button>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Cagnotte history modal
// ─────────────────────────────────────────────────────────────────
export function CagHistModal({ cagId, transactions, categories, cagnottes, onClose }) {
  const c = cagnottes.find(x => x.id === cagId);
  if (!c) return null;

  const pct = c.target ? Math.min(100, (c.current / c.target) * 100) : null;
  const txs = transactions
    .filter(t => (t.type === "epargne" || t.type === "decagnottage") && t.targetCagId === cagId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let totE = 0, totD = 0;
  txs.forEach(t => {
    if (t.type === "epargne")     totE += parseFloat(t.amount) || 0;
    else                          totD += parseFloat(t.amount) || 0;
  });

  const targetInfo = (() => {
    if (!c.target || !c.targetDate) return null;
    const rem    = c.target - c.current;
    const today  = new Date(), tgt = new Date(c.targetDate);
    const months = Math.max(1,
      (tgt.getFullYear() - today.getFullYear()) * 12 + (tgt.getMonth() - today.getMonth())
    );
    const days = Math.round((tgt - today) / (1000 * 60 * 60 * 24));
    return (
      <div className="cag-target-info" style={{ marginBottom: 12 }}>
        📅 Objectif le <strong>{tgt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</strong>
        {" "}— {days > 0 ? `${days} jours restants` : "Dépassé"}<br />
        {rem > 0
          ? <>À épargner : <strong>{fmt(rem / months)}/mois</strong> pendant {months} mois</>
          : <strong>🎉 Objectif atteint !</strong>
        }
      </div>
    );
  })();

  return (
    <Modal onClose={onClose} title="">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--display)", fontSize: "1.1rem", fontWeight: 800, marginBottom: 4 }}>🎯 {c.name}</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: "1.3rem", fontWeight: 800, color: "var(--khaki)", fontVariantNumeric: "tabular-nums" }}>{fmt(c.current)}</div>
        {c.target && <div style={{ fontSize: ".72rem", color: "var(--text2)", marginTop: 2 }}>Objectif : {fmt(c.target)}</div>}
      </div>
      {pct != null && <div className="progress-bg" style={{ height: 8, marginBottom: 8 }}><div className="progress-fill" style={{ width: `${pct}%` }} /></div>}
      {targetInfo}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[["Versements", totE, "khaki"], ["Retraits", totD, "sapin"]].map(([l, v, k]) => (
          <div key={l} style={{ background: `var(--${k}-glow)`, border: `1px solid rgba(${k === "khaki" ? "138,173,90" : "46,125,82"},.3)`, borderRadius: 8, padding: 10 }}>
            <div className="stat-label">{l}</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: `var(--${k})`, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</div>
          </div>
        ))}
      </div>

      <div style={{ maxHeight: "45vh", overflowY: "auto" }}>
        {txs.length === 0
          ? <div className="empty-state"><div className="empty-icon">📭</div><p>Aucun mouvement enregistré</p></div>
          : txs.map(t => <ItemRow key={t.id} t={t} categories={categories} cagnottes={cagnottes} />)
        }
      </div>
      <button className="btn btn-outline" style={{ width: "100%", marginTop: 16 }} onClick={onClose}>Fermer</button>
    </Modal>
  );
}
