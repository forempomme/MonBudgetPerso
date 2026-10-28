// ─────────────────────────────────────────────────────────────────
//  v1.76.0 — Gestion des catégories en grille (Options › Catégories)
//  • Onglets Dépenses / Revenus + recherche, collés en haut de la feuille
//  • Grille 4 colonnes des catégories principales (badge = nb de sous-cat.,
//    📌 = contient des frais/revenus fixes, point orange = jamais utilisée)
//  • Toucher une tuile → barre d'actions collée en bas : frais fixes rangés
//    ici (pastilles → ouvrent le frais), sous-catégories (pastilles →
//    sélection), puis Sous-cat. · Déplacer (v1.77.0) · Modifier · Lier · Supprimer
//  • Recherche : toutes les catégories (sous-catégories comprises) à plat
// ─────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect } from "react";
import { fmt, currentYM, fixedAmountFor, touchMoved } from "../utils.js";
import { Modal } from "../components/index.jsx";

const AZ = (a, b) => (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" });
const norm = x => (x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const FIX_COL = "#e8944a";

export function CategoryManager({ data, onNewCat, onEditCat, onDeleteCat, onOpenLinks, onEditFixed, onEditFixedIncome, onMoveCat, onRestoreParents, onArchiveCat }) {
  const [tab, setTab] = useState("expense");
  const [q, setQ]     = useState("");
  const [sel, setSel] = useState(null);
  const [mv, setMv]   = useState(null);     // v1.77.0 : { id, target: null | "__top" | catId, kidsMode }
  const [undo, setUndo] = useState(null);   // { label, parents: { id: parentId|null } }
  const [showArch, setShowArch] = useState(false); // v1.79.0 : section « Archivées » dépliée
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 6000); return () => clearTimeout(t); }, [undo]);
  const cats = data.categories || [];
  const ym = currentYM();

  // Usage par catégorie : opérations + éléments récurrents (fixes, récurrentes, programmées, modèles)
  const usage = useMemo(() => {
    const ops = {}, other = {}, fixes = {};
    (data.transactions || []).forEach(t => { if (t.categoryId) ops[t.categoryId] = (ops[t.categoryId] || 0) + 1; });
    [data.recurringTemplates, data.scheduledTransactions, data.quickTemplates, data.offAccountEntries, data.provisionalExpenses]
      .forEach(list => (list || []).forEach(x => { if (x.categoryId) other[x.categoryId] = (other[x.categoryId] || 0) + 1; }));
    (data.fixedExpenses || []).forEach((f, idx) => { if (f.categoryId) (fixes[f.categoryId] = fixes[f.categoryId] || []).push({ f, idx, kind: "expense" }); });
    (data.fixedIncomes || []).forEach((f, idx) => { if (f.categoryId) (fixes[f.categoryId] = fixes[f.categoryId] || []).push({ f, idx, kind: "income" }); });
    return { ops, other, fixes };
  }, [data.transactions, data.recurringTemplates, data.scheduledTransactions, data.quickTemplates, data.offAccountEntries, data.provisionalExpenses, data.fixedExpenses, data.fixedIncomes]);

  const isTop = c => !c.parentId || !cats.some(p => p.id === c.parentId);
  const kids  = id => cats.filter(c => c.parentId === id).sort(AZ);
  const liveKids = id => kids(id).filter(k => !k.archived);
  const family = c => isTop(c) ? [c, ...kids(c.id)] : [c];
  const opsOf   = c => family(c).reduce((s, x) => s + (usage.ops[x.id] || 0), 0);
  const fixesOf = c => family(c).flatMap(x => usage.fixes[x.id] || []);
  const unused  = c => family(c).every(x => !usage.ops[x.id] && !usage.other[x.id] && !(usage.fixes[x.id] || []).length);
  const tint = c => c.color || (c.type === "income" ? "var(--success)" : "var(--danger)");

  const nType = t => cats.filter(c => c.type === t).length;
  const shown = q.trim()
    ? cats.filter(c => c.type === tab && norm(c.name).includes(norm(q.trim()))).sort(AZ)
    : cats.filter(c => c.type === tab && isTop(c) && !c.archived).sort(AZ);
  // v1.79.0 : catégories archivées (absentes des choix de saisie, historique conservé)
  const archived = cats.filter(c => c.type === tab && c.archived).sort(AZ);
  const selCat = cats.find(c => c.id === sel) || null;

  const tile = c => {
    const sub = !isTop(c);
    const nk = sub ? 0 : liveKids(c.id).length;
    const on = sel === c.id;
    const fx = fixesOf(c).length > 0;
    return (
      <div key={c.id} data-cat={c.id} role="button" onClick={() => setSel(on ? null : c.id)}
        style={{ position: "relative", borderRadius: 13, padding: "8px 3px 6px", textAlign: "center", cursor: "pointer", minWidth: 0, touchAction: "manipulation",
          background: on ? "color-mix(in srgb, var(--accent) 12%, var(--surface))" : sub || c.archived ? "transparent" : "var(--surface)",
          opacity: c.archived && !on ? .5 : 1,
          border: `1px ${sub || c.archived ? "dashed" : "solid"} ${on ? "var(--accent)" : "var(--border)"}`, boxShadow: on ? "0 0 0 1px var(--accent)" : "none" }}>
        {c.archived && <span data-testid="cat-archived" style={{ position: "absolute", bottom: 3, left: 4, fontSize: ".55rem" }}>🗄</span>}
        {fx && <span data-testid="cat-has-fix" style={{ position: "absolute", top: 3, left: 4, fontSize: ".6rem" }}>📌</span>}
        {!fx && unused(c) && <i data-testid="cat-unused" title="jamais utilisée" style={{ position: "absolute", top: 6, left: 6, width: 7, height: 7, borderRadius: "50%", background: "var(--warning)" }} />}
        {c.linkedToId && cats.some(x => x.id === c.linkedToId) && <span data-testid="cat-linked" title="catégorie liée" style={{ position: "absolute", bottom: 3, right: 4, fontSize: ".55rem" }}>🔗</span>}
        {nk > 0 && <span style={{ position: "absolute", top: 4, right: 4, fontSize: ".5rem", fontWeight: 900, minWidth: 16, height: 16, borderRadius: 8, padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface3)", color: "var(--text2)", border: "1px solid var(--border)", boxSizing: "border-box" }}>{nk}</span>}
        <div style={{ width: sub ? 28 : 34, height: sub ? 28 : 34, borderRadius: 10, margin: "0 auto 4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: sub ? ".9rem" : "1.1rem", background: `color-mix(in srgb, ${tint(c)} 18%, transparent)` }}>{c.icon}</div>
        <div style={{ fontSize: ".6rem", fontWeight: 700, lineHeight: 1.2, height: "2.4em", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word" }}>{c.name}</div>
      </div>
    );
  };

  const chip = (key, content, onClick, fix, testid) => (
    <span key={key} role="button" data-testid={testid} onClick={onClick}
      style={{ flexShrink: 0, fontSize: ".64rem", fontWeight: 700, padding: "5px 9px", borderRadius: 12, cursor: "pointer", whiteSpace: "nowrap", touchAction: "manipulation",
        background: fix ? `color-mix(in srgb, ${FIX_COL} 12%, transparent)` : "var(--surface2)",
        border: `1px solid ${fix ? `color-mix(in srgb, ${FIX_COL} 55%, transparent)` : "var(--border)"}` }}>{content}</span>
  );
  const lbl = (txt, col) => <div style={{ fontSize: ".52rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: col || "var(--text3)", margin: "0 2px 4px" }}>{txt}</div>;
  const strip = children => <div style={{ display: "flex", gap: 5, overflowX: "auto", marginBottom: 8, scrollbarWidth: "none" }}>{children}</div>;
  const act = (k, icon, label, onClick, opts = {}) => (
    <button key={k} data-act={k} disabled={opts.disabled} onClick={onClick}
      onTouchStart={opts.touch ? e => e.stopPropagation() : undefined}
      onTouchEnd={opts.touch ? e => { e.stopPropagation(); if (touchMoved()) return; e.preventDefault(); onClick(); } : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "7px 0", borderRadius: 11, cursor: opts.disabled ? "default" : "pointer", opacity: opts.disabled ? .35 : 1, touchAction: "manipulation", fontFamily: "inherit",
        background: opts.hl ? "color-mix(in srgb, var(--accent) 14%, var(--surface2))" : "var(--surface2)",
        border: `1px solid ${opts.danger ? "color-mix(in srgb, var(--danger) 45%, transparent)" : opts.hl ? "var(--accent)" : "var(--border)"}`, color: "var(--text)", fontSize: ".95rem" }}>
      {icon}<small style={{ fontSize: ".54rem", fontWeight: 800, color: opts.danger ? "var(--danger)" : opts.hl ? "var(--accent)" : "var(--text2)" }}>{label}</small>
    </button>
  );

  const bar = () => {
    if (!selCat) return null;
    const c = selCat, top = isTop(c);
    const par = top ? null : cats.find(p => p.id === c.parentId);
    const ks = top ? liveKids(c.id) : [];
    const fx = fixesOf(c);
    const n = opsOf(c);
    const sibs = par ? liveKids(par.id).filter(k => k.id !== c.id) : [];
    const recUse = (data.recurringTemplates || []).filter(r => family(c).some(x => x.id === r.categoryId)).length;
    const linkedTo = c.linkedToId ? cats.find(x => x.id === c.linkedToId) : null;
    const acts = c.archived ? [
      act("unarch", "♻️", "Réactiver", () => { onArchiveCat?.(c.id, false); }, { hl: true }),
      act("edit", "✏️", "Modifier", () => onEditCat?.(c.id)),
      act("del", "🗑", "Supprimer", () => onDeleteCat?.(c.id), { danger: true, touch: true }),
    ] : [
      act("sub", "＋", "Sous-cat.", () => onNewCat?.(c.id), { disabled: !top }),
      onMoveCat ? act("move", "↔", "Déplacer", () => setMv({ id: c.id, target: null, kidsMode: "with" }), { hl: true }) : null,
      act("edit", "✏️", "Modifier", () => onEditCat?.(c.id)),
      act("link", "🔗", "Lier", () => onOpenLinks?.()),
      onArchiveCat ? act("arch", "🗄", "Archiver", () => { onArchiveCat(c.id, true); setShowArch(true); }) : null,
      act("del", "🗑", "Supprimer", () => onDeleteCat?.(c.id), { danger: true, touch: true }),
    ].filter(Boolean);
    return (
      <div data-testid="cat-actions" style={{ position: "sticky", bottom: -14, zIndex: 2, margin: "10px -14px -14px", padding: "9px 12px 12px", borderRadius: "0 0 21px 21px", background: "var(--fab-menu-bg, var(--surface2))", borderTop: "1px solid var(--accent)", boxShadow: "0 -10px 24px rgba(0,0,0,.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".95rem", flexShrink: 0, background: `color-mix(in srgb, ${tint(c)} 18%, transparent)` }}>{c.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ display: "block", fontSize: ".8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</b>
            <div data-testid="cat-sel-info" style={{ fontSize: ".58rem", color: "var(--text2)" }}>
              {c.archived && <><b style={{ color: "var(--warning)" }}>🗄 archivée</b> · </>}
              {par && <>sous-catégorie de {par.icon} {par.name} · </>}
              {n ? `${n} opération${n > 1 ? "s" : ""}` : (unused(c) ? <span style={{ color: "var(--warning)", fontWeight: 700 }}>jamais utilisée</span> : "aucune opération")}
              {fx.length > 0 && <> · <b style={{ color: FIX_COL }}>{fx.length} {c.type === "income" ? "revenu" : "frais"} fixe{fx.length > 1 ? "s" : ""}</b></>}
              {ks.length > 0 && <> · {ks.length} sous-cat.</>}
              {linkedTo && <> · <span style={{ color: "var(--accent)", fontWeight: 700 }}>🔗 liée à {linkedTo.icon} {linkedTo.name}</span></>}
            </div>
          </div>
          <button onClick={() => setSel(null)} aria-label="Fermer" style={{ width: 30, height: 30, flexShrink: 0, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text2)", cursor: "pointer" }}>✕</button>
        </div>
        {fx.length > 0 && <>
          {lbl(`📌 ${c.type === "income" ? "Revenus" : "Frais"} fixes rangés ici`, FIX_COL)}
          {strip(fx.map(({ f, idx, kind }) => chip(`${kind}${idx}`, <>{f.name} <b style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(fixedAmountFor(f, ym))}</b></>,
            () => (kind === "income" ? onEditFixedIncome : onEditFixed)?.(idx), true, "cat-fix-chip")))}
        </>}
        {ks.length > 0 && <>{lbl("Sous-catégories")}{strip(ks.map(k => chip(k.id, <>{k.icon} {k.name}{unused(k) ? <b style={{ color: "var(--warning)" }}> ●</b> : null}</>, () => setSel(k.id), false, "cat-sub-chip")))}</>}
        {par && strip([chip(par.id, <>‹ {par.icon} {par.name}</>, () => setSel(par.id), false, "cat-parent-chip"), ...sibs.map(k => chip(k.id, <>{k.icon} {k.name}</>, () => setSel(k.id), false))])}
        {!c.archived && onArchiveCat && (fx.length > 0 || recUse > 0) && (
          <div data-testid="arch-warn" style={{ fontSize: ".58rem", color: "var(--warning)", margin: "-2px 2px 7px", lineHeight: 1.4 }}>
            ⚠️ Utilisée par {[fx.length ? `${fx.length} frais/revenu${fx.length > 1 ? "s" : ""} fixe${fx.length > 1 ? "s" : ""}` : null, recUse ? `${recUse} récurrente${recUse > 1 ? "s" : ""}` : null].filter(Boolean).join(" et ")} : si tu l'archives, ils continuent de fonctionner.
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${acts.length}, 1fr)`, gap: 5 }}>{acts}</div>
      </div>
    );
  };

  // ── v1.77.0 : fenêtre « Déplacer »
  const moveModal = () => {
    const c = mv && cats.find(x => x.id === mv.id);
    if (!c) return null;
    const top = isTop(c);
    const par = top ? null : cats.find(p => p.id === c.parentId);
    const ks = top ? kids(c.id) : [];
    const targets = cats.filter(x => x.type === c.type && isTop(x) && !x.archived && x.id !== c.id && x.id !== c.parentId).sort(AZ);
    const T = mv.target && mv.target !== "__top" ? cats.find(x => x.id === mv.target) : null;
    const optSt = on => ({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 11px", borderRadius: 12, marginBottom: 6, cursor: "pointer", fontSize: ".7rem", touchAction: "manipulation",
      background: on ? "color-mix(in srgb, var(--accent) 12%, var(--surface2))" : "var(--surface2)", border: `1px solid ${on ? "var(--accent)" : "var(--border)"}` });
    const doMove = () => {
      if (!mv.target) return;
      const parents = {};
      [c, ...ks].forEach(x => { parents[x.id] = x.parentId && cats.some(p => p.id === x.parentId) ? x.parentId : null; });
      onMoveCat({ id: c.id, targetId: T ? T.id : null, kidsMode: mv.kidsMode });
      setUndo({ label: `${c.icon} ${c.name} ${T ? `rangée dans ${T.icon} ${T.name}` : "devenue catégorie principale"}`, parents });
      setMv(null); setQ(""); setSel(c.id);
    };
    return (
      <Modal onClose={() => setMv(null)} title="">
        <div data-testid="cat-move">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${tint(c)} 18%, transparent)` }}>{c.icon}</span>
            <b style={{ flex: 1, fontSize: ".95rem" }}>Déplacer « {c.name} »</b>
            <button onClick={() => setMv(null)} aria-label="Fermer" style={{ width: 30, height: 30, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text2)", cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ fontSize: ".62rem", color: "var(--text2)", marginBottom: 10 }}>
            Aujourd'hui : {par ? <>sous-catégorie de {par.icon} {par.name}</> : "catégorie principale"}{ks.length ? ` · ${ks.length} sous-catégorie${ks.length > 1 ? "s" : ""}` : ""}
          </div>
          {par && (
            <div data-testid="move-top" role="button" onClick={() => setMv({ ...mv, target: "__top" })} style={optSt(mv.target === "__top")}>
              <span>⬆️ <b>En faire une catégorie principale</b></span><span>{mv.target === "__top" ? "✓" : ""}</span>
            </div>
          )}
          {lbl(par ? "Ou la ranger dans…" : "La ranger dans…", "var(--accent)")}
          {targets.length === 0
            ? <div style={{ fontSize: ".66rem", color: "var(--text3)", padding: "6px 2px" }}>Aucune autre catégorie principale de ce type.</div>
            : <div data-testid="move-targets" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 5, maxHeight: 230, overflowY: "auto" }}>
                {targets.map(t => {
                  const on = mv.target === t.id;
                  return (
                    <div key={t.id} data-target={t.id} role="button" onClick={() => setMv({ ...mv, target: t.id })}
                      style={{ borderRadius: 11, padding: "6px 2px 4px", textAlign: "center", cursor: "pointer", minWidth: 0, touchAction: "manipulation",
                        background: on ? "color-mix(in srgb, var(--accent) 14%, var(--surface))" : "var(--surface)", border: `1px solid ${on ? "var(--accent)" : "var(--border)"}` }}>
                      <div style={{ width: 28, height: 28, borderRadius: 9, margin: "0 auto 3px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".9rem", background: `color-mix(in srgb, ${tint(t)} 18%, transparent)` }}>{t.icon}</div>
                      <div style={{ fontSize: ".52rem", fontWeight: 700, lineHeight: 1.2, height: "2.4em", overflow: "hidden", wordBreak: "break-word" }}>{t.name}</div>
                    </div>
                  );
                })}
              </div>}
          {T && ks.length > 0 && <>
            <div style={{ height: 10 }} />
            {lbl(`Ses ${ks.length} sous-catégorie${ks.length > 1 ? "s" : ""} (${ks.map(k => k.name).join(", ")})`)}
            <div data-testid="move-kids-with" role="button" onClick={() => setMv({ ...mv, kidsMode: "with" })} style={optSt(mv.kidsMode === "with")}>
              <span>Les emmener : elles deviennent sous-catégories de {T.icon} {T.name}</span><span>{mv.kidsMode === "with" ? "✓" : ""}</span>
            </div>
            <div data-testid="move-kids-free" role="button" onClick={() => setMv({ ...mv, kidsMode: "free" })} style={optSt(mv.kidsMode === "free")}>
              <span>Les laisser : elles deviennent catégories principales</span><span>{mv.kidsMode === "free" ? "✓" : ""}</span>
            </div>
          </>}
          {mv.target && (
            <div data-testid="move-result" style={{ fontSize: ".64rem", lineHeight: 1.5, padding: "9px 11px", borderRadius: 12, marginTop: 8, color: "var(--text)",
              background: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" }}>
              Résultat : <b>{T ? `${T.icon} ${T.name} › ${c.icon} ${c.name}` : `${c.icon} ${c.name}`}</b>{T && ks.length && mv.kidsMode === "with" ? ` (+ ${ks.length} sous-cat.)` : ""}<br />
              <span style={{ color: "var(--text2)" }}>Ses opérations, frais fixes et budgets restent attachés à {c.name}. Dans le Rapport, elle comptera {T ? `dans ${T.name}` : "à part"}.</span>
            </div>
          )}
          <div className="grid-2" style={{ marginTop: 12, marginBottom: 0 }}>
            <button className="btn btn-outline" style={{ width: "100%" }} onClick={() => setMv(null)}>Annuler</button>
            <button className="btn btn-primary" data-testid="move-ok" disabled={!mv.target} style={{ width: "100%", opacity: mv.target ? 1 : .45 }} onClick={doMove}>↔ Déplacer</button>
          </div>
        </div>
      </Modal>
    );
  };

  return (
    <div data-testid="cat-manager">
      {/* En-tête collé en haut : recherche + créer + onglets */}
      <div style={{ position: "sticky", top: -14, zIndex: 2, background: "var(--sheet-bg, var(--bg))", margin: "-2px -14px 0", padding: "2px 14px 8px" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, borderRadius: 12, padding: "8px 11px", background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <span>🔍</span>
            <input data-testid="cat-search" value={q} onChange={e => { setQ(e.target.value); setSel(null); }} placeholder="Rechercher une catégorie…"
              style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: ".78rem", fontFamily: "inherit" }} />
            {q && <span onClick={() => setQ("")} style={{ color: "var(--text3)", cursor: "pointer" }}>✕</span>}
          </div>
          <button data-testid="cat-create" onClick={() => onNewCat?.()} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--btn-pri-bg, var(--accent))", border: "1px solid var(--btn-pri-border, var(--accent))", borderRadius: 12, padding: "9px 12px", color: "var(--btn-pri-text, var(--bg))", fontWeight: 800, fontSize: ".72rem", cursor: "pointer", flexShrink: 0, touchAction: "manipulation" }}>＋ Créer</button>
        </div>
        <div data-testid="cat-tabs" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 3, borderRadius: 13, background: "var(--surface2)", border: "1px solid var(--border)", marginTop: 8 }}>
          {[["expense", "💸 Dépenses", "var(--danger)"], ["income", "💰 Revenus", "var(--success)"]].map(([k, l, col]) => {
            const on = tab === k;
            return (
              <span key={k} role="button" data-tab={k} onClick={() => { setTab(k); setSel(null); }}
                style={{ textAlign: "center", padding: "7px 0", borderRadius: 10, fontSize: ".7rem", fontWeight: 800, cursor: "pointer", touchAction: "manipulation",
                  color: on ? col : "var(--text2)", background: on ? `color-mix(in srgb, ${col} 18%, transparent)` : "transparent",
                  boxShadow: on ? `inset 0 0 0 1px color-mix(in srgb, ${col} 50%, transparent)` : "none" }}>{l} · {nType(k)}</span>
            );
          })}
        </div>
        {undo && (
          <div data-testid="move-undo" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "7px 10px", borderRadius: 11, fontSize: ".64rem",
            background: "color-mix(in srgb, var(--accent) 12%, var(--surface2))", border: "1px solid var(--accent)" }}>
            <span style={{ flex: 1, minWidth: 0 }}>↔ {undo.label}</span>
            <button data-testid="move-undo-btn" onClick={() => { onRestoreParents?.(undo.parents); setUndo(null); }}
              style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 800, textDecoration: "underline", cursor: "pointer", fontSize: ".66rem" }}>Annuler</button>
          </div>
        )}
      </div>

      {shown.length === 0
        ? <div style={{ fontSize: ".7rem", color: "var(--text3)", textAlign: "center", padding: "24px 0" }}>{q ? "Aucune catégorie trouvée" : "Aucune catégorie — touche « ＋ Créer »"}</div>
        : <div data-testid="cat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6, marginTop: 4 }}>{shown.map(tile)}</div>}
      <div style={{ fontSize: ".56rem", color: "var(--text3)", textAlign: "center", margin: "9px 4px 0" }}>
        Rangées de A à Z · 📌 = contient des fixes · 🔗 = liée · <span style={{ color: "var(--warning)" }}>●</span> = jamais utilisée · toucher pour agir
      </div>
      {/* v1.79.0 : catégories archivées, section repliée */}
      {!q.trim() && archived.length > 0 && <>
        <div data-testid="arch-toggle" role="button" onClick={() => setShowArch(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".56rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "12px 2px 6px", cursor: "pointer" }}>
          {showArch ? "▾" : "▸"} 🗄 Archivées ({archived.length})
          <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>· absentes des saisies, historique gardé</span>
        </div>
        {showArch && <div data-testid="arch-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>{archived.map(tile)}</div>}
      </>}
      {bar()}
      {moveModal()}
    </div>
  );
}
