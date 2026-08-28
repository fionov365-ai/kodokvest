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
/* Диалоги: в jsdom их нет, а код спрашивает подтверждение перед сбросом и
   загрузкой прогресса. Отвечаем «да», чтобы проверять сами действия. */
w.confirm = function(){ return true; };
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

  /* ---------- уход с экрана во время загрузки ----------
     Урок дорисовывается асинхронно. Если ребёнок за это время нажал другой
     раздел, старый экран дорисовываться НЕ должен: он затрёт новый. */
  g.openLesson("print-first");
  g.screenWarmups();                 /* ушли, не дожидаясь отрисовки урока */
  await tick();
  if (!doc.querySelector(".gamegrid"))
    bad("[экраны] урок дорисовался поверх раздела, открытого позже");
  if (doc.querySelector("#hintbtn"))
    bad("[экраны] на экране разминок оказалась разметка урока");
  viewReset(g);
  await tick();

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

  /* «Сбросить весь прогресс» и «Загрузить из этого поля» — оба места когда-то
     перечисляли поля прогресса руками и оба отставали от игры. Проверяем
     через настоящие кнопки, а не в обход. */
  g.state.warmups["проверка-сброса"] = 1;
  g.state.ailab["проверка-сброса"] = 1;
  g.state.days["2030-01-01"] = 1;
  g.state.name = "Тест";
  g.setStars("print-first", 3);
  g.screenAdmin();
  await tick();
  doc.querySelector('[data-act="resetall"]').click();
  await tick();
  if (Object.keys(g.state.warmups).length) bad("[панель] сброс не стёр разминки");
  if (Object.keys(g.state.ailab).length) bad("[панель] сброс не стёр «Ты и ИИ»");
  if (Object.keys(g.state.days).length) bad("[панель] сброс не стёр дни занятий");
  if (Object.keys(g.state.stars).length) bad("[панель] сброс не стёр звёзды");
  if (g.state.name !== "Тест") bad("[панель] сброс прогресса стёр имя ученика");

  /* загрузка файлом: заменяет прогресс целиком и оставляет рабочую форму */
  g.screenAdmin();
  await tick();
  const jsonBox = doc.getElementById("admjson");
  jsonBox.value = JSON.stringify({ xp: 125, stars: { "print-first": 3, "vars": 2 } });
  doc.querySelector('[data-act="import"]').click();
  await tick();
  if (g.state.xp !== 125) bad(`[панель] загрузка файлом не применилась: xp ${g.state.xp}`);
  if (g.state.stars.vars !== 2) bad("[панель] загрузка файлом потеряла звёзды");
  ["warmups","ailab","games","gamesPlayed","days","daily","shields","projects","log","drawDone"]
    .forEach(k => {
      if (!g.state[k] || typeof g.state[k] !== "object")
        bad(`[панель] после загрузки файлом поле «${k}» не заполнено — игра упадёт на первом обращении`);
    });
  if (!Array.isArray(g.state.schedule.days)) bad("[панель] после загрузки файлом сломано расписание");
  /* и игра после этого работает: разминка засчитывается, а не падает */
  g.state.xp = 0; g.state.stars = {};

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

  /* --- форма прогресса: один список полей на все четыре места ---
     Проверяем не отдельные поля, а ИНВАРИАНТ: каждое поле прогресса обязано
     сливаться при синхронизации и обнуляться при смене ученика. Именно этой
     проверки не хватало, когда появились S.games и S.gamesPlayed: они
     выпали и из слияния, и из очистки, и это никого не уронило. */
  if (typeof g.blankProgress === "function"){
    const blank = g.blankProgress();
    const fields = Object.keys(blank).filter(k => k !== "v");
    const full = {};
    fields.forEach(k => {
      const v = blank[k];
      if (typeof v === "number") full[k] = 7;
      else if (Array.isArray(v)) full[k] = ["что-то"];
      else if (v && typeof v === "object") full[k] = { "x": 1 };
      else full[k] = "непусто";
    });
    full.schedule = { days:[1,3] };
    full.savedAt = 5000;
    const merged = g.mergeProgress(full, {});
    fields.forEach(k => {
      if (merged[k] === undefined || merged[k] === null)
        bad(`[слияние] поле «${k}» теряется при обмене с сервером — допиши его в mergeProgress`);
    });
    /* обмен ничего не должен терять и в обратную сторону */
    const merged2 = g.mergeProgress({ savedAt:1 }, full);
    fields.forEach(k => {
      if (merged2[k] === undefined || merged2[k] === null)
        bad(`[слияние] поле «${k}» теряется, когда свежая копия пришла с сервера`);
    });
    if (merged.games && merged.games.x !== 1)
      bad("[слияние] свой код игры не доехал");

    /* смена ученика: не должно остаться НИЧЕГО от прошлого ребёнка */
    const mine = g.clearAll(Object.assign({}, full));
    fields.forEach(k => {
      const v = mine[k];
      const empty = v === null || v === "" || v === 0 ||
        (Array.isArray(v) ? v.length === 0 :
         (v && typeof v === "object" ? Object.keys(v).filter(x => x !== "days").length === 0 : false));
      if (!empty)
        bad(`[смена ученика] поле «${k}» не очищено: ${JSON.stringify(v)} — прогресс двух детей смешается`);
    });
    if (mine.schedule.days.length) bad("[смена ученика] расписание прошлого ребёнка осталось");

    /* сброс в панели наставника: результаты стёрты, имя и своё творчество целы */
    const res = g.clearResults(Object.assign({}, full, { name:"Аня", sandbox:"мой код" }));
    ["stars","log","warmups","ailab","days","daily","shields","projects","drawDone","gamesPlayed"]
      .forEach(k => {
        if (Object.keys(res[k] || {}).length)
          bad(`[сброс] «${k}» не сброшен панелью наставника`);
      });
    if (res.xp !== 0 || res.badges.length) bad("[сброс] XP или бейджи не сброшены");
    if (res.name !== "Аня") bad("[сброс] имя ученика не должно стираться при сбросе прогресса");
    if (res.sandbox !== "мой код") bad("[сброс] песочница — работа ребёнка, сбросом её не трогаем");
    if (!res.games || !Object.keys(res.games).length)
      bad("[сброс] свои версии игр — работа ребёнка, сбросом их не трогаем");

    /* ensureShape не портит уже осмысленные значения */
    const sh = g.ensureShape({ sandbox:"код", name:"Боря", stars:{ a:1 } });
    if (sh.sandbox !== "код" || sh.name !== "Боря" || sh.stars.a !== 1)
      bad("[форма] ensureShape затирает нормальные значения");
    if (!sh.games || !sh.warmups || !sh.ailab || !sh.schedule || !Array.isArray(sh.schedule.days))
      bad("[форма] ensureShape не дополнил пустые поля");
  } else bad("[форма] blankProgress не выведен наружу — проверить форму прогресса нечем");

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
    /* Партия сама по себе не делает игру «твоей версией»: пометка ставится
       только за изменённый код. Иначе карточка врёт после первого запуска. */
    if (g.state.games && g.state.games[game.id] !== undefined)
      bad(`[игры] ${game.id}: игра помечена как «твоя версия», хотя код не меняли`);
    if (!(g.state.gamesPlayed && g.state.gamesPlayed[game.id]))
      bad(`[игры] ${game.id}: партия не отмечена в gamesPlayed`);
  }
  /* а изменённый код запоминается */
  if (GAMES.length){
    const gm = GAMES[0];
    g.openGame(gm.id);
    await tick();
    const st0 = studioOf();
    if (st0){
      st0.editor.setCode(gm.code + '\nprint("моя правка")\n');
      st0.querySelector('[data-role="run"]').click();
      await tick();
      if (!(g.state.games && g.state.games[gm.id]))
        bad(`[игры] ${gm.id}: изменённый код не сохранился`);
      /* «Вернуть оригинал» снимает пометку */
      doc.getElementById("greset").click();
      await tick();
      if (g.state.games && g.state.games[gm.id] !== undefined)
        bad(`[игры] ${gm.id}: «Вернуть оригинал» не снял «твою версию»`);
    }
  }

  /* --- живой разбор расхождения ---
     Когда код не падает, а отвечает не то, ребёнку раньше показывали только
     две колонки и номер строки. Теперь разбор называет причину словами.
     Проверяем две вещи: что причина названа верно И что разбор МОЛЧИТ, когда
     сказать нечего. Второе не менее важно: ложное объяснение уводит от
     настоящей причины, а «не знаю» оставляет прежнюю механическую подсказку. */
  let whyChecked = 0;
  if (typeof g.whyDiffer !== "function") bad("[разбор] whyDiffer не выставлен наружу");
  else {
    const cases = [
      { name:"лишний пробел на конце", exp:["итого: 5"], got:["итого: 5 "],
        want:["невидимо", "конце строки 1", "лишний пробел"], vis:true },
      { name:"два пробела внутри", exp:["итого: 5"], got:["итого:  5"],
        want:["невидимо", "два пробела подряд"], vis:true },
      { name:"табуляция вместо пробела", exp:["а б"], got:["а\tб"],
        want:["невидимо", "табуляция"], vis:true },
      { name:"только регистр", exp:["Привет"], got:["привет"],
        want:["заглавных", "Привет", "привет"], vis:false },
      { name:"тот же набор, другой порядок", exp:["а","б","в"], got:["а","в","б"],
        want:["порядок другой"], vis:false },
      { name:"не хватает последней строки", exp:["1","2","итого: 3"], got:["1","2"],
        want:["Строк у тебя 2", "нужно 3", "ПОСЛЕ цикла"], vis:false },
      { name:"лишние строки из цикла", exp:["итого: 3"], got:["итого: 3","итого: 3","итого: 3"],
        want:["Строк у тебя 3", "нужно 1", "внутрь цикла"], vis:false },
      { name:"дробное вместо целого", exp:["2"], got:["2.0"],
        want:["Целое и дробное", "//"], vis:false },
      { name:"сдвиг на единицу", exp:["шаг 1"], got:["шаг 0"],
        want:["на единицу", "нумерация с нуля"], vis:false },
      { name:"напечатан список целиком", exp:["меч"], got:["['меч', 'щит']"],
        want:["набор целиком", "циклом"], vis:false },
      { name:"значение в кавычках", exp:["аня"], got:["'аня'"],
        want:["в кавычках"], vis:false },
      { name:"запятая в дробном", exp:["3.5"], got:["3,5"],
        want:["точкой, а не запятой"], vis:false },
      { name:"ничего не напечатано", exp:["итого: 5"], got:[""],
        want:["ничего не напечатала"], vis:false, empty:"Твоя программа ничего не напечатала. Проверь print." },
    ];
    for (const c of cases){
      const d = g.whyDiffer(c.exp, c.got, c.empty || "Твоя программа ничего не напечатала. Проверь print.");
      if (!d.why){ bad(`[разбор] «${c.name}»: причина не названа вообще`); continue; }
      const miss = c.want.filter(t => d.why.indexOf(t) < 0);
      if (miss.length) bad(`[разбор] «${c.name}»: в объяснении нет ${JSON.stringify(miss)} — сказано: ${d.why.slice(0,120)}`);
      else if (!!d.vis !== c.vis) bad(`[разбор] «${c.name}»: vis=${d.vis}, а ожидалось ${c.vis}`);
      else whyChecked++;
    }
    /* Молчание там, где причина не опознаётся: разное по смыслу, ничего общего. */
    const mute = [
      { name:"совсем другой ответ", exp:["итого: 500"], got:["зелёный слон"] },
      { name:"совпадает целиком",   exp:["а","б"],      got:["а","б"] },
      { name:"обе стороны пустые",  exp:[""],           got:[""] },
    ];
    for (const c of mute){
      const d = g.whyDiffer(c.exp, c.got, "пусто");
      if (d.why) bad(`[разбор] «${c.name}»: разбор придумал причину, хотя не должен — ${d.why.slice(0,100)}`);
      else whyChecked++;
    }
    /* Невидимую разницу мало назвать — её надо ПОКАЗАТЬ, иначе колонки
       выглядят одинаково и объяснение звучит как издёвка. */
    const html = g.diffBlock(["итого: 5"], ["итого: 5 "]);
    if (html.indexOf("·") < 0)
      bad("[разбор] при разнице в пробелах колонки не показывают пробелы значками");
    else whyChecked++;
    const plain = g.diffBlock(["итого: 5"], ["итого: 7"]);
    if (plain.indexOf("·") >= 0)
      bad("[разбор] пробелы показаны значками там, где разница не в них — рябит зря");
    else whyChecked++;
    /* Разминка про свою пустую сторону обязана говорить своими словами:
       «программа ничего не напечатала» тут было бы неправдой. */
    const pd = g.predictDiff("итого: 5", "");
    if (pd.indexOf("ничего не написал") < 0)
      bad("[разбор] у пустого предсказания текст не про ребёнка, а про программу");
    else whyChecked++;
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

  /* «Перемешать заново» обязано избегать правильного порядка: иначе одно
     нажатие решает упражнение за ребёнка. Проверяем не логику, а результат —
     двести перемешиваний и ни одного попадания в ответ. */
  const someBlocks = WARMUPS.filter(x => x.type === "blocks");
  for (const wm of someBlocks.slice(0, 3)){
    w.__game.openWarmup(wm.id);
    await tick();
    const st = studioOf();
    const shuf = st && st.querySelector('[data-role="shuffle"]');
    if (!shuf){ bad(`[разминки] ${wm.id}: нет кнопки «Перемешать заново»`); continue; }
    const answer = codeLinesOf(wm.code).join("\n");
    if (st.editor.getCode() === answer)
      bad(`[разминки] ${wm.id}: стартовая раскладка совпала с ответом`);
    let leaks = 0;
    for (let k = 0; k < 200; k++){
      shuf.click();
      if (st.editor.getCode() === answer) leaks++;
    }
    if (leaks) bad(`[разминки] ${wm.id}: «Перемешать заново» выдало готовый ответ ${leaks} раз из 200`);
  }

  /* --- раздел «Ты и ИИ»: верный ответ засчитывается, неверный — нет --- */
  let ailabChecked = 0, reviewChecked = 0;
  const AILAB = w.AILAB || [];
  if (!AILAB.length) bad("[ты-и-ии] список пуст — js/ailab.js не подключён");
  async function attemptAI(id, text){
    w.__game.openAILesson(id);
    await tick();
    const st = studioOf();
    if (!st) return { ok:false, why:"задание не открылось" };
    st.editor.setCode(text);
    const btn = st.querySelector('[data-role="check"]');
    if (!btn) return { ok:false, why:"нет кнопки «Проверить»" };
    btn.click();
    await tick();
    const res = { ok: won(), why: msgText() };
    if (res.ok) closeWin();
    return res;
  }
  /* review: тут проверять надо не текст в редакторе, а вердикт. Порядок такой
     же, как у ребёнка: неверный ответ не засчитывается, верный ведёт к выбору
     строки, и только верная строка приносит победу. */
  async function attemptReview(x){
    w.__game.openAILesson(x.id);
    await tick();
    const panel = doc.getElementById("verdict");
    if (!panel) return bad(`[ты-и-ии] ${x.id}: у review нет панели вердикта`);
    if (studioOf() && studioOf().querySelector('[data-role="check"]'))
      bad(`[ты-и-ии] ${x.id}: у review осталась кнопка «Проверить» — проверка это вердикт`);
    if (!doc.querySelector(".claimcard"))
      bad(`[ты-и-ии] ${x.id}: не показано обещание ИИ (claim)`);

    const real = w.__game.reviewTruth(x);
    if (real !== x.verdict)
      bad(`[ты-и-ии] ${x.id}: app считает вердикт «${real}», а в содержании «${x.verdict}»`);

    const vbtn = v => panel.querySelector('.vbtn[data-v="' + v + '"]');
    for (const v of ["ok", "wrong", "partly"]){
      if (!vbtn(v)) return bad(`[ты-и-ии] ${x.id}: нет кнопки вердикта «${v}»`);
      if (v === x.verdict) continue;
      vbtn(v).click();
      await tick();
      if (won()){ bad(`[ты-и-ии] ${x.id}: неверный вердикт «${v}» засчитан`); closeWin(); return; }
      if (doc.querySelectorAll("#vpick .lrow").length)
        bad(`[ты-и-ии] ${x.id}: после неверного вердикта «${v}» открылся выбор строки`);
    }

    vbtn(x.verdict).click();
    await tick();
    if (x.verdict === "ok"){
      if (!won()) return bad(`[ты-и-ии] ${x.id}: верный вердикт «работает верно» не засчитан`);
      if (doc.querySelectorAll("#vpick .lrow").length)
        bad(`[ты-и-ии] ${x.id}: код верный, а выбор строки всё равно открылся`);
      closeWin();
      return true;
    }
    if (won()){ closeWin(); return bad(`[ты-и-ии] ${x.id}: вердикт засчитан без указания строки`); }
    const rows = [...doc.querySelectorAll("#vpick .lrow")];
    if (!rows.length) return bad(`[ты-и-ии] ${x.id}: после верного вердикта не открылся выбор строки`);
    const right = rows.filter(r => +r.getAttribute("data-line") === x.badLine)[0];
    if (!right) return bad(`[ты-и-ии] ${x.id}: строки ${x.badLine} нет среди выбираемых`);
    const wrongRow = rows.filter(r => r !== right && !r.disabled)[0];
    if (!wrongRow) return bad(`[ты-и-ии] ${x.id}: выбирать не из чего — одна строка`);
    wrongRow.click();
    await tick();
    if (won()){ closeWin(); return bad(`[ты-и-ии] ${x.id}: победа за неверную строку`); }
    right.click();
    await tick();
    if (!won()) return bad(`[ты-и-ии] ${x.id}: верная строка ${x.badLine} не принесла победу`);
    /* доказательство в победной карточке: на чём именно код разошёлся */
    if (!doc.querySelector("#wincard .proof"))
      bad(`[ты-и-ии] ${x.id}: в победной карточке нет доказательства (.proof)`);
    closeWin();
    return true;
  }

  for (const x of AILAB){
    let good, wr;
    if (x.type === "review"){
      if (await attemptReview(x) === true){ ailabChecked++; reviewChecked++; }
      continue;
    }
    if (x.type === "predict"){
      const correct = w.Runtime.get("mini").run(x.code, {}).output;
      good = await attemptAI(x.id, correct);
      if (!good.ok) bad(`[ты-и-ии] ${x.id}: верный ответ не засчитан — ${good.why}`);
      wr = await attemptAI(x.id, normPred(correct) + "\nэтого-в-выводе-нет");
      if (wr.ok) bad(`[ты-и-ии] ${x.id}: неверный ответ засчитан как верный`);
    } else {
      /* code/fix: эталон засчитывается; исходная заготовка (пустая или сломанная) — нет */
      good = await attemptAI(x.id, x.solution);
      if (!good.ok) bad(`[ты-и-ии] ${x.id}: эталонное решение не засчитано — ${good.why}`);
      wr = await attemptAI(x.id, x.starter);
      if (wr.ok) bad(`[ты-и-ии] ${x.id}: исходная заготовка засчитана как решение`);
    }
    if (good.ok && !wr.ok) ailabChecked++;
  }
  viewReset(g);

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
      /* ===== стек вызовов =====
         Раньше heapSnapshot сваливал все области видимости в один список и
         дедуплицировал имена: внутри функции ребёнок видел местную «ш» и никак
         не мог узнать, что внешняя «ш» с другим значением всё ещё существует.
         Теперь на каждый кадр свой список. */
      if (typeof g.vizRecord === "function"){
        const fr = g.vizRecord('def f(ш):\n    итог = ш * 2\n    return итог\n\n\nш = 7\nprint(f(3))\n');
        const inside = fr.frames.filter(x => x.scopes && x.scopes.length > 1);
        if (!inside.length) bad("[виз] внутри функции не появился отдельный кадр стека");
        else {
          const f0 = inside[inside.length - 1];
          const glob = f0.scopes[0].vars.filter(v => v.name === "ш")[0];
          const loc  = f0.scopes[1].vars.filter(v => v.name === "ш")[0];
          if (!glob || !loc)
            bad("[виз] «ш» видно не в обоих кадрах — внешняя переменная опять спрятана за местной");
          else if (glob.cell.text === loc.cell.text)
            bad(`[виз] в обоих кадрах «ш» одинаковая (${glob.cell.text}) — кадры не различаются`);
          else if (f0.scopes[1].name !== "f")
            bad(`[виз] кадр вызова назван «${f0.scopes[1].name}», а функция f`);
          else vizChecked++;
          /* локальная переменная не должна протекать в кадр программы */
          if (f0.scopes[0].vars.filter(v => v.name === "итог").length)
            bad("[виз] местная переменная функции попала в кадр главной программы");
        }
        /* рекурсия: кадров должно становиться столько, сколько вызовов */
        const rc = g.vizRecord('def ф(n):\n    if n <= 1:\n        return 1\n    return n * ф(n - 1)\n\n\nprint(ф(4))\n');
        const deepest = Math.max(...rc.frames.map(x => (x.scopes || []).length));
        if (deepest < 5) bad(`[виз] на рекурсии глубиной 4 максимум кадров ${deepest}, а должно быть 5 (программа + 4 вызова)`);
        else vizChecked++;
      }

      /* ===== что изменилось на шаге =====
         Ползунок показывал состояние, но не изменение. Проверяем, что разбор
         называет событие словами И что молчит, когда на шаге ничего не менялось:
         пустая полоска лучше выдуманного «что-то поменялось». */
      if (typeof g.vizDiff === "function"){
        const rec = g.vizRecord('nums = []\nfor i in range(1, 3):\n    nums.append(i * i)\n\nprint(nums)\n');
        const texts = [];
        for (let k = 1; k < rec.frames.length; k++)
          texts.push(g.vizDiff(rec.frames[k - 1], rec.frames[k]).text);
        const all = texts.join(" ~ ");
        for (const need of ["появилась переменная", "добавился элемент", "напечатано"])
          if (all.indexOf(need) < 0) bad(`[виз] разбор шага ни разу не сказал «${need}»: ${all.slice(0, 200)}`);
        /* один и тот же кадр сам с собой — менять нечего, разбор обязан молчать */
        const same = g.vizDiff(rec.frames[1], rec.frames[1]);
        if (same.text) bad(`[виз] разбор нашёл изменение там, где кадр не менялся: ${same.text}`);
        /* пометки должны попадать в разметку, иначе подсветки не видно */
        let marked = 0;
        for (let k = 1; k < rec.frames.length; k++){
          const d = g.vizDiff(rec.frames[k - 1], rec.frames[k]);
          const html = g.vizMemoryHTML(rec.frames[k], d);
          if (Object.keys(d.vars).length + Object.keys(d.cells).length + Object.keys(d.objs).length){
            if (!/vzn|vzc/.test(html)) bad(`[виз] на шаге ${k + 1} есть изменения, а классов подсветки в разметке нет`);
            else marked++;
          } else if (/vzn|vzc/.test(html)) {
            bad(`[виз] на шаге ${k + 1} изменений нет, а подсветка в разметке есть`);
          }
        }
        if (!marked) bad("[виз] подсветка изменений не сработала ни на одном шаге");
        else vizChecked++;

        /* вход в функцию называется вместе с аргументом: на рекурсии без него
           все шаги выглядят одинаково, а вся суть в том, с чем позвали */
        const fr2 = g.vizRecord('def ф(n):\n    return n\n\n\nprint(ф(3))\n');
        const entry = [];
        for (let k = 1; k < fr2.frames.length; k++) entry.push(g.vizDiff(fr2.frames[k - 1], fr2.frames[k]).text);
        const joined = entry.join(" ~ ");
        if (joined.indexOf("вызвана функция") < 0) bad("[виз] вход в функцию не назван");
        else if (joined.indexOf("n = 3") < 0) bad(`[виз] вход в функцию назван без аргумента: ${joined.slice(0, 150)}`);
        else vizChecked++;
      }

      /* примеры с функциями обязаны быть: без них стек вызовов показать не на чем */
      if (Array.isArray(g.VIZ_EXAMPLES) && !g.VIZ_EXAMPLES.filter(e => /\bdef\b/.test(e.code)).length)
        bad("[виз] среди примеров нет ни одного с функцией");

      /* Кнопка «Играть» ставит интервал на 800 мс. Уход с экрана обязан его
         погасить: плеер просто выбрасывается из документа, а таймер сам не
         умирает — он продолжал бы перерисовывать невидимую разметку вечно,
         и каждый следующий заход добавлял бы ещё один такой таймер. */
      const playBtn = player && player.querySelector('[data-v="play"]');
      if (!playBtn || typeof g.vizPlaying !== "function") bad("[виз] нет кнопки «Играть»");
      else {
        playBtn.click();
        if (!g.vizPlaying()) bad("[виз] «Играть» не запустило проигрывание");
        playBtn.click();
        if (g.vizPlaying()) bad("[виз] повторное нажатие не поставило на паузу");
        playBtn.click();
        g.screenWorlds();                    /* ушли с экрана, не нажав паузу */
        await tick();
        if (g.vizPlaying()) bad("[виз] проигрывание продолжает тикать после ухода с экрана");
        /* и новый прогон не оставляет прошлый таймер */
        g.screenViz();
        await tick();
        doc.querySelector('[data-role="viz"]').click();
        await tick();
        const p2 = doc.querySelector('.vizplayer [data-v="play"]');
        if (p2){
          p2.click();
          doc.querySelector('[data-role="viz"]').click();   /* запустили разбор заново */
          await tick();
          if (g.vizPlaying()) bad("[виз] новый прогон не погасил прошлое проигрывание");
        }
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

  /* --- проект в конце мира --- */
  let projChecked = 0;
  const PROJECTS = w.PROJECTS || [];
  if (typeof g.openProject === "function" && PROJECTS.length){
    const p0 = problems.length;
    const proj = PROJECTS[0];
    const world1 = CUR.world(proj.world);

    /* выше панель наставника включила «Открыть все уроки» — она законно
       открывает и проект, поэтому на время проверки замка её выключаем */
    const savedUnlock = g.state.admin.unlockAll;
    g.state.admin.unlockAll = false;

    /* пока не все уроки мира пройдены — проект закрыт и кнопки нет */
    const savedStars = JSON.parse(JSON.stringify(g.state.stars));
    world1.lessons.forEach(l => { delete g.state.stars[l.id]; });
    g.state.projects = {};
    if (g.projectOpen(proj)) bad("[проект] открыт, хотя уроки мира не пройдены");
    g.screenWorld(proj.world);
    await tick();
    if (!doc.querySelector(".projcard.locked"))
      bad("[проект] на карте мира нет закрытой карточки проекта");
    if (doc.getElementById("openproj"))
      bad("[проект] кнопка открытия есть у закрытого проекта");

    /* проходим все уроки мира — проект должен открыться */
    Object.keys(savedStars).forEach(k => { g.state.stars[k] = savedStars[k]; });
    world1.lessons.forEach(l => { if (CONTENT["world" + proj.world][l.id]) g.setStars(l.id, 3); });
    if (!g.projectOpen(proj)) bad("[проект] не открылся после того, как все уроки мира пройдены");
    g.screenWorld(proj.world);
    await tick();
    if (!doc.getElementById("openproj")) bad("[проект] на карте мира нет кнопки открыть проект");

    /* проходим проект по шагам эталонными решениями */
    doc.getElementById("openproj").click();
    await tick();
    for (let i = 0; i < proj.steps.length; i++){
      const st = studioOf();
      if (!st){ bad(`[проект] шаг ${i+1} не открылся`); break; }

      /* стартовый код шага: на первом — заготовка, дальше переезжает своё */
      const startCode = st.editor.getCode();
      if (i === 0 && startCode !== proj.steps[0].starter)
        bad("[проект] на первом шаге в редакторе не заготовка");
      if (i > 0 && startCode !== proj.steps[i-1].solution)
        bad(`[проект] на шаге ${i+1} код не переехал с прошлого шага`);

      /* стартовый код НЕ должен проходить проверку — иначе шага нет */
      st.querySelector('[data-role="check"]').click();
      await tick();
      if (won()){ bad(`[проект] шаг ${i+1} засчитан на неизменённом коде`); closeWin(); }

      st.editor.setCode(proj.steps[i].solution);
      st.querySelector('[data-role="check"]').click();
      await tick();
      if (!won()){ bad(`[проект] шаг ${i+1}: верное решение не засчитано — ` + msgText()); break; }

      if (i < proj.steps.length - 1){
        const nx = doc.getElementById("pnext");
        if (!nx){ bad(`[проект] после шага ${i+1} нет кнопки следующего шага`); break; }
        nx.click();
        await tick();
      } else {
        const fin = doc.getElementById("pfin");
        if (!fin){ bad("[проект] после последнего шага нет выхода на финал"); break; }
        fin.click();
        await tick();
      }
    }

    /* финал: проект отмечен собранным, бейдж выдан, код целиком показан */
    if (!g.projectDone(proj.id)) bad("[проект] после всех шагов проект не отмечен собранным");
    if (g.state.badges.indexOf("builder") < 0) bad("[проект] бейдж «Строитель» не выдан");
    if (g.projectState(proj.id).code !== proj.steps[proj.steps.length - 1].solution)
      bad("[проект] в финале сохранён не тот код, который написал ученик");
    if (!doc.getElementById("tosand")) bad("[проект] на финальном экране нет кнопки «Забрать в песочницу»");
    /* «забрать в песочницу» кладёт программу в песочницу */
    doc.getElementById("tosand").click();
    await tick();
    if (g.state.sandbox !== proj.steps[proj.steps.length - 1].solution)
      bad("[проект] код проекта не уехал в песочницу");

    /* слияние: пройденный шаг берём дальний, код — из более свежего сохранения */
    const mp = g.mergeProgress(
      { projects:{ x:{ step:1, done:0, code:"стар" } }, savedAt:1 },
      { projects:{ x:{ step:3, done:1, code:"свеж" } }, savedAt:2 });
    if (!mp.projects || mp.projects.x.step !== 3 || !mp.projects.x.done)
      bad("[проект] слияние откатило прогресс: " + JSON.stringify(mp && mp.projects));
    if (mp.projects.x.code !== "свеж")
      bad("[проект] слияние взяло не свежий код: " + JSON.stringify(mp.projects.x.code));

    /* проект открыт и мимо замка: «Открыть все уроки» в панели наставника */
    g.state.projects = {};
    g.state.admin.unlockAll = true;
    const w1 = CUR.world(proj.world);
    const keep = JSON.parse(JSON.stringify(g.state.stars));
    w1.lessons.forEach(l => { delete g.state.stars[l.id]; });
    if (!g.projectOpen(proj)) bad("[проект] «Открыть все уроки» не открывает проект");
    Object.keys(keep).forEach(k => { g.state.stars[k] = keep[k]; });
    g.state.admin.unlockAll = savedUnlock;

    if (problems.length === p0) projChecked++;
    viewReset(g);
  }

  /* Остальные проекты. Механика у всех одна, а содержание разное — поэтому
     каждый проект проходим по шагам эталонами. Раньше тест брал только
     PROJECTS[0], и сломанный проект любого другого мира прошёл бы мимо. */
  if (typeof g.openProject === "function" && PROJECTS.length > 1){
    const savedUnlock2 = g.state.admin.unlockAll;
    g.state.admin.unlockAll = true;     /* замок уже проверен на первом проекте */
    for (let pi = 1; pi < PROJECTS.length; pi++){
      const proj = PROJECTS[pi], p0 = problems.length, tag = "[проект " + proj.id + "]";
      g.state.projects = {};
      g.openProject(proj.id);
      await tick();
      for (let i = 0; i < proj.steps.length; i++){
        const st = studioOf();
        if (!st){ bad(`${tag} шаг ${i+1} не открылся`); break; }

        const startCode = st.editor.getCode();
        if (i === 0 && startCode !== proj.steps[0].starter)
          bad(`${tag} на первом шаге в редакторе не заготовка`);
        if (i > 0 && startCode !== proj.steps[i-1].solution)
          bad(`${tag} на шаге ${i+1} код не переехал с прошлого шага`);

        st.querySelector('[data-role="check"]').click();
        await tick();
        if (won()){ bad(`${tag} шаг ${i+1} засчитан на неизменённом коде`); closeWin(); }

        st.editor.setCode(proj.steps[i].solution);
        st.querySelector('[data-role="check"]').click();
        await tick();
        if (!won()){ bad(`${tag} шаг ${i+1}: верное решение не засчитано — ` + msgText()); break; }

        if (i < proj.steps.length - 1){
          const nx = doc.getElementById("pnext");
          if (!nx){ bad(`${tag} после шага ${i+1} нет кнопки следующего шага`); break; }
          nx.click(); await tick();
        } else {
          const fin = doc.getElementById("pfin");
          if (!fin){ bad(`${tag} после последнего шага нет выхода на финал`); break; }
          fin.click(); await tick();
        }
      }
      if (!g.projectDone(proj.id)) bad(`${tag} после всех шагов проект не отмечен собранным`);
      if (problems.length === p0) projChecked++;
      viewReset(g);
    }
    g.state.admin.unlockAll = savedUnlock2;
  }

  /* --- работа над ошибками: интервальный повтор --- */
  let againChecked = 0;
  if (typeof g.screenReview === "function"){
    const p0 = problems.length;
    const STEPS = g.REVIEW_STEPS;
    const hard = "vars", easy = "math";        /* оба урока есть в первом мире */
    const savedStars = JSON.parse(JSON.stringify(g.state.stars));
    const savedLog = JSON.parse(JSON.stringify(g.state.log));
    const savedXp = g.state.xp;
    const savedBadges = g.state.badges.slice();
    g.state.review = {}; g.state.stars = {}; g.state.log = {};

    const logAs = (id, o) => {
      g.state.log[id] = Object.assign(
        { attempts:1, hints:0, shown:0, runs:1, timeMs:0, first:1, last:1, solvedAt:Date.now(), stars:3 }, o);
    };
    /* итог занятия подделываем через живой объект сессии — так же, как его
       читает сам reviewAfterLesson после победы в уроке */
    const finish = (id, clean) => {
      const ses = g.getSession();
      ses.attempts = clean ? 1 : 4; ses.hints = clean ? 0 : 1; ses.shown = false;
      g.reviewAfterLesson(id);
    };

    /* урок, пройденный чисто, повторять не просят */
    g.setStars(easy, 3); logAs(easy, {});
    if (g.reviewWhy(easy)) bad("[повтор] чистый урок попал в список: " + g.reviewWhy(easy));

    /* урок с подсказкой просится, но не раньше срока */
    g.setStars(hard, 2); logAs(hard, { attempts:2, hints:1, stars:2 });
    if (!g.reviewWhy(hard)) bad("[повтор] урок с подсказкой не попал в список");
    if (g.reviewList().length !== 1) bad("[повтор] в списке не один урок, а " + g.reviewList().length);
    if (g.reviewDue().length !== 0) bad("[повтор] урок позвали на повтор раньше срока");

    /* срок подошёл — урок в списке «пора», и на экране есть его карточка */
    g.state.log[hard].solvedAt = Date.now() - (STEPS[0] + 1) * 864e5;
    if (g.reviewDue().length !== 1) bad("[повтор] созревший урок не попал в «пора повторить»");
    g.screenReview();
    await tick();
    const card = doc.querySelector(".revcard");
    if (!card) bad("[повтор] на экране нет карточки урока");
    else if (card.getAttribute("data-id") !== hard)
      bad("[повтор] на экране не тот урок: " + card.getAttribute("data-id"));
    if (!/подсказк/i.test(doc.body.textContent))
      bad("[повтор] на экране не написано, почему урок сюда попал");

    /* чистый повтор двигает срок вперёд, грязный — сбрасывает в начало */
    finish(hard, true);
    if (g.reviewState(hard).n !== 1) bad("[повтор] чистый повтор не засчитан");
    if (g.reviewDue().length !== 0) bad("[повтор] после повтора урок сразу зовут снова");
    finish(hard, false);
    if (g.reviewState(hard).n !== 0) bad("[повтор] сбой на повторе не обнулил счётчик");

    /* три чистых повтора подряд — урок закреплён и из списка ушёл */
    finish(hard, true); finish(hard, true); finish(hard, true);
    if (!g.reviewGraduated(hard)) bad("[повтор] три чистых повтора не закрепили урок");
    if (g.reviewList().some(x => x.lesson.id === hard))
      bad("[повтор] закреплённый урок остался в списке");
    if (!/Закреплено/.test(g.reviewNote(hard)))
      bad("[повтор] в карточке победы не сказано, что урок закреплён");

    /* бейдж за пять закреплённых */
    const more = ["print-first", "fstrings", "for-range", "if-else"];
    more.forEach(id => {
      g.setStars(id, 2); logAs(id, { attempts:2, hints:1, stars:2 });
      finish(id, true); finish(id, true); finish(id, true);
    });
    if (g.reviewGraduatedCount() < g.REVIEW_BADGE_AT)
      bad("[повтор] закреплённых меньше, чем нужно для бейджа");
    if (g.state.badges.indexOf("again") < 0) bad("[повтор] бейдж «Закрепил» не выдан");

    /* слияние: «сколько раз закрепил» — результат, берём больший */
    const mr = g.mergeProgress({ review:{ x:{ n:1, at:5 } }, savedAt:9 },
                               { review:{ x:{ n:3, at:9 } }, savedAt:1 });
    if (!mr.review || mr.review.x.n !== 3 || mr.review.x.at !== 9)
      bad("[повтор] слияние откатило закреплённое: " + JSON.stringify(mr && mr.review));

    /* смена ученика стирает и повторы тоже */
    if (Object.keys(g.clearAll({ review:{ x:{ n:2, at:1 } } }).review).length)
      bad("[повтор] смена ученика не стёрла повторы");

    g.state.review = {}; g.state.stars = savedStars; g.state.log = savedLog;
    g.state.xp = savedXp; g.state.badges = savedBadges;
    if (problems.length === p0) againChecked++;
    viewReset(g);
  }

  /* --- шпаргалка --- */
  let sheetChecked = 0;
  if (typeof g.openSheet === "function"){
    const p0 = problems.length;
    const CS = w.CHEATSHEET || [];
    const total = CS.reduce((n, x) => n + (x.items || []).length, 0);
    if (!total) bad("[шпаргалка] нет ни одной записи");

    const savedStars = JSON.parse(JSON.stringify(g.state.stars));
    const savedUnlock = g.state.admin.unlockAll;
    g.state.admin.unlockAll = false;

    /* главное свойство шпаргалки: её открывают ПОСРЕДИ урока, и написанный
       код от этого пропадать не должен. Отдельным экраном он бы пропал. */
    g.openLesson("vars");
    await tick();
    const st = studioOf();
    if (!st) bad("[шпаргалка] не открылся урок, на котором её проверяем");
    else {
      st.editor.setCode("мой_код = 1");
      doc.getElementById("btn-sheet").click();
      if (!g.sheetIsOpen()) bad("[шпаргалка] не открылась по кнопке");
      /* именно в документе, а не «объект ещё жив»: сессия держит ссылку на
         редактор и после того, как экран стёрт, — по ней поломку не увидеть */
      if (!doc.getElementById("studio") || !doc.getElementById("studio").firstChild)
        bad("[шпаргалка] снесла экран урока — а она обязана открываться поверх");
      else if (studioOf().editor.getCode() !== "мой_код = 1")
        bad("[шпаргалка] стёрла написанный код: " + JSON.stringify(studioOf().editor.getCode()));
    }

    /* показываем только пройденное; «показать всё» открывает остальное */
    g.state.stars = { "print-first": 3 };
    g.sheetRender();
    const learned = CS.reduce((n, x) =>
      n + x.items.filter(it => it.lesson === "print-first").length, 0);
    let cards = doc.querySelectorAll("#sheetbody .shitem").length;
    if (cards !== learned)
      bad(`[шпаргалка] показано ${cards} записей, а пройден один урок с ${learned}`);
    doc.getElementById("sheetall").checked = true;
    g.sheetRender();
    cards = doc.querySelectorAll("#sheetbody .shitem").length;
    if (cards !== total) bad(`[шпаргалка] «показать всё» дало ${cards} из ${total}`);
    if (!doc.querySelectorAll("#sheetbody .shitem.soon").length)
      bad("[шпаргалка] непройденные записи ничем не помечены");

    /* поиск сужает список, а не молчит */
    const qEl = doc.getElementById("sheetq");
    qEl.value = "словар"; g.sheetRender();
    const found = doc.querySelectorAll("#sheetbody .shitem").length;
    if (!found) bad("[шпаргалка] поиск по «словар» ничего не нашёл");
    if (found >= total) bad("[шпаргалка] поиск ничего не отфильтровал");
    qEl.value = "щщщ"; g.sheetRender();
    if (doc.querySelectorAll("#sheetbody .shitem").length)
      bad("[шпаргалка] по бессмысленному запросу что-то нашлось");
    if (!/ничего не нашлось/.test(doc.getElementById("sheetbody").textContent))
      bad("[шпаргалка] пустой поиск ничего не объясняет");
    qEl.value = ""; doc.getElementById("sheetall").checked = false; g.sheetRender();

    /* вывод примера считается движком, а не берётся из файла */
    const any = CS[0].items[0];
    if (!String(g.sheetRun(any)).trim())
      bad("[шпаргалка] пример «" + any.id + "» показывается без вывода");

    g.closeSheet();
    if (g.sheetIsOpen()) bad("[шпаргалка] не закрылась");

    g.state.stars = savedStars;
    g.state.admin.unlockAll = savedUnlock;
    if (problems.length === p0) sheetChecked++;
    viewReset(g);
  }

  /* --- отчёт за неделю в панели наставника --- */
  let weekChecked = 0;
  if (typeof g.weekReportHTML === "function"){
    const p0 = problems.length;
    /* дата со сдвигом в днях, в полдень — как в самом приложении */
    const dk = (off) => {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off);
      const p = x => (x < 10 ? "0" : "") + x;
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
    };
    const at = (off) => { const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+off); return d.getTime(); };

    /* пусто: отчёт обязан честно сказать, что занятий не было */
    const empty = g.weekReportHTML({ stars:{}, log:{}, days:{}, shields:{} });
    if (!/занятий не было/.test(empty)) bad("[отчёт] пустая неделя не названа пустой");

    /* три занятия, три урока, один из них дался тяжело */
    const st = {
      stars: { "print-first":3, "text-vs-num":2, "vars":1 },
      log: {
        "print-first": { attempts:1, hints:0, shown:0, timeMs:5*60000, solvedAt: at(-4) },
        "text-vs-num": { attempts:2, hints:0, shown:0, timeMs:7*60000, solvedAt: at(-2) },
        "vars":        { attempts:6, hints:3, shown:1, timeMs:18*60000, solvedAt: at(0) }
      },
      days: { [dk(-4)]:1, [dk(-2)]:1, [dk(0)]:1 },
      shields: { [dk(-1)]:1 }
    };
    const html = g.weekReportHTML(st);
    if (!/3 занятия/.test(html)) bad("[отчёт] неверно посчитаны занятия за неделю");
    if (!/3 урока/.test(html)) bad("[отчёт] неверно посчитаны уроки за неделю");
    if (!/30 мин/.test(html)) bad("[отчёт] неверно сложено время за неделю");
    if (!/Тяжело далось/.test(html)) bad("[отчёт] трудный урок не показан");
    if (!/Переменные/.test(html)) bad("[отчёт] в трудных не тот урок");
    if (/Первая команда/.test(html.split("Тяжело далось")[1] || ""))
      bad("[отчёт] лёгкий урок попал в трудные");
    if (!/смотрел решение/.test(html)) bad("[отчёт] не названа причина, почему урок был тяжёлым");
    if (!/Дальше по программе/.test(html)) bad("[отчёт] не сказано, что дальше");
    /* 🛡 есть и в подписи под полосой, поэтому мало искать сам значок:
       проверяем и класс клетки, и что значков стало два — в легенде и в дне */
    if (!/wrday shield/.test(html)) bad("[отчёт] день, закрытый щитом, не отмечен в полосе");
    if ((html.match(/🛡/g) || []).length < 2) bad("[отчёт] в клетке щита нет значка щита");

    /* урок, пройденный давно, в недельный счёт попадать не должен */
    const old = g.weekReportHTML({
      stars:{ "print-first":3 },
      log:{ "print-first": { attempts:1, timeMs:60000, solvedAt: at(-30) } },
      days:{ [dk(-30)]:1 }, shields:{} });
    if (!/занятий не было/.test(old)) bad("[отчёт] занятие месячной давности сочли недельным");

    /* отчёт есть и на самом экране панели */
    g.adminUnlock();
    g.screenAdmin();
    await tick();
    if (!doc.querySelector(".weekrep")) bad("[отчёт] в панели наставника его нет");

    if (problems.length === p0) weekChecked++;
    viewReset(g);
  }

  /* --- щит для стрика --- */
  let shieldChecked = 0;
  if (typeof g.useShield === "function"){
    const p0 = problems.length;
    const E = g.SHIELD_EVERY, MAX = g.SHIELD_MAX;
    /* дата со сдвигом в днях, в полдень — как в самом приложении */
    const dk = (off) => {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off);
      const p = x => (x < 10 ? "0" : "") + x;
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
    };
    const setDays = (offs, shieldOffs) => {
      g.state.days = {}; offs.forEach(o => { g.state.days[dk(o)] = 1; });
      g.state.shields = {}; (shieldOffs || []).forEach(o => { g.state.shields[dk(o)] = 1; });
    };
    /* n произвольных дат подряд — только для арифметики запаса */
    const mkDays = (n) => {
      const o = {}; const d = new Date("2030-01-01T12:00:00");
      for (let i = 0; i < n; i++){
        const p = x => (x < 10 ? "0" : "") + x;
        o[d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())] = 1;
        d.setDate(d.getDate() + 1);
      }
      return o;
    };

    /* арифметика запаса: щит за каждые E дней занятий, но не больше MAX */
    if (g.shieldsLeftIn(mkDays(E - 1), {}) !== 0)
      bad("[щит] щит выдан раньше " + E + " дней занятий");
    if (g.shieldsLeftIn(mkDays(E), {}) !== 1)
      bad("[щит] за " + E + " дней занятий щит не выдан");
    if (g.shieldsLeftIn(mkDays(E * (MAX + 1)), {}) !== MAX)
      bad("[щит] запас не ограничен " + MAX + " щитами");
    if (g.shieldsLeftIn(mkDays(E), { "2030-06-01": 1 }) !== 0)
      bad("[щит] потраченный щит не списался из запаса");

    /* сквозной путь: вчера пропущено, ребёнок вернулся и позанимался —
       щит должен сработать сам и продолжить серию */
    setDays([-6, -5, -4, -3, -2]);             /* вчера (-1) пропущено, сегодня ещё нет */
    if (!g.shieldWouldSave()) bad("[щит] щит не готов спасти серию после одного пропуска");
    if (g.streakCurrent() !== 0)
      bad("[щит] до занятия серия должна показывать 0, а не " + g.streakCurrent());
    g.markActiveToday();
    if (!g.shieldedOn(dk(-1))) bad("[щит] первое занятие после пропуска не пустило щит в дело");
    if (g.streakCurrent() !== 7)
      bad("[щит] серия после спасения должна быть 7, а не " + g.streakCurrent());
    if (g.useShield() !== null) bad("[щит] щит потратился на тот же день дважды");
    if (g.shieldWouldSave()) bad("[щит] щит всё ещё «готов спасти» уже закрытый день");

    /* два пропуска подряд щит не закрывает — серия честно начинается заново */
    setDays([-7, -6, -5, -4, -3, 0]);          /* пропущены и -1, и -2 */
    if (g.shieldWouldSave()) bad("[щит] щит считает, что спасёт серию с дырой в два дня");
    if (g.useShield() !== null) bad("[щит] щит закрыл дыру в два дня");
    if (g.streakCurrent() !== 1)
      bad("[щит] после двух пропусков серия должна быть 1, а не " + g.streakCurrent());

    /* без запаса щит не срабатывает */
    setDays([-3, -2, 0]);                      /* всего 3 дня занятий — щита нет */
    if (g.shieldsLeft() !== 0) bad("[щит] запас есть там, где его быть не должно");
    if (g.useShield() !== null) bad("[щит] щит сработал при пустом запасе");

    /* слияние двух устройств: потраченные щиты объединяются, как дни */
    const ms = g.mergeProgress({ shields:{ "2030-02-01":1 } }, { shields:{ "2030-02-05":1 } });
    if (!ms.shields || !ms.shields["2030-02-01"] || !ms.shields["2030-02-05"])
      bad("[щит] слияние потеряло потраченные щиты: " + JSON.stringify(ms && ms.shields));

    /* запас виден на экране «Сегодня» */
    setDays([-4, -3, -2, -1, 0]);
    g.screenToday();
    await tick();
    if (!doc.querySelector(".shieldbox")) bad("[щит] на экране «Сегодня» нет блока про щиты");

    /* оставляем состояние опрятным */
    g.state.days = {}; g.state.days[g.dayKey()] = 1; g.state.shields = {}; g.save();
    if (problems.length === p0) shieldChecked++;
    viewReset(g);
  }

  /* --- бейджи за длинный стрик ---
     Щит серию держал, а награды за неё не было. Проверяем не только выдачу,
     но и обратное: за короткую серию бейджа быть не должно, иначе награда
     ничего не значит. И что серия, доросшая на другом устройстве, приносит
     бейдж при слиянии, а не ждёт следующего занятия. */
  let streakBadgeChecked = 0;
  if (Array.isArray(g.STREAK_BADGES) && g.STREAK_BADGES.length){
    const p0 = problems.length;
    const dk = (off) => {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off);
      const p = x => (x < 10 ? "0" : "") + x;
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
    };
    /* серия из n дней, кончающаяся сегодня */
    const runTo = (n) => {
      const o = {};
      for (let i = 0; i < n; i++) o[dk(-i)] = 1;
      return o;
    };
    /* каждый бейдж обязан быть описан в BADGES, иначе toast промолчит
       и ребёнок не узнает, что что-то получил */
    for (const b of g.STREAK_BADGES)
      if (!g.BADGES.filter(x => x.id === b.id).length)
        bad(`[бейдж] ${b.id}: нет описания в BADGES — награда невидимая`);

    for (const b of g.STREAK_BADGES){
      /* на один день меньше порога — бейджа быть не должно */
      g.state.badges = []; g.state.shields = {};
      g.state.days = runTo(b.days - 1);
      g.awardStreak();
      if (g.state.badges.indexOf(b.id) >= 0)
        bad(`[бейдж] ${b.id}: выдан за ${b.days - 1} дней, а порог ${b.days}`);

      /* ровно порог — обязан появиться */
      g.state.badges = []; g.state.days = runTo(b.days);
      g.awardStreak();
      if (g.state.badges.indexOf(b.id) < 0)
        bad(`[бейдж] ${b.id}: не выдан за ${b.days} дней подряд`);

      /* повторно не дублируется */
      g.awardStreak();
      if (g.state.badges.filter(x => x === b.id).length !== 1)
        bad(`[бейдж] ${b.id}: продублировался при повторной проверке`);
    }

    /* прерванная серия того же размера бейджа не даёт: дни есть, подряд их нет */
    const longest = g.STREAK_BADGES[g.STREAK_BADGES.length - 1];
    g.state.badges = []; g.state.shields = {}; g.state.days = {};
    for (let i = 0; i < longest.days + 6; i += 2) g.state.days[dk(-i)] = 1;  /* через день */
    g.awardStreak();
    if (g.state.badges.length)
      bad("[бейдж] бейдж выдан за дни через день — серии там нет");

    /* серия доросла на другом устройстве: слияние обязано принести бейдж */
    const week = g.STREAK_BADGES[0];
    g.state.badges = []; g.state.days = {}; g.state.shields = {};
    g.applyProgress({ v: 2, days: runTo(week.days), stars: {}, log: {} });
    if (g.state.badges.indexOf(week.id) < 0)
      bad(`[бейдж] ${week.id}: серия приехала с другого устройства, а бейдж не выдан`);

    /* занятие сегодня само доводит серию до порога и выдаёт бейдж */
    g.state.badges = []; g.state.shields = {}; g.state.days = {};
    for (let i = 1; i < week.days; i++) g.state.days[dk(-i)] = 1;  /* вчера и раньше */
    g.markActiveToday();
    if (g.state.badges.indexOf(week.id) < 0)
      bad(`[бейдж] ${week.id}: занятие сегодня замкнуло серию, а бейдж не выдан`);

    g.state.badges = []; g.state.days = {}; g.state.shields = {};
    if (problems.length === p0) streakBadgeChecked++;
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
  console.log(`«Ты и ИИ» прогнано: ${ailabChecked} из ${AILAB.length}` +
              ` (из них вердиктов: ${reviewChecked} из ${AILAB.filter(x => x.type === "review").length})`);
  console.log(`живой разбор расхождения: ${whyChecked} случаев`);
  console.log(`визуализатор проверен: ${vizChecked} проверок (стек вызовов, разбор шага, подсветка)`);
  console.log(`задача дня и стрик: ${dailyChecked ? "да" : "нет"}`);
  console.log(`расписание занятий: ${schedChecked ? "да" : "нет"}`);
  console.log(`щит для стрика: ${shieldChecked ? "да" : "нет"}`);
  console.log(`бейджи за стрик: ${streakBadgeChecked ? "да" : "нет"}`);
  console.log(`проектов пройдено по шагам: ${projChecked} из ${(w.PROJECTS || []).length}`);
  console.log(`работа над ошибками: ${againChecked ? "да" : "нет"}`);
  console.log(`шпаргалка: ${sheetChecked ? "да" : "нет"}`);
  console.log(`отчёт за неделю: ${weekChecked ? "да" : "нет"}`);
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
