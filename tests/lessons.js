/* ============================================================
   Проверка уроков: для каждого урока с контентом
     1. решение выполняется без ошибок
     2. заготовка выполняется без ошибок (или ошибка объяснимая)
     3. все примеры из теории работают
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

/* уроки, где ошибка в примере — часть объяснения */
const EXPECTED_DEMO_ERRORS = { "fstrings": [0] };

let problems = 0;
let lessons = 0, demos = 0;

CURRICULUM.forEach(w => {
  const c = CONTENT["world" + w.n];
  if (!c) return;
  w.lessons.forEach(l => {
    const body = c[l.id];
    if (!body) return;
    lessons++;

    const sol = MP.run(body.task.solution, { turtle: new MP.Turtle() });
    if (sol.error){
      problems++;
      console.log(`[решение] ${l.id}: ${sol.error.kind} — ${sol.error.msg}`);
    }

    const st = MP.run(body.task.starter, { turtle: new MP.Turtle() });
    if (st.error){
      problems++;
      console.log(`[заготовка] ${l.id}: ${st.error.kind} — ${st.error.msg}`);
    }

    body.theory.forEach((t, i) => {
      demos++;
      const r = MP.run(t.demo, { turtle: new MP.Turtle() });
      const allowed = (EXPECTED_DEMO_ERRORS[l.id] || []).includes(i);
      if (r.error && !allowed){
        problems++;
        console.log(`[пример ${i+1}] ${l.id}: ${r.error.kind} — ${r.error.msg}`);
      }
      if (!r.error && allowed){
        problems++;
        console.log(`[пример ${i+1}] ${l.id}: ожидалась ошибка, но её нет`);
      }
    });
  });
});

console.log(`\nуроков проверено: ${lessons}, примеров: ${demos}`);
console.log(problems ? `ПРОБЛЕМ: ${problems}` : "все уроки в порядке");
process.exit(problems ? 1 : 0);
