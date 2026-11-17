/* CENTURION2 · service worker del sito cifrato.
   I file del sito sono pubblicati solo cifrati (AES-256-GCM) in x/<nome>.bin, dove <nome> è un HMAC del
   percorso. Dopo lo sblocco le chiavi restano in IndexedDB su questo dispositivo e questo service worker
   decifra ogni richiesta del sito. Cache come il service worker originale (modelli, audio e immagini
   cache-first, il resto dalla rete con copia), ma in cache restano solo i file cifrati.
   ?blocca nell'indirizzo cancella chiavi e cache e torna alla pagina di sblocco. */
const VERSIONE = "__VERSIONE__";
const CACHE = VERSIONE + "-cifrato", CACHE_EXT = VERSIONE + "-esterni";
const DB = "centurion2-chiavi", STORE = "chiavi";
const base = new URL(self.registration.scope);
const te = new TextEncoder();

self.addEventListener("install", e => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== CACHE_EXT).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));

/* ---------- chiavi ---------- */
function apriDb() {
  return new Promise((ok, ko) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
}
let chiavi = null;   // promessa delle chiavi importate (o null)
async function leggiChiavi() {
  const db = await apriDb();
  const rec = await new Promise((ok, ko) => { const q = db.transaction(STORE, "readonly").objectStore(STORE).get("k"); q.onsuccess = () => ok(q.result || null); q.onerror = () => ko(q.error); });
  db.close();
  if (!rec) return null;
  if (rec.enc && rec.nomi) return { enc: rec.enc, nomi: rec.nomi };
  if (rec.raw) {   // browser che non salvano le CryptoKey in IndexedDB: si salvano i byte e si importano qui
    const b = new Uint8Array(rec.raw);
    return { enc: await crypto.subtle.importKey("raw", b.slice(0, 32), { name: "AES-GCM" }, false, ["decrypt"]),
             nomi: await crypto.subtle.importKey("raw", b.slice(32, 64), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]) };
  }
  return null;
}
async function chiaviCorrenti() {   // un "nessuna chiave" non resta in memoria: lo sblocco può arrivare in ogni momento
  if (chiavi) { const k = await chiavi; if (k) return k; }
  chiavi = leggiChiavi().catch(() => null);
  return chiavi;
}
async function blocca() {
  chiavi = null;
  try { const db = await apriDb(); await new Promise(ok => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).delete("k"); t.oncomplete = ok; t.onerror = ok; }); db.close(); } catch (e) {}
  for (const k of await caches.keys()) await caches.delete(k);
}
self.addEventListener("message", e => { if (e.data === "chiavi") chiavi = null; });   // nuove chiavi salvate dalla pagina di sblocco

/* ---------- file cifrati ---------- */
const hex = b => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
async function nome(k, p) { return hex(new Uint8Array(await crypto.subtle.sign("HMAC", k.nomi, te.encode(p))).slice(0, 16)); }
const datiPesanti = p => !/manifest[.]json$/.test(p) && /^(modelli|audio|assets)\//.test(p);
async function scarica(n, cacheFirst) {
  const url = new URL("x/" + n + ".bin", base).href, c = await caches.open(CACHE);
  if (cacheFirst) { const hit = await c.match(url); if (hit) return hit.arrayBuffer(); }
  let r;
  try { r = await fetch(url, { cache: "no-cache" }); }
  catch (err) { const hit = await c.match(url); if (hit) return hit.arrayBuffer(); throw err; }
  if (r.status === 404) return null;
  if (!r.ok) { const hit = await c.match(url); if (hit) return hit.arrayBuffer(); throw new Error("HTTP " + r.status); }
  c.put(url, r.clone()).catch(() => {});
  return r.arrayBuffer();
}
async function decifra(k, p, buf) {
  const b = new Uint8Array(buf);
  const t = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12), additionalData: te.encode(p) }, k.enc, b.slice(12)));
  const n = (t[0] << 8) | t[1];
  return { tipo: new TextDecoder().decode(t.subarray(2, 2 + n)), corpo: t.subarray(2 + n) };
}
function risposta(req, f) {
  const n = f.corpo.length, h = { "Content-Type": f.tipo, "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  if (m && (m[1] || m[2])) {   // richieste parziali (audio e video, soprattutto su Safari)
    let a = m[1] ? +m[1] : Math.max(0, n - +m[2]), z = m[1] && m[2] ? Math.min(+m[2], n - 1) : n - 1;
    if (a > z || a >= n) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${n}` } });
    return new Response(f.corpo.slice(a, z + 1), { status: 206, headers: Object.assign(h, { "Content-Range": `bytes ${a}-${z}/${n}`, "Content-Length": String(z - a + 1) }) });
  }
  return new Response(f.corpo, { status: 200, headers: Object.assign(h, { "Content-Length": String(n) }) });
}
const sblocco = () => fetch(new URL("index.html", base).href, { cache: "no-cache" })
  .catch(() => new Response("<!doctype html><meta charset=utf-8><p>CENTURION2: serve la rete per lo sblocco.</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } }));

function percorso(url) {
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null;
  let p; try { p = decodeURIComponent(url.pathname.slice(base.pathname.length)); } catch (e) { return null; }
  if (p === "" || p.endsWith("/")) p += "index.html";
  return p;
}
async function servi(req, url, p) {
  const nav = req.mode === "navigate";
  if (nav && url.searchParams.has("blocca")) { await blocca(); return sblocco(); }
  const k = await chiaviCorrenti();
  if (!k) return nav ? sblocco() : new Response("Sito cifrato: sbloccalo dalla pagina iniziale.", { status: 403 });
  let buf;
  try { buf = await scarica(await nome(k, p), datiPesanti(p)); }
  catch (err) { return new Response("Rete non disponibile", { status: 503 }); }
  if (!buf) return new Response("Non trovato", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  try { return risposta(req, await decifra(k, p, buf)); }
  catch (err) { await blocca(); return nav ? sblocco() : new Response("Chiave non valida: la password è cambiata.", { status: 403 }); }   // password cambiata: si torna allo sblocco
}

/* ---------- servizi esterni (tile delle mappe): cache-first come prima, sono dati pubblici ---------- */
const esterno = u => /arcgisonline|elevation-tiles|openstreetmap|opentopomap|cartocdn/.test(u);
async function daEsterni(req) {
  const c = await caches.open(CACHE_EXT), hit = await c.match(req);
  if (hit && !(hit.type === "opaque" && req.mode === "cors")) return hit;
  try { const r = await fetch(req); if (r && r.ok && r.type !== "opaque") c.put(req, r.clone()).catch(() => {}); return r; }
  catch (err) { if (hit) return hit; throw err; }
}

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== base.origin) { if (esterno(req.url)) e.respondWith(daEsterni(req)); return; }
  const p = percorso(url);
  if (p == null || p === "sw.js" || p.startsWith("x/")) return;   // il service worker e i file cifrati passano dalla rete
  e.respondWith(servi(req, url, p));
});
