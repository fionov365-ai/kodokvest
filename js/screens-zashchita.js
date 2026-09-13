/* ============================================================
   Фионика — «Защита своего кода»: вопросы по программе ученика
   с ответами, посчитанными движком.

   Откуда взялось (docs/rynok-i-rov-2026-09-12.md § 6б, 13.09.2026).
   53% школьников полностью отдают домашку нейросети, детекторы ошибаются,
   запись нажатий не видит перепечатку с телефона, учителя говорят
   «подозрительно, но не докажу». Рабочий способ, который называют все, —
   устная защита: «что будет, если…», «сколько раз…». Но она стоит времени
   учителя и знания Python у родителя. Здесь её половину делает движок:
   вопрос о СОБСТВЕННОЙ программе ученика, а ответ не угадан и не сочинён —
   он получен прогоном этой программы (или её копии с другим числом).

   Три вида вопросов, и каждый считается по-своему:
     1) «что напечатает, если в строке N заменить V на W» — копия программы
        с другим числом запускается целиком;
     2) «сколько раз выполнится тело цикла из строки N» — пошаговый прогон
        считает, сколько раз началась первая строка тела;
     3) «что будет в переменной после строки N» — пошаговый прогон снимает
        значение сразу после того, как строка выполнилась.

   ⚠️⚠️ ЭТО НЕ ДОКАЗАТЕЛЬСТВО (разбор рынка § 5.4). Кто писал сам, может
   ошибиться в своём коде; кто взял чужой, может его понять. Результат —
   повод поговорить, и так написано на экране. Слова «доказал» и «списал»
   здесь нет и не будет.

   ⚠️ Правило § 4.30: механизм соседа проверен на своих данных, прежде чем
   брать. «Спросите вслух» (myPredRun) молчит на выводе длиннее шести строк
   и на input() — для чужой программы он не годится. Взята идея computedQs
   из пакета к защите (ответы на input() и длинный вывод), а счёт цикла и
   переменной — свои, по пошаговому прогону.

   ⚠️ Мини-движок исполняет не весь Python. Программе, по которой вопросов
   не посчитать, экран говорит ПОЧЕМУ, а не молчит пустым местом.

   ⚠️ Данных нет. Вставленная программа не сохраняется и никуда не уходит:
   живёт в памяти экрана до перезагрузки. ИИ нет, сети нет.

   Договор — как в js/screens-showcase.js: всё снаружи приходит объектом A,
   общее состояние файл не пишет.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.zashchita = function(A){

var ZQ_STEPS = 60000;      /* потолок пошагового прогона */
var ZQ_OUT_LINES = 6;      /* вывод длиннее — спрашиваем первую изменившуюся строку */
var ZQ_OUT_CHARS = 300;
var ZQ_VAL_CHARS = 60;     /* значение переменной длиннее — вопрос не задаём */
var ZQ_SPOTS = 16;         /* столько чисел в программе пробуем менять */
var ZQ_SRC_MAX = 12;       /* столько своих программ показываем списком */

var mode = "kid";          /* kid — отвечает ученик, adult — смотрит взрослый */
var cur = { code: "", stdin: "", from: "", made: null, checked: null };

function esc(s){ return A.esc(String(s == null ? "" : s)); }
function plural(n, a, b, c){ return A.plural(n, a, b, c); }

/* ---------- прогоны ---------- */
function runOnce(code, stdin, seed){
  try {
    var o = { stdin: stdin.slice() };
    if (seed !== undefined) o.seed = seed;
    var r = Runtime.get("mini").run(code, o);
    return { out: String(r.output || "").replace(/\n+$/, ""), error: r.error || null,
             wait: !!r.awaitingInput, turtle: !!(r.turtle && r.turtle.segments && r.turtle.segments.length) };
  } catch(e){ return { out: "", error: { kind: "NotSupported", msg: String(e && e.message || e), line: 0 }, wait: false }; }
}
function inputWait(r){ return r.wait || (r.error && r.error.kind === "EOFError"); }

/* Все операторы программы — с пометкой, внутри функции или класса ли они:
   переменные оттуда в общем окружении не живут, и спрашивать о них нечестно. */
function stmtsOf(body, inDef, out, inTry){
  (body || []).forEach(function(st){
    if (!st || typeof st !== "object") return;
    out.push({ st: st, inDef: inDef, inTry: !!inTry });
    var deeper = inDef || st.type === "FuncDef" || st.type === "ClassDef";
    var t = inTry || st.type === "Try";
    stmtsOf(st.body, deeper, out, t);
    stmtsOf(st.orelse, deeper, out, t);
    stmtsOf(st.finalbody, deeper, out, t);
    (st.handlers || []).forEach(function(h){ stmtsOf(h.body, deeper, out, t); });
  });
  return out;
}
/* Пошаговый прогон. Движок отдаёт шаг на начало каждого оператора — и на
   return внутри lambda тоже, в той же строке. Поэтому:
     - тело цикла считается только в ТОМ окружении, где стоит сам цикл
       (loopEnv: окружения, в которых начинался заголовок; у lambda своё);
     - строка верхнего уровня считается и снимается только по шагам в общем
       окружении: «сразу после» — это следующий ОБЩИЙ шаг, к нему присваивание
       закончилось, даже если внутри вызывалась своя функция.
   ⚠️ Поймано проверкой [защита-кода] 13.09.2026: строка с sorted(key=lambda…)
   «выполнялась 5 раз», хотя выполнилась один. */
function trace(code, stdin, watch, loops){
  var res = { hits: {}, ghits: {}, body: {}, first: {}, last: {}, ok: false };
  var s;
  try { s = window.MiniPy.stepper(code, { stdin: stdin.slice() }); } catch(e){ return res; }
  var prev = 0, g = s.interp && s.interp.global, n = 0, loopEnv = {}, bodyOf = {};
  (loops || []).forEach(function(st){ loopEnv[st.line] = new Set(); bodyOf[st.body[0].line] = st.line; });
  function snap(line){
    var names = watch[line];
    if (!names || !g) return;
    names.forEach(function(nm){
      if (!g.vars.has(nm)) return;
      var v = window.MiniPy.pyRepr(g.vars.get(nm));
      var key = line + ":" + nm;
      if (res.first[key] === undefined) res.first[key] = v;
      res.last[key] = v;
    });
  }
  for (;;){
    if (++n > ZQ_STEPS) return res;
    var r;
    try { r = s.next(); } catch(e){ return res; }
    if (r.error) return res;
    if (r.done){ if (prev) snap(prev); res.ok = true; return res; }
    res.hits[r.line] = (res.hits[r.line] || 0) + 1;
    if (loopEnv[r.line]) loopEnv[r.line].add(r.env);
    var hd = bodyOf[r.line];
    if (hd !== undefined && loopEnv[hd].has(r.env)) res.body[hd] = (res.body[hd] || 0) + 1;
    if (r.env === g){
      if (prev) snap(prev);
      res.ghits[r.line] = (res.ghits[r.line] || 0) + 1;
      prev = r.line;
    }
  }
}

function lineText(code, n){ return String(code.split("\n")[n - 1] || "").trim(); }

/* ---------- вопрос 1: другое число ---------- */
function mutQ(code, stdin, base){
  if (!base.out.trim()) return null;
  var k = A.codeSkeleton(code);
  var re = /(^|[^A-Za-z_0-9.А-Яа-яЁё])(\d+)(?![.\dA-Za-z_])/g, m, spots = 0;
  var was = base.out.split("\n");
  while ((m = re.exec(k)) !== null && spots < ZQ_SPOTS){
    spots++;
    var at = m.index + m[1].length, v = parseInt(m[2], 10);
    var cands = [v + 1, v * 2, v + 2, v - 1];
    for (var j = 0; j < cands.length; j++){
      var nv = cands[j];
      if (nv < 0 || nv === v || nv > 9999) continue;
      var mut = code.slice(0, at) + nv + code.slice(at + m[2].length);
      var r = runOnce(mut, stdin);
      if (r.error || inputWait(r) || !r.out.trim() || r.out === base.out) continue;
      var line = code.slice(0, at).split("\n").length;
      var now = r.out.split("\n");
      var q = "В строке " + line + " число " + v + " заменили на " + nv + ". ";
      if (now.length <= ZQ_OUT_LINES && r.out.length <= ZQ_OUT_CHARS)
        return { kind: "mut", line: line, at: at, from: v, to: nv, q: q + "Что теперь напечатает программа?", a: r.out,
          why: "Слушайте, объясняет ли он, за что отвечает это число, а не пересказывает строки." };
      var i = 0;
      while (i < was.length && i < now.length && was[i] === now[i]) i++;
      if (i >= now.length || i >= was.length) continue;
      /* Вывод длинный: спрашиваем про одну строку — первую, которая станет
         другой, и называем её прежний вид. Ответ — одна строка, без счёта. */
      return { kind: "mut", line: line, at: at, from: v, to: nv, row: i,
        q: q + "Строка " + (i + 1) + " вывода была «" + was[i] + "». Какой она станет?",
        a: now[i], one: true,
        why: "Весь длинный вывод наизусть не помнят, но автор знает, какое место программы зависит от этого числа." };
    }
  }
  return null;
}

/* ---------- вопрос 2: сколько раз цикл ---------- */
function loopQ(code, all, tr){
  var best = null;
  all.forEach(function(x){
    var st = x.st;
    if (st.type !== "For" && st.type !== "While") return;
    if (!st.body || !st.body.length || st.body[0].line <= st.line) return;
    var n = tr.body[st.line] || 0;
    if (n < 2 || n > 5000) return;
    /* внешний цикл раньше вложенного: его проще найти глазами в программе */
    if (!best) best = { st: st, n: n, inDef: x.inDef };
  });
  if (!best) return null;
  var head = lineText(code, best.st.line);
  return { kind: "loop", line: best.st.line, bodyLine: best.st.body[0].line,
    q: "Сколько раз за весь запуск выполнится тело цикла из строки " + best.st.line + " (" + head + ")?",
    a: String(best.n),
    why: best.inDef
      ? "Цикл внутри функции: считаются все её вызовы вместе. Хороший ответ — не число наугад, а «функцию вызвали столько-то раз, и каждый раз…»."
      : "Хороший ответ — не только число, но и откуда оно: «потому что range(…)» или «пока не станет…»." };
}

/* ---------- вопрос 3: что в переменной ---------- */
function varCands(code, all){
  var out = [];
  all.forEach(function(x){
    var st = x.st;
    /* внутри try строка могла начаться и не закончиться — «после строки» там неоднозначно */
    if (x.inDef || x.inTry) return;
    var nm = null;
    if (st.type === "AugAssign" && st.target && st.target.type === "Name") nm = st.target.id;
    if (st.type === "Assign" && st.targets && st.targets.length === 1 && st.targets[0].type === "Name") nm = st.targets[0].id;
    if (!nm || nm.charAt(0) === "_") return;
    var literal = st.type === "Assign" && /^(Num|Str|Const|NoneType)$/.test(st.value && st.value.type || "");
    out.push({ st: st, name: nm, literal: literal });
  });
  return out;
}
function varQ(code, cands, tr){
  var pick = null;
  /* сначала то, что меняется много раз (накопление в цикле), потом одноразовое
     вычисление; присваивание числа как есть не спрашиваем — ответ написан в коде */
  cands.forEach(function(c){
    var hits = tr.ghits[c.st.line] || 0, key = c.st.line + ":" + c.name;
    if (!hits || tr.last[key] === undefined || tr.last[key].length > ZQ_VAL_CHARS) return;
    /* объект, функция, генератор: у python3 в записи адрес памяти — отвечать тут нечего */
    if (tr.last[key].charAt(0) === "<") return;
    if (hits === 1 && c.literal) return;
    var score = hits > 1 ? 2 : 1;
    if (!pick || score > pick.score) pick = { c: c, hits: hits, val: tr.last[key], score: score };
  });
  if (!pick) return null;
  var ln = pick.c.st.line;
  return { kind: "var", line: ln, name: pick.c.name, times: pick.hits,
    q: pick.hits > 1
      ? "Строка " + ln + " (" + lineText(code, ln) + ") выполняется " + pick.hits + " " + plural(pick.hits, "раз", "раза", "раз") +
        ". Что будет в переменной " + pick.c.name + " после последнего раза?"
      : "Что будет в переменной " + pick.c.name + " сразу после строки " + ln + " (" + lineText(code, ln) + ")?",
    a: pick.val,
    why: (/^['"]/.test(pick.val) ? "Это текст — в ответе он в кавычках, но назвать его можно и без них. " : "") +
         "Слушайте, как он считает, а не только итог." };
}

/* ---------- всё вместе ---------- */
function refuse(title, text){ return { ok: false, title: title, text: text, qs: [] }; }

function make(code, stdinText){
  code = String(code || "").replace(/\r\n?/g, "\n").replace(/\s+$/, "");
  var stdin = String(stdinText || "").replace(/\r\n?/g, "\n").split("\n");
  while (stdin.length && stdin[stdin.length - 1] === "") stdin.pop();
  if (!code.trim()) return refuse("Программы нет", "Вставьте программу в поле выше или возьмите свою из урока.");

  var ast;
  try { ast = window.MiniPy.parse(code); }
  catch(e){
    return refuse("Движок не разобрал программу",
      (A.KIND_RU[e.pyKind] || e.pyKind || "Ошибка") + (e.pyLine ? " в строке " + e.pyLine : "") + ": " +
      (e.pyMsg || e.message) + ". Если в настоящем Python программа работает, значит в ней запись, " +
      "которую мини-движок Фионики не знает.");
  }
  var base = runOnce(code, stdin);
  if (inputWait(base))
    return refuse("Программа ждёт ввода с клавиатуры",
      "В ней есть input(), а ответов не хватило. Впишите в поле «Что вводить» по одному ответу в строке — " +
      "и вопросы посчитаются на этих ответах.");
  if (base.error){
    var e = base.error, msg = String(e.msg || "").replace(/[.!\s]+$/, "");
    /* Уроки про файлы читают данные, которых у вставленной программы нет:
       она запускается пустой, без файлов урока. Это не поломка ученика. */
    if (e.kind === "FileNotFoundError")
      return refuse("Программа читает файл, которого здесь нет",
        msg + ". Защита запускает программу без файлов с данными, поэтому по такой программе вопросов не посчитать. " +
        "Возьмите программу, которая не открывает файлы.");
    return refuse("Программа останавливается с ошибкой",
      (A.KIND_RU[e.kind] || e.kind) + (e.line ? " в строке " + e.line : "") + ": " + msg + ". " +
      "Вопросы задаются по работающей программе. Если в настоящем Python ошибки нет — значит, " +
      "здесь то, чего мини-движок не умеет (например, модуль, которого у него нет).");
  }
  /* ⚠️ Без семени случайность у движка каждый раз одна и та же (семя 12345),
     поэтому два одинаковых прогона её не ловят. Сверяем прогоны с разными семенами. */
  var k = A.codeSkeleton(code);
  var r1 = runOnce(code, stdin, 1), r2 = runOnce(code, stdin, 2);
  if (r1.out !== r2.out ||
      /(^|[^A-Za-z_0-9.])(random|randint|randrange|choice|shuffle|sample|uniform|datetime)(?![A-Za-z_0-9])/.test(k) ||
      /(^|\n)[ \t]*(import|from)[ \t]+time(?![A-Za-z_0-9])/.test(k))
    return refuse("В программе случайность или время",
      "Ответ менялся бы от запуска к запуску, и посчитанный однажды он был бы неправдой. " +
      "Уберите случайность (или возьмите другую программу) — и вопросы появятся.");

  var all = stmtsOf(ast.body, false, []);
  var cands = varCands(code, all), watch = {};
  cands.forEach(function(c){ (watch[c.st.line] = watch[c.st.line] || []).push(c.name); });
  var loops = all.map(function(x){ return x.st; }).filter(function(st){
    return (st.type === "For" || st.type === "While") && st.body && st.body.length && st.body[0].line > st.line; });
  var tr = trace(code, stdin, watch, loops);

  var qs = [];
  var q1 = mutQ(code, stdin, base); if (q1) qs.push(q1);
  if (tr.ok){
    var q2 = loopQ(code, all, tr); if (q2) qs.push(q2);
    var q3 = varQ(code, cands, tr); if (q3) qs.push(q3);
  }
  if (!qs.length)
    return refuse("Посчитать нечего",
      (tr.ok ? "Программа работает, но в ней нет того, о чём здесь спрашивают: " +
               "числа, от которого зависит вывод, цикла, который повторяется, или переменной, которая вычисляется."
             : "Программа слишком долгая для пошагового прогона, а числа, от которого зависит вывод, в ней не нашлось.") +
      (base.turtle && !base.out.trim() ? " Рисунок черепашки спросить текстом нельзя." : ""));
  return { ok: true, qs: qs, out: base.out, code: code, stdin: stdin };
}

/* ---------- сверка ответа ученика ---------- */
function norm(s){
  return String(s == null ? "" : s).replace(/\r\n?/g, "\n").split("\n")
    .map(function(x){ return x.replace(/\s+$/, ""); }).join("\n").replace(/^\n+|\n+$/g, "").replace(/^\s+/, "");
}
function same(got, q){
  var a = norm(got), b = norm(q.a);
  if (a === b) return true;
  /* переменная с текстом: ответ без кавычек тоже верный — кавычки это запись, а не значение */
  if (q.kind === "var" && /^'.*'$/.test(b) && a === b.slice(1, -1)) return true;
  return false;
}

/* ---------- откуда взять свою программу ---------- */
function sources(){
  var xs = [];
  try { xs = A.sources() || []; } catch(e){ xs = []; }
  return xs.slice(0, ZQ_SRC_MAX);
}

/* ---------- экран ---------- */
function honestHTML(){
  return '<div class="card"><h3>⚖️ Честно про защиту</h3><ul class="trrules">' +
    '<li><b>Это не доказательство, а повод поговорить.</b> Кто писал сам, может ошибиться в своём коде; ' +
    'кто взял чужой, может его понять. Не ответил — спросите, как он думал.</li>' +
    '<li><b>Ответы посчитаны, а не угаданы.</b> Программу прогоняет движок Фионики прямо на этом устройстве. ' +
    'ИИ здесь нет, интернет не нужен.</li>' +
    '<li><b>Движок исполняет не весь Python.</b> Вопросов не будет, если программа ждёт ввода, а ответы не ' +
    'вписаны; использует случайность или время; падает с ошибкой; подключает модуль, которого у движка нет; ' +
    'работает слишком долго. Экран скажет, что именно помешало.</li>' +
    '<li><b>Программа никуда не уходит и не сохраняется.</b> О ребёнке здесь не записывается ничего.</li>' +
    '</ul></div>';
}
function modeTabs(){
  /* вкладки — те же, что у раздела экзамена: выбранный режим виден одним взглядом */
  return '<div class="roomnav extabs">' +
    '<button' + (mode === "kid" ? ' class="on"' : '') + ' data-zqmode="kid">🙋 Отвечает ученик</button>' +
    '<button' + (mode === "adult" ? ' class="on"' : '') + ' data-zqmode="adult">👀 Смотрит взрослый</button></div>' +
    '<p class="dim">' + (mode === "kid"
      ? "Ученик отвечает сам: правильные ответы спрятаны до конца."
      : "Вопросы сразу с ответами — задавайте вслух. Python знать не нужно, лист можно распечатать.") + '</p>';
}
function qsKidHTML(made){
  var ch = cur.checked;
  var n = made.qs.length;
  var h = '<div class="card"><h3>🛡 ' + n + ' ' + plural(n, "вопрос", "вопроса", "вопросов") + ' о твоей программе</h3>' +
    '<p class="dim">Не запускай программу — ответь по коду. Так и спрашивают на защите.</p><ol class="zqlist">';
  made.qs.forEach(function(q, i){
    var multi = q.kind === "mut" && !q.one;
    h += '<li><b>' + esc(q.q) + '</b>' +
      (multi ? '<textarea class="zqans" data-zqa="' + i + '" rows="3"></textarea>'
             : '<input class="zqans" data-zqa="' + i + '" type="text" autocomplete="off">') +
      (ch ? '<div class="msg show ' + (ch[i] ? 'ok">✅ Сошлось' : 'bad">🔎 Стоит разобрать') + '</div>' : '') +
      (ch && cur.reveal ? '<div class="docans">Посчитанный ответ:<pre>' + esc(q.a) + '</pre></div>' : '') + '</li>';
  });
  h += '</ol><div class="admrow"><button class="rbtn check" id="zqcheck">Проверить ответы</button>' +
    (ch ? '<button class="rbtn sec" id="zqreveal">Показать ответы</button>' : '') + '</div>';
  if (ch){
    var ok = ch.filter(Boolean).length, bad = [];
    ch.forEach(function(x, i){ if (!x) bad.push(i + 1); });
    h += ok === ch.length
      ? '<div class="msg show ok"><b>Понял свою программу</b>' + (ch.length === 1 ? "Ответ сошёлся" :
          "Все " + ch.length + " " + plural(ch.length, "ответ", "ответа", "ответов") + " сошлись") + ' с прогоном.</div>'
      : '<div class="msg show warn"><b>Стоит разобрать</b>' + (bad.length === 1 ? "Вопрос " : "Вопросы ") +
        bad.join(", ") + '. Это не приговор: пройди эти строки глазами ещё раз или спроси взрослого.</div>';
  }
  return h + '</div>';
}
function qsAdultHTML(made){
  return '<div class="card"><h3>🛡 Вопросы с ответами</h3>' +
    '<p class="dim">Читайте вопрос вслух и не показывайте ответ. Правильный ответ посчитан прогоном программы.</p>' +
    '<ol class="zqlist">' + made.qs.map(function(q){
      return '<li><b>«' + esc(q.q) + '»</b>' +
        '<div class="docans">Правильный ответ:<pre>' + esc(q.a) + '</pre></div>' +
        '<span class="dim">' + esc(q.why) + '</span></li>';
    }).join("") + '</ol>' +
    '<div class="admrow"><button class="rbtn check" id="zqprint">🖨 Лист на печать</button></div></div>';
}
function sheetHTML(made){
  return '<section class="docpage"><div class="dockicker">защита своего кода</div>' +
    '<h1>Вопросы по программе</h1>' +
    '<p class="docnote">Ответы посчитаны движком Фионики прогоном этой программы. Это не доказательство, ' +
    'а повод поговорить: не ответил — спросите, как он думал.</p>' +
    '<pre>' + esc(made.code) + '</pre>' +
    (made.stdin.length ? '<p>Что вводили: ' + esc(made.stdin.join(" · ")) + '</p>' : '') +
    '<ol class="docqs">' + made.qs.map(function(q){
      return '<li><b>' + esc(q.q) + '</b>' +
        '<div class="docans">Правильный ответ:<pre>' + esc(q.a) + '</pre></div>' +
        '<div class="docnote">' + esc(q.why) + '</div>' +
        '<p>Что ответил: <span class="docblank"></span></p></li>';
    }).join("") + '</ol></section>';
}
function resultHTML(){
  var made = cur.made;
  if (!made) return "";
  if (!made.ok) return '<div class="msg show warn zqwhy"><b>' + esc(made.title) + '</b>' + esc(made.text) + '</div>';
  return mode === "kid" ? qsKidHTML(made) : qsAdultHTML(made);
}

function screenZashchita(opts){
  opts = opts || {};
  if (opts.mode === "kid" || opts.mode === "adult") mode = opts.mode;
  if (opts.code !== undefined){
    cur = { code: String(opts.code), stdin: (opts.stdin || []).join("\n"), from: opts.from || "", made: null, checked: null };
    cur.made = make(cur.code, cur.stdin);
  }
  A.enterScreen("train", "zashchita");
  A.setRoute("#zashchita", "Защита своего кода");
  var src = sources();
  var h = '<div class="lvlhead"><div><div class="idx">защита своего кода · без ИИ</div>' +
    '<h1>🛡 Защита своего кода</h1></div></div>' +
    '<p class="lede">До трёх вопросов о программе ученика. Ответы считает движок, прогоняя программу, — угадать их нельзя.</p>' +
    modeTabs() +
    '<div class="card"><h3>📄 Программа</h3>' +
      (cur.from ? '<p class="dim">' + esc(cur.from) + '</p>' : '') +
      '<textarea id="zqcode" class="zqcode" rows="10" spellcheck="false" placeholder="Вставьте программу на Python">' +
        esc(cur.code) + '</textarea>' +
      '<details' + (cur.stdin ? ' open' : '') + '><summary>Что вводить, если программа спрашивает input()</summary>' +
        '<textarea id="zqin" class="zqcode" rows="3" spellcheck="false" placeholder="по одному ответу в строке">' +
        esc(cur.stdin) + '</textarea></details>' +
      '<div class="admrow"><button class="rbtn check" id="zqgo">Задать вопросы</button>' +
        '<button class="rbtn sec" id="zqpick">📂 Взять из урока или проекта</button></div>' +
      '<div id="zqsrc" hidden>' + (src.length
        ? '<ul class="zqsrc">' + src.map(function(x, i){
            return '<li><button class="minibtn" data-zqsrc="' + i + '">' + esc(x.from) + '</button></li>'; }).join("") + '</ul>'
        : '<p class="dim">На этом устройстве своих программ пока нет: сданных уроков, проектов и программ из «Моё». ' +
          'Взрослому — вставить программу ученика, например присланную в мессенджере.</p>') + '</div>' +
    '</div>' +
    '<div id="zqout">' + resultHTML() + '</div>' +
    honestHTML() +
    '<div class="pager"><button class="bigbtn ghost" id="zqback">' +
      (mode === "adult" ? "← " + A.homeLabel() : "← К тренировкам") + '</button></div>';
  A.app.innerHTML = h;

  var $ = function(id){ return document.getElementById(id); };
  function keepInputs(){ cur.code = $("zqcode").value; cur.stdin = $("zqin").value; }
  A.app.querySelectorAll("[data-zqmode]").forEach(function(b){
    b.onclick = function(){ keepInputs(); mode = b.getAttribute("data-zqmode"); cur.checked = null; cur.reveal = false; screenZashchita(); };
  });
  $("zqgo").onclick = function(){
    keepInputs();
    cur.made = make(cur.code, cur.stdin); cur.checked = null; cur.reveal = false; cur.from = "";
    screenZashchita();
  };
  $("zqpick").onclick = function(){ var el = $("zqsrc"); el.hidden = !el.hidden; };
  A.app.querySelectorAll("[data-zqsrc]").forEach(function(b){
    b.onclick = function(){
      var x = src[+b.getAttribute("data-zqsrc")];
      if (x) screenZashchita({ code: x.code, stdin: x.stdin || [], from: x.from });
    };
  });
  var ck = $("zqcheck");
  if (ck) ck.onclick = function(){
    var qs = cur.made.qs;
    cur.checked = qs.map(function(q, i){
      var el = A.app.querySelector('[data-zqa="' + i + '"]');
      return same(el ? el.value : "", q);
    });
    var vals = qs.map(function(q, i){ var el = A.app.querySelector('[data-zqa="' + i + '"]'); return el ? el.value : ""; });
    keepInputs(); screenZashchita();
    vals.forEach(function(v, i){ var el = A.app.querySelector('[data-zqa="' + i + '"]'); if (el) el.value = v; });
  };
  var rv = $("zqreveal");
  if (rv) rv.onclick = function(){
    var vals = [].map.call(A.app.querySelectorAll("[data-zqa]"), function(el){ return el.value; });
    cur.reveal = true; keepInputs(); screenZashchita();
    vals.forEach(function(v, i){ var el = A.app.querySelector('[data-zqa="' + i + '"]'); if (el) el.value = v; });
  };
  var pr = $("zqprint");
  if (pr) pr.onclick = function(){
    var el = $("doc"), box = $("docbox");
    if (!el || !box) return;
    box.innerHTML = sheetHTML(cur.made);
    el.hidden = false; el.scrollTop = 0;
  };
  $("zqback").onclick = function(){ if (mode === "adult") A.goHome(); else A.screenTrain(); };
  A.refreshTop();
}

/* Карточка для кабинетов. Дверь одна на весь продукт — обработчик на документе,
   как у карточки проверки: вешать его в каждом кабинете значит однажды забыть. */
function cardHTML(){
  return '<div class="card"><h3>🛡 Защита своего кода</h3>' +
    '<p>Вставьте программу ученика — получите до трёх вопросов о ней с ответами, посчитанными прогоном: ' +
    '«что напечатает, если…», «сколько раз…», «что будет в переменной…». Python знать не нужно.</p>' +
    '<p class="dim">Не доказательство, а повод поговорить. Без ИИ, программа никуда не уходит.</p>' +
    '<div class="admrow"><button class="rbtn check" data-zqopen="adult">Открыть защиту →</button></div></div>';
}
document.addEventListener("click", function(e){
  var b = e.target && e.target.closest ? e.target.closest("[data-zqopen]") : null;
  if (!b) return;
  screenZashchita({ mode: b.getAttribute("data-zqopen") });
});

return { screenZashchita: screenZashchita, make: make, same: same, cardHTML: cardHTML,
         sheetHTML: sheetHTML, sources: sources };
};
