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
(global.WARMUPS || []).forEach(w => {
  warmups++;
  const id = w.id || "(без id)";
  if (!w.id) say(`[разминка] у разминки нет id`);
  else if (seenIds[w.id]) say(`[разминка] ${id}: повтор id`);
  seenIds[w.id] = 1;
  if (w.type !== "predict" && w.type !== "blocks")
    say(`[разминка] ${id}: type должен быть "predict" или "blocks", а он «${w.type}»`);
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
});

console.log(`\nуроков проверено: ${lessons} (из них «починить»: ${fixes}), примеров: ${demos}, разминок: ${warmups}`);
console.log(problems ? `ПРОБЛЕМ: ${problems}` : "все уроки в порядке");
process.exit(problems ? 1 : 0);
