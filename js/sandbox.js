/* ============================================================
   Фионика — настоящий Python в песочнице (Pyodide).

   ⚠️ ПЯТОЕ ОТРЕЗАНИЕ ПО ДОГОВОРУ из js/screens-showcase.js. Наружу торчит
   одно имя — screenSandbox; внутрь нужны двадцать восемь. Как и у рабочей
   станции, это не изъян разреза: песочница — конечный экран, он ничего не
   сообщает продукту, но пользуется всем сразу.

   ⚠️ ЧУЖОЕ ИЗМЕНЯЕМОЕ СОСТОЯНИЕ ЧИТАЕТСЯ ВЫЗОВОМ — A.S() и A.session(), а не
   A.S и A.session. Правило выведено на рабочей станции и здесь применено
   заранее, до того как оно успело сломать. Причина у каждого своя:
     session пересоздаётся при каждом заходе в урок;
     S сегодня переживает загрузку прогресса только потому, что
     Object.assign меняет объект НА МЕСТЕ и возвращает его же. Стоит кому-то
     однажды написать «S = {…}» вместо Object.assign — и модуль, схвативший
     ссылку при сборке, начнёт читать позапрошлый прогресс. Вызов такой
     правки не заметит, копия — заметит через неделю и молча.

   ⚠️ Второй контур продукта живёт здесь. Pyodide грузится ТОЛЬКО по нажатию
   кнопки и только в песочнице: ни в SHELL сервис-воркера, ни в однофайловой
   сборке его нет, а курс, экзамен и разминки всегда идут на своём движке.
   Это стережёт тест [два контура] — файл переехал, правило осталось.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.sandbox = function(A){

/* ================= настоящий Python в песочнице =================
   Тяжёлый контур из docs/golos-i-produkty-2026-09-06.md § 3.7: лёгкий движок
   остаётся продуктом, а настоящий CPython включает человек и только здесь.

   ⚠️ Выбор хранится ОТДЕЛЬНЫМ ключом и в облако не уезжает — это настройка
   устройства, как тема и звук (A.SFX_KEY, A.VOICE_KEY). На школьном компьютере
   качать шесть мегабайт незачем, дома — можно, и это разные ответы для
   одного и того же ребёнка.

   ⚠️ Курса это не касается вовсе: уроки, экзамен, разминки и проверки всегда
   на «mini», иначе сверок с python3 стало бы вдвое больше. */
var PY_KEY = "kodokvest_python";
function pyWanted(){ try { return localStorage.getItem(PY_KEY) === "on"; } catch(e){ return false; } }
function pySet(on){
  try { if (on) localStorage.setItem(PY_KEY, "on"); else localStorage.removeItem(PY_KEY); } catch(e){}
}
/* Настоящий Python доступен только на живом сайте: в сборке одним файлом
   рядом нет папки vendor, и обещание «всё внутри» это охраняет. */
function pyPossible(){ return !window.__SINGLE_FILE__ && Runtime.has("pyodide"); }

function screenSandbox(){
  var seq = A.enterScreen("train", "sand");
  /* sandbox:true — метка для A.draftFlush: уход с этого экрана обязан сохранить код */
  /* ⚠️ Сессию нельзя присвоить из чужого файла — только попросить хозяина.
     Слепая замена «session» на «A.session()» дала здесь «A.session() = {…}»,
     то есть присваивание вызову; поймал тест, а не сборка. Для записи
     чужого состояния нужен отдельный вход, и он тут один. */
  A.newSession({ id:null, attempts:0, hints:0, shown:false, sandbox:true });

  /* Настоящий Python живёт в памяти вкладки: после перезагрузки страницы его
     надо поднять заново. Файлы к этому времени уже в кэше — это быстро и
     работает без сети, но всё равно не мгновенно, поэтому экран рисуется
     сразу на быстром движке, а когда тяжёлый поднимется — перерисовывается. */
  var real = pyPossible() && pyWanted() && Runtime.isReady("pyodide");
  var waking = pyPossible() && pyWanted() && !real;

  var refTurtle = ["forward(100)","back(50)","right(90)","left(90)",'color("red")',"width(5)","penup()","pendown()",
             "goto(0, 0)","dot(10)","circle(60)","print(x)","range(10)","len(s)","sum(xs)","randint(1, 6)","sqrt(16)"];
  /* На настоящем Python черепашки нет, и предлагать её командами было бы
     обманом. Зато есть импорты, которых мини-движок не знает. */
  var refReal = ["print(x)","range(10)","len(s)","sum(xs)","sorted(xs)","enumerate(xs)","zip(a, b)",
             "import math","import random","import json","import itertools","f\"{x:.2f}\"","[x*x for x in xs]"];
  var ref = real ? refReal : refTurtle;

  A.app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">свободный режим</div><h1>Песочница</h1></div></div>' +
    '<p class="lede">Никаких заданий и проверок. Пиши что угодно, запускай, ломай и чини. Код сохраняется между заходами.</p>' +
    pyCardHTML(real, waking) +
    '<div class="card"><h3>Что можно позвать</h3><div class="ref">' +
      ref.map(function(x){ return "<span>" + A.esc(x) + "</span>"; }).join("") +
    '</div><p class="dim">Нажми на команду — она вставится в конец кода.</p></div>' +
    '<div id="studio"></div>' +
    /* ⚠️ «Назвать и сохранить» стоит для ЛЮБОГО движка, в отличие от галереи:
       галерея про рисунки, а своя программа — это что угодно, от считалки до
       игры. Пункт 2.4 плана: из песочницы уходило всё, кроме рисунков. */
    '<div class="savework"><button class="rbtn" id="towork">🛠 Назвать и сохранить в «Моё»</button>' +
    '<span class="tip">Дай программе имя — и она ляжет в портфолио, а ссылку на неё ' +
    'можно отправить: друг откроет и запустит, не видя кода.</span>' +
    '<div class="workform" id="workform" hidden>' +
      '<label>Название<input type="text" id="worktitle" maxlength="40" ' +
        'placeholder="например, Угадай число" autocomplete="off"></label>' +
      '<label>Что она делает<input type="text" id="workabout" maxlength="160" ' +
        'placeholder="загадывает число, а ты угадываешь за пять попыток" autocomplete="off"></label>' +
      '<div class="row"><button class="rbtn" id="worksave">Сохранить</button>' +
      '<button class="rbtn sec" id="workcancel">Отмена</button></div>' +
    '</div>' +
    '<div class="msg" id="workmsg"></div></div>' +
    (real ? "" :
    '<div class="savepic"><button class="rbtn" id="topic">🖼 Сохранить рисунок в галерею</button>' +
    '<span class="tip">Рисунки лежат в портфолио — их можно показать и скачать картинкой. ' +
    'Первая строка-комментарий станет названием.</span>' +
    '<div class="msg" id="picmsg"></div></div>') +
    '<div class="pager"><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';

  var studio = A.makeStudio({
    engine: real ? "pyodide" : "mini", draw: !real,
    code: (real && (!A.S().sandbox || A.S().sandbox === A.SANDBOX_START)) ? A.SANDBOX_START_PY : (A.S().sandbox || A.SANDBOX_START),
    onRun: function(){
      A.S().sandboxRuns = (A.S().sandboxRuns || 0) + 1;
      A.S().sandbox = studio.editor.getCode();
      if (A.S().sandboxRuns >= 10) A.award("explorer");
      A.save();
    },
    lint: true,
    /* Уход в разбор сохраняет код песочницы: A.draftFlush в A.claimScreen видит
       метку sandbox и пишет A.S().sandbox — поэтому возврат ничего не теряет. */
    viz: function(o){
      A.screenViz({ code: o.code, env: o.env,
        backTo: { label: "← Вернуться в песочницу", go: screenSandbox } });
    }
  });
  document.getElementById("studio").appendChild(studio);
  A.session().studio = studio;
  studio.editor.onEdit = A.draftSchedule;
  A.app.querySelectorAll(".ref span").forEach(function(sp){
    sp.onclick = function(){
      var c = studio.editor.getCode();
      studio.editor.setCode(c + (!c || /\n$/.test(c) ? "" : "\n") + sp.textContent + "\n");
      studio.editor.focusEditor();
    };
  });
  var topic = document.getElementById("topic");
  if (topic) topic.onclick = function(){
    var code = studio.editor.getCode();
    var m = document.getElementById("picmsg");
    var res = A.galleryDrawing(code);
    if (!res || res.error){
      m.className = "msg show bad";
      m.innerHTML = res && res.error
        ? "<b>Программа падает</b>Сначала пусть заработает: " + A.esc(res.error.msg)
        : "<b>Не получилось</b>Черепашка в этом движке недоступна.";
      return;
    }
    if (res.empty){
      m.className = "msg show warn";
      m.innerHTML = "<b>Рисунка нет</b>Программа не нарисовала ни линии, ни точки. " +
        "Проверь, что вызываешь forward(...) и что карандаш опущен.";
      return;
    }
    A.S().sandbox = code;
    var id = A.gallerySave(code);
    var t = (A.galleryAll()[id] || {}).title || "Рисунок";
    m.className = "msg show ok";
    m.innerHTML = "<b>«" + A.esc(t) + "» в галерее</b>Открыть, показать и скачать картинкой — " +
      "в портфолио, раздел «Мои рисунки». Хранится программа, а не картинка: рисунок " +
      "считается заново каждый раз, поэтому места занимает несколько строк.";
  };
  /* ---- назвать и сохранить свою программу ---- */
  var wform = document.getElementById("workform"),
      wmsg  = document.getElementById("workmsg"),
      wttl  = document.getElementById("worktitle"),
      wabt  = document.getElementById("workabout");
  document.getElementById("towork").onclick = function(){
    var code = studio.editor.getCode();
    if (!code.trim()){
      wmsg.className = "msg show warn";
      wmsg.innerHTML = "<b>Сохранять нечего</b>В редакторе пусто — сначала напиши программу.";
      return;
    }
    /* ⚠️ Проверяем, что программа хотя бы запускается. Сохранить сломанное
       можно было бы, но ссылка на падающую программу — это подарок, который
       не открывается, и стыдно за него будет ребёнку, а не нам. */
    var r = Runtime.get(real ? "pyodide" : "mini").run(code, { stdin: [] });
    if (r.error){
      wmsg.className = "msg show bad";
      wmsg.innerHTML = "<b>Сначала пусть заработает</b>" + A.errHTML(r.error) +
        "<br>Программу с ошибкой сохранять незачем: тот, кому ты дашь ссылку, " +
        "увидит ровно эту ошибку.";
      return;
    }
    wform.hidden = false;
    wmsg.className = "msg";
    wttl.focus();
  };
  document.getElementById("workcancel").onclick = function(){ wform.hidden = true; };
  document.getElementById("worksave").onclick = function(){
    var t = (wttl.value || "").trim();
    if (!t){
      wmsg.className = "msg show warn";
      wmsg.innerHTML = "<b>Нужно имя</b>Пока не назовёшь — это просто код в редакторе. " +
        "Назовёшь — станет твоей вещью, которую можно показать.";
      wttl.focus();
      return;
    }
    var code = studio.editor.getCode();
    A.S().sandbox = code;
    var id = A.myWorkSave(t, wabt.value, code);
    var w = A.myWorkById(id);
    wform.hidden = true;
    wttl.value = ""; wabt.value = "";
    wmsg.className = "msg show ok";
    wmsg.innerHTML = "<b>«" + A.esc(w.title) + "» сохранена</b>" +
      "Она лежит в «Моём», в разделе «Мои программы»: оттуда её можно открыть, " +
      "переделать и отправить ссылкой. " +
      '<div class="row"><button class="rbtn" id="worklink">🔗 Скопировать ссылку</button>' +
      '<button class="rbtn sec" id="workfolio">🎒 Открыть «Моё»</button></div>';
    document.getElementById("worklink").onclick = function(e){
      A.copyText(A.myWorkLink(w), e.currentTarget);
    };
    document.getElementById("workfolio").onclick = A.screenFolio;
  };

  document.getElementById("tomap").onclick = function(){ A.S().sandbox = studio.editor.getCode(); A.save(); A.screenWorlds(); };
  pyCardWire(seq, studio, real, waking);
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ---- карточка «движок» в песочнице ----
   Написано прямым текстом, что именно меняется: сколько скачается, что
   будет потом и чего не станет. Это правило тяжёлого контура — «у
   переключателя сказано, что происходит», — а не украшение. */
function pyCardHTML(real, waking){
  if (!pyPossible()) return "";
  if (real)
    return '<div class="card pyeng on"><h3>🐍 Сейчас работает настоящий Python</h3>' +
      '<p>Тот самый CPython, что стоит на компьютерах взрослых. Он уже скачан — ' +
      'интернет для него больше не нужен.</p>' +
      '<div class="pyrow"><button class="rbtn sec" id="pyoff">Вернуть быстрый</button>' +
      '<span class="tip">Черепашки и пошагового разбора в настоящем Python нет — они живут в быстром.</span></div>' +
      '<div class="msg" id="pymsg"></div></div>';
  return '<div class="card pyeng"><h3>🐍 Хочешь настоящий Python?</h3>' +
    '<p>Сейчас код запускает наш быстрый движок: мгновенно, без интернета, с черепашкой. ' +
    'А по кнопке в песочницу можно поставить настоящий CPython — ровно тот, что стоит ' +
    'у взрослых на компьютере.</p>' +
    '<div class="pyrow">' +
      '<button class="rbtn" id="pyon"' + (waking ? " disabled" : "") + '>' +
        (waking ? "Поднимаю настоящий Python…" : "Включить настоящий Python") + '</button>' +
      '<div class="pybar" id="pybar"' + (waking ? "" : " hidden") + '><i></i></div>' +
      '<span class="pypct" id="pypct"></span>' +
    '</div>' +
    '<p class="dim">Скачается один раз, около 6 МБ. После этого работает и без интернета. ' +
    'Пока не нажал — не качается ничего: уроки, экзамен и разминки к этому отношения не имеют, ' +
    'они всегда на быстром движке. В настоящем Python нет черепашки и пошагового разбора.</p>' +
    '<div class="msg" id="pymsg"></div></div>';
}

function pyCardWire(seq, studio, real, waking){
  if (!pyPossible()) return;
  var msg = document.getElementById("pymsg");
  function keepCode(){ A.S().sandbox = studio.editor.getCode(); A.save(); }

  var off = document.getElementById("pyoff");
  if (off) off.onclick = function(){ keepCode(); pySet(false); screenSandbox(); };

  var bar = document.getElementById("pybar"), pct = document.getElementById("pypct");
  function show(p){
    if (bar){ bar.hidden = false; bar.querySelector("i").style.width = p + "%"; }
    if (pct) pct.textContent = p + "%";
  }
  function start(){
    var on = document.getElementById("pyon");
    if (on){ on.disabled = true; on.textContent = "Качаю настоящий Python…"; }
    show(0);
    Runtime.load("pyodide", function(p){ if (!A.screenStale(seq)) show(p); }).then(function(){
      if (A.screenStale(seq)) return;
      pySet(true);
      keepCode();
      screenSandbox();
    }, function(e){
      if (A.screenStale(seq)) return;
      /* Не получилось — остаёмся на быстром движке и говорим почему.
         Чаще всего это «нет сети и раньше не качали»: файлы лежат у нас, но
         в кэше их ещё нет. */
      pySet(false);
      if (bar) bar.hidden = true;
      if (pct) pct.textContent = "";
      var b = document.getElementById("pyon");
      if (b){ b.disabled = false; b.textContent = "Попробовать ещё раз"; }
      if (msg){
        msg.className = "msg show bad";
        /* Почему не скачалось — словами ребёнка, без названий файлов:
           читать «не удалось загрузить vendor/pyodide/pyodide.js» ему нечем. */
        msg.innerHTML = "<b>Не скачалось</b>Похоже, нет интернета. Настоящий Python нужно " +
          "получить один раз — потом он работает и без сети. Быстрый движок работает как работал, " +
          "можно спокойно продолжать и попробовать ещё раз потом.";
      }
    });
  }

  var on = document.getElementById("pyon");
  if (on && !waking) on.onclick = start;
  /* Выбор уже сделан раньше, страницу просто перезагрузили: поднимаем молча. */
  if (waking) start();
}

return { screenSandbox: screenSandbox };
};
