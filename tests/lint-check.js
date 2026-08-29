/* ============================================================
   Разбор кода против самого курса. Запуск:
       node build.js && node tests/lint-check.js
   В `npm test` НЕ входит: часть находок законна и требует глаз.

   Что делает: прогоняет разбор («что можно сделать чище») по ВСЕМ эталонным
   решениям автора — сто уроков, шаги шести проектов, примеры теории — и
   печатает всё, что нашлось, с разбивкой по правилам.

   Зачем: у советов ребёнку нет права быть неправдой. Решения автора — самый
   честный корпус, какой есть: если совет появляется на них, это либо
   настоящий недосмотр в курсе (тогда чинить содержание), либо ложная находка
   (тогда чинить правило). Молчание на всех ста решениях само по себе ничего
   не доказывает — поэтому внизу печатается и проверка наоборот: на нарочно
   грязной программе каждое правило обязано сработать.

   Гейты по прогрессу здесь сняты (`all: true`): проверяем сами правила, а не
   то, что ребёнок уже прошёл.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require("jsdom")); }
catch (e){ console.log("Нужен jsdom:  npm install jsdom"); process.exit(2); }

const file = path.join(root, "dist/kodokvest.html");
if (!fs.existsSync(file)){ console.log("Сначала собери один файл:  node build.js"); process.exit(1); }

const vc = new VirtualConsole();
const dom = new JSDOM(fs.readFileSync(file, "utf8"),
  { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    url: "https://example.invalid/kodokvest/" });
const w = dom.window;
w.scrollTo = function(){};
w.requestAnimationFrame = function(){ return 0; };
w.HTMLCanvasElement.prototype.getContext = function(){
  if (this.__ctx) return this.__ctx;
  const noop = function(){};
  this.__ctx = { fillStyle:"", strokeStyle:"", lineWidth:1, setTransform:noop, clearRect:noop,
    fillRect:noop, beginPath:noop, closePath:noop, moveTo:noop, lineTo:noop, arc:noop,
    stroke:noop, fill:noop, save:noop, restore:noop, translate:noop, rotate:noop,
    scale:noop, fillText:noop, measureText:function(){ return { width:0 }; } };
  return this.__ctx;
};

/* нарочно грязная программа: на ней каждое правило обязано сработать */
const DIRTY = {
  "цикл вместо sum": 'nums = [1, 2, 3]\nитог = 0\nfor n in nums:\n    итог = итог + n\nprint(итог)\n',
  "цикл вместо len": 'nums = [1, 2, 3]\nсколько = 0\nfor n in nums:\n    сколько += 1\nprint(сколько)\n',
  "range(len())": 'nums = [1, 2, 3]\nfor i in range(len(nums)):\n    print(nums[i])\n',
  "лишняя переменная": 'нужное = 5\nлишнее = 10\nprint(нужное)\n',
  "сравнение с True": 'готово = True\nif готово == True:\n    print("да")\n',
  "len() > 0": 'nums = [1]\nif len(nums) > 0:\n    print("есть")\n',
  "три одинаковые строки": 'print("одна и та же строка")\nprint("одна и та же строка")\nprint("одна и та же строка")\n',
  "магическое число": 'a = 60 * 2\nb = 60 * 3\nc = 60 * 4\nprint(a, b, c)\n',
  "x = x + 1": 'счёт = 0\nсчёт = счёт + 1\nprint(счёт)\n',
  "camelCase": 'myScore = 5\nprint(myScore)\n',
  "длинная функция": 'def всё():\n' + Array.from({length:17}, (_,i)=>`    print(${i})`).join("\n") + '\n\n\nвсё()\n'
};

setTimeout(function(){
  const g = w.__game;
  if (!g || !g.lintCode){ console.log("Разбор кода не выведен наружу"); process.exit(1); }
  const CUR = w.CURRICULUM, CONTENT = w.CONTENT, PROJECTS = w.PROJECTS || [];

  const byRule = {};
  let programs = 0, withFindings = 0, skippedModules = 0;
  const add = (where, f) => {
    (byRule[f.title.replace(/[«»].*$/, "").slice(0, 34)] = byRule[f.title.replace(/[«»].*$/, "").slice(0, 34)] || [])
      .push({ where, f });
  };
  const look = (where, code) => {
    if (!code || !String(code).trim()) return;
    programs++;
    const found = g.lintCode(code, { all: true });
    if (found === null) return;                 /* не разбирается — не наше дело */
    if (found.length) withFindings++;
    found.forEach(f => add(where, f));
  };

  /* эталонные решения и заготовки всех уроков плюс примеры теории */
  CUR.forEach(world => {
    const c = CONTENT["world" + world.n];
    if (!c) return;
    world.lessons.forEach(l => {
      const body = c[l.id];
      if (!body || !body.task) return;
      look(`урок ${l.num} ${l.id} (решение)`, body.task.solution);
      (body.theory || []).forEach((t, i) => {
        if (t.demo) look(`урок ${l.num} ${l.id} (пример ${i + 1})`, t.demo);
      });
      /* Подключаемые файлы НЕ разбираем, и это не лень: константы из модуля
         читает другой файл, а разбор видит один. Ребёнку такой разбор тоже
         не предлагается — на многофайловом уроке кнопки «Ревью» нет. */
      skippedModules += (body.task.files || []).length;
    });
  });
  /* шаги проектов: там программы длиннее всего, и находки вероятнее */
  PROJECTS.forEach(p => (p.steps || []).forEach((s, i) => {
    look(`проект ${p.id} шаг ${i + 1}`, s.solution);
  }));

  const names = Object.keys(byRule).sort((a, b) => byRule[b].length - byRule[a].length);
  console.log(`Разбор прогнан по ${programs} программам автора. Правил сработало: ${names.length}.\n`);
  names.forEach(n => {
    const list = byRule[n];
    console.log(`  ${String(list.length).padStart(3)} × ${n}`);
    list.slice(0, 4).forEach(x => console.log(`        ${x.where}, строка ${x.f.line}: ${x.f.title}`));
    if (list.length > 4) console.log(`        …и ещё ${list.length - 4}`);
  });
  console.log(`\nпрограмм с находками: ${withFindings} из ${programs}`);
  (function(){
    /* Размер корпуса назван в README словами — сверяем, чтобы не разошлось. */
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    const m = /по всем (\d+) эталонн/.exec(readme);
    if (m && +m[1] !== programs)
      console.log(`README говорит «${m[1]} эталонных программ», а их ${programs} — поправь README.md`);
  })();
  console.log(`подключаемых файлов пропущено: ${skippedModules} — их имена читает другой файл`);

  /* обратная проверка: на грязной программе правило ОБЯЗАНО сработать */
  console.log("\nПроверка наоборот — нарочно грязные программы:");
  let silent = 0;
  Object.keys(DIRTY).forEach(name => {
    const found = g.lintCode(DIRTY[name], { all: true });
    const ok = found && found.length;
    if (!ok) silent++;
    console.log(`  ${ok ? "✓" : "✗ МОЛЧИТ"}  ${name}${ok ? " → " + found[0].title : ""}`);
  });
  if (silent) console.log(`\nПравил, которые не сработали на своей же грязи: ${silent} — это дефект.`);
  console.log("\nСмотреть глазами: находка на решении автора — либо недосмотр в курсе, либо ложное правило.");
  process.exit(silent ? 1 : 0);
}, 200);
