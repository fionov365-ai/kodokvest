/* ============================================================
   Кодоквест — игровая оболочка.
   Экраны: миры → мир → урок, плюс песочница.
   Интерпретатор дёргается только через Runtime.
   ============================================================ */
(function(){
"use strict";

var app = document.getElementById("app");

var BADGES = [
  { id:"first",   em:"🚀", name:"Первый запуск",  desc:"запустил код" },
  { id:"fixer",   em:"🔧", name:"Отладчик",       desc:"исправил ошибку" },
  { id:"artist",  em:"🎨", name:"Художник",       desc:"3 рисунка" },
  { id:"sniper",  em:"🎯", name:"Снайпер",        desc:"3 урока с первой попытки" },
  { id:"ten",     em:"⚡", name:"Первый десяток", desc:"10 уроков пройдено" },
  { id:"perfect", em:"💎", name:"Перфекционист",  desc:"5 раз по три звезды" },
  { id:"explorer",em:"🧪", name:"Исследователь",  desc:"10 запусков в песочнице" },
  { id:"world1",  em:"🌱", name:"Мир пройден",    desc:"все уроки одного мира" },
  { id:"builder", em:"🏗", name:"Строитель",      desc:"собрал проект целиком" }
];
var RANKS = [
  [0,"Новичок"], [150,"Ученик"], [400,"Кодер"], [700,"Инженер"],
  [1200,"Хакер"], [1800,"Мастер"], [2600,"Легенда"], [3600,"Гуру"]
];
var STAR_XP = [0, 25, 60, 100];

/* ===== код входа в панель наставника =====
   Панель открывается адресом сайта с #admin на конце, например
     https://fionov365-ai.github.io/kodokvest/#admin
   Чтобы сменить код — поменяй строку ниже и перезалей сайт.
   Честно: сайт публичный, и этот код видно в исходнике страницы.
   Это защита от случайного нажатия, а не настоящий пароль. */
var ADMIN_CODE = "kodokvest-2026";

/* ================= сохранение =================
   Форма прогресса описана ОДИН раз — тремя списками ниже. Раньше её
   переписывали руками в четырёх местах (загрузка, смена ученика, сброс в
   панели наставника, загрузка файла), и каждое новое поле забывали хотя бы
   в двух из них: так S.games и S.gamesPlayed остались вне слияния и вне
   очистки при смене ученика, а «Сбросить весь прогресс» не сбрасывал
   разминки и «Ты и ИИ». Добавляешь поле — дописываешь его в один список,
   и все четыре места узнают о нём сами.

     PROGRESS_MAPS  множества и словари «id → значение»
     PROGRESS_NUMS  счётчики
     KEEP_ON_RESET  что НЕ трогает сброс в панели наставника: имя ученика,
                    расписание и то, что ребёнок сделал сам (песочница,
                    свои версии игр). Смена ученика чистит и это тоже.
   ============================================================ */
var KEY = "kodokvest_v2";
var PROGRESS_MAPS = ["stars","log","drawDone","warmups","ailab","games","gamesPlayed",
                     "days","daily","shields","projects"];
var PROGRESS_NUMS = ["xp","sandboxRuns","firstTry","perfect"];
var KEEP_ON_RESET = ["games"];

/* пустой прогресс: только структура, без данных */
function blankProgress(){
  var o = { v:2, badges:[], sandbox:null, name:"", schedule:{ days:[] } };
  PROGRESS_MAPS.forEach(function(k){ o[k] = {}; });
  PROGRESS_NUMS.forEach(function(k){ o[k] = 0; });
  return o;
}
/* привести объект к нужной форме, ничего не потеряв. Настройки устройства
   (admin) живут отдельно от прогресса и на сервер не уходят. */
function ensureShape(o){
  o.v = 2;
  PROGRESS_MAPS.forEach(function(k){ if (!o[k] || typeof o[k] !== "object") o[k] = {}; });
  PROGRESS_NUMS.forEach(function(k){ if (typeof o[k] !== "number") o[k] = 0; });
  if (!Array.isArray(o.badges)) o.badges = [];
  if (typeof o.sandbox !== "string") o.sandbox = null;
  if (typeof o.name !== "string") o.name = "";
  if (!o.schedule || typeof o.schedule !== "object") o.schedule = { days:[] };
  if (!Array.isArray(o.schedule.days)) o.schedule.days = [];
  if (!o.admin || typeof o.admin !== "object") o.admin = { unlockAll:false };
  return o;
}
/* стереть результаты занятий, оставив имя, расписание и сделанное ребёнком */
function clearResults(o){
  PROGRESS_MAPS.forEach(function(k){ if (KEEP_ON_RESET.indexOf(k) < 0) o[k] = {}; });
  PROGRESS_NUMS.forEach(function(k){ o[k] = 0; });
  o.badges = [];
  return ensureShape(o);
}
/* стереть всё, включая имя и сделанное ребёнком — это смена ученика */
function clearAll(o){
  clearResults(o);
  KEEP_ON_RESET.forEach(function(k){ o[k] = {}; });
  o.sandbox = null; o.name = ""; o.schedule = { days:[] };
  return ensureShape(o);
}

var S = blankProgress();
S.admin = { unlockAll:false };
try {
  var raw = localStorage.getItem(KEY);
  if (raw) S = Object.assign(S, JSON.parse(raw));
  else {
    var old = localStorage.getItem("kodokvest_v1");
    if (old){
      var o = JSON.parse(old);
      S.xp = o.xp || 0; S.badges = o.badges || []; S.sandbox = o.sandbox || null;
      S.sandboxRuns = o.sandboxRuns || 0;
      Object.keys(o.stars || {}).forEach(function(i){
        var id = LEGACY_ORDER[+i];
        if (id) S.stars[id] = o.stars[i];
      });
    }
  }
} catch(e){}
ensureShape(S);
function saveLocal(){
  S.savedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){}
}
function save(){ saveLocal(); schedulePush(); }

/* ================= дневной стрик и задача дня =================
   Стрик — сколько дней ПОДРЯД ребёнок занимался. Считаем не по счётчику,
   а по множеству дат в S.days («ГГГГ-ММ-ДД» по местному времени): так
   слияние двух устройств — это просто объединение дней, и никакой перевод
   часов или летнее время счётчик не сломает. Даты для арифметики берём
   в полдень — тогда сдвиг на час туда-сюда не перепрыгивает через сутки. */
function dayKey(d){
  d = d || new Date();
  var p = function(x){ return (x < 10 ? "0" : "") + x; };
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function shiftDay(key, delta){
  var d = new Date(key + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}
/* базовые функции работают с ЛЮБЫМ набором дней (объект дата→1) — это нужно
   панели наставника, где считается стрик и чужого ученика по его данным */
function activeIn(days, key){ return !!(days && days[key]); }
/* сколько дней подряд заканчивается ровно этой датой */
function streakEndingIn(days, key){
  var n = 0, cur = key;
  while (activeIn(days, cur)){ n++; cur = shiftDay(cur, -1); }
  return n;
}
/* длина серии, НАЧИНАЮЩЕЙСЯ этой датой (идём вперёд) */
function streakForwardIn(days, key){
  var n = 0, cur = key;
  while (activeIn(days, cur)){ n++; cur = shiftDay(cur, 1); }
  return n;
}
/* текущий стрик: если сегодня уже занимались — считаем по сегодня; если нет,
   но занимались вчера — стрик ещё живой (продолжится, если позаниматься сегодня);
   если и вчера не было — стрик прерван, показываем 0 */
function streakCurrentIn(days){
  var today = dayKey();
  if (activeIn(days, today)) return streakEndingIn(days, today);
  var y = shiftDay(today, -1);
  if (activeIn(days, y)) return streakEndingIn(days, y);
  return 0;
}
/* рекорд: самая длинная серия за всю историю в наборе дней */
function streakBestIn(days){
  var keys = Object.keys(days || {}).sort();
  var best = 0;
  for (var i = 0; i < keys.length; i++){
    /* считаем каждую серию один раз — только от её первого дня */
    if (!activeIn(days, shiftDay(keys[i], -1))){
      var run = streakForwardIn(days, keys[i]);
      if (run > best) best = run;
    }
  }
  return best;
}
/* обёртки над локальным прогрессом.
   activeOn — НАСТОЯЩЕЕ занятие в этот день: по нему горит огонёк и считается
   напоминание по расписанию. Серия же считается по «закрытым» дням
   (coveredNow: занятие ИЛИ щит), поэтому один пропуск со щитом её не рвёт. */
function activeOn(key){ return activeIn(S.days, key); }
function streakCurrent(){ return streakCurrentIn(coveredNow()); }
function streakBest(){ return streakBestIn(coveredNow()); }
/* отметить, что сегодня занимались (урок, разминка или задача дня).
   Возвращает true, если сегодняшний день засчитан впервые. */
function markActiveToday(){
  S.days = S.days || {};
  var k = dayKey();
  if (S.days[k]) return false;
  S.days[k] = 1;
  useShield();       /* вернулся после пропуска — щит закрывает вчерашнюю дыру */
  pruneDays();
  save();
  try { refreshTop(); } catch(e){}
  return true;
}
/* не даём множествам дней расти без предела — хватает истории за ~2 года */
function pruneDays(){
  [S.days, S.shields].forEach(function(set){
    var keys = Object.keys(set || {});
    if (keys.length <= 800) return;
    keys.sort();
    keys.slice(0, keys.length - 800).forEach(function(k){ delete set[k]; });
  });
}

/* ================= щит для стрика =================
   Один пропущенный день не должен обнулять серию — это главная причина
   бросить занятия. Щит закрывает ровно один пропуск.

   Щиты НЕ храним счётчиком. Счётчик разъехался бы при слиянии двух устройств —
   та же грабля, что и со стриком. Вместо этого храним МНОЖЕСТВО ДАТ, на которые
   щит потрачен (S.shields), а сколько щитов заработано — вычисляем из числа
   дней занятий. Оба множества сливаются объединением, поэтому на любом
   устройстве получается одно и то же.

   Щит срабатывает не в полночь, а в момент, когда ребёнок вернулся и что-то
   сделал: статический сайт не может выполнить код, пока он закрыт (та же
   причина, по которой напоминания живут только внутри сайта). Заодно это
   честнее — щит награждает возвращение, а не отсутствие. */
var SHIELD_EVERY = 5;   /* один щит за каждые 5 дней занятий */
var SHIELD_MAX   = 2;   /* больше двух про запас не копится */

/* дни, которые считаются для серии: настоящие занятия плюс закрытые щитом.
   Работает с ЛЮБЫМ набором данных — это нужно панели наставника, где стрик
   считается и для чужого ученика по его прогрессу. */
function coveredDays(days, shields){
  var out = {};
  [days || {}, shields || {}].forEach(function(src){
    Object.keys(src).forEach(function(k){ if (src[k]) out[k] = 1; });
  });
  return out;
}
function shieldsEarnedIn(days){
  return Math.floor(Object.keys(days || {}).length / SHIELD_EVERY);
}
function shieldsSpentIn(shields){ return Object.keys(shields || {}).length; }
/* сколько щитов на руках: заработано минус потрачено, но не больше запаса */
function shieldsLeftIn(days, shields){
  var n = shieldsEarnedIn(days) - shieldsSpentIn(shields);
  if (n > SHIELD_MAX) n = SHIELD_MAX;
  return n > 0 ? n : 0;
}
/* сколько дней занятий до следующего щита (0 — запас уже полон) */
function shieldToNextIn(days, shields){
  if (shieldsLeftIn(days, shields) >= SHIELD_MAX) return 0;
  var n = Object.keys(days || {}).length % SHIELD_EVERY;
  return n === 0 ? SHIELD_EVERY : SHIELD_EVERY - n;
}
function coveredNow(){ return coveredDays(S.days, S.shields); }
function shieldedOn(key){ return !!(S.shields && S.shields[key]); }
function shieldsLeft(){ return shieldsLeftIn(S.days, S.shields); }
function shieldToNext(){ return shieldToNextIn(S.days, S.shields); }

var shieldJustUsed = null;   /* дата, которую щит закрыл только что */

/* щит спас бы серию прямо сейчас? Ничего не тратит — только смотрит.
   Условия все три: вчера не занимались и щит на него ещё не тратили;
   позавчера серия БЫЛА (иначе продолжать нечего); щит есть в запасе.
   Нужно ещё и экрану «Сегодня»: пока ребёнок не сел заниматься, серия
   показывает 0, и без этой подсказки он решит, что всё пропало. */
function shieldWouldSave(){
  var y = shiftDay(dayKey(), -1);
  if (activeOn(y) || shieldedOn(y)) return false;          /* вчера дыры нет */
  if (!activeIn(coveredNow(), shiftDay(y, -1))) return false;  /* продолжать нечего */
  return shieldsLeft() >= 1;
}
/* потратить щит на вчерашний пропуск. Возвращает закрытую дату или null.
   Закрывает ровно ОДИН день: пропустил два подряд — серия начинается заново. */
function useShield(){
  S.shields = S.shields || {};
  if (!shieldWouldSave()) return null;
  var y = shiftDay(dayKey(), -1);
  S.shields[y] = 1;
  shieldJustUsed = y;
  return y;
}
/* «щит спас серию» — показываем один раз, у первого же экрана после спасения */
function takeShieldNote(){
  if (!shieldJustUsed) return "";
  var d = new Date(shieldJustUsed + "T12:00:00");
  var p = function(x){ return (x < 10 ? "0" : "") + x; };
  shieldJustUsed = null;
  return '<div class="shieldsaved">🛡️ <b>Щит закрыл пропуск</b> ' +
    p(d.getDate()) + "." + p(d.getMonth() + 1) + ' — серия не оборвалась.</div>';
}

/* задача дня: одна и та же на всех устройствах в один и тот же день, без
   сервера. Берём её из уже проверенного пула разминок по хэшу даты, так что
   каждый день — новая, а порядок предсказуем. */
function dailyPick(key){
  var ws = warmupsList();
  if (!ws.length) return null;
  key = key || dayKey();
  var h = 0;
  for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return ws[h % ws.length];
}
function dailyDone(key){ return !!(S.daily && S.daily[key || dayKey()]); }

/* русское склонение: 1 день, 2 дня, 5 дней */
function plural(n, one, few, many){
  var m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/* ===== расписание занятий: выбранные дни недели =====
   Хранится в S.schedule.days — массив номеров дня недели (0=Вс … 6=Сб),
   как у JavaScript getDay(). Это настройка устройства/ученика, поэтому при
   синхронизации побеждает более свежее сохранение (а не объединение —
   иначе снятый день возвращался бы с другого устройства). Напоминание —
   только внутри сайта: баннер на «Сегодня» и маячок на кнопке-огоньке. */
var WD_SHORT = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
var WD_ORDER = [1,2,3,4,5,6,0];   /* показываем с понедельника */
function scheduleDays(){ return (S.schedule && Array.isArray(S.schedule.days)) ? S.schedule.days : []; }
function hasSchedule(){ return scheduleDays().length > 0; }
function weekdayOf(key){ return new Date((key || dayKey()) + "T12:00:00").getDay(); }
function isStudyDay(key){ return scheduleDays().indexOf(weekdayOf(key)) >= 0; }
function toggleStudyDay(n){
  var days = scheduleDays().slice();
  var i = days.indexOf(n);
  if (i >= 0) days.splice(i, 1); else days.push(n);
  days.sort(function(a, b){ return a - b; });
  S.schedule = S.schedule || {};
  S.schedule.days = days;
  save();
  try { refreshTop(); } catch(e){}
}
/* сегодня учебный день, а заниматься ещё не садились */
function studyDue(){ return hasSchedule() && isStudyDay(dayKey()) && !activeOn(dayKey()); }

/* ================= регистрация по имени =================
   Настоящих аккаунтов с паролями тут нет намеренно (сайт статический и
   публичный). «Регистрация» — это дружелюбный вход: ребёнок вводит имя, сайт
   сам делает из него код ученика и запоминает. Вход с другого устройства — по
   этому коду или по ссылке ?kid=код. Всё держится на уже существующем механизме
   кода ученика (js/cloud.js) и синхронизации, новый бэкенд не нужен. */
function serverOn(){ return typeof Cloud !== "undefined" && Cloud.hasUrl(); }
function myCode(){ return (typeof Cloud !== "undefined") ? Cloud.myCode() : ""; }
function myName(){ return S.name || ""; }
/* сервер настроен, но ученик ещё не выбран — значит показываем регистрацию */
function needsRegister(){ return serverOn() && !myCode(); }

var TRANSLIT = { "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh",
  "з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r",
  "с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"c","ч":"ch","ш":"sh","щ":"sch",
  "ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya" };
function translit(s){
  s = String(s || "").toLowerCase();
  var out = "";
  for (var i = 0; i < s.length; i++){
    var ch = s[i];
    out += TRANSLIT.hasOwnProperty(ch) ? TRANSLIT[ch] : ch;
  }
  return out;
}
/* код ученика из имени: латиницей, маленькими, плюс короткий случайный хвост —
   чтобы у двух детей с одним именем коды не совпали */
function slugFromName(name){
  var base = translit(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 18);
  if (base.length < 2) base = "kid";
  var suf = (Math.random().toString(36) + "00000").slice(2, 7);   /* 5 знаков */
  var code = (base + "-" + suf).slice(0, 32);
  if (!/^[a-z0-9]/.test(code)) code = "k" + code.slice(1);
  return Cloud.validCode(code) || ("kid-" + suf);
}
/* очистить локальный прогресс — чтобы войти в другой аккаунт начисто, а не
   смешать двух детей на одном устройстве. Настройки устройства (admin) не трогаем. */
function resetProgressLocal(){
  clearAll(S);
  save();
}
/* создать аккаунт по имени и уйти на карту миров */
function doRegister(name, onErr){
  name = String(name || "").trim();
  if (name.length < 2){ if (onErr) onErr("Впиши имя — хотя бы две буквы."); return; }
  resetProgressLocal();
  S.name = name;
  if (serverOn()){
    Cloud.setCode(slugFromName(name));
    save();
    cloudPush().then(function(){ refreshTop(); screenWorlds(); },
                     function(){ refreshTop(); screenWorlds(); });
  } else {
    save(); refreshTop(); screenWorlds();
  }
}
/* войти по уже существующему коду (например, с другого устройства) */
function doLogin(code, onErr){
  var v = (typeof Cloud !== "undefined") ? Cloud.validCode(code) : null;
  if (!v){ if (onErr) onErr("Код: 3–32 знака, маленькие латинские буквы, цифры, дефис, подчёркивание."); return; }
  if (!serverOn()){ if (onErr) onErr("Сервер не подключён — вход по коду недоступен."); return; }
  Cloud.setCode(v);
  resetProgressLocal();               /* чистим, чтобы забрать чужой аккаунт начисто */
  cloudPull().then(function(){ refreshTop(); screenWorlds(); },
                   function(err){ if (onErr) onErr(err.message || "Не удалось войти."); });
}
/* выйти: забыть код на этом устройстве и очистить локальный прогресс */
function doLogout(){
  if (typeof Cloud !== "undefined") Cloud.forgetCode();
  resetProgressLocal();
  refreshTop();
  screenRegister();
}

/* ===== журнал занятий: попытки, подсказки, время по каждому уроку ===== */
function logOf(id){
  if (!S.log[id]) S.log[id] = { attempts:0, hints:0, shown:0, runs:0, timeMs:0,
                                first:null, last:null, solvedAt:null, stars:0 };
  return S.log[id];
}
function touchLog(id){
  var g = logOf(id), now = Date.now();
  if (!g.first) g.first = now;
  g.last = now; save();
}
var timeTick = null;
function startTimer(id){
  stopTimer();
  timeTick = setInterval(function(){
    var g = logOf(id); g.timeMs += 10000; g.last = Date.now(); save();
  }, 10000);
}
function stopTimer(){ if (timeTick){ clearInterval(timeTick); timeTick = null; } }
/* поставить или снять звёзды вручную, честно пересчитав XP */
function setStars(id, k){
  var prev = S.stars[id] === undefined ? 0 : S.stars[id];
  if (k <= 0){ delete S.stars[id]; S.xp = Math.max(0, S.xp - STAR_XP[prev]); }
  else { S.stars[id] = k; S.xp = Math.max(0, S.xp + STAR_XP[k] - STAR_XP[prev]); }
  var g = logOf(id);
  g.stars = k > 0 ? k : 0;
  g.solvedAt = k > 0 ? (g.solvedAt || Date.now()) : null;
  save();
}

function starsOf(id){ return S.stars[id] || 0; }
function solved(id){ return S.stars[id] !== undefined; }
function totalStars(){ var n = 0; for (var k in S.stars) n += S.stars[k]; return n; }
function rankName(){
  var r = RANKS[0][1];
  for (var i = 0; i < RANKS.length; i++) if (S.xp >= RANKS[i][0]) r = RANKS[i][1];
  return r;
}
function nextRankXp(){
  for (var i = 0; i < RANKS.length; i++) if (S.xp < RANKS[i][0]) return RANKS[i][0];
  return RANKS[RANKS.length-1][0];
}
function award(id){
  if (S.badges.indexOf(id) >= 0) return;
  S.badges.push(id); save(); toast(id);
}
function toast(id){
  var b = BADGES.filter(function(x){ return x.id === id; })[0];
  if (!b) return;
  var el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = '<span class="em">' + b.em + '</span><span><b>Новый бейдж</b><span>' + b.name + '</span></span>';
  document.body.appendChild(el);
  setTimeout(function(){ el.classList.add("out"); }, 3000);
  setTimeout(function(){ el.remove(); }, 3600);
}
function refreshTop(){
  document.getElementById("rank").textContent = rankName();
  document.getElementById("xptext").textContent = S.xp + " XP";
  document.getElementById("xpfill").style.width = Math.min(100, S.xp / nextRankXp() * 100) + "%";
  var done = Object.keys(S.stars).length;
  document.getElementById("stars").textContent = "★ " + totalStars() + " · " + done + "/" + CURRICULUM.total;
  var bt = document.getElementById("btn-today");
  if (bt){
    var s = streakCurrent();
    var due = studyDue();
    bt.textContent = (due ? "🔔 " : "🔥 ") + (s > 0 ? s : "Сегодня");
    /* «горит», если сегодня уже занимались; «due» — учебный день, ещё не занимались */
    bt.classList.toggle("lit", activeOn(dayKey()));
    bt.classList.toggle("due", due);
    bt.title = due
      ? "Сегодня учебный день — не пропусти занятие"
      : (s > 0
          ? (s + " " + plural(s, "день", "дня", "дней") + " подряд — открой задачу дня")
          : "Задача дня и дни подряд");
  }
  var bw = document.getElementById("btn-who");
  if (bw){
    var nm = myName();
    bw.textContent = nm ? ("👤 " + nm) : "👤";
    bw.title = nm ? ("Профиль: " + nm) : "Профиль";
  }
}

/* ============================================================
   СИНХРОНИЗАЦИЯ С СЕРВЕРОМ
   Прогресс не «перезаписывается», а СЛИВАЕТСЯ: по каждому уроку берётся
   лучший результат из двух копий. Так ничего не теряется, даже если
   ребёнок занимался с двух устройств по очереди.

   Почему время и попытки берутся по максимуму, а не складываются:
   после первой же синхронизации обе копии становятся одинаковыми, и
   сложение удваивало бы цифры при каждом следующем обмене.

   Поле admin (снятые замки) намеренно НЕ синхронизируется: это настройка
   конкретного устройства, а не результат ученика.
   ============================================================ */
var cloudState = { busy:false, lastSync:0, lastError:null, lastPush:0, timer:null };

function maxN(a, b){ a = a || 0; b = b || 0; return a > b ? a : b; }

/* Объединение множества (дата→1 или id→1): помеченное на любом устройстве
   остаётся помеченным. Шесть полей прогресса сливаются ровно так, и раньше
   этот цикл был выписан по разу на каждое — новое поле легко было забыть. */
function mergeSet(a, b){
  var out = {};
  [a || {}, b || {}].forEach(function(src){
    Object.keys(src).forEach(function(k){ if (src[k]) out[k] = 1; });
  });
  return out;
}

function mergeProgress(a, b){
  a = a || {}; b = b || {};
  var out = { v:2, stars:{}, badges:[], log:{} };

  [a.stars || {}, b.stars || {}].forEach(function(src){
    Object.keys(src).forEach(function(k){ out.stars[k] = maxN(out.stars[k], src[k]); });
  });

  /* опыт: наибольшее из трёх — двух копий и суммы по звёздам. Так и ручная
     выдача XP в панели не пропадёт, и опыт не разойдётся со звёздами. */
  var byStars = 0;
  Object.keys(out.stars).forEach(function(k){ byStars += STAR_XP[out.stars[k]] || 0; });
  out.xp = Math.max(maxN(a.xp, b.xp), byStars);

  (a.badges || []).concat(b.badges || []).forEach(function(x){
    if (out.badges.indexOf(x) < 0) out.badges.push(x);
  });

  out.drawDone = mergeSet(a.drawDone, b.drawDone);

  out.firstTry = maxN(a.firstTry, b.firstTry);
  out.perfect = maxN(a.perfect, b.perfect);
  out.sandboxRuns = maxN(a.sandboxRuns, b.sandboxRuns);

  /* разгаданные разминки: объединяем — разгаданное на любом устройстве
     остаётся разгаданным. Это не звёзды и не входит в сотню уроков. */
  out.warmups = mergeSet(a.warmups, b.warmups);

  /* пройденные задания раздела «Ты и ИИ»: тоже объединяем — как разминки,
     это не звёзды и не входит в сотню уроков. */
  out.ailab = mergeSet(a.ailab, b.ailab);

  /* какие игры вообще открывали: объединяем, как разминки */
  out.gamesPlayed = mergeSet(a.gamesPlayed, b.gamesPlayed);

  /* дни занятий и выполненные «задачи дня»: объединяем множества дат.
     День, засчитанный на любом устройстве, остаётся засчитанным — так стрик
     не рвётся из-за того, что ребёнок в понедельник занимался на планшете,
     а во вторник на ноутбуке. Дата — строка «ГГГГ-ММ-ДД» по местному времени. */
  out.days = mergeSet(a.days, b.days);
  out.daily = mergeSet(a.daily, b.daily);
  /* потраченные щиты — тоже множество дат, тоже объединяем. Счётчик щитов
     нигде не хранится: сколько их заработано, считается из числа дней занятий,
     поэтому после слияния обе стороны получают одинаковый ответ. Крайний
     случай: два устройства офлайн потратили последний щит на РАЗНЫЕ дни —
     тогда после слияния потрачено на один больше, чем заработано. Ничего не
     ломается (запас просто уходит в ноль и восстанавливается занятиями),
     и оба спасённых дня остаются закрытыми — так честнее к ребёнку. */
  out.shields = mergeSet(a.shields, b.shields);

  /* код в песочнице сложить нельзя — берём из более свежего сохранения */
  var fresher = (b.savedAt || 0) > (a.savedAt || 0) ? b : a;
  var older = fresher === b ? a : b;
  out.sandbox = fresher.sandbox || older.sandbox || null;

  /* расписание — настройка, а не результат: берём из более свежего сохранения,
     иначе снятый на одном устройстве день возвращался бы с другого */
  out.schedule = fresher.schedule || older.schedule || { days:[] };

  /* имя ученика едет вместе с прогрессом (это подпись аккаунта, не результат) —
     берём из более свежего сохранения, но не теряем, если в свежем оно пустое */
  out.name = fresher.name || older.name || "";

  /* свои версии игр: по каждой игре это КОД, а код сложить нельзя — как
     песочница, берём из более свежего сохранения. Игра, которую правили
     только на одном устройстве, при этом не теряется. */
  out.games = {};
  Object.keys(mergeSet(a.games, b.games)).forEach(function(k){
    out.games[k] = (fresher.games || {})[k] || (older.games || {})[k] || null;
    if (!out.games[k]) delete out.games[k];
  });

  /* проекты: пройденный шаг — результат, поэтому берём дальний (max), а вот КОД
     сложить нельзя, он как песочница — берём из более свежего сохранения.
     Так занятие с двух устройств не откатывает проект назад и не склеивает
     две разные версии программы в кашу. */
  out.projects = {};
  var pids = {};
  Object.keys(a.projects || {}).forEach(function(k){ pids[k] = 1; });
  Object.keys(b.projects || {}).forEach(function(k){ pids[k] = 1; });
  Object.keys(pids).forEach(function(k){
    var pa = (a.projects || {})[k] || {}, pb = (b.projects || {})[k] || {};
    var pf = (fresher === a ? pa : pb), po = (fresher === a ? pb : pa);
    out.projects[k] = {
      step: maxN(pa.step, pb.step),
      done: maxN(pa.done, pb.done),
      code: pf.code || po.code || null
    };
  });

  var ids = {};
  Object.keys(a.log || {}).forEach(function(k){ ids[k] = 1; });
  Object.keys(b.log || {}).forEach(function(k){ ids[k] = 1; });
  Object.keys(ids).forEach(function(k){
    var x = (a.log || {})[k] || {}, y = (b.log || {})[k] || {};
    out.log[k] = {
      attempts: maxN(x.attempts, y.attempts),
      hints:    maxN(x.hints, y.hints),
      shown:    maxN(x.shown, y.shown),
      runs:     maxN(x.runs, y.runs),
      timeMs:   maxN(x.timeMs, y.timeMs),
      first:    (x.first && y.first) ? Math.min(x.first, y.first) : (x.first || y.first || null),
      last:     maxN(x.last, y.last) || null,
      solvedAt: maxN(x.solvedAt, y.solvedAt) || null,
      stars:    maxN(x.stars, y.stars)
    };
  });

  out.savedAt = maxN(a.savedAt, b.savedAt);
  return out;
}

/* то, что уходит на сервер: всё, кроме настроек устройства */
function cloudSnapshot(){
  var o = {};
  Object.keys(S).forEach(function(k){ if (k !== "admin") o[k] = S[k]; });
  return JSON.parse(JSON.stringify(o));
}

function applyProgress(data){
  var merged = mergeProgress(cloudSnapshot(), data);
  Object.keys(merged).forEach(function(k){ S[k] = merged[k]; });
  saveLocal();
}

function cloudEnabled(){
  return typeof Cloud !== "undefined" && Cloud.configured();
}

/* забрать с сервера и слить с тем, что уже есть здесь */
function cloudPull(){
  if (!cloudEnabled()) return Promise.resolve(false);
  cloudState.busy = true;
  return Cloud.load().then(function(res){
    cloudState.busy = false; cloudState.lastError = null; cloudState.lastSync = Date.now();
    if (!res.found || !res.data) return false;
    var before = JSON.stringify(cloudSnapshot());
    applyProgress(res.data);
    return JSON.stringify(cloudSnapshot()) !== before;
  }, function(err){
    cloudState.busy = false; cloudState.lastError = err.message || String(err);
    throw err;
  });
}

/* отправить на сервер */
function cloudPush(){
  if (!cloudEnabled()) return Promise.resolve(false);
  cloudState.busy = true;
  return Cloud.save(cloudSnapshot()).then(function(){
    cloudState.busy = false; cloudState.lastError = null;
    cloudState.lastSync = Date.now(); cloudState.lastPush = Date.now();
    return true;
  }, function(err){
    cloudState.busy = false; cloudState.lastError = err.message || String(err);
    throw err;
  });
}

/* Отправка не чаще раза в 25 секунд: локальное сохранение случается
   каждые 10 секунд, пока открыт урок, и гонять сеть так часто незачем. */
function schedulePush(){
  if (!cloudEnabled()) return;
  if (cloudState.timer) return;
  var wait = Math.max(2000, 25000 - (Date.now() - cloudState.lastPush));
  cloudState.timer = setTimeout(function(){
    cloudState.timer = null;
    cloudPush().catch(function(){});
  }, wait);
}

/* ================= контент ================= */
window.CONTENT = window.CONTENT || {};
function worldContent(n){
  var key = "world" + n;
  if (CONTENT[key]) return Promise.resolve(CONTENT[key]);
  if (window.__SINGLE_FILE__) return Promise.resolve(null);
  return new Promise(function(res){
    var s = document.createElement("script");
    s.src = "content/" + key + ".js";
    s.onload = function(){ res(CONTENT[key] || null); };
    s.onerror = function(){ res(null); };
    document.head.appendChild(s);
  });
}
function lessonBody(l){
  var c = CONTENT["world" + l.world];
  return c ? c[l.id] : null;
}
/* Подгрузить содержание всех миров. На сайте (index.html) миры грузятся
   по отдельным файлам, и без этого экран миров на первой отрисовке показывал
   миры 2–5 как «в работе», пока их контент ещё не приехал. */
function allWorldsContent(){
  return Promise.all(CURRICULUM.map(function(w){ return worldContent(w.n); }));
}
function worldReadyLessons(w){
  var c = CONTENT["world" + w.n] || {};
  return w.lessons.filter(function(l){ return !!c[l.id]; });
}
function lessonOpen(l){
  if (S.admin && S.admin.unlockAll) return !!lessonBody(l);
  var w = CURRICULUM.world(l.world);
  var ready = worldReadyLessons(w);
  var i = ready.indexOf(l);
  if (i < 0) return false;
  if (i === 0) return true;
  return solved(ready[i-1].id) || solved(l.id);
}

/* ================= подсветка ================= */
var KW = "and|or|not|in|is|if|elif|else|while|for|def|return|break|continue|pass|True|False|None|import|from|as|global|lambda|class|try|except|finally|with|yield";
var BI = "print|len|range|str|int|float|bool|list|tuple|set|dict|sum|min|max|abs|round|sorted|reversed|enumerate|zip|type|forward|back|right|left|penup|pendown|color|width|goto|home|dot|circle|speed|sqrt|randint|choice|random|shuffle|sample|append|pop|insert|remove|sort|reverse|split|join|upper|lower|strip|replace|startswith|endswith|count|index|keys|values|items|get|add|discard|update|union|intersection|difference|issubset|issuperset|isdisjoint|copy|clear|extend|setdefault|isdigit|isalpha|title|capitalize|find|key";
var HLRE = new RegExp(
  "(#[^\\n]*)" +
  "|(f?\"(?:\\\\.|[^\"\\\\])*\"|f?'(?:\\\\.|[^'\\\\])*')" +
  "|(\\b\\d+\\.?\\d*\\b)" +
  "|\\b(" + KW + ")\\b" +
  "|\\b(" + BI + ")\\b", "g");
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function hl(code){
  return esc(code).replace(HLRE, function(m, c, s, n, k, b){
    if (c) return '<span class="t-c">' + c + '</span>';
    if (s) return '<span class="t-s">' + s + '</span>';
    if (n) return '<span class="t-n">' + n + '</span>';
    if (k) return '<span class="t-k">' + k + '</span>';
    if (b) return '<span class="t-f">' + b + '</span>';
    return m;
  });
}

/* ================= холст ================= */
function drawTurtle(canvas, turtle, progress){
  if (!canvas || !turtle) return;
  canvas._lastTurtle = turtle;
  var ctx = canvas.getContext && canvas.getContext("2d");
  if (!ctx) return;
  var W = canvas.clientWidth || (canvas.parentNode && canvas.parentNode.clientWidth) || 600;
  var H = Math.round(W * 0.72);
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(W*dpr)){
    canvas.width = Math.round(W*dpr); canvas.height = Math.round(H*dpr);
    canvas.style.height = H + "px";
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "#070a16"; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = "rgba(60,72,130,.28)"; ctx.lineWidth = 1;
  for (var gx = 0; gx <= W; gx += 40){ ctx.beginPath(); ctx.moveTo(gx+.5,0); ctx.lineTo(gx+.5,H); ctx.stroke(); }
  for (var gy = 0; gy <= H; gy += 40){ ctx.beginPath(); ctx.moveTo(0,gy+.5); ctx.lineTo(W,gy+.5); ctx.stroke(); }

  var segs = turtle.segs || [], dots = turtle.dots || [];
  var minX = 0, maxX = 0, minY = 0, maxY = 0;
  function acc(x,y){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
  segs.forEach(function(s){ acc(s.x1,s.y1); acc(s.x2,s.y2); });
  dots.forEach(function(d){ acc(d.x,d.y); });
  var scale = Math.min(1, Math.min(W / Math.max(80,(maxX-minX)+60), H / Math.max(80,(maxY-minY)+60)));
  var cx = W/2 - (minX+maxX)/2*scale, cy = H/2 + (minY+maxY)/2*scale;
  function px(x){ return cx + x*scale; }
  function py(y){ return cy - y*scale; }

  var upto = progress === undefined ? segs.length : Math.floor(segs.length * progress);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (var i = 0; i < upto; i++){
    var s = segs[i];
    ctx.strokeStyle = s.c; ctx.lineWidth = Math.max(1, s.w*scale);
    ctx.beginPath(); ctx.moveTo(px(s.x1),py(s.y1)); ctx.lineTo(px(s.x2),py(s.y2)); ctx.stroke();
  }
  dots.forEach(function(d){ ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(px(d.x),py(d.y),Math.max(1.5,d.r*scale),0,7); ctx.fill(); });
  var tx, ty, ta;
  if (upto > 0 && upto < segs.length){
    var last = segs[upto-1];
    tx = last.x2; ty = last.y2; ta = Math.atan2(last.y2-last.y1, last.x2-last.x1);
  } else { tx = turtle.x; ty = turtle.y; ta = (turtle.angle||0)*Math.PI/180; }
  ctx.save(); ctx.translate(px(tx),py(ty)); ctx.rotate(-ta);
  ctx.fillStyle = "#3ddc84";
  ctx.beginPath(); ctx.moveTo(9,0); ctx.lineTo(-6,6); ctx.lineTo(-3,0); ctx.lineTo(-6,-6); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function reduced(){ return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
function animateTurtle(canvas, turtle){
  if (!canvas || !turtle) return;
  if (!turtle.segs || !turtle.segs.length || reduced()){ drawTurtle(canvas, turtle); return; }
  var dur = Math.min(1100, 90 + turtle.segs.length*14), t0 = performance.now();
  if (canvas._raf) cancelAnimationFrame(canvas._raf);
  (function frame(now){
    var p = Math.min(1, (now-t0)/dur);
    drawTurtle(canvas, turtle, p);
    if (p < 1) canvas._raf = requestAnimationFrame(frame);
  })(t0);
}

/* ================= ошибки ================= */
var KIND_RU = {
  SyntaxError:"Опечатка в записи", IndentationError:"Проблема с отступами",
  NameError:"Неизвестное имя", TypeError:"Несовместимые типы",
  IndexError:"Номер за пределами", KeyError:"Нет такого ключа",
  ValueError:"Неподходящее значение", ZeroDivisionError:"Деление на ноль",
  AttributeError:"Нет такой команды", RuntimeError:"Программа не остановилась",
  NotSupported:"Здесь так нельзя",
  AssertionError:"Проверка не прошла", ImportError:"Не удалось подключить модуль",
  RecursionError:"Слишком глубокая рекурсия", StopIteration:"Значения закончились",
  NotImplementedError:"Ещё не написано", ArithmeticError:"Ошибка в вычислении",
  LookupError:"Ничего не найдено", Exception:"Ошибка", BaseException:"Ошибка"
};
function errHTML(e){
  return '<b>' + (KIND_RU[e.kind] || e.kind) + (e.line ? ' — строка ' + e.line : '') + '</b>' + esc(e.msg);
}

/* ================= редактор ================= */
/* files — список файлов урока: [{ name:"main.py", code:"..." }, ...].
   Настоящих файлов в браузере нет, но для ученика всё выглядит как в жизни:
   вкладки сверху, import между файлами работает. */
function makeEditor(initial, label, files){
  var box = document.createElement("div");
  var many = files && files.length > 1;
  box.className = "editorbox";
  var tabs = many
    ? '<div class="ftabs">' + files.map(function(f, i){
        return '<button class="ftab' + (i === 0 ? " on" : "") + '" data-file="' + i + '">' + esc(f.name) + '</button>';
      }).join("") + '</div>'
    : "";
  box.innerHTML =
    '<div class="ehead"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="lbl">' +
      esc(many ? files[0].name : (label || "твой код")) + '</span></div>' + tabs +
    '<div class="edit-area"><div class="gutter"></div><div class="edit-scroll">' +
      '<pre class="hl"></pre><textarea spellcheck="false" autocapitalize="off" autocorrect="off"></textarea>' +
    '</div></div><div class="runbar"></div>';
  var ta = box.querySelector("textarea"), pre = box.querySelector("pre.hl"), gut = box.querySelector(".gutter");
  var fileList = files && files.length ? files.map(function(f){ return { name:f.name, code:f.code || "" }; })
                                       : [{ name:"main.py", code: initial || "" }];
  var active = 0;
  ta.value = fileList[0].code;
  function sync(){
    pre.innerHTML = hl(ta.value) + "\n";
    ta.style.height = "auto";
    ta.style.height = Math.max(190, ta.scrollHeight) + "px";
    var n = ta.value.split("\n").length, g = "";
    for (var i = 1; i <= n; i++)
      g += '<i class="' + (i === box._errLine ? "err" : (i === box._curLine ? "cur" : "")) + '">' + i + '</i>';
    gut.innerHTML = g;
  }
  ta.addEventListener("input", function(){ box._errLine = 0; box._curLine = 0; sync(); });
  ta.addEventListener("keydown", function(e){
    if (e.key === "Tab"){
      e.preventDefault();
      var s = ta.selectionStart;
      ta.value = ta.value.slice(0,s) + "    " + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + 4; sync(); return;
    }
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey){
      var pos = ta.selectionStart, before = ta.value.slice(0,pos);
      var line = before.slice(before.lastIndexOf("\n") + 1);
      var ind = (line.match(/^[ ]*/) || [""])[0];
      if (/:\s*$/.test(line)) ind += "    ";
      e.preventDefault();
      ta.value = before + "\n" + ind + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = pos + 1 + ind.length; sync(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter"){
      e.preventDefault();
      var rb = box.querySelector('[data-role="run"]'); if (rb) rb.click();
    }
  });
  function stash(){ fileList[active].code = ta.value; }
  function openFile(i){
    stash();
    active = i;
    ta.value = fileList[i].code;
    box._errLine = 0; box._curLine = 0;
    box.querySelector(".lbl").textContent = fileList[i].name;
    box.querySelectorAll(".ftab").forEach(function(b, k){ b.className = "ftab" + (k === i ? " on" : ""); });
    sync();
  }
  if (many) box.querySelector(".ftabs").addEventListener("click", function(e){
    var b = e.target.closest(".ftab"); if (!b) return;
    openFile(+b.getAttribute("data-file"));
  });

  box.setLine = function(n){ box._curLine = n; box._errLine = 0; sync(); };
  box.setError = function(n){ box._errLine = n; box._curLine = 0; sync(); };
  box.getCode = function(){ stash(); return fileList[0].code; };
  box.setCode = function(v){ ta.value = v; fileList[active].code = v; box._errLine = 0; box._curLine = 0; sync(); };
  /* Все файлы, кроме главного: именно они уходят в движок как модули. */
  box.getSources = function(){
    stash();
    var out = {};
    for (var i = 1; i < fileList.length; i++) out[fileList[i].name] = fileList[i].code;
    return out;
  };
  box.getFiles = function(){ stash(); return fileList.map(function(f){ return { name:f.name, code:f.code }; }); };
  box.setFiles = function(list){
    for (var i = 0; i < fileList.length && i < list.length; i++) fileList[i].code = list[i].code;
    ta.value = fileList[active].code;
    box._errLine = 0; box._curLine = 0; sync();
  };
  box.fileCount = fileList.length;
  box.focusEditor = function(){ ta.focus(); };
  setTimeout(sync, 0);
  return box;
}

/* ================= рабочая станция ================= */
function makeStudio(cfg){
  cfg = cfg || {};
  var eng = Runtime.get(cfg.engine || "mini");
  var wrap = document.createElement("div");
  wrap.className = "studio" + (cfg.draw ? " split" : "");

  var ed = makeEditor(cfg.code || "", cfg.label, cfg.files);
  ed.querySelector(".runbar").innerHTML =
    '<button class="rbtn" data-role="run">' + (cfg.play ? "▶ Новая игра" : "▶ Запустить") + '</button>' +
    (eng.supportsStep && !cfg.play ? '<button class="rbtn sec" data-role="step">⏭ Шаг</button>' : "") +
    '<button class="rbtn sec" data-role="reset">↺ Сброс</button>' +
    (cfg.restore ? '<button class="rbtn sec" data-role="restore">↩ Вернуть как было</button>' : "") +
    (cfg.check ? '<button class="rbtn check" data-role="check">✓ Проверить</button>' : "") +
    '<span class="sp"></span><span class="tip"><span class="kbd">Ctrl</span>+<span class="kbd">Enter</span></span>';

  var side = document.createElement("div"); side.className = "side";
  var canvas = null;
  if (cfg.draw && eng.supportsTurtle){
    var cp = document.createElement("div"); cp.className = "pane";
    cp.innerHTML = '<div class="ph">холст</div><canvas class="stage"></canvas>';
    side.appendChild(cp); canvas = cp.querySelector("canvas");
  }
  var conPane = document.createElement("div"); conPane.className = "pane";
  conPane.innerHTML = '<div class="ph">вывод программы</div><div class="console"><span class="empty">пока пусто — нажми «Запустить»</span></div>';
  var varsPane = document.createElement("div"); varsPane.className = "pane"; varsPane.style.display = "none";
  varsPane.innerHTML = '<div class="ph">переменные сейчас</div><div class="pb"><div class="varlist"></div></div>';
  /* Урокам про файлы нужно видеть, что лежит «на диске» до и после запуска. */
  var hasData = cfg.data && Object.keys(cfg.data).length;
  var diskPane = document.createElement("div"); diskPane.className = "pane";
  diskPane.style.display = hasData ? "" : "none";
  diskPane.innerHTML = '<div class="ph">файлы на диске</div><div class="pb"><div class="disklist"></div></div>';

  /* Клавиатуры у программы в тренажёре нет, поэтому ответы на input()
     записаны заранее — по одному в строке. Их можно менять и запускать снова:
     для кода это неотличимо от живого человека за клавиатурой. */
  var hasStdin = !!(cfg.stdin && cfg.stdin.length);
  var stdinPane = document.createElement("div"); stdinPane.className = "pane";
  stdinPane.style.display = hasStdin ? "" : "none";
  stdinPane.innerHTML = '<div class="ph">ответы для input()</div><div class="pb">' +
    '<textarea class="stdinbox" spellcheck="false" rows="6"></textarea>' +
    '<div class="stdinhint">По одному ответу в строке. Меняй и запускай снова — программа прочитает их сверху вниз.</div></div>';
  var stdinBox = stdinPane.querySelector(".stdinbox");
  stdinBox.value = hasStdin ? cfg.stdin.join("\n") : "";

  var left = document.createElement("div");
  left.appendChild(ed);
  var msg = document.createElement("div"); msg.className = "msg";
  left.appendChild(msg);

  /* Игровое поле ввода: появляется, когда игра ждёт хода игрока.
     Игры устроены на перезапуске (replay) — движок гоняет программу заново
     с накопленными ходами и фиксированным seed, поэтому «замысел» не плывёт. */
  var playPane = null, playInput = null;
  if (cfg.play){
    playPane = document.createElement("div"); playPane.className = "playbar";
    playPane.style.display = "none";
    playPane.innerHTML =
      '<span class="playq"></span>' +
      '<input class="playin" type="text" autocomplete="off" spellcheck="false" placeholder="твой ход и Enter">' +
      '<button class="rbtn play" data-role="move">Ход ↵</button>';
    playInput = playPane.querySelector(".playin");
  }

  if (canvas){ side.appendChild(conPane); if (playPane) side.appendChild(playPane); side.appendChild(varsPane); side.appendChild(stdinPane); side.appendChild(diskPane); wrap.appendChild(left); wrap.appendChild(side); }
  else { left.appendChild(conPane); if (playPane) left.appendChild(playPane); left.appendChild(varsPane); left.appendChild(stdinPane); left.appendChild(diskPane); wrap.appendChild(left); }

  /* Что сейчас в панели ответов. Пустой хвост убираем: перевод строки в конце
     текста — это не лишний пустой ответ, ровно как при вводе с клавиатуры. */
  wrap.getStdin = function(){
    if (!hasStdin) return [];
    var a = stdinBox.value.split("\n");
    while (a.length && a[a.length - 1] === "") a.pop();
    return a;
  };

  var con = conPane.querySelector(".console");
  var stepper = null;

  function showDisk(files){
    if (!files || !Object.keys(files).length){
      if (!hasData) return;
      files = dataFiles(cfg.data);
    }
    diskPane.style.display = "";
    var names = Object.keys(files).sort();
    diskPane.querySelector(".disklist").innerHTML = names.map(function(n){
      var text = files[n];
      var short = text.length > 400 ? text.slice(0, 400) + "\n…" : text;
      return '<div class="diskfile"><b>' + esc(n) + '</b><span>' +
             (text.length ? text.split("\n").length + " строк, " + text.length + " знаков" : "пусто") +
             '</span><pre>' + esc(short) + '</pre></div>';
    }).join("");
  }
  function showMsg(cls, html){ msg.className = "msg show " + cls; msg.innerHTML = html; }
  function hideMsg(){ msg.className = "msg"; }
  function setConsole(text){
    con.innerHTML = text ? esc(text) : '<span class="empty">программа ничего не вывела</span>';
  }

  function doRun(){
    hideMsg(); ed.setError(0); stepper = null; varsPane.style.display = "none";
    var t = eng.newTurtle ? eng.newTurtle() : null;
    var res = eng.run(ed.getCode(), { turtle: t, sources: ed.getSources(), files: dataFiles(cfg.data), stdin: wrap.getStdin() });
    setConsole(res.output);
    if (res.files) showDisk(res.files);
    if (canvas) animateTurtle(canvas, res.turtle || t);
    if (res.error){
      ed.setError(res.error.line);
      showMsg("bad", errHTML(res.error));
      wrap._hadError = true;
    } else if (wrap._hadError){ award("fixer"); wrap._hadError = false; }
    award("first");
    if (cfg.onRun) cfg.onRun(res);
    return res;
  }

  function doStep(){
    hideMsg();
    if (!stepper){
      try {
        var t = eng.newTurtle ? eng.newTurtle() : null;
        stepper = { s: eng.stepper(ed.getCode(), { turtle: t, sources: ed.getSources(), files: dataFiles(cfg.data), stdin: wrap.getStdin() }), t: t };
      } catch(e){
        if (!e.pyKind) throw e;
        ed.setError(e.pyLine);
        showMsg("bad", errHTML({ kind:e.pyKind, msg:e.pyMsg, line:e.pyLine }));
        stepper = null; return;
      }
      varsPane.style.display = "";
    }
    var st = stepper.s.next();
    setConsole(st.output);
    if (canvas) drawTurtle(canvas, stepper.t);
    if (st.error){ ed.setError(st.error.line); showMsg("bad", errHTML(st.error)); stepper = null; return; }
    if (st.done){
      ed.setLine(0);
      showMsg("warn", "<b>Программа закончилась</b>Нажми «Сброс», чтобы пройти шагами ещё раз.");
      stepper = null; return;
    }
    ed.setLine(st.line);
    var vars = eng.snapshotVars ? eng.snapshotVars(st.env, stepper.s.interp.builtinNames) : [];
    varsPane.querySelector(".varlist").innerHTML = vars.length
      ? vars.map(function(v){ return '<div class="varrow"><b>' + esc(v.name) + '</b><span>' + esc(v.value) + '</span><em>' + v.type + '</em></div>'; }).join("")
      : '<span class="empty">переменных пока нет</span>';
  }

  function doReset(){
    stepper = null; ed.setLine(0); hideMsg();
    varsPane.style.display = "none";
    if (playPane) playPane.style.display = "none";
    con.innerHTML = '<span class="empty">пока пусто — нажми «Запустить»</span>';
    if (canvas && eng.newTurtle) drawTurtle(canvas, eng.newTurtle());
  }

  /* ===== игровой режим: партия через перезапуск с накопленными ходами ===== */
  var playAnswers = [], playSeed = 0;

  function playRender(){
    hideMsg(); ed.setError(0);
    var t = eng.newTurtle ? eng.newTurtle() : null;
    var res = eng.run(ed.getCode(), { turtle: t, sources: ed.getSources(),
      files: dataFiles(cfg.data), stdin: playAnswers, interactive: true, seed: playSeed });
    setConsole(res.output);
    if (res.files) showDisk(res.files);
    if (canvas) animateTurtle(canvas, res.turtle || t);
    award("first");
    if (res.error){
      ed.setError(res.error.line);
      showMsg("bad", errHTML(res.error));
      playPane.style.display = "none";
      return;
    }
    if (res.awaitingInput){
      /* последняя строка вывода — это приглашение input(); показываем его у поля */
      var lines = res.output.split("\n");
      var q = lines[lines.length - 1] || "твой ход:";
      playPane.querySelector(".playq").textContent = q;
      playPane.style.display = "";
      playInput.value = "";
      setTimeout(function(){ playInput.focus(); }, 0);
    } else {
      playPane.style.display = "none";
      showMsg("ok", "<b>Игра окончена</b>Нажми «Новая игра», чтобы сыграть ещё раз, или поменяй код — и играй свою версию.");
    }
    if (cfg.onRun) cfg.onRun(res);
  }
  function playStart(){
    playAnswers = [];
    playSeed = Math.floor(Math.random() * 2000000000) + 1;
    con.innerHTML = "";
    playRender();
  }
  function playMove(){
    if (!playPane || playPane.style.display === "none") return;
    playAnswers.push(playInput.value);
    playRender();
  }
  if (playPane){
    playPane.querySelector('[data-role="move"]').onclick = playMove;
    playInput.addEventListener("keydown", function(e){
      if (e.key === "Enter"){ e.preventDefault(); playMove(); }
    });
  }

  ed.querySelector(".runbar").addEventListener("click", function(e){
    var b = e.target.closest("button"); if (!b) return;
    var r = b.getAttribute("data-role");
    if (r === "run") cfg.play ? playStart() : doRun();
    else if (r === "move") playMove();
    else if (r === "step") doStep();
    else if (r === "reset") doReset();
    else if (r === "restore"){
      if (cfg.restoreFiles) ed.setFiles(cfg.restoreFiles); else ed.setCode(cfg.restore);
      doReset();
    }
    else if (r === "check") cfg.check(ed, showMsg, canvas);
  });

  if (hasData) showDisk(null);
  wrap.editor = ed; wrap.showMsg = showMsg; wrap.canvas = canvas; wrap.engine = eng;
  if (canvas && eng.newTurtle) setTimeout(function(){ drawTurtle(canvas, eng.newTurtle()); }, 30);
  return wrap;
}

/* ================= проверка ================= */
function normSeg(s, pen){
  var a = [Math.round(s.x1), Math.round(s.y1)], b = [Math.round(s.x2), Math.round(s.y2)];
  if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])){ var t = a; a = b; b = t; }
  var key = a[0] + "," + a[1] + "|" + b[0] + "," + b[1];
  return pen ? key + "|" + s.c + "|" + Math.round(s.w) : key;
}
function sameDrawing(u, r, pen){
  if (!u.length) return false;
  var A = u.map(function(s){ return normSeg(s, pen); }).sort();
  var B = r.map(function(s){ return normSeg(s, pen); }).sort();
  if (A.length !== B.length) return false;
  for (var i = 0; i < A.length; i++) if (A[i] !== B[i]) return false;
  return true;
}

/* ===== задание «найди ошибку»: считаем, сколько строк тронул ученик =====
   Смысл задания — найти одну поломку, а не написать программу заново.
   Пустые строки и комментарии не считаем: их правка ничего не меняет.
   Единица измерения — «строка»: одна переписанная строка это 2 единицы
   (одну убрали, другую добавили). */
function codeLines(src){
  return String(src === null || src === undefined ? "" : src).split("\n")
    .map(function(s){ return s.replace(/\s+$/, ""); })
    .filter(function(s){ var t = s.trim(); return t !== "" && t.charAt(0) !== "#"; });
}
function lcsLen(A, B){
  var prev = [], cur, i, j;
  for (j = 0; j <= B.length; j++) prev[j] = 0;
  for (i = 1; i <= A.length; i++){
    cur = [0];
    for (j = 1; j <= B.length; j++)
      cur[j] = A[i-1] === B[j-1] ? prev[j-1] + 1 : Math.max(prev[j], cur[j-1]);
    prev = cur;
  }
  return prev[B.length];
}
function editUnits(a, b){
  var A = codeLines(a), B = codeLines(b);
  return A.length + B.length - 2 * lcsLen(A, B);
}
var CUSTOM = {
  /* Задания со случайностью нельзя проверять сравнением вывода — числа каждый раз
     другие. Поэтому проверяем форму: строки нужного вида и сходящиеся итоги. */
  dice: function(res){
    var L = res.lines, sum = 0;
    if (L.length !== 11)
      return "Нужно 11 строк: десять бросков и итог. Сейчас их " + L.length + ".";
    for (var i = 0; i < 10; i++){
      var m = /^Бросок (\d+): (\d+)$/.exec(L[i]);
      if (!m) return "Строка " + (i+1) + " должна выглядеть так: «Бросок 1: 4». Сейчас там «" + L[i] + "».";
      if (+m[1] !== i + 1) return "В строке " + (i+1) + " номер броска " + m[1] + ", а ожидался " + (i+1) + ". Проверь range.";
      var v = +m[2];
      if (v < 1 || v > 6) return "Кубик выдал " + v + ", а у кубика бывает только от 1 до 6. Проверь randint(1, 6).";
      sum += v;
    }
    var t = /^Всего: (\d+)$/.exec(L[10]);
    if (!t) return "Последняя строка должна быть «Всего: N». Сейчас там «" + L[10] + "».";
    if (+t[1] !== sum)
      return "Сумма не сходится: броски в строках дают " + sum + ", а написано " + t[1] +
             ". Скорее всего, randint вызывается дважды — и в строку попадает одно число, а в сумму другое.";
    return null;
  },
  password: function(res){
    var L = res.lines;
    if (L.length !== 3)
      return "Нужно ровно три строки: сам пароль, длина, число цифр. Сейчас их " + L.length + ".";
    var pw = L[0];
    if (pw.length !== 10) return "Пароль должен быть из 10 знаков, а в нём " + pw.length + ".";
    if (!/^[a-zA-Z0-9]+$/.test(pw))
      return "В пароле должны быть только латинские буквы и цифры из заданного алфавита. Сейчас: «" + pw + "».";
    var digits = (pw.match(/[0-9]/g) || []).length;
    var m1 = /^Длина: (\d+)$/.exec(L[1]);
    if (!m1) return "Вторая строка должна быть «Длина: 10». Сейчас «" + L[1] + "».";
    if (+m1[1] !== pw.length)
      return "Во второй строке написано " + m1[1] + ", а в пароле " + pw.length + " знаков. Считай длину через len(pw).";
    var m2 = /^Цифр: (\d+)$/.exec(L[2]);
    if (!m2) return "Третья строка должна быть «Цифр: N». Сейчас «" + L[2] + "».";
    if (+m2[1] !== digits)
      return "Цифр в пароле " + digits + ", а написано " + m2[1] + ". Считай их по самому паролю, а не заранее.";
    return null;
  },
  /* Урок про PEP 8 нельзя проверить по выводу: вывод и так правильный.
     Поэтому смотрим на сам код — но только то, что можно проверить надёжно. */
  pep8style: function(res, code){
    /* сначала вывод должен остаться прежним, потом смотрим на стиль */
    var want = ["360", "аня: 18/100"];
    if (res.lines.length !== want.length || res.lines[0] !== want[0] || res.lines[1] !== want[1])
      return diffBlock(want, res.lines);
    /* camelCase ищем только у имён с маленькой буквы: HeroCard — это класс, так и надо */
    if (/\b[a-z][A-Za-z0-9_]*[A-Z]/.test(String(code).replace(/#.*$/gm, "")))
      return "В коде остались имена вида calcTotal или heroCard — по PEP 8 их пишут через подчёркивание, а класс с большой буквы.";
    if (String(code).indexOf("MAX_HP") < 0)
      return "Число 100 встречается дважды — по условию его надо вынести в постоянную MAX_HP.";
    return CUSTOM.pep8(res, code);
  },
  pep8: function(res, code){
    var lines = String(code || "").split("\n");
    var inString = /(['"]).*\1/;
    for (var i = 0; i < lines.length; i++){
      var raw = lines[i];
      var line = raw.replace(/#.*$/, "");
      if (inString.test(line)) line = line.replace(/(['"]).*?\1/g, "STR");
      var no = i + 1;
      if (/,\S/.test(line))
        return "Строка " + no + ": после запятой нужен пробел.<div class=\"cmp\"><div><u>строка " + no + "</u>" + esc(raw.trim()) + "</div></div>";
      if (/[A-Za-zА-Яа-я0-9_)\]]\s*(\*|\+|-|\/)\s*[A-Za-zА-Яа-я0-9_(\[]/.test(line)){
        var m = /([A-Za-zА-Яа-я0-9_)\]])(\*|\+|-|\/)([A-Za-zА-Яа-я0-9_(\[])/.exec(line);
        if (m)
          return "Строка " + no + ": вокруг знака «" + m[2] + "» нужны пробелы.<div class=\"cmp\"><div><u>строка " + no + "</u>" + esc(raw.trim()) + "</div></div>";
      }
      if (/^\s*(def|class)\s/.test(raw) && /=[^\s=]/.test(line) === false && /\S=\S/.test(line.replace(/\(.*\)/, "")))
        return "Строка " + no + ": вокруг «=» нужны пробелы (кроме значений по умолчанию в скобках).";
      if (/[^\s,(=]=[^\s=]/.test(line) && !/^\s*(def|class)\s/.test(raw) && line.indexOf("(") < 0)
        return "Строка " + no + ": вокруг «=» нужны пробелы.<div class=\"cmp\"><div><u>строка " + no + "</u>" + esc(raw.trim()) + "</div></div>";
      if (raw.length > 79)
        return "Строка " + no + " длиннее 79 знаков — PEP 8 просит короче.";
      var indent = (raw.match(/^ */) || [""])[0].length;
      if (raw.trim() && indent % 4 !== 0)
        return "Строка " + no + ": отступ " + indent + " пробелов, а PEP 8 требует кратный четырём.";
    }
    return null;
  },
  card: function(res){
    var L = res.lines;
    if (L.length < 3) return "Нужно три строки, а получилось " + L.length + ". Каждая строка — отдельная команда print.";
    if (!L[0].trim() || !L[1].trim()) return "Первые две строки не должны быть пустыми.";
    if (!/^\d+$/.test(L[2].trim())) return "Третья строка должна быть просто числом — например print(12), без кавычек. Сейчас там: «" + L[2] + "».";
    return null;
  }
};
/* Файлы с данными: у каждого запуска своя копия, чтобы прошлый запуск
   не влиял на следующий. Ученик их видит в панели «файлы на диске». */
function dataFiles(src){
  var out = {};
  if (src) for (var k in src) out[k] = src[k];
  return out;
}

/* Файлы урока для эталонного решения: {"tools.py": "…"} */
function solutionSources(body){
  var out = {};
  (body.task.files || []).forEach(function(f){ out[f.name] = f.solution !== undefined ? f.solution : f.starter; });
  return out;
}

/* ===== проверка скрытыми тестами =====
   Ученик пишет функции по описанию и не видит проверок — как на работе.
   Каждый вызов из chk.calls дописывается к его коду отдельной программой,
   результат сравнивается с тем же вызовом на эталонном решении. */
/* Есть ли в коде такой кусок. Спецсимволы экранируем — иначе «max(» рушит
   регулярное выражение, а «\b» приклеиваем только к латинским краям: в
   JavaScript \w — это латиница, и после русской буквы граница слова не ловится. */
function codeHas(code, needle){
  var esc = String(needle).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var pre = /^[A-Za-z0-9_]/.test(needle) ? "\\b" : "";
  var post = /[A-Za-z0-9_]$/.test(needle) ? "\\b" : "";
  return new RegExp(pre + esc + post).test(code);
}

function runHiddenTests(eng, calls, code, srcs, solution, refSrcs, data, stdin){
  for (var i = 0; i < calls.length; i++){
    var call = calls[i];
    var probe = "\nprint(repr(" + call + "))\n";
    var want = eng.run(solution + probe, { sources: refSrcs, files: data, stdin: stdin || [] });
    var got = eng.run(code + probe, { sources: srcs, files: data, stdin: stdin || [] });
    if (got.error)
      return "Проверка вызвала <code>" + esc(call) + "</code> — и программа упала: " +
             (KIND_RU[got.error.kind] || got.error.kind) + ", " + esc(got.error.msg);
    var w = want.lines[want.lines.length - 1], g = got.lines[got.lines.length - 1];
    if (w !== g)
      return "Проверка вызвала <code>" + esc(call) + "</code>." +
             '<div class="cmp"><div><u>должно вернуть</u>' + esc(String(w)) +
             '</div><div><u>вернулось</u>' + esc(String(g === undefined ? "(ничего)" : g)) + '</div></div>' +
             "Всего скрытых проверок: " + calls.length + ". Эта — номер " + (i + 1) + ".";
  }
  return null;
}

function diffBlock(exp, got){
  var n = Math.max(exp.length, got.length), bad = -1;
  for (var i = 0; i < n; i++) if ((exp[i] || "") !== (got[i] || "")){ bad = i; break; }
  var head = bad < 0 ? "Строк должно быть " + exp.length + ", а получилось " + got.length + "."
                     : "Первое расхождение в строке " + (bad+1) + " вывода.";
  return head + '<div class="cmp"><div><u>должно быть</u>' + esc(exp.slice(0,8).join("\n") || "(пусто)") +
    (exp.length > 8 ? "\n…" : "") + '</div><div><u>получилось</u>' + esc(got.slice(0,8).join("\n") || "(пусто)") +
    (got.length > 8 ? "\n…" : "") + '</div></div>';
}

/* ===== кнопка подсказки =====
   Одна механика на уроки, разминки, «Ты и ИИ» и проекты. Раньше этот
   обработчик был скопирован четырежды, и копии успели разойтись: в уроке
   не было проверки «а подсказки вообще есть», поэтому урок без hints ронял
   бы страницу на первом же нажатии (в тестах требование hints стояло только
   для разминок, «Ты и ИИ» и проектов). onTake — что записать в журнал:
   у уроков подсказка стоит звезды, в остальных разделах нет. */
function wireHint(hints, onTake){
  var btn = document.getElementById("hintbtn");
  if (!btn) return;
  var hs = hints || [];
  if (!hs.length){ btn.disabled = true; btn.textContent = "Подсказок нет"; return; }
  btn.onclick = function(){
    if (session.hints >= hs.length) return;
    session.hints++;
    if (onTake) onTake();
    var out = document.getElementById("hintout");
    out.className = "hintout show";
    out.innerHTML = hs.slice(0, session.hints).map(function(x, i){
      return '<div class="step"><b>' + (i+1) + '.</b> ' + esc(x) + '</div>';
    }).join("");
    if (session.hints >= hs.length) btn.textContent = "Подсказки кончились";
  };
}

/* ================= экран: миры ================= */
function screenWorlds(){
  enterScreen();
  /* Страховка: если содержание каких-то миров ещё не подгрузилось (это бывает
     только на сайте с раздельными файлами), догружаем всё и перерисовываем —
     иначе готовые миры показались бы как «в работе». */
  if (!window.__SINGLE_FILE__ && CURRICULUM.some(function(w){ return !CONTENT["world" + w.n]; })){
    allWorldsContent().then(function(){
      if (document.querySelector(".worlds")) screenWorlds();
    });
  }
  var doneTotal = Object.keys(S.stars).length;
  var h = '<div class="hero">' +
    '<h1>Кодоквест</h1>' +
    '<p>Настоящий Python прямо в браузере: код выполняется, рисует и объясняет ошибки понятными словами. Путь из ста уроков — от первой команды до собственного проекта.</p>' +
    '<div class="row">' +
      '<button class="bigbtn" id="go-next">' + (doneTotal ? "Продолжить" : "Начать путь") + '</button>' +
      '<button class="bigbtn ghost" id="go-sand">Свободное рисование</button>' +
    '</div></div>';

  h += '<div class="sect"><h2>Пять миров</h2><div class="line"></div><span class="cnt">' + doneTotal + ' из ' + CURRICULUM.total + '</span></div><div class="worlds">';
  CURRICULUM.forEach(function(w){
    var ready = worldReadyLessons(w);
    var done = ready.filter(function(l){ return solved(l.id); }).length;
    var pct = w.lessons.length ? Math.round(done / w.lessons.length * 100) : 0;
    var status = ready.length === 0 ? "в работе"
      : done === w.lessons.length ? "пройден"
      : done + " из " + w.lessons.length;
    h += '<button class="world' + (ready.length ? "" : " soon") + '" data-w="' + w.n + '">' +
      '<div class="wtop"><span class="wicon">' + w.icon + '</span>' +
        '<div><div class="widx">Мир ' + w.n + ' · уроки ' + ((w.n-1)*20+1) + '–' + (w.n*20) + '</div>' +
        '<h3>' + w.title + '</h3></div>' +
        '<span class="wstat">' + status + '</span></div>' +
      '<p>' + w.desc + '</p>' +
      '<div class="wbar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="wfoot"><span>' + ready.length + ' уроков готово</span>' +
        '<span class="tag' + (w.engine === "pyodide" ? " pro" : "") + '">' +
          (w.engine === "mini" ? "быстрый движок" : w.engine === "mixed" ? "смешанный" : "настоящий Python") + '</span></div>' +
      '</button>';
  });
  h += '</div>';

  h += '<div class="sect"><h2>Достижения</h2><div class="line"></div></div><div class="badges">';
  BADGES.forEach(function(b){
    h += '<div class="badge' + (S.badges.indexOf(b.id) >= 0 ? " got" : "") + '">' +
      '<span class="em">' + b.em + '</span><span><b>' + b.name + '</b><span>' + b.desc + '</span></span></div>';
  });
  h += '</div>';

  app.innerHTML = h;
  document.getElementById("go-next").onclick = function(){
    var next = null;
    CURRICULUM.forEach(function(w){
      if (next) return;
      var ready = worldReadyLessons(w);
      for (var i = 0; i < ready.length; i++) if (!solved(ready[i].id)){ next = ready[i]; return; }
    });
    if (next) openLesson(next.id); else screenWorld(1);
  };
  document.getElementById("go-sand").onclick = screenSandbox;
  app.querySelectorAll(".world").forEach(function(b){
    b.onclick = function(){ screenWorld(+b.getAttribute("data-w")); };
  });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= экран: мир ================= */
function screenWorld(n){
  var seq = enterScreen();
  var w = CURRICULUM.world(n);
  worldContent(n).then(function(){
    if (screenStale(seq)) return;          /* ушли на другой экран, пока грузился мир */
    var ready = worldReadyLessons(w);
    var h = '<div class="lvlhead"><div><div class="idx">Мир ' + w.n + ' из 5</div>' +
      '<h1>' + w.icon + ' ' + w.title + '</h1></div></div>' +
      '<p class="lede">' + w.desc + '</p>';

    if (!ready.length)
      h += '<div class="note"><b>Этот мир ещё пишется</b>Ниже — план уроков, чтобы было видно дорогу. Уроки появятся волнами по десять.</div>';

    h += '<div class="lessons">';
    w.lessons.forEach(function(l){
      var has = !!lessonBody(l), open = has && lessonOpen(l), st = starsOf(l.id);
      var stars = "";
      for (var k = 0; k < 3; k++) stars += (k < st) ? "<b>★</b>" : "★";
      var cls = !has ? "soon" : (open ? "" : "locked");
      h += '<button class="lesson ' + cls + '" data-id="' + l.id + '"' + (open ? "" : " disabled") + '>' +
        '<span class="lnum">' + l.num + '</span>' +
        '<span class="lbody"><b>' + l.title + (l.boss ? ' <span class="bosstag">босс</span>' : '') + '</b>' +
        '<span>' + l.sub + '</span></span>' +
        '<span class="lright">' + (has ? '<span class="stars">' + stars + '</span>' : '<span class="soontag">скоро</span>') + '</span>' +
        '</button>';
    });
    h += '</div>';

    /* карточка проекта — сразу за последним уроком мира. Проект живёт вне
       сотни (звёзд не даёт), но показан прямо здесь, чтобы мимо не пройти. */
    var proj = projectOfWorld(n);
    if (proj){
      var popen = projectOpen(proj), pdone = projectDone(proj.id);
      var pst = projectState(proj.id);
      var pnote = pdone
        ? "Собран целиком. Можно открыть, запустить и забрать код себе."
        : (popen
            ? (pst.step > 0 ? "Начат: пройдено шагов " + pst.step + " из " + proj.steps.length + "."
                            : "Все уроки мира пройдены — можно собирать проект.")
            : "Откроется, когда пройдёшь все уроки этого мира.");
      h += '<div class="projcard' + (popen ? "" : " locked") + (pdone ? " done" : "") + '">' +
        '<span class="pjemoji">' + proj.emoji + '</span>' +
        '<span class="pjbody"><span class="pjkicker">Проект мира ' + n + ' · вне сотни уроков</span>' +
        '<b>' + esc(proj.title) + (pdone ? ' <span class="edittag done">собран ✓</span>' : '') + '</b>' +
        '<span>' + esc(proj.tagline) + '</span>' +
        '<span class="pjnote">' + esc(pnote) + '</span></span>' +
        (popen ? '<button class="bigbtn" id="openproj">' +
                   (pdone ? "Открыть" : (pst.step > 0 ? "Продолжить" : "Собрать проект")) + '</button>'
               : '<span class="soontag">закрыт</span>') +
      '</div>';
    }

    h += '<div class="pager"><button class="bigbtn ghost" id="tomap">← Ко всем мирам</button><span class="sp"></span>' +
      (n < 5 ? '<button class="bigbtn ghost" id="wnext">Мир ' + (n+1) + ' →</button>' : '') + '</div>';

    app.innerHTML = h;
    app.querySelectorAll(".lesson").forEach(function(b){
      b.onclick = function(){ if (!b.disabled) openLesson(b.getAttribute("data-id")); };
    });
    document.getElementById("tomap").onclick = screenWorlds;
    var op = document.getElementById("openproj");
    if (op) op.onclick = function(){
      var pr = projectOfWorld(n);
      if (projectDone(pr.id)) screenProjectDone(pr.id); else openProject(pr.id);
    };
    var wn = document.getElementById("wnext");
    if (wn) wn.onclick = function(){ screenWorld(n+1); };
    refreshTop();
    window.scrollTo({ top:0, behavior:"smooth" });
  });
}

/* ================= экран: урок ================= */
var session = null;

function openLesson(id){
  var l = CURRICULUM.byId(id);
  if (!l) return screenWorlds();
  var seq = claimScreen();
  worldContent(l.world).then(function(){
    if (screenStale(seq)) return;          /* ушли на другой экран, пока грузился мир */
    var body = lessonBody(l);
    if (!body) return screenWorld(l.world);
    session = { id:id, attempts:0, hints:0, shown:false };
    touchLog(id); startTimer(id);
    var w = CURRICULUM.world(l.world);
    var ready = worldReadyLessons(w);
    var pos = ready.indexOf(l);

    var head = '<div class="crumbs"><span data-go="worlds">Миры</span> › <span data-go="world">' + w.icon + ' ' + w.title + '</span></div>' +
      '<div class="lvlhead"><div><div class="idx">' + (l.boss ? "Босс мира " + w.n : "Урок " + l.num + " из 100") + '</div>' +
      '<h1>' + l.title + '</h1></div><div class="right">' +
      '<span class="tag">' + l.sub + '</span>' + (body.draw ? '<span class="tag draw">рисование</span>' : '') + '</div></div>' +
      '<p class="lede">' + body.lede + '</p>';

    var theory = body.theory.map(function(t, i){
      /* t.show — код, который в тренажёре не запускается: настоящий Flask,
         команды терминала, чужие библиотеки. Показываем как есть и честно
         пишем, где он работает. t.demo при этом может и быть, и не быть. */
      var shown = t.show
        ? '<div class="showcode"><pre><code>' + hl(t.show) + '</code></pre>' +
          '<span class="shownote">' + (t.showNote || "этот код работает на настоящем компьютере, а не в тренажёре") + '</span></div>'
        : "";
      var demo = t.demo
        ? '<div class="demo" data-demo="' + i + '"><pre><code>' + hl(t.demo) + '</code></pre>' +
          '<div class="bar"><button class="minibtn" data-run="' + i + '">▶ Запустить пример</button>' +
          '<button class="minibtn" data-copy="' + i + '">→ В редактор</button>' +
          '<span class="hintx' + (t.err ? " errx" : "") + '">' +
          (t.err ? "этот пример падает с ошибкой — так и задумано" : "можно менять и запускать снова") +
          '</span></div><div class="res"></div></div>'
        : "";
      return '<div class="card theory"><h3>' + t.h + '</h3><p>' + t.p + '</p>' + shown + demo + '</div>';
    }).join("");

    var isFix = body.task.type === "fix";
    var goal = '<div class="goal"><h3>' + (isFix ? "🔧 Задача: починить" : "🎯 Твоя задача") + '</h3><p>' +
      body.task.goal + '</p><ul>' +
      body.task.list.map(function(x){ return "<li>" + x + "</li>"; }).join("") + '</ul></div>';
    var bug = isFix
      ? '<div class="bugcard"><h3>🐞 Что сейчас не так</h3><p>' + body.task.symptom + '</p>' +
        '<span class="bugtip">Код ниже нужно починить, а не заменить своим. Если запутался, ' +
        'кнопка «↩ Вернуть как было» вернёт исходный сломанный вариант.</span></div>'
      : "";

    var hints = '<div class="hintbox">' +
      '<button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
      '<button class="rbtn sec" id="solbtn">Показать решение</button>' +
      '<span class="tip">за подсказку теряется одна звезда</span></div><div class="hintout" id="hintout"></div>';

    var prev = pos > 0 ? ready[pos-1] : null, next = pos < ready.length-1 ? ready[pos+1] : null;
    var pager = '<div class="pager"><button class="bigbtn ghost" data-go="world">← К списку уроков</button><span class="sp"></span>' +
      (prev ? '<button class="bigbtn ghost" data-open="' + prev.id + '">Назад</button>' : '') +
      (next ? '<button class="bigbtn ghost" data-open="' + next.id + '">Дальше →</button>' : '') + '</div>';

    app.innerHTML = head + theory + goal + bug + '<div id="studio"></div>' + hints + pager;

    /* Задание может состоять из нескольких файлов: главный плюс модули. */
    var taskFiles = body.task.files
      ? [{ name: body.task.mainName || "main.py", code: body.task.starter }].concat(
          body.task.files.map(function(f){ return { name:f.name, code:f.starter }; }))
      : null;
    var solutionFiles = body.task.files
      ? [{ name: body.task.mainName || "main.py", code: body.task.solution }].concat(
          body.task.files.map(function(f){ return { name:f.name, code: f.solution !== undefined ? f.solution : f.starter }; }))
      : null;

    var studio = makeStudio({
      engine: l.engine, draw: body.draw, code: body.task.starter, data: body.task.data,
      stdin: body.task.stdin,
      label: isFix ? "сломанный код — почини его" : "твой код",
      files: taskFiles,
      restore: isFix ? body.task.starter : null,
      restoreFiles: isFix ? taskFiles : null,
      onRun: function(){ logOf(l.id).runs++; save(); },
      check: function(ed, showMsg, canvas){ runCheck(l, body, ed, showMsg, canvas); }
    });
    document.getElementById("studio").appendChild(studio);
    session.studio = studio;

    app.querySelectorAll(".demo[data-demo]").forEach(function(d){
      var i = +d.getAttribute("data-demo"), res = d.querySelector(".res");
      d.querySelector("[data-run]").onclick = function(){
        var eng = studio.engine;
        var t = eng.newTurtle ? eng.newTurtle() : null;
        var r = eng.run(body.theory[i].demo, { turtle:t, sources: body.theory[i].files || {}, files: dataFiles(body.theory[i].data), stdin: body.theory[i].stdin || [] });
        res.className = "res show";
        res.textContent = r.error
          ? ("⚠ " + (KIND_RU[r.error.kind] || r.error.kind) + (r.error.line ? " (строка " + r.error.line + ")" : "") + ": " + r.error.msg)
          : (r.output || "(эта программа ничего не печатает — смотри на холст)");
        if (studio.canvas && t && t.segs.length) animateTurtle(studio.canvas, t);
        award("first");
      };
      d.querySelector("[data-copy]").onclick = function(){
        studio.editor.setCode(body.theory[i].demo);
        studio.editor.focusEditor();
        studio.scrollIntoView({ behavior:"smooth", block:"center" });
      };
    });

    wireHint(body.task.hints, function(){ logOf(l.id).hints++; save(); });
    document.getElementById("solbtn").onclick = function(){
      session.shown = true;
      logOf(l.id).shown++; save();
      if (solutionFiles && studio.editor.setFiles) studio.editor.setFiles(solutionFiles);
      else studio.editor.setCode(body.task.solution);
      studio.showMsg("warn", "<b>Вот рабочее решение</b>Прочитай его строчку за строчкой, запусти, а потом поменяй числа и посмотри, что изменится. За урок будет одна звезда.");
    };
    app.querySelectorAll("[data-go]").forEach(function(b){
      b.onclick = function(){
        var g = b.getAttribute("data-go");
        if (g === "worlds") screenWorlds(); else screenWorld(l.world);
      };
    });
    app.querySelectorAll("[data-open]").forEach(function(b){
      b.onclick = function(){ openLesson(b.getAttribute("data-open")); };
    });

    refreshTop();
    window.scrollTo({ top:0, behavior:"smooth" });
  });
}

function runCheck(l, body, ed, showMsg, canvas){
  session.attempts++;
  logOf(l.id).attempts++; touchLog(l.id);
  var chk = body.task.check, code = ed.getCode(), eng = Runtime.get(l.engine);

  /* Требования проверяем по ВСЕМ файлам задания, а не только по главному:
     в многофайловом уроке нужная строчка законно живёт в подключённом файле. */
  var srcsForCheck = ed.getSources ? ed.getSources() : {};
  var весьКод = code;
  for (var fk in srcsForCheck) весьКод += "\n" + srcsForCheck[fk];

  if (chk.needCode){
    for (var i = 0; i < chk.needCode.length; i++){
      if (!codeHas(весьКод, chk.needCode[i])){
        showMsg("warn", "<b>Почти</b>" + chk.needMsg);
        return;
      }
    }
  }
  /* needText — проверка по подстроке: нужна там, где искать «по словам»
     нельзя, например для «-> str» или для тройных кавычек. */
  if (chk.needText){
    for (var t2 = 0; t2 < chk.needText.length; t2++){
      if (весьКод.indexOf(chk.needText[t2]) < 0){
        showMsg("warn", "<b>Почти</b>" + chk.needMsg);
        return;
      }
    }
  }
  /* Запрещённые конструкции: например урок про рекурсию должен решаться
     рекурсией, а не циклом — иначе смысл урока теряется. */
  if (chk.noCode){
    for (var j = 0; j < chk.noCode.length; j++){
      if (codeHas(весьКод, chk.noCode[j])){
        showMsg("warn", "<b>Так нельзя</b>" + (chk.noMsg || ("В этом задании нельзя использовать «" + chk.noCode[j] + "».")));
        return;
      }
    }
  }

  var srcs = ed.getSources ? ed.getSources() : {};
  var refSrcs = solutionSources(body);
  var t = eng.newTurtle ? eng.newTurtle() : null;
  /* Ответы для input() берём те, что сейчас в панели: эталон считается
     на них же, иначе сравнивать вывод было бы нечестно. */
  var stdin = (session.studio && session.studio.getStdin) ? session.studio.getStdin() : (body.task.stdin || []);
  var res = eng.run(code, { turtle:t, sources: srcs, files: dataFiles(body.task.data), stdin: stdin });
  if (canvas) animateTurtle(canvas, t);
  if (res.error){ ed.setError(res.error.line); showMsg("bad", errHTML(res.error)); return; }

  var problem = null;
  if (chk.kind === "custom"){
    problem = (CUSTOM[chk.fn] || function(){ return null; })(res, code);
  } else if (chk.kind === "tests"){
    problem = runHiddenTests(eng, chk.calls, code, srcs, body.task.solution, refSrcs, dataFiles(body.task.data), stdin);
  } else if (chk.kind === "output"){
    var exp = chk.lines || eng.run(body.task.solution, { sources: refSrcs, files: dataFiles(body.task.data), stdin: stdin }).lines;
    var got = res.lines;
    if (!(exp.length === got.length && exp.every(function(x, i){ return x === got[i]; })))
      problem = diffBlock(exp, got);
  } else if (chk.kind === "turtle"){
    var ref = eng.run(body.task.solution, { turtle: eng.newTurtle(), sources: refSrcs, files: dataFiles(body.task.data), stdin: stdin }).turtle;
    if (!sameDrawing(t.segs, ref.segs)){
      problem = t.segs.length === 0
        ? "Черепашка не нарисовала ни одной линии. Проверь, что вызываешь forward(...) — и что карандаш опущен."
        : t.segs.length === ref.segs.length
          ? "Линий столько, сколько нужно (" + ref.segs.length + "), но рисунок другой. Значит, дело в длине стороны или в угле поворота."
          : "Линий должно быть " + ref.segs.length + ", а у тебя " + t.segs.length + ". Проверь, сколько раз повторяется цикл и сколько команд внутри него.";
    } else if (chk.pen && !sameDrawing(t.segs, ref.segs, true)){
      problem = "Форма правильная, а вот цвет или толщина не те. Проверь, что перед каждой линией стоит нужный color(...) и что width(...) задан там, где нужно.";
    }
  }

  if (problem){ showMsg("bad", "<b>Ещё не то</b>" + problem); return; }

  /* «найди ошибку»: вывод верный — но код починен или написан заново? */
  if (body.task.type === "fix"){
    var budget = chk.fixBudget || (editUnits(body.task.starter, body.task.solution) + 1);
    if (editUnits(body.task.starter, code) > budget){
      showMsg("warn", "<b>Работает, но это не починка</b>Вывод правильный — только строк изменено больше, чем нужно: " +
        "похоже, программа написана заново. Смысл задания в другом: найти одну поломку и тронуть только её. " +
        "Нажми «↩ Вернуть как было» и попробуй ещё раз.");
      return;
    }
  }
  winLesson(l, body);
}

/* ================= победа ================= */
function winLesson(l, body){
  var stars = session.shown ? 1 : (session.hints > 0 || session.attempts > 1 ? 2 : 3);
  var prev = starsOf(l.id), gained = 0;
  if (stars > prev){ gained = STAR_XP[stars] - STAR_XP[prev]; S.xp += gained; S.stars[l.id] = stars; }

  if (stars === 3 && session.attempts === 1 && !session.shown && !session.hints){
    S.firstTry = (S.firstTry || 0) + 1;
    if (S.firstTry >= 3) award("sniper");
  } else S.firstTry = 0;
  if (stars === 3){ S.perfect = (S.perfect || 0) + 1; if (S.perfect >= 5) award("perfect"); }
  if (body.draw){ S.drawDone[l.id] = 1; if (Object.keys(S.drawDone).length >= 3) award("artist"); }
  if (Object.keys(S.stars).length >= 10) award("ten");
  var w = CURRICULUM.world(l.world);
  if (worldReadyLessons(w).length === w.lessons.length &&
      w.lessons.every(function(x){ return solved(x.id); })) award("world1");
  var lg = logOf(l.id);
  lg.stars = Math.max(lg.stars || 0, stars);
  if (!lg.solvedAt) lg.solvedAt = Date.now();
  lg.last = Date.now();
  markActiveToday();   /* пройденный урок держит дневной стрик живым */
  save(); refreshTop();

  var ready = worldReadyLessons(w), pos = ready.indexOf(l);
  var next = pos < ready.length - 1 ? ready[pos+1] : null;
  var starStr = "";
  for (var k = 0; k < 3; k++) starStr += k < stars ? "<b>★</b>" : "★";

  document.getElementById("wincard").innerHTML =
    '<div class="big">' + (stars === 3 ? "🏆" : stars === 2 ? "🎉" : "✅") + '</div>' +
    '<h2>' + (stars === 3 ? "Идеально!" : "Урок пройден") + '</h2>' +
    '<div class="winstars">' + starStr + '</div>' +
    '<p>' + (stars === 3 ? "С первой попытки и без подсказок."
          : stars === 2 ? "Работает. Три звезды дают за решение с первого раза без подсказок."
          : "Решение было показано — звезда одна. Попробуй пройти урок заново сам.") + '</p>' +
    takeShieldNote() +
    '<div class="winxp">+' + gained + ' XP</div><div class="winrow">' +
      (next ? '<button class="bigbtn" id="wnext">Дальше →</button>'
            : '<button class="bigbtn" id="wlist">К списку уроков</button>') +
      '<button class="bigbtn ghost" id="wstay">Остаться здесь</button></div>';
  document.getElementById("win").classList.add("show");
  confetti(stars);
  var wn = document.getElementById("wnext");
  if (wn) wn.onclick = function(){ closeWin(); openLesson(next.id); };
  var wl = document.getElementById("wlist");
  if (wl) wl.onclick = function(){ closeWin(); screenWorld(l.world); };
  document.getElementById("wstay").onclick = closeWin;
}
function closeWin(){ document.getElementById("win").classList.remove("show"); }

function confetti(n){
  var c = document.getElementById("confetti");
  var ctx = c.getContext && c.getContext("2d");
  if (!ctx || reduced()) return;
  c.style.display = "block";
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth*dpr; c.height = innerHeight*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  var cols = ["#7c5cff","#00e0b8","#ffc53d","#ff6b6b","#3ddc84"], ps = [];
  for (var i = 0; i < 40*n; i++)
    ps.push({ x: innerWidth/2 + (Math.random()-.5)*260, y: innerHeight/2 - 60,
      vx:(Math.random()-.5)*9, vy:-Math.random()*11-3, s:4+Math.random()*6,
      c:cols[i%cols.length], r:Math.random()*6 });
  var t0 = performance.now();
  (function frame(now){
    ctx.clearRect(0,0,innerWidth,innerHeight);
    ps.forEach(function(p){
      p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += .12;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6); ctx.restore();
    });
    if (now - t0 < 2600) requestAnimationFrame(frame);
    else { ctx.clearRect(0,0,innerWidth,innerHeight); c.style.display = "none"; }
  })(t0);
}

/* ================= песочница ================= */
var SANDBOX_START = 'color("cyan")\nwidth(3)\n\nfor i in range(36):\n    forward(120)\n    right(100)\n\nprint("Готово! Меняй числа и смотри, что будет.")\n';
function screenSandbox(){
  enterScreen();
  session = { id:null, attempts:0, hints:0, shown:false };
  var ref = ["forward(100)","back(50)","right(90)","left(90)",'color("red")',"width(5)","penup()","pendown()",
             "goto(0, 0)","dot(10)","circle(60)","print(x)","range(10)","len(s)","sum(xs)","randint(1, 6)","sqrt(16)"];
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">свободный режим</div><h1>Песочница</h1></div></div>' +
    '<p class="lede">Никаких заданий и проверок. Пиши что угодно, запускай, ломай и чини. Код сохраняется между заходами.</p>' +
    '<div class="card"><h3>Что можно позвать</h3><div class="ref">' +
      ref.map(function(x){ return "<span>" + esc(x) + "</span>"; }).join("") +
    '</div><p class="dim">Нажми на команду — она вставится в конец кода.</p></div>' +
    '<div id="studio"></div><div class="pager"><button class="bigbtn ghost" id="tomap">← Ко всем мирам</button></div>';

  var studio = makeStudio({
    engine:"mini", draw:true, code: S.sandbox || SANDBOX_START,
    onRun: function(){
      S.sandboxRuns = (S.sandboxRuns || 0) + 1;
      S.sandbox = studio.editor.getCode();
      if (S.sandboxRuns >= 10) award("explorer");
      save();
    }
  });
  document.getElementById("studio").appendChild(studio);
  app.querySelectorAll(".ref span").forEach(function(sp){
    sp.onclick = function(){
      var c = studio.editor.getCode();
      studio.editor.setCode(c + (!c || /\n$/.test(c) ? "" : "\n") + sp.textContent + "\n");
      studio.editor.focusEditor();
    };
  });
  document.getElementById("tomap").onclick = function(){ S.sandbox = studio.editor.getCode(); save(); screenWorlds(); };
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= экран: игры =================
   Готовые маленькие игры. Код виден и его можно менять прямо здесь:
   поправил — нажал «Новая игра» — играешь свою версию. Изменения
   сохраняются между заходами, а кнопка «Вернуть оригинал» их сбрасывает. */
function gamesList(){ return (window.GAMES || []); }
function gameCode(g){ return (S.games && S.games[g.id]) || g.code; }

function screenGames(){
  enterScreen();
  session = { id:null, attempts:0, hints:0, shown:false };
  var gs = gamesList();
  var h = '<div class="lvlhead"><div><div class="idx">поиграй и загляни внутрь</div><h1>🎮 Игры</h1></div></div>' +
    '<p class="lede">Настоящие маленькие игры на Python. В каждой виден код — меняй его и смотри, что получится: сделай подсказку добрее, добавь свой вопрос в викторину, поменяй ответы дракона. Это самый быстрый способ понять, как код превращается в игру.</p>' +
    '<div class="gamegrid">';
  gs.forEach(function(g){
    var edited = !!(S.games && S.games[g.id]);
    h += '<button class="gamecard" data-id="' + g.id + '">' +
      '<span class="gemoji">' + g.emoji + '</span>' +
      '<b>' + esc(g.title) + (edited ? ' <span class="edittag">твоя версия</span>' : '') + '</b>' +
      '<span>' + esc(g.desc) + '</span></button>';
  });
  h += '</div><div class="pager"><button class="bigbtn ghost" id="tomap">← Ко всем мирам</button></div>';
  app.innerHTML = h;
  app.querySelectorAll(".gamecard").forEach(function(b){
    b.onclick = function(){ openGame(b.getAttribute("data-id")); };
  });
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function openGame(id){
  var g = gamesList().filter(function(x){ return x.id === id; })[0];
  if (!g) return screenGames();
  enterScreen();
  session = { id:null, attempts:0, hints:0, shown:false };
  var head = '<div class="crumbs"><span data-go="games">Игры</span> › ' + g.emoji + ' ' + esc(g.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">игра</div><h1>' + g.emoji + ' ' + esc(g.title) + '</h1></div></div>' +
    '<p class="lede">' + esc(g.desc) + '</p>' +
    '<div class="note"><b>Как играть</b>Нажми «Новая игра», потом пиши ходы в поле снизу и жми Enter. Хочешь изменить игру — правь код слева и снова жми «Новая игра».</div>';
  app.innerHTML = head + '<div id="studio"></div>' +
    '<div class="pager"><button class="bigbtn ghost" data-go="games">← Ко всем играм</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="greset">↩ Вернуть оригинал</button></div>';

  var studio = makeStudio({
    engine: "mini", draw: !!g.draw, play: true, code: gameCode(g), label: g.title,
    onRun: function(){
      /* «твоя версия» — только если код действительно поменяли. Раньше здесь
         сохранялся любой запуск, и после первой же партии карточка игры
         врала: «твоя версия» появлялась на нетронутом коде. */
      var code = studio.editor.getCode();
      S.games = S.games || {};
      if (code === g.code) delete S.games[g.id]; else S.games[g.id] = code;
      S.gamesPlayed = S.gamesPlayed || {};
      S.gamesPlayed[g.id] = 1;
      save();
    }
  });
  document.getElementById("studio").appendChild(studio);
  session.studio = studio;
  document.getElementById("greset").onclick = function(){
    if (S.games) delete S.games[g.id];
    save();
    openGame(id);
  };
  app.querySelectorAll("[data-go]").forEach(function(b){
    b.onclick = function(){ screenGames(); };
  });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= экран: разминка (predict) =================
   Отдельный раздел рядом с «Играми». Ребёнок читает готовую программу
   и ДО запуска пишет, что она напечатает. Потом сверка.
   Прогресс хранится в S.warmups и не влияет на звёзды и сотню уроков.
   ============================================================ */
function warmupsList(){ return (window.WARMUPS || []); }
function warmupDone(id){ return !!(S.warmups && S.warmups[id]); }

/* Сравнение предсказания с настоящим выводом. Хвостовые пробелы в каждой
   строке и пустые строки в конце не считаем — их ребёнок мог не набрать,
   а на смысл они не влияют. Внутренние пустые строки важны и остаются. */
function normPred(s){
  return String(s == null ? "" : s)
    .replace(/\r/g, "")
    .split("\n")
    .map(function(x){ return x.replace(/[ \t]+$/, ""); })
    .join("\n")
    .replace(/\n+$/, "");
}

/* Где вывод впервые разошёлся с ожидаемым. Подписи колонок можно задать:
   для «угадай вывод» это «на самом деле / ты предсказал», для «собери из
   блоков» — «нужный вывод / твой вывод». */
function predictDiff(want, got, wantLabel, gotLabel){
  wantLabel = wantLabel || "на самом деле";
  gotLabel = gotLabel || "ты предсказал";
  var W = normPred(want).split("\n"), G = normPred(got).split("\n");
  var n = Math.max(W.length, G.length), bad = -1;
  for (var i = 0; i < n; i++) if ((W[i] || "") !== (G[i] || "")){ bad = i; break; }
  var head = bad < 0
    ? "Строк должно быть " + W.length + ", а получилось " + G.length + "."
    : "Первое расхождение в строке " + (bad + 1) + ".";
  return head + '<div class="cmp"><div><u>' + wantLabel + '</u>' +
    esc(W.slice(0, 10).join("\n") || "(пусто)") + (W.length > 10 ? "\n…" : "") +
    '</div><div><u>' + gotLabel + '</u>' +
    esc(G.slice(0, 10).join("\n") || "(пусто)") + (G.length > 10 ? "\n…" : "") +
    '</div></div>';
}

/* Рабочая станция разминки: слева программа только для чтения, снизу
   поле для предсказания. Устроена так, чтобы сквозной тест мог с ней
   работать теми же ручками, что и с обычным редактором: editor.setCode /
   editor.getCode задают и читают предсказание, а кнопка «Проверить»
   помечена data-role="check". */
function makePredictStudio(cfg){
  cfg = cfg || {};
  var wrap = document.createElement("div");
  wrap.className = "predict";

  var codeBox = document.createElement("div");
  codeBox.className = "pcode";
  codeBox.innerHTML = '<div class="ehead"><span class="dot"></span><span class="dot"></span>' +
    '<span class="dot"></span><span class="lbl">программа — только читаем</span></div>' +
    '<pre><code>' + hl(cfg.code || "") + '</code></pre>';

  var ansBox = document.createElement("div");
  ansBox.className = "pane pans";
  ansBox.innerHTML = '<div class="ph">что напечатает программа?</div><div class="pb">' +
    '<textarea class="stdinbox predin" spellcheck="false" autocapitalize="off" autocorrect="off" rows="6" ' +
    'placeholder="Запиши вывод по строкам — так, как его напечатает программа"></textarea>' +
    '<div class="stdinhint">По строке на каждый print. Потом нажми «Проверить».</div></div>';
  var ta = ansBox.querySelector("textarea");

  var runbar = document.createElement("div");
  runbar.className = "runbar";
  runbar.innerHTML = '<button class="rbtn check" data-role="check">✓ Проверить</button>' +
    '<button class="rbtn sec" data-role="clear">↺ Очистить</button>' +
    '<span class="sp"></span><span class="tip">сначала подумай, потом проверь</span>';

  var msg = document.createElement("div"); msg.className = "msg";

  var outPane = document.createElement("div"); outPane.className = "pane pout"; outPane.style.display = "none";
  outPane.innerHTML = '<div class="ph">настоящий вывод программы</div><div class="console"></div>';
  var con = outPane.querySelector(".console");

  wrap.appendChild(codeBox);
  wrap.appendChild(ansBox);
  wrap.appendChild(runbar);
  wrap.appendChild(msg);
  wrap.appendChild(outPane);

  function showMsg(cls, html){ msg.className = "msg show " + cls; msg.innerHTML = html; }
  function hideMsg(){ msg.className = "msg"; }

  wrap.editor = {
    getCode: function(){ return ta.value; },
    setCode: function(v){ ta.value = v; },
    focusEditor: function(){ ta.focus(); }
  };
  wrap.showMsg = showMsg;
  wrap.reveal = function(text){
    outPane.style.display = "";
    con.innerHTML = text ? esc(text) : '<span class="empty">программа ничего не печатает</span>';
  };
  wrap.hideOut = function(){ outPane.style.display = "none"; };

  runbar.addEventListener("click", function(e){
    var b = e.target.closest("button"); if (!b) return;
    var r = b.getAttribute("data-role");
    if (r === "check") cfg.check(wrap.editor, showMsg);
    else if (r === "clear"){ ta.value = ""; hideMsg(); wrap.hideOut(); ta.focus(); }
  });
  ta.addEventListener("keydown", function(e){
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter"){ e.preventDefault(); cfg.check(wrap.editor, showMsg); }
  });

  return wrap;
}

/* Рабочая станция «собери из блоков»: перемешанные строки, которые
   переставляют перетаскиванием или кнопками ▲▼. Как и у predict,
   editor.setCode / editor.getCode работают со сборкой (нужны тесту):
   getCode возвращает собранную программу, setCode раскладывает блоки
   в порядок переданного текста. */
function makeBlocksStudio(cfg){
  cfg = cfg || {};
  var wrap = document.createElement("div");
  wrap.className = "predict blocks";

  /* строки-блоки: без пустых, отступы сохраняем — они и есть подсказка о вложенности */
  var blocks = String(cfg.code || "").replace(/\r/g, "").split("\n")
    .filter(function(l){ return l.trim() !== ""; });

  /* Порядок блоков. Правильный ответ — это порядок 0,1,2,… (блоки нарезаны
     из готовой программы), поэтому перемешивание обязано его избегать: иначе
     упражнение решается само собой. Раньше проверка стояла только на старте,
     а кнопка «Перемешать заново» тасовала без неё — и могла выдать ответ. */
  var order = blocks.map(function(_, i){ return i; });
  function shuffleOrder(){
    for (var i = order.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var t = order[i]; order[i] = order[j]; order[j] = t;
    }
    var same = order.every(function(v, k){ return v === k; });
    if (same && order.length > 1) order.push(order.shift());
  }
  shuffleOrder();

  var head = document.createElement("div");
  head.className = "ehead";
  head.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>' +
    '<span class="lbl">переставь строки по порядку — тяни за ⠿ или жми ▲ ▼</span>';

  var list = document.createElement("div");
  list.className = "blocklist";

  function render(){
    list.innerHTML = order.map(function(bi, pos){
      return '<div class="block" draggable="true" data-pos="' + pos + '">' +
        '<span class="bgrip" title="перетащи">⠿</span>' +
        '<pre class="bcode"><code>' + hl(blocks[bi]) + '</code></pre>' +
        '<span class="bmove"><button class="bbtn" data-up title="выше">▲</button>' +
        '<button class="bbtn" data-down title="ниже">▼</button></span>' +
        '</div>';
    }).join("");
  }
  render();

  function move(from, to){
    if (to < 0 || to >= order.length || from === to) return;
    var v = order.splice(from, 1)[0];
    order.splice(to, 0, v);
    render();
  }

  /* кнопки ▲ ▼ — работают и на телефоне, где перетаскивать неудобно */
  list.addEventListener("click", function(e){
    var b = e.target.closest("button.bbtn"); if (!b) return;
    var row = b.closest(".block"); if (!row) return;
    var pos = +row.getAttribute("data-pos");
    move(pos, b.hasAttribute("data-up") ? pos - 1 : pos + 1);
  });

  /* перетаскивание мышью */
  var dragFrom = -1;
  list.addEventListener("dragstart", function(e){
    var row = e.target.closest(".block"); if (!row) return;
    dragFrom = +row.getAttribute("data-pos");
    row.classList.add("dragging");
    if (e.dataTransfer){ e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", ""); } catch(_){} }
  });
  list.addEventListener("dragover", function(e){
    e.preventDefault();
    var row = e.target.closest(".block"); if (!row) return;
    list.querySelectorAll(".block.over").forEach(function(x){ x.classList.remove("over"); });
    row.classList.add("over");
  });
  list.addEventListener("drop", function(e){
    e.preventDefault();
    var row = e.target.closest(".block"); if (!row || dragFrom < 0) return;
    move(dragFrom, +row.getAttribute("data-pos"));
    dragFrom = -1;
  });
  list.addEventListener("dragend", function(){
    dragFrom = -1;
    list.querySelectorAll(".dragging,.over").forEach(function(x){ x.classList.remove("dragging","over"); });
  });

  var runbar = document.createElement("div");
  runbar.className = "runbar";
  runbar.innerHTML = '<button class="rbtn check" data-role="check">✓ Проверить</button>' +
    '<button class="rbtn sec" data-role="shuffle">🔀 Перемешать заново</button>' +
    '<span class="sp"></span><span class="tip">строки читаются сверху вниз</span>';

  var msg = document.createElement("div"); msg.className = "msg";

  var outPane = document.createElement("div"); outPane.className = "pane pout"; outPane.style.display = "none";
  outPane.innerHTML = '<div class="ph">что напечатала твоя сборка</div><div class="console"></div>';
  var con = outPane.querySelector(".console");

  wrap.appendChild(head);
  wrap.appendChild(list);
  wrap.appendChild(runbar);
  wrap.appendChild(msg);
  wrap.appendChild(outPane);

  function showMsg(cls, html){ msg.className = "msg show " + cls; msg.innerHTML = html; }

  wrap.editor = {
    getCode: function(){ return order.map(function(bi){ return blocks[bi]; }).join("\n"); },
    setCode: function(text){
      var target = String(text || "").replace(/\r/g, "").split("\n")
        .filter(function(l){ return l.trim() !== ""; });
      var used = {}, newOrder = [];
      target.forEach(function(line){
        for (var i = 0; i < blocks.length; i++){
          if (!used[i] && blocks[i] === line){ used[i] = 1; newOrder.push(i); break; }
        }
      });
      for (var i = 0; i < blocks.length; i++) if (!used[i]) newOrder.push(i);
      order = newOrder; render();
    },
    focusEditor: function(){}
  };
  wrap.showMsg = showMsg;
  wrap.reveal = function(text){
    outPane.style.display = "";
    con.innerHTML = text ? esc(text) : '<span class="empty">программа ничего не напечатала</span>';
  };
  wrap.hideOut = function(){ outPane.style.display = "none"; };

  runbar.addEventListener("click", function(e){
    var b = e.target.closest("button"); if (!b) return;
    var r = b.getAttribute("data-role");
    if (r === "check") cfg.check(wrap.editor, showMsg);
    else if (r === "shuffle"){
      msg.className = "msg"; wrap.hideOut();
      shuffleOrder();
      render();
    }
  });

  return wrap;
}

function runBlocksCheck(w, ed, showMsg){
  session.attempts++;
  var eng = Runtime.get("mini");
  var got = eng.run(ed.getCode(), {});
  if (got.error){
    session.studio.hideOut();
    showMsg("bad", "<b>Пока не запускается</b>" + errHTML(got.error) +
      "<br>Скорее всего, какая-то строка стоит не на своём месте или не на своём отступе. Переставь и попробуй снова.");
    return;
  }
  var ref = eng.run(w.code, {});
  session.studio.reveal(got.output);
  if (got.output === ref.output){
    winWarmup(w);
  } else {
    showMsg("bad", "<b>Запускается, но вывод не тот</b>" +
      predictDiff(ref.output, got.output, "нужный вывод", "твой вывод") +
      "Порядок строк меняет и вывод — переставь и попробуй снова.");
  }
}

/* ================= экран: регистрация по имени =================
   Показывается на старте, если сервер настроен, а ученик ещё не выбран.
   Ребёнок вводит имя → создаётся код и аккаунт. Либо входит по готовому коду.
   ============================================================ */
function screenRegister(){
  enterScreen();
  session = { id:null, attempts:0, hints:0, shown:false };
  var h =
    '<div class="reghero"><span class="regmark">🐍</span>' +
      '<h1>Привет! Как тебя зовут?</h1>' +
      '<p class="lede">Впиши имя — и я заведу тебе профиль. Прогресс сохранится, ' +
      'и его можно будет открыть с другого устройства.</p></div>' +
    '<div class="card">' +
      '<label class="reglbl">Имя' +
      '<input type="text" id="regname" placeholder="Например, Аня" autocomplete="off" spellcheck="false" maxlength="24"></label>' +
      '<div class="msg" id="regmsg"></div>' +
      '<div class="winrow"><button class="bigbtn" id="regstart">Начать 🚀</button></div>' +
    '</div>';
  if (serverOn()){
    h += '<div class="card"><h3>Уже занимался раньше?</h3>' +
      '<p class="dim">Если у тебя есть код ученика с другого устройства — впиши его, ' +
      'чтобы открыть свой прогресс.</p>' +
      '<label class="reglbl">Код ученика' +
      '<input type="text" id="regcode" placeholder="например, anya-3f7a" autocomplete="off" spellcheck="false" maxlength="32"></label>' +
      '<div class="msg" id="loginmsg"></div>' +
      '<div class="winrow"><button class="bigbtn ghost" id="loginbtn">Войти по коду</button></div></div>';
  } else {
    h += '<p class="dim">Сервер не подключён — прогресс будет храниться только на этом устройстве.</p>';
  }
  app.innerHTML = h;

  var nameInp = document.getElementById("regname");
  function reg(){
    doRegister(nameInp.value, function(err){
      var m = document.getElementById("regmsg");
      m.className = "msg show bad"; m.innerHTML = "<b>" + esc(err) + "</b>";
      nameInp.focus();
    });
  }
  document.getElementById("regstart").onclick = reg;
  nameInp.addEventListener("keydown", function(e){ if (e.key === "Enter") reg(); });

  var lb = document.getElementById("loginbtn");
  if (lb){
    var codeInp = document.getElementById("regcode");
    function login(){
      doLogin(codeInp.value, function(err){
        var m = document.getElementById("loginmsg");
        m.className = "msg show bad"; m.innerHTML = "<b>" + esc(err) + "</b>";
      });
    }
    lb.onclick = login;
    codeInp.addEventListener("keydown", function(e){ if (e.key === "Enter") login(); });
  }
  if (nameInp.focus) nameInp.focus();
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= экран: профиль ученика =================
   Показывает имя, код ученика и ссылку-вход для другого устройства, даёт выйти.
   ============================================================ */
function copyText(text, btn){
  var done = function(){ if (btn){ var t = btn.textContent; btn.textContent = "Скопировано ✓"; setTimeout(function(){ btn.textContent = t; }, 1500); } };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done, function(){});
      return;
    }
  } catch(e){}
  try {
    var ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove(); done();
  } catch(e2){}
}
function screenAccount(){
  enterScreen();
  session = { id:null, attempts:0, hints:0, shown:false };
  var code = myCode(), name = myName();
  var link = "";
  try { link = location.origin + location.pathname + "?kid=" + encodeURIComponent(code); } catch(e){}
  var h = '<div class="lvlhead"><div><div class="idx">твой профиль</div><h1>👤 ' +
    (name ? esc(name) : "Профиль") + '</h1></div></div>';
  if (serverOn() && code){
    h += '<div class="card"><h3>Твой код ученика</h3>' +
      '<p class="dim">По нему можно открыть свой прогресс на другом устройстве. Никому лишнему ' +
      'не показывай: кто знает код, тот видит прогресс.</p>' +
      '<div class="codebox"><code id="mycode">' + esc(code) + '</code>' +
      '<button class="rbtn sec" id="copycode">Скопировать код</button></div>' +
      '<p class="dim" style="margin-top:12px">Ссылка-вход для другого устройства:</p>' +
      '<div class="codebox"><code id="mylink">' + esc(link) + '</code>' +
      '<button class="rbtn sec" id="copylink">Скопировать ссылку</button></div></div>';
  } else {
    h += '<div class="card"><p class="lede">Сервер не подключён — прогресс хранится только ' +
      'на этом устройстве, кода нет.</p></div>';
  }
  h += '<div class="card"><h3>Сменить ученика</h3>' +
    '<p class="dim">Выйти — забыть код на этом устройстве и войти под другим именем или кодом. ' +
    'Прогресс на сервере при этом не удаляется.</p>' +
    '<div class="winrow"><button class="bigbtn ghost" id="logout">Выйти / сменить</button></div></div>' +
    '<div class="pager"><button class="bigbtn ghost" id="tomap">← Ко всем мирам</button></div>';
  app.innerHTML = h;

  var cc = document.getElementById("copycode");
  if (cc) cc.onclick = function(){ copyText(code, cc); };
  var cl = document.getElementById("copylink");
  if (cl) cl.onclick = function(){ copyText(link, cl); };
  document.getElementById("logout").onclick = function(){
    var yes = true;
    try { yes = confirm("Выйти и очистить прогресс на этом устройстве? На сервере он останется, его можно вернуть по коду."); } catch(e){}
    if (yes) doLogout();
  };
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= экран: Сегодня (стрик + задача дня) =================
   Показывает, сколько дней подряд ребёнок занимался, рекорд, полоску за
   неделю и одну «задачу дня» — детерминированно выбранную по дате разминку.
   Вне сотни уроков, звёзд не даёт. Смысл — привычка заходить каждый день.
   ============================================================ */
function weekStripHTML(){
  var today = dayKey();
  var cells = "";
  for (var i = 6; i >= 0; i--){
    var key = shiftDay(today, -i);
    var d = new Date(key + "T12:00:00");
    var on = activeOn(key);
    var sh = !on && shieldedOn(key);
    var isToday = key === today;
    var study = isStudyDay(key);
    var cls = "wkcell" + (on ? " on" : "") + (sh ? " shielded" : "") +
      (isToday ? " today" : "") + (study ? " study" : "");
    cells += '<div class="' + cls + '"><span class="wkd">' + WD_SHORT[d.getDay()] + '</span>' +
      '<span class="wkdot">' + (on ? "🔥" : (sh ? "🛡️" : (study ? "📌" : "·"))) + '</span></div>';
  }
  return '<div class="weekstrip">' + cells + '</div>';
}

/* запас щитов на экране «Сегодня»: сколько на руках и что они делают */
function shieldBoxHTML(){
  var left = shieldsLeft(), toNext = shieldToNext();
  var icons = "";
  for (var i = 0; i < SHIELD_MAX; i++) icons += (i < left ? "🛡️" : "<span class=\"shoff\">🛡️</span>");
  var sub = left > 0
    ? "Пропустишь день — щит закроет его сам, когда вернёшься. Серия не оборвётся." +
      (toNext > 0 ? " Следующий щит — через " + toNext + " " +
        plural(toNext, "день", "дня", "дней") + " занятий." : "")
    : "Щитов пока нет. Ещё " + toNext + " " + plural(toNext, "день", "дня", "дней") +
      " занятий — и появится щит: он закрывает один пропуск.";
  return '<div class="shieldbox' + (left > 0 ? " has" : "") + '">' +
    '<div class="shrow">' + icons + '<span class="shnum">Щиты: <b>' + left + '</b> из ' + SHIELD_MAX + '</span></div>' +
    '<div class="shsub">' + sub + '</div>' +
  '</div>';
}

function screenToday(){
  enterScreen();
  session = { id:null, attempts:0, hints:0, shown:false };
  var streak = streakCurrent();
  var best = streakBest();
  var doneToday = activeOn(dayKey());
  var pick = dailyPick();
  var taskDone = dailyDone();

  var hero = '<div class="streakhero">' +
    '<div class="flame' + (doneToday ? " lit" : "") + '">🔥</div>' +
    '<div class="streaknum"><b>' + streak + '</b> ' + plural(streak, "день", "дня", "дней") + ' подряд</div>' +
    '<div class="streaksub">' +
      (streak === 0
        ? (shieldWouldSave()
            ? "Вчера пропущено — но щит наготове. Позанимайся сегодня, и серия продолжится."
            : "Серия прервалась — начни новую сегодня.")
        : (doneToday ? "Сегодня уже занимался — так держать!"
                     : "Серия жива. Позанимайся сегодня, чтобы она росла.")) +
    '</div>' +
    '<div class="streakbest">Рекорд: ' + best + ' ' + plural(best, "день", "дня", "дней") + '</div>' +
    weekStripHTML() +
    shieldBoxHTML() +
  '</div>';

  var taskCard;
  if (!pick){
    taskCard = '<div class="card"><p class="lede">Задача дня появится, когда подключены разминки.</p></div>';
  } else {
    var isBlocks = pick.type === "blocks";
    var typeLbl = isBlocks ? "собери из блоков" : "угадай вывод";
    taskCard = '<div class="dailycard' + (taskDone ? " done" : "") + '">' +
      '<div class="dctop"><span class="dcemoji">' + pick.emoji + '</span>' +
        '<div class="dcttl"><div class="dckicker">🔥 Задача дня · ' + typeLbl + '</div>' +
        '<b>' + esc(pick.title) + '</b></div>' +
        '<span class="tag">' + esc(pick.tag) + '</span></div>' +
      '<p class="dcintro">' + esc(pick.intro) + '</p>' +
      (taskDone
        ? '<div class="dcstatus done">✓ Выполнена сегодня. Новая задача — завтра.</div>' +
          '<div class="winrow"><button class="bigbtn ghost" id="dopen">Пройти ещё раз</button>' +
          '<button class="bigbtn ghost" id="dwarm">Ещё размяться</button></div>'
        : '<div class="winrow"><button class="bigbtn" id="dopen">Открыть задачу дня</button></div>') +
    '</div>';
  }

  /* «щит спас серию» — показываем один раз, сразу после спасения */
  var saved = takeShieldNote();

  /* напоминание по расписанию — только внутри сайта */
  var banner = "";
  if (hasSchedule()){
    if (studyDue())
      banner = '<div class="daybanner due">🔔 <b>Сегодня учебный день.</b> Начни занятие, чтобы не пропустить.</div>';
    else if (isStudyDay(dayKey()))
      banner = '<div class="daybanner ok">✓ <b>Учебный день выполнен.</b> Сегодня ты уже занимался — молодец!</div>';
    else
      banner = '<div class="daybanner rest">Сегодня по расписанию день отдыха. Заглянуть можно и так — по желанию.</div>';
  }

  /* редактор дней занятий: понедельник … воскресенье */
  var chips = WD_ORDER.map(function(n){
    var sel = scheduleDays().indexOf(n) >= 0;
    return '<button class="wdchip' + (sel ? " sel" : "") + '" data-wd="' + n + '">' + WD_SHORT[n] + '</button>';
  }).join("");
  var schedBox = '<div class="card schedcard"><h3>📅 Дни занятий</h3>' +
    '<p class="dim">Отметь дни недели, когда планируешь заниматься. В такие дни на этом экране и на кнопке 🔥 появится напоминание. ' +
    'Если не выбрано ничего — напоминаний нет.</p>' +
    '<div class="wdrow">' + chips + '</div>' +
    (hasSchedule() ? '<p class="dim">Учебные дни: ' +
      scheduleDays().slice().sort(function(a,b){ return WD_ORDER.indexOf(a) - WD_ORDER.indexOf(b); })
        .map(function(n){ return WD_SHORT[n]; }).join(", ") + '.</p>' : '') +
    '</div>';

  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">заходи каждый день</div><h1>🔥 Сегодня</h1></div>' +
      '<div class="right"><span class="tag">дней подряд: ' + streak + '</span></div></div>' +
    '<p class="lede">Одна маленькая задача в день и серия, которую жалко прерывать. ' +
    'Звёзды тут не начисляются — важна привычка возвращаться.</p>' +
    saved + banner + hero + taskCard + schedBox +
    '<div class="pager"><button class="bigbtn ghost" id="tomap">← Ко всем мирам</button></div>';

  var dopen = document.getElementById("dopen");
  if (dopen && pick) dopen.onclick = function(){ openWarmup(pick.id, { daily:true }); };
  var dwarm = document.getElementById("dwarm");
  if (dwarm) dwarm.onclick = screenWarmups;
  app.querySelectorAll("[data-wd]").forEach(function(b){
    b.onclick = function(){ toggleStudyDay(+b.getAttribute("data-wd")); screenToday(); };
  });
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function screenWarmups(){
  enterScreen();
  session = { id:null, attempts:0, hints:0, shown:false };
  var ws = warmupsList();
  var done = ws.filter(function(w){ return warmupDone(w.id); }).length;
  var h = '<div class="lvlhead"><div><div class="idx">думай, потом проверяй</div><h1>🔮 Разминка</h1></div>' +
    '<div class="right"><span class="tag">разгадано ' + done + ' из ' + ws.length + '</span></div></div>' +
    '<p class="lede">Короткие загадки «угадай вывод». Прочитай программу и запиши, что она напечатает, — до запуска. ' +
    'Это тренирует главное умение программиста: держать ход программы в голове. Звёзды тут не начисляются, ошибаться можно сколько угодно.</p>' +
    '<div class="gamegrid">';
  ws.forEach(function(w){
    h += '<button class="gamecard" data-id="' + w.id + '">' +
      '<span class="gemoji">' + w.emoji + '</span>' +
      '<b>' + esc(w.title) + (warmupDone(w.id) ? ' <span class="edittag done">разгадано ✓</span>' : '') + '</b>' +
      '<span>' + esc(w.intro) + '</span>' +
      '<span class="wtag">' + esc(w.tag) + '</span></button>';
  });
  h += '</div><div class="pager"><button class="bigbtn ghost" id="tomap">← Ко всем мирам</button></div>';
  app.innerHTML = h;
  app.querySelectorAll(".gamecard").forEach(function(b){
    b.onclick = function(){ openWarmup(b.getAttribute("data-id")); };
  });
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function openWarmup(id, opts){
  var ws = warmupsList();
  var w = ws.filter(function(x){ return x.id === id; })[0];
  if (!w) return screenWarmups();
  enterScreen();
  var isDaily = !!(opts && opts.daily);
  session = { id:id, attempts:0, hints:0, shown:false, daily:isDaily };
  /* из задачи дня «назад» и списки ведут на экран «Сегодня», а не в разминку */
  var backFn = isDaily ? screenToday : screenWarmups;
  var pos = ws.indexOf(w);
  var next = isDaily ? null : (pos < ws.length - 1 ? ws[pos+1] : null);
  var prev = isDaily ? null : (pos > 0 ? ws[pos-1] : null);

  var isBlocks = w.type === "blocks";
  var crumbRoot = isDaily
    ? '<span data-go="back">Сегодня</span> › 🔥 Задача дня'
    : '<span data-go="back">Разминка</span>';
  var head = '<div class="crumbs">' + crumbRoot + ' › ' + w.emoji + ' ' + esc(w.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">' + (isBlocks ? "собери из блоков" : "угадай вывод") + '</div><h1>' + w.emoji + ' ' + esc(w.title) + '</h1></div>' +
    '<div class="right"><span class="tag">' + esc(w.tag) + '</span></div></div>' +
    '<p class="lede">' + esc(w.intro) + '</p>' +
    '<div class="goal"><h3>🎯 Твоя задача</h3><p>' + esc(w.brief) + '</p></div>';

  var hints = '<div class="hintbox">' +
    '<button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
    '<span class="tip">подсказки не отнимают ничего — это разминка</span></div>' +
    '<div class="hintout" id="hintout"></div>';

  var pager = '<div class="pager"><button class="bigbtn ghost" data-go="back">' +
    (isDaily ? '← Назад на «Сегодня»' : '← Ко всем разминкам') + '</button><span class="sp"></span>' +
    (prev ? '<button class="bigbtn ghost" data-prev="' + prev.id + '">Назад</button>' : '') +
    (next ? '<button class="bigbtn ghost" data-next="' + next.id + '">Дальше →</button>' : '') + '</div>';

  app.innerHTML = head + '<div id="studio"></div>' + hints + pager;

  var studio = isBlocks
    ? makeBlocksStudio({ code: w.code, check: function(ed, showMsg){ runBlocksCheck(w, ed, showMsg); } })
    : makePredictStudio({ code: w.code, check: function(ed, showMsg){ runPredictCheck(w, ed, showMsg); } });
  document.getElementById("studio").appendChild(studio);
  session.studio = studio;

  wireHint(w.hints);
  app.querySelectorAll("[data-go]").forEach(function(b){
    b.onclick = function(){ backFn(); };
  });
  app.querySelectorAll("[data-next]").forEach(function(b){
    b.onclick = function(){ openWarmup(b.getAttribute("data-next")); };
  });
  app.querySelectorAll("[data-prev]").forEach(function(b){
    b.onclick = function(){ openWarmup(b.getAttribute("data-prev")); };
  });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function runPredictCheck(w, ed, showMsg){
  session.attempts++;
  var eng = Runtime.get("mini");
  var res = eng.run(w.code, {});
  if (res.error){ showMsg("bad", errHTML(res.error)); return; }
  var want = res.output, got = ed.getCode();
  if (normPred(want) === normPred(got)){
    session.studio.reveal(res.output);
    winWarmup(w);
  } else {
    session.studio.reveal(res.output);
    showMsg("bad", "<b>Ещё не совпало</b>" + predictDiff(want, got) +
      "Смотри на настоящий вывод справа, найди, где разошлось, и попробуй снова.");
  }
}

function winWarmup(w){
  S.warmups = S.warmups || {};
  S.warmups[w.id] = 1;
  var isDaily = session && session.daily;
  if (isDaily){ S.daily = S.daily || {}; S.daily[dayKey()] = 1; }
  markActiveToday();                 /* разминка держит дневной стрик живым */
  save();
  var streak = streakCurrent();
  var ws = warmupsList(), pos = ws.indexOf(w);
  var next = (!isDaily && pos >= 0 && pos < ws.length - 1) ? ws[pos+1] : null;
  var firstTry = session.attempts === 1 && session.hints === 0;
  var isBlocks = w.type === "blocks";
  var big = isDaily ? "🔥" : (firstTry ? "🎯" : (isBlocks ? "🧩" : "🔮"));
  var h2 = isDaily
    ? "Задача дня выполнена!"
    : (firstTry ? (isBlocks ? "Собрал с первой попытки!" : "Точно, с первой попытки!")
                : (isBlocks ? "Собрал!" : "Угадал!"));
  var savedNote = takeShieldNote();
  var body = isDaily
    ? '<p>' + esc(w.note || "Ты справился с сегодняшней задачей.") + '</p>' + savedNote +
      '<div class="streakline">🔥 <b>' + streak + '</b> ' + plural(streak, "день", "дня", "дней") + ' подряд</div>'
    : '<p>' + esc(w.note || (isBlocks ? "Ты собрал программу в правильном порядке." : "Ты правильно предсказал, что напечатает программа.")) + '</p>' + savedNote;
  var buttons = isDaily
    ? '<button class="bigbtn" id="wtoday">← На «Сегодня»</button>' +
      '<button class="bigbtn ghost" id="wmore">Ещё размяться</button>'
    : (next ? '<button class="bigbtn" id="wnext">Следующая →</button>'
            : '<button class="bigbtn" id="wlist">Ко всем разминкам</button>') +
      '<button class="bigbtn ghost" id="wstay">Остаться здесь</button>';
  document.getElementById("wincard").innerHTML =
    '<div class="big">' + big + '</div>' +
    '<h2>' + h2 + '</h2>' + body +
    '<div class="winrow">' + buttons + '</div>';
  document.getElementById("win").classList.add("show");
  confetti(isDaily ? 3 : 2);
  var wn = document.getElementById("wnext");
  if (wn) wn.onclick = function(){ closeWin(); openWarmup(next.id); };
  var wl = document.getElementById("wlist");
  if (wl) wl.onclick = function(){ closeWin(); screenWarmups(); };
  var wt = document.getElementById("wtoday");
  if (wt) wt.onclick = function(){ closeWin(); screenToday(); };
  var wm = document.getElementById("wmore");
  if (wm) wm.onclick = function(){ closeWin(); screenWarmups(); };
  var wstay = document.getElementById("wstay");
  if (wstay) wstay.onclick = closeWin;
}

/* ================= раздел: «Ты и ИИ» =================
   Одиннадцать упражнений про то, как командовать ИИ: точно ставить задачу,
   читать чужой код, проверять результат. Отдельный раздел, вне сотни.
   Прогресс в S.ailab (объединяется при слиянии), звёзд и XP не даёт.
   Внутри — гибрид механик: predict открывается студией разминки,
   code/fix — студией уроков, а review добавляет к студии панель вердикта.
   Контент — js/ailab.js (window.AILAB).
   ============================================================ */
function ailabList(){ return (window.AILAB || []); }
function ailabDone(id){ return !!(S.ailab && S.ailab[id]); }

function screenAILab(){
  enterScreen();
  session = { id:null, attempts:0, hints:0, shown:false };
  var xs = ailabList();
  var done = xs.filter(function(x){ return ailabDone(x.id); }).length;
  var h = '<div class="lvlhead"><div><div class="idx">командуй, не подчиняйся</div><h1>🤖 Ты и ИИ</h1></div>' +
    '<div class="right"><span class="tag">пройдено ' + done + ' из ' + xs.length + '</span></div></div>' +
    '<p class="lede">Код всё чаще пишет ИИ — и тем дороже три вещи, которые он не забирает: ' +
    'точно поставить задачу, прочитать чужой код и проверить результат. Здесь ты тренируешь именно их. ' +
    '«Ответ ИИ» — это заранее написанный код, а судья правды — движок: он запускает его и показывает, где тот врёт. ' +
    'Раздел вне сотни уроков, звёзды тут не начисляются.</p>' +
    '<div class="gamegrid">';
  xs.forEach(function(x){
    h += '<button class="gamecard" data-id="' + x.id + '">' +
      '<span class="gemoji">' + x.emoji + '</span>' +
      '<b>' + esc(x.title) + (x.boss ? ' <span class="wtag">финал</span>' : '') +
      (ailabDone(x.id) ? ' <span class="edittag done">пройдено ✓</span>' : '') + '</b>' +
      '<span>' + esc(x.intro) + '</span>' +
      '<span class="wtag">' + esc(x.tag) + '</span></button>';
  });
  h += '</div><div class="pager"><button class="bigbtn ghost" id="tomap">← Ко всем мирам</button></div>';
  app.innerHTML = h;
  app.querySelectorAll(".gamecard").forEach(function(b){
    b.onclick = function(){ openAILesson(b.getAttribute("data-id")); };
  });
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function openAILesson(id){
  var xs = ailabList();
  var x = xs.filter(function(e){ return e.id === id; })[0];
  if (!x) return screenAILab();
  enterScreen();
  session = { id:id, attempts:0, hints:0, shown:false };
  var pos = xs.indexOf(x);
  var next = pos < xs.length - 1 ? xs[pos+1] : null;
  var prev = pos > 0 ? xs[pos-1] : null;

  var isPredict = x.type === "predict";
  var isFix = x.type === "fix";
  var isReview = x.type === "review";
  var kindLabel = isPredict ? "угадай вывод"
                : isFix ? "почини код ИИ"
                : isReview ? "вынеси вердикт" : "напиши код";

  var head = '<div class="crumbs"><span data-go="back">🤖 Ты и ИИ</span> › ' + x.emoji + ' ' + esc(x.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">' + (x.boss ? "финал раздела" : kindLabel) + '</div><h1>' + x.emoji + ' ' + esc(x.title) + '</h1></div>' +
    '<div class="right"><span class="tag">' + esc(x.tag) + '</span></div></div>' +
    '<p class="lede">' + esc(x.intro) + '</p>';

  var goal = '<div class="goal"><h3>' + (isFix ? "🔧 Задача: проверь и почини"
                                       : isReview ? "⚖️ Задача: вынеси вердикт" : "🎯 Твоя задача") + '</h3><p>' + esc(x.brief) + '</p>' +
    (x.list ? '<ul>' + x.list.map(function(s){ return '<li>' + esc(s) + '</li>'; }).join("") + '</ul>' : '') + '</div>';

  var bug = isFix
    ? '<div class="bugcard"><h3>🐞 Что сейчас не так</h3><p>' + esc(x.symptom) + '</p>' +
      '<span class="bugtip">Код ниже нужно проверить и починить, а не переписать заново. Кнопка «↩ Вернуть как было» вернёт исходный вариант от ИИ.</span></div>'
    : isReview
    ? '<div class="claimcard"><h3>🤖 ИИ уверяет</h3><p>«' + esc(x.claim) + '»</p>' +
      '<span class="claimtip">Никто не сказал тебе заранее, правда это или нет — в этом и задание. Код можно запускать и менять как угодно: дописывай свои проверки, подставляй свои данные. Вердикт ниже.</span></div>'
    : "";

  var hints = '<div class="hintbox">' +
    '<button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
    (isPredict || isReview ? '' : '<button class="rbtn sec" id="solbtn">Показать решение</button>') +
    '<span class="tip">это раздел без звёзд — подсказки ничего не отнимают</span></div>' +
    '<div class="hintout" id="hintout"></div>';

  var pager = '<div class="pager"><button class="bigbtn ghost" data-go="back">← Ко всем заданиям</button><span class="sp"></span>' +
    (prev ? '<button class="bigbtn ghost" data-prev="' + prev.id + '">Назад</button>' : '') +
    (next ? '<button class="bigbtn ghost" data-next="' + next.id + '">Дальше →</button>' : '') + '</div>';

  app.innerHTML = head + goal + bug + '<div id="studio"></div>' +
    (isReview ? reviewPanelHTML() : "") + hints + pager;

  var studio;
  if (isPredict){
    studio = makePredictStudio({ code: x.code, check: function(ed, showMsg){ runAIPredict(x, ed, showMsg); } });
  } else if (isReview){
    /* Кнопки «Проверить» тут нет намеренно: проверка — это вердикт ниже, а
       студия нужна как лаборатория. Ребёнок вправе дописывать свои строки и
       ломать код как угодно — «Вернуть как было» вернёт вариант от ИИ. */
    studio = makeStudio({
      engine: "mini", code: x.code,
      label: "код от ИИ — читай, запускай, пробуй свои данные",
      restore: x.code
    });
  } else {
    studio = makeStudio({
      engine: "mini", code: x.starter,
      label: isFix ? "код от ИИ — проверь и почини" : "твой код",
      restore: isFix ? x.starter : null,
      check: function(ed, showMsg){ runAICheck(x, ed, showMsg); }
    });
  }
  document.getElementById("studio").appendChild(studio);
  session.studio = studio;

  if (isReview) wireReview(x);
  wireHint(x.hints);
  var solb = document.getElementById("solbtn");
  if (solb) solb.onclick = function(){
    session.shown = true;
    studio.editor.setCode(x.solution);
    studio.showMsg("warn", "<b>Вот рабочее решение</b>Прочитай его строчку за строчкой и запусти. Звёзд в разделе нет — смотреть решение можно без потерь, но сначала попробуй сам.");
  };
  app.querySelectorAll("[data-go]").forEach(function(b){ b.onclick = function(){ screenAILab(); }; });
  app.querySelectorAll("[data-next]").forEach(function(b){ b.onclick = function(){ openAILesson(b.getAttribute("data-next")); }; });
  app.querySelectorAll("[data-prev]").forEach(function(b){ b.onclick = function(){ openAILesson(b.getAttribute("data-prev")); }; });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* predict: правильный ответ — это вывод программы w.code (как в разминке) */
function runAIPredict(x, ed, showMsg){
  session.attempts++;
  var eng = Runtime.get("mini");
  var res = eng.run(x.code, {});
  if (res.error){ showMsg("bad", errHTML(res.error)); return; }
  session.studio.reveal(res.output);
  if (normPred(res.output) === normPred(ed.getCode())){
    winAI(x);
  } else {
    showMsg("bad", "<b>Ещё не совпало</b>" + predictDiff(res.output, ed.getCode()) +
      "Смотри на настоящий вывод справа, найди, где разошлось, и попробуй снова.");
  }
}

/* code/fix: вывод должен совпасть с выводом эталона; у fix ещё бюджет правок */
function runAICheck(x, ed, showMsg){
  session.attempts++;
  var eng = Runtime.get("mini"), code = ed.getCode();
  if (x.needCode){
    for (var i = 0; i < x.needCode.length; i++){
      if (!codeHas(code, x.needCode[i])){ showMsg("warn", "<b>Почти</b>" + (x.needMsg || "Не хватает нужной конструкции.")); return; }
    }
  }
  var res = eng.run(code, {});
  if (res.error){ ed.setError(res.error.line); showMsg("bad", errHTML(res.error)); return; }
  var exp = eng.run(x.solution, {}).lines, got = res.lines;
  if (!(exp.length === got.length && exp.every(function(v, i){ return v === got[i]; }))){
    showMsg("bad", "<b>Ещё не то</b>" + diffBlock(exp, got));
    return;
  }
  if (x.type === "fix"){
    var budget = x.fixBudget || (editUnits(x.starter, x.solution) + 1);
    if (editUnits(x.starter, code) > budget){
      showMsg("warn", "<b>Работает, но это не починка</b>Вывод правильный — только строк изменено больше, чем нужно. " +
        "Смысл в другом: найти поломку и тронуть только её. Нажми «↩ Вернуть как было» и попробуй ещё раз.");
      return;
    }
  }
  winAI(x);
}

/* ===== review: вердикт вместо починки =====
   Единственный тип в разделе, где ребёнку НЕ говорят заранее, сломан ли код.
   Три ответа, а не два: «врёт сразу» и «работает, но не всегда» — разные
   вещи, и вторая как раз про код от ИИ, который сходится на примере автора
   и разъезжается на любом другом. Угадать с трёх попыток трудно, а после
   верного вердикта «врёт» надо ещё ткнуть в строку — там вариантов ещё
   больше. Что верно на самом деле, знает не текст задания, а движок: см.
   reviewTruth() и вычисление вердикта в tests/lessons.js. */
var VERDICTS = [
  { v:"ok",     label:"Работает верно",           sub:"делает обещанное на любых данных" },
  { v:"partly", label:"Работает, но не всегда",   sub:"на своём примере верно, на других врёт" },
  { v:"wrong",  label:"Врёт сразу",               sub:"расходится с обещанием на своём же примере" }
];

function reviewPanelHTML(){
  return '<div class="verdict" id="verdict"><h3>⚖️ Твой вердикт</h3>' +
    '<p>Прочитал, запустил, попробовал свои данные — теперь решай. Ответ «работает верно» тут такой же настоящий, как и остальные.</p>' +
    '<div class="vbtns">' +
    VERDICTS.map(function(o){
      return '<button class="vbtn" data-v="' + o.v + '"><b>' + o.label + '</b><span>' + o.sub + '</span></button>';
    }).join("") +
    '</div><div class="msg" id="vmsg"></div><div class="vpick" id="vpick"></div></div>';
}

/* Что происходит на самом деле: гоняем код ИИ и правильную версию на одних и
   тех же данных. Своим примером ИИ считается вывод code без probe, чужими —
   с probe. Ошибку тоже считаем ответом: код, который падает, обещания не
   исполняет. */
function reviewRun(src){
  var res = Runtime.get("mini").run(src, {});
  return res.error ? "!" + res.error.kind + ": " + res.error.msg : res.output;
}
function reviewTruth(x){
  var own  = reviewRun(x.code)                  !== reviewRun(x.truth);
  var wide = reviewRun(x.code + "\n" + x.probe) !== reviewRun(x.truth + "\n" + x.probe);
  return own ? "wrong" : (wide ? "partly" : "ok");
}

/* Доказательство для победной карточки: на чём именно код разошёлся с
   обещанием. Для «работает верно» показывать нечего — там и не разошёлся. */
function reviewProof(x, real){
  if (real === "ok") return "";
  var suffix = real === "wrong" ? "" : "\n" + x.probe;
  var got  = reviewRun(x.code  + suffix).split("\n");
  var want = reviewRun(x.truth + suffix).split("\n");
  while (got.length  && got[got.length-1]  === "") got.pop();
  while (want.length && want[want.length-1] === "") want.pop();
  return '<div class="proof"><u>' +
    (real === "wrong" ? "Вот на его же примере" : "Вот на других данных") +
    '</u>' + diffBlock(want, got) + '</div>';
}

function vmsg(cls, html){
  var m = document.getElementById("vmsg");
  if (!m) return;
  m.className = "msg show " + cls;
  m.innerHTML = html;
}

/* Почему ответ не подошёл — по возможности объясняем причину, а не просто
   «неверно»: намёк должен двигать к проверке, а не к перебору кнопок. */
function verdictNudge(said, real){
  if (said === "ok")
    return "<b>Не так быстро</b>Ты решил, что всё в порядке. Возьми свои данные, а не авторские: допиши в код свою строку с вызовом и запусти. Если хоть на одном примере вывод расходится с обещанием — вердикт другой.";
  if (real === "ok")
    return "<b>Тут подозрение напрасно</b>Ты решил, что код где-то врёт. Тогда покажи это себе: найди данные, на которых он расходится с обещанием. Не находится ни одних — значит вердикт другой.";
  if (said === "wrong" && real === "partly")
    return "<b>Почти, но нет</b>«Врёт сразу» значит, что ошибка видна на том самом примере, который показал автор. Запусти код как есть: на его примере ответ верный. Значит врёт он не сразу.";
  return "<b>Почти, но нет</b>«Работает, но не всегда» значит, что на примере автора всё сходится. Запусти код как есть и сравни вывод с обещанием — сходится ли?";
}

function wireReview(x){
  var panel = document.getElementById("verdict");
  if (!panel) return;
  /* Правильный ответ СЧИТАЕМ движком, а не берём из x.verdict. Поле в
     содержании остаётся, но служит страховкой: tests/lessons.js сверяет его
     с этим же вычислением и падает, если они разошлись. Так «правильный
     ответ» невозможно записать неверно — его определяет запуск кода. */
  var real = reviewTruth(x);
  panel.querySelectorAll(".vbtn").forEach(function(b){
    b.onclick = function(){
      session.attempts++;
      var said = b.getAttribute("data-v");
      panel.querySelectorAll(".vbtn").forEach(function(o){ o.classList.toggle("on", o === b); });
      if (said !== real){
        document.getElementById("vpick").innerHTML = "";
        vmsg("bad", verdictNudge(said, real));
        return;
      }
      if (real === "ok"){ winAI(x, reviewProof(x, real)); return; }
      vmsg("ok", "<b>Вердикт верный</b>Осталось показать, где именно поломка: ткни в строку кода от ИИ.");
      showLinePicker(x, real);
    };
  });
}

/* Строки берём из x.code, а не из редактора: ребёнок мог там всё переписать,
   пока проверял, и номера бы разъехались. Пустые строки не кликаются. */
function showLinePicker(x, real){
  var box = document.getElementById("vpick");
  var lines = String(x.code).replace(/\n+$/, "").split("\n");
  box.innerHTML = '<div class="lines">' +
    lines.map(function(t, i){
      var empty = t.trim() === "";
      return '<button class="lrow' + (empty ? " off" : "") + '"' + (empty ? " disabled" : "") +
        ' data-line="' + (i+1) + '"><span class="ln">' + (i+1) + '</span><code>' + (hl(t) || "&nbsp;") + '</code></button>';
    }).join("") + '</div>';
  box.querySelectorAll(".lrow").forEach(function(b){
    b.onclick = function(){
      session.attempts++;
      var n = +b.getAttribute("data-line");
      box.querySelectorAll(".lrow").forEach(function(o){ o.classList.toggle("on", o === b); });
      if (n === x.badLine){ winAI(x, reviewProof(x, real)); return; }
      vmsg("bad", "<b>Строка не та</b>Эта строка делает своё дело правильно. Ищи ту, из-за которой ответ расходится с обещанием: сравни, что в ней написано, с тем, что должно получиться.");
    };
  });
}

function winAI(x, extra){
  S.ailab = S.ailab || {};
  S.ailab[x.id] = 1;
  markActiveToday();                 /* задание раздела держит дневной стрик живым */
  save();
  var xs = ailabList(), pos = xs.indexOf(x);
  var next = (pos >= 0 && pos < xs.length - 1) ? xs[pos+1] : null;
  var firstTry = session.attempts === 1 && session.hints === 0 && !session.shown;
  var big = x.boss ? "🏆" : (firstTry ? "🎯" : "🤖");
  var h2 = x.boss ? "Проект готов!" : (firstTry ? "Верно, с первого раза!" : "Верно!");
  var buttons = (next
      ? '<button class="bigbtn" id="wnext">Следующее →</button>'
      : '<button class="bigbtn" id="wlist">Ко всем заданиям</button>') +
    '<button class="bigbtn ghost" id="wstay">Остаться здесь</button>';
  document.getElementById("wincard").innerHTML =
    '<div class="big">' + big + '</div><h2>' + h2 + '</h2>' +
    '<p>' + esc(x.note || "Ты справился с заданием.") + '</p>' + (extra || "") +
    '<div class="winrow">' + buttons + '</div>';
  document.getElementById("win").classList.add("show");
  confetti(x.boss ? 3 : 2);
  var wn = document.getElementById("wnext");
  if (wn) wn.onclick = function(){ closeWin(); openAILesson(next.id); };
  var wl = document.getElementById("wlist");
  if (wl) wl.onclick = function(){ closeWin(); screenAILab(); };
  document.getElementById("wstay").onclick = closeWin;
}

/* ================= проекты в конце мира =================
   Проект — многошаговое задание, где все шаги строят ОДНУ программу.
   Код переезжает из шага в шаг: стартовый код следующего шага — это то,
   что ребёнок написал на предыдущем (а если ничего не сохранилось —
   эталон предыдущего шага). Поэтому в конце получается цельная вещь,
   а не четыре разрозненные задачки.

   Вне сотни уроков: звёзд и XP не даёт, в счётчик «N из 100» не входит.
   Прогресс — S.projects[id] = { step, code, done }, где step это номер
   ТЕКУЩЕГО шага (он же количество пройденных). Карточка проекта живёт
   на карте мира после последнего урока — так мимо неё не пройти.
   ============================================================ */
function projectsList(){ return (window.PROJECTS || []); }
function projectById(id){
  var xs = projectsList();
  for (var i = 0; i < xs.length; i++) if (xs[i].id === id) return xs[i];
  return null;
}
function projectOfWorld(n){
  var xs = projectsList();
  for (var i = 0; i < xs.length; i++) if (xs[i].world === n) return xs[i];
  return null;
}
function projectState(id){
  S.projects = S.projects || {};
  var st = S.projects[id];
  if (!st || typeof st !== "object"){ st = { step:0, code:null, done:0 }; S.projects[id] = st; }
  if (typeof st.step !== "number") st.step = 0;
  return st;
}
function projectDone(id){ return !!projectState(id).done; }
/* проект открывается, когда все готовые уроки его мира пройдены */
function projectOpen(p){
  if (S.admin && S.admin.unlockAll) return true;
  var w = CURRICULUM.world(p.world);
  if (!w) return false;
  var ready = worldReadyLessons(w);
  return ready.length > 0 && ready.every(function(l){ return solved(l.id); });
}
/* стартовый код шага: своё с прошлого шага, иначе эталон прошлого шага */
function projectStartCode(p, i){
  var st = projectState(p.id);
  if (i === 0) return st.code && st.step > 0 ? st.code : p.steps[0].starter;
  return st.code || p.steps[i-1].solution;
}

function openProject(id, forceStep){
  var p = projectById(id);
  if (!p) return screenWorlds();
  var seq = claimScreen();
  worldContent(p.world).then(function(){
    if (screenStale(seq)) return;          /* ушли на другой экран, пока грузился мир */
    if (!projectOpen(p)) return screenWorld(p.world);
    var st = projectState(p.id);
    var i = (typeof forceStep === "number") ? forceStep : st.step;
    if (i >= p.steps.length) return screenProjectDone(p.id);
    var step = p.steps[i];
    enterScreen();
    session = { id:null, attempts:0, hints:0, shown:false, project:p.id, pstep:i };

    var dots = p.steps.map(function(s, k){
      var cls = k < st.step ? "done" : (k === i ? "now" : "");
      return '<span class="pdot ' + cls + '" title="' + esc(s.title) + '">' + (k + 1) + '</span>';
    }).join("");

    var head = '<div class="crumbs"><span data-go="world">Мир ' + p.world + '</span> › ' +
        p.emoji + ' ' + esc(p.title) + '</div>' +
      '<div class="lvlhead"><div><div class="idx">Проект мира ' + p.world +
        ' · шаг ' + (i + 1) + ' из ' + p.steps.length + '</div>' +
      '<h1>' + p.emoji + ' ' + esc(p.title) + '</h1></div>' +
      '<div class="right"><span class="tag">вне сотни уроков</span></div></div>' +
      '<p class="lede">' + esc(p.intro) + '</p>' +
      '<div class="pstepbar">' + dots + '</div>';

    var goal = '<div class="goal"><h3>🎯 Шаг ' + (i + 1) + ': ' + esc(step.title) + '</h3>' +
      '<p>' + esc(step.brief) + '</p>' +
      (step.list ? '<ul>' + step.list.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>' : '') +
      (i > 0 ? '<span class="bugtip">В редакторе — твой код с прошлого шага. Дописывай в него, а не начинай с нуля.</span>' : '') +
      '</div>';

    var hints = '<div class="hintbox">' +
      '<button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
      '<button class="rbtn sec" id="solbtn">Показать решение шага</button>' +
      '<span class="tip">проект без звёзд — подсказки ничего не отнимают</span></div>' +
      '<div class="hintout" id="hintout"></div>';

    var pager = '<div class="pager"><button class="bigbtn ghost" data-go="world">← К миру ' + p.world + '</button></div>';

    app.innerHTML = head + goal + '<div id="studio"></div>' + hints + pager;

    var studio = makeStudio({
      engine: "mini",
      code: projectStartCode(p, i),
      label: "твоя программа",
      check: function(ed, showMsg){ runProjectCheck(p, i, ed, showMsg); }
    });
    document.getElementById("studio").appendChild(studio);
    session.studio = studio;

    wireHint(step.hints);
    document.getElementById("solbtn").onclick = function(){
      session.shown = true;
      studio.editor.setCode(step.solution);
      studio.showMsg("warn", "<b>Вот программа на конец этого шага</b>Прочитай её и запусти. Звёзд в проекте нет — смотреть можно без потерь, но сначала попробуй сам.");
    };
    app.querySelectorAll('[data-go="world"]').forEach(function(b){
      b.onclick = function(){ screenWorld(p.world); };
    });
    refreshTop();
    window.scrollTo({ top:0, behavior:"smooth" });
  });
}

/* проверка шага: вывод должен совпасть с выводом эталона этого шага */
function runProjectCheck(p, i, ed, showMsg){
  session.attempts++;
  var step = p.steps[i];
  var eng = Runtime.get("mini"), code = ed.getCode();
  if (step.needCode){
    for (var k = 0; k < step.needCode.length; k++){
      if (!codeHas(code, step.needCode[k])){
        showMsg("warn", "<b>Почти</b>" + (step.needMsg || "Не хватает нужной конструкции."));
        return;
      }
    }
  }
  var res = eng.run(code, {});
  if (res.error){ ed.setError(res.error.line); showMsg("bad", errHTML(res.error)); return; }
  var exp = eng.run(step.solution, {}).lines, got = res.lines;
  if (!(exp.length === got.length && exp.every(function(v, n){ return v === got[n]; }))){
    showMsg("bad", "<b>Ещё не то</b>" + diffBlock(exp, got));
    return;
  }
  winProjectStep(p, i, code);
}

function winProjectStep(p, i, code){
  var st = projectState(p.id);
  st.code = code;
  if (i + 1 > st.step) st.step = i + 1;
  var last = st.step >= p.steps.length;
  if (last && !st.done){ st.done = 1; award("builder"); }
  markActiveToday();          /* шаг проекта держит дневной стрик живым */
  save();

  var firstTry = session.attempts === 1 && session.hints === 0 && !session.shown;
  document.getElementById("wincard").innerHTML = last
    ? '<div class="big">🏆</div><h2>Проект собран!</h2>' +
      '<p>' + esc(p.finale) + '</p>' +
      '<div class="winrow"><button class="bigbtn" id="pfin">Посмотреть, что получилось</button></div>'
    : '<div class="big">' + (firstTry ? "🎯" : "🧱") + '</div>' +
      '<h2>Шаг ' + (i + 1) + ' из ' + p.steps.length + ' готов</h2>' +
      '<p>' + esc(p.steps[i + 1].brief) + '</p>' +
      '<div class="winrow"><button class="bigbtn" id="pnext">Следующий шаг →</button>' +
      '<button class="bigbtn ghost" id="wstay">Остаться здесь</button></div>';
  document.getElementById("win").classList.add("show");
  confetti(last ? 3 : 1);
  var pn = document.getElementById("pnext");
  if (pn) pn.onclick = function(){ closeWin(); openProject(p.id, i + 1); };
  var pf = document.getElementById("pfin");
  if (pf) pf.onclick = function(){ closeWin(); screenProjectDone(p.id); };
  var ws = document.getElementById("wstay");
  if (ws) ws.onclick = closeWin;
}

/* финал проекта: вся программа целиком, её можно запустить и забрать себе */
function screenProjectDone(id){
  var p = projectById(id);
  if (!p) return screenWorlds();
  enterScreen();
  session = { id:null, attempts:0, hints:0, shown:false };
  var st = projectState(p.id);
  var code = st.code || p.steps[p.steps.length - 1].solution;

  app.innerHTML =
    '<div class="crumbs"><span data-go="world">Мир ' + p.world + '</span> › ' + p.emoji + ' ' + esc(p.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">проект мира ' + p.world + ' собран</div>' +
    '<h1>' + p.emoji + ' ' + esc(p.title) + '</h1></div>' +
    '<div class="right"><span class="tag">готово ✓</span></div></div>' +
    '<p class="lede">' + esc(p.finale) + '</p>' +
    '<div id="studio"></div>' +
    '<div class="pager"><button class="bigbtn" id="tosand">Забрать в песочницу</button>' +
    '<button class="bigbtn ghost" id="pagain">Пройти заново</button><span class="sp"></span>' +
    '<button class="bigbtn ghost" data-go="world">← К миру ' + p.world + '</button></div>';

  var studio = makeStudio({ engine: "mini", code: code, label: "твоя программа целиком" });
  document.getElementById("studio").appendChild(studio);
  session.studio = studio;

  document.getElementById("tosand").onclick = function(){
    S.sandbox = studio.editor.getCode(); save(); screenSandbox();
  };
  document.getElementById("pagain").onclick = function(){
    var yes = true;
    try { yes = confirm("Начать проект заново? Пройденные шаги обнулятся, но код останется в редакторе."); } catch(e){}
    if (!yes) return;
    var s2 = projectState(p.id);
    s2.step = 0; s2.done = 0;
    save(); openProject(p.id, 0);
  };
  app.querySelectorAll('[data-go="world"]').forEach(function(b){
    b.onclick = function(){ screenWorld(p.world); };
  });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= экран: визуализатор (машина времени) =================
   Прогоняем программу по шагам, на каждом шаге снимаем неизменяемый снимок
   памяти (heapSnapshot в engine-mini): переменные + списки/словари/кортежи/
   множества с идентичностью объектов. Потом отлистываем историю вперёд и
   назад ползунком. Списки и словари рисуются коробками, а b = a — двумя
   стрелками к одной коробке (алиасинг видно глазами).
   Отдельный раздел, вне сотни уроков. Прогресс не хранит.
   ============================================================ */
var VIZ_EXAMPLES = [
  { title: "Список растёт",
    code: 'nums = []\nfor i in range(1, 5):\n    nums.append(i * i)\n\nprint(nums)\n' },
  { title: "Два имени — один список",
    code: 'a = [1, 2, 3]\nb = a\nb.append(4)\n\nprint(a)\nprint(b)\n' },
  { title: "Словарь-счётчик",
    code: 'counts = {}\nfor c in "миссисипи":\n    counts[c] = counts.get(c, 0) + 1\n\nprint(counts)\n' },
  { title: "Обмен значений",
    code: 'x = 5\ny = 9\n\nx, y = y, x\n\nprint(x, y)\n' },
  { title: "Список списков",
    code: 'matrix = [[1, 2], [3, 4]]\nrow = matrix[0]\nrow.append(99)\n\nprint(matrix)\n' }
];
var VIZ_COLORS = ["#7c5cff","#00e0b8","#ffc53d","#ff6b6b","#3ddc84","#4aa3ff","#e06bff","#ff9f45"];
var VIZ_MAX_FRAMES = 800;

/* Тик кнопки «Играть» — один на всю страницу, с ручкой остановки. Держим его
   снаружи vizPlayer, потому что уход с экрана обязан его выключить: плеер
   при переходе просто выбрасывается из документа, а интервал сам не умирает
   и продолжает перерисовывать невидимую разметку. */
var vizPlay = null;
function vizStopPlay(){
  if (!vizPlay) return;
  var p = vizPlay; vizPlay = null;
  clearInterval(p.id);
  if (p.onStop) try { p.onStop(); } catch(e){}
}
function vizPlaying(){ return !!vizPlay; }

function vizColorIdx(id){ var n = parseInt(String(id).replace(/\D/g, ""), 10) || 0; return n % VIZ_COLORS.length; }
function vizColor(id){ return VIZ_COLORS[vizColorIdx(id)]; }
function vizKind(k){ return k === "list" ? "список" : k === "tuple" ? "кортеж" : k === "set" ? "множество" : k === "dict" ? "словарь" : k; }

/* Прогон программы с записью всех кадров. Каждый кадр:
   { line, output, vars, objects, error?, done? }. line — строка, которая
   вот-вот выполнится (её и подсвечиваем), состояние — ПЕРЕД ней. Последний
   кадр (done) — итоговое состояние после конца программы. */
function vizRecord(code){
  var MP = window.MiniPy, st;
  try { st = MP.stepper(code, {}); }
  catch(e){
    if (!e.pyKind) throw e;
    return { frames: [], error: { kind: e.pyKind, msg: e.pyMsg, line: e.pyLine || 0 } };
  }
  var idMap = new Map();
  var skip = st.interp && st.interp.builtinNames;
  var frames = [], truncated = false, error = null, guard = 0;
  while (true){
    var s = st.next();
    if (s.error){
      var last = frames.length ? frames[frames.length - 1] : { vars: [], objects: {} };
      frames.push({ line: s.error.line, output: s.output, vars: last.vars, objects: last.objects, error: s.error });
      error = s.error; break;
    }
    if (s.done){
      var h = MP.heapSnapshot(st.interp.global, idMap, skip);
      frames.push({ line: 0, output: s.output, vars: h.vars, objects: h.objects, done: true });
      break;
    }
    var hs = MP.heapSnapshot(s.env, idMap, skip);
    frames.push({ line: s.line, output: s.output, vars: hs.vars, objects: hs.objects });
    if (++guard >= VIZ_MAX_FRAMES){ truncated = true; break; }
  }
  return { frames: frames, error: error, truncated: truncated };
}

/* значение ячейки: скаляр или стрелка-ссылка на объект */
function vizCellHTML(cell){
  if (cell.t === "ref"){
    var c = vizColor(cell.id);
    return '<span class="vref" data-ref="' + cell.id + '" style="color:' + c + ';border-color:' + c + '">→</span>';
  }
  return '<span class="vval">' + esc(cell.text) + '</span>';
}
function vizObjHTML(obj, names){
  var c = vizColor(obj.id);
  var head = '<div class="vohead" style="color:' + c + '">' + vizKind(obj.kind) +
    (names && names.length ? ' <span class="vonames">' + names.map(esc).join(", ") + '</span>' : '') + '</div>';
  var body;
  if (obj.kind === "dict"){
    body = obj.pairs.length
      ? obj.pairs.map(function(p){
          return '<div class="vopair"><span class="vokey">' + esc(p.key) + '</span>' +
                 '<span class="vosep">:</span>' + vizCellHTML(p.val) + '</div>';
        }).join("")
      : '<span class="voempty">пусто</span>';
    body = '<div class="vodict">' + body + '</div>';
  } else {
    var withIdx = obj.kind === "list" || obj.kind === "tuple";
    body = obj.items.length
      ? obj.items.map(function(it, i){
          return '<div class="vocell">' + (withIdx ? '<span class="voidx">' + i + '</span>' : '') +
                 '<span class="voval">' + vizCellHTML(it) + '</span></div>';
        }).join("")
      : '<span class="voempty">пусто</span>';
    body = '<div class="vocells">' + body + '</div>';
  }
  return '<div class="vizobj" data-id="' + obj.id + '" style="border-color:' + c + '">' + head + body + '</div>';
}
function vizMemoryHTML(frame){
  var namesByObj = {};
  frame.vars.forEach(function(v){
    if (v.cell.t === "ref") (namesByObj[v.cell.id] = namesByObj[v.cell.id] || []).push(v.name);
  });
  var varsHTML = frame.vars.length
    ? frame.vars.map(function(v){
        return '<div class="vizvar"><b>' + esc(v.name) + '</b><span class="veq">=</span>' + vizCellHTML(v.cell) + '</div>';
      }).join("")
    : '<div class="vizempty">переменных пока нет</div>';
  var ids = Object.keys(frame.objects);
  var objsHTML = ids.length
    ? ids.map(function(id){ return vizObjHTML(frame.objects[id], namesByObj[id]); }).join("")
    : '<div class="vizempty">списков и словарей пока нет</div>';
  return '<div class="vizvars">' + varsHTML + '</div>' +
         '<div class="vizheap">' + objsHTML + '</div>' +
         '<svg class="vizarrows" preserveAspectRatio="none"></svg>';
}
/* Стрелки от каждой ссылки к её объекту. Рисуем поверх, по реальным
   координатам элементов. Если геометрии нет (например, скрытый блок) —
   молча пропускаем: цвет ссылки и коробки всё равно совпадает. */
function vizDrawArrows(mem){
  try {
    var svg = mem.querySelector(".vizarrows"); if (!svg) return;
    var base = mem.getBoundingClientRect();
    if (!base.width || !base.height) return;
    svg.setAttribute("width", base.width);
    svg.setAttribute("height", base.height);
    svg.setAttribute("viewBox", "0 0 " + base.width + " " + base.height);
    var defs = VIZ_COLORS.map(function(col, i){
      return '<marker id="vzar' + i + '" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">' +
             '<path d="M0,0 L6,3 L0,6 Z" fill="' + col + '"/></marker>';
    }).join("");
    var parts = "";
    mem.querySelectorAll("[data-ref]").forEach(function(src){
      var id = src.getAttribute("data-ref");
      var tgt = mem.querySelector('.vizobj[data-id="' + id + '"]'); if (!tgt) return;
      var s = src.getBoundingClientRect(), t = tgt.getBoundingClientRect();
      var x1 = s.right - base.left, y1 = s.top + s.height / 2 - base.top;
      var x2 = t.left - base.left, y2 = t.top + Math.min(16, t.height / 2) - base.top;
      if (x2 < x1){ x2 = t.right - base.left; }         // объект левее ссылки — целимся в правый край
      var mx = (x1 + x2) / 2, ci = vizColorIdx(id);
      parts += '<path d="M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 +
               '" fill="none" stroke="' + VIZ_COLORS[ci] + '" stroke-width="2" opacity="0.85" marker-end="url(#vzar' + ci + ')"/>';
    });
    svg.innerHTML = "<defs>" + defs + "</defs>" + parts;
  } catch(e){}
}

function screenViz(){
  enterScreen();
  session = { id:null, attempts:0, hints:0, shown:false };
  var h = '<div class="lvlhead"><div><div class="idx">загляни внутрь программы</div><h1>🔍 Визуализатор</h1></div></div>' +
    '<p class="lede">Запусти программу по шагам и смотри, что происходит в памяти: переменные, списки и словари рисуются коробками, ' +
    'а стрелки показывают, кто на что ссылается. Ползунком можно отматывать вперёд и назад — как в машине времени. ' +
    'Это лучший способ понять, почему <code>b = a</code> меняет оба списка сразу.</p>' +
    '<div class="vizex"><span>Примеры:</span> ' +
      VIZ_EXAMPLES.map(function(e, i){ return '<button class="minibtn" data-ex="' + i + '">' + esc(e.title) + '</button>'; }).join("") +
    '</div><div id="vizstudio"></div>' +
    '<div class="pager"><button class="bigbtn ghost" id="tomap">← Ко всем мирам</button></div>';
  app.innerHTML = h;

  var ed = makeEditor(VIZ_EXAMPLES[0].code, "программа для разбора");
  var box = document.createElement("div"); box.className = "vizbox";
  box.appendChild(ed);
  var bar = document.createElement("div"); bar.className = "runbar";
  bar.innerHTML = '<button class="rbtn" data-role="viz">▶ Показать по шагам</button>' +
    '<span class="sp"></span><span class="tip"><span class="kbd">Ctrl</span>+<span class="kbd">Enter</span></span>';
  box.appendChild(bar);
  var player = document.createElement("div"); player.className = "vizplayer"; player.style.display = "none";
  box.appendChild(player);
  document.getElementById("vizstudio").appendChild(box);
  session.studio = box;

  function go(){ vizStart(player, ed); }
  bar.querySelector('[data-role="viz"]').onclick = go;
  ed.querySelector("textarea").addEventListener("keydown", function(e){
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter"){ e.preventDefault(); go(); }
  });
  app.querySelectorAll("[data-ex]").forEach(function(b){
    b.onclick = function(){ ed.setCode(VIZ_EXAMPLES[+b.getAttribute("data-ex")].code); vizStart(player, ed); };
  });
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function vizStart(player, ed){
  vizStopPlay();                       /* прошлый прогон больше не тикает */
  var rec = vizRecord(ed.getCode());
  player.style.display = "";
  if (rec.error && !rec.frames.length){
    ed.setError(rec.error.line || 0);
    player.innerHTML = '<div class="msg show bad"><b>' + (KIND_RU[rec.error.kind] || rec.error.kind) +
      (rec.error.line ? " — строка " + rec.error.line : "") + '</b>' + esc(rec.error.msg) +
      '<br>Исправь программу слева и запусти снова.</div>';
    return;
  }
  vizPlayer(player, ed, rec);
}

function vizPlayer(player, ed, rec){
  var frames = rec.frames, i = 0;
  player.innerHTML =
    '<div class="vizctl">' +
      '<button class="rbtn sec" data-v="first" title="в начало">⏮</button>' +
      '<button class="rbtn sec" data-v="prev" title="шаг назад">◀ Назад</button>' +
      '<button class="rbtn" data-v="play" title="проиграть">▶ Играть</button>' +
      '<button class="rbtn sec" data-v="next" title="шаг вперёд">Вперёд ▶</button>' +
      '<input class="vizslider" type="range" min="0" max="' + (frames.length - 1) + '" value="0" aria-label="шаг">' +
      '<span class="vizpos"></span>' +
    '</div>' +
    (rec.truncated ? '<div class="viznote">Программа длинная — показаны первые ' + frames.length + ' шагов.</div>' : '') +
    '<div class="vizstage"><div class="vizcode"></div><div class="vizmem"></div></div>' +
    '<div class="vizerr" style="display:none"></div>' +
    '<div class="pane pout"><div class="ph">вывод к этому шагу</div><div class="console"></div></div>';

  var codeEl = player.querySelector(".vizcode");
  var memEl = player.querySelector(".vizmem");
  var conEl = player.querySelector(".console");
  var errEl = player.querySelector(".vizerr");
  var slider = player.querySelector(".vizslider");
  var posEl = player.querySelector(".vizpos");
  var playBtn = player.querySelector('[data-v="play"]');
  var codeLines = ed.getCode().replace(/\r/g, "").split("\n");

  function renderCode(line){
    codeEl.innerHTML = codeLines.map(function(ln, idx){
      var n = idx + 1;
      return '<div class="vcl' + (n === line ? " on" : "") + '"><span class="vcn">' + n + '</span>' +
        '<span class="vct">' + (ln ? hl(ln) : "&nbsp;") + '</span></div>';
    }).join("");
  }
  function render(){
    var f = frames[i];
    renderCode(f.line);
    memEl.innerHTML = vizMemoryHTML(f);
    vizDrawArrows(memEl);
    conEl.innerHTML = f.output ? esc(f.output) : '<span class="empty">пока ничего не напечатано</span>';
    posEl.textContent = "шаг " + (i + 1) + " из " + frames.length +
      (f.error ? " · ошибка" : f.done ? " · конец" : "");
    slider.value = i;
    if (f.error){
      errEl.style.display = "";
      errEl.innerHTML = '<b>' + (KIND_RU[f.error.kind] || f.error.kind) +
        (f.error.line ? " — строка " + f.error.line : "") + '</b>' + esc(f.error.msg);
    } else errEl.style.display = "none";
  }
  function goto(k){ i = Math.max(0, Math.min(frames.length - 1, k)); render(); }
  function stop(){ vizStopPlay(); }
  function play(){
    if (vizPlay){ stop(); return; }
    if (i >= frames.length - 1) i = 0;
    playBtn.textContent = "⏸ Пауза"; playBtn.classList.add("on");
    var id = setInterval(function(){
      /* плеер убрали с экрана — гасим сами, даже если про нас забыли */
      if (!document.body.contains(memEl)){ vizStopPlay(); return; }
      if (i >= frames.length - 1){ stop(); return; }
      goto(i + 1);
    }, 800);
    vizPlay = { id: id, onStop: function(){
      playBtn.textContent = "▶ Играть"; playBtn.classList.remove("on"); } };
  }
  player.querySelector('[data-v="first"]').onclick = function(){ stop(); goto(0); };
  player.querySelector('[data-v="prev"]').onclick = function(){ stop(); goto(i - 1); };
  player.querySelector('[data-v="next"]').onclick = function(){ stop(); goto(i + 1); };
  playBtn.onclick = play;
  slider.oninput = function(){ stop(); goto(+slider.value); };

  /* стрелки перерисовываются общим обработчиком resize внизу файла:
     свой слушатель на каждый запуск накапливался бы по одному за нажатие */
  render();
  if (player.scrollIntoView) player.scrollIntoView({ behavior:"smooth", block:"nearest" });
}

/* ================= экран: панель наставника =================
   Закрыт кодом (см. ADMIN_CODE наверху файла). Открывается адресом
   с #admin на конце. Показывает прогресс, позволяет открывать и
   зачитывать уроки, обмениваться данными с сервером и смотреть
   прогресс другого ученика по его коду.
   ============================================================ */
/* Вход на новый экран: гасим всё, что тикает в фоне. Раньше эти две команды
   были выписаны в пятнадцати местах, и когда у визуализатора появился свой
   таймер, его туда не дописали — «Играть» продолжал перерисовывать плеер,
   уже выброшенный из документа. */
function enterScreen(){
  stopTimer();
  vizStopPlay();
  clearAdminHash();
  return claimScreen();
}

/* Урок и мир дорисовываются ПОСЛЕ загрузки файла мира, то есть асинхронно.
   Если за эти десятки миллисекунд ребёнок успел уйти на другой экран,
   запоздавшая отрисовка затирала уже показанный экран, а у урока вдобавок
   запускался счётчик времени — по уроку, который никто не открывал. Каждый
   заход на экран берёт номер, а отрисовка сверяет: номер сменился — не рисуем. */
var screenSeq = 0;
function claimScreen(){ return ++screenSeq; }
function screenStale(n){ return n !== screenSeq; }
function clearAdminHash(){
  try {
    if (!history.replaceState) return;
    var hash = (location.hash || "").toLowerCase() === "#admin" ? "" : location.hash;
    /* убираем admin из ?query, остальные параметры (например ?kid=) сохраняем */
    var search = (location.search || "").replace(/([?&])admin(=[^&]*)?(&|$)/i, function(m, p1, v, tail){
      return tail === "&" ? p1 : (p1 === "?" ? "" : "");
    });
    if (search === "?") search = "";
    if (hash !== location.hash || search !== location.search)
      history.replaceState(null, "", location.pathname + search + hash);
  } catch(e){}
}
function adminUnlocked(){
  try { return sessionStorage.getItem("kodokvest_admin") === "1"; } catch(e){ return !!window.__adminOk; }
}
function adminUnlock(){
  window.__adminOk = true;
  try { sessionStorage.setItem("kodokvest_admin", "1"); } catch(e){}
}
function adminLock(){
  window.__adminOk = false;
  try { sessionStorage.removeItem("kodokvest_admin"); } catch(e){}
}
/* Панель наставника открывается любым из способов:
   .../kodokvest/#admin, .../kodokvest/?admin и просто .../kodokvest/admin
   (последнее ловит 404.html и превращает в ?admin). */
function wantsAdmin(){
  var h = (location.hash || "").toLowerCase();
  var q = (location.search || "").toLowerCase();
  return h === "#admin" || /(^|[?&])admin([=&]|$)/.test(q);
}
var HASH_SCREENS = {
  "#games":   function(){ screenGames(); },
  "#warmup":  function(){ screenWarmups(); },
  "#today":   function(){ screenToday(); },
  "#account": function(){ screenAccount(); },
  "#viz":     function(){ screenViz(); },
  "#ai":      function(){ screenAILab(); }
};
function routeHash(){
  if (wantsAdmin()){ screenAdmin(); return true; }
  var h = (location.hash || "").toLowerCase();
  if (HASH_SCREENS[h]){ HASH_SCREENS[h](); return true; }
  var ph = h.replace(/^#/, "");
  if (ph && projectById(ph)){ openProject(ph); return true; }
  return false;
}
function fmtMins(ms){
  var m = Math.round((ms || 0) / 60000);
  if (m < 1) return "—";
  if (m < 60) return m + " мин";
  return Math.floor(m / 60) + " ч " + (m % 60) + " мин";
}
function fmtWhen(ts){
  if (!ts) return "—";
  var d = new Date(ts), p = function(x){ return (x < 10 ? "0" : "") + x; };
  return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() +
         " " + p(d.getHours()) + ":" + p(d.getMinutes());
}
function progressJSON(){ return JSON.stringify(S, null, 2); }
function statBox(k, v){
  return '<div class="admstat"><span>' + k + '</span><b>' + v + '</b></div>';
}
function rankOf(xp){
  var r = RANKS[0][1];
  for (var i = 0; i < RANKS.length; i++) if (xp >= RANKS[i][0]) r = RANKS[i][1];
  return r;
}
function adminKeySaved(){
  try { return sessionStorage.getItem("kodokvest_srvkey") || ""; } catch(e){ return window.__srvKey || ""; }
}
function adminKeyRemember(v){
  window.__srvKey = v;
  try { sessionStorage.setItem("kodokvest_srvkey", v); } catch(e){}
}

/* Когда смотрим чужой прогресс, viewState держит его копию.
   Локальные данные при этом не трогаются вообще. */
var viewState = null;

function adminGate(){
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">служебный экран</div><h1>🔐 Панель наставника</h1></div></div>' +
    '<p class="lede">Здесь видно, как идут занятия, и можно открывать уроки. Введи код доступа.</p>' +
    '<div class="card"><div class="admgate">' +
      '<input type="password" id="admcode" placeholder="код доступа" autocomplete="off" spellcheck="false">' +
      '<button class="rbtn check" id="admgo">Войти</button>' +
    '</div><div class="msg" id="admgatemsg"></div></div>' +
    '<div class="pager"><button class="bigbtn ghost" id="admback">← Ко всем мирам</button></div>';
  var inp = document.getElementById("admcode");
  var msg = document.getElementById("admgatemsg");
  function tryIn(){
    if (inp.value === ADMIN_CODE){ adminUnlock(); screenAdmin(); return; }
    msg.className = "msg show bad";
    msg.innerHTML = "<b>Код не подошёл</b>Проверь раскладку клавиатуры и большие буквы.";
    inp.value = ""; inp.focus();
  }
  document.getElementById("admgo").onclick = tryIn;
  inp.addEventListener("keydown", function(e){ if (e.key === "Enter") tryIn(); });
  document.getElementById("admback").onclick = screenWorlds;
  inp.focus();
  refreshTop();
}

/* ---------- сводка по любому набору данных ---------- */
function statsGridHTML(st){
  var readyTotal = 0;
  CURRICULUM.forEach(function(w){ readyTotal += worldReadyLessons(w).length; });
  /* solvedCount, а не solved: имя solved занято функцией «урок пройден» —
     локальная переменная её затеняла на всю функцию */
  var stars = 0, solvedCount = 0;
  var sm = st.stars || {};
  Object.keys(sm).forEach(function(k){ stars += sm[k] || 0; solvedCount++; });
  var timeMs = 0, attempts = 0, hints = 0, last = 0;
  var lg = st.log || {};
  Object.keys(lg).forEach(function(k){
    var g = lg[k] || {};
    timeMs += g.timeMs || 0;
    attempts += g.attempts || 0;
    hints += g.hints || 0;
    if ((g.last || 0) > last) last = g.last;
  });
  return '<div class="admstats">' +
    statBox("Пройдено уроков", solvedCount + " из " + CURRICULUM.total) +
    statBox("Уроков готово", String(readyTotal)) +
    statBox("Звёзды", stars + " из " + (readyTotal * 3)) +
    statBox("Опыт", (st.xp || 0) + " XP") +
    statBox("Ранг", rankOf(st.xp || 0)) +
    statBox("Попыток всего", String(attempts)) +
    statBox("Подсказок взято", String(hints)) +
    statBox("Время за тренажёром", fmtMins(timeMs)) +
    statBox("Последнее занятие", fmtWhen(last)) +
    statBox("Дней подряд", streakCurrentIn(coveredDays(st.days, st.shields)) +
      " (рекорд " + streakBestIn(coveredDays(st.days, st.shields)) + ")") +
    statBox("Щиты", shieldsLeftIn(st.days, st.shields) + " из " + SHIELD_MAX +
      " (потрачено " + shieldsSpentIn(st.shields) + ")") +
    statBox("Бейджи", (st.badges || []).length + " из " + BADGES.length) +
    '</div>';
}

/* ---------- таблица уроков по любому набору данных ---------- */
function lessonTableHTML(st, withActions){
  var h = "";
  var sm = st.stars || {}, lg = st.log || {};
  CURRICULUM.forEach(function(w){
    var c = CONTENT["world" + w.n] || {};
    h += '<div class="sect"><h2>' + w.icon + ' Мир ' + w.n + ' · ' + w.title + '</h2>' +
      '<div class="line"></div><span class="cnt">' + worldReadyLessons(w).length + ' с контентом</span></div>';
    h += '<div class="admtable"><div class="admwide"><div class="admhead">' +
      '<span>№</span><span>урок</span><span>звёзды</span><span>попыток</span><span>подсказок</span>' +
      '<span>решение</span><span>время</span><span>когда</span><span></span></div>';
    w.lessons.forEach(function(l){
      var has = !!c[l.id], g = lg[l.id] || {};
      var stn = sm[l.id] === undefined ? -1 : sm[l.id], stars = "";
      for (var k = 0; k < 3; k++) stars += (k < stn) ? "<b>★</b>" : "★";
      h += '<div class="admrowl' + (has ? "" : " soon") + '">' +
        '<span class="n">' + l.num + '</span>' +
        '<span class="t">' + l.title + (l.boss ? ' <em>босс</em>' : '') + (has ? '' : ' <em>скоро</em>') + '</span>' +
        '<span class="stars">' + (stn >= 0 ? stars : "—") + '</span>' +
        '<span>' + (g.attempts || "—") + '</span>' +
        '<span>' + (g.hints || "—") + '</span>' +
        '<span>' + (g.shown ? "смотрел" : "—") + '</span>' +
        '<span>' + fmtMins(g.timeMs) + '</span>' +
        '<span>' + fmtWhen(g.solvedAt || g.last) + '</span>' +
        '<span class="acts">' + (has && withActions
          ? '<button class="minibtn" data-act="go" data-id="' + l.id + '">открыть</button>' +
            '<button class="minibtn" data-act="pass" data-id="' + l.id + '">зачесть</button>' +
            '<button class="minibtn" data-act="clear" data-id="' + l.id + '">сбросить</button>'
          : '') + '</span></div>';
    });
    h += '</div></div>';
  });
  return h;
}

/* ---------- карточка сервера ---------- */
function serverCardHTML(){
  if (typeof Cloud === "undefined" || !Cloud.hasUrl()){
    return '<div class="card"><h3>Сервер</h3>' +
      '<p class="dim">Сервер не подключён: прогресс хранится только в этом браузере, ' +
      'и посмотреть его с другого устройства нельзя. Чтобы подключить, нужно вписать адрес функции ' +
      'в файл <code>js/cloud-config.js</code> — по шагам это описано в <code>cloud/README.md</code>.</p></div>';
  }
  var code = Cloud.myCode();
  var state = cloudState.busy ? "обмен…" : (cloudState.lastError ? "была ошибка" : "в порядке");
  return '<div class="card"><h3>Сервер</h3>' +
    '<div class="admstats">' +
      statBox("Код этого устройства", code ? esc(code) : "не задан") +
      statBox("Последний обмен", cloudState.lastSync ? fmtWhen(cloudState.lastSync) : "ещё не было") +
      statBox("Состояние", code ? state : "ждёт код") +
    '</div>' +
    (code ? '' : '<div class="msg show warn"><b>Код ученика не задан</b>Пока его нет, прогресс ' +
      'не уходит на сервер. Придумайте код — латинские буквы, цифры и дефис, от 3 до 32 знаков ' +
      '(например <code>misha-7f3a</code>) — и впишите ниже. У каждого ребёнка код свой. ' +
      'Не делайте его угадываемым: кто знает код, тот видит прогресс.</div>') +
    '<div class="admrow">' +
      '<label class="admlbl">код ученика <input type="text" id="devcode" value="' + esc(code) +
        '" placeholder="misha-7f3a" autocomplete="off" spellcheck="false"></label>' +
      '<button class="rbtn ' + (code ? 'sec' : 'check') + '" data-act="setcode">Записать код</button>' +
    '</div>' +
    '<p class="dim">Код относится только к этому браузеру, в файлах сайта он не хранится. ' +
    'Тот же код можно задать ссылкой: добавьте к адресу <code>?kid=ваш-код</code> и откройте её один раз ' +
    'на устройстве ребёнка.</p>' +
    (cloudState.lastError
      ? '<div class="msg show bad"><b>Последняя ошибка</b>' + esc(cloudState.lastError) + '</div>' : '') +
    '<div class="admrow">' +
      '<button class="rbtn sec" data-act="push">↑ Отправить сейчас</button>' +
      '<button class="rbtn sec" data-act="pull">↓ Забрать с сервера</button>' +
      '<button class="rbtn sec" data-act="ping">Проверить настройку</button>' +
    '</div>' +
    '<p class="dim">При обмене прогресс не перезаписывается, а сливается: по каждому уроку ' +
    'остаётся лучший результат из двух копий. Поэтому «Забрать» ничего не портит.</p>' +
    '<h3 style="margin-top:20px">Прогресс другого ученика</h3>' +
    '<div class="admrow">' +
      '<label class="admlbl">код <input type="text" id="othercode" placeholder="misha-7f3a" ' +
        'autocomplete="off" spellcheck="false"></label>' +
      '<button class="rbtn sec" data-act="viewother">Посмотреть</button>' +
    '</div>' +
    '<div class="admrow">' +
      '<label class="admlbl">ключ наставника <input type="password" id="adminkey" ' +
        'value="' + esc(adminKeySaved()) + '" autocomplete="off"></label>' +
      '<button class="rbtn sec" data-act="listall">Список всех учеников</button>' +
    '</div>' +
    '<p class="dim">Чужой прогресс только показывается — на этом устройстве ничего не меняется.</p>' +
    '<div id="srvout"></div></div>';
}

function screenAdmin(){
  /* без clearAdminHash: этот экран как раз открывается по #admin */
  stopTimer(); vizStopPlay();
  if (!adminUnlocked()) return adminGate();

  var h = "";

  if (viewState){
    /* ---------- режим просмотра чужого прогресса ---------- */
    h += '<div class="lvlhead"><div><div class="idx">только чтение</div>' +
      '<h1>👀 Ученик: ' + esc(viewState.code) + '</h1></div>' +
      '<div class="right"><span class="tag">данные с сервера</span></div></div>' +
      '<p class="lede">Это копия с сервера на момент ' + fmtWhen(viewState.serverAt) +
      '. Изменить здесь ничего нельзя, и на ваш собственный прогресс это не влияет.</p>' +
      '<div class="admrow"><button class="rbtn check" data-act="myown">← Вернуться к своему прогрессу</button></div>';
    h += statsGridHTML(viewState.data);
    h += lessonTableHTML(viewState.data, false);
    h += '<div class="pager"><button class="bigbtn ghost" data-act="myown">← Свой прогресс</button>' +
      '<span class="sp"></span><button class="bigbtn ghost" data-act="tomap">Ко всем мирам</button></div>';
  } else {
    /* ---------- обычный режим ---------- */
    h += '<div class="lvlhead"><div><div class="idx">служебный экран</div>' +
      '<h1>🔐 Панель наставника</h1></div><div class="right"><span class="tag">код принят</span></div></div>' +
      '<p class="lede">' + (cloudEnabled()
        ? 'Прогресс синхронизируется с сервером — его видно с любого устройства.'
        : 'Прогресс лежит в памяти <b>этого</b> браузера. Чтобы видеть его с другого устройства, ' +
          'подключите сервер или выгрузите файл в самом низу страницы.') + '</p>';

    h += statsGridHTML(S);
    h += serverCardHTML();

    h += '<div class="card"><h3>Быстрые действия</h3><div class="admrow">' +
      '<button class="rbtn ' + (S.admin.unlockAll ? "check" : "sec") + '" data-act="unlockall">' +
        (S.admin.unlockAll ? "✓ Все уроки открыты" : "Открыть все уроки") + '</button>' +
      '<button class="rbtn sec" data-act="passready">Зачесть все готовые на 3★</button>' +
      '<button class="rbtn sec" data-act="resetall">Сбросить весь прогресс</button>' +
      '</div><p class="dim">«Открыть все уроки» только снимает замки — звёзды не ставит. ' +
      'Ребёнок сможет зайти в любой урок и решить его сам, порядок перестанет быть обязательным. ' +
      'Эта настройка относится только к текущему устройству и на сервер не уходит.</p></div>';

    h += '<div class="card"><h3>Опыт и бейджи</h3><div class="admrow">' +
      '<label class="admlbl">XP <input type="number" id="xpin" value="' + S.xp + '" min="0" step="25"></label>' +
      '<button class="rbtn sec" data-act="setxp">Записать</button></div>' +
      '<div class="admbadges">' +
      BADGES.map(function(b){
        var got = S.badges.indexOf(b.id) >= 0;
        return '<button class="admbadge' + (got ? " got" : "") + '" data-act="badge" data-id="' + b.id + '">' +
          '<span class="em">' + b.em + '</span><span>' + b.name + '</span></button>';
      }).join("") +
      '</div><p class="dim">Нажатие на бейдж выдаёт его или отбирает.</p></div>';

    h += lessonTableHTML(S, true);

    h += '<div class="card"><h3>Перенос прогресса файлом</h3>' +
      '<div class="admrow">' +
        '<button class="rbtn sec" data-act="download">↓ Скачать файл прогресса</button>' +
        '<button class="rbtn sec" data-act="copy">Скопировать текст</button>' +
      '</div>' +
      '<p class="dim">Способ без сервера: здесь скачал файл — на другом устройстве открыл эту же ' +
      'панель, вставил содержимое в поле ниже и нажал «Загрузить». В отличие от обмена с сервером, ' +
      'загрузка файла <b>заменяет</b> прогресс целиком, а не сливает его.</p>' +
      '<textarea class="admjson" id="admjson" spellcheck="false">' + esc(progressJSON()) + '</textarea>' +
      '<div class="admrow"><button class="rbtn sec" data-act="import">Загрузить из этого поля</button></div>' +
      '<div class="msg" id="admmsg"></div></div>';

    h += '<div class="pager"><button class="bigbtn ghost" data-act="tomap">← Ко всем мирам</button>' +
      '<span class="sp"></span><button class="bigbtn ghost" data-act="lock">Выйти из панели</button></div>';
  }

  /* контейнер создаётся заново при каждой отрисовке — обработчик не копится */
  app.innerHTML = '<div id="adm"></div>';
  var box = document.getElementById("adm");
  box.innerHTML = h;

  function say(cls, html){
    var m = document.getElementById("admmsg");
    if (m){ m.className = "msg show " + cls; m.innerHTML = html; }
  }
  function srv(cls, html){
    var m = document.getElementById("srvout");
    if (m) m.innerHTML = '<div class="msg show ' + cls + '">' + html + '</div>';
  }

  box.addEventListener("click", function(e){
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");

    if (act === "tomap"){ viewState = null; screenWorlds(); }
    else if (act === "myown"){ viewState = null; screenAdmin(); }
    else if (act === "lock"){ viewState = null; adminLock(); screenWorlds(); }
    else if (act === "unlockall"){ S.admin.unlockAll = !S.admin.unlockAll; saveLocal(); screenAdmin(); }
    else if (act === "passready"){
      CURRICULUM.forEach(function(w){
        worldReadyLessons(w).forEach(function(l){ setStars(l.id, 3); });
      });
      refreshTop(); screenAdmin();
    }
    else if (act === "resetall"){
      var yes = true;
      try { yes = confirm("Стереть весь прогресс: звёзды, XP, бейджи, статистику, серию дней, разминки, «Ты и ИИ» и проекты? Имя, расписание и свои версии игр останутся. Отменить будет нельзя."); } catch(e2){}
      if (!yes) return;
      clearResults(S);
      save(); refreshTop(); screenAdmin();
    }
    else if (act === "go"){ openLesson(id); }
    else if (act === "pass"){ setStars(id, 3); refreshTop(); screenAdmin(); }
    else if (act === "clear"){ setStars(id, 0); delete S.log[id]; save(); refreshTop(); screenAdmin(); }
    else if (act === "badge"){
      var i = S.badges.indexOf(id);
      if (i >= 0) S.badges.splice(i, 1); else S.badges.push(id);
      save(); screenAdmin();
    }
    else if (act === "setxp"){
      var v = parseInt(document.getElementById("xpin").value, 10);
      if (isNaN(v) || v < 0){ say("bad", "<b>Не подходит</b>XP должен быть целым числом не меньше нуля."); return; }
      S.xp = v; save(); refreshTop(); screenAdmin();
    }

    /* ---------- сервер ---------- */
    else if (act === "setcode"){
      var raw = (document.getElementById("devcode").value || "").trim();
      if (!Cloud.setCode(raw)){
        srv("bad", "<b>Код не подходит</b>Нужно от 3 до 32 знаков: латинские буквы, цифры, " +
          "дефис и подчёркивание. Первый знак — буква или цифра. Заглавные буквы можно, они сами " +
          "станут маленькими. Русские буквы, пробелы и точки нельзя.");
        return;
      }
      screenAdmin();
      srv("ok", "<b>Код записан</b>Теперь можно отправить прогресс на сервер.");
    }
    else if (act === "push"){
      srv("warn", "<b>Отправляю…</b>");
      cloudPush().then(function(){ screenAdmin(); srv("ok", "<b>Отправлено</b>Прогресс лежит на сервере."); },
                       function(err){ srv("bad", "<b>Не отправилось</b>" + esc(err.message || err)); });
    }
    else if (act === "pull"){
      srv("warn", "<b>Забираю…</b>");
      cloudPull().then(function(changed){
        refreshTop(); screenAdmin();
        srv(changed ? "ok" : "warn", changed
          ? "<b>Забрано и слито</b>Прогресс с сервера добавлен к тому, что было здесь."
          : "<b>Уже одинаково</b>На сервере нет ничего нового.");
      }, function(err){ srv("bad", "<b>Не получилось</b>" + esc(err.message || err)); });
    }
    else if (act === "ping"){
      srv("warn", "<b>Проверяю…</b>");
      Cloud.ping().then(function(r){
        srv("ok", "<b>Сервер настроен верно</b>Папка: " + esc(r.dir) + ". Учеников в ней: " + r.students +
          ". Ключ наставника " + (r.adminKeySet ? "задан" : "не задан — список учеников будет закрыт") + ".");
      }, function(err){ srv("bad", "<b>Проверка не прошла</b>" + esc(err.message || err)); });
    }
    else if (act === "viewother"){
      var code = (document.getElementById("othercode").value || "").trim().toLowerCase();
      if (!code){ srv("bad", "<b>Пусто</b>Введите код ученика."); return; }
      srv("warn", "<b>Загружаю…</b>");
      Cloud.load(code).then(function(r){
        if (!r.found || !r.data){ srv("warn", "<b>Ничего нет</b>Под кодом «" + esc(code) +
          "» на сервере пока нет прогресса. Проверьте код."); return; }
        viewState = { code: code, data: r.data, serverAt: r.serverAt || 0 };
        screenAdmin();
      }, function(err){ srv("bad", "<b>Не получилось</b>" + esc(err.message || err)); });
    }
    else if (act === "listall"){
      var key = (document.getElementById("adminkey").value || "").trim();
      if (!key){ srv("bad", "<b>Пусто</b>Нужен ключ наставника — тот, что задан в настройках функции как ADMIN_KEY."); return; }
      adminKeyRemember(key);
      srv("warn", "<b>Загружаю…</b>");
      Cloud.list(key).then(function(r){
        var st = r.students || [];
        if (!st.length){ srv("warn", "<b>Пока никого</b>На сервере нет ни одного ученика."); return; }
        srv("ok", "<b>Учеников на сервере: " + st.length + "</b>" +
          '<div class="admlist">' + st.map(function(s){
            return s.broken
              ? '<div class="admlrow"><b>' + esc(s.code) + '</b><span>файл испорчен</span></div>'
              : '<div class="admlrow"><b>' + esc(s.code) + '</b>' +
                '<span>' + s.solved + ' уроков · ' + s.stars + '★ · ' + s.xp + ' XP · ' +
                fmtMins(s.timeMs) + ' · ' + fmtWhen(s.serverAt) + '</span>' +
                '<button class="minibtn" data-act="viewcode" data-id="' + esc(s.code) + '">открыть</button></div>';
          }).join("") + '</div>');
      }, function(err){ srv("bad", "<b>Не получилось</b>" + esc(err.message || err)); });
    }
    else if (act === "viewcode"){
      srv("warn", "<b>Загружаю…</b>");
      Cloud.load(id).then(function(r){
        if (!r.found || !r.data){ srv("warn", "<b>Ничего нет</b>Прогресс пуст."); return; }
        viewState = { code: id, data: r.data, serverAt: r.serverAt || 0 };
        screenAdmin();
      }, function(err){ srv("bad", "<b>Не получилось</b>" + esc(err.message || err)); });
    }

    /* ---------- файл ---------- */
    else if (act === "download"){
      try {
        var blob = new Blob([progressJSON()], { type:"application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = "kodokvest-progress.json";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
        say("ok", "<b>Файл сохранён</b>Ищи kodokvest-progress.json в папке загрузок.");
      } catch(e3){
        say("warn", "<b>Скачать не получилось</b>Скопируй текст из поля ниже вручную.");
      }
    }
    else if (act === "copy"){
      var ta = document.getElementById("admjson"), done = false;
      try { ta.focus(); ta.select(); done = document.execCommand("copy"); } catch(e4){}
      if (!done && navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(progressJSON()).then(
          function(){ say("ok", "<b>Скопировано</b>Прогресс в буфере обмена."); },
          function(){ say("warn", "<b>Не вышло</b>Выдели текст в поле и скопируй сам."); });
        return;
      }
      say(done ? "ok" : "warn", done
        ? "<b>Скопировано</b>Прогресс в буфере обмена."
        : "<b>Не вышло</b>Выдели текст в поле и скопируй сам.");
    }
    else if (act === "import"){
      var txt = document.getElementById("admjson").value, obj = null;
      try { obj = JSON.parse(txt); } catch(e5){
        say("bad", "<b>Это не файл прогресса</b>Текст не разбирается как JSON. Скопируй содержимое файла целиком, вместе с фигурными скобками.");
        return;
      }
      if (!obj || typeof obj !== "object" || typeof obj.xp !== "number" || typeof obj.stars !== "object"){
        say("bad", "<b>Не тот файл</b>Внутри должны быть поля xp и stars. Похоже, это что-то другое.");
        return;
      }
      var ok = true;
      try { ok = confirm("Заменить прогресс на этом устройстве загруженным? Нынешний будет стёрт."); } catch(e6){}
      if (!ok) return;
      Object.keys(S).forEach(function(k){ delete S[k]; });
      Object.assign(S, blankProgress());
      S.admin = { unlockAll:false };
      Object.keys(obj).forEach(function(k){ S[k] = obj[k]; });
      ensureShape(S);
      save(); refreshTop(); screenAdmin();
      say("ok", "<b>Прогресс загружен</b>Данные заменены.");
    }
  });

  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= старт ================= */
document.getElementById("btn-map").onclick = screenWorlds;
document.getElementById("logo").onclick = screenWorlds;
document.getElementById("btn-sand").onclick = screenSandbox;
(function(){ var b = document.getElementById("btn-games"); if (b) b.onclick = screenGames; })();
(function(){ var b = document.getElementById("btn-today"); if (b) b.onclick = screenToday; })();
(function(){ var b = document.getElementById("btn-who"); if (b) b.onclick = screenAccount; })();
(function(){ var b = document.getElementById("btn-warm"); if (b) b.onclick = screenWarmups; })();
(function(){ var b = document.getElementById("btn-viz"); if (b) b.onclick = screenViz; })();
(function(){ var b = document.getElementById("btn-ai"); if (b) b.onclick = screenAILab; })();
document.getElementById("btn-focus").onclick = function(){
  document.body.classList.toggle("focus");
  this.classList.toggle("on");
};
document.getElementById("win").onclick = function(e){ if (e.target === this) closeWin(); };
window.addEventListener("keydown", function(e){ if (e.key === "Escape") closeWin(); });
window.addEventListener("resize", function(){
  document.querySelectorAll("canvas.stage").forEach(function(c){
    if (c._lastTurtle) drawTurtle(c, c._lastTurtle);
  });
  /* стрелки визуализатора нарисованы по реальным координатам — после
     изменения размера их надо пересчитать */
  document.querySelectorAll(".vizmem").forEach(function(m){ vizDrawArrows(m); });
});

/* Ссылка вида .../kodokvest/?kid=misha-7f3a один раз задаёт код ученика
   на этом устройстве. Дальше он живёт в памяти браузера, а из адреса
   убирается — чтобы не болтался на виду и не попал в закладку. */
(function(){
  if (typeof Cloud === "undefined") return;
  var m = /[?&]kid=([^&]+)/.exec(location.search || "");
  if (!m) return;
  var set = Cloud.setCode(decodeURIComponent(m[1]));
  try {
    if (set && history.replaceState)
      history.replaceState(null, "", location.pathname + location.hash);
  } catch(e){}
})();

/* грузим содержание всех миров до первой отрисовки — иначе на сайте
   миры 2–5 мигают как «в работе», пока их файлы не приедут */
allWorldsContent().then(function(){
  if (!routeHash()){
    if (needsRegister()) screenRegister();   /* сервер настроен, ученик ещё не выбран */
    else screenWorlds();
  }
  /* сервер подключаем в фоне: игра должна открываться сразу и работать без сети */
  if (cloudEnabled()){
    cloudPull().then(function(changed){
      refreshTop();
      /* перерисовываем только карту миров — не выдёргиваем ученика из урока */
      if (changed && document.querySelector(".worlds")) screenWorlds();
      return cloudPush();
    }).catch(function(){ refreshTop(); });
  }
});
window.addEventListener("hashchange", function(){ if (!routeHash()) screenWorlds(); });

window.__game = {
  screenWorlds: screenWorlds, screenWorld: screenWorld, openLesson: openLesson,
  screenSandbox: screenSandbox, screenAdmin: screenAdmin, screenGames: screenGames,
  openGame: openGame, screenWarmups: screenWarmups, openWarmup: openWarmup,
  screenToday: screenToday, dailyPick: dailyPick, markActiveToday: markActiveToday,
  streakCurrent: streakCurrent, streakBest: streakBest, dailyDone: dailyDone, dayKey: dayKey,
  scheduleDays: scheduleDays, isStudyDay: isStudyDay, toggleStudyDay: toggleStudyDay, studyDue: studyDue,
  shieldsLeft: shieldsLeft, shieldToNext: shieldToNext, shieldedOn: shieldedOn, useShield: useShield,
  shieldWouldSave: shieldWouldSave,
  coveredDays: coveredDays, shieldsLeftIn: shieldsLeftIn, SHIELD_EVERY: SHIELD_EVERY, SHIELD_MAX: SHIELD_MAX,
  screenRegister: screenRegister, screenAccount: screenAccount, doRegister: doRegister,
  doLogin: doLogin, doLogout: doLogout, slugFromName: slugFromName, myName: myName,
  myCode: myCode, needsRegister: needsRegister,
  screenViz: screenViz, vizRecord: vizRecord, vizPlaying: vizPlaying, state: S, save: save,
  openProject: openProject, screenProjectDone: screenProjectDone, projectById: projectById,
  projectOfWorld: projectOfWorld, projectState: projectState, projectDone: projectDone,
  projectOpen: projectOpen, projectStartCode: projectStartCode,
  screenAILab: screenAILab, openAILesson: openAILesson, ailabDone: ailabDone,
  reviewTruth: reviewTruth,
  CUSTOM: CUSTOM, sameDrawing: sameDrawing, editUnits: editUnits, setStars: setStars,
  stopTimer: stopTimer, adminUnlock: adminUnlock, ADMIN_CODE: ADMIN_CODE,
  getSession: function(){ return session; },
  mergeProgress: mergeProgress, cloudSnapshot: cloudSnapshot, applyProgress: applyProgress,
  blankProgress: blankProgress, ensureShape: ensureShape,
  clearResults: clearResults, clearAll: clearAll,
  cloudPull: cloudPull, cloudPush: cloudPush, cloudState: cloudState
};
})();
