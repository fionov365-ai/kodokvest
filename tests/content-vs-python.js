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
eval(fs.readFileSync(path.join(root, "js/cheatsheet.js"), "utf8"));
fs.readdirSync(path.join(root, "content"))
  .filter(f => /^world\d+\.js$/.test(f))
  .forEach(f => eval(fs.readFileSync(path.join(root, "content", f), "utf8")));

const TURTLE = /\b(forward|back|right|left|penup|pendown|color|width|goto|home|dot|circle|speed)\s*\(/;
const RANDOM = /\b(randint|choice|shuffle|sample|random)\s*\(/;
/* Программа упала — и это бывает НАРОЧНО: «ИИ выдумал функцию», проверка
   на пустом списке. Раньше такое содержание сверить было нельзя вообще:
   текст ошибки у python3 английский и подробный, у движка свой, и любое
   падение читалось как расхождение. Сравнивать построчный текст и правда
   бессмысленно, но три вещи сравнимы, и все три существенные:
     что напечаталось ДО падения,
     КАКОЕ это исключение (имена классов у нас совпадают с питоновскими),
     на КАКОЙ строке оно случилось.
   Ослаблением это не является: падение у одного и не-падение у другого
   по-прежнему расхождение, и разные исключения — тоже. */
function crashSummary(stdout, stderr){
  const lines = String(stderr).trim().split("\n");
  const last = lines[lines.length - 1] || "";
  const kind = (last.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?::|$)/) || [])[1];
  let line = 0;
  lines.forEach(t => {
    const m = t.match(/^\s*File "[^"]*", line (\d+)/);
    if (m) line = +m[1];
  });
  return kind
    ? stdout + "<<УПАЛО " + kind + " строка " + line + ">>"
    : stdout + "<<УПАЛО, но разобрать не удалось: " + last + ">>";
}

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
  /* stdio задаём явно: у execFileSync stderr по умолчанию уходит в наш
     собственный stderr, и падение НАРОЧНО печатало бы питоновский traceback
     в вывод проверки, пугая читателя посреди зелёного прогона. */
  try { expected = execFileSync("python3", [f], { encoding: "utf8", cwd: TMP,
    stdio: ["pipe", "pipe", "pipe"],
    input: answers.length ? answers.join("\n") + "\n" : "" }); }
  catch (e){ expected = crashSummary(String(e.stdout || ""), String(e.stderr || "")); }
  const r = MP.run(code, { turtle: new MP.Turtle(), sources: srcs, files: dataFiles, stdin: answers });
  const got = r.error
    ? (r.output || "") + "<<УПАЛО " + r.error.kind + " строка " + r.error.line + ">>"
    : r.output;
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

/* Кадры пошагового прогона и короткая запись значения — ровно то же, что
   делают vizRecord() и vizShort() в игре. Совпадение с ними важно: ребёнок
   потом увидит эти самые значения в визуализаторе. */
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
function memShort(cell, objects){
  if (!cell) return "";
  if (cell.t !== "ref") return cell.text;
  const o = objects && objects[cell.id];
  if (!o) return "объект";
  if (o.kind === "dict")
    return "{" + o.pairs.map(p => p.key + ": " + memShort(p.val, objects)).join(", ") + "}";
  const inner = (o.items || []).map(x => memShort(x, objects)).join(", ");
  return o.kind === "list" ? "[" + inner + "]" : o.kind === "tuple" ? "(" + inner + ")" : "{" + inner + "}";
}

/* Разминки «угадай вывод»: правильный ответ ребёнку — это вывод программы,
   поэтому он обязан совпадать с настоящим python3 до знака. */
let warmups = 0;
(global.WARMUPS || []).forEach(w => {
  if (compare("разминка " + w.id, w.code, null, null, null) !== false) warmups++;
});

/* Разминки «предскажи память»: правильный ответ ребёнку — это ЗНАЧЕНИЯ
   переменных в момент остановки, а их считает наш снимок кучи. Проверить
   его настоящим Python можно так: вставить перед той же строкой печать
   repr() каждой переменной. Строка stop выполняется ровно один раз (это
   отдельно проверяет lessons.js), поэтому вставка ей строго равносильна.

   Именно эта сверка и делает механику честной: без неё «правильный ответ»
   зависел бы от того, как наш движок печатает списки и строки. */
let memChecked = 0;
(global.WARMUPS || []).filter(w => w.type === "memory").forEach(w => {
  const frames = memFrames(w.code);
  const hit = frames.filter(f => f.line === w.stop)[0];
  if (!hit){ bad++; console.log("--- ПАМЯТЬ: " + w.id + " — строка " + w.stop + " не выполняется"); return; }

  const mine = {};
  for (const n of w.ask){
    const v = hit.vars.filter(x => x.name === n)[0];
    if (!v){ bad++; console.log("--- ПАМЯТЬ: " + w.id + " — нет переменной " + n); return; }
    mine[n] = memShort(v.cell, hit.objects);
  }

  const lines = String(w.code).replace(/\n+$/, "").split("\n");
  const indent = lines[w.stop - 1].match(/^\s*/)[0];
  const ins = indent + "print(" + w.ask.map(n => "repr(" + n + ")").join(', "|", ') + ")";
  const variant = lines.slice(0, w.stop - 1).concat([ins], lines.slice(w.stop - 1)).join("\n") + "\n";

  fs.readdirSync(TMP).forEach(n => { try { fs.rmSync(path.join(TMP, n), { recursive:true, force:true }); } catch(e){} });
  const f = path.join(TMP, "mem.py");
  fs.writeFileSync(f, variant);
  let out;
  try { out = execFileSync("python3", [f], { encoding: "utf8", cwd: TMP }); }
  catch (e){
    bad++;
    console.log("--- ПАМЯТЬ: " + w.id + " — python3 не выполнил проверку: " +
                String(e.stderr || "").trim().split("\n").pop());
    return;
  }
  const want = out.split("\n")[0].split(" | ");
  let ok = true;
  w.ask.forEach((n, i) => {
    if (mine[n] !== want[i]){
      ok = false; bad++;
      console.log("--- ПАМЯТЬ: РАСХОЖДЕНИЕ " + w.id + " по «" + n + "»");
      console.log("    python3: " + JSON.stringify(want[i]));
      console.log("    движок : " + JSON.stringify(mine[n]));
    }
  });
  if (ok) memChecked++;
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
  /* catch: то же самое и по той же причине. Здесь это ещё важнее — решает
     ребёнок, и «поймал/не поймал» считается сравнением двух запусков. */
  if (x.type === "review" || x.type === "catch"){
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
    if (compare("проект " + p.id + " · шаг " + (i + 1), step.solution, null, null, step.stdin || null) !== false)
      projsteps++;
    /* заготовка любого шага, а не только первого: в проекте с ИИ-напарником
       шаг начинается с его редакции, и ребёнок запускает её своими руками */
    if (step.starter !== undefined)
      compare("проект " + p.id + " · заготовка шага " + (i + 1), step.starter, null, null, step.stdin || null);
  });
});

/* Шпаргалка: пример показывают ребёнку как «вот так это работает», значит он
   обязан работать так же, как настоящий python3. Примеры со случайностью
   compare пропустит сам — они и должны каждый раз печатать разное. */
let sheetChecked = 0;
(global.CHEATSHEET || []).forEach(g => {
  (g.items || []).forEach(it => {
    if (compare("шпаргалка " + it.id, it.code, null, it.data || null, null) !== false) sheetChecked++;
  });
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch(e){}
/* Осторожно с этой строкой: warmups/ailab/projsteps — это сколько таких штук
   ОТДАНО на сверку, а не сколько пропущено. Раньше они стояли в скобках после
   слова «пропущено» и читались как его расшифровка — выходило, будто разминки
   с python3 не сверяются вовсе. */
console.log("\nсверено с python3: " + checked + " (из них разминок: " + warmups +
            ", снимков памяти: " + memChecked +
            ", «Ты и ИИ»: " + ailab + ", шагов проектов: " + projsteps + ", шпаргалка: " + sheetChecked +
            "), пропущено как черепашка и случайность: " + skipped);
console.log(bad ? "РАСХОЖДЕНИЙ: " + bad : "содержание уроков совпадает с настоящим Python");
/* Число сверок названо в README словами. Расходится — значит документация
   врёт о самой себе, а заметить это иначе нельзя: тест зелёный, текст устарел.
   Сверяем здесь, где число и считается. */
const readmeBad = (function(){
  const fs2 = require("fs"), path2 = require("path");
  const readme = fs2.readFileSync(path2.join(__dirname, "..", "README.md"), "utf8");
  /* «сверки», «сверок», «сверка» — число в README склоняется по правилам
     русского, и регулярка обязана это пережить. Первая редакция знала только
     «сверк…», и на 765 сверках проверка молча перестала находить строку —
     то есть перестала работать ровно тогда, когда число изменилось. */
  const m = /сейчас (\d+) сверо?к/.exec(readme);
  if (!m){ console.log("README: не найдена строка про число сверок"); return true; }
  if (+m[1] !== checked){
    console.log("README говорит «" + m[1] + " сверок», а их " + checked + " — поправь README.md");
    return true;
  }
  return false;
})();
process.exit(bad || readmeBad ? 1 : 0);
