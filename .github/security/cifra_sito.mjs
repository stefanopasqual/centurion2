#!/usr/bin/env node
/* CENTURION2 · cifra il sito prima della pubblicazione.

   Con il segreto SITE_PASSWORD:
   - ogni file del sito costruito viene cifrato con AES-256-GCM e salvato come x/<nome>.bin, dove
     <nome> è un HMAC del percorso: senza la password non si leggono né i contenuti né i nomi;
   - restano in chiaro solo la pagina di sblocco (index.html), il service worker che decifra (sw.js)
     e x/meta.json (sale, iterazioni, controllo della password);
   - le chiavi vengono da PBKDF2-SHA256 (600.000 iterazioni) sulla password e su un sale fisso, così
     restano valide fra una pubblicazione e l'altra finché la password non cambia.

   Senza il segreto il sito resta in chiaro, aperto a chiunque abbia l'indirizzo (come prima della cifratura).
   Con la variabile SITE_CHIUSO = 1 il sito si chiude: resta solo una pagina «accesso chiuso» e un service
   worker che, sui dispositivi che avevano già l'app, cancella cache e chiavi e si disinstalla.

   Uso: node .github/security/cifra_sito.mjs extracted/site   (SITE_PASSWORD e SITE_CHIUSO nell'ambiente) */
import { readFileSync, writeFileSync, readdirSync, statSync, rmSync, mkdirSync } from "node:fs";
import { join, relative, sep, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pbkdf2Sync, createHmac, createCipheriv, randomBytes } from "node:crypto";

const SALE = "59dfe36efb767aaeedb668e7edcd3c25";   // pubblico per natura: impedisce tabelle precalcolate generiche
const ITER = 600000;
const qui = dirname(fileURLToPath(import.meta.url));
const sito = process.argv[2];
if (!sito) { console.error("Uso: cifra_sito.mjs <cartella del sito>"); process.exit(2); }

const TIPI = {
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8", ".csv": "text/csv; charset=utf-8", ".xml": "application/xml", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
  ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".bin": "application/octet-stream", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
  ".oga": "audio/ogg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac", ".mp4": "video/mp4", ".webm": "video/webm",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".wasm": "application/wasm",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".pdf": "application/pdf", ".zip": "application/zip"
};

function elenca(dir) {
  const out = [];
  for (const n of readdirSync(dir)) { const p = join(dir, n); const s = statSync(p); if (s.isDirectory()) out.push(...elenca(p)); else if (s.isFile()) out.push(p); }
  return out;
}
function svuota(dir) { for (const n of readdirSync(dir)) rmSync(join(dir, n), { recursive: true, force: true }); }

const password = (process.env.SITE_PASSWORD || "").trim();
const chiuso = /^(1|si|sì|true|chiuso)$/i.test((process.env.SITE_CHIUSO || "").trim());
const vecchioSw = (() => { try { return readFileSync(join(sito, "sw.js"), "utf8"); } catch (e) { return ""; } })();

if (chiuso) {
  // sito chiuso: niente contenuti, solo l'avviso e il service worker che ripulisce i dispositivi
  svuota(sito);
  writeFileSync(join(sito, "index.html"), readFileSync(join(qui, "chiuso.html")));
  writeFileSync(join(sito, "sw.js"), readFileSync(join(qui, "sw_chiuso.js")));
  console.log("::warning::SITE_CHIUSO attivo: pubblicata solo la pagina «accesso chiuso».");
  process.exit(0);
}
if (!password) {
  console.log("::warning::SITE_PASSWORD non impostato: il sito resta in chiaro, aperto a chiunque abbia l'indirizzo. Imposta il segreto e rilancia il workflow per cifrarlo.");
  process.exit(0);
}
if (password.length < 10) { console.error("::error::SITE_PASSWORD troppo corta: servono almeno 10 caratteri."); process.exit(1); }

const bits = pbkdf2Sync(Buffer.from(password, "utf8"), Buffer.from(SALE, "hex"), ITER, 64, "sha256");
const kCifra = bits.subarray(0, 32), kNomi = bits.subarray(32, 64);
const nome = p => createHmac("sha256", kNomi).update(p, "utf8").digest("hex").slice(0, 32);
function cifra(dati, aad) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", kCifra, iv);
  c.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([c.update(dati), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]);   // come WebCrypto: iv | testo cifrato | tag
}

const versione = (/^const VERSIONE = "([^"]+)";/m.exec(vecchioSw) || [])[1] || "centurion";
const file = elenca(sito).map(f => ({ f, p: relative(sito, f).split(sep).join("/") }));
const blob = [];
let byte = 0;
for (const { f, p } of file) {
  const corpo = readFileSync(f), tipo = Buffer.from(TIPI[extname(p).toLowerCase()] || "application/octet-stream", "utf8");
  const testa = Buffer.alloc(2); testa.writeUInt16BE(tipo.length);
  blob.push({ n: nome(p), dati: cifra(Buffer.concat([testa, tipo, corpo]), p) });
  byte += corpo.length;
}
const nomi = new Set(blob.map(b => b.n));
if (nomi.size !== blob.length) { console.error("::error::nomi cifrati duplicati"); process.exit(1); }

svuota(sito);
mkdirSync(join(sito, "x"), { recursive: true });
for (const b of blob) writeFileSync(join(sito, "x", b.n + ".bin"), b.dati);
writeFileSync(join(sito, "x", "meta.json"), JSON.stringify({ v: 1, sale: SALE, iter: ITER, controllo: cifra(Buffer.from("centurion2", "utf8"), "controllo").toString("base64") }));
writeFileSync(join(sito, "index.html"), readFileSync(join(qui, "sblocco.html")));
writeFileSync(join(sito, "sw.js"), readFileSync(join(qui, "sw_cifrato.js"), "utf8").replace("__VERSIONE__", versione.replace(/[^\w.-]/g, "")));
bits.fill(0);
console.log(`Sito cifrato: ${blob.length} file, ${(byte / 1048576).toFixed(1)} MB; in chiaro solo index.html (sblocco), sw.js e x/meta.json. Cache: ${versione}`);
