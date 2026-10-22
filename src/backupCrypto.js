// ─────────────────────────────────────────────────────────────────
//  v1.75.0 — Chiffrement des sauvegardes
//
//  • Clé dérivée du mot de passe : PBKDF2-HMAC-SHA256, 600 000 itérations
//    (recommandation OWASP), sel aléatoire de 16 octets.
//  • Chiffrement : AES-256-GCM, IV aléatoire de 12 octets par fichier
//    (GCM authentifie aussi : un fichier modifié ou un mauvais mot de
//    passe fait échouer le déchiffrement, sans résultat partiel).
//  • Le mot de passe n'est JAMAIS stocké. L'appli garde un « vérificateur »
//    (backupKey) : sel + empreinte SHA-256 d'une 2ᵉ moitié de clé dérivée,
//    distincte de la clé de chiffrement. Il sert seulement à refuser une
//    faute de frappe avant d'exporter.
//  Tout passe par WebCrypto (natif dans la WebView Android), rien ne sort
//  de l'appareil.
// ─────────────────────────────────────────────────────────────────
export const BACKUP_FORMAT = "gestion-budget-chiffre";
export const PBKDF2_ITER   = 600000;
export const MIN_PWD_LEN   = 8;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(b64) {
  const s = atob(String(b64 || ""));
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}
function rand(n) { const u = new Uint8Array(n); crypto.getRandomValues(u); return u; }

// 512 bits dérivés : [0..32[ = clé AES, [32..64[ = matière du vérificateur
async function deriveBits(password, salt, iter) {
  const base = await crypto.subtle.importKey("raw", enc.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, 512);
  return new Uint8Array(bits);
}
async function aesKey(raw32) {
  return crypto.subtle.importKey("raw", raw32, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function checkOf(bits) {
  return toB64(new Uint8Array(await crypto.subtle.digest("SHA-256", bits.slice(32, 64))));
}
function sameStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Crée le vérificateur à partir d'un nouveau mot de passe → { key, bits } (une seule dérivation). */
export async function createBackupKey(password) {
  const salt = rand(16);
  const bits = await deriveBits(password, salt, PBKDF2_ITER);
  return { key: { v: 1, salt: toB64(salt), iter: PBKDF2_ITER, check: await checkOf(bits) }, bits };
}

/** Le mot de passe correspond-il au vérificateur ? Renvoie les bits dérivés si oui, sinon null. */
export async function verifyBackupPassword(password, backupKey) {
  if (!backupKey?.salt || !backupKey?.check) return null;
  const bits = await deriveBits(password, fromB64(backupKey.salt), backupKey.iter || PBKDF2_ITER);
  return sameStr(await checkOf(bits), backupKey.check) ? bits : null;
}

/** Chiffre le texte JSON de la sauvegarde. `bits` = résultat de verifyBackupPassword. */
export async function encryptBackup(jsonText, bits, backupKey) {
  const iv = rand(12);
  const key = await aesKey(bits.slice(0, 32));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(jsonText));
  return JSON.stringify({
    format: BACKUP_FORMAT, v: 1, kdf: "PBKDF2-SHA256", iter: backupKey.iter || PBKDF2_ITER,
    salt: backupKey.salt, iv: toB64(iv), data: toB64(new Uint8Array(ct)),
  });
}

/** Le contenu (objet déjà parsé) est-il une sauvegarde chiffrée ? */
export function isEncryptedBackup(obj) {
  return !!obj && typeof obj === "object" && obj.format === BACKUP_FORMAT && typeof obj.data === "string";
}

/** Déchiffre ; lève une erreur « Mot de passe incorrect » si la clé ne convient pas. */
export async function decryptBackup(obj, password) {
  const bits = await deriveBits(password, fromB64(obj.salt), obj.iter || PBKDF2_ITER);
  const key = await aesKey(bits.slice(0, 32));
  let pt;
  try { pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(obj.iv) }, key, fromB64(obj.data)); }
  catch { throw new Error("Mot de passe incorrect (ou fichier abîmé)."); }
  return dec.decode(pt);
}

/** Note indicative de solidité 0..5 (affichage uniquement). */
export function pwdStrength(p) {
  p = String(p || ""); let s = 0;
  if (p.length >= MIN_PWD_LEN) s++; if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
