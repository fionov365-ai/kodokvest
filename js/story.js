/* ============================================================
   Фионика — пересказ программы словами.

   ⚠️ ТРЕТЬЕ ОТРЕЗАНИЕ ПО ДОГОВОРУ из js/screens-showcase.js. Раздел выбран
   тем же способом, что и предыдущие: замером связанности по всем разделам
   app.js сразу, а не «на глаз, что тут самостоятельное». Наружу торчат два
   имени, внутрь нужны шесть — после редактора это лучшее соотношение.

   ⚠️ Замерять надо КАЖДЫЙ РАЗ заново, и это уже не теория: за одну сессию
   таблица связанности перестроилась трижды — каждое отрезание меняет и
   размеры соседей, и то, что у них торчит наружу.

   Сам раздел ничего не рисует и ничего не хранит: на входе разобранная
   программа и факты о её выполнении, на выходе — текст. Ровно поэтому он и
   отрезается дёшево.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.story = function(A){

/* ================= пересказ программы словами =================
   Обратное направление: сто уроков ребёнок превращает замысел в код, а здесь
   код превращается в русские фразы. Это ровно то умение, ради которого сделан
   раздел «Ты и ИИ»: чтобы командовать ИИ, надо уметь сказать словами, что
   должна делать программа.

   Пересказ собирается из ДВУХ источников, и это важно:
     - дерево (AST) даёт СТРУКТУРУ — что здесь цикл, а что описание функции;
     - шаги прогона дают ФАКТЫ — сколько раз повторилось, что напечатало,
       чему стало равно.
   Поэтому в пересказе нет ни одного «наверное»: каждая фраза — про то, что
   действительно произошло на этом запуске. Так и написано над списком, чтобы
   ребёнок не принял пересказ за замысел: программа могла сделать не то, что
   задумано, — как раз это и видно.

   Живёт на экране визуализатора, над плеером: кнопка «Разобрать» на уроке
   ведёт сюда, и получается два взгляда на один прогон — фразами и по шагам.
   ============================================================ */
var STORY_MAX_DEPTH = 2;    /* глубже не идём: пересказ должен читаться */
var STORY_MAX_LINES = 24;   /* и не быть длиннее самой программы */

function storyMaxLine(node){
  var max = node.line || 0;
  A.astWalk(node, function(m){ if (m.line > max) max = m.line; });
  return max;
}
function storyRange(node){
  var a = node.line || 0, b = storyMaxLine(node);
  return b > a ? ("строки " + a + "–" + b) : ("строка " + a);
}
function storyTimes(n){
  if (!n) return "ни разу не сработала";
  if (n === 1) return "сработала один раз";
  return "сработала " + n + " " + A.plural(n, "раз", "раза", "раз");
}
/* Имя того, что вызывают: print, sorted, черепашка, свой метод. */
function storyCallName(node){
  if (!node || node.type !== "Call" || !node.func) return null;
  if (node.func.type === "Name") return node.func.id;
  if (node.func.type === "Attribute") return node.func.attr;
  return null;
}
function storyCut(s, n){
  s = String(s === null || s === undefined ? "" : s).replace(/\s+/g, " ").trim();
  n = n || 60;
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/* Одна фраза про один оператор. null значит «сказать нечего» — служебные
   строки в пересказ не идут, иначе он станет подстрочником. */
function storyOne(st, facts, depth){
  var hits = facts.hits[st.line] || 0;
  var note = facts.note[st.line], printed = facts.printed[st.line];
  var где = "строка " + st.line + ": ";
  /* Строка, на которой прогон и оборвался. Говорим об этом прямо: иначе про
     print(10 / 0) вышло бы «напечатал пустую строку» — а он не напечатал
     ничего, он упал. */
  if (facts.error && facts.error.line === st.line)
    return { text: где + "здесь программа остановилась с ошибкой", body: null };

  if (st.type === "FuncDef"){
    var внутри = st.body && st.body.length ? (facts.hits[st.body[0].line] || 0) : 0;
    var парам = (st.params || []).join(", ");
    return { text: storyRange(st) + ": описал команду «" + st.name + "(" + парам + ")» — " +
                   (внутри ? "её вызвали " + внутри + " " + A.plural(внутри, "раз", "раза", "раз")
                           : "но её так и не вызвали"),
             body: st.body, at: st.line };
  }
  if (st.type === "ClassDef")
    return { text: storyRange(st) + ": описал вид объектов «" + st.name + "»", body: null };
  if (st.type === "For"){
    var сколько = st.body && st.body.length ? (facts.hits[st.body[0].line] || 0) : hits;
    return { text: storyRange(st) + ": повторил " + сколько + " " +
                   A.plural(сколько, "раз", "раза", "раз") + " — по одному на каждый элемент",
             body: st.body };
  }
  if (st.type === "While"){
    var кругов = st.body && st.body.length ? (facts.hits[st.body[0].line] || 0) : hits;
    return { text: storyRange(st) + ": повторял, пока условие верно, — " + кругов + " " +
                   A.plural(кругов, "круг", "круга", "кругов"), body: st.body };
  }
  if (st.type === "If"){
    var взяли = st.body && st.body.length ? (facts.hits[st.body[0].line] || 0) : 0;
    var текст = где + "проверил условие " + hits + " " + A.plural(hits, "раз", "раза", "раз") +
                " — сработало " + взяли;
    if (st.orelse && st.orelse.length){
      var иначе = facts.hits[st.orelse[0].line] || 0;
      текст += ", иначе-ветка — " + иначе;
    }
    return { text: текст, body: st.body };
  }
  if (st.type === "Assign" || st.type === "AnnAssign" || st.type === "AugAssign"){
    if (!note) return null;
    return { text: где + (hits > 1
                    ? "менял значение " + hits + " " + A.plural(hits, "раз", "раза", "раз") + ", в конце "
                    : "") + storyCut(note),
             body: null };
  }
  if (st.type === "Return")
    return { text: где + "вернул ответ (" + storyTimes(hits) + ")", body: null };
  if (st.type === "Import" || st.type === "ImportFrom")
    return { text: где + "подключил готовый набор команд", body: null };
  if (st.type === "ExprStmt"){
    var имя = storyCallName(st.value);
    if (имя === "print"){
      var сколько = hits > 1 ? "напечатал " + hits + " " + A.plural(hits, "раз", "раза", "раз") + ": "
                            : "напечатал: ";
      if (printed) return { text: где + сколько + storyCut(printed, 70), body: null };
      /* Печать без текста бывает двух видов, и путать их нельзя: print()
         печатает пустую строку, а print(функция(...)) печатает результат
         вызова — только вывод в шагах достаётся не этой строке, а той,
         внутри функции, где он случился. */
      var сCall = false;
      A.astWalk(st.value.args || [], function(m){ if (m.type === "Call") сCall = true; });
      return { text: где + (сCall ? "напечатал результат вызова" : "напечатал пустую строку"),
               body: null };
    }
    if (имя)
      return { text: где + "вызвал «" + имя + "» (" + storyTimes(hits) + ")" +
                     (printed ? ", напечаталось: " + storyCut(printed, 40) : ""), body: null };
    return null;
  }
  if (st.type === "Pass" || st.type === "Break" || st.type === "Continue") return null;
  /* Незнакомый оператор: лучше сказать честно «что-то сделал», чем выдумать. */
  if (printed) return { text: где + "напечатал: " + storyCut(printed, 70), body: null };
  if (note) return { text: где + storyCut(note), body: null };
  return null;
}

function storyLines(body, facts, depth, out){
  if (!body || depth > STORY_MAX_DEPTH) return out;
  for (var i = 0; i < body.length && out.length < STORY_MAX_LINES; i++){
    var one = storyOne(body[i], facts, depth);
    if (!one) continue;
    out.push({ text: one.text, depth: depth });
    if (one.body) storyLines(one.body, facts, depth + 1, out);
  }
  return out;
}

/* Пересказ целиком. Возвращает { lines, error, empty } либо null, если
   программа даже не разбирается. */
function storyOf(code, env){
  var eng = Runtime.get("mini");
  var ast;
  try { ast = window.MiniPy.parse(String(code || "")); }
  catch(e){ if (!e.pyKind) throw e; return null; }
  var facts = A.stepFacts(eng, code, env || {}, A.WATCH_MAX_STEPS);
  if (!facts) return null;
  var lines = storyLines(ast.body, facts, 0, []);
  return { lines: lines, error: facts.error, truncated: facts.truncated };
}
function storyHTML(code, env){
  var st = storyOf(code, env);
  if (!st) return "";
  if (!st.lines.length && !st.error) return "";
  var h = '<div class="story"><div class="storyhead">📖 Что программа сделала — словами</div>' +
    '<ol class="storylist">' +
    st.lines.map(function(x){
      return '<li class="d' + Math.min(2, x.depth) + '">' + A.esc(x.text) + '</li>';
    }).join("") + '</ol>';
  if (st.error)
    h += '<p class="storyerr">…и на этом остановилась: ' +
         A.esc((A.KIND_RU[st.error.kind] || st.error.kind) +
             (st.error.line ? " (строка " + st.error.line + ")" : "")) + '.</p>';
  h += '<p class="storynote">Это пересказ того, что программа <b>сделала</b> на этом запуске, ' +
       'а не того, что задумано. Если фразы расходятся с твоим замыслом — вот и ошибка.</p></div>';
  return h;
}

return { storyHTML: storyHTML, storyOf: storyOf };
};
