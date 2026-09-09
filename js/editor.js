/* ============================================================
   Фионика — редактор кода: текстовое поле, подсветка, панель символов,
   номера строк и переключение файлов проекта.

   ⚠️ ВТОРОЕ ОТРЕЗАНИЕ ПО ДОГОВОРУ из js/screens-showcase.js (там же он
   описан целиком). Редактор выбран не по важности, а по связанности —
   её замерили перед выбором по всем разделам app.js сразу:

     раздел                          строк   наружу   внутрь
     редактор                          288        2        4
     рабочая станция                   280        1       16
     настоящий Python в песочнице      262        1       27

   Наружу торчат ровно два имени, внутрь нужны четыре — лучшее соотношение
   в файле. ⚠️ Мерить надо каждый раз заново: за один день работы порядок
   в этой таблице поменялся дважды.

   Редактор ничего не знает ни про уроки, ни про проверку, ни про экраны: он
   умеет показать текст, подсветить его и отдать обратно. Всё, что ему нужно
   снаружи, — четыре чистые функции разметки, и они приходят объектом A.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.editor = function(A){

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
   A.esc() экранирует только &, < и > — кавычка порвала бы разметку. Ту же
   грабку уже находили на форме «своего задания». */
var KEYBAR_HTML = '<div class="keybar">' +
  KEYBAR_KEYS.map(function(k, i){
    return '<button class="kbk" type="button" data-k="' + i + '">' + A.esc(k) + '</button>';
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
        return '<button class="ftab' + (i === 0 ? " on" : "") + '" data-file="' + i + '">' + A.esc(f.name) + '</button>';
      }).join("") + '</div>'
    : "";
  box.innerHTML =
    '<div class="ehead"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="lbl">' +
      A.esc(many ? files[0].name : (label || "твой код")) + '</span></div>' + tabs +
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
  /* ⚠️ Длинная строка кода ПЕРЕНОСИТСЯ (white-space:pre-wrap), а номер строки
     в колонке слева — ровно один и высотой в одну строку. Поэтому без выравнивания
     всё, что ниже первого переноса, съезжает вверх, и красная метка ошибки
     показывает НЕ НА ТУ строку — ребёнок ищет ошибку не там, где она есть.
     На 375px перенос начинается примерно с 33 знаков, то есть постоянно.
     Считать точку переноса самим нельзя: браузер рвёт строку по своим правилам
     (сначала по пробелам, потом где придётся). Поэтому мы не вычисляем, а
     ЗАМЕРЯЕМ — по подсветке, которая лежит поверх поля тем же шрифтом:
     расстояние между началами соседних строк и есть настоящая высота строки. */
  function lineTops(){
    var walk = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], starts = [], total = 0, node;
    while ((node = walk.nextNode())){ nodes.push({ n: node, at: total }); total += node.nodeValue.length; }
    if (!nodes.length) return null;
    var text = nodes.map(function(x){ return x.n.nodeValue; }).join("");
    var offs = [0];
    for (var i = 0; i < text.length; i++) if (text[i] === "\n") offs.push(i + 1);
    var rng = document.createRange();
    /* Замер держится на Range.getBoundingClientRect. Его нет ни в jsdom, ни в
       старых движках — там просто уходим ни с чем, и колонка номеров остаётся
       такой, какой была. */
    if (!rng || typeof rng.getBoundingClientRect !== "function") return null;
    var tops = [], ok = false;
    for (var j = 0; j < offs.length; j++){
      var want = offs[j], hit = nodes[0];
      for (var k = 0; k < nodes.length; k++) if (nodes[k].at <= want) hit = nodes[k]; else break;
      var local = Math.min(want - hit.at, hit.n.nodeValue.length);
      try { rng.setStart(hit.n, local); rng.collapse(true); } catch(e){ return null; }
      var r = rng.getBoundingClientRect();
      if (r.top || r.bottom) ok = true;
      tops.push(r.top);
    }
    return ok ? tops : null;             /* нули — значит замерить нечем (jsdom) */
  }
  /* Подогнать высоту каждого номера под настоящую высоту его строки.
     Если замер не удался, ничего не трогаем — будет как раньше. */
  function syncGutter(){
    var tops = lineTops();
    if (!tops || tops.length < 2) return;
    var items = gut.children;
    for (var i = 0; i < items.length; i++){
      var h = (i + 1 < tops.length) ? Math.round(tops[i + 1] - tops[i]) : 0;
      items[i].style.height = h > 0 ? h + "px" : "";
    }
  }
  box._syncGutter = syncGutter;
  function sync(){
    pre.innerHTML = A.hlWatched(ta.value, box._watch, box._watch ? colsFit() : 0) + "\n";
    ta.style.height = "auto";
    ta.style.height = Math.max(190, ta.scrollHeight) + "px";
    var n = ta.value.split("\n").length, g = "";
    /* ⚠️ Строки пометок ищем на КАЖДОЙ отрисовке, а не запоминаем номер:
       ребёнок дописывает строки выше, и запомненный номер начал бы показывать
       не туда. Ищем по тексту строки — точка едет вместе с ней. */
    var noted = [];
    if (box._notes) box._notes.forEach(function(m){
      var ln = A.noteMarkLine(ta.value, m);
      if (ln && noted.indexOf(ln) < 0) noted.push(ln);
    });
    for (var i = 1; i <= n; i++)
      g += '<i class="' + (i === box._errLine ? "err"
              : (i === box._curLine ? "cur"
              : (noted.indexOf(i) >= 0 ? "note" : ""))) +
           '">' + i + '</i>';
    gut.innerHTML = g;
    syncGutter();
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

  /* Строки с пометкой взрослого. ⚠️ В отличие от _errLine и _curLine НЕ
     сбрасывается при наборе: ошибка относится к последнему запуску, а
     пометка — к уроку, и от того, что ребёнок дописал строку, она никуда
     не девается. */
  box._notes = null;
  box.setNotes = function(marks){
    box._notes = (marks && marks.length) ? marks.slice() : null;
    sync();
  };
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


return { KEYBAR_KEYS: KEYBAR_KEYS, makeEditor: makeEditor };
};
