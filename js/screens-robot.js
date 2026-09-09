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

function taskById(id){
  var xs = window.ROBOT_TASKS || [];
  for (var i = 0; i < xs.length; i++) if (xs[i].id === id) return xs[i];
  return null;
}
function fields(t){ return [t.field].concat(t.more || []); }

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
    var got = R.run(text, R.parseField(all[i]));
    var want = R.run(t.solution, R.parseField(all[i]));
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
function openRobot(id){
  var t = taskById(id);
  if (!t) return screenRobot();
  if (!cur || cur.id !== id){ cur = t; code = t.starter; last = null; }
  A.enterScreen("train", "robot");

  var shown = last && last.shown ? window.ROBOT.fieldRows(last.shown) : t.field;
  var h = '<div class="lvlhead"><div><div class="idx">исполнитель «Робот» · формат ОГЭ</div>' +
    '<h1>' + t.emoji + ' ' + A.esc(t.title) + '</h1></div>' +
    (A.algoDone(t.id) ? '<div class="right"><span class="tag">решено ✓</span></div>' : '') + '</div>' +
    '<p class="lede">' + A.esc(t.intro) + '</p>' +
    '<div class="card"><h3>Что нужно сделать</h3><p>' + A.esc(t.goal) + '</p>' +
    '<ul class="trrules">' + t.list.map(function(s){ return '<li>' + A.esc(s) + '</li>'; }).join("") + '</ul></div>' +
    '<div class="rbwrap">' +
      '<div class="rbleft"><div class="rbhead">Поле</div>' + fieldHTML(shown) +
        '<p class="dim">Робот 🤖 · закрашенные клетки — цветные · тёмные — стены. ' +
        'Проверка гоняет программу ещё на <b>' + (fields(t).length - 1) + '</b> скрытых полях.</p></div>' +
      '<div class="rbright"><div class="rbhead">Программа</div>' +
        '<textarea id="rbcode" class="rbcode" spellcheck="false" rows="10">' + A.esc(code) + '</textarea>' +
        '<div class="admrow"><button class="rbtn check" id="rbrun">▶ Выполнить</button>' +
        '<button class="rbtn sec" id="rbreset">Сначала</button></div>' +
      '</div>' +
    '</div>' +
    '<div id="rbmsg">' + (last ? verdictHTML(t, last) : "") + '</div>' +
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
    (A.algoDone(t.id)
      ? '<div class="card"><h3>Разбор</h3><p>' + A.esc(t.note) + '</p></div>'
      : '<div class="card"><h3>Подсказки</h3><ol class="rbhints">' +
        t.hints.map(function(s){ return '<li>' + A.esc(s) + '</li>'; }).join("") + '</ol></div>') +
    '<div class="pager"><button class="bigbtn ghost" id="rbback">← Ко всем задачам</button></div>';

  A.app.innerHTML = h;
  var ta = document.getElementById("rbcode");
  ta.addEventListener("input", function(){ code = ta.value; });
  document.getElementById("rbrun").onclick = function(){
    code = ta.value;
    last = check(t, code);
    if (last.ok && !A.algoDone(t.id)) A.algoMark(t.id);
    openRobot(id);
  };
  document.getElementById("rbreset").onclick = function(){
    code = t.starter; last = null; openRobot(id);
  };
  document.getElementById("rbback").onclick = function(){ cur = null; last = null; screenRobot(); };
  A.refreshTop();
}

/* ---- список задач ---- */
function screenRobot(){
  A.enterScreen("train", "robot");
  var xs = window.ROBOT_TASKS || [];
  var done = xs.filter(function(x){ return A.algoDone(x.id); }).length;
  var h = '<div class="lvlhead"><div><div class="idx">информатика: исполнитель</div>' +
    '<h1>🤖 Робот</h1></div><div class="right"><span class="tag">' + done + ' из ' + xs.length + '</span></div></div>' +
    '<p class="lede">Исполнитель с пятью командами и своим языком — русскими словами. ' +
    'Это <b>задание 15.1 ОГЭ</b>: там, где в школе дают КуМир, и там, где Python не примут.</p>' +
    '<div class="card"><h3>⚖️ Честно про этот раздел</h3><ul class="trrules">' +
      '<li><b>Язык взят кумировский слово в слово.</b> Свой синтаксис было бы приятнее сочинять, ' +
      'но на экзамене принимают КуМир. Выучив «нц пока … кц» здесь, в КуМире пишешь то же самое.</li>' +
      '<li><b>Программа проверяется на нескольких полях сразу</b>, а не на нарисованном. ' +
      'На экзамене требуют ровно этого: решение обязано работать при любой длине стены.</li>' +
      '<li><b>Одно расхождение с КуМиром, и оно нарочное:</b> у нас стена — это клетка, а не ребро ' +
      'между клетками. Для программы разницы нет: «справа свободно» значит то же самое.</li>' +
      '<li><b>Робот не заменяет Python.</b> Он закрывает ту половину задания 15, где просят ' +
      'исполнителя; вторая половина, 15.2, — обычная программа, и она в разделе «Алгоритмы».</li>' +
    '</ul></div><div class="gamegrid">';
  xs.forEach(function(t){
    h += '<button class="gamecard" data-rb="' + A.esc(t.id) + '">' +
      '<span class="gemoji">' + t.emoji + '</span>' +
      '<b>' + A.esc(t.title) + (A.algoDone(t.id) ? ' <span class="edittag done">решено ✓</span>' : '') + '</b>' +
      '<span>' + A.esc(t.intro) + '</span>' +
      '<span class="wtag">' + A.esc(t.tag) + '</span></button>';
  });
  h += '</div><div class="pager"><button class="bigbtn ghost" id="rbtomap">← К тренировкам</button></div>';
  A.app.innerHTML = h;
  A.app.querySelectorAll("[data-rb]").forEach(function(b){
    b.onclick = function(){ openRobot(b.getAttribute("data-rb")); };
  });
  document.getElementById("rbtomap").onclick = A.screenTrain;
  A.refreshTop();
}

return { screenRobot: screenRobot, openRobot: openRobot };
};
