/* ============================================================
   Кодоквест — экран «Витрина: что создают ученики».

   ⚠️ ПЕРВЫЙ ОТРЕЗАННЫЙ ЭКРАН. Разбор архитектуры 08.09.2026 назвал главный
   долг: js/app.js вырос до 19 679 строк, и тест [имена] существует ровно
   поэтому — JavaScript не ругается на две функции с одним именем и молча
   зовёт объявленную позже. Лечим не переписыванием на модули (это неделя и
   риск на весь продукт), а по одному экрану за раз. Витрина взята первой не
   случайно: наружу из неё торчат всего четыре имени — меньше, чем у любого
   другого экрана, — значит на ней дешевле всего проверить сам приём.

   ДОГОВОР МЕЖДУ ФАЙЛОМ И app.js, и он же образец для следующих отрезаний:

     1. Файл НИЧЕГО не берёт из области видимости app.js напрямую. Всё, что
        ему нужно, приходит одним объектом A — его собирает app.js в том
        месте, где раньше лежал сам экран.
     2. Файл НИЧЕГО не пишет в общее состояние. Единственное, что экран менял
        снаружи, — переменная session; вместо присваивания вызывается
        A.clearSession(), потому что чужую переменную из другого файла не
        присвоить, а прятать это за геттером значит соврать про связь.
     3. Файл возвращает ровно те имена, которые нужны снаружи, — app.js
        раскладывает их по своим переменным. Список возвращаемого и есть
        честная мера связанности: чем он короче, тем удачнее разрез.
     4. Подключается ДО app.js — в index.html, build.js и sw.js. Забыть один
        из трёх нельзя: сборка и офлайн разъедутся с сайтом молча.

   ⚠️ Глобалы CURRICULUM и Runtime намеренно НЕ заворачиваются в A: это общие
   службы всего продукта, они и так лежат на window и подключаются раньше.
   Заворачивать их значило бы делать вид, что связь слабее, чем она есть.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.showcase = function(A){

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

function showcaseRun(code, stdin){
  var key = code + "\u0000" + (stdin || []).join("\u0000");
  if (showOut[key] === undefined){
    var r = Runtime.get("mini").run(code, { stdin: (stdin || []).slice() });
    showOut[key] = r.error ? null : String(r.output || "").replace(/\n+$/, "");
  }
  return showOut[key];
}
/* Готовая программа проекта — это последний шаг. Берём её же, что и экран
   «проект собран», чтобы витрина не разошлась с тем, что получит ребёнок.
   ⚠️ Игра-проект ЖДЁТ ходов — витрине отдаём записанную партию из её же
   проверки (step.stdin): на экране живой вывод настоящей игры, а не ошибка. */
function showcaseProjects(){
  return A.projectsList().map(function(p){
    var last = p.steps[p.steps.length - 1];
    var code = last.solution || "";
    return { p: p, code: code, out: showcaseRun(code, last.stdin), done: A.projectDone(p.id) };
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
  var seq = A.enterScreen("home", "works");
  A.clearSession();

  var list = showcaseProjects();
  var doneN = list.filter(function(x){ return x.done; }).length;
  var pics = A.galleryList().length, made = A.buildsList().length;
  var mine = A.myTasksList().length, got = A.solvedCount();

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
      '<b>' + p.emoji + ' ' + A.esc(p.title) + (x.done ? ' <span class="edittag done">собран ✓</span>' : '') + '</b>' +
      '<span class="dim">' + A.esc(showcaseAfter(p)) + '</span></div>' +
      '<p class="dim">' + A.esc(p.tagline) + '</p>' +
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

  var games = A.gamesList();
  if (games.length){
    h += '<div class="card"><h3>🎮 Игры, у которых виден код</h3>' +
      '<p class="dim">В каждую можно играть, и у каждой рядом лежит её программа — ' +
      'её можно менять прямо во время игры.</p><div class="admrow">';
    games.forEach(function(g){
      h += '<button class="rbtn sec" data-game="' + A.esc(g.id) + '">' + g.emoji + ' ' + A.esc(g.title) + '</button>';
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
                (got ? ', и их решали <b>' + got + '</b> ' + A.plural(got, "раз", "раза", "раз") : '') + '.</li>' : '') +
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
  A.app.innerHTML = h;

  A.app.querySelectorAll("[data-show]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-show");
      var box = A.app.querySelector('[data-out="' + id + '"]');
      var x = list.filter(function(y){ return y.p.id === id; })[0];
      if (!box || !x || x.out === null) return;
      var lines = x.out.split("\n");
      box.hidden = false;
      box.textContent = lines.slice(0, SHOW_LINES).join("\n") +
        (lines.length > SHOW_LINES ? "\n… и ещё " + (lines.length - SHOW_LINES) + " " +
          A.plural(lines.length - SHOW_LINES, "строка", "строки", "строк") : "");
      b.disabled = true;
    };
  });
  A.app.querySelectorAll("[data-showopen]").forEach(function(b){
    b.onclick = function(){ A.screenProjectDone(b.getAttribute("data-showopen")); };
  });
  A.app.querySelectorAll("[data-game]").forEach(function(b){
    b.onclick = function(){ A.openGame(b.getAttribute("data-game")); };
  });
  var sf = document.getElementById("showfolio");
  if (sf) sf.onclick = A.screenFolio;
  document.getElementById("tomap").onclick = A.goHome;

  /* Рисунки: контент первого мира приходит по требованию. Если экран за это
     время сменился, ничего не рисуем — иначе canvas'ы уедут в чужую разметку. */
  A.worldContent(1).then(function(){
    if (A.screenStale(seq)) return;
    var strip = document.getElementById("drawstrip");
    if (!strip) return;
    var eng = Runtime.get("mini"), ready = [];
    strip.innerHTML = "";
    (CURRICULUM.world(1).lessons || []).forEach(function(l){
      if (ready.length >= 4) return;
      var body = A.lessonBody(l);
      if (!body || !body.draw || !body.task) return;
      var t = eng.newTurtle ? eng.newTurtle() : null;
      if (!t) return;
      var r = eng.run(body.task.solution, { turtle: t });
      if (r.error || !t.segs || !t.segs.length) return;
      var cell = document.createElement("div");
      cell.className = "drawcell";
      cell.innerHTML = '<canvas></canvas><span class="dim">урок ' + l.num + ' · ' + A.esc(l.title) + '</span>';
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
    ready.forEach(function(x){ A.drawTurtle(x.canvas, x.turtle); });
  });

  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}


return { SHOW_LINES: SHOW_LINES, showcaseRun: showcaseRun,
         showcaseProjects: showcaseProjects, showcaseAfter: showcaseAfter,
         screenShowcase: screenShowcase };
};
