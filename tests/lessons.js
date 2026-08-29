/* ============================================================
   Проверка уроков. Для каждого урока с контентом:
     1. решение выполняется без ошибок
     2. заготовка:
          type:"code" — выполняется без ошибок
          type:"fix"  — ОБЯЗАНА работать неправильно (иначе чинить нечего)
     3. примеры теории работают; примеры с err:true обязаны падать
     4. если у проверки заданы check.lines — они совпадают с выводом решения
     5. у задания type:"fix" есть symptom и решение отличается от заготовки
   Запуск: node tests/lessons.js
   ============================================================ */
const fs = require("fs");

/* Тот же поиск куска кода, что и в app.js: спецсимволы экранируем,
   границу слова приклеиваем только к латинским краям. */
function codeHas(code, needle){
  const esc = String(needle).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pre = /^[A-Za-z0-9_]/.test(needle) ? "\\b" : "";
  const post = /[A-Za-z0-9_]$/.test(needle) ? "\\b" : "";
  return new RegExp(pre + esc + post).test(code);
}
const path = require("path");
const root = path.join(__dirname, "..");

require(path.join(root, "js/engine-mini.js"));
const MP = globalThis.MiniPy;

/* грузим программу и контент как обычные скрипты */
global.window = global;
global.CONTENT = {};
eval(fs.readFileSync(path.join(root, "js/curriculum.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "js/warmups.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "js/ailab.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "js/projects.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "js/cheatsheet.js"), "utf8"));
fs.readdirSync(path.join(root, "content"))
  .filter(f => /^world\d+\.js$/.test(f))
  .forEach(f => eval(fs.readFileSync(path.join(root, "content", f), "utf8")));

/* тот же счётчик правок, что и в игре: одна переписанная строка = 2 единицы */
function codeLines(src){
  return String(src === null || src === undefined ? "" : src).split("\n")
    .map(s => s.replace(/\s+$/, ""))
    .filter(s => { const t = s.trim(); return t !== "" && t[0] !== "#"; });
}
function lcsLen(A, B){
  let prev = new Array(B.length + 1).fill(0), cur;
  for (let i = 1; i <= A.length; i++){
    cur = new Array(B.length + 1).fill(0);
    for (let j = 1; j <= B.length; j++)
      cur[j] = A[i-1] === B[j-1] ? prev[j-1] + 1 : Math.max(prev[j], cur[j-1]);
    prev = cur;
  }
  return prev[B.length];
}
function editUnits(a, b){
  const A = codeLines(a), B = codeLines(b);
  return A.length + B.length - 2 * lcsLen(A, B);
}
/* файлы урока: {"tools.py": "..."} — отдельно для заготовки и для решения */
function starterSources(task){
  const out = {};
  (task.files || []).forEach(f => { out[f.name] = f.starter; });
  return out;
}
function solutionSources(task){
  const out = {};
  (task.files || []).forEach(f => { out[f.name] = f.solution !== undefined ? f.solution : f.starter; });
  return out;
}
/* файлы с данными: у каждого запуска своя копия */
function dataOf(src){
  const out = {};
  if (src) for (const k in src) out[k] = src[k];
  return out;
}
function drawingKey(segs){
  return segs.map(s => [Math.round(s.x1), Math.round(s.y1), Math.round(s.x2), Math.round(s.y2)]
    .join(",")).sort().join(";");
}

let problems = 0, lessons = 0, demos = 0, fixes = 0;
const say = m => { problems++; console.log(m); };

/* Каждый мир обязан назвать движок явно. Раньше у Мира 5 поля engine не было:
   уроки получали engine: undefined и молча падали в mini через фолбэк
   Runtime.get(). Работало верно, но неявно — а когда подключат Pyodide, именно
   в таком мире и не заметят, что движок выбран не тем, кем думали.
   Список известных имён читаем из самого runtime.js, чтобы тест не разошёлся
   с движком. */
{
  const rt = fs.readFileSync(path.join(root, "js/runtime.js"), "utf8");
  const known = (rt.match(/name:\s*"([^"]+)"/g) || [])
    .map(m => m.replace(/name:\s*"([^"]+)"/, "$1"));
  if (!known.length) say("[схема] в js/runtime.js не нашлось ни одного адаптера — тест ослеп");
  CURRICULUM.forEach(w => {
    if (!w.engine) say(`[схема] мир ${w.n}: не указан engine — движок выберется неявно`);
    else if (w.engine !== "mixed" && known.indexOf(w.engine) < 0)
      say(`[схема] мир ${w.n}: engine «${w.engine}» не зарегистрирован в runtime.js`);
    w.lessons.forEach(l => {
      if (l.engine && l.engine !== "mixed" && known.indexOf(l.engine) < 0)
        say(`[схема] ${l.id}: engine «${l.engine}» не зарегистрирован в runtime.js`);
    });
  });
}

CURRICULUM.forEach(w => {
  const c = CONTENT["world" + w.n];
  if (!c) return;
  w.lessons.forEach(l => {
    const body = c[l.id];
    if (!body) return;
    lessons++;
    const task = body.task;
    const isFix = task.type === "fix";
    if (isFix) fixes++;

    if (!task.type) say(`[схема] ${l.id}: у задания не указан type`);
    /* input() без заранее записанных ответов упадёт на первом же вызове */
    const usesInput = /\binput\s*\(/.test(task.solution + "\n" + task.starter);
    if (usesInput && !(task.stdin && task.stdin.length))
      say(`[схема] ${l.id}: в задании есть input(), но нет списка ответов task.stdin`);
    if (task.stdin && !usesInput)
      say(`[схема] ${l.id}: задан task.stdin, но input() в задании не вызывается`);
    body.theory.forEach((t, i) => {
      if (t.demo && /\binput\s*\(/.test(t.demo) && !(t.stdin && t.stdin.length))
        say(`[схема] ${l.id}: в примере ${i+1} есть input(), но нет t.stdin`);
    });
    (task.files || []).forEach(f => {
      if (!f.name || !/^[a-z_][a-z0-9_]*\.py$/.test(f.name))
        say(`[схема] ${l.id}: имя файла «${f.name}» не годится для import (нужно вроде tools.py)`);
      if (f.starter === undefined) say(`[схема] ${l.id}: у файла ${f.name} нет starter`);
    });

    /* 1. решение */
    const solSrc = solutionSources(task), stSrc = starterSources(task);
    const answers = task.stdin || [];
    const sol = MP.run(task.solution, { turtle: new MP.Turtle(), sources: solSrc, files: dataOf(task.data), stdin: answers });
    if (sol.error) say(`[решение] ${l.id}: ${sol.error.kind} — ${sol.error.msg}`);

    /* 2. заготовка */
    const st = MP.run(task.starter, { turtle: new MP.Turtle(), sources: stSrc, files: dataOf(task.data), stdin: answers });
    if (!isFix){
      if (st.error) say(`[заготовка] ${l.id}: ${st.error.kind} — ${st.error.msg}`);
    } else {
      const brokenByError = !!st.error;
      let brokenByResult = false;
      if (!brokenByError && !sol.error){
        brokenByResult = task.check.kind === "turtle"
          ? drawingKey(st.turtle.segs) !== drawingKey(sol.turtle.segs)
          : st.output !== sol.output;
      }
      if (!brokenByError && !brokenByResult)
        say(`[заготовка] ${l.id}: задание «починить», но заготовка работает правильно — чинить нечего`);
      if (!task.symptom)
        say(`[схема] ${l.id}: у задания «починить» нет поля symptom`);
      const units = editUnits(task.starter, task.solution);
      if (units < 2)
        say(`[схема] ${l.id}: решение не отличается от заготовки (${units} правок)`);
      if (units > 8)
        say(`[схема] ${l.id}: между заготовкой и решением ${units} правок — это уже не «одна поломка»`);
    }

    /* 3. примеры теории */
    body.theory.forEach((t, i) => {
      /* карточка может показывать код без запуска (t.show) — тогда demo нет */
      if (!t.demo){
        if (!t.show) say(`[пример ${i+1}] ${l.id}: в карточке нет ни demo, ни show`);
        if (t.err) say(`[пример ${i+1}] ${l.id}: err:true без demo — падать нечему`);
        return;
      }
      demos++;
      const r = MP.run(t.demo, { turtle: new MP.Turtle(), sources: t.files || {}, files: dataOf(t.data), stdin: t.stdin || [] });
      if (r.error && !t.err)
        say(`[пример ${i+1}] ${l.id}: ${r.error.kind} — ${r.error.msg}`);
      if (!r.error && t.err)
        say(`[пример ${i+1}] ${l.id}: помечен err:true, но ошибки нет`);
    });

    /* 3.5. скрытые тесты: каждый вызов обязан что-то возвращать на эталоне,
       и заготовка обязана их НЕ проходить — иначе задания нет */
    if (task.check.kind === "tests"){
      if (!Array.isArray(task.check.calls) || !task.check.calls.length)
        say(`[схема] ${l.id}: проверка «tests» без списка calls`);
      else {
        let starterPasses = 0;
        task.check.calls.forEach(call => {
          const probe = "\nprint(repr(" + call + "))\n";
          const w = MP.run(task.solution + probe, { sources: solSrc, files: dataOf(task.data), stdin: answers });
          if (w.error)
            say(`[tests] ${l.id}: вызов ${call} на решении падает — ${w.error.kind}: ${w.error.msg}`);
          const g = MP.run(task.starter + probe, { sources: stSrc, files: dataOf(task.data), stdin: answers });
          if (!g.error && g.lines[g.lines.length - 1] === w.lines[w.lines.length - 1]) starterPasses++;
        });
        if (starterPasses === task.check.calls.length)
          say(`[tests] ${l.id}: заготовка проходит все скрытые проверки — задание нечего решать`);
      }
    }

    /* 3.7. Эталон обязан проходить собственные требования.
       Иначе получается урок, который не решается даже правильным ответом:
       так уже ловилась опечатка в needCode и сломанное регулярное выражение. */
    const chk = task.check || {};
    /* эталон = главный файл плюс все подключённые: требования могут
       относиться к любому файлу задания */
    let эталонВесь = task.solution;
    (task.files || []).forEach(f => {
      эталонВесь += "\n" + (f.solution !== undefined ? f.solution : f.starter);
    });
    (chk.needCode || []).forEach(needle => {
      let ok;
      try { ok = codeHas(эталонВесь, needle); }
      catch (e){ say(`[схема] ${l.id}: needCode «${needle}» не превращается в поиск — ${e.message}`); return; }
      if (!ok) say(`[схема] ${l.id}: needCode требует «${needle}», а в эталонном решении этого нет`);
    });
    (chk.noCode || []).forEach(needle => {
      let bad2;
      try { bad2 = codeHas(эталонВесь, needle); }
      catch (e){ say(`[схема] ${l.id}: noCode «${needle}» не превращается в поиск — ${e.message}`); return; }
      if (bad2) say(`[схема] ${l.id}: noCode запрещает «${needle}», а эталонное решение это использует`);
    });
    (chk.needText || []).forEach(needle => {
      if (эталонВесь.indexOf(needle) < 0)
        say(`[схема] ${l.id}: needText требует «${needle}», а в эталонном решении этого нет`);
    });
    if ((chk.needCode || chk.needText) && !chk.needMsg)
      say(`[схема] ${l.id}: есть needCode/needText, но нет needMsg — ученик не поймёт, чего от него хотят`);

    /* Подсказки обязательны, как у разминок, «Ты и ИИ» и проектов. Кнопка
       «Подсказка» есть на каждом уроке, и урок без hints ей нечего показать. */
    if (!Array.isArray(task.hints) || !task.hints.length)
      say(`[схема] ${l.id}: нет подсказок (hints) — кнопке «Подсказка» нечего показать`);

    /* 4. check.lines против настоящего вывода решения */
    if (task.check.kind === "output" && task.check.lines && !sol.error){
      const exp = task.check.lines, got = sol.lines;
      const same = exp.length === got.length && exp.every((x, i) => x === got[i]);
      if (!same)
        say(`[check.lines] ${l.id}: не совпадает с выводом решения\n    задано:  ${JSON.stringify(exp)}\n    решение: ${JSON.stringify(got)}`);
    }
  });
});

/* ===== разминки «угадай вывод» (predict) =====
   Правильный ответ ребёнку — это вывод программы, поэтому программа
   обязана запускаться без ошибок и что-то печатать. Плюс проверяем,
   что заполнены поля, без которых карточка развалится. */
let warmups = 0;
const seenIds = {};
/* кадры пошагового прогона — то же, что vizRecord() в игре: по кадру на
   строку, с именами переменных из снимка кучи */
function memFrames(code){
  let st;
  try { st = MP.stepper(code, {}); } catch (e){ return []; }
  const idMap = new Map(), skip = st.interp && st.interp.builtinNames, out = [];
  for (let g = 0; g < 5000; g++){
    const s = st.next();
    if (s.error || s.done) break;
    const hs = MP.heapSnapshot(s.env, idMap, skip, s.stack || []);
    out.push({ line: s.line, vars: hs.vars, objects: hs.objects });
  }
  return out;
}
(global.WARMUPS || []).forEach(w => {
  warmups++;
  const id = w.id || "(без id)";
  if (!w.id) say(`[разминка] у разминки нет id`);
  else if (seenIds[w.id]) say(`[разминка] ${id}: повтор id`);
  seenIds[w.id] = 1;
  if (!["predict", "blocks", "memory"].includes(w.type))
    say(`[разминка] ${id}: type должен быть predict/blocks/memory, а он «${w.type}»`);
  ["title", "emoji", "tag", "intro", "brief", "code", "note"].forEach(f => {
    if (!w[f] || !String(w[f]).trim()) say(`[разминка] ${id}: пустое поле «${f}»`);
  });
  if (!Array.isArray(w.hints) || !w.hints.length)
    say(`[разминка] ${id}: нет подсказок (hints)`);
  const r = MP.run(w.code || "", { stdin: [] });
  if (r.error) say(`[разминка] ${id}: программа падает — ${r.error.kind}: ${r.error.msg}`);
  else if (!r.output || !r.output.trim())
    say(`[разминка] ${id}: программа ничего не печатает — предсказывать нечего`);
  /* «собери из блоков»: из одной-двух строк собирать нечего */
  if (w.type === "blocks"){
    const lines = String(w.code || "").split("\n").filter(s => s.trim() !== "");
    if (lines.length < 3)
      say(`[разминка] ${id}: в blocks всего ${lines.length} строк — собирать нечего, нужно ≥3`);
  }

  /* «предскажи память»: правильный ответ не записан в задании, его считает
     пошаговый прогон. Значит проверять надо не ответ, а саму постановку:
     строка stop обязана выполниться РОВНО ОДИН раз (иначе «здесь» значит
     разное), а все переменные из ask обязаны в этот момент существовать. */
  if (w.type === "memory"){
    const stop = w.stop;
    if (typeof stop !== "number" || stop < 1)
      return say(`[разминка] ${id}: у memory нет номера строки stop`);
    if (!Array.isArray(w.ask) || !w.ask.length)
      return say(`[разминка] ${id}: у memory нет списка переменных ask`);
    const src = String(w.code).replace(/\n+$/, "").split("\n");
    if (stop > src.length)
      return say(`[разминка] ${id}: stop = ${stop}, а в программе ${src.length} строк`);
    if (!src[stop - 1].trim() || src[stop - 1].trim()[0] === "#")
      say(`[разминка] ${id}: строка ${stop} пустая или комментарий — на ней не замереть`);

    const frames = memFrames(w.code);
    const hits = frames.filter(f => f.line === stop);
    if (hits.length !== 1)
      return say(`[разминка] ${id}: строка ${stop} выполняется ${hits.length} раз, а должна ровно один — ` +
                 `иначе «замерли здесь» значит разное`);
    const seenName = {};
    w.ask.forEach(n => {
      if (seenName[n]) say(`[разминка] ${id}: переменная «${n}» в ask дважды`);
      seenName[n] = 1;
      if (!hits[0].vars.filter(v => v.name === n).length)
        say(`[разминка] ${id}: переменной «${n}» на строке ${stop} ещё не существует`);
    });
  }
});

/* ===== раздел «Ты и ИИ» (predict / code / fix) =====
   Гибрид механик разминок и уроков, поэтому и проверки гибридные:
   у всех — общие поля; predict обязан запускаться и печатать; code —
   заготовка и решение работают; fix — заготовка СЛОМАНА, решение работает,
   есть symptom, решение отличается на 2..8 правок; needCode проходит эталон. */
let ailab = 0;
const seenAI = {};
(global.AILAB || []).forEach(x => {
  ailab++;
  const id = x.id || "(без id)";
  if (!x.id) say(`[ты-и-ии] у задания нет id`);
  else if (seenAI[x.id]) say(`[ты-и-ии] ${id}: повтор id`);
  seenAI[x.id] = 1;
  if (!["predict", "code", "fix", "review", "catch"].includes(x.type))
    say(`[ты-и-ии] ${id}: type должен быть predict/code/fix/review/catch, а он «${x.type}»`);
  ["title", "emoji", "tag", "intro", "brief", "note"].forEach(f => {
    if (!x[f] || !String(x[f]).trim()) say(`[ты-и-ии] ${id}: пустое поле «${f}»`);
  });
  if (!Array.isArray(x.hints) || !x.hints.length)
    say(`[ты-и-ии] ${id}: нет подсказок (hints)`);

  if (x.type === "predict"){
    if (!x.code || !x.code.trim()) return say(`[ты-и-ии] ${id}: у predict нет code`);
    const r = MP.run(x.code, { stdin: [] });
    if (r.error) say(`[ты-и-ии] ${id}: программа падает — ${r.error.kind}: ${r.error.msg}`);
    else if (!r.output || !r.output.trim())
      say(`[ты-и-ии] ${id}: программа ничего не печатает — предсказывать нечего`);
    return;
  }

  /* catch: «докажи, что код ИИ неправ». Единственного правильного ответа нет —
     годится любая проверка, разводящая две версии. Поэтому проверять надо не
     ответ ребёнка, а САМУ ЗАДАЧУ: она обязана быть решаемой и честной.

     Два требования, и оба существенные:
       run(code) === run(truth)                  баг СПРЯТАН за примером автора.
         Иначе задания нет: расхождение видно сразу, ничего искать не нужно.
       run(code+probe) !== run(truth+probe)      поймать вообще возможно.
         probe — эталонная проверка; она не сверяется с ответом ребёнка,
         а доказывает, что решение существует. */
  if (x.type === "catch"){
    for (const f of ["claim", "code", "truth", "probe"])
      if (x[f] === undefined || !String(x[f]).trim())
        return say(`[ты-и-ии] ${id}: у catch нет поля «${f}»`);
    if (String(x.code).trim() === String(x.truth).trim())
      return say(`[ты-и-ии] ${id}: truth дословно совпал с code — ловить нечего`);

    const out = src => {
      const r = MP.run(src, { stdin: [] });
      return r.error ? "!" + r.error.kind + ": " + r.error.msg : r.output;
    };
    const own = out(x.code), tru = out(x.truth);
    if (tru.startsWith("!"))
      return say(`[ты-и-ии] ${id}: правильная версия (truth) падает — ${tru.slice(1)}`);
    if (!own.trim())
      say(`[ты-и-ии] ${id}: код ИИ ничего не печатает — запускать его бессмысленно`);
    if (own !== tru)
      say(`[ты-и-ии] ${id}: код ИИ расходится с правильным уже на своём примере — ` +
          `тогда искать нечего, это review, а не catch`);

    const mineP = out(x.code + "\n" + x.probe), truP = out(x.truth + "\n" + x.probe);
    if (truP.startsWith("!"))
      say(`[ты-и-ии] ${id}: эталонная проверка падает на правильной версии — ${truP.slice(1)}`);
    else if (mineP === truP)
      say(`[ты-и-ии] ${id}: эталонная проверка ничего не ловит — задание нерешаемо`);

    /* заготовка редактора обязана быть «кодом ИИ плюс место для проверки»:
       по ней игра отличает, что дописал ребёнок, а что было дано */
    if (x.badLine !== undefined)
      say(`[ты-и-ии] ${id}: badLine у catch не нужен — тут не тыкают в строку, а доказывают`);
    return;
  }

  /* review: «вынеси вердикт». Правильный ответ тут не объявляют, а ВЫЧИСЛЯЮТ
     запуском — иначе содержание могло бы врать ребёнку, и никто бы не заметил.
     Считаем ровно так же, как reviewTruth() в app.js: вывод кода от ИИ против
     вывода правильной версии, сначала на примере автора, потом с probe. */
  if (x.type === "review"){
    for (const f of ["claim", "code", "truth", "probe", "verdict"])
      if (x[f] === undefined || !String(x[f]).trim())
        return say(`[ты-и-ии] ${id}: у review нет поля «${f}»`);
    if (!["ok", "wrong", "partly"].includes(x.verdict))
      return say(`[ты-и-ии] ${id}: verdict должен быть ok/wrong/partly, а он «${x.verdict}»`);
    if (String(x.code).trim() === String(x.truth).trim())
      say(`[ты-и-ии] ${id}: truth дословно совпал с code — тогда он ничего не проверяет`);

    const out = src => {
      const r = MP.run(src, { stdin: [] });
      return r.error ? "!" + r.error.kind + ": " + r.error.msg : r.output;
    };
    const tr = MP.run(x.truth, { stdin: [] });
    if (tr.error)
      say(`[ты-и-ии] ${id}: правильная версия (truth) падает — ${tr.error.kind}: ${tr.error.msg}`);
    else if (!tr.output || !tr.output.trim())
      say(`[ты-и-ии] ${id}: truth ничего не печатает — сравнивать будет нечего`);
    const trProbe = MP.run(x.truth + "\n" + x.probe, { stdin: [] });
    if (trProbe.error)
      say(`[ты-и-ии] ${id}: truth с probe падает — ${trProbe.error.kind}: ${trProbe.error.msg}`);
    else if (trProbe.output === tr.output)
      say(`[ты-и-ии] ${id}: probe ничего не добавил к выводу — проверка пустая`);

    const own  = out(x.code) !== out(x.truth);
    const wide = out(x.code + "\n" + x.probe) !== out(x.truth + "\n" + x.probe);
    const real = own ? "wrong" : (wide ? "partly" : "ok");
    if (real !== x.verdict)
      say(`[ты-и-ии] ${id}: в записи verdict «${x.verdict}», а по запуску выходит «${real}» — содержание врёт ребёнку`);

    if (real === "ok"){
      if (x.badLine !== undefined)
        say(`[ты-и-ии] ${id}: код верный, а badLine указан — тыкать будет некуда`);
      return;
    }

    /* badLine мы не принимаем на слово: и содержание, и игра сверяются с одним
       и тем же числом, так что неверный номер прошёл бы незамеченным. Поэтому
       выводим его сами — из разницы между кодом ИИ и правильной версией. Заодно
       это требует, чтобы поломка была ОДНА: иначе у ребёнка два правильных
       ответа, а игра примет только один. */
    const rstrip = t => String(t).replace(/\n+$/, "").split("\n").map(v => v.replace(/\s+$/, ""));
    const cl = rstrip(x.code), tl = rstrip(x.truth);
    let diff = [];
    if (cl.length === tl.length){
      cl.forEach((t, i) => { if (t !== tl[i]) diff.push(i + 1); });
    } else {
      cl.forEach((t, i) => { if (t.trim() && tl.indexOf(t) < 0) diff.push(i + 1); });
    }
    if (typeof x.badLine !== "number")
      say(`[ты-и-ии] ${id}: код неверный, а badLine не указан`);
    else if (x.badLine < 1 || x.badLine > cl.length)
      say(`[ты-и-ии] ${id}: badLine ${x.badLine} вне кода (строк всего ${cl.length})`);
    else if (!cl[x.badLine - 1].trim())
      say(`[ты-и-ии] ${id}: badLine ${x.badLine} — пустая строка, в неё нельзя ткнуть`);
    if (diff.length !== 1)
      say(`[ты-и-ии] ${id}: код ИИ и правильная версия расходятся в ${diff.length} строках (${diff.join(", ") || "ни в одной"}) — поломка должна быть одна, иначе верных ответов несколько`);
    else if (typeof x.badLine === "number" && diff[0] !== x.badLine)
      say(`[ты-и-ии] ${id}: badLine указывает на строку ${x.badLine}, а с правильной версией расходится строка ${diff[0]}`);
    return;
  }

  /* code / fix */
  if (x.starter === undefined || x.solution === undefined)
    return say(`[ты-и-ии] ${id}: у ${x.type} нужны starter и solution`);
  const sol = MP.run(x.solution, { stdin: [] });
  if (sol.error) say(`[ты-и-ии] ${id}: решение падает — ${sol.error.kind}: ${sol.error.msg}`);
  const st = MP.run(x.starter, { stdin: [] });
  if (x.type === "code"){
    if (st.error) say(`[ты-и-ии] ${id}: заготовка (code) должна запускаться, а падает — ${st.error.kind}: ${st.error.msg}`);
  } else {
    const brokenByError = !!st.error;
    const brokenByResult = !brokenByError && !sol.error && st.output !== sol.output;
    if (!brokenByError && !brokenByResult)
      say(`[ты-и-ии] ${id}: задание «починить», а заготовка уже работает правильно — чинить нечего`);
    if (!x.symptom) say(`[ты-и-ии] ${id}: у «починить» нет поля symptom`);
    const units = editUnits(x.starter, x.solution);
    if (units < 2) say(`[ты-и-ии] ${id}: решение почти не отличается от заготовки (${units} правок)`);
    if (units > 8) say(`[ты-и-ии] ${id}: между заготовкой и решением ${units} правок — это уже не «одна поломка»`);
    if (x.fixBudget !== undefined && x.fixBudget < units)
      say(`[ты-и-ии] ${id}: fixBudget ${x.fixBudget} меньше, чем правок в самом решении (${units}) — эталон не пройдёт бюджет`);
  }
  (x.needCode || []).forEach(needle => {
    let ok; try { ok = codeHas(x.solution, needle); }
    catch (e){ say(`[ты-и-ии] ${id}: needCode «${needle}» не превращается в поиск — ${e.message}`); return; }
    if (!ok) say(`[ты-и-ии] ${id}: needCode требует «${needle}», а в решении этого нет`);
  });
  if (x.needCode && !x.needMsg)
    say(`[ты-и-ии] ${id}: есть needCode, но нет needMsg — ученик не поймёт, чего от него хотят`);
});

/* ===== проекты в конце мира =====
   Проект — многошаговое задание, где каждый шаг достраивает ОДНУ программу.
   Отсюда и проверки: solution каждого шага обязан работать и что-то печатать;
   заготовка первого шага обязана запускаться (ребёнок жмёт «Запустить» и видит
   работающую программу), но НЕ проходить проверку — иначе задания нет;
   каждый следующий шаг обязан менять вывод, иначе шаг пустой. */
let projects = 0, psteps = 0;
const seenPR = {};
(global.PROJECTS || []).forEach(p => {
  projects++;
  const id = p.id || "(без id)";
  if (!p.id) say(`[проект] у проекта нет id`);
  else if (seenPR[p.id]) say(`[проект] ${id}: повтор id`);
  seenPR[p.id] = 1;
  ["title", "emoji", "tagline", "intro", "finale"].forEach(f => {
    if (!p[f] || !String(p[f]).trim()) say(`[проект] ${id}: пустое поле «${f}»`);
  });
  /* 0 — проект вне миров: у него нет карты мира, он живёт в своём разделе */
  if (typeof p.world !== "number" || p.world < 0 || p.world > 5)
    say(`[проект] ${id}: world должен быть числом 0..5, а он «${p.world}»`);
  if (!Array.isArray(p.steps) || p.steps.length < 2)
    return say(`[проект] ${id}: у проекта должно быть хотя бы два шага`);

  let prevOut = null;
  p.steps.forEach((step, i) => {
    psteps++;
    const tag = `[проект] ${id} · шаг ${i + 1}`;
    ["title", "brief", "solution"].forEach(f => {
      if (!step[f] || !String(step[f]).trim()) say(`${tag}: пустое поле «${f}»`);
    });
    if (!Array.isArray(step.hints) || !step.hints.length) say(`${tag}: нет подсказок (hints)`);
    if (i === 0 && (step.starter === undefined || !String(step.starter).trim()))
      say(`${tag}: у первого шага обязан быть starter`);

    const sol = MP.run(step.solution || "", { stdin: [] });
    if (sol.error) return say(`${tag}: решение падает — ${sol.error.kind}: ${sol.error.msg}`);
    if (!sol.output || !sol.output.trim()) say(`${tag}: решение ничего не печатает`);
    if (prevOut !== null && sol.output === prevOut)
      say(`${tag}: вывод не отличается от прошлого шага — шаг ничего не добавляет`);
    prevOut = sol.output;

    /* Заготовка обязательна у первого шага. У остальных она НЕ обязательна, но
       бывает: так устроен проект с ИИ-напарником, где шаг начинается не с кода
       ребёнка, а с новой редакции от напарника. Требования к ней те же —
       запускается и проверку НЕ проходит, иначе шага нет. */
    if (step.starter !== undefined){
      const st = MP.run(step.starter, { stdin: [] });
      if (st.error) say(`${tag}: заготовка обязана запускаться, а падает — ${st.error.kind}: ${st.error.msg}`);
      else if (st.output === sol.output) say(`${tag}: заготовка уже даёт верный вывод — задания нет`);
      /* редакция напарника обязана отличаться от того, что было на прошлом шаге:
         иначе «он переписал программу» — неправда */
      if (i > 0 && st.output === prevOut)
        say(`${tag}: заготовка шага повторяет вывод прошлого шага — переписывать было нечего`);
    }
    (step.needCode || []).forEach(needle => {
      let ok; try { ok = codeHas(step.solution, needle); }
      catch (e){ say(`${tag}: needCode «${needle}» не превращается в поиск — ${e.message}`); return; }
      if (!ok) say(`${tag}: needCode требует «${needle}», а в решении этого нет`);
    });
    if (step.needCode && !step.needMsg)
      say(`${tag}: есть needCode, но нет needMsg — ученик не поймёт, чего от него хотят`);
  });
});

/* Требование, положенное не туда, молча ничего не делает.
   needCode / noCode / needText / needMsg живут ВНУТРИ объекта check — именно
   оттуда их читает runCheck. Написанные на уровне task они не ломают ничего
   и не проверяют ничего: урок выглядит защищённым, а защиты нет. Я сам так
   ошибся, добавляя needCode уроку 6, и заметил это только сторонним
   инструментом (tests/bypass-check.js). */
CURRICULUM.forEach(w => (w.lessons || []).forEach(l => {
  const body = (CONTENT["world" + w.n] || {})[l.id];
  if (!body || !body.task) return;
  ["needCode", "noCode", "needText", "needMsg", "noMsg"].forEach(f => {
    if (body.task[f] !== undefined)
      say(`[схема] ${l.id}: «${f}» стоит на уровне task, а читается только из task.check — перенеси внутрь check`);
  });
}));

/* ПОРЯДОК ОБЪЯСНЕНИЙ.
   Тесты проверяют, что код урока работает, и не проверяют, что ребёнку было
   откуда его узнать. Так в курс дважды попадал один и тот же дефект: решение
   задания требует команду, которую нигде не показывали. `.title()` в уроке 7
   назывался только в третьей подсказке — то есть за звезду; `isinstance`
   стоял в решении сотого урока, а объяснения не было вовсе.

   Правило: если конструкция стоит в решении (или заготовке) задания, она
   обязана быть либо показана в примере ЭТОГО или любого более раннего урока,
   либо названа словами в тексте урока или в условии задания.

   ПОДСКАЗКИ НЕ СЧИТАЮТСЯ. Сначала я их засчитал — и проверка честно прошла на
   том самом дефекте, ради которого писалась: `.title()` в уроке 7 назван в
   третьей подсказке, и этого хватило, чтобы тест промолчал. Но за подсказку
   снимается звезда, то есть узнать команду можно только заплатив. Бесплатны
   теория, условие задания и симптом у «починить» — они и считаются.

   Список токенов ниже не полный и полным быть не может — он покрывает
   встроенные функции и методы, то есть ровно то, что «берётся из ниоткуда».
   Границы имени обязательны: поиск по подстроке ловит apply_all внутри all(
   и уже однажды дал ложный вывод. */
const W_ID = "A-Za-z_0-9А-Яа-яЁё";
const AUDIT_CALLS = ["print","len","range","int","str","float","round","abs","min","max","sum","sorted",
  "list","dict","set","tuple","type","isinstance","any","all","zip","enumerate","reversed","input",
  "open","super","repr","map","filter","divmod","pow","bool","next","iter","hasattr","getattr","vars","dir"];
const AUDIT_METHODS = ["append","pop","remove","insert","index","count","sort","reverse","extend","clear",
  "upper","lower","strip","split","join","replace","startswith","endswith","find","title","capitalize",
  "get","items","keys","values","setdefault","update","add","discard","union","difference","read","write",
  "readlines","readline","strftime","copy","isdigit","isalpha","format","rstrip","lstrip","splitlines","zfill"];
const noTags = x => String(x || "").replace(/<[^>]*>/g, " ");
const shownBefore = new Set();
/* ---------- разметка в тексте урока ----------
   Текст урока попадает на страницу как HTML. Значит любой тег в нём браузер
   исполнит, а не покажет. Для <b> и <code> это и нужно, а вот <p> в условии
   урока про Flask — это КОД, который ребёнок обязан вернуть из функции:
   «вернуть «<p>Ошибки: »». Браузер съедал тег, и ребёнок видел условие без
   того самого, что от него требовалось. Так было в трёх уроках пятого мира.

   Правило: в тексте урока разрешены только теги оформления. Всё остальное —
   это литерал, и его надо писать через &lt; и &gt;. */
const РАЗМЕТКА = new Set(["b", "/b", "i", "/i", "code", "/code", "br",
                          "u", "/u", "em", "/em", "strong", "/strong"]);
CURRICULUM.forEach(w => (w.lessons || []).forEach(l => {
  const body = (CONTENT["world" + w.n] || {})[l.id];
  if (!body) return;
  const куски = [["лид", body.lede], ["цель", body.task && body.task.goal],
                 ["симптом", body.task && body.task.symptom]]
    .concat((body.theory || []).map((t, i) => ["теория " + (i + 1), t.h + " " + t.p + " " + (t.showNote || "")]))
    .concat(((body.task && body.task.list) || []).map((x, i) => ["требование " + (i + 1), x]))
    .concat(((body.task && body.task.hints) || []).map((x, i) => ["подсказка " + (i + 1), x]));
  куски.forEach(([где, txt]) => {
    if (!txt) return;
    (String(txt).match(/<\/?[a-zA-Z][^>]*>/g) || []).forEach(tag => {
      const имя = tag.replace(/[<>]/g, "").split(/[\s/]/).filter(Boolean)[0];
      if (!РАЗМЕТКА.has((tag[1] === "/" ? "/" : "") + имя))
        say(`[разметка] урок ${l.num} ${l.id}, ${где}: тег ${tag} браузер исполнит, а не покажет — пиши &lt; и &gt;`);
    });
  });
}));

let auditLessons = 0;

CURRICULUM.forEach(w => (w.lessons || []).forEach(l => {
  const body = (CONTENT["world" + w.n] || {})[l.id];
  if (!body || !body.task) return;
  auditLessons++;
  const theoryCode = (body.theory || [])
    .map(t => [t.demo, t.show].filter(Boolean).join("\n")).join("\n");
  const words = noTags(body.lede) + " " +
    (body.theory || []).map(t => noTags(t.h) + " " + noTags(t.p)).join(" ") + " " +
    noTags(body.task.goal) + " " + noTags((body.task.list || []).join(" ")) + " " +
    noTags(body.task.symptom);
  const answer = [body.task.solution, body.task.starter].filter(Boolean).join("\n") + "\n" +
    (body.task.files || []).map(f => [f.solution, f.starter].filter(Boolean).join("\n")).join("\n");

  const audit = (tok, re) => {
    if (!re.test(answer)) return;
    if (re.test(theoryCode)) return;                       /* показано в этом уроке */
    if (new RegExp("(^|[^" + W_ID + "])" + tok.replace(".", "\\.?") + "\\b").test(words)) return;  /* названо словами */
    if (shownBefore.has(tok)) return;                      /* показывали раньше */
    say(`[порядок] урок ${l.num} ${l.id}: «${tok}» нужен в решении, но его не показывали ни здесь, ни раньше`);
  };
  AUDIT_CALLS.forEach(n => audit(n, new RegExp("(^|[^" + W_ID + "\\.])" + n + "\\s*\\(")));
  AUDIT_METHODS.forEach(n => audit("." + n, new RegExp("\\." + n + "\\s*\\(")));

  AUDIT_CALLS.forEach(n => {
    if (new RegExp("(^|[^" + W_ID + "\\.])" + n + "\\s*\\(").test(theoryCode)) shownBefore.add(n);
  });
  AUDIT_METHODS.forEach(n => {
    if (new RegExp("\\." + n + "\\s*\\(").test(theoryCode)) shownBefore.add("." + n);
  });
}));

/* Шпаргалка. Вывод примеров нигде не хранится — его считает движок в момент
   показа, поэтому «неверного ответа» тут быть не может. Зато может быть
   пример, который падает, молчит или ссылается на несуществующий урок:
   ребёнок открыл бы справочник и увидел ошибку вместо объяснения. */
let sheetItems = 0;
const seenCS = {};
(global.CHEATSHEET || []).forEach(g => {
  if (!g.group || !String(g.group).trim()) say("[шпаргалка] группа без названия");
  if (!Array.isArray(g.items) || !g.items.length)
    return say(`[шпаргалка] в группе «${g.group}» нет записей`);
  g.items.forEach(it => {
    sheetItems++;
    const tag = `[шпаргалка] ${it.id || "(без id)"}`;
    ["id", "sig", "what", "code", "lesson"].forEach(f => {
      if (!it[f] || !String(it[f]).trim()) say(`${tag}: пустое поле «${f}»`);
    });
    if (seenCS[it.id]) say(`${tag}: повтор id`);
    seenCS[it.id] = 1;
    if (!CURRICULUM.byId(it.lesson))
      say(`${tag}: ссылается на урок «${it.lesson}», а такого урока нет`);
    const r = MP.run(it.code || "", { stdin: [], files: it.data ? JSON.parse(JSON.stringify(it.data)) : {} });
    if (r.error) say(`${tag}: пример падает — ${r.error.kind}: ${r.error.msg}`);
    else if (!r.output || !r.output.trim()) say(`${tag}: пример ничего не печатает`);
  });
});

console.log(`\nуроков проверено: ${lessons} (из них «починить»: ${fixes}), примеров: ${demos}, разминок: ${warmups}, «Ты и ИИ»: ${ailab}, проектов: ${projects} (шагов: ${psteps}), шпаргалка: ${sheetItems}`);
console.log(`порядок объяснений проверен на ${auditLessons} уроках`);
console.log(problems ? `ПРОБЛЕМ: ${problems}` : "все уроки в порядке");
process.exit(problems ? 1 : 0);
