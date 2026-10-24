// ─────────────────────────────────────────────────────────────────
//  v1.75.0 — Fenêtres de mot de passe des sauvegardes chiffrées
//   • BackupPasswordModal : 1ʳᵉ fois → choisir + confirmer ;
//     ensuite → saisir (vérifié contre backupKey) ; « oublié » → nouveau.
//   • ImportPasswordModal : déchiffrer une sauvegarde protégée.
//  Le mot de passe ne vit que dans l'état local de la fenêtre.
// ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Modal } from "../components/index.jsx";
import { MIN_PWD_LEN, pwdStrength } from "../backupCrypto.js";

const LBL = { fontSize: ".56rem", fontWeight: 800, color: "var(--text3)", letterSpacing: ".12em", textTransform: "uppercase", margin: "10px 2px 5px" };
const INP = { width: "100%", boxSizing: "border-box", background: "var(--surface2)", borderRadius: 12, fontSize: ".85rem" };
const HINT = { fontSize: ".66rem", color: "var(--text2)", lineHeight: 1.45 };
const ERR = { fontSize: ".66rem", color: "var(--danger)", fontWeight: 800, marginTop: 6 };
const S_COL = ["var(--danger)", "var(--danger)", "var(--warning)", "var(--warning)", "var(--success)", "var(--success)"];
const S_LBL = ["Trop court", "Faible", "Moyen", "Correct", "Solide", "Très solide"];

function Head({ icon, title, onClose }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: "1.2rem" }}>{icon}</span>
      <b style={{ flex: 1, fontSize: "1rem", fontWeight: 800 }}>{title}</b>
      <button className="btn btn-outline" onClick={onClose} style={{ width: 32, height: 32, padding: 0, minHeight: 0 }}>✕</button>
    </div>
  );
}

function PwdInput({ value, onChange, placeholder, testid, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input type={show ? "text" : "password"} value={value} placeholder={placeholder} autoFocus={autoFocus}
        autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        data-testid={testid} onChange={e => onChange(e.target.value)} style={{ ...INP, paddingRight: 44 }} />
      <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? "Masquer" : "Afficher"}
        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", fontSize: "1rem", cursor: "pointer", padding: 6 }}>
        {show ? "🙈" : "👁"}
      </button>
    </div>
  );
}

/**
 * onSubmit(password, isNew) → Promise<string|null> : message d'erreur, ou null si OK
 * (la fenêtre est alors fermée par l'appelant).
 */
export function BackupPasswordModal({ hasKey, onSubmit, onClose }) {
  const [create, setCreate] = useState(!hasKey);
  const [pw, setPw]   = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const s = pwdStrength(pw);

  async function go() {
    if (busy) return;
    if (create) {
      if (pw.length < MIN_PWD_LEN) return setErr(`${MIN_PWD_LEN} caractères minimum.`);
      if (pw !== pw2) return setErr("Les deux mots de passe ne correspondent pas.");
    } else if (!pw) return setErr("Entre ton mot de passe de sauvegarde.");
    setErr(""); setBusy(true);
    const e = await onSubmit(pw, create);
    setBusy(false);
    if (e) setErr(e);
  }

  return (
    <Modal onClose={() => !busy && onClose()} title="">
      <div data-testid="backup-pwd">
        <Head icon="🔐" title={create ? "Protéger tes sauvegardes" : "Sauvegarde chiffrée"} onClose={() => !busy && onClose()} />
        <div style={{ ...HINT, fontSize: ".72rem", marginBottom: 4 }}>
          {create
            ? (hasKey ? "Choisis un nouveau mot de passe. Les prochaines sauvegardes l'utiliseront ; les anciennes gardent l'ancien."
                      : "Choisis un mot de passe pour chiffrer tes sauvegardes. Sans lui, personne ne peut lire le fichier, même s'il est sur Drive.")
            : "Entre ton mot de passe de sauvegarde."}
        </div>
        <div style={LBL}>Mot de passe</div>
        <PwdInput value={pw} onChange={v => { setPw(v); setErr(""); }} placeholder={create ? `${MIN_PWD_LEN} caractères minimum` : "Mot de passe de sauvegarde"} testid="backup-pwd-1" autoFocus />
        {create && <>
          <div style={{ height: 5, borderRadius: 3, background: "var(--surface3, rgba(255,255,255,.08))", marginTop: 6, overflow: "hidden" }}>
            <div style={{ width: `${s * 20}%`, height: "100%", background: S_COL[s], transition: "width .2s" }} />
          </div>
          {pw && <div style={{ ...HINT, color: S_COL[s], marginTop: 3 }}>{S_LBL[s]}</div>}
          <div style={LBL}>Confirmer</div>
          <PwdInput value={pw2} onChange={v => { setPw2(v); setErr(""); }} placeholder="Retape le mot de passe" testid="backup-pwd-2" />
        </>}
        {err && <div style={ERR} data-testid="backup-pwd-err">{err}</div>}
        {create
          ? <div style={{ fontSize: ".66rem", lineHeight: 1.45, padding: "9px 11px", borderRadius: 12, marginTop: 10, color: "var(--text)",
              background: "color-mix(in srgb, var(--warning) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)" }}>
              ⚠️ <b>Note-le dans un endroit sûr.</b> Si tu l'oublies, tes sauvegardes chiffrées ne pourront plus être ouvertes, par personne.
            </div>
          : <div style={{ ...HINT, marginTop: 8 }}>
              Mot de passe oublié ? <span data-testid="backup-pwd-reset" onClick={() => { setCreate(true); setPw(""); setPw2(""); setErr(""); }}
                style={{ color: "var(--accent)", textDecoration: "underline", cursor: "pointer" }}>En choisir un nouveau</span> (les anciennes sauvegardes garderont l'ancien).
            </div>}
        <div className="grid-2" style={{ marginTop: 14, marginBottom: 0 }}>
          <button className="btn btn-outline" style={{ width: "100%" }} onClick={() => !busy && onClose()}>Annuler</button>
          <button className="btn btn-primary" data-testid="backup-pwd-ok" style={{ width: "100%", opacity: busy ? .7 : 1 }} onClick={go}>
            {busy ? "⏳ Chiffrement…" : "🔐 Chiffrer et partager"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** onSubmit(password) → Promise<string|null> (erreur ou null) */
export function ImportPasswordModal({ fileName, onSubmit, onClose }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy) return;
    if (!pw) return setErr("Entre le mot de passe de cette sauvegarde.");
    setErr(""); setBusy(true);
    const e = await onSubmit(pw);
    setBusy(false);
    if (e) setErr(e);
  }
  return (
    <Modal onClose={() => !busy && onClose()} title="">
      <div data-testid="import-pwd">
        <Head icon="📥" title="Sauvegarde protégée" onClose={() => !busy && onClose()} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 11px", borderRadius: 12, background: "var(--surface2)", border: "1px solid var(--border)", fontSize: ".72rem" }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {fileName}</span>
          <span style={{ fontSize: ".56rem", fontWeight: 800, padding: "2px 7px", borderRadius: 8, color: "var(--success)", background: "color-mix(in srgb, var(--success) 15%, transparent)", whiteSpace: "nowrap" }}>🔐 chiffrée</span>
        </div>
        <div style={LBL}>Mot de passe de la sauvegarde</div>
        <PwdInput value={pw} onChange={v => { setPw(v); setErr(""); }} placeholder="Mot de passe" testid="import-pwd-1" autoFocus />
        {err && <div style={ERR} data-testid="import-pwd-err">{err}</div>}
        <div className="grid-2" style={{ marginTop: 14, marginBottom: 0 }}>
          <button className="btn btn-outline" style={{ width: "100%" }} onClick={() => !busy && onClose()}>Annuler</button>
          <button className="btn btn-primary" data-testid="import-pwd-ok" style={{ width: "100%", opacity: busy ? .7 : 1 }} onClick={go}>
            {busy ? "⏳ Déchiffrement…" : "🔓 Déchiffrer"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Réglages de sécurité complémentaires (Options › Sécurité)
// ─────────────────────────────────────────────────────────────────
const RELOCK = [[0, "Immédiat"], [1, "1 min"], [5, "5 min"], [15, "15 min"], [-1, "Jamais"]];
const TRIES  = [[3, "3"], [5, "5"], [10, "10"], [0, "Illimité"]];

function Chips({ opts, value, onPick, testid }) {
  return (
    <div style={{ display: "flex", gap: 5 }} data-testid={testid}>
      {opts.map(([v, l]) => {
        const on = v === value;
        return (
          <button key={v} data-v={v} onClick={() => onPick(v)}
            style={{ flex: 1, minWidth: 0, padding: "8px 0", borderRadius: 11, fontSize: ".64rem", fontWeight: 800, cursor: "pointer", touchAction: "manipulation", whiteSpace: "nowrap",
              color: on ? "var(--accent)" : "var(--text2)", background: on ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--surface2)",
              border: `1px solid ${on ? "var(--accent)" : "var(--border)"}` }}>{l}</button>
        );
      })}
    </div>
  );
}

function Toggle({ on }) {
  return (
    <div style={{ width: 40, height: 22, borderRadius: 11, background: on ? "var(--accent)" : "var(--border)", position: "relative", transition: "background .2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
    </div>
  );
}

export function SecurityExtraSettings({ pinOn, relockDelay = 5, pinMaxTries = 5, openHidden = false, hideRecents = false, onSave }) {
  const lbl = { ...LBL, color: "var(--accent)", margin: "14px 2px 6px" };
  const relockTxt = relockDelay === -1 ? "Le PIN n'est demandé qu'au démarrage de l'appli."
    : relockDelay === 0 ? "Le PIN est redemandé dès que tu quittes l'appli, même une seconde."
    : `Le PIN est redemandé si l'appli reste ${relockDelay} min en arrière-plan.`;
  const triesTxt = pinMaxTries === 0 ? "Aucune attente, essais illimités."
    : `Après ${pinMaxTries} erreurs : attente de 30 s, puis 1 min, 5 min, 15 min si les erreurs continuent.`;
  return (
    <div data-testid="security-extra">
      <div style={{ opacity: pinOn ? 1 : .4, pointerEvents: pinOn ? "auto" : "none" }}>
        <div style={lbl}>⏱ Reverrouiller après</div>
        <Chips opts={RELOCK} value={relockDelay} onPick={v => onSave?.({ relockDelay: v })} testid="relock-chips" />
        <div style={{ ...HINT, fontSize: ".6rem", margin: "5px 3px 0" }}>{relockTxt}</div>
        <div style={lbl}>🚫 Essais du PIN avant attente</div>
        <Chips opts={TRIES} value={pinMaxTries} onPick={v => onSave?.({ pinMaxTries: v })} testid="tries-chips" />
        <div style={{ ...HINT, fontSize: ".6rem", margin: "5px 3px 0" }}>{triesTxt}</div>
      </div>
      <div style={lbl}>🙈 Discrétion</div>
      <div data-testid="open-hidden" onClick={() => onSave?.({ openHidden: !openHidden })}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: openHidden ? "rgba(112,184,224,.06)" : "var(--surface2)", border: `1px solid ${openHidden ? "rgba(112,184,224,.2)" : "var(--border)"}`, borderRadius: 10, marginBottom: 8, cursor: "pointer", touchAction: "manipulation" }}>
        <span style={{ fontSize: "1rem" }}>👁</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: ".76rem", fontWeight: 700, color: openHidden ? "var(--accent)" : "var(--text2)" }}>Ouvrir l'appli en mode discret</div>
          <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 1 }}>Montants masqués à chaque ouverture · bouton 👁 en haut pour les afficher</div>
        </div>
        <Toggle on={openHidden} />
      </div>
      {/* v1.77.1 : réglable, désactivé par défaut — sur le Pixel, masquer l'aperçu
          bloquait aussi les captures d'écran de l'appli */}
      <div data-testid="hide-recents" onClick={() => onSave?.({ hideRecents: !hideRecents })}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: hideRecents ? "rgba(112,184,224,.06)" : "var(--surface2)", border: `1px solid ${hideRecents ? "rgba(112,184,224,.2)" : "var(--border)"}`, borderRadius: 10, cursor: "pointer", touchAction: "manipulation" }}>
        <span style={{ fontSize: "1rem" }}>🗂</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: ".76rem", fontWeight: 700, color: hideRecents ? "var(--accent)" : "var(--text2)" }}>Masquer l'aperçu dans les applis récentes</div>
          <div style={{ fontSize: ".6rem", color: "var(--text3)", marginTop: 1 }}>Android 13+ · <b style={{ color: "var(--warning)" }}>sur certains téléphones (dont le Pixel), bloque aussi les captures d'écran</b></div>
        </div>
        <Toggle on={hideRecents} />
      </div>
    </div>
  );
}
