/* ============================================================
   Фионика — мастерская: полка деталей и верстак.

   Отрезана из app.js 15.09.2026 (архитектурный долг, § 2.5 RAZVITIE) по
   договору из шапки js/screens-showcase.js: всё чужое приходит объектом A.

   ЗАМЕР ПЕРЕД РАЗРЕЗОМ (§ 4.2, § 4.54 — по именам, а не по баннеру). Раздел
   живёт одним куском, 266 строк, 17 имён. Снаружи нужны четыре, и все
   узкие: partsList и buildsList — только «сколько» (Главное, «Моё»,
   портфолио, витрина работ), partsHarvest — победа урока кладёт детали на
   полку, screenShop — двери. Поэтому, в отличие от домашки и разминки,
   данные раздела уехали ВМЕСТЕ с экраном: это не общий слой, а собственные
   полка и верстак мастерской, и снаружи о них спрашивают только число.
   Внутрь приходит 16 имён; codeSkeleton, galleryTitleOf, workLink и
   копирование — общие механизмы app.js, мастерская ими пользуется.
   partsNote (строка победы урока «N деталей на полку») осталась в app.js:
   это текст карточки победы, а не мастерская.

   ⚠️ СОСТОЯНИЕ. Прогресс — A.S() в момент обращения, а не одной переменной
   на функцию: так устроен договор песочницы, и это не держится на том, что
   S в app.js сегодня не переприсваивается. Свои слоты мастерская пишет сама
   (S.parts, S.builds, S.shop) — это её данные, других писателей у них нет,
   кроме сохранения черновика в claimScreen (S.shop). Сессия — A.session()
   и A.newSession(v) (§ 4.5).
   ============================================================

   Зачем мастерская — шапка, какой она была в app.js:

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
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.shop = function(A){

var PART_MAX = 40;          /* столько деталей держим на полке */
var PART_CODE_MAX = 900;    /* длиннее — это уже не деталь, а программа */
var BUILD_MAX = 12;         /* столько собранных вещей храним */

function partsAll(){ A.S().parts = A.S().parts || {}; return A.S().parts; }
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
function partDrop(id){ delete partsAll()[id]; A.save(); }
function partAdd(name, code, from){
  var d = partsAll(), k = partKey(code);
  if (d[k]) return k;                       /* та же деталь второй раз не кладётся */
  d[k] = { name:name, code:code, from:from || "", at: Date.now() };
  var keys = Object.keys(d);
  if (keys.length > PART_MAX){
    keys.sort(function(a, b){ return (d[a].at || 0) - (d[b].at || 0); });
    keys.slice(0, keys.length - PART_MAX).forEach(function(x){ delete d[x]; });
  }
  A.save();
  return k;
}

/* Функции верхнего уровня из программы. Границы блока считаем по отступу:
   тело функции — это всё, что идёт после «def» с отступом больше нуля, плюс
   пустые строки внутри. Разбираем СКЕЛЕТ (строки и комментарии в нём
   вычищены), а режем исходный код по тем же номерам строк — поэтому «def»
   внутри текстовой строки деталью не станет. */
function partsFrom(code){
  var src = String(code || "");
  var lines = src.split("\n"), skel = A.codeSkeleton(src).split("\n"), out = [];
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
  if (A.session().shown) return 0;                     /* это код автора, а не его */
  var mine = A.session().code || "";
  if (!mine.trim()) return 0;
  var starter = (A.session().starter || []).map(function(f){ return f.code || ""; }).join("\n");
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
function buildsAll(){ A.S().builds = A.S().builds || {}; return A.S().builds; }
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
  d[id] = { code:String(code), title: A.galleryTitleOf(code, buildsList().length + 1).replace(/^Рисунок /, "Вещь "),
            at: Date.now() };
  var keys = Object.keys(d);
  if (keys.length > BUILD_MAX){
    keys.sort(function(a, b){ return (d[a].at || 0) - (d[b].at || 0); });
    keys.slice(0, keys.length - BUILD_MAX).forEach(function(k){ delete d[k]; });
  }
  A.save();
  return id;
}
function buildDrop(id){ delete buildsAll()[id]; A.save(); }

var SHOP_START = "# Здесь собирается вещь из твоих деталей.\n" +
  "# Возьми деталь с полки кнопкой «↓ На верстак» и позови её отсюда.\n";

function screenShop(){
  A.enterScreen("mine", "shop");
  A.newSession({ id:null, attempts:0, hints:0, shown:false, shop:true });
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
      h += '<div class="partcard"><div class="parthead"><b><code>' + A.esc(p.name) + '()</code></b>' +
        '<span class="dim">' + A.esc(p.from) + '</span></div>' +
        '<pre><code>' + A.hl(p.code) + '</code></pre>' +
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
      h += '<div class="partcard"><div class="parthead"><b>' + A.esc(b.title) + '</b>' +
        '<span class="dim">' + A.fmtWhen(b.at) + '</span></div>' +
        '<pre><code>' + A.hl(b.code) + '</code></pre>' +
        '<div class="partbar"><button class="rbtn check" data-open="' + b.id + '">↓ Открыть на верстаке</button>' +
        '<button class="rbtn sec" data-bshare="' + b.id + '">🔗 Ссылка</button>' +
        '<button class="rbtn sec" data-bdel="' + b.id + '" title="удалить">✕</button></div>' +
        '<div class="msg" data-bmsg="' + b.id + '"></div></div>';
    });
    h += '</div></div>';
  }

  h += '<div class="pager"><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';
  A.app.innerHTML = h;

  var studio = A.makeStudio({
    engine:"mini", draw:true, lint:true,
    code: A.S().shop || SHOP_START,
    onRun: function(){ A.S().shop = studio.editor.getCode(); A.save(); },
    viz: function(o){
      A.screenViz({ code: o.code, env: o.env,
        backTo: { label: "← Вернуться в мастерскую", go: screenShop } });
    }
  });
  document.getElementById("studio").appendChild(studio);
  A.session().studio = studio;
  studio.editor.onEdit = A.draftSchedule;

  function put(code){
    var was = studio.editor.getCode();
    studio.editor.setCode(code + "\n\n\n" + was);
    A.S().shop = studio.editor.getCode(); A.save();
    studio.editor.focusEditor();
    if (studio.scrollIntoView) studio.scrollIntoView({ behavior:"smooth", block:"center" });
  }
  A.app.querySelectorAll("[data-take]").forEach(function(b){
    b.onclick = function(){
      var p = partsAll()[b.getAttribute("data-take")];
      if (p) put(p.code);
    };
  });
  A.app.querySelectorAll("[data-pdel]").forEach(function(b){
    b.onclick = function(){ partDrop(b.getAttribute("data-pdel")); screenShop(); };
  });
  A.app.querySelectorAll("[data-open]").forEach(function(b){
    b.onclick = function(){
      var x = buildsAll()[b.getAttribute("data-open")];
      if (!x) return;
      studio.editor.setCode(x.code);
      A.S().shop = x.code; A.save();
      if (studio.scrollIntoView) studio.scrollIntoView({ behavior:"smooth", block:"center" });
    };
  });
  A.app.querySelectorAll("[data-bdel]").forEach(function(b){
    b.onclick = function(){ buildDrop(b.getAttribute("data-bdel")); screenShop(); };
  });
  A.app.querySelectorAll("[data-bshare]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-bshare"), x = buildsAll()[id];
      var box = A.app.querySelector('[data-bmsg="' + id + '"]');
      if (!x || !box) return;
      var link = A.workLink({ title: x.title, code: x.code, author: A.myName() });
      box.className = "msg show ok";
      box.innerHTML = '<b>Ссылка готова</b>Отправь её кому хочешь: программа лежит прямо в адресе, ' +
        'сервер для этого не нужен.' +
        '<div class="admrow"><button class="rbtn check" data-bcopy="1">Скопировать ссылку</button></div>' +
        '<p class="dim brk">' + A.esc(link) + '</p>';
      var cb = box.querySelector("[data-bcopy]");
      if (cb) cb.onclick = function(){ A.copyText(link, cb); };
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
  document.getElementById("tomap").onclick = A.goHome;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

return { screenShop: screenShop, partsList: partsList, buildsList: buildsList, partsHarvest: partsHarvest,
         partsFrom: partsFrom, partAdd: partAdd, partDrop: partDrop, partWorks: partWorks,
         buildSave: buildSave, buildDrop: buildDrop, PART_MAX: PART_MAX, BUILD_MAX: BUILD_MAX };
};
