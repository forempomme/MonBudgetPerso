// v1.63.0 — Comparer avec un relevé bancaire PDF (LECTURE SEULE)
// Rien n'est enregistré, envoyé, partagé ni modifié : le PDF est lu en mémoire,
// le résultat vit dans l'état de cet écran et disparaît à sa fermeture.
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { fmt } from "../utils.js";
import { readPdfRows, parseStatement, compareStatement, cagnottesTotal } from "../releve.js";

const dm = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "";
const signed = n => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
const col = n => n >= 0 ? "var(--success)" : "var(--danger)";

export function ReleveCompare({ data, onClose }) {
  const [phase, setPhase] = useState("pick");          // pick | reading | result | error
  const [stmt, setStmt] = useState(null);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [showOk, setShowOk] = useState(false);
  const inputRef = useRef(null);

  // À la fermeture : on oublie tout (relevé et résultat)
  useEffect(() => () => { setStmt(null); setRes(null); }, []);
  const close = () => { setStmt(null); setRes(null); if (inputRef.current) inputRef.current.value = ""; onClose(); };

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";    // le fichier n'est pas gardé
    if (!file) return;
    setPhase("reading"); setErr("");
    try {
      let buf = await file.arrayBuffer();
      const pages = await readPdfRows(buf);
      buf = null;
      const st = parseStatement(pages);
      if (!st.lines.length) throw new Error(st.error);
      setStmt(st);
      setRes(compareStatement(st, data));
      setPhase("result");
    } catch (ex) {
      setErr(ex?.message && !/^\s*$/.test(ex.message) ? ex.message : "Impossible de lire ce PDF.");
      setPhase("error");
    }
  }

  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 13, marginBottom: 8, overflow: "hidden" };
  const sec = (t, right, extra = {}) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".6rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text3)", margin: "14px 2px 6px", ...extra }}>
      <span>{t}</span>{right && <span style={{ marginLeft: "auto", letterSpacing: 0, textTransform: "none", fontSize: ".68rem" }}>{right}</span>}
    </div>
  );
  const line = (k, d, title, sub, amount, amountCol) => (
    <div key={k} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", borderTop: "1px solid var(--border-soft)", fontSize: ".72rem" }}>
      <span style={{ width: 36, fontSize: ".62rem", color: "var(--text3)", fontWeight: 700, flexShrink: 0 }}>{d}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        {sub && <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
      </div>
      <b style={{ fontFamily: "var(--mono)", color: amountCol || col(amount), whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{signed(amount)}</b>
    </div>
  );
  const bankSub = b => [b.details[0], b.kind === "card" ? "carte" : b.kind === "prlv" ? "prélèvement" : b.kind === "fee" ? "frais bancaires" : b.kind === "vir" ? (b.amount > 0 ? "virement reçu" : "virement émis") : ""].filter(Boolean).join(" · ");

  return createPortal(
    <div data-testid="releve-screen" style={{ position: "fixed", inset: 0, zIndex: 1100, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--border-soft)", background: "rgba(15,21,32,.97)" }}>
        <span style={{ fontSize: "1.1rem" }}>🏦</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: "1rem" }}>Comparer avec un relevé</div>
          <div style={{ fontSize: ".6rem", color: "var(--text3)", fontWeight: 700 }}>lecture seule · rien n'est enregistré ni modifié</div>
        </div>
        <button onClick={close} aria-label="Fermer" style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", color: "var(--text2)", cursor: "pointer" }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 30px" }}>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={onFile} style={{ display: "none" }} data-testid="releve-input" />

        {(phase === "pick" || phase === "error") && (
          <>
            <div onClick={() => inputRef.current?.click()} style={{ border: "2px dashed var(--accent)", borderRadius: 16, padding: "26px 14px", textAlign: "center", margin: "8px 0 12px", background: "rgba(112,184,224,.05)", cursor: "pointer" }}>
              <div style={{ fontSize: "1.9rem" }}>📄</div>
              <b style={{ fontSize: ".82rem" }}>Choisir le relevé PDF</b>
              <div style={{ fontSize: ".66rem", color: "var(--text2)", marginTop: 6, lineHeight: 1.5 }}>Le relevé téléchargé depuis ton espace client.<br />Il est lu <b>sur le téléphone</b>, rien n'est envoyé ni gardé.</div>
            </div>
            {phase === "error" && (
              <div style={{ ...card, padding: "10px 12px", borderColor: "rgba(200,112,112,.5)", fontSize: ".7rem", color: "var(--danger)", lineHeight: 1.5 }}>⚠️ {err}</div>
            )}
            <div style={{ fontSize: ".66rem", color: "var(--text2)", lineHeight: 1.6, padding: "10px 12px", borderRadius: 12, background: "rgba(112,184,224,.07)", border: "1px solid rgba(112,184,224,.22)" }}>
              <b style={{ color: "var(--text)" }}>Comment ça compare ?</b><br />
              • <b>Montant au centime</b> et <b>date</b> : carte = date d'achat du libellé (« CARTE 07/09 »), ±2 jours ; virements et prélèvements ±4 jours ; chèque : jusqu'à 90 jours après.<br />
              • Une ligne de banque = une seule opération de l'appli. Le libellé ne sert qu'à départager.<br />
              • Compris : dépenses, revenus, frais et revenus fixes, versements et retraits de cagnotte (virements vers / depuis ton livret).<br />
              • Ignorés : tickets resto et montants à part, opérations d'équilibre, virements entre cagnottes.<br />
              • Seules les lignes d'opérations sont lues : nom, adresse, IBAN et numéros de compte sont ignorés.
            </div>
          </>
        )}

        {phase === "reading" && <div style={{ textAlign: "center", padding: "50px 0", color: "var(--text2)", fontSize: ".8rem" }}>⏳ Lecture du relevé…</div>}

        {phase === "result" && stmt && res && (() => {
          const T = res.totals;
          const allOk = stmt.checks.every(c => c.ok);
          const explained = Math.round((T.missingTotal - T.extraTotal + T.nearTotal) * 100) / 100;
          const cagT = cagnottesTotal(data);
          return (
            <div data-testid="releve-result">
              <div style={{ ...card, padding: "9px 11px", fontSize: ".7rem", lineHeight: 1.55, marginTop: 4 }}>
                📄 Relevé du <b>{dm(stmt.start)}</b> au <b>{dm(stmt.end)}/{stmt.end.slice(0, 4)}</b> · {stmt.lines.length} opérations<br />
                {allOk
                  ? <><span style={{ color: "var(--success)", fontWeight: 800 }}>✓ Lecture vérifiée</span> <span style={{ color: "var(--text2)" }}>: {stmt.sections.length} sections, sous-totaux, totaux et soldes identiques au relevé</span></>
                  : <span style={{ color: "var(--warning)", fontWeight: 800 }}>⚠️ La lecture ne retombe pas exactement sur les totaux du relevé ({stmt.checks.filter(c => !c.ok).map(c => c.label).join(", ")}) : résultats à prendre avec prudence.</span>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 8 }}>
                {[[res.matched.length, "✅ retrouvées", "var(--success)", "var(--border)"], [res.missing.length, "❓ oubliées", "var(--warning)", "rgba(200,184,96,.5)"], [res.extra.length, "⚠️ en trop", "var(--danger)", "rgba(200,112,112,.5)"], [res.near.length, "≈ à vérifier", "var(--accent)", "rgba(112,184,224,.5)"]].map(([n, l, c, b]) => (
                  <div key={l} style={{ borderRadius: 10, padding: "7px 4px", textAlign: "center", border: `1px solid ${b}`, background: "var(--surface)" }}>
                    <b style={{ display: "block", fontSize: "1.05rem", color: c }}>{n}</b><span style={{ fontSize: ".56rem", fontWeight: 800, color: "var(--text2)" }}>{l}</span>
                  </div>
                ))}
              </div>

              <div style={{ ...card, padding: "9px 11px", fontSize: ".7rem", lineHeight: 1.65 }}>
                <div style={{ display: "flex" }}><span style={{ flex: 1, color: "var(--text2)" }}>Mouvements du relevé</span><b style={{ fontFamily: "var(--mono)" }}>{signed(T.bankNet)}</b></div>
                <div style={{ display: "flex" }}><span style={{ flex: 1, color: "var(--text2)" }}>Mouvements de l'appli (mêmes dates)</span><b style={{ fontFamily: "var(--mono)" }}>{signed(T.appNet)}</b></div>
                <div style={{ display: "flex", borderTop: "1px solid var(--border-soft)", marginTop: 4, paddingTop: 4 }}><span style={{ flex: 1 }}>Écart</span><b style={{ fontFamily: "var(--mono)", color: Math.abs(T.gap) < .005 ? "var(--success)" : "var(--warning)" }}>{Math.abs(T.gap) < .005 ? "aucun ✓" : signed(T.gap)}</b></div>
                {Math.abs(T.gap) >= .005 && <div style={{ fontSize: ".58rem", color: "var(--text3)" }}>= oubliées ({signed(T.missingTotal)}) − en trop ({signed(T.extraTotal)}) + à vérifier ({signed(T.nearTotal)}){Math.abs(T.gap - explained) < .005 ? " → tout l'écart est expliqué ✓" : ""}</div>}
                {stmt.savingsBalance != null && (
                  <div style={{ display: "flex", borderTop: "1px solid var(--border-soft)", marginTop: 4, paddingTop: 4 }}>
                    <span style={{ flex: 1, color: "var(--text2)" }}>Livret {fmt(stmt.savingsBalance)} · cagnottes {fmt(cagT)}</span>
                    <b style={{ color: Math.abs(stmt.savingsBalance - cagT) < .005 ? "var(--success)" : "var(--warning)" }}>{Math.abs(stmt.savingsBalance - cagT) < .005 ? "✓" : signed(stmt.savingsBalance - cagT)}</b>
                  </div>
                )}
              </div>

              {res.missing.length > 0 && <>
                {sec("❓ À la banque, pas dans l'appli", <b style={{ color: col(T.missingTotal) }}>{signed(T.missingTotal)}</b>)}
                <div style={card} data-testid="releve-missing">{res.missing.map(b => line(b.id, dm(b.opDate), b.label, bankSub(b), b.amount))}</div>
              </>}
              {res.extra.length > 0 && <>
                {sec("⚠️ Dans l'appli, pas à la banque", <b style={{ color: col(T.extraTotal) }}>{signed(T.extraTotal)}</b>)}
                <div style={card} data-testid="releve-extra">{res.extra.map(a => line(a.id, dm(a.date), `${a.icon} ${a.label}`, a.hint, a.amount))}</div>
              </>}
              {res.near.length > 0 && <>
                {sec("≈ Presque pareilles — à vérifier")}
                <div style={card} data-testid="releve-near">{res.near.map((n, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "8px 11px", borderTop: i ? "1px solid var(--border-soft)" : "none", fontSize: ".68rem" }}>
                    <div><div style={{ fontSize: ".54rem", color: "var(--text3)", fontWeight: 800, textTransform: "uppercase" }}>Banque · {dm(n.bank.opDate)}</div><div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.bank.label}</div><b style={{ fontFamily: "var(--mono)", color: col(n.bank.amount) }}>{signed(n.bank.amount)}</b></div>
                    <div><div style={{ fontSize: ".54rem", color: "var(--text3)", fontWeight: 800, textTransform: "uppercase" }}>Appli · {dm(n.app.date)}</div><div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.app.icon} {n.app.label}</div><b style={{ fontFamily: "var(--mono)", color: col(n.app.amount) }}>{signed(n.app.amount)}</b> <span style={{ fontSize: ".54rem", fontWeight: 800, color: "var(--accent)", background: "rgba(112,184,224,.12)", padding: "2px 6px", borderRadius: 6 }}>{n.hint}</span></div>
                  </div>
                ))}</div>
              </>}
              {res.aside.length > 0 && <>
                {sec("Mis de côté (normal)")}
                <div style={card}>{res.aside.map(a => line(a.id, dm(a.date), `${a.icon} ${a.label}`, a.reason, a.amount, "var(--text2)"))}</div>
              </>}
              {sec(`✅ Retrouvées (${res.matched.length})`, <span onClick={() => setShowOk(v => !v)} style={{ color: "var(--accent)", cursor: "pointer" }}>{showOk ? "Masquer ▴" : "Voir ▾"}</span>)}
              {showOk && (
                <div style={card}>{res.matched.map((m, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "7px 11px", borderTop: i ? "1px solid var(--border-soft)" : "none", fontSize: ".64rem" }}>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: ".52rem", color: "var(--text3)", fontWeight: 800 }}>BANQUE · {dm(m.bank.opDate)}</div><div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.bank.label}</div></div>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: ".52rem", color: "var(--text3)", fontWeight: 800 }}>APPLI · {dm(m.app.date)}</div><div style={{ display: "flex", gap: 4 }}><span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.app.icon} {m.app.label}</span><b style={{ fontFamily: "var(--mono)", color: col(m.app.amount) }}>{signed(m.app.amount)}</b></div></div>
                  </div>
                ))}</div>
              )}
              <div style={{ fontSize: ".62rem", color: "var(--text3)", lineHeight: 1.5, marginTop: 12 }}>Rien n'a été créé, pointé ni supprimé. Le relevé n'est pas conservé : fermer cet écran efface tout.</div>
              <button onClick={() => inputRef.current?.click()} style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--accent)", fontWeight: 800, cursor: "pointer" }}>📄 Comparer un autre relevé</button>
            </div>
          );
        })()}
      </div>
    </div>,
    document.body
  );
}
