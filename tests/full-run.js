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
      /* frame — рамка занятий: у неё, как и у расписания, есть значения по
         умолчанию (длина, состав, галочка отчётов), поэтому «пусто» для неё
         означает «ровно blankFrame», а не «объект без ключей». Проверяем
         точным сравнением: так строже, чем общее правило. */
      if (k === "frame"){
        if (JSON.stringify(v) !== JSON.stringify(g.blankFrame()))
          bad(`[смена ученика] рамка прошлого взрослого осталась: ${JSON.stringify(v)}`);
        return;
      }
      const empty = v === null || v === "" || v === 0 ||
        (Array.isArray(v) ? v.length === 0 :
         (v && typeof v === "object" ? Object.keys(v).filter(x => x !== "days").length === 0 : false));
      if (!empty)
        bad(`[смена ученика] поле «${k}» не очищено: ${JSON.stringify(v)} — прогресс двух детей смешается`);
    });
    if (mine.schedule.days.length) bad("[смена ученика] расписание прошлого ребёнка осталось");

    /* сброс в панели наставника: результаты стёрты, имя и своё творчество целы */
    const res = g.clearResults(Object.assign({}, full, { name:"Аня", sandbox:"мой код" }));
    ["stars","log","warmups","ailab","days","daily","shields","projects","drawDone","gamesPlayed","drafts"]
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
  g.state.name = "Миша";
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
  /* ⚠️ Имя ребёнка на сервер НЕ уходит — и это проверяется как обещание, а не
     как мелочь. Пока на сервере лежат только код и результаты, ребёнок в нашей
     базе неопознаваем, и фраза «о ребёнке мы не храним ничего» остаётся правдой.
     Стоит положить туда имя рядом с адресом взрослого — и появляется «ребёнок
     клиента такого-то», то есть категория «несовершеннолетние».
     Разбор: docs/zanyatie-i-vzroslyj.md §§ 13–14. */
  const meRow = (lst && lst.students || []).filter(x => x.code === "test-kid")[0];
  if (!meRow) bad("[сервер] ученик не попал в список наставника");
  else if (meRow.name) bad("[сервер] ИМЯ РЕБЁНКА УЕХАЛО НА СЕРВЕР: " + JSON.stringify(meRow));
  if (JSON.stringify(g.cloudSnapshot()).indexOf("Миша") >= 0)
    bad("[сервер] имя ребёнка попало в снимок для отправки — проверь CLOUD_SKIP");
  if (g.state.name !== "Миша")
    bad("[сервер] имя пропало с устройства ребёнка — оно должно остаться в браузере");

  /* --- панель показывает чужой прогресс, не трогая свой --- */
  const myXpBefore = g.state.xp;
  g.screenAdmin();
  await tick();

  /* список учеников в самой панели: строка должна называть ребёнка по имени */
  const keyField = doc.getElementById("adminkey");
  if (!keyField) bad("[панель] нет поля для ключа наставника");
  else {
    keyField.value = "kluch-testa";
    doc.querySelector('[data-act="listall"]').click();
    await tick(40);
    const rows = doc.querySelectorAll(".admlrow");
    if (!rows.length) bad("[панель] список учеников не отрисовался");
    else {
      const txt = Array.prototype.map.call(rows, r => r.textContent).join(" | ");
      /* Имени в списке быть не должно (его нет на сервере), а человеческая
         подпись заводится наставником у себя и на сервер не уходит. */
      if (txt.indexOf("Миша") >= 0)
        bad("[панель] имя ребёнка показано в списке — оно не должно доезжать: " + txt.slice(0, 160));
      g.adminLabelSet("test-kid", "Петя, 5 класс");
      doc.querySelector('[data-act="listall"]').click();
      await tick(40);
      const txt2 = Array.prototype.map.call(doc.querySelectorAll(".admlrow"), r => r.textContent).join(" | ");
      if (txt2.indexOf("Петя, 5 класс") < 0)
        bad("[панель] подпись наставника не показана: " + txt2.slice(0, 160));
      if (JSON.stringify(g.cloudSnapshot()).indexOf("Петя, 5 класс") >= 0)
        bad("[панель] подпись наставника уехала бы на сервер — она должна жить в admin");
      if (txt.indexOf("undefined") >= 0)
        bad("[панель] в списке учеников напечатано «undefined»: " + txt.slice(0, 160));
      if (txt.indexOf("anya-2b") < 0)
        bad("[панель] ученик без имени пропал из списка вместо показа по коду");
    }
  }
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
    if (wm.type === "memory"){
      /* «предскажи память»: верный ответ считает сам движок из снимка кучи.
         Проверяем и то, что ответ засчитывается, и что задание вообще имеет
         смысл: подсвечена та самая строка, а поля — ровно по числу вопросов. */
      const right = w.__game.memAnswers(wm);
      const asLines = o => wm.ask.map(n => n + "=" + o[n]).join("\n");
      w.__game.openWarmup(wm.id);
      await tick();
      const stm = studioOf();
      if (!stm){ bad(`[разминки] ${wm.id}: разминка не открылась`); continue; }
      if (doc.querySelectorAll(".memq .memin").length !== wm.ask.length)
        bad(`[разминки] ${wm.id}: полей для ответа не столько, сколько переменных в ask`);
      const here = [...doc.querySelectorAll(".memq .mline")].findIndex(l => l.classList.contains("here"));
      if (here + 1 !== wm.stop)
        bad(`[разминки] ${wm.id}: подсвечена строка ${here + 1}, а замереть надо на ${wm.stop}`);
      if (doc.querySelector(".memq .vizmem") && doc.querySelector(".memq .pout").style.display !== "none")
        bad(`[разминки] ${wm.id}: память показана до ответа — предсказывать нечего`);

      good = await attemptWarmup(wm.id, asLines(right));
      if (!good.ok) bad(`[разминки] ${wm.id}: верный ответ не засчитан — ${good.why}`);
      /* та же память, но кавычки другие и пробелы иначе — обязано засчитаться */
      const loose = {};
      wm.ask.forEach(n => { loose[n] = String(right[n]).replace(/'/g, '"').replace(/, /g, ","); });
      const soft = await attemptWarmup(wm.id, asLines(loose));
      if (!soft.ok) bad(`[разминки] ${wm.id}: тот же ответ с другими кавычками не засчитан — ${soft.why}`);
      /* одно значение испорчено — засчитываться не должно */
      const spoiled = Object.assign({}, right);
      spoiled[wm.ask[0]] = String(right[wm.ask[0]]) + "X";
      wr = await attemptWarmup(wm.id, asLines(spoiled));
      if (wr.ok) bad(`[разминки] ${wm.id}: неверное значение засчитано как верное`);
      else if (!new RegExp(wm.ask[0]).test(wr.why) && wm.ask.length > 1)
        bad(`[разминки] ${wm.id}: не сказано, в какой переменной ошибка — ${wr.why}`);
      if (good.ok && !wr.ok) warmupsChecked++;
      continue;
    }
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

  /* catch: правильного ответа нет — есть требование к любому ответу. Поэтому
     проверяем не «совпало с эталоном», а всё поведение механики: эталонная
     проверка засчитывается, пустая — нет, бесполезная — нет, правка кода ИИ —
     нет, а случайность отклоняется отдельным сообщением. */
  let catchChecked = 0;
  async function attemptCatch(x){
    const g = w.__game;
    const start = g.catchStart(x);
    g.openAILesson(x.id);
    await tick();
    if (!doc.querySelector(".claimcard"))
      return bad(`[ты-и-ии] ${x.id}: не показано обещание ИИ (claim)`);
    const st = studioOf();
    if (!st) return bad(`[ты-и-ии] ${x.id}: задание не открылось`);
    if (st.editor.getCode() !== start)
      return bad(`[ты-и-ии] ${x.id}: в редакторе не код ИИ с местом под проверку`);

    /* задача обязана быть честной: на примере автора расхождения нет */
    if (g.catchRun(x.code) !== g.catchRun(x.truth))
      bad(`[ты-и-ии] ${x.id}: app видит расхождение уже на примере автора — искать нечего`);

    const attempt = async (text) => {
      st.editor.setCode(text);
      st.querySelector('[data-role="check"]').click();
      await tick();
      const r = { ok: won(), why: msgText() };
      if (r.ok) closeWin();
      return r;
    };

    let r = await attempt(start);
    if (r.ok) return bad(`[ты-и-ии] ${x.id}: пустая проверка засчитана`);
    if (!/Проверки пока нет/.test(r.why))
      bad(`[ты-и-ии] ${x.id}: про пустую проверку сказано непонятно — ${r.why}`);

    r = await attempt(start + 'print("привет")\n');
    if (r.ok) return bad(`[ты-и-ии] ${x.id}: проверка, ничего не ловящая, засчитана`);
    if (!/Не поймала/.test(r.why))
      bad(`[ты-и-ии] ${x.id}: про бесполезную проверку сказано непонятно — ${r.why}`);

    /* Случайность победы не приносит. В нашем движке генератор засевается
       одинаково на каждый запуск, поэтому обе версии получают одни и те же
       числа и расхождения не возникает вовсе — но проверить это надо: иначе
       достаточно было бы напечатать случайное число, чтобы «доказать» что
       угодно. Сообщение при этом может быть любым из двух — важно, что не победа. */
    r = await attempt(start + 'import random\nprint(random.randint(1, 1000000))\n');
    if (r.ok) return bad(`[ты-и-ии] ${x.id}: победа за случайное число — так доказать нельзя`);

    r = await attempt("# я тут всё переписал\n" + start.split("\n").slice(1).join("\n") + x.probe);
    if (r.ok) return bad(`[ты-и-ии] ${x.id}: победа при изменённом коде ИИ`);
    if (!/Код ИИ изменён/.test(r.why))
      bad(`[ты-и-ии] ${x.id}: правка кода ИИ отклонена не по той причине — ${r.why}`);

    r = await attempt(start + x.probe);
    if (!r.ok) return bad(`[ты-и-ии] ${x.id}: эталонная проверка не засчитана — ${r.why}`);
    return true;
  }

  for (const x of AILAB){
    let good, wr;
    if (x.type === "catch"){
      if (await attemptCatch(x) === true){ ailabChecked++; catchChecked++; }
      continue;
    }
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

  /* --- разминки открываются по прогрессу ---
     Раньше разминки были открыты все сразу, и задачей дня ребёнку из Мира 1
     могло выпасть упражнение про zip. Проверяем сам замок, а не разметку. */
  let warmGateChecked = 0;
  if (typeof g.warmupOpen === "function"){
    const p0 = problems.length;
    const savedStars = JSON.parse(JSON.stringify(g.state.stars));
    const savedUnlock = g.state.admin.unlockAll;
    g.state.admin.unlockAll = false;

    WARMUPS.forEach(x => {
      if (x.lesson && !CUR.byId(x.lesson))
        bad(`[замок разминки] ${x.id} ссылается на урок «${x.lesson}», а такого урока нет`);
    });
    const gated = WARMUPS.filter(x => x.lesson);
    if (!gated.length) bad("[замок разминки] ни одна разминка не привязана к уроку — проверять нечего");

    /* чистый прогресс: открыто не всё */
    g.state.stars = {};
    if (g.warmupsOpen().length === WARMUPS.length)
      bad("[замок разминки] на пустом прогрессе открыты все — замка нет");

    /* задача дня НИКОГДА не может оказаться закрытой */
    g.state.stars = {}; g.state.stars[gated[0].lesson] = 3;
    let leaked = null;
    for (let i = 1; i <= 40 && !leaked; i++){
      const pick = g.dailyPick("2031-01-" + (i < 10 ? "0" + i : i));
      if (pick && !g.warmupOpen(pick)) leaked = pick.id;
    }
    if (leaked) bad("[замок разминки] задачей дня выпала закрытая разминка: " + leaked);
    if (!g.dailyPick("2031-01-05"))
      bad("[замок разминки] задача дня пропала, хотя одна разминка открыта");

    /* совсем пустой прогресс: честное «пока нечего», а не закрытая задача */
    g.state.stars = {};
    if (g.dailyPick("2031-01-05"))
      bad("[замок разминки] на пустом прогрессе выдана задача дня, читать которую нечем");
    g.screenToday();
    await tick();
    if (!/появится/.test(doc.body.textContent))
      bad("[замок разминки] экран «Сегодня» не объясняет, почему задачи дня нет");

    /* урок пройден — своя разминка открылась */
    const sample = gated[0];
    if (g.warmupOpen(sample)) bad("[замок разминки] " + sample.id + " открыта до своего урока");
    g.state.stars[sample.lesson] = 3;
    if (!g.warmupOpen(sample)) bad("[замок разминки] " + sample.id + " не открылась после своего урока");

    /* на экране закрытая видна замком и не нажимается */
    g.state.stars = {};
    g.screenWarmups();
    await tick();
    const lockedCard = doc.querySelector(".gamecard.locked");
    if (!lockedCard) bad("[замок разминки] закрытые ничем не помечены на экране");
    else {
      if (!lockedCard.disabled) bad("[замок разминки] закрытую разминку можно открыть кнопкой");
      if (!/Откроется после урока/.test(lockedCard.textContent))
        bad("[замок разминки] не сказано, какой урок откроет закрытую разминку");
    }

    /* «Открыть все уроки» в панели наставника снимает и этот замок */
    g.state.admin.unlockAll = true;
    if (g.warmupsOpen().length !== WARMUPS.length)
      bad("[замок разминки] «Открыть все уроки» не открывает разминки");

    g.state.stars = savedStars;
    g.state.admin.unlockAll = savedUnlock;
    if (problems.length === p0) warmGateChecked = 1;
    viewReset(g);
  } else bad("[замок разминки] замка нет — warmupOpen не выведен наружу");

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
          /* у каждого типа разминки свой «верный ответ»: у blocks это порядок
             строк, у memory — значения переменных, у predict — вывод программы */
          const answer = pick.type === "blocks"
            ? pick.code
            : pick.type === "memory"
            ? (function(){ const r = g.memAnswers(pick);
                           return pick.ask.map(n => n + "=" + r[n]).join("\n"); })()
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

        /* Обычный шаг начинается с кода, доехавшего с прошлого. Шаг со своей
           заготовкой — с неё: так устроен проект с ИИ-напарником, где напарник
           отдаёт новую редакцию целиком. Оба случая надо проверять, иначе
           подмена кода прошла бы незамеченной. */
        const startCode = st.editor.getCode();
        const wantStart = proj.steps[i].starter !== undefined
          ? proj.steps[i].starter
          : (i === 0 ? proj.steps[0].starter : proj.steps[i-1].solution);
        if (startCode !== wantStart)
          bad(`${tag} на шаге ${i+1} в редакторе не тот код, с которого шаг должен начинаться`);

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

  /* --- раскладка урока: объяснение и работа рядом ---
     Замер до правки: страница урока 2341px при экране 720px, а редактор
     начинался на 1698-м. Ребёнок щёлкал в редактор, страница уезжала, и за
     верхним краем оставались и объяснение, и текст задания. Проверяем не
     «класс появился», а то, ЧТО ИМЕННО должно быть рядом с редактором. */
  {
    const p0 = problems.length;
    g.openLesson("vars"); await tick();
    const grid = doc.querySelector(".lessongrid");
    if (!grid) bad("[раскладка] на уроке нет сетки объяснение/работа");
    else {
      if (!grid.querySelector(".lcol-read .card.theory"))
        bad("[раскладка] объяснение не попало в свою колонку");
      if (!grid.querySelector(".lcol-work #studio"))
        bad("[раскладка] редактор не попал в рабочую колонку");
      /* задание стоит в конце ЧТЕНИЯ, а не в верстаке: решение фаундера */
      if (!grid.querySelector(".lcol-read .goal"))
        bad("[раскладка] задание уехало из колонки объяснения");
      if (grid.querySelector(".lcol-work .goal"))
        bad("[раскладка] задание попало в колонку редактора — его место в конце объяснения");
      if (!grid.querySelector(".lcol-work .hintbox"))
        bad("[раскладка] подсказки оторваны от редактора");
      if (grid.querySelector(".lcol-read #studio"))
        bad("[раскладка] редактор оказался в колонке объяснения");
      if (grid.classList.contains("one"))
        bad("[раскладка] обычный урок помечен как одноколоночный");
    }
    /* Дорога назад НАВЕРХУ. Единственная кнопка «← К списку уроков» жила в
       самом низу страницы — то есть за экраном ровно тогда, когда ребёнок
       сидит в редакторе. Хлебные крошки её не заменяют: они выглядят
       подписью, а не кнопкой. */
    {
      const back = doc.querySelector(".crumbs .backbtn");
      if (!back) bad("[назад] наверху урока нет кнопки «Назад»");
      else {
        if (!/назад|к списку|к занятию/i.test(back.textContent))
          bad("[назад] кнопка наверху не говорит, куда ведёт: " + JSON.stringify(back.textContent));
        back.click();
        await tick();
        if (doc.querySelector(".lessongrid"))
          bad("[назад] кнопка наверху не увела с урока");
      }
      g.openLesson("vars"); await tick();
    }

    /* Верстак обязан говорить, ЧТО делать: задание стоит в конце объяснения,
       а редактор наверху справа, и без этой шапки правая колонка — код и
       кнопки без единого слова о задаче. */
    g.openLesson("vars"); await tick();
    const wt = doc.getElementById("worktask");
    const vbody = CONTENT.world1["vars"];
    if (!wt) bad("[верстак] над редактором нет шапки с задачей");
    else {
      if (!doc.querySelector(".lcol-work #worktask"))
        bad("[верстак] шапка задачи не в колонке редактора");
      const head = (doc.querySelector(".wthead") || {}).textContent || "";
      if (!/реша|чини/i.test(head))
        bad("[верстак] заголовок не говорит ребёнку, что тут делать: " + JSON.stringify(head));
      const line = (doc.querySelector(".wttxt") || {}).textContent || "";
      if (!line.trim()) bad("[верстак] в шапке нет текста задачи");
      if (/[<>]/.test(line)) bad("[верстак] в строку задачи попала разметка: " + line.slice(0, 60));
      /* ⚠️ Задание видно СРАЗУ. Свёрнутый блок экономил три строки и стоил
         непрочитанных требований: за словами «показать целиком» лежало
         единственное место, где написано, что засчитается. */
      if (doc.getElementById("wt-full").hidden)
        bad("[верстак] требования спрятаны — ребёнок может уйти, не прочитав их");
      if (doc.getElementById("wt-full").querySelectorAll("li").length !== vbody.task.list.length)
        bad("[верстак] в развёрнутой задаче не все пункты");
      /* Задвоения быть не должно: однострочник и раскрытый текст — это одна
         и та же цель задания, и вместе они печатают её дважды подряд. */
      if (!doc.querySelector(".wttxt").hidden)
        bad("[верстак] цель задания показана дважды: и строкой, и раскрытым текстом");
      /* Свернуть по-прежнему можно, и подпись говорит, что будет по нажатию,
         а не в каком мы состоянии. */
      doc.getElementById("wt-open").click();
      if (!doc.getElementById("wt-full").hidden)
        bad("[верстак] задача не сворачивается обратно");
      if (doc.querySelector(".wttxt").hidden)
        bad("[верстак] свёрнутый блок не показывает задачу одной строкой");
      if (!/показать/i.test(doc.querySelector(".wtchev").textContent))
        bad("[верстак] у свёрнутого блока подпись не зовёт раскрыть: " +
            JSON.stringify(doc.querySelector(".wtchev").textContent));
    }

    /* «→ В редактор» затирал код задания молча. Теперь он обязан сказать об
       этом и дать дорогу назад — иначе ребёнок остаётся с чужим кодом. */
    {
      const st0 = studioOf();
      const wasStarter = st0.editor.getCode();
      if (wasStarter !== vbody.task.starter)
        bad("[пример] урок открылся не с заготовки задания");
      const copy = doc.querySelector("[data-copy]");
      if (!copy) bad("[пример] в объяснении нет кнопки «В редактор»");
      else {
        copy.click(); await tick();
        const now = studioOf().editor.getCode();
        if (now === wasStarter) bad("[пример] кнопка «В редактор» ничего не подставила");
        const dn = doc.getElementById("draftnote");
        if (!dn || dn.hidden)
          bad("[пример] код задания подменён примером, а ребёнку об этом не сказали");
        const back = doc.getElementById("backtask");
        if (!back) bad("[пример] нет кнопки возврата к своей задаче");
        else {
          back.click(); await tick();
          if (studioOf().editor.getCode() !== vbody.task.starter)
            bad("[пример] возврат не вернул код задания");
          if (!doc.getElementById("draftnote").hidden)
            bad("[пример] подпись про пример осталась после возврата");
        }
      }
    }

    /* уроки с рисованием идут одной колонкой: рядом с редактором холст */
    g.openLesson("turtle-first"); await tick();
    const drawGrid = doc.querySelector(".lessongrid");
    if (!drawGrid || !drawGrid.classList.contains("one"))
      bad("[раскладка] урок с рисованием втиснут в узкую колонку — холсту там не хватит места");
    viewReset(g); await tick();
  }

  /* --- липкая полоска задания (узкий экран) ---
     В jsdom нет IntersectionObserver, поэтому подставляем свой и дёргаем его
     руками: важно не «наблюдатель создан», а что полоска показывает текст
     задания, разворачивается и уходит вместе с экраном. */
  {
    const p0 = problems.length;
    let io = null;
    w.IntersectionObserver = function(cb){
      this.cb = cb; io = this;
      this.observe = function(){}; this.disconnect = function(){ io = null; };
    };
    g.openLesson("vars"); await tick();
    const pin = doc.getElementById("taskpin");
    if (!pin) bad("[полоска] в разметке нет липкой полоски задания");
    else if (!io) bad("[полоска] наблюдатель за карточкой задания не заведён");
    else {
      if (!pin.hidden) bad("[полоска] полоска висит, хотя задание ещё видно");
      const goalP = doc.querySelector(".goal p");
      const txt = doc.getElementById("tp-txt").textContent.trim();
      if (!txt || txt !== goalP.textContent.trim())
        bad("[полоска] в полоске не текст задания: " + JSON.stringify(txt.slice(0, 60)));

      /* задание уехало выше верхнего края — полоска обязана появиться */
      io.cb([{ isIntersecting:false, boundingClientRect:{ top:-40 } }]);
      if (pin.hidden) bad("[полоска] задание уехало вверх, а полоска не появилась");

      const open = doc.getElementById("tp-open");
      open.click();
      if (doc.getElementById("tp-full").hidden)
        bad("[полоска] полный текст задания не разворачивается");
      if (doc.getElementById("tp-full").textContent.trim().length < 10)
        bad("[полоска] в развёрнутой полоске пусто");
      if (!doc.getElementById("tp-up")) bad("[полоска] нет кнопки возврата к объяснению");

      /* задание снова видно — полоска и её раскрытие уходят */
      io.cb([{ isIntersecting:true, boundingClientRect:{ top:120 } }]);
      if (!pin.hidden) bad("[полоска] задание снова видно, а полоска осталась");
      if (!doc.getElementById("tp-full").hidden)
        bad("[полоска] полоска спряталась, а её раскрытый текст остался");

      /* уход с урока обязан её убрать: на карте миров задания нет */
      io.cb([{ isIntersecting:false, boundingClientRect:{ top:-40 } }]);
      viewReset(g); await tick();
      if (!doc.getElementById("taskpin").hidden)
        bad("[полоска] осталась висеть после ухода с урока");
    }
    delete w.IntersectionObserver;
    viewReset(g); await tick();
  }

  /* --- черновики кода на экране урока ---
     Раньше уход с урока стирал написанное. Проверяем не «поле появилось»,
     а поведение: код переживает уход и возвращение, нетронутый урок ничего
     не занимает, а вернуться к чистой заготовке можно кнопкой. */
  let draftChecked = 0;
  if (typeof g.draftGet === "function"){
    const p0 = problems.length;
    g.state.drafts = {};
    const id = "vars", body = CONTENT.world1[id];
    if (!body) bad("[черновик] урока «vars» нет — проверять нечем");

    /* нетронутый урок черновика не заводит: это не работа, а исходное состояние */
    g.openLesson(id); await tick();
    viewReset(g); await tick();
    if (g.draftGet(id)) bad("[черновик] нетронутый урок оставил черновик");

    /* написанное переживает уход и возвращение */
    g.openLesson(id); await tick();
    let dst = studioOf();
    if (!dst) bad("[черновик] урок не открылся");
    else {
      dst.editor.setCode("мой = 5\nprint(мой)");
      viewReset(g); await tick();
      const d = g.draftGet(id);
      if (!d) bad("[черновик] код не сохранился при уходе с урока");
      else if (String(d.files[0].code).indexOf("мой = 5") < 0)
        bad("[черновик] сохранён не тот код: " + JSON.stringify(d.files[0].code).slice(0, 60));

      g.openLesson(id); await tick();
      dst = studioOf();
      if (!dst || dst.editor.getCode().indexOf("мой = 5") < 0)
        bad("[черновик] код не вернулся в редактор при возвращении в урок");
      const note = doc.getElementById("draftnote");
      if (!note || note.hidden)
        bad("[черновик] нет подписи о том, что в редакторе код с прошлого раза");

      /* выход к чистой заготовке: у обычного урока кнопки «вернуть как было»
         нет, и без этой ребёнок остался бы заперт со своей кашей */
      const fresh = doc.getElementById("draftfresh");
      if (!fresh) bad("[черновик] нет кнопки «Вернуть заготовку»");
      else {
        fresh.click(); await tick();
        const now = studioOf();
        if (!now || now.editor.getCode() !== body.task.starter)
          bad("[черновик] «Вернуть заготовку» не вернуло заготовку");
        if (g.draftGet(id)) bad("[черновик] «Вернуть заготовку» не стёрло черновик");
        if (!doc.getElementById("draftnote").hidden)
          bad("[черновик] подпись осталась после возврата к заготовке");
      }
      viewReset(g); await tick();
    }

    /* многофайловый урок: черновик обязан помнить ВСЕ файлы, а не главный */
    const mid = "modules-own", mbody = CONTENT.world3 && CONTENT.world3[mid];
    if (!mbody) bad("[черновик] многофайлового урока «modules-own» нет — проверять нечем");
    else {
      g.openLesson(mid); await tick();
      const ms = studioOf();
      if (!ms || !ms.editor.setFiles) bad("[черновик] многофайловый урок не открылся");
      else {
        const files = ms.editor.getFiles();
        if (files.length < 2) bad("[черновик] в многофайловом уроке один файл");
        ms.editor.setFiles(files.map(f => ({ name:f.name, code:"# " + f.name + "\nprint(1)" })));
        viewReset(g); await tick();
        const md = g.draftGet(mid);
        if (!md) bad("[черновик] многофайловый урок не сохранил черновик");
        else if (md.files.length !== files.length)
          bad(`[черновик] сохранено файлов ${md.files.length}, а в уроке ${files.length}`);
        g.openLesson(mid); await tick();
        const back = studioOf().editor.getFiles();
        if (back.some((f, i) => f.code.indexOf("# " + f.name) !== 0))
          bad("[черновик] в многофайловом уроке вернулись не все файлы: " +
              JSON.stringify(back.map(f => f.code.slice(0, 12))));
        viewReset(g); await tick();
      }
    }

    /* песочница теряла код ровно так же: он сохранялся только по «Запустить»
       и по нижней кнопке, а уход кнопкой верхней панели его стирал */
    g.screenSandbox(); await tick();
    const sb = g.getSession().studio;
    if (!sb) bad("[черновик] песочница не отдала редактор — её код снова можно потерять");
    else {
      sb.editor.setCode("# мои каракули\nforward(10)");
      viewReset(g); await tick();          /* уход НЕ через нижнюю кнопку */
      if (String(g.state.sandbox).indexOf("мои каракули") < 0)
        bad("[черновик] код песочницы потерялся при уходе через верхнюю панель");
    }

    /* шаги проекта теряли код точно так же: он сохранялся ТОЛЬКО на победе,
       и уход за подсказкой в шпаргалку стирал написанное на шаге. */
    if (typeof g.openProject === "function" && typeof g.projectDraftId === "function" && PROJECTS.length){
      const pr = PROJECTS[0], pkey = g.projectDraftId(pr.id, 0);
      const savedUnlock3 = g.state.admin.unlockAll;
      /* прогресс проектов трогать нельзя: дальше портфолио проверяет дату
         сборки, записанную настоящим проходом выше. Убираем только свой */
      const savedProj3 = JSON.parse(JSON.stringify(g.state.projects || {}));
      g.state.admin.unlockAll = true;
      delete g.state.projects[pr.id];
      g.state.drafts = {};

      g.openProject(pr.id); await tick();
      let ps = studioOf();
      if (!ps) bad("[черновик] шаг проекта не открылся");
      else {
        /* нетронутый шаг черновика не заводит */
        viewReset(g); await tick();
        if (g.draftGet(pkey)) bad("[черновик] нетронутый шаг проекта оставил черновик");

        g.openProject(pr.id); await tick();
        ps = studioOf();
        ps.editor.setCode("# мои каракули на шаге\nprint(1)");
        viewReset(g); await tick();
        const pd = g.draftGet(pkey);
        if (!pd) bad("[черновик] код шага проекта пропал при уходе с экрана");
        else if (String(pd.files[0].code).indexOf("каракули на шаге") < 0)
          bad("[черновик] на шаге проекта сохранён не тот код");

        g.openProject(pr.id); await tick();
        ps = studioOf();
        if (!ps || ps.editor.getCode().indexOf("каракули на шаге") < 0)
          bad("[черновик] код не вернулся в редактор шага проекта");
        const pnote = doc.getElementById("draftnote");
        if (!pnote || pnote.hidden)
          bad("[черновик] на шаге проекта нет подписи, что в редакторе код с прошлого раза");
        const pfresh = doc.getElementById("draftfresh");
        if (!pfresh) bad("[черновик] на шаге проекта нет кнопки «Начать шаг заново»");
        else {
          pfresh.click(); await tick();
          if (studioOf().editor.getCode() !== pr.steps[0].starter)
            bad("[черновик] «Начать шаг заново» не вернуло заготовку шага");
          if (g.draftGet(pkey)) bad("[черновик] «Начать шаг заново» не стёрло черновик шага");
        }

        /* сданный шаг черновика за собой не оставляет: код уехал в проект,
           и вторая копия только занимала бы место в прогрессе */
        ps = studioOf();
        ps.editor.setCode(pr.steps[0].solution);
        ps.querySelector('[data-role="check"]').click(); await tick();
        if (!won()) bad("[черновик] шаг проекта не засчитан эталоном — " + msgText());
        else {
          const nx = doc.getElementById("pnext");
          if (nx){ nx.click(); await tick(); } else closeWin();
          if (g.draftGet(pkey))
            bad("[черновик] сданный шаг проекта оставил за собой черновик");
        }
      }
      g.state.admin.unlockAll = savedUnlock3;
      g.state.projects = savedProj3;
      g.state.drafts = {};
      viewReset(g); await tick();
    } else bad("[черновик] шаги проекта черновиков не знают — projectDraftId не выведен наружу");

    /* слияние: код сложить нельзя, поэтому свежая копия побеждает,
       но черновик, который был только на одном устройстве, не теряется */
    const dm = g.mergeProgress(
      { drafts:{ a:{ files:[{ name:"main.py", code:"свежий" }], at:2 },
                 b:{ files:[{ name:"main.py", code:"только тут" }], at:1 } }, savedAt:2 },
      { drafts:{ a:{ files:[{ name:"main.py", code:"старый" }], at:1 } }, savedAt:1 });
    if (!dm.drafts || !dm.drafts.a || dm.drafts.a.files[0].code !== "свежий")
      bad("[черновик] слияние взяло не свежую версию: " + JSON.stringify(dm.drafts && dm.drafts.a));
    if (!dm.drafts.b)
      bad("[черновик] слияние потеряло черновик, который был только на одном устройстве");

    /* предел: черновики уезжают на сервер, расти без конца им нельзя */
    g.state.drafts = {};
    for (let i = 0; i < g.DRAFT_MAX + 5; i++)
      g.state.drafts["x" + i] = { files:[{ name:"main.py", code:"c" }], at: i + 1 };
    g.pruneDrafts();
    const left = Object.keys(g.state.drafts);
    if (left.length !== g.DRAFT_MAX)
      bad(`[черновик] предел не соблюдён: осталось ${left.length}, а можно ${g.DRAFT_MAX}`);
    if (left.indexOf("x0") >= 0) bad("[черновик] выброшены не самые старые черновики");

    g.state.drafts = {};
    if (problems.length === p0) draftChecked = 1;
    viewReset(g);
  } else bad("[черновик] черновиков нет — draftGet не выведен наружу");

  /* --- портфолио и сертификаты ---
     Сертификат — обещание, поэтому проверяем в первую очередь не разметку,
     а условие выдачи: уроки мира ПЛЮС собранный проект. Отдельно проверяем,
     что дата выдачи берётся из журнала, а не из сегодняшнего дня: иначе
     распечатанный вчера лист и распечатанный сегодня расходились бы. */
  let folioChecked = 0;
  if (typeof g.screenFolio === "function"){
    const p0 = problems.length;
    const savedStars = JSON.parse(JSON.stringify(g.state.stars));
    const savedProjects = JSON.parse(JSON.stringify(g.state.projects));
    const savedLog = JSON.parse(JSON.stringify(g.state.log));
    const savedName = g.state.name;

    /* дату сборки записывает настоящий проход проекта, а не тест: проекты
       выше пройдены по шагам, и последний из них остался в прогрессе */
    const lastId = PROJECTS.length ? PROJECTS[PROJECTS.length - 1].id : null;
    const live = lastId ? savedProjects[lastId] : null;
    if (!live || !live.doneAt)
      bad("[портфолио] после настоящей сборки проекта не записана дата — дата на сертификате будет плыть");

    const w1 = CUR.world(1), proj1 = g.projectOfWorld(1);
    if (!proj1) bad("[портфолио] у первого мира нет проекта — проверять сертификат нечем");
    g.state.name = "Аня";

    /* пусто: ни программ, ни сертификатов. Разминки и «Ты и ИИ» тоже чистим:
       выше по тесту они пройдены целиком, а за них теперь есть свои
       сертификаты — без этой чистки «пустой прогресс» пустым не был бы. */
    const savedWarm = JSON.parse(JSON.stringify(g.state.warmups));
    const savedAilab = JSON.parse(JSON.stringify(g.state.ailab));
    const savedCertAt = JSON.parse(JSON.stringify(g.state.certAt || {}));
    g.state.stars = {}; g.state.projects = {}; g.state.log = {};
    g.state.warmups = {}; g.state.ailab = {}; g.state.certAt = {};
    g.screenFolio();
    await tick();
    if (!doc.querySelector(".fstats")) bad("[портфолио] сводка не отрисовалась");
    if (!doc.querySelector(".certs")) bad("[портфолио] раздел сертификатов не отрисовался");
    if (doc.querySelector(".fpcode")) bad("[портфолио] показан код несобранного проекта");
    if (doc.querySelector(".certcard.got")) bad("[портфолио] сертификат выдан на пустом прогрессе");
    if (g.certWorldReady(1)) bad("[сертификат] мир 1 выдан без единого урока");
    if (!g.certWorldNeed(1)) bad("[сертификат] не сказано, чего не хватает до сертификата");

    /* все уроки мира пройдены, но проект НЕ собран — сертификата всё ещё нет */
    w1.lessons.forEach(l => { g.state.stars[l.id] = 3; g.state.log[l.id] = { solvedAt: 1000 }; });
    if (!g.worldWhole(1)) bad("[сертификат] мир не считается пройденным, хотя пройдены все его уроки");
    if (g.certWorldReady(1))
      bad("[сертификат] выдан без собранного проекта — сертификат без сделанной вещи это бумажка");

    /* проект собран — сертификат появляется */
    if (proj1){
      g.state.projects[proj1.id] =
        { step: proj1.steps.length, done:1, aiAt:-1, doneAt:2000, code:"print('моя программа')" };
      if (!g.certWorldReady(1)) bad("[сертификат] не выдан, хотя уроки пройдены и проект собран");
      if (g.certWorldAt(1) !== 2000)
        bad("[сертификат] дата выдачи не самая поздняя из уроков и проекта: " + g.certWorldAt(1));
      if (g.certWorldNeed(1)) bad("[сертификат] выданный сертификат всё ещё чего-то требует");
    }
    if (g.certCourseReady()) bad("[сертификат] курс выдан, когда пройден один мир из пяти");

    g.screenFolio();
    await tick();
    const pre = doc.querySelector(".fpcode");
    if (!pre) bad("[портфолио] код собранной программы не показан");
    else if (pre.textContent.indexOf("моя программа") < 0)
      bad("[портфолио] показан не тот код: " + pre.textContent.slice(0, 60));
    if (!doc.querySelector(".certcard.got")) bad("[портфолио] выданный сертификат не отмечен полученным");

    const certBtn = doc.querySelector('[data-cert="world1"]');
    if (!certBtn) bad("[портфолио] нет кнопки показа выданного сертификата");
    else {
      certBtn.click();
      await tick();
      if (!g.certIsOpen()) bad("[сертификат] лист не открылся");
      const t = (doc.getElementById("certbox") || {}).textContent || "";
      if (t.indexOf("Аня") < 0) bad("[сертификат] на листе нет имени ученика");
      if (!/Мир 1/.test(t)) bad("[сертификат] на листе не назван мир");
      if (!/\d\d\.\d\d\.\d{4}/.test(t)) bad("[сертификат] на листе нет даты выдачи");
      if (!/★/.test(t)) bad("[сертификат] на листе нет звёзд");
      const cl = doc.getElementById("certclose");
      if (!cl) bad("[сертификат] нет кнопки закрытия"); else cl.click();
      await tick();
      if (g.certIsOpen()) bad("[сертификат] лист не закрылся");
    }

    /* сертификат за весь курс: все пять миров и все пять проектов миров */
    CUR.forEach(wx => wx.lessons.forEach(l => {
      g.state.stars[l.id] = 3; g.state.log[l.id] = { solvedAt: 1000 };
    }));
    PROJECTS.forEach(pr => {
      g.state.projects[pr.id] =
        { step: pr.steps.length, done:1, aiAt:-1, doneAt:3000, code:"print(1)" };
    });
    if (!g.certCourseReady()) bad("[сертификат] курс не выдан, хотя пройдены все миры и собраны все проекты");
    g.openCert("course");
    await tick();
    const ct = (doc.getElementById("certbox") || {}).textContent || "";
    if (ct.indexOf(String(CUR.total)) < 0)
      bad("[сертификат] в сертификате за курс не названо число уроков");
    g.closeCert();

    /* дата сборки при слиянии — РАННЯЯ: проект собран тогда, когда собран
       впервые, а не когда об этом узнало второе устройство */
    const mp = g.mergeProgress(
      { projects:{ x:{ step:2, done:1, doneAt:500, code:"a" } }, savedAt:1 },
      { projects:{ x:{ step:2, done:1, doneAt:900, code:"b" } }, savedAt:2 });
    if (mp.projects.x.doneAt !== 500)
      bad("[сертификат] слияние взяло не раннюю дату сборки: " + mp.projects.x.doneAt);

    /* --- сертификаты за разделы вне сотни ---
       Обещание то же, что у миров: не «сколько прочитал», а всё сделано.
       У «Ты и ИИ» к заданиям добавлен проект «Напарник» — иначе сертификат
       был бы бумажкой без сделанной вещи. */
    if (typeof g.certSectionReady === "function"){
      const WARM = w.WARMUPS || [], AIL = w.AILAB || [], aiProj0 = g.projectOfWorld(0);
      g.state.warmups = {}; g.state.ailab = {}; g.state.certAt = {};
      Object.keys(g.state.projects).forEach(k => { if (aiProj0 && k === aiProj0.id) delete g.state.projects[k]; });

      if (g.certSectionReady("warmups")) bad("[сертификат] «Разминка» выдана на нуле разминок");
      if (!g.certSectionNeed("warmups")) bad("[сертификат] не сказано, сколько разминок осталось");
      if (g.certSectionAt("warmups")) bad("[сертификат] у невыданной «Разминки» есть дата");

      WARM.forEach(x => { g.state.warmups[x.id] = 1; });
      if (!g.certSectionReady("warmups")) bad("[сертификат] «Разминка» не выдана, хотя разгаданы все");
      if (g.certSectionNeed("warmups")) bad("[сертификат] выданная «Разминка» всё ещё чего-то требует");
      const wAt = g.certSectionAt("warmups");
      if (!wAt) bad("[сертификат] у выданной «Разминки» нет даты");
      /* дата обязана стоять на месте: лист, распечатанный дважды, — один лист */
      if (g.certSectionAt("warmups") !== wAt)
        bad("[сертификат] дата «Разминки» переписывается при каждом открытии");

      /* «Ты и ИИ»: заданий мало — нужен ещё проект раздела */
      AIL.forEach(x => { g.state.ailab[x.id] = 1; });
      if (aiProj0){
        if (g.certSectionReady("ailab"))
          bad("[сертификат] «Ты и ИИ» выдан без собранного проекта «" + aiProj0.title + "»");
        if (g.certSectionNeed("ailab").indexOf(aiProj0.title) < 0)
          bad("[сертификат] не сказано, что до «Ты и ИИ» не хватает проекта");
        g.state.projects[aiProj0.id] =
          { step: aiProj0.steps.length, done:1, aiAt:-1, doneAt:4000, code:"print(1)" };
      }
      if (!g.certSectionReady("ailab"))
        bad("[сертификат] «Ты и ИИ» не выдан, хотя сделаны все задания и проект");

      /* на самом листе: звёзд у раздела нет, и «★ 0 из 0» на бумаге быть не должно */
      const sheet = g.certBodyHTML("warmups");
      if (sheet.indexOf("★") >= 0)
        bad("[сертификат] на листе раздела нарисованы звёзды, которых у раздела нет");
      if (sheet.indexOf(String(WARM.length)) < 0)
        bad("[сертификат] на листе «Разминки» не названо число упражнений");

      g.screenFolio(); await tick();
      if (!doc.querySelector('.certcard.got [data-cert="warmups"], [data-cert="warmups"]'))
        bad("[портфолио] сертификата за «Разминку» нет среди карточек");
      if (!doc.querySelector('[data-cert="ailab"]'))
        bad("[портфолио] сертификата за «Ты и ИИ» нет среди карточек");

      /* слияние: дата выдачи — ранняя, и она не должна схлопываться в единицу */
      const cm = g.mergeProgress(
        { certAt:{ warmups: 500 }, savedAt:1 },
        { certAt:{ warmups: 900, ailab: 700 }, savedAt:2 });
      if (!cm.certAt || cm.certAt.warmups !== 500)
        bad("[сертификат] слияние взяло не раннюю дату выдачи: " + JSON.stringify(cm.certAt));
      if (cm.certAt.ailab !== 700)
        bad("[сертификат] слияние потеряло дату, которая была только на одном устройстве");
    } else bad("[сертификат] сертификатов за разделы вне сотни нет");

    /* печать: на бумагу должен уходить только лист. Правило одно, и если его
       убрать, распечатается вся тёмная страница целиком */
    if (html.indexOf("body>.cert:not([hidden])") < 0)
      bad("[сертификат] в стилях нет правила печати — на бумагу уйдёт вся страница");

    g.state.stars = savedStars; g.state.projects = savedProjects;
    g.state.log = savedLog; g.state.name = savedName;
    g.state.warmups = savedWarm; g.state.ailab = savedAilab; g.state.certAt = savedCertAt;
    viewReset(g);
    await tick();
    if (!doc.getElementById("gofolio")) bad("[портфолио] на карте миров нет входа в портфолио");
    if (problems.length === p0) folioChecked = 1;
    viewReset(g);
  } else bad("[портфолио] раздела нет — screenFolio не выведен наружу");

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

    /* Вывод примера считается движком в момент показа. Проверяем КАЖДУЮ запись,
       а не первую: sheetRun — отдельный путь от lessons.js и content-vs-python.js,
       которые зовут движок сами. Запись с файлами (open, csv) падает именно
       здесь, если sheetRun не отдаст ей data, и раньше это никто бы не заметил. */
    const brokenSheet = [];
    CS.forEach(x => (x.items || []).forEach(it => {
      const out = String(g.sheetRun(it) || "");
      if (!out.trim() || /^ошибка:/.test(out)) brokenSheet.push(it.id + " → " + out.slice(0, 50));
    }));
    if (brokenSheet.length)
      bad("[шпаргалка] примеры показываются с ошибкой или без вывода: " + brokenSheet.join("; "));

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

  /* --- проект вне миров: «Напарник» в разделе «Ты и ИИ» --- */
  let aiProjChecked = 0;
  const aiProj = (w.PROJECTS || []).filter(p => p.world === 0)[0];
  /* Проект вне миров опознаётся ровно по world === 0. Если у него окажется
     номер настоящего мира, он молча уедет на карту этого мира и подвинет
     оттуда родной проект — поэтому отсутствие такого проекта это поломка,
     а не «нечего проверять». */
  if (!aiProj) bad("[напарник] среди проектов нет ни одного с world = 0");
  if (aiProj && typeof g.projectOfWorld === "function"){
    const p0 = problems.length;
    const savedUnlock = g.state.admin.unlockAll;
    g.state.admin.unlockAll = false;
    g.state.ailab = {};
    g.state.projects = {};

    /* закрыт, пока не пройдены задания раздела — и карточка на экране закрытая */
    if (g.projectOpen(aiProj)) bad("[напарник] проект открыт, хотя задания раздела не пройдены");
    g.screenAILab();
    await tick();
    if (!doc.querySelector(".projcard.locked"))
      bad("[напарник] на экране «Ты и ИИ» нет закрытой карточки проекта");
    if (doc.getElementById("openaiproj")) bad("[напарник] кнопка открытия есть у закрытого проекта");

    /* карта мира про него знать не должна: у него нет своего мира */
    for (let n = 1; n <= 5; n++)
      if (g.projectOfWorld(n) && g.projectOfWorld(n).id === aiProj.id)
        bad(`[напарник] проект вне миров показан на карте мира ${n}`);

    (w.AILAB || []).forEach(x => { g.state.ailab[x.id] = 1; });
    if (!g.projectOpen(aiProj)) bad("[напарник] не открылся после всех заданий раздела");
    g.screenAILab();
    await tick();
    if (!doc.getElementById("openaiproj")) bad("[напарник] нет кнопки открыть проект");

    /* шаг с редакцией напарника: она подставляется, но ровно один раз */
    doc.getElementById("openaiproj").click();
    await tick();
    const withStarter = aiProj.steps.findIndex((s2, i2) => i2 > 0 && s2.starter !== undefined);
    if (withStarter < 0) bad("[напарник] ни один шаг не начинается с редакции напарника");
    else {
      for (let i = 0; i < withStarter; i++){
        const st = studioOf();
        st.editor.setCode(aiProj.steps[i].solution);
        st.querySelector('[data-role="check"]').click();
        await tick();
        if (!won()){ bad(`[напарник] шаг ${i+1}: эталон не засчитан — ${msgText()}`); break; }
        doc.getElementById("pnext").click();
        await tick();
      }
      const stA = studioOf();
      if (!stA) bad("[напарник] шаг с редакцией напарника не открылся");
      else {
        if (stA.editor.getCode() !== aiProj.steps[withStarter].starter)
          bad("[напарник] в редакторе не редакция напарника");
        if (!/редакция от напарника/.test(doc.body.textContent))
          bad("[напарник] не сказано, что код в редакторе переписан напарником");
        /* правки ребёнка не должны затираться при возврате на тот же шаг */
        stA.editor.setCode(aiProj.steps[withStarter].starter + "\n# моя пометка\n");
        g.state.projects[aiProj.id].code = aiProj.steps[withStarter].starter + "\n# моя пометка\n";
        g.openProject(aiProj.id, withStarter);
        await tick();
        if (!/моя пометка/.test(studioOf().editor.getCode()))
          bad("[напарник] возврат на шаг затёр правки ребёнка второй подстановкой");
      }
    }

    /* «пройти заново» обязано сбросить и отметку о подстановке */
    g.state.projects[aiProj.id] = { step: 4, code: "x", done: 1, aiAt: 2 };
    const mgA = g.mergeProgress(
      { projects:{ "project-ai": { step:1, done:0, aiAt:1, code:"a" } }, savedAt:1 },
      { projects:{ "project-ai": { step:2, done:0, aiAt:2, code:"b" } }, savedAt:2 });
    if (mgA.projects["project-ai"].aiAt !== 2)
      bad("[напарник] слияние потеряло отметку о подставленной редакции");

    g.state.admin.unlockAll = savedUnlock;
    if (problems.length === p0) aiProjChecked++;
    viewReset(g);
  }

  /* --- цена программы в шагах --- */
  let stepsChecked = 0;
  if (typeof g.stepsNote === "function"){
    const p0 = problems.length;
    const CUR2 = w.CURRICULUM, C2 = w.CONTENT;
    /* берём обычный урок без черепашки и без случайности */
    let target = null;
    for (const wd of CUR2){
      for (const l of wd.lessons){
        const body = (C2["world" + wd.n] || {})[l.id];
        if (!body || !body.task || !body.task.solution) continue;
        if (!g.stepsShown(body)) continue;
        target = { l, body }; break;
      }
      if (target) break;
    }
    if (!target) bad("[шаги] не нашлось ни одного урока, где цену вообще показывают");
    else {
      const { l, body } = target;
      g.state.log = {};
      g.setStars(l.id, 0);
      g.openLesson(l.id);
      await tick();
      const st = studioOf();
      if (!st) bad("[шаги] урок не открылся");
      else {
        st.editor.setCode(body.task.solution);
        st.querySelector('[data-role="check"]').click();
        await tick();
        if (!won()) bad("[шаги] эталон не засчитан — " + msgText());
        else {
          const card = doc.getElementById("wincard").textContent;
          if (!/шаг/.test(card)) bad("[шаги] в победной карточке нет цены программы");
          const best = g.state.log[l.id] && g.state.log[l.id].bestSteps;
          if (!best) bad("[шаги] рекорд по шагам не записан");
          const real = w.Runtime.get("mini").run(body.task.solution, {}).steps;
          if (best !== real) bad(`[шаги] записано ${best} шагов, а движок насчитал ${real}`);
          closeWin();

          /* тот же урок ещё раз тем же кодом: рекорд не должен «улучшиться» */
          g.openLesson(l.id);
          await tick();
          const st2 = studioOf();
          st2.editor.setCode(body.task.solution);
          st2.querySelector('[data-role="check"]').click();
          await tick();
          if (won()) closeWin();
          if (g.state.log[l.id].bestSteps !== real)
            bad("[шаги] повтор тем же кодом сдвинул рекорд");
        }
      }
      /* слияние: рекорд — единственное поле журнала, где меньше значит лучше */
      if (g.minPos(0, 7) !== 7 || g.minPos(9, 0) !== 9 || g.minPos(9, 7) !== 7)
        bad("[шаги] minPos считает рекорд неверно");
      const ms = g.mergeProgress(
        { log:{ x:{ bestSteps: 40 } }, savedAt:1 },
        { log:{ x:{ bestSteps: 12 } }, savedAt:2 });
      if (!ms.log.x || ms.log.x.bestSteps !== 12)
        bad("[шаги] слияние потеряло лучший рекорд: " + JSON.stringify(ms.log.x));
      const ms2 = g.mergeProgress(
        { log:{ x:{ bestSteps: 40 } }, savedAt:1 },
        { log:{ x:{} }, savedAt:2 });
      if (!ms2.log.x || ms2.log.x.bestSteps !== 40)
        bad("[шаги] слияние с пустым рекордом обнулило настоящий");

      /* где цену показывать нельзя — черепашка и случайность */
      if (g.stepsShown({ draw: true, task: { solution: "print(1)" } }))
        bad("[шаги] цена показана в уроке с черепашкой — там она зависит от длины линий");
      if (g.stepsShown({ task: { solution: "import random\nprint(random.randint(1, 6))" } }))
        bad("[шаги] цена показана там, где программа со случайностью");
    }
    if (problems.length === p0) stepsChecked++;
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

  /* --- цель по шагам («уложись не дороже решения автора») --- */
  let leanChecked = 0;
  if (typeof g.leanAward === "function"){
    const p0 = problems.length;
    const CUR3 = w.CURRICULUM, C3 = w.CONTENT;
    /* нужен урок, где цену вообще показывают: без черепашки и без случайности */
    let target = null;
    for (const wd of CUR3){
      for (const l of wd.lessons){
        const body = (C3["world" + wd.n] || {})[l.id];
        if (!body || !body.task || !body.task.solution) continue;
        if (!g.stepsShown(body)) continue;
        target = { l, body }; break;
      }
      if (target) break;
    }
    if (!target) bad("[цель] не нашлось урока, где цену показывают");
    else {
      const { l, body } = target;
      /* четыре урока «в цель» уже есть — пятый должен принести бейдж */
      g.state.log = { f1:{ lean:1 }, f2:{ lean:1 }, f3:{ lean:1 }, f4:{ lean:1 } };
      g.state.badges = g.state.badges.filter(x => x !== "lean");
      g.setStars(l.id, 0);
      const xpBefore = g.state.xp;
      /* решение автора стоит ровно столько же, сколько решение автора, —
         значит цель обязана засчитаться */
      g.openLesson(l.id);
      await tick();
      let st = studioOf();
      st.editor.setCode(body.task.solution);
      st.querySelector('[data-role="check"]').click();
      await tick();
      if (!won()) bad("[цель] эталон не засчитан — " + msgText());
      else {
        const card = doc.getElementById("wincard").textContent;
        if (!/Цель выполнена/.test(card)) bad("[цель] в победной карточке нет отметки о цели");
        if (!g.state.log[l.id] || !g.state.log[l.id].lean)
          bad("[цель] попадание в цель не записано в журнал");
        /* опыт складывается из звёзд и надбавки за цель — обе части в одном месте */
        const wantXp = xpBefore + g.STAR_XP[3] + g.LEAN_XP;
        if (g.state.xp !== wantXp)
          bad(`[цель] опыт после цели: было ${xpBefore}, стало ${g.state.xp}, ждали ${wantXp}` +
              ` (${g.STAR_XP[3]} за три звезды и ${g.LEAN_XP} за цель)`);
        if (g.leanCount() !== 5) bad("[цель] уроков в цель посчитано " + g.leanCount() + ", а не 5");
        if (g.state.badges.indexOf("lean") < 0) bad("[цель] бейдж за пятый урок в цель не выдан");
        closeWin();

        /* второй раз тем же кодом — надбавка НЕ повторяется */
        const xpTwice = g.state.xp;
        g.openLesson(l.id);
        await tick();
        st = studioOf();
        st.editor.setCode(body.task.solution);
        st.querySelector('[data-role="check"]').click();
        await tick();
        if (won()) closeWin();
        if (g.state.xp !== xpTwice) bad("[цель] надбавка за цель начислена второй раз");
      }

      /* показанное решение цель не засчитывает: это код автора, а не ребёнка */
      delete g.state.log[l.id];
      g.setStars(l.id, 0);
      g.openLesson(l.id);
      await tick();
      doc.getElementById("solbtn").click();
      st = studioOf();
      st.querySelector('[data-role="check"]').click();
      await tick();
      if (!won()) bad("[цель] урок с показанным решением не засчитан");
      else {
        if (g.state.log[l.id] && g.state.log[l.id].lean)
          bad("[цель] цель засчитана за показанное решение");
        if (!/не считается/.test(doc.getElementById("wincard").textContent))
          bad("[цель] карточка не объяснила, почему цель не в счёт");
        closeWin();
      }
    }
    /* промах по цели зовёт вернуться, а не ругает */
    const miss = g.leanNote({ show:true, hit:false, shown:false }, 300, 100);
    if (!/Цель/.test(miss) || !/100/.test(miss)) bad("[цель] промах не назвал цель: " + miss);
    /* слияние: попадание в цель остаётся при обмене с другим устройством */
    const lm = g.mergeProgress({ log:{ x:{ lean:1 } }, savedAt:1 }, { log:{ x:{} }, savedAt:2 });
    if (!lm.log.x || lm.log.x.lean !== 1) bad("[цель] слияние потеряло попадание в цель");
    if (problems.length === p0) leanChecked++;
    viewReset(g);
  }

  /* --- разбор своей программы в визуализаторе --- */
  let ownVizChecked = 0;
  if (typeof g.screenViz === "function"){
    const p0 = problems.length;
    const CUR4 = w.CURRICULUM, C4 = w.CONTENT;
    let one = null, multi = null;
    for (const wd of CUR4){
      for (const l of wd.lessons){
        const body = (C4["world" + wd.n] || {})[l.id];
        if (!body || !body.task) continue;
        if (body.task.files){ if (!multi) multi = l; }
        else if (!one && !body.draw) one = l;
      }
    }
    if (!one) bad("[разбор] не нашлось обычного урока без файлов");
    else {
      g.openLesson(one.id);
      await tick();
      let st = studioOf();
      const vb = st.querySelector('[data-role="viz"]');
      if (!vb) bad("[разбор] на уроке нет кнопки «Разобрать»");
      else {
        const mineCode = 'nums = [1, 2]\nnums.append(3)\nprint(nums)\n';
        st.editor.setCode(mineCode);
        vb.click();
        await tick();
        if (!doc.querySelector(".vizslider"))
          bad("[разбор] разбор своего кода не запустился сам");
        const ta = doc.querySelector("#vizstudio textarea");
        if (!ta || ta.value !== mineCode)
          bad("[разбор] в визуализатор уехал не код урока");
        if (doc.querySelector(".vizplayer .msg.bad"))
          bad("[разбор] разбор своего кода упал с ошибкой");
        /* возврат на урок: код обязан вернуться — за это отвечают черновики */
        const back = doc.getElementById("vizback");
        if (!back) bad("[разбор] нет кнопки возврата на урок");
        else {
          back.click();
          await tick();
          st = studioOf();
          if (!st) bad("[разбор] возврат не открыл урок");
          else if (st.editor.getCode() !== mineCode)
            bad("[разбор] после возврата код урока потерялся: " + JSON.stringify(st.editor.getCode().slice(0, 40)));
        }
      }
    }
    if (multi){
      g.openLesson(multi.id);
      await tick();
      const st2 = studioOf();
      if (st2 && st2.querySelector('[data-role="viz"]'))
        bad("[разбор] кнопка «Разобрать» стоит на многофайловом уроке — подсветка строки уедет в чужой файл");
    }
    /* урок с ответами для input(): без них разбор упал бы там, где запуск работает */
    let withStdin = null;
    for (const wd of CUR4){
      for (const l of wd.lessons){
        const body = (C4["world" + wd.n] || {})[l.id];
        if (body && body.task && !body.task.files && body.task.stdin && body.task.stdin.length){
          withStdin = { l, body }; break;
        }
      }
      if (withStdin) break;
    }
    if (withStdin){
      const rec = g.vizRecord(withStdin.body.task.solution, { stdin: withStdin.body.task.stdin });
      if (rec.error) bad("[разбор] урок с input() разобрался с ошибкой: " + rec.error.msg);
      const bare = g.vizRecord(withStdin.body.task.solution, {});
      if (!bare.error) bad("[разбор] урок с input() разобрался БЕЗ ответов — проверка бессмысленна");
    }
    if (problems.length === p0) ownVizChecked++;
    viewReset(g);
  }

  /* --- свои задания: собрать, отдать ссылкой, решить чужое --- */
  let taskChecked = 0;
  if (typeof g.taskBuild === "function"){
    const p0 = problems.length;
    /* ссылка собирается и разбирается, а битую не принимаем */
    const sample = { title:"Считалка", goal:"Напечатай числа от 1 до 3, каждое с новой строки.",
                     lines:["1","2","3"], author:"Аня" };
    const packed = g.taskPack(sample);
    if (/[+/=]/.test(packed))
      bad("[задание] в ссылке остались символы, которые адрес понимает по-своему");
    const back = g.taskUnpack(packed);
    if (!back || back.title !== sample.title || back.author !== "Аня" ||
        back.lines.join("\n") !== sample.lines.join("\n"))
      bad("[задание] ссылка разобралась не в то же задание: " + JSON.stringify(back));
    if (g.taskUnpack("совсем не ссылка") !== null) bad("[задание] мусор принят за задание");
    if (g.taskUnpack(packed.slice(0, -6)) !== null)
      bad("[задание] обрезанная ссылка принята за целую");
    if (g.taskKey(sample) !== g.taskKey(back))
      bad("[задание] у одного и того же задания разные ключи");

    /* правила: без них задание у друга было бы непроходимым */
    const okGoal = "Напечатай числа от 1 до 3, каждое с новой строки.";
    if (!g.taskBuild("Тест", okGoal, "import random\nprint(random.randint(1, 6))\n").problem)
      bad("[задание] случайность пропущена в задание");
    if (!g.taskBuild("Тест", okGoal, "имя = input()\nprint(имя)\n").problem)
      bad("[задание] input() пропущен в задание");
    if (!g.taskBuild("Тест", okGoal, "x = 1\n").problem)
      bad("[задание] программа без печати пропущена");
    if (!g.taskBuild("Тест", "коротко", "print(1)\n").problem)
      bad("[задание] условие в одно слово пропущено");
    if (!g.taskBuild("", okGoal, "print(1)\n").problem)
      bad("[задание] задание без названия пропущено");
    if (!g.taskBuild("Тест", okGoal, "print(нет_такой)\n").error)
      bad("[задание] падающая программа пропущена");
    const built = g.taskBuild("Тест", okGoal, "for i in range(1, 4):\n    print(i)\n");
    if (!built.task || built.task.lines.join(",") !== "1,2,3")
      bad("[задание] правильный ответ посчитан неверно: " + JSON.stringify(built));

    /* экран автора: собрали задание — появилась ссылка и запись в списке */
    g.state.mytasks = {};
    g.state.friendTasks = {};
    g.state.badges = g.state.badges.filter(x => x !== "author" && x !== "guest");
    g.screenMyTasks();
    await tick();
    const ttl = doc.getElementById("tttl"), tgoal = doc.getElementById("tgoal");
    if (!ttl || !tgoal) bad("[задание] на экране автора нет полей названия и условия");
    else {
      ttl.value = "Считалка"; tgoal.value = okGoal;
      const st = doc.querySelector("#studio .studio") || doc.querySelector(".studio");
      st.editor.setCode("for i in range(1, 4):\n    print(i)\n");
      st.querySelector('[data-role="check"]').click();
      await tick();
      if (!doc.getElementById("tlink"))
        bad("[задание] ссылка после сборки не показалась: " + msgText());
      if (g.myTasksList().length !== 1)
        bad("[задание] задание не сохранилось: записей " + g.myTasksList().length);
      if (g.state.badges.indexOf("author") < 0) bad("[задание] бейдж автора не выдан");
      if (g.state.mytaskDraft) bad("[задание] после сборки остался черновик");
      const saved = g.myTasksList()[0];
      if (g.taskLink(saved).indexOf("#task=") < 0) bad("[задание] ссылка без метки #task=");

      /* Один заход «решаем задание»: если экрана нет, говорим об этом
         проблемой и идём дальше, а не падаем — сломанная фича должна
         попасть в отчёт, а не оборвать проверку. */
      const solveTask = async function(code){
        const sf = studioOf() || doc.querySelector(".studio");
        if (!sf || !sf.editor){ bad("[задание] экран задания не открылся"); return false; }
        sf.editor.setCode(code);
        const btn = sf.querySelector('[data-role="check"]');
        if (!btn){ bad("[задание] на экране задания нет кнопки проверки"); return false; }
        btn.click();
        await tick();
        return true;
      };

      /* своё задание глазами друга: проверка работает, опыт не начисляется */
      const xpOwn = g.state.xp;
      g.openFriendTask(saved, { own:true });
      await tick();
      if (await solveTask("print(1)\nprint(2)\nprint(9)\n")){
        if (won()) bad("[задание] неверный ответ засчитан");
        if (!/должно быть|получилось|строк/.test(msgText()))
          bad("[задание] расхождение не объяснено: " + msgText());
        if (await solveTask("print(1)\nprint(2)\nprint(3)\n")){
          if (!won()) bad("[задание] верный ответ не засчитан: " + msgText());
          else closeWin();
        }
      }
      if (g.state.xp !== xpOwn) bad("[задание] за своё же задание начислен опыт");

      /* чужое задание: приезжает ссылкой, даёт опыт — но только один раз */
      const xp0 = g.state.xp;
      w.location.hash = "#task=" + packed;
      await tick(); await tick();
      if (!/Считалка/.test(doc.getElementById("app").textContent))
        bad("[задание] ссылка не открыла задание");
      if (await solveTask("print(1)\nprint(2)\nprint(3)\n")){
        if (!won()) bad("[задание] чужое задание не засчитано: " + msgText());
        else closeWin();
        if (g.state.xp !== xp0 + g.FRIEND_XP)
          bad(`[задание] опыт за чужое задание: было ${xp0}, стало ${g.state.xp}`);
        if (g.state.badges.indexOf("guest") < 0) bad("[задание] бейдж «Гость» не выдан");
      }
      const xp1 = g.state.xp;
      g.openFriendTask(back, {});
      await tick();
      if (await solveTask("print(1)\nprint(2)\nprint(3)\n")){
        if (won()) closeWin();
        if (g.state.xp !== xp1) bad("[задание] опыт за то же задание начислен второй раз");
      }

      /* испорченная ссылка объясняется, а не уводит молча на карту миров */
      w.location.hash = "#task=" + "%%%";
      await tick(); await tick();
      if (!/не прочиталось|обрезали/.test(doc.getElementById("app").textContent))
        bad("[задание] битая ссылка не объяснилась");
      try { w.history.replaceState(null, "", "/kodokvest/"); } catch(e){}
    }

    /* Кавычка в названии не должна ломать форму: значения полей ставятся из
       JS, потому что esc() экранирует только &, < и >. */
    g.state.mytasks = {};
    g.myTaskSave({ title: 'Задача "про кавычки"', goal: okGoal, code: "print(1)\n", lines:["1"] });
    g.screenMyTasks({ title: 'Задача "про кавычки"', goal: okGoal, code: "print(1)\n" });
    await tick();
    const qttl = doc.getElementById("tttl");
    if (!qttl || qttl.value !== 'Задача "про кавычки"')
      bad("[задание] кавычка в названии сломала форму: " + (qttl && JSON.stringify(qttl.value)));
    if (!/про кавычки/.test(doc.getElementById("app").textContent))
      bad("[задание] задание с кавычкой не показалось в списке");

    /* слияние: задания и пройденное чужое не теряются при обмене устройств */
    const tm = g.mergeProgress(
      { mytasks:{ a:{ title:"A", lines:["1"] } }, friendTasks:{ k1:1 }, savedAt:1 },
      { mytasks:{ b:{ title:"B", lines:["2"] } }, friendTasks:{ k2:1 }, savedAt:2 });
    if (!tm.mytasks.a || !tm.mytasks.b) bad("[задание] слияние потеряло задание одного из устройств");
    if (!tm.friendTasks.k1 || !tm.friendTasks.k2) bad("[задание] слияние потеряло пройденное чужое задание");
    /* сброс прогресса в панели наставника не стирает сделанное ребёнком */
    const kept = g.clearResults({ mytasks:{ a:{ title:"A", lines:["1"] } }, stars:{ x:3 } });
    if (!kept.mytasks || !kept.mytasks.a) bad("[задание] сброс прогресса стёр свои задания");
    if (Object.keys(kept.stars).length) bad("[задание] сброс прогресса не стёр звёзды");
    /* смена ученика — стирает: на устройстве другой ребёнок */
    const wiped = g.clearAll({ mytasks:{ a:{ title:"A", lines:["1"] } } });
    if (Object.keys(wiped.mytasks || {}).length) bad("[задание] смена ученика оставила чужие задания");
    if (problems.length === p0) taskChecked++;
    viewReset(g);
  }

  /* --- значения прямо в редакторе --- */
  let watchChecked = 0;
  if (typeof g.watchCompute === "function"){
    const p0 = problems.length;
    const eng = w.Runtime.get("mini");

    /* Приписки обязаны совпадать с настоящим прогоном: считаются они вторым
       проходом, и если ГПСЧ движка когда-нибудь перестанет быть
       детерминированным, приписки разойдутся с выводом — вот эта проверка. */
    const rnd = "import random\nx = random.randint(1, 100)\nprint(x)\n";
    const r1 = eng.run(rnd, {});
    const wm = g.watchCompute(eng, rnd, {}, r1.steps);
    if (!wm || !wm[2]) bad("[приписки] у строки со случайным числом нет приписки");
    else if (wm[2].indexOf(String(r1.lines[0])) < 0)
      bad(`[приписки] приписка «${wm[2]}» разошлась с выводом «${r1.lines[0]}» — второй проход даёт другие числа`);

    /* цикл: последнее значение плюс число проходов */
    const loop = 'итог = 0\nfor i in range(1, 4):\n    итог = итог + i\n\nprint("сумма", итог)\n';
    const wl = g.watchCompute(eng, loop, {}, eng.run(loop, {}).steps);
    if (!wl) bad("[приписки] цикл не получил приписок");
    else {
      if (wl[1] !== "итог = 0") bad("[приписки] первая строка: " + wl[1]);
      if (!/^×3\s+итог = 6$/.test(wl[3] || ""))
        bad("[приписки] тело цикла должно быть «×3 итог = 6», а не «" + wl[3] + "»");
      if ((wl[5] || "").indexOf("→ сумма 6") < 0)
        bad("[приписки] строка с print не показала напечатанное: " + wl[5]);
      if (wl[4]) bad("[приписки] пустая строка получила приписку: " + wl[4]);
    }

    /* ответы для input() уезжают в приписки: иначе программа падала бы */
    const ask = 'имя = input()\nprint("привет,", имя)\n';
    const wa = g.watchCompute(eng, ask, { stdin:["Аня"] }, 0);
    if (!wa || (wa[1] || "").indexOf("Аня") < 0)
      bad("[приписки] программа с input() не разобралась с ответами: " + JSON.stringify(wa));

    /* тройные кавычки: приписок нет вовсе, иначе многострочная строка
       распалась бы в подсветке на куски */
    const tri = 's = "' + '""первая\nвторая"' + '""\nprint(len(s))\n';
    if (g.watchCompute(eng, tri, {}, 0) !== null)
      bad("[приписки] код с тройными кавычками получил приписки");

    /* дорогая программа приписок не получает: цену уже назвал первый прогон */
    if (g.watchCompute(eng, "print(1)\n", {}, g.WATCH_MAX_STEPS + 1) !== null)
      bad("[приписки] дорогая программа всё равно считалась");

    /* длинное значение обрезается, пробелы сворачиваются */
    if (g.watchCut("а".repeat(80)).length > 30) bad("[приписки] длинное значение не обрезано");
    if (g.watchCut(" два\n\nслова ") !== "два слова") bad("[приписки] пробелы не свёрнуты: " + JSON.stringify(g.watchCut(" два\n\nслова ")));
    /* молчим, когда сказать нечего */
    if (g.watchNote({ x:"1" }, { x:"1" }, "") !== "")
      bad("[приписки] приписка появилась там, где ничего не изменилось");

    /* разметка: приписка не ставится, когда не влезает в ширину редактора */
    const wide = g.hlWatched("x = 1", { 1:"x = 1" }, 40);
    const tight = g.hlWatched("x = 1", { 1:"x = 1" }, 8);
    if (wide.indexOf("wv") < 0) bad("[приписки] приписка не отрисовалась при широком редакторе");
    if (tight.indexOf("wv") >= 0)
      bad("[приписки] приписка отрисована в узком редакторе — подсветка съедет с курсором");

    /* живой урок: приписки появляются после запуска и исчезают от правки */
    g.openLesson("print-first");
    await tick();
    const st = studioOf();
    if (!st) bad("[приписки] урок не открылся");
    else {
      st.editor.setCode(loop);
      st.querySelector('[data-role="run"]').click();
      await tick();
      const shown = st.querySelectorAll("pre.hl .wv").length;
      if (!shown) bad("[приписки] после запуска приписок в разметке нет");
      const ta = st.querySelector("textarea");
      ta.value = ta.value + "\n";
      ta.dispatchEvent(new w.Event("input", { bubbles:true }));
      if (st.querySelectorAll("pre.hl .wv").length)
        bad("[приписки] правка не стёрла приписки — они начали врать про изменённый код");
      /* пошаговый режим показывает переменные сам, приписки там лишние */
      st.editor.setCode(loop);
      st.querySelector('[data-role="run"]').click();
      await tick();
      st.querySelector('[data-role="step"]').click();
      await tick();
      if (st.querySelectorAll("pre.hl .wv").length)
        bad("[приписки] приписки остались в пошаговом режиме");
    }
    if (problems.length === p0) watchChecked++;
    viewReset(g);
  }

  /* --- бестиарий ошибок --- */
  let beastChecked = 0;
  if (typeof g.beastsHTML === "function"){
    const p0 = problems.length;
    /* содержание: у каждого зверя есть название в KIND_RU и обе строки текста */
    g.ERR_BEASTS.forEach(b => {
      if (!g.KIND_RU[b.kind]) bad(`[бестиарий] у типа ${b.kind} нет русского названия в KIND_RU`);
      if (!b.em || !b.what || !b.how) bad(`[бестиарий] у ${b.kind} не заполнены поля`);
      if (!/\.$/.test(b.what) || !/\.$/.test(b.how)) bad(`[бестиарий] у ${b.kind} текст без точки`);
    });
    const kinds = g.ERR_BEASTS.map(b => b.kind);
    if (new Set(kinds).size !== kinds.length) bad("[бестиарий] тип встречается дважды");
    if (kinds.indexOf("NotSupported") >= 0)
      bad("[бестиарий] NotSupported — ограничение тренажёра, а не ошибка ребёнка");
    g.state.errs = {};
    g.state.badges = g.state.badges.filter(x => x !== "beasts");

    /* живой путь: сломал → зверь встретился; починил сам → побеждён */
    g.openLesson("print-first");
    await tick();
    let st = studioOf();
    st.editor.setCode("print(нет_такого)\n");
    st.querySelector('[data-role="run"]').click();
    await tick();
    if (!(g.state.errs.NameError && g.state.errs.NameError.seen))
      bad("[бестиарий] встреча с ошибкой не записана: " + JSON.stringify(g.state.errs));
    if (g.state.errs.NameError && g.state.errs.NameError.beaten)
      bad("[бестиарий] зверь побеждён до починки");
    st.editor.setCode('print("ок")\n');
    st.querySelector('[data-role="run"]').click();
    await tick();
    if (!(g.state.errs.NameError && g.state.errs.NameError.beaten))
      bad("[бестиарий] починка не записана как победа");
    if (g.beastsBeaten() !== 1) bad("[бестиарий] побеждённых посчитано " + g.beastsBeaten());

    /* показанное решение победу не даёт: чинил не ребёнок */
    g.state.errs = {};
    g.openLesson("print-first");
    await tick();
    st = studioOf();
    st.editor.setCode("print(опять_нет)\n");
    st.querySelector('[data-role="run"]').click();
    await tick();
    doc.getElementById("solbtn").click();
    st.querySelector('[data-role="run"]').click();
    await tick();
    if (g.state.errs.NameError && g.state.errs.NameError.beaten)
      bad("[бестиарий] победа засчитана после «показать решение»");

    /* бейдж за шесть разных */
    g.state.errs = {};
    g.state.badges = g.state.badges.filter(x => x !== "beasts");
    g.ERR_BEASTS.slice(0, g.BEAST_BADGE_AT - 1).forEach(b => {
      g.errSeen(b.kind); g.errBeaten(b.kind);
    });
    if (g.state.badges.indexOf("beasts") >= 0)
      bad("[бестиарий] бейдж выдан раньше порога");
    const last = g.ERR_BEASTS[g.BEAST_BADGE_AT - 1];
    g.errSeen(last.kind); g.errBeaten(last.kind);
    if (g.state.badges.indexOf("beasts") < 0) bad("[бестиарий] бейдж на пороге не выдан");
    if (g.state.badges.filter(x => x === "beasts").length !== 1)
      bad("[бестиарий] бейдж выдан дважды");
    if (!g.BADGES.filter(x => x.id === "beasts").length)
      bad("[бестиарий] бейджа «beasts» нет в списке достижений — он не покажется на карте");

    /* экран «Повторить» показывает всех зверей и отмечает состояния */
    g.state.errs = { NameError:{ seen:3, beaten:1, at:1 }, TypeError:{ seen:1, beaten:0, at:1 } };
    g.screenReview();
    await tick();
    const cards = doc.querySelectorAll(".beast");
    if (cards.length !== g.ERR_BEASTS.length)
      bad(`[бестиарий] на экране ${cards.length} карточек вместо ${g.ERR_BEASTS.length}`);
    if (doc.querySelectorAll(".beast.won").length !== 1)
      bad("[бестиарий] побеждённый зверь не отмечен");
    if (doc.querySelectorAll(".beast.met").length !== 1)
      bad("[бестиарий] встреченный зверь не отмечен");
    if (!/встреч: 3/.test(doc.getElementById("app").textContent))
      bad("[бестиарий] число встреч не показано");

    /* слияние: встречи берутся по максимуму, а не складываются */
    const bm = g.mergeProgress(
      { errs:{ NameError:{ seen:3, beaten:0, at:1 } }, savedAt:1 },
      { errs:{ NameError:{ seen:2, beaten:1, at:2 }, KeyError:{ seen:1, beaten:0, at:2 } }, savedAt:2 });
    if (!bm.errs.NameError || bm.errs.NameError.seen !== 3)
      bad("[бестиарий] слияние сложило встречи вместо максимума: " + JSON.stringify(bm.errs.NameError));
    if (!bm.errs.NameError.beaten) bad("[бестиарий] слияние потеряло победу");
    if (!bm.errs.KeyError) bad("[бестиарий] слияние потеряло зверя с другого устройства");
    if (problems.length === p0) beastChecked++;
    viewReset(g);
  }

  /* --- разбор кода: что можно сделать чище --- */
  let lintChecked = 0;
  if (typeof g.lintCode === "function"){
    const p0 = problems.length;
    const all = { all:true };
    const titles = (code, opts) => (g.lintCode(code, opts || all) || []).map(f => f.title).join(" | ");

    /* Каждое правило обязано срабатывать на своей же грязи. Правило, которое
       молчит всегда, выглядит работающим и не делает ничего. */
    const DIRTY = [
      ["sum", 'nums = [1, 2, 3]\nитог = 0\nfor n in nums:\n    итог = итог + n\nprint(итог)\n', /sum\(\)/],
      ["len", 'nums = [1, 2, 3]\nсколько = 0\nfor n in nums:\n    сколько += 1\nprint(сколько)\n', /сколько элементов/],
      ["range(len)", 'nums = [1, 2, 3]\nfor i in range(len(nums)):\n    print(nums[i])\n', /Номер здесь не нужен/],
      ["лишняя переменная", 'нужное = 5\nлишнее = 10\nprint(нужное)\n', /лишнее никому не нужна/],
      ["== True", 'готово = True\nif готово == True:\n    print("да")\n', /Сравнение с True/],
      ["len() > 0", 'nums = [1]\nif len(nums) > 0:\n    print("есть")\n', /Длину с нулём/],
      ["три строки", 'print("одна и та же строка")\nprint("одна и та же строка")\nprint("одна и та же строка")\n', /Одна и та же строка/],
      ["магическое число", 'a = 60 * 2\nb = 60 * 3\nc = 60 * 4\nprint(a, b, c)\n', /Число 60/],
      ["x = x + 1", 'счёт = 0\nсчёт = счёт + 1\nprint(счёт)\n', /счёт \+=/],
      ["camelCase", 'myScore = 5\nprint(myScore)\n', /myScore/],
      ["длинная функция", 'def всё():\n' + Array.from({length:17}, (_, i) => `    print(${i})`).join("\n") + '\n\n\nвсё()\n', /делает слишком много/]
    ];
    DIRTY.forEach(([name, code, want]) => {
      const t = titles(code);
      if (!want.test(t)) bad(`[ревью] правило «${name}» молчит на своей же грязи: ${t || "(тишина)"}`);
    });

    /* А это НЕ находки. Каждая строка — случай, на котором правило когда-то
       ошибалось (все найдены инструментом tests/lint-check.js на решениях
       автора) или ошиблось бы по неосторожности. Третий элемент — что именно
       запрещено находить: там, где он есть, ДРУГИЕ находки законны (например
       три одинаковые строки у черепашки — это честный совет «сделай цикл»). */
    const CLEAN = [
      ["имя только в f-строке", 'имя = "Аня"\nprint(f"привет, {имя}")\n'],
      ["имя в формате f-строки", 'ширина = 10\nполоска = "###"\nprint(f"{полоска:<{ширина}}|")\n'],
      ["поле класса читается через self", 'class Пёс:\n    hp = 10\n\n    def бей(self, урон):\n        self.hp = self.hp - урон\n        return self.hp\n\n\nп = Пёс()\nprint(п.бей(3))\n'],
      ["числа внутри списка данных", 'оценки = [5, 3, 4, 5, 2, 5]\nprint(sum(оценки))\n'],
      ["мелкие числа", 'for i in range(3):\n    print(i * 3, 3 + i)\n'],
      ["сравнение с True в assert", 'def годен(x):\n    return x > 0\n\n\nassert годен(5) == True\nassert годен(-1) == False\nprint("ок")\n'],
      ["длина сравнивается не с нулём", 'nums = [1, 2]\nif len(nums) > 1:\n    print("много")\n'],
      [">= 0 не трогаем", 'nums = [1]\nif len(nums) >= 0:\n    print("всегда")\n'],
      ["распаковка без всех имён", 'def пара():\n    return 1, 2, 3\n\n\nа, б, в = пара()\nprint(а)\n'],
      ["номер нужен не только для среза", 'nums = [1, 2]\nfor i in range(len(nums)):\n    print(i + 1, nums[i])\n'],
      ["черепашьи числа", 'color("red")\nforward(120)\nright(90)\nforward(60)\nright(90)\nforward(120)\nright(90)\nforward(60)\n'],
      ["цикл с условием — это не sum()", 'nums = [1, 2, 3]\nитог = 0\nfor n in nums:\n    if n > 1:\n        итог = итог + n\nprint(итог)\n', /sum\(\)|сколько элементов/]
    ];
    CLEAN.forEach(([name, code, forbidden]) => {
      const found = g.lintCode(code, all);
      if (found === null){ bad(`[ревью] «${name}» не разобралось парсером`); return; }
      if (forbidden){
        if (forbidden.test(titles(code))) bad(`[ревью] ложная находка на «${name}»: ${titles(code)}`);
      } else if (found.length) bad(`[ревью] ложная находка на «${name}»: ${titles(code)}`);
    });

    /* Совет не имеет права спорить с требованием урока. */
    const loop = 'nums = [1, 2, 3]\nитог = 0\nfor n in nums:\n    итог = итог + n\nprint(итог)\n';
    if (!/sum\(\)/.test(titles(loop, { all:true })))
      bad("[ревью] совет про sum() пропал без требований");
    if (/sum\(\)/.test(titles(loop, { all:true, needCode:["for"] })))
      bad("[ревью] совет «возьми sum()» показан на уроке, который ТРЕБУЕТ цикл");

    /* Совет не имеет права появиться раньше урока, где это объясняли. */
    g.state.stars = {};
    if (g.lintKnows("lists-first")) bad("[ревью] совет открыт до прохождения урока");
    const early = g.lintCode(loop, {});
    if (early.some(f => /sum\(\)/.test(f.title)))
      bad("[ревью] sum() советуется до урока про списки");
    g.setStars("lists-first", 3);
    if (!g.lintKnows("lists-first")) bad("[ревью] совет закрыт после пройденного урока");
    /* у каждого совета урок-гейт обязан существовать в программе */
    const gates = {};
    [loop, ...DIRTY.map(d => d[1])].forEach(code => {
      (g.lintCode(code, all) || []).forEach(f => { if (f.after) gates[f.after] = 1; });
    });
    Object.keys(gates).forEach(id => {
      if (!w.CURRICULUM.byId(id)) bad(`[ревью] правило ссылается на несуществующий урок «${id}»`);
    });

    /* Не больше трёх советов за раз: четвёртый — уже придирки. Считаем как
       для ребёнка (без all), сняв замки по прогрессу — иначе часть советов
       отсеется гейтом, и проверка ничего не проверит. */
    g.state.admin.unlockAll = true;
    const messy = 'aB = 100\ncD = 100\nлишнее = 100\nx = 0\nx = x + 1\nprint("одна и та же строка тут")\nprint("одна и та же строка тут")\nprint("одна и та же строка тут")\nprint(aB, cD, x)\n';
    const many = g.lintCode(messy, {});
    if (many.length < 2) bad("[ревью] на нарочно грязной программе нашлось меньше двух советов");
    if (many.length > g.LINT_MAX) bad(`[ревью] советов ${many.length}, а больше ${g.LINT_MAX} показывать нельзя`);

    /* Сломанный код разбору не подлежит: сначала пусть заработает. */
    if (g.lintCode("print(", all) !== null) bad("[ревью] неразбираемый код не отклонён");
    if (!/Сначала пусть заработает/.test(g.lintHTML(null))) bad("[ревью] нет сообщения про сломанный код");
    if (!/Чисто/.test(g.lintHTML([]))) bad("[ревью] нет сообщения «чисто»");

    /* Живой урок: кнопка есть, показывает разбор и не отнимает звёзд. */
    g.state.admin.unlockAll = true;
    g.openLesson("for-range");
    await tick();
    const st = studioOf();
    const btn = doc.getElementById("lintbtn");
    if (!btn) bad("[ревью] на уроке нет кнопки разбора");
    else {
      st.editor.setCode('счёт = 0\nсчёт = счёт + 1\nprint(счёт)\n');
      btn.click();
      await tick();
      const m = doc.querySelector("#studio .msg");
      if (!/можно чище/.test(m.textContent)) bad("[ревью] разбор ничего не показал: " + msgText());
      if (!doc.querySelector("#studio .lintone")) bad("[ревью] находки не отрисовались списком");
      st.editor.setCode("print(1)\n");
      btn.click();
      await tick();
      if (!/Чисто/.test(doc.querySelector("#studio .msg").textContent))
        bad("[ревью] на чистой программе разбор не сказал «чисто»");
    }
    /* многофайловый урок разбора не получает: имена живут в других файлах */
    let multi = null;
    for (const wd of w.CURRICULUM){
      const c = w.CONTENT["world" + wd.n];
      if (!c) continue;
      for (const l of wd.lessons) if (c[l.id] && c[l.id].task && c[l.id].task.files){ multi = l; break; }
      if (multi) break;
    }
    if (multi){
      g.openLesson(multi.id);
      await tick();
      if (doc.getElementById("lintbtn"))
        bad("[ревью] кнопка разбора стоит на многофайловом уроке — переменная из другого файла выглядит лишней");
    }
    /* приглашение в победной карточке — только когда находки есть */
    if (g.lintNote(0) !== "") bad("[ревью] приглашение показано при нуле находок");
    if (!/замечания|замечание|замечаний/.test(g.lintNote(2))) bad("[ревью] приглашение не назвало число находок");
    if (problems.length === p0) lintChecked++;
    viewReset(g);
  }

  /* --- панель символов на телефоне --- */
  let keybarChecked = 0;
  if (Array.isArray(g.KEYBAR_KEYS)){
    const p0 = problems.length;
    g.openLesson("print-first");
    await tick();
    const st = studioOf();
    const keys = st.querySelectorAll(".kbk");
    if (!keys.length) bad("[символы] панели символов нет в редакторе");
    else if (keys.length !== g.KEYBAR_KEYS.length + 1)
      bad(`[символы] кнопок ${keys.length}, а ключей ${g.KEYBAR_KEYS.length} плюс отступ`);
    const ta = st.querySelector("textarea");
    /* вставка идёт в позицию курсора, а не в конец программы */
    st.editor.setCode("print()\n");
    ta.selectionStart = ta.selectionEnd = 6;          /* между скобками */
    /* в атрибуте лежит НОМЕР ключа: среди знаков есть кавычка, и писать её
       в разметку значило бы порвать атрибут */
    const quotes = [...keys].filter(b => g.KEYBAR_KEYS[+b.getAttribute("data-k")] === '""')[0];
    if (!quotes) bad("[символы] нет кнопки с парой кавычек");
    else quotes.click();
    if (ta.value.indexOf('print("")') !== 0)
      bad("[символы] пара кавычек вставилась не туда: " + JSON.stringify(ta.value));
    if (ta.selectionStart !== 7)
      bad("[символы] курсор не встал ВНУТРЬ пары: " + ta.selectionStart);
    /* отступ — четыре пробела, а не табуляция: так пишет весь курс */
    st.editor.setCode("");
    ta.selectionStart = ta.selectionEnd = 0;
    [...keys].filter(b => b.getAttribute("data-k") === "tab")[0].click();
    if (ta.value !== "    ") bad("[символы] отступ вставил не четыре пробела: " + JSON.stringify(ta.value));
    /* правка с панели считается правкой: черновик обязан сохраниться */
    if (st.editor.getCode() !== "    ") bad("[символы] редактор не увидел вставку");
    if (problems.length === p0) keybarChecked++;
    viewReset(g);
  }

  /* --- забрать программу файлом (.py) --- */
  let pyChecked = 0;
  if (typeof g.pyFileText === "function"){
    const p0 = problems.length;
    if (g.pyFileName("Дракон в пещере") !== "drakon_v_peschere.py")
      bad("[файл] имя файла не транслитерировано: " + g.pyFileName("Дракон в пещере"));
    if (!/\.py$/.test(g.pyFileName(""))) bad("[файл] пустое имя дало файл без .py");
    const plain = g.pyFileText("Счёт", 'print("привет")\n');
    if (plain.indexOf('print("привет")') < 0) bad("[файл] программа потерялась");
    if (plain.indexOf("python3") < 0) bad("[файл] нет подсказки, как запустить");
    if (/turtle/.test(plain)) bad("[файл] обычной программе дописали черепашку");
    const draw = g.pyFileText("Квадрат", 'forward(100)\nright(90)\n');
    /* Ищем именно СТРОКУ КОДА, а не упоминание: в шапке файла есть и
       объясняющий комментарий про from turtle import *, и на нём проверка
       успокаивалась бы, даже если самой строки нет (поймано мутацией). */
    const drawLines = draw.split("\n").map(x => x.trim());
    if (drawLines.indexOf("from turtle import *") < 0)
      bad("[файл] рисующей программе не дописан import черепашки — у себя она не запустится");
    if (drawLines.indexOf("done()") < 0) bad("[файл] нет done() — окно закроется сразу");
    if (draw.indexOf("добавил тренажёр") < 0)
      bad("[файл] тренажёр дописал строки и не сказал об этом");
    /* «forward» в комментарии или в строке ничего не рисует */
    if (g.pyIsDraw('print("forward(100)")\n# forward(50)\n'))
      bad("[файл] слово forward в строке принято за рисование");
    if (!g.pyIsDraw('circle(30)\n')) bad("[файл] circle не опознан как рисование");
    if (problems.length === p0) pyChecked++;
    viewReset(g);
  }

  /* --- вопрос за ужином --- */
  let dinnerChecked = 0;
  if (typeof g.dinnerPickFrom === "function"){
    const p0 = problems.length;
    const empty = g.dinnerPickFrom({ stars:{}, log:{} }, "2026-01-01");
    if (empty) bad("[ужин] вопрос нашёлся на пустом прогрессе");
    if (!/Появится/.test(g.dinnerHTML({ stars:{}, log:{} })))
      bad("[ужин] на пустом прогрессе нет объяснения, откуда возьмётся вопрос");
    /* спрашиваем только про пройденное */
    const st1 = { stars:{ "print-first":3 }, log:{ "print-first":{ solvedAt: 1000 } } };
    const pick = g.dinnerPickFrom(st1, "2026-01-01");
    if (!pick) bad("[ужин] вопрос не нашёлся на пройденном уроке");
    else if (pick.lesson !== "print-first")
      bad("[ужин] вопрос про непройденный урок: " + pick.lesson);
    /* за один вечер вопрос не меняется */
    const a = g.dinnerPickFrom(st1, "2026-05-05"), b = g.dinnerPickFrom(st1, "2026-05-05");
    if (!a || !b || a.it.id !== b.it.id) bad("[ужин] вопрос меняется в пределах одного дня");
    /* а по дням — меняется хотя бы иногда */
    const many = { stars:{}, log:{} };
    (w.CHEATSHEET || []).forEach(gr => (gr.items || []).forEach(it => {
      many.stars[it.lesson] = 3;
      many.log[it.lesson] = { solvedAt: 1000 + it.lesson.length };
    }));
    const seen = {};
    for (let i = 1; i <= 12; i++){
      const x = g.dinnerPickFrom(many, "2026-03-" + (i < 10 ? "0" + i : i));
      if (x) seen[x.it.id] = 1;
    }
    if (Object.keys(seen).length < 2)
      bad("[ужин] вопрос одинаковый во все дни — выбор не зависит от даты");
    /* в отчёте наставника вопрос виден */
    if (!/Вопрос за ужином/.test(g.weekReportHTML(st1)))
      bad("[ужин] вопроса нет в недельном отчёте");
    if (problems.length === p0) dinnerChecked++;
  }

  /* --- пересказ программы словами --- */
  let storyChecked = 0;
  if (typeof g.storyOf === "function"){
    const p0 = problems.length;
    const text = (code, env) => (g.storyOf(code, env || {}) || { lines:[] })
      .lines.map(x => x.text).join(" ⏎ ");

    const loop = 'оценки = [5, 4, 3]\nитог = 0\nfor n in оценки:\n    итог = итог + n\nprint("сумма", итог)\n';
    const t1 = text(loop);
    if (!/повторил 3 раза/.test(t1)) bad("[пересказ] число проходов цикла не названо: " + t1);
    if (!/итог = 12/.test(t1)) bad("[пересказ] итог не назван: " + t1);
    if (!/напечатал: сумма 12/.test(t1)) bad("[пересказ] напечатанное не названо: " + t1);

    const fn = 'def площадь(ш, в):\n    return ш * в\n\n\nprint(площадь(3, 4))\n';
    const t2 = text(fn);
    if (!/описал команду «площадь\(ш, в\)»/.test(t2)) bad("[пересказ] функция не описана: " + t2);
    if (!/вызвали 1 раз/.test(t2)) bad("[пересказ] число вызовов не названо: " + t2);
    if (/пустую строку/.test(t2))
      bad("[пересказ] печать результата вызова названа печатью пустой строки: " + t2);

    const cond = 'for n in range(4):\n    if n % 2 == 0:\n        print(n)\n';
    const t3 = text(cond);
    if (!/сработало 2/.test(t3)) bad("[пересказ] ветки условия не посчитаны: " + t3);

    const boom = 'n = 1\nprint(10 / 0)\n';
    const t4 = text(boom);
    if (!/остановилась с ошибкой/.test(t4)) bad("[пересказ] падение не названо: " + t4);
    const st4 = g.storyOf(boom, {});
    if (!st4.error) bad("[пересказ] ошибка не отдана наружу");

    const ask = 'имя = input()\nprint("привет,", имя)\n';
    if (!/Аня/.test(text(ask, { stdin:["Аня"] })))
      bad("[пересказ] ответ на input() не попал в пересказ");

    /* Пересказ — это про СДЕЛАННОЕ, и он обязан честно про это сказать */
    const html = g.storyHTML(loop, {});
    if (!/сделала/.test(html)) bad("[пересказ] нет оговорки «сделала, а не задумано»");
    if (g.storyOf("print(", {}) !== null) bad("[пересказ] неразбираемый код не отклонён");
    /* и виден в визуализаторе — там же, где шаги */
    g.screenViz({ code: loop });
    await tick();
    if (!doc.querySelector(".story")) bad("[пересказ] в визуализаторе пересказа нет");
    if (!doc.querySelector(".vizslider")) bad("[пересказ] пересказ вытеснил шаги");
    if (problems.length === p0) storyChecked++;
    viewReset(g);
  }

  /* --- галерея рисунков --- */
  let galleryChecked = 0;
  if (typeof g.gallerySave === "function"){
    const p0 = problems.length;
    g.state.gallery = {};
    /* название берётся из первого комментария — это ещё и повод их писать */
    if (g.galleryTitleOf("# Домик\nforward(50)\n", 1) !== "Домик")
      bad("[галерея] название не взято из комментария");
    if (g.galleryTitleOf("forward(50)\n", 3) !== "Рисунок 3")
      bad("[галерея] нет запасного названия");
    /* рисунок есть, рисунка нет, программа падает — три разных ответа */
    const drawn = g.galleryDrawing('forward(100)\nright(90)\nforward(100)\n');
    if (!drawn || !drawn.turtle) bad("[галерея] рисунок не опознан");
    if (!(g.galleryDrawing('print("привет")\n') || {}).empty)
      bad("[галерея] программа без линий принята за рисунок");
    if (!(g.galleryDrawing("forward(нет_числа)\n") || {}).error)
      bad("[галерея] падающая программа принята за рисунок");
    /* хранится программа, а не картинка: в прогрессе только код */
    const id = g.gallerySave('# Квадрат\nfor i in range(4):\n    forward(80)\n    right(90)\n');
    const list = g.galleryList();
    if (list.length !== 1) bad("[галерея] рисунок не сохранился");
    else {
      if (list[0].title !== "Квадрат") bad("[галерея] название не сохранилось: " + list[0].title);
      if (/data:image/.test(JSON.stringify(g.state.gallery)))
        bad("[галерея] в прогрессе оказалась картинка — он уезжает на сервер целиком");
    }
    /* больше GALLERY_MAX не копим: прогресс уходит на сервер одним запросом */
    for (let i = 0; i < g.GALLERY_MAX + 3; i++) g.gallerySave("forward(" + (10 + i) + ")\n");
    if (g.galleryList().length > g.GALLERY_MAX)
      bad(`[галерея] рисунков ${g.galleryList().length}, а держим не больше ${g.GALLERY_MAX}`);
    /* портфолио рисует холст на каждый рисунок и даёт скачать PNG */
    g.state.gallery = {};
    g.gallerySave("# Один\nforward(60)\nright(120)\nforward(60)\n");
    g.screenFolio();
    await tick();
    if (doc.querySelectorAll(".pic").length !== 1) bad("[галерея] в портфолио нет карточки рисунка");
    if (!doc.querySelector(".pic canvas")) bad("[галерея] холст рисунка не создан");
    if (!doc.querySelector("[data-png]")) bad("[галерея] нет кнопки «скачать PNG»");
    if (doc.querySelector(".pic.broken")) bad("[галерея] рисунок не нарисовался");
    /* слияние и сброс: рисунок — работа ребёнка, а не результат занятий */
    const gm = g.mergeProgress(
      { gallery:{ a:{ code:"forward(1)", at:1 } }, savedAt:1 },
      { gallery:{ b:{ code:"forward(2)", at:2 } }, savedAt:2 });
    if (!gm.gallery.a || !gm.gallery.b) bad("[галерея] слияние потеряло рисунок одного из устройств");
    const kept = g.clearResults({ gallery:{ a:{ code:"forward(1)" } }, stars:{ x:3 } });
    if (!kept.gallery.a) bad("[галерея] сброс прогресса стёр рисунки");
    const wiped = g.clearAll({ gallery:{ a:{ code:"forward(1)" } } });
    if (Object.keys(wiped.gallery || {}).length) bad("[галерея] смена ученика оставила чужие рисунки");
    if (problems.length === p0) galleryChecked++;
    viewReset(g);
  }

  /* --- установка на домашний экран (манифест и service worker) --- */
  let pwaChecked = 0;
  {
    const p0 = problems.length;
    const readRoot = f => fs.readFileSync(path.join(root, f), "utf8");
    let man = null;
    try { man = JSON.parse(readRoot("manifest.webmanifest")); }
    catch(e){ bad("[PWA] manifest.webmanifest не читается: " + e.message); }
    if (man){
      ["name", "short_name", "start_url", "scope", "display", "icons"].forEach(k => {
        if (!man[k]) bad(`[PWA] в манифесте нет поля ${k}`);
      });
      if (man.display !== "standalone") bad("[PWA] display не standalone: " + man.display);
      (man.icons || []).forEach(ic => {
        if (!fs.existsSync(path.join(root, ic.src))) bad("[PWA] иконки нет на диске: " + ic.src);
      });
      if (!(man.icons || []).some(ic => ic.purpose && ic.purpose.indexOf("maskable") >= 0))
        bad("[PWA] нет maskable-иконки — Android обрежет её как попало");
    }
    /* Главный инвариант: всё, что грузит страница, обязано лежать в кэше
       service worker. Иначе новый файл появится, а офлайн тихо сломается. */
    const sw = readRoot("sw.js");
    const idx = readRoot("index.html");
    const need = [];
    idx.replace(/<script src="([^"]+)"/g, (m, u) => { need.push(u); return m; });
    idx.replace(/<link rel="stylesheet" href="([^"]+)"/g, (m, u) => { need.push(u); return m; });
    fs.readdirSync(path.join(root, "content"))
      .filter(f => /^world\d+\.js$/.test(f))
      .forEach(f => need.push("content/" + f));
    need.forEach(u => {
      if (sw.indexOf('"./' + u + '"') < 0)
        bad(`[PWA] файл ${u} страница грузит, а в кэше sw.js его нет — офлайн сломается`);
    });
    /* и наоборот: в кэше не должно быть того, чего нет на диске */
    const shell = [];
    sw.replace(/"\.\/([^"]*)"/g, (m, u) => { shell.push(u); return m; });
    shell.forEach(u => {
      if (u && !fs.existsSync(path.join(root, u)))
        bad(`[PWA] в кэше sw.js записан несуществующий файл: ${u}`);
    });
    if (sw.indexOf("skipWaiting") < 0) bad("[PWA] новый worker не берёт управление — обновление зависнет");
    /* Имя кэша обязано совпадать с версией выпуска. Пока оно не менялось,
       старые файлы жили в кэше вечно: после 1.34.0 браузер подмешал старый
       скрипт к новой странице, и экран остался пустым. */
    const pkgVer = JSON.parse(readRoot("package.json")).version;
    const swVer = (sw.match(/CACHE\s*=\s*"kodokvest-([^"]+)"/) || [])[1];
    if (swVer !== pkgVer)
      bad(`[PWA] кэш sw.js назван «${swVer}», а версия выпуска ${pkgVer} — старые файлы не почистятся`);
    if (sw.indexOf('cache: "no-cache"') < 0)
      bad("[PWA] worker берёт файлы из HTTP-кэша браузера — к новой странице приедет старый скрипт");
    /* сначала сеть: иначе ребёнок неделями сидел бы на старой версии */
    if (!/fetch\(freshRequest\(req\)\)/.test(sw)) bad("[PWA] стратегия не «сначала сеть»");
    if (!/caches\.match\(req\)/.test(sw)) bad("[PWA] нет запасного пути из кэша — офлайн не работает");
    /* страница ссылается на манифест, а один файл — НЕ должен */
    if (idx.indexOf('rel="manifest"') < 0) bad("[PWA] в index.html нет ссылки на манифест");
    if (html.indexOf('rel="manifest"') >= 0)
      bad("[PWA] в одном файле осталась ссылка на манифест — он обещает «ничего извне»");
    if (html.indexOf('rel="apple-touch-icon"') >= 0)
      bad("[PWA] в одном файле осталась ссылка на иконку с диска");
    if (problems.length === p0) pwaChecked++;
  }

  /* --- пустой экран невозможен --- */
  let bootChecked = 0;
  if (typeof g.bootFallback === "function"){
    const p0 = problems.length;
    /* Ошибка при старте не должна оставлять ребёнка перед пустой страницей:
       на живом сайте так и вышло после 1.34.0 — браузер взял из кэша старый
       скрипт к новой шапке, тот упал, и экран остался пустым. */
    const app = doc.getElementById("app");
    app.innerHTML = "";
    g.bootFallback(new Error("проверка"));
    if (!app.textContent.trim()) bad("[старт] пустой экран остался пустым");
    if (!/Обновить/.test(app.textContent)) bad("[старт] нет кнопки «Обновить»");
    if (!doc.getElementById("bootreload")) bad("[старт] кнопка обновления без обработчика");
    /* и наоборот: если экран уже нарисован, подменять его нельзя */
    g.screenWorlds();
    await tick();
    const before = app.innerHTML;
    g.bootFallback(new Error("проверка"));
    if (app.innerHTML !== before) bad("[старт] сообщение затёрло уже нарисованный экран");
    if (problems.length === p0) bootChecked++;
    viewReset(g);
  }

  /* --- устройство сайта: три вкладки и блоки на Главном --- */
  let navChecked = 0;
  if (typeof g.screenTrain === "function"){
    const p0 = problems.length;
    /* Панель: три вкладки и пять инструментов, и ничего больше. Раньше тут
       лежали одиннадцать равных кнопок — из них не было видно, что главное.
       Пятым инструмент стал в 1.36.0: «?» отвечает «что это за экран и что
       тут делать» для любого экрана, и такого ответа раньше не было нигде,
       кроме Главного у новичка. Шестого быть не должно. */
    const tabs = [...doc.querySelectorAll(".tabs .tab")].map(b => b.getAttribute("data-tab"));
    if (tabs.join(",") !== "home,train,mine")
      bad("[устройство] вкладки не те: " + tabs.join(","));
    ["btn-today", "btn-sheet", "btn-who", "btn-focus", "btn-help"].forEach(id => {
      if (!doc.getElementById(id)) bad("[устройство] пропал инструмент " + id);
    });
    if (doc.querySelectorAll(".top-in .tbtn").length > 5)
      bad("[устройство] в панели снова больше пяти кнопок — она опять станет свалкой");

    /* Вкладка светится по тому, где мы находимся, а не по последнему клику */
    const active = () => [...doc.querySelectorAll(".tab.on")].map(b => b.getAttribute("data-tab")).join(",");
    g.screenWorlds(); await tick();
    if (active() !== "home") bad("[устройство] на Главном не светится «Главное»: " + active());
    g.screenTrain(); await tick();
    if (active() !== "train") bad("[устройство] на Тренировках светится не та вкладка: " + active());
    g.screenGames(); await tick();
    if (active() !== "train") bad("[устройство] игры — это «Тренировки», а светится: " + active());
    g.screenViz(); await tick();
    if (active() !== "train") bad("[устройство] визуализатор — это «Тренировки», а светится: " + active());
    g.screenFolio(); await tick();
    if (active() !== "mine") bad("[устройство] портфолио — это «Моё», а светится: " + active());
    g.screenMyTasks(); await tick();
    if (active() !== "mine") bad("[устройство] свои задания — это «Моё», а светится: " + active());
    g.openLesson("print-first"); await tick();
    if (active() !== "home") bad("[устройство] урок — это «Главное», а светится: " + active());
    g.screenAccount(); await tick();
    if (active() !== "") bad("[устройство] профиль не раздел, вкладка светиться не должна: " + active());

    /* Главное отвечает на четыре вопроса подряд: что делать сейчас, как это
       работает, где уроки, что тут ещё есть. */
    g.state.stars = {}; g.state.log = {};
    g.screenWorlds(); await tick();
    const heads = () => [...doc.querySelectorAll(".sect h2")].map(x => x.textContent);
    if (!doc.querySelector(".hero.now")) bad("[устройство] на Главном нет блока «Сейчас»");
    if (!doc.getElementById("go-next")) bad("[устройство] нет главной кнопки «начать/продолжить»");
    if (!doc.querySelector(".howto")) bad("[устройство] новичку не объяснили, как устроен урок");
    const want = ["Уроки", "Тренировки", "Моё", "Достижения"];
    if (heads().join(",") !== want.join(","))
      bad("[устройство] блоки Главного не те: " + heads().join(","));
    /* пять тренировок и два раздела «Моё» — в один клик с Главного */
    if (doc.querySelectorAll("[data-train]").length !== 5)
      bad("[устройство] на Главном не пять карточек тренировок");
    ["gofolio", "gomine", "go-train", "go-today"].forEach(id => {
      if (!doc.getElementById(id)) bad("[устройство] с Главного не попасть: " + id);
    });

    /* Объяснение «как устроен урок» — только новичку: место дороже. */
    g.setStars("print-first", 3);
    g.screenWorlds(); await tick();
    if (doc.querySelector(".howto"))
      bad("[устройство] объяснение для новичка осталось после первого пройденного урока");
    if (!/Продолжить/.test((doc.getElementById("go-next") || {}).textContent || ""))
      bad("[устройство] у продолжающего кнопка не «Продолжить»");

    /* Полоска «что дальше» на уроке — тоже один раз в жизни */
    g.state.stars = {};
    g.openLesson("print-first"); await tick();
    if (!doc.querySelector(".howbar")) bad("[устройство] на первом уроке нет полоски «что дальше»");
    g.setStars("print-first", 3);
    g.openLesson("print-first"); await tick();
    if (doc.querySelector(".howbar"))
      bad("[устройство] полоска «что дальше» осталась после первого пройденного урока");

    /* Экран «Тренировки»: пять разделов, у каждого сказано зачем и когда */
    g.screenTrain(); await tick();
    const cards = doc.querySelectorAll(".traincard");
    if (cards.length !== 5) bad("[устройство] на «Тренировках» " + cards.length + " карточек вместо пяти");
    cards.forEach(c => {
      if (!c.querySelector(".trainwhen")) bad("[устройство] у тренировки не сказано, когда сюда заходить");
      if (!c.querySelector("p").textContent.trim()) bad("[устройство] у тренировки пустое объяснение");
    });
    /* карточки правда открывают свои экраны */
    const byId = {};
    g.trainCards().forEach(c => { byId[c.id] = c; });
    for (const id of ["warm", "games", "ai", "sand", "viz"]){
      if (!byId[id] || typeof byId[id].go !== "function")
        bad("[устройство] тренировка «" + id + "» никуда не ведёт");
    }
    g.screenTrain(); await tick();
    doc.querySelector('.traincard [data-train="games"]').click();
    await tick();
    if (!/Игры/.test(doc.querySelector(".lvlhead h1").textContent))
      bad("[устройство] карточка «Игры» открыла не игры");

    /* «Моё» — одно место для всего сделанного руками */
    g.state.gallery = {}; g.state.mytasks = {};
    g.gallerySave("# Дом\nforward(50)\n");
    g.myTaskSave({ title:"Считалка", goal:"Напечатай числа от 1 до 3.", code:"print(1)", lines:["1"] });
    g.screenFolio(); await tick();
    const mineHeads = [...doc.querySelectorAll(".sect h2")].map(x => x.textContent);
    ["Готовые программы", "Мои рисунки", "Свои задания", "Сертификаты"].forEach(t => {
      if (mineHeads.indexOf(t) < 0) bad("[устройство] в «Моём» нет раздела «" + t + "»");
    });
    if (!doc.querySelector("[data-tasklink]")) bad("[устройство] из «Моего» нельзя скопировать ссылку на задание");

    /* Ни один раздел не потерялся: у каждого остался свой адрес */
    ["#today", "#warmup", "#games", "#ai", "#viz", "#again", "#folio", "#mine", "#train"].forEach(hash => {
      if (!/^#/.test(hash)) return;
      w.location.hash = hash;
    });
    await tick();
    if (!doc.getElementById("app").textContent.trim())
      bad("[устройство] адрес #train ничего не открыл");
    try { w.history.replaceState(null, "", "/kodokvest/"); } catch(e){}
    if (problems.length === p0) navChecked++;
    viewReset(g);
  }

  /* --- помощь «?», оформление и поиск урока --- */
  /* Помощь обязана отвечать про ТОТ экран, где человек стоит: одинаковый
     текст на всех экранах — это отсутствие помощи, а не помощь. Поэтому
     проверяем не «окно открылось», а «на разных экранах разные заголовки». */
  let helpChecked = 0, themeChecked = 0, searchChecked = 0;
  if (typeof g.openHelp === "function"){
    const p0 = problems.length;
    const hbox = doc.getElementById("helpwrap");
    const htitle = doc.getElementById("helptitle");
    const hbtn = doc.getElementById("btn-help");
    if (!hbox || !htitle || !hbtn) bad("[помощь] в разметке нет кнопки «?» или окна");
    if (g.helpIsOpen()) bad("[помощь] окно открыто, хотя никто его не звал");

    /* у каждого экрана есть свой текст, и он не пустой */
    const places = ["home","world","lesson","train","sand","games","game","today","warm","warmup",
                    "review","ai","ailesson","project","projectdone","folio","mytasks","friendtask",
                    "viz","account","register","guide","admin","stars","worlds","tools"];
    places.forEach(k => {
      const e = g.HELP[k];
      if (!e) return bad("[помощь] нет текста для места «" + k + "»");
      if (!e.t || !e.h) bad("[помощь] пустая подсказка для «" + k + "»");
    });

    const titleNow = async (open) => {
      g.closeHelp();
      open(); await tick();
      hbtn.click(); await tick();
      if (!g.helpIsOpen()) bad("[помощь] кнопка «?» не открыла окно");
      return htitle.textContent;
    };
    const tHome = await titleNow(() => g.screenWorlds());
    const tViz  = await titleNow(() => g.screenViz());
    const tLes  = await titleNow(() => g.openLesson("print-first"));
    const tFol  = await titleNow(() => g.screenFolio());
    if (new Set([tHome, tViz, tLes, tFol]).size !== 4)
      bad("[помощь] на разных экранах один и тот же текст: " + [tHome, tViz, tLes, tFol].join(" / "));
    if (!/Визуализатор/i.test(tViz)) bad("[помощь] в визуализаторе подсказка не про него: " + tViz);
    if (!/Урок/i.test(tLes)) bad("[помощь] на уроке подсказка не про урок: " + tLes);

    /* кружок «?» у заголовка ведёт в свою тему, а не туда же, куда кнопка */
    g.closeHelp();
    g.screenWorlds(); await tick();
    const circle = doc.querySelector('.sect [data-help="stars"]');
    if (!circle) bad("[помощь] у «Достижений» нет кружка «?»");
    else {
      circle.click(); await tick();
      if (!g.helpIsOpen()) bad("[помощь] кружок «?» не открыл окно");
      if (!/Звёзды/i.test(htitle.textContent))
        bad("[помощь] кружок у «Достижений» открыл не про звёзды: " + htitle.textContent);
    }
    /* --- подсказка не должна называть кнопок, которых нет ---
       Проверка написана после того, как в текстах нашлись выдуманные кнопки:
       визуализатор объяснялся через «⏭» и «⏮», которых там нет (там «Вперёд ▶»
       и «◀ Назад»), а игра — через «▶ Запустить» вместо «▶ Новая игра».
       Такую ошибку не поймает ни один тест на работу кода: код исправен,
       врёт текст. Поэтому берём из подсказки всё, что она берёт в кавычки
       и что похоже на кнопку, и требуем, чтобы такая кнопка на экране была. */
    const ЗНАКИ = /[▶⏭⏮✓↩⬇💡🧹🔍↺🖼]/;
    const ЭКРАНЫ = {
      home:    function(){ g.screenWorlds(); },
      world:   function(){ g.screenWorld(1); },
      lesson:  function(){ g.openLesson("print-first"); },
      train:   function(){ g.screenTrain(); },
      sand:    function(){ g.screenSandbox(); },
      game:    function(){ g.openGame(GAMES[0].id); },
      today:   function(){ g.screenToday(); },
      warm:    function(){ g.screenWarmups(); },
      warmup:  function(){ g.openWarmup(WARMUPS[0].id); },
      review:  function(){ g.screenReview(); },
      ai:      function(){ g.screenAILab(); },
      folio:   function(){ g.screenFolio(); },
      mytasks: function(){ g.screenMyTasks(); },
      /* У визуализатора кнопки перемотки появляются только ПОСЛЕ запуска —
         это и заставило дописать в подсказку первый шаг «Показать по шагам». */
      viz:     function(){ g.screenViz(); const b = doc.querySelector('[data-role="viz"]'); if (b) b.click(); },
      guide:   function(){ g.screenGuide(); }
    };
    /* «games» — список игр, а его подсказка рассказывает, что будет ВНУТРИ
       игры. Это не ошибка, а единственное такое место; кнопки самой игры
       проверяются на ключе «game». */
    for (const key of Object.keys(ЭКРАНЫ)){
      ЭКРАНЫ[key](); await tick();
      const кнопки = [...doc.querySelectorAll("button")]
        .map(b => b.textContent.replace(/\s+/g, " ").trim()).join(" ┆ ");
      const цитаты = (g.HELP[key].h.match(/«[^»]{2,44}»/g) || [])
        .map(x => x.slice(1, -1).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
        .filter(x => ЗНАКИ.test(x));
      цитаты.forEach(q => {
        if (кнопки.indexOf(q) < 0)
          bad("[помощь] на экране «" + key + "» нет кнопки «" + q + "», а подсказка её называет");
      });
    }

    /* --- помощь с клавиатуры ---
       Тот, кто ходит табом, должен попасть в окно, обойти его по кругу и
       выйти по Esc ровно туда, откуда пришёл. Без возврата фокуса Esc
       выбрасывает в начало страницы, и всю панель приходится пробегать
       заново. Проверка держит и это, и aria-expanded на кнопке. */
    g.screenWorlds(); await tick();
    const hb = doc.getElementById("btn-help");
    hb.focus();
    hb.click(); await tick();
    const box = doc.querySelector(".helpbox");
    if (doc.activeElement !== box)
      bad("[помощь] при открытии фокус не встал на окно: " + (doc.activeElement || {}).className);
    if (hb.getAttribute("aria-expanded") !== "true")
      bad("[помощь] кнопка не сказала диктору, что окно открыто");
    const focusables = g.HELP && doc.querySelectorAll(".helpbox button");
    if (!focusables.length) bad("[помощь] в окне нечего поймать табом");
    else {
      const first = focusables[0], last = focusables[focusables.length - 1];
      const tab = (shift) => box.dispatchEvent(
        new w.KeyboardEvent("keydown", { key:"Tab", shiftKey:!!shift, bubbles:true }));
      last.focus(); tab();
      if (doc.activeElement !== first)
        bad("[помощь] таб с последней кнопки убежал из окна");
      first.focus(); tab(true);
      if (doc.activeElement !== last)
        bad("[помощь] Shift+Tab с первой кнопки убежал из окна");
    }
    w.dispatchEvent(new w.KeyboardEvent("keydown", { key:"Escape", bubbles:true }));
    if (g.helpIsOpen()) bad("[помощь] Esc не закрыл окно");
    if (doc.activeElement !== hb)
      bad("[помощь] после Esc фокус не вернулся на кнопку «?»: " + (doc.activeElement || {}).id);
    if (hb.getAttribute("aria-expanded") !== "false")
      bad("[помощь] кнопка не сказала диктору, что окно закрылось");

    /* --- числа в подсказках должны совпадать с кодом --- */
    /* Сроки повтора и запас щитов написаны словами в двух местах: в коде
       константой и в подсказке текстом. Разъехались — ребёнку соврали. */
    const срокиТекст = g.HELP.review.h;
    if (g.REVIEW_STEPS.join(",") !== "2,7,21")
      bad("[помощь] сроки повтора поменялись (" + g.REVIEW_STEPS.join(",") +
          ") — перепиши текст в HELP.review и в инструкции");
    if (!/через два дня/.test(срокиТекст) || !/через неделю/.test(срокиТекст))
      bad("[помощь] в подсказке «Повторить» названы не те сроки");
    if (g.SHIELD_EVERY !== 5 || g.SHIELD_MAX !== 2)
      bad("[помощь] правила щита поменялись — перепиши текст в HELP.today");
    if (!/каждые пять дней/.test(g.HELP.today.h))
      bad("[помощь] в подсказке «Сегодня» назван не тот срок появления щита");
    /* Последний ранг: раньше в тексте стояло «Новичок → … → Мастер»,
       а Мастер шестой из восьми. */
    const последнийРанг = g.RANKS[g.RANKS.length - 1][1];
    if (g.HELP.stars.h.indexOf(последнийРанг) < 0)
      bad("[помощь] в подсказке про звёзды нет последнего ранга «" + последнийРанг + "»");

    /* Esc закрывает помощь, а не роняет её поверх шпаргалки */
    const esc = new w.KeyboardEvent("keydown", { key:"Escape", bubbles:true });
    w.dispatchEvent(esc);
    if (g.helpIsOpen()) bad("[помощь] Esc не закрыл окно");
    if (problems.length === p0) helpChecked++;
  }

  if (typeof g.themeSet === "function"){
    const p0 = problems.length;
    /* Тема по умолчанию светлая: тёмный фон тяжело читать днём, и это был
       прямой запрос. Тёмная остаётся — но только по выбору. */
    if (g.themeGet() !== "light") bad("[оформление] тема по умолчанию не светлая: " + g.themeGet());
    g.themeSet("dark");
    if (doc.documentElement.getAttribute("data-theme") !== "dark")
      bad("[оформление] тёмная тема не встала на страницу");
    if (w.localStorage.getItem("kodokvest_theme") !== "dark")
      bad("[оформление] выбор темы не запомнился");
    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta && meta.getAttribute("content") !== "#0d1020")
      bad("[оформление] цвет строки браузера не поехал за темой");
    /* Цвета не должны стоять в правилах жёстко: иначе светлой темы
       не может существовать в принципе. Сверяем по стилям самого файла. */
    /* комментарии выкидываем: в них цвета УПОМИНАЮТСЯ (как раз рассказом о
       том, почему так больше нельзя), и проверка ловила бы сама себя */
    const cssText = [...doc.querySelectorAll("style")].map(s => s.textContent).join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    if (!/:root\[data-theme="dark"\]/.test(cssText))
      bad("[оформление] в стилях нет блока тёмной темы");
    ["#0f1428", "#0b1020", "#080b18", "#070a16"].forEach(hex => {
      const re = new RegExp("background:\\s*" + hex);
      if (re.test(cssText)) bad("[оформление] тёмный цвет " + hex + " снова вбит прямо в правило");
    });
    g.themeSet("light");
    if (doc.documentElement.getAttribute("data-theme") !== "light")
      bad("[оформление] светлая тема не вернулась");

    /* --- пробелы внутри <code> в условиях обязаны сохраняться ---
       Иногда сами пробелы и есть смысл примера: выравнивание таблицы по
       ширине (урок 40) или «лишние пробелы снаружи и внутри» (урок 7).
       Пока стили их схлопывали, урок показывал ребёнку не то, что печатает
       программа, — и заметить это было нельзя. Аудит теперь сверяет пробелы
       дословно, так что правило обязано остаться. */
    if (!/\.goal code[^{]*\{[^}]*white-space:\s*pre-wrap/.test(cssText))
      bad("[условия] в <code> снова схлопываются пробелы — выравнивание в условиях станет ложью");

    /* --- печать: на бумагу уходит только сертификат ---
       Держится это на ОДНОМ правиле `body>*{display:none}`, а не на списке
       того, что надо спрятать. Разница принципиальная: со списком каждый
       новый оверлей (окно помощи, кнопка «наверх») пришлось бы в него
       дописывать, а забытый вылез бы на распечатку у ребёнка. */
    const печать = (cssText.match(/@media\s+print\s*\{([\s\S]*?)\n\}/) || [])[1] || "";
    if (!печать) bad("[печать] в стилях нет блока @media print");
    if (!/body\s*>\s*\*\s*\{[^}]*display\s*:\s*none/.test(печать))
      bad("[печать] печать больше не прячет всё разом — новый оверлей вылезет на бумагу");
    if (!/body\s*>\s*\.cert:not\(\[hidden\]\)/.test(печать))
      bad("[печать] сертификат не возвращается на печать");
    if (!/\.certbar\s*\{[^}]*display\s*:\s*none/.test(печать))
      bad("[печать] кнопки «Распечатать» и «Закрыть» уедут на бумагу");
    /* Кроме сертификата на печати не должно всплывать ничего: любое другое
       `display:block` внутри блока — это ещё один элемент на листе. */
    const возвраты = (печать.match(/^\s*([^{}\n]+)\{[^}]*display\s*:\s*(block|flex|grid)/gm) || [])
      .map(x => x.split("{")[0].trim());
    возвраты.forEach(sel => {
      if (!/\.cert/.test(sel))
        bad("[печать] на бумагу возвращается не сертификат: " + sel);
    });

    if (problems.length === p0) themeChecked++;
  }

  if (typeof g.lessonSearch === "function"){
    const p0 = problems.length;
    if (!g.lessonSearch("черепашка").length) bad("[поиск] «черепашка» ничего не нашла");
    if (!g.lessonSearch("словар").length) bad("[поиск] «словар» ничего не нашла");
    if (g.lessonSearch("ц").length) bad("[поиск] одна буква уже что-то ищет — так выдача бессмысленна");
    if (g.lessonSearch("щщщщ").length) bad("[поиск] нашлось то, чего нет");
    if (g.lessonSearch("черепашка").length > 8) bad("[поиск] выдача не ограничена");

    /* Замки должны быть НА МЕСТЕ: панель наставника в проверках выше их
       снимала, а весь смысл этой проверки — что поиск замок не обходит. */
    const admWas = g.state.admin;
    g.state.admin = {};
    g.state.stars = {}; g.state.log = {};
    g.screenWorlds(); await tick();
    const inp = doc.getElementById("lq");
    if (!inp) bad("[поиск] на Главном нет строки поиска");
    else {
      inp.value = "черепашка";
      inp.dispatchEvent(new w.Event("input", { bubbles:true }));
      await tick();
      const rows = doc.querySelectorAll("#lsfound .lsrow");
      if (!rows.length) bad("[поиск] строка поиска ничего не показала");
      /* Закрытый урок из выдачи не прячем (иначе это ложь «такого нет»),
         но и открыть его отсюда нельзя — порядок уроков держит весь курс. */
      const locked = [...rows].filter(r => r.classList.contains("lock"));
      if (!locked.length)
        bad("[поиск] в самом начале курса все найденные уроки почему-то открыты");
      locked.forEach(r => {
        if (r.hasAttribute("data-open"))
          bad("[поиск] из поиска можно открыть закрытый урок — порядок курса обходится");
      });
      inp.value = "щщщщ";
      inp.dispatchEvent(new w.Event("input", { bubbles:true }));
      await tick();
      if (!doc.querySelector("#lsfound .lsnone"))
        bad("[поиск] на пустую выдачу ничего не сказано");
    }
    g.state.admin = admWas;
    if (problems.length === p0) searchChecked++;
    viewReset(g);
  }

  /* --- полная инструкция --- */
  let guideChecked = 0;
  if (typeof g.screenGuide === "function"){
    const p0 = problems.length;
    g.screenGuide(); await tick();
    const txt = doc.getElementById("app").textContent;
    if (!/Как пользоваться/.test(txt)) bad("[инструкция] экран не открылся");
    ["Первый час", "Кнопки наверху", "Звёзды", "Когда не получается", "Для родителя"].forEach(x => {
      if (txt.indexOf(x) < 0) bad("[инструкция] нет раздела «" + x + "»");
    });
    if (!doc.querySelector("#guidetheme [data-theme-set]"))
      bad("[инструкция] нет переключателя темы");
    /* вкладка на инструкции не светится: это не раздел, а справка */
    if (doc.querySelector(".tab.on")) bad("[инструкция] подсветилась вкладка, хотя это не раздел");
    w.location.hash = "#help";
    g.routeHash(); await tick();
    if (!/Как пользоваться/.test(doc.getElementById("app").textContent))
      bad("[инструкция] адрес #help её не открыл");
    try { w.history.replaceState(null, "", "/kodokvest/"); } catch(e){}
    if (problems.length === p0) guideChecked++;
    viewReset(g);
  }


  /* ================= занятие, честное время, кабинет взрослого =================
     Новая механика выходит только вместе с машинной проверкой на неё: без
     человека в цикле непроверенная механика — это тихий брак у ребёнка,
     которого никто не увидит. Здесь проверяется всё, что добавлено разом:
     активные минуты вместо «вкладка открыта», карта по часам, занятие как
     единица, отчёт взрослому, рамка и задания от взрослого. */
  let timeChecked = 0, zanChecked = 0, adultChecked = 0, ptaskChecked = 0, statChecked = 0;
  let authorChecked = 0, myPredChecked = 0, shopChecked = 0, backChecked = 0, showChecked = 0;
  let breakChecked = 0;

  /* --- 1. время: считаем работу, а не открытую вкладку --- */
  if (typeof g.tickOnce === "function"){
    const p0 = problems.length;
    g.state.hours = {}; g.state.log["l-time"] = undefined;
    const lid = CUR[0].lessons[0].id;
    g.state.log[lid] = { attempts:0, hints:0, shown:0, runs:0, timeMs:0, pauseMs:0,
                         first:null, last:null, solvedAt:null, stars:0, bestSteps:0 };
    g.setLessonForTest(lid);

    /* активная страница: тик идёт в работу и в карту часов */
    g.setIdleForTest(600000); g.actMark();
    if (!g.pageActive()) bad("[время] активная страница считается неактивной");
    g.tickOnce();
    if (g.state.log[lid].timeMs !== 10000)
      bad("[время] активный тик не засчитан: " + g.state.log[lid].timeMs);
    const row = g.state.hours[g.dayKey()] || [];
    if (row.reduce((a, b) => a + b, 0) !== 10)
      bad("[время] карта часов не пополнилась: " + JSON.stringify(row));

    /* ушёл от компьютера: вкладка открыта, но касаний нет — это ПАУЗА.
       Порог 0 значит «любой промежуток без касания уже простой»: настоящий
       порог шесть минут, ждать их в тесте незачем. */
    g.setIdleForTest(0);
    if (g.pageActive()) bad("[время] простой дольше порога считается работой");
    g.tickOnce();
    if (g.state.log[lid].timeMs !== 10000)
      bad("[время] простой засчитан как работа — ровно то, из-за чего отчёт врал бы");
    if (g.state.log[lid].pauseMs !== 10000)
      bad("[время] пауза не записана: " + g.state.log[lid].pauseMs);
    const row2 = g.state.hours[g.dayKey()] || [];
    if (row2.reduce((a, b) => a + b, 0) !== 10)
      bad("[время] простой попал в карту часов");

    /* вкладка спрятана: тоже пауза, даже если только что касались */
    let hidden = true;
    try { Object.defineProperty(doc, "visibilityState", { get: () => hidden ? "hidden" : "visible", configurable:true }); } catch(e){}
    g.setIdleForTest(600000); g.actMark();
    if (g.pageActive()) bad("[время] спрятанная вкладка считается работой");
    g.tickOnce();
    if (g.state.log[lid].timeMs !== 10000) bad("[время] спрятанная вкладка накрутила время");
    hidden = false;
    g.setLessonForTest(null);
    g.setIdleForTest(6 * 60 * 1000);   /* вернуть боевой порог остальным проверкам */

    /* слияние двух устройств: по каждой ячейке МАКСИМУМ, а не сумма */
    const dayk = g.dayKey();
    const rowA = new Array(24).fill(0); rowA[9] = 300;
    const rowB = new Array(24).fill(0); rowB[9] = 300; rowB[10] = 60;
    const mh = g.mergeProgress({ savedAt:1, hours:{ [dayk]: rowA } },
                               { savedAt:2, hours:{ [dayk]: rowB } });
    if (mh.hours[dayk][9] !== 300)
      bad("[время] слияние сложило один и тот же час дважды: " + mh.hours[dayk][9]);
    if (mh.hours[dayk][10] !== 60) bad("[время] слияние потеряло час со второго устройства");

    /* карта не должна расти без предела */
    for (let i = 0; i < 260; i++) g.state.hours["2020-01-" + i] = new Array(24).fill(0);
    g.pruneHours();
    if (Object.keys(g.state.hours).length > 200)
      bad("[время] карта часов растёт без предела: " + Object.keys(g.state.hours).length);
    if (problems.length === p0) timeChecked++;
  }

  /* --- 2. занятие: план, ход, закрытие, отчёт --- */
  if (typeof g.zanStart === "function"){
    const p0 = problems.length;
    g.state.zan = {};
    g.frameSet({ days:[1,2,3,4,5], len:30, mix:"balanced" });

    /* план детерминирован: два вызова в один день дают одно и то же */
    const k = g.dayKey();
    const p1 = JSON.stringify(g.zanPlanFor(k)), p2 = JSON.stringify(g.zanPlanFor(k));
    if (p1 !== p2) bad("[занятие] план не детерминирован — на двух устройствах разойдётся");

    /* длина занятия меняет число уроков */
    if (g.zanSlots(20) >= g.zanSlots(45))
      bad("[занятие] в 20 минут помещается не меньше, чем в 45");

    const rec = g.zanStart();
    if (!rec || !rec.plan.length) bad("[занятие] занятие не началось или план пуст");
    if (!g.zanOpen()) bad("[занятие] открытое занятие не находится");
    const again = g.zanStart();
    if (again.key !== rec.key) bad("[занятие] второе «начать» завело второе занятие вместо продолжения");

    /* шаг плана закрывается победой урока, а не отдельной кнопкой */
    const first = rec.plan[0];
    g.zanNote(first.k === "lesson" ? "lesson" : "warm", first.id, { ok:true });
    const openNow = g.zanOpen();
    if (openNow && openNow.done.length !== 1)
      bad("[занятие] шаг плана не закрылся: " + JSON.stringify(openNow && openNow.done));

    /* ⚠️ Кнопка «Назад» наверху урока во время занятия обязана вести В
       ЗАНЯТИЕ, а не в список уроков: иначе она уносит мимо плана ровно так
       же, как это делало «Дальше →» в победной карточке. */
    {
      g.openLesson("vars");
      await tick();
      const back = doc.querySelector(".crumbs .backbtn");
      if (!back) bad("[назад] во время занятия на уроке нет кнопки «Назад»");
      else if (!/занятию/i.test(back.textContent))
        bad("[назад] во время занятия кнопка ведёт мимо плана: " + JSON.stringify(back.textContent));
      else {
        back.click();
        await tick();
        if (doc.querySelector(".lessongrid")) bad("[назад] кнопка не увела с урока");
        if (!/Занятие|занятие/.test(doc.getElementById("app").textContent))
          bad("[назад] кнопка во время занятия увела не в занятие");
      }
    }

    /* закрыть можно в любой момент, даже когда сделано не всё */
    const fin = g.zanFinish("hand");
    if (!fin || !fin.end) bad("[занятие] занятие не закрылось руками");
    if (g.zanOpen()) bad("[занятие] после закрытия осталось открытым");

    const rep = g.zanReport(fin, g.state);
    ["was", "praise", "got", "ask"].forEach(f => {
      if (!rep[f] || !String(rep[f]).trim()) bad("[отчёт] пустая строка отчёта: " + f);
    });
    if (rep.full) bad("[отчёт] незаконченное занятие названо полным");
    if (!/закончили раньше плана/.test(rep.was))
      bad("[отчёт] про недоделанный план не сказано: " + rep.was);

    /* предсказание считается только по блоку проверки и только с первой попытки */
    g.state.zan = {};
    const rec2 = g.zanStart();
    const pred = rec2.plan.filter(b => b.k === "predict")[0];
    if (pred){
      g.zanNote("warm", pred.id, { ok:false });
      const r2 = g.zanAll()[rec2.key];
      if (r2.predAll !== 1) bad("[отчёт] проверка понимания не посчитана");
      if (r2.predOk !== 0) bad("[отчёт] предсказание со второй попытки засчитано как понимание");
    }
    g.zanFinish("hand");

    /* --- время вышло: выбор из трёх, а не «стоп/дальше» --- */
    g.state.zan = {};
    const rec3 = g.zanStart();
    const r3 = g.zanAll()[rec3.key];
    r3.sec = (r3.len + 1) * 60;              /* время вышло */
    g.screenZan();
    await tick();
    if (!doc.getElementById("zstop")) bad("[занятие] по истечении времени нет кнопки «закончить»");
    if (!doc.getElementById("zone")) bad("[занятие] нет средней кнопки «ещё один урок»");
    if (!doc.getElementById("zcheck")) bad("[занятие] нет варианта «только проверку и всё»");
    if (/молодец|не остановился/i.test(doc.getElementById("app").textContent))
      bad("[занятие] продолжение похвалено — занятие превращается в гонку");

    /* «ещё один урок»: вопрос не повторяется, пока шаг не сделан */
    r3.ask = (r3.done || []).length + 1;
    g.screenZan();
    await tick();
    if (doc.getElementById("zstop"))
      bad("[занятие] после «ещё один урок» вопрос задан снова, не дав его сделать");

    /* --- сжатие плана: видимое, а не молчаливое --- */
    g.state.zan = {};
    const rec4 = g.zanStart();
    const r4 = g.zanAll()[rec4.key];
    const planLen = r4.plan.length;
    const lessonsInPlan = r4.plan.filter(b => b.k === "lesson" || b.k === "review").length;
    r4.sec = Math.ceil(r4.len / 2) * 60 + 60;   /* половина времени прошла */
    if (lessonsInPlan > 1){
      const did = g.zanSqueeze(r4);
      if (!did) bad("[сжатие] план не сжался, хотя половина времени прошла, а сделано ноль");
      if ((r4.cut || []).length !== 1) bad("[сжатие] перенесено не то число шагов: " + JSON.stringify(r4.cut));
      if (r4.plan.length !== planLen) bad("[сжатие] шаг вычеркнут из плана — он должен остаться с пометкой");
      /* проверку понимания не режем никогда */
      if ((r4.cut || []).some(x => x.indexOf("predict:") === 0))
        bad("[сжатие] срезана проверка понимания — единственное, что нельзя подделать");
      g.screenZan();
      await tick();
      const txt = doc.getElementById("app").textContent;
      if (!/перенесли на следующий раз/.test(txt))
        bad("[сжатие] перенос не помечен в плане — молча сокращать нельзя");
      if (!/тяжелее обычного/.test(txt)) bad("[сжатие] ребёнку не сказано, что план сжали");
      const rep4 = g.zanReport(r4, g.state);
      if (!/перенесен/i.test(rep4.cut || "")) bad("[сжатие] в отчёте взрослому нет строки про перенос: " + rep4.cut);
      if (rep4.full) bad("[сжатие] сжатое занятие названо полным");
    }

    /* --- «только проверку и всё» --- */
    g.state.zan = {};
    const rec5 = g.zanStart();
    const r5 = g.zanAll()[rec5.key];
    if (r5.plan.some(b => b.k === "predict")){
      g.zanCutToCheck(r5);
      const restKinds = g.zanRemaining(r5).map(b => b.k);
      if (restKinds.filter(k => k !== "predict").length)
        bad("[выбор] после «только проверку» в остатке остались лишние шаги: " + JSON.stringify(restKinds));
      if (!restKinds.length) bad("[выбор] проверка понимания тоже срезана");
      const rep5 = g.zanReport(r5, g.state);
      if (!/сам решил/.test(rep5.cut || "")) bad("[выбор] отчёт не отличает выбор ребёнка от сжатия по времени");
    }

    /* закрытие само, когда в остатке пусто (сделано + перенесено = план) */
    g.state.zan = {};
    const rec6 = g.zanStart();
    const r6 = g.zanAll()[rec6.key];
    r6.done = r6.plan.filter(b => b.k === "predict").map(b => b.k + ":" + b.id);
    r6.cut = r6.plan.filter(b => b.k !== "predict").map(b => b.k + ":" + b.id);
    if (g.zanRemaining(r6).length) bad("[занятие] остаток считается неверно при переносе");
    g.zanFinish("plan");

    g.state.zan = {};
    if (problems.length === p0) zanChecked++;
  }

  /* --- 2б. самоизмерение длины занятия --- */
  if (typeof g.zanStats === "function"){
    const p0 = problems.length;
    g.state.zan = {};
    g.frameSet({ len:30, perLesson:null });

    /* пока занятий мало — молчим: одно занятие это случай, а не замер */
    const few = g.zanStats();
    if (few.enough) bad("[замер] замер объявлен по нулю занятий");
    g.screenAdult(); await tick();
    if (!/Замер появится после/.test(doc.getElementById("app").textContent))
      bad("[замер] при нехватке данных нет честного «пока рано»");

    /* три занятия: 33 минуты на 3 урока, 30 на 3, 36 на 3 → около 11 мин на урок */
    const mk = (key, sec, lessons) => {
      g.zanAll()[key] = { start:1, end:2, len:30, sec:sec, pause:0, predOk:0, predAll:0,
        plan:[], cut:[],
        done: Array.from({length:lessons}, (_, i) => "lesson:x" + i) };
    };
    mk("2026-01-01#1", 33*60, 3);
    mk("2026-01-02#1", 30*60, 3);
    mk("2026-01-03#1", 36*60, 3);
    /* мусор, который в замер попасть не должен */
    mk("2026-01-04#1", 60, 1);                    /* открыл и закрыл */
    g.zanAll()["2026-01-05#1"] = { start:1, end:2, len:30, sec:40*60, pause:0,
      plan:[], cut:[], done:[] };                 /* ни одного урока */
    const st = g.zanStats();
    if (!st.enough) bad("[замер] трёх занятий не хватило: " + JSON.stringify(st));
    if (st.n !== 3) bad("[замер] в замер попал мусор: занятий " + st.n + ", ожидалось 3");
    if (Math.abs(st.per - 11) > 0.4) bad("[замер] минут на урок посчитано неверно: " + st.per);
    if (st.mins !== 33) bad("[замер] медиана длины занятия неверна: " + st.mins);

    /* ⚠️ сам замер ничего не меняет, пока взрослый его не принял */
    if (g.zanSlotsFor(30) !== g.zanSlots(30))
      bad("[замер] план перестроился без согласия взрослого");
    g.screenAdult(); await tick();
    const txt = doc.getElementById("app").textContent;
    if (!/помещается/.test(txt)) bad("[замер] в кабинете нет вывода про число уроков");
    const on = doc.querySelector('[data-act="peron"]');
    if (!on) bad("[замер] нет кнопки «считать план по этому замеру»");
    else {
      on.click(); await tick();
      if (!g.frame().perLesson) bad("[замер] замер не принят кнопкой");
      if (g.zanSlotsFor(30) !== 2)
        bad("[замер] после принятия план не пересчитался: " + g.zanSlotsFor(30));
      /* и дата-цель считается по нему же, а не по среднему */
      const pc = g.paceCheck(g.dayKey(new Date(Date.now() + 120*864e5)), [1,3,5], 30);
      if (!pc.byMeasure) bad("[замер] план от даты считает по среднему, зная темп ребёнка");
      const off = doc.querySelector('[data-act="perloff"]');
      if (!off) bad("[замер] принятый замер нельзя отключить");
      else { off.click(); await tick(); }
      if (g.frame().perLesson) bad("[замер] замер не отключился");
    }
    g.state.zan = {};
    g.frameSet({ perLesson:null, len:30 });
    if (problems.length === p0) statChecked++;
    viewReset(g);
  }

  /* --- 2в. перерыв и потолок дня --- */
  if (typeof g.zanBreakStart === "function"){
    const p0 = problems.length;
    g.state.zan = {}; g.state.hours = {};
    g.frameSet({ len:45, cap:0, capHard:false, perLesson:null });

    /* перерыв: время идёт в паузу, а не в работу и не в карту часов */
    const rec = g.zanStart();
    const r = g.zanAll()[rec.key];
    g.setIdleForTest(600000); g.actMark();
    g.zanBreakStart(r);
    if (!g.zanOnBreak(r)) bad("[перерыв] не начался");
    const secBefore = r.sec, pauseBefore = r.pause;
    g.tickOnce();
    if (r.sec !== secBefore) bad("[перерыв] время перерыва засчитано как работа");
    if (r.pause !== pauseBefore + 10) bad("[перерыв] время перерыва не попало в паузу");
    const row = g.state.hours[g.dayKey()] || [];
    if (row.reduce((a, b) => a + b, 0) !== 0) bad("[перерыв] перерыв попал в карту активности");
    g.screenZan(); await tick();
    if (!/Перерыв/.test(doc.getElementById("app").textContent))
      bad("[перерыв] экран перерыва не показан");
    if (doc.querySelector(".zopen")) bad("[перерыв] во время перерыва предлагается открыть шаг");
    g.zanBreakEnd(r);
    g.screenZan(); await tick();
    if (/☕ Перерыв<\/h1>/.test(doc.getElementById("app").innerHTML))
      bad("[перерыв] не закончился по кнопке");

    /* предложение перерыва: только на длинном занятии и только с середины */
    r.sec = 5 * 60;
    if (g.zanBreakDue(r)) bad("[перерыв] предложен в самом начале занятия");
    r.sec = 30 * 60; r.breaksTaken = 0;
    if (!g.zanBreakDue(r)) bad("[перерыв] не предложен на 45-минутном занятии после половины");
    r.len = 20;
    if (g.zanBreakDue(r)) bad("[перерыв] предложен на коротком занятии");
    r.len = 45; r.breaksTaken = 1;
    if (g.zanBreakDue(r)) bad("[перерыв] предложен второй раз, хотя уже был");

    /* потолок дня: мягкий говорит, жёсткий не пускает дальше */
    g.state.zan = {};
    const rowNow = g.hoursRow(g.dayKey());
    rowNow[10] = 70 * 60;                        /* 70 минут за сегодня */
    if (g.todayMinutes() !== 70) bad("[потолок] минуты за день посчитаны неверно: " + g.todayMinutes());
    g.frameSet({ cap:60, capHard:false });
    if (!g.capReached()) bad("[потолок] предел не распознан");
    if (g.capHard()) bad("[потолок] мягкий предел ведёт себя как жёсткий");
    g.screenToday(); await tick();
    const t1 = doc.getElementById("app").textContent;
    if (!/на сегодня хватит/.test(t1)) bad("[потолок] мягкое напоминание не показано");
    if (!doc.getElementById("zanstart")) bad("[потолок] мягкий предел запретил начать занятие");

    g.frameSet({ capHard:true });
    if (!g.capHard()) bad("[потолок] жёсткий предел не включился");
    g.screenToday(); await tick();
    if (doc.getElementById("zanstart")) bad("[потолок] жёсткий предел пустил в новое занятие");
    if (!/На сегодня всё/.test(doc.getElementById("app").textContent))
      bad("[потолок] жёсткий предел не объяснил, почему нельзя");

    /* ⚠️ жёсткий предел не обрывает НАЧАТОЕ занятие: шаги не открываются, но
       закрыть занятие можно */
    const rec2 = g.zanStart();
    g.screenZan(); await tick();
    if (doc.querySelector(".zopen")) bad("[потолок] жёсткий предел оставил кнопку «открыть шаг»");
    if (!doc.getElementById("zend")) bad("[потолок] занятие нельзя закрыть при жёстком пределе");

    g.frameSet({ cap:0, capHard:false, len:30 });
    g.state.zan = {}; g.state.hours = {};
    if (problems.length === p0) breakChecked++;
    viewReset(g);
  }

  /* --- 3. рамка взрослого: гейт разумности, каникулы, слияние --- */
  if (typeof g.paceCheck === "function"){
    const p0 = problems.length;
    /* нереальный темп не должен молча приниматься */
    const soon = g.dayKey(new Date(Date.now() + 7 * 864e5));
    const pace = g.paceCheck(soon, [1,2,3,4,5], 30);
    if (pace.ok && pace.left > 20)
      bad("[рамка] «весь курс за неделю» прошло без предупреждения: " + JSON.stringify(pace));

    /* каникулы: запланированный пропуск не считается учебным днём */
    const today = g.dayKey();
    g.frameSet({ days:[0,1,2,3,4,5,6], breaks:[[today, today]] });
    if (!g.isBreakDay(today)) bad("[рамка] каникулы не распознаны");
    if (g.frameStudyDay(today)) bad("[рамка] день каникул назван учебным");
    g.frameSet({ breaks: [] });

    /* слияние: рамка — настройка, побеждает свежая, а не объединение */
    const m = g.mergeProgress(
      { savedAt:1, frame:{ days:[1,2,3], len:45, mix:"new", report:true, breaks:[], goal:null, setAt:1 } },
      { savedAt:2, frame:{ days:[6], len:20, mix:"repeat", report:false, breaks:[], goal:null, setAt:2 } });
    if (JSON.stringify(m.frame.days) !== "[6]")
      bad("[рамка] слияние объединило дни вместо «свежее побеждает»: " + JSON.stringify(m.frame.days));
    if (m.frame.report !== false) bad("[рамка] снятая галочка отчётов вернулась при слиянии");

    /* галочка отчётов и правда снимается */
    g.frameSet({ report:false });
    if (g.frame().report !== false) bad("[рамка] галочка отчётов не снялась");
    g.frameSet({ report:true, days:[1,2,3,4,5], len:30, mix:"balanced" });

    /* кабинет открывается и показывает карту часов */
    g.adminUnlock();
    g.screenAdult();
    await tick();
    const t = doc.getElementById("app").textContent;
    if (!/Рамка занятий/.test(t)) bad("[кабинет] нет рамки занятий");
    if (!/Когда он занимался/.test(t)) bad("[кабинет] нет карты активности");
    if (!/Задать задание/.test(t)) bad("[кабинет] нет «задать задание»");
    if (!doc.querySelector(".heat i")) bad("[кабинет] карта часов не отрисовалась");
    if (problems.length === p0) adultChecked++;
    viewReset(g);
  }

  /* --- 4. задание от взрослого --- */
  if (typeof g.assignLink === "function"){
    const p0 = problems.length;
    g.state.ptasks = {};
    const xpBefore = g.state.xp, starsBefore = Object.keys(g.state.stars).length;

    /* назначение уезжает ссылкой и разбирается обратно */
    const link = g.assignLink({ t:"ask", ref:"", text:"Расскажи, что делает print()", from:"взрослый" });
    const hash = link.split("#")[1] || "";
    const got = g.assignUnpack(hash.replace(/^assign=/, ""));
    if (!got || got.text !== "Расскажи, что делает print()") bad("[задание] ссылка не разобралась обратно");
    if (g.assignUnpack("это-не-base64")) bad("[задание] мусор в ссылке принят за задание");

    /* задание попадает в список и отмечается сделанным */
    const key = g.ptaskAdd(got);
    if (!g.ptaskPending().length) bad("[задание] не попало в список невыполненных");
    g.ptaskMarkDone(key);
    if (g.ptaskPending().length) bad("[задание] не отметилось выполненным");
    if (g.state.xp !== xpBefore || Object.keys(g.state.stars).length !== starsBefore)
      bad("[задание] задание взрослого начислило звёзды или опыт — этого быть не должно");
    if (g.ptaskWeekCount() < 1) bad("[задание] недельный счётчик не считает");

    /* задача с числами взрослого: программу пишет шаблон, ответ считает движок */
    const tpl = (w.PARENT_TASKS || [])[0];
    if (!tpl) bad("[задание] шаблоны задач не загрузились");
    else {
      const v = {}; tpl.params.forEach(pp => { v[pp.k] = pp.def; });
      const built = g.taskBuild(tpl.title, tpl.goal(v), tpl.code(v));
      if (built.problem || built.error)
        bad("[задание] шаблон «" + tpl.id + "» не собрался: " + (built.problem || JSON.stringify(built.error)));
      else {
        if (!built.task.lines.length) bad("[задание] у собранного задания пустой ответ");
        const back = g.taskUnpack(g.taskLink(built.task).split("#task=")[1]);
        if (!back || back.title !== tpl.title) bad("[задание] задача с числами не разобралась обратно");
      }
    }
    /* все шаблоны обязаны запускаться: сломанный шаблон виден только взрослому,
       и он решит, что сломан тренажёр */
    (w.PARENT_TASKS || []).forEach(t => {
      const v = {}; t.params.forEach(pp => { v[pp.k] = pp.def; });
      const b = g.taskBuild(t.title, t.goal(v), t.code(v));
      if (b.problem || b.error) bad("[задание] шаблон «" + t.id + "»: " + (b.problem || "ошибка запуска"));
    });
    g.state.ptasks = {};
    if (problems.length === p0) ptaskChecked++;
    viewReset(g);
  }

  /* --- 5. запись авторства («Как шла работа») --- */
  if (typeof g.authorMarks === "function"){
    const p0 = problems.length;

    /* 5.1. Каждый шаблон обязан ловить пример СВОЕЙ ЖЕ записи в шпаргалке.
       Это дешёвая и жёсткая проверка: шаблон, который не узнаёт собственный
       пример, не узнает и код ребёнка, а молчащий сигнал хуже отсутствующего —
       он выглядит доказательством того, что всё чисто. */
    {
      const ids = Object.keys(g.AHEAD_PROBES);
      if (ids.length < 50) bad("[авторство] шаблонов подозрительно мало: " + ids.length);
      ids.forEach(id => {
        const it = g.sheetById(id);
        if (!it) return bad("[авторство] шаблон ссылается на запись шпаргалки «" + id + "», а её нет");
        if (!w.CURRICULUM.byId(it.lesson))
          bad("[авторство] запись «" + id + "» ссылается на несуществующий урок " + it.lesson);
        if (!g.AHEAD_PROBES[id].test(g.codeSkeleton(it.code)))
          bad("[авторство] шаблон «" + id + "» не ловит собственный пример из шпаргалки");
      });
    }

    /* 5.2. Строки и комментарии из кода вычищаются: искать конструкцию внутри
       текстовой строки значит ловить «for» в слове «форма». */
    {
      const sk = g.codeSkeleton('x = "for i in range(3)"  # for\nprint(x)');
      if (/range/.test(sk)) bad("[авторство] содержимое строки попало в разбор кода: " + sk);
      if (!/print/.test(sk)) bad("[авторство] разбор кода съел настоящий код: " + sk);
    }

    /* 5.3. «Вперёд программы» считается от того, что нужно САМОМУ заданию.
       Без этого сигнал срабатывал бы на курсе: урок 58 законно пишет
       @dataclass, а декораторы объясняют в 72-м. */
    {
      const before = JSON.parse(JSON.stringify(g.state.stars));
      g.state.stars = {};                       /* ничего не пройдено */
      const mine = 'print([x * 2 for x in [1, 2, 3]])';
      if (!g.aheadIn(mine, "").length)
        bad("[авторство] непройденная конструкция в решении не замечена");
      if (g.aheadIn(mine, mine).length)
        bad("[авторство] то, что нужно самому заданию, засчитано как забег вперёд");
      g.state.stars = before;
    }

    /* 5.4. Счётчики редактора: набор, вставка извне и вставка из урока —
       три разные вещи, и путать их нельзя. Программная подстановка кода
       (setCode) не набор и не вставка: там пишет не ребёнок. */
    {
      g.openLesson("vars");
      await tick();
      const st = studioOf();
      const ed = st && st.editor;
      const ta = st && st.querySelector("textarea");
      if (!ed || !ta) bad("[авторство] редактор урока не нашёлся");
      else {
        const t0 = JSON.parse(JSON.stringify(ed.trace));
        ed.setCode("a = 1\n");
        if (ed.trace.typed !== t0.typed || ed.trace.pasted !== t0.pasted)
          bad("[авторство] подстановка кода засчитана как работа ребёнка");

        /* набор: input без предшествующего paste */
        ta.value = "a = 1\nb = 2\n";
        ta.dispatchEvent(new w.Event("input", { bubbles:true }));
        if (ed.trace.typed <= 0) bad("[авторство] набор с клавиатуры не посчитан");

        /* вставка ИЗВНЕ */
        const typedWas = ed.trace.typed;
        ed.knownText = "print(\"это из урока\")";
        const chunk = "for i in range(10):\n    print(i * i)\n";
        const pev = new w.Event("paste", { bubbles:true });
        pev.clipboardData = { getData: () => chunk };
        ta.dispatchEvent(pev);
        ta.value += chunk;
        ta.dispatchEvent(new w.Event("input", { bubbles:true }));
        if (ed.trace.pasted < chunk.length)
          bad("[авторство] вставка извне не посчитана: " + ed.trace.pasted);
        if (ed.trace.typed !== typedWas)
          bad("[авторство] вставка засчитана как набор");

        /* вставка ИЗ МАТЕРИАЛА УРОКА — обычная работа, а не сигнал */
        const pastedWas = ed.trace.pasted;
        const own = 'print("это из урока")';
        const pev2 = new w.Event("paste", { bubbles:true });
        pev2.clipboardData = { getData: () => own };
        ta.dispatchEvent(pev2);
        ta.value += own;
        ta.dispatchEvent(new w.Event("input", { bubbles:true }));
        if (ed.trace.pasted !== pastedWas)
          bad("[авторство] копия примера из этого же урока названа чужой работой");
        if (ed.trace.own < own.length)
          bad("[авторство] копия примера урока не посчитана отдельно");
      }
      viewReset(g);
    }

    /* 5.5. Запись пишется при сдаче урока и НЕ переписывается при повторной:
       она свидетельствует о первой сдаче. Иначе «часть пришла готовой»
       стиралась бы вторым проходом, и грош ей цена. */
    {
      const id = "vars";
      delete g.state.log[id];
      g.setStars(id, 0);
      const body = CONTENT.world1[id];
      const r = await attempt(id, body.task.solution);
      if (!r.ok) bad("[авторство] урок не сдался: " + r.why);
      const tr1 = (g.state.log[id] || {}).tr;
      if (!tr1) bad("[авторство] запись не появилась после сдачи урока");
      else {
        if (!tr1.at) bad("[авторство] у записи нет времени");
        if (tr1.len !== body.task.solution.length)
          bad("[авторство] длина сданной программы записана неверно");
        const was = tr1.at;
        await new Promise(r2 => setTimeout(r2, 5));
        await attempt(id, body.task.solution);
        if ((g.state.log[id].tr || {}).at !== was)
          bad("[авторство] повторная сдача переписала запись о первой");
      }
      const marks = g.authorMarks(id);
      if (!marks || !marks.marks.length) bad("[авторство] у записи нет ни одной пометки");
      if (g.authorMarks("такого-урока-нет"))
        bad("[авторство] выдумана запись про урок, которого не проходили");
      viewReset(g);
    }

    /* 5.6. Слияние двух устройств. Журнал при слиянии собирается заново,
       поле за полем, — значит новое поле обязано быть названо явно, иначе
       оно молча теряется на каждой синхронизации. Побеждает РАННЯЯ запись:
       свидетельство о первой сдаче. */
    {
      const m = g.mergeProgress(
        { savedAt:1, log:{ vars:{ tr:{ at:100, typed:5, pasted:0, ahead:[] } } } },
        { savedAt:2, log:{ vars:{ tr:{ at:200, typed:0, pasted:99, ahead:[] } } } });
      if (!m.log.vars.tr) bad("[авторство] слияние потеряло запись");
      else if (m.log.vars.tr.at !== 100)
        bad("[авторство] слияние оставило позднюю запись вместо первой сдачи");
      const m2 = g.mergeProgress({ savedAt:1, log:{ vars:{ attempts:1 } } },
                                 { savedAt:2, log:{ vars:{ tr:{ at:7, ahead:[] } } } });
      if (!m2.log.vars.tr) bad("[авторство] слияние потеряло запись, которой нет на втором устройстве");
    }

    /* 5.7. Экран. Проверяем не только что он рисуется, но и ГРАНИЦУ
       ЧЕСТНОСТИ: слова «списал» тут быть не должно ни в каком виде, а
       рамка «мы не следим» обязана стоять до цифр. */
    {
      g.adminUnlock();
      g.screenTrace();
      await tick();
      const t = doc.getElementById("app").textContent;
      if (!/Как шла работа/.test(t)) bad("[авторство] экран записи не открылся");
      if (/спис(ал|ыва)/i.test(t))
        bad("[авторство] на экране появилось слово «списал» — этого продукт себе не позволяет");
      if (!/не следим|не следит/i.test(t))
        bad("[авторство] на экране не сказано, что мы не следим за ребёнком");
      if (!/других вкладок|камеры/i.test(t))
        bad("[авторство] не названо, чего мы НЕ видим");
      const rules = doc.querySelector(".trrules"), sum = doc.querySelector(".trsum");
      if (!rules) bad("[авторство] нет рамки честности");
      if (rules && sum && !(rules.compareDocumentPosition(sum) & 4))
        bad("[авторство] цифры стоят раньше рамки честности");
      if (!doc.querySelector(".trrow")) bad("[авторство] на экране нет ни одного урока с записью");

      /* вход в запись есть в кабинете, и он ведёт куда обещал */
      g.screenAdult();
      await tick();
      const btn = doc.querySelector('[data-act="totrace"]');
      if (!btn) bad("[авторство] в кабинете нет входа в запись");
      else {
        btn.click();
        await tick();
        if (!/Как шла работа/.test(doc.getElementById("app").textContent))
          bad("[авторство] кнопка кабинета не открыла запись");
      }
      viewReset(g);
    }

    if (problems.length === p0) authorChecked++;
  }

  /* --- 6. проверка понимания на СВОЁМ коде --- */
  if (typeof g.myPredictMake === "function"){
    const p0 = problems.length;

    /* 6.1. Что спрашивать НЕЛЬЗЯ. Программа, вывод которой зависит не только
       от кода, дала бы у ребёнка другой ответ — и он был бы прав, а мы нет. */
    [
      ['имя = input()\nprint(имя)', "ввод с клавиатуры"],
      ['import random\nprint(random.randint(1, 6))', "случайность"],
      ['forward(50)\nprint(1)', "черепашка"],
      ['x = 2 + 2', "программа ничего не печатает"]
    ].forEach(([code, why]) => {
      if (g.myPredictMake(code))
        bad("[своя программа] вопрос задан по программе, где " + why);
    });

    /* 6.2. Вопрос обязан быть НОВЫМ: с изменённым числом программа печатает
       не то, что ребёнок уже видел. Иначе правильный ответ — это ровно тот
       вывод, который у него перед глазами, и проверка не проверяет ничего. */
    {
      const code = 'цена = 45\nсколько = 3\nprint("Итого:", цена * сколько)';
      const made = g.myPredictMake(code);
      if (!made) bad("[своя программа] из обычной программы вопрос не получился");
      else {
        if (made.from === made.to) bad("[своя программа] число «поменяли» на то же самое");
        if (g.normPred(made.out) === g.normPred(made.was))
          bad("[своя программа] с новым числом печатается ровно то же самое — спрашивать нечего");
        if (made.code === code) bad("[своя программа] программа не изменилась");
        if (made.code.length !== code.length - String(made.from).length + String(made.to).length)
          bad("[своя программа] правка задела не только число");
      }
    }

    /* 6.3. Цифра ВНУТРИ текстовой строки — это не число программы. Поменять
       её значит спросить про кавычки, а не про то, как работает код. */
    {
      const code = 'print("Мне 12 лет")';
      const made = g.myPredictMake(code);
      if (made) bad("[своя программа] изменена цифра внутри текстовой строки: " + made.code);
    }

    /* 6.4. Программы занятия копятся и не растут без предела. */
    {
      g.state.zan = {};
      g.frameSet({ days:[1,2,3,4,5], len:30, mix:"balanced" });
      const rec = g.zanStart();
      for (let i = 0; i < 9; i++) g.zanKeepProg("ur" + i, "print(" + i + ")");
      const kept = (g.zanAll()[rec.key].progs || []);
      if (kept.length > 6) bad("[своя программа] программы занятия копятся без предела: " + kept.length);
      if (!kept.length) bad("[своя программа] программа занятия не сохранилась");
      /* повтор того же урока не плодит записей */
      const was = (g.zanAll()[rec.key].progs || []).length;
      g.zanKeepProg("ur8", "print(8)");
      if ((g.zanAll()[rec.key].progs || []).length !== was)
        bad("[своя программа] повторная сдача урока завела вторую запись");
      g.zanFinish("hand");
      g.state.zan = {};
    }

    /* 6.4б. У новичка разминок «угадай вывод» ещё не открыто ни одной — то
       есть занятие заканчивалось БЕЗ проверки понимания ровно тогда, когда
       родителю она нужнее всего. Своя программа для вопроса ниоткуда не
       нужна, поэтому блок дописывается в план сам. */
    {
      g.state.zan = {};
      const starsWas = JSON.parse(JSON.stringify(g.state.stars));
      const warmWas = JSON.parse(JSON.stringify(g.state.warmups || {}));
      const admWas = g.state.admin && g.state.admin.unlockAll;
      g.state.stars = {};                 /* новичок: разминок не открыто */
      g.state.warmups = {};
      /* ⚠️ Снятые замки наставника открывают ВСЕ разминки — без этой строки
         проверка молча тестировала бы не новичка, а панель наставника. */
      if (g.state.admin) g.state.admin.unlockAll = false;
      const rec = g.zanStart();
      if (g.zanAll()[rec.key].plan.some(b => b.k === "predict"))
        bad("[своя программа] у новичка в плане откуда-то взялась чужая разминка-проверка");
      g.zanKeepProg("vars", 'дней = 52\nprint("Недель:", дней // 7)');
      const plan = g.zanAll()[rec.key].plan;
      if (!plan.some(b => b.k === "predict" && b.id === "mine"))
        bad("[своя программа] проверка понимания не появилась в плане новичка");
      /* второй урок не заводит второй такой же блок */
      g.zanKeepProg("math", 'x = 3\nprint(x * 4)');
      if (plan.filter(b => b.k === "predict").length !== 1)
        bad("[своя программа] проверок понимания в плане завелось больше одной");
      g.zanFinish("hand");
      g.state.zan = {};
      g.state.stars = starsWas;
      g.state.warmups = warmWas;
      if (g.state.admin) g.state.admin.unlockAll = admWas;
    }

    /* 6.5. Занятие целиком: сдал урок — и проверка понимания в конце спрашивает
       про ЕГО программу, а не про чужую разминку. */
    {
      g.state.zan = {};
      const rec = g.zanStart();
      g.zanKeepProg("vars", 'всего = 7\nprint("Осталось:", всего - 2)');
      const pick = g.myPredictPick();
      if (!pick) bad("[своя программа] своя программа занятия не нашлась для вопроса");
      else {
        const block = g.zanAll()[rec.key].plan.filter(b => b.k === "predict")[0];
        if (!block) bad("[своя программа] в плане занятия нет блока проверки понимания");
        else {
          /* ⚠️ Главная точка соединения: занятие открывает блок «проверка
             понимания» САМО, и оно обязано выбрать свою программу, а не
             чужую разминку. Проверять только openMyPredict напрямую значит
             не проверить ровно того, ради чего всё делалось. */
          g.zanOpenBlock(block);
          await tick();
          if (!/твоя программа/i.test(doc.getElementById("app").textContent))
            bad("[своя программа] занятие открыло чужую разминку, хотя своя программа была");

          g.openMyPredict(pick, block.id);
          await tick();
          const t = doc.getElementById("app").textContent;
          if (!/твоя программа|твой код/i.test(t))
            bad("[своя программа] экран не говорит, что программа его собственная");
          if (!/поменяли одно число/i.test(t))
            bad("[своя программа] не сказано, что именно изменили");
          const st = studioOf();
          if (!st) bad("[своя программа] студия предсказания не открылась");
          else {
            /* неверный ответ шаг плана не закрывает */
            st.editor.setCode("что-то не то");
            st.querySelector('[data-role="check"]').click();
            await tick();
            if (won()) bad("[своя программа] неверное предсказание засчитано");
            if ((g.zanAll()[rec.key].done || []).indexOf("predict:" + block.id) >= 0)
              bad("[своя программа] неверный ответ закрыл блок плана");

            st.editor.setCode(pick.made.out);
            st.querySelector('[data-role="check"]').click();
            await tick();
            if (!won()) bad("[своя программа] верное предсказание не засчитано");
            closeWin();
            const r = g.zanAll()[rec.key] || {};
            if (!r.predAll) bad("[своя программа] проверка понимания не попала в отчёт");
            if (!r.predMine) bad("[своя программа] не помечено, что спрашивали про свой код");
            if (r.predOk !== 0)
              bad("[своя программа] ответ со второй попытки засчитан как понимание");
          }
        }
      }
      /* отчёт обязан сказать взрослому, что проверка была на собственном коде:
         для него это принципиально другой вес */
      const fin = g.zanFinish("hand");
      const rep = g.zanReport(fin, g.state);
      if (!/СОБСТВЕННУЮ|собственн/i.test(rep.got))
        bad("[своя программа] отчёт не сказал, что спрашивали про его же программу: " + rep.got);
      g.state.zan = {};
      viewReset(g);
    }

    if (problems.length === p0) myPredChecked++;
  }

  /* --- 7. мастерская: полка деталей и верстак --- */
  if (typeof g.partsFrom === "function"){
    const p0 = problems.length;

    /* 7.1. Что считается деталью: функция верхнего уровня целиком, с телом. */
    {
      const code = 'СТАВКА = 5\n\n' +
        'def налог(сумма):\n    """сколько платить"""\n    return сумма * СТАВКА // 100\n\n\n' +
        'def привет(имя):\n    return "Привет, " + имя\n\n' +
        'print(налог(1000))';
      const parts = g.partsFrom(code);
      if (parts.length !== 2)
        bad("[мастерская] деталей найдено " + parts.length + " вместо двух: " +
            JSON.stringify(parts.map(x => x.name)));
      else {
        if (parts[0].name !== "налог" || parts[1].name !== "привет")
          bad("[мастерская] имена деталей прочитаны неверно: " + JSON.stringify(parts.map(x => x.name)));
        if (!/return сумма/.test(parts[0].code))
          bad("[мастерская] тело детали не попало в неё: " + JSON.stringify(parts[0].code));
        if (/print\(/.test(parts[0].code))
          bad("[мастерская] в деталь затянуло код за её пределами");
        if (!/сколько платить/.test(parts[0].code))
          bad("[мастерская] строка документации выпала из детали");
      }
    }

    /* 7.2. «def» внутри текстовой строки деталью не становится: это текст,
       а не функция. Ловится тем, что режем по скелету кода. */
    {
      const code = 'подсказка = """\ndef так_нельзя():\n    pass\n"""\nprint(подсказка)';
      if (g.partsFrom(code).length)
        bad("[мастерская] в деталь попал def из текстовой строки");
    }
    /* объявление без тела деталью тоже не считается */
    if (g.partsFrom("def пусто():").length)
      bad("[мастерская] пустое объявление названо деталью");

    /* 7.3. Сломанная деталь на полку не кладётся. */
    if (g.partWorks("def кривая(:\n    pass"))
      bad("[мастерская] сломанный код признан рабочей деталью");
    if (!g.partWorks("def годная(x):\n    return x + 1"))
      bad("[мастерская] рабочая деталь признана сломанной");

    /* 7.4. Сбор при сдаче урока. ⚠️ Показанное решение деталью НЕ становится:
       это код автора, и назвать его «твоей деталью» — соврать ребёнку в самом
       важном для него месте. То же с функцией, выданной в заготовке. */
    {
      g.state.parts = {};
      const sess = g.getSession();
      const own = 'def удвой(x):\n    return x * 2\n\n\nprint(удвой(4))';

      /* показанное решение */
      Object.assign(sess, { shown:true, code: own, starter:[{ name:"main.py", code:"" }] });
      g.partsHarvest({ num:1, title:"Урок" }, {});
      if (g.partsList().length)
        bad("[мастерская] показанное решение легло на полку как своя деталь");

      /* выдано в заготовке */
      Object.assign(sess, { shown:false, code: own, starter:[{ name:"main.py", code: own }] });
      g.partsHarvest({ num:1, title:"Урок" }, {});
      if (g.partsList().length)
        bad("[мастерская] функция из заготовки записана как написанная ребёнком");

      /* написано самим */
      Object.assign(sess, { shown:false, code: own,
                            starter:[{ name:"main.py", code:"# напиши функцию удвой\n" }] });
      const n = g.partsHarvest({ num:7, title:"Функции" }, {});
      if (n !== 1) bad("[мастерская] своя функция не попала на полку: собрано " + n);
      const list = g.partsList();
      if (list.length !== 1) bad("[мастерская] на полке не одна деталь: " + list.length);
      else {
        if (list[0].name !== "удвой") bad("[мастерская] имя детали: " + list[0].name);
        if (!/урок 7/.test(list[0].from)) bad("[мастерская] не записано, откуда деталь: " + list[0].from);
      }
      /* тот же урок второй раз дубля не даёт */
      g.partsHarvest({ num:7, title:"Функции" }, {});
      if (g.partsList().length !== 1)
        bad("[мастерская] одна и та же деталь легла на полку дважды");

      /* полка не растёт без предела */
      for (let i = 0; i < g.PART_MAX + 5; i++)
        g.partAdd("ф" + i, "def ф" + i + "():\n    return " + i, "урок");
      if (g.partsList().length > g.PART_MAX)
        bad("[мастерская] полка растёт без предела: " + g.partsList().length);
    }

    /* 7.5. Слияние двух устройств. ⚠️ Полка — это НАКОПЛЕНИЕ: деталь,
       сделанная на планшете, не должна пропадать из-за занятия на ноутбуке.
       Поэтому здесь объединение, а не «свежее побеждает». */
    {
      const m = g.mergeProgress(
        { savedAt:1, parts:{ d1:{ name:"а", code:"def а():\n    return 1", at:1 } },
          builds:{ b1:{ title:"Вещь", code:"print(1)", at:1 } } },
        { savedAt:2, parts:{ d2:{ name:"б", code:"def б():\n    return 2", at:2 } },
          builds:{} });
      if (Object.keys(m.parts).length !== 2)
        bad("[мастерская] слияние потеряло деталь с одного из устройств: " +
            JSON.stringify(Object.keys(m.parts)));
      if (!m.builds || !m.builds.b1)
        bad("[мастерская] слияние потеряло собранную вещь");
    }

    /* 7.6. Экран: полка, верстак, деталь встаёт в код кнопкой, вещь
       сохраняется. И уход с экрана не стирает написанное (грабля 43). */
    {
      g.state.parts = {}; g.state.builds = {}; g.state.shop = "";
      g.partAdd("удвой", "def удвой(x):\n    return x * 2", "урок 7 · Функции");
      g.screenShop();
      await tick();
      const t = doc.getElementById("app").textContent;
      if (!/Полка/.test(t)) bad("[мастерская] на экране нет полки");
      if (!doc.querySelector(".partcard")) bad("[мастерская] деталь не показана на полке");
      const take = doc.querySelector("[data-take]");
      if (!take) bad("[мастерская] у детали нет кнопки «на верстак»");
      else {
        take.click();
        await tick();
        const st = studioOf();
        if (!st) bad("[мастерская] верстак не открылся");
        else if (!/def удвой/.test(st.editor.getCode()))
          bad("[мастерская] деталь не встала в код верстака");
        else {
          /* сохранение вещи */
          st.editor.setCode("# Мой калькулятор\ndef удвой(x):\n    return x * 2\n\n\nprint(удвой(21))");
          doc.getElementById("tobuild").click();
          await tick();
          const builds = g.buildsList();
          if (builds.length !== 1) bad("[мастерская] вещь не сохранилась: " + builds.length);
          else if (builds[0].title !== "Мой калькулятор")
            bad("[мастерская] название вещи взято не из комментария: " + builds[0].title);
        }
      }
      /* одни комментарии — сохранять нечего, и об этом надо сказать, а не
         молча завести пустую вещь */
      const st2 = studioOf();
      if (st2){
        const wasN = g.buildsList().length;
        st2.editor.setCode("# просто мысли\n# и ещё\n");
        doc.getElementById("tobuild").click();
        await tick();
        if (g.buildsList().length !== wasN)
          bad("[мастерская] сохранилась вещь из одних комментариев");
        if (!/нечего сохранять/i.test(doc.getElementById("buildmsg").textContent))
          bad("[мастерская] про пустую вещь ничего не сказано");
      }
      /* уход с экрана не должен стирать написанное */
      const st3 = studioOf();
      if (st3){
        st3.editor.setCode("print('не потеряй меня')");
        g.screenWorlds();
        await tick();
        if (!/не потеряй меня/.test(g.state.shop || ""))
          bad("[мастерская] уход с верстака стёр написанное");
      }
      g.state.parts = {}; g.state.builds = {}; g.state.shop = "";
      viewReset(g);
    }

    if (problems.length === p0) shopChecked++;
  }

  /* --- 8. обратное направление: ребёнок задаёт задачу взрослому --- */
  if (typeof g.solvedLink === "function"){
    const p0 = problems.length;
    g.state.solved = {}; g.state.mytasks = {}; g.state.friendTasks = {};

    /* 8.1. Квитанция уезжает и разбирается обратно. ⚠️ Имени в ней нет и быть
       не должно: имя взрослого в детском прогрессе — это персональные данные
       рядом с детскими, то есть ровно то, чего продукт не делает. */
    {
      const link = g.solvedLink({ key:"kabc", tries:3, title:"Считалка" });
      const raw = decodeURIComponent(link.split("#solved=")[1] || "");
      const back = g.solvedUnpack(link.split("#solved=")[1]);
      if (!back) bad("[наоборот] квитанция не разобралась обратно");
      else {
        if (back.key !== "kabc" || back.tries !== 3)
          bad("[наоборот] квитанция потеряла данные: " + JSON.stringify(back));
      }
      let payload = "";
      try { payload = g.b64urlDec(link.split("#solved=")[1]); } catch(e){ payload = ""; }
      if (/имя|name|author|"a"/i.test(payload))
        bad("[наоборот] в квитанции появилось поле про человека: " + payload);
      if (g.solvedUnpack("это-не-base64")) bad("[наоборот] мусор принят за квитанцию");
      if (g.solvedUnpack(g.b64urlEnc(JSON.stringify({ v:1, k:"k1", n:0 }))))
        bad("[наоборот] принята квитанция с нулём попыток");
    }

    /* 8.2. Одну ссылку можно открыть десять раз — «решили» от этого не
       десять. А вот решение с другого раза это другое событие. */
    {
      g.state.solved = {};
      g.solvedAdd({ key:"k1", tries:2, title:"Задача" });
      g.solvedAdd({ key:"k1", tries:2, title:"Задача" });
      if (g.solvedFor("k1").length !== 1)
        bad("[наоборот] повторное открытие ссылки посчиталось вторым решением");
      g.solvedAdd({ key:"k1", tries:5, title:"Задача" });
      if (g.solvedFor("k1").length !== 2)
        bad("[наоборот] второе решение той же задачи не записалось");
      if (g.solvedFor("другая").length)
        bad("[наоборот] квитанция прилипла к чужой задаче");
    }

    /* 8.3. Слияние: решённое на одном устройстве не пропадает из-за занятия
       на другом (то же правило, что у полки деталей). */
    {
      const m = g.mergeProgress(
        { savedAt:1, solved:{ "k1-2":{ k:"k1", n:2, at:1 } } },
        { savedAt:2, solved:{ "k9-1":{ k:"k9", n:1, at:2 } } });
      if (Object.keys(m.solved || {}).length !== 2)
        bad("[наоборот] слияние потеряло квитанцию: " + JSON.stringify(Object.keys(m.solved || {})));
    }

    /* 8.4. Петля целиком: собрали задание → решили как «друг» → получили
       обратную ссылку → автор её открыл и увидел, с какой попытки. */
    {
      g.state.solved = {}; g.state.mytasks = {};
      const built = g.taskBuild("Считалка", "Напечатай числа от 1 до 3, каждое с новой строки.",
                                "for i in range(1, 4):\n    print(i)");
      if (built.problem || built.error)
        bad("[наоборот] задание не собралось: " + (built.problem || "ошибка"));
      else {
        const id = g.myTaskSave(built.task);
        const key = g.taskKey(built.task);

        g.openFriendTask(built.task, {});
        await tick();
        const t = doc.getElementById("app").textContent;
        if (!/вы взрослый/i.test(t))
          bad("[наоборот] решающему не сказано, что делать, если он взрослый");
        if (!/устанавливать ничего не нужно/i.test(t))
          bad("[наоборот] не снят главный страх взрослого — что надо что-то ставить");

        const st = studioOf();
        if (!st) bad("[наоборот] редактор решателя не открылся");
        else {
          st.editor.setCode("print(9)");           /* первая попытка мимо */
          st.querySelector('[data-role="check"]').click();
          await tick();
          if (won()) bad("[наоборот] неверный ответ засчитан");
          st.editor.setCode("print(1)\nprint(2)\nprint(3)");
          st.querySelector('[data-role="check"]').click();
          await tick();
          if (!won()) bad("[наоборот] верный ответ не засчитан");

          const fb = doc.getElementById("fback");
          if (!fb) bad("[наоборот] решившему негде взять обратную ссылку — петля не замкнута");
          else {
            fb.click();
            const shown = doc.getElementById("fbackmsg").textContent;
            const m = /#solved=([A-Za-z0-9_-]+)/.exec(shown);
            if (!m) bad("[наоборот] обратная ссылка не показана: " + shown.slice(0, 80));
            else {
              const rec = g.solvedUnpack(m[1]);
              if (!rec) bad("[наоборот] обратная ссылка не читается");
              else {
                if (rec.key !== key) bad("[наоборот] квитанция не про эту задачу");
                if (rec.tries !== 2) bad("[наоборот] число попыток в квитанции: " + rec.tries);
                closeWin();
                /* автор открывает присланное */
                g.screenSolved(rec);
                await tick();
                const t2 = doc.getElementById("app").textContent;
                if (!/Твою задачу решили/.test(t2)) bad("[наоборот] автор не увидел, что задачу решили");
                if (!/2-й попытки/.test(t2)) bad("[наоборот] автору не сказано, с какой попытки: " + t2.slice(0, 200));
                if (!g.solvedFor(key).length) bad("[наоборот] квитанция не записалась автору");
                /* и это видно в списке его заданий */
                g.screenMyTasks();
                await tick();
                if (!/Решили/.test(doc.getElementById("app").textContent))
                  bad("[наоборот] в списке своих заданий не видно, что задачу решили");
              }
            }
          }
        }
        g.myTaskDrop(id);
      }
    }

    /* 8.5. Своё же задание, открытое «глазами друга», отправлять некому. */
    {
      const built = g.taskBuild("Проба", "Напечатай слово привет одной строкой.", 'print("привет")');
      if (!built.task) bad("[наоборот] пробное задание не собралось");
      else {
        g.openFriendTask(built.task, { own:true });
        await tick();
        const st = studioOf();
        st.editor.setCode('print("привет")');
        st.querySelector('[data-role="check"]').click();
        await tick();
        if (!won()) bad("[наоборот] своё задание не проходится");
        if (doc.getElementById("fback"))
          bad("[наоборот] у своего же задания предложено отправить результат самому себе");
        closeWin();
      }
    }

    /* 8.6. Видное место. Задания раздают ребёнку везде; место, где раздаёт
       он, — единственное, и оно обязано стоять раньше портфолио. */
    {
      g.screenWorlds();
      await tick();
      const mineBtn = doc.getElementById("gomine"), folio = doc.getElementById("gofolio");
      if (!mineBtn) bad("[наоборот] на главной нет входа в «задай задачу»");
      else if (folio && !(mineBtn.compareDocumentPosition(folio) & 4))
        bad("[наоборот] «задай задачу» стоит ниже портфолио");
      const card = mineBtn && mineBtn.closest(".projcard");
      if (card && !/взрослому|маме/i.test(card.textContent))
        bad("[наоборот] карточка не говорит, что задачу задают взрослому: " + card.textContent.slice(0, 120));
    }

    g.state.solved = {}; g.state.mytasks = {}; g.state.friendTasks = {};
    viewReset(g);
    if (problems.length === p0) backChecked++;
  }

  /* --- 9. витрина «что создают ученики» --- */
  if (typeof g.screenShowcase === "function"){
    const p0 = problems.length;

    /* 9.1. Каждая программа курса обязана запускаться и что-то печатать:
       витрина, на которой половина карточек пустая, продаёт против нас. */
    {
      const list = g.showcaseProjects();
      if (list.length !== (w.PROJECTS || []).length)
        bad("[витрина] показаны не все программы курса: " + list.length);
      list.forEach(x => {
        if (!x.code || !x.code.trim())
          bad("[витрина] у программы «" + x.p.title + "» нет готового кода");
        if (x.out === null)
          bad("[витрина] программа «" + x.p.title + "» падает при запуске на витрине");
        else if (!x.out.trim())
          bad("[витрина] программа «" + x.p.title + "» ничего не печатает — показывать нечего");
        if (!/после/.test(g.showcaseAfter(x.p)))
          bad("[витрина] не сказано, когда до неё доходят: " + g.showcaseAfter(x.p));
      });
    }

    /* 9.2. Экран. ⚠️ Кода непройденного проекта на витрине быть не должно:
       выложить решение рядом с курсом значит своими руками сломать курс. */
    {
      const pj = (w.PROJECTS || [])[0];
      const before = JSON.parse(JSON.stringify(g.state.projects || {}));
      g.state.projects = {};                    /* ничего не собрано */
      g.screenShowcase();
      await tick(60);
      const t = doc.getElementById("app").textContent;
      if (!/Что создают ученики/.test(t)) bad("[витрина] экран не открылся");
      if (!doc.querySelector("[data-show]")) bad("[витрина] нечего запустить");
      if (doc.querySelector("[data-showopen]"))
        bad("[витрина] предложено открыть проект, который ещё не собран");

      /* кусок решения непройденного проекта не должен лежать на странице */
      const tail = (pj.steps[pj.steps.length - 1].solution || "").split("\n")
        .map(x => x.trim()).filter(x => x.length > 25)[0];
      if (tail && doc.getElementById("app").innerHTML.indexOf(tail) >= 0)
        bad("[витрина] на витрине лежит код непройденного проекта: " + tail.slice(0, 50));

      /* вывод показывается по нажатию и не целиком */
      const btn = doc.querySelector("[data-show]");
      const id = btn.getAttribute("data-show");
      const box = doc.querySelector('[data-out="' + id + '"]');
      if (!box.hidden) bad("[витрина] вывод показан до нажатия");
      btn.click();
      if (box.hidden || !box.textContent.trim()) bad("[витрина] вывод не показался");
      const shownLines = box.textContent.split("\n").length;
      if (shownLines > 14) bad("[витрина] вывод вывален целиком: строк " + shownLines);

      /* честный блок про отсутствие чужих детей — не сноска, а раздел */
      if (!/имен|имён/i.test(t)) bad("[витрина] не сказано, почему тут нет чужих работ с именами");
      if (!/публичн/i.test(t)) bad("[витрина] не сказано, что публичной ленты не будет");

      /* рисунки дорисовываются после загрузки мира */
      await tick(120);
      const strip = doc.getElementById("drawstrip");
      if (strip && /Загружаем/.test(strip.textContent))
        bad("[витрина] полоска рисунков осталась в загрузке");

      g.state.projects = before;
    }

    /* 9.3. Входы: с главной и из кабинета взрослого — это его страница. */
    {
      g.screenWorlds();
      await tick();
      if (!doc.getElementById("goworks")) bad("[витрина] на главной нет входа в витрину");
      g.adminUnlock();
      g.screenAdult();
      await tick();
      const b = doc.querySelector('[data-act="toworks"]');
      if (!b) bad("[витрина] в кабинете взрослого нет входа в витрину");
      else {
        b.click();
        await tick(60);
        if (!/Что создают ученики/.test(doc.getElementById("app").textContent))
          bad("[витрина] кнопка кабинета не открыла витрину");
      }
      viewReset(g);
    }

    if (problems.length === p0) showChecked++;
  }

  console.log(`уроков прогнано: ${checked} (из них «починить»: ${fixChecked})`);
  console.log(`игр прогнано: ${gamesChecked} из ${GAMES.length}`);
  console.log(`разминок прогнано: ${warmupsChecked} из ${WARMUPS.length}`);
  console.log(`замок разминок по прогрессу: ${warmGateChecked ? "да" : "нет"}`);
  console.log(`«Ты и ИИ» прогнано: ${ailabChecked} из ${AILAB.length}` +
              ` (из них вердиктов: ${reviewChecked} из ${AILAB.filter(x => x.type === "review").length},` +
              ` пойманных ИИ: ${catchChecked} из ${AILAB.filter(x => x.type === "catch").length})`);
  console.log(`живой разбор расхождения: ${whyChecked} случаев`);
  console.log(`визуализатор проверен: ${vizChecked} проверок (стек вызовов, разбор шага, подсветка)`);
  console.log(`задача дня и стрик: ${dailyChecked ? "да" : "нет"}`);
  console.log(`расписание занятий: ${schedChecked ? "да" : "нет"}`);
  console.log(`щит для стрика: ${shieldChecked ? "да" : "нет"}`);
  console.log(`бейджи за стрик: ${streakBadgeChecked ? "да" : "нет"}`);
  console.log(`проектов пройдено по шагам: ${projChecked} из ${(w.PROJECTS || []).length}`);
  console.log(`работа над ошибками: ${againChecked ? "да" : "нет"}`);
  console.log(`шпаргалка: ${sheetChecked ? "да" : "нет"}`);
  console.log(`цена программы в шагах: ${stepsChecked ? "да" : "нет"}`);
  console.log(`проект с ИИ-напарником: ${aiProjChecked ? "да" : "нет"}`);
  console.log(`отчёт за неделю: ${weekChecked ? "да" : "нет"}`);
  console.log(`черновики кода на уроке: ${draftChecked ? "да" : "нет"}`);
  console.log(`портфолио и сертификаты: ${folioChecked ? "да" : "нет"}`);
  console.log(`регистрация по имени: ${regChecked ? "да" : "нет"}`);
  console.log(`цель по шагам: ${leanChecked ? "да" : "нет"}`);
  console.log(`разбор своей программы: ${ownVizChecked ? "да" : "нет"}`);
  console.log(`свои задания и ссылки: ${taskChecked ? "да" : "нет"}`);
  console.log(`значения в редакторе: ${watchChecked ? "да" : "нет"}`);
  console.log(`бестиарий ошибок: ${beastChecked ? "да" : "нет"}`);
  console.log(`разбор кода (ревью): ${lintChecked ? "да" : "нет"}`);
  console.log(`панель символов: ${keybarChecked ? "да" : "нет"}`);
  console.log(`файл .py: ${pyChecked ? "да" : "нет"}`);
  console.log(`вопрос за ужином: ${dinnerChecked ? "да" : "нет"}`);
  console.log(`пересказ программы: ${storyChecked ? "да" : "нет"}`);
  console.log(`галерея рисунков: ${galleryChecked ? "да" : "нет"}`);
  console.log(`установка на домашний экран: ${pwaChecked ? "да" : "нет"}`);
  console.log(`устройство сайта (вкладки и блоки): ${navChecked ? "да" : "нет"}`);
  console.log(`подсказка «?» по экранам: ${helpChecked ? "да" : "нет"}`);
  console.log(`светлая и тёмная тема: ${themeChecked ? "да" : "нет"}`);
  console.log(`поиск по урокам: ${searchChecked ? "да" : "нет"}`);
  console.log(`полная инструкция: ${guideChecked ? "да" : "нет"}`);
  console.log(`защита от пустого экрана: ${bootChecked ? "да" : "нет"}`);
  console.log(`честное время (активные минуты и паузы): ${timeChecked ? "да" : "нет"}`);
  console.log(`занятие как единица: ${zanChecked ? "да" : "нет"}`);
  console.log(`кабинет взрослого и рамка: ${adultChecked ? "да" : "нет"}`);
  console.log(`задание от взрослого: ${ptaskChecked ? "да" : "нет"}`);
  console.log(`самоизмерение длины занятия: ${statChecked ? "да" : "нет"}`);
  console.log(`перерыв и потолок дня: ${breakChecked ? "да" : "нет"}`);
  console.log(`запись авторства («как шла работа»): ${authorChecked ? "да" : "нет"}`);
  console.log(`проверка понимания на своём коде: ${myPredChecked ? "да" : "нет"}`);
  console.log(`мастерская (полка деталей и верстак): ${shopChecked ? "да" : "нет"}`);
  console.log(`обратное направление (задача взрослому): ${backChecked ? "да" : "нет"}`);
  console.log(`витрина «что создают ученики»: ${showChecked ? "да" : "нет"}`);
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
