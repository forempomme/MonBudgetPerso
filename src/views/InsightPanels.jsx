// ─────────────────────────────────────────────────────────────────
//  InsightPanels — v1.50.0
//  • SimulationSheet / SimulationBlock : « 🧪 Et si… ? » sur la carte
//    Projection (simulateProjection) — rien n'est enregistré.
//  • InsightsList : « 🔍 Repéré pour toi » en haut de la page Fixes
//    (detectInsights) — hausses de prix, dépenses régulières non déclarées.
//  • SurplusCard / SurplusSheet : surplus de fin de cycle → cagnotte
//    (computeSurplus).
// ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import { fmt, MONTHS_SHORT, cagIconOf, pv } from "../utils.js";
import { simulateProjection } from "../hooks.js";
import { Sheet } from "./ForecastPanels.jsx";

const MONTHS_LC = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const ymLabel = ym => MONTHS_SHORT[parseInt(ym.slice(5, 7), 10) - 1];
const ymLong  = ym => MONTHS_LC[parseInt(ym.slice(5, 7), 10) - 1];
const parseAmt = s => { const v = parseFloat(String(s || "").replace(/\s/g, "").replace(",", ".")); return isNaN(v) ? 0 : Math.round(Math.abs(v) * 100) / 100; };
const ymPlus = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

const chip = on => ({
  display: "inline-flex", alignItems: "center", gap: 4, fontSize: ".64rem", fontWeight: 700, padding: "6px 10px", borderRadius: 12,
  border: `1px solid ${on ? "var(--purple)" : "var(--border)"}`, color: on ? "var(--purple)" : "var(--text2)",
  background: on ? "rgba(176,144,224,.12)" : "transparent", margin: "0 5px 5px 0", cursor: "pointer",
});
const label = { fontSize: ".56rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)", margin: "10px 0 5px" };

// ═════════════════ Simulation ═════════════════
const KINDS = [
  ["incDown",    "📉 Baisse de revenu",        "Revenus −"],
  ["incUp",      "📈 Hausse de revenu",        "Revenus +"],
  ["expMonthly", "💸 Nouvelle dépense / mois", "Dépense −"],
  ["expOnce",    "🛒 Dépense unique",          "Dépense unique"],
];
const DURATIONS = [[1, "1 mois"], [3, "3 mois"], [6, "6 mois"], [null, "Toujours"]];

export function scenarioText(sc) {
  const k = KINDS.find(x => x[0] === sc.kind);
  const a = fmt(sc.amount);
  if (sc.kind === "expOnce") return { title: `Dépense unique ${a}`, sub: `en ${ymLong(sc.fromYM)}` };
  const per = sc.kind === "incUp" ? `+${a}/mois` : `−${a}/mois`;
  const title = `${sc.kind === "expMonthly" ? "Dépense" : "Revenus"} ${per}`;
  const sub = sc.months == null ? `à partir de ${ymLong(sc.fromYM)}`
    : sc.months === 1 ? `en ${ymLong(sc.fromYM)}`
    : `de ${ymLong(sc.fromYM)} à ${ymLong(ymPlus(sc.fromYM, sc.months - 1))} (${sc.months} mois)`;
  return { title: title || k?.[2], sub };
}

export function SimulationSheet({ months, scenarios, onChange, onApply, onClose }) {
  const [kind, setKind] = useState("incDown");
  const [amt, setAmt] = useState("");
  const [from, setFrom] = useState(months[0]?.ym);
  const [dur, setDur] = useState(3);
  const pending = parseAmt(amt) > 0 ? { id: `sc${Date.now()}`, kind, amount: parseAmt(amt), fromYM: from, months: kind === "expOnce" ? 1 : dur } : null;
  const add = () => { if (!pending) return; onChange([...scenarios, pending]); setAmt(""); };
  return (
    <Sheet title="🧪 Et si… ?" onClose={onClose}>
      <div style={{ fontSize: ".64rem", color: "var(--text3)", margin: "-4px 0 10px" }}>Rien n'est enregistré dans ton budget.</div>
      {scenarios.map(sc => {
        const t = scenarioText(sc), neg = sc.kind !== "incUp";
        return (
          <div key={sc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 11, background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 6, fontSize: ".72rem" }}>
            <span style={{ fontSize: "1rem" }}>{KINDS.find(k => k[0] === sc.kind)?.[1].split(" ")[0]}</span>
            <div style={{ flex: 1, minWidth: 0 }}><b style={{ color: neg ? "var(--danger)" : "var(--success)" }}>{t.title}</b><div style={{ fontSize: ".6rem", color: "var(--text3)" }}>{t.sub}</div></div>
            <button onClick={() => onChange(scenarios.filter(x => x.id !== sc.id))} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: ".9rem", cursor: "pointer" }}>✕</button>
          </div>
        );
      })}
      <div style={label}>{scenarios.length ? "Ajouter un autre changement" : "Ajouter un changement"}</div>
      <div>{KINDS.map(([k, l]) => <span key={k} style={chip(kind === k)} onClick={() => setKind(k)}>{l}</span>)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6, margin: "4px 0" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 11, background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <span style={{ fontSize: ".56rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text3)", whiteSpace: "nowrap" }}>{kind === "expOnce" ? "Montant" : "Montant / mois"}</span>
          <input value={amt} onChange={e => setAmt(e.target.value)} inputMode="decimal" placeholder="0,00"
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: ".9rem", fontWeight: 800, textAlign: "right", fontFamily: "var(--mono)" }} />
          <span style={{ color: "var(--text3)", fontWeight: 700 }}>€</span>
        </label>
      </div>
      <div style={label}>{kind === "expOnce" ? "En" : "À partir de"}</div>
      <div>{months.map(m => <span key={m.ym} style={chip(from === m.ym)} onClick={() => setFrom(m.ym)}>{ymLabel(m.ym)}</span>)}</div>
      {kind !== "expOnce" && <>
        <div style={label}>Pendant</div>
        <div>{DURATIONS.map(([d, l]) => <span key={l} style={chip(dur === d)} onClick={() => setDur(d)}>{l}</span>)}</div>
      </>}
      <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
        <button className="btn btn-outline" style={{ flex: 1 }} disabled={!pending} onClick={add}>＋ Ajouter</button>
        <button className="btn btn-primary" style={{ flex: 1, background: "var(--purple)", color: "#140b22", border: "none" }}
          disabled={!pending && scenarios.length === 0}
          onClick={() => { const list = pending ? [...scenarios, pending] : scenarios; if (pending) { onChange(list); setAmt(""); } onApply(list); }}>Voir l'effet</button>
      </div>
      <div style={{ fontSize: ".6rem", color: "var(--text3)", lineHeight: 1.5, marginTop: 10 }}>
        La projection garde ses règles habituelles (fixes, récurrentes, programmées, flux courant). La simulation ajoute tes changements par-dessus, sur 6 mois.
      </div>
    </Sheet>
  );
}

function Curve({ months }) {
  const W = 340, H = 110;
  const base = [months[0]?.startBase ?? 0, ...months.map(m => m.base)];
  const sim  = [months[0]?.startBase ?? 0, ...months.map(m => m.value)];
  const all = base.concat(sim), mn = Math.min(0, ...all), mx = Math.max(...all);
  const pad = (mx - mn) * 0.12 || 100, lo = mn - pad, hi = mx + pad;
  const X = i => 14 + i * (W - 28) / (base.length - 1), Y = v => H - 8 - (v - lo) / (hi - lo) * (H - 16);
  const path = a => a.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  return (
    <svg data-pv="" viewBox={`0 0 ${W} ${H + 14}`} width="100%" style={{ display: "block", marginTop: 8 }}>
      {lo < 0 && <><line x1="6" x2={W - 6} y1={Y(0)} y2={Y(0)} stroke="#c87070" strokeDasharray="3 3" strokeWidth="1" />
        <text x={W - 8} y={Y(0) - 3} fill="#c87070" fontSize="9" textAnchor="end">0 €</text></>}
      <path d={path(base)} fill="none" stroke="#70b8e0" strokeWidth="2.2" />
      <path d={path(sim)} fill="none" stroke="#b090e0" strokeWidth="2.4" strokeDasharray="6 4" />
      {["Auj.", ...months.map(m => m.label)].map((l, i) => <text key={i} x={X(i)} y={H + 11} fill="rgba(255,255,255,.5)" fontSize="9" textAnchor="middle">{l}</text>)}
    </svg>
  );
}

/** Contenu de la carte Projection en mode simulation */
export function SimulationBlock({ baseMonths, startBalance, scenarios, margin = 0, onEdit, onQuit }) {
  const sim = simulateProjection(baseMonths, scenarios).map((m, i) => ({ ...m, startBase: startBalance }));
  if (!sim.length) return null;
  const low = sim.reduce((a, m) => (m.value < a.value ? m : a), sim[0]);
  const lowIdx = sim.indexOf(low);
  const last = sim[sim.length - 1];
  const need = low.value < margin ? Math.ceil((margin - low.value) / (lowIdx + 1) * 100) / 100 : 0;
  const box = { borderRadius: 10, padding: "7px 6px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", textAlign: "center", minWidth: 0 };
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 10 }}>
        {sim.map(m => (
          <div key={m.ym} style={box}>
            <div style={{ fontSize: ".52rem", color: "rgba(255,255,255,.55)", fontWeight: 700, textTransform: "uppercase" }}>{m.label}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: ".74rem", fontWeight: 800, color: m.value < 0 ? "var(--danger)" : "var(--purple)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(m.value)}</div>
            <div style={{ fontSize: ".5rem", color: "rgba(255,255,255,.38)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>sans : {fmt(m.base)}</div>
          </div>
        ))}
      </div>
      <Curve months={sim} />
      <div style={{ fontSize: ".62rem", marginTop: 6, color: "rgba(255,255,255,.7)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>Solde fin {ymLong(last.ym)}</span>
          <b style={{ color: "var(--purple)", fontVariantNumeric: "tabular-nums" }}>{fmt(last.value)} <span style={{ color: last.cumEffect < 0 ? "var(--danger)" : "var(--success)" }}>({last.cumEffect >= 0 ? "+" : "−"}{fmt(Math.abs(last.cumEffect))})</span></b></div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>Point bas</span>
          <b style={{ color: low.value < 0 ? "var(--danger)" : low.value < margin ? "var(--warning)" : "var(--success)", fontVariantNumeric: "tabular-nums" }}>{fmt(low.value)} en {ymLong(low.ym)}</b></div>
        {need > 0 && (
          <div style={{ marginTop: 6, padding: "7px 9px", borderRadius: 9, background: "rgba(200,184,96,.1)", border: "1px solid rgba(200,184,96,.3)", lineHeight: 1.45 }}>
            💡 Pour ne pas descendre sous {margin > 0 ? <>ta marge de sécurité (<b>{fmt(margin)}</b>)</> : <b>0 €</b>}, il faudrait <b>{fmt(need)} / mois</b> de dépenses en moins d'ici {ymLong(low.ym)}.
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button onClick={onEdit} style={{ flex: 1, padding: "8px", borderRadius: 9, fontSize: ".64rem", fontWeight: 800, cursor: "pointer", background: "transparent", border: "1px solid rgba(176,144,224,.5)", color: "var(--purple)" }}>✏️ Modifier</button>
        <button onClick={onQuit} style={{ flex: 1, padding: "8px", borderRadius: 9, fontSize: ".64rem", fontWeight: 800, cursor: "pointer", background: "transparent", border: "1px solid rgba(255,255,255,.2)", color: "rgba(255,255,255,.7)" }}>✕ Quitter la simulation</button>
      </div>
    </div>
  );
}

// ═════════════════ Repéré pour toi ═════════════════
export function InsightsList({ items, categories = [], onDismiss, onUpdateRecurring, onCreateFixed }) {
  if (!items?.length) return null;
  const act = (bg, col, border) => ({ flex: 1, textAlign: "center", fontSize: ".64rem", fontWeight: 800, padding: "8px 0", borderRadius: 8, cursor: "pointer", background: bg, color: col, border: border || "none" });
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".56rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "2px 0 6px" }}>
        🔍 Repéré pour toi <span style={{ fontSize: ".52rem", fontWeight: 900, color: "#06201e", background: "var(--teal, #5cc8c0)", padding: "1px 6px", borderRadius: 5, letterSpacing: 0 }}>{items.length}</span>
      </div>
      {items.map(it => {
        if (it.kind === "rise") {
          const name = it.tpl.label || it.tpl.note || categories.find(c => c.id === it.tpl.categoryId)?.name || "Récurrente";
          return (
            <div key={it.key} style={{ borderRadius: 13, padding: "11px 12px", marginBottom: 8, border: "1px solid rgba(232,148,74,.45)", background: "rgba(232,148,74,.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".74rem" }}><span>📈</span><b style={{ flex: 1 }}>{name} a augmenté</b><b style={{ color: "#e8944a" }}>+{pv(it.pct)} %</b></div>
              <div style={{ fontSize: ".64rem", color: "var(--text2)", margin: "5px 0 8px", lineHeight: 1.45 }}>
                Récurrente confirmée à <b style={{ color: "var(--text)" }}>{fmt(it.last)}</b> en {ymLong(it.lastYM)}, contre <b style={{ color: "var(--text)" }}>{fmt(it.prev)}</b> en moyenne avant (+{fmt(it.last - it.prev)}/mois, soit +{fmt((it.last - it.prev) * 12)}/an).
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={act("transparent", "var(--text2)", "1px solid var(--border)")} onClick={() => onDismiss(it)}>Ignorer</span>
                <span style={act("#e8944a", "#1c0f04")} onClick={() => onUpdateRecurring(it)}>Mettre à jour à {fmt(it.last)}</span>
              </div>
            </div>
          );
        }
        const cat = categories.find(c => c.id === it.catId);
        const name = it.note || cat?.name || "Dépense";
        return (
          <div key={it.key} style={{ borderRadius: 13, padding: "11px 12px", marginBottom: 8, border: "1px solid rgba(112,184,224,.45)", background: "rgba(112,184,224,.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".74rem" }}><span>🔁</span><b style={{ flex: 1 }}>Dépense régulière non déclarée</b></div>
            <div style={{ fontSize: ".64rem", color: "var(--text2)", margin: "5px 0 8px", lineHeight: 1.45 }}>
              <b style={{ color: "var(--text)" }}>{cat?.icon || "💸"} {name} · ~{fmt(it.ref)}</b> tous les mois vers le {it.day}, {it.months.length} mois sur les 4 derniers : {it.months.map(m => fmt(m.amount)).join(" · ")}.<br />
              Elle n'est ni en frais fixe ni en récurrente : la projection et le reste à vivre ne la voient pas.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={act("transparent", "var(--text2)", "1px solid var(--border)")} onClick={() => onDismiss(it)}>Ignorer</span>
              <span style={act("var(--accent)", "#06121c")} onClick={() => onCreateFixed(it)}>Créer un frais fixe (le {it.day})</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═════════════════ Surplus ═════════════════
export function SurplusCard({ surplus: s, cagnottes = [], cagTypes, onDetail, onDismiss, onSave }) {
  const [cagId, setCagId] = useState(cagnottes[0]?.id || "");
  const [amt, setAmt] = useState(String(s.amount).replace(".", ","));
  const v = parseAmt(amt);
  const pay = s.payday ? `avant la paie du ${parseInt(s.payday.slice(8, 10), 10) === 1 ? "1ᵉʳ" : parseInt(s.payday.slice(8, 10), 10)} ${ymLabel(s.payday.slice(0, 7)).toLowerCase()}.` : "d'ici la fin du mois";
  return (
    <div style={{ borderRadius: 14, padding: "11px 12px", marginBottom: 12, border: "1px solid rgba(176,144,224,.4)", background: "linear-gradient(135deg,rgba(176,144,224,.12),rgba(176,144,224,.03))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "1.05rem" }}>💡</span>
        <div style={{ flex: 1, fontSize: ".74rem" }}>
          <b>Il te reste {fmt(s.amount)} de côté possible</b>
          <div style={{ fontSize: ".6rem", color: "var(--text2)", marginTop: 1 }}>{pay} · <u style={{ cursor: "pointer" }} onClick={onDetail}>voir le calcul</u></div>
        </div>
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: ".9rem", cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ margin: "9px 0 6px" }}>
        {cagnottes.map(c => <span key={c.id} style={chip(cagId === c.id)} onClick={() => setCagId(c.id)}>{cagIconOf(cagTypes, c)} {c.name}</span>)}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <input value={amt} onChange={e => setAmt(e.target.value)} inputMode="decimal"
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--purple)", fontSize: ".85rem", fontWeight: 800, fontFamily: "var(--mono)" }} />
          <span style={{ color: "var(--text3)", fontWeight: 700 }}>€</span>
        </label>
        <button disabled={!(v > 0) || !cagId} onClick={() => onSave(cagId, v)}
          style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--purple)", color: "#140b22", fontSize: ".7rem", fontWeight: 800, cursor: "pointer", opacity: v > 0 && cagId ? 1 : .5 }}>Verser</button>
      </div>
    </div>
  );
}

export function SurplusSheet({ surplus: s, onClose }) {
  const row = (l, v, sub, col) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border-soft)", fontSize: ".72rem" }}>
      <span style={{ color: "var(--text2)" }}>{l}{sub && <><br /><small style={{ color: "var(--text3)" }}>{sub}</small></>}</span>
      <b style={{ color: col || "var(--danger)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{v}</b>
    </div>
  );
  return (
    <Sheet title="💡 Le calcul" onClose={onClose}>
      {row("Solde bancaire estimé", fmt(s.base), null, "var(--text)")}
      {row("− Prélèvements d'ici la paie", `−${fmt(s.nextBeforePay)}`, s.payday ? "dépenses du mois prochain qui tombent avant la paie" : null)}
      {row("− Courses prévues (budget courses)", `−${fmt(s.groceries)}`)}
      {row("− Dépenses courantes estimées", `−${fmt(s.daily)}`, `${s.days} jour${s.days > 1 ? "s" : ""} × ${fmt(s.perDayVar)}/jour (ta médiane, hors courses)`)}
      {row("− Marge de sécurité (Options)", `−${fmt(s.margin)}`)}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0 2px", fontSize: ".8rem", borderTop: "1.5px solid var(--border)", marginTop: -1 }}>
        <b>Surplus</b><b style={{ color: "var(--purple)", fontVariantNumeric: "tabular-nums" }}>{fmt(s.raw)}</b>
      </div>
      <div style={{ fontSize: ".64rem", color: "var(--text3)", marginTop: 4 }}>Proposé : {fmt(s.amount)} (arrondi à la dizaine inférieure).</div>
      <div style={{ fontSize: ".64rem", color: "var(--text2)", lineHeight: 1.5, marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(112,184,224,.07)", border: "1px solid rgba(112,184,224,.22)" }}>
        Même base que le <b>reste à vivre</b>, avec en plus tes <b>dépenses courantes</b> (restos, transport…) estimées jusqu'à la paie — pour ne jamais te proposer de verser l'argent dont tu as besoin pour vivre d'ici là. « Verser » crée une opération 🐷 Épargne vers la cagnotte choisie.
      </div>
    </Sheet>
  );
}
