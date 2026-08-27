/* ============================================================
   Сверка содержания уроков с настоящим Python.
   Каждый пример из теории и каждое эталонное решение прогоняются
   и через движок, и через python3 — вывод должен совпасть символ в символ.

   Пропускаются только те программы, которые сравнивать бессмысленно:
     - черепашья графика (в настоящем Python это отдельная библиотека);
     - случайность (числа заведомо разные);
     - примеры, помеченные err:true (у нас текст ошибки по-русски).

   Запуск: node tests/content-vs-python.js   (нужен python3)
   ============================================================ */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const root = path.join(__dirname, "..");

require(path.join(root, "js/engine-mini.js"));
const MP = globalThis.MiniPy;

global.window = global;
global.CONTENT = {};
eval(fs.readFileSync(path.join(root, "js/curriculum.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "js/warmups.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "js/ailab.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "js/projects.js"), "utf8"));
fs.readdirSync(path.join(root, "content"))
  .filter(f => /^world\d+\.js$/.test(f))
  .forEach(f => eval(fs.readFileSync(path.join(root, "content", f), "utf8")));

const TURTLE = /\b(forward|back|right|left|penup|pendown|color|width|goto|home|dot|circle|speed)\s*\(/;
const RANDOM = /\b(randint|choice|shuffle|sample|random)\s*\(/;
function skipReason(code){
  if (TURTLE.test(code)) return "черепашка";
  if (RANDOM.test(code)) return "случайность";
  return null;
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "kodokvest-content-"));
let checked = 0, skipped = 0, bad = 0;

/* Уроки про модули состоят из нескольких файлов. Для python3 мы их
   действительно кладём на диск рядом — тогда import работает как в жизни,
   и сверка остаётся честной. */
function compare(what, code, files, data, stdin){
  const srcs = files || {}, dataFiles = data || {}, answers = stdin || [];
  let all = code;
  for (const k in srcs) all += "\n" + srcs[k];
  const why = skipReason(all);
  if (why){ skipped++; return false; }
  checked++;
  fs.readdirSync(TMP).forEach(n => {
    try { fs.rmSync(path.join(TMP, n), { recursive: true, force: true }); } catch(e){}
  });
  const f = path.join(TMP, "p.py");
  fs.writeFileSync(f, code.endsWith("\n") ? code : code + "\n");
  for (const name in srcs)
    fs.writeFileSync(path.join(TMP, name), srcs[name].endsWith("\n") ? srcs[name] : srcs[name] + "\n");
  /* файлы с данными кладём как есть: программа их читает и переписывает */
  for (const name in dataFiles) fs.writeFileSync(path.join(TMP, name), dataFiles[name]);
  let expected;
  try { expected = execFileSync("python3", [f], { encoding: "utf8", cwd: TMP,
    input: answers.length ? answers.join("\n") + "\n" : "" }); }
  catch (e){ expected = "<<PYTHON ОШИБКА>> " + String(e.stderr || "").trim().split("\n").pop(); }
  const r = MP.run(code, { turtle: new MP.Turtle(), sources: srcs, files: dataFiles, stdin: answers });
  const got = r.error ? "<<ОШИБКА " + r.error.kind + " строка " + r.error.line + ">>" : r.output;
  if (got !== expected){
    bad++;
    console.log("--- РАСХОЖДЕНИЕ: " + what);
    console.log("    python3: " + JSON.stringify(expected).slice(0, 300));
    console.log("    движок : " + JSON.stringify(got).slice(0, 300));
  }
}

CURRICULUM.forEach(w => {
  const c = CONTENT["world" + w.n];
  if (!c) return;
  w.lessons.forEach(l => {
    const body = c[l.id];
    if (!body) return;
    const solSrc = {}, stSrc = {};
    (body.task.files || []).forEach(fl => {
      solSrc[fl.name] = fl.solution !== undefined ? fl.solution : fl.starter;
      stSrc[fl.name] = fl.starter;
    });
    body.theory.forEach((t, i) => {
      if (t.err) { skipped++; return; }   /* ошибка по-русски — сравнивать нечего */
      if (!t.demo) { skipped++; return; }  /* карточка только показывает код (t.show) */
      compare(l.id + " · пример " + (i + 1), t.demo, t.files, t.data, t.stdin);
    });
    compare(l.id + " · решение", body.task.solution, solSrc, body.task.data, body.task.stdin);
    if (body.task.type !== "fix") compare(l.id + " · заготовка", body.task.starter, stSrc, body.task.data, body.task.stdin);
    /* скрытые тесты сверяем с python3 тоже: что вернёт эталон на каждом вызове */
    if (body.task.check.kind === "tests")
      (body.task.check.calls || []).forEach(call => {
        compare(l.id + " · скрытая проверка " + call,
                body.task.solution + "\nprint(repr(" + call + "))\n", solSrc, body.task.data, body.task.stdin);
      });
  });
});

/* Разминки «угадай вывод»: правильный ответ ребёнку — это вывод программы,
   поэтому он обязан совпадать с настоящим python3 до знака. */
let warmups = 0;
(global.WARMUPS || []).forEach(w => {
  if (compare("разминка " + w.id, w.code, null, null, null) !== false) warmups++;
});

/* Раздел «Ты и ИИ»: predict — ответ ребёнку это вывод code; code/fix —
   правильный вывод задаёт solution. Всё обязано совпасть с python3.
   Заготовку fix специально НЕ проверяем: она сломана (у нас — ошибка
   по-русски или выдуманный метод, python3 упадёт иначе). */
let ailab = 0;
(global.AILAB || []).forEach(x => {
  if (x.type === "predict"){
    if (compare("ты-и-ии " + x.id, x.code, null, null, null) !== false) ailab++;
    return;
  }
  /* review: вердикт вычисляется из четырёх запусков, и все четыре обязаны
     совпасть с настоящим python3. Иначе «правильный ответ» задания зависел бы
     от особенностей нашего мини-движка, а не от Python. */
  if (x.type === "review"){
    if (compare("ты-и-ии " + x.id + " · код ИИ", x.code, null, null, null) !== false) ailab++;
    compare("ты-и-ии " + x.id + " · правильная версия", x.truth, null, null, null);
    compare("ты-и-ии " + x.id + " · код ИИ с probe", x.code + "\n" + x.probe, null, null, null);
    compare("ты-и-ии " + x.id + " · правильная версия с probe", x.truth + "\n" + x.probe, null, null, null);
    return;
  }
  if (compare("ты-и-ии " + x.id + " · решение", x.solution, null, null, null) !== false) ailab++;
  if (x.type === "code") compare("ты-и-ии " + x.id + " · заготовка", x.starter, null, null, null);
});

/* Проекты: правильный вывод шага задаёт его solution, а стартовый код первого
   шага ребёнок запускает своими руками — значит и он обязан вести себя как
   настоящий python3. */
let projsteps = 0;
(global.PROJECTS || []).forEach(p => {
  (p.steps || []).forEach((step, i) => {
    if (compare("проект " + p.id + " · шаг " + (i + 1), step.solution, null, null, null) !== false)
      projsteps++;
    if (i === 0 && step.starter !== undefined)
      compare("проект " + p.id + " · заготовка", step.starter, null, null, null);
  });
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch(e){}
/* Осторожно с этой строкой: warmups/ailab/projsteps — это сколько таких штук
   ОТДАНО на сверку, а не сколько пропущено. Раньше они стояли в скобках после
   слова «пропущено» и читались как его расшифровка — выходило, будто разминки
   с python3 не сверяются вовсе. */
console.log("\nсверено с python3: " + checked + " (из них разминок: " + warmups +
            ", «Ты и ИИ»: " + ailab + ", шагов проектов: " + projsteps +
            "), пропущено как черепашка и случайность: " + skipped);
console.log(bad ? "РАСХОЖДЕНИЙ: " + bad : "содержание уроков совпадает с настоящим Python");
process.exit(bad ? 1 : 0);
