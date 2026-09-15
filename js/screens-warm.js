/* ============================================================
   Фионика — экраны раздела «Разминка».

   Отрезаны из app.js 15.09.2026 (архитектурный долг, § 2.5 RAZVITIE) по
   договору из шапки js/screens-showcase.js: всё чужое приходит объектом A.

   ЗАМЕР ПЕРЕД РАЗРЕЗОМ (правило § 4.2). Запись в очереди обещала «наружу 9
   на 287 строк» — это был замер ОДНОГО куска: раздел жил двумя, между ними
   регистрация, профиль и «Сегодня». Целиком: 18 имён, 11 из них нужны снаружи.
   Разрез проведён не по баннеру, а по смыслу:
     — ОСТАЛИСЬ в app.js слой данных (warmupsList, warmupDone, warmupOpen,
       warmupsOpen): их читают задача дня, занятие, кабинет и числа вывески;
       и общая студия «что напечатает» (makePredictStudio, normPred,
       predictDiff): ею спрашивают ещё экзамен по своей программе и «Спросите
       вслух». Унести их сюда — значило бы отдавать наружу втрое больше имён,
       то есть резать не там (тот же вывод, что у домашки в 1.146.0);
     — УЕХАЛИ экраны списка и разминки, «собери из блоков», «предскажи
       память», три проверки и победа. Наружу 5 имён: screenWarmups и
       openWarmup (Главное, «Сегодня», занятие, адрес #warmup) и memFrame,
       memAnswers, memNorm — их зовёт тест.

   ⚠️ СОСТОЯНИЕ. Прогресс файл не читает и пишет одним входом
   A.warmupMark(id, daily) — «разгадано» и «задача дня сделана» (§ 4.5).
   Сессия — чужое изменяемое состояние: A.session() и A.newSession(v).
   Визуализатор — сам модуль (js/screens-viz.js), его имена приходят
   обёртками: в app.js они присваиваются ниже этого договора (§ 4.40).
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.warm = function(A){

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
        '<pre class="bcode"><code>' + A.hl(blocks[bi]) + '</code></pre>' +
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
    con.innerHTML = text ? A.esc(text) : '<span class="empty">программа ничего не напечатала</span>';
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
  var session = A.session();
  session.attempts++;
  var eng = Runtime.get("mini");
  var got = eng.run(ed.getCode(), {});
  if (got.error){
    session.studio.hideOut();
    showMsg("bad", "<b>Пока не запускается</b>" + A.errHTML(got.error) +
      "<br>Скорее всего, какая-то строка стоит не на своём месте или не на своём отступе. Переставь и попробуй снова.");
    return;
  }
  var ref = eng.run(w.code, {});
  session.studio.reveal(got.output);
  if (got.output === ref.output){
    winWarmup(w);
  } else {
    showMsg("bad", "<b>Запускается, но вывод не тот</b>" +
      A.predictDiff(ref.output, got.output, "нужный вывод", "твой вывод") +
      "Порядок строк меняет и вывод — переставь и попробуй снова.");
  }
}

function screenWarmups(){
  A.enterScreen("train", "warm");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  var ws = A.warmupsList();
  var open = A.warmupsOpen();
  var done = open.filter(function(w){ return A.warmupDone(w.id); }).length;
  var locked = ws.length - open.length;
  var h = '<div class="lvlhead"><div><div class="idx">думай, потом проверяй</div><h1>🔮 Разминка</h1></div>' +
    '<div class="right"><span class="tag">разгадано ' + done + ' из ' + open.length + '</span></div></div>' +
    '<p class="lede">Короткие загадки «угадай вывод». Прочитай программу и запиши, что она напечатает, — до запуска. ' +
    'Это тренирует главное умение программиста: держать ход программы в голове. Звёзды тут не начисляются, ошибаться можно сколько угодно.</p>' +
    '<div class="gamegrid">';
  ws.forEach(function(w){
    /* Закрытые не прячем, а показываем замком: видно, что впереди есть ещё,
       и понятно, какой урок это откроет. Спрятанное просто не существует. */
    var op = A.warmupOpen(w);
    var les = op ? null : CURRICULUM.byId(w.lesson);
    h += '<button class="gamecard' + (op ? "" : " locked") + '" data-id="' + w.id + '"' +
      (op ? "" : " disabled") + '>' +
      '<span class="gemoji">' + (op ? w.emoji : "🔒") + '</span>' +
      '<b>' + A.esc(w.title) + (op && A.warmupDone(w.id) ? ' <span class="edittag done">разгадано ✓</span>' : '') + '</b>' +
      '<span>' + (op ? A.esc(w.intro)
                     : "Откроется после урока " + (les ? les.num + " «" + A.esc(les.title) + "»" : "из программы")) + '</span>' +
      '<span class="wtag">' + A.esc(w.tag) + '</span></button>';
  });
  h += '</div><div class="pager"><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';
  A.app.innerHTML = h;
  A.app.querySelectorAll(".gamecard").forEach(function(b){
    b.onclick = function(){ if (!b.disabled) openWarmup(b.getAttribute("data-id")); };
  });
  document.getElementById("tomap").onclick = A.goHome;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function openWarmup(id, opts){
  var ws = A.warmupsList();
  var w = ws.filter(function(x){ return x.id === id; })[0];
  if (!w) return screenWarmups();
  /* Жёсткий потолок дня меряет ВСЁ время в тренажёре, а не только уроки, —
     значит и сюда новая работа после предела не пускает. */
  if (A.capHard()) return A.screenCapReached();
  A.enterScreen("train", "warmup");
  var isDaily = !!(opts && opts.daily);
  var session = A.newSession({ id:id, attempts:0, hints:0, shown:false, daily:isDaily });
  /* из задачи дня «назад» и списки ведут на экран «Сегодня», а не в разминку */
  var backFn = isDaily ? A.screenToday : screenWarmups;
  var pos = ws.indexOf(w);
  var next = isDaily ? null : (pos < ws.length - 1 ? ws[pos+1] : null);
  var prev = isDaily ? null : (pos > 0 ? ws[pos-1] : null);

  var isBlocks = w.type === "blocks";
  var isMemory = w.type === "memory";
  var crumbRoot = isDaily
    ? '<span data-go="back">Сегодня</span> › 🔥 Задача дня'
    : '<span data-go="back">Разминка</span>';
  var head = '<div class="crumbs">' + crumbRoot + ' › ' + w.emoji + ' ' + A.esc(w.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">' + (isBlocks ? "собери из блоков" : isMemory ? "предскажи память" : "угадай вывод") + '</div><h1>' + w.emoji + ' ' + A.esc(w.title) + '</h1></div>' +
    '<div class="right"><span class="tag">' + A.esc(w.tag) + '</span></div></div>' +
    '<p class="lede">' + A.esc(w.intro) + '</p>' +
    '<div class="goal"><h3>🎯 Твоя задача</h3><p>' + A.esc(w.brief) + '</p></div>';

  var hints = '<div class="hintbox">' +
    '<button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
    '<span class="tip">подсказки не отнимают ничего — это разминка</span></div>' +
    '<div class="hintout" id="hintout"></div>';

  var pager = '<div class="pager"><button class="bigbtn ghost" data-go="back">' +
    (isDaily ? '← Назад на «Сегодня»' : '← Ко всем разминкам') + '</button><span class="sp"></span>' +
    (prev ? '<button class="bigbtn ghost" data-prev="' + prev.id + '">Назад</button>' : '') +
    (next ? '<button class="bigbtn ghost" data-next="' + next.id + '">Дальше →</button>' : '') + '</div>';

  A.app.innerHTML = head + '<div id="studio"></div>' + hints + pager;

  var studio = isBlocks
    ? makeBlocksStudio({ code: w.code, check: function(ed, showMsg){ runBlocksCheck(w, ed, showMsg); } })
    : isMemory
    ? makeMemoryStudio({ w: w, check: function(ed, showMsg){ runMemoryCheck(w, ed, showMsg); } })
    : A.makePredictStudio({ code: w.code, check: function(ed, showMsg){ runPredictCheck(w, ed, showMsg); } });
  document.getElementById("studio").appendChild(studio);
  session.studio = studio;

  A.wireHint(w.hints);
  A.app.querySelectorAll("[data-go]").forEach(function(b){
    b.onclick = function(){ backFn(); };
  });
  A.app.querySelectorAll("[data-next]").forEach(function(b){
    b.onclick = function(){ openWarmup(b.getAttribute("data-next")); };
  });
  A.app.querySelectorAll("[data-prev]").forEach(function(b){
    b.onclick = function(){ openWarmup(b.getAttribute("data-prev")); };
  });
  A.refreshTop();
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
  var rec = A.vizRecord(w.code);
  var hits = rec.frames.filter(function(f){ return f.line === w.stop; });
  return hits.length ? hits[0] : null;
}
function memAnswers(w){
  var f = memFrame(w), out = {};
  if (!f) return out;
  (w.ask || []).forEach(function(n){
    var v = f.vars.filter(function(x){ return x.name === n; })[0];
    out[n] = v ? A.vizShort(v.cell, f.objects) : null;
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
      '<code>' + (A.hl(t) || "&nbsp;") + '</code>' +
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
      return '<label class="memrow"><b>' + A.esc(n) + '</b><span class="veq">=</span>' +
        '<input type="text" class="memin" data-name="' + A.esc(n) + '" spellcheck="false" ' +
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
    box.innerHTML = A.vizMemoryHTML(f, null);
    A.vizDrawArrows(box);
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
  var session = A.session();
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
      : "Сошлось не всё: неверно у " + wrong.map(function(n){ return "<code>" + A.esc(n) + "</code>"; }).join(", ") + ".") +
    " Пройди программу строчка за строчкой сверху вниз и держи в голове, что меняется после каждой.");
}

function runPredictCheck(w, ed, showMsg){
  var session = A.session();
  session.attempts++;
  var eng = Runtime.get("mini");
  var res = eng.run(w.code, {});
  if (res.error){ showMsg("bad", A.errHTML(res.error)); return; }
  var want = res.output, got = ed.getCode();
  if (A.normPred(want) === A.normPred(got)){
    session.studio.reveal(res.output);
    winWarmup(w);
  } else {
    session.studio.reveal(res.output);
    showMsg("bad", "<b>Ещё не совпало</b>" + A.predictDiff(want, got) +
      "Смотри на настоящий вывод справа, найди, где разошлось, и попробуй снова.");
  }
}

function winWarmup(w){
  var session = A.session();
  var isDaily = session && session.daily;
  A.warmupMark(w.id, isDaily);
  A.markActiveToday();                 /* разминка держит дневной стрик живым */
  /* разминка могла быть шагом занятия — и разминкой в начале, и проверкой
     понимания в конце. Какой именно, знает план, а не это место. */
  A.zanNote("warm", w.id, { ok: session.attempts === 1 && !session.hints });
  A.save();
  var ws = A.warmupsList(), pos = ws.indexOf(w);
  var next = (!isDaily && pos >= 0 && pos < ws.length - 1) ? ws[pos+1] : null;
  var firstTry = session.attempts === 1 && session.hints === 0;
  var isBlocks = w.type === "blocks";
  var big = isDaily ? "🔥" : (firstTry ? "🎯" : (isBlocks ? "🧩" : "🔮"));
  var h2 = isDaily
    ? "Задача дня выполнена!"
    : (firstTry ? (isBlocks ? "Собрал с первой попытки!" : "Точно, с первой попытки!")
                : (isBlocks ? "Собрал!" : "Угадал!"));
  var savedNote = A.takeShieldNote();
  var body = isDaily
    ? '<p>' + A.esc(w.note || "Ты справился с сегодняшней задачей.") + '</p>' + savedNote +
      /* Здесь тоже нет числа серии: победа за задачу дня и так победа,
         а приписка «12 дней подряд» превращает её в долг перед счётчиком. */
      '<div class="streakline">🔥 Задача дня сделана — день засчитан</div>'
    : '<p>' + A.esc(w.note || (isBlocks ? "Ты собрал программу в правильном порядке." : "Ты правильно предсказал, что напечатает программа.")) + '</p>' + savedNote;
  var inZan = !!A.zanOpen();
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
  A.confetti(isDaily ? 3 : 2);
  var wn = document.getElementById("wnext");
  if (wn) wn.onclick = function(){ A.closeWin(); openWarmup(next.id); };
  var wl = document.getElementById("wlist");
  if (wl) wl.onclick = function(){ A.closeWin(); screenWarmups(); };
  var wt = document.getElementById("wtoday");
  if (wt) wt.onclick = function(){ A.closeWin(); A.screenToday(); };
  var wm = document.getElementById("wmore");
  if (wm) wm.onclick = function(){ A.closeWin(); screenWarmups(); };
  var wz2 = document.getElementById("wzan");
  if (wz2) wz2.onclick = function(){ A.closeWin(); A.screenZan(); };
  var wstay = document.getElementById("wstay");
  if (wstay) wstay.onclick = A.closeWin;
}

return { screenWarmups: screenWarmups, openWarmup: openWarmup,
         memFrame: memFrame, memAnswers: memAnswers, memNorm: memNorm };
};
