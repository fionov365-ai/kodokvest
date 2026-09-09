/* ============================================================
   Фионика — рабочая станция: то, что окружает редактор на экране урока.
   Кнопки запуска и проверки, вывод программы, холст черепашки, панель
   ответов для input(), разбор ошибки и ревью кода.

   ⚠️ ЧЕТВЁРТОЕ ОТРЕЗАНИЕ ПО ДОГОВОРУ из js/screens-showcase.js. Наружу
   торчит ровно ОДНО имя — makeStudio; внутрь нужны пятнадцать. Такое
   соотношение стоит объяснить, потому что оно противоположно предыдущим
   разрезам: станция ничего не сообщает остальному продукту, но сама
   опирается почти на всё — движок, ошибки, звук, черепашку, разбор кода.
   Это не признак плохого разреза. Наоборот: длина списка ВОЗВРАЩАЕМОГО и
   есть мера удачности, а список A — просто честный счёт того, чем экран
   урока пользуется. Спрятать его в общий контейнер значило бы сделать вид,
   что связей меньше, чем на самом деле.

   ⚠️ session приходит ФУНКЦИЕЙ, а не значением, и это не стиль. Это чужая
   ИЗМЕНЯЕМАЯ переменная app.js: её пересоздают при каждом заходе в урок.
   Скопировав её один раз при сборке модуля, станция навсегда запомнила бы
   первую сессию и перестала бы понимать, показывали ребёнку решение или
   нет. Любое чужое изменяемое состояние в этих файлах читается вызовом.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.studio = function(A){

/* ================= рабочая станция ================= */
function makeStudio(cfg){
  cfg = cfg || {};
  var eng = Runtime.get(cfg.engine || "mini");
  var wrap = document.createElement("div");
  wrap.className = "studio" + (cfg.draw ? " split" : "");

  var ed = A.makeEditor(cfg.code || "", cfg.label, cfg.files);
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
      files = A.dataFiles(cfg.data);
    }
    diskPane.style.display = "";
    var names = Object.keys(files).sort();
    diskPane.querySelector(".disklist").innerHTML = names.map(function(n){
      var text = files[n];
      var short = text.length > 400 ? text.slice(0, 400) + "\n…" : text;
      return '<div class="diskfile"><b>' + A.esc(n) + '</b><span>' +
             (text.length ? text.split("\n").length + " строк, " + text.length + " знаков" : "пусто") +
             '</span><pre>' + A.esc(short) + '</pre></div>';
    }).join("");
  }
  function showMsg(cls, html){ msg.className = "msg show " + cls; msg.innerHTML = html; }
  function hideMsg(){ msg.className = "msg"; }
  function setConsole(text){
    con.innerHTML = text ? A.esc(text) : '<span class="empty">программа ничего не вывела</span>';
  }

  function doRun(){
    hideMsg(); ed.setError(0); ed.setWatch(null); stepper = null; varsPane.style.display = "none";
    var t = eng.newTurtle ? eng.newTurtle() : null;
    var res = eng.run(ed.getCode(), { turtle: t, sources: ed.getSources(), files: A.dataFiles(cfg.data), stdin: wrap.getStdin() });
    setConsole(res.output);
    if (res.files) showDisk(res.files);
    if (canvas) A.animateTurtle(canvas, res.turtle || t);
    if (res.error){
      ed.setError(res.error.line);
      showMsg("bad", A.errHTML(res.error));
      A.sfx("bad");
      /* Объяснение ошибки — ровно тот текст, ради которого включают голос:
         кому тяжело читать с экрана, тот застревает именно здесь.
         Собираем фразу заново, а не читаем errHTML: там заголовок и текст
         стоят встык (<b>…</b>текст), и вслух выходило «строка 1Имя». */
      A.speakAuto((A.KIND_RU[res.error.kind] || res.error.kind) +
                (res.error.line ? ", строка " + res.error.line : "") + ". " + res.error.msg);
      wrap._hadError = true;
      /* бестиарий: зверь встретился. Помним ЕГО тип — победа достанется
         именно ему, а не тому, что упало три запуска назад. */
      wrap._lastErr = res.error.kind;
      A.errSeen(res.error.kind);
    } else if (wrap._hadError){
      A.award("fixer"); wrap._hadError = false;
      /* Победа только если чинил сам: после «показать решение» в редакторе
         код автора, и хвастаться нечем. */
      if (!(A.session() && A.session().shown)) A.errBeaten(wrap._lastErr);
      wrap._lastErr = null;
    }
    A.award("first");
    /* Приписки значений считаются ТОЛЬКО у одного файла: номера строк
       относятся к главному, а в редакторе может быть открыт другой. */
    if (ed.fileCount === 1)
      ed.setWatch(A.watchCompute(eng, ed.getCode(),
        { sources: ed.getSources(), files: A.dataFiles(cfg.data), stdin: wrap.getStdin() },
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
        stepper = { s: eng.stepper(ed.getCode(), { turtle: t, sources: ed.getSources(), files: A.dataFiles(cfg.data), stdin: wrap.getStdin() }), t: t };
      } catch(e){
        if (!e.pyKind) throw e;
        ed.setError(e.pyLine);
        showMsg("bad", A.errHTML({ kind:e.pyKind, msg:e.pyMsg, line:e.pyLine }));
        wrap._hadError = true; wrap._lastErr = e.pyKind; A.errSeen(e.pyKind);
        stepper = null; return;
      }
      varsPane.style.display = "";
    }
    var st = stepper.s.next();
    setConsole(st.output);
    if (canvas) A.drawTurtle(canvas, stepper.t);
    if (st.error){
      ed.setError(st.error.line); showMsg("bad", A.errHTML(st.error));
      wrap._hadError = true; wrap._lastErr = st.error.kind; A.errSeen(st.error.kind);
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
      ? vars.map(function(v){ return '<div class="varrow"><b>' + A.esc(v.name) + '</b><span>' + A.esc(v.value) + '</span><em>' + v.type + '</em></div>'; }).join("")
      : '<span class="empty">переменных пока нет</span>';
  }

  function doReset(){
    stepper = null; ed.setLine(0); ed.setWatch(null); hideMsg();
    varsPane.style.display = "none";
    if (playPane) playPane.style.display = "none";
    con.innerHTML = '<span class="empty">пока пусто — нажми «Запустить»</span>';
    if (canvas && eng.newTurtle) A.drawTurtle(canvas, eng.newTurtle());
  }

  /* ===== игровой режим: партия через перезапуск с накопленными ходами ===== */
  var playAnswers = [], playSeed = 0;

  function playRender(){
    hideMsg(); ed.setError(0);
    var t = eng.newTurtle ? eng.newTurtle() : null;
    var res = eng.run(ed.getCode(), { turtle: t, sources: ed.getSources(),
      files: A.dataFiles(cfg.data), stdin: playAnswers, interactive: true, seed: playSeed });
    setConsole(res.output);
    if (res.files) showDisk(res.files);
    if (canvas) A.animateTurtle(canvas, res.turtle || t);
    A.award("first");
    if (res.error){
      ed.setError(res.error.line);
      showMsg("bad", A.errHTML(res.error));
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
      env: { sources: ed.getSources(), files: A.dataFiles(cfg.data), stdin: wrap.getStdin() }
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
    var found = A.lintCode(ed.getCode(), { needCode: cfg.needCode });
    showMsg(found && found.length ? "warn" : (found === null ? "bad" : "ok"), A.lintHTML(found));
    return found;
  };
  wrap.lintFind = function(){ return A.lintCode(ed.getCode(), { needCode: cfg.needCode }); };

  if (hasData) showDisk(null);
  wrap.editor = ed; wrap.showMsg = showMsg; wrap.canvas = canvas; wrap.engine = eng;
  if (canvas && eng.newTurtle) setTimeout(function(){ A.drawTurtle(canvas, eng.newTurtle()); }, 30);
  return wrap;
}

return { makeStudio: makeStudio };
};
