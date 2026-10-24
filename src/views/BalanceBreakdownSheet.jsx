// ─────────────────────────────────────────────────────────────────
//  BalanceBreakdownSheet — v1.45.0
//  Panneau « Calcul du solde estimé », ouvert en touchant le gros
//  montant de la hero card. Affiche, ligne par ligne, exactement le
//  calcul de computeBalanceBreakdown (hooks.js) — la même fonction que
//  celle qui produit le chiffre de la carte : les deux ne peuvent pas
//  diverger.
// ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import { createPortal } from "react-dom";
import { fmt, txLabel, todayISO, chequeExpiryISO, daysBetweenISO, MONTHS_SHORT, pv } from "../utils.js";

const signed = v => (v > 0.004 ? "+" : "") + fmt(v);
const ddmm   = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "";
const ymLbl  = ym => `${MONTHS_SHORT[parseInt(ym.slice(5, 7), 10) - 1]?.toLowerCase()} ${ym.slice(2, 4)}`;

/** Regroupe les mois non pointés d'un même frais/revenu fixe : « Loyer × 3 mois (aoû 26 → oct 26) » */
function groupFixed(items) {
  const map = new Map();
  items.forEach(({ f, ym, signed: v }) => {
    const key = f.id || f.name;
    const g = map.get(key) || { f, months: [], total: 0 };
    g.months.push(ym); g.total += v; map.set(key, g);
  });
  return [...map.values()].map(g => ({
    ...g,
    total: Math.round(g.total * 100) / 100,
    label: g.months.length === 1 ? `(${ymLbl(g.months[0])})` : `× ${g.months.length} mois (${ymLbl(g.months[0])} → ${ymLbl(g.months[g.months.length - 1])})`,
  }));
}

function DetailRow({ label, value, warn }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: ".68rem", color: "var(--text2)", padding: "3px 0" }}>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}{warn && <span style={{ color: "var(--danger)", fontWeight: 700 }}> · ⚠️ {warn}</span>}
      </span>
      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0, color: value >= 0 ? "var(--success)" : "var(--danger)" }}>{signed(value)}</span>
    </div>
  );
}

function SubTitle({ children, color }) {
  return <div style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: color || "var(--text3)", margin: "6px 0 2px" }}>{children}</div>;
}

function Line({ icon, title, sub, value, color, open, onToggle, children }) {
  const expandable = !!children;
  return (
    <>
      <div onClick={expandable ? onToggle : undefined}
        style={{
          display: "flex", alignItems: "center", gap: 9, padding: "10px 11px", marginBottom: 6, borderRadius: 11,
          border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`, borderLeft: `3px solid ${color}`,
          background: `color-mix(in srgb, ${color} 7%, var(--surface2))`, cursor: expandable ? "pointer" : "default",
        }}>
        <span style={{ fontSize: "1rem" }}>{icon}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: ".78rem", fontWeight: 700 }}>{title}</span>
          <span style={{ display: "block", fontSize: ".6rem", color: "var(--text3)" }}>{sub}</span>
        </span>
        <span style={{ fontSize: ".88rem", fontWeight: 800, color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{signed(value)}</span>
        {expandable && <span style={{ fontSize: ".6rem", color: "var(--text3)", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>}
      </div>
      {expandable && open && (
        <div style={{ margin: "-2px 0 8px 14px", paddingLeft: 10, borderLeft: "1px dashed var(--border)" }}>{children}</div>
      )}
    </>
  );
}


const monthName = ym => new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1).toLocaleDateString("fr-FR", { month: "long" });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/** Budget courses (v1.46.0) — affiché SOUS le total : information seulement, jamais déduite */
function GrocerySection({ grocery: g, total, categories, open, onToggle }) {
  const catLbl = g.catIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean).join(", ");
  const pct = g.average > 0 ? Math.min(100, (g.spent / g.average) * 100) : 100;
  const isOver = g.over > 0;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)", margin: "0 0 6px 2px" }}>
        Pour information · non déduit
      </div>
      <Line icon="🛒" title="Courses restantes ce mois"
        sub={isOver ? "Moyenne déjà dépassée ce mois" : g.remaining > 0 ? `Estimation · ${g.months.length > 1 ? `${g.months.length} derniers mois` : "dernier mois"} + ${monthName(g.curYM)} au prorata` : "Moyenne atteinte ce mois"}
        value={-g.remaining} color={isOver ? "var(--danger)" : "var(--coral)"} open={open} onToggle={onToggle}>
        {g.months.map(m => (
          <div key={m.ym} style={{ display: "flex", justifyContent: "space-between", fontSize: ".68rem", color: "var(--text2)", padding: "3px 0" }}>
            <span>🛒 {cap(monthName(m.ym))} ({catLbl})</span><span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(m.total)}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: ".68rem", color: "var(--text2)", padding: "3px 0" }}>
          <span>🛒 {cap(monthName(g.curYM))} (au {g.day})
            <span style={{ fontSize: ".55rem", fontWeight: 800, padding: "1px 6px", borderRadius: 6, background: "rgba(112,184,224,.15)", color: "var(--accent)", marginLeft: 5 }}>
              poids {g.day}/{g.daysInMonth}
            </span>
          </span>
          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(g.spent)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".68rem", color: "var(--text)", padding: "3px 0", fontWeight: 700 }}>
          <span>= Moyenne mensuelle</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(g.average)}</span>
        </div>
        {g.refunded > 0 && (
          <div data-testid="grocery-refunded" style={{ fontSize: ".64rem", color: "var(--text2)", padding: "3px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>↩️ Remboursé ou à rembourser (non compté)</span>
              <span style={{ fontWeight: 700, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>{fmt(g.refunded)}</span>
            </div>
            {g.refundItems.map(({ t, amount }) => <div key={t.id} style={{ fontSize: ".58rem", color: "var(--text3)" }}>{ddmm(t.date)} · {t.note || "courses"} · {fmt(amount)}</div>)}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".68rem", color: "var(--text2)", padding: "3px 0" }}>
          <span>Déjà dépensé en {monthName(g.curYM)} ({g.count} achat{g.count > 1 ? "s" : ""}{g.refunded > 0 ? ", hors remboursements" : ""})</span>
          <span style={{ fontWeight: 700, color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>−{fmt(g.spent)}</span>
        </div>
        <div style={{ height: 8, borderRadius: 5, background: "var(--surface3)", overflow: "hidden", margin: "6px 0 3px" }}>
          <div data-pv="" style={{ width: `${pct}%`, height: "100%", borderRadius: 5, background: isOver ? "var(--danger)" : "var(--coral)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".62rem", color: "var(--text2)" }}>
          <span>{g.average > 0 ? `${pv(Math.round((g.spent / g.average) * 100))} % de la moyenne utilisé` : "Pas de dépense de courses les mois précédents"}</span>
          <span style={{ fontWeight: 700, color: isOver ? "var(--danger)" : "var(--coral)" }}>{isOver ? `dépassé de ${fmt(g.over)}` : `reste ${fmt(g.remaining)}`}</span>
        </div>
      </Line>
      {g.remaining > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderRadius: 11,
          border: "1px dashed rgba(224,136,112,.45)", fontSize: ".7rem", color: "var(--text2)" }}>
          <span>Solde après courses prévues</span>
          <span style={{ fontSize: ".9rem", fontWeight: 800, color: "var(--coral)", fontVariantNumeric: "tabular-nums" }}>{fmt(total - g.remaining)}</span>
        </div>
      )}
    </div>
  );
}

export function BalanceBreakdownSheet({ breakdown, grocery = null, categories = [], cagnottes = [], onClose }) {
  const [open, setOpen] = useState({ g: true });
  const tg = k => setOpen(o => ({ ...o, [k]: !o[k] }));
  const { pointed, pending, recurring, scheduled, total } = breakdown;
  const reimb = breakdown.reimbursements || { total: 0, items: [] };   // v1.69.0
  const today = todayISO();
  const catOf = id => categories.find(c => c.id === id);
  const nPending = pending.cheques.items.length + pending.others.items.length + pending.fixes.items.length + pending.incomes.items.length;
  const d = new Date();
  const dateLbl = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fadeIn .2s ease" }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "88vh", overflowY: "auto",
        background: "var(--panel-solid, var(--surface))", borderTop: "1.5px solid var(--border)", borderRadius: "20px 20px 0 0",
        padding: "10px 14px calc(16px + env(safe-area-inset-bottom))", boxShadow: "0 -20px 50px rgba(0,0,0,.7)",
        animation: "slideUp .22s ease", maxWidth: 520, margin: "0 auto",
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 3, background: "var(--border)", margin: "0 auto 10px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
          <span style={{ fontFamily: "var(--display)", fontSize: "1rem", fontWeight: 700 }}>🧮 Calcul du solde estimé</span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ fontSize: ".64rem", color: "var(--text3)", marginBottom: 12 }}>Situation au {dateLbl} · touche une ligne pour le détail</div>

        <Line icon="✓" title="Solde pointé" sub={`${pointed.count} opération${pointed.count > 1 ? "s" : ""} vérifiée${pointed.count > 1 ? "s" : ""} sur ton relevé`}
          value={pointed.total} color="var(--success)" />

        <Line icon="⏳" title="En attente" sub={nPending ? "Pas encore vu sur ton relevé" : "Tout est pointé 👌"} value={pending.total} color="var(--warning)"
          open={open.p} onToggle={() => tg("p")}>
          {nPending > 0 && <>
            {pending.cheques.items.length > 0 && <>
              <SubTitle color="var(--chq)">🧾 {pending.cheques.items.length} chèque{pending.cheques.items.length > 1 ? "s" : ""} non encaissé{pending.cheques.items.length > 1 ? "s" : ""} · {signed(pending.cheques.total)}</SubTitle>
              {pending.cheques.items.map(({ t, signed: v }) => {
                const issued = t.issuedDate || t.date;
                const age = Math.max(0, daysBetweenISO(issued, today));
                const expired = today > chequeExpiryISO(issued);
                return <DetailRow key={t.id} value={v} warn={expired ? "périmé" : null}
                  label={`${t.chequeNumber ? "n°" + t.chequeNumber + " · " : ""}${txLabel(t, categories, cagnottes)} (émis il y a ${age} j)`} />;
              })}
            </>}
            {pending.others.items.length > 0 && <>
              {(() => { const n = pending.others.items.length, pl = n > 1 ? "s" : "";
                return <SubTitle>{n} {pending.cheques.items.length ? `autre${pl} ` : ""}opération{pl} non pointée{pl} · {signed(pending.others.total)}</SubTitle>; })()}
              {[...pending.others.items].sort((a, b) => b.t.date.localeCompare(a.t.date)).map(({ t, signed: v }) =>
                <DetailRow key={t.id} value={v} label={`${ddmm(t.date)} · ${catOf(t.categoryId)?.icon || ""} ${txLabel(t, categories, cagnottes)}`} />)}
            </>}
            {pending.fixes.items.length > 0 && <>
              <SubTitle>📌 Frais fixes non pointés · {signed(pending.fixes.total)}</SubTitle>
              {groupFixed(pending.fixes.items).map((g, i) =>
                <DetailRow key={i} value={g.total} label={`${catOf(g.f.categoryId)?.icon || "📌"} ${g.f.name} ${g.label}`} />)}
            </>}
            {pending.incomes.items.length > 0 && <>
              <SubTitle>💼 Revenus fixes non pointés · {signed(pending.incomes.total)}</SubTitle>
              {groupFixed(pending.incomes.items).map((g, i) =>
                <DetailRow key={i} value={g.total} label={`${catOf(g.f.categoryId)?.icon || "💼"} ${g.f.name} ${g.label}`} />)}
            </>}
          </>}
        </Line>

        <Line icon="🔄" title="Récurrentes pas encore passées" sub={recurring.items.length ? "Pas encore confirmées pour cette période" : "Toutes confirmées"}
          value={recurring.total} color="var(--sapin)" open={open.r} onToggle={() => tg("r")}>
          {recurring.items.length > 0 && recurring.items.map(({ tpl, signed: v, day }) =>
            <DetailRow key={tpl.id} value={v}
              label={`${catOf(tpl.categoryId)?.icon || "🔄"} ${tpl.label || tpl.note || "Récurrente"}${tpl.frequency === "yearly" ? " (annuelle)" : day ? ` (vers le ${day})` : ""}`} />)}
        </Line>

        <Line icon="📅" title="Programmées arrivées à échéance" sub={scheduled.items.length ? "Date atteinte, pas encore confirmées" : "Aucune"}
          value={scheduled.total} color="var(--accent)" open={open.s} onToggle={() => tg("s")}>
          {scheduled.items.length > 0 && scheduled.items.map(({ s, signed: v }, i) =>
            <DetailRow key={s.id || i} value={v} label={`${ddmm(s.date)} · ${catOf(s.categoryId)?.icon || "📅"} ${s.note || catOf(s.categoryId)?.name || "Programmée"}`} />)}
        </Line>

        {reimb.items.length > 0 && (
          <Line icon="↩️" title="Remboursements attendus" sub={`Comptés jusqu'à leur réception${reimb.items.some(x => x.late) ? " · ⚠️ en retard" : ""}`}
            value={reimb.total} color="var(--success)" open={open.rb} onToggle={() => tg("rb")}>
            {reimb.items.map(({ r, tx, signed: v, late }) =>
              <DetailRow key={r.id} value={v} warn={late ? `${late} j` : null}
                label={tx
                  ? `${r.from ? r.from + " · " : ""}${catOf(tx.categoryId)?.icon || ""} ${txLabel(tx, categories, cagnottes)} du ${ddmm(tx.date)}`
                  : `${r.from || "À recevoir"}${r.note ? " · " + r.note : ""}${r.expectedDate ? ` (vers le ${ddmm(r.expectedDate)})` : ""}`} />)}
          </Line>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, marginTop: 4, borderRadius: 12,
          background: "rgba(112,184,224,.08)", border: "1.5px solid rgba(112,184,224,.4)" }}>
          <span style={{ fontSize: ".78rem", fontWeight: 800 }}>= Solde bancaire estimé</span>
          <span style={{ fontSize: "1.25rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: total < 0 ? "var(--danger)" : "var(--text)" }}>{fmt(total)}</span>
        </div>
        {grocery && <GrocerySection grocery={grocery} total={total} categories={categories} open={open.g} onToggle={() => tg("g")} />}

        <div style={{ fontSize: ".62rem", color: "var(--text3)", lineHeight: 1.5, marginTop: 10, padding: "8px 10px", borderRadius: 9, background: "var(--surface2)" }}>
          ℹ️ Les frais fixes non pointés sont déjà dans « En attente » : ils ne sont <b style={{ color: "var(--text2)" }}>jamais comptés deux fois</b>.
          Un chèque reste déduit tant qu'il n'est pas annulé, même périmé. Le porte-monnaie (tickets resto) et les dépenses hors compte n'entrent pas dans ce calcul{grocery ? ", ni le budget courses (seulement indiqué)" : ""}.
        </div>
      </div>
    </div>,
    document.body
  );
}
