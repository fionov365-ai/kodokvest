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
const path = require("path");
const root = path.join(__dirname, "..");

require(path.join(root, "js/engine-mini.js"));
const MP = globalThis.MiniPy;

/* грузим программу и контент как обычные скрипты */
global.window = global;
global.CONTENT = {};
eval(fs.readFileSync(path.join(root, "js/curriculum.js"), "utf8"));
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

    /* 1. решение */
    const sol = MP.run(task.solution, { turtle: new MP.Turtle() });
    if (sol.error) say(`[решение] ${l.id}: ${sol.error.kind} — ${sol.error.msg}`);

    /* 2. заготовка */
    const st = MP.run(task.starter, { turtle: new MP.Turtle() });
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
      demos++;
      const r = MP.run(t.demo, { turtle: new MP.Turtle() });
      if (r.error && !t.err)
        say(`[пример ${i+1}] ${l.id}: ${r.error.kind} — ${r.error.msg}`);
      if (!r.error && t.err)
        say(`[пример ${i+1}] ${l.id}: помечен err:true, но ошибки нет`);
    });

    /* 4. check.lines против настоящего вывода решения */
    if (task.check.kind === "output" && task.check.lines && !sol.error){
      const exp = task.check.lines, got = sol.lines;
      const same = exp.length === got.length && exp.every((x, i) => x === got[i]);
      if (!same)
        say(`[check.lines] ${l.id}: не совпадает с выводом решения\n    задано:  ${JSON.stringify(exp)}\n    решение: ${JSON.stringify(got)}`);
    }
  });
});

console.log(`\nуроков проверено: ${lessons} (из них «починить»: ${fixes}), примеров: ${demos}`);
console.log(problems ? `ПРОБЛЕМ: ${problems}` : "все уроки в порядке");
process.exit(problems ? 1 : 0);
