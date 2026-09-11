/* ============================================================
   Фионика — экраны раздела «HTML и CSS».

   Решение фаундера 11.09.2026 (1.141.0). Отрезано сразу в свой файл, как
   Робот (js/screens-robot.js), по договору из шапки js/screens-showcase.js:
   новый экран — повод не увеличивать долг app.js. Судья — js/web.js,
   задания — js/web-tasks.js, оформление — .wb* в css/style.css.

   ⚠️ ПРО ХРАНЕНИЕ. Решённые задания лежат в S.algo, как у Робота, с приставкой
   «web-»: пересечься с задачами экзамена они не могут, а своё поле в
   сохранении потянуло бы миграцию формы данных и слияние между устройствами
   ради словаря из двадцати ключей. Разбор той же развилки — в шапке Робота.

   ⚠️ ОКНО «СТРАНИЦА» ЗАПЕРТО тем же замком, что показ HTML в студии: pageDoc
   и pageFrameWire приходят из js/studio.js, а не копируются сюда. Защита от
   класса ошибок живёт в одном месте (RAZVITIE § 4.18): второй экземпляр
   замка — это место, где его однажды забудут подтянуть.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.web = function(A){

var codes = {};            /* что набрано в каждом задании — живёт до перезагрузки */
var results = {};          /* итог последней проверки по каждому заданию */
var previewTimer = null;

function tasks(){ return window.WEB_TASKS || []; }
function topics(){ return window.WEB_TOPICS || []; }
function taskById(id){
  var xs = tasks();
  for (var i = 0; i < xs.length; i++) if (xs[i].id === id) return xs[i];
  return null;
}
function topicOf(t){
  var ts = topics();
  for (var i = 0; i < ts.length; i++) if (ts[i].id === t.topic) return ts[i];
  return null;
}
function doneIn(xs){ return xs.filter(function(x){ return A.algoDone(x.id); }).length; }

/* Панель символов для телефона: угловые и фигурные скобки на мобильной
   клавиатуре лежат на третьем экране — та же беда и то же лечение, что у
   редактора Python (js/editor.js). На широком экране панель прячет CSS.
   Пары вставляются вместе, а курсор встаёт внутрь. */
var WEB_KEYS = ["<>", "</>", "=", '""', "{}", ":", ";", "#", ".", "/"];
var WEB_KEY_BACK = { "<>":1, "</>":1, '""':1, "{}":1 };
function insertKey(ta, key){
  var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
  ta.value = v.slice(0, s) + key + v.slice(e);
  var pos = s + key.length - (WEB_KEY_BACK[key] || 0);
  ta.setSelectionRange(pos, pos);
  ta.focus();
  ta.dispatchEvent(new Event("input"));
}

/* Список требований — это и есть тексты проверок. Один источник: требование,
   которого нет среди проверок, обещало бы то, чего судья не смотрит. */
function checksHTML(t, res){
  return '<ul class="wbchecks">' + t.checks.map(function(c, i){
    var st = res ? (res[i].ok ? "ok" : "bad") : "wait";
    var mk = st === "ok" ? "✓" : (st === "bad" ? "✗" : "○");
    return '<li class="' + st + '"><span class="mk">' + mk + '</span><span>' + A.esc(c.t) + '</span></li>';
  }).join("") + '</ul>';
}
function verdictHTML(res){
  var n = res.length, k = res.filter(function(x){ return x.ok; }).length;
  if (n && k === n)
    return '<div class="msg show ok"><b>Готово ✓</b>Страница прошла все ' + n + ' ' +
      A.plural(n, "проверку", "проверки", "проверок") + ': браузер нашёл в ней всё, что просили.</div>';
  return '<div class="msg show bad"><b>Выполнено ' + k + ' из ' + n + '</b>Чего не хватает — ' +
    'отмечено крестиком в списке «Что нужно сделать». Окно «Страница» показывает, что получилось сейчас.</div>';
}

/* ---- экран задания ---- */
function openWeb(id){
  var t = taskById(id);
  if (!t) return screenWeb();
  A.enterScreen("train", "web");
  if (codes[id] === undefined) codes[id] = t.starter;
  var res = results[id] || null, solved = A.algoDone(t.id), tp = topicOf(t);
  var xs = tasks(), next = xs[xs.indexOf(t) + 1] || null;

  var h = '<div class="lvlhead"><div><div class="idx">HTML и CSS · ' + A.esc(tp ? tp.title : "") + '</div>' +
    '<h1>' + t.emoji + ' ' + A.esc(t.title) + '</h1></div>' +
    (solved ? '<div class="right"><span class="tag">готово ✓</span></div>' : '') + '</div>' +
    '<p class="lede">' + A.esc(t.intro) + '</p>' +
    '<div class="card"><h3>Что нужно сделать</h3><p>' + A.esc(t.goal) + '</p>' +
      '<div id="wbchecks">' + checksHTML(t, res) + '</div></div>' +
    '<div class="card"><h3>Как это пишется</h3><p>' + A.esc(t.learn) + '</p>' +
      '<div class="wbex"><span class="dim">Пример — про другое, это не ответ</span>' +
      '<pre>' + A.esc(t.example.replace(/\n+$/, "")) + '</pre></div></div>' +
    '<div class="wbwrap">' +
      '<div class="wbleft"><div class="rbhead">Код страницы</div>' +
        '<textarea id="wbcode" class="rbcode wbcode" spellcheck="false" rows="14" ' +
          'aria-label="код страницы">' + A.esc(codes[id]) + '</textarea>' +
        '<div class="keybar wbkeys">' + WEB_KEYS.map(function(k, i){
          return '<button class="kbk" data-wk="' + i + '">' + A.esc(k) + '</button>'; }).join("") + '</div>' +
        '<div class="admrow"><button class="rbtn check" id="wbcheck">✓ Проверить</button>' +
        '<button class="rbtn sec" id="wbreset">Сначала</button></div></div>' +
      '<div class="wbright"><div class="rbhead">Страница</div>' +
        '<iframe class="pageframe wbframe" title="так твою страницу покажет браузер" ' +
          'sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe>' +
        '<div class="pagenote"></div>' +
        '<p class="dim">Обновляется, пока пишешь. Картинки из интернета здесь не загружаются нарочно: ' +
          'страница не ходит в сеть.</p></div>' +
    '</div>' +
    '<div id="wbmsg">' + (res ? verdictHTML(res) : "") + '</div>' +
    (solved
      ? '<div class="card"><h3>Разбор</h3><p>' + A.esc(t.note) + '</p></div>'
      : '<div class="card"><h3>Подсказки</h3><ol class="rbhints">' +
        t.hints.map(function(s){ return '<li>' + A.esc(s) + '</li>'; }).join("") + '</ol></div>') +
    '<div class="pager"><button class="bigbtn ghost" id="wbback">← Ко всем заданиям</button>' +
      '<span class="sp"></span>' +
      (next ? '<button class="bigbtn ghost" id="wbnext">Дальше: ' + A.esc(next.title) + ' →</button>' : '') +
    '</div>';

  A.app.innerHTML = h;
  var ta = document.getElementById("wbcode"), frame = A.app.querySelector(".wbframe");
  A.pageFrameWire(frame, A.app.querySelector(".wbright .pagenote"), "только твоя страница");
  function preview(){ frame.setAttribute("srcdoc", A.pageDoc(ta.value)); }
  preview();
  ta.addEventListener("input", function(){
    codes[id] = ta.value;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(preview, 250);
  });
  A.app.querySelectorAll("[data-wk]").forEach(function(b){
    b.onclick = function(){ insertKey(ta, WEB_KEYS[+b.getAttribute("data-wk")]); };
  });
  document.getElementById("wbcheck").onclick = function(){
    codes[id] = ta.value;
    var r = window.WEB.judge(t, ta.value);
    results[id] = r;
    /* Первое решение перерисовывает экран: вместо подсказок открывается
       разбор, в шапке — «готово». Неудача меняет только список и вердикт,
       чтобы не сбить курсор и прокрутку тому, кто ещё пишет. */
    if (window.WEB.passed(r) && !A.algoDone(t.id)){ A.algoMark(t.id); return openWeb(id); }
    document.getElementById("wbchecks").innerHTML = checksHTML(t, r);
    document.getElementById("wbmsg").innerHTML = verdictHTML(r);
  };
  document.getElementById("wbreset").onclick = function(){
    codes[id] = t.starter; results[id] = null; openWeb(id);
  };
  document.getElementById("wbback").onclick = screenWeb;
  var nb = document.getElementById("wbnext");
  if (nb) nb.onclick = function(){ openWeb(next.id); };
  A.refreshTop();
}

/* ---- список заданий по темам ---- */
function screenWeb(){
  A.enterScreen("train", "web");
  var xs = tasks();
  var h = '<div class="lvlhead"><div><div class="idx">вёрстка: вторая грань информатики</div>' +
    '<h1>🌐 HTML и CSS</h1></div><div class="right"><span class="tag">' + doneIn(xs) + ' из ' + xs.length +
    '</span></div></div>' +
    '<p class="lede">Страница сайта своими руками: теги, списки, таблицы, цвета и раскладка. ' +
    'Страницу видно сразу, пока пишешь, а проверяет её сам браузер.</p>' +
    '<div class="card"><h3>⚖️ Честно про этот раздел</h3><ul class="trrules">' +
      '<li><b>HTML и CSS — не языки программирования.</b> Они описывают, ЧТО на странице и КАК это ' +
      'выглядит, но ничего не вычисляют. Программировать здесь учит Python, а этот раздел — про то, ' +
      'из чего сделан любой сайт.</li>' +
      '<li><b>Проверяет браузер:</b> разбирает твою страницу и смотрит, есть ли в ней нужные теги и ' +
      'правила. Как именно ты их расставишь — твоё дело; одного-единственного верного ответа нет.</li>' +
      '<li><b>В школьной программе</b> создание страниц на HTML есть в углублённом курсе 9 класса, CSS — ' +
      'вне программы. Это плюс к предмету, а не школьная тема, которую закрывают к аттестации.</li>' +
      '<li><b>Страница не ходит в интернет.</b> Картинки с чужих сайтов не загрузятся, скрипты не ' +
      'выполнятся. Это нарочно: так твоя страница ничего не расскажет о тебе постороннему сайту.</li>' +
    '</ul></div>';
  topics().forEach(function(tp){
    var ts = xs.filter(function(x){ return x.topic === tp.id; });
    h += '<div class="sect"><h2>' + tp.em + ' ' + A.esc(tp.title) + '</h2><div class="line"></div>' +
      '<span class="cnt">' + doneIn(ts) + ' из ' + ts.length + '</span></div><div class="gamegrid">';
    ts.forEach(function(t){
      h += '<button class="gamecard" data-wb="' + A.esc(t.id) + '">' +
        '<span class="gemoji">' + t.emoji + '</span>' +
        '<b>' + A.esc(t.title) + (A.algoDone(t.id) ? ' <span class="edittag done">готово ✓</span>' : '') + '</b>' +
        '<span>' + A.esc(t.intro) + '</span></button>';
    });
    h += '</div>';
  });
  h += '<div class="pager"><button class="bigbtn ghost" id="wbtomap">← К тренировкам</button></div>';
  A.app.innerHTML = h;
  A.app.querySelectorAll("[data-wb]").forEach(function(b){
    b.onclick = function(){ openWeb(b.getAttribute("data-wb")); };
  });
  document.getElementById("wbtomap").onclick = A.screenTrain;
  A.refreshTop();
}

return { screenWeb: screenWeb, openWeb: openWeb };
};
