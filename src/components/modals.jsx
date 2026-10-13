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
import { fmt, todayISO, isIncome, MONTHS_SHORT, uid, currentYM, daysAgoISO, touchMoved } from "../utils.js";
import { useToast } from "../context.js";
import { computePeriodTotals, computeMonthTotals, livedMonths, fixedLinesForPeriod, categoryBudgetFor, categorySpentForMonth } from "../hooks.js";
const MONTHS_FULL_LC = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

// ─── Helper : parse un montant saisi avec virgule ou point ────────
const parseAmt = s => parseFloat(String(s ?? "").replace(",", ".")) || 0;

// ─── Shared field-error display ──────────────────────────────────
function FieldError({ msg }) {
  if (!msg) return null;
  return <div className="field-error">⚠ {msg}</div>;
}

// ─── Section label compact (style app) ───────────────────────────
function SectionLabel({ children, color }) {
  return (
    <div style={{
      fontSize: ".6rem", fontWeight: 700, color: color || "var(--text3)",
      letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 5,
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  NumPad — clavier numérique custom (touches réduites à 43px)
// ─────────────────────────────────────────────────────────────────
function NumPad({ value, onChange, type, onTypeChange, variant, hideDisplay }) {
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
  // variant "tr" (v1.42.0) : dépense hors compte — couleur métal, sans signe
  const isTr        = variant === "tr";
  // variant "cag" (v1.45.0) : mouvement entre cagnottes — violet, sans signe
  const isCagV      = variant === "cag";
  const accentColor = isTr ? "var(--tr)" : isCagV ? "var(--purple)" : isExpense ? "var(--danger)" : "var(--success)";
  const sign        = isTr || isCagV ? "" : isExpense ? "−" : "+";

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
      {!hideDisplay && <div style={{
        background: isTr ? "var(--tr-glow)" : isCagV ? "var(--purple-glow)" : isExpense ? "rgba(200,112,112,.06)" : "rgba(104,212,152,.06)",
        border: `1px solid ${isTr ? "var(--tr-border)" : isCagV ? "rgba(176,144,224,.3)" : isExpense ? "rgba(200,112,112,.2)" : "rgba(104,212,152,.2)"}`,
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
            {sign}{displayVal} €
          </div>
          {preview && (
            <div style={{ fontSize: ".62rem", color: "var(--text3)", marginTop: 3 }}>
              = {sign}{preview}
            </div>
          )}
        </div>
        {isSimpleType && onTypeChange && !variant && (
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
      </div>}

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
                  onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); press(k); }}
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
// ─────────────────────────────────────────────────────────────────
//  Montants à part (tickets resto…) — source unique partagée par
//  TransModal ET QuickTemplateSheet (v1.40.0). Purement informatif,
//  jamais compté dans le solde.
// ─────────────────────────────────────────────────────────────────
function useSideAmounts(initial) {
  const [vals, setVals] = useState(() => {
    const init = {};
    if (initial) Object.entries(initial).forEach(([k, v]) => { init[k] = String(v); });
    return init;
  });
  const [open, setOpen] = useState(() => new Set(initial ? Object.keys(initial) : []));
  return {
    vals, open,
    openType:  id => setOpen(prev => new Set(prev).add(id)),
    setVal:    (id, v) => setVals(prev => ({ ...prev, [id]: v.replace(/[^0-9,.]/g, "") })),
    /** Objet { [typeId]: montant } prêt à enregistrer, ou undefined si vide */
    toPayload: () => {
      const out = {};
      open.forEach(k => { const v = parseAmt(vals[k]); if (!isNaN(v) && v > 0) out[k] = v; });
      return Object.keys(out).length > 0 ? out : undefined;
    },
  };
}

// ─────────────────────────────────────────────────────────────────
//  CategoryField / DateField — v1.44.3
//  Champs partagés par la saisie d'une dépense ET la saisie hors compte,
//  pour qu'ils restent identiques (même menu, mêmes couleurs, mêmes gestes).
// ─────────────────────────────────────────────────────────────────
function CategoryField({ cats, catId, onChange, accentColor = "var(--purple)", label = "Catégorie", allowNone = true, emptyLabel = "Aucune catégorie", noneLabel = "⊘ Aucune", error }) {
  const [catOpen, setCatOpen] = useState(false);
  const [drill, setDrill] = useState(null);   // v1.47.0 : catégorie principale dont on affiche les sous-catégories
  const catTouchRef = useRef({ startY: 0, startX: 0, moved: false });
  // Sous-catégories (v1.47.0) : la grille montre les catégories principales ;
  // celles qui ont des sous-catégories portent un ▸ et s'ouvrent au tap.
  const isTop    = c => !c.parentId || !cats.some(p => p.id === c.parentId);
  const kidsOf   = id => cats.filter(c => c.parentId === id);
  const drillCat = drill ? cats.find(c => c.id === drill) : null;
  const shown    = drillCat ? kidsOf(drillCat.id) : cats.filter(isTop);
  return (
    <div style={{ marginBottom: 10 }}>
          <SectionLabel color="var(--purple)">{label}</SectionLabel>
          {error && <FieldError msg={error} />}

          {/* Trigger */}
          <button
            onTouchStart={e => e.stopPropagation()}
            onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); setDrill(null); setCatOpen(o => !o); }}
            onClick={() => { if (!('ontouchstart' in window)) { setDrill(null); setCatOpen(o => !o); } }}
            style={{
              width: "100%", padding: "9px 12px", boxSizing: "border-box",
              background: catId ? "rgba(176,144,224,.1)" : "rgba(176,144,224,.05)",
              border: "1px solid rgba(176,144,224,.3)", borderLeft: "3px solid var(--purple)",
              borderRadius: 10,
              color: catId ? "var(--text)" : "var(--text3)",
              fontSize: ".78rem", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 8,
              cursor: "pointer", touchAction: "manipulation",
            }}>
            {(() => {
              const cat = cats.find(c => c.id === catId);
              const par = cat?.parentId ? cats.find(p => p.id === cat.parentId) : null;
              if (cat && par) return <><span style={{ fontSize: "1rem" }}>{par.icon}</span><span style={{ color: "var(--text2)" }}>{par.name}</span><span style={{ color: "var(--text3)" }}>›</span><span style={{ fontSize: "1rem" }}>{cat.icon}</span><span style={{ flex: 1, textAlign: "left" }}>{cat.name}</span></>;
              return cat
                ? <><span style={{ fontSize: "1rem" }}>{cat.icon}</span><span style={{ flex: 1, textAlign: "left" }}>{cat.name}{cat.sub && <span style={{ color: "var(--text3)", marginLeft: 6 }}>({cat.sub})</span>}</span></>
                : <span style={{ flex: 1, textAlign: "left", color: "var(--text3)" }}>{emptyLabel}</span>;
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
                onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); document.activeElement?.blur(); setCatOpen(false); }}
                onClick={() => { document.activeElement?.blur(); setCatOpen(false); }}
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
                    {drillCat
                      ? <><span onClick={() => setDrill(null)} onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); setDrill(null); }}
                          style={{ color: "var(--accent)", cursor: "pointer" }}>‹ {label}</span> › {drillCat.icon} {drillCat.name}</>
                      : label}
                  </span>
                  <button
                    onTouchStart={e => e.stopPropagation()}
                    onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); document.activeElement?.blur(); setCatOpen(false); }}
                    onClick={() => { if (!('ontouchstart' in window)) { document.activeElement?.blur(); setCatOpen(false); } }}
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
                  {drillCat && (
                    <button
                      onTouchStart={e => { e.stopPropagation(); catTouchRef.current = { startY: e.touches[0].clientY, startX: e.touches[0].clientX, moved: false }; }}
                      onTouchMove={e => { const dy = Math.abs(e.touches[0].clientY - catTouchRef.current.startY); const dx = Math.abs(e.touches[0].clientX - catTouchRef.current.startX); if (dy > 6 || dx > 6) catTouchRef.current.moved = true; }}
                      onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); if (!catTouchRef.current.moved) { document.activeElement?.blur(); onChange(drillCat.id); setCatOpen(false); } }}
                      onClick={() => { if (!('ontouchstart' in window)) { document.activeElement?.blur(); onChange(drillCat.id); setCatOpen(false); } }}
                      style={{
                        gridColumn: "1 / -1", padding: "8px 10px", borderRadius: 9,
                        border: `1.5px solid ${catId === drillCat.id ? accentColor : "var(--border)"}`,
                        background: catId === drillCat.id ? `color-mix(in srgb, ${accentColor} 14%, var(--surface2))` : "var(--surface2)",
                        color: catId === drillCat.id ? accentColor : "var(--text2)",
                        fontSize: ".7rem", fontWeight: 700, cursor: "pointer", touchAction: "pan-y",
                      }}>{drillCat.icon} Toute la catégorie « {drillCat.name} »</button>
                  )}
                  {allowNone && !drillCat && <button
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
                      if (!catTouchRef.current.moved) { document.activeElement?.blur(); onChange(""); setCatOpen(false); }
                    }}
                    onClick={() => { if (!('ontouchstart' in window)) { document.activeElement?.blur(); onChange(""); setCatOpen(false); } }}
                    style={{
                      gridColumn: "1 / -1", padding: "7px 10px", borderRadius: 9,
                      border: `1px solid ${!catId ? accentColor : "var(--border)"}`,
                      background: !catId ? `color-mix(in srgb, ${accentColor} 14%, var(--surface2))` : "var(--surface2)",
                      color: !catId ? accentColor : "var(--text3)",
                      fontSize: ".68rem", fontWeight: 700, cursor: "pointer", touchAction: "pan-y",
                    }}>{noneLabel}</button>}

                  {shown.map(c => { const hasKids = !drillCat && kidsOf(c.id).length > 0;
                    const selHere = catId === c.id || (hasKids && kidsOf(c.id).some(k => k.id === catId));
                    const pick = () => { if (hasKids) { setDrill(c.id); return; } document.activeElement?.blur(); onChange(c.id); setCatOpen(false); };
                    return (
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
                        if (!catTouchRef.current.moved) pick();
                      }}
                      onClick={() => { if (!('ontouchstart' in window)) pick(); }}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        padding: "8px 4px", gap: 4, borderRadius: 10,
                        border: `1.5px solid ${selHere ? accentColor : "var(--border)"}`,
                        background: selHere ? `color-mix(in srgb, ${accentColor} 14%, var(--surface2))` : "var(--surface2)",
                        cursor: "pointer", touchAction: "pan-y", position: "relative",
                      }}>
                      {hasKids && <span style={{ position: "absolute", top: 3, right: 5, fontSize: ".55rem", fontWeight: 800, color: accentColor }}>▸</span>}
                      <span style={{ fontSize: "1.2rem" }}>{c.icon}</span>
                      <span style={{
                        fontSize: ".55rem", lineHeight: 1.2, textAlign: "center",
                        color: selHere ? accentColor : "var(--text3)",
                        fontWeight: selHere ? 700 : 400,
                        maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{c.name}</span>
                      {c.sub && <span style={{ fontSize: ".5rem", color: "var(--text3)", whiteSpace: "nowrap" }}>{c.sub}</span>}
                    </button>
                  ); })}
                </div>
              </div>
            </>
          )}
        </div>
  );
}

function DateField({ date, onChange, error, label = "Date", shortcuts, min }) {
  const todayStr     = todayISO();
  const yesterdayStr = daysAgoISO(1);
  const beforeStr    = daysAgoISO(2);
  const SC = shortcuts || [["Aujourd'hui", todayStr], ["Hier", yesterdayStr], ["Avant-hier", beforeStr]];
  const dateIsShortcut = SC.some(([, d]) => d === date);
  const [customDate, setCustomDate] = useState(false);
  const dateInputRef = useRef(null);
  const openCalendar = () => {
    setCustomDate(true);
    // Ouvre directement le calendrier d'Android ; si le navigateur refuse,
    // le champ date reste affiché et un tap dessus l'ouvre.
    setTimeout(() => { try { dateInputRef.current?.showPicker?.(); } catch { dateInputRef.current?.focus(); } }, 60);
  };
  const errors = { date: error };
  const setDate = onChange;
  const setErrors = () => {};
  return (
      <div style={{ marginBottom: 10 }}>
        <SectionLabel color="var(--accent)">{label}</SectionLabel>
        {errors.date && <FieldError msg={errors.date} />}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, padding: 5, borderRadius: 12,
          background: "rgba(112,184,224,.05)", border: "1px solid rgba(112,184,224,.22)", borderLeft: "3px solid var(--accent)" }}>
          {[...SC, ["Autre…", null]].map(([label, d]) => {
            const custom = customDate || !dateIsShortcut;
            const sel = d !== null ? date === d && !custom : custom;
            const pick = () => {
              if (d !== null) { setDate(d); setCustomDate(false); setErrors(v => ({ ...v, date: "" })); }
              else openCalendar();
            };
            const shown = d === null && !dateIsShortcut ? `📅 ${date.slice(8)}/${date.slice(5, 7)}` : label;
            return (
              <button key={label}
                onTouchStart={e => e.stopPropagation()}
                onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); pick(); }}
                onClick={() => { if (!('ontouchstart' in window)) pick(); }}
                style={{
                  padding: "6px 2px", borderRadius: 20, fontSize: ".65rem",
                  border: `1.5px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                  background: sel ? "rgba(112,184,224,.14)" : "var(--surface2)",
                  color: sel ? "var(--accent)" : "var(--text2)",
                  fontWeight: sel ? 700 : 400, cursor: "pointer", touchAction: "manipulation",
                }}>{shown}</button>
            );
          })}
        </div>
        {/* Champ date natif affiché uniquement si "Autre…" sélectionné */}
        {(customDate || !dateIsShortcut) && (
          <input type="date" value={date} ref={dateInputRef} max="2100-12-31" min={min}
            className={errors.date ? "error" : ""}
            onChange={e => { if (e.target.value) { setDate(e.target.value); setErrors(v => ({ ...v, date: "" })); } }}
            style={{ marginTop: 6, width: "100%", boxSizing: "border-box" }}
          />
        )}
      </div>
  );
}

export function TransModal({
  transactions, categories, cagnottes, tags = [], sideAmountTypes = [],
  roundingEnabled = false, roundingCagnotteId = null, roundingRule = "ceil",
  editingId, defaultType = "expense",
  reimbursements = [],
  categoryThresholds = {}, fixedExpenses = [],
  onSave, onSaveRecurring, onClose,
}) {
  const toast = useToast();
  // v1.44.0 : options (montants à part, chèque, tags, récurrence) dans un menu déroulant
  const [optOpen, setOptOpen] = useState(false);
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
  const side = useSideAmounts(tx?.sideAmounts);
  // Chèque (v1.43.0) — dépense normale, simplement identifiée pour être suivie
  const [isCheque,  setIsCheque]  = useState(tx?.paymentMethod === "cheque");
  const [chequeNum, setChequeNum] = useState(tx?.chequeNumber || "");
  const [adjSign,     setAdjSign]     = useState(tx?.adjSign || "+");
  const [errors,      setErrors]      = useState({});
  const [dupWarning,  setDupWarning]  = useState(null);
  // v1.48.0 : « Sera remboursé » (dépense) et rapprochement d'un revenu
  const reimbOf = editingId ? reimbursements.find(r => r.txId === editingId && r.status !== "received") : null;
  const [reimbOn,   setReimbOn]   = useState(!!reimbOf);
  const [reimbMode, setReimbMode] = useState(reimbOf ? "custom" : "all");   // all | half | custom
  const [reimbAmt,  setReimbAmt]  = useState(reimbOf ? String(reimbOf.amount).replace(".", ",") : "");
  const [reimbFrom, setReimbFrom] = useState(reimbOf?.from || "");
  const [reimbDate, setReimbDate] = useState(reimbOf?.expectedDate || "");
  const [linkReimbId, setLinkReimbId] = useState(null);
  const [dismissReimb, setDismissReimb] = useState([]);

  const isCag = type === "epargne" || type === "decagnottage";
  const isInc = type === "income";
  const cats  = categories.filter(c => isInc ? c.type === "income" : c.type === "expense");

  // Couleur accentuée selon le type
  const isAdj = type === "balance_adjustment";
  const accentColor = isAdj ? "var(--sapin)" : isInc ? "var(--success)" : isCag ? "var(--purple)" : "var(--danger)";


  // Revenu qui ressemble à un remboursement attendu (± 1 € ou nom dans la note)
  const reimbCandidate = (() => {
    if (type !== "income" || editingId || linkReimbId) return null;
    const a = amountOf(amount), n = (note || "").toLowerCase();
    return reimbursements.filter(r => r.status !== "received" && !dismissReimb.includes(r.id)).find(r =>
      (!isNaN(a) && a > 0 && Math.abs((parseFloat(r.amount) || 0) - a) <= 1) ||
      (r.from && r.from.length >= 3 && n.includes(r.from.toLowerCase()))) || null;
  })();
  const linkedReimb = linkReimbId ? reimbursements.find(r => r.id === linkReimbId) : null;
  const reimbValue = (() => {
    const a = amountOf(amount);
    if (reimbMode === "all") return isNaN(a) ? 0 : a;
    if (reimbMode === "half") return isNaN(a) ? 0 : Math.round(a * 50) / 100;
    const v = amountOf(reimbAmt); return isNaN(v) ? 0 : v;
  })();

  function findDuplicate(amt, catId, txDate, txType) {
    if (!amt || editingId) return null;
    const d = new Date(txDate + "T12:00:00");
    return transactions.find(t => {
      if (t.type !== txType) return false;
      if (Math.abs((parseFloat(t.amount)||0) - amountOf(amt)) > 0.01) return false;
      if (t.categoryId !== catId) return false;
      const td = new Date(t.date + "T12:00:00");
      return Math.abs((d - td) / 86400000) <= 7;
    }) || null;
  }

  function validate() {
    const e = {};
    const a = amountOf(amount);
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
    const parsedAmt = amountOf(amount);
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
    const sideAmounts = type === "expense" ? side.toPayload() : undefined;
    const cheque = type === "expense" && isCheque;
    onSave({ id: editingId || null, type, amount: parsedAmt, date, categoryId: catId, targetCagId: cagId, note, tagIds: tagIds.length > 0 ? tagIds : undefined, templateId: editingId ? tx?.templateId : recurringId, adjSign: isAdj ? adjSign : undefined, sideAmounts,
      // Chèque encaissé : sa date est celle de l'encaissement, la date d'émission est conservée à part
      paymentMethod: cheque ? "cheque" : undefined,
      chequeNumber:  cheque && chequeNum.trim() ? chequeNum.trim() : undefined,
      issuedDate:    cheque ? (tx?.pointed ? (tx.issuedDate || tx.date) : date) : undefined,
    }, {
      // v1.48.0 : remboursement attendu lié à cette dépense / revenu qui solde un remboursement
      reimbursement: type === "expense" && reimbOn && reimbValue > 0
        ? { id: reimbOf?.id, amount: reimbValue, from: reimbFrom.trim(), expectedDate: reimbDate || null, note: note || (categories.find(c => c.id === catId)?.name) || "" }
        : (reimbOf && (!reimbOn || type !== "expense") ? { id: reimbOf.id, remove: true } : undefined),
      receiveReimbursementId: type === "income" && linkReimbId ? linkReimbId : undefined,
    });
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
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
              onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); setType(k); setErrors({}); setCatId(""); }}
              onClick={() => { setType(k); setErrors({}); setCatId(""); }}
              style={{
                padding: "7px 2px 6px",
                borderRadius: "var(--radius)",
                border: `1.5px solid ${sel ? c : "var(--border)"}`,
                background: sel ? `color-mix(in srgb, ${c} 14%, var(--surface2))` : "var(--surface2)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                cursor: "pointer", touchAction: "manipulation",
              }}>
              <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{emoji}</span>
              <span style={{ fontSize: ".6rem", fontWeight: 700, color: sel ? c : "var(--text3)", whiteSpace: "nowrap" }}>{label}</span>
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
              onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); setType(k); setErrors({}); }}
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
          <div style={{ fontSize: ".62rem", color: "var(--text3)", lineHeight: 1.5, marginBottom: 9 }}>
            Corrige un écart avec ton relevé bancaire. Ajuste le solde pointé, et donc aussi le solde estimé.
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setAdjSign("+")} style={{
              flex: 1, padding: "7px", borderRadius: 9, fontSize: ".68rem", fontWeight: 800, cursor: "pointer",
              background: adjSign === "+" ? "rgba(104,212,152,.15)" : "var(--surface2)",
              border: `1.5px solid ${adjSign === "+" ? "var(--success)" : "var(--border-soft)"}`,
              color: adjSign === "+" ? "var(--success)" : "var(--text2)",
            }}>➕ Ajouter</button>
            <button onClick={() => setAdjSign("-")} style={{
              flex: 1, padding: "7px", borderRadius: 9, fontSize: ".68rem", fontWeight: 800, cursor: "pointer",
              background: adjSign === "-" ? "rgba(200,112,112,.15)" : "var(--surface2)",
              border: `1.5px solid ${adjSign === "-" ? "var(--danger)" : "var(--border-soft)"}`,
              color: adjSign === "-" ? "var(--danger)" : "var(--text2)",
            }}>➖ Soustraire</button>
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

      {/* ── Catégorie : menu déroulant partagé (v1.44.3, aussi utilisé hors compte) ── */}
      {!isCag && !isAdj && <CategoryField cats={cats} catId={catId} onChange={setCatId} accentColor={accentColor} />}

      {/* ── 🎯 Budget de la catégorie (v1.50.0) — informatif, ne bloque rien ── */}
      {type === "expense" && catId && (() => {
        const bud = categoryBudgetFor(categories, categoryThresholds, catId);
        if (!bud) return null;
        const ym = (date || todayISO()).slice(0, 7);
        const before = categorySpentForMonth(categories, transactions, fixedExpenses, bud.catId, ym, editingId || null);
        const cur = Math.max(0, amountOf(amount) || 0);
        const after = before + cur, pct = Math.round(after / bud.limit * 100);
        const over = after > bud.limit + 0.004, warn = !over && pct >= 80;
        const col = over ? "var(--danger)" : warn ? "var(--warning)" : "var(--success)";
        const bg  = over ? "rgba(200,112,112,.08)" : warn ? "rgba(200,184,96,.08)" : "rgba(104,212,152,.06)";
        const bCat = categories.find(c => c.id === bud.catId);
        const [y, m] = ym.split("-").map(Number);
        const isCurM = ym === currentYM();
        const daysLeft = isCurM ? new Date(y, m, 0).getDate() - new Date().getDate() + 1 : null;
        const wB = Math.min(100, before / bud.limit * 100), wA = Math.min(100, after / bud.limit * 100);
        return (
          <div style={{ borderRadius: 11, padding: "8px 11px", margin: "-4px 0 10px", fontSize: ".68rem", background: bg, border: `1px solid ${col}55` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ flex: 1, minWidth: 0, color: "var(--text2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🎯 Budget {bCat?.name || ""} · {MONTHS_FULL_LC[m - 1]}</span>
              <b style={{ color: col, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(after)} / {fmt(bud.limit)}</b>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: "var(--surface3)", overflow: "hidden", marginTop: 6, position: "relative" }}>
              <div style={{ width: `${wA}%`, height: "100%", borderRadius: 4, background: col }} />
              {wA > wB && <div style={{ position: "absolute", top: 0, bottom: 0, left: `${wB}%`, width: `${wA - wB}%`, background: "repeating-linear-gradient(45deg,rgba(255,255,255,.55) 0 3px,transparent 3px 6px)" }} />}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: ".6rem", color: "var(--text2)" }}>
              <span>{over ? <>⚠️ Dépassé de <b style={{ color: col }}>{fmt(after - bud.limit)}</b>{cur > 0 ? " avec cette dépense" : ""}</>
                : <>Reste <b style={{ color: "var(--text)" }}>{fmt(bud.limit - after)}</b> pour finir le mois{warn && daysLeft ? ` (${daysLeft} jour${daysLeft > 1 ? "s" : ""})` : ""}</>}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{pct} %</span>
            </div>
          </div>
        );
      })()}

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
                  onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); setCagId(c.id); setErrors(v => ({ ...v, cag: "" })); }}
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

      {/* ── Date : boutons + « Autre… » → calendrier (composant partagé, v1.44.3) ── */}
      <DateField date={date} error={errors.date}
        onChange={d => { setDate(d); setErrors(v => ({ ...v, date: "" })); }} />

      {/* ── Note ── */}
      <div style={{ marginBottom: 10 }}>
        <input type="text" placeholder={isAdj ? "Ex: Écart bancaire, arrondi…" : "Note (optionnel)…"} value={note}
          onChange={e => setNote(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", borderLeft: "3px solid #8a98a8", background: "rgba(255,255,255,.03)" }}
        />

        {/* Preview arrondi automatique */}
        {roundingEnabled && type === "expense" && roundingCagnotteId && (() => {
          const parsedA = amountOf(amount);
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

      {/* ── Options (v1.44.0) : un menu déroulant qui s'ouvre par-dessus ──
          → activer une option n'allonge jamais l'écran de saisie */}
      {(() => {
        const canSide  = type === "expense";
        const canTags  = tags.length > 0 && !isCag;
        const canRec   = !isCag && !isAdj && !editingId;
        if (!canSide && !canTags && !canRec) return null;
        const chips = [];
        if (canSide) [...side.open].forEach(k => {
          const st = sideAmountTypes.find(x => x.id === k); const v = side.vals[k];
          if (st && v) chips.push([`${st.icon} ${v} €`, "var(--tr)", "var(--tr-glow)"]);
        });
        if (canSide && isCheque) chips.push([`🧾 Chèque${chequeNum ? " n°" + chequeNum : ""}`, "var(--chq)", "var(--chq-glow)"]);
        if (canTags) tagIds.forEach(id => { const tg = tags.find(x => x.id === id); if (tg) chips.push([`${tg.icon} ${tg.name}`, tg.color, `${tg.color}22`]); });
        if (canRec && isRecurring) chips.push([`🔄 ${frequency === "yearly" ? "Annuelle" : "Mensuelle"}${frequency === "monthly" && occurrences ? " ×" + occurrences : ""}`, "var(--sapin)", "rgba(88,192,144,.14)"]);
        if (canSide && reimbOn && reimbValue > 0) chips.push([`↩️ ${fmt(reimbValue)}${reimbFrom ? " · " + reimbFrom : ""}`, "#5cc8c0", "rgba(92,200,192,.14)"]);
        const hint = [canSide && sideAmountTypes.map(x => x.label).join(", "), canSide && "chèque", canSide && "remboursement", canTags && "tags", canRec && "récurrente"].filter(Boolean).join(", ");
        const rowStyle = col => ({ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 11, border: `1px solid ${col}`, marginBottom: 7 });
        const pill = (on, col, bg) => ({ padding: "5px 10px", borderRadius: 14, fontSize: ".64rem", fontWeight: 700, cursor: "pointer", touchAction: "manipulation",
          border: `1px solid ${on ? col : "var(--border)"}`, color: on ? col : "var(--text2)", background: on ? bg : "transparent" });
        const close = () => { document.activeElement?.blur(); setOptOpen(false); };
        return (
          <div style={{ marginBottom: 10 }}>
            <SectionLabel color="var(--tr)">Options</SectionLabel>
            <button type="button"
              onTouchStart={e => e.stopPropagation()}
              onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); setOptOpen(true); }}
              onClick={() => { if (!('ontouchstart' in window)) setOptOpen(true); }}
              style={{
                width: "100%", minHeight: 40, padding: "7px 12px", boxSizing: "border-box", borderRadius: 10,
                background: "rgba(217,160,102,.05)", border: "1px solid rgba(217,160,102,.3)", borderLeft: "3px solid var(--tr)",
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer", touchAction: "manipulation", fontFamily: "inherit",
              }}>
              <span style={{ flex: 1, display: "flex", gap: 5, overflow: "hidden", whiteSpace: "nowrap", textAlign: "left" }}>
                {chips.length === 0
                  ? <span style={{ fontSize: ".72rem", color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis" }}>{hint.charAt(0).toUpperCase() + hint.slice(1)}…</span>
                  : chips.map(([l, col, bg], n) => <span key={n} style={{ fontSize: ".64rem", fontWeight: 800, padding: "3px 8px", borderRadius: 10, color: col, background: bg, flexShrink: 0 }}>{l}</span>)}
              </span>
              <span style={{ color: "var(--text2)", fontSize: ".7rem" }}>▾</span>
            </button>

            {optOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)" }}
                  onTouchStart={e => { e.stopPropagation(); e.preventDefault(); }}
                  onTouchMove={e => { e.stopPropagation(); e.preventDefault(); }}
                  onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); close(); }}
                  onClick={close} />
                <div style={{
                    position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 201,
                    width: "min(92vw, 380px)", maxHeight: "80vh", overflowY: "auto",
                    background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, padding: 12,
                    boxShadow: "0 24px 60px rgba(0,0,0,.8)",
                  }}
                  onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}
                  onTouchEnd={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: ".68rem", fontWeight: 700, color: "var(--tr)", textTransform: "uppercase", letterSpacing: ".1em" }}>✨ Options</span>
                    <button type="button" onClick={close} style={{ width: 24, height: 24, borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}>✕</button>
                  </div>

                  {canSide && sideAmountTypes.map(st => (
                    <div key={st.id} style={rowStyle("var(--tr-border)")}>
                      <span style={{ fontSize: ".95rem" }}>{st.icon}</span>
                      <span style={{ flex: 1, fontSize: ".74rem", fontWeight: 700, color: "var(--tr)" }}>{st.label}</span>
                      <input type="text" inputMode="decimal" placeholder="Montant €" value={side.vals[st.id] || ""}
                        onChange={e => { const v = e.target.value; side.setVal(st.id, v); if (v) side.openType(st.id); }}
                        style={{ width: 96, boxSizing: "border-box", fontSize: ".75rem", background: "var(--surface3)" }} />
                    </div>
                  ))}
                  {canSide && sideAmountTypes.length > 0 && (
                    <div style={{ fontSize: ".56rem", color: "var(--text3)", margin: "-3px 2px 8px", lineHeight: 1.4 }}>Montants à part : informatifs, n'affectent pas ton solde.</div>
                  )}

                  {canSide && (
                    <div style={rowStyle("var(--chq-border)")} onClick={() => { if (!isCheque) setIsCheque(true); }}>
                      <span style={{ fontSize: ".95rem" }}>🧾</span>
                      <span style={{ flex: 1, fontSize: ".74rem", fontWeight: 700, color: "var(--chq)" }}>Chèque</span>
                      {isCheque ? (
                        <>
                          <input type="text" inputMode="numeric" placeholder="N° (option.)" value={chequeNum}
                            onChange={e => setChequeNum(e.target.value.replace(/[^0-9A-Za-z]/g, ""))}
                            style={{ width: 96, boxSizing: "border-box", fontSize: ".75rem", background: "var(--surface3)" }} />
                          <button type="button" onClick={e => { e.stopPropagation(); setIsCheque(false); setChequeNum(""); }}
                            style={{ background: "none", border: "none", color: "var(--text3)", fontSize: ".7rem", cursor: "pointer", padding: 2 }}>✕</button>
                        </>
                      ) : <span style={{ fontSize: ".62rem", color: "var(--text3)" }}>Toucher pour activer</span>}
                    </div>
                  )}

                  {canSide && (
                    <div style={{ ...rowStyle("rgba(92,200,192,.45)"), flexWrap: "wrap" }}>
                      <span style={{ fontSize: ".95rem" }}>↩️</span>
                      <span style={{ flex: 1, fontSize: ".74rem", fontWeight: 700, color: "#5cc8c0" }}>Sera remboursé</span>
                      <button type="button" onClick={() => setReimbOn(v => !v)}
                        style={{ width: 40, height: 22, borderRadius: 20, border: "none", cursor: "pointer", position: "relative", flexShrink: 0, background: reimbOn ? "#5cc8c0" : "var(--surface3)" }}>
                        <span style={{ position: "absolute", top: 2, left: reimbOn ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                      </button>
                      {reimbOn && (
                        <div style={{ width: "100%", marginTop: 8 }}>
                          <div style={{ display: "flex", gap: 6, marginBottom: 7 }}>
                            {[["all", `Tout${amountOf(amount) > 0 ? " (" + fmt(amountOf(amount)) + ")" : ""}`], ["half", "50 %"], ["custom", "Autre…"]].map(([k, l]) => (
                              <span key={k} onClick={() => setReimbMode(k)} style={pill(reimbMode === k, "#5cc8c0", "rgba(92,200,192,.14)")}>{l}</span>
                            ))}
                          </div>
                          {reimbMode === "custom" && (
                            <input type="text" inputMode="decimal" placeholder="Montant attendu €" value={reimbAmt} onChange={e => setReimbAmt(e.target.value.replace(/[^0-9,.]/g, ""))}
                              style={{ width: "100%", boxSizing: "border-box", fontSize: ".75rem", marginBottom: 7, background: "var(--surface3)" }} />
                          )}
                          <div style={{ display: "flex", gap: 6 }}>
                            <input type="text" placeholder="Par : Mutuelle, Thomas…" value={reimbFrom} onChange={e => setReimbFrom(e.target.value)}
                              style={{ flex: 1, minWidth: 0, boxSizing: "border-box", fontSize: ".72rem", background: "var(--surface3)" }} />
                            <input type="date" value={reimbDate} onChange={e => setReimbDate(e.target.value)} title="Date prévue (optionnel)"
                              style={{ width: 128, boxSizing: "border-box", fontSize: ".68rem", background: "var(--surface3)" }} />
                          </div>
                          {reimbValue > 0 && <div style={{ fontSize: ".6rem", color: "var(--text2)", marginTop: 6 }}>→ <b style={{ color: "#5cc8c0" }}>{fmt(reimbValue)}</b> à recevoir{reimbFrom ? ` de ${reimbFrom}` : ""} · n'entre pas dans le solde avant réception</div>}
                        </div>
                      )}
                    </div>
                  )}

                  {canTags && (
                    <div style={{ ...rowStyle("rgba(228,139,184,.35)"), flexWrap: "wrap" }}>
                      <span style={{ fontSize: ".95rem" }}>🏷️</span>
                      <span style={{ fontSize: ".74rem", fontWeight: 700, color: "#e48bb8", marginRight: 4 }}>Tags</span>
                      {tags.map(tag => {
                        const on = tagIds.includes(tag.id);
                        return <span key={tag.id} onClick={() => setTagIds(ids => on ? ids.filter(i => i !== tag.id) : [...ids, tag.id])}
                          style={pill(on, tag.color, `${tag.color}22`)}>{tag.icon} {tag.name}</span>;
                      })}
                    </div>
                  )}

                  {canRec && (
                    <div style={{ ...rowStyle("rgba(88,192,144,.35)"), flexWrap: "wrap" }}>
                      <span style={{ fontSize: ".95rem" }}>🔄</span>
                      <span style={{ flex: 1, fontSize: ".74rem", fontWeight: 700, color: "var(--sapin)" }}>Récurrente</span>
                      {[["monthly", "Mensuelle"], ["yearly", "Annuelle"]].map(([k, l]) => {
                        const on = isRecurring && frequency === k;
                        return <span key={k} onClick={() => { if (on) setIsRecurring(false); else { setIsRecurring(true); setFrequency(k); } }}
                          style={pill(on, "var(--sapin)", "rgba(88,192,144,.14)")}>{l}</span>;
                      })}
                      {isRecurring && frequency === "monthly" && (
                        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                          <span style={{ flex: 1, fontSize: ".62rem", color: "var(--text2)" }}>Nombre de fois <span style={{ color: "var(--text3)" }}>(vide = illimité)</span></span>
                          <input type="number" min="2" max="120" placeholder="∞" value={occurrences} onChange={e => setOccurrences(e.target.value)}
                            style={{ width: 64, boxSizing: "border-box", fontSize: ".8rem", textAlign: "center", fontFamily: "var(--mono)" }} />
                        </div>
                      )}
                    </div>
                  )}

                  <button type="button" onClick={close} style={{ width: "100%", marginTop: 4, padding: 11, borderRadius: 11, border: "none", background: "var(--tr)", color: "#1a1405", fontWeight: 800, fontSize: ".76rem", cursor: "pointer" }}>OK</button>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── v1.48.0 : ce revenu est-il un remboursement attendu ? ── */}
      {reimbCandidate && (
        <div style={{ padding: "10px 12px", borderRadius: 11, marginBottom: 10, background: "rgba(92,200,192,.07)", border: "1.5px solid rgba(92,200,192,.5)" }}>
          <div style={{ fontSize: ".74rem", fontWeight: 800 }}>↩️ C'est le remboursement{reimbCandidate.from ? ` de ${reimbCandidate.from}` : ""} ?</div>
          <div style={{ fontSize: ".62rem", color: "var(--text2)", margin: "3px 0 8px" }}>{reimbCandidate.note || "Remboursement attendu"} · {fmt(reimbCandidate.amount)} attendus{reimbCandidate.expectedDate ? ` vers le ${reimbCandidate.expectedDate.slice(8)}/${reimbCandidate.expectedDate.slice(5, 7)}` : ""}</div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <button className="btn btn-outline" style={{ width: "100%", padding: "8px" }} onClick={() => setDismissReimb(l => [...l, reimbCandidate.id])}>Non</button>
            <button className="btn" style={{ width: "100%", padding: "8px", background: "#5cc8c0", color: "#06201e", fontWeight: 800 }}
              onClick={() => { setLinkReimbId(reimbCandidate.id); if (!note && reimbCandidate.from) setNote(`Remboursement ${reimbCandidate.from}`); }}>✓ Oui</button>
          </div>
        </div>
      )}
      {linkedReimb && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, marginBottom: 10, fontSize: ".66rem", background: "rgba(92,200,192,.07)", border: "1px solid rgba(92,200,192,.4)" }}>
          <span style={{ flex: 1 }}>✓ Relié au remboursement{linkedReimb.from ? ` de ${linkedReimb.from}` : ""} ({fmt(linkedReimb.amount)})</span>
          <span onClick={() => setLinkReimbId(null)} style={{ color: "var(--text3)", cursor: "pointer" }}>✕</span>
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
//  Briques de formulaire communes — v1.45.0
//  Tous les formulaires de saisie reprennent la présentation de la
//  saisie d'une dépense : boutons de type en haut, montant + clavier de
//  l'app, champs colorés avec liseré (catégorie violet, date bleu, texte
//  gris, options cuivre), Annuler / Enregistrer en bas.
// ─────────────────────────────────────────────────────────────────
/** Props tactiles standard : ignore un glissement (touchMoved), clic souris sinon */
function tap(fn) {
  return {
    onTouchStart: e => e.stopPropagation(),
    onTouchEnd:   e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); fn(); },
    onClick:      () => { if (!("ontouchstart" in window)) fn(); },
  };
}

/** "2026-10" + n mois → "2026-11" */
function addMonthsYM(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const ymLabel = ym => ym ? `${MONTHS_SHORT[parseInt(ym.slice(5, 7), 10) - 1]} ${ym.slice(0, 4)}` : "";
/** Date locale + n jours → "YYYY-MM-DD" (jamais toISOString : UTC) */
function plusDaysISO(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Boutons de type — même rendu que les 4 types de la saisie d'une dépense */
function TypeButtons({ options, value, onChange, locked }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 6, marginBottom: 10 }}>
      {options.map(({ k, emoji, label, color }) => {
        const sel = value === k;
        const dim = locked && !sel;
        return (
          <button key={k} type="button" {...tap(() => { if (!locked) onChange(k); })}
            style={{
              padding: "7px 2px 6px", borderRadius: "var(--radius)",
              border: `1.5px solid ${sel ? color : "var(--border)"}`,
              background: sel ? `color-mix(in srgb, ${color} 14%, var(--surface2))` : "var(--surface2)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              cursor: locked ? "default" : "pointer", touchAction: "manipulation", opacity: dim ? .35 : 1,
            }}>
            <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{emoji}</span>
            <span style={{ fontSize: ".6rem", fontWeight: 700, color: sel ? color : "var(--text3)", whiteSpace: "nowrap" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Champ texte gris (nom, note, raison…) — même style que la note de la saisie */
function TextField({ label, value, onChange, placeholder, error, maxLength, inputStyle }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <SectionLabel color="#a8b4c2">{label}</SectionLabel>}
      {error && <FieldError msg={error} />}
      <input type="text" value={value} placeholder={placeholder} maxLength={maxLength}
        className={error ? "error" : ""}
        onChange={e => onChange(e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", borderLeft: "3px solid #8a98a8", background: "rgba(255,255,255,.03)", ...inputStyle }} />
    </div>
  );
}

/** Icône (grand carré) + nom côte à côte — catégories et templates */
function IconNameField({ icon, onIcon, name, onName, namePlaceholder, iconPlaceholder, errors = {} }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <SectionLabel color="#a8b4c2">Icône & nom</SectionLabel>
      {(errors.icon || errors.name) && <FieldError msg={errors.icon || errors.name} />}
      <div style={{ display: "flex", gap: 8 }}>
        <input type="text" maxLength={4} value={icon} placeholder={iconPlaceholder || "🙂"} onChange={e => onIcon(e.target.value)}
          className={errors.icon ? "error" : ""}
          style={{ width: 54, height: 54, flexShrink: 0, padding: 0, textAlign: "center", fontSize: "1.6rem", borderRadius: 12,
            borderLeft: "3px solid #8a98a8", background: "rgba(255,255,255,.03)" }} />
        <input type="text" value={name} placeholder={namePlaceholder} onChange={e => onName(e.target.value)}
          className={errors.name ? "error" : ""}
          style={{ flex: 1, minWidth: 0, height: 54, boxSizing: "border-box", borderLeft: "3px solid #8a98a8", background: "rgba(255,255,255,.03)" }} />
      </div>
    </div>
  );
}

/** Rangée de 4 boutons bleus pour choisir un MOIS (début, reprise…) ; « Autre… » → sélecteur de mois */
function MonthField({ label, value, onChange, shortcuts }) {
  const [custom, setCustom] = useState(false);
  const ref = useRef(null);
  const isShortcut = shortcuts.some(([, v]) => v === value);
  const showCustom = custom || !isShortcut;
  const openPicker = () => {
    setCustom(true);
    setTimeout(() => { try { ref.current?.showPicker?.(); } catch { ref.current?.focus(); } }, 60);
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <SectionLabel color="var(--accent)">{label}</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, padding: 5, borderRadius: 12,
        background: "rgba(112,184,224,.05)", border: "1px solid rgba(112,184,224,.22)", borderLeft: "3px solid var(--accent)" }}>
        {[...shortcuts, ["Autre…", undefined]].map(([lbl, v]) => {
          const sel = v === undefined ? showCustom : (!showCustom && value === v);
          const shown = v === undefined && !isShortcut && value ? `📅 ${ymLabel(value)}` : lbl;
          return (
            <button key={lbl} type="button" {...tap(() => { if (v === undefined) openPicker(); else { setCustom(false); onChange(v); } })}
              style={{
                padding: "6px 2px", borderRadius: 20, fontSize: ".62rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                border: `1.5px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                background: sel ? "rgba(112,184,224,.14)" : "var(--surface2)",
                color: sel ? "var(--accent)" : "var(--text2)", fontWeight: sel ? 700 : 400, cursor: "pointer", touchAction: "manipulation",
              }}>{shown}</button>
          );
        })}
      </div>
      {showCustom && (
        <input type="month" ref={ref} value={value || ""} onChange={e => { if (e.target.value) onChange(e.target.value); }}
          style={{ marginTop: 6, width: "100%", boxSizing: "border-box" }} />
      )}
    </div>
  );
}

/** Champ « Options » cuivre : un bouton qui ouvre un panneau par-dessus (l'écran ne s'allonge jamais) */
function OptionsField({ hint, chips = [], children }) {
  const [open, setOpen] = useState(false);
  const close = () => { document.activeElement?.blur(); setOpen(false); };
  return (
    <div style={{ marginBottom: 10 }}>
      <SectionLabel color="var(--tr)">Options</SectionLabel>
      <button type="button" {...tap(() => setOpen(true))}
        style={{
          width: "100%", minHeight: 40, padding: "7px 12px", boxSizing: "border-box", borderRadius: 10,
          background: "rgba(217,160,102,.05)", border: "1px solid rgba(217,160,102,.3)", borderLeft: "3px solid var(--tr)",
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer", touchAction: "manipulation", fontFamily: "inherit",
        }}>
        <span style={{ flex: 1, display: "flex", gap: 5, overflow: "hidden", whiteSpace: "nowrap", textAlign: "left" }}>
          {chips.length === 0
            ? <span style={{ fontSize: ".72rem", color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis" }}>{hint}</span>
            : chips.map(([l, col, bg], n) => <span key={n} style={{ fontSize: ".64rem", fontWeight: 800, padding: "3px 8px", borderRadius: 10, color: col, background: bg, flexShrink: 0 }}>{l}</span>)}
        </span>
        <span style={{ color: "var(--text2)", fontSize: ".7rem" }}>▾</span>
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)" }}
            onTouchStart={e => { e.stopPropagation(); e.preventDefault(); }}
            onTouchMove={e => { e.stopPropagation(); e.preventDefault(); }}
            onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); close(); }}
            onClick={close} />
          <div style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 201,
              width: "min(92vw, 380px)", maxHeight: "80vh", overflowY: "auto",
              background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, padding: 12,
              boxShadow: "0 24px 60px rgba(0,0,0,.8)",
            }}
            onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}
            onTouchEnd={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: ".68rem", fontWeight: 700, color: "var(--tr)", textTransform: "uppercase", letterSpacing: ".1em" }}>✨ Options</span>
              <button type="button" onClick={close} style={{ width: 24, height: 24, borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}>✕</button>
            </div>
            {children}
            <button type="button" onClick={close} style={{ width: "100%", marginTop: 4, padding: 11, borderRadius: 11, border: "none", background: "var(--tr)", color: "#1a1405", fontWeight: 800, fontSize: ".76rem", cursor: "pointer" }}>OK</button>
          </div>
        </>
      )}
    </div>
  );
}

/** Boutons du bas : Annuler / Enregistrer */
function FormActions({ onCancel, onSave, emoji, label = "Enregistrer", color }) {
  return (
    <div className="grid-2" style={{ marginBottom: 0 }}>
      <button className="btn btn-outline" style={{ width: "100%" }} onClick={onCancel}>Annuler</button>
      <button className="btn btn-primary" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, ...(color ? { background: color } : {}) }}
        onClick={onSave}>
        {emoji && <span>{emoji}</span>}<span>{label}</span>
      </button>
    </div>
  );
}

/** Petit encart d'information gris */
function InfoNote({ children, color }) {
  return (
    <div style={{ fontSize: ".62rem", color: color || "var(--text3)", lineHeight: 1.45, padding: "7px 10px", borderRadius: 9, marginBottom: 10,
      background: "var(--surface2)", border: `1px solid ${color ? `color-mix(in srgb, ${color} 35%, transparent)` : "var(--border)"}` }}>{children}</div>
  );
}

/** Montant saisi au clavier de l'app (accepte « 12+3 » même sans appuyer sur =) */
const amountOf = str => { const v = evalAmount(str); return isNaN(v) ? NaN : Math.round(v * 100) / 100; };
const toPadStr = n => (n === undefined || n === null || n === "") ? "" : String(n).replace(".", ",");

// ─────────────────────────────────────────────────────────────────
//  Jour de prélèvement (v1.48.0) : Aucun / 1 / 5 / 10 / Autre… → grille
// ─────────────────────────────────────────────────────────────────
function DayField({ value, onChange, label = "Jour de prélèvement" }) {
  const [grid, setGrid] = useState(false);
  const quick = [[null, "Aucun"], [1, "Le 1"], [5, "Le 5"], [10, "Le 10"]];
  const isQuick = value == null || [1, 5, 10].includes(value);
  return (
    <div style={{ marginBottom: 10 }}>
      <SectionLabel color="var(--accent)">{label}</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, padding: 5, borderRadius: 12,
        background: "rgba(112,184,224,.05)", border: "1px solid rgba(112,184,224,.22)", borderLeft: "3px solid var(--accent)" }}>
        {[...quick, ["__other", isQuick ? "Autre…" : `Le ${value}`]].map(([v, l]) => {
          const sel = v === "__other" ? (!isQuick || grid) : (value === v && !grid);
          return (
            <button key={l} type="button" {...tap(() => { if (v === "__other") setGrid(g => !g); else { setGrid(false); onChange(v); } })}
              style={{ padding: "6px 2px", borderRadius: 20, fontSize: ".62rem", whiteSpace: "nowrap",
                border: `1.5px solid ${sel ? "var(--accent)" : "var(--border)"}`, background: sel ? "rgba(112,184,224,.14)" : "var(--surface2)",
                color: sel ? "var(--accent)" : "var(--text2)", fontWeight: sel ? 700 : 400, cursor: "pointer", touchAction: "manipulation" }}>{l}</button>
          );
        })}
      </div>
      {grid && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginTop: 6 }}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
            <button key={d} type="button" {...tap(() => { onChange(d); setGrid(false); })}
              style={{ padding: "6px 0", borderRadius: 8, fontSize: ".66rem", cursor: "pointer", touchAction: "manipulation",
                border: `1px solid ${value === d ? "var(--accent)" : "var(--border)"}`, background: value === d ? "rgba(112,184,224,.14)" : "var(--surface2)",
                color: value === d ? "var(--accent)" : "var(--text2)", fontWeight: value === d ? 700 : 400 }}>{d}</button>
          ))}
          <div style={{ gridColumn: "1 / -1", fontSize: ".55rem", color: "var(--text3)", marginTop: 2 }}>Mois plus court (ex. le 31 en février) : dernier jour du mois.</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Frais fixe / revenu fixe — v1.45.0 (un seul formulaire pour les deux)
//  À la création, les boutons du haut permettent de basculer de l'un à
//  l'autre ; en modification le type est verrouillé (un frais existant
//  reste un frais).
// ─────────────────────────────────────────────────────────────────
function FixedFormModal({ initialKind, categories, fixedExpenses = [], fixedIncomes = [], editingIdx, onSaveExpense, onSaveIncome, onClose }) {
  const toast = useToast();
  const isEdit = editingIdx != null;
  const [kind, setKind] = useState(initialKind);
  const f = isEdit ? (initialKind === "income" ? fixedIncomes : fixedExpenses)[editingIdx] : null;
  const isInc = kind === "income";
  const cats = categories.filter(c => c.type === (isInc ? "income" : "expense"));
  const curM = currentYM();

  const [name,   setName]   = useState(f?.name || "");
  const [amt,    setAmt]    = useState(toPadStr(f?.amount));
  const [catId,  setCatId]  = useState(f?.categoryId || cats[0]?.id || "");
  const [startYM, setStartYM] = useState(f?.startYM || "");
  const [day, setDay] = useState(f?.day || null);   // v1.48.0 : jour de prélèvement
  const [paused,      setPaused]      = useState(f?.paused || false);
  const [pausedFrom,  setPausedFrom]  = useState(f?.pausedFrom || "");
  const [pausedUntil, setPausedUntil] = useState(f?.pausedUntil || "");
  // Pauses déjà terminées (v1.45.1) — modifiables, pour corriger un mois compté à tort
  const [pastPauses, setPastPauses] = useState(f?.pauseHistory || []);
  const [newPast, setNewPast] = useState(null); // { from, until } en cours d'ajout
  const [errors, setErrors] = useState({});

  function switchKind(k) {
    if (k === kind) return;
    setKind(k);
    setCatId(categories.find(c => c.type === (k === "income" ? "income" : "expense"))?.id || "");
  }

  function handleSave() {
    const e = {};
    const a = amountOf(amt);
    if (!name.trim()) e.name = "Nom requis";
    if (!amt || isNaN(a) || a <= 0) e.amt = "Montant requis et doit être > 0";
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload = {
      name: name.trim(), amount: a, categoryId: catId,
      startYM: startYM || null,
      day: day || null,
      paused,
      // Point de départ de la pause : le mois en cours par défaut si on
      // vient de l'activer (jamais rétroactif sur l'historique déjà passé)
      pausedFrom:  paused ? (pausedFrom || curM) : null,
      pausedUntil: paused ? (pausedUntil || null) : null,
      pauseHistory: pastPauses.length ? pastPauses : undefined,
    };
    if (isInc) onSaveIncome({ idx: editingIdx, income: payload });
    else       onSaveExpense({ idx: editingIdx, fixed: payload });
    toast(isInc ? (isEdit ? "Revenu fixe modifié" : "Revenu fixe ajouté") : (isEdit ? "Frais fixe modifié" : "Frais fixe ajouté"));
  }

  const pill = (on, col) => ({ padding: "5px 10px", borderRadius: 14, fontSize: ".64rem", fontWeight: 700, cursor: "pointer", touchAction: "manipulation",
    border: `1px solid ${on ? col : "var(--border)"}`, color: on ? col : "var(--text2)", background: on ? `color-mix(in srgb, ${col} 14%, transparent)` : "transparent" });

  return (
    <Modal onClose={onClose} title={isEdit ? (isInc ? "Modifier le revenu fixe" : "Modifier le frais fixe") : (isInc ? "Nouveau revenu fixe" : "Nouveau frais fixe")}>
      <TypeButtons value={kind} onChange={switchKind} locked={isEdit} options={[
        { k: "expense", emoji: "💸", label: "Frais fixe",  color: "var(--danger)"  },
        { k: "income",  emoji: "💰", label: "Revenu fixe", color: "var(--success)" },
      ]} />
      <TextField label="Nom" value={name} error={errors.name} placeholder={isInc ? "Ex : Salaire, CAF…" : "Ex : Loyer, Netflix…"}
        onChange={v => { setName(v); setErrors(x => ({ ...x, name: "" })); }} />
      <div style={{ marginBottom: 10 }}>
        {errors.amt && <FieldError msg={errors.amt} />}
        <NumPad value={amt} type={isInc ? "income" : "expense"}
          onChange={v => { setAmt(typeof v === "function" ? v(amt) : v); setErrors(x => ({ ...x, amt: "" })); }} />
      </div>
      <CategoryField cats={cats} catId={catId} onChange={setCatId} />
      <DayField label={isInc ? "Jour de versement" : "Jour de prélèvement"} value={day} onChange={setDay} />
      <MonthField label="Début" value={startYM} onChange={setStartYM} shortcuts={[
        ["Déjà en cours", ""], ["Ce mois", curM], ["Mois proch.", addMonthsYM(curM, 1)],
      ]} />
      <OptionsField hint="Mettre en pause, pauses passées…"
        chips={[
          ...(paused ? [[`⏸️ En pause${pausedUntil ? " → " + ymLabel(pausedUntil) : ""}`, "var(--warning)", "var(--warning-glow)"]] : []),
          ...(pastPauses.length ? [[`🕓 ${pastPauses.length} pause${pastPauses.length > 1 ? "s" : ""} passée${pastPauses.length > 1 ? "s" : ""}`, "var(--text2)", "var(--surface3)"]] : []),
        ]}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 11, border: "1px solid rgba(200,184,96,.4)", marginBottom: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: ".95rem" }}>⏸️</span>
          <span style={{ flex: 1, fontSize: ".74rem", fontWeight: 700, color: "var(--warning)" }}>Mettre en pause</span>
          <button type="button"
            onClick={() => {
              const next = !paused;
              setPaused(next);
              if (next && !pausedFrom) setPausedFrom(curM);
              if (!next) { setPausedFrom(""); setPausedUntil(""); }
            }}
            style={{ width: 40, height: 22, borderRadius: 20, border: "none", cursor: "pointer", position: "relative", flexShrink: 0,
              background: paused ? "var(--warning)" : "var(--surface3)", transition: "background .15s" }}>
            <span style={{ position: "absolute", top: 2, left: paused ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
          </button>
          {paused && (
            <div style={{ width: "100%" }}>
              <div style={{ fontSize: ".6rem", color: "var(--text3)", lineHeight: 1.5, margin: "4px 0 7px" }}>
                Non {isInc ? "compté" : "déduit"} nulle part à partir de {ymLabel(pausedFrom || curM)} (solde, historique, rapport…). Reprise :
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={pill(!pausedUntil, "var(--warning)")} onClick={() => setPausedUntil("")}>Indéfinie</span>
                <span style={pill(pausedUntil === curM, "var(--warning)")} onClick={() => setPausedUntil(curM)}>Mois prochain</span>
                <label style={{ ...pill(pausedUntil && pausedUntil !== curM, "var(--warning)"), position: "relative", margin: 0, display: "inline-block", textTransform: "none", letterSpacing: 0 }}>
                  {pausedUntil && pausedUntil !== curM ? `Après ${ymLabel(pausedUntil)}` : "Autre…"}
                  <input type="month" value={pausedUntil || ""} onChange={e => setPausedUntil(e.target.value)}
                    style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", padding: 0, cursor: "pointer" }} />
                </label>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: "9px 10px", borderRadius: 11, border: "1px solid var(--border)", marginBottom: 7 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: ".95rem" }}>🕓</span>
            <span style={{ flex: 1, fontSize: ".74rem", fontWeight: 700, color: "var(--text2)" }}>Pauses passées</span>
          </div>
          <div style={{ fontSize: ".6rem", color: "var(--text3)", lineHeight: 1.5, margin: "4px 0 7px" }}>
            Mois où ce {isInc ? "revenu n'a pas été versé" : "frais n'a pas été prélevé"} : ils ne comptent pas dans le solde.
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {pastPauses.map((p, i) => (
              <span key={p.from + p.until} style={pill(true, "var(--text2)")}
                onClick={() => setPastPauses(list => list.filter((_, j) => j !== i))}>
                {p.from === p.until ? ymLabel(p.from) : `${ymLabel(p.from)} → ${ymLabel(p.until)}`} ✕
              </span>
            ))}
            {!newPast && <span style={pill(false, "var(--accent)")} onClick={() => setNewPast({ from: addMonthsYM(curM, -1), until: addMonthsYM(curM, -1) })}>＋ Ajouter</span>}
          </div>
          {newPast && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, alignItems: "end", marginTop: 8 }}>
              <div>
                <div style={{ fontSize: ".55rem", color: "var(--text3)", marginBottom: 3 }}>DU MOIS</div>
                <input type="month" value={newPast.from} max={curM} onChange={e => setNewPast(v => ({ ...v, from: e.target.value }))}
                  style={{ width: "100%", boxSizing: "border-box", fontSize: ".72rem", padding: "7px 6px" }} />
              </div>
              <div>
                <div style={{ fontSize: ".55rem", color: "var(--text3)", marginBottom: 3 }}>AU MOIS (INCLUS)</div>
                <input type="month" value={newPast.until} max={curM} onChange={e => setNewPast(v => ({ ...v, until: e.target.value }))}
                  style={{ width: "100%", boxSizing: "border-box", fontSize: ".72rem", padding: "7px 6px" }} />
              </div>
              <button type="button"
                onClick={() => {
                  const { from, until } = newPast;
                  if (from && until && from <= until) {
                    setPastPauses(list => [...list.filter(p => !(p.from === from && p.until === until)), { from, until }].sort((a, b) => a.from.localeCompare(b.from)));
                    setNewPast(null);
                  }
                }}
                style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--accent)", background: "var(--accent-glow)", color: "var(--accent)", fontWeight: 800, fontSize: ".68rem", cursor: "pointer" }}>OK</button>
            </div>
          )}
        </div>
      </OptionsField>
      <FormActions onCancel={onClose} onSave={handleSave} emoji={isInc ? "💰" : "💸"} />
    </Modal>
  );
}

export function FixedModal({ categories, fixedExpenses, fixedIncomes, editingIdx, onSave, onSaveIncome, onClose }) {
  return <FixedFormModal initialKind="expense" categories={categories} fixedExpenses={fixedExpenses} fixedIncomes={fixedIncomes}
    editingIdx={editingIdx} onSaveExpense={onSave} onSaveIncome={onSaveIncome || (() => {})} onClose={onClose} />;
}

export function FixedIncomeModal({ categories, fixedIncomes, fixedExpenses, editingIdx, onSave, onSaveExpense, onClose }) {
  return <FixedFormModal initialKind="income" categories={categories} fixedExpenses={fixedExpenses} fixedIncomes={fixedIncomes}
    editingIdx={editingIdx} onSaveExpense={onSaveExpense || (() => {})} onSaveIncome={onSave} onClose={onClose} />;
}

// ─────────────────────────────────────────────────────────────────
//  Cagnotte modal — v1.45.0
// ─────────────────────────────────────────────────────────────────
const CAG_TYPES = [
  { id:"projet",         icon:"🎯", label:"Projet",          color:"var(--accent)"   },
  { id:"urgence",        icon:"🛡️", label:"Urgence",         color:"var(--danger)"   },
  { id:"plaisir",        icon:"✈️", label:"Plaisir",         color:"var(--purple)"   },
  { id:"investissement", icon:"📈", label:"Invest.",         color:"var(--success)"  },
];
export function CagModal({ cagnottes, editingId, onSave, onDelete, onClose }) {
  const toast = useToast();
  const c     = editingId ? cagnottes.find(x => x.id === editingId) : null;

  const [name,       setName]       = useState(c?.name || "");
  const [target,     setTarget]     = useState(toPadStr(c?.target));
  const [targetDate, setTargetDate] = useState(c?.targetDate || "");
  const [current,    setCurrent]    = useState(toPadStr(c?.current || ""));
  const [cagType,    setCagType]    = useState(c?.cagType || null);
  const [which,      setWhich]      = useState(c ? "current" : "target"); // case remplie par le clavier
  const [errors,     setErrors]     = useState({});

  const calcInfo = (() => {
    const t = amountOf(target), cur = amountOf(current) || 0;
    if (!t || !targetDate) return null;
    const rem = t - cur;
    const today = new Date(), tgt = new Date(targetDate + "T12:00:00");
    const months = Math.max(1, (tgt.getFullYear() - today.getFullYear()) * 12 + (tgt.getMonth() - today.getMonth()));
    return rem > 0 ? `📅 À épargner : ${fmt(rem / months)}/mois pendant ${months} mois` : "🎉 Objectif déjà atteint !";
  })();

  function handleSave() {
    const e = {};
    if (!name.trim()) e.name = "Nom requis";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({
      id: editingId || null,
      name: name.trim(),
      target: amountOf(target) || null,
      targetDate: targetDate || null,
      current: amountOf(current) || 0,
      cagType: cagType || null,
    });
    toast(editingId ? "Cagnotte modifiée" : "Cagnotte créée");
  }

  const AmountBox = ({ k, label, value, color }) => { // appelée comme une fonction, pas comme un composant
    const on = which === k;
    return (
      <button type="button" {...tap(() => setWhich(k))}
        style={{ flex: 1, minWidth: 0, textAlign: "left", padding: "7px 10px", borderRadius: 12, cursor: "pointer", touchAction: "manipulation", fontFamily: "inherit",
          border: `1.5px solid ${on ? color : "var(--border)"}`, background: on ? `color-mix(in srgb, ${color} 10%, var(--surface2))` : "var(--surface2)" }}>
        <div style={{ fontSize: ".56rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: on ? color : "var(--text3)" }}>{label}</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: "1.3rem", fontWeight: 800, color: on ? color : "var(--text2)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value || "0"} €</div>
      </button>
    );
  };

  // Date objectif : raccourcis à 6 mois / 1 an (fin de mois)
  const endOfMonthIn = n => { const d = new Date(); const e = new Date(d.getFullYear(), d.getMonth() + n + 1, 0);
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`; };

  return (
    <Modal onClose={onClose} title={editingId ? "Modifier la cagnotte" : "Nouvelle cagnotte"}>
      <TypeButtons value={cagType} onChange={k => setCagType(cagType === k ? null : k)}
        options={CAG_TYPES.map(t => ({ k: t.id, emoji: t.icon, label: t.label, color: t.color }))} />
      <TextField label="Nom" value={name} error={errors.name} placeholder="Ex : Vacances Bretagne"
        onChange={v => { setName(v); setErrors(x => ({ ...x, name: "" })); }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {AmountBox({ k: "target",  label: "🎯 Objectif (option.)", value: target,  color: "var(--purple)" })}
        {AmountBox({ k: "current", label: "💰 Déjà épargné",       value: current, color: "var(--success)" })}
      </div>
      <div style={{ marginBottom: 10 }}>
        <NumPad value={which === "target" ? target : current} type="income" hideDisplay
          onChange={v => which === "target"
            ? setTarget(p => typeof v === "function" ? v(p) : v)
            : setCurrent(p => typeof v === "function" ? v(p) : v)} />
      </div>
      <DateField label="Date objectif (optionnel)" date={targetDate} onChange={setTargetDate}
        shortcuts={[["Aucune", ""], ["Dans 6 mois", endOfMonthIn(6)], ["Dans 1 an", endOfMonthIn(12)]]} />
      {calcInfo && <InfoNote color="var(--purple)">{calcInfo}</InfoNote>}
      <FormActions onCancel={onClose} onSave={handleSave} emoji="🐷" />
      {/* v1.53.0 : la suppression se fait ici (plus de ✕ sur les cartes de l'écran Cagnottes) */}
      {editingId && onDelete && (
        <button type="button" onClick={() => onDelete(editingId)} style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 10, background: "transparent", border: "1px solid rgba(200,112,112,.35)", color: "var(--danger)", fontWeight: 700, cursor: "pointer" }}>🗑 Supprimer la cagnotte</button>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Transfer modal — v1.45.0
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
  const cagItems = cagnottes.map(c => ({ id: c.id, icon: CAG_TYPES.find(t => t.id === c.cagType)?.icon || "🐷", name: c.name, sub: fmt(c.current) }));

  function handleSave() {
    const e = {};
    const a = amountOf(amt);
    if (!amt || isNaN(a) || a <= 0) e.amt = "Montant requis et doit être > 0";
    if (!isWithdraw && fromId === toId) e.from = "Source et destination identiques";
    if (!e.amt) {
      const from = cagnottes.find(c => c.id === fromId);
      if (from && from.current < a) e.amt = `Fonds insuffisants (${fmt(from.current)} disponible)`;
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({ amt: a, fromId, toId: isWithdraw ? "__account__" : toId, reason: reason.trim() || null });
    toast(isWithdraw ? "Retrait effectué" : "Transfert effectué");
  }

  return (
    <Modal onClose={onClose} title={isWithdraw ? "Retrait vers le compte" : "Transfert entre cagnottes"}>
      <TypeButtons value={mode} onChange={m => { setMode(m); setErrors({}); }} options={[
        { k: "transfer", emoji: "↔️", label: "Entre cagnottes", color: "var(--purple)" },
        { k: "withdraw", emoji: "🏦", label: "Vers le compte",  color: "var(--accent)" },
      ]} />
      <div style={{ marginBottom: 10 }}>
        {errors.amt && <FieldError msg={errors.amt} />}
        <NumPad value={amt} type="transfer" variant="cag"
          onChange={v => { setAmt(typeof v === "function" ? v(amt) : v); setErrors(x => ({ ...x, amt: "" })); }} />
      </div>
      <CategoryField label="Depuis" cats={cagItems} catId={fromId} allowNone={false} emptyLabel="Choisir une cagnotte" error={errors.from}
        onChange={id => { setFrom(id); setErrors(x => ({ ...x, from: "" })); }} />
      {isWithdraw
        ? <InfoNote>🏦 Le montant sera ajouté à ton solde bancaire estimé.</InfoNote>
        : <CategoryField label="Vers" cats={cagItems} catId={toId} allowNone={false} emptyLabel="Choisir une cagnotte"
            onChange={id => { setTo(id); setErrors(x => ({ ...x, from: "" })); }} />}
      <TextField value={reason} onChange={setReason} placeholder="Raison (optionnel)… ex : billet d'avion" />
      <FormActions onCancel={onClose} onSave={handleSave} emoji={isWithdraw ? "🏦" : "↔️"} label={isWithdraw ? "Retirer" : "Transférer"} />
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Scheduled transaction modal — v1.45.0 (même écran qu'une dépense,
//  raccourcis de date tournés vers le futur)
// ─────────────────────────────────────────────────────────────────
export function ScheduledModal({ categories, onSave, onClose }) {
  const toast = useToast();
  const today = todayISO();
  const firstNext = (() => { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth() + 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; })();

  const [amount, setAmount] = useState("");
  const [date,   setDate]   = useState(plusDaysISO(1));
  const [catId,  setCatId]  = useState("");
  const [note,   setNote]   = useState("");
  const [errors, setErrors] = useState({});
  const expenseCats = categories.filter(c => c.type === "expense" || !c.type);

  function handleSave() {
    const e = {};
    const a = amountOf(amount);
    if (!amount || isNaN(a) || a <= 0) e.amount = "Montant requis";
    if (!date || date <= today)        e.date   = "La date doit être dans le futur";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({ amount: a, date, categoryId: catId || null, note });
    toast("Transaction programmée ajoutée");
  }

  return (
    <Modal onClose={onClose} title="📅 Transaction programmée">
      <div style={{ marginBottom: 10 }}>
        {errors.amount && <FieldError msg={errors.amount} />}
        <NumPad value={amount} type="expense"
          onChange={v => { setAmount(typeof v === "function" ? v(amount) : v); setErrors(x => ({ ...x, amount: "" })); }} />
      </div>
      <CategoryField cats={expenseCats} catId={catId} onChange={setCatId} />
      <DateField label="Date prévue" date={date} error={errors.date} min={plusDaysISO(1)}
        onChange={d => { setDate(d); setErrors(x => ({ ...x, date: "" })); }}
        shortcuts={[["Demain", plusDaysISO(1)], ["Dans 1 sem.", plusDaysISO(7)], ["Le 1er", firstNext]]} />
      <TextField value={note} onChange={setNote} placeholder="Note (optionnel)… ex : Précommande Switch 2" />
      <InfoNote>📅 Confirmée automatiquement à la date prévue, puis déduite de ton solde.</InfoNote>
      <FormActions onCancel={onClose} onSave={handleSave} emoji="📅" label="Programmer" />
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Aperçu d'une case catégorie (comme dans le menu des catégories)
// ─────────────────────────────────────────────────────────────────
function CategoryPreview({ icon, name, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <SectionLabel>Aperçu</SectionLabel>
      <div style={{ display: "flex", justifyContent: "center", padding: 10, borderRadius: 12, background: "var(--surface2)", border: "1px dashed var(--border)" }}>
        <div style={{ width: 76, padding: "8px 4px", borderRadius: 10, border: `1.5px solid ${color}`, background: `color-mix(in srgb, ${color} 14%, var(--surface2))`,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: "1.2rem" }}>{icon || "❔"}</span>
          <span style={{ fontSize: ".55rem", fontWeight: 700, color, maxWidth: 68, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || "Nom"}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Category modal — v1.45.0
// ─────────────────────────────────────────────────────────────────
export function CatModal({ editingCat, categories = [], defaultParentId = null, onSave, onClose }) {
  const toast  = useToast();
  const presetParent = categories.find(c => c.id === (editingCat?.parentId || defaultParentId));
  const [name,   setName]   = useState(editingCat?.name || "");
  const [icon,   setIcon]   = useState(editingCat?.icon || "");
  const [type,   setType]   = useState(editingCat?.type || presetParent?.type || "expense");
  const [parentId, setParentId] = useState(presetParent?.id || "");
  const [errors, setErrors] = useState({});
  const color = type === "income" ? "var(--success)" : "var(--danger)";
  // v1.47.0 : sous-catégorie — un seul niveau ; une catégorie qui a déjà des
  // sous-catégories ne peut pas être rattachée à une autre.
  const hasChildren = !!editingCat?.id && categories.some(c => c.parentId === editingCat.id);
  const parentChoices = categories.filter(c => c.type === type && !c.parentId && c.id !== editingCat?.id);
  const parent = categories.find(c => c.id === parentId);

  function handleSave() {
    const e = {};
    if (!icon.trim()) e.icon = "Icône requise";
    if (!name.trim()) e.name = "Nom requis";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({ id: editingCat?.id || null, name: name.trim(), icon: icon.trim(), type, parentId: hasChildren ? null : (parentId || null) });
    toast(editingCat ? "Catégorie modifiée" : parentId ? "Sous-catégorie créée" : "Catégorie créée");
  }

  return (
    <Modal onClose={onClose} title={editingCat ? "Modifier la catégorie" : parentId ? "Nouvelle sous-catégorie" : "Nouvelle catégorie"}>
      <TypeButtons value={type} locked={!!parentId} onChange={k => { setType(k); setParentId(""); }} options={[
        { k: "expense", emoji: "💸", label: "Dépense", color: "var(--danger)"  },
        { k: "income",  emoji: "💰", label: "Revenu",  color: "var(--success)" },
      ]} />
      <IconNameField icon={icon} name={name} errors={errors} namePlaceholder="Ex : Animaux" iconPlaceholder="🐶"
        onIcon={v => { setIcon(v); setErrors(x => ({ ...x, icon: "" })); }}
        onName={v => { setName(v); setErrors(x => ({ ...x, name: "" })); }} />
      {hasChildren
        ? <InfoNote>🗂️ Cette catégorie a des sous-catégories : elle reste une catégorie principale.</InfoNote>
        : <CategoryField label="Rattacher à (optionnel)" cats={parentChoices} catId={parentId} onChange={setParentId}
            emptyLabel="Aucune — catégorie principale" />}
      <CategoryPreview icon={icon} name={parent ? `${parent.name} › ${name}` : name} color={color} />
      <FormActions onCancel={onClose} onSave={handleSave} emoji="✓" />
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Suppression protégée d'une catégorie — v1.47.0
//  Liste tout ce qui y est rattaché et impose un choix : déplacer vers
//  une autre catégorie (par défaut) ou laisser sans catégorie.
// ─────────────────────────────────────────────────────────────────
export function DeleteCategoryModal({ category, categories = [], usage, onConfirm, onClose }) {
  const sameType = categories.filter(c => c.id !== category.id && c.type === category.type && c.parentId !== category.id);
  // Pas de cible présélectionnée (évite un déplacement par erreur), sauf pour une
  // sous-catégorie : sa catégorie principale est la cible logique.
  const suggested = category.parentId && sameType.some(c => c.id === category.parentId) ? category.parentId : "";
  const [mode, setMode] = useState("move");
  const [target, setTarget] = useState(suggested);
  const u = usage;
  const lines = [
    ["💸", "Opérations", u.transactions],
    ["📌", "Frais fixes", u.fixedExpenses, u.fixedNames.join(", ")],
    ["💰", "Revenus fixes", u.fixedIncomes],
    ["🔄", "Récurrentes", u.recurring],
    ["📅", "Programmées", u.scheduled],
    ["⚡", "Templates rapides", u.quickTemplates],
    ["🎫", "Hors compte", u.offAccount],
    ["🧾", "Frais prévisionnels", u.provisional],
    ["⚠️", "Seuil d'alerte", u.threshold ? fmt(u.threshold) : 0],
    ["🛒", "Budget courses", u.grocery ? "oui" : 0],
    ["🔗", "Liaisons", u.linked.length, u.linked.join(", ")],
    ["🗂️", "Sous-catégories", u.children.length, u.children.map(c => c.name).join(", ")],
  ].filter(l => l[2]);
  const used = lines.length > 0;
  const tgt = categories.find(c => c.id === target);
  const radio = on => ({ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1, boxSizing: "border-box",
    border: on ? "5px solid var(--accent)" : "2px solid var(--border)" });
  const optStyle = on => ({ display: "flex", gap: 10, alignItems: "flex-start", padding: 10, borderRadius: 11, marginBottom: 7, cursor: "pointer",
    border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "rgba(112,184,224,.08)" : "transparent" });
  const canConfirm = !used || mode === "none" || !!tgt;

  return (
    <Modal onClose={onClose} title={`🗑 Supprimer « ${category.name} » ?`}>
      {!used
        ? <InfoNote>Cette catégorie n'est utilisée nulle part : elle peut être supprimée sans risque.</InfoNote>
        : <>
            <div style={{ fontSize: ".7rem", color: "var(--text2)", marginBottom: 8 }}>Cette catégorie est utilisée. Voici ce qui y est rattaché :</div>
            {lines.map(([ic, lbl, n, detail]) => (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 5, fontSize: ".72rem" }}>
                <span>{ic}</span><span>{lbl}</span>
                {detail && <span style={{ fontSize: ".6rem", color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{detail}</span>}
                <b style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{n}</b>
              </div>
            ))}
            <SectionLabel>Que faire de ces éléments ?</SectionLabel>
            <div style={optStyle(mode === "move")} onClick={() => setMode("move")}>
              <span style={radio(mode === "move")} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: ".76rem", fontWeight: 700 }}>Tout déplacer vers…</div>
                <div style={{ fontSize: ".6rem", color: "var(--text3)", margin: "2px 0 7px" }}>
                  {u.children.length ? "Les sous-catégories suivent et passent sous la catégorie choisie." : "Tout est rattaché à la catégorie choisie."}
                </div>
                {mode === "move" && (sameType.length
                  ? <CategoryField label="" cats={sameType} catId={target} onChange={setTarget} allowNone={false} emptyLabel="Choisir une catégorie" />
                  : <div style={{ fontSize: ".64rem", color: "var(--danger)" }}>Aucune autre catégorie de ce type.</div>)}
              </div>
            </div>
            <div style={optStyle(mode === "none")} onClick={() => setMode("none")}>
              <span style={radio(mode === "none")} />
              <div>
                <div style={{ fontSize: ".76rem", fontWeight: 700 }}>Laisser sans catégorie</div>
                <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 2 }}>
                  {u.transactions ? `Les ${u.transactions} opérations restent mais n'auront plus de catégorie.` : "Les éléments restent sans catégorie."}
                  {u.children.length ? " Les sous-catégories deviennent des catégories principales." : ""}
                </div>
              </div>
            </div>
          </>}
      <div className="grid-2" style={{ marginBottom: 0, marginTop: 10 }}>
        <button className="btn btn-outline" style={{ width: "100%" }} onClick={onClose}>Annuler</button>
        <button className="btn" disabled={!canConfirm}
          style={{ width: "100%", background: "var(--danger)", color: "#fff", opacity: canConfirm ? 1 : .4 }}
          onClick={() => { if (canConfirm) onConfirm(used && mode === "move" ? target : null); }}>
          🗑 {used && mode === "move" ? "Déplacer et supprimer" : "Supprimer"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Aperçu avant import — v1.47.0
//  Montre le contenu du fichier à côté des données actuelles, alerte si
//  des opérations du téléphone ne sont pas dans le fichier, et propose
//  (coché par défaut) de sauvegarder les données actuelles d'abord.
// ─────────────────────────────────────────────────────────────────
export function summarizeData(d) {
  const txs = d?.transactions || [];
  const dates = txs.map(t => t.date).filter(Boolean).sort();
  return {
    tx: txs.length,
    first: dates[0] || null,
    last: dates[dates.length - 1] || null,
    fixes: (d?.fixedExpenses || []).length + (d?.fixedIncomes || []).length,
    cags: (d?.cagnottes || []).length,
    cats: (d?.categories || []).length,
    backup: d?.lastBackupDate || null,
    version: d?.appVersion || null,
  };
}

export function ImportPreviewModal({ fileName, fileData, currentData, appVersion, onConfirm, onClose }) {
  const [backupFirst, setBackupFirst] = useState(true);
  const [busy, setBusy] = useState(false);
  const F = summarizeData(fileData), C = summarizeData(currentData);
  const fileIds = new Set((fileData.transactions || []).map(t => t.id));
  const lost = (currentData.transactions || []).filter(t => !fileIds.has(t.id)).length;
  const older = F.last && C.last && F.last < C.last;
  const dfr = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—";
  const mfr = iso => iso ? new Date(iso.slice(0, 7) + "-15").toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "—";
  const Col = ({ title, d, ver, dateLbl, dateVal, accent }) => (
    <div style={{ flex: 1, minWidth: 0, borderRadius: 11, padding: "9px 10px", background: "var(--surface2)", border: `1px solid ${accent ? "rgba(112,184,224,.45)" : "var(--border)"}`, fontSize: ".66rem", lineHeight: 1.75, color: "var(--text2)" }}>
      <div style={{ fontSize: ".55rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 3 }}>{title}</div>
      <div>📅 {dateLbl} <b style={{ color: "var(--text)" }}>{dateVal}</b></div>
      <div>📱 Version {ver || "inconnue"}</div>
      <div>💸 <b style={{ color: "var(--text)" }}>{d.tx}</b> opérations</div>
      <div>🗓️ {mfr(d.first)} → {mfr(d.last)}</div>
      <div>📌 {d.fixes} fixes · 🐷 {d.cags} cagnottes</div>
      <div>🏷️ {d.cats} catégories</div>
    </div>
  );
  return (
    <Modal onClose={onClose} title="📥 Importer cette sauvegarde ?">
      <div style={{ fontSize: ".62rem", color: "var(--text3)", margin: "-10px 0 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <Col title="Le fichier" d={F} ver={F.version} dateLbl="Sauvegardé le" dateVal={F.backup ? dfr(F.backup.slice(0, 10)) : "?"} />
        <Col title="Tes données actuelles" d={C} ver={appVersion} dateLbl="Dernière opération" dateVal={dfr(C.last)} accent />
      </div>
      {lost > 0 ? (
        <div style={{ padding: "9px 11px", borderRadius: 10, fontSize: ".68rem", lineHeight: 1.5, marginBottom: 10, background: "rgba(200,112,112,.1)", border: "1px solid rgba(200,112,112,.4)", color: "var(--text)" }}>
          ⚠️ {older ? <>Ce fichier est <b>plus ancien</b> que tes données : </> : null}<b>{lost} opération{lost > 1 ? "s" : ""}</b> de ton téléphone {lost > 1 ? "ne sont" : "n'est"} pas dans ce fichier et {lost > 1 ? "seront perdues" : "sera perdue"}.
        </div>
      ) : (
        <InfoNote>✅ Toutes les opérations de ton téléphone sont aussi dans ce fichier.</InfoNote>
      )}
      <div onClick={() => setBackupFirst(v => !v)}
        style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 10, borderRadius: 11, marginBottom: 10, cursor: "pointer",
          border: `1.5px solid ${backupFirst ? "var(--accent)" : "var(--border)"}`, background: backupFirst ? "rgba(112,184,224,.08)" : "transparent" }}>
        <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".7rem",
          border: `2px solid ${backupFirst ? "var(--accent)" : "var(--border)"}`, background: backupFirst ? "var(--accent)" : "transparent", color: "#06121c" }}>{backupFirst ? "✓" : ""}</span>
        <div>
          <div style={{ fontSize: ".74rem", fontWeight: 700 }}>Sauvegarder mes données actuelles d'abord</div>
          <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 2 }}>Crée un fichier de secours (partage) avant de remplacer. Si tu l'annules, l'import est annulé.</div>
        </div>
      </div>
      <div className="grid-2" style={{ marginBottom: 0 }}>
        <button className="btn btn-outline" style={{ width: "100%" }} onClick={onClose}>Annuler</button>
        <button className="btn" disabled={busy} style={{ width: "100%", background: "var(--danger)", color: "#fff", opacity: busy ? .5 : 1 }}
          onClick={async () => { setBusy(true); try { await onConfirm(backupFirst); } finally { setBusy(false); } }}>
          {busy ? "…" : "Remplacer"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  ProjectModal — v1.47.0 : projet avec échéance (cagnotte + tag)
//  « __new__ » = créer la cagnotte / le tag au nom du projet.
// ─────────────────────────────────────────────────────────────────
export function ProjectModal({ project = null, cagnottes = [], tags = [], onSave, onClose }) {
  const toast = useToast();
  const [icon, setIcon]   = useState(project?.icon || "");
  const [name, setName]   = useState(project?.name || "");
  const [amt, setAmt]     = useState(toPadStr(project?.target));
  const endOfMonthIn = n => { const d = new Date(); const e = new Date(d.getFullYear(), d.getMonth() + n + 1, 0);
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`; };
  const [deadline, setDeadline] = useState(project?.deadline || endOfMonthIn(12));
  const [cagId, setCagId] = useState(project?.cagId || "__new__");
  const [tagId, setTagId] = useState(project ? (project.tagId || "") : "__new__");
  const [errors, setErrors] = useState({});
  const target = amountOf(amt);
  const cagItems = [{ id: "__new__", icon: "＋", name: "Nouvelle cagnotte" },
    ...cagnottes.map(c => ({ id: c.id, icon: CAG_TYPES.find(t => t.id === c.cagType)?.icon || "🐷", name: c.name, sub: fmt(c.current) }))];
  const tagItems = [{ id: "__new__", icon: "＋", name: "Nouveau tag" }, ...tags.map(t => ({ id: t.id, icon: t.icon, name: t.name }))];
  const savedNow = cagId !== "__new__" ? (parseFloat(cagnottes.find(c => c.id === cagId)?.current) || 0) : 0;
  const months = (() => { const [ty, tm] = (deadline || "").split("-").map(Number); const n = new Date();
    return Math.max(1, (ty - n.getFullYear()) * 12 + (tm - 1 - n.getMonth())); })();
  const perMonth = target > savedNow ? Math.ceil((target - savedNow) / months * 100) / 100 : 0;

  function handleSave() {
    const e = {};
    if (!icon.trim()) e.icon = "Icône requise";
    if (!name.trim()) e.name = "Nom requis";
    if (!amt || isNaN(target) || target <= 0) e.amt = "Objectif requis";
    if (!deadline || deadline <= todayISO()) e.date = "L'échéance doit être dans le futur";
    setErrors(e);
    if (Object.keys(e).length) return;
    const nm = name.trim(), ic = icon.trim();
    const base = {
      id: project?.id || null, icon: ic, name: nm, target, deadline,
      cagId: cagId === "__new__" ? null : cagId,
      tagId: tagId === "__new__" || !tagId ? null : tagId,
      createdAt: project?.createdAt || todayISO(),
      // Point de départ du rythme régulier : ce qui était déjà dans la cagnotte
      startSaved: project ? (project.startSaved || 0) : savedNow,
    };
    onSave({
      project: base,
      newCag: cagId === "__new__" ? { name: nm, current: 0, target, targetDate: deadline, cagType: "projet" } : null,
      newTag: tagId === "__new__" ? { name: nm, icon: ic, color: "#e48bb8" } : null,
    });
    toast(project ? "Projet modifié" : "Projet créé");
  }

  return (
    <Modal onClose={onClose} title={project ? "Modifier le projet" : "Nouveau projet"}>
      <IconNameField icon={icon} name={name} errors={errors} namePlaceholder="Ex : Travaux salle de bain" iconPlaceholder="🛠️"
        onIcon={v => { setIcon(v); setErrors(x => ({ ...x, icon: "" })); }}
        onName={v => { setName(v); setErrors(x => ({ ...x, name: "" })); }} />
      <div style={{ marginBottom: 10 }}>
        {errors.amt && <FieldError msg={errors.amt} />}
        <div style={{ borderRadius: 12, padding: "7px 12px", marginBottom: 8, background: "var(--purple-glow)", border: "1px solid rgba(176,144,224,.3)" }}>
          <div style={{ fontSize: ".55rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--purple)" }}>🎯 Objectif</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: "1.5rem", fontWeight: 800, color: "var(--purple)", lineHeight: 1.2 }}>{amt || "0"} €</div>
        </div>
        <NumPad value={amt} type="income" hideDisplay
          onChange={v => { setAmt(p => typeof v === "function" ? v(p) : v); setErrors(x => ({ ...x, amt: "" })); }} />
      </div>
      <DateField label="Échéance" date={deadline} error={errors.date} min={plusDaysISO(1)}
        onChange={d => { setDeadline(d); setErrors(x => ({ ...x, date: "" })); }}
        shortcuts={[["Dans 6 mois", endOfMonthIn(6)], ["Dans 1 an", endOfMonthIn(12)], ["Dans 2 ans", endOfMonthIn(24)]]} />
      <CategoryField label="Cagnotte (argent mis de côté)" cats={cagItems} catId={cagId} onChange={setCagId} allowNone={false} />
      <CategoryField label="Tag (dépenses du projet)" cats={tagItems} catId={tagId} onChange={setTagId}
        noneLabel="⊘ Pas de suivi des dépenses" emptyLabel="Pas de suivi des dépenses" accentColor="#e48bb8" />
      {target > 0 && <InfoNote color="var(--purple)">💡 À mettre de côté : <b>{fmt(perMonth)} / mois</b> pendant {months} mois{savedNow > 0 ? ` (déjà ${fmt(savedNow)} dans la cagnotte)` : ""}</InfoNote>}
      <FormActions onCancel={onClose} onSave={handleSave} emoji="🎯" />
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  ReimbursementModal — v1.48.0 : remboursement attendu (« à recevoir »)
// ─────────────────────────────────────────────────────────────────
export function ReimbursementModal({ reimbursement = null, onSave, onDelete, onReceive, onClose }) {
  const toast = useToast();
  const r = reimbursement;
  const [amt, setAmt]   = useState(toPadStr(r?.amount));
  const [from, setFrom] = useState(r?.from || "");
  const [note, setNote] = useState(r?.note || "");
  const [date, setDate] = useState(r?.expectedDate || "");
  const [errors, setErrors] = useState({});
  function handleSave() {
    const a = amountOf(amt);
    if (!amt || isNaN(a) || a <= 0) { setErrors({ amt: "Montant requis" }); return; }
    onSave({ id: r?.id || null, amount: a, from: from.trim(), note: note.trim(), expectedDate: date || null, txId: r?.txId || null });
    toast(r ? "Remboursement modifié" : "Remboursement attendu ajouté");
  }
  return (
    <Modal onClose={onClose} title={r ? "↩️ Remboursement attendu" : "↩️ Nouveau remboursement attendu"}>
      <div style={{ marginBottom: 10 }}>
        {errors.amt && <FieldError msg={errors.amt} />}
        <NumPad value={amt} type="income" onChange={v => { setAmt(p => typeof v === "function" ? v(p) : v); setErrors({}); }} />
      </div>
      <TextField label="Par qui" value={from} onChange={setFrom} placeholder="Ex : Mutuelle, Thomas, employeur…" />
      <TextField value={note} onChange={setNote} placeholder="Motif (optionnel)… ex : kiné du 03/10" />
      <DateField label="Attendu vers le (optionnel)" date={date} onChange={setDate}
        shortcuts={[["Aucune", ""], ["Dans 1 sem.", plusDaysISO(7)], ["Dans 1 mois", plusDaysISO(30)]]} />
      <InfoNote>N'entre pas dans le solde tant que l'argent n'est pas arrivé. Quand tu saisis le revenu correspondant, l'app te proposera de le relier.</InfoNote>
      {r && (
        <div className="grid-2" style={{ marginBottom: 10 }}>
          <button className="btn btn-outline" style={{ width: "100%", color: "var(--danger)", borderColor: "rgba(200,112,112,.4)" }} onClick={() => onDelete(r)}>🗑 Supprimer</button>
          <button className="btn" style={{ width: "100%", background: "#5cc8c0", color: "#06201e", fontWeight: 800 }} onClick={() => onReceive(r)}>✓ Reçu</button>
        </div>
      )}
      <FormActions onCancel={onClose} onSave={handleSave} emoji="↩️" />
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
export function DetailModal({ config, transactions, categories, cagnottes, fixedExpenses, fixedIncomes = [], onClose }) {
  const { type, period } = config;
  const now     = new Date();
  const curM    = currentYM();
  const curY    = now.getFullYear().toString();
  // v1.49.1 : mêmes totaux que les cases du Bilan (computePeriodTotals) — avant,
  // les revenus fixes étaient ignorés et les frais fixes comptés pour 1 seul mois
  // même sur l'année. Période = 1ᵉʳ du mois (ou janvier) → mois en cours.
  const fromYM  = period === "year" ? `${curY}-01` : curM;
  const inPeriod = d => { const ym = (d || "").slice(0, 7); return ym >= fromYM && ym <= curM; };
  const totals  = computePeriodTotals(transactions, fixedExpenses, fixedIncomes, fromYM, curM);
  const months  = livedMonths(transactions, fromYM, curM);
  const fixLines = type === "expense" ? fixedLinesForPeriod(fixedExpenses, months, "expense")
                 : type === "income"  ? fixedLinesForPeriod(fixedIncomes,  months, "income")  : [];
  const fixTotal = fixLines.reduce((a, l) => a + l.total, 0);

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
      if (period === "month" || period === "year") { if (!inPeriod(t.date)) return false; }
      if (type === "income")        return t.type === "income";   // v1.53.1 : dissolution de cagnotte exclue
      if (type === "expense")       return t.type === "expense";
      if (type === "expense_var")   return t.type === "expense";
      if (type === "decagnottage")  return t.type === "decagnottage";
      return false;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    total = filtered.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    if (period === "month" || period === "year") {
      if (type === "income")      total = totals.inc;
      if (type === "expense")     total = totals.exp;
      if (type === "expense_var") total = totals.expVar;
    }
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
        {/* v1.49.0 : taux d'épargne du mois (retiré de la carte Accueil devenue compacte) */}
        {type === "cagnottes" && config.extra?.rate != null && (() => {
          const { rate, prevRate } = config.extra;
          const d = prevRate != null ? rate - prevRate : null;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", marginBottom: 10, borderRadius: 10, background: "rgba(176,144,224,.08)", border: "1px solid rgba(176,144,224,.25)", fontSize: ".72rem" }}>
              <span style={{ flex: 1, color: "var(--text2)" }}>🐷 Taux d'épargne ce mois</span>
              <b style={{ color: "var(--purple)", fontVariantNumeric: "tabular-nums" }}>{rate} %</b>
              {d != null && <span style={{ fontSize: ".62rem", fontWeight: 700, color: d >= 0 ? "var(--success)" : "var(--danger)" }}>{d >= 0 ? "▲" : "▼"} {Math.abs(d)} pt vs mois dernier</span>}
            </div>
          );
        })()}
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
            {fixLines.length > 0 && (
              <>
                <div style={{ fontSize: ".65rem", color: "var(--text3)", textTransform: "uppercase", fontWeight: 700, padding: "10px 0 6px", borderBottom: "1px solid var(--border-soft)" }}>
                  Frais fixes — {fmt(fixTotal)}
                </div>
                {fixLines.map((l, i) => {
                  const cat = categories.find(c => c.id === l.f.categoryId);
                  return (
                    <div key={l.f.id || i} className="item-row">
                      <div className="item-icon">{cat?.icon ?? "🔄"}</div>
                      <div className="item-info"><div className="item-title">{l.f.name}</div><div className="item-sub">{period === "year" ? `${l.n} mois × ${fmt(l.total / l.n)}` : "Ce mois"}</div></div>
                      <div className="item-amount type-expense">−{fmt(l.total)}</div>
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

        {type === "income" && fixLines.length > 0 && (
          <>
            <div style={{ fontSize: ".65rem", color: "var(--text3)", textTransform: "uppercase", fontWeight: 700, padding: "10px 0 6px", borderBottom: "1px solid var(--border-soft)" }}>
              Revenus fixes — {fmt(fixTotal)}
            </div>
            {fixLines.map((l, i) => {
                  const cat = categories.find(c => c.id === l.f.categoryId);
                  return (
                    <div key={l.f.id || i} className="item-row">
                      <div className="item-icon">{cat?.icon ?? "🔄"}</div>
                      <div className="item-info"><div className="item-title">{l.f.name}</div><div className="item-sub">{period === "year" ? `${l.n} mois × ${fmt(l.total / l.n)}` : "Ce mois"}</div></div>
                      <div className="item-amount type-income">+{fmt(l.total)}</div>
                    </div>
                  );
                })}
            {items.length > 0 && (
              <div style={{ fontSize: ".65rem", color: "var(--text3)", textTransform: "uppercase", fontWeight: 700, padding: "10px 0 6px", borderBottom: "1px solid var(--border-soft)" }}>
                Autres revenus
              </div>
            )}
          </>
        )}
        {type !== "cagnottes" && type !== "expense" && (
          items.length === 0
            ? (type === "income" && fixLines.length > 0 ? null : <div className="empty-state"><div className="empty-icon">📭</div><p>Aucune opération</p></div>)
            : items.map(t => <ItemRow key={t.id} t={t} categories={categories} cagnottes={cagnottes} />)
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

// ─────────────────────────────────────────────────────────────────
//  QuickTemplateSheet — v1.39.18
//  Saisie rapide d'une opération depuis un template (appui long sur +).
//  Réutilise le vrai NumPad (mêmes touches, mêmes couleurs) : le montant
//  et la date restent à saisir à chaque fois, rien n'est pré-rempli.
// ─────────────────────────────────────────────────────────────────
export function QuickTemplateSheet({ template, categories, sideAmountTypes = [], onSave, onClose }) {
  // v1.45.0 : même ordre que la saisie normale — montant + clavier, date
  // (avec « Autre… » → calendrier), montants à part dans « Options ».
  const [type, setType]     = useState(template.type || "expense");
  const [amount, setAmount] = useState("");
  const [date, setDate]     = useState(todayISO());
  const side = useSideAmounts(null);
  const [err, setErr]       = useState(null);
  const toast = useToast();
  const cat = categories.find(c => c.id === template.categoryId);

  function handleSave() {
    const amt = amountOf(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setErr("Montant requis"); return; }
    const sideAmounts = type === "expense" ? side.toPayload() : undefined;
    onSave({ type, amount: amt, date, categoryId: template.categoryId, note: template.name, sideAmounts });
    toast?.(`${template.icon} ${template.name} enregistré`, "success");
    onClose();
  }

  const chips = type === "expense" ? [...side.open].map(k => {
    const st = sideAmountTypes.find(x => x.id === k); const v = side.vals[k];
    return st && v ? [`${st.icon} ${v} €`, "var(--tr)", "var(--tr-glow)"] : null;
  }).filter(Boolean) : [];

  return (
    <Modal onClose={onClose} title="">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
          {template.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: "1rem" }}>{template.name}</div>
          <div style={{ fontSize: ".64rem", color: "var(--purple)", fontWeight: 600 }}>{cat ? `${cat.icon} ${cat.name}` : "Sans catégorie"}</div>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        {err && <FieldError msg={err} />}
        <NumPad value={amount} type={type} onTypeChange={setType}
          onChange={v => { setAmount(typeof v === "function" ? v(amount) : v); setErr(null); }} />
      </div>

      <DateField date={date} onChange={setDate} />

      {type === "expense" && sideAmountTypes.length > 0 && (
        <OptionsField hint={`${sideAmountTypes.map(x => x.label).join(", ")}…`} chips={chips}>
          {sideAmountTypes.map(st => (
            <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 11, border: "1px solid var(--tr-border)", marginBottom: 7 }}>
              <span style={{ fontSize: ".95rem" }}>{st.icon}</span>
              <span style={{ flex: 1, fontSize: ".74rem", fontWeight: 700, color: "var(--tr)" }}>{st.label}</span>
              <input type="text" inputMode="decimal" placeholder="Montant €" value={side.vals[st.id] || ""}
                onChange={e => { const v = e.target.value; side.setVal(st.id, v); if (v) side.openType(st.id); }}
                style={{ width: 96, boxSizing: "border-box", fontSize: ".75rem", background: "var(--surface3)" }} />
            </div>
          ))}
          <div style={{ fontSize: ".56rem", color: "var(--text3)", margin: "-3px 2px 8px", lineHeight: 1.4 }}>Montants à part : informatifs, n'affectent pas ton solde.</div>
        </OptionsField>
      )}

      <FormActions onCancel={onClose} onSave={handleSave} emoji={type === "expense" ? "💸" : "💰"} />
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  QuickTemplateManagerModal — v1.39.18
//  Créer / modifier / supprimer les templates de saisie rapide.
// ─────────────────────────────────────────────────────────────────
export function QuickTemplateManagerModal({ templates, categories, onSave, onDelete, onClose }) {
  const [editing, setEditing] = useState(null); // null = liste, {} ou tpl = formulaire

  if (editing) {
    return (
      <QuickTemplateFormModal
        tpl={editing}
        categories={categories}
        onSave={tpl => { onSave(tpl); setEditing(null); }}
        onClose={() => setEditing(null)}
      />
    );
  }

  return (
    <Modal onClose={onClose} title="⚡ Templates rapides">
      <div style={{ maxHeight: "55vh", overflowY: "auto", marginBottom: 12 }}>
        {templates.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">⚡</div><p>Aucun template pour l'instant</p></div>
        ) : templates.map(t => {
          const cat = categories.find(c => c.id === t.categoryId);
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 4px", borderBottom: "1px solid rgba(210,225,245,.08)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>{t.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: ".75rem", fontWeight: 700 }}>{t.name}</div>
                <div style={{ fontSize: ".6rem", color: "var(--text2)" }}>{cat?.name || "—"} · {t.type === "income" ? "Revenu" : "Dépense"}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setEditing(t)} style={{ width: 26, height: 26, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", fontSize: ".65rem", cursor: "pointer" }}>✏️</button>
                <button onClick={() => onDelete(t.id)} style={{ width: 26, height: 26, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", fontSize: ".65rem", cursor: "pointer" }}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={() => setEditing({})} style={{
        width: "100%", padding: 11, borderRadius: 12, border: "1.5px dashed var(--border)",
        background: "none", color: "var(--text2)", fontSize: ".72rem", fontWeight: 700, cursor: "pointer",
      }}>
        ＋ Nouveau template
      </button>
    </Modal>
  );
}

function QuickTemplateFormModal({ tpl, categories, onSave, onClose }) {
  // v1.45.0 : même présentation que « Nouvelle catégorie » + menu des catégories
  const isEdit = !!tpl.id;
  const [name, setName]     = useState(tpl.name || "");
  const [icon, setIcon]     = useState(tpl.icon || "");
  const [type, setType]     = useState(tpl.type || "expense");
  const [categoryId, setCategoryId] = useState(tpl.categoryId || "");
  const [err, setErr]       = useState({});

  const cats = categories.filter(c => c.type === type || !c.type);

  function handleSave() {
    const e = {};
    if (!icon.trim()) e.icon = "Icône requise";
    if (!name.trim()) e.name = "Nom requis";
    if (!categoryId)  e.cat  = "Catégorie requise";
    setErr(e);
    if (Object.keys(e).length > 0) return;
    onSave({ id: tpl.id || null, name: name.trim(), icon: icon.trim(), type, categoryId });
  }

  return (
    <Modal onClose={onClose} title={isEdit ? "Modifier le template" : "Nouveau template"}>
      <TypeButtons value={type} onChange={k => { if (k !== type) { setType(k); setCategoryId(""); } }} options={[
        { k: "expense", emoji: "💸", label: "Dépense", color: "var(--danger)"  },
        { k: "income",  emoji: "💰", label: "Revenu",  color: "var(--success)" },
      ]} />
      <IconNameField icon={icon} name={name} errors={err} namePlaceholder="Ex : Courses" iconPlaceholder="🛒"
        onIcon={v => { setIcon(v); setErr(x => ({ ...x, icon: "" })); }}
        onName={v => { setName(v); setErr(x => ({ ...x, name: "" })); }} />
      <CategoryField cats={cats} catId={categoryId} allowNone={false} emptyLabel="Choisir une catégorie" error={err.cat}
        onChange={id => { setCategoryId(id); setErr(x => ({ ...x, cat: "" })); }} />
      <FormActions onCancel={onClose} onSave={handleSave} emoji="⚡" />
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  OffAccountModal — v1.42.0
//  Dépense payée 100 % hors compte (tickets resto…) ou rechargement
//  d'un porte-monnaie. Enregistrée dans offAccountEntries, liste séparée
//  des transactions : n'impacte AUCUN calcul bancaire.
// ─────────────────────────────────────────────────────────────────
function evalAmount(str) {
  const tokens = String(str || "").replace(/,/g, ".").match(/(\d+\.?\d*|\+|-)/g);
  if (!tokens) return NaN;
  let r = parseFloat(tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) {
    const n = parseFloat(tokens[i + 1]); if (isNaN(n)) break;
    r = tokens[i] === "+" ? r + n : r - n;
  }
  return r;
}

export function OffAccountModal({ mode = "expense", entry = null, defaultSatId, sideAmountTypes = [], categories = [], onSave, onDelete, onClose }) {
  // v1.44.3 : même présentation que la saisie d'une dépense (boutons du haut,
  // montant + clavier, catégorie en menu déroulant, date, note, boutons du bas)
  const isRecharge = (entry?.kind || mode) === "recharge";
  const types = isRecharge ? sideAmountTypes.filter(st => st.trackBalance) : sideAmountTypes;
  const [satId,  setSatId]  = useState(entry?.satId || defaultSatId || types[0]?.id || "");
  const [amount, setAmount] = useState(entry ? String(Math.abs(entry.amount)).replace(".", ",") : "");
  const [date,   setDate]   = useState(entry?.date || todayISO());
  const [catId,  setCatId]  = useState(entry?.categoryId || "");
  const [note,   setNote]   = useState(entry?.note || "");
  const [confirmDel, setConfirmDel] = useState(false);
  // Rechargement négatif = correction de solde (le clavier n'accepte pas de « − » initial)
  const [neg,    setNeg]    = useState(entry?.kind === "recharge" && entry.amount < 0);
  const [errors, setErrors] = useState({});
  const toast = useToast();

  const cats = categories.filter(c => c.type === "expense" || !c.type);
  const st = sideAmountTypes.find(s => s.id === satId);
  const accent = isRecharge ? (neg ? "var(--danger)" : "var(--success)") : "var(--tr)";

  function handleSave() {
    const raw = evalAmount(amount);
    const e = {};
    if (!satId) e.sat = isRecharge ? "Active « Suivre le solde » sur un type dans Options → Montants à part" : "Crée d'abord un type dans Options → Montants à part";
    if (isNaN(raw) || raw <= 0) e.amount = "Montant requis";
    if (!isRecharge && !catId) e.cat = "Choisis une catégorie";
    setErrors(e);
    if (Object.keys(e).length) return;
    const a = isRecharge && neg ? -raw : raw;
    onSave({
      ...(entry ? { id: entry.id } : {}),
      kind: isRecharge ? "recharge" : "expense",
      satId, amount: Math.round(a * 100) / 100, date,
      categoryId: isRecharge ? null : catId,
      note: note.trim(),
    });
    toast?.(isRecharge ? `${st?.icon || "💳"} Rechargement enregistré` : `${st?.icon || "🎫"} Dépense hors compte enregistrée`, "success");
    onClose();
  }

  const title = entry
    ? (isRecharge ? "Modifier le rechargement" : "Modifier la dépense hors compte")
    : (isRecharge ? `💳 Rechargement ${st?.label || ""}` : "🎫 Dépense hors compte");

  return (
    <Modal onClose={onClose} title={title}>

      {/* ── « Payé avec » : même style que les boutons de type de la saisie ── */}
      {types.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(Math.max(types.length, 2), 4)}, 1fr)`, gap: 6, marginBottom: 10 }}>
          {types.map(t => {
            const sel = satId === t.id;
            return (
              <button key={t.id}
                onTouchStart={e => e.stopPropagation()}
                onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); setSatId(t.id); setErrors(v => ({ ...v, sat: "" })); }}
                onClick={() => { if (!('ontouchstart' in window)) { setSatId(t.id); setErrors(v => ({ ...v, sat: "" })); } }}
                style={{
                  padding: "7px 2px 6px", borderRadius: "var(--radius)",
                  border: `1.5px solid ${sel ? "var(--tr)" : "var(--border)"}`,
                  background: sel ? "var(--tr-glow)" : "var(--surface2)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  cursor: "pointer", touchAction: "manipulation",
                }}>
                <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{t.icon}</span>
                <span style={{ fontSize: ".6rem", fontWeight: 700, color: sel ? "var(--tr)" : "var(--text3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", padding: "0 3px" }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {errors.sat && <FieldError msg={errors.sat} />}

      {/* ── Rechargement : sens (ajout / correction) ── */}
      {isRecharge && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
          {[[false, "＋ Rechargement", "var(--success)"], [true, "－ Correction", "var(--danger)"]].map(([v, l, c]) => (
            <button key={l}
              onTouchStart={e => e.stopPropagation()}
              onTouchEnd={e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); setNeg(v); }}
              onClick={() => { if (!('ontouchstart' in window)) setNeg(v); }}
              style={{
                padding: "7px 4px", borderRadius: 20, fontSize: ".68rem", fontWeight: 700, cursor: "pointer", touchAction: "manipulation",
                border: `1.5px solid ${neg === v ? c : "var(--border)"}`, color: neg === v ? c : "var(--text2)",
                background: neg === v ? `color-mix(in srgb, ${c} 14%, var(--surface2))` : "var(--surface2)",
              }}>{l}</button>
          ))}
        </div>
      )}

      {/* ── Montant + clavier de l'app ── */}
      <div style={{ marginBottom: 10 }}>
        {errors.amount && <FieldError msg={errors.amount} />}
        <NumPad value={amount}
          onChange={val => { setAmount(typeof val === "function" ? val(amount) : val); setErrors(v => ({ ...v, amount: "" })); }}
          type={isRecharge && !neg ? "income" : "expense"} variant={isRecharge ? "recharge" : "tr"} />
      </div>

      {/* ── Catégorie : même menu déroulant que la saisie d'une dépense ── */}
      {!isRecharge && (
        <>
          {errors.cat && <FieldError msg={errors.cat} />}
          <CategoryField cats={cats} catId={catId} accentColor="var(--tr)"
            onChange={id => { setCatId(id); setErrors(v => ({ ...v, cat: "" })); }} />
        </>
      )}

      {/* ── Date : boutons + « Autre… » → calendrier ── */}
      <DateField date={date} onChange={setDate} />

      {/* ── Note ── */}
      <div style={{ marginBottom: 10 }}>
        <input type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder={isRecharge ? (neg ? "Ex : écart avec la carte…" : "Ex : septembre — 23 jours × 8 €") : "Note (optionnel)…"}
          style={{ width: "100%", boxSizing: "border-box", borderLeft: "3px solid #8a98a8", background: "rgba(255,255,255,.03)" }} />
      </div>

      {isRecharge && neg && <div style={{ fontSize: ".6rem", color: "var(--text3)", margin: "-4px 0 10px", lineHeight: 1.5 }}>La correction retire ce montant du solde, sans compter comme une dépense.</div>}
      {!isRecharge && <div style={{ fontSize: ".6rem", color: "var(--text3)", margin: "-4px 0 10px", lineHeight: 1.5 }}>Hors compte : n'affecte ni ton solde bancaire ni le rapprochement.</div>}

      {/* ── Boutons Annuler / Enregistrer (comme la saisie) ── */}
      <div className="grid-2" style={{ marginBottom: 0 }}>
        <button className="btn btn-outline" style={{ width: "100%" }} onClick={onClose}>Annuler</button>
        <button className="btn" onClick={handleSave} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          background: accent, color: isRecharge && !neg ? "#06121c" : "#1a1405", border: "none", fontWeight: 800,
        }}>
          <span>{isRecharge ? "💳" : (st?.icon || "🎫")}</span><span>Enregistrer</span>
        </button>
      </div>

      {entry && onDelete && (
        confirmDel ? (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => setConfirmDel(false)} style={{ flex: 1, padding: 10, borderRadius: 10, background: "transparent", border: "1px solid var(--border)", color: "var(--text2)", fontWeight: 700, cursor: "pointer" }}>Annuler</button>
            <button type="button" onClick={() => { onDelete(entry.id); onClose(); }} style={{ flex: 1, padding: 10, borderRadius: 10, background: "var(--danger)", border: "none", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Supprimer</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDel(true)} style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 10, background: "transparent", border: "1px solid rgba(200,112,112,.35)", color: "var(--danger)", fontWeight: 700, cursor: "pointer" }}>🗑 Supprimer</button>
        )
      )}
    </Modal>
  );
}
