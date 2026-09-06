/* ============================================================
   Черновики новых заданий моделью — с машинной приёмкой.

   ЗАЧЕМ. Банк задач-близнецов (js/homework.js) кроет миры 1-3, а миры 4-5
   пустые; мир «Экзамен» (js/algo.js) недобран до сорока задач. Это ровно та
   работа, где модель полезна: формулировка и эталонная программа пишутся
   быстро, а ПРАВИЛЬНОСТЬ проверяет не человек, а наши же тесты — эталон
   гоняется на многих семенах и сверяется с настоящим python3.

   ⚠️ ГЛАВНОЕ И ЕДИНСТВЕННОЕ ПРАВИЛО: сгенерированное попадает в файл, только
   если ПРОШЛО тест. Не прошло — откатывается, ошибка уходит модели, и она
   пробует снова. Поэтому «модель придумала задачу с ошибкой» здесь не
   страшно: непроверенное до банка не доходит. То, что осталось в файле,
   проверено ровно так же, как написанное руками.

   ⚠️ ЧЕГО ЭТО НЕ ЗАМЕНЯЕТ. Тест проверяет, что задача РАБОТАЕТ: эталон
   печатает одно и то же на любом семени, заготовка не даёт ответа даром,
   условие называет все числа. Он НЕ проверяет, интересна ли задача ребёнку
   и не повторяет ли она соседнюю. Это решает человек, читая готовое.

   Запуск (нужен AIST_API_TOKEN в окружении):
     node tools/gen-tasks.mjs homework json csv collections
     node tools/gen-tasks.mjs homework --all-world4
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HW = path.join(ROOT, "js/homework.js");
const BASE = process.env.AIST_API_BASE || "https://agent.aist-ai.com";
const ASSISTANT = Number(process.env.AIST_ASSISTANT || 742);   // DeepSeek V4 Pro
const TOKEN = process.env.AIST_API_TOKEN || "";
const COST_TO_RUB = 100;
const TRIES = 3;

/* Движок урока — не настоящий Python: сторонние модули в нём не живут.
   Задача на то, чего движок не умеет, провалит тест, и мы потратим деньги
   впустую. Список берём из самого движка, чтобы он не разъехался. */
const MODULES = fs.readFileSync(path.join(ROOT, "js/engine-mini.js"), "utf8")
  .split("var BUILTIN_MODULES = {")[1].slice(0, 4000)
  .split("\n").filter(l => /^  [a-z_]+: function/.test(l))
  .map(l => l.trim().split(":")[0]);

/* ⚠️ ПРОВЕРИТЬ РЕПОЗИТОРИЙ ДО ГЕНЕРАЦИИ — иначе все кандидаты будут забракованы
   чужой поломкой, и это НЕ ВИДНО. Поймано 06.09.2026: первая принятая задача
   изменила число сверок с python3, README.md остался со старым числом, и
   `content-vs-python.js` стал возвращать 1 — то есть приёмка падала не на
   задаче, а на счётчике в документации. Дальше семь кандидатов подряд получили
   «не прошло», деньги потрачены впустую, а модели в качестве «ошибки» уходила
   строка «сверено с python3: 848…», по которой исправлять нечего.
   Это тот же класс дефекта, что «молчаливый частичный результат»: причина
   подменена, а сообщение выглядит правдоподобно. */
function baseline(steps) {
  for (const [cmd, args] of steps) {
    const r = sh(cmd, args);
    if (!r.ok) {
      console.error("✗ Репозиторий КРАСНЫЙ ещё до генерации: " + args.join(" "));
      console.error(failLines(r.out));
      console.error("\nСначала почини это — иначе каждый кандидат будет " +
                    "забракован чужой поломкой.");
      process.exit(1);
    }
  }
}

/* Из вывода теста берём то, по чему можно исправлять. ⚠️ Раньше сюда попадала
   первая строка вывода — а у зелёного теста это его собственная сводка. */
function failLines(out) {
  const bad = out.split("\n").filter(l =>
    /✗|провал|ошибк|Error|не совпад|не прош|расход|поправь|алгорит|\bbad\b/i.test(l));
  return (bad.length ? bad : out.split("\n").filter(Boolean).slice(-10))
    .slice(0, 10).join("\n");
}

/* ⚠️ СЧЁТЧИК СВЕРОК В README — ЧАСТЬ ПРИЁМКИ, и он ломается от нашей же работы.
   Каждая принятая задача добавляет сверки с python3, а `content-vs-python.js`
   требует, чтобы число в README совпадало, и возвращает 1. Значит после первой
   же принятой задачи все следующие кандидаты падали бы на чужой причине.
   Поэтому счётчик правим сразу и прогон повторяем: тест сам печатает нужное
   число, гадать не надо. */
const README = path.join(ROOT, "README.md");
const README_NOTE = /README говорит «(\d+) сверок», а их (\d+)/;

/* ⚠️ ПРАВИТЬ README ТОЛЬКО ПОСЛЕ ПРИЁМКИ, а не во время неё. Первая редакция
   синхронизировала счётчик прямо в проверке кандидата — и оставляла README
   с числом ОТКЛОНЁННОГО кандидата: js/algo.js откатывался, а документация нет.
   Через несколько попыток в таблице стояло 852 при фактических 848, и все
   следующие кандидаты браковались за чужую поломку. Тот же дефект, что
   лечили час назад, только теперь его внёс я сам.
   Поэтому: при проверке кандидата расхождение счётчика НЕ считается провалом
   (это наша документация, а не его ошибка), а чинится оно один раз — после
   того, как задача принята. */
function readmeOnly(out) {
  const lines = out.split("\n").filter(l => l.trim());
  const bad = lines.filter(l => /✗|провал|ошибк|Error|не совпад|не прош/i.test(l));
  return bad.length === 0 && README_NOTE.test(out);
}

function syncReadme() {
  const r = sh("node", ["tests/content-vs-python.js"]);
  const m = r.out.match(README_NOTE);
  if (!m) return r.ok;
  const [, was, now] = m;
  const src = fs.readFileSync(README, "utf8");
  // Число встречается в таблице и во фразе; меняем оба, не трогая соседние.
  const fixed = src
    .replace(new RegExp(`\\*\\*${was}\\*\\*`, "g"), `**${now}**`)
    .replace(new RegExp(`(сейчас\\s+)${was}(\\s+сверк\\S*)`, "g"), `$1${now}$2`);
  if (fixed === src) {
    console.error(`  ⚠ счётчик в README (${was}) не удалось поправить на ${now} — ` +
                  "почини руками, иначе следующий прогон встанет");
    return false;
  }
  fs.writeFileSync(README, fixed, "utf8");
  return sh("node", ["tests/content-vs-python.js"]).ok;
}

function sh(cmd, args) {
  try {
    return { ok: true, out: execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8",
                                                     stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") };
  }
}

async function call(method, url, body) {
  const r = await fetch(BASE + url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json",
               Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${await r.text()}`);
  return r.json();
}

/* Спросить модель. ⚠️ Платформа умеет молча подменить модель по цепочке
   fallback — печатаем, кто на самом деле ответил, как это делает
   scripts/aichek_helpers/aist_draft.py в aichek. */
async function ask(prompt) {
  const task = await call("POST", "/api/tasks", {
    assistant_id: ASSISTANT, input: [{ type: "text", text: prompt }],
  });
  for (let waited = 0; waited < 300; waited += 5) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await call("GET", `/api/tasks/${task.uuid}`);
    if (res.status === "completed") {
      const turn = res.turn || {};
      const meta = turn.metadata || {};
      const text = (turn.output || []).filter(i => i.type === "text")
        .map(i => i.text).join("\n");
      return { text, rub: Number(meta.cost?.total || 0) * COST_TO_RUB,
               model: meta.model || "?" };
    }
    if (res.status === "failed" || res.status === "canceled")
      throw new Error(`задача ${res.status}: ${res.error}`);
    if (res.status === "interrupted") {
      await call("POST", `/api/tasks/${task.uuid}/cancel`,
                 { reason: "client tools not declared" });
      throw new Error("ассистент запросил клиентский инструмент — задача отменена");
    }
  }
  throw new Error("модель не ответила за 300 секунд");
}

/* ── материал для промпта ───────────────────────────────────────────── */
function lessonInfo(lessonId) {
  global.window = global;
  const src = fs.readFileSync(path.join(ROOT, "js/curriculum.js"), "utf8");
  // ⚠️ Именно КОСВЕННЫЙ eval: модуль ESM исполняется в строгом режиме и в
  // своей области видимости, поэтому обычный eval не заведёт window.CURRICULUM.
  (0, eval)(src);
  const worlds = global.CURRICULUM;
  for (let w = 0; w < worlds.length; w++)
    for (const l of worlds[w].lessons || [])
      if (l.id === lessonId) return { world: w + 1, ...l };
  return null;
}

function lessonBody(lessonId, world) {
  const f = path.join(ROOT, `content/world${world}.js`);
  if (!fs.existsSync(f)) return "";
  const src = fs.readFileSync(f, "utf8");
  const i = src.indexOf(`\n  ${lessonId}: {`);
  if (i < 0) return "";
  return src.slice(i, i + 5000);
}

function schemaDoc(file, marker) {
  const src = fs.readFileSync(file, "utf8");
  return src.slice(0, src.indexOf(marker));
}

function records(file, marker) {
  const src = fs.readFileSync(file, "utf8");
  const body = src.slice(src.indexOf(marker), src.lastIndexOf("\n];"));
  return body.split(/\n\{\n/).slice(1).map(r => "{\n" + r.replace(/,\s*$/, ""));
}

function exemplars(file, marker, pick) {
  const rs = records(file, marker);
  const chosen = pick ? rs.filter(pick) : rs;
  return [chosen[0], chosen[chosen.length - 1]].join("\n\n");
}

const PROMPT = (les, body, err, prev) => `Ты пишешь ОДНУ новую задачу-близнеца для
детского тренажёра Python (11-14 лет). Ответь ТОЛЬКО объектом JavaScript, без
пояснений и без markdown-ограды.

Вот документация формата — читай её как закон:
${schemaDoc(HW, "window.HOMEWORK = [")}

Вот два готовых примера из банка. Пиши в точности в таком же стиле:

${exemplars(HW, "window.HOMEWORK = [")}

Задача пишется к уроку «${les.title}» (id ${les.id}, мир ${les.world}${les.sub ? ", " + les.sub : ""}).
Ребёнок к этому моменту прошёл всё, что было раньше, и только что изучил этот урок.
Вот содержание урока, чтобы ты знала, какие конструкции уже объяснены:

${body.slice(0, 4500)}

ЖЁСТКИЕ ОГРАНИЧЕНИЯ (нарушишь — задача не пройдёт автоматическую проверку):
- поле after обязано быть ровно "${les.id}";
- id задачи начинается с "hw-" и не повторяет уже занятые;
- никакого random, никакого input(), никакого чтения файлов и сети;
- из модулей движок знает только: ${MODULES.join(", ")}. Другие импорты не работают;
- все числа задачи приходят из params и подставляются в goal(v) и code(v);
- goal обязан НАЗВАТЬ все числа, которые нужны для решения, — решающий не видит программы;
- эталон code(v) обязан что-то печатать и работать на любом наборе чисел;
- starter НЕ должен печатать правильный ответ;
- если задание про конструкцию (функция, цикл, класс) — задай need и needMsg;
- имена переменных латиницей;
- две подсказки в hints, каждая объясняет приём, а не выдаёт ответ.

ЧЕГО ТЕСТ НЕ ЛОВИТ, А ЧЕЛОВЕК ЗАМЕТИТ СРАЗУ (это решает, примут задачу или нет):
- условие обязано описывать РОВНО ТО, что делает эталон. «Напечатай, сколько
  осталось» при эталоне, который печатает исходное число, — брак;
- задача обязана требовать ВЫЧИСЛЕНИЯ или отбора, а не одного чтения значения:
  ребёнок должен что-то посчитать, выбрать по условию, сложить или собрать;
- ситуация живая и понятная подростку (игра, школа, деньги, спорт, робот),
  а не «дан список чисел».
${prev ? `\nТвой прошлый вариант НЕ прошёл проверку. Вот он:\n${prev}\n\nОшибка проверки:\n${err}\n\nИсправь ровно эту причину и верни объект целиком.` : ""}`;

/* ── вставка и приёмка ──────────────────────────────────────────────── */
function extract(answer) {
  let t = answer.trim();
  const fence = t.match(/```(?:js|javascript)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const i = t.indexOf("{");
  const j = t.lastIndexOf("}");
  if (i < 0 || j < i) return "";
  return t.slice(i, j + 1);
}

function withRecord(original, record) {
  const at = original.lastIndexOf("\n];");
  return original.slice(0, at) + ",\n\n" + record + original.slice(at);
}

async function genHomework(ids) {
  if (!TOKEN) { console.error("нет AIST_API_TOKEN в окружении"); process.exit(1); }
  baseline([["node", ["tests/homework.js"]]]);
  const original = fs.readFileSync(HW, "utf8");
  let current = original, spent = 0, added = [];
  for (const id of ids) {
    const les = lessonInfo(id);
    if (!les) { console.error(`! нет урока ${id} в curriculum.js`); continue; }
    const body = lessonBody(id, les.world);
    let err = "", prev = "", ok = false;
    for (let t = 1; t <= TRIES && !ok; t++) {
      let ans;
      try { ans = await ask(PROMPT(les, body, err, prev)); }
      catch (e) { console.error(`  ${id}: попытка ${t} — ${e.message}`); continue; }
      spent += ans.rub;
      const rec = extract(ans.text);
      if (!rec) { err = "ответ не содержит объекта"; prev = ans.text.slice(0, 500); continue; }
      // ⚠️ Пишем в настоящий файл: тест читает его с диска. При провале
      // возвращаем то, что было, — на диске не должно остаться непроверенного.
      fs.writeFileSync(HW, withRecord(current, rec), "utf8");
      const res = sh("node", ["tests/homework.js"]);
      if (res.ok) {
        current = fs.readFileSync(HW, "utf8");
        ok = true;
        added.push(id);
        console.log(`  ✓ ${id}: принята с попытки ${t} (${spent.toFixed(2)} ₽ всего)`);
      } else {
        fs.writeFileSync(HW, current, "utf8");
        err = failLines(res.out);
        prev = rec;
        console.log(`  ✗ ${id}: попытка ${t} не прошла — ${err.split("\n")[0].slice(0, 90)}`);
      }
    }
    if (!ok) console.log(`  — ${id}: ни одна из ${TRIES} попыток не прошла, задача не добавлена`);
  }
  console.log(`\nдобавлено ${added.length}: ${added.join(", ") || "—"}`);
  console.log(`потрачено ${spent.toFixed(2)} ₽`);
  if (added.length) console.log("⚠️ Прочитать глазами: интересна ли задача и не дублирует ли соседнюю.");
}

/* ── второй банк: задачи в формате ОГЭ/ЕГЭ (js/algo.js) ─────────────── */
//
// ⚠️ ЗДЕСЬ ЦЕНА ОШИБКИ ВЫШЕ, ЧЕМ У БЛИЗНЕЦОВ. «Задача в формате ОГЭ» —
// обещание, и родитель проверит его в мае. Поэтому приёмка тут строже:
// кроме прогона эталона, тест требует не меньше двух СКРЫТЫХ наборов ввода
// (иначе задача сдаётся напечатанной константой из примера), требует, чтобы
// заготовка проверку НЕ проходила, и сверяет вывод с настоящим python3.
const ALGO = path.join(ROOT, "js/algo.js");

const ALGO_PROMPT = (topic, group, err, prev) => `Ты пишешь ОДНУ новую задачу для
раздела «Алгоритмы и экзамен» детского тренажёра Python (11-14 лет). Ответь
ТОЛЬКО объектом JavaScript, без пояснений и без markdown-ограды.

Документация формата — читай её как закон:
${schemaDoc(ALGO, "window.ALGO = [")}

Два готовых примера из банка, пиши точно в таком же стиле:

${exemplars(ALGO, "window.ALGO = [", r => r.includes('group: "' + group + '"'))}

Тема новой задачи: ${topic}
Группа: "${group}"

ЖЁСТКИЕ ОГРАНИЧЕНИЯ (нарушишь — задача не пройдёт автоматическую приёмку):
- поля id, group, emoji, title, tag, intro, goal, list, starter, solution,
  check, note, hints обязательны; hints — не меньше ТРЁХ;
- check: { kind:"output" }, рядом stdin (открытый пример) и sets — не меньше
  ДВУХ скрытых наборов ввода, ни один не совпадает с stdin;
- sample обязан совпадать с тем, что печатает solution на stdin;
- никакого random и никакого импорта модулей;
- эталон обязан отработать на каждом скрытом наборе и что-то напечатать;
- заготовка starter НЕ должна проходить проверку;
- имена переменных латиницей;
- ограничения в условии числами, как в примерах (например 3 ≤ N ≤ 10 000);
- если подходящих элементов может не быть — условие обязано сказать, что
  печатать в этом случае, и один из скрытых наборов обязан этот случай дать.
${prev ? `\nТвой прошлый вариант НЕ прошёл приёмку. Вот он:\n${prev}\n\nОшибка:\n${err}\n\nИсправь ровно эту причину и верни объект целиком.` : ""}`;

async function genAlgo(topics, group) {
  if (!TOKEN) { console.error("нет AIST_API_TOKEN в окружении"); process.exit(1); }
  baseline([["node", ["build.js"]], ["node", ["tests/full-run.js"]],
            ["node", ["tests/content-vs-python.js"]]]);
  let current = fs.readFileSync(ALGO, "utf8"), spent = 0;
  const added = [];
  for (const topic of topics) {
    let err = "", prev = "", ok = false;
    for (let t = 1; t <= TRIES && !ok; t++) {
      let ans;
      try { ans = await ask(ALGO_PROMPT(topic, group, err, prev)); }
      catch (e) { console.error(`  ${topic}: попытка ${t} — ${e.message}`); continue; }
      spent += ans.rub;
      const rec = extract(ans.text);
      if (!rec) { err = "ответ не содержит объекта"; prev = ans.text.slice(0, 500); continue; }
      fs.writeFileSync(ALGO, withRecord(current, rec), "utf8");
      const build = sh("node", ["build.js"]);
      const res = build.ok ? sh("node", ["tests/full-run.js"]) : build;
      let py = res.ok ? sh("node", ["tests/content-vs-python.js"]) : res;
      // Единственная жалоба — на наш счётчик в README? Кандидат ни при чём.
      if (!py.ok && readmeOnly(py.out)) py = { ok: true, out: py.out };
      if (py.ok) {
        current = fs.readFileSync(ALGO, "utf8");
        ok = true;
        added.push(topic);
        if (!syncReadme())
          console.error("  ⚠ приёмка после правки README не зелёная — проверь руками");
        console.log(`  ✓ ${topic}: принята с попытки ${t} (${spent.toFixed(2)} ₽ всего)`);
      } else {
        fs.writeFileSync(ALGO, current, "utf8");
        err = failLines(py.out);
        prev = rec;
        console.log(`  ✗ ${topic}: попытка ${t} — ${(err.split("\n")[0] || "").slice(0, 100)}`);
      }
    }
    if (!ok) console.log(`  — ${topic}: ни одна из ${TRIES} попыток не прошла`);
  }
  // Сборку прогоняем ещё раз: последняя могла остаться от откаченного варианта.
  sh("node", ["build.js"]);
  console.log(`\nдобавлено ${added.length}: ${added.join("; ") || "—"}`);
  console.log(`потрачено ${spent.toFixed(2)} ₽`);
  if (added.length) console.log("⚠️ Прочитать глазами: не дублирует ли тему соседней задачи.");
}

const [, , mode, ...rest] = process.argv;
if (mode === "homework") {
  await genHomework(rest);
} else if (mode === "algo") {
  // node tools/gen-tasks.mjs algo oge "тема раз" "тема два"
  const group = rest[0];
  if (group !== "oge" && group !== "ege") {
    console.error("группа обязана быть oge или ege");
    process.exit(1);
  }
  await genAlgo(rest.slice(1), group);
} else {
  console.error("node tools/gen-tasks.mjs homework <lessonId>...\n" +
                "node tools/gen-tasks.mjs algo <oge|ege> \"тема\" ...");
  process.exit(1);
}
