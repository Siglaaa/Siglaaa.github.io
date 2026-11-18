// Service worker de la version web : l'application s'ouvre aussi sans connexion.
// Page : réseau d'abord (une nouvelle version publiée est prise au lancement suivant), copie locale si le réseau
// manque ou tarde. Icônes et manifeste : copie locale d'abord. Police (Google Fonts) : gardée après le premier
// chargement. Les données du journal ne passent jamais par ici : elles restent dans la base du navigateur.
var VERSION = '2026-11-18-7ec7e7ef';
var CACHE = 'suivi-nutritionnel-' + VERSION;
var POLICE = 'suivi-nutritionnel-police';
var FICHIERS = ["./", "./index.html", "./manifest.webmanifest", "./icons/apple-touch-icon.png", "./icons/favicon-48.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png"];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('suivi-nutritionnel-') === 0 && k !== CACHE && k !== POLICE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function pageLocale() {
  return caches.open(CACHE).then(function (c) { return c.match('./index.html'); });
}

function reseauPuisCopie(req) {
  return new Promise(function (resolve) {
    var fini = false;
    function rendre(r) { if (!fini && r) { fini = true; resolve(r); } }
    var delai = setTimeout(function () { pageLocale().then(rendre); }, 4000);
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copie = res.clone();
        caches.open(CACHE).then(function (c) { return c.put('./index.html', copie); });
        clearTimeout(delai);
        rendre(res);
      } else {
        pageLocale().then(function (r) { clearTimeout(delai); rendre(r || res); });
      }
    }).catch(function () {
      pageLocale().then(function (r) { clearTimeout(delai); rendre(r || Response.error()); });
    });
  });
}

function copieDabord(req, nomCache) {
  return caches.open(nomCache).then(function (c) {
    return c.match(req).then(function (r) {
      if (r) return r;
      return fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(req.mode === 'navigate' ? reseauPuisCopie(req) : copieDabord(req, CACHE));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(copieDabord(req, POLICE));
  }
});
