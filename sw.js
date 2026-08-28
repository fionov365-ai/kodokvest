/* ============================================================
   Service worker: сайт открывается с домашнего экрана и работает без сети.
   Регистрируется из js/app.js — и только на настоящем сайте (не из
   dist-файла и не с диска, см. там же).

   Стратегия: СНАЧАЛА СЕТЬ, кэш — запасной путь.

   Обычный для PWA «сначала кэш» здесь был бы вредом: тренажёр правится почти
   каждый день, и ребёнок неделями сидел бы на старой версии, не понимая,
   почему у него нет нового урока. При «сначала сеть» свежесть бесплатна,
   а офлайн всё равно работает: каждый успешный ответ кладётся в кэш, и когда
   сети нет, страница поднимается из него.

   Чужие адреса не трогаем вообще: облако прогресса и шрифты — не наше дело.
   ============================================================ */
var CACHE = "kodokvest-v1";

/* Оболочка: то, без чего страница не откроется. Уроки (content/worldN.js)
   тоже здесь — иначе офлайн открылась бы карта миров без самих уроков. */
var SHELL = [
  "./", "./index.html", "./404.html", "./manifest.webmanifest", "./icon.svg",
  "./css/style.css",
  "./js/engine-mini.js", "./js/runtime.js", "./js/curriculum.js", "./js/games.js",
  "./js/warmups.js", "./js/ailab.js", "./js/projects.js", "./js/cheatsheet.js",
  "./js/cloud-config.js", "./js/cloud.js", "./js/app.js",
  "./content/world1.js", "./content/world2.js", "./content/world3.js",
  "./content/world4.js", "./content/world5.js"
];

self.addEventListener("install", function(e){
  /* Один недоступный файл не должен ронять всю установку, поэтому кладём
     по одному и молча пропускаем то, что не приехало. */
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(SHELL.map(function(u){
        return c.add(new Request(u, { cache: "reload" })).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch(err){ return; }
  if (url.origin !== self.location.origin) return;    /* облако и шрифты — мимо */

  e.respondWith(
    fetch(req).then(function(res){
      if (res && res.ok){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
      }
      return res;
    }).catch(function(){
      return caches.match(req).then(function(hit){
        if (hit) return hit;
        /* переход по адресу без сети: отдаём саму страницу, дальше игра
           поднимется из кэша и будет работать как обычно */
        if (req.mode === "navigate") return caches.match("./index.html");
        return new Response("", { status: 504, statusText: "нет сети" });
      });
    })
  );
});
