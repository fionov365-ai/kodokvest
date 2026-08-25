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
function compare(what, code, files){
  const srcs = files || {};
  let all = code;
  for (const k in srcs) all += "\n" + srcs[k];
  const why = skipReason(all);
  if (why){ skipped++; return; }
  checked++;
  fs.readdirSync(TMP).forEach(n => {
    try { fs.rmSync(path.join(TMP, n), { recursive: true, force: true }); } catch(e){}
  });
  const f = path.join(TMP, "p.py");
  fs.writeFileSync(f, code.endsWith("\n") ? code : code + "\n");
  for (const name in srcs)
    fs.writeFileSync(path.join(TMP, name), srcs[name].endsWith("\n") ? srcs[name] : srcs[name] + "\n");
  let expected;
  try { expected = execFileSync("python3", [f], { encoding: "utf8", cwd: TMP }); }
  catch (e){ expected = "<<PYTHON ОШИБКА>> " + String(e.stderr || "").trim().split("\n").pop(); }
  const r = MP.run(code, { turtle: new MP.Turtle(), sources: srcs });
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
      compare(l.id + " · пример " + (i + 1), t.demo, t.files);
    });
    compare(l.id + " · решение", body.task.solution, solSrc);
    if (body.task.type !== "fix") compare(l.id + " · заготовка", body.task.starter, stSrc);
    /* скрытые тесты сверяем с python3 тоже: что вернёт эталон на каждом вызове */
    if (body.task.check.kind === "tests")
      (body.task.check.calls || []).forEach(call => {
        compare(l.id + " · скрытая проверка " + call,
                body.task.solution + "\nprint(repr(" + call + "))\n", solSrc);
      });
  });
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch(e){}
console.log("\nсверено с python3: " + checked + ", пропущено: " + skipped);
console.log(bad ? "РАСХОЖДЕНИЙ: " + bad : "содержание уроков совпадает с настоящим Python");
process.exit(bad ? 1 : 0);
