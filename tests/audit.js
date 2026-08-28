/* ============================================================
   Редакторский аудит курса. Запуск:  node tests/audit.js
   В npm test НЕ входит: часть находок требует глаз, а не порога.

   Проверяет то, чего не проверяет ни один другой тест: не «работает ли
   код», а «честен ли урок». Четыре независимые проверки, каждая печатает
   свой раздел. Ноль находок — не повод расслабляться, повод дописать
   проверку; каждая из них родилась из настоящего дефекта.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

global.window = {};
let CONTENT = {};
eval(read("js/engine-mini.js"));
eval(read("js/curriculum.js"));
["content/world1.js","content/world2.js","content/world3.js","content/world4.js","content/world5.js"]
  .forEach(f => eval(read(f)));
eval(read("js/cheatsheet.js"));

const MP = global.MiniPy || window.MiniPy;
const noTags = x => String(x || "").replace(/<[^>]*>/g, " ");
const lessonById = id => {
  for (const w of CURRICULUM) { const b = (CONTENT["world" + w.n] || {})[id]; if (b) return { w, b }; }
  return null;
};
let total = 0;
const section = t => console.log("\n\n═══ " + t + " ═══");
const hit = m => { total++; console.log("  • " + m); };
const clean = n => console.log("  (чисто: " + n + ")");

/* ---------- 1. Шпаргалка обещает урок, в котором команды нет ----------
   У каждой записи есть lesson — «урок, где это объясняли». Если в этом уроке
   команда нигде не встречается, справочник врёт ребёнку про его же прогресс:
   запись показана как пройденная, а он её не видел. Именно так `.lower()`
   числился за уроком 7, не появляясь там ни разу. */
section("1. Шпаргалка ссылается на урок, где команды нет");
{
  let ok = 0;
  window.CHEATSHEET.forEach(g => g.items.forEach(it => {
    const found = lessonById(it.lesson);
    if (!found) return hit(`${it.id}: урока «${it.lesson}» вообще нет`);
    const { b } = found;
    const all = [
      (b.theory || []).map(t => [t.demo, t.show, noTags(t.p), noTags(t.h)].join("\n")).join("\n"),
      noTags(b.lede), b.task ? [b.task.solution, b.task.starter, noTags(b.task.goal),
        noTags((b.task.list || []).join(" "))].join("\n") : ""
    ].join("\n");
    /* берём из сигнатуры её опознаваемое ядро: имя функции или метода */
    const m = /\.?([A-Za-z_][A-Za-z_0-9]*)\s*\(/.exec(it.sig);
    const token = m ? m[1] : null;
    if (!token) { ok++; return; }
    if (all.indexOf(token) < 0)
      hit(`${it.id} («${it.sig}») числится за уроком «${it.lesson}», но «${token}» там не встречается`);
    else ok++;
  }));
  if (total === 0) clean(ok + " записей подтверждены");
}

/* ---------- 2. Требование в условии, которое ничем не проверяется ----------
   Грабля 14: «Требование, которое не проверяется, — обман». Проверка вывода
   ловит требование только если его нарушение МЕНЯЕТ вывод. Требование вида
   «сделай через такую-то конструкцию» держится исключительно на needCode.
   Ищем в условии слова-приказы и смотрим, есть ли needCode/noCode/needText. */
section("2. «Сделай через …» в условии без needCode");
{
  const before = total;
  const ORDERS = [
    [/\bчерез (цикл|for|while)\b/i, "for"], [/\bциклом\b/i, "for"],
    [/\bчерез функцию\b/i, "def "], [/\bфункцией\b/i, "def "],
    [/\bf-строк/i, 'f"'], [/\bчерез включени/i, " for "],
    [/\bчерез словарь\b/i, "{"], [/\bиспользуй\b/i, null],
    [/\bне переписывая\b/i, null], [/\bобязательно\b/i, null]
  ];
  CURRICULUM.forEach(w => w.lessons.forEach(l => {
    const b = (CONTENT["world" + w.n] || {})[l.id];
    if (!b || !b.task) return;
    const t = b.task, chk = t.check || {};
    /* Требования читаются ИЗ check — именно оттуда их берёт runCheck. Сам этот
       инструмент сначала смотрел на уровень task и потому врал: урок 6 уже был
       защищён, а проверка продолжала на него ругаться. */
    if (chk.needCode || chk.noCode || chk.needText) return;
    if (chk.kind && chk.kind !== "output") return;             /* скрытые тесты и своя проверка */
    const words = noTags(t.goal) + " " + noTags((t.list || []).join(" "));
    ORDERS.forEach(([re]) => {
      if (re.test(words))
        hit(`урок ${l.num} ${l.id}: условие требует «${(re.exec(words) || [""])[0]}», а needCode нет`);
    });
  }));
  if (total === before) clean("все требования подкреплены");
}

/* ---------- 3. Первая подсказка выдаёт готовый ответ ----------
   Подсказки идут по нарастающей и стоят звезду. Если ПЕРВАЯ содержит целую
   строку решения, платить приходится сразу за всё, и ступенек нет. */
section("3. Первая подсказка содержит готовую строку решения");
{
  const before = total;
  CURRICULUM.forEach(w => w.lessons.forEach(l => {
    const b = (CONTENT["world" + w.n] || {})[l.id];
    if (!b || !b.task || !(b.task.hints || []).length) return;
    const first = String(b.task.hints[0]);
    const lines = String(b.task.solution || "").split("\n")
      .map(x => x.trim()).filter(x => x.length > 12 && !x.startsWith("#"));
    const leaked = lines.filter(x => first.indexOf(x) >= 0);
    /* Одна выданная строка из длинного решения — нормальный первый толчок.
       Важна ДОЛЯ: если первая подсказка выдаёт половину работы, ступенек нет
       и звезда снимается сразу за всё. */
    const share = lines.length ? leaked.length / lines.length : 0;
    if (share >= 0.34)
      hit(`урок ${l.num} ${l.id}: первая подсказка выдаёт ${leaked.length} из ${lines.length} строк решения — «${leaked[0].slice(0, 46)}»`);
  }));
  if (total === before) clean("первые подсказки никого не выдают");
}

/* ---------- 4. Пример в теории, который ничего не печатает ----------
   Карточка с примером, который молчит, читается как сломанная: ребёнок жмёт
   «Запустить пример» и не видит ничего. Исключение — рисование черепашкой
   и примеры, помеченные err:true (они и должны падать). */
section("4. Пример теории без вывода");
{
  const before = total;
  CURRICULUM.forEach(w => w.lessons.forEach(l => {
    const b = (CONTENT["world" + w.n] || {})[l.id];
    if (!b || b.draw) return;
    (b.theory || []).forEach((t, i) => {
      if (!t.demo || t.err) return;
      const r = MP.run(t.demo, { turtle: new MP.Turtle(), sources: t.files || {},
                                 files: t.data || {}, stdin: t.stdin || [] });
      if (!r.error && (!r.output || !r.output.trim()))
        hit(`урок ${l.num} ${l.id}, пример ${i + 1} «${t.h}»: ничего не печатает`);
    });
  }));
  if (total === before) clean("все примеры что-то печатают");
}

console.log("\n\nвсего находок: " + total + (total ? "  — смотреть глазами, порога тут нет" : ""));
