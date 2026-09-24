// Découpé depuis views.jsx en v1.40.0 — voir CARTOGRAPHIE.md
import { useState, useEffect } from "react";
import { sha256hex } from "./shared.jsx";

export function LockScreen({ pinHash, bioEnabled, onUnlock }) {
  const [pin,   setPin]   = useState("");
  const [error, setError] = useState(false);

  async function tryBio() {
    try {
      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
      await BiometricAuth.authenticate({ reason: "Accéder à Gestion du Budget" });
      onUnlock();
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
    if (k === "⌫") { setPin(p => p.slice(0,-1)); setError(false); return; }
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      const h = await sha256hex(next);
      if (h === pinHash) { onUnlock(); }
      else { setTimeout(() => { setPin(""); setError(true); }, 200); }
    }
  }

  const KEYS = [[1,2,3],[4,5,6],[7,8,9],["",0,"⌫"]];

  return (
    <div style={{ position:"fixed", inset:0, background:"#060810", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, zIndex:9999 }}>
      <div style={{ fontSize:"2.8rem", marginBottom:12 }}>🐷</div>
      <div style={{ fontSize:".95rem", fontWeight:800, marginBottom:4 }}>Gestion du Budget</div>
      <div style={{ fontSize:".65rem", color:"var(--text3)", marginBottom:28 }}>Entre ton code PIN pour continuer</div>

      {/* Points PIN */}
      <div style={{ display:"flex", gap:14, marginBottom:28 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width:14, height:14, borderRadius:"50%", background:i<pin.length?"#fff":"transparent", border:"2px solid rgba(255,255,255,.35)", transition:"background .1s" }} />
        ))}
      </div>

      {error && <div style={{ fontSize:".65rem", color:"var(--danger)", marginBottom:12, fontWeight:700 }}>PIN incorrect, réessaie</div>}

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
                : <button key={ki} onClick={() => pressKey(String(k))}
                    style={{ height:58, background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.1)", borderRadius:12, color:"#fff", fontSize:"1.2rem", fontWeight:700, cursor:"pointer", touchAction:"manipulation" }}>
                    {k}
                  </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
