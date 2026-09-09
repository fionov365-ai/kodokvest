/* ============================================================
   Фионика — исполнитель «Робот» и его язык.

   ЗАЧЕМ. Решение фаундера 08.09.2026, два его вопроса, оказавшиеся одной
   работой: «делай робота» и «хочу свой второй язык, которого не существует».
   Роботу всё равно нужны команды, условия и циклы; если написать их русскими
   словами — это и есть свой язык. И он же закрывает ОГЭ 15.1, единственную
   дыру экзамена, которую мы вообще способны закрыть (13 и 14 требуют офисных
   программ, разбор — docs/arhitektura-2026-09-08.md § 10).

   ⚠️ ЯЗЫК ВЗЯТ КУМИРОВСКИЙ, СЛОВО В СЛОВО, И ЭТО ПРИНЦИПИАЛЬНО. Свой синтаксис
   был бы приятнее сочинять, но на экзамене принимают КуМир, а не нас. Ребёнок,
   выучивший здесь «нц пока … кц», в КуМире пишет то же самое и не переучивается.
   Язык, с которого ничего не переносится, — это игрушка, а мы обещаем экзамен.

     вверх · вниз · влево · вправо · закрасить
     сверху|снизу|слева|справа свободно   и то же со словом «стена»
     клетка закрашена · клетка чистая
     не · и · или · скобки
     нц пока <условие> … кц      нц <число> раз … кц
     если <условие> то … иначе … все
     | всё после палочки — комментарий

   ⚠️ ЕДИНСТВЕННОЕ РАСХОЖДЕНИЕ С КУМИРОМ, и оно записано здесь, чтобы никто
   не считал его недосмотром: у нас стена — это КЛЕТКА, а в КуМире стена стоит
   на ребре между клетками. Для того, что пишет ребёнок, разницы нет:
   «справа свободно» значит одно и то же, и все задачи про «иди вдоль стены»
   решаются теми же программами. Зато поле рисуется и задаётся текстом, а не
   двумя наборами рёбер, — а это разница между «можно завести задачу за минуту»
   и «нужен редактор полей».

   ⚠️ Судить Робота проще, чем Python, и в этом его отдельная ценность: сверять
   надо не текст программы, а ДВЕ КЛЕТЧАТЫЕ ДОСКИ. Ответ — множество
   закрашенных клеток; совпало — значит решено, и никакие «а у меня по-другому,
   но тоже правильно» тут не возникают.

   Поле задаётся строками:  «.» пусто   «#» стена   «@» робот   «*» закрашено
   (робот на закрашенной клетке — «+»).
   ============================================================ */
(function(){
"use strict";

var DIRS = { "вверх":[0,-1], "вниз":[0,1], "влево":[-1,0], "вправо":[1,0] };
var STOR = { "сверху":[0,-1], "снизу":[0,1], "слева":[-1,0], "справа":[1,0] };
var MAX_STEPS = 20000;          /* защита от «нц пока … кц» без выхода */

/* ---------- поле ---------- */
function parseField(rows){
  var f = { w:0, h:rows.length, walls:{}, painted:{}, x:0, y:0, found:false };
  rows.forEach(function(row, y){
    var chars = Array.from(row);
    if (chars.length > f.w) f.w = chars.length;
    chars.forEach(function(z, x){
      var key = x + "," + y;
      if (z === "#") f.walls[key] = 1;
      if (z === "*" || z === "+") f.painted[key] = 1;
      if (z === "@" || z === "+"){ f.x = x; f.y = y; f.found = true; }
    });
  });
  return f;
}
function fieldRows(f){
  var out = [];
  for (var y = 0; y < f.h; y++){
    var line = "";
    for (var x = 0; x < f.w; x++){
      var key = x + "," + y, here = (f.x === x && f.y === y);
      if (f.walls[key]) line += "#";
      else if (here && f.painted[key]) line += "+";
      else if (here) line += "@";
      else if (f.painted[key]) line += "*";
      else line += ".";
    }
    out.push(line);
  }
  return out;
}
/* Ответ задачи — только закрашенное. Где остановился робот, не спрашиваем:
   на экзамене это тоже не проверяется, а требовать лишнее значит заваливать
   верные решения. */
function paintedKeys(f){ return Object.keys(f.painted).sort(); }
function samePainted(a, b){
  var ka = paintedKeys(a), kb = paintedKeys(b);
  return ka.length === kb.length && ka.join(";") === kb.join(";");
}
function free(f, dx, dy){
  var nx = f.x + dx, ny = f.y + dy;
  if (nx < 0 || ny < 0 || nx >= f.w || ny >= f.h) return false;
  return !f.walls[nx + "," + ny];
}

/* ---------- разбор программы ----------
   Построчно, как в КуМире: одна команда — одна строка. Это не упрощение ради
   лени, а то, как язык и выглядит у школьника в тетради; заодно номер строки
   в ошибке всегда честный. */
function err(line, msg){ return { line: line, msg: msg }; }

function tokens(s){
  return s.replace(/\(/g, " ( ").replace(/\)/g, " ) ").split(/\s+/).filter(Boolean);
}
/* Условие: разбор сверху вниз, «или» слабее «и», «и» слабее «не». */
function parseCond(tk, line){
  var i = 0;
  function peek(){ return tk[i]; }
  function eat(){ return tk[i++]; }
  function atom(){
    var t = eat();
    if (t === "("){ var v = expr(); if (eat() !== ")") throw err(line, "Не закрыта скобка в условии."); return v; }
    if (t === "не") return { op:"не", a: atom() };
    if (t === "клетка"){
      var w = eat();
      if (w === "закрашена") return { op:"закрашена" };
      if (w === "чистая")    return { op:"чистая" };
      throw err(line, "После «клетка» бывает «закрашена» или «чистая», а не «" + w + "».");
    }
    if (STOR[t]){
      var w2 = eat();
      if (w2 === "свободно") return { op:"свободно", d:t };
      if (w2 === "стена")    return { op:"стена", d:t };
      throw err(line, "После «" + t + "» бывает «свободно» или «стена», а не «" + w2 + "».");
    }
    throw err(line, "Непонятное условие: «" + t + "».");
  }
  function and(){
    var a = atom();
    while (peek() === "и"){ eat(); a = { op:"и", a:a, b:atom() }; }
    return a;
  }
  function expr(){
    var a = and();
    while (peek() === "или"){ eat(); a = { op:"или", a:a, b:and() }; }
    return a;
  }
  var v = expr();
  if (i < tk.length) throw err(line, "Лишнее в условии: «" + tk.slice(i).join(" ") + "».");
  return v;
}

function parse(text){
  var lines = String(text || "").split("\n");
  var prog = [], stack = [prog], heads = [];
  lines.forEach(function(raw, idx){
    var line = idx + 1;
    var s = raw.split("|")[0].trim();
    if (!s) return;
    var tk = tokens(s), head = tk[0], body = stack[stack.length - 1];

    if (DIRS[head] || head === "закрасить"){
      if (tk.length > 1) throw err(line, "После команды «" + head + "» ничего не пишут.");
      body.push({ t: head, line: line });
      return;
    }
    if (head === "нц"){
      if (tk[1] === "пока"){
        if (tk.length < 3) throw err(line, "После «нц пока» нужно условие.");
        var node = { t:"пока", cond: parseCond(tk.slice(2), line), body: [], line: line };
        body.push(node); stack.push(node.body); heads.push("нц"); return;
      }
      if (tk.length === 3 && tk[2] === "раз" && /^\d+$/.test(tk[1])){
        var n = { t:"раз", n: +tk[1], body: [], line: line };
        body.push(n); stack.push(n.body); heads.push("нц"); return;
      }
      throw err(line, "Цикл пишется «нц пока <условие>» или «нц <число> раз».");
    }
    if (head === "кц"){
      if (heads.pop() !== "нц") throw err(line, "«кц» без открытого «нц».");
      stack.pop(); return;
    }
    if (head === "если"){
      if (tk[tk.length - 1] !== "то") throw err(line, "Строка с «если» кончается словом «то».");
      var f = { t:"если", cond: parseCond(tk.slice(1, -1), line), body: [], other: null, line: line };
      body.push(f); stack.push(f.body); heads.push("если"); return;
    }
    if (head === "иначе"){
      if (heads[heads.length - 1] !== "если") throw err(line, "«иначе» бывает только внутри «если».");
      stack.pop();
      var owner = stack[stack.length - 1];
      var last = owner[owner.length - 1];
      last.other = [];
      stack.push(last.other); return;
    }
    if (head === "все"){
      if (heads.pop() !== "если") throw err(line, "«все» без открытого «если».");
      stack.pop(); return;
    }
    throw err(line, "Непонятная команда: «" + head + "».");
  });
  if (heads.length) throw err(lines.length, "Не закрыт «" + (heads[heads.length - 1] === "нц" ? "нц» — нужен «кц" : "если» — нужно «все") + "».");
  return prog;
}

/* ---------- выполнение ---------- */
function run(text, field){
  var f = { w:field.w, h:field.h, walls:field.walls, painted:{}, x:field.x, y:field.y };
  Object.keys(field.painted).forEach(function(k){ f.painted[k] = 1; });
  var steps = 0, prog;
  try { prog = parse(text); }
  catch(e){ return { field: f, error: e, kind: "разбор" }; }

  function cond(c){
    if (c.op === "не")   return !cond(c.a);
    if (c.op === "и")    return cond(c.a) && cond(c.b);
    if (c.op === "или")  return cond(c.a) || cond(c.b);
    if (c.op === "закрашена") return !!f.painted[f.x + "," + f.y];
    if (c.op === "чистая")    return !f.painted[f.x + "," + f.y];
    var d = STOR[c.d], sv = free(f, d[0], d[1]);
    return c.op === "свободно" ? sv : !sv;
  }
  function block(list){
    for (var i = 0; i < list.length; i++){
      var st = list[i];
      if (++steps > MAX_STEPS)
        throw err(st.line, "Программа не останавливается: похоже, условие цикла никогда не станет ложным.");
      if (st.t === "закрасить"){ f.painted[f.x + "," + f.y] = 1; continue; }
      if (DIRS[st.t]){
        var d = DIRS[st.t];
        if (!free(f, d[0], d[1]))
          throw err(st.line, "Робот разбился: «" + st.t + "» упирается в стену.");
        f.x += d[0]; f.y += d[1]; continue;
      }
      if (st.t === "раз"){ for (var k = 0; k < st.n; k++) block(st.body); continue; }
      if (st.t === "пока"){
        while (cond(st.cond)){
          if (++steps > MAX_STEPS)
            throw err(st.line, "Программа не останавливается: похоже, условие цикла никогда не станет ложным.");
          block(st.body);
        }
        continue;
      }
      if (st.t === "если"){
        if (cond(st.cond)) block(st.body);
        else if (st.other) block(st.other);
      }
    }
  }
  try { block(prog); }
  catch(e){ return { field: f, error: e, kind: "выполнение" }; }
  return { field: f, error: null, steps: steps };
}

window.ROBOT = {
  parseField: parseField, fieldRows: fieldRows, run: run, parse: parse,
  samePainted: samePainted, paintedKeys: paintedKeys, MAX_STEPS: MAX_STEPS
};
})();
