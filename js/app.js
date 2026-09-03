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
  { id:"builder", em:"🏗", name:"Строитель",      desc:"собрал проект целиком" },
  { id:"week",    em:"🔥", name:"Неделя подряд",  desc:"7 дней занятий подряд" },
  { id:"month",   em:"🏅", name:"Месяц подряд",   desc:"30 дней занятий подряд" },
  { id:"again",   em:"🔁", name:"Закрепил",       desc:"5 уроков закреплены повтором" },
  { id:"lean",    em:"🪶", name:"Лёгкая рука",    desc:"5 уроков не дороже решения автора" },
  { id:"beasts",  em:"🐉", name:"Укротитель",      desc:"6 разных ошибок побеждены" },
  { id:"author",  em:"✍️", name:"Автор",          desc:"составил своё задание" },
  { id:"guest",   em:"🤝", name:"Гость",          desc:"прошёл задание от друга" }
];
/* Бейджи за длинный стрик. Щит уже держит серию, но награды за неё не было:
   ребёнок видел растущее число и всё. Порогов два — один достижимый, второй
   как цель на лето. Серия считается по «закрытым» дням (занятие ИЛИ щит),
   поэтому месяц не требует тридцати занятий без единого пропуска: щит
   зарабатывается каждые 5 дней и закрывает дыры по ходу. */
var STREAK_BADGES = [
  { id:"week",  days: 7 },
  { id:"month", days: 30 }
];
var RANKS = [
  [0,"Новичок"], [150,"Ученик"], [400,"Кодер"], [700,"Инженер"],
  [1200,"Хакер"], [1800,"Мастер"], [2600,"Легенда"], [3600,"Гуру"]
];
var STAR_XP = [0, 25, 60, 100];

/* Длина занятия и состав — константы рамки взрослого (раздел «рамка занятий»
   ниже). Объявлены здесь, а не там, по одной причине: ensureShape(S) зовётся
   при загрузке файла, до строчек ниже, и frameShape сверяется с этими
   списками. Объявление через var подняло бы имя, но не значение. */
var ZAN_LEN = [20, 30, 45];
var ZAN_MIX = ["new", "balanced", "repeat"];
/* потолок дня: сколько минут в тренажёре взрослый считает достаточным */
var CAP_CHOICES = [0, 30, 45, 60, 90];

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
                     "days","daily","shields","projects","review","drafts",
                     "mytasks","friendTasks","errs","gallery","certAt",
                     "hours","zan","ptasks","specs","parts","builds","solved"];
var PROGRESS_NUMS = ["xp","sandboxRuns","firstTry","perfect"];
/* mytasks рядом с games по одной причине: и то и другое ребёнок сделал сам,
   а не «набрал результатов». Сброс прогресса в панели наставника такое не
   стирает — стирает только смена ученика. */
var KEEP_ON_RESET = ["games","mytasks","gallery"];

/* пустой прогресс: только структура, без данных */
function blankProgress(){
  /* mytaskDraft — недособранное «своё задание» (название, условие, код).
     Живёт рядом с sandbox и по той же причине: это не результат занятий,
     а незаконченная работа ребёнка, и терять её на переходе нельзя. */
  var o = { v:2, badges:[], sandbox:null, mytaskDraft:null, name:"", schedule:{ days:[] },
            frame: blankFrame() };
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
  if (!o.mytaskDraft || typeof o.mytaskDraft !== "object") o.mytaskDraft = null;
  if (typeof o.name !== "string") o.name = "";
  if (!o.schedule || typeof o.schedule !== "object") o.schedule = { days:[] };
  if (!Array.isArray(o.schedule.days)) o.schedule.days = [];
  o.frame = frameShape(o.frame);
  if (!o.admin || typeof o.admin !== "object") o.admin = { unlockAll:false };
  /* Подписи учеников у наставника. Живут в admin, то есть на ЕГО устройстве,
     и на сервер не уходят — как и все настройки устройства. Это прямое
     следствие того, что имя ребёнка больше не синхронизируется (cloudSnapshot):
     сервер знает только код, а «Петя, 5 класс» знает наставник у себя. */
  if (!o.admin.labels || typeof o.admin.labels !== "object") o.admin.labels = {};
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
  o.sandbox = null; o.mytaskDraft = null; o.name = ""; o.schedule = { days:[] };
  o.frame = blankFrame();
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
  awardStreak();
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
  /* Только из открытых. Набор открытых растёт вместе с прогрессом, поэтому
     задача одной и той же даты может смениться после пройденного урока —
     это не страшно: выполненная задача помечена в S.daily и обратно не
     вернётся. А если открытых нет вовсе (первые дни, уроков пройдено ноль),
     честно возвращаем null: задача, которую нечем читать, хуже, чем её
     отсутствие, и на экране «Сегодня» об этом написано прямым текстом. */
  var ws = warmupsOpen();
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

/* ================= рамка занятий: её ставит взрослый =================
   Расписание выше — настройка ребёнка: он сам отмечает дни. Рамка — то же
   самое, но от взрослого, и она сильнее: если рамка задана, экран «Сегодня»
   показывает её и не даёт ребёнку двигать.

   Что в рамке и почему именно это:
     days   дни недели занятий (как schedule.days)
     len    длина занятия: 20, 30 или 45 минут
     mix    чего больше — нового или повторения
     goal   дата, к которой надо успеть (для семейного обучения — аттестация)
     breaks каникулы: отрезки дат, в которые пропуск запланирован
     report получать ли отчёт (галочка снимает ЦЕЛЬ «рассылка», а не статус)
   Чего в рамке НЕТ и не будет: выбора конкретных уроков. Порядок курса держит
   проверка «конструкция объяснена раньше, чем понадобилась» (README, «Порядок
   объяснений»), и взрослый, тасующий уроки, сломает именно её — а упрётся
   ребёнок. Взрослый ставит рамку и темп, курс отвечает за порядок.

   Слияние: как у расписания, побеждает более свежее сохранение. Объединение
   вернуло бы снятый на другом устройстве день. */
function blankFrame(){
  return { days:[], len:30, mix:"balanced", goal:null, breaks:[], report:true,
           perLesson:null, cap:0, capHard:false, setAt:0 };
}
function frameShape(f){
  var o = (f && typeof f === "object") ? f : {};
  var out = blankFrame();
  if (Array.isArray(o.days))
    out.days = o.days.filter(function(n){ return typeof n === "number" && n >= 0 && n <= 6; });
  if (ZAN_LEN.indexOf(o.len) >= 0) out.len = o.len;
  if (ZAN_MIX.indexOf(o.mix) >= 0) out.mix = o.mix;
  if (typeof o.goal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.goal)) out.goal = o.goal;
  if (Array.isArray(o.breaks))
    out.breaks = o.breaks.filter(function(b){
      return Array.isArray(b) && b.length === 2 &&
             /^\d{4}-\d{2}-\d{2}$/.test(b[0]) && /^\d{4}-\d{2}-\d{2}$/.test(b[1]);
    }).slice(0, 12);
  out.report = o.report !== false;
  /* сколько минут на урок уходит у ЭТОГО ребёнка — по замеру, принятому
     взрослым. Пока не принят, план считается по общему числу (zanSlots). */
  if (typeof o.perLesson === "number" && o.perLesson >= 2 && o.perLesson <= 40)
    out.perLesson = Math.round(o.perLesson * 10) / 10;
  /* потолок экранного времени на день, в минутах. 0 — не ограничиваем. */
  if (CAP_CHOICES.indexOf(o.cap) >= 0) out.cap = o.cap;
  out.capHard = o.capHard === true;
  out.setAt = typeof o.setAt === "number" ? o.setAt : 0;
  return out;
}
function frame(){ S.frame = frameShape(S.frame); return S.frame; }
function frameOn(){ return frame().days.length > 0; }
function frameSet(patch){
  var f = frameShape(Object.assign({}, frame(), patch || {}));
  f.setAt = Date.now();
  S.frame = f;
  save();
  return f;
}
/* день внутри запланированных каникул: пропуск, о котором договорились.
   В отчёте он не должен выглядеть как прогул — иначе отчёт начнёт обвинять
   семью в том, что она сама и запланировала, и его перестанут читать. */
function isBreakDay(key){
  key = key || dayKey();
  return frame().breaks.some(function(b){ return key >= b[0] && key <= b[1]; });
}
function frameStudyDay(key){
  key = key || dayKey();
  if (!frameOn() || isBreakDay(key)) return false;
  return frame().days.indexOf(weekdayOf(key)) >= 0;
}
/* сколько уроков ставить в занятие. Замер по курсу: урок 5–8 минут, плюс
   разминка и проверка в начале и в конце — поэтому 20 минут это два урока,
   а не четыре. Обещать больше, чем влезает, нельзя: первое же занятие
   опровергнет. */
function zanSlots(len){ return len <= 20 ? 2 : (len <= 30 ? 3 : 4); }
/* Сколько уроков ставить ЭТОМУ ребёнку. Пока замера нет или взрослый его не
   принял — общее число выше (оно посчитано из длины текста уроков, а не снято
   с ребёнка). Как только замер принят, план считается по нему. */
function zanSlotsFor(len){
  var per = frame().perLesson;
  if (!per) return zanSlots(len);
  return Math.max(1, Math.min(6, Math.round((len - MIN_AROUND) / per)));
}

/* ⚠️ Гейт разумности. Родитель, поставивший «пройти курс за месяц», получит
   занятие на полтора часа и брошенного ребёнка — а виноваты будем мы.
   Считаем честно и вслух: сколько уроков осталось, сколько занятий до даты,
   сколько минут выходит на занятие. Больше ZAN_SANE минут — не даём. */
var ZAN_SANE = 60;
var MIN_PER_LESSON = 7;      /* 5–8 минут по замеру, берём середину */
var MIN_AROUND = 8;          /* разминка, повтор и проверка вокруг уроков */
function lessonsLeft(){
  var n = 0;
  CURRICULUM.forEach(function(w){
    worldReadyLessons(w).forEach(function(l){ if (!solved(l.id)) n++; });
  });
  return n;
}
/* сколько учебных дней между сегодня и датой, с учётом дней недели и каникул */
function studyDaysUntil(goal, days){
  if (!goal) return 0;
  var cur = dayKey(), n = 0, guard = 0;
  while (cur < goal && guard++ < 1200){
    cur = shiftDay(cur, 1);
    if (days.indexOf(weekdayOf(cur)) >= 0 && !isBreakDay(cur)) n++;
  }
  return n;
}
function paceCheck(goal, days, len){
  var left = lessonsLeft();
  var sessions = studyDaysUntil(goal, days || frame().days);
  if (!goal || !sessions) return { ok:true, sessions:sessions, left:left, need:0 };
  var perSession = Math.ceil(left / sessions);
  /* если замер принят, считаем по НЁМУ: обещать родителю дату, исходя из
     среднего темпа, когда известен темп его ребёнка, — это врать вежливо */
  var per = frame().perLesson || MIN_PER_LESSON;
  var mins = Math.round(perSession * per + MIN_AROUND);
  return {
    ok: mins <= ZAN_SANE, sessions: sessions, left: left,
    per: perSession, mins: mins, len: len || frame().len,
    /* сколько уроков помещается в занятие выбранной длины при этом темпе */
    fits: Math.max(1, Math.floor(((len || frame().len) - MIN_AROUND) / per)),
    byMeasure: !!frame().perLesson
  };
}

/* ================= потолок дня =================
   Замер 03.09.2026: первое, чего боится родитель в любом экранном продукте, —
   не «не научится», а экранное время. Занятие с обещанной длиной уже отвечает
   на этот страх наполовину; потолок отвечает прямо.

   ⚠️ По умолчанию потолок МЯГКИЙ: тренажёр говорит «на сегодня хватит», но
   ничего не запирает. Жёсткая блокировка наказывает за увлечённость и
   противоречит всему остальному в продукте — поэтому запирать можно только
   если взрослый отдельно этого попросил галочкой.
   Считаем по карте часов, то есть по активным минутам ВЕЗДЕ в тренажёре, а не
   только на занятии: родитель мерит экранное время, а не учебное. */
function todayMinutes(){
  var row = (S.hours || {})[dayKey()] || [], sec = 0;
  for (var i = 0; i < 24; i++) sec += row[i] || 0;
  return Math.round(sec / 60);
}
function capOn(){ return frame().cap > 0; }
function capLeft(){ return Math.max(0, frame().cap - todayMinutes()); }
function capReached(){ return capOn() && todayMinutes() >= frame().cap; }
function capHard(){ return capReached() && frame().capHard; }
function capNoteHTML(){
  if (!capReached()) return "";
  var m = todayMinutes();
  return '<div class="daybanner rest">🌙 <b>Сегодня уже ' + m + ' ' +
    plural(m, "минута", "минуты", "минут") + ' за тренажёром.</b> ' +
    (frame().capHard
      ? 'На сегодня всё — так договорились дома. Начатое доделать можно, новое откроется завтра.'
      : 'Взрослый считает, что на сегодня хватит. Дальше — на твоё усмотрение.') + '</div>';
}

/* ================= занятие =================
   До сих пор уроки шли сплошным потоком: сто штук подряд, без начала и конца.
   Из этого росли сразу три беды — ребёнок не видел, когда конец (а порог
   входа создаёт неизвестность, а не трудность), родитель не мог планировать,
   и у продукта не было единицы, о которой отчитываться: урок в шесть минут
   мелок для отчёта, неделя — поздна.

   Занятие эту единицу вводит. Разбор целиком: docs/zanyatie-i-vzroslyj.md § 2.

   Пять правил, без которых механика навредит, и все пять держатся кодом:
     1. урок не режется посередине — время лишь предлагает закончить;
     2. занятие закрывается, даже если не получилось («сегодня было трудно»);
     3. план детерминирован по дате — иначе на двух устройствах разные планы;
     4. перевыполнение не наказывается и не поощряется: занятие засчитано;
     5. пропуск не «сгорает» — за это отвечает щит стрика, а не занятие.

   ⚠️ Это НЕ блиц на таймере (README, «Планы»): тот таймер стоит внутри задачи
   и торопит думать, этот ограничивает сеанс и, наоборот, разрешает закончить.
   Смешивать их в одном экране нельзя. */
function zanAll(){ S.zan = S.zan || {}; return S.zan; }
function zanKeyOf(key, n){ return (key || dayKey()) + "#" + n; }
function zanOfDay(key){
  key = key || dayKey();
  var all = zanAll();
  return Object.keys(all).filter(function(k){ return k.indexOf(key + "#") === 0; })
    .sort().map(function(k){ return Object.assign({ key:k }, all[k]); });
}
/* открытое занятие сегодня, если оно есть */
function zanOpen(){
  var list = zanOfDay(dayKey());
  for (var i = 0; i < list.length; i++) if (!list[i].end) return list[i];
  return null;
}
function zanLast(){
  var all = zanAll(), keys = Object.keys(all).sort();
  for (var i = keys.length - 1; i >= 0; i--) if (all[keys[i]].end)
    return Object.assign({ key:keys[i] }, all[keys[i]]);
  return null;
}
/* разминка типа predict для проверки понимания в конце занятия: берём не ту,
   что уже стоит задачей дня, и детерминированно по дате */
function zanPredictPick(key){
  var daily = dailyPick(key);
  var pool = warmupsOpen().filter(function(w){
    return w.type === "predict" && (!daily || w.id !== daily.id);
  });
  if (!pool.length) return null;
  var s = String(key) + "p", h = 0;
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}
/* План занятия. Детерминирован по дате и текущему прогрессу: на двух
   устройствах в один день выходит одно и то же. */
function zanPlanFor(key){
  key = key || dayKey();
  var f = frame(), slots = zanSlotsFor(f.len), plan = [];
  var warm = dailyPick(key);
  if (warm) plan.push({ k:"warm", id:warm.id, title:warm.title });

  var due = reviewDue();
  var wantRepeat = f.mix === "repeat" ? Math.min(due.length, slots - 1)
                 : f.mix === "new" ? 0
                 : Math.min(due.length, 1);
  var newCount = Math.max(0, slots - wantRepeat);

  /* новые уроки: следующие непройденные по порядку курса */
  var picked = [];
  CURRICULUM.forEach(function(w){
    if (picked.length >= newCount) return;
    var ready = worldReadyLessons(w);
    for (var i = 0; i < ready.length && picked.length < newCount; i++)
      if (!solved(ready[i].id)) picked.push(ready[i]);
  });
  picked.forEach(function(l){ plan.push({ k:"lesson", id:l.id, title:l.title }); });

  due.slice(0, wantRepeat).forEach(function(r){
    plan.push({ k:"review", id:r.lesson.id, title:r.lesson.title });
  });

  var pred = zanPredictPick(key);
  if (pred) plan.push({ k:"predict", id:pred.id, title:pred.title });
  return plan;
}
function zanStart(){
  var open = zanOpen();
  if (open) return open;
  var key = dayKey(), n = zanOfDay(key).length + 1;
  var rec = { start: Date.now(), end: 0, len: frame().len, plan: zanPlanFor(key),
              done: [], cut: [], ask: 0, sec: 0, pause: 0, predOk: 0, predAll: 0 };
  zanAll()[zanKeyOf(key, n)] = rec;
  save();
  return Object.assign({ key: zanKeyOf(key, n) }, rec);
}
/* десять секунд от общего счётчика: активные идут в работу, остальные в паузу */
function zanTick(sec, active){
  var open = zanOpen();
  if (!open) return;
  var rec = zanAll()[open.key];
  if (!rec) return;
  if (active) rec.sec += sec; else rec.pause += sec;
}
/* блок сделан. Зовётся из победы урока, разминки и повтора — то есть из уже
   существующих мест, а не из нового обработчика: занятие не должно требовать
   от ребёнка ходить по особому экрану. */
function zanNote(kind, id, extra){
  var open = zanOpen();
  if (!open) return;
  var rec = zanAll()[open.key];
  if (!rec) return;
  var mark = null;
  rec.plan.forEach(function(b){
    if (b.id !== id) return;
    /* урок из плана мог быть отмечен и как «новый», и как «повтор» — засчитываем
       тот блок, который ещё не закрыт */
    if (rec.done.indexOf(b.k + ":" + b.id) < 0) mark = b.k + ":" + b.id;
  });
  if (!mark) return;
  rec.done.push(mark);
  /* проверка понимания считается по блоку плана, а не по слову вызывающего:
     «предсказал верно» — это разминка predict, пройденная с первой попытки.
     Со второй попытки предсказание уже подсмотрено движком, и засчитывать его
     как понимание значило бы врать взрослому. */
  if (mark.indexOf("predict:") === 0){
    rec.predAll++;
    if (extra && extra.ok) rec.predOk++;
  }
  save();
  /* всё по плану закрыто (сделано или перенесено) — занятие закрывается само */
  if (!zanRemaining(rec).length) zanFinish("plan");
}
function zanFinish(reason){
  var open = zanOpen();
  if (!open) return null;
  var rec = zanAll()[open.key];
  if (!rec || rec.end) return null;
  rec.end = Date.now();
  rec.why = reason || "hand";
  save();
  return Object.assign({ key: open.key }, rec);
}
/* Что в плане ещё не закрыто. Шаг закрыт двумя способами: сделан или перенесён.
   Перенесённый не исчезает — он остаётся в плане с пометкой и вернётся сам,
   потому что план следующего занятия строится из непройденных уроков. */
function zanRemaining(rec){
  var closed = {};
  (rec.done || []).forEach(function(x){ closed[x] = 1; });
  (rec.cut || []).forEach(function(x){ closed[x] = 1; });
  return (rec.plan || []).filter(function(b){ return !closed[b.k + ":" + b.id]; });
}
function zanClosedCount(rec){ return (rec.done || []).length + (rec.cut || []).length; }
function zanIsCut(rec, b){ return (rec.cut || []).indexOf(b.k + ":" + b.id) >= 0; }

/* ================= сжатие плана =================
   Если половина времени прошла, а сделано меньше половины, занятие само
   убирает последний урок и оставляет проверку понимания. Смысл не в экономии
   минут, а в том, чтобы ребёнок ВСЁ РАВНО дошёл до финала: ощущение «дошёл»
   и держит привычку возвращаться, а брошенное на середине занятие не держит
   ничего.

   ⚠️ Сжатие обязано быть ВИДИМЫМ. Шаг остаётся в плане с пометкой «перенесли
   на следующий раз», и в отчёте взрослому стоит отдельная строка. Молча
   сокращённый план — это тихая ложь того же рода, что и старый счётчик
   времени, который считал открытую вкладку за работу.

   Проверка понимания не режется никогда: она единственное, что нельзя
   подделать, и ради неё занятие и заканчивается. */
function zanCanCut(rec){
  /* режем только уроки и повторы, и только пока в остатке есть хоть один
     сверх одного — оставить занятие вовсе без урока незачем */
  return zanRemaining(rec).filter(function(b){
    return b.k === "lesson" || b.k === "review";
  }).length > 1;
}
function zanCutLast(rec, why){
  var rest = zanRemaining(rec).filter(function(b){
    return b.k === "lesson" || b.k === "review";
  });
  if (!rest.length) return false;
  var b = rest[rest.length - 1];
  rec.cut = rec.cut || [];
  rec.cut.push(b.k + ":" + b.id);
  rec.cutWhy = why || rec.cutWhy || "time";
  return true;
}
/* автоматическое сжатие: зовётся при возврате на экран занятия */
function zanSqueeze(rec){
  if (!rec || rec.end) return false;
  var half = (rec.len || 30) / 2;
  if (zanMins(rec) < half) return false;
  var closed = zanClosedCount(rec), total = (rec.plan || []).length;
  if (!total || closed / total >= 0.5) return false;
  var did = false;
  while (zanCanCut(rec) && zanCutLast(rec, "time")) { did = true; break; }
  if (did) save();
  return did;
}
/* «только проверку и всё»: откладываем ВСЁ, кроме проверки понимания, — включая
   не начатую разминку. Иначе кнопка врёт: обещали «только проверку», а по пути
   стоит ещё один шаг.
   Автоматическое сжатие по времени разминку не трогает: она короткая и она
   вход в занятие. Тут же выбор делает сам ребёнок, и он выбирает конец. */
function zanCutToCheck(rec){
  var n = 0;
  rec.cut = rec.cut || [];
  zanRemaining(rec).forEach(function(b){
    if (b.k === "predict") return;
    rec.cut.push(b.k + ":" + b.id);
    n++;
  });
  if (n) rec.cutWhy = "choice";
  save();
  return n;
}
/* ===== перерыв внутри занятия =====
   45 минут подряд восьмилетний не работает — школа делит их переменой, и мы
   тоже. Перерыв берётся только МЕЖДУ шагами и длится ZAN_BREAK минут.
   Время перерыва не идёт ни в работу, ни в карту часов: оно записывается в
   паузу, как и всякое отсутствие. Разница в том, что у перерыва есть кнопка, а
   у «ушёл и не вернулся» её нет, — и в отчёте это видно. */
var ZAN_BREAK = 5;
function zanOnBreak(rec){ return !!(rec && rec.breakUntil && rec.breakUntil > Date.now()); }
function zanBreakStart(rec){
  if (!rec || rec.end) return;
  rec.breakUntil = Date.now() + ZAN_BREAK * 60000;
  rec.breaksTaken = (rec.breaksTaken || 0) + 1;
  save();
}
function zanBreakEnd(rec){
  if (!rec) return;
  rec.breakUntil = 0;
  save();
}
/* пора предложить перерыв: длинное занятие, половина позади, перерыва не было */
function zanBreakDue(rec){
  return rec && !rec.end && (rec.len || 30) >= 45 && !(rec.breaksTaken || 0) &&
         zanMins(rec) >= (rec.len || 30) / 2 && zanRemaining(rec).length > 0;
}
function zanMins(rec){ return Math.round((rec.sec || 0) / 60); }
function zanPauseMins(rec){ return Math.round((rec.pause || 0) / 60); }
function zanTimeUp(rec){ return zanMins(rec) >= (rec.len || 30); }
function zanDoneList(rec){
  return (rec.done || []).map(function(x){ return x.split(":")[1]; });
}

/* ================= замер: сколько на самом деле длится занятие =================
   Число уроков в занятии посчитано из длины текста урока (5–8 минут по замеру
   курса) — то есть из замысла, а не с живого ребёнка. Вместо того чтобы гадать
   дальше, тренажёр меряет сам: сколько активных минут уходит на один урок
   ИМЕННО У ЭТОГО ребёнка, и предлагает взрослому поправить рамку.

   Четыре честности, без которых замер врал бы:
     1. считаем только ЗАКРЫТЫЕ занятия, где сделан хотя бы один урок;
     2. занятия короче трёх активных минут не в счёт — это открыл и закрыл;
     3. берём МЕДИАНУ, а не среднее: одно занятие «не пошло» не должно двигать
        оценку;
     4. пока занятий меньше ZAN_STAT_MIN, не говорим ничего. Одно занятие —
        не замер, а случай.

   И главное: замер ничего не меняет сам. План перестраивается только после
   того, как взрослый его принял, — рамку ставит он, а не мы за его спиной. */
var ZAN_STAT_MIN = 3;
function median(a){
  if (!a.length) return 0;
  var v = a.slice().sort(function(x, y){ return x - y; });
  var m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function zanStats(){
  var mins = [], per = [], lessons = [], all = zanAll();
  Object.keys(all).forEach(function(k){
    var r = all[k];
    if (!r || !r.end) return;
    var m = (r.sec || 0) / 60;
    if (m < 3) return;
    var n = (r.done || []).filter(function(x){
      return x.indexOf("lesson:") === 0 || x.indexOf("review:") === 0;
    }).length;
    if (!n) return;
    mins.push(m); per.push(m / n); lessons.push(n);
  });
  var out = {
    n: mins.length,
    enough: mins.length >= ZAN_STAT_MIN,
    mins: Math.round(median(mins)),
    per: Math.round(median(per) * 10) / 10,
    lessons: Math.round(median(lessons) * 10) / 10
  };
  if (!out.enough) return out;
  /* какая из трёх длин ближе к тому, что выходит на деле */
  out.bestLen = ZAN_LEN.reduce(function(a, b){
    return Math.abs(b - out.mins) < Math.abs(a - out.mins) ? b : a;
  }, ZAN_LEN[0]);
  /* сколько уроков помещается в нынешнюю длину при таком темпе */
  var f = frame();
  out.len = f.len;
  out.fits = Math.max(1, Math.min(6, Math.round((f.len - MIN_AROUND) / out.per)));
  out.slotsNow = zanSlotsFor(f.len);
  out.accepted = !!f.perLesson;
  out.differs = out.fits !== out.slotsNow || (out.bestLen !== f.len);
  return out;
}

/* ================= отчёт по занятию =================
   Четыре строки, двадцать секунд чтения. Больше взрослый не прочитает, а
   репетитор в мессенджере пишет одну («занимались, всё хорошо») — наше
   преимущество в точности, а не в объёме.

   ⚠️ Отчёт обязан иногда содержать плохие новости. Отчёт, в котором всегда
   «молодец», через три недели становится рекламой самого себя и его
   перестают читать. Подсказки и показанные решения поэтому НЕ прячем: строка
   «взял две подсказки» — это то, из-за чего поверят остальным строкам.
   И это же то, чего репетитор про себя не напишет: он оценивает собственную
   работу, за которую получает деньги. */
function zanReport(rec, st){
  st = st || S;
  var lg = st.log || {};
  var ids = zanDoneList(rec);
  var lessons = ids.filter(function(id){ return CURRICULUM.byId(id); });
  var mins = zanMins(rec), pause = zanPauseMins(rec);

  /* 1. что было */
  var was = "Занятие " + mins + " " + plural(mins, "минута", "минуты", "минут");
  if (pause >= 2) was += " работы и " + pause + " " + plural(pause, "минута", "минуты", "минут") + " перерыва";
  was += ", " + lessons.length + " " + plural(lessons.length, "урок", "урока", "уроков");
  var cutN = (rec.cut || []).length;
  if (zanRemaining(rec).length) was += " — занятие закончили раньше плана";

  /* 2. за что похвалить: ищем конкретное, а не общее */
  var praise = null;
  lessons.forEach(function(id){
    if (praise) return;
    var g = lg[id] || {};
    var l = CURRICULUM.byId(id);
    if (!l) return;
    if ((g.attempts || 0) >= 3 && !g.shown && !(g.hints || 0))
      praise = "не сдался на уроке «" + l.title + "»: " + g.attempts + " " +
               plural(g.attempts, "попытка", "попытки", "попыток") + " и ни одной подсказки";
    else if ((g.stars || 0) === 3 && (g.attempts || 0) === 1)
      praise = "прошёл «" + l.title + "» с первой попытки, без подсказок";
  });
  if (!praise && rec.predAll && rec.predOk === rec.predAll)
    praise = rec.predMine
      ? "в конце занятия прочитал собственную программу и точно сказал, что она напечатает"
      : "в конце занятия точно предсказал, что напечатает программа";
  if (!praise && lessons.length) praise = "дошёл до конца занятия и закрыл " +
    lessons.length + " " + plural(lessons.length, "урок", "урока", "уроков");
  if (!praise) praise = "сел заниматься — в этот раз дальше не пошло, и это тоже бывает";

  /* 3. понял или прошёл. Предсказание вывода до запуска — единственная
     проверка, которую нельзя обмануть: подделать понимание нечем. */
  var got;
  var hadPredict = (rec.plan || []).some(function(b){ return b.k === "predict"; });
  if (rec.predAll)
    got = "Проверка понимания: предсказал вывод верно " + rec.predOk + " из " + rec.predAll + "." +
      (rec.predMine
        ? " Спрашивали про его СОБСТВЕННУЮ программу с изменённым числом — прошлый ответ к ней не подходит."
        : "");
  else if (hadPredict)
    /* проверка стояла в плане, но занятие закончили раньше. Написать «проверки
       не было» значило бы соврать взрослому в удобную сторону. */
    got = "До проверки понимания сегодня не дошли — занятие закончилось раньше.";
  else
    got = "Проверки понимания в этом занятии не было — она появится, когда откроются разминки «угадай вывод».";
  var hints = 0, shown = 0;
  lessons.forEach(function(id){
    var g = lg[id] || {};
    hints += g.hints || 0;
    if (g.shown) shown++;
  });
  if (hints || shown){
    got += " Подсказок взято: " + hints + ".";
    if (shown) got += " Решение показывалось: " + shown + " " + plural(shown, "раз", "раза", "раз") + ".";
  }

  /* 4. что спросить — вопрос за ужином, он уже написан и берётся из шпаргалки */
  var pick = dinnerPickFrom(st, dayKey());
  var ask = pick
    ? "Спроси: «что делает " + pick.it.sig + "?» — и попроси показать на примере. " +
      "Верный ответ: " + pick.it.what + "."
    : "Вопрос появится, когда будет пройден первый урок.";

  /* ⚠️ Отдельная строка про сжатие. Если план сокращён, взрослый должен узнать
     об этом от нас, а не догадаться по числу уроков: сжатие ради красивой
     картинки — это ровно то, чем плох отчёт репетитора. */
  var cut = "";
  if (cutN)
    cut = (rec.cutWhy === "choice"
      ? "Ребёнок сам решил закончить проверкой: "
      : "План сжали, сегодня шло тяжелее обычного: ") +
      cutN + " " + plural(cutN, "шаг перенесён", "шага перенесены", "шагов перенесены") +
      " на следующее занятие.";

  return { was: was, praise: praise, got: got, ask: ask, cut: cut,
           mins: mins, pause: pause, lessons: lessons.length, cutN: cutN,
           full: !zanRemaining(rec).length && !cutN };
}

/* ================= задание от взрослого =================
   Три жанра, и все три судимы (docs/zanyatie-i-vzroslyj.md § 10):
     task   задача с числами взрослого — судит движок (уезжает как #task=)
     lesson назначение: «пройди следующий урок» / «повтори трудное» — судит движок
     ask    вопрос на объяснение — судит ВЗРОСЛЫЙ, и это правильно: понимание
            объяснения он оценить может, код нет
   Свободной задачи текстом здесь нет намеренно: у неё нет эталона, а значит
   нет судьи — и движок исчезает ровно там, где взрослый на него смотрит.

   ⚠️ Задание взрослого НЕ даёт звёзд и не входит в сотню уроков — иначе
   взрослый сможет ломать прогресс из лучших побуждений. И не чаще одного в
   неделю: иначе продукт превращается в «мама ещё задала», то есть в наказание. */
var PTASK_WEEK_LIMIT = 1;
function ptaskAll(){ S.ptasks = S.ptasks || {}; return S.ptasks; }
function assignPack(o){ return b64urlEnc(JSON.stringify(o)); }
function assignUnpack(s){
  var o = null;
  try { o = JSON.parse(b64urlDec(s)); } catch(e){ return null; }
  if (!o || o.v !== 1) return null;
  if (["lesson","review","ask"].indexOf(o.t) < 0) return null;
  if (typeof o.text !== "string" || o.text.length > 400) return null;
  if (o.ref !== null && o.ref !== undefined && typeof o.ref !== "string") return null;
  return { t:o.t, ref:o.ref || "", text:o.text, from: typeof o.f === "string" ? o.f.slice(0, 16) : "" };
}
function assignLink(o){
  var base = "";
  try { base = location.origin + location.pathname; } catch(e){}
  return base + "#assign=" + assignPack({ v:1, t:o.t, ref:o.ref || "", text:o.text, f:o.from || "" });
}
function ptaskKey(o){
  var src = o.t + "\n" + (o.ref || "") + "\n" + o.text;
  var h = 5381;
  for (var i = 0; i < src.length; i++) h = ((h * 33) ^ src.charCodeAt(i)) >>> 0;
  return "p" + h.toString(36);
}
function ptaskAdd(o){
  var k = ptaskKey(o), d = ptaskAll();
  if (!d[k]) d[k] = { t:o.t, ref:o.ref || "", text:o.text, at: Date.now(), done:0 };
  save();
  return k;
}
function ptaskList(){
  var d = ptaskAll();
  return Object.keys(d).map(function(k){ return Object.assign({ key:k }, d[k]); })
    .sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
}
function ptaskPending(){ return ptaskList().filter(function(x){ return !x.done; }); }
function ptaskMarkDone(key){
  var d = ptaskAll();
  if (d[key]){ d[key].done = Date.now(); save(); }
}
/* сколько заданий взрослый выдал за последние семь дней */
function ptaskWeekCount(){
  var since = Date.now() - 7 * 864e5;
  return ptaskList().filter(function(x){ return (x.at || 0) >= since; }).length;
}

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
  if (!S.log[id]) S.log[id] = { attempts:0, hints:0, shown:0, runs:0, timeMs:0, pauseMs:0,
                                first:null, last:null, solvedAt:null, stars:0, bestSteps:0 };
  if (typeof S.log[id].pauseMs !== "number") S.log[id].pauseMs = 0;
  return S.log[id];
}
function touchLog(id){
  var g = logOf(id), now = Date.now();
  if (!g.first) g.first = now;
  g.last = now; save();
}

/* ================= честное время =================
   Раньше здесь стоял простой интервал: каждые 10 секунд прибавить 10 секунд,
   пока открыт экран урока. Ребёнок, ушедший ужинать с открытой вкладкой,
   «занимался» всё это время. Пока цифра жила в панели наставника, это была
   мелкая неточность. С того дня, как время уезжает взрослому в отчёт, она
   становится ложью, которая обесценивает весь отчёт целиком — поэтому счёт
   переписан (разбор: docs/zanyatie-i-vzroslyj.md § 8.2).

   Тик по-прежнему десятисекундный: от этого зависит формат хранения и
   слияние двух устройств. Изменилось, ЧТО считается активной секундой:
     — вкладка видима (document.visibilityState) и окно в фокусе;
     — последнее касание было не позже IDLE_MS назад.
   Всё остальное время считается ПАУЗОЙ и хранится отдельно. Пауза не
   преступление и не прячется: «28 минут работы, 12 минут перерыв» — это
   нормальное занятие, а не провал.

   Порог в шесть минут выбран по замеру самого курса: урок целиком занимает
   5–8 минут, значит шесть минут без единого касания — это уже не чтение
   карточки, а отсутствие. */
var IDLE_MS = 6 * 60 * 1000;
var actAt = Date.now();          /* когда последний раз касались страницы */
var winFocused = true;
var curLessonId = null;          /* какой урок открыт прямо сейчас */
var actTick = null;

function actMark(){ actAt = Date.now(); }
/* Страница считается работающей, а не открытой: видима, в фокусе и её
   недавно касались. jsdom не умеет фокус — там считаем, что окно в фокусе. */
function pageActive(){
  try { if (document.visibilityState === "hidden") return false; } catch(e){}
  if (!winFocused) return false;
  return (Date.now() - actAt) < IDLE_MS;
}
/* карта активности: на день массив из 24 ячеек, в ячейке СЕКУНДЫ работы */
function hoursRow(key){
  S.hours = S.hours || {};
  var row = S.hours[key];
  if (!Array.isArray(row) || row.length !== 24){
    row = [];
    for (var i = 0; i < 24; i++) row.push(0);
    S.hours[key] = row;
  }
  return row;
}
function hoursAdd(sec, when){
  var d = when || new Date();
  var row = hoursRow(dayKey(d));
  row[d.getHours()] += sec;
  pruneHours();
}
/* взрослому нужны последние недели, а не два года */
function pruneHours(){
  var keys = Object.keys(S.hours || {});
  if (keys.length <= 200) return;
  keys.sort();
  keys.slice(0, keys.length - 200).forEach(function(k){ delete S.hours[k]; });
}
/* один тик: раздать десять секунд тем, кто их заслужил */
function tickOnce(){
  var live = pageActive();
  /* перерыв — это пауза по определению, даже если ребёнок остался у экрана */
  var openZ = zanOpen();
  if (openZ && zanOnBreak(openZ)) live = false;
  var g = curLessonId ? logOf(curLessonId) : null;
  if (live){
    if (g){ g.timeMs += 10000; g.last = Date.now(); }
    hoursAdd(10);
    zanTick(10, true);
  } else {
    if (g) g.pauseMs += 10000;
    zanTick(10, false);
  }
  if (live || g) save();
}
function actStart(){
  if (actTick) return;
  actTick = setInterval(tickOnce, 10000);
  try {
    ["keydown","pointerdown","touchstart","wheel","mousemove","scroll"].forEach(function(ev){
      document.addEventListener(ev, actMark, { passive:true });
    });
    document.addEventListener("visibilitychange", actMark);
    window.addEventListener("focus", function(){ winFocused = true; actMark(); });
    window.addEventListener("blur", function(){ winFocused = false; });
  } catch(e){}
}
/* startTimer/stopTimer остались под своими именами: их зовут заход на урок и
   enterScreen. Теперь они не заводят свой интервал, а лишь говорят общему
   счётчику, какой урок открыт. */
function startTimer(id){ curLessonId = id; actMark(); }
function stopTimer(){ curLessonId = null; }
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

/* ============================================================
   РАБОТА НАД ОШИБКАМИ: интервальный повтор
   Тут не «нерешённое» — нерешённых уроков в этом списке не бывает.
   Тут пройденное, которое далось дорого: с подсказками, с показанным
   решением, с десятком попыток или не на три звезды. Такой урок
   возвращается через два дня, потом через неделю, потом через три —
   и после третьего чистого повтора уходит совсем («закреплено»).
   Сбился на повторе — счётчик обнуляется, урок вернётся послезавтра.

   Данные для этого копились с самого начала (S.log: attempts, hints,
   shown, solvedAt) — но никуда не шли. Новое здесь только одно:
   S.review = { "id-урока": { n: сколько раз закреплён, at: когда } }.
   ============================================================ */
var REVIEW_STEPS = [2, 7, 21];      /* через сколько дней звать на повтор */
var REVIEW_HARD = 3;                /* с этого числа попыток урок считается трудным */
var REVIEW_BADGE_AT = 5;            /* столько закреплённых — бейдж */

function reviewState(id){
  S.review = S.review || {};
  var r = S.review[id];
  if (!r || typeof r !== "object"){ r = { n:0, at:0 }; S.review[id] = r; }
  if (typeof r.n !== "number") r.n = 0;
  if (typeof r.at !== "number") r.at = 0;
  return r;
}
/* закреплён — значит прошёл все промежутки чисто и из списка ушёл */
function reviewGraduated(id){
  var r = (S.review || {})[id];
  return !!r && r.n >= REVIEW_STEPS.length;
}
/* почему урок стоит повторить — фразой для ребёнка, или null.
   Порядок веток от дорогого к дешёвому: сначала называем главную причину. */
function reviewWhy(id){
  if (!solved(id)) return null;
  var g = S.log[id] || {}, st = starsOf(id);
  if (g.shown) return "решение было показано";
  if ((g.hints || 0) > 0)
    return (g.hints === 1 ? "нужна была подсказка" : "подсказок: " + g.hints);
  if ((g.attempts || 0) >= REVIEW_HARD) return "попыток: " + g.attempts;
  if (st < 3) return "не с первого раза";
  return null;
}
/* когда урок снова попросится на повтор */
function reviewDueAt(id){
  var r = reviewState(id), g = S.log[id] || {};
  var base = r.at || g.solvedAt || g.last || 0;
  var days = REVIEW_STEPS[Math.min(r.n, REVIEW_STEPS.length - 1)];
  return base + days * 864e5;
}
/* все уроки, за которыми ещё числится долг: созревшие впереди, дальше по сроку */
function reviewList(){
  var out = [];
  CURRICULUM.forEach(function(w){
    w.lessons.forEach(function(l){
      if (!solved(l.id) || reviewGraduated(l.id)) return;
      var why = reviewWhy(l.id);
      if (!why && !(S.review || {})[l.id]) return;
      out.push({ lesson:l, why: why || "закрепляем", at: reviewDueAt(l.id) });
    });
  });
  out.sort(function(a, b){ return a.at - b.at; });
  return out;
}
function reviewDue(){
  var now = Date.now();
  return reviewList().filter(function(x){ return x.at <= now; });
}
function reviewGraduatedCount(){
  var n = 0;
  Object.keys(S.review || {}).forEach(function(k){ if (reviewGraduated(k)) n++; });
  return n;
}
/* итог повтора. Чисто — шаг вперёд, со спотыканием — счётчик в ноль.
   Первое прохождение урока сюда тоже приходит: если оно было чистым,
   записи не заводим вовсе, чтобы S.review не распухал пустышками. */
function reviewAfterLesson(id){
  var had = (S.review || {})[id];
  if (!had && !reviewWhy(id)) return;
  var r = reviewState(id);
  var clean = session.attempts === 1 && !session.hints && !session.shown;
  r.n = clean ? Math.min(r.n + 1, REVIEW_STEPS.length) : 0;
  r.at = Date.now();
  if (reviewGraduatedCount() >= REVIEW_BADGE_AT) award("again");
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
/* Проверяем серию в двух местах: когда день засчитан здесь (markActiveToday)
   и когда прогресс приехал с другого устройства (applyProgress). Второе не
   лишнее: занимались на планшете, открыли на ноутбуке — бейдж должен быть
   уже здесь, а не ждать следующего занятия. */
function awardStreak(){
  var n = streakCurrent();
  STREAK_BADGES.forEach(function(b){ if (n >= b.days) award(b.id); });
}
function toast(id){
  var b = BADGES.filter(function(x){ return x.id === id; })[0];
  if (!b) return;
  var el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = '<span class="em">' + b.em + '</span><span><b>Новый бейдж</b><span>' + b.name + '</span></span>';
  document.body.appendChild(el);
  sfx("badge");
  setTimeout(function(){ el.classList.add("out"); }, 3000);
  setTimeout(function(){ el.remove(); }, 3600);
}
/* Какая вкладка наверху светится. Пишется в enterScreen (и вручную там, где
   экран заходит через claimScreen — на уроке и в проекте), читается здесь. */
var curTab = "home";
/* ================= дорога назад, одна на все экраны =================
   Кнопка «Назад» в верхней панели. Заводится не ради красоты: раньше уйти с
   экрана можно было только кнопкой в самом низу страницы — то есть за
   экраном ровно тогда, когда человек сидит в редакторе или дочитал длинный
   экран до конца (грабля 63). Хлебные крошки её не заменяют: они выглядят
   подписью, а не кнопкой, и на них не нажимают.

   Куда ведёт — решает КАРТА МЕСТ, а не история браузера. История в
   одностраничном приложении врёт (мы не пишем в неё каждый экран), а «на
   уровень вверх» предсказуемо: то же самое, куда ведёт кнопка внизу страницы.

   ⚠️ Два места ведут не «вверх», а по смыслу: урок и разминка во время
   занятия возвращают В ЗАНЯТИЕ. Иначе кнопка уносит мимо плана — ровно то,
   от чего в 1.41.0 отказалось «Дальше →» в окне победы. */
function backTarget(){
  var open = (typeof zanOpen === "function") ? zanOpen() : null;
  switch (curPlace){
    case "home": case "register": return null;

    case "lesson": {
      if (open) return { label:"К занятию", go: screenZan };
      var l = curLessonId ? CURRICULUM.byId(curLessonId) : null;
      return l ? { label:"К урокам", go: function(){ screenWorld(l.world); } }
               : { label:"На главную", go: screenWorlds };
    }
    case "warmup":
      return open ? { label:"К занятию", go: screenZan }
                  : { label:"К разминкам", go: screenWarmups };
    case "world": case "review": case "today": case "folio": case "mytasks":
    case "works": case "work": case "solved": case "assign": case "train":
    case "guide": case "account": case "admin": case "adult":
      return { label:"На главную", go: screenWorlds };

    case "warm": case "games": case "sand": case "viz": case "ai": case "specs":
      return { label:"К тренировкам", go: screenTrain };
    case "spec":     return { label:"Ко всем работам", go: screenSpecs };
    case "game":     return { label:"К играм", go: screenGames };
    case "ailesson": return { label:"К заданиям", go: screenAILab };

    case "project": case "projectdone": {
      var p = (typeof session === "object" && session && session.project)
        ? projectById(session.project) : null;
      if (p && p.world) return { label:"К миру", go: function(){ screenWorld(p.world); } };
      return { label:"На главную", go: screenWorlds };
    }
    case "zan":       return { label:"На «Сегодня»", go: screenToday };
    case "shop":      return { label:"В портфолио", go: screenFolio };
    case "friendtask":return { label:"К заданиям", go: function(){ screenMyTasks(); } };
    case "trace":     return { label:"В кабинет", go: screenAdult };
    case "group":     return { label:"В панель", go: function(){ location.hash = "#admin"; screenAdmin(); } };
    default:          return { label:"На главную", go: screenWorlds };
  }
}
/* Кнопка перерисовывается на каждой смене экрана — вместе со всей панелью. */
function syncBack(){
  var b = document.getElementById("btn-back");
  if (!b) return;
  var t = backTarget();
  b.hidden = !t;
  if (!t) return;
  var lbl = b.querySelector(".lbl");
  if (lbl) lbl.textContent = t.label;
  b.title = "Назад: " + t.label;
  b.onclick = function(){ t.go(); };
}

function refreshTop(){
  syncBack();
  document.querySelectorAll(".tabs .tab").forEach(function(b){
    b.classList.toggle("on", b.getAttribute("data-tab") === curTab);
  });
  /* Ранг, полоска и число опыта — три вида одного и того же. Число в панели
     показываем только когда для него есть место (см. #xptext в стилях), но
     писать его продолжаем всегда: оно висит подсказкой на самой полоске и
     нужно тестам как единственный видимый счётчик опыта. */
  var rank = document.getElementById("rank");
  rank.textContent = rankName();
  rank.title = "Ранг «" + rankName() + "», опыт " + S.xp + " XP";
  document.getElementById("xptext").textContent = S.xp + " XP";
  document.getElementById("xpfill").style.width = Math.min(100, S.xp / nextRankXp() * 100) + "%";
  var done = Object.keys(S.stars).length;
  /* На телефоне из счётчика остаются только звёзды: доля пройденных уроков
     и так стоит крупно на Главном, а панель обязана уложиться в две строки. */
  document.getElementById("stars").innerHTML = "★ " + totalStars() +
    '<span class="starsmall"> · ' + done + "/" + CURRICULUM.total + '</span>';
  var bt = document.getElementById("btn-today");
  if (bt){
    var s = streakCurrent();
    var due = studyDue();
    /* Слово «Сегодня» лежит в отдельном span: на узком экране его прячет CSS,
       а значок остаётся. Через textContent так нельзя — он стёр бы span. */
    bt.innerHTML = (due ? "🔔 " : "🔥 ") + (s > 0 ? s : '<span class="lbl">Сегодня</span>');
    /* «горит», если сегодня уже занимались; «due» — учебный день, ещё не занимались */
    bt.classList.toggle("lit", activeOn(dayKey()));
    bt.classList.toggle("due", due);
    bt.title = due
      ? "Сегодня учебный день — не пропусти занятие"
      : (s > 0
          ? (s + " " + plural(s, "день", "дня", "дней") + " подряд — открой задачу дня")
          : "Задача дня и дни подряд");
  }
  var ba = document.getElementById("btn-again");
  if (ba){
    var n = reviewDue().length;
    ba.textContent = n ? ("🔁 Повторить · " + n) : "🔁 Повторить";
    ba.classList.toggle("due", n > 0);
    ba.title = n
      ? (n + " " + plural(n, "урок ждёт", "урока ждут", "уроков ждут") + " повтора")
      : "Уроки, которые дались тяжело, вернутся сюда сами";
  }
  var bw = document.getElementById("btn-who");
  if (bw){
    /* Имя раньше стояло прямо на кнопке, и панель из-за него переносилась на
       вторую строку у длинных имён. Имя видно на самом экране профиля,
       а здесь достаточно значка и подсказки. */
    var nm = myName();
    bw.textContent = "👤";
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

/* наименьшее из двух положительных; ноль и пусто значат «нет значения» */
function minPos(a, b){
  a = +a || 0; b = +b || 0;
  if (!a) return b || 0;
  if (!b) return a;
  return Math.min(a, b);
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
  /* принятые работы — множество ключей, как разминки: сделанное на любом
     устройстве остаётся сделанным */
  out.specs = mergeSet(a.specs, b.specs);

  /* какие игры вообще открывали: объединяем, как разминки */
  out.gamesPlayed = mergeSet(a.gamesPlayed, b.gamesPlayed);

  /* даты выдачи сертификатов за разделы вне сотни. Здесь mergeSet не годится:
     он схлопывает значение в единицу, а единица как метка времени — это
     1 января 1970 года на распечатанном листе. Берём САМУЮ РАННЮЮ: раздел
     закончен тогда, когда закончен, а не когда об этом узнало второе
     устройство. */
  out.certAt = {};
  Object.keys(mergeSet(a.certAt, b.certAt)).forEach(function(k){
    var t = minPos((a.certAt || {})[k], (b.certAt || {})[k]);
    if (t) out.certAt[k] = t;
  });

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

  /* ===== карта активности по часам =====
     На день — массив из 24 ячеек, в ячейке СЕКУНДЫ работы в этот час.
     Слияние — МАКСИМУМ по каждой ячейке, а не сумма: после первого же обмена
     обе копии одинаковы, и сложение удваивало бы час при каждом следующем
     (та же причина, что у попыток и времени в журнале). */
  out.hours = {};
  Object.keys(mergeSet(a.hours, b.hours)).forEach(function(k){
    var x = (a.hours || {})[k] || [], y = (b.hours || {})[k] || [], row = [];
    for (var h = 0; h < 24; h++) row.push(maxN(x[h], y[h]));
    out.hours[k] = row;
  });

  /* ===== занятия =====
     Ключ — «ГГГГ-ММ-ДД#номер», значение — одна запись сеанса. Объединяем по
     ключу, а при совпадении берём ту, где сделано больше: занятие, доведённое
     до конца на одном устройстве, не должно откатываться незаконченной копией
     с другого. */
  out.zan = {};
  Object.keys(mergeSet(a.zan, b.zan)).forEach(function(k){
    var x = (a.zan || {})[k], y = (b.zan || {})[k];
    if (!x || !y){ out.zan[k] = x || y; return; }
    var xw = (x.done || []).length + (x.end ? 100 : 0);
    var yw = (y.done || []).length + (y.end ? 100 : 0);
    out.zan[k] = yw > xw ? y : x;
  });

  /* задания от взрослого: объединяем, «сделано» побеждает «не сделано» */
  out.ptasks = {};
  Object.keys(mergeSet(a.ptasks, b.ptasks)).forEach(function(k){
    var x = (a.ptasks || {})[k] || {}, y = (b.ptasks || {})[k] || {};
    var base = (y.at || 0) > (x.at || 0) ? y : x;
    out.ptasks[k] = { t: base.t || x.t || y.t, ref: base.ref || x.ref || y.ref,
                      text: base.text || x.text || y.text, at: maxN(x.at, y.at),
                      done: maxN(x.done, y.done) };
  });

  /* код в песочнице сложить нельзя — берём из более свежего сохранения */
  var fresher = (b.savedAt || 0) > (a.savedAt || 0) ? b : a;
  var older = fresher === b ? a : b;
  out.sandbox = fresher.sandbox || older.sandbox || null;

  /* расписание — настройка, а не результат: берём из более свежего сохранения,
     иначе снятый на одном устройстве день возвращался бы с другого */
  out.schedule = fresher.schedule || older.schedule || { days:[] };

  /* рамка занятий — тоже настройка, и ставит её взрослый. Та же логика, что у
     расписания: свежее сохранение побеждает, объединение вернуло бы снятый день. */
  out.frame = frameShape(fresher.frame && fresher.frame.setAt ? fresher.frame
                                                              : (older.frame || fresher.frame));

  /* имя ученика на сервер НЕ уходит (см. cloudSnapshot), но слияние всё равно
     обязано его сохранить: при обмене с сервером одна из сторон приходит без
     имени, и оно не должно затереть местное. Берём непустое из двух. */
  out.name = fresher.name || older.name || "";

  /* свои версии игр: по каждой игре это КОД, а код сложить нельзя — как
     песочница, берём из более свежего сохранения. Игра, которую правили
     только на одном устройстве, при этом не теряется. */
  out.games = {};
  Object.keys(mergeSet(a.games, b.games)).forEach(function(k){
    out.games[k] = (fresher.games || {})[k] || (older.games || {})[k] || null;
    if (!out.games[k]) delete out.games[k];
  });

  /* свои задания: по каждому это КОД плюс текст условия — сложить нельзя,
     берём из более свежего сохранения, как свои версии игр. Задание,
     составленное только на одном устройстве, при этом не теряется. */
  out.mytasks = {};
  Object.keys(mergeSet(a.mytasks, b.mytasks)).forEach(function(k){
    out.mytasks[k] = (fresher.mytasks || {})[k] || (older.mytasks || {})[k] || null;
    if (!out.mytasks[k]) delete out.mytasks[k];
  });
  /* пройденные чужие задания — множество ключей, объединяем: пройденное на
     любом устройстве остаётся пройденным (и опыт за него не начислится второй раз) */
  out.friendTasks = mergeSet(a.friendTasks, b.friendTasks);

  /* квитанции «твою задачу решили» — тоже накопление (грабля 73): решённое
     на одном устройстве не должно исчезать из-за занятия на другом */
  out.solved = {};
  Object.keys(mergeSet(a.solved, b.solved)).forEach(function(k){
    out.solved[k] = (fresher.solved || {})[k] || (older.solved || {})[k] || null;
    if (!out.solved[k]) delete out.solved[k];
  });

  /* бестиарий ошибок: по каждому типу берём БОЛЬШЕЕ, а не сумму — после
     первого же обмена обе копии одинаковы, и сложение удваивало бы встречи
     при каждом следующем (та же причина, что у попыток и времени в журнале). */
  out.errs = {};
  Object.keys(mergeSet(a.errs, b.errs)).forEach(function(k){
    var x = (a.errs || {})[k] || {}, y = (b.errs || {})[k] || {};
    out.errs[k] = { seen: maxN(x.seen, y.seen), beaten: maxN(x.beaten, y.beaten),
                    at: maxN(x.at, y.at) };
  });
  /* недособранное задание — одна запись, как песочница: свежее побеждает */
  out.mytaskDraft = fresher.mytaskDraft || older.mytaskDraft || null;

  /* галерея рисунков: по каждому это КОД, поэтому как свои версии игр —
     берём из более свежего сохранения, но рисунок, сделанный только на одном
     устройстве, не теряем */
  out.gallery = {};
  Object.keys(mergeSet(a.gallery, b.gallery)).forEach(function(k){
    out.gallery[k] = (fresher.gallery || {})[k] || (older.gallery || {})[k] || null;
    if (!out.gallery[k]) delete out.gallery[k];
  });

  /* мастерская. Деталь — это КОД, и она НАКОПЛЕНИЕ: то, что сделано на одном
     устройстве, не должно пропадать из-за занятия на другом. Поэтому здесь
     объединение по ключу, а ключ — это хеш самой детали: одинаковые детали
     с двух устройств склеиваются сами и дубля не дают. Верстак — одна
     программа, и он как песочница: побеждает свежее сохранение. */
  out.parts = {};
  Object.keys(mergeSet(a.parts, b.parts)).forEach(function(k){
    out.parts[k] = (fresher.parts || {})[k] || (older.parts || {})[k] || null;
    if (!out.parts[k]) delete out.parts[k];
  });
  out.builds = {};
  Object.keys(mergeSet(a.builds, b.builds)).forEach(function(k){
    out.builds[k] = (fresher.builds || {})[k] || (older.builds || {})[k] || null;
    if (!out.builds[k]) delete out.builds[k];
  });
  out.shop = fresher.shop || older.shop || null;

  /* черновики уроков: это КОД, и сложить две версии нельзя — берём из более
     свежего сохранения, как песочницу и как свои версии игр. Урок, который
     правили только на одном устройстве, при этом не теряется. */
  out.drafts = {};
  Object.keys(mergeSet(a.drafts, b.drafts)).forEach(function(k){
    out.drafts[k] = (fresher.drafts || {})[k] || (older.drafts || {})[k] || null;
    if (!out.drafts[k]) delete out.drafts[k];
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
      /* до какого шага напарник уже подставлял свою редакцию: берём дальний,
         иначе после обмена она подставилась бы второй раз и затёрла правки */
      aiAt: maxN(pa.aiAt, pb.aiAt),
      /* дата сборки — РАННЯЯ из двух: проект собран тогда, когда собран
         впервые, а не когда об этом узнало второе устройство */
      doneAt: minPos(pa.doneAt, pb.doneAt),
      code: pf.code || po.code || null
    };
  });

  /* повторы: n — это «сколько раз закрепил», результат, поэтому берём больший.
     Дата последнего повтора тоже большая: раньше срока звать незачем, а вот
     звать повторно то, что уже закреплено на другом устройстве, — обидно. */
  out.review = {};
  var rids = {};
  Object.keys(a.review || {}).forEach(function(k){ rids[k] = 1; });
  Object.keys(b.review || {}).forEach(function(k){ rids[k] = 1; });
  Object.keys(rids).forEach(function(k){
    var ra = (a.review || {})[k] || {}, rb = (b.review || {})[k] || {};
    out.review[k] = { n: maxN(ra.n, rb.n), at: maxN(ra.at, rb.at) };
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
      /* время пауз — рядом со временем работы и по тому же правилу (максимум).
         Пауза не результат, но и не преступление: она должна быть видна. */
      pauseMs:  maxN(x.pauseMs, y.pauseMs),
      first:    (x.first && y.first) ? Math.min(x.first, y.first) : (x.first || y.first || null),
      last:     maxN(x.last, y.last) || null,
      solvedAt: maxN(x.solvedAt, y.solvedAt) || null,
      stars:    maxN(x.stars, y.stars),
      /* рекорд по шагам — единственное поле журнала, где лучше МЕНЬШЕ.
         Ноль значит «рекорда нет», поэтому он не должен победить настоящий. */
      bestSteps: minPos(x.bestSteps, y.bestSteps),
      /* цель по шагам взята — это результат, и на любом устройстве он остаётся */
      lean:     maxN(x.lean, y.lean),
      /* Запись авторства — свидетельство о ПЕРВОЙ сдаче, поэтому при слиянии
         побеждает ранняя, а не свежая. Без этой строки поле молча терялось
         бы на каждой синхронизации: слияние собирает запись журнала заново,
         поле за полем. */
      tr: (x.tr && y.tr) ? ((x.tr.at || 0) <= (y.tr.at || 0) ? x.tr : y.tr) : (x.tr || y.tr || null)
    };
  });

  out.savedAt = maxN(a.savedAt, b.savedAt);
  return out;
}

/* то, что уходит на сервер: всё, кроме настроек устройства и ИМЕНИ РЕБЁНКА.
   Имя не отправляется намеренно. Пока на сервере лежат только код входа и
   результаты, ребёнок в нашей базе неопознаваем — и «мы не храним о ребёнке
   ничего» остаётся правдой. Стоит положить туда имя рядом с адресом взрослого
   (а он появится вместе с кабинетом и оплатой) — и появляется «ребёнок клиента
   такого-то», то есть категория «несовершеннолетние» со всеми последствиями.
   Разбор: docs/zanyatie-i-vzroslyj.md §§ 13–14.
   Имя при этом не теряется: оно живёт в localStorage этого браузера, а при
   слиянии mergeProgress берёт непустое из двух — с сервера приходит пустое,
   поэтому местное остаётся. */
var CLOUD_SKIP = ["admin", "name"];
/* Снимок для ОТПРАВКИ: без настроек устройства и без имени ребёнка. */
function cloudSnapshot(){
  var o = {};
  Object.keys(S).forEach(function(k){ if (CLOUD_SKIP.indexOf(k) < 0) o[k] = S[k]; });
  return JSON.parse(JSON.stringify(o));
}
/* Снимок для СЛИЯНИЯ у себя: имя остаётся. Разделение появилось вместе с
   решением не отправлять имя: слияние без него затирало бы местное имя пустым
   при каждом обмене с сервером (обе стороны безымянны — значит и результат). */
function localSnapshot(){
  var o = {};
  Object.keys(S).forEach(function(k){ if (k !== "admin") o[k] = S[k]; });
  return JSON.parse(JSON.stringify(o));
}

function applyProgress(data){
  var merged = mergeProgress(localSnapshot(), data);
  Object.keys(merged).forEach(function(k){ S[k] = merged[k]; });
  saveLocal();
  awardStreak();     /* серия могла дорасти на другом устройстве */
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
    var before = JSON.stringify(localSnapshot());
    applyProgress(res.data);
    return JSON.stringify(localSnapshot()) !== before;
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
/* Текст задания без разметки — для строки в одну линию над редактором.
   Теги вырезаем, а не экранируем: показать ребёнку «<code>» нельзя. */
function stripTags(s){
  return esc(String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}
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
/* Тройные кавычки вынесены в константы: их приходится искать в коде
   ученика, а внутри строкового литерала в этом файле они читались бы
   отвратительно. */
var TRIPLE_D = '"' + '""';
var TRIPLE_S = "'" + "''";
/* Подсветка с приписками значений (см. «Значения прямо в редакторе»).
   Без приписок код подсвечивается ОДНИМ куском — так строка в тройных
   кавычках, растянутая на пять строк, красится целиком. С приписками
   приходится идти построчно, и такая строка распалась бы на куски: поэтому
   код с `"""` приписок не получает вовсе (это решает watchCompute). */
function hlWatched(code, watch, cols){
  if (!watch) return hl(code);
  return code.split("\n").map(function(ln, i){
    var w = watch[i + 1];
    /* Влезает ли приписка в строку редактора? Если нет — молчим. Иначе
       подсветка перенесла бы строку, а текстовое поле под ней нет: код
       разъехался бы с курсором и выделением. cols = 0 значит «ширину
       измерить не удалось» — тогда работает грубая оценка WATCH_LINE_MAX,
       на которой приписка и так ставится только у коротких строк. */
    if (w && cols && ln.length + w.length + 5 > cols) w = null;
    return hl(ln) + (w ? '<span class="wv">' + esc(w) + '</span>' : "");
  }).join("\n");
}

/* ================= холст ================= */
/* Цвет доски берём из стилей, а не пишем числом второй раз: раньше в CSS
   стоял один цвет, а холст заливался другим — до первого рисунка доска была
   одного цвета, после запуска становилась другого. Один источник правды. */
function boardColor(){
  try {
    var v = getComputedStyle(document.documentElement).getPropertyValue("--board");
    if (v && v.trim()) return v.trim();
  } catch(e){}
  return "#070a16";
}
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
  ctx.fillStyle = boardColor(); ctx.fillRect(0,0,W,H);
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
  LookupError:"Ничего не найдено", Exception:"Ошибка", BaseException:"Ошибка",
  /* Эти пять движок выбрасывает, а названия им забыли дать — и ребёнок видел
     английское имя вместо человеческого. Нашлось проверкой бестиария:
     она требует, чтобы у каждого зверя было имя по-русски. */
  FileNotFoundError:"Файл не найден", UnboundLocalError:"Имя ещё без значения",
  OSError:"Так с файлом нельзя", JSONDecodeError:"Это не похоже на JSON",
  EOFError:"Ответы для input() кончились"
};
function errHTML(e){
  return '<b>' + (KIND_RU[e.kind] || e.kind) + (e.line ? ' — строка ' + e.line : '') + '</b>' + esc(e.msg);
}

/* ================= бестиарий ошибок =================
   Движок и так объясняет каждое падение человеческим языком, но объяснение
   живёт одно мгновение: прочитал, починил, забыл. Красный текст при этом
   остаётся наказанием, хотя ошибка — самая обычная часть работы.

   Здесь ошибка становится добычей. Каждый тип — карточка со тремя
   состояниями: не встречал → встретил → победил. «Победил» ставится не за
   встречу, а за ПОЧИНКУ: та же программа после правки запустилась без
   ошибок. Показанное решение победу не даёт — чинил тогда не ребёнок.

   Контента писать почти не пришлось: названия уже были в KIND_RU, а сам
   разбор — в сообщениях движка. Здесь только «что это значит» и «как чинить»
   одной строкой каждое.

   Чего в бестиарии нет намеренно: `NotSupported` («здесь так нельзя») — это
   ограничение тренажёра, а не ошибка ребёнка, и хвастаться победой над ним
   нечестно.
   ============================================================ */
var ERR_BEASTS = [
  { kind:"NameError", em:"👻",
    what:"Имя, которого нет: опечатка или переменную ещё не создали.",
    how:"Сверь написание с той строкой, где переменную создавали. И помни: текст без кавычек Python принимает за имя." },
  { kind:"TypeError", em:"⚗️",
    what:"Действие между несовместимыми типами — например, строка плюс число.",
    how:"Реши, что здесь нужно: число превратить в текст через str(...) или текст в число через int(...)." },
  { kind:"SyntaxError", em:"🧩",
    what:"Python не понял саму запись: пропущена скобка, кавычка или двоеточие.",
    how:"Смотри на строку из сообщения и на предыдущую: чаще всего не хватает закрывающей скобки или двоеточия в конце if, for и def." },
  { kind:"IndentationError", em:"📐",
    what:"Отступы не складываются в блок: Python по ним понимает, что внутри чего.",
    how:"Все строки внутри if, for или def сдвинуты на четыре пробела правее заголовка — и одинаково." },
  { kind:"IndexError", em:"🎯",
    what:"Просишь элемент по номеру, которого в списке нет.",
    how:"Последний номер — это len(список) - 1, а не len(список). В цикле надёжнее range(len(список))." },
  { kind:"KeyError", em:"🔑",
    what:"В словаре нет такого ключа.",
    how:"Либо проверь заранее — if ключ in словарь, либо бери через словарь.get(ключ, «по умолчанию»)." },
  { kind:"ValueError", em:"🧪",
    what:"Тип подходит, а значение нет: int(\"пять\") — текст, но не число.",
    how:"Проверь, что приходит на вход: пробелы, запятая вместо точки, пустая строка." },
  { kind:"ZeroDivisionError", em:"➗",
    what:"Делитель оказался нулём.",
    how:"Проверь делитель до деления. Чаще всего это длина пустого списка — тогда нечего и делить." },
  { kind:"AttributeError", em:"🧰",
    what:"У этого типа такой команды нет: например, .append у строки.",
    how:"Открой шпаргалку и посмотри, что умеет именно этот тип. Строку меняют не на месте, а через новое значение." },
  { kind:"RuntimeError", em:"🌀",
    what:"Программа не остановилась сама — движок прервал её.",
    how:"В while должно меняться то, что стоит в условии. Проверь, что счётчик растёт (или список уменьшается)." },
  { kind:"RecursionError", em:"🪆",
    what:"Функция звала себя без конца.",
    how:"Нужен случай, который возвращает ответ БЕЗ нового вызова, — и каждый вызов должен к нему приближаться." },
  { kind:"FileNotFoundError", em:"📂",
    what:"Файла с таким именем на диске нет.",
    how:"Сверь имя вместе с расширением. Файлы урока показаны в панели «файлы на диске»." },
  { kind:"ImportError", em:"📦",
    what:"Не удалось подключить модуль или взять из него имя.",
    how:"Сверь имя модуля и имя, которое из него берёшь. В тренажёре живут не все модули настоящего Python." }
];
var BEAST_BADGE_AT = 6;   /* столько разных побеждённых — и бейдж */

function errsAll(){ S.errs = S.errs || {}; return S.errs; }
function beastByKind(kind){
  for (var i = 0; i < ERR_BEASTS.length; i++)
    if (ERR_BEASTS[i].kind === kind) return ERR_BEASTS[i];
  return null;
}
/* Встреча: пишем всегда, даже незнакомый тип. Показываем только тех, кто в
   ERR_BEASTS, но копить полезно всё — по этому списку потом видно, чего
   в бестиарии не хватает. */
function errSeen(kind){
  if (!kind) return;
  var e = errsAll();
  var r = e[kind] || (e[kind] = { seen:0, beaten:0, at:0 });
  r.seen = (r.seen || 0) + 1;
  r.at = Date.now();
  save();
}
function errBeaten(kind){
  if (!kind) return;
  var e = errsAll();
  var r = e[kind] || (e[kind] = { seen:1, beaten:0, at:0 });
  if (!r.beaten){
    r.beaten = 1; r.at = Date.now();
    save();
    if (beastsBeaten() >= BEAST_BADGE_AT) award("beasts");
  }
}
function beastsBeaten(){
  var e = errsAll(), n = 0;
  ERR_BEASTS.forEach(function(b){ if (e[b.kind] && e[b.kind].beaten) n++; });
  return n;
}
function beastsMet(){
  var e = errsAll(), n = 0;
  ERR_BEASTS.forEach(function(b){ if (e[b.kind] && e[b.kind].seen) n++; });
  return n;
}
/* Разметка бестиария. Живёт на экране «Повторить», а не отдельным разделом:
   этот экран и так про то, что далось тяжело, а верхняя панель переполнена. */
function beastsHTML(){
  var e = errsAll();
  var beaten = beastsBeaten(), met = beastsMet();
  var h = '<div class="sect"><h2>Бестиарий ошибок</h2><div class="line"></div>' +
    '<span class="cnt">' + beaten + ' из ' + ERR_BEASTS.length + '</span></div>' +
    '<p class="dim">Каждая ошибка — зверь. Встретил — зверь появился в списке; ' +
    'починил программу сам — зверь побеждён. Показанное решение не считается: ' +
    'чинил тогда не ты.' +
    (beaten < BEAST_BADGE_AT
      ? ' До бейджа «Укротитель» осталось ' + (BEAST_BADGE_AT - beaten) + '.'
      : ' Бейдж «Укротитель» уже твой.') +
    '</p><div class="beasts">';
  ERR_BEASTS.forEach(function(b){
    var r = e[b.kind] || null;
    var state = (r && r.beaten) ? "won" : (r && r.seen ? "met" : "");
    var tag = (r && r.beaten) ? "побеждён ✓" : (r && r.seen ? "встречался" : "не встречался");
    h += '<div class="beast ' + state + '">' +
      '<span class="bem">' + b.em + '</span>' +
      '<span class="bbody"><b>' + esc(KIND_RU[b.kind] || b.kind) + '</b>' +
      '<span class="bkind">' + esc(b.kind) + '</span>' +
      '<span class="bwhat">' + esc(b.what) + '</span>' +
      '<span class="bhow">Как чинить: ' + esc(b.how) + '</span></span>' +
      '<span class="bstat">' + tag +
      (r && r.seen > 1 ? '<i>встреч: ' + r.seen + '</i>' : '') + '</span></div>';
  });
  h += '</div>';
  if (!met)
    h += '<div class="note"><b>Пока чисто</b>Ни одной ошибки не встречалось. ' +
         'Это ненадолго: ошибки — обычная часть работы, и каждая здесь объяснена заранее.</div>';
  return h;
}

/* ================= редактор ================= */
/* ===== панель символов: только для телефона =====
   На мобильной клавиатуре двоеточие, кавычки и подчёркивание лежат на втором
   и третьем экране, а отступ вообще негде взять — четыре пробела набирают
   четырьмя нажатиями. Из-за этого писать код с телефона было почти нельзя,
   хотя подросток именно там и живёт. Панель прячется на широких экранах
   (см. @media в стилях): за настоящей клавиатурой она только мешает.

   Скобки и кавычки вставляются ПАРОЙ, а курсор становится внутрь: это то,
   что нужно в девяти случаях из десяти, а лишний знак удалить проще, чем
   искать закрывающий. Пара пишется как "()", одиночный знак — как ":". */
var KEYBAR_KEYS = ["()", '""', ":", "[]", ",", "=", "_", ".", "#", "+", "-", "*", "%"];
var KEYBAR_TAB = "    ";
/* В атрибут пишем НОМЕР ключа, а не сам знак: среди знаков есть кавычки, а
   esc() экранирует только &, < и > — кавычка порвала бы разметку. Ту же
   грабку уже находили на форме «своего задания». */
var KEYBAR_HTML = '<div class="keybar">' +
  KEYBAR_KEYS.map(function(k, i){
    return '<button class="kbk" type="button" data-k="' + i + '">' + esc(k) + '</button>';
  }).join("") +
  '<button class="kbk wide" type="button" data-k="tab">⇥ отступ</button></div>';
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
    '</div></div>' + KEYBAR_HTML + '<div class="runbar"></div>';
  var ta = box.querySelector("textarea"), pre = box.querySelector("pre.hl"), gut = box.querySelector(".gutter");
  var fileList = files && files.length ? files.map(function(f){ return { name:f.name, code:f.code || "" }; })
                                       : [{ name:"main.py", code: initial || "" }];
  var active = 0;
  ta.value = fileList[0].code;
  /* Приписки значений: { номер строки: текст }. Держим в редакторе, потому что
     рисует их подсветка. Любая правка их стирает — устаревшее значение рядом
     с изменённой строкой было бы прямым врньём. */
  box._watch = null;
  /* Сколько знаков влезает в строку редактора. Ширину знака измеряем настоящим
     шрифтом один раз и запоминаем: шрифт моноширинный, поэтому одного замера
     хватает. Ноль значит «измерить не удалось» (редактор ещё не в документе
     или это тест без раскладки) — hlWatched в этом случае решает по длине. */
  function colsFit(){
    if (!box._charW){
      var probe = document.createElement("span");
      probe.textContent = "0123456789";
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
      pre.appendChild(probe);
      box._charW = probe.getBoundingClientRect().width / 10;
      probe.remove();
    }
    if (!box._charW) return 0;
    var w = pre.clientWidth - 30;          /* отступы слева и справа */
    return w > 0 ? Math.floor(w / box._charW) : 0;
  }
  function sync(){
    pre.innerHTML = hlWatched(ta.value, box._watch, box._watch ? colsFit() : 0) + "\n";
    ta.style.height = "auto";
    ta.style.height = Math.max(190, ta.scrollHeight) + "px";
    var n = ta.value.split("\n").length, g = "";
    for (var i = 1; i <= n; i++)
      g += '<i class="' + (i === box._errLine ? "err" : (i === box._curLine ? "cur" : "")) + '">' + i + '</i>';
    gut.innerHTML = g;
  }
  /* Вставка символа с панели. Пишем прямо в текстовое поле и сами двигаем
     курсор: setCode отправил бы его в конец программы, а человек в этот
     момент стоит посреди строки. */
  function insertKey(k){
    var pair = k.length === 2, ins = (k === "tab") ? KEYBAR_TAB : k;
    var a = ta.selectionStart, b = ta.selectionEnd;
    ta.value = ta.value.slice(0, a) + ins + ta.value.slice(b);
    var caret = a + (pair ? 1 : ins.length);   /* внутрь пары, иначе за знаком */
    fileList[active].code = ta.value;
    box._errLine = 0; box._curLine = 0; box._watch = null;
    traceTyped(ins.length);          /* панель символов — это тоже набор */
    sync();
    ta.focus();
    ta.setSelectionRange(caret, caret);
    if (box.onEdit) box.onEdit();
  }
  box.querySelector(".keybar").addEventListener("click", function(e){
    var b = e.target.closest(".kbk");
    if (!b) return;
    var k = b.getAttribute("data-k");
    insertKey(k === "tab" ? "tab" : KEYBAR_KEYS[+k]);
  });

  /* ===== запись работы: набрано или пришло готовым =====
     Первый из сигналов «печати авторства» (docs/foresight-2027.md § 3,
     docs/zanyatie-i-vzroslyj.md § 5). Считаем ровно то, что видим у себя на
     странице, и ничего сверх того.

       typed   знаков прибавилось набором с клавиатуры
       pasted  знаков пришло вставкой, которой НЕТ в материалах урока
       own     знаков пришло вставкой из самого урока (пример, заготовка,
               показанное решение) — это обычная работа, а не сигнал
       pastes  сколько раз вставляли
       edits   сколько было правок вообще
       jump    самая большая прибавка за одну правку

     ⚠️ Разделение pasted/own — не придирка, а условие честности. Ребёнок
     законно копирует пример объяснения кнопкой «→ В редактор» и руками; без
     этого разделения каждый второй урок выглядел бы «пришедшим готовым», и
     взрослый перестал бы верить записи. Материал урока кладёт сюда экран
     урока (box.knownText).

     Программная подстановка кода (setCode, setFiles, переключение файла) в
     счёт НЕ идёт: там пишет не ребёнок. Поэтому у неё свой сброс длины. */
  box.trace = { typed:0, pasted:0, own:0, pastes:0, edits:0, jump:0 };
  box.knownText = "";
  var traceLen = ta.value.length, pastedNow = null;
  function traceSynced(){ traceLen = ta.value.length; }
  function traceTyped(n){
    box.trace.edits++;
    if (n > 0){ box.trace.typed += n; if (n > box.trace.jump) box.trace.jump = n; }
    traceSynced();
  }
  ta.addEventListener("paste", function(e){
    var t = "";
    try { t = ((e.clipboardData || window.clipboardData).getData("text") || ""); } catch(err){}
    pastedNow = t;
  });

  /* onEdit — крючок для того, кто открыл редактор: экран урока вешает на него
     отложенное сохранение черновика. Программная подстановка кода (setCode,
     setFiles) его НЕ дёргает: там сохраняет тот, кто подставил. */
  box.onEdit = null;
  ta.addEventListener("input", function(){
    var len = ta.value.length, d = len - traceLen;
    traceLen = len;
    box.trace.edits++;
    if (d > box.trace.jump) box.trace.jump = d;
    if (pastedNow !== null){
      /* Длину берём из самой вставки, а не из прироста: вставка поверх
         выделенного куска даёт прирост меньше вставленного, а пришло всё
         равно столько, сколько вставили. */
      var n = pastedNow.length || Math.max(0, d);
      box.trace.pastes++;
      var chunk = pastedNow.replace(/^\s+|\s+$/g, "");
      if (chunk && box.knownText && box.knownText.indexOf(chunk) >= 0) box.trace.own += n;
      else box.trace.pasted += n;
      pastedNow = null;
    } else if (d > 0) box.trace.typed += d;
    box._errLine = 0; box._curLine = 0; box._watch = null; sync();
    if (box.onEdit) box.onEdit();
  });
  ta.addEventListener("keydown", function(e){
    if (e.key === "Tab"){
      e.preventDefault();
      var s = ta.selectionStart;
      ta.value = ta.value.slice(0,s) + "    " + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + 4; traceTyped(4); sync(); return;
    }
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey){
      var pos = ta.selectionStart, before = ta.value.slice(0,pos);
      var line = before.slice(before.lastIndexOf("\n") + 1);
      var ind = (line.match(/^[ ]*/) || [""])[0];
      if (/:\s*$/.test(line)) ind += "    ";
      e.preventDefault();
      ta.value = before + "\n" + ind + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = pos + 1 + ind.length;
      traceTyped(1 + ind.length); sync(); return;
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
    box._errLine = 0; box._curLine = 0; box._watch = null;
    box.querySelector(".lbl").textContent = fileList[i].name;
    box.querySelectorAll(".ftab").forEach(function(b, k){ b.className = "ftab" + (k === i ? " on" : ""); });
    traceSynced();
    sync();
  }
  if (many) box.querySelector(".ftabs").addEventListener("click", function(e){
    var b = e.target.closest(".ftab"); if (!b) return;
    openFile(+b.getAttribute("data-file"));
  });

  box.setLine = function(n){ box._curLine = n; box._errLine = 0; sync(); };
  box.setError = function(n){ box._errLine = n; box._curLine = 0; sync(); };
  box.setWatch = function(map){
    box._watch = (map && Object.keys(map).length) ? map : null;
    sync();
  };
  box.getCode = function(){ stash(); return fileList[0].code; };
  box.setCode = function(v){ ta.value = v; fileList[active].code = v; box._errLine = 0; box._curLine = 0; box._watch = null; traceSynced(); sync(); };
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
    box._errLine = 0; box._curLine = 0; box._watch = null; traceSynced(); sync();
  };
  box.fileCount = fileList.length;
  box.focusEditor = function(){ ta.focus(); };
  setTimeout(sync, 0);
  return box;
}

/* ================= значения прямо в редакторе =================
   После запуска рядом со строкой появляется то, что эта строка сделала:
   «итог = 12», «×5  i = 4» (строка выполнилась пять раз, последнее значение
   четыре) или «→ Привет!», если строка печатала. Идея простая: ребёнок
   спрашивает «почему у меня ноль», глядя на код, — а ответ до сих пор лежал
   в другом месте, в панели переменных пошагового режима.

   Данные берутся вторым проходом по шагам. Это честно, а не «примерно»:
   ГПСЧ движка детерминирован (`Interp.prototype.random` стартует с одного и
   того же зерна), поэтому второй прогон той же программы даёт те же числа,
   что и первый, — приписки не разойдутся с выводом в консоли.

   Три ограничения, каждое из-за разметки или цены:
     - код с тройными кавычками приписок не получает (см. hlWatched);
     - длинную строку не подписываем: приписка отжала бы перенос в подсветке,
       и она разъехалась бы с текстовым полем под ней;
     - дорогую программу не считаем совсем — цену первый прогон уже назвал.
   ============================================================ */
var WATCH_MAX_STEPS = 4000;   /* дороже — приписок не будет вовсе */
var WATCH_LINE_MAX  = 46;     /* длиннее строку не подписываем */
var WATCH_VAL_MAX   = 26;     /* длиннее значение обрезаем */

function watchCut(s){
  /* перевод строки в приписке невозможен (она внутри одной строки кода),
     поэтому пробелы сворачиваем в один, а хвост обрезаем */
  s = String(s === null || s === undefined ? "" : s).replace(/\s+/g, " ").trim();
  return s.length > WATCH_VAL_MAX ? s.slice(0, WATCH_VAL_MAX - 1) + "…" : s;
}
/* Снимок «имя → значение» одним плоским объектом: сравнивать надо соседние
   шаги, а не рисовать память, поэтому дерева кучи здесь не нужно. */
function watchSnap(eng, env, skip){
  var out = {};
  if (!env || !eng.snapshotVars) return out;
  eng.snapshotVars(env, skip).forEach(function(v){ out[v.name] = v.value; });
  return out;
}
/* Что сделала строка: сначала изменение переменной, иначе — напечатанное.
   Молчим, когда сказать нечего: приписка на каждой строке превратилась бы
   в шум, из которого ничего не видно (то же правило, что у живого разбора
   расхождения и у полоски «на этом шаге» в визуализаторе). */
function watchNote(prev, cur, printed){
  var names = Object.keys(cur), changed = [];
  for (var i = 0; i < names.length && changed.length < 2; i++){
    var k = names[i];
    if (prev[k] !== cur[k]) changed.push(k + " = " + watchCut(cur[k]));
  }
  if (changed.length) return changed.join(", ");
  if (printed) return "→ " + watchCut(printed);
  return "";
}
/* Один проход по шагам, из которого кормятся ДВЕ фишки: приписки значений
   в редакторе и пересказ программы словами. Собираем по каждой строке:
     note    — что изменилось (последний проход побеждает);
     printed — что напечатано (весь текст за все проходы);
     hits    — сколько раз строка выполнилась.
   Раньше это жило внутри watchCompute, и пересказу пришлось бы повторить ту
   же петлю — а две петли по шагам разошлись бы при первой же правке. */
function stepFacts(eng, code, opts, maxSteps){
  var out = { note:{}, printed:{}, hits:{}, error:null, truncated:false };
  if (!eng || !eng.supportsStep || !eng.stepper || !eng.snapshotVars) return null;
  var st;
  try { st = eng.stepper(String(code || ""), opts || {}); }
  catch(e){ if (!e.pyKind) throw e; return null; }   /* не запускается */
  var skip = st.interp && st.interp.builtinNames;
  var prev = null, prevLine = 0, prevOut = "";
  var guard = 0, cap = maxSteps || WATCH_MAX_STEPS;
  while (true){
    if (guard++ >= cap){ out.truncated = true; break; }
    var s;
    try { s = st.next(); }
    catch(e){ if (!e.pyKind) throw e; break; }
    if (prev && prevLine > 0){
      out.hits[prevLine] = (out.hits[prevLine] || 0) + 1;
      var cur = watchSnap(eng, s.done ? (st.interp && st.interp.global) : s.env, skip);
      var добавка = (s.output || "").slice(prevOut.length);
      var note = watchNote(prev, cur, добавка);
      if (note) out.note[prevLine] = note;
      if (добавка) out.printed[prevLine] = (out.printed[prevLine] || "") + добавка;
      prev = cur;
    } else if (!s.done && !s.error){
      prev = watchSnap(eng, s.env, skip);
    }
    if (s.error){ out.error = s.error; break; }
    if (s.done) break;
    prevLine = s.line; prevOut = s.output || "";
  }
  return out;
}
function watchCompute(eng, code, opts, ranSteps){
  code = String(code || "");
  if (code.indexOf(TRIPLE_D) >= 0 || code.indexOf(TRIPLE_S) >= 0) return null;
  if (ranSteps && ranSteps > WATCH_MAX_STEPS) return null;
  var facts = stepFacts(eng, code, opts, WATCH_MAX_STEPS);
  if (!facts) return null;
  var lines = code.split("\n"), out = {};
  Object.keys(facts.note).forEach(function(k){
    var n = +k;
    /* Длинную строку не подписываем: приписка отжала бы перенос в подсветке,
       и та разъехалась бы с текстовым полем под ней. */
    if (!lines[n - 1] || lines[n - 1].length > WATCH_LINE_MAX) return;
    var hits = facts.hits[n] || 1;
    /* «×5» — строка выполнялась пять раз. Без этого «i = 4» в цикле читается
       как «строка сработала один раз, и получилось 4». */
    out[n] = (hits > 1 ? "×" + hits + "  " : "") + facts.note[n];
  });
  return out;
}

/* ================= разбор кода: что можно сделать чище =================
   Единственная большая тема, которой в курсе не было вовсе, — рефакторинг.
   Работающая программа и хорошая программа это разные вещи, но узнать об этом
   ребёнку было негде: проверка говорит только «верно или нет».

   Здесь код разбирается по-настоящему: парсер у нас свой, значит есть дерево,
   и находки считаются по нему, а не поиском по тексту. «Найди в коде слово
   sum» ошибается на комментариях и строках; дерево — нет.

   Три правила, без которых эта затея принесла бы вред:

   1. НЕ ПРЕДЛАГАТЬ НЕОБЪЯСНЁННОГО. У каждой находки есть поле after — урок,
      после которого совет вообще имеет право появиться. Совет «возьми sum()»
      на пятом уроке — это ровно та дыра, которую в курсе закрывали дважды
      (см. «Порядок объяснений» в README).
   2. НЕ РУГАТЬ. Разбор появляется только после того, как программа работает,
      и говорит «можно чище», а не «плохо». Звёзды за него не отнимаются
      и не добавляются: это не оценка.
   3. НЕ ВРАТЬ. Каждое правило срабатывает только на форме, которую видно
      целиком. Ни одно не говорит «наверное»: находка либо точная, либо её нет.
      Поэтому правил мало и они узкие — лучше промолчать, чем придумать.

   Проверять эти правила есть на чём: сто эталонных решений автора плюс шаги
   проектов. Инструмент `npm run audit:lint` прогоняет разбор по всем ним —
   если совет появляется на решении автора, это либо настоящий недосмотр
   в курсе, либо ложная находка, и разбираться надо сразу.
   ============================================================ */
var LINT_MAX = 3;          /* больше трёх советов за раз — это уже придирки */
var LINT_REPEAT_LINE = 3;  /* столько одинаковых строк — пора в цикл */
var LINT_REPEAT_NUM  = 3;  /* столько раз одно число — пора дать ему имя */
var LINT_LONG_FUNC   = 16; /* столько строк в функции — пора делить */

/* Совет имеет право появиться, только когда нужное уже объясняли.
   Урок из поля after проверяется по прогрессу — так же, как шпаргалка
   решает, что показывать (sheetLearned). */
function lintKnows(lesson){
  if (!lesson) return true;
  return solved(lesson) || !!(S.admin && S.admin.unlockAll);
}

/* Обход дерева. Идём по ВСЕМ полям узла, а не по списку известных имён:
   дети лежат в body, targets, args, parts, clauses и ещё десятке полей, и
   перечисление сломалось бы от каждого нового узла в парсере. */
function astWalk(node, visit){
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)){
    for (var i = 0; i < node.length; i++) astWalk(node[i], visit);
    return;
  }
  /* visit вернул false — внутрь не идём. Нужно правилам, которые смотрят на
     форму целиком: числа внутри списка данных, например, считать не надо. */
  if (node.type && visit(node) === false) return;
  /* Внутренность f-строки парсер оставляет ТЕКСТОМ ({code:"имя"}) и разбирает
     её только при выполнении. Для разбора кода это была настоящая дыра:
     имя, использованное лишь внутри f"…{имя}", выглядело неиспользованным —
     и правило про лишние переменные ругалось на решения автора (нашлось
     инструментом tests/lint-check.js на уроке про f-строки). Поэтому
     разбираем такие куски сами и запоминаем разбор на самой части. */
  if (node.type === "FStr" && node.parts){
    for (var pi = 0; pi < node.parts.length; pi++){
      var part = node.parts[pi];
      if (!part) continue;
      if (part._ast === undefined) part._ast = lintParseBit(part.code, node.line);
      if (part._ast) astWalk(part._ast, visit);
      /* Имя может стоять и в ФОРМАТЕ: f"{полоска:<{ширина}}" — ширина живёт
         в спецификации, а не в самом куске. Без этого правило про лишние
         переменные ругалось на примеры пятого мира (нашлось lint-check.js). */
      if (part._spec === undefined){
        part._spec = [];
        String(part.spec || "").replace(/\{([^{}]*)\}/g, function(m, inner){
          var bit = lintParseBit(inner, node.line);
          if (bit) part._spec.push(bit);
          return m;
        });
      }
      for (var si = 0; si < part._spec.length; si++) astWalk(part._spec[si], visit);
    }
  }
  var keys = Object.keys(node);
  for (var k = 0; k < keys.length; k++){
    var key = keys[k];
    if (key === "type" || key === "line" || key.charAt(0) === "_") continue;
    var v = node[key];
    if (v && typeof v === "object") astWalk(v, visit);
  }
}
function lintName(n){ return n && n.type === "Name" ? n.id : null; }
/* Разобрать кусок f-строки. Номера строк внутри куска начинаются с единицы —
   переносим их на строку самой f-строки, иначе находка укажет не туда. */
function lintParseBit(src, line){
  if (typeof src !== "string" || !src.trim()) return null;
  var ast = null;
  try { ast = window.MiniPy.parse(src); } catch(e){ return null; }
  astWalk(ast, function(m){ m.line = line; });
  return ast;
}

/* ===== правило: цикл, который складывает или считает ===== */
function lintLoops(ast, out){
  astWalk(ast, function(n){
    if (n.type !== "For" || !n.body || n.body.length !== 1) return;
    var v = lintName(n.target);
    if (!v) return;
    var st = n.body[0], acc = null, add = null;
    if (st.type === "AugAssign" && st.op === "+"){
      acc = lintName(st.target); add = st.value;
    } else if (st.type === "Assign" && st.targets.length === 1 &&
               lintName(st.targets[0]) && st.value.type === "BinOp" && st.value.op === "+"){
      acc = lintName(st.targets[0]);
      if (lintName(st.value.left) === acc) add = st.value.right;
      else if (lintName(st.value.right) === acc) add = st.value.left;
    }
    if (!acc || !add) return;
    var src = lintName(n.iter);
    var what = src ? src : "список";
    if (lintName(add) === v)
      out.push({ line:n.line, after:"lists-first", rank:1, conflict:"for",
        title:"Этот цикл — это sum()",
        why:"Три строки складывают всё подряд. То же самое одной: " +
             acc + " = sum(" + what + "). И шагов движка станет меньше — цена программы видна в победной карточке." });
    else if (add.type === "Num" && add.value === 1 && src)
      out.push({ line:n.line, after:"lists-first", rank:1, conflict:"for",
        title:"Этот цикл считает, сколько элементов",
        why:"Столько же скажет len: " + acc + " = len(" + src + ")." });
  });
}

/* ===== правило: for i in range(len(...)), а сам i нужен только как номер ===== */
function lintRangeLen(ast, out){
  astWalk(ast, function(n){
    if (n.type !== "For" || !n.iter) return;
    var iv = lintName(n.target);
    if (!iv || n.iter.type !== "Call" || lintName(n.iter.func) !== "range") return;
    if (!n.iter.args || n.iter.args.length !== 1) return;
    var inner = n.iter.args[0];
    if (inner.type !== "Call" || lintName(inner.func) !== "len") return;
    if (!inner.args || inner.args.length !== 1) return;
    var seq = lintName(inner.args[0]);
    if (!seq) return;
    /* Считаем, все ли обращения к номеру — это seq[i]. Если номер нужен
       ещё зачем-то (печатается, складывается), совет неверен: цикл по
       элементам номер потеряет. */
    var loads = 0, subs = 0;
    astWalk(n.body, function(m){
      if (m.type === "Name" && m.id === iv) loads++;
      if (m.type === "Subscript" && lintName(m.value) === seq &&
          m.index && lintName(m.index) === iv) subs++;
    });
    if (loads > 0 && loads === subs)
      out.push({ line:n.line, after:"lists-first", rank:2, conflict:"range",
        title:"Номер здесь не нужен",
        why:"Внутри цикла номер используется только как " + seq + "[" + iv + "]. " +
             "Значит можно идти по самим элементам: for элемент in " + seq + " — короче и не переставишь границы." });
  });
}

/* ===== правило: переменная, которую никто не читает ===== */
function lintUnused(ast, out){
  var stores = {}, skip = [], loads = {}, classAssigns = [];
  /* Поле класса (class Пёс: hp = 10) — это присваивание имени, но читают его
     через self.hp, то есть как атрибут, а не как имя. Без этой оговорки
     правило ругалось на решения автора в уроках про классы — нашлось
     инструментом tests/lint-check.js. */
  astWalk(ast, function(n){
    if (n.type === "ClassDef" && n.body)
      n.body.forEach(function(st){ if (st.type === "Assign") classAssigns.push(st); });
  });
  /* Сначала помечаем сами имена-получатели: только простое имя слева.
     xs[i] = 5 и obj.attr = 5 не считаем присваиванием имени — там имя читают. */
  astWalk(ast, function(n){
    if (n.type === "Assign" && classAssigns.indexOf(n) < 0){
      n.targets.forEach(function(t){
        if (t.type === "Name"){ stores[t.id] = stores[t.id] || t.line; skip.push(t); }
        /* Распаковка (low, high, avg = stats()) в правило не идёт: имя,
           взятое из распаковки и не использованное, — это отдельная история
           («поставь _»), и совет «переменная никому не нужна» тут только
           путает. В skip кладём всё равно: это получатели, а не чтение. */
        else if (t.type === "Tuple" && t.elts)
          t.elts.forEach(function(x){ if (x.type === "Name") skip.push(x); });
      });
    }
  });
  astWalk(ast, function(n){
    if (n.type === "Name" && skip.indexOf(n) < 0) loads[n.id] = 1;
    /* f-строка разбирается парсером в настоящие узлы, поэтому имя внутри
       {…} попадёт сюда само. Если это когда-нибудь изменится, правило начнёт
       ругаться на используемые переменные — на это есть проверка в тестах. */
  });
  Object.keys(stores).forEach(function(name){
    if (loads[name] || name === "_" || name.charAt(0) === "_") return;
    out.push({ line:stores[name], after:null, rank:3,
      title:"Переменная " + name + " никому не нужна",
      why:"Она получает значение, и дальше её никто не читает. Либо это остаток от прошлой версии — удали, " +
           "либо ты забыл её использовать, и тогда программа считает не то, что ты задумал." });
  });
}

/* ===== правило: сравнение с True/False и с len(...) > 0 ===== */
function lintConditions(ast, out){
  /* Смотрим ТОЛЬКО проверки if и while. В assert сравнение с True — это
     запись ожидания, и совет «пиши if имя:» там был бы не к месту: именно
     так написаны решения урока про assert. Нашлось tests/lint-check.js. */
  var tests = [];
  astWalk(ast, function(n){
    if ((n.type === "If" || n.type === "While") && n.test) tests.push(n.test);
  });
  astWalk(tests, function(n){
    if (n.type !== "Compare") return;
    var sides = [n.left, n.right];
    for (var i = 0; i < 2; i++){
      var c = sides[i], other = sides[1 - i];
      if (c.type === "Const" && (c.value === true || c.value === false) &&
          (n.op === "==" || n.op === "!=")){
        var yes = (c.value === true) === (n.op === "==");
        out.push({ line:n.line, after:"fn-varargs", rank:4,
          title:"Сравнение с " + (c.value ? "True" : "False") + " лишнее",
          why:"Условие и так проверяет правду или ложь. Пишут просто: " +
               (yes ? "if имя:" : "if not имя:") + " — и читается это как обычная фраза." });
        return;
      }
      if (c.type === "Num" && c.value === 0 && other.type === "Call" && lintName(other.func) === "len"){
        /* Ноль слева или справа — разные условия, и перепутать их нельзя.
           len(x) == 0 и 0 == len(x) значат «пусто»; len(x) != 0, len(x) > 0
           и 0 < len(x) — «не пусто». Про >= и <= молчим: с нулём они всегда
           верны или всегда ложны, и совет «пиши if имя:» был бы неправдой. */
        var numRight = (i === 1);
        var empty = n.op === "==";
        var notEmpty = n.op === "!=" ||
                       (n.op === ">" && numRight) ||   /* len(x) > 0 */
                       (n.op === "<" && !numRight);    /* 0 < len(x) */
        if (!empty && !notEmpty) return;
        out.push({ line:n.line, after:"fn-varargs", rank:4,
          title:"Длину с нулём сравнивать не нужно",
          why:"Пустой список, пустая строка и ноль в условии сами считаются ложью. " +
               (empty ? "«Пусто» пишут так: if not имя:" : "«Не пусто» пишут так: if имя:") });
        return;
      }
    }
  });
}

/* ===== правило: x = x + 1 ===== */
function lintAug(ast, out){
  astWalk(ast, function(n){
    if (n.type !== "Assign" || n.targets.length !== 1) return;
    var name = lintName(n.targets[0]);
    if (!name || !n.value || n.value.type !== "BinOp") return;
    if (["+","-","*"].indexOf(n.value.op) < 0) return;
    if (lintName(n.value.left) !== name) return;
    out.push({ line:n.line, after:"vars", rank:7,
      title:"Короче: " + name + " " + n.value.op + "= …",
      why:"Запись " + name + " = " + name + " " + n.value.op + " … пишут одним знаком: " +
           name + " " + n.value.op + "= … . Смысл тот же, читать легче." });
  });
}

/* ===== правило: одно и то же число три раза ===== */
var LINT_DATA_NODES = ["List","Tuple","SetLit","Dict"];
/* Черепашья программа — это сплошные длины и углы: forward(120), right(120).
   Числа там данные рисунка, а не настройки, и просить для них имя бессмысленно
   (правило ругалось на решения уроков про черепашку). Зато совет «три
   одинаковые строки — это цикл» там как раз в точку, и он остаётся. */
var LINT_DRAW_CALLS = ["forward","back","right","left","goto","circle","dot",
                       "penup","pendown","home","speed"];
function lintIsDraw(ast){
  var draw = false;
  astWalk(ast, function(n){
    if (n.type === "Call" && n.func && n.func.type === "Name" &&
        LINT_DRAW_CALLS.indexOf(n.func.id) >= 0) draw = true;
  });
  return draw;
}
function lintMagic(ast, out){
  if (lintIsDraw(ast)) return;
  var seen = {};
  astWalk(ast, function(n){
    /* Числа ВНУТРИ списка, кортежа, множества или словаря — это данные,
       а не «магическая константа»: список оценок [5, 3, 4, 5, 2] не просит
       имени для каждой пятёрки. Без этого правило ругалось на десяток
       решений автора. */
    if (LINT_DATA_NODES.indexOf(n.type) >= 0) return false;
    if (n.type !== "Num") return;
    /* Мелкие числа в коде живут честно: range(3), [0], делить на 4, а
       десятка — это ещё и цифры (n % 10, n // 10) и проценты. Просить имя
       стоит для настоящих настроек: 26 букв алфавита, 60 секунд, 1000 шагов. */
    if (Math.abs(n.value) <= 10) return;
    var k = String(n.value);
    if (!seen[k]) seen[k] = { n:0, line:n.line };
    seen[k].n++;
  });
  Object.keys(seen).forEach(function(k){
    if (seen[k].n < LINT_REPEAT_NUM) return;
    out.push({ line:seen[k].line, after:"vars", rank:6,
      title:"Число " + k + " повторяется " + seen[k].n + " раза",
      why:"Дай ему имя: MAX_HP = " + k + " (или как подходит по смыслу) — и меняй в одном месте, " +
           "а не искать по всей программе." });
  });
}

/* ===== правило: имена не по PEP 8 ===== */
function lintNames(ast, out){
  var bad = {};
  var check = function(name, line){
    if (!name || bad[name]) return;
    if (/^[a-z][a-z0-9]*[A-Z]/.test(name)) bad[name] = line;
  };
  astWalk(ast, function(n){
    if (n.type === "Assign") n.targets.forEach(function(t){ if (t.type === "Name") check(t.id, t.line); });
    if (n.type === "FuncDef") check(n.name, n.line);
  });
  Object.keys(bad).forEach(function(name){
    out.push({ line:bad[name], after:"pep8", rank:8,
      title:"Имя " + name + " — не по-питоновски",
      why:"В Python слова в имени разделяют подчёркиванием: " +
           name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase() +
           ". С большой буквы пишут только классы." });
  });
}

/* ===== правило: слишком длинная функция ===== */
function lintLongFunc(ast, out){
  astWalk(ast, function(n){
    if (n.type !== "FuncDef" || !n.body) return;
    if (n.body.length < LINT_LONG_FUNC) return;
    out.push({ line:n.line, after:"functions", rank:9,
      title:"Функция " + n.name + " делает слишком много",
      why:"В ней " + n.body.length + " шагов. Такую трудно проверить и назвать одним словом: " +
           "вынеси из неё кусок в отдельную функцию со своим именем." });
  });
}

/* ===== правило: повторяющийся кусок =====
   Это единственное правило по тексту, а не по дереву, и так и надо: речь
   именно про повторение записи. Комментарии и пустые строки не считаем.

   Считаем ПОДРЯД ИДУЩИЕ повторы КУСКА, а не сколько раз строка встретилась
   вообще. Разница не теоретическая: раньше правило ругалось на решения самого
   курса, где повторение свернуть нельзя. В уроке 21 три `print(queue)` стоят
   между тремя РАЗНЫМИ действиями со списком, в уроке 55 три `return
   self.coins` лежат в разных методах — цикл там не при чём, и совет был
   неправдой. А настоящий случай — «forward(120) / right(120)» три раза
   подряд — кусок из двух строк, и он ловится.

   У совета ребёнку нет права быть неправдой: правило, которое ошибается
   на эталоне автора, ошибётся и на ребёнке. */
function lintRepeat(code, out){
  var items = [];
  String(code).split("\n").forEach(function(ln, i){
    var t = ln.trim();
    if (!t || t.charAt(0) === "#") return;
    items.push({ t:t, line:i + 1 });
  });
  var кусок = function(от, длина){
    return items.slice(от, от + длина).map(function(x){ return x.t; }).join("\n");
  };
  for (var k = 1; k <= 4; k++){
    for (var i = 0; i + k * LINT_REPEAT_LINE <= items.length; i++){
      var block = кусок(i, k);
      if (block.replace(/\n/g, "").length < 12) continue;
      var n = 1;
      while (кусок(i + n * k, k) === block) n++;
      if (n < LINT_REPEAT_LINE) continue;
      out.push({ line:items[i].line, after:"for-range", rank:5,
        title: k === 1
          ? "Одна и та же строка " + n + " раза"
          : "Одни и те же " + k + " строки повторяются " + n + " раза",
        why:"Повторение подряд — работа для цикла: то, что меняется, положи в список и пройди " +
             "по нему циклом. Тогда правка нужна в одном месте." });
      return;   /* одного такого совета достаточно */
    }
  }
}

/* Полный разбор. Возвращает список находок, уже отсортированный и урезанный;
   пустой список значит «чисто» — это тоже ответ, и его надо показать. */
/* opts:
     all      — не смотреть на прогресс (для инструментов проверки);
     needCode — требования урока (`check.needCode`). Совет, который спорит
                с требованием, не показываем: если урок ТРЕБУЕТ цикл, «возьми
                sum()» — это подстава, а не помощь. */
function lintCode(code, opts){
  opts = opts || {};
  var out = [];
  var ast = null;
  try { ast = window.MiniPy.parse(String(code || "")); }
  catch(e){ if (!e.pyKind) throw e; return null; }    /* не разбирается — сначала пусть заработает */
  lintLoops(ast, out);
  lintRangeLen(ast, out);
  lintUnused(ast, out);
  lintConditions(ast, out);
  lintRepeat(code, out);
  lintMagic(ast, out);
  lintAug(ast, out);
  lintNames(ast, out);
  lintLongFunc(ast, out);
  var need = (opts.needCode || []).join(" ").toLowerCase();
  var open = out.filter(function(f){
    if (!opts.all && !lintKnows(f.after)) return false;
    if (f.conflict && need.indexOf(f.conflict) >= 0) return false;
    return true;
  });
  open.sort(function(a, b){ return (a.rank - b.rank) || (a.line - b.line); });
  return open.slice(0, opts.all ? open.length : LINT_MAX);
}

/* Разметка разбора для сообщения под редактором. */
function lintHTML(found){
  if (found === null)
    return "<b>Сначала пусть заработает</b>Программа не разбирается — в ней ошибка записи. " +
           "Нажми «Запустить», движок покажет, где именно.";
  if (!found.length)
    return "<b>Чисто</b>Разбор ничего не нашёл: ни лишних переменных, ни повторов, ни длинных функций. " +
           "Так выглядит код, который не стыдно показать.";
  return "<b>Работает — а можно чище</b>" +
    '<div class="lintlist">' + found.map(function(f){
      return '<div class="lintone"><span class="lintln">строка ' + f.line + '</span>' +
        '<b>' + esc(f.title) + '</b><span>' + esc(f.why) + '</span></div>';
    }).join("") + '</div>' +
    '<span class="linttip">Это не оценка: звёзды за разбор не отнимаются. ' +
    'Перепиши, если согласен, — и нажми разбор снова.</span>';
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
    /* «Разобрать» — тот же шаговый прогон, но в визуализаторе: с коробками,
       стрелками и перемоткой. Кнопка появляется только там, где разбор
       осмыслен (cfg.viz задан вызывающим экраном). */
    (cfg.viz && eng.supportsStep && !cfg.play ? '<button class="rbtn sec" data-role="viz" title="разобрать программу в визуализаторе">🔍 Разобрать</button>' : "") +
    (cfg.lint && !cfg.play ? '<button class="rbtn sec" data-role="lint" title="что в этой программе можно сделать чище">🧹 Ревью</button>' : "") +
    /* Называется «Очистить», а не «Сброс»: сброс читается как «сотрёт мою
       программу», и ребёнок такую кнопку обходит стороной. Она чистит вывод
       и холст, код не трогает — так и написано в подсказке. */
    '<button class="rbtn sec" data-role="reset" title="очищает вывод и холст — код не трогает">↺ Очистить</button>' +
    (cfg.restore ? '<button class="rbtn sec" data-role="restore">↩ Вернуть как было</button>' : "") +
    (cfg.check ? '<button class="rbtn check" data-role="check">' + (cfg.checkLabel || "✓ Проверить") + '</button>' : "") +
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
    hideMsg(); ed.setError(0); ed.setWatch(null); stepper = null; varsPane.style.display = "none";
    var t = eng.newTurtle ? eng.newTurtle() : null;
    var res = eng.run(ed.getCode(), { turtle: t, sources: ed.getSources(), files: dataFiles(cfg.data), stdin: wrap.getStdin() });
    setConsole(res.output);
    if (res.files) showDisk(res.files);
    if (canvas) animateTurtle(canvas, res.turtle || t);
    if (res.error){
      ed.setError(res.error.line);
      showMsg("bad", errHTML(res.error));
      sfx("bad");
      /* Объяснение ошибки — ровно тот текст, ради которого включают голос:
         кому тяжело читать с экрана, тот застревает именно здесь.
         Собираем фразу заново, а не читаем errHTML: там заголовок и текст
         стоят встык (<b>…</b>текст), и вслух выходило «строка 1Имя». */
      speakAuto((KIND_RU[res.error.kind] || res.error.kind) +
                (res.error.line ? ", строка " + res.error.line : "") + ". " + res.error.msg);
      wrap._hadError = true;
      /* бестиарий: зверь встретился. Помним ЕГО тип — победа достанется
         именно ему, а не тому, что упало три запуска назад. */
      wrap._lastErr = res.error.kind;
      errSeen(res.error.kind);
    } else if (wrap._hadError){
      award("fixer"); wrap._hadError = false;
      /* Победа только если чинил сам: после «показать решение» в редакторе
         код автора, и хвастаться нечем. */
      if (!(session && session.shown)) errBeaten(wrap._lastErr);
      wrap._lastErr = null;
    }
    award("first");
    /* Приписки значений считаются ТОЛЬКО у одного файла: номера строк
       относятся к главному, а в редакторе может быть открыт другой. */
    if (ed.fileCount === 1)
      ed.setWatch(watchCompute(eng, ed.getCode(),
        { sources: ed.getSources(), files: dataFiles(cfg.data), stdin: wrap.getStdin() },
        res.steps));
    if (cfg.onRun) cfg.onRun(res);
    return res;
  }

  function doStep(){
    hideMsg();
    ed.setWatch(null);          /* у пошагового режима своя панель переменных */
    if (!stepper){
      try {
        var t = eng.newTurtle ? eng.newTurtle() : null;
        stepper = { s: eng.stepper(ed.getCode(), { turtle: t, sources: ed.getSources(), files: dataFiles(cfg.data), stdin: wrap.getStdin() }), t: t };
      } catch(e){
        if (!e.pyKind) throw e;
        ed.setError(e.pyLine);
        showMsg("bad", errHTML({ kind:e.pyKind, msg:e.pyMsg, line:e.pyLine }));
        wrap._hadError = true; wrap._lastErr = e.pyKind; errSeen(e.pyKind);
        stepper = null; return;
      }
      varsPane.style.display = "";
    }
    var st = stepper.s.next();
    setConsole(st.output);
    if (canvas) drawTurtle(canvas, stepper.t);
    if (st.error){
      ed.setError(st.error.line); showMsg("bad", errHTML(st.error));
      wrap._hadError = true; wrap._lastErr = st.error.kind; errSeen(st.error.kind);
      stepper = null; return;
    }
    if (st.done){
      ed.setLine(0);
      showMsg("warn", "<b>Программа закончилась</b>Нажми «Очистить», чтобы пройти шагами ещё раз.");
      stepper = null; return;
    }
    ed.setLine(st.line);
    var vars = eng.snapshotVars ? eng.snapshotVars(st.env, stepper.s.interp.builtinNames) : [];
    varsPane.querySelector(".varlist").innerHTML = vars.length
      ? vars.map(function(v){ return '<div class="varrow"><b>' + esc(v.name) + '</b><span>' + esc(v.value) + '</span><em>' + v.type + '</em></div>'; }).join("")
      : '<span class="empty">переменных пока нет</span>';
  }

  function doReset(){
    stepper = null; ed.setLine(0); ed.setWatch(null); hideMsg();
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
    else if (r === "viz") cfg.viz({
      code: ed.getCode(),
      /* окружение отдаём целиком: без ответов для input() и без файлов на
         диске разбор упал бы там, где обычный запуск работает */
      env: { sources: ed.getSources(), files: dataFiles(cfg.data), stdin: wrap.getStdin() }
    });
    else if (r === "lint") wrap.lintShow();
    else if (r === "reset") doReset();
    else if (r === "restore"){
      if (cfg.restoreFiles) ed.setFiles(cfg.restoreFiles); else ed.setCode(cfg.restore);
      doReset();
    }
    else if (r === "check") cfg.check(ed, showMsg, canvas);
  });

  /* Разбор кода. Живёт у станции, а не у экрана: звать его будет и кнопка
     в панели запуска (песочница), и кнопка рядом с подсказками (урок) —
     а показывать результат надо в одном месте, под редактором. */
  wrap.lintShow = function(){
    hideMsg();
    var found = lintCode(ed.getCode(), { needCode: cfg.needCode });
    showMsg(found && found.length ? "warn" : (found === null ? "bad" : "ok"), lintHTML(found));
    return found;
  };
  wrap.lintFind = function(){ return lintCode(ed.getCode(), { needCode: cfg.needCode }); };

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

/* ================= живой разбор расхождения =================
   Когда код падает, объяснение уже есть: движок свой, он видит настоящую
   ошибку и говорит про неё по-русски и с номером строки. А вот когда код
   НЕ падает, а просто отвечает не то, ребёнок до сих пор получал две
   колонки «должно быть / получилось» и номер строки. Что именно не так —
   ни слова. В самом злом случае (лишний пробел) колонки выглядят
   одинаково, и ребёнок сидит над двумя как бы совпадающими текстами.

   Здесь мы этим пользуемся: у нас на руках ОБА вывода, поэтому можно
   назвать разницу словами. Разбор общий — его звинчивают и diffBlock
   (уроки, «Ты и ИИ», проекты), и predictDiff (разминки, «угадай вывод»),
   так что новый случай, добавленный сюда, появляется сразу везде.

   Правило: молчать, если не уверены. Пустая строка в ответе — нормальный
   результат, тогда остаётся прежняя механическая подсказка. Ложное
   объяснение хуже отсутствующего: оно уводит от настоящей причины.
   ============================================================ */

/* Пробелы и табы сами по себе не видны, поэтому в колонках их показываем
   значками. Только в том случае, когда разница ИМЕННО в них — иначе рябит. */
function visSpaces(s){
  return String(s).replace(/\t/g, "→").replace(/ /g, "·");
}
function squash(a){
  return a.map(function(x){ return String(x).replace(/[\t ]+/g, " ").trim(); }).join("\n");
}
function sameLines(a, b){
  return a.length === b.length && a.every(function(x, i){ return x === b[i]; });
}
function firstDiff(exp, got){
  var n = Math.max(exp.length, got.length);
  for (var i = 0; i < n; i++) if ((exp[i] || "") !== (got[i] || "")) return i;
  return -1;
}
function numbersIn(s){
  return (String(s).match(/-?\d+(?:\.\d+)?/g) || []);
}

/* Разница только в невидимом — говорим, в чём именно. Порядок проверок от
   частого к редкому: лишний пробел на конце строки обычно приезжает из
   print("...", x) рядом с ручным пробелом, двойной пробел внутри — из
   print через запятую И плюс сразу. */
function whyInvisible(exp, got, i){
  var e = String(exp[i] || ""), g = String(got[i] || "");
  if (/[\t ]$/.test(g) && !/[\t ]$/.test(e))
    return "в конце строки " + (i + 1) + " у тебя лишний пробел";
  if (/[\t ]$/.test(e) && !/[\t ]$/.test(g))
    return "в конце строки " + (i + 1) + " не хватает пробела";
  if (/^[\t ]/.test(g) && !/^[\t ]/.test(e))
    return "в начале строки " + (i + 1) + " у тебя лишний пробел";
  if (/[\t ]{2}/.test(g) && !/[\t ]{2}/.test(e))
    return "внутри строки " + (i + 1) + " у тебя два пробела подряд вместо одного — так бывает, " +
           "если печатать и через запятую, и со своим пробелом сразу: print(\"итого:\", n) уже ставит пробел сам";
  if (/\t/.test(g) && !/\t/.test(e))
    return "в строке " + (i + 1) + " у тебя табуляция там, где нужен пробел";
  return "разница в строке " + (i + 1) + " только в пробелах";
}

/* Главный разбор. Возвращает { why, vis }: why — объяснение словами (или
   пустая строка, если сказать нечего), vis — показывать ли пробелы значками.
   emptyWhy задаёт caller: пустая правая сторона у урока значит «программа не
   напечатала», а у разминки — «ребёнок ничего не написал», и путать их нельзя. */
function whyDiffer(exp, got, emptyWhy){
  exp = (exp || []).map(String); got = (got || []).map(String);
  var none = { why: "", vis: false };

  /* совсем ничего нет — это не «расхождение», это отсутствие ответа */
  if (!got.length || (got.length === 1 && got[0] === "")){
    if (emptyWhy && exp.length && !(exp.length === 1 && exp[0] === ""))
      return { why: emptyWhy, vis: false };
    return none;
  }

  var i = firstDiff(exp, got);

  /* разница только в невидимом: показать её значками — половина дела */
  if (squash(exp) === squash(got) && i >= 0)
    return { why: "Всё совпадает, кроме невидимого: " + whyInvisible(exp, got, i) +
                  ". Ниже пробелы показаны точками, табы — стрелками.", vis: true };

  /* только регистр */
  if (exp.join("\n").toLowerCase() === got.join("\n").toLowerCase() && i >= 0)
    return { why: "Буквы все на месте, разница только в заглавных: нужно «" + exp[i] +
                  "», а у тебя «" + got[i] + "». Для компьютера это разный текст.", vis: false };

  /* те же строки, но не в том порядке */
  if (exp.length === got.length && exp.length > 1 &&
      sameLines(exp.slice().sort(), got.slice().sort()) && i >= 0)
    return { why: "Все нужные строки есть, но порядок другой: на месте " + (i + 1) +
                  " у тебя «" + got[i] + "», а должна быть «" + exp[i] +
                  "». Порядок печати — это порядок команд, так что смотри, что у тебя выполняется раньше.", vis: false };

  /* строк не столько, сколько надо */
  if (exp.length !== got.length){
    var lack = exp.length - got.length;
    if (lack > 0){
      var tail = sameLines(exp.slice(0, got.length), got)
        ? " Первые " + got.length + " совпадают, не хватает как раз последних — их печатают ПОСЛЕ цикла, без отступа."
        : "";
      return { why: "Строк у тебя " + got.length + ", а нужно " + exp.length + "." + tail, vis: false };
    }
    var extra = sameLines(exp, got.slice(0, exp.length))
      ? " Нужные идут первыми, а дальше лишние — похоже, печать попала внутрь цикла и повторилась."
      : "";
    return { why: "Строк у тебя " + got.length + ", а нужно " + exp.length + "." + extra, vis: false };
  }

  if (i < 0) return none;

  var e = exp[i], g = got[i];

  /* дробное вместо целого и наоборот: самая частая причина — / вместо // */
  var eN = numbersIn(e), gN = numbersIn(g);
  if (eN.length === gN.length && eN.length){
    var floatMix = false, offByOne = 0, allShifted = eN.length > 0;
    for (var k = 0; k < eN.length; k++){
      var a = parseFloat(eN[k]), b = parseFloat(gN[k]);
      if (a === b && eN[k] !== gN[k]) floatMix = true;
      var d = b - a;
      if (Math.abs(d) === 1){ if (offByOne === 0) offByOne = d; else if (offByOne !== d) allShifted = false; }
      else if (a !== b) allShifted = false;
    }
    if (floatMix && eN.join() !== gN.join())
      return { why: "Числа сходятся по величине, но записаны иначе: " + e + " против " + g +
                    ". Целое и дробное — разные вещи: обычное деление / всегда даёт дробное (10 / 2 это 5.0), " +
                    "а деление нацело // даёт целое.", vis: false };
    if (allShifted && offByOne !== 0)
      return { why: "Числа отличаются ровно на единицу" + (offByOne > 0 ? " в сторону больше" : " в сторону меньше") +
                    ": нужно «" + e + "», а у тебя «" + g + "». Почти всегда это одно из двух: нумерация с нуля " +
                    "или range, который до последнего числа не доходит.", vis: false };
  }

  /* напечатан сам список (словарь, кортеж) вместо его значений */
  if (/^[\[({].*[\])}]$/.test(g.trim()) && !/^[\[({]/.test(e.trim()))
    return { why: "Ты напечатал сам набор целиком — " + g + " — со скобками и кавычками, как его видит Python. " +
                  "А нужны значения по отдельности: пройди по нему циклом или собери строку через join.", vis: false };

  /* кавычки в выводе: печать repr вместо самого значения */
  if (g.replace(/['"]/g, "") === e && g !== e)
    return { why: "Значение верное, но напечатано в кавычках: «" + g + "» вместо «" + e +
                  "». Кавычки появляются, когда печатают repr(...) или сам список, а не строку.", vis: false };

  /* запятая как десятичный разделитель */
  if (/\d,\d/.test(g) && g.replace(/(\d),(\d)/g, "$1.$2") === e)
    return { why: "В Python дробная часть отделяется точкой, а не запятой: нужно «" + e + "».", vis: false };

  return none;
}

function diffBlock(exp, got){
  var bad = firstDiff(exp, got);
  var head = bad < 0 ? "Строк должно быть " + exp.length + ", а получилось " + got.length + "."
                     : "Первое расхождение в строке " + (bad+1) + " вывода.";
  var d = whyDiffer(exp, got,
    "Твоя программа ничего не напечатала. Значит дело не в самих значениях, а в том, что до печати не дошло: " +
    "проверь, есть ли в коде print и не спрятался ли он внутрь функции, которую никто не вызвал.");
  if (d.why) head = d.why + " " + head;
  return head + cmpBlock("должно быть", exp, "получилось", got, 8, d.vis);
}

/* Обе колонки рисуются одинаково, поэтому и код один: подписи, обрезка длинного
   хвоста и — если разница только в невидимом — пробелы значками. */
function cmpBlock(labelA, A, labelB, B, limit, vis){
  function side(label, lines){
    var text = lines.slice(0, limit).join("\n");
    if (!text.length && lines.length <= 1) text = "(пусто)";
    else if (vis) text = visSpaces(text);
    return '<div><u>' + label + '</u>' + esc(text) + (lines.length > limit ? "\n…" : "") + '</div>';
  }
  return '<div class="cmp">' + side(labelA, A) + side(labelB, B) + '</div>';
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

/* ================= экран: Главное =================
   Раньше это был «экран миров»: герой, пять карточек, бейджи. А сверху, в
   панели, лежали одиннадцать равных кнопок — уроки, игры, шпаргалка, профиль
   вперемешку. Ребёнку из этого не было видно ни того, что главное, ни того,
   с чего начинать, ни того, зачем нужен каждый раздел.

   Теперь экран отвечает по порядку на четыре вопроса:
     1. Что делать сейчас?            — блок «Сейчас», одна большая кнопка.
     2. Как вообще проходят уроки?    — блок «Как это работает», только новичку.
     3. Где уроки?                    — блок «Уроки», пять миров.
     4. Что тут ещё есть и зачем?     — «Тренировки» и «Моё», у каждой карточки
                                        одна строка «зачем это».
   ============================================================ */

/* Следующий непройденный урок из готовых. Нужен и «Сейчас», и старой
   кнопке «Продолжить». */
function nextLesson(){
  var next = null;
  CURRICULUM.forEach(function(w){
    if (next) return;
    var ready = worldReadyLessons(w);
    for (var i = 0; i < ready.length; i++) if (!solved(ready[i].id)){ next = ready[i]; return; }
  });
  return next;
}
/* Карточки тренировок: один список на два экрана — короткий ряд на Главном
   и подробный на «Тренировках». `why` — это ответ на «зачем мне это», а не
   описание: описание ребёнок и так увидит внутри. */
function trainCards(){
  var warmOpen = (typeof warmupsOpen === "function") ? warmupsOpen().length : 0;
  var warmAll = (window.WARMUPS || []).length;
  var warmDone = Object.keys(S.warmups || {}).length;
  var aiAll = (window.AILAB || []).length, aiDone = Object.keys(S.ailab || {}).length;
  var gAll = gamesList().length;
  return [
    { id:"warm", em:"🧩", title:"Разминка", go: screenWarmups,
      why: "Короткие задачки на пять минут: угадать вывод, собрать программу из блоков, предсказать память.",
      when: "Когда есть пять минут, а на урок настроя нет.",
      /* Разминки открываются по прогрессу: пока уроков нет, открытых ноль —
         и «0 из 0 разгадано» выглядело бы поломкой, а не замком. */
      stat: !warmAll ? "" : (warmOpen
        ? warmDone + " из " + warmOpen + " открытых разгадано"
        : "откроются после первых уроков") },
    { id:"games", em:"🎮", title:"Игры", go: screenGames,
      why: "Настоящие маленькие игры, и у каждой виден код — его можно менять прямо во время игры.",
      when: "Когда хочется поиграть, а не учиться.",
      stat: gAll + " " + plural(gAll, "игра", "игры", "игр") },
    { id:"ai", em:"🤖", title:"Ты и ИИ", go: screenAILab,
      why: "Упражнения про то, как командовать ИИ и проверять его: он ошибается, и это надо уметь замечать.",
      when: "Когда хочется понять, кто тут главный — ты или ИИ.",
      stat: aiAll ? aiDone + " из " + aiAll + " пройдено" : "" },
    { id:"sand", em:"🎨", title:"Песочница", go: screenSandbox,
      why: "Пустой лист без заданий и проверок: пиши что угодно, рисуй черепашкой, ломай и чини.",
      when: "Когда есть своя идея.",
      stat: "рисунок можно сохранить в галерею" },
    { id:"spec", em:"📋", title:"Приёмка", go: screenSpecs,
      why: "Программу написал напарник, а ты принимаешь работу: записываешь, что должно быть верно, и движок судит по твоим правилам.",
      when: "Когда хочется не писать код, а проверять чужой.",
      stat: (function(){
        var all = specsList().length;
        var d = all ? specsList().filter(function(x){ return specDone(x.id); }).length : 0;
        return all ? d + " из " + all + " принято" : "";
      })() },
    { id:"viz", em:"🔍", title:"Визуализатор", go: screenViz,
      why: "Программа по шагам: видно память, ссылки и что изменилось. И пересказ словами, что она сделала.",
      when: "Когда код работает не так, как ты думал.",
      stat: "можно разобрать и свой код с урока" }
  ];
}

/* ================= поиск по урокам =================
   Сто уроков разложены по пяти мирам, и пока помнишь номер — всё хорошо.
   А «где было про словари» раньше искалось только глазами по пяти экранам.
   Ищем по названию, подзаголовку, теме мира и номеру.

   Закрытые уроки из выдачи НЕ прячем, но и открыть их отсюда нельзя:
   спрятать — значит соврать («такого урока нет»), а пустить — сломать
   порядок, на котором держится весь курс. Поэтому строка видна и помечена
   замком: «есть, но позже».
   ============================================================ */
function lessonSearch(q){
  q = String(q || "").toLowerCase().trim();
  if (q.length < 2) return [];
  var out = [];
  CURRICULUM.forEach(function(w){
    w.lessons.forEach(function(l){
      var hay = (l.title + " " + l.sub + " " + w.title + " " + l.num).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push(l);
    });
  });
  return out.slice(0, 8);
}
function wireLessonSearch(){
  var inp = document.getElementById("lq");
  var box = document.getElementById("lsfound");
  if (!inp || !box) return;
  var draw = function(){
    var q = String(inp.value || "").trim();
    if (q.length < 2){ box.hidden = true; box.innerHTML = ""; return; }
    var found = lessonSearch(q);
    box.hidden = false;
    if (!found.length){
      box.innerHTML = '<p class="lsnone">Ничего не нашлось. Попробуй одно слово: ' +
        '«список», «цикл», «функция», «черепашка» — или номер урока.</p>';
      return;
    }
    box.innerHTML = found.map(function(l){
      var open = lessonOpen(l);
      var st = solved(l.id)
        ? new Array(starsOf(l.id) + 1).join("★")
        : (open ? "" : "🔒 позже");
      return '<button class="lsrow' + (open ? "" : " lock") + '"' +
        (open ? ' data-open="' + l.id + '"' : "") + '>' +
        '<span class="lsnum">' + l.num + '</span>' +
        '<span class="lstitle">' + esc(l.title) + '</span>' +
        '<span class="lssub">' + esc(l.sub) + '</span>' +
        '<span class="lsnum">' + st + '</span></button>';
    }).join("");
    box.querySelectorAll("[data-open]").forEach(function(b){
      b.onclick = function(){ openLesson(b.getAttribute("data-open")); };
    });
  };
  inp.oninput = draw;
  inp.onkeydown = function(e){
    if (e.key === "Escape"){ inp.value = ""; draw(); return; }
    /* Enter открывает первый найденный урок: искал — значит уже решил, куда идти */
    if (e.key === "Enter"){
      var first = box.querySelector("[data-open]");
      if (first) first.click();
    }
  };
}

function screenWorlds(){
  enterScreen("home", "home");
  session = { id:null, attempts:0, hints:0, shown:false };
  /* Страховка: если содержание каких-то миров ещё не подгрузилось (это бывает
     только на сайте с раздельными файлами), догружаем всё и перерисовываем —
     иначе готовые миры показались бы как «в работе». */
  if (!window.__SINGLE_FILE__ && CURRICULUM.some(function(w){ return !CONTENT["world" + w.n]; })){
    allWorldsContent().then(function(){
      if (document.querySelector(".worlds")) screenWorlds();
    });
  }
  var doneTotal = Object.keys(S.stars).length;
  var name = myName();
  var next = nextLesson();
  var streak = streakCurrent();
  var dues = reviewDue().length;
  var dailyOk = dailyDone(dayKey());

  /* ===== блок «Сейчас»: одна главная кнопка и три подсказки рядом ===== */
  var h = '<div class="hero now">' +
    '<div class="nowtop"><div>' +
      '<div class="nowkicker">' + (doneTotal ? "продолжаем" : "с чего начать") + '</div>' +
      /* Без имени фраза начинает предложение, с именем — продолжает его.
         «привет!» с маленькой буквы после ничего читается как опечатка, и
         первое, что видит новичок, не должно выглядеть сломанным. */
      '<h1>' + (name ? esc(name) + ", " : "") +
        (doneTotal
          ? (next ? "дальше — урок " + next.num : "все готовые уроки пройдены")
          : (name ? "привет! Это тренажёр по информатике"
                  : "Привет! Это тренажёр по информатике")) + '</h1>' +
      '<p>' + (doneTotal
        ? (next ? esc(next.title) + " — " + esc(next.sub) + "." : "Осталось повторение и проекты.")
        : "Программирование на Python: пишешь код — он тут же работает, считает, рисует " +
          "и объясняет ошибки понятными словами. Сто уроков по порядку, " +
          "от первой команды до своего проекта.") + '</p>' +
    '</div></div>' +
    '<div class="row">' +
      (next ? '<button class="bigbtn" id="go-next">▶ ' + (doneTotal ? "Продолжить" : "Начать первый урок") + '</button>'
            : '<button class="bigbtn" id="go-next">К списку уроков</button>') +
      '<button class="bigbtn ghost" id="go-today">🔥 ' +
        (streak > 0 ? streak + " " + plural(streak, "день", "дня", "дней") + " подряд" : "Сегодня") + '</button>' +
      (dues ? '<button class="bigbtn ghost" id="go-again">🔁 Повторить · ' + dues + '</button>' : '') +
    '</div>' +
    '<div class="nowhints">' +
      '<span>' + (dailyOk ? "✓ задача дня сделана" : "· задача дня ещё ждёт") + '</span>' +
      '<span>' + (dues ? "· " + dues + " " + plural(dues, "урок ждёт", "урока ждут", "уроков ждут") + " повтора"
                       : "· долгов по повторению нет") + '</span>' +
      '<span>· шпаргалка 📖 наверху открывается прямо посреди урока</span>' +
      '<span>· не понял, что за экран, — жми <b>?</b> в правом верхнем углу</span>' +
    '</div></div>';

  /* ===== как это работает: только пока ни один урок не пройден ===== */
  if (!doneTotal){
    h += '<div class="howto"><h3>Как устроен урок</h3><ol>' +
      '<li><b>Читаешь примеры сверху.</b> У каждого есть кнопка «▶ Запустить пример» — код выполнится тут же, ' +
      'а «→ В редактор» перенесёт его вниз, чтобы поменять и попробовать своё.</li>' +
      '<li><b>Смотришь задачу</b> — она в рамке «🎯 Твоя задача», списком требований.</li>' +
      '<li><b>Пишешь код в редакторе</b> и жмёшь «▶ Запустить»: видно, что программа напечатала, ' +
      'а рядом со строками — что каждая сделала.</li>' +
      '<li><b>Жмёшь «✓ Проверить».</b> Если что-то не так, тренажёр покажет, чем твой ответ отличается от нужного.</li>' +
      '</ol><p class="dim">Три звезды дают за урок, пройденный с первой попытки и без подсказок. ' +
      'Подсказки есть всегда — они стоят одну звезду, и это не страшно.</p>' +
      '<div class="helprow"><button class="rbtn sec" id="go-guide">📕 Полная инструкция</button>' +
      '<button class="rbtn sec" data-help="tools">🧰 Что за кнопки наверху</button></div></div>';
  }

  /* ===== уроки ===== */
  h += '<div class="sect"><h2>Уроки</h2>' + qm("worlds", "Как устроен курс") +
    '<div class="line"></div><span class="cnt">' +
    doneTotal + ' из ' + CURRICULUM.total + '</span></div>' +
    '<p class="dim">Это главное в тренажёре: сто уроков по порядку, пять миров по двадцать. ' +
    'Уроки открываются один за другим — сдал, открылся следующий. В конце каждого мира ' +
    'свой проект и сертификат.</p>' +
    /* Куда это ведёт. Раньше на главной было видно, ЧТО внутри (пять миров с
       описаниями), но не было сказано, ЧЕМ дело кончится. Родителю нужно
       именно это: он платит и решает не за «списки и словари», а за результат.
       Все три обещания опираются на то, что в тренажёре уже есть, — шесть
       собранных проектов, сертификаты и раздел «Ты и ИИ» с разбором чужих
       ответов. Обещать больше нельзя: проверяется первым же прохождением. */
    '<p class="path">🏁 <b>К концу пути</b> ребёнок пишет свои программы на Python, ' +
    'разбирает чужой код и умеет находить ошибку в ответе нейросети. ' +
    'На руках остаются шесть собранных проектов и сертификаты — то, что можно показать.</p>' +
    /* Поиск по урокам. Сто уроков лежат в пяти мирах, и «где было про словари»
       раньше искалось только глазами по пяти экранам подряд. */
    '<div class="lsearch"><input type="search" id="lq" autocomplete="off" spellcheck="false" ' +
    'placeholder="Найти урок: словари, черепашка, цикл, 42…"></div>' +
    '<div class="lsfound" id="lsfound" hidden></div>' +
    '<div class="worlds">';
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

  /* ===== тренировки: короткий ряд, подробности на своём экране ===== */
  h += '<div class="sect"><h2>Тренировки</h2>' + qm("train", "Что такое тренировки") +
    '<div class="line"></div>' +
    '<span class="cnt">без звёзд, по желанию</span></div>' +
    '<p class="dim">Это не обязательная программа, а то, куда заходят, когда хочется. ' +
    'Звёзд они не дают, но день занятий засчитывают.</p>' +
    '<div class="hubgrid">' +
    trainCards().map(function(c){
      return '<button class="hubcard" data-train="' + c.id + '">' +
        '<span class="hubem">' + c.em + '</span>' +
        '<b>' + esc(c.title) + '</b>' +
        '<span class="hubwhy">' + esc(c.when) + '</span>' +
        (c.stat ? '<span class="hubstat">' + esc(c.stat) + '</span>' : '') +
        '</button>';
    }).join("") +
    '<button class="hubcard more" id="go-train"><span class="hubem">→</span>' +
    '<b>Все тренировки</b><span class="hubwhy">С объяснением, что зачем.</span></button>' +
    '</div>';

  /* ===== моё ===== */
  var pjAll = projectsList(), pjDone = 0;
  pjAll.forEach(function(p){ if (projectDone(p.id)) pjDone++; });
  var ctAll = certList(), ctDone = 0;
  ctAll.forEach(function(c){ if (c.ready) ctDone++; });
  var pics = galleryList().length, mine = myTasksList().length;
  var shelfN = partsList().length, madeN = buildsList().length;
  h += '<div class="sect"><h2>Моё</h2>' + qm("folio", "Что лежит в «Моём»") +
    '<div class="line"></div>' +
    '<span class="cnt">' + (pjDone + pics + mine) + ' ' +
    plural(pjDone + pics + mine, "работа", "работы", "работ") + '</span></div>' +
    /* ⚠️ Обратное направление стоит ПЕРВЫМ в разделе, раньше портфолио.
       Задания раздают ребёнку везде и всегда; место, где раздаёт он, —
       единственное в продукте, и прятать его вниз значит терять ровно ту
       механику, которая даёт интерес, а не контроль. */
    '<div class="projcard' + (mine ? " done" : "") + '">' +
    '<span class="pjemoji">✍️</span>' +
    '<span class="pjbody"><span class="pjkicker">обычно задают тебе — а тут ты</span>' +
    '<b>Задай задачу взрослому</b>' +
    '<span>придумай задачу сам и отправь ссылкой маме, папе или другу — решать будут они, ' +
    'а проверит тренажёр</span>' +
    '<span class="pjnote">' + (solvedCount()
      ? "Твои задачи решали: " + solvedCount() + " " + plural(solvedCount(), "раз", "раза", "раз") +
        " · своих заданий: " + mine
      : (mine
        ? "Своих заданий: " + mine + ". Когда решат, тебе пришлют ссылку обратно."
        : "Составить задание труднее, чем решить: придётся объяснить задачу словами.")) +
    '</span></span>' +
    '<button class="bigbtn' + (mine ? "" : " ghost") + '" id="gomine">Задать задачу</button>' +
    '</div>' +
    '<div class="projcard' + (pjDone || pics ? " done" : "") + '">' +
    '<span class="pjemoji">🎒</span>' +
    '<span class="pjbody"><span class="pjkicker">сделано своими руками</span>' +
    '<b>Портфолио</b>' +
    '<span>программы из проектов, рисунки и сертификаты — всё в одном месте, можно показать и распечатать</span>' +
    '<span class="pjnote">' + (pjDone || pics
      ? "Программ: " + pjDone + " из " + pjAll.length + " · рисунков: " + pics +
        " · сертификатов: " + ctDone + " из " + ctAll.length
      : "Пока пусто: первая программа появится, когда будет собран проект первого мира.") +
    '</span></span>' +
    '<button class="bigbtn' + (pjDone || pics ? "" : " ghost") + '" id="gofolio">Открыть портфолио</button>' +
    '</div>' +
    /* Витрина стоит и здесь, не только в кабинете: её показывают взрослому,
       а открывает её чаще всего ребёнок — «смотри, что тут собирают». */
    '<div class="projcard"><span class="pjemoji">🏗</span>' +
    '<span class="pjbody"><span class="pjkicker">что тут собирают</span>' +
    '<b>Что ты соберёшь</b>' +
    '<span>шесть программ, рисунки и игры — можно нажать и посмотреть, ' +
    'что они делают, ещё до того, как дойдёшь до них</span>' +
    '<span class="pjnote">Эту страницу удобно показать родителям, если спросят, чем ты тут занят.</span></span>' +
    '<button class="bigbtn ghost" id="goworks">Посмотреть</button>' +
    '</div>' +
    /* Мастерская жила только внутри портфолио: про полку ребёнок узнавал из
       окна победы урока и, если пропустил, не узнавал больше нигде.
       Накопление, которого не видно, не удерживает. */
    '<div class="projcard' + (shelfN ? " done" : "") + '"><span class="pjemoji">🔧</span>' +
    '<span class="pjbody"><span class="pjkicker">полка деталей</span>' +
    '<b>Мастерская</b>' +
    '<span>функции, которые ты написал сам, остаются на полке — из них потом ' +
    'собирается своя программа</span>' +
    '<span class="pjnote">' + (shelfN
      ? "На полке " + shelfN + " " + plural(shelfN, "деталь", "детали", "деталей") +
        (madeN ? ", собрано вещей: " + madeN : "")
      : "Полка наполнится сама: детали появляются с уроков про функции.") + '</span></span>' +
    '<button class="bigbtn' + (shelfN ? "" : " ghost") + '" id="goshop">Открыть мастерскую</button>' +
    '</div>';

  /* ===== достижения ===== */
  h += '<div class="sect"><h2>Достижения</h2>' + qm("stars", "Откуда берутся звёзды и опыт") +
    '<div class="line"></div>' +
    '<span class="cnt">' + S.badges.length + ' из ' + BADGES.length + '</span></div><div class="badges">';
  BADGES.forEach(function(b){
    h += '<div class="badge' + (S.badges.indexOf(b.id) >= 0 ? " got" : "") + '">' +
      '<span class="em">' + b.em + '</span><span><b>' + b.name + '</b><span>' + b.desc + '</span></span></div>';
  });
  h += '</div>';

  app.innerHTML = installTipHTML() + h;
  wireInstallTip(app);

  var goNext = document.getElementById("go-next");
  if (goNext) goNext.onclick = function(){
    if (next) openLesson(next.id); else screenWorld(1);
  };
  document.getElementById("go-today").onclick = screenToday;
  var ga = document.getElementById("go-again");
  if (ga) ga.onclick = screenReview;
  document.getElementById("go-train").onclick = screenTrain;
  var gg = document.getElementById("go-guide");
  if (gg) gg.onclick = screenGuide;
  wireLessonSearch();
  document.getElementById("gofolio").onclick = screenFolio;
  document.getElementById("gomine").onclick = function(){ screenMyTasks(); };
  var gw = document.getElementById("goworks");
  if (gw) gw.onclick = screenShowcase;
  var gs = document.getElementById("goshop");
  if (gs) gs.onclick = screenShop;
  var cards = trainCards();
  app.querySelectorAll("[data-train]").forEach(function(b){
    var id = b.getAttribute("data-train");
    b.onclick = function(){
      for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i].go();
    };
  });
  app.querySelectorAll(".world").forEach(function(b){
    b.onclick = function(){ screenWorld(+b.getAttribute("data-w")); };
  });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= экран: Тренировки =================
   Пять разделов вне сотни, каждый с ответом на «зачем мне это» и «когда сюда
   заходить». Раньше они лежали в верхней панели пятью словами без объяснений:
   «Разминка», «Игры», «Ты и ИИ», «Песочница», «Визуализатор» — и понять,
   что из этого игра, а что учебный инструмент, было невозможно.
   ============================================================ */
function screenTrain(){
  enterScreen("train", "train");
  session = { id:null, attempts:0, hints:0, shown:false };
  var h = '<div class="lvlhead"><div><div class="idx">без звёзд, по желанию</div>' +
    '<h1>🎯 Тренировки</h1></div></div>' +
    '<p class="lede">Уроки — главное, а это то, куда заходят между ними. Звёзд тут не дают ' +
    'и по порядку проходить не надо: выбирай по настроению. Но день занятий засчитывается ' +
    'и здесь, так что серия не оборвётся.</p><div class="trainlist">';
  trainCards().forEach(function(c){
    h += '<div class="traincard"><span class="hubem">' + c.em + '</span>' +
      '<div class="trainbody"><b>' + esc(c.title) + '</b>' +
      '<p>' + esc(c.why) + '</p>' +
      '<span class="trainwhen">Когда заходить: ' + esc(c.when).replace(/^Когда\s/, "") + '</span>' +
      (c.stat ? '<span class="hubstat">' + esc(c.stat) + '</span>' : '') + '</div>' +
      '<button class="bigbtn" data-train="' + c.id + '">Открыть</button></div>';
  });
  h += '</div>' +
    '<div class="note"><b>Не знаешь, что выбрать</b>Жми «?» в правом верхнем углу — ' +
    'там написано, что это за экран и что тут делать. Так на любом экране сайта.</div>' +
    '<div class="note"><b>Повторение живёт отдельно</b>Уроки, которые дались тяжело, ' +
    'возвращаются сами в разделе «Повторить» — он на Главном, потому что это про уроки, ' +
    'а не про отдых. Там же бестиарий ошибок: каждая ошибка, которую ты победил.</div>' +
    '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="toagain">🔁 Повторить</button></div>';
  app.innerHTML = h;
  var cards = trainCards();
  app.querySelectorAll("[data-train]").forEach(function(b){
    var id = b.getAttribute("data-train");
    b.onclick = function(){
      for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i].go();
    };
  });
  document.getElementById("tomap").onclick = screenWorlds;
  document.getElementById("toagain").onclick = screenReview;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= экран: мир ================= */
function screenWorld(n){
  var seq = enterScreen(undefined, "world");
  var w = CURRICULUM.world(n);
  worldContent(n).then(function(){
    if (screenStale(seq)) return;          /* ушли на другой экран, пока грузился мир */
    var ready = worldReadyLessons(w);
    var h = '<div class="lvlhead"><div><div class="idx">Мир ' + w.n + ' из 5</div>' +
      '<h1>' + w.icon + ' ' + w.title + '</h1></div></div>' +
      '<p class="lede">' + w.desc + '</p>';

    if (!ready.length)
      h += '<div class="note"><b>Этот мир ещё пишется</b>Ниже — план уроков, чтобы было видно дорогу. Уроки появятся волнами по десять.</div>';
    else
      h += '<p class="dim">Уроки проходят по порядку: следующий открывается, когда сдан предыдущий. ' +
        'Звёзды показывают, как прошёл: три — с первой попытки без подсказок. ' +
        'Пройденный урок можно открыть заново в любой момент, звёзды за это не отнимаются.</p>';

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
        '<span class="lright">' +
          /* перышко — цель по шагам взята: видно, где программа уже не дороже
             решения автора, и где ещё есть куда переписывать */
          ((S.log[l.id] && S.log[l.id].lean) ? '<span class="leanmark" title="программа уложилась в цену решения автора">🪶</span>' : '') +
          (has ? minutesTag(lessonBody(l)) + '<span class="stars">' + stars + '</span>'
               : '<span class="soontag">скоро</span>') + '</span>' +
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
        '<span class="pjbody"><span class="pjkicker">Проект мира ' + n + ' · звёзд не даёт</span>' +
        '<b>' + esc(proj.title) + (pdone ? ' <span class="edittag done">собран ✓</span>' : '') + '</b>' +
        '<span>' + esc(proj.tagline) + '</span>' +
        '<span class="pjnote">' + esc(pnote) + '</span></span>' +
        (popen ? '<button class="bigbtn" id="openproj">' +
                   (pdone ? "Открыть" : (pst.step > 0 ? "Продолжить" : "Собрать проект")) + '</button>'
               : '<span class="soontag">закрыт</span>') +
      '</div>';
    }

    /* Мастерская — в конце мира, сразу за проектом. Здесь и только здесь у
       предложения «собери из накопленного» есть смысл: уроки мира позади,
       и на полке уже что-то лежит. Раньше трёх деталей не зовём — из одной
       функции вещь не собирается, а пустое приглашение обесценивает саму
       мысль о накоплении. */
    var shelfN = partsList().length;
    if (shelfN >= 3)
      h += '<div class="projcard"><span class="pjemoji">🔧</span>' +
        '<span class="pjbody"><span class="pjkicker">Мастерская · звёзд не даёт</span>' +
        '<b>Собери вещь из своих деталей</b>' +
        '<span>На полке уже ' + shelfN + ' ' + plural(shelfN, "деталь", "детали", "деталей") +
        ' — функций, которые ты написал сам.</span>' +
        '<span class="pjnote">Решённая задача обычно исчезает. Здесь она остаётся ' +
        'и идёт в дело.</span></span>' +
        '<button class="bigbtn" id="openshop">Открыть мастерскую</button></div>';

    h += '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button><span class="sp"></span>' +
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
    var osh = document.getElementById("openshop");
    if (osh) osh.onclick = screenShop;
    var wn = document.getElementById("wnext");
    if (wn) wn.onclick = function(){ screenWorld(n+1); };
    refreshTop();
    window.scrollTo({ top:0, behavior:"smooth" });
  });
}

/* ================= экран: урок ================= */
var session = null;

/* ================= черновики кода на экране урока =================
   Раньше уход с урока стирал написанное: код жил только в DOM редактора,
   ни S, ни localStorage его не помнили. Из-за этого шпаргалку пришлось
   делать оверлеем, а любой новый экран посреди урока был запрещён (грабля 34).
   Теперь код урока переживает уход и возвращение.

   Решения, которые тут приняты:
     - черновик — это «что было в редакторе, когда ты ушёл». Не «последняя
       попытка», не «твой код»: если ребёнок открыл решение и ушёл, вернётся
       решение, и подпись над редактором говорит об этом честно;
     - черновик, совпадающий с заготовкой (или пустой), не хранится: это не
       работа, а исходное состояние;
     - рядом с редактором есть «Вернуть заготовку» — иначе ребёнок, оставивший
       в редакторе кашу, оказался бы заперт: у обычного урока кнопки «вернуть
       как было» нет, она только у заданий «починить». Название выбрано так,
       чтобы не спутать с кнопкой «↺ Очистить» в самом редакторе: та чистит вывод
       и холст, а код не трогает;
     - код сложить нельзя, поэтому при слиянии двух устройств черновик берётся
       из более свежего сохранения — как песочница и как свои версии игр;
     - сохраняем в трёх местах: через паузу после набора, при уходе с экрана
       (claimScreen — через него проходит ЛЮБАЯ смена экрана) и при закрытии
       вкладки.
   ============================================================ */
var DRAFT_MAX  = 60;    /* больше стольких черновиков в памяти не держим */
var DRAFT_WAIT = 700;   /* мс тишины после набора — и черновик сохраняется */
var draftTimer = null;

function draftsAll(){ S.drafts = S.drafts || {}; return S.drafts; }
function draftGet(id){
  var d = draftsAll()[id];
  return (d && Array.isArray(d.files) && d.files.length) ? d : null;
}
function draftDrop(id){ delete draftsAll()[id]; save(); }

/* Черновик хранится списком файлов: так же выглядит многофайловый урок,
   а обычный — это список из одного файла. Совпал с заготовкой — не храним. */
function draftSave(id, files, starter){
  var d = draftsAll();
  var empty = files.every(function(f){ return !String(f.code).trim(); });
  var same = files.length === starter.length && files.every(function(f, i){
    return f.code === starter[i].code;
  });
  if (empty || same){
    if (d[id]){ delete d[id]; save(); }
    return false;
  }
  d[id] = { files: files.map(function(f){ return { name:f.name, code:f.code }; }), at: Date.now() };
  pruneDrafts();
  save();
  return true;
}
/* Черновики уезжают на сервер вместе с прогрессом, поэтому расти без предела
   им нельзя: сотня программ в одном запросе не нужна никому. */
function pruneDrafts(){
  var d = draftsAll(), keys = Object.keys(d);
  if (keys.length <= DRAFT_MAX) return;
  keys.sort(function(a, b){ return (d[a].at || 0) - (d[b].at || 0); });
  keys.slice(0, keys.length - DRAFT_MAX).forEach(function(k){ delete d[k]; });
}

/* Положить черновик в редактор, сопоставляя файлы по ИМЕНИ: содержание урока
   могли поправить, и порядок файлов мог измениться. Файл, которого в черновике
   нет, остаётся заготовкой. */
function draftApply(ed, saved){
  var by = {};
  saved.forEach(function(f){ by[f.name] = f.code; });
  ed.setFiles(ed.getFiles().map(function(f){
    return { name: f.name, code: by.hasOwnProperty(f.name) ? by[f.name] : f.code };
  }));
}

/* Сохранить несохранённый код УХОДЯЩЕГО экрана. Зовётся из claimScreen, то есть
   на любой смене экрана, включая переход с урока на урок. В этот момент старая
   разметка ещё в документе — поэтому редактор можно дочитать.

   Песочница здесь же, и вот почему: её код сохранялся только по «Запустить» и по
   нижней кнопке «На главную». Ребёнок, ушедший кнопкой верхней панели, терял
   написанное ровно так же, как терял его на уроке. */
function draftFlush(){
  if (draftTimer){ clearTimeout(draftTimer); draftTimer = null; }
  var s = session;
  if (!s || !s.studio || !s.studio.editor) return;
  try {
    if (!document.body.contains(s.studio)) return;
    if (s.sandbox){ S.sandbox = s.studio.editor.getCode(); save(); return; }
    /* верстак мастерской — такой же экран с редактором, как песочница, и
       теряет написанное ровно так же, если про него забыть (грабля 43) */
    if (s.shop){ S.shop = s.studio.editor.getCode(); save(); return; }
    /* своё задание — это три поля сразу (название, условие, код), поэтому
       экран сам отдаёт их одной функцией, а не только код редактора */
    if (s.mytask && s.mytaskStash){ s.mytaskStash(); save(); return; }
    if (s.lesson && s.starter) draftSave(s.lesson, s.studio.editor.getFiles(), s.starter);
  } catch(e){}
}
function draftSchedule(){
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(function(){ draftTimer = null; draftFlush(); }, DRAFT_WAIT);
}

/* ===== липкая полоска задания =====
   Нужна там, где колонка одна (узкий экран): уехав в редактор, ребёнок терял
   из виду и текст задания, и дорогу назад. Полоска всегда говорит, что надо
   сделать, разворачивается тапом в полный текст и даёт кнопку к объяснению.
   Появляется она не «на уроке», а РОВНО когда карточка задания ушла выше
   верхнего края: пока задание видно, вторая копия того же текста только
   мешала бы. */
var taskPinObs = null;
/* Высота шапки уезжает в CSS-переменную: полоска задания прилипает ПОД шапкой,
   а шапка на телефоне двухстрочная. Зашитое число пряталось бы под ней. */
function syncTopHeight(){
  var t = document.querySelector(".top");
  if (!t || !t.getBoundingClientRect) return;
  var h = Math.round(t.getBoundingClientRect().height);
  if (h > 0) document.documentElement.style.setProperty("--toph", h + "px");
}
window.addEventListener("resize", syncTopHeight);
function taskPinHide(){
  if (taskPinObs){ taskPinObs.disconnect(); taskPinObs = null; }
  var el = document.getElementById("taskpin");
  if (!el) return;
  el.hidden = true;
  el.classList.remove("open");
  var full = document.getElementById("tp-full");
  if (full) full.hidden = true;
  var op = document.getElementById("tp-open");
  if (op) op.setAttribute("aria-expanded", "false");
}
function taskPinShow(goalEl){
  taskPinHide();
  var pin = document.getElementById("taskpin");
  if (!pin || !goalEl || !window.IntersectionObserver) return;
  var p = goalEl.querySelector("p");
  document.getElementById("tp-txt").textContent = p ? p.textContent.trim() : "Задание";
  /* в развёрнутом виде — тот же текст задания целиком, включая список пунктов */
  var full = document.getElementById("tp-full");
  full.innerHTML = (p ? "<p>" + p.innerHTML + "</p>" : "") +
    (goalEl.querySelector("ul") ? goalEl.querySelector("ul").outerHTML : "");
  taskPinObs = new IntersectionObserver(function(es){
    var e = es[0];
    var gone = !e.isIntersecting && e.boundingClientRect.top < 0;
    if (!gone && !pin.hidden){
      pin.classList.remove("open");
      full.hidden = true;
      document.getElementById("tp-open").setAttribute("aria-expanded", "false");
    }
    pin.hidden = !gone;
  }, { threshold: 0 });
  taskPinObs.observe(goalEl);
}
(function(){
  var op = document.getElementById("tp-open");
  if (op) op.onclick = function(){
    var pin = document.getElementById("taskpin"), full = document.getElementById("tp-full");
    var open = !pin.classList.contains("open");
    pin.classList.toggle("open", open);
    full.hidden = !open;
    op.setAttribute("aria-expanded", open ? "true" : "false");
  };
  var up = document.getElementById("tp-up");
  if (up) up.onclick = function(){
    /* «к объяснению» — это первая карточка теории, а не начало страницы:
       заголовок урока ребёнок и так помнит, а нужен ему разбор. */
    var first = document.querySelector(".lcol-read .card.theory") || document.querySelector(".card.theory");
    if (first && first.scrollIntoView) first.scrollIntoView({ behavior:"smooth", block:"start" });
    else window.scrollTo({ top:0, behavior:"smooth" });
  };
})();


function openLesson(id){
  var l = CURRICULUM.byId(id);
  if (!l) return screenWorlds();
  curTab = "home";              /* урок — это «Главное», а не отдельный раздел */
  curPlace = "lesson";          /* а помощь «?» — про урок */
  var seq = claimScreen();
  worldContent(l.world).then(function(){
    if (screenStale(seq)) return;          /* ушли на другой экран, пока грузился мир */
    var body = lessonBody(l);
    if (!body) return screenWorld(l.world);
    /* lesson — отдельное поле, а не id: id есть и у разминки, и у «Ты и ИИ»,
       а черновик заводится только у урока */
    session = { id:id, lesson:id, attempts:0, hints:0, shown:false };
    touchLog(id); startTimer(id);
    var w = CURRICULUM.world(l.world);
    var ready = worldReadyLessons(w);
    var pos = ready.indexOf(l);

    /* ===== кнопка «Назад» наверху =====
       Хлебные крошки её не заменяют: они выглядят подписью, а не кнопкой, и
       на них не нажимают. Единственная дорога назад была внизу страницы —
       то есть за экраном, как только ребёнок уехал в редактор.
       ⚠️ Идёт занятие — возвращаем В ЗАНЯТИЕ, а не в список уроков. Иначе
       кнопка уносит мимо плана ровно так же, как это делало «Дальше →» в
       победной карточке до правки 1.41.0. */
    var head = '<div class="crumbs">' +
      '<span data-go="worlds">Главное</span> › <span data-go="world">' + w.icon + ' ' + w.title + '</span></div>' +
      '<div class="lvlhead"><div><div class="idx">' + (l.boss ? "Босс мира " + w.n : "Урок " + l.num + " из 100") + '</div>' +
      '<h1>' + l.title + '</h1></div><div class="right">' +
      '<span class="tag">' + l.sub + '</span>' + (body.draw ? '<span class="tag draw">рисование</span>' : '') +
      '<span class="tag time">' + minutesTag(body) + '</span></div></div>' +
      '<p class="lede">' + body.lede + '</p>';

    var sayTexts = {};
    var theory = body.theory.map(function(t, i){
      sayTexts["t" + i] = plainText(t.h + ". " + t.p);
      /* t.show — код, который в тренажёре не запускается: настоящий Flask,
         команды терминала, чужие библиотеки. Показываем как есть и честно
         пишем, где он работает. t.demo при этом может и быть, и не быть. */
      var shown = t.show
        ? '<div class="showcode"><pre><code>' + hl(t.show) + '</code></pre>' +
          '<span class="shownote">' + (t.showNote || "этот код работает на настоящем компьютере, а не в тренажёре") + '</span></div>'
        : "";
      /* Разбор примера. Отдельным блоком под кодом, а не в объяснении сверху:
         сверху сказано, ЗАЧЕМ это нужно, а тут — что делает вот эта конкретная
         программа, строка за строкой. Замер, с которого началось: в Мире 1
         половина карточек была короче 150 знаков, то есть две фразы на всё. */
      var note = t.note
        ? '<div class="demonote"><b>Что тут происходит.</b> ' + t.note + '</div>'
        : "";
      var demo = t.demo
        ? '<div class="demo" data-demo="' + i + '"><pre><code>' + hl(t.demo) + '</code></pre>' + note +
          '<div class="bar"><button class="minibtn" data-run="' + i + '">▶ Запустить пример</button>' +
          '<button class="minibtn" data-copy="' + i + '">→ В редактор</button>' +
          '<span class="hintx' + (t.err ? " errx" : "") + '">' +
          (t.err ? "этот пример падает с ошибкой — так и задумано" : "можно менять и запускать снова") +
          '</span></div><div class="res"></div></div>'
        : "";
      return '<div class="card theory">' + sayBtnHTML("t" + i) + '<h3>' + t.h + '</h3><p>' + t.p + '</p>' + shown + demo + '</div>';
    }).join("");

    var isFix = body.task.type === "fix";
    sayTexts.goal = plainText(body.task.goal + " " + body.task.list.join(". "));

    /* ===== «Спроси»: разговор без микрофона и без нейросети =====
       Ребёнок хочет спросить голосом, но распознавание речи в браузере
       отправляет звук на чужие серверы, не работает без сети и есть не везде,
       а живая модель решала бы задачу за него. Поэтому «разговор» устроен
       наоборот: спрашивает ребёнок нажатием, отвечает тренажёр — вслух.

       Отвечать есть чем, и ничего нового писать не пришлось: все четыре
       ответа уже лежат в уроке (вступление, условие задачи, разбор примера)
       и в движке (объяснение ошибки). Ответ про ошибку берётся из живого
       сообщения на экране, а не запоминается при отрисовке: к моменту
       вопроса ошибка уже другая. */
    var demoNote = (body.theory || []).filter(function(t){ return t.note; })[0];
    var ASKS = [
      { q: "Что тут нового?",  a: function(){ return plainText(body.lede); } },
      { q: "Что надо сделать?", a: function(){ return sayTexts.goal; } },
      { q: "Почему ошибка?",   a: function(){
          var m = document.querySelector(".msg.show.bad");
          return m ? plainText(m.innerHTML.replace("</b>", "</b>. "))
                   : "Сейчас ошибки нет. Нажми «Запустить» — если что-то сломается, я объясню, что именно.";
        } },
      { q: "Покажи пример",    a: function(){
          return demoNote ? plainText(demoNote.note)
                          : "В этом уроке разбора примера нет — зато есть карточки с объяснением выше.";
        } }
    ];
    var askCard = '<div class="card ask"><h3>💬 Спроси</h3>' +
      '<p class="dim">Нажми вопрос — отвечу текстом и прочитаю вслух.</p>' +
      '<div class="askrow">' +
      ASKS.map(function(x, i){ return '<button class="minibtn" data-ask="' + i + '">' + x.q + '</button>'; }).join("") +
      '</div><div class="askans" id="askans" hidden></div></div>';
    var goal = '<div class="goal">' + sayBtnHTML("goal") + '<h3>' + (isFix ? "🔧 Задача: починить" : "🎯 Твоя задача") + '</h3><p>' +
      body.task.goal + '</p><ul>' +
      body.task.list.map(function(x){ return "<li>" + x + "</li>"; }).join("") + '</ul></div>';
    var bug = isFix
      ? '<div class="bugcard"><h3>🐞 Что сейчас не так</h3><p>' + body.task.symptom + '</p>' +
        '<span class="bugtip">Код ниже нужно починить, а не заменить своим. Если запутался, ' +
        'кнопка «↩ Вернуть как было» вернёт исходный сломанный вариант.</span></div>'
      : "";

    /* Кнопка разбора стоит здесь, а не в панели запуска: панель на уроке и так
       из пяти кнопок, а разбор — про то же, про что подсказки: «помоги мне
       посмотреть на свой код». Отличие сказано рядом: звёзды он не отнимает. */
    var hints = '<div class="hintbox">' +
      '<button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
      '<button class="rbtn sec" id="solbtn">Показать решение</button>' +
      (body.task.files ? '' : '<button class="rbtn sec" id="lintbtn" title="что можно сделать чище">🧹 Ревью кода</button>') +
      '<span class="tip">за подсказку теряется одна звезда, за ревью — нет</span></div><div class="hintout" id="hintout"></div>';

    var prev = pos > 0 ? ready[pos-1] : null, next = pos < ready.length-1 ? ready[pos+1] : null;
    var pager = '<div class="pager"><button class="bigbtn ghost" data-go="world">← К списку уроков</button><span class="sp"></span>' +
      (prev ? '<button class="bigbtn ghost" data-open="' + prev.id + '">Назад</button>' : '') +
      (next ? '<button class="bigbtn ghost" data-open="' + next.id + '">Дальше →</button>' : '') + '</div>';

    /* Первый урок в жизни: три строки о том, какая кнопка что делает. Дальше
       полоска не показывается — она нужна ровно один раз, а место на экране
       дороже. Условие «ни один урок ещё не пройден», а не «это первый урок»:
       ребёнок может начать не с начала (панель наставника умеет снимать замки). */
    var firstEver = Object.keys(S.stars).length === 0;
    var howbar = firstEver
      ? '<div class="howbar"><b>Что дальше:</b> ' +
        '<span>«<b>▶ Запустить</b>» покажет, что делает код</span>' +
        '<span>«<b>⏭ Шаг</b>» пройдёт по строкам</span>' +
        '<span>«<b>✓ Проверить</b>» засчитает урок</span>' +
        '<span>не получается — «<b>💡 Подсказка</b>» ниже</span></div>'
      : "";

    /* Раскладка урока в ДВЕ колонки: слева объяснение, справа задание и
       редактор. Замер до правки: страница 2341px при экране 720px, а редактор
       начинался на 1698-м — на 2,4 экрана ниже. То есть в момент, когда
       ребёнок щёлкал в редактор, за верхний край уезжали и объяснение, и сам
       текст задания, а под редактором были только подсказки: вернуться
       некуда. После правки редактор начинается на 606-м, задание стоит прямо
       над ним и держится липким, пока ребёнок пишет код.

       Задание стоит В КОНЦЕ левой колонки, как и раньше, — решение фаундера
       02.09.2026. Справа только верстак: редактор с подсказками. Он липкий и
       потому стоит НАПРОТИВ ЛЮБОЙ карточки, какую ребёнок сейчас читает:
       увидел пример — сразу пробуешь, не листая. Заодно щелчок в редактор
       больше не прокручивает страницу: редактор и так в поле зрения.

       Правая колонка обязана влезать в экран целиком — иначе липкость не
       спасает. Без задания она стала ещё ниже: редактор 457px плюс подсказки
       64 против экрана 800. Полоска «Что дальше» всё равно вынесена НАД
       сеткой — она про кнопки редактора, а не про объяснение.

       На узком экране колонка одна и порядок прежний: объяснение, задание,
       редактор. Там же работает липкая полоска задания, см. taskPinShow(). */
    app.innerHTML = head + howbar +
      '<div class="lessongrid' + (body.draw ? ' one' : '') + '">' +
        '<div class="lcol-read">' + theory + goal + bug + askCard + '</div>' +
        '<div class="lcol-work">' +
          /* Задание живёт в конце объяснения, а верстак стоит наверху — значит
             у верстака нет контекста: «непонятно, как решить задачу справа».
             Поэтому над редактором висит строка с задачей: одной строкой,
             тап разворачивает целиком. На узком экране её нет — там задание
             и так стоит прямо над редактором. */
          /* ⚠️ Развёрнуто ПО УМОЛЧАНИЮ. Свёрнутым этот блок экономил три
             строки и стоил куда дороже: требования и обещанный вывод —
             единственное место, где написано, что засчитается, — лежали
             за словами «показать целиком», и ребёнок мог их просто не
             открыть. Экономия места не стоит непрочитанного задания.
             Свернуть по-прежнему можно, и свёрнутая строка — та же цель
             в одну строку. Дублирования между строкой и раскрытым текстом
             нет: открытый блок ПРЯЧЕТ однострочник (см. .worktask.open). */
          '<div class="worktask open" id="worktask">' +
            '<div class="wthead">' + (isFix ? "🔧 Здесь чинишь код" : "🎯 Здесь решаешь задачу") + '</div>' +
            '<button class="wtmain" id="wt-open" aria-expanded="true" aria-controls="wt-full">' +
              '<span class="wttxt" hidden>' + stripTags(body.task.goal) + '</span>' +
              '<span class="wtchev">свернуть ▴</span></button>' +
            '<div class="wtfull" id="wt-full"><p>' + body.task.goal + '</p><ul>' +
              body.task.list.map(function(x){ return "<li>" + x + "</li>"; }).join("") + '</ul></div>' +
          '</div>' +
          '<div class="draftnote" id="draftnote" hidden></div>' +
          '<div id="studio"></div>' + hints +
        '</div>' +
      '</div>' + pager;

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
      /* Требования урока едут в разбор: совет, который спорит с требованием
         («возьми sum()» там, где урок требует цикл), показывать нельзя. */
      needCode: (body.task.check && body.task.check.needCode) || null,
      /* Разбор своей программы. Многофайловому уроку его не даём: в
         визуализаторе один редактор, и подсветка строки уехала бы в чужой
         файл, как только выполнение зашло в модуль. */
      viz: body.task.files ? null : function(o){
        screenViz({ code: o.code, env: o.env,
          backTo: { label: "← Вернуться в урок", go: function(){ openLesson(id); } } });
      },
      check: function(ed, showMsg, canvas){ runCheck(l, body, ed, showMsg, canvas); }
    });
    document.getElementById("studio").appendChild(studio);
    session.studio = studio;

    /* Что в этом уроке копировать ЗАКОННО: примеры объяснения, заготовка,
       решение. Вставка отсюда — обычная работа («→ В редактор» делает ровно
       это), и в записи авторства она считается отдельно от вставки извне.
       Без такого разделения каждый второй урок выглядел бы «пришедшим
       готовым», и взрослый перестал бы верить записи целиком. */
    studio.editor.knownText = [body.task.starter || "", body.task.solution || ""]
      .concat((body.theory || []).map(function(t){ return [t.demo, t.show].filter(Boolean).join("\n"); }))
      .concat((body.task.files || []).map(function(f){ return [f.starter, f.solution].filter(Boolean).join("\n"); }))
      .join("\n");

    /* заготовка урока списком файлов — с ней сравнивается черновик, чтобы
       нетронутый урок не занимал места в прогрессе */
    session.starter = taskFiles
      ? taskFiles.map(function(f){ return { name:f.name, code:f.code }; })
      : [{ name:"main.py", code: body.task.starter }];

    /* Вернуть в редактор то, с чего задание начинается. Нужно в двух местах:
       кнопка «Вернуть заготовку» у черновика и возврат после «→ В редактор».
       Второго раньше не было вовсе: кнопка примера молча затирала код задания,
       и ребёнок оставался с чужим кодом, не понимая, куда делось его. */
    function backToTask(){
      if (taskFiles && studio.editor.setFiles) studio.editor.setFiles(taskFiles);
      else studio.editor.setCode(body.task.starter);
      var dn0 = document.getElementById("draftnote");
      if (dn0) dn0.hidden = true;
      studio.editor.focusEditor();
    }
    /* Полоска над редактором: что там сейчас лежит и как вернуть своё. */
    function noteDemo(){
      var dn0 = document.getElementById("draftnote");
      if (!dn0) return;
      dn0.hidden = false;
      dn0.innerHTML = '<span>📋 Сейчас в редакторе пример из объяснения, а не твоя задача.</span>' +
        '<button class="rbtn sec" id="backtask">↩ Вернуть мою задачу</button>';
      var bt = document.getElementById("backtask");
      if (bt) bt.onclick = backToTask;
    }

    var draft = draftGet(id);
    if (draft){
      draftApply(studio.editor, draft.files);
      var dnote = document.getElementById("draftnote");
      dnote.hidden = false;
      /* Подпись намеренно не говорит «твой код»: если ребёнок ушёл, открыв
         решение, вернётся решение — и врать об этом не надо. */
      dnote.innerHTML = '<span>📝 В редакторе код с прошлого раза, а не чистая заготовка.</span>' +
        '<button class="rbtn sec" id="draftfresh">Вернуть заготовку</button>';
      document.getElementById("draftfresh").onclick = function(){
        draftDrop(id);
        backToTask();
      };
    }
    /* набор текста откладывает сохранение: уход с экрана поймает claimScreen,
       а вот просто закрытую вкладку — только это */
    studio.editor.onEdit = draftSchedule;

    wireSay(app, sayTexts);

    app.querySelectorAll("[data-ask]").forEach(function(b){
      b.onclick = function(){
        var x = ASKS[+b.getAttribute("data-ask")];
        var txt = x.a();
        var box = document.getElementById("askans");
        if (box){
          box.innerHTML = '<b>' + esc(x.q) + '</b>' + esc(txt);
          box.hidden = false;
        }
        /* Читаем всегда, а не только при включённом авточтении: вопрос нажали
           руками — значит ответ хотят услышать. Ровно как кнопка 🔊. */
        speak(txt);
      };
    });

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
        noteDemo();
        /* проверка на метод — не суеверие: в jsdom его нет, и без неё падал бы
           обработчик, а не прокрутка */
        if (studio.scrollIntoView) studio.scrollIntoView({ behavior:"smooth", block:"center" });
      };
    });

    var lintBtn = document.getElementById("lintbtn");
    if (lintBtn) lintBtn.onclick = function(){
      studio.lintShow();
      /* проверка на наличие метода — не суеверие: в тестовом окружении
         (jsdom) его нет, и без неё падал бы обработчик, а не прокрутка */
      if (studio.scrollIntoView) studio.scrollIntoView({ behavior:"smooth", block:"center" });
    };
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
        if (g === "zan") return screenZan();
        if (g === "worlds") screenWorlds(); else screenWorld(l.world);
      };
    });
    app.querySelectorAll("[data-open]").forEach(function(b){
      b.onclick = function(){ openLesson(b.getAttribute("data-open")); };
    });

    var wtOpen = document.getElementById("wt-open");
    if (wtOpen) wtOpen.onclick = function(){
      var wt = document.getElementById("worktask"), full = document.getElementById("wt-full");
      var open = !wt.classList.contains("open");
      wt.classList.toggle("open", open);
      full.hidden = !open;
      wtOpen.setAttribute("aria-expanded", open ? "true" : "false");
      /* Однострочник и раскрытый текст — это одна и та же цель задания.
         Показывать их вместе значит напечатать её на экране дважды подряд
         (так и было видно на уроке 6), поэтому лишний всегда спрятан. */
      var txt = wtOpen.querySelector(".wttxt");
      if (txt) txt.hidden = open;
      /* Подпись обязана говорить, что случится по нажатию, а не в каком мы
         состоянии: «показать целиком» на раскрытом блоке — прямая ложь. */
      var chev = wtOpen.querySelector(".wtchev");
      if (chev) chev.textContent = open ? "свернуть ▴" : "показать задание целиком ▾";
    };

    refreshTop();
    /* полоска задания заводится ПОСЛЕ отрисовки: ей нужна живая карточка */
    syncTopHeight();
    taskPinShow(app.querySelector(".goal"));
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

  /* Цена программы в шагах: сколько операций движок выполнил. Считать
     отдельно ничего не надо — интерпретатор и так их считает ради защиты от
     вечного цикла, а run() отдаёт число наружу. Запоминаем здесь: в победной
     карточке уже нет результата запуска. */
  session.steps = res.steps || 0;
  session.refSteps = stepsOfRef(body, refSrcs, stdin);
  session.code = code;      /* для разбора «как чище» в победной карточке */
  /* Запись авторства снимается ЗДЕСЬ, а не в winLesson: там редактора уже нет
     под рукой, а счётчики живут в нём. */
  session.trace = ed.trace || null;
  session.allCode = весьКод;

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
/* ===== цена программы в шагах =====
   Своя же машина считает: сколько операций выполнил интерпретатор. Это не
   «сложность из учебника», а настоящее число, которое ребёнок сам двигает
   вниз, переписывая цикл. Соревнование — со вчерашним собой, а не с другими:
   рекорд хранится в S.log[id].bestSteps.

   Черепашку и случайность считать бессмысленно (рисунок и seed делают число
   произвольным), поэтому там цену не показываем. */
function stepsOfRef(body, refSrcs, stdin){
  try {
    var r = Runtime.get("mini").run(body.task.solution, {
      turtle: Runtime.get("mini").newTurtle ? Runtime.get("mini").newTurtle() : null,
      sources: refSrcs, files: dataFiles(body.task.data), stdin: stdin
    });
    return r.error ? 0 : (r.steps || 0);
  } catch (e){ return 0; }
}
function stepsShown(body){
  if (!body || !body.task) return false;
  if (body.draw) return false;                       /* черепашка: шаги зависят от длин линий */
  var k = body.task.check && body.task.check.kind;
  if (k === "turtle" || k === "custom") return false;
  return /\b(randint|choice|shuffle|sample|random)\s*\(/.test(String(body.task.solution || "")) === false;
}
/* Строка про цену в победной карточке. Ругать за длинную программу нельзя:
   ребёнок только что её дописал и она работает. Поэтому говорим фактом, а
   «можно короче» — только когда разница действительно велика. */
function stepsNote(l, body, lean){
  if (!stepsShown(body)) return "";
  var mine = session.steps || 0, ref = session.refSteps || 0;
  if (!mine) return "";
  var lg = logOf(l.id);
  var prev = lg.bestSteps || 0;
  var record = !prev || mine < prev;
  if (record) lg.bestSteps = mine;
  var line = '<p class="stepnote">⚙️ Твоя программа — <b>' + mine + '</b> ' +
    plural(mine, "шаг", "шага", "шагов") + " движка";
  if (ref) line += ", решение автора — " + ref;
  line += ".";
  if (prev && mine < prev) line += " <b>Твой рекорд был " + prev + " — побит.</b>";
  else if (prev && mine > prev) line += " Твой рекорд по этому уроку — " + prev + ".";
  line += "</p>";
  return line + leanNote(lean, mine, ref);
}
/* Строка про цель. Ругать за промах нельзя — программа только что заработала,
   и это главное. Поэтому промах звучит как открытое приглашение вернуться, а
   не как двойка: звёзды за перепрохождение не отнимаются. */
function leanNote(lean, mine, ref){
  if (!lean || !lean.show) return "";
  if (lean.shown)
    return '<p class="stepnote">🎯 Цель «уложиться не дороже ' + ref + ' ' +
      plural(ref, "шага", "шагов", "шагов") + '» на этот раз не считается: ' +
      'в редакторе решение автора. Пройди урок сам — и цель будет твоей.</p>';
  if (lean.hit)
    return '<p class="stepnote lean">🪶 <b>Цель выполнена:</b> ' +
      (mine === ref
        ? 'ровно столько же, сколько у автора — ' + mine + ' ' + plural(mine, "шаг", "шага", "шагов") + '.'
        : mine + ' ' + plural(mine, "шаг", "шага", "шагов") + ' вместо ' + ref + ' у автора — короче.') +
      (lean.first ? ' <b>+' + lean.xp + ' XP</b> — за цель платят один раз на урок.' : '') + '</p>';
  return '<p class="stepnote">🎯 <b>Цель:</b> уложиться в ' + ref + ' ' +
    plural(ref, "шаг", "шага", "шагов") + ' — столько стоит решение автора. ' +
    'Урок уже пройден, звёзды никуда не денутся: вернись и попробуй переписать короче, когда захочется.</p>';
}

/* ===== цель по шагам =====
   Цена программы считалась и раньше, но говорилась фактом: «твоя программа —
   340 шагов, решение автора — 120». Факт ничего не просит, и ребёнок шёл
   дальше. Цель просит: «уложись не дороже решения автора».

   Почему именно «не дороже», а не «короче»: эталон написан человеком и до
   предела не выжат, поэтому цель достижима без трюков. А требование «меньше»
   толкало бы к нечитаемым однострочникам — ровно к тому, от чего курс
   отучает в уроке про PEP 8.

   Надбавка даётся ОДИН раз на урок: цель — повод переписать программу, а не
   источник опыта. Показанное решение цель не засчитывает: код автора, конечно,
   уложился бы в цену автора, и медаль за это была бы обманом. */
var LEAN_XP = 10;          /* разовая надбавка за попадание в цель */
var LEAN_BADGE_AT = 5;     /* столько уроков в цель — и бейдж «Лёгкая рука» */

function leanCount(){
  var n = 0, log = S.log || {};
  Object.keys(log).forEach(function(k){ if (log[k] && log[k].lean) n++; });
  return n;
}
/* Считается ПЕРЕД сборкой победной карточки: надбавка должна попасть в опыт
   до refreshTop, иначе полоска и карточка разошлись бы на 10 XP. */
function leanAward(l, body){
  var out = { show:false, mine:0, ref:0, hit:false, first:false, xp:0, shown:!!session.shown };
  if (!stepsShown(body)) return out;
  var mine = session.steps || 0, ref = session.refSteps || 0;
  if (!mine || !ref) return out;
  out.show = true; out.mine = mine; out.ref = ref;
  if (out.shown) return out;                  /* решение показано — цель не в счёт */
  out.hit = mine <= ref;
  if (!out.hit) return out;
  var lg = logOf(l.id);
  if (!lg.lean){ lg.lean = 1; out.first = true; out.xp = LEAN_XP; S.xp += LEAN_XP; }
  if (leanCount() >= LEAN_BADGE_AT) award("lean");
  return out;
}

/* Сколько советов «как сделать чище» есть по только что зачтённому коду.
   Сам разбор в победную карточку не выносим: она и без него из шести блоков,
   а совет требует спокойного чтения. Поэтому здесь только приглашение. */
function lintCount(l, body){
  if (!session.code || (body.task && body.task.files)) return 0;
  var found = lintCode(session.code,
    { needCode: (body.task.check && body.task.check.needCode) || null });
  return found ? found.length : 0;
}
/* Про полку говорим ровно в тот момент, когда на неё что-то легло. Отдельного
   экрана-объявления не заводим: накопление должно ощущаться как побочный
   подарок за работу, а не как ещё одна вкладка, которую надо изучить. */
function partsNote(n){
  if (!n) return "";
  return '<p class="stepnote">🔧 На полку мастерской ' +
    (n === 1 ? 'легла деталь' : 'легли детали') + ': ' + n + ' ' +
    plural(n, "функция", "функции", "функций") + ', которые ты написал сам. ' +
    'Из деталей потом собирается вещь — «Моё» → «Мастерская».</p>';
}
function lintNote(n){
  if (!n) return "";
  return '<p class="stepnote">🧹 Программа работает — и её можно сделать чище: ' +
    'разбор нашёл ' + n + ' ' + plural(n, "замечание", "замечания", "замечаний") +
    '. Кнопка «Ревью кода» под редактором, звёзды за это не отнимаются.</p>';
}

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
  var lean = leanAward(l, body);   /* до save/refreshTop: надбавка идёт в тот же опыт */
  var tidy = lintCount(l, body);   /* сколько советов «как чище» есть по этому коду */
  var lg = logOf(l.id);
  lg.stars = Math.max(lg.stars || 0, stars);
  /* ===== запись авторства пишется ОДИН раз, на первой сдаче =====
     Повторное прохождение того же урока запись не переписывает: она
     свидетельствует о том, как урок был сдан впервые, а не о последнем
     заходе. Иначе достаточно было бы пройти урок ещё раз, чтобы запись
     «часть пришла готовой» исчезла, — и грош ей тогда цена. */
  if (!lg.tr && session.trace){
    var starterLen = (session.starter || []).reduce(function(a, f){ return a + (f.code || "").length; }, 0);
    var mineCode = session.allCode || session.code || "";
    lg.tr = {
      at: Date.now(),
      typed: session.trace.typed || 0,
      pasted: session.trace.pasted || 0,
      own: session.trace.own || 0,
      edits: session.trace.edits || 0,
      len: mineCode.length,
      slen: starterLen,
      shown: session.shown ? 1 : 0,
      hints: session.hints || 0,
      /* «Вперёд программы» считаем от того, что этому заданию и так нужно:
         конструкция из эталонного решения — это работа по уроку, а не
         забег вперёд. Проверено на всех ста уроках курса. */
      ahead: aheadIn(mineCode, [body.task.starter || "", body.task.solution || ""].join("\n"))
    };
  }
  if (!lg.solvedAt) lg.solvedAt = Date.now();
  lg.last = Date.now();
  reviewAfterLesson(l.id);   /* трудный урок встаёт в очередь на повтор */
  markActiveToday();   /* пройденный урок держит дневной стрик живым */
  /* ⚠️ ДО zanNote: последний блок плана закрывает занятие сам, и программа,
     положенная после, легла бы в уже закрытое занятие. Многофайловые уроки
     не кладём — вопрос задаётся про одну страницу кода. */
  if (!(body.task && body.task.files)) zanKeepProg(l.id, session.code || "");
  var gotParts = partsHarvest(l, body);   /* функции, написанные самим, идут на полку */
  zanNote("lesson", l.id);   /* если идёт занятие — шаг плана закрыт */
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
    takeShieldNote() + reviewNote(l.id) + stepsNote(l, body, lean) + lintNote(tidy) +
    partsNote(gotParts) +
    '<div class="winxp">+' + (gained + lean.xp) + ' XP</div><div class="winrow">' +
      /* Идёт занятие — возвращаем В ЗАНЯТИЕ, а не в следующий урок. Иначе
         «Дальше →» уносит мимо плана, и разговор «время вышло, что дальше»
         не случается никогда: ребёнок просто едет вперёд, пока не надоест. */
      (zanOpen() ? '<button class="bigbtn" id="wzan">← К занятию</button>'
                 : (next ? '<button class="bigbtn" id="wnext">Дальше →</button>'
                         : '<button class="bigbtn" id="wlist">К списку уроков</button>')) +
      '<button class="bigbtn ghost" id="wstay">Остаться здесь</button>' +
      workShareHTML(session && session.code) + '</div>';
  document.getElementById("win").classList.add("show");
  confetti(stars);
  sfx(stars === 3 ? "win3" : "win");
  var wsh = document.getElementById("wshare");
  if (wsh) wsh.onclick = function(){
    copyText(workLink({ title: l.title, code: session.code, author: myName() }), wsh);
  };
  var wn = document.getElementById("wnext");
  if (wn) wn.onclick = function(){ closeWin(); openLesson(next.id); };
  var wl = document.getElementById("wlist");
  if (wl) wl.onclick = function(){ closeWin(); screenWorld(l.world); };
  var wz = document.getElementById("wzan");
  if (wz) wz.onclick = function(){ closeWin(); screenZan(); };
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
  enterScreen("train", "sand");
  /* sandbox:true — метка для draftFlush: уход с этого экрана обязан сохранить код */
  session = { id:null, attempts:0, hints:0, shown:false, sandbox:true };
  var ref = ["forward(100)","back(50)","right(90)","left(90)",'color("red")',"width(5)","penup()","pendown()",
             "goto(0, 0)","dot(10)","circle(60)","print(x)","range(10)","len(s)","sum(xs)","randint(1, 6)","sqrt(16)"];
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">свободный режим</div><h1>Песочница</h1></div></div>' +
    '<p class="lede">Никаких заданий и проверок. Пиши что угодно, запускай, ломай и чини. Код сохраняется между заходами.</p>' +
    '<div class="card"><h3>Что можно позвать</h3><div class="ref">' +
      ref.map(function(x){ return "<span>" + esc(x) + "</span>"; }).join("") +
    '</div><p class="dim">Нажми на команду — она вставится в конец кода.</p></div>' +
    '<div id="studio"></div>' +
    '<div class="savepic"><button class="rbtn" id="topic">🖼 Сохранить рисунок в галерею</button>' +
    '<span class="tip">Рисунки лежат в портфолио — их можно показать и скачать картинкой. ' +
    'Первая строка-комментарий станет названием.</span>' +
    '<div class="msg" id="picmsg"></div></div>' +
    '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';

  var studio = makeStudio({
    engine:"mini", draw:true, code: S.sandbox || SANDBOX_START,
    onRun: function(){
      S.sandboxRuns = (S.sandboxRuns || 0) + 1;
      S.sandbox = studio.editor.getCode();
      if (S.sandboxRuns >= 10) award("explorer");
      save();
    },
    lint: true,
    /* Уход в разбор сохраняет код песочницы: draftFlush в claimScreen видит
       метку sandbox и пишет S.sandbox — поэтому возврат ничего не теряет. */
    viz: function(o){
      screenViz({ code: o.code, env: o.env,
        backTo: { label: "← Вернуться в песочницу", go: screenSandbox } });
    }
  });
  document.getElementById("studio").appendChild(studio);
  session.studio = studio;
  studio.editor.onEdit = draftSchedule;
  app.querySelectorAll(".ref span").forEach(function(sp){
    sp.onclick = function(){
      var c = studio.editor.getCode();
      studio.editor.setCode(c + (!c || /\n$/.test(c) ? "" : "\n") + sp.textContent + "\n");
      studio.editor.focusEditor();
    };
  });
  document.getElementById("topic").onclick = function(){
    var code = studio.editor.getCode();
    var m = document.getElementById("picmsg");
    var res = galleryDrawing(code);
    if (!res || res.error){
      m.className = "msg show bad";
      m.innerHTML = res && res.error
        ? "<b>Программа падает</b>Сначала пусть заработает: " + esc(res.error.msg)
        : "<b>Не получилось</b>Черепашка в этом движке недоступна.";
      return;
    }
    if (res.empty){
      m.className = "msg show warn";
      m.innerHTML = "<b>Рисунка нет</b>Программа не нарисовала ни линии, ни точки. " +
        "Проверь, что вызываешь forward(...) и что карандаш опущен.";
      return;
    }
    S.sandbox = code;
    var id = gallerySave(code);
    var t = (galleryAll()[id] || {}).title || "Рисунок";
    m.className = "msg show ok";
    m.innerHTML = "<b>«" + esc(t) + "» в галерее</b>Открыть, показать и скачать картинкой — " +
      "в портфолио, раздел «Мои рисунки». Хранится программа, а не картинка: рисунок " +
      "считается заново каждый раз, поэтому места занимает несколько строк.";
  };
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
  enterScreen("train", "games");
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
  h += '</div><div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
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
  enterScreen("train", "game");
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
/* Разминка «откроется позже» — не каприз, а защита от бессмыслицы: упражнение
   про zip ребёнку из Мира 1 читать нечем, а задача дня, которую нечем читать,
   отбивает охоту заходить. Поле lesson — урок, после которого разминка
   перестаёт быть загадкой; разминка без lesson открыта всегда. */
function warmupOpen(w){
  return !w || !w.lesson || solved(w.lesson) || !!(S.admin && S.admin.unlockAll);
}
function warmupsOpen(){ return warmupsList().filter(warmupOpen); }

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
  var bad = firstDiff(W, G);
  var head = bad < 0
    ? "Строк должно быть " + W.length + ", а получилось " + G.length + "."
    : "Первое расхождение в строке " + (bad + 1) + ".";
  var d = whyDiffer(W, G, "Ты пока ничего не написал в поле ответа — напиши, что, по-твоему, напечатает программа, по строке на каждый print.");
  if (d.why) head = d.why + " " + head;
  return head + cmpBlock(wantLabel, W, gotLabel, G, 10, d.vis);
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
  enterScreen(null, "register");
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
/* Копирование в буфер. Раньше отказ современного способа (а браузер отказывает
   легко: нет разрешения, страница во фрейме, нет жеста) приводил к тишине —
   ребёнок жал кнопку, и не менялось ничего. Теперь отказ ПАДАЕТ на старый способ
   через невидимое поле, и надпись на кнопке меняется в обоих случаях. */
function copyText(text, btn){
  var done = function(){ if (btn){ var t = btn.textContent; btn.textContent = "Скопировано ✓"; setTimeout(function(){ btn.textContent = t; }, 1500); } };
  var oldWay = function(){
    try {
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove(); done();
    } catch(e2){}
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done, oldWay);
      return;
    }
  } catch(e){}
  oldWay();
}
function screenAccount(){
  enterScreen(null, "account");
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
    '<div class="card"><h3>Портфолио</h3>' +
    '<p class="dim">Готовые программы и сертификаты в одном месте — то, что можно показать.</p>' +
    '<div class="winrow"><button class="bigbtn ghost" id="gofolio">🎒 Открыть портфолио</button></div></div>' +
    /* Оформление стоит в профиле, а не только в помощи: настройку ищут там,
       где настройки, а не там, где подсказки. Дублирование тут дешевле
       ненайденной кнопки. */
    '<div class="card"><h3>Оформление</h3>' +
    '<p class="dim">Светлая тема стоит по умолчанию — тёмный фон тяжело читать днём. ' +
    'Выбор запоминается на этом устройстве и на другие не переезжает.</p>' +
    '<div class="themepick" id="acctheme">' +
      '<button data-theme-set="light">☀️ Светлая</button>' +
      '<button data-theme-set="dark">🌙 Тёмная</button>' +
    '</div></div>' +
    /* Звук стоит рядом с оформлением по той же причине: настройку ищут там,
       где настройки. Про «этом устройстве» сказано прямо — иначе родитель
       выключит дома и удивится, что в кружке снова звенит. */
    '<div class="card"><h3>Звук</h3>' +
    '<p class="dim">Короткие сигналы на победу, новый бейдж и ошибку. Выбор запоминается ' +
    'на этом устройстве и на другие не переезжает: дома можно со звуком, за общим столом — без.</p>' +
    '<div class="themepick" id="accsfx">' +
      '<button data-sfx-set="on">🔔 Со звуком</button>' +
      '<button data-sfx-set="off">🔕 Тихо</button>' +
    '</div>' +
    (voiceSupported()
      ? '<p class="dim" style="margin-top:14px">Кнопка 🔊 на карточках урока читает текст вслух ' +
        'по нажатию — она работает всегда. Здесь включается только автоматическое чтение: ' +
        'объяснение ошибки проговаривается само. Полезно младшим и тем, кому тяжело читать с экрана.</p>' +
        '<div class="themepick" id="accvoice">' +
          '<button data-voice-set="on">🗣 Читать ошибки</button>' +
          '<button data-voice-set="off">Не читать</button>' +
        '</div>'
      : '<p class="dim" style="margin-top:14px">Чтение вслух этот браузер не умеет — кнопок ' +
        '🔊 не будет. Сигналы событий при этом работают.</p>') +
    '</div>' +
    (installPossible()
      ? '<div class="card"><h3>Приложение на домашнем экране</h3>' +
        '<p class="dim">Иконка вместо вкладки: открывается сразу на уроке, без адресной строки, ' +
        'и работает без интернета. На iPhone напоминания о занятии возможны только так.</p>' +
        installTipHTML(true) + '</div>'
      : '') +
    '<div class="card"><h3>Как пользоваться</h3>' +
    '<p class="dim">Полная инструкция: устройство сайта, из чего состоит урок, откуда берутся ' +
    'звёзды и что делать, когда не получается. Есть кусок для родителя.</p>' +
    '<div class="winrow"><button class="bigbtn ghost" id="goguide">❓ Открыть инструкцию</button></div></div>' +
    '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  app.innerHTML = h;

  var cc = document.getElementById("copycode");
  if (cc) cc.onclick = function(){ copyText(code, cc); };
  var cl = document.getElementById("copylink");
  if (cl) cl.onclick = function(){ copyText(link, cl); };
  wireInstallTip(app);
  document.getElementById("gofolio").onclick = screenFolio;
  document.getElementById("goguide").onclick = screenGuide;
  var paintTheme = function(){
    app.querySelectorAll("#acctheme button").forEach(function(b){
      b.classList.toggle("on", b.getAttribute("data-theme-set") === themeGet());
    });
  };
  app.querySelectorAll("#acctheme button").forEach(function(b){
    b.onclick = function(){ themeSet(b.getAttribute("data-theme-set")); paintTheme(); };
  });
  paintTheme();
  var paintSound = function(){
    app.querySelectorAll("#accsfx button").forEach(function(b){
      b.classList.toggle("on", (b.getAttribute("data-sfx-set") === "on") === sfxOn());
    });
    app.querySelectorAll("#accvoice button").forEach(function(b){
      b.classList.toggle("on", (b.getAttribute("data-voice-set") === "on") === voiceAuto());
    });
  };
  app.querySelectorAll("#accsfx button").forEach(function(b){
    b.onclick = function(){
      var on = b.getAttribute("data-sfx-set") === "on";
      sfxSet(on); paintSound();
      /* Дать услышать сразу: иначе выбор проверяется только следующей
         победой, то есть через целый урок. */
      if (on) sfx("badge");
    };
  });
  app.querySelectorAll("#accvoice button").forEach(function(b){
    b.onclick = function(){
      var on = b.getAttribute("data-voice-set") === "on";
      voiceAutoSet(on); paintSound();
      if (on) speak("Чтение вслух включено.");
    };
  });
  paintSound();
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

/* карточка занятия на экране «Сегодня»: главная кнопка дня */
function zanCardHTML(){
  var open = zanOpen(), f = frame();
  var doneToday = zanOfDay(dayKey()).filter(function(z){ return z.end; }).length;
  var restDay = frameOn() && !frameStudyDay(dayKey());
  if (open){
    var closed = zanClosedCount(open);
    var pct = Math.min(100, Math.round((closed / Math.max(1, open.plan.length)) * 100));
    return '<div class="card zancard on"><h3>⏱ Занятие идёт</h3>' +
      '<div class="zanbar"><i style="width:' + pct + '%"></i></div>' +
      '<p>Сделано ' + open.done.length + ' из ' + open.plan.length +
      ((open.cut || []).length ? ', перенесено ' + open.cut.length : '') + '. Работы: ' +
      zanMins(open) + ' ' + plural(zanMins(open), "минута", "минуты", "минут") + '.</p>' +
      '<div class="winrow"><button class="bigbtn" id="zancont">Продолжить занятие</button></div></div>';
  }
  if (doneToday){
    return '<div class="card zancard done"><h3>🏁 Занятие сегодня пройдено</h3>' +
      '<p>' + (doneToday > 1 ? "Занятий сегодня: " + doneToday + "." : "Одно занятие закрыто.") +
      ' Можно заниматься дальше просто так — это ничего не меняет и ни на что не влияет.</p>' +
      '<div class="winrow"><button class="bigbtn ghost" id="zanmore">Открыть ещё занятие</button></div></div>';
  }
  if (capHard())
    return '<div class="card zancard"><h3>🌙 На сегодня всё</h3>' +
      '<p>Сегодня за тренажёром уже ' + todayMinutes() + ' ' +
      plural(todayMinutes(), "минута", "минуты", "минут") +
      ' — столько вы договорились со взрослым. Новое занятие откроется завтра.</p></div>';
  return '<div class="card zancard"><h3>⏱ Занятие на ' + f.len + ' минут</h3>' +
    '<p>' + (restDay
      ? "Сегодня по расписанию день отдыха — но если хочется, занятие можно провести."
      : "Разминка, уроки и проверка в конце. Ты заранее знаешь, сколько это займёт и когда конец.") + '</p>' +
    '<div class="winrow"><button class="bigbtn" id="zanstart">Начать занятие</button></div></div>';
}
/* задания от взрослого: показываем только невыполненные */
function ptaskCardHTML(){
  var list = ptaskPending();
  if (!list.length) return "";
  return '<div class="card ptcard"><h3>✉️ Задание от взрослого</h3>' +
    list.slice(0, 3).map(function(x){
      var l = x.ref ? CURRICULUM.byId(x.ref) : null;
      return '<div class="ptrow"><span>' + esc(x.text) + '</span>' +
        (x.t === "ask"
          ? '<button class="rbtn check" data-ptdone="' + x.key + '">Рассказал</button>'
          : '<button class="rbtn check" data-ptopen="' + x.key + '" data-ptref="' + esc(x.ref) + '">' +
            (l ? "Открыть" : "Открыть") + '</button>') + '</div>';
    }).join("") +
    '<p class="dim">Звёзд за это не даётся: это просьба взрослого, а не урок из сотни.</p></div>';
}

function screenToday(){
  enterScreen(undefined, "today");
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
    /* Ноль открытых разминок — это нормальное начало пути, а не поломка */
    taskCard = '<div class="card"><h3>🔥 Задача дня появится совсем скоро</h3>' +
      '<p>Она берётся из разминок, а разминка открывается после урока, на котором ' +
      'её можно прочитать. Пройди первые уроки Мира 1 — и задача дня появится тут сама.</p></div>';
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

  /* редактор дней занятий: понедельник … воскресенье.
     Если рамку задал взрослый — показываем её и НЕ даём двигать: рамка это
     уговор двоих, а не настройка ребёнка. Своё расписание при этом никуда не
     девается и вернётся, если рамку снимут. */
  var schedBox;
  if (frameOn()){
    var fd = frame().days.slice().sort(function(a,b){ return WD_ORDER.indexOf(a) - WD_ORDER.indexOf(b); })
      .map(function(n){ return WD_SHORT[n]; }).join(", ");
    schedBox = '<div class="card schedcard"><h3>📅 Дни занятий</h3>' +
      '<p>Занятия по ' + fd + ', по ' + frame().len + ' минут. Это назначил взрослый.</p>' +
      (isBreakDay(dayKey()) ? '<p class="dim">Сегодня каникулы — пропуск запланирован, это не прогул.</p>' : '') +
      '</div>';
  } else {
    var chips = WD_ORDER.map(function(n){
      var sel = scheduleDays().indexOf(n) >= 0;
      return '<button class="wdchip' + (sel ? " sel" : "") + '" data-wd="' + n + '">' + WD_SHORT[n] + '</button>';
    }).join("");
    schedBox = '<div class="card schedcard"><h3>📅 Дни занятий</h3>' +
      '<p class="dim">Отметь дни недели, когда планируешь заниматься. В такие дни на этом экране и на кнопке 🔥 появится напоминание. ' +
      'Если не выбрано ничего — напоминаний нет.</p>' +
      '<div class="wdrow">' + chips + '</div>' +
      (hasSchedule() ? '<p class="dim">Учебные дни: ' +
        scheduleDays().slice().sort(function(a,b){ return WD_ORDER.indexOf(a) - WD_ORDER.indexOf(b); })
          .map(function(n){ return WD_SHORT[n]; }).join(", ") + '.</p>' : '') +
      '</div>';
  }

  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">заходи каждый день</div><h1>🔥 Сегодня</h1></div>' +
      '<div class="right"><span class="tag">дней подряд: ' + streak + '</span></div></div>' +
    '<p class="lede">Одна маленькая задача в день и серия, которую жалко прерывать. ' +
    'Звёзды тут не начисляются — важна привычка возвращаться.</p>' +
    installTipHTML() + saved + banner + capNoteHTML() + zanCardHTML() + ptaskCardHTML() + hero + taskCard + schedBox +
    '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';

  wireInstallTip(app);
  var dopen = document.getElementById("dopen");
  if (dopen && pick) dopen.onclick = function(){ openWarmup(pick.id, { daily:true }); };
  var dwarm = document.getElementById("dwarm");
  if (dwarm) dwarm.onclick = screenWarmups;
  app.querySelectorAll("[data-wd]").forEach(function(b){
    b.onclick = function(){ toggleStudyDay(+b.getAttribute("data-wd")); screenToday(); };
  });
  var zs = document.getElementById("zanstart");
  if (zs) zs.onclick = function(){ zanStart(); screenZan(); };
  var zc = document.getElementById("zancont");
  if (zc) zc.onclick = screenZan;
  var zm = document.getElementById("zanmore");
  if (zm) zm.onclick = function(){ zanStart(); screenZan(); };
  app.querySelectorAll("[data-ptdone]").forEach(function(b){
    b.onclick = function(){ ptaskMarkDone(b.getAttribute("data-ptdone")); screenToday(); };
  });
  app.querySelectorAll("[data-ptopen]").forEach(function(b){
    b.onclick = function(){
      ptaskMarkDone(b.getAttribute("data-ptopen"));
      var ref = b.getAttribute("data-ptref");
      if (ref) openLesson(ref); else screenWorlds();
    };
  });
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function screenWarmups(){
  enterScreen("train", "warm");
  session = { id:null, attempts:0, hints:0, shown:false };
  var ws = warmupsList();
  var open = warmupsOpen();
  var done = open.filter(function(w){ return warmupDone(w.id); }).length;
  var locked = ws.length - open.length;
  var h = '<div class="lvlhead"><div><div class="idx">думай, потом проверяй</div><h1>🔮 Разминка</h1></div>' +
    '<div class="right"><span class="tag">разгадано ' + done + ' из ' + open.length + '</span></div></div>' +
    '<p class="lede">Короткие загадки «угадай вывод». Прочитай программу и запиши, что она напечатает, — до запуска. ' +
    'Это тренирует главное умение программиста: держать ход программы в голове. Звёзды тут не начисляются, ошибаться можно сколько угодно.</p>' +
    '<div class="gamegrid">';
  ws.forEach(function(w){
    /* Закрытые не прячем, а показываем замком: видно, что впереди есть ещё,
       и понятно, какой урок это откроет. Спрятанное просто не существует. */
    var op = warmupOpen(w);
    var les = op ? null : CURRICULUM.byId(w.lesson);
    h += '<button class="gamecard' + (op ? "" : " locked") + '" data-id="' + w.id + '"' +
      (op ? "" : " disabled") + '>' +
      '<span class="gemoji">' + (op ? w.emoji : "🔒") + '</span>' +
      '<b>' + esc(w.title) + (op && warmupDone(w.id) ? ' <span class="edittag done">разгадано ✓</span>' : '') + '</b>' +
      '<span>' + (op ? esc(w.intro)
                     : "Откроется после урока " + (les ? les.num + " «" + esc(les.title) + "»" : "из программы")) + '</span>' +
      '<span class="wtag">' + esc(w.tag) + '</span></button>';
  });
  h += '</div><div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  app.innerHTML = h;
  app.querySelectorAll(".gamecard").forEach(function(b){
    b.onclick = function(){ if (!b.disabled) openWarmup(b.getAttribute("data-id")); };
  });
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function openWarmup(id, opts){
  var ws = warmupsList();
  var w = ws.filter(function(x){ return x.id === id; })[0];
  if (!w) return screenWarmups();
  enterScreen("train", "warmup");
  var isDaily = !!(opts && opts.daily);
  session = { id:id, attempts:0, hints:0, shown:false, daily:isDaily };
  /* из задачи дня «назад» и списки ведут на экран «Сегодня», а не в разминку */
  var backFn = isDaily ? screenToday : screenWarmups;
  var pos = ws.indexOf(w);
  var next = isDaily ? null : (pos < ws.length - 1 ? ws[pos+1] : null);
  var prev = isDaily ? null : (pos > 0 ? ws[pos-1] : null);

  var isBlocks = w.type === "blocks";
  var isMemory = w.type === "memory";
  var crumbRoot = isDaily
    ? '<span data-go="back">Сегодня</span> › 🔥 Задача дня'
    : '<span data-go="back">Разминка</span>';
  var head = '<div class="crumbs">' + crumbRoot + ' › ' + w.emoji + ' ' + esc(w.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">' + (isBlocks ? "собери из блоков" : isMemory ? "предскажи память" : "угадай вывод") + '</div><h1>' + w.emoji + ' ' + esc(w.title) + '</h1></div>' +
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
    : isMemory
    ? makeMemoryStudio({ w: w, check: function(ed, showMsg){ runMemoryCheck(w, ed, showMsg); } })
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

/* ===== «Предскажи память» =====
   Все тренажёры просят угадать ВЫВОД программы. Здесь спрашивают ПАМЯТЬ:
   что лежит в переменных в тот момент, когда программа замерла перед
   подсвеченной строкой. Печать тут ни при чём.

   Так можно только со своим движком: нужен пошаговый прогон и снимок кучи.
   Правильный ответ не записан в задании — его СЧИТАЕТ тот же снимок, который
   потом рисует визуализатор. Значит вопрос и картинка не могут разойтись. */
function memFrame(w){
  var rec = vizRecord(w.code);
  var hits = rec.frames.filter(function(f){ return f.line === w.stop; });
  return hits.length ? hits[0] : null;
}
function memAnswers(w){
  var f = memFrame(w), out = {};
  if (!f) return out;
  (w.ask || []).forEach(function(n){
    var v = f.vars.filter(function(x){ return x.name === n; })[0];
    out[n] = v ? vizShort(v.cell, f.objects) : null;
  });
  return out;
}
/* Сравнение мягкое там, где мягкость не врёт: кавычки любые, пробелы вокруг
   запятых и скобок не важны. А вот пробел ВНУТРИ строки важен — поэтому
   пробелы не выбрасываются целиком, а только приклеенные к знакам. */
function memNorm(v){
  return String(v === null || v === undefined ? "" : v)
    .replace(/[\u201c\u201d\u00ab\u00bb"]/g, "'")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*([,:\[\]{}()])\s*/g, "$1");
}
function makeMemoryStudio(cfg){
  var w = cfg.w;
  var wrap = document.createElement("div");
  wrap.className = "predict memq";

  var lines = String(w.code).replace(/\n+$/, "").split("\n");
  var codeHTML = lines.map(function(t, i){
    var here = (i + 1) === w.stop;
    return '<div class="mline' + (here ? " here" : "") + '">' +
      '<span class="ln">' + (i + 1) + '</span>' +
      '<code>' + (hl(t) || "&nbsp;") + '</code>' +
      (here ? '<span class="mstop">⏸ замерли здесь</span>' : '') + '</div>';
  }).join("");

  var codeBox = document.createElement("div");
  codeBox.className = "pcode";
  codeBox.innerHTML = '<div class="ehead"><span class="dot"></span><span class="dot"></span>' +
    '<span class="dot"></span><span class="lbl">программа — только читаем</span></div>' +
    '<div class="mlines">' + codeHTML + '</div>';

  var ansBox = document.createElement("div");
  ansBox.className = "pane pans";
  ansBox.innerHTML = '<div class="ph">что сейчас в памяти?</div><div class="pb"><div class="memrows">' +
    (w.ask || []).map(function(n){
      return '<label class="memrow"><b>' + esc(n) + '</b><span class="veq">=</span>' +
        '<input type="text" class="memin" data-name="' + esc(n) + '" spellcheck="false" ' +
        'autocapitalize="off" autocorrect="off" placeholder="значение"></label>';
    }).join("") +
    '</div><div class="stdinhint">Пиши так, как это напечатал бы print(значение): ' +
    'список — в квадратных скобках, строка — в кавычках. Кавычки любые.</div></div>';

  var runbar = document.createElement("div");
  runbar.className = "runbar";
  runbar.innerHTML = '<button class="rbtn check" data-role="check">✓ Проверить</button>' +
    '<button class="rbtn sec" data-role="clear">↺ Очистить</button>' +
    '<span class="sp"></span><span class="tip">сначала пройди программу в голове</span>';

  var msg = document.createElement("div"); msg.className = "msg";
  var memPane = document.createElement("div"); memPane.className = "pane pout"; memPane.style.display = "none";
  memPane.innerHTML = '<div class="ph">память на самом деле</div><div class="pb"><div class="vizmem"></div></div>';

  wrap.appendChild(codeBox); wrap.appendChild(ansBox);
  wrap.appendChild(runbar); wrap.appendChild(msg); wrap.appendChild(memPane);

  function showMsg(cls, html){ msg.className = "msg show " + cls; msg.innerHTML = html; }
  wrap.showMsg = showMsg;
  wrap.editor = {
    /* «код» этой студии — ответы ребёнка: имя=значение по строке. Так их
       умеет и прочитать проверка, и подставить кнопка «показать» в тестах. */
    getCode: function(){
      return [].map.call(wrap.querySelectorAll(".memin"), function(i){
        return i.getAttribute("data-name") + "=" + i.value;
      }).join("\n");
    },
    setCode: function(v){
      var map = {};
      String(v).split("\n").forEach(function(l){
        var k = l.indexOf("=");
        if (k > 0) map[l.slice(0, k).trim()] = l.slice(k + 1);
      });
      [].forEach.call(wrap.querySelectorAll(".memin"), function(i){
        var n = i.getAttribute("data-name");
        if (map[n] !== undefined) i.value = map[n];
      });
    },
    focusEditor: function(){ var f = wrap.querySelector(".memin"); if (f) f.focus(); }
  };
  /* показать настоящую память — той же разметкой, что и визуализатор */
  wrap.reveal = function(){
    var f = memFrame(w);
    if (!f) return;
    memPane.style.display = "";
    var box = memPane.querySelector(".vizmem");
    box.innerHTML = vizMemoryHTML(f, null);
    vizDrawArrows(box);
  };

  runbar.addEventListener("click", function(e){
    var b = e.target.closest("button"); if (!b) return;
    if (b.getAttribute("data-role") === "check") cfg.check(wrap.editor, showMsg);
    else {
      [].forEach.call(wrap.querySelectorAll(".memin"), function(i){ i.value = ""; });
      msg.className = "msg"; memPane.style.display = "none";
    }
  });
  wrap.addEventListener("keydown", function(e){
    if (e.key === "Enter"){ e.preventDefault(); cfg.check(wrap.editor, showMsg); }
  });
  return wrap;
}

function runMemoryCheck(w, ed, showMsg){
  session.attempts++;
  var right = memAnswers(w);
  var vals = {};
  String(ed.getCode()).split("\n").forEach(function(l){
    var k = l.indexOf("=");
    if (k > 0) vals[l.slice(0, k).trim()] = l.slice(k + 1);
  });
  var empty = w.ask.filter(function(n){ return !String(vals[n] || "").trim(); });
  if (empty.length === w.ask.length){
    showMsg("warn", "<b>Пока пусто</b>Заполни поля: что лежит в каждой переменной в этот момент.");
    return;
  }
  var wrong = w.ask.filter(function(n){ return memNorm(vals[n]) !== memNorm(right[n]); });
  if (!wrong.length){ session.studio.reveal(); winWarmup(w); return; }
  /* Не называем правильное значение — иначе задание решается со второй
     попытки без единой мысли. Называем только, ГДЕ разошлось. */
  showMsg("bad", "<b>" + (wrong.length === w.ask.length ? "Пока мимо" : "Почти") + "</b>" +
    (wrong.length === w.ask.length
      ? "Ни одно значение не сошлось."
      : "Сошлось не всё: неверно у " + wrong.map(function(n){ return "<code>" + esc(n) + "</code>"; }).join(", ") + ".") +
    " Пройди программу строчка за строчкой сверху вниз и держи в голове, что меняется после каждой.");
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
  /* разминка могла быть шагом занятия — и разминкой в начале, и проверкой
     понимания в конце. Какой именно, знает план, а не это место. */
  zanNote("warm", w.id, { ok: session.attempts === 1 && !session.hints });
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
  var inZan = !!zanOpen();
  var buttons = inZan
    ? '<button class="bigbtn" id="wzan">← К занятию</button>' +
      '<button class="bigbtn ghost" id="wstay">Остаться здесь</button>'
    : isDaily
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
  var wz2 = document.getElementById("wzan");
  if (wz2) wz2.onclick = function(){ closeWin(); screenZan(); };
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

/* ================= шпаргалка: оверлей поверх любого экрана =================
   Отдельным экраном её делать нельзя: чаще всего она нужна посреди урока,
   а уход со страницы урока стирает написанный код. Поэтому — оверлей.
   Вывод примеров не хранится в файле, а считается движком и запоминается
   на время сессии: так справочник не может разойтись с тем, что ребёнок
   получит у себя, и при этом не пересчитывает 86 программ на каждую букву
   в поиске. */
var sheetOut = {};
function sheetItems(){ return window.CHEATSHEET || []; }
function sheetLearned(it){ return solved(it.lesson) || (S.admin && S.admin.unlockAll); }
function sheetRun(it){
  if (sheetOut[it.id] === undefined){
    /* data — файлы рядом с примером: без них записи про open() и csv упали бы */
    var r = Runtime.get("mini").run(it.code, { files: it.data ? JSON.parse(JSON.stringify(it.data)) : {} });
    sheetOut[it.id] = r.error ? ("ошибка: " + r.error.msg) : r.output.replace(/\n+$/, "");
  }
  return sheetOut[it.id];
}
function sheetRender(){
  var qEl = document.getElementById("sheetq"), allEl = document.getElementById("sheetall");
  var box = document.getElementById("sheetbody");
  if (!box) return;
  var q = (qEl && qEl.value || "").trim().toLowerCase();
  var all = !!(allEl && allEl.checked);
  var h = "", shown = 0, locked = 0;
  sheetItems().forEach(function(g){
    var items = g.items.filter(function(it){
      var open = sheetLearned(it);
      if (!open) locked++;
      if (!open && !all) return false;
      if (!q) return true;
      return (it.sig + " " + it.what + " " + it.code + " " + g.group).toLowerCase().indexOf(q) >= 0;
    });
    if (!items.length) return;
    h += '<div class="shgroup"><h4>' + esc(g.group) + '</h4>';
    items.forEach(function(it){
      shown++;
      var l = CURRICULUM.byId(it.lesson), open = sheetLearned(it);
      h += '<div class="shitem' + (open ? "" : " soon") + '">' +
        '<div class="shsig"><code>' + esc(it.sig) + '</code>' +
        (open ? '' : '<span class="shsoon">ещё не проходили</span>') + '</div>' +
        '<p class="shwhat">' + esc(it.what) + '</p>' +
        '<div class="shcode"><pre>' + esc(it.code) + '</pre>' +
        '<pre class="shout">' + esc(sheetRun(it)) + '</pre></div>' +
        '<div class="shfrom">урок ' + l.num + " · " + esc(l.title) + '</div></div>';
    });
    h += '</div>';
  });
  if (!shown){
    h = '<p class="shempty">' + (q
      ? 'По запросу «' + esc(q) + '» ничего не нашлось.'
      : 'Пока пусто: пройди первые уроки, и команды появятся здесь сами.') +
      (locked && !all ? ' Спрятано ' + locked + ' ' + plural(locked, "команда", "команды", "команд") +
        ' из ещё не пройденных уроков — включи «показать всё».' : '') + '</p>';
  } else if (locked && !all){
    h += '<p class="shempty">Спрятано ' + locked + ' ' + plural(locked, "команда", "команды", "команд") +
      ' из ещё не пройденных уроков. Включи «показать всё», если интересно заглянуть вперёд.</p>';
  }
  box.innerHTML = h;
  box.scrollTop = 0;
}
function openSheet(){
  var el = document.getElementById("sheet");
  if (!el) return;
  el.hidden = false;
  sheetRender();
  var q = document.getElementById("sheetq");
  if (q) q.focus();
}
function closeSheet(){
  var el = document.getElementById("sheet");
  if (el) el.hidden = true;
}
function sheetIsOpen(){
  var el = document.getElementById("sheet");
  return !!el && !el.hidden;
}

/* ================= экран: работа над ошибками ================= */
function reviewNote(id){
  var r = (S.review || {})[id];
  if (!r || !r.at) return "";
  if (reviewGraduated(id))
    return '<p class="revnote">🔁 Закреплено: три чистых повтора. Больше этот урок повторять не попросит.</p>';
  var d = REVIEW_STEPS[Math.min(r.n, REVIEW_STEPS.length - 1)];
  return '<p class="revnote">🔁 Вернётся в «Повторить» через ' + d + ' ' + plural(d, "день", "дня", "дней") + '.</p>';
}
/* «через сколько» словами: список сроков читают глазами, а не календарём */
function reviewWhen(at){
  var d = Math.round((at - Date.now()) / 864e5);
  if (d <= 0) return "пора";
  if (d === 1) return "завтра";
  return "через " + d + " " + plural(d, "день", "дня", "дней");
}
function screenReview(){
  enterScreen(undefined, "review");
  session = { id:null, attempts:0, hints:0, shown:false };
  var all = reviewList(), now = Date.now();
  var due = all.filter(function(x){ return x.at <= now; });
  var later = all.filter(function(x){ return x.at > now; });
  var got = reviewGraduatedCount();

  var h = '<div class="lvlhead"><div><div class="idx">то, что уже проходили</div><h1>🔁 Повторить</h1></div>' +
    '<div class="right"><span class="tag">' + (due.length ? "пора: " + due.length : "долгов нет") + '</span></div></div>' +
    '<p class="lede">Урок, который дался тяжело, забывается первым. Сюда сами попадают те, где были ' +
    'подсказки, показанное решение или много попыток. Каждый возвращается сначала через два дня, ' +
    'потом через неделю, потом через три — и после трёх чистых повторов уходит совсем. ' +
    'Звёзды за повтор не отнимаются: хуже, чем было, не станет.</p>';

  if (!all.length && !got){
    h += '<div class="card"><p>Пока повторять нечего — либо уроков пройдено мало, либо они дались с первого раза. ' +
      'Как только урок потребует подсказки, он появится здесь сам.</p></div>';
  }

  if (due.length){
    h += '<div class="sect"><h2>Пора повторить</h2><div class="line"></div><span class="cnt">' + due.length + '</span></div>' +
      '<div class="revlist">' + due.map(revCard).join("") + '</div>';
  }
  if (later.length){
    h += '<div class="sect"><h2>Ещё рано</h2><div class="line"></div><span class="cnt">' + later.length + '</span></div>' +
      '<div class="revlist later">' + later.map(revCard).join("") + '</div>';
  }
  if (got){
    h += '<div class="sect"><h2>Закреплено</h2><div class="line"></div><span class="cnt">' + got + '</span></div>' +
      '<div class="card"><p>' + got + ' ' + plural(got, "урок", "урока", "уроков") + ' ' +
      plural(got, "прошёл", "прошли", "прошли") + ' все три повтора и больше сюда не ' +
      plural(got, "вернётся", "вернутся", "вернутся") + '.' +
      (got < REVIEW_BADGE_AT ? ' До бейджа «Закрепил» осталось ' + (REVIEW_BADGE_AT - got) + '.' : '') +
      '</p></div>';
  }

  h += beastsHTML();

  h += '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  app.innerHTML = h;
  app.querySelectorAll(".revcard").forEach(function(b){
    b.onclick = function(){ openLesson(b.getAttribute("data-id")); };
  });
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}
function revCard(x){
  var l = x.lesson, w = CURRICULUM.world(l.world);
  var r = (S.review || {})[l.id] || { n:0 };
  var dots = "";
  for (var i = 0; i < REVIEW_STEPS.length; i++)
    dots += '<span class="rdot' + (i < r.n ? " on" : "") + '"></span>';
  return '<button class="revcard" data-id="' + l.id + '">' +
    '<span class="rvicon">' + w.icon + '</span>' +
    '<span class="rvbody"><span class="rvkicker">Мир ' + l.world + ' · урок ' + l.num + '</span>' +
    '<b>' + esc(l.title) + '</b><span>' + esc(x.why) + '</span></span>' +
    '<span class="rvright"><span class="rvwhen">' + reviewWhen(x.at) + '</span>' +
    '<span class="rdots">' + dots + '</span></span></button>';
}

function screenAILab(){
  enterScreen("train", "ai");
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
  h += '</div>';

  /* Проект раздела: тот же вид карточки, что у проектов миров, — только
     открывается он не по уроками мира, а по заданиям этого раздела. */
  var aproj = projectOfWorld(0);
  if (aproj){
    var apopen = projectOpen(aproj), apdone = projectDone(aproj.id), apst = projectState(aproj.id);
    h += '<div class="projcard' + (apopen ? "" : " locked") + (apdone ? " done" : "") + '">' +
      '<span class="pjemoji">' + aproj.emoji + '</span>' +
      '<span class="pjbody"><span class="pjkicker">Проект раздела · звёзд не даёт</span>' +
      '<b>' + esc(aproj.title) + (apdone ? ' <span class="edittag done">собран ✓</span>' : '') + '</b>' +
      '<span>' + esc(aproj.tagline) + '</span>' +
      '<span class="pjnote">' + esc(apdone
        ? "Собран целиком. Можно открыть, запустить и забрать код себе."
        : (apopen
            ? (apst.step > 0 ? "Начат: пройдено шагов " + apst.step + " из " + aproj.steps.length + "."
                             : "Все задания раздела пройдены — можно браться за проект.")
            : "Откроется, когда пройдёшь все задания этого раздела.")) + '</span></span>' +
      (apopen ? '<button class="bigbtn" id="openaiproj">' +
                  (apdone ? "Открыть" : (apst.step > 0 ? "Продолжить" : "Собрать проект")) + '</button>'
              : '<span class="soontag">закрыт</span>') +
    '</div>';
  }

  h += '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  app.innerHTML = h;
  app.querySelectorAll(".gamecard").forEach(function(b){
    b.onclick = function(){ openAILesson(b.getAttribute("data-id")); };
  });
  var aop = document.getElementById("openaiproj");
  if (aop) aop.onclick = function(){
    if (projectDone(aproj.id)) screenProjectDone(aproj.id); else openProject(aproj.id);
  };
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function openAILesson(id){
  var xs = ailabList();
  var x = xs.filter(function(e){ return e.id === id; })[0];
  if (!x) return screenAILab();
  enterScreen("train", "ailesson");
  session = { id:id, attempts:0, hints:0, shown:false };
  var pos = xs.indexOf(x);
  var next = pos < xs.length - 1 ? xs[pos+1] : null;
  var prev = pos > 0 ? xs[pos-1] : null;

  var isPredict = x.type === "predict";
  var isFix = x.type === "fix";
  var isReview = x.type === "review";
  var isCatch = x.type === "catch";
  var kindLabel = isPredict ? "угадай вывод"
                : isFix ? "почини код ИИ"
                : isReview ? "вынеси вердикт"
                : isCatch ? "докажи ошибку" : "напиши код";

  var head = '<div class="crumbs"><span data-go="back">🤖 Ты и ИИ</span> › ' + x.emoji + ' ' + esc(x.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">' + (x.boss ? "финал раздела" : kindLabel) + '</div><h1>' + x.emoji + ' ' + esc(x.title) + '</h1></div>' +
    '<div class="right"><span class="tag">' + esc(x.tag) + '</span></div></div>' +
    '<p class="lede">' + esc(x.intro) + '</p>';

  var goal = '<div class="goal"><h3>' + (isFix ? "🔧 Задача: проверь и почини"
                                       : isReview ? "⚖️ Задача: вынеси вердикт"
                                       : isCatch ? "🕵️ Задача: докажи, что код неправ" : "🎯 Твоя задача") + '</h3><p>' + esc(x.brief) + '</p>' +
    (x.list ? '<ul>' + x.list.map(function(s){ return '<li>' + esc(s) + '</li>'; }).join("") + '</ul>' : '') + '</div>';

  var bug = isFix
    ? '<div class="bugcard"><h3>🐞 Что сейчас не так</h3><p>' + esc(x.symptom) + '</p>' +
      '<span class="bugtip">Код ниже нужно проверить и починить, а не переписать заново. Кнопка «↩ Вернуть как было» вернёт исходный вариант от ИИ.</span></div>'
    : isReview
    ? '<div class="claimcard"><h3>🤖 ИИ уверяет</h3><p>«' + esc(x.claim) + '»</p>' +
      '<span class="claimtip">Никто не сказал тебе заранее, правда это или нет — в этом и задание. Код можно запускать и менять как угодно: дописывай свои проверки, подставляй свои данные. Вердикт ниже.</span></div>'
    : isCatch
    ? '<div class="claimcard"><h3>🤖 ИИ уверяет</h3><p>«' + esc(x.claim) + '»</p>' +
      '<span class="claimtip">На своём примере код отвечает верно — иначе задания бы не было. Твоё дело найти ДРУГИЕ данные, на которых обещание перестаёт сбываться. Строки кода ИИ менять нельзя, дописывай свои снизу.</span></div>'
    : "";

  var hints = '<div class="hintbox">' +
    '<button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
    (isPredict || isReview ? '' : '<button class="rbtn sec" id="solbtn">' + (isCatch ? "Показать готовую проверку" : "Показать решение") + '</button>') +
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
  } else if (isCatch){
    /* Код ИИ и проверка ребёнка живут в ОДНОМ редакторе, и это не лень.
       Иначе «Запустить» ничего бы не запустило: проверка без функции — это
       не программа. А чтобы код ИИ остался нетронутым, проверка при сдаче
       сверяет первые строки с оригиналом и отказывает, если их правили. */
    studio = makeStudio({
      engine: "mini", code: catchStart(x),
      label: "код от ИИ — не трогай его, дописывай проверку снизу",
      restore: catchStart(x),
      check: function(ed, showMsg){ runAICatch(x, ed, showMsg); }
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
    studio.editor.setCode(isCatch ? (catchStart(x) + x.probe) : x.solution);
    studio.showMsg("warn", isCatch
      ? "<b>Вот проверка, которая ловит ошибку</b>Запусти и сравни с обещанием ИИ. Своя проверка, если она тоже разводит две версии, засчитывается ничуть не хуже — эта просто одна из возможных."
      : "<b>Вот рабочее решение</b>Прочитай его строчку за строчкой и запусти. Звёзд в разделе нет — смотреть решение можно без потерь, но сначала попробуй сам.");
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

/* ===== catch: докажи, что код ИИ неправ =====
   Самый непохожий на остальные тип: у задания НЕТ единственного правильного
   ответа. Ребёнок пишет свою проверку, а засчитывает её не сверка с эталоном,
   а факт: на его данных код ИИ и правильная версия отвечают по-разному.
   Проверок, которые годятся, бесконечно много — и это ровно то, чему тут учат.
   Судит по-прежнему движок, без сети и без живого ИИ.

   Что должно быть у записи: claim, code (баг СПРЯТАН — на своём примере код
   отвечает верно), truth (правильная версия с тем же интерфейсом) и probe —
   эталонная проверка. Она нужна не для сверки ответа, а для двух вещей:
   кнопки «Показать готовую проверку» и теста, который убеждается, что поймать
   ошибку вообще возможно. */
function catchStart(x){
  return String(x.code).replace(/\n+$/, "") +
    "\n\n# ↓ ниже пиши свою проверку: вызови функцию своими данными и напечатай ответ\n";
}
function catchRun(src){
  var res = Runtime.get("mini").run(src, {});
  return res.error ? "!" + res.error.kind + ": " + res.error.msg : res.output;
}
/* Проверка ребёнка — это всё, что он дописал НИЖЕ кода ИИ. Сравниваем построчно
   и без хвостовых пробелов: невидимый пробел в конце строки не повод отказать. */
function catchProbe(x, code){
  var base = String(x.code).replace(/\n+$/, "").split("\n");
  var cur = String(code).split("\n");
  if (cur.length < base.length) return null;
  for (var i = 0; i < base.length; i++)
    if (cur[i].replace(/\s+$/, "") !== base[i].replace(/\s+$/, "")) return null;
  return cur.slice(base.length).join("\n");
}
function catchProof(x, probe){
  var got  = catchRun(x.code  + "\n" + probe).split("\n");
  var want = catchRun(x.truth + "\n" + probe).split("\n");
  while (got.length  && got[got.length-1]  === "") got.pop();
  while (want.length && want[want.length-1] === "") want.pop();
  return '<div class="proof"><u>Вот твоё доказательство</u>' + diffBlock(want, got) + '</div>';
}
function runAICatch(x, ed, showMsg){
  session.attempts++;
  var probe = catchProbe(x, ed.getCode());
  if (probe === null){
    showMsg("warn", "<b>Код ИИ изменён</b>Чинить его не надо — надо доказать, что он неправ. " +
      "Нажми «↩ Вернуть как было» и дописывай свои строки СНИЗУ, ничего не трогая выше.");
    return;
  }
  var body = probe.split("\n").filter(function(l){
    var t = l.trim(); return t !== "" && t[0] !== "#";
  }).join("\n");
  if (!body){
    showMsg("warn", "<b>Проверки пока нет</b>Внизу только комментарий. Допиши хотя бы одну строку: " +
      "вызови функцию своими данными и напечатай, что она вернула.");
    return;
  }
  var mine = catchRun(x.code + "\n" + probe);
  var right = catchRun(x.truth + "\n" + probe);
  /* Второй прогон — страховка от недетерминированности. Генератор случайных
     чисел у нас засевается одинаково на каждый запуск, поэтому random обе
     версии получат одинаковый и расхождения не дадут; а вот time.time()
     между двумя запусками может перевалить через миллисекунду — и тогда
     «расхождение» доказывало бы только то, что время идёт. */
  if (mine !== catchRun(x.code + "\n" + probe) || right !== catchRun(x.truth + "\n" + probe)){
    showMsg("warn", "<b>Так доказать нельзя</b>Твоя проверка при каждом запуске печатает разное " +
      "(случайность или время). Тогда расхождение ничего не значит: оно было бы и у двух одинаковых программ. " +
      "Возьми конкретные данные, которые ты выбрал сам.");
    return;
  }
  if (right.charAt(0) === "!"){
    showMsg("bad", "<b>Проверка сама не работает</b>На ПРАВИЛЬНОЙ версии функции твои строки падают: " +
      esc(right.slice(1)) + ". Значит дело не в коде ИИ, а в самой проверке — почини её и попробуй снова.");
    return;
  }
  if (mine === right){
    showMsg("bad", "<b>Не поймала</b>На твоих данных код ИИ отвечает ровно то же, что и правильная версия — " +
      "значит эти данные больное место не задевают. Ищи другие: думай, при каких значениях обещание " +
      "«" + esc(x.claim) + "» может не сбыться.");
    return;
  }
  winAI(x, catchProof(x, probe));
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
  if (!st || typeof st !== "object"){ st = { step:0, code:null, done:0, aiAt:-1, doneAt:0 }; S.projects[id] = st; }
  if (typeof st.step !== "number") st.step = 0;
  if (typeof st.aiAt !== "number") st.aiAt = -1;
  return st;
}
function projectDone(id){ return !!projectState(id).done; }
/* ключ черновика шага: у каждого шага свой, чтобы возврат на шаг возвращал
   именно то, что на нём писали */
function projectDraftId(pid, i){ return "proj-" + pid + "-" + i; }
/* Проект открывается, когда все готовые уроки его мира пройдены.
   world: 0 — это проект вне миров («Напарник» в разделе «Ты и ИИ»): у него
   нет карты мира, поэтому и открывается он по своему разделу. */
function projectOpen(p){
  if (S.admin && S.admin.unlockAll) return true;
  if (p.world === 0){
    var xs = ailabList();
    return xs.length > 0 && xs.every(function(x){ return ailabDone(x.id); });
  }
  var w = CURRICULUM.world(p.world);
  if (!w) return false;
  var ready = worldReadyLessons(w);
  return ready.length > 0 && ready.every(function(l){ return solved(l.id); });
}
/* Стартовый код шага: своё с прошлого шага, иначе эталон прошлого шага.
   Исключение — шаги, у которых есть свой starter. Такой шаг начинается не
   с кода ребёнка, а с ПЕРЕПИСАННОЙ версии: в проекте с ИИ-напарником это
   ровно то, что происходит в жизни — напарник отдал новую редакцию целиком,
   и надо разобраться, что он там заодно сломал.

   Подставляем такую версию ОДИН раз (запоминаем в st.aiAt): иначе ребёнок
   ушёл на карту, вернулся — и его правки затёрлись бы ещё раз. */
function projectStartCode(p, i){
  var st = projectState(p.id);
  if (i === 0) return st.code && st.step > 0 ? st.code : p.steps[0].starter;
  var own = p.steps[i].starter;
  if (own !== undefined && st.step === i && st.aiAt !== i){
    st.code = own; st.aiAt = i; save();
    return own;
  }
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
    enterScreen(undefined, "project");
    /* Черновик шага проекта — тем же механизмом, что у уроков: ключ шага
       вместо id урока. До этого код шага сохранялся ТОЛЬКО на победе, и уход
       за подсказкой в шпаргалку стирал написанное. */
    var draftId = projectDraftId(p.id, i);
    var startCode = projectStartCode(p, i);
    session = { id:null, attempts:0, hints:0, shown:false, project:p.id, pstep:i,
                lesson:draftId, starter:[{ name:"main.py", code:startCode }] };

    var dots = p.steps.map(function(s, k){
      var cls = k < st.step ? "done" : (k === i ? "now" : "");
      return '<span class="pdot ' + cls + '" title="' + esc(s.title) + '">' + (k + 1) + '</span>';
    }).join("");

    var where = p.world === 0 ? "🤖 Ты и ИИ" : "Мир " + p.world;
    var kicker = p.world === 0 ? "Проект раздела «Ты и ИИ»" : "Проект мира " + p.world;
    var head = '<div class="crumbs"><span data-go="world">' + esc(where) + '</span> › ' +
        p.emoji + ' ' + esc(p.title) + '</div>' +
      '<div class="lvlhead"><div><div class="idx">' + kicker +
        ' · шаг ' + (i + 1) + ' из ' + p.steps.length + '</div>' +
      '<h1>' + p.emoji + ' ' + esc(p.title) + '</h1></div>' +
      '<div class="right"><span class="tag">звёзд не даёт</span></div></div>' +
      '<p class="lede">' + esc(p.intro) + '</p>' +
      '<div class="pstepbar">' + dots + '</div>';

    var goal = '<div class="goal"><h3>🎯 Шаг ' + (i + 1) + ': ' + esc(step.title) + '</h3>' +
      '<p>' + esc(step.brief) + '</p>' +
      (step.list ? '<ul>' + step.list.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>' : '') +
      (i > 0 ? '<span class="bugtip">' + (step.starter !== undefined
          ? 'В редакторе — НОВАЯ редакция от напарника, а не твой код. Он что-то добавил и мог заодно сломать сделанное раньше: сравни с тем, что было, и почини.'
          : 'В редакторе — твой код с прошлого шага. Дописывай в него, а не начинай с нуля.') + '</span>' : '') +
      '</div>';

    var hints = '<div class="hintbox">' +
      '<button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
      '<button class="rbtn sec" id="solbtn">Показать решение шага</button>' +
      '<span class="tip">проект без звёзд — подсказки ничего не отнимают</span></div>' +
      '<div class="hintout" id="hintout"></div>';

    var pager = '<div class="pager"><button class="bigbtn ghost" data-go="world">← ' +
      (p.world === 0 ? "Ко всем заданиям" : "К миру " + p.world) + '</button></div>';

    app.innerHTML = head + goal +
      '<div class="draftnote" id="draftnote" hidden></div>' +
      '<div id="studio"></div>' + hints + pager;

    var studio = makeStudio({
      engine: "mini",
      code: startCode,
      label: "твоя программа",
      check: function(ed, showMsg){ runProjectCheck(p, i, ed, showMsg); }
    });
    document.getElementById("studio").appendChild(studio);
    session.studio = studio;

    var pdraft = draftGet(draftId);
    if (pdraft){
      draftApply(studio.editor, pdraft.files);
      var pnote = document.getElementById("draftnote");
      pnote.hidden = false;
      pnote.innerHTML = '<span>\u{1F4DD} В редакторе код с прошлого раза, а не то, с чего шаг начинался.</span>' +
        '<button class="rbtn sec" id="draftfresh">Начать шаг заново</button>';
      document.getElementById("draftfresh").onclick = function(){
        draftDrop(draftId);
        studio.editor.setCode(startCode);
        pnote.hidden = true;
        studio.editor.focusEditor();
      };
    }
    studio.editor.onEdit = draftSchedule;

    wireHint(step.hints);
    document.getElementById("solbtn").onclick = function(){
      session.shown = true;
      studio.editor.setCode(step.solution);
      studio.showMsg("warn", "<b>Вот программа на конец этого шага</b>Прочитай её и запусти. Звёзд в проекте нет — смотреть можно без потерь, но сначала попробуй сам.");
    };
    app.querySelectorAll('[data-go="world"]').forEach(function(b){
      b.onclick = function(){ if (p.world === 0) screenAILab(); else screenWorld(p.world); };
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
  /* Шаг сдан — код уехал в st.code, черновик шага больше не нужен. Заготовку
     сессии подменяем на сданный код: иначе draftFlush при уходе на следующий
     шаг заведёт черновик заново, и он останется висеть навсегда. */
  draftDrop(projectDraftId(p.id, i));
  if (session && session.project === p.id && session.pstep === i){
    session.starter = [{ name:"main.py", code: code }];
  }
  if (i + 1 > st.step) st.step = i + 1;
  var last = st.step >= p.steps.length;
  /* doneAt ставится ОДИН раз: это дата на сертификате, и она не должна
     переписываться, если проект потом откроют заново. */
  if (last && !st.done){ st.done = 1; st.doneAt = st.doneAt || Date.now(); award("builder"); }
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
  enterScreen(undefined, "projectdone");
  session = { id:null, attempts:0, hints:0, shown:false };
  var st = projectState(p.id);
  var code = st.code || p.steps[p.steps.length - 1].solution;

  var where2 = p.world === 0 ? "🤖 Ты и ИИ" : "Мир " + p.world;
  app.innerHTML =
    '<div class="crumbs"><span data-go="world">' + esc(where2) + '</span> › ' + p.emoji + ' ' + esc(p.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">' +
    (p.world === 0 ? "проект раздела «Ты и ИИ» собран" : "проект мира " + p.world + " собран") + '</div>' +
    '<h1>' + p.emoji + ' ' + esc(p.title) + '</h1></div>' +
    '<div class="right"><span class="tag">готово ✓</span></div></div>' +
    '<p class="lede">' + esc(p.finale) + '</p>' +
    '<div id="studio"></div>' +
    '<div class="pager"><button class="bigbtn" id="tosand">Забрать в песочницу</button>' +
    '<button class="bigbtn ghost" id="pfolio">🎒 Все мои работы</button>' +
    '<button class="bigbtn ghost" id="pagain">Пройти заново</button><span class="sp"></span>' +
    '<button class="bigbtn ghost" data-go="world">← ' +
    (p.world === 0 ? "Ко всем заданиям" : "К миру " + p.world) + '</button></div>';

  var studio = makeStudio({ engine: "mini", code: code, label: "твоя программа целиком" });
  document.getElementById("studio").appendChild(studio);
  session.studio = studio;

  document.getElementById("tosand").onclick = function(){
    S.sandbox = studio.editor.getCode(); save(); screenSandbox();
  };
  document.getElementById("pfolio").onclick = screenFolio;
  document.getElementById("pagain").onclick = function(){
    var yes = true;
    try { yes = confirm("Начать проект заново? Пройденные шаги обнулятся, но код останется в редакторе."); } catch(e){}
    if (!yes) return;
    var s2 = projectState(p.id);
    s2.step = 0; s2.done = 0; s2.aiAt = -1;   /* редакции напарника подставятся заново */
    save(); openProject(p.id, 0);
  };
  app.querySelectorAll('[data-go="world"]').forEach(function(b){
    b.onclick = function(){ if (p.world === 0) screenAILab(); else screenWorld(p.world); };
  });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= галерея рисунков =================
   Рисунок — единственный результат занятий, который хочется показать бабушке.
   До сих пор он жил ровно до следующего запуска.

   Храним НЕ картинку, а программу. Причины две, и обе серьёзные:
   картинка в base64 — это десятки килобайт на каждый рисунок, а прогресс
   целиком уезжает на сервер одним запросом; и главное — правило проекта:
   результат не хранится, а вычисляется (так же не хранится вывод примеров
   шпаргалки). Программа же занимает несколько строк, и рисунок из неё
   получается тот же самый в любой момент.

   PNG появляется в момент, когда его просят: холст уже нарисован, остаётся
   toDataURL. Так «скачать картинку» работает, а прогресс остаётся маленьким.
   ============================================================ */
var GALLERY_MAX = 12;

function galleryAll(){ S.gallery = S.gallery || {}; return S.gallery; }
function galleryList(){
  var g = galleryAll();
  return Object.keys(g).map(function(k){
    var x = g[k];
    if (!x || typeof x.code !== "string" || !x.code.trim()) return null;
    return { id:k, code:x.code, title:x.title || "Рисунок", at:x.at || 0 };
  }).filter(Boolean).sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
}
/* Имя рисунка: первый комментарий программы, если он есть. Это не только
   удобно — это ещё и повод писать комментарии. Иначе просто по счёту. */
function galleryTitleOf(code, n){
  var lines = String(code || "").split("\n");
  for (var i = 0; i < lines.length; i++){
    var t = lines[i].trim();
    if (t.charAt(0) === "#"){
      var name = t.replace(/^#+\s*/, "").slice(0, 40).trim();
      if (name) return name;
    }
  }
  return "Рисунок " + n;
}
function gallerySave(code){
  var g = galleryAll();
  var id = "g" + Date.now().toString(36);
  g[id] = { code: String(code), title: galleryTitleOf(code, galleryList().length + 1), at: Date.now() };
  var keys = Object.keys(g);
  if (keys.length > GALLERY_MAX){
    keys.sort(function(a, b){ return (g[a].at || 0) - (g[b].at || 0); });
    keys.slice(0, keys.length - GALLERY_MAX).forEach(function(k){ delete g[k]; });
  }
  save();
  return id;
}
function galleryDrop(id){ delete galleryAll()[id]; save(); }
/* Нарисовала ли эта программа хоть одну линию или точку. */
function galleryDrawing(code){
  var eng = Runtime.get("mini");
  var t = eng.newTurtle ? eng.newTurtle() : null;
  if (!t) return null;
  var res = eng.run(String(code || ""), { turtle: t });
  if (res.error) return { error: res.error };
  var turtle = res.turtle || t;
  var n = (turtle.segs || []).length + (turtle.dots || []).length;
  return n ? { turtle: turtle } : { empty: true };
}
/* Отдать картинку файлом. Отдельно от downloadText: тут уже готовая
   data-ссылка от холста, оборачивать её в Blob незачем. */
function downloadDataURL(name, url, btn){
  try {
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    if (btn){
      var t = btn.textContent;
      btn.textContent = "Скачано ✓";
      setTimeout(function(){ btn.textContent = t; }, 1500);
    }
    return true;
  } catch(e){ return false; }
}

/* ================= забрать программу файлом =================
   Портфолио умело показывать и копировать код, но не отдавать его. А «унести
   с собой» — это и есть смысл проекта: файл можно положить на флешку, послать
   бабушке, открыть в настоящем Python.

   Файл получается сразу пригодным к запуску, и вот почему это не мелочь:
   команды черепашки в тренажёре встроены, а в настоящем Python их надо
   подключить. Поэтому рисующей программе дописываются первая строка
   (`from turtle import *`) и последняя (`done()`, иначе окно закроется
   мгновенно) — с честным комментарием, что это добавил тренажёр, а не
   ребёнок. Всё остальное уезжает как есть.
   ============================================================ */
function pyFileName(title){
  var base = translit(String(title || "")).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 28);
  return (base || "program") + ".py";
}
/* Рисует ли программа. Смотрим по дереву, а не по тексту: слово forward
   в комментарии или в строке ничего не рисует. */
function pyIsDraw(code){
  try { return lintIsDraw(window.MiniPy.parse(String(code || ""))); }
  catch(e){ return false; }
}
function pyFileText(title, code){
  code = String(code || "");
  var head = "# «" + String(title || "программа") + "» — программа из Кодоквеста.\n" +
             "# Запустить у себя: сохрани файл рядом и набери в терминале\n" +
             "#     python3 " + pyFileName(title) + "\n";
  if (!pyIsDraw(code)) return head + "\n" + code.replace(/\s*$/, "") + "\n";
  return head +
    "#\n" +
    "# В тренажёре команды черепашки встроены, а в настоящем Python их надо\n" +
    "# подключить. Поэтому первую строку и последнюю добавил тренажёр:\n" +
    "# без from turtle import * команд не будет, без done() окно закроется сразу.\n" +
    "from turtle import *\n\n" +
    code.replace(/\s*$/, "") + "\n\ndone()\n";
}
/* Отдать текст файлом. Blob — основной путь, data-ссылка — запасной:
   в старых и урезанных браузерах URL.createObjectURL может не быть,
   а промолчавшая кнопка хуже отсутствующей. */
function downloadText(name, text, btn){
  var done = function(){
    if (!btn) return;
    var t = btn.textContent;
    btn.textContent = "Скачано ✓";
    setTimeout(function(){ btn.textContent = t; }, 1500);
  };
  var a = document.createElement("a");
  a.download = name;
  try {
    var url = URL.createObjectURL(new Blob([text], { type:"text/x-python;charset=utf-8" }));
    a.href = url;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ try { URL.revokeObjectURL(url); } catch(e){} }, 2000);
    done();
    return true;
  } catch(e){}
  try {
    a.href = "data:text/x-python;charset=utf-8," + encodeURIComponent(text);
    document.body.appendChild(a); a.click(); a.remove();
    done();
    return true;
  } catch(e2){}
  return false;
}

/* ================= экран: портфолио и сертификаты =================
   Проектов шесть, и каждый — законченная программа, написанная ребёнком.
   По отдельности они разбросаны по мирам; здесь собраны в одном месте
   вместе со сводкой и сертификатами. Это единственный экран, сделанный
   не для занятий, а для ПОКАЗА: родителям, учителю, кому угодно.

   Про сертификат важно одно: он выдаётся не за «прошёл уроки», а за уроки
   ПЛЮС собранный проект мира. Сертификат без сделанной вещи — бумажка,
   и ребёнок это чувствует раньше взрослых.

   Своего прогресса раздел не заводит: и сводка, и сертификаты считаются
   из S.stars, S.log и S.projects. Единственная добавка — projects[id].doneAt,
   дата сборки проекта: без неё дата на сертификате менялась бы при каждом
   открытии, а такому «документу» грош цена.
   ============================================================ */

function worldSolvedCount(n){
  var w = CURRICULUM.world(n), c = 0;
  if (w) w.lessons.forEach(function(l){ if (solved(l.id)) c++; });
  return c;
}
function worldStars(n){
  var w = CURRICULUM.world(n), s = 0;
  if (w) w.lessons.forEach(function(l){ s += starsOf(l.id); });
  return s;
}
function worldWhole(n){
  var w = CURRICULUM.world(n);
  return !!w && w.lessons.length > 0 && worldSolvedCount(n) === w.lessons.length;
}

/* сертификат мира: все уроки мира пройдены И проект мира собран */
function certWorldReady(n){
  var p = projectOfWorld(n);
  return worldWhole(n) && !!p && projectDone(p.id);
}
function certCourseReady(){
  if (!CURRICULUM.length) return false;
  for (var i = 0; i < CURRICULUM.length; i++)
    if (!certWorldReady(CURRICULUM[i].n)) return false;
  return true;
}
/* дата выдачи: самое позднее из «последний урок мира пройден» и «проект собран».
   Дату берём из журнала, а не из текущего дня — иначе сертификат «переписывался»
   бы при каждом открытии. */
function certWorldAt(n){
  var w = CURRICULUM.world(n), t = 0;
  if (!w) return 0;
  w.lessons.forEach(function(l){
    var g = S.log[l.id] || {};
    if ((g.solvedAt || 0) > t) t = g.solvedAt;
  });
  var p = projectOfWorld(n);
  if (p){ var d = projectState(p.id).doneAt || 0; if (d > t) t = d; }
  return t;
}
function certCourseAt(){
  var t = 0;
  CURRICULUM.forEach(function(w){ var x = certWorldAt(w.n); if (x > t) t = x; });
  return t;
}
/* чего не хватает до сертификата — словами, без «выполнено 60%» */
function certWorldNeed(n){
  var w = CURRICULUM.world(n), p = projectOfWorld(n), bits = [];
  var left = w ? w.lessons.length - worldSolvedCount(n) : 0;
  if (left > 0) bits.push(left + " " + plural(left, "урок", "урока", "уроков"));
  if (p && !projectDone(p.id)) bits.push("проект «" + p.title + "»");
  return bits.length ? "Осталось: " + bits.join(" и ") + "." : "";
}
function certCourseNeed(){
  var left = 0;
  CURRICULUM.forEach(function(w){ if (!certWorldReady(w.n)) left++; });
  return left ? ("Осталось миров: " + left + " из " + CURRICULUM.length + ".") : "";
}

/* ---- сертификаты за разделы вне сотни ----
   Устроены как у миров: задания раздела ПЛЮС его проект, если он есть.
   Отличие одно, и оно в дате. У урока есть solvedAt в журнале, а разминка и
   задание «Ты и ИИ» отмечались единицей, без времени, — восстановить задним
   числом нечего. Поэтому дату выдачи ЗАПОМИНАЕМ в S.certAt в тот момент,
   когда раздел закрылся, и больше не трогаем: сертификат, распечатанный
   сегодня и через месяц, обязан быть одним и тем же листом. */
var WARM_KIND = { predict:"угадай вывод", blocks:"собери из блоков", memory:"предскажи память" };
var SECTION_CERTS = [
  { id:"warmups", icon:"🧩", title:"Разминка пройдена целиком",
    what:"Разминка",
    all: function(){ return warmupsList().length; },
    done: function(){
      return warmupsList().filter(function(x){ return warmupDone(x.id); }).length;
    },
    unit: ["разминка", "разминки", "разминок"],
    line: function(d, t){
      /* Перечень механик считаем по самим разминкам, а не пишем строкой:
         добавится шестой тип — лист соврёт, и заметить это будет некому. */
      var seen = [], ok = 1;
      warmupsList().forEach(function(x){
        var nm = WARM_KIND[x.type];
        if (!nm){ ok = 0; return; }
        if (seen.indexOf(nm) < 0) seen.push(nm);
      });
      var tail = (ok && seen.length)
        ? ' — ' + seen.map(function(n){ return '«' + n + '»'; }).join(", ") + '.'
        : '.';
      return 'Раздел «Разминка» пройден целиком: <b>' + d + ' из ' + t + '</b> ' +
        plural(t, "упражнения", "упражнений", "упражнений") + tail;
    } },
  { id:"ailab", icon:"🤖", title:"Раздел «Ты и ИИ» пройден",
    what:"Ты и ИИ",
    all: function(){ return ailabList().length; },
    done: function(){
      return ailabList().filter(function(x){ return ailabDone(x.id); }).length;
    },
    unit: ["задание", "задания", "заданий"],
    project: 0,
    line: function(d, t){
      var p = projectOfWorld(0);
      return 'Раздел «Ты и ИИ» пройден полностью: <b>' + d + ' из ' + t + '</b> ' +
        plural(t, "задание", "задания", "заданий") +
        (p ? ', проект «' + esc(p.title) + '» собран' : '') +
        '. Проверялось не умение писать код, а умение спорить с ИИ и находить его ошибки.';
    } }
];
function sectionCert(id){
  for (var i = 0; i < SECTION_CERTS.length; i++)
    if (SECTION_CERTS[i].id === id) return SECTION_CERTS[i];
  return null;
}
function certSectionReady(id){
  var c = sectionCert(id);
  if (!c || !c.all()) return false;
  if (c.done() !== c.all()) return false;
  if (c.project !== undefined){
    var p = projectOfWorld(c.project);
    if (!p || !projectDone(p.id)) return false;
  }
  return true;
}
/* Дата выдачи. Ставится один раз — в момент, когда раздел закрылся. Если
   раздел закрыли ДО того, как сертификаты появились, ставим сейчас: это
   честно, лист и правда выдан сегодня, а выдумывать прошлую дату нельзя. */
function certSectionAt(id){
  if (!certSectionReady(id)) return 0;
  S.certAt = S.certAt || {};
  if (!S.certAt[id]){ S.certAt[id] = Date.now(); save(); }
  return S.certAt[id];
}
function certSectionNeed(id){
  var c = sectionCert(id);
  if (!c) return "";
  var bits = [], left = c.all() - c.done();
  if (left > 0) bits.push(left + " " + plural(left, c.unit[0], c.unit[1], c.unit[2]));
  if (c.project !== undefined){
    var p = projectOfWorld(c.project);
    if (p && !projectDone(p.id)) bits.push("проект «" + p.title + "»");
  }
  return bits.length ? "Осталось: " + bits.join(" и ") + "." : "";
}

function certList(){
  var out = [];
  CURRICULUM.forEach(function(w){
    out.push({
      id: "world" + w.n, kind: w.n, icon: w.icon,
      title: "Мир " + w.n + ": " + w.title,
      ready: certWorldReady(w.n), at: certWorldAt(w.n), need: certWorldNeed(w.n)
    });
  });
  SECTION_CERTS.forEach(function(c){
    out.push({
      id: c.id, kind: c.id, icon: c.icon, title: c.title, section: 1,
      ready: certSectionReady(c.id), at: certSectionAt(c.id), need: certSectionNeed(c.id)
    });
  });
  /* «Курс целиком» стоит последним намеренно: это главный лист, и он не должен
     теряться между сертификатами за разделы. */
  out.push({
    id: "course", kind: "course", icon: "🏆", title: "Курс пройден целиком",
    ready: certCourseReady(), at: certCourseAt(), need: certCourseNeed()
  });
  return out;
}

function fmtDay(ts){
  if (!ts) return "—";
  var d = new Date(ts), p = function(x){ return (x < 10 ? "0" : "") + x; };
  return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear();
}

/* Текст сертификата написан безлично («пройден», а не «прошёл»): курс учат
   и мальчики, и девочки, а угадывать род по имени — плохая идея. */
function certBodyHTML(kind){
  var sect = sectionCert(kind);
  var course = kind === "course";
  var w = (course || sect) ? null : CURRICULUM.world(kind);
  var p = (course || sect) ? null : projectOfWorld(kind);
  var at = sect ? certSectionAt(kind) : (course ? certCourseAt() : certWorldAt(kind));
  var stars = 0, top = 0, what = "";

  if (sect){
    what = sect.line(sect.done(), sect.all());
  } else if (course){
    CURRICULUM.forEach(function(x){ stars += worldStars(x.n); });
    top = CURRICULUM.total * 3;
    var names = [];
    CURRICULUM.forEach(function(x){
      var pr = projectOfWorld(x.n);
      if (pr) names.push("«" + pr.title + "»");
    });
    what = 'Курс «Кодоквест» пройден целиком: <b>' + CURRICULUM.total + " " +
      plural(CURRICULUM.total, "урок", "урока", "уроков") + '</b> и <b>' + names.length + " " +
      plural(names.length, "собранный проект", "собранных проекта", "собранных проектов") + '</b>.' +
      (names.length ? '<span class="certlist">' + esc(names.join(", ")) + '</span>' : '');
  } else {
    stars = worldStars(kind);
    top = (w ? w.lessons.length : 0) * 3;
    what = 'Мир ' + kind + ' «' + esc(w ? w.title : "") + '» пройден полностью: <b>' +
      (w ? w.lessons.length : 0) + " из " + (w ? w.lessons.length : 0) + '</b> ' +
      plural(w ? w.lessons.length : 0, "урок", "урока", "уроков") +
      (p ? ', проект «' + esc(p.title) + '» собран' : '') + '.';
  }

  var name = myName();
  /* Звёзд в разделах вне сотни нет — и рисовать «★ 0 из 0» на листе нельзя.
     Вместо счёта звёзд у раздела стоит счёт сделанного. */
  var tally = sect
    ? '<div class="certstars">' + sect.icon + ' ' + sect.done() + ' из ' + sect.all() + '</div>'
    : '<div class="certstars">★ ' + stars + ' из ' + top + '</div>';
  return '<div class="certsheet">' +
    '<div class="certmark">🐍 Кодоквест</div>' +
    '<div class="certkind">' + (course ? "Сертификат об окончании курса" : "Сертификат") + '</div>' +
    '<div class="certname">' + esc(name || "Ученик Кодоквеста") + '</div>' +
    '<div class="certrule"></div>' +
    '<div class="certwhat">' + what + '</div>' +
    tally +
    '<div class="certfoot"><span>Выдан ' + fmtDay(at) + '</span>' +
    '<span>Python с нуля · без установки · в браузере</span></div>' +
  '</div>';
}

/* Сертификат живёт ОВЕРЛЕЕМ, как шпаргалка: его печатают, а печать берёт
   документ целиком. В @media print всё, кроме листа, скрыто. */
function openCert(kind){
  var el = document.getElementById("cert"), box = document.getElementById("certbox");
  if (!el || !box) return;
  box.innerHTML = certBodyHTML(kind);
  el.hidden = false;
}
function closeCert(){
  var el = document.getElementById("cert");
  if (el) el.hidden = true;
}
function certIsOpen(){
  var el = document.getElementById("cert");
  return !!el && !el.hidden;
}

function folioStat(value, label){
  return '<div class="fstat"><b>' + value + '</b><span>' + label + '</span></div>';
}
/* где живёт проект: у пяти это мир, у «Напарника» — раздел «Ты и ИИ».
   Подпись и фраза про замок разные: «Мир 2» в подпись годится, а во фразу
   «откроется, когда будет пройден …» с разделом получалось косноязычие. */
function projectWhere(p){ return p.world === 0 ? "Ты и ИИ" : "Мир " + p.world; }
function projectGate(p){ return p.world === 0 ? "раздел «Ты и ИИ»" : "Мир " + p.world; }

function screenFolio(){
  enterScreen("mine", "folio");
  session = { id:null, attempts:0, hints:0, shown:false };

  var projects = projectsList();
  var built = 0;
  projects.forEach(function(p){ if (projectDone(p.id)) built++; });
  var certs = certList(), gotCerts = 0;
  certs.forEach(function(c){ if (c.ready) gotCerts++; });
  var lessonsDone = Object.keys(S.stars).length;
  var name = myName();

  var h = '<div class="lvlhead"><div><div class="idx">портфолио</div>' +
    '<h1>🎒 ' + (name ? esc(name) + ": мои работы" : "Моё") + '</h1></div>' +
    '<div class="right"><span class="tag">твои работы</span></div></div>' +
    '<p class="lede">Здесь собрано всё сделанное своими руками: программы из проектов, рисунки, ' +
    'свои задания для друзей и сертификаты. Эту страницу можно показать кому угодно — ' +
    'родителям, учителю, друзьям.</p>';

  h += '<div class="fstats">' +
    folioStat(lessonsDone + ' <i>из ' + CURRICULUM.total + '</i>', "уроков пройдено") +
    folioStat("★ " + totalStars(), "звёзд собрано") +
    folioStat(built + ' <i>из ' + projects.length + '</i>', "программ готово") +
    folioStat(gotCerts + ' <i>из ' + certs.length + '</i>', "сертификатов") +
    '</div>';

  /* Мастерская стоит ПЕРЕД готовыми программами: проекты показывают, что
     ребёнок прошёл курс, а полка — что он сделал сам и что из этого осталось.
     Для накопления важно, чтобы оно попадалось на глаза первым. */
  var shelfN = partsList().length, madeN = buildsList().length;
  h += '<div class="card shopcard"><h3>🔧 Мастерская</h3>' +
    (shelfN
      ? '<p>На полке <b>' + shelfN + '</b> ' + plural(shelfN, "деталь", "детали", "деталей") +
        ' — функции, которые ты написал сам' +
        (madeN ? ', и собрано вещей: <b>' + madeN + '</b>' : '') + '.</p>'
      : '<p class="dim">Полка пока пустая. Деталью становится функция, которую ты написал сам, — ' +
        'они начинаются в уроке про <code>def</code>.</p>') +
    '<div class="admrow"><button class="rbtn check" id="toshop">Открыть мастерскую →</button></div></div>';

  h += '<div class="sect"><h2>Готовые программы</h2><div class="line"></div>' +
    '<span class="cnt">' + built + ' из ' + projects.length + '</span></div>';

  if (!projects.length){
    h += '<div class="note"><b>Программ пока нет</b>Они появятся, когда будет собран первый проект.</div>';
  } else {
    h += '<p class="dim">Кнопка «Скачать .py» отдаёт готовый файл: сохрани его и набери ' +
      'в терминале <code>python3 имя.py</code> — программа пойдёт в настоящем Python. ' +
      'Рисующей программе тренажёр допишет первую строку <code>from turtle import *</code> ' +
      'и последнюю <code>done()</code>: в тренажёре команды черепашки встроены, ' +
      'а в настоящем Python их надо подключить.</p>';
  }
  projects.forEach(function(p){
    var st = projectState(p.id), done = projectDone(p.id), open = projectOpen(p);
    var where = projectWhere(p);
    var stat = done ? "собрана ✓"
             : (st.step > 0 ? "шагов " + st.step + " из " + p.steps.length
                            : (open ? "можно собирать" : "закрыта"));
    h += '<div class="fproj' + (done ? " done" : (open ? "" : " locked")) + '">' +
      '<div class="fptop"><span class="pjemoji">' + p.emoji + '</span>' +
      '<div class="fpttl"><span class="pjkicker">' + esc(where) + '</span>' +
      '<b>' + esc(p.title) + '</b>' +
      '<span class="fpsub">' + esc(p.tagline) + '</span></div>' +
      '<span class="fpstat' + (done ? " ok" : "") + '">' + stat + '</span></div>';
    if (done){
      var code = st.code || p.steps[p.steps.length - 1].solution;
      var n = code.replace(/\n+$/, "").split("\n").length;
      h += '<pre class="fpcode">' + esc(code) + '</pre>' +
        '<div class="fpbtns"><button class="rbtn" data-open="' + p.id + '">Открыть и запустить</button>' +
        '<button class="rbtn sec" data-copy="' + p.id + '">Скопировать код</button>' +
        '<button class="rbtn sec" data-py="' + p.id + '">⬇ Скачать .py</button>' +
        '<span class="fplen">' + n + " " + plural(n, "строка", "строки", "строк") + '</span></div>';
    } else {
      h += '<div class="fpbtns">' + (open
        ? '<button class="rbtn" data-open="' + p.id + '">' +
            (st.step > 0 ? "Продолжить" : "Собрать") + '</button>'
        : '<span class="soontag">откроется, когда будет пройден ' + esc(projectGate(p)) + '</span>') +
        '</div>';
    }
    h += '</div>';
  });

  /* ===== мои рисунки ===== */
  var pics = galleryList();
  h += '<div class="sect"><h2>Мои рисунки</h2><div class="line"></div>' +
    '<span class="cnt">' + pics.length + '</span></div>';
  if (!pics.length){
    h += '<div class="note"><b>Рисунков пока нет</b>Нарисуй что-нибудь в песочнице ' +
      'и нажми там «Сохранить рисунок в галерею». Хранится программа, а не картинка, ' +
      'поэтому рисунок можно открыть и переделать в любой момент.</div>';
  } else {
    h += '<div class="pics">' + pics.map(function(x){
      var n = x.code.replace(/\n+$/, "").split("\n").length;
      return '<div class="pic" data-pic="' + x.id + '">' +
        '<canvas class="picart"></canvas>' +
        '<div class="picbody"><b>' + esc(x.title) + '</b>' +
        '<span class="picsub">' + fmtDay(x.at) + ' · ' + n + ' ' +
          plural(n, "строка", "строки", "строк") + '</span>' +
        '<div class="picbtns">' +
          '<button class="rbtn sec" data-png="' + x.id + '">⬇ PNG</button>' +
          '<button class="rbtn sec" data-picopen="' + x.id + '">→ В песочницу</button>' +
          '<button class="rbtn sec" data-picdel="' + x.id + '">Удалить</button>' +
        '</div></div></div>';
    }).join("") + '</div>';
  }

  /* ===== свои задания ===== */
  var tasks = myTasksList();
  h += '<div class="sect"><h2>Свои задания</h2><div class="line"></div>' +
    '<span class="cnt">' + tasks.length + '</span></div>';
  if (!tasks.length){
    h += '<div class="note"><b>Заданий пока нет</b>Придумать задачу труднее, чем решить: ' +
      'придётся объяснить её словами тому, кто твоего кода не видит. ' +
      '<button class="rbtn" id="folio-mine">Составить задание</button></div>';
  } else {
    h += '<div class="hubgrid">' + tasks.map(function(t){
      return '<div class="hubcard"><span class="hubem">✍️</span>' +
        '<b>' + esc(t.title) + '</b>' +
        '<span class="hubwhy">' + esc(t.goal) + '</span>' +
        '<span class="hubstat">' + fmtDay(t.at) + ' · ответ из ' + t.lines.length + ' ' +
          plural(t.lines.length, "строки", "строк", "строк") + '</span>' +
        '<div class="picbtns"><button class="rbtn sec" data-tasklink="' + t.id + '">Скопировать ссылку</button>' +
        '<button class="rbtn sec" data-taskopen="' + t.id + '">Открыть</button></div></div>';
    }).join("") + '</div>' +
    '<p class="dim">Ссылку можно отправить кому угодно: задание целиком лежит внутри неё, ' +
    'сервер для этого не нужен. Составить ещё одно — на экране «Своё задание».</p>';
  }

  h += '<div class="sect"><h2>Сертификаты</h2><div class="line"></div>' +
    '<span class="cnt">' + gotCerts + ' из ' + certs.length + '</span></div>' +
    '<p class="dim">Сертификат даётся не за прочитанные уроки, а за уроки плюс собранный ' +
    'проект мира. Отдельно — за разделы вне сотни: всю «Разминку» и весь «Ты и ИИ». ' +
    'Любой можно распечатать или сохранить в PDF.</p><div class="certs">';
  certs.forEach(function(c){
    h += '<div class="certcard' + (c.ready ? " got" : "") + '">' +
      '<span class="cticon">' + c.icon + '</span>' +
      '<span class="ctbody"><b>' + esc(c.title) + '</b>' +
      '<span>' + (c.ready ? "Выдан " + fmtDay(c.at) : esc(c.need)) + '</span></span>' +
      (c.ready ? '<button class="rbtn" data-cert="' + c.id + '">Показать</button>'
               : '<span class="soontag">пока нет</span>') +
      '</div>';
  });
  h += '</div>';

  h += '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';

  app.innerHTML = h;
  var tsh = document.getElementById("toshop");
  if (tsh) tsh.onclick = screenShop;
  app.querySelectorAll("[data-open]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-open");
      if (projectDone(id)) screenProjectDone(id); else openProject(id);
    };
  });
  /* Рисунки считаются заново: в прогрессе лежит программа, а не картинка.
     Прогон честный, тем же движком, — значит и рисунок тот же самый. */
  app.querySelectorAll(".pic").forEach(function(card){
    var x = galleryAll()[card.getAttribute("data-pic")];
    if (!x) return;
    var res = galleryDrawing(x.code);
    var cv = card.querySelector("canvas");
    if (res && res.turtle) drawTurtle(cv, res.turtle);
    else card.classList.add("broken");
  });
  app.querySelectorAll("[data-png]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-png");
      var card = app.querySelector('.pic[data-pic="' + id + '"]');
      var cv = card && card.querySelector("canvas");
      var x = galleryAll()[id];
      if (!cv || !x) return;
      try { downloadDataURL(pyFileName(x.title).replace(/\.py$/, "") + ".png",
                            cv.toDataURL("image/png"), b); } catch(e){}
    };
  });
  app.querySelectorAll("[data-picopen]").forEach(function(b){
    b.onclick = function(){
      var x = galleryAll()[b.getAttribute("data-picopen")];
      if (!x) return;
      S.sandbox = x.code; save();
      screenSandbox();
    };
  });
  app.querySelectorAll("[data-picdel]").forEach(function(b){
    b.onclick = function(){ galleryDrop(b.getAttribute("data-picdel")); screenFolio(); };
  });
  var fm = document.getElementById("folio-mine");
  if (fm) fm.onclick = function(){ screenMyTasks(); };
  app.querySelectorAll("[data-tasklink]").forEach(function(b){
    b.onclick = function(){
      var t = myTasksAll()[b.getAttribute("data-tasklink")];
      if (t) copyText(taskLink(t), b);
    };
  });
  app.querySelectorAll("[data-taskopen]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-taskopen"), t = myTasksAll()[id];
      if (t) openFriendTask(t, { own:true, id:id });
    };
  });
  app.querySelectorAll("[data-py]").forEach(function(b){
    b.onclick = function(){
      var p = projectById(b.getAttribute("data-py"));
      if (!p) return;
      var st = projectState(p.id);
      var code = st.code || p.steps[p.steps.length - 1].solution;
      downloadText(pyFileName(p.title), pyFileText(p.title, code), b);
    };
  });
  app.querySelectorAll("[data-copy]").forEach(function(b){
    b.onclick = function(){
      var p = projectById(b.getAttribute("data-copy"));
      if (!p) return;
      var st = projectState(p.id);
      copyText(st.code || p.steps[p.steps.length - 1].solution, b);
    };
  });
  app.querySelectorAll("[data-cert]").forEach(function(b){
    b.onclick = function(){
      var v = b.getAttribute("data-cert");
      openCert(v === "course" ? "course" : +v.replace("world", ""));
    };
  });
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}


/* ================= экран занятия =================
   Ребёнок видит ПОЛОСУ занятия, а не обратный отсчёт: часы, отсчитывающие
   время до конца, торопят, а весь продукт построен на том, что за медленность
   не наказывают. Время здесь ничего не обрывает — оно только разрешает
   закончить. */
function zanBlockLabel(b){
  if (b.k === "warm") return "Разминка";
  if (b.k === "lesson") return "Урок";
  if (b.k === "review") return "Повторение";
  return "Проверка понимания";
}
function zanBlockEmoji(b){
  return b.k === "warm" ? "🧩" : b.k === "lesson" ? "📘" : b.k === "review" ? "🔁" : "🔮";
}
function zanOpenBlock(b){
  /* Проверка понимания: если сегодня ребёнок написал программу, из которой
     получается честный вопрос, спрашиваем про НЕЁ, а не про чужую разминку.
     Не получилось — разминка, как и раньше. Молча: обещать «спросим про твой
     код» и не спросить хуже, чем не обещать. */
  if (b.k === "predict"){
    var mine = myPredictPick();
    if (mine) return openMyPredict(mine, b.id);
    /* id «mine» — это блок, заведённый ради своей программы, и разминки за
       ним нет вовсе. Такое возможно, если программа успела вытесниться из
       списка занятия: тогда честнее вернуть в занятие, чем высадить ребёнка
       в чужом разделе. */
    if (b.id === "mine") return screenZan();
  }
  if (b.k === "warm" || b.k === "predict") openWarmup(b.id, {});
  else openLesson(b.id);
}
function screenZan(){
  enterScreen(undefined, "zan");
  var rec = zanOpen();
  var planned = frameOn();

  if (!rec){
    var plan = zanPlanFor(dayKey());
    var f = frame();
    var listHTML = plan.length
      ? '<ol class="zanplan">' + plan.map(function(b){
          return '<li><span class="zi">' + zanBlockEmoji(b) + '</span>' +
            '<b>' + zanBlockLabel(b) + '</b> · ' + esc(b.title || b.id) + '</li>';
        }).join("") + '</ol>'
      : '<p class="dim">План пока пустой: не открыто ни одного урока. Пройди первый урок Мира 1 — и занятие соберётся само.</p>';
    app.innerHTML =
      '<div class="lvlhead"><div><div class="idx">' + (planned ? "занятие по расписанию" : "занятие") + '</div>' +
        '<h1>⏱ Занятие на ' + f.len + ' минут</h1></div>' +
        '<div class="right"><span class="tag">' + plan.length + ' ' + plural(plan.length, "шаг", "шага", "шагов") + '</span></div></div>' +
      '<p class="lede">Занятие — это не «сколько успеешь», а понятный кусок: вот столько минут, вот эти шаги, и всё. ' +
      'Урок посередине не обрывается: время только разрешает закончить, а не подгоняет.</p>' +
      '<div class="card"><h3>Что сегодня в занятии</h3>' + listHTML + '</div>' +
      '<div class="winrow"><button class="bigbtn" id="zgo"' + (plan.length ? "" : " disabled") + '>Начать занятие</button>' +
      '<button class="bigbtn ghost" id="zback">← На «Сегодня»</button></div>';
    var zg = document.getElementById("zgo");
    if (zg && plan.length) zg.onclick = function(){ zanStart(); screenZan(); };
    document.getElementById("zback").onclick = screenToday;
    refreshTop();
    return;
  }

  /* сжатие проверяется при каждом возврате на экран: время могло выйти, пока
     ребёнок сидел в уроке */
  var squeezed = zanSqueeze(rec);
  rec = zanOpen() || rec;

  var doneSet = {};
  (rec.done || []).forEach(function(x){ doneSet[x] = 1; });
  var rest = zanRemaining(rec);
  var next = rest[0] || null;
  var mins = zanMins(rec), pause = zanPauseMins(rec);
  var closed = zanClosedCount(rec);
  var pct = Math.min(100, Math.round((closed / Math.max(1, rec.plan.length)) * 100));

  /* ⚠️ Спрашиваем ТОЛЬКО между шагами — урок посередине не режется ни при
     каких обстоятельствах. Экран занятия и есть это «между», потому что
     попасть сюда можно только закончив шаг или уйдя из него самому.
     rec.ask помнит, на каком месте ребёнок сказал «ещё один урок»: пока он его
     не СДЕЛАЛ, вопрос не повторяется. Считаем именно сделанные шаги, а не
     закрытые: перенос по сжатию — не работа ребёнка, и засчитывать его за
     обещанный урок было бы обманом в свою пользу. */
  var askNow = zanTimeUp(rec) && rest.length && (rec.done || []).length >= (rec.ask || 0);
  var restLessons = rest.filter(function(b){ return b.k === "lesson" || b.k === "review"; });
  var hasCheck = rest.some(function(b){ return b.k === "predict"; });

  /* идёт перерыв — экран занятия превращается в экран перерыва и ничего
     больше не предлагает: смысл перерыва в том, чтобы отойти */
  if (zanOnBreak(rec)){
    var left = Math.max(1, Math.ceil((rec.breakUntil - Date.now()) / 60000));
    app.innerHTML =
      '<div class="lvlhead"><div><div class="idx">занятие на паузе</div>' +
        '<h1>☕ Перерыв</h1></div></div>' +
      '<div class="card"><p class="asktext">Отойди от экрана: попей воды, разомнись, посмотри в окно. ' +
      'Вернись примерно через <b>' + left + ' ' + plural(left, "минуту", "минуты", "минут") + '</b>.</p>' +
      '<p class="dim">Это время не считается работой — оно и не должно.</p>' +
      '<div class="winrow"><button class="bigbtn" id="zback2">Я вернулся</button></div></div>';
    document.getElementById("zback2").onclick = function(){
      var r = zanAll()[rec.key];
      zanBreakEnd(r);
      actMark();
      screenZan();
    };
    refreshTop();
    return;
  }

  var head = '<div class="lvlhead"><div><div class="idx">идёт занятие</div>' +
      '<h1>⏱ Занятие на ' + rec.len + ' минут</h1></div>' +
      '<div class="right"><span class="tag">' + closed + ' из ' + rec.plan.length + '</span></div></div>' +
    '<div class="zanbar"><i style="width:' + pct + '%"></i></div>' +
    '<p class="zanmeta">Работы: <b>' + mins + ' ' + plural(mins, "минута", "минуты", "минут") + '</b>' +
      (pause >= 2 ? ' · перерыв: <b>' + pause + '</b>' : '') + '</p>';

  var capNote = capNoteHTML();
  /* мягкое предложение перерыва: длинное занятие, половина позади */
  var breakNote = zanBreakDue(rec)
    ? '<div class="daybanner rest">☕ <b>Работаешь уже ' + mins + ' ' +
      plural(mins, "минуту", "минуты", "минут") + '.</b> Самое время сделать перерыв — ' +
      'после него дальше пойдёт легче.</div>'
    : "";

  /* видимая пометка о сжатии: молча сокращать план нельзя */
  var cutNote = "";
  if (squeezed)
    cutNote = '<div class="daybanner rest">📌 <b>Сегодня идёт тяжелее обычного.</b> ' +
      'Последний шаг перенесли на следующее занятие, чтобы ты успел дойти до конца. ' +
      'Он не пропал — вернётся сам.</div>';

  var plan = '<div class="card"><h3>Шаги занятия</h3><ol class="zanplan">' +
      rec.plan.map(function(b){
        var isDone = !!doneSet[b.k + ":" + b.id];
        var isCut = zanIsCut(rec, b);
        var cur = !isDone && !isCut && next && next.id === b.id && next.k === b.k;
        return '<li class="' + (isDone ? "done" : (isCut ? "cut" : (cur ? "cur" : ""))) + '">' +
          '<span class="zi">' + (isDone ? "✓" : (isCut ? "📌" : zanBlockEmoji(b))) + '</span>' +
          '<b>' + zanBlockLabel(b) + '</b> · ' + esc(b.title || b.id) +
          (isCut ? ' <span class="dim">перенесли на следующий раз</span>' : '') +
          (cur && !askNow ? ' <button class="rbtn check zopen" data-zk="' + b.k + '" data-zi="' + esc(b.id) + '">Открыть</button>' : '') +
        '</li>';
      }).join("") + '</ol></div>';

  /* ---------- выбор, когда время вышло ----------
     Три кнопки, а не две. Средняя — это СОГЛАСОВАННЫЙ объём: ребёнок сам
     называет, сколько ещё сделает, вместо открытой двери «продолжай сколько
     хочешь». Хвалить за продолжение нельзя ни словом: «молодец, что не
     остановился» превращает занятие в гонку. */
  var tail;
  if (askNow){
    tail = '<div class="card zanask"><h3>⏱ ' + rec.len + ' минут прошло</h3>' +
      '<p>Занятие можно закрывать — ты своё отработал. Или сделать ещё шаг, если сегодня идёт хорошо. ' +
      'Решай сам.</p><div class="winrow">' +
        '<button class="bigbtn" id="zstop">Закончить занятие</button>' +
        (restLessons.length ? '<button class="bigbtn ghost" id="zone">Ещё один урок</button>' : '') +
        (hasCheck && restLessons.length ? '<button class="bigbtn ghost" id="zcheck">Только проверку и всё</button>' : '') +
      '</div><p class="dim">Что не успели — не пропадёт: перенесётся на следующее занятие.</p></div>';
  } else {
    tail = '<div class="winrow">' +
      (next ? '<button class="bigbtn" id="zgo2">Продолжить занятие</button>' : '') +
      '<button class="bigbtn ghost" id="zend">Закончить занятие</button></div>' +
      '<p class="dim">Закончить можно в любой момент — даже если сегодня не пошло. ' +
      'Занятие всё равно засчитается: важнее, что ты сел, чем сколько успел.</p>';
  }

  /* ⚠️ Жёсткий потолок не обрывает начатое: кнопки «открыть» просто нет, а
     занятие можно закрыть. Резать посередине нельзя ни таймеру, ни потолку. */
  if (capHard() && !askNow){
    tail = '<div class="card"><h3>🌙 На сегодня всё</h3>' +
      '<p>Дневной предел, о котором вы договорились со взрослым, уже пройден. ' +
      'Новые шаги откроются завтра — занятие можно закрыть.</p>' +
      '<div class="winrow"><button class="bigbtn" id="zend">Закончить занятие</button></div></div>';
    plan = plan.replace(/<button class="rbtn check zopen"[^<]*<\/button>/g, "");
  }

  var breakBtn = (!askNow && !capHard() && next)
    ? '<div class="winrow"><button class="bigbtn ghost" id="zbreak">☕ Перерыв ' + ZAN_BREAK + ' минут</button></div>'
    : "";

  app.innerHTML = head + capNote + breakNote + cutNote + plan + tail + breakBtn;

  app.querySelectorAll(".zopen").forEach(function(b){
    b.onclick = function(){ zanOpenBlock({ k:b.getAttribute("data-zk"), id:b.getAttribute("data-zi") }); };
  });
  var zg2 = document.getElementById("zgo2");
  if (zg2 && next) zg2.onclick = function(){ zanOpenBlock(next); };
  var zend = document.getElementById("zend");
  if (zend) zend.onclick = function(){ screenZanDone(zanFinish("hand") || rec); };
  var zbr = document.getElementById("zbreak");
  if (zbr) zbr.onclick = function(){ zanBreakStart(zanAll()[rec.key]); screenZan(); };
  var zstop = document.getElementById("zstop");
  if (zstop) zstop.onclick = function(){ screenZanDone(zanFinish("time") || rec); };
  var zone = document.getElementById("zone");
  if (zone) zone.onclick = function(){
    var r = zanAll()[rec.key];
    if (r){ r.ask = (r.done || []).length + 1; save(); }
    var step = zanRemaining(r || rec)[0];
    if (step) zanOpenBlock(step); else screenZan();
  };
  var zcheck = document.getElementById("zcheck");
  if (zcheck) zcheck.onclick = function(){
    var r = zanAll()[rec.key];
    if (!r) return screenZan();
    zanCutToCheck(r);
    var step = zanRemaining(r)[0];
    if (step) zanOpenBlock(step);
    else screenZanDone(zanFinish("choice") || r);
  };
  refreshTop();
}
/* Итог занятия. Показывается и когда всё сделано, и когда закончили руками —
   разница только в словах. Занятие, брошенное на первом уроке, тоже
   закрывается: иначе ребёнок, у которого не пошло, остаётся без финала, а
   взрослый — без отчёта ровно в тот день, когда отчёт нужнее всего. */
function screenZanDone(rec){
  enterScreen(undefined, "zan");
  var r = zanReport(rec, S);
  markActiveToday();
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">занятие закрыто</div>' +
      '<h1>' + (r.full ? "🏁 Занятие пройдено" : "🏁 Занятие закончено") + '</h1></div></div>' +
    '<div class="card zandone">' +
      '<p class="zanwas"><b>' + esc(r.was) + '.</b></p>' +
      (r.full ? '<p>Весь план сделан.</p>'
              : '<p>План сделан не весь — и это нормально: занятие засчитано, потому что ты сел и работал.</p>') +
      (r.cutN ? '<p class="dim">📌 Перенесли на следующее занятие: ' + r.cutN + ' ' +
        plural(r.cutN, "шаг", "шага", "шагов") + '. Они не пропали.</p>' : '') +
      '<p class="dim">' + esc(r.got) + '</p>' +
    '</div>' +
    '<div class="card"><h3>Что увидит взрослый</h3>' +
      '<p class="dim">Ровно эти строки — ничего сверх них мы никому не показываем.</p>' +
      '<ul class="zanrep"><li>' + esc(r.was) + '</li><li>Похвалить: ' + esc(r.praise) + '</li>' +
      (r.cut ? '<li>' + esc(r.cut) + '</li>' : '') +
      '<li>' + esc(r.got) + '</li><li>' + esc(r.ask) + '</li></ul></div>' +
    /* ⚠️ Обратное направление стоит ЗДЕСЬ, в конце занятия, и это не украшение.
       Взрослый задаёт ребёнку — это контроль, и контролем одним подписку не
       удержать. Ребёнок задаёт взрослому — это интерес: у работы появляется
       зритель, а у ребёнка роль старшего (docs/foresight-2027.md § 16.4,
       механика 3). Конец занятия — единственная точка, где оба только что
       были рядом и оба свободны. */
    '<div class="card"><h3>✍️ Задай задачу взрослому</h3>' +
      '<p>Придумай задачу, отправь ссылкой маме, папе или другу — и посмотри, ' +
      'решат ли. Проверять будет тренажёр, а не ты: сойтись должен вывод.</p>' +
      '<p class="dim">Составить задачу труднее, чем решить: придётся объяснить её словами так, ' +
      'чтобы человек понял без твоей программы.</p>' +
      '<div class="admrow"><button class="rbtn check" id="zask">Задать задачу →</button></div></div>' +
    '<div class="winrow"><button class="bigbtn" id="ztoday">← На «Сегодня»</button>' +
      '<button class="bigbtn ghost" id="zmap">К урокам</button></div>';
  document.getElementById("ztoday").onclick = screenToday;
  document.getElementById("zmap").onclick = screenWorlds;
  var za = document.getElementById("zask");
  if (za) za.onclick = function(){ screenMyTasks(); };
  sfx("win");
  refreshTop();
}

/* ================= карта активности по дням и часам =================
   Отвечает не на «сколько», а на «КОГДА» — и это ровно то, чего взрослый не
   видит. Строка «занимался в 23:40» говорит ему больше любых процентов.

   ⚠️ Это карта ритма, а не табель. Никаких норм, красных зон и «мало
   занимался»: вывод делает взрослый, а мы не имеем права его выносить.
   Поэтому у клеток нет «плохих» цветов, а у карты нет оценки. */
var HEAT_DAYS = 14;
function heatLevel(sec){
  if (!sec) return 0;
  if (sec < 120) return 1;
  if (sec < 300) return 2;
  if (sec < 900) return 3;
  return 4;
}
function heatHTML(st){
  var hours = (st && st.hours) || {};
  var today = dayKey(), rows = [], any = false;
  for (var i = HEAT_DAYS - 1; i >= 0; i--){
    var key = shiftDay(today, -i), row = hours[key] || [];
    var cells = "";
    for (var h = 0; h < 24; h++){
      var sec = row[h] || 0;
      if (sec) any = true;
      cells += '<i class="hl' + heatLevel(sec) + '" title="' + key + ", " + h + ':00 — ' +
        Math.round(sec / 60) + ' мин"></i>';
    }
    var d = new Date(key + "T12:00:00");
    var names = ["вс","пн","вт","ср","чт","пт","сб"];
    rows.push('<div class="heatrow"><span class="hd">' + names[d.getDay()] + " " + d.getDate() + '</span>' +
      '<div class="hcells">' + cells + '</div></div>');
  }
  var scale = '<div class="heatscale"><span>меньше</span>' +
    '<i class="hl0"></i><i class="hl1"></i><i class="hl2"></i><i class="hl3"></i><i class="hl4"></i>' +
    '<span>больше</span></div>';
  return '<div class="card"><h3>🗓 Когда он занимался</h3>' +
    (any ? '' : '<p class="dim">Пока пусто: карта заполнится после первых занятий.</p>') +
    '<div class="heat"><div class="heathead"><span class="hd"></span>' +
      '<div class="hcells"><b>0</b><b>6</b><b>12</b><b>18</b></div></div>' +
      rows.join("") + '</div>' + scale +
    '<p class="dim">Каждая клетка — час суток за последние две недели. ' +
    'Считаются только активные минуты: если вкладка была открыта, а ребёнка не было, ' +
    'время не идёт. Это карта ритма, а не оценка.</p></div>';
}

/* ================= нотация приёмки =================
   Ставка из docs/foresight-2027.md § 6.3–6.5, и единственная, которая даёт
   одновременно новый жанр обучения и причину, по которой его нельзя
   скопировать: нотация без судьи вырождается в «спроси у ИИ, правильно ли», а
   судья есть только у того, у кого свой интерпретатор.

   Жанр. Ребёнок НЕ пишет реализацию. Он пишет, ЧТО ДОЛЖНО БЫТЬ ВЕРНО, код
   пишет напарник, а движок выносит вердикт: какая строка нарушена и на каких
   данных. Человек стоит на стороне заказчика и приёмщика.

   ⚠️ ГЛАВНЫЙ РИСК — СДЕЛАТЬ ИГРУШКУ. Если нотация останется красивыми русскими
   словами, ни во что не переводимыми, ребёнок выучит наш диалект и не получит
   ничего, что существует за пределами Кодоквеста. Защита одна и жёсткая:
   **каждая строка компилируется в настоящий Python** и показывается ребёнку в
   этом виде по кнопке. Это не новый язык вместо Python, а русская надстройка
   над тем, что в Python и так есть (assert, прогон на наборе данных).

   Четыре слова, больше не нужно:
     пример   сумма([1, 2, 3]) = 6        → assert сумма([1, 2, 3]) == 6
     всегда   результат >= 0              → на КАЖДОМ примере: assert условие
     никогда  результат in числа          → на каждом примере: assert not условие
     не дороже 200 шагов                  → цена вызова по счётчику движка

   «Всегда» и «никогда» проверяются на данных из строк «пример» — и это не
   упрощение, а сама мысль: примеры дают данные, правила дают смысл. Без
   примеров правило проверять не на чем, и мы об этом честно говорим.

   ⚠️ «Не дороже N шагов» — та строка, которой нет ни у кого: у взрослых
   корректность и цена решения живут в разных инструментах, а наш интерпретатор
   считает шаги и так, ради защиты от вечного цикла.
   ============================================================ */
var SPEC_KINDS = ["пример", "всегда", "никогда", "не дороже"];

/* Разрезать «a, b, [1, 2]» по запятым ВЕРХНЕГО уровня. Наивный split(",") дал
   бы «[1» и «2]» — то есть развалил бы любой список внутри аргументов. */
function specSplitArgs(src){
  var out = [], depth = 0, cur = "", q = "";
  for (var i = 0; i < src.length; i++){
    var c = src[i];
    if (q){ cur += c; if (c === q) q = ""; continue; }
    if (c === '"' || c === "'"){ q = c; cur += c; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    if (c === ")" || c === "]" || c === "}") depth--;
    if (c === "," && depth === 0){ out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/* Разбор спецификации. Возвращает список строк с разметкой и первую ошибку
   записи: сказать «не понял третью строку» надо ДО всякого прогона. */
function specParse(text, task){
  var lines = String(text || "").split("\n");
  var out = [], problem = null;
  lines.forEach(function(raw, i){
    var t = raw.trim();
    if (!t || t.charAt(0) === "#") return;
    var low = t.toLowerCase();
    var rec = { n: i + 1, raw: t };

    if (low.indexOf("не дороже") === 0){
      var m = /^не\s+дороже\s+(\d+)\s+шаг/i.exec(t);
      if (!m){
        if (!problem) problem = { n: rec.n, why: "После «не дороже» нужно число и слово «шагов»: «не дороже 200 шагов»." };
        return;
      }
      rec.kind = "budget"; rec.budget = +m[1];
      out.push(rec); return;
    }
    if (low.indexOf("пример") === 0){
      var body = t.slice(6).trim();
      var eq = body.lastIndexOf("=");
      /* «==» в примере — частая описка: пишем как в тетради, через одно «=» */
      if (eq > 0 && body.charAt(eq - 1) === "=") eq--;
      if (eq < 0){
        if (!problem) problem = { n: rec.n, why: "В примере не хватает знака «=»: «пример " +
          task.fn + "(…) = ответ»." };
        return;
      }
      var call = body.slice(0, eq).trim(), want = body.slice(eq).replace(/^=+/, "").trim();
      var open = call.indexOf("(");
      if (open < 0 || call.charAt(call.length - 1) !== ")"){
        if (!problem) problem = { n: rec.n, why: "Слева от «=» должен стоять вызов: «" +
          task.fn + "(…)»." };
        return;
      }
      var name = call.slice(0, open).trim();
      if (name !== task.fn){
        if (!problem) problem = { n: rec.n, why: "Принимаем функцию «" + task.fn +
          "», а в примере вызвана «" + name + "»." };
        return;
      }
      if (!want){
        if (!problem) problem = { n: rec.n, why: "После «=» не написан ответ." };
        return;
      }
      rec.kind = "example";
      rec.args = specSplitArgs(call.slice(open + 1, call.length - 1));
      rec.want = want;
      if (rec.args.length !== task.params.length){
        if (!problem) problem = { n: rec.n, why: "У функции «" + task.fn + "» " +
          task.params.length + " " + plural(task.params.length, "аргумент", "аргумента", "аргументов") +
          " (" + task.params.join(", ") + "), а в примере " + rec.args.length + "." };
        return;
      }
      out.push(rec); return;
    }
    if (low.indexOf("всегда") === 0 || low.indexOf("никогда") === 0){
      var always = low.indexOf("всегда") === 0;
      var cond = t.slice(always ? 6 : 7).trim();
      if (!cond){
        if (!problem) problem = { n: rec.n, why: "После «" + (always ? "всегда" : "никогда") +
          "» нужно условие — например «результат >= 0»." };
        return;
      }
      rec.kind = always ? "always" : "never";
      rec.cond = cond;
      out.push(rec); return;
    }
    if (!problem) problem = { n: rec.n, why: "Строка начинается не с того слова. Их четыре: " +
      SPEC_KINDS.map(function(x){ return "«" + x + "»"; }).join(", ") + "." };
  });

  var ex = out.filter(function(r){ return r.kind === "example"; });
  var rules = out.filter(function(r){ return r.kind === "always" || r.kind === "never"; });
  if (!problem && rules.length && !ex.length)
    problem = { n: rules[0].n, why: "Правило проверять не на чем: «всегда» и «никогда» " +
      "смотрят на данные из строк «пример», а примеров нет ни одного." };
  return { rows: out, examples: ex, problem: problem };
}

/* Тот же разбор — настоящим Python. Кнопка «Показать на Python» показывает
   ровно это, и это единственная защита от того, чтобы нотация стала диалектом
   вместо навыка. */
function specToPython(spec, task){
  var out = ["# приёмка: " + task.fn + "(" + task.params.join(", ") + ")"];
  spec.rows.forEach(function(r){
    if (r.kind === "example"){
      out.push("", "# " + r.raw);
      out.push("assert " + task.fn + "(" + r.args.join(", ") + ") == " + r.want);
    } else if (r.kind === "always" || r.kind === "never"){
      out.push("", "# " + r.raw);
      spec.examples.forEach(function(e){
        task.params.forEach(function(p, i){ out.push(p + " = " + e.args[i]); });
        out.push("результат = " + task.fn + "(" + task.params.join(", ") + ")");
        out.push("assert " + (r.kind === "never" ? "not (" + r.cond + ")" : r.cond));
      });
    } else if (r.kind === "budget"){
      out.push("", "# " + r.raw + " — цену считает движок тренажёра,");
      out.push("# в обычном Python на это есть отдельные инструменты");
    }
  });
  return out.join("\n");
}

/* Прогон одной строки. Каждую проверяем отдельной программой: иначе первая же
   упавшая скрыла бы все следующие, и вердикт врал бы про то, что цело. */
function specCheckOne(row, spec, task, code){
  var eng = Runtime.get("mini");
  function run(src){
    try { return eng.run(src, {}); } catch(e){ return { error: { kind:"Ошибка", msg:String(e) } }; }
  }
  if (row.kind === "example"){
    var r = run(code + "\n\nassert " + task.fn + "(" + row.args.join(", ") + ") == " + row.want);
    if (!r.error) return { ok:true };
    if (r.error.kind === "AssertionError"){
      /* Показать, ЧТО именно вернулось: «не сошлось» без числа ничему не учит. */
      var got = run(code + "\n\nprint(" + task.fn + "(" + row.args.join(", ") + "))");
      return { ok:false, why: "ждали " + row.want +
        (got.error ? "" : ", получили " + String(got.output || "").trim()) };
    }
    return { ok:false, why: (KIND_RU[r.error.kind] || r.error.kind) + ": " + r.error.msg };
  }
  if (row.kind === "always" || row.kind === "never"){
    for (var i = 0; i < spec.examples.length; i++){
      var e = spec.examples[i], head = "";
      task.params.forEach(function(p, k){ head += p + " = " + e.args[k] + "\n"; });
      head += "результат = " + task.fn + "(" + task.params.join(", ") + ")\n";
      var cond = row.kind === "never" ? "not (" + row.cond + ")" : row.cond;
      var rr = run(code + "\n\n" + head + "assert " + cond);
      if (!rr.error) continue;
      var на = task.fn + "(" + e.args.join(", ") + ")";
      if (rr.error.kind === "AssertionError")
        return { ok:false, why: "нарушено на " + на };
      return { ok:false, why: "на " + на + " — " +
        (KIND_RU[rr.error.kind] || rr.error.kind) + ": " + rr.error.msg };
    }
    return { ok:true };
  }
  if (row.kind === "budget"){
    if (!spec.examples.length) return { ok:false, why: "не на чем мерить: нет ни одного примера" };
    var e0 = spec.examples[0];
    /* Цена ВЫЗОВА, а не всей программы: описание функции тоже стоит шагов,
       и без вычитания число врало бы тем сильнее, чем длиннее код. */
    var base = run(code);
    var full = run(code + "\n\n" + task.fn + "(" + e0.args.join(", ") + ")");
    if (base.error || full.error) return { ok:false, why: "программа не запустилась" };
    var cost = Math.max(0, (full.steps || 0) - (base.steps || 0));
    return cost <= row.budget
      ? { ok:true, note: "вышло " + cost }
      : { ok:false, why: "вышло " + cost + " при разрешённых " + row.budget };
  }
  return { ok:true };
}

function specRunAll(spec, task, code){
  var rows = spec.rows.map(function(r){
    var v = specCheckOne(r, spec, task, code);
    return { n:r.n, raw:r.raw, kind:r.kind, ok:v.ok, why:v.why || "", note:v.note || "" };
  });
  return { rows: rows, ok: rows.every(function(r){ return r.ok; }) };
}

/* Вердикт приёмки. ⚠️ Порядок обязателен и держит всю механику:
   СНАЧАЛА спецификация обязана пройти на ЭТАЛОНЕ. Без этого её можно было бы
   пройти строкой «пример f(1) = 999»: заведомая ложь, код её не проходит, и мы
   бы засчитали приёмку. Спецификация, отвергающая правильную программу, —
   плохая спецификация, и это первое, что узнаёт любой, кто пишет тесты. */
function specVerdict(spec, task, specText){
  var parsed = spec;
  if (parsed.problem)
    return { state:"parse", line: parsed.problem.n, why: parsed.problem.why };
  if (!parsed.rows.length)
    return { state:"empty", why: "Пока не написано ни одной строки." };
  if (parsed.rows.length < (task.want || 2))
    return { state:"thin", why: "Строк маловато: приёмка из " + parsed.rows.length + " " +
      plural(parsed.rows.length, "строки", "строк", "строк") + " ничего не доказывает. " +
      "Здесь нужно хотя бы " + task.want + "." };

  var onTruth = specRunAll(parsed, task, task.truth);
  if (!onTruth.ok){
    var bad = onTruth.rows.filter(function(r){ return !r.ok; })[0];
    return { state:"wrongspec", line: bad.n, why: bad.why, rows: onTruth.rows };
  }
  var onCode = specRunAll(parsed, task, task.code);
  if (task.broken)
    return onCode.ok
      ? { state:"missed", rows: onCode.rows }
      : { state:"caught", rows: onCode.rows };
  return onCode.ok
    ? { state:"accepted", rows: onCode.rows }
    : { state:"falsealarm", rows: onCode.rows,
        line: onCode.rows.filter(function(r){ return !r.ok; })[0].n };
}

function specsList(){ return (window.SPECS || []); }
function specDone(id){ return !!(S.specs && S.specs[id]); }
function specMark(id){ S.specs = S.specs || {}; S.specs[id] = 1; save(); }

/* ---------- экраны приёмки ---------- */
var SPEC_START = "# Напиши, что должно быть верно. Четыре слова:\n" +
  "#   пример   имя(...) = ответ\n" +
  "#   всегда   условие\n" +
  "#   никогда  условие\n" +
  "#   не дороже 200 шагов\n";

function screenSpecs(){
  enterScreen("train", "specs");
  session = { id:null, attempts:0, hints:0, shown:false };
  var list = specsList(), done = list.filter(function(x){ return specDone(x.id); }).length;

  var h = '<div class="lvlhead"><div><div class="idx">приёмка работы</div>' +
    '<h1>📋 Приёмка</h1></div>' +
    '<div class="right"><span class="tag">' + done + ' из ' + list.length + '</span></div></div>' +
    '<p class="lede">Здесь ты не пишешь программу. Программу написал напарник — ' +
    'а ты <b>принимаешь работу</b>: записываешь, что должно быть верно, и движок проверяет ' +
    'его код по твоим правилам. Так работают со взрослым кодом и так придётся работать с ИИ: ' +
    'он пишет быстро и уверенно, а отвечаешь за результат ты.</p>';

  h += '<div class="card"><h3>Как записывать</h3>' +
    '<p class="dim">Четыре слова, больше не нужно. Каждая строка — это настоящий Python, ' +
    'и на экране задания есть кнопка, которая покажет её в этом виде.</p>' +
    '<div class="specref">' +
    '<div><code>пример сумма([1, 2, 3]) = 6</code><span>конкретный случай и ответ к нему</span></div>' +
    '<div><code>всегда результат >= 0</code><span>правило, верное на всех примерах</span></div>' +
    '<div><code>никогда результат in числа</code><span>чего быть не должно</span></div>' +
    '<div><code>не дороже 200 шагов</code><span>цена вызова — её считает движок</span></div>' +
    '</div></div>';

  h += '<div class="gamelist">';
  list.forEach(function(x){
    h += '<button class="gamecard" data-spec="' + esc(x.id) + '">' +
      '<span class="gem">' + x.emoji + '</span>' +
      '<span class="gbody"><b>' + esc(x.title) + (specDone(x.id) ? ' ✓' : '') + '</b>' +
      '<span>' + esc(x.brief) + '</span></span>' +
      '<span class="wtag">' + (specDone(x.id) ? "принято" : "работа ждёт") + '</span></button>';
  });
  h += '</div><div class="pager"><button class="bigbtn ghost" id="tomap">← К тренировкам</button></div>';

  app.innerHTML = h;
  app.querySelectorAll("[data-spec]").forEach(function(b){
    b.onclick = function(){ openSpec(b.getAttribute("data-spec")); };
  });
  document.getElementById("tomap").onclick = screenTrain;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function specTaskById(id){
  return specsList().filter(function(x){ return x.id === id; })[0] || null;
}

function openSpec(id){
  var task = specTaskById(id);
  if (!task) return screenSpecs();
  enterScreen("train", "spec");
  session = { id:id, attempts:0, hints:0, shown:false, spec:true };

  var h = '<div class="crumbs"><span data-go="back">Приёмка</span> › ' + task.emoji + ' ' + esc(task.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">принимаем работу напарника</div>' +
    '<h1>' + task.emoji + ' ' + esc(task.title) + '</h1></div>' +
    '<div class="right"><span class="tag">' + esc(task.fn) + '(' + esc(task.params.join(", ")) + ')</span></div></div>' +
    '<div class="goal"><h3>🎯 О чём просили напарника</h3><p>' + esc(task.brief) + '</p>' +
    '<ul><li>Твоя задача — не переписать его код, а записать правила, по которым его судить.</li>' +
    '<li>Правила сначала проверяются на заведомо правильной программе: спецификация, ' +
    'которая отвергает верное решение, — плохая спецификация.</li></ul></div>';

  h += '<div class="card"><h3>📨 Что прислал напарник</h3>' +
    '<div class="showcode"><pre><code>' + hl(task.code) + '</code></pre>' +
    '<span class="shownote">менять этот код нельзя — его надо принять или вернуть</span></div></div>';

  h += '<div class="card"><h3>📋 Твоя приёмка</h3>' +
    '<textarea id="specin" class="stdinbox specin" rows="7" spellcheck="false" ' +
    'autocapitalize="off" autocorrect="off"></textarea>' +
    '<div class="admrow"><button class="rbtn check" id="specgo">✓ Принять работу</button>' +
    '<button class="rbtn sec" id="specpy">Показать на Python</button>' +
    '<button class="rbtn sec" id="specclr">↺ Очистить</button></div>' +
    '<div class="msg" id="specmsg"></div>' +
    '<div id="specpyout"></div></div>';

  h += '<div class="hintbox"><button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
    '<span class="tip">подсказки тут ничего не стоят — это тренировка</span></div>' +
    '<div class="hintout" id="hintout"></div>' +
    '<div class="pager"><button class="bigbtn ghost" data-go="back">← Ко всем работам</button></div>';

  app.innerHTML = h;
  var ta = document.getElementById("specin");
  ta.value = (S.specDrafts && S.specDrafts[id]) || SPEC_START;
  ta.addEventListener("input", function(){
    S.specDrafts = S.specDrafts || {};
    S.specDrafts[id] = ta.value;
  });

  function say(cls, html){
    var m = document.getElementById("specmsg");
    m.className = "msg show " + cls; m.innerHTML = html;
  }
  function rowsHTML(rows){
    if (!rows || !rows.length) return "";
    return '<div class="speclist">' + rows.map(function(r){
      return '<div class="specone ' + (r.ok ? "ok" : "bad") + '">' +
        '<span class="specmark">' + (r.ok ? "✓" : "✕") + '</span>' +
        '<code>' + esc(r.raw) + '</code>' +
        '<span>' + esc(r.why || r.note || (r.ok ? "выполняется" : "")) + '</span></div>';
    }).join("") + '</div>';
  }

  document.getElementById("specgo").onclick = function(){
    session.attempts++;
    var parsed = specParse(ta.value, task);
    var v = specVerdict(parsed, task, ta.value);
    if (v.state === "parse")
      return say("bad", "<b>Не понял строку " + v.line + "</b>" + esc(v.why));
    if (v.state === "empty" || v.state === "thin")
      return say("warn", "<b>Пока рано принимать</b>" + esc(v.why));
    if (v.state === "wrongspec")
      return say("bad", "<b>Спецификация отвергает правильную программу</b>" +
        "Строка " + v.line + " не проходит даже на заведомо верном решении" +
        (v.why ? " (" + esc(v.why) + ")" : "") + ". Значит дело не в напарнике, а в правиле: " +
        "оно требует того, о чём не просили." + rowsHTML(v.rows));
    if (v.state === "missed")
      return say("warn", "<b>Работа прошла приёмку — а зря</b>" +
        "Все твои правила выполняются, но в этом коде есть поломка. " +
        "Значит правила не покрывают того случая, о котором просили отдельно. " +
        "Перечитай просьбу: там есть фраза, под которую ты не написал ни одной строки." +
        rowsHTML(v.rows));
    if (v.state === "falsealarm")
      return say("bad", "<b>Ты вернул исправную работу</b>" +
        "Строка " + v.line + " не проходит, хотя код напарника верен. " +
        "Так бывает: правило оказалось строже, чем просьба." + rowsHTML(v.rows));
    /* caught и accepted — обе победа, и это важно сказать вслух */
    winSpec(task, v);
  };
  document.getElementById("specpy").onclick = function(){
    var parsed = specParse(ta.value, task);
    var box = document.getElementById("specpyout");
    if (parsed.problem)
      return say("bad", "<b>Не понял строку " + parsed.problem.n + "</b>" + esc(parsed.problem.why));
    box.innerHTML = '<div class="card"><h3>То же самое на Python</h3>' +
      '<div class="showcode"><pre><code>' + hl(specToPython(parsed, task)) + '</code></pre>' +
      '<span class="shownote">это не наш выдуманный язык: каждая твоя строка — обычный assert, ' +
      'и так проверяют код взрослые</span></div></div>';
    /* проверка на метод — не суеверие: в jsdom его нет, и без неё падал бы
       обработчик, а не прокрутка (грабля из README) */
    if (box.scrollIntoView) box.scrollIntoView({ behavior:"smooth", block:"center" });
  };
  document.getElementById("specclr").onclick = function(){
    ta.value = SPEC_START;
    S.specDrafts = S.specDrafts || {}; S.specDrafts[id] = ta.value; save();
    document.getElementById("specpyout").innerHTML = "";
    var m = document.getElementById("specmsg"); m.className = "msg";
  };
  wireHint(task.hints);
  app.querySelectorAll("[data-go]").forEach(function(b){ b.onclick = screenSpecs; });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function winSpec(task, v){
  var first = !specDone(task.id);
  specMark(task.id);
  markActiveToday();
  save(); refreshTop();
  var caught = v.state === "caught";
  document.getElementById("wincard").innerHTML =
    '<div class="big">' + (caught ? "🔍" : "✅") + '</div>' +
    '<h2>' + (caught ? "Работу вернули на доработку" : "Работу приняли") + '</h2>' +
    '<p>' + (caught
      ? "Твои правила поймали поломку — и поймали её движком, а не на глаз. " +
        "Именно так принимают чужой код: не читая его целиком, а проверяя то, о чём договаривались."
      : "Правила прошли, и код им соответствует. Приёмка нужна не чтобы обязательно найти ошибку, " +
        "а чтобы знать, что её нет.") + '</p>' +
    '<div class="stepnote"><b>Что тут было.</b> ' + esc(task.note) + '</div>' +
    '<div class="winrow"><button class="bigbtn" id="wspecs">Ко всем работам</button>' +
    '<button class="bigbtn ghost" id="wstay">Остаться здесь</button></div>';
  document.getElementById("win").classList.add("show");
  confetti(first ? 2 : 1);
  document.getElementById("wspecs").onclick = function(){ closeWin(); screenSpecs(); };
  document.getElementById("wstay").onclick = closeWin;
}

/* ================= витрина: что создают ученики =================
   Замер 03.09.2026 (docs/market-research.md § 3а): у Айтигенио есть отдельная
   страница «Что создают ученики на курсе?» — карусель работ с подписью
   «Лабиринт (Python), имя, 14 лет». Это и есть то, чем школы продают:
   **родитель покупает не программу курса, а вот эту картинку.** У нас такой
   страницы не было вовсе — показаны уроки, то есть процесс, а не изделие.

   ⚠️ ГЛАВНОЕ ОГРАНИЧЕНИЕ, И ОНО ЖЕ ПРЕИМУЩЕСТВО. Под чужой работой у них
   стоит имя и возраст ребёнка — это персональные данные, и под них берут
   согласие родителя. Нам этот путь закрыт конструкцией продукта, и открывать
   его нельзя: отсутствие ПДн — снятое юридическое ограничение целого сегмента
   (docs/foresight-2027.md § 7). Публичная лента чужих работ потребовала бы
   ещё и модерации, то есть ручного труда на каждого клиента, — прямо против
   требования автономности.

   Поэтому витрина устроена из двух половин, и ни в одной нет чужого ребёнка:
     1. что СОБИРАЕТСЯ на курсе — шесть проектов, рисунки и игры, запускаемые
        прямо здесь нашим же движком. Это честнее карусели скриншотов: у нас
        не картинка работы, а сама работа;
     2. что собрал ТЫ — только на этом устройстве, никуда не уезжает.

   ⚠️ Код проекта, который ещё не пройден, здесь НЕ показывается. Витрина — это
   витрина, а не ответы: родителю нужен результат, а выложить решение проекта
   рядом с курсом значит своими руками сломать курс. Показываем вывод (первые
   строки) — и код только у того проекта, который ребёнок уже собрал сам.
   ============================================================ */
var SHOW_LINES = 12;      /* столько строк вывода показываем в карточке */
var showOut = {};         /* вывод считается один раз за сессию */

function showcaseRun(code){
  if (showOut[code] === undefined){
    var r = Runtime.get("mini").run(code, {});
    showOut[code] = r.error ? null : String(r.output || "").replace(/\n+$/, "");
  }
  return showOut[code];
}
/* Готовая программа проекта — это последний шаг. Берём её же, что и экран
   «проект собран», чтобы витрина не разошлась с тем, что получит ребёнок. */
function showcaseProjects(){
  return projectsList().map(function(p){
    var code = p.steps[p.steps.length - 1].solution || "";
    return { p: p, code: code, out: showcaseRun(code), done: projectDone(p.id) };
  });
}
/* Сколько уроков надо пройти, чтобы дойти до проекта: честная цена входа,
   а не «начни прямо сейчас». Проект «Напарник» живёт вне миров. */
function showcaseAfter(p){
  if (p.world === 0) return "после раздела «Ты и ИИ»";
  var w = CURRICULUM.world(p.world);
  if (!w || !w.lessons || !w.lessons.length) return "после мира " + p.world;
  return "после урока " + w.lessons[w.lessons.length - 1].num;
}

function screenShowcase(){
  var seq = enterScreen("home", "works");
  session = { id:null, attempts:0, hints:0, shown:false };

  var list = showcaseProjects();
  var doneN = list.filter(function(x){ return x.done; }).length;
  var pics = galleryList().length, made = buildsList().length;
  var mine = myTasksList().length, got = solvedCount();

  var h = '<div class="lvlhead"><div><div class="idx">витрина</div>' +
    '<h1>🏗 Что создают ученики</h1></div>' +
    '<div class="right"><span class="tag">можно запустить прямо здесь</span></div></div>' +
    '<p class="lede">Программа курса ничего не говорит родителю: «списки, словари, классы» — ' +
    'это слова. Вот вещи, которые ученик собирает своими руками. Все они запускаются ' +
    'прямо на этой странице — это не картинки работ, а сами работы.</p>';

  h += '<div class="card"><h3>🧱 Шесть программ курса</h3>' +
    '<p class="dim">Каждая собирается по шагам в конце своего мира: ребёнок дописывает её сам, ' +
    'а движок проверяет каждый шаг. Нажмите «Что печатает» — программа выполнится здесь и сейчас.</p>' +
    '<div class="shelf">';
  list.forEach(function(x){
    var p = x.p;
    h += '<div class="partcard"><div class="parthead">' +
      '<b>' + p.emoji + ' ' + esc(p.title) + (x.done ? ' <span class="edittag done">собран ✓</span>' : '') + '</b>' +
      '<span class="dim">' + esc(showcaseAfter(p)) + '</span></div>' +
      '<p class="dim">' + esc(p.tagline) + '</p>' +
      (x.out === null
        ? '<p class="dim">Программа этого проекта запускается на экране проекта.</p>'
        : '<div class="partbar"><button class="rbtn check" data-show="' + p.id + '">▶ Что печатает</button>' +
          (x.done ? '<button class="rbtn sec" data-showopen="' + p.id + '">Открыть мою</button>' : '') +
          '</div><pre class="showout" data-out="' + p.id + '" hidden></pre>') +
      '</div>';
  });
  h += '</div>' +
    '<p class="dim">⚠️ Кода непройденного проекта здесь нет намеренно: витрина — это витрина, ' +
    'а не ответы. Выложить решение рядом с курсом значит своими руками сломать курс.</p></div>';

  /* Рисунки грузятся отдельно: контент мира приходит по требованию, и держать
     ради витрины все пять миров в памяти незачем. */
  h += '<div class="card" id="showdraw"><h3>🎨 Что рисует черепашка</h3>' +
    '<p class="dim">Рисунки считает тот же движок — это настоящий вывод программ из уроков, ' +
    'а не заготовленные картинки.</p><div class="drawstrip" id="drawstrip">' +
    '<p class="dim">Загружаем…</p></div></div>';

  var games = gamesList();
  if (games.length){
    h += '<div class="card"><h3>🎮 Игры, у которых виден код</h3>' +
      '<p class="dim">В каждую можно играть, и у каждой рядом лежит её программа — ' +
      'её можно менять прямо во время игры.</p><div class="admrow">';
    games.forEach(function(g){
      h += '<button class="rbtn sec" data-game="' + esc(g.id) + '">' + g.emoji + ' ' + esc(g.title) + '</button>';
    });
    h += '</div></div>';
  }

  /* ---------- вторая половина: что собрал ТЫ ---------- */
  h += '<div class="card"><h3>🎒 А это собрано на этом устройстве</h3>' +
    (doneN || pics || made || mine
      ? '<ul class="trsum">' +
        '<li>Программ курса собрано: <b>' + doneN + '</b> из ' + list.length + '.</li>' +
        (pics ? '<li>Рисунков в галерее: <b>' + pics + '</b>.</li>' : '') +
        (made ? '<li>Вещей собрано в мастерской: <b>' + made + '</b>.</li>' : '') +
        (mine ? '<li>Своих заданий придумано: <b>' + mine + '</b>' +
                (got ? ', и их решали <b>' + got + '</b> ' + plural(got, "раз", "раза", "раз") : '') + '.</li>' : '') +
        '</ul>' +
        '<div class="admrow"><button class="rbtn check" id="showfolio">🎒 Открыть портфолио</button></div>'
      : '<p class="dim">Пока пусто. Первая программа появится, когда будет собран проект первого мира — ' +
        'и встанет сюда же, рядом с остальными.</p>') + '</div>';

  /* ---------- почему тут нет чужих детей ---------- */
  h += '<div class="card"><h3>⚖️ Почему здесь нет чужих работ с именами</h3>' +
    '<p>У школ под работой в такой карусели стоит имя и возраст ребёнка. Это персональные ' +
    'данные, и берут их с согласия родителя. Мы имя ребёнка не спрашиваем вовсе и на сервер ' +
    'не отправляем — значит и показывать нам нечего, и это не недостаток витрины, а её условие.</p>' +
    '<p class="dim">Публичной ленты работ у нас тоже не будет: её пришлось бы кому-то проверять руками. ' +
    'Вместо неё — <b>адресная ссылка</b>: любую свою работу или задачу ребёнок отправляет ' +
    'конкретному человеку, и она не попадает никуда больше.</p></div>';

  h += '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  app.innerHTML = h;

  app.querySelectorAll("[data-show]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-show");
      var box = app.querySelector('[data-out="' + id + '"]');
      var x = list.filter(function(y){ return y.p.id === id; })[0];
      if (!box || !x || x.out === null) return;
      var lines = x.out.split("\n");
      box.hidden = false;
      box.textContent = lines.slice(0, SHOW_LINES).join("\n") +
        (lines.length > SHOW_LINES ? "\n… и ещё " + (lines.length - SHOW_LINES) + " " +
          plural(lines.length - SHOW_LINES, "строка", "строки", "строк") : "");
      b.disabled = true;
    };
  });
  app.querySelectorAll("[data-showopen]").forEach(function(b){
    b.onclick = function(){ screenProjectDone(b.getAttribute("data-showopen")); };
  });
  app.querySelectorAll("[data-game]").forEach(function(b){
    b.onclick = function(){ openGame(b.getAttribute("data-game")); };
  });
  var sf = document.getElementById("showfolio");
  if (sf) sf.onclick = screenFolio;
  document.getElementById("tomap").onclick = screenWorlds;

  /* Рисунки: контент первого мира приходит по требованию. Если экран за это
     время сменился, ничего не рисуем — иначе canvas'ы уедут в чужую разметку. */
  worldContent(1).then(function(){
    if (screenStale(seq)) return;
    var strip = document.getElementById("drawstrip");
    if (!strip) return;
    var eng = Runtime.get("mini"), ready = [];
    strip.innerHTML = "";
    (CURRICULUM.world(1).lessons || []).forEach(function(l){
      if (ready.length >= 4) return;
      var body = lessonBody(l);
      if (!body || !body.draw || !body.task) return;
      var t = eng.newTurtle ? eng.newTurtle() : null;
      if (!t) return;
      var r = eng.run(body.task.solution, { turtle: t });
      if (r.error || !t.segs || !t.segs.length) return;
      var cell = document.createElement("div");
      cell.className = "drawcell";
      cell.innerHTML = '<canvas></canvas><span class="dim">урок ' + l.num + ' · ' + esc(l.title) + '</span>';
      strip.appendChild(cell);
      ready.push({ canvas: cell.querySelector("canvas"), turtle: t });
    });
    if (!ready.length){
      strip.innerHTML = '<p class="dim">Рисующие уроки появятся вместе с первым миром.</p>';
      return;
    }
    /* ⚠️ Рисуем ТОЛЬКО когда вся полоска уже в документе. drawTurtle меряет
       ширину холста по факту, а сетка добирает колонки по мере добавления
       ячеек: рисунок, нарисованный сразу после вставки, мерил ширину пустой
       строки и выходил вчетверо крупнее соседа. Так и было — 2000 точек у
       первого против 480 у последнего. */
    ready.forEach(function(x){ drawTurtle(x.canvas, x.turtle); });
  });

  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= мастерская: полка деталей и верстак =================
   Ставка Г из docs/foresight-2027.md § 3, дешёвый вход по § 12 п. 5:
   НЕ переписывать сто уроков в сквозную линию, а надстроить сверху.

   Дефект, в который она бьёт, общий для всех тренажёров мира, включая наш:
   **сделанное на уроке никуда не идёт.** Решил задачу — она исчезла. Сто
   уроков ощущаются как сто выброшенных вечеров, и это одна из причин, по
   которым бросают. Накопление — единственный известный заменитель
   дисциплины, работающий без взрослого: ребёнок не бросает не потому, что
   ему напомнили, а потому что бросить значит потерять построенное.

   Что считается деталью: функция, которую ребёнок написал САМ в сданном
   уроке. Функция выбрана не случайно — это и есть готовая деталь по смыслу
   языка: у неё есть имя, вход и выход, и её можно позвать откуда угодно.

   ⚠️ Четыре правила честности:
     1. показанное решение деталью не становится. Это код автора, и назвать
        его «твоей деталью» значит соврать ребёнку в самом важном для него
        месте;
     2. функция из заготовки — тоже не деталь: её выдали, а не написали;
     3. деталь обязана хотя бы определяться без ошибки — сломанную вещь на
        полку не кладут;
     4. полка не растёт без предела: она уезжает на сервер вместе с
        прогрессом, как и черновики.

   Верстак нарочно устроен как ОДИН файл, а не как модуль «полка.py»: модуль
   пришлось бы держать неизменяемым (иначе правки в нём некуда сохранять),
   а неизменяемый файл в редакторе — это ловушка вида «пишу, а не пишется».
   Деталь кладётся кнопкой прямо в код, и дальше это обычная программа.
   ============================================================ */
var PART_MAX = 40;          /* столько деталей держим на полке */
var PART_CODE_MAX = 900;    /* длиннее — это уже не деталь, а программа */
var BUILD_MAX = 12;         /* столько собранных вещей храним */

function partsAll(){ S.parts = S.parts || {}; return S.parts; }
function partsList(){
  var d = partsAll();
  return Object.keys(d).map(function(k){
    var x = d[k];
    if (!x || typeof x.code !== "string" || !x.code.trim()) return null;
    return { id:k, name:x.name || "деталь", code:x.code, from:x.from || "", at:x.at || 0 };
  }).filter(Boolean).sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
}
function partKey(code){
  var h = 5381, src = String(code);
  for (var i = 0; i < src.length; i++) h = ((h * 33) ^ src.charCodeAt(i)) >>> 0;
  return "d" + h.toString(36);
}
function partDrop(id){ delete partsAll()[id]; save(); }
function partAdd(name, code, from){
  var d = partsAll(), k = partKey(code);
  if (d[k]) return k;                       /* та же деталь второй раз не кладётся */
  d[k] = { name:name, code:code, from:from || "", at: Date.now() };
  var keys = Object.keys(d);
  if (keys.length > PART_MAX){
    keys.sort(function(a, b){ return (d[a].at || 0) - (d[b].at || 0); });
    keys.slice(0, keys.length - PART_MAX).forEach(function(x){ delete d[x]; });
  }
  save();
  return k;
}

/* Функции верхнего уровня из программы. Границы блока считаем по отступу:
   тело функции — это всё, что идёт после «def» с отступом больше нуля, плюс
   пустые строки внутри. Разбираем СКЕЛЕТ (строки и комментарии в нём
   вычищены), а режем исходный код по тем же номерам строк — поэтому «def»
   внутри текстовой строки деталью не станет. */
function partsFrom(code){
  var src = String(code || "");
  var lines = src.split("\n"), skel = codeSkeleton(src).split("\n"), out = [];
  var re = /^def\s+([A-Za-z_А-Яа-яЁё][A-Za-z_0-9А-Яа-яЁё]*)\s*\(/;
  for (var i = 0; i < skel.length; i++){
    var m = re.exec(skel[i] || "");
    if (!m) continue;
    var j = i + 1;
    while (j < skel.length && (!skel[j].trim() || /^[ \t]/.test(skel[j]))) j++;
    /* пустые строки на хвосте в деталь не берём */
    var end = j;
    while (end > i + 1 && !lines[end - 1].trim()) end--;
    var body = lines.slice(i, end).join("\n");
    if (body.length <= PART_CODE_MAX && end > i + 1) out.push({ name: m[1], code: body });
    i = j - 1;
  }
  return out;
}
/* Деталь обязана хотя бы определяться без ошибки: сломанную вещь на полку
   не кладут. Позвать её мы не можем — аргументов не знаем, — и это честно
   сказано ребёнку на экране мастерской. */
function partWorks(code){
  try {
    var r = Runtime.get("mini").run(String(code || ""), {});
    return !r.error;
  } catch(e){ return false; }
}
/* Собрать детали из только что сданного урока. Зовётся из победы урока. */
function partsHarvest(l, body){
  if (session.shown) return 0;                     /* это код автора, а не его */
  var mine = session.code || "";
  if (!mine.trim()) return 0;
  var starter = (session.starter || []).map(function(f){ return f.code || ""; }).join("\n");
  var given = {};
  partsFrom(starter).forEach(function(p){ given[p.code.replace(/\s+/g, " ")] = 1; });
  var n = 0;
  partsFrom(mine).forEach(function(p){
    if (given[p.code.replace(/\s+/g, " ")]) return;  /* выдано в заготовке */
    if (!partWorks(p.code)) return;
    partAdd(p.name, p.code, l ? ("урок " + l.num + " · " + l.title) : "");
    n++;
  });
  return n;
}

/* ---------- собранные вещи ---------- */
function buildsAll(){ S.builds = S.builds || {}; return S.builds; }
function buildsList(){
  var d = buildsAll();
  return Object.keys(d).map(function(k){
    var x = d[k];
    if (!x || typeof x.code !== "string" || !x.code.trim()) return null;
    return { id:k, code:x.code, title:x.title || "Вещь", at:x.at || 0 };
  }).filter(Boolean).sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
}
function buildSave(code){
  var d = buildsAll(), id = "b" + Date.now().toString(36);
  d[id] = { code:String(code), title: galleryTitleOf(code, buildsList().length + 1).replace(/^Рисунок /, "Вещь "),
            at: Date.now() };
  var keys = Object.keys(d);
  if (keys.length > BUILD_MAX){
    keys.sort(function(a, b){ return (d[a].at || 0) - (d[b].at || 0); });
    keys.slice(0, keys.length - BUILD_MAX).forEach(function(k){ delete d[k]; });
  }
  save();
  return id;
}
function buildDrop(id){ delete buildsAll()[id]; save(); }

var SHOP_START = "# Здесь собирается вещь из твоих деталей.\n" +
  "# Возьми деталь с полки кнопкой «↓ На верстак» и позови её отсюда.\n";

function screenShop(){
  enterScreen("mine", "shop");
  session = { id:null, attempts:0, hints:0, shown:false, shop:true };
  var parts = partsList(), builds = buildsList();

  var h = '<div class="lvlhead"><div><div class="idx">мастерская</div>' +
    '<h1>🔧 Полка и верстак</h1></div><div class="right">' +
    '<span class="tag">деталей: ' + parts.length + '</span></div></div>' +
    '<p class="lede">Обычно решил задачу — и она пропала. Здесь не так: каждая функция, ' +
    'которую ты написал сам, остаётся на полке, как деталь в коробке. ' +
    'Бери их с полки и собирай из них свою программу.</p>';

  if (!parts.length){
    h += '<div class="card"><h3>Полка пока пустая</h3>' +
      '<p class="dim">Деталью становится <b>функция, которую ты написал сам</b>: у неё есть имя, ' +
      'вход и выход, и позвать её можно откуда угодно. Функции начинаются в уроке про <code>def</code> — ' +
      'дойдёшь до него, и полка начнёт наполняться сама.</p>' +
      '<p class="dim">Показанное решение деталью не становится: это код автора, а не твой.</p></div>';
  } else {
    h += '<div class="card"><h3>📦 Полка</h3>' +
      '<p class="dim">Нажми «↓ На верстак» — деталь встанет в начало программы внизу, и её можно будет позвать.</p>' +
      '<div class="shelf">';
    parts.forEach(function(p){
      h += '<div class="partcard"><div class="parthead"><b><code>' + esc(p.name) + '()</code></b>' +
        '<span class="dim">' + esc(p.from) + '</span></div>' +
        '<pre><code>' + hl(p.code) + '</code></pre>' +
        '<div class="partbar"><button class="rbtn check" data-take="' + p.id + '">↓ На верстак</button>' +
        '<button class="rbtn sec" data-pdel="' + p.id + '" title="убрать с полки">✕</button></div></div>';
    });
    h += '</div><p class="dim">⚠️ Деталь могла опираться на то, что стояло рядом в уроке. ' +
      'Если при запуске ругается — допиши недостающее прямо в программе: движок скажет словами, чего не хватает.</p></div>';
  }

  h += '<div class="card"><h3>🛠 Верстак</h3>' +
    '<p class="dim">Проверок тут нет — это твоя вещь, а не задание. Код сохраняется между заходами.</p></div>' +
    '<div id="studio"></div>' +
    '<div class="savepic"><button class="rbtn" id="tobuild">💾 Сохранить вещь</button>' +
    '<span class="tip">Первая строка-комментарий станет названием. Сохранённое можно показать и отправить ссылкой.</span>' +
    '<div class="msg" id="buildmsg"></div></div>';

  if (builds.length){
    h += '<div class="card"><h3>🎁 Что уже собрано</h3><div class="shelf">';
    builds.forEach(function(b){
      h += '<div class="partcard"><div class="parthead"><b>' + esc(b.title) + '</b>' +
        '<span class="dim">' + fmtWhen(b.at) + '</span></div>' +
        '<pre><code>' + hl(b.code) + '</code></pre>' +
        '<div class="partbar"><button class="rbtn check" data-open="' + b.id + '">↓ Открыть на верстаке</button>' +
        '<button class="rbtn sec" data-bshare="' + b.id + '">🔗 Ссылка</button>' +
        '<button class="rbtn sec" data-bdel="' + b.id + '" title="удалить">✕</button></div>' +
        '<div class="msg" data-bmsg="' + b.id + '"></div></div>';
    });
    h += '</div></div>';
  }

  h += '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  app.innerHTML = h;

  var studio = makeStudio({
    engine:"mini", draw:true, lint:true,
    code: S.shop || SHOP_START,
    onRun: function(){ S.shop = studio.editor.getCode(); save(); },
    viz: function(o){
      screenViz({ code: o.code, env: o.env,
        backTo: { label: "← Вернуться в мастерскую", go: screenShop } });
    }
  });
  document.getElementById("studio").appendChild(studio);
  session.studio = studio;
  studio.editor.onEdit = draftSchedule;

  function put(code){
    var was = studio.editor.getCode();
    studio.editor.setCode(code + "\n\n\n" + was);
    S.shop = studio.editor.getCode(); save();
    studio.editor.focusEditor();
    if (studio.scrollIntoView) studio.scrollIntoView({ behavior:"smooth", block:"center" });
  }
  app.querySelectorAll("[data-take]").forEach(function(b){
    b.onclick = function(){
      var p = partsAll()[b.getAttribute("data-take")];
      if (p) put(p.code);
    };
  });
  app.querySelectorAll("[data-pdel]").forEach(function(b){
    b.onclick = function(){ partDrop(b.getAttribute("data-pdel")); screenShop(); };
  });
  app.querySelectorAll("[data-open]").forEach(function(b){
    b.onclick = function(){
      var x = buildsAll()[b.getAttribute("data-open")];
      if (!x) return;
      studio.editor.setCode(x.code);
      S.shop = x.code; save();
      if (studio.scrollIntoView) studio.scrollIntoView({ behavior:"smooth", block:"center" });
    };
  });
  app.querySelectorAll("[data-bdel]").forEach(function(b){
    b.onclick = function(){ buildDrop(b.getAttribute("data-bdel")); screenShop(); };
  });
  app.querySelectorAll("[data-bshare]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-bshare"), x = buildsAll()[id];
      var box = app.querySelector('[data-bmsg="' + id + '"]');
      if (!x || !box) return;
      var link = workLink({ title: x.title, code: x.code, author: myName() });
      box.className = "msg show ok";
      box.innerHTML = '<b>Ссылка готова</b>Отправь её кому хочешь: программа лежит прямо в адресе, ' +
        'сервер для этого не нужен.' +
        '<div class="admrow"><button class="rbtn check" data-bcopy="1">Скопировать ссылку</button></div>' +
        '<p class="dim brk">' + esc(link) + '</p>';
      var cb = box.querySelector("[data-bcopy]");
      if (cb) cb.onclick = function(){ copyText(link, cb); };
    };
  });
  document.getElementById("tobuild").onclick = function(){
    var code = studio.editor.getCode(), box = document.getElementById("buildmsg");
    if (!code.trim() || code.replace(/^#[^\n]*\n?/gm, "").trim() === ""){
      box.className = "msg show warn";
      box.innerHTML = "<b>Пока нечего сохранять</b>В программе только комментарии. Возьми деталь с полки и позови её.";
      return;
    }
    buildSave(code);
    screenShop();
  };
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= запись авторства =================
   Ставка А из docs/foresight-2027.md § 3, граница честности — в
   docs/zanyatie-i-vzroslyj.md § 5. Отдельный экран в кабинете, который
   сводит сигналы, уже лежащие в прогрессе, и отвечает взрослому на вопрос,
   которого нет ни у одного тренажёра рынка: «он это правда сам?»

   ⚠️ ТРИ ПРАВИЛА, БЕЗ КОТОРЫХ ЭТО ПРЕВРАЩАЕТСЯ В НАДЗОР И УТАЩИТ БРЕНД.

   1. Слова «списал» здесь нет и не будет. Мы утверждаем ровно то, что видим:
      «часть работы пришла готовой», «в решении команда, которую ещё не
      проходили». Приговор выносит взрослый, и то не приговор, а разговор.
   2. Мы видим только свою страницу. Ни других вкладок, ни камеры, ни того,
      чем ребёнок занят вне тренажёра. Это позиция, а не техническое
      ограничение, и она написана взрослому на экране прямым текстом.
   3. Сильный сигнал — не доказательство. Вставить можно и своё; открытое
      решение — законный ход, за который уже снята звезда. Поэтому запись
      заканчивается не выводом, а ВОПРОСОМ, который взрослый может задать.

   Ребёнку эта запись не показывается и на звёзды, опыт и прогресс не влияет
   никак: продукт построен на «не ругать», и запись обязана работать так же.

   Что и откуда:
     набрано/вставлено   счётчики редактора (box.trace), см. makeEditor
     вперёд программы    aheadIn: конструкции шпаргалки, чей урок ещё не пройден
     подсказки, решение  S.log — считались с самого начала
     понял или прошёл    predOk/predAll занятий (проверка предсказанием) */

/* Код без строк и комментариев. Нужен всем сигналам сразу: искать конструкцию
   внутри текстовой строки — значит ловить слово «for» в строке «форма».

   ⚠️ Длина сохраняется знак в знак: содержимое строк и комментариев заменяется
   пробелами, а сами кавычки остаются на месте. Это не украшение — это условие
   того, чтобы по найденному месту можно было вернуться в ИСХОДНЫЙ код по тому
   же индексу. На этом держится «предскажи свою программу»: число, которое мы
   меняем, ищется в скелете, а правится в настоящем коде. */
function codeSkeleton(src){
  var s = String(src || ""), out = "", i = 0, n = s.length;
  /* Переносы строк сохраняются как есть: на выравнивании по СТРОКАМ держится
     сбор деталей мастерской (partsFrom), а на выравнивании по знакам —
     «предскажи свою программу». Нужно и то, и другое сразу. */
  function blank(from, to){
    var r = "";
    for (var q = from; q < to; q++) r += (s[q] === "\n" ? "\n" : " ");
    return r;
  }
  while (i < n){
    var c = s[i];
    if (c === "#"){
      var e = i;
      while (e < n && s[e] !== "\n") e++;
      out += blank(i, e); i = e; continue;
    }
    if (c === '"' || c === "'"){
      var q = c, triple = s.substr(i, 3) === q + q + q, end;
      if (triple){
        end = i + 3;
        while (end < n && s.substr(end, 3) !== q + q + q) end++;
        end = Math.min(n, end + 3);
        out += q + q + q + blank(i + 3, Math.max(i + 3, end - 3)) + (end - i >= 6 ? q + q + q : "");
      } else {
        end = i + 1;
        while (end < n && s[end] !== q && s[end] !== "\n"){ if (s[end] === "\\") end++; end++; }
        if (end < n && s[end] === q) end++;
        var closed = end - i >= 2 && s[end - 1] === q;
        out += q + blank(i + 1, closed ? end - 1 : end) + (closed ? q : "");
      }
      i = end; continue;
    }
    out += c; i++;
  }
  return out;
}

/* Границы имени пишем руками: \b и \w в JavaScript знают только латиницу, а
   у нас в коде живут русские имена переменных (урок 81). Из-за этого
   «class Кот(Зверь)» не ловился шаблоном \w+ — проверено, а не предположено. */
var W_ID = "A-Za-z_0-9А-Яа-яЁё";
function pCall(n){ return new RegExp("(^|[^" + W_ID + ".])(?:" + n + ")\\s*\\("); }
function pDot(n){ return new RegExp("\\.(?:" + n + ")\\s*\\("); }
function pWord(n){ return new RegExp("(^|[^" + W_ID + "])(?:" + n + ")(?![" + W_ID + "])"); }
function pHead(n){ return new RegExp("(^|\\n)[ \\t]*(?:" + n + ")(?![" + W_ID + "])"); }

/* Конструкция → запись шпаргалки, где она объясняется. Урок берётся ОТТУДА,
   а не пишется здесь второй раз: у шпаргалки уже есть поле lesson, и она
   единственный источник правды про «где это проходят». Тест сверяет, что
   каждый ключ существует и что шаблон ловит пример своей же записи. */
var AHEAD_PROBES = {
  "print": pCall("print"), "fstring": new RegExp("(^|[^" + W_ID + "])f[\"']"),
  "len": pCall("len"), "upper": pDot("upper|lower"), "title": pDot("title|capitalize"),
  "find": pDot("find"), "strip": pDot("strip|rstrip|lstrip"), "split": pDot("split|splitlines"),
  "join": pDot("join"), "replace": pDot("replace"), "startswith": pDot("startswith|endswith"),
  "div": /\/\//, "pow": /\*\*/, "int-str": pCall("int|float"), "round": pCall("round"),
  "abs": pCall("abs"), "minmax": pCall("min|max|sum"),
  "mathmod": new RegExp("(^|[^" + W_ID + ".])math\\."),
  "append": pDot("append"), "insert": pDot("insert"), "pop-remove": pDot("pop|remove"),
  "sorted": pCall("sorted"),
  "sort-key": new RegExp("(^|[^" + W_ID + ".])sorted\\s*\\([^\\n]*key\\s*="),
  "sort-inplace": pDot("sort"), "slice-back": /\[\s*::\s*-1\s*\]/,
  "index-count": pDot("index|count"),
  "comp": /\[[^\[\]\n]*[^A-Za-z_0-9А-Яа-яЁё]for[^A-Za-z_0-9А-Яа-яЁё][^\[\]\n]*\]/,
  "comp-if": /\[[^\[\]\n]*[^A-Za-z_0-9А-Яа-яЁё]for[^A-Za-z_0-9А-Яа-яЁё][^\[\]\n]*[^A-Za-z_0-9А-Яа-яЁё]if[^A-Za-z_0-9А-Яа-яЁё][^\[\]\n]*\]/,
  "comp-dict": /\{[^{}\n]*[^A-Za-z_0-9А-Яа-яЁё]for[^A-Za-z_0-9А-Яа-яЁё][^{}\n]*\}/,
  "dict-get": pDot("get"), "dict-items": pDot("items|keys|values"), "dict-update": pDot("update"),
  "set": pCall("set"), "set-add": pDot("add|discard"), "counter": pCall("Counter"),
  "any-all": pCall("any|all"),
  "for-range": new RegExp("(^|[^" + W_ID + "])for(?![" + W_ID + "])[^\\n]*[^" + W_ID + ".]range\\s*\\("),
  "range-step": new RegExp("(^|[^" + W_ID + ".])range\\s*\\([^)\\n]*,[^)\\n]*\\)"),
  "enumerate": pCall("enumerate"), "zip": pCall("zip"),
  "while": pHead("while"), "break": pHead("break|continue"),
  "def": pHead("def"), "return": pHead("return"),
  "fn-default": /def\s[^\n(]*\([^)\n]*=[^)\n]*\)/, "fn-varargs": /def\s[^\n(]*\([^)\n]*\*/,
  "lambda": pWord("lambda"), "global": pHead("global"), "typing": /def\s[^\n]*\)\s*->/,
  "class": pHead("class"), "init": /def\s+__init__\s*\(/, "repr": /def\s+__repr__\s*\(/,
  "inherit": new RegExp("(^|\\n)[ \\t]*class\\s+[" + W_ID + "]+\\s*\\("),
  "super": pCall("super"), "try": /(^|\n)[ \t]*try\s*:/,
  "except-as": new RegExp("(^|[^" + W_ID + "])except(?![" + W_ID + "])[^\\n:]*[^" + W_ID + "]as(?![" + W_ID + "])"),
  "finally": /(^|\n)[ \t]*finally\s*:/, "raise": pHead("raise"), "assert": pHead("assert"),
  "none": pWord("None"), "isinstance": pCall("isinstance"), "type": pCall("type"),
  "with-own": /def\s+__enter__\s*\(/, "import": pHead("import"),
  "from-import": /(^|\n)[ \t]*from\s+\S+\s+import\s/,
  "random": new RegExp("(^|[^" + W_ID + ".])random\\.(?:randint|random|shuffle|sample)\\s*\\("),
  "choice": new RegExp("(^|[^" + W_ID + ".])random\\.choice\\s*\\("),
  "json": new RegExp("(^|[^" + W_ID + ".])json\\.dumps\\s*\\("),
  "json-loads": new RegExp("(^|[^" + W_ID + ".])json\\.loads\\s*\\("),
  "regex": new RegExp("(^|[^" + W_ID + ".])re\\.(?:findall|search|match)\\s*\\("),
  "re-sub": new RegExp("(^|[^" + W_ID + ".])re\\.sub\\s*\\("),
  "generator": pWord("yield"),
  "decorator": new RegExp("(^|\\n)[ \\t]*@[" + W_ID + "]"),
  "strftime": pDot("strftime"), "date": pCall("date"), "defaultdict": pCall("defaultdict"),
  "combinations": pDot("combinations"), "product": pDot("product"),
  "open-read": new RegExp("(^|[^" + W_ID + ".])with\\s+open\\s*\\("),
  "csv": new RegExp("(^|[^" + W_ID + ".])csv\\.[" + W_ID + "]+\\s*\\("),
  "pathlib": pCall("Path"), "grid": /\]\s*\[/
};
function sheetById(id){
  var out = null;
  (window.CHEATSHEET || []).forEach(function(g){
    (g.items || []).forEach(function(it){ if (it.id === id) out = it; });
  });
  return out;
}

/* Конструкции, которые есть в коде ребёнка, ещё не пройдены и НЕ нужны
   самому заданию. Последнее условие обязательно: без него сигнал срабатывал
   бы на самом курсе — урок 58 законно пишет @dataclass, а декораторы вообще
   объясняют в 72-м. Проверено прогоном по всем ста урокам: с этим условием
   ложных срабатываний ноль, без него три. */
function aheadIn(code, allowed){
  var mine = codeSkeleton(code), ok = codeSkeleton(allowed || ""), out = [];
  Object.keys(AHEAD_PROBES).forEach(function(id){
    var re = AHEAD_PROBES[id], it = sheetById(id);
    if (!it || !re.test(mine) || re.test(ok)) return;
    if (solved(it.lesson)) return;
    out.push(id);
  });
  return out;
}

/* Порог вставки. Две строки кода — это примерно столько знаков; всё, что
   меньше, — имя переменной или число, и шуметь из-за этого нельзя. */
var AUTHOR_PASTE_MIN = 40;
/* Столько правок и меньше при таком приросте — «появилось целиком». */
var AUTHOR_FEW_EDITS = 2;
var AUTHOR_BIG_ADD = 60;

/* Запись по одному уроку. Возвращает null, если записи нет: уроки, пройденные
   до этой версии, честно молчат, а не выдумывают прошлое. */
function authorMarks(id){
  var g = (S.log || {})[id] || {}, t = g.tr;
  if (!t) return null;
  var mine = Math.max(0, (t.len || 0) - (t.slen || 0));
  var m = [];
  if ((t.pasted || 0) >= AUTHOR_PASTE_MIN)
    m.push({ k:"ready", em:"📋", txt:"часть работы пришла готовой: " + t.pasted +
             " " + plural(t.pasted, "знак", "знака", "знаков") + " вставлено, и в уроке такого текста нет" });
  else if ((t.edits || 0) <= AUTHOR_FEW_EDITS && mine >= AUTHOR_BIG_ADD && !t.shown)
    m.push({ k:"ready", em:"📋", txt:"программа появилась целиком, без истории правок" });
  if ((t.ahead || []).length){
    var names = t.ahead.map(function(x){ var it = sheetById(x); return it ? it.sig : x; });
    m.push({ k:"ahead", em:"⏭", txt:"в решении есть то, что в курсе ещё не проходили: " +
             names.slice(0, 3).join(", ") });
  }
  if (t.shown) m.push({ k:"shown", em:"👁", txt:"решение было показано — за это уже снята звезда" });
  if (t.hints) m.push({ k:"hints", em:"💡", txt:"подсказок взято: " + t.hints });
  if (!m.length) m.push({ k:"hand", em:"✍️", txt:"написано руками, от начала до конца" });
  return { at: t.at || g.solvedAt || 0, typed: t.typed || 0, pasted: t.pasted || 0,
           own: t.own || 0, edits: t.edits || 0, marks: m,
           clean: m.length === 1 && m[0].k === "hand" };
}

/* Все уроки с записью, свежие сверху. */
function authorList(){
  var out = [];
  Object.keys(S.log || {}).forEach(function(id){
    var l = CURRICULUM.byId(id);
    if (!l) return;
    var a = authorMarks(id);
    if (a) out.push({ id:id, num:l.num, title:l.title, rec:a });
  });
  out.sort(function(a, b){ return (b.rec.at || 0) - (a.rec.at || 0); });
  return out;
}

/* Проверка понимания за все закрытые занятия. Это та самая последняя строка
   таблицы из § 5: предсказать вывод программы, не запуская её, нельзя, не
   поняв её. Подделать нечем — и потому это же метрика «понял» для родителя
   и приложение к аттестации на семейном обучении. */
function authorPredict(){
  var ok = 0, all = 0, mine = 0, d = zanAll();
  Object.keys(d).forEach(function(k){
    var r = d[k];
    if (!r || !r.end || !r.predAll) return;
    ok += r.predOk || 0; all += r.predAll;
    mine += r.predMine || 0;
  });
  return { ok: ok, all: all, mine: mine };
}

function authorSummary(){
  var list = authorList(), hand = 0, ready = 0, ahead = 0;
  list.forEach(function(x){
    if (x.rec.clean) hand++;
    x.rec.marks.forEach(function(m){
      if (m.k === "ready") ready++;
      if (m.k === "ahead") ahead++;
    });
  });
  return { n: list.length, hand: hand, ready: ready, ahead: ahead, pred: authorPredict() };
}

/* ================= проверка понимания на СВОЁМ коде =================
   Сильнейший сигнал из таблицы docs/zanyatie-i-vzroslyj.md § 5, и до 1.44.1
   единственный не снятый: «не может предсказать вывод СВОЕГО кода».

   Почему это сильнее всего остального. Вставку можно объяснить («это я своё
   скопировал»), незнакомую команду — тоже («в интернете подсмотрел, но понял»).
   А непонимание собственной программы не объясняется ничем и не подделывается
   ничем: либо ты знаешь, что она делает, либо не знаешь.

   Как устроен вопрос. Берём программу, которую ребёнок только что сдал сам,
   и меняем в ней ОДНО число. Дальше как в разминке «угадай вывод»: он пишет,
   что она напечатает, а движок сверяет. Смысл замены в том, что запомнить
   ответ нельзя — прошлый вывод к новому числу не подходит; чтобы ответить,
   программу надо прочитать.

   ⚠️ Пять условий, без которых вопрос был бы нечестным:
     1. программа должна печатать — иначе сверять нечего;
     2. никакой случайности, ввода с клавиатуры, файлов и черепашки: у ребёнка
        вышло бы другое, и он был бы прав, а мы — нет;
     3. изменённая программа обязана работать и печатать НЕ ТО ЖЕ САМОЕ:
        иначе правильный ответ — это ровно тот вывод, который он уже видел,
        и проверка не проверяет ничего;
     4. вывод короткий (до шести строк): мы спрашиваем понимание, а не
        усидчивость переписывания;
     5. не нашлось подходящей программы — молча берём обычную разминку.
        Придумывать вопрос из ничего нельзя. */
var MYPRED_MAX_LINES = 6;
var MYPRED_MAX_OUT = 240;
var MYPRED_MAX_CODE = 800;
var MYPRED_KEEP = 6;        /* столько программ занятия держим для вопроса */

/* Программа не годится, если её вывод зависит не только от кода. */
function myPredSafe(code){
  var k = codeSkeleton(code);
  if (!k || k.length > MYPRED_MAX_CODE) return false;
  if (/(^|[^A-Za-z_0-9.А-Яа-яЁё])(input|open)\s*\(/.test(k)) return false;
  if (/(^|[^A-Za-z_0-9.А-Яа-яЁё])random\b/.test(k)) return false;
  if (/(^|[^A-Za-z_0-9.А-Яа-яЁё])(randint|choice|shuffle|sample)\s*\(/.test(k)) return false;
  if (/(^|\n)[ \t]*(import|from)\s/.test(k)) return false;
  /* черепашка: рисунок — не вывод, спрашивать про него текстом нельзя */
  if (/(^|[^A-Za-z_0-9.А-Яа-яЁё])(forward|backward|circle|penup|pendown|goto|setheading)\s*\(/.test(k)) return false;
  return true;
}
function myPredRun(code){
  try {
    var r = Runtime.get("mini").run(code, {});
    if (r.error) return null;
    var out = String(r.output || "").replace(/\n+$/, "");
    if (!out.trim()) return null;
    if (out.length > MYPRED_MAX_OUT) return null;
    if (out.split("\n").length > MYPRED_MAX_LINES) return null;
    return out;
  } catch(e){ return null; }
}
/* Меняем ровно одно целое число. Ищем его в СКЕЛЕТЕ (иначе поменяли бы цифру
   внутри текстовой строки, и вопрос стал бы про кавычки, а не про программу),
   а правим в настоящем коде — скелет для того и сохраняет длину знак в знак. */
function myPredictMake(code){
  if (!myPredSafe(code)) return null;
  var was = myPredRun(code);
  if (!was) return null;
  var k = codeSkeleton(code);
  var re = /(^|[^A-Za-z_0-9.А-Яа-яЁё])(\d+)(?![.\dA-Za-z_])/g, m, spots = [];
  while ((m = re.exec(k)) !== null && spots.length < 12)
    spots.push({ at: m.index + m[1].length, txt: m[2] });
  for (var i = 0; i < spots.length; i++){
    var v = parseInt(spots[i].txt, 10);
    if (!isFinite(v)) continue;
    var tries = [v + 1, v + 2, v * 2, v - 1, v + 3];
    for (var j = 0; j < tries.length; j++){
      var nv = tries[j];
      if (nv === v || nv < 0 || nv > 9999) continue;
      var mut = code.slice(0, spots[i].at) + String(nv) + code.slice(spots[i].at + spots[i].txt.length);
      var out = myPredRun(mut);
      if (!out || normPred(out) === normPred(was)) continue;
      return { code: mut, out: out, was: was, from: v, to: nv };
    }
  }
  return null;
}

/* Программы этого занятия. Кладутся победой урока, живут до конца занятия и
   нужны ровно для одного — задать вопрос про СВОЙ код. Многофайловые уроки
   сюда не идут: вопрос про одну страницу кода, а не про сборку из модулей. */
function zanKeepProg(id, code){
  var open = zanOpen();
  if (!open) return;
  var rec = zanAll()[open.key];
  if (!rec || !code || code.length > MYPRED_MAX_CODE) return;
  rec.progs = (rec.progs || []).filter(function(x){ return x.id !== id; });
  rec.progs.push({ id: id, code: code });
  if (rec.progs.length > MYPRED_KEEP) rec.progs = rec.progs.slice(-MYPRED_KEEP);

  /* ⚠️ Проверка понимания появляется в плане, даже если разминки «угадай
     вывод» для неё не нашлось. Так бывает: все девять таких разминок
     открываются по прогрессу, а та, что открыта, может уже стоять задачей
     дня — и тогда занятие заканчивалось БЕЗ проверки понимания ровно у того
     ребёнка, про которого родитель и спрашивает «он вообще что-нибудь
     понял?». Своей программе ничего этого не нужно: она только что написана.

     Блок дописывается в план не заранее, а в тот момент, когда из программы
     и правда получается вопрос: блок, который нечем открыть, хуже, чем его
     отсутствие. */
  var hasCheck = (rec.plan || []).some(function(b){ return b.k === "predict"; });
  if (!hasCheck && myPredictMake(code))
    rec.plan.push({ k:"predict", id:"mine", title:"Проверка понимания" });
}
/* Свежая своя программа, из которой получается честный вопрос. Не нашлось —
   null, и занятие возьмёт обычную разминку. */
function myPredictPick(){
  var open = zanOpen();
  if (!open) return null;
  var rec = zanAll()[open.key];
  var progs = (rec && rec.progs) || [];
  for (var i = progs.length - 1; i >= 0; i--){
    var made = myPredictMake(progs[i].code);
    if (made) return { lesson: progs[i].id, made: made };
  }
  return null;
}

/* Экран вопроса. Студия та же, что у разминки «угадай вывод», — новый вид
   ввода тут ни к чему, а привычный ребёнку экран сам объясняет, что делать. */
function openMyPredict(pick, blockId){
  enterScreen(undefined, "warmup");
  session = { id:null, attempts:0, hints:0, shown:false, mypred:true };
  var l = CURRICULUM.byId(pick.lesson);
  var made = pick.made;

  var head = '<div class="crumbs"><button class="backbtn" data-go="zan">← К занятию</button>' +
    '<span data-go="zan">Занятие</span> › 🔮 Проверка понимания</div>' +
    '<div class="lvlhead"><div><div class="idx">проверка понимания</div>' +
    '<h1>🔮 Что напечатает твоя программа?</h1></div>' +
    '<div class="right"><span class="tag">твой код</span></div></div>' +
    '<p class="lede">Это программа, которую ты написал' +
    (l ? ' в уроке ' + l.num + ' «' + esc(l.title) + '»' : '') +
    '. В ней поменяли одно число: было <b>' + made.from + '</b>, стало <b>' + made.to + '</b>. ' +
    'Запускать нельзя — прочитай её и напиши, что она напечатает теперь.</p>' +
    '<div class="goal"><h3>🎯 Твоя задача</h3>' +
    '<p>Прошлый ответ не подойдёт: с новым числом программа печатает другое. ' +
    'По строке на каждый <code>print</code>.</p></div>';

  var pager = '<div class="pager"><button class="bigbtn ghost" data-go="zan">← К занятию</button></div>';
  app.innerHTML = head + '<div id="studio"></div>' + pager;

  var studio = makePredictStudio({
    code: made.code,
    check: function(ed, showMsg){
      session.attempts++;
      var got = ed.getCode();
      studio.reveal(made.out);
      if (normPred(made.out) === normPred(got)) winMyPredict(pick, blockId);
      else showMsg("bad", "<b>Ещё не совпало</b>" + predictDiff(made.out, got) +
        "Настоящий вывод теперь виден справа. Найди строку, где разошлось, и попробуй снова.");
    }
  });
  document.getElementById("studio").appendChild(studio);
  session.studio = studio;
  app.querySelectorAll("[data-go]").forEach(function(b){ b.onclick = screenZan; });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function winMyPredict(pick, blockId){
  var firstTry = session.attempts === 1;
  markActiveToday();
  /* ⚠️ Блок плана закрывается тем же путём, что и разминка: занятие знает
     свой блок «проверка понимания» по id из плана, и подменять учёт из-за
     того, что вопрос оказался про свой код, нельзя — иначе отчёт разошёлся бы
     с планом. А вот ПОМЕТКУ, что проверка была на своём коде, ставим: для
     взрослого это принципиально другой вес. */
  var open = zanOpen();
  if (open){
    var rec = zanAll()[open.key];
    if (rec) rec.predMine = (rec.predMine || 0) + 1;
  }
  if (blockId) zanNote("warm", blockId, { ok: firstTry });
  save();
  document.getElementById("wincard").innerHTML =
    '<div class="big">' + (firstTry ? "🔮" : "✅") + '</div>' +
    '<h2>' + (firstTry ? "Ты понял свою программу" : "Сошлось") + '</h2>' +
    '<p>' + (firstTry
      ? "Предсказал вывод собственного кода с первой попытки, не запуская его. Это и значит «понял», а не «прошёл»."
      : "Сошлось не с первого раза — и это нормально: главное, что ты нашёл, где разошлось.") + '</p>' +
    '<div class="winrow"><button class="bigbtn" id="wzan">← К занятию</button>' +
    '<button class="bigbtn ghost" id="wstay">Остаться здесь</button></div>';
  document.getElementById("win").classList.add("show");
  confetti(2);
  var wz = document.getElementById("wzan");
  if (wz) wz.onclick = function(){ closeWin(); screenZan(); };
  var ws = document.getElementById("wstay");
  if (ws) ws.onclick = closeWin;
}

function screenTrace(){
  curPlace = "trace";
  stopTimer(); vizStopPlay();
  if (!adminUnlocked()) return adminGate();
  var list = authorList(), sum = authorSummary();

  var h = '<div class="lvlhead"><div><div class="idx">для взрослого</div>' +
    '<h1>🖐 Как шла работа</h1></div><div class="right"><span class="tag">код принят</span></div></div>' +
    '<p class="lede">Запись того, как ребёнок писал код: набирал сам или часть пришла готовой, ' +
    'брал ли подсказки, смотрел ли решение. Она ведётся с того урока, где вы это включили, ' +
    'и ребёнку не показывается.</p>';

  /* ⚠️ Рамка честности стоит ПЕРВОЙ, а не сноской внизу. Взрослый обязан
     прочитать её до цифр, иначе первая же строка «часть работы пришла
     готовой» прочтётся как обвинение — и это ровно тот путь, на котором
     запись авторства превращается в надзор. */
  h += '<div class="card"><h3>⚖️ Что здесь можно и чего нельзя</h3>' +
    '<ul class="trrules">' +
    '<li><b>Мы не выносим приговоров.</b> Мы называем только то, что видели у себя на странице: ' +
    '«часть работы пришла готовой», «в решении есть то, что ещё не проходили». ' +
    'Вставить можно и своё, а показанное решение — законный ход, за который уже снята звезда.</li>' +
    '<li><b>Мы не следим за ребёнком.</b> Видно только нашу страницу: ни других вкладок, ' +
    'ни камеры, ни микрофона, ни того, чем он занят вне тренажёра.</li>' +
    '<li><b>Это повод спросить, а не наказать.</b> Самая сильная проверка — попросить объяснить ' +
    'свою же программу: непонимание собственного кода не подделывается ничем. ' +
    'Тренажёр делает это сам в конце занятия: берёт написанную ребёнком программу, ' +
    'меняет в ней одно число и спрашивает, что она напечатает теперь.</li>' +
    '</ul></div>';

  if (!list.length){
    h += '<div class="card"><h3>Пока записывать нечего</h3>' +
      '<p class="dim">Запись появляется вместе с пройденными уроками. Уроки, сданные раньше, ' +
      'здесь не показываются: выдумывать про них мы не будем.</p></div>';
  } else {
    var pr = sum.pred;
    h += '<div class="card"><h3>📊 Коротко</h3><ul class="trsum">' +
      '<li>Уроков с записью: <b>' + sum.n + '</b>.</li>' +
      '<li>Написано руками от начала до конца: <b>' + sum.hand + '</b> из ' + sum.n + '.</li>' +
      (sum.ready ? '<li>Уроков, где часть работы пришла готовой: <b>' + sum.ready + '</b>.</li>' : '') +
      (sum.ahead ? '<li>Уроков, где в решении есть непройденное: <b>' + sum.ahead + '</b>.</li>' : '') +
      '<li>Проверка понимания: ' + (pr.all
        ? 'предсказал вывод верно <b>' + pr.ok + '</b> из ' + pr.all + '.' +
          (pr.mine ? ' Из них про его СОБСТВЕННУЮ программу: <b>' + pr.mine + '</b>.' : '')
        : 'ещё не было — она идёт в конце занятия.') + '</li>' +
      '</ul>' +
      (sum.ready || sum.ahead
        ? '<p class="dim">⚠️ Это не приговор. Откройте такой урок вместе и попросите объяснить ' +
          'программу строчку за строчкой — этого хватает, чтобы понять всё, что нужно.</p>'
        : '<p class="dim">Пока всё написано руками. Это ровно то, ради чего запись и ведётся.</p>') +
      '</div>';

    h += '<div class="card"><h3>📝 По урокам</h3><div class="trlist">';
    list.slice(0, 40).forEach(function(x){
      h += '<div class="trrow' + (x.rec.clean ? " ok" : "") + '">' +
        '<div class="trhead"><b>Урок ' + x.num + '. ' + esc(x.title) + '</b>' +
        '<span class="dim">' + (x.rec.at ? fmtWhen(x.rec.at) : "") + '</span></div>' +
        '<ul class="trmarks">' +
        x.rec.marks.map(function(m){
          return '<li class="' + m.k + '">' + m.em + ' ' + esc(m.txt) + '</li>';
        }).join("") +
        '</ul>' +
        '<div class="trnum">набрано ' + x.rec.typed + ' ' +
        plural(x.rec.typed, "знак", "знака", "знаков") + ', правок ' + x.rec.edits +
        (x.rec.own ? ', скопировано из урока ' + x.rec.own : "") + '</div></div>';
    });
    h += '</div>' + (list.length > 40
      ? '<p class="dim">Показаны сорок последних уроков.</p>' : '') + '</div>';
  }

  h += '<div class="pager"><button class="bigbtn ghost" data-back="1">← В кабинет</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" data-home="1">На главную</button></div>';

  app.innerHTML = h;
  app.querySelectorAll("[data-back]").forEach(function(b){ b.onclick = screenAdult; });
  app.querySelectorAll("[data-home]").forEach(function(b){ b.onclick = screenWorlds; });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= кабинет взрослого =================
   Пока сайта и сервера нет, кабинет живёт на том же устройстве и открывается
   тем же кодом, что и панель наставника. Это честная заглушка, а не
   архитектура: когда появятся домен и почта, кабинет переедет на отдельный
   поддомен со своим входом — граница между детским контуром (без ПДн) и
   взрослым (с адресом) должна проходить по домену.
   Разбор: docs/zanyatie-i-vzroslyj.md §§ 12–14. */
function screenAdult(){
  curPlace = "adult";
  stopTimer(); vizStopPlay();
  if (!adminUnlocked()) return adminGate();
  var f = frame();
  var last = zanLast();
  var pace = paceCheck(f.goal, f.days, f.len);

  var h = '<div class="lvlhead"><div><div class="idx">для взрослого</div>' +
    '<h1>👨‍👩‍👦 Кабинет</h1></div><div class="right"><span class="tag">код принят</span></div></div>' +
    '<p class="lede">Здесь взрослый ставит рамку занятий, видит, как шла работа, и задаёт ребёнку задание. ' +
    'Десять минут в неделю — и вы знаете о занятиях больше, чем даёт любой отчёт репетитора.</p>';

  /* ---------- отчёт по последнему занятию ---------- */
  if (last){
    var r = zanReport(last, S);
    h += '<div class="card adrep"><h3>📨 Последнее занятие</h3>' +
      '<p class="dim">' + fmtWhen(last.end) + '</p>' +
      '<ol class="zanrep"><li><b>Что было.</b> ' + esc(r.was) + '.</li>' +
      '<li><b>Похвалите за это.</b> ' + esc(r.praise) + '.</li>' +
      (r.cut ? '<li><b>План.</b> ' + esc(r.cut) + '</li>' : '') +
      '<li><b>Понял или прошёл.</b> ' + esc(r.got) + '</li>' +
      '<li><b>Спросите.</b> ' + esc(r.ask) + '</li></ol></div>';
  } else {
    h += '<div class="card"><h3>📨 Последнее занятие</h3>' +
      '<p class="dim">Занятий ещё не было. Отчёт появится, как только ребёнок закончит первое.</p></div>';
  }

  h += heatHTML(S);
  h += paceStatHTML();

  /* ---------- рамка ---------- */
  var chips = WD_ORDER.map(function(n){
    return '<button class="wdchip' + (f.days.indexOf(n) >= 0 ? " sel" : "") + '" data-fwd="' + n + '">' +
      WD_SHORT[n] + '</button>';
  }).join("");
  var lens = ZAN_LEN.map(function(n){
    return '<button class="rbtn ' + (f.len === n ? "check" : "sec") + '" data-flen="' + n + '">' + n + ' минут</button>';
  }).join("");
  var mixes = [["new","Идём вперёд"],["balanced","Поровну"],["repeat","Закрепляем"]].map(function(m){
    return '<button class="rbtn ' + (f.mix === m[0] ? "check" : "sec") + '" data-fmix="' + m[0] + '">' + m[1] + '</button>';
  }).join("");

  h += '<div class="card"><h3>🗓 Рамка занятий</h3>' +
    '<p class="dim">Дни, время и длину назначаете вы. Порядок уроков — нет: курс устроен так, что команда ' +
    'объясняется раньше, чем понадобится, и перестановка уроков ломает именно это. ' +
    'Вы ставите рамку и темп, курс отвечает за порядок.</p>' +
    '<div class="admlbl">Дни занятий</div><div class="wdrow">' + chips + '</div>' +
    '<div class="admlbl">Длина занятия</div><div class="admrow">' + lens + '</div>' +
    '<div class="admlbl">Чего больше</div><div class="admrow">' + mixes + '</div>' +
    '<div class="admlbl">Успеть к дате (необязательно)</div>' +
    '<div class="admrow"><input type="date" id="fgoal" value="' + (f.goal || "") + '">' +
      '<button class="rbtn sec" data-act="fgoal">Сохранить дату</button>' +
      (f.goal ? '<button class="rbtn sec" data-act="fgoaloff">Убрать</button>' : '') + '</div>';

  if (f.goal){
    h += pace.ok
      ? '<p class="dim">До ' + f.goal.split("-").reverse().join(".") + ' остаётся <b>' + pace.sessions +
        '</b> ' + plural(pace.sessions, "занятие", "занятия", "занятий") + ' и <b>' + pace.left + '</b> ' +
        plural(pace.left, "урок", "урока", "уроков") + '. Это примерно <b>' + pace.mins +
        ' минут</b> на занятие.</p>'
      : '<p class="warnline">⚠️ При таком темпе занятие выйдет примерно <b>' + pace.mins +
        ' минут</b> — это много даже для подростка, а для десяти лет невыполнимо. ' +
        'Либо добавьте дней в неделю, либо отодвиньте дату: ' + pace.left + ' ' +
        plural(pace.left, "урок", "урока", "уроков") + ' на ' + pace.sessions + ' ' +
        plural(pace.sessions, "занятие", "занятия", "занятий") + ' не помещаются.</p>';
  }

  /* каникулы */
  h += '<div class="admlbl">Каникулы и запланированные паузы</div>' +
    (f.breaks.length
      ? '<ul class="brlist">' + f.breaks.map(function(b, i){
          return '<li>' + b[0].split("-").reverse().join(".") + ' — ' + b[1].split("-").reverse().join(".") +
            ' <button class="rbtn sec" data-brdel="' + i + '">убрать</button></li>';
        }).join("") + '</ul>'
      : '<p class="dim">Пока не заданы.</p>') +
    '<div class="admrow"><input type="date" id="brfrom"><input type="date" id="brto">' +
      '<button class="rbtn sec" data-act="bradd">Добавить</button></div>' +
    '<p class="dim">В эти дни пропуск запланирован, и отчёт не назовёт его прогулом.</p>';

  /* потолок дня */
  var caps = CAP_CHOICES.map(function(n){
    return '<button class="rbtn ' + (f.cap === n ? "check" : "sec") + '" data-fcap="' + n + '">' +
      (n ? n + " минут" : "Без потолка") + '</button>';
  }).join("");
  h += '<div class="admlbl">Сколько минут в день достаточно</div>' +
    '<div class="admrow">' + caps + '</div>' +
    (f.cap
      ? '<div class="admrow"><button class="rbtn ' + (f.capHard ? "check" : "sec") + '" data-act="fcaphard">' +
        (f.capHard ? "✓ После предела не пускать дальше" : "После предела только напоминать") + '</button></div>' +
        '<p class="dim">Сегодня за тренажёром <b>' + todayMinutes() + '</b> ' +
        plural(todayMinutes(), "минута", "минуты", "минут") + ' из ' + f.cap + '. ' +
        'Считается всё время в тренажёре, а не только занятие — вы мерите экранное время, а не учебное.</p>' +
        '<p class="dim">⚠️ По умолчанию тренажёр только напоминает. Жёсткий запрет наказывает за увлечённость, ' +
        'поэтому включается отдельно и никогда не обрывает начатый урок.</p>'
      : '<p class="dim">Потолок не задан. Если задать — тренажёр скажет ребёнку «на сегодня хватит», ' +
        'когда время выйдет.</p>') +
    '';

  /* галочка отчётов */
  h += '<div class="admlbl">Отчёты</div>' +
    '<div class="admrow"><button class="rbtn ' + (f.report ? "check" : "sec") + '" data-act="freport">' +
      (f.report ? "✓ Получать отчёты о занятиях" : "Отчёты выключены") + '</button></div>' +
    '<p class="dim">Пока отчёт никуда не уходит: почты у нас нет и адреса мы не спрашиваем. ' +
    'Он показывается здесь, в кабинете. Когда появится отправка, эта галочка будет ей управлять — ' +
    'выключенная означает «ничего не присылать».</p></div>';

  /* ---------- как шла работа (запись авторства) ---------- */
  var asum = authorSummary();
  h += '<div class="card"><h3>🖐 Как шла работа</h3>' +
    (asum.n
      ? '<p>По ' + asum.n + ' ' + plural(asum.n, "уроку", "урокам", "урокам") + ' с записью: ' +
        'написано руками <b>' + asum.hand + '</b>' +
        (asum.ready ? ', часть работы пришла готовой в <b>' + asum.ready + '</b>' : '') +
        (asum.ahead ? ', непройденное в решении — в <b>' + asum.ahead + '</b>' : '') + '.</p>'
      : '<p class="dim">Записи пока нет: она ведётся с пройденных уроков. ' +
        'Уроки, сданные раньше, сюда не попадут — выдумывать про них мы не будем.</p>') +
    '<p class="dim">Приговоров тут не выносят: мы называем только то, что видели у себя на странице, ' +
    'и не следим за ребёнком.</p>' +
    '<div class="admrow"><button class="rbtn check" data-act="totrace">Открыть запись →</button></div></div>';

  /* ---------- витрина ----------
     Кабинет — единственное место продукта, куда взрослый заходит сам.
     Значит и страница «что тут вообще собирают» должна быть под рукой
     именно отсюда: её показывают не ребёнку, а тому, кто спрашивает,
     чему он здесь учится. */
  h += '<div class="card"><h3>🏗 Что создают ученики</h3>' +
    '<p>Страница с вещами, которые собираются на курсе: шесть программ, рисунки и игры. ' +
    'Всё запускается прямо там — это не картинки работ, а сами работы.</p>' +
    '<p class="dim">Чужих детей и имён на ней нет: мы имя ребёнка не спрашиваем вовсе, ' +
    'а публичную ленту работ пришлось бы кому-то проверять руками.</p>' +
    '<div class="admrow"><button class="rbtn check" data-act="toworks">Открыть витрину →</button></div></div>';

  /* ---------- задание ребёнку ---------- */
  h += adultTaskHTML();

  /* ---------- недельный отчёт ---------- */
  h += weekReportHTML(S);

  h += '<div class="pager"><button class="bigbtn ghost" data-act="toadmin">Панель наставника →</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" data-act="tomap">На главную</button></div>';

  app.innerHTML = h;
  wireAdult();
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ---------- что показывает практика ----------
   Единственное место в продукте, где тренажёр правит собственное обещание по
   факту, а не по замыслу. Число уроков в занятии посчитано из длины текста
   урока; здесь оно сверяется с тем, сколько ребёнок работает на самом деле.
   ⚠️ Сам ничего не меняем: показываем и предлагаем. Рамку ставит взрослый. */
function paceStatHTML(){
  var st = zanStats(), f = frame();
  if (!st.enough){
    return '<div class="card"><h3>📏 Что показывает практика</h3>' +
      '<p class="dim">Замер появится после ' + ZAN_STAT_MIN + ' занятий, на которых сделан хотя бы один урок. ' +
      'Пока таких ' + st.n + '. Одно занятие — это случай, а не замер, и гадать по нему мы не будем.</p>' +
      '<p class="dim">Сейчас в занятие ставится ' + zanSlotsFor(f.len) + ' ' +
      plural(zanSlotsFor(f.len), "урок", "урока", "уроков") +
      ' — это посчитано из длины текста уроков, а не с вашего ребёнка.</p></div>';
  }
  var slower = st.per > MIN_PER_LESSON + 1.5, faster = st.per < MIN_PER_LESSON - 1.5;
  var h = '<div class="card"><h3>📏 Что показывает практика</h3>' +
    '<p>По ' + st.n + ' ' + plural(st.n, "занятию", "занятиям", "занятиям") +
    ': занятие идёт <b>' + st.mins + ' ' + plural(st.mins, "минуту", "минуты", "минут") + '</b> ' +
    'при заявленных ' + f.len + '. Один урок занимает <b>' + st.per + ' ' +
    plural(Math.round(st.per), "минуту", "минуты", "минут") + '</b>' +
    (slower ? ' — дольше, чем средние ' + MIN_PER_LESSON
            : (faster ? ' — быстрее, чем средние ' + MIN_PER_LESSON : '')) + '.</p>' +
    '<p class="dim">Считаются только активные минуты и только занятия, где сделан хотя бы один урок. ' +
    'Берётся медиана: одно занятие «не пошло» оценку не двигает.</p>';

  if (st.fits !== st.slotsNow)
    h += '<p>В занятие на ' + f.len + ' минут при таком темпе помещается <b>' + st.fits + '</b> ' +
      plural(st.fits, "урок", "урока", "уроков") + ', а ставится <b>' + st.slotsNow + '</b>. ' +
      (st.fits < st.slotsNow
        ? 'Отсюда и переносы в конце занятия.'
        : 'То есть занятие можно сделать плотнее.') + '</p>';
  else
    h += '<p>Число уроков в занятии совпадает с тем, что выходит на деле. Менять нечего.</p>';

  h += '<div class="admrow">' +
    (f.perLesson
      ? '<button class="rbtn check" data-act="perloff">✓ Замер учитывается — отключить</button>'
      : '<button class="rbtn check" data-act="peron">Считать план по этому замеру</button>') +
    (st.bestLen !== f.len
      ? '<button class="rbtn sec" data-act="perlen" data-len="' + st.bestLen + '">Поставить ' +
        st.bestLen + ' минут</button>'
      : '') +
    '</div>' +
    '<p class="dim">' + (f.perLesson
      ? 'План собирается по вашему ребёнку, а не по среднему.'
      : 'Пока план собирается по общему числу. Нажмите — и он будет собираться по вашему ребёнку.') +
    '</p></div>';
  return h;
}

/* ---------- «задать задание» ---------- */
var adultPick = { t:"task", tpl:(window.PARENT_TASKS && PARENT_TASKS[0] ? PARENT_TASKS[0].id : ""),
                  made:null, problem:null };
function adultTplById(id){
  var list = window.PARENT_TASKS || [];
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return list[0] || null;
}
function adultTaskHTML(){
  var week = ptaskWeekCount();
  var tabs = [["task","🔢 Задача с вашими числами"],["lesson","📘 Назначить урок"],["ask","🗣 Вопрос на объяснение"]]
    .map(function(t){
      return '<button class="rbtn ' + (adultPick.t === t[0] ? "check" : "sec") + '" data-ptab="' + t[0] + '">' + t[1] + '</button>';
    }).join("");

  var body = "";
  if (adultPick.t === "task"){
    var tpl = adultTplById(adultPick.tpl);
    var opts = (window.PARENT_TASKS || []).map(function(t){
      return '<option value="' + t.id + '"' + (tpl && t.id === tpl.id ? " selected" : "") + '>' +
        t.emoji + " " + esc(t.title) + " — " + esc(t.what) + '</option>';
    }).join("");
    body = '<p class="dim">Программу пишет шаблон, а числа даёте вы — из своей жизни. ' +
      'Правильный ответ вычисляет движок, вам его знать не нужно.</p>' +
      '<div class="admrow"><select id="ptpl">' + opts + '</select></div>' +
      (tpl ? '<div class="prow">' + tpl.params.map(function(p){
        return '<label class="admlbl">' + esc(p.label) +
          ' <input type="' + (p.text ? "text" : "number") + '" data-pp="' + p.k + '" value="' + esc(String(p.def)) + '"></label>';
      }).join("") + '</div>' : '') +
      '<div class="admrow"><button class="rbtn check" data-act="pmake">Собрать задание</button></div>';
  } else if (adultPick.t === "lesson"){
    var nx = nextLesson(), due = reviewDue();
    body = '<p class="dim">Назначение — это не новая задача, а указание, что делать: ' +
      'следующий урок по программе или возврат к трудному.</p><div class="admrow">' +
      (nx ? '<button class="rbtn sec" data-plesson="' + esc(nx.id) + '">Следующий урок: ' + esc(nx.title) + '</button>' : '') +
      (due.length ? '<button class="rbtn sec" data-preview="' + esc(due[0].lesson.id) + '">Повторить: ' + esc(due[0].lesson.title) + '</button>' : '') +
      '</div>' + (!nx && !due.length ? '<p class="dim">Пока нечего назначать: уроки не открыты или всё пройдено.</p>' : '');
  } else {
    var pick = dinnerPickFrom(S, dayKey());
    body = '<p class="dim">Здесь судит не движок, а вы: понимание объяснения взрослый оценить может, ' +
      'код — нет. Ребёнок увидит вопрос и отметит, что рассказал; проверить рассказ — ваша часть.</p>' +
      (pick
        ? '<div class="admrow"><button class="rbtn check" data-pask="' + esc(pick.it.sig) + '">Спросить про ' +
          '<code>' + esc(pick.it.sig) + '</code></button></div>' +
          '<p class="dim">Верный ответ: ' + esc(pick.it.what) + '.</p>'
        : '<p class="dim">Вопрос появится после первого пройденного урока.</p>');
  }

  var made = "";
  if (adultPick.problem)
    made += '<p class="warnline">⚠️ ' + esc(adultPick.problem) + '</p>';
  if (adultPick.made){
    made = '<div class="madelink"><b>Ссылка готова.</b> Отправьте её ребёнку тем же мессенджером, ' +
      'которым и так пишете. Сервер для этого не нужен: задание целиком лежит в адресе.' +
      '<div class="admrow"><button class="rbtn check" data-act="pcopy">Скопировать ссылку</button></div>' +
      '<p class="dim brk">' + esc(adultPick.made.link) + '</p></div>';
  }

  return '<div class="card"><h3>✉️ Задать задание ребёнку</h3>' +
    '<div class="admrow">' + tabs + '</div>' + body + made +
    (week >= PTASK_WEEK_LIMIT
      ? '<p class="warnline">⚠️ На этой неделе задание уже выдано. Больше одного — и занятия ' +
        'превращаются в «мама ещё задала», то есть в наказание. Лучше подождать до следующей недели.</p>'
      : '') +
    '<p class="dim">Задание взрослого не даёт звёзд и не входит в сотню уроков — иначе им можно было бы ' +
    'сломать прогресс из лучших побуждений. И самое сильное здесь — обратное направление: ' +
    'попросите ребёнка задать задачу вам («Своё задание» у него на карте миров).</p></div>';
}
function wireAdult(){
  app.querySelectorAll("[data-fwd]").forEach(function(b){
    b.onclick = function(){
      var n = +b.getAttribute("data-fwd"), days = frame().days.slice(), i = days.indexOf(n);
      if (i >= 0) days.splice(i, 1); else days.push(n);
      days.sort(function(x, y){ return x - y; });
      frameSet({ days: days });
      screenAdult();
    };
  });
  app.querySelectorAll("[data-fcap]").forEach(function(b){
    b.onclick = function(){ frameSet({ cap: +b.getAttribute("data-fcap") }); screenAdult(); };
  });
  app.querySelectorAll("[data-flen]").forEach(function(b){
    b.onclick = function(){ frameSet({ len: +b.getAttribute("data-flen") }); screenAdult(); };
  });
  app.querySelectorAll("[data-fmix]").forEach(function(b){
    b.onclick = function(){ frameSet({ mix: b.getAttribute("data-fmix") }); screenAdult(); };
  });
  app.querySelectorAll("[data-brdel]").forEach(function(b){
    b.onclick = function(){
      var br = frame().breaks.slice();
      br.splice(+b.getAttribute("data-brdel"), 1);
      frameSet({ breaks: br });
      screenAdult();
    };
  });
  app.querySelectorAll("[data-ptab]").forEach(function(b){
    b.onclick = function(){ adultPick.t = b.getAttribute("data-ptab"); adultPick.made = null; screenAdult(); };
  });
  var sel = document.getElementById("ptpl");
  if (sel) sel.onchange = function(){ adultPick.tpl = sel.value; adultPick.made = null; screenAdult(); };
  app.querySelectorAll("[data-plesson]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-plesson"), l = CURRICULUM.byId(id);
      adultMade({ t:"lesson", ref:id, text:"Пройти урок «" + (l ? l.title : id) + "»" });
    };
  });
  app.querySelectorAll("[data-preview]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-preview"), l = CURRICULUM.byId(id);
      adultMade({ t:"review", ref:id, text:"Повторить урок «" + (l ? l.title : id) + "»" });
    };
  });
  app.querySelectorAll("[data-pask]").forEach(function(b){
    b.onclick = function(){
      var sig = b.getAttribute("data-pask");
      adultMade({ t:"ask", ref:"", text:"Расскажи взрослому: что делает " + sig + "? Покажи на примере." });
    };
  });
  app.querySelectorAll("[data-act]").forEach(function(b){
    var act = b.getAttribute("data-act");
    b.onclick = function(){
      if (act === "tomap") return screenWorlds();
      if (act === "toadmin"){ location.hash = "#admin"; return screenAdmin(); }
      if (act === "totrace") return screenTrace();
      if (act === "toworks") return screenShowcase();
      if (act === "freport"){ frameSet({ report: !frame().report }); return screenAdult(); }
      if (act === "peron"){
        var st = zanStats();
        if (st.enough) frameSet({ perLesson: st.per });
        return screenAdult();
      }
      if (act === "perloff"){ frameSet({ perLesson: null }); return screenAdult(); }
      if (act === "fcaphard"){ frameSet({ capHard: !frame().capHard }); return screenAdult(); }
      if (act === "perlen"){ frameSet({ len: +b.getAttribute("data-len") }); return screenAdult(); }
      if (act === "fgoal"){
        var v = (document.getElementById("fgoal") || {}).value || "";
        frameSet({ goal: v || null });
        return screenAdult();
      }
      if (act === "fgoaloff"){ frameSet({ goal: null }); return screenAdult(); }
      if (act === "bradd"){
        var a = (document.getElementById("brfrom") || {}).value || "";
        var z = (document.getElementById("brto") || {}).value || "";
        if (!a || !z || z < a) return;
        var br = frame().breaks.slice();
        br.push([a, z]);
        frameSet({ breaks: br });
        return screenAdult();
      }
      if (act === "pmake"){
        var tpl = adultTplById(adultPick.tpl);
        if (!tpl) return;
        var v = {};
        app.querySelectorAll("[data-pp]").forEach(function(inp){ v[inp.getAttribute("data-pp")] = inp.value; });
        var built = taskBuild(tpl.title, tpl.goal(v), tpl.code(v));
        if (built.problem || built.error){
          /* сообщение рисуем в карточке, а не alert'ом: модальное окно
             останавливает страницу целиком, и на телефоне это выглядит как
             поломка. Плюс alert невозможно проверить тестом. */
          adultPick.made = null;
          adultPick.problem = built.problem || "Программа шаблона не запустилась — проверьте числа.";
          return screenAdult();
        }
        adultPick.problem = null;
        adultPick.made = { link: taskLink(built.task) };
        return screenAdult();
      }
      if (act === "pcopy" && adultPick.made) return copyText(adultPick.made.link, b);
    };
  });
}
function adultMade(o){
  o.from = "взрослый";
  adultPick.made = { link: assignLink(o) };
  screenAdult();
}

/* ---------- приём задания по ссылке (сторона ребёнка) ---------- */
function screenAssign(o){
  enterScreen(undefined, "assign");
  var key = ptaskAdd(o);
  var l = o.ref ? CURRICULUM.byId(o.ref) : null;
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">задание от взрослого</div>' +
      '<h1>✉️ Тебе задание</h1></div></div>' +
    '<div class="card"><p class="asktext">' + esc(o.text) + '</p>' +
    (o.t === "ask"
      ? '<p class="dim">Тут нет кнопки «проверить»: рассказать надо живому человеку. ' +
        'Когда расскажешь — отметь, и взрослый увидит.</p>' +
        '<div class="winrow"><button class="bigbtn" id="adone">Рассказал</button></div>'
      : '<div class="winrow"><button class="bigbtn" id="aopen">' +
        (l ? "Открыть урок «" + esc(l.title) + "»" : "Открыть") + '</button></div>') +
    '</div>' +
    '<p class="dim">Звёзд за это задание не даётся — это просьба взрослого, а не урок из сотни.</p>' +
    '<div class="pager"><button class="bigbtn ghost" id="aback">← На «Сегодня»</button></div>';
  var ad = document.getElementById("adone");
  if (ad) ad.onclick = function(){ ptaskMarkDone(key); screenToday(); };
  var ao = document.getElementById("aopen");
  if (ao) ao.onclick = function(){
    ptaskMarkDone(key);
    if (o.ref) openLesson(o.ref); else screenWorlds();
  };
  document.getElementById("aback").onclick = screenToday;
  refreshTop();
}

/* ================= раздел: свои задания =================
   Ребёнок перестаёт быть только решателем и становится автором: пишет
   программу, а ожидаемый ответ ВЫЧИСЛЯЕТ движок — ровно как в разминке
   «угадай вывод» и в вердиктах «Ты и ИИ». Условие ребёнок пишет словами:
   именно это и есть упражнение, потому что автор задания обязан объяснить
   задачу тому, кто его кода не видел.

   Готовое задание уезжает ССЫЛКОЙ — другу, брату, родителю. Сервера для
   этого не нужно: всё, что нужно решателю, лежит в самом адресе.

   Что в ссылке: название, условие, ожидаемый вывод, имя автора.
   Чего в ссылке НЕТ: программы автора. Пусть друг напишет свою — сойтись
   должен ответ, а не буквы. Код остаётся у автора (S.mytasks), чтобы можно
   было выдать ссылку заново или поправить задание.

   Честно про защиту: base64 — это не шифр, а способ уложить русский текст в
   адрес. Кто умеет его раскодировать, увидит ожидаемый вывод. Это обмен
   заданиями между своими, а не олимпиада.
   ============================================================ */
var TASK_CODE_MAX = 2000;    /* программа длиннее — уже не задание для друга */
var TASK_OUT_MAX  = 1500;    /* и ожидаемый вывод должен влезать в ссылку */
var TASK_KEEP     = 20;      /* столько своих заданий держим в памяти */
/* Случайность и input() запрещены не из вредности: у друга случайные числа
   выпадут другие, а ответов для input() в ссылке нет — задание оказалось бы
   непроходимым, и виноват был бы тренажёр. */
var TASK_BAN = /\b(randint|choice|shuffle|sample|random|input)\s*\(/;

/* base64 для адресной строки. btoa сам по себе умеет только «латиницу», а у
   нас русский текст, поэтому сначала переводим строку в байты
   (encodeURIComponent + unescape — приём, который работает во всех браузерах),
   а потом убираем из результата символы, которые в адресе значат другое. */
function b64urlEnc(str){
  return btoa(unescape(encodeURIComponent(String(str))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDec(s){
  var b = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  return decodeURIComponent(escape(atob(b)));
}

function taskPack(t){
  return b64urlEnc(JSON.stringify({ v:1, t:t.title, g:t.goal, o:t.lines, a:t.author || "" }));
}
/* Разбор ссылки. Всё, что пришло снаружи, считаем испорченным, пока не
   доказано обратное: ссылку могли обрезать в мессенджере или собрать руками. */
function taskUnpack(s){
  var o = null;
  try { o = JSON.parse(b64urlDec(s)); } catch(e){ return null; }
  if (!o || o.v !== 1) return null;
  if (typeof o.t !== "string" || typeof o.g !== "string" || !Array.isArray(o.o)) return null;
  if (!o.o.length || o.o.length > 200) return null;
  for (var i = 0; i < o.o.length; i++) if (typeof o.o[i] !== "string") return null;
  return { title: o.t.slice(0, 80), goal: o.g.slice(0, 600), lines: o.o,
           author: typeof o.a === "string" ? o.a.slice(0, 24) : "" };
}
function taskLink(t){
  var base = "";
  try { base = location.origin + location.pathname; } catch(e){}
  return base + "#task=" + taskPack(t);
}
/* Ключ чужого задания. Своего id в ссылке нет, поэтому считаем короткий хэш
   от условия и ответа: одно и то же задание всегда даёт один ключ, и опыт за
   него не начислится дважды, даже если ссылку открыть десять раз. */
function taskKey(t){
  var src = t.title + "\n" + t.goal + "\n" + t.lines.join("\n");
  var h = 5381;
  for (var i = 0; i < src.length; i++) h = ((h * 33) ^ src.charCodeAt(i)) >>> 0;
  return "k" + h.toString(36);
}

/* ===== обратная ссылка: «твою задачу решили» =====
   Механика 3 из docs/foresight-2027.md § 16.4 работала наполовину: ребёнок
   отправлял задачу и НИКОГДА не узнавал, решил её взрослый или нет. Половина
   петли — это не петля: ради зрителя всё и затевалось, а зритель был нем.

   Обратный путь устроен как прямой — ссылкой, без сервера и без хранения:
   решивший жмёт «отправить результат автору», получает адрес вида
   #solved=<base64> и отправляет его тем же мессенджером.

   ⚠️ Имени в квитанции НЕТ, и это не забывчивость. Ребёнок и так знает, кому
   отправлял, а имя взрослого в детском прогрессе — это персональные данные
   рядом с детскими, то есть ровно то, чего продукт не делает (§ 14 разбора
   занятия). В квитанции только: какая задача, с какой попытки, когда. */
var SOLVED_KEEP = 40;
function solvedPack(r){
  return b64urlEnc(JSON.stringify({ v:1, k:r.key, n:r.tries, t:r.title }));
}
function solvedUnpack(s){
  var o = null;
  try { o = JSON.parse(b64urlDec(s)); } catch(e){ return null; }
  if (!o || o.v !== 1) return null;
  if (typeof o.k !== "string" || !o.k) return null;
  var n = +o.n;
  if (!isFinite(n) || n < 1 || n > 9999) return null;
  return { key: o.k.slice(0, 32), tries: Math.round(n),
           title: typeof o.t === "string" ? o.t.slice(0, 80) : "" };
}
function solvedLink(r){
  var base = "";
  try { base = location.origin + location.pathname; } catch(e){}
  return base + "#solved=" + solvedPack(r);
}
function solvedAll(){ S.solved = S.solved || {}; return S.solved; }
/* Квитанция кладётся по своему ключу, а не в список: одну и ту же ссылку
   можно открыть десять раз, и десять «решили» из этого получиться не должно.
   Ключ — задача плюс число попыток: второе решение той же задачи с другого
   раза это уже другое событие, и его видеть надо. */
function solvedAdd(r){
  var d = solvedAll(), k = r.key + "-" + r.tries;
  if (!d[k]) d[k] = { k: r.key, n: r.tries, t: r.title || "", at: Date.now() };
  var keys = Object.keys(d);
  if (keys.length > SOLVED_KEEP){
    keys.sort(function(a, b){ return (d[a].at || 0) - (d[b].at || 0); });
    keys.slice(0, keys.length - SOLVED_KEEP).forEach(function(x){ delete d[x]; });
  }
  save();
  return k;
}
/* Квитанции по конкретной задаче, свежие сверху. */
function solvedFor(key){
  var d = solvedAll();
  return Object.keys(d).map(function(k){ return d[k]; })
    .filter(function(x){ return x && x.k === key; })
    .sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
}
function solvedCount(){ return Object.keys(solvedAll()).length; }

/* Экран автора: его задачу решили. Открывается по присланной обратно ссылке.
   ⚠️ Хвалим РЕШИВШЕГО, а не автора за сложность: «взрослый не смог с первой
   попытки» — это повод для гордости, но не для злорадства, и разница между
   ними целиком в словах. */
function screenSolved(r){
  enterScreen("mine", "solved");
  session = { id:null, attempts:0, hints:0, shown:false };
  solvedAdd(r);
  var mine = myTasksList().filter(function(t){ return taskKey(t) === r.key; })[0];
  var title = (mine && mine.title) || r.title || "твоя задача";
  var n = r.tries;

  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">ответ на твою задачу</div>' +
    '<h1>🎉 Твою задачу решили</h1></div>' +
    '<div class="right"><span class="tag">роль автора</span></div></div>' +
    '<p class="lede">Задачу «<b>' + esc(title) + '</b>» прошли' +
    (n === 1 ? ' <b>с первой попытки</b>' : ' с <b>' + n + '-й</b> попытки') + '. ' +
    'Сверял вывод тренажёр, а не человек, — значит условие ты написал понятно.</p>' +
    '<div class="card"><h3>' + (n === 1
      ? "С первой попытки — условие было понятным"
      : "Не с первой попытки — и это нормально") + '</h3>' +
    '<p>' + (n === 1
      ? "Написать условие так, чтобы по нему получилось решить с первого раза, труднее, чем решить самому: " +
        "приходится объяснить задачу словами, ничего не пропустив."
      : "Попыток было " + n + ". Спроси, что оказалось непонятным в условии, — это и есть самая " +
        "полезная часть: так учатся писать условия, а не только программы.") + '</p>' +
    '<p class="dim">Ни имени, ни программы решавшего в ссылке нет — только какая задача ' +
    'и с какой попытки. Мы про людей ничего не собираем.</p></div>' +
    '<div class="pager"><button class="bigbtn" id="tomine">✍️ Задать ещё одну</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  document.getElementById("tomine").onclick = function(){
    try { history.replaceState(null, "", location.pathname + location.search); } catch(e){}
    screenMyTasks();
  };
  document.getElementById("tomap").onclick = function(){
    try { history.replaceState(null, "", location.pathname + location.search); } catch(e){}
    screenWorlds();
  };
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function myTasksAll(){ S.mytasks = S.mytasks || {}; return S.mytasks; }
/* Список для показа: только целые записи, свежие сверху. Битую запись (а она
   может приехать со старой версии или из чужого файла прогресса) молча
   пропускаем — падать из-за неё экран не должен. */
function myTasksList(){
  var d = myTasksAll();
  return Object.keys(d).map(function(k){
    var t = d[k];
    if (!t || typeof t.title !== "string" || !Array.isArray(t.lines) || !t.lines.length) return null;
    return { id:k, title:t.title, goal:t.goal || "", code:t.code || "",
             lines:t.lines, at:t.at || 0, author:t.author || "" };
  }).filter(Boolean).sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
}
function myTaskSave(t){
  var d = myTasksAll();
  var id = t.id || ("t" + Date.now().toString(36));
  d[id] = { title:t.title, goal:t.goal, code:t.code, lines:t.lines,
            author:t.author || "", at: Date.now() };
  var keys = Object.keys(d);
  if (keys.length > TASK_KEEP){
    keys.sort(function(a, b){ return (d[a].at || 0) - (d[b].at || 0); });
    keys.slice(0, keys.length - TASK_KEEP).forEach(function(k){ delete d[k]; });
  }
  save();
  return id;
}
function myTaskDrop(id){ delete myTasksAll()[id]; save(); }

/* ===== можно ли из этого сделать задание =====
   Каждое правило — не придирка, а защита решателя: без него задание у друга
   оказалось бы непроходимым или бессмысленным. */
function taskProblem(title, goal, code){
  title = String(title || "").trim();
  goal = String(goal || "").trim();
  if (!title) return "Заданию нужно название: по нему друг поймёт, что открыл.";
  if (title.length > 60) return "Название слишком длинное — уложись в 60 знаков.";
  if (goal.length < 15)
    return "Условие слишком короткое. Друг не увидит твоей программы — он поймёт задачу только из этих слов.";
  if (goal.length > 600) return "Условие слишком длинное — уложись в 600 знаков.";
  if (!String(code || "").trim()) return "Программы нет. Задание — это твоё собственное решение: с него и вычисляется правильный ответ.";
  if (String(code).length > TASK_CODE_MAX)
    return "Программа длиннее " + TASK_CODE_MAX + " знаков — для задания другу это уже много.";
  if (TASK_BAN.test(String(code)))
    return "В задании нельзя случайность (randint, choice, shuffle) и input(): " +
           "у друга выпали бы другие числа, и сверять было бы нечего.";
  return null;
}
/* Собрать задание из формы. Правильный ответ НЕ вводится руками — его считает
   движок, поэтому «автор ошибся в ожидаемом выводе» здесь невозможно. */
function taskBuild(title, goal, code){
  var problem = taskProblem(title, goal, code);
  if (problem) return { problem: problem };
  var res = Runtime.get("mini").run(code, {});
  if (res.error) return { error: res.error };
  var lines = res.lines || [];
  if (!lines.length)
    return { problem: "Программа ничего не напечатала. Задание проверяется по напечатанному — " +
             "добавь print, иначе сверять будет нечего. Рисунок черепашки для задания пока не подходит." };
  if (lines.join("\n").length > TASK_OUT_MAX)
    return { problem: "Вывод слишком длинный: он целиком уезжает в ссылку, а она станет неподъёмной. " +
             "Сделай программу поспокойнее — например, меньше повторов." };
  return { task: { title: String(title).trim(), goal: String(goal).trim(),
                   code: String(code), lines: lines, author: myName() || "" } };
}

/* ===== экран: мои задания ===== */
function screenMyTasks(edit){
  enterScreen("mine", "mytasks");
  var list = myTasksList();
  var draft = (S.mytaskDraft && typeof S.mytaskDraft === "object") ? S.mytaskDraft : null;
  var start = edit || draft || { title:"", goal:"", code:"" };

  var got = solvedCount();
  var h = '<div class="lvlhead"><div><div class="idx">без звёзд, по желанию</div>' +
    '<h1>✍️ Задай задачу взрослому</h1></div>' +
    '<div class="right"><span class="tag">взрослому или другу</span></div></div>' +
    '<p class="lede">Обычно задания раздают тебе. Здесь наоборот: задачу придумываешь ты, ' +
    'а решает мама, папа, брат или друг — прямо в браузере, за пару минут. ' +
    'Ты пишешь программу, тренажёр сам считает, что она печатает, и это становится правильным ответом. ' +
    'Твоего кода в ссылке нет: решать придётся своей головой, сойтись должен вывод.</p>' +
    (got ? '<p class="lede">🎉 Твои задачи уже решали: <b>' + got + '</b> ' +
           plural(got, "раз", "раза", "раз") + '.</p>' : '');

  h += '<div class="card"><h3>Как это работает</h3>' +
    '<ol class="tsteps"><li>Пишешь программу — такую, какой сам решил бы задачу.</li>' +
    '<li>Пишешь условие словами: решающий не увидит кода, только эти слова.</li>' +
    '<li>Жмёшь «Собрать задание» — движок прогоняет программу и запоминает ответ.</li>' +
    '<li>Копируешь ссылку и отправляешь. Открывший будет решать.</li>' +
    '<li>Когда решат, тебе пришлют ссылку обратно — и ты увидишь, с какой попытки.</li></ol>' +
    '<p class="dim">Правило одно: без случайных чисел и без input(). У решающего случайное выпало бы другое, ' +
    'и проверить было бы нечего.</p>' +
    '<p class="dim">⚠️ Взрослому не нужно ничего устанавливать и уметь: он открывает ссылку, ' +
    'пишет программу и жмёт «Проверить». Судит тренажёр, а не ты, — спорить не о чем.</p></div>';

  h += '<div class="card"><h3>Задание</h3>' +
    /* Значения полей ставятся из JS, а не подставляются в разметку: esc()
       экранирует только &, < и >, поэтому кавычка в названии вырвалась бы
       из атрибута value и сломала форму. */
    '<label class="reglbl">Название' +
    '<input type="text" id="tttl" maxlength="60" autocomplete="off" placeholder="Например, Считалка до десяти"></label>' +
    '<label class="reglbl">Условие — что должна делать программа' +
    '<textarea id="tgoal" rows="3" maxlength="600" spellcheck="false" placeholder="Напечатай числа от 1 до 10, каждое с новой строки, а в конце их сумму."></textarea></label>' +
    '</div>' +
    /* Сообщения об ошибках показывает сама студия (её showMsg приходит в
       check), поэтому отдельного места под них тут нет — только под готовую
       ссылку. */
    '<div id="studio"></div><div id="tout"></div>';

  h += '<div class="sect"><h2>Мои задания</h2><div class="line"></div>' +
    '<span class="cnt">' + list.length + '</span></div>';
  if (!list.length){
    h += '<div class="note"><b>Пока ни одного</b>Собери первое — оно появится здесь, и ссылку можно будет выдать снова в любой момент.</div>';
  }
  list.forEach(function(t){
    var n = t.lines.length;
    var got = solvedFor(taskKey(t));
    h += '<div class="fproj done"><div class="fptop"><span class="pjemoji">✍️</span>' +
      '<div class="fpttl"><span class="pjkicker">' + fmtDay(t.at) + '</span>' +
      '<b>' + esc(t.title) + '</b>' +
      '<span class="fpsub">' + esc(t.goal) + '</span>' +
      (got.length
        ? '<span class="fpsub solvedline">🎉 Решили: ' + got.length + ' ' +
          plural(got.length, "раз", "раза", "раз") + ' · лучшая попытка — ' +
          Math.min.apply(null, got.map(function(x){ return x.n; })) + '-я</span>'
        : '') +
      '</div>' +
      '<span class="fpstat ok">' + n + " " + plural(n, "строка", "строки", "строк") + ' ответа</span></div>' +
      '<div class="fpbtns"><button class="rbtn" data-tlink="' + t.id + '">Скопировать ссылку</button>' +
      '<button class="rbtn sec" data-topen="' + t.id + '">Открыть как друг</button>' +
      '<button class="rbtn sec" data-tedit="' + t.id + '">Переделать</button>' +
      '<button class="rbtn sec" data-tdel="' + t.id + '">Удалить</button></div></div>';
  });
  h += '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  app.innerHTML = h;

  var studio = makeStudio({
    engine: "mini",
    code: start.code || '# программа-ответ: как ты сам решил бы свою задачу\nprint("привет")\n',
    label: "твоя программа — с неё считается правильный ответ",
    checkLabel: "📦 Собрать задание",
    check: function(ed, showMsg){ taskPublish(ed, showMsg); }
  });
  document.getElementById("studio").appendChild(studio);

  var ttl = document.getElementById("tttl"), tgoal = document.getElementById("tgoal");
  ttl.value = start.title || "";
  tgoal.value = start.goal || "";
  function read(){
    return { title: ttl.value, goal: tgoal.value, code: studio.editor.getCode() };
  }
  /* Уход с экрана не должен стирать начатое задание — ровно та же беда, что
     когда-то была у песочницы и у уроков. Метка mytask говорит draftFlush,
     что тут есть что сохранить, а stash отдаёт ему все три поля разом. */
  session = { id:null, attempts:0, hints:0, shown:false, mytask:true, studio:studio,
    mytaskStash: function(){
      var v = read();
      S.mytaskDraft = (v.title.trim() || v.goal.trim()) ? v : null;
    } };
  studio.editor.onEdit = draftSchedule;
  ttl.addEventListener("input", draftSchedule);
  tgoal.addEventListener("input", draftSchedule);

  function taskPublish(ed, showMsg){
    var v = read();
    var built = taskBuild(v.title, v.goal, v.code);
    if (built.problem){ showMsg("warn", "<b>Пока не задание</b>" + built.problem); return; }
    if (built.error){
      ed.setError(built.error.line);
      showMsg("bad", "<b>Программа падает</b>Задание не может падать: сначала починим её.<br>" + errHTML(built.error));
      return;
    }
    var id = myTaskSave(built.task);
    S.mytaskDraft = null;
    award("author");
    markActiveToday();       /* составить задание — это занятие, стрик живёт */
    save();
    showMsg("ok", "<b>Задание готово</b>Правильный ответ посчитан движком — вот он. " +
      "Ссылка ниже: отправь её тому, кого хочешь озадачить.");
    var link = taskLink(built.task);
    document.getElementById("tout").innerHTML =
      '<div class="card"><h3>Правильный ответ (его посчитал движок)</h3>' +
      '<pre class="fpcode">' + esc(built.task.lines.join("\n")) + '</pre>' +
      '<h3>Ссылка для друга</h3><div class="codebox"><code id="tlink">' + esc(link) + '</code>' +
      '<button class="rbtn sec" id="tcopy">Скопировать</button></div>' +
      '<p class="dim">Ссылка длинная, потому что задание целиком лежит внутри неё — ни сервера, ни интернета для этого не нужно. ' +
      'Твоей программы в ссылке нет.</p>' +
      '<div class="fpbtns"><button class="rbtn" id="tselfcheck">Открыть как друг</button></div></div>';
    document.getElementById("tcopy").onclick = function(){ copyText(link, this); };
    document.getElementById("tselfcheck").onclick = function(){
      openFriendTask(built.task, { own:true, id:id });
    };
    refreshTop();
  }

  app.querySelectorAll("[data-tlink]").forEach(function(b){
    b.onclick = function(){
      var t = myTasksAll()[b.getAttribute("data-tlink")];
      if (t) copyText(taskLink(t), b);
    };
  });
  app.querySelectorAll("[data-topen]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-topen"), t = myTasksAll()[id];
      if (t) openFriendTask(t, { own:true, id:id });
    };
  });
  app.querySelectorAll("[data-tedit]").forEach(function(b){
    b.onclick = function(){
      var t = myTasksAll()[b.getAttribute("data-tedit")];
      if (t) screenMyTasks({ title:t.title, goal:t.goal, code:t.code });
    };
  });
  app.querySelectorAll("[data-tdel]").forEach(function(b){
    b.onclick = function(){
      myTaskDrop(b.getAttribute("data-tdel"));
      screenMyTasks();
    };
  });
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ===== экран: решаем чужое задание =====
   opts.own — это своё же задание, открытое «глазами друга»: проверка та же,
   но опыт за него не даётся (иначе задания составлялись бы ради XP). */
function openFriendTask(t, opts){
  enterScreen("mine", "friendtask");
  opts = opts || {};
  var key = taskKey(t);
  var already = !!(S.friendTasks && S.friendTasks[key]);
  /* Имя автора показываем как есть, без склонения: «задание от Аня» звучит
     ломано, а склонять русские имена в коде — верный способ ошибиться. */
  var who = t.author ? "автор — " + esc(t.author) : "задание от друга";

  var h = '<div class="lvlhead"><div><div class="idx">' +
    (opts.own ? "твоё задание глазами друга" : who) + '</div>' +
    '<h1>✍️ ' + esc(t.title) + '</h1></div>' +
    '<div class="right"><span class="tag">звёзд не даёт</span></div></div>' +
    '<p class="lede">' + (opts.own
      ? 'Так задание видит тот, кому ты отправил ссылку: условие есть, а твоей программы нет. Попробуй решить сам — заодно проверишь, всё ли понятно из условия.'
      : 'Это задание придумал человек, а не тренажёр. Твоя задача — написать программу, которая печатает то же самое. ' +
        'Правильный ответ уже посчитан у автора: сойтись должен вывод, а не буквы кода.') + '</p>';

  h += '<div class="goal"><h3>🎯 Условие</h3><p>' + esc(t.goal) + '</p>' +
    '<ul><li>Проверяется напечатанное: строк должно быть столько же и слово в слово.</li>' +
    '<li>Как ты это сделаешь — твоё дело: у автора своя программа, у тебя может быть другая.</li></ul></div>';

  /* Ссылку часто открывает ВЗРОСЛЫЙ, и открывает он её впервые. Ему надо
     сказать три вещи и не больше: устанавливать ничего не нужно, судит
     тренажёр, и зачем это вообще. Третье — не реклама: пока взрослый не
     понимает, что происходит, он закроет вкладку. */
  if (!opts.own)
    h += '<div class="card"><h3>Если вы взрослый и открыли это впервые</h3>' +
      '<p>Устанавливать ничего не нужно: пишете программу прямо здесь и жмёте «Проверить». ' +
      'Совпадение вывода сверяет тренажёр, а не автор задачи, — спорить не о чем.</p>' +
      '<p class="dim">Задачу придумал ребёнок, и это сложнее, чем решить: ему пришлось объяснить её ' +
      'словами так, чтобы вы поняли без его программы. Объяснить может только тот, кто понял, — ' +
      'поэтому пара минут здесь говорит о его понимании больше любого отчёта.</p></div>';

  h += '<div id="studio"></div>' +
    '<div class="pager"><button class="bigbtn ghost" id="tomine">✍️ Составить своё</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  app.innerHTML = h;

  /* Код решателя сохраняется тем же механизмом, что черновики уроков: ключ
     задания вместо id урока. Ушёл посмотреть шпаргалку — код на месте. */
  var draftId = "task-" + key;
  var starter = "# твоя программа\n";
  var studio = makeStudio({
    engine: "mini", code: starter, label: "твоя программа",
    check: function(ed, showMsg){ friendCheck(ed, showMsg); }
  });
  document.getElementById("studio").appendChild(studio);
  session = { id:null, attempts:0, hints:0, shown:false, studio:studio,
              lesson:draftId, starter:[{ name:"main.py", code:starter }] };
  var d = draftGet(draftId);
  if (d) draftApply(studio.editor, d.files);
  studio.editor.onEdit = draftSchedule;

  function friendCheck(ed, showMsg){
    session.attempts++;
    var res = Runtime.get("mini").run(ed.getCode(), {});
    if (res.error){ ed.setError(res.error.line); showMsg("bad", errHTML(res.error)); return; }
    var got = res.lines, exp = t.lines;
    if (!(exp.length === got.length && exp.every(function(x, i){ return x === got[i]; }))){
      showMsg("bad", "<b>Ещё не то</b>" + diffBlock(exp, got));
      return;
    }
    winFriendTask(t, key, already, opts);
  }

  document.getElementById("tomine").onclick = function(){ screenMyTasks(); };
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

var FRIEND_XP = 20;   /* за чужое задание, один раз на задание */
function winFriendTask(t, key, already, opts){
  var gained = 0;
  if (!opts.own && !already){
    S.friendTasks = S.friendTasks || {};
    S.friendTasks[key] = 1;
    S.xp += FRIEND_XP; gained = FRIEND_XP;
    award("guest");
  }
  markActiveToday();
  save(); refreshTop();

  var first = session.attempts === 1;
  document.getElementById("wincard").innerHTML =
    '<div class="big">' + (first ? "🎯" : "🤝") + '</div>' +
    '<h2>' + (opts.own ? "Своё задание проходится" : "Задание пройдено") + '</h2>' +
    '<p>' + (opts.own
      ? "Вывод сошёлся — значит условие понятное и задание решаемо. Можно отправлять."
      : "Вывод сошёлся с ответом автора" + (t.author ? " (" + esc(t.author) + ")" : "") +
        ". Программа у тебя своя, а результат тот же — так и работают настоящие задачи.") + '</p>' +
    (gained ? '<div class="winxp">+' + gained + ' XP</div>' : '') +
    /* ⚠️ Обратная ссылка — главная кнопка, а не приписка снизу. Без неё автор
       никогда не узнает, решили его задачу или нет, и «зритель», ради которого
       вся механика затевалась, остаётся немым. Своё же задание, открытое
       глазами друга, отправлять некому — там кнопки нет. */
    (opts.own ? '' : '<div class="winrow"><button class="bigbtn" id="fback">🔗 Отправить результат автору</button></div>' +
      '<div class="msg" id="fbackmsg"></div>') +
    '<div class="winrow"><button class="bigbtn' + (opts.own ? '' : ' ghost') + '" id="fmine">✍️ Составить своё</button>' +
    '<button class="bigbtn ghost" id="wstay">Остаться здесь</button></div>';
  document.getElementById("win").classList.add("show");
  confetti(first ? 3 : 1);
  var fb = document.getElementById("fback");
  if (fb) fb.onclick = function(){
    var link = solvedLink({ key: key, tries: session.attempts, title: t.title });
    var box = document.getElementById("fbackmsg");
    box.className = "msg show ok";
    box.innerHTML = '<b>Ссылка с результатом</b>Отправьте её автору тем же мессенджером. ' +
      'Ни имени, ни программы в ней нет — только какая задача и с какой попытки.' +
      '<div class="admrow"><button class="rbtn check" id="fbackcopy">Скопировать</button></div>' +
      '<p class="dim brk">' + esc(link) + '</p>';
    var cb = document.getElementById("fbackcopy");
    if (cb) cb.onclick = function(){ copyText(link, cb); };
  };
  document.getElementById("fmine").onclick = function(){ closeWin(); screenMyTasks(); };
  document.getElementById("wstay").onclick = closeWin;
}

/* Ссылка не открылась. Молча уводить на карту миров нельзя: ребёнок нажал
   на присланную ссылку и должен понять, что случилось, а не решить, что
   тренажёр сломался. */
function screenTaskBroken(){
  enterScreen("mine", "friendtask");
  session = { id:null, attempts:0, hints:0, shown:false };
  app.innerHTML = '<div class="lvlhead"><div><div class="idx">ссылка не открылась</div>' +
    '<h1>✍️ Задание не прочиталось</h1></div></div>' +
    '<div class="note"><b>Скорее всего, ссылку обрезали</b>Мессенджеры иногда режут длинные адреса. ' +
    'Попроси прислать её ещё раз — целиком, лучше файлом или обычным текстом.</div>' +
    '<div class="pager"><button class="bigbtn" id="tomine">✍️ Составить своё задание</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  document.getElementById("tomine").onclick = function(){ screenMyTasks(); };
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
}

/* ================= пересказ программы словами =================
   Обратное направление: сто уроков ребёнок превращает замысел в код, а здесь
   код превращается в русские фразы. Это ровно то умение, ради которого сделан
   раздел «Ты и ИИ»: чтобы командовать ИИ, надо уметь сказать словами, что
   должна делать программа.

   Пересказ собирается из ДВУХ источников, и это важно:
     - дерево (AST) даёт СТРУКТУРУ — что здесь цикл, а что описание функции;
     - шаги прогона дают ФАКТЫ — сколько раз повторилось, что напечатало,
       чему стало равно.
   Поэтому в пересказе нет ни одного «наверное»: каждая фраза — про то, что
   действительно произошло на этом запуске. Так и написано над списком, чтобы
   ребёнок не принял пересказ за замысел: программа могла сделать не то, что
   задумано, — как раз это и видно.

   Живёт на экране визуализатора, над плеером: кнопка «Разобрать» на уроке
   ведёт сюда, и получается два взгляда на один прогон — фразами и по шагам.
   ============================================================ */
var STORY_MAX_DEPTH = 2;    /* глубже не идём: пересказ должен читаться */
var STORY_MAX_LINES = 24;   /* и не быть длиннее самой программы */

function storyMaxLine(node){
  var max = node.line || 0;
  astWalk(node, function(m){ if (m.line > max) max = m.line; });
  return max;
}
function storyRange(node){
  var a = node.line || 0, b = storyMaxLine(node);
  return b > a ? ("строки " + a + "–" + b) : ("строка " + a);
}
function storyTimes(n){
  if (!n) return "ни разу не сработала";
  if (n === 1) return "сработала один раз";
  return "сработала " + n + " " + plural(n, "раз", "раза", "раз");
}
/* Имя того, что вызывают: print, sorted, черепашка, свой метод. */
function storyCallName(node){
  if (!node || node.type !== "Call" || !node.func) return null;
  if (node.func.type === "Name") return node.func.id;
  if (node.func.type === "Attribute") return node.func.attr;
  return null;
}
function storyCut(s, n){
  s = String(s === null || s === undefined ? "" : s).replace(/\s+/g, " ").trim();
  n = n || 60;
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/* Одна фраза про один оператор. null значит «сказать нечего» — служебные
   строки в пересказ не идут, иначе он станет подстрочником. */
function storyOne(st, facts, depth){
  var hits = facts.hits[st.line] || 0;
  var note = facts.note[st.line], printed = facts.printed[st.line];
  var где = "строка " + st.line + ": ";
  /* Строка, на которой прогон и оборвался. Говорим об этом прямо: иначе про
     print(10 / 0) вышло бы «напечатал пустую строку» — а он не напечатал
     ничего, он упал. */
  if (facts.error && facts.error.line === st.line)
    return { text: где + "здесь программа остановилась с ошибкой", body: null };

  if (st.type === "FuncDef"){
    var внутри = st.body && st.body.length ? (facts.hits[st.body[0].line] || 0) : 0;
    var парам = (st.params || []).join(", ");
    return { text: storyRange(st) + ": описал команду «" + st.name + "(" + парам + ")» — " +
                   (внутри ? "её вызвали " + внутри + " " + plural(внутри, "раз", "раза", "раз")
                           : "но её так и не вызвали"),
             body: st.body, at: st.line };
  }
  if (st.type === "ClassDef")
    return { text: storyRange(st) + ": описал вид объектов «" + st.name + "»", body: null };
  if (st.type === "For"){
    var сколько = st.body && st.body.length ? (facts.hits[st.body[0].line] || 0) : hits;
    return { text: storyRange(st) + ": повторил " + сколько + " " +
                   plural(сколько, "раз", "раза", "раз") + " — по одному на каждый элемент",
             body: st.body };
  }
  if (st.type === "While"){
    var кругов = st.body && st.body.length ? (facts.hits[st.body[0].line] || 0) : hits;
    return { text: storyRange(st) + ": повторял, пока условие верно, — " + кругов + " " +
                   plural(кругов, "круг", "круга", "кругов"), body: st.body };
  }
  if (st.type === "If"){
    var взяли = st.body && st.body.length ? (facts.hits[st.body[0].line] || 0) : 0;
    var текст = где + "проверил условие " + hits + " " + plural(hits, "раз", "раза", "раз") +
                " — сработало " + взяли;
    if (st.orelse && st.orelse.length){
      var иначе = facts.hits[st.orelse[0].line] || 0;
      текст += ", иначе-ветка — " + иначе;
    }
    return { text: текст, body: st.body };
  }
  if (st.type === "Assign" || st.type === "AnnAssign" || st.type === "AugAssign"){
    if (!note) return null;
    return { text: где + (hits > 1
                    ? "менял значение " + hits + " " + plural(hits, "раз", "раза", "раз") + ", в конце "
                    : "") + storyCut(note),
             body: null };
  }
  if (st.type === "Return")
    return { text: где + "вернул ответ (" + storyTimes(hits) + ")", body: null };
  if (st.type === "Import" || st.type === "ImportFrom")
    return { text: где + "подключил готовый набор команд", body: null };
  if (st.type === "ExprStmt"){
    var имя = storyCallName(st.value);
    if (имя === "print"){
      var сколько = hits > 1 ? "напечатал " + hits + " " + plural(hits, "раз", "раза", "раз") + ": "
                            : "напечатал: ";
      if (printed) return { text: где + сколько + storyCut(printed, 70), body: null };
      /* Печать без текста бывает двух видов, и путать их нельзя: print()
         печатает пустую строку, а print(функция(...)) печатает результат
         вызова — только вывод в шагах достаётся не этой строке, а той,
         внутри функции, где он случился. */
      var сCall = false;
      astWalk(st.value.args || [], function(m){ if (m.type === "Call") сCall = true; });
      return { text: где + (сCall ? "напечатал результат вызова" : "напечатал пустую строку"),
               body: null };
    }
    if (имя)
      return { text: где + "вызвал «" + имя + "» (" + storyTimes(hits) + ")" +
                     (printed ? ", напечаталось: " + storyCut(printed, 40) : ""), body: null };
    return null;
  }
  if (st.type === "Pass" || st.type === "Break" || st.type === "Continue") return null;
  /* Незнакомый оператор: лучше сказать честно «что-то сделал», чем выдумать. */
  if (printed) return { text: где + "напечатал: " + storyCut(printed, 70), body: null };
  if (note) return { text: где + storyCut(note), body: null };
  return null;
}

function storyLines(body, facts, depth, out){
  if (!body || depth > STORY_MAX_DEPTH) return out;
  for (var i = 0; i < body.length && out.length < STORY_MAX_LINES; i++){
    var one = storyOne(body[i], facts, depth);
    if (!one) continue;
    out.push({ text: one.text, depth: depth });
    if (one.body) storyLines(one.body, facts, depth + 1, out);
  }
  return out;
}

/* Пересказ целиком. Возвращает { lines, error, empty } либо null, если
   программа даже не разбирается. */
function storyOf(code, env){
  var eng = Runtime.get("mini");
  var ast;
  try { ast = window.MiniPy.parse(String(code || "")); }
  catch(e){ if (!e.pyKind) throw e; return null; }
  var facts = stepFacts(eng, code, env || {}, WATCH_MAX_STEPS);
  if (!facts) return null;
  var lines = storyLines(ast.body, facts, 0, []);
  return { lines: lines, error: facts.error, truncated: facts.truncated };
}
function storyHTML(code, env){
  var st = storyOf(code, env);
  if (!st) return "";
  if (!st.lines.length && !st.error) return "";
  var h = '<div class="story"><div class="storyhead">📖 Что программа сделала — словами</div>' +
    '<ol class="storylist">' +
    st.lines.map(function(x){
      return '<li class="d' + Math.min(2, x.depth) + '">' + esc(x.text) + '</li>';
    }).join("") + '</ol>';
  if (st.error)
    h += '<p class="storyerr">…и на этом остановилась: ' +
         esc((KIND_RU[st.error.kind] || st.error.kind) +
             (st.error.line ? " (строка " + st.error.line + ")" : "")) + '.</p>';
  h += '<p class="storynote">Это пересказ того, что программа <b>сделала</b> на этом запуске, ' +
       'а не того, что задумано. Если фразы расходятся с твоим замыслом — вот и ошибка.</p></div>';
  return h;
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
    code: 'matrix = [[1, 2], [3, 4]]\nrow = matrix[0]\nrow.append(99)\n\nprint(matrix)\n' },
  /* Два примера с функциями. Раньше их тут не было вообще, и стек вызовов
     показать было не на чем. Первый — про то, что «ш» в программе и «ш»
     в функции это РАЗНЫЕ переменные с одним именем: плоский список их сливал,
     а кадры показывают обе. Второй — рекурсия: коробок становится столько,
     сколько вызовов, и видно, что ни один не закончился, пока не дошли до дна. */
  { title: "Функция: свои переменные",
    code: 'def площадь(ш, в):\n    итог = ш * в\n    return итог\n\n\nвсего = 0\nfor ш, в in [(3, 4), (5, 2)]:\n    всего = всего + площадь(ш, в)\n\nprint(всего)\n' },
  { title: "Рекурсия: стек вызовов",
    code: 'def факториал(n):\n    if n <= 1:\n        return 1\n    return n * факториал(n - 1)\n\n\nprint(факториал(4))\n' }
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
   кадр (done) — итоговое состояние после конца программы.

   opts — то же окружение, что у обычного прогона: ответы для input(), файлы
   на диске, подключённые модули. Раньше его тут не было вообще (стоял пустой
   объект), потому что разбирали только свои примеры. Теперь на разбор уезжает
   код С УРОКА, а урок может спрашивать input() — без ответов такая программа
   падала бы на первой же строке, и виноват был бы визуализатор. */
function vizRecord(code, opts){
  var MP = window.MiniPy, st;
  try { st = MP.stepper(code, opts || {}); }
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
      var last = frames.length ? frames[frames.length - 1] : { vars: [], scopes: [], objects: {} };
      frames.push({ line: s.error.line, output: s.output, vars: last.vars,
                    scopes: last.scopes, objects: last.objects, error: s.error });
      error = s.error; break;
    }
    if (s.done){
      var h = MP.heapSnapshot(st.interp.global, idMap, skip, []);
      frames.push({ line: 0, output: s.output, vars: h.vars, scopes: h.scopes, objects: h.objects, done: true });
      break;
    }
    var hs = MP.heapSnapshot(s.env, idMap, skip, s.stack || []);
    frames.push({ line: s.line, output: s.output, vars: hs.vars, scopes: hs.scopes, objects: hs.objects });
    if (++guard >= VIZ_MAX_FRAMES){ truncated = true; break; }
  }
  return { frames: frames, error: error, truncated: truncated };
}

/* ===== что изменилось на этом шаге =====
   Ползунок показывал состояние, но не изменение: ребёнок листал кадры и сам
   искал глазами, что стало другим. На словаре из восьми ключей это работа
   поиска отличий, а не понимания. Поэтому сравниваем предыдущий кадр с
   текущим и делаем две вещи: подсвечиваем изменённое в разметке и говорим
   фразой, что произошло.

   Возвращаем { text, vars, cells, objs, scopes }:
     text   — фраза для полоски над памятью (или пустая строка);
     vars   — { "кадр:имя": "new"|"chg" };
     cells  — { "идОбъекта:номерИлиКлюч": "new"|"chg" };
     objs   — { "идОбъекта": "new" };
     scopes — { номерКадра: "new" } — кадр вызова, появившийся на этом шаге.
   Ключи строковые, потому что и номера, и ключи словаря приходят как текст. */
function vizSame(a, b){ return JSON.stringify(a) === JSON.stringify(b); }

function vizVarMap(scope){
  var m = {};
  (scope && scope.vars || []).forEach(function(v){ m[v.name] = v.cell; });
  return m;
}

/* Короткая запись значения для фразы: ссылку на список показываем словом,
   а не «→o3» — ребёнку нужен смысл, а не наш внутренний номер. */
function vizShort(cell, objects){
  if (!cell) return "";
  if (cell.t !== "ref") return cell.text;
  var o = objects && objects[cell.id];
  if (!o) return "объект";
  if (o.kind === "dict")
    return "{" + o.pairs.map(function(p){ return p.key + ": " + vizShort(p.val, objects); }).join(", ") + "}";
  var inner = (o.items || []).map(function(x){ return vizShort(x, objects); }).join(", ");
  return o.kind === "list" ? "[" + inner + "]" : o.kind === "tuple" ? "(" + inner + ")" : "{" + inner + "}";
}

function vizDiff(prev, cur){
  var out = { text: "", vars: {}, cells: {}, objs: {}, scopes: {} };
  if (!prev || !cur) return out;
  var say = [];

  var ps = prev.scopes || [], cs = cur.scopes || [];

  /* вошли в функцию или вышли из неё — это самое крупное событие шага.
     Про вход говорим сразу С АРГУМЕНТАМИ: «вызвана факториал(n = 3)». Без них
     на рекурсии все шаги выглядят одинаково, а вся суть как раз в том, с каким
     числом позвали на этот раз. */
  if (cs.length > ps.length){
    for (var k = ps.length; k < cs.length; k++) out.scopes[k] = "new";
    var entered = cs[cs.length - 1];
    var args = (entered.vars || []).map(function(v){
      return esc(v.name) + " = " + esc(vizShort(v.cell, cur.objects));
    }).join(", ");
    say.push("вызвана функция <b>" + esc(entered.name || "?") + "(" + args + ")</b>");
  } else if (cs.length < ps.length){
    /* Обратный путь рекурсии наш шагомер не показывает по одному: он выдаёт
       шаг на КАЖДУЮ СТРОКУ, а возвраты из вложенных вызовов случаются внутри
       одного выражения n * факториал(n - 1). Поэтому стек сворачивается сразу
       на несколько кадров — и честнее сказать сколько, чем назвать один. */
    var popped = ps.slice(cs.length).map(function(f){ return f.name || "?"; });
    say.push(popped.length === 1
      ? "функция <b>" + esc(popped[0]) + "</b> закончила работу"
      : "закончились сразу " + popped.length + " вызова <b>" + esc(popped[popped.length - 1]) + "</b> — " +
        "обратный путь рекурсии проходит внутри одного выражения, отдельного шага на него нет");
  }

  /* переменные: по кадрам, а не в одну свалку — иначе местная переменная
     функции и внешняя с тем же именем сливаются в одно «изменение».
     Кадры, появившиеся на этом шаге, целиком новые — их переменные помечаем,
     но словами не перечисляем: про них уже сказано в строке вызова. */
  for (var si = 0; si < cs.length; si++){
    var fresh = si >= ps.length;
    var before = fresh ? {} : vizVarMap(ps[si]);
    var after = vizVarMap(cs[si]);
    Object.keys(after).forEach(function(name){
      var key = si + ":" + name;
      if (before[name] === undefined){
        out.vars[key] = "new";
        if (!fresh && say.length < 3) say.push("появилась переменная <b>" + esc(name) + "</b> = " +
          esc(vizShort(after[name], cur.objects)));
      } else if (!vizSame(before[name], after[name])){
        out.vars[key] = "chg";
        if (say.length < 3) say.push("<b>" + esc(name) + "</b>: " +
          esc(vizShort(before[name], prev.objects)) + " → " + esc(vizShort(after[name], cur.objects)));
      }
    });
  }

  /* куча: новые коробки и изменившиеся ячейки внутри старых */
  Object.keys(cur.objects).forEach(function(id){
    var a = prev.objects[id], b = cur.objects[id];
    if (!a){ out.objs[id] = "new"; return; }
    if (b.kind === "dict"){
      var wasByKey = {};
      a.pairs.forEach(function(p){ wasByKey[p.key] = p.val; });
      b.pairs.forEach(function(p){
        if (wasByKey[p.key] === undefined){
          out.cells[id + ":" + p.key] = "new";
          if (say.length < 3) say.push("в словарь добавился ключ <b>" + esc(p.key) + "</b>");
        } else if (!vizSame(wasByKey[p.key], p.val)){
          out.cells[id + ":" + p.key] = "chg";
          if (say.length < 3) say.push("по ключу <b>" + esc(p.key) + "</b> стало " +
            esc(vizShort(p.val, cur.objects)));
        }
      });
    } else {
      (b.items || []).forEach(function(it, ix){
        var was = (a.items || [])[ix];
        if (was === undefined){
          out.cells[id + ":" + ix] = "new";
          if (say.length < 3) say.push("добавился элемент <b>" + esc(vizShort(it, cur.objects)) + "</b>");
        } else if (!vizSame(was, it)){
          out.cells[id + ":" + ix] = "chg";
          if (say.length < 3) say.push("элемент " + ix + " стал <b>" + esc(vizShort(it, cur.objects)) + "</b>");
        }
      });
    }
  });

  /* напечатанное — тоже изменение, и часто единственное на шаге */
  if (cur.output !== prev.output){
    var add = String(cur.output).slice(String(prev.output).length).replace(/\n+$/, "");
    if (add !== "" && say.length < 3) say.push("напечатано: <b>" + esc(add.split("\n").join(" ⏎ ")) + "</b>");
  }

  out.text = say.join(", ");
  return out;
}

/* значение ячейки: скаляр или стрелка-ссылка на объект */
function vizCellHTML(cell){
  if (cell.t === "ref"){
    var c = vizColor(cell.id);
    return '<span class="vref" data-ref="' + cell.id + '" style="color:' + c + ';border-color:' + c + '">→</span>';
  }
  return '<span class="vval">' + esc(cell.text) + '</span>';
}
/* mk — метка изменения ("new" | "chg" | undefined). Класс на самой ячейке,
   а не на всей коробке: в словаре из восьми ключей важно, какой именно из них
   поменялся, иначе подсветка не помогает, а мешает. */
function vizMark(mk){ return mk ? " " + (mk === "new" ? "vzn" : "vzc") : ""; }

function vizObjHTML(obj, names, marks){
  var c = vizColor(obj.id);
  var cells = (marks && marks.cells) || {};
  var head = '<div class="vohead" style="color:' + c + '">' + vizKind(obj.kind) +
    (names && names.length ? ' <span class="vonames">' + names.map(esc).join(", ") + '</span>' : '') + '</div>';
  var body;
  if (obj.kind === "dict"){
    body = obj.pairs.length
      ? obj.pairs.map(function(p){
          return '<div class="vopair' + vizMark(cells[obj.id + ":" + p.key]) + '">' +
                 '<span class="vokey">' + esc(p.key) + '</span>' +
                 '<span class="vosep">:</span>' + vizCellHTML(p.val) + '</div>';
        }).join("")
      : '<span class="voempty">пусто</span>';
    body = '<div class="vodict">' + body + '</div>';
  } else {
    var withIdx = obj.kind === "list" || obj.kind === "tuple";
    body = obj.items.length
      ? obj.items.map(function(it, i){
          return '<div class="vocell' + vizMark(cells[obj.id + ":" + i]) + '">' +
                 (withIdx ? '<span class="voidx">' + i + '</span>' : '') +
                 '<span class="voval">' + vizCellHTML(it) + '</span></div>';
        }).join("")
      : '<span class="voempty">пусто</span>';
    body = '<div class="vocells">' + body + '</div>';
  }
  var objMark = marks && marks.objs && marks.objs[obj.id] ? " vzn" : "";
  return '<div class="vizobj' + objMark + '" data-id="' + obj.id + '" style="border-color:' + c + '">' + head + body + '</div>';
}

/* Один кадр стека: имя функции (или «главная программа») и её переменные.
   Кадр функции рисуется отдельной коробкой поверх программы — так видно, что
   местная переменная живёт не там же, где внешняя, даже если имя одно. */
function vizScopeHTML(scope, si, marks){
  var vm = (marks && marks.vars) || {};
  var rows = scope.vars.length
    ? scope.vars.map(function(v){
        return '<div class="vizvar' + vizMark(vm[si + ":" + v.name]) + '"><b>' + esc(v.name) + '</b>' +
               '<span class="veq">=</span>' + vizCellHTML(v.cell) + '</div>';
      }).join("")
    : '<div class="vizempty">переменных пока нет</div>';
  var isCall = si > 0;
  var fresh = marks && marks.scopes && marks.scopes[si] ? " vzn" : "";
  /* Имя функции НЕ переводим в верхний регистр (в отличие от подписи «главная
     программа»): в Python имена регистрозависимы, и «ПЛОЩАДЬ» — это другое имя.
     Подпись не должна врать про код. */
  var title = isCall
    ? '⤷ <span class="vsfn">' + esc(scope.name || "?") + '()</span>'
    : "главная программа";
  return '<div class="vizscope' + (isCall ? " call" : "") + fresh + '">' +
         '<div class="vsname">' + title + '</div>' + rows + '</div>';
}

function vizMemoryHTML(frame, marks){
  var namesByObj = {};
  frame.vars.forEach(function(v){
    if (v.cell.t === "ref") (namesByObj[v.cell.id] = namesByObj[v.cell.id] || []).push(v.name);
  });
  /* Пока программа не заходила в функции, кадр один — рисуем как раньше,
     без лишней рамки и заголовка: чрома не должно быть больше, чем данных. */
  var scopes = frame.scopes && frame.scopes.length ? frame.scopes : null;
  var varsHTML;
  if (!scopes || scopes.length === 1){
    var only = scopes ? scopes[0] : { vars: frame.vars };
    var vm = (marks && marks.vars) || {};
    varsHTML = only.vars.length
      ? only.vars.map(function(v){
          return '<div class="vizvar' + vizMark(vm["0:" + v.name]) + '"><b>' + esc(v.name) + '</b>' +
                 '<span class="veq">=</span>' + vizCellHTML(v.cell) + '</div>';
        }).join("")
      : '<div class="vizempty">переменных пока нет</div>';
  } else {
    varsHTML = scopes.map(function(sc, si){ return vizScopeHTML(sc, si, marks); }).join("");
  }
  var ids = Object.keys(frame.objects);
  var objsHTML = ids.length
    ? ids.map(function(id){ return vizObjHTML(frame.objects[id], namesByObj[id], marks); }).join("")
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

/* opts (всё необязательное):
     code   — программа, которую надо разобрать (иначе первый пример);
     env    — окружение прогона: ответы для input(), файлы, модули;
     backTo — { label, go } кнопка возврата туда, откуда пришли.

   Разбор СВОЕГО кода — главное, зачем этот экран нужен на уроке: примеры
   объясняют алиасинг вообще, а ребёнку надо понять свою программу. Раньше
   уйти с урока было нельзя (написанный код терялся), поэтому визуализатор
   жил сам по себе. С черновиками (draftFlush в claimScreen) уход безопасен:
   код урока сохраняется на переходе и возвращается на место. */
function screenViz(opts){
  enterScreen("train", "viz");
  session = { id:null, attempts:0, hints:0, shown:false };
  opts = opts || {};
  var mine = !!opts.code;
  var h = '<div class="lvlhead"><div><div class="idx">' +
    (mine ? "разбор твоей программы" : "загляни внутрь программы") +
    '</div><h1>🔍 Визуализатор</h1></div></div>' +
    '<p class="lede">' + (mine
      ? 'Это код из редактора урока — тот самый, что ты сейчас пишешь. Иди по шагам и смотри, что происходит в памяти: ' +
        'переменные, списки и словари рисуются коробками, а стрелки показывают, кто на что ссылается. ' +
        'Правки здесь на урок не влияют — там код остался как был.'
      : 'Запусти программу по шагам и смотри, что происходит в памяти: переменные, списки и словари рисуются коробками, ' +
        'а стрелки показывают, кто на что ссылается. Ползунком можно отматывать вперёд и назад — как в машине времени. ' +
        'Это лучший способ понять, почему <code>b = a</code> меняет оба списка сразу.') + '</p>' +
    '<div class="vizex"><span>' + (mine ? "Или разбери пример:" : "Примеры:") + '</span> ' +
      VIZ_EXAMPLES.map(function(e, i){ return '<button class="minibtn" data-ex="' + i + '">' + esc(e.title) + '</button>'; }).join("") +
    '</div><div id="vizstudio"></div>' +
    '<div class="pager">' +
      (opts.backTo ? '<button class="bigbtn" id="vizback">' + esc(opts.backTo.label) + '</button>' : '') +
      '<button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  app.innerHTML = h;

  var ed = makeEditor(opts.code || VIZ_EXAMPLES[0].code,
                      mine ? "твой код с урока" : "программа для разбора");
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

  /* Окружение уезжает вместе с кодом урока, но живёт только пока код тот же:
     подставили пример — ответы для input() от чужой программы только помешают. */
  var env = opts.env || null;
  function go(){ vizStart(player, ed, env); }
  bar.querySelector('[data-role="viz"]').onclick = go;
  ed.querySelector("textarea").addEventListener("keydown", function(e){
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter"){ e.preventDefault(); go(); }
  });
  app.querySelectorAll("[data-ex]").forEach(function(b){
    b.onclick = function(){
      ed.setCode(VIZ_EXAMPLES[+b.getAttribute("data-ex")].code);
      env = null;
      vizStart(player, ed, env);
    };
  });
  var vb = document.getElementById("vizback");
  if (vb) vb.onclick = function(){ opts.backTo.go(); };
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
  /* Пришли с урока — сразу показываем разбор: ребёнок нажал «разобрать»,
     второе нажатие на этом экране было бы лишним шагом. */
  if (mine) go();
}

function vizStart(player, ed, env){
  vizStopPlay();                       /* прошлый прогон больше не тикает */
  var rec = vizRecord(ed.getCode(), env);
  player._story = storyHTML(ed.getCode(), env);   /* пересказ того же прогона */
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
    (player._story || '') +
    '<div class="vizwhat" style="display:none"></div>' +
    '<div class="vizstage"><div class="vizcode"></div><div class="vizmem"></div></div>' +
    '<div class="vizerr" style="display:none"></div>' +
    '<div class="pane pout"><div class="ph">вывод к этому шагу</div><div class="console"></div></div>';

  var codeEl = player.querySelector(".vizcode");
  var memEl = player.querySelector(".vizmem");
  var conEl = player.querySelector(".console");
  var errEl = player.querySelector(".vizerr");
  var whatEl = player.querySelector(".vizwhat");
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
    /* Изменение считаем относительно ПРЕДЫДУЩЕГО кадра, а не относительно
       того, откуда прыгнули ползунком: «что изменилось на этом шаге» должно
       значить одно и то же, куда бы ребёнок ни ткнул на шкале. */
    var marks = vizDiff(frames[i - 1], f);
    memEl.innerHTML = vizMemoryHTML(f, marks);
    vizDrawArrows(memEl);
    if (marks.text){
      whatEl.style.display = "";
      whatEl.innerHTML = '<span class="vwl">на этом шаге</span><span class="vwt">' + marks.text + '</span>';
    } else whatEl.style.display = "none";
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
/* tab — какая вкладка наверху должна светиться: "home" (по умолчанию),
   "train", "mine" или null, если экран не принадлежит ни одному разделу
   (профиль, регистрация, панель наставника). */
function enterScreen(tab, place){
  curTab = tab === undefined ? "home" : tab;
  /* Второе имя — для помощи «?»: вкладок три, а экранов под ними два десятка,
     и текст подсказки у них разный. Не сказали — считаем, что это «Главное». */
  curPlace = place || "home";
  stopTimer();
  vizStopPlay();
  /* Уходя с экрана — замолчать: иначе синтезатор дочитывает урок поверх
     следующего экрана, и остановить его нечем. */
  voiceStop();
  clearAdminHash();
  return claimScreen();
}

/* Урок и мир дорисовываются ПОСЛЕ загрузки файла мира, то есть асинхронно.
   Если за эти десятки миллисекунд ребёнок успел уйти на другой экран,
   запоздавшая отрисовка затирала уже показанный экран, а у урока вдобавок
   запускался счётчик времени — по уроку, который никто не открывал. Каждый
   заход на экран берёт номер, а отрисовка сверяет: номер сменился — не рисуем. */
var screenSeq = 0;
/* Через claimScreen проходит ЛЮБАЯ смена экрана: и enterScreen, и урок, и
   проект. Поэтому черновик уходящего урока сохраняется именно здесь — одним
   местом на все переходы, включая переход с урока сразу на другой урок. */
function claimScreen(){ draftFlush(); taskPinHide(); return ++screenSeq; }
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
  "#zan":     function(){ screenZan(); },
  "#adult":   function(){ screenAdult(); },
  "#games":   function(){ screenGames(); },
  "#warmup":  function(){ screenWarmups(); },
  "#today":   function(){ screenToday(); },
  "#account": function(){ screenAccount(); },
  "#viz":     function(){ screenViz(); },
  "#ai":      function(){ screenAILab(); },
  "#again":   function(){ screenReview(); },
  "#folio":   function(){ screenFolio(); },
  "#mine":    function(){ screenMyTasks(); },
  "#train":   function(){ screenTrain(); },
  "#works":   function(){ screenShowcase(); },
  "#group":   function(){ screenGroup(); },
  "#specs":   function(){ screenSpecs(); },
  "#help":    function(){ screenGuide(); },
  "#guide":   function(){ screenGuide(); }
};
function routeHash(){
  if (wantsAdmin()){ screenAdmin(); return true; }
  /* Задание из ссылки разбираем ДО приведения к нижнему регистру: base64
     различает «A» и «a», и один приведённый к нижнему регистру символ
     превратил бы работающую ссылку в «не прочиталось». */
  var packed = /^#task=(.+)$/.exec(location.hash || "");
  if (packed){
    var got = taskUnpack(packed[1]);
    if (got) openFriendTask(got, {}); else screenTaskBroken();
    return true;
  }
  /* Задание от взрослого — тем же порядком и по той же причине */
  var apk = /^#assign=(.+)$/.exec(location.hash || "");
  if (apk){
    var gota = assignUnpack(apk[1]);
    if (gota) screenAssign(gota); else screenTaskBroken();
    return true;
  }
  /* Квитанция «твою задачу решили» — обратный путь той же ссылочной механики */
  var spk = /^#solved=(.+)$/.exec(location.hash || "");
  if (spk){
    var gots = solvedUnpack(spk[1]);
    if (gots) screenSolved(gots); else screenTaskBroken();
    return true;
  }
  /* Работа по ссылке — тоже до приведения к нижнему регистру: base64
     различает «A» и «a». */
  var wpk = /^#work=(.+)$/.exec(location.hash || "");
  if (wpk){
    var gotw = workUnpack(wpk[1]);
    if (gotw) screenWork(gotw); else screenWorkBroken();
    return true;
  }
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
/* подпись ученика у наставника: только на этом устройстве, на сервер не идёт */
function adminLabel(code){
  return (S.admin && S.admin.labels && S.admin.labels[code]) || "";
}
function adminLabelSet(code, v){
  S.admin.labels = S.admin.labels || {};
  v = String(v || "").trim().slice(0, 40);
  if (v) S.admin.labels[code] = v; else delete S.admin.labels[code];
  saveLocal();
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
    '<div class="pager"><button class="bigbtn ghost" id="admback">← На главную</button></div>';
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

/* ---------- отчёт за неделю ----------
   Панель наставника показывала кучу верных чисел и ни одной фразы: чтобы
   понять, как идут дела, взрослому приходилось читать таблицу на сто строк.
   Здесь то же самое, но человеческим языком и за последние семь дней.

   Честность важнее красоты: посуточного учёта времени в прогрессе нет —
   есть только время по каждому уроку. Поэтому в дне показано время тех
   уроков, которые в этот день ПРОЙДЕНЫ, и подписано это именно так.
   Придумывать точность, которой в данных нет, нельзя. */
var WEEK_DAYS = 7;
/* ===== вопрос за ужином =====
   Взрослому не нужен отчёт из двадцати цифр — ему нужен ОДИН вопрос, который
   можно задать за столом. Причём такой, чтобы ответ показал понимание, а не
   память: «объясни своими словами и покажи на примере».

   Вопрос не написан руками сто раз, а берётся из шпаргалки: там у каждой
   записи есть `sig` (как пишется) и `what` (что делает) — и то и другое уже
   проверено тестами против настоящего python3. Берём только пройденное
   (`sheetLearned`) и только за последние дни, чтобы вопрос был про свежее.

   Выбор детерминирован по дате: за один вечер вопрос не меняется, сколько бы
   раз взрослый ни открыл панель. Тот же приём, что у задачи дня. */
function dinnerPickFrom(st, key){
  var sm = (st && st.stars) || {}, lg = (st && st.log) || {};
  var groups = (window.CHEATSHEET || []);
  /* когда какой урок пройден — по этому и решаем, что «свежее» */
  var pool = [];
  groups.forEach(function(g){
    (g.items || []).forEach(function(it){
      if (sm[it.lesson] === undefined) return;              /* урок не пройден */
      var when = (lg[it.lesson] && lg[it.lesson].solvedAt) || 0;
      pool.push({ it: it, when: when, lesson: it.lesson });
    });
  });
  if (!pool.length) return null;
  /* сначала свежее: берём последнюю треть пройденного, но не меньше пяти */
  pool.sort(function(a, b){ return b.when - a.when; });
  var take = Math.max(5, Math.round(pool.length / 3));
  var fresh = pool.slice(0, take);
  var h = 0, s = String(key || dayKey());
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return fresh[h % fresh.length];
}
function dinnerHTML(st){
  var pick = dinnerPickFrom(st, dayKey());
  if (!pick)
    return '<div class="dinner"><b>🍽 Вопрос за ужином</b>' +
      '<p>Появится, когда будет пройден первый урок: вопрос берётся из того, ' +
      'что ребёнок уже прошёл.</p></div>';
  var l = CURRICULUM.byId(pick.lesson);
  return '<div class="dinner"><b>🍽 Вопрос за ужином</b>' +
    '<p>Спроси: «что делает <code>' + esc(pick.it.sig) + '</code>?» — и попроси ' +
    'показать на примере.</p>' +
    '<p class="dim">Правильный ответ: ' + esc(pick.it.what) + '.' +
    (l ? ' Это из урока «' + esc(l.title) + '».' : '') + '</p>' +
    '<p class="dim">Если объяснит своими словами и покажет пример — понял. ' +
    'Если пересказывает формулировку — стоит вернуться к этому уроку. ' +
    'Вопрос меняется раз в день.</p></div>';
}

function weekReportHTML(st){
  var lg = st.log || {}, sm = st.stars || {};
  var covered = coveredDays(st.days, st.shields);
  var today = dayKey(), keys = [];
  for (var i = WEEK_DAYS - 1; i >= 0; i--) keys.push(shiftDay(today, -i));

  /* уроки, разложенные по дню, в который их прошли */
  var byDay = {}, weekSolved = 0, weekMs = 0;
  Object.keys(lg).forEach(function(id){
    var g = lg[id];
    if (!g || !g.solvedAt || sm[id] === undefined) return;
    var k = dayKey(new Date(g.solvedAt));
    if (keys.indexOf(k) < 0) return;
    (byDay[k] = byDay[k] || []).push({ id:id, log:g });
    weekSolved++; weekMs += g.timeMs || 0;
  });

  var studied = keys.filter(function(k){ return activeIn(st.days, k); }).length;
  var names = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

  var strip = keys.map(function(k){
    var was = activeIn(st.days, k), shield = !was && !!(st.shields && st.shields[k]);
    var n = (byDay[k] || []).length;
    var d = new Date(k + "T12:00:00");
    return '<div class="wrday' + (was ? " on" : (shield ? " shield" : "")) + (k === today ? " now" : "") + '">' +
      '<span class="wrd">' + names[d.getDay()] + '</span>' +
      '<span class="wrn">' + (was ? (n || "·") : (shield ? "🛡" : "—")) + '</span>' +
      '<span class="wrdate">' + d.getDate() + "." + (d.getMonth() + 1) + '</span></div>';
  }).join("");

  /* где буксовал: за эту же неделю, по цене решения */
  var tough = [];
  keys.forEach(function(k){
    (byDay[k] || []).forEach(function(x){
      var цена = (x.log.attempts || 0) + (x.log.hints || 0) * 2 + (x.log.shown ? 5 : 0);
      if (цена >= 4) tough.push({ id:x.id, цена:цена, log:x.log });
    });
  });
  tough.sort(function(a, b){ return b.цена - a.цена; });

  /* последнее занятие, если на неделе его не было */
  var lastDay = "";
  Object.keys(st.days || {}).forEach(function(k){ if (k > lastDay) lastDay = k; });

  var h = '<div class="card weekrep"><h3>📅 Что было за неделю</h3>';

  if (!studied && !weekSolved){
    h += '<p class="dim">За последние семь дней занятий не было. ' +
      (lastDay ? 'Последнее — ' + lastDay.split("-").reverse().join(".") + '.'
               : 'Занятий пока не было вовсе.') + '</p>';
  } else {
    h += '<p class="wrline"><b>' + studied + ' ' + plural(studied, "занятие", "занятия", "занятий") + '</b>, ' +
      '<b>' + weekSolved + ' ' + plural(weekSolved, "урок", "урока", "уроков") + '</b>' +
      (weekMs ? ', <b>' + fmtMins(weekMs) + '</b> за этими уроками' : '') + '. ' +
      'Дней подряд: <b>' + streakCurrentIn(covered) + '</b>.</p>';
  }

  h += '<div class="wrstrip">' + strip + '</div>' +
    '<p class="dim">В клетке — сколько уроков пройдено в этот день. ' +
    '«·» — занимались, но урок не закончили, 🛡 — день закрыт щитом, «—» — пропуск.</p>';

  if (tough.length){
    h += '<div class="wrtough"><b>Тяжело далось:</b><ul>' +
      tough.slice(0, 3).map(function(t){
        var l = CURRICULUM.byId(t.id);
        var причины = [];
        if (t.log.shown) причины.push("смотрел решение");
        if (t.log.hints) причины.push(t.log.hints + " " + plural(t.log.hints, "подсказка", "подсказки", "подсказок"));
        if (t.log.attempts > 2) причины.push(t.log.attempts + " " + plural(t.log.attempts, "попытка", "попытки", "попыток"));
        return '<li>' + (l ? esc(l.title) : esc(t.id)) + ' — ' + причины.join(", ") + '</li>';
      }).join("") + '</ul>' +
      '<p class="dim">Эти уроки сами вернутся к ребёнку в разделе «Повторить».</p></div>';
  } else if (weekSolved){
    h += '<p class="dim">Все уроки этой недели дались без запинок.</p>';
  }

  /* что дальше — только для своего прогресса: у чужого нет замков этого устройства */
  var next = null;
  CURRICULUM.forEach(function(w){
    if (next) return;
    var ready = worldReadyLessons(w);
    for (var i = 0; i < ready.length; i++) if (sm[ready[i].id] === undefined){ next = ready[i]; return; }
  });
  h += '<p class="wrnext">Дальше по программе: ' +
    (next ? '<b>урок ' + next.num + " · " + esc(next.title) + '</b>' : '<b>все готовые уроки пройдены</b>') + '.</p>';

  h += dinnerHTML(st);
  return h + '</div>';
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
    /* Экран группы — главный вход для наставника, а не строчка в настройках
       сервера: он сюда ходит каждую неделю, а в настройки один раз. */
    '<h3 style="margin-top:20px">👨‍🏫 Работа с группой</h3>' +
    '<p class="dim">Одна таблица на всех: кто сколько сдал за неделю, где было тяжело ' +
    'и с кем стоит поговорить. Проверять код руками не нужно — его уже проверил движок.</p>' +
    '<div class="admrow"><button class="rbtn check" data-act="togroup">Открыть группу →</button></div>' +
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

/* ================= экран группы: рабочее место наставника =================
   Приоритет C из docs/market-research.md § 5: лицензия кружку или репетитору,
   один договор — 10–30 детей. Это единственный покупатель, у которого болит
   уже сегодня и который уже платит за то, что мы делаем сами.

   Что показал замер ниши (§ 3в). Конкуренты — `cloudtext.ru`, `sokratai.ru`,
   `finch.study` — построены на том, чтобы репетитору было УДОБНЕЕ проверять
   руками: комментирование кода по фото, выделение ошибок мышкой, пересчёт
   баллов. Обещание «экономит до 6 часов в неделю» — это признание, что часы
   уходят на ручную проверку. ⚠️ Код у них не запускается ни у кого.

   Значит наше обещание не «удобнее проверять», а **проверять не надо**: вот
   что уже проверено движком, и вот на кого посмотреть в первую очередь.

   ⚠️ Три ограничения, каждое из устройства продукта:
     1. имени ребёнка на сервере НЕТ и не будет — там код и результаты.
        Человеческую подпись наставник заводит у себя (`admin.labels`), и она
        никуда не уходит. Это не неудобство, а снятое юридическое ограничение;
     2. только чтение. Наставник ничего не меняет в чужом прогрессе;
     3. ⚠️ это не табель. «На кого посмотреть» — приглашение поговорить, а не
        список отстающих: вывод делает человек, и мы не имеем права выносить
        его за него. Тот же запрет, что на карте активности.
   ============================================================ */
var GROUP_MAX = 30;         /* столько учеников тянем за раз */
var GROUP_QUIET_DAYS = 5;   /* столько дней тишины — повод посмотреть */

/* Сводка по одному ученику из его прогресса. Работает на ЛЮБОМ снимке — и на
   своём, и на чужом, — потому что ничего не берёт из S. */
function groupRow(code, st){
  st = st || {};
  var lg = st.log || {}, sm = st.stars || {};
  var today = dayKey(), keys = [];
  for (var i = WEEK_DAYS - 1; i >= 0; i--) keys.push(shiftDay(today, -i));

  var week = 0, tries = 0, lastAt = 0, tough = null;
  Object.keys(lg).forEach(function(id){
    var g = lg[id] || {};
    if (g.last && g.last > lastAt) lastAt = g.last;
    if (!g.solvedAt || sm[id] === undefined) return;
    if (keys.indexOf(dayKey(new Date(g.solvedAt))) < 0) return;
    week++;
    tries += g.attempts || 0;
    var цена = (g.attempts || 0) + (g.hints || 0) * 2 + (g.shown ? 5 : 0);
    if (цена >= 4 && (!tough || цена > tough.цена)) tough = { id:id, цена:цена, log:g };
  });

  /* проверка понимания: по закрытым занятиям, как в отчёте */
  var pred = { ok:0, all:0, mine:0 }, zan = st.zan || {};
  Object.keys(zan).forEach(function(k){
    var r = zan[k];
    if (!r || !r.end || !r.predAll) return;
    pred.ok += r.predOk || 0; pred.all += r.predAll; pred.mine += r.predMine || 0;
  });

  /* запись авторства: сколько уроков с пометкой «пришло готовым» или «вперёд» */
  var ready = 0, ahead = 0;
  Object.keys(lg).forEach(function(id){
    var t = (lg[id] || {}).tr;
    if (!t) return;
    if ((t.pasted || 0) >= AUTHOR_PASTE_MIN) ready++;
    if ((t.ahead || []).length) ahead++;
  });

  var quiet = lastAt ? Math.floor((Date.now() - lastAt) / 864e5) : 999;
  /* ⚠️ Это ПРИГЛАШЕНИЕ ПОГОВОРИТЬ, а не оценка. Поэтому каждая пометка
     называет факт, а не ставит диагноз, и ни одна не говорит «плохо». */
  var marks = [];
  if (!lastAt) marks.push({ k:"quiet", txt:"занятий ещё не было" });
  else if (quiet >= GROUP_QUIET_DAYS)
    marks.push({ k:"quiet", txt:"не занимался " + quiet + " " + plural(quiet, "день", "дня", "дней") });
  if (tough){
    var l = CURRICULUM.byId(tough.id);
    marks.push({ k:"tough", txt:"тяжело шёл урок «" + (l ? l.title : tough.id) + "»" });
  }
  if (pred.all && pred.ok < pred.all)
    marks.push({ k:"pred", txt:"вывод предсказал " + pred.ok + " из " + pred.all });
  if (ready) marks.push({ k:"ready", txt:"часть работы пришла готовой: " + ready +
    " " + plural(ready, "урок", "урока", "уроков") });
  if (ahead) marks.push({ k:"ahead", txt:"в решении непройденное: " + ahead +
    " " + plural(ahead, "урок", "урока", "уроков") });

  return { code: code, label: adminLabel(code) || "", week: week, tries: tries,
           solved: Object.keys(sm).length, lastAt: lastAt, quiet: quiet,
           pred: pred, marks: marks,
           /* Чем выше, тем раньше показать. Молчание весит больше всего:
              «не сел вовсе» — самая частая и самая дорогая из трёх подмен. */
           rank: (quiet >= GROUP_QUIET_DAYS ? 100 : 0) + marks.length * 10 - week };
}

var groupState = { rows: null, busy: false, error: "", loaded: 0, total: 0 };

function groupLoad(key){
  if (!cloudEnabled()) return Promise.reject(new Error("Сервер не настроен."));
  groupState.busy = true; groupState.error = ""; groupState.loaded = 0;
  return Cloud.list(key).then(function(r){
    var st = (r.students || []).filter(function(x){ return x && x.code && !x.broken; });
    groupState.total = Math.min(st.length, GROUP_MAX);
    var rows = [], i = 0;
    /* Тянем по одному, а не всё разом: тридцать одновременных запросов к
       функции — это тридцать холодных стартов и очередь. Медленнее, зато
       предсказуемо, и видно, сколько уже пришло. */
    function next(){
      if (i >= groupState.total) return rows;
      var code = st[i++].code;
      return Cloud.load(code).then(function(res){
        if (res && res.found && res.data) rows.push(groupRow(code, ensureShape(res.data)));
        groupState.loaded++;
        var bar = document.getElementById("grpbar");
        if (bar) bar.textContent = "Загружено " + groupState.loaded + " из " + groupState.total + "…";
        return next();
      }, function(){ groupState.loaded++; return next(); });
    }
    return next();
  }).then(function(rows){
    rows.sort(function(a, b){ return b.rank - a.rank; });
    groupState.rows = rows; groupState.busy = false;
    return rows;
  }, function(err){
    groupState.busy = false;
    groupState.error = err && err.message ? err.message : String(err);
    throw err;
  });
}

function screenGroup(){
  curPlace = "group";
  stopTimer(); vizStopPlay();
  if (!adminUnlocked()) return adminGate();
  var rows = groupState.rows;

  var h = '<div class="lvlhead"><div><div class="idx">рабочее место наставника</div>' +
    '<h1>👨‍🏫 Группа</h1></div><div class="right"><span class="tag">только чтение</span></div></div>' +
    '<p class="lede">Проверять код руками не нужно: всё, что здесь показано, ребёнок сделал сам, ' +
    'а проверил движок. Ваше дело — посмотреть, с кем поговорить.</p>';

  h += '<div class="card"><h3>🔑 Ключ наставника</h3>' +
    '<div class="admrow"><label class="admlbl">ключ ' +
      '<input type="password" id="grpkey" value="' + esc(adminKeySaved()) + '" autocomplete="off"></label>' +
      '<button class="rbtn check" id="grpload">Загрузить группу</button></div>' +
    '<p class="dim" id="grpbar">' + (groupState.busy
      ? "Загружено " + groupState.loaded + " из " + groupState.total + "…"
      : "Тот же ключ, что задан в настройках функции как ADMIN_KEY. Больше " +
        GROUP_MAX + " учеников за раз не тянем.") + '</p>' +
    (groupState.error ? '<div class="msg show bad"><b>Не получилось</b>' + esc(groupState.error) + '</div>' : '') +
    '</div>';

  /* ⚠️ Рамка честности стоит до цифр — как на записи авторства, и по той же
     причине: список «на кого посмотреть» без неё читается как список плохих. */
  h += '<div class="card"><h3>⚖️ Что это за таблица</h3><ul class="trrules">' +
    '<li><b>Это не табель.</b> «Посмотреть в первую очередь» — приглашение поговорить, ' +
    'а не список отстающих. Вывод делаете вы, мы его за вас не выносим.</li>' +
    '<li><b>Имён детей на сервере нет.</b> Там код и результаты. Подпись «Петя, 5 класс» ' +
    'вы ставите у себя, и она никуда не уходит — поэтому согласие родителя на обработку ' +
    'данных ребёнка вам не нужно.</li>' +
    '<li><b>Только чтение.</b> Отсюда ничего нельзя изменить в чужом прогрессе.</li>' +
    '</ul></div>';

  if (rows && rows.length){
    var weekAll = 0, triesAll = 0;
    rows.forEach(function(r){ weekAll += r.week; triesAll += r.tries; });
    h += '<div class="card"><h3>📊 За неделю</h3><ul class="trsum">' +
      '<li>Учеников: <b>' + rows.length + '</b>.</li>' +
      '<li>Уроков сдано: <b>' + weekAll + '</b>.</li>' +
      /* Число, ради которого всё и затевалось: столько раз движок прочитал
         и выполнил код вместо человека. У конкурентов это ручные часы. */
      '<li>Проверок сделал движок: <b>' + triesAll + '</b> — столько программ ' +
      'не пришлось читать глазами.</li>' +
      '</ul></div>';

    h += '<div class="card"><h3>👥 Кто как шёл</h3><div class="grouplist">';
    rows.forEach(function(r){
      /* Подпись читаем ЖИВУЮ, а не ту, что легла в строку при загрузке:
         наставник подписывает учеников уже после того, как группа пришла с
         сервера, и кэшированное имя показывало бы старое. */
      var lbl = adminLabel(r.code) || "";
      h += '<div class="grouprow' + (r.marks.length ? "" : " ok") + '">' +
        '<div class="grphead"><b>' + esc(lbl || r.code) + '</b>' +
        '<span class="dim">' + (lbl ? esc(r.code) + " · " : "") +
        'за неделю ' + r.week + ' · всего ' + r.solved + ' · ' +
        (r.lastAt ? fmtWhen(r.lastAt) : "занятий не было") + '</span></div>' +
        (r.marks.length
          ? '<ul class="trmarks">' + r.marks.map(function(m){
              return '<li class="' + m.k + '">' + esc(m.txt) + '</li>';
            }).join("") + '</ul>'
          : '<p class="dim">Шёл ровно: сам, без подсказок и без пауз.</p>') +
        '<div class="partbar">' +
        '<button class="rbtn check" data-gview="' + esc(r.code) + '">Открыть прогресс</button>' +
        '<button class="rbtn sec" data-glabel="' + esc(r.code) + '">Подписать</button></div></div>';
    });
    h += '</div></div>';
  } else if (!groupState.busy){
    h += '<div class="card"><h3>Группа не загружена</h3>' +
      '<p class="dim">Введите ключ наставника и нажмите «Загрузить группу». ' +
      'Если сервер не настроен, сначала пройдите настройку в панели наставника.</p></div>';
  }

  h += '<div class="pager"><button class="bigbtn ghost" data-gback="1">← В панель наставника</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" data-ghome="1">На главную</button></div>';

  app.innerHTML = h;
  var lb = document.getElementById("grpload");
  if (lb) lb.onclick = function(){
    var key = (document.getElementById("grpkey").value || "").trim();
    if (!key){ groupState.error = "Нужен ключ наставника."; return screenGroup(); }
    adminKeyRemember(key);
    groupState.busy = true; groupState.error = ""; screenGroup();
    groupLoad(key).then(screenGroup, screenGroup);
  };
  app.querySelectorAll("[data-gview]").forEach(function(b){
    b.onclick = function(){
      var code = b.getAttribute("data-gview");
      Cloud.load(code).then(function(r){
        if (!r.found || !r.data) return;
        viewState = { code: code, data: r.data, serverAt: r.serverAt || 0 };
        screenAdmin();
      }, function(){});
    };
  });
  app.querySelectorAll("[data-glabel]").forEach(function(b){
    b.onclick = function(){
      var code = b.getAttribute("data-glabel"), row = b.parentNode;
      if (row.querySelector(".lblin")) return;
      var inp = document.createElement("input");
      inp.className = "lblin";
      inp.value = adminLabel(code) || "";
      inp.placeholder = "Петя, 5 класс";
      row.appendChild(inp);
      inp.focus();
      inp.onkeydown = function(e){
        if (e.key !== "Enter") return;
        adminLabelSet(code, inp.value);
        if (groupState.rows) groupState.rows.forEach(function(r){
          if (r.code === code) r.label = adminLabel(code) || "";
        });
        screenGroup();
      };
    };
  });
  app.querySelectorAll("[data-gback]").forEach(function(b){
    b.onclick = function(){ location.hash = "#admin"; screenAdmin(); };
  });
  app.querySelectorAll("[data-ghome]").forEach(function(b){ b.onclick = screenWorlds; });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function screenAdmin(){
  /* без clearAdminHash: этот экран как раз открывается по #admin */
  curPlace = "admin";
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
    h += weekReportHTML(viewState.data);
    h += lessonTableHTML(viewState.data, false);
    h += '<div class="pager"><button class="bigbtn ghost" data-act="myown">← Свой прогресс</button>' +
      '<span class="sp"></span><button class="bigbtn ghost" data-act="tomap">На главную</button></div>';
  } else {
    /* ---------- обычный режим ---------- */
    h += '<div class="lvlhead"><div><div class="idx">служебный экран</div>' +
      '<h1>🔐 Панель наставника</h1></div><div class="right"><span class="tag">код принят</span></div></div>' +
      '<p class="lede">' + (cloudEnabled()
        ? 'Прогресс синхронизируется с сервером — его видно с любого устройства.'
        : 'Прогресс лежит в памяти <b>этого</b> браузера. Чтобы видеть его с другого устройства, ' +
          'подключите сервер или выгрузите файл в самом низу страницы.') + '</p>';

    h += statsGridHTML(S);
    h += weekReportHTML(S);
    h += serverCardHTML();

    h += '<div class="card"><h3>👨‍👩‍👦 Кабинет взрослого</h3>' +
      '<p class="dim">Рамка занятий, отчёт по последнему занятию, карта активности по дням и часам ' +
      'и «задать задание ребёнку». Это то, что взрослый смотрит десять минут в неделю, ' +
      'а не служебная панель.</p><div class="admrow">' +
      '<button class="rbtn check" data-act="toadult">Открыть кабинет →</button></div></div>';

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

    h += '<div class="pager"><button class="bigbtn ghost" data-act="tomap">← На главную</button>' +
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
    else if (act === "toadult"){ location.hash = "#adult"; screenAdult(); }
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
    else if (act === "togroup"){ location.hash = ""; return screenGroup(); }
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
            /* Имени ученика на сервере НЕТ и не будет: оно не уезжает с
               устройства ребёнка (см. cloudSnapshot). Поэтому в списке стоит
               код, а человеческую подпись наставник заводит себе сам — она
               лежит в его admin.labels и никуда не отправляется. */
            var lbl = adminLabel(s.code);
            return s.broken
              ? '<div class="admlrow"><b>' + esc(s.code) + '</b><span>файл испорчен</span></div>'
              : '<div class="admlrow"><b>' + esc(lbl || s.code) + '</b>' +
                '<span>' + (lbl ? esc(s.code) + ' · ' : '') +
                s.solved + ' уроков · ' + s.stars + '★ · ' + s.xp + ' XP · ' +
                fmtMins(s.timeMs) + ' · ' + fmtWhen(s.serverAt) + '</span>' +
                '<button class="minibtn" data-act="label" data-id="' + esc(s.code) + '">подписать</button>' +
                '<button class="minibtn" data-act="viewcode" data-id="' + esc(s.code) + '">открыть</button></div>';
          }).join("") + '</div>' +
          '<p class="dim">Имени ребёнка на сервере нет намеренно: там только код и результаты. ' +
          'Подпись «Петя, 5 класс» ставится кнопкой «подписать» и остаётся на этом устройстве.</p>');
      }, function(err){ srv("bad", "<b>Не получилось</b>" + esc(err.message || err)); });
    }
    else if (act === "label"){
      /* Подпись вводится прямо в строке списка: prompt() останавливает
         страницу и не проверяется тестом. */
      var rowEl = b.parentNode;
      if (rowEl.querySelector(".lblin")) return;
      var inp = document.createElement("input");
      inp.className = "lblin";
      inp.value = adminLabel(id);
      inp.placeholder = "например, Петя, 5 класс";
      var ok = document.createElement("button");
      ok.className = "minibtn"; ok.textContent = "готово";
      ok.onclick = function(){
        adminLabelSet(id, inp.value);
        document.querySelector('[data-act="listall"]').click();
      };
      rowEl.appendChild(inp); rowEl.appendChild(ok);
      inp.focus();
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

/* ============================================================
   ПОДЕЛИТЬСЯ РАБОТОЙ
   У SoloLearn главный двигатель — сообщество: обсуждения, соревнования, обмен
   кодом. Нам чат заводить нельзя: дети, модерация, персональные данные,
   возрастная маркировка. Но сам двигатель — «смотри, что я сделал» — работает
   и без чата, если показывать не в ленте, а по ссылке.

   Механика взята готовой у «своего задания» (b64urlEnc и роут по хэшу): ничего
   не хранится на сервере, вся работа лежит В САМОЙ ССЫЛКЕ. Отсюда и свойства:
   ссылка живёт вечно, открывается у кого угодно, и при этом мы не собираем о
   ребёнке ничего нового — хранить попросту нечего.

   Имя автора кладём в ссылку по тому же правилу, что и в «своём задании»:
   без него «смотри, что я сделал» теряет смысл. Отправляет ссылку ребёнок
   сам и сам решает кому — как открытку, а не как публикацию.
   ============================================================ */
var WORK_CODE_MAX = 2000;   /* та же граница, что у задания: длиннее — не открытка */

function workPack(w){
  return b64urlEnc(JSON.stringify({ v:1, t:w.title, c:w.code, a:w.author || "" }));
}
/* Всё пришедшее снаружи считаем испорченным, пока не доказано обратное:
   ссылку могли обрезать в мессенджере или собрать руками. */
function workUnpack(s){
  var o = null;
  try { o = JSON.parse(b64urlDec(s)); } catch(e){ return null; }
  if (!o || o.v !== 1) return null;
  if (typeof o.t !== "string" || typeof o.c !== "string") return null;
  if (!o.c.trim() || o.c.length > WORK_CODE_MAX) return null;
  return { title: o.t.slice(0, 80), code: o.c,
           author: typeof o.a === "string" ? o.a.slice(0, 24) : "" };
}
function workLink(w){
  var base = "";
  try { base = location.origin + location.pathname; } catch(e){}
  return base + "#work=" + workPack(w);
}
/* Пусто, если делиться нечем: кнопки, которая выдаёт битую ссылку, быть не должно. */
function workShareHTML(code){
  if (!code || !code.trim() || code.length > WORK_CODE_MAX) return "";
  return '<button class="bigbtn ghost" id="wshare">🔗 Поделиться работой</button>';
}

/* Чужая работа: только смотреть и забрать себе в песочницу. Запускать прямо
   отсюда не даём намеренно — иначе это ещё один экран урока без урока. */
function screenWork(w){
  enterScreen("home", "work");
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">работа по ссылке</div>' +
    '<h1>' + esc(w.title) + '</h1></div></div>' +
    (w.author ? '<p class="lede">Прислал(а) <b>' + esc(w.author) + '</b>. Вот программа целиком.</p>'
              : '<p class="lede">Вот программа целиком.</p>') +
    '<div class="card"><div class="showcode"><pre><code>' + hl(w.code) + '</code></pre></div></div>' +
    '<div class="card"><h3>Хочешь так же?</h3>' +
    '<p class="dim">Можно забрать эту программу в песочницу, поменять и запустить — ' +
    'у автора она от этого не изменится.</p>' +
    '<div class="winrow"><button class="bigbtn" id="wtake">Забрать в песочницу</button>' +
    '<button class="bigbtn ghost" id="whome">Что это за тренажёр</button></div></div>';
  document.getElementById("wtake").onclick = function(){
    S.sandbox = w.code; save();
    try { history.replaceState(null, "", location.pathname + location.search); } catch(e){}
    screenSandbox();
  };
  document.getElementById("whome").onclick = function(){
    try { history.replaceState(null, "", location.pathname + location.search); } catch(e){}
    screenWorlds();
  };
  window.scrollTo({ top:0, behavior:"smooth" });
}
function screenWorkBroken(){
  enterScreen("home", "work");
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">работа по ссылке</div><h1>Ссылка не прочиталась</h1></div></div>' +
    '<p class="lede">Скорее всего, её обрезал мессенджер: длинные ссылки часто ломаются ' +
    'на переносе строки. Попроси прислать ещё раз — целиком, одним куском.</p>' +
    '<div class="winrow"><button class="bigbtn" id="whome">На главную</button></div>';
  document.getElementById("whome").onclick = screenWorlds;
}

/* ============================================================
   СКОЛЬКО ЗАЙМЁТ УРОК
   Приём, общий у Mimo, SoloLearn и Codédex: время урока названо ДО того, как
   его открыли. Работает он не на удобство, а на страх начинать — «пять минут»
   не страшно, а неизвестность страшна.

   Число не проставлено руками у ста уроков, а считается из самого урока: иначе
   оно разошлось бы с содержанием на первой же правке. Замер 03.09.2026 по всем
   ста урокам: слов в уроке от 173 до 454, медиана 272; карточек теории 3–7,
   медиана 4.

   120 слов в минуту — темп чтения подростка про себя, не взрослого. Плюс
   четыре минуты на запуск примеров и решение задачи. По курсу выходит 5–8
   минут, и это честнее, чем обещать всем «пять»: у нас уроки крупнее, чем
   у Mimo, и врать про это нельзя — первый же урок опровергнет.

   Число приблизительное намеренно, потому и «≈»: точного времени урока не
   бывает, оно зависит от ребёнка.
   ============================================================ */
function lessonWords(body){
  if (!body) return 0;
  var t = (body.lede || "") + " " +
    (body.theory || []).map(function(x){ return (x.h || "") + " " + (x.p || "") + " " + (x.note || ""); }).join(" ") +
    " " + ((body.task && body.task.goal) || "") + " " +
    (((body.task && body.task.list) || []).join(" "));
  return plainText(t).split(/\s+/).filter(Boolean).length;
}
function lessonMinutes(body){
  var w = lessonWords(body);
  if (!w) return 0;
  return Math.max(3, Math.round(w / 120 + 4));
}
function minutesTag(body){
  var m = lessonMinutes(body);
  return m ? '<span class="lmin" title="примерное время урока">\u2248' + m + '\u00a0мин</span>' : "";
}

/* ============================================================
   ПОДСКАЗКА «ПОСТАВЬ НА ДОМАШНИЙ ЭКРАН»
   Манифест и service worker были с 1.33.0, но сказать об этом ребёнку было
   некому: человек по ссылке-приглашению видел обычную вкладку браузера и
   никогда бы не догадался, что сайт ставится иконкой. Вкладку закрывают и
   забывают — это и есть самое хрупкое место привычки.

   Три случая, и ведут себя они по-разному:
     - Chrome (Android и десктоп) заранее присылает beforeinstallprompt.
       Его придерживаем и показываем НАСТОЯЩУЮ кнопку «Установить»;
     - Safari на iPhone такого события не имеет вовсе — остаётся объяснить
       словами, где «Поделиться» и «На экран Домой»;
     - уже установленное приложение не должно звать устанавливать себя ещё
       раз, поэтому display-mode проверяется до всего остального.

   Отдельно про iPhone: пуш-напоминания там работают с iOS 16.4, но ТОЛЬКО
   у приложения, поставленного на домашний экран. То есть эта подсказка — не
   украшение, а обязательный первый шаг к напоминаниям.

   «Не сейчас» помнится в localStorage, а НЕ в прогрессе ученика: установка —
   свойство устройства, а не человека. Уехав на сервер, отказ с телефона
   спрятал бы подсказку и на ноутбуке, где приложение не поставлено.
   ============================================================ */
var INSTALL_KEY = "kodokvest_installtip";
var deferredInstall = null;

function installHidden(){ try { return localStorage.getItem(INSTALL_KEY) === "off"; } catch(e){ return false; } }
function installHide(){ try { localStorage.setItem(INSTALL_KEY, "off"); } catch(e){} }

/* Уже стоит иконкой? Тогда подсказки быть не должно нигде. */
function installDone(){
  try {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    if (navigator.standalone) return true;   /* Safari на iPhone */
  } catch(e){}
  return false;
}
/* iPad с iPadOS 13+ представляется «MacIntel», отличается только тачем. */
function installIsIOS(){
  try {
    var ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1;
  } catch(e){ return false; }
}
/* В одном файле и с диска ставить нечего: там нет ни манифеста, ни sw.js. */
var INSTALL_AFTER = 3;     /* столько уроков — и предложение перестаёт быть навязчивым */
function installPossible(){
  if (window.__SINGLE_FILE__) return false;
  try { if (location.protocol === "file:") return false; } catch(e){ return false; }
  return !installDone();
}
/* ⚠️ Новичку предложение не показываем. Оно стояло ПЕРВЫМ блоком на Главном:
   первое, что видел ребёнок, зайдя в первый раз, — «адресная строка», «меню
   браузера», «добавить на главный экран». Он пришёл писать код, а не ставить
   приложение, и половина слов ему незнакома. Предлагаем после трёх уроков —
   тому, кто уже понял, зачем возвращаться. В профиле карточка есть всегда
   (там force), и это правильно: туда заходят нарочно. */
function installReady(){
  return installPossible() && Object.keys(S.stars || {}).length >= INSTALL_AFTER;
}

/* force — для карточки в профиле: там подсказка нужна и после «не сейчас». */
function installTipHTML(force){
  if (force ? !installPossible() : !installReady()) return "";
  if (!force && installHidden()) return "";
  var how = deferredInstall
    ? '<button class="bigbtn" id="instalgo">Установить</button>'
    : (installIsIOS()
        ? '<span class="instalhow">Нажми «Поделиться» внизу экрана, потом «На экран „Домой“».</span>'
        : '<span class="instalhow">В меню браузера выбери «Установить приложение» или «Добавить на главный экран».</span>');
  return '<div class="daybanner install" id="instaltip">' +
    '<b>📲 Поставь Кодоквест на домашний экран</b> ' +
    'Откроется как приложение, без адресной строки, и будет работать без интернета.' +
    '<div class="instalrow">' + how +
      (force ? '' : '<button class="bigbtn ghost" id="instalno">Не сейчас</button>') +
    '</div></div>';
}

function wireInstallTip(root){
  if (!root) return;
  var go = root.querySelector("#instalgo");
  if (go) go.onclick = function(){
    if (!deferredInstall) return;
    var e = deferredInstall;
    deferredInstall = null;      /* показать приглашение можно один раз */
    try { e.prompt(); } catch(err){}
  };
  var no = root.querySelector("#instalno");
  if (no) no.onclick = function(){
    installHide();
    var b = root.querySelector("#instaltip");
    if (b) b.remove();
  };
}

(function(){
  window.addEventListener("beforeinstallprompt", function(e){
    /* Своё приглашение вместо браузерного: браузерное появляется когда
       захочет и говорит не теми словами. */
    try { e.preventDefault(); } catch(err){}
    deferredInstall = e;
    /* Событие обычно приходит уже после отрисовки главной, поэтому баннер
       на экране надо обновить руками — иначе кнопка «Установить» появилась
       бы только на следующем заходе. */
    var b = document.getElementById("instaltip");
    if (b && b.parentNode){
      var box = document.createElement("div");
      box.innerHTML = installTipHTML(false);
      if (box.firstChild){ b.parentNode.replaceChild(box.firstChild, b); wireInstallTip(document); }
    }
  });
  window.addEventListener("appinstalled", function(){ deferredInstall = null; });
})();

/* ============================================================
   ЗВУК: короткие сигналы событий и чтение вслух
   Обе настройки — про УСТРОЙСТВО, а не про ученика, поэтому лежат в
   localStorage отдельными ключами и намеренно НЕ синхронизируются с сервером
   (ровно как тема и снятые замки): дома можно со звуком, в кружке за общим
   столом — без, и переезжать этот выбор между устройствами не должен.

   Сигналы синтезируются на лету через Web Audio, файлов нет вовсе: сто
   уроков весят 1,7 МБ вместе со всем содержанием, и класть рядом мегабайты
   mp3 ради четырёх «дзыньков» было бы дороже самой затеи. Заодно это
   переживает офлайн — синтез не ходит в сеть.

   Звук ошибки нарочно НЕ резкий и не «проигрышный»: движок объясняет
   падение словами, ошибка тут добыча, а не наказание. Наказывать звуком
   ребёнка, который только что честно запустил код, — прямой вред.

   Про чтение вслух две разные вещи, их легко перепутать:
     - кнопка 🔊 на карточке читает по нажатию ВСЕГДА (пока браузер умеет);
     - переключатель в профиле включает только АВТОМАТИЧЕСКОЕ чтение
       (объяснение ошибки читается само).
   Сделано так ради находимости: кнопка, которая молчит, пока не найдёшь
   настройку, хуже лишней кнопки.
   ============================================================ */
var SFX_KEY = "kodokvest_sfx", VOICE_KEY = "kodokvest_voice";

function sfxOn(){ try { return localStorage.getItem(SFX_KEY) !== "off"; } catch(e){ return true; } }
function sfxSet(on){ try { localStorage.setItem(SFX_KEY, on ? "on" : "off"); } catch(e){} }

/* Голос есть не везде: в jsdom его нет вовсе, в части браузеров тоже.
   Поэтому проверяем, а не надеемся, — иначе падал бы рендер урока. */
function voiceSupported(){
  try { return ("speechSynthesis" in window) && typeof window.SpeechSynthesisUtterance === "function"; }
  catch(e){ return false; }
}
function voiceAuto(){ try { return localStorage.getItem(VOICE_KEY) === "on"; } catch(e){ return false; } }
function voiceAutoSet(on){
  try { localStorage.setItem(VOICE_KEY, on ? "on" : "off"); } catch(e){}
  if (!on) voiceStop();
}

/* Контекст заводится один на страницу и только по первому событию: браузеры
   запрещают звук до того, как человек что-нибудь нажал, и созданный раньше
   времени контекст остался бы навсегда «suspended». false — «не умеем». */
var _actx = null;
function audioCtx(){
  if (_actx !== null) return _actx;
  var C = window.AudioContext || window.webkitAudioContext;
  if (!C){ _actx = false; return false; }
  try { _actx = new C(); } catch(e){ _actx = false; }
  return _actx;
}

/* [частота, задержка от начала, длительность] — в секундах */
var SFX = {
  win:   [[523,0,.12],[659,.10,.12],[784,.20,.24]],
  win3:  [[523,0,.10],[659,.09,.10],[784,.18,.10],[1047,.27,.32]],
  badge: [[880,0,.09],[1175,.08,.09],[1568,.16,.26]],
  bad:   [[300,0,.13],[233,.12,.20]]
};
function sfx(name){
  if (!sfxOn()) return;
  var notes = SFX[name];
  if (!notes) return;
  var ctx = audioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended" && ctx.resume) ctx.resume().catch(function(){});
    var t0 = ctx.currentTime;
    notes.forEach(function(n){
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = n[0];
      var s = t0 + n[1], e = s + n[2];
      /* Резкий старт и обрыв дают щелчок громче самой ноты — отсюда
         огибающая. exponentialRamp не умеет в ноль, потому 0.0001. */
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.09, s + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, e);
      o.connect(g); g.connect(ctx.destination);
      o.start(s); o.stop(e + 0.02);
    });
  } catch(e){}
}

/* Текст карточек — с разметкой (<code>, <b>), а вслух её читать нельзя.
   Через textContent, а не регуляркой: сущности вроде &lt; тоже разворачиваются. */
function plainText(html){
  try {
    var d = document.createElement("div");
    d.innerHTML = String(html == null ? "" : html);
    return (d.textContent || d.innerText || "").replace(/\s+/g, " ").trim();
  } catch(e){ return ""; }
}

function speak(text){
  if (!voiceSupported()) return;
  text = plainText(text);
  if (!text) return;
  try {
    /* Прошлую фразу обрываем: две реплики разом — каша, а очередь
       синтезатора живёт дольше экрана, с которого её попросили. */
    speechSynthesis.cancel();
    var u = new window.SpeechSynthesisUtterance(text.slice(0, 600));
    u.lang = "ru-RU"; u.rate = 0.95;
    speechSynthesis.speak(u);
  } catch(e){}
}
function voiceStop(){
  if (!voiceSupported()) return;
  try { speechSynthesis.cancel(); } catch(e){}
}
/* Читает само — только если включено в профиле (ошибки на уроке). */
function speakAuto(text){ if (voiceAuto()) speak(text); }

/* Пусто там, где браузер не умеет говорить: мёртвая кнопка хуже её отсутствия. */
function sayBtnHTML(key){
  if (!voiceSupported()) return "";
  return '<button class="saybtn" type="button" data-say="' + key +
         '" title="Прочитать вслух" aria-label="Прочитать вслух">🔊</button>';
}
/* Общая проводка кнопок 🔊: тексты собраны при отрисовке экрана. */
function wireSay(root, texts){
  if (!root || !texts) return;
  root.querySelectorAll("[data-say]").forEach(function(b){
    b.onclick = function(){ speak(texts[b.getAttribute("data-say")]); };
  });
}

/* ============================================================
   ОФОРМЛЕНИЕ: светлая тема и тёмная
   Тема — настройка УСТРОЙСТВА, а не результат ученика, поэтому лежит в
   localStorage отдельным ключом и намеренно НЕ синхронизируется с сервером
   (ровно как снятые замки): на телефоне может быть светлая, на ноутбуке
   тёмная. Ставится тема ещё в <head>, до первой отрисовки, — иначе у того,
   кто выбрал тёмную, мелькал бы светлый фон.
   ============================================================ */
var THEME_KEY = "kodokvest_theme";
function themeGet(){
  try {
    var t = localStorage.getItem(THEME_KEY);
    return (t === "dark" || t === "light") ? t : "light";
  } catch(e){ return document.documentElement.getAttribute("data-theme") || "light"; }
}
function themeSet(t){
  if (t !== "dark") t = "light";
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem(THEME_KEY, t); } catch(e){}
  /* Цвет строки браузера на телефоне: без него шапка системы остаётся
     тёмной над светлой страницей и выглядит как чужой кусок. */
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", t === "dark" ? "#0d1020" : "#f1f4fc");
  /* Черепашка и графики нарисованы на canvas по цветам темы — их надо
     перерисовать руками, стилями холст не перекрасить. */
  document.querySelectorAll("canvas.stage").forEach(function(c){
    if (c._lastTurtle) drawTurtle(c, c._lastTurtle);
  });
  if (helpIsOpen()) helpRender();
}

/* ============================================================
   ПОМОЩЬ «?»: что это за экран и что тут делать
   Один ответ на один вопрос, который у ребёнка возникает чаще всего и
   раньше не имел адреса вообще. Текст меняется вместе с экраном: на уроке
   он про урок, в визуализаторе — про визуализатор.

   Почему всплывающим окном, а не отдельной страницей: помощь чаще всего
   нужна ПОСРЕДИ дела, а уход с урока стёр бы написанный код. По той же
   причине поверх страницы живут шпаргалка и сертификат.
   ============================================================ */
/* Где мы сейчас — для помощи. Вкладка (curTab) для этого не годится: под
   «Тренировками» лежат пять разных экранов, и помощь у них разная. */
var curPlace = "home";

var HELP = {
  home: { t:"🏠 Главное — с чего начать", h:
    '<h4>Что это за экран</h4>' +
    '<p>Отсюда начинается всё. Сверху написано, <b>что делать прямо сейчас</b>, ' +
    'ниже — сто уроков по порядку, ещё ниже — тренировки и твои работы.</p>' +
    '<h4>Что делать</h4>' +
    '<ol><li>Жми большую кнопку <b>«Начать»</b> или <b>«Продолжить»</b> — она сама откроет ' +
    'тот урок, до которого ты дошёл.</li>' +
    '<li>Не помнишь, где было нужное слово, — впиши его в <b>поиск урока</b> в блоке «Уроки».</li>' +
    '<li>Устал от уроков — загляни в <b>«Тренировки»</b>: там игры и короткие упражнения.</li></ol>' +
    '<h4>Хитрость</h4>' +
    '<p>Кнопка <b>🔥 Сегодня</b> наверху считает дни подряд. Один урок или одна разминка ' +
    'в день — и серия не оборвётся.</p>' },

  world: { t:"🗺 Мир — двадцать уроков подряд", h:
    '<h4>Что это за экран</h4>' +
    '<p>Один мир — это двадцать уроков на одну большую тему. Они открываются ' +
    '<b>по очереди</b>: сдал урок — открылся следующий. Замо́к значит «сюда ещё рано», ' +
    'а не «сюда нельзя навсегда».</p>' +
    '<h4>Что делать</h4>' +
    '<ul><li>Жми первый урок без замка.</li>' +
    '<li>Пройденные уроки можно открывать сколько угодно раз — звёзды не отнимутся.</li>' +
    '<li>Последний урок мира — <b>босс</b>, а за ним проект и сертификат.</li></ul>' },

  lesson: { t:"📘 Урок — как он устроен", h:
    '<h4>Урок читается сверху вниз</h4>' +
    '<ol><li><b>Примеры.</b> У каждого есть «▶ Запустить пример» — код сработает прямо тут, ' +
    'а «→ В редактор» перенесёт его вниз, чтобы поменять и попробовать своё.</li>' +
    '<li><b>Задача</b> в рамке «🎯 Твоя задача» — списком требований.</li>' +
    '<li><b>Редактор</b>: пишешь код и жмёшь «▶ Запустить». Видно, что программа напечатала, ' +
    'а рядом со строками — что каждая сделала.</li>' +
    '<li><b>«✓ Проверить»</b> засчитывает урок. Если что-то не так — покажет, чем твой ответ ' +
    'отличается от нужного.</li></ol>' +
    '<h4>Не получается</h4>' +
    '<p><b>💡 Подсказка</b> под редактором — это не стыдно: она стоит одну звезду, и всё. ' +
    '<b>⏭ Шаг</b> проходит программу по строчкам, чтобы увидеть, где она свернула не туда, ' +
    'а <b>🔍 Разобрать</b> показывает то же самое в визуализаторе — с памятью и стрелками. ' +
    '<b>🧹 Ревью кода</b> говорит, что можно сделать чище, и звёзд не отнимает.</p>' +
    '<h4>Кнопки клавиатуры</h4>' +
    '<div class="keylist">' +
    '<div class="keyrow"><kbd>Ctrl</kbd>+<kbd>Enter</kbd><span>запустить код</span></div>' +
    '<div class="keyrow"><kbd>Tab</kbd><span>отступ в четыре пробела</span></div>' +
    '<div class="keyrow"><kbd>Enter</kbd><span>отступ подставится сам после двоеточия</span></div>' +
    '<div class="keyrow"><kbd>Esc</kbd><span>закрыть окно поверх страницы</span></div></div>' +
    '<p>Написанное <b>не пропадает</b>: уйдёшь с урока и вернёшься — код будет на месте.</p>' },

  train: { t:"🎯 Тренировки — зачем они", h:
    '<h4>Что это за экран</h4>' +
    '<p>Всё, что <b>вне сотни уроков</b>. Звёзд тут не дают и по порядку проходить не надо — ' +
    'заходят по настроению. Но день занятий засчитывается и здесь, так что серия не оборвётся.</p>' +
    '<h4>Что выбрать</h4>' +
    '<ul><li><b>Разминка</b> — пять минут, когда нет сил на урок.</li>' +
    '<li><b>Игры</b> — то же самое, но играя.</li>' +
    '<li><b>Ты и ИИ</b> — как разговаривать с нейросетью и как ловить её враньё.</li>' +
    '<li><b>Песочница</b> — чистый лист: пиши что хочешь, никто не проверяет.</li>' +
    '<li><b>Визуализатор</b> — показывает, что происходит в памяти, когда программа работает.</li></ul>' },

  sand: { t:"🧪 Песочница — чистый лист", h:
    '<h4>Что это за экран</h4>' +
    '<p>Пустой редактор без задачи и без проверки. Тут ничего нельзя сломать и ничего ' +
    'не засчитывается — можно пробовать что угодно.</p>' +
    '<h4>Что делать</h4>' +
    '<ul><li>Скопируй сюда код из урока и поменяй одну строчку — посмотри, что изменится.</li>' +
    '<li><b>Ctrl+Enter</b> — запустить, не тянясь к мышке.</li>' +
    '<li>Не понял, почему вышло именно так, — жми <b>«🔍 Разобрать»</b> рядом с «Запустить»: ' +
    'программа откроется в визуализаторе по шагам.</li>' +
    '<li><b>«🖼 Сохранить рисунок в галерею»</b> под холстом — рисунок уедет в «Моё».</li></ul>' },

  games: { t:"🎮 Игры", h:
    '<h4>Что это за экран</h4>' +
    '<p>Пять маленьких игр, и у каждой <b>виден код</b>. Можно просто играть, а можно ' +
    'залезть внутрь и поменять правила. Звёзд не дают, день занятий засчитывают.</p>' +
    '<p>Ходы делаются не кодом: жмёшь «▶ Новая игра», а дальше пишешь ходы в поле под игрой.</p>' },

  game: { t:"🎮 Игра — что нажимать", h:
    '<h4>Как играть</h4>' +
    '<ul><li>Жми <b>«▶ Новая игра»</b> — партия начнётся.</li>' +
    '<li>Ходы пишутся в <b>поле под игрой</b>, каждый ход — клавишей Enter.</li>' +
    '<li>Слева код самой игры. Поменяй его и снова жми «Новая игра» — ' +
    'будешь играть свою версию. «↩ Вернуть оригинал» отменит правки.</li>' +
    '<li>Проиграл — ничего не теряешь, начинай заново.</li></ul>' },

  today: { t:"🔥 Сегодня — дни подряд", h:
    '<h4>Что это за экран</h4>' +
    '<p>Считает, сколько дней подряд ты занимался. Любое дело засчитывает день: урок, ' +
    'разминка, игра, проект.</p>' +
    '<h4>Щиты</h4>' +
    '<p>🛡️ — это «прогул прощён». Щит появляется сам за <b>каждые пять дней</b> занятий ' +
    '(больше двух про запас не копится) и <b>автоматически</b> закрывает один пропущенный ' +
    'день, чтобы серия не оборвалась. Тратить его руками не надо.</p>' +
    '<h4>Задача дня</h4>' +
    '<p>Одно короткое упражнение, одинаковое для всех и своё на каждый день.</p>' },

  warm: { t:"🔥 Разминка", h:
    '<h4>Что это за экран</h4>' +
    '<p>Короткие упражнения на пять минут: <b>угадай, что напечатает код</b>, ' +
    '<b>собери программу из блоков</b> и <b>предскажи, что лежит в памяти</b>. ' +
    'Кода писать почти не надо — надо думать.</p>' +
    '<p>Упражнения открываются по мере прохождения уроков: в них встречается только то, ' +
    'что ты уже проходил.</p>' },

  warmup: { t:"🔥 Разминка — как решать", h:
    '<h4>Что делать</h4>' +
    '<ul><li><b>Угадай вывод:</b> прочитай код глазами и напиши, что он напечатает. ' +
    'Запускать нельзя — в этом и смысл.</li>' +
    '<li><b>Собери из блоков:</b> перетащи строки в правильном порядке. Отступ важен.</li>' +
    '<li><b>Предскажи память:</b> скажи, что будет лежать в переменных в этот момент.</li></ul>' +
    '<p>Ошибся — ничего не теряешь, показывается разбор. ' +
    '<b>💡 Подсказка</b> здесь тоже бесплатная: звёзд в разминке нет.</p>' },

  review: { t:"🔁 Повторить", h:
    '<h4>Что это за экран</h4>' +
    '<p>Уроки, которые дались тяжело, <b>возвращаются сами</b> — сначала через два дня, ' +
    'потом через неделю, потом через три. Так они и запоминаются: не зубрёжкой, а возвратами.</p>' +
    '<p>Три чистых повтора — и урок больше не попросит повторения.</p>' +
    '<h4>Бестиарий ошибок</h4>' +
    '<p>Ниже на этом же экране — список ошибок, которые ты встречал. Побеждённая ошибка ' +
    'подсвечивается зелёным: это не ошибки, это трофеи.</p>' },

  ai: { t:"🤖 Ты и ИИ", h:
    '<h4>Что это за экран</h4>' +
    '<p>Пятнадцать упражнений про то, как <b>командовать</b> нейросетью и как <b>проверять</b> ' +
    'за ней. ИИ уверенно врёт — уметь его поймать важнее, чем уметь его попросить.</p>' +
    '<h4>Что тут бывает</h4>' +
    '<ul><li>предсказать, что ответит ИИ;</li>' +
    '<li>починить код, который ИИ написал с ошибкой;</li>' +
    '<li>вынести вердикт: прав он или нет, и доказать это кодом.</li></ul>' },

  ailesson: { t:"🤖 Упражнение про ИИ", h:
    '<h4>Что делать</h4>' +
    '<p>Прочитай задание сверху, ответь или напиши код внизу и нажми <b>«✓ Проверить»</b>. ' +
    'Если требуется доказать, что ИИ неправ, — доказательством считается <b>работающий код</b>, ' +
    'а не слова.</p>' },

  project: { t:"🏗 Проект — большая программа", h:
    '<h4>Что это за экран</h4>' +
    '<p>Проект собирается <b>по шагам</b>: каждый шаг добавляет к программе кусочек. ' +
    'Готовый проект остаётся у тебя в «Моём» — его можно показать и скачать файлом <b>.py</b>.</p>' +
    '<h4>Что делать</h4>' +
    '<ul><li>Шаги идут по порядку, точки сверху показывают, где ты.</li>' +
    '<li>Ушёл и вернулся — проект продолжится с того же шага.</li>' +
    '<li>Застрял — подсказка на месте, как в уроке.</li></ul>' },

  projectdone: { t:"🎉 Проект собран", h:
    '<p>Программа целиком — вот она. Её можно <b>скачать файлом .py</b> и запустить на ' +
    'настоящем компьютере, а можно просто показать. Она уже лежит в разделе ' +
    '<b>🎒 Моё</b> и никуда оттуда не денется.</p>' },

  folio: { t:"🎒 Моё — что тут лежит", h:
    '<h4>Что это за экран</h4>' +
    '<p>Всё, что сделано руками: <b>программы</b> из проектов, <b>рисунки</b> черепашки, ' +
    '<b>свои задания</b> и <b>сертификаты</b> за миры.</p>' +
    '<h4>Что с этим делать</h4>' +
    '<ul><li>Программу — скачать файлом <b>.py</b>.</li>' +
    '<li>Сертификат — <b>распечатать</b> или сохранить в PDF (кнопка внутри сертификата).</li>' +
    '<li>Рисунок — сохранить картинкой.</li></ul>' },

  mytasks: { t:"✍️ Своё задание", h:
    '<h4>Что это за экран</h4>' +
    '<p>Тут ты не решаешь, а <b>придумываешь</b> задачу — и отправляешь её ссылкой другу. ' +
    'Правильный ответ тренажёр посчитает сам, запустив твоё решение.</p>' +
    '<h4>Что делать</h4>' +
    '<ol><li>Придумай <b>название</b> — по нему друг поймёт, что его ждёт.</li>' +
    '<li>Опиши <b>условие</b> словами — так, чтобы понял тот, кто задачу не видел.</li>' +
    '<li>Напиши <b>решение</b>: из него тренажёр и возьмёт правильный ответ.</li>' +
    '<li>Скопируй ссылку и отправь. Друг откроет её и будет решать.</li></ol>' +
    '<p>Составить задание труднее, чем решить: придётся объяснить словами то, что понимаешь руками.</p>' },

  friendtask: { t:"✉️ Задание от друга", h:
    '<p>Это задача, которую придумал <b>другой человек</b>. Она не из курса и звёзд не даёт, ' +
    'зато за решённое чужое задание идёт опыт — один раз за задание, ' +
    'и ещё бейдж за самое первое.</p>' +
    '<p>Напиши код и нажми «✓ Проверить» — ответ сверится с тем, что получилось у автора. ' +
    'Программа у тебя может быть совсем другая: сходиться должен результат.</p>' +
    '<p class="dim">За своё же задание, открытое «глазами друга», опыт не начисляется — ' +
    'иначе задания составлялись бы ради XP.</p>' },

  viz: { t:"🔍 Визуализатор — что в памяти", h:
    '<h4>Что это за экран</h4>' +
    '<p>Показывает, что происходит <b>внутри</b> программы: какая строка выполняется сейчас ' +
    'и что в этот момент лежит в каждой переменной.</p>' +
    '<h4>Что делать</h4>' +
    '<ul><li>Сначала жми <b>«▶ Показать по шагам»</b> — до этого перематывать нечего.</li>' +
    '<li>Дальше: <b>«Вперёд ▶»</b> — один шаг программы, <b>«◀ Назад»</b> — шаг обратно, ' +
    'перемотку можно крутить в обе стороны. <b>«⏮»</b> вернёт в начало, ' +
    '<b>«▶ Играть»</b> прокрутит само. Ползунок рядом — быстрая перемотка.</li>' +
    '<li>Стрелки показывают, какая переменная на что ссылается — так видно, ' +
    'почему два списка «менялись сами».</li>' +
    '<li>Внизу — <b>пересказ словами</b>: что программа сделала, по-русски.</li></ul>' +
    '<p>Сюда стоит идти, когда код работает, но <b>непонятно почему</b>.</p>' },

  account: { t:"👤 Профиль", h:
    '<h4>Что это за экран</h4>' +
    '<p>Имя, код ученика и настройки. <b>Код ученика</b> нужен, чтобы открыть свой прогресс ' +
    'на другом устройстве, — храни его как пароль.</p>' +
    '<p>Прогресс хранится в самом браузере. Чистка истории браузера может его стереть — ' +
    'поэтому код и ссылку лучше сохранить заранее.</p>' },

  register: { t:"👋 Вход", h:
    '<p>Впиши имя — и всё, это вся регистрация. Ни почты, ни пароля не нужно.</p>' +
    '<p>Если ты уже занимался на другом устройстве, введи свой <b>код ученика</b> — ' +
    'прогресс приедет вместе с ним.</p>' },

  guide: { t:"❓ Как пользоваться", h:
    '<p>Это полная инструкция. А «?» наверху отвечает <b>про тот экран, где ты сейчас</b>, — ' +
    'загляни туда, когда что-то непонятно посреди дела.</p>' },

  admin: { t:"🛠 Панель наставника", h:
    '<p>Экран для взрослого: видно, сколько времени ушло на каждый урок, где было больше всего ' +
    'попыток и какие ошибки повторяются. Отсюда же снимаются замки с уроков.</p>' },

  /* --- не экраны, а темы: сюда ведут кружки «?» рядом с заголовками --- */
  stars: { t:"★ Звёзды и опыт", h:
    '<h4>Откуда берутся звёзды</h4>' +
    '<ul><li><b>★★★</b> — урок сдан с первой попытки и без подсказок;</li>' +
    '<li><b>★★</b> — со второй попытки или с подсказкой. Сколько бы попыток ни ушло, ' +
    'ниже двух звёзд от этого не станет;</li>' +
    '<li><b>★</b> — если смотрел готовое решение. Урок всё равно пройден.</li></ul>' +
    '<p>Звёзды <b>не сгорают</b> и не отнимаются задним числом. Пройти урок заново можно ' +
    'когда угодно — хуже уже не станет, а лучше станет.</p>' +
    '<h4>Опыт и ранг</h4>' +
    '<p>Полоска наверху — опыт. Он копится за уроки, проекты и дни подряд, и от него ' +
    'зависит ранг: Новичок, Ученик, Кодер, Инженер, Хакер, Мастер, Легенда, Гуру.</p>' },

  worlds: { t:"🗺 Пять миров, сто уроков", h:
    '<p>Курс — это <b>сто уроков</b>, разложенных на пять миров по двадцать. Уроки идут ' +
    'строго по порядку: каждый следующий опирается на предыдущий.</p>' +
    '<p>В конце каждого мира — <b>проект</b> (большая программа, которую ты соберёшь по шагам) ' +
    'и <b>сертификат</b>, который печатается на бумаге.</p>' +
    '<p>Не помнишь, где было нужное, — есть <b>поиск по урокам</b> прямо над списком миров.</p>' },

  tools: { t:"🧰 Кнопки наверху", h:
    '<div class="iconlist">' +
    '<div class="iconrow"><span class="ic">🏠</span><span><b>Главное</b> — уроки и что делать сейчас</span></div>' +
    '<div class="iconrow"><span class="ic">🎯</span><span><b>Тренировки</b> — разминки, игры и песочница: звёзд не дают, заходят по желанию</span></div>' +
    '<div class="iconrow"><span class="ic">🎒</span><span><b>Моё</b> — сделанное своими руками</span></div>' +
    '<div class="iconrow"><span class="ic">🔥</span><span><b>Сегодня</b> — дни подряд и задача дня</span></div>' +
    '<div class="iconrow"><span class="ic">📖</span><span><b>Шпаргалка</b> — справочник по командам, открывается прямо посреди урока</span></div>' +
    '<div class="iconrow"><span class="ic">👤</span><span><b>Профиль</b> — имя, код ученика, настройки</span></div>' +
    '<div class="iconrow"><span class="ic">⛶</span><span><b>Фокус</b> — прячет всё лишнее, остаётся только урок</span></div>' +
    '<div class="iconrow"><span class="ic">?</span><span><b>Подсказка</b> — то, что ты сейчас читаешь</span></div>' +
    '</div>' }
};

function helpIsOpen(){
  var el = document.getElementById("helpwrap");
  return !!el && el.classList.contains("show");
}
function helpFor(key){
  return HELP[key] || HELP[curPlace] || HELP.home;
}
/* Ключ, который показывается сейчас. Отдельная переменная нужна, чтобы
   кружок «?» у заголовка мог показать НЕ то, что показала бы кнопка в
   шапке, — и чтобы смена темы перерисовала именно этот текст. */
var helpKey = null;
function helpRender(){
  var body = document.getElementById("helpbody");
  var head = document.getElementById("helptitle");
  if (!body || !head) return;
  var e = helpFor(helpKey);
  head.textContent = e.t;
  var th = themeGet();
  body.innerHTML = e.h +
    '<h4>Оформление</h4>' +
    '<div class="themepick">' +
      '<button data-theme-set="light"' + (th === "light" ? ' class="on"' : '') + '>☀️ Светлая</button>' +
      '<button data-theme-set="dark"' + (th === "dark" ? ' class="on"' : '') + '>🌙 Тёмная</button>' +
    '</div>' +
    '<div class="helprow">' +
      '<button class="rbtn sec" id="help-guide">📕 Полная инструкция</button>' +
      '<button class="rbtn sec" id="help-sheet">📖 Шпаргалка</button>' +
    '</div>';
  body.querySelectorAll("[data-theme-set]").forEach(function(b){
    b.onclick = function(){ themeSet(b.getAttribute("data-theme-set")); };
  });
  var g = document.getElementById("help-guide");
  if (g) g.onclick = function(){ closeHelp(); screenGuide(); };
  var s = document.getElementById("help-sheet");
  if (s) s.onclick = function(){ closeHelp(); openSheet(); };
  body.scrollTop = 0;
}
/* Кто открыл помощь — чтобы вернуть фокус туда же при закрытии. Без этого
   тот, кто ходит с клавиатуры, после Esc оказывается в начале страницы и
   заново пробегает всю панель, чтобы вернуться туда, где читал. */
var helpOpener = null;
/* Что внутри окна можно поймать табом. Порядок — документный, его даёт сам
   querySelectorAll. Проверки на видимость тут нарочно нет: в окне помощи
   ничего не прячется, а `offsetParent` не работает в проверках (там нет
   раскладки) — фильтр по нему молча выключил бы всю ловушку фокуса. */
function helpFocusable(){
  var box = document.querySelector(".helpbox");
  if (!box) return [];
  return [].filter.call(box.querySelectorAll("button, a[href], input, [tabindex]:not([tabindex='-1'])"),
    function(el){ return !el.disabled; });
}
function openHelp(key){
  var el = document.getElementById("helpwrap");
  if (!el) return;
  helpKey = key || null;
  helpRender();
  helpOpener = document.activeElement;
  el.classList.add("show");
  var b = document.getElementById("btn-help");
  if (b){ b.classList.add("on"); b.setAttribute("aria-expanded", "true"); }
  /* Фокус уводим на само окно, а не на первую кнопку: диктор прочитает
     заголовок окна и текст, а не «Закрыть». */
  var box = el.querySelector(".helpbox");
  if (box && box.focus) try { box.focus(); } catch(e){}
}
function closeHelp(){
  var el = document.getElementById("helpwrap");
  var was = !!el && el.classList.contains("show");
  if (el) el.classList.remove("show");
  var b = document.getElementById("btn-help");
  if (b){ b.classList.remove("on"); b.setAttribute("aria-expanded", "false"); }
  /* Возвращаем фокус тому, кто открывал, — но только если он ещё на странице:
     кружок «?» живёт внутри экрана и мог исчезнуть при перерисовке. */
  if (was && helpOpener && document.contains(helpOpener) && helpOpener.focus){
    try { helpOpener.focus(); } catch(e){}
  }
  helpOpener = null;
}
/* Пока помощь открыта, Tab ходит ВНУТРИ окна и не убегает на страницу за ним.
   Выход один и он написан прямо в окне: Esc (и он же возвращает фокус назад). */
document.addEventListener("keydown", function(e){
  if (e.key !== "Tab" || !helpIsOpen()) return;
  var list = helpFocusable();
  if (!list.length) return;
  var first = list[0], last = list[list.length - 1];
  var box = document.querySelector(".helpbox");
  if (!box.contains(document.activeElement)){ e.preventDefault(); return first.focus(); }
  if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});
function toggleHelp(){ if (helpIsOpen()) closeHelp(); else openHelp(null); }
/* Кружок «?» у заголовка. Разметку пишем одной функцией, чтобы кружки
   везде выглядели одинаково и вели себя одинаково. */
function qm(key, what){
  return '<button class="qm" data-help="' + key + '" title="' +
    esc(what || "Что это такое") + '" aria-label="' + esc(what || "Что это такое") + '">?</button>';
}
/* Один обработчик на всю страницу, и он делает две вещи сразу.
   Первая: кружки «?» рисуются ВНУТРИ экранов, которые перерисовываются
   целиком, — вешать им onclick пришлось бы в каждом экране.
   Вторая: клик мимо окна закрывает помощь. Раньше это делало прозрачное
   затемнение на весь экран, но оно же съедало прокрутку колесом — страница
   за окном «замирала», и это читалось как поломка. Теперь на большом экране
   затемнение не ловит указатель вовсе (см. .helpwrap в стилях), а закрытие
   держится на этом обработчике. */
document.addEventListener("click", function(e){
  var t = e.target;
  var b = t && t.closest ? t.closest("[data-help]") : null;
  if (b){
    e.preventDefault();
    return openHelp(b.getAttribute("data-help"));
  }
  if (!helpIsOpen()) return;
  /* клик по самой кнопке «?» обрабатывает она сама (там переключение) */
  if (t.closest(".helpbox") || t.closest("#btn-help")) return;
  closeHelp();
});

/* ================= экран: как пользоваться =================
   Полная инструкция. Всплывающее «?» отвечает про текущий экран, а это —
   один связный текст: устройство сайта, из чего состоит урок, откуда
   берутся звёзды, что делать, когда не выходит, и кусок для родителя.
   ============================================================ */
function screenGuide(){
  enterScreen(null, "guide");
  session = { id:null, attempts:0, hints:0, shown:false };
  var h = '<div class="lvlhead"><div><div class="idx">инструкция</div>' +
    '<h1>❓ Как пользоваться</h1></div></div>' +
    '<p class="lede">Здесь написано, как всё устроено. Если вопрос про конкретный экран — ' +
    'жми <b>«?»</b> в правом верхнем углу: там ответ про то место, где ты сейчас.</p>' +
    '<div class="guide">';

  h += '<div class="card"><h3>Что это вообще такое</h3>' +
    '<p>Кодоквест — тренажёр языка Python. Код пишется и выполняется прямо в браузере: ' +
    'ничего не надо устанавливать, интернет нужен только чтобы открыть страницу.</p>' +
    '<p class="dim">Курс — сто уроков в пяти мирах. Плюс тренировки, игры и проекты вокруг них.</p></div>';

  h += '<div class="card"><h3>Первый час: что делать по шагам</h3>' +
    '<ol class="guidesteps">' +
    '<li><b>Нажми «Начать первый урок» на Главном</b>' +
    '<span>Тренажёр сам откроет тот урок, до которого ты дошёл. Искать ничего не надо.</span></li>' +
    '<li><b>Прочитай примеры и запусти их</b>' +
    '<span>У каждого примера есть «▶ Запустить пример»: код сработает тут же. ' +
    '«→ В редактор» перенесёт его вниз, чтобы поменять и попробовать своё.</span></li>' +
    '<li><b>Реши задачу в редакторе</b>' +
    '<span>Пиши код и жми «▶ Запустить» столько раз, сколько нужно. Это ничего не стоит.</span></li>' +
    '<li><b>Нажми «✓ Проверить»</b>' +
    '<span>Урок засчитается. Если не сошлось — тренажёр покажет, чем твой ответ отличается ' +
    'от нужного, и можно пробовать дальше.</span></li>' +
    '<li><b>Возвращайся каждый день</b>' +
    '<span>Хоть на пять минут. Огонёк 🔥 наверху считает дни подряд, а щит 🛡️ прощает пропуск.</span></li>' +
    '</ol></div>';

  h += '<div class="card"><h3>Кнопки наверху</h3>' +
    '<div class="iconlist">' +
    '<div class="iconrow"><span class="ic">🏠</span><span><b>Главное</b> — уроки и что делать сейчас</span></div>' +
    '<div class="iconrow"><span class="ic">🎯</span><span><b>Тренировки</b> — разминка, игры, «Ты и ИИ», песочница, визуализатор</span></div>' +
    '<div class="iconrow"><span class="ic">🎒</span><span><b>Моё</b> — программы, рисунки, свои задания, сертификаты</span></div>' +
    '<div class="iconrow"><span class="ic">🔥</span><span><b>Сегодня</b> — дни подряд и задача дня</span></div>' +
    '<div class="iconrow"><span class="ic">📖</span><span><b>Шпаргалка</b> — 115 команд с примерами, открывается поверх урока</span></div>' +
    '<div class="iconrow"><span class="ic">👤</span><span><b>Профиль</b> — имя, код ученика, выход</span></div>' +
    '<div class="iconrow"><span class="ic">⛶</span><span><b>Фокус</b> — прячет всё лишнее, остаётся только урок</span></div>' +
    '<div class="iconrow"><span class="ic">?</span><span><b>Подсказка</b> — что это за экран и что тут делать</span></div>' +
    '</div></div>';

  h += '<div class="card"><h3>Звёзды, опыт и ранги</h3>' +
    '<p>За урок дают от одной до трёх звёзд: <b>★★★</b> — с первой попытки и без подсказок, ' +
    '<b>★★</b> — со второй попытки или с подсказкой, <b>★</b> — если смотрел готовое решение. ' +
    'Сколько бы попыток ни ушло, ниже двух звёзд от этого не станет.</p>' +
    '<p>Звёзды не сгорают и не отнимаются задним числом. Подсказка стоит одну звезду — ' +
    'и это <b>не страшно</b>: пройти урок с подсказкой лучше, чем не пройти.</p>' +
    '<p class="dim">Полоска наверху — опыт. От него зависит ранг — от Новичка до Гуру, — ' +
    'а ранг ни на что не влияет, кроме удовольствия.</p></div>';

  h += '<div class="card"><h3>Когда не получается</h3>' +
    '<ul><li><b>💡 Подсказка</b> под редактором — по шагам, от намёка к ответу.</li>' +
    '<li><b>⏭ Шаг</b> в панели запуска — программа пройдёт по строчкам, и будет видно, ' +
    'где она свернула не туда.</li>' +
    '<li><b>📖 Шпаргалка</b> наверху — забыл команду, посмотри пример.</li>' +
    '<li><b>🔍 Визуализатор</b> — когда код работает, но непонятно почему.</li>' +
    '<li><b>Красная рамка с ошибкой</b> — это не ругань, а объяснение. Там всегда написано, ' +
    'в какой строке и что именно не сошлось.</li></ul></div>';

  h += '<div class="card"><h3>Кнопки клавиатуры</h3><div class="keylist">' +
    '<div class="keyrow"><kbd>Ctrl</kbd>+<kbd>Enter</kbd><span>запустить код</span></div>' +
    '<div class="keyrow"><kbd>⌘</kbd>+<kbd>Enter</kbd><span>то же самое на Маке</span></div>' +
    '<div class="keyrow"><kbd>Tab</kbd><span>отступ в четыре пробела</span></div>' +
    '<div class="keyrow"><kbd>Enter</kbd><span>после двоеточия отступ подставится сам</span></div>' +
    '<div class="keyrow"><kbd>Esc</kbd><span>закрыть окно поверх страницы</span></div>' +
    '</div></div>';

  h += '<div class="card"><h3>Оформление</h3>' +
    '<p>Светлая тема стоит по умолчанию: тёмный фон тяжело читать днём. Кому удобнее ' +
    'тёмная — переключается тут же и запоминается на этом устройстве.</p>' +
    '<div class="themepick" id="guidetheme">' +
      '<button data-theme-set="light">☀️ Светлая</button>' +
      '<button data-theme-set="dark">🌙 Тёмная</button>' +
    '</div></div>';

  h += '<div class="card"><h3>Сохраняется ли прогресс</h3>' +
    '<p>Да. Всё, что пройдено, хранится в самом браузере — закрыл вкладку, вернулся, ' +
    'всё на месте. Написанный в уроке код тоже сохраняется.</p>' +
    '<p>Чтобы заниматься с двух устройств, нужен <b>код ученика</b> из профиля 👤. ' +
    'Чистка истории браузера может стереть прогресс — код лучше сохранить заранее.</p>' +
    '<p class="dim">Сайт можно поставить на домашний экран телефона: он будет открываться ' +
    'как приложение и работать без интернета.</p></div>';

  h += '<div class="card"><h3>Для родителя</h3>' +
    '<p>Правильный режим — <b>пятнадцать минут в день</b>, а не два часа в воскресенье. ' +
    'Огонёк дня сделан ровно для этого.</p>' +
    '<p>Подсказки — не читерство. Ребёнок, который взял подсказку и дошёл до конца, ' +
    'выучил больше, чем тот, кто бросил урок на середине.</p>' +
    '<p>Есть <b>панель наставника</b>: сколько времени ушло на каждый урок, где было больше ' +
    'всего попыток, какие ошибки повторяются, вопрос за ужином и отчёт за неделю. Оттуда же ' +
    'снимаются замки с уроков. Она открывается адресом сайта с <b>#admin</b> на конце ' +
    'и спрашивает код — в меню её нет, чтобы ребёнок не забрёл туда случайно.</p></div>';

  h += '</div><div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button>' +
    '<span class="sp"></span><button class="bigbtn" id="gostart">▶ К урокам</button></div>';

  app.innerHTML = h;
  var paint = function(){
    app.querySelectorAll("#guidetheme button").forEach(function(b){
      b.classList.toggle("on", b.getAttribute("data-theme-set") === themeGet());
    });
  };
  app.querySelectorAll("#guidetheme button").forEach(function(b){
    b.onclick = function(){ themeSet(b.getAttribute("data-theme-set")); paint(); };
  });
  paint();
  document.getElementById("tomap").onclick = screenWorlds;
  document.getElementById("gostart").onclick = function(){
    var n = nextLesson();
    if (n) openLesson(n.id); else screenWorlds();
  };
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ============================================================
   КНОПКА «НАВЕРХ»
   Урок и портфолио бывают в несколько экранов длиной, а вкладки и «?»
   живут в шапке. Кнопка появляется только после экрана прокрутки —
   иначе она просто загораживала бы угол.
   ============================================================ */
(function(){
  var b = document.getElementById("totop");
  if (!b) return;
  b.onclick = function(){ window.scrollTo({ top:0, behavior:"smooth" }); };
  var check = function(){
    b.classList.toggle("show", (window.pageYOffset || document.documentElement.scrollTop || 0) > 700);
  };
  window.addEventListener("scroll", check, { passive:true });
  check();
})();

/* ================= старт ================= */
/* Вкладки. Их всего три, и это весь верхний уровень: «Главное» (уроки и что
   делать сейчас), «Тренировки» (всё, что вне сотни), «Моё» (сделанное своими
   руками). Остальные кнопки панели — не разделы, а инструменты под рукой:
   огонёк дня, шпаргалка, профиль, фокус.
   Старые кнопки (Миры, Разминка, Игры…) убраны из панели, но экраны и адреса
   остались: на них ведут карточки с экранов и хэши вроде #games. */
document.getElementById("logo").onclick = screenWorlds;
(function(){
  var byTab = { home: screenWorlds, train: screenTrain, mine: screenFolio };
  var nav = document.querySelector(".tabs");
  if (nav) nav.addEventListener("click", function(e){
    var b = e.target.closest(".tab");
    if (!b) return;
    var go = byTab[b.getAttribute("data-tab")];
    if (go) go();
  });
})();
(function(){ var b = document.getElementById("btn-today"); if (b) b.onclick = screenToday; })();
(function(){ var b = document.getElementById("btn-who"); if (b) b.onclick = screenAccount; })();
(function(){
  var b = document.getElementById("btn-sheet"); if (b) b.onclick = openSheet;
  var x = document.getElementById("sheetclose"); if (x) x.onclick = closeSheet;
  var q = document.getElementById("sheetq"); if (q) q.oninput = sheetRender;
  var a = document.getElementById("sheetall"); if (a) a.onchange = sheetRender;
  /* клик по затемнению закрывает, клик внутри окна — нет */
  var el = document.getElementById("sheet");
  if (el) el.onclick = function(e){ if (e.target === el) closeSheet(); };
})();
(function(){
  var x = document.getElementById("certclose"); if (x) x.onclick = closeCert;
  /* Печать — это window.print(): браузер сам предложит и принтер, и «Сохранить
     в PDF». Своего экспорта не делаем — он был бы хуже штатного. */
  var pr = document.getElementById("certprint");
  if (pr) pr.onclick = function(){ try { window.print(); } catch(e){} };
  var el = document.getElementById("cert");
  if (el) el.onclick = function(e){ if (e.target === el) closeCert(); };
})();
(function(){
  var b = document.getElementById("btn-help"); if (b) b.onclick = toggleHelp;
  var x = document.getElementById("helpclose"); if (x) x.onclick = closeHelp;
  /* Клик мимо окна закрывает: на телефоне это единственный удобный способ,
     кнопка «✕» слишком мелкая для пальца. */
  var v = document.getElementById("helpveil"); if (v) v.onclick = closeHelp;
})();
(function(){
  var b = document.getElementById("btn-focus");
  if (b) b.onclick = function(){
    document.body.classList.toggle("focus");
    b.classList.toggle("on");
  };
})();
document.getElementById("win").onclick = function(e){ if (e.target === this) closeWin(); };
window.addEventListener("keydown", function(e){
  if (e.key !== "Escape") return;
  if (certIsOpen()) closeCert();
  else if (helpIsOpen()) closeHelp();
  else if (sheetIsOpen()) closeSheet();
  else closeWin();
});
/* Закрытая вкладка — единственный уход, который не проходит через claimScreen */
window.addEventListener("beforeunload", draftFlush);
window.addEventListener("resize", function(){
  document.querySelectorAll("canvas.stage").forEach(function(c){
    if (c._lastTurtle) drawTurtle(c, c._lastTurtle);
  });
  /* стрелки визуализатора нарисованы по реальным координатам — после
     изменения размера их надо пересчитать */
  document.querySelectorAll(".vizmem").forEach(function(m){ vizDrawArrows(m); });
  /* приписки значений зависят от того, сколько знаков влезает в строку:
     редактор стал уже — часть приписок обязана исчезнуть, иначе подсветка
     съедет относительно текстового поля */
  document.querySelectorAll(".editorbox").forEach(function(b){
    if (b._watch && b.setWatch){ b._charW = 0; b.setWatch(b._watch); }
  });
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

/* ================= первая отрисовка =================
   Правило одно: с этого экрана нельзя уйти в пустоту. Раньше отрисовка висела
   на `allWorldsContent().then(...)` без «catch», и любая беда с загрузкой
   содержания (или ошибка в коде рядом) оставляла ребёнка перед ПУСТОЙ
   страницей с одной шапкой — без единого слова о том, что случилось.
   Такое уже случилось на живом сайте после обновления: браузер взял из кэша
   старый скрипт к новой странице, старый код упал на кнопке, которой в новой
   шапке больше нет, — и экран остался пустым.

   Поэтому здесь три страховки:
     1. `catch` у загрузки содержания — рисуем то, что есть;
     2. `try/catch` вокруг самой отрисовки;
     3. общий обработчик ошибок ниже: если экран так и остался пустым,
        ребёнок видит человеческое сообщение и кнопку «Обновить», которая
        чистит кэш и перезагружает страницу. */
function bootRender(){
  /* общий счётчик активных минут запускается один раз на всю сессию: он
     считает не «сколько открыта вкладка», а сколько ребёнок реально работал */
  actStart();
  try {
    if (!routeHash()){
      if (needsRegister()) screenRegister();   /* сервер настроен, ученик ещё не выбран */
      else screenWorlds();
    }
  } catch(e){
    bootFallback(e);
    throw e;                                   /* пусть попадёт и в консоль */
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
}
/* Пустой экран — худшее, что может показать тренажёр: непонятно ни что
   сломалось, ни что делать. Показываем словами и даём одну кнопку. */
function bootFallback(err){
  if (!app || (app.innerHTML || "").trim()) return;   /* что-то уже нарисовано */
  app.innerHTML =
    '<div class="note"><b>Страница не открылась до конца</b>' +
    'Чаще всего это старый файл, застрявший в памяти браузера после обновления. ' +
    'Нажми кнопку ниже — она почистит память и загрузит свежую версию. ' +
    'Прогресс от этого не пропадёт.' +
    (err && err.message ? '<br><span class="mono">' + esc(String(err.message)).slice(0, 200) + '</span>' : '') +
    '</div><div class="pager"><button class="bigbtn" id="bootreload">Обновить страницу</button></div>';
  var b = document.getElementById("bootreload");
  if (b) b.onclick = function(){
    b.textContent = "Обновляю…";
    var done = function(){ try { location.reload(); } catch(e){} };
    try {
      if (window.caches && caches.keys)
        caches.keys().then(function(ks){
          return Promise.all(ks.map(function(k){ return caches.delete(k); }));
        }).then(done, done);
      else done();
    } catch(e){ done(); }
  };
}
/* грузим содержание всех миров до первой отрисовки — иначе на сайте
   миры 2–5 мигают как «в работе», пока их файлы не приедут. Не приехало —
   всё равно рисуем: лучше карта с надписью «в работе», чем пустота. */
allWorldsContent().then(bootRender, bootRender);
/* Последняя сеть безопасности: любая необработанная ошибка при старте.
   Если после неё экран пуст — объясняем и предлагаем обновиться. */
window.addEventListener("error", function(e){ bootFallback(e && e.error); });
window.addEventListener("hashchange", function(){ if (!routeHash()) screenWorlds(); });

/* ================= установка на домашний экран =================
   Вкладка браузера — самое хрупкое место привычки: её закрывают и забывают.
   С манифестом сайт ставится иконкой на домашний экран и открывается без
   адресной строки, а service worker даёт офлайн (стратегия и причины —
   в sw.js).

   Три случая, когда регистрировать нельзя, и все три реальные:
     - один файл (dist): он и так работает офлайн, а рядом с ним нет ни sw.js,
       ни манифеста;
     - открыто с диска (file://): браузер сам запрещает service worker;
     - браузер без поддержки — тогда просто сайт, как раньше.
   Честно про iPhone: «на экран Домой» там работает, а вот пуш-напоминаний
   для веба нет — напоминания живут только внутри сайта (см. «Сегодня»). */
(function(){
  if (window.__SINGLE_FILE__) return;
  try { if (location.protocol === "file:") return; } catch(e){ return; }
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(function(){});
  });
})();

window.__game = {
  screenWorlds: screenWorlds, screenWorld: screenWorld, openLesson: openLesson,
  screenTrain: screenTrain, trainCards: trainCards, nextLesson: nextLesson,
  bootFallback: bootFallback, bootRender: bootRender,
  screenSandbox: screenSandbox, screenAdmin: screenAdmin, screenGames: screenGames,
  openGame: openGame, screenWarmups: screenWarmups, openWarmup: openWarmup,
  warmupOpen: warmupOpen, warmupsOpen: warmupsOpen, warmupsList: warmupsList,
  screenToday: screenToday, dailyPick: dailyPick, markActiveToday: markActiveToday,
  streakCurrent: streakCurrent, streakBest: streakBest, dailyDone: dailyDone, dayKey: dayKey,
  scheduleDays: scheduleDays, isStudyDay: isStudyDay, toggleStudyDay: toggleStudyDay, studyDue: studyDue,
  shieldsLeft: shieldsLeft, shieldToNext: shieldToNext, shieldedOn: shieldedOn, useShield: useShield,
  shieldWouldSave: shieldWouldSave,
  coveredDays: coveredDays, shieldsLeftIn: shieldsLeftIn, SHIELD_EVERY: SHIELD_EVERY, SHIELD_MAX: SHIELD_MAX,
  screenRegister: screenRegister, screenAccount: screenAccount, doRegister: doRegister,
  doLogin: doLogin, doLogout: doLogout, slugFromName: slugFromName, myName: myName,
  myCode: myCode, needsRegister: needsRegister,
  installTipHTML: installTipHTML, installPossible: installPossible,
  installReady: installReady, INSTALL_AFTER: INSTALL_AFTER, installDone: installDone,
  installHidden: installHidden, installHide: installHide, installIsIOS: installIsIOS,
  sfxOn: sfxOn, sfxSet: sfxSet, sfx: sfx, voiceAuto: voiceAuto, voiceAutoSet: voiceAutoSet,
  voiceSupported: voiceSupported, speak: speak, voiceStop: voiceStop, plainText: plainText,
  sayBtnHTML: sayBtnHTML,
  screenViz: screenViz, vizRecord: vizRecord, vizPlaying: vizPlaying, state: S, save: save,
  vizDiff: vizDiff, vizMemoryHTML: vizMemoryHTML, VIZ_EXAMPLES: VIZ_EXAMPLES,
  openProject: openProject, screenProjectDone: screenProjectDone, projectById: projectById,
  projectOfWorld: projectOfWorld, projectState: projectState, projectDone: projectDone,
  projectOpen: projectOpen, projectStartCode: projectStartCode,
  projectDraftId: projectDraftId,
  screenAILab: screenAILab, openAILesson: openAILesson, ailabDone: ailabDone,
  reviewTruth: reviewTruth, catchProbe: catchProbe, catchRun: catchRun, catchStart: catchStart,
  memAnswers: memAnswers, memFrame: memFrame, memNorm: memNorm,
  stepsNote: stepsNote, stepsShown: stepsShown, minPos: minPos,
  whyDiffer: whyDiffer, diffBlock: diffBlock, predictDiff: predictDiff,
  BADGES: BADGES, STREAK_BADGES: STREAK_BADGES, awardStreak: awardStreak,
  CUSTOM: CUSTOM, sameDrawing: sameDrawing, editUnits: editUnits, setStars: setStars,
  stopTimer: stopTimer, adminUnlock: adminUnlock, ADMIN_CODE: ADMIN_CODE,
  getSession: function(){ return session; },
  mergeProgress: mergeProgress, cloudSnapshot: cloudSnapshot, applyProgress: applyProgress,
  localSnapshot: localSnapshot, adminLabel: adminLabel, adminLabelSet: adminLabelSet,
  blankProgress: blankProgress, ensureShape: ensureShape,
  clearResults: clearResults, clearAll: clearAll,
  cloudPull: cloudPull, cloudPush: cloudPush, cloudState: cloudState,
  screenReview: screenReview, reviewList: reviewList, reviewDue: reviewDue,
  reviewAfterLesson: reviewAfterLesson, reviewNote: reviewNote,
  reviewWhy: reviewWhy, reviewDueAt: reviewDueAt, reviewState: reviewState,
  reviewGraduated: reviewGraduated, reviewGraduatedCount: reviewGraduatedCount,
  REVIEW_STEPS: REVIEW_STEPS, REVIEW_HARD: REVIEW_HARD, REVIEW_BADGE_AT: REVIEW_BADGE_AT,
  openSheet: openSheet, closeSheet: closeSheet, sheetIsOpen: sheetIsOpen,
  sheetRender: sheetRender, sheetLearned: sheetLearned, sheetRun: sheetRun,
  weekReportHTML: weekReportHTML, WEEK_DAYS: WEEK_DAYS,
  dinnerHTML: dinnerHTML, dinnerPickFrom: dinnerPickFrom,
  storyOf: storyOf, storyHTML: storyHTML, stepFacts: stepFacts,
  pyFileText: pyFileText, pyFileName: pyFileName, pyIsDraw: pyIsDraw,
  galleryList: galleryList, gallerySave: gallerySave, galleryDrop: galleryDrop,
  galleryTitleOf: galleryTitleOf, galleryDrawing: galleryDrawing, GALLERY_MAX: GALLERY_MAX,
  downloadText: downloadText, KEYBAR_KEYS: KEYBAR_KEYS,
  draftGet: draftGet, draftSave: draftSave, draftDrop: draftDrop,
  draftApply: draftApply, draftFlush: draftFlush, pruneDrafts: pruneDrafts,
  DRAFT_MAX: DRAFT_MAX,
  screenMyTasks: screenMyTasks, openFriendTask: openFriendTask,
  screenTaskBroken: screenTaskBroken, taskBuild: taskBuild, taskProblem: taskProblem,
  taskPack: taskPack, taskUnpack: taskUnpack, taskLink: taskLink, taskKey: taskKey,
  myTasksList: myTasksList, myTaskSave: myTaskSave, myTaskDrop: myTaskDrop,
  workPack: workPack, workUnpack: workUnpack, workLink: workLink, screenWork: screenWork,
  lessonMinutes: lessonMinutes, lessonWords: lessonWords,
  b64urlEnc: b64urlEnc, b64urlDec: b64urlDec, routeHash: routeHash,
  leanAward: leanAward, leanCount: leanCount, leanNote: leanNote, STAR_XP: STAR_XP,
  watchCompute: watchCompute, watchNote: watchNote, watchCut: watchCut,
  lintCode: lintCode, lintHTML: lintHTML, lintKnows: lintKnows, astWalk: astWalk,
  lintCount: lintCount, lintNote: lintNote,
  LINT_MAX: LINT_MAX, LINT_LONG_FUNC: LINT_LONG_FUNC,
  HELP: HELP, openHelp: openHelp, closeHelp: closeHelp, helpIsOpen: helpIsOpen,
  RANKS: RANKS,
  toggleHelp: toggleHelp, screenGuide: screenGuide,
  themeGet: themeGet, themeSet: themeSet,
  lessonSearch: lessonSearch, lessonOpen: lessonOpen,
  ERR_BEASTS: ERR_BEASTS, BEAST_BADGE_AT: BEAST_BADGE_AT, KIND_RU: KIND_RU,
  errSeen: errSeen, errBeaten: errBeaten, beastsBeaten: beastsBeaten,
  beastsMet: beastsMet, beastsHTML: beastsHTML, beastByKind: beastByKind,
  hlWatched: hlWatched, WATCH_MAX_STEPS: WATCH_MAX_STEPS, WATCH_LINE_MAX: WATCH_LINE_MAX,
  LEAN_XP: LEAN_XP, LEAN_BADGE_AT: LEAN_BADGE_AT, FRIEND_XP: FRIEND_XP,
  screenFolio: screenFolio, certList: certList, certBodyHTML: certBodyHTML,
  openCert: openCert, closeCert: closeCert, certIsOpen: certIsOpen,
  certWorldReady: certWorldReady, certCourseReady: certCourseReady,
  certWorldAt: certWorldAt, certCourseAt: certCourseAt,
  certWorldNeed: certWorldNeed, certCourseNeed: certCourseNeed,
  certSectionReady: certSectionReady, certSectionAt: certSectionAt,
  certSectionNeed: certSectionNeed, SECTION_CERTS: SECTION_CERTS,
  worldWhole: worldWhole, worldStars: worldStars, worldSolvedCount: worldSolvedCount,
  fmtDay: fmtDay,
  /* занятие, рамка взрослого, карта активности и задания от взрослого */
  frame: frame, frameSet: frameSet, frameOn: frameOn, frameShape: frameShape,
  blankFrame: blankFrame, isBreakDay: isBreakDay, frameStudyDay: frameStudyDay,
  paceCheck: paceCheck, lessonsLeft: lessonsLeft, studyDaysUntil: studyDaysUntil,
  paceStatHTML: paceStatHTML, MIN_PER_LESSON: MIN_PER_LESSON, MIN_AROUND: MIN_AROUND,
  zanSlots: zanSlots, zanPlanFor: zanPlanFor, zanStart: zanStart, zanOpen: zanOpen,
  zanNote: zanNote, zanFinish: zanFinish, zanReport: zanReport, zanOfDay: zanOfDay,
  zanLast: zanLast, zanMins: zanMins, zanTick: zanTick, zanAll: zanAll,
  zanStats: zanStats, zanSlotsFor: zanSlotsFor, median: median, ZAN_STAT_MIN: ZAN_STAT_MIN,
  todayMinutes: todayMinutes, capOn: capOn, capLeft: capLeft, capReached: capReached,
  capHard: capHard, capNoteHTML: capNoteHTML, CAP_CHOICES: CAP_CHOICES,
  zanOnBreak: zanOnBreak, zanBreakStart: zanBreakStart, zanBreakEnd: zanBreakEnd,
  zanBreakDue: zanBreakDue, ZAN_BREAK: ZAN_BREAK,
  zanRemaining: zanRemaining, zanClosedCount: zanClosedCount, zanSqueeze: zanSqueeze,
  zanCutToCheck: zanCutToCheck, zanCutLast: zanCutLast, zanTimeUp: zanTimeUp,
  screenZan: screenZan, screenZanDone: screenZanDone, screenAdult: screenAdult,
  backTarget: backTarget, syncBack: syncBack,
  screenSpecs: screenSpecs, openSpec: openSpec, specParse: specParse,
  specToPython: specToPython, specRunAll: specRunAll, specVerdict: specVerdict,
  specsList: specsList, specDone: specDone, specSplitArgs: specSplitArgs,
  specTaskById: specTaskById, SPEC_KINDS: SPEC_KINDS,
  screenGroup: screenGroup, groupRow: groupRow, groupLoad: groupLoad,
  groupState: groupState, GROUP_MAX: GROUP_MAX, GROUP_QUIET_DAYS: GROUP_QUIET_DAYS,
  screenShowcase: screenShowcase, showcaseProjects: showcaseProjects,
  showcaseAfter: showcaseAfter, showcaseRun: showcaseRun,
  solvedPack: solvedPack, solvedUnpack: solvedUnpack, solvedLink: solvedLink,
  solvedAdd: solvedAdd, solvedFor: solvedFor, solvedCount: solvedCount, screenSolved: screenSolved,
  screenShop: screenShop, partsFrom: partsFrom, partsList: partsList, partAdd: partAdd,
  partDrop: partDrop, partsHarvest: partsHarvest, partWorks: partWorks, PART_MAX: PART_MAX,
  buildsList: buildsList, buildSave: buildSave, buildDrop: buildDrop, BUILD_MAX: BUILD_MAX,
  myPredictMake: myPredictMake, myPredictPick: myPredictPick, myPredSafe: myPredSafe,
  zanOpenBlock: zanOpenBlock,
  openMyPredict: openMyPredict, zanKeepProg: zanKeepProg, normPred: normPred,
  screenTrace: screenTrace, authorMarks: authorMarks, authorList: authorList,
  authorSummary: authorSummary, authorPredict: authorPredict,
  aheadIn: aheadIn, codeSkeleton: codeSkeleton, AHEAD_PROBES: AHEAD_PROBES,
  sheetById: sheetById, AUTHOR_PASTE_MIN: AUTHOR_PASTE_MIN,
  screenAssign: screenAssign, heatHTML: heatHTML, heatLevel: heatLevel,
  hoursAdd: hoursAdd, hoursRow: hoursRow, pruneHours: pruneHours,
  tickOnce: tickOnce, pageActive: pageActive, actMark: actMark,
  assignPack: assignPack, assignUnpack: assignUnpack, assignLink: assignLink,
  ptaskAdd: ptaskAdd, ptaskList: ptaskList, ptaskPending: ptaskPending,
  ptaskMarkDone: ptaskMarkDone, ptaskWeekCount: ptaskWeekCount,
  ZAN_LEN: ZAN_LEN, ZAN_SANE: ZAN_SANE, IDLE_MS: IDLE_MS,
  setIdleForTest: function(ms){ IDLE_MS = ms; },
  setLessonForTest: function(id){ curLessonId = id; }
};
})();
