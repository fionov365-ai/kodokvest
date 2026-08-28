/* Служебный инструмент для редакторского прохода. В npm test НЕ входит.
   Запуск:  node tests/echo-check.js

   Показывает, какая доля содержательных строк решения встречается дословно
   в примерах теории ТОГО ЖЕ урока. Это про граблю 13: «если решение
   собирается копированием строк из примеров сверху — урок пустой».

   ВАЖНО: это подсказка, а не приговор, и поэтому в автоматические проверки
   она не годится. Высокая доля бывает совершенно законной:
     - у заданий «починить» решение и обязано совпадать с образцом;
     - у уроков с каркасом (двумерное поле, черепашка) совпадают именно те
       строки, которые урок и должен был дать готовыми, а думать ребёнку
       остаётся над условием внутри;
     - короткие строки вроде penup() совпадают неизбежно.
   Порог тут поставить нельзя — список надо смотреть глазами и открывать
   верхние уроки целиком. Три настоящих находки из первого прогона
   (range-step, comp-basic, proj-field) выглядели в списке ровно так же,
   как ложные, — отличить их удалось только чтением.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

global.window = {};
let CONTENT = {};
eval(read("js/curriculum.js"));
["content/world1.js","content/world2.js","content/world3.js","content/world4.js","content/world5.js"]
  .forEach(f => eval(read(f)));

/* содержательные строки: без пустых, без комментариев и без совсем коротких */
const meaningful = s => String(s || "").split("\n")
  .map(x => x.trim())
  .filter(x => x && !x.startsWith("#") && x.length > 6);

const rows = [];
CURRICULUM.forEach(w => w.lessons.forEach(l => {
  const b = (CONTENT["world" + w.n] || {})[l.id];
  if (!b || !b.task || !b.task.solution) return;
  const isFix = b.task.type === "fix";
  const demo = new Set();
  (b.theory || []).forEach(t => [t.demo, t.show].filter(Boolean)
    .forEach(c => meaningful(c).forEach(x => demo.add(x))));
  /* строки, уже данные в заготовке, ребёнок не пишет — они не в счёт */
  const given = new Set(meaningful(b.task.starter));
  const sol = meaningful(b.task.solution).filter(x => !given.has(x));
  if (!sol.length) return;
  const hit = sol.filter(x => demo.has(x)).length;
  rows.push({ num: l.num, id: l.id, isFix, share: hit / sol.length, hit, total: sol.length });
}));

rows.sort((a, b) => b.share - a.share);
console.log("Доля строк решения, дословно взятых из примеров того же урока.");
console.log("Смотреть глазами: высокая доля НЕ равна дефекту (см. шапку файла).\n");
rows.filter(r => r.share >= 0.4).forEach(r => console.log(
  `  ${String(Math.round(r.share * 100)).padStart(3)}%  урок ${String(r.num).padStart(3)} ` +
  `${r.id.padEnd(14)} ${r.hit} из ${r.total}${r.isFix ? "   (починить — совпадение законно)" : ""}`));
console.log(`\nвсего уроков с заданием: ${rows.length}, из них 40% и выше: ${rows.filter(r => r.share >= 0.4).length}`);
