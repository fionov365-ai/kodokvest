/* ============================================================
   Фионика — экран «Визуализатор» (машина времени).

   Отрезан из app.js 15.09.2026 (архитектурный долг, § 2.5 RAZVITIE) по
   договору из шапки js/screens-showcase.js: всё чужое приходит объектом A,
   общее состояние не пишется вовсе — визуализатор прогресс не хранит.

   ЗАМЕР ПЕРЕД РАЗРЕЗОМ (правило § 4.2): участок 514 строк, объявлено 23
   имени. Внутрь приходит 10: app, esc, enterScreen, refreshTop, goHome,
   makeEditor, hl, KIND_RU, storyHTML и сессия (A.session / A.newSession —
   чужое изменяемое состояние, § 4.5). Наружу уходит 9: screenViz (карточка
   «Тренировок», адрес #viz, кнопка «разобрать» у урока, домашки и
   мастерской), vizStopPlay (уход с экрана обязан глушить тик «Играть» —
   пять мест), vizPlaying, и мини-набор для задачи дня «предскажи память»
   в «Сегодня»: vizRecord, vizShort, vizMemoryHTML, vizDrawArrows; vizDiff и
   VIZ_EXAMPLES зовёт напрямую тест. MiniPy берётся глобалом, как HW у
   проверки: движок — не состояние app.js.

   ЧТО ЭТО. Прогоняем программу по шагам, на каждом шаге снимаем неизменяемый
   снимок памяти (heapSnapshot в engine-mini): переменные + списки/словари/
   кортежи/множества с идентичностью объектов. Потом отлистываем историю
   вперёд и назад ползунком. Списки и словари рисуются коробками, а b = a —
   двумя стрелками к одной коробке (алиасинг видно глазами).
   Отдельный раздел, вне сотни уроков. Прогресс не хранит.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.viz = function(A){

var VIZ_EXAMPLES = [
  { title: "Список растёт",
    code: 'nums = []\nfor i in range(1, 5):\n    nums.append(i * i)\n\nprint(nums)\n' },
  { title: "Два имени — один список",
    code: 'a = [1, 2, 3]\nb = a\nb.append(4)\n\nprint(a)\nprint(b)\n' },
  { title: "Словарь-счётчик",
    code: 'counts = {}\nfor c in "миссисипи":\n    counts[c] = counts.get(c, 0) + 1\n\nprint(counts)\n' },
  { title: "Обмен значений",
    code: 'x = 5\ny = 9\n\nx, y = y, x\n\nprint(x, y)\n' },
  { title: "Список списков",
    code: 'matrix = [[1, 2], [3, 4]]\nrow = matrix[0]\nrow.append(99)\n\nprint(matrix)\n' },
  /* Два примера с функциями. Раньше их тут не было вообще, и стек вызовов
     показать было не на чем. Первый — про то, что «ш» в программе и «ш»
     в функции это РАЗНЫЕ переменные с одним именем: плоский список их сливал,
     а кадры показывают обе. Второй — рекурсия: коробок становится столько,
     сколько вызовов, и видно, что ни один не закончился, пока не дошли до дна. */
  { title: "Функция: свои переменные",
    code: 'def площадь(ш, в):\n    итог = ш * в\n    return итог\n\n\nвсего = 0\nfor ш, в in [(3, 4), (5, 2)]:\n    всего = всего + площадь(ш, в)\n\nprint(всего)\n' },
  { title: "Рекурсия: стек вызовов",
    code: 'def факториал(n):\n    if n <= 1:\n        return 1\n    return n * факториал(n - 1)\n\n\nprint(факториал(4))\n' }
];
var VIZ_COLORS = ["#7c5cff","#00e0b8","#ffc53d","#ff6b6b","#3ddc84","#4aa3ff","#e06bff","#ff9f45"];
var VIZ_MAX_FRAMES = 800;

/* Тик кнопки «Играть» — один на всю страницу, с ручкой остановки. Держим его
   снаружи vizPlayer, потому что уход с экрана обязан его выключить: плеер
   при переходе просто выбрасывается из документа, а интервал сам не умирает
   и продолжает перерисовывать невидимую разметку. */
var vizPlay = null;
function vizStopPlay(){
  if (!vizPlay) return;
  var p = vizPlay; vizPlay = null;
  clearInterval(p.id);
  if (p.onStop) try { p.onStop(); } catch(e){}
}
function vizPlaying(){ return !!vizPlay; }

function vizColorIdx(id){ var n = parseInt(String(id).replace(/\D/g, ""), 10) || 0; return n % VIZ_COLORS.length; }
function vizColor(id){ return VIZ_COLORS[vizColorIdx(id)]; }
function vizKind(k){ return k === "list" ? "список" : k === "tuple" ? "кортеж" : k === "set" ? "множество" : k === "dict" ? "словарь" : k; }

/* Прогон программы с записью всех кадров. Каждый кадр:
   { line, output, vars, objects, error?, done? }. line — строка, которая
   вот-вот выполнится (её и подсвечиваем), состояние — ПЕРЕД ней. Последний
   кадр (done) — итоговое состояние после конца программы.

   opts — то же окружение, что у обычного прогона: ответы для input(), файлы
   на диске, подключённые модули. Раньше его тут не было вообще (стоял пустой
   объект), потому что разбирали только свои примеры. Теперь на разбор уезжает
   код С УРОКА, а урок может спрашивать input() — без ответов такая программа
   падала бы на первой же строке, и виноват был бы визуализатор. */
function vizRecord(code, opts){
  var MP = window.MiniPy, st;
  try { st = MP.stepper(code, opts || {}); }
  catch(e){
    if (!e.pyKind) throw e;
    return { frames: [], error: { kind: e.pyKind, msg: e.pyMsg, line: e.pyLine || 0 } };
  }
  var idMap = new Map();
  var skip = st.interp && st.interp.builtinNames;
  var frames = [], truncated = false, error = null, guard = 0;
  while (true){
    var s = st.next();
    if (s.error){
      var last = frames.length ? frames[frames.length - 1] : { vars: [], scopes: [], objects: {} };
      frames.push({ line: s.error.line, output: s.output, vars: last.vars,
                    scopes: last.scopes, objects: last.objects, error: s.error });
      error = s.error; break;
    }
    if (s.done){
      var h = MP.heapSnapshot(st.interp.global, idMap, skip, []);
      frames.push({ line: 0, output: s.output, vars: h.vars, scopes: h.scopes, objects: h.objects, done: true });
      break;
    }
    var hs = MP.heapSnapshot(s.env, idMap, skip, s.stack || []);
    frames.push({ line: s.line, output: s.output, vars: hs.vars, scopes: hs.scopes, objects: hs.objects });
    if (++guard >= VIZ_MAX_FRAMES){ truncated = true; break; }
  }
  return { frames: frames, error: error, truncated: truncated };
}

/* ===== что изменилось на этом шаге =====
   Ползунок показывал состояние, но не изменение: ребёнок листал кадры и сам
   искал глазами, что стало другим. На словаре из восьми ключей это работа
   поиска отличий, а не понимания. Поэтому сравниваем предыдущий кадр с
   текущим и делаем две вещи: подсвечиваем изменённое в разметке и говорим
   фразой, что произошло.

   Возвращаем { text, vars, cells, objs, scopes }:
     text   — фраза для полоски над памятью (или пустая строка);
     vars   — { "кадр:имя": "new"|"chg" };
     cells  — { "идОбъекта:номерИлиКлюч": "new"|"chg" };
     objs   — { "идОбъекта": "new" };
     scopes — { номерКадра: "new" } — кадр вызова, появившийся на этом шаге.
   Ключи строковые, потому что и номера, и ключи словаря приходят как текст. */
function vizSame(a, b){ return JSON.stringify(a) === JSON.stringify(b); }

function vizVarMap(scope){
  var m = {};
  (scope && scope.vars || []).forEach(function(v){ m[v.name] = v.cell; });
  return m;
}

/* Короткая запись значения для фразы: ссылку на список показываем словом,
   а не «→o3» — ребёнку нужен смысл, а не наш внутренний номер. */
function vizShort(cell, objects){
  if (!cell) return "";
  if (cell.t !== "ref") return cell.text;
  var o = objects && objects[cell.id];
  if (!o) return "объект";
  if (o.kind === "dict")
    return "{" + o.pairs.map(function(p){ return p.key + ": " + vizShort(p.val, objects); }).join(", ") + "}";
  var inner = (o.items || []).map(function(x){ return vizShort(x, objects); }).join(", ");
  return o.kind === "list" ? "[" + inner + "]" : o.kind === "tuple" ? "(" + inner + ")" : "{" + inner + "}";
}

function vizDiff(prev, cur){
  var out = { text: "", vars: {}, cells: {}, objs: {}, scopes: {} };
  if (!prev || !cur) return out;
  var say = [];

  var ps = prev.scopes || [], cs = cur.scopes || [];

  /* вошли в функцию или вышли из неё — это самое крупное событие шага.
     Про вход говорим сразу С АРГУМЕНТАМИ: «вызвана факториал(n = 3)». Без них
     на рекурсии все шаги выглядят одинаково, а вся суть как раз в том, с каким
     числом позвали на этот раз. */
  if (cs.length > ps.length){
    for (var k = ps.length; k < cs.length; k++) out.scopes[k] = "new";
    var entered = cs[cs.length - 1];
    var args = (entered.vars || []).map(function(v){
      return A.esc(v.name) + " = " + A.esc(vizShort(v.cell, cur.objects));
    }).join(", ");
    say.push("вызвана функция <b>" + A.esc(entered.name || "?") + "(" + args + ")</b>");
  } else if (cs.length < ps.length){
    /* Обратный путь рекурсии наш шагомер не показывает по одному: он выдаёт
       шаг на КАЖДУЮ СТРОКУ, а возвраты из вложенных вызовов случаются внутри
       одного выражения n * факториал(n - 1). Поэтому стек сворачивается сразу
       на несколько кадров — и честнее сказать сколько, чем назвать один. */
    var popped = ps.slice(cs.length).map(function(f){ return f.name || "?"; });
    say.push(popped.length === 1
      ? "функция <b>" + A.esc(popped[0]) + "</b> закончила работу"
      : "закончились сразу " + popped.length + " вызова <b>" + A.esc(popped[popped.length - 1]) + "</b> — " +
        "обратный путь рекурсии проходит внутри одного выражения, отдельного шага на него нет");
  }

  /* переменные: по кадрам, а не в одну свалку — иначе местная переменная
     функции и внешняя с тем же именем сливаются в одно «изменение».
     Кадры, появившиеся на этом шаге, целиком новые — их переменные помечаем,
     но словами не перечисляем: про них уже сказано в строке вызова. */
  for (var si = 0; si < cs.length; si++){
    var fresh = si >= ps.length;
    var before = fresh ? {} : vizVarMap(ps[si]);
    var after = vizVarMap(cs[si]);
    Object.keys(after).forEach(function(name){
      var key = si + ":" + name;
      if (before[name] === undefined){
        out.vars[key] = "new";
        if (!fresh && say.length < 3) say.push("появилась переменная <b>" + A.esc(name) + "</b> = " +
          A.esc(vizShort(after[name], cur.objects)));
      } else if (!vizSame(before[name], after[name])){
        out.vars[key] = "chg";
        if (say.length < 3) say.push("<b>" + A.esc(name) + "</b>: " +
          A.esc(vizShort(before[name], prev.objects)) + " → " + A.esc(vizShort(after[name], cur.objects)));
      }
    });
  }

  /* куча: новые коробки и изменившиеся ячейки внутри старых */
  Object.keys(cur.objects).forEach(function(id){
    var a = prev.objects[id], b = cur.objects[id];
    if (!a){ out.objs[id] = "new"; return; }
    if (b.kind === "dict"){
      var wasByKey = {};
      a.pairs.forEach(function(p){ wasByKey[p.key] = p.val; });
      b.pairs.forEach(function(p){
        if (wasByKey[p.key] === undefined){
          out.cells[id + ":" + p.key] = "new";
          if (say.length < 3) say.push("в словарь добавился ключ <b>" + A.esc(p.key) + "</b>");
        } else if (!vizSame(wasByKey[p.key], p.val)){
          out.cells[id + ":" + p.key] = "chg";
          if (say.length < 3) say.push("по ключу <b>" + A.esc(p.key) + "</b> стало " +
            A.esc(vizShort(p.val, cur.objects)));
        }
      });
    } else {
      (b.items || []).forEach(function(it, ix){
        var was = (a.items || [])[ix];
        if (was === undefined){
          out.cells[id + ":" + ix] = "new";
          if (say.length < 3) say.push("добавился элемент <b>" + A.esc(vizShort(it, cur.objects)) + "</b>");
        } else if (!vizSame(was, it)){
          out.cells[id + ":" + ix] = "chg";
          if (say.length < 3) say.push("элемент " + ix + " стал <b>" + A.esc(vizShort(it, cur.objects)) + "</b>");
        }
      });
    }
  });

  /* напечатанное — тоже изменение, и часто единственное на шаге */
  if (cur.output !== prev.output){
    var add = String(cur.output).slice(String(prev.output).length).replace(/\n+$/, "");
    if (add !== "" && say.length < 3) say.push("напечатано: <b>" + A.esc(add.split("\n").join(" ⏎ ")) + "</b>");
  }

  out.text = say.join(", ");
  return out;
}

/* значение ячейки: скаляр или стрелка-ссылка на объект */
function vizCellHTML(cell){
  if (cell.t === "ref"){
    var c = vizColor(cell.id);
    return '<span class="vref" data-ref="' + cell.id + '" style="color:' + c + ';border-color:' + c + '">→</span>';
  }
  return '<span class="vval">' + A.esc(cell.text) + '</span>';
}
/* mk — метка изменения ("new" | "chg" | undefined). Класс на самой ячейке,
   а не на всей коробке: в словаре из восьми ключей важно, какой именно из них
   поменялся, иначе подсветка не помогает, а мешает. */
function vizMark(mk){ return mk ? " " + (mk === "new" ? "vzn" : "vzc") : ""; }

function vizObjHTML(obj, names, marks){
  var c = vizColor(obj.id);
  var cells = (marks && marks.cells) || {};
  var head = '<div class="vohead" style="color:' + c + '">' + vizKind(obj.kind) +
    (names && names.length ? ' <span class="vonames">' + names.map(A.esc).join(", ") + '</span>' : '') + '</div>';
  var body;
  if (obj.kind === "dict"){
    body = obj.pairs.length
      ? obj.pairs.map(function(p){
          return '<div class="vopair' + vizMark(cells[obj.id + ":" + p.key]) + '">' +
                 '<span class="vokey">' + A.esc(p.key) + '</span>' +
                 '<span class="vosep">:</span>' + vizCellHTML(p.val) + '</div>';
        }).join("")
      : '<span class="voempty">пусто</span>';
    body = '<div class="vodict">' + body + '</div>';
  } else {
    var withIdx = obj.kind === "list" || obj.kind === "tuple";
    body = obj.items.length
      ? obj.items.map(function(it, i){
          return '<div class="vocell' + vizMark(cells[obj.id + ":" + i]) + '">' +
                 (withIdx ? '<span class="voidx">' + i + '</span>' : '') +
                 '<span class="voval">' + vizCellHTML(it) + '</span></div>';
        }).join("")
      : '<span class="voempty">пусто</span>';
    body = '<div class="vocells">' + body + '</div>';
  }
  var objMark = marks && marks.objs && marks.objs[obj.id] ? " vzn" : "";
  return '<div class="vizobj' + objMark + '" data-id="' + obj.id + '" style="border-color:' + c + '">' + head + body + '</div>';
}

/* Один кадр стека: имя функции (или «главная программа») и её переменные.
   Кадр функции рисуется отдельной коробкой поверх программы — так видно, что
   местная переменная живёт не там же, где внешняя, даже если имя одно. */
function vizScopeHTML(scope, si, marks){
  var vm = (marks && marks.vars) || {};
  var rows = scope.vars.length
    ? scope.vars.map(function(v){
        return '<div class="vizvar' + vizMark(vm[si + ":" + v.name]) + '"><b>' + A.esc(v.name) + '</b>' +
               '<span class="veq">=</span>' + vizCellHTML(v.cell) + '</div>';
      }).join("")
    : '<div class="vizempty">переменных пока нет</div>';
  var isCall = si > 0;
  var fresh = marks && marks.scopes && marks.scopes[si] ? " vzn" : "";
  /* Имя функции НЕ переводим в верхний регистр (в отличие от подписи «главная
     программа»): в Python имена регистрозависимы, и «ПЛОЩАДЬ» — это другое имя.
     Подпись не должна врать про код. */
  var title = isCall
    ? '⤷ <span class="vsfn">' + A.esc(scope.name || "?") + '()</span>'
    : "главная программа";
  return '<div class="vizscope' + (isCall ? " call" : "") + fresh + '">' +
         '<div class="vsname">' + title + '</div>' + rows + '</div>';
}

function vizMemoryHTML(frame, marks){
  var namesByObj = {};
  frame.vars.forEach(function(v){
    if (v.cell.t === "ref") (namesByObj[v.cell.id] = namesByObj[v.cell.id] || []).push(v.name);
  });
  /* Пока программа не заходила в функции, кадр один — рисуем как раньше,
     без лишней рамки и заголовка: хрома не должно быть больше, чем данных. */
  var scopes = frame.scopes && frame.scopes.length ? frame.scopes : null;
  var varsHTML;
  if (!scopes || scopes.length === 1){
    var only = scopes ? scopes[0] : { vars: frame.vars };
    var vm = (marks && marks.vars) || {};
    varsHTML = only.vars.length
      ? only.vars.map(function(v){
          return '<div class="vizvar' + vizMark(vm["0:" + v.name]) + '"><b>' + A.esc(v.name) + '</b>' +
                 '<span class="veq">=</span>' + vizCellHTML(v.cell) + '</div>';
        }).join("")
      : '<div class="vizempty">переменных пока нет</div>';
  } else {
    varsHTML = scopes.map(function(sc, si){ return vizScopeHTML(sc, si, marks); }).join("");
  }
  var ids = Object.keys(frame.objects);
  var objsHTML = ids.length
    ? ids.map(function(id){ return vizObjHTML(frame.objects[id], namesByObj[id], marks); }).join("")
    : '<div class="vizempty">списков и словарей пока нет</div>';
  return '<div class="vizvars">' + varsHTML + '</div>' +
         '<div class="vizheap">' + objsHTML + '</div>' +
         '<svg class="vizarrows" preserveAspectRatio="none"></svg>';
}
/* Стрелки от каждой ссылки к её объекту. Рисуем поверх, по реальным
   координатам элементов. Если геометрии нет (например, скрытый блок) —
   молча пропускаем: цвет ссылки и коробки всё равно совпадает. */
function vizDrawArrows(mem){
  try {
    var svg = mem.querySelector(".vizarrows"); if (!svg) return;
    var base = mem.getBoundingClientRect();
    if (!base.width || !base.height) return;
    svg.setAttribute("width", base.width);
    svg.setAttribute("height", base.height);
    svg.setAttribute("viewBox", "0 0 " + base.width + " " + base.height);
    var defs = VIZ_COLORS.map(function(col, i){
      return '<marker id="vzar' + i + '" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">' +
             '<path d="M0,0 L6,3 L0,6 Z" fill="' + col + '"/></marker>';
    }).join("");
    var parts = "";
    mem.querySelectorAll("[data-ref]").forEach(function(src){
      var id = src.getAttribute("data-ref");
      var tgt = mem.querySelector('.vizobj[data-id="' + id + '"]'); if (!tgt) return;
      var s = src.getBoundingClientRect(), t = tgt.getBoundingClientRect();
      var x1 = s.right - base.left, y1 = s.top + s.height / 2 - base.top;
      var x2 = t.left - base.left, y2 = t.top + Math.min(16, t.height / 2) - base.top;
      if (x2 < x1){ x2 = t.right - base.left; }         // объект левее ссылки — целимся в правый край
      var mx = (x1 + x2) / 2, ci = vizColorIdx(id);
      parts += '<path d="M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 +
               '" fill="none" stroke="' + VIZ_COLORS[ci] + '" stroke-width="2" opacity="0.85" marker-end="url(#vzar' + ci + ')"/>';
    });
    svg.innerHTML = "<defs>" + defs + "</defs>" + parts;
  } catch(e){}
}

/* opts (всё необязательное):
     code   — программа, которую надо разобрать (иначе первый пример);
     env    — окружение прогона: ответы для input(), файлы, модули;
     backTo — { label, go } кнопка возврата туда, откуда пришли.

   Разбор СВОЕГО кода — главное, зачем этот экран нужен на уроке: примеры
   объясняют алиасинг вообще, а ребёнку надо понять свою программу. Раньше
   уйти с урока было нельзя (написанный код терялся), поэтому визуализатор
   жил сам по себе. С черновиками (draftFlush в claimScreen) уход безопасен:
   код урока сохраняется на переходе и возвращается на место. */
function screenViz(opts){
  A.enterScreen("train", "viz");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  opts = opts || {};
  var mine = !!opts.code;
  var h = '<div class="lvlhead"><div><div class="idx">' +
    (mine ? "разбор твоей программы" : "загляни внутрь программы") +
    '</div><h1>🔍 Визуализатор</h1></div></div>' +
    '<p class="lede">' + (mine
      ? 'Это код из редактора урока — тот самый, что ты сейчас пишешь. Иди по шагам и смотри, что происходит в памяти: ' +
        'переменные, списки и словари рисуются коробками, а стрелки показывают, кто на что ссылается. ' +
        'Правки здесь на урок не влияют — там код остался как был.'
      : 'Запусти программу по шагам и смотри, что происходит в памяти: переменные, списки и словари рисуются коробками, ' +
        'а стрелки показывают, кто на что ссылается. Ползунком можно отматывать вперёд и назад — как в машине времени. ' +
        'Это лучший способ понять, почему <code>b = a</code> меняет оба списка сразу.') + '</p>' +
    '<div class="vizex"><span>' + (mine ? "Или разбери пример:" : "Примеры:") + '</span> ' +
      VIZ_EXAMPLES.map(function(e, i){ return '<button class="minibtn" data-ex="' + i + '">' + A.esc(e.title) + '</button>'; }).join("") +
    '</div><div id="vizstudio"></div>' +
    '<div class="pager">' +
      (opts.backTo ? '<button class="bigbtn" id="vizback">' + A.esc(opts.backTo.label) + '</button>' : '') +
      '<button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';
  A.app.innerHTML = h;

  var ed = A.makeEditor(opts.code || VIZ_EXAMPLES[0].code,
                        mine ? "твой код с урока" : "программа для разбора");
  var box = document.createElement("div"); box.className = "vizbox";
  box.appendChild(ed);
  var bar = document.createElement("div"); bar.className = "runbar";
  bar.innerHTML = '<button class="rbtn" data-role="viz">▶ Показать по шагам</button>' +
    '<span class="sp"></span><span class="tip"><span class="kbd">Ctrl</span>+<span class="kbd">Enter</span></span>';
  box.appendChild(bar);
  var player = document.createElement("div"); player.className = "vizplayer"; player.style.display = "none";
  box.appendChild(player);
  document.getElementById("vizstudio").appendChild(box);
  A.session().studio = box;

  /* Окружение уезжает вместе с кодом урока, но живёт только пока код тот же:
     подставили пример — ответы для input() от чужой программы только помешают. */
  var env = opts.env || null;
  function go(){ vizStart(player, ed, env); }
  bar.querySelector('[data-role="viz"]').onclick = go;
  ed.querySelector("textarea").addEventListener("keydown", function(e){
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter"){ e.preventDefault(); go(); }
  });
  A.app.querySelectorAll("[data-ex]").forEach(function(b){
    b.onclick = function(){
      ed.setCode(VIZ_EXAMPLES[+b.getAttribute("data-ex")].code);
      env = null;
      vizStart(player, ed, env);
    };
  });
  var vb = document.getElementById("vizback");
  if (vb) vb.onclick = function(){ opts.backTo.go(); };
  document.getElementById("tomap").onclick = A.goHome;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
  /* Пришли с урока — сразу показываем разбор: ребёнок нажал «разобрать»,
     второе нажатие на этом экране было бы лишним шагом. */
  if (mine) go();
}

function vizStart(player, ed, env){
  vizStopPlay();                       /* прошлый прогон больше не тикает */
  var rec = vizRecord(ed.getCode(), env);
  player._story = A.storyHTML(ed.getCode(), env);   /* пересказ того же прогона */
  player.style.display = "";
  if (rec.error && !rec.frames.length){
    ed.setError(rec.error.line || 0);
    player.innerHTML = '<div class="msg show bad"><b>' + (A.KIND_RU[rec.error.kind] || rec.error.kind) +
      (rec.error.line ? " — строка " + rec.error.line : "") + '</b>' + A.esc(rec.error.msg) +
      '<br>Исправь программу слева и запусти снова.</div>';
    return;
  }
  vizPlayer(player, ed, rec);
}

function vizPlayer(player, ed, rec){
  var frames = rec.frames, i = 0;
  player.innerHTML =
    '<div class="vizctl">' +
      '<button class="rbtn sec" data-v="first" title="в начало">⏮</button>' +
      '<button class="rbtn sec" data-v="prev" title="шаг назад">◀ Назад</button>' +
      '<button class="rbtn" data-v="play" title="проиграть">▶ Играть</button>' +
      '<button class="rbtn sec" data-v="next" title="шаг вперёд">Вперёд ▶</button>' +
      '<input class="vizslider" type="range" min="0" max="' + (frames.length - 1) + '" value="0" aria-label="шаг">' +
      '<span class="vizpos"></span>' +
    '</div>' +
    (rec.truncated ? '<div class="viznote">Программа длинная — показаны первые ' + frames.length + ' шагов.</div>' : '') +
    (player._story || '') +
    '<div class="vizwhat" style="display:none"></div>' +
    '<div class="vizstage"><div class="vizcode"></div><div class="vizmem"></div></div>' +
    '<div class="vizerr" style="display:none"></div>' +
    '<div class="pane pout"><div class="ph">вывод к этому шагу</div><div class="console"></div></div>';

  var codeEl = player.querySelector(".vizcode");
  var memEl = player.querySelector(".vizmem");
  var conEl = player.querySelector(".console");
  var errEl = player.querySelector(".vizerr");
  var whatEl = player.querySelector(".vizwhat");
  var slider = player.querySelector(".vizslider");
  var posEl = player.querySelector(".vizpos");
  var playBtn = player.querySelector('[data-v="play"]');
  var codeLines = ed.getCode().replace(/\r/g, "").split("\n");

  function renderCode(line){
    codeEl.innerHTML = codeLines.map(function(ln, idx){
      var n = idx + 1;
      return '<div class="vcl' + (n === line ? " on" : "") + '"><span class="vcn">' + n + '</span>' +
        '<span class="vct">' + (ln ? A.hl(ln) : "&nbsp;") + '</span></div>';
    }).join("");
  }
  function render(){
    var f = frames[i];
    renderCode(f.line);
    /* Изменение считаем относительно ПРЕДЫДУЩЕГО кадра, а не относительно
       того, откуда прыгнули ползунком: «что изменилось на этом шаге» должно
       значить одно и то же, куда бы ребёнок ни ткнул на шкале. */
    var marks = vizDiff(frames[i - 1], f);
    memEl.innerHTML = vizMemoryHTML(f, marks);
    vizDrawArrows(memEl);
    if (marks.text){
      whatEl.style.display = "";
      whatEl.innerHTML = '<span class="vwl">на этом шаге</span><span class="vwt">' + marks.text + '</span>';
    } else whatEl.style.display = "none";
    conEl.innerHTML = f.output ? A.esc(f.output) : '<span class="empty">пока ничего не напечатано</span>';
    posEl.textContent = "шаг " + (i + 1) + " из " + frames.length +
      (f.error ? " · ошибка" : f.done ? " · конец" : "");
    slider.value = i;
    if (f.error){
      errEl.style.display = "";
      errEl.innerHTML = '<b>' + (A.KIND_RU[f.error.kind] || f.error.kind) +
        (f.error.line ? " — строка " + f.error.line : "") + '</b>' + A.esc(f.error.msg);
    } else errEl.style.display = "none";
  }
  function goto(k){ i = Math.max(0, Math.min(frames.length - 1, k)); render(); }
  function stop(){ vizStopPlay(); }
  function play(){
    if (vizPlaying()){ stop(); return; }
    if (i >= frames.length - 1) i = 0;
    playBtn.textContent = "⏸ Пауза"; playBtn.classList.add("on");
    var id = setInterval(function(){
      /* плеер убрали с экрана — гасим сами, даже если про нас забыли */
      if (!document.body.contains(memEl)){ vizStopPlay(); return; }
      if (i >= frames.length - 1){ stop(); return; }
      goto(i + 1);
    }, 800);
    vizPlay = { id: id, onStop: function(){
      playBtn.textContent = "▶ Играть"; playBtn.classList.remove("on"); } };
  }
  player.querySelector('[data-v="first"]').onclick = function(){ stop(); goto(0); };
  player.querySelector('[data-v="prev"]').onclick = function(){ stop(); goto(i - 1); };
  player.querySelector('[data-v="next"]').onclick = function(){ stop(); goto(i + 1); };
  playBtn.onclick = play;
  slider.oninput = function(){ stop(); goto(+slider.value); };

  /* стрелки перерисовываются общим обработчиком resize в app.js:
     свой слушатель на каждый запуск накапливался бы по одному за нажатие */
  render();
  if (player.scrollIntoView) player.scrollIntoView({ behavior:"smooth", block:"nearest" });
}

return { screenViz: screenViz, vizStopPlay: vizStopPlay, vizPlaying: vizPlaying,
         vizRecord: vizRecord, vizShort: vizShort, vizMemoryHTML: vizMemoryHTML,
         vizDrawArrows: vizDrawArrows, vizDiff: vizDiff, VIZ_EXAMPLES: VIZ_EXAMPLES };
};
