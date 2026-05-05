import { useState } from "react";
import { Modal, ItemRow } from "./index.jsx";
import { fmt, uid, todayISO, isIncome, MONTHS_SHORT } from "../utils.js";
import { useToast } from "../context.js";
import { useTotalFixes } from "../hooks.js";

// ─── Shared field-error display ──────────────────────────────────
function FieldError({ msg }) {
  if (!msg) return null;
  return <div className="field-error">⚠ {msg}</div>;
}

// ─── Field wrapper ───────────────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
      <FieldError msg={error} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Transaction modal
// ─────────────────────────────────────────────────────────────────
export function TransModal({ transactions, categories, cagnottes, editingId, onSave, onClose }) {
  const toast = useToast();
  const tx    = editingId ? transactions.find(t => t.id === editingId) : null;

  const [type,   setType]   = useState(tx?.type        || "expense");
  const [amount, setAmount] = useState(tx?.amount       || "");
  const [date,   setDate]   = useState(tx?.date         || todayISO());
  const [catId,  setCatId]  = useState(tx?.categoryId   || "");
  const [cagId,  setCagId]  = useState(tx?.targetCagId  || cagnottes[0]?.id || "");
  const [note,   setNote]   = useState(tx?.note         || "");
  const [errors, setErrors] = useState({});
  const [dupWarning, setDupWarning] = useState(null); // transaction doublon détectée

  const isCag = type === "epargne" || type === "decagnottage";
  const cats  = categories.filter(c => type === "income" ? c.type === "income" : c.type === "expense");

  // Détecte un doublon potentiel : même montant + même catégorie dans les 7 derniers jours
  function findDuplicate(amt, catId, txDate, txType) {
    if (!amt || editingId) return null;
    const d = new Date(txDate + "T12:00:00");
    return transactions.find(t => {
      if (t.type !== txType) return false;
      if (Math.abs((parseFloat(t.amount)||0) - parseFloat(amt)) > 0.01) return false;
      if (t.categoryId !== catId) return false;
      const td = new Date(t.date + "T12:00:00");
      return Math.abs((d - td) / 86400000) <= 7;
    }) || null;
  }

  function validate() {
    const e = {};
    const a = parseFloat(amount);
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
    const parsedAmt = parseFloat(amount);

    // Vérification doublon (seulement à la première tentative)
    if (!force && !isCag) {
      const dup = findDuplicate(amount, catId, date, type);
      if (dup) {
        const cat = categories.find(c => c.id === dup.categoryId);
        setDupWarning({ tx: dup, catName: cat?.name || "—" });
        return;
      }
    }
    setDupWarning(null);

    onSave({ id: editingId || null, type, amount: parsedAmt, date, categoryId: catId, targetCagId: cagId, note });
    if (isCag) {
      const cag = cagnottes.find(x => x.id === cagId);
      if (cag) {
        // Compute expected new balance (mirrors store logic)
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

  return (
    <Modal onClose={onClose} title={editingId ? "Modifier l'opération" : "Nouvelle opération"}>
      <Field label="Type">
        <select value={type} onChange={e => { setType(e.target.value); setErrors({}); }}>
          <option value="expense">Dépense</option>
          <option value="income">Revenu</option>
          <option value="epargne">Épargne (Mise de côté)</option>
          <option value="decagnottage">Décagnottage (Sortie de cagnotte)</option>
        </select>
      </Field>

      <Field label="Montant (€)" error={errors.amount}>
        <input type="number" step="0.01" min="0" value={amount}
          className={errors.amount ? "error" : ""}
          onChange={e => { setAmount(e.target.value); setErrors(v => ({...v, amount: ""})); }} />
      </Field>

      {!isCag && (
        <Field label="Catégorie (optionnelle)">
          <select value={catId} onChange={e => setCatId(e.target.value)}>
            <option value="">Aucune catégorie</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </Field>
      )}

      {isCag && (
        <Field label="Cagnotte cible" error={errors.cag}>
          <select value={cagId} className={errors.cag ? "error" : ""}
            onChange={e => { setCagId(e.target.value); setErrors(v => ({...v, cag: ""})); }}>
            {cagnottes.length === 0
              ? <option value="">Aucune cagnotte disponible</option>
              : cagnottes.map(c => <option key={c.id} value={c.id}>{c.name} ({fmt(c.current)})</option>)
            }
          </select>
        </Field>
      )}

      <Field label="Date" error={errors.date}>
        <input type="date" value={date} className={errors.date ? "error" : ""}
          onChange={e => { setDate(e.target.value); setErrors(v => ({...v, date: ""})); }} />
      </Field>

      <Field label="Note">
        <input type="text" placeholder="Description…" value={note} onChange={e => setNote(e.target.value)} />
      </Field>

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
            <button className="btn btn-outline" style={{ width: "100%" }} onClick={() => setDupWarning(null)}>
              ✕ Annuler
            </button>
            <button className="btn btn-primary" style={{ width: "100%", background: "var(--warning)", color: "#060810" }} onClick={() => handleSave(true)}>
              ✓ Ajouter quand même
            </button>
          </div>
        </div>
      )}

      {!dupWarning && (
      <div className="grid-2" style={{ marginBottom: 0 }}>
        <button className="btn btn-outline" style={{ width: "100%" }} onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => handleSave()}>Valider</button>
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

  const [name,   setName]   = useState(f?.name       || "");
  const [amt,    setAmt]    = useState(f?.amount      || "");
  const [catId,  setCatId]  = useState(f?.categoryId  || expCats[0]?.id || "");
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!name.trim())                               e.name = "Nom requis";
    const a = parseFloat(amt);
    if (!amt || isNaN(a) || a <= 0)                 e.amt  = "Montant requis et doit être > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ idx: editingIdx, fixed: { name: name.trim(), amount: parseFloat(amt), categoryId: catId } });
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
      <div className="grid-2" style={{ marginBottom: 0 }}>
        <button className="btn btn-outline"  style={{ width: "100%" }} onClick={onClose}>Annuler</button>
        <button className="btn btn-primary"  style={{ width: "100%" }} onClick={handleSave}>Valider</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Cagnotte modal
// ─────────────────────────────────────────────────────────────────
export function CagModal({ cagnottes, editingId, onSave, onClose }) {
  const toast = useToast();
  const c     = editingId ? cagnottes.find(x => x.id === editingId) : null;

  const [name,       setName]       = useState(c?.name       || "");
  const [target,     setTarget]     = useState(c?.target      || "");
  const [targetDate, setTargetDate] = useState(c?.targetDate  || "");
  const [current,    setCurrent]    = useState(c?.current     ?? 0);
  const [errors,     setErrors]     = useState({});

  const calcInfo = (() => {
    const t = parseFloat(target), cur = parseFloat(current) || 0;
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
      target: parseFloat(target) || null,
      targetDate: targetDate || null,
      current: parseFloat(current) || 0,
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
  const [amt,    setAmt]  = useState("");
  const [fromId, setFrom] = useState(cagnottes[0]?.id || "");
  const [toId,   setTo]   = useState(cagnottes[1]?.id || cagnottes[0]?.id || "");
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    const a = parseFloat(amt);
    if (!amt || isNaN(a) || a <= 0) e.amt = "Montant requis et doit être > 0";
    if (fromId === toId)             e.from = "Source et destination identiques";
    if (!e.amt) {
      const from = cagnottes.find(c => c.id === fromId);
      if (from && from.current < a) e.amt = `Fonds insuffisants (${fmt(from.current)} disponible)`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ amt: parseFloat(amt), fromId, toId });
    toast("Transfert effectué");
  }

  return (
    <Modal onClose={onClose} title="Transfert entre cagnottes">
      <Field label="Montant (€)" error={errors.amt}>
        <input type="number" step="0.01" min="0" value={amt} className={errors.amt ? "error" : ""}
          onChange={e => { setAmt(e.target.value); setErrors(v => ({...v, amt: ""})); }} />
      </Field>
      <Field label="Source (retirer de…)" error={errors.from}>
        <select value={fromId} className={errors.from ? "error" : ""}
          onChange={e => { setFrom(e.target.value); setErrors(v => ({...v, from: ""})); }}>
          {cagnottes.map(c => <option key={c.id} value={c.id}>{c.name} ({fmt(c.current)})</option>)}
        </select>
      </Field>
      <Field label="Destination (ajouter à…)">
        <select value={toId} onChange={e => setTo(e.target.value)}>
          {cagnottes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid-2" style={{ marginBottom: 0 }}>
        <button className="btn btn-outline" style={{ width: "100%" }} onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleSave}>Transférer</button>
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
  const curM    = now.toISOString().slice(0, 7);
  const curY    = now.getFullYear().toString();
  const tf      = useTotalFixes(fixedExpenses);
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
      {/* Header */}
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
        {/* Cagnottes list */}
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

        {/* Expense: show fixed first then variable */}
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

        {/* Generic list */}
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
  const tf    = useTotalFixes(fixedExpenses);
  const isCurM = mStr === new Date().toISOString().slice(0, 7);
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
          <div key={l} style={{ background: `${c.replace(")", "-glow)")}`
            .replace("var(--success-glow)", "var(--success-glow)")
            .replace("var(--danger-glow)",  "var(--danger-glow)"),
            border: `1px solid ${c}`, borderRadius: 8, padding: 10 }}>
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
