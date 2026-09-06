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
  eval(src);
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

function schemaDoc() {
  const src = fs.readFileSync(HW, "utf8");
  return src.slice(0, src.indexOf("window.HOMEWORK = ["));
}

function exemplars() {
  const src = fs.readFileSync(HW, "utf8");
  const body = src.slice(src.indexOf("window.HOMEWORK = ["), src.indexOf("\n];"));
  const parts = body.split(/\n\{\n/).slice(1);
  return ["{\n" + parts[0], "{\n" + parts[parts.length - 1]].join("\n\n");
}

const PROMPT = (les, body, err, prev) => `Ты пишешь ОДНУ новую задачу-близнеца для
детского тренажёра Python (11-14 лет). Ответь ТОЛЬКО объектом JavaScript, без
пояснений и без markdown-ограды.

Вот документация формата — читай её как закон:
${schemaDoc()}

Вот два готовых примера из банка. Пиши в точности в таком же стиле:

${exemplars()}

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
        err = res.out.split("\n").filter(Boolean).slice(-12).join("\n");
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

const [, , mode, ...rest] = process.argv;
if (mode !== "homework") {
  console.error("пока умею только: node tools/gen-tasks.mjs homework <lessonId>...");
  process.exit(1);
}
await genHomework(rest);
