// ─────────────────────────────────────────────────────────────────
//  ForecastPanels — v1.48.0
//  • ForecastPanel : onglet « 📅 Calendrier & solde » du panneau À venir
//    (calendrier du mois, opérations datées jusqu'à la paie, courbe du
//    solde prévu jour par jour, point bas). Données : computeDailyForecast.
//  • RestToLiveSheet : détail du « reste à vivre » (computeRestToLive).
//  • ReimbursementsSheet : liste des remboursements attendus.
//  Tout est indicatif : aucun de ces calculs ne modifie le solde estimé.
// ─────────────────────────────────────────────────────────────────
import { createPortal } from "react-dom";
import { fmt, todayISO, MONTHS_SHORT } from "../utils.js";

const ddmm = iso => `${parseInt(iso.slice(8, 10), 10)} ${MONTHS_SHORT[parseInt(iso.slice(5, 7), 10) - 1].toLowerCase()}.`;
const signed = v => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));

export function Sheet({ title, right, onClose, children }) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", animation: "fadeIn .2s ease" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "88vh", overflowY: "auto", maxWidth: 520, margin: "0 auto",
        background: "var(--surface)", borderTop: "1.5px solid var(--border)", borderRadius: "20px 20px 0 0",
        padding: "10px 14px calc(16px + env(safe-area-inset-bottom))", boxShadow: "0 -20px 50px rgba(0,0,0,.7)", animation: "slideUp .22s ease" }}>
        <div style={{ width: 40, height: 4, borderRadius: 3, background: "var(--border)", margin: "0 auto 10px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ flex: 1, fontFamily: "var(--display)", fontSize: "1rem", fontWeight: 700 }}>{title}</span>
          {right}
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function Row({ left, icon, label, value, color, onClick, sub, subColor }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--border-soft)", fontSize: ".72rem", cursor: onClick ? "pointer" : "default" }}>
      {left && <span style={{ width: 46, fontSize: ".62rem", fontWeight: 700, color: "var(--text3)" }}>{left}</span>}
      {icon && <span style={{ fontSize: ".9rem" }}>{icon}</span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {sub && <span style={{ display: "block", fontSize: ".58rem", color: subColor || "var(--text3)" }}>{sub}</span>}
      </span>
      <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", color }}>{value}</span>
    </div>
  );
}

// ── Onglet « Calendrier & solde » ────────────────────────────────
export function ForecastPanel({ forecast: fc }) {
  const today = todayISO();
  const ym = today.slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const nDays = new Date(y, m, 0).getDate();
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;   // lundi = 0
  const dayKind = d => {
    const iso = `${ym}-${String(d).padStart(2, "0")}`;
    const evs = fc.events.filter(e => e.date === iso);
    return { out: evs.some(e => e.amount < 0), inn: evs.some(e => e.amount > 0) };
  };
  const noDated = fc.events.length === 0;

  // Courbe
  const pts = fc.days.map((d, i) => [i, d.balance]);
  const W = 340, H = 110;
  const vals = pts.map(p => p[1]).concat([0]);
  const min = Math.min(...vals), max = Math.max(...vals) || 1;
  const x = i => pts.length > 1 ? i / (pts.length - 1) * W : 0;
  const yv = v => H - (v - min) / (max - min || 1) * H;
  const lowIdx = fc.low ? fc.days.findIndex(d => d.date === fc.low.date) : -1;

  return (
    <div>
      {fc.low && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, marginBottom: 10, fontSize: ".7rem",
          background: fc.low.balance < 0 ? "rgba(200,112,112,.08)" : "rgba(232,148,74,.07)", border: `1px solid ${fc.low.balance < 0 ? "rgba(200,112,112,.35)" : "rgba(232,148,74,.3)"}` }}>
          <span>📉</span><span style={{ flex: 1 }}>Point bas prévu {fc.payday ? "avant la paie" : "d'ici la fin du mois"}</span>
          <b style={{ color: fc.low.balance < 0 ? "var(--danger)" : "#e8944a", fontVariantNumeric: "tabular-nums" }}>{fmt(fc.low.balance)} le {ddmm(fc.low.date)}</b>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, fontSize: ".6rem", textAlign: "center" }}>
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <div key={i} style={{ color: "var(--text3)", fontWeight: 800, padding: "3px 0" }}>{d}</div>)}
        {Array.from({ length: firstDow }, (_, i) => <div key={"b" + i} />)}
        {Array.from({ length: nDays }, (_, i) => {
          const d = i + 1, iso = `${ym}-${String(d).padStart(2, "0")}`, k = dayKind(d), isToday = iso === today, past = iso < today;
          return (
            <div key={d} style={{ position: "relative", padding: "6px 0", borderRadius: 7, background: "var(--surface2)", color: isToday ? "var(--accent)" : "var(--text2)",
              outline: isToday ? "1.5px solid var(--accent)" : "none", fontWeight: isToday ? 800 : 400, opacity: past ? .4 : 1 }}>
              {d}
              {(k.out || k.inn) && <span style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2 }}>
                {k.out && <i style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--danger)" }} />}
                {k.inn && <i style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--success)" }} />}
              </span>}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: ".58rem", color: "var(--text3)", margin: "5px 0 8px" }}>
        <span style={{ color: "var(--danger)" }}>●</span> prélèvement · <span style={{ color: "var(--success)" }}>●</span> revenu
      </div>

      {noDated
        ? <div style={{ fontSize: ".66rem", color: "var(--text3)", padding: "8px 10px", borderRadius: 10, background: "var(--surface2)" }}>
            Aucune date connue : ajoute un « jour de prélèvement » à tes frais et revenus fixes (Fixes → ✏️) pour remplir ce calendrier.
          </div>
        : fc.events.map((e, i) => (
            <Row key={i} left={ddmm(e.date)} icon={e.icon} label={e.label} sub={e.isPay ? "💼 paie" : e.next ? "mois prochain" : null}
              value={signed(e.amount)} color={e.amount >= 0 ? "var(--success)" : "var(--danger)"} />
          ))}

      {fc.days.length > 1 && <>
        <div style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "12px 0 6px" }}>Solde prévu jour par jour</div>
        <svg data-pv="" width="100%" viewBox={`0 -6 ${W} ${H + 22}`} style={{ display: "block", overflow: "visible" }}>
          {min < 0 && <line x1="0" x2={W} y1={yv(0)} y2={yv(0)} stroke="var(--danger)" strokeDasharray="3 3" opacity=".5" />}
          <polyline fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" points={pts.map(p => `${x(p[0]).toFixed(1)},${yv(p[1]).toFixed(1)}`).join(" ")} />
          {lowIdx >= 0 && <>
            <circle cx={x(lowIdx)} cy={yv(fc.low.balance)} r="4" fill="#e8944a" />
            <text x={Math.max(60, x(lowIdx) - 4)} y={yv(fc.low.balance) + 14} fill="#e8944a" fontSize="9.5" textAnchor="end">point bas {fmt(fc.low.balance)}</text>
          </>}
          {fc.payday && <text x={W} y={yv(pts[pts.length - 1][1]) - 6} fill="var(--success)" fontSize="9.5" textAnchor="end">💼 paie</text>}
          <text x="0" y={H + 14} fill="var(--text3)" fontSize="9">aujourd'hui</text>
          <text x={W} y={H + 14} fill="var(--text3)" fontSize="9" textAnchor="end">{ddmm(fc.end)}</text>
        </svg>
        <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 4, lineHeight: 1.5 }}>
          Part du solde estimé d'aujourd'hui · retire les prélèvements datés, les récurrentes et les courses prévues réparties sur les jours restants.
          Les frais sans jour de prélèvement sont déjà déduits au départ.
        </div>
      </>}
    </div>
  );
}

// ── Détail du reste à vivre ──────────────────────────────────────
export function RestToLiveSheet({ rest: r, onClose }) {
  const today = todayISO();
  return (
    <Sheet title="💶 Reste à vivre" onClose={onClose}>
      <div style={{ fontSize: ".62rem", color: "var(--text3)", marginBottom: 8 }}>
        Du {ddmm(today)} {r.payday ? `à la paie du ${ddmm(r.payday)}` : "à la fin du mois"} ({r.days} jour{r.days > 1 ? "s" : ""})
      </div>
      <Row label="Solde estimé" value={signed(r.base)} color="var(--text)" />
      {r.incBeforePay > 0 && <Row label="💰 Revenus attendus avant la paie" value={"+" + fmt(r.incBeforePay)} color="var(--success)" />}
      {r.groceries > 0 && <Row label="🛒 Courses prévues (budget courses)" value={"−" + fmt(r.groceries)} color="var(--coral)" />}
      {r.nextBeforePay > 0 && <Row label="📅 Prélèvements du mois prochain avant la paie" value={"−" + fmt(r.nextBeforePay)} color="var(--danger)" />}
      {r.margin > 0 && <Row label="🛟 Marge de sécurité (Options)" value={"−" + fmt(r.margin)} color="var(--warning)" />}
      <Row label={<b>= Disponible</b>} value={signed(r.available)} color={r.available >= 0 ? "var(--text)" : "var(--danger)"} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, padding: 12, borderRadius: 12,
        background: "rgba(92,200,192,.08)", border: "1.5px solid rgba(92,200,192,.4)" }}>
        <span style={{ fontWeight: 800, fontSize: ".76rem" }}>÷ {r.days} jour{r.days > 1 ? "s" : ""}</span>
        <span style={{ fontSize: "1.3rem", fontWeight: 800, color: r.perDay >= 0 ? "#5cc8c0" : "var(--danger)", fontVariantNumeric: "tabular-nums" }}>{signed(r.perDay)} / jour</span>
      </div>
      <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 8, lineHeight: 1.5 }}>
        Indicatif : le solde estimé n'est pas modifié. Les frais fixes de ce mois sont déjà dans le solde estimé.
        {!r.payday && " Ajoute un jour de versement à ton salaire (Fixes) pour calculer jusqu'à la paie."}
        {" "}Marge de sécurité : Options → Reste à vivre.
      </div>
    </Sheet>
  );
}

// ── Remboursements attendus ──────────────────────────────────────
export function ReimbursementsSheet({ items, onOpen, onAdd, onClose }) {
  const total = items.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  return (
    <Sheet title="↩️ À recevoir" onClose={onClose}
      right={<b style={{ color: "#5cc8c0", fontVariantNumeric: "tabular-nums", marginRight: 4 }}>+{fmt(total)}</b>}>
      {items.length === 0 && <div style={{ fontSize: ".7rem", color: "var(--text3)", textAlign: "center", padding: 14 }}>Aucun remboursement attendu.</div>}
      {items.map(r => (
        <Row key={r.id} icon="↩️" onClick={() => onOpen(r)}
          label={<b>{r.from || "Remboursement"}{r.note ? ` — ${r.note}` : ""}</b>}
          sub={r.late > 0 ? `attendu le ${ddmm(r.expectedDate)} · ${r.late} j de retard` : r.expectedDate ? `vers le ${ddmm(r.expectedDate)}` : "sans date"}
          subColor={r.late > 0 ? "#e8944a" : undefined}
          value={"+" + fmt(r.amount)} color="#5cc8c0" />
      ))}
      <button onClick={onAdd} style={{ width: "100%", marginTop: 10, padding: 11, borderRadius: 11, border: "1.5px dashed var(--border)", background: "none", color: "var(--text2)", fontSize: ".72rem", fontWeight: 700, cursor: "pointer" }}>
        ＋ Ajouter un remboursement attendu
      </button>
      <div style={{ fontSize: ".58rem", color: "var(--text3)", marginTop: 8 }}>Touche une ligne pour la modifier ou la marquer reçue. N'entre pas dans le solde tant que l'argent n'est pas arrivé.</div>
    </Sheet>
  );
}
