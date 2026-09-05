/* ============================================================
   Проверка банка задач-близнецов (js/homework.js).

   Каждую задачу гоняем на многих семенах — потому что числа берутся из семени,
   и «работает на одном наборе» ничего не значит: у другого ребёнка выпадет
   другой, и падать оно будет уже у него.

   Что проверяем на КАЖДОМ семени:
     1. эталон выполняется без ошибок и что-то печатает
     2. вывод не бесконечный (иначе он не влезет ни в ссылку, ни на экран)
     3. в эталоне нет случайности и input() — вердикт обязан быть повторяемым
     4. эталон удовлетворяет собственному need и не нарушает собственный ban
     5. заготовка выполняется без ошибок и НЕ даёт правильного ответа
     6. условие называет числа, которые нужны для решения
     7. одно и то же семя даёт один и тот же набор чисел (детерминированность)
   Один раз на задачу:
     8. after — настоящий id урока из curriculum.js
     9. id уникален; есть title, tag, hints
   Запуск: node tests/homework.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

require(path.join(root, "js/engine-mini.js"));
const MP = globalThis.MiniPy;

global.window = global;
eval(fs.readFileSync(path.join(root, "js/curriculum.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "js/homework.js"), "utf8"));

const HW = global.HW;
const BANK = global.HOMEWORK;

let problems = 0;
const say = m => { problems++; console.log(m); };

const runner = code => MP.run(code, { stdin: [] });

/* тот же поиск куска кода, что в app.js и в tests/lessons.js */
function codeHas(code, needle){
  const esc = String(needle).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pre = /^[A-Za-z0-9_]/.test(needle) ? "\\b" : "";
  const post = /[A-Za-z0-9_]$/.test(needle) ? "\\b" : "";
  return new RegExp(pre + esc + post).test(code);
}

const BAN_RANDOM = /\b(randint|choice|shuffle|sample|random)\s*\(|\binput\s*\(/;
const SEEDS = [1, 2, 3, 7, 11, 23, 42, 99, 137, 404, 777, 2026];
const OUT_MAX = 4000;          /* столько знаков вывода — уже перебор */
/* ключи параметров, которых в условии быть не обязано: это «сырьё» для fix,
   а не число, которое видит ребёнок */
const SILENT = ["seedy"];

const seen = {};
let checked = 0;

if (!Array.isArray(BANK) || !BANK.length) say("[банк] HOMEWORK пуст — проверять нечего");

BANK.forEach(item => {
  const id = item.id;
  if (!id) { say("[схема] у задачи нет id"); return; }
  if (seen[id]) say(`[схема] ${id}: такой id уже был — прогресс двух задач склеится`);
  seen[id] = 1;

  if (!item.after) say(`[схема] ${id}: не указан after — непонятно, после какого урока давать`);
  else if (!CURRICULUM.byId(item.after))
    say(`[схема] ${id}: after «${item.after}» — такого урока в курсе нет`);
  if (!item.title) say(`[схема] ${id}: нет названия`);
  if (!item.tag) say(`[схема] ${id}: нет подписи tag`);
  if (typeof item.goal !== "function") say(`[схема] ${id}: goal должен быть функцией от чисел`);
  if (typeof item.code !== "function") say(`[схема] ${id}: code должен быть функцией от чисел`);
  if (!Array.isArray(item.hints) || item.hints.length < 2)
    say(`[схема] ${id}: подсказок меньше двух — застрявшему ребёнку не на что опереться`);
  if (item.need && !item.needMsg) say(`[схема] ${id}: есть need, но нет needMsg — ребёнок не поймёт отказ`);
  if (item.ban && !item.banMsg) say(`[схема] ${id}: есть ban, но нет banMsg`);

  SEEDS.forEach(seed => {
    checked++;
    const built = HW.build(item, seed, runner);
    if (built.error) {
      say(`[эталон] ${id} (семя ${seed}): ${built.error.msg || built.error}`);
      return;
    }
    const code = item.code(HW.vals(item, seed));

    if (BAN_RANDOM.test(code))
      say(`[случайность] ${id} (семя ${seed}): в эталоне random или input — ответ перестал быть повторяемым`);

    if (built.lines.join("\n").length > OUT_MAX)
      say(`[вывод] ${id} (семя ${seed}): вывод длиннее ${OUT_MAX} знаков`);

    (item.need || []).forEach(n => {
      if (!codeHas(code, n))
        say(`[need] ${id} (семя ${seed}): сам эталон не содержит «${n}», а от ребёнка это требуется`);
    });
    (item.ban || []).forEach(n => {
      if (codeHas(code, n))
        say(`[ban] ${id} (семя ${seed}): эталон содержит запрещённое задачей «${n}»`);
    });

    /* заготовка: обязана запускаться и обязана НЕ решать задачу */
    const st = runner(built.starter);
    if (st.error)
      say(`[заготовка] ${id} (семя ${seed}): не запускается — «${st.error.msg}». ` +
          `Ребёнок увидит красный текст до того, как что-то напишет`);
    else if (st.lines.length === built.lines.length &&
             st.lines.every((x, i) => x === built.lines[i]))
      say(`[заготовка] ${id} (семя ${seed}): заготовка уже даёт правильный ответ — задание засчитается само`);

    /* условие обязано называть числа, которые нужны для решения */
    const goal = built.goal;
    (item.params || []).forEach(p => {
      if (SILENT.indexOf(p.k) >= 0) return;
      const val = String(built.vals[p.k]);
      if (goal.indexOf(val) < 0)
        say(`[условие] ${id} (семя ${seed}): в условии нет значения «${val}» (параметр ${p.k}) — ` +
            `решающий не увидит программы и не узнает это число`);
    });
    if (goal.length < 40) say(`[условие] ${id} (семя ${seed}): условие короче 40 знаков`);

    /* детерминированность: то же семя — те же числа */
    const again = HW.vals(item, seed);
    if (JSON.stringify(again) !== JSON.stringify(built.vals))
      say(`[семя] ${id} (семя ${seed}): при повторном вычислении числа другие — ` +
          `у ребёнка и у наставника разойдутся условия`);
  });
});

/* Доступность по прогрессу: задача не должна открываться раньше своего урока. */
{
  const nothing = HW.available([]);
  if (nothing.length) say(`[доступ] при нулевом прогрессе открыто ${nothing.length} задач — ` +
    `ребёнку дадут то, чего ему не объясняли`);
  const one = BANK[0];
  const got = HW.available([one.after]);
  if (!got.some(x => x.id === one.id))
    say(`[доступ] пройден урок «${one.after}», а задача ${one.id} всё равно закрыта`);
}

/* Покрытие: банк обязан доставать до каждого из первых трёх миров, иначе
   домашку нечего задать половине курса. */
{
  const worlds = {};
  BANK.forEach(it => {
    const l = CURRICULUM.byId(it.after);
    if (l) worlds[l.world] = (worlds[l.world] || 0) + 1;
  });
  [1, 2, 3].forEach(w => {
    if (!worlds[w]) say(`[покрытие] в мире ${w} нет ни одной задачи-близнеца`);
  });
}

/* Сверка с настоящим Python — тот же принцип, что в tests/content-vs-python.js:
   вывод эталона у движка и у python3 обязан совпасть символ в символ. Иначе
   ребёнок, решивший задачу дома в настоящем Python, получит у нас «Ещё не то».
   Без python3 на машине пропускаем и говорим об этом вслух, а не молчим. */
{
  const os = require("os");
  const { execFileSync } = require("child_process");
  let hasPy = true;
  try { execFileSync("python3", ["--version"], { stdio: "ignore" }); }
  catch(e){ hasPy = false; }
  if (!hasPy){
    console.log("⚠️ python3 не найден — сверка эталонов с настоящим Python пропущена.");
  } else {
    const tmp = path.join(os.tmpdir(), "kodokvest-hw-check.py");
    let compared = 0;
    BANK.forEach(item => {
      [1, 42, 2026].forEach(seed => {
        const code = item.code(HW.vals(item, seed));
        const mini = runner(code);
        if (mini.error) return;                 /* об этом уже сказано выше */
        fs.writeFileSync(tmp, code);
        let py;
        try { py = execFileSync("python3", [tmp], { encoding: "utf8" }); }
        catch(e){
          say(`[python] ${item.id} (семя ${seed}): эталон падает в настоящем Python: ` +
              String(e.stderr || e).slice(0, 200));
          return;
        }
        compared++;
        const a = (mini.lines || []).join("\n").replace(/\s+$/, "");
        const b = String(py).replace(/\r/g, "").replace(/\s+$/, "");
        if (a !== b)
          say(`[python] ${item.id} (семя ${seed}): движок и python3 печатают разное:\n` +
              `  движок: ${JSON.stringify(a.slice(0, 120))}\n  python: ${JSON.stringify(b.slice(0, 120))}`);
      });
    });
    console.log(`Сверено с настоящим Python: ${compared} прогонов.`);
  }
}

console.log(`Задач в банке: ${BANK.length}, прогонов: ${checked}.`);
if (problems) {
  console.log(`\nНайдено проблем: ${problems}`);
  process.exit(1);
}
console.log("Все задачи-близнецы в порядке.");
