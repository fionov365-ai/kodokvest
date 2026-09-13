/* ============================================================
   Фионика — экраны исполнителя «Робот».

   Отрезано сразу в свой файл, а не дописано в app.js: договор описан в шапке
   js/screens-showcase.js, и новый экран — первая возможность не увеличивать
   долг, а не увеличивать его потом. Язык и поле — js/robot.js, задачи —
   js/robot-tasks.js, оформление — .rbf* в css/style.css.

   ⚠️ ПРО ХРАНЕНИЕ ПРОГРЕССА. Решённые задачи Робота лежат в том же S.algo, что
   и задачи раздела «Алгоритмы». Это не лень: идентификаторы у Робота свои
   («rb-…»), пересечься не могут, а заводить второе поле в сохранении значит
   трогать форму данных, её миграцию и три теста ради словаря из четырёх
   ключей. Если задач Робота станет много и понадобится своя статистика —
   тогда и разводить.

   ⚠️ ПРОВЕРКА ИДЁТ НА ВСЕХ ПОЛЯХ СРАЗУ, а не только на том, что нарисовано.
   Это главное правило раздела и оно прямо с экзамена: программа обязана
   работать при любой длине стены и любом расположении проходов. Проверка на
   одной картинке засчитала бы «вправо, закрасить, вправо, закрасить» —
   программу, которая на экзамене не стоит ничего. Поэтому в разборе честно
   написано, на каком именно поле решение сломалось.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.robot = function(A){

var cur = null;                 /* открытая задача */
var code = "";                  /* что набрано в поле ввода */
var last = null;                /* результат последнего запуска */
/* Откуда пришли. null — из раздела «Робот». Пробный вариант (js/variant.js)
   передаёт то же, что задаче «Алгоритмов»: crumb, backLabel, winLabel, go,
   exam, clock, onSend, onWin. ⚠️ Режим экзамена приходит отсюда, а не из
   задачи: задача одна, экзаменационной её делает вариант. */
var ctx = null;
var sentNote = false;           /* на экзамене: ответ только что записан */

/* Сообщение о сданном ответе ОДНО при верном и неверном — иначе вердикт
   читается по сообщению, и режим экзамена ничего не стоит. */
var EXAM_SENT = '<div class="msg show info"><b>Ответ записан</b>Верно или нет — скажет итог ' +
  'варианта, когда выйдет время или ты нажмёшь «Завершить». Запускать программу можно сколько ' +
  'угодно — на поле из условия видно, что закрасил Робот, как в КуМире. Сдать заново тоже можно: ' +
  'считается последний ответ.</div>';

function taskById(id){
  var xs = window.ROBOT_TASKS || [];
  for (var i = 0; i < xs.length; i++) if (xs[i].id === id) return xs[i];
  return null;
}
function fields(t){ return [t.field].concat(t.more || []); }
/* ⚠️ Поле задачи формата ОГЭ разбирается «бесконечным» (t.inf): за
   нарисованным запасом пусто. Забудь передать признак — и край поля снова
   станет стеной, а решение «до края» получит зачёт, за который эксперт ставит 0. */
function pole(t, rows){ return window.ROBOT.parseField(rows, t.inf); }

/* ---- рисование поля ----
   Таблица клеток, а не картинка: так поле читается программой чтения с экрана
   и не мылится на телефоне. */
function fieldHTML(rows, cls){
  var h = '<div class="rbf ' + (cls || "") + '" style="--rbw:' + rows[0].length + '">';
  rows.forEach(function(row){
    Array.from(row).forEach(function(z){
      var k = z === "#" ? "wall" : (z === "*" ? "paint" : (z === "@" ? "bot" : (z === "+" ? "paint bot" : "")));
      h += '<i class="rbc ' + k + '">' + (k.indexOf("bot") >= 0 ? "🤖" : "") + '</i>';
    });
  });
  return h + "</div>";
}

/* ---- запуск на всех полях ---- */
function check(t, text){
  var R = window.ROBOT, out = { ok:true, shown:null, error:null, badField:-1 };
  var all = fields(t);
  for (var i = 0; i < all.length; i++){
    var got = R.run(text, pole(t, all[i]));
    var want = R.run(t.solution, pole(t, all[i]));
    if (i === 0) out.shown = got.field;
    if (got.error){ out.ok = false; out.error = got.error; out.badField = i; break; }
    if (!R.samePainted(got.field, want.field)){
      out.ok = false; out.badField = i;
      out.want = want.field; out.got = got.field;
      break;
    }
  }
  return out;
}

function verdictHTML(t, res){
  var fg = res.fg ? window.FIPI15.verdictHTML(res.fg) : "";
  return baseVerdictHTML(t, res).replace(/<\/div>$/, fg + "</div>");
}
function baseVerdictHTML(t, res){
  if (res.ok)
    return '<div class="msg show ok"><b>Решено ✓</b>Программа сработала на всех ' +
      fields(t).length + ' полях, а не только на нарисованном.</div>';
  if (res.error)
    return '<div class="msg show bad"><b>' + (res.badField ? "Сломалось на скрытом поле №" + res.badField : "Ошибка") +
      '</b>Строка ' + res.error.line + ': ' + A.esc(res.error.msg) + '</div>';
  if (res.badField > 0)
    return '<div class="msg show bad"><b>На картинке сошлось, а на другом поле — нет</b>' +
      'Скрытое поле №' + res.badField + ': закрашено не то. На экзамене программа обязана ' +
      'работать при любой длине стены — посмотрите, что в ней жёстко зашито.' +
      '<div class="rbpair"><div><span class="dim">вышло</span>' + fieldHTML(window.ROBOT.fieldRows(res.got)) +
      '</div><div><span class="dim">нужно</span>' + fieldHTML(window.ROBOT.fieldRows(res.want)) + '</div></div></div>';
  return '<div class="msg show bad"><b>Закрашено не то</b>Сравните, что вышло и что нужно.' +
    '<div class="rbpair"><div><span class="dim">вышло</span>' + fieldHTML(window.ROBOT.fieldRows(res.got)) +
    '</div><div><span class="dim">нужно</span>' + fieldHTML(window.ROBOT.fieldRows(res.want)) + '</div></div></div>';
}

/* ---- экран задачи ---- */
function openRobot(id, from){
  var t = taskById(id);
  if (!t) return screenRobot();
  /* Второй довод есть только у входа снаружи; внутренние перерисовки
     (после «Выполнить») зовут openRobot(id) и контекст не теряют. */
  if (arguments.length > 1){ ctx = from || null; sentNote = false; }
  if (!cur || cur.id !== id){ cur = t; code = t.starter; last = null; sentNote = false; }
  A.enterScreen("train", "robot");
  var exam = !!(ctx && ctx.exam);

  var shown = last && last.shown ? window.ROBOT.fieldRows(last.shown) : t.field;
  var h = (ctx ? '<div class="crumbs"><span id="rbcrumb">' + A.esc(ctx.crumb) + '</span> › ' +
           t.emoji + ' ' + A.esc(t.title) + '</div>' : '') +
    '<div class="lvlhead"><div><div class="idx">исполнитель «Робот» · ' +
    (t.fipi ? 'формат ОГЭ' : 'приём для задания 15 ОГЭ') + '</div>' +
    '<h1>' + t.emoji + ' ' + A.esc(t.title) + '</h1></div>' +
    (exam ? '<div class="right"><span class="examclock" id="rbclock">⏱</span></div>'
          : (A.algoDone(t.id) && !ctx ? '<div class="right"><span class="tag">решено ✓</span></div>' : '')) + '</div>' +
    '<p class="lede">' + A.esc(t.intro) + '</p>' +
    '<div class="card"><h3>Что нужно сделать</h3><p>' + A.esc(t.goal) + '</p>' +
    '<ul class="trrules">' + t.list.map(function(s){ return '<li>' + A.esc(s) + '</li>'; }).join("") + '</ul></div>' +
    '<div class="rbwrap">' +
      '<div class="rbleft"><div class="rbhead">Поле</div>' + fieldHTML(shown) +
        '<p class="dim">Робот 🤖 · закрашенные клетки — цветные · тёмные — стены. ' +
        'Проверка гоняет программу ещё на <b>' + (fields(t).length - 1) + '</b> скрытых полях.' +
        (t.inf ? ' Поле бесконечное: за нарисованным краем пусто, держаться за край нельзя.' : '') +
        (t.fipi ? ' На ОГЭ такой алгоритм оценивает эксперт — 2, 1 или 0 баллов; ' +
          (exam ? 'сколько вышло бы, скажет итог варианта.' : 'после проверки здесь будет написано, сколько было бы.') : '') +
        '</p></div>' +
      '<div class="rbright"><div class="rbhead">Программа</div>' +
        '<textarea id="rbcode" class="rbcode" spellcheck="false" rows="10">' + A.esc(code) + '</textarea>' +
        '<div class="admrow"><button class="rbtn check" id="rbrun">▶ Выполнить</button>' +
        (exam ? '<button class="rbtn check" id="rbsend">✎ Сдать ответ</button>' : '') +
        '<button class="rbtn sec" id="rbreset">Сначала</button></div>' +
      '</div>' +
    '</div>' +
    '<div id="rbmsg">' + (exam ? examMsgHTML() : (last ? verdictHTML(t, last) : "")) + '</div>' +
    '<div class="card"><h3>Язык Робота</h3>' +
      '<p class="dim">Тот же, что в КуМире на экзамене, — слово в слово.</p>' +
      '<div class="rbref">' +
        '<div><b>Команды</b><code>вверх вниз влево вправо закрасить</code></div>' +
        '<div><b>Условия</b><code>сверху|снизу|слева|справа свободно</code>' +
          '<code>сверху|снизу|слева|справа стена</code>' +
          '<code>клетка закрашена · клетка чистая</code></div>' +
        '<div><b>Связки</b><code>не · и · или · ( )</code></div>' +
        '<div><b>Цикл</b><code>нц пока &lt;условие&gt;<br>  …<br>кц</code><code>нц 5 раз<br>  …<br>кц</code></div>' +
        '<div><b>Ветвление</b><code>если &lt;условие&gt; то<br>  …<br>иначе<br>  …<br>все</code></div>' +
        '<div><b>Комментарий</b><code>| после палочки</code></div>' +
      '</div></div>' +
    /* ⚠️ На экзамене нет ни подсказок, ни разбора — не спрятаны, а не существуют. */
    (exam
      ? '<div class="hintbox"><span class="tip">режим экзамена: подсказок нет, а верно ли решено — ' +
        'скажет итог варианта, а не эта страница</span></div>'
      : (A.algoDone(t.id) && !ctx) || (last && last.ok)
        ? '<div class="card"><h3>Разбор</h3><p>' + A.esc(t.note) + '</p></div>'
        : '<div class="card"><h3>Подсказки</h3><ol class="rbhints">' +
          t.hints.map(function(s){ return '<li>' + A.esc(s) + '</li>'; }).join("") + '</ol></div>') +
    '<div class="pager"><button class="bigbtn ghost" id="rbback">← ' +
      A.esc(ctx ? (last && last.ok && !exam ? ctx.winLabel.replace(/^←\s*/, "") : ctx.backLabel) : "Ко всем задачам") +
    '</button></div>';

  A.app.innerHTML = h;
  var ta = document.getElementById("rbcode");
  ta.addEventListener("input", function(){ code = ta.value; });
  document.getElementById("rbrun").onclick = function(){
    code = ta.value;
    if (exam){
      /* Экзамен: запуск только на поле из условия и без сравнения с нужным —
         ровно то, что показывает КуМир. Скрытые поля молчат до итога. */
      var R = window.ROBOT, r = R.run(code, pole(t, t.field));
      last = { ok: false, shown: r.field, run: r.error };
      sentNote = false;
      return openRobot(id);
    }
    last = check(t, code);
    if (t.fipi && window.FIPI15) last.fg = window.FIPI15.grade(window.ROBOT, code, t);
    if (last.ok){
      /* сюда экзамен не доходит: у него своя ветка выше, и отметку в общем
         списке он ставит разом при закрытии (js/variant.js, closeExam) */
      if (!A.algoDone(t.id)) A.algoMark(t.id);
      if (ctx && ctx.onWin) ctx.onWin(t);
    }
    openRobot(id);
  };
  var send = document.getElementById("rbsend");
  if (send) send.onclick = function(){
    code = ta.value;
    var res = check(t, code);
    var fg = (t.fipi && window.FIPI15) ? window.FIPI15.grade(window.ROBOT, code, t) : null;
    if (ctx && ctx.onSend) ctx.onSend(!!res.ok, fg);
    sentNote = true;
    openRobot(id);
  };
  document.getElementById("rbreset").onclick = function(){
    code = t.starter; last = null; sentNote = false; openRobot(id);
  };
  var goBack = function(){
    var back = ctx; cur = null; last = null; ctx = null; sentNote = false;
    return back ? back.go() : screenRobot();
  };
  document.getElementById("rbback").onclick = goBack;
  var crumb = document.getElementById("rbcrumb");
  if (crumb) crumb.onclick = goBack;

  /* Часы экзамена — тот же самоубирающийся таймер, что у задачи «Алгоритмов»:
     гаснет, когда его элемента нет на странице; дойдя до нуля, уводит в итог. */
  var clk = document.getElementById("rbclock");
  if (clk && ctx && ctx.clock){
    var tick = function(){
      if (!document.body.contains(clk) || !ctx || !ctx.clock) return clearInterval(cid);
      var c = ctx.clock();
      clk.textContent = "⏱ " + c.text;
      clk.classList.toggle("soon", !!c.soon);
      if (c.over){ clearInterval(cid); goBack(); }
    };
    var cid = setInterval(tick, 1000);
    tick();
  }
  A.refreshTop();
}

/* На экзамене под программой — только то, что человек и так видит: ошибка
   запуска на поле из условия (КуМир её тоже показывает) и «ответ записан». */
function examMsgHTML(){
  var h = "";
  if (last && last.run)
    h += '<div class="msg show bad"><b>Ошибка при запуске</b>Строка ' + last.run.line + ': ' +
      A.esc(last.run.msg) + '</div>';
  if (sentNote) h += EXAM_SENT;
  return h;
}

/* ---- список задач ---- */
function screenRobot(){
  A.enterScreen("train", "robot");
  ctx = null;
  var xs = window.ROBOT_TASKS || [];
  var done = xs.filter(function(x){ return A.algoDone(x.id); }).length;
  var h = '<div class="lvlhead"><div><div class="idx">информатика: исполнитель</div>' +
    '<h1>🤖 Робот</h1></div><div class="right"><span class="tag">' + done + ' из ' + xs.length + '</span></div></div>' +
    '<p class="lede">Исполнитель с пятью командами и своим языком — русскими словами. ' +
    'Это <b>задание 15 ОГЭ</b>: там, где в школе дают КуМир, и там, где Python не примут.</p>' +
    '<div class="card"><h3>⚖️ Честно про этот раздел</h3><ul class="trrules">' +
      '<li><b>Язык взят кумировский слово в слово.</b> Свой синтаксис было бы приятнее сочинять, ' +
      'но на экзамене принимают КуМир. Выучив «нц пока … кц» здесь, в КуМире пишешь то же самое.</li>' +
      '<li><b>Программа проверяется на нескольких полях сразу</b>, а не на нарисованном. ' +
      'На экзамене требуют ровно этого: решение обязано работать при любой длине стены.</li>' +
      '<li><b>Одно расхождение с КуМиром, и оно нарочное:</b> у нас стена — это клетка, а не ребро ' +
      'между клетками. Для программы разницы нет: «справа свободно» значит то же самое.</li>' +
      '<li><b>Задачи «формат ОГЭ» устроены как на экзамене:</b> две стены с проходами на ' +
      'бесконечном поле, и балл за них считается по правилам эксперта ФИПИ — 2, 1 или 0. ' +
      'Остальные задачи учат приёмы по одному и держатся за край поля; баллов за них нет.</li>' +
      '<li><b>Робот не заменяет Python.</b> Он закрывает задание 15, где просят исполнителя; ' +
      'задание 16 — обычная программа, и она в разделе «Алгоритмы». На экзамене нужны оба.</li>' +
    '</ul></div>';
  /* Формат ОГЭ — первым: ради него раздел и открывают перед экзаменом. */
  var groups = [["📄 Формат ОГЭ", xs.filter(function(t){ return t.fipi; })],
                ["🧩 Приёмы по одному", xs.filter(function(t){ return !t.fipi; })]];
  groups.forEach(function(gr){
    if (!gr[1].length) return;
    h += '<div class="sect"><h2>' + gr[0] + '</h2><div class="line"></div><span class="cnt">' +
      gr[1].filter(function(x){ return A.algoDone(x.id); }).length + ' из ' + gr[1].length + '</span></div>' +
      '<div class="gamegrid">';
    gr[1].forEach(function(t){
    h += '<button class="gamecard" data-rb="' + A.esc(t.id) + '">' +
      '<span class="gemoji">' + t.emoji + '</span>' +
      '<b>' + A.esc(t.title) + (A.algoDone(t.id) ? ' <span class="edittag done">решено ✓</span>' : '') + '</b>' +
      '<span>' + A.esc(t.intro) + '</span>' +
      '<span class="wtag">' + A.esc(t.tag) + '</span></button>';
    });
    h += '</div>';
  });
  h += '<div class="pager"><button class="bigbtn ghost" id="rbtomap">← К тренировкам</button></div>';
  A.app.innerHTML = h;
  A.app.querySelectorAll("[data-rb]").forEach(function(b){
    b.onclick = function(){ openRobot(b.getAttribute("data-rb"), null); };
  });
  document.getElementById("rbtomap").onclick = A.screenTrain;
  A.refreshTop();
}

return { screenRobot: screenRobot, openRobot: openRobot, robotById: taskById };
};
