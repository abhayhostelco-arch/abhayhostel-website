/* Abhay Hostel's service worker intentionally stores no responses. Authenticated
   pages and Supabase requests always remain network-only. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
