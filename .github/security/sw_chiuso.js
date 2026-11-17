/* CENTURION2 · sito chiuso: sui dispositivi che avevano l'app cancella cache e chiavi, poi si disinstalla. */
self.addEventListener("install", e => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  try { indexedDB.deleteDatabase("centurion2-chiavi"); } catch (err) {}
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: "window" })) { try { c.navigate(c.url); } catch (err) {} }
})()));
