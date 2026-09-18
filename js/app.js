/* ============================================================
   Фионика — игровая оболочка.
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

/* Взрослые экраны (кабинет по #admin и полная панель по #panel) закрыты
   ПАРОЛЕМ, который взрослый задаёт сам на своём устройстве (adminHash/adminGate).
   Зашитого в исходник кода больше нет: он был виден любому, кто открыл страницу. */

/* ================= сохранение =================
   Форма прогресса описана ОДИН раз — тремя списками ниже. Раньше её
   переписывали руками в четырёх местах (загрузка, смена ученика, сброс в
   панели репетитора, загрузка файла), и каждое новое поле забывали хотя бы
   в двух из них: так S.games и S.gamesPlayed остались вне слияния и вне
   очистки при смене ученика, а «Сбросить весь прогресс» не сбрасывал
   разминки и «Ты и ИИ». Добавляешь поле — дописываешь его в один список,
   и все четыре места узнают о нём сами.

     PROGRESS_MAPS  множества и словари «id → значение»
     PROGRESS_NUMS  счётчики
     KEEP_ON_RESET  что НЕ трогает сброс в панели репетитора: имя ученика,
                    расписание и то, что ребёнок сделал сам (песочница,
                    свои версии игр). Смена ученика чистит и это тоже.
   ============================================================ */
var KEY = "kodokvest_v2";
var PROGRESS_MAPS = ["stars","log","drawDone","warmups","ailab","games","gamesPlayed",
                     "days","daily","shields","projects","review","drafts",
                     "mytasks","friendTasks","errs","gallery","certAt",
                     "hours","zan","ptasks","hw","specs","parts","builds","solved","algo",
                     "notes","variant",
                     /* Вариант, назначенный репетитором: по ключу на экзамен,
                        { ege:{ seed, mins, at, due }, oge:… }. ⚠️ Это НАЗНАЧЕНИЕ,
                        а не сам вариант: вариант ребёнок соберёт у себя по
                        этому семени, и соберётся у всех один и тот же —
                        сборка есть чистая функция от (экзамен, семя). */
                     "vtask",
                     /* Слова ребёнка к пакету защиты проекта (1.142.0):
                        { projectId: { topic, actual, conclusion, next, at } }.
                        ⚠️ Школу, класс и руководителя НЕ храним — это
                        персональные данные; в документах для них пустые строки. */
                     "defense",
                     /* Проверка «что умеет сам» (js/proverka.js): одна
                        живая или последняя закрытая. Итог по построению живёт
                        в коде результата; здесь только ход проверки. */
                     "proverka",
                     /* Проверка 2 — вторая лестница (экзамен и HTML,
                        15.09.2026) в СВОЁМ слоте: начатая проверка 2 не
                        должна затирать итог первой — кабинет показывает обе. */
                     "proverka2",
                     /* «Я застрял» (13.09.2026): { at, lesson, why, off }.
                        Один сигнал на ученика, три готовые фразы — без
                        свободного текста, см. HELP_WHY. */
                     "help"];
/* codeSaved — единственный ответ продукта на «потерял код — потерял прогресс».
   ⚠️ Это НЕ восстановление: восстанавливать нечем и не будет чем, потому что
   ни почты, ни телефона мы не спрашиваем, и это обещание на вывеске. Это
   отметка «код унесён из браузера»: распечатан, скопирован, записан. Пока её
   нет, тренажёр напоминает. Лежит в прогрессе, а не в настройках устройства,
   и складывается по максимуму: записал на одном устройстве — записал везде,
   и напоминание не догоняет на втором. */
var PROGRESS_NUMS = ["xp","sandboxRuns","firstTry","perfect","codeSaved"];
/* mytasks рядом с games по одной причине: и то и другое ребёнок сделал сам,
   а не «набрал результатов». Сброс прогресса в панели репетитора такое не
   стирает — стирает только смена ученика. */
var KEEP_ON_RESET = ["games","mytasks","gallery","defense"];

/* пустой прогресс: только структура, без данных */
function blankProgress(){
  /* mytaskDraft — недособранное «своё задание» (название, условие, код).
     Живёт рядом с sandbox и по той же причине: это не результат занятий,
     а незаконченная работа ребёнка, и терять её на переходе нельзя. */
  var o = { v:2, badges:[], sandbox:null, mytaskDraft:null, name:"", schedule:{ days:[] },
            frame: blankFrame(), now:null };
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
  /* «чем занят сейчас»: место и урок, обновляется активным тиком. Едет на
     сервер с прогрессом — из него взрослый видит статус присутствия */
  if (!o.now || typeof o.now !== "object" || typeof o.now.at !== "number") o.now = null;
  if (!o.mytaskDraft || typeof o.mytaskDraft !== "object") o.mytaskDraft = null;
  if (typeof o.name !== "string") o.name = "";
  if (!o.schedule || typeof o.schedule !== "object") o.schedule = { days:[] };
  if (!Array.isArray(o.schedule.days)) o.schedule.days = [];
  o.frame = frameShape(o.frame);
  if (!o.admin || typeof o.admin !== "object") o.admin = { unlockAll:false };
  /* Подписи учеников у репетитора. Живут в admin, то есть на ЕГО устройстве,
     и на сервер не уходят — как и все настройки устройства. Это прямое
     следствие того, что имя ребёнка больше не синхронизируется (cloudSnapshot):
     сервер знает только код, а «Петя, 5 класс» знает репетитор у себя. */
  if (!o.admin.labels || typeof o.admin.labels !== "object") o.admin.labels = {};
  /* ===== устройство взрослого =====
     Разделение ролей идёт по УСТРОЙСТВУ, а не по аккаунту: настоящей
     авторизации у статического сайта нет и не будет. Мак взрослого помечается
     как админский раз и навсегда, детские устройства о кабинете не знают
     вовсе — там нет ни кнопки, ни упоминания адреса.
     Всё это живёт в admin, а значит: на сервер не уходит (CLOUD_SKIP) и не
     стирается ни сбросом прогресса, ни сменой ученика. */
  if (typeof o.admin.isAdmin !== "boolean") o.admin.isAdmin = false;
  if (typeof o.admin.pass !== "string") o.admin.pass = "";
  /* код ребёнка, за которым следит родитель на этом устройстве (пусто — не родитель) */
  if (typeof o.admin.parentOf !== "string") o.admin.parentOf = "";
  if (typeof o.admin.parentLabel !== "string") o.admin.parentLabel = "";
  /* Ученики этого взрослого: код на сервере + имя, которое знает только он.
     Имя ребёнка на сервер не уходит принципиально, поэтому список имён —
     собственность устройства взрослого. */
  if (!Array.isArray(o.admin.kids)) o.admin.kids = [];
  o.admin.kids = o.admin.kids.filter(function(k){ return k && typeof k.code === "string"; });
  /* какой список учеников уже сохранён файлом (kidsListMarkSaved) */
  if (typeof o.admin.kidsSavedSig !== "string") o.admin.kidsSavedSig = "";
  if (typeof o.admin.kidsSavedAt !== "number") o.admin.kidsSavedAt = 0;
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
  o.now = null;
  /* ⚠️ Рамку взрослого целиком здесь стирать НЕЛЬЗЯ. Раньше стирали — и потолок
     дня, жёсткий режим, дни занятий и каникулы исчезали от двух тапов в детском
     профиле («Выйти» → «Да»). Родительское ограничение, которое снимает сам
     ограничиваемый, ограничением не является.
     Поэтому делим рамку надвое: правила взрослого (дни, длина, потолок, каникулы)
     принадлежат УСТРОЙСТВУ и остаются, а привязанное к конкретному ребёнку —
     дата-цель и замеренный лично его темп — уходит вместе с ним. */
  var keep = frameShape(o.frame);
  keep.goal = null;                 /* дата ставилась под того ребёнка */
  keep.perLesson = null;            /* темп замерен по тому ребёнку */
  o.frame = keep;
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
   панели репетитора, где считается стрик и чужого ученика по его данным */
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
   Работает с ЛЮБЫМ набором данных — это нужно панели репетитора, где стрик
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
/* ⚠️ Щит НИЧЕГО не говорит (план, п. 4.4). Раньше отсюда возвращалась
   плашка «🛡️ Щит закрыл пропуск — серия не оборвалась»: она сообщала ребёнку
   ровно две вещи, и обе лишние — что он пропустил день и что серия была под
   угрозой. Механизм остался, отметку о срабатывании просто гасим молча:
   ребёнку с ней всё равно нечего делать, тратить щит руками нельзя. */
function takeShieldNote(){
  shieldJustUsed = null;
  return "";
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
/* ===== о чём договорились: ОДИН ответ на весь продукт =====
   ⚠️ Рамка взрослого сильнее расписания ребёнка — это было записано словами в
   шапке рамки, но выполнялось лишь местами. Редактор дней рамку уважал, а
   «Сегодня» — главный экран ребёнка — читал только scheduleDays(): поставил
   репетитор занятия по субботам, а ребёнок видит «Уговор пока не назначен» и
   «сегодня можно отдыхать». Разбор трёх ролей, 12.09.2026.
   Три вопроса — три функции, и больше нигде этот выбор не повторяется
   (§ 4.18: защита от класса ошибок стоит в ОДНОМ месте). */
function agreedDays(){ return frameOn() ? frame().days.slice() : scheduleDays(); }
function agreedOn(){ return agreedDays().length > 0; }
function agreedStudyDay(key){ return frameOn() ? frameStudyDay(key) : isStudyDay(key); }
function studyDue(){ return agreedOn() && agreedStudyDay(dayKey()) && !activeOn(dayKey()); }

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
           perLesson:null, cap:0, capHard:false, setAt:0, time:null, until:null };
}
/* «17:00» — время НАЧАЛА занятия. Хранится строкой «ЧЧ:ММ» и живёт в рамке
   взрослого, а не в расписании ребёнка: день ребёнок себе выбрать может,
   час занятия с репетитором — нет. Пусто — значит время не назначено, и
   продукт нигде его не выдумывает.
   ⚠️⚠️ ФУНКЦИЯ, а не `var TIME_RE`. Оплачено ошибкой 12.09.2026: константа
   присваивалась на строке 463, а ensureShape(S) зовётся на 199 — и у всякого,
   у КОГО ЧАС УЖЕ СОХРАНЁН, тренажёр падал при загрузке ещё до первой
   отрисовки. Тесты молчали: на чистом состоянии time равен null, проверка
   `typeof o.time === "string"` не доходила до регулярки, и порядок не был
   виден. Объявление функции поднимается целиком, поэтому порядок строк
   перестаёт что-либо значить — класс ошибки закрыт, а не случай. */
function validTime(v){ return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)); }
function frameShape(f){
  var o = (f && typeof f === "object") ? f : {};
  var out = blankFrame();
  if (Array.isArray(o.days))
    out.days = o.days.filter(function(n){ return typeof n === "number" && n >= 0 && n <= 6; });
  if (ZAN_LEN.indexOf(o.len) >= 0) out.len = o.len;
  if (ZAN_MIX.indexOf(o.mix) >= 0) out.mix = o.mix;
  if (typeof o.goal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.goal)) out.goal = o.goal;
  if (typeof o.time === "string" && validTime(o.time)) out.time = o.time;
  if (typeof o.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.until)) out.until = o.until;
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
/* ⚠️ Когда взрослый настраивает расписание СО СВОЕГО устройства, править надо
   не свою рамку, а рамку выбранного ребёнка — ту, что загружена с сервера.
   kidTarget включает этот режим, и все существующие органы управления рамкой
   (дни, длина, потолок, каникулы, дата) начинают работать на ребёнка без
   единой правки в них самих. Пусто — значит рамка своя, как раньше. */
var kidTarget = null;      /* { code, name, data, dirty } */
function frame(){
  if (kidTarget && kidTarget.data){
    kidTarget.data.frame = frameShape(kidTarget.data.frame);
    return kidTarget.data.frame;
  }
  S.frame = frameShape(S.frame); return S.frame;
}
function frameOn(){ return frame().days.length > 0; }
function frameSet(patch){
  var f = frameShape(Object.assign({}, frame(), patch || {}));
  f.setAt = Date.now();
  if (kidTarget && kidTarget.data){
    /* setAt свежее, чем у ребёнка на устройстве, — значит при следующем обмене
       победит эта рамка (слияние рамки идёт по «свежее побеждает»). */
    kidTarget.data.frame = f;
    kidTarget.dirty = true;
    return f;
  }
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
/* ===== план занятий: даты, время, горизонт =====
   Рамка до этого умела говорить «по субботам». Фаундер попросил «по субботам
   в 17:00, и так на месяц-два-три» — то есть два недостающих куска: ЧАС и
   ГОРИЗОНТ. Оба живут в рамке взрослого (см. blankFrame).

   ⚠️ Горизонт и «успеть к дате» — разные вещи, и путать их нельзя:
   goal  — к какому числу надо ПРОЙТИ курс (из него считается темп);
   until — до какого числа мы вообще ЗАНИМАЕМСЯ (из него растёт календарь).
   У репетитора это «занимаемся до конца четверти», а не «сдать к экзамену». */
function frameTime(){ var t = frame().time; return validTime(t || "") ? t : ""; }
/* Прибавить месяцы к дате. 31 января + 1 месяц = 28 февраля, а не 3 марта:
   иначе «+1 месяц» от конца месяца перепрыгивал бы через месяц целиком. */
function addMonths(key, n){
  var p = String(key).split("-");
  var y = +p[0], m = +p[1] - 1 + n, d = +p[2];
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  var last = new Date(y, m + 1, 0).getDate();
  if (d > last) d = last;
  return y + "-" + (m + 1 < 10 ? "0" : "") + (m + 1) + "-" + (d < 10 ? "0" : "") + d;
}
/* Даты занятий от сегодня до горизонта: дни недели рамки минус каникулы.
   Сегодня входит — занятие в 17:00 ещё впереди, и убирать его из плана
   значило бы соврать в день, когда план как раз и смотрят. */
function planDates(limit){
  var f = frame();
  if (!f.days.length) return [];
  var until = f.until || addMonths(dayKey(), 3);
  var out = [], cur = dayKey(), guard = 0;
  while (cur <= until && guard++ < 800){
    if (f.days.indexOf(weekdayOf(cur)) >= 0 && !isBreakDay(cur)) out.push(cur);
    if (limit && out.length >= limit) break;
    cur = shiftDay(cur, 1);
  }
  return out;
}
/* Вся рамка одной строкой: «по субботам в 17:00, занятие 30 минут, до 12.11».
   ⚠️ Это ГЛАВНОЕ предложение экрана расписания. До 12.09.2026 его не было
   вовсе: взрослый читал семь блоков органов управления и сам складывал из них
   ответ на вопрос «так когда же занятия?». Строка отвечает за них всех. */
function zanSlovami(f){
  f = f || frame();
  if (!f.days.length) return "Дни занятий не отмечены";
  var wd = f.days.slice().sort(function(a, b){ return WD_ORDER.indexOf(a) - WD_ORDER.indexOf(b); })
    .map(function(n){ return WD_FULL_PO[n]; }).join(", ");
  var out = "По " + wd;
  if (f.time) out += " в " + f.time;
  out += ", занятие " + f.len + " " + plural(f.len, "минута", "минуты", "минут");
  if (f.until) out += ", до " + f.until.split("-").reverse().join(".");
  return out;
}
var WD_FULL_PO = ["воскресеньям", "понедельникам", "вторникам", "средам",
                  "четвергам", "пятницам", "субботам"];

/* ===== файл календаря (.ics) =====
   ⚠️ Почему файл, а не напоминание из тренажёра. Толчок в 17:00 умеет только
   тот, кто работает, когда страница закрыта: почта или web-push с отдельным
   сервером ключей. Ни того, ни другого у нас нет (§ 2 «Напоминание взрослому»
   так и помечено «ждёт почты»), и обещать напоминание было бы враньём.
   А Календарь на маке и телефоне это умеет с 2007 года. Поэтому мы отдаём
   ему событие с повтором — и напоминает Apple, честно и без нашего сервера.

   Время пишем ПЛАВАЮЩЕЕ (без Z и без TZID): «17:00» значит семнадцать часов
   там, где человек живёт. С часовым поясом пришлось бы тащить в файл базу
   переходов на летнее время, а занятие в 17:00 не должно уезжать на час
   дважды в год. */
var ICS_WD = ["SU","MO","TU","WE","TH","FR","SA"];
function icsEsc(v){
  return String(v).replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");
}
function icsStamp(key, time){ return key.replace(/-/g, "") + "T" + time.replace(":", "") + "00"; }
/* конец занятия = начало + длина; переход через полночь не считаем — занятие
   в 23:50 на 45 минут никто не ставит, а лишняя арифметика тут только вредит */
function icsEnd(time, mins){
  var p = time.split(":"), t = (+p[0]) * 60 + (+p[1]) + mins;
  if (t > 23 * 60 + 59) t = 23 * 60 + 59;
  var hh = Math.floor(t / 60), mm = t % 60;
  return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
}
function icsForFrame(who){
  var f = frame(), time = frameTime();
  if (!f.days.length || !time) return "";
  var dates = planDates(0);
  if (!dates.length) return "";
  var first = dates[0];
  var until = f.until || addMonths(dayKey(), 3);
  var byday = f.days.slice().sort(function(a, b){ return a - b; })
    .map(function(n){ return ICS_WD[n]; }).join(",");
  /* каникулы внутри горизонта — исключения, а не дыры: календарь не должен
     звать на занятие в день, о пропуске которого договорились */
  var skip = [], cur = first, guard = 0;
  while (cur <= until && guard++ < 800){
    if (f.days.indexOf(weekdayOf(cur)) >= 0 && isBreakDay(cur)) skip.push(icsStamp(cur, time));
    cur = shiftDay(cur, 1);
  }
  var title = "Занятие по программированию" + (who ? " — " + who : "");
  var L = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fionika//Zanyatiya//RU",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    /* UID склеен из того, что событие и описывает: первая дата и дни недели.
       Значит повторная выгрузка того же плана обновит событие в календаре,
       а не заведёт рядом второе. */
    "UID:fionika-" + first.replace(/-/g, "") + "-" + byday.replace(/,/g, "") + "@fionika",
    "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""),
    "DTSTART:" + icsStamp(first, time),
    "DTEND:" + icsStamp(first, icsEnd(time, f.len)),
    "RRULE:FREQ=WEEKLY;BYDAY=" + byday + ";UNTIL=" + until.replace(/-/g, "") + "T235959"
  ];
  if (skip.length) L.push("EXDATE:" + skip.join(","));
  L.push("SUMMARY:" + icsEsc(title));
  L.push("DESCRIPTION:" + icsEsc("Занятие на " + f.len + " минут. Тренажёр «Фионика»."));
  L.push("BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY",
         "DESCRIPTION:" + icsEsc(title + " через 30 минут"), "END:VALARM");
  L.push("END:VEVENT", "END:VCALENDAR");
  return L.join("\r\n") + "\r\n";
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
/* ⚠️ Считает по ЛЮБОМУ снимку, а не только по своему. Без этого кабинет
   репетитора, где рамка правится удалённо у выбранного ученика, считал
   «сколько уроков осталось» по прогрессу САМОГО РЕПЕТИТОРА и обещал родителю
   чужую дату. Пусто — значит своё состояние, как раньше. */
function lessonsLeft(st){
  var sm = (st && st.stars) ? st.stars : S.stars;
  var n = 0;
  CURRICULUM.forEach(function(w){
    worldReadyLessons(w).forEach(function(l){ if (sm[l.id] === undefined) n++; });
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
function paceCheck(goal, days, len, st){
  var left = lessonsLeft(st);
  var sessions = studyDaysUntil(goal, days || frame().days);
  /* ⚠️ Ноль занятий до даты — это НЕ «всё в порядке», а «посчитать не из чего»:
     либо не отмечен ни один день недели, либо дата уже прошла. Раньше отсюда
     возвращался объект без mins, и кабинет печатал родителю «примерно
     undefined минут на занятие». Помечаем случай отдельно, чтобы экран сказал
     словами, чего не хватает, вместо выдуманного числа. */
  if (!goal || !sessions)
    return { ok:true, none:true, sessions:sessions, left:left, need:0,
             past: !!(goal && goal <= dayKey()), nodays: !(days || frame().days).length };
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

/* ================= план и факт =================
   Корзина 3.5. Репетитор, открывая группу, спрашивает про ученика не «сколько
   пройдено», а «успевает ли». «Всего 24 урока» на этот вопрос не отвечает:
   двадцать четыре урока за месяц по три занятия в неделю — это впереди плана,
   а за полгода — далеко позади. Разница в том, с чем сравнивать, и сравнивать
   мы имеем право только с РАМКОЙ, которую поставил взрослый.

   Как считается:
     точка отсчёта — день, когда рамку сохранили (frame.setAt);
     план          — учебные дни от неё до сегодня (дни недели минус каникулы)
                     × уроков в занятие (по длине, а если замер темпа принят —
                     по замеру этого ребёнка);
     факт          — уроки, сданные ПОСЛЕ той же точки отсчёта.
   ⚠️ Обе половины считаются от одного дня. Уроки, пройденные до того, как
   рамку задали, к этому плану отношения не имеют, и складывать их с ним
   значит сравнивать разные вещи.

   ⚠️ Три ограничения, каждое из красной линии «это не табель»:
     1. допуск — одно занятие. Меньше — «идёт по плану», а не «отстаёт на 1»:
        точность здесь мнимая, а обвинение настоящее;
     2. «впереди» показывается ровно так же заметно, как «отстаёт». Колонка,
        у которой есть только плохая половина, и есть табель;
     3. без рамки план НЕ выдумывается по среднему темпу. Молчим и говорим,
        что рамки нет: придуманный план обвинял бы ребёнка за нашу догадку.

   Работает на ЛЮБОМ снимке — ничего не берёт из S, поэтому годится и строке
   группы, и своему кабинету. */
function planFact(st){
  st = st || {};
  var f = frameShape(st.frame);
  if (!f.days.length) return { none: "noframe" };
  if (!f.setAt)       return { none: "nodate" };

  var start = dayKey(new Date(f.setAt)), today = dayKey();
  if (start > today) return { none: "nodate" };

  /* уроков в занятие: по замеру этого ребёнка, если взрослый его принял.
     ⚠️ Своя копия расчёта, а не zanSlotsFor(): та смотрит в frame(), то есть
     в СВОЮ рамку, и на чужом снимке считала бы по чужой длине занятия. */
  var per = f.perLesson
    ? Math.max(1, Math.min(6, Math.round((f.len - MIN_AROUND) / f.perLesson)))
    : zanSlots(f.len);

  /* учебные дни от точки отсчёта до сегодня. День, в который рамку сохранили,
     не считаем: занятие в него могло уже пройти, а могло и не начаться. */
  var days = 0, cur = start, guard = 0;
  while (cur < today && guard++ < 1200){
    cur = shiftDay(cur, 1);
    if (f.days.indexOf(weekdayOf(cur)) < 0) continue;
    if (f.breaks.some(function(b){ return cur >= b[0] && cur <= b[1]; })) continue;
    days++;
  }

  var sm = st.stars || {}, lg = st.log || {};
  var before = 0, fact = 0;
  Object.keys(sm).forEach(function(id){
    var at = (lg[id] || {}).solvedAt || 0;
    if (at && at >= f.setAt) fact++; else before++;
  });

  /* ⚠️ Больше, чем осталось в курсе, спланировать нельзя: иначе ребёнок,
     дошедший до последнего урока, вечно «отстаёт» от плана, который физически
     некуда выполнять. */
  var total = 0;
  CURRICULUM.forEach(function(w){ total += worldReadyLessons(w).length; });
  var plan = Math.min(days * per, Math.max(0, total - before));

  var diff = fact - plan;
  return {
    plan: plan, fact: fact, diff: diff, per: per, days: days, since: start,
    lessons: Math.abs(diff),
    zan: Math.floor(Math.abs(diff) / per),
    kind: diff <= -per ? "behind" : (diff >= per ? "ahead" : "ontrack")
  };
}
/* Одна строка про план — словами, без процентов и без оценки. */
function planFactText(pf){
  if (!pf || pf.none) return pf && pf.none === "noframe"
    ? "рамка занятий не задана — плана нет"
    : "рамка задана без даты — считать не от чего";
  if (pf.kind === "ontrack") return "идёт по плану";
  var n = pf.lessons;
  var s = (pf.kind === "behind" ? "отстаёт от рамки на " : "впереди рамки на ") +
    n + " " + plural(n, "урок", "урока", "уроков");
  /* Расстояние в занятиях, а не в процентах: занятие — то, чем взрослый
     распоряжается, а процент ему нечего делать. */
  if (pf.zan >= 1) s += " — это " + pf.zan + " " + plural(pf.zan, "занятие", "занятия", "занятий");
  return s;
}
/* Чей прогресс сейчас в руках у взрослого: выбранного ученика или свой.
   Та же развилка, что у frame(), и по той же причине. */
function frameState(){ return (kidTarget && kidTarget.data) ? kidTarget.data : S; }

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
/* ⚠️ Снимок необязательным доводом, по образцу frameState/planFact(st).
   Без него замер занятий считался ТОЛЬКО по своему состоянию, и кабинет
   родителя показать его не мог — функция про чужого ребёнка ничего не знала.
   Пусто — значит своё состояние, как было. */
function zanAll(st){ var o = st || S; o.zan = o.zan || {}; return o.zan; }
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
/* ⚠️ Первое занятие после паузы — короче. Пункт 4.3б, отложенный в 1.61.
   Ребёнок, пропустивший неделю, открывал занятие и видел полный план: три
   новых урока подряд. Это ровно та цена входа, из-за которой возвращение и
   не случается, — а карточка «С возвращением» в двух экранах отсюда обещает
   ПРОТИВОПОЛОЖНОЕ: «после паузы легче входить с малого». Обещание и план
   спорили друг с другом, и верил ребёнок плану.
   Меняется два: шагов на один меньше, и первым идёт знакомое (повтор), а не
   новый урок. Ни слова упрёка и ни одной цифры пропуска — те же правила, что
   у карточки возвращения: виноватый не возвращается.
   ⚠️ Рамку взрослого это не ломает: если он попросил «только новое»
   (mix = "new"), повтор не подставляется — короче становится всё равно. */
function zanAfterPause(){
  var gap = daysSincePause();
  return gap !== null && gap >= PAUSE_DAYS;
}
/* План занятия. Детерминирован по дате и текущему прогрессу: на двух
   устройствах в один день выходит одно и то же. */
function zanPlanFor(key){
  key = key || dayKey();
  var f = frame(), slots = zanSlotsFor(f.len), plan = [];
  var back = zanAfterPause();
  if (back) slots = Math.max(1, slots - 1);
  var warm = dailyPick(key);
  if (warm) plan.push({ k:"warm", id:warm.id, title:warm.title });

  var due = reviewDue();
  var wantRepeat = f.mix === "repeat" ? Math.min(due.length, slots - 1)
                 : f.mix === "new" ? 0
                 : Math.min(due.length, 1);
  /* после паузы повтор в плане обязателен, если долг есть: это и есть тот
     «лёгкий вход», ради которого занятие сокращается */
  if (back && f.mix !== "new") wantRepeat = Math.min(due.length, Math.max(wantRepeat, 1));
  var newCount = Math.max(0, slots - wantRepeat);

  /* новые уроки: следующие непройденные по порядку курса */
  var picked = [];
  CURRICULUM.forEach(function(w){
    if (picked.length >= newCount) return;
    var ready = worldReadyLessons(w);
    for (var i = 0; i < ready.length && picked.length < newCount; i++)
      if (!solved(ready[i].id)) picked.push(ready[i]);
  });
  var lessons = picked.map(function(l){ return { k:"lesson", id:l.id, title:l.title }; });
  var repeats = due.slice(0, wantRepeat).map(function(r){
    return { k:"review", id:r.lesson.id, title:r.lesson.title };
  });
  /* после паузы знакомое идёт впереди нового, в обычный день — наоборот */
  (back ? repeats.concat(lessons) : lessons.concat(repeats)).forEach(function(b){ plan.push(b); });

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
function zanStats(st){
  var mins = [], per = [], lessons = [], all = zanAll(st);
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
  /* Точное время работы: «Занятие 12 мин 40 сек». Округление до минут в
     отчёте взрослому — та же неточность, что и «—» вместо сорока секунд. */
  var was = "Занятие " + fmtDur((rec.sec || 0) * 1000);
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
/* Код унесён из браузера? ⚠️ Отметка ставится только по ДЕЙСТВИЮ ребёнка
   (напечатал, скопировал, нажал «записал»), а не по факту «мы показали».
   Показать код и решить за него, что он его запомнил, — это и есть тот самый
   способ потерять доступ, от которого всё это заведено. */
function codeSaved(){ return !!S.codeSaved; }
function markCodeSaved(){ if (!S.codeSaved){ S.codeSaved = 1; save(); } }
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
/* Код ученика: нейтральное слово и короткий случайный хвост — «sova-3f7a2».
   ⚠️ БЕЗ ИМЕНИ, решение фаундера 13.09.2026. До этого код собирался из имени
   латиницей («anya-3f7a»), и имя уходило на сервер ключом записи — при том что
   сам снимок имя честно вырезал (CLOUD_SKIP), а политика обещала «код с именем
   не связан». Слово нужно только затем, чтобы код легко продиктовать; угадать
   его оно не помогает — вся случайность в хвосте, как и раньше.
   ⚠️ Уже выданные коды не меняются: код — ключ прогресса, смени его — и
   ребёнок потеряет всё. Политика говорит об этом прямо.
   Слова — не имена: «vera», «mira», «nika» и подобные в список не берём. */
var CODE_WORDS = ["kot", "yozh", "sova", "lis", "kit", "bobr", "orel", "volk", "enot", "les",
  "reka", "gora", "more", "pole", "sad", "luch", "dozhd", "sneg", "grom", "veter",
  "kometa", "orbita", "raketa", "planeta", "atom", "pixel", "bit", "bayt", "kod", "cikl",
  "robot", "kvant", "vektor", "prizma", "kubik", "shar", "romb", "krug", "tochka", "mayak"];
function newKidCode(){
  var word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length) % CODE_WORDS.length];
  var suf = (Math.random().toString(36) + "00000").slice(2, 7);   /* 5 знаков */
  return Cloud.validCode(word + "-" + suf) || ("kid-" + suf);
}
/* очистить локальный прогресс — чтобы войти в другой аккаунт начисто, а не
   смешать двух детей на одном устройстве. Настройки устройства (admin) не трогаем. */
function resetProgressLocal(){
  clearAll(S);
  save();
}
/* создать аккаунт по имени и уйти на карту миров (opts.stay — остаться, где
   стоим: так имя вписывают в карточке победы, поверх урока) */
function doRegister(name, onErr, opts){
  name = String(name || "").trim();
  if (name.length < 2){ if (onErr) onErr("Впиши имя — хотя бы две буквы."); return; }
  var stay = !!(opts && opts.stay);
  /* ⚠️ Стираем только ЧУЖОЙ прогресс — записанный под другим кодом или
     именем: иначе на общем компьютере двое детей смешались бы в одного.
     Прогресс ГОСТЯ (ни кода, ни имени) — его собственный: он решал уроки
     сам и вписывает имя, чтобы СОХРАНИТЬ сделанное, а не начать с нуля.
     До 1.138.0 здесь стиралось всё подряд, и спросить имя после первой
     победы (решение 11.09.2026) значило бы стереть эту самую победу. */
  if (myCode() || S.name) resetProgressLocal();
  S.name = name;
  if (serverOn()){
    Cloud.setCode(newKidCode());
    save();
    /* ⚠️ Карту миров показываем СРАЗУ, не дожидаясь сети. Раньше отрисовка
       висела в then у cloudPush, и получалось две беды: ребёнок пару секунд
       смотрел на экран регистрации, пока идёт запрос, а взрослый, успевший за
       это время уйти в кабинет, оказывался выброшен обратно на главный экран —
       запоздавший ответ сервера перерисовывал экран поверх открытого.
       Ответ сервера теперь трогает только верхнюю панель, и только если с неё
       никуда не ушли. */
    refreshTop(); if (!stay) screenWorlds();
    var seq = screenSeq;
    var done = function(){ if (screenSeq === seq) refreshTop(); };
    cloudPush().then(done, done);
  } else {
    save(); refreshTop(); if (!stay) screenWorlds();
  }
}
/* войти по уже существующему коду (например, с другого устройства) */
function doLogin(code, onErr){
  var v = (typeof Cloud !== "undefined") ? Cloud.validCode(code) : null;
  if (!v){ if (onErr) onErr("Код: 3–32 знака, маленькие латинские буквы, цифры, дефис, подчёркивание."); return; }
  if (!serverOn()){ if (onErr) onErr("Сервер не подключён — вход по коду недоступен."); return; }
  /* ⚠️ Порядок здесь важнее, чем кажется. Раньше код записывался и локальный
     прогресс стирался ДО запроса: опечатка в коде, отвалившаяся сеть или
     ошибка сервера — и прогресс уже уничтожен, а прежний код устройства затёрт,
     то есть вернуться не по чему. Хуже всего была именно опечатка: сервер
     отвечал «такого нет», ошибки не было вовсе, и ребёнок оказывался на карте
     миров с нулём и без единого слова объяснения.
     Теперь сначала СПРАШИВАЕМ, и стираем только когда есть что положить взамен. */
  var prev = Cloud.myCode();
  Cloud.load(v).then(function(res){
    if (!res.found || !res.data){
      if (onErr) onErr("На сервере нет ученика с кодом «" + v + "». Проверьте код — " +
                       "прогресс на этом устройстве не тронут.");
      return;
    }
    Cloud.setCode(v);
    resetProgressLocal();             /* чистим, чтобы забрать чужой аккаунт начисто */
    applyProgress(res.data);
    refreshTop(); screenWorlds();
  }, function(err){
    if (prev) Cloud.setCode(prev);     /* не вышло — оставляем устройство как было */
    if (onErr) onErr(err.message || "Не удалось войти.");
  });
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
   «занимался» всё это время. Пока цифра жила в панели репетитора, это была
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
    /* статус присутствия: место и открытый урок. Уедет на сервер обычным
       путём (save → schedulePush, не чаще раза в 25 секунд) — никаких новых
       запросов ради него не появляется */
    S.now = { at: Date.now(), place: curPlace, lesson: curLessonId || null };
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
    /* Кабинет взрослого. «Мои ученики» — вершина, назад некуда. Карточка ученика
       и вход/настройка ведут в список, а не на детскую «главную». */
    case "kids": case "adminsetup": case "adminlogin": return null;
    case "kid": return { label:"К ученикам", go: screenKids };
    /* Выбор роли на общем компьютере и кабинет родителя. Экран выбора и сам
       кабинет — вершины (назад некуда), а формы входа возвращают к выбору. */
    /* Вывеска — вершина: назад с неё некуда, это и есть начало сайта.
       А вот с выбора роли назад ЕСТЬ куда, пока устройство ничьё: человек
       мог открыть двери просто чтобы посмотреть, и должен уметь вернуться
       к описанию. На закреплённом устройстве возврат не нужен — там на том
       же экране стоит «← Остаться как есть». */
    case "about": case "parent": return null;
    case "roles": return (isAdminDevice() || isParentDevice() || myCode() || S.name)
      ? null : { label:"О тренажёре", go: screenAbout };
    case "kidlogin": case "parentlogin": return { label:"К выбору", go: screenRoles };
    case "lostcode": return { label:"Ко входу", go: screenKidLogin };

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

    case "warm": case "games": case "sand": case "viz": case "ai": case "algo":
    case "variant":
      return { label:"К тренировкам", go: screenTrain };
    /* ⚠️ Задача открывается из двух мест, и кнопка обязана называть ТО, куда
       она правда ведёт. Пока она говорила «Ко всем задачам», а вела в вариант,
       это была не мелочь: кнопка, соврав один раз, перестаёт читаться вовсе. */
    case "algoone":  return algoBack
      ? { label: algoBack.backLabel, go: algoBack.go }
      : { label:"Ко всем задачам", go: screenAlgo };
    /* Приёмка — ступень раздела «Ты и ИИ», а не сосед по тренировкам:
       и дорога назад обязана это подтверждать. */
    case "specs":    return { label:"В «Ты и ИИ»", go: screenAILab };
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
    case "group":     return { label:"В панель", go: function(){ screenAdmin(); } };
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

/* ⚠️ «Домой» у каждой роли своё. Жалоба с боя (05.09.2026): родитель нажал
   «Фионика» в шапке и оказался в тренажёре ребёнка — при том, что вся
   детская навигация у него спрятана, и логотип был единственной кнопкой на
   экране. Раньше это чинили по одной кнопке за раз («На главную» в кабинете,
   выброс из кабинета при регистрации); теперь дом считается из роли в одном
   месте, и все кнопки «домой» зовут его. */
/* ⚠️ Логотип и «домой» — РАЗНЫЕ вещи, и это выяснилось жалобой фаундера
   07.09.2026. Для ребёнка они совпадают: его главная и есть уроки. А взрослый,
   стоя в кабинете, жал на логотип и не получал НИЧЕГО — goHome честно
   возвращал его на тот самый кабинет, где он уже стоял. Выйти на общую
   страницу сайта можно было только ссылкой в самом низу («О тренажёре»),
   до которой мало кто долистывает.
   Поэтому логотип ведёт на главную страницу САЙТА. Кабинет при этом никуда
   не делся: он остался отдельной кнопкой в шапке справа — той самой, где
   написано «Кабинет репетитора». Две дороги, обе видны. */
function goLogo(){
  if (isAdminDevice() || isParentDevice()) return screenAbout();
  return goHome();
}

function goHome(){
  if (isAdminDevice()) return screenAdminHome();
  if (parentOf()) return screenParent();
  /* ⚠️ Гость — тоже роль, и дом у неё свой. Пока устройство ничьё, «домой»
     обязано вести на ВЫВЕСКУ, а не на карту миров: у гостя там ноль звёзд,
     «с чего начать» и ни одного слова о том, куда он попал и как вернуться.
     Это ровно та же ошибка, от которой в 1.65.0 лечили родителя, только с
     другого конца: тогда взрослый проваливался в тренажёр ребёнка, теперь
     туда же проваливался бы человек, который ещё ничего не выбрал. */
  if (!myCode() && !S.name) return screenAbout();
  return screenWorlds();
}

/* ⚠️ Надпись кнопки «домой» обязана называть ТО МЕСТО, куда она ведёт
   (§ 4.21). Кнопка одна на весь продукт (#tomap, двадцать штук в шести
   файлах), а дом у каждой роли свой — его выбирает goHome. Надпись же до
   12.09.2026 была одна на всех: «На главную». Жалоба фаундера: «нажал
   Тренировки, потом На главную — и оказался в кабинете взрослого». Кнопка не
   соврала про дорогу, она соврала про МЕСТО: домой для кабинета — кабинет.
   Слова и дорога считаются рядом, чтобы не разъехались. */
function homeLabel(){
  if (isAdminDevice() || parentOf()) return "В кабинет";
  if (!myCode() && !S.name) return "На главную страницу";
  return "На главную";
}
/* Проставляется в refreshTop по той же причине, что и место человека: туда
   заходят все экраны без исключения, и забыть негде. Метка data-home
   отделяет кнопки «домой» от соседей с тем же id, но другой дорогой
   («← К тренировкам», «← В „Ты и ИИ“»). */
function homeBtnSync(){
  var b = document.getElementById("tomap");
  if (!b || b.getAttribute("data-home") !== "1") return;
  b.textContent = "← " + homeLabel();
}

/* Экраны, которые СЧИТАЮТСЯ кабинетом. Список явный, а не «всё, что не
   вывеска»: урок, открытый взрослым для просмотра, кабинетом не является, и
   обновление на нём не должно вышвыривать человека в список учеников. */
var ROOM_PLACES = ["admin", "kids", "kid", "group", "parent", "adult",
                   "adminsetup", "adminlogin", "parentlogin", "roles"];
function refreshTop(){
  syncBack();
  homeBtnSync();
  /* Набор применяется здесь по той же причине, что и место человека: сюда
     заходят все экраны без исключения, и забыть его негде. Заодно закрытый
     набор слетает сам, как только прогресс сменился. */
  skinApply();
  /* ⚠️ Место отмечаем ЗДЕСЬ, а не в каждом экране по отдельности: refreshTop
     зовут все экраны без исключения, и забыть его негде. Раскладывать те же
     две строки по десятку функций значит однажды пропустить одну. */
  if (isAdminDevice() || isParentDevice()){
    if (curPlace === "about") setPlace("home");
    else if (ROOM_PLACES.indexOf(curPlace) >= 0) setPlace("room");
  }
  /* На устройстве взрослого детская навигация ни к чему: вкладки уроков,
     звёзды, опыт, «Сегодня», «Повторить» — всё это про ребёнка. Прячем весь
     этот ряд и оставляем только логотип и «?», чтобы кабинет не выглядел как
     детский экран и не смущал самого взрослого. Класс на body, чтобы разметку
     скрывал CSS, а не JS перебором элементов. */
  /* Детская навигация прячется и на самих экранах кабинета, включая вход и
     первичную настройку, — иначе «Сделать устройство кабинетом» соседствует со
     звёздами и «Новичком», что противоречит смыслу экрана. */
  var adminScreen = isAdminDevice() || isParentDevice() ||
    curPlace === "adminsetup" || curPlace === "adminlogin" ||
    curPlace === "kids" || curPlace === "kid" ||
    curPlace === "roles" || curPlace === "kidlogin" || curPlace === "lostcode" ||
    curPlace === "parentlogin" || curPlace === "parent" ||
    /* Вывеска — тоже не детский экран: «0 XP», «★ 0» и ранг «Новичок» рядом
       с описанием продукта показывают гостю его несуществующий прогресс. */
    curPlace === "about";
  /* ===== вкладка «вход в свой кабинет» =====
     Показывается ровно там, где нет трёх детских вкладок: на вывеске и на
     взрослых экранах. На детских она не нужна — там и вкладки, и 👤 рядом.
     ⚠️ На самих экранах входа (выбор роли, ввод кода, заведение кабинета)
     она спрятана: вести в кабинет с экрана входа в кабинет — это кнопка,
     которая никуда не ведёт. */
  var lk = document.getElementById("tab-lk");
  if (lk){
    var gate = !adminScreen ||                 /* на детских экранах есть свои вкладки и 👤 */
      curPlace === "roles" || curPlace === "kidlogin" || curPlace === "lostcode" ||
      curPlace === "parentlogin" || curPlace === "adminsetup" || curPlace === "adminlogin";
    /* ⚠️ Обработчики завёрнуты в function, а не переданы именем: onclick
       отдаёт первым доводом СОБЫТИЕ, и screenParent(code) принимал его за код
       ученика — в заголовке кабинета вместо имени печаталось
       «ученик [object PointerEvent]». Ловушка молчаливая: остальные три
       экрана доводов не берут, и три роли из четырёх работали бы верно. */
    /* ⚠️ Надпись говорит, ГДЕ ЧЕЛОВЕК СЕЙЧАС, а не какая роль у устройства.
       Жалоба фаундера 10.09.2026: «вышел из кабинета, а сверху всё равно
       написано „Кабинет репетитора“». Так и было — надпись читалась по роли
       устройства (isAdminDevice), а роль после выхода намеренно остаётся:
       выход закрывает замок, но не «съезжает с квартиры» (см. leaveRoom).
       Из-за этого выход выглядел как несработавший, и вернуться было
       страшно — кнопка обещала кабинет, а спросила бы пароль.
       Чиним надписью, а не ролью: замок закрыт — значит человек СНАРУЖИ, и
       кнопка честно зовётся «Войти в кабинет». Роль, пароль и код ученика на
       месте, тест [кабинет] по-прежнему зелёный. */
    var role = isAdminDevice()
        ? (adminUnlocked()
            ? { em:"🛠", lbl:"Кабинет репетитора", go: function(){ screenAdminHome(); } }
            : { em:"🔒", lbl:"Войти в кабинет",   go: function(){ screenAdminHome(); } })
      : isParentDevice()
        ? { em:"👨‍👩‍👦", lbl:"Кабинет родителя", go: function(){ screenParent(); } }
      : (myCode() || S.name)
        ? { em:"🎒", lbl:"Мои уроки", go: function(){ screenWorlds(); } }
        : { em:"👤", lbl:"Войти", go: function(){ screenRoles(); }, go1: 1 };
    lk.hidden = gate;
    if (!gate){
      lk.innerHTML = role.em + ' <span class="lbl">' + role.lbl + "</span>";
      lk.title = role.lbl;
      /* Гостю вход — главное действие, ему акцент; остальным это просто
         дорога домой, и кричать ей незачем. */
      lk.classList.toggle("go", !!role.go1);
      lk.onclick = role.go;
    }
  }
  var lg = document.getElementById("logo");
  if (lg) lg.title = (isAdminDevice() || isParentDevice())
    ? "На главную страницу сайта"
    : ((myCode() || S.name) ? "На главную: уроки" : "На главную страницу");
  document.body.classList.toggle("adminui", adminScreen);
  if (adminScreen) return;                    /* детские счётчики не трогаем */
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
    var due = studyDue();
    /* ⚠️ ЧИСЛА СЕРИИ В ШАПКЕ НЕТ, и это решение, а не упущение (план, п. 4.4).
       Счётчик подряд идущих дней висел на каждом экране и работал ровно одним
       способом: заставлял бояться его потерять. Это красная линия продукта —
       «страх потерять серию», — и она была нарушена собственной шапкой.
       Осталось то, что честно: горит ли значок (сегодня уже занимались) и
       звенит ли он (сегодня условленный день, а занятия ещё не было).
       Слово «Сегодня» лежит в отдельном span: на узком экране его прячет CSS,
       а значок остаётся. Через textContent так нельзя — он стёр бы span. */
    bt.innerHTML = (due ? "🔔 " : "🔥 ") + '<span class="lbl">Сегодня</span>';
    /* «горит», если сегодня уже занимались; «due» — учебный день, ещё не занимались */
    bt.classList.toggle("lit", activeOn(dayKey()));
    bt.classList.toggle("due", due);
    bt.title = due
      ? "Сегодня по уговору учебный день"
      : (activeOn(dayKey()) ? "Сегодня уже занимался" : "Задача дня и календарь занятий");
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
    /* Значок набора стоит ЗДЕСЬ, на кнопке профиля, а не отдельной иконкой в
       шапке: место в панели занято, а награда должна быть видна каждый день,
       иначе она не награда. Обычный набор оставляет привычного человечка. */
    var sk = skinNow();
    bw.textContent = sk.world ? sk.em : "👤";
    bw.title = (nm ? ("Профиль: " + nm) : "Профиль") +
      (sk.world ? (" · набор «" + sk.name + "»") : "");
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
/* По шагу проекта — самая ранняя дата сдачи из двух копий. */
function mergeStepsAt(x, y){
  x = Array.isArray(x) ? x : []; y = Array.isArray(y) ? y : [];
  var out = [], n = Math.max(x.length, y.length);
  for (var i = 0; i < n; i++) out.push(minPos(x[i], y[i]) || 0);
  return out;
}
/* По шагу проекта — запись о ПЕРВОЙ сдаче: из двух берём более раннюю. */
function mergeStepsTr(x, y){
  x = Array.isArray(x) ? x : []; y = Array.isArray(y) ? y : [];
  var out = [], n = Math.max(x.length, y.length);
  for (var i = 0; i < n; i++){
    var p = x[i], q = y[i];
    out.push(!p ? (q || null) : (!q ? p : ((p.at || 0) <= (q.at || 0) ? p : q)));
  }
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
  /* ⚠️ «Код записан» складывается по максимуму, а не по свежести: записал на
     одном устройстве — записал везде, и напоминание не должно догонять на
     втором. Снять отметку нельзя вовсе, и это правильно: код, унесённый из
     браузера один раз, обратно в него не возвращается. */
  out.codeSaved = maxN(a.codeSaved, b.codeSaved);

  /* разгаданные разминки: объединяем — разгаданное на любом устройстве
     остаётся разгаданным. Это не звёзды и не входит в сотню уроков. */
  out.warmups = mergeSet(a.warmups, b.warmups);

  /* пройденные задания раздела «Ты и ИИ»: тоже объединяем — как разминки,
     это не звёзды и не входит в сотню уроков. */
  out.ailab = mergeSet(a.ailab, b.ailab);
  /* принятые работы — множество ключей, как разминки: сделанное на любом
     устройстве остаётся сделанным */
  out.specs = mergeSet(a.specs, b.specs);
  /* решённые задачи алгоритмов — тоже множество ключей */
  out.algo = mergeSet(a.algo, b.algo);

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

  /* ===== домашка от репетитора =====
     Задание приходит С УСТРОЙСТВА ВЗРОСЛОГО, а делается на устройстве ребёнка,
     то есть две стороны правят одну запись с разных концов. Поэтому слияние
     здесь несимметричное по полям: условие (задача, семя, срок) принадлежит
     тому, кто задал, а «сделано» и число попыток — тому, кто делал.
     ⚠️ Семя берём из БОЛЕЕ СВЕЖЕЙ выдачи, а не большее: числа задачи обязаны
     совпасть у ребёнка и у репетитора, иначе они будут смотреть на разные
     условия и спорить, кто прав. */
  out.hw = {};
  Object.keys(mergeSet(a.hw, b.hw)).forEach(function(k){
    var x = (a.hw || {})[k] || {}, y = (b.hw || {})[k] || {};
    var base = (y.at || 0) > (x.at || 0) ? y : x;
    out.hw[k] = { id: base.id || x.id || y.id,
                  seed: base.seed !== undefined ? base.seed : (x.seed !== undefined ? x.seed : y.seed),
                  due: base.due || x.due || y.due || "",
                  by: base.by || x.by || y.by || "",
                  at: maxN(x.at, y.at),
                  done: maxN(x.done, y.done),
                  tries: maxN(x.tries, y.tries) };
  });

  /* ===== заметки репетитора к урокам (корзина 3.7) =====
     Слияние как у домашки: побеждает более свежая запись. Объединять нечего —
     заметка к уроку одна, и две правки одного текста это не два текста.
     ⚠️ Снятая заметка хранится НАДГРОБИЕМ (пустой текст со свежим временем),
     а не удалением ключа. Иначе на другом устройстве лежит старая заметка с
     непустым текстом, и при следующем обмене она воскресает — ребёнок читает
     то, что взрослый уже стёр. Тот же приём, что у выключения трансляции. */
  out.notes = {};
  Object.keys(mergeSet(a.notes, b.notes)).forEach(function(k){
    var x = (a.notes || {})[k] || {}, y = (b.notes || {})[k] || {};
    var base = (y.at || 0) > (x.at || 0) ? y : x;
    out.notes[k] = { t: String(base.t || ""), by: base.by || "", at: base.at || 0,
                     marks: Array.isArray(base.marks) ? base.marks : [] };
  });

  /* «Я застрял»: самый свежий из двух. ⚠️ Отмена — тоже запись (off: 1) со
     своим временем, а не пустота: иначе старый зов с другого устройства
     воскрес бы при первом же обмене с сервером. */
  var ha = a.help || {}, hb = b.help || {};
  out.help = (hb.at || 0) > (ha.at || 0) ? hb : ha;

  /* статус «чем занят сейчас» — просто самый свежий из двух */
  out.now = (a.now && b.now) ? ((a.now.at || 0) >= (b.now.at || 0) ? a.now : b.now)
                             : (a.now || b.now || null);

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

  /* Пробные варианты экзаменов: по ключу на экзамен ({ ege:…, oge:… }).
     ⚠️ Два РАЗНЫХ варианта одного экзамена сложить нельзя: у каждого свой
     набор задач по номерам, и «объединение» дало бы вариант, которого не
     собирал никто. Поэтому правило простое: побеждает собранный позже.
     А вот один и тот же вариант (то же семя) на двух устройствах — это уже
     не два варианта, а один: решённые номера объединяем, иначе занятие на
     планшете откатывало бы вечернюю работу на ноутбуке. */
  out.variant = {};
  Object.keys(mergeSet((a.variant || {}), (b.variant || {}))).forEach(function(k){
    var va = (a.variant || {})[k], vb = (b.variant || {})[k];
    if (!va || !vb){ out.variant[k] = va || vb; return; }
    if (va.seed !== vb.seed){
      out.variant[k] = (vb.at || 0) > (va.at || 0) ? vb : va;
      return;
    }
    /* ⚠️ Поля режима экзамена (1.127.0) обязаны переезжать вместе с остальным.
       Забудь их здесь — и экзамен, открытый на втором устройстве, приедет
       обратно как тренировка: без времени, без сданных ответов и незакрытым.
       Одно и то же семя — один и тот же заход, поэтому:
         mins   берём непустое: режим у одного варианта один;
         closed закрыт хоть где-то — закрыт везде. Заход один, и «открыть его
                заново с другого устройства» — это ровно то, чего режим не даёт;
         sent   объединяем, как done: это множество сданных номеров. */
    var one = { ex: va.ex, seed: va.seed, at: minPos(va.at, vb.at) || va.at || vb.at,
                mins: va.mins || vb.mins || 0,
                endAt: maxN(va.endAt, vb.endAt),
                closed: (va.closed || vb.closed) ? 1 : 0,
                items: (va.items && va.items.length) ? va.items : vb.items,
                done: mergeSet(va.done, vb.done), seen: mergeSet(va.seen, vb.seen),
                sent: mergeSet(va.sent, vb.sent) };
    /* pts — балл эксперта ФИПИ по номеру (js/fipi16.js). Это не множество, а
       последний сданный ответ: по номеру побеждает сданный позже. Забудь
       поле здесь — и итог на втором устройстве скажет «ответ не сдан». */
    var pa = va.pts || {}, pb = vb.pts || {};
    if (Object.keys(pa).length || Object.keys(pb).length){
      one.pts = {};
      Object.keys(mergeSet(pa, pb)).forEach(function(n){
        one.pts[n] = !pa[n] ? pb[n] : !pb[n] ? pa[n] : ((pb[n].at || 0) > (pa[n].at || 0) ? pb[n] : pa[n]);
      });
    }
    out.variant[k] = one;
  });

  /* Проверка «что умеет сам»: сложить две разные проверки нельзя (у каждой
     свои задачи), поэтому побеждает начатая позже. Одна и та же (то же семя)
     на двух устройствах — берём ту, что ушла дальше: закрытую или с большим
     номером ступени. */
  var pa = a.proverka || {}, pb = b.proverka || {};
  if (!pa.at) out.proverka = pb.at ? pb : {};
  else if (!pb.at) out.proverka = pa;
  else if (pa.seed !== pb.seed) out.proverka = (pb.at || 0) > (pa.at || 0) ? pb : pa;
  else out.proverka = ((pb.closed || 0) * 100 + (pb.i || 0)) > ((pa.closed || 0) * 100 + (pa.i || 0)) ? pb : pa;
  /* Проверка 2 — то же правило в своём слоте. */
  var qa = a.proverka2 || {}, qb = b.proverka2 || {};
  if (!qa.at) out.proverka2 = qb.at ? qb : {};
  else if (!qb.at) out.proverka2 = qa;
  else if (qa.seed !== qb.seed) out.proverka2 = (qb.at || 0) > (qa.at || 0) ? qb : qa;
  else out.proverka2 = ((qb.closed || 0) * 100 + (qb.i || 0)) > ((qa.closed || 0) * 100 + (qa.i || 0)) ? qb : qa;

  /* Назначенный репетитором вариант: по ключу на экзамен. Складывать тут
     нечего — назначение это факт от взрослого, и свежее отменяет прежнее.
     ⚠️ Сравниваем по at, а не по «чьё сохранение новее»: репетитор пишет
     назначение прямо в запись ученика на сервере, и оно может приехать
     вместе со СТАРЫМ снимком с планшета, который лежал закрытым. */
  out.vtask = {};
  Object.keys(mergeSet((a.vtask || {}), (b.vtask || {}))).forEach(function(k){
    var ta = (a.vtask || {})[k], tb = (b.vtask || {})[k];
    if (!ta || !tb){ out.vtask[k] = ta || tb; return; }
    out.vtask[k] = (tb.at || 0) > (ta.at || 0) ? tb : ta;
  });

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
      code: pf.code || po.code || null,
      /* ⚠️ Даты шагов и запись работы (1.142.0). Объект проекта здесь
         собирается ПЕРЕЧИСЛЕНИЕМ полей, и без этих строк оба поля молча
         пропадали бы при первом же обмене с сервером. По шагу — РАННЕЕ из
         двух: шаг сдан тогда, когда сдан впервые, и запись о нём — первая. */
      stepsAt: mergeStepsAt(pa.stepsAt, pb.stepsAt),
      tr: mergeStepsTr(pa.tr, pb.tr)
    };
  });
  /* Слова ребёнка к защите — текст, а не результат: сложить нельзя, берём
     более свежую правку (at), как песочницу. */
  out.defense = {};
  Object.keys(mergeSet(a.defense, b.defense)).forEach(function(k){
    var x = (a.defense || {})[k], y = (b.defense || {})[k];
    out.defense[k] = !x ? y : (!y ? x : ((x.at || 0) >= (y.at || 0) ? x : y));
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
/* Почему обмен не работает — словами и с указанием, что именно чинить.
   Нужна там, где раньше молча отвечали «готово»: обмену нужны ДВЕ вещи —
   адрес сервера в js/cloud-config.js и код ученика на этом устройстве, —
   и родителю важно знать, какой из двух не хватает. */
function cloudOffWhy(what){
  if (typeof Cloud === "undefined")
    return "<b>Обмен недоступен</b>Не загрузился js/cloud.js — " + what + " прогресс не получится.";
  if (!Cloud.hasUrl())
    return "<b>Сервер не подключён</b>В файле js/cloud-config.js не указан адрес сервера, " +
           "поэтому " + what + " прогресс некуда. Пока прогресс хранится только в этом браузере.";
  return "<b>Код ученика не задан</b>Без кода серверу непонятно, чей это прогресс, и " + what +
         " его нельзя. Впишите код в поле выше и нажмите «Записать код».";
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
/* Погасить отложенную отправку. Отдельный вход, потому что таймер — чужое
   состояние (§ 4, правило 5): читается вызовом, гасится вызовом, руками в
   cloudState.timer не лезет никто.
   Зачем есть: отложенная отправка заведена в одном мгновении, а срабатывает
   через 2–25 секунд — в мире, который успел смениться. Кто меняет мир под ней,
   обязан её погасить. Сейчас такой один — тест метрик: он уводит хранилище
   сервера в свою пустую папку, и долетевший туда чужой снимок сдвигал счёт
   затыков (мигание 11.09.2026). */
function cancelPush(){
  if (cloudState.timer){ clearTimeout(cloudState.timer); cloudState.timer = null; }
}

/* ================= ПРИСУТСТВИЕ И ЖИВОЕ ЗАНЯТИЕ =================
   Ответ на вопрос фаундера «могу ли я и родители видеть, что делает ребёнок
   онлайн». Два уровня, и у обоих одно правило, записанное в README:
   РЕБЁНОК ВСЕГДА ВИДИТ, КОГДА ЕГО ВИДЯТ. Скрытого наблюдения нет по
   построению: вся ставка продукта — судья, которому верят, и подглядывание
   разрушило бы доверие ко всему остальному — отчёту, проверке, авторству.

   Уровень 1 — статус: «сейчас в тренажёре, урок 23». Ничего нового не
   отправляется: активный тик пишет S.now, прогресс и так уезжает на сервер
   не чаще раза в 25 секунд (schedulePush), свежесть записи и есть статус.
   Ребёнку про это сказано в профиле.

   Уровень 2 — трансляция: репетитор видит код и вывод ребёнка с задержкой
   в несколько секунд. Три условия, без которых её делать было нельзя:
     1. включает САМ РЕБЁНОК кнопкой — включить удалённо невозможно,
        писать кадры умеет только его устройство;
     2. пока включена, на экране горит несмываемая плашка;
     3. гаснет сама: по кнопке, по концу занятия или через 45 минут.
   ============================================================ */

/* ---------- уровень 1: статус присутствия ---------- */
var PRESENCE_FRESH = 2 * 60e3;   /* запись свежее двух минут = сейчас в тренажёре */
/* ⚠️ Ключи — настоящие имена мест из enterScreen/curPlace, и на это есть
   проверка в тесте: словарь с выдуманными ключами молча показывал бы всем
   «в тренажёре» — так и вышло в первый день на бою. */
var PLACE_RU = {
  lesson:"проходит урок", project:"собирает проект", projectdone:"смотрит собранный проект",
  game:"играет", games:"выбирает игру", warmup:"делает разминку", warm:"выбирает разминку",
  today:"на экране «Сегодня»", zan:"идёт занятие", review:"повторяет трудное",
  algo:"выбирает задачу экзамена", algoone:"решает задачу экзамена",
  variant:"проходит пробный вариант", proverka:"проходит проверку «что умеет сам»",
  ai:"в разделе «Ты и ИИ»", ailesson:"в разделе «Ты и ИИ»",
  hw:"смотрит домашку", hwone:"делает домашку", sand:"в песочнице", viz:"в визуализаторе",
  mytasks:"составляет своё задание", friendtask:"решает задание от друга",
  play:"играет в игру по ссылке", specs:"в приёмке", spec:"в приёмке",
  folio:"в портфолио", works:"на витрине", home:"на главном экране",
  world:"выбирает урок", train:"выбирает тренировку", guide:"читает инструкцию",
  account:"в профиле", trace:"смотрит, как шла работа", web:"в разделе «HTML и CSS»",
  defense:"готовит проект к защите", zashchita:"на экране «Защита своего кода»"
};
/* Чем занят, по чужому снимку. serverAt — серверное время последней записи:
   сравнивать его с часами зрителя чуть нечестно, но дрейф часов много меньше
   окна в две минуты. null — не в тренажёре, и это НЕ показывается отдельной
   строкой: «офлайн» рядом с именем читается как упрёк. */
function presenceInfo(st, serverAt){
  if (!serverAt || Date.now() - serverAt > PRESENCE_FRESH) return null;
  var w = "в тренажёре";
  var nr = st && st.now;
  if (nr){
    var l = nr.lesson ? CURRICULUM.byId(nr.lesson) : null;
    if (l) w = "урок " + l.num + " «" + l.title + "»";
    else if (PLACE_RU[nr.place]) w = PLACE_RU[nr.place];
  }
  return { what: w };
}
function presenceHTML(st, serverAt){
  var p = presenceInfo(st, serverAt);
  if (!p) return "";
  /* место неизвестно — не повторяем «в тренажёре: в тренажёре» */
  if (p.what === "в тренажёре")
    return '<div class="presence">🟢 <b>Сейчас в тренажёре</b></div>';
  return '<div class="presence">🟢 Сейчас в тренажёре: <b>' + esc(p.what) + '</b></div>';
}

/* Живая сводка момента для карточки ученика: не только «где он», но и что
   уже сделано сегодня и как идёт занятие. Всё считается из обычного снимка
   прогресса — ребёнок ничего дополнительного не отправляет. */
function presenceDetailHTML(st, serverAt){
  var h = helpLineHTML(st) + presenceHTML(st, serverAt);
  var day = dayKey();
  var lg = (st && st.log) || {}, sm = (st && st.stars) || {};

  /* уроки, сданные сегодня, в порядке сдачи */
  var solvedToday = [];
  Object.keys(lg).forEach(function(id){
    var g = lg[id];
    if (!g || !g.solvedAt || sm[id] === undefined) return;
    if (dayKey(new Date(g.solvedAt)) !== day) return;
    var l = CURRICULUM.byId(id);
    solvedToday.push({ at: g.solvedAt, title: l ? l.title : id });
  });
  solvedToday.sort(function(a, b){ return a.at - b.at; });

  var hwToday = hwRecords(st).filter(function(r){
    return r.done && dayKey(new Date(r.done)) === day;
  }).length;
  var dailyOk = !!((st.daily || {})[day]);

  /* занятие сегодняшнего дня: идёт или уже закрыто */
  var zanLine = "";
  Object.keys(st.zan || {}).forEach(function(k){
    if (k.indexOf(day) !== 0) return;
    var r = st.zan[k];
    if (!r) return;
    var doneN = (r.done || []).length, total = (r.plan || []).length;
    zanLine = r.end
      ? "занятие закрыто: " + doneN + " из " + total + " " + plural(total, "шага", "шагов", "шагов")
      : "идёт занятие: сделано " + doneN + " из " + total + " " + plural(total, "шага", "шагов", "шагов");
  });

  var bits = [];
  /* Сколько времени сегодня — первым: это первый вопрос взрослого, и до сих
     пор ответа на него не было нигде, кроме карты часов. */
  var todayMs = dayMs(st, day);
  if (todayMs) bits.push("за тренажёром " + fmtDur(todayMs));
  if (solvedToday.length){
    var names = solvedToday.slice(-2).map(function(x){ return "«" + esc(x.title) + "»"; }).join(", ");
    bits.push("сдано " + solvedToday.length + " " +
      plural(solvedToday.length, "урок", "урока", "уроков") + " (" +
      (solvedToday.length > 2 ? "последние — " : "") + names + ")");
  }
  if (hwToday) bits.push("домашка: " + hwToday + " " + plural(hwToday, "задача", "задачи", "задач"));
  if (dailyOk) bits.push("задача дня ✓");
  if (zanLine) bits.push(zanLine);

  if (bits.length)
    h += '<div class="presence day">Сегодня: ' + bits.join(" · ") + '</div>';
  return h;
}

/* ---------- уровень 2: трансляция экрана (сторона ребёнка) ---------- */
var LIVE_EVERY = 7000;          /* кадр не чаще раза в 7 секунд */
var LIVE_MAX_MS = 45 * 60e3;    /* дальше гаснет сама: занятие столько не идёт */
var LIVE_FRESH = 25e3;          /* кадр старше — трансляция для зрителя закончилась */
var liveShare = { on:false, timer:null, startAt:0, lastSig:"" };

function livePayload(){
  var code = "", output = "";
  try {
    if (session && session.studio && session.studio.editor) code = session.studio.editor.getCode();
    var con = session && session.studio ? session.studio.querySelector(".console") : null;
    if (con) output = con.textContent || "";
  } catch(e){}
  var l = curLessonId ? CURRICULUM.byId(curLessonId) : null;
  return { at: Date.now(), place: curPlace,
           title: l ? "Урок " + l.num + " «" + l.title + "»" : (PLACE_RU[curPlace] || "в тренажёре"),
           code: code.slice(0, 20000), output: output.slice(0, 8000) };
}
function liveTick(){
  if (!liveShare.on) return;
  if (Date.now() - liveShare.startAt > LIVE_MAX_MS) return liveOffNow();
  if (!pageActive()) return;                /* спрятанная вкладка кадров не шлёт */
  var p = livePayload();
  var sig = p.title + " " + p.code + " " + p.output;
  if (sig === liveShare.lastSig) return;    /* без изменений — без записи: кадры не бесплатны */
  liveShare.lastSig = sig;
  Cloud.liveSet(p).catch(function(){});
}
function liveOn(){
  if (liveShare.on) return false;
  if (!serverOn() || !myCode()) return false;
  liveShare.on = true; liveShare.startAt = Date.now(); liveShare.lastSig = "";
  liveShare.timer = setInterval(liveTick, LIVE_EVERY);
  liveTick();
  liveBanner(true);
  return true;
}
function liveOffNow(){
  if (!liveShare.on) return;
  liveShare.on = false;
  if (liveShare.timer){ clearInterval(liveShare.timer); liveShare.timer = null; }
  liveBanner(false);
  if (serverOn() && myCode()) Cloud.liveOff().catch(function(){});
}
/* ⚠️ Плашка живёт на body, а не в #app: перерисовки экранов её не трогают,
   и спрятать её сменой экрана невозможно — в этом весь смысл. */
function liveBanner(showIt){
  var el = document.getElementById("livebar");
  if (!showIt){ if (el) el.parentNode.removeChild(el); return; }
  if (el) return;
  el = document.createElement("div");
  el.id = "livebar"; el.className = "livebar";
  el.innerHTML = '<span>🔴 <b>Репетитор видит твой код</b></span>' +
    '<button class="rbtn sec" id="liveoff">Прекратить</button>';
  document.body.appendChild(el);
  el.querySelector("#liveoff").onclick = function(){ liveOffNow(); };
}
/* кнопка ребёнка — на экране занятия и в профиле */
function liveRowHTML(){
  if (!serverOn() || !myCode()) return "";
  if (liveShare.on)
    return '<div class="winrow"><button class="bigbtn ghost" id="zlive">🔴 Репетитор видит твой код · выключить</button></div>';
  return '<div class="winrow"><button class="bigbtn ghost" id="zlive">📺 Показать экран репетитору</button></div>';
}
function bindLiveRow(after){
  var b = document.getElementById("zlive");
  if (!b) return;
  b.onclick = function(){
    if (liveShare.on) liveOffNow(); else liveOn();
    if (after) after();
  };
}

/* ---------- чтение трансляции: зритель монотонен ----------
   ⚠️ У смонтированного бакета свой кэш в каждом экземпляре функции: соседние
   запросы отвечают разным — то свежим кадром, то тем, что было десять секунд
   назад, то надгробием от выключения (замерено на бою 05.09.2026). Если верить
   каждому ответу, картинка мигает между «идёт» и «не идёт».
   Поэтому зритель ПОМНИТ самое свежее serverAt и назад не откатывается:
   старый ответ просто игнорируется. Выключение при этом надёжно — у надгробия
   время самое свежее, и после него ничего старого уже не примется. */
function liveWatcher(){
  return { seenAt: 0, frame: null, off: false };
}
/* Вернуть кадр, который стоит показать, или null — «трансляции нет». */
function liveAccept(w, rec){
  if (rec && rec.found && (rec.serverAt || 0) > w.seenAt){
    w.seenAt = rec.serverAt || 0;
    w.off = !!rec.off;
    w.frame = rec.off ? null : rec;
  }
  if (w.off || !w.frame) return null;
  /* «сейчас» берём с сервера: часы зрителя могут врать на минуты */
  var now = (rec && rec.now) || Date.now();
  if (now - w.seenAt > LIVE_FRESH) return null;
  return w.frame;
}

/* ---------- уровень 2: экран зрителя (сторона взрослого) ---------- */
function screenLiveView(code, label){
  var seq = enterScreen("home", "liveview");
  session = { id:null, attempts:0, hints:0, shown:false };
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">живое занятие</div>' +
    '<h1>📺 ' + esc(label || code) + '</h1></div>' +
    '<div class="right"><span class="tag">только смотрите</span></div></div>' +
    '<p class="lede">Код и вывод ребёнка, с задержкой в несколько секунд. Менять отсюда ничего ' +
    'нельзя — это его работа. Трансляцию включил и может выключить он сам; у него на экране ' +
    'горит плашка о том, что вы смотрите.</p>' +
    '<div id="livebody"><p class="dim">Подключаюсь…</p></div>' +
    '<div class="pager"><button class="bigbtn ghost" id="lvback">← Назад</button></div>';
  document.getElementById("lvback").onclick = function(){
    if (isAdminDevice()) screenKid(code); else if (parentOf()) screenParent(); else screenWorlds();
  };
  var watch = liveWatcher();
  function draw(raw){
    var box = document.getElementById("livebody");
    if (!box) return;
    var rec = liveAccept(watch, raw);
    if (!rec){
      box.innerHTML = '<div class="note"><b>Трансляция сейчас не идёт</b>' +
        'Попросите ребёнка нажать «📺 Показать экран репетитору» — кнопка на экране занятия ' +
        'и в его профиле. Как только он нажмёт, здесь появится код.</div>';
      return;
    }
    var age = Math.max(0, Math.round((((raw && raw.now) || Date.now()) - watch.seenAt) / 1000));
    box.innerHTML =
      '<div class="card"><h3>' + esc(rec.title || "Сейчас на экране") + '</h3>' +
      '<p class="dim">обновлено ' + age + ' ' + plural(age, "секунду", "секунды", "секунд") + ' назад</p>' +
      '<div class="showcode"><pre><code>' + hl(rec.code || "") + '</code></pre></div>' +
      (rec.output
        ? '<div class="pane"><div class="ph">что напечатала программа</div><div class="console">' +
          esc(rec.output) + '</div></div>'
        : '<p class="dim">Программа пока ничего не печатала.</p>') + '</div>';
  }
  function pull(){
    if (screenStale(seq)) return;
    Cloud.liveGet(code).then(function(rec){
      if (screenStale(seq)) return;
      draw(rec);
      setTimeout(pull, 5000);
    }, function(){
      if (screenStale(seq)) return;
      setTimeout(pull, 8000);
    });
  }
  pull();
  refreshTop();
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
  EOFError:"Ответы для input() кончились",
  /* Эти бросает только настоящий CPython в песочнице: мини-движок до них не
     доходит. Без русских имён плашка показала бы английское слово. */
  ModuleNotFoundError:"Нет такого модуля", OverflowError:"Число слишком большое",
  MemoryError:"Не хватило памяти", TabError:"Смешаны табы и пробелы",
  UnicodeDecodeError:"Не удалось прочитать текст", UnicodeEncodeError:"Не удалось записать текст",
  PermissionError:"Так с файлом нельзя", IsADirectoryError:"Это папка, а не файл",
  FloatingPointError:"Ошибка в вычислении", SystemError:"Сбой внутри Python"
};
function errHTML(e){
  return '<b>' + (KIND_RU[e.kind] || e.kind) + (e.line ? ' — строка ' + e.line : '') + '</b>' + esc(e.msg);
}
/* То же объяснение, но строкой — для мест, где сообщение вклеивается в чужой
   текст (например в кабинете взрослого), а не рисуется отдельной плашкой. */
function errText(e){
  if (!e) return "";
  return (KIND_RU[e.kind] || e.kind || "Ошибка") + ": " + (e.msg || "");
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

/* ================= редактор =================
   ⚠️ Уехал в js/editor.js — второй шаг по архитектурному долгу. Почему выбран
   именно он и как замерялась связанность, написано в шапке того файла;
   договор между файлами — в шапке js/screens-showcase.js.
   Редактору снаружи нужны ровно четыре функции разметки — вот они, на виду. */
var EDITOR = KVSCREENS.editor({
  esc: esc, hl: hl, hlWatched: hlWatched, noteMarkLine: noteMarkLine
});
var KEYBAR_KEYS = EDITOR.KEYBAR_KEYS, makeEditor = EDITOR.makeEditor;
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

/* ================= рабочая станция =================
   ⚠️ Уехала в js/studio.js — четвёртый шаг по архитектурному долгу. Почему
   список A здесь длиннее, чем у прошлых разрезов, и почему session передаётся
   функцией, а не значением, написано в шапке того файла. */
var STUDIO = KVSCREENS.studio({
  esc: esc, errHTML: errHTML, errBeaten: errBeaten, errSeen: errSeen,
  /* ⚠️ Забыт при первом заходе, и поймал это тест, а не я: мой скрипт
     замера искал объявления по «^var ИМЯ», а makeEditor объявлен ВТОРЫМ
     в списке — «var KEYBAR_KEYS = …, makeEditor = …». Скрипт чинить
     некуда (он одноразовый), а урок остаётся: замер подсказывает, но
     последнее слово за сборкой и тестом. */
  makeEditor: makeEditor,
  KIND_RU: KIND_RU, dataFiles: dataFiles, watchCompute: watchCompute,
  drawTurtle: drawTurtle, animateTurtle: animateTurtle,
  lintCode: lintCode, lintHTML: lintHTML,
  award: award, sfx: sfx, speakAuto: speakAuto,
  /* ⚠️ Функцией, а не значением: session пересоздаётся на каждом заходе
     в урок, и копия навсегда запомнила бы первую. */
  session: function(){ return session; }
});
var makeStudio = STUDIO.makeStudio;
/* Запертая страница — одна на продукт: её показывает и студия, и раздел
   «HTML и CSS». Разбор замков — в шапке js/studio.js. */
var pageDoc = STUDIO.pageDoc, pageFrameWire = STUDIO.pageFrameWire;

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

/* Подсказка — строка или объект { t, code }. Куски кода внутри текста
   пишутся в `обратных кавычках` и показываются как код, а не сливаются
   с обычными словами. code — маленький пример-программа, он рисуется
   отдельным блоком с подписью. Пример пишется на ДРУГИХ числах и именах,
   чем решение задачи: он объясняет приём, а не выдаёт ответ (за долей
   выданного в первой подсказке следит tests/audit.js). */
function hintHTML(x, i){
  var t = (x && typeof x === "object") ? (x.t || "") : String(x);
  var body = esc(t).replace(/`([^`]+)`/g, function(_, c){
    return "<code>" + c + "</code>";
  });
  var ex = (x && typeof x === "object" && x.code)
    ? '<div class="hintex"><span class="hintexlbl">Пример (не ответ, а образец):</span>' +
      '<pre class="hintcode">' + esc(x.code) + '</pre></div>'
    : "";
  return '<div class="step"><b>' + (i + 1) + '.</b> ' + body + ex + '</div>';
}

/* ===== «Я застрял» — сигнал от ребёнка взрослому (13.09.2026, RAZVITIE § 2.6) =====
   Вся связь в продукте шла сверху вниз: заметка, домашка, расписание,
   вариант. Ребёнок не мог сказать «я застрял» — ровно в ту минуту занятия,
   когда связь нужнее всего.
   ⚠️ Граница, без которой это делать было нельзя (слово фаундера): это НЕ
   переписка. Три готовые фразы и ни одного поля для текста — значит нет ни
   мессенджера, ни модерации, ни персональных данных. Сигнал уезжает обычным
   снимком прогресса (schedulePush), новых запросов нет.
   Гаснет сам: урок сдан после зова или прошли сутки. Ребёнок может отменить. */
var HELP_WHY = ["не понимаю задание", "код не работает, не знаю почему", "сделал, но не уверен"];
var HELP_TTL = 24 * 3600e3;
var helpPick = false;          /* открыт ли выбор фразы на экране урока */
/* Живой сигнал по ЛЮБОМУ снимку — у ребёнка по своему, у взрослого по чужому. */
function helpActive(st){
  var h = (st || {}).help;
  if (!h || !h.at || h.off || !h.lesson || !HELP_WHY[h.why]) return null;
  if (Date.now() - h.at > HELP_TTL) return null;
  var g = ((st.log || {})[h.lesson]) || {};
  if ((st.stars || {})[h.lesson] !== undefined && (g.solvedAt || 0) >= h.at) return null;
  return h;
}
/* Звать есть кого, только когда прогресс уезжает на сервер под кодом:
   без кода и сервера сигнал не увидит никто, а кнопка в пустоту — враньё. */
function helpCan(){ return !!(myCode() && serverOn()); }
function helpCall(lessonId, i){
  if (!HELP_WHY[i]) return null;
  S.help = { at: Date.now(), lesson: lessonId, why: i, off: 0 };
  save();
  return S.help;
}
function helpCancel(){
  S.help = { at: Date.now(), lesson: "", why: -1, off: 1 };
  save();
}
function helpBoxHTML(lessonId){
  var h = helpActive(S);
  if (h && h.lesson === lessonId)
    return '<div class="helpcard on">🙋 <b>Ты позвал взрослого:</b> «' + esc(HELP_WHY[h.why]) + '». ' +
      'Он увидит это в своём кабинете, когда откроет его, — это не звонок. Пока ждёшь, попробуй подсказку ' +
      'или запусти код ещё раз. <button class="linkjump" data-help="off">Отменить</button></div>';
  if (!helpPick) return "";
  return '<div class="helpcard">Что случилось? Взрослый увидит ровно эту фразу и урок — больше ничего.' +
    '<div class="helprow">' + HELP_WHY.map(function(w, i){
      return '<button class="rbtn sec" data-help="' + i + '">' + esc(w) + '</button>';
    }).join("") + '<button class="linkjump" data-help="close">Не надо</button></div></div>';
}
function wireHelp(lessonId){
  var btn = document.getElementById("helpbtn"), out = document.getElementById("helpout");
  if (!btn || !out) return;
  function draw(){
    out.innerHTML = helpBoxHTML(lessonId);
    var on = helpActive(S);
    btn.disabled = !!(on && on.lesson === lessonId);
    out.querySelectorAll("[data-help]").forEach(function(b){
      b.onclick = function(){
        var k = b.getAttribute("data-help");
        if (k === "close"){ helpPick = false; return draw(); }
        if (k === "off"){ helpCancel(); helpPick = false; return draw(); }
        helpCall(lessonId, parseInt(k, 10));
        helpPick = false;
        draw();
      };
    });
  }
  btn.onclick = function(){ helpPick = !helpPick; draw(); };
  helpPick = false;
  draw();
}
/* Строка взрослому — первой в сводке «что он делает сейчас»: и в карточке
   ученика у репетитора, и в кабинете родителя, и при опросе раз в минуту. */
function helpLineHTML(st){
  var h = helpActive(st);
  if (!h) return "";
  var l = CURRICULUM.byId(h.lesson);
  var mins = Math.max(0, Math.round((Date.now() - h.at) / 60000));
  return '<p class="cabcall">🙋 Зовёт: ' + (l ? 'урок ' + l.num + ' «' + esc(l.title) + '»' : esc(h.lesson)) +
    ' — «' + esc(HELP_WHY[h.why]) + '», ' +
    (mins < 1 ? 'только что' : mins < 60 ? mins + ' ' + plural(mins, "минуту", "минуты", "минут") + ' назад'
      : Math.round(mins / 60) + ' ' + plural(Math.round(mins / 60), "час", "часа", "часов") + ' назад') +
    '. Погаснет сам, когда урок будет сдан.</p>';
}

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
    out.innerHTML = hs.slice(0, session.hints).map(hintHTML).join("");
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
      /* ⚠️ Здесь стоит ОБЕЩАНИЕ раздела, а не шутка. Курсы про нейросети учат
         «как попросить»; этот раздел — единственный, который учит принимать
         работу, и если не сказать этого словами, отличия не увидит никто. */
      why: "Не «как попросить нейросеть», а как принять её работу: прочитать ответ, найти, где машина уверенно врёт, и доказать это проверкой.",
      when: "Когда за тебя пишет машина, а отвечать всё равно тебе.",
      stat: (function(){
        var sAll = specsList().length;
        var sOk = sAll ? specsList().filter(function(x){ return specDone(x.id); }).length : 0;
        return (aiAll ? aiDone + " из " + aiAll + " пройдено" : "") +
               (sAll ? " · приёмка " + sOk + " из " + sAll : "");
      })() },
    /* go обёрткой: screenWeb присваивается ниже по файлу (раздел — свой модуль) */
    { id:"web", em:"🌐", title:"HTML и CSS", go: function(){ screenWeb(); },
      why: "Страница сайта своими руками: теги, списки, таблицы, цвета и раскладка. Страницу видно сразу, пока пишешь, а проверяет её сам браузер.",
      when: "Когда хочется сделать то, что можно показать всем, — сайт.",
      stat: (function(){
        var xs = window.WEB_TASKS || [];
        var d = xs.filter(function(x){ return algoDone(x.id); }).length;
        return xs.length ? d + " из " + xs.length + " готово" : "";
      })() },
    { id:"robot", em:"🤖", title:"Робот", go: screenRobot,
      why: "Исполнитель с пятью командами и своим языком — русскими словами. Это задание 15 ОГЭ: там, где в школе дают КуМир и где Python не примут.",
      when: "Когда в школе ведут КуМир, а не Python.",
      stat: (function(){
        var xs = window.ROBOT_TASKS || [];
        var d = xs.filter(function(x){ return algoDone(x.id); }).length;
        return xs.length ? d + " из " + xs.length + " решено" : "";
      })() },
    /* ⚠️ Вариант стоит ПЕРЕД разделом по темам, а не после него. Темы — это
       как учат; вариант — как спрашивают, и родитель ищет второе. Прятать его
       под темами значит прятать единственное, чего нет у соседей. */
    /* ⚠️ Проверка стоит ПЕРВОЙ из учебных. Это единственный раздел, который
       нужен и тому, кто учится НЕ у нас: родитель, платящий школе
       программирования, приходит сюда узнать, что ребёнок умеет сам. go и
       stat обёртками — модуль присваивается ниже по файлу. */
    { id:"proverka", em:"🔎", title:"Проверка: что умеет сам", go: function(){ screenProverka(); },
      why: "Десять задач по нарастающей, от счёта до классов, без подсказок. В конце — код из шестнадцати знаков: по нему итог откроется на телефоне взрослого, без регистрации.",
      when: "Когда надо узнать, что получается самому, — неважно, где учишься.",
      stat: typeof proverkaStat === "function" ? proverkaStat() : "" },
    /* Рядом с проверкой по смыслу: та спрашивает «что умеет сам» на наших
       задачах, эта — «понимает ли свою программу». go обёрткой — модуль ниже. */
    { id:"zashchita", em:"🛡", title:"Защита своего кода", go: function(){ screenZashchita({ mode:"kid" }); },
      why: "До трёх вопросов о твоей же программе: что напечатает, если поменять число, сколько раз повторится цикл, что окажется в переменной. Ответы считает движок.",
      when: "Когда надо показать, что понимаешь свой код, а не только умеешь его запустить.",
      stat: "без ИИ, программа никуда не уходит" },
    { id:"variant", em:"📝", title:"Пробный вариант", go: screenVariant,
      why: "Весь экзамен подряд, как в мае: по одной задаче на каждый номер и по порядку. Можно тренировкой, а можно в режиме экзамена — со временем, без подсказок и без ответа проверки.",
      when: "Когда темы решаются по отдельности, а целиком экзамен ни разу не пробовал.",
      stat: variantStat() },
    { id:"algo", em:"🧮", title:"Алгоритмы, ОГЭ и ЕГЭ", go: screenAlgo,
      why: "Поиск, сортировка и типовые задания обоих экзаменов. Плюс то, чего нет нигде: цену алгоритма тут не рассказывают, а считают шагами.",
      when: "Когда нужна школьная информатика, а не просто Python.",
      stat: (function(){
        var all = algoList().length;
        var d = all ? algoList().filter(function(x){ return algoDone(x.id); }).length : 0;
        return all ? d + " из " + all + " решено" : "";
      })() },
    { id:"sand", em:"🎨", title:"Песочница", go: screenSandbox,
      why: "Пустой лист без заданий и проверок: пиши что угодно, рисуй черепашкой, ломай и чини.",
      when: "Когда есть своя идея.",
      stat: "рисунок можно сохранить в галерею" },
    { id:"viz", em:"🔍", title:"Визуализатор", go: screenViz,
      why: "Программа по шагам: видно память, ссылки и что изменилось. И пересказ словами, что она сделала.",
      when: "Когда код работает не так, как ты думал.",
      stat: "можно разобрать и свой код с урока" }
  ];
}

/* ================= Главный экран и поиск по урокам =================
   ⚠️ Уехал в js/home.js — седьмой и самый связанный разрез. Список ниже —
   сорок семь имён, и это не бухгалтерия, а измеренный факт: Главный экран по
   устройству перекрёсток, он собирает на одну страницу всё, что в продукте
   происходит. Разбор и план, что с этим делать, — в шапке js/home.js. */
var HOME = KVSCREENS.home({
  app: app, esc: esc, plural: plural, qm: qm,
  enterScreen: enterScreen, refreshTop: refreshTop,
  myName: myName, isAdminDevice: isAdminDevice,
  myCode: myCode, serverOn: serverOn, codeSaved: codeSaved,
  markCodeSaved: markCodeSaved, openAccessCard: openAccessCard,
  /* ⚠️ Обёртками, а не значениями, и это та же ловушка, что уже описана ниже
     у variantStat: copyText и screenShowcase присваиваются ПОЗЖЕ по файлу
     (первый из модуля профиля, второй из модуля витрины), и на этой строке
     они ещё undefined. Значение undefined в договоре не падает и не видно на
     экране — оно превращается в `onclick = undefined`, то есть в кнопку,
     которая молча не отвечает. Кнопка «Что создают ученики» так и стояла
     мёртвой, и нашлась она не тестом, а нажатием.
     Правило общее: в договор модуля кладут ВЫЗОВ, если значение приходит из
     другого модуля. */
  copyText: function(t, btn){ return copyText(t, btn); },
  BADGES: BADGES, dayKey: dayKey, dailyDone: dailyDone,
  solved: solved, solvedCount: solvedCount, starsOf: starsOf,
  lessonOpen: lessonOpen, nextLesson: nextLesson, openLesson: openLesson,
  allWorldsContent: allWorldsContent, worldCountdown: worldCountdown,
  worldReadyLessons: worldReadyLessons, reviewDue: reviewDue,
  hwPending: hwPending,
  /* ⚠️ Обёрткой: сертификаты с 15.09.2026 модуль ниже по файлу (§ 4.40). */
  certList: function(){ return certList(); },
  /* ⚠️ Обёртками: мастерская с 15.09.2026 модуль ниже по файлу (§ 4.40). */
  partsList: function(){ return partsList(); }, buildsList: function(){ return buildsList(); },
  galleryList: galleryList, myTasksList: myTasksList,
  projectsList: projectsList, projectDone: projectDone,
  trainCards: trainCards, welcomeBackHTML: welcomeBackHTML,
  installTipHTML: installTipHTML, wireInstallTip: wireInstallTip,
  aboutFootHTML: aboutFootHTML, wireAboutFoot: wireAboutFoot,
  screenWorld: screenWorld, screenTrain: screenTrain,
  /* ⚠️ Обёрткой: портфолио — модуль ниже по файлу (§ 4.40). */
  screenFolio: function(){ screenFolio(); },
  screenToday: screenToday, screenReview: screenReview, screenHW: function(){ screenHW(); },
  /* ⚠️ Обёрткой: «Своё задание» с 15.09.2026 модуль ниже по файлу (§ 4.40). */
  screenMyTasks: function(e){ screenMyTasks(e); },
  /* ⚠️ Обёрткой: экраны разминки с 15.09.2026 модуль ниже по файлу (§ 4.40). */
  screenWarmups: function(){ screenWarmups(); },
  screenShowcase: function(){ return screenShowcase(); }, screenShop: function(){ screenShop(); },
  screenPath: screenPath, screenGuide: screenGuide,
  screenAdminHome: screenAdminHome,
  /* Экзамены на Главном отдельным блоком: карта по номерам и пробный вариант.
     Числа приходят готовым сводом, чтобы Главный не считал их сам. */
  /* ⚠️ Обёрткой: экраны экзамена — модуль ниже по файлу (§ 4.40). */
  examTally: examTally, openExamMap: function(id){ openExamMap(id); },
  screenVariant: function(){ screenVariant(); },
  screenRobot: function(){ screenRobot(); },
  /* ⚠️ Обёрткой, а не значением: variantStat присваивается НИЖЕ по файлу
     (вариант отрезан в свой модуль), и на этой строке он ещё undefined.
     Ровно на этом упала сборка — тест поймал за минуту. */
  variantStat: function(){ return typeof variantStat === "function" ? variantStat() : ""; },
  S: function(){ return S; },
  session: function(){ return session; },
  newSession: function(v){ session = v; }
});
var lessonSearch = HOME.lessonSearch, screenWorlds = HOME.screenWorlds;
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
    '<div class="pager"><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="toagain">🔁 Повторить</button></div>';
  app.innerHTML = h;
  var cards = trainCards();
  app.querySelectorAll("[data-train]").forEach(function(b){
    var id = b.getAttribute("data-train");
    b.onclick = function(){
      for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i].go();
    };
  });
  document.getElementById("tomap").onclick = goHome;
  document.getElementById("toagain").onclick = screenReview;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= экран: мир ================= */
function screenWorld(n){
  var seq = enterScreen(undefined, "world");
  var w = CURRICULUM.world(n);
  /* Адрес мира пишется ПОСЛЕ enterScreen: тот уже поставил пустой адрес
     (места «world» в таблице нет — оно с параметром), и мы дописываем номер. */
  if (w) setRoute("#world=" + w.n, "Мир " + w.n + ". " + w.title);
  worldContent(n).then(function(){
    if (screenStale(seq)) return;          /* ушли на другой экран, пока грузился мир */
    var ready = worldReadyLessons(w);
    var h = '<div class="lvlhead"><div><div class="idx">Мир ' + w.n + ' из 5</div>' +
      '<h1>' + w.icon + ' ' + w.title + '</h1></div></div>' +
      '<p class="lede">' + w.desc + '</p>';

    if (!ready.length)
      h += '<div class="note"><b>Этот мир ещё пишется</b>Ниже — план уроков, чтобы было видно дорогу. Уроки появятся волнами по десять.</div>';
    else {
      h += '<p class="dim">Уроки проходят по порядку: следующий открывается, когда сдан предыдущий. ' +
        'Звёзды показывают, как прошёл: три — с первой попытки без подсказок. ' +
        'Пройденный урок можно открыть заново в любой момент, звёзды за это не отнимаются.</p>';
      var cd = worldCountdown(n);
      if (cd)
        h += '<p class="wrnext">До конца мира — ' + cd.left + ' ' +
          plural(cd.left, "урок", "урока", "уроков") + ', это примерно <b>' + cd.zan + ' ' +
          plural(cd.zan, "занятие", "занятия", "занятий") + '</b>. В конце — проект и сертификат.</p>';
    }

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

    h += '<div class="pager"><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button><span class="sp"></span>' +
      (n < 5 ? '<button class="bigbtn ghost" id="wnext">Мир ' + (n+1) + ' →</button>' : '') + '</div>';

    app.innerHTML = h;
    app.querySelectorAll(".lesson").forEach(function(b){
      b.onclick = function(){ if (!b.disabled) openLesson(b.getAttribute("data-id")); };
    });
    document.getElementById("tomap").onclick = goHome;
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


/* Урок считается НАЧАТЫМ, если его уже открывали и не дорешали. Такой урок
   жёсткий потолок дня не запирает: обрывать на середине продукт не будет. */
function lessonStarted(id){
  return !solved(id) && !!(S.log || {})[id];
}
/* «На сегодня всё» — когда предел дня достигнут и взрослый выбрал жёсткий режим.
   Экран НИЧЕГО больше не предлагает: любая кнопка «а может ещё чуть-чуть»
   превратила бы договорённость в торг. */
function screenCapReached(){
  enterScreen("home", "capreached");
  session = { id:null, attempts:0, hints:0, shown:false };
  var m = todayMinutes();
  app.innerHTML = '<div class="lvlhead"><div><div class="idx">предел дня</div>' +
    '<h1>🌙 На сегодня всё</h1></div></div>' +
    '<div class="note"><b>Сегодня за тренажёром уже ' + m + ' ' +
    plural(m, "минута", "минуты", "минут") + '</b>Столько вы договорились со взрослым. ' +
    'Новый урок откроется завтра — а тот, что начат, доделать можно.</div>' +
    '<div class="pager"><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';
  document.getElementById("tomap").onclick = goHome;
  refreshTop();
}
function openLesson(id){
  var l = CURRICULUM.byId(id);
  if (!l) return screenWorlds();
  /* ⚠️ Жёсткий потолок обещает взрослому «после предела не пускать дальше», но
     проверялся только вокруг занятия: ребёнок уходил на карту миров и открывал
     уроки напрямую, то есть обещание не выполнялось вовсе. Запираем НОВЫЕ уроки
     и только их — начатое доделывается, как и сказано на баннере. */
  if (capHard() && !lessonStarted(id)) return screenCapReached();
  curTab = "home";              /* урок — это «Главное», а не отдельный раздел */
  curPlace = "lesson";          /* а помощь «?» — про урок */
  /* ⚠️ Урок — самый нужный адрес во всём продукте: именно его репетитор
     диктует ученику («открой урок 37»), и именно на него ссылаются из
     домашки. Заголовок вкладки берётся из самого урока, а не пишется
     строкой: список уроков меняется, а заголовок остался бы прежним. */
  setRoute("#lesson=" + l.id, "Урок " + l.num + ". " + l.title);
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
    /* ⚠️ Взрослый на уроке — это ПРОСМОТР, и об этом надо сказать прямо.
       Жалоба фаундера 07.09.2026: с вывески он нажал «Посмотреть первый урок»,
       провалился в детский тренажёр и обнаружил, что может проходить всё
       подряд, а дороги обратно в кабинет нет — детская навигация подменила
       взрослую. Урок ему по-прежнему открыт (репетитору полезно видеть ровно
       то, что видит ребёнок), но теперь он видит и где находится, и как выйти. */
    var peek = (isAdminDevice() || isParentDevice())
      /* ⚠️ Текст обёрнут в span. Плашка — flex, и без обёртки каждый кусок
         текста вокруг <b> становился отдельным флекс-элементом: между
         «глазами ребёнка» и точкой вставал gap, а кнопка уезжала на вторую
         строку под текст. Жалоба фаундера 08.09.2026: «кнопка ниже текста,
         текст обрезан». */
      ? '<div class="peekbar"><span class="pktx">👀 Вы смотрите урок <b>глазами ребёнка</b>. ' +
        'Проходить его не нужно: прогресс этого устройства никому не показывается.</span> ' +
        '<button class="rbtn sec" id="peekout">← Вернуться в кабинет</button></div>'
      : "";
    var head = peek + '<div class="crumbs">' +
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
      (helpCan() ? '<button class="rbtn sec" id="helpbtn">🙋 Застрял — позвать взрослого</button>' : '') +
      '<span class="tip">за подсказку теряется одна звезда, за ревью — нет</span></div><div class="hintout" id="hintout"></div>' +
      '<div id="helpout"></div>';

    var prev = pos > 0 ? ready[pos-1] : null, next = pos < ready.length-1 ? ready[pos+1] : null;
    var pager = '<div class="pager"><button class="bigbtn ghost" data-go="world">← К списку уроков</button><span class="sp"></span>' +
      (prev ? '<button class="bigbtn ghost" data-open="' + prev.id + '">Назад</button>' : '') +
      (next ? '<button class="bigbtn ghost" data-open="' + next.id + '">Дальше →</button>' : '') + '</div>';

    /* Первый урок в жизни: три строки о том, какая кнопка что делает. Дальше
       полоска не показывается — она нужна ровно один раз, а место на экране
       дороже. Условие «ни один урок ещё не пройден», а не «это первый урок»:
       ребёнок может начать не с начала (панель репетитора умеет снимать замки). */
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
        /* ⚠️ Заметка взрослого стоит ПЕРВОЙ, до теории. Если репетитор
           написал «начни со второго примера, первый мы разобрали», прочитать
           это после теории уже поздно. */
        '<div class="lcol-read">' + noteCardHTML(noteFor(S, l.id)) +
          theory + goal + bug + askCard + '</div>' +
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
    /* Пометки взрослого к строкам: редактор ищет их сам по тексту строки и
       ставит точку в колонке номеров (см. sync). Даём ему список один раз. */
    {
      var myNote = noteFor(S, l.id);
      if (myNote && myNote.marks.length && studio.editor.setNotes)
        studio.editor.setNotes(myNote.marks);
    }
    wireHint(body.task.hints, function(){ logOf(l.id).hints++; save(); });
    wireHelp(l.id);
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
    var pk = document.getElementById("peekout");
    if (pk) pk.onclick = goHome;      /* «домой по роли» — то есть в кабинет */
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

/* ================= заметка репетитора к уроку =================
   Корзина 3.7, и заодно ответ на второй вопрос фаундера 07.09.2026 — «можем
   ли мы сделать рабочее пространство, где репетитор объясняет ребёнку на
   экране».

   ⚠️ Совместную доску с курсором и голосом мы НЕ строим, и это решение, а не
   отсрочка. Репетитор и так сидит с ребёнком в видеозвонке с демонстрацией
   экрана, и объясняет он там лучше, чем сделаем мы; повторять Zoom значит
   соревноваться там, где мы заведомо слабее. Наше преимущество в другом:
   запустить код ребёнка, показать расхождение и передать задание. Плюс
   технически: связь у нас — облачная функция с опросом раз в пять секунд, у
   хранилища уже замерен кэш, из-за которого кадры прыгают, и совместный
   редактор на этом не поедет.

   Заметка делает то, чего видеозвонок не умеет: работает, когда репетитора
   рядом НЕТ — а это почти всё время ребёнка. Взрослый пишет две фразы к
   уроку 34, они уезжают по коду вместе с прогрессом, и ребёнок видит их,
   когда откроет этот урок. Хоть через неделю.

   Три ограничения:
     1. **Одна заметка на урок.** Не переписка и не лента: две правки одного
        текста — это один текст, а не два. Слияние берёт свежую.
     2. **Обратного канала нет.** Ребёнок заметку читает, а не отвечает на
        неё. Болталка — красная линия продукта, и заводить её с чёрного хода
        через «заметки» нельзя.
     3. **Дошло ли — видно по уже имеющимся данным**, а не по расписке о
        прочтении. Взрослому показываем, открывал ли ребёнок этот урок после
        того, как заметка написана: журнал уроков и так синхронизируется, и
        нового наблюдения за ребёнком тут не заводится.
   ============================================================ */
var NOTE_MAX = 400;          /* длиннее — это уже не заметка, а урок */
var NOTE_MARKS_MAX = 5;      /* пометок к строкам на урок */
var NOTE_MARK_MAX = 200;     /* длина одной пометки к строке */
function notesAll(st){ var o = (st || S).notes; return (o && typeof o === "object") ? o : {}; }
/* Заметка к уроку или null. ⚠️ Пустой текст — это НАДГРОБИЕ снятой заметки,
   а не заметка: показывать его нельзя, а хранить надо (см. mergeProgress). */
function noteMarks(n){
  return (n && Array.isArray(n.marks) ? n.marks : []).filter(function(m){
    return m && String(m.t || "").trim();
  }).slice(0, NOTE_MARKS_MAX);
}
function noteFor(st, id){
  var n = notesAll(st)[id];
  if (!n) return null;
  var t = String(n.t || "").trim(), marks = noteMarks(n);
  if (!t && !marks.length) return null;       /* надгробие снятой заметки */
  return { t: String(n.t || ""), by: n.by || "", at: n.at || 0, id: id, marks: marks };
}
/* ===== пометка к строке =====
   ⚠️ Номер строки сам по себе врёт. Взрослый пишет пометку к третьей строке
   ЗАГОТОВКИ, а ребёнок к тому времени дописал две строки выше — и пометка
   показывает не туда. Поэтому вместе с номером храним ТЕКСТ строки, какой её
   видел взрослый, и на стороне ребёнка ищем именно его:
     — стоит на своём номере — там и показываем;
     — переехала — показываем там, где она теперь;
     — строки больше нет — номера не даём вовсе, показываем пометку с цитатой.
   Соврать «строка 3», показав на чужую строку, хуже, чем не показать номер. */
function noteMarkLine(code, mark){
  var want = String((mark && mark.src) || "").trim();
  if (!want) return 0;
  var lines = String(code || "").split("\n");
  var ln = Math.round((mark && mark.ln) || 0);
  if (ln >= 1 && ln <= lines.length && lines[ln - 1].trim() === want) return ln;
  for (var i = 0; i < lines.length; i++) if (lines[i].trim() === want) return i + 1;
  return 0;
}
/* Пометки урока, разложенные по ТЕКУЩЕМУ коду ребёнка. */
function noteMarksFor(st, id, code){
  var n = noteFor(st, id);
  if (!n) return [];
  return n.marks.map(function(m){
    return { ln: noteMarkLine(code, m), src: String(m.src || ""), t: String(m.t || "") };
  });
}
function noteList(st){
  return Object.keys(notesAll(st))
    .map(function(id){ return noteFor(st, id); })
    .filter(Boolean)
    .sort(function(a, b){ return b.at - a.at; });
}
/* Открывал ли ребёнок урок ПОСЛЕ того, как заметка написана. Считается по
   журналу, который и так ездит на сервер: нового слежения не заводим. */
function noteSeenHint(st, n){
  var g = ((st || {}).log || {})[n.id] || {};
  if (!g.last) return "урок ещё не открывал";
  return g.last >= n.at ? "с тех пор урок открывал" : "с тех пор урок не открывал";
}
/* Кто пишет — та же подпись, что у домашки: роль, а не имя. */
function noteWho(){ return (typeof hwWho === "function") ? hwWho() : "репетитор"; }
/* Карточка заметки на экране урока. Стоит НАД теорией: если взрослый написал
   «начни со второго примера», прочитать это после теории уже поздно. */
function noteCardHTML(n){
  if (!n) return "";
  /* ⚠️ Номера строки в карточке НЕТ намеренно. Номер устаревает от первой же
     дописанной строки, а соврать «строка 3», показав на чужую, хуже, чем не
     называть номер вовсе. Строку ребёнок узнаёт по цитате, а ГДЕ она — по
     точке в колонке номеров редактора: та ищет строку заново при каждом
     наборе и врать не может. */
  var marks = (n.marks || []).map(function(m){
    return '<li>' + (m.src ? '<code>' + esc(String(m.src).trim()) + '</code> ' : '') +
      esc(m.t) + '</li>';
  }).join("");
  return '<div class="lnote"><b>✍️ ' + esc(n.by || "взрослый") + ' оставил заметку' +
    (n.at ? ' · ' + fmtWhen(n.at) : '') + '</b>' +
    (String(n.t || "").trim() ? '<p>' + esc(n.t) + '</p>' : '') +
    (marks ? '<ul class="lnmarks">' + marks + '</ul>' +
      '<p class="dim">Строки с пометкой отмечены точкой в колонке номеров.</p>' : '') +
    '</div>';
}

/* ================= лестница выхода из затыка =================
   Пункт Б из разбора вопроса фаундера 07.09.2026: «что делать, когда ребёнок
   уперся в урок и никак не может его решить».

   Выход из трудного урока в продукте был с самого начала — подсказки по одной
   и «Показать решение» на одну звезду вместо трёх. Но НИКТО про него ребёнку
   не говорил: неудачные попытки нигде не считались, и на пятой попытке экран
   отвечал ровно то же, что на двадцать пятой, — «Ещё не то». Обе кнопки стоят
   в углу с первой секунды и выглядят как «сдаться». Десятилетний их не нажмёт:
   он ткнёт «Проверить» ещё двадцать раз и закроет вкладку.

   ⚠️ Четыре правила, без которых лестница превращается в укор:
     1. **Виноват урок, а не ребёнок.** «Тут застревают многие» — и ни одного
        «ты не справился». Виноватый не возвращается (то же правило, что у
        напоминания молчащему).
     2. **Ничего не запирается и не дорожает.** Подсказка стоит звезды и без
        нас; лестница цену не поднимает и ничего не отнимает сверх этого.
     3. **Каждая ступень называет СЛЕДУЮЩИЙ шаг, а не сделанный.** «Возьми
        подсказку» тому, кто взял их все, читается как «плохо старался» — тот
        же промах, что и в совете взрослому (stuckAdvice).
     4. **Раньше четвёртой попытки лестницы нет.** Одна-три попытки — это
        нормальный ход работы, и лезть туда с утешением значит мешать.
   ============================================================ */
var STEP_HINT = 4;    /* с этой попытки предлагаем подсказку */
var STEP_SOL  = 8;    /* с этой — решение, даже если подсказки ещё есть */
var STEP_REST = 14;   /* с этой, когда решение уже открыто, — отложить */
/* Какая ступень сейчас. ⚠️ Ничего не берёт из session сама, всё приходит
   доводами: так её видно тесту целиком, без подмены живого состояния урока.
   Считать надо именно по ТЕКУЩЕМУ заходу, а не по журналу: журнал копит
   попытки за все дни, и ребёнок, вернувшийся назавтра со свежей головой,
   получил бы «отложи» на первом же нажатии. */
function stuckStep(a, took, shown, hintsAll){
  a = a || 0; took = took || 0; shown = !!shown;
  hintsAll = hintsAll || 0;
  if (a < STEP_HINT) return null;
  if (shown) return a >= STEP_REST ? { k:"rest" } : null;
  /* Подсказка ещё есть — зовём её, но не на каждой попытке: после взятой
     подсказки даём два хода тишины, иначе лестница дёргает за рукав. */
  if (took < hintsAll && a < STEP_SOL && a >= STEP_HINT + took * 2)
    return { k:"hint", left: hintsAll - took };
  if (a >= STEP_SOL || took >= hintsAll) return { k:"sol", took: took };
  return null;
}
function stuckStepHTML(step){
  if (!step) return "";
  if (step.k === "hint")
    return '<div class="stkstep"><b>Тут застревают многие</b>' +
      'Это трудное место урока. Подсказка объясняет приём на других числах — ответ она не выдаёт, ' +
      'решать всё равно тебе.' +
      '<button class="rbtn check" id="stkgo" data-stk="hint">💡 Взять подсказку</button>' +
      '<span class="stknote">осталось ' + step.left + ' ' +
      plural(step.left, "подсказка", "подсказки", "подсказок") + '</span></div>';
  if (step.k === "sol")
    return '<div class="stkstep"><b>Можно посмотреть, как это делается</b>' +
      (step.took ? 'Подсказки уже брал, а урок не идёт. ' : 'Подсказки тут не помогли. ') +
      'Открыть решение — это не проигрыш: прочитай его строчку за строчкой, запусти, ' +
      'поменяй числа и посмотри, что изменится. Так тоже учатся, и часто быстрее.' +
      '<button class="rbtn check" id="stkgo" data-stk="sol">Показать решение</button>' +
      '<span class="stknote">за урок будет одна звезда вместо трёх</span></div>';
  return '<div class="stkstep"><b>Сегодня этот урок не идёт — так бывает</b>' +
    'Это про урок, а не про тебя. Отложи его и вернись завтра: часто наутро видно сразу. ' +
    'Взрослый увидит в отчёте, что здесь было трудно, — просить об этом не нужно.' +
    '<button class="rbtn check" id="stkgo" data-stk="rest">← Отложить и вернуться позже</button></div>';
}
/* Кнопка ступени не делает ничего своего: она нажимает те же кнопки урока,
   что стоят в углу. Значит цена подсказки и решения ровно та же, что была, и
   разойтись эти два пути не могут. */
function bindStuckStep(l){
  var b = document.getElementById("stkgo");
  if (!b) return;
  b.onclick = function(){
    var k = b.getAttribute("data-stk");
    if (k === "rest") return screenWorld(l.world);
    var target = document.getElementById(k === "hint" ? "hintbtn" : "solbtn");
    if (target) target.click();
  };
}

function runCheck(l, body, ed, showMsg, canvas){
  session.attempts++;
  logOf(l.id).attempts++; touchLog(l.id);
  var chk = body.task.check, code = ed.getCode(), eng = Runtime.get(l.engine);
  /* ⚠️ Любой неуспех уходит через fail(), а не через showMsg напрямую.
     Путей неудачи здесь пять — «Почти», «Так нельзя», ошибка Python, «Ещё не
     то» и «это не починка», — и ребёнку совершенно всё равно, на каком из них
     он застрял. Лестница обязана появляться на всех, иначе она появлялась бы
     ровно там, где мы про неё вспомнили. */
  function fail(cls, html){
    showMsg(cls, html + stuckStepHTML(stuckStep(session.attempts, session.hints,
      session.shown, (body.task.hints || []).length)));
    bindStuckStep(l);
  }

  /* Требования проверяем по ВСЕМ файлам задания, а не только по главному:
     в многофайловом уроке нужная строчка законно живёт в подключённом файле. */
  var srcsForCheck = ed.getSources ? ed.getSources() : {};
  var весьКод = code;
  for (var fk in srcsForCheck) весьКод += "\n" + srcsForCheck[fk];

  if (chk.needCode){
    for (var i = 0; i < chk.needCode.length; i++){
      if (!codeHas(весьКод, chk.needCode[i])){
        fail("warn", "<b>Почти</b>" + chk.needMsg);
        return;
      }
    }
  }
  /* needText — проверка по подстроке: нужна там, где искать «по словам»
     нельзя, например для «-> str» или для тройных кавычек. */
  if (chk.needText){
    for (var t2 = 0; t2 < chk.needText.length; t2++){
      if (весьКод.indexOf(chk.needText[t2]) < 0){
        fail("warn", "<b>Почти</b>" + chk.needMsg);
        return;
      }
    }
  }
  /* Запрещённые конструкции: например урок про рекурсию должен решаться
     рекурсией, а не циклом — иначе смысл урока теряется. */
  if (chk.noCode){
    for (var j = 0; j < chk.noCode.length; j++){
      if (codeHas(весьКод, chk.noCode[j])){
        fail("warn", "<b>Так нельзя</b>" + (chk.noMsg || ("В этом задании нельзя использовать «" + chk.noCode[j] + "».")));
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
  if (res.error){ ed.setError(res.error.line); fail("bad", errHTML(res.error)); return; }

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

  if (problem){ fail("bad", "<b>Ещё не то</b>" + problem); return; }

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
      fail("warn", "<b>Работает, но это не починка</b>Вывод правильный — только строк изменено больше, чем нужно: " +
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
    '<div class="winxp">+' + (gained + lean.xp) + ' XP</div>' + winSaveHTML() + '<div class="winrow">' +
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
  winSaveWire();
}
function closeWin(){ document.getElementById("win").classList.remove("show"); }

/* ===== имя — после первой победы, а не на входе =====
   ⚠️ Решение 11.09.2026 (1.138.0). Вывеска больше не просит представиться:
   «Начать первый урок» открывает урок гостем. Имя спрашиваем ЗДЕСЬ — когда у
   ребёнка уже есть что сохранять, и просьба звучит как «сохранить сделанное»,
   а не как анкета на входе.
   Гость — это устройство без кода и без имени, и не взрослое: у репетитора и
   родителя урок — просмотр, сохранять там нечего и некому.
   Просьба не мешает идти дальше: «Дальше →» работает и без имени, а на
   следующей победе гостя спросят снова. Прогресс при этом не теряется —
   doRegister гостю его не стирает (там же разбор, почему). */
function guestKid(){
  return !myCode() && !S.name && !isAdminDevice() && !isParentDevice();
}
function winSaveHTML(){
  if (!guestKid()) return "";
  return '<div class="winsave" id="winsave">' +
    '<b>Сохранить, что получилось?</b>' +
    '<p>Впиши имя — и урок останется за тобой.</p>' +
    '<div class="ldauthrow">' +
      '<input type="text" id="wsname" autocomplete="off" spellcheck="false" maxlength="24"' +
        ' aria-label="Твоё имя" placeholder="Как тебя зовут?">' +
      '<button class="bigbtn" id="wsgo">Сохранить</button>' +
    '</div><div class="msg" id="wsmsg"></div></div>';
}
function winSaveWire(){
  var go = document.getElementById("wsgo"), inp = document.getElementById("wsname");
  if (!go || !inp) return;
  function keep(){
    doRegister(inp.value, function(err){
      var m = document.getElementById("wsmsg");
      if (m){ m.className = "msg show bad"; m.innerHTML = "<b>" + esc(err) + "</b>"; }
      if (inp.focus) inp.focus();
    }, { stay: true });
    if (!S.name) return;                    /* имя не подошло — ошибка уже на экране */
    var code = myCode();
    document.getElementById("winsave").innerHTML =
      '<p class="winsaved">✅ Готово, <b>' + esc(S.name) + '</b>! Урок сохранён за тобой.' +
      (code ? ' Код для входа с другого устройства — <b>' + esc(code) + '</b>.' : '') + '</p>';
  }
  go.onclick = keep;
  inp.addEventListener("keydown", function(e){
    if (e.key !== "Enter") return;
    e.preventDefault(); e.stopPropagation();    /* Enter здесь — «сохранить», а не «дальше» */
    keep();
  });
}

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
/* Тот же чистый лист, но для настоящего Python: черепашки там нет, и
   встретить ребёнка кодом, который сразу падает, было бы издевательством.
   Подменяется ТОЛЬКО нетронутый пример — своё написанное не трогаем никогда. */
var SANDBOX_START_PY = 'import sys\n\nprint("Это настоящий Python", sys.version.split()[0])\n\nfor i in range(1, 6):\n    print(i, "в квадрате —", i * i)\n';
/* ================= настоящий Python в песочнице =================
   ⚠️ Уехал в js/sandbox.js — пятый шаг по архитектурному долгу. Почему S и
   session передаются функциями, а не значениями, написано в шапке того файла:
   это правило, а не стиль. */
var SANDBOX = KVSCREENS.sandbox({
  app: app, esc: esc, errHTML: errHTML, enterScreen: enterScreen, refreshTop: refreshTop,
  save: save, award: award, copyText: copyText, claimScreen: claimScreen,
  draftFlush: draftFlush, draftSchedule: draftSchedule, makeStudio: makeStudio,
  galleryAll: galleryAll, galleryDrawing: galleryDrawing, gallerySave: gallerySave,
  myWorkById: myWorkById, myWorkLink: myWorkLink, myWorkSave: myWorkSave,
  /* ⚠️ screenViz — обёрткой: визуализатор с 15.09.2026 модуль, его переменная
     присваивается НИЖЕ по файлу, и значением сюда приехал бы undefined (§ 4.40). */
  /* ⚠️ Обёрткой: портфолио — модуль ниже по файлу (§ 4.40). */
  screenFolio: function(){ screenFolio(); }, screenStale: screenStale,
  screenViz: function(o){ screenViz(o); },
  screenWorlds: screenWorlds,
  SANDBOX_START: SANDBOX_START, SANDBOX_START_PY: SANDBOX_START_PY,
  SFX_KEY: SFX_KEY, VOICE_KEY: VOICE_KEY,
  /* ⚠️ Функциями: и прогресс, и сессия — чужое изменяемое состояние. */
  S: function(){ return S; }, session: function(){ return session; },
  newSession: function(v){ session = v; }
});
var screenSandbox = SANDBOX.screenSandbox;

/* ================= свои проекты =================
   Пункт 2.4 плана. Из песочницы уходило всё, кроме рисунков: написал программу,
   ушёл с экрана — и её нет. Рисунок при этом сохранялся, а игра-угадайка,
   калькулятор или считалка — нет, потому что черепашка в них не участвовала.

   ⚠️ Отличие от галереи и от мастерской, и оно содержательное. Галерея хранит
   РИСУНКИ и название берёт сама, из первой строки-комментария. Мастерская
   хранит вещи, собранные из деталей. А здесь ребёнок сам даёт имя и сам
   пишет, что это такое, — и это половина смысла: пока не назовёшь, оно не
   твоё, а просто код в редакторе.

   ⚠️ Описание не для нас: его читает тот, кому отправят ссылку. Он открывает
   игру, не видя кода, и ему надо понять, что делать.
   ============================================================ */
var WORK_MAX = 20;            /* столько своих проектов держим */
var WORK_TITLE_MAX = 40;
var WORK_ABOUT_MAX = 160;

function myWorksAll(){ S.works = S.works || {}; return S.works; }
function myWorksList(){
  var d = myWorksAll();
  return Object.keys(d).map(function(k){
    var x = d[k];
    if (!x || typeof x.code !== "string" || !x.code.trim()) return null;
    return { id:k, code:x.code, title:x.title || "Программа",
             about:x.about || "", at:x.at || 0 };
  }).filter(Boolean).sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
}
/* ⚠️ id не может строиться из одних миллисекунд. Два сохранения подряд
   попадают в одну миллисекунду, получают ОДИН id, и второе молча затирает
   первое — поймано глазами 07.09.2026: сохранил две программы, в «Моём»
   осталась одна. Добавляем счётчик, который не повторяется в пределах
   загрузки страницы. */
var workSeq = 0;
function myWorkSave(title, about, code){
  var d = myWorksAll();
  var id = "w" + Date.now().toString(36) + (++workSeq).toString(36);
  while (d[id]) id = "w" + Date.now().toString(36) + (++workSeq).toString(36);
  d[id] = { title: String(title || "").trim().slice(0, WORK_TITLE_MAX) || "Программа",
            about: String(about || "").trim().slice(0, WORK_ABOUT_MAX),
            code: String(code || ""), at: Date.now() };
  var keys = Object.keys(d);
  if (keys.length > WORK_MAX){
    keys.sort(function(a, b){ return (d[a].at || 0) - (d[b].at || 0); });
    keys.slice(0, keys.length - WORK_MAX).forEach(function(k){ delete d[k]; });
  }
  save();
  return id;
}
function myWorkDrop(id){ delete myWorksAll()[id]; save(); }
function myWorkById(id){
  var xs = myWorksList();
  for (var i = 0; i < xs.length; i++) if (xs[i].id === id) return xs[i];
  return null;
}
/* Ссылка на свой проект — тот же механизм, что у игр (#play=): программа
   уезжает внутри адреса, сервер не нужен, а тот, кто открыл, видит её
   работающей и не видит кода. Описание едет заголовком: без него друг
   открывает окно и не знает, что делать. */
function myWorkLink(w){
  return playLink({ title: w.title, code: w.code,
                    author: myName() || "", emoji: "🛠" });
}

/* ================= выпускной мира =================
   Пункт 2.2 плана. Мир заканчивается проектом, и до сих пор в этот момент
   ребёнку показывали собранную программу — и всё. А главный вопрос у него
   другой: «что я теперь умею». Ответ на него нигде не звучал ни разу.

   ⚠️ Умения написаны ГЛАГОЛАМИ и от первого лица ребёнка, а не темами
   программы. «Списки, словари, множества» — это оглавление учебника, оно
   ничего не говорит о нём самом. «Считаю, сколько раз встретилось слово» —
   говорит.

   ⚠️ У каждого умения стоит id урока, где оно появилось, и это не украшение:
   строчка «а где это было» превращает список из похвалы в оглавление своей
   же памяти. Тест требует, чтобы урок существовал. */
var WORLD_SKILLS = {
  1: [
    { v:"печатаю на экран текст и числа и знаю, чем они отличаются", id:"text-vs-num" },
    { v:"складываю, делю с остатком и не путаюсь в порядке действий", id:"math" },
    { v:"читаю красный текст ошибки и понимаю, в какой строке беда", id:"errors-read" },
    { v:"вставляю числа прямо в текст через f-строку", id:"fstrings" },
    { v:"режу строку на части и собираю обратно", id:"text-work" },
    { v:"рисую черепашкой: квадрат, спираль, узор", id:"for-turtle" },
    { v:"повторяю действие циклом вместо того, чтобы писать его двадцать раз", id:"for-range" },
    { v:"ставлю условие: программа принимает решение сама", id:"if-else" },
    { v:"храню много значений в списке и хожу по нему", id:"lists-first" },
    { v:"пишу свою команду с именем — функцию", id:"functions" }
  ],
  2: [
    { v:"вырезаю кусок списка срезом, без единого цикла", id:"slices" },
    { v:"сортирую по своему правилу, а не только по возрастанию", id:"sorting" },
    { v:"строю поле и карту двумерным списком", id:"grid" },
    { v:"держу данные в словаре: по ключу, а не по номеру", id:"dict-first" },
    { v:"считаю, сколько раз встретилось слово или буква", id:"dict-counter" },
    { v:"оставляю только уникальные значения множеством", id:"sets" },
    { v:"собираю новый список одной строкой — включением", id:"comp-basic" },
    { v:"разбираю текст и считаю по нему статистику", id:"text-stats" }
  ],
  3: [
    { v:"пишу функции с параметрами и значениями по умолчанию", id:"fn-default" },
    { v:"возвращаю из функции сразу несколько значений", id:"fn-multi" },
    { v:"решаю задачу рекурсией — функцией, которая зовёт саму себя", id:"recursion" },
    { v:"раскладываю программу по своим модулям и подключаю их", id:"modules-own" },
    { v:"ловлю ошибку через try и except вместо того, чтобы падать", id:"try-except" },
    { v:"пишу тесты, которые проверяют мой код за меня", id:"assert" },
    { v:"описываю вещь классом: свои поля и свои методы", id:"class-first" },
    { v:"наследую класс от класса и не переписываю общее дважды", id:"inherit" }
  ],
  4: [
    { v:"подключаю чужие модули и знаю, что лежит в стандартной библиотеке", id:"imports" },
    { v:"считаю даты и сроки, не путаясь в длине месяцев", id:"datetime" },
    { v:"читаю файл с диска и записываю в него результат", id:"files-write" },
    { v:"разбираю JSON — то, чем говорят между собой программы", id:"json" },
    { v:"читаю таблицу CSV и считаю по её столбцам", id:"csv" },
    { v:"нахожу в тексте нужное регулярным выражением", id:"regex" },
    { v:"пишу генератор и понимаю, чем он дешевле списка", id:"generators" },
    { v:"вижу, что в программе тормозит, и умею это измерить", id:"perf" }
  ],
  5: [
    { v:"собираю игру-квест из комнат, вещей и правил", id:"quest-2" },
    { v:"загружаю данные, чищу их и отвечаю ими на вопрос", id:"data-2" },
    { v:"разбираю ответ сервера и достаю из него нужное", id:"api-2" },
    { v:"делаю страницу, которая открывается в браузере", id:"web-2" },
    { v:"храню историю изменений в git и не боюсь сломать", id:"git-1" },
    { v:"ищу ответ в документации, а не жду, пока подскажут", id:"docs" }
  ]
};
/* Порядок — по урокам, а не по тому, как я их выписал: список читается как
   дорога, которую ребёнок прошёл, и «урок 13» перед «уроком 11» эту дорогу
   ломает. Сортируем здесь, чтобы в самих данных можно было держать умения в
   любом удобном для правки порядке. */
function worldSkills(n){
  return (WORLD_SKILLS[n] || []).slice().sort(function(a, b){
    var la = CURRICULUM.byId(a.id), lb = CURRICULUM.byId(b.id);
    return ((la && la.num) || 0) - ((lb && lb.num) || 0);
  });
}
/* Мир считается выпущенным по тому же правилу, что и сертификат: все уроки
   пройдены И проект собран. Иначе «выпускной» наступал бы, когда главное
   дело мира ещё не сделано. */
function worldGraduated(n){ return certWorldReady(n); }

function screenWorldDone(n){
  var w = CURRICULUM.world(n);
  if (!w) return screenWorlds();
  var seq = enterScreen("home", "worlddone");
  session = { id:null, attempts:0, hints:0, shown:false };
  worldContent(n).then(function(){
    if (screenStale(seq)) return;
    var skills = worldSkills(n);
    var p = projectOfWorld(n);
    var stars = 0;
    w.lessons.forEach(function(l){ stars += starsOf(l.id) || 0; });
    var next = CURRICULUM.world(n + 1);

    var h = '<div class="crumbs"><span data-go="home">🏠 Главное</span> › 🎓 Выпускной мира ' + n + '</div>' +
      '<div class="lvlhead"><div><div class="idx">мир ' + n + ' пройден</div>' +
      '<h1>🎓 ' + w.icon + ' ' + esc(w.title) + '</h1></div>' +
      '<div class="right"><span class="tag">★ ' + stars + '</span></div></div>' +
      '<p class="lede">Двадцать уроков и проект позади. Это не «молодец» — это список того, ' +
      'что ты теперь правда делаешь сам. Нажми на строчку, если хочешь вспомнить, где это было.</p>';

    h += '<div class="card gradlist"><h3>Ты теперь умеешь</h3><ul class="cando">';
    skills.forEach(function(s){
      var l = CURRICULUM.byId(s.id);
      h += '<li><button class="canitem" data-open="' + s.id + '">' +
        '<span class="cantick">✓</span><span class="cantxt">' + esc(s.v) + '</span>' +
        (l ? '<span class="canwhere">урок ' + l.num + '</span>' : '') + '</button></li>';
    });
    h += '</ul></div>';

    if (p && projectDone(p.id)){
      h += '<div class="card gradproof"><h3>И вот чем это доказано</h3>' +
        '<p>Проект «' + esc(p.title) + '» ты собрал сам, шаг за шагом. Программа цела, ' +
        'её можно запустить, показать и забрать себе.</p>' +
        '<div class="row"><button class="bigbtn" id="gr-proj">Открыть мой проект</button></div></div>';
    }

    /* ⚠️ Награда называется В ТОТ МОМЕНТ, когда она открылась. Набор, про
       который ребёнок узнаёт случайно в настройках через месяц, наградой не
       работает вовсе: он не связан ни с каким усилием. */
    var gsk = SKINS.filter(function(x){ return x.world === n; })[0];
    if (gsk && skinOpen(gsk)){
      var already = skinNow().id === gsk.id;
      h += '<div class="card"><h3>🎨 Открылся набор «' + esc(gsk.name) + '»</h3>' +
        '<p>Это цвет тренажёра и твой значок ' + gsk.em + ' в панели. Он твой навсегда: ' +
        'набор не сгорает и не отбирается. Поменять его можно в профиле в любой момент.</p>' +
        '<div class="row"><button class="bigbtn' + (already ? ' ghost' : '') + '" id="gr-skin"' +
        (already ? " disabled" : "") + '>' +
        (already ? "Уже включён" : "Включить " + gsk.em + " " + esc(gsk.name)) +
        '</button></div></div>';
    }

    h += '<div class="card gradshow"><h3>Показать взрослому</h3>' +
      '<p>Лист с твоим именем, названием мира и датой. Его можно распечатать ' +
      'или сохранить в PDF — и он останется у тебя на руках.</p>' +
      '<div class="row"><button class="bigbtn" id="gr-cert">🖨 Показать лист</button>' +
      '<button class="bigbtn ghost" id="gr-folio">🎒 Все мои работы</button></div></div>';

    h += '<div class="pager">' +
      (next ? '<button class="bigbtn" id="gr-next">Дальше: мир ' + next.n + ' · ' + esc(next.title) + ' →</button>' : '') +
      '<button class="bigbtn ghost" data-go="home">← На главную</button></div>';

    app.innerHTML = h;
    app.querySelectorAll("[data-open]").forEach(function(b){
      b.onclick = function(){ openLesson(b.getAttribute("data-open")); };
    });
    app.querySelectorAll('[data-go="home"]').forEach(function(b){ b.onclick = goHome; });
    var pj = document.getElementById("gr-proj");
    if (pj && p) pj.onclick = function(){ screenProjectDone(p.id); };
    document.getElementById("gr-cert").onclick = function(){ openCert(n); };
    document.getElementById("gr-folio").onclick = screenFolio;
    var nx = document.getElementById("gr-next");
    if (nx && next) nx.onclick = function(){ screenWorld(next.n); };
    var gs = document.getElementById("gr-skin");
    if (gs && gsk) gs.onclick = function(){ skinSet(gsk.id); screenWorldDone(n); };
    refreshTop();
    window.scrollTo({ top:0, behavior:"smooth" });
  });
}

/* ================= карта пути =================
   Сто уроков одной дорогой. Зачем это отдельным экраном, если на Главном
   уже есть пять карточек миров: карточки отвечают на вопрос «что внутри»,
   а карта — на другой, и он для ребёнка важнее: «сколько ещё и до чего».
   Пять карточек по двадцать уроков этого не показывают — из них не видно
   ни где ты, ни что впереди веха, ни как она близко.

   Это детская половина того, что на вывеске уже сделано для взрослого:
   родителю там показывают путь целиком, а ребёнку до сих пор показывали
   только следующий шаг.

   ⚠️ Ни одного процента и ни одного «осталось N дней». Расстояние меряется
   ЗАНЯТИЯМИ — той единицей, которую ребёнок чувствует, — и считается по его
   собственному темпу (frame().perLesson), как и всё остальное в продукте. */
function pathZan(left){
  return Math.max(1, Math.ceil(left / zanSlotsFor(frame().len || 30)));
}
/* Ближайшая веха: проект того мира, в котором ребёнок сейчас.
   null — если весь курс пройден или ни один мир ещё не начат. */
function pathAhead(){
  var next = nextLesson();
  if (!next) return null;
  var w = CURRICULUM.world(next.world);
  if (!w) return null;
  var left = 0;
  w.lessons.forEach(function(l){ if (!solved(l.id)) left++; });
  return { world: w, next: next, left: left, zan: pathZan(left),
           project: projectOfWorld(w.n) };
}
/* Состояние шага на карте. Отдельной функцией, потому что его читают и
   разметка, и подпись, и тест. */
function pathState(l){
  if (solved(l.id)) return "done";
  if (!lessonBody(l)) return "soon";
  return lessonOpen(l) ? "open" : "lock";
}

function screenPath(){
  var seq = enterScreen("home", "path");
  session = { id:null, attempts:0, hints:0, shown:false };
  allWorldsContent().then(function(){
    if (screenStale(seq)) return;
    var done = Object.keys(S.stars).length;
    var next = nextLesson();
    var ah = pathAhead();

    var h = '<div class="crumbs"><span data-go="home">🏠 Главное</span> › 🗺 Карта пути</div>' +
      '<div class="lvlhead"><div><div class="idx">весь курс одной дорогой</div>' +
      '<h1>🗺 Карта пути</h1></div>' +
      '<div class="right"><span class="tag">' + done + ' из ' + CURRICULUM.total + '</span></div></div>' +
      '<p class="lede">Сто уроков по порядку и пять вех: в конце каждого мира — проект, ' +
      'который ты собираешь сам и уносишь с собой. Нажми на любой открытый кружок — откроется тот урок.</p>';

    /* Строка «ты здесь». Она же отвечает на вопрос, который ребёнок задаёт
       чаще всего: «сколько ещё до чего-то большого». */
    h += '<div class="pathnow">';
    if (!next){
      h += '<b>🏁 Весь курс пройден.</b> Дорога кончилась, но тренировки, игры и своя песочница остались.';
    } else {
      h += '<b>📍 Ты здесь: урок ' + next.num + ' — «' + esc(next.title) + '».</b> ';
      if (ah && ah.project){
        h += 'До вехи «' + esc(ah.project.title) + '» — ' + ah.left + ' ' +
             plural(ah.left, "урок", "урока", "уроков") + ', примерно ' + ah.zan + ' ' +
             plural(ah.zan, "занятие", "занятия", "занятий") + '.';
      }
      /* Карта длинная, и у того, кто дошёл до пятого мира, «ты здесь» уходит
         далеко вниз. Кнопка, а не автопрокрутка: прыгать самому по экрану
         сразу после открытия — значит унести ребёнка от строки, которую он
         только начал читать. */
      h += ' <button class="rbtn sec" id="p-where">Показать, где я</button>';
    }
    h += '</div>';

    h += '<div class="pathmap">';
    CURRICULUM.forEach(function(w){
      var wdone = 0;
      w.lessons.forEach(function(l){ if (solved(l.id)) wdone++; });
      var pj = projectOfWorld(w.n);
      h += '<div class="prow">' +
        '<div class="phead"><span class="pico">' + w.icon + '</span>' +
        '<b>Мир ' + w.n + ' · ' + esc(w.title) + '</b>' +
        '<span class="pcnt">' + wdone + ' из ' + w.lessons.length + '</span></div>' +
        '<div class="pdots">';
      w.lessons.forEach(function(l){
        var st = pathState(l);
        var here = next && l.id === next.id;
        var подпись = "Урок " + l.num + ": " + l.title +
          (st === "done" ? " — пройден" : st === "soon" ? " — ещё не готов"
            : st === "lock" ? " — откроется позже" : " — можно открыть");
        h += '<button class="pstep ' + st + (here ? " here" : "") + '"' +
          (st === "done" || st === "open" ? ' data-lesson="' + l.id + '"' : ' disabled') +
          ' title="' + esc(подпись) + '" aria-label="' + esc(подпись) + '">' +
          l.pos + (here ? '<span class="pflag">ты здесь</span>' : '') + '</button>';
      });
      h += '</div>';
      if (pj){
        var pdone = projectDone(pj.id), popen = projectOpen(pj);
        var grad = worldGraduated(w.n);
        h += '<button class="pmile' + (pdone ? " done" : popen ? " open" : "") + '"' +
          (grad ? ' data-grad="' + w.n + '"' : popen ? ' data-proj="' + pj.id + '"' : ' disabled') + '>' +
          '<span class="pmem">' + pj.emoji + '</span>' +
          '<span class="pmbody"><span class="pmkick">веха мира ' + w.n +
            (grad ? " · мир выпущен 🎓" : pdone ? " · собрана ✓" : popen ? " · открыта" : " · закрыта") + '</span>' +
          '<b>' + esc(pj.title) + '</b>' +
          '<span>' + esc(pj.tagline) + '</span></span></button>';
      }
      h += '</div>';
    });
    h += '</div>';

    h += '<p class="dim">Кружок с цифрой — урок, его номер внутри мира. ' +
      'Закрашенный — пройденный, светлый — открытый, тусклый — ещё закрыт. ' +
      'Внутри мира уроки открываются по одному: сдал — открылся следующий. ' +
      'А первый урок КАЖДОГО мира открыт сразу — можно заглянуть вперёд, ' +
      'не проходя всё подряд.</p>' +
      '<div class="pager"><button class="bigbtn" id="p-next">▶ ' +
      (next ? "Продолжить: урок " + next.num : "К тренировкам") + '</button>' +
      '<button class="bigbtn ghost" data-go="home">← На главную</button></div>';

    app.innerHTML = h;
    app.querySelectorAll(".pstep[data-lesson]").forEach(function(b){
      b.onclick = function(){ openLesson(b.getAttribute("data-lesson")); };
    });
    app.querySelectorAll(".pmile[data-proj]").forEach(function(b){
      b.onclick = function(){ openProject(b.getAttribute("data-proj")); };
    });
    app.querySelectorAll(".pmile[data-grad]").forEach(function(b){
      b.onclick = function(){ screenWorldDone(+b.getAttribute("data-grad")); };
    });
    app.querySelectorAll('[data-go="home"]').forEach(function(b){
      b.onclick = goHome;
    });
    document.getElementById("p-next").onclick = function(){
      if (next) openLesson(next.id); else screenTrain();
    };
    var where = document.getElementById("p-where");
    if (where) where.onclick = function(){
      var here = app.querySelector(".pstep.here");
      if (!here) return;
      try { here.scrollIntoView({ block:"center", behavior:"smooth" }); } catch(e){}
      /* ⚠️ Есть браузеры, которые МОЛЧА игнорируют behavior:"smooth" — не
         ошибка, не исключение, просто ничего не происходит. Замечено 07.09.2026
         на встроенной панели предпросмотра. Поэтому смотрим глазами: если
         кружок так и не попал в окно, доводим прокрутку без анимации.
         Кнопка, которая иногда не работает, хуже кнопки без анимации. */
      setTimeout(function(){
        var r;
        try { r = here.getBoundingClientRect(); } catch(e){ return; }
        if (r.top < 0 || r.bottom > (window.innerHeight || 0))
          try { here.scrollIntoView({ block:"center" }); } catch(e){}
      }, 400);
    };
    refreshTop();
    window.scrollTo({ top:0, behavior:"smooth" });
  });
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
  h += '</div>';

  /* ===== игры-проекты: собери свою =====
     Открываются собранным проектом мира (финал мира открывает следующую
     игру). Конечный список, а не лента: собрал — понёс другу, а не «ещё». */
  var gps = projectsList().filter(function(p){ return p.kind === "game"; });
  if (gps.length){
    h += '<div class="sect"><h2>🛠 Собери свою игру</h2><div class="line"></div></div>' +
      '<p class="dim">Эти игры не лежат готовыми — ты собираешь их сам, шаг за шагом. ' +
      'Собранная уходит в портфолио, а по ссылке её можно отправить другу: он будет играть, ' +
      'не видя твоего кода.</p><div class="gamegrid">';
    gps.forEach(function(p){
      var open = projectOpen(p), done = projectDone(p.id);
      var needName = "";
      if (!open && p.needs){
        var np = projectById(p.needs);
        needName = np ? np.title : "";
      }
      h += '<button class="gamecard' + (open ? "" : " locked") + '" data-proj="' + p.id + '"' +
        (open ? "" : " disabled") + '>' +
        '<span class="gemoji">' + p.emoji + '</span>' +
        '<b>' + esc(p.title) + (done ? ' <span class="edittag done">собрана ✓</span>' : '') + '</b>' +
        '<span>' + esc(p.tagline) + '</span>' +
        (open ? "" : '<span class="wtag">🔒 откроется, когда собран проект «' + esc(needName) + '»</span>') +
        '</button>';
    });
    h += '</div>';
  }

  h += '<div class="pager"><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';
  app.innerHTML = h;
  app.querySelectorAll(".gamecard[data-id]").forEach(function(b){
    b.onclick = function(){ openGame(b.getAttribute("data-id")); };
  });
  app.querySelectorAll(".gamecard[data-proj]").forEach(function(b){
    b.onclick = function(){ openProject(b.getAttribute("data-proj")); };
  });
  document.getElementById("tomap").onclick = goHome;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function openGame(id){
  var g = gamesList().filter(function(x){ return x.id === id; })[0];
  if (!g) return screenGames();
  /* Жёсткий потолок дня меряет ВСЁ время в тренажёре, а не только уроки, —
     значит и сюда новая работа после предела не пускает. */
  if (capHard()) return screenCapReached();
  enterScreen("train", "game");
  session = { id:null, attempts:0, hints:0, shown:false };
  var head = '<div class="crumbs"><span data-go="games">Игры</span> › ' + g.emoji + ' ' + esc(g.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">игра</div><h1>' + g.emoji + ' ' + esc(g.title) + '</h1></div></div>' +
    '<p class="lede">' + esc(g.desc) + '</p>' +
    '<div class="note"><b>Как играть</b>Нажми «Новая игра», потом пиши ходы в поле снизу и жми Enter. Хочешь изменить игру — правь код слева и снова жми «Новая игра».</div>';
  app.innerHTML = head + '<div id="studio"></div>' +
    '<div class="pager"><button class="bigbtn ghost" data-go="games">← Ко всем играм</button>' +
    '<span class="sp"></span>' +
    /* Ссылка уносит ТЕКУЩИЙ код: правил игру — друг сыграет твою версию.
       Это и есть крючок: у работы появляется зритель. */
    '<button class="bigbtn ghost" id="gshare">🔗 Отправить игру другу</button>' +
    '<button class="bigbtn ghost" id="greset">↩ Вернуть оригинал</button></div>';

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
  document.getElementById("gshare").onclick = function(){
    var code = studio.editor.getCode();
    var edited = code !== g.code;
    copyText(playLink({ title: g.title + (edited ? " — моя версия" : ""),
                        code: code, author: myName() || "", emoji: g.emoji }), this);
  };
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

  /* Подписи задаются снаружи, потому что этой же студией спрашивают не только
     «что напечатает»: экзамен по своей программе спрашивает ЧИСЛО. Значения по
     умолчанию — прежние, поэтому все старые вызовы работают как работали. */
  var ansBox = document.createElement("div");
  ansBox.className = "pane pans";
  ansBox.innerHTML = '<div class="ph">' + esc(cfg.ask || "что напечатает программа?") + '</div><div class="pb">' +
    '<textarea class="stdinbox predin" spellcheck="false" autocapitalize="off" autocorrect="off" rows="' +
    (cfg.rows || 6) + '" ' +
    'placeholder="' + esc(cfg.place || "Запиши вывод по строкам — так, как его напечатает программа") + '"></textarea>' +
    '<div class="stdinhint">' + esc(cfg.hint || "По строке на каждый print. Потом нажми «Проверить».") +
    '</div></div>';
  var ta = ansBox.querySelector("textarea");

  var runbar = document.createElement("div");
  runbar.className = "runbar";
  runbar.innerHTML = '<button class="rbtn check" data-role="check">✓ Проверить</button>' +
    '<button class="rbtn sec" data-role="clear">↺ Очистить</button>' +
    '<span class="sp"></span><span class="tip">сначала подумай, потом проверь</span>';

  var msg = document.createElement("div"); msg.className = "msg";

  var outPane = document.createElement("div"); outPane.className = "pane pout"; outPane.style.display = "none";
  outPane.innerHTML = '<div class="ph">' + esc(cfg.outHead || "настоящий вывод программы") +
    '</div><div class="console"></div>';
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
      '<input type="text" id="regcode" placeholder="например, sova-3f7a2" autocomplete="off" spellcheck="false" maxlength="32"></label>' +
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
   ⚠️ Уехал в js/account.js — шестой шаг по архитектурному долгу. Там же
   записана ловушка этого разреза: «data», «name» и «sfx» выглядели
   зависимостями, а были кусками разметки и местной переменной. */
var ACCOUNT = KVSCREENS.account({
  app: app, esc: esc, enterScreen: enterScreen, refreshTop: refreshTop,
  myCode: myCode, myName: myName, serverOn: serverOn, doLogout: doLogout,
  openAccessCard: openAccessCard, codeSaved: codeSaved, markCodeSaved: markCodeSaved,
  /* ⚠️ Обёрткой: вывеска и портфолио — модули ниже по файлу (§ 4.40). */
  goHome: goHome, screenAbout: function(){ screenAbout(); },
  screenFolio: function(){ screenFolio(); },
  screenGuide: screenGuide, screenRoles: screenRoles,
  themeGet: themeGet, themeSet: themeSet, sfxOn: sfxOn, sfxSet: sfxSet, sfx: sfx,
  speak: speak, voiceAuto: voiceAuto, voiceAutoSet: voiceAutoSet,
  voiceSupported: voiceSupported,
  skinPickHTML: skinPickHTML, bindSkinPick: bindSkinPick,
  liveRowHTML: liveRowHTML, bindLiveRow: bindLiveRow,
  installPossible: installPossible, installTipHTML: installTipHTML,
  wireInstallTip: wireInstallTip,
  session: function(){ return session; },
  newSession: function(v){ session = v; }
});
var screenAccount = ACCOUNT.screenAccount, copyText = ACCOUNT.copyText;
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
/* ⚠️ Блока «Щиты» на экране БОЛЬШЕ НЕТ, и это план, п. 4.4: щит работает
   молча. Сам механизм цел — пропущенный день закрывается сам, когда ребёнок
   вернётся (useShield в markActiveToday). А рассказывать про запас щитов
   значит заводить разговор о том, что серия может оборваться, — то есть
   ровно тот страх, который мы объявили красной линией. Молчание тут не
   умолчание: ребёнку нечего с этим делать, тратить щит руками нельзя. */

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
  var doneToday = activeOn(dayKey());
  var pick = dailyPick();
  var taskDone = dailyDone();
  var due = studyDue();
  var days = agreedDays();        /* рамка взрослого сильнее своего расписания */

  /* ⚠️ ОГОНЁК СТАЛ УГОВОРОМ (план, п. 4.4). Раньше здесь стояло число дней
     подряд, рекорд и запас щитов — то есть три способа сказать «тебе есть
     что терять». Красная линия продукта звучит ровно наоборот: «страх
     потерять серию» — то, чего мы не делаем.

     Что осталось: уговор (какие дни недели условлены), сегодняшний день и
     календарь занятий. Календарь — единственная честная вещь во всём блоке:
     он показывает, как было, и ничего не требует.

     ⚠️ Щит никуда не делся, он работает МОЛЧА: пропущенный день закрывается
     сам, когда ребёнок вернётся. Рассказывать про запас щитов — значит снова
     заводить разговор о том, что серия может оборваться. */
  var уговор = days.length
    ? "Уговор: " + days.length + " " + plural(days.length, "день", "дня", "дней") + " в неделю"
    : "Уговор пока не назначен";
  var часЗанятия = frameOn() ? frameTime() : "";
  var сегодня = doneToday
    ? "Сегодня уже занимался."
    : (due
        ? "Сегодня по уговору учебный день." + (часЗанятия ? " Занятие в " + часЗанятия + "." : "")
        : "Сегодня можно отдыхать — это не учебный день.");

  var hero = '<div class="streakhero">' +
    '<div class="flame' + (doneToday ? " lit" : "") + '">🔥</div>' +
    '<div class="streaknum">' + esc(уговор) + '</div>' +
    '<div class="streaksub">' + esc(сегодня) +
      (doneToday ? "" : " Один урок или одна разминка — и день засчитан.") + '</div>' +
    weekStripHTML() +
  '</div>';

  /* Сколько сегодня работал — ребёнку тоже: он спрашивает «сколько я уже
     позанимался?» ровно так же, как взрослый. Число честное: чистая работа
     без пауз, из карты часов. */
  var todayMs = dayMs(S, dayKey());
  var timeCard = todayMs
    ? '<div class="card"><h3>⏱ Сегодня за тренажёром</h3>' +
      '<p class="lede"><b>' + fmtDur(todayMs) + '</b> чистой работы.</p>' +
      '<p class="dim">Это только то время, когда ты действительно работал: ' +
      'открытая вкладка, пока тебя нет за столом, сюда не считается.</p></div>'
    : "";

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
  if (agreedOn()){
    if (studyDue())
      banner = '<div class="daybanner due">🔔 <b>Сегодня учебный день' +
        (часЗанятия ? ", занятие в " + esc(часЗанятия) : "") + '.</b> ' +
        'Начни занятие, чтобы не пропустить.</div>';
    else if (agreedStudyDay(dayKey()))
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
    '<div class="lvlhead"><div><div class="idx">уговор и задача дня</div><h1>🔥 Сегодня</h1></div>' +
      '<div class="right"><span class="tag">' + (doneToday ? "сегодня сделано" : due ? "сегодня учебный день" : "сегодня свободно") + '</span></div></div>' +
    /* ⚠️ Ни слова про «серию, которую жалко прерывать» — раньше это стояло
       прямо здесь и было честной формулировкой красной линии, только с той
       стороны, с которой её быть не должно. */
    '<p class="lede">Здесь уговор: в какие дни вы договорились заниматься, и что уже сделано. ' +
    'Пропущенный день ничего не сжигает — календарь просто покажет, как было. ' +
    'Звёзды тут не начисляются: важна не серия, а возвращение.</p>' +
    installTipHTML() + saved + banner + capNoteHTML() + zanCardHTML() + ptaskCardHTML() + hero + timeCard + taskCard + schedBox +
    '<div class="pager"><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';

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
  document.getElementById("tomap").onclick = goHome;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= экраны разминки =================
   ⚠️ Уехали в js/screens-warm.js — разрез 15.09.2026. Слой данных разминки
   и общая студия «что напечатает» остались выше: почему именно так — в шапке
   того файла. Визуализатор — обёртками: VIZ присваивается ниже по файлу. */
var WARM = KVSCREENS.warm({
  app: app, esc: esc, hl: hl, enterScreen: enterScreen, refreshTop: refreshTop, goHome: goHome,
  capHard: capHard, screenCapReached: screenCapReached, screenToday: screenToday, screenZan: screenZan,
  wireHint: wireHint, errHTML: errHTML, markActiveToday: markActiveToday, dayKey: dayKey,
  zanNote: zanNote, zanOpen: zanOpen, save: save, takeShieldNote: takeShieldNote,
  confetti: confetti, closeWin: closeWin,
  warmupsList: warmupsList, warmupOpen: warmupOpen, warmupsOpen: warmupsOpen, warmupDone: warmupDone,
  normPred: normPred, predictDiff: predictDiff, makePredictStudio: makePredictStudio,
  vizRecord: function(c, o){ return vizRecord(c, o); },
  vizShort: function(c, o){ return vizShort(c, o); },
  vizMemoryHTML: function(f, m){ return vizMemoryHTML(f, m); },
  vizDrawArrows: function(el){ return vizDrawArrows(el); },
  /* единственная запись в прогресс: «разгадано» и «задача дня сделана» */
  warmupMark: function(id, daily){
    S.warmups = S.warmups || {};
    S.warmups[id] = 1;
    if (daily){ S.daily = S.daily || {}; S.daily[dayKey()] = 1; }
  },
  session: function(){ return session; },
  newSession: function(v){ session = v; return v; }
});
var screenWarmups = WARM.screenWarmups, openWarmup = WARM.openWarmup,
    memFrame = WARM.memFrame, memAnswers = WARM.memAnswers, memNorm = WARM.memNorm;


/* ================= раздел: «Ты и ИИ» =================
   Упражнения про то, как командовать ИИ: точно ставить задачу,
   читать чужой код, проверять результат. Отдельный раздел, вне сотни.
   Прогресс в S.ailab (объединяется при слиянии), звёзд и XP не даёт.
   Внутри — гибрид механик: predict открывается студией разминки,
   code/fix — студией уроков, а review добавляет к студии панель вердикта.
   Контент — js/ailab.js (window.AILAB).
   ============================================================ */
function ailabList(){ return (window.AILAB || []); }
function ailabDone(id){ return !!(S.ailab && S.ailab[id]); }
/* Отметить задание сданным. Отдельным входом, а не записью снаружи: экраны
   раздела живут в js/screens-ailab.js и общего состояния не пишут. */
function ailabMark(id){ S.ailab = S.ailab || {}; S.ailab[id] = 1; }

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

  h += '<div class="pager"><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';
  app.innerHTML = h;
  app.querySelectorAll(".revcard").forEach(function(b){
    b.onclick = function(){ openLesson(b.getAttribute("data-id")); };
  });
  document.getElementById("tomap").onclick = goHome;
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

/* ================= алгоритмы и формат ОГЭ =================
   Вторая дверь под вывеску «информатика» (docs/vyveska.md). Внутри предмета
   самое искомое — экзамен и алгоритмы, и на наш движок это ложится целиком:
   задачи в формате ОГЭ 16 читают input() и печатают ответ, а судит их тот
   же интерпретатор, что и уроки.

   ⚠️ ЧЕСТНАЯ ГРАНИЦА, И ОНА НАПИСАНА НА ЭКРАНЕ. Мы не готовим к ОГЭ целиком:
   в экзамене шестнадцать заданий, и большинство — про кодирование информации,
   таблицы и файлы, а не про программирование. Мы закрываем задание 16 и
   алгоритмическую часть. Обещать больше — врать, и вранью тут цена особая:
   родитель узнает о нём в мае.

   ⚠️ Чем это отличается от всех тренажёров ЕГЭ/ОГЭ: **цену алгоритма здесь
   можно измерить, а не рассказать.** Движок считает шаги и так, ради защиты
   от вечного цикла. Сложность обычно объясняют буквой O; четырнадцатилетнему
   буква не говорит ничего, а «1000 шагов против 10» говорит всё.
   ============================================================ */
var ALGO_GROUPS = [
  { id:"search", em:"🔎", title:"Поиск",
    why:"Найти нужное — самая частая работа программы. И самая разная по цене." },
  { id:"cost",   em:"⚖️", title:"Цена алгоритма",
    why:"Здесь цену не рассказывают, а считают: движок знает, сколько шагов ушло." },
  { id:"sort",   em:"🫧", title:"Сортировка",
    why:"Упорядочить данные один раз — и всё, что после, станет дешевле." },
  { id:"base",   em:"🔢", title:"Системы счисления",
    why:"Ядро школьной информатики: перевод числа в другую систему и цифры без превращения в строку." },
  { id:"oge",    em:"📄", title:"Формат ОГЭ",
    why:"Каркас снят с открытого банка ФИПИ: признак через систему счисления, обязательное «NO», ограничения числами." },
  { id:"ege",    em:"🎓", title:"Типы ЕГЭ",
    why:"Свои формулировки по духу экзамена — только те типы, где надо написать программу: последовательности, делители, строки, системы счисления." },
  /* Три темы, которых до 1.77.0 не было вовсе, и ровно про них стояла оговорка
     «кодирование информации сюда не входит». Задачи лежат в js/algo-exam.js —
     почему отдельным файлом, написано в его шапке. */
  { id:"info",   em:"📦", title:"Кодирование информации",
    why:"Биты, байты и объём файла. Формулу здесь не заучивают, а выполняют шагами — и видно, откуда она берётся." },
  { id:"logic",  em:"🔀", title:"Логика",
    why:"Таблицы истинности и импликация. Самая непонятная часть школьной логики становится понятной на числах." },
  { id:"graph",  em:"🗺", title:"Графы",
    why:"Кто с кем связан, куда можно дойти и сколькими путями. Один обход в ширину закрывает три разных вопроса." },
  /* Две темы, добавленные в 1.81.0. Обе из тех, что на экзамене встречаются
     каждый год, а у нас не было ни одной задачи: «дан исполнитель, что он
     сделает» и «сколько получится вариантов». */
  { id:"exec",   em:"🤖", title:"Исполнители",
    why:"Дана машина с одним правилом — что она выдаст. Такие задания решают не формулой, а выполнением, и программа тут честнее головы." },
  /* Две группы, заведённые 08.09.2026 под пустые строки карты ЕГЭ. ⚠️ Обе —
     про задания, которые на экзамене принято решать электронной таблицей.
     Мы решаем их программой: меняется не задание, а форма подачи данных —
     вместо файла таблицы те же числа приходят строками на вход. Разбор —
     в шапке js/algo-ege.js. */
  /* Ещё две группы, 08.09.2026, по тому же правилу: граница проходит не по
     ИНСТРУМЕНТУ, а по ПРОДУКТУ РАБОТЫ. Ctrl+F и файловый менеджер — привычка,
     а не требование: ответ там всё равно значение, и его считает программа.
     Разбор — в шапке js/algo-oge.js. */
  { id:"text",   em:"🔤", title:"Поиск в тексте",
    why:"Сколько раз встретилось слово и какое из них самое длинное. То, что на экзамене ищут через Ctrl+F, программа считает точнее и не сбивается на сотой строке." },
  { id:"files",  em:"🗂", title:"Файлы и каталоги",
    why:"Маска со звёздочкой и вопросом, вес папки со всем вложенным. Дерево приходит текстом, а разбирает его программа." },
  { id:"data",   em:"📊", title:"Таблицы и базы данных",
    why:"Выборка по условию, сортировка сразу по двум столбцам и обработка столбца чисел — то, что на экзамене делают в таблице, а здесь делает программа." },
  { id:"net",    em:"🌐", title:"Адреса и сети",
    why:"IP-адрес, маска и адрес сети. Формулы тут не заучиваются: маска собирается битами, и видно, откуда берётся «минус два»." },
  { id:"rec",    em:"🌳", title:"Рекурсия и перебор",
    why:"Функция, зовущая саму себя, счёт вариантов без перебора и выигрышная стратегия. Общее у них одно: ответ собирается из ответов на задачи поменьше." }
];
function algoList(){ return (window.ALGO || []); }
function algoById(id){
  return algoList().filter(function(x){ return x.id === id; })[0] || null;
}
function algoDone(id){ return !!(S.algo && S.algo[id]); }
function algoMark(id){ S.algo = S.algo || {}; S.algo[id] = 1; save(); }

/* ---- откуда пришли в задачу ----
   Одна и та же задача открывается из двух мест: из списка тем и из пробного
   варианта. Экран у неё обязан быть один (два экрана — это две проверки и
   две подсказки, и однажды они разойдутся), а дорога назад разная: из
   варианта надо вернуться в вариант, иначе ребёнок после каждой сданной
   задачи оказывается в общем списке и вариант теряет.

   ⚠️ Ставится ТОЛЬКО тем, кто ведёт в задачу, и снимается общим списком:
   screenAlgo() — это и есть «я пришёл не из варианта». Забытый контекст
   увёл бы обратно в вариант того, кто в него не заходил. */
var algoBack = null;
function setAlgoBack(ctx){ algoBack = ctx || null; }
/* Сколько НАШИХ задач закрывает перечисленные группы. Считается по живому
   списку, а не по записанному числу: иначе разойдётся в день наполнения. */
function algoCountIn(groups){
  return algoList().filter(function(x){ return groups.indexOf(x.group) >= 0; }).length;
}
function algoDoneIn(groups){
  return algoList().filter(function(x){
    return groups.indexOf(x.group) >= 0 && algoDone(x.id); }).length;
}
/* Первая НЕрешённая задача темы — чтобы кнопка «решать» вела к делу, а не
   к началу списка, где уже всё пройдено. */
function algoNextIn(groups){
  var xs = algoList().filter(function(x){ return groups.indexOf(x.group) >= 0; });
  var un = xs.filter(function(x){ return !algoDone(x.id); });
  return (un[0] || xs[0] || null);
}
/* ================= алгоритмы и формат ОГЭ: экраны =================
   ⚠️ Уехали в js/screens-algo.js — разрез архитектурного долга 17.09.2026.
   Замер и почему слой данных выше остался здесь — в шапке того файла.
   Робот, вариант и визуализатор объявлены НИЖЕ — едут обёртками (§ 4.40). */
var ALGO_SCREENS = KVSCREENS.algo({
  app: app, esc: esc, plural: plural, save: save, errHTML: errHTML,
  enterScreen: enterScreen, refreshTop: refreshTop, screenTrain: screenTrain,
  confetti: confetti, closeWin: closeWin, markActiveToday: markActiveToday,
  capHard: capHard, screenCapReached: screenCapReached,
  ALGO_GROUPS: ALGO_GROUPS, algoList: algoList, algoById: algoById,
  algoDone: algoDone, algoMark: algoMark, algoCountIn: algoCountIn,
  algoDoneIn: algoDoneIn, algoNextIn: algoNextIn, setAlgoBack: setAlgoBack,
  algoBack: function(){ return algoBack; },
  makeStudio: makeStudio, wireHint: wireHint, runHiddenTests: runHiddenTests,
  diffBlock: diffBlock, draftGet: draftGet, draftApply: draftApply,
  draftSchedule: draftSchedule, draftsAll: draftsAll, solved: solved,
  myWorksList: myWorksList, codeSkeleton: codeSkeleton, myPredSafe: myPredSafe,
  myPredRun: myPredRun, makePredictStudio: makePredictStudio,
  screenSandbox: screenSandbox,
  screenRobot: function(){ return screenRobot.apply(null, arguments); },
  variantOpenFor: function(){ return variantOpenFor.apply(null, arguments); },
  screenViz: function(){ return screenViz.apply(null, arguments); },
  S: function(){ return S; },
  session: function(){ return session; },
  newSession: function(v){ session = v; return v; }
});
var screenAlgo = ALGO_SCREENS.screenAlgo, openAlgo = ALGO_SCREENS.openAlgo,
    openExamMap = ALGO_SCREENS.openExamMap, openMyExam = ALGO_SCREENS.openMyExam,
    screenMyExam = ALGO_SCREENS.screenMyExam, myExamSources = ALGO_SCREENS.myExamSources,
    myExamMake = ALGO_SCREENS.myExamMake, myExamPick = ALGO_SCREENS.myExamPick,
    myExamHasSource = ALGO_SCREENS.myExamHasSource,
    MYEXAM_LO = ALGO_SCREENS.MYEXAM_LO, MYEXAM_HI = ALGO_SCREENS.MYEXAM_HI,
    MYEXAM_BOX = ALGO_SCREENS.MYEXAM_BOX;

/* ================= ДОМАШКА ОТ РЕПЕТИТОРА =================
   Первая механика, которую репетитор покупает сам по себе: между занятиями
   ребёнок делает работу, а движок её проверяет. Конкуренты (`cloudtext.ru`,
   `sokratai.ru`, `finch.study`) делают так, чтобы репетитору было УДОБНЕЕ
   проверять руками; наше обещание другое — проверять не надо.

   Почему домашкой нельзя назначить пройденный урок: решение у ребёнка уже
   написано, и «сделать» его — значит открыть свой же ответ. Поэтому материал
   домашки — задачи-близнецы (js/homework.js): то же умение, другое условие,
   другие числа, а правильный ответ считает движок из эталонной программы.

   Как это едет. Репетитор выдаёт домашку со своего устройства (kidSaveHW),
   она ложится в запись ребёнка на сервере в поле `hw` и догоняет его при
   следующем обмене — тем же путём, что расписание. Нового на сервере не
   потребовалось.

   ⚠️ Пять правил, и каждое из устройства продукта:
     1. звёзд и опыта домашка не даёт — иначе взрослый начнёт двигать прогресс
        ребёнка из лучших побуждений (то же правило, что у задания взрослого);
     2. задача не открывается раньше своего урока: дать непройденное значит
        отправить ребёнка к тому, чего ему не объясняли, — и это наша вина;
     3. просрочка ничем не наказывается и ничего не сжигает. Сделанное поздно
        лучше несделанного, а «сгорело» — это ровно тот страх потери, которого
        в продукте быть не должно;
     4. семя задачи считается из кода ученика и даты, а не из random: у ребёнка
        на планшете и у репетитора в кабинете обязано выйти одно условие;
     5. больше HW_MAX задач за раз не выдаётся. Домашка на десять задач — это
        не усердие, а способ бросить всё в среду.
   ============================================================ */
var HW_MAX = 3;              /* сколько задач в одной выдаче */

function hwBank(){ return window.HOMEWORK || []; }
function hwById(id){ return (window.HW && HW.byId(id)) || null; }
function hwAll(){ S.hw = S.hw || {}; return S.hw; }
function hwKey(id, seed){ return id + "#" + seed; }
function hwRunner(code){ return Runtime.get("mini").run(code, { stdin: [] }); }

/* Семя задачи: разное у разных детей и разных выдач, одинаковое у ребёнка и
   у репетитора. Считается из кода ученика, id задачи и дня выдачи. */
function hwSeed(code, id, dayk){
  return HW.hash(String(code || "kid") + "|" + id + "|" + String(dayk || dayKey())) % 100000;
}

/* Записи домашки из ЛЮБОГО снимка прогресса — это нужно и панели репетитора,
   и карточке ученика, где смотрят чужие данные. */
function hwRecords(st){
  var d = (st && st.hw) || {};
  return Object.keys(d).map(function(k){
    var r = d[k] || {};
    return { key:k, id:r.id, seed:r.seed, due:r.due || "", by:r.by || "",
             at:r.at || 0, done:r.done || 0, tries:r.tries || 0 };
  }).filter(function(r){ return r.id && hwById(r.id); })
    .sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
}
function hwMine(){ return hwRecords(S); }
function hwPending(){ return hwMine().filter(function(r){ return !r.done; }); }
function hwDoneRecs(){ return hwMine().filter(function(r){ return !!r.done; }); }

/* Дней до срока: 0 — сегодня, отрицательное — срок прошёл. */
function hwDaysLeft(r){
  if (!r || !r.due) return null;
  return Math.round((new Date(r.due + "T12:00:00") - new Date(dayKey() + "T12:00:00")) / 864e5);
}
/* Срок словами. ⚠️ Про просрочку говорим фактом и без укора: «срок был вчера»,
   а не «ты не сделал вовремя». Домашка от этого не сгорает. */
function hwDueText(r){
  var n = hwDaysLeft(r);
  if (n === null) return "без срока";
  if (n === 0) return "на сегодня";
  if (n === 1) return "на завтра";
  if (n > 1) return "осталось " + n + " " + plural(n, "день", "дня", "дней");
  var back = -n;
  return "срок был " + (back === 1 ? "вчера" : back + " " + plural(back, "день", "дня", "дней") + " назад");
}
/* Собрать задание целиком: условие с числами и ответ, посчитанный движком. */
function hwBuild(r){
  var item = hwById(r.id);
  if (!item) return null;
  var built = HW.build(item, r.seed, hwRunner);
  if (!built || built.error) return null;
  built.key = r.key; built.due = r.due; built.by = r.by;
  built.done = r.done; built.tries = r.tries;
  return built;
}
function hwMark(key, tries){
  var d = hwAll();
  if (!d[key]) return;
  if (!d[key].done) d[key].done = Date.now();
  d[key].tries = Math.max(d[key].tries || 0, tries || 0);
  save();
}
/* Какие задачи вообще можно дать этому ученику: только те, чей урок он прошёл. */
function hwAvailableFor(st){
  var stars = (st && st.stars) || {};
  return HW.available(Object.keys(stars));
}

/* ===== экраны домашки у ребёнка =====
   ⚠️ Переехали в js/screens-hw.js (1.146.0), вторая половина пункта D.13.
   Слой данных домашки — выше, он общий с кабинетом репетитора и группой.
   Все имена ниже — объявления function (подняты) или присвоены выше по
   файлу, поэтому идут значениями. ⚠️ А вот в договор ГЛАВНОГО (HOME,
   выше по файлу) screenHW отдан обёрткой: на той строке его ещё нет. */
var HW_SCREENS = KVSCREENS.hw({
  app: app, capHard: capHard, closeWin: closeWin, codeHas: codeHas, confetti: confetti,
  diffBlock: diffBlock, draftApply: draftApply, draftGet: draftGet,
  draftSchedule: draftSchedule, enterScreen: enterScreen, errHTML: errHTML, esc: esc,
  goHome: goHome, hwBuild: hwBuild, hwDaysLeft: hwDaysLeft, hwDoneRecs: hwDoneRecs,
  hwDueText: hwDueText, hwMark: hwMark, hwMine: hwMine, hwPending: hwPending,
  hwRunner: hwRunner, makeStudio: makeStudio, markActiveToday: markActiveToday, plural: plural,
  refreshTop: refreshTop, save: save, screenCapReached: screenCapReached,
  /* ⚠️ Обёрткой — модуль визуализатора ниже по файлу (§ 4.40). */
  screenViz: function(o){ screenViz(o); },
  wireHint: wireHint,
  session: function(){ return session; },
  newSession: function(v){ session = v; return v; }
});
var screenHW = HW_SCREENS.screenHW, openHW = HW_SCREENS.openHW;

/* ================= раздел «Ты и ИИ»: экраны =================
   ⚠️ Переехали в js/screens-ailab.js (1.145.0), пункт D.13 архитектурного
   долга. Здесь осталась только сборка объекта A — это и есть весь список
   того, чем раздел связан с остальным продуктом, и он нарочно на виду.
   Все имена ниже — объявления function, они подняты и к этой строке уже
   есть, поэтому идут значениями; makeStudio присвоен выше по файлу.
   ============================================================ */
var AI_SCREENS = KVSCREENS.ailab({
  ailabDone: ailabDone, ailabList: ailabList, app: app, capHard: capHard, closeWin: closeWin,
  codeHas: codeHas, confetti: confetti, diffBlock: diffBlock, editUnits: editUnits,
  enterScreen: enterScreen, errHTML: errHTML, esc: esc, goHome: goHome, hl: hl,
  makePredictStudio: makePredictStudio, makeStudio: makeStudio,
  /* ⚠️ Обёртками: экраны проекта — модуль ниже по файлу (§ 4.40). */
  markActiveToday: markActiveToday, normPred: normPred,
  openProject: function(id, st){ openProject(id, st); },
  predictDiff: predictDiff, projectDone: projectDone, projectOfWorld: projectOfWorld,
  projectOpen: projectOpen, projectState: projectState, refreshTop: refreshTop, save: save,
  screenCapReached: screenCapReached,
  screenProjectDone: function(id){ screenProjectDone(id); },
  /* ⚠️ Обёртками: приёмка — модуль ниже по файлу (§ 4.40). */
  screenSpecs: function(){ screenSpecs(); },
  specDone: function(id){ return specDone(id); },
  specsList: function(){ return specsList(); }, wireHint: wireHint,
  ailabMark: ailabMark,
  session: function(){ return session; },
  newSession: function(v){ session = v; return v; }
});
var AI_STAGES = AI_SCREENS.AI_STAGES,
    aiStageOf = AI_SCREENS.aiStageOf,
    screenAILab = AI_SCREENS.screenAILab,
    openAILesson = AI_SCREENS.openAILesson,
    reviewTruth = AI_SCREENS.reviewTruth,
    catchProbe = AI_SCREENS.catchProbe,
    catchRun = AI_SCREENS.catchRun,
    catchStart = AI_SCREENS.catchStart;

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
  /* даты сдачи шагов и запись работы по шагам — для пакета к защите (1.142.0) */
  if (!Array.isArray(st.stepsAt)) st.stepsAt = [];
  if (!Array.isArray(st.tr)) st.tr = [];
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
  /* игра-проект открывается собранным проектом мира: финал мира открывает
     следующую игру (план, п. 4.5). Конечный список, а не лента. */
  if (p.needs) return projectDone(p.needs);
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

/* ================= экраны проекта =================
   ⚠️ Уехали в js/screens-project.js — разрез архитектурного долга
   18.09.2026. Замер и почему слой данных выше остался здесь — в шапке того
   файла. Портфолио, «Моё», защита и песочница объявлены НИЖЕ — обёртками
   (§ 4.40). */
var PROJECT_SCREENS = KVSCREENS.project({
  app: app, esc: esc, save: save, errHTML: errHTML, diffBlock: diffBlock,
  enterScreen: enterScreen, refreshTop: refreshTop, setRoute: setRoute,
  claimScreen: claimScreen, screenStale: screenStale, worldContent: worldContent,
  screenWorlds: screenWorlds, screenWorld: screenWorld, screenWorldDone: screenWorldDone,
  worldGraduated: worldGraduated, award: award, markActiveToday: markActiveToday,
  confetti: confetti, closeWin: closeWin, codeHas: codeHas, myName: myName,
  makeStudio: makeStudio, wireHint: wireHint,
  draftGet: draftGet, draftApply: draftApply, draftDrop: draftDrop, draftSchedule: draftSchedule,
  projectById: projectById, projectState: projectState, projectOpen: projectOpen,
  projectDraftId: projectDraftId, projectStartCode: projectStartCode,
  screenAILab: function(){ screenAILab(); },
  screenSandbox: function(){ screenSandbox(); },
  screenFolio: function(){ screenFolio(); },
  screenDefense: function(k){ screenDefense(k); },
  playLink: function(w){ return playLink(w); },
  copyText: function(t, b){ return copyText(t, b); },
  S: function(){ return S; },
  session: function(){ return session; },
  newSession: function(v){ session = v; return v; }
});
var openProject = PROJECT_SCREENS.openProject,
    screenProjectDone = PROJECT_SCREENS.screenProjectDone;

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
  var head = "# «" + String(title || "программа") + "» — программа из Фионики.\n" +
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
function downloadText(name, text, btn, mime){
  var done = function(){
    if (!btn) return;
    var t = btn.textContent;
    btn.textContent = "Скачано ✓";
    setTimeout(function(){ btn.textContent = t; }, 1500);
  };
  var a = document.createElement("a");
  a.download = name;
  try {
    var url = URL.createObjectURL(new Blob([text], { type:(mime || "text/x-python") + ";charset=utf-8" }));
    a.href = url;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ try { URL.revokeObjectURL(url); } catch(e){} }, 2000);
    done();
    return true;
  } catch(e){}
  try {
    a.href = "data:" + (mime || "text/x-python") + ";charset=utf-8," + encodeURIComponent(text);
    document.body.appendChild(a); a.click(); a.remove();
    done();
    return true;
  } catch(e2){}
  return false;
}

/* ================= сертификаты =================
   ⚠️ Уехали в js/certs.js — разрез 15.09.2026 вместе с экраном портфолио,
   но своим файлом (почему — в шапке js/certs.js). fmtDay остался здесь: это
   общий формат даты, им пользуется и пакет к защите. */
function fmtDay(ts){
  if (!ts) return "—";
  var d = new Date(ts), p = function(x){ return (x < 10 ? "0" : "") + x; };
  return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear();
}

var CERTS = KVSCREENS.certs({
  esc: esc, plural: plural, save: save, myName: myName, fmtDay: fmtDay,
  solved: solved, starsOf: starsOf,
  projectOfWorld: projectOfWorld, projectDone: projectDone, projectState: projectState,
  warmupsList: warmupsList, warmupDone: warmupDone, ailabList: ailabList, ailabDone: ailabDone,
  algoDone: algoDone,
  S: function(){ return S; }
});
var certList = CERTS.certList, certWorldReady = CERTS.certWorldReady,
    openCert = CERTS.openCert, closeCert = CERTS.closeCert, certIsOpen = CERTS.certIsOpen,
    SECTION_CERTS = CERTS.SECTION_CERTS, certBodyHTML = CERTS.certBodyHTML,
    certCourseAt = CERTS.certCourseAt, certCourseNeed = CERTS.certCourseNeed,
    certCourseReady = CERTS.certCourseReady, certSectionAt = CERTS.certSectionAt,
    certSectionNeed = CERTS.certSectionNeed, certSectionReady = CERTS.certSectionReady,
    certWorldAt = CERTS.certWorldAt, certWorldNeed = CERTS.certWorldNeed,
    worldSolvedCount = CERTS.worldSolvedCount, worldStars = CERTS.worldStars,
    worldWhole = CERTS.worldWhole;


/* ================= карточка доступа =================
   ⚠️ Зачем она есть. Аккаунта в продукте нет — есть код ученика, и
   восстановить его нечем: ни почты, ни телефона мы не спрашиваем, и это
   обещание на вывеске. Значит, единственная защита от «потерял код — потерял
   прогресс» — сделать так, чтобы код УШЁЛ ИЗ БРАУЗЕРА: на бумагу, в дневник,
   в заметки родителя. Восстановления нет и не будет, а вот потери можно
   сделать редкими, и это честная работа, а не полумера.

   Лист печатается тем же оверлеем, что и сертификаты: печать берёт документ
   целиком, а в @media print всё, кроме листа, скрыто. Своего экспорта не
   делаем — штатный «Сохранить в PDF» лучше любого нашего.

   ⚠️ Карточку печатает и репетитор — своему ученику, поэтому имя и код
   приходят ДОВОДАМИ, а не берутся из S. Функция, которая лезет в своё
   состояние, для чужого ученика не годится (правило оплачено 08.09.2026). */
function accessLink(code){
  try { return location.origin + location.pathname + "?kid=" + encodeURIComponent(code); }
  catch(e){ return "?kid=" + code; }
}
function accessCardHTML(code, name){
  return '<div class="certsheet">' +
    '<div class="certmark">🐍 Фионика</div>' +
    '<div class="certkind">Карточка доступа</div>' +
    '<div class="certname">' + esc(name || "Ученик Фионики") + '</div>' +
    '<div class="certrule"></div>' +
    '<div class="certwhat">Код ученика — это весь вход. По нему занятия открываются ' +
      'на любом устройстве, и по нему же взрослый видит, как идут дела.' +
      '<span class="certcode">' + esc(code) + '</span>' +
      '<span class="certlist">Ссылка-вход: ' + esc(accessLink(code)) + '</span></div>' +
    '<div class="certnote">Положи этот листок туда, где не потеряется: в дневник, ' +
      'в папку с документами, сфотографируй родителю. ' +
      '⚠️ Кода не восстановить: ни почты, ни телефона тренажёр не спрашивает, ' +
      'и найти твой прогресс без кода нечем. И наоборот: кто знает код, тот видит ' +
      'занятия — чужим его показывать не надо.</div>' +
    '<div class="certfoot"><span>Выдана ' + fmtDay(Date.now()) + '</span>' +
    '<span>Python с нуля · без установки · в браузере</span></div>' +
  '</div>';
}
function openAccessCard(code, name){
  var el = document.getElementById("cert"), box = document.getElementById("certbox");
  if (!el || !box || !code) return;
  box.innerHTML = accessCardHTML(code, name);
  el.hidden = false;
}

/* где живёт проект: у пяти это мир, у «Напарника» — раздел «Ты и ИИ».
   Подпись и фраза про замок разные: «Мир 2» в подпись годится, а во фразу
   «откроется, когда будет пройден …» с разделом получалось косноязычие. */
function projectWhere(p){ return p.world === 0 ? "Ты и ИИ" : "Мир " + p.world; }

/* ================= экран: портфолио =================
   ⚠️ Уехал в js/screens-folio.js — разрез 15.09.2026. Это перекрёсток, как
   Главное: 44 имени внутрь, почему — в шапке того файла. Обёртками — то, что
   присваивается ниже по файлу: мастерская, пакет к защите. */
var FOLIO = KVSCREENS.folio({
  app: app, esc: esc, plural: plural, fmtDay: fmtDay, myName: myName,
  enterScreen: enterScreen, refreshTop: refreshTop, goHome: goHome,
  totalStars: totalStars, certList: certList, openCert: openCert,
  projectsList: projectsList, projectById: projectById, projectDone: projectDone,
  projectOpen: projectOpen, projectState: projectState, projectWhere: projectWhere,
  openProject: openProject, screenProjectDone: screenProjectDone,
  myWorksList: myWorksList, myWorkById: myWorkById, myWorkLink: myWorkLink, myWorkDrop: myWorkDrop,
  galleryList: galleryList, galleryAll: galleryAll, galleryDrawing: galleryDrawing,
  galleryDrop: galleryDrop, drawTurtle: drawTurtle,
  myTasksList: myTasksList, myTasksAll: myTasksAll, taskLink: taskLink,
  /* ⚠️ Обёртками: «Своё задание» — модуль ниже по файлу (§ 4.40). */
  openFriendTask: function(t, o){ openFriendTask(t, o); }, screenMyTasks: function(e){ screenMyTasks(e); },
  downloadDataURL: downloadDataURL, downloadText: downloadText,
  pyFileName: pyFileName, pyFileText: pyFileText, copyText: copyText,
  screenSandbox: screenSandbox,
  /* слот песочницы пишет не портфолио, а этот вход (§ 4.5) */
  openInSandbox: function(code){ S.sandbox = code; save(); screenSandbox(); },
  partsList: function(){ return partsList(); }, buildsList: function(){ return buildsList(); },
  screenShop: function(){ screenShop(); },
  screenDefense: function(id){ screenDefense(id); },
  S: function(){ return S; },
  newSession: function(v){ session = v; return v; }
});
var screenFolio = FOLIO.screenFolio;


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
      '<div class="card"><h3>Что сегодня в занятии</h3>' + listHTML +
        (zanAfterPause() ? '<p class="dim">👋 Сегодня занятие короче обычного: ты возвращаешься ' +
          'после перерыва, и вход идёт со знакомого. Полный план вернётся, как только занятия ' +
          'пойдут подряд.</p>' : '') + '</div>' +
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

  app.innerHTML = head + capNote + breakNote + cutNote + plan + tail + breakBtn + liveRowHTML();
  bindLiveRow(screenZan);

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
/* ===== в следующий раз =====
   Сессия имеет начало и конец — это красная линия продукта. Но «конец» не
   значит «обрыв»: занятие закончилось, а СЛЕДУЮЩЕЕ — названо: какой урок и
   в какой день. Это не «ещё чуть-чуть» (ничего нельзя продолжить сейчас),
   это причина вернуться завтра. */
function nextZanDayKey(){
  for (var i = 1; i <= 14; i++){
    var k = shiftDay(dayKey(), i);
    if (agreedStudyDay(k)) return k;
  }
  return "";
}
var WD_FULL = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
function nextTimeHTML(){
  var next = nextLesson();
  var when = nextZanDayKey();
  if (!next && !when) return "";
  var h = '<div class="card nexttime"><h3>👋 В следующий раз</h3>';
  if (next)
    h += '<p>Дальше по курсу — <b>урок ' + next.num + ' «' + esc(next.title) + '»</b>: ' +
      esc(next.sub) + '.</p>';
  else
    h += '<p>Все готовые уроки пройдены — дальше повторение и проекты.</p>';
  if (when){
    var d = new Date(when + "T12:00:00");
    h += '<p class="dim">Следующее занятие по расписанию — ' + WD_FULL[d.getDay()] + ', ' +
      (d.getDate() < 10 ? "0" : "") + d.getDate() + "." +
      (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1) +
      (frameTime() ? ', в ' + esc(frameTime()) : "") + '.</p>';
  }
  return h + '</div>';
}

/* ===== до конца мира — в занятиях =====
   Проценты ребёнок не чувствует, дни — не контролирует. Занятие — единица,
   которую он проживает, поэтому расстояние до проекта мира меряется в них.
   Темп берётся его собственный (frame.perLesson, если взрослый принял замер). */
function worldCountdown(n){
  var w = CURRICULUM.world(n);
  if (!w) return null;
  var left = 0;
  w.lessons.forEach(function(l){ if (!solved(l.id)) left++; });
  if (!left || left === w.lessons.length) return null;   /* не начат или закончен */
  var zan = Math.max(1, Math.ceil(left / zanSlotsFor(frame().len || 30)));
  return { left: left, zan: zan };
}

/* ===== возвращение после паузы =====
   Ребёнку, который пропустил несколько дней, страшнее всего первый экран:
   вдруг всё сгорело и придётся оправдываться. Поэтому после паузы Главное
   встречает отдельной карточкой: всё на месте, вот где ты остановился, вот
   лёгкий вход. ⚠️ Ни слова упрёка и ни одной цифры пропуска на видном месте:
   виноватый не возвращается. Карточка исчезает сама, как только сегодня
   что-то сделано, — состояния у неё нет. */
var PAUSE_DAYS = 4;
function daysSincePause(){
  var last = "";
  Object.keys(coveredNow()).forEach(function(k){ if (k > last) last = k; });
  if (!last) return null;                       /* ещё не занимался вовсе */
  if (activeOn(dayKey())) return 0;             /* сегодня уже был — не пауза */
  return Math.round((new Date(dayKey() + "T12:00:00") - new Date(last + "T12:00:00")) / 864e5);
}
function welcomeBackHTML(){
  var gap = daysSincePause();
  if (gap === null || gap < PAUSE_DAYS) return "";
  var next = nextLesson();
  return '<div class="card comeback"><h3>👋 С возвращением</h3>' +
    '<p>Всё на месте: прогресс цел, звёзды целы, уроки открыты те же' +
    (next ? ' — ты остановился перед уроком ' + next.num + ' «' + esc(next.title) + '»' : '') + '.</p>' +
    '<p class="dim">После паузы легче входить с малого: одна разминка на пару минут — и рука вспомнит сама.</p>' +
    '<div class="admrow">' +
      '<button class="rbtn check" id="cbwarm">🎲 Начать с разминки</button>' +
      (next ? '<button class="rbtn sec" id="cbgo">▶ Сразу к уроку</button>' : '') +
    '</div></div>';
}

/* Итог занятия. Показывается и когда всё сделано, и когда закончили руками —
   разница только в словах. Занятие, брошенное на первом уроке, тоже
   закрывается: иначе ребёнок, у которого не пошло, остаётся без финала, а
   взрослый — без отчёта ровно в тот день, когда отчёт нужнее всего. */
function screenZanDone(rec){
  enterScreen(undefined, "zan");
  /* занятие закончилось — трансляция гаснет сама: обещание «выключается по
     концу занятия» держит код, а не память ребёнка */
  liveOffNow();
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
    nextTimeHTML() +
    '<div class="winrow"><button class="bigbtn" id="ztoday">← На «Сегодня»</button>' +
      '<button class="bigbtn ghost" id="zmap">К урокам</button></div>';
  document.getElementById("ztoday").onclick = screenToday;
  document.getElementById("zmap").onclick = goHome;
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
   ⚠️ Уехала в js/screens-specs.js — разрез архитектурного долга 18.09.2026.
   Замер и почему судья уехал вместе с экраном — в шапке того файла. */
var SPECS_SCREENS = KVSCREENS.specs({
  app: app, esc: esc, plural: plural, hl: hl, KIND_RU: KIND_RU, save: save,
  enterScreen: enterScreen, refreshTop: refreshTop, wireHint: wireHint,
  markActiveToday: markActiveToday, confetti: confetti, closeWin: closeWin,
  screenAILab: function(){ screenAILab(); },
  S: function(){ return S; },
  session: function(){ return session; },
  newSession: function(v){ session = v; return v; }
});
var screenSpecs = SPECS_SCREENS.screenSpecs, specsList = SPECS_SCREENS.specsList,
    specDone = SPECS_SCREENS.specDone, openSpec = SPECS_SCREENS.openSpec,
    specParse = SPECS_SCREENS.specParse, specToPython = SPECS_SCREENS.specToPython,
    specRunAll = SPECS_SCREENS.specRunAll, specVerdict = SPECS_SCREENS.specVerdict,
    specSplitArgs = SPECS_SCREENS.specSplitArgs, specTaskById = SPECS_SCREENS.specTaskById,
    SPEC_KINDS = SPECS_SCREENS.SPEC_KINDS;

/* ================= витрина: что создают ученики =================
   ⚠️ Экран переехал в js/screens-showcase.js — первый шаг по архитектурному
   долгу (разбор docs/arhitektura-2026-09-08.md § 4). Договор между файлами
   и почему витрина взята первой — в шапке того файла. Здесь остаётся только
   сборка объекта A: это и есть список всего, чем экран связан с остальным
   продуктом, и он нарочно стоит на виду, а не спрятан в общий контейнер.
   ⚠️ Функции ниже объявлены через var, а не function: значит до этой строки
   их звать нельзя. Все нынешние места вызова — обработчики и таблица маршрутов,
   они срабатывают позже. ============================================ */
/* Робот отрезан сразу в свой файл (js/screens-robot.js), а не дописан сюда:
   это первая возможность НЕ увеличивать архитектурный долг, вместо того чтобы
   разбирать его потом. Договор — в шапке js/screens-showcase.js. */
var ROBOTS = KVSCREENS.robot({
  app: app, esc: esc, enterScreen: enterScreen, refreshTop: refreshTop,
  algoDone: algoDone, algoMark: algoMark, screenTrain: screenTrain
});
var screenRobot = ROBOTS.screenRobot, openRobot = ROBOTS.openRobot;

/* Раздел «HTML и CSS» (1.141.0) — тоже сразу своим файлом, по образцу Робота:
   экраны в js/screens-web.js, судья в js/web.js, задания в js/web-tasks.js. */
var WEBS = KVSCREENS.web({
  app: app, esc: esc, plural: plural, enterScreen: enterScreen, refreshTop: refreshTop,
  algoDone: algoDone, algoMark: algoMark, screenTrain: screenTrain,
  pageDoc: pageDoc, pageFrameWire: pageFrameWire
});
var screenWeb = WEBS.screenWeb, openWeb = WEBS.openWeb;

/* Пакет к защите проекта (1.142.0) — своим файлом, js/screens-defense.js.
   ⚠️ storyOf и экраны — обёртками: storyOf присваивается НИЖЕ по файлу
   (пересказ — свой модуль), и на этой строке он ещё undefined. */
var DEFENSE = KVSCREENS.defense({
  app: app, esc: esc, plural: plural, fmtDay: fmtDay, enterScreen: enterScreen, setRoute: setRoute,
  refreshTop: refreshTop, save: save, myName: myName,
  projectById: projectById, projectState: projectState, projectDone: projectDone,
  projectWhere: projectWhere, codeSkeleton: function(c){ return codeSkeleton(c); },
  storyOf: function(c, e){ return storyOf(c, e); },
  openProject: function(id){ openProject(id); },
  screenProjectDone: function(id){ screenProjectDone(id); },
  screenFolio: function(){ screenFolio(); },
  S: function(){ return S; }
});
var screenDefense = DEFENSE.screenDefense;

var SHOWCASE = KVSCREENS.showcase({
  app: app,
  clearSession: function(){ session = { id:null, attempts:0, hints:0, shown:false }; },
  enterScreen: enterScreen, refreshTop: refreshTop, esc: esc, plural: plural,
  /* ⚠️ Обёрткой: мастерская — модуль ниже по файлу (§ 4.40). */
  buildsList: function(){ return buildsList(); }, galleryList: galleryList, gamesList: gamesList,
  myTasksList: myTasksList, solvedCount: solvedCount, drawTurtle: drawTurtle,
  lessonBody: lessonBody, worldContent: worldContent,
  projectsList: projectsList, projectDone: projectDone,
  openGame: openGame, goHome: goHome, screenFolio: screenFolio,
  screenProjectDone: screenProjectDone, screenStale: screenStale
});
var SHOW_LINES = SHOWCASE.SHOW_LINES,
    showcaseRun = SHOWCASE.showcaseRun,
    showcaseProjects = SHOWCASE.showcaseProjects,
    showcaseAfter = SHOWCASE.showcaseAfter,
    screenShowcase = SHOWCASE.screenShowcase;

/* ================= пробный вариант экзамена =================
   Отрезан сразу в свой файл (js/variant.js) — как Робот, и по той же причине:
   новый экран в app.js увеличивал бы долг, который мы весь день разбирали.
   Зачем вариант вообще нужен и почему в нём нет баллов — в шапке того файла.
   ⚠️ Вариант ХРАНИТ своё состояние (какие номера закрыты), поэтому наружу
   отсюда идут не переменные, а две двери: variantGet читает, variantSet
   пишет и сохраняет. Копия ссылки на S.variant однажды начала бы читать
   позапрошлый вариант — правило оплачено ошибкой 08.09.2026. */
var VARIANT = KVSCREENS.variant({
  app: app, esc: esc, plural: plural, qm: qm,
  enterScreen: enterScreen, refreshTop: refreshTop,
  algoList: algoList, algoById: algoById,
  /* ⚠️ algoMark отдан варианту ради одного места: экзамен переносит решённое в
     общий список НЕ по ходу дела, а разом при закрытии (js/variant.js,
     closeExam). Во время экзамена галочка «решено» на экране «Алгоритмы» —
     это вердикт, о котором режим экзамена молчит. */
  algoMark: algoMark,
  openAlgo: function(id){ openAlgo(id); }, setAlgoBack: setAlgoBack,
  /* Задание 15 ОГЭ — Робот (1.163.0): свой экран, тот же договор контекста. */
  openRobot: function(id, ctx){ openRobot(id, ctx); }, robotById: ROBOTS.robotById,
  screenTrain: function(){ screenTrain(); },
  variantGet: function(){ return S.variant || {}; },
  variantSet: function(v){ S.variant = v || {}; save(); },
  /* ⚠️ Только чтение: назначение пишет РЕПЕТИТОР в запись ученика на сервере,
     а не ребёнок у себя. Дай сюда запись — и первая же ошибка сотрёт ученику
     то, что ему задали, ровно перед занятием. */
  vtaskGet: function(){ return S.vtask || {}; },
  /* Срок словами — тот же, что у домашки: «на завтра», «срок был вчера».
     ⚠️ Своего перевода даты здесь не заводим: два перевода одной и той же
     даты однажды разойдутся, и ребёнок увидит на двух экранах разные сроки. */
  dueText: function(due){ return hwDueText({ due: due }); }
});
var screenVariant = VARIANT.screenVariant,
    screenVariantDone = VARIANT.screenVariantDone,
    variantOpenFor = VARIANT.variantOpenFor,
    variantStat = VARIANT.variantStat;

/* ================= проверка «что умеет сам» =================
   Своим файлом (js/proverka.js) — зачем она и почему итог живёт в коде, а не
   на сервере, в шапке того файла. Состояние — одна дверь на чтение и одна на
   запись, по правилу варианта выше. copyText и screenWorld — обёртками:
   первый приходит из модуля профиля, и на этой строке его может ещё не быть. */
var PROVERKA = KVSCREENS.proverka({
  app: app, esc: esc, plural: plural, qm: qm,
  enterScreen: enterScreen, setRoute: setRoute, refreshTop: refreshTop,
  makeStudio: makeStudio, codeHas: codeHas, errHTML: errHTML, hwRunner: hwRunner,
  draftGet: draftGet, draftApply: draftApply, draftSchedule: draftSchedule,
  markActiveToday: markActiveToday,
  /* ⚠️ Вызовом: AUTHOR_PASTE_MIN объявлен НИЖЕ по файлу, и значением сюда
     приехал бы undefined — а «120 >= undefined» ложно, то есть любой
     вставленный код молча считался бы набранным. Поймано тестом [проверка]. */
  pasteMin: function(){ return AUTHOR_PASTE_MIN; },
  copyText: function(t, btn){ return copyText(t, btn); },
  screenWorld: function(n){ screenWorld(n); },
  screenTrain: function(){ screenTrain(); },
  proverkaGet: function(){ return S.proverka || {}; },
  proverkaSet: function(v){ S.proverka = v || {}; save(); },
  /* Проверка 2 (лестница «экзамен и HTML», 15.09.2026): свой слот состояния
     и свои судьи. runMini — прогон со stdin (задачи экзамена сверяются с
     эталоном на вводе и скрытых наборах); pageDoc и pageFrameWire — тот же
     замок окна «Страница», что у студии и раздела HTML (§ 4.18: замок один);
     webKeybar* — панель символов раздела HTML, одним источником оттуда же. */
  proverka2Get: function(){ return S.proverka2 || {}; },
  proverka2Set: function(v){ S.proverka2 = v || {}; save(); },
  runMini: function(code, stdin){ return Runtime.get("mini").run(code, { stdin: stdin }); },
  pageDoc: pageDoc, pageFrameWire: pageFrameWire,
  webKeybarHTML: function(){ return WEBS.keybarHTML(); },
  webKeybarWire: function(root, ta){ return WEBS.keybarWire(root, ta); },
  screenWeb: function(){ screenWeb(); },
  screenAlgo: function(){ screenAlgo(); },
  session: function(){ return session; },
  newSession: function(v){ session = v; return v; }
});
var screenProverka = PROVERKA.screenProverka,
    proverkaStat = PROVERKA.proverkaStat;

/* ================= защита своего кода =================
   Своим файлом (js/screens-zashchita.js): зачем и почему это не
   «доказательство» — в шапке того файла. Состояния не пишет вовсе.
   Источники программ — те же, что у «Задачи по своей программе» (свои
   программы и черновики сданных уроков без открытого решения), плюс
   собранные проекты с ответами на input() из их последнего шага. */
function zqSources(){
  var out = myExamSources().map(function(x){
    var l = x.id ? CURRICULUM.byId(x.id) : null;
    var body = l ? (CONTENT["world" + l.world] || {})[l.id] : null;
    return { code: x.code, from: x.from, stdin: ((body && body.task && body.task.stdin) || []).slice() };
  });
  projectsList().forEach(function(p){
    if (!projectDone(p.id)) return;
    var last = p.steps[p.steps.length - 1];
    out.unshift({ code: projectState(p.id).code || last.solution, stdin: (last.stdin || []).slice(),
                  from: "твой проект «" + p.title + "»" });
  });
  return out;
}
var ZASH = KVSCREENS.zashchita({
  app: app, esc: esc, plural: plural, KIND_RU: KIND_RU,
  codeSkeleton: codeSkeleton, enterScreen: enterScreen, setRoute: setRoute, refreshTop: refreshTop,
  homeLabel: function(){ return homeLabel(); }, goHome: function(){ goHome(); },
  screenTrain: function(){ screenTrain(); }, sources: zqSources
});
var screenZashchita = ZASH.screenZashchita;
/* ================= мастерская: полка деталей и верстак =================
   ⚠️ Уехала в js/screens-shop.js — разрез 15.09.2026, вместе со своими
   данными: почему так, а не как у домашки, — в шапке того файла.
   screenViz и copyText — обёртками: первый присваивается ниже по файлу, второй
   приходит из модуля профиля. */
var SHOP = KVSCREENS.shop({
  app: app, esc: esc, hl: hl, save: save, enterScreen: enterScreen, refreshTop: refreshTop,
  goHome: goHome, fmtWhen: fmtWhen, makeStudio: makeStudio, draftSchedule: draftSchedule,
  codeSkeleton: codeSkeleton, galleryTitleOf: galleryTitleOf, workLink: workLink, myName: myName,
  copyText: function(t, btn){ return copyText(t, btn); },
  screenViz: function(o){ screenViz(o); },
  S: function(){ return S; },
  session: function(){ return session; },
  newSession: function(v){ session = v; return v; }
});
var screenShop = SHOP.screenShop, partsList = SHOP.partsList, buildsList = SHOP.buildsList,
    partsHarvest = SHOP.partsHarvest, partsFrom = SHOP.partsFrom, partAdd = SHOP.partAdd,
    partDrop = SHOP.partDrop, partWorks = SHOP.partWorks, buildSave = SHOP.buildSave,
    buildDrop = SHOP.buildDrop, PART_MAX = SHOP.PART_MAX, BUILD_MAX = SHOP.BUILD_MAX;

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
function authorMarks(id, st){
  var g = ((st || S).log || {})[id] || {}, t = g.tr;
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
function authorList(st){
  var out = [];
  Object.keys((st || S).log || {}).forEach(function(id){
    var l = CURRICULUM.byId(id);
    if (!l) return;
    var a = authorMarks(id, st);
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

function authorSummary(st){
  var list = authorList(st), hand = 0, ready = 0, ahead = 0;
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
  voiceStop(); claimScreen();
  if (!adminUnlocked()) return adminGate(screenTrace);
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
  app.querySelectorAll("[data-home]").forEach(function(b){ b.onclick = goHome; });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= кабинет взрослого =================
   Пока сайта и сервера нет, кабинет живёт на том же устройстве и открывается
   тем же кодом, что и панель репетитора. Это честная заглушка, а не
   архитектура: когда появятся домен и почта, кабинет переедет на отдельный
   поддомен со своим входом — граница между детским контуром (без ПДн) и
   взрослым (с адресом) должна проходить по домену.
   Разбор: docs/zanyatie-i-vzroslyj.md §§ 12–14. */

/* ---------- сводка кабинета: четыре числа и «Сейчас важно» ----------
   Что заимствовано и у кого — docs/kabinet-benchmark-2026-09-12.md:
   первый экран отвечает «что сейчас важно», а не «вот всё, что есть»
   (Khan Academy). Числа считаются из данных, руками не пишутся. */
function adultSummaryHTML(){
  var f = weekFacts(S);
  var lastT = 0, lg = S.log || {};
  Object.keys(lg).forEach(function(k){
    var t = (lg[k] || {}).last || 0;
    if (t > lastT) lastT = t;
  });
  var h = '<div class="admstats cabsum">' +
    statBox("Сегодня за тренажёром", fmtDur(dayMs(S, dayKey()))) +
    statBox("Уроков за неделю", String(f.weekSolved)) +
    statBox("Дней подряд", String(f.streak)) +
    statBox("Последнее занятие", fmtWhen(lastT)) +
    '</div>';
  /* Одна строка «что сейчас важно» — и только когда важное есть: затык
     стоит между ребёнком и всем курсом, взрослый обязан узнать о нём до
     выбора вкладки, а не внутри «Отчёта». */
  if (f.stuck.length){
    var sl = CURRICULUM.byId(f.stuck[0].id);
    h += '<p class="cabnow">⛔ Сейчас важно: ребёнок застрял на уроке «' +
      (sl ? esc(sl.title) : esc(f.stuck[0].id)) +
      '» — разбор и что делать на вкладке «Отчёт».</p>';
  }
  return h;
}
function screenAdult(){
  curPlace = "adult";
  stopTimer(); vizStopPlay();
  /* ⚠️ claimScreen обязателен и здесь. Экраны взрослого шли мимо enterScreen
     (ему нельзя чистить #admin из адреса), а вместе с ним мимо claimScreen —
     то есть НЕ увеличивали screenSeq. Урок и мир дорисовываются асинхронно,
     и запоздавшая отрисовка затирала уже показанный кабинет: завёл ребёнка,
     сразу пошёл в кабинет — и оказался на главном экране. Заодно здесь
     сохраняется черновик урока и замолкает чтение вслух. */
  voiceStop(); routeFor("adult"); claimScreen();
  if (!adminUnlocked()) return adminGate(screenAdult);
  var f = frame();
  var last = zanLast();

  var h = '<div class="lvlhead"><div><div class="idx">для взрослого</div>' +
    '<h1>👨‍👩‍👦 Кабинет</h1></div><div class="right"><span class="tag">код принят</span></div></div>' +
    '<p class="lede">Здесь взрослый ставит рамку занятий, видит, как шла работа, и задаёт ребёнку задание. ' +
    'Десять минут в неделю — и вы знаете о занятиях больше, чем даёт любой отчёт репетитора.</p>';

  /* Сводка — НАД вкладками, видна с любой: четыре числа отвечают на первый
     вопрос взрослого раньше, чем он выберет вкладку. Приём Khan Academy из
     замера конкурентов 12.09.2026 (docs/kabinet-benchmark-2026-09-12.md),
     поставлен в 1.148.0. Это не плитки-дубли 1.103.0: здесь числа, а не
     кнопки. Строка «Сейчас важно» — затык, с которого стоит начать. */
  h += adultSummaryHTML();

  /* ⚠️ ВКЛАДКИ, а не девять карточек подряд. Оплачено жалобой фаундера
     12.09.2026: «надо сделать человеческие личные кабинеты». Корень оказался
     не в словах, а в том, что ОДИН И ТОТ ЖЕ кабинет выглядел двумя разными
     экранами: карточка ученика и кабинет родителя давно на вкладках (см.
     KID_TABS, жалоба 08.09.2026), а этот, на устройстве ребёнка, остался
     простынёй из девяти карточек — четыре экрана прокрутки. Человек,
     видевший оба, не мог понять, один это кабинет или два разных.
     Вкладки те же и ведут себя так же: всё отрисовано сразу, вкладка только
     прячет чужое, поэтому переключение мгновенно и наполовину заполненные
     поля не пропадают. */
  var ut = ADULT_TABS.some(function(t){ return t[0] === adultTab; }) ? adultTab : "rep";
  h += '<div class="ltabs adnav" role="tablist">' + ADULT_TABS.map(function(t){
    return '<button class="ltab' + (t[0] === ut ? " on" : "") + '" role="tab" data-utab="' + t[0] + '"' +
      ' aria-selected="' + (t[0] === ut ? "true" : "false") + '">' +
      '<span class="lte">' + t[1] + '</span>' + t[2] + '</button>';
  }).join("") + '</div>';
  var pane = function(id, inner){
    return '<div class="kpane" data-upane="' + id + '"' + (ut === id ? "" : " hidden") + '>' +
      inner + '</div>';
  };
  var g1 = "", g2 = "", g3 = "", g4 = "";

  /* ---------- отчёт по последнему занятию ---------- */
  if (last){
    var r = zanReport(last, S);
    g1 += '<div class="card adrep"><h3>📨 Последнее занятие</h3>' +
      '<p class="dim">' + fmtWhen(last.end) + '</p>' +
      '<ol class="zanrep"><li><b>Что было.</b> ' + esc(r.was) + '.</li>' +
      '<li><b>Похвалите за это.</b> ' + esc(r.praise) + '.</li>' +
      (r.cut ? '<li><b>План.</b> ' + esc(r.cut) + '</li>' : '') +
      '<li><b>Понял или прошёл.</b> ' + esc(r.got) + '</li>' +
      '<li><b>Спросите.</b> ' + esc(r.ask) + '</li></ol></div>';
  } else {
    g1 += '<div class="card"><h3>📨 Последнее занятие</h3>' +
      '<p class="dim">Занятий ещё не было. Отчёт появится, как только ребёнок закончит первое.</p></div>';
  }

  g1 += weekReportHTML(S);
  g1 += heatHTML(S);
  g1 += paceStatHTML();
  g1 += PROVERKA.cardHTML(S);
  g1 += ZASH.cardHTML();

  g2 += frameEditorHTML(f);

  /* ---------- как шла работа (запись авторства) ---------- */
  g4 += authorCardHTML(S, true);

  /* ---------- чему он учится про ИИ ----------
     Взрослый платит за ИИ-курсы 8–71 тыс. ₽, и все они про «как попросить».
     Если не сказать про отличие прямо здесь, он и не узнает, что купил
     другое. */
  var aiAllN = ailabList().length;
  var aiDoneN = ailabList().filter(function(x){ return ailabDone(x.id); }).length;
  var spAllN = specsList().length;
  var spDoneN = specsList().filter(function(x){ return specDone(x.id); }).length;
  g4 += '<div class="card"><h3>🤖 Чему он учится про ИИ</h3>' +
    '<p>Курсы про нейросети учат <b>просить</b>. Здесь учат <b>принимать работу</b>: ' +
    'прочитать ответ машины, найти, где она уверенно врёт, написать проверку и вернуть на доработку. ' +
    'Судит движок, а не мнение, — поэтому себя тут не обманешь.</p>' +
    '<p class="dim">Пройдено заданий: <b>' + aiDoneN + '</b> из ' + aiAllN +
    (spAllN ? ' · работ принято: <b>' + spDoneN + '</b> из ' + spAllN : '') + '.</p>' +
    '<p class="dim">⚠️ Живого ИИ рядом с ребёнком нет и не будет: модель, которая пишет за него, ' +
    'несовместима с разделом, который учит её проверять.</p>' +
    '<div class="admrow"><button class="rbtn check" data-act="toai">Посмотреть раздел →</button></div></div>';

  /* ---------- витрина ----------
     Кабинет — единственное место продукта, куда взрослый заходит сам.
     Значит и страница «что тут вообще собирают» должна быть под рукой
     именно отсюда: её показывают не ребёнку, а тому, кто спрашивает,
     чему он здесь учится. */
  g4 += '<div class="card"><h3>🏗 Что создают ученики</h3>' +
    '<p>Страница с вещами, которые собираются на курсе: шесть программ, рисунки и игры. ' +
    'Всё запускается прямо там — это не картинки работ, а сами работы.</p>' +
    '<p class="dim">Чужих детей и имён на ней нет: мы имя ребёнка не спрашиваем вовсе, ' +
    'а публичную ленту работ пришлось бы кому-то проверять руками.</p>' +
    '<div class="admrow"><button class="rbtn check" data-act="toworks">Открыть витрину →</button></div></div>';

  /* ---------- задание ребёнку ---------- */
  g3 += adultTaskHTML();

  h += pane("rep", g1) + pane("frame", g2) + pane("task", g3) + pane("more", g4);

  h += '<div class="pager"><button class="bigbtn ghost" data-act="toadmin">Панель репетитора →</button>' +
    /* ⚠️ Эта кнопка ведёт на карту миров РЕБЁНКА (data-act="tomap" →
       screenWorlds), а не домой по роли. Значит и называться обязана так:
       «На главную» здесь означало бы кабинет, как везде после 12.09.2026, —
       и это была бы ровно та ложь, которую мы только что убрали (§ 4.21). */
    '<span class="sp"></span><button class="bigbtn ghost" data-act="tomap">← К урокам ребёнка</button></div>';

  app.innerHTML = h;
  wireAdult();
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* Карточка «Как шла работа» — одна на оба кабинета.
   ⚠️ До 12.09.2026 она жила прямо в screenAdult и потому была видна ТОЛЬКО
   тому, кто сидит за устройством ребёнка. Кнопку «Открыть запись» отдаём
   лишь своему состоянию: экран записи читает своё, и по чужому ученику
   открывать было бы нечего — обещать дверь, которой нет, хуже, чем не
   обещать (правило 35). */
function authorCardHTML(snap, canOpen){
  var asum = authorSummary(snap);
  return '<div class="card"><h3>🖐 Как шла работа</h3>' +
    (asum.n
      ? '<p>По ' + asum.n + ' ' + plural(asum.n, "уроку", "урокам", "урокам") + ' с записью: ' +
        'написано руками <b>' + asum.hand + '</b>' +
        (asum.ready ? ', часть работы пришла готовой в <b>' + asum.ready + '</b>' : '') +
        (asum.ahead ? ', непройденное в решении — в <b>' + asum.ahead + '</b>' : '') + '.</p>'
      : '<p class="dim">Записи пока нет: она ведётся с пройденных уроков. ' +
        'Уроки, сданные раньше, сюда не попадут — выдумывать про них мы не будем.</p>') +
    '<p class="dim">Приговоров тут не выносят: мы называем только то, что видели у себя на странице, ' +
    'и не следим за ребёнком.</p>' +
    (canOpen
      ? '<div class="admrow"><button class="rbtn check" data-act="totrace">Открыть запись →</button></div>'
      : '') + '</div>';
}

/* ---------- что показывает практика ----------
   Единственное место в продукте, где тренажёр правит собственное обещание по
   факту, а не по замыслу. Число уроков в занятии посчитано из длины текста
   урока; здесь оно сверяется с тем, сколько ребёнок работает на самом деле.
   ⚠️ Сам ничего не меняем: показываем и предлагаем. Рамку ставит взрослый. */
function paceStatHTML(snap){
  var st = zanStats(snap), f = frame();
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
                  made:null, problem:null, breaksProblem:null };
function adultTplById(id){
  var list = window.PARENT_TASKS || [];
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return list[0] || null;
}
/* Проверка чисел, которые взрослый вписал в шаблон.
   ⚠️ Границы min/max у параметров были описаны в parent.js с самого начала, но
   НИ РАЗУ не применялись: значения уезжали в код строками как есть. Отсюда весь
   букет — пустое поле давало SyntaxError, «0» в поле «даём в неделю» вешал
   страницу вечным циклом, «-5 тетрадей по -3 ₽» собиралось в рабочее задание
   без единого возражения. Возвращаем текст проблемы или null, если всё хорошо. */
function adultFieldProblem(tpl, v){
  var ps = (tpl && tpl.params) || [];
  for (var i = 0; i < ps.length; i++){
    var p = ps[i], raw = String(v[p.k] === undefined ? "" : v[p.k]).trim();
    if (!raw) return "Не заполнено поле «" + p.label + "».";
    if (p.text){
      /* список чисел: он вклеивается в код как marks = [...] */
      var parts = raw.split(",").map(function(x){ return x.trim(); }).filter(function(x){ return x !== ""; });
      if (!parts.length) return "В поле «" + p.label + "» нет ни одного числа.";
      for (var j = 0; j < parts.length; j++)
        if (!isFinite(Number(parts[j])))
          return "В поле «" + p.label + "» вместо числа записано «" + parts[j] +
                 "». Нужны числа через запятую, например: 4, 5, 3, 5.";
      continue;
    }
    var n = Number(raw.replace(",", "."));
    if (!isFinite(n)) return "В поле «" + p.label + "» нужно число, а записано «" + raw + "».";
    if (Math.floor(n) !== n) return "В поле «" + p.label + "» нужно целое число, а записано «" + raw + "».";
    if (p.min !== undefined && n < p.min)
      return "В поле «" + p.label + "» должно быть не меньше " + p.min + " — сейчас " + n + ".";
    if (p.max !== undefined && n > p.max)
      return "В поле «" + p.label + "» должно быть не больше " + p.max + " — сейчас " + n + ".";
  }
  return null;
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
        /* min/max/step проставляем в саму разметку: браузер тогда показывает
           стрелки в разумных пределах и не даёт ввести дробь. Настоящая
           проверка всё равно в adultFieldProblem — атрибуты легко обойти. */
        var lim = p.text ? "" :
          (p.min !== undefined ? ' min="' + p.min + '"' : "") +
          (p.max !== undefined ? ' max="' + p.max + '"' : "") + ' step="1"';
        return '<label class="admlbl">' + esc(p.label) +
          ' <input type="' + (p.text ? "text" : "number") + '"' + lim +
          ' data-pp="' + p.k + '" value="' + esc(String(p.def)) + '"></label>';
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
/* Обработчики органов управления рамкой. redraw — чем перерисовать экран после
   нажатия: кабинет на детском устройстве перерисовывает себя, кабинет взрослого —
   карточку ученика. Сами кнопки в обоих местах одни и те же. */
function bindFrameEditor(redraw){
  app.querySelectorAll("[data-fwd]").forEach(function(b){
    b.onclick = function(){
      var n = +b.getAttribute("data-fwd"), days = frame().days.slice(), i = days.indexOf(n);
      if (i >= 0) days.splice(i, 1); else days.push(n);
      days.sort(function(x, y){ return x - y; });
      frameSet({ days: days });
      redraw();
    };
  });
  app.querySelectorAll("[data-fcap]").forEach(function(b){
    b.onclick = function(){ frameSet({ cap: +b.getAttribute("data-fcap") }); redraw(); };
  });
  app.querySelectorAll("[data-flen]").forEach(function(b){
    b.onclick = function(){ frameSet({ len: +b.getAttribute("data-flen") }); redraw(); };
  });
  app.querySelectorAll("[data-fmix]").forEach(function(b){
    b.onclick = function(){ frameSet({ mix: b.getAttribute("data-fmix") }); redraw(); };
  });
  app.querySelectorAll("[data-funtil]").forEach(function(b){
    b.onclick = function(){
      frameSet({ until: addMonths(dayKey(), +b.getAttribute("data-funtil")) });
      redraw();
    };
  });
  app.querySelectorAll("[data-brdel]").forEach(function(b){
    b.onclick = function(){
      var br = frame().breaks.slice();
      br.splice(+b.getAttribute("data-brdel"), 1);
      frameSet({ breaks: br });
      redraw();
    };
  });
  /* кнопки внутри рамки, у которых общий обработчик data-act */
  app.querySelectorAll('[data-act="fgoal"],[data-act="fgoaloff"],[data-act="bradd"],' +
                       '[data-act="fcaphard"],[data-act="ftime"],' +
                       '[data-act="ftimeoff"],[data-act="funtil"],[data-act="funtiloff"],' +
                       '[data-act="fics"]').forEach(function(b){
    b.onclick = function(){
      var act = b.getAttribute("data-act");
      if (act === "fcaphard"){ frameSet({ capHard: !frame().capHard }); return redraw(); }
      if (act === "ftimeoff"){ frameSet({ time: null }); return redraw(); }
      if (act === "funtiloff"){ frameSet({ until: null }); return redraw(); }
      if (act === "ftime"){
        var tv = (document.getElementById("ftime") || {}).value || "";
        /* ⚠️ Пустое поле — это «убрать», а не «оставить как было»: иначе
           взрослый стирает час, жмёт «Сохранить», и ничего не меняется. */
        frameSet({ time: validTime(tv) ? tv : null });
        return redraw();
      }
      if (act === "funtil"){
        var uv = (document.getElementById("funtil") || {}).value || "";
        frameSet({ until: uv || null });
        return redraw();
      }
      if (act === "fics"){
        var who = (kidTarget && kidTarget.name) ? kidTarget.name : (frameState().name || "");
        var text = icsForFrame(who);
        if (text) downloadText("fionika-zanyatiya.ics", text, b, "text/calendar");
        return;
      }
      if (act === "fgoaloff"){ frameSet({ goal: null }); return redraw(); }
      if (act === "fgoal"){
        var v = (document.getElementById("fgoal") || {}).value || "";
        frameSet({ goal: v || null });
        return redraw();
      }
      if (act === "bradd"){
        var a = (document.getElementById("brfrom") || {}).value || "";
        var z = (document.getElementById("brto") || {}).value || "";
        var br = frame().breaks.slice();
        adultPick.breaksProblem =
          (!a && !z) ? "Укажите обе даты — начало и конец паузы." :
          !a ? "Не указана дата начала паузы." :
          !z ? "Не указана дата конца паузы." :
          (z < a) ? "Конец паузы раньше её начала — проверьте даты." :
          (br.length >= 12) ? "Больше двенадцати пауз не помещается — уберите лишнюю, чтобы добавить новую." :
          null;
        if (adultPick.breaksProblem) return redraw();
        br.push([a, z]);
        frameSet({ breaks: br });
        return redraw();
      }
    };
  });
}
function wireAdult(){
  /* переключение вкладок — только показ/скрытие, как в карточке ученика */
  app.querySelectorAll("[data-utab]").forEach(function(b){
    b.onclick = function(){
      adultTab = b.getAttribute("data-utab");
      app.querySelectorAll("[data-utab]").forEach(function(x){
        var on = x.getAttribute("data-utab") === adultTab;
        x.classList.toggle("on", on);
        x.setAttribute("aria-selected", on ? "true" : "false");
      });
      app.querySelectorAll("[data-upane]").forEach(function(p){
        p.hidden = p.getAttribute("data-upane") !== adultTab;
      });
    };
  });
  bindFrameEditor(screenAdult);
  app.querySelectorAll("[data-ptab]").forEach(function(b){
    b.onclick = function(){ adultPick.t = b.getAttribute("data-ptab");
      /* Ошибку сборки гасим вместе со сменой вкладки: «программа шаблона
         не запустилась» на вкладке «Назначить урок» бессмысленна. */
      adultPick.made = null; adultPick.problem = null; screenAdult(); };
  });
  var sel = document.getElementById("ptpl");
  if (sel) sel.onchange = function(){ adultPick.tpl = sel.value; adultPick.made = null; adultPick.problem = null; screenAdult(); };
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
      if (act === "toadmin"){ return screenAdmin(); }
      if (act === "totrace") return screenTrace();
      if (act === "toworks") return screenShowcase();
      if (act === "toai") return screenAILab();
      /* fcaphard / fgoal / fgoaloff / bradd обрабатывает bindFrameEditor
         (общий с кабинетом взрослого). Здесь остаётся только то, что живёт лишь
         на этом экране: замер темпа по занятиям. */
      if (act === "peron"){
        var st = zanStats();
        if (st.enough) frameSet({ perLesson: st.per });
        return screenAdult();
      }
      if (act === "perloff"){ frameSet({ perLesson: null }); return screenAdult(); }
      if (act === "perlen"){ frameSet({ len: +b.getAttribute("data-len") }); return screenAdult(); }
      if (act === "pmake"){
        var tpl = adultTplById(adultPick.tpl);
        if (!tpl) return;
        var v = {};
        app.querySelectorAll("[data-pp]").forEach(function(inp){ v[inp.getAttribute("data-pp")] = inp.value; });
        /* Пустое поле раньше уезжало в код как пустота и давало SyntaxError, а
           «0» в поле «даём в неделю» — вечный цикл на 300 000 шагов с подвисшей
           страницей. Взрослый в обоих случаях читал «проверьте числа». Проверяем
           поля ДО запуска: сказать, какое поле и что с ним не так, — дешевле,
           чем объяснять падение движка человеку, который не программист. */
        var whatsWrong = adultFieldProblem(tpl, v);
        if (whatsWrong){
          adultPick.made = null;
          adultPick.problem = whatsWrong;
          return screenAdult();
        }
        var built = taskBuild(tpl.title, tpl.goal(v), tpl.code(v));
        if (built.problem || built.error){
          /* сообщение рисуем в карточке, а не alert'ом: модальное окно
             останавливает страницу целиком, и на телефоне это выглядит как
             поломка. Плюс alert невозможно проверить тестом. */
          adultPick.made = null;
          /* ⚠️ Движок объясняет ошибку по-человечески («Делить на ноль нельзя»,
             «цикл никогда не заканчивается»), а это сообщение раньше молча
             выбрасывалось и заменялось на «проверьте числа» — то есть родителю,
             который по замыслу не программист, не говорили КАКИЕ числа. */
          adultPick.problem = built.problem ||
            (built.error ? "Программа шаблона не запустилась. " + errText(built.error)
                         : "Программа шаблона не запустилась — проверьте числа.");
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

/* ===== экраны «Своего задания» =====
   ⚠️ Уехали в js/screens-mytasks.js — разрез 15.09.2026. Слой формата выше
   (упаковка в ссылку, сборка движком, хранилище) остался здесь: на нём стоит
   и задача ребёнку из кабинета взрослого, почему именно так — в шапке того
   файла. copyText — обёрткой: приходит из модуля профиля. */
var FRIEND_XP = 20;   /* за чужое задание, один раз на задание */
/* Вход для победы над чужим заданием: отметка «уже решал», опыт и значок.
   Общий счётчик опыта модуль не пишет сам (§ 4.5). Возвращает начисленное. */
function friendTaskWin(key){
  S.friendTasks = S.friendTasks || {};
  S.friendTasks[key] = 1;
  S.xp += FRIEND_XP;
  award("guest");
  return FRIEND_XP;
}
var MYTASKS = KVSCREENS.mytasks({
  app: app, esc: esc, plural: plural, fmtDay: fmtDay, enterScreen: enterScreen,
  refreshTop: refreshTop, goHome: goHome, screenWorlds: screenWorlds, save: save,
  makeStudio: makeStudio, errHTML: errHTML, diffBlock: diffBlock,
  draftGet: draftGet, draftApply: draftApply, draftSchedule: draftSchedule,
  markActiveToday: markActiveToday, award: award, confetti: confetti, closeWin: closeWin,
  copyText: function(t, btn){ return copyText(t, btn); },
  myTasksAll: myTasksAll, myTasksList: myTasksList, myTaskSave: myTaskSave, myTaskDrop: myTaskDrop,
  taskBuild: taskBuild, taskLink: taskLink, taskKey: taskKey,
  solvedAdd: solvedAdd, solvedFor: solvedFor, solvedCount: solvedCount, solvedLink: solvedLink,
  friendTaskWin: friendTaskWin,
  S: function(){ return S; },
  session: function(){ return session; },
  newSession: function(v){ session = v; return v; }
});
var screenMyTasks = MYTASKS.screenMyTasks, openFriendTask = MYTASKS.openFriendTask,
    screenSolved = MYTASKS.screenSolved, screenTaskBroken = MYTASKS.screenTaskBroken;

/* ================= пересказ программы словами =================
   ⚠️ Уехал в js/story.js — третий шаг по архитектурному долгу. Как выбирался
   и чем мерилась связанность — в шапке того файла. */
var STORY = KVSCREENS.story({
  esc: esc, plural: plural, astWalk: astWalk, stepFacts: stepFacts,
  KIND_RU: KIND_RU, WATCH_MAX_STEPS: WATCH_MAX_STEPS
});
var storyHTML = STORY.storyHTML, storyOf = STORY.storyOf;

/* ================= экран: визуализатор =================
   ⚠️ Уехал в js/screens-viz.js — очередной разрез архитектурного долга
   (15.09.2026). Замер и договор — в шапке того файла: внутрь десять имён,
   наружу девять. Сессия и здесь чужое состояние — только через вызовы
   (§ 4.5); KIND_RU и storyHTML объявлены ВЫШЕ по файлу и едут значением. */
var VIZ = KVSCREENS.viz({
  app: app, esc: esc, hl: hl, KIND_RU: KIND_RU,
  enterScreen: enterScreen, refreshTop: refreshTop, goHome: goHome,
  makeEditor: makeEditor, storyHTML: storyHTML,
  session: function(){ return session; },
  newSession: function(v){ session = v; return v; }
});
var screenViz = VIZ.screenViz, vizStopPlay = VIZ.vizStopPlay, vizPlaying = VIZ.vizPlaying,
    vizRecord = VIZ.vizRecord, vizShort = VIZ.vizShort, vizMemoryHTML = VIZ.vizMemoryHTML,
    vizDrawArrows = VIZ.vizDrawArrows, vizDiff = VIZ.vizDiff, VIZ_EXAMPLES = VIZ.VIZ_EXAMPLES;

/* ================= экран: полная панель репетитора =================
   Закрыта паролем взрослого (adminGate). Открывается адресом с #panel на
   конце — или ссылкой «Полная панель репетитора →» из кабинета. Показывает
   прогресс, позволяет открывать и зачитывать уроки, обмениваться данными с
   сервером и смотреть прогресс другого ученика по его коду.
   ============================================================ */
/* Вход на новый экран: гасим всё, что тикает в фоне. Раньше эти две команды
   были выписаны в пятнадцати местах, и когда у визуализатора появился свой
   таймер, его туда не дописали — «Играть» продолжал перерисовывать плеер,
   уже выброшенный из документа. */
/* tab — какая вкладка наверху должна светиться: "home" (по умолчанию),
   "train", "mine" или null, если экран не принадлежит ни одному разделу
   (профиль, регистрация, панель репетитора). */
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
  clearAdminQuery();
  /* ⚠️ Адрес пишется ЗДЕСЬ, а не в каждом экране по отдельности: через
     enterScreen проходят все 52 перехода, а россыпь из одиннадцати ручных
     присваиваний и была причиной, по которой «Назад» работал через раз. */
  routeFor(curPlace);
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
/* ⚠️ Хэш отсюда ушёл: адресом теперь целиком заведует routeFor. Осталась
   вторая половина, к хэшу отношения не имевшая, — `?admin` в запросе.
   Это дверь из 404.html (`.../kodokvest/admin` превращается в `?admin`), и
   убрать её из адреса обязательно: иначе обновление страницы на любом экране
   снова открывает панель. Остальные параметры, например `?kid=`, целы. */
function clearAdminQuery(){
  try {
    if (!history.replaceState) return;
    var search = (location.search || "").replace(/([?&])admin(=[^&]*)?(&|$)/i, function(m, p1, v, tail){
      return tail === "&" ? p1 : (p1 === "?" ? "" : "");
    });
    if (search === "?") search = "";
    if (search !== location.search)
      history.replaceState(null, "", location.pathname + search + location.hash);
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
/* Панель репетитора открывается любым из способов:
   .../kodokvest/#admin, .../kodokvest/?admin и просто .../kodokvest/admin
   (последнее ловит 404.html и превращает в ?admin). */
/* ================= адреса экранов: ОДНА таблица =================
   ⚠️ До 1.136.0 таблиц было ДВЕ, и вторая была не таблицей, а россыпью.
   Читающая половина существовала: HASH_SCREENS, 24 адреса, по которым экран
   открывался. Пишущей не было вовсе — `enterScreen` адрес не трогал, а
   одиннадцать экранов присваивали `location.hash` руками, по одному, в
   разных концах файла. Из этого следовали три вещи, и все три видно руками:

     — репетитор не мог продиктовать ссылку на то, что видит: какой экран ни
       открой, адрес один и тот же;
     — «Назад» в браузере работал ЧЕРЕЗ РАЗ. С тех одиннадцати экранов он
       возвращал на прошлый экран, с остальных сорока — выбрасывал из
       продукта целиком. На телефоне «назад» это системный жест, и худшего
       места для непредсказуемости в продукте нет;
     — заголовок вкладки был один на все 55 экранов.

   Теперь источник один — ROUTES. Из него собирается и чтение (`routeHash`),
   и запись (`setRoute` из `enterScreen`), и заголовок вкладки. Разойтись им
   больше нечем, и это сторожит тест «кругооборот»: адрес, записанный при
   заходе на экран, обязан открыть ТОТ ЖЕ экран.

   ⚠️ Ключ — `place`, то самое второе имя места, по которому находит текст
   помощь «?». Имена НЕ переименовывались, хотя десять из них разошлись с
   адресами (`#again` при месте `review`, `#mine` при `mytasks`, `#works`
   при `works`): к `place` привязаны тексты подсказок, и переименование
   сломало бы их молча — правило § 4.3 «замена имён ломает `data-*` тихо».
   Поэтому таблица связывает то, что есть, а не то, что было бы красиво.

   ⚠️ Кабинеты — такие же маршруты, как всё остальное, и это перепроверено, а
   не унаследовано. `clearAdminHash` стирал `#admin`, `#panel` и `#group` при
   каждом заходе на экран, и выглядело это как «прячем панель от ребёнка». На
   деле смысл был другой: уходя с кабинета на «Игры», нельзя тащить за собой
   его адрес. Ровно это и делает теперь `routeFor` — пишет `#games`. Прятать
   же панель адресом бессмысленно: замок на ней пароль, а не незнание слова
   «panel», и надпись, говорящая, ГДЕ человек, — правило § 4.16.

   ⚠️ Названия для заголовка вкладки взяты с самих экранов, без эмодзи.
   Эмодзи в `<title>` в поиске и в списке вкладок читается мусором. */
var BASE_TITLE = "Фионика — информатика и программирование для школьников";
var ROUTES = [
  { h:"#today",   place:"today",   t:"Сегодня",                    open:function(){ screenToday(); } },
  { h:"#train",   place:"train",   t:"Тренировки",                 open:function(){ screenTrain(); } },
  { h:"#games",   place:"games",   t:"Игры",                       open:function(){ screenGames(); } },
  { h:"#warmup",  place:"warm",    t:"Разминка",                   open:function(){ screenWarmups(); } },
  { h:"#viz",     place:"viz",     t:"Визуализатор",               open:function(){ screenViz(); } },
  { h:"#ai",      place:"ai",      t:"Ты и ИИ",                    open:function(){ screenAILab(); } },
  { h:"#again",   place:"review",  t:"Повторить",                  open:function(){ screenReview(); } },
  { h:"#hw",      place:"hw",      t:"Домашка",                    open:function(){ screenHW(); } },
  { h:"#folio",   place:"folio",   t:"Моё: работы и сертификаты",                  open:function(){ screenFolio(); } },
  { h:"#myexam",  place:"myexam",  t:"Задача по своей программе",
    open:function(){ openMyExam(); } },
  { h:"#mine",    place:"mytasks", t:"Своё задание",               open:function(){ screenMyTasks(); } },
  { h:"#works",   place:"works",   t:"Что создают ученики",        open:function(){ screenShowcase(); } },
  { h:"#robot",   place:"robot",   t:"Робот",                      open:function(){ screenRobot(); } },
  { h:"#html",    place:"web",     t:"HTML и CSS",                 open:function(){ screenWeb(); } },
  { h:"#specs",   place:"specs",   t:"Приёмка",                    open:function(){ screenSpecs(); } },
  { h:"#algo",    place:"algo",    t:"Алгоритмы, ОГЭ и ЕГЭ",       open:function(){ screenAlgo(); } },
  { h:"#variant", place:"variant", t:"Пробный вариант экзамена",   open:function(){ screenVariant(); } },
  { h:"#proverka", place:"proverka", t:"Проверка: что умеет сам",  open:function(){ screenProverka(); } },
  { h:"#zashchita", place:"zashchita", t:"Защита своего кода",     open:function(){ screenZashchita(); } },
  { h:"#shop",    place:"shop",    t:"Мастерская: полка и верстак",open:function(){ screenShop(); } },
  { h:"#sand",    place:"sand",    t:"Песочница",                  open:function(){ screenSandbox(); } },
  { h:"#path",    place:"path",    t:"Карта пути",                 open:function(){ screenPath(); } },
  { h:"#account", place:"account", t:"Профиль",                    open:function(){ screenAccount(); } },
  { h:"#zan",     place:"zan",     t:"Занятие",                    open:function(){ screenZan(); } },
  { h:"#about",   place:"about",   t:"Информатика для школьников", open:function(){ screenAbout(); } },
  { h:"#guide",   place:"guide",   t:"Как пользоваться",           open:function(){ screenGuide(); } },
  /* #help — второе имя того же экрана: оно было в ссылках и в помощи раньше,
     чем #guide, и ломать разосланные ссылки нельзя. Читается, но НЕ пишется:
     иначе у одного экрана вышло бы два адреса, и «кругооборот» не сошёлся. */
  { h:"#help",    place:"guide",   t:"Как пользоваться",           open:function(){ screenGuide(); }, alias:1 },
  /* ⚠️ #adult ведёт в РАЗНЫЕ экраны по роли устройства, и это не небрежность:
     на устройстве взрослого это его личный кабинет, на детском — занятийная
     рамка самого ребёнка. Место у них поэтому тоже разное, и в таблице
     записаны оба: иначе «кругооборот» ловил бы ложную ошибку. */
  { h:"#adult",   place:"adult",   t:"Кабинет взрослого",
    open:function(){ if (isAdminDevice()) screenAdminHome(); else screenAdult(); } },
  /* --- кабинеты взрослого --- */
  { h:"#panel",   place:"admin",   t:"Панель репетитора",          open:function(){ screenAdmin(); } },
  { h:"#group",   place:"group",   t:"Группа",                     open:function(){ screenGroup(); } },
  { h:"#admin",   place:"kids",    t:"Мои ученики",                open:function(){ screenAdminHome(); } }
];
/* Два указателя по одной таблице: искать приходится в обе стороны — по адресу
   (пришли по ссылке) и по месту (ушли на экран кнопкой). */
var ROUTE_BY_HASH = {}, ROUTE_BY_PLACE = {};
ROUTES.forEach(function(r){
  ROUTE_BY_HASH[r.h] = r;
  /* Первый выигрывает: у #help стоит alias, и место «guide» обязано писаться
     как #guide, иначе один экран получил бы два адреса. */
  if (!r.alias && !ROUTE_BY_PLACE[r.place]) ROUTE_BY_PLACE[r.place] = r;
});

/* Адрес следует за экраном. Одно место на весь продукт.
   ⚠️ pushState, а не `location.hash = …`: присваивание хэша стреляет
   `hashchange`, наш слушатель зовёт `routeHash()`, и экран рисуется ВТОРОЙ
   раз — с потерей уже введённого и с перезапуском счётчика времени урока.
   pushState событий не стреляет, а «Назад» браузера всё равно приходит к нам
   тем же `hashchange`. */
function setRoute(hash, title){
  /* ⚠️ Заголовок ставится ПЕРВЫМ и всегда, даже если адрес не менялся.
     Обратный порядок был ошибкой, и нашлась она не тестом, а нажатием
     (правило § 4.7): человек открывает присланную ссылку на урок, адрес уже
     нужный — запись отваливается ранним выходом, а вместе с ней отваливался
     и заголовок. Получалось, что урок, открытый по ссылке, сидел во вкладке
     без имени: как раз в том случае, ради которого адрес и заводили. */
  setTitle(title);
  try {
    if (!history.pushState) return;
    var want = hash || "";
    if ((location.hash || "") === want) return;
    history.pushState(null, "", location.pathname + location.search + want);
  } catch(e){}
}
function setTitle(title){
  try { document.title = title ? (title + " — Фионика") : BASE_TITLE; } catch(e){}
}
/* Адрес по месту, на котором стоит человек.
   ⚠️ Первая версия этого места решала по ВРЕМЕНИ: заводился флаг «сейчас
   разбираем адрес», и пока он поднят, писать было нельзя. Флаг оказался
   негодным, и показала это не голова, а диагностика: экраны дорисовываются
   асинхронно, продолжение приходит уже со сброшенным флагом, и один и тот же
   заход давал то один адрес, то другой — гонка. Признак был виден и раньше:
   тест на это правило мигал.
   Теперь решение принимается по СОСТОЯНИЮ, а не по моменту, и потому
   повторяемо: стираем только ЧУЖОЙ адрес — тот, что записан в таблице за
   другим экраном. Адрес, которого в таблице нет, не наш: его поставил либо
   сам экран (у урока, мира и проекта адрес с параметром), либо человек,
   пришедший по присланной ссылке (#task=…, #play=…, #work=…, #assign=…).
   Стереть такой значит увести человека с присланной ему задачи при первом же
   обновлении страницы. */
function routeFor(place){
  var r = ROUTE_BY_PLACE[place];
  if (r) return setRoute(r.h, r.t);
  if (ROUTE_BY_HASH[(location.hash || "").toLowerCase()]) setRoute("", "");
}
function wantsAdmin(){
  var h = (location.hash || "").toLowerCase();
  var q = (location.search || "").toLowerCase();
  return h === "#admin" || /(^|[?&])admin([=&]|$)/.test(q);
}
function routeHash(){
  if (wantsAdmin()){ screenAdminHome(); return true; }
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
  var ppk = /^#play=(.+)$/.exec(location.hash || "");
  if (ppk){
    var gotp = playUnpack(ppk[1]);
    if (gotp) screenPlay(gotp); else screenPlayBroken();
    return true;
  }
  var wpk = /^#work=(.+)$/.exec(location.hash || "");
  if (wpk){
    var gotw = workUnpack(wpk[1]);
    if (gotw) screenWork(gotw); else screenWorkBroken();
    return true;
  }
  /* Урок и мир — единственные экраны с ПАРАМЕТРОМ в адресе. Разбираются до
     приведения к нижнему регистру не из-за base64 (id урока — латиница с
     дефисом), а чтобы правило было одно для всех адресов с «=». */
  var lpk = /^#lesson=([\w-]+)$/.exec(location.hash || "");
  if (lpk && CURRICULUM.byId(lpk[1])){ openLesson(lpk[1]); return true; }
  /* Пакет к защите — тоже адрес с параметром (id проекта) */
  var dpk = /^#defense=([\w-]+)$/.exec(location.hash || "");
  if (dpk && projectById(dpk[1])){ screenDefense(dpk[1]); return true; }
  /* Итог проверки — адрес с параметром: сам код результата. Кривой код не
     уводит на Главное молча, а открывает вход проверки с объяснением. */
  var prk = /^#proverka=([0-9A-Za-z-]+)$/.exec(location.hash || "");
  if (prk){ PROVERKA.screenReport(prk[1], ""); return true; }
  var wpn = /^#world=(\d+)$/.exec(location.hash || "");
  if (wpn && CURRICULUM.world(Number(wpn[1]))){ screenWorld(Number(wpn[1])); return true; }

  var h = (location.hash || "").toLowerCase();
  if (ROUTE_BY_HASH[h]){ ROUTE_BY_HASH[h].open(); return true; }
  var ph = h.replace(/^#/, "");
  if (ph && projectById(ph)){ openProject(ph); return true; }
  return false;
}
/* ⚠️ Время показывается ТОЧНО — в минутах и секундах, пока его меньше часа.
   Жалоба с боя (05.09.2026): «не видно, сколько времени занимался ребёнок».
   Старый формат округлял до минут и, что хуже, печатал «—» на всём, что
   короче минуты: сорок секунд работы выглядели как её отсутствие. Для
   родителя это прямая ложь ровно в ту сторону, в какую врать нельзя.
   Больше часа секунды становятся шумом — там «1 ч 12 мин». */
function fmtDur(ms){
  var sec = Math.round((ms || 0) / 1000);
  if (sec <= 0) return "0 сек";
  if (sec < 60) return sec + " сек";
  var m = Math.floor(sec / 60), r = sec % 60;
  if (m < 60) return m + " мин" + (r ? " " + r + " сек" : "");
  return Math.floor(m / 60) + " ч " + (m % 60) + " мин";
}
/* Оставлено под своим именем: им меряют НЕДЕЛЬНЫЕ и общие суммы, где секунды
   не значат ничего. Всё, что про «сегодня» и про один урок, идёт через fmtDur. */
function fmtMins(ms){ return fmtDur(ms); }

/* Активные секунды за день. Берутся из карты часов (S.hours) — там уже лежат
   именно РАБОЧИЕ секунды, без пауз и без открытой вкладки. Работает на любом
   снимке, поэтому годится и взрослому, который смотрит чужой прогресс. */
function daySec(st, key){
  var row = ((st && st.hours) || {})[key || dayKey()];
  if (!Array.isArray(row)) return 0;
  var n = 0;
  for (var i = 0; i < row.length; i++) n += row[i] || 0;
  return n;
}
function dayMs(st, key){ return daySec(st, key) * 1000; }
function fmtWhen(ts){
  if (!ts) return "—";
  var d = new Date(ts), p = function(x){ return (x < 10 ? "0" : "") + x; };
  return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() +
         " " + p(d.getHours()) + ":" + p(d.getMinutes());
}
/* Файл «Переноса»: всё состояние устройства, КРОМЕ пароля кабинета.
   ⚠️ До 13.09.2026 сюда уходил и admin.pass — хэш пароля, открытым текстом в
   файле и в поле на экране. Хэш короткого пароля подбирается перебором, а
   файл носят по флешкам и мессенджерам. Пароль — свойство УСТРОЙСТВА, а не
   прогресса: переносить его незачем, и загрузка его тоже не берёт. */
function progressJSON(){
  return JSON.stringify(S, function(k, v){
    if (this === S.admin && k === "pass") return undefined;
    return v;
  }, 2);
}
function statBox(k, v){
  return '<div class="admstat"><span>' + k + '</span><b>' + v + '</b></div>';
}
function rankOf(xp){
  var r = RANKS[0][1];
  for (var i = 0; i < RANKS.length; i++) if (xp >= RANKS[i][0]) r = RANKS[i][1];
  return r;
}
/* подпись ученика у репетитора: только на этом устройстве, на сервер не идёт */
function adminLabel(code){
  return (S.admin && S.admin.labels && S.admin.labels[code]) || "";
}
function adminLabelSet(code, v){
  S.admin.labels = S.admin.labels || {};
  v = String(v || "").trim().slice(0, 40);
  if (v) S.admin.labels[code] = v; else delete S.admin.labels[code];
  saveLocal();
}
/* ================= устройство взрослого =================
   ⚠️ Честно про то, чем это НЕ является. Это не авторизация: сайт статический,
   проверять пароль некому, и всё решается в браузере. Пароль здесь защищает
   ровно от одного — от ребёнка, который взял мамин ноутбук и полез смотреть,
   что там за кнопки. От человека, который умеет открыть отладчик и знает, что
   искать, он не защищает, и притворяться обратным было бы враньём.
   Зато он честно решает исходную задачу: кабинет взрослого больше не живёт на
   том же профиле, что и уроки ребёнка.

   Храним не пароль, а его свёртку с солью — чтобы пароль не лежал в памяти
   браузера открытым текстом на случай, если кто-то заглянет в хранилище. */
function adminHash(pass){
  var s = "kodokvest" + String(pass || "");
  /* FNV-1a, 32 бита, несколько проходов. Криптостойкости здесь не требуется
     (см. выше), нужна необратимость на глаз. */
  var h1 = 0x811c9dc5, h2 = 0x01000193;
  for (var pass2 = 0; pass2 < 5; pass2++){
    for (var i = 0; i < s.length; i++){
      h1 ^= s.charCodeAt(i); h1 = (h1 * 0x01000193) >>> 0;
      h2 = (h2 + h1 + s.charCodeAt(i) * (i + 1)) >>> 0;
    }
    s = String(h1) + ":" + String(h2) + ":" + s;
  }
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}
function adminHasPass(){ return !!(S.admin && S.admin.pass); }
/* Пароль защищает ВСЕ взрослые экраны — и кабинет, и старую полную панель.
   makeAdmin отдельным флагом: «сделать это устройство кабинетом» ставит и пароль,
   и режим, а защита панели на общем устройстве — только пароль, режим не трогает
   (иначе один взгляд в панель на семейном планшете спрятал бы ребёнку уроки). */
function adminPassSet(pass, makeAdmin){
  S.admin.pass = adminHash(pass);
  if (makeAdmin) S.admin.isAdmin = true;
  saveLocal();
}
function adminPassOk(pass){ return adminHasPass() && S.admin.pass === adminHash(pass); }
function isAdminDevice(){ return !!(S.admin && S.admin.isAdmin); }

/* ===== где взрослый находится: в кабинете или на главной =====
   ⚠️ Жалоба фаундера 07.09.2026: «на главной делаю обновление — он уходит в
   кабинет, а должен оставаться на главной». Так и было: при загрузке экран
   выбирался ПО РОЛИ УСТРОЙСТВА (админское — значит кабинет), а не по тому,
   где человек был. Уйти с кабинетного устройства на главную было можно —
   логотипом, — но первое же обновление возвращало обратно.

   Роль устройства и место человека — РАЗНЫЕ вещи, и путать их нельзя. Роль
   отвечает на вопрос «чей это компьютер» и живёт годами. Место отвечает на
   «где я сейчас» и меняется по клику. Раньше вторая величина не хранилась
   вовсе, и её роль исполняла первая.

   Хранится рядом с ролью, в S.admin: на сервер не уходит, сбросом прогресса
   не стирается, переживает обновление страницы. Всё, что не «home», считается
   кабинетом, — тогда старым устройствам ничего мигрировать не надо. */
function atHome(){ return !!(S.admin && S.admin.place === "home"); }
/* Выйти из кабинета: человек больше не в кабинете и оказывается на главной.
   ⚠️ Это НЕ «устройство больше не кабинет» — роль, пароль и код ребёнка на
   месте, вернуться можно кнопкой в шапке. Разница ровно та же, что между
   «выйти из комнаты» и «съехать с квартиры», и обе кнопки нужны.
   ⚠️ Замок закрываем: вышел — значит вышел, и следующий вход в кабинет
   администратора спросит пароль. Иначе на общем компьютере «выход» ничего не
   охраняет: ребёнок вернётся в кабинет одним нажатием. */
function leaveRoom(){
  kidTarget = null;
  adminLock();
  /* ⚠️ Роль устройства здесь НЕ снимается, и это проверяет тест [кабинет].
     Разбор жалобы фаундера 08.09.2026 («нажимаю выход, кабинет живой и выйти
     неоткуда»): у РЕПЕТИТОРА выход честный — роль остаётся, но замок
     закрывается, и возврат в кабинет стоит пароля. Это верное поведение для
     общего устройства, и ломать его было бы хуже, чем оставить.
     Дыра была у РОДИТЕЛЯ, и она другой природы: у родительского устройства
     замка нет вовсе — код ребёнка сам по себе открывает кабинет. Поэтому
     закрывать там нечего, и «выйти» обязано снимать код. Чинится это в
     самом кабинете родителя (screenParent), а не здесь: сюда приходят обе
     роли, и общая правка сломала бы репетитору общее устройство. */
  setPlace("home");
  screenAbout();
}
function setPlace(p){
  if (!S.admin || S.admin.place === p) return;
  S.admin.place = p;
  saveLocal();                 /* admin не синхронизируется — хватит местного */
}
/* ===== устройство родителя =====
   Родитель следит за ОДНИМ ребёнком: расписание и отчёт, без списка и без
   группы. Опознаётся по коду ребёнка, привязанному к устройству (parentOf).
   Как и admin, живёт в S.admin (на сервер не уходит, сбросом не стирается).
   Своего детского прогресса у родительского устройства нет — данные ребёнка
   оно читает с сервера по коду, ровно как админ в карточке ученика. */
function parentOf(){ return (S.admin && S.admin.parentOf) || ""; }
function isParentDevice(){ return !!parentOf(); }
function parentDeviceOff(){
  S.admin.parentOf = ""; S.admin.parentLabel = "";
  saveLocal();
}
/* ===== смена роли устройства =====
   ⚠️ Роль (кто это устройство по умолчанию: админ / родитель / ученик) и ПАРОЛЬ
   администратора — разные вещи. Переключение роли меняет только «в какую дверь
   открываться», но НИКОГДА не стирает пароль: иначе, сходив с админского мака в
   роль родителя, взрослый терял бы пароль и заводил кабинет заново. Пароль
   забывает только «Это устройство больше не кабинет».
   Три перехода взаимно исключающи: активна ровно одна роль, остальные сняты. */
function becomeAdmin(){
  S.admin.isAdmin = true;
  S.admin.parentOf = ""; S.admin.parentLabel = "";
  try { if (typeof Cloud !== "undefined") Cloud.forgetCode(); } catch(e){}
  saveLocal();
}
function becomeParent(code, label){
  var v = (typeof Cloud !== "undefined" && Cloud.validCode(code)) || "";
  if (!v) return false;
  S.admin.parentOf = v;
  S.admin.parentLabel = String(label || "").slice(0, 40);
  S.admin.isAdmin = false;                 /* пароль НЕ трогаем */
  /* ⚠️ Уходя из роли админа, ЗАКРЫВАЕМ замок. Иначе на общем компьютере взрослый
     вошёл админом, переключился в другую роль, отдал ноутбук ребёнку — а тот
     кнопкой «Сменить роль» возвращается в кабинет без пароля, потому что замок
     остался открыт на всю сессию. */
  adminLock();
  try { if (typeof Cloud !== "undefined") Cloud.forgetCode(); } catch(e){}
  saveLocal();
  return true;
}
/* Ученик: код ставит сам вызывающий (doLogin/doRegister/ссылка), здесь только
   снимаем взрослые роли, оставляя пароль на месте. */
function becomeKid(){
  S.admin.isAdmin = false;
  S.admin.parentOf = ""; S.admin.parentLabel = "";
  adminLock();                             /* см. becomeParent: замок закрывается */
  saveLocal();
}
/* Превратить это устройство обратно в обычное — забыть и роль, и пароль. Нужна
   отдельная кнопка: иначе взрослый, поставивший админку по ошибке, окажется
   заперт без уроков. */
function adminDeviceOff(){
  S.admin.isAdmin = false; S.admin.pass = "";
  adminLock();
  saveLocal();
}
/* Ссылка родителю: открыв её, устройство родителя привязывается к коду ребёнка
   и дальше всегда открывается в кабинет родителя. Отдельная от детской (?kid=),
   потому что ведёт в другой кабинет. */
function parentLink(code, name){
  var tail = "?parent=" + encodeURIComponent(code) +
    (name ? "&n=" + encodeURIComponent(String(name).slice(0, 40)) : "");
  try { return location.origin + location.pathname + tail; }
  catch(e){ return tail; }
}

/* ---------- ученики этого взрослого ---------- */
function kidsList(){ return (S.admin && Array.isArray(S.admin.kids)) ? S.admin.kids : []; }
function kidGet(code){
  return kidsList().filter(function(k){ return k.code === code; })[0] || null;
}
/* Завести ученика: имя даёт взрослый, код придумывает тренажёр — тот же
   newKidCode, что и при обычной регистрации: слово + случайный хвост, без имени.
   Имя остаётся у взрослого в labels и на сервер не уходит. */
function kidAdd(name){
  name = String(name || "").trim().slice(0, 40);
  if (name.length < 2) return null;
  var code = newKidCode();
  var kid = { code: code, name: name, addedAt: Date.now() };
  S.admin.kids = kidsList().concat([kid]);
  S.admin.labels = S.admin.labels || {};
  S.admin.labels[code] = name;      /* чтобы имя было видно и в списке с сервера */
  saveLocal();
  return kid;
}
/* Взять в список ученика, у которого код УЖЕ есть. Обратная сторона kidAdd:
   тот ПРИДУМЫВАЕТ новый код, этот принимает готовый.
   ⚠️ Без этого «Убрать» была дверью в один конец: карточка обещала «вернуть
   можно, добавив код обратно», а добавить код было нечем — нашлось разбором
   трёх ролей 12.09.2026. Той же дверью возвращается ученик, заведённый на
   другом компьютере: список кабинета живёт только в своём браузере и на
   сервер не уходит (CLOUD_SKIP).
   ⚠️ Имя берём у ВЗРОСЛОГО, а не с сервера: имени ребёнка там нет по
   построению — оно вырезано из снимка тем же CLOUD_SKIP, и это обещание
   («о ребёнке мы не храним ничего»), а не недоделка. */
function kidAttach(code, name){
  var v = (typeof Cloud !== "undefined" && Cloud.validCode(code)) || "";
  if (!v) return null;
  var was = kidGet(v);
  if (was){                      /* уже в списке — только подпись обновим */
    if (String(name || "").trim()) kidRename(v, name);
    return was;
  }
  var kid = { code: v, name: String(name || "").trim().slice(0, 40) || v, addedAt: Date.now() };
  S.admin.kids = kidsList().concat([kid]);
  S.admin.labels = S.admin.labels || {};
  S.admin.labels[v] = kid.name;
  saveLocal();
  return kid;
}
function kidDrop(code){
  S.admin.kids = kidsList().filter(function(k){ return k.code !== code; });
  saveLocal();
}
function kidRename(code, name){
  var k = kidGet(code);
  if (!k) return;
  k.name = String(name || "").trim().slice(0, 40);
  S.admin.labels[code] = k.name;
  saveLocal();
}
/* ---------- список учеников файлом (13.09.2026, RAZVITIE § 2.6) ----------
   Список живёт только в браузере репетитора: имена на сервер не уходят
   (CLOUD_SKIP), и это обещание, а не недоделка. Следствие было нигде не
   сказано: сменил компьютер или почистил браузер — имена пропали, а коды
   пришлось бы вспоминать по одному. Файл лечит это, не трогая обещания.
   ⚠️ Почему не старый «Перенос прогресса файлом» из панели: тот отдаёт всё
   состояние устройства целиком — вместе с паролем кабинета открытым текстом —
   и при загрузке ЗАМЕНЯЕТ всё. Здесь в файле только имена и коды, а загрузка
   ДОБАВЛЯЕТ: уже знакомый ученик не задваивается, его подпись не трогается.
   ⚠️ Прогресс в файл не кладём: он лежит на сервере под кодом, и ученик
   возвращается со всеми занятиями сам, как через «Вернуть по коду». */
var KIDS_FILE_KIND = "fionika-ucheniki";
function kidsListSig(){
  return kidsList().map(function(k){ return k.code; }).sort().join(",");
}
function kidsListFileText(){
  return JSON.stringify({
    kind: KIDS_FILE_KIND, v: 1, savedAt: new Date().toISOString(),
    kids: kidsList().map(function(k){ return { code: k.code, name: k.name || "" }; })
  }, null, 2);
}
/* Файл сохранён — запоминаем, КАКОЙ список в нём. Напоминание гаснет по
   действию, а не по показу, и возвращается, когда в списке появился ученик,
   которого в файле нет. */
function kidsListMarkSaved(){
  S.admin.kidsSavedSig = kidsListSig();
  S.admin.kidsSavedAt = Date.now();
  saveLocal();
}
function kidsSaveNeeded(){
  return kidsList().length >= 3 && (S.admin.kidsSavedSig || "") !== kidsListSig();
}
/* Разобрать текст файла. Принимаем и свой файл, и старый файл прогресса из
   «Переноса» (в нём список лежит в admin.kids): репетитор, который уже
   спасался им, не должен остаться ни с чем. */
function kidsListParse(text){
  var obj = null;
  try { obj = JSON.parse(String(text || "")); } catch(e){
    return { error: "Файл не читается. Нужен файл списка, сохранённый кнопкой «Сохранить список файлом»." };
  }
  var raw = null;
  if (obj && obj.kind === KIDS_FILE_KIND && Array.isArray(obj.kids)) raw = obj.kids;
  else if (obj && obj.admin && Array.isArray(obj.admin.kids)) raw = obj.admin.kids;
  if (!raw) return { error: "Это не список учеников. Нужен файл, сохранённый кнопкой «Сохранить список файлом»." };
  return { kids: raw.filter(function(k){ return k && typeof k === "object"; }).map(function(k){
    return { code: String(k.code || ""), name: String(k.name || "") };
  }) };
}
/* Добавить учеников из файла к списку. Ничего не стирает и не переименовывает. */
function kidsListMerge(kids){
  var r = { added: 0, already: 0, skipped: 0 };
  (kids || []).forEach(function(k){
    var v = (typeof Cloud !== "undefined" && Cloud.validCode(k.code)) || "";
    if (!v){ r.skipped++; return; }
    if (kidGet(v)){ r.already++; return; }
    kidAttach(v, k.name);
    r.added++;
  });
  return r;
}
/* Ссылка-приглашение. Открыв её, устройство ребёнка привязывается к своему
   коду (обработчик ?kid= при загрузке) — регистрироваться отдельно не нужно. */
function kidLink(code){
  try { return location.origin + location.pathname + "?kid=" + encodeURIComponent(code); }
  catch(e){ return "?kid=" + code; }
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

/* ================= КАБИНЕТ ВЗРОСЛОГО КАК ОТДЕЛЬНОЕ УСТРОЙСТВО =================
   Задача, из которой это выросло: раньше взрослый и ребёнок делили один
   профиль на одном устройстве. Взрослый заводил ребёнка «поверх себя», его
   собственный прогресс мешался с детским, а чтобы поставить расписание, надо
   было сидеть за детским устройством. Теперь роли разведены по устройствам:
   мак взрослого — кабинет, планшет ребёнка — тренажёр, связь между ними —
   код ученика и сервер.

   Ничего нового от сервера при этом не потребовалось: op=save умеет писать по
   любому коду, а рамка занятий и так синхронизируется и сливается по правилу
   «свежее побеждает». Взрослый меняет рамку у себя — она догоняет ребёнка при
   следующем обмене.
   ============================================================================ */

/* Первый вход: устройство ещё не объявлено админским. */
/* ===== редактор рамки занятий =====
   Один и тот же набор органов управления нужен в двух местах: в кабинете на
   устройстве ребёнка (screenAdult) и в кабинете взрослого, где рамка правится
   удалённо у выбранного ученика (screenKid). Разметка общая, а КУДА пишут
   кнопки, решает frame()/frameSet(): при выбранном kidTarget они работают на
   рамку ребёнка, иначе на свою. Поэтому дублировать ничего не пришлось. */
function frameEditorHTML(f){
  /* ⚠️ Темп считается ЗДЕСЬ, а не приходит параметром. Раньше кабинет
     репетитора звал frameEditorHTML(frame()) без второго довода — и стоило
     поставить выбранному ученику дату «успеть к», как экран падал на
     pace.none у неопределённого pace. Заодно снят второй промах того же
     места: paceCheck без снимка считал остаток уроков по прогрессу самого
     репетитора, то есть обещал родителю чужую дату. */
  var pace = paceCheck(f.goal, f.days, f.len, frameState());
  var h;
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

  h = '<div class="card"><h3>🗓 Рамка занятий</h3>' +
    /* ⚠️ Первая строка экрана — ОТВЕТ, а не оглавление. Ниже семь блоков
       органов управления, и без этой строки взрослый складывал ответ из них
       сам. Жалоба фаундера 12.09.2026: «надо сделать человеческие кабинеты,
       с настройками нормальными и ясными». Начинается это с того, чтобы
       экран говорил, что на нём сейчас настроено. */
    '<p class="zansum' + (f.days.length ? "" : " none") + '">' + esc(zanSlovami(f)) + '</p>' +
    '<p class="dim">Дни, время и длину назначаете вы. Порядок уроков — нет: курс устроен так, что команда ' +
    'объясняется раньше, чем понадобится, и перестановка уроков ломает именно это. ' +
    'Вы ставите рамку и темп, курс отвечает за порядок.</p>' +
    '<div class="admlbl">Дни занятий</div><div class="wdrow">' + chips + '</div>' +
    '<div class="admlbl">Время занятия</div>' +
    '<div class="admrow"><input type="time" id="ftime" value="' + (f.time || "") + '">' +
      '<button class="rbtn sec" data-act="ftime">Сохранить время</button>' +
      (f.time ? '<button class="rbtn sec" data-act="ftimeoff">Убрать</button>' : '') + '</div>' +
    (f.time
      ? '<p class="dim">Занятие начинается в <b>' + esc(f.time) + '</b>. Это время видит ребёнок ' +
        'на «Сегодня» и родитель в отчёте — одно и то же число во всех трёх местах.</p>'
      : '<p class="dim">Время не задано: продукт скажет «в субботу», но часа не назовёт. ' +
        'Ставить час не обязательно — но без него нельзя выгрузить занятия в календарь.</p>') +
    '<div class="admlbl">Длина занятия</div><div class="admrow">' + lens + '</div>' +
    '<div class="admlbl">Чего больше</div><div class="admrow">' + mixes + '</div>' +
    '<div class="admlbl">Успеть к дате (необязательно)</div>' +
    '<div class="admrow"><input type="date" id="fgoal" value="' + (f.goal || "") + '">' +
      '<button class="rbtn sec" data-act="fgoal">Сохранить дату</button>' +
      (f.goal ? '<button class="rbtn sec" data-act="fgoaloff">Убрать</button>' : '') + '</div>';

  if (f.goal){
    h += pace.none
      ? '<p class="warnline">⚠️ До ' + f.goal.split("-").reverse().join(".") + ' не набирается ни одного занятия, ' +
        'поэтому темп посчитать не из чего. ' +
        (pace.past ? 'Эта дата уже прошла — поставьте будущую.'
                   : pace.nodays ? 'Не отмечен ни один день недели: отметьте, по каким дням идут занятия.'
                                 : 'Между сегодня и этой датой нет ни одного учебного дня — проверьте дни недели и каникулы.') +
        '</p>'
      : pace.ok
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

  /* ---------- план и факт (корзина 3.5) ----------
     Стоит сразу под органами управления рамкой: это ответ на вопрос «а он
     успевает?», и задаёт его тот же человек, который только что выставил дни
     и длину. Без рамки блок называет, чего не хватает, а не молчит. */
  var pf = planFact(frameState());
  h += '<div class="admlbl">План и факт</div>' +
    (pf.none
      ? '<p class="dim planfact none">' + esc(planFactText(pf)) + '. ' +
        'Отметьте дни занятий и сохраните — со следующего дня будет видно, ' +
        'идёт ребёнок по рамке, отстаёт или впереди.</p>'
      : '<p class="planfact ' + pf.kind + '"><b>' + esc(planFactText(pf)) + '.</b> ' +
        'С ' + pf.since.split("-").reverse().join(".") + ' по рамке набралось <b>' + pf.plan + '</b> ' +
        plural(pf.plan, "урок", "урока", "уроков") + ' (' + pf.days + ' ' +
        plural(pf.days, "занятие", "занятия", "занятий") + ' по ' + pf.per + '), ' +
        'сдано <b>' + pf.fact + '</b>.</p>' +
        '<p class="dim">Считаем от дня, когда рамку сохранили: то, что пройдено до неё, ' +
        'к этому плану отношения не имеет. Разница меньше одного занятия — это «по плану», ' +
        'а не отставание.</p>') +
    '';

  /* каникулы (блок собран заранее, печатается в карточке «редкое» ниже) */
  var брКаникулы = '<div class="admlbl">Каникулы и запланированные паузы</div>' +
    (f.breaks.length
      ? '<ul class="brlist">' + f.breaks.map(function(b, i){
          return '<li>' + b[0].split("-").reverse().join(".") + ' — ' + b[1].split("-").reverse().join(".") +
            ' <button class="rbtn sec" data-brdel="' + i + '">убрать</button></li>';
        }).join("") + '</ul>'
      : '<p class="dim">Пока не заданы.</p>') +
    '<div class="admrow"><input type="date" id="brfrom"><input type="date" id="brto">' +
      '<button class="rbtn sec" data-act="bradd">Добавить</button></div>' +
    /* Раньше при неверном вводе кнопка просто не делала НИЧЕГО — ни слова, ни
       подсветки, — и взрослый жал её повторно, считая, что сломался сайт. */
    (adultPick.breaksProblem ? '<p class="warnline">⚠️ ' + esc(adultPick.breaksProblem) + '</p>' : '') +
    '<p class="dim">В эти дни пропуск запланирован, и отчёт не назовёт его прогулом.</p>';

  /* ---------- календарь занятий ----------
     Стоит ПОД каникулами нарочно: план обязан быть посчитан уже с ними.
     Иначе взрослый увидит занятие в день, о пропуске которого сам договорился,
     и перестанет верить календарю целиком. */
  var dates = planDates(0);
  h += '<div class="admlbl">До какой даты занимаемся</div>' +
    '<div class="admrow">' +
      [1, 2, 3, 6].map(function(n){
        return '<button class="rbtn sec" data-funtil="' + n + '">+' + n + ' ' +
          plural(n, "месяц", "месяца", "месяцев") + '</button>';
      }).join("") +
    '</div>' +
    '<div class="admrow"><input type="date" id="funtil" value="' + (f.until || "") + '">' +
      '<button class="rbtn sec" data-act="funtil">Сохранить дату</button>' +
      (f.until ? '<button class="rbtn sec" data-act="funtiloff">Убрать</button>' : '') + '</div>' +
    (f.until
      ? '<p class="dim">План расписан до <b>' + f.until.split("-").reverse().join(".") + '</b>.</p>'
      : '<p class="dim">Горизонт не задан — календарь показывает ближайшие три месяца.</p>');

  h += '<div class="admlbl">Календарь занятий</div>';
  if (!f.days.length)
    h += '<p class="dim">Не отмечен ни один день недели — расписывать нечего.</p>';
  else if (!dates.length)
    h += '<p class="dim">До выбранной даты не выпадает ни одного занятия. ' +
      'Проверьте дни недели, каникулы и горизонт.</p>';
  else {
    /* ⚠️ Сорок дат простынёй — то, что тут стояло сначала, и фаундер назвал это
       безобразием в тот же день (12.09.2026): «каждые субботы каждых недель до
       конца года». И он прав — список дат НЕ ОТВЕЧАЕТ НИ НА ОДИН вопрос, ради
       которого сюда пришли. Вопросов ровно два: «когда ближайшее?» и «сколько
       всего и до какого числа?». Оба — одной строкой. Полный список остаётся,
       но свёрнутым: он нужен раз в жизни, а места занимал больше всего. */
    var бл = dates.slice(0, 3).map(function(k){
      var d = new Date(k + "T12:00:00");
      return WD_SHORT[d.getDay()].toLowerCase() + " " + k.slice(8) + "." + k.slice(5, 7);
    }).join(" · ");
    /* ⚠️ Ту же строку печатает zansum в шапке карточки — второй раз она не
       информация, а шум. Здесь отвечаем на ДРУГОЙ вопрос: когда ближайшие. */
    h += '<p class="planline">Ближайшие: <b>' + бл + '</b>' +
      (dates.length > 3 ? " …" : "") + '</p>' +
      '<details class="plandet"><summary>Все ' + dates.length + ' ' +
        plural(dates.length, "дата", "даты", "дат") + '</summary>' +
      '<ul class="planlist">' + dates.map(function(k){
        var d = new Date(k + "T12:00:00");
        return '<li>' + WD_SHORT[d.getDay()].toLowerCase() + ', ' +
          k.split("-").reverse().join(".") + (f.time ? ' — ' + esc(f.time) : "") + '</li>';
      }).join("") + '</ul></details>';
    h += f.time
      ? '<div class="admrow"><button class="rbtn check" data-act="fics">📅 Добавить в календарь</button></div>' +
        '<p class="dim">Скачается файл для Календаря на маке и айфоне: повтор по выбранным дням, ' +
        'напоминание за полчаса, каникулы исключены. ⚠️ Напоминает Календарь, а не тренажёр — ' +
        'сам тренажёр в закрытой вкладке разбудить некому.</p>'
      : '<p class="dim">Чтобы выгрузить в календарь, задайте время занятия выше: ' +
        'событие без часа календарь принять не может.</p>';
  }

  h += '</div>';   /* ← конец карточки «Когда занимаемся» */

  /* ---------- карточка 3: редкое ----------
     ⚠️ Каникулы, потолок дня и галочка отчётов трогают раз в полгода, а места
     занимали столько же, сколько дни и час. Правило постепенного раскрытия:
     показывать всё сразу — значит не показывать ничего. Свёрнуто, но НЕ
     спрятано: заголовок называет, что внутри, и текст остаётся в странице
     (поиск по экрану его находит). */
  h += '<div class="card"><details class="plandet"><summary>' +
    '<b>Паузы и границы</b> — каникулы, потолок экранного времени, отчёты</summary>' +
    брКаникулы;

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

  /* ⚠️ Здесь была галочка «Получать отчёты», и она НИЧЕМ не управляла —
     текст рядом сам это признавал. Орган управления без действия — § 4.35:
     человек переключает и думает, что что-то изменил. Снята 13.09.2026;
     поле frame.report в модели осталось — оно понадобится, когда появится
     отправка, и его слияние стережёт [рамка]. Пока — просто правда словами. */
  h += '<div class="admlbl">Отчёты</div>' +
    '<p class="dim">Отчёт о занятиях показывается здесь, в кабинете, на вкладке «Отчёт». ' +
    'Писем мы не шлём: почты и телефона не спрашиваем.</p></details></div>';

  return h;
}
/* Единая дверь в кабинет по #admin. Куда именно — решает состояние устройства:
   — обычное устройство → предложить сделать его кабинетом (или так и уйти);
   — кабинет, но замок закрыт → спросить пароль;
   — кабинет и замок открыт → список учеников. */
function screenAdminHome(){
  /* Дверь решается по ПАРОЛЮ, а не по флагу роли: на устройство, где мы сейчас
     в роли родителя/ученика, можно вернуться админом — пароль-то остался. */
  if (!adminHasPass()) return screenAdminSetup();
  if (!adminUnlocked()) return screenAdminLogin();
  becomeAdmin();                 /* войти админом = сделать админа активной ролью */
  return screenKids();
}
/* Свод карты экзаменов: сколько номеров закрыто задачами, а сколько нет.
   ⚠️ Считается по той же таблице и той же функцией, что и сама карта
   (js/exams.js), а не переписывается числами. Число, записанное руками,
   разойдётся с делом в первый же день наполнения — а стоять оно будет на
   вывеске, где ошибка дороже всего. */
function examTally(id){
  var ex = (window.EXAMS || {})[id];
  if (!ex) return null;
  var t = EXAMS.tally(ex, algoCountIn);
  return { id: id, em: ex.em, title: ex.title, full: ex.full, total: ex.total,
           year: ex.year, есть: t.yes + t.part, нет: t.soon + t.no };
}
/* Подвал дома — один на все роли. Заведён по жалобе фаундера 06.09.2026,
   повторённой дважды: «жму на логотип и всё то же самое». Логотип исправен,
   он ведёт домой; дыра была в том, что из дома нет двери на вывеску. Первый
   раз я поставил её только в детский дом — а у фаундера устройство родителя,
   и для него ничего не изменилось. Поэтому теперь одна функция и три вызова:
   карта миров, кабинет родителя, кабинет репетитора. */
/* ⚠️ Второй строкой подвала — дорога НА САЙТ, и до 1.132.0 её не было вовсе:
   страницы витрины существовали, лежали в sitemap, а попасть на них из
   продукта было нельзя ни одним нажатием. Страница, на которую нет ни одной
   ссылки изнутри, для человека не существует, а для поисковика — тем более.

   Почему именно здесь, а не вкладкой наверху: вкладок три и они детские, а
   это дорога для ВЗРОСЛОГО, который взял устройство ребёнка (см. пояснение к
   подвалу выше). Проверка [устройство] стережёт «три вкладки и пять
   инструментов, и ничего больше» — четвёртую добавлять нельзя.

   ⚠️ Ссылки ОТНОСИТЕЛЬНЫЕ и без ведущей косой черты. Сайт живёт по адресу
   вида .../kodokvest/, и «/vitrina/» увело бы в корень домена, то есть в
   никуда. После переезда на свой домен относительные тоже верны.

   Это настоящие ссылки, а не кнопки: человек вправе открыть их в новой
   вкладке, а из приложения он при этом уходит по-настоящему — страницы
   витрины лежат вне его. */
function aboutFootHTML(){
  return '<div class="landfoot"><button class="linkbtn" data-goabout="1">' +
    '🐍 О тренажёре: что это, сколько уроков и что видит взрослый</button>' +
    '<div class="footlinks"><span>Взрослому:</span> ' +
      '<a href="vitrina/">сайт Фионики</a> · ' +
      '<a href="repetitoru/">репетитору</a> · ' +
      '<a href="semeynoe-obuchenie/">семейное обучение</a> · ' +
      '<a href="individualnyi-proekt/">индивидуальный проект</a> · ' +
      '<a href="kontakty/">контакты</a></div></div>';
}
function wireAboutFoot(box){
  (box || document).querySelectorAll("[data-goabout]").forEach(function(b){
    b.onclick = screenAbout;
  });
}
/* ================= вывеска: что это за тренажёр =================
   ⚠️ Уехала в js/screens-about.js — разрез архитектурного долга 17.09.2026
   (§ 2.5 RAZVITIE). Замер, договор и почему здесь остались карта экзаменов
   и подвал — в шапке того файла. Всё, что модуль берёт, объявлено ВЫШЕ по
   файлу или поднимается как функция; сессия и прогресс — вызовами (§ 4.5). */
var ABOUT = KVSCREENS.about({
  app: app, esc: esc, plural: plural, hl: hl, HLRE: HLRE, errHTML: errHTML,
  animateTurtle: animateTurtle, makeEditor: makeEditor, certList: certList,
  enterScreen: enterScreen, refreshTop: refreshTop, trainCards: trainCards,
  screenWorlds: screenWorlds, screenRoles: screenRoles, screenProverka: screenProverka,
  openLesson: openLesson, openExamMap: openExamMap, examTally: examTally,
  serverOn: serverOn, myCode: myCode, doLogin: doLogin, becomeKid: becomeKid,
  isAdminDevice: isAdminDevice, isParentDevice: isParentDevice,
  S: function(){ return S; },
  newSession: function(v){ session = v; return v; }
});
var screenAbout = ABOUT.screenAbout, aboutCounts = ABOUT.aboutCounts,
    landNums = ABOUT.landNums, landLiveCode = ABOUT.landLiveCode,
    landSwipeInit = ABOUT.landSwipeInit, SWIPE_ROWS = ABOUT.SWIPE_ROWS,
    LAND_DEMO_OK = ABOUT.LAND_DEMO_OK, LAND_DEMO_BAD = ABOUT.LAND_DEMO_BAD,
    landDemoHTML = ABOUT.landDemoHTML, landDemoRun = ABOUT.landDemoRun,
    landWarmRender = ABOUT.landWarmRender, landWarms = ABOUT.landWarms;
/* ⚠️ Живых плиток-кнопок в кабинете больше нет — они прожили один день
   (1.103.0). Плитки дублировали навигацию и карточки на тех же экранах, а
   плитки-указатели не убирали прокрутку, только удлиняли её на себя. Экраны
   кабинета разложены по вкладкам (admnav, kidnav), плитки остались только
   МАКЕТОМ на вывеске (lkMockHTML): там они показывают, что кабинет умеет.
   Разбор — docs/pravila-sajta.md § 13. */
/* ===== одна навигация на все экраны кабинета =====
   Экранов у репетитора три — «Ученики», «Группа», «Панель», — и до 1.103.0
   попасть в «Группу» можно было только набрав адрес с #group: ссылки на неё
   не стояло ни на одном экране, включая тот, с которого кабинет начинается.
   Полоса стоит на всех трёх и всегда показывает, где ты сейчас. */
var ROOM_TABS = [["kids","👥 Ученики"], ["group","👨‍🏫 Группа"], ["admin","🔐 Панель"]];
function roomNavHTML(cur){
  /* ⚠️ Только на устройстве-кабинете. «Панель репетитора» открывается по
     паролю и с обычного устройства родителя тоже — вести его оттуда в «Моих
     учеников» некуда: списка учеников у него нет, и пустой экран читался бы
     как поломка. Дорога в группу у него остаётся карточкой в самой панели. */
  if (!isAdminDevice()) return "";
  /* ⚠️ Строка под вкладками заведена 08.09.2026 по жалобе фаундера: «либо это
     четвёртый личный кабинет, либо непонятно, что это». Жалоба точная —
     вкладки назывались по своему устройству («Панель»), а не по делу, и
     человек честно не мог понять, три это кабинета или один. Кабинет ОДИН,
     и теперь это написано словами, а не подразумевается. Роли по-прежнему
     три: ученик, родитель, репетитор, — и вкладка кабинета ролью не
     является. */
  return '<div class="roomnav">' + ROOM_TABS.map(function(t){
    return '<button' + (t[0] === cur ? ' class="on"' : '') + ' data-room="' + t[0] + '">' +
      t[1] + '</button>';
  }).join("") + '</div>' +
  '<p class="roomhint">Это <b>один кабинет</b> и три его вкладки, а не три разных входа: ' +
  '<b>Ученики</b> — кого вы ведёте с этого устройства, имена и ссылки; ' +
  '<b>Группа</b> — все ученики сразу, с сервера, по ключу репетитора; ' +
  '<b>Панель</b> — служебное: обзор, сервер, звёзды и перенос прогресса файлом.</p>';
}
function wireRoomNav(box){
  (box || document).querySelectorAll("[data-room]").forEach(function(b){
    b.onclick = function(){
      var k = b.getAttribute("data-room");
      if (k === "group") return screenGroup();
      if (k === "admin") return screenAdmin();
      return screenKids();
    };
  });
}

/* ===== выбор роли на ОБЩЕМ компьютере =====
   На личных устройствах этот экран не нужен: планшет ребёнка открывается по
   своей ссылке в тренажёр, мак взрослого — в кабинет, телефон родителя — в свой.
   Но за одним компьютером могут по очереди сесть трое, и тогда нужен вход:
   три двери, у каждой — свой ключ. Честно про ключи: настоящий пароль только у
   администратора (это его устройство). Ученик и родитель входят по КОДУ ребёнка —
   на статическом сайте другого «пароля» для них нет, и код здесь и есть доступ. */
function screenRoles(){
  enterScreen("home", "roles");
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">общий компьютер</div>' +
    '<h1>🐍 Фионика — кто занимается?</h1></div></div>' +
    '<p class="lede">Выберите, чей это заход. На своём личном устройстве этот экран ' +
    'не появляется — там сразу открывается нужное.</p>' +
    '<div class="rolegrid">' +
      '<button class="rolecard" data-role="kid"><span class="roleico">🎒</span>' +
        '<b>Я ученик</b><span class="dim">Заниматься. Нужен код или ссылка от учителя.</span></button>' +
      '<button class="rolecard" data-role="parent"><span class="roleico">👨‍👩‍👦</span>' +
        '<b>Я родитель</b><span class="dim">Смотреть занятия своего ребёнка и ставить расписание.</span></button>' +
      /* ⚠️ Роль называется по делу, а не по правам. Решение фаундера
         08.09.2026: «может вообще убрать название администратора? пусть это
         и будет ЛК школы или репетитора, если по сути одно и то же». По сути
         одно и то же и есть: дверь одна, пароль один, экраны одни. Слово
         «администратор» осталось от ранних версий и создавало четвёртый
         кабинет, которого не существует. */
      '<button class="rolecard" data-role="admin"><span class="roleico">👨‍🏫</span>' +
        '<b>Я репетитор или школа</b><span class="dim">Ученики, ссылки, отчёты и настройки. ' +
        'Вход по паролю.</span></button>' +
    '</div>' +
    /* Если роль у устройства уже есть, а сюда зашли кнопкой «Сменить роль» —
       нужна дорога обратно, иначе передумавший окажется заперт на этом экране. */
    ((isAdminDevice() || isParentDevice() || myCode() || S.name)
      ? '<div class="pager"><button class="bigbtn ghost" data-role="stay">← Остаться как есть</button></div>'
      : '');
  app.querySelectorAll("[data-role]").forEach(function(b){
    b.onclick = function(){
      var r = b.getAttribute("data-role");
      if (r === "stay"){                 /* вернуться в свою нынешнюю роль */
        if (isAdminDevice()) return screenAdminHome();
        if (isParentDevice()) return screenParent();
        return screenWorlds();
      }
      if (r === "admin") return screenAdminHome();
      if (r === "kid") return screenKidLogin();
      if (r === "parent") return screenParentLogin();
    };
  });
  refreshTop();
}
/* Вход ученика на общем компьютере: по коду, либо «я новенький» — регистрация. */
function screenKidLogin(){
  enterScreen("home", "kidlogin");
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">вход ученика</div><h1>🎒 Я ученик</h1></div></div>' +
    '<div class="card"><h3>У меня есть код</h3>' +
      '<p class="dim">Код или ссылку дал учитель. Впиши код — откроется твой тренажёр с твоим прогрессом.</p>' +
      '<div class="admgate"><input type="text" id="klcode" placeholder="например, roman-3f7a" ' +
        'autocomplete="off" spellcheck="false"><button class="rbtn check" id="klgo">Войти</button></div>' +
      '<div class="msg" id="klmsg"></div>' +
      /* ⚠️ Дверь «не помню код» стоит прямо здесь, а не в помощи: ищут её
         ровно в ту минуту, когда код не вспоминается, и уводить человека в
         инструкцию в эту минуту — значит потерять его. */
      '<p class="dim" style="margin-top:10px"><button class="linkbtn" id="kllost">Не помню код</button></p></div>' +
    '<div class="card"><h3>Я тут впервые</h3>' +
      '<p class="dim">Кода ещё нет — заведём новый профиль по имени.</p>' +
      '<div class="admrow"><button class="rbtn sec" id="klnew">Завести профиль</button></div></div>' +
    '<div class="pager"><button class="bigbtn ghost" id="klback">← Назад</button></div>';
  var msg = document.getElementById("klmsg"), inp = document.getElementById("klcode");
  function go(){
    becomeKid();                 /* вход учеником снимает роли взрослого (пароль цел) */
    doLogin(inp.value, function(err){
      msg.className = "msg show bad";
      msg.innerHTML = "<b>Не вышло</b>" + esc(err);
    });
  }
  document.getElementById("klgo").onclick = go;
  inp.addEventListener("keydown", function(e){ if (e.key === "Enter") go(); });
  document.getElementById("klnew").onclick = function(){ becomeKid(); screenRegister(); };
  (function(){ var b = document.getElementById("kllost"); if (b) b.onclick = screenLostCode; })();
  document.getElementById("klback").onclick = screenRoles;
  inp.focus();
  refreshTop();
}
/* ================= экран: не помню код =================
   ⚠️ Самый честный экран продукта, и написан он ради одного: НЕ ОБЕЩАТЬ
   восстановления, которого нет. Аккаунта здесь нет — есть код ученика, и мы
   сознательно не спрашиваем ни почты, ни телефона (это обещание на вывеске и
   причина, по которой продуктом можно пользоваться без согласия на обработку
   персональных данных ребёнка). Обратная сторона ровно одна: искать чужой
   прогресс нам не по чему. Публичный поиск «найди мой код» завести нельзя
   тем более: кто знает код — видит занятия, и такая страница выдавала бы
   чужие коды любому желающему.

   Поэтому здесь не форма восстановления, а три настоящие дороги, по убыванию
   вероятности, и честный конец, если ни одна не сработала. */
function screenLostCode(){
  enterScreen("home", "lostcode");
  var have = (typeof Cloud !== "undefined") ? Cloud.myCode() : "";
  var h = '<div class="lvlhead"><div><div class="idx">вход ученика</div>' +
    '<h1>🔑 Не помню код</h1></div></div>';

  /* Дорога нулевая и самая частая: код никуда не девался, он лежит в этом
     браузере, а ребёнок просто его не видел. Спрашивать в этом случае «где
     твоя карточка» — издевательство. */
  if (have){
    h += '<div class="card"><h3>Он на месте</h3>' +
      '<p>Этот браузер помнит код. Вот он:</p>' +
      '<div class="codebox"><code id="lcode">' + esc(have) + '</code>' +
      '<button class="rbtn sec" id="lccopy">Скопировать</button>' +
      '<button class="rbtn sec" id="lcprint">🖨 Карточка</button></div>' +
      '<p class="dim">Запиши его или распечатай карточку — тогда он не потеряется, ' +
      'даже если браузер почистят.</p>' +
      '<div class="winrow"><button class="bigbtn" id="lcgo">Войти под этим кодом</button></div></div>';
  }

  h += '<div class="card"><h3>Где искать, если браузер не помнит</h3><ul class="trrules">' +
    '<li><b>У того, кто тебя записал.</b> Если занимаешься с репетитором или в кружке — ' +
    'у него в кабинете есть список учеников с кодами, и он может распечатать карточку. ' +
    'У родителя, который смотрит твои занятия, код тоже есть.</li>' +
    '<li><b>Ссылка-вход.</b> Она выглядит как адрес тренажёра с хвостом ' +
    '<code>?kid=твой-код</code>. Поищи её в истории браузера, в закладках или там, ' +
    'куда её сохраняли: открыть такую ссылку — уже войти.</li>' +
    '<li><b>Карточка доступа.</b> Лист с именем и кодом, если его печатали: в дневнике, ' +
    'в папке с документами, на фотографии у родителя.</li>' +
    '</ul></div>';

  /* ⚠️ Здесь кончается помощь и начинается честность. Ни «напишите нам», ни
     «оставьте почту»: почты у нас нет и ручной поддержки не будет — это
     требование автономности, а не лень. Врать «попробуйте восстановить»
     дороже, чем сказать прямо. */
  h += '<div class="card"><h3>А если код никто не сохранил</h3>' +
    '<p>Тогда прогресс не вернуть, и это честный ответ, а не отговорка. ' +
    'Тренажёр не спрашивает ни почты, ни телефона, и по имени найти твои занятия ' +
    'нельзя: имя ребёнка на сервер вообще не уходит. Поиска «найди мой код» здесь ' +
    'нет и не будет — по коду видно занятия, и такая страница отдавала бы чужие коды ' +
    'кому угодно.</p>' +
    '<p class="dim">Можно завести новый профиль и начать заново — уроки и задачи те же, ' +
    'а звёзды и решённое останутся на старом коде. Обидно, но лучше, чем ждать ответа, ' +
    'которого не будет.</p>' +
    '<div class="winrow"><button class="bigbtn ghost" id="lcnew">Завести новый профиль</button></div></div>';

  h += '<div class="pager"><button class="bigbtn ghost" id="lcback">← Назад ко входу</button></div>';
  app.innerHTML = h;

  var cp = document.getElementById("lccopy");
  if (cp) cp.onclick = function(){ copyText(have, cp); markCodeSaved(); };
  var pr = document.getElementById("lcprint");
  if (pr) pr.onclick = function(){ markCodeSaved(); openAccessCard(have, myName()); };
  var go = document.getElementById("lcgo");
  if (go) go.onclick = function(){ becomeKid(); doLogin(have, function(){}); };
  document.getElementById("lcnew").onclick = function(){ becomeKid(); screenRegister(); };
  document.getElementById("lcback").onclick = screenKidLogin;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* Вход родителя на общем компьютере: по коду ребёнка. */
function screenParentLogin(){
  enterScreen("home", "parentlogin");
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">вход родителя</div><h1>👨‍👩‍👦 Я родитель</h1></div></div>' +
    '<div class="card"><h3>Код ребёнка</h3>' +
      '<p class="dim">Учитель дал ссылку или код ребёнка. Впишите код — откроется кабинет с расписанием ' +
      'и отчётом по нему. Чужого прогресса вы не увидите.</p>' +
      '<div class="admgate"><input type="text" id="plcode" placeholder="например, roman-3f7a" ' +
        'autocomplete="off" spellcheck="false"><button class="rbtn check" id="plgo">Войти</button></div>' +
      '<div class="msg" id="plmsg"></div>' +
      '<p class="dim" style="margin-top:12px">⚠️ Кто знает код — видит занятия ребёнка. Это тот же код, ' +
      'по которому он входит в тренажёр; никому лишнему его не показывайте.</p></div>' +
    '<div class="pager"><button class="bigbtn ghost" id="plback">← Назад</button></div>';
  var msg = document.getElementById("plmsg"), inp = document.getElementById("plcode");
  function go(){
    var v = (typeof Cloud !== "undefined") ? Cloud.validCode(inp.value) : null;
    if (!v){
      msg.className = "msg show bad";
      msg.innerHTML = "<b>Код не подходит</b>3–32 знака: маленькие латинские буквы, цифры, дефис.";
      return;
    }
    if (!serverOn()){
      msg.className = "msg show bad";
      msg.innerHTML = "<b>Сервер не подключён</b>Без него занятия ребёнка посмотреть неоткуда.";
      return;
    }
    becomeParent(v, "");
    screenParent(v);
  }
  document.getElementById("plgo").onclick = go;
  inp.addEventListener("keydown", function(e){ if (e.key === "Enter") go(); });
  document.getElementById("plback").onclick = screenRoles;
  inp.focus();
  refreshTop();
}
/* ===== пароль кабинета придумывает первый вошедший (13.09.2026, RAZVITIE § 2.6) =====
   Настоящей авторизации у сайта в браузере нет и не будет: проверять пароль
   некому. Значит пароль ставит тот, кто первым открыл кабинет или панель, — и
   на детском планшете это может быть сам ребёнок («⇄ Сменить роль» → «Я
   репетитор»): тогда у него «Открыть все уроки» и «Сбросить весь прогресс».
   Чинится словами и одной отметкой: экран говорит это прямо, а если на
   устройстве уже занимался ученик — пароль не ставится без «это моё
   устройство, а не ребёнка». Отметка не защита, а остановка: взрослый,
   заводящий кабинет на планшете сына, прочтёт, почему не стоит. */
function kidWorkHere(){
  return Object.keys(S.stars || {}).length;
}
function passFirstHTML(){
  var n = kidWorkHere();
  var h = '<p class="dim">Пароль придумывает тот, кто первым сюда вошёл. Если это устройство ' +
    'ребёнка — кабинет здесь не заводите: заведите его на своём телефоне или компьютере.</p>';
  if (n)
    h += '<div class="warnline">⚠️ На этом устройстве уже занимается ученик: сдано ' + n + ' ' +
      plural(n, "урок", "урока", "уроков") + '. Кто поставит здесь пароль, тот получит «Открыть все уроки» ' +
      'и «Сбросить весь прогресс» — в том числе сам ребёнок.</div>' +
      '<label class="ownchk"><input type="checkbox" id="admown"> Это моё устройство, а не ребёнка</label>';
  return h;
}
/* пароль можно ставить: либо ученика здесь нет, либо взрослый отметил, что устройство его */
function passFirstOk(msg){
  if (!kidWorkHere()) return true;
  var c = document.getElementById("admown");
  if (c && c.checked) return true;
  if (msg){
    msg.className = "msg show bad";
    msg.innerHTML = "<b>Сначала отметьте, чьё это устройство</b>Здесь уже занимается ученик. " +
      "Если устройство его — заведите кабинет на своём.";
  }
  return false;
}
function screenAdminSetup(){
  enterScreen("home", "adminsetup");
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">кабинет взрослого</div>' +
    '<h1>👨‍👩‍👦 Сделать это устройство кабинетом</h1></div></div>' +
    '<p class="lede">Этот браузер станет кабинетом взрослого: список учеников, расписание и отчёты. ' +
    'Уроков и звёзд здесь не будет — заниматься дети будут на своих устройствах, каждый по своей ссылке.</p>' +
    '<div class="card"><h3>Придумайте пароль кабинета</h3>' +
      '<p class="dim">Он хранится только в этом браузере и никуда не отправляется. ' +
      'Нужен, чтобы ребёнок, взявший ваш компьютер, не открыл кабинет из любопытства.</p>' +
      passFirstHTML() +
      '<div class="admgate">' +
        '<input type="password" id="apass1" placeholder="пароль" autocomplete="new-password" spellcheck="false">' +
        '<input type="password" id="apass2" placeholder="ещё раз" autocomplete="new-password" spellcheck="false">' +
        '<button class="rbtn check" id="apassgo">Готово</button>' +
      '</div><div class="msg" id="apassmsg"></div>' +
      '<p class="dim" style="margin-top:12px">⚠️ Честно: это защита от любопытства, а не настоящая ' +
      'авторизация. Сайт работает целиком в браузере, проверять пароль на сервере некому. ' +
      'Забыли пароль — придётся очистить данные сайта в браузере и завести кабинет заново.</p>' +
    '</div>' +
    '<div class="pager"><button class="bigbtn ghost" id="anotnow">← Не сейчас</button></div>';
  var msg = document.getElementById("apassmsg");
  document.getElementById("apassgo").onclick = function(){
    var a = document.getElementById("apass1").value, b = document.getElementById("apass2").value;
    if (String(a).length < 4){
      msg.className = "msg show bad";
      msg.innerHTML = "<b>Слишком короткий</b>Хотя бы четыре знака.";
      return;
    }
    if (a !== b){
      msg.className = "msg show bad";
      msg.innerHTML = "<b>Не совпадает</b>Второй пароль отличается от первого.";
      return;
    }
    if (!passFirstOk(msg)) return;
    adminPassSet(a, true);
    adminUnlock();
    becomeAdmin();
    screenKids();
  };
  document.getElementById("anotnow").onclick = goHome;
  refreshTop();
}
/* Вход в уже заведённый кабинет. */
function screenAdminLogin(){
  enterScreen("home", "adminlogin");
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">кабинет взрослого</div>' +
    '<h1>🔐 Кабинет</h1></div></div>' +
    '<p class="lede">Введите пароль кабинета.</p>' +
    '<div class="card"><div class="admgate">' +
      '<input type="password" id="apass" placeholder="пароль" autocomplete="current-password" spellcheck="false">' +
      '<button class="rbtn check" id="apgo">Войти</button>' +
    '</div><div class="msg" id="apmsg"></div></div>';
  var msg = document.getElementById("apmsg"), inp = document.getElementById("apass");
  function go(){
    if (adminPassOk(inp.value)){ adminUnlock(); becomeAdmin(); return screenKids(); }
    msg.className = "msg show bad";
    msg.innerHTML = "<b>Пароль не подошёл</b>Проверьте раскладку и большие буквы.";
    inp.value = ""; inp.focus();
  }
  document.getElementById("apgo").onclick = go;
  inp.addEventListener("keydown", function(e){ if (e.key === "Enter") go(); });
  inp.focus();
  refreshTop();
}
/* Главный экран кабинета: список учеников. */
function screenKids(note){
  enterScreen("home", "kids");
  kidTarget = null;
  var kids = kidsList();
  /* ⚠️ note — только строка: backTarget отдаёт screenKids значением, и кнопка
     «назад» передала бы сюда событие клика */
  note = (typeof note === "string") ? note : "";
  var h = '<div class="lvlhead"><div><div class="idx">кабинет взрослого</div>' +
    '<h1>👨‍👩‍👦 Мои ученики</h1></div></div>' +
    roomNavHTML("kids") +
    '<p class="lede">Каждому ученику — своя ссылка и своё устройство. Ребёнок кабинета не видит.</p>';

  if (!serverOn())
    h += '<p class="warnline">⚠️ Сервер не подключён: адрес не указан в <code>js/cloud-config.js</code>. ' +
         'Без него ученики не смогут заниматься на своих устройствах.</p>';

  if (note) h += '<div class="note"><b>Готово</b>' + esc(note) + '</div>';
  /* Карточка файла ОДНА, меняется только её место: пока список не сохранён
     (три ученика и больше), она стоит первой и говорит, почему; сохранили —
     уходит под список. Две кнопки «сохранить» в двух местах были бы двумя
     дорогами к одному действию (pravila-sajta.md § 13). */
  var fileFirst = kidsSaveNeeded();
  if (fileFirst) h += kidsFileCardHTML(true);

  /* ⚠️ Никаких плиток-дублей. День 1.103.0: под навигацией стояла сетка
     плиток, где «Группа» и «Панель» повторяли навигацию строчкой выше, а
     «Завести ученика» повторял карточку «Добавить ученика» строчкой ниже.
     Вопрос фаундера 08.09.2026: «зачем кнопка, если ниже есть добавить?» —
     и ответа не нашлось. Одна дорога к одному действию. */
  h += '<div class="card" id="kidadd"><h3>Добавить ученика</h3>' +
    '<p class="dim">Впишите имя — тренажёр придумает код и даст ссылку. Ссылку отправьте ребёнку: ' +
    'открыв её, он сразу окажется в тренажёре под своим именем.</p>' +
    '<div class="admgate">' +
      '<input type="text" id="kidname" placeholder="имя ученика" autocomplete="off" spellcheck="false">' +
      '<button class="rbtn check" data-kact="add">Завести</button>' +
    '</div><div class="msg" id="kidmsg"></div></div>';

  /* ⚠️ Вторая карточка, а не вторая кнопка в первой: это РАЗНЫЕ действия.
     «Завести» придумывает новый код, «Вернуть» принимает готовый. Смешать их
     в одну форму — значит однажды завести второго пустого ученика тому, у
     кого уже есть прогресс. Ровно это и случилось 12.09.2026. */
  h += '<div class="card" id="kidback"><h3>Вернуть ученика по коду</h3>' +
    '<p class="dim">Если ученик уже занимался — у него есть код, и прогресс лежит на сервере. ' +
    'Впишите код, и ученик вернётся в список вместе со всеми занятиями. ' +
    'Код показан у ребёнка в профиле. ⚠️ Не заводите его заново по имени: ' +
    'новый код — это новый ученик с нуля.</p>' +
    '<div class="admgate">' +
      '<input type="text" id="kidcode" placeholder="код, например roman-3f7a" autocomplete="off" spellcheck="false" maxlength="32">' +
      '<input type="text" id="kidcodename" placeholder="имя для вашего списка" autocomplete="off" spellcheck="false" maxlength="40">' +
      '<button class="rbtn sec" data-kact="attach">Найти и вернуть</button>' +
    '</div><div class="msg" id="kidbackmsg"></div></div>';

  if (!kids.length){
    h += '<div class="note"><b>Пока ни одного ученика</b>Заведите первого — это займёт полминуты.</div>';
  } else {
    h += '<div class="kidlist" id="kidlist">' + kids.map(function(k){
      return '<div class="kidcard"><div class="kidmain">' +
        '<b>' + esc(k.name || k.code) + '</b>' +
        '<span class="kidcode">' + esc(k.code) + '</span></div>' +
        '<div class="kidacts">' +
          '<button class="rbtn sec" data-kact="open" data-code="' + esc(k.code) + '">Расписание и отчёт →</button>' +
          '<button class="rbtn sec" data-kact="link" data-code="' + esc(k.code) + '">Скопировать ссылку</button>' +
          '<button class="rbtn sec" data-kact="drop" data-code="' + esc(k.code) + '">Убрать</button>' +
        '</div></div>';
    }).join("") + '</div>';
  }
  if (!fileFirst) h += kidsFileCardHTML(false);
  /* В подвале остаётся только то, что уводит ИЗ кабинета: сами инструменты
     переехали наверх, в плитки. ⚠️ «Выйти» и «больше не кабинет» — разные
     вещи и разные кнопки: первое — выйти из комнаты, второе — съехать. */
  h += '<div class="pager">' +
    '<button class="bigbtn ghost" data-kact="leave">🚪 Выйти из кабинета</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" data-kact="role">⇄ Сменить роль</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" data-kact="off">Это устройство больше не кабинет</button></div>' +
    aboutFootHTML();
  app.innerHTML = h;
  wireAboutFoot(app);
  wireRoomNav(app);

  var msg = document.getElementById("kidmsg");
  app.querySelectorAll("[data-kact]").forEach(function(b){
    b.onclick = function(){
      var act = b.getAttribute("data-kact"), code = b.getAttribute("data-code");
      if (act === "add"){
        var nm = document.getElementById("kidname").value;
        var kid = kidAdd(nm);
        if (!kid){
          msg.className = "msg show bad";
          msg.innerHTML = "<b>Нужно имя</b>Хотя бы две буквы — по нему вы будете узнавать ученика в списке.";
          return;
        }
        return screenKid(kid.code, "Ученик заведён. Отправьте ему ссылку — она уже открыта.");
      }
      if (act === "attach"){
        var raw = (document.getElementById("kidcode") || {}).value || "";
        var nm2 = (document.getElementById("kidcodename") || {}).value || "";
        var bm = document.getElementById("kidbackmsg");
        var v = (typeof Cloud !== "undefined" && Cloud.validCode(raw)) || "";
        if (!v){
          bm.className = "msg show bad";
          bm.innerHTML = "<b>Это не похоже на код</b>Код — от трёх до тридцати двух знаков: " +
            "маленькие латинские буквы, цифры, дефис и подчёркивание. Посмотрите его " +
            "у ребёнка в профиле и перепишите точно.";
          return;
        }
        if (kidGet(v)){
          bm.className = "msg show bad";
          bm.innerHTML = "<b>Этот ученик уже в списке</b>Он ниже, под кодом <code>" + esc(v) + "</code>.";
          return;
        }
        /* ⚠️ Сначала СПРАШИВАЕМ сервер, и только потом добавляем. Опечатка в
           коде завела бы в список пустого ученика, который выглядит как
           настоящий, — а это ровно та беда, от которой мы тут и лечим. */
        if (!serverOn()){
          var k0 = kidAttach(v, nm2);
          return screenKid(k0.code, "Ученик добавлен. ⚠️ Сервер не подключён — " +
            "проверить, есть ли под этим кодом занятия, было нечем.");
        }
        bm.className = "msg show"; bm.innerHTML = "<b>Ищу на сервере…</b>";
        Cloud.load(v).then(function(r){
          if (!r || !r.found || !r.data){
            bm.className = "msg show bad";
            bm.innerHTML = "<b>На сервере нет ученика с кодом «" + esc(v) + "»</b>" +
              "Проверьте код по профилю ребёнка. Ничего не добавлено и не испорчено.";
            return;
          }
          var solved = Object.keys(r.data.stars || {}).length;
          var kid = kidAttach(v, nm2);
          screenKid(kid.code, solved
            ? "Ученик вернулся в список: на сервере " + solved + " " +
              plural(solved, "сданный урок", "сданных урока", "сданных уроков") + "."
            : "Ученик вернулся в список. Сданных уроков на сервере пока нет.");
        }, function(err){
          bm.className = "msg show bad";
          bm.innerHTML = "<b>Сервер не ответил</b>" + esc(err.message || String(err)) +
            " Ничего не добавлено — попробуйте ещё раз.";
        });
        return;
      }
      if (act === "open") return screenKid(code);
      if (act === "leave") return leaveRoom();
      if (act === "role") return screenRoles();
      if (act === "link") return copyText(kidLink(code), b);
      if (act === "drop"){
        var k = kidGet(code);
        if (!confirm("Убрать «" + ((k && k.name) || code) + "» из списка?\n\n" +
                     "Занятия ребёнка и его прогресс останутся на сервере — пропадёт только строка " +
                     "в вашем списке.\n\nВернуть можно карточкой «Вернуть ученика по коду». " +
                     "Код этого ученика: " + code))
          return;
        kidDrop(code);
        return screenKids();
      }
      if (act === "off"){
        if (!confirm("Сделать это устройство обычным?\n\nКабинет и пароль будут забыты, " +
                     "список учеников тоже. На сервере ничего не изменится." +
                     (kidsList().length ? "\n\nСохраните список файлом раньше — иначе имена придётся вспоминать." : "")))
          return;
        adminDeviceOff();
        return screenWorlds();
      }
      if (act === "listsave"){
        if (!kidsList().length){
          fm.className = "msg show bad";
          fm.innerHTML = "<b>Сохранять пока нечего</b>В списке нет ни одного ученика.";
          return;
        }
        var d = new Date(), pad = function(n){ return (n < 10 ? "0" : "") + n; };
        var fname = "fionika-ucheniki-" + d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + ".json";
        if (!downloadText(fname, kidsListFileText(), null, "application/json")){
          fm.className = "msg show bad";
          fm.innerHTML = "<b>Браузер не дал сохранить файл</b>Попробуйте другой браузер на этом компьютере.";
          return;
        }
        var was = fileFirst;
        kidsListMarkSaved();
        if (was) return screenKids("Список сохранён файлом " + fname + " в папке загрузок.");
        fm.className = "msg show ok";
        fm.innerHTML = "<b>Список сохранён</b>Файл " + esc(fname) + " — в папке загрузок.";
        return;
      }
    };
  });
  var fileIn = document.getElementById("kidfilein"), fm = document.getElementById("kidfilemsg");
  if (fileIn) fileIn.onchange = function(){
    var f = fileIn.files && fileIn.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function(){ kidsListLoadText(String(rd.result || ""), fm); };
    rd.onerror = function(){
      fm.className = "msg show bad";
      fm.innerHTML = "<b>Файл не открылся</b>Попробуйте выбрать его ещё раз.";
    };
    rd.readAsText(f);
  };
  refreshTop();
}
/* Карточка «Список учеников файлом». warn — список ещё не сохранён. */
function kidsFileCardHTML(warn){
  var at = S.admin.kidsSavedAt ? new Date(S.admin.kidsSavedAt).toLocaleDateString("ru-RU") : "";
  return '<div class="card kidfile' + (warn ? " warn" : "") + '" id="kidfile">' +
    '<h3>' + (warn ? "⚠️ Сохраните список учеников файлом" : "Список учеников файлом") + '</h3>' +
    '<p class="dim">Имена учеников живут только в этом браузере — на сервер они не уходят. ' +
    'Сменили компьютер или почистили браузер — загрузите файл, и ученики вернутся со всеми занятиями. ' +
    'В файле имена и коды: храните его как список класса.' +
    (at && !warn ? ' Последний раз сохранён ' + esc(at) + '.' : "") + '</p>' +
    '<div class="admrow">' +
      '<button class="rbtn ' + (warn ? "check" : "sec") + '" data-kact="listsave">↓ Сохранить список файлом</button>' +
      '<label class="rbtn sec kidfilepick">↑ Загрузить из файла' +
        '<input type="file" id="kidfilein" accept=".json,application/json"></label>' +
    '</div><div class="msg" id="kidfilemsg"></div></div>';
}
/* Загрузка списка: разобрать, добавить, сказать словами, что произошло.
   Отдельно от обработчика файла — так её зовёт и тест, без FileReader. */
function kidsListLoadText(text, msgEl){
  var r = kidsListParse(text);
  if (r.error){
    if (msgEl){ msgEl.className = "msg show bad"; msgEl.innerHTML = "<b>Не получилось</b>" + esc(r.error); }
    return null;
  }
  var m = kidsListMerge(r.kids);
  var parts = [];
  if (m.added) parts.push("добавлено " + m.added + " " + plural(m.added, "ученик", "ученика", "учеников"));
  if (m.already) parts.push(m.already + " уже " + plural(m.already, "был", "были", "были") + " в списке");
  if (m.skipped) parts.push(m.skipped + " " + plural(m.skipped, "строка", "строки", "строк") + " без годного кода " +
    plural(m.skipped, "пропущена", "пропущены", "пропущено"));
  var said = parts.length ? parts.join(", ") : "в файле нет ни одного ученика";
  if (m.added){
    /* список целиком совпал с файлом — файл и есть сохранённая копия, и
       напоминать о нём незачем */
    var inFile = r.kids.map(function(k){ return (typeof Cloud !== "undefined" && Cloud.validCode(k.code)) || ""; });
    if (kidsList().every(function(k){ return inFile.indexOf(k.code) >= 0; })) kidsListMarkSaved();
    screenKids("Список загружен: " + said + ". Занятия подтянутся с сервера по коду.");
  } else if (msgEl){
    msgEl.className = "msg show" + (m.skipped && !m.already ? " bad" : " ok");
    msgEl.innerHTML = "<b>Ничего нового</b>" + esc(said.charAt(0).toUpperCase() + said.slice(1)) + ".";
  }
  return m;
}
/* Один ученик: ссылка, расписание (правится удалённо) и отчёт. */
function screenKid(code, note){
  enterScreen("home", "kid");
  var k = kidGet(code);
  if (!k) return screenKids();
  kidTarget = { code: code, name: k.name, data: null, dirty: false };
  /* Ссылки живут во вкладке «Доступ» (kidLinksHTML). Только что заведённому
     ученику открываем именно её: единственное, что сейчас нужно, — ссылка. */
  kidTab = note ? "link" : "";
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">ученик</div><h1>' + esc(k.name || code) + '</h1></div></div>' +
    (note ? '<div class="note"><b>Готово</b>' + esc(note) + '</div>' : "") +
    '<div id="kidbody"><p class="dim">Загружаю занятия с сервера…</p></div>' +
    '<div class="pager"><button class="bigbtn ghost" data-kback="1">← К списку учеников</button></div>';
  app.querySelectorAll("[data-kback]").forEach(function(b){
    b.onclick = function(){ kidTarget = null; screenKids(); };
  });
  refreshTop();
  kidLoad(code);
}
/* Забрать запись ребёнка с сервера и нарисовать расписание с отчётом. */
function kidLoad(code){
  var box = document.getElementById("kidbody");
  if (!serverOn()){
    if (box) box.innerHTML = '<p class="warnline">⚠️ Сервер не подключён — занятия этого ученика ' +
      'посмотреть неоткуда, и расписание ему не передать.</p>';
    return;
  }
  var seq = screenSeq;
  Cloud.load(code).then(function(r){
    if (screenStale(seq) || !kidTarget || kidTarget.code !== code) return;
    /* Ученик, который ещё ни разу не открывал ссылку, — это не ошибка, а
       нормальное начало: расписание ему можно поставить заранее. */
    kidTarget.data = ensureShape(r.found && r.data ? r.data : blankProgress());
    kidTarget.fresh = !(r.found && r.data);
    kidTarget.serverAt = r.serverAt || 0;
    /* с какой рамкой мы открылись — по ней kidSave поймёт, что её успели
       поменять с другого устройства, и не затрёт чужую правку молча */
    kidTarget.frameAt = frameShape(kidTarget.data.frame).setAt || 0;
    kidRender();
    kidWatch(code, seq);
  }, function(err){
    if (screenStale(seq)) return;
    var b = document.getElementById("kidbody");
    if (b) b.innerHTML = '<p class="warnline">⚠️ Не удалось забрать данные ученика: ' +
      esc(err.message || err) + '</p>';
  });
}
/* ===== карточка ученика и кабинет родителя: панель с вкладками =====
   Раньше всё лежало одной колонной — присутствие, рамка, домашка, заметка,
   отчёт, — восемь экранов прокрутки, и родитель не понимал, что где. Жалоба
   фаундера 08.09.2026: «нужна панель управления сверху, вкладки: открываешь,
   смотришь, меняешь». Теперь сверху вкладки, над ними — только «что он делает
   сейчас»: это единственное, что взрослый должен видеть всегда.
   ⚠️ Разделы НЕ перерисовываются при переключении: все отрисованы сразу,
   вкладка только прячет чужие (hidden). Так переключение мгновенно, а
   обработчики и наполовину заполненные поля (заметка, галочки домашки)
   не пропадают. */
/* Вкладки кабинета на устройстве ребёнка. Те же четыре смысла, что у
   карточки ученика: смотреть — настраивать — задавать — прочее. */
var ADULT_TABS = [
  ["rep",   "📊", "Отчёт"],
  ["frame", "🗓", "Расписание"],
  ["task",  "✉️", "Задание"],
  ["more",  "📚", "Разделы"]
];
var adultTab = "rep";
var KID_TABS = [
  ["rep",   "📊", "Отчёт"],
  ["work",  "📏", "Практика"],
  ["frame", "🗓", "Расписание"],
  ["hw",    "📮", "Домашка"],
  ["note",  "✍️", "Заметка"],
  ["link",  "🔗", "Доступ"]
];
/* ⚠️ «Практика» отделена от «Отчёта» 12.09.2026, когда в кабинет родителя
   доехали карта часов, замер занятий и запись авторства: во вкладке стало
   семь карточек — та самая простыня, от которой вкладки и заводились.
   Деление не произвольное, а по вопросу: «Отчёт» — ЧТО БЫЛО (неделя, о чём
   спросить, сообщение родителю, цифры), «Практика» — КАК ОН РАБОТАЕТ (когда
   садится, сколько уходит на урок, своими ли руками написано). */
/* ⚠️ «Доступ» был спрятан от родителя с пометкой «родителю раздавать нечего».
   Это оказалось неправдой, и дорогой: у родителя НИГДЕ не было видно кода
   ребёнка (в шапке при заданной подписи стоит имя, а не код), а экран «Не
   помню код» при этом обещает ребёнку: «у родителя, который смотрит твои
   занятия, код тоже есть». Есть — а показать было негде. Плюс родителю
   ссылка ребёнка нужна ровно тогда, когда её труднее всего достать: планшет
   сбросили, ребёнок вышел. Разбор трёх ролей, 12.09.2026.
   Кому что показывать внутри вкладки, решает kidLinksHTML: репетитор
   раздаёт, родитель хранит. */
var kidTab = "";
function kidPaneHTML(id, inner){
  return '<div class="kpane" data-kpane="' + id + '"' + (kidTab === id ? "" : " hidden") + '>' +
    inner + '</div>';
}
/* Ссылки и код — бывшая статичная карточка screenKid: теперь вкладка. */
function kidLinksHTML(code, mentor){
  var k = kidGet(code) || {};
  /* ⚠️ Код — ПЕРВЫМ и крупно, а не сноской внизу. Это единственная вещь, без
     которой прогресс ребёнка не найти ни с какого другого устройства, и
     единственная, которую взрослого просят сохранить у себя. Внизу мелким
     она стояла у репетитора — и у него же 12.09.2026 потерялся ученик. */
  var h = '<div class="card"><h3>🔑 Код ученика</h3>' +
    '<p class="dim">Главное, что стоит сохранить. По нему прогресс открывается с любого ' +
    'устройства; ни имени, ни почты мы не спрашиваем, и найти ребёнка иначе нечем.</p>' +
    '<div class="codebox"><code>' + esc(code) + '</code>' +
    '<button class="rbtn check" data-kd="ccopy">Скопировать код</button></div></div>';

  h += '<div class="card"><h3>Ссылка для ребёнка</h3>' +
    '<p class="dim">' + (mentor
      ? 'Отправьте её ребёнку и попросите открыть на его устройстве — один раз. ' +
        'Дальше он просто заходит на сайт, и это его тренажёр.'
      : 'Откройте её на устройстве ребёнка — один раз. Дальше он просто заходит на сайт, ' +
        'и это его тренажёр. Она же выручает, если планшет сбросили или ребёнок вышел.') +
    '</p>' +
    '<div class="codebox"><code>' + esc(kidLink(code)) + '</code>' +
    '<button class="rbtn sec" data-kd="copy">Скопировать</button></div>' +
    '<h3 style="margin-top:16px">Ссылка ' + (mentor ? 'для родителя' : 'на этот кабинет') + '</h3>' +
    '<p class="dim">' + (mentor
      ? 'Отправьте её родителю ученика. Открыв на своём устройстве, он получит кабинет ' +
        'с расписанием и отчётом по этому ребёнку — и только по нему.'
      : 'Откройте её на втором своём устройстве или отправьте второму родителю: ' +
        'получится такой же кабинет по этому ребёнку — и только по нему.') +
    '</p>' +
    '<div class="codebox"><code>' + esc(parentLink(code, k.name || parentLabel())) + '</code>' +
    '<button class="rbtn sec" data-kd="pcopy">Скопировать</button></div></div>';
  return h;
}
function kidRender(savedNote){
  var box = document.getElementById("kidbody");
  if (!box || !kidTarget || !kidTarget.data) return;
  var st = kidTarget.data;
  var mentor = (curPlace === "kid");
  var tabs = KID_TABS.slice();
  /* Стартовая вкладка: отчёт — если он есть; новому ученику показываем
     расписание, потому что это первое (и единственное) осмысленное действие. */
  if (!tabs.some(function(t){ return t[0] === kidTab; }))
    kidTab = kidTarget.fresh ? "frame" : "rep";

  var h = "";
  /* статус присутствия — НАД вкладками: «что он делает сейчас» и есть вопрос,
     с которым взрослый открыл карточку, и он виден с любой вкладки */
  h += '<div id="kidpresence">' + presenceDetailHTML(st, kidTarget.serverAt) + '</div>';
  /* ⚠️ Честно про пустоту (§ 2.6): до первого входа ребёнка живо только
     расписание, и взрослый открывает кабинет впервые ровно в этот момент.
     Молчание выглядело поломкой: «почему всё пустое?» */
  if (kidTarget.fresh)
    h += '<div class="note"><b>Ученик ещё не заходил</b>Ссылку он пока не открывал, поэтому ' +
         'кабинет почти пуст — это не поломка. Сейчас живо только расписание: поставьте его ' +
         'заранее, оно приедет к ученику при первом же входе. Отчёт, практика, домашка и ' +
         'заметка оживут после первого занятия.</div>';

  /* «Сейчас важно» — затык виден НАД вкладками, а не только внутри «Отчёта»
     (приём Khan Academy, замер 12.09.2026: docs/kabinet-benchmark-2026-09-12.md).
     С вкладками это стало нужнее, а не меньше: репетитор, открывший
     «Домашку», без этой строки не узнает, что ребёнок стоит. Плитки-числа
     сюда не ставим: вкладка «Отчёт» открывается первой и сама начинается с
     этих чисел — была бы копия строкой ниже (правило 1.103.0). */
  if (!kidTarget.fresh){
    var wf = weekFacts(st);
    if (wf.stuck.length){
      var stuckL = CURRICULUM.byId(wf.stuck[0].id);
      h += '<p class="cabnow">⛔ Сейчас важно: застрял на уроке «' +
        (stuckL ? esc(stuckL.title) : esc(wf.stuck[0].id)) +
        '» — разбор и что делать на вкладке «Отчёт».</p>';
    }
  }

  h += '<div class="ltabs kidnav" role="tablist">' + tabs.map(function(t){
    return '<button class="ltab' + (t[0] === kidTab ? " on" : "") + '" role="tab" data-ktab="' + t[0] + '"' +
      ' aria-selected="' + (t[0] === kidTab ? "true" : "false") + '">' +
      '<span class="lte">' + t[1] + '</span>' + t[2] + '</button>';
  }).join("") + '</div>';

  h += kidPaneHTML("rep",
    kidTarget.fresh
      ? '<div class="note"><b>Отчёта пока нет</b>Он появится после первого занятия ребёнка.</div>'
      : weekReportHTML(st) + askCardHTML(st) + oralCardHTML(st) + parentReportCardHTML() +
        '<h3 class="sect">📊 Как идут занятия</h3>' + statsGridHTML(st));

  h += kidPaneHTML("work",
    kidTarget.fresh
      ? '<div class="note"><b>Практики пока нет</b>Она появится после первых занятий: ' +
        'карта часов, замер темпа и запись работы считаются по тому, что ребёнок уже делал.</div>'
      :
        /* ⚠️ Три карточки доехали сюда только 12.09.2026. До этого они
           вызывались в ОДНОМ месте — screenAdult, то есть были видны лишь
           тому, кто сидит за устройством ребёнка. У родителя с телефона
           (типичный случай: ссылка ?parent= и есть его кабинет) их не было
           вовсе, хотя карта часов отвечает на самый частый его вопрос —
           «когда он вообще занимается». Карте часов хватало снимка и так;
           замер занятий и запись авторства читали своё состояние напрямую, и
           снимок в них проведён отдельным доводом (zanAll/authorList).
           Разбор трёх ролей. */
        heatHTML(st) + paceStatHTML(st) + authorCardHTML(st, false) + PROVERKA.cardHTML(st) + ZASH.cardHTML());

  h += kidPaneHTML("frame",
    frameEditorHTML(frame()) +
    '<div class="admrow"><button class="rbtn check" data-kf="save">Сохранить ученику</button>' +
    '<span class="sp"></span><span class="dim" id="kidsaved"></span></div>' +
    /* Подтверждение сохранения должно пережить перерисовку рамки, которая
       идёт сразу за ним, — поэтому его вклеивает kidRender, а не kidSave. */
    (savedNote ? '<div class="msg show ok">' + savedNote + '</div>' : '<div class="msg" id="kidsavemsg"></div>'));

  h += kidPaneHTML("hw", hwGiveHTML(st) + kidVarHTML(st));
  h += kidPaneHTML("note", noteGiveHTML(st));
  h += kidPaneHTML("link", kidLinksHTML(kidTarget.code, mentor));

  box.innerHTML = h;
  /* переключение — только показ/скрытие, без перерисовки (см. шапку) */
  box.querySelectorAll("[data-ktab]").forEach(function(b){
    b.onclick = function(){
      kidTab = b.getAttribute("data-ktab");
      box.querySelectorAll("[data-ktab]").forEach(function(x){
        var on = x.getAttribute("data-ktab") === kidTab;
        x.classList.toggle("on", on);
        x.setAttribute("aria-selected", on ? "true" : "false");
      });
      box.querySelectorAll("[data-kpane]").forEach(function(p){
        p.hidden = p.getAttribute("data-kpane") !== kidTab;
      });
    };
  });
  box.querySelectorAll("[data-kd]").forEach(function(b){
    b.onclick = function(){
      var a = b.getAttribute("data-kd");
      if (a === "ccopy") return copyText(kidTarget.code, b);
      if (a === "copy") return copyText(kidLink(kidTarget.code), b);
      if (a === "pcopy") return copyText(parentLink(kidTarget.code,
        (kidGet(kidTarget.code) || {}).name || parentLabel()), b);
    };
  });
  bindFrameEditor(function(){ kidRender(); });
  bindHwGive();
  bindKidVar();
  bindNoteGive();
  bindParentReport(st);
  var sv = box.querySelector('[data-kf="save"]');
  if (sv) sv.onclick = kidSave;
  var mark = document.getElementById("kidsaved");
  if (mark) mark.textContent = kidTarget.dirty ? "есть несохранённые изменения" : "";
}
/* ===== опрос присутствия в открытой карточке =====
   Пока карточка ученика открыта, раз в 20 секунд читаем трансляцию и раз в
   минуту — запись прогресса, и обновляем ТОЛЬКО строку присутствия: полная
   перерисовка съела бы отмеченные галочки домашки. Опрос — это чтения, а не
   записи: у чтений бесплатный предел в десять раз больше. */
function kidWatch(code, seq){
  var beat = 0;
  var watch = liveWatcher();
  function roll(){
    if (screenStale(seq) || !kidTarget || kidTarget.code !== code) return;
    beat++;
    var jobs = [];
    jobs.push(Cloud.liveGet(code).then(function(rec){
      return liveAccept(watch, rec);
    }, function(){ return null; }));
    if (beat % 3 === 0)
      jobs.push(Cloud.load(code).then(function(r){
        if (screenStale(seq) || !kidTarget || kidTarget.code !== code) return null;
        if (r.found && r.data){
          kidTarget.serverAt = r.serverAt || 0;
          /* рамку не подменяем: взрослый мог начать её редактировать. А вот
             живые поля сводки — обновляем, ради них опрос и существует */
          var freshD = ensureShape(r.data);
          kidTarget.data.now = freshD.now;
          kidTarget.data.log = freshD.log;
          kidTarget.data.stars = freshD.stars;
          kidTarget.data.zan = freshD.zan;
          kidTarget.data.daily = freshD.daily;
          kidTarget.data.hw = freshD.hw;
          kidTarget.data.help = freshD.help;
          kidTarget.data.variant = freshD.variant;
          kidTarget.data.vtask = freshD.vtask;
        }
        return null;
      }, function(){ return null; }));
    Promise.all(jobs).then(function(res){
      if (screenStale(seq) || !kidTarget || kidTarget.code !== code) return;
      var live = res[0];
      var el = document.getElementById("kidpresence");
      if (el){
        el.innerHTML = presenceDetailHTML(kidTarget.data, kidTarget.serverAt) +
          (live
            ? '<div class="presence live">🔴 Ребёнок показывает экран: <b>' + esc(live.title || "") +
              '</b> <button class="rbtn check" id="kidwatch">Смотреть</button></div>'
            : "");
        var wb = document.getElementById("kidwatch");
        if (wb) wb.onclick = function(){
          screenLiveView(code, (kidGet(code) || {}).name || parentLabel() || code);
        };
      }
      setTimeout(roll, 20000);
    });
  }
  setTimeout(roll, 20000);
}

/* ===== выдача домашки со стороны взрослого =====
   Порядок разговора здесь такой же, как в расписании: сначала что уже задано,
   потом что можно задать. ⚠️ Список задач строится ИЗ ПРОГРЕССА РЕБЁНКА, а не
   из всего банка: репетитор физически не может задать то, чего ребёнку ещё не
   объясняли. Это не удобство, а защита от самой частой ошибки взрослого —
   «пусть подтянется вперёд». */
function hwWho(){ return parentOf() ? "родитель" : "репетитор"; }
/* Срок по умолчанию — ближайший день занятий из рамки, иначе через неделю. */
function hwDefaultDue(){
  for (var i = 1; i <= 14; i++){
    var k = shiftDay(dayKey(), i);
    if (frameStudyDay(k)) return k;
  }
  return shiftDay(dayKey(), 7);
}
function hwGiveHTML(st){
  var given = hwRecords(st);
  var open = given.filter(function(r){ return !r.done; });
  var can = hwAvailableFor(st);
  /* уже заданные задачи второй раз не предлагаем: у них то же условие */
  var busy = {};
  open.forEach(function(r){ busy[r.id] = 1; });

  var h = '<h3 class="sect">📮 Домашка</h3>' +
    '<p class="dim">Задача на то же умение, что и урок, но с другими числами: ' +
    'решение из урока к ней не подойдёт. Проверяет движок — сверять руками ничего не нужно. ' +
    'Звёзд домашка не даёт и порядок курса не двигает.</p>';

  if (given.length){
    h += '<div class="card"><h3>Что уже задано</h3><ul class="trrules">';
    given.slice(0, 12).forEach(function(r){
      var b = hwBuild(r);
      if (!b) return;
      h += '<li>' + b.emoji + ' <b>' + esc(b.title) + '</b> — ' +
        (r.done
          ? 'сдано' + (r.tries ? ", попыток: " + r.tries : "")
          : 'не сдано, ' + esc(hwDueText(r))) + '</li>';
    });
    h += '</ul></div>';
  }

  if (!can.length){
    h += '<div class="note"><b>Задавать пока нечего</b>' +
      'Задачи открываются по пройденным урокам: дать можно только то, что ребёнку уже объяснили. ' +
      'После первых уроков список появится сам.</div>';
    return h;
  }

  h += '<div class="card"><h3>Задать новую</h3>' +
    '<p class="dim">Отметьте до ' + HW_MAX + ' ' + plural(HW_MAX, "задачи", "задач", "задач") +
    '. Числа в условии тренажёр подставит сам, и у каждого ученика они свои.</p>' +
    '<div class="hwpick">';
  can.forEach(function(it){
    var off = !!busy[it.id];
    var l = CURRICULUM.byId(it.after);
    h += '<label class="hwitem' + (off ? " off" : "") + '">' +
      '<input type="checkbox" data-hwpick="' + esc(it.id) + '"' + (off ? " disabled" : "") + '> ' +
      '<span>' + it.emoji + ' <b>' + esc(it.title) + '</b> ' +
      '<span class="dim">' + esc(it.tag) + (l ? " · после урока «" + esc(l.title) + "»" : "") +
      (off ? " · уже задана" : "") + '</span></span></label>';
  });
  h += '</div>' +
    '<div class="admrow"><label class="admlbl">срок ' +
      '<input type="date" id="hwdue" value="' + esc(hwDefaultDue()) + '"></label>' +
      '<span class="sp"></span>' +
      '<button class="rbtn check" id="hwgive">Задать домашку</button></div>' +
    '<p class="dim">⚠️ Просроченная задача не сгорает и ничем не наказывается: ' +
    'сделанное позже лучше несделанного.</p>' +
    '<div class="msg" id="hwsavemsg"></div></div>';
  return h;
}
function bindHwGive(){
  var btn = document.getElementById("hwgive");
  if (!btn) return;
  /* Больше HW_MAX отметить нельзя — и запрет виден сразу, а не после нажатия.
     ⚠️ Кто заперт навсегда («уже задана»), запоминаем при привязке: после
     переключений атрибут disabled стоит и у временно запертых, и по нему
     своих от чужих уже не отличить. */
  var boxes = Array.prototype.slice.call(document.querySelectorAll("[data-hwpick]"));
  var locked = boxes.filter(function(b){ return b.disabled; });
  function picked(){ return boxes.filter(function(b){ return b.checked; }); }
  boxes.forEach(function(b){
    b.onchange = function(){
      var n = picked().length;
      boxes.forEach(function(x){
        if (locked.indexOf(x) >= 0) return;
        x.disabled = !x.checked && n >= HW_MAX;
      });
    };
  });
  btn.onclick = function(){
    var ids = picked().map(function(b){ return b.getAttribute("data-hwpick"); });
    var due = (document.getElementById("hwdue") || {}).value || "";
    kidSaveHW(ids, due);
  };
}
/* Записать домашку ребёнку. Как и с расписанием, запись читается заново прямо
   перед сохранением: ребёнок мог позаниматься, пока взрослый выбирал задачи, —
   и отправить старый снимок значило бы откатить ему прогресс. */
function kidSaveHW(ids, due){
  if (!kidTarget || !kidTarget.data) return;
  var code = kidTarget.code;
  var msg = document.getElementById("hwsavemsg");
  function say(cls, html){ if (msg){ msg.className = "msg show " + cls; msg.innerHTML = html; } }
  if (!ids || !ids.length) return say("warn", "<b>Ничего не отмечено</b>Выберите хотя бы одну задачу.");
  if (!serverOn()) return say("bad", "<b>Не сохранилось</b>Сервер не подключён — передать домашку некуда.");
  say("warn", "<b>Сохраняю…</b>");
  var dayk = dayKey(), who = hwWho();
  Cloud.load(code).then(function(r){
    var base = ensureShape(r.found && r.data ? r.data : blankProgress());
    var added = 0;
    ids.slice(0, HW_MAX).forEach(function(id){
      if (!hwById(id)) return;
      var seed = hwSeed(code, id, dayk), key = hwKey(id, seed);
      /* та же задача, заданная в тот же день, — это одна задача, а не две */
      if (base.hw[key]) return;
      base.hw[key] = { id:id, seed:seed, due:due || "", by:who,
                       at: Date.now(), done:0, tries:0 };
      added++;
    });
    return Cloud.save(base, code).then(function(){
      kidTarget.data = base;
      kidTarget.fresh = false;
      kidRender("<b>Домашка задана</b>" + added + " " +
        plural(added, "задача уедет", "задачи уедут", "задач уедут") +
        " к ребёнку при следующем открытии тренажёра.");
    });
  }, function(err){
    say("bad", "<b>Не сохранилось</b>" + esc(err.message || err));
  }).catch(function(err){
    say("bad", "<b>Не сохранилось</b>" + esc((err && err.message) || err));
  });
}

/* ===== пробный вариант экзамена ОДНОМУ ученику (13.09.2026, RAZVITIE § 2.6) =====
   До 1.175.0 вариант задавался только всей загруженной группе, а группа
   требует серверного ключа. Частный репетитор с одним девятиклассником и
   родитель на семейном обучении не могли дать ребёнку вариант вовсе, а
   родитель не видел и итога.
   Механика та же, что у группы: в запись ученика уезжает только назначение
   (vtask[экзамен] = семя, режим, срок), вариант собирается у ребёнка по семени.
   ⚠️ Сборка по семени не меняется — старые коды собирают те же варианты.
   ⚠️ solo: 1 — назначение одному: у ребёнка карточка не скажет «у всех в группе
   этот вариант одинаковый». Старые назначения без поля — групповые, как было. */
var kidVarForm = { ex: "oge", mins: 0 };
/* Итог варианта словами взрослому. Считается из снимка ученика, как вся
   карточка. ⚠️ Пока идёт экзамен — ни числа решённых, ни баллов: ребёнок
   может увидеть экран взрослого, и вердикт утёк бы мимо запретов экзамена. */
function kidVarResultHTML(st, exId, task){
  var v = ((st || {}).variant || {})[exId];
  var seed = String(task.seed);
  if (!v || String(v.seed) !== seed)
    return '<p class="dim">Ребёнок вариант ещё не открывал. ' +
      (task.mins ? 'Время экзамена пойдёт с его нажатия, а не с той минуты, когда вариант задали.'
                 : 'Он появится у ребёнка в разделе экзамена карточкой с кнопкой.') + '</p>';
  var items = (v.items || []).filter(function(x){ return x.id; });
  var exam = !!v.mins;
  var endAt = v.endAt || 0;
  if (exam && !v.closed && endAt > Date.now())
    return '<p><b>Идёт экзамен.</b> Итог появится здесь, когда время выйдет или ребёнок сдаст работу.</p>';
  var done = items.filter(function(x){ return (v.done || {})[x.n]; });
  var left = items.filter(function(x){ return !(v.done || {})[x.n]; });
  var h = '<p><b>' + (exam ? "Экзамен окончен" : "Тренировка") + ': решено ' + done.length + ' из ' +
    items.length + '.</b>' +
    (left.length ? ' Не закрыты номера: ' + left.map(function(x){ return x.n; }).join(", ") + '.' : ' Закрыты все номера.') +
    '</p>';
  /* баллы эксперта ФИПИ — только у экзамена ОГЭ, как на итоге у ребёнка */
  if (exId === "oge" && exam){
    var pts = v.pts || {};
    var parts = [];
    var rb = items.filter(function(x){ return x.kind === "robot"; })[0];
    if (rb && window.FIPI15)
      parts.push('задание ' + rb.n + ' (Робот) — <b>' + ((pts[rb.n] || {}).s || 0) + ' из ' + FIPI15.MAX + '</b>');
    var et = window.FIPI16 && FIPI16.examTask ? FIPI16.examTask() : null;
    var px = et ? items.filter(function(x){ return x.n === et.n; })[0] : null;
    if (px){
      var ptask = algoById(px.id);
      parts.push('задание ' + px.n + ' (программа) — ' + (ptask && FIPI16.applies(ptask)
        ? '<b>' + ((pts[px.n] || {}).s || 0) + ' из ' + FIPI16.MAX + '</b>'
        : 'балла нет: на номере стояла задача-функция без ввода, эксперт её не оценивает'));
    }
    if (parts.length)
      h += '<p>Как оценил бы эксперт ФИПИ: ' + parts.join("; ") + '. Не сданное задание — 0 баллов.</p>';
  }
  return h;
}
function kidVarHTML(st){
  var who = hwWho();
  var h = '<div class="card" id="kidvar"><h3>📝 Пробный вариант экзамена</h3>' +
    '<p class="dim">Вариант целиком, как на экзамене: в режиме экзамена — с часами, без подсказок ' +
    'и в один заход. Уезжает только короткий код: вариант соберётся у ребёнка сам.</p>';
  ["oge", "ege"].forEach(function(exId){
    var task = ((st || {}).vtask || {})[exId];
    if (!task || !task.seed) return;
    var ex = (window.EXAMS || {})[exId] || { title: exId };
    h += '<div class="kidvargiven"><p><b>' + esc(ex.title) + ', код ' + esc(String(task.seed)) + '</b> — ' +
      (task.mins ? 'экзамен на ' + task.mins + ' ' + plural(task.mins, "минуту", "минуты", "минут")
                 : 'тренировка, без времени') +
      (task.due ? ', ' + esc(hwDueText({ due: task.due, done: 0 })) : '') +
      (task.by ? ', задал ' + esc(task.by) : '') +
      (task.solo ? '' : ' (всей группе)') + '.</p>' +
      kidVarResultHTML(st, exId, task) + '</div>';
  });
  h += '<div class="admrow"><label class="admlbl">экзамен <select id="kvex">' +
      ["oge", "ege"].map(function(id){
        var ex = (window.EXAMS || {})[id] || { title:id };
        return '<option value="' + id + '"' + (kidVarForm.ex === id ? " selected" : "") + '>' + esc(ex.title) + '</option>';
      }).join("") + '</select></label>' +
    '<span class="sp"></span>' +
    '<label class="admlbl">режим <select id="kvmins">' +
      '<option value="0"' + (kidVarForm.mins ? "" : " selected") + '>тренировка, без времени</option>' +
      [30, 60, 90].map(function(m){
        return '<option value="' + m + '"' + (kidVarForm.mins === m ? " selected" : "") + '>экзамен, ' + m + ' минут</option>';
      }).join("") + '</select></label>' +
    '<span class="sp"></span>' +
    '<label class="admlbl">срок <input type="date" id="kvdue" value="' + esc(hwDefaultDue()) + '"></label>' +
    '<span class="sp"></span>' +
    '<button class="rbtn check" id="kvgive">Задать вариант</button></div>' +
    '<p class="dim">Новый вариант по тому же экзамену заменяет прежнее назначение. Начатый ребёнком ' +
    'вариант не стирается. Задаёт ' + esc(who) + ' — так и будет написано у ребёнка.</p>' +
    '<div class="msg" id="kvmsg"></div></div>';
  return h;
}
function bindKidVar(){
  var btn = document.getElementById("kvgive");
  if (!btn) return;
  btn.onclick = function(){
    var exId = (document.getElementById("kvex") || {}).value || "oge";
    var mins = parseInt((document.getElementById("kvmins") || {}).value || "0", 10) || 0;
    var due = (document.getElementById("kvdue") || {}).value || "";
    kidVarForm.ex = exId; kidVarForm.mins = mins;
    return kidSaveVariant(exId, mins, due);
  };
}
/* Записать назначение ребёнку: запись перечитывается прямо перед сохранением,
   как у домашки, — ребёнок мог позаниматься, пока взрослый выбирал. */
function kidSaveVariant(exId, mins, due){
  if (!kidTarget || !kidTarget.data) return Promise.resolve();
  var code = kidTarget.code;
  var msg = document.getElementById("kvmsg");
  function say(cls, html){ if (msg){ msg.className = "msg show " + cls; msg.innerHTML = html; } }
  var ex = (window.EXAMS || {})[exId];
  if (!ex){ say("bad", "<b>Не выбран экзамен</b>"); return Promise.resolve(); }
  if (!serverOn()){ say("bad", "<b>Не сохранилось</b>Сервер не подключён — передать вариант некуда."); return Promise.resolve(); }
  say("warn", "<b>Сохраняю…</b>");
  var seed = VARIANT.makeVariant(exId, mins).seed;
  return Cloud.load(code).then(function(r){
    var base = ensureShape(r.found && r.data ? r.data : blankProgress());
    base.vtask = base.vtask || {};
    base.vtask[exId] = { seed: seed, mins: mins || 0, at: Date.now(), due: due || "", by: hwWho(), solo: 1 };
    return Cloud.save(base, code).then(function(){
      kidTarget.data = base;
      kidRender("<b>Вариант задан</b>" + esc(ex.title) + ", код <b>" + esc(seed) + "</b> — " +
        (mins ? "экзамен на " + mins + " " + plural(mins, "минуту", "минуты", "минут") : "тренировка") +
        ". Он появится у ребёнка при следующем открытии тренажёра.");
    });
  }, function(err){
    say("bad", "<b>Не сохранилось</b>" + esc(err.message || err));
  }).catch(function(err){
    say("bad", "<b>Не сохранилось</b>" + esc((err && err.message) || err));
  });
}

/* ===== заметка к уроку: сторона взрослого (корзина 3.7) ===== */
/* Какие уроки взрослому предлагать. Не весь курс: заметка к уроку, до
   которого ребёнок не дошёл и неизвестно когда дойдёт, — это записка в
   пустоту. Берём пройденные плюс ТЕКУЩИЙ (первый несданный): он и есть тот,
   на котором ребёнок стоит, в том числе когда стоит намертво. */
function noteLessons(st){
  var sm = (st || {}).stars || {}, out = [], stopped = false;
  CURRICULUM.forEach(function(w){
    worldReadyLessons(w).forEach(function(l){
      if (stopped) return;
      if (sm[l.id] !== undefined){ out.push(l); return; }
      out.push(l); stopped = true;             /* текущий — последний в списке */
    });
  });
  return out;
}
/* Черновик пометок, пока взрослый их набирает: сюда складываются строки,
   по которым он тыкнул, до нажатия «Отправить». Живёт только на его экране. */
var noteDraft = { lesson: "", marks: [] };
/* Заготовка урока — ТОТ ЖЕ текст, что увидит ребёнок, когда откроет урок.
   ⚠️ Здесь показывается наша заготовка, а не код ребёнка: код ребёнка
   взрослому не виден без его согласия (красная линия, обещание записано
   ребёнку в его же профиле), и заводить сюда чёрный ход нельзя. */
function noteStarterOf(id){
  var l = CURRICULUM.byId(id);
  var body = l ? lessonBody(l) : null;
  return (body && body.task && typeof body.task.starter === "string") ? body.task.starter : "";
}
function noteGiveHTML(st){
  var list = noteLessons(st), have = noteList(st);
  /* ⚠️ По умолчанию выбран тот урок, где ребёнок застрял, а если затыка нет —
     текущий. Именно там взрослому есть что сказать, и именно оттуда он сюда
     приходит, прочитав «застрял на уроке …» в отчёте. */
  var stuck = stuckIn(st)[0];
  var pick = (stuck && list.some(function(l){ return l.id === stuck.id; }))
    ? stuck.id : (list.length ? list[list.length - 1].id : "");

  var h = '<h3 class="sect">✍️ Заметка к уроку</h3>' +
    '<p class="dim">Две-три фразы, которые ребёнок увидит НАД объяснением, когда откроет этот урок. ' +
    'Работает тогда, когда вас рядом нет: «начни со второго примера», «здесь мы вчера споткнулись — ' +
    'посмотри внимательно на отступ». Заметка одна на урок; новая заменяет прежнюю. ' +
    'Ответить на неё ребёнок не может — это записка, а не переписка.</p>';

  if (have.length){
    h += '<div class="card"><h3>Что уже написано</h3><ul class="notelist">';
    have.slice(0, 12).forEach(function(n){
      var l = CURRICULUM.byId(n.id);
      h += '<li><b>' + esc(l ? l.title : n.id) + '</b>' +
        '<span class="dim"> · ' + esc(n.by || "взрослый") + ', ' + fmtWhen(n.at) +
        ' · ' + esc(noteSeenHint(st, n)) + '</span>' +
        '<p>' + esc(n.t) + '</p>' +
        '<button class="rbtn sec" data-noteoff="' + esc(n.id) + '">Снять заметку</button></li>';
    });
    h += '</ul></div>';
  }

  /* ⚠️ Сюда попасть можно только если в курсе нет ни одного урока с
     содержанием: даже у новичка доступен первый. Оставлено защитой от пустого
     контента, а не как рабочая ветка. */
  if (!list.length)
    return h + '<div class="note"><b>Писать пока не к чему</b>' +
      'В курсе нет ни одного готового урока — привязать заметку не к чему.</div>';

  h += '<div class="card"><div class="admlbl">Урок</div>' +
    '<select id="notepick">' + list.map(function(l){
      return '<option value="' + esc(l.id) + '"' + (l.id === pick ? " selected" : "") + '>' +
        'урок ' + l.num + ' · ' + esc(l.title) + (l.id === (stuck && stuck.id) ? " — тут застрял" : "") +
        '</option>';
    }).join("") + '</select>' +
    '<div class="admlbl">Текст ко всему уроку (необязательно)</div>' +
    '<textarea id="notetext" rows="2" maxlength="' + NOTE_MAX + '" ' +
      'placeholder="Начни со второго примера — первый мы разобрали вместе."></textarea>' +
    noteMarkPickHTML(pick) +
    '<div class="admrow"><button class="rbtn check" id="notesave">Отправить ребёнку</button>' +
    '<span class="dim">не длиннее ' + NOTE_MAX + ' знаков</span></div>' +
    '<div class="msg" id="notesavemsg"></div></div>';
  return h;
}
/* Выбор строки: заготовка урока строками-кнопками. ⚠️ Это НАША заготовка,
   а не код ребёнка. Ребёнку обещано в его профиле: «сам экран и то, что ты
   печатаешь, взрослым не видно», и код показывается только когда он сам
   нажал «Показать экран репетитору». Пометка к строке заготовки этого
   обещания не трогает: взрослый показывает пальцем на общий текст урока,
   тот же, что видит ребёнок, открыв урок. */
function noteMarkPickHTML(lessonId){
  var code = noteStarterOf(lessonId);
  if (noteDraft.lesson !== lessonId){ noteDraft.lesson = lessonId; noteDraft.marks = []; }
  var h = '<div class="admlbl">Пометки к строкам (необязательно)</div>';
  if (!code.trim())
    return h + '<p class="dim">У этого урока нет заготовки — помечать нечего. ' +
      'Останется текст ко всему уроку.</p>';
  h += '<p class="dim">Тыкните в строку заготовки — ребёнок увидит вашу фразу рядом с ней, ' +
    'а сама строка будет отмечена точкой в колонке номеров. Это текст задания, ' +
    'а не код ребёнка: его код виден только когда он сам включит показ экрана.</p>';
  h += '<div class="mkpick">' + code.split("\n").map(function(ln, i){
    var on = noteDraft.marks.some(function(m){ return m.ln === i + 1; });
    return '<button type="button" class="' + (on ? "on" : "") + '" data-mkln="' + (i + 1) + '">' +
      '<i>' + (i + 1) + '</i><span>' + (esc(ln) || " ") + '</span></button>';
  }).join("") + '</div>';
  if (noteDraft.marks.length){
    h += '<ul class="notelist">' + noteDraft.marks.map(function(m, i){
      return '<li><b>строка ' + m.ln + '</b> <code>' + esc(String(m.src).trim() || "(пусто)") + '</code>' +
        '<input class="lblin" data-mktext="' + i + '" maxlength="' + NOTE_MARK_MAX + '" ' +
        'value="' + esc(m.t || "") + '" placeholder="что тут посмотреть">' +
        '<button class="rbtn sec" data-mkdel="' + i + '">убрать</button></li>';
    }).join("") + '</ul>';
  }
  return h;
}

/* Записать заметку ребёнку. Как у домашки: читаем запись заново прямо перед
   записью — ребёнок мог позаниматься, пока взрослый печатал, и отправить
   старый снимок значило бы откатить ему прогресс. Меняем ТОЛЬКО заметки. */
function kidSaveNote(id, text, marks){
  if (!kidTarget || !kidTarget.data) return;
  var code = kidTarget.code;
  var msg = document.getElementById("notesavemsg");
  function say(cls, html){ if (msg){ msg.className = "msg show " + cls; msg.innerHTML = html; } }
  var t = String(text || "").trim().slice(0, NOTE_MAX);
  var mk = (marks || []).filter(function(m){ return m && String(m.t || "").trim(); })
    .slice(0, NOTE_MARKS_MAX)
    .map(function(m){ return { ln: Math.round(m.ln) || 0, src: String(m.src || ""),
                               t: String(m.t).trim().slice(0, NOTE_MARK_MAX) }; });
  if (!id) return say("warn", "<b>Урок не выбран</b>Выберите, к какому уроку заметка.");
  if (!t && !mk.length && !noteFor(kidTarget.data, id))
    return say("warn", "<b>Пусто</b>Напишите текст или пометьте строку.");
  if (!serverOn()) return say("bad", "<b>Не сохранилось</b>Сервер не подключён — передать заметку некуда.");
  say("warn", "<b>Сохраняю…</b>");
  return Cloud.load(code).then(function(r){
    var base = ensureShape(r.found && r.data ? r.data : blankProgress());
    /* ⚠️ Пустой текст не удаляет ключ, а кладёт НАДГРОБИЕ со свежим временем:
       иначе на устройстве ребёнка остаётся старая заметка, и при следующем
       обмене она воскресает. */
    base.notes[id] = { t: t, by: noteWho(), at: Date.now(), marks: mk };
    return Cloud.save(base, code).then(function(){
      kidTarget.data = base;
      kidTarget.fresh = false;
      var l = CURRICULUM.byId(id);
      noteDraft = { lesson: "", marks: [] };
      kidRender((t || mk.length)
        ? "<b>Заметка отправлена</b>Ребёнок увидит её над объяснением, когда откроет урок «" +
          esc(l ? l.title : id) + "»" +
          (mk.length ? ", а помеченные строки — с точкой в колонке номеров." : ".")
        : "<b>Заметка снята</b>К уроку «" + esc(l ? l.title : id) + "» ребёнок больше ничего не увидит.");
    });
  }, function(err){
    say("bad", "<b>Не сохранилось</b>" + esc((err && err.message) || err));
  }).catch(function(err){
    say("bad", "<b>Не сохранилось</b>" + esc((err && err.message) || err));
  });
}
function bindNoteGive(){
  var sel = document.getElementById("notepick");
  /* смена урока меняет заготовку под пометки — перерисовываем карточку */
  if (sel) sel.onchange = function(){
    noteDraft = { lesson: sel.value, marks: [] };
    kidRender();
  };
  var b = document.getElementById("notesave");
  if (b) b.onclick = function(){
    var s2 = document.getElementById("notepick"), ta = document.getElementById("notetext");
    noteDraftReadInputs();
    kidSaveNote(s2 ? s2.value : "", ta ? ta.value : "", noteDraft.marks);
  };
  document.querySelectorAll("[data-noteoff]").forEach(function(x){
    x.onclick = function(){ kidSaveNote(x.getAttribute("data-noteoff"), "", []); };
  });
  /* ⚠️ Перед КАЖДОЙ перерисовкой забираем то, что взрослый уже напечатал в
     полях пометок: иначе тык по второй строке стирал бы фразу к первой. */
  document.querySelectorAll("[data-mkln]").forEach(function(x){
    x.onclick = function(){
      noteDraftReadInputs();
      var ln = +x.getAttribute("data-mkln");
      var at = noteDraft.marks.map(function(m){ return m.ln; }).indexOf(ln);
      if (at >= 0) noteDraft.marks.splice(at, 1);
      else if (noteDraft.marks.length < NOTE_MARKS_MAX)
        noteDraft.marks.push({ ln: ln, src: (noteStarterOf(noteDraft.lesson).split("\n")[ln - 1] || ""), t: "" });
      noteDraft.marks.sort(function(a, b){ return a.ln - b.ln; });
      kidRender();
    };
  });
  document.querySelectorAll("[data-mkdel]").forEach(function(x){
    x.onclick = function(){
      noteDraftReadInputs();
      noteDraft.marks.splice(+x.getAttribute("data-mkdel"), 1);
      kidRender();
    };
  });
}
function noteDraftReadInputs(){
  document.querySelectorAll("[data-mktext]").forEach(function(inp){
    var i = +inp.getAttribute("data-mktext");
    if (noteDraft.marks[i]) noteDraft.marks[i].t = inp.value;
  });
}

/* Записать рамку ребёнку. Читаем запись заново прямо перед записью: ребёнок мог
   позаниматься, пока взрослый выбирал дни, и отправить старый снимок значило бы
   откатить ему прогресс. Меняем ТОЛЬКО рамку. */
function kidSave(){
  if (!kidTarget || !kidTarget.data) return;
  var code = kidTarget.code, myFrame = frameShape(kidTarget.data.frame);
  var msg = document.getElementById("kidsavemsg");
  function say(cls, html){ if (msg){ msg.className = "msg show " + cls; msg.innerHTML = html; } }
  say("warn", "<b>Сохраняю…</b>");
  /* ⚠️ Рамку читали при открытии карточки, а кладут на сервер сейчас — между
     этим взрослый успевает подумать, а ребёнок или второй взрослый успевает
     поменять рамку у себя. Раньше здесь стояло голое base.frame = myFrame, и
     чужая правка исчезала МОЛЧА. Решаем по СОСТОЯНИЮ, а не по времени
     (§ 4.19): рамка несёт setAt, и если на сервере он свежее того, с чем мы
     открылись, — не затираем, а говорим вслух. */
  var openedAt = kidTarget.frameAt || 0;
  Cloud.load(code).then(function(r){
    var base = ensureShape(r.found && r.data ? r.data : blankProgress());
    var theirs = frameShape(base.frame);
    if (openedAt && theirs.setAt > openedAt && theirs.setAt !== myFrame.setAt){
      say("bad", "<b>Рамку успели поменять</b>Пока карточка была открыта, расписание " +
        "этого ученика изменили с другого устройства. Чтобы не стереть чужую правку, " +
        "я ничего не сохранил — откройте карточку заново и посмотрите, что там теперь.");
      kidTarget.data = base;
      kidTarget.frameAt = theirs.setAt;
      kidTarget.dirty = true;
      return;
    }
    base.frame = myFrame;                       /* только расписание, прогресс не трогаем */
    return Cloud.save(base, code).then(function(){
      kidTarget.data = base;
      kidTarget.frameAt = myFrame.setAt;
      kidTarget.dirty = false;
      kidTarget.fresh = false;
      kidRender("<b>Расписание сохранено</b>Оно приедет к ребёнку при следующем открытии тренажёра.");
    });
  }, function(err){
    say("bad", "<b>Не сохранилось</b>" + esc(err.message || err));
  }).catch(function(err){
    say("bad", "<b>Не сохранилось</b>" + esc((err && err.message) || err));
  });
}
/* ================= КАБИНЕТ РОДИТЕЛЯ =================
   Родитель следит за ОДНИМ ребёнком. Отличие от кабинета админа: нет списка
   учеников, нет группы, нет раздачи ссылок — только расписание и отчёт по
   своему ребёнку. Данные читаются с сервера по коду (kidTarget + kidLoad),
   так же как админ смотрит карточку ученика, поэтому тело экрана переиспользует
   kidRender без единой правки. */
function parentLabel(){ return (S.admin && S.admin.parentLabel) || ""; }
function screenParent(code){
  code = code || parentOf();
  if (!code) return screenRoles();
  enterScreen("home", "parent");
  kidTarget = { code: code, name: parentLabel(), data: null, dirty: false };
  kidTab = "";
  var who = parentLabel() || ("ученик " + code);
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">кабинет родителя</div><h1>' + esc(who) + '</h1></div></div>' +
    '<p class="lede">Здесь видно, как идут занятия, и можно поставить расписание. ' +
    'Ребёнок занимается на своём устройстве — его тренажёр отдельно от этого экрана.</p>' +
    '<div id="kidbody"><p class="dim">Загружаю занятия с сервера…</p></div>' +
    /* ⚠️ Две кнопки, а было три. Третья («Забыть код на этом устройстве»)
       убрана не ради красоты: у РОДИТЕЛЯ код ребёнка и есть роль — другого
       признака кабинета у устройства нет. Значит «выйти» и «забыть код» это
       одно и то же действие, и разными словами оно называлось зря: фаундер
       08.09.2026 нажал «Выйти», остался в кабинете и не нашёл выхода вовсе.
       У репетитора три кнопки остаются, и там разница настоящая: пароль и
       список учеников переживают выход.
       ⚠️ Надпись — НЕ «Выйти из кабинета», как у репетитора, и это § 4.21:
       одинаковые слова означали разное. У репетитора выход закрывает замок,
       а роль остаётся; здесь выход отвязывает устройство насовсем — и
       кнопка обязана говорить именно это. */
    '<div class="pager">' +
    '<button class="bigbtn ghost" data-pd="leave">🚪 Выйти и отвязать устройство</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" data-pd="role">⇄ Сменить роль</button></div>' +
    aboutFootHTML();
  wireAboutFoot(app);
  app.querySelectorAll("[data-pd]").forEach(function(b){
    b.onclick = function(){
      if (b.getAttribute("data-pd") === "role"){ kidTarget = null; return screenRoles(); }
      if (b.getAttribute("data-pd") !== "leave") return;
      /* ⚠️ Код показываем ПРЯМО В ВОПРОСЕ. Выход отвязывает устройство, и без
         кода вернуться будет нечем: почты и телефона мы не спрашиваем, значит
         восстанавливать неоткуда. Честно предупредить дешевле, чем потом
         разбирать «куда делся мой кабинет». */
      if (!confirm("Выйти и отвязать устройство?\n\n" +
                   "Устройство станет обычным. Чтобы вернуться, понадобится код ребёнка:\n\n" +
                   "    " + code + "\n\n" +
                   "Запишите его. Ссылка от учителя тоже откроет кабинет снова."))
        return;
      kidTarget = null;
      parentDeviceOff();
      leaveRoom();
    };
  });
  refreshTop();
  kidLoad(code);
}
/* ⚠️ Общий замок ВСЕХ взрослых экранов (полная панель, занятийная рамка на
   устройстве ребёнка, группа, просмотр по коду). Раньше он открывался единым
   кодом, зашитым в исходник открытым текстом: подросток, которого мы учим
   программировать, находил его за вечер, а внутри — «зачесть всё на 3★» и снятие
   потолка. Того кода больше нет в продукте. Замок теперь — тот же
   пароль, что и у кабинета взрослого:
     — пароль уже задан → просим его;
     — не задан (панель на общем устройстве открывают впервые) → предлагаем
       ПРИДУМАТЬ его прямо здесь. Это не делает устройство кабинетом (isAdmin),
       только ставит защиту.
   after — экран, на который вернуться после снятия замка. */
function adminGate(after){
  after = after || screenAdmin;
  var setting = !adminHasPass();
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">служебный экран</div><h1>🔐 Панель репетитора</h1></div></div>' +
    '<p class="lede">' + (setting
      ? 'Эти экраны — для взрослого. Придумайте пароль, чтобы ребёнок не открыл их из любопытства.'
      : 'Введите пароль взрослого.') + '</p>' +
    '<div class="card"><div class="admgate">' +
      '<input type="password" id="admcode" placeholder="' + (setting ? "придумайте пароль" : "пароль") +
        '" autocomplete="' + (setting ? "new-password" : "current-password") + '" spellcheck="false">' +
      (setting ? '<input type="password" id="admcode2" placeholder="ещё раз" autocomplete="new-password" spellcheck="false">' : '') +
      '<button class="rbtn check" id="admgo">' + (setting ? "Готово" : "Войти") + '</button>' +
    '</div><div class="msg" id="admgatemsg"></div>' +
    (setting ? passFirstHTML() : '') +
    (setting ? '<p class="dim" style="margin-top:12px">⚠️ Это защита от любопытства, а не настоящая ' +
      'авторизация: сайт работает в браузере, проверять пароль на сервере некому. Пароль хранится ' +
      'только здесь. Забыли — очистите данные сайта в браузере и задайте заново.</p>' : '') +
    '</div>' +
    '<div class="pager"><button class="bigbtn ghost" id="admback">← На главную</button></div>';
  var inp = document.getElementById("admcode");
  var msg = document.getElementById("admgatemsg");
  function tryIn(){
    if (setting){
      var b = (document.getElementById("admcode2") || {}).value;
      if (String(inp.value).length < 4){
        msg.className = "msg show bad";
        msg.innerHTML = "<b>Слишком короткий</b>Хотя бы четыре знака.";
        return;
      }
      if (inp.value !== b){
        msg.className = "msg show bad";
        msg.innerHTML = "<b>Не совпадает</b>Второй пароль отличается от первого.";
        return;
      }
      if (!passFirstOk(msg)) return;
      adminPassSet(inp.value, false);       /* защита есть, но кабинетом не делаем */
      adminUnlock();
      return after();
    }
    if (adminPassOk(inp.value)){ adminUnlock(); return after(); }
    msg.className = "msg show bad";
    msg.innerHTML = "<b>Пароль не подошёл</b>Проверьте раскладку и большие буквы.";
    inp.value = ""; inp.focus();
  }
  document.getElementById("admgo").onclick = tryIn;
  inp.addEventListener("keydown", function(e){ if (e.key === "Enter") tryIn(); });
  document.getElementById("admback").onclick = goHome;
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
    /* «Сегодня» стоит первым: общее время за всё время отвечает на вопрос
       «сколько всего», а взрослый спрашивает «сколько сегодня». */
    statBox("Сегодня за тренажёром", fmtDur(dayMs(st, dayKey()))) +
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
   Панель репетитора показывала кучу верных чисел и ни одной фразы: чтобы
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

/* ===== факты недели, без разметки =====
   Одни и те же числа нужны трём потребителям: карточке «Что было за неделю»,
   отчёту родителю текстом и карточке «О чём спросить на занятии». Считать
   трижды — значит однажды разойтись, поэтому расчёт вынесен и работает на
   ЛЮБОМ снимке прогресса, своём или чужом. */
function weekFacts(st){
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

  /* где буксовал: за эту же неделю, по цене решения */
  var tough = [];
  keys.forEach(function(k){
    (byDay[k] || []).forEach(function(x){
      var цена = lessonPrice(x.log);
      if (цена >= 4) tough.push({ id:x.id, цена:цена, log:x.log });
    });
  });
  tough.sort(function(a, b){ return b.цена - a.цена; });

  /* последнее занятие, если на неделе его не было */
  var lastDay = "";
  Object.keys(st.days || {}).forEach(function(k){ if (k > lastDay) lastDay = k; });

  /* проверка понимания: по закрытым занятиям этой недели */
  var pred = { ok:0, all:0 };
  Object.keys(st.zan || {}).forEach(function(k){
    var r = (st.zan || {})[k];
    if (!r || !r.end || !r.predAll) return;
    if (keys.indexOf(dayKey(new Date(r.end))) < 0) return;
    pred.ok += r.predOk || 0; pred.all += r.predAll;
  });

  /* следующий по порядку курса — только по звёздам, без замков этого
     устройства: факты обязаны совпадать для своего и чужого снимка */
  var next = null;
  CURRICULUM.forEach(function(w){
    w.lessons.forEach(function(l){
      if (!next && sm[l.id] === undefined) next = l;
    });
  });

  return { keys: keys, byDay: byDay, studied: studied, weekSolved: weekSolved,
           weekMs: weekMs, tough: tough, lastDay: lastDay, pred: pred,
           /* ⚠️ Без окна в неделю — см. разбор у stuckIn: курс это цепь, и
              нерешённый урок с попытками не «был в среду», а держит ребёнка
              прямо сейчас. */
           stuck: stuckIn(st),
           next: next, streak: streakCurrentIn(covered),
           hw: hwRecords(st) };
}

/* причины «тяжело далось» — словами, без приговора */
function toughWhy(log){
  var причины = [];
  if (log.shown) причины.push("смотрел решение");
  if (log.hints) причины.push(log.hints + " " + plural(log.hints, "подсказка", "подсказки", "подсказок"));
  if (log.attempts > 2) причины.push(log.attempts + " " + plural(log.attempts, "попытка", "попытки", "попыток"));
  return причины.join(", ");
}

/* ================= где застрял =================
   ⚠️ Найдено 07.09.2026, разбором вопроса фаундера «что делать, когда ребёнок
   уперся в урок и никак не может его решить». Оказалось, что взрослый об этом
   не узнаёт ВООБЩЕ. И недельный отчёт (weekFacts), и строка группы (groupRow)
   считали только РЕШЁННЫЕ уроки: у обоих стояло «нет solvedAt — пропустить».
   Отсюда три следствия, и все три плохие:
     — в отчёте родителю про урок, на котором ребёнок сидит третий день, не
       было ни слова;
     — репетитор видел «тяжело шёл урок» только про уроки, которые ребёнок
       всё-таки прошёл, то есть про уже случившийся успех;
     — если остальные уроки недели прошли чисто, отчёт писал «все уроки недели
       прошли без подсказок» — про неделю, просиженную в тупике.
   А на вывеске обещано прямо: «отчёт за неделю — ... где застрял».

   Данные лежали всё это время: попытки, время и последнее касание пишутся и
   по нерешённым урокам тоже. Не хватало того, чтобы их кто-то прочитал.

   ⚠️ Окна в неделю здесь НЕТ, и это не забывчивость. Курс — цепь: следующий
   урок открывается только сданным предыдущим. Значит нерешённый урок с
   попытками — это не «что было в среду», а место, где ребёнок стоит прямо
   сейчас, сколько бы времени ни прошло. Такой факт не устаревает. */
/* Цена урока: во что он обошёлся. Одна формула на три места — «тяжело далось»
   в отчёте, пометку в группе и затык. Раньше она была списана трижды, и три
   копии разошлись бы при первой же правке. */
function lessonPrice(g){
  return ((g && g.attempts) || 0) + ((g && g.hints) || 0) * 2 + ((g && g.shown) ? 5 : 0);
}
/* ⚠️ Порог выше, чем у «тяжело далось» (4). Причина: цена решённого урока
   окончательная, а цена урока, который ребёнок сейчас проходит, ещё растёт.
   Четыре попытки — это нормальный ход работы, и назвать его затыком значит
   поднять тревогу на ровном месте. Шесть — это либо шесть попыток подряд,
   либо четыре плюс взятая подсказка, либо открытое решение, после которого
   урок так и не сдан. */
var STUCK_PRICE = 6;
function stuckIn(st){
  st = st || {};
  var lg = st.log || {}, sm = st.stars || {}, out = [];
  Object.keys(lg).forEach(function(id){
    var g = lg[id] || {};
    if (sm[id] !== undefined) return;         /* сдан — это уже не затык */
    if (!(g.attempts > 0)) return;            /* открыл и закрыл — тоже нет */
    if (lessonPrice(g) < STUCK_PRICE) return;
    out.push({ id: id, цена: lessonPrice(g), log: g });
  });
  out.sort(function(a, b){ return b.цена - a.цена; });
  return out;
}
/* Чем обернулся затык — фактами, без вывода. ⚠️ «Подсказок не брал» пишется
   ОТДЕЛЬНОЙ строкой, а не молчанием: взрослому это говорит, что делать
   (сесть и открыть подсказку вместе), а молчание не говорит ничего. */
function stuckWhy(log){
  var что = [];
  if (log.attempts) что.push(log.attempts + " " + plural(log.attempts, "попытка", "попытки", "попыток"));
  if (log.timeMs) что.push(fmtMins(log.timeMs));
  if (log.shown) что.push("решение уже открывал");
  else if (log.hints) что.push("подсказок взято: " + log.hints);
  else что.push("подсказок не брал");
  return что.join(", ");
}
/* Что делать взрослому — по тому, что ребёнок УЖЕ пробовал.
   ⚠️ Один совет на все случаи не годится. «Возьмите подсказку» ребёнку,
   который взял их все, читается как «плохо старался», и взрослый после такого
   совета перестаёт верить отчёту целиком. А совет «откройте решение» тому, кто
   его уже открывал и всё равно не сдал, просто бесполезен: там непонятен не
   ответ, а приём. Поэтому веток три, и каждая называет СЛЕДУЮЩИЙ шаг, а не
   тот, что уже сделан. */
function stuckAdvice(log){
  if (log.shown)
    return "Решение он уже открывал, а урок всё равно не сдан — значит непонятен сам приём, " +
      "а не эта задача. Сядьте рядом, разберите решение построчно и попросите объяснить его " +
      "вам своими словами: где это место в курсе объясняли, туда стоит вернуться.";
  if (log.hints)
    return "Подсказки он уже брал. Следующий честный ход — кнопка «Показать решение» в уроке: " +
      "код появится в редакторе, его можно разобрать построчно и поменять числа, чтобы увидеть, " +
      "что изменится. За урок будет одна звезда вместо трёх, и это нормальный способ учиться.";
  return "Подсказок он ещё не брал — начните с них: кнопка «💡 Подсказка» в уроке. Они выдаются " +
    "по одной и объясняют приём на других числах, а не выдают ответ. Если и так не пойдёт — " +
    "рядом кнопка «Показать решение», и открыть её не стыдно.";
}

function weekReportHTML(st){
  var f = weekFacts(st), sm = st.stars || {};
  var today = dayKey();
  var keys = f.keys, byDay = f.byDay, studied = f.studied,
      weekSolved = f.weekSolved, weekMs = f.weekMs, tough = f.tough, lastDay = f.lastDay;
  var names = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

  /* ⚠️ День, где ребёнок БЫЛ в тренажёре, но ничего не закончил, — это не
     прогул. Раньше ячейка решалась только по st.days (дни с достижением), и
     такой день рисовался как «—», хотя легенда обещает «·» — «занимались, но
     урок не закончили». Родитель видел «пропуск» и карту ритма с сорока
     минутами прямо под ней: отчёт спорил сам с собой. Нашлось взглядом
     фаундера 12.09.2026. Достоверность отчёта — это весь его смысл. */
  var satIn = function(k){
    var row = st.hours && st.hours[k];
    return Array.isArray(row) && row.some(function(v){ return v > 0; });
  };
  var strip = keys.map(function(k){
    var was = activeIn(st.days, k), shield = !was && !!(st.shields && st.shields[k]);
    var sat = !was && !shield && satIn(k);
    var n = (byDay[k] || []).length;
    var d = new Date(k + "T12:00:00");
    return '<div class="wrday' + (was ? " on" : (shield ? " shield" : "")) + (k === today ? " now" : "") + '">' +
      '<span class="wrd">' + names[d.getDay()] + '</span>' +
      '<span class="wrn">' + (was ? (n || "·") : (shield ? "🛡" : (sat ? "·" : "—"))) + '</span>' +
      '<span class="wrdate">' + d.getDate() + "." + (d.getMonth() + 1) + '</span></div>';
  }).join("");

  var h = '<div class="card weekrep"><h3>📅 Что было за неделю</h3>';

  if (!studied && !weekSolved){
    h += '<p class="dim">За последние семь дней занятий не было. ' +
      (lastDay ? 'Последнее — ' + lastDay.split("-").reverse().join(".") + '.'
               : 'Занятий пока не было вовсе.') + '</p>';
  } else {
    h += '<p class="wrline"><b>' + studied + ' ' + plural(studied, "занятие", "занятия", "занятий") + '</b>, ' +
      '<b>' + weekSolved + ' ' + plural(weekSolved, "урок", "урока", "уроков") + '</b>' +
      (weekMs ? ', <b>' + fmtMins(weekMs) + '</b> за этими уроками' : '') + '. ' +
      'Дней подряд: <b>' + f.streak + '</b>.</p>';
  }

  h += '<div class="wrstrip">' + strip + '</div>' +
    '<p class="dim">В клетке — сколько уроков пройдено в этот день. ' +
    '«·» — занимались, но урок не закончили, 🛡 — день закрыт щитом, «—» — пропуск.</p>';

  /* ⚠️ Затык стоит ПЕРЕД «тяжело далось» и перед «дальше по программе».
     «Тяжело далось» — про уже взятые уроки, то есть про прошлое; затык — про
     то, где ребёнок стоит сейчас и почему он не двигается. Взрослый, который
     читает карточку сверху вниз, обязан наткнуться на это первым. */
  if (f.stuck.length){
    var sk = f.stuck[0], sl = CURRICULUM.byId(sk.id);
    h += '<div class="wrstuck"><b>⛔ Застрял: ' + (sl ? esc(sl.title) : esc(sk.id)) + '</b>' +
      '<p>' + esc(stuckWhy(sk.log)) + '. Дальше курс не пускает: следующий урок ' +
      'открывается только этим.</p>' +
      '<p class="dim"><b>Что делать:</b> ' + esc(stuckAdvice(sk.log)) + '</p>' +
      '</div>';
  }

  if (tough.length){
    h += '<div class="wrtough"><b>Тяжело далось:</b><ul>' +
      tough.slice(0, 3).map(function(t){
        var l = CURRICULUM.byId(t.id);
        return '<li>' + (l ? esc(l.title) : esc(t.id)) + ' — ' + toughWhy(t.log) + '</li>';
      }).join("") + '</ul>' +
      '<p class="dim">Эти уроки сами вернутся к ребёнку в разделе «Повторить».</p></div>';
  } else if (weekSolved && !f.stuck.length){
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

/* ===== отчёт родителю: текст для мессенджера =====
   Вторая боль репетитора после проверки: родителю в конце недели «сказать
   нечего, кроме „занимались, всё хорошо“». Рассылать письма продукт не может —
   адрес взрослого это ПДн, и это решение фаундера от 03.09.2026. Канал
   доставки — сам репетитор: скопировал, вставил в чат, подписал имя.

   Три правила текста, и все три нарушать нельзя:
     — имени ребёнка в тексте НЕТ. Репетитор подписывает сам: наш текст обязан
       быть одинаково безопасным в любом чате;
     — плохие новости не вычищаются. «Занятий не было» и «смотрел решение»
       пишутся прямо: отчёт, в котором всегда всё хорошо, перестают читать
       через три недели (docs/zanyatie-i-vzroslyj.md § 3);
     — без приговоров. «Тяжело дался» и «6 попыток» — факты; «ленится» и
       «отстаёт» — выводы, и их за взрослого не выносим. */
function parentReportText(st){
  var f = weekFacts(st);
  var lines = [];

  if (!f.studied && !f.weekSolved){
    lines.push("За неделю занятий не было." + (f.lastDay
      ? " Последнее было " + f.lastDay.split("-").reverse().join(".") + "."
      : " Занятий пока не было вовсе."));
  } else {
    lines.push("За неделю: " + f.studied + " " + plural(f.studied, "занятие", "занятия", "занятий") +
      ", " + f.weekSolved + " " + plural(f.weekSolved, "урок", "урока", "уроков") +
      (f.weekMs ? " (" + fmtMins(f.weekMs) + " чистой работы)" : "") +
      ". Дней подряд: " + f.streak + ".");
  }

  if (f.tough.length){
    var t = f.tough[0], l = CURRICULUM.byId(t.id);
    lines.push("Тяжело дался урок «" + (l ? l.title : t.id) + "»: " + toughWhy(t.log) +
      ". Тренажёр сам вернёт его на повторение.");
  } else if (f.weekSolved && !f.stuck.length){
    /* ⚠️ «И не застрял» — обязательная половина условия. Без неё отчёт писал
       «все уроки недели прошли без подсказок» ребёнку, который два урока сдал
       чисто, а третий не может взять третий день: формально правда, по смыслу
       ложь. Хорошие новости не считаются, пока не сказаны плохие. */
    lines.push("Все уроки недели прошли без подсказок и без подглядывания в решение.");
  }

  /* ⚠️ Затык идёт ОТДЕЛЬНОЙ строкой и рядом с ним — что делать. Назвать беду
     и не сказать выхода значит оставить взрослого с тревогой и без действия;
     а выход у нас есть, просто ребёнок про него не знает (подсказки и решение
     стоят в уроке с первой секунды и выглядят как «сдаться»). */
  if (f.stuck.length){
    var sk = f.stuck[0], sl = CURRICULUM.byId(sk.id);
    lines.push("Застрял на уроке «" + (sl ? sl.title : sk.id) + "»: " + stuckWhy(sk.log) +
      ". Дальше курс не пускает: следующий урок открывается только этим. " + stuckAdvice(sk.log));
  }

  if (f.pred.all)
    lines.push("Проверка понимания: в конце занятия читал программу и предсказывал, что она напечатает, — " +
      "верно " + f.pred.ok + " из " + f.pred.all + ".");

  var hwDone = f.hw.filter(function(r){ return !!r.done; }).length;
  if (f.hw.length){
    var open = f.hw.filter(function(r){ return !r.done; });
    var near = "";
    open.forEach(function(r){ if (r.due && (!near || r.due < near)) near = r.due; });
    lines.push("Домашка: сдано " + hwDone + " из " + f.hw.length + "." +
      (near ? " Ближайший срок — " + near.split("-").reverse().join(".") + "." : ""));
  }

  /* ⚠️ Курс — цепь, поэтому урок, на котором ребёнок застрял, И ЕСТЬ
     следующий по программе. Печатать его вторым абзацем целиком значит
     назвать одно и то же дважды и с двумя разными объяснениями — отчёт из
     шести строк такого не выдерживает. */
  var сталУже = f.stuck.length && f.next && f.stuck[0].id === f.next.id;
  lines.push(!f.next
    ? "Все уроки курса пройдены."
    : сталУже
      ? "Дальше по программе — тот же урок " + f.next.num + " «" + f.next.title + "»."
      : "Дальше по программе: урок " + f.next.num + " «" + f.next.title + "».");

  var pick = dinnerPickFrom(st, dayKey());
  if (pick)
    lines.push("Спросите за ужином: «что делает " + pick.it.sig + "?» — это из пройденного. " +
      "Если объяснит своими словами и покажет пример — тема понята.");

  return lines.join("\n");
}

function parentReportCardHTML(){
  /* Карточку видят двое, и слова у каждого свои: репетитор ШЛЁТ этот текст
     родителю, родитель может переслать его второму взрослому или сохранить. */
  var forParent = !!parentOf();
  return '<div class="card"><h3>✉️ ' + (forParent ? "Неделя одним сообщением" : "Отчёт родителю") + '</h3>' +
    '<p class="dim">' + (forParent
      ? 'Готовый текст: можно переслать второму взрослому или сохранить себе. '
      : 'Готовый текст для мессенджера: скопируйте и отправьте родителю. ') +
    'Имени в нём нет нарочно — подпишите сами. Плохие новости из текста не вычищаются: ' +
    'отчёт, в котором всегда всё хорошо, перестают читать.</p>' +
    '<pre class="reptext" id="preptext"></pre>' +
    '<div class="admrow"><button class="rbtn check" id="prepcopy">Скопировать текст</button></div></div>';
}
/* Текст кладётся через textContent, а не в разметку: esc() экранирует не всё,
   а отчёт собирается из названий уроков и записей шпаргалки. */
function bindParentReport(st){
  var pre = document.getElementById("preptext");
  var btn = document.getElementById("prepcopy");
  if (!pre || !btn) return;
  var text = parentReportText(st);
  pre.textContent = text;
  btn.onclick = function(){ copyText(text, btn); };
}

/* ===== о чём спросить на занятии =====
   Готовит репетитора к разговору за минуту: три вопроса из недели ученика.
   Не тест и не допрос — темы для разговора, у каждой написано, откуда она
   взялась и какой ответ считать хорошим. */
/* ================= устный ответ: спросить вслух про СВОЮ программу =================
   Первый этаж голоса (docs/golos-i-produkty-2026-09-06.md § 3.3), и он
   намеренно сделан БЕЗ распознавания речи: никакого микрофона, никакой
   модели, ничего не грузится и всё работает офлайн.

   Зачем это вообще. Замер `foresight-2027.md` § 16.1: «как объяснить ребенку
   программирование» — 14 показов в месяц, «ребенок не хочет учиться» —
   16 383. Голос, который ОБЪЯСНЯЕТ, никому не нужен. Работает голос, который
   СПРАШИВАЕТ, — и движок спрашивает лучше репетитора: репетитор помнит, что
   видел, а движок знает, что программа печатает и что будет, если поменять
   в ней число.

   Чем это отличается от «вопроса за ужином» (askCardHTML). Тот вопрос — про
   пройденную КОМАНДУ из шпаргалки. Этот — про программу, которую ребёнок
   написал сам час назад, и ответ на него посчитан движком. Родителю не надо
   знать Python: правильный ответ у него в руках, а спрятан он под кнопку,
   чтобы не проговориться раньше времени.

   ⚠️ Третий вопрос НАРОЧНО без правильного ответа. Первые два проверяют, что
   ребёнок умеет читать код, а «объясни своими словами» — единственный, на
   котором видно понимание, и машине его проверять нечем. Врать родителю
   галочкой «верно/неверно» тут нельзя, поэтому вместо ответа стоит подсказка,
   ЧТО слушать.

   ⚠️ Программа берётся из `S.zan[...].progs` — их кладёт zanKeepProg победой
   урока. Это те же данные, на которых работает проверка понимания в занятии,
   и ничего нового ребёнок не отправляет. */
function oralPick(st){
  var all = (st && st.zan) || {}, keys = Object.keys(all).sort();
  for (var i = keys.length - 1; i >= 0; i--){
    var progs = (all[keys[i]] || {}).progs || [];
    for (var j = progs.length - 1; j >= 0; j--){
      var p = progs[j];
      if (!p || !p.code) continue;
      var out = myPredRun(p.code);
      if (!out) continue;                       /* падает или молчит — не спросишь */
      return { id: p.id, code: p.code, out: out, mut: myPredictMake(p.code) };
    }
  }
  return null;
}
function oralCardHTML(st){
  var pick = oralPick(st);
  if (!pick) return "";
  var l = CURRICULUM.byId(pick.id);
  var qs = [];
  qs.push({
    q: "Прочитай программу вслух и скажи, что она напечатает.",
    a: pick.out,
    why: "Проверяет, умеет ли он читать свой код, а не только писать."
  });
  if (pick.mut) qs.push({
    q: "А если поменять " + pick.mut.from + " на " + pick.mut.to + " — что напечатает тогда?",
    a: pick.mut.out,
    why: "Проверяет, понял ли он, за что это число отвечает."
  });
  qs.push({
    q: "Объясни своими словами, что эта программа делает.",
    a: null,
    why: "Правильного ответа тут нет и быть не может. Слушайте, говорит ли он, ЧТО " +
         "программа делает («считает и печатает»), или пересказывает, КАК написано " +
         "(«тут print, потом for»). Первое — понял, второе — выучил вид."
  });
  return '<div class="card oral"><h3>🗣 Спросите вслух — три минуты</h3>' +
    '<p class="dim">Это программа, которую он написал сам' +
      (l ? ' в уроке «' + esc(l.title) + '»' : '') + '. Читайте вопросы вслух, ' +
      'пусть отвечает голосом. Знать Python не нужно: ответы уже посчитаны, ' +
      'они спрятаны под кнопкой — чтобы не проговориться раньше него.</p>' +
    '<pre class="oralcode"><code>' + hl(pick.code.replace(/\n+$/, "")) + '</code></pre>' +
    '<ol class="orall">' + qs.map(function(x){
      return '<li><b>«' + esc(x.q) + '»</b>' +
        (x.a === null
          ? '<span class="dim">' + esc(x.why) + '</span>'
          : '<details class="orala"><summary>Показать правильный ответ</summary>' +
            '<pre>' + esc(x.a) + '</pre></details>' +
            '<span class="dim">' + esc(x.why) + '</span>');
    }).join("") + '</ol></div>';
}
function askCardHTML(st){
  var f = weekFacts(st);
  var qs = [];

  if (f.tough.length){
    var t = f.tough[0], l = CURRICULUM.byId(t.id);
    qs.push('<li><b>«Что было самым трудным в уроке „' + esc(l ? l.title : t.id) + '“?»</b>' +
      '<span class="dim">Там было: ' + esc(toughWhy(t.log)) +
      '. Пусть покажет, как в итоге решил, — рассказ о победе закрепляет лучше повтора.</span></li>');
  }

  var pick = dinnerPickFrom(st, dayKey());
  if (pick){
    var pl = CURRICULUM.byId(pick.lesson);
    qs.push('<li><b>«Что делает <code>' + esc(pick.it.sig) + '</code>?»</b>' +
      '<span class="dim">Из пройденного' + (pl ? ' («' + esc(pl.title) + '»)' : '') +
      '. Хороший ответ: ' + esc(pick.it.what) + ' — своими словами и с примером.</span></li>');
  }

  /* самая частая ошибка последней недели — повод поговорить, а не упрёк */
  var e = st.errs || {}, top = null, weekAgo = Date.now() - 7 * 864e5;
  ERR_BEASTS.forEach(function(b){
    var r = e[b.kind];
    if (!r || !r.seen || (r.at || 0) < weekAgo) return;
    if (!top || r.seen > top.r.seen) top = { b: b, r: r };
  });
  if (top)
    qs.push('<li><b>«Что значит ошибка ' + esc(top.b.kind) + '?»</b>' +
      '<span class="dim">На неделе встречалась' +
      (top.r.seen > 1 ? " " + top.r.seen + " " + plural(top.r.seen, "раз", "раза", "раз") : "") +
      '. Хороший ответ: ' + esc(top.b.what) + '</span></li>');

  if (!qs.length) return "";
  return '<div class="card"><h3>💬 О чём спросить на занятии</h3>' +
    '<p class="dim">Темы для разговора из его недели — не проверка, а повод дать рассказать.</p>' +
    '<ul class="askqs">' + qs.join("") + '</ul></div>';
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
    /* Экран группы — главный вход для репетитора, а не строчка в настройках
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
      '<label class="admlbl">ключ репетитора <input type="password" id="adminkey" ' +
        'value="' + esc(adminKeySaved()) + '" autocomplete="off"></label>' +
      '<button class="rbtn sec" data-act="listall">Список всех учеников</button>' +
    '</div>' +
    '<p class="dim">Чужой прогресс только показывается — на этом устройстве ничего не меняется.</p>' +
    '<div id="srvout"></div></div>';
}

/* ================= экран группы: рабочее место репетитора =================
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
        Человеческую подпись репетитор заводит у себя (`admin.labels`), и она
        никуда не уходит. Это не неудобство, а снятое юридическое ограничение;
     2. только чтение. Репетитор ничего не меняет в чужом прогрессе;
     3. ⚠️ это не табель. «На кого посмотреть» — приглашение поговорить, а не
        список отстающих: вывод делает человек, и мы не имеем права выносить
        его за него. Тот же запрет, что на карте активности.
   ============================================================ */
var GROUP_MAX = 30;         /* столько учеников тянем за раз */
/* Порог тишины — 3 дня, был 5. «Не сел вовсе» — самая частая и самая дорогая
   подмена, и пять дней означали, что репетитор узнаёт о ней к следующему
   занятию, когда неделя уже потеряна. Три дня — ещё не тревога, но уже повод
   написать одно сообщение. */
var GROUP_QUIET_DAYS = 3;

/* Сводка по одному ученику из его прогресса. Работает на ЛЮБОМ снимке — и на
   своём, и на чужом, — потому что ничего не берёт из S. */
function groupRow(code, st, serverAt){
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
    var цена = lessonPrice(g);
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
  /* ⚠️ Затык — ПЕРЕД «тяжело шёл урок». Тот про уже сданный урок, то есть про
     случившийся успех; затык — про место, где ребёнок стоит и не двигается,
     и это единственная пометка, по которой репетитору надо действовать
     сегодня, а не при случае. Раньше её не было вовсе: строка группы, как и
     отчёт, считала только решённые уроки. */
  var stuck = stuckIn(st)[0];
  if (stuck){
    var sl = CURRICULUM.byId(stuck.id);
    marks.push({ k:"stuck", txt:"застрял на уроке «" + (sl ? sl.title : stuck.id) + "»: " +
      stuckWhy(stuck.log) });
  }
  if (tough){
    var l = CURRICULUM.byId(tough.id);
    marks.push({ k:"tough", txt:"тяжело шёл урок «" + (l ? l.title : tough.id) + "»" });
  }
  if (pred.all && pred.ok < pred.all)
    marks.push({ k:"pred", txt:"вывод предсказал " + pred.ok + " из " + pred.all });
  /* Домашка. ⚠️ Это тоже приглашение поговорить, а не табель: «не сдана» —
     факт со сроком, и рядом всегда стоит, сколько сдано, иначе строка читается
     как обвинение. */
  var hwAllRecs = hwRecords(st);
  var hwDone = hwAllRecs.filter(function(r){ return !!r.done; }).length;
  var hwOpen = hwAllRecs.length - hwDone;
  if (hwAllRecs.length && hwOpen)
    marks.push({ k:"hw", txt:"домашка: сдано " + hwDone + " из " + hwAllRecs.length });
  /* «Я застрял» — первой пометкой: ребёнок сам попросил, и ждёт он сейчас */
  var called = helpActive(st);
  if (called){
    var cl = CURRICULUM.byId(called.lesson);
    marks.unshift({ k:"help", txt:"🙋 зовёт: «" + HELP_WHY[called.why] + "»" + (cl ? ", урок " + cl.num : "") });
  }
  if (ready) marks.push({ k:"ready", txt:"часть работы пришла готовой: " + ready +
    " " + plural(ready, "урок", "урока", "уроков") });
  if (ahead) marks.push({ k:"ahead", txt:"в решении непройденное: " + ahead +
    " " + plural(ahead, "урок", "урока", "уроков") });

  return { code: code, label: adminLabel(code) || "", week: week, tries: tries,
           /* план и факт — по рамке, которую взрослый поставил ЭТОМУ ребёнку
              (корзина 3.5). Не пометка: показывается всегда и в обе стороны */
           plan: planFact(st),
           presence: presenceInfo(st, serverAt || 0),
           solved: Object.keys(sm).length, lastAt: lastAt, quiet: quiet,
           pred: pred, marks: marks, hwDone: hwDone, hwAll: hwAllRecs.length,
           /* для выдачи домашки всей группе: что пройдено и что уже висит.
              Держим id, а не полные записи, — строке группы больше не нужно */
           starsIds: Object.keys(sm),
           nextTitle: (function(){
             var t = "";
             CURRICULUM.forEach(function(w){ w.lessons.forEach(function(l){
               if (!t && sm[l.id] === undefined) t = l.title;
             }); });
             return t;
           })(),
           hwOpenIds: hwAllRecs.filter(function(r){ return !r.done; }).map(function(r){ return r.id; }),
           /* Пробные варианты ученика и заданное ему — по экзамену.
              ⚠️ Всё берётся из снимка st (правило: сводка по ученику считается
              из ЛЮБОГО снимка, а не из своего S), и копируется, а не даётся
              ссылкой: строка живёт дольше, чем ответ сервера. */
           vr: (function(){
             var out = {};
             Object.keys(st.variant || {}).forEach(function(k){
               var v = (st.variant || {})[k];
               if (!v || !v.seed) return;
               out[k] = { seed: v.seed, mins: v.mins || 0, closed: v.closed ? 1 : 0,
                          done: v.done || {}, sent: v.sent || {},
                          /* какие номера в его варианте ВООБЩЕ были: вариант,
                             собранный до 1.163.0, не знает Робота на 15-м, и
                             «не закрыл» там значит «номера не было» */
                          has: (v.items || []).filter(function(x){ return x.id; })
                                              .map(function(x){ return x.n; }) };
             });
             return out;
           })(),
           vtask: st.vtask || {},
           /* Чем выше, тем раньше показать. Молчание весит больше всего:
              «не сел вовсе» — самая частая и самая дорогая из трёх подмен.
              Сразу за ним — затык: этот ребёнок ещё ходит, но стоит на месте,
              и разговор с ним нужен раньше, чем с тем, у кого просто набежали
              пометки. Если не поговорить, он и станет следующим молчащим. */
           rank: (quiet >= GROUP_QUIET_DAYS ? 100 : 0) + (stuck ? 40 : 0) + (called ? 60 : 0) +
                 marks.length * 10 - week };
}

var groupState = { rows: null, busy: false, error: "", loaded: 0, total: 0 };

/* ===== напоминание молчащему =====
   Пометка «не занимался N дней» называет факт, а действие оставалось на
   репетиторе: сочинить сообщение. Теперь текст готов — скопировал и отправил
   ребёнку или родителю. ⚠️ Тон — приглашение, не укор: ни «ты забросил», ни
   «пропустил», ни счёта потерянных дней. Виноватый не возвращается. */
function quietReminderText(r){
  return "Привет! В тренажёре давно не было занятий — а там " +
    (r.nextTitle ? "ждёт урок «" + r.nextTitle + "», минут на двадцать" : "всё на месте и ждёт") +
    ". Если что-то застряло или было непонятно, напиши мне — разберём вместе.";
}

/* ===== домашка всей группе одной кнопкой =====
   То же, что выдача из карточки ученика, но по всем сразу. Два правила
   переносятся без ослабления:
     — каждый получает ТОЛЬКО задачи по пройденным ИМ урокам. «Всей группе»
       не значит «всем одинаково»: кто до урока не дошёл, тому задача не
       приедет, и это видно репетитору числом, а не выясняется у ребёнка;
     — семя у каждого своё (код в hwSeed), поэтому у соседей по группе разные
       числа в одном и том же условии — сверять ответы бесполезно.
   Пишем по одному и с перечитыванием записи перед записью — по тем же двум
   причинам, что groupLoad тянет по одному, а kidSave перечитывает. */
var grpHwState = { busy:false, done:0, total:0, note:"" };

function groupHwHTML(rows){
  var h = '<div class="card"><h3>📮 Домашка всей группе</h3>' +
    '<p class="dim">Каждый ученик получит только те задачи, чьи уроки он уже прошёл, — ' +
    'число напротив задачи говорит, скольким она уедет. Числа в условии у каждого свои: ' +
    'сверять ответы с соседом бесполезно. Проверит движок, звёзд домашка не даёт.</p>';
  if (grpHwState.note) h += '<div class="msg show ok">' + grpHwState.note + '</div>';
  h += '<div class="hwpick">';
  hwBank().forEach(function(it){
    /* скольким из группы задача может уехать: урок пройден и такая же не висит */
    var can = rows.filter(function(r){
      return r.starsIds.indexOf(it.after) >= 0 && r.hwOpenIds.indexOf(it.id) < 0;
    }).length;
    var l = CURRICULUM.byId(it.after);
    h += '<label class="hwitem' + (can ? "" : " off") + '">' +
      '<input type="checkbox" data-ghwpick="' + esc(it.id) + '"' + (can ? "" : " disabled") + '> ' +
      '<span>' + it.emoji + ' <b>' + esc(it.title) + '</b> ' +
      '<span class="dim">' + esc(it.tag) + (l ? " · после урока «" + esc(l.title) + "»" : "") +
      ' · получат: ' + can + ' из ' + rows.length + '</span></span></label>';
  });
  h += '</div>' +
    '<div class="admrow"><label class="admlbl">срок ' +
      '<input type="date" id="ghwdue" value="' + esc(shiftDay(dayKey(), 7)) + '"></label>' +
      '<span class="sp"></span>' +
      '<button class="rbtn check" id="ghwgive">Задать группе</button></div>' +
    '<p class="dim" id="ghwbar">' + (grpHwState.busy
      ? "Записано " + grpHwState.done + " из " + grpHwState.total + "…"
      : "Не больше " + HW_MAX + " задач за раз: домашка на десять задач — это не усердие, " +
        "а способ бросить всё в среду.") + '</p>' +
    '<div class="msg" id="ghwmsg"></div></div>';
  return h;
}

/* ===== вариант всей группе =====
   ⚠️ Здесь не рассылается ни одной задачи. Рассылается КОД: шесть букв,
   экзамен и режим. Вариант каждый ребёнок собирает у себя, и собирается ровно
   тот же самый — сборка есть чистая функция от (экзамен, семя). Из этого
   следует всё остальное: запись в прогресс ученика весит десятки байт, работа
   идёт офлайн после первой загрузки, а группе из тридцати человек достаётся
   один и тот же вариант, то есть результаты СРАВНИМЫ между собой.

   ⚠️ И ровно поэтому семя одно на всю группу — в отличие от домашки, где у
   каждого своё. Домашка меряет одного ученика, и одинаковые числа у соседей
   там вредны. Вариант меряет группу целиком, и разные варианты сделали бы
   отчёт бессмысленным: «просели на 17-м» можно сказать только про тех, кому
   17-й достался один и тот же.

   ⚠️ Чего здесь НЕ происходит: экзамен не начинается сам. Таймер пойдёт с той
   минуты, когда ребёнок нажмёт «Начать», а не когда репетитор нажал «Задать».
   Иначе заданный в понедельник экзамен истёк бы к среде, не открывшись. */
var grpVarState = { busy:false, done:0, total:0, note:"", ex:"ege", mins:0 };

/* Что задано группе сейчас: берём из самих учеников, а не из памяти
   устройства. ⚠️ Так отчёт переживает смену компьютера репетитора и работает
   у второго репетитора той же группы. Свежее назначение побеждает. */
function grpAssignOf(rows, exId){
  var best = null;
  (rows || []).forEach(function(r){
    var t = (r.vtask || {})[exId];
    if (!t || !t.seed) return;
    if (!best || (t.at || 0) > (best.at || 0)) best = t;
  });
  return best;
}

function groupVariantHTML(rows){
  var h = '<div class="card"><h3>📝 Вариант всей группе</h3>' +
    '<p class="dim">Одинаковый вариант каждому: по коду он собирается один и тот же на любом ' +
    'устройстве. Пересылать ничего не надо — уезжает только код. Кому кабинет не завели, ' +
    'тому код можно просто продиктовать: у ребёнка на экране варианта есть поле для него.</p>';
  if (grpVarState.note) h += '<div class="msg show ok">' + grpVarState.note + '</div>';
  h += '<div class="admrow"><label class="admlbl">экзамен ' +
    '<select id="gvex">' +
      ["ege", "oge"].map(function(id){
        var ex = (window.EXAMS || {})[id] || { title:id };
        return '<option value="' + id + '"' + (grpVarState.ex === id ? " selected" : "") + '>' +
          esc(ex.title) + '</option>';
      }).join("") +
    '</select></label>' +
    '<span class="sp"></span>' +
    '<label class="admlbl">режим ' +
    '<select id="gvmins">' +
      '<option value="0"' + (grpVarState.mins ? "" : " selected") + '>тренировка, без времени</option>' +
      [30, 60, 90].map(function(m){
        return '<option value="' + m + '"' + (grpVarState.mins === m ? " selected" : "") + '>' +
          'экзамен, ' + m + ' минут</option>';
      }).join("") +
    '</select></label>' +
    '<span class="sp"></span>' +
    '<label class="admlbl">срок <input type="date" id="gvdue" value="' +
      esc(shiftDay(dayKey(), 7)) + '"></label>' +
    '<span class="sp"></span>' +
    '<button class="rbtn check" id="gvgive">Задать группе</button></div>' +
    '<p class="dim" id="gvbar">' + (grpVarState.busy
      ? "Записано " + grpVarState.done + " из " + grpVarState.total + "…"
      : "Заданное отменяет прежнее назначение по этому экзамену. Начатые варианты " +
        "у детей при этом не стираются: новый встанет отдельной карточкой с кнопкой.") + '</p>' +
    '<div class="msg" id="gvmsg"></div></div>';
  return h;
}

/* ===== как группа прошла вариант =====
   ⚠️ Эта карточка про ЗАДАНИЯ, а не про детей. Список «кто сколько набрал» —
   это лидерборд, которого в продукте нет и не будет; здесь считается другое:
   на каких номерах просела ГРУППА, то есть где недоработали мы. Ровно за этим
   репетитор задаёт вариант всей группе, а не по одному. */
function groupVarReportHTML(rows){
  var out = "";
  ["ege", "oge"].forEach(function(exId){
    var task = grpAssignOf(rows, exId);
    if (!task || !task.seed) return;
    var ex = (window.EXAMS || {})[exId];
    if (!ex) return;
    var seed = String(task.seed);

    /* считаем только тех, у кого собран ИМЕННО этот вариант: сравнивать
       результаты по разным вариантам нельзя, и молчаливо смешивать их — врать */
    var mine = rows.filter(function(r){ return ((r.vr || {})[exId] || {}).seed === seed; });
    var closed = mine.filter(function(r){ return (r.vr[exId] || {}).closed; }).length;

    var items = VARIANT.buildItems(exId, seed).filter(function(x){ return x.id; });
    var lines = items.map(function(x){
      var n = mine.filter(function(r){ return ((r.vr[exId] || {}).done || {})[x.n]; }).length;
      /* ⚠️ Знаменатель — те, у кого номер в варианте был. Снимок без has (старый
         кабинет) считаем «был»: так было всегда, и хуже прежнего не станет. */
      var had = mine.filter(function(r){
        var h = (r.vr[exId] || {}).has;
        return !Array.isArray(h) || h.indexOf(x.n) >= 0;
      }).length;
      /* номер 15 ОГЭ — задача Робота, у неё свой список (1.163.0) */
      var t = x.kind === "robot" ? ROBOTS.robotById(x.id) : algoById(x.id);
      return { n: x.n, t: x.t, title: t ? t.title : x.id, ok: n, had: had };
    });
    var weak = lines.slice().sort(function(a, b){
      return (a.ok / Math.max(1, a.had)) - (b.ok / Math.max(1, b.had)) || a.n - b.n;
    });

    out += '<div class="card"><h3>📊 Как группа прошла вариант ' + esc(ex.title) + '</h3>' +
      '<p class="dim">Код <b>' + esc(seed) + '</b>' +
      (task.mins ? ' · экзамен на ' + task.mins + ' ' + plural(task.mins, "минуту", "минуты", "минут")
                 : ' · тренировка') +
      (task.due ? ' · срок ' + esc(task.due) : '') + '. ' +
      'Собрали его у себя: <b>' + mine.length + '</b> из ' + rows.length +
      ', довели до итога: <b>' + closed + '</b>.</p>';

    if (!mine.length){
      out += '<p class="dim">Пока никто не открывал. Отчёт появится, как только вариант ' +
        'соберут: до этого у нас нет ни одного ответа, и показывать нули значило бы ' +
        'выдать «никто не решил» за «никто не начинал».</p></div>';
      return;
    }

    /* ⚠️ Честность к малым числам — то же правило, что в «Возвращаемости»:
       на трёх учениках «просело на 17-м» это случай, а не замер. */
    if (mine.length < 5)
      out += '<p class="dim">⚠️ Вариант собрали меньше пяти человек: ниже случаи, а не замер. ' +
        'Числа начнут что-то значить с пятого-десятого.</p>';

    out += '<div class="exmap">';
    weak.slice(0, 8).forEach(function(l){
      var st = !l.had ? "soon" : l.ok === 0 ? "no" : (l.ok * 2 <= l.had ? "part" : "yes");
      out += '<div class="exrow ' + st + '"><span class="exn">' + l.n + '</span>' +
        '<span class="ext">' + esc(l.t) +
        '<span class="vartask">' + esc(l.title) + '</span></span>' +
        '<span class="exact"><span class="excnt">закрыли ' + l.ok + ' из ' + l.had +
        (l.had < mine.length ? ' · у ' + (mine.length - l.had) + ' номера не было: вариант собран до того, ' +
          'как он появился' : '') +
        '</span></span></div>';
    });
    out += '</div>';
    var allOk = lines.filter(function(l){ return l.had && l.ok === l.had; }).length;
    out += '<p class="dim">Показаны восемь самых трудных номеров из ' + lines.length +
      '. Закрыли все, кто собирал: ' + allOk + '.</p></div>';
  });
  return out;
}

/* Записать назначение каждому. Пишем по одному и с перечитыванием записи —
   по тем же двум причинам, что groupLoad тянет по одному, а kidSave
   перечитывает: тридцать одновременных запросов к облачной функции это
   очередь, а чужую запись нельзя затирать своей копией. */
function groupAssignVariant(exId, mins, due){
  var msg = document.getElementById("gvmsg");
  function say(cls, html){ if (msg){ msg.className = "msg show " + cls; msg.innerHTML = html; } }
  var rows = groupState.rows || [];
  if (!rows.length) return say("warn", "<b>Группа не загружена</b>Сначала загрузите группу.");
  if (grpVarState.busy) return;
  var ex = (window.EXAMS || {})[exId];
  if (!ex) return say("warn", "<b>Не выбран экзамен</b>");

  /* семя одно на всех — в этом весь смысл (см. шапку раздела) */
  var seed = VARIANT.makeVariant(exId, mins).seed;
  var at = Date.now();
  grpVarState.busy = true; grpVarState.done = 0; grpVarState.total = rows.length; grpVarState.note = "";
  say("warn", "<b>Записываю…</b>");
  var okN = 0, failed = 0, i = 0;

  function bar(){
    var el = document.getElementById("gvbar");
    if (el) el.textContent = "Записано " + grpVarState.done + " из " + grpVarState.total + "…";
  }
  function finish(){
    grpVarState.busy = false;
    grpVarState.note = "<b>Задано</b>Вариант " + esc(ex.title) + " № <b>" + esc(seed) + "</b> — " +
      (mins ? "экзамен на " + mins + " " + plural(mins, "минуту", "минуты", "минут") : "тренировка") +
      ". Получили: " + okN + " из " + rows.length +
      (failed ? ", не записалось: " + failed : "") +
      ". Код можно продиктовать и тем, кого в группе нет.";
    screenGroup();
  }
  function next(){
    if (i >= rows.length) return finish();
    var row = rows[i++];
    return Cloud.load(row.code).then(function(r){
      var base = ensureShape(r.found && r.data ? r.data : blankProgress());
      base.vtask = base.vtask || {};
      base.vtask[exId] = { seed: seed, mins: mins || 0, at: at, due: due || "", by: "репетитор", group: 1 };
      return Cloud.save(base, row.code).then(function(){
        okN++; grpVarState.done++; bar(); return next();
      });
    }, function(){ failed++; grpVarState.done++; bar(); return next(); });
  }
  /* Промис наружу — чтобы тест мог дождаться конца записи. Через
     Promise.resolve по той же причине, что и в выдаче домашки: пустая группа
     доходит до finish() синхронно и вернула бы undefined. */
  return Promise.resolve(next()).catch(function(err){
    grpVarState.busy = false;
    say("bad", "<b>Не записалось</b>" + esc((err && err.message) || err));
  });
}

function wireGroupVariant(){
  var btn = document.getElementById("gvgive");
  if (!btn) return;
  btn.onclick = function(){
    var exId = (document.getElementById("gvex") || {}).value || "ege";
    var mins = parseInt((document.getElementById("gvmins") || {}).value || "0", 10) || 0;
    var due = (document.getElementById("gvdue") || {}).value || "";
    grpVarState.ex = exId; grpVarState.mins = mins;
    groupAssignVariant(exId, mins, due);
  };
}

/* ===== метрики возвращаемости =====
   Ответ на два вопроса из плана (docs/razvitie-2026-09-05.md, корзина 4):
   возвращается ли ребёнок через неделю и доходит ли до конца мира. Без этих
   цифр всё остальное строится вслепую — главный незакрытый вопрос продукта
   «доходит ли чужой ребёнок до 20-го урока» закрывается ровно здесь.
   Считает сервер по всем снимкам (op=stats), ключ тот же, что у списка. */
var grpStats = { data: null, busy: false, error: "" };

function groupStatsHTML(){
  var h = '<div class="card"><h3>📈 Возвращаемость</h3>' +
    '<p class="dim">Две главные цифры курса: вернулся ли ребёнок в первую неделю ' +
    'и доходит ли до конца мира. Считается по всем ученикам на сервере, не только по группе.</p>';
  if (grpStats.error)
    h += '<div class="msg show bad"><b>Не получилось</b>' + esc(grpStats.error) + '</div>';
  var m = grpStats.data;
  if (m){
    h += '<ul class="trsum">' +
      '<li>Кодов на сервере: <b>' + m.students + '</b>, начинали заниматься: <b>' + m.started + '</b>.</li>';
    if (m.week.eligible)
      h += '<li>Вернулись в первую неделю: <b>' + m.week.returned + ' из ' + m.week.eligible +
        '</b> начавших неделю назад и раньше.</li>';
    else
      h += '<li>Возвращение за неделю считать пока не по кому: ни у кого не закрылось окно первых семи дней.</li>';
    h += '<li>Дошли до конца мира: ' + m.reach.map(function(x, i){
        return 'мир ' + (i + 1) + ' — <b>' + x.students + '</b>';
      }).join(" · ") + '.</li>' +
      '<li>За четыре недели занимались: <b>' + m.month.active + '</b>, медиана уроков на ученика: <b>' +
        m.month.medianLessons + '</b>.</li></ul>';
    /* ⚠️ Честность к малым числам: доля из трёх человек — случай, а не замер,
       и говорить это обязан сам экран, а не память фаундера. */
    if (m.started && m.started < 5)
      h += '<p class="dim">⚠️ Начавших меньше пяти: это ещё случаи, а не замер. ' +
        'Доли начнут что-то значить с пятого-десятого ученика.</p>';
  }
  h += '<div class="admrow"><button class="rbtn sec" id="grpstats">' +
    (m ? "Пересчитать" : "Посчитать") + '</button>' +
    (grpStats.busy ? '<span class="dim">Считаю…</span>' : '') + '</div></div>';
  if (m) h += stuckTopHTML(m.stuck);
  return h;
}

/* ===== где застревают — отдельной карточкой =====
   ⚠️ Все остальные цифры на этом экране про детей: кто сдал, кто вернулся,
   кто молчит. Эта одна — про НАС. Урок, который взяли десять, сдали двое, а
   восемь сидят на нём с попытками и без решения, — это наша ошибка, а не их
   лень: непонятное условие, пропущенный шаг в теории, слишком большой прыжок.
   Поэтому карточка стоит отдельно и говорит это прямо: иначе строчка внутри
   «Возвращаемости» прочитается как ещё один список отстающих.
   Считает сервер (op=stats), названия уроков подставляем здесь: на сервере
   курса нет, там только идентификаторы. */
function stuckTopHTML(rows){
  if (!rows) return "";                 /* старый ответ сервера — молчим, а не врём нулём */
  var h = '<div class="card"><h3>⛔ Где застревают</h3>' +
    '<p class="dim">Единственная цифра на этом экране, которая говорит не про детей, ' +
    'а про урок. Застрявший — это тот, кто урок не сдал, а попыток, подсказок и ' +
    'открытых решений набрал на ' + STUCK_PRICE + ' и больше. Смотреть в первую очередь ' +
    'на строки, где застрявших больше, чем сдавших: там дело почти наверняка в уроке.</p>';
  if (!rows.length)
    return h + '<p class="dim">Никто нигде не застрял: нерешённых уроков с такой ценой ' +
      'на сервере нет.</p></div>';
  h += '<ul class="trsum">';
  rows.forEach(function(r){
    var l = CURRICULUM.byId(r.lesson);
    var name = l ? ("урок " + l.num + " · " + l.title) : r.lesson;
    var beda = r.stuck > r.solved;
    h += '<li>' + (beda ? "⚠️ " : "") + '<b>' + esc(name) + '</b> — застряли <b>' + r.stuck +
      '</b> из ' + r.tried + ' ' + plural(r.tried, "взявшегося", "взявшихся", "взявшихся") +
      ', сдали ' + r.solved + '. Попыток у застрявших в среднем: ' + r.avgAttempts + '.' +
      (beda ? ' <b>Застрявших больше, чем сдавших.</b>' : '') + '</li>';
  });
  h += '</ul><p class="dim">⚠️ На одном-двух учениках это ещё не сигнал: ' +
    'застрять на любом уроке может кто угодно. Сигналом строка становится тогда, ' +
    'когда за урок бралось хотя бы пятеро.</p></div>';
  return h;
}
function bindGroupStats(){
  var btn = document.getElementById("grpstats");
  if (!btn) return;
  btn.onclick = function(){
    var key = ((document.getElementById("grpkey") || {}).value || "").trim() || adminKeySaved();
    if (!key){ grpStats.error = "Нужен ключ репетитора — впишите его выше."; return screenGroup(); }
    adminKeyRemember(key);
    grpStats.busy = true; grpStats.error = ""; screenGroup();
    Cloud.stats(key).then(function(m){
      grpStats.busy = false; grpStats.data = m; screenGroup();
    }, function(err){
      grpStats.busy = false; grpStats.error = (err && err.message) || String(err);
      screenGroup();
    });
  };
}

function bindGroupHw(){
  var btn = document.getElementById("ghwgive");
  if (!btn) return;
  var boxes = Array.prototype.slice.call(document.querySelectorAll("[data-ghwpick]"));
  var locked = boxes.filter(function(b){ return b.disabled; });
  function picked(){ return boxes.filter(function(b){ return b.checked; }); }
  boxes.forEach(function(b){
    b.onchange = function(){
      var n = picked().length;
      boxes.forEach(function(x){
        if (locked.indexOf(x) >= 0) return;
        x.disabled = !x.checked && n >= HW_MAX;
      });
    };
  });
  btn.onclick = function(){
    var ids = picked().map(function(b){ return b.getAttribute("data-ghwpick"); });
    var due = (document.getElementById("ghwdue") || {}).value || "";
    groupAssignHW(ids, due);
  };
}

function groupAssignHW(ids, due){
  var msg = document.getElementById("ghwmsg");
  function say(cls, html){ if (msg){ msg.className = "msg show " + cls; msg.innerHTML = html; } }
  var rows = groupState.rows || [];
  if (!ids || !ids.length) return say("warn", "<b>Ничего не отмечено</b>Выберите хотя бы одну задачу.");
  if (!rows.length) return say("warn", "<b>Группа не загружена</b>Сначала загрузите группу.");
  if (grpHwState.busy) return;
  ids = ids.slice(0, HW_MAX);

  grpHwState.busy = true; grpHwState.done = 0; grpHwState.total = rows.length; grpHwState.note = "";
  say("warn", "<b>Записываю…</b>");
  var dayk = dayKey();
  var gotKids = 0, gotTasks = 0, skipped = 0, failed = 0, i = 0;

  function bar(){
    var el = document.getElementById("ghwbar");
    if (el) el.textContent = "Записано " + grpHwState.done + " из " + grpHwState.total + "…";
  }
  function next(){
    if (i >= rows.length) return finish();
    var row = rows[i++];
    /* что из отмеченного этому ученику вообще можно: урок пройден, такая же не висит */
    var mine = ids.filter(function(id){
      var it = hwById(id);
      return it && row.starsIds.indexOf(it.after) >= 0 && row.hwOpenIds.indexOf(id) < 0;
    });
    skipped += ids.length - mine.length;
    if (!mine.length){ grpHwState.done++; bar(); return next(); }
    return Cloud.load(row.code).then(function(r){
      var base = ensureShape(r.found && r.data ? r.data : blankProgress());
      var added = 0;
      mine.forEach(function(id){
        var seed = hwSeed(row.code, id, dayk), key = hwKey(id, seed);
        if (base.hw[key]) return;
        base.hw[key] = { id:id, seed:seed, due:due || "", by:"репетитор",
                         at: Date.now(), done:0, tries:0 };
        added++;
      });
      if (!added){ grpHwState.done++; bar(); return next(); }
      return Cloud.save(base, row.code).then(function(){
        gotKids++; gotTasks += added;
        /* строка группы пересчитывается из свежей записи — счётчик «домашка
           A/B» обновится без перезагрузки всей группы */
        var fresh = groupRow(row.code, base);
        for (var k = 0; k < rows.length; k++) if (rows[k].code === row.code) rows[k] = fresh;
        grpHwState.done++; bar();
        return next();
      });
    }, function(){ failed++; grpHwState.done++; bar(); return next(); });
  }
  function finish(){
    grpHwState.busy = false;
    /* Итог обязан называть и то, что НЕ уехало: репетитор, уверенный, что
       задал всем, хуже репетитора, который знает, что троим не дошло. */
    grpHwState.note = "<b>Домашка задана</b>Получили: " + gotKids + " " +
      plural(gotKids, "ученик", "ученика", "учеников") + ", всего " + gotTasks + " " +
      plural(gotTasks, "задача", "задачи", "задач") + "." +
      (skipped ? " Не уехало " + skipped + " " + plural(skipped, "задача", "задачи", "задач") +
        ": урок ещё не пройден или такая же уже задана." : "") +
      (failed ? " ⚠️ Не записалось " + failed + " " + plural(failed, "ученику", "ученикам", "ученикам") +
        " — сервер не ответил, попробуйте ещё раз." : "");
    screenGroup();
  }
  /* Промис наружу — чтобы тест мог дождаться конца записи.
     ⚠️ Через Promise.resolve: если всем всё пропущено, next() доходит до
     finish() синхронно и возвращает undefined, а не промис. */
  return Promise.resolve(next()).catch(function(err){
    grpHwState.busy = false;
    say("bad", "<b>Не записалось</b>" + esc((err && err.message) || err));
  });
}

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
        if (res && res.found && res.data) rows.push(groupRow(code, ensureShape(res.data), res.serverAt || 0));
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
  voiceStop(); routeFor("group"); claimScreen();
  if (!adminUnlocked()) return adminGate(screenGroup);
  var rows = groupState.rows;

  var h = '<div class="lvlhead"><div><div class="idx">рабочее место репетитора</div>' +
    '<h1>👨‍🏫 Группа</h1></div><div class="right"><span class="tag">только чтение</span></div></div>' +
    roomNavHTML("group") +
    '<p class="lede">Код проверил движок. Ваше дело — посмотреть, с кем поговорить.</p>';

  h += '<div class="card"><h3>🔑 Ключ репетитора</h3>' +
    '<div class="admrow"><label class="admlbl">ключ ' +
      '<input type="password" id="grpkey" value="' + esc(adminKeySaved()) + '" autocomplete="off"></label>' +
      '<button class="rbtn check" id="grpload">Загрузить группу</button></div>' +
    '<p class="dim" id="grpbar">' + (groupState.busy
      ? "Загружено " + groupState.loaded + " из " + groupState.total + "…"
      : "Тот же ключ, что задан в настройках функции как ADMIN_KEY. Больше " +
        GROUP_MAX + " учеников за раз не тянем.") + '</p>' +
    (groupState.error ? '<div class="msg show bad"><b>Не получилось</b>' + esc(groupState.error) + '</div>' : '') +
    '</div>';

  h += groupStatsHTML();

  /* ⚠️ Рамка честности стоит до цифр — как на записи авторства, и по той же
     причине: список «на кого посмотреть» без неё читается как список плохих. */
  h += '<div class="card"><h3>⚖️ Что это за таблица</h3><ul class="trrules">' +
    '<li><b>Это не табель.</b> «Посмотреть в первую очередь» — приглашение поговорить, ' +
    'а не список отстающих.</li>' +
    '<li><b>Имён детей на сервере нет.</b> Там код и результаты. Подпись «Петя, 5 класс» ' +
    'стоит у вас и никуда не уходит.</li>' +
    '<li><b>Только чтение.</b> Изменить чужой прогресс отсюда нельзя.</li>' +
    '</ul></div>';

  if (rows && rows.length){
    var weekAll = 0, triesAll = 0;
    /* План и факт по группе (корзина 3.5): первое, что репетитор спрашивает
       про группу, — не «сколько пройдено», а «кто не успевает». ⚠️ Считаем
       и тех, у кого рамки нет: без неё плана не существует, и молчаливо
       записывать такого ученика в «идёт по плану» значит врать. */
    var planOk = 0, planBehind = 0, planNo = 0;
    rows.forEach(function(r){
      weekAll += r.week; triesAll += r.tries;
      if (r.plan.none) planNo++;
      else if (r.plan.kind === "behind") planBehind++;
      else planOk++;
    });
    h += '<div class="card"><h3>📊 За неделю</h3><ul class="trsum">' +
      '<li>Учеников: <b>' + rows.length + '</b>.</li>' +
      '<li>Уроков сдано: <b>' + weekAll + '</b>.</li>' +
      (planOk + planBehind
        ? '<li>По своей рамке идут или впереди: <b>' + planOk + '</b> из <b>' +
          (planOk + planBehind) + '</b>' +
          (planNo ? ', ещё у <b>' + planNo + '</b> рамка занятий не задана — ' +
                    'им план сравнивать не с чем' : '') + '.</li>'
        : '<li>Рамка занятий не задана ни у кого: плана нет, и «успевает или нет» ' +
          'сравнивать не с чем. Рамка ставится в карточке ученика.</li>') +
      /* Число, ради которого всё и затевалось: столько раз движок прочитал
         и выполнил код вместо человека. У конкурентов это ручные часы. */
      '<li>Проверок сделал движок: <b>' + triesAll + '</b> — столько программ ' +
      'не пришлось читать глазами.</li>' +
      '</ul></div>';

    h += groupHwHTML(rows);
    /* ⚠️ Задать — выше отчёта: репетитор чаще приходит сюда задавать, чем
       смотреть. А отчёт стоит сразу под ним, чтобы «задал» и «что вышло»
       читались одной мыслью, а не в разных концах экрана. */
    h += groupVariantHTML(rows);
    h += groupVarReportHTML(rows);

    h += '<div class="card"><h3>👥 Кто как шёл</h3><div class="grouplist">';
    rows.forEach(function(r){
      /* Подпись читаем ЖИВУЮ, а не ту, что легла в строку при загрузке:
         репетитор подписывает учеников уже после того, как группа пришла с
         сервера, и кэшированное имя показывало бы старое. */
      var lbl = adminLabel(r.code) || "";
      h += '<div class="grouprow' + (r.marks.length ? "" : " ok") + '">' +
        '<div class="grphead"><b>' +
        (r.presence ? '<span class="grlive" title="сейчас в тренажёре">🟢</span> ' : '') +
        esc(lbl || r.code) + '</b>' +
        '<span class="dim">' + (lbl ? esc(r.code) + " · " : "") +
        'за неделю ' + r.week + ' · всего ' + r.solved +
        (r.hwAll ? ' · домашка ' + r.hwDone + '/' + r.hwAll : '') + ' · ' +
        (r.lastAt ? fmtWhen(r.lastAt) : "занятий не было") + '</span></div>' +
        /* ⚠️ План и факт — отдельная строка, а не пометка в списке «на кого
           посмотреть». Пометка появляется только когда что-то не так, и план
           в этом списке читался бы как обвинение; здесь же «по плану» и
           «впереди» видны ровно так же, как «отстаёт». */
        '<div class="grpplan ' + (r.plan.none ? "none" : r.plan.kind) + '">' +
          '📅 ' + esc(planFactText(r.plan)) + '</div>' +
        (r.marks.length
          ? '<ul class="trmarks">' + r.marks.map(function(m){
              return '<li class="' + m.k + '">' + esc(m.txt) + '</li>';
            }).join("") + '</ul>'
          : '<p class="dim">Шёл ровно: сам, без подсказок и без пауз.</p>') +
        '<div class="partbar">' +
        '<button class="rbtn check" data-gview="' + esc(r.code) + '">Открыть прогресс</button>' +
        '<button class="rbtn sec" data-glabel="' + esc(r.code) + '">Подписать</button>' +
        /* ⚠️ Репетитор — единственная настоящая дорога восстановления доступа
           в продукте: почты и телефона мы не спрашиваем, и если код потерян,
           знать его больше некому. Поэтому карточку можно распечатать прямо
           отсюда и отдать ученику на бумаге. */
        '<button class="rbtn sec" data-gcard="' + esc(r.code) + '">🖨 Карточка доступа</button>' +
        /* напоминание — только тому, кто ЗАНИМАЛСЯ и замолчал: тому, кто не
           начинал, нужна ссылка-приглашение, а не «возвращайся» */
        (r.lastAt && r.quiet >= GROUP_QUIET_DAYS
          ? '<button class="rbtn sec" data-gremind="' + esc(r.code) + '">✉️ Текст напоминания</button>'
          : '') + '</div></div>';
    });
    h += '</div></div>';
  } else if (!groupState.busy){
    h += '<div class="card"><h3>Группа не загружена</h3>' +
      '<p class="dim">Введите ключ репетитора и нажмите «Загрузить группу». ' +
      'Если сервер не настроен, сначала пройдите настройку в панели репетитора.</p></div>';
  }

  h += '<div class="pager"><button class="bigbtn ghost" data-gback="1">← В панель репетитора</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" data-ghome="1">На главную</button></div>';

  app.innerHTML = h;
  wireRoomNav(app);
  bindGroupHw();
  bindGroupStats();
  var lb = document.getElementById("grpload");
  if (lb) lb.onclick = function(){
    var key = (document.getElementById("grpkey").value || "").trim();
    if (!key){ groupState.error = "Нужен ключ репетитора."; return screenGroup(); }
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
  app.querySelectorAll("[data-gremind]").forEach(function(b){
    b.onclick = function(){
      var code = b.getAttribute("data-gremind");
      var row = (groupState.rows || []).filter(function(r){ return r.code === code; })[0];
      if (row) copyText(quietReminderText(row), b);
    };
  });
  app.querySelectorAll("[data-gcard]").forEach(function(b){
    b.onclick = function(){
      var code = b.getAttribute("data-gcard");
      openAccessCard(code, adminLabel(code) || "");
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
  wireGroupVariant();
  app.querySelectorAll("[data-gback]").forEach(function(b){
    b.onclick = function(){ screenAdmin(); };
  });
  app.querySelectorAll("[data-ghome]").forEach(function(b){ b.onclick = goHome; });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

var ADM_TABS = [
  ["over", "📊", "Обзор"],
  ["srv",  "☁️", "Сервер"],
  ["les",  "📚", "Уроки и звёзды"],
  ["file", "💾", "Перенос"]
];
var admTab = "over";
function admPane(id, inner){
  return '<div class="apane" data-apane="' + id + '"' + (admTab === id ? "" : " hidden") + '>' +
    inner + '</div>';
}
function screenAdmin(){
  /* без clearAdminHash: этот экран открывается по #panel и живёт под ним */
  curPlace = "admin";
  stopTimer(); vizStopPlay();
  voiceStop(); routeFor("admin"); claimScreen();
  if (!adminUnlocked()) return adminGate(screenAdmin);

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
      '<h1>🔐 Панель репетитора</h1></div><div class="right"><span class="tag">код принят</span></div></div>' +
      roomNavHTML("admin") +
      '<p class="lede">' + (cloudEnabled()
        ? 'Прогресс синхронизируется с сервером — его видно с любого устройства.'
        : 'Прогресс лежит в памяти <b>этого</b> браузера. Чтобы видеть его с другого устройства, ' +
          'подключите сервер или перенесите файлом — вкладки ниже.') + '</p>';

    /* Панель разложена по ВКЛАДКАМ. Плитки-указатели, подводившие к карточкам
       прокруткой, прожили один день (1.103.0): прокрутку они не убирали, а
       только удлиняли её на себя. Жалоба фаундера 08.09.2026: «нужна панель
       управления сверху, вкладки: открываешь, смотришь, меняешь».
       ⚠️ Разделы отрисованы ВСЕ сразу, вкладка только прячет чужие (hidden):
       переключение мгновенно, обработчики и набранный текст не пропадают.
       admTab — переменная модуля: «Открыть все уроки» перерисовывает экран,
       и взрослый обязан остаться на той же вкладке. */
    if (!ADM_TABS.some(function(t){ return t[0] === admTab; })) admTab = "over";
    h += '<div class="ltabs admnav" role="tablist">' + ADM_TABS.map(function(t){
      return '<button class="ltab' + (t[0] === admTab ? " on" : "") + '" role="tab" data-atab="' + t[0] + '"' +
        ' aria-selected="' + (t[0] === admTab ? "true" : "false") + '">' +
        '<span class="lte">' + t[1] + '</span>' + t[2] + '</button>';
    }).join("") + '</div>';

    h += admPane("over",
      statsGridHTML(S) + weekReportHTML(S) +
      '<div class="card"><h3>👨‍👩‍👦 Кабинет взрослого этого устройства</h3>' +
      '<p class="dim">Рамка занятий, отчёт и задание для ребёнка, который занимается ' +
      'прямо на этом устройстве.</p><div class="admrow">' +
      '<button class="rbtn check" data-act="toadult">Открыть →</button></div></div>');

    h += admPane("srv", serverCardHTML());

    var lesPane = '<div class="card" id="admfast"><h3>Быстрые действия</h3><div class="admrow">' +
      '<button class="rbtn ' + (S.admin.unlockAll ? "check" : "sec") + '" data-act="unlockall">' +
        (S.admin.unlockAll ? "✓ Все уроки открыты" : "Открыть все уроки") + '</button>' +
      '<button class="rbtn sec" data-act="passready">Зачесть все готовые на 3★</button>' +
      '<button class="rbtn sec" data-act="resetall">Сбросить весь прогресс</button>' +
      '</div><p class="dim">«Открыть все уроки» только снимает замки, звёзды не ставит. ' +
      'Настройка этого устройства, на сервер не уходит.</p></div>';

    lesPane += '<div class="card"><h3>Опыт и бейджи</h3><div class="admrow">' +
      '<label class="admlbl">XP <input type="number" id="xpin" value="' + S.xp + '" min="0" step="25"></label>' +
      '<button class="rbtn sec" data-act="setxp">Записать</button></div>' +
      '<div class="admbadges">' +
      BADGES.map(function(b){
        var got = S.badges.indexOf(b.id) >= 0;
        return '<button class="admbadge' + (got ? " got" : "") + '" data-act="badge" data-id="' + b.id + '">' +
          '<span class="em">' + b.em + '</span><span>' + b.name + '</span></button>';
      }).join("") +
      '</div><p class="dim">Нажатие на бейдж выдаёт его или отбирает.</p></div>';

    lesPane += lessonTableHTML(S, true);
    h += admPane("les", lesPane);

    h += admPane("file", '<div class="card" id="admfile"><h3>Перенос прогресса файлом</h3>' +
      '<div class="admrow">' +
        '<button class="rbtn sec" data-act="download">↓ Скачать файл прогресса</button>' +
        '<button class="rbtn sec" data-act="copy">Скопировать текст</button>' +
      '</div>' +
      '<p class="dim">Способ без сервера: скачал здесь — вставил в это же поле на другом ' +
      'устройстве. ⚠️ Загрузка файла <b>заменяет</b> прогресс целиком, а не сливает. ' +
      'Пароль кабинета в файл не входит и при загрузке не меняется.</p>' +
      '<textarea class="admjson" id="admjson" spellcheck="false">' + esc(progressJSON()) + '</textarea>' +
      '<div class="admrow"><button class="rbtn sec" data-act="import">Загрузить из этого поля</button></div>' +
      '<div class="msg" id="admmsg"></div></div>');

    h += '<div class="pager"><button class="bigbtn ghost" data-act="tomap">← На главную</button>' +
      '<span class="sp"></span><button class="bigbtn ghost" data-act="lock">Выйти из панели</button></div>';
  }

  /* контейнер создаётся заново при каждой отрисовке — обработчик не копится */
  app.innerHTML = '<div id="adm"></div>';
  var box = document.getElementById("adm");
  box.innerHTML = h;
  wireRoomNav(box);
  box.querySelectorAll("[data-atab]").forEach(function(b){
    b.onclick = function(){
      admTab = b.getAttribute("data-atab");
      box.querySelectorAll("[data-atab]").forEach(function(x){
        var on = x.getAttribute("data-atab") === admTab;
        x.classList.toggle("on", on);
        x.setAttribute("aria-selected", on ? "true" : "false");
      });
      box.querySelectorAll("[data-apane]").forEach(function(p){
        p.hidden = p.getAttribute("data-apane") !== admTab;
      });
    };
  });

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
    else if (act === "toadult"){ screenAdult(); }
    else if (act === "unlockall"){ S.admin.unlockAll = !S.admin.unlockAll; saveLocal(); screenAdmin(); }
    else if (act === "passready"){
      /* ⚠️ Спрашиваем, потому что отменить нечем: настоящие звёзды затираются
         тройками, XP раздувается, а solvedAt проставляется задним числом — то
         есть недельный отчёт и «что далось тяжело» превращаются в выдумку.
         Кнопка вдобавок стоит вплотную к «Сбросить весь прогресс», у которой
         подтверждение было, а у этой не было. */
      if (!confirm("Зачесть ВСЕ готовые уроки на три звезды?\n\n" +
                   "Настоящие результаты будут затёрты: звёзды, опыт и журнал " +
                   "(попытки, подсказки, время) станут выдуманными. Вернуть их будет нечем."))
        return;
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
    /* Третья кнопка подряд в плотной таблице на сто строк: промах пальцем стирал
       звёзды и весь журнал урока — время, попытки, подсказки, — а взять их
       больше неоткуда. Одного вопроса достаточно, чтобы промах не был приговором. */
    else if (act === "clear"){
      var cl = null;
      CURRICULUM.forEach(function(w){
        w.lessons.forEach(function(l){ if (l.id === id) cl = l; });
      });
      if (!confirm("Сбросить урок " + (cl ? cl.n + " · " + cl.title : id) + "?\n\n" +
                   "Пропадут звёзды и журнал урока: время, попытки, подсказки."))
        return;
      setStars(id, 0); delete S.log[id]; save(); refreshTop(); screenAdmin();
    }
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
      /* ⚠️ cloudPush при ненастроенном обмене РЕЗОЛВИТСЯ (false), а не падает.
         Раньше это давало родителю «Отправлено. Прогресс лежит на сервере»,
         когда не ушло ничего, — он уходил в уверенности, что копия есть.
         Спрашиваем до отправки: сказать «не настроено» честнее, чем отчитаться
         об успехе несделанного. */
      if (!cloudEnabled()){ srv("bad", cloudOffWhy("отправить")); return; }
      srv("warn", "<b>Отправляю…</b>");
      cloudPush().then(function(ok){
        screenAdmin();
        if (ok) srv("ok", "<b>Отправлено</b>Прогресс лежит на сервере.");
        else srv("bad", cloudOffWhy("отправить"));
      }, function(err){ srv("bad", "<b>Не отправилось</b>" + esc(err.message || err)); });
    }
    else if (act === "pull"){
      /* та же ловушка, что и у «Отправить»: без настройки cloudPull резолвится
         false, и «Уже одинаково» прозвучало бы как отчёт о состоянии сервера,
         хотя запроса не было вовсе */
      if (!cloudEnabled()){ srv("bad", cloudOffWhy("забрать")); return; }
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
          ". Ключ репетитора " + (r.adminKeySet ? "задан" : "не задан — список учеников будет закрыт") + ".");
      }, function(err){ srv("bad", "<b>Проверка не прошла</b>" + esc(err.message || err)); });
    }
    else if (act === "togroup") return screenGroup();
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
      if (!key){ srv("bad", "<b>Пусто</b>Нужен ключ репетитора — тот, что задан в настройках функции как ADMIN_KEY."); return; }
      adminKeyRemember(key);
      srv("warn", "<b>Загружаю…</b>");
      Cloud.list(key).then(function(r){
        var st = r.students || [];
        if (!st.length){ srv("warn", "<b>Пока никого</b>На сервере нет ни одного ученика."); return; }
        srv("ok", "<b>Учеников на сервере: " + st.length + "</b>" +
          '<div class="admlist">' + st.map(function(s){
            /* Имени ученика на сервере НЕТ и не будет: оно не уезжает с
               устройства ребёнка (см. cloudSnapshot). Поэтому в списке стоит
               код, а человеческую подпись репетитор заводит себе сам — она
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
      /* пароль остаётся тот, что у ЭТОГО устройства: из файла его не берём
         (в старых файлах он есть), а без него загрузка оставила бы кабинет
         без замка — пароль тогда придумал бы первый вошедший */
      var keepPass = (S.admin && S.admin.pass) || "";
      Object.keys(S).forEach(function(k){ delete S[k]; });
      Object.assign(S, blankProgress());
      S.admin = { unlockAll:false };
      Object.keys(obj).forEach(function(k){ S[k] = obj[k]; });
      ensureShape(S);
      S.admin.pass = keepPass;
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

/* ============================================================
   ИГРА ПО ССЫЛКЕ: друг открывает — и сразу играет.
   Сильнейший детский крючок из доступных без ПДн (план
   docs/razvitie-2026-09-05.md, п. 1.3): ребёнок собрал игру, отправил
   ссылку — друг ИГРАЕТ, а потом может открыть код и собрать свою.

   Чем это отличается от «Поделиться работой» (#work=), где запуск закрыт
   намеренно: там ссылкой уезжает ЛЮБАЯ программа, и экран честно показывает
   только код. Здесь уезжает ИГРА — интерактивная программа, чей смысл именно
   в запуске: показывать её кодом вперёд значит показывать фокус с изнанки.
   Порядок перевёрнут: сначала играешь, потом заглядываешь в код.

   Как и всё остальное «по ссылке»: ничего не хранится на сервере, игра лежит
   в самой ссылке, ПДн не появляется. Имя автора — по правилу «своего
   задания»: без него «смотри, что я сделал» теряет смысл.
   ============================================================ */
var PLAY_CODE_MAX = 4000;   /* игры длиннее задач — своя граница, но тоже открытка */

function playPack(w){
  return b64urlEnc(JSON.stringify({ v:1, t:w.title, c:w.code, a:w.author || "", e:w.emoji || "" }));
}
function playUnpack(s){
  var o = null;
  try { o = JSON.parse(b64urlDec(s)); } catch(e){ return null; }
  if (!o || o.v !== 1) return null;
  if (typeof o.t !== "string" || typeof o.c !== "string") return null;
  if (!o.c.trim() || o.c.length > PLAY_CODE_MAX) return null;
  return { title: o.t.slice(0, 80), code: o.c,
           author: typeof o.a === "string" ? o.a.slice(0, 24) : "",
           emoji: typeof o.e === "string" ? o.e.slice(0, 8) : "" };
}
function playLink(w){
  var base = "";
  try { base = location.origin + location.pathname; } catch(e){}
  return base + "#play=" + playPack(w);
}

function screenPlay(w){
  if (capHard()) return screenCapReached();
  enterScreen("train", "play");
  session = { id:null, attempts:0, hints:0, shown:false };
  var who = w.author ? "прислал(а) " + esc(w.author) : "игра по ссылке";
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">' + who + '</div>' +
    '<h1>' + (w.emoji ? w.emoji + " " : "🎮 ") + esc(w.title) + '</h1></div></div>' +
    '<p class="lede">Это настоящая игра на Python' +
    (w.author ? ", и её собрал человек, который прислал ссылку" : "") +
    '. Жми «▶ Новая игра», ходи в поле снизу — а когда наиграешься, загляни в код: ' +
    'игра целиком написана вот этими строками, и их можно менять.</p>' +
    '<div id="studio"></div>' +
    '<div class="pager">' +
      '<button class="bigbtn" id="plcode">🔧 Заглянуть в код</button>' +
      '<span class="sp"></span>' +
      '<button class="bigbtn ghost" id="pltake">Забрать в песочницу</button>' +
      '<button class="bigbtn ghost" id="plhome">Что это за тренажёр</button></div>';

  /* Тот же игровой станок, что в разделе «Игры», только редактор спрятан:
     сначала играют. «Заглянуть в код» снимает класс — и вот она, изнанка. */
  var studio = makeStudio({ engine: "mini", play: true, code: w.code, label: esc(w.title) });
  studio.classList.add("plonly");
  document.getElementById("studio").appendChild(studio);
  session.studio = studio;

  document.getElementById("plcode").onclick = function(){
    studio.classList.remove("plonly");
    this.style.display = "none";
    /* объяснение появляется в момент открытия кода, не раньше: до этого оно
       отвечало бы на вопрос, который ещё не задан */
    var note = document.createElement("div");
    note.className = "note";
    note.innerHTML = "<b>Это и есть игра</b>Поменяй что-нибудь — текст, числа, правила — " +
      "и нажми «▶ Новая игра», чтобы сыграть свою версию. У автора ссылки ничего не изменится.";
    studio.parentNode.insertBefore(note, studio);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  document.getElementById("pltake").onclick = function(){
    S.sandbox = studio.editor.getCode(); save();
    try { history.replaceState(null, "", location.pathname + location.search); } catch(e){}
    screenSandbox();
  };
  document.getElementById("plhome").onclick = function(){
    try { history.replaceState(null, "", location.pathname + location.search); } catch(e){}
    screenWorlds();
  };
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}
function screenPlayBroken(){
  enterScreen("train", "play");
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">игра по ссылке</div><h1>Ссылка не прочиталась</h1></div></div>' +
    '<p class="lede">Скорее всего, её обрезал мессенджер: длинные ссылки часто ломаются ' +
    'на переносе строки. Попроси прислать ещё раз — целиком, одним куском.</p>' +
    '<div class="winrow"><button class="bigbtn" id="plhome">На главную</button></div>';
  document.getElementById("plhome").onclick = goHome;
}

/* Чужая работа: только смотреть и забрать себе в песочницу. Запускать прямо
   отсюда не даём намеренно — иначе это ещё один экран урока без урока.
   ⚠️ Для ИГР это правило перевёрнуто сознательно — см. #play= выше. */
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
  document.getElementById("whome").onclick = goHome;
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
    '<b>📲 Поставь Фионику на домашний экран</b> ' +
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
/* ============================================================
   НАБОРЫ ОФОРМЛЕНИЯ: цвет и значок за пройденный мир (пункт 2.5)

   ⚠️ Почему такая награда безопасна. Всё, что даётся за прогресс, обязано
   быть ДОБАВЛЕНИЕМ, а не тем, что можно потерять: страх потерять — красная
   линия продукта, из-за неё же убрано число серии. Набор не отсчитывает
   ничего, не сгорает и никуда не торопит: открылся — и остался.

   Открывается набор ВЫПУСКНЫМ мира (уроки плюс проект) — тем же правилом,
   что сертификат. Одно правило на две награды: иначе «мир пройден» значило
   бы в двух местах продукта разное.

   Выбор набора — настройка устройства, как тема: на сервер не едет и на
   другое устройство не переезжает.

   ⚠️ Замок проверяется при КАЖДОМ применении, а не только при выборе. На
   общем устройстве после смены ученика чужой набор обязан слететь сам —
   иначе новичок увидит цвет, которого не заработал, и слово «открывается за
   мир» окажется неправдой с первого же экрана.
   ============================================================ */
var SKINS = [
  { id:"base",   em:"🐍", name:"Фионика",           world:0 },
  { id:"rostok", em:"🌱", name:"Росток",            world:1 },
  { id:"dannye", em:"📦", name:"Данные",            world:2 },
  { id:"svoi",   em:"🛠", name:"Свой код",          world:3 },
  { id:"real",   em:"⚙️", name:"Настоящий Python",  world:4 },
  { id:"pro",    em:"🚀", name:"Профессия",         world:5 }
];
var SKIN_KEY = "kodokvest_skin";
function skinById(id){
  for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i];
  return null;
}
function skinOpen(s){ return !!s && (!s.world || worldGraduated(s.world)); }
function skinSaved(){
  try { return localStorage.getItem(SKIN_KEY) || "base"; } catch(e){ return "base"; }
}
/* Набор, который действует прямо сейчас. Закрытый молча превращается в
   обычный — см. предупреждение выше про общее устройство. */
function skinNow(){
  var s = skinById(skinSaved());
  return skinOpen(s) ? s : SKINS[0];
}
function skinSet(id){
  var s = skinById(id);
  if (!skinOpen(s)) return false;
  try { localStorage.setItem(SKIN_KEY, s.id); } catch(e){}
  skinApply();
  return true;
}
function skinApply(){
  var s = skinNow();
  if (s.id === "base") document.documentElement.removeAttribute("data-skin");
  else document.documentElement.setAttribute("data-skin", s.id);
}
/* Наборы, которые уже открыты (кроме обычного) — нужно и экрану выпускного,
   и профилю, и тесту. */
function skinsOpen(){
  return SKINS.filter(function(s){ return s.world && skinOpen(s); });
}
/* Плитка выбора: открытые выбираются, закрытые честно говорят, чем откроются. */
function skinPickHTML(){
  var cur = skinNow().id;
  return '<div class="skinpick" id="skinpick">' + SKINS.map(function(s){
    var open = skinOpen(s);
    var w = s.world ? CURRICULUM.world(s.world) : null;
    var when = !s.world ? "открыт всегда"
      : open ? ("за мир " + s.world)
      : ("откроется за мир " + s.world + (w ? " «" + w.title + "»" : ""));
    return '<button data-skin-set="' + s.id + '"' +
      (open ? "" : " disabled") + (s.id === cur ? ' class="on"' : '') + '>' +
      '<span class="sname">' + s.em + " " + esc(s.name) + '</span>' +
      '<span class="swhen">' + esc(when) + '</span></button>';
  }).join("") + '</div>';
}
function bindSkinPick(after){
  document.querySelectorAll("[data-skin-set]").forEach(function(b){
    b.onclick = function(){
      if (b.disabled) return;
      skinSet(b.getAttribute("data-skin-set"));
      refreshTop();
      if (typeof after === "function") after();
    };
  });
}

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
  worlddone: { t:"🎓 Выпускной мира — что ты теперь умеешь", h:
    '<h4>Что это за экран</h4>' +
    '<p>Он открывается, когда мир пройден целиком: все двадцать уроков сданы ' +
    'и проект собран. Здесь список того, что ты теперь делаешь сам — не темами ' +
    'из программы, а обычными словами.</p>' +
    '<h4>Что делать</h4>' +
    '<ul><li>Нажми на любую строчку — откроется урок, где это было. Пройденный ' +
    'урок можно перерешать, звёзды при этом не отнимаются.</li>' +
    '<li><b>«🖨 Показать лист»</b> откроет лист с твоим именем, названием мира и датой. ' +
    'Его можно распечатать или сохранить в PDF.</li></ul>' +
    '<h4>Зачем это</h4>' +
    '<p>Через месяц занятий трудно вспомнить, чему ты научился: кажется, что просто ' +
    'решал задачки. Этот список для того и нужен — чтобы было видно, сколько всего ' +
    'уже умеешь.</p>' },

  path: { t:"🗺 Карта пути — где ты и что впереди", h:
    '<h4>Что это за экран</h4>' +
    '<p>Весь курс одной дорогой: сто уроков по порядку и пять вех. ' +
    'Веха — это проект в конце мира, который ты собираешь сам и уносишь с собой.</p>' +
    '<h4>Как читать</h4>' +
    '<ul><li><b>Кружок с цифрой</b> — урок. Цифра — его номер внутри мира.</li>' +
    '<li><b>Закрашенный</b> — пройден, <b>светлый</b> — открыт и ждёт, <b>тусклый</b> — ещё закрыт.</li>' +
    '<li>Внутри мира уроки открываются по одному, но <b>первый урок каждого мира открыт сразу</b>: ' +
    'если интересно, что там дальше, — можно заглянуть, ничего не сломается.</li>' +
    '<li><b>«ты здесь»</b> стоит на том уроке, до которого ты дошёл. ' +
    'Кнопка <b>«Показать, где я»</b> наверху прокрутит карту прямо к нему.</li></ul>' +
    '<h4>Что делать</h4>' +
    '<p>Нажми на любой светлый или закрашенный кружок — откроется тот урок. ' +
    'Пройденный можно перерешать: звёзды при этом не отнимаются.</p>' +
    '<h4>Про «примерно N занятий»</h4>' +
    '<p>Это не обещание и не срок. Тренажёр смотрит, сколько уроков ты успеваешь за занятие, ' +
    'и считает по твоему темпу. Будешь заниматься быстрее — число уменьшится само.</p>' },

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

  /* Вывеска — единственный экран, где «?» отвечает не ребёнку, а гостю:
     ребёнок сюда попадает разве что случайно, а взрослый — всегда первым. */
  about: { t:"🐍 Фионика — что это", h:
    '<h4>Что это за экран</h4>' +
    '<p>Витрина: что тут есть, из чего состоит курс и что видит взрослый. ' +
    'Это единственный экран, где ничего не надо решать, — его просто читают.</p>' +
    '<h4>Что делать</h4>' +
    '<ul><li><b>«Начать первый урок»</b> открывает настоящий урок без всякой регистрации — ' +
    'самый быстрый способ понять, подходит ли это вам. Имя тренажёр спросит после ' +
    'первой решённой задачи, чтобы сохранить сделанное.</li>' +
    '<li><b>«Начать заниматься»</b> спросит, кто вы: ученик, родитель или репетитор.</li>' +
    '<li>Раздел <b>«Честно про границы»</b> читать обязательно: там написано, чего тут нет.</li></ul>' +
    '<h4>Как сюда вернуться</h4>' +
    '<p>Добавьте к адресу сайта <b>#about</b> — вывеска откроется с любого экрана.</p>' },

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

  defense: { t:"📁 Пакет к защите проекта", h:
    '<h4>Что это</h4>' +
    '<p>Документы, которые обычно просят на защите индивидуального проекта: паспорт, пояснительная ' +
    'записка, презентация, речь и протокол работы. Собираются из готового проекта.</p>' +
    '<h4>Что делать</h4>' +
    '<ul><li>Впиши свои слова: тему, актуальность, вывод и что можно улучшить. Они сразу попадают во все документы.</li>' +
    '<li>Открой документ и нажми «Распечатать или сохранить в PDF».</li>' +
    '<li>Школу, класс и руководителя впиши от руки: тренажёр их не спрашивает и не хранит.</li></ul>' +
    '<h4>Честно</h4>' +
    '<p>Это каркас, а не бланк твоей школы: сверь его с её требованиями.</p>' },
  web: { t:"🌐 HTML и CSS — страница своими руками", h:
    '<h4>Что это за раздел</h4>' +
    '<p>Задания про то, из чего сделан любой сайт. HTML говорит, ЧТО на странице — заголовок, ' +
    'список, таблица. CSS — КАК это выглядит: цвета, шрифты, раскладка.</p>' +
    '<h4>Как решать</h4>' +
    '<ul><li>Пиши код слева — справа сразу видно страницу.</li>' +
    '<li>«Проверить» разбирает страницу и отмечает в списке «Что нужно сделать», что уже есть, а чего нет.</li>' +
    '<li>Пример в карточке «Как это пишется» — про другое: он показывает тег, но ответом не является.</li></ul>' +
    '<h4>Почему не видно картинок из интернета</h4>' +
    '<p>Нарочно: страница в тренажёре не ходит в сеть, чтобы ничего не рассказать о тебе чужому сайту. ' +
    'Вместо картинки браузер показывает её описание из alt.</p>' },
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

  /* ⚠️ Подсказка варианта отвечает сразу двоим. Ребёнок спрашивает «что тут
     делать», взрослый — «сколько баллов он набрал», и второй вопрос надо
     закрыть прямо здесь: если не ответить, число придумают за нас. */
  /* Подсказка проверки отвечает взрослому раньше, чем ребёнку: взрослый
     приходит сюда с вопросом «сколько это баллов» и «можно ли верить». */
  /* Подсказка защиты отвечает взрослому на два вопроса сразу: «можно ли
     этому верить» и «что делать, если не ответил». */
  zashchita: { t:"🛡 Защита своего кода", h:
    '<h4>Что это</h4>' +
    '<p>До трёх вопросов о программе ученика: что она напечатает, если заменить число; сколько раз ' +
    'выполнится тело цикла; что окажется в переменной. Ответ не угадан — движок прогоняет ' +
    'программу (или её копию с другим числом) прямо на этом устройстве.</p>' +
    '<h4>Два режима</h4>' +
    '<p><b>Отвечает ученик</b> — ответы спрятаны до конца, итог «понял» или «стоит разобрать». ' +
    '<b>Смотрит взрослый</b> — вопросы сразу с ответами и лист на печать: Python знать не нужно.</p>' +
    '<h4>Если не ответил</h4>' +
    '<p>Это не доказательство, а повод поговорить. Спросите, как он думал: ошибиться в своём ' +
    'коде может каждый, а взявший чужой код бывает, что понимает его.</p>' +
    '<h4>Когда вопросов нет</h4>' +
    '<p>Движок исполняет не весь Python. Экран назовёт причину: ввод без ответов, случайность, ' +
    'ошибка, файл с данными или запись, которую движок не знает.</p>' },
  proverka: { t:"🔎 Проверка — что ребёнок умеет сам", h:
    '<h4>Что это</h4>' +
    '<p>Проверок две, по десять ступеней. Первая — основы Python по нарастающей: счёт, текст, условие, ' +
    'циклы, списки, функции, словари, ошибки, классы. Вторая — для того, кто прошёл первую или готовится ' +
    'к экзамену: шесть задач в формате ОГЭ и ЕГЭ и четыре страницы на HTML, двумя независимыми дорожками. ' +
    'На каждой ступени одна задача. Подсказок нет, попыток три, и после двух нерешённых ступеней подряд ' +
    'проверка (а во второй — дорожка) кончается сама.</p>' +
    '<h4>Код результата</h4>' +
    '<p>В конце появляется код из шестнадцати знаков. В нём записан весь итог, поэтому он ' +
    'открывается на любом устройстве без регистрации и без сервера. Код с опечаткой не ' +
    'откроется вовсе — чужой итог по ошибке показан не будет.</p>' +
    '<h4>Чего здесь нет</h4>' +
    '<p>Баллов и отметок: из десяти задач их не вывести. Итог говорит проверяемое — какие ' +
    'ступени ребёнок решил сам, какие нет, и где код пришёл вставкой, а не был набран.</p>' },
  variant: { t:"📝 Пробный вариант — весь экзамен подряд", h:
    '<h4>Что это за экран</h4>' +
    '<p>Раздел «Алгоритмы, ОГЭ и ЕГЭ» разложен по темам: сегодня графы, завтра циклы. ' +
    'Экзамен устроен не так — там задания идут <b>подряд, по номерам</b>, и каждое про своё. ' +
    'Вариант собирает такой же порядок из наших задач: по одной на каждый номер.</p>' +
    '<h4>Два режима, и выбирают их при сборке</h4>' +
    '<ul><li><b>Тренировка</b> — подсказки на месте, проверка объясняет, что не сошлось, ' +
    'времени сколько угодно. С этого стоит начинать.</li>' +
    '<li><b>Экзамен</b> — идёт время, подсказок нет, и проверка молчит: она записывает ответ, ' +
    'а верно или нет, видно только в итоге. Запускать свою программу при этом можно ' +
    'сколько угодно — за компьютером на экзамене тоже можно.</li></ul>' +
    '<p>Время экзамена выбираешь ты: 30, 60 или 90 минут. ⚠️ Это наша мерка, а не ' +
    'экзаменационная: длительность настоящего экзамена объявляет тот, кто его проводит, ' +
    'и набор заданий у нас другой — только та часть, где надо написать программу.</p>' +
    '<h4>Что делать</h4>' +
    '<ul><li>Жми <b>«Решать»</b> в любой строке — откроется обычный экран задачи, ' +
    'с подсказками и проверкой. Решил — вернёшься в вариант сам.</li>' +
    '<li>Порядок свободный, и в тренировке торопиться некуда: вариант сохраняется. Можно ' +
    'решить три номера сегодня и вернуться завтра.</li>' +
    '<li><b>«Показать итог»</b> внизу — сколько номеров закрыто и на каких просело. ' +
    'На экзамене та же кнопка называется <b>«Завершить»</b> и заканчивает заход: ' +
    'переиграть его нельзя, а разобрать нерешённое — можно, уже с подсказками.</li></ul>' +
    '<h4>Как читать строки</h4>' +
    '<ul><li><b>Номер и тема</b> — как в демоверсии своего года, ниже наша задача на этот номер.</li>' +
    '<li><b>«повтор темы»</b> значит, что задач по ней у нас пока меньше, чем номеров. ' +
    'Это наш список дел, а не ошибка ученика.</li>' +
    '<li><b>Серые строки</b> — задания, которых мы не даём, и против каждого написано почему. ' +
    'Из варианта они не выкинуты: на настоящем экзамене этот номер всё равно будет.</li></ul>' +
    '<h4>Про баллы, и это важно для взрослого</h4>' +
    '<p>Баллов здесь нет и не будет. Шкала перевода в экзаменационные баллы меняется каждый ' +
    'год и объявляется не нами; назвать число, которого мы не знаем, значит соврать там, где ' +
    'враньё выяснится в мае. Итог говорит только проверяемое: <b>какие номера закрыты, ' +
    'а какие просели</b>.</p>' },

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

  today: { t:"🔥 Сегодня — уговор и задача дня", h:
    '<h4>Что это за экран</h4>' +
    '<p>Здесь уговор: в какие дни недели вы договорились заниматься, и что уже сделано. ' +
    'День засчитывает любое дело — урок, разминка, игра, проект.</p>' +
    '<h4>Календарь</h4>' +
    '<p>Полоска дней показывает, как было на самом деле. Она ничего не требует и ничего ' +
    'не сжигает: пропустил день — он просто останется пустым, и всё.</p>' +
    '<h4>А если пропустил</h4>' +
    '<p>Ничего не случится. Возвращайся и занимайся дальше — тренажёр посчитает всё сам ' +
    'и ругаться не станет.</p>' +
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

  admin: { t:"🛠 Панель репетитора", h:
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
      /* ⚠️ Дверь на вывеску стоит именно здесь, потому что «?» есть на КАЖДОМ
         экране. Жалоба фаундера 06.09.2026: «нажимаю на логотип и остаюсь в
         профиле ученика». Логотип не виноват — он ведёт домой, а дома человек
         уже стоял, и нажатие выглядело как сломанная кнопка. Настоящая дыра
         была в другом: у вывески не было ни одной двери изнутри продукта,
         только адрес #about, которого никто не знает. Логотип при этом
         трогать нельзя: у ребёнка дом — уроки, и уводить его на витрину
         продукта каждым нажатием значит ломать 1.65.0 с другого конца. */
      '<button class="rbtn sec" id="help-about">🐍 О тренажёре</button>' +
      '<button class="rbtn sec" id="help-guide">📕 Полная инструкция</button>' +
      '<button class="rbtn sec" id="help-sheet">📖 Шпаргалка</button>' +
    '</div>';
  body.querySelectorAll("[data-theme-set]").forEach(function(b){
    b.onclick = function(){ themeSet(b.getAttribute("data-theme-set")); };
  });
  var ab = document.getElementById("help-about");
  if (ab) ab.onclick = function(){ closeHelp(); screenAbout(); };
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
    '<p>Фионика — тренажёр языка Python. Код пишется и выполняется прямо в браузере: ' +
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
    '<p>Есть <b>панель репетитора</b>: сколько времени ушло на каждый урок, где было больше ' +
    'всего попыток, какие ошибки повторяются, вопрос за ужином и отчёт за неделю. Оттуда же ' +
    'снимаются замки с уроков. Она открывается адресом сайта с <b>#admin</b> на конце ' +
    'и спрашивает код — в меню её нет, чтобы ребёнок не забрёл туда случайно.</p></div>';

  h += '</div><div class="pager"><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button>' +
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
  document.getElementById("tomap").onclick = goHome;
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
document.getElementById("logo").onclick = goLogo;
(function(){
  var byTab = { home: goHome, train: screenTrain, mine: screenFolio };
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
    /* Ширина изменилась — значит строки переносятся в других местах, и номера
       строк надо выровнять заново, иначе метка ошибки уедет не на ту строку. */
    if (b._syncGutter) b._syncGutter();
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
  /* Открыть ссылку-приглашение — это объявить «здесь занимается ребёнок».
     Если устройство раньше было кабинетом взрослого, снимаем с него этот статус:
     иначе ребёнок попадёт не в тренажёр, а в кабинет. (В норме ребёнок открывает
     ссылку на своём устройстве, но защищаемся и от «открыл на мамином ноутбуке».) */
  /* Детская ссылка делает устройство детским: снимаем роли взрослого, но пароль
     администратора НЕ трогаем — чтобы с этого же устройства можно было вернуться
     в кабинет по паролю (типичный «семейный ноутбук»). */
  if (set && typeof S !== "undefined" && S.admin){
    S.admin.isAdmin = false;
    S.admin.parentOf = ""; S.admin.parentLabel = "";
    try { adminLock(); } catch(e){}
    try { saveLocal(); } catch(e){}
  }
  try {
    if (set && history.replaceState)
      history.replaceState(null, "", location.pathname + location.hash);
  } catch(e){}
})();

/* Ссылка вида .../kodokvest/?parent=roman-3f7a закрепляет устройство за
   РОДИТЕЛЕМ этого ребёнка: дальше оно всегда открывается в кабинет родителя.
   Имя ребёнка может ехать в &n=… — сервер имён не хранит, а родителю приятнее
   видеть имя, чем код. */
(function(){
  if (typeof Cloud === "undefined" || typeof S === "undefined") return;
  var m = /[?&]parent=([^&]+)/.exec(location.search || "");
  if (!m) return;
  var code = Cloud.validCode(decodeURIComponent(m[1]));
  if (!code) return;
  var nm = /[?&]n=([^&]+)/.exec(location.search || "");
  S.admin.parentOf = code;
  S.admin.parentLabel = nm ? decodeURIComponent(nm[1]).slice(0, 40) : "";
  /* родитель — не ученик и не админ; пароль администратора не трогаем */
  S.admin.isAdmin = false;
  try { Cloud.forgetCode(); } catch(e){}
  try { adminLock(); } catch(e){}
  try { saveLocal(); } catch(e){}
  try {
    if (history.replaceState)
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
/* ================= планшет: виртуальная клавиатура =================
   Жалоба с боя (05.09.2026): на планшете при наборе кода выскакивает
   клавиатура и «экран съезжает». Причины три, и лечатся они по отдельности:

   1. Android Chrome по умолчанию НАКРЫВАЕТ страницу клавиатурой, не меняя
      вьюпорт: липкая шапка и полоска задания остаются посреди экрана и
      прыгают. Лечится словом interactive-widget=resizes-content в мете
      вьюпорта (index.html): клавиатура начинает СЖИМАТЬ страницу, и
      раскладка честно перестраивается. iOS это слово игнорирует.

   2. Пока клавиатура открыта, липким и плавающим элементам не место:
      липкая колонка редактора и полоска задания дёргаются при каждом
      скролле, а плавающие кнопки всплывают над клавиатурой посреди экрана.
      Открытую клавиатуру мы узнаём по visualViewport: он сжался заметно
      сильнее, чем бывает от поворота, — вешаем класс kb на documentElement,
      и CSS прячет лишнее (правила «.kb …» в style.css).

   3. Браузер сам прокручивает страницу к сфокусированному полю, но метит в
      край экрана — поле оказывается впритык к клавиатуре или под шапкой.
      Помогают scroll-padding в CSS и мягкое доцентрирование: через полсекунды
      после фокуса (клавиатура уже выехала) редактор подтягивается к середине
      видимой области. Только на устройствах с пальцем: на десктопе от такого
      доцентрирования страница дёргалась бы при каждом клике в редактор. */
var KB_SHRINK = 140;   /* насколько должен сжаться вьюпорт, чтобы это была клавиатура */
function kbApply(vvHeight, winHeight){
  var on = (winHeight - vvHeight) > KB_SHRINK;
  try { document.documentElement.classList.toggle("kb", on); } catch(e){}
  return on;
}
function kbInit(){
  var vv = window.visualViewport;
  if (!vv) return;                         /* старые браузеры — без класса, как раньше */
  var roll = function(){ kbApply(vv.height, window.innerHeight); };
  vv.addEventListener("resize", roll);
  roll();
}
/* доцентрировать редактор после того, как клавиатура выехала */
function kbFocusInit(){
  var touch = false;
  try { touch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0; } catch(e){}
  if (!touch) return;
  document.addEventListener("focusin", function(e){
    var t = e.target;
    if (!t || (t.tagName !== "TEXTAREA" && t.tagName !== "INPUT")) return;
    var box = t.closest ? (t.closest(".editorbox") || t.closest(".pane") || t) : t;
    setTimeout(function(){
      if (document.activeElement !== t) return;      /* фокус уже ушёл */
      try { box.scrollIntoView({ block:"center", behavior:"smooth" }); } catch(e){}
    }, 450);
  });
}

/* Какой экран открыть при загрузке. ⚠️ Вынесено отдельной функцией, чтобы
   решение можно было проверить тестом: оно про правила, а не про отрисовку, и
   именно в нём была ошибка. Возвращает имя, а не зовёт экран. */
function bootWhere(){
  /* ⚠️ Взрослого открываем ТАМ, ГДЕ ОН БЫЛ, а не там, куда ведёт роль
     устройства: ушёл на главную — обновление обязано оставить его на главной.
     Разбор у atHome(). */
  if ((isAdminDevice() || isParentDevice()) && atHome()) return "about";
  if (isAdminDevice()) return "adminhome";
  if (isParentDevice()) return "parent";
  if (myCode() || S.name) return "worlds";
  /* ⚠️ Незакреплённое устройство встречает ВЫВЕСКА, а не выбор роли. Раньше
     здесь стоял screenRoles(), и первым, что видел человек по ссылке, были
     три двери без единого слова о том, куда они ведут. */
  return "about";
}
function bootRender(){
  /* общий счётчик активных минут запускается один раз на всю сессию: он
     считает не «сколько открыта вкладка», а сколько ребёнок реально работал */
  actStart();
  kbInit();
  kbFocusInit();
  try {
    if (!routeHash()){
      /* Каждое устройство открывается в СВОЮ роль. Порядок важен: сначала
         закреплённые роли (админ, родитель), потом ученик, и лишь незакреплённое
         устройство видит экран выбора — это и есть «общий компьютер».
         Ученик считается закреплённым, если у него есть код (онлайн) или он
         зарегистрировался по имени (офлайн, S.name). */
      var куда = bootWhere();
      if (куда === "adminhome") screenAdminHome();
      else if (куда === "parent") screenParent();
      else if (куда === "worlds") screenWorlds();
      else screenAbout();
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
/* ⚠️ Кнопка «назад» в браузере ходит по адресам, а не по нашим экранам, и
   попадает СЮДА. Стоял screenWorlds() — то есть детская карта миров, кому бы
   браузер её ни отдал. Так родитель, сходивший на вывеску по #about и нажавший
   «назад», проваливался в тренажёр ребёнка: адрес стал пустым, ничего не
   совпало, и его увели на чужой экран. Это ровно то, от чего лечили в 1.65.0,
   только зашедшее с третьей стороны — через историю браузера, а не через
   кнопку. Дом считается из роли, значит и здесь обязан зваться goHome. */
window.addEventListener("hashchange", function(){ if (!routeHash()) goHome(); });

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
  /* адреса экранов — целиком, чтобы проверка «кругооборот» ходила по той же
     таблице, что и продукт, а не по своему списку рядом (правило § 4.6) */
  ROUTES: ROUTES, ROUTE_BY_HASH: ROUTE_BY_HASH, ROUTE_BY_PLACE: ROUTE_BY_PLACE,
  routeHash: routeHash, setRoute: setRoute, routeFor: routeFor, BASE_TITLE: BASE_TITLE,
  /* где мы сейчас — ВЫЗОВОМ, а не значением: curPlace меняется на каждом
     переходе, и снятая один раз копия соврала бы (правило § 4.5) */
  place: function(){ return curPlace; }, tab: function(){ return curTab; },
  screenWorlds: screenWorlds, screenWorld: screenWorld, openLesson: openLesson,
  screenTrain: screenTrain, trainCards: trainCards, nextLesson: nextLesson,
  openExamMap: openExamMap, screenAlgo: screenAlgo, openAlgo: openAlgo, algoList: algoList, algoById: algoById,
  algoDone: algoDone, ALGO_GROUPS: ALGO_GROUPS,
  screenWeb: function(){ screenWeb(); }, openWeb: function(id){ openWeb(id); },
  screenDefense: function(id){ screenDefense(id); },
  defenseDocHTML: function(k, id){ return DEFENSE.docHTML(k, id); }, DEFENSE_DOCS: DEFENSE.DOCS,
  AI_STAGES: AI_STAGES, aiStageOf: aiStageOf,
  bootFallback: bootFallback, bootRender: bootRender,
  screenSandbox: screenSandbox, screenAdmin: screenAdmin, screenGames: screenGames,
  screenPath: screenPath, pathAhead: pathAhead, pathState: pathState, pathZan: pathZan,
  goLogo: goLogo, landNums: landNums, landLiveCode: landLiveCode,
  landSwipeInit: landSwipeInit, SWIPE_ROWS: SWIPE_ROWS,
  LAND_DEMO_OK: LAND_DEMO_OK, LAND_DEMO_BAD: LAND_DEMO_BAD,
  landDemoHTML: landDemoHTML, landDemoRun: landDemoRun,
  landWarmRender: landWarmRender, landWarms: landWarms,
  myWorksList: myWorksList, myWorkSave: myWorkSave, myWorkDrop: myWorkDrop,
  myWorkById: myWorkById, myWorkLink: myWorkLink, WORK_MAX: WORK_MAX,
  screenWorldDone: screenWorldDone, worldSkills: worldSkills,
  worldGraduated: worldGraduated, WORLD_SKILLS: WORLD_SKILLS,
  openGame: openGame, screenWarmups: screenWarmups, openWarmup: openWarmup,
  warmupOpen: warmupOpen, warmupsOpen: warmupsOpen, warmupsList: warmupsList,
  screenToday: screenToday, dailyPick: dailyPick, markActiveToday: markActiveToday,
  streakCurrent: streakCurrent, streakBest: streakBest, dailyDone: dailyDone, dayKey: dayKey,
  homeLabel: homeLabel, goHome: goHome,
  scheduleDays: scheduleDays, isStudyDay: isStudyDay, toggleStudyDay: toggleStudyDay, studyDue: studyDue,
  agreedDays: agreedDays, agreedOn: agreedOn, agreedStudyDay: agreedStudyDay,
  frameTime: frameTime, addMonths: addMonths, planDates: planDates, icsForFrame: icsForFrame,
  shieldsLeft: shieldsLeft, shieldToNext: shieldToNext, shieldedOn: shieldedOn, useShield: useShield,
  shieldWouldSave: shieldWouldSave,
  coveredDays: coveredDays, shieldsLeftIn: shieldsLeftIn, SHIELD_EVERY: SHIELD_EVERY, SHIELD_MAX: SHIELD_MAX,
  screenRegister: screenRegister, screenAccount: screenAccount, doRegister: doRegister,
  doLogin: doLogin, doLogout: doLogout, newKidCode: newKidCode, myName: myName,
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
  stopTimer: stopTimer, adminUnlock: adminUnlock, adminLock: adminLock, adminGate: adminGate,
  getSession: function(){ return session; },
  mergeProgress: mergeProgress, cloudSnapshot: cloudSnapshot, applyProgress: applyProgress,
  localSnapshot: localSnapshot, adminLabel: adminLabel, adminLabelSet: adminLabelSet,
  blankProgress: blankProgress, ensureShape: ensureShape,
  clearResults: clearResults, clearAll: clearAll,
  cloudPull: cloudPull, cloudPush: cloudPush, cloudState: cloudState,
  cancelPush: cancelPush,
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
  refreshTop: refreshTop,
  myExamSources: myExamSources, myExamMake: myExamMake, myExamPick: myExamPick,
  myExamHasSource: myExamHasSource, screenMyExam: screenMyExam,
  MYEXAM_LO: MYEXAM_LO, MYEXAM_HI: MYEXAM_HI, MYEXAM_BOX: MYEXAM_BOX,
  SKINS: SKINS, skinNow: skinNow, skinSet: skinSet, skinOpen: skinOpen,
  skinsOpen: skinsOpen, skinPickHTML: skinPickHTML, skinApply: skinApply,
  lessonSearch: lessonSearch, lessonOpen: lessonOpen, homeCards: HOME.CARDS,
  ERR_BEASTS: ERR_BEASTS, BEAST_BADGE_AT: BEAST_BADGE_AT, KIND_RU: KIND_RU,
  errSeen: errSeen, errBeaten: errBeaten, beastsBeaten: beastsBeaten,
  beastsMet: beastsMet, beastsHTML: beastsHTML, beastByKind: beastByKind,
  hlWatched: hlWatched, WATCH_MAX_STEPS: WATCH_MAX_STEPS, WATCH_LINE_MAX: WATCH_LINE_MAX,
  LEAN_XP: LEAN_XP, LEAN_BADGE_AT: LEAN_BADGE_AT, FRIEND_XP: FRIEND_XP,
  screenFolio: screenFolio, certList: certList, certBodyHTML: certBodyHTML,
  openCert: openCert, closeCert: closeCert, certIsOpen: certIsOpen,
  openAccessCard: openAccessCard, accessCardHTML: accessCardHTML,
  aboutFootHTML: aboutFootHTML,
  codeSaved: codeSaved, markCodeSaved: markCodeSaved, screenLostCode: screenLostCode,
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
  screenAdminHome: screenAdminHome, screenAdminSetup: screenAdminSetup,
  screenAdminLogin: screenAdminLogin, screenKids: screenKids, screenKid: screenKid,
  isAdminDevice: isAdminDevice, adminHasPass: adminHasPass, adminPassSet: adminPassSet,
  atHome: atHome, setPlace: setPlace, leaveRoom: leaveRoom, ROOM_PLACES: ROOM_PLACES,
  bootWhere: bootWhere, adminUnlocked: adminUnlocked, adminLock: adminLock,
  adminPassOk: adminPassOk, adminDeviceOff: adminDeviceOff,
  kidsList: kidsList, kidAdd: kidAdd, kidDrop: kidDrop, kidGet: kidGet,
  kidAttach: kidAttach, kidRename: kidRename, helpActive: helpActive, helpCall: helpCall, helpCancel: helpCancel, helpLineHTML: helpLineHTML, HELP_WHY: HELP_WHY, kidWorkHere: kidWorkHere, progressJSON: progressJSON,
  kidsListFileText: kidsListFileText, kidsListParse: kidsListParse, kidsListMerge: kidsListMerge,
  kidsListLoadText: kidsListLoadText, kidsSaveNeeded: kidsSaveNeeded, kidsListMarkSaved: kidsListMarkSaved,
  kidLink: kidLink, frameEditorHTML: frameEditorHTML,
  isParentDevice: isParentDevice, parentOf: parentOf, parentDeviceOff: parentDeviceOff,
  parentLink: parentLink, becomeAdmin: becomeAdmin, becomeParent: becomeParent,
  becomeKid: becomeKid,
  screenAbout: screenAbout, aboutCounts: aboutCounts,
  screenRoles: screenRoles, screenParent: screenParent,
  screenKidLogin: screenKidLogin, screenParentLogin: screenParentLogin,
  adultFieldProblem: adultFieldProblem, adultTplById: adultTplById,
  lessonStarted: lessonStarted, screenCapReached: screenCapReached, errText: errText,
  backTarget: backTarget, syncBack: syncBack,
  screenSpecs: screenSpecs, openSpec: openSpec, specParse: specParse,
  specToPython: specToPython, specRunAll: specRunAll, specVerdict: specVerdict,
  specsList: specsList, specDone: specDone, specSplitArgs: specSplitArgs,
  specTaskById: specTaskById, SPEC_KINDS: SPEC_KINDS,
  planFact: planFact, planFactText: planFactText, frameState: frameState,
  stuckIn: stuckIn, stuckWhy: stuckWhy, stuckAdvice: stuckAdvice,
  stuckStep: stuckStep, stuckStepHTML: stuckStepHTML,
  noteFor: noteFor, noteList: noteList, noteLessons: noteLessons, noteCardHTML: noteCardHTML,
  noteGiveHTML: noteGiveHTML, kidSaveNote: kidSaveNote, noteSeenHint: noteSeenHint, NOTE_MAX: NOTE_MAX,
  noteMarkLine: noteMarkLine, noteMarksFor: noteMarksFor, noteStarterOf: noteStarterOf,
  NOTE_MARKS_MAX: NOTE_MARKS_MAX,
  STEP_HINT: STEP_HINT, STEP_SOL: STEP_SOL, STEP_REST: STEP_REST,
  lessonPrice: lessonPrice, STUCK_PRICE: STUCK_PRICE,
  screenGroup: screenGroup, groupRow: groupRow, groupLoad: groupLoad,
  groupState: groupState, GROUP_MAX: GROUP_MAX, GROUP_QUIET_DAYS: GROUP_QUIET_DAYS,
  screenShowcase: screenShowcase, showcaseProjects: showcaseProjects,
  showcaseAfter: showcaseAfter, showcaseRun: showcaseRun,
  screenVariant: screenVariant, screenVariantDone: screenVariantDone,
  variantOpenFor: variantOpenFor, variantStat: variantStat,
  variantBuild: VARIANT.buildItems, variantMake: VARIANT.makeVariant, variantSeedV2: VARIANT.seedV2, variantNewSeed: VARIANT.newSeed,
  screenRobot: screenRobot, openRobot: openRobot,
  screenProverka: screenProverka, proverka: PROVERKA,
  screenZashchita: screenZashchita, zashchita: ZASH, zqSources: zqSources,
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
  HW_MAX: HW_MAX, hwSeed: hwSeed, hwKey: hwKey, hwRecords: hwRecords, shiftDay: shiftDay,
  hwMine: hwMine, hwPending: hwPending, hwBuild: hwBuild, hwMark: hwMark,
  hwDaysLeft: hwDaysLeft, hwDueText: hwDueText, hwAvailableFor: hwAvailableFor,
  hwDefaultDue: hwDefaultDue, screenHW: screenHW, openHW: openHW,
  groupAssignHW: groupAssignHW, grpHwState: grpHwState,
  weekFacts: weekFacts, parentReportText: parentReportText, askCardHTML: askCardHTML,
  worldCountdown: worldCountdown, welcomeBackHTML: welcomeBackHTML, daysSincePause: daysSincePause,
  nextTimeHTML: nextTimeHTML, nextZanDayKey: nextZanDayKey, PAUSE_DAYS: PAUSE_DAYS,
  zanAfterPause: zanAfterPause,
  grpStats: grpStats, stuckTopHTML: stuckTopHTML, STUCK_PRICE: STUCK_PRICE,
  playPack: playPack, playUnpack: playUnpack, playLink: playLink, screenPlay: screenPlay,
  presenceInfo: presenceInfo, presenceHTML: presenceHTML, PRESENCE_FRESH: PRESENCE_FRESH, PLACE_RU: PLACE_RU,
  presenceDetailHTML: presenceDetailHTML,
  kbApply: kbApply, KB_SHRINK: KB_SHRINK,
  fmtDur: fmtDur, daySec: daySec, dayMs: dayMs, goHome: goHome,
  liveOn: liveOn, liveOffNow: liveOffNow, liveTick: liveTick, liveShare: liveShare,
  livePayload: livePayload, LIVE_FRESH: LIVE_FRESH, screenLiveView: screenLiveView,
  liveWatcher: liveWatcher, liveAccept: liveAccept,
  quietReminderText: quietReminderText, GROUP_QUIET_DAYS: GROUP_QUIET_DAYS,
  groupAssignVariant: groupAssignVariant, grpVarState: grpVarState,
  grpAssignOf: grpAssignOf, kidVarHTML: kidVarHTML, kidSaveVariant: kidSaveVariant, kidVarForm: kidVarForm,
  ZAN_LEN: ZAN_LEN, ZAN_SANE: ZAN_SANE, IDLE_MS: IDLE_MS,
  setIdleForTest: function(ms){ IDLE_MS = ms; },
  setLessonForTest: function(id){ curLessonId = id; }
};
})();
