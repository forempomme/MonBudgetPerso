// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useEffect } from "react";
import { sha256hex } from "./shared.jsx";

// ── v1.75.0 : limite d'essais du PIN ─────────────────────────────
// Compteur gardé hors des données (clé à part) : il survit à la fermeture
// de l'appli et n'entre pas dans les sauvegardes.
export const PIN_GUARD_KEY = "budget_pin_guard_v1";
export const PIN_WAITS = [30, 60, 300, 900]; // secondes : 30 s, 1 min, 5 min, 15 min
function readGuard() {
  try { const g = JSON.parse(localStorage.getItem(PIN_GUARD_KEY) || "{}"); return { fails: g.fails | 0, level: g.level | 0, until: Number(g.until) || 0 }; }
  catch { return { fails: 0, level: 0, until: 0 }; }
}
function writeGuard(g) { try { localStorage.setItem(PIN_GUARD_KEY, JSON.stringify(g)); } catch { /* stockage plein */ } }
export function clearPinGuard() { try { localStorage.removeItem(PIN_GUARD_KEY); } catch { /* ignore */ } }
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function LockScreen({ pinHash, bioEnabled, maxTries = 5, onUnlock }) {
  const [pin,   setPin]   = useState("");
  const [error, setError] = useState(false);
  const [guard, setGuard] = useState(readGuard);
  const [now,   setNow]   = useState(Date.now());
  const waitLeft = Math.max(0, Math.ceil((guard.until - now) / 1000));
  const waiting  = waitLeft > 0;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [waiting]);
  function unlock() { clearPinGuard(); onUnlock(); }

  async function tryBio() {
    try {
      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
      await BiometricAuth.authenticate({ reason: "Accéder à Gestion du Budget" });
      unlock();
    } catch {
      // Biométrie indisponible ou refusée → PIN de secours affiché
    }
  }

  // Déclenche automatiquement la biométrie à l'ouverture
  // Délai 300ms : le bridge Capacitor n'est pas encore initialisé au premier render
  useEffect(() => {
    if (!bioEnabled) return;
    const timer = setTimeout(() => tryBio(), 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pressKey(k) {
    if (waiting) return;
    if (k === "⌫") { setPin(p => p.slice(0,-1)); setError(false); return; }
    const next = pin + k;
    if (next.length > 4) return;
    setPin(next);
    if (next.length === 4) {
      const h = await sha256hex(next);
      if (h === pinHash) { unlock(); return; }
      const g = readGuard();
      g.fails += 1;
      if (maxTries > 0 && g.fails >= maxTries) {
        g.until = Date.now() + PIN_WAITS[Math.min(g.level, PIN_WAITS.length - 1)] * 1000;
        g.level += 1; g.fails = 0;
      }
      writeGuard(g);
      setTimeout(() => { setPin(""); setError(true); setGuard(g); setNow(Date.now()); }, 200);
    }
  }
  const triesLeft = maxTries > 0 ? maxTries - guard.fails : null;

  const KEYS = [[1,2,3],[4,5,6],[7,8,9],["",0,"⌫"]];

  return (
    <div style={{ position:"fixed", inset:0, background:"var(--bg, #060810)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, zIndex:9999 }}>
      <div style={{ fontSize:"2.8rem", marginBottom:12 }}>🐷</div>
      <div style={{ fontSize:".95rem", fontWeight:800, marginBottom:4 }}>Gestion du Budget</div>
      <div style={{ fontSize:".65rem", color:"var(--text3)", marginBottom:28 }}>Entre ton code PIN pour continuer</div>

      {/* Points PIN */}
      <div style={{ display:"flex", gap:14, marginBottom:28 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width:14, height:14, borderRadius:"50%", background:i<pin.length?"#fff":"transparent", border:"2px solid rgba(255,255,255,.35)", transition:"background .1s" }} />
        ))}
      </div>

      {waiting ? (
        <div data-testid="pin-wait" style={{ textAlign:"center", marginBottom:16 }}>
          <div style={{ fontSize:".72rem", color:"var(--danger)", fontWeight:800 }}>Trop d'essais incorrects</div>
          <div style={{ fontSize:".66rem", color:"var(--text2)", marginTop:4 }}>Réessaie dans <b style={{ color:"var(--text)", fontVariantNumeric:"tabular-nums" }}>{mmss(waitLeft)}</b></div>
        </div>
      ) : error && (
        <div data-testid="pin-error" style={{ fontSize:".65rem", color:"var(--danger)", marginBottom:12, fontWeight:700 }}>
          PIN incorrect{triesLeft != null && triesLeft <= 2 ? ` — encore ${triesLeft} essai${triesLeft > 1 ? "s" : ""} avant une attente` : ", réessaie"}
        </div>
      )}

      {/* Biométrie */}
      {bioEnabled && (
        <button onClick={tryBio} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(112,184,224,.1)", border:"1.5px solid var(--accent)", borderRadius:30, padding:"10px 22px", color:"var(--accent)", fontWeight:700, fontSize:".75rem", cursor:"pointer", marginBottom:20, touchAction:"manipulation" }}>
          <span style={{ fontSize:"1.2rem" }}>👆</span> Empreinte digitale
        </button>
      )}

      {/* Clavier */}
      <div style={{ display:"flex", flexDirection:"column", gap:8, width:"100%", maxWidth:240 }}>
        {KEYS.map((row, ri) => (
          <div key={ri} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {row.map((k, ki) => (
              k === ""
                ? <div key={ki} />
                : <button key={ki} onClick={() => pressKey(String(k))} disabled={waiting}
                    style={{ opacity: waiting ? .25 : 1, height:58, background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.1)", borderRadius:12, color:"#fff", fontSize:"1.2rem", fontWeight:700, cursor:"pointer", touchAction:"manipulation" }}>
                    {k}
                  </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
