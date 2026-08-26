/* ============================================================
   Сквозная проверка игры в настоящем DOM (jsdom).
   Что проверяем на каждом уроке с контентом:
     1. урок открывается, редактор появляется
     2. эталонное решение засчитывается — окно победы показывается
     3. заготовка НЕ засчитывается
     4. у заданий «починить» переписанный с нуля код НЕ засчитывается,
        даже если вывод правильный
     5. кнопка «Вернуть как было» есть только у заданий «починить»
   Отдельно: панель наставника (код, статистика, снятие замков).
   Считаем все ошибки JavaScript — их должно быть ноль.

   Нужен jsdom:  npm install jsdom
   Запуск:       node build.js && node tests/full-run.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require("jsdom")); }
catch(e){
  console.log("Для этой проверки нужен jsdom. Установи его командой:\n  npm install jsdom");
  process.exit(2);
}

const file = path.join(root, "dist/kodokvest.html");
if (!fs.existsSync(file)){
  console.log("Сначала собери один файл:  node build.js");
  process.exit(1);
}

const jsErrors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => jsErrors.push("ошибка JS: " + (e && e.message)));
vc.on("error", (...a) => jsErrors.push("console.error: " + a.join(" ")));

/* Файл берём как есть, целиком: он должен быть готовым html-документом.
   Раньше тест сам оборачивал сборку в <html><head><meta charset>…</head> —
   и поэтому не заметил, что build.js собирал файл без объявления кодировки.
   Проверять надо ровно то, что открывает человек. */
const rawBytes = fs.readFileSync(file);
const html = rawBytes.toString("utf8");

const dom = new JSDOM(html,
  { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    url: "https://example.invalid/kodokvest/" });

const w = dom.window;
const doc = w.document;
/* Заглушки того, чего в jsdom нет по умолчанию.
   Холст подменяем не пустышкой, а записывающим контекстом: тогда код
   отрисовки выполняется целиком и настоящие ошибки в нём будут видны. */
w.scrollTo = function(){};
w.requestAnimationFrame = function(){ return 0; };
w.cancelAnimationFrame = function(){};
const drawCalls = { n:0 };
w.HTMLCanvasElement.prototype.getContext = function(){
  if (this.__ctx) return this.__ctx;
  const noop = function(){ drawCalls.n++; };
  this.__ctx = {
    fillStyle:"", strokeStyle:"", lineWidth:1, lineCap:"", lineJoin:"", font:"",
    setTransform:noop, clearRect:noop, fillRect:noop, strokeRect:noop,
    beginPath:noop, closePath:noop, moveTo:noop, lineTo:noop, arc:noop,
    stroke:noop, fill:noop, save:noop, restore:noop, translate:noop,
    rotate:noop, scale:noop, fillText:noop, measureText:function(){ return { width:0 }; }
  };
  return this.__ctx;
};

/* Конкретные обходные пути: вывод верный, но урок не пройден по сути.
   Такой код защита обязана отклонить. */
const BYPASS = {
  "errors-read": {
    "выкинуть сломанную строку целиком": 'price = 450\ncount = 3\nprint("Итого:", price * count)',
    "свернуть всё в один print": 'print("Итого:", 450 * 3)'
  },
  "for-nested": {
    "переписать двумя строками": 'for row in range(3):\n    print("####")',
    "заменить тремя print": 'print("####")\nprint("####")\nprint("####")'
  },
  "break-cont": {
    "переписать через for": 'for n in range(1, 16):\n    if n % 4 == 0:\n        continue\n    print(n)'
  },
  "slices": {
    "выписать числа руками": 'nums = [1, 2, 3, 4, 5, 6, 7]\nprint([1, 2, 3])\nprint([5, 6, 7])',
    "выбросить срезы совсем": 'print([1, 2, 3])\nprint([5, 6, 7])'
  },
  "grid": {
    "заменить тремя print": 'print("...")\nprint(".*.")\nprint("...")',
    "собрать строки вручную": 'print("." * 3)\nprint("." + "*" + ".")\nprint("." * 3)'
  },
  "files-write": {
    "выписать журнал руками": 'with open("журнал.txt", "w") as f:\n    f.write("журнал работ\\nшаг 0\\nшаг 1\\nшаг 2\\n")\n\nwith open("журнал.txt") as f:\n    print(f.read())',
    "собрать строки в списке и записать один раз": 'lines = ["журнал работ"]\nfor i in range(3):\n    lines.append(f"шаг {i}")\n\nwith open("журнал.txt", "w") as f:\n    f.write("\\n".join(lines) + "\\n")\n\nwith open("журнал.txt") as f:\n    print(f.read())'
  },
  "debug": {
    "посчитать через count": 'answers = ["5", "3", "5", "7"]\nprint("Верных:", answers.count("5"))',
    "выписать ответ руками": 'print("Верных:", 2)'
  },
  "fn-default": {
    "печатать готовые списки": 'print(["хлеб"])\nprint(["молоко"])\nprint(["сыр"])',
    "передавать пустой список в каждом вызове":
      'def buy(item, cart=[]):\n    cart.append(item)\n    return cart\n\n\nprint(buy("хлеб", []))\nprint(buy("молоко", []))\nprint(buy("сыр", []))'
  },
  "dict-counter": {
    "выписать готовый словарь": 'print({"кот": 3, "пёс": 2, "ёж": 1})',
    "собрать словарь вручную": 'counts = {"кот": 3, "пёс": 2, "ёж": 1}\nprint(counts)'
  }
};

/* Эмулируем вернувшегося ученика: код уже задан на устройстве, поэтому старт
   ведёт на карту миров, а не на экран регистрации. Ставим до того, как boot
   (allWorldsContent().then) успеет отработать. */
try { w.localStorage.setItem("kodokvest_code", "test-kid"); } catch(e){}

const problems = [];
const bad = m => problems.push(m);
const tick = (ms) => new Promise(r => setTimeout(r, ms || 12));

function viewReset(g){ if (g.screenWorlds) g.screenWorlds(); }
function studioOf(){
  const s = w.__game.getSession();
  return s && s.studio ? s.studio : null;
}
function msgText(){
  const m = doc.querySelector("#studio .msg");
  return m ? m.textContent.trim().replace(/\s+/g, " ").slice(0, 150) : "(сообщения нет)";
}
function won(){ return doc.getElementById("win").classList.contains("show"); }
function closeWin(){
  const b = doc.getElementById("wstay");
  if (b) b.click();
  else doc.getElementById("win").classList.remove("show");
}
/* code — либо текст главного файла, либо список файлов урока
   [{name, code}, ...] для уроков про модули. */
async function attempt(id, code){
  w.__game.openLesson(id);
  await tick();
  const st = studioOf();
  if (!st) return { ok:false, why:"урок не открылся" };
  if (Array.isArray(code)) st.editor.setFiles(code);
  else st.editor.setCode(code);
  const btn = st.querySelector('[data-role="check"]');
  if (!btn) return { ok:false, why:"нет кнопки «Проверить»" };
  btn.click();
  await tick();
  const res = { ok: won(), why: msgText(), studio: st };
  if (res.ok) closeWin();
  return res;
}

/* ---------- кодировка и каркас документа ----------
   jsdom получает уже раскодированную строку, поэтому сам по себе неверный
   charset он не поймает. Проверяем байты: объявление кодировки обязано стоять
   раньше первого русского символа — иначе браузер, открывающий файл с диска,
   угадает кодировку неправильно и весь текст станет «РљРѕРґРѕРєРІРµСЃС‚». */
function checkEncoding(){
  if (!/^\s*<!doctype html>/i.test(html))
    bad("[каркас] файл не начинается с <!doctype html>");
  if (!/<html[^>]*\slang=/i.test(html))
    bad("[каркас] у <html> не указан язык");
  const declAt = rawBytes.indexOf(Buffer.from('<meta charset="utf-8">', "utf8"));
  let firstNonAscii = -1;
  for (let i = 0; i < rawBytes.length; i++){ if (rawBytes[i] > 127){ firstNonAscii = i; break; } }
  if (declAt < 0){
    bad('[кодировка] нет <meta charset="utf-8"> — при открытии файла с диска русский текст поедет');
  } else if (firstNonAscii >= 0 && declAt > firstNonAscii){
    bad(`[кодировка] <meta charset> стоит после первого русского символа (байт ${declAt} против ${firstNonAscii})`);
  }
}

(async function(){
  await tick(60);
  checkEncoding();
  if (!/Кодоквест/.test(doc.title))
    bad(`[каркас] в заголовке страницы нет названия: «${doc.title}»`);

  if (!w.__game){ console.log("Игра не запустилась: window.__game не появился"); process.exit(1); }
  const CUR = w.CURRICULUM, CONTENT = w.CONTENT, g = w.__game;

  /* прогресс чистый: убеждаемся, что открылась карта миров */
  if (!doc.querySelector(".worlds")) bad("стартовый экран: список миров не отрисовался");

  let checked = 0, fixChecked = 0;

  for (const world of CUR){
    const c = CONTENT["world" + world.n];
    if (!c) continue;
    for (const l of world.lessons){
      const body = c[l.id];
      if (!body) continue;
      checked++;
      const task = body.task;
      const isFix = task.type === "fix";

      /* уроки из нескольких файлов: главный плюс модули */
      const many = !!(task.files && task.files.length);
      const solFiles = many
        ? [{ name: task.mainName || "main.py", code: task.solution }].concat(
            task.files.map(f => ({ name:f.name, code: f.solution !== undefined ? f.solution : f.starter })))
        : null;
      const stFiles = many
        ? [{ name: task.mainName || "main.py", code: task.starter }].concat(
            task.files.map(f => ({ name:f.name, code:f.starter })))
        : null;

      /* 2. решение должно проходить */
      const sol = await attempt(l.id, many ? solFiles : task.solution);
      if (!sol.ok) bad(`[решение] ${l.id}: не засчитано — ${sol.why}`);
      if (many && sol.studio){
        const tabs = sol.studio.querySelectorAll(".ftab").length;
        if (tabs !== task.files.length + 1)
          bad(`[файлы] ${l.id}: вкладок ${tabs}, а файлов ${task.files.length + 1}`);
      }

      /* 5. кнопка возврата — только у «починить» */
      if (sol.studio){
        const hasRestore = !!sol.studio.querySelector('[data-role="restore"]');
        if (isFix && !hasRestore) bad(`[кнопки] ${l.id}: у задания «починить» нет кнопки «Вернуть как было»`);
        if (!isFix && hasRestore) bad(`[кнопки] ${l.id}: кнопка «Вернуть как было» лишняя в обычном задании`);
      }

      /* 3. заготовка не должна проходить */
      const st = await attempt(l.id, many ? stFiles : task.starter);
      if (st.ok) bad(`[заготовка] ${l.id}: засчитана как решение — задание проходится само собой`);

      /* 4. у «починить» переписанный код не должен проходить */
      if (isFix){
        fixChecked++;
        const rewritten = "_a = 1\n_b = 2\n_c = 3\n_d = 4\n_e = 5\n" + task.solution;
        const rw = await attempt(l.id, rewritten);
        if (rw.ok) bad(`[починка] ${l.id}: код, переписанный заново, засчитан — защита не сработала`);
        const cases = BYPASS[l.id] || {};
        for (const name of Object.keys(cases)){
          const r = await attempt(l.id, cases[name]);
          if (r.ok) bad(`[починка] ${l.id}: обходной путь «${name}» засчитан — защита не сработала`);
        }
        if (!BYPASS[l.id]) bad(`[починка] ${l.id}: нет ни одного обходного пути в списке BYPASS теста`);
      }
    }
  }

  /* ---------- панель наставника ---------- */
  g.screenAdmin();
  await tick();
  const codeInput = doc.getElementById("admcode");
  if (!codeInput) bad("[панель] экран ввода кода не появился");
  else {
    codeInput.value = "неверный код";
    doc.getElementById("admgo").click();
    await tick();
    if (doc.getElementById("admcode") === null) bad("[панель] пустила внутрь с неверным кодом");
    doc.getElementById("admcode").value = g.ADMIN_CODE;
    doc.getElementById("admgo").click();
    await tick();
  }
  const rows = doc.querySelectorAll(".admrowl");
  if (rows.length !== CUR.total) bad(`[панель] строк в таблице ${rows.length}, а уроков ${CUR.total}`);
  if (!doc.querySelector(".admstats")) bad("[панель] сводка не отрисовалась");
  if (!doc.getElementById("admjson")) bad("[панель] поля переноса прогресса нет");

  /* снятие замков */
  const before = g.state.admin.unlockAll;
  doc.querySelector('[data-act="unlockall"]').click();
  await tick();
  if (g.state.admin.unlockAll === before) bad("[панель] кнопка «Открыть все уроки» не переключается");
  g.screenWorld(2);
  await tick();

  /* зачесть и сбросить один урок */
  g.setStars("print-first", 0);
  const xp0 = g.state.xp;
  g.setStars("print-first", 3);
  if (g.state.stars["print-first"] !== 3) bad("[панель] «зачесть» не поставило три звезды");
  if (g.state.xp !== xp0 + 100) bad(`[панель] XP после зачёта ${g.state.xp}, ожидалось ${xp0 + 100}`);
  g.setStars("print-first", 0);
  if (g.state.stars["print-first"] !== undefined) bad("[панель] «сбросить» не убрало звёзды");
  if (g.state.xp !== xp0) bad("[панель] XP после сброса не вернулся к прежнему");

  /* ---------- синхронизация с сервером ----------
     Подменяем только fetch. Дальше работает настоящая серверная функция
     из cloud/index.js, а вместо смонтированного бакета — временная папка.
     То есть проверяется вся цепочка целиком, а не заглушки. */
  viewReset(g);
  const os = require("os");
  const cloudDir = fs.mkdtempSync(path.join(os.tmpdir(), "kq-sync-"));
  process.env.DATA_DIR = cloudDir;
  process.env.ADMIN_KEY = "kluch-testa";
  const srv = require("../cloud/index.js");
  let calls = 0;
  w.fetch = function(u, opt){
    calls++;
    const url = new w.URL(String(u), "https://srv.invalid/");
    const q = {};
    url.searchParams.forEach(function(v, k){ q[k] = v; });
    const ev = { httpMethod: (opt && opt.method) || "GET", queryStringParameters: q,
                 body: opt && opt.body };
    return Promise.resolve(srv.handler(ev)).then(function(r){
      return { ok: r.statusCode >= 200 && r.statusCode < 300, status: r.statusCode,
               text: function(){ return Promise.resolve(r.body); } };
    });
  };

  /* --- слияние: проверяем чистую функцию на неудобных случаях --- */
  const A = { xp:100, stars:{ a:3, b:1 }, badges:["first"], savedAt:2000,
              log:{ a:{ attempts:5, hints:0, timeMs:60000, first:500, last:2000 } }, sandbox:"код А" };
  const B = { xp:60,  stars:{ b:3, c:2 }, badges:["ten"],   savedAt:1000,
              log:{ a:{ attempts:2, hints:3, timeMs:90000, first:100, last:1500 } }, sandbox:"код Б" };
  const M = g.mergeProgress(A, B);
  if (M.stars.a !== 3) bad(`[слияние] звёзды урока a: ${M.stars.a}, ожидалось 3`);
  if (M.stars.b !== 3) bad(`[слияние] звёзды урока b: ${M.stars.b}, ожидалось 3 (лучшее из 1 и 3)`);
  if (M.stars.c !== 2) bad(`[слияние] урок c из второй копии потерялся`);
  if (M.xp < 100) bad(`[слияние] опыт уменьшился: ${M.xp}`);
  if (M.badges.length !== 2) bad(`[слияние] бейджи не объединились: ${JSON.stringify(M.badges)}`);
  if (M.log.a.attempts !== 5) bad(`[слияние] попытки: ${M.log.a.attempts}, ожидалось 5`);
  if (M.log.a.hints !== 3) bad(`[слияние] подсказки: ${M.log.a.hints}, ожидалось 3`);
  if (M.log.a.timeMs !== 90000) bad(`[слияние] время: ${M.log.a.timeMs}, ожидалось 90000`);
  if (M.log.a.first !== 100) bad(`[слияние] первое занятие должно быть самым ранним: ${M.log.a.first}`);
  if (M.log.a.last !== 2000) bad(`[слияние] последнее занятие должно быть самым поздним: ${M.log.a.last}`);
  if (M.sandbox !== "код А") bad(`[слияние] песочница взята не из свежей копии: ${M.sandbox}`);
  if (M.admin !== undefined) bad("[слияние] настройки устройства не должны попадать в слияние");
  /* Слияние должно давать один и тот же результат при любом порядке копий.
     Сравниваем по значениям: порядок ключей в словаре звёзд ничего не значит. */
  const M2 = g.mergeProgress(B, A);
  const canon = o => Object.keys(o).sort().map(k => k + "=" + o[k]).join(",");
  if (canon(M2.stars) !== canon(M.stars))
    bad(`[слияние] звёзды зависят от порядка копий: ${canon(M.stars)} против ${canon(M2.stars)}`);
  if (M2.xp !== M.xp) bad(`[слияние] опыт зависит от порядка копий: ${M.xp} против ${M2.xp}`);
  if (canon(M2.log.a) !== canon(M.log.a))
    bad(`[слияние] журнал зависит от порядка копий`);
  if (M2.sandbox !== M.sandbox) bad("[слияние] песочница зависит от порядка копий");
  if (M2.badges.slice().sort().join() !== M.badges.slice().sort().join())
    bad("[слияние] бейджи зависят от порядка копий");

  /* --- отправка на сервер --- */
  w.CLOUD_CONFIG.url = "https://srv.invalid/fn";
  w.CLOUD_CONFIG.code = "test-kid";
  if (!w.Cloud.configured()) bad("[сервер] настройка не подхватилась");

  /* --- код ученика: настройка устройства, а не сайта --- */
  /* заглавные буквы не отклоняются, а приводятся к маленьким — как и на сервере */
  const badCodes = ["ab", "", "миша", "a b", "a/b", "a.b", "-abc", "x".repeat(40)];
  badCodes.forEach(function(c){
    if (w.Cloud.setCode(c)) bad(`[код] негодный код принят: ${JSON.stringify(c)}`);
  });
  if (w.Cloud.myCode() !== "test-kid")
    bad(`[код] после отказов код испортился: ${w.Cloud.myCode()}`);
  if (!w.Cloud.setCode("MISHA-7F3A")) bad("[код] годный код не принят");
  if (w.Cloud.myCode() !== "misha-7f3a")
    bad(`[код] код не приведён к маленьким буквам: ${w.Cloud.myCode()}`);
  w.Cloud.forgetCode();
  if (w.Cloud.myCode() !== "test-kid")
    bad(`[код] после сброса не вернулось значение из настроек: ${w.Cloud.myCode()}`);

  g.setStars("print-first", 3);
  g.setStars("vars", 2);
  await g.cloudPush().catch(e => bad("[сервер] отправка не удалась: " + e.message));
  const saved = fs.readdirSync(cloudDir);
  if (!saved.includes("test-kid.json")) bad(`[сервер] файл не появился: ${saved.join(", ")}`);
  const rec = JSON.parse(fs.readFileSync(path.join(cloudDir, "test-kid.json"), "utf8"));
  if (rec.data.stars["print-first"] !== 3) bad("[сервер] звёзды не доехали");
  if (rec.data.admin !== undefined) bad("[сервер] настройки устройства уехали на сервер");

  /* --- забрать обратно после локального сброса --- */
  g.setStars("print-first", 0);
  g.setStars("vars", 0);
  if (g.state.stars["print-first"] !== undefined) bad("[сервер] локальный сброс не сработал");
  await g.cloudPull().catch(e => bad("[сервер] чтение не удалось: " + e.message));
  if (g.state.stars["print-first"] !== 3)
    bad(`[сервер] прогресс не вернулся с сервера: ${JSON.stringify(g.state.stars["print-first"])}`);

  /* --- чужой прогресс: пишем под другим кодом, читаем через Cloud.load --- */
  const other = { v:2, xp:325, stars:{ "print-first":3, "text-vs-num":3, "vars":2 }, badges:["first","ten"],
                  log:{ "vars":{ attempts:4, hints:1, timeMs:300000, last:Date.now() } } };
  await w.Cloud.save(other, "anya-2b").catch(e => bad("[сервер] запись чужого кода: " + e.message));
  const got = await w.Cloud.load("anya-2b").catch(e => { bad("[сервер] чтение чужого кода: " + e.message); return null; });
  if (!got || !got.found || got.data.xp !== 325) bad("[сервер] чужой прогресс прочитан неверно");
  if (g.state.xp === 325) bad("[сервер] чтение чужого прогресса изменило свой — так нельзя");

  const lst = await w.Cloud.list("kluch-testa").catch(e => { bad("[сервер] список: " + e.message); return null; });
  if (!lst || (lst.students || []).length !== 2) bad(`[сервер] в списке ${lst && (lst.students||[]).length} учеников, ожидалось 2`);
  const badKey = await w.Cloud.list("не тот ключ").then(() => "пустили", () => "отказ");
  if (badKey !== "отказ") bad("[сервер] список открылся с неверным ключом наставника");

  /* --- панель показывает чужой прогресс, не трогая свой --- */
  const myXpBefore = g.state.xp;
  g.screenAdmin();
  await tick();
  const codeField = doc.getElementById("othercode");
  if (!codeField) bad("[панель] нет поля для кода другого ученика");
  else {
    codeField.value = "anya-2b";
    doc.querySelector('[data-act="viewother"]').click();
    await tick(40);
    const head = (doc.querySelector("h1") || {}).textContent || "";
    if (!/anya-2b/.test(head)) bad(`[панель] не переключилась на чужой прогресс: «${head}»`);
    if (doc.querySelectorAll('.admrowl .acts .minibtn').length)
      bad("[панель] в режиме просмотра остались кнопки изменения");
    if (g.state.xp !== myXpBefore) bad("[панель] просмотр чужого прогресса изменил свой");
    const back = doc.querySelector('[data-act="myown"]');
    if (!back) bad("[панель] нет кнопки возврата к своему прогрессу");
    else { back.click(); await tick(); }
  }
  if (!doc.getElementById("othercode")) bad("[панель] возврат к своему прогрессу не сработал");
  if (calls < 4) bad(`[сервер] запросов к серверу было всего ${calls} — цепочка не проверена`);

  try { fs.rmSync(cloudDir, { recursive:true, force:true }); } catch(e){}
  w.CLOUD_CONFIG.url = ""; w.CLOUD_CONFIG.code = "";

  g.stopTimer();
  await tick();

  /* --- игры: каждая открывается, начинает партию и играется до конца --- */
  let gamesChecked = 0;
  const GAMES = w.GAMES || [];
  if (!GAMES.length) bad("[игры] список игр пуст — js/games.js не подключён");
  /* заранее заготовленные ходы, чтобы довести каждую игру до конца */
  const MOVES = {
    guess: ["50","75","88","94","97","99","100","1","2","3","4","5","6","7","8","9","10",
            "20","30","40","60","70","80","90","95","98"],
    rps: Array(30).fill("камень"),
    ttt: ["1","2","3","4","5","6","7","8","9"],
    quiz: ["1","1","1","1","1","1"],
    adventure: ["1","1","2","2","1","2"]
  };
  for (const game of GAMES){
    g.openGame(game.id);
    await tick();
    const st = studioOf();
    if (!st){ bad(`[игры] ${game.id}: экран игры не открылся`); continue; }
    const runBtn = st.querySelector('[data-role="run"]');
    if (!runBtn){ bad(`[игры] ${game.id}: нет кнопки «Новая игра»`); continue; }
    runBtn.click();               // начать партию
    await tick();
    const input = st.querySelector(".playin");
    const moveBtn = st.querySelector('[data-role="move"]');
    if (!input || !moveBtn){ bad(`[игры] ${game.id}: нет поля хода`); continue; }
    const playbar = st.querySelector(".playbar");
    const con = st.querySelector(".console");
    if (game.id === "guess"){
      /* «угадай число»: секрет случаен, поэтому играем как человек —
         бинарным поиском, читая подсказки «больше/меньше» из консоли */
      let lo = 1, hi = 100, guard = 0;
      while (playbar && playbar.style.display !== "none" && guard++ < 20){
        const mid = Math.floor((lo + hi) / 2);
        input.value = String(mid);
        moveBtn.click();
        await tick();
        /* последняя строка — приглашение следующего ввода; подсказка идёт перед ним */
        const lines = (con.textContent || "").toLowerCase().split("\n").filter(Boolean);
        const tail = lines.slice(-2).join(" ");
        if (/больше/.test(tail)) lo = mid + 1;
        else if (/меньше/.test(tail)) hi = mid - 1;
      }
      if (playbar && playbar.style.display !== "none")
        bad(`[игры] guess: не угадал за 20 ходов бинарным поиском`);
      else gamesChecked++;
    } else {
      const moves = MOVES[game.id] || Array(30).fill("1");
      let guard = 0;
      while (playbar && playbar.style.display !== "none" && guard < moves.length){
        input.value = moves[guard++];
        moveBtn.click();
        await tick();
      }
      if (playbar && playbar.style.display !== "none")
        bad(`[игры] ${game.id}: партия не завершилась за ${moves.length} ходов`);
      else gamesChecked++;
    }
  }

  /* --- разминки «угадай вывод»: правильное предсказание засчитывается,
         неправильное — нет --- */
  let warmupsChecked = 0;
  const WARMUPS = w.WARMUPS || [];
  if (!WARMUPS.length) bad("[разминки] список пуст — js/warmups.js не подключён");
  const normPred = s => String(s == null ? "" : s).replace(/\r/g, "")
    .split("\n").map(x => x.replace(/[ \t]+$/, "")).join("\n").replace(/\n+$/, "");
  async function attemptWarmup(id, text){
    w.__game.openWarmup(id);
    await tick();
    const st = studioOf();
    if (!st) return { ok:false, why:"разминка не открылась" };
    if (st.querySelector('[data-role="restore"]'))
      bad(`[разминки] ${id}: лишняя кнопка «Вернуть как было»`);
    st.editor.setCode(text);
    const btn = st.querySelector('[data-role="check"]');
    if (!btn) return { ok:false, why:"нет кнопки «Проверить»" };
    btn.click();
    await tick();
    const res = { ok: won(), why: msgText() };
    if (res.ok) closeWin();
    return res;
  }
  const codeLinesOf = c => String(c).replace(/\r/g, "").split("\n").filter(l => l.trim() !== "");
  for (const wm of WARMUPS){
    let good, wr;
    if (wm.type === "blocks"){
      /* верно = разложить блоки в порядке code; неверно = порядок наоборот */
      good = await attemptWarmup(wm.id, wm.code);
      if (!good.ok) bad(`[разминки] ${wm.id}: верно собранная программа не засчитана — ${good.why}`);
      const reversed = codeLinesOf(wm.code).reverse().join("\n");
      wr = await attemptWarmup(wm.id, reversed);
      if (wr.ok) bad(`[разминки] ${wm.id}: перевёрнутый порядок засчитан как верный`);
    } else {
      /* predict: верно = вывод программы; неверно = вывод плюс лишняя строка */
      const correct = w.Runtime.get("mini").run(wm.code, {}).output;
      good = await attemptWarmup(wm.id, correct);
      if (!good.ok) bad(`[разминки] ${wm.id}: верное предсказание не засчитано — ${good.why}`);
      const wrong = normPred(correct) + "\nэтого-в-выводе-нет";
      wr = await attemptWarmup(wm.id, wrong);
      if (wr.ok) bad(`[разминки] ${wm.id}: неверное предсказание засчитано как верное`);
    }
    if (good.ok && !wr.ok) warmupsChecked++;
  }

  /* --- визуализатор (машина времени) --- */
  let vizChecked = 0;
  if (typeof g.screenViz === "function"){
    g.screenViz();
    await tick();
    const vbtn = doc.querySelector('[data-role="viz"]');
    if (!vbtn) bad("[виз] нет кнопки «Показать по шагам»");
    else {
      /* прогоняем пример с алиасингом через кнопки примеров */
      const exBtns = doc.querySelectorAll("[data-ex]");
      if (exBtns.length < 2) bad("[виз] мало примеров");
      exBtns[1].click();               // «Два имени — один список»
      await tick();
      const player = doc.querySelector(".vizplayer");
      /* листаем вперёд: на первом кадре объектов ещё нет — они появляются
         после того, как список создан */
      const nextBtn = player && player.querySelector('[data-v="next"]');
      const lastBtn = player && player.querySelector('[data-v="prev"]');
      for (let k = 0; k < 8 && nextBtn; k++){ nextBtn.click(); await tick(2); }
      const objs = player ? player.querySelectorAll(".vizobj").length : 0;
      if (!objs) bad("[виз] после прогона не отрисовалась ни одна коробка объекта");
      if (lastBtn){ lastBtn.click(); await tick(2); }
      const slider = player && player.querySelector(".vizslider");
      if (slider){ slider.value = 0; slider.dispatchEvent(new w.Event("input")); await tick(2); }
      /* данные снимка: a и b должны ссылаться на один объект */
      if (typeof g.vizRecord === "function"){
        const rec = g.vizRecord("a = [1, 2, 3]\nb = a\nb.append(4)\n");
        const last = rec.frames[rec.frames.length - 1];
        const av = last.vars.find(v => v.name === "a"), bv = last.vars.find(v => v.name === "b");
        if (!(av && bv && av.cell.t === "ref" && av.cell.id === bv.cell.id))
          bad("[виз] алиасинг не распознан: a и b должны ссылаться на один объект");
        else vizChecked++;
        /* словарь: ключи настоящие, а не закодированные (не должно быть 's:') */
        const dr = g.vizRecord('d = {"м": 1}\n');
        const dlast = dr.frames[dr.frames.length - 1];
        const dobj = Object.values(dlast.objects)[0];
        if (!dobj || dobj.kind !== "dict" || dobj.pairs[0].key !== "'м'")
          bad(`[виз] ключ словаря показан неверно: ${dobj && dobj.pairs && JSON.stringify(dobj.pairs[0])}`);
      }
    }
    viewReset(g);
  }

  /* --- задача дня и дневной стрик --- */
  let dailyChecked = 0;
  if (typeof g.dailyPick === "function"){
    const pick = g.dailyPick();
    if (!pick || !pick.id) bad("[сегодня] задача дня не выбралась из пула разминок");
    else {
      /* одна и та же дата → одна и та же задача (иначе на двух устройствах
         в один день задачи разъедутся) */
      const p1 = g.dailyPick("2030-05-01"), p2 = g.dailyPick("2030-05-01");
      if (!p1 || !p2 || p1.id !== p2.id) bad("[сегодня] задача дня не детерминирована по дате");
      g.screenToday();
      await tick();
      const openBtn = doc.getElementById("dopen");
      if (!openBtn) bad("[сегодня] на экране «Сегодня» нет кнопки открыть задачу дня");
      else {
        openBtn.click();
        await tick();
        const st = studioOf();
        if (!st) bad("[сегодня] задача дня не открылась");
        else {
          const answer = pick.type === "blocks"
            ? pick.code
            : w.Runtime.get("mini").run(pick.code, {}).output;
          st.editor.setCode(answer);
          st.querySelector('[data-role="check"]').click();
          await tick();
          if (!won()) bad("[сегодня] верное решение задачи дня не засчитано — " + msgText());
          else closeWin();
          const today = g.dayKey();
          if (!g.dailyDone(today)) bad("[сегодня] задача дня не отмечена выполненной");
          if (g.streakCurrent() < 1) bad("[сегодня] стрик не засчитался за задачу дня");
          if (g.dailyDone(today) && g.streakCurrent() >= 1) dailyChecked++;
        }
      }
    }
    viewReset(g);
  }

  /* --- расписание занятий: дни недели и слияние настройки --- */
  let schedChecked = 0;
  if (typeof g.toggleStudyDay === "function"){
    const p0 = problems.length;
    g.screenToday();
    await tick();
    const wd = new Date().getDay();
    /* нормализуем: сегодня-день-недели должен быть не выбран перед тестом */
    if (g.scheduleDays().indexOf(wd) >= 0) g.toggleStudyDay(wd);
    g.toggleStudyDay(wd);                      // сделать сегодня учебным
    if (g.scheduleDays().indexOf(wd) < 0) bad("[расписание] выбранный день не сохранился");
    if (!g.isStudyDay(g.dayKey())) bad("[расписание] isStudyDay не видит сегодняшний учебный день");
    g.toggleStudyDay(wd);                      // снять — вернуть как было
    if (g.scheduleDays().indexOf(wd) >= 0) bad("[расписание] день не снялся повторным нажатием");
    if (g.isStudyDay(g.dayKey())) bad("[расписание] isStudyDay остался true после снятия дня");
    /* слияние: расписание — настройка, побеждает более свежее сохранение */
    const m = g.mergeProgress({ schedule:{ days:[1] }, savedAt:1 },
                              { schedule:{ days:[2,4] }, savedAt:2 });
    if (!m.schedule || String(m.schedule.days || []) !== "2,4")
      bad("[расписание] слияние не берёт свежую версию: " + JSON.stringify(m.schedule));
    if (problems.length === p0) schedChecked++;
    viewReset(g);
  }

  /* --- регистрация по имени --- */
  let regChecked = 0;
  if (typeof g.slugFromName === "function"){
    const p0 = problems.length;
    /* включаем сервер обратно: выше его выключали для проверки офлайн-режима */
    w.CLOUD_CONFIG.url = "https://srv.invalid/fn";
    const code = g.slugFromName("Аня");
    if (!w.Cloud.validCode(code)) bad("[регистрация] код из имени невалиден: " + code);
    if (!/^anya-/.test(code)) bad("[регистрация] код из имени не транслитерирован: " + code);
    if (g.slugFromName("Аня") === g.slugFromName("Аня"))
      bad("[регистрация] суффикс кода не случайный — коды двух учеников совпадут");
    /* имя едет с прогрессом: свежее побеждает, но не теряется, если в свежем пусто */
    const m1 = g.mergeProgress({ name:"Аня", savedAt:2 }, { name:"", savedAt:1 });
    if (m1.name !== "Аня") bad("[регистрация] имя потерялось при слиянии (свежее): " + m1.name);
    const m2 = g.mergeProgress({ name:"", savedAt:2 }, { name:"Боря", savedAt:1 });
    if (m2.name !== "Боря") bad("[регистрация] имя не подхватилось из старой копии: " + m2.name);
    /* экран регистрации рисуется */
    g.screenRegister();
    await tick();
    if (!doc.getElementById("regname")) bad("[регистрация] на экране нет поля имени");
    if (!doc.getElementById("regstart")) bad("[регистрация] нет кнопки «Начать»");
    /* полный путь: регистрация создаёт код и сохраняет имя */
    g.doRegister("Тест Ученик");
    await tick(40);
    if (!w.Cloud.myCode())
      bad("[регистрация] после регистрации нет кода ученика (hasUrl=" + w.Cloud.hasUrl() + ")");
    if (g.state.name !== "Тест Ученик") bad("[регистрация] имя не сохранилось: " + g.state.name);
    if (g.needsRegister()) bad("[регистрация] после регистрации всё ещё требует регистрацию");
    if (problems.length === p0) regChecked++;
    viewReset(g);
  }

  console.log(`уроков прогнано: ${checked} (из них «починить»: ${fixChecked})`);
  console.log(`игр прогнано: ${gamesChecked} из ${GAMES.length}`);
  console.log(`разминок прогнано: ${warmupsChecked} из ${WARMUPS.length}`);
  console.log(`визуализатор проверен: ${vizChecked ? "да" : "нет"}`);
  console.log(`задача дня и стрик: ${dailyChecked ? "да" : "нет"}`);
  console.log(`расписание занятий: ${schedChecked ? "да" : "нет"}`);
  console.log(`регистрация по имени: ${regChecked ? "да" : "нет"}`);
  console.log(`вызовов рисования на холсте: ${drawCalls.n}`);
  console.log(`запросов к серверу в тесте: ${calls}`);
  console.log(`ошибок JavaScript: ${jsErrors.length}`);
  jsErrors.slice(0, 10).forEach(e => console.log("   " + e));
  if (problems.length){
    console.log("\nПРОБЛЕМ: " + problems.length);
    problems.forEach(p => console.log("   " + p));
  } else console.log("сквозная проверка пройдена");

  process.exit(problems.length || jsErrors.length ? 1 : 0);
})();
