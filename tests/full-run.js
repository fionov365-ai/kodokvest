/* ============================================================
   Сквозная проверка игры в настоящем DOM (jsdom).
   Что проверяем на каждом уроке с контентом:
     1. урок открывается, редактор появляется
     2. эталонное решение засчитывается — окно победы показывается
     3. заготовка НЕ засчитывается
     4. у заданий «починить» переписанный с нуля код НЕ засчитывается,
        даже если вывод правильный
     5. кнопка «Вернуть как было» есть только у заданий «починить»
   Отдельно: панель репетитора (код, статистика, снятие замков).
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
  if (!/Фионика/.test(doc.title))
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

  /* ---------- полная панель репетитора (замок — пароль взрослого) ---------- */
  g.screenAdmin();
  await tick();
  const codeInput = doc.getElementById("admcode");
  if (!codeInput) bad("[панель] экран ввода пароля не появился");
  else {
    /* пароль ещё не задан → gate предлагает придумать его */
    doc.getElementById("admcode").value = "mojparol";
    if (doc.getElementById("admcode2")) doc.getElementById("admcode2").value = "mojparol";
    /* на устройстве, где уже решались уроки, пароль просит отметку «моё» (13.09.2026) */
    if (doc.getElementById("admown")) doc.getElementById("admown").checked = true;
    doc.getElementById("admgo").click();
    await tick();
    if (doc.getElementById("admcode")){
      bad("[панель] не пустила внутрь после задания пароля");
      /* ставим пароль обходом: остальные проверки панели не должны падать
         исключением и уносить собранные ошибки (§ 4.50) */
      if (!g.state.admin.pass) g.adminPassSet("mojparol", false);
      g.adminUnlock(); g.screenAdmin(); await tick();
    }
    /* выходим и заходим снова: теперь пароль требуется */
    g.adminLock();
    g.screenAdmin();
    await tick();
    if (!doc.getElementById("admcode")) bad("[панель] повторный вход не спросил пароль");
    doc.getElementById("admcode").value = "неверный";
    doc.getElementById("admgo").click();
    await tick();
    if (doc.getElementById("admcode") === null) bad("[панель] пустила внутрь с неверным паролем");
    doc.getElementById("admcode").value = "mojparol";
    doc.getElementById("admgo").click();
    await tick();
  }
  const rows = doc.querySelectorAll(".admrowl");
  if (rows.length !== CUR.total) bad(`[панель] строк в таблице ${rows.length}, а уроков ${CUR.total}`);
  if (!doc.querySelector(".admstats")) bad("[панель] сводка не отрисовалась");
  if (!doc.getElementById("admjson")) bad("[панель] поля переноса прогресса нет");

  /* снятие замков */
  const before = g.state.admin.unlockAll;
  const unlockBtn = doc.querySelector('[data-act="unlockall"]');
  if (!unlockBtn) bad("[панель] панель не открылась — кнопки «Открыть все уроки» нет");
  else {
    unlockBtn.click();
    await tick();
    if (g.state.admin.unlockAll === before) bad("[панель] кнопка «Открыть все уроки» не переключается");
  }
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

  /* --- пароль кабинета не уходит в файл «Переноса» (13.09.2026) ---
     До 1.174.0 progressJSON отдавал состояние целиком, с admin.pass — хэшем
     пароля, открытым текстом и в файле, и в поле на экране. Хэш короткого
     пароля подбирается перебором, а файл носят по флешкам. */
  g.screenAdmin();
  await tick();
  const парольУстройства = g.state.admin.pass;
  if (!парольУстройства) bad("[панель] у панели нет пароля — проверку утечки пароля в файл не на чем делать");
  else {
    const файлПереноса = g.progressJSON();
    const поле = (doc.getElementById("admjson") || {}).value || "";
    if (файлПереноса.indexOf(парольУстройства) >= 0 || /"pass"/.test(файлПереноса))
      bad("[панель] пароль кабинета уходит в файл переноса");
    if (поле.indexOf(парольУстройства) >= 0) bad("[панель] пароль кабинета виден в поле переноса на экране");
    if (!/"stars"/.test(файлПереноса)) bad("[панель] из файла переноса пропал сам прогресс");
    /* и в состоянии устройства пароль остался — вырезан только из файла */
    if (g.state.admin.pass !== парольУстройства) bad("[панель] выгрузка файла стёрла пароль на устройстве");
    /* старый файл с чужим паролем: загрузка его не берёт и свой не теряет */
    doc.getElementById("admjson").value = JSON.stringify({ xp: 7, stars: {}, admin: { pass: "chuzhoi-hash" } });
    doc.querySelector('[data-act="import"]').click();
    await tick();
    if (g.state.admin.pass === "chuzhoi-hash") bad("[панель] загрузка файла подменила пароль кабинета чужим из файла");
    else if (g.state.admin.pass !== парольУстройства)
      bad("[панель] загрузка файла стёрла пароль кабинета — замок придумает первый вошедший");
  }

  /* загрузка файлом: заменяет прогресс целиком и оставляет рабочую форму */
  g.screenAdmin();
  await tick();
  const jsonBox = doc.getElementById("admjson");
  jsonBox.value = JSON.stringify({ xp: 125, stars: { "print-first": 3, "vars": 2 } });
  doc.querySelector('[data-act="import"]').click();
  await tick();
  if (g.state.xp !== 125) bad(`[панель] загрузка файлом не применилась: xp ${g.state.xp}`);
  if (g.state.stars.vars !== 2) bad("[панель] загрузка файлом потеряла звёзды");
  /* в нынешнем файле пароля нет вовсе — замок устройства обязан остаться */
  if (парольУстройства && g.state.admin.pass !== парольУстройства)
    bad("[панель] файл без пароля стёр пароль кабинета при загрузке — замок придумает первый вошедший");
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

    /* сброс в панели репетитора: результаты стёрты, имя и своё творчество целы */
    const res = g.clearResults(Object.assign({}, full, { name:"Аня", sandbox:"мой код" }));
    ["stars","log","warmups","ailab","days","daily","shields","projects","drawDone","gamesPlayed","drafts"]
      .forEach(k => {
        if (Object.keys(res[k] || {}).length)
          bad(`[сброс] «${k}» не сброшен панелью репетитора`);
      });
    if (res.xp !== 0 || res.badges.length) bad("[сброс] XP или бейджи не сброшены");
    if (res.name !== "Аня") bad("[сброс] имя ученика не должно стираться при сбросе прогресса");
    if (res.sandbox !== "мой код") bad("[сброс] песочница — работа ребёнка, сбросом её не трогаем");
    if (!res.games || !Object.keys(res.games).length)
      bad("[сброс] свои версии игр — работа ребёнка, сбросом их не трогаем");

    /* ⚠️ Сторож над самим сторожем. Всё, что выше, берёт список полей из
       blankProgress() — и поэтому НЕ видит поле, которое завелось само на
       первом сохранении (S.works = S.works || {}). Ровно так и вышло:
       «Мои программы» и код верстака не объявляли, blankProgress о них не
       знал, проверка полей их не перебирала, и они полтора месяца не
       приезжали на второе устройство и не стирались при смене ученика
       (найдено ревизией 18.09.2026). Поэтому сверяем не список со списком,
       а список с ИСХОДНИКОМ: каждое поле, которому где-либо присваивают
       значение, обязано быть объявлено в blankProgress. */
    const stateSrc = fs.readdirSync(path.join(root, "js"))
      .filter(f => /\.js$/.test(f))
      .map(f => fs.readFileSync(path.join(root, "js", f), "utf8")).join("\n");
    /* admin — настройки устройства (живут отдельно, на сервер не уходят),
       savedAt — отметка времени сохранения, не прогресс. */
    const notProgress = ["admin", "savedAt"];
    const assigned = {};
    (stateSrc.match(/\bS\.[A-Za-z_][A-Za-z0-9_]*\s*=[^=]/g) || []).forEach(m => {
      const name = m.replace(/^S\./, "").replace(/\s*=.*$/, "");
      if (notProgress.indexOf(name) < 0) assigned[name] = 1;
    });
    if (Object.keys(assigned).length < 20)
      bad(`[форма] проверка полей ничего не нашла в исходнике — сломался разбор`);
    Object.keys(assigned).sort().forEach(name => {
      if (!(name in blank))
        bad(`[форма] поле «S.${name}» завелось само, но не объявлено в blankProgress: ` +
            `оно не будет ни сливаться при синхронизации, ни стираться при смене ученика — ` +
            `допиши его в PROGRESS_MAPS/PROGRESS_NUMS или в blankProgress`);
    });

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
  if (badKey !== "отказ") bad("[сервер] список открылся с неверным ключом репетитора");
  /* ⚠️ Имя ребёнка на сервер НЕ уходит — и это проверяется как обещание, а не
     как мелочь. Пока на сервере лежат только код и результаты, ребёнок в нашей
     базе неопознаваем, и фраза «о ребёнке мы не храним ничего» остаётся правдой.
     Стоит положить туда имя рядом с адресом взрослого — и появляется «ребёнок
     клиента такого-то», то есть категория «несовершеннолетние».
     Разбор: docs/zanyatie-i-vzroslyj.md §§ 13–14. */
  const meRow = (lst && lst.students || []).filter(x => x.code === "test-kid")[0];
  if (!meRow) bad("[сервер] ученик не попал в список репетитора");
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
  if (!keyField) bad("[панель] нет поля для ключа репетитора");
  else {
    keyField.value = "kluch-testa";
    doc.querySelector('[data-act="listall"]').click();
    await tick(40);
    const rows = doc.querySelectorAll(".admlrow");
    if (!rows.length) bad("[панель] список учеников не отрисовался");
    else {
      const txt = Array.prototype.map.call(rows, r => r.textContent).join(" | ");
      /* Имени в списке быть не должно (его нет на сервере), а человеческая
         подпись заводится репетитором у себя и на сервер не уходит. */
      if (txt.indexOf("Миша") >= 0)
        bad("[панель] имя ребёнка показано в списке — оно не должно доезжать: " + txt.slice(0, 160));
      g.adminLabelSet("test-kid", "Петя, 5 класс");
      doc.querySelector('[data-act="listall"]').click();
      await tick(40);
      const txt2 = Array.prototype.map.call(doc.querySelectorAll(".admlrow"), r => r.textContent).join(" | ");
      if (txt2.indexOf("Петя, 5 класс") < 0)
        bad("[панель] подпись репетитора не показана: " + txt2.slice(0, 160));
      if (JSON.stringify(g.cloudSnapshot()).indexOf("Петя, 5 класс") >= 0)
        bad("[панель] подпись репетитора уехала бы на сервер — она должна жить в admin");
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

  /* --- игра по ссылке: друг открывает и сразу играет --- */
  let playChecked = 0;
  if (typeof g.playLink === "function" && GAMES.length){
    const p0 = problems.length;
    const gm = GAMES[0];

    /* ссылка собирается и разбирается обратно */
    const link = g.playLink({ title: gm.title, code: gm.code, author: "Петя", emoji: gm.emoji });
    const packed = link.split("#play=")[1] || "";
    const back = g.playUnpack(packed);
    if (!back || back.title !== gm.title || back.code !== gm.code || back.author !== "Петя")
      bad("[игра-ссылка] ссылка не разобралась обратно");
    if (g.playUnpack("мусор-не-base64")) bad("[игра-ссылка] мусор принят за игру");
    if (g.playUnpack(g.playLink({ title:"x", code:"x".repeat(5000) }).split("#play=")[1]))
      bad("[игра-ссылка] слишком длинный код принят — ссылка была бы неподъёмной");

    /* экран: сначала играют, код спрятан */
    g.screenPlay(back);
    await tick();
    const st = studioOf();
    if (!st) bad("[игра-ссылка] экран игры не открылся");
    else {
      if (!st.classList.contains("plonly"))
        bad("[игра-ссылка] код не спрятан — фокус показан с изнанки");
      const runBtn = st.querySelector('[data-role="run"]');
      if (!runBtn) bad("[игра-ссылка] нет кнопки «Новая игра»");
      else {
        runBtn.click();
        await tick();
        const con = st.querySelector(".console");
        if (!/загадал число/i.test(con.textContent || ""))
          bad("[игра-ссылка] партия не началась: " + (con.textContent || "").slice(0, 60));
        const playbar = st.querySelector(".playbar");
        if (!playbar || playbar.style.display === "none")
          bad("[игра-ссылка] игра не ждёт хода");
      }
      /* «Заглянуть в код» открывает изнанку */
      const codeBtn = doc.getElementById("plcode");
      if (!codeBtn) bad("[игра-ссылка] нет кнопки «Заглянуть в код»");
      else {
        codeBtn.click();
        await tick();
        if (st.classList.contains("plonly"))
          bad("[игра-ссылка] «Заглянуть в код» не открыла редактор");
      }
      /* «Забрать в песочницу» уносит код */
      const takeBtn = doc.getElementById("pltake");
      if (!takeBtn) bad("[игра-ссылка] нет кнопки «Забрать в песочницу»");
      else {
        takeBtn.click();
        await tick();
        if (g.state.sandbox !== gm.code)
          bad("[игра-ссылка] код не попал в песочницу");
      }
    }

    /* на экране игры есть «Отправить другу», и ссылка оттуда — играбельная */
    g.openGame(gm.id);
    await tick();
    if (!doc.getElementById("gshare"))
      bad("[игра-ссылка] на экране игры нет кнопки «Отправить игру другу»");

    /* --- игра-проект: замок, сборка, финал с игрой и ссылкой --- */
    const hang = (w.PROJECTS || []).filter(x => x.kind === "game")[0];
    if (!hang) bad("[игра-проект] в PROJECTS нет ни одной игры-проекта");
    else {
      /* замок: игра открывается собранным проектом мира, а не уроками */
      const savedUnlock = g.state.admin.unlockAll;
      g.state.admin.unlockAll = false;
      g.state.projects = {};
      if (g.projectOpen(hang)) bad("[игра-проект] игра открыта до сборки проекта мира");
      g.state.projects[hang.needs] = { step: 99, done: Date.now(), code: "" };
      if (!g.projectOpen(hang)) bad("[игра-проект] собранный проект мира не открыл игру");

      /* карточка на экране игр: заперта — с замком, открыта — кнопкой */
      g.state.projects = {};
      g.screenGames();
      await tick();
      let card = doc.querySelector('[data-proj="' + hang.id + '"]');
      if (!card) bad("[игра-проект] на экране игр нет карточки «собери свою»");
      else if (!card.disabled) bad("[игра-проект] запертая игра нажимается");
      if (!/откроется, когда собран проект/.test(doc.getElementById("app").textContent))
        bad("[игра-проект] у запертой игры не сказано, что её откроет");
      g.state.projects[hang.needs] = { step: 99, done: Date.now(), code: "" };
      g.screenGames();
      await tick();
      card = doc.querySelector('[data-proj="' + hang.id + '"]');
      if (card && card.disabled) bad("[игра-проект] открытая игра всё ещё заперта");

      /* финал: игра ИГРАЕТСЯ (режим play) и уезжает другу ссылкой */
      const fin = hang.steps[hang.steps.length - 1];
      g.state.projects[hang.id] = { step: hang.steps.length, done: Date.now(), code: fin.solution };
      g.openProject(hang.id);
      await tick(20);
      const stD = studioOf();
      if (!stD) bad("[игра-проект] финальный экран не открылся");
      else {
        const runB = stD.querySelector('[data-role="run"]');
        if (!runB || runB.textContent.indexOf("Новая игра") < 0)
          bad("[игра-проект] на финале игра не в игровом режиме — «Запустить» упадёт на input()");
        if (!doc.getElementById("pshare"))
          bad("[игра-проект] на финале нет кнопки «Отправить игру другу»");
        /* ссылка из финального кода — играбельная */
        const lnk = g.playLink({ title: hang.title, code: fin.solution, emoji: hang.emoji });
        const bk = g.playUnpack(lnk.split("#play=")[1]);
        if (!bk || bk.code !== fin.solution) bad("[игра-проект] финальный код не влезает в ссылку");
      }
      g.state.projects = {};
      g.state.admin.unlockAll = savedUnlock;
    }

    /* битая ссылка — понятный экран, а не пустота */
    g.screenPlayBroken ? (function(){})() : null;
    w.location.hash = "";
    await tick();
    g.state.sandbox = null;
    if (problems.length === p0) playChecked++;
    viewReset(g);
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

    /* «Открыть все уроки» в панели репетитора снимает и этот замок */
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

    /* выше панель репетитора включила «Открыть все уроки» — она законно
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

    /* проект открыт и мимо замка: «Открыть все уроки» в панели репетитора */
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
      const back = doc.getElementById("btn-back");
      if (!back) bad("[назад] наверху урока нет кнопки «Назад»");
      else {
        if (!/назад|к урокам|к списку|к занятию/i.test(back.textContent))
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
    /* ⚠️ Лист за курс НЕ называет себя документом об обучении. До 1.137.0 он
       печатал «Сертификат об окончании курса» — единственная строка продукта,
       которая сама объявляла себя документом об окончании (разбор
       vitrina-litsenziya-napravleniya-2026-09-09.md § 1.3). Лицензии у нас нет
       и не нужно ровно потому, что мы продаём доступ к программе, а не
       обучение с документом на выходе. */
    const ck = ((doc.querySelector("#certbox .certkind") || {}).textContent || "").trim();
    if (ck !== "Путь пройден")
      bad("[сертификат] лист за курс называется «" + ck + "», а должен — «Путь пройден»");
    /* «курс» ушёл с листа 13.09.2026: ближе к «образовательной программе» */
    if (/курс/i.test(ct)) bad("[сертификат] на листе за весь путь снова слово «курс»: " + ct.slice(0, 120));
    const docWord = /окончани|свидетельств|диплом|удостоверени|аттестат/i.exec(ct);
    if (docWord)
      bad("[сертификат] на листе за курс слово документа об образовании: «" + docWord[0] + "»");
    if (ct.toLowerCase().indexOf("не является документом об образовании") < 0)
      bad("[сертификат] на листе нет строки «Не является документом об образовании»");
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

  /* --- отчёт за неделю в панели репетитора --- */
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
    /* Смотрим только сам список «Тяжело далось» (до закрывающего </ul>).
       Дальше в карточке идёт «Вопрос за ужином», и он честно может сослаться
       на любой пройденный урок — включая лёгкую «Первую команду». Пока
       проверка читала весь остаток карточки, она падала в те даты, когда
       вопрос дня выпадал из этого урока (вопрос меняется раз в день). */
    if (/Первая команда/.test((html.split("Тяжело далось")[1] || "").split("</ul>")[0]))
      bad("[отчёт] лёгкий урок попал в трудные");
    if (!/смотрел решение/.test(html)) bad("[отчёт] не названа причина, почему урок был тяжёлым");
    if (!/Дальше по программе/.test(html)) bad("[отчёт] не сказано, что дальше");
    /* 🛡 есть и в подписи под полосой, поэтому мало искать сам значок:
       проверяем и класс клетки, и что значков стало два — в легенде и в дне */
    if (!/wrday shield/.test(html)) bad("[отчёт] день, закрытый щитом, не отмечен в полосе");
    if ((html.match(/🛡/g) || []).length < 2) bad("[отчёт] в клетке щита нет значка щита");

    /* ⚠️ День, где ребёнок сидел в тренажёре и ничего не закончил, — не прогул.
       Нашлось взглядом фаундера 12.09.2026: сетка недели рисовала «—»
       (пропуск), а карта ритма прямо под ней показывала сорок минут. Ячейка
       решалась только по days и про hours не знала. */
    {
      const hrs = []; for (let i = 0; i < 24; i++) hrs.push(0);
      hrs[17] = 40 * 60;
      const satOnly = g.weekReportHTML({
        stars:{}, log:{}, days:{}, shields:{}, hours:{ [dk(-3)]: hrs } });
      const cells = (satOnly.match(/<span class="wrn">([^<]*)<\/span>/g) || []);
      const dots = cells.filter(c => c.indexOf("·") >= 0).length;
      if (dots !== 1)
        bad("[отчёт] день со временем в тренажёре и без урока показан не точкой: " +
            cells.join(" "));
      /* и наоборот: день, где не было НИЧЕГО, остаётся прочерком.
         ⚠️ Считаем только КЛЕТКИ: «·» есть и в подписи под полосой, и первая
         версия этой проверки падала именно на легенде. */
      const nothing = g.weekReportHTML({ stars:{}, log:{}, days:{}, shields:{}, hours:{} });
      const cells0 = (nothing.match(/<span class="wrn">([^<]*)<\/span>/g) || []);
      if (!cells0.length) bad("[отчёт] полоса недели не нарисована вовсе");
      if (cells0.some(c => c.indexOf("·") >= 0))
        bad("[отчёт] пустая неделя нарисована точками вместо прочерков: " + cells0.join(" "));
    }

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
    if (!doc.querySelector(".weekrep")) bad("[отчёт] в панели репетитора его нет");

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

    /* ⚠️ ЩИТ РАБОТАЕТ МОЛЧА (план, п. 4.4). Раньше здесь проверялось обратное —
       что запас щитов ВИДЕН на экране «Сегодня». Требование перевёрнуто
       намеренно: рассказ про щиты — это разговор о том, что серия может
       оборваться, то есть ровно тот страх, который объявлен красной линией.
       Механизм цел и проверен выше; на экране его быть не должно. */
    setDays([-4, -3, -2, -1, 0]);
    g.screenToday();
    await tick();
    if (doc.querySelector(".shieldbox"))
      bad("[щит] запас щитов снова показан ребёнку — щит обязан работать молча");
    {
      const t2 = doc.getElementById("app").textContent;
      if (/щит/i.test(t2)) bad("[щит] на экране «Сегодня» снова говорят про щиты");
      /* и ни одного числа серии: ни «дней подряд», ни рекорда */
      if (/дней подряд|дня подряд|день подряд|Рекорд/i.test(t2))
        bad("[уговор] на экране «Сегодня» вернулось число серии: " +
            (t2.match(/[^.]{0,40}(дней подряд|Рекорд)[^.]{0,20}/i) || [""])[0]);
      if (!/[Уу]говор/.test(t2)) bad("[уговор] экран не говорит про уговор");
    }

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
  if (typeof g.newKidCode === "function"){
    const p0 = problems.length;
    /* включаем сервер обратно: выше его выключали для проверки офлайн-режима */
    w.CLOUD_CONFIG.url = "https://srv.invalid/fn";
    /* ⚠️ Код ученика — ключ записи на сервере, и ИМЕНИ в нём быть не должно
       (решение 13.09.2026): до 1.166.0 код был «anya-3f7a», и имя уходило на
       сервер в обход CLOUD_SKIP, а политика обещала «код с именем не связан». */
    const codes = Array.from({ length: 60 }, () => g.newKidCode());
    codes.forEach(c => { if (!w.Cloud.validCode(c)) bad("[регистрация] код ученика невалиден: " + c); });
    if (new Set(codes).size < 60) bad("[регистрация] коды повторяются — суффикс не случайный");
    if (!codes.every(c => /^[a-z]+-[a-z0-9]{5}$/.test(c))) bad("[регистрация] код не вида «слово-5знаков»: " + codes[0]);
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
    g.doRegister("Аня Тестова");
    await tick(40);
    if (!w.Cloud.myCode())
      bad("[регистрация] после регистрации нет кода ученика (hasUrl=" + w.Cloud.hasUrl() + ")");
    if (/anya|testov/.test(w.Cloud.myCode()))
      bad("[регистрация] в коде ученика снова имя: " + w.Cloud.myCode() + " — оно уйдёт на сервер ключом записи");
    if (g.state.name !== "Аня Тестова") bad("[регистрация] имя не сохранилось: " + g.state.name);
    if (g.needsRegister()) bad("[регистрация] после регистрации всё ещё требует регистрацию");
    if (problems.length === p0) regChecked++;
    viewReset(g);
  }

  /* --- вход: сначала урок, имя — после первой победы (1.138.0) ---
     ⚠️ Решение 11.09.2026. Вывеска просила имя раньше, чем показывала урок, а
     сам урок стоял мелкой ссылкой под полем. Проверяются все половины
     обещания: главная кнопка — урок; имя спрашивает карточка победы и только
     у гостя; вписанное имя СОХРАНЯЕТ сделанное. Последнее — самое дорогое:
     до 1.138.0 doRegister обнулял прогресс, и просьба «сохрани» молча стёрла
     бы ту самую победу. И обратная сторона: чужой прогресс стирается, как
     раньше, — иначе на общем компьютере двое детей смешаются в одного. */
  let entryChecked = 0;
  {
    const p0 = problems.length;
    const кодБыл = w.Cloud.myCode(), имяБыло = g.state.name;
    const звёздыБыли = g.state.stars, журналБыл = g.state.log;
    const first = CUR[0].lessons[0];
    const body = ((CONTENT || {}).world1 || {})[first.id];
    w.Cloud.forgetCode(); g.state.name = ""; g.state.stars = {}; g.state.log = {};

    /* 1. Вывеска гостю: главное действие — урок, поля до урока нет */
    g.screenAbout(); await tick(); await tick();
    const box = doc.getElementById("ldauth");
    const start = box && box.querySelector('[data-auth="try"]');
    if (!box) bad("[вход] на вывеске у гостя нет входа");
    else {
      if (box.querySelector("input"))
        bad("[вход] вывеска снова просит что-то вписать до урока — имя спрашивают после первой победы");
      if (!start || !/Начать первый урок/.test(start.textContent) || !start.classList.contains("bigbtn"))
        bad("[вход] главная кнопка вывески — не «Начать первый урок»");
    }
    /* нижняя дверь — в конце страницы; с 13.09.2026 «Я ученик» в развилке
       первого экрана тоже data-land="try", и первый попавшийся — уже не низ */
    const низ = doc.querySelector('.endright [data-land="try"]');
    if (!низ || !/Начать первый урок/.test(низ.textContent))
      bad("[вход] внизу вывески не та же дверь «Начать первый урок»");

    /* 2. Кнопка открывает первый урок — гостем, без профиля */
    if (start){
      start.click(); await tick();
      const s = g.getSession();
      if (!s || s.lesson !== first.id) bad("[вход] «Начать первый урок» открыл не первый урок");
    }

    /* 3. Победа гостя: карточка просит имя, а имя сохраняет победу */
    if (!body || !body.task || !body.task.solution)
      bad("[вход] у первого урока нет эталона — победу не устроить");
    else {
      g.openLesson(first.id); await tick();
      studioOf().editor.setCode(body.task.solution);
      studioOf().querySelector('[data-role="check"]').click();
      await tick();
      if (!won()) bad("[вход] эталон первого урока не засчитан — " + msgText());
      else {
        const inp = doc.getElementById("wsname"), go = doc.getElementById("wsgo");
        if (!inp || !go) bad("[вход] гостю после первой победы не предложили сохранить сделанное");
        else {
          /* имя из одной буквы — объяснение на месте, прогресс цел */
          inp.value = "А"; go.click(); await tick();
          if (g.state.name) bad("[вход] принято имя из одной буквы");
          if (!/две буквы/.test(doc.getElementById("wsmsg").textContent))
            bad("[вход] на слишком короткое имя нет объяснения");
          inp.value = "Аня"; go.click(); await tick(40);
          if (g.state.name !== "Аня") bad("[вход] имя из карточки победы не сохранилось: " + g.state.name);
          if (!(g.state.stars[first.id] > 0))
            bad("[вход] имя вписано — а победа стёрта: регистрация обнулила прогресс гостя");
          if (!won()) bad("[вход] после «Сохранить» карточка победы закрылась — ребёнка унесло с урока");
          if (!/Готово/.test((doc.getElementById("winsave") || {}).textContent || ""))
            bad("[вход] после «Сохранить» не сказано, что сохранено");
        }
        closeWin();
      }

      /* 4. У ребёнка с именем просьбы нет: сохранять уже есть куда */
      g.setStars(first.id, 0);
      g.openLesson(first.id); await tick();
      studioOf().editor.setCode(body.task.solution);
      studioOf().querySelector('[data-role="check"]').click();
      await tick();
      if (!won()) bad("[вход] повторная победа не засчитана — " + msgText());
      else if (doc.getElementById("wsname"))
        bad("[вход] ребёнку, у которого уже есть имя, снова предлагают его вписать");
      closeWin();
    }

    /* 5. Чужой прогресс по-прежнему стирается: новый профиль поверх ребёнка с именем.
       Имя ставим здесь же, а не берём из шага 3: иначе поломка шага 3 дала бы
       ложную жалобу ещё и тут. */
    g.state.name = "Аня";
    g.state.stars[first.id] = 3;
    g.doRegister("Боря"); await tick(40);
    if (g.state.stars[first.id])
      bad("[вход] новый профиль унаследовал прогресс другого ребёнка — на общем компьютере двое смешаются");

    if (кодБыл) w.Cloud.setCode(кодБыл); else w.Cloud.forgetCode();
    g.state.name = имяБыло; g.state.stars = звёздыБыли; g.state.log = журналБыл;
    if (problems.length === p0) entryChecked++;
    viewReset(g);
  }

  /* --- «Показать страницей»: HTML из вывода — в запертой рамке (1.140.0) ---
     ⚠️ Стережётся не красота, а обещание «ноль ПДн». Страница ребёнка — чужой
     для нас HTML: одна строка <img src="https://…"> отправила бы браузер к
     постороннему серверу. Поэтому проверяются замки (разбор в шапке
     js/studio.js): рамка без скриптов, правило безопасности РАНЬШЕ вывода и
     без сети, опасные теги из вывода мертвы. И два поведения: новый запуск
     перерисовывает открытую страницу, «Очистить» её прячет. */
  let pageChecked = 0;
  {
    const p0 = problems.length;
    const песочницаБыла = g.state.sandbox;
    g.screenSandbox(); await tick();
    const st = studioOf();
    if (!st) bad("[страница] песочница не отдала студию");
    else {
      const bar = st.querySelector(".pagebar"), btn = st.querySelector('[data-role="page"]');
      const frame = st.querySelector(".pageframe"), box = st.querySelector(".pagebox");
      const run = code => { st.editor.setCode(code); st.querySelector('[data-role="run"]').click(); };
      if (!bar || !btn || !frame || !box) bad("[страница] у вывода нет кнопки и рамки страницы");
      else {
        /* 1. Вывод без HTML — кнопки нет. <class 'int'> и сравнения — не теги */
        run("print(type(5))\nprint(2 < 3 > 1)\nprint(\"ответ: 42\")"); await tick();
        if (bar.style.display !== "none")
          bad("[страница] кнопка «Показать страницей» вышла у вывода без HTML: " + st.querySelector(".console").textContent);

        /* 2. HTML — кнопка есть, рамка заперта */
        run("print(\"<h1>Мой сайт</h1>\")\n" +
            "print(\"<img src='https://example.com/x.png'>\")\n" +
            "print(\"<script>alert(1)</script>\")\n" +
            "print(\"<meta http-equiv='refresh' content='0;url=https://example.com'>\")"); await tick();
        if (bar.style.display === "none") bad("[страница] программа напечатала HTML, а кнопки нет");
        else {
          btn.click(); await tick();
          if (box.style.display === "none") bad("[страница] кнопка не открыла страницу");
          if (!frame.hasAttribute("sandbox"))
            bad("[страница] у рамки нет sandbox — чужой HTML выполняется как свой");
          else if (/\ballow-scripts\b/.test(frame.getAttribute("sandbox")))
            bad("[страница] в рамке разрешены скрипты — вместе с allow-same-origin это ключи от всего продукта");
          const src = frame.getAttribute("srcdoc") || "";
          const тело = src.indexOf("<body>");
          if (src.indexOf("<h1>Мой сайт</h1>") < 0) bad("[страница] в страницу не попал вывод программы");
          const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(src);
          if (!csp || !/default-src 'none'/.test(csp[1]))
            bad("[страница] у страницы нет правила «из сети ничего» — картинка с чужого адреса загрузится");
          else {
            if (/-src[^;]*(https?:|\*)/.test(csp[1]))
              bad("[страница] правило безопасности пускает в сеть: " + csp[1]);
            if (src.indexOf(csp[0]) > тело)
              bad("[страница] правило безопасности стоит после вывода — до него всё уже загрузится");
          }
          if (/<script/i.test(src.slice(тело)))
            bad("[страница] тег script из вывода попал в страницу живым");
          if (/<meta http-equiv='refresh'/i.test(src))
            bad("[страница] meta refresh из вывода живой — он увёл бы рамку на чужой адрес");

          /* 3. Новый запуск перерисовывает открытую страницу */
          run("print(\"<h2>Вторая версия</h2>\")"); await tick();
          if ((frame.getAttribute("srcdoc") || "").indexOf("Вторая версия") < 0)
            bad("[страница] после нового запуска рамка показывает старую страницу");

          /* 4. «Очистить» прячет и кнопку, и страницу */
          st.querySelector('[data-role="reset"]').click(); await tick();
          if (bar.style.display !== "none" || box.style.display !== "none")
            bad("[страница] «Очистить» оставил страницу от прошлого запуска");
        }
      }
    }
    g.state.sandbox = песочницаБыла;
    if (problems.length === p0) pageChecked++;
    viewReset(g);
  }

  /* --- раздел «HTML и CSS» (1.141.0) ---
     ⚠️ Судья здесь — не человек и не наш Python, а разбор страницы, и его
     ошибка молчит: задание, которое принимает заготовку, «решается» без
     единой строки, а задание, которое не принимает эталон, не решается никем.
     Поэтому по КАЖДОМУ заданию: эталон проходит все проверки, заготовка и
     пример — нет (пример «про другое» не должен становиться ответом —
     правило подсказок, memory/hints-philosophy). Плюс сам разборщик CSS, путь
     по экрану и сертификат раздела. */
  let webChecked = 0;
  {
    const p0 = problems.length;
    const WB = w.WEB, TS = w.WEB_TASKS || [], TP = w.WEB_TOPICS || [];
    if (!WB || !TS.length) bad("[html] раздела нет: судья или задания не подключены");
    else {
      if (TS.length < 20) bad("[html] заданий меньше двадцати: " + TS.length);
      TP.forEach(tp => {
        const n = TS.filter(t => t.topic === tp.id).length;
        if (n < 5) bad("[html] в теме «" + tp.title + "» " + n + " заданий — меньше пяти");
      });
      const ids = {};
      TS.forEach(t => {
        if (!/^web-/.test(t.id))
          bad("[html] id «" + t.id + "» без приставки web- — пересечётся с задачами экзамена в S.algo");
        if (ids[t.id]) bad("[html] id «" + t.id + "» повторяется");
        ids[t.id] = 1;
        if (!TP.some(tp => tp.id === t.topic)) bad("[html] у «" + t.id + "» нет темы");
        ["id","emoji","title","intro","goal","learn","example","starter","solution","note"].forEach(f => {
          if (!t[f]) bad("[html] у «" + t.id + "» пустое поле «" + f + "»");
        });
        if (!Array.isArray(t.checks) || t.checks.length < 3) bad("[html] у «" + t.id + "» меньше трёх проверок");
        if (!Array.isArray(t.hints) || t.hints.length < 3) bad("[html] у «" + t.id + "» меньше трёх подсказок");
        const упало = WB.judge(t, t.solution).filter(x => !x.ok).map(x => x.t);
        if (упало.length) bad("[html] эталон «" + t.id + "» не проходит: " + упало.join("; "));
        if (WB.passed(WB.judge(t, t.starter)))
          bad("[html] заготовка «" + t.id + "» уже проходит все проверки — задание сдаётся само");
        if (WB.passed(WB.judge(t, t.example)))
          bad("[html] пример в «" + t.id + "» проходит все проверки — пример стал ответом");
      });

      /* разборщик CSS: комментарии, @import, @media и список селекторов */
      const r = WB.parseCSS("/* x */ @import url(a.css); h1 { color: red; } " +
                            "@media (max-width: 500px) { p { font-size: 12px } } .a, .b{margin:0}");
      if (r.map(x => x.sel).join("|") !== "h1|p|.a, .b")
        bad("[html] разборщик CSS ошибся: " + JSON.stringify(r.map(x => x.sel)));
      const W = WB.make('<style>p{color:red} .x{color:blue}</style>' +
                        '<div style="color:green"><p class="x">a</p><span>b</span></div>');
      if (W.css(W.q("p"), "color") !== "blue")
        bad("[html] судья не учёл порядок правил: у p вышло «" + W.css(W.q("p"), "color") + "»");
      if (W.css(W.q("span"), "color", true) !== "green")
        bad("[html] судья не учёл наследование цвета от родителя");
      if (W.css(W.q("span"), "color") !== null)
        bad("[html] без наследования у span цвета быть не должно");
      if (WB.make("<p>без стилей</p>").css(null, "color") !== null)
        bad("[html] судья падает или врёт на отсутствующем элементе");

      /* экран: список → задание → неудача → эталон → разбор */
      const algoБыл = JSON.parse(JSON.stringify(g.state.algo || {}));
      const certБыл = JSON.parse(JSON.stringify(g.state.certAt || {}));
      g.state.algo = {};
      const t0 = TS[0];
      g.screenWeb(); await tick();
      if (doc.querySelectorAll("[data-wb]").length !== TS.length)
        bad("[html] в списке " + doc.querySelectorAll("[data-wb]").length + " заданий из " + TS.length);
      const c0 = doc.querySelector('[data-wb="' + t0.id + '"]');
      if (!c0) bad("[html] карточки первого задания нет");
      else {
        c0.click(); await tick();
        const ta = doc.getElementById("wbcode"), fr = doc.querySelector(".wbframe");
        if (!ta || !fr) bad("[html] у задания нет поля кода или окна страницы");
        else {
          const sb = fr.getAttribute("sandbox") || "";
          if (!fr.hasAttribute("sandbox") || /allow-scripts/.test(sb))
            bad("[html] окно страницы не заперто: sandbox=«" + sb + "»");
          if ((fr.getAttribute("srcdoc") || "").indexOf("default-src 'none'") < 0)
            bad("[html] окно страницы без правила «из сети ничего»");
          if (doc.querySelectorAll("#wbchecks li").length !== t0.checks.length)
            bad("[html] требований на экране не столько, сколько проверок");
          doc.getElementById("wbcheck").click(); await tick();
          if (g.algoDone(t0.id)) bad("[html] заготовка засчитана");
          if (!doc.querySelector("#wbchecks li.bad"))
            bad("[html] после неудачной проверки не отмечено, чего не хватает");
          const ta2 = doc.getElementById("wbcode");
          ta2.value = t0.solution;
          ta2.dispatchEvent(new w.Event("input"));
          doc.getElementById("wbcheck").click(); await tick();
          if (!g.algoDone(t0.id))
            bad("[html] эталон не засчитан: " + ((doc.getElementById("wbmsg") || {}).textContent || ""));
          if (!/Разбор/.test(doc.getElementById("app").textContent))
            bad("[html] после решения не открылся разбор");
          if (g.place() !== "web") bad("[html] экран задания стоит не на своём месте: " + g.place());
        }
      }

      /* сертификат раздела: не на половине, да на всех */
      if (g.certSectionReady("web")) bad("[html] сертификат выдан за одно задание");
      TS.forEach(t => { g.state.algo[t.id] = 1; });
      if (!g.certSectionReady("web")) bad("[html] сертификат не выдан, хотя сделаны все задания");

      g.state.algo = algoБыл; g.state.certAt = certБыл;
    }
    if (problems.length === p0) webChecked++;
    viewReset(g);
  }

  /* --- пакет к защите проекта (1.142.0) ---
     ⚠️ Стережётся обещание со страницы /individualnyi-proekt/ и три вещи,
     которые ломаются молча:
       1) документы собираются по ВСЕМ одиннадцати проектам, а не по тому,
          на котором их смотрели глазами (у игр input(), у «Напарника» свои
          редакции шагов);
       2) даты шагов и запись работы пишутся при сдаче шага и ПЕРЕЖИВАЮТ
          слияние — объект проекта там собирается перечислением полей;
       3) пакет не хранит школу, класс и руководителя — это ПДн. */
  let defChecked = 0;
  {
    const p0 = problems.length;
    const PR = w.PROJECTS || [];
    const projБыл = JSON.parse(JSON.stringify(g.state.projects || {}));
    const defБыл = JSON.parse(JSON.stringify(g.state.defense || {}));
    const unlockБыл = g.state.admin.unlockAll;
    if (typeof g.screenDefense !== "function" || !g.DEFENSE_DOCS) bad("[защита] пакета нет");
    else {
      if (g.DEFENSE_DOCS.length !== 5) bad("[защита] документов не пять: " + g.DEFENSE_DOCS.length);

      /* 1. все пять документов по каждому проекту */
      PR.forEach(p => {
        g.state.projects[p.id] = { step: p.steps.length, done: 1, doneAt: 5000, aiAt: -1,
          code: p.steps[p.steps.length - 1].solution, stepsAt: [], tr: [] };
        g.DEFENSE_DOCS.forEach(dd => {
          const h = g.defenseDocHTML(dd.id, p.id) || "";
          if (h.indexOf("docpage") < 0) bad("[защита] «" + dd.title + "» для «" + p.title + "» пустой");
          if (/списал/i.test(h)) bad("[защита] в «" + dd.title + "» слово «списал» — этого продукт себе не позволяет");
          /* тексты шагов — HTML с сущностями; экранированные второй раз, они
             покажут «&lt;h1&gt;» буквами */
          if (/&amp;(lt|gt|quot);/.test(h))
            bad("[защита] в «" + dd.title + "» для «" + p.title + "» текст экранирован дважды");
        });
        const pass = g.defenseDocHTML("passport", p.id);
        p.steps.forEach(s => {
          if (pass.indexOf(s.title) < 0) bad("[защита] в паспорте «" + p.title + "» нет шага «" + s.title + "»");
        });
        const rows = (g.defenseDocHTML("protocol", p.id).match(/<tr/g) || []).length;
        if (rows !== p.steps.length + 1)
          bad("[защита] в протоколе «" + p.title + "» строк " + rows + ", а шагов " + p.steps.length);
        const slides = (g.defenseDocHTML("slides", p.id).match(/class="docpage docslide/g) || []).length;
        if (slides < 7) bad("[защита] в презентации «" + p.title + "» всего " + slides + " слайдов");
        /* Вопросы комиссии с посчитанным ответом. ⚠️ Первая версия брала
           механизм «Спросите вслух» и не дала ответа НИ ОДНОМУ проекту — на
           экране при этом было обещано. У программы без случайности (два
           прогона совпали) хоть один посчитанный ответ обязан быть. */
        const last = p.steps[p.steps.length - 1], R = w.Runtime.get("mini");
        const o1 = R.run(last.solution, { stdin: (last.stdin || []).slice() }).output;
        const o2 = R.run(last.solution, { stdin: (last.stdin || []).slice() }).output;
        const ans = (g.defenseDocHTML("speech", p.id).match(/class="docans"/g) || []).length;
        if (o1 && String(o1).trim() && o1 === o2 && ans < 1)
          bad("[защита] в речи «" + p.title + "» нет вопроса с посчитанным ответом, хотя программа без случайности");
      });

      /* 2. слова ребёнка попадают в документы; ПДн в хранилище нет */
      const p1 = PR[0];
      g.screenDefense(p1.id); await tick();
      if (w.location.hash !== "#defense=" + p1.id)
        bad("[защита] у пакета нет своего адреса: «" + w.location.hash + "»");
      const ta = doc.querySelector('[data-def="actual"]');
      if (!ta) bad("[защита] на экране нет поля «Актуальность»");
      else {
        ta.value = "Мне нравятся игры про героев";
        ta.dispatchEvent(new w.Event("input"));
        if (g.defenseDocHTML("passport", p1.id).indexOf("Мне нравятся игры про героев") < 0)
          bad("[защита] слова ребёнка не попали в паспорт");
      }
      const keys = Object.keys((g.state.defense || {})[p1.id] || {});
      if (keys.some(k => /school|mentor|teacher|grade|class|klass/i.test(k)))
        bad("[защита] пакет хранит школу, класс или руководителя — это персональные данные: " + keys.join(","));
      if (g.defenseDocHTML("passport", p1.id).indexOf("docinline") < 0)
        bad("[защита] для руководителя нет пустой строки — значит, его где-то взяли");

      /* 3. документ открывается слоем и закрывается */
      const b = doc.querySelector('[data-doc="passport"]');
      if (!b) bad("[защита] нет кнопки открыть паспорт");
      else {
        b.click(); await tick();
        const ov = doc.getElementById("doc");
        if (!ov || ov.hidden) bad("[защита] документ не открылся");
        else {
          if (!/Паспорт проекта/.test(doc.getElementById("docbox").textContent))
            bad("[защита] в открытом документе не паспорт");
          doc.getElementById("docclose").click();
          if (!ov.hidden) bad("[защита] документ не закрылся");
        }
      }
      if (html.indexOf("body>.doc:not([hidden])") < 0)
        bad("[защита] в стилях нет правила печати документов — на бумагу уйдёт вся страница");

      /* 4. несобранный проект пакета не даёт */
      delete g.state.projects[PR[1].id];
      g.screenDefense(PR[1].id); await tick();
      if (doc.querySelector("[data-doc]")) bad("[защита] пакет открылся у несобранного проекта");
      if (g.defenseDocHTML("passport", PR[1].id)) bad("[защита] документ собрался по несобранному проекту");

      /* 5. дата шага и запись работы пишутся при сдаче шага */
      g.state.admin.unlockAll = true;
      /* Попутная находка сборки пакета: экран проекта экранировал тексты шагов
         второй раз, и в «Своём сайте» ребёнок видел «&lt;h1&gt;». */
      const pw5 = PR.find(p => p.id === "project-w5");
      if (pw5){
        g.openProject(pw5.id, 0); await tick(); await tick();
        const goalT = (doc.querySelector(".goal") || {}).textContent || "";
        if (goalT.indexOf("<h1>") < 0 || goalT.indexOf("&lt;") >= 0)
          bad("[защита] на экране «Своего сайта» тег показан не как «<h1>»: " + goalT.slice(0, 160));
        viewReset(g); await tick();
      }
      delete g.state.projects[p1.id];
      g.openProject(p1.id, 0); await tick();
      const pst = studioOf();
      if (!pst) bad("[защита] шаг проекта не открылся");
      else {
        pst.editor.setCode(p1.steps[0].solution);
        pst.querySelector('[data-role="check"]').click(); await tick();
        const ps = g.state.projects[p1.id] || {};
        if (!ps.stepsAt || !ps.stepsAt[0]) bad("[защита] у сданного шага нет даты");
        if (!ps.tr || !ps.tr[0]) bad("[защита] у сданного шага нет записи работы");
        closeWin();
      }

      /* 6. слияние: даты и запись по шагам — ранние, слова — свежие */
      const m = g.mergeProgress(
        { projects:{ x:{ step:2, stepsAt:[500, 900], tr:[{ at:500, typed:10 }] } }, savedAt:1 },
        { projects:{ x:{ step:2, stepsAt:[700, 800], tr:[{ at:700, typed:99 }, { at:800, typed:5 }] } }, savedAt:2 });
      const mx = m.projects.x;
      if (!mx.stepsAt || mx.stepsAt[0] !== 500 || mx.stepsAt[1] !== 800)
        bad("[защита] слияние потеряло или перепутало даты шагов: " + JSON.stringify(mx.stepsAt));
      if (!mx.tr || !mx.tr[0] || mx.tr[0].typed !== 10 || !mx.tr[1])
        bad("[защита] слияние потеряло запись работы по шагам: " + JSON.stringify(mx.tr));
      const md = g.mergeProgress({ defense:{ p:{ actual:"старое", at:1 } }, savedAt:1 },
                                 { defense:{ p:{ actual:"новое", at:2 } }, savedAt:2 });
      if (!md.defense || !md.defense.p || md.defense.p.actual !== "новое")
        bad("[защита] слияние взяло не свежие слова к защите");
    }
    g.state.projects = projБыл; g.state.defense = defБыл; g.state.admin.unlockAll = unlockБыл;
    if (problems.length === p0) defChecked++;
    viewReset(g);
  }

  /* --- Главный экран сложен из карточек ---
     ⚠️ Проверка стережёт ровно то, чего не видит ни один другой тест и не
     видно глазами на экране. Карточке отдаётся только то, что она назвала в
     needs. Забыл там имя — карточка получит undefined, и это НЕ падение:
     `onclick = undefined` тихо оставляет кнопку мёртвой. Экран нарисуется
     целиком, тесты пройдут, а кнопка перестанет отвечать — ровно та ошибка,
     которую 08.09.2026 поймал не тест, а руки. Поэтому сверяем объявленное с
     тем, что карточка трогает на самом деле, по её же исходнику.
     Заодно ловим лишнее в needs: имя, которое карточка не трогает, — это
     разрешение, выданное на всякий случай, а такие и превращают узкий доступ
     обратно в широкий. */
  let cardsChecked = 0, contractsChecked = 0;
  if (Array.isArray(g.homeCards)){
    const p0 = problems.length;
    const CARDS = g.homeCards;
    if (CARDS.length < 5) bad("[главный] карточек подозрительно мало: " + CARDS.length);
    const seen = {};
    CARDS.forEach(c => {
      if (!c.id) return bad("[главный] у карточки нет id");
      if (seen[c.id]) bad("[главный] две карточки с одним id: " + c.id);
      seen[c.id] = 1;
      if (!Array.isArray(c.needs)) return bad("[главный] карточка «" + c.id + "» не объявила needs");
      if (typeof c.html !== "function") bad("[главный] у карточки «" + c.id + "» нет разметки");
      /* исходник без комментариев: «A.что-то» внутри пояснения — не обращение */
      const src = (String(c.html) + (c.wire ? String(c.wire) : ""))
        .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
      const used = [...new Set([...src.matchAll(/\bA\.([A-Za-z_$][\w$]*)/g)].map(m => m[1]))];
      const missing = used.filter(n => c.needs.indexOf(n) < 0);
      const extra = c.needs.filter(n => used.indexOf(n) < 0);
      if (missing.length)
        bad("[главный] карточка «" + c.id + "» трогает необъявленное: " + missing.join(", ") +
            " — она получит undefined, и кнопка молча умрёт");
      if (extra.length)
        bad("[главный] карточка «" + c.id + "» объявила лишнее: " + extra.join(", ") +
            " — узкий доступ так снова станет широким");
      /* ⚠️ И главное число: ни одна карточка не должна знать столько, сколько
         знал весь экран до разреза. Порог не круглый — он взят из замера:
         самая крупная карточка знает 14 имён, и рост выше двадцати означает,
         что внутри неё опять слиплись две. */
      if (c.needs.length > 20)
        bad("[главный] карточка «" + c.id + "» знает про " + c.needs.length +
            " вещей — это снова тот самый экран, который резали");
    });
    if (problems.length === p0) cardsChecked++;
  }

  /* --- контракты экранов: ничто не приезжает в модуль как undefined ---
     ⚠️ Та же тихая смерть кнопки, что у карточек Главного, но с другой
     стороны. Экраны уехали в js/screens-*.js и получают всё через контракт
     `KVSCREENS.имя({ … })`. Если поле передано ЗНАЧЕНИЕМ (`copyText: copyText`),
     а сама переменная присваивается НИЖЕ по файлу (`var copyText = ACCOUNT.…`
     после разреза профиля), то в модуль приезжает undefined. Ничего не падает:
     `A.copyText(...)` бросит ошибку лишь когда ребёнок нажмёт кнопку, а в
     тестах эту кнопку никто не жмёт. Так и стояла мёртвой «Скопировать
     ссылку» в песочнице (найдено ревизией 18.09.2026, § 4.40).
     Лечится обёрткой: `copyText: function(t, b){ return copyText(t, b); }` —
     она смотрит на переменную в момент ВЫЗОВА, когда та уже присвоена.
     ⚠️ Объявления через `function имя(){}` поднимаются наверх сами (hoisting)
     и в контракте значением безопасны — их не трогаем. */
  {
    const p0 = problems.length;
    /* комментарии гасим пробелами, чтобы смещения не сдвинулись */
    const cleanApp = fs.readFileSync(path.join(root, "js/app.js"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/./g, " "));
    const declOf = name => {
      const f = cleanApp.search(new RegExp("\\bfunction\\s+" + name + "\\s*\\("));
      if (f >= 0) return { off: f, hoisted: true };
      /* имя может стоять не сразу за var: `var a = X, name = Y` */
      const v = cleanApp.search(new RegExp("\\b" + name + "\\s*=[^=]"));
      return v >= 0 ? { off: v, hoisted: false } : null;
    };
    const contracts = [...cleanApp.matchAll(/KVSCREENS\.([A-Za-z_$][\w$]*)\s*\(\s*\{/g)];
    if (contracts.length < 15)
      bad("[контракт] контрактов экранов найдено всего " + contracts.length + " — сломался разбор");
    contracts.forEach(mc => {
      const open = cleanApp.indexOf("{", mc.index + mc[0].length - 1);
      let depth = 0, end = open;
      for (; end < cleanApp.length; end++){
        if (cleanApp[end] === "{") depth++;
        else if (cleanApp[end] === "}"){ depth--; if (!depth) break; }
      }
      const body = cleanApp.slice(open, end + 1);
      [...body.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)\s*(?=[,}])/g)].forEach(p => {
        const key = p[1], val = p[2];
        if (["function","true","false","null","undefined"].indexOf(val) >= 0) return;
        const d = declOf(val);
        if (!d) return;            /* имя из другого файла — не наша забота */
        if (!d.hoisted && d.off > mc.index)
          bad("[контракт] «" + mc[1] + "» получает «" + key + ": " + val + "» значением, " +
              "а " + val + " присваивается ниже по файлу — в модуль приедет undefined, " +
              "и кнопка молча умрёт. Передавай обёрткой: " + key +
              ": function(){ return " + val + "(…); }");
      });
    });
    if (problems.length === p0) contractsChecked++;
  }

  /* --- из приложения есть дорога на сайт ---
     ⚠️ До 1.132.0 её не было ни одной: страницы витрины существовали, лежали
     в sitemap.xml, а попасть на них из продукта было нельзя. Такую пропажу
     не видно ни на одном экране — всё нарисовано, всё работает, просто одной
     двери нет. Поэтому её стережёт тест.
     ⚠️ И отдельно — форма пути. Сайт живёт по адресу вида .../kodokvest/, и
     ссылка с ведущей косой чертой увела бы в корень домена, то есть в никуда.
     Ошибка тихая: на своём домене она заработает, а на нынешнем адресе нет. */
  let siteLinkChecked = 0;
  if (typeof g.aboutFootHTML === "function"){
    const p0 = problems.length;
    const foot = g.aboutFootHTML();
    const hrefs = [...foot.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    if (!hrefs.length) bad("[сайт] из подвала приложения нет ни одной ссылки на витрину");
    ["vitrina/", "repetitoru/", "semeynoe-obuchenie/"].forEach(need => {
      if (hrefs.indexOf(need) < 0)
        bad("[сайт] из приложения не попасть на страницу «" + need + "»");
    });
    hrefs.forEach(h => {
      if (h.charAt(0) === "/")
        bad("[сайт] ссылка «" + h + "» начинается с косой черты — на адресе вида " +
            ".../kodokvest/ она ведёт в корень домена, то есть в никуда");
    });
    /* и дорога должна быть видна на самом экране, а не только в функции */
    g.screenWorlds(); await tick();
    if (!doc.querySelector("#app .footlinks a"))
      bad("[сайт] на Главном экране ссылок на витрину не видно");
    if (problems.length === p0) siteLinkChecked++;
    viewReset(g);
  }

  /* --- адрес следует за экраном, и он же приводит обратно ---
     ⚠️ Это проверка на КЛАСС ошибок, и заведена она потому, что до 1.136.0
     таблиц адресов было две. Читающая (`HASH_SCREENS`) знала 24 адреса,
     пишущей не было вовсе — одиннадцать экранов присваивали `location.hash`
     руками. Расхождение двух списков не видно ничем: экран рисуется, продукт
     работает, просто ссылка ведёт не туда или «Назад» выбрасывает наружу.
     Теперь таблица одна, и тест требует от неё КРУГООБОРОТА: зашли на
     экран кнопкой — адрес обязан стать таким, по которому этот же экран
     открывается. Обе половины проверяются друг о друга, а не о наш список
     рядом (правило § 4.6: списки экранов собираются по регистрации).
     Ловушка, оплаченная при написании: у одного экрана не должно быть двух
     адресов. `#help` и `#guide` — один экран, и второй помечен `alias`,
     иначе кругооборот не сходится: пишем один адрес, а читаем другой. */
  let routeChecked = 0;
  if (Array.isArray(g.ROUTES)){
    const p0 = problems.length;
    /* ⚠️ Эта проверка ходит по ВСЕМУ продукту: открывает каждый экран, входит
       в кабинеты по паролю и сдаёт урок. Значит она пачкает состояние сильнее
       любой другой, а стоит рано — до тридцати проверок, которые начинают
       падать не по своей вине (роль админа рисует на Главном кабинет, а
       начатый урок гасит карточку «запиши код»).
       Поэтому снимок состояния целиком до и восстановление целиком после.
       Найдено не рассуждением: первый заход уронил 31 чужую проверку. */
    const снимок = JSON.parse(JSON.stringify(g.state));
    const хэшБыл = w.location.hash || "";
    /* ⚠️ Код ученика живёт НЕ в state, а в localStorage, и `becomeAdmin()`
       стирает его нарочно: устройство взрослого не должно оставаться
       залогиненным ребёнком. Снимка состояния для него мало — вернуть код
       надо отдельно, иначе следующая проверка не найдёт, что напоминать
       записать. Стоило тридцати минут: снимок был полный, а падало всё равно. */
    const кодБыл = w.Cloud.myCode();
    /* И замок: он живёт в sessionStorage, отдельно и от state, и от кода.
       Закрыть его безусловно — тоже правка чужого состояния: следующая
       проверка входит в кабинет взрослого и ждёт его открытым. */
    const замокБыл = g.adminUnlocked();
    g.adminPassSet("1234"); g.becomeAdmin(); g.adminUnlock();
    /* Исходники читаем здесь же: экраны живут в разных файлах, и место может
       быть занято не в app.js, а в variant.js, home.js, sandbox.js... */
    const appSrc = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
    const otherSrc = fs.readdirSync(path.join(root, "js"))
      .filter(f => /\.js$/.test(f) && f !== "app.js")
      .map(f => fs.readFileSync(path.join(root, "js", f), "utf8")).join("\n");

    if (g.ROUTES.length < 20) bad("[адрес] маршрутов подозрительно мало: " + g.ROUTES.length);

    const seenHash = {}, seenPlace = {};
    g.ROUTES.forEach(r => {
      if (!r.h || r.h.charAt(0) !== "#") bad("[адрес] у маршрута нет адреса: " + JSON.stringify(r.h));
      if (!r.place) bad("[адрес] у маршрута «" + r.h + "» нет места для помощи «?»");
      if (typeof r.open !== "function") bad("[адрес] маршрут «" + r.h + "» ничего не открывает");
      if (seenHash[r.h]) bad("[адрес] два маршрута с адресом " + r.h);
      seenHash[r.h] = 1;
      /* одно место — один адрес; второй обязан быть помечен alias */
      if (!r.alias){
        if (seenPlace[r.place])
          bad("[адрес] у места «" + r.place + "» два адреса (" + seenPlace[r.place] + " и " + r.h +
              ") — пишем один, читаем другой, и ссылка ведёт не туда. Пометь второй alias");
        seenPlace[r.place] = r.h;
      }
      /* ⚠️ Место должно быть настоящим: помощь «?» ищет текст по нему же.
         Опечатка здесь молчит — просто адрес не запишется никогда. */
      if (r.place && !new RegExp('curPlace = "' + r.place + '"').test(appSrc) &&
          !new RegExp('enterScreen\\([^)]*"' + r.place + '"').test(appSrc) &&
          !new RegExp('"' + r.place + '"').test(otherSrc))
        bad("[адрес] маршрут «" + r.h + "» назвал место «" + r.place +
            "», а такого места ни один экран не занимает — адрес не запишется никогда");
    });

    /* --- сам кругооборот ---
       ⚠️ Спрашиваем не «куда просили», а «где оказались»: часть маршрутов
       ПЕРЕАДРЕСУЕТ по роли устройства, и это не ошибка, а замысел. `#adult`
       на устройстве взрослого открывает его кабинет, а не занятийную рамку
       ребёнка. Требовать в таком случае адрес `#adult` было бы требованием
       соврать. Правило поэтому одно и оно сильнее: **адрес всегда описывает
       ТОТ экран, на котором человек стоит** — куда бы его ни переадресовали.
       И обратно: по этому адресу он попадёт туда же. */
    const адресМеста = place => {
      const r = g.ROUTE_BY_PLACE[place];
      return r ? r.h : "";
    };
    for (const r of g.ROUTES){
      if (r.alias) continue;
      w.location.hash = "";
      let place = null;
      try { r.open(); await tick(); place = g.place(); }
      catch(e){ bad("[адрес] маршрут «" + r.h + "» не открылся: " + e.message); continue; }
      const надо = адресМеста(place);
      if ((w.location.hash || "") !== надо)
        bad("[адрес] после «" + r.h + "» человек стоит на месте «" + place + "», а адрес — «" +
            (w.location.hash || "(пусто)") + "» вместо «" + (надо || "(пусто)") +
            "». Такую ссылку продиктовать нельзя, и обновление страницы уведёт не туда");
      /* и обратно: тот же адрес обязан привести на то же место */
      w.location.hash = r.h;
      if (!g.routeHash())
        bad("[адрес] по адресу «" + r.h + "» ничего не открылось, хотя он в таблице");
      else {
        await tick();
        if (g.place() !== place)
          bad("[адрес] круг не замкнулся: заход на «" + r.h + "» привёл на «" + place +
              "», а тот же адрес по ссылке — на «" + g.place() + "»");
      }
      viewReset(g);
      g.adminUnlock();
    }

    /* --- заголовок вкладки следует за экраном --- */
    w.location.hash = "";
    g.screenGames(); await tick();
    if (!/Игры/.test(doc.title))
      bad("[адрес] заголовок вкладки не сменился на «Игры»: " + doc.title);
    if (doc.title === g.BASE_TITLE)
      bad("[адрес] заголовок вкладки остался общим на всех экранах — так было до 1.136.0");

    /* --- заголовок ставится и при заходе ПО АДРЕСУ, а не только кнопкой ---
       ⚠️ Ровно эта ошибка и была, и тест её не видел: он ходил по экранам
       кнопками, а тогда адрес МЕНЯЕТСЯ и заголовок ставился попутно. Стоило
       открыть присланную ссылку, где адрес уже нужный, — запись отваливалась
       ранним выходом и уносила заголовок с собой. Нашлось нажатием. */
    w.location.hash = "#games";
    g.routeHash(); await tick();
    doc.title = "затёрто";
    g.routeHash(); await tick();
    if (!/Игры/.test(doc.title))
      bad("[адрес] заход по готовому адресу не поставил заголовок вкладки: " + doc.title);
    w.location.hash = ""; viewReset(g);

    /* --- урок: самый нужный адрес во всём продукте --- */
    const l0 = w.CURRICULUM[0].lessons[0];
    g.openLesson(l0.id); await tick(60);
    if (w.location.hash !== "#lesson=" + l0.id)
      bad("[адрес] у урока нет своего адреса: «" + w.location.hash + "» вместо «#lesson=" +
          l0.id + "» — именно эту ссылку репетитор диктует ученику");
    if (doc.title.indexOf(l0.title) < 0)
      bad("[адрес] заголовок вкладки урока не назвал урок: " + doc.title);
    if (!g.routeHash()) bad("[адрес] адрес урока не открывает урок обратно");
    await tick(60);
    if (g.place() !== "lesson") bad("[адрес] адрес урока привёл не на урок: " + g.place());

    /* --- номер экзамена с сетки на витрине (24.09.2026) ---
       Кружок на /vitrina/ ведёт на #exam=oge-16. Обещание сетки — «нажмите
       номер, откроется задача»; серый номер обязан открыть карту, а не пустоту. */
    for (const [адрес, куда] of [["#exam=oge-16", "algoone"], ["#exam=ege-27", "algoone"],
                                 ["#exam=oge-15", "robot"], ["#exam=oge-13", "algo"], ["#exam=oge-99", "algo"]]){
      w.location.hash = адрес;
      if (!g.routeHash()) bad("[сетка-экзамена] адрес " + адрес + " не разобран");
      await tick(60);
      if (g.place() !== куда)
        bad("[сетка-экзамена] " + адрес + " привёл на «" + g.place() + "», а не на «" + куда + "»");
    }
    /* серый номер открыл карту на вкладке ОГЭ — вернуть «Темы», иначе
       следующие проверки раздела найдут не ту вкладку */
    if (typeof g.openExamMap === "function"){ g.openExamMap("all"); await tick(); }
    w.location.hash = ""; viewReset(g);

    /* --- [тур]: три шага по первому уроку (24.09.2026) ---
       Один раз, только тому, у кого не пройден ни один урок; шаги по очереди
       подсвечивают настоящие места; «Понятно», «Пропустить» и Esc закрывают
       навсегда; уход с урока убирает тур, не отмечая его увиденным. */
    {
      const звёзды = JSON.parse(JSON.stringify(g.state.stars || {}));
      const ls = w.localStorage, КЛЮЧ = "kodokvest_tour1", былоЛс = ls.getItem(КЛЮЧ);
      const карта = () => doc.getElementById("tourcard");
      const шаг = () => (карта() ? карта().querySelector(".tourstep").textContent : "нет");
      const далее = () => карта().querySelector('[data-tour="next"]').click();
      const урок = async () => { g.openLesson(w.CURRICULUM[0].lessons[0].id); await tick(80); };
      g.state.stars = {}; ls.removeItem(КЛЮЧ);
      await урок();
      if (шаг() !== "Шаг 1 из 3") bad("[тур] новичку на первом уроке тур не показан: " + шаг());
      else {
        if (!doc.querySelector(".lcol-read .tourhl")) bad("[тур] первый шаг не подсветил объяснение");
        const hb = doc.querySelector(".howbar");
        if (hb && hb.style.display !== "none") bad("[тур] полоска «Что дальше» видна одновременно с туром");
        далее(); далее();
        if (шаг() !== "Шаг 3 из 3" || !doc.querySelector('#studio [data-role="check"].tourhl'))
          bad("[тур] третий шаг не на кнопке «Проверить»: " + шаг());
        далее();
        if (карта()) bad("[тур] «Понятно» не закрыло тур");
        if (ls.getItem(КЛЮЧ) !== "1") bad("[тур] пройденный тур не отмечен — придёт снова");
        if (doc.querySelectorAll(".tourhl").length) bad("[тур] после конца осталась подсветка");
        await урок();
        if (карта()) bad("[тур] тур показан второй раз");
      }
      ls.removeItem(КЛЮЧ); await урок();
      g.screenWorlds(); await tick(40);
      if (карта()) bad("[тур] уход с урока не убрал тур");
      if (ls.getItem(КЛЮЧ)) bad("[тур] уход с урока отметил тур увиденным");
      await урок();
      doc.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape" }));
      if (карта() || ls.getItem(КЛЮЧ) !== "1") bad("[тур] Esc не закрыл тур насовсем");
      ls.removeItem(КЛЮЧ); g.state.stars = { "print-first": 3 };
      await урок();
      if (карта()) bad("[тур] показан тому, кто уже проходил уроки");
      g.state.stars = звёзды;
      if (былоЛс === null) ls.removeItem(КЛЮЧ); else ls.setItem(КЛЮЧ, былоЛс);
      viewReset(g);
    }

    /* --- [двери-сегодня] (24.09.2026): «Сегодня» уехал в js/screens-today.js ---
       По § 4.55 каждая дверь ЖМЁТСЯ и проверяется, куда привела: обработчик,
       который ищет экран в момент нажатия, при отрисовке молчит. Условные
       кнопки (итог занятия, задание взрослого, задача дня) тест создаёт сам. */
    {
      const снимок = JSON.parse(JSON.stringify(g.state));
      /* устройство ребёнка (кабинет взрослого вместо Главного открыл бы свой
         экран) и пройденные уроки мира 1 — иначе нет ни одной разминки, а
         значит и задачи дня */
      g.state.admin.isAdmin = false; g.state.admin.parentOf = "";
      g.state.stars = {}; w.CURRICULUM[0].lessons.slice(0, 10).forEach(l => { g.state.stars[l.id] = 3; });
      const тут = () => g.place() === "today";
      const жми = async (el, что) => {
        if (!el) return bad("[двери-сегодня] нет кнопки: " + что);
        el.click(); await tick(60);
        if (!тут()) bad("[двери-сегодня] «" + что + "» привела на «" + g.place() + "», а не на «Сегодня»");
      };
      g.screenWorlds(); await tick();
      await жми(doc.getElementById("btn-today"), "Сегодня в шапке");
      g.screenWorlds(); await tick();
      await жми(doc.getElementById("go-today"), "карточка «Сегодня» на Главном");
      w.history.replaceState(null, "", w.location.pathname + "#today");
      g.routeHash(); await tick(60);
      if (!тут()) bad("[двери-сегодня] адрес #today привёл на «" + g.place() + "»");
      g.screenZan(); await tick();
      await жми(doc.getElementById("zback"), "назад с экрана занятия");
      g.screenZan(); await tick();
      await жми(doc.getElementById("btn-back"), "«назад» в шапке на экране занятия");
      g.zanStart(); const итог = g.zanFinish("hand");
      g.screenZanDone(итог); await tick();
      await жми(doc.getElementById("ztoday"), "итог занятия → «Сегодня»");
      g.screenAssign({ t: "ask", text: "Расскажи, что делает цикл" }); await tick();
      await жми(doc.getElementById("aback"), "задание взрослого → «На «Сегодня»»");
      g.screenAssign({ t: "ask", text: "Расскажи про список" }); await tick();
      await жми(doc.getElementById("adone"), "задание взрослого → «Рассказал»");
      const дня = g.dailyPick();
      if (!дня) bad("[двери-сегодня] задачи дня нет — дверь из неё не проверить");
      else {
        g.openWarmup(дня.id, { daily: true }); await tick(80);
        await жми(doc.querySelector("[data-go]"), "назад из задачи дня");
      }
      /* и двери НАРУЖУ — через договор: значением отданное undefined падает
         только при нажатии */
      const изСегодня = async (sel, куда, что) => {
        g.screenToday(); await tick(40);
        const el = doc.querySelector(sel);
        if (!el) return bad("[двери-сегодня] на «Сегодня» нет кнопки: " + что);
        el.click(); await tick(80);
        if (g.place() !== куда) bad("[двери-сегодня] «" + что + "» привела на «" + g.place() + "», а не на «" + куда + "»");
      };
      g.state.zan = {}; g.state.daily = {};
      await изСегодня("#dopen", "warmup", "Открыть задачу дня");
      g.state.daily[g.dayKey()] = 1;
      await изСегодня("#dwarm", "warm", "Ещё размяться");
      await изСегодня("#zanstart", "zan", "Начать занятие");
      await изСегодня("#zancont", "zan", "Продолжить занятие");
      g.zanFinish("hand");
      await изСегодня("#zanmore", "zan", "Ещё занятие");
      g.zanFinish("hand");
      g.screenAssign({ t: "do", text: "Пройди урок", ref: w.CURRICULUM[0].lessons[0].id }); await tick();
      await изСегодня("[data-ptopen]", "lesson", "задание взрослого: открыть урок");
      g.screenAssign({ t: "ask", text: "Расскажи про условие" }); await tick();
      await изСегодня("[data-ptdone]", "today", "задание взрослого: «Рассказал»");
      g.screenToday(); await tick(40);
      const чип = doc.querySelector("[data-wd]");
      if (чип){ const было = JSON.stringify(g.state.schedule || null); чип.click(); await tick(40);
        if (!тут() || JSON.stringify(g.state.schedule || null) === было) bad("[двери-сегодня] день расписания не отметился"); }
      await изСегодня("#tomap", g.place() === "today" ? "home" : "home", "На главную");

      Object.keys(g.state).forEach(k => { delete g.state[k]; });
      Object.assign(g.state, снимок);
      w.history.replaceState(null, "", w.location.pathname);
      viewReset(g);
    }

    /* --- [дом-взрослого] (24.09.2026): вывеска на устройстве взрослого ---
       Устройство репетитора или родителя без своих уроков звали «Мои уроки →»
       и вели на пустую карту миров. Кнопка обязана назвать кабинет роли и
       вести в него. */
    {
      const было = JSON.parse(JSON.stringify({ stars: g.state.stars, name: g.state.name, admin: g.state.admin }));
      const былКод = w.Cloud.myCode();
      w.Cloud.forgetCode(); g.state.stars = {}; g.state.name = "";
      const главная = () => { const b = doc.querySelector('.landcta .bigbtn:not(.ghost)'); return b ? b.textContent : "нет кнопки"; };
      g.becomeAdmin(); g.adminLock();
      g.screenAbout(); await tick();
      if (/Мои уроки/.test(главная()) || !/Войти в кабинет/.test(главная()))
        bad("[дом-взрослого] на запертом устройстве репетитора вывеска зовёт «" + главная() + "»");
      const кн = doc.querySelector('.landcta .bigbtn:not(.ghost)');
      if (кн){ кн.click(); await tick(); if (g.place() !== "adminlogin") bad("[дом-взрослого] кнопка репетитора привела на «" + g.place() + "»"); }
      g.state.admin.isAdmin = false;
      g.becomeParent("rebenok-dom", "");
      g.screenAbout(); await tick();
      if (!/Кабинет родителя/.test(главная())) bad("[дом-взрослого] на устройстве родителя вывеска зовёт «" + главная() + "»");
      g.state.stars = было.stars; g.state.name = было.name; g.state.admin = было.admin;
      if (былКод) w.Cloud.setCode(былКод);
      viewReset(g);
    }

    /* --- [код-на-витрине]: поле «Уже есть код?» (24.09.2026) ---
       Витрина узнаёт код по виду и ведёт на #kidlogin= / #parentlogin= /
       #variant= / #proverka=. Здесь: (1) адреса открывают свой экран с
       вписанным кодом; (2) азбуки и шаблоны витрины совпадают с теми, по
       которым коды ВЫДАЁТ тренажёр, — иначе поле скажет «такого кода мы не
       выдаём» про настоящий код; (3) разбор на самой витрине, нажатием. */
    for (const [адрес, куда, поле, значение] of [
      ["#variant=abc234", "variant", "vseed", "ABC234"],
      ["#kidlogin=nikogo-net", "kidlogin", "klcode", "nikogo-net"],
      ["#parentlogin=nikogo-net", "parentlogin", "plcode", "nikogo-net"]]){
      /* ⚠️ replaceState, а не присваивание hash: с главной сюда приходят
         ЗАГРУЗКОЙ страницы, адрес разбирается один раз. Присваивание дало бы
         ещё и hashchange — второй разбор уже без кода, и тест мерил бы то,
         чего не бывает. */
      w.history.replaceState(null, "", w.location.pathname + адрес);
      if (!g.routeHash()) { bad("[код-на-витрине] адрес " + адрес + " не разобран"); continue; }
      await tick(80);
      if (g.place() !== куда) bad("[код-на-витрине] " + адрес + " привёл на «" + g.place() + "», а не на «" + куда + "»");
      const el = doc.getElementById(поле);
      if (!el || el.value !== значение)
        bad("[код-на-витрине] " + адрес + ": код не вписан в поле (" + (el ? el.value : "поля нет") + ")");
      if (/login=/.test(w.location.hash)) bad("[код-на-витрине] код ученика остался в адресе: " + w.location.hash);
    }
    w.location.hash = ""; viewReset(g);
    {
      const vit = fs.readFileSync(path.join(root, "vitrina/index.html"), "utf8");
      const букв = (vit.match(/var A = "\[([^\]]+)\]"/) || [])[1];
      const все = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const азбукаВитрины = букв ? все.split("").filter(c => new RegExp("[" + букв + "]").test(c)).join("") : "";
      const срц = f => fs.readFileSync(path.join(root, f), "utf8");
      const азП = (срц("js/proverka.js").match(/var ABC = "([^"]+)"/) || [])[1];
      const азВ = (срц("js/variant.js").match(/var CODE_ABC = "([^"]+)"/) || [])[1];
      if (!азбукаВитрины || азбукаВитрины !== азП || азбукаВитрины !== азВ)
        bad("[код-на-витрине] азбука кодов на витрине «" + азбукаВитрины + "» не та, что у проверки «" +
            азП + "» и варианта «" + азВ + "»");
      const reК = (срц("js/cloud.js").match(/var CODE_RE = (\/[^;]+\/);/) || [])[1];
      if (!reК || vit.indexOf(reК) < 0)
        bad("[код-на-витрине] шаблон кода ученика на витрине разошёлся с js/cloud.js: " + reК);
      const vd = new JSDOM(vit, { runScripts: "dangerously" });
      const vdoc = vd.window.document, vin = vdoc.getElementById("hccode"), vf = vdoc.getElementById("havecode");
      const разбор = код => {
        vin.value = код;
        vf.dispatchEvent(new vd.window.Event("submit", { cancelable: true }));
        return [...vdoc.querySelectorAll("#hcmsg a")].map(a => a.getAttribute("href")).join(" ");
      };
      const ждём = [["yozh-jgayv", "../#kidlogin=yozh-jgayv ../#parentlogin=yozh-jgayv"],
                    ["abc234", "../#variant=ABC234 ../#kidlogin=abc234"],
                    ["2345 6789 abcd efgh", "../#proverka=2345-6789-ABCD-EFGH"],
                    ["ну привет", ""]];
      ждём.forEach(([код, надо]) => {
        const есть = разбор(код);
        if (есть !== надо) bad("[код-на-витрине] «" + код + "» разобран в «" + есть + "», а надо «" + надо + "»");
      });
      vd.window.close();
    }
    viewReset(g);

    /* --- экран без маршрута адрес ЧИСТИТ, а не тащит чужой ---
       ⚠️ Оставшийся адрес врёт хуже, чем адрес, который не менялся: по нему
       дают ссылку и по нему обновляют страницу, и обе дороги приводят не туда. */
    g.adminUnlock();
    g.screenGames(); await tick();
    g.screenRegister(); await tick();
    if (w.location.hash)
      bad("[адрес] с экрана без своего адреса остался чужой «" + w.location.hash + "»");
    viewReset(g);

    /* --- второе имя экрана приводит туда же ---
       `#help` — старое имя инструкции, оно в разосланных ссылках, и ломать
       его нельзя. Что адрес при этом станет каноническим `#guide` — не
       потеря, а порядок: человек попал куда шёл, а в адресной строке у
       экрана одно имя, а не два.
       ⚠️ Ждём событие, а не зовём routeHash руками: первый вариант звал, и
       проверка мигала — событие успевало вклиниться то до, то после. */
    w.location.hash = "#help";
    await tick(30);
    if (g.place() !== "guide")
      bad("[адрес] старая ссылка «#help» перестала открывать инструкцию: место «" + g.place() + "»");
    w.location.hash = "";
    await tick(30);
    viewReset(g);

    /* --- присланную ссылку экран за собой НЕ стирает ---
       ⚠️ Ради этого `routeFor` стирает только ЧУЖОЙ адрес — записанный в
       таблице за другим экраном, — а незнакомый не трогает. Незнакомый адрес
       не наш: его поставил либо сам экран (у урока и проекта адрес с
       параметром), либо человек, пришедший по присланной ссылке. Сотрёшь —
       и первое же обновление страницы уведёт его с присланной задачи на
       домашний экран, а вернуться будет некуда: ссылка была в адресной
       строке и больше её там нет. */
    /* ⚠️ Здесь адрес разбираем ВЫЗОВОМ, а не ожиданием события. Вариант с
       `await tick()` мигал один раз из трёх: отложенные `hashchange` от
       прошлых шагов приходят в непредсказуемом порядке, и проверка ловила
       не то состояние. Спрашиваем ровно то, что хотим знать: заход на экран
       задачи присланный адрес не стирает. */
    await tick(30);                                  /* пусть осядут прошлые события */
    w.location.hash = "#task=этонеразберётся";
    g.routeHash();
    if (g.place() !== "friendtask")
      bad("[адрес] нечитаемая ссылка на задачу открыла не тот экран: " + g.place());
    if (!/^#task=/.test(w.location.hash || ""))
      bad("[адрес] присланная ссылка стёрлась сама собой: «" + w.location.hash +
          "» — обновление страницы уведёт человека с присланной задачи");
    w.location.hash = "";
    await tick(30);
    viewReset(g);

    /* вернуть всё в то состояние, в каком взяли */
    Object.keys(g.state).forEach(k => { delete g.state[k]; });
    Object.keys(снимок).forEach(k => { g.state[k] = снимок[k]; });
    if (!(снимок.admin && снимок.admin.isAdmin)) g.becomeKid();
    if (замокБыл) g.adminUnlock(); else g.adminLock();
    if (кодБыл) w.Cloud.setCode(кодБыл); else w.Cloud.forgetCode();
    g.save();
    w.location.hash = хэшБыл;
    viewReset(g); await tick();

    if (problems.length === p0) routeChecked++;
  }

  /* --- страницы сайта: ссылки ведут в существующее, карта сайта полна ---
     ⚠️ Заведено 10.09.2026 вместе со страницей `shkole/`. Ловит класс ошибок,
     которого не видит ни один другой тест и не видно глазами: статические
     страницы связаны РУКАМИ — у каждой десяток ссылок в шапке и подвале, и
     новая страница вписывается в них по одной. Опечатка не ломает ни сборку,
     ни приложение: она молча отдаёт человеку 404, и узнаём мы об этом от
     него. Сегодня страниц 13 и ссылок между ними больше сотни — руками это
     уже не пересчитывается.
     Спрашиваем три вещи:
       1) каждая ссылка ведёт в существующий файл;
       2) ни одна не начинается с косой черты — на адресе вида
          .../kodokvest/ такая уводит в корень домена, то есть в никуда
          (та же ловушка, что у подвала приложения выше);
       3) страницы и `sitemap.xml` совпадают в обе стороны: страницы без
          строки в карте поисковик не найдёт, а строка без страницы — 404
          в глазах робота. */
  let pagesChecked = 0;
  {
    const p0 = problems.length;
    const site = "https://fionov365-ai.github.io/kodokvest/";
    /* все index.html репозитория, кроме сборки и зависимостей */
    const html = [];
    (function walk(dir, rel){
      fs.readdirSync(dir, { withFileTypes:true }).forEach(e => {
        if (e.name === "node_modules" || e.name === "dist" || e.name.charAt(0) === ".") return;
        const full = path.join(dir, e.name), r = rel ? rel + "/" + e.name : e.name;
        if (e.isDirectory()) return walk(full, r);
        if (e.name === "index.html") html.push(r);
      });
    })(root, "");

    if (html.length < 12) bad("[страницы] найдено всего " + html.length + " страниц — обход сломался");

    html.forEach(rel => {
      const src = fs.readFileSync(path.join(root, rel), "utf8");
      const dir = path.dirname(rel) === "." ? "" : path.dirname(rel);
      [...src.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]).forEach(href => {
        if (/^(https?:|mailto:|tel:|data:|#)/.test(href)) return;
        if (href.charAt(0) === "/")
          return bad("[страницы] " + rel + ": ссылка «" + href + "» начинается с косой черты — " +
                     "на адресе вида .../kodokvest/ она ведёт в корень домена, то есть в никуда");
        const clean = href.split("#")[0].split("?")[0];
        if (!clean) return;
        let target = path.normalize(path.join(dir, clean));
        if (/[\\/]$/.test(clean) || clean === "." || clean === "..")
          target = path.join(target, "index.html");
        if (!fs.existsSync(path.join(root, target)))
          bad("[страницы] " + rel + ": ссылка «" + href + "» ведёт в никуда (" + target + ")");
      });
    });

    /* карта сайта — в обе стороны */
    const map = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
    const locs = [...map.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    if (!locs.length) bad("[страницы] в sitemap.xml нет ни одного адреса");
    const inMap = {};
    locs.forEach(loc => {
      if (loc.indexOf(site) !== 0)
        return bad("[страницы] адрес карты сайта не с нашей площадки: " + loc);
      const rel = loc.slice(site.length) + "index.html";
      inMap[rel] = 1;
      if (!fs.existsSync(path.join(root, rel)))
        bad("[страницы] в sitemap.xml есть «" + loc + "», а страницы нет — робот получит 404");
    });
    html.forEach(rel => {
      if (!inMap[rel])
        bad("[страницы] страница «" + rel + "» не попала в sitemap.xml — из поиска её не существует");
    });

    /* --- lastmod в карте сайта не старее самой страницы (1.158.0) ---
       ⚠️ Дата, проставленная руками, стареет молча (§ 4.14). Сторож
       сравнивает lastmod с датой последнего коммита файла страницы: правишь
       страницу — обнови её строку в sitemap.xml. С незакоммиченной правкой
       проверка молчит (git ещё не знает даты) — поймает следующий прогон. */
    {
      const { execFileSync } = require("child_process");
      const entries = [...map.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)];
      if (entries.length !== locs.length)
        bad("[страницы] lastmod есть не у всех адресов карты сайта: " +
            entries.length + " из " + locs.length);
      entries.forEach(m => {
        const rel = m[1].slice(site.length) + "index.html";
        let committed = "";
        try {
          committed = execFileSync("git", ["log", "-1", "--format=%as", "--", rel],
                                   { cwd: root, encoding: "utf8" }).trim();
        } catch (e) { /* без git проверять нечем — молчим, а не падаем */ }
        if (committed && m[2] < committed)
          bad("[страницы] lastmod у «" + rel + "» (" + m[2] + ") старее последнего коммита (" +
              committed + ") — карта сайта врёт роботу");
      });
    }

    /* --- верхнее меню одно на всех страницах (1.158.0, § 2.6) ---
       До 12.09.2026 состав меню был разным на каждой странице: «Справочник»
       был только на витрине, каждая дверь пряталась из собственного меню.
       Человек, ходящий по сайту, на каждой странице учил меню заново. */
    {
      /* ⚠️ Состав сменён 13.09.2026 (перестройка сайта по схеме self-serve,
         rynok-i-rov-2026-09-12.md § 6в): меню по аудитории плюс «Попробовать»
         и «Цена». «Индивидуальный проект» и «Семейное обучение» ушли внутрь
         страницы «Родителю» и остались в подвале. */
      /* ⚠️ Восьмой пункт «Что внутри» добавлен 20.09.2026 СЛОВОМ ФАУНДЕРА —
         состав меню закреплён § 7 и сам по себе не меняется. Стоит вторым:
         человек, который ещё не знает, он «родитель» или «репетитор», сперва
         смотрит, что внутри, и только потом выбирает роль. */
      const МЕНЮ = ["Попробовать", "Что внутри", "Родителю", "Репетитору",
                    "Школе", "Цена", "Справочник", "О проекте"];
      html.forEach(rel => {
        /* корневой index.html — сам тренажёр, 404 — служебная: у них меню сайта нет */
        if (rel === "index.html" || rel === "404.html") return;
        const page = fs.readFileSync(path.join(root, rel), "utf8");
        const nav = (page.match(/<div class="top">[\s\S]*?<nav>([\s\S]*?)<\/nav>/) || [])[1] || "";
        if (!nav) return bad("[страницы] у «" + rel + "» нет верхнего меню");
        МЕНЮ.forEach(n => {
          if (nav.indexOf(">" + n + "<") < 0)
            bad("[страницы] в верхнем меню «" + rel + "» нет пункта «" + n + "» — меню снова разное");
        });
        /* и ничего сверх того, в том же порядке: лишний пункт на одной
           странице — то же «разное меню», только с другой стороны */
        const есть = [...nav.matchAll(/>([^<]+)<\/a>/g)].map(m => m[1].trim());
        if (есть.join(" · ") !== МЕНЮ.join(" · "))
          bad("[страницы] верхнее меню «" + rel + "» — «" + есть.join(" · ") + "», а на всех страницах «" +
              МЕНЮ.join(" · ") + "»");
        /* «Попробовать» — сразу в первую задачу, «Цена» — в раздел цены витрины */
        if (!/href="(?:\.\.\/)+#lesson=[a-z0-9-]+">Попробовать</.test(nav))
          bad("[страницы] «Попробовать» в меню «" + rel + "» не ведёт в первую задачу");
        if (!/href="(?:(?:\.\.\/)+vitrina\/)?#cena">Цена</.test(nav))
          bad("[страницы] «Цена» в меню «" + rel + "» не ведёт в раздел цены на витрине");
      });
      /* на телефоне меню встаёт под логотип во всю ширину и не прячется за
         прокруткой вбок (13.09.2026): иначе семь пунктов ложатся в четыре
         строки и съедают первый экран — до главной кнопки ~190 px шапки */
      {
        const cssTop = fs.readFileSync(path.join(root, "css/pages.css"), "utf8");
        const моб = [...cssTop.matchAll(/@media\s*\(max-width:640px\)\s*\{([\s\S]*?)\n\}/g)].map(m => m[1]).join("\n");
        if (!/\.top \.wrap\{[^}]*flex-wrap:wrap/.test(моб) || !/\.top nav\{[^}]*width:/.test(моб))
          bad("[страницы] на телефоне меню снова справа от логотипа — семь пунктов лягут в четыре строки и съедят первый экран");
        if (/\.top nav\{[^}]*overflow-x/.test(cssTop))
          bad("[страницы] меню спрятано в прокрутку вбок — пункты за краем никто не найдёт");
      }
      /* раздел, куда ведёт «Цена», обязан существовать */
      if (!/<section id="cena">/.test(fs.readFileSync(path.join(root, "vitrina/index.html"), "utf8")))
        bad("[страницы] на витрине нет раздела id=\"cena\" — пункт меню «Цена» ведёт в никуда");
    }

    /* --- «где я» и «куда дальше» (18.09.2026) ---
       Разбор навигации нашёл три дыры, и все три молчаливые: страница не
       говорила, где посетитель стоит; из середины статьи в шесть экранов
       телефона не было хода никуда; а кончалась каждая страница разделом
       «Честно про границы» — то есть последним, что человек читал перед
       решением, был список того, чего у нас НЕТ, и дальше тупик.
       Стережём устройство, а не текст: крошки, двери и живые якоря. */
    {
      /* список страниц берём из обхода выше: «vitrina/index.html» → «vitrina».
         Корневой index.html — это тренажёр, а не страница сайта. */
      const страницыНав = html.map(f => path.dirname(f)).filter(d => d !== ".");
      const doorsRe = /<a class="door" href="([^"]+)"/g;
      страницыНав.forEach(page => {
        const src = fs.readFileSync(path.join(root, page, "index.html"), "utf8");

        /* крошки — на всех, кроме витрины: она сама верх сайта, и крошка
           вела бы на себя */
        if (page !== "vitrina"){
          const c = src.match(/<nav class="crumbs"[\s\S]*?<\/nav>/);
          if (!c) bad("[навигация] «" + page + "»: нет крошек — страница не говорит, где человек стоит");
          else if (!/href="(\.\.\/)+vitrina\/"/.test(c[0]))
            bad("[навигация] «" + page + "»: первая крошка не ведёт на витрину — из глубины сайта нет дороги наверх");
        }

        /* двери: 2, 3 или 4 — ряд обязан кончаться ровно (§ 15 правил сайта) */
        const doors = [...src.matchAll(doorsRe)].map(m => m[1]);
        if (!/<nav class="next"/.test(src))
          bad("[навигация] «" + page + "»: нет блока «Куда дальше» — страница кончается тупиком");
        else if (doors.length < 2 || doors.length > 4)
          bad("[навигация] «" + page + "»: дверей " + doors.length +
              " — ряд не заполнится, ставить 2, 3 или 4");
        /* дверь на саму себя — самая незаметная поломка: ссылка есть,
           нажатие ничего не меняет */
        doors.forEach(h => {
          const целое = path.normalize(path.join(page, h.split("#")[0]));
          if (целое === path.normalize(page) || целое === path.normalize(page) + "/")
            bad("[навигация] «" + page + "»: дверь «" + h + "» ведёт на эту же страницу");
        });
      });

      /* Снимок экрана обязан быть ДВЕРЬЮ в этот экран, и дверь обязана вести
         в живой адрес. ⚠️ Гниёт молча с двух сторон: переименуют адрес в
         таблице ROUTES — картинка на сайте станет ссылкой в никуда; добавят
         новый снимок без ссылки — он останется украшением, и человек, который
         на него нажал, не получит ничего. Список адресов берём из самого
         `js/app.js`, а не переписываем сюда: переписанный устареет. */
      {
        const appSrc = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
        const адреса = new Set([...appSrc.matchAll(/\{\s*h:"(#[a-z]+)"/g)].map(m => m[1]));
        if (адреса.size < 20)
          bad("[навигация] из js/app.js вычитано адресов: " + адреса.size +
              " — разбор таблицы ROUTES сломался, и проверка дверей почти ничего не смотрит");
        страницыНав.forEach(page => {
          const src = fs.readFileSync(path.join(root, page, "index.html"), "utf8");
          [...src.matchAll(/<figure class="shot">([\s\S]*?)<\/figure>/g)].forEach(m => {
            const href = (m[1].match(/<a href="([^"]+)"/) || [])[1];
            const имя = (m[1].match(/img\/([a-z0-9-]+\.png)/) || [])[1] || "?";
            if (!href)
              return bad("[навигация] «" + page + "»: снимок " + имя +
                         " не открывается — картинка без двери в свой экран");
            const хэш = href.slice(href.indexOf("#"));
            if (хэш.indexOf("#lesson=") === 0) return;      /* урок: свой адрес с номером */
            if (!адреса.has(хэш))
              bad("[навигация] «" + page + "»: снимок " + имя + " ведёт на «" + хэш +
                  "», а такого экрана в тренажёре нет");
          });
        });
      }

      /* Где человек сейчас — видно в самом меню. Проверяем обе стороны:
         пункт отмечен, и отмечен ровно один (две пометки — это уже не
         «где я», а украшение). */
      {
        const ПУНКТ = { roditelyu:"Родителю", repetitoru:"Репетитору", shkole:"Школе",
                        "chto-vnutri":"Что внутри",
                        "o-proekte":"О проекте", baza:"Справочник" };
        страницыНав.forEach(page => {
          const пункт = ПУНКТ[page] || (page.indexOf("baza/") === 0 ? "Справочник" : null);
          const src = fs.readFileSync(path.join(root, page, "index.html"), "utf8");
          const сколько = (src.match(/aria-current="page"/g) || []).length;
          if (!пункт) return;                 /* своего пункта в меню нет — крошек довольно */
          if (сколько === 0)
            bad("[навигация] «" + page + "»: в меню не отмечен пункт «" + пункт +
                "» — открытая страница ничем не отличается от закрытой");
          else if (сколько > 1)
            bad("[навигация] «" + page + "»: пометок «вы здесь» в меню " + сколько + ", а место одно");
          else if (!new RegExp('aria-current="page">' + пункт + '<').test(src))
            bad("[навигация] «" + page + "»: в меню отмечен НЕ «" + пункт + "» — пометка врёт о месте");
        });
      }

      /* оглавление длинной статьи: каждый якорь обязан найти свой заголовок.
         ⚠️ Это гниёт молча: переименовали раздел — ссылка осталась и ведёт
         в никуда, а выглядит рабочей. */
      страницыНав.filter(p => p.indexOf("baza/") === 0).forEach(page => {
        const src = fs.readFileSync(path.join(root, page, "index.html"), "utf8");
        const разделов = (src.match(/<h2[ >]/g) || []).length;
        const toc = src.match(/<nav class="toc"[\s\S]*?<\/nav>/);
        if (разделов >= 5 && !toc)
          bad("[навигация] «" + page + "»: разделов " + разделов +
              ", а оглавления нет — по длинной статье нечем прыгать");
        if (!toc) return;
        [...toc[0].matchAll(/href="#([^"]+)"/g)].map(m => m[1]).forEach(id => {
          if (src.indexOf('id="' + id + '"') < 0)
            bad("[навигация] «" + page + "»: в оглавлении якорь «#" + id + "», а такого заголовка нет");
        });
      });

      /* липкая шапка — только на широком экране: на телефоне меню в две
         строки съело бы восьмую часть экрана навсегда (замер 18.09.2026) */
      {
        const css = fs.readFileSync(path.join(root, "css/pages.css"), "utf8");
        const широкий = (css.match(/@media\s*\(min-width:641px\)\s*\{([\s\S]*?)\n\}/) || [])[1] || "";
        if (!/\.top\{[^}]*position:sticky/.test(широкий))
          bad("[навигация] шапка перестала быть липкой на широком экране — " +
              "из середины длинной страницы снова некуда идти");
        /* ⚠️ Искать «липкую на телефоне» по всему файлу нельзя: между словами
           «@media (max-width:640px)» и «.top{position:sticky» лежит полфайла,
           и ленивый поиск перепрыгивает из одного блока в другой. Ловушка
           поймана этой же проверкой при первом прогоне 18.09.2026 — она
           падала на исправной вёрстке. Смотрим ТОЛЬКО внутрь узких блоков. */
        const узкие = [...css.matchAll(/@media\s*\(max-width:640px\)\s*\{([\s\S]*?)\n\}/g)]
          .map(m => m[1]).join("\n");
        /* ⚠️ Планшет — полоса, которую не видел никто до 20.09.2026.
           Между телефоном (≤640) и широким экраном (≥1000) восемь пунктов
           рядом с логотипом не помещаются и переносятся ВТОРЫМ РЯДОМ
           СПРАВА: «О проекте» висит один, слева пустует логотип. Лечение
           живёт в двух блоках, и оба стерегутся: 641–719 — сетка 4×2,
           720–999 — меню уходит под логотип одной строкой. Числа границ
           найдены замером в браузере (расчёт дважды соврал на пиксель). */
        const узкийПланшет = (css.match(/@media\s*\(min-width:641px\)\s*and\s*\(max-width:719px\)\s*\{([\s\S]*?)\n\}/) || [])[1] || "";
        if (!/grid-template-columns/.test(узкийПланшет))
          bad("[навигация] на узком планшете (641–719) меню больше не сетка — " +
              "восемь пунктов повиснут тремя рядами");
        const планшет = (css.match(/@media\s*\(min-width:720px\)\s*and\s*\(max-width:999px\)\s*\{([\s\S]*?)\n\}/) || [])[1] || "";
        if (!/\.top nav\{[^}]*width:/.test(планшет))
          bad("[навигация] на планшете (720–999) меню не уходит под логотип — " +
              "«Справочник» и «О проекте» снова повиснут вторым рядом справа");
        if (/\.top\{[^}]*position:sticky/.test(узкие))
          bad("[навигация] шапка стала липкой и на телефоне — там меню в две строки " +
              "съедает восьмую часть экрана навсегда");
      }
    }

    /* --- офлайн не подменяет страницы сайта тренажёром (1.157.0) ---
       До 12.09.2026 sw.js не кэшировал ни одной страницы сайта, а офлайновый
       откат ЛЮБОЙ навигации вёл на ./index.html: человек без сети открывал
       «Репетитору» и получал детский тренажёр. Теперь страницы из sitemap
       лежат в оболочке, а откат на тренажёр разрешён только дороге к нему. */
    {
      const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
      locs.forEach(loc => {
        const rel = loc.slice(site.length);           /* '' для корня */
        if (!rel) return;                             /* корень и есть тренажёр */
        if (sw.indexOf('"./' + rel + '"') < 0)
          bad("[офлайн-страницы] «" + rel + "» есть в sitemap.xml, но не в оболочке sw.js — " +
              "без сети вместо неё откроется тренажёр");
      });
      if (sw.indexOf("url.pathname === scope") < 0)
        bad("[офлайн-страницы] в sw.js пропала проверка «подменять только дорогу к тренажёру» — " +
            "офлайновый откат снова отдаёт чужой экран");
      if (sw.indexOf('"./css/pages.css"') < 0)
        bad("[офлайн-страницы] css/pages.css не в оболочке sw.js — офлайн-страницы будут голыми");
    }
    if (problems.length === p0) pagesChecked++;
  }

  /* --- список переезда на домен совпадает с репозиторием (1.197.0) ---
     ⚠️ Заведено 20.09.2026 проверкой готовности к запуску. Файл
     `docs/pereezd-na-domen.md` обещает: в день покупки домена переезд —
     замена строк по списку, а не поиск по репозиторию. Обещание уже
     подводило: в списке не было `vitrina/index.html` — трёх строк на
     странице, которая после переезда становится корнём домена. Заметить
     это глазами нельзя: страница живёт, ссылки целы, врёт только
     канонический адрес, и врёт поисковику, а не человеку.
     Сторож смотрит в обе стороны:
       1) каждый файл продукта, где прошит адрес площадки, назван в том
          документе (в таблице § 1 или среди объявленных исключений);
       2) каждый файл из таблицы § 1 существует и адрес в нём ещё есть —
          иначе строка списка стареет и уводит в сторону в день переезда.
     Документы (`docs/`, `README.md`, `HANDOFF.md`) не смотрим: там адрес
     стоит как цитата, и переезжать ему незачем.
     ⚠️ Названным считается только то, что стоит СТРОКОЙ ТАБЛИЦЫ — в § 1
     (переезжает) или в § 1а (сознательно не переезжает). Упоминание в
     тексте не годится: первая нарочная поломка 20.09.2026 прошла мимо
     сторожа именно так — строку про витрину убрали из таблицы, а имя файла
     осталось в абзаце рядом, и проверка смолчала. */
  let pereezdChecked = 0;
  {
    const p0 = problems.length;
    const адрес = "fionov365-ai.github.io";
    const карта = "docs/pereezd-na-domen.md";
    const doc = fs.readFileSync(path.join(root, карта), "utf8");
    const ходовые = /\.(html|xml|txt|js|json|css|webmanifest)$/;
    const найдено = [];
    (function walk(dir, rel){
      fs.readdirSync(dir, { withFileTypes:true }).forEach(e => {
        if (e.name === "node_modules" || e.name === "dist" || e.name === "docs" ||
            e.name === "tools" || e.name.charAt(0) === ".") return;
        const full = path.join(dir, e.name), r = rel ? rel + "/" + e.name : e.name;
        if (e.isDirectory()) return walk(full, r);
        if (!ходовые.test(e.name)) return;
        if (fs.readFileSync(full, "utf8").indexOf(адрес) >= 0) найдено.push(r);
      });
    })(root, "");

    if (найдено.length < 15)
      bad("[переезд] адрес площадки найден всего в " + найдено.length + " файлах — обход сломался");

    /* имена из строк таблиц: «| `путь` | … |» — и только оттуда */
    const названы = {};
    [...doc.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].forEach(m => { названы[m[1]] = 1; });
    найдено.forEach(rel => {
      if (!названы[rel])
        bad("[переезд] в «" + rel + "» прошит адрес площадки, а в " + карта +
            " этого файла нет — в день переезда он останется со старым адресом");
    });

    /* обратная сторона — только для § 1: это файлы, где адрес МЕНЯЮТ.
       Исключения § 1а не проверяем: там адрес стоит по другому поводу
       (в `content/world5.js` — чужой, в уроке про GitHub Pages). */
    const первая = doc.split("## 1а.")[0];
    [...первая.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map(m => m[1]).forEach(rel => {
      const full = path.join(root, rel);
      if (!fs.existsSync(full))
        return bad("[переезд] " + карта + " зовёт менять адрес в «" + rel + "», а файла нет");
      if (fs.readFileSync(full, "utf8").indexOf(адрес) < 0)
        bad("[переезд] " + карта + " зовёт менять адрес в «" + rel + "», а адреса там уже нет — " +
            "строка списка устарела");
    });

    if (problems.length === p0) pereezdChecked++;
  }

  /* --- числа на страницах сайта сверены с продуктом ---
     ⚠️ Числа на витрине пишутся РУКАМИ: посчитать их страница не может, там
     нет ни строчки кода. Значит они стареют молча. Так и вышло: 09.09.2026 на
     странице репетитора стояло «1 065 сверок», к 10.09 их стало 1 178, и
     заметить это было нечем — та строка была правдой ровно один день.
     Числа со сроком годности со страниц убраны (сверки), а те, что остались,
     сверяются здесь с самими данными продукта. Правило то же, что на вывеске
     приложения: число, записанное руками, расходится с делом в первый же день
     наполнения. */
  let siteNumsChecked = 0;
  {
    const p0 = problems.length;
    const надо = [
      { rx: /(\d+)\s+урок/g,                  сколько: w.CURRICULUM.total,          что: "уроков" },
      { rx: /(\d+)\s+проект/g,                сколько: (w.PROJECTS || []).length,   что: "проектов" },
      { rx: /(\d+)\s+упражнени\S*\s+про\s+ИИ/g, сколько: (w.AILAB || []).length,    что: "упражнений про ИИ" },
      /* ⚠️ Добавлено 11.09.2026: на /semeynoe-obuchenie/ с 09.09 стояло
         «девяносто пять задач» ПРОПИСЬЮ — проверка цифр его не видела, а задач
         к тому дню стало 97. Число прописью — это число, спрятанное от теста;
         на страницах пишем цифрами. */
      { rx: /(\d+)\s+задач/g,                 сколько: (w.ALGO || []).length,       что: "задач экзамена" },
      { rx: /(\d+)\s+задани\S*\s+по\s+HTML/g, сколько: (w.WEB_TASKS || []).length,  что: "заданий по HTML и CSS" },
      /* ⚠️ Три числа дописаны 20.09.2026 вместе со страницей-описью: там они
         стоят рядом («16 заданий Робота», «21 разминка», «5 игр»), и до сих пор
         их не стерёг никто — а устаревают они ровно так же, как «95 задач»
         в 09.2026. Слово «задач» у Робота писать нельзя: оно уедет в проверку
         задач экзамена и поссорит 16 с 97. Поэтому у него «задания». */
      { rx: /(\d+)\s+задани\S*\s+Робота/g,   сколько: (w.ROBOT_TASKS || []).length, что: "заданий Робота" },
      { rx: /(\d+)\s+разминк\S*/g,           сколько: (w.WARMUPS || []).length,     что: "разминок" },
      { rx: /(\d+)\s+игр\S*/g,               сколько: (w.GAMES || []).length,       что: "игр" }
    ];
    /* ⚠️ Страницы берём СО СБОРА, а не списком руками. Оплачено 12.09.2026:
       список был написан в этой строке, `o-proekte` в него не попала, и на ней
       полгода стояло «Девяносто пять задач», когда их уже 97. Список страниц
       стареет ровно так же, как числа на них, — и молча. Теперь проверяются
       ВСЕ страницы сайта, какие есть на диске. */
    const страницыСайта = [];
    (function walkSite(dir, rel){
      fs.readdirSync(dir, { withFileTypes:true }).forEach(e => {
        if (e.name === "node_modules" || e.name === "dist" || e.name.charAt(0) === ".") return;
        if (!e.isDirectory()) return;
        const full = path.join(dir, e.name), r = rel ? rel + "/" + e.name : e.name;
        if (fs.existsSync(path.join(full, "index.html"))) страницыСайта.push(r);
        walkSite(full, r);
      });
    })(root, "");
    if (страницыСайта.length < 9)
      bad("[числа-сайта] страниц сайта найдено " + страницыСайта.length +
          " — сбор списка сломался, и проверка почти ничего не смотрит");
    страницыСайта.forEach(page => {
      const f = path.join(root, page, "index.html");
      /* ⚠️ Блоки с чужими числами вырезаем ДО сверки. На странице про цены
         лежит таблица одиннадцати школ, и «6 400 ₽/мес за 8 уроков» — пакет
         конкурента, а не наши сто уроков. Помечается в разметке явно
         (data-chuzhoe), а не угадывается здесь: угадывание однажды вырежет
         наше число вместе с чужим. */
      const текст = fs.readFileSync(f, "utf8")
        .replace(/<([a-z]+)[^>]*\bdata-chuzhoe\b[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " ");
      надо.forEach(n => {
        n.rx.lastIndex = 0;
        let m;
        while ((m = n.rx.exec(текст)))
          if (Number(m[1]) !== n.сколько)
            bad("[числа-сайта] " + page + ": написано «" + m[0].trim() + "», а в продукте " +
                n.сколько + " " + n.что + " — страница врёт посетителю");
      });
      /* ⚠️ Число ЗАДАЧ прописью запрещено отдельно (§ 4.25). Именно оно уже
         дважды уезжало (95 → 97), и именно прописью его не видит проверка
         выше. Уроки, миры и проекты — устойчивые обещания продукта, и «Сто
         уроков» там читается лучше цифры; их цифровые формы стережёт та же
         таблица. */
      /* ⚠️⚠️ Две ловушки, обе оплачены 12.09.2026 в этой самой строке.
         1) В JavaScript `\b` знает только латиницу и цифры: перед «девяносто»
            границы слова НЕТ, и регулярка с `\b` не срабатывает никогда.
            Проверка, которая не может упасть, — хуже отсутствующей.
         2) Число прописью бывает из ДВУХ слов: «девяносто пять задач».
            Однословный шаблон его не видит.
         Поэтому: граница вручную (не буква кириллицы) и необязательное
         второе слово. Проверено мутацией — вернул старый текст, упало. */
      const ЧИСЛ = "ноль|один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|" +
        "одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|шестнадцать|" +
        "семнадцать|восемнадцать|девятнадцать|двадцать|тридцать|сорок|пятьдесят|" +
        "шестьдесят|семьдесят|восемьдесят|девяносто|сто";
      const прописью = текст.match(new RegExp(
        "(?:^|[^а-яёА-ЯЁ])(?:" + ЧИСЛ + ")\\S*(?:\\s+(?:" + ЧИСЛ + ")\\S*)?\\s+задач", "gi"));
      if (прописью)
        bad("[числа-сайта] " + page + ": число задач написано прописью — «" +
            прописью[0].trim() + "». Прописью его не видит ни одна проверка, " +
            "а меняется оно каждый месяц (§ 4.25). Писать цифрами");
    });
    /* ⚠️ Три вещи, которые на страницах ломаются молча и которые разбор
       12.09.2026 нашёл руками. Все три — про то, что человек НЕ ПОЙМЁТ, где
       он и куда идти, а не про валидность разметки. */
    страницыСайта.forEach(page => {
      const raw = fs.readFileSync(path.join(root, page, "index.html"), "utf8");
      const up = "../".repeat(page.split("/").length);
      /* 1) с каждой страницы есть выход в сам продукт. `baza/` его не имела
            вовсе — единственная страница сайта без двери в тренажёр. */
      if (raw.indexOf('href="' + up + '"') < 0)
        bad("[страницы] " + page + ": нет ни одной ссылки в тренажёр — со страницы некуда идти");
      /* 2) уровни заголовков не перепрыгиваются: h1 → h3 читалка экрана
            озвучивает как подзаголовок без заголовка. */
      const ур = (raw.match(/<h([1-6])[ >]/g) || []).map(t => Number(t.replace(/\D/g, "")));
      for (let i = 1; i < ур.length; i++)
        if (ур[i] > ур[i - 1] + 1)
          return bad("[страницы] " + page + ": уровень заголовка прыгает с h" +
            ур[i - 1] + " на h" + ур[i] + " — читалке экрана это «подзаголовок без заголовка»");
      /* 3) в подвале обе правовые страницы, а не одна: «Условия» отсутствовали
            во всех четырёх страницах справочника. */
      if (raw.indexOf("pravo/politika/") >= 0 && raw.indexOf("pravo/soglashenie/") < 0)
        bad("[страницы] " + page + ": в подвале есть «Конфиденциальность», но нет «Условий»");
      /* 4) инлайн-стилей на страницах нет (чистка 15.09.2026, 1.181.0): одно
            и то же оформление стояло десятью копиями style="…", и правка
            цвета требовала бы десяти правок. Стиль живёт в css/pages.css. */
      if (/style="/.test(raw))
        bad("[страницы] " + page + ": инлайн-стиль style=\"…\" — оформлению место в css/pages.css " +
            "(классы .fine, .gap, .btnrow.end)");
      /* 5) у каждой таблицы шапка размечена шапкой: <thead>, в ней th со
            scope, тело — <tbody>. Без этого читалка экрана читает таблицу
            цен как простыню из 33 ячеек без столбцов. */
      const таблиц = (raw.match(/<table[ >]/g) || []).length;
      const шапок = (raw.match(/<thead>/g) || []).length;
      const тел = (raw.match(/<tbody>/g) || []).length;
      if (таблиц !== шапок || таблиц !== тел)
        bad("[страницы] " + page + ": таблиц " + таблиц + ", а <thead> " + шапок + " и <tbody> " + тел);
      const thBezScope = (raw.match(/<th(?:\s[^>]*)?>/g) || []).filter(t => t.indexOf("scope=") < 0).length;
      if (thBezScope)
        bad("[страницы] " + page + ": " + thBezScope + " <th> без scope — столбец не назван для читалки экрана");
      if (/<th scope="col">\s*<\/th>/.test(raw))
        bad("[страницы] " + page + ": пустая ячейка шапки таблицы — столбец без имени");
    });
    if (problems.length === p0) siteNumsChecked++;
  }

  /* --- ряд карточек кончается ровно, без дыры справа ---
     ⚠️ Продолжение правила полной ширины, только про сетку, а не про строку.
     Колонка страницы 1044 px делится на три карточки по 340 или на четыре по
     251. Любое ДРУГОЕ число карточек оставляет в последнем ряду пустое место:
     четыре карточки до 10.09.2026 ложились 3 + 1 и дыра занимала треть
     ширины — та самая, на которую фаундер жаловался четырежды. Чинится это
     в `css/pages.css` правилом «ровно четыре — ровно один ряд», а здесь
     сторожится с двух сторон:
       1) правило из pages.css никуда не делось;
       2) ни одна сетка не набрана числом, которое ряд не заполняет.
     Полными считаются 1, 2, 3, 4 и 6: 4 — по правилу выше, 6 — это 3 + 3.
     Пять или семь карточек ряд не заполняют ничем, и такую сетку надо
     переписать, а не подпирать стилем. */
  /* --- [сетка-экзамена]: сетка номеров на витрине совпадает с продуктом ---
     Кусок витрины между метками setka собирает tools/setka-ekzamena.js из
     js/exams.js и банка задач. Здесь он собирается ЗАНОВО и сравнивается с
     файлом: задачи номера появились или пропали, а витрину не пересобрали —
     посетитель нажал бы серый номер, который уже есть, или синий, которого нет. */
  let setkaChecked = 0;
  {
    const p0 = problems.length;
    const S = require(path.join(root, "tools/setka-ekzamena.js"));
    const vit = fs.readFileSync(path.join(root, "vitrina/index.html"), "utf8");
    const now = (vit.match(S.RX) || [])[0];
    if (!now) bad("[сетка-экзамена] на витрине нет меток setka:start / setka:end — сетка пропала");
    else if (now !== S.render(root))
      bad("[сетка-экзамена] сетка номеров на витрине разошлась с данными продукта — " +
          "запустите node tools/setka-ekzamena.js");
    else {
      const ссылок = (now.match(/href="\.\.\/#exam=(oge|ege)-\d+"/g) || []).length;
      if (ссылок < 40) bad("[сетка-экзамена] ссылок на номера всего " + ссылок + " — сборка сетки сломана");
    }
    if (problems.length === p0) setkaChecked++;
  }

  /* --- [лента]: «Что нового» на витрине — правда о датах (24.09.2026) ---
     Лента собирается tools/lenta.js из content/novoe.json. Сторож: (1) витрина
     совпадает со сборкой; (2) записи сверху вниз по версии, без повторов;
     (3) дата записи — день коммита ЕЁ версии в git. Версии, которой в
     истории нет, быть не может — кроме текущей, ещё не закоммиченной
     (у неё даты в git пока нет, как и у lastmod в карте сайта). */
  let lentaChecked = 0;
  {
    const p0 = problems.length;
    const L = require(path.join(root, "tools/lenta.js"));
    const vit = fs.readFileSync(path.join(root, "vitrina/index.html"), "utf8");
    const now = (vit.match(L.RX) || [])[0];
    if (!now) bad("[лента] на витрине нет меток lenta:start / lenta:end — лента пропала");
    else if (now !== L.render(root))
      bad("[лента] лента на витрине разошлась с content/novoe.json — запустите node tools/lenta.js");
    const xs = L.items(root);
    const num = v => v.split(".").map(Number).reduce((a, b) => a * 1000 + b, 0);
    const тек = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
    const было = {};
    xs.forEach((x, i) => {
      if (!/^\d+\.\d+\.\d+$/.test(x.v) || !/^\d{4}-\d{2}-\d{2}$/.test(x.d) || !String(x.t || "").trim())
        bad("[лента] запись " + (i + 1) + " без версии, даты или текста: " + JSON.stringify(x));
      if (было[x.v]) bad("[лента] версия " + x.v + " в ленте дважды");
      было[x.v] = 1;
      if (i && num(x.v) >= num(xs[i - 1].v))
        bad("[лента] порядок сломан: " + x.v + " стоит ниже " + xs[i - 1].v + " — новое должно быть сверху");
      if (i && x.d > xs[i - 1].d) bad("[лента] дата " + x.d + " новее записи выше (" + xs[i - 1].d + ")");
      let дни = null;
      try {
        дни = require("child_process").execFileSync("git",
          ["log", "--fixed-strings", "--grep=(" + x.v + ")", "--format=%as"],
          { cwd: root, encoding: "utf8" }).trim().split("\n").filter(Boolean);
      } catch (e) { /* без git сверять не с чем — молчим, как lastmod */ }
      if (!дни) return;
      if (!дни.length){
        if (x.v !== тек) bad("[лента] версии " + x.v + " нет в истории git — запись о том, чего не выходило");
        return;
      }
      if (дни[дни.length - 1] !== x.d)
        bad("[лента] у версии " + x.v + " в ленте дата " + x.d + ", а вышла она " + дни[дни.length - 1]);
    });
    if (xs.length < 3) bad("[лента] в ленте всего " + xs.length + " записей — показывать нечего");
    if (problems.length === p0) lentaChecked++;
  }

  /* --- [калькулятор-огэ]: справочник, калькулятор баллов (24.09.2026) ---
     Официальные числа живут в tools/kalkulyator-oge.js (OFFICIAL, с
     источником и датой). Сторож: страница совпадает со сборкой; баллы
     заданий складываются в максимум; шкала идёт от нуля до максимума без
     дыр и наложений; счёт на странице работает — нажатием в jsdom. */
  let kalkChecked = 0;
  {
    const p0 = problems.length;
    const K = require(path.join(root, "tools/kalkulyator-oge.js"));
    const page = fs.readFileSync(path.join(root, K.FILE), "utf8");
    const now = (page.match(K.RX) || [])[0];
    if (!now) bad("[калькулятор-огэ] на странице нет меток kalk:start / kalk:end");
    else if (now !== K.render(root))
      bad("[калькулятор-огэ] страница разошлась с данными — запустите node tools/kalkulyator-oge.js");
    const O = K.OFFICIAL, oge = w.EXAMS.oge;
    const сумма = oge.tasks.reduce((a, x) => a + K.maxOf(x.n), 0);
    if (сумма !== O.total) bad("[калькулятор-огэ] баллы заданий дают " + сумма + ", а максимум " + O.total);
    let ждём = 0;
    O.scale.forEach(x => { if (x.from !== ждём) bad("[калькулятор-огэ] в шкале дыра или наложение перед «" + x.mark + "»"); ждём = x.to + 1; });
    if (ждём !== O.total + 1) bad("[калькулятор-огэ] шкала кончается на " + (ждём - 1) + ", а максимум " + O.total);
    if (!(O.profile > 0 && O.profile <= O.total)) bad("[калькулятор-огэ] порог профильного класса вне шкалы: " + O.profile);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(O.checked) || !/fipi\.ru/.test(O.letterUrl) || !/fipi\.ru/.test(O.specUrl))
      bad("[калькулятор-огэ] у официальных чисел нет даты сверки или ссылки на первоисточник");
    const kd = new JSDOM(page, { runScripts: "dangerously" });
    const kdoc = kd.window.document;
    const ch = () => kdoc.getElementById("calc").dispatchEvent(new kd.window.Event("change", { bubbles: true }));
    const итог = () => kdoc.getElementById("csum").textContent + " " + kdoc.getElementById("cmark").textContent;
    kdoc.querySelectorAll("#calc input[type=checkbox]").forEach(i => { i.checked = true; });
    kdoc.querySelectorAll("#calc .pts").forEach(g => { const r = g.querySelectorAll("input"); r[r.length - 1].checked = true; });
    ch();
    if (итог() !== O.total + " «5»") bad("[калькулятор-огэ] всё решено, а итог «" + итог() + "»");
    kdoc.querySelectorAll("#calc input[type=radio][value='0']").forEach(i => { i.checked = true; });
    kdoc.querySelector("#calc input[name=t14][value='3']").checked = true;
    ch();
    if (итог() !== "15 «4»") bad("[калькулятор-огэ] 12 заданий по баллу и 3 за 14-е — а итог «" + итог() + "»");
    if (!/не хватает 2 балла/.test(kdoc.getElementById("cnext").textContent) || !/пройден/.test(kdoc.getElementById("cnext").textContent))
      bad("[калькулятор-огэ] подсказка к 15 баллам: «" + kdoc.getElementById("cnext").textContent + "»");
    kd.window.close();
    if (problems.length === p0) kalkChecked++;
  }

  /* --- [канал]: блок «Канал для репетиторов» на /repetitoru/ (24.09.2026) ---
     Блок собирает tools/kanal.js из content/kanal.json. Сторож: страница =
     сборка; адрес — настоящий адрес своей площадки; без адресов блока нет
     (ссылка на несуществующий канал хуже её отсутствия); с адресом блок
     встаёт с кнопками и оговоркой про Telegram. */
  let kanalChecked = 0;
  {
    const p0 = problems.length;
    const K = require(path.join(root, "tools/kanal.js"));
    const page = fs.readFileSync(path.join(root, K.FILE), "utf8");
    const now = (page.match(K.RX) || [])[0];
    if (!now) bad("[канал] на /repetitoru/ нет меток kanal:start / kanal:end");
    else if (now !== K.render(root))
      bad("[канал] блок на /repetitoru/ разошёлся с content/kanal.json — запустите node tools/kanal.js");
    const c = K.conf(root);
    K.PLACES.forEach(p => {
      const u = String(c[p.key] || "").trim();
      if (u && !p.rx.test(u)) bad("[канал] адрес «" + u + "» не похож на адрес: " + p.label);
    });
    const пусто = K.render(root, { vk: "", max: "", tg: "" });
    if (/href=/.test(пусто)) bad("[канал] без адресов на странице осталась ссылка");
    const полно = K.render(root, { vk: "https://vk.com/fionika_rep", max: "", tg: "https://t.me/fionika_rep" });
    if (!/<section id="kanal">/.test(полно) || (полно.match(/class="btn( ghost)?"/g) || []).length !== 2 || !/VPN|не у всех/.test(полно))
      bad("[канал] с адресами блок собрался не так: " + полно.slice(0, 120));
    if (/style="/.test(полно)) bad("[канал] в блоке инлайн-стиль");
    if (problems.length === p0) kanalChecked++;
  }

  let cardRowChecked = 0;
  {
    const p0 = problems.length;
    const cssP = fs.readFileSync(path.join(root, "css/pages.css"), "utf8");
    if (!/:has\(>\s*\.card:nth-child\(4\):nth-last-child\(1\)\)/.test(cssP))
      bad("[ряд карточек] из pages.css пропало правило «ровно четыре — ровно один ряд» — " +
          "четвёртая карточка снова уедет вниз одна, и справа откроется пустая треть");

    const ПОЛНЫЕ = [1, 2, 3, 4, 6];
    ["vitrina", "roditelyu", "repetitoru", "shkole", "semeynoe-obuchenie",
     "individualnyi-proekt", "baza"].forEach(page => {
      const f = path.join(root, page, "index.html");
      if (!fs.existsSync(f)) return;
      const src = fs.readFileSync(f, "utf8");
      [...src.matchAll(/<div class="cards">([\s\S]*?)\n  <\/div>/g)].forEach(m => {
        const n = (m[1].match(/class="card"/g) || []).length;
        if (ПОЛНЫЕ.indexOf(n) < 0)
          bad("[ряд карточек] " + page + ": в сетке " + n + " карточек — такой ряд " +
              "не заполняется, справа останется дыра. Полные числа: " + ПОЛНЫЕ.join(", "));
      });
    });
    if (problems.length === p0) cardRowChecked++;
  }
  /* --- /repetitoru/: первой дверью — диагностика и проверка кода ---
     Разбор рынка 12.09.2026 (§ 2.7): репетитор — покупатель, на котором
     сходится экономика выхода, и приходит он за двумя вещами — узнать уровень
     нового ученика и не проверять код руками. До 1.170.0 обе стояли третьим и
     четвёртым разделом под общим «Что есть в панели». Порядок разделов на
     странице ничем не стережётся, а значит уедет с первой же правки. */
  {
    const rep = fs.readFileSync(path.join(root, "repetitoru", "index.html"), "utf8");
    const hero = (rep.match(/<header class="hero">([\s\S]*?)<\/header>/) || [])[1] || "";
    if (!/<a class="btn" href="\.\.\/#proverka"/.test(hero))
      bad("[репетитору] главная кнопка шапки не ведёт в проверку нового ученика");
    const ids = [...rep.matchAll(/<section(?: id="([^"]*)")?>/g)].map(m => m[1] || "");
    if (ids[0] !== "proverka" || ids[1] !== "kod")
      bad("[репетитору] первыми разделами обязаны идти диагностика и проверка кода, а стоят: " +
          ids.slice(0, 2).map(x => x || "без имени").join(", "));
  }

  /* --- на Главном нет кнопки без обработчика ---
     ⚠️ Это проверка на КЛАСС ошибок, а не на одну. Разбор 09.09.2026 нашёл на
     Главном две мёртвые кнопки, и обе — по одной причине: в договор модуля
     клали значение (`screenShowcase: screenShowcase`), а само значение
     присваивается ниже по файлу, из другого модуля. На этой строке оно ещё
     undefined, и `onclick = undefined` не падает, не жалуется и выглядит
     нормальной кнопкой. «Что создают ученики» так и стояла мёртвой неизвестно
     сколько; нашлась не тестом, а нажатием.
     Теперь ищет тест: показываем Главный и требуем, чтобы у КАЖДОЙ кнопки
     внутри был обработчик. Исключения перечислены поимённо — каждое со своей
     причиной, и список короткий нарочно: длинный список исключений отменяет
     саму проверку. */
  let liveBtnChecked = 0;
  if (typeof g.screenWorlds === "function"){
    const p0 = problems.length;
    g.state.stars = {}; g.state.log = {};
    const firstL = w.CURRICULUM[0].lessons[0];
    g.state.stars[firstL.id] = 3;
    g.state.log[firstL.id] = { solvedAt: Date.now(), last: Date.now(), attempts: 1 };
    g.state.codeSaved = 0;
    /* ⚠️ Кнопка домашки рисуется, только когда домашка ЗАДАНА, — без этого
       проверка её не видела вовсе. А она ровно из этого класса: в 1.146.0
       экраны домашки уехали в js/screens-hw.js, screenHW стал присваиваться
       ниже по файлу, и отданный значением в договор Главного он был бы
       undefined. Поэтому перед показом ребёнку задана одна задача. */
    const hwOne = (w.HOMEWORK || [])[0];
    g.state.hw = {};
    if (hwOne) g.state.hw[g.hwKey(hwOne.id, 1)] =
      { id: hwOne.id, seed: 1, due: "", by: "репетитор", at: Date.now(), done: 0, tries: 0 };
    /* ⚠️ И кнопка «Начать с разминки» — из того же класса и так же прячется:
       её рисует только карточка «С возвращением», то есть после паузы от
       четырёх дней. У ученика, занимавшегося сегодня, её нет, и проверка была
       к ней слепа. Поймано 15.09.2026 нарочной поломкой разреза разминки
       (1.183.0): screenWarmups, отданный в договор значением, давал мёртвую
       кнопку при зелёном прогоне. Поэтому ребёнок «возвращается» после
       десяти дней. */
    const daysBak = g.state.days;
    const back10 = new Date(); back10.setDate(back10.getDate() - 10);
    g.state.days = {}; g.state.days[g.dayKey(back10)] = 1;
    g.screenWorlds(); await tick();
    if (hwOne && !doc.getElementById("go-hw"))
      bad("[главный] домашка задана, а кнопки домашки на Главном нет — проверка ниже её не увидит");
    if (!doc.getElementById("cbwarm"))
      bad("[главный] после паузы нет кнопки «Начать с разминки» — проверка ниже её не увидит");
    /* [data-help] и [data-theme-set] разбирает общий обработчик на body,
       свой onclick им не ставят; у ссылки-подвала своя привязка по классу. */
    const skip = b => b.hasAttribute("data-help") || b.hasAttribute("data-theme-set") ||
                      b.hasAttribute("data-sfx-set") || b.hasAttribute("data-voice-set") ||
                      b.classList.contains("linkbtn") || b.classList.contains("tab");
    const dead = Array.prototype.slice.call(doc.querySelectorAll("#app button"))
      .filter(b => !skip(b) && typeof b.onclick !== "function")
      .map(b => (b.id || b.className || b.textContent.trim().slice(0, 24)));
    if (dead.length)
      bad("[главный] кнопки без обработчика: " + dead.join(", ") +
          " — такая кнопка выглядит живой и молча не отвечает");
    g.state.hw = {};                 /* заданная выше задача не должна протечь дальше */
    g.state.days = daysBak;          /* и выдуманная пауза тоже */
    if (problems.length === p0) liveBtnChecked++;
    viewReset(g);
  }

  /* --- доступ: код, карточка и «не помню код» ---
     ⚠️ Аккаунта в продукте нет, восстановления тоже — и это не недоделка, а
     плата за обещание «ни почты, ни телефона». Проверяется здесь ровно то,
     что от продукта в такой картине требуется: код доходит до ребёнка ВОВРЕМЯ
     (после первого урока, а не на входе), уносится из браузера одним нажатием
     и нигде не обещается восстановление, которого нет. */
  let accessChecked = 0;
  if (typeof g.markCodeSaved === "function"){
    const p0 = problems.length;
    g.state.codeSaved = 0;
    g.state.stars = {}; g.state.log = {};

    /* 1. Новичку карточки НЕ показываем: первое, что он видит, — самое дорогое
       место экрана, и служебное там стоять не должно (правило 85). */
    g.screenWorlds(); await tick();
    if (doc.getElementById("hmcode"))
      bad("[доступ] новичку показана карточка «запиши код» — на первом экране ей не место");

    /* 2. После первого сданного урока — показываем. */
    const firstL = w.CURRICULUM[0].lessons[0];
    g.state.stars[firstL.id] = 3;
    g.state.log[firstL.id] = { solvedAt: Date.now(), last: Date.now(), attempts: 1 };
    g.screenWorlds(); await tick();
    const box = doc.getElementById("hmcode");
    if (!box) bad("[доступ] после первого урока не напомнили записать код");
    else {
      if (box.textContent.indexOf(w.Cloud.myCode()) < 0)
        bad("[доступ] в напоминании нет самого кода: " + box.textContent);
      const txt = doc.getElementById("app").textContent;
      if (!/восстановить/i.test(txt))
        bad("[доступ] в напоминании не сказано, что кода не восстановить — а это вся причина");
      /* 3. «Записал» гасит карточку навсегда */
      doc.getElementById("hmdone").click(); await tick();
      if (!g.state.codeSaved) bad("[доступ] нажатие «Записал» не отметилось");
      if (doc.getElementById("hmcode"))
        bad("[доступ] карточка осталась после «Записал» — напоминание превратится в шум");
    }

    /* 4. Карточка доступа для печати: имя, код и ссылка-вход на одном листе. */
    g.openAccessCard("test-1a2b", "Тест");
    await tick();
    const cert = doc.getElementById("cert");
    if (!cert || cert.hidden) bad("[доступ] карточка доступа не открылась");
    else {
      const t = doc.getElementById("certbox").textContent;
      if (t.indexOf("test-1a2b") < 0) bad("[доступ] на карточке нет кода");
      if (t.indexOf("?kid=test-1a2b") < 0) bad("[доступ] на карточке нет ссылки-входа");
      if (!/не восстановить|восстановить/i.test(t))
        bad("[доступ] карточка не предупреждает, что кода не восстановить");
      g.closeCert();
    }

    /* 5. ⚠️ Экран «не помню код» НЕ обещает восстановления и не зовёт писать
       людям: ручной поддержки в продукте нет по требованию автономности, а
       почты мы не спрашиваем принципиально. Обещание «поможем восстановить»
       здесь дороже любой другой неправды: его проверяют в худшую минуту. */
    g.screenLostCode(); await tick();
    {
      const t = doc.getElementById("app").textContent;
      if (!/Не помню код/.test(t)) bad("[доступ] экран «не помню код» не открылся");
      if (/напиши(те)? нам|оставь(те)? почту|восстановим|вышлем/i.test(t))
        bad("[доступ] экран обещает восстановление, которого нет: " + t.slice(0, 200));
      if (!/репетитор/i.test(t))
        bad("[доступ] не названа единственная настоящая дорога — взрослый, у которого есть код");
      if (!/\?kid=/.test(t))
        bad("[доступ] не сказано про ссылку-вход, по которой код можно найти в истории браузера");
      /* код в этом браузере есть — значит он показан, а не спрятан за советами */
      if (w.Cloud.myCode() && t.indexOf(w.Cloud.myCode()) < 0)
        bad("[доступ] код лежит в браузере, но экран его не показал");
    }
    if (problems.length === p0) accessChecked++;
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
    /* сброс прогресса в панели репетитора не стирает сделанное ребёнком */
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
    /* в отчёте репетитора вопрос виден */
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
    /* ⚠️ И обратное: всё, что кладёт в однофайловую сборку build.js, обязана
       грузить и сама страница, раньше app.js. Тест гоняет dist, поэтому
       файл, забытый в index.html, давал зелёный прогон при мёртвом сайте
       (нарочная поломка разреза вывески, 17.09.2026, 1.187.0). */
    {
      const bsrc = readRoot("build.js");
      const bm = /const scripts = \[([\s\S]*?)\];/.exec(bsrc);
      const inBuild = bm ? (bm[1].match(/"[^"]+"/g) || []).map(s => s.slice(1, -1)) : [];
      if (inBuild.length < 20) bad("[PWA] не прочёл список файлов сборки в build.js: " + inBuild.length);
      /* порядок модулей между собой не важен (они только регистрируются в
         KVSCREENS), важно одно: все они грузятся РАНЬШЕ app.js */
      const appAt = need.indexOf("js/app.js");
      inBuild.forEach(u => {
        const at = need.indexOf(u);
        if (at < 0) bad(`[PWA] файл ${u} есть в сборке, а index.html его не грузит — сайт сломается`);
        else if (appAt >= 0 && at > appAt) bad(`[PWA] файл ${u} index.html грузит ПОСЛЕ app.js — договор модуля не найдётся`);
      });
    }
    /* и наоборот: в кэше не должно быть того, чего нет на диске */
    const shell = [];
    sw.replace(/"\.\/([^"]*)"/g, (m, u) => { shell.push(u); return m; });
    shell.forEach(u => {
      if (u && !fs.existsSync(path.join(root, u)))
        bad(`[PWA] в кэше sw.js записан несуществующий файл: ${u}`);
    });
    /* ⚠️ ДВА КОНТУРА (docs/golos-i-produkty-2026-09-06.md § 3.7). Обещание
       «1,7 МБ и офлайн сразу» обязано оставаться правдой для всех, кто кнопку
       «настоящий Python» не нажимал. Значит тяжёлый движок не попадает ни в
       оболочку service worker, ни в сборку одним файлом, ни в <script> на
       странице. Это проверка, а не намерение: 13 МБ, случайно уехавшие в
       SHELL, никто бы не заметил до первого офлайна. */
    if (/vendor/.test(sw))
      bad("[два контура] тяжёлый движок попал в кэш sw.js — офлайн-оболочка распухнет на 13 МБ");
    if (/<script src="vendor/.test(idx))
      bad("[два контура] index.html грузит тяжёлый движок сам — он обязан ждать нажатия кнопки");
    if (/vendor/.test(readRoot("build.js")))
      bad("[два контура] build.js вшивает тяжёлый движок в один файл");
    /* Сборка одним файлом обещает «всё внутри». Тяжёлого движка в ней нет,
       поэтому и кнопки быть не должно — иначе она вела бы в никуда. */
    if (typeof g.pyPossible === "function" && g.pyPossible())
      bad("[два контура] в сборке одним файлом предлагается настоящий Python, которого рядом нет");
    if (typeof g.pyCardHTML === "function" && g.pyCardHTML(false, false) !== "")
      bad("[два контура] карточка движка рисуется там, где движка нет");
    const distMb = fs.statSync(file).size / 1048576;
    if (distMb > 3)
      bad(`[два контура] один файл вырос до ${distMb.toFixed(1)} МБ — обещание «лёгкий продукт» больше не правда`);
    /* И наоборот: кнопка обещает файлы, поэтому файлы обязаны лежать. */
    ["pyodide.js", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]
      .forEach(f => {
        if (!fs.existsSync(path.join(root, "vendor/pyodide", f)))
          bad(`[два контура] обещан настоящий Python, а файла vendor/pyodide/${f} нет — кнопка сломана`);
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
    /* Кнопка «Назад» шестым инструментом НЕ считается и считаться не должна:
       инструменты отвечают «что ещё можно сделать», а это дорога назад. */
    if (!doc.getElementById("btn-back")) bad("[устройство] в панели нет кнопки «Назад»");
    if (doc.querySelector(".top-in .tbtn#btn-back"))
      bad("[устройство] «Назад» записана в инструменты — она навигация, а не инструмент");

    /* ⚠️ Новичку предложение поставить приложение не показывается. Оно стояло
       первым блоком на Главном: первое, что видел ребёнок в первый заход, —
       «адресная строка» и «меню браузера». Он пришёл писать код. */
    {
      /* ⚠️ Проверяем ПРАВИЛО, а не разметку: в однофайловой сборке ставить
         нечего (нет манифеста), поэтому баннера там не будет никогда, и
         проверка по DOM молча прошла бы, ничего не проверив (грабля 59). */
      const starsWas = JSON.parse(JSON.stringify(g.state.stars));
      g.state.stars = {};
      if (g.installReady())
        bad("[новичок] предложение поставить приложение готово тому, кто не сделал ни урока");
      for (let i = 0; i < g.INSTALL_AFTER; i++) g.state.stars["ur" + i] = 3;
      if (g.installPossible() !== g.installReady())
        bad("[новичок] после " + g.INSTALL_AFTER + " уроков предложение так и не появилось");
      g.state.stars = starsWas;
      viewReset(g);
    }

    /* Мастерская обязана быть видна с Главного: про полку ребёнок узнавал
       только из окна победы урока, а накопление, которого не видно, не
       удерживает. */
    {
      g.screenWorlds(); await tick();
      if (!doc.getElementById("goshop")) bad("[главное] на Главном нет входа в мастерскую");
      else {
        doc.getElementById("goshop").click(); await tick();
        if (!/Полка и верстак/.test(doc.getElementById("app").textContent))
          bad("[главное] кнопка мастерской ведёт не туда");
      }
      viewReset(g);
    }

    /* Внутренний язык на детских экранах: «вне сотни уроков» — это наша
       формулировка, а не детская. В подписях-чипах её быть не должно. */
    {
      const screens = [() => g.screenTrain(), () => g.screenFolio(),
                       () => g.screenMyTasks(), () => g.screenReview()];
      for (const go of screens){
        go(); await tick();
        const chips = [...doc.querySelectorAll(".lvlhead .idx, .lvlhead .tag, .sect .cnt")]
          .map(x => x.textContent.trim());
        chips.forEach(c => {
          if (/вне сотни/i.test(c))
            bad("[новичок] в подписи остался наш внутренний язык: " + JSON.stringify(c));
        });
      }
      viewReset(g);
    }

    /* Дорога назад обязана быть на КАЖДОМ экране, кроме Главного: раньше уйти
       можно было только кнопкой в самом низу страницы, то есть за экраном. */
    {
      const back = doc.getElementById("btn-back");
      g.screenWorlds(); await tick();
      if (!back.hidden) bad("[назад] на Главном кнопка «Назад» показана — возвращаться некуда");
      const screens = [
        ["Тренировки", () => g.screenTrain()],
        ["витрина", () => g.screenShowcase()],
        ["портфолио", () => g.screenFolio()],
        ["мастерская", () => g.screenShop()],
        ["свои задания", () => g.screenMyTasks()],
        ["разминки", () => g.screenWarmups()],
        ["игры", () => g.screenGames()],
        ["песочница", () => g.screenSandbox()],
        ["визуализатор", () => g.screenViz()],
        ["«Ты и ИИ»", () => g.screenAILab()],
        ["повторить", () => g.screenReview()],
        ["сегодня", () => g.screenToday()],
        ["инструкция", () => g.screenGuide()],
        ["профиль", () => g.screenAccount()]
      ];
      for (const [name, go] of screens){
        go(); await tick();
        if (back.hidden) bad("[назад] на экране «" + name + "» нет кнопки «Назад»");
        else if (!back.textContent.trim()) bad("[назад] на экране «" + name + "» кнопка без подписи");
      }
      /* и она правда уводит: с витрины — на Главное */
      g.screenShowcase(); await tick(60);
      back.click(); await tick();
      if (!doc.querySelector(".worlds, .world"))
        bad("[назад] кнопка с витрины не увела на Главное");
      viewReset(g);
    }

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
    /* ⚠️ «Экзамены» стоят между уроками и тренировками с 08.09.2026, и порядок
       здесь — не вкусовщина. Раньше ОГЭ и ЕГЭ лежали двумя карточками в ряду
       тренировок, над которым написано «без звёзд, по желанию»: единственное,
       за что родитель платит деньгами, стояло под вывеской «необязательное».
       Выше уроков экзамен при этом не поднимаем: курс остаётся главным. */
    const want = ["Уроки", "Экзамены", "Тренировки", "Моё", "Достижения"];
    if (heads().join(",") !== want.join(","))
      bad("[устройство] блоки Главного не те: " + heads().join(","));
    /* Раздел экзаменов ведёт на обе карты, на вариант и на Робота */
    ["ege", "oge", "variant", "robot"].forEach(k => {
      if (!doc.querySelector('[data-exam="' + k + '"]'))
        bad("[устройство] с Главного не попасть в экзамены: " + k);
    });
    /* Все тренировки — в один клик с Главного. Число не зашито: разделы
       добавляются (в 1.51.0 пришла «Приёмка»), а вот превратиться в свалку
       список не должен — за этим и следит верхняя граница.
       ⚠️ Экзамен и вариант в этом ряду НЕ показываются: они стоят своим
       разделом выше, а одна дверь в двух местах одного экрана читается не как
       «заметнее», а как «выбирай, какая настоящая». */
    const trainN = doc.querySelectorAll("[data-train]").length;
    const trainWant = g.trainCards()
      .filter(c => c.id !== "algo" && c.id !== "variant" && c.id !== "robot").length;
    if (trainN !== trainWant)
      bad("[устройство] на Главном показаны не все тренировки: " + trainN +
          " из " + trainWant);
    if (trainN > 8) bad("[устройство] тренировок на Главном стало " + trainN + " — это уже свалка");
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

    /* Экран «Тренировки»: у каждого раздела сказано зачем и когда */
    g.screenTrain(); await tick();
    const cards = doc.querySelectorAll(".traincard");
    if (cards.length !== g.trainCards().length)
      bad("[устройство] на «Тренировках» " + cards.length + " карточек из " + g.trainCards().length);
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
                    "viz","account","register","guide","admin","stars","worlds","tools","path","worlddone"];
    places.forEach(k => {
      const e = g.HELP[k];
      if (!e) return bad("[помощь] нет текста для места «" + k + "»");
      if (!e.t || !e.h) bad("[помощь] пустая подсказка для «" + k + "»");
    });

    /* ⚠️ И главное: список выше перечислен РУКАМИ, поэтому новый экран в него
       не попадает сам — именно так восемь экранов (Робот, Алгоритмы, Домашка,
       Приёмка, Мастерская, витрина работ и экраны одной задачи) полтора месяца
       показывали подсказку про ГЛАВНЫЙ экран: helpFor откатывается на
       HELP.home, и это не падение, а тихая неправда. Обещание из index.html —
       «"?" отвечает для ЛЮБОГО экрана», и сверяем мы его с МАРШРУТАМИ, а не со
       списком. Найдено ревизией 18.09.2026.
       Кабинеты взрослого сюда не входят: «?» — инструмент детской панели. */
    {
      const взрослые = ["adult","admin","group","kids","kid","parent","zan","roles","liveview"];
      const нет = [];
      (g.ROUTES || []).forEach(r => {
        const p = r.place;
        if (!p || взрослые.indexOf(p) >= 0) return;
        if (!g.HELP[p]) нет.push(p);
      });
      if (нет.length)
        bad("[помощь] у экранов " + [...new Set(нет)].join(", ") + " нет своей подсказки — " +
            '"?" покажет там текст про Главный экран, а index.html обещает ответ для любого экрана');
    }

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
    /* ⚠️ Подсказка «Сегодня» больше НЕ рассказывает про щиты и про серию:
       щит работает молча (план, п. 4.4). Проверяем обратное — что рассказ не
       вернулся, — и что на месте него стоит уговор. */
    if (/щит/i.test(g.HELP.today.h))
      bad("[помощь] в подсказке «Сегодня» снова рассказывают про щиты");
    if (/подряд/i.test(g.HELP.today.h))
      bad("[помощь] в подсказке «Сегодня» снова считают дни подряд");
    if (!/уговор/i.test(g.HELP.today.h))
      bad("[помощь] в подсказке «Сегодня» не сказано про уговор");
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

    /* --- наборы оформления: награда за выпускной мира (2.5) ---
       ⚠️ Главное здесь не цвет, а замок: набор, который можно включить, не
       пройдя мир, отменяет саму награду. И обратное: чужой набор обязан
       слететь сам, когда на общем устройстве сменился ученик. */
    if (typeof g.skinSet === "function"){
      const keepStars = g.state.stars, keepProj = g.state.projects;
      g.state.stars = {}; g.state.projects = {};
      w.localStorage.removeItem("kodokvest_skin");
      g.skinApply();
      if (doc.documentElement.getAttribute("data-skin"))
        bad("[набор] у новичка стоит набор, которого он не открывал");
      if (g.skinsOpen().length)
        bad("[набор] при нулевом прогрессе уже что-то открыто: " +
            JSON.stringify(g.skinsOpen().map(x => x.id)));
      if (g.skinSet("rostok") !== false)
        bad("[набор] закрытый набор дали включить — награда за мир перестала быть наградой");
      if (doc.documentElement.getAttribute("data-skin"))
        bad("[набор] закрытый набор всё-таки встал на страницу");
      /* плитка обязана честно говорить, ЧЕМ откроется закрытый набор */
      const pick = g.skinPickHTML();
      if (!/откроется за мир 1/.test(pick))
        bad("[набор] в плитке не написано, чем открывается закрытый набор");
      if (!/Росток/.test(pick)) bad("[набор] закрытые наборы спрятаны — за что их дают, не видно");

      /* проходим первый мир целиком вместе с проектом */
      const w1 = w.CURRICULUM.world(1);
      w1.lessons.forEach(l => { g.state.stars[l.id] = 3; });
      const p1 = g.projectOfWorld(1);
      if (p1) g.state.projects[p1.id] = { done:true, at:Date.now(), steps:{} };
      if (!g.worldGraduated(1))
        bad("[набор] мир пройден целиком, а выпускной не наступил — проверка набора ничего не значит");
      else {
        if (!g.skinSet("rostok")) bad("[набор] открытый набор не включился");
        if (doc.documentElement.getAttribute("data-skin") !== "rostok")
          bad("[набор] выбранный набор не встал на страницу");
        if (g.skinNow().em !== "🌱") bad("[набор] у набора нет своего значка");
        /* значок набора обязан появиться на кнопке профиля: награда, которую
           не видно каждый день, наградой не работает */
        g.refreshTop();
        const bw = doc.getElementById("btn-who");
        if (bw && bw.textContent !== "🌱")
          bad("[набор] значок набора не попал на кнопку профиля: " + (bw && bw.textContent));
        /* ⚠️ сменился ученик — чужой набор слетает сам */
        g.state.stars = {}; g.state.projects = {};
        g.skinApply();
        if (doc.documentElement.getAttribute("data-skin"))
          bad("[набор] после сброса прогресса закрытый набор остался на странице");
        if (g.skinNow().id !== "base")
          bad("[набор] после сброса прогресса действующим считается закрытый набор");
      }
      /* у каждого набора обязаны быть свои цвета в стилях: набор без правила
         молча ничего не меняет, и «награда» оказывается пустой */
      g.SKINS.filter(x => x.world).forEach(sk => {
        if (cssText.indexOf('[data-skin="' + sk.id + '"]') < 0)
          bad("[набор] в стилях нет цветов набора «" + sk.id + "»");
        if (cssText.indexOf('[data-theme="dark"][data-skin="' + sk.id + '"]') < 0)
          bad("[набор] у набора «" + sk.id + "» нет отдельного блока для тёмной темы — " +
              "он перекрасит её в светлые цвета");
      });
      g.state.stars = keepStars; g.state.projects = keepProj;
      w.localStorage.removeItem("kodokvest_skin");
      g.skinApply();
      g.refreshTop();
    }

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
    /* Документы к защите (1.142.0) — второй слой, который печатают. Их
       правила обязаны жить в ЭТОМ же блоке: отдельный блок стоял раньше по
       файлу, и эта проверка приняла его за сломанную печать. */
    if (!/body\s*>\s*\.doc:not\(\[hidden\]\)/.test(печать))
      bad("[печать] документы к защите не возвращаются на печать");
    if (!/\.docbar\s*\{[^}]*display\s*:\s*none/.test(печать))
      bad("[печать] кнопки документов к защите уедут на бумагу");
    /* Кроме сертификата и документов к защите на печати не должно всплывать
       ничего: любое другое `display:block` внутри блока — ещё один элемент на листе. */
    const возвраты = (печать.match(/^\s*([^{}\n]+)\{[^}]*display\s*:\s*(block|flex|grid)/gm) || [])
      .map(x => x.split("{")[0].trim());
    возвраты.forEach(sel => {
      if (!/\.cert|\.doc/.test(sel))
        bad("[печать] на бумагу возвращается не сертификат и не документ: " + sel);
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

    /* Замки должны быть НА МЕСТЕ: панель репетитора в проверках выше их
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
  let hwChecked = 0, reportChecked = 0, returnChecked = 0, liveChecked = 0, kbChecked = 0;
  let timeFmtChecked = 0, homeChecked = 0;
  let authorChecked = 0, myPredChecked = 0, shopChecked = 0, backChecked = 0, showChecked = 0;
  let myExamChecked = 0;
  let groupChecked = 0, specChecked = 0, aiPackChecked = 0, algoChecked = 0, engineChecked = 0;
  let variantChecked = 0;
  let proverkaChecked = 0;
  let proverka2Checked = 0;
  let zqChecked = 0;
  let ladderChecked = 0, noteChecked = 0;
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

    /* [синхронизация] (24.09.2026): рабочий тик ставит отправку на сервер, тик
       паузы — нет. Раньше открытый урок без ребёнка слал снимок раз в 25 с
       бесконечно, и «сейчас в тренажёре» (по времени последней записи) горело
       у родителя, пока вкладка открыта. */
    {
      const былКод = w.Cloud.myCode();
      w.Cloud.setCode("zamer-sinhr");
      g.cancelPush();
      g.setIdleForTest(600000); g.actMark(); g.tickOnce();
      if (!g.cloudState.timer) bad("[синхронизация] рабочий тик не поставил отправку — присутствие и время не уедут");
      g.cancelPush();
      g.setIdleForTest(0); g.tickOnce();
      if (g.cloudState.timer) bad("[синхронизация] тик паузы поставил отправку на сервер — забытая вкладка снова пишет без конца");
      g.cancelPush();
      if (былКод) w.Cloud.setCode(былКод); else w.Cloud.forgetCode();
      /* «есть ли что отправить» не зависит от порядка полей и savedAt */
      const x = { savedAt: 1, stars: { a: 3, b: 1 }, days: ["2026-09-01"] };
      const y = { days: ["2026-09-01"], stars: { b: 1, a: 3 }, savedAt: 999 };
      if (g.progressKey(x) !== g.progressKey(y)) bad("[синхронизация] одинаковый прогресс признан разным — отправка при каждом открытии вернётся");
      if (g.progressKey(x) === g.progressKey({ savedAt: 1, stars: { a: 3, b: 2 }, days: ["2026-09-01"] }))
        bad("[синхронизация] разный прогресс признан одинаковым — своё с устройства не уедет на сервер");
    }
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

    /* ⚠️ Первое занятие после паузы — короче и входит со знакомого (4.3б).
       Полный план после недельного пропуска — это ровно та цена входа, из-за
       которой возвращение и не случается, а карточка «С возвращением» рядом
       обещает обратное. */
    {
      const nowMs = Date.now(), dayMs = 864e5;
      const keepDays = g.state.days, keepStars = g.state.stars,
            keepLog = g.state.log, keepReview = g.state.review;
      g.state.stars = {}; g.state.log = {}; g.state.review = {};
      /* два урока сданы дорого и давно — значит долг по повторам есть */
      ["print-first", "text-vs-num"].forEach(function(id){
        g.state.stars[id] = 3;
        g.state.log[id] = { attempts:3, hints:2, shown:0,
                            solvedAt: nowMs - 30*dayMs, last: nowMs - 30*dayMs };
      });
      g.state.days = {}; g.state.days[g.dayKey()] = 1;
      if (g.zanAfterPause()) bad("[пауза] паузу насчитали тому, кто занимался сегодня");
      const planFull = g.zanPlanFor(g.dayKey());
      g.state.days = {}; g.state.days[g.dayKey(new Date(nowMs - 9*dayMs))] = 1;
      if (!g.zanAfterPause()) bad("[пауза] девять дней без занятий паузой не считаются");
      const planBack = g.zanPlanFor(g.dayKey());
      if (!(planBack.length < planFull.length))
        bad("[пауза] план после паузы не стал короче: " + planBack.length +
            " шагов против " + planFull.length);
      const firstWork = planBack.filter(function(b){ return b.k !== "warm"; })[0];
      if (!firstWork || firstWork.k !== "review")
        bad("[пауза] после паузы вход идёт не со знакомого: " + JSON.stringify(firstWork));
      /* взрослый попросил «только новое» — повтор не подставляем, но короче всё равно */
      g.frameSet({ mix:"new" });
      const planNew = g.zanPlanFor(g.dayKey());
      if (planNew.some(function(b){ return b.k === "review"; }))
        bad("[пауза] повтор подставлен вопреки рамке «только новое»");
      if (!(planNew.length < planFull.length))
        bad("[пауза] при рамке «только новое» занятие после паузы не сократилось");
      g.frameSet({ mix:"balanced" });
      /* экран занятия обязан сказать, почему сегодня короче, и без упрёка */
      g.screenZan();
      await tick();
      const tz = doc.getElementById("app").textContent;
      if (!/занятие короче/.test(tz))
        bad("[пауза] экран занятия молчит о том, что сегодня план короче");
      if (/пропуст|прогул|виноват|забросил|не занимался \d/i.test(tz))
        bad("[пауза] экран занятия упрекает за перерыв: " + tz.slice(0, 200));
      g.state.days = keepDays; g.state.stars = keepStars;
      g.state.log = keepLog; g.state.review = keepReview;
      g.state.days[g.dayKey()] = 1;      /* дальше секция считает день рабочим */
    }

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
      const back = doc.getElementById("btn-back");
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

    /* --- 3о. рамка взрослого сильнее расписания ребёнка — И НА ЕГО ЭКРАНЕ.
       ⚠️ Разбор трёх ролей 12.09.2026: в шапке рамки было написано, что она
       сильнее, а «Сегодня» — главный экран ребёнка — читал только своё
       расписание. Репетитор ставил занятия по субботам, ребёнок видел
       «Уговор пока не назначен» и «сегодня можно отдыхать». --- */
    {
      const сб = 6, today = g.dayKey(), wdToday = new Date(today + "T12:00:00").getDay();
      g.state.schedule.days = [];
      g.frameSet({ days:[сб], time:"17:00", until:null, breaks: [] });
      if (!g.agreedOn()) bad("[рамка] с рамкой взрослого «уговора» не видно");
      if (g.agreedDays().join() !== String(сб))
        bad("[рамка] дни уговора взяты не из рамки: " + g.agreedDays().join());
      /* своё расписание ребёнка рамку НЕ перебивает */
      g.state.schedule.days = [1,2,3];
      if (g.agreedDays().join() !== String(сб))
        bad("[рамка] расписание ребёнка перебило рамку взрослого: " + g.agreedDays().join());
      /* а без рамки возвращается своё — рамку сняли, уговор ребёнка вернулся */
      g.frameSet({ days: [] });
      if (g.agreedDays().join() !== "1,2,3")
        bad("[рамка] без рамки своё расписание не вернулось: " + g.agreedDays().join());

      /* и это видно НА ЭКРАНЕ, а не только в функции */
      g.state.schedule.days = [];
      g.frameSet({ days:[wdToday], time:"17:00" });
      g.state.days = {};
      g.screenToday(); await tick();
      const tt = doc.getElementById("app").textContent;
      if (/Уговор пока не назначен/.test(tt))
        bad("[рамка] на «Сегодня» уговор не назначен, хотя рамка взрослого стоит");
      if (!/Сегодня по уговору учебный день/.test(tt))
        bad("[рамка] рамка назначила занятие на сегодня, а «Сегодня» этого не говорит");
      if (!/17:00/.test(tt))
        bad("[расписание] час занятия не доехал до экрана ребёнка");
      g.frameSet({ days:[1,2,3,4,5], time:null });
      g.state.schedule.days = [];
    }

    /* --- 3а. время занятия, горизонт и календарь (просьба фаундера 12.09.2026:
       «суббота в 17:00, и так на месяц-два-три») --- */
    {
      /* ⚠️⚠️ Загрузка ПРИ УЖЕ СОХРАНЁННОМ часе. Оплачено ошибкой 12.09.2026:
         регулярка часа лежала в `var TIME_RE` на строке 463, а ensureShape(S)
         зовётся на 199 — и у всякого, у кого час уже был сохранён, тренажёр
         падал при загрузке ещё до первой отрисовки. Тесты молчали: на чистом
         состоянии time равен null, и до регулярки дело не доходило. Нашлось
         глазами в браузере (§ 4.7), а не прогоном.
         Проверяем ОБА конца: что форма переживает сохранённый час и что в
         исходнике час разбирается поднимаемым объявлением, а не константой,
         которой может не оказаться. */
      {
        let живо = true;
        try { g.ensureShape({ frame: { days:[6], time:"17:00", len:30 } }); }
        catch(e){ живо = false; bad("[расписание] сохранённый час роняет разбор прогресса: " + e.message); }
        if (живо){
          const ш = g.ensureShape({ frame: { days:[6], time:"17:00", len:30 } });
          if (!ш.frame || ш.frame.time !== "17:00")
            bad("[расписание] сохранённый час потерялся при разборе: " + JSON.stringify(ш.frame));
        }
        const src = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
        if (/var\s+TIME_RE\s*=/.test(src))
          bad("[расписание] час снова разбирается через var — он присваивается позже, " +
              "чем ensureShape(S) его зовёт, и тренажёр упадёт при загрузке");
        if (!/function\s+validTime\s*\(/.test(src))
          bad("[расписание] нет поднимаемого разбора часа (validTime)");
      }

      /* ⚠️ Замер занятий и запись авторства обязаны считаться ПО СНИМКУ
         УЧЕНИКА, а не по своему состоянию. Ровно эта ошибка уже стоила
         кабинету родителя трёх карточек (разбор трёх ролей 12.09.2026), и
         она же в 1.130.0 заставляла paceCheck обещать родителю чужую дату:
         функция считала по прогрессу САМОГО РЕПЕТИТОРА. */
      {
        const тНыне = Date.now(), тСутки = 864e5;
        const мой = g.state.zan, мойЛог = g.state.log;
        g.state.zan = {}; g.state.log = {};
        const чужой = g.ensureShape({ zan:{}, log:{} });
        for (let i = 0; i < 6; i++)
          чужой.zan[g.dayKey() + "#" + i] = { end: тНыне - i*тСутки, sec: 1800, done: ["lesson:a", "lesson:b"] };
        const замер = g.zanStats(чужой);
        if (замер.n !== 6)
          bad("[замер] по снимку ученика занятий посчитано " + замер.n + " вместо шести");
        if (g.zanStats().n !== 0)
          bad("[замер] свой замер перестал считаться по своему состоянию: " + g.zanStats().n);
        /* запись авторства — так же по снимку */
        чужой.log["print-first"] = { tr: { len: 200, slen: 0, edits: 1, pasted: 300, at: тНыне } };
        const запись = g.authorSummary(чужой);
        if (!запись.n)
          bad("[замер] запись авторства по снимку ученика пуста — считается не по нему");
        if (g.authorSummary().n)
          bad("[замер] своя запись авторства подхватила чужой снимок");
        g.state.zan = мой; g.state.log = мойЛог;
      }

      /* час проверяется, а не берётся на веру: «25:00» и «17» — не время */
      g.frameSet({ time:"25:00" });
      if (g.frameTime()) bad("[расписание] негодный час принят: " + g.frameTime());
      g.frameSet({ time:"17" });
      if (g.frameTime()) bad("[расписание] час без минут принят: " + g.frameTime());
      g.frameSet({ time:"17:00" });
      if (g.frameTime() !== "17:00") bad("[расписание] годный час не сохранился: " + g.frameTime());

      /* «+1 месяц» от конца месяца не перепрыгивает месяц целиком */
      if (g.addMonths("2026-01-31", 1) !== "2026-02-28")
        bad("[расписание] 31 января + месяц = " + g.addMonths("2026-01-31", 1) + ", ожидалось 28 февраля");
      if (g.addMonths("2026-11-30", 2) !== "2027-01-30")
        bad("[расписание] переход через год посчитан неверно: " + g.addMonths("2026-11-30", 2));

      /* план по субботам: только субботы, и ровно до горизонта */
      const today = g.dayKey();
      const until = g.addMonths(today, 2);
      g.frameSet({ days:[6], time:"17:00", until: until, breaks: [] });
      const plan = g.planDates(0);
      if (!plan.length) bad("[расписание] план по субботам пуст");
      if (plan.some(k => new Date(k + "T12:00:00").getDay() !== 6))
        bad("[расписание] в план по субботам попал другой день: " + plan.slice(0, 5).join(", "));
      if (plan[plan.length - 1] > until)
        bad("[расписание] план вылез за горизонт: " + plan[plan.length - 1] + " > " + until);
      if (plan.length < 7 || plan.length > 10)
        bad("[расписание] за два месяца суббот " + plan.length + " — это не похоже на правду");

      /* каникулы вычитаются из плана, а не просто отмечаются */
      const skipped = plan[1];
      g.frameSet({ breaks: [[skipped, skipped]] });
      const plan2 = g.planDates(0);
      if (plan2.indexOf(skipped) >= 0)
        bad("[расписание] занятие назначено на день каникул: " + skipped);
      if (plan2.length !== plan.length - 1)
        bad("[расписание] каникулы убрали не одно занятие: " + plan.length + " → " + plan2.length);

      /* файл календаря: повтор, горизонт, длина, напоминание и исключение */
      const ics = g.icsForFrame("Роман");
      if (!/BEGIN:VCALENDAR/.test(ics) || !/END:VCALENDAR/.test(ics))
        bad("[расписание] файл календаря не собрался");
      if (!/RRULE:FREQ=WEEKLY;BYDAY=SA;UNTIL=/.test(ics))
        bad("[расписание] в файле нет повтора по субботам: " + ics.slice(0, 400));
      if (!/DTSTART:\d{8}T170000/.test(ics))
        bad("[расписание] время начала в файле не 17:00");
      if (!/DTEND:\d{8}T173000/.test(ics))
        bad("[расписание] конец занятия не через 30 минут (длина рамки)");
      if (!/TRIGGER:-PT30M/.test(ics)) bad("[расписание] в файле нет напоминания");
      if (ics.indexOf("EXDATE:" + skipped.replace(/-/g, "") + "T170000") < 0)
        bad("[расписание] день каникул не исключён из файла календаря");
      if (ics.indexOf("Роман") < 0) bad("[расписание] имя ученика не попало в название события");
      /* ⚠️ Строки .ics разделяются CRLF — с одним \n Календарь файл не примет */
      if (/[^\r]\n/.test(ics)) bad("[расписание] в файле календаря перенос строки без CR");

      /* без часа файла нет — и это молчание, а не пустой файл */
      g.frameSet({ time: null });
      if (g.icsForFrame("Роман") !== "")
        bad("[расписание] файл календаря собрался без времени занятия");
      g.frameSet({ time:"17:00", breaks: [] });

      /* час виден там, где ребёнок и родитель его ищут */
      g.state.stars = {}; g.state.stars["print-first"] = 3;
      const nt = g.nextTimeHTML();
      if (!/в 17:00/.test(nt))
        bad("[расписание] в карточке «в следующий раз» нет часа занятия: " + nt.replace(/<[^>]+>/g, " ").slice(0, 160));
      g.frameSet({ days:[1,2,3,4,5], time:null, until:null });
    }

    /* кабинет открывается и показывает карту часов */
    g.adminUnlock();
    g.screenAdult();
    await tick();
    const t = doc.getElementById("app").textContent;
    if (!/Рамка занятий/.test(t)) bad("[кабинет] нет рамки занятий");

    /* ⚠️ Кабинет на устройстве ребёнка — ВКЛАДКАМИ, как карточка ученика.
       Жалоба фаундера 12.09.2026: «надо сделать человеческие личные кабинеты».
       Корень был не в словах: один и тот же кабинет выглядел двумя разными
       экранами — карточка ученика на вкладках с 08.09, а этот простынёй из
       девяти карточек на четыре экрана прокрутки. */
    {
      const utabs = [...doc.querySelectorAll("[data-utab]")].map(b => b.textContent);
      if (utabs.length !== 4)
        bad("[кабинет] в кабинете взрослого не четыре вкладки: " + utabs.join(" | "));
      ["Отчёт", "Расписание", "Задание", "Разделы"].forEach(n => {
        if (!utabs.some(x => x.indexOf(n) >= 0))
          bad("[кабинет] в кабинете взрослого нет вкладки «" + n + "»");
      });
      const upanes = [...doc.querySelectorAll("[data-upane]")];
      if (upanes.length !== 4) bad("[кабинет] панелей кабинета не четыре: " + upanes.length);
      if (upanes.filter(p => !p.hidden).length !== 1)
        bad("[кабинет] видимых панелей кабинета не одна — вкладки не работают");
      /* ⚠️ Ни одна карточка не потеряна при раскладке по вкладкам. Список
         снят с прежнего экрана: именно это и ломается, когда двигают куски
         разметки — карточка исчезает молча, и никто не замечает месяцами. */
      ["Последнее занятие", "Когда он занимался", "Что показывает практика",
       "Рамка занятий", "Как шла работа", "учится про ИИ", "Что создают ученики",
       "Задать задание ребёнку", "Что было за неделю"].forEach(n => {
        if (t.indexOf(n) < 0)
          bad("[кабинет] при раскладке по вкладкам потеряна карточка «" + n + "»");
      });
      /* клик по вкладке показывает ЕЁ панель, а не чужую */
      const uf = [...doc.querySelectorAll("[data-utab]")].find(b => /Задание/.test(b.textContent));
      if (uf){
        uf.click();
        const vis = [...doc.querySelectorAll("[data-upane]")].filter(p => !p.hidden);
        if (vis.length !== 1 || vis[0].getAttribute("data-upane") !== "task")
          bad("[кабинет] клик по «Заданию» показал панель «" +
              (vis[0] && vis[0].getAttribute("data-upane")) + "»");
      }
      /* ⚠️ Кнопка внизу ведёт на карту миров РЕБЁНКА, и называться обязана
         так же: «На главную» здесь означало бы кабинет (§ 4.21). */
      const low = [...doc.querySelectorAll('[data-act="tomap"]')];
      if (low.length && /На главную/.test(low[low.length - 1].textContent))
        bad("[кабинет] кнопка на карту миров ребёнка названа «На главную» — " +
            "в кабинете это читается как «в кабинет»");
    }
    if (!/Когда он занимался/.test(t)) bad("[кабинет] нет карты активности");
    if (!/Задать задание/.test(t)) bad("[кабинет] нет «задать задание»");
    if (!doc.querySelector(".heat i")) bad("[кабинет] карта часов не отрисовалась");
    /* сводка над вкладками (1.148.0, слита с вкладками 1.155.0): четыре
       числа видны до выбора вкладки */
    if (!doc.querySelector(".cabsum .admstat")) bad("[кабинет] сводка над вкладками не отрисовалась");
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

  /* --- 4а. домашка от репетитора ---
     Проверяем ровно то, ради чего механика построена: задача приходит от
     взрослого, судит её движок, требования конструкции обойти нельзя,
     на прогресс по курсу она не влияет, а просрочка ничего не сжигает. */
  if (typeof g.hwPending === "function"){
    const p0 = problems.length;
    const bank = w.HOMEWORK || [];
    if (!bank.length) bad("[домашка] банк задач-близнецов не загрузился");

    g.state.hw = {};
    const starsBefore = Object.keys(g.state.stars).length, xpBefore = g.state.xp;

    /* 4а.1. Доступность по прогрессу: пока урок не пройден, задачи нет.
       Это защита от самой частой ошибки взрослого — «пусть подтянется вперёд». */
    if (g.hwAvailableFor({ stars:{} }).length)
      bad("[домашка] при нулевом прогрессе взрослому предлагают задачи — ребёнку дадут необъяснённое");
    const item = bank[0];
    const okList = g.hwAvailableFor({ stars: { [item.after]: 3 } });
    if (!okList.some(x => x.id === item.id))
      bad("[домашка] урок пройден, а задача-близнец всё равно закрыта");

    /* 4а.2. Семя: одинаковое у ребёнка и у репетитора, разное у разных детей. */
    const day = g.dayKey();
    if (g.hwSeed("kid-a", item.id, day) !== g.hwSeed("kid-a", item.id, day))
      bad("[домашка] семя задачи не воспроизводится — условия у ребёнка и репетитора разойдутся");
    if (g.hwSeed("kid-a", item.id, day) === g.hwSeed("kid-b", item.id, day))
      bad("[домашка] у разных учеников совпало семя — условие будет одно на всех");

    /* 4а.3. Выдача так, как её пишет кабинет взрослого. */
    const seed = g.hwSeed("kid-a", item.id, day);
    const key = g.hwKey(item.id, seed);
    g.state.hw[key] = { id:item.id, seed:seed, due:g.hwDefaultDue(),
                        by:"репетитор", at:Date.now(), done:0, tries:0 };
    if (g.hwPending().length !== 1) bad("[домашка] заданная задача не попала в список несделанных");
    const built = g.hwBuild(g.hwPending()[0]);
    if (!built) bad("[домашка] задача не собралась в игре");
    else {
      if (!built.lines.length) bad("[домашка] у задачи пустой правильный ответ");
      if (!built.goal || built.goal.length < 40) bad("[домашка] условие пустое или слишком короткое");
    }

    /* 4а.4. Экран открывается, задача открывается, решение засчитывается. */
    g.screenHW();
    await tick();
    const card = doc.querySelector("[data-hw]");
    if (!card) bad("[домашка] на экране домашки нет карточки заданной задачи");
    else {
      card.click();
      await tick();
      const st = studioOf();
      if (!st) bad("[домашка] задача не открылась в редакторе");
      else {
        /* неверный ответ засчитываться не должен */
        st.editor.setCode('print("наугад")\n');
        st.querySelector('[data-role="check"]').click();
        await tick();
        if (won()){ bad("[домашка] неверный ответ засчитан"); closeWin(); }

        /* эталонная программа обязана пройти */
        st.editor.setCode(item.code(g.hwBuild(g.hwPending()[0]).vals));
        st.querySelector('[data-role="check"]').click();
        await tick();
        if (!won()) bad("[домашка] верное решение не засчитано — " + msgText());
        else closeWin();
      }
    }
    if (g.hwPending().length) bad("[домашка] сданная задача осталась в несделанных");
    if (!(g.state.hw[key] || {}).done) bad("[домашка] «сдано» не записалось");

    /* 4а.5. ⚠️ Главное правило: домашка не двигает прогресс по курсу.
       Иначе взрослый начнёт выдавать её ради звёзд, из лучших побуждений. */
    if (Object.keys(g.state.stars).length !== starsBefore || g.state.xp !== xpBefore)
      bad("[домашка] домашка начислила звёзды или опыт — этого быть не должно");

    /* 4а.6. Требование конструкции обойти нельзя: задачу «напиши функцию»
       не закрыть тремя print с готовыми числами. */
    {
      const withNeed = bank.filter(x => (x.need || []).length)[0];
      if (!withNeed) bad("[домашка] в банке нет ни одной задачи с требованием конструкции");
      else {
        const sd = g.hwSeed("kid-a", withNeed.id, day), k2 = g.hwKey(withNeed.id, sd);
        g.state.hw[k2] = { id:withNeed.id, seed:sd, due:"", by:"репетитор",
                           at:Date.now(), done:0, tries:0 };
        const b2 = g.hwBuild(g.hwPending().filter(r => r.key === k2)[0]);
        g.openHW(k2);
        await tick();
        const st2 = studioOf();
        if (!st2) bad("[домашка] задача с требованием не открылась");
        else {
          /* печатаем ПРАВИЛЬНЫЙ вывод, но без нужной конструкции */
          st2.editor.setCode(b2.lines.map(l => "print(" + JSON.stringify(l) + ")").join("\n") + "\n");
          st2.querySelector('[data-role="check"]').click();
          await tick();
          if (won()){
            bad("[домашка] задача с требованием «" + withNeed.need.join(", ") +
                "» засчиталась напечатанным ответом");
            closeWin();
          }
          if ((g.state.hw[k2] || {}).done) bad("[домашка] обойдённая задача отметилась сданной");
        }
      }
    }

    /* 4а.7. Просрочка ничего не сжигает: задача остаётся и открывается. */
    {
      const late = Object.keys(g.state.hw).filter(x => !g.state.hw[x].done)[0];
      if (late){
        g.state.hw[late].due = g.shiftDay(g.dayKey(), -3);
        const rec = g.hwPending().filter(r => r.key === late)[0];
        if (!rec) bad("[домашка] просроченная задача исчезла из списка — она не должна сгорать");
        else if (g.hwDaysLeft(rec) !== -3) bad("[домашка] дни до срока считаются неверно");
        else if (!/срок был/.test(g.hwDueText(rec)))
          bad("[домашка] про просрочку сказано не фактом: " + g.hwDueText(rec));
      }
    }

    /* 4а.8. Слияние: условие принадлежит тому, кто задал, «сдано» — тому,
       кто делал. Иначе обмен с сервером сотрёт одно из двух. */
    {
      const kk = "hw-klass#42";
      const given = { hw: { [kk]: { id:"hw-klass", seed:42, due:"2026-09-12",
                                    by:"репетитор", at:2000, done:0, tries:0 } }, savedAt:2 };
      const did = { hw: { [kk]: { id:"hw-klass", seed:42, due:"2026-09-12",
                                  by:"репетитор", at:1000, done:5555, tries:3 } }, savedAt:1 };
      const m = g.mergeProgress(given, did);
      if (!m.hw || !m.hw[kk]) bad("[домашка] запись пропала при слиянии");
      else {
        if (m.hw[kk].seed !== 42) bad("[домашка] при слиянии сменилось семя — условия разойдутся");
        if (!m.hw[kk].done) bad("[домашка] при слиянии потерялось «сдано»");
        if (m.hw[kk].tries !== 3) bad("[домашка] при слиянии потерялось число попыток");
      }
    }

    /* 4а.9. Все задачи банка обязаны собираться через игру, а не только в
       своём тесте: сломанную задачу увидит репетитор и решит, что сломан
       тренажёр. */
    bank.forEach(it => {
      const sd = g.hwSeed("kid-proverka", it.id, day);
      const b = g.hwBuild({ key:g.hwKey(it.id, sd), id:it.id, seed:sd, due:"", by:"", at:0, done:0, tries:0 });
      if (!b) bad("[домашка] задача «" + it.id + "» не собирается в игре");
    });

    g.state.hw = {};
    if (problems.length === p0) hwChecked++;
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
      /* ⚠️ Снятые замки репетитора открывают ВСЕ разминки — без этой строки
         проверка молча тестировала бы не новичка, а панель репетитора. */
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

  /* --- 6б. экзамен по своей программе (остаток 1.1б) ---
     ⚠️ Главное здесь — ЕДИНСТВЕННОСТЬ ответа. Задача обещает: «оно ровно
     одно». Если в диапазоне найдётся второе число с тем же выводом, ребёнок,
     решивший верно, получит «не оно» — и будет прав он, а не мы. Проверяем не
     обещание, а факт: подставляем ВСЕ числа диапазона движком. */
  if (typeof g.myExamMake === "function"){
    const p0 = problems.length;
    const keepWorks = g.state.works, keepDrafts = g.state.drafts;
    g.state.works = {}; g.state.drafts = {};

    if (g.myExamHasSource()) bad("[своя задача] источники нашлись там, где ребёнок ничего не написал");
    if (g.myExamPick()) bad("[своя задача] задача собралась из ничего");
    g.screenMyExam();
    await tick();
    if (!/не из чего собрать/i.test(doc.getElementById("app").textContent))
      bad("[своя задача] без программы экран не объясняет, чего не хватает");

    /* программа со случайностью и с вводом в источники не идёт: у такой задачи
       не может быть повторяемого ответа */
    if (g.myExamMake("import random\nprint(random.randint(1, 9))\n"))
      bad("[своя задача] задача собрана из программы со случайностью");
    if (g.myExamMake("n = int(input())\nprint(n * 2)\n"))
      bad("[своя задача] задача собрана из программы, которая просит ввод");

    g.myWorkSave("Считалка", "сумма", "итог = 0\nfor i in range(1, 5):\n    итог = итог + i\nprint(итог)\n");
    if (!g.myExamHasSource()) bad("[своя задача] сохранённая программа не стала источником");
    const made = g.myExamPick();
    if (!made) bad("[своя задача] из годной программы задача не собралась");
    else {
      if (made.code.indexOf(g.MYEXAM_BOX) < 0)
        bad("[своя задача] в показанной программе нет закрытой клетки");
      if (made.code.indexOf(String(made.ans)) >= 0 && /^\d+$/.test(String(made.ans)) &&
          made.code.replace(g.MYEXAM_BOX, "").indexOf(String(made.ans)) >= 0 &&
          made.code.split(g.MYEXAM_BOX)[0].indexOf(String(made.ans)) >= 0)
        bad("[своя задача] ответ виден прямо в тексте программы");
      /* единственность: подставляем весь диапазон и считаем совпадения */
      const run = code => {
        const r = w.Runtime.get("mini").run(code, {});
        return r.error ? null : String(r.output || "").replace(/\n+$/, "");
      };
      const single = (x, label) => {
        if (!x) return;
        let hits = 0;
        for (let v = g.MYEXAM_LO; v <= g.MYEXAM_HI; v++){
          const out = run(x.code.replace(g.MYEXAM_BOX, String(v)));
          if (out !== null && out === x.out) hits++;
        }
        if (hits !== 1)
          bad("[своя задача] " + label + ": верных ответов " + hits + ", а обещан один — " +
              "решивший верно получит «не оно»");
        if (run(x.code.replace(g.MYEXAM_BOX, String(x.ans))) !== x.out)
          bad("[своя задача] " + label + ": обещанный ответ не даёт обещанного вывода");
      };
      single(made, "задача из «Считалки»");
      /* ⚠️ Ловушка: у этой программы в первом же месте числа СХОДЯТСЯ — при
         делении нацело десяток значений даёт один и тот же вывод. Сборщик
         обязан такое место пропустить. Без этой проверки единственность не
         проверяется вовсе: у «Считалки» каждое число даёт свой вывод, и
         совпасть там нечему — сборщик без проверки прошёл бы её насквозь. */
      single(g.myExamMake("x = 21\nprint(x // 7)\n"), "задача из деления нацело");

      /* ход по-настоящему: из раздела кнопкой, как это делает ребёнок */
      g.screenAlgo();
      await tick();
      const btn = doc.getElementById("myexam");
      if (!btn) bad("[своя задача] в разделе экзамена нет кнопки «Собрать задачу»");
      else {
        btn.click();
        await new Promise(r => setTimeout(r, 60));
        const st = studioOf();
        if (!st) bad("[своя задача] экран задачи не открылся по кнопке");
        else {
          st.editor.setCode("кот");
          st.querySelector('[data-role="check"]').click();
          await tick();
          if (won()) bad("[своя задача] засчитан ответ, который даже не число");
          st.editor.setCode(String(made.ans === g.MYEXAM_LO ? made.ans + 1 : made.ans - 1));
          st.querySelector('[data-role="check"]').click();
          await tick();
          if (won()) bad("[своя задача] засчитано неверное число");
          const hint = doc.querySelector(".msg").textContent;
          if (!/больше|меньше/.test(hint))
            bad("[своя задача] после промаха не сказано, в какую сторону: " + hint.slice(0, 80));
          if (hint.indexOf(String(made.ans)) >= 0)
            bad("[своя задача] верное число показано в ответе на промах — вторая попытка обесценена: " +
                "ответ " + made.ans + ", текст «" + hint + "»");
          st.editor.setCode(String(made.ans));
          st.querySelector('[data-role="check"]').click();
          await tick();
          if (!won()) bad("[своя задача] верное число не засчитано");
          closeWin();
        }
      }
    }
    g.state.works = keepWorks; g.state.drafts = keepDrafts;
    viewReset(g);
    if (problems.length === p0) myExamChecked++;
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

      /* «Сделать такую же» (24.09.2026): у каждой несобранной вещи — дорога.
         ⚠️ Дорога честная: несобранный проект ведёт в первый нерешённый урок
         курса ПО ПОРЯДКУ (новичка «Свой сайт» не шлём в середину курса), а
         когда мир пройден — в сам проект. Кода проекта кнопка не открывает. */
      if (typeof g.showcaseRoad === "function"){
        const starsWas = JSON.parse(JSON.stringify(g.state.stars || {}));
        const allWas = g.state.admin && g.state.admin.unlockAll;
        if (g.state.admin) g.state.admin.unlockAll = false;   /* «открыть все уроки» открыл бы и все проекты */
        g.state.stars = {};
        g.screenShowcase(); await tick(60);
        const карт = doc.querySelectorAll(".partcard").length;
        const кнопок = doc.querySelectorAll("[data-showmake]").length;
        if (кнопок !== карт) bad("[витрина] «Сделать такую же» есть у " + кнопок + " вещей из " + карт);
        const l0 = w.CURRICULUM[0].lessons[0];
        const last = (w.PROJECTS || []).filter(x => x.world === w.CURRICULUM.length)[0];
        if (last){
          const r = g.showcaseRoad(last);
          if (!r || r.kind !== "lesson" || r.id !== l0.id)
            bad("[витрина] дорога новичка к «" + last.title + "» ведёт не в первый урок курса: " + JSON.stringify(r));
        }
        const mk = doc.querySelector("[data-showmake]");
        mk.click(); await tick(80);
        if (g.place() !== "lesson") bad("[витрина] «Сделать такую же» привела на «" + g.place() + "», а не в урок");
        /* мир 1 пройден — дорога к его проекту это сам проект */
        const p1 = (w.PROJECTS || []).filter(x => x.world === 1)[0];
        w.CURRICULUM[0].lessons.forEach(l => { g.state.stars[l.id] = 3; });
        const r1 = g.showcaseRoad(p1);
        if (!r1 || r1.kind !== "project" || r1.id !== p1.id)
          bad("[витрина] мир 1 пройден, а дорога к «" + p1.title + "» не в проект: " + JSON.stringify(r1));
        g.state.stars = starsWas;
        if (g.state.admin) g.state.admin.unlockAll = allWas;
        viewReset(g);
      }

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

  /* --- 10. группа: рабочее место репетитора --- */
  if (typeof g.groupRow === "function"){
    const p0 = problems.length;

    /* 10.1. Сводка по ученику считается из ЛЮБОГО снимка прогресса, а не из
       своего: репетитор смотрит чужие данные, взятые с сервера. */
    {
      const day = 864e5, now = Date.now();
      const st = g.ensureShape({
        stars: { "print-first":3, "vars":2 },
        log: {
          "print-first": { solvedAt: now - day, last: now - day, attempts:1, hints:0, shown:0 },
          "vars":        { solvedAt: now - 2*day, last: now - 2*day, attempts:6, hints:2, shown:1,
                           tr: { at: now, pasted: 120, ahead: ["comp"] } }
        },
        zan: { "z1": { end: now - day, predAll: 2, predOk: 1, predMine: 1 } }
      });
      const r = g.groupRow("misha-7f3a", st);
      if (r.week !== 2) bad("[группа] уроков за неделю посчитано " + r.week + " вместо двух");
      if (r.tries !== 7) bad("[группа] попытки не сложились: " + r.tries);
      if (r.pred.all !== 2 || r.pred.ok !== 1)
        bad("[группа] проверка понимания посчитана неверно: " + JSON.stringify(r.pred));
      const kinds = r.marks.map(m => m.k);
      if (kinds.indexOf("tough") < 0) bad("[группа] трудный урок не замечен: " + JSON.stringify(kinds));
      if (kinds.indexOf("ready") < 0) bad("[группа] «часть работы пришла готовой» не замечено");
      if (kinds.indexOf("ahead") < 0) bad("[группа] «непройденное в решении» не замечено");
      if (kinds.indexOf("quiet") >= 0) bad("[группа] занимавшийся вчера назван молчащим");
      /* ⚠️ ни одна пометка не выносит приговор: это приглашение поговорить */
      r.marks.forEach(m => {
        if (/плох|лен|отста|прогул|спис/i.test(m.txt))
          bad("[группа] пометка выносит приговор: " + m.txt);
      });
    }

    /* 10.2. Молчание весит больше всего: «не сел вовсе» — самая частая и самая
       дорогая из трёх подмен, и такой ученик обязан быть сверху списка. */
    {
      const now = Date.now(), day = 864e5;
      const тихий = g.groupRow("a", g.ensureShape({
        stars: { "print-first":3 },
        log: { "print-first": { solvedAt: now - 20*day, last: now - 20*day, attempts:1 } } }));
      const бодрый = g.groupRow("b", g.ensureShape({
        stars: { "print-first":3, "vars":3 },
        log: { "print-first": { solvedAt: now - day, last: now - day, attempts:1 },
               "vars":        { solvedAt: now - day, last: now - day, attempts:1 } } }));
      if (тихий.rank <= бодрый.rank)
        bad("[группа] молчащий ученик не поднялся выше активного: " + тихий.rank + " против " + бодрый.rank);
      if (тихий.marks.map(m => m.k).indexOf("quiet") < 0)
        bad("[группа] двадцать дней тишины не отмечены");
      if (бодрый.marks.length)
        bad("[группа] у ровно идущего появились пометки: " + JSON.stringify(бодрый.marks));
      /* пустой снимок не должен ронять экран */
      const пусто = g.groupRow("c", g.ensureShape({}));
      if (!пусто || пусто.week !== 0) bad("[группа] пустой прогресс посчитан неверно");
    }

    /* 10.3. Экран: рамка честности до цифр, только чтение, вход из панели. */
    {
      g.adminUnlock();
      g.groupState.rows = [
        g.groupRow("misha-7f3a", g.ensureShape({ stars:{}, log:{} })),
        g.groupRow("anya-2b81", g.ensureShape({ stars:{ "vars":3 },
          log:{ "vars": { solvedAt: Date.now(), last: Date.now(), attempts:1 } } }))
      ];
      g.screenGroup();
      await tick();
      const t = doc.getElementById("app").textContent;
      if (!/Группа/.test(t)) bad("[группа] экран не открылся");
      if (!/не табель/i.test(t)) bad("[группа] не сказано, что это не табель");
      if (!/имён детей на сервере нет/i.test(t))
        bad("[группа] не сказано, что имён на сервере нет");
      if (!/только чтение/i.test(t)) bad("[группа] не сказано, что менять ничего нельзя");
      if (!/проверок сделал движок/i.test(t))
        bad("[группа] не названо число проверок, которые не пришлось делать руками");
      const rules = doc.querySelector(".trrules"), sum = doc.querySelector(".trsum");
      if (!rules) bad("[группа] нет рамки честности");
      if (rules && sum && !(rules.compareDocumentPosition(sum) & 4))
        bad("[группа] цифры стоят раньше рамки честности");
      if (doc.querySelectorAll(".grouprow").length !== 2)
        bad("[группа] показаны не все ученики");
      /* подпись ставится у репетитора и никуда не уходит */
      g.adminLabelSet("misha-7f3a", "Петя, 5 класс");
      if (g.cloudSnapshot().admin) bad("[группа] настройки репетитора уезжают на сервер");
      g.screenGroup();
      await tick();
      if (!/Петя, 5 класс/.test(doc.getElementById("app").textContent))
        bad("[группа] подпись репетитора не показалась");
      /* вход из полной панели репетитора (теперь под #panel; #admin — новый
         кабинет со списком учеников) */
      w.location.hash = "#panel";
      g.screenAdmin();
      await tick();
      if (!doc.querySelector('[data-act="togroup"]'))
        bad("[группа] в панели репетитора нет входа в группу");
      /* ⚠️ Смена хэша ставит в очередь hashchange, а тот перерисовывает экран.
         Без этого ожидания следующая проверка открывала свой экран, и его
         тут же затирал запоздавший screenWorlds. */
      w.location.hash = "";
      await tick();
      g.groupState.rows = null;
      viewReset(g);
    }

    /* 10.4. Домашка всей группе одной кнопкой. Сервер настоящий (мок только
       у fetch), поэтому проверяется вся цепочка: выдача → запись → чтение. */
    {
      g.adminUnlock();
      /* серверная папка из раздела «синхронизация» уже убрана — поднимаем
         свою: функция настоящая, меняется только место на диске */
      const hwDir = fs.mkdtempSync(path.join(os.tmpdir(), "kq-grp-hw-"));
      process.env.DATA_DIR = hwDir;
      w.CLOUD_CONFIG.url = "https://srv.invalid/fn";
      const now = Date.now(), day = 864e5;
      const stA = g.ensureShape({ stars: { "math": 3 },
        log: { "math": { solvedAt: now - day, last: now - day, attempts: 1 } } });
      const stB = g.ensureShape({});          /* ещё ничего не прошёл */
      await w.Cloud.save(stA, "grp-a");
      await w.Cloud.save(stB, "grp-b");
      g.groupState.rows = [g.groupRow("grp-a", stA), g.groupRow("grp-b", stB)];
      g.screenGroup();
      await tick();
      const t = doc.getElementById("app").textContent;

      /* карточка есть, и счётчик честный: задача уедет одному из двух */
      const boxes = doc.querySelectorAll("[data-ghwpick]");
      if (!boxes.length) bad("[группа-домашка] на экране группы нет выдачи домашки");
      if (!/получат: 1 из 2/.test(t))
        bad("[группа-домашка] счётчик «получат N из M» не показан или врёт");
      /* задача, которую не может получить никто, выключена */
      const dead = doc.querySelector('[data-ghwpick="hw-class"]');
      if (dead && !dead.disabled)
        bad("[группа-домашка] задача, недоступная всем, не выключена");

      /* выдаём две задачи по уроку «math» */
      const due = g.shiftDay(g.dayKey(), 5);
      await g.groupAssignHW(["hw-klass", "hw-konfety"], due);
      const gotA = await w.Cloud.load("grp-a");
      const gotB = await w.Cloud.load("grp-b");
      const hwA = (gotA.data || {}).hw || {};
      const hwB = (gotB.data || {}).hw || {};
      if (Object.keys(hwA).length !== 2)
        bad("[группа-домашка] ученику с пройденным уроком уехало " + Object.keys(hwA).length + " задач вместо 2");
      if (Object.keys(hwB).length !== 0)
        bad("[группа-домашка] ученику без пройденных уроков что-то уехало — ему дадут необъяснённое");
      Object.keys(hwA).forEach(k => {
        if (hwA[k].due !== due) bad("[группа-домашка] срок не записался");
        if (hwA[k].by !== "репетитор") bad("[группа-домашка] не записано, кто задал");
      });
      /* строка ученика в группе обновилась без перезагрузки */
      const rowA = g.groupState.rows.filter(r => r.code === "grp-a")[0];
      if (!rowA || rowA.hwAll !== 2)
        bad("[группа-домашка] счётчик домашки в строке ученика не обновился");
      /* итог называет и то, что не уехало */
      if (!/Не уехало 2/.test(g.grpHwState.note))
        bad("[группа-домашка] итог молчит о задачах, которые не дошли: " + g.grpHwState.note);

      /* повторная выдача тех же задач не задваивает */
      await g.groupAssignHW(["hw-klass", "hw-konfety"], due);
      const again = await w.Cloud.load("grp-a");
      if (Object.keys((again.data || {}).hw || {}).length !== 2)
        bad("[группа-домашка] повторная выдача задвоила задачи");

      /* у двух учеников одна задача — РАЗНЫЕ числа: семя своё у каждого */
      const stC = g.ensureShape({ stars: { "math": 3 },
        log: { "math": { solvedAt: now - day, last: now - day, attempts: 1 } } });
      await w.Cloud.save(stC, "grp-c");
      g.groupState.rows.push(g.groupRow("grp-c", stC));
      await g.groupAssignHW(["hw-klass"], due);
      const gotC = await w.Cloud.load("grp-c");
      const keyA = Object.keys(hwA).filter(k => hwA[k].id === "hw-klass")[0];
      const keyC = Object.keys((gotC.data || {}).hw || {}).filter(k => k.indexOf("hw-klass") === 0)[0];
      if (!keyC) bad("[группа-домашка] третьему ученику задача не уехала");
      else if (hwA[keyA].seed === gotC.data.hw[keyC].seed)
        bad("[группа-домашка] у соседей по группе совпало семя — числа будут одни, спишут");

      g.groupState.rows = null;
      g.grpHwState.note = "";
      try { fs.rmSync(hwDir, { recursive:true, force:true }); } catch(e){}
      viewReset(g);
    }

    /* 10.4б. ВАРИАНТ ВСЕЙ ГРУППЕ.
       ⚠️ Главное, что здесь проверяется, — семя ОДНО на всех. В домашке
       наоборот: там у каждого своё, чтобы не списывали. Перепутать эти два
       правила проще всего, а последствия разные и оба тихие: одинаковая
       домашка списывается, а разные варианты делают отчёт по группе
       бессмысленным — «просели на 17-м» можно сказать только про тех, кому
       17-й достался ОДИН И ТОТ ЖЕ. */
    if (typeof g.groupAssignVariant === "function"){
      const vDir = fs.mkdtempSync(path.join(os.tmpdir(), "kq-grp-var-"));
      process.env.DATA_DIR = vDir;
      w.CLOUD_CONFIG.url = "https://srv.invalid/fn";
      const stA = g.ensureShape({}), stB = g.ensureShape({}), stC = g.ensureShape({});
      await w.Cloud.save(stA, "var-a");
      await w.Cloud.save(stB, "var-b");
      await w.Cloud.save(stC, "var-c");
      g.groupState.rows = [g.groupRow("var-a", stA), g.groupRow("var-b", stB),
                           g.groupRow("var-c", stC)];
      g.adminUnlock();
      g.screenGroup(); await tick();
      if (!doc.getElementById("gvgive"))
        bad("[группа-вариант] на экране группы нечем задать вариант");

      const due = g.shiftDay(g.dayKey(), 5);
      await g.groupAssignVariant("ege", 60, due);
      const got = [];
      for (const code of ["var-a", "var-b", "var-c"]){
        const r = await w.Cloud.load(code);
        got.push(((r.data || {}).vtask || {}).ege || null);
      }
      if (got.some(x => !x || !x.seed))
        bad("[группа-вариант] назначение уехало не всем: " + JSON.stringify(got));
      else {
        if (got[0].seed !== got[1].seed || got[1].seed !== got[2].seed)
          bad("[группа-вариант] семя у учеников РАЗНОЕ — отчёт по группе станет бессмысленным: " +
              got.map(x => x.seed).join(", "));
        if (got[0].mins !== 60) bad("[группа-вариант] режим не записался: " + got[0].mins);
        if (got[0].due !== due) bad("[группа-вариант] срок не записался");
        if (got[0].by !== "репетитор") bad("[группа-вариант] не записано, кто задал");
        /* ⚠️ Один и тот же код обязан собрать один и тот же вариант — это
           единственное, на чём держится вся затея: заданий не пересылаем. */
        const one = g.variantBuild("ege", got[0].seed).map(x => x.id).join(",");
        const two = g.variantBuild("ege", got[2].seed).map(x => x.id).join(",");
        if (one !== two)
          bad("[группа-вариант] по одному коду собрались РАЗНЫЕ варианты");
      }

      /* новое назначение отменяет прежнее: свежее побеждает по at */
      const first = got[0] && got[0].seed;
      await g.groupAssignVariant("ege", 0, "");
      const after = await w.Cloud.load("var-a");
      const now2 = ((after.data || {}).vtask || {}).ege || {};
      if (now2.seed === first) bad("[группа-вариант] повторное назначение не сменило вариант");
      if (now2.mins !== 0) bad("[группа-вариант] режим нового назначения не записался");

      /* ⚠️ Отчёт считает только тех, у кого собран ИМЕННО этот вариант.
         Смешать два варианта в одну строку — соврать числом. */
      {
        const seed = now2.seed;
        const items = g.variantBuild("ege", seed).filter(x => x.id);
        const mk = (sd, doneN) => {
          const st = g.ensureShape({});
          st.vtask = { ege: { seed: seed, mins: 0, at: Date.now(), due: "" } };
          st.variant = { ege: { ex:"ege", seed: sd, at: Date.now(), mins:0, endAt:0,
                                closed:1, items: g.variantBuild("ege", sd),
                                done: doneN, seen: {}, sent: {} } };
          return st;
        };
        const n1 = items[0].n;
        g.groupState.rows = [
          g.groupRow("var-a", mk(seed, { [n1]: 1 })),
          g.groupRow("var-b", mk(seed, {})),
          g.groupRow("var-c", mk("ZZZZZZ", { [n1]: 1 }))   /* чужой вариант */
        ];
        g.screenGroup(); await tick();
        const txt = doc.getElementById("app").textContent;
        if (!/Как группа прошла вариант/.test(txt))
          bad("[группа-вариант] отчёта по варианту нет");
        if (!/Собрали его у себя: 2 из 3/.test(txt))
          bad("[группа-вариант] в отчёт попал ученик с ДРУГИМ вариантом: " +
              (txt.match(/Собрали его у себя[^.]*/) || [""])[0]);
        if (!new RegExp("закрыли 1 из 2").test(txt) && !new RegExp("закрыли 0 из 2").test(txt))
          bad("[группа-вариант] отчёт не считает закрытые номера по группе");
        /* ⚠️ Отчёт про ЗАДАНИЯ, а не про детей: ни одного кода ученика в нём
           быть не должно — иначе это лидерборд, которого в продукте нет. */
        const card = Array.prototype.slice.call(doc.querySelectorAll(".card"))
          .filter(c => /Как группа прошла вариант/.test(c.textContent))[0];
        if (card && /var-a|var-b|var-c/.test(card.textContent))
          bad("[группа-вариант] в отчёте названы ученики — это лидерборд, а не разбор заданий");
      }

      /* ⚠️ Вариант ОГЭ, собранный до 1.163.0, не знает Робота на номере 15.
         Такой ученик не «не закрыл» 15-й — номера у него не было, и в
         знаменатель он не идёт. Иначе отчёт показывает группе провал там, где
         задания не давали. */
      {
        const seed = "OGEOGE";
        const itemsNew = g.variantBuild("oge", seed);
        const itemsOld = itemsNew.map(x => x.n === 15 ? { n: 15, t: x.t, id: null, dup: 0, why: "решается в разделе «Робот»" } : x);
        const mk = (items, done) => {
          const st = g.ensureShape({});
          st.vtask = { oge: { seed: seed, mins: 0, at: Date.now(), due: "" } };
          st.variant = { oge: { ex:"oge", seed: seed, at: Date.now(), mins:0, endAt:0, closed:1,
                                items: items, done: done, seen: {}, sent: {} } };
          return st;
        };
        /* всё закрыто, кроме 15-го: строка 15 обязана оказаться среди трудных */
        const allBut15 = {};
        itemsNew.forEach(x => { if (x.id && x.n !== 15) allBut15[x.n] = 1; });
        g.groupState.rows = [
          g.groupRow("var-a", mk(itemsNew, Object.assign({}, allBut15))),
          g.groupRow("var-b", mk(itemsOld, Object.assign({}, allBut15)))
        ];
        g.screenGroup(); await tick();
        const card = Array.prototype.slice.call(doc.querySelectorAll(".card"))
          .filter(c => /Как группа прошла вариант ОГЭ/.test(c.textContent))[0];
        const row15 = card && Array.prototype.slice.call(card.querySelectorAll(".exrow"))
          .filter(r => /^15/.test(r.textContent.trim()))[0];
        if (!row15) bad("[группа-вариант] в отчёте по ОГЭ нет строки номера 15");
        else if (!/закрыли 0 из 1/.test(row15.textContent) || !/номера не было/.test(row15.textContent))
          bad("[группа-вариант] ученик без номера 15 посчитан как не закрывший его: " + row15.textContent.trim());
      }

      /* --- вариант ОДНОМУ ученику (13.09.2026, RAZVITIE § 2.6) ---
         До 1.175.0 вариант уезжал только всей группе, а группа требует
         серверного ключа: репетитор с одним учеником и родитель не могли дать
         вариант вовсе. Проверяем круг через тот же сервер на папке:
         карточка ученика → кнопка → запись ученика → карточка у ребёнка →
         итог взрослому. */
      {
        const waitFor = async (ok) => { for (let i = 0; i < 60 && !ok(); i++) await tick(15); return ok(); };
        /* роль устройства вернуть как была: соседние проверки ждут своё */
        const рольДо = { isAdmin: g.state.admin.isAdmin, parentOf: g.state.admin.parentOf,
                         parentLabel: g.state.admin.parentLabel };
        const solo = "var-solo";
        await w.Cloud.save(g.ensureShape({}), solo);
        g.kidAttach(solo, "Петя");
        g.screenKid(solo);
        await waitFor(() => doc.getElementById("kvgive"));
        const give = doc.getElementById("kvgive");
        if (!give) bad("[вариант-одному] в карточке ученика нечем задать вариант");
        else {
          if (doc.querySelectorAll(".kidnav .ltab").length !== 6)
            bad("[вариант-одному] вариант завёл лишнюю вкладку — на телефоне седьмая встанет одна");
          if (!doc.querySelector('[data-kpane="hw"] #kidvar'))
            bad("[вариант-одному] карточка варианта не во вкладке «Домашка»");
          const dueS = g.shiftDay(g.dayKey(), 4);
          doc.getElementById("kvex").value = "oge";
          doc.getElementById("kvmins").value = "60";
          doc.getElementById("kvdue").value = dueS;
          give.click();
          let rec = null;
          await waitFor(() => /Вариант задан/.test((doc.getElementById("kidbody") || {}).textContent || ""));
          rec = (((await w.Cloud.load(solo)).data || {}).vtask || {}).oge || null;
          if (!rec || !rec.seed) bad("[вариант-одному] назначение не доехало до записи ученика");
          else {
            if (rec.mins !== 60) bad("[вариант-одному] режим не записался: " + rec.mins);
            if (rec.due !== dueS) bad("[вариант-одному] срок не записался: " + rec.due);
            if (rec.by !== "репетитор") bad("[вариант-одному] не записано, кто задал: " + rec.by);
            if (rec.solo !== 1 || rec.group) bad("[вариант-одному] назначение не помечено как личное: " + JSON.stringify(rec));
            if (!g.variantBuild("oge", rec.seed).filter(x => x.id).length)
              bad("[вариант-одному] по записанному коду вариант не собирается");
            const bodyT = doc.getElementById("kidbody").textContent;
            if (bodyT.indexOf(rec.seed) < 0) bad("[вариант-одному] взрослому не показан код заданного варианта");
            if (!/ещё не открывал/.test(bodyT)) bad("[вариант-одному] не сказано, что ребёнок вариант не открывал");
          }
          /* групповое назначение по-прежнему помечено группой */
          const grp = (((await w.Cloud.load("var-a")).data || {}).vtask || {}).ege || {};
          if (grp.group !== 1) bad("[вариант-одному] групповое назначение потеряло пометку группы");

          /* итог взрослому — из снимка ученика */
          if (rec && rec.seed){
            const items = g.variantBuild("oge", rec.seed);
            const able = items.filter(x => x.id);
            const mk = (over) => {
              const st = g.ensureShape({});
              st.vtask = { oge: rec };
              st.variant = { oge: Object.assign({ ex:"oge", seed: rec.seed, at: Date.now(), mins: 60,
                endAt: Date.now() - 1000, closed: 1, items: items, done: {}, seen: {}, sent: {}, pts: {} }, over) };
              return st;
            };
            const rb = able.filter(x => x.kind === "robot")[0];
            const done = {}; able.slice(0, 3).forEach(x => { done[x.n] = 1; });
            const pts = {}; if (rb) pts[rb.n] = { s: 2 };
            const итог = g.kidVarHTML(mk({ done: done, pts: pts })).replace(/<[^>]+>/g, "");
            if (!new RegExp("Экзамен окончен: решено 3 из " + able.length).test(итог))
              bad("[вариант-одному] итог не называет, сколько решено: " + итог.slice(0, 200));
            if (!/Не закрыты номера/.test(итог)) bad("[вариант-одному] итог не называет незакрытые номера");
            if (rb && !new RegExp("задание " + rb.n + " \\(Робот\\) — 2 из 2").test(итог))
              bad("[вариант-одному] балл эксперта за Робота не показан взрослому");
            /* ⚠️ идущий экзамен не выдаёт итога даже взрослому */
            const идёт = g.kidVarHTML(mk({ done: done, pts: pts, closed: 0, endAt: Date.now() + 30 * 60000 })).replace(/<[^>]+>/g, "");
            if (!/Идёт экзамен/.test(идёт) || /решено/.test(идёт) || /из 2/.test(идёт))
              bad("[вариант-одному] итог идущего экзамена утёк на экран взрослого: " + идёт.slice(0, 200));
            /* чужой вариант (другое семя) — не итог заданного */
            const чужой = g.kidVarHTML(mk({ seed: "ZZZZZZ", done: done })).replace(/<[^>]+>/g, "");
            if (/решено/.test(чужой)) bad("[вариант-одному] итог другого варианта выдан за итог заданного");
          }

          /* кабинет родителя: та же карточка, задаёт «родитель» */
          g.becomeParent(solo, "Петя");
          g.screenParent(solo);
          await waitFor(() => doc.getElementById("kidvar"));
          const pv = doc.getElementById("kidvar");
          if (!pv) bad("[вариант-одному] в кабинете родителя нечем задать вариант");
          else if (!/Задаёт родитель/.test(pv.textContent)) bad("[вариант-одному] у родителя вариант подписан не родителем");
          g.becomeAdmin();
        }

        /* сторона ребёнка: личное назначение не врёт про группу и называет, кто задал */
        const было = { v: g.state.variant, t: g.state.vtask };
        g.state.variant = {};
        const личное = { seed: "SVLBAB", mins: 0, at: Date.now(), due: "", by: "родитель", solo: 1 };
        g.state.vtask = { ege: личное, oge: Object.assign({}, личное) };
        g.screenVariant(); await tick();
        const детский = doc.getElementById("app").textContent;
        if (!/Родитель задал вариант/.test(детский)) bad("[вариант-одному] ребёнку не сказано, что вариант задал родитель");
        if (/в группе/.test(детский)) bad("[вариант-одному] личный вариант назван групповым");
        if (!/лично тебе/.test(детский)) bad("[вариант-одному] ребёнку не сказано, что вариант задан лично ему");
        g.state.variant = было.v; g.state.vtask = было.t;
        g.kidDrop(solo);
        Object.assign(g.state.admin, рольДо);
        g.adminUnlock();
        g.screenKids();              /* снимает открытого ученика (kidTarget) */
      }

      g.groupState.rows = null;
      g.grpVarState.note = "";
      try { fs.rmSync(vDir, { recursive:true, force:true }); } catch(e){}
      viewReset(g);
    }

    /* 10.5. План и факт (корзина 3.5). Репетитор спрашивает про ученика не
       «сколько пройдено», а «успевает ли», и ответ считается ТОЛЬКО от рамки,
       которую поставил взрослый. Здесь проверяется и арифметика, и три
       ограничения красной линии «это не табель». */
    if (typeof g.planFact === "function"){
      const day = 864e5, now = Date.now();
      /* рамку поставили 3 дня назад, занятия каждый день, 20 минут = 2 урока
         в занятие → план 6 уроков (дни считаются от следующего за днём рамки
         и по сегодня включительно) */
      const setAt = now - 3*day;
      const рамка = { days:[0,1,2,3,4,5,6], len:20, mix:"balanced", setAt: setAt };
      const снимок = (n, доРамки) => {
        const st = { stars:{}, log:{}, frame: JSON.parse(JSON.stringify(рамка)) };
        for (let i = 0; i < n; i++){
          st.stars["pf-after-" + i] = 3;
          st.log["pf-after-" + i] = { solvedAt: now - day, last: now - day, attempts:1 };
        }
        for (let i = 0; i < (доРамки || 0); i++){
          st.stars["pf-before-" + i] = 3;
          st.log["pf-before-" + i] = { solvedAt: setAt - 5*day, last: setAt - 5*day, attempts:1 };
        }
        return g.planFact(g.ensureShape(st));
      };

      const ноль = снимок(0);
      if (ноль.none) bad("[план-и-факт] с заданной рамкой план не посчитался: " + ноль.none);
      if (ноль.per !== 2) bad("[план-и-факт] уроков в занятие посчитано " + ноль.per + " вместо двух");
      if (ноль.days !== 3) bad("[план-и-факт] учебных дней от рамки посчитано " + ноль.days + " вместо трёх");
      if (ноль.plan !== 6) bad("[план-и-факт] план вышел " + ноль.plan + " уроков вместо шести");
      if (ноль.kind !== "behind") bad("[план-и-факт] ноль уроков при плане в шесть — не «отстаёт»: " + ноль.kind);
      if (ноль.lessons !== 6) bad("[план-и-факт] отставание названо в " + ноль.lessons + " уроков вместо шести");
      if (ноль.zan !== 3) bad("[план-и-факт] отставание в занятиях посчитано " + ноль.zan + " вместо трёх");

      if (снимок(6).kind !== "ontrack") bad("[план-и-факт] ровно по плану назван не «по плану»");
      /* ⚠️ Допуск — одно занятие. Разница в один урок это не отставание:
         точность тут мнимая, а обвинение настоящее. */
      if (снимок(5).kind !== "ontrack") bad("[план-и-факт] разница в один урок названа отставанием");
      if (снимок(7).kind !== "ontrack") bad("[план-и-факт] один лишний урок назван «впереди»");
      if (снимок(4).kind !== "behind") bad("[план-и-факт] отставание на занятие не замечено");
      if (снимок(8).kind !== "ahead") bad("[план-и-факт] опережение на занятие не замечено");

      /* уроки, пройденные ДО рамки, к её плану отношения не имеют */
      const доРамки = снимок(6, 20);
      if (доРамки.fact !== 6)
        bad("[план-и-факт] в факт попали уроки, пройденные до рамки: " + доРамки.fact);
      if (доРамки.kind !== "ontrack")
        bad("[план-и-факт] старые уроки сдвинули оценку плана: " + доРамки.kind);

      /* ⚠️ Больше, чем осталось в курсе, спланировать нельзя: иначе дошедший
         до конца ученик вечно «отстаёт» от невыполнимого плана. */
      {
        const st = { stars:{}, log:{}, frame: { days:[0,1,2,3,4,5,6], len:45, setAt: now - 200*day } };
        CUR.forEach(world => world.lessons.forEach(l => {
          st.stars[l.id] = 3;
          st.log[l.id] = { solvedAt: now - 210*day, last: now - 210*day, attempts:1 };
        }));
        const всё = g.planFact(g.ensureShape(st));
        if (всё.plan !== 0)
          bad("[план-и-факт] прошедшему весь курс насчитан план в " + всё.plan + " уроков");
        if (всё.kind !== "ontrack")
          bad("[план-и-факт] прошедший весь курс числится «" + всё.kind + "»");
      }

      /* ⚠️ Без рамки план НЕ выдумывается по среднему темпу: придуманный план
         обвинял бы ребёнка за нашу догадку. */
      const безРамки = g.planFact(g.ensureShape({ stars:{}, log:{} }));
      if (безРамки.none !== "noframe")
        bad("[план-и-факт] без рамки занятий план всё-таки посчитан");
      if (!/рамка занятий не задана/i.test(g.planFactText(безРамки)))
        bad("[план-и-факт] без рамки не сказано, чего не хватает: " + g.planFactText(безРамки));
      /* рамка есть, а дня её постановки нет — считать не от чего */
      const безДаты = g.planFact(g.ensureShape({ stars:{}, log:{},
        frame: { days:[1,3,5], len:30, setAt: 0 } }));
      if (безДаты.none !== "nodate")
        bad("[план-и-факт] рамка без даты постановки посчиталась");

      /* каникулы — запланированный пропуск, и план в них не растёт */
      const каникулы = g.planFact(g.ensureShape({ stars:{}, log:{},
        frame: { days:[0,1,2,3,4,5,6], len:20, setAt: setAt,
                 breaks: [[ g.dayKey(new Date(now - 3*day)), g.dayKey() ]] } }));
      if (каникулы.plan !== 0)
        bad("[план-и-факт] план вырос в запланированные каникулы: " + каникулы.plan);

      /* ⚠️ Слова. «Отстаёт» говорится про РАМКУ, а не про ребёнка, и «впереди»
         показывается ровно так же — иначе это табель, а не план и факт. */
      const тексты = [g.planFactText(снимок(0)), g.planFactText(снимок(20))];
      if (!/от рамки/.test(тексты[0]))
        bad("[план-и-факт] отставание названо без рамки, как свойство ребёнка: " + тексты[0]);
      if (!/впереди/.test(тексты[1]))
        bad("[план-и-факт] опережение не называется словом «впереди»: " + тексты[1]);
      тексты.forEach(t => {
        if (/плох|лен|прогул|спис|двоеч|слаб/i.test(t))
          bad("[план-и-факт] строка выносит приговор: " + t);
        if (/%|процент/i.test(t))
          bad("[план-и-факт] расстояние названо в процентах: " + t);
      });

      /* ⚠️ И на экране: план стоит ОТДЕЛЬНОЙ строкой, а не пометкой в списке
         «на кого посмотреть» — там он читался бы как обвинение, и «впереди»
         туда не попало бы вовсе. */
      {
        g.adminUnlock();
        const stBehind = g.ensureShape({ stars:{}, log:{},
          frame: JSON.parse(JSON.stringify(рамка)) });
        const stNo = g.ensureShape({ stars:{}, log:{} });
        const rowBehind = g.groupRow("pf-behind", stBehind);
        if (rowBehind.marks.some(m => /отста|впереди|по плану/i.test(m.txt)))
          bad("[план-и-факт] план попал в пометки «на кого посмотреть»");
        g.groupState.rows = [rowBehind, g.groupRow("pf-noframe", stNo)];
        g.screenGroup();
        await tick();
        const t = doc.getElementById("app").textContent;
        if (doc.querySelectorAll(".grpplan").length !== 2)
          bad("[план-и-факт] строка плана показана не у всех учеников группы");
        if (!/отстаёт от рамки на 6 уроков/.test(t))
          bad("[план-и-факт] на экране группы нет отставания словами");
        if (!/рамка занятий не задана/i.test(t))
          bad("[план-и-факт] про ученика без рамки экран молчит");
        if (!/По своей рамке идут или впереди: 0 из 1/.test(t))
          bad("[план-и-факт] в сводке за неделю нет счёта «идут по рамке»");
        if (!/у 1 рамка занятий не задана/i.test(t))
          bad("[план-и-факт] сводка молчит о тех, кому план сравнивать не с чем");
        g.groupState.rows = null;
        viewReset(g);
      }

      /* ⚠️ Заодно — два промаха того же места, найденные при этой работе и
         не покрытые ничем. Карточка ученика звала frameEditorHTML(frame())
         без второго довода, и стоило поставить выбранному ученику дату
         «успеть к», как экран падал; а paceCheck без снимка считал остаток
         уроков по прогрессу САМОГО РЕПЕТИТОРА и обещал родителю чужую дату. */
      {
        const f = { days:[1,3,5], len:30, goal: g.shiftDay(g.dayKey(), 40),
                    setAt: now - 14*day, breaks: [], mix:"balanced", report:true };
        let html = "";
        try { html = g.frameEditorHTML(f); }
        catch(e){ bad("[рамка] редактор рамки с датой «успеть к» падает: " + e.message); }
        if (html && !/остаётся/.test(html) && !/⚠️/.test(html))
          bad("[рамка] при заданной дате редактор молчит про темп");

        const весьКурс = { stars:{}, log:{} };
        const всёПройдено = { stars:{}, log:{} };
        CUR.forEach(world => world.lessons.forEach(l => { всёПройдено.stars[l.id] = 3; }));
        const чужой = g.paceCheck(g.shiftDay(g.dayKey(), 40), [1,3,5], 30, всёПройдено);
        const свой  = g.paceCheck(g.shiftDay(g.dayKey(), 40), [1,3,5], 30, весьКурс);
        if (чужой.left !== 0)
          bad("[рамка] остаток уроков посчитан не по снимку ученика: " + чужой.left);
        if (свой.left <= 0)
          bad("[рамка] у ученика без единого урока остаток вышел " + свой.left);
        /* без выбранного ученика редактор рамки работает на СВОЁ состояние */
        if (g.frameState() !== g.state)
          bad("[рамка] без выбранного ученика редактор смотрит не в свой прогресс");

        /* ⚠️ Час и горизонт должны быть НА ЭКРАНЕ, а не только в модели:
           лид рамки обещает «дни, время и длину назначаете вы» — обещание
           стояло в тексте раньше, чем появился орган управления (12.09.2026). */
        const ed = g.frameEditorHTML({ days:[6], len:30, time:"17:00",
          until: g.addMonths(g.dayKey(), 2), setAt: now - day, breaks: [],
          mix:"balanced", report:true, goal:null });
        /* ⚠️ Рамку разложили на карточки 12.09.2026, двигая границы <div>.
           Ошибиться на один закрывающий тег тут проще всего, а jsdom и браузер
           молча починят разметку — и поедет вся страница. Считаем теги. */
        const пар = (t, x) => (x.match(new RegExp("<" + t + "[ >]", "g")) || []).length -
                              (x.match(new RegExp("</" + t + ">", "g")) || []).length;
        if (пар("div", ed) !== 0)
          bad("[расписание] в рамке разошлись <div>: перевес " + пар("div", ed));
        if (пар("details", ed) !== 0)
          bad("[расписание] в рамке разошлись <details>: перевес " + пар("details", ed));
        /* редкое свёрнуто, но не спрятано: текст остаётся в странице */
        if (!/Каникулы и запланированные паузы/.test(ed))
          bad("[расписание] каникулы пропали из рамки");
        if (!/Сколько минут в день достаточно/.test(ed))
          bad("[расписание] потолок дня пропал из рамки");
        if (!/<details/.test(ed))
          bad("[расписание] редкие настройки не свёрнуты — экран снова простыня");
        /* главная строка: что настроено сейчас, одним предложением */
        if (!/По субботам в 17:00/.test(ed))
          bad("[расписание] рамка не говорит одной строкой, что на ней настроено");
        if (!/id="ftime"/.test(ed)) bad("[расписание] в редакторе рамки нет поля времени");
        if (!/id="funtil"/.test(ed)) bad("[расписание] в редакторе рамки нет горизонта плана");
        if (!/data-funtil="3"/.test(ed)) bad("[расписание] нет быстрой кнопки «+3 месяца»");
        if (!/Календарь занятий/.test(ed)) bad("[расписание] в рамке нет календаря занятий");
        if (!/data-act="fics"/.test(ed)) bad("[расписание] нет кнопки выгрузки в календарь");
        if (!/17:00/.test(ed)) bad("[расписание] заданный час не показан в рамке");
        /* без часа кнопка выгрузки не предлагается — событие без времени календарь не примет */
        const edNoTime = g.frameEditorHTML({ days:[6], len:30, time:null, until:null,
          setAt: now - day, breaks: [], mix:"balanced", report:true, goal:null });
        if (/data-act="fics"/.test(edNoTime))
          bad("[расписание] кнопка календаря предложена без заданного часа");
      }
    } else bad("[план-и-факт] функции planFact нет");

    if (problems.length === p0) groupChecked++;
  }

  /* --- 10б. отчёт родителю текстом, вопросы к занятию, напоминание --- */
  if (typeof g.parentReportText === "function"){
    const p0 = problems.length;
    const now = Date.now(), day = 864e5;

    /* неделя с плохой новостью, домашкой и проверкой понимания */
    const st = g.ensureShape({
      name: "Секретик",
      stars: { "print-first": 3, "vars": 2 },
      log: {
        "print-first": { solvedAt: now - day, last: now - day, attempts: 1, hints: 0, timeMs: 300000 },
        "vars": { solvedAt: now - 2*day, last: now - 2*day, attempts: 6, hints: 2, shown: 1, timeMs: 600000 }
      },
      days: (function(){ const d = {}; d[g.dayKey(new Date(now - day))] = 1;
                         d[g.dayKey(new Date(now - 2*day))] = 1; return d; })(),
      zan: { "z1": { end: now - day, predAll: 2, predOk: 1 } },
      hw: { "hw-klass#7": { id:"hw-klass", seed:7, due:g.shiftDay(g.dayKey(), 2),
                            by:"репетитор", at: now, done: now, tries: 1 },
            "hw-konfety#7": { id:"hw-konfety", seed:7, due:g.shiftDay(g.dayKey(), 2),
                              by:"репетитор", at: now, done: 0, tries: 0 } }
    });
    const text = g.parentReportText(st);
    if (text.indexOf("Секретик") >= 0)
      bad("[отчёт-текст] имя ребёнка попало в текст для мессенджера");
    if (!/2 занятия|2 занятий/.test(text)) bad("[отчёт-текст] занятия не посчитаны: " + text.split("\n")[0]);
    if (!/смотрел решение/.test(text))
      bad("[отчёт-текст] плохая новость вычищена — «смотрел решение» должно быть в тексте");
    if (!/верно 1 из 2/.test(text)) bad("[отчёт-текст] проверка понимания не попала в текст");
    if (!/сдано 1 из 2/.test(text)) bad("[отчёт-текст] домашка не попала в текст");
    if (!/Дальше по программе/.test(text)) bad("[отчёт-текст] нет следующего шага");
    if (!/Спросите за ужином/.test(text)) bad("[отчёт-текст] нет вопроса за ужином");
    if (/ленит|отста|плох|прогул|спис/i.test(text))
      bad("[отчёт-текст] текст выносит приговор: " + text);

    /* пустая неделя — плохая новость говорится прямо */
    const empty = g.parentReportText(g.ensureShape({}));
    if (!/занятий не было/i.test(empty))
      bad("[отчёт-текст] про пустую неделю не сказано прямо: " + empty.split("\n")[0]);

    /* вопросы к занятию: из трудного урока и из бестиария */
    st.errs = { "TypeError": { seen: 4, beaten: 0, at: now - day } };
    const ask = g.askCardHTML(st);
    if (!/Переменные/.test(ask)) bad("[вопросы] трудный урок недели не стал вопросом");
    if (!/TypeError/.test(ask)) bad("[вопросы] частая ошибка недели не стала вопросом");
    if (/ленит|отста|плох|допрос/i.test(ask)) bad("[вопросы] вопросы звучат приговором");
    if (g.askCardHTML(g.ensureShape({})) !== "")
      bad("[вопросы] на пустом прогрессе карточка не пуста");

    /* напоминание молчащему: приглашение, не укор */
    const row = g.groupRow("x", st);
    const rem = g.quietReminderText(row);
    if (/заброс|запустил|пропустил|потерял|давно пора|стыдно/i.test(rem))
      bad("[напоминание] текст стыдит: " + rem);
    if (!/напиши мне/.test(rem)) bad("[напоминание] нет приглашения к разговору");
    /* порог тишины: три дня, не пять */
    if (g.GROUP_QUIET_DAYS !== 3) bad("[напоминание] порог тишины не 3 дня: " + g.GROUP_QUIET_DAYS);
    const тихий3 = g.groupRow("y", g.ensureShape({
      stars: { "print-first": 3 },
      log: { "print-first": { solvedAt: now - 4*day, last: now - 4*day, attempts: 1 } } }));
    if (тихий3.marks.map(m => m.k).indexOf("quiet") < 0)
      bad("[напоминание] четыре дня тишины не отмечены при пороге в три");

    /* ===== где застрял =====
       ⚠️ Разбор вопроса фаундера 07.09.2026 «что делать, когда ребёнок уперся
       в урок». До этой правки взрослый не узнавал о затыке НИКАК: и отчёт, и
       строка группы считали только решённые уроки. Тест стережёт три вещи:
       что затык виден, что он не путается с «тяжело далось», и что хорошая
       новость не печатается поверх плохой. */
    {
      /* два урока сданы чисто, на третьем сидит: шесть попыток, полчаса */
      const залип = g.ensureShape({
        stars: { "print-first": 3 },
        log: {
          "print-first": { solvedAt: now - day, last: now - day, attempts: 1, timeMs: 300000 },
          "vars": { solvedAt: null, last: now - day, attempts: 7, hints: 0, shown: 0, timeMs: 1500000 }
        },
        days: (function(){ const d = {}; d[g.dayKey(new Date(now - day))] = 1; return d; })()
      });
      const st1 = g.stuckIn(залип);
      if (st1.length !== 1 || st1[0].id !== "vars")
        bad("[затык] нерешённый урок с семью попытками не найден: " + JSON.stringify(st1.map(x=>x.id)));

      /* порог: нормальный ход работы затыком не называется */
      const идёт = g.ensureShape({ stars:{}, log:{
        "vars": { solvedAt: null, last: now, attempts: 4, timeMs: 120000 } } });
      if (g.stuckIn(идёт).length)
        bad("[затык] четыре попытки на текущем уроке названы затыком — тревога на ровном месте");
      /* а открытое решение, после которого урок так и не сдан, — называется */
      const сдался = g.ensureShape({ stars:{}, log:{
        "vars": { solvedAt: null, last: now, attempts: 1, shown: 1 } } });
      if (!g.stuckIn(сдался).length)
        bad("[затык] открытое решение без сдачи урока не считается затыком");
      /* сданный урок — не затык, сколько бы он ни стоил */
      const сдан = g.ensureShape({ stars:{ "vars": 1 }, log:{
        "vars": { solvedAt: now, last: now, attempts: 30, hints: 3, shown: 1 } } });
      if (g.stuckIn(сдан).length) bad("[затык] сданный урок попал в затыки");
      /* открыл и не пробовал — тоже не затык */
      const открыл = g.ensureShape({ stars:{}, log:{
        "vars": { solvedAt: null, last: now, attempts: 0, timeMs: 60000 } } });
      if (g.stuckIn(открыл).length) bad("[затык] урок без единой попытки попал в затыки");

      /* ⚠️ Окна в неделю нет: курс — цепь, и старый нерешённый урок держит
         ребёнка ровно так же, как вчерашний. */
      const давно = g.ensureShape({ stars:{}, log:{
        "vars": { solvedAt: null, last: now - 40*day, attempts: 9 } } });
      if (!g.stuckIn(давно).length)
        bad("[затык] затык месячной давности потерян — а курс дальше не пускает");

      /* --- отчёт родителю --- */
      const txt = g.parentReportText(залип);
      if (!/Застрял на уроке «Переменные»/.test(txt))
        bad("[затык] отчёт родителю молчит про урок, на котором ребёнок стоит: " + txt);
      if (!/7 попыток/.test(txt)) bad("[затык] в отчёте нет числа попыток: " + txt);
      if (!/подсказок не брал/.test(txt))
        bad("[затык] отчёт не говорит, брал ли ребёнок подсказки — а это и есть, что делать");
      /* ⚠️ Хорошая новость не печатается поверх плохой */
      if (/Все уроки недели прошли без подсказок/.test(txt))
        bad("[затык] отчёт написал «все уроки прошли без подсказок» про неделю с затыком");
      /* и выход назван: беда без выхода оставляет взрослого с тревогой.
         ⚠️ Совет обязан зависеть от того, что ребёнок УЖЕ пробовал: «возьмите
         подсказку» тому, кто взял их все, читается как «плохо старался». */
      if (!/Подсказок он ещё не брал/.test(txt))
        bad("[затык] отчёт называет беду и не называет выход: " + txt);
      const советПодсказки = g.stuckAdvice({ attempts: 9, hints: 3 });
      const советРешение  = g.stuckAdvice({ attempts: 9, hints: 3, shown: 1 });
      const советНичего   = g.stuckAdvice({ attempts: 9 });
      if (/ещё не брал/.test(советПодсказки))
        bad("[затык] взявшему подсказки советуют взять подсказки: " + советПодсказки);
      if (!/Показать решение/.test(советПодсказки))
        bad("[затык] взявшему подсказки не назван следующий шаг: " + советПодсказки);
      if (!/уже открывал/.test(советРешение))
        bad("[затык] открывшему решение советуют открыть решение: " + советРешение);
      if (!/Подсказка/.test(советНичего))
        bad("[затык] не бравшему подсказок про них не сказано: " + советНичего);
      if (советПодсказки === советНичего || советРешение === советПодсказки)
        bad("[затык] совет один и тот же во всех положениях");
      if (/ленит|отста|плох|прогул|спис|тупит|бездел/i.test(txt))
        bad("[затык] отчёт выносит приговор: " + txt);

      /* ⚠️ Курс — цепь, поэтому в настоящих данных застрявший урок И ЕСТЬ
         следующий по программе. Называть его двумя абзацами с двумя разными
         объяснениями — значит писать одно и то же дважды в отчёте из шести
         строк. Проверяем на цепи, как в жизни: два первых урока сданы, на
         третьем сидит. */
      {
        const цепь = g.ensureShape({
          stars: { "print-first": 3, "text-vs-num": 3 },
          log: {
            "print-first": { solvedAt: now - 2*day, last: now - 2*day, attempts: 1, timeMs: 300000 },
            "text-vs-num": { solvedAt: now - day, last: now - day, attempts: 2, timeMs: 400000 },
            "vars": { solvedAt: null, last: now - day, attempts: 11, hints: 2, timeMs: 1500000 }
          },
          days: (function(){ const d = {}; d[g.dayKey(new Date(now - day))] = 1;
                             d[g.dayKey(new Date(now - 2*day))] = 1; return d; })()
        });
        const t2 = g.parentReportText(цепь);
        const абзацЗатыка = t2.split("\n").filter(x => /Застрял/.test(x))[0] || "";
        const абзацДальше = t2.split("\n").filter(x => /Дальше по программе/.test(x))[0] || "";
        if (!/Переменные/.test(абзацЗатыка)) bad("[затык] на цепи затык не найден: " + t2);
        if (!/тот же урок/.test(абзацДальше))
          bad("[затык] отчёт называет застрявший урок дважды как новость: " + абзацДальше);
      }

      /* --- карточка недели --- */
      const card = g.weekReportHTML(залип);
      if (!/wrstuck/.test(card)) bad("[затык] в карточке недели нет блока про затык");
      if (!/Показать решение/.test(card))
        bad("[затык] карточка не называет кнопку, которой ребёнок выходит из затыка");
      if (/дались без запинок/.test(card))
        bad("[затык] карточка написала «всё без запинок» при затыке");
      /* затык стоит РАНЬШЕ «дальше по программе»: взрослый читает сверху вниз */
      if (card.indexOf("wrstuck") > card.indexOf("wrnext"))
        bad("[затык] затык показан ниже, чем «дальше по программе»");

      /* --- строка группы --- */
      const row2 = g.groupRow("z", залип);
      const kinds2 = row2.marks.map(m => m.k);
      if (kinds2.indexOf("stuck") < 0)
        bad("[затык] в группе нет пометки про затык: " + JSON.stringify(kinds2));
      row2.marks.forEach(m => {
        if (/плох|лен|отста|прогул|спис/i.test(m.txt))
          bad("[затык] пометка выносит приговор: " + m.txt);
      });
      /* застрявший, но ходящий, поднимается выше того, у кого просто пометка */
      const ровный = g.groupRow("w", g.ensureShape({
        stars: { "print-first": 3 },
        log: { "print-first": { solvedAt: now - day, last: now - day,
                                attempts: 5, hints: 1 } } }));
      if (row2.rank <= ровный.rank)
        bad("[затык] застрявший не поднялся выше ученика с обычной пометкой: " +
            row2.rank + " против " + ровный.rank);
      /* но молчащий по-прежнему выше застрявшего: «не сел вовсе» дороже */
      const молчит = g.groupRow("q", g.ensureShape({
        stars: { "print-first": 3 },
        log: { "print-first": { solvedAt: now - 20*day, last: now - 20*day, attempts: 1 } } }));
      if (молчит.rank <= row2.rank)
        bad("[затык] затык перевесил молчание: " + молчит.rank + " против " + row2.rank);
    }

    /* отчёт и вопросы стоят в карточке ученика: сверяем разметку экрана */
    g.state.hw = {};
    if (problems.length === p0) reportChecked++;
    viewReset(g);
  }

  /* --- 10б2. лестница выхода из затыка ---
     ⚠️ Пункт Б из разбора вопроса фаундера 07.09.2026. Выход из трудного урока
     был всегда — подсказки и «Показать решение», — но неудачные попытки нигде
     не считались, и на пятой попытке экран отвечал то же, что на двадцать
     пятой. Стережём и лестницу, и четыре её правила. */
  if (typeof g.stuckStep === "function"){
    const p0 = problems.length;
    const k = (a, took, shown, all) => { const r = g.stuckStep(a, took, shown, all); return r ? r.k : ""; };

    /* правило 4: раньше четвёртой попытки лестницы нет — три попытки это
       нормальный ход работы, и лезть туда с утешением значит мешать */
    for (const a of [1, 2, 3])
      if (k(a, 0, false, 3)) bad("[лестница] появилась на " + a + "-й попытке — рано");
    if (k(4, 0, false, 3) !== "hint") bad("[лестница] на четвёртой попытке не предложена подсказка");

    /* правило 3: следующий шаг, а не сделанный */
    if (k(5, 1, false, 3) === "hint")
      bad("[лестница] дёргает за рукав сразу после взятой подсказки");
    if (k(6, 1, false, 3) !== "hint") bad("[лестница] после паузы подсказка не предложена снова");
    if (k(4, 3, false, 3) !== "sol")
      bad("[лестница] взявшему все подсказки снова предлагают подсказку");
    if (k(8, 0, false, 3) !== "sol")
      bad("[лестница] на восьмой попытке решение так и не предложено");
    if (k(8, 3, true, 3) === "sol")
      bad("[лестница] открывшему решение предлагают открыть решение");
    if (k(14, 3, true, 3) !== "rest")
      bad("[лестница] после открытого решения и четырнадцати попыток не предложено отложить");
    /* урок без подсказок вовсе — сразу вторая ступень, а не пустота */
    if (k(4, 0, false, 0) !== "sol")
      bad("[лестница] на уроке без подсказок ступени нет вообще");

    /* правило 1: виноват урок, а не ребёнок */
    [g.stuckStepHTML({ k:"hint", left:2 }), g.stuckStepHTML({ k:"sol", took:1 }),
     g.stuckStepHTML({ k:"rest" })].forEach(h => {
      const t = h.replace(/<[^>]+>/g, " ");
      if (/не справ|плох|лен|глуп|стыд|ты не |опять|снова ошиб/i.test(t))
        bad("[лестница] ступень винит ребёнка: " + t);
    });
    if (!/не проигрыш/.test(g.stuckStepHTML({ k:"sol", took:1 })))
      bad("[лестница] про решение не сказано, что открыть его не проигрыш");
    /* правило 2: цена названа честно и не выросла */
    if (!/одна звезда вместо трёх/.test(g.stuckStepHTML({ k:"sol", took:0 })))
      bad("[лестница] цена решения не названа");
    if (!/про урок, а не про тебя/.test(g.stuckStepHTML({ k:"rest" })))
      bad("[лестница] последняя ступень не снимает вину с ребёнка");
    if (g.stuckStepHTML(null) !== "") bad("[лестница] без ступени что-то всё равно рисуется");

    /* --- вживую на уроке: ступень приходит и на пути «Почти» тоже ---
       ⚠️ Путей неудачи в runCheck пять, и ребёнку всё равно, на каком он
       застрял. Берём урок с needCode: там неудача идёт по самой ранней
       ветке, до запуска программы. */
    g.setStars("print-first", 3);
    g.openLesson("text-vs-num");
    await tick();
    const st = studioOf();
    if (!st) bad("[лестница] урок с проверкой по коду не открылся");
    else {
      const btn = st.querySelector('[data-role="check"]');
      let seen = [];
      for (let i = 1; i <= 4; i++){
        st.editor.setCode("print(42)\nprint(2517)\nprint(\"ааааа\")");
        btn.click();
        await tick();
        seen.push(!!doc.querySelector(".stkstep"));
      }
      if (seen[0] || seen[1] || seen[2])
        bad("[лестница] на пути «Почти» ступень пришла раньше четвёртой попытки: " + JSON.stringify(seen));
      if (!seen[3])
        bad("[лестница] на пути «Почти» ступени нет вовсе — она живёт только в одной ветке из пяти");
      const step = doc.querySelector(".stkstep");
      const go = step && doc.getElementById("stkgo");
      if (!go) bad("[лестница] у ступени нет кнопки");
      else {
        /* ⚠️ Кнопка ступени обязана нажимать ТУ ЖЕ кнопку урока: иначе цена
           подсказки разойдётся с ценой из угла экрана. */
        const было = (g.state.log["text-vs-num"] || {}).hints || 0;
        go.click();
        await tick();
        const стало = (g.state.log["text-vs-num"] || {}).hints || 0;
        if (стало !== было + 1)
          bad("[лестница] подсказка через ступень списалась не как обычная: " + было + " → " + стало);
        const out = doc.getElementById("hintout");
        if (!out || out.className.indexOf("show") < 0)
          bad("[лестница] кнопка ступени не открыла настоящую подсказку");
      }
    }
    if (problems.length === p0) ladderChecked++;
    viewReset(g);
  } else bad("[лестница] функции stuckStep нет");

  /* --- 10б3. заметка репетитора к уроку (корзина 3.7) --- */
  if (typeof g.noteFor === "function"){
    const p0 = problems.length;
    const now = Date.now(), day = 864e5;
    const kid = g.ensureShape({
      stars: { "print-first": 3, "text-vs-num": 3 },
      log: {
        "print-first": { solvedAt: now - 2*day, last: now - 2*day, attempts: 1 },
        "text-vs-num": { solvedAt: now - day, last: now - day, attempts: 2 },
        "vars": { solvedAt: null, last: now - day, attempts: 11, hints: 2, timeMs: 1500000 }
      }
    });

    /* ⚠️ Предлагаем не весь курс: заметка к уроку, до которого ребёнок не
       дошёл, — записка в пустоту. Пройденные плюс текущий. */
    const list = g.noteLessons(kid).map(l => l.id);
    if (list.join(",") !== "print-first,text-vs-num,vars")
      bad("[заметка] список уроков для заметки не тот: " + list.join(","));

    const give = g.noteGiveHTML(kid);
    /* по умолчанию выбран урок, где ребёнок застрял: оттуда взрослый и приходит */
    if (!/value="vars"\s+selected/.test(give))
      bad("[заметка] по умолчанию выбран не тот урок, где ребёнок застрял");
    if (!/тут застрял/.test(give)) bad("[заметка] в списке не помечен урок с затыком");
    /* ⚠️ Красная линия: это записка, а не переписка */
    if (!/не может/.test(give) || !/записка, а не переписка/.test(give))
      bad("[заметка] не сказано, что ответить ребёнок не может — иначе это болталка с чёрного хода");

    /* ⚠️ Новичку, который ещё ничего не прошёл, доступен ровно один урок —
       первый. Записка «начни отсюда» к нему осмысленна, поэтому пустого
       списка тут не бывает и карточка не должна прятаться. */
    const новичок = g.noteLessons(g.ensureShape({}));
    if (новичок.length !== 1)
      bad("[заметка] новичку предложено уроков: " + новичок.length + " вместо одного");
    if (!/notepick/.test(g.noteGiveHTML(g.ensureShape({}))))
      bad("[заметка] новичку карточку заметки не показали");

    /* ---- показ ребёнку ---- */
    const st = g.ensureShape({ notes: { "print-first": { t: "Начни со второго примера.",
                                                         by: "репетитор", at: now - 3600e3 } } });
    if (!g.noteFor(st, "print-first")) bad("[заметка] заметка не читается из снимка");
    if (g.noteFor(st, "vars")) bad("[заметка] к уроку без заметки что-то нашлось");
    const card = g.noteCardHTML(g.noteFor(st, "print-first"));
    if (!/Начни со второго примера/.test(card)) bad("[заметка] текст не попал в карточку");
    if (!/репетитор/.test(card)) bad("[заметка] не сказано, кто написал");
    if (g.noteCardHTML(null) !== "") bad("[заметка] без заметки карточка всё равно рисуется");

    /* на экране урока — ПЕРВОЙ, до теории: «начни со второго примера»,
       прочитанное после теории, уже бесполезно */
    g.state.notes = { "print-first": { t: "Смотри на кавычки.", by: "репетитор", at: now } };
    g.save();
    g.openLesson("print-first");
    await tick();
    const col = doc.querySelector(".lcol-read");
    const note = doc.querySelector(".lnote");
    if (!note) bad("[заметка] на экране урока заметки нет");
    else if (col && col.firstElementChild !== note)
      bad("[заметка] заметка стоит не первой в колонке объяснения");
    /* к уроку без заметки её быть не должно */
    g.setStars("print-first", 3);
    g.openLesson("text-vs-num");
    await tick();
    if (doc.querySelector(".lnote"))
      bad("[заметка] заметка от одного урока показалась на другом");
    g.state.notes = {};
    g.save();

    /* ---- слияние: снятая заметка не воскресает ----
       ⚠️ Взрослый снял заметку, а на устройстве ребёнка лежит прежняя, с
       непустым текстом. Если снятие удаляло бы ключ, при следующем обмене
       ребёнок снова прочитал бы то, что уже стёрто. */
    const было = { notes: { "print-first": { t: "Старая", by: "репетитор", at: now - 7200e3 } } };
    const сняли = { notes: { "print-first": { t: "", by: "репетитор", at: now } } };
    if (g.noteFor(g.mergeProgress(было, сняли), "print-first"))
      bad("[заметка] снятая заметка воскресла при слиянии");
    if (g.noteFor(g.mergeProgress(сняли, было), "print-first"))
      bad("[заметка] снятая заметка воскресла при слиянии в обратном порядке");
    if (!g.mergeProgress(было, сняли).notes["print-first"])
      bad("[заметка] надгробие снятой заметки потеряно — она воскреснет на следующем обмене");
    /* свежая заметка побеждает старую */
    const новая = { notes: { "print-first": { t: "Новая", by: "родитель", at: now } } };
    const слито = g.mergeProgress(было, новая);
    if ((g.noteFor(слито, "print-first") || {}).t !== "Новая")
      bad("[заметка] при слиянии победила старая заметка");

    /* ---- «дошло ли» считается по журналу, а не по расписке ---- */
    const свежая = { id: "print-first", at: now - day, t: "x", by: "репетитор" };
    if (!/с тех пор урок открывал/.test(g.noteSeenHint(
        { log: { "print-first": { last: now } } }, свежая)))
      bad("[заметка] открытый после заметки урок не отмечен");
    if (!/с тех пор урок не открывал/.test(g.noteSeenHint(
        { log: { "print-first": { last: now - 3*day } } }, свежая)))
      bad("[заметка] неоткрытый после заметки урок не отмечен");
    if (!/ещё не открывал/.test(g.noteSeenHint({ log: {} }, свежая)))
      bad("[заметка] урок, который не открывали вовсе, не отмечен");

    /* ===== пометки к строкам =====
       ⚠️ Номер строки сам по себе врёт: ребёнок дописывает строки выше, и
       запомненный номер начинает показывать не туда. Поэтому вместе с
       номером хранится ТЕКСТ строки, и точка ищется по нему заново. */
    {
      const код = "print(25 + 17)\n# вторая строка\n# третья строка\n";
      const метка = { ln: 2, src: "# вторая строка", t: "вспомни кавычки" };
      if (g.noteMarkLine(код, метка) !== 2)
        bad("[пометка] на своём месте строка не нашлась");
      /* дописал две строки сверху — пометка обязана переехать */
      if (g.noteMarkLine("x = 1\ny = 2\n" + код, метка) !== 4)
        bad("[пометка] после двух дописанных сверху строк пометка не переехала: " +
            g.noteMarkLine("x = 1\ny = 2\n" + код, метка));
      /* строку стёрли — номера не даём вовсе: соврать хуже, чем промолчать */
      if (g.noteMarkLine("print(25 + 17)\n# третья строка\n", метка) !== 0)
        bad("[пометка] стёртая строка всё ещё показывается на чужом номере");
      /* отступы не считаются: строка та же, сдвинута она или нет */
      if (g.noteMarkLine("print(1)\n    # вторая строка\n", метка) !== 2)
        bad("[пометка] строка со сдвинутым отступом не узналась");
      if (g.noteMarkLine(код, { ln: 2, src: "", t: "х" }) !== 0)
        bad("[пометка] пометка без текста строки к чему-то привязалась");

      /* пометка живёт в той же записи, что и заметка, и едет тем же путём */
      const сМеткой = g.ensureShape({ notes: { "text-vs-num": { t: "", by: "репетитор",
        at: now, marks: [метка] } } });
      const n2 = g.noteFor(сМеткой, "text-vs-num");
      if (!n2) bad("[пометка] запись только с пометкой, без общего текста, считается пустой");
      if (!n2 || n2.marks.length !== 1) bad("[пометка] пометка не доехала до карточки");
      const c2 = g.noteCardHTML(n2);
      if (!/вспомни кавычки/.test(c2)) bad("[пометка] фразы нет в карточке");
      if (!/# вторая строка/.test(c2))
        bad("[пометка] в карточке нет цитаты строки — ребёнок не узнает, о какой речь");
      /* ⚠️ Номера строки в карточке быть НЕ должно: он устаревает от первой
         же дописанной строки, а точка в колонке номеров ищется заново. */
      if (/строка\s*2|строке\s*2/i.test(c2.replace(/<[^>]+>/g, " ")))
        bad("[пометка] в карточке назван номер строки — он соврёт после первой правки");
      /* пустая пометка (текста фразы нет) не показывается */
      const пустая = g.ensureShape({ notes: { "text-vs-num": { t: "", by: "н", at: now,
        marks: [{ ln: 2, src: "# вторая строка", t: "  " }] } } });
      if (g.noteFor(пустая, "text-vs-num")) bad("[пометка] пометка без фразы всё равно показалась");

      /* ---- вживую: точка в колонке номеров едет за строкой ----
         ⚠️ В этом уроке от предыдущего раздела остался черновик, и убрать его
         заранее нельзя: уход с экрана сохраняет код обратно. Поэтому ставим
         заготовку прямо в редактор уже после открытия — ровно то, что видит
         ребёнок, который ещё ничего не печатал. */
      const строкаЗаготовки = g.noteStarterOf("text-vs-num").split("\n")[1];
      g.state.notes = { "text-vs-num": { t: "", by: "репетитор", at: now,
        marks: [{ ln: 2, src: строкаЗаготовки, t: "вспомни кавычки" }] } };
      g.setStars("print-first", 3);
      g.save();
      g.openLesson("text-vs-num");
      await tick();
      const ed2 = studioOf();
      /* ⚠️ Колонку номеров ищем ВНУТРИ редактора, а не по всей странице:
         на экране урока есть и другие блоки кода со своими номерами. */
      const gut = ed2 && ed2.querySelector(".gutter");
      const точки = () => Array.from((gut || { querySelectorAll: () => [] }).querySelectorAll("i"))
        .map((x, i) => x.className === "note" ? i + 1 : 0).filter(Boolean);
      if (!ed2) bad("[пометка] урок не открылся");
      else if (!gut) bad("[пометка] у редактора нет колонки номеров");
      else {
        ed2.editor.setCode(g.noteStarterOf("text-vs-num"));
        await tick();
        if (точки().join(",") !== "2")
          bad("[пометка] точка стоит не на второй строке: " + точки().join(",") +
              " (в редакторе: " + JSON.stringify(ed2.editor.getCode()) + ")");
        ed2.editor.setCode("x = 1\ny = 2\n" + ed2.editor.getCode());
        await tick();
        if (точки().join(",") !== "4")
          bad("[пометка] после двух дописанных строк точка не переехала: " + точки().join(","));
        ed2.editor.setCode("print(1)\n");
        await tick();
        if (точки().length)
          bad("[пометка] строки нет, а точка осталась: " + точки().join(","));
      }
      g.state.notes = {};
      g.save();

      /* ---- сторона взрослого: тыкают в НАШУ заготовку, а не в код ребёнка ----
         ⚠️ Красная линия. Ребёнку обещано в его же профиле: «сам экран и то,
         что ты печатаешь, взрослым не видно», код показывается только когда
         он сам нажал «Показать экран репетитору». */
      const kid2 = g.ensureShape({
        stars: { "print-first": 3 },
        log: { "print-first": { solvedAt: now - day, last: now - day, attempts: 1 },
               "text-vs-num": { solvedAt: null, last: now - day, attempts: 9, timeMs: 9e5 } },
        drafts: { "text-vs-num": { files: [{ name: "main.py",
          code: "СЕКРЕТНЫЙ ЧЕРНОВИК РЕБЁНКА" }], at: now } }
      });
      const дать = g.noteGiveHTML(kid2);
      if (/СЕКРЕТНЫЙ ЧЕРНОВИК/.test(дать))
        bad("[пометка] ⚠️ код ребёнка показан взрослому без его согласия — сломано обещание из профиля ребёнка");
      const строки = (дать.match(/data-mkln="/g) || []).length;
      const заготовка = g.noteStarterOf("text-vs-num").split("\n").length;
      if (строки !== заготовка)
        bad("[пометка] для тыка предложено строк " + строки + " вместо " + заготовка + " строк заготовки");
      if (!/показ экрана/.test(дать))
        bad("[пометка] взрослому не сказано, почему он видит заготовку, а не код ребёнка");
      if (!(g.NOTE_MARKS_MAX >= 2 && g.NOTE_MARKS_MAX <= 10))
        bad("[пометка] предел числа пометок неразумный: " + g.NOTE_MARKS_MAX);
    }

    /* длина: заметка это две-три фразы, а не второй урок */
    if (!(g.NOTE_MAX > 100 && g.NOTE_MAX <= 600))
      bad("[заметка] предел длины неразумный: " + g.NOTE_MAX);

    if (problems.length === p0) noteChecked++;
    viewReset(g);
  } else bad("[заметка] функции noteFor нет");

  /* --- 10в. возвращаемость: метрики, «в следующий раз», «до конца мира»,
     возвращение после паузы --- */
  if (typeof g.worldCountdown === "function"){
    const p0 = problems.length;
    const now = Date.now(), day = 864e5;

    /* Предыдущие разделы решили все сто уроков и настроили рамку — прячем
       живое состояние и возвращаем его в конце раздела как было. */
    const keep = { stars: g.state.stars, days: g.state.days,
                   frame: g.state.frame, schedule: g.state.schedule };
    g.state.stars = {}; g.state.days = {};
    g.state.frame = { days: [] }; g.state.schedule = { days: [] };

    /* 10в.1. До конца мира — в занятиях. 5 уроков из 20 пройдено, рамки нет:
       15 уроков по 3 на занятие (30 минут) — 5 занятий. */
    w.CURRICULUM[0].lessons.slice(0, 5).forEach(l => { g.state.stars[l.id] = 3; });
    const cd = g.worldCountdown(1);
    if (!cd) bad("[возврат] счётчик до конца мира пуст на начатом мире");
    else {
      if (cd.left !== 15) bad("[возврат] осталось уроков: " + cd.left + " вместо 15");
      if (cd.zan !== 5) bad("[возврат] занятий посчитано " + cd.zan + " вместо 5");
    }
    if (g.worldCountdown(2)) bad("[возврат] счётчик показан на не начатом мире");
    w.CURRICULUM[0].lessons.forEach(l => { g.state.stars[l.id] = 3; });
    if (g.worldCountdown(1)) bad("[возврат] счётчик показан на законченном мире");

    /* на Главном строка «до конца мира» видна */
    g.state.stars = {};
    w.CURRICULUM[0].lessons.slice(0, 5).forEach(l => { g.state.stars[l.id] = 3; });
    g.screenWorlds();
    await tick();
    if (!/до конца мира 1/.test(doc.getElementById("app").textContent))
      bad("[возврат] на Главном нет строки «до конца мира»");

    /* и на экране мира */
    g.screenWorld(1);
    await tick(20);
    if (!/это примерно/.test(doc.getElementById("app").textContent))
      bad("[возврат] на экране мира нет счётчика в занятиях");

    /* 10в.2. Возвращение после паузы: карточка без вины. */
    g.state.stars = {};
    g.state.stars["print-first"] = 3;
    g.state.days = {};
    g.state.days[g.dayKey(new Date(now - 5 * day))] = 1;
    const back = g.welcomeBackHTML();
    if (!/С возвращением/.test(back)) bad("[возврат] после паузы нет карточки возвращения");
    if (!/Всё на месте/.test(back)) bad("[возврат] карточка не говорит главного: всё цело");
    if (/пропуст|забросил|потерял|дней не |вин/i.test(back))
      bad("[возврат] карточка возвращения упрекает: " + back.replace(/<[^>]+>/g, " ").slice(0, 120));
    /* сегодня уже занимался — карточки нет */
    g.state.days[g.dayKey()] = 1;
    if (g.welcomeBackHTML() !== "") bad("[возврат] карточка не исчезла после занятия сегодня");
    /* короткая пауза — карточки нет */
    g.state.days = {};
    g.state.days[g.dayKey(new Date(now - 2 * day))] = 1;
    if (g.welcomeBackHTML() !== "") bad("[возврат] карточка вылезла после двух дней — это ещё не пауза");
    /* совсем новый ученик — карточки нет */
    g.state.days = {};
    if (g.welcomeBackHTML() !== "") bad("[возврат] карточка показана тому, кто ещё не начинал");

    /* 10в.3. «В следующий раз»: следующий урок назван, день из расписания. */
    g.state.stars = {}; g.state.days = {};
    g.state.stars["print-first"] = 3;
    g.state.schedule.days = [0, 1, 2, 3, 4, 5, 6];    /* любой день — занятие */
    const nt = g.nextTimeHTML();
    if (!/В следующий раз/.test(nt)) bad("[возврат] нет карточки «в следующий раз»");
    if (!/Текст и числа/.test(nt)) bad("[возврат] следующий урок не назван");
    if (!/Следующее занятие по расписанию/.test(nt)) bad("[возврат] день следующего занятия не назван");
    const nk = g.nextZanDayKey();
    if (nk !== g.shiftDay(g.dayKey(), 1))
      bad("[возврат] при ежедневном расписании следующее занятие не завтра: " + nk);
    g.state.schedule.days = [];
    if (/Следующее занятие/.test(g.nextTimeHTML()))
      bad("[возврат] день занятия назван без расписания — из чего он взялся?");

    /* 10в.4. Метрики на сервере и карточка на экране группы. */
    {
      const stDir = fs.mkdtempSync(path.join(os.tmpdir(), "kq-stats-"));
      process.env.DATA_DIR = stDir;
      w.CLOUD_CONFIG.url = "https://srv.invalid/fn";
      /* ⚠️ Метрики — единственная проверка, которая читает ПАПКУ ЦЕЛИКОМ, а не
         ученика по коду. Значит, ей важно, что в папке лежат только её ученики.
         А у игры есть отложенная отправка (schedulePush, 2–25 секунд): любое
         save() раньше по прогону заводит таймер, и он долетает уже сюда, в
         свежую папку, под кодом основного тестового ученика. У того в журнале
         есть и «vars», и «text-vs-num» — счёт затыков уезжал, и проверка мигала
         (11.09.2026, 1.147.0: tried 4 вместо 3 и лишний урок в списке).
         Лечим не ослаблением счёта, а хозяйством: гасим отложенную отправку
         перед каждым замером и требуем, чтобы в папке были ровно наши файлы.
         Второе — не перестраховка: если чужая запись всё-таки долетит, тест
         обязан назвать её по имени, а не выдать «сервер посчитал неверно». */
      const mine = [];
      const onlyMine = where => {
        g.cancelPush();                       /* гасим отложенную: чужой снимок сюда не долетит */
        if (g.cloudState.timer)
          bad("[метрики] отложенная отправка не погасла — замер снова зависит от секунд");
        const strays = fs.readdirSync(stDir).filter(f => mine.indexOf(f) < 0);
        if (strays.length)
          bad("[метрики] в папку замера (" + where + ") попал чужой ученик: " +
              strays.join(", ") + " — считать по ней нельзя");
      };
      const saveMine = (data, code) => { mine.push(code + ".json"); return w.Cloud.save(data, code); };
      const mkDays = ts => { const o = {}; ts.forEach(t => o[g.dayKey(new Date(t))] = 1); return o; };
      const stars25 = {}; for (let i = 0; i < 25; i++) stars25["l" + i] = 3;
      await saveMine({ xp:1, stars: stars25,
        days: mkDays([now - 20*day, now - 17*day, now - day]),
        log: { a:{ solvedAt: now - day } } }, "stat-a");
      await saveMine({ xp:1, stars: { x:3 }, days: mkDays([now - 20*day]), log: {} }, "stat-b");
      onlyMine("возвращаемость");
      const m = await w.Cloud.stats("kluch-testa");
      if (m.started !== 2) bad("[метрики] начавших: " + m.started + " вместо 2");
      if (m.week.eligible !== 2 || m.week.returned !== 1)
        bad("[метрики] неделя посчитана неверно: " + JSON.stringify(m.week));
      const r20 = m.reach.filter(x => x.lessons === 20)[0];
      if (!r20 || r20.students !== 1) bad("[метрики] до 20-го урока: " + JSON.stringify(m.reach));
      /* карточка на экране группы: и цифры, и честность к малым числам */
      g.adminUnlock();
      g.grpStats.data = m; g.grpStats.error = "";
      g.screenGroup();
      await tick();
      const t = doc.getElementById("app").textContent;
      if (!/Возвращаемость/.test(t)) bad("[метрики] на экране группы нет карточки возвращаемости");
      if (!/Вернулись в первую неделю: 1 из 2/.test(t))
        bad("[метрики] доля недели не показана");
      if (!/это ещё случаи, а не замер/.test(t))
        bad("[метрики] экран молчит о том, что на малых числах это не замер");
      if (!doc.getElementById("grpstats")) bad("[метрики] нет кнопки «Посчитать»");

      /* 10в.5. Затыки по урокам: детектор НАШИХ ошибок.
         Двое сидят на «vars» без решения, один его сдал. Карточка обязана
         назвать урок словами (на сервере только идентификатор) и сказать
         главное — застрявших больше, чем сдавших. */
      await saveMine({ xp:1, stars:{}, days: mkDays([now - day]),
        log: { "vars": { attempts:7, hints:0, shown:0 } } }, "stat-c");
      await saveMine({ xp:1, stars:{}, days: mkDays([now - day]),
        log: { "vars": { attempts:9, hints:0, shown:0 } } }, "stat-d");
      await saveMine({ xp:1, stars:{ "vars":3 }, days: mkDays([now - day]),
        log: { "vars": { solvedAt: now - day, attempts:2 } } }, "stat-e");
      onlyMine("затыки");
      const m2 = await w.Cloud.stats("kluch-testa");
      const zt = (m2.stuck || []).filter(x => x.lesson === "vars")[0];
      if (!zt || zt.stuck !== 2 || zt.tried !== 3 || zt.solved !== 1)
        bad("[затыки] сервер посчитал затык неверно: " + JSON.stringify(m2.stuck));
      /* список затыков — ровно про наших: лишний урок значит чужую запись */
      if ((m2.stuck || []).length !== 1)
        bad("[затыки] в списке затыков не только «vars»: " + JSON.stringify(m2.stuck));
      g.grpStats.data = m2;
      g.screenGroup();
      await tick();
      const tz = doc.getElementById("app").textContent;
      if (!/Где застревают/.test(tz)) bad("[затыки] на экране группы нет карточки затыков");
      if (!/Переменные|Коробки/.test(tz))
        bad("[затыки] урок назван кодом, а не словами: " + tz.slice(0, 200));
      if (!/застряли 2 из 3/.test(tz)) bad("[затыки] числа затыка не показаны");
      if (!/Застрявших больше, чем сдавших/.test(tz))
        bad("[затыки] экран молчит о главном признаке нашей ошибки");
      if (!/не про детей/.test(tz))
        bad("[затыки] карточка не говорит, что это цифра про нас, а не про детей");
      /* пустой список — не молчание, а прямая строка; отсутствие поля — молчание */
      if (!/Никто нигде не застрял/.test(g.stuckTopHTML([])))
        bad("[затыки] на пустом списке карточка ничего не говорит");
      if (g.stuckTopHTML(undefined) !== "")
        bad("[затыки] старый ответ сервера без затыков рисует карточку из ничего");

      /* ⚠️ Формула цены урока и порог живут в ДВУХ файлах: js/app.js и
         cloud/index.js (облачная функция ничего из игры не видит). Разойдутся
         молча: и там, и там всё соберётся. Сверяем число прямо в исходниках. */
      const cloudSrc = fs.readFileSync(path.join(root, "cloud/index.js"), "utf8");
      const appSrc = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
      const cloudPrice = (cloudSrc.match(/STUCK_PRICE\s*=\s*(\d+)/) || [])[1];
      const appPrice = (appSrc.match(/STUCK_PRICE\s*=\s*(\d+)/) || [])[1];
      if (!cloudPrice || !appPrice || cloudPrice !== appPrice)
        bad("[затыки] порог затыка разошёлся: в игре " + appPrice + ", в облаке " + cloudPrice);
      if (String(g.STUCK_PRICE) !== appPrice)
        bad("[затыки] в игре порог из исходника не совпал с рабочим: " + g.STUCK_PRICE);

      /* [возвращаемость] (24.09.2026): тот же счёт в кабинете — по СВОЕМУ
         списку и без ключа сервера. ⚠️ Это копия op=stats, поэтому первое —
         сверка с сервером на тех же снимках, до цифры. */
      if (typeof g.groupStatsCalc === "function"){
        const снимки = fs.readdirSync(stDir).filter(f => /\.json$/.test(f))
          .map(f => JSON.parse(fs.readFileSync(path.join(stDir, f), "utf8")).data);
        const голо = o => { const c = JSON.parse(JSON.stringify(o)); ["ok", "generatedAt", "local"].forEach(k => delete c[k]); return JSON.stringify(c); };
        const свой = g.groupStatsCalc(снимки, Date.now());
        if (голо(свой) !== голо(m2))
          bad("[возвращаемость] счёт в кабинете разошёлся с сервером:\n    кабинет " + голо(свой) + "\n    сервер  " + голо(m2));
        /* репетитор без ключа: двое своих учеников — и цифры только про них */
        const kidsWas = g.state.admin.kids;
        g.state.admin.kids = [{ code: "stat-a", name: "Аня" }, { code: "stat-b", name: "Боря" }];
        g.groupState.rows = null; g.groupState.src = ""; g.grpStats.data = null;
        g.screenGroup(); await tick();
        const ключ = doc.getElementById("grpkey"); if (ключ) ключ.value = "";
        const кн = doc.getElementById("grpstats");
        if (!кн) bad("[возвращаемость] нет кнопки «Посчитать»");
        else {
          кн.click(); await tick(200);
          const d = g.grpStats.data;
          if (!d || !d.local) bad("[возвращаемость] без ключа ничего не посчиталось: " + (g.grpStats.error || JSON.stringify(d)));
          else {
            if (d.started !== 2 || d.week.eligible !== 2 || d.week.returned !== 1)
              bad("[возвращаемость] по своему списку посчитано не про своих: " + JSON.stringify(d.week) + ", начавших " + d.started);
            const tl = doc.getElementById("app").textContent;
            if (!/по вашим ученикам/.test(tl)) bad("[возвращаемость] экран не сказал, что цифры — по вашему списку");
            if (/Кодов на сервере/.test(tl)) bad("[возвращаемость] у своего списка подпись «кодов на сервере»");
          }
        }
        g.state.admin.kids = kidsWas;
        g.groupState.rows = null; g.groupState.src = "";
      }

      g.grpStats.data = null;
      try { fs.rmSync(stDir, { recursive:true, force:true }); } catch(e){}
    }

    g.state.stars = keep.stars; g.state.days = keep.days;
    g.state.frame = keep.frame; g.state.schedule = keep.schedule;
    if (problems.length === p0) returnChecked++;
    viewReset(g);
  }

  /* --- 10г. присутствие и живое занятие ---
     Правило продукта: РЕБЁНОК ВСЕГДА ВИДИТ, КОГДА ЕГО ВИДЯТ. Проверяем и
     механику, и это правило: трансляция без плашки — дефект, а не мелочь. */
  if (typeof g.presenceInfo === "function"){
    const p0 = problems.length;

    /* 10г.1. Статус присутствия: свежая запись — «сейчас в тренажёре». */
    {
      const st = g.ensureShape({ now: { at: Date.now(), place: "lesson", lesson: "vars" } });
      const p = g.presenceInfo(st, Date.now() - 30e3);
      if (!p) bad("[присутствие] свежая запись не считается «сейчас в тренажёре»");
      else if (!/Переменные/.test(p.what)) bad("[присутствие] урок не назван: " + p.what);
      if (g.presenceInfo(st, Date.now() - 10 * 60e3))
        bad("[присутствие] запись десятиминутной давности считается «сейчас»");
      if (g.presenceInfo(st, 0)) bad("[присутствие] отсутствие записи считается присутствием");
      /* «офлайн» не показывается: пустая строка, а не упрёк */
      if (g.presenceHTML(st, 0) !== "")
        bad("[присутствие] для молчащего рисуется строка — офлайн рядом с именем читается как упрёк");

      /* ⚠️ Каждый ключ словаря мест обязан быть НАСТОЯЩИМ местом из кода:
         выдуманный ключ молча превращает статус в «в тренажёре: в тренажёре» —
         так и случилось на бою в первый же день. Список мест снимаем с самого
         приложения, а не переписываем руками. */
      {
        /* ⚠️ Читаем НЕ только app.js. Экраны отрезаются в отдельные файлы
           (договор — в шапке js/screens-showcase.js), и эта проверка падала
           уже ДВАЖДЫ по одной причине: список экранов брался по имени файла.
           Сначала читался только app.js — уехала витрина, ключ «works» стал
           «выдуманным». Потом маска js/screens-*.js — уехала песочница в
           js/sandbox.js, и то же случилось с ключом «sand».
           Теперь файлы отбираются ПО ПРИЗНАКУ, а не по имени: модуль экрана —
           это тот, кто регистрируется в KVSCREENS. Имя файла больше ничего не
           решает, и третьего раза не будет. */
        const src = [path.join(root, "js/app.js")]
          .concat(fs.readdirSync(path.join(root, "js"))
                    .filter(f => /\.js$/.test(f) && f !== "app.js")
                    .map(f => path.join(root, "js", f))
                    .filter(f => /KVSCREENS\s*\./.test(fs.readFileSync(f, "utf8"))))
          .map(f => fs.readFileSync(f, "utf8")).join("\n");
        const real = new Set();
        (src.match(/enterScreen\([^,)]*,\s*"([a-z]+)"/g) || []).forEach(m =>
          real.add(m.replace(/^.*"([a-z]+)"$/, "$1")));
        (src.match(/curPlace = "([a-z]+)"/g) || []).forEach(m =>
          real.add(m.replace(/^.*"([a-z]+)"$/, "$1")));
        Object.keys(g.PLACE_RU).forEach(k => {
          if (!real.has(k))
            bad("[присутствие] в словаре мест выдуманный ключ «" + k + "» — такого экрана нет, подпись мертва");
        });
      }
      /* подробная сводка: что сделано сегодня и как идёт занятие */
      {
        const now2 = Date.now();
        const stD = g.ensureShape({
          now: { at: now2, place: "lesson", lesson: "math" },
          stars: { "print-first": 3, "vars": 2 },
          log: { "print-first": { solvedAt: now2 - 60e3 }, "vars": { solvedAt: now2 - 30e3 } },
          daily: (function(){ const o = {}; o[g.dayKey()] = 1; return o; })(),
          zan: (function(){ const o = {}; o[g.dayKey() + "#1"] =
            { plan: [{ k:"a" }, { k:"b" }, { k:"c" }], done: ["a"], end: 0 }; return o; })(),
          hw: { "hw-klass#5": { id:"hw-klass", seed:5, due:"", by:"репетитор",
                               at: now2, done: now2 - 10e3, tries: 1 } }
        });
        const dh = g.presenceDetailHTML(stD, now2 - 10e3).replace(/<[^>]+>/g, " ");
        if (!/Арифметика/.test(dh)) bad("[присутствие] сводка не назвала текущий урок: " + dh.slice(0, 120));
        if (!/сдано 2 урока/.test(dh)) bad("[присутствие] сводка не посчитала сданные сегодня уроки: " + dh);
        if (!/Переменные/.test(dh)) bad("[присутствие] сводка не назвала сданный урок");
        if (!/идёт занятие: сделано 1 из 3/.test(dh)) bad("[присутствие] ход занятия не показан: " + dh);
        if (!/домашка: 1 задача/.test(dh)) bad("[присутствие] сданная сегодня домашка не показана");
        if (!/задача дня ✓/.test(dh)) bad("[присутствие] задача дня не показана");
        /* вчерашние уроки в «сегодня» не попадают */
        const stOld = g.ensureShape({ stars: { "vars": 2 },
          log: { "vars": { solvedAt: now2 - 3 * 864e5 } } });
        if (/сдано/.test(g.presenceDetailHTML(stOld, 0)))
          bad("[присутствие] в «сегодня» попали старые уроки");
      }

      /* неизвестное место не даёт «в тренажёре: в тренажёре» */
      {
        const odd = g.ensureShape({ now: { at: Date.now(), place: "novoe-mesto", lesson: null } });
        const html = g.presenceHTML(odd, Date.now() - 10e3);
        if (/в тренажёре:.*в тренажёре/.test(html.replace(/<[^>]+>/g, "")))
          bad("[присутствие] неизвестное место даёт «в тренажёре: в тренажёре»: " + html);
        if (!/Сейчас в тренажёре/.test(html))
          bad("[присутствие] при неизвестном месте статус пропал совсем");
      }
    }

    /* 10г.2. Активный тик пишет S.now, и оно уезжает в снимок для сервера. */
    {
      const lid = CUR[0].lessons[0].id;
      g.state.now = null;
      g.setLessonForTest(lid);
      g.setIdleForTest(600000); g.actMark();
      g.tickOnce();
      if (!g.state.now || g.state.now.lesson !== lid)
        bad("[присутствие] активный тик не записал, чем занят ребёнок");
      if (!g.cloudSnapshot().now)
        bad("[присутствие] статус не попадает в снимок для сервера");
      g.setLessonForTest(null);
      /* слияние: свежее побеждает */
      const m = g.mergeProgress({ now: { at: 2000, place: "games" }, savedAt: 1 },
                                { now: { at: 5000, place: "hw" }, savedAt: 2 });
      if (!m.now || m.now.place !== "hw") bad("[присутствие] при слиянии победил не свежий статус");
    }

    /* 10г.3. Живое занятие: сервер настоящий, путь целиком. */
    {
      const lvDir = fs.mkdtempSync(path.join(os.tmpdir(), "kq-live-"));
      process.env.DATA_DIR = lvDir;
      w.CLOUD_CONFIG.url = "https://srv.invalid/fn";
      w.Cloud.setCode("live-kid");

      /* включить может только устройство с кодом — и включение рисует плашку */
      g.liveOffNow();
      if (!g.liveOn()) bad("[живое] трансляция не включилась при настроенном сервере");
      if (!doc.getElementById("livebar"))
        bad("[живое] трансляция идёт, а плашки нет — ребёнок не видит, что его видят");
      if (!/видит твой код/i.test(doc.getElementById("livebar").textContent))
        bad("[живое] плашка не говорит главного");

      /* плашка переживает смену экрана: спрятать её навигацией нельзя */
      g.screenWorlds(); await tick();
      if (!doc.getElementById("livebar")) bad("[живое] смена экрана сняла плашку");

      /* кадр уезжает на сервер и читается взрослым */
      g.openLesson(CUR[0].lessons[0].id); await tick();
      const stEd = studioOf();
      if (stEd) stEd.editor.setCode('print("привет со шпионского моста")');
      g.setIdleForTest(600000); g.actMark();
      g.liveShare.lastSig = "";
      g.liveTick();
      await tick(30);
      const rec = await w.Cloud.liveGet("live-kid");
      if (!rec.found) bad("[живое] кадр не доехал до сервера");
      else {
        if (rec.code.indexOf("шпионского моста") < 0)
          bad("[живое] в кадре не тот код: " + String(rec.code).slice(0, 60));
        if (!/Урок 1/.test(rec.title || "")) bad("[живое] кадр не назвал урок: " + rec.title);
      }

      /* одинаковый кадр повторно не пишется: кадры не бесплатны */
      const putsBefore = calls;
      g.liveTick(); await tick(20);
      g.liveTick(); await tick(20);
      if (calls > putsBefore)
        bad("[живое] неизменившийся кадр всё равно уехал на сервер: " + (calls - putsBefore) + " лишних запросов");

      /* ⚠️ Зритель монотонен. На бою выяснилось: у смонтированного бакета кэш
         свой в каждом экземпляре функции, и соседние ответы расходятся — то
         свежий кадр, то десятисекундной давности, то надгробие. Если верить
         каждому, картинка мигает «идёт / не идёт». */
      {
        const W = g.liveWatcher();
        const t0 = Date.now();
        const f1 = { found:true, serverAt: t0, now: t0, code:"первый", title:"1" };
        const f2 = { found:true, serverAt: t0 + 5000, now: t0 + 5000, code:"второй", title:"2" };
        if (g.liveAccept(W, f1).code !== "первый") bad("[живое] первый кадр не принят");
        if (g.liveAccept(W, f2).code !== "второй") bad("[живое] свежий кадр не принят");
        /* пришёл старый ответ от другого экземпляра — откатываться нельзя */
        const back = g.liveAccept(W, { found:true, serverAt: t0, now: t0 + 5200, code:"первый" });
        if (!back || back.code !== "второй")
          bad("[живое] зритель откатился на старый кадр — картинка будет мигать");
        /* выключение фиксируется и старыми кадрами не отменяется */
        g.liveAccept(W, { found:true, off:true, serverAt: t0 + 9000, now: t0 + 9000 });
        if (g.liveAccept(W, { found:true, serverAt: t0 + 5000, now: t0 + 9100, code:"второй" }))
          bad("[живое] старый кадр воскресил выключенную трансляцию");
        /* молчание дольше окна свежести — трансляции нет */
        const W2 = g.liveWatcher();
        g.liveAccept(W2, { found:true, serverAt: t0, now: t0, code:"x" });
        if (g.liveAccept(W2, { found:false, now: t0 + g.LIVE_FRESH + 5000 }))
          bad("[живое] протухший кадр всё ещё показывается как живой");
      }

      /* экран зрителя показывает код и честность */
      g.screenLiveView("live-kid", "Петя"); await tick(60);
      const t = doc.getElementById("app").textContent;
      if (!/шпионского моста/.test(t)) bad("[живое] зритель не видит код ребёнка");
      if (!/только смотрите|менять отсюда ничего/i.test(t))
        bad("[живое] зрителю не сказано, что менять нельзя");
      if (!/плашка/i.test(t)) bad("[живое] зрителю не сказано, что ребёнок видит просмотр");

      /* выключение: плашка гаснет, файл удаляется */
      g.liveOffNow(); await tick(30);
      if (doc.getElementById("livebar")) bad("[живое] после выключения плашка осталась");
      const gone = await w.Cloud.liveGet("live-kid");
      if (gone.found) bad("[живое] после выключения кадр остался на сервере");

      /* конец занятия гасит трансляцию сам */
      g.liveOn();
      g.state.zan = {};
      const zr = { key: g.dayKey() + "#1", plan: [], done: [], cut: [], start: Date.now() };
      g.screenZanDone(zr); await tick();
      if (g.liveShare.on) bad("[живое] конец занятия не выключил трансляцию");
      if (doc.getElementById("livebar")) bad("[живое] после конца занятия плашка осталась");

      /* профиль говорит ребёнку, что видят взрослые */
      g.screenAccount(); await tick();
      const ta = doc.getElementById("app").textContent;
      if (!/Что видят репетитор и родитель/.test(ta))
        bad("[профиль] ребёнку не сказано, что видят взрослые");
      if (!/Показать экран репетитору/.test(ta))
        bad("[профиль] в профиле нет кнопки показа экрана");

      w.Cloud.forgetCode();
      try { fs.rmSync(lvDir, { recursive:true, force:true }); } catch(e){}
    }

    g.state.now = null;
    if (problems.length === p0) liveChecked++;
    viewReset(g);
  }

  /* --- 10д. планшет: виртуальная клавиатура ---
     Жалоба с боя: клавиатура выскакивает — экран съезжает. Проверяем всё,
     что можно проверить без настоящего планшета: мету вьюпорта, включение
     класса kb по сжатию вьюпорта и CSS-правила, снимающие липкое. */
  if (typeof g.kbApply === "function"){
    const p0 = problems.length;

    if (html.indexOf("interactive-widget=resizes-content") < 0)
      bad("[клавиатура] в мете вьюпорта нет interactive-widget — на Android клавиатура накрывает страницу");

    /* класс kb вешается по сжатию и снимается по возврату */
    if (!g.kbApply(800 - g.KB_SHRINK - 60, 800))
      bad("[клавиатура] заметное сжатие вьюпорта не распознано как клавиатура");
    if (!doc.documentElement.classList.contains("kb"))
      bad("[клавиатура] класс kb не повешен");
    if (g.kbApply(800 - 60, 800))
      bad("[клавиатура] лёгкое сжатие (панель браузера) принято за клавиатуру");
    if (doc.documentElement.classList.contains("kb"))
      bad("[клавиатура] класс kb не снят после закрытия");

    /* CSS: под клавиатурой не остаётся липкого и плавающего */
    if (html.indexOf(".kb .lessongrid:not(.one) .lcol-work{position:static}") < 0)
      bad("[клавиатура] липкая колонка редактора не отключается");
    if (html.indexOf(".kb .taskpin{display:none}") < 0)
      bad("[клавиатура] липкая полоска задания не прячется");
    if (!/\.kb [^{]*\.livebar[^{]*\{display:none\}/.test(html))
      bad("[клавиатура] плавающая плашка трансляции не прячется под клавиатурой");
    if (html.indexOf("scroll-padding-top") < 0 || html.indexOf("scroll-padding-bottom") < 0)
      bad("[клавиатура] нет scroll-padding — автопрокрутка к полю метит в край экрана");

    if (problems.length === p0) kbChecked++;
  }

  /* --- 10е. время в минутах и секундах ---
     Жалоба с боя: «не видно, сколько времени занимался ребёнок». Старый
     формат печатал «—» на всём короче минуты — сорок секунд работы выглядели
     как её отсутствие. Для родителя это ложь ровно в ту сторону, в какую
     врать нельзя, поэтому правило теперь под проверкой. */
  if (typeof g.fmtDur === "function"){
    const p0 = problems.length;

    if (g.fmtDur(40000) !== "40 сек")
      bad("[время] сорок секунд показаны как «" + g.fmtDur(40000) + "» вместо «40 сек»");
    if (/—/.test(g.fmtDur(40000)))
      bad("[время] короткая работа показана прочерком — это выглядит как её отсутствие");
    if (g.fmtDur(3 * 60000 + 20000) !== "3 мин 20 сек")
      bad("[время] минуты с секундами: «" + g.fmtDur(200000) + "»");
    if (g.fmtDur(5 * 60000) !== "5 мин")
      bad("[время] ровные минуты не должны тянуть «0 сек»: «" + g.fmtDur(300000) + "»");
    if (g.fmtDur(72 * 60000) !== "1 ч 12 мин")
      bad("[время] больше часа секунды становятся шумом: «" + g.fmtDur(72 * 60000) + "»");
    if (g.fmtDur(0) !== "0 сек") bad("[время] ноль показан как «" + g.fmtDur(0) + "»");

    /* время за день считается из карты часов — то есть чистая работа */
    {
      const st = g.ensureShape({ hours: (function(){
        const row = new Array(24).fill(0);
        row[10] = 90; row[11] = 45;      /* 135 секунд работы за день */
        const o = {}; o[g.dayKey()] = row; return o;
      })() });
      if (g.daySec(st, g.dayKey()) !== 135)
        bad("[время] секунды за день посчитаны неверно: " + g.daySec(st, g.dayKey()));
      if (g.fmtDur(g.dayMs(st, g.dayKey())) !== "2 мин 15 сек")
        bad("[время] день показан как «" + g.fmtDur(g.dayMs(st, g.dayKey())) + "»");
      /* и это видно взрослому в сводке момента */
      st.now = { at: Date.now(), place: "lesson", lesson: "vars" };
      const dh = g.presenceDetailHTML(st, Date.now() - 5000).replace(/<[^>]+>/g, " ");
      if (!/за тренажёром 2 мин 15 сек/.test(dh))
        bad("[время] в сводке взрослому нет времени за сегодня: " + dh.slice(0, 160));
      /* и ребёнку на «Сегодня» */
      const keepHours = g.state.hours;
      g.state.hours = st.hours;
      g.screenToday();
      await tick();
      const tt = doc.getElementById("app").textContent;
      if (!/Сегодня за тренажёром/.test(tt))
        bad("[время] на экране «Сегодня» ребёнку не показано время");
      if (!/2 мин 15 сек/.test(tt))
        bad("[время] время на «Сегодня» не точное");
      g.state.hours = keepHours;
    }

    if (problems.length === p0) timeFmtChecked++;
    viewReset(g);
  }

  /* --- 10ж. «домой» у каждой роли своё ---
     Жалоба с боя: родитель нажал «Фионика» в шапке и оказался в тренажёре
     ребёнка. У взрослого детская навигация спрятана, и логотип был там
     единственной кнопкой — то есть единственная кнопка вела не туда. */
  if (typeof g.goHome === "function"){
    const p0 = problems.length;
    const savedAdmin = g.state.admin.isAdmin, savedParent = g.state.admin.parentOf;
    const savedPass = g.state.admin.pass;

    /* ученик: домой — это его уроки */
    g.state.admin.isAdmin = false; g.state.admin.parentOf = "";
    g.goHome(); await tick();
    if (!doc.querySelector(".worlds") && !/тренажёр по информатике|дальше — урок/i.test(doc.getElementById("app").textContent))
      bad("[домой] ученик не попал на свой главный экран");

    /* родитель: домой — его кабинет, а не детские уроки */
    g.state.admin.parentOf = "rebenok-1"; g.state.admin.parentLabel = "Рома";
    g.goHome(); await tick();
    {
      const t = doc.getElementById("app").textContent;
      if (!/кабинет родителя/i.test(t))
        bad("[домой] родитель по кнопке «домой» попал не в свой кабинет: " + t.slice(0, 90));
      if (/Начать первый урок|тренажёр по информатике/.test(t))
        bad("[домой] родитель провалился в тренажёр ребёнка");
    }

    /* репетитор: домой — список учеников */
    g.state.admin.parentOf = ""; g.state.admin.isAdmin = true; g.state.admin.pass = "x";
    g.goHome(); await tick();
    {
      const t = doc.getElementById("app").textContent;
      if (/Начать первый урок|дальше — урок/.test(t))
        bad("[домой] репетитор провалился в тренажёр ребёнка: " + t.slice(0, 90));
    }

    /* и сам логотип в шапке зовёт именно goHome, а не детский экран */
    {
      const src = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
      if (/getElementById\("logo"\)\.onclick = screenWorlds/.test(src))
        bad("[домой] логотип по-прежнему ведёт в детский экран мимо ролей");
      /* ⚠️ С 1.84.0 логотип зовёт goLogo, а не goHome, и это НЕ откат к
         прежней ошибке: goLogo ведёт взрослого на страницу сайта, а ребёнка —
         тем же goHome. Раньше взрослый жал на логотип и не получал ничего.
         Требование осталось прежним по сути: логотип обязан идти через роль,
         а не звать детский экран напрямую. */
      if (!/getElementById\("logo"\)\.onclick = goLogo/.test(src))
        bad("[домой] логотип не привязан к goLogo — он снова пойдёт мимо ролей");
      if (/onclick = screenWorlds;/.test(src))
        bad("[домой] осталась кнопка «домой», ведущая в детский экран мимо ролей");
    }

    g.state.admin.isAdmin = savedAdmin;
    g.state.admin.parentOf = savedParent;
    g.state.admin.pass = savedPass;
    if (problems.length === p0) homeChecked++;
    viewReset(g);
  }

  /* --- 11. нотация приёмки --- */
  if (typeof g.specVerdict === "function"){
    const p0 = problems.length;
    const SPECS = w.SPECS || [];

    /* 11.1. Содержание. Эталон обязан работать, сломанный код обязан быть
       ДЕЙСТВИТЕЛЬНО сломан, целый — совпадать с эталоном. Иначе приёмку
       нельзя ни пройти, ни провалить честно. */
    {
      if (SPECS.length < 3) bad("[приёмка] работ подозрительно мало: " + SPECS.length);
      const MP = w.MiniPy;
      SPECS.forEach(t => {
        ["id","title","brief","fn","params","code","truth","note","hints"].forEach(f => {
          if (!t[f] || (Array.isArray(t[f]) && !t[f].length))
            bad("[приёмка] у работы «" + t.id + "» пустое поле «" + f + "»");
        });
        if (!(t.want >= 2)) bad("[приёмка] у «" + t.id + "» слишком мягкий порог строк");
        if (/random|input\(/.test(t.code + t.truth))
          bad("[приёмка] в «" + t.id + "» есть случайность или ввод — вердикт станет невоспроизводимым");
        const okTruth = MP.run(t.truth + "\n" + t.fn, {});
        if (okTruth.error) bad("[приёмка] эталон «" + t.id + "» не запускается: " + okTruth.error.msg);
        const okCode = MP.run(t.code + "\n" + t.fn, {});
        if (okCode.error) bad("[приёмка] код напарника «" + t.id + "» не запускается: " + okCode.error.msg);
        if (t.broken && t.code.replace(/\s+/g, "") === t.truth.replace(/\s+/g, ""))
          bad("[приёмка] «" + t.id + "» помечен сломанным, а код совпадает с эталоном");
        if (!t.broken && t.code.replace(/\s+/g, "") !== t.truth.replace(/\s+/g, ""))
          bad("[приёмка] «" + t.id + "» помечен целым, а от эталона отличается");
      });
    }

    /* 11.2. Разбор строк: четыре слова и внятная жалоба на пятое. */
    {
      const t = w.SPECS[0];
      const good = g.specParse("пример " + t.fn + "([1, 2, 3]) = 6\nвсегда результат >= 0\nне дороже 200 шагов", t);
      if (good.problem) bad("[приёмка] правильная запись не разобралась: " + JSON.stringify(good.problem));
      if (good.rows.length !== 3) bad("[приёмка] строк разобрано " + good.rows.length + " вместо трёх");
      if (good.examples.length !== 1) bad("[приёмка] пример не опознан");
      /* список внутри аргументов не должен разваливаться по запятым */
      const many = g.specSplitArgs("[1, 2, 3], \"а, б\", 7");
      if (many.length !== 3) bad("[приёмка] аргументы разрезаны неверно: " + JSON.stringify(many));

      const bads = [
        ["сделай хорошо", /четыре/i, "неизвестное слово"],
        ["пример " + t.fn + "([1])", /=/, "пример без ответа"],
        ["всегда", /условие/i, "правило без условия"],
        ["не дороже шагов", /число/i, "цена без числа"],
        ["всегда результат >= 0", /не на чем/i, "правило без единого примера"]
      ];
      bads.forEach(([src, re, what]) => {
        const r = g.specParse(src, t);
        if (!r.problem) return bad("[приёмка] принято непонятное: " + what);
        if (!re.test(r.problem.why))
          bad("[приёмка] жалоба на «" + what + "» ничего не объясняет: " + r.problem.why);
      });
    }

    /* 11.3. ⚠️ Каждая строка обязана превращаться в НАСТОЯЩИЙ Python — это
       единственная защита от того, чтобы нотация стала нашим диалектом. */
    {
      const t = w.SPECS[0];
      const parsed = g.specParse("пример " + t.fn + "([1, 2, 3]) = 6\nвсегда результат >= 0", t);
      const py = g.specToPython(parsed, t);
      if (!/assert /.test(py)) bad("[приёмка] в переводе на Python нет ни одного assert");
      /* и этот перевод обязан РАБОТАТЬ на эталоне, а не просто выглядеть кодом */
      const r = w.MiniPy.run(t.truth + "\n\n" + py, {});
      if (r.error)
        bad("[приёмка] перевод на Python не выполняется на эталоне: " +
            r.error.kind + " " + r.error.msg);
      /* а на сломанном коде — обязан упасть проверкой, а не синтаксисом */
      if (t.broken){
        const r2 = w.MiniPy.run(t.code + "\n\n" + py, {});
        if (r2.error && r2.error.kind !== "AssertionError")
          bad("[приёмка] перевод падает не проверкой, а ошибкой записи: " + r2.error.kind);
      }
    }

    /* 11.4. ⚠️ Главное правило механики: спецификация обязана СНАЧАЛА пройти
       на эталоне. Без этого приёмку проходили бы заведомой ложью — написал
       «пример f(1) = 999», код её не прошёл, и мы засчитали. */
    {
      const t = w.SPECS[0];
      const ложь = "пример " + t.fn + "([1]) = 999\nпример " + t.fn + "([2]) = 888";
      const v = g.specVerdict(g.specParse(ложь, t), t, ложь);
      if (v.state !== "wrongspec")
        bad("[приёмка] заведомо ложная спецификация не отклонена: " + v.state);
    }

    /* 11.5. Приёмка целиком: слабая спецификация пропускает поломку, сильная
       её ловит, и обе получают разный ответ. */
    {
      const t = w.SPECS.filter(x => x.broken && x.fn === "total")[0];
      if (!t) bad("[приёмка] нет сломанной работы про сумму — проверка ослабла");
      else {
        const слабая = "пример total([1, 2, 3]) = 6\nпример total([5, 5]) = 10";
        const v1 = g.specVerdict(g.specParse(слабая, t), t, слабая);
        if (v1.state !== "missed")
          bad("[приёмка] слабая спецификация не названа пропустившей поломку: " + v1.state);

        const сильная = слабая + "\nпример total([]) = 0";
        const v2 = g.specVerdict(g.specParse(сильная, t), t, сильная);
        if (v2.state !== "caught")
          bad("[приёмка] сильная спецификация не поймала поломку: " + v2.state);
        const упавшая = (v2.rows || []).filter(r => !r.ok)[0];
        if (!упавшая) bad("[приёмка] поломка поймана, а какой строкой — не сказано");
        /* Вердикт обязан объяснить, ЧТО случилось: либо «ждали столько,
           получили столько», либо честную ошибку движка — сломанный код на
           пустом списке не возвращает неверное, он падает. */
        else if (!/ждали|Номер за пределами|Ошибка/i.test(упавшая.why))
          bad("[приёмка] в вердикте не видно, что пошло не так: " + упавшая.why);

        /* одной строки мало: приёмка из одной строки ничего не доказывает */
        const тонкая = "пример total([]) = 0";
        if (g.specVerdict(g.specParse(тонкая, t), t, тонкая).state !== "thin")
          bad("[приёмка] приёмка из одной строки засчитана");
      }
    }

    /* 11.6. Целая работа: правильная спецификация её ПРИНИМАЕТ, а слишком
       строгая — возвращает, и это разные ответы. */
    {
      const t = w.SPECS.filter(x => !x.broken)[0];
      if (!t) bad("[приёмка] нет ни одной целой работы — жанр сводится к «найди ошибку»");
      else {
        const ok = "пример " + t.fn + "([4, 5]) = 4.5\nпример " + t.fn + "([]) = 0\nвсегда результат >= 0";
        const v = g.specVerdict(g.specParse(ok, t), t, ok);
        if (v.state !== "accepted")
          bad("[приёмка] верная работа не принята: " + v.state + " " + JSON.stringify(v.rows || []));
        const строго = ok + "\nвсегда результат > 0";
        const v2 = g.specVerdict(g.specParse(строго, t), t, строго);
        if (v2.state !== "wrongspec" && v2.state !== "falsealarm")
          bad("[приёмка] слишком строгое правило прошло молча: " + v2.state);
      }
    }

    /* 11.7. «Не дороже N шагов» — строка, которой нет ни у кого. Считаться
       должна ЦЕНА ВЫЗОВА, а не всей программы: описание функции тоже стоит
       шагов, и без вычитания число врало бы тем сильнее, чем длиннее код. */
    {
      const t = w.SPECS[0];
      const щедро = "пример " + t.fn + "([1, 2, 3]) = 6\nне дороже 9999 шагов";
      const v1 = g.specRunAll(g.specParse(щедро, t), t, t.truth);
      if (!v1.ok) bad("[приёмка] щедрый бюджет шагов не прошёл");
      const скупо = "пример " + t.fn + "([1, 2, 3]) = 6\nне дороже 1 шагов";
      const v2 = g.specRunAll(g.specParse(скупо, t), t, t.truth);
      if (v2.ok) bad("[приёмка] бюджет в один шаг прошёл — цена не считается");
      const строка = v2.rows.filter(r => r.kind === "budget")[0];
      if (!строка || !/вышло \d+/.test(строка.why))
        bad("[приёмка] не сказано, во сколько шагов обошлось: " + JSON.stringify(строка));
    }

    /* 11.8. Экран: список, задание, перевод на Python по кнопке. */
    {
      g.screenSpecs(); await tick();
      if (!doc.querySelector("[data-spec]")) bad("[приёмка] на экране нет ни одной работы");
      const t = w.SPECS[0];
      g.openSpec(t.id); await tick();
      const txt = doc.getElementById("app").textContent;
      if (!/Что прислал напарник/.test(txt)) bad("[приёмка] не показан код напарника");
      if (!/менять этот код нельзя/i.test(txt))
        bad("[приёмка] не сказано, что код напарника не переписывают");
      const ta = doc.getElementById("specin");
      if (!ta) bad("[приёмка] нет поля для спецификации");
      else {
        ta.value = "пример " + t.fn + "([1, 2, 3]) = 6\nвсегда результат >= 0";
        doc.getElementById("specpy").click();
        const py = doc.getElementById("specpyout").textContent;
        if (!/assert/.test(py)) bad("[приёмка] кнопка не показала настоящий Python");
        if (!/не наш выдуманный язык/i.test(py))
          bad("[приёмка] не сказано, что это обычный Python, а не наш диалект");
        /* приёмка засчитывается и попадает в прогресс */
        g.state.specs = {};
        ta.value = "пример total([1, 2, 3]) = 6\nпример total([]) = 0";
        doc.getElementById("specgo").click();
        await tick();
        if (!won()) bad("[приёмка] верная приёмка не засчитана");
        if (!g.specDone(t.id)) bad("[приёмка] принятая работа не попала в прогресс");
        closeWin();
      }
      /* слияние двух устройств не теряет принятое */
      const m = g.mergeProgress({ savedAt:1, specs:{ a:1 } }, { savedAt:2, specs:{ b:1 } });
      if (Object.keys(m.specs || {}).length !== 2)
        bad("[приёмка] слияние потеряло принятую работу");
      g.state.specs = {};
      viewReset(g);
    }

    if (problems.length === p0) specChecked++;
  }

  /* --- 12. упаковка раздела «Ты и ИИ» --- */
  if (Array.isArray(g.AI_STAGES)){
    const p0 = problems.length;

    /* 12.1. ⚠️ Ни одно задание не должно потеряться между ступенями. Ступени
       строятся по метке задания, и задание с новой меткой обязано попасть в
       «Остальное», а не исчезнуть с экрана. */
    {
      const xs = w.AILAB || [];
      const noStage = xs.filter(x => !g.aiStageOf(x));
      if (noStage.length)
        bad("[ты и ии] задания без ступени: " + noStage.map(x => x.id + " (" + x.tag + ")").join(", "));
      g.screenAILab(); await tick();
      if (doc.querySelectorAll(".gamecard").length !== xs.length)
        bad("[ты и ии] на экране показаны не все задания: " +
            doc.querySelectorAll(".gamecard").length + " из " + xs.length);
      const heads = [...doc.querySelectorAll(".sect h2")].map(x => x.textContent);
      g.AI_STAGES.forEach(st => {
        if (!(w.AILAB || []).some(x => g.aiStageOf(x) === st.id)) return;
        if (!heads.some(hh => hh.indexOf(st.title) >= 0))
          bad("[ты и ии] ступень «" + st.title + "» пропала с экрана");
      });
    }

    /* 12.2. Обещание раздела — это его упаковка, и оно обязано быть на экране
       словами. Ставка Б продаётся именно отличием: все курсы учат просить,
       этот — принимать. */
    {
      const t = doc.getElementById("app").textContent;
      if (!/принять работу/i.test(t))
        bad("[ты и ии] на экране не сказано, что тут учат принимать работу");
      if (!/как попросить/i.test(t))
        bad("[ты и ии] не названо, чем это отличается от курсов про нейросети");
      if (!/живого ИИ/i.test(t))
        bad("[ты и ии] не сказано, что живой модели тут нет");
      /* приёмка — ступень этого раздела, а не сосед по тренировкам */
      if (!doc.getElementById("toaispecs"))
        bad("[ты и ии] приёмка не связана с разделом");
      if (g.trainCards().some(c => c.id === "spec"))
        bad("[ты и ии] приёмка осталась отдельной карточкой тренировок — упаковки не вышло");
      const ai = g.trainCards().filter(c => c.id === "ai")[0];
      if (!ai || !/принять/i.test(ai.why))
        bad("[ты и ии] карточка тренировок не говорит обещания: " + (ai && ai.why));
    }

    /* 12.3. Дорога назад с приёмки ведёт в раздел, а не в тренировки. */
    {
      g.screenSpecs(); await tick();
      const back = doc.getElementById("btn-back");
      if (!back || back.hidden) bad("[ты и ии] на приёмке нет кнопки «Назад»");
      else if (!/Ты и ИИ/.test(back.textContent))
        bad("[ты и ии] с приёмки уводит не в раздел: " + back.textContent);
      back.click(); await tick();
      if (!/Ты и ИИ/.test(doc.getElementById("app").textContent))
        bad("[ты и ии] кнопка «Назад» с приёмки привела не в раздел");
    }

    /* 12.4. Взрослому в кабинете сказано то же отличие — иначе он не узнает,
       что купил не очередной курс «как просить нейросеть». */
    {
      g.adminUnlock();
      g.screenAdult(); await tick();
      const t = doc.getElementById("app").textContent;
      if (!/Чему он учится про ИИ/.test(t))
        bad("[ты и ии] в кабинете взрослого нет карточки про ИИ");
      if (!/принимать работу/i.test(t))
        bad("[ты и ии] взрослому не сказано отличие от курсов «как просить»");
      const b = doc.querySelector('[data-act="toai"]');
      if (!b) bad("[ты и ии] из кабинета нельзя открыть раздел");
      else {
        b.click(); await tick();
        if (!/Ты и ИИ/.test(doc.getElementById("app").textContent))
          bad("[ты и ии] кнопка кабинета открыла не раздел");
      }
      viewReset(g);
    }

    if (problems.length === p0) aiPackChecked++;
  }

  /* --- 11б. редактор на вывеске не растягивается --- */
  {
    /* ⚠️ Жалоба фаундера 07.09.2026: «на мобильной версии экран убегает вниз
       на много слайдов». Редактор на вывеске — тот же, что на уроке, и он
       выравнивает номера строк с переносами, проставляя каждому номеру
       вычисленную высоту. Вне экрана урока расчёт даёт чушь: номерам
       доставались высоты в 900 и 1000 пикселей, окно демо вырастало до 2500.
       Лечится тем, что колонка номеров на вывеске спрятана — шесть строк
       примера в нумерации не нуждаются. Высоту в jsdom не измерить, поэтому
       стережём само правило. */
    const cssTxt = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
    if (!/\.dwed \.gutter\{display:none\}/.test(cssTxt))
      bad("[вывеска] колонка номеров в демо-редакторе снова видна — окно растянется на телефоне");
    /* ⚠️ Панель символов на вывеске занимает три ряда телефона и отодвигает
       рисунок ниже сгиба. Ребёнку в уроке она нужна, посетителю — нет: он
       меняет только число, а цифры есть на любой клавиатуре. */
    if (!/\.dwed \.keybar\{display:none\}/.test(cssTxt))
      bad("[вывеска] панель символов в демо-редакторе снова видна — рисунок уедет ниже сгиба");
    /* ⚠️ Поля правки чисел в витрине: на телефоне самое узкое было 15×23 —
       пальцем не попасть, а мы сами зовём «поменяй число». Ширину растим,
       высоту НЕТ: строка кода 22 пикселя, и вертикальные отступы столкнули бы
       поля соседних строк. */
    if (!/\.numin\{min-width:2\.4em;padding:0 7px/.test(cssTxt))
      bad("[вывеска] поля правки чисел снова мелкие для пальца");
    if (/\.numin\{[^}]*padding:\s*\d+px \d+px[^}]*\}\s*\}/.test(cssTxt))
      bad("[вывеска] у полей правки чисел появились вертикальные отступы — поля соседних строк столкнутся");
    const html2 = fs.readFileSync(file, "utf8");
    if (!/\.dwed \.gutter\{display:none\}/.test(html2))
      bad("[вывеска] правило про колонку номеров не попало в сборку одним файлом");

    /* ⚠️ Три находки фаундера 07.09.2026 на одном демо-окне. Высоту и обрезку
       в jsdom не измерить, поэтому стережём правила, которыми они лечатся. */

    /* ⚠️ Карусель карточек на телефоне (идея фаундера 07.09.2026). Раскладку
       в jsdom не измерить, а вот УСТРОЙСТВО проверить можно, и именно оно
       ломалось в первой попытке: класс на ряду, точки по числу карточек и
       отсутствие карусели там, где экран широкий. */
    if (typeof g.landSwipeInit === "function"){
      /* ⚠️ Вывеску надо открыть: карусель заводится в конце её отрисовки, а к
         этому месту на экране может стоять что угодно от прошлых разделов. */
      g.screenAbout(); await tick(); await tick();
      const ряды = [...doc.querySelectorAll(".swipe")];
      if (ряды.length < 2)
        bad("[вывеска] карусель не заведена на рядах карточек: " + ряды.length);
      ряды.forEach(row => {
        const dots = row.nextElementSibling;
        if (!dots || !/swdots/.test(dots.className || ""))
          bad("[вывеска] у ряда «" + row.className.split(" ")[0] + "» нет точек");
        else if (dots.children.length !== row.children.length)
          bad("[вывеска] точек " + dots.children.length + ", а карточек " +
              row.children.length + " — счёт разойдётся при первой правке");
        /* ⚠️ В jsdom медиазапрос телефона не подходит, значит карусель обязана
           быть СНЯТА: ряд остаётся своей сеткой, карточки без своей ширины,
           точки спрятаны. Ровно это и есть «мягкий отказ»: не сработало —
           страница осталась прежней, а не сломалась. */
        if (row.style.display)
          bad("[вывеска] на широком экране ряд всё равно переведён в карусель");
        if (row.children[0] && row.children[0].style.width)
          bad("[вывеска] на широком экране карточке задана ширина карусели");
        if (dots && !dots.hidden)
          bad("[вывеска] на широком экране точки карусели видны");
      });
      /* повторный заход не должен задваивать точки */
      const былоТочек = doc.querySelectorAll(".swdots").length;
      g.landSwipeInit(doc.getElementById("app"));
      if (doc.querySelectorAll(".swdots").length !== былоТочек)
        bad("[вывеска] повторный заход задвоил точки карусели");
      /* и правило, без которого точки видны там, где карусели нет */
      if (!/\.swdots\[hidden\]\{display:none\}/.test(cssTxt))
        bad("[вывеска] нет правила, прячущего точки: display:flex перебивает hidden");
    } else bad("[вывеска] функции landSwipeInit нет");

    /* 0. ⚠️ Две половины первого экрана начинаются на ОДНОЙ линии. Раньше у
       .lhin стояло align-items:center, и пока обе были примерно одной высоты,
       это сходило с рук. Как только справа появился рисунок, окно стало выше,
       и заголовок уехал вниз почти на двести пикселей. Находка фаундера
       07.09.2026. Первый экран читают сверху вниз. */
    if (!/\.lhin\{[^}]*align-items:start/.test(cssTxt))
      bad("[вывеска] колонки первого экрана не выровнены по верху — заголовок уедет вниз от окна");
    if (/\.lhin\{[^}]*align-items:center/.test(cssTxt))
      bad("[вывеска] колонки первого экрана снова центрируются по высоте");
    if (!/\.lhin\{[^}]*align-items:start/.test(html2))
      bad("[вывеска] выравнивание колонок по верху не попало в сборку одним файлом");

    /* 1. Подпись справа обрезалась посередине слова: nowrap не влезал в узкую
       колонку, а окно режет по overflow:hidden. */
    if (/\.dwhead \.dwtag\{[^}]*white-space:nowrap/.test(cssTxt))
      bad("[вывеска] подписи в шапке демо вернули nowrap — она снова обрежется посередине слова");
    if (!/\.dwhead\{[^}]*flex-wrap:wrap/.test(cssTxt))
      bad("[вывеска] шапка демо не переносится — длинная подпись вылезет за окно");

    /* 2. ⚠️ Фаундер ввёл 1700 звёзд, и страница уехала на километр вниз. Код
       здесь правит ПОСЕТИТЕЛЬ, и мы сами зовём его менять числа: потолок
       высоты обязан держать страницу целой при любом коде, а не при нашем. */
    if (!/\.dwout\{[^}]*max-height/.test(cssTxt))
      bad("[вывеска] у окна вывода демо нет потолка высоты — длинный вывод растянет страницу");
    if (!/\.dwout\{[^}]*overflow:auto/.test(cssTxt))
      bad("[вывеска] у окна вывода демо нет своей прокрутки — с потолком вывод просто обрежется");
    if (!/\.dwout\{[^}]*max-height/.test(html2))
      bad("[вывеска] потолок высоты вывода не попал в сборку одним файлом");

    /* 3. «И что запускать, если звёздочки уже ниже?» Окно выполняет код при
       открытии, поэтому кнопка не может звать «Запустить»: результат уже на
       экране. И пример теперь рисует — рисунок сам показывает, что код
       выполняется, и растянуть им страницу нельзя. */
    if (typeof g.LAND_DEMO_OK === "string"){
      if (!/circle\(|forward\(/.test(g.LAND_DEMO_OK))
        bad("[вывеска] пример в шапке снова ничего не рисует");
      if (/print\(/.test(g.LAND_DEMO_OK))
        bad("[вывеска] пример в шапке снова печатает — длинный вывод растянет страницу");
      /* ⚠️ На число, которое стоит менять, указано ПРЯМО В КОДЕ. Подпись под
         кнопками не годится: человек, не писавший кода, не связывает цифру в
         подписи с цифрой в программе. Находка фаундера 07.09.2026. */
      const строки = g.LAND_DEMO_OK.split("\n");
      const стрелка = строки.findIndex(l => /#[^\n]*[←↑↓]/.test(l));
      if (стрелка < 0)
        bad("[вывеска] в примере не показано стрелкой, какое число менять");
      else {
        /* стрелка обязана стоять ВПРИТЫК к строке с числом, иначе непонятно,
           на что она показывает */
        const рядом = [строки[стрелка - 1], строки[стрелка + 1]].filter(Boolean);
        if (!рядом.some(l => /=\s*\d/.test(l)))
          bad("[вывеска] стрелка не соседствует со строкой, где задано число: " +
              JSON.stringify(строки.slice(0, 3)));
        /* ⚠️ И она обязана влезать в телефон. В редактор на экране 320
           помещается 23 знака моноширинным; строка длиннее переносится, и
           стрелка оказывается на переносе — то есть указывает в пустоту. */
        строки.forEach((l, i) => {
          if (l.length > 23)
            bad("[вывеска] строка " + (i + 1) + " примера длиннее 23 знаков (" +
                l.length + ") — на телефоне перенесётся: " + JSON.stringify(l));
        });
      }
      /* сломанная версия отличается ровно одним знаком и правда падает */
      const engine = w.Runtime.get("mini");
      const ok = engine.run(g.LAND_DEMO_OK, { turtle: engine.newTurtle() });
      if (ok.error) bad("[вывеска] рабочий пример в шапке падает: " + ok.error.msg);
      const bad2 = engine.run(g.LAND_DEMO_BAD, { turtle: engine.newTurtle() });
      if (!bad2.error) bad("[вывеска] сломанный пример в шапке не падает — доказывать нечего");
      /* и абсурдное число даёт словами объяснимый отказ, а не повисшую вкладку */
      const много = engine.run(g.LAND_DEMO_OK.replace("24", "5000"),
        { turtle: engine.newTurtle() });
      if (!много.error)
        bad("[вывеска] пять тысяч лепестков рисуются молча — посетитель получит зависшую страницу");
    } else bad("[вывеска] примера LAND_DEMO_OK нет наружу");

    const demoHTML = typeof g.landDemoHTML === "function" ? g.landDemoHTML() : "";
    if (/>▶ Запустить</.test(demoHTML))
      bad("[вывеска] кнопка снова зовёт «Запустить», хотя код уже выполнен при открытии");
    if (/число звёзд/.test(demoHTML))
      bad("[вывеска] подпись под окном осталась от прежнего примера со звёздочками");
  }

  /* --- 11б2. «Угадай вывод» на вывеске: две колонки стоят на одной линии --- */
  if (typeof g.landWarmRender === "function"){
    /* ⚠️ Жалоба фаундера 07.09.2026: «не симметрично расположены блоки, один
       выше другого на всех трёх задачах». Причина была структурная: справа
       над полем ответа стояла подпись, слева над кодом — нет, и рамка кода
       вставала вровень с ТЕКСТОМ правой подписи, то есть на сорок пикселей
       выше поля ответа. Две одинаковые с виду коробки стояли рядом со
       сдвигом. Высоту в jsdom не измерить, поэтому стережём саму симметрию:
       у обеих колонок есть подпись и под ней коробка. */
    const box = doc.createElement("div");
    box.id = "warmwin";
    doc.getElementById("app").appendChild(box);
    g.landWarmRender(0);
    const ask = doc.querySelector(".warmask");
    if (!ask) bad("[вывеска] разминка «угадай вывод» не отрисовалась");
    else {
      const left = ask.querySelector(".warmcode"), right = ask.querySelector(".warmans");
      if (!left || !right) bad("[вывеска] у разминки не две колонки");
      else {
        if (!left.querySelector(".warmlbl"))
          bad("[вывеска] у колонки с кодом нет подписи — её рамка встанет выше поля ответа");
        if (!right.querySelector("label"))
          bad("[вывеска] у колонки с ответом нет подписи");
        /* подпись обязана быть ПЕРВОЙ в колонке, иначе коробки снова разъедутся */
        if (left.firstElementChild !== left.querySelector(".warmlbl"))
          bad("[вывеска] подпись слева стоит не первой в колонке");
        if (right.firstElementChild !== right.querySelector("label"))
          bad("[вывеска] подпись справа стоит не первой в колонке");
        if (!left.querySelector(".dwcode")) bad("[вывеска] под подписью слева нет кода");
      }
    }
    const cssW = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
    if (!/\.warmlbl,\.warmans label\{/.test(cssW))
      bad("[вывеска] подписи колонок разминки набраны по-разному — коробки разъедутся");
    box.remove();
    viewReset(g);
  }

  /* --- 11в. витрина проектов на вывеске --- */
  let showcaseChecked = 0;
  if (typeof g.screenAbout === "function" && typeof g.landNums === "function"){
    const p0 = problems.length;
    g.screenAbout(); await tick(); await tick();
    const win = doc.getElementById("showwin");
    if (!win) bad("[витрина] блока с проектами нет");
    else {
      /* Код слева, вывод справа: причина раньше следствия. Указание фаундера
         07.09.2026 — до этого глаз натыкался на результат раньше программы. */
      const labels = [...win.querySelectorAll(".shcol .shlbl")].map(x => x.textContent);
      if (!/Код/.test(labels[0] || "") || !/печатает/.test(labels[1] || ""))
        bad("[витрина] колонки не в том порядке: " + labels.join(" | "));
      /* ⚠️ Кнопки «Запустить заново» тут быть не должно. Программа
         детерминированная, нажатие не меняло ничего — кнопка изображала
         работу вместо того, чтобы её делать. Вопрос фаундера 07.09.2026. */
      if (win.querySelector('[data-sh="run"]'))
        bad("[витрина] вернулась кнопка «Запустить заново», которая ничего не меняет");
      /* ⚠️ Курс и проекты — ОДИН раздел, а не два. Раньше «Программа: 5 миров»
         (пять карточек стопкой) и «Пять программ» (пять вкладок по мирам)
         стояли подряд и вели по одним и тем же пяти мирам: две одинаковые
         навигации по одному и тому же, почти пять экранов телефона. Сокращение
         страницы 07.09.2026. */
      const инфо = doc.getElementById("worldinfo");
      if (!инфо) bad("[витрина] в панели мира нет блока с описанием самого мира");
      else {
        if (!инфо.querySelector(".landworld"))
          bad("[витрина] описание мира не отрисовалось рядом с его проектом");
        if (!/\d+ уроков|\d+ урока/.test(инфо.textContent))
          bad("[витрина] в описании мира не сказано, сколько в нём уроков");
        if (!инфо.querySelectorAll(".lwlist span").length)
          bad("[витрина] в описании мира нет списка уроков");
      }
      /* ⚠️ Карточек мира на странице ровно одна — та, что в открытой вкладке.
         Пять сразу значит, что старый раздел вернулся. */
      const карточек = doc.querySelectorAll(".landworld").length;
      if (карточек !== 1)
        bad("[витрина] карточек мира на странице " + карточек + " вместо одной — " +
            "похоже, раздел про миры снова стоит отдельно от проектов");
      /* вкладки водят по МИРАМ, а не по названиям программ */
      const мет = [...doc.querySelectorAll("#showcase .ltab")].map(b => b.textContent);
      if (!мет.length || !мет.every(t => /Мир \d/.test(t)))
        bad("[витрина] вкладки подписаны не мирами: " + мет.join(" | "));

      /* Числа в коде — живые: их можно поменять, и программа напечатает другое. */
      const ins = [...win.querySelectorAll(".numin")];
      if (ins.length < 3) bad("[витрина] числа в коде не сделаны живыми: полей " + ins.length);
      const out = win.querySelector(".ldout");
      const было = out ? out.textContent : "";
      if (ins.length && out){
        ins[0].value = String((+ins[0].value || 1) + 7);
        ins[0].oninput();
        await new Promise(r => setTimeout(r, 500));
        if (out.textContent === было)
          bad("[витрина] число поменяли, а вывод остался прежним — интерактив не работает");
        const back = doc.getElementById("shback");
        if (!back || back.hidden) bad("[витрина] после правки не предложено вернуть числа как были");
        else {
          back.click(); await tick();
          if (out.textContent !== было) bad("[витрина] «вернуть числа» не вернуло исходный вывод");
        }
      }
      /* Длинные строки переносятся, а не прячутся под полосу прокрутки. */
      const code = win.querySelector(".ldcode");
      if (code && !/\bflow\b/.test(code.className))
        bad("[витрина] код снова уезжает вправо вместо переноса");
      /* ⚠️ И панель не должна носить чужих классов раскладки: «wrap» — это
         класс страницы, и с ним панель получала её отступы (26 сверху,
         90 снизу). Поймано глазами фаундера 07.09.2026. */
      if (code && /\bwrap\b/.test(code.className))
        bad("[витрина] на панели кода класс «wrap» — это класс страницы, он даст ей чужие отступы");
    }
    if (problems.length === p0) showcaseChecked++;
    viewReset(g);
  }

  /* --- 11г. кабинеты: место человека отдельно от роли устройства --- */
  let roomChecked = 0;
  if (typeof g.atHome === "function"){
    const p0 = problems.length;
    const cssAll = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
    /* ⚠️ Жалоба фаундера 07.09.2026: «на главной делаю обновление — уходит в
       кабинет, а должен оставаться на главной». Причина была в том, что при
       загрузке экран выбирался ПО РОЛИ УСТРОЙСТВА, а место человека нигде не
       хранилось. Стережём обе величины и то, что они не путаются. */
    g.adminPassSet("1234");
    g.becomeAdmin();
    g.adminUnlock();

    g.setPlace("room");
    if (g.atHome()) bad("[кабинет] место «в кабинете» не запомнилось");
    g.setPlace("home");
    if (!g.atHome()) bad("[кабинет] место «на главной» не запомнилось");
    /* ⚠️ Место переживает перезагрузку: оно лежит в S.admin, а не в памяти */
    if (g.state.admin.place !== "home")
      bad("[кабинет] место не попало в сохраняемое состояние");

    /* ⚠️ Роль устройства при этом НЕ меняется: «я на главной» и «это мой
       кабинет» — разные вещи, и путать их нельзя. */
    if (!g.isAdminDevice())
      bad("[кабинет] уход на главную снял с устройства роль кабинета");

    /* экраны кабинета перечислены явно: урок, открытый взрослым для
       просмотра, кабинетом не считается */
    ["kids", "kid", "group", "parent", "admin"].forEach(function(k){
      if (g.ROOM_PLACES.indexOf(k) < 0) bad("[кабинет] экран «" + k + "» не считается кабинетом");
    });
    if (g.ROOM_PLACES.indexOf("lesson") >= 0)
      bad("[кабинет] урок засчитан кабинетом — обновление на нём выкинет взрослого в список учеников");
    if (g.ROOM_PLACES.indexOf("about") >= 0)
      bad("[кабинет] вывеска засчитана кабинетом");

    /* ⚠️ САМА ошибка фаундера: что откроется при загрузке. Проверяем правило,
       а не отрисовку — оно вынесено в bootWhere() ровно для этого. */
    g.setPlace("home");
    if (g.bootWhere() !== "about")
      bad("[кабинет] обновление на главной снова уводит в кабинет: " + g.bootWhere());
    g.setPlace("room");
    if (g.bootWhere() !== "adminhome")
      bad("[кабинет] обновление в кабинете не возвращает в кабинет: " + g.bootWhere());
    /* у обычного устройства ничего не поменялось */
    g.becomeKid();
    g.setPlace("room");
    if (g.bootWhere() === "adminhome")
      bad("[кабинет] обычное устройство открывается кабинетом");
    g.becomeAdmin();
    g.adminUnlock();

    /* кнопка выхода есть, и она не то же самое, что «больше не кабинет» */
    g.screenKids();
    await tick();
    const кнопки = [...doc.querySelectorAll("#app button")].map(b => b.textContent);
    if (!кнопки.some(t => /Выйти из кабинета/.test(t)))
      bad("[кабинет] в кабинете нет кнопки выхода: " + кнопки.join(" | "));
    if (!кнопки.some(t => /больше не кабинет/.test(t)))
      bad("[кабинет] пропала кнопка «это устройство больше не кабинет» — это разные вещи");

    /* выход: место — главная, замок закрыт, роль устройства цела */
    g.setPlace("room");
    g.adminUnlock();
    g.leaveRoom();
    await tick();
    if (!g.atHome()) bad("[кабинет] после выхода место осталось «в кабинете»");
    if (typeof g.adminUnlocked !== "function")
      bad("[кабинет] adminUnlocked не выведен наружу — проверку замка не сделать");
    else if (g.adminUnlocked())
      bad("[кабинет] после выхода замок остался открыт — вернуться можно без пароля");
    if (!g.isAdminDevice())
      bad("[кабинет] выход из кабинета стёр роль устройства — это должна делать другая кнопка");
    if (!/Информатика, которую видно/.test(doc.getElementById("app").textContent))
      bad("[кабинет] выход привёл не на главную");

    /* ⚠️ И переключатели: на телефоне по два в ряд, а не столбиком. Просьба
       фаундера 07.09.2026. Раскладку в jsdom не измерить — стережём правило. */
    if (!/\.ltabs:not\(\.ltsm\)\{display:grid;grid-template-columns:repeat\(2,/.test(cssAll))
      bad("[кабинет] переключатели на телефоне снова идут столбиком");
    if (!/\.ltabs:not\(\.ltsm\)/.test(cssAll))
      bad("[кабинет] правило про переключатели не исключает мелкие вкладки с подписью");

    g.becomeKid();
    if (problems.length === p0) roomChecked++;
    viewReset(g);
  } else bad("[кабинет] функции atHome нет");

  /* --- 11д. приборная панель: один вид на вывеске и в кабинете ---
     Жалоба фаундера 08.09.2026: «слишком много текста, столько обычно не
     читают». Список из семи строк «что видит родитель» заменён макетом самого
     кабинета — те же вещи плитками. Стережём три правила разом: макет на
     вывеске есть, он МЁРТВЫЙ и БЕЗ ЧИСЕЛ, а в кабинете те же плитки живые. */
  let dashChecked = 0;
  if (typeof g.screenAbout === "function" && typeof g.screenKids === "function"){
    const p0 = problems.length;
    g.screenAbout(); await tick(); await tick();

    const mock = doc.querySelector("#rolepane .lkmock");
    if (!mock) bad("[панель] на вывеске нет макета кабинета — «Взрослому» снова список строк");
    else {
      const tiles = [...mock.querySelectorAll(".lktile")];
      if (tiles.length < 4) bad("[панель] в макете кабинета плиток " + tiles.length);
      /* ⚠️ Ни одного крупного значения. Выдуманный отчёт про несуществующего
         ребёнка — ровно то враньё, от которого продукт отказывается внутри
         (в панели репетитора имён детей нет). Числа рисует только живая
         плитка, и только настоящие. */
      if (mock.querySelector(".lkval"))
        bad("[панель] в макете кабинета на вывеске появилось число — это выдуманный отчёт");
      /* Макет не кликается: нажимать на витрине нечего, а кнопка это обещает. */
      if (mock.querySelector("button"))
        bad("[панель] плитки макета на вывеске стали кнопками — нажимать там нечего");
      /* Подпись плитки — два-три слова. Длиннее — это снова абзац, только
         разложенный по клеткам. */
      tiles.forEach(function(t){
        const hint = t.querySelectorAll("span");
        const tx = hint.length ? hint[hint.length - 1].textContent : "";
        if (tx.length > 34)
          bad("[панель] подпись плитки длиннее 34 знаков (" + tx.length + "): " + tx);
      });
    }
    /* ⚠️ На телефоне плитки идут ПО ДВЕ в ряд — и в кабинете, и в макете.
       Поймано глазами 08.09.2026: у «.lkmock .lkgrid» вес больше, чем у
       «.lkgrid», а медиазапрос веса не добавляет, и в макете плитки встали
       по одной — семь штук на полтора экрана телефона. Раскладку в jsdom не
       измерить, поэтому стережём само правило. */
    {
      const cssL = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
      if (!/\.lkgrid,\.lkmock \.lkgrid\{grid-template-columns:repeat\(2,/.test(cssL))
        bad("[панель] на телефоне плитки макета снова идут по одной в ряд");
    }
    /* ⚠️ Числа стоят ВНУТРИ левой колонки первого экрана. Отдельной полосой
       под ним они оставляли левую колонку короче правой на четыреста
       пикселей: под кнопками висела дыра в пол-экрана, а окно с рисунком
       справа продолжалось. Жалоба фаундера 08.09.2026 — «слева свободное
       место, всё должно быть симметрично». Высоту в jsdom не измерить,
       поэтому стережём место, где они стоят, и что полоса ровно одна. */
    /* ⚠️ Симметрия ширины (docs § 14): в одной карточке плашки и кнопки
       занимают всю ширину, и потолок ширины на абзацах давал «сверху широко,
       ниже почему-то узко» — жалоба фаундера 08.09.2026. */
    {
      const cssW2 = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
      if (/\.card p\{[^}]*max-width/.test(cssW2))
        bad("[вёрстка] текст в карточке снова режется узкой колонкой при широких соседях");
      /* плашка «глазами ребёнка»: текст одним куском, иначе flex рвёт его
         на элементы и кнопка падает под текст */
      const appSrc = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
      if (!/class="peekbar"><span class="pktx">/.test(appSrc))
        bad("[вёрстка] в плашке просмотра текст снова голыми кусками — flex разорвёт строку");
    }
    /* ⚠️⚠️ ПРАВИЛО ПОЛНОЙ ШИРИНЫ (10.09.2026, слово фаундера).
       Абзац занимает ВСЮ ширину своей колонки. Никаких max-width, режущих
       строку раньше края блока.
       История в три хода, каждый оплачен переделкой.
       06.09.2026: лид развели в две колонки под длинный текст.
       08.09.2026: тексты сократили, лид стал в одну строку и повис в правой
       половине — «как плевок, брошенный почти по центру» (фаундер). Свели в
       одну колонку и подпёрли потолком max-width:62ch.
       10.09.2026: потолок и оказался виноват. Колонка раздела — 1044 px, лид
       обрывался на 606 и уезжал на вторую строку при пустой правой половине:
       текст «режется», а страница от этого ЛИШЬ ДЛИННЕЕ. Те же 62–74ch стояли
       и на страницах сайта (`css/pages.css`).
       ⚠️ Длину выбирает ТЕКСТ, а не колонка: строка кажется длинной —
       сокращай текст. Поэтому проверок две — нет потолка И текст короткий. */
    {
      const cssH = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
      const блок = (cssH.match(/\.secthead\{[^}]*\}/) || [""])[0];
      if (/grid-template-columns/.test(блок))
        bad("[вывеска] лид раздела снова отдельной колонкой справа — короткая строка повиснет в пустоте");

      /* 1. потолков ширины у текста вывески нет */
      [".lede", ".secthead .lede", ".landlede", ".landsub", ".lwbody p", ".hero p", ".card p"].forEach(function(sel){
        const rx = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{[^}]*max-width");
        if (rx.test(cssH))
          bad("[ширина] «" + sel + "» снова режется потолком — текст обязан доходить до края блока");
      });
      const cssP = fs.readFileSync(path.join(root, "css/pages.css"), "utf8");
      ["p", ".lede", ".sub", ".doc"].forEach(function(sel){
        const rx = new RegExp("(^|[},;\\n])\\s*" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
                              "\\{[^}]*max-width", "m");
        if (rx.test(cssP))
          bad("[ширина] на страницах сайта «" + sel + "» снова режется потолком");
      });

      /* 2. раз потолка нет — длину держит сам текст. 1044 px при 15.5 px это
         примерно 145 знаков в строке; берём 130 с запасом на широкие буквы. */
      [...doc.querySelectorAll(".secthead .lede")].forEach(function(el){
        const t = el.textContent.trim();
        if (t.length > 130)
          bad("[ширина] лид раздела длиннее 130 знаков (" + t.length + ") — во всю ширину он уедет на вторую строку: " + t.slice(0, 50));
      });
    }
    if (!doc.querySelector(".lhtext .landnums"))
      bad("[вывеска] числа снова вынесены из первого экрана — слева вернётся дыра");
    if (doc.querySelectorAll(".landnums").length !== 1)
      bad("[вывеска] полос с числами на странице " + doc.querySelectorAll(".landnums").length);

    /* --- развилка по роли на вывеске (13.09.2026, § 2.3 проверка (2)) ---
       Рассылаемый адрес открывает вывеску, а не витрину: без развилки схема
       «попробовал → выбрал, кто ты» человеку по ссылке не видна. Стережём:
       развилка в первом экране, три двери, родитель попадает в проверку
       «что умеет сам», репетитор — на свою страницу, и прежней второй двери
       взрослому («Вот ваш кабинет») рядом нет. */
    {
      const роли = doc.querySelector(".lhtext .landroles");
      if (!роли) bad("[развилка] на первом экране вывески нет «Кто вы:»");
      else {
        const двери = [...роли.querySelectorAll(".rolepill")].map(b => b.textContent.trim());
        if (двери.join(" · ") !== "Я ученик · Я родитель · Я репетитор или учитель")
          bad("[развилка] двери не те: " + двери.join(" · "));
        const реп = роли.querySelector('a.rolepill[href="repetitoru/"]');
        if (!реп) bad("[развилка] «Я репетитор или учитель» не ведёт на страницу repetitoru/");
        if (/Вот ваш кабинет/.test(doc.querySelector(".lhtext").textContent))
          bad("[развилка] рядом осталась прежняя дверь взрослому — две дороги к одному");
        const род = роли.querySelector('[data-land="parent"]');
        if (!род) bad("[развилка] у «Я родитель» нет действия");
        else {
          род.click(); await tick();
          if (g.place() !== "proverka") bad("[развилка] «Я родитель» ведёт не в проверку «что умеет сам»: " + g.place());
        }
        g.screenAbout(); await tick(); await tick();
      }
    }

    /* Шаги урока: под каждым ровно одна строка. Сама дорожка с номерами уже
       говорит «одно за другим», абзац под ней пересказывал её словами. */
    [...doc.querySelectorAll(".landsteps li span")].forEach(function(sp){
      if (sp.textContent.length > 80)
        bad("[вывеска] подпись шага снова абзац (" + sp.textContent.length + " знаков)");
    });

    /* --- кабинет: одна дорога к одному действию --- */
    g.adminPassSet("1234"); g.becomeAdmin(); g.adminUnlock();
    g.screenKids(); await tick();
    /* ⚠️ Плитки-дубли прожили один день (1.103.0): «Группа» и «Панель»
       повторяли навигацию строчкой выше, «Завести ученика» — карточку
       строчкой ниже. Вопрос фаундера 08.09.2026: «зачем кнопка, если ниже
       есть добавить?» — и ответа не нашлось. */
    if (doc.querySelector(".lkgrid.live"))
      bad("[панель] на «Учениках» снова сетка плиток — они дублируют навигацию и карточки");
    if ([...doc.querySelectorAll("#app h3")].filter(x => /Добавить ученика/.test(x.textContent)).length !== 1)
      bad("[панель] дорога «добавить ученика» не одна");
    const nav = [...doc.querySelectorAll(".roomnav button")].map(b => b.textContent);
    if (nav.length !== 3)
      bad("[панель] в навигации кабинета не три экрана: " + nav.join(" | "));
    /* ⚠️ Сама беда, из-за которой это заведено: до 1.103.0 попасть в «Группу»
       можно было только набрав адрес с #group. */
    if (!nav.some(t => /Группа/.test(t)))
      bad("[панель] из кабинета снова нет дороги в «Группу»: " + nav.join(" | "));
    if (!doc.querySelector(".roomnav button.on"))
      bad("[панель] навигация кабинета не показывает, где ты сейчас");
    g.screenGroup(); await tick();
    if (!doc.querySelector(".roomnav")) bad("[панель] на экране группы нет навигации кабинета");

    /* --- панель репетитора: вкладки, всё отрисовано, показано одно --- */
    g.screenAdmin(); await tick();
    const atabs = [...doc.querySelectorAll(".admnav .ltab")];
    if (atabs.length !== 4)
      bad("[панель] в панели репетитора не четыре вкладки: " + atabs.length);
    const apanes = [...doc.querySelectorAll("[data-apane]")];
    if (apanes.length !== 4)
      bad("[панель] панелей под вкладками " + apanes.length + " вместо четырёх");
    if (apanes.filter(p => !p.hidden).length !== 1)
      bad("[панель] видимых панелей " + apanes.filter(p => !p.hidden).length + " — должна быть ровно одна");
    /* ⚠️ Скрытые разделы ОТРИСОВАНЫ: переключение не перерисовывает экран,
       поэтому поле переноса обязано существовать ещё до клика по вкладке. */
    if (!doc.getElementById("admjson"))
      bad("[панель] раздел «Перенос» не отрисован заранее — вкладки стали перерисовкой");
    const ftab = atabs.find(b => /Перенос/.test(b.textContent));
    if (ftab){
      ftab.click(); await tick();
      const vis = apanes.filter(p => !p.hidden);
      if (vis.length !== 1 || vis[0].getAttribute("data-apane") !== "file")
        bad("[панель] клик по вкладке «Перенос» не показал её раздел");
      if (!doc.querySelector(".admnav .ltab.on") || !/Перенос/.test(doc.querySelector(".admnav .ltab.on").textContent))
        bad("[панель] вкладка «Перенос» не отметилась активной");
    }

    /* --- карточка ученика: те же вкладки (сервер подменён заглушкой) ---
       ⚠️ Cloud берётся с ОКНА (w), а не из __game: в экспортах его нет, и
       проверка через g молча пропускала весь блок — мутация это показала. */
    if (!w.Cloud || !w.Cloud.load) bad("[панель] на окне нет Cloud — карточку ученика не проверить");
    else {
      const origLoad = w.Cloud.load, origHas = w.Cloud.hasUrl;
      w.Cloud.load = () => Promise.resolve({ found: false });
      w.Cloud.hasUrl = () => true;
      try {
        const kid = g.kidAdd("Тестовый Ученик");
        g.screenKid(kid.code); await tick(); await tick();
        const ktabs = [...doc.querySelectorAll(".kidnav .ltab")].map(b => b.textContent);
        if (ktabs.length !== 6)
          bad("[панель] в карточке ученика не шесть вкладок: " + ktabs.join(" | "));
        ["Отчёт", "Практика", "Расписание", "Домашка", "Заметка", "Доступ"].forEach(function(t){
          if (!ktabs.some(x => x.indexOf(t) >= 0))
            bad("[панель] в карточке ученика нет вкладки «" + t + "»");
        });
        const kpanes = [...doc.querySelectorAll("[data-kpane]")];
        if (kpanes.filter(p => !p.hidden).length !== 1)
          bad("[панель] в карточке ученика видимых панелей не одна");
        /* новому ученику открыто расписание: отчёта у него ещё нет */
        const kvis = kpanes.find(p => !p.hidden);
        if (kvis && kvis.getAttribute("data-kpane") !== "frame")
          bad("[панель] новому ученику открыта вкладка «" + kvis.getAttribute("data-kpane") + "» вместо расписания");
        /* ⚠️ Пустота объяснена (§ 2.6, 1.158.0): до первого входа ребёнка
           живо только расписание, и молчание про это выглядело поломкой */
        {
          const freshT = doc.getElementById("app").textContent;
          if (!/кабинет почти пуст/.test(freshT) || !/оживут после первого занятия/.test(freshT))
            bad("[панель] новому ученику не объяснена пустота кабинета — «почему всё пустое?» снова без ответа");
        }
        /* клик по «Доступу» обязан ПОКАЗАТЬ доступ — вкладка и её панель
           связаны именем, и расхождение имён рвёт связь молча */
        const kdt = [...doc.querySelectorAll(".kidnav .ltab")].find(b => /Доступ/.test(b.textContent));
        if (kdt){
          kdt.click(); await tick();
          const kv2 = [...doc.querySelectorAll("[data-kpane]")].filter(p => !p.hidden);
          if (kv2.length !== 1 || kv2[0].getAttribute("data-kpane") !== "link" ||
              !kv2[0].querySelector(".codebox"))
            bad("[панель] клик по «Доступу» не показал ссылки ученика");
        }
        g.kidDrop(kid.code);

        /* --- «Сейчас важно»: затык виден НАД вкладками (1.155.0) ---
           Затык — нерешённый урок с ценой ≥ 6 (stuckIn). Внутри вкладки
           «Отчёт» он и так есть; строка над вкладками обязана быть видна
           и после переключения на другую вкладку. */
        w.Cloud.load = () => Promise.resolve({ found: true, serverAt: Date.now(),
          data: { log: { "print-first": { attempts: 9, hints: 3, timeMs: 1200000, last: Date.now() } } } });
        const kidStuck = g.kidAdd("Тест Затык");
        g.screenKid(kidStuck.code); await tick(); await tick();
        if (!doc.querySelector(".cabnow"))
          bad("[панель] затык ученика не виден над вкладками — нет строки «Сейчас важно»");
        const hwTab = [...doc.querySelectorAll(".kidnav .ltab")].find(b => /Домашка/.test(b.textContent));
        if (hwTab){
          hwTab.click(); await tick();
          if (!doc.querySelector(".cabnow"))
            bad("[панель] строка «Сейчас важно» пропала при смене вкладки");
        }
        g.kidDrop(kidStuck.code);
        w.Cloud.load = () => Promise.resolve({ found: false });

        /* --- возврат ученика по ГОТОВОМУ коду ---
           ⚠️ Разбор трёх ролей 12.09.2026: «Убрать» обещала «вернуть можно,
           добавив код обратно», а добавить код было нечем — kidAdd всегда
           придумывает НОВЫЙ со случайным хвостом. На этом 12.09.2026 потерялся
           настоящий ученик: его завели заново, и кабинет смотрел в пустую
           запись, пока прогресс лежал на сервере под прежним кодом. */
        if (typeof g.kidAttach !== "function") bad("[кабинет] нет способа вернуть ученика по коду");
        else {
          const было = g.kidsList().length;
          if (g.kidAttach("НЕ КОД")) bad("[кабинет] негодный код принят в список");
          if (g.kidsList().length !== было) bad("[кабинет] негодный код всё-таки попал в список");

          const k2 = g.kidAttach("roman-3f7a", "Роман");
          if (!k2 || k2.code !== "roman-3f7a")
            bad("[кабинет] готовый код не принят: " + JSON.stringify(k2));
          if (k2 && k2.name !== "Роман") bad("[кабинет] подпись ученика не сохранилась: " + k2.name);
          /* ⚠️ Код НЕ переписывается и хвост не добавляется — иначе возврат
             превратился бы в то самое заведение нового ученика */
          if (!g.kidsList().some(k => k.code === "roman-3f7a"))
            bad("[кабинет] вернувшийся ученик в списке под другим кодом: " +
                g.kidsList().map(k => k.code).join(", "));
          /* повтор не плодит вторую строку, но подпись обновляет.
             ⚠️ Читаем строку списка через проверку на null: при сломанном
             возврате её там нет, и прежняя версия этой проверки падала
             TypeError, унося с собой ВЕСЬ остаток прогона. Проверка обязана
             назвать беду, а не свалиться (нашлось нарочной поломкой). */
          g.kidAttach("roman-3f7a", "Роман Александрович");
          if (g.kidsList().filter(k => k.code === "roman-3f7a").length !== 1)
            bad("[кабинет] повторный возврат завёл ученика второй раз");
          const вернулся = g.kidGet("roman-3f7a");
          if (!вернулся) bad("[кабинет] после повторного возврата ученика нет в списке");
          else if (вернулся.name !== "Роман Александрович")
            bad("[кабинет] повторный возврат не обновил подпись: " + вернулся.name);
          /* заглавные буквы кода приводятся к маленьким, как и везде */
          g.kidAttach("MISHA-7F3A", "Миша");
          if (!g.kidGet("misha-7f3a")) bad("[кабинет] код из заглавных букв не принят");
          /* прибираем за собой по СПИСКУ, а не по ожидаемым кодам: при
             сломанном возврате коды другие, и хвост от одной проверки
             испортил бы соседнюю */
          g.kidsList().slice().forEach(k => g.kidDrop(k.code));

          /* --- правка рамки не теряется молча (разбор трёх ролей 12.09.2026) ---
             ⚠️ kidSave читал рамку при ОТКРЫТИИ карточки, а клал на сервер
             при нажатии «Сохранить» — и голым base.frame = myFrame стирал
             всё, что за это время поменяли с другого устройства. Молча. */
          {
            const T0 = Date.now() - 60 * 60e3;
            const снимок = at => g.ensureShape({ stars:{}, log:{},
              frame: { days:[1], len:30, mix:"balanced", breaks:[], report:true, setAt: at } });
            w.Cloud.load = () => Promise.resolve({ found: true, data: снимок(T0) });
            let saved = 0;
            const origSave = w.Cloud.save;
            w.Cloud.save = function(){ saved++; return Promise.resolve({ ok:true }); };
            try {
              const k4 = g.kidAttach("kidsave-1", "Проверка");
              g.screenKid(k4.code); await tick(); await tick();
              /* взрослый поменял дни у себя в карточке */
              g.frameSet({ days:[6] });
              /* а в это время ту же рамку поменяли с другого устройства */
              w.Cloud.load = () => Promise.resolve({ found: true, data: снимок(Date.now()) });
              const sv = doc.querySelector('[data-kf="save"]');
              if (!sv) bad("[рамка] в карточке ученика нет кнопки сохранения расписания");
              else {
                sv.click(); await tick(); await tick();
                const m4 = doc.getElementById("kidsavemsg");
                if (saved) bad("[рамка] чужая правка рамки затёрта молча: сохранение всё-таки ушло");
                if (!m4 || !/успели поменять/.test(m4.textContent))
                  bad("[рамка] про чужую правку не сказано ни слова: " +
                      ((m4 && m4.textContent) || "нет сообщения"));
              }
              /* а когда никто не мешал — сохраняется как раньше */
              w.Cloud.load = () => Promise.resolve({ found: true, data: снимок(T0) });
              g.screenKid(k4.code); await tick(); await tick();
              g.frameSet({ days:[5] });
              saved = 0;
              const sv2 = doc.querySelector('[data-kf="save"]');
              if (sv2){
                sv2.click(); await tick(); await tick();
                if (!saved) bad("[рамка] обычное сохранение расписания перестало работать");
              }
              g.kidDrop(k4.code);
            } finally { w.Cloud.save = origSave; }
          }

          /* --- код и ссылки у РОДИТЕЛЯ (разбор трёх ролей 12.09.2026) ---
             ⚠️ Вкладка «Доступ» была спрятана от родителя с пометкой
             «родителю раздавать нечего», и код ребёнка не показывался ему
             НИГДЕ: в шапке при заданной подписи стоит имя. При этом экран
             «Не помню код» обещает ребёнку, что у родителя код есть. */
          {
            const st0 = g.ensureShape({ stars:{}, log:{} });
            w.Cloud.load = () => Promise.resolve({ found: true, data: st0 });
            g.becomeParent("rebenok-1", "Рома");
            g.screenParent("rebenok-1"); await tick(); await tick();
            const pt = doc.getElementById("app").textContent;
            const ph = doc.getElementById("app").innerHTML;
            if (pt.indexOf("rebenok-1") < 0)
              bad("[родитель] код ребёнка нигде не показан родителю");
            if (!/data-kd="ccopy"/.test(ph))
              bad("[родитель] код нечем скопировать");
            const ptabs = [...doc.querySelectorAll(".kidnav .ltab")].map(b => b.textContent);
            if (!ptabs.some(x => x.indexOf("Доступ") >= 0))
              bad("[родитель] нет вкладки «Доступ»: " + ptabs.join(" | "));
            if (!/\?kid=rebenok-1/.test(ph))
              bad("[родитель] нет ссылки для устройства ребёнка");
            if (!/\?parent=rebenok-1/.test(ph))
              bad("[родитель] нет ссылки на этот же кабинет для второго устройства");
            /* ⚠️ Рамку родитель править может — это его ребёнок */
            if (!/id="ftime"/.test(ph))
              bad("[родитель] родителю недоступно время занятия");
            /* ⚠️ Карта часов вызывалась в ОДНОМ месте — на устройстве ребёнка.
               У родителя с телефона её не было вовсе, хотя она отвечает на
               самый частый его вопрос: «когда он вообще занимается». */
            if (!/Когда он занимался/.test(pt))
              bad("[родитель] в кабинете родителя нет карты часов");
            if (!/Что показывает практика/.test(pt))
              bad("[родитель] в кабинете родителя нет замера занятий");
            if (!/Как шла работа/.test(pt))
              bad("[родитель] в кабинете родителя нет записи авторства");
            /* ⚠️ Кнопка «Открыть запись» родителю НЕ обещается: экран записи
               читает своё состояние, и по чужому ученику открывать нечего.
               Обещать дверь, которой нет, хуже, чем не обещать (§ 4.35). */
            if (/data-act="totrace"/.test(ph))
              bad("[родитель] родителю обещана кнопка записи, которую открыть нечем");
            /* ⚠️ Кнопка выхода говорит, что произойдёт (§ 4.21, 1.158.0):
               у репетитора «Выйти из кабинета» закрывает замок и роль
               остаётся, у родителя тот же текст отвязывал устройство
               насовсем. Одинаковые слова не должны означать разное. */
            if (!/Выйти и отвязать устройство/.test(pt))
              bad("[родитель] кнопка выхода не говорит про отвязку устройства");
            if (/Выйти из кабинета/.test(pt))
              bad("[родитель] у родителя репетиторская надпись «Выйти из кабинета» — " +
                  "а действие другое: устройство отвязывается насовсем");
            g.becomeAdmin();
          }

          /* и форма возврата есть НА ЭКРАНЕ, а не только в модели */
          g.screenKids(); await tick();
          const kh = doc.getElementById("app").innerHTML;
          if (!/id="kidcode"/.test(kh)) bad("[кабинет] на экране учеников нет поля для готового кода");
          if (!/data-kact="attach"/.test(kh)) bad("[кабинет] нет кнопки возврата по коду");
          if (!/Вернуть ученика по коду/.test(doc.getElementById("app").textContent))
            bad("[кабинет] карточка возврата не названа словами");

          /* --- список учеников файлом (13.09.2026, RAZVITIE § 2.6) ---
             Список живёт только в браузере репетитора (CLOUD_SKIP). Сменил
             компьютер — имена пропали. Проверяем круг целиком: сохранил →
             «новый компьютер» → загрузил → ученики на месте, никто не
             задвоен, чужая подпись не переписана, прогресс не тронут. */
          if (typeof g.kidsListFileText !== "function" || typeof g.kidsListLoadText !== "function")
            bad("[список-файлом] нет сохранения или загрузки списка учеников");
          else {
            g.kidsList().slice().forEach(k => g.kidDrop(k.code));
            g.state.admin.kidsSavedSig = "";
            g.kidAttach("sova-aaaa1", "Аня");
            g.kidAttach("kit-bbbb2", "Боря");
            if (g.kidsSaveNeeded()) bad("[список-файлом] напоминание уже при двух учениках — рано, это шум");
            g.kidAttach("les-cccc3", "Вера");
            if (!g.kidsSaveNeeded()) bad("[список-файлом] три ученика, файла нет — а напоминания нет");

            /* напоминание — та же карточка, поставленная ПЕРВОЙ */
            g.screenKids(); await tick();
            const app1 = doc.getElementById("app").innerHTML;
            const fc = doc.getElementById("kidfile");
            if (!fc || !fc.classList.contains("warn")) bad("[список-файлом] несохранённый список не предупреждён карточкой");
            else if (app1.indexOf('id="kidfile"') > app1.indexOf('id="kidadd"'))
              bad("[список-файлом] предупреждение стоит ниже формы добавления — его не увидят");
            if (doc.querySelectorAll("#kidfile").length !== 1) bad("[список-файлом] карточек файла на экране " + doc.querySelectorAll("#kidfile").length + ", а должна быть ровно одна");

            /* кнопка сохраняет файл по-настоящему — ловим ссылку, не уходя со страницы */
            let скачано = null;
            const origClick = w.HTMLAnchorElement.prototype.click;
            w.HTMLAnchorElement.prototype.click = function(){ скачано = { name: this.download, href: this.href }; };
            try {
              const sb = doc.querySelector('[data-kact="listsave"]');
              if (!sb) bad("[список-файлом] нет кнопки «Сохранить список файлом»");
              else { sb.click(); await tick(); }
            } finally { w.HTMLAnchorElement.prototype.click = origClick; }
            let файл = "";
            if (!скачано) bad("[список-файлом] кнопка сохранения ничего не отдала");
            else {
              if (!/^fionika-ucheniki-\d{4}-\d{2}-\d{2}\.json$/.test(скачано.name || ""))
                bad("[список-файлом] имя файла не то: " + скачано.name);
              try { файл = decodeURIComponent(String(скачано.href).replace(/^data:[^,]*,/, "")); } catch(e){}
            }
            if (!файл) файл = g.kidsListFileText();   /* чтобы проверить остальное, даже если отдача сломана */
            if (g.kidsSaveNeeded()) bad("[список-файлом] после сохранения напоминание не погасло");
            g.screenKids(); await tick();
            const app2 = doc.getElementById("app").innerHTML;
            if (doc.getElementById("kidfile") && doc.getElementById("kidfile").classList.contains("warn"))
              bad("[список-файлом] сохранённый список всё ещё красится предупреждением");
            if (app2.indexOf('id="kidfile"') < app2.indexOf('id="kidlist"'))
              bad("[список-файлом] сохранённый список: карточка файла не ушла под список");

            /* ⚠️ в файле только имена и коды — ни пароля кабинета, ни прогресса */
            let obj = null;
            try { obj = JSON.parse(файл); } catch(e){ bad("[список-файлом] файл не разбирается как JSON"); }
            if (obj){
              if (!Array.isArray(obj.kids) || obj.kids.length !== 3) bad("[список-файлом] в файле не три ученика");
              if (/"pass"|"stars"|"admin"|"xp"/.test(файл))
                bad("[список-файлом] в файл утекло лишнее (пароль, прогресс или admin): " + файл.slice(0, 120));
              if (!obj.kids.some(k => k.code === "kit-bbbb2" && k.name === "Боря"))
                bad("[список-файлом] имя ученика не легло в файл рядом с кодом");
            }

            /* «новый компьютер»: список пуст, один ученик уже заведён под своей подписью */
            const звёзды = JSON.stringify(g.state.stars);
            g.kidsList().slice().forEach(k => g.kidDrop(k.code));
            g.state.admin.kidsSavedSig = "";
            g.kidAttach("kit-bbbb2", "Борис Петрович");
            const сЛишним = JSON.stringify(Object.assign({}, obj || {},
              { kids: ((obj && obj.kids) || []).concat([{ code: "НЕ КОД!", name: "Мусор" }]) }));
            const m = g.kidsListLoadText(сЛишним, null);
            if (!m) bad("[список-файлом] свой же файл не загрузился");
            else if (m.added !== 2 || m.already !== 1 || m.skipped !== 1)
              bad("[список-файлом] загрузка посчитала не так: " + JSON.stringify(m) + " — ждали 2 добавлено, 1 уже был, 1 пропущен");
            if (g.kidsList().length !== 3) bad("[список-файлом] после загрузки в списке " + g.kidsList().length + " учеников, а не 3");
            if (g.kidsList().filter(k => k.code === "kit-bbbb2").length !== 1) bad("[список-файлом] загрузка задвоила ученика");
            const боря = g.kidGet("kit-bbbb2");
            if (!боря || боря.name !== "Борис Петрович")
              bad("[список-файлом] загрузка переписала подпись, которую репетитор дал на этом компьютере: " + (боря && боря.name));
            const аня = g.kidGet("sova-aaaa1");
            if (!аня || аня.name !== "Аня") bad("[список-файлом] ученик из файла вернулся без имени");
            if (JSON.stringify(g.state.stars) !== звёзды) bad("[список-файлом] загрузка списка тронула прогресс устройства");

            /* мусор не портит список, старый файл «Переноса» принимается */
            const до = g.kidsList().length;
            if (g.kidsListLoadText("это не файл", null) !== null) bad("[список-файлом] мусор принят за список");
            if (g.kidsList().length !== до) bad("[список-файлом] мусор изменил список");
            const старый = g.kidsListParse(JSON.stringify({ xp: 10, stars: {}, admin: { pass: "x", kids: [{ code: "old-dddd4", name: "Гоша" }] } }));
            if (!старый.kids || старый.kids[0].code !== "old-dddd4")
              bad("[список-файлом] старый файл прогресса из «Переноса» не отдал список учеников");

            /* и на экране это названо словами, а поле файла есть */
            if (!doc.getElementById("kidfilein")) bad("[список-файлом] на экране нет поля выбора файла");
            if (!/Список учеников файлом|Сохраните список учеников файлом/.test(doc.getElementById("app").textContent))
              bad("[список-файлом] карточка не названа словами");
            g.kidsList().slice().forEach(k => g.kidDrop(k.code));
            g.state.admin.kidsSavedSig = ""; g.state.admin.kidsSavedAt = 0;
          }
        }
      } finally {
        w.Cloud.load = origLoad; w.Cloud.hasUrl = origHas;
      }
    }
    g.becomeKid();
    if (problems.length === p0) dashChecked++;
    viewReset(g);
  }

  /* --- 12б. три честности (13.09.2026, RAZVITIE § 2.6 и § 2.7) ---
     ① галочка «Получать отчёты» ничем не управляла — снята, вместо неё правда
     словами; ② пароль кабинета придумывает первый вошедший — экран говорит
     это прямо, а на устройстве с учеником пароль не ставится без отметки
     «моё устройство»; ③ на /semeynoe-obuchenie/ сказано про баллы эксперта. */
  {
    const fe = g.frameEditorHTML(g.frame());
    if (/data-act="freport"/.test(fe) || /Получать отчёты/.test(fe))
      bad("[честность] в рамке снова переключатель отчётов, который ничем не управляет");
    if (!/Писем мы не шлём/.test(fe)) bad("[честность] рамка не говорит, где отчёт и что писем нет");

    const админ = JSON.parse(JSON.stringify(g.state.admin));
    const звёзды = JSON.parse(JSON.stringify(g.state.stars || {}));
    const пробуем = async (открыть, кнопка, поля) => {
      g.state.admin.pass = "";
      g.adminLock();                 /* открытый замок пустил бы в панель без экрана пароля */
      открыть(); await tick();
      const txt = doc.getElementById("app").textContent;
      поля.forEach(id => { const el = doc.getElementById(id); if (el) el.value = "parol123"; });
      return { txt, own: doc.getElementById("admown"), go: doc.getElementById(кнопка) };
    };
    try {
      for (const [имя, открыть, кнопка, поля] of [
        ["кабинет", () => g.screenAdminSetup(), "apassgo", ["apass1", "apass2"]],
        ["панель", () => g.screenAdmin(), "admgo", ["admcode", "admcode2"]]
      ]){
        /* на устройстве с учеником */
        g.state.stars = { "print-first": 3, "vars": 2 };
        let r = await пробуем(открыть, кнопка, поля);
        if (!/придумывает тот, кто первым сюда вошёл/.test(r.txt))
          bad("[честность] " + имя + ": не сказано, что пароль придумывает первый вошедший");
        if (!/уже занимается ученик: сдано 2 урока/.test(r.txt))
          bad("[честность] " + имя + ": не предупреждено, что на устройстве занимается ученик");
        if (!r.own || !r.go) bad("[честность] " + имя + ": нет отметки «моё устройство» или кнопки");
        else {
          r.go.click(); await tick();
          /* ⚠️ Каждый следующий шаг — только если экран на месте: иначе
             исключение унесёт все собранные ошибки прогона (§ 4.50) */
          const own2 = doc.getElementById("admown"), go2 = doc.getElementById(кнопка);
          if (g.state.admin.pass || !own2 || !go2)
            bad("[честность] " + имя + ": пароль поставлен без отметки «моё устройство»");
          else {
            поля.forEach(id => { const el = doc.getElementById(id); if (el) el.value = "parol123"; });
            own2.checked = true;
            go2.click(); await tick();
            if (!g.state.admin.pass) bad("[честность] " + имя + ": с отметкой пароль всё равно не ставится");
          }
        }
        /* на чистом устройстве отметка не мешает */
        g.state.stars = {};
        r = await пробуем(открыть, кнопка, поля);
        if (r.own) bad("[честность] " + имя + ": отметка «моё устройство» там, где ученик не занимался");
        if (r.go){ r.go.click(); await tick(); }
        if (!g.state.admin.pass) bad("[честность] " + имя + ": на чистом устройстве пароль не ставится");
      }
    } finally {
      g.state.stars = звёзды;
      Object.keys(g.state.admin).forEach(k => delete g.state.admin[k]);
      Object.assign(g.state.admin, админ);
      g.becomeKid();
      viewReset(g);
    }

    const сем = fs.readFileSync(path.join(root, "semeynoe-obuchenie/index.html"), "utf8");
    if (!/Задания 15 и 16 ОГЭ[^<]*критериям эксперта ФИПИ/.test(сем))
      bad("[честность] на /semeynoe-obuchenie/ не сказано, что задания 15 и 16 ОГЭ оцениваются по критериям эксперта ФИПИ");
  }

  /* --- 12в. «Я застрял» — сигнал от ребёнка взрослому (13.09.2026, RAZVITIE § 2.6) ---
     Первая связь «снизу вверх». Граница фаундера: не переписка — три готовые
     фразы, ни одного поля для текста. Гаснет сам по сдаче урока и через сутки. */
  if (typeof g.helpCall !== "function") bad("[застрял] нет сигнала «Я застрял»");
  else {
    const было = { help: g.state.help, stars: g.state.stars, log: g.state.log };
    const origCode = w.Cloud.myCode, origHas = w.Cloud.hasUrl;
    try {
      g.state.help = {};
      g.state.stars = JSON.parse(JSON.stringify(было.stars || {}));
      g.state.log = JSON.parse(JSON.stringify(было.log || {}));
      delete g.state.stars.vars; if (g.state.log.vars) delete g.state.log.vars.solvedAt;

      /* без кода ученика звать некого — кнопки нет */
      w.Cloud.myCode = () => ""; w.Cloud.hasUrl = () => true;
      g.openLesson("vars"); await tick(); await tick();
      if (doc.getElementById("helpbtn")) bad("[застрял] кнопка есть у гостя без кода — сигнал никто не увидит");

      w.Cloud.myCode = () => "help-kid1";
      g.openLesson("vars"); await tick(); await tick();
      const hb = doc.getElementById("helpbtn");
      if (!hb) bad("[застрял] в уроке нет кнопки «Застрял — позвать взрослого»");
      else {
        hb.click(); await tick();
        const out = doc.getElementById("helpout");
        const фразы = [...out.querySelectorAll('[data-stuck]')].filter(b => /^\d$/.test(b.getAttribute("data-stuck")));
        if (фразы.length !== 3) bad("[застрял] готовых фраз не три: " + фразы.length);
        /* ⚠️ Кнопки сигнала не смеют звать общую справку. Пока атрибут звался
           data-help, клик всплывал до обработчика справки и поверх урока
           распахивалось окно «?» с подсказкой не про то. */
        if (out.querySelector("[data-help]"))
          bad("[застрял] кнопка сигнала помечена data-help — клик по ней откроет ещё и окно справки");
        if (out.querySelector("input, textarea, [contenteditable]"))
          bad("[застрял] в сигнале появилось поле для текста — это уже переписка");
        const вторая = фразы[1];
        if (вторая){
          вторая.click(); await tick();
          const h = g.state.help || {};
          if (h.lesson !== "vars" || h.why !== 1 || h.off) bad("[застрял] сигнал не записался: " + JSON.stringify(h));
          if (g.helpIsOpen && g.helpIsOpen())
            bad("[застрял] после выбора фразы поверх урока открылось окно справки");
          if (!/Ты позвал взрослого/.test(doc.getElementById("helpout").textContent))
            bad("[застрял] ребёнку не сказано, что взрослый позван и что это не звонок");
          const hb2 = doc.getElementById("helpbtn");
          if (!hb2 || !hb2.disabled) bad("[застрял] позвать можно второй раз подряд");
        }
      }

      /* сигнал уезжает обычным снимком на сервер — отдельной отправки нет */
      if (!((g.cloudSnapshot() || {}).help || {}).at) bad("[застрял] сигнал не попадает в снимок для сервера");

      /* взрослый видит — по снимку ребёнка */
      const снимок = () => g.ensureShape(JSON.parse(JSON.stringify(g.state)));
      const st = снимок();
      const line = g.helpLineHTML(st).replace(/<[^>]+>/g, "");
      if (!/Зовёт: урок \d+ «/.test(line) || line.indexOf(g.HELP_WHY[1]) < 0)
        bad("[застрял] взрослому не показано, кто зовёт и почему: " + line);
      if (!/Зовёт/.test(g.presenceDetailHTML(st, 0))) bad("[застрял] строки зова нет в сводке «что он делает сейчас»");

      /* урок сдан ПОСЛЕ зова — гаснет; сдан раньше — нет */
      const at = st.help.at;
      const сдан = снимок(); сдан.stars.vars = 3; сдан.log.vars = Object.assign({}, сдан.log.vars, { solvedAt: at + 1000 });
      if (g.helpActive(сдан)) bad("[застрял] урок сдан, а зов не погас");
      const раньше = снимок(); раньше.stars.vars = 3; раньше.log.vars = Object.assign({}, раньше.log.vars, { solvedAt: at - 60000 });
      if (!g.helpActive(раньше)) bad("[застрял] зов погас из-за сдачи урока, случившейся ДО зова");
      const старый = снимок(); старый.help.at = Date.now() - 25 * 3600e3;
      if (g.helpActive(старый)) bad("[застрял] зов суточной давности всё ещё горит");

      /* в группе — первой пометкой и выше в списке */
      const рЗов = g.groupRow("help-kid1", st, 0), рБез = g.groupRow("help-kid1", g.ensureShape(Object.assign(снимок(), { help: {} })), 0);
      if (!рЗов.marks.length || рЗов.marks[0].k !== "help") bad("[застрял] в группе зов не первой пометкой");
      /* ⚠️ больше, чем даёт одна лишняя пометка (10): иначе «поднят» только тем,
         что у него на пометку больше, и тихо молчащий ребёнок его обгонит */
      if (!(рЗов.rank - рБез.rank > 40)) bad("[застрял] зовущий ученик в группе не поднят выше: +" + (рЗов.rank - рБез.rank));

      /* отмена побеждает старый зов при слиянии, а не воскрешает его */
      const зов = снимок();
      g.helpCancel();
      const отмена = снимок();
      if (g.helpActive(отмена)) bad("[застрял] отменённый зов всё ещё горит");
      зов.savedAt = 1; отмена.savedAt = 2;
      if (g.helpActive(g.mergeProgress(зов, отмена)) || g.helpActive(g.mergeProgress(отмена, зов)))
        bad("[застрял] при слиянии устройств отменённый зов воскрес");
      const пусто = g.ensureShape({});
      if (!g.helpActive(g.mergeProgress(пусто, зов))) bad("[застрял] при слиянии с пустым устройством зов потерялся");
    } finally {
      w.Cloud.myCode = origCode; w.Cloud.hasUrl = origHas;
      g.state.help = было.help || {}; g.state.stars = было.stars; g.state.log = было.log;
      viewReset(g);
    }
  }

  /* --- 12а. логотип: дорога на страницу сайта --- */
  let logoChecked = 0;
  if (typeof g.goLogo === "function"){
    const p0 = problems.length;
    const wasAdmin = !!(g.state.admin && g.state.admin.isAdmin);
    const wasParent = (g.state.admin && g.state.admin.parentOf) || "";

    /* ⚠️ Жалоба фаундера 12.09.2026: «нажал Тренировки, потом На главную —
       и оказался в кабинете взрослого». Кнопка не соврала про дорогу (дом
       кабинета — кабинет), она соврала про МЕСТО: надпись была одна на все
       двадцать кнопок #tomap, а дом у каждой роли свой. § 4.21. */
    {
      g.state.admin = g.state.admin || {};
      const былAdmin = !!g.state.admin.isAdmin, былParent = g.state.admin.parentOf || "";
      g.state.admin.isAdmin = true; g.state.admin.parentOf = "";
      if (g.homeLabel() !== "В кабинет")
        bad("[логотип] на устройстве-кабинете кнопка «домой» обещает не кабинет: " + g.homeLabel());
      g.state.admin.isAdmin = false; g.state.admin.parentOf = "rebenok-1";
      if (g.homeLabel() !== "В кабинет")
        bad("[логотип] у родителя кнопка «домой» обещает не кабинет: " + g.homeLabel());
      g.state.admin.parentOf = "";
      /* у ученика надпись прежняя — карта миров и есть его главная */
      const былоИмя = g.state.name; g.state.name = "Тест";
      if (g.homeLabel() !== "На главную")
        bad("[логотип] у ученика надпись «домой» изменилась: " + g.homeLabel());
      /* и это видно НА КНОПКЕ, а не только в функции */
      g.state.admin.isAdmin = true;
      g.screenSandbox(); await tick();
      const hb = doc.getElementById("tomap");
      if (!hb) bad("[логотип] на экране песочницы нет кнопки «домой»");
      else if (!/В кабинет/.test(hb.textContent))
        bad("[логотип] кнопка на экране обещает «" + hb.textContent + "», а ведёт в кабинет");
      g.state.admin.isAdmin = былAdmin; g.state.admin.parentOf = былParent;
      g.state.name = былоИмя;
    }

    /* ⚠️ Жалоба фаундера 07.09.2026: в кабинете репетитора логотип не делал
       НИЧЕГО. Он вёл «домой по роли», а дом репетитора — тот же кабинет, где
       он уже стоит. Выход на общую страницу оставался только ссылкой в самом
       низу, до которой мало кто долистывает. */
    g.state.admin = g.state.admin || {};
    g.state.admin.isAdmin = true;
    g.state.admin.parentOf = "";
    g.screenAdminHome(); await tick();
    g.goLogo(); await tick();
    if (!/О тренажёре|Информатика, которую видно|Фионика — что это/i.test(doc.getElementById("app").textContent))
      bad("[логотип] из кабинета репетитора логотип не вывел на страницу сайта");
    /* и обратно в кабинет — кнопкой в шапке, она обязана остаться видимой */
    const lk = doc.getElementById("tab-lk");
    if (!lk || lk.hidden) bad("[логотип] с вывески не видно кнопки возврата в кабинет");
    else {
      /* ⚠️ Надпись обязана говорить, где человек, а не какая роль у
         устройства. Жалоба фаундера 10.09.2026: «вышел из кабинета, а сверху
         всё равно „Кабинет репетитора“». Замок открыт — «Кабинет
         репетитора»; закрыт (вышел) — «Войти в кабинет». */
      g.adminUnlock(); g.screenAbout(); await tick();
      if (!/Кабинет репетитора/.test(lk.textContent))
        bad("[логотип] при открытом замке кнопка не ведёт в кабинет репетитора: " + lk.textContent);
      g.adminLock(); g.screenAbout(); await tick();
      if (/Кабинет репетитора/.test(lk.textContent))
        bad("[выход] после выхода из кабинета в шапке всё ещё «Кабинет репетитора»");
      if (!/Войти в кабинет/.test(lk.textContent))
        bad("[выход] после выхода из кабинета в шапке нет дороги обратно: " + lk.textContent);
      g.adminUnlock(); g.screenAbout(); await tick();
    }

    /* ⚠️ Взрослый, попавший на урок с вывески, обязан видеть, где он и как
       выйти: детская навигация в шапке подменяет взрослую, и кабинет из урока
       не виден вовсе. Жалоба фаундера 07.09.2026 — «падаю в тренажёр и вообще
       могу все уроки проходить». */
    g.openLesson("print-first"); await tick(); await tick();
    {
      const bar = doc.querySelector(".peekbar");
      if (!bar) bad("[просмотр] взрослый на уроке не видит, что это просмотр");
      else if (!doc.getElementById("peekout"))
        bad("[просмотр] из урока взрослому некуда вернуться");
    }

    /* У ребёнка логотип по-прежнему ведёт к урокам, а не на вывеску:
       у него главная — это и есть уроки. */
    g.state.admin.isAdmin = false;
    g.state.name = g.state.name || "Проверка";
    /* и наоборот: ребёнку эта полоска на уроке не нужна и не показывается */
    g.openLesson("print-first"); await tick(); await tick();
    if (doc.querySelector(".peekbar"))
      bad("[просмотр] ребёнку показали полоску «вы смотрите глазами ребёнка»");
    g.goLogo(); await tick();
    if (!/Уроки/.test(doc.getElementById("app").textContent))
      bad("[логотип] у ребёнка логотип увёл не на его главную");

    g.state.admin.isAdmin = wasAdmin;
    g.state.admin.parentOf = wasParent;
    if (problems.length === p0) logoChecked++;
    viewReset(g);
  }

  /* --- 12г. свой проект с именем --- */
  let workChecked = 0;
  if (typeof g.myWorkSave === "function"){
    const p0 = problems.length;
    g.state.works = {};
    g.state.name = g.state.name || "Аня";

    /* Имя и описание — то, ради чего пункт и делался: пока программа не
       названа, она просто код в редакторе. */
    const id = g.myWorkSave("Угадай число", "загадывает число и даёт подсказку",
                            'секрет = 7\nprint("Загадал число")');
    const w0 = g.myWorkById(id);
    if (!w0) bad("[свой проект] сохранённая программа не находится по id");
    else {
      if (w0.title !== "Угадай число") bad("[свой проект] имя не сохранилось");
      if (!/подсказк/.test(w0.about)) bad("[свой проект] описание не сохранилось");
      /* Ссылка: программа уезжает внутри адреса и возвращается знак в знак,
         вместе с именем автора — без него «смотри, что я сделал» теряет смысл. */
      const link = g.myWorkLink(w0);
      if (link.indexOf("#play=") < 0)
        bad("[свой проект] ссылка не открывает программу запущенной: " + link.slice(0, 40));
      const back = g.playUnpack(link.split("#play=")[1] || "");
      if (!back) bad("[свой проект] ссылка не распаковывается обратно");
      else {
        if (back.code !== w0.code) bad("[свой проект] код в ссылке разошёлся с сохранённым");
        if (back.title !== w0.title) bad("[свой проект] имя в ссылке разошлось с сохранённым");
        if (!back.author) bad("[свой проект] в ссылке не назван автор");
      }
    }
    /* Пустое имя не должно превращаться в пустую карточку. */
    const id2 = g.myWorkSave("   ", "", "print(1)");
    if ((g.myWorkById(id2) || {}).title === "") bad("[свой проект] сохранилась программа без имени");

    /* ⚠️ Два сохранения подряд обязаны дать ДВЕ записи. Первая версия строила
       id из одних миллисекунд, и второе сохранение молча затирало первое:
       сохранил две программы — в «Моём» одна. Тест этого не видел, потому что
       проверял только «не больше предела», а это выполняется и у одной. */
    g.state.works = {};
    g.myWorkSave("Первая", "", "print(1)");
    g.myWorkSave("Вторая", "", "print(2)");
    if (g.myWorksList().length !== 2)
      bad("[свой проект] два сохранения подряд дали " + g.myWorksList().length +
          " запись вместо двух — id повторяются");

    /* Хранилище не растёт бесконечно: это память устройства, а не облако. */
    g.state.works = {};
    for (let k = 0; k < g.WORK_MAX + 4; k++) g.myWorkSave("п" + k, "", "print(" + k + ")");
    if (g.myWorksList().length !== g.WORK_MAX)
      bad("[свой проект] после " + (g.WORK_MAX + 4) + " сохранений осталось " +
          g.myWorksList().length + ", а предел " + g.WORK_MAX);

    /* Раздел в «Моём» и три действия на карточке. */
    g.state.works = {};
    g.myWorkSave("Угадай число", "загадывает число", 'print("Загадал")');
    g.screenFolio(); await tick(); await tick();
    const fol = doc.getElementById("app").textContent;
    if (!/Мои программы/.test(fol)) bad("[свой проект] в «Моём» нет раздела «Мои программы»");
    if (!/Угадай число/.test(fol)) bad("[свой проект] сохранённой программы нет в «Моём»");
    ["data-worklink", "data-workopen", "data-workdel"].forEach(a => {
      if (!doc.querySelector("[" + a + "]"))
        bad("[свой проект] на карточке нет действия " + a);
    });

    /* Пустое «Моё» обязано объяснять, откуда программы берутся. */
    g.state.works = {};
    g.screenFolio(); await tick();
    if (!/песочниц/i.test(doc.getElementById("app").textContent))
      bad("[свой проект] пустой раздел не говорит, где сохранять программу");

    if (problems.length === p0) workChecked++;
    viewReset(g);
  }

  /* --- [двери-моё] дороги в «Моё» и из «Моего» жмутся, а не только рисуются ---
     ⚠️ Родилась из разреза портфолио 15.09.2026 (1.185.0, § 4.55). Три двери
     проверка молча пропускала — нарочная поломка каждой давала зелёный прогон:
       1) «🎒 Открыть «Моё»» в песочнице: кнопка появляется только ПОСЛЕ
          сохранения программы, и её никто не жал;
       2) «Моё» в профиле: экран профиля показывали, но кнопку не жали;
       3) «→ В песочницу» у программы и рисунка: проверялось, что кнопка ЕСТЬ,
          а что она кладёт код в песочницу — нет. Это отдельный вход
          openInSandbox: слот песочницы портфолио не пишет само (§ 4.5). */
  let foldoorsChecked = 0;
  if (typeof g.screenFolio === "function" && typeof g.screenSandbox === "function"){
    const p0 = problems.length;
    const worksWas = g.state.works, sandWas = g.state.sandbox, galWas = g.state.gallery;
    const onFolio = () => /мои работы|Моё/.test((doc.querySelector(".lvlhead h1") || {}).textContent || "") &&
                          /Готовые программы/.test(doc.getElementById("app").textContent);

    /* 1) песочница → сохранить → «Открыть «Моё»» */
    g.state.works = {};
    g.screenSandbox(); await tick();
    const st = studioOf();
    const tw = doc.getElementById("towork");
    if (!st || !tw) bad("[двери-моё] в песочнице нет редактора или кнопки «Назвать и сохранить»");
    else {
      st.editor.setCode('print("дверь")');
      tw.click(); await tick();
      doc.getElementById("worktitle").value = "Дверь";
      doc.getElementById("worksave").click(); await tick();
      const wf = doc.getElementById("workfolio");
      if (!wf) bad("[двери-моё] после сохранения в песочнице нет кнопки «Открыть «Моё»»");
      else { wf.click(); await tick();
        if (!onFolio()) bad("[двери-моё] «Открыть «Моё»» из песочницы не открыла портфолио"); }
    }

    /* 2) профиль → «Моё» */
    g.screenAccount(); await tick();
    const gf = doc.getElementById("gofolio");
    if (!gf) bad("[двери-моё] в профиле нет кнопки «Моё»");
    else { gf.click(); await tick();
      if (!onFolio()) bad("[двери-моё] кнопка «Моё» в профиле не открыла портфолио"); }

    /* 3) «Моё» → «→ В песочницу» у программы и у рисунка: код обязан уехать */
    g.state.works = {}; g.state.sandbox = "";
    const wid = g.myWorkSave("Своя", "", 'print("своя программа")');
    g.screenFolio(); await tick();
    const wo = doc.querySelector('[data-workopen="' + wid + '"]');
    if (!wo) bad("[двери-моё] у программы в «Моём» нет «→ В песочницу»");
    else { wo.click(); await tick();
      if (g.state.sandbox !== 'print("своя программа")')
        bad("[двери-моё] «→ В песочницу» у программы не положила её код в песочницу");
      if (g.place() !== "sand") bad("[двери-моё] «→ В песочницу» у программы не открыла песочницу: " + g.place()); }
    g.state.sandbox = "";
    const pid = g.gallerySave("forward(50)\n");
    g.screenFolio(); await tick();
    const po = doc.querySelector('[data-picopen="' + pid + '"]');
    if (!po) bad("[двери-моё] у рисунка в «Моём» нет «→ В песочницу»");
    else { po.click(); await tick();
      if (g.state.sandbox !== "forward(50)\n")
        bad("[двери-моё] «→ В песочницу» у рисунка не положила его программу в песочницу"); }

    /* 4) «📁 К защите» у собранного проекта — кнопка есть только у собранного,
          и до 1.185.0 её не жал никто: поломка двери проходила зелёной. */
    const projWas = JSON.parse(JSON.stringify(g.state.projects || {}));
    const pj = (w.PROJECTS || [])[0];
    if (!pj) bad("[двери-моё] проектов нет — «К защите» проверить не на чем");
    else {
      g.state.projects = g.state.projects || {};
      g.state.projects[pj.id] = { step: pj.steps.length, done: Date.now(),
                                  code: pj.steps[pj.steps.length - 1].solution };
      g.screenFolio(); await tick();
      const td = doc.querySelector('[data-todef="' + pj.id + '"]');
      if (!td) bad("[двери-моё] у собранного проекта в «Моём» нет «К защите»");
      else { td.click(); await tick();
        if (!/Пакет к защите|к защите/i.test((doc.querySelector(".lvlhead") || {}).textContent || ""))
          bad("[двери-моё] «К защите» из «Моего» не открыла пакет к защите: " + g.place()); }
    }
    g.state.projects = projWas;

    /* 5) «Своё задание»: четыре двери, которые до 1.186.0 не стерегло ничего —
          нарочная поломка каждой давала зелёный прогон (разрез «своих заданий»).
          Кнопка на Главном есть всегда, но её обработчик ищет экран только при
          нажатии; «Составить задание» в «Моём» рисуется при пустом списке,
          «Открыть» — при непустом; черновик сохраняется при УХОДЕ с экрана. */
    const mtWas = g.state.mytasks, draftWas = g.state.mytaskDraft;
    g.state.mytasks = {}; g.state.mytaskDraft = null;
    g.screenWorlds(); await tick();
    const gm = doc.getElementById("gomine");
    if (!gm) bad("[двери-моё] на Главном нет кнопки «Задать задачу»");
    else { gm.click(); await tick();
      if (g.place() !== "mytasks") bad("[двери-моё] «Задать задачу» на Главном не открыла экран задания: " + g.place()); }

    g.screenFolio(); await tick();
    const fmn = doc.getElementById("folio-mine");
    if (!fmn) bad("[двери-моё] в пустом «Моём» нет «Составить задание»");
    else { fmn.click(); await tick();
      if (g.place() !== "mytasks") bad("[двери-моё] «Составить задание» из «Моего» не открыла экран задания: " + g.place()); }

    const tid = g.myTaskSave({ title: "Дверь", goal: "Напечатай слово дверь один раз.", code: 'print("дверь")', lines: ["дверь"] });
    g.screenFolio(); await tick();
    const tto = doc.querySelector('[data-taskopen="' + tid + '"]');
    if (!tto) bad("[двери-моё] у своего задания в «Моём» нет «Открыть»");
    else { tto.click(); await tick();
      if (g.place() !== "friendtask") bad("[двери-моё] «Открыть» у задания в «Моём» не открыла его: " + g.place()); }

    /* черновик: начал задание → ушёл на Главное → вернулся — поля на месте */
    g.state.mytasks = {}; g.state.mytaskDraft = null;
    g.screenMyTasks(); await tick();
    const ttl0 = doc.getElementById("tttl"), goal0 = doc.getElementById("tgoal");
    if (!ttl0 || !goal0) bad("[двери-моё] на экране задания нет полей названия и условия");
    else {
      ttl0.value = "Черновик двери"; goal0.value = "Условие, которое нельзя потерять при уходе.";
      g.screenWorlds(); await tick();
      if (!g.state.mytaskDraft || g.state.mytaskDraft.title !== "Черновик двери")
        bad("[двери-моё] начатое задание не сохранилось черновиком при уходе с экрана");
      g.screenMyTasks(); await tick();
      if ((doc.getElementById("tttl") || {}).value !== "Черновик двери")
        bad("[двери-моё] вернулся на экран задания — название черновика пропало");
    }
    g.state.mytasks = mtWas; g.state.mytaskDraft = draftWas;

    g.state.works = worksWas; g.state.sandbox = sandWas; g.state.gallery = galWas;
    if (problems.length === p0) foldoorsChecked++;
    viewReset(g);
  }

  /* --- [двери-вывеска] дороги на вывеску жмутся, а не только рисуются ---
     ⚠️ Родилась из разреза вывески 17.09.2026 (1.187.0, § 4.55). screenAbout
     уехал в js/screens-about.js и в app.js стал ПЕРЕМЕННОЙ, которая
     присваивается при загрузке в середине файла. Профиль (js/account.js)
     брал его значением раньше этого места — и получил бы undefined: кнопка
     «О тренажёре» есть, а нажатие не делает ничего. Проверка «кнопка без
     обработчика» такое не видит (§ 4.55, дополнение), поэтому здесь каждую
     дверь жмут и смотрят, куда привела (g.place()). */
  let aboutdoorsChecked = 0;
  if (typeof g.screenAbout === "function" && typeof g.screenAccount === "function"){
    const p0 = problems.length;
    const onAbout = (where) => { if (g.place() !== "about") bad("[двери-вывеска] " + where + " не открыла вывеску: " + g.place()); };

    /* 1) профиль → «О тренажёре» */
    g.screenAccount(); await tick();
    const ga = doc.getElementById("goabout");
    if (!ga) bad("[двери-вывеска] в профиле нет кнопки «О тренажёре»");
    else { ga.click(); await tick(); onAbout("кнопка «О тренажёре» в профиле"); }

    /* 2) подвал Главного → «О тренажёре» */
    g.screenWorlds(); await tick();
    const fa = doc.querySelector("[data-goabout]");
    if (!fa) bad("[двери-вывеска] на Главном нет подвала «О тренажёре»");
    else { fa.click(); await tick(); onAbout("подвал Главного"); }

    /* 3) окно помощи → «О тренажёре» */
    g.screenWorlds(); await tick();
    g.openHelp(); await tick();
    const ha = doc.getElementById("help-about");
    if (!ha) bad("[двери-вывеска] в окне помощи нет «О тренажёре»");
    else { ha.click(); await tick(); onAbout("«О тренажёре» в окне помощи"); }
    g.closeHelp();

    /* 4) выбор ролей на ничьём устройстве → «Назад: О тренажёре».
          Кнопка рисуется только гостю — без кода, имени и роли. */
    const кодБыл = w.Cloud.myCode(), имяБыло = g.state.name;
    const админБыл = g.state.admin.isAdmin, родительБыл = g.state.admin.parentOf;
    w.Cloud.forgetCode(); g.state.name = "";
    g.state.admin.isAdmin = false; g.state.admin.parentOf = null;
    g.screenRoles(); await tick();
    const bb = doc.getElementById("btn-back");
    if (!bb || bb.hidden || !/О тренажёре/.test(bb.textContent)) bad("[двери-вывеска] на выборе ролей у гостя нет «Назад: О тренажёре»");
    else { bb.click(); await tick(); onAbout("«Назад» с выбора ролей"); }
    if (кодБыл) w.Cloud.setCode(кодБыл); else w.Cloud.forgetCode();
    g.state.name = имяБыло;
    g.state.admin.isAdmin = админБыл; g.state.admin.parentOf = родительБыл;

    /* 5) вывеска гасит сессию урока: иначе трансляция взрослому и «Назад»
          продолжали бы жить уроком, с которого ушли (нарочная поломка
          newSession прошла зелёной, 17.09.2026) */
    g.openLesson(CUR[0].lessons[0].id); await tick();
    if (!g.getSession() || g.getSession().id !== CUR[0].lessons[0].id)
      bad("[двери-вывеска] первый урок не открылся — сессию проверить не на чем");
    else {
      g.screenAbout(); await tick();
      const ses = g.getSession();
      if (!ses || ses.id !== null || ses.studio) bad("[двери-вывеска] вывеска не сбросила сессию урока, с которого ушли");
    }

    if (problems.length === p0) aboutdoorsChecked++;
    viewReset(g);
  }

  /* --- [двери-экзамен] дороги в экраны экзамена и из них жмутся ---
     ⚠️ Родилась из разреза экранов экзамена 17.09.2026 (1.188.0, § 4.55).
     Из тринадцати нарочных поломок прогон поймал три. Зелёными прошли:
     двери, взятые ЗНАЧЕНИЕМ до договора (Главное → карта, Робот, вариант и
     визуализатор из карты и задачи), мёртвый адрес #myexam, дверь «К
     экзаменам» на вывеске, «Защита своего кода» без источников из «Моих
     программ» — и три экрана, переставшие сбрасывать сессию (задача,
     список тем, своя программа). Здесь каждая дверь жмётся, а после
     каждого экрана смотрится, куда привело и чья теперь сессия. */
  let examdoorsChecked = 0;
  if (typeof g.openExamMap === "function" && typeof g.openAlgo === "function"){
    const p0 = problems.length;
    const at = (want, where) => { if (g.place() !== want) bad("[двери-экзамен] " + where + " привела не туда: " + g.place() + " вместо " + want); };
    const mapShown = (where) => { if (!doc.querySelector("[data-exvariant]")) bad("[двери-экзамен] " + where + " открыла не карту экзамена, а список тем"); };

    /* 1) Главное → карточка ЕГЭ */
    g.screenWorlds(); await tick();
    const he = doc.querySelector('[data-exam="ege"]');
    if (!he) bad("[двери-экзамен] на Главном нет карточки ЕГЭ");
    else { he.click(); await tick(); at("algo", "карточка ЕГЭ на Главном"); mapShown("карточка ЕГЭ на Главном"); }

    /* 2) вывеска → «К экзаменам» */
    g.screenAbout(); await tick();
    const le = doc.querySelector('[data-land="exams"]');
    if (!le) bad("[двери-экзамен] на вывеске нет двери к экзаменам");
    else { le.click(); await tick(); at("algo", "дверь к экзаменам на вывеске"); mapShown("дверь к экзаменам на вывеске"); }

    /* 3) карта ОГЭ → Робот и → пробный вариант */
    g.openExamMap("oge"); await tick();
    const rb = doc.querySelector("[data-exrobot]");
    if (!rb) bad("[двери-экзамен] на карте ОГЭ нет двери к Роботу");
    else { rb.click(); await tick(); at("robot", "дверь к Роботу на карте ОГЭ"); }
    g.openExamMap("oge"); await tick();
    const variantWas = JSON.parse(JSON.stringify(g.state.variant || {}));
    const vb = doc.querySelector("[data-exvariant]");
    if (!vb) bad("[двери-экзамен] на карте ОГЭ нет двери к пробному варианту");
    else { vb.click(); await tick(); at("variant", "дверь к варианту на карте ОГЭ"); }
    /* вкладка варианта живёт в его модуле: вернуть ЕГЭ, как было до двери */
    const vte = doc.querySelector('[data-vtab="ege"]');
    if (vte) { vte.click(); await tick(); }
    g.state.variant = variantWas;

    /* 4) задача: своя сессия, «Разобрать» → визуализатор */
    const x0 = g.algoList()[0];
    g.openAlgo(x0.id); await tick();
    const s1 = g.getSession();
    if (!s1 || s1.id !== x0.id || !s1.algo || !s1.studio) bad("[двери-экзамен] задача не завела свою сессию: " + JSON.stringify(s1 && { id: s1.id, algo: s1.algo }));
    const vz = doc.querySelector('#studio [data-role="viz"]');
    if (!vz) bad("[двери-экзамен] в задаче нет «Разобрать»");
    else { vz.click(); await tick(); at("viz", "«Разобрать» в задаче"); }

    /* 5) список тем гасит сессию задачи */
    g.openAlgo(x0.id); await tick();
    g.openExamMap("all"); await tick();
    const s2 = g.getSession();
    if (!s2 || s2.id !== null || s2.algo) bad("[двери-экзамен] список тем не сбросил сессию задачи");

    /* 6) адрес #myexam — своя программа, своя сессия */
    g.openAlgo(x0.id); await tick();
    const rm = g.ROUTE_BY_HASH["#myexam"];
    if (!rm) bad("[двери-экзамен] нет адреса #myexam");
    else {
      rm.open(); await tick();
      at("myexam", "адрес #myexam");
      const s3 = g.getSession();
      if (!s3 || !s3.myexam || s3.id !== null) bad("[двери-экзамен] «Задача по своей программе» не завела свою сессию");
    }

    /* 7) «Защита своего кода» берёт и «Мои программы» */
    const worksWas = g.state.works;
    g.state.works = {};
    g.myWorkSave("Дверь экзамена", "", 'print("дверь экзамена")');
    if (!g.zqSources().some(s => /дверь экзамена/.test(s.code)))
      bad("[двери-экзамен] «Защита своего кода» не видит программу из «Моих программ»");
    g.state.works = worksWas;

    if (problems.length === p0) examdoorsChecked++;
    viewReset(g);
  }

  /* --- [двери-приёмка] дороги в «Приёмку» и обратно жмутся ---
     ⚠️ Родилась из разреза приёмки 18.09.2026 (1.189.0, § 4.55). Из десяти
     нарочных поломок прогон поймал пять. Зелёными прошли: кнопка «Открыть
     приёмку» в «Ты и ИИ» (её обработчик — A.screenSpecs, взятый значением
     до договора: функция есть, экрана в ней нет), мёртвый адрес #specs,
     «Назад» из работы мимо списка и два экрана, переставшие сбрасывать
     сессию. Два счётчика (specsList, specDone) значением прогон валил сам —
     их зовут при отрисовке, а не при нажатии; экран — только при нажатии. */
  let specdoorsChecked = 0;
  if (typeof g.screenSpecs === "function" && typeof g.openSpec === "function" && g.specsList().length){
    const p0 = problems.length;
    const at = (want, where) => { if (g.place() !== want) bad("[двери-приёмка] " + where + " привела не туда: " + g.place() + " вместо " + want); };

    /* 1) «Ты и ИИ» → «Открыть приёмку» */
    g.screenAILab(); await tick();
    const ts = doc.getElementById("toaispecs");
    if (!ts) bad("[двери-приёмка] в «Ты и ИИ» нет кнопки «Открыть приёмку»");
    else { ts.click(); await tick(); at("specs", "кнопка «Открыть приёмку» в «Ты и ИИ»"); }

    /* 2) адрес #specs */
    const rs = g.ROUTE_BY_HASH["#specs"];
    if (!rs) bad("[двери-приёмка] нет адреса #specs");
    else { g.screenWorlds(); await tick(); rs.open(); await tick(); at("specs", "адрес #specs"); }

    /* 3) работа: своя сессия; «Назад» ведёт в список работ, а не в «Ты и ИИ» */
    const t0 = g.specsList()[0];
    g.openSpec(t0.id); await tick();
    at("spec", "открытая работа");
    const ss = g.getSession();
    if (!ss || ss.id !== t0.id || !ss.spec) bad("[двери-приёмка] работа не завела свою сессию: " + JSON.stringify(ss && { id: ss.id, spec: ss.spec }));
    const bb2 = doc.getElementById("btn-back");
    if (!bb2 || bb2.hidden) bad("[двери-приёмка] в работе нет кнопки «Назад»");
    else { bb2.click(); await tick(); at("specs", "«Назад» из работы"); }

    /* 4) список работ гасит сессию работы */
    g.openSpec(t0.id); await tick();
    g.screenSpecs(); await tick();
    const ss2 = g.getSession();
    if (!ss2 || ss2.id !== null || ss2.spec) bad("[двери-приёмка] список работ не сбросил сессию работы");

    if (problems.length === p0) specdoorsChecked++;
    viewReset(g);
  }

  /* --- [двери-проект] дороги в проект и в «проект собран» жмутся ---
     ⚠️ Родилась из разреза экранов проекта 18.09.2026 (1.190.0, § 4.55).
     Из десяти нарочных поломок прогон поймал четыре: те, что валили саму
     отрисовку. Зелёными прошли ПЯТЬ дверей, у которых обработчик ищет экран
     только в момент нажатия: веха проекта на карте пути, карточка игры-
     проекта, «Открыть мой проект» на выпускном мира, адрес #<id проекта> и
     «проект собран» в «Ты и ИИ», взятый значением до договора. */
  let projdoorsChecked = 0;
  if (typeof g.openProject === "function" && typeof g.projectOfWorld === "function"){
    const p0 = problems.length;
    const at = (want, where) => { if (g.place() !== want) bad("[двери-проект] " + where + " привела не туда: " + g.place() + " вместо " + want); };
    const projWas = JSON.parse(JSON.stringify(g.state.projects || {}));
    const starsWas = g.state.stars;

    /* 1) карта пути → веха проекта */
    g.screenPath(); await tick(); await tick();
    const pm = doc.querySelector(".pmile[data-proj]");
    if (!pm) bad("[двери-проект] на карте пути нет вехи проекта");
    else { pm.click(); await tick(); await tick(); at("project", "веха проекта на карте пути"); }

    /* 2) игры → карточка игры-проекта */
    g.screenGames(); await tick();
    const gc = doc.querySelector(".gamecard[data-proj]");
    if (!gc) bad("[двери-проект] среди игр нет карточки игры-проекта");
    else { gc.click(); await tick(); await tick(); at("project", "карточка игры-проекта"); }

    /* 3) адрес по имени проекта: #<id> открывает сам проект.
          ⚠️ Делается ДО того, как проекты отмечены собранными: у собранного
          тот же адрес честно ведёт на «проект собран», а не в сборку. */
    const pid = g.projectOfWorld(1).id;
    g.screenWorlds(); await tick();
    w.location.hash = "#" + pid;
    g.bootRender(); await tick(); await tick();
    at("project", "адрес #" + pid);
    w.location.hash = "";
    await tick(); await tick();   /* дать отработать hashchange, иначе он догонит следующий экран */

    /* 4) выпускной мира → «Открыть мой проект» (кнопка есть только у собранного) */
    const pw = g.projectOfWorld(1);
    g.state.projects[pw.id] = { step: pw.steps.length, code: "print(1)", done: 1, aiAt: -1, doneAt: Date.now() };
    g.screenWorldDone(1); await tick(); await tick();
    const gp = doc.getElementById("gr-proj");
    if (!gp) bad("[двери-проект] на выпускном мира нет «Открыть мой проект»");
    else { gp.click(); await tick(); await tick(); at("projectdone", "«Открыть мой проект» на выпускном мира"); }

    /* 5) «Ты и ИИ» → собранный проект раздела открывается как «проект собран» */
    const ap = g.projectOfWorld(0);
    if (ap){
      g.state.projects[ap.id] = { step: ap.steps.length, code: "print(1)", done: 1, aiAt: -1, doneAt: Date.now() };
      g.screenAILab(); await tick();
      const aop = doc.getElementById("openaiproj");
      if (!aop) bad("[двери-проект] в «Ты и ИИ» нет двери к проекту раздела");
      else { aop.click(); await tick(); await tick(); at("projectdone", "дверь к собранному проекту в «Ты и ИИ»"); }
    }

    /* 6) замок проекта: пока уроки мира не пройдены, дверь возвращает на карту
          мира, а не показывает сборку (нарочная поломка проверки прошла
          зелёной — экран рисовался и без неё) */
    const unlockWas = g.state.admin.unlockAll;
    g.state.admin.unlockAll = false;
    g.state.stars = {};
    g.state.projects = {};
    g.openProject(pw.id); await tick(); await tick();
    if (g.place() === "project") bad("[двери-проект] проект открылся, хотя уроки его мира не пройдены");
    g.state.admin.unlockAll = unlockWas;

    g.state.projects = projWas; g.state.stars = starsWas;
    if (problems.length === p0) projdoorsChecked++;
    viewReset(g);
  }

  /* --- 12бис. одно имя — одна функция ---
     ⚠️ Проверка родилась из настоящей ошибки 07.09.2026: я объявил функцию
     workLink, не заметив, что такая уже есть (ссылка «поделиться работой»,
     #work=). JavaScript на это не ругается — просто побеждает объявленная
     позже, и мой код молча начал звать чужую функцию. Ссылка собиралась,
     кнопка нажималась, ничего не падало — а работало не то. Такое ловится
     только глазами и только случайно, поэтому теперь ловится тестом. */
  {
    const src = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
    const seen = {}, dup = [];
    const re = /^function\s+([A-Za-zА-Яа-яЁё_$][\w$]*)\s*\(/gm;
    let m;
    while ((m = re.exec(src))){
      if (seen[m[1]]) dup.push(m[1]); else seen[m[1]] = 1;
    }
    if (dup.length)
      bad("[имена] в js/app.js одно имя у двух функций: " + [...new Set(dup)].join(", ") +
          " — победит объявленная позже, и звать будут не то");
  }

  /* --- 12в. выпускной мира --- */
  let gradChecked = 0;
  if (typeof g.screenWorldDone === "function"){
    const p0 = problems.length;
    const CURG = w.CURRICULUM;

    /* 1. Содержание: умения написаны глаголами и ведут в НАСТОЯЩИЕ уроки
       СВОЕГО мира. Строчка «а где это было» — половина смысла экрана; если
       она ведёт в чужой мир или в никуда, список превращается в похвалу. */
    CURG.forEach(x => {
      const sk = g.worldSkills(x.n);
      if (sk.length < 5) bad(`[выпускной] у мира ${x.n} всего ${sk.length} умений — списку нечего сказать`);
      sk.forEach(s => {
        const l = CURG.byId(s.id);
        if (!l) return bad(`[выпускной] мир ${x.n}: умение ссылается на несуществующий урок «${s.id}»`);
        if (l.world !== x.n)
          bad(`[выпускной] мир ${x.n}: умение ведёт в урок мира ${l.world} («${s.id}»)`);
        if (!/^[а-яё]/.test(String(s.v)))
          bad(`[выпускной] мир ${x.n}: умение начинается не со строчной буквы: «${s.v}»`);
        /* ⚠️ Умение — это ГЛАГОЛ от первого лица, а не тема из оглавления:
           «списки и словари» ребёнку про него самого не говорят ничего.
           Проверяем первое слово: у глагола «я …» окончание -ю или -у
           (пишу, считаю, режу, храню). Существительное так не кончается.
           ⚠️ Границу слова \b здесь не применить: в JS она считает буквой
           только латиницу, и на кириллице молча не срабатывает — на этом
           первая версия проверки и обожглась. */
        const первое = String(s.v).split(/[^а-яё]/i)[0];
        if (!/^[а-яё]+[юу]$/i.test(первое))
          bad(`[выпускной] мир ${x.n}: умение начинается не с глагола «я …» — «${s.v}»`);
      });
    });

    /* 2. Выпускной наступает по тому же правилу, что сертификат: все уроки
       мира пройдены И проект собран. Иначе он поздравлял бы раньше времени. */
    g.state.stars = {};
    g.state.projects = {};
    if (g.worldGraduated(1)) bad("[выпускной] мир выпущен при нулевом прогрессе");
    CURG[0].lessons.forEach(l => { g.state.stars[l.id] = 3; });
    if (g.worldGraduated(1)) bad("[выпускной] мир выпущен, хотя проект ещё не собран");
    const pw1 = g.projectOfWorld(1);
    g.state.projects[pw1.id] = { step: pw1.steps.length, code:"print(1)", done:1, aiAt:-1, doneAt: Date.now() };
    if (!g.worldGraduated(1)) bad("[выпускной] уроки пройдены и проект собран, а мир не выпущен");

    /* 3. Сам экран. */
    g.screenWorldDone(1); await tick(); await tick();
    const app2 = doc.getElementById("app");
    const items = [...doc.querySelectorAll(".canitem")];
    if (items.length !== g.worldSkills(1).length)
      bad(`[выпускной] строчек умений ${items.length}, а в списке ${g.worldSkills(1).length}`);
    if (!/что ты теперь правда делаешь сам|Ты теперь умеешь/i.test(app2.textContent))
      bad("[выпускной] на экране не сказано, что это список умений");
    if (/%/.test(app2.textContent)) bad("[выпускной] на экране появились проценты");
    /* ⚠️ «Показать» — половина пункта 2.2: ребёнку нужно, чем предъявить. */
    if (!doc.getElementById("gr-cert")) bad("[выпускной] нечем показать взрослому: нет кнопки листа");
    else {
      doc.getElementById("gr-cert").click(); await tick();
      if (!g.certIsOpen()) bad("[выпускной] «Показать лист» не открыл лист");
      g.closeCert();
    }
    /* строчка ведёт именно в СВОЙ урок, а не в какой попало */
    if (items[0]){
      const хотим = CURG.byId(g.worldSkills(1)[0].id);
      items[0].click(); await tick(); await tick();
      const текст = doc.getElementById("app").textContent;
      if (!хотим || текст.indexOf(хотим.title) < 0)
        bad("[выпускной] строчка умения открыла не тот урок: ждали «" +
            ((хотим && хотим.title) || "?") + "»");
    }
    if (problems.length === p0) gradChecked++;
    viewReset(g);
  }

  /* --- 12б. карта пути --- */
  let pathChecked = 0;
  if (typeof g.screenPath === "function"){
    const p0 = problems.length;
    /* Ставим правдоподобный прогресс: мир 1 пройден, во втором семь уроков. */
    g.state.stars = {};
    /* ⚠️ К этому месту прогона мог остаться включённым админский «открыть всё»
       (его щупают проверки выше). С ним заперт никто, и замок на карте нечем
       проверить. Снимаем на время своей проверки и возвращаем как было. */
    const adminWas = g.state.admin && g.state.admin.unlockAll;
    if (g.state.admin) g.state.admin.unlockAll = 0;
    const CURP = w.CURRICULUM;
    CURP.forEach(x => x.lessons.forEach(l => { if (l.num <= 27) g.state.stars[l.id] = 3; }));
    g.screenPath(); await tick(); await tick();
    const app = doc.getElementById("app");

    const steps = [...doc.querySelectorAll(".pstep")];
    if (steps.length !== CURP.total)
      bad(`[карта] кружков ${steps.length}, а уроков ${CURP.total} — карта показывает не весь курс`);
    if (doc.querySelectorAll(".pmile").length !== CURP.length)
      bad("[карта] вех не по одной на мир: " + doc.querySelectorAll(".pmile").length);

    /* «ты здесь» — ровно одно место, и оно на следующем уроке. Иначе карта
       отвечает не на тот вопрос, ради которого её открыли. */
    const here = [...doc.querySelectorAll(".pstep.here")];
    if (here.length !== 1) bad("[карта] «ты здесь» показано " + here.length + " раз вместо одного");
    const next = g.nextLesson();
    if (here.length === 1 && next && here[0].getAttribute("data-lesson") !== next.id)
      bad("[карта] «ты здесь» стоит не на том уроке, который откроет «Продолжить»");
    if (!/Ты здесь: урок 28/.test(app.textContent))
      bad("[карта] строка «ты здесь» не называет номер урока: " + (app.textContent.match(/Ты здесь[^.]*/) || ""));

    /* Расстояние меряется занятиями, а не процентами и не днями: проценты
       ребёнку ничего не говорят, а дни мы обещать не вправе. */
    if (!/занятия|занятий|занятие/.test(app.textContent))
      bad("[карта] до вехи не сказано, сколько занятий");
    if (/%/.test(app.textContent)) bad("[карта] на карте появились проценты — они ребёнку ничего не говорят");

    /* Закрытый урок нельзя открыть с карты, пройденный и открытый — можно. */
    const locked = steps.filter(b => b.disabled);
    if (!locked.length) bad("[карта] закрытых уроков нет вовсе — замок не работает");
    if (locked.some(b => b.getAttribute("data-lesson")))
      bad("[карта] у закрытого кружка есть ссылка на урок — его можно открыть в обход");
    const openable = steps.filter(b => !b.disabled);
    if (openable.length < 21) bad("[карта] открытых кружков подозрительно мало: " + openable.length);

    /* Веха закрытого мира не открывается, собранная — помечена. */
    const miles = [...doc.querySelectorAll(".pmile")];
    if (!miles[1] || !miles[1].disabled)
      bad("[карта] веха недопройденного мира открыта");

    /* Кружок ведёт в свой урок, а не в какой попало. */
    const first = openable[0];
    if (first){
      first.click(); await tick();
      if (!/Первая команда/.test(doc.getElementById("app").textContent))
        bad("[карта] кружок урока 1 открыл не тот урок");
    }
    if (g.state.admin && adminWas) g.state.admin.unlockAll = adminWas;
    if (problems.length === p0) pathChecked++;
    viewReset(g);
  }

  /* --- 13. алгоритмы и формат ОГЭ --- */
  if (typeof g.algoList === "function"){
    const p0 = problems.length;
    const XS = g.algoList();
    const MP = w.MiniPy;

    /* 13.1. Содержание: эталон проходит собственную проверку, заготовка — нет.
       Задание, которое засчитывается заготовкой, не задание. */
    {
      if (XS.length < 6) bad("[алгоритмы] задач подозрительно мало: " + XS.length);
      XS.forEach(t => {
        ["id","group","title","tag","intro","goal","starter","solution","note"].forEach(f => {
          if (!t[f]) bad("[алгоритмы] у «" + t.id + "» пустое поле «" + f + "»");
        });
        if (!Array.isArray(t.list) || !t.list.length)
          bad("[алгоритмы] у «" + t.id + "» нет требований списком");
        if (!Array.isArray(t.hints) || t.hints.length < 3)
          bad("[алгоритмы] у «" + t.id + "» меньше трёх подсказок");
        if (!g.ALGO_GROUPS.some(gr => gr.id === t.group))
          bad("[алгоритмы] «" + t.id + "» в неизвестной группе «" + t.group + "»");
        if (/random|randint|choice|shuffle/.test(t.solution))
          bad("[алгоритмы] в «" + t.id + "» есть случайность — вердикт станет невоспроизводимым");

        const stdin = () => (t.stdin || []).slice();
        const sol = MP.run(t.solution, { stdin: stdin() });
        if (sol.error)
          return bad("[алгоритмы] эталон «" + t.id + "» падает: " + sol.error.kind + " " + sol.error.msg);
        if (t.budget && (sol.steps || 0) > t.budget)
          bad("[алгоритмы] эталон «" + t.id + "» сам не влезает в бюджет: " + sol.steps + " из " + t.budget);

        if (t.check.kind === "output"){
          if (!sol.lines.length) bad("[алгоритмы] эталон «" + t.id + "» ничего не печатает");
          const st = MP.run(t.starter, { stdin: stdin() });
          if (!st.error && JSON.stringify(st.lines) === JSON.stringify(sol.lines))
            bad("[алгоритмы] заготовка «" + t.id + "» проходит проверку сама");
          /* ⚠️ ЭКЗАМЕНАЦИОННАЯ задача с проверкой по выводу обязана иметь
             скрытые наборы: без них она сдаётся строкой print с ответом из
             примера, а «сдал задачу ОГЭ» — это обещание, которым не шутят.
             Учебных задач без ввода (cost-compare) правило не касается: их
             смысл — в разборе, а не в зачёте. */
          if ((t.group === "oge" || t.group === "ege") &&
              (!Array.isArray(t.sets) || t.sets.length < 2))
            bad("[алгоритмы] у «" + t.id + "» меньше двух скрытых наборов — её можно сдать напечатанной константой");
          (t.sets || []).forEach((din, si) => {
            if (JSON.stringify(din) === JSON.stringify(t.stdin))
              bad("[алгоритмы] скрытый набор " + (si + 1) + " задачи «" + t.id + "» совпадает с открытым примером");
            const hs = MP.run(t.solution, { stdin: din.slice() });
            if (hs.error)
              bad("[алгоритмы] эталон «" + t.id + "» падает на скрытом наборе " + (si + 1) + ": " + hs.error.msg);
            else if (!hs.lines.length)
              bad("[алгоритмы] эталон «" + t.id + "» молчит на скрытом наборе " + (si + 1));
          });
        } else {
          if (!t.check.calls || t.check.calls.length < 3)
            bad("[алгоритмы] у «" + t.id + "» меньше трёх скрытых проверок");
          let same = true;
          (t.check.calls || []).forEach(c => {
            const probe = "\nprint(repr(" + c + "))\n";
            const wr = MP.run(t.solution + probe, { stdin: stdin() });
            const gr = MP.run(t.starter + probe, { stdin: stdin() });
            if (wr.error)
              return bad("[алгоритмы] эталон «" + t.id + "» падает на " + c + ": " + wr.error.msg);
            const wl = wr.lines[wr.lines.length - 1];
            const gl = gr.error ? undefined : gr.lines[gr.lines.length - 1];
            if (wl !== gl) same = false;
          });
          if (same) bad("[алгоритмы] заготовка «" + t.id + "» проходит все скрытые проверки");
        }
      });
    }

    /* 13.1а. Порог наполнения: в каждой теме не меньше пяти задач.
       ⚠️ До 09.09.2026 у экзамена такого порога не было вовсе, и держался он
       только косвенно — проверкой повторов в пробном варианте (13в). Косвенной
       мало: повтор виден лишь там, где на тему опирается БОЛЬШЕ номеров, чем в
       ней задач, а тема с двумя задачами плоха и без всякого варианта. Ребёнок
       заходит в неё второй раз, видит то же самое и решает, что тренажёр
       кончился. Порог тот же, что у домашки репетитора (tests/homework.js,
       WORLD_MIN), и по той же причине.
       ⚠️ Упало — дописывать ЗАДАЧИ в названную тему, а не правило. Тонкие темы
       наполняются в js/algo-thin.js, почему отдельным файлом — в его шапке. */
    {
      const МИНИМУМ = 5;
      const счёт = {};
      XS.forEach(t => { счёт[t.group] = (счёт[t.group] || 0) + 1; });
      (g.ALGO_GROUPS || []).forEach(gr => {
        const n = счёт[gr.id] || 0;
        if (n < МИНИМУМ)
          bad("[алгоритмы] в теме «" + gr.title + "» всего " + n + " " +
              (n === 1 ? "задача" : n < 5 ? "задачи" : "задач") + " — меньше " + МИНИМУМ +
              ": второй заход ученика увидит те же самые");
      });
    }

    /* 13.1б. Робот: эталон проходит ВСЕ поля задачи, заготовка — нет.
       ⚠️ «Все поля» здесь не педантизм, а суть раздела: на экзамене программа
       обязана работать при любой длине стены, и задача, проверяемая на одной
       картинке, засчитала бы «вправо, закрасить, вправо, закрасить». Поэтому
       тест требует, чтобы дополнительных полей было не меньше двух и чтобы
       заготовка расходилась с эталоном хотя бы на одном из них. */
    {
      const RB = w.ROBOT, TS = w.ROBOT_TASKS || [];
      if (TS.length < 4) bad("[робот] задач подозрительно мало: " + TS.length);
      TS.forEach(t => {
        ["id","title","tag","intro","goal","starter","solution","note"].forEach(f => {
          if (!t[f]) bad("[робот] у «" + t.id + "» пустое поле «" + f + "»");
        });
        if (!Array.isArray(t.list) || !t.list.length)
          bad("[робот] у «" + t.id + "» нет требований списком");
        if (!Array.isArray(t.hints) || t.hints.length < 3)
          bad("[робот] у «" + t.id + "» меньше трёх подсказок");
        if (!Array.isArray(t.more) || t.more.length < 2)
          bad("[робот] у «" + t.id + "» меньше двух скрытых полей — задача сдастся зашитыми шагами");

        const все = [t.field].concat(t.more || []);
        let разошлась = false;
        все.forEach((rows, i) => {
          const поле = RB.parseField(rows, t.inf);
          if (!поле.found) return bad("[робот] на поле " + i + " задачи «" + t.id + "» нет робота");
          const эт = RB.run(t.solution, RB.parseField(rows, t.inf));
          if (эт.error)
            return bad("[робот] эталон «" + t.id + "» падает на поле " + i +
                       " (строка " + эт.error.line + "): " + эт.error.msg);
          const заг = RB.run(t.starter, RB.parseField(rows, t.inf));
          if (заг.error || !RB.samePainted(эт.field, заг.field)) разошлась = true;
        });
        if (!разошлась)
          bad("[робот] заготовка «" + t.id + "» даёт тот же результат, что эталон — задание сдаётся само");
      });
      /* ⚠️ Язык обязан оставаться кумировским: если из него пропадёт хоть одно
         слово, обещание «выучил здесь — пишешь на экзамене» перестанет быть
         правдой, а на экране оно написано прямым текстом. */
      const проба = RB.run(
        "нц пока справа свободно\n  вправо\nкц\nнц 2 раз\n  закрасить\nкц\n" +
        "если (клетка закрашена) и (не слева стена) то\n  влево\nиначе\n  закрасить\nвсе\n",
        RB.parseField(["@..."]));
      if (проба.error)
        bad("[робот] кумировская конструкция перестала разбираться: " + проба.error.msg);
    }

    /* 13.2. ⚠️ Граница обещания. Мы закрываем задание 15.2, а не экзамен, и
       это обязано стоять на экране ДО задач, а не мелким шрифтом внизу:
       про невыполненное обещание родитель узнаёт в мае. */
    {
      g.screenAlgo(); await tick();
      const t = doc.getElementById("app").textContent;
      if (!/КЭС 3\.2/.test(t))
        bad("[алгоритмы] не названо, какую часть экзамена мы закрываем (КЭС 3.2)");
      if (!/не закрываем экзамен целиком/i.test(t))
        bad("[алгоритмы] не сказано, чего мы НЕ закрываем");
      /* ⚠️ Номер задания мы назвать не можем: нумерация между годами меняется,
         а спецификация лежит архивом и глазами не проверена. Обещание, которое
         нечем подтвердить, на экране стоять не должно. */
      if (/задание\s*(№\s*)?1[0-9](\.[0-9])?\b/i.test(t))
        bad("[алгоритмы] на экране назван номер задания ОГЭ, а сверить его не с чем");
      if (!/шаг/i.test(t)) bad("[алгоритмы] не названо главное отличие — измеренная цена");
      const rules = doc.querySelector(".trrules"), first = doc.querySelector(".gamegrid");
      if (!rules) bad("[алгоритмы] нет рамки с границей обещания");
      if (rules && first && !(rules.compareDocumentPosition(first) & 4))
        bad("[алгоритмы] задачи стоят раньше границы обещания");
      if (doc.querySelectorAll("[data-algo]").length !== XS.length)
        bad("[алгоритмы] показаны не все задачи");
    }

    /* 13.3. Задача решается, эталон засчитывается, обход по требованию — нет. */
    /* --- запрет, который проверяет код, обязан стоять в условии словами ---
       ⚠️ Отказ говорит ребёнку «Требование стоит в условии». Если запрет живёт
       только в судье, эта фраза — неправда, и ребёнок ищет в условии то, чего
       там нет: так было у «Двоичного поиска» (.index()), «Сортировки
       подсчётом», «Сколько шагов у пузырька» и «Наименьшего чётного»
       (sorted()) — найдено ревизией 18.09.2026. Проверяем не формулировку (её
       не угадать), а наличие самого запрета словами: без «нельзя» или «не
       пользоваться» в условии судья запрещать не вправе. */
    {
      const банСписок = (fs.readFileSync(path.join(root, "js/screens-algo.js"), "utf8")
        .match(/var banned = \{([\s\S]*?)\n\s*\};/) || [])[1] || "";
      const банИды = [...банСписок.matchAll(/"([a-z0-9-]+)"\s*:/g)].map(m => m[1]);
      if (банИды.length < 10)
        bad("[алгоритмы] список запретов не разобрался — проверка запретов ослепла");
      const запретСлова = ["нельзя", "не пользоваться", "не использовать", "не сравнивать", "не брать"];
      банИды.forEach(id => {
        const t = XS.filter(x => x.id === id)[0];
        if (!t) return bad("[алгоритмы] запрет назначен задаче «" + id + "», а такой задачи нет");
        const list = (typeof t.list === "function" ? t.list({}) : t.list) || [];
        const goal = (typeof t.goal === "function" ? t.goal({}) : t.goal) || "";
        const txt = (goal + " " + list.join(" ")).toLowerCase();
        if (!запретСлова.some(w => txt.indexOf(w) >= 0))
          bad("[алгоритмы] у задачи «" + id + "» судья запрещает конструкцию, а условие о запрете " +
              "молчит — отказ соврёт ребёнку «Требование стоит в условии»");
      });
    }

    {
      const t = XS.filter(x => x.id === "find-linear")[0];
      if (!t) bad("[алгоритмы] нет задачи про линейный поиск");
      else {
        g.state.algo = {};
        g.openAlgo(t.id); await tick();
        const st = studioOf();
        if (!st) bad("[алгоритмы] редактор задачи не открылся");
        else {
          /* обход: .index() запрещён условием, и запрет обязан работать */
          st.editor.setCode("def find(nums, want):\n    if want in nums:\n        return nums.index(want)\n    return -1\n");
          st.querySelector('[data-role="check"]').click();
          await tick();
          if (won()) bad("[алгоритмы] решение через .index() засчитано, хотя условие его запрещает");
          if (!/нельзя/i.test(msgText())) bad("[алгоритмы] про запрет ничего не сказано: " + msgText());

          st.editor.setCode(t.solution);
          st.querySelector('[data-role="check"]').click();
          await tick();
          if (!won()) bad("[алгоритмы] эталон не засчитан: " + msgText());
          const card = doc.getElementById("wincard").textContent;
          if (!/шаг/i.test(card)) bad("[алгоритмы] в победе не названа цена программы в шагах");
          closeWin();
          if (!g.algoDone(t.id)) bad("[алгоритмы] решённая задача не попала в прогресс");
        }
      }
    }

    /* 13.3а. Обход константой: программа, печатающая ответ с открытого
       примера, обязана провалиться на скрытых данных — ровно ради этого
       скрытые наборы и заведены. */
    {
      const t = XS.filter(x => x.id === "oge-count-base")[0];
      if (!t) bad("[алгоритмы] нет задачи oge-count-base для проверки обхода");
      else {
        g.state.algo = {};
        g.openAlgo(t.id); await tick();
        const st = studioOf();
        if (st){
          st.editor.setCode('print("' + t.sample.out + '")\n');
          st.querySelector('[data-role="check"]').click();
          await tick();
          /* ⚠️ С 1.162.0 константа без ввода проваливается РАНЬШЕ скрытых
             наборов — по правилу эксперта ФИПИ «нет ввода — 0» ([фипи-16]). */
          if (won()){ bad("[алгоритмы] напечатанная константа сдала задачу с примера"); closeWin(); }
          else if (!/не читает входные данные/i.test(msgText()))
            bad("[алгоритмы] про отсутствие ввода при провале не сказано: " + msgText());
          /* а константа, прочитавшая ввод для вида, ловится скрытыми наборами */
          st.editor.setCode('n = int(input())\nfor i in range(n):\n    x = input()\nprint("' + t.sample.out + '")\n');
          st.querySelector('[data-role="check"]').click();
          await tick();
          if (won()){ bad("[алгоритмы] константа после чтения ввода сдала задачу с примера"); closeWin(); }
          else if (!/скрыт/i.test(msgText()))
            bad("[алгоритмы] про скрытые данные при провале не сказано: " + msgText());
          /* а настоящий эталон проходит и открытый пример, и скрытые наборы */
          st.editor.setCode(t.solution);
          st.querySelector('[data-role="check"]').click();
          await tick();
          if (!won()) bad("[алгоритмы] эталон oge-count-base не прошёл скрытые наборы: " + msgText());
          else closeWin();
        }
      }
    }

    /* 13.3б. Пример работы программы обязан совпадать с тем, что печатает
       эталон: пример, расходящийся с решением, хуже отсутствия примера. */
    {
      XS.filter(x => x.sample).forEach(t => {
        const r = MP.run(t.solution, { stdin: (t.stdin || []).slice() });
        if (r.error) return;
        if (r.lines.join("\n") !== t.sample.out)
          bad("[алгоритмы] пример у «" + t.id + "» не сходится с решением: обещано «" +
              t.sample.out + "», выходит «" + r.lines.join("\n") + "»");
        if (JSON.stringify(t.sample.in) !== JSON.stringify(t.stdin))
          bad("[алгоритмы] пример у «" + t.id + "» показывает не тот ввод, на котором проверяют");
      });
      /* каркас ОГЭ: обязательное «NO», ограничения числами */
      XS.filter(x => x.group === "oge").forEach(t => {
        if (!/NO/.test(t.goal))
          bad("[алгоритмы] у задачи ОГЭ «" + t.id + "» нет обязательного случая «NO»");
        if (!/NO/.test(t.solution))
          bad("[алгоритмы] решение «" + t.id + "» не печатает NO");
        if (!t.list.some(l => /10 000|30 000/.test(l)))
          bad("[алгоритмы] у задачи ОГЭ «" + t.id + "» не названы ограничения числами");
        if (!t.sample) bad("[алгоритмы] у задачи ОГЭ «" + t.id + "» нет примера работы программы");
      });
    }

    /* 13.4. Формат ОГЭ: ввод читается через input(), как на экзамене. */
    {
      const t = XS.filter(x => x.group === "oge" && x.stdin)[0];
      if (!t) bad("[алгоритмы] нет ни одной задачи с вводом в формате ОГЭ");
      else {
        if (!/input\(/.test(t.starter + t.solution))
          bad("[алгоритмы] задача формата ОГЭ не читает ввод");
        g.openAlgo(t.id); await tick();
        const st = studioOf();
        st.editor.setCode(t.solution);
        st.querySelector('[data-role="check"]').click();
        await tick();
        if (!won()) bad("[алгоритмы] задача с вводом не решается эталоном: " + msgText());
        closeWin();
      }
    }

    /* 13.5. Слияние двух устройств не теряет решённое. */
    {
      const m = g.mergeProgress({ savedAt:1, algo:{ a:1 } }, { savedAt:2, algo:{ b:1 } });
      if (Object.keys(m.algo || {}).length !== 2)
        bad("[алгоритмы] слияние потеряло решённую задачу");
    }

    g.state.algo = {};
    viewReset(g);
    if (problems.length === p0) algoChecked++;
  }

  /* --- 13в. пробный вариант экзамена целиком ---
     Вариант — это СБОРКА из уже готовых задач, и ломается такая сборка молча:
     номер получает задачу не из своей темы, порядок съезжает, один и тот же
     код собирает разные варианты. Ни одного из этих трёх случаев не увидит
     ни один другой тест — экран при них рисуется исправно. */
  if (typeof g.screenVariant === "function"){
    const p0 = problems.length;
    const EX = w.EXAMS;
    const XS = g.algoList();
    const taskById = id => XS.filter(x => x.id === id)[0] || null;

    /* 13в.1. Сборка: строка на каждое задание, порядок как на экзамене,
       задача — из тем СВОЕГО номера. */
    ["ege", "oge"].forEach(id => {
      const ex = EX[id];
      const items = g.variantBuild(id, "TEST42");
      if (items.length !== ex.tasks.length)
        return bad("[вариант] в " + ex.title + " строк " + items.length + ", а заданий " + ex.tasks.length);
      items.forEach((it, i) => {
        const t = ex.tasks[i];
        if (it.n !== t.n)
          return bad("[вариант] порядок номеров не как на экзамене: " + it.n + " вместо " + t.n);
        const pool = XS.filter(x => (t.g || []).indexOf(x.group) >= 0);
        if (!it.id){
          if (pool.length)
            bad("[вариант] номер " + t.n + " остался пустым, хотя задачи по его темам есть");
          if (!it.why)
            bad("[вариант] у пустого номера " + t.n + " не написана причина");
          return;
        }
        /* номер 15 ОГЭ — Робот (1.163.0): задача из ROBOT_TASKS, формата ОГЭ */
        if (t.robot){
          const rt = (w.ROBOT_TASKS || []).find(r => r.id === it.id);
          if (it.kind !== "robot" || !rt || !rt.fipi)
            bad("[вариант] номеру " + t.n + " (Робот) назначена не задача Робота формата ОГЭ: «" + it.id + "»");
          return;
        }
        const task = taskById(it.id);
        if (!task) return bad("[вариант] номеру " + t.n + " назначена несуществующая задача «" + it.id + "»");
        if ((t.g || []).indexOf(task.group) < 0)
          bad("[вариант] номеру " + t.n + " досталась задача из чужой темы: «" + task.group + "»");
      });
      /* ⚠️ Одно семя — один вариант. На этом держится следующий шаг: репетитор
         диктует код, и вся группа получает ОДИН И ТОТ ЖЕ вариант. Сломается
         тихо — при первой же правке порядка задач. */
      if (JSON.stringify(items) !== JSON.stringify(g.variantBuild(id, "TEST42")))
        bad("[вариант] один и тот же код собирает разные варианты " + ex.title);
      if (JSON.stringify(items) === JSON.stringify(g.variantBuild(id, "ZZZ999")))
        bad("[вариант] разные коды собирают один и тот же вариант " + ex.title);
      /* повтор помечается: без пометки «одна задача на два номера» читается
         как наша небрежность, а это замер наполнения — он должен быть виден */
      const seen = {};
      items.forEach(it => {
        if (!it.id) return;
        if (seen[it.id] && !it.dup)
          bad("[вариант] задача «" + it.id + "» стоит дважды, и повтор не помечен");
        seen[it.id] = 1;
      });
      /* ⚠️ А ЭТО УЖЕ ПРО НАПОЛНЕНИЕ, и проверка здесь не случайно. Повтор в
         варианте значит ровно одно: на группу опирается больше номеров, чем в
         ней задач. Пока такое есть, вариант показывает ученику одну и ту же
         задачу дважды, — и заметит это он, а не мы. Проверка держит порог со
         стороны экзамена так же, как проверка домашки держит его со стороны
         репетитора. Если строка упала — дописывать надо ЗАДАЧИ в названную
         группу, а не правило. */
      const дубли = items.filter(x => x.dup).map(x => {
        const t = taskById(x.id);
        return x.n + " (" + (t ? t.group : "?") + ")";
      });
      if (дубли.length)
        bad("[вариант] в " + ex.title + " на номерах " + дубли.join(", ") +
            " повторяется уже стоявшая задача — в этих темах задач меньше, чем номеров");
    });

    /* 13в.2. Экран: полный список номеров и НИ ОДНОГО обещания про баллы.
       Шкала перевода меняется каждый год и объявляется не нами. */
    {
      g.state.algo = {}; g.state.variant = {};
      g.screenVariant(); await tick();
      const pick = doc.querySelector('[data-vnew="ege"]');
      if (!pick) bad("[вариант] на экране без варианта нечем его собрать");
      else {
        pick.click(); await tick();
        const rows = doc.querySelectorAll(".exrow");
        if (rows.length !== EX.ege.tasks.length)
          bad("[вариант] показано " + rows.length + " номеров вместо " + EX.ege.tasks.length);
        const txt = doc.getElementById("app").textContent;
        if (/стобалльн|из 100|первичный балл/i.test(txt))
          bad("[вариант] на экране обещан балл, которого мы не знаем: шкала меняется каждый год");
        if (!(g.state.variant.ege || {}).seed)
          bad("[вариант] собранный вариант не сохранился");
      }
    }

    /* 13в.2б. ⚠️ Вкладка экзамена НЕ СТИРАЕТ соседний вариант. Один слот на
       два экзамена означал бы, что переход на ОГЭ выбрасывает начатый ЕГЭ, —
       и узнал бы об этом ученик уже после нажатия. */
    {
      const egeSeed = g.state.variant.ege.seed;
      const oge = doc.querySelector('[data-vtab="oge"]');
      if (!oge) bad("[вариант] на экране нет вкладок экзаменов");
      else {
        oge.click(); await tick();
        const mk = doc.querySelector('[data-vnew="oge"]');
        if (!mk) bad("[вариант] на вкладке ОГЭ нечем собрать вариант");
        else { mk.click(); await tick(); }
        if (!(g.state.variant.oge || {}).seed) bad("[вариант] вариант ОГЭ не собрался");
        if ((g.state.variant.ege || {}).seed !== egeSeed)
          bad("[вариант] сборка варианта ОГЭ затёрла вариант ЕГЭ");
        const back = doc.querySelector('[data-vtab="ege"]');
        back.click(); await tick();
        if (!/Вариант № /.test(doc.getElementById("app").textContent))
          bad("[вариант] возврат на вкладку ЕГЭ не показал собранный вариант");
      }
    }

    /* 13в.3. Дорога из задачи ведёт ОБРАТНО В ВАРИАНТ, а решённое засчитывается
       именно в этом варианте. Это и есть весь смысл: пока возврат ведёт в общий
       список, ребёнок теряет вариант после первой же сданной задачи. */
    {
      const v = g.state.variant.ege;
      const first = (v.items || []).filter(x => x.id)[0];
      const btn = first ? doc.querySelector('[data-vgo="' + first.n + '"]') : null;
      if (!btn) bad("[вариант] в собранном варианте нет ни одной кнопки «Решать»");
      else {
        btn.click(); await tick();
        const crumbs = doc.querySelector(".crumbs");
        if (!crumbs || !/Вариант/.test(crumbs.textContent))
          bad("[вариант] из задачи не видно, что пришли из варианта: " +
              (crumbs ? crumbs.textContent : "хлебных крошек нет"));
        const st = studioOf();
        if (!st) bad("[вариант] задача из варианта не открылась");
        else {
          st.editor.setCode(taskById(first.id).solution);
          st.querySelector('[data-role="check"]').click();
          await tick();
          if (!won()) bad("[вариант] эталон не засчитан: " + msgText());
          else {
            const back = doc.getElementById("walgo");
            if (!/вариант/i.test(back.textContent))
              bad("[вариант] после победы кнопка ведёт не в вариант: " + back.textContent);
            back.click(); await tick();
            if (!(g.state.variant.ege.done || {})[first.n])
              bad("[вариант] решённый номер " + first.n + " не засчитан в варианте");
            if (!/Вариант/.test(doc.getElementById("app").textContent))
              bad("[вариант] после решённой задачи не вернулись в вариант");
          }
        }
        /* ⚠️ Обратное: задача, решённая РАНЬШЕ и вне варианта, номер не
           закрывает. Иначе вариант мерил бы не сегодняшнее состояние, а
           историю, и «закрыто 27 из 27» получал бы тот, кто в вариант даже
           не заглянул. */
        const second = (v.items || []).filter(x => x.id && x.n !== first.n)[0];
        if (second){
          g.state.algo[second.id] = 1;
          g.screenVariant(); await tick();
          if ((g.state.variant.ege.done || {})[second.n])
            bad("[вариант] номер " + second.n + " закрылся сам, потому что задача решалась когда-то раньше");
        }
      }
    }

    /* 13в.4. Итог: говорит проверяемое (номера), а не выдуманное (баллы). */
    {
      g.screenVariantDone(); await tick();
      const txt = doc.getElementById("app").textContent;
      if (!/Закрыто/i.test(txt)) bad("[вариант] в итоге не сказано, сколько закрыто");
      if (!new RegExp("из " + EX.ege.total).test(txt))
        bad("[вариант] итог не назвал общее число заданий экзамена");
      if (/стобалльн|из 100|первичный балл/i.test(txt))
        bad("[вариант] итог обещает балл, которого мы не знаем");
      if (!/просел|Не открывал|Сдано/i.test(txt))
        bad("[вариант] итог не сказал, где просело");
    }

    /* 13в.5. Обмен с сервером не склеивает два разных варианта в один. */
    {
      /* разные экзамены живут в своих ключах и не мешают друг другу */
      const a = { savedAt:1, variant:{ ege:{ ex:"ege", seed:"AAAAAA", at:5,
                    items:[{n:1,id:"x"}], done:{ 1:1 }, seen:{} } } };
      const b = { savedAt:2, variant:{ oge:{ ex:"oge", seed:"BBBBBB", at:6,
                    items:[{n:1,id:"y"}], done:{}, seen:{} } } };
      const m = g.mergeProgress(a, b);
      if (!m.variant.ege || !m.variant.oge)
        bad("[вариант] слияние потеряло вариант одного из экзаменов");
      if ((m.variant.ege.done || {})["1"] !== 1)
        bad("[вариант] слияние потеряло решённый номер");

      /* два РАЗНЫХ варианта одного экзамена не склеиваются: побеждает свежий */
      const m2 = g.mergeProgress(
        { savedAt:1, variant:{ ege:{ ex:"ege", seed:"AAAAAA", at:5, items:[{n:1,id:"x"}], done:{}, seen:{} } } },
        { savedAt:2, variant:{ ege:{ ex:"ege", seed:"CCCCCC", at:9, items:[{n:1,id:"y"}], done:{}, seen:{} } } });
      if (m2.variant.ege.seed !== "CCCCCC")
        bad("[вариант] при слиянии победил не тот вариант, что собран позже");

      /* ОДИН И ТОТ ЖЕ вариант на двух устройствах — это один вариант:
         решённые номера складываются, а не выбираются */
      const m3 = g.mergeProgress(
        { savedAt:1, variant:{ ege:{ ex:"ege", seed:"DDDDDD", at:5, items:[{n:1,id:"x"}], done:{ 1:1 }, seen:{} } } },
        { savedAt:2, variant:{ ege:{ ex:"ege", seed:"DDDDDD", at:5, items:[{n:1,id:"x"}], done:{ 2:1 }, seen:{} } } });
      if (Object.keys(m3.variant.ege.done || {}).length !== 2)
        bad("[вариант] решённое на втором устройстве потерялось при слиянии одного и того же варианта");

      /* ⚠️ Режим экзамена обязан пережить слияние. Забудь его здесь — и заход,
         открытый на планшете, приедет обратно тренировкой: без времени, без
         сданных ответов и незакрытым. Ошибка молчаливая: экран нарисуется. */
      const m4 = g.mergeProgress(
        { savedAt:1, variant:{ ege:{ ex:"ege", seed:"EEEEEE", at:5, mins:60, endAt:900, closed:0,
            items:[{n:1,id:"x"}], done:{}, seen:{}, sent:{ 1:1 } } } },
        { savedAt:2, variant:{ ege:{ ex:"ege", seed:"EEEEEE", at:5, mins:60, endAt:900, closed:1,
            items:[{n:1,id:"x"}], done:{}, seen:{}, sent:{ 2:1 } } } });
      if (m4.variant.ege.mins !== 60)
        bad("[экзамен] слияние потеряло время экзамена — заход стал тренировкой");
      if (m4.variant.ege.closed !== 1)
        bad("[экзамен] заход, закрытый на одном устройстве, после слияния снова открыт");
      if (Object.keys(m4.variant.ege.sent || {}).length !== 2)
        bad("[экзамен] слияние потеряло сданные ответы");
    }


    /* --- 13в.6. РЕЖИМ ЭКЗАМЕНА ---
       ⚠️ Весь смысл режима в том, чего на экране НЕТ: подсказки, вердикта и
       второго захода. Проверять «нет» глазами бесполезно — оно исчезает молча
       и незаметно, стоит кому-нибудь причесать один if. Поэтому здесь на
       каждое «нет» стоит своя строка.
       Правило, которое эти строки держат: пока идёт экзамен, НИЧТО на
       странице не говорит ребёнку, верно ли он решил. */
    {
      g.state.algo = {}; g.state.variant = {};
      g.screenVariant(); await tick();
      const start = doc.querySelector('[data-vexam="30"]');
      if (!start) bad("[экзамен] на экране сборки нет режима экзамена");
      else {
        start.click(); await tick();
        const v = g.state.variant.ege || {};
        if (v.mins !== 30) bad("[экзамен] вариант собрался без времени: mins = " + v.mins);
        if (!(v.endAt > Date.now())) bad("[экзамен] конец экзамена не в будущем");
        if (!doc.getElementById("vclock")) bad("[экзамен] на экране варианта нет часов");

        /* 13в.6а. Свод и строки молчат про решённое. */
        const scr = doc.getElementById("app").textContent;
        if (/решено/i.test(scr))
          bad("[экзамен] на экране идущего экзамена сказано «решено» — это вердикт, о котором мы молчим");

        const first = (v.items || []).filter(x => x.id)[0];
        const btn = doc.querySelector('[data-vgo="' + first.n + '"]');
        if (!btn) bad("[экзамен] в экзамене нет кнопки «Решать»");
        else {
          btn.click(); await tick();
          /* 13в.6б. Подсказки НЕТ, часы ЕСТЬ. */
          if (doc.getElementById("hintbtn"))
            bad("[экзамен] в задаче экзамена есть кнопка подсказки");
          if (!doc.getElementById("examclock"))
            bad("[экзамен] в задаче экзамена нет часов");

          const st = studioOf();
          const task = taskById(first.id);
          /* 13в.6в. Неверный ответ: ни разбора, ни слова «не то». */
          st.editor.setCode('print("заведомо не то")\n');
          st.querySelector('[data-role="check"]').click(); await tick();
          const badMsg = msgText();
          if (won()) bad("[экзамен] неверный ответ показал карточку победы");
          if (/Ещё не то|должно быть|получилось/i.test(badMsg))
            bad("[экзамен] проверка показала разбор: " + badMsg);
          if (!/записан/i.test(badMsg))
            bad("[экзамен] проверка не сказала, что ответ записан: " + badMsg);

          /* 13в.6г. ВЕРНЫЙ ответ отвечает ТЕМ ЖЕ САМЫМ текстом. Это главная
             строка блока: разойдись эти два сообщения хоть словом — и вердикт
             читается по ним, а весь режим ничего не стоит. */
          st.editor.setCode(task.solution);
          st.querySelector('[data-role="check"]').click(); await tick();
          const okMsg = msgText();
          if (won()) bad("[экзамен] верный ответ показал карточку победы — вердикт утёк");
          if (okMsg !== badMsg)
            bad("[экзамен] верный и неверный ответы отвечают по-разному:\n  верный:   " +
                okMsg + "\n  неверный: " + badMsg);
          /* 13в.6д. И в общий список решённых задача пока НЕ попала: галочка
             на экране «Алгоритмы» — тот же вердикт, до неё два нажатия. */
          if (g.state.algo[first.id])
            bad("[экзамен] решённая на экзамене задача сразу отмечена в общем списке — вердикт утёк");
          if (!(g.state.variant.ege.done || {})[first.n])
            bad("[экзамен] верный ответ не записан в самом экзамене");
          if (!(g.state.variant.ege.sent || {})[first.n])
            bad("[экзамен] сдача ответа не отмечена");
        }

        /* 13в.6е. Время вышло — заход закрыт, и в задачу больше не пускают. */
        {
          const w2 = g.state.variant.ege;
          const n = (w2.items || []).filter(x => x.id && !w2.done[x.n])[0];
          w2.endAt = Date.now() - 1000;
          g.screenVariant(); await tick();
          if (!/Заход окончен/.test(doc.getElementById("app").textContent))
            bad("[экзамен] по истечении времени не показан итог");
          if (!g.state.variant.ege.closed)
            bad("[экзамен] по истечении времени заход не закрыт");
          /* и решённое переехало в общий список — разом, при закрытии */
          if (!g.state.algo[(w2.items || []).filter(x => x.id)[0].id])
            bad("[экзамен] после закрытия решённое не попало в общий список");

          /* 13в.6ж. Разбор ПОСЛЕ экзамена: подсказки вернулись, а итог не
             меняется. Иначе «переиграть нельзя» — пустые слова. */
          if (n){
            const doneBefore = JSON.stringify(g.state.variant.ege.done);
            const go = doc.querySelector('[data-vgo="' + n.n + '"]');
            if (!go) bad("[экзамен] с итога нельзя открыть нерешённое на разбор");
            else {
              go.click(); await tick();
              if (!doc.getElementById("hintbtn"))
                bad("[экзамен] после закрытия захода подсказка не вернулась");
              if (doc.getElementById("examclock"))
                bad("[экзамен] после закрытия захода часы всё ещё идут");
              const st2 = studioOf();
              st2.editor.setCode(taskById(n.id).solution);
              st2.querySelector('[data-role="check"]').click(); await tick();
              if (!won()) bad("[экзамен] разбор после экзамена не засчитал эталон: " + msgText());
              if (JSON.stringify(g.state.variant.ege.done) !== doneBefore)
                bad("[экзамен] задача, решённая ПОСЛЕ времени, изменила итог захода");
            }
          }
        }
      }
    }

    /* --- 13в.6б. НОМЕР 16 ОГЭ — ПРОГРАММА С ВВОДОМ (13.09.2026, RAZVITIE § 2.7) ---
       В пуле номера 16 стояли задачи-функции, которые эксперт ФИПИ не
       оценивает: примерно каждый пятый вариант говорил «балла нет» на главном
       задании. Новые коды несут метку второй версии сборки; старые обязаны
       собирать то же, что раньше (§ 4.49).
       ⚠️ «Как раньше» считаем не слепком (он ломался бы от каждой новой задачи
       ОГЭ), а той же сборкой без судьи ФИПИ на странице: без него ветка второй
       версии не срабатывает, это и есть прежняя сборка. */
    if (typeof g.variantSeedV2 !== "function" || !w.FIPI16) bad("[вариант-16] нет метки версии кода или судьи ФИПИ");
    else {
      const F16 = w.FIPI16, n16 = F16.examTask().n;
      const прежняя = (seed) => { const keep = w.FIPI16; w.FIPI16 = undefined;
        try { return g.variantBuild("oge", seed); } finally { w.FIPI16 = keep; } };
      const задача = (items) => items.filter(x => x.n === n16)[0] || {};
      const ABC = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
      let h = 97531; const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h |= 0; return (h >>> 0) / 4294967296; };

      /* новые коды: все с меткой, все по азбуке, на 16 — всегда программа */
      let функцииБыли = 0, новых = 0;
      const перевыбрано = new Set();
      for (let i = 0; i < 300; i++){
        const s = g.variantNewSeed();
        if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(s)) { bad("[вариант-16] новый код не по азбуке: " + s); break; }
        if (!g.variantSeedV2(s)) { bad("[вариант-16] новый код без метки второй версии: " + s); break; }
        const it = g.variantBuild("oge", s), old = прежняя(s);
        const x = задача(it);
        if (!x.id || !F16.applies(g.algoById(x.id))) { bad("[вариант-16] по новому коду " + s + " на номере 16 не программа с вводом: " + x.id); break; }
        if (!F16.applies(g.algoById(задача(old).id))) { функцииБыли++; перевыбрано.add(x.id); }
        /* остальные номера — ровно те же, что собрала бы прежняя сборка */
        const другие = it.filter(y => y.n !== n16).map(y => y.id).join(",");
        if (другие !== old.filter(y => y.n !== n16).map(y => y.id).join(",")) { bad("[вариант-16] у кода " + s + " сдвинулись другие номера"); break; }
        новых++;
      }
      /* сторож не слеп: прежняя сборка на тех же кодах давала функции */
      if (новых === 300 && функцииБыли < 10)
        bad("[вариант-16] прежняя сборка почти не давала функций на 16 (" + функцииБыли + " из 300) — проверка ничего не проверяет");
      /* перевыбор идёт по семени, а не одной и той же задачей всем: иначе у
         каждого пятого ученика на номере 16 стояла бы одна программа */
      if (новых === 300 && функцииБыли >= 10 && перевыбрано.size < 5)
        bad("[вариант-16] вместо функции всем подставляется почти одна и та же программа: " + [...перевыбрано].join(", "));

      /* старые коды: без метки — вариант целиком тот же; с меткой — меняется
         только номер 16 и только если там стояла функция */
      let безМетки = 0, сМеткой = 0;
      for (let i = 0; i < 600; i++){
        let s = ""; for (let j = 0; j < 6; j++) s += ABC[Math.floor(rnd() * 32)];
        const it = g.variantBuild("oge", s).map(y => y.id).join(","), old = прежняя(s);
        if (!g.variantSeedV2(s)){
          безМетки++;
          if (it !== old.map(y => y.id).join(",")) { bad("[вариант-16] старый код " + s + " без метки собрал другой вариант"); break; }
        } else {
          сМеткой++;
          const был = задача(old).id;
          if (F16.applies(g.algoById(был)) && it !== old.map(y => y.id).join(","))
            { bad("[вариант-16] старый код " + s + " с программой на 16 собрал другой вариант"); break; }
        }
      }
      if (!безМетки || !сМеткой) bad("[вариант-16] на 600 старых кодах не нашлось обоих видов: " + безМетки + " / " + сМеткой);
      /* и ЕГЭ не тронут вовсе */
      const ege1 = g.variantBuild("ege", "JSMKQ7").map(y => y.id).join(",");
      const keepF = w.FIPI16; w.FIPI16 = undefined;
      const ege0 = g.variantBuild("ege", "JSMKQ7").map(y => y.id).join(",");
      w.FIPI16 = keepF;
      if (ege1 !== ege0) bad("[вариант-16] метка версии тронула сборку ЕГЭ");
    }

    /* --- 13в.7. ВАРИАНТ, НАЗНАЧЕННЫЙ РЕПЕТИТОРОМ (сторона ученика) ---
       ⚠️ Смысл всей затеи в том, что заданий никто не пересылает: приезжает
       код из шести букв, а вариант собирается на месте и получается тот же
       самый. Поэтому здесь проверяется не «показалась ли карточка», а то,
       что собранный по коду вариант СОВПАДАЕТ с тем, что собрал бы сосед. */
    {
      g.state.algo = {}; g.state.variant = {}; g.state.vtask = {};
      const SEED = "ABCDEF";
      g.state.vtask = { ege: { seed: SEED, mins: 60, at: Date.now(), due: "2026-09-20",
                               by: "репетитор" } };
      g.screenVariant(); await tick();
      const txt = doc.getElementById("app").textContent;
      if (!/Репетитор задал вариант/.test(txt))
        bad("[вариант-группа] заданное репетитором не показано ученику");
      if (txt.indexOf(SEED) < 0)
        bad("[вариант-группа] на экране нет кода заданного варианта");
      if (!/60/.test(txt))
        bad("[вариант-группа] не сказано, на сколько минут задан экзамен");

      const go = doc.querySelector('[data-vassign="ege"]');
      if (!go) bad("[вариант-группа] заданное нечем начать");
      else {
        go.click(); await tick();
        const v = g.state.variant.ege || {};
        if (v.seed !== SEED)
          bad("[вариант-группа] по заданию собрался ДРУГОЙ вариант: " + v.seed);
        if (v.mins !== 60)
          bad("[вариант-группа] режим из задания не применился: " + v.mins);
        /* ⚠️ Время идёт от НАЖАТИЯ, а не от того, когда репетитор задал:
           иначе заданный в понедельник экзамен истёк бы к среде. */
        if (!(v.endAt > Date.now() + 59 * 60000))
          bad("[вариант-группа] время экзамена пошло не с нажатия");
        /* и собранное по коду совпадает с тем, что соберёт сосед */
        const mine = (v.items || []).map(x => x.id).join(",");
        const other = g.variantBuild("ege", SEED).map(x => x.id).join(",");
        if (mine !== other)
          bad("[вариант-группа] у соседа по тому же коду собрался бы другой вариант");
        /* начатое задание больше не предлагается вторым экраном */
        g.screenVariant(); await tick();
        if (/Репетитор задал вариант/.test(doc.getElementById("app").textContent))
          bad("[вариант-группа] уже начатое задание предлагается заново");
      }

      /* 13в.7б. Код, продиктованный голосом: то же самое, но без всякого
         сервера. Это единственная дорога, которая работает у ребёнка без
         кабинета, и ломаться ей нельзя. */
      g.state.variant = {}; g.state.vtask = {};
      g.screenVariant(); await tick();
      const inp = doc.getElementById("vseed");
      if (!inp) bad("[вариант-группа] некуда вписать продиктованный код");
      else {
        inp.value = "hjk234";               /* строчными и с голоса — тоже код */
        doc.querySelector('[data-vnew="ege"]').click(); await tick();
        if ((g.state.variant.ege || {}).seed !== "HJK234")
          bad("[вариант-группа] вариант по вписанному коду собрался не тот: " +
              (g.state.variant.ege || {}).seed);
      }

      /* 13в.7в. ⚠️ Кривой код — это ошибка, о которой обязаны сказать. Молча
         собрать «похожий» вариант хуже всего: ребёнок будет уверен, что решает
         то же, что и все, а решать будет другое. */
      g.state.variant = {};
      g.screenVariant(); await tick();
      const inp2 = doc.getElementById("vseed");
      if (inp2){
        inp2.value = "ABC";
        doc.querySelector('[data-vnew="ege"]').click(); await tick();
        if (g.state.variant.ege)
          bad("[вариант-группа] по негодному коду молча собрался вариант");
        const m = doc.getElementById("vseedmsg");
        if (!m || !/не подходит/i.test(m.textContent))
          bad("[вариант-группа] про негодный код ничего не сказано");
      }
      g.state.vtask = {};
    }
    g.state.algo = {}; g.state.variant = {};
    viewReset(g);
    if (problems.length === p0) variantChecked++;
  }

  /* --- 13в.9. [карта-огэ] структура ОГЭ сверена со спецификацией ФИПИ 2026 ---
     ⚠️ До 13.09.2026 карта говорила «15 заданий, задание 15 — программа или
     Робот на выбор»: так было до 2025 года. С 2025 года заданий 16, 15 —
     Робот, 16 — программа, оба обязательны. Тесты молчали, потому что
     сверяли карту с самой собой. Теперь структура записана здесь слепком. */
  if (w.EXAMS && w.EXAMS.oge){
    const oge = w.EXAMS.oge;
    if (oge.total !== 16 || oge.tasks.length !== 16)
      bad(`[карта-огэ] в ОГЭ ${oge.total} заданий (строк ${oge.tasks.length}) — по спецификации 2026 их 16`);
    const t15 = oge.tasks.find(x => x.n === 15), t16 = oge.tasks.find(x => x.n === 16);
    if (!t15 || !t15.robot) bad("[карта-огэ] задание 15 обязано быть исполнителем «Робот»");
    if (!t16 || !(t16.g || []).includes("oge")) bad("[карта-огэ] задание 16 обязано быть программой (группа oge)");
    if (t15 && w.EXAMS.state(t15, () => 0) !== "yes") bad("[карта-огэ] задание 15 не видит задач Робота");
    g.openExamMap("oge"); await tick();
    const txt = doc.getElementById("app").textContent;
    if (/по выбору/.test(txt)) bad("[карта-огэ] карта ОГЭ всё ещё говорит «по выбору» про задание 15");
    const rb = doc.querySelector("#app .exrow [data-exrobot]");
    if (!rb) bad("[карта-огэ] в строке задания 15 нет кнопки к Роботу");
    else { rb.click(); await tick();
      if (!/Робот/.test(doc.getElementById("app").textContent)) bad("[карта-огэ] кнопка задания 15 не открыла Робота"); }
    /* ⚠️ С 1.163.0 номер 15 в варианте — задача Робота формата ОГЭ (раньше
       строка стояла пустой со ссылкой на раздел). */
    const items = g.variantBuild("oge", "TEST42");
    const v15 = items.find(x => x.n === 15);
    const rt15 = v15 && (w.ROBOT_TASKS || []).find(r => r.id === v15.id);
    if (items.length !== 16 || !v15 || v15.kind !== "robot" || !rt15 || !rt15.fipi)
      bad("[карта-огэ] в варианте ОГЭ на номере 15 не задача Робота формата ОГЭ или номеров не 16");
    /* ⚠️ Робот в варианте НЕ сдвигает остальные номера: код, продиктованный
       репетитором до 1.163.0, обязан собрать те же задачи на 1–14 и 16.
       Проверяем, убрав задачи формата ОГЭ: сборка обязана совпасть по всем
       номерам, кроме 15-го. */
    {
      const RT = w.ROBOT_TASKS;
      const seeds = ["TEST42", "ABCDEF", "ZZZ999", "K7M2PQ", "22HHJJ", "QWERTY"];
      const withRb = seeds.map(sd => g.variantBuild("oge", sd));
      w.ROBOT_TASKS = RT.filter(r => !r.fipi);
      const without = seeds.map(sd => g.variantBuild("oge", sd));
      w.ROBOT_TASKS = RT;
      seeds.forEach((sd, i) => {
        const a = withRb[i].filter(x => x.n !== 15).map(x => x.id).join();
        const b = without[i].filter(x => x.n !== 15).map(x => x.id).join();
        if (a !== b) bad("[карта-огэ] Робот в варианте сдвинул выбор других номеров для кода " + sd);
      });
      if (without[0].find(x => x.n === 15).id !== null)
        bad("[карта-огэ] без задач формата ОГЭ номер 15 не остался пустым");
    }
    viewReset(g);
  }

  /* --- 13в.0. [38-фз] тексты продукта против закона «О рекламе», ст. 6 ---
     ⚠️ Слепок первоисточника (КонсультантПлюс, 38-ФЗ ред. от 04.08.2026,
     сверено 13.09.2026). В рекламе не допускаются: 1) дискредитация
     родителей и воспитателей, подрыв доверия к ним у несовершеннолетних;
     2) побуждение несовершеннолетних убедить родителей или других лиц
     приобрести товар; 3) искажённое представление о доступности товара для
     семьи с любым достатком; 4) впечатление, что обладание товаром ставит
     выше сверстников; 5) комплекс неполноценности у тех, у кого товара нет;
     6) несовершеннолетние в опасных ситуациях; 7) преуменьшение навыков,
     нужных для пользования товаром; 8) комплекс из-за внешности.
     Реклама по ст. 3 — информация для неопределённого круга лиц, привлекающая
     внимание к товару: это страницы сайта и вывеска приложения. Экраны внутри
     тренажёра стережём тоже — их видит ребёнок, и трактовка «это не реклама»
     не стоит того, чтобы на неё ставить.
     Проверка не заменяет юриста: она ловит ФОРМУЛИРОВКИ, на которых разбор
     13.09.2026 нашёл риск, чтобы они не вернулись молча. */
  {
    const read = f => fs.readFileSync(path.join(root, f), "utf8");
    const noComments = src => src.replace(/\/\*[\s\S]*?\*\//g, " ").split("\n")
      .map(l => l.replace(/(^|[^:"'\\])\/\/.*$/, "$1")).join("\n");
    const pageText = src => src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const texts = [];
    fs.readdirSync(path.join(root, "js")).filter(f => f.endsWith(".js"))
      .forEach(f => texts.push(["js/" + f, noComments(read("js/" + f))]));
    fs.readdirSync(path.join(root, "content")).filter(f => f.endsWith(".js"))
      .forEach(f => texts.push(["content/" + f, noComments(read("content/" + f))]));
    const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).forEach(e => {
      const rel = dir ? dir + "/" + e.name : e.name;
      if (e.isDirectory()){ if (!/^(node_modules|dist|\.git|\.claude|docs|tests|og|cloud|js|css|content)$/.test(e.name)) walk(rel); }
      else if (e.name.endsWith(".html")) texts.push([rel, pageText(read(rel))]);
    });
    walk("");
    const RULES = [
      ["п. 2 — побуждение уговорить взрослого купить",
       /(попроси|уговори|убеди|скажи|напомни|предложи)[^.!?\n"'<]{0,40}(мам[а-яё]*|пап[а-яё]*|родител[а-яё]*|взросл[а-яё]*)[^.!?\n"'<]{0,40}(купи|оплат|подписк|заплат|платн)/i],
      ["п. 2 — призыв к покупке, обращённый к ребёнку",
       /* ⚠️ не \b и не \w: в JavaScript оба видят только латиницу (§ 4.41) */
       /(^|[^а-яё])(купи|оплати|подпишись|оформи подписку|разблокируй за)(?![а-яё])/i],
      ["п. 1 — подрыв доверия к тем, кто учит",
       /(школ[а-яё]*|учител[а-яё]*|педагог[а-яё]*|репетитор[а-яё]*|родител[а-яё]*)[^.!?\n"'<]{0,30}(сам[а-яё]* себя не провер|не научат|не научит|ничему не учит|не понима[а-яё]* в|не разбира[а-яё]*|обманыва|врут)/i],
      ["п. 4–5 — сравнение со сверстниками",
       /лучше (сверстник|одноклассник|других ребят|остальных детей)|обгони (друзей|одноклассник|сверстник)|у всех (уже )?есть|не хуже других|отстанешь от/i],
      ["п. 7 — преуменьшение нужных навыков",
       /без (всяких )?усилий|любой справится|справится любой|научишься за \d+|проще простого|не нужно (ничего )?уметь/i]
    ];
    /* ⚠️ [лицензия] Красные линии образовательной деятельности (273-ФЗ ред.
       от 04.08.2026, сверено 13.09.2026): образовательная деятельность — это
       «деятельность по реализации образовательных программ» (ст. 2 п. 17) и
       она лицензируется (ст. 91 ч. 1); исключение — только ИП, который учит
       сам (ст. 91 ч. 2), а самозанятого без ИП в законе нет. Мы продаём право
       пользоваться программой и не зачисляем, не аттестуем, не выдаём
       документов. Эти формулировки перевели бы нас в лицензируемую зону —
       утвердительно их в продукте быть не должно. Разбор —
       docs/licenziya-proverka-2026-09-13.md. */
    const LICENSE = [
      ["зачисление на обучение", /зачисл[а-яё]*/i],
      ["выдача документа об обучении", /(выда[её]м|выдадим|получ[иа][а-яё]*)[^.!?\n"'<]{0,20}(свидетельств|удостоверени|диплом|аттестат)/i],
      ["обещание подготовить к экзамену как наша услуга", /(подготовим|гарантиру[её]м)[^.!?\n"'<]{0,30}(огэ|егэ|экзамен|балл|результат|сдач)/i],
      ["свои педагоги", /наш[а-яё]* (педагог|преподавател|учител|наставник)/i],
      ["договор об образовании", /договор[а-яё]* об (образовании|оказании (платных )?образовательных услуг)/i],
      ["учебный план и график как наши", /(наш[а-яё]*|по) (учебному плану|учебный план|календарн[а-яё]* учебн[а-яё]* график)/i]
    ];
    let scanned = 0;
    texts.forEach(([f, t]) => {
      scanned++;
      RULES.forEach(([name, rx]) => {
        const m = rx.exec(t);
        if (m) bad("[38-фз] " + name + ": «" + t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 30).trim() + "» в " + f);
      });
      LICENSE.forEach(([name, rx]) => {
        const m = rx.exec(t);
        if (m) bad("[лицензия] " + name + ": «" + t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 30).trim() + "» в " + f);
      });
    });
    /* сторож не должен ослепнуть: обязан видеть и код, и страницы сайта */
    if (scanned < 40 || !texts.some(([f]) => f === "vitrina/index.html") || !texts.some(([f]) => f === "js/app.js"))
      bad("[38-фз] проверка текстов прочла подозрительно мало файлов: " + scanned);
    /* ⚠️ Всё про деньги — взрослому. Сегодня оплаты нет, и на вывеске обязано
       стоять «сейчас»/«сегодня» рядом с «бесплатно»: без этого слова
       бесплатность читается как навсегда (п. 3), а оплата однажды появится. */
    /* ⚠️ Возврат заложен в условия ДО появления оплаты (решение фаундера
       13.09.2026): отказ в любой момент — право потребителя по ст. 32 ЗоЗПП
       (ред. от 28.12.2025, сверено), и суды применяют её к доступу к
       онлайн-курсам. Пропадёт строка — первая же оферта напишется без неё. */
    const terms = (texts.find(([f]) => f === "pravo/soglashenie/index.html") || [])[1] || "";
    if (!/отказаться от него можно в любой момент/.test(terms) || !/стать[её]й? 32/.test(terms))
      bad("[лицензия] в условиях использования нет обещания возврата при платном доступе (ст. 32 ЗоЗПП)");
    /* код ученика в политике — нового вида, без имени */
    const policy = read("pravo/politika/index.html");
    const pm = /вида <code>([^<]+)<\/code>/.exec(policy);
    if (!pm || !/^[a-z]+-[a-z0-9]{5}$/.test(pm[1]) || /anya/.test(pm[1]))
      bad("[лицензия] политика показывает код ученика не нынешнего вида (слово-5знаков, без имени): " + (pm && pm[1]));
    /* ⚠️ С 1.187.0 вывеска живёт в js/screens-about.js — без неё сторож ослеп бы */
    const landFile = texts.find(([f]) => f === "js/screens-about.js");
    if (!landFile) bad("[38-фз] проверка текстов не прочла вывеску (js/screens-about.js)");
    const land = texts.find(([f]) => f === "js/app.js")[1] + "\n" + (landFile ? landFile[1] : "");
    const freeLines = land.split("\n").filter(l => /бесплатн/i.test(l) && /['"]/.test(l) && /(Сейчас|Сегодня)/.test(l) === false && /доступ|🆓/.test(l));
    if (freeLines.length) bad("[38-фз] «бесплатно» на вывеске без «сейчас»/«сегодня»: " + freeLines[0].trim().slice(0, 120));
  }

  /* --- 13в.10. [фипи-16] судья задания-программы ОГЭ — как эксперт ФИПИ ---
     ⚠️ Слепок документа, а не пересказ (§ 4.44 RAZVITIE): методические
     материалы ФИПИ для предметных комиссий, ОГЭ-2026, информатика, с. 53–55.
     2 балла — верно на всех тестах; 1 — неверно не более чем на одном; 0 —
     иначе; без ввода или без вывода — 0; не запускается — 0. Тестов в
     образцах критериев три. Поменялся документ — меняй слепок вместе с ним. */
  if (w.FIPI16 && typeof g.algoList === "function"){
    const F = w.FIPI16, MP = w.MiniPy, XS = g.algoList();
    const eng = { run: (c, o) => MP.run(c, o) };
    const byId = id => XS.find(x => x.id === id);
    const msgFull = () => { const m = doc.querySelector("#studio .msg"); return m ? m.textContent : ""; };

    /* 1. Слепок чисел документа. */
    if (F.MAX !== 2) bad("[фипи-16] максимальный балл " + F.MAX + ", а по МР ФИПИ 2026 — 2");
    if ([0, 1, 2, 3].map(F.scoreOf).join() !== "2,1,0,0")
      bad("[фипи-16] шкала по числу неверных тестов не 2/1/0/0: " + [0, 1, 2, 3].map(F.scoreOf).join());
    if (F.MIN_TESTS !== 3) bad("[фипи-16] тестов в образцах ФИПИ три, а записано " + F.MIN_TESTS);
    if (!/mr_oge_informatika_2026\.pdf$/.test(F.DOC.url) || F.DOC.pages !== "с. 53–55")
      bad("[фипи-16] ссылка на документ ФИПИ потеряна или сменились страницы");
    const et = F.examTask();
    if (!et || et.n !== 16) bad("[фипи-16] программа ОГЭ не нашлась на своём номере: " + (et && et.n));

    /* 2. Каждая задача, к которой применяется оценка: тестов эксперта не
       меньше трёх, эталон получает 2 без предупреждений, заготовка — меньше. */
    const ap = XS.filter(F.applies);
    if (ap.length < XS.filter(x => x.group === "oge").length)
      bad("[фипи-16] оценка применяется не ко всем задачам формата ОГЭ: " + ap.length);
    ap.forEach(x => {
      if (x.sets.length < F.MIN_TESTS)
        bad("[фипи-16] у «" + x.id + "» скрытых тестов " + x.sets.length + " — эксперт гоняет три");
      const gs = F.grade(eng, x.solution, x);
      if (gs.score !== 2 || gs.zero || gs.prompts || gs.newer.length)
        bad("[фипи-16] эталон «" + x.id + "» получил не чистые 2 балла: " + JSON.stringify(gs));
      if (F.grade(eng, x.starter, x).score === 2)
        bad("[фипи-16] заготовка «" + x.id + "» получает 2 балла");
    });
    if (XS.some(x => x.check.kind === "tests" && F.applies(x)))
      bad("[фипи-16] задача-функция без ввода получила оценку эксперта");

    /* 3. Правила на одной задаче — каждое своим случаем. */
    const t = byId("oge-count-base");
    if (!t) bad("[фипи-16] нет задачи oge-count-base");
    else {
      const G = code => F.grade(eng, code, t);
      const c1 = G('print("' + t.sample.out + '")');
      if (c1.score !== 0 || c1.zero !== "input") bad("[фипи-16] константа без ввода не получила 0 «нет ввода»: " + JSON.stringify(c1));
      const c2 = G("n = int(input())\nfor i in range(n):\n    x = int(input())\n");
      if (c2.score !== 0 || c2.zero !== "output") bad("[фипи-16] программа без вывода не получила 0 «нет вывода»: " + JSON.stringify(c2));
      const one = t.solution.replace('print("NO")', "print(0)");   /* ломает ровно тест без подходящих */
      const c3 = G(one);
      if (c3.score !== 1 || c3.passed !== c3.total - 1) bad("[фипи-16] ошибка на одном тесте дала не 1 балл: " + JSON.stringify(c3));
      const c4 = G(t.solution.replace("x % 7 == 1", "x % 7 == 0"));
      if (c4.score !== 0 || c4.zero) bad("[фипи-16] ошибка на всех тестах дала не 0: " + JSON.stringify(c4));
      const c5 = G("n = int(input(\nprint(1)");
      if (c5.score !== 0 || c5.zero !== "syntax") bad("[фипи-16] незапускающаяся программа не получила 0: " + JSON.stringify(c5));
      const prompt = t.solution.replace("n = int(input())", 'n = int(input("Введите количество: "))')
                               .replace("x = int(input())", 'x = int(input("Число: "))');
      const c6 = G(prompt);
      if (c6.score !== 2 || !c6.prompts) bad("[фипи-16] input с приглашением свалил оценку или не замечен: " + JSON.stringify(c6));
      const c7 = G("n = int(input())\nprint(1 // 0)");
      if (c7.score !== 0 || c7.zero) bad("[фипи-16] падение программы названо не «тест не засчитан»: " + JSON.stringify(c7));

      /* 4. Конструкции новее 3.7 — находятся в коде и не находятся в строках. */
      const nw = F.newerSyntax("x = 2\nmatch x:\n    case 2:\n        print(1)\nif (k := 3) > 1:\n    print(f'{k=}')\n'a'.removeprefix('a')\n");
      ["3.10", "3.8", "3.9"].forEach(ver => {
        if (!nw.some(v => v.ver === ver)) bad("[фипи-16] не замечена конструкция Python " + ver + ": " + JSON.stringify(nw));
      });
      if (!nw.some(v => v.what === "match … case" && v.line === 2)) bad("[фипи-16] match найден не на своей строке");
      const quiet = F.newerSyntax("# match x:\ns = 'k := 3'\nt = \"\"\"\nmatch y:\n    case 1:\n\"\"\"\nprint(f'{a>=b}')\n");
      if (quiet.length) bad("[фипи-16] конструкция найдена в комментарии или строке: " + JSON.stringify(quiet));

      /* 5. Экран задачи: правило видно до решения, балл — после проверки. */
      g.state.algo = {};
      g.openAlgo(t.id); await tick();
      if (!/эксперт/.test(doc.getElementById("app").textContent))
        bad("[фипи-16] на экране задачи не сказано, как её оценивает эксперт");
      const st = studioOf();
      if (st){
        closeWin();   /* карточка победы чужого теста не должна читаться как наша */
        st.editor.setCode(prompt);
        st.querySelector('[data-role="check"]').click(); await tick();
        if (!won()) bad("[фипи-16] программа с input(\"Введите…\") не засчитана: " + msgText());
        else {
          const card = doc.getElementById("wincard").textContent;
          if (!/было бы 2 из 2/.test(card)) bad("[фипи-16] в победе нет «2 из 2»: " + card.slice(0, 200));
          if (!/только одно число/.test(card)) bad("[фипи-16] в победе не предупреждено про текст приглашения");
          if (!/ФИПИ/.test(card) || !/с\. 53–55/.test(card)) bad("[фипи-16] в победе не назван документ ФИПИ");
          closeWin();
        }
        st.editor.setCode(one);
        st.querySelector('[data-role="check"]').click(); await tick();
        if (won()){ bad("[фипи-16] программа с ошибкой на одном тесте засчитана"); closeWin(); }
        else if (!/было бы 1 из 2/.test(msgFull())) bad("[фипи-16] при ошибке на одном тесте нет «1 из 2»: " + msgText());
        st.editor.setCode('print("' + t.sample.out + '")\n');
        st.querySelector('[data-role="check"]').click(); await tick();
        if (!/было бы 0 из 2/.test(msgFull()) || !/не читает/.test(msgFull()))
          bad("[фипи-16] константа без ввода не получила «0 из 2» с причиной: " + msgText());
        st.editor.setCode(t.solution.replace("if count == 0:", "if (c := count) == 0:"));
        st.querySelector('[data-role="check"]').click(); await tick();
        if (!/3\.8/.test(msgFull())) bad("[фипи-16] про конструкцию Python 3.8 не предупреждено: " + msgText());
      }
    }

    /* 6. Итог экзамена ОГЭ: балл за программу есть, общего балла нет, и
       пока идёт экзамен, балл молчит вместе с вердиктом. */
    {
      g.state.algo = {}; g.state.variant = {};
      g.screenVariant(); await tick();
      const tabO = doc.querySelector('[data-vtab="oge"]');
      if (tabO){ tabO.click(); await tick(); }
      const start = doc.querySelector('[data-vexam="30"]');
      if (!start) bad("[фипи-16] на вкладке ОГЭ нет режима экзамена");
      else {
        start.click(); await tick();
        const v = g.state.variant.oge;
        const it = v && v.items.find(x => x.n === 16);
        if (!it) bad("[фипи-16] в экзамене ОГЭ нет номера 16");
        else {
          it.id = "oge-count-base";          /* номер 16 — программа с вводом */
          g.screenVariant(); await tick();
          const go = doc.querySelector('[data-vgo="16"]');
          if (!go) bad("[фипи-16] номер 16 в экзамене не открывается");
          else {
            go.click(); await tick();
            const st = studioOf();
            /* упавшая программа: ошибку экзамен показывает, а балл — нет */
            st.editor.setCode("n = int(input())\nprint(1 // 0)\n");
            st.querySelector('[data-role="check"]').click(); await tick();
            if (/из 2/.test(msgFull())) bad("[фипи-16] на идущем экзамене при ошибке показан балл — вердикт утёк");
            st.editor.setCode(t.solution.replace('print("NO")', "print(0)"));
            st.querySelector('[data-role="check"]').click(); await tick();
            if (/из 2/.test(msgFull())) bad("[фипи-16] на идущем экзамене показан балл — вердикт утёк");
            const p = (g.state.variant.oge.pts || {})[16];
            if (!p || p.s !== 1) bad("[фипи-16] балл за сданную программу не записан в экзамене: " + JSON.stringify(p));
            g.state.variant.oge.endAt = Date.now() - 1000;
            g.screenVariant(); await tick();
            const txt = doc.getElementById("app").textContent;
            if (!/как оценил бы эксперт/.test(txt) || !/1 из 2/.test(txt))
              bad("[фипи-16] итог экзамена ОГЭ не показал балл за программу");
            if (!/общего балла/.test(txt)) bad("[фипи-16] итог не объяснил, почему общего балла нет");
            if (/первичный балл|из 100|стобалльн/i.test(txt)) bad("[фипи-16] итог выдумал общий балл");
          }
          /* задача-функция на номере 16 — балла нет, и это сказано */
          const v2 = g.state.variant.oge;
          v2.items.find(x => x.n === 16).id = "find-linear";
          g.screenVariantDone(); await tick();
          if (!/задача-функция/.test(doc.getElementById("app").textContent))
            bad("[фипи-16] на номере 16 задача-функция, а итог не сказал, что балла нет");
        }
      }
      g.state.variant = {};
      const m = g.mergeProgress(
        { savedAt:1, variant:{ oge:{ ex:"oge", seed:"OOOOOO", at:5, mins:30, endAt:9, closed:1, items:[],
          done:{}, seen:{}, sent:{ 16:1 }, pts:{ 16:{ s:2, t:3, p:3, z:"", at:10 } } } } },
        { savedAt:2, variant:{ oge:{ ex:"oge", seed:"OOOOOO", at:5, mins:30, endAt:9, closed:1, items:[],
          done:{}, seen:{}, sent:{ 16:1 }, pts:{ 16:{ s:0, t:3, p:0, z:"input", at:20 } } } } });
      const mp = ((m.variant.oge || {}).pts || {})[16];
      if (!mp || mp.s !== 0) bad("[фипи-16] слияние устройств потеряло балл или взяло не последний: " + JSON.stringify(mp));
    }

    /* 7. Отрицательные числа: где условие допускает целые, в тестах они есть
       (в Python -16 % 10 == 4, и ошибка на знаке — классика). */
    let checkedNeg = 0;
    XS.forEach(x => {
      const txt = x.goal + " " + x.list.join(" ");
      const allows = /целы[ех] числ|числа, целые|целых чис|быть отрицательн/i.test(txt);
      if (!allows || /неотрицат|натурал|от 0 до/i.test(txt)) return;
      checkedNeg++;
      const data = [x.stdin || []].concat(x.sets || []).map(d => d.join(" ")).join(" ") +
                   " " + ((x.check.calls || []).join(" "));
      if (!/(^|[^\w])-\d/.test(data))
        bad("[фипи-16] у «" + x.id + "» условие допускает целые, а отрицательных в тестах нет");
    });
    /* сторож не должен молча смотреть в пустоту: таких задач сейчас четыре */
    if (checkedNeg < 4) bad("[фипи-16] задач, где условие допускает отрицательные, найдено " + checkedNeg + " — сторож ослеп");
    g.state.algo = {}; g.state.variant = {};
    viewReset(g);
  }

  /* --- 13в.11. [фипи-15] Робот — задание 15 ОГЭ — как эксперт ФИПИ ---
     ⚠️ Слепок документа (§ 4.44 RAZVITIE): МР ФИПИ для экспертов ОГЭ-2026,
     раздел 2.4. с. 41 — 2: верно при всех допустимых данных; 1: завершается,
     Робот цел, лишних не больше 10 и незакрашенных нужных не больше 10; 0 —
     иначе. с. 43 — поле бесконечное, «до края» не завершается. с. 44 — ошибку
     считают при очень больших длинах. с. 48–49 — пример 1 (закрашена
     стартовая клетка) — 1 балл, пример 2 (ещё и клетки над проходом) — 0. */
  if (w.FIPI15 && w.ROBOT && typeof g.openRobot === "function"){
    const F = w.FIPI15, R = w.ROBOT, TS = w.ROBOT_TASKS || [];
    const byId = id => TS.find(t => t.id === id);

    /* 1. Слепок чисел. */
    if (F.MAX !== 2 || F.LIMIT !== 10) bad("[фипи-15] максимум или порог не 2 и 10: " + F.MAX + ", " + F.LIMIT);
    const sc = [[false,0,0],[false,10,10],[false,11,0],[false,0,11],[true,0,0]].map(a => F.scoreOf.apply(null, a)).join();
    if (sc !== "2,1,0,0,0") bad("[фипи-15] шкала 2/1/0 не по документу: " + sc);
    if (F.DOC.pages !== "с. 41–44" || !/mr_oge_informatika_2026\.pdf$/.test(F.DOC.url))
      bad("[фипи-15] ссылка на документ ФИПИ потеряна или сменились страницы");

    /* 2. Каждая задача формата ОГЭ: поле бесконечное, есть поле «очень больших
       длин» (сторона от 30 и проход длиннее 10), эталон — 2, заготовка — нет. */
    const ft = TS.filter(F.applies);
    /* порог тот же, что у тем экзамена (13.1а): пять задач */
    if (ft.length < 5) bad("[фипи-15] задач Робота формата ОГЭ " + ft.length + " — меньше пяти");
    const longGap = rows => {
      const lines = rows.concat(rows[0].split("").map((_, x) => rows.map(r => r[x]).join("")));
      return lines.some(l => /#\.{11,}#/.test(l));
    };
    ft.forEach(t => {
      if (!t.inf) bad("[фипи-15] у «" + t.id + "» поле не бесконечное — край станет стеной");
      const all = [t.field].concat(t.more || []);
      if (!all.some(r => Math.max(r.length, r[0].length) >= 30 && longGap(r)))
        bad("[фипи-15] у «" + t.id + "» нет поля с длинными стенами и проходом длиннее 10");
      const gs = F.grade(R, t.solution, t);
      if (gs.score !== 2) bad("[фипи-15] эталон «" + t.id + "» получил " + gs.score + ": " + JSON.stringify(gs.broke));
      if (F.grade(R, t.starter, t).score === 2) bad("[фипи-15] заготовка «" + t.id + "» получает 2 балла");
      /* на бесконечном поле ни одна стена не касается края нарисованного */
      all.forEach((r, i) => {
        if (/#/.test(r[0] + r[r.length - 1] + r.map(x => x[0] + x[x.length - 1]).join("")))
          bad("[фипи-15] у «" + t.id + "» на поле " + i + " стена касается края — запаса нет");
      });
    });

    /* 3. Эталон закрашивает то, что сказано словами, — посчитано из геометрии
       поля, а не из самого эталона. Зеркало и поворот обязаны давать зеркало
       и поворот закрашенного. */
    const painted = (t, rows) => R.fieldRows(R.run(t.solution, R.parseField(rows, true)).field)
                                  .map(l => l.replace(/[@+]/g, m => m === "+" ? "*" : "."));
    const cornerWant = rows => {
      const H = rows.length, W = rows[0].length;
      let ry = 0, rx = 0;
      rows.forEach((l, y) => { const x = l.indexOf("@"); if (x >= 0){ ry = y; rx = x; } });
      const yH = ry - 1;
      let xV = -1;
      for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (rows[y][x] === "#") xV = Math.max(xV, x);
      return rows.map((l, y) => l.split("").map((c, x) => {
        if (c === "#") return "#";
        if (x === rx && y === ry) return ".";
        const under = y === yH + 1 && x < xV && rows[yH][x] === "#";
        const left = x === xV - 1 && y > yH && rows[y][xV] === "#";
        return (under || left) ? "*" : ".";
      }).join(""));
    };
    const tc = byId("rb-oge-corner"), tu = byId("rb-oge-up"), tl = byId("rb-oge-left"), tw = byId("rb-oge-wall");
    if (!tc || !tu || !tl || !tw) bad("[фипи-15] нет одной из четырёх задач формата ОГЭ");
    else {
      const fl = rs => rs.slice().reverse();
      const tr = rs => rs[0].split("").map((_, x) => rs.map(r => r[x]).join(""));
      [tc.field].concat(tc.more).forEach((rows, i) => {
        const got = painted(tc, rows).join("\n"), want = cornerWant(rows).join("\n");
        if (got !== want) bad("[фипи-15] «Угол двух стен» на поле " + i + " закрашивает не то, что сказано:\n" + got + "\nнужно:\n" + want);
        const up = [tu.field].concat(tu.more)[i], lf = [tl.field].concat(tl.more)[i];
        if (painted(tu, up).join("\n") !== fl(painted(tc, rows)).join("\n"))
          bad("[фипи-15] «Угол вверх» на поле " + i + " — не зеркало «Угла двух стен»");
        if (painted(tl, lf).join("\n") !== tr(painted(tc, rows)).join("\n"))
          bad("[фипи-15] «Стена слева и снизу» на поле " + i + " — не поворот «Угла двух стен»");
      });
      [tw.field].concat(tw.more).forEach((rows, i) => {
        const ry = rows.findIndex(l => l.includes("@"));
        const want = rows.map((l, y) => l.split("").map((c, x) =>
          c === "#" ? "#" : (y === ry && rows[y - 1][x] === "#") ? "*" : ".").join("")).join("\n");
        if (painted(tw, rows).join("\n") !== want) bad("[фипи-15] «Под стеной с проходом» на поле " + i + " закрашивает не то");
      });
      const tk = byId("rb-oge-corridor");
      if (!tk) bad("[фипи-15] нет «Коридора с двумя проходами»");
      else [tk.field].concat(tk.more).forEach((rows, i) => {
        const ry = rows.findIndex(l => l.includes("@"));
        const want = rows.map((l, y) => l.split("").map((c, x) =>
          c === "#" ? "#" : (y === ry && rows[y - 1][x] === "#" && rows[y + 1][x] === "#") ? "*" : ".").join("")).join("\n");
        if (painted(tk, rows).join("\n") !== want) bad("[фипи-15] «Коридор с двумя проходами» на поле " + i + " закрашивает не то");
        const upper = rows[ry - 1], lower = rows[ry + 1];
        for (let x = 0; x < upper.length; x++)
          if (upper[x] === "." && lower[x] === "." && upper.slice(0, x).includes("#") && upper.slice(x).includes("#") &&
              lower.slice(0, x).includes("#") && lower.slice(x).includes("#"))
            { bad("[фипи-15] в «Коридоре» на поле " + i + " проходы перекрываются — условие обещает, что нет"); break; }
      });

      /* 4. Правила — каждое своим случаем, на образцах ФИПИ. */
      const G = (t, c) => F.grade(R, c, t);
      const ex1 = G(tc, "закрасить\n" + tc.solution);
      if (ex1.score !== 1 || ex1.maxExtra !== 1) bad("[фипи-15] пример 1 (закрашена стартовая клетка) — не 1 балл: " + JSON.stringify(ex1));
      const passPaint = tc.solution.replace("нц пока сверху свободно\n  вправо\nкц", "нц пока сверху свободно\n  закрасить\n  вправо\nкц");
      const ex2 = G(tc, "закрасить\n" + passPaint);
      if (ex2.score !== 0 || ex2.maxExtra <= 10) bad("[фипи-15] пример 2 (клетки под проходом) — не 0 при длинном проходе: " + JSON.stringify(ex2));
      /* пример 3: шаги под картинку из условия, без циклов вдоль стен */
      const onField = G(tc, "вправо\nзакрасить\nвправо\nвправо\nвправо\nзакрасить\nзакрасить\n");
      if (onField.score !== 0) bad("[фипи-15] решение по рисунку не получило 0");
      const edge = G(tw, "нц пока справа свободно\n  закрасить\n  вправо\nкц\n");
      if (edge.score !== 0 || !edge.broke || edge.broke.why !== "away")
        bad("[фипи-15] решение «до края поля» не названо незавершающимся: " + JSON.stringify(edge.broke));
      /* решение, верное на КОНЕЧНОМ поле: идёт до края и красит только под
         стеной. На экзамене поле бесконечное — это 0 (с. 43). */
      const EDGE = "нц пока справа свободно\n  если сверху стена то\n    закрасить\n  все\n  вправо\nкц\n";
      if (R.run(EDGE, R.parseField(tw.field)).error) bad("[фипи-15] решение «до края» падает и на конечном поле — случай не тот");
      const edge2 = G(tw, EDGE);
      if (edge2.score !== 0 || !edge2.broke || edge2.broke.why !== "away")
        bad("[фипи-15] решение, верное только на конечном поле, не получило 0: " + JSON.stringify(edge2.broke));
      const loop = G(tw, "нц пока сверху стена\n  закрасить\nкц\n");
      if (loop.score !== 0 || !loop.broke || loop.broke.why !== "loop") bad("[фипи-15] вечный цикл не дал 0");
      const crash = G(tc, "вверх\n");
      if (crash.score !== 0 || !crash.broke || crash.broke.why !== "crash") bad("[фипи-15] разбившийся Робот не дал 0");
      const miss = G(tc, tc.solution.replace(/нц пока справа стена\n  закрасить\n  вниз\nкц\n$/, "нц пока справа стена\n  вниз\nкц\n"));
      if (miss.score !== 1 || miss.maxMissed < 1 || miss.maxMissed > 10) bad("[фипи-15] пропущено немного клеток — не 1 балл: " + JSON.stringify(miss));
      if (G(tc, "нц пока справа\n").score !== null) bad("[фипи-15] у неразобранной записи назван балл");

      /* 5. Экран задачи: разделы, балл после проверки. */
      g.state.algo = {};
      g.screenRobot(); await tick();
      const secs = [...doc.querySelectorAll("#app .sect h2")].map(h => h.textContent);
      if (!/Формат ОГЭ/.test(secs[0] || "")) bad("[фипи-15] в разделе «Робот» формат ОГЭ не стоит первым: " + secs.join(" | "));
      const card = doc.querySelector('[data-rb="rb-oge-corner"]');
      if (!card) bad("[фипи-15] в списке нет «Угла двух стен»");
      else {
        card.click(); await tick();
        const run = async c => { doc.getElementById("rbcode").value = c; doc.getElementById("rbrun").click(); await tick();
                                  return (doc.getElementById("rbmsg") || {}).textContent || ""; };
        if (!/эксперт/.test(doc.getElementById("app").textContent)) bad("[фипи-15] на экране задачи не сказано про оценку эксперта");
        let m = await run("закрасить\n" + tc.solution);
        if (!/было бы 1 из 2/.test(m)) bad("[фипи-15] после проверки нет «1 из 2»: " + m.slice(0, 160));
        m = await run(tc.solution);
        if (!/Решено/.test(m) || !/было бы 2 из 2/.test(m)) bad("[фипи-15] эталон на экране — не «Решено» и «2 из 2»: " + m.slice(0, 160));
        if (!g.state.algo["rb-oge-corner"]) bad("[фипи-15] решённая задача не отмечена");
        m = await run("нц пока справа\n");
        if (!/не назвать/.test(m)) bad("[фипи-15] у неразобранной записи на экране не сказано, что балла нет");
        doc.getElementById("rbback").click(); await tick();
      }
      /* экран обязан судить на бесконечном поле, а не только судья */
      g.openRobot("rb-oge-wall", null); await tick();
      if (doc.getElementById("rbcode")){
        doc.getElementById("rbcode").value = EDGE;
        doc.getElementById("rbrun").click(); await tick();
        const m = doc.getElementById("rbmsg").textContent;
        if (/Решено/.test(m) || !/бесконечное/.test(m))
          bad("[фипи-15] экран засчитал решение «до края поля» или не объяснил про бесконечное поле: " + m.slice(0, 160));
      }

      /* 6. Экзамен ОГЭ: номер 15 — Робот, судья молчит, балл — в итоге. */
      g.state.algo = {}; g.state.variant = {};
      g.screenVariant(); await tick();
      const tabO = doc.querySelector('[data-vtab="oge"]');
      if (tabO){ tabO.click(); await tick(); }
      const start = doc.querySelector('[data-vexam="30"]');
      if (!start) bad("[фипи-15] нет режима экзамена на вкладке ОГЭ");
      else {
        start.click(); await tick();
        const v = g.state.variant.oge;
        const it = v.items.find(x => x.n === 15);
        it.id = "rb-oge-corner";
        g.screenVariant(); await tick();
        const go = doc.querySelector('[data-vgo="15"]');
        if (!go) bad("[фипи-15] номер 15 в экзамене ОГЭ не открывается");
        else {
          if (!/Угол двух стен/.test(go.closest(".exrow").textContent)) bad("[фипи-15] в строке номера 15 не названа задача Робота");
          go.click(); await tick();
          if (!doc.getElementById("rbcode")) bad("[фипи-15] номер 15 открыл не экран Робота");
          if (doc.querySelector(".rbhints")) bad("[фипи-15] на экзамене у Робота есть подсказки");
          if (!doc.getElementById("rbclock")) bad("[фипи-15] на экзамене у Робота нет часов");
          if (!doc.getElementById("rbsend")) { bad("[фипи-15] на экзамене у Робота нет кнопки «Сдать ответ»"); }
          else {
          doc.getElementById("rbcode").value = tc.solution;
          doc.getElementById("rbrun").click(); await tick();
          if (/Решено|из 2/.test(doc.getElementById("app").textContent)) bad("[фипи-15] запуск на экзамене выдал вердикт или балл");
          doc.getElementById("rbcode").value = "вверх\n";
          doc.getElementById("rbsend").click(); await tick();
          const badMsg = doc.getElementById("rbmsg").textContent;
          doc.getElementById("rbcode").value = "закрасить\n" + tc.solution;
          doc.getElementById("rbsend").click(); await tick();
          const okMsg = doc.getElementById("rbmsg").textContent;
          if (!/записан/.test(okMsg)) bad("[фипи-15] сдача на экзамене не сказала «ответ записан»");
          if (badMsg !== okMsg) bad("[фипи-15] сданные верный и неверный ответы отвечают по-разному");
          if (/из 2/.test(okMsg)) bad("[фипи-15] на экзамене показан балл Робота");
          const p = (g.state.variant.oge.pts || {})[15];
          if (!p || p.s !== 1) bad("[фипи-15] балл Робота не записан в экзамене: " + JSON.stringify(p));
          if (g.state.algo["rb-oge-corner"]) bad("[фипи-15] задача экзамена сразу отмечена решённой — вердикт утёк");
          doc.getElementById("rbback").click(); await tick();
          if (!/Вариант|Экзамен/.test(doc.getElementById("app").textContent)) bad("[фипи-15] из задачи экзамена не вернулись в вариант");
          g.state.variant.oge.endAt = Date.now() - 1000;
          g.screenVariant(); await tick();
          const txt = doc.getElementById("app").textContent;
          if (!/Задание 15 — как оценил бы эксперт/.test(txt) || !/1 из 2 баллов/.test(txt))
            bad("[фипи-15] итог экзамена ОГЭ не показал балл за Робота");
          if (!/Задание 16 — как оценил бы эксперт/.test(txt)) bad("[фипи-15] итог потерял карточку задания 16");
          if (/первичный балл|из 4 баллов|из 100/.test(txt)) bad("[фипи-15] итог сложил баллы двух заданий");
          }
        }
      }
    }
    g.state.algo = {}; g.state.variant = {};
    viewReset(g);
  }

  /* --- 13г. [проверка] «что умеет сам» (js/proverka.js) ---
     Обещания, которые здесь стерегутся, — ровно те, на которых проверка
     продаётся взрослому: код открывает ТОТ ЖЕ итог где угодно; код с опечаткой
     не открывает чужой; старый код через год открывается тем же итогом
     (лестница заморожена); вставленный код не выдаётся за «сам»; проверка
     кончается сама после двух нерешённых подряд. */
  if (g.proverka && w.HW){
    const p0 = problems.length;
    const P = g.proverka;
    const ref = t => w.HW.byId(t.id).code(t.vals);

    /* 13г.1. ⚠️ Лестница версии 1 заморожена. Поменял состав — старые коды
       молча откроют другие задачи. Нужна другая лестница — заводи версию 2. */
    const SNAP = "hw-klass,hw-konfety|hw-chek,hw-slovo|hw-bilet|hw-summa-do,hw-tablica,hw-lesenka|" +
      "hw-kopilka,hw-pervoe|hw-ocenki,hw-spisok-rastet,hw-top|hw-funkciya,hw-fn-skidka|" +
      "hw-dnevnik,hw-korzina,hw-glasnye|hw-try,hw-raise|hw-score,hw-class";
    const now = P.RUNGS.map(r => r.pool.join(",")).join("|");
    if (now !== SNAP) bad("[проверка] лестница версии 1 изменена — старые коды откроют чужие задачи: " + now);

    /* 13г.2. Каждая ступень собирается на любом семени, заготовка не решает её сама. */
    for (let s = 0; s < 40; s++){
      const seed = (s * 26189 + 7) % 1048576;
      P.RUNGS.forEach((r, i) => {
        const t = P.taskOf(seed, i);
        if (!t) return bad(`[проверка] ступень ${i + 1} не собралась на семени ${seed}`);
        const st = w.MiniPy.run(t.starter, { stdin: [] });
        if (!st.error && (st.lines || []).join("\n") === t.lines.join("\n"))
          bad(`[проверка] ступень ${i + 1} (${t.id}): заготовка сама даёт правильный ответ`);
      });
    }

    /* 13г.3. Код туда и обратно — без потерь; опечатка ловится. */
    let rnd = 12345;
    const next = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
    const ABC = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let lost = 0, typos = 0, slipped = 0;
    for (let k = 0; k < 150; k++){
      const res = { day: Math.floor(next() * 4096), seed: Math.floor(next() * 1048576),
                    mins: Math.floor(next() * 64),
                    rungs: P.RUNGS.map(() => ({ st: Math.floor(next() * 4), paste: next() < .3 ? 1 : 0 })) };
      const code = P.pack(res);
      if (!/^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){3}$/.test(code)) bad("[проверка] код не того вида: " + code);
      if (JSON.stringify(P.unpack(code.toLowerCase().replace(/-/g, " "))) !== JSON.stringify(res)) lost++;
      const flat = code.replace(/-/g, "");
      for (let pos = 0; pos < 16; pos += 5){
        const ch = flat[pos], other = ABC[(ABC.indexOf(ch) + 1 + Math.floor(next() * 31)) % 32];
        typos++;
        if (P.unpack(flat.slice(0, pos) + other + flat.slice(pos + 1))) slipped++;
      }
    }
    if (lost) bad(`[проверка] ${lost} кодов из 150 после разбора дали не тот итог`);
    if (slipped > typos * 0.01)
      bad(`[проверка] код с опечаткой открылся ${slipped} раз из ${typos} — взрослый увидит чужой итог`);
    if (P.unpack("2222-2222-2222-2222") || P.unpack("") || P.unpack("ABCD-EFGH"))
      bad("[проверка] негодный код открыл итог");

    /* 13г.4. Весь проход нажатиями: первая ступень с первой попытки, вторая с
       третьей, третья пропущена, четвёртая провалена — и проверка кончается
       сама, потому что две ступени подряд не решены. */
    g.state.proverka = {};
    g.screenProverka(); await tick();
    const go = doc.getElementById("prvgo");
    if (!go) bad("[проверка] на входе нет кнопки «Начать проверку»");
    else {
      go.click(); await tick();
      const p = g.state.proverka;
      if (!p || p.i !== 0 || p.closed) bad("[проверка] проверка не началась");
      const submit = async (code) => {
        const st = studioOf();
        if (!st) return bad("[проверка] на ступени нет редактора");
        st.editor.setCode(code);
        st.querySelector('[data-role="check"]').click();
        await tick();
      };
      const t0 = P.taskOf(p.seed, 0);
      /* ⚠️ Совпали числа, не совпало оформление — ступень не сгорает молча,
         судья говорит об оформлении. И это попытка. */
      await submit(t0.lines.map(x => 'print("Ответ: ' + x + '")').join("\n"));
      if (!/Числа верные/.test(msgText())) bad("[проверка] про верные числа в неверном виде не сказано: " + msgText());
      if (/Ответ:\s*\d/.test(msgText()) || msgText().indexOf(t0.lines[0] + "") >= 0 && /нужно|надо/i.test(msgText()))
        bad("[проверка] судья показал правильный вывод — это решение за ребёнка");
      await submit(ref(t0));
      if (g.state.proverka.i !== 1 || g.state.proverka.rungs[0].st !== 2)
        bad("[проверка] верное решение со второй попытки не записано как «со второй»: " +
            JSON.stringify(g.state.proverka.rungs[0]));
      const t1 = P.taskOf(p.seed, 1);
      await submit(ref(t1));
      if (g.state.proverka.rungs[1].st !== 3) bad("[проверка] решение с первой попытки не записано как «с первой»");
      const skip = doc.getElementById("prvskip");
      if (!skip) bad("[проверка] нет кнопки «Не знаю — дальше»");
      else { skip.click(); await tick(); }
      if (g.state.proverka.closed) bad("[проверка] кончилась после ОДНОЙ нерешённой ступени");
      const t3 = P.taskOf(p.seed, 3);
      for (let k = 0; k < 3; k++) await submit(ref(t3) + "\nprint(-777)\n");
      const done = g.state.proverka;
      if (!done.closed) bad("[проверка] после двух нерешённых подряд проверка не закончилась");
      if (done.rungs[3].st !== 1) bad("[проверка] три неверных попытки не дали «не решил»");
      const code = done.code;
      const back = P.unpack(code);
      if (!back || back.seed !== done.seed || back.rungs.map(r => r.st).join("") !== "2311000000")
        bad("[проверка] код итога несёт не то: " + JSON.stringify(back));
      if (w.location.hash !== "#proverka=" + code) bad("[проверка] адрес итога не несёт код: " + w.location.hash);
      const txt = doc.getElementById("app").textContent;
      if (!/Уверенно сам: 2 ступени из 10/.test(txt)) bad("[проверка] итог не назвал две твёрдые ступени");
      if (/\d+\s*балл/i.test(txt)) bad("[проверка] итог обещает баллы");
      if (!/С чего продолжать/.test(txt) || !/Условие/.test(txt)) bad("[проверка] итог не сказал, с чего продолжать");

      /* Дальше всё держится на коде итога; без него — не падаем, а говорим. */
      if (back){
      /* 13г.5. Тот же код на ЧУЖОМ устройстве — тот же итог: без состояния. */
      g.state.proverka = {};
      w.location.hash = "#proverka=" + code.toLowerCase(); await tick(40);
      const txt2 = doc.getElementById("app").textContent;
      if (!/Уверенно сам: 2 ступени из 10/.test(txt2))
        bad("[проверка] по ссылке с кодом на пустом устройстве итог не открылся");

      /* 13г.6. Сравнение двух кодов: у ступени «было → стало». */
      const later = P.pack({ day: back.day + 30, seed: 99, mins: 20,
        rungs: P.RUNGS.map((r, i) => ({ st: i < 4 ? 3 : 0, paste: 0 })) });
      P.screenReport(later, code); await tick();
      const txt3 = doc.getElementById("app").textContent;
      if (!/не решил → сам, с первой попытки/.test(txt3)) bad("[проверка] сравнение не показало «было → стало»");
      if (!/Сейчас: 4 из 10/.test(txt3)) bad("[проверка] сравнение не назвало оба числа");

      /* 13г.7. Кривой код — объяснение, а не чужой итог и не молчание. */
      P.screenReport("AAAA-AAAA-AAAA-AAAB", ""); await tick();
      if (!/Код не открылся/.test(doc.getElementById("app").textContent))
        bad("[проверка] про негодный код ничего не сказано");
      }
    }

    /* 13г.8. ⚠️ Вставленный код не выдаётся за «сам». */
    g.state.proverka = {};
    g.screenProverka(); await tick();
    doc.getElementById("prvgo").click(); await tick();
    {
      const p = g.state.proverka, st = studioOf();
      st.editor.setCode(ref(P.taskOf(p.seed, 0)));
      st.editor.trace.pasted = 120;
      st.querySelector('[data-role="check"]').click(); await tick();
      if (g.state.proverka.rungs[0].paste !== 1) bad("[проверка] вставленный код не отмечен");
      doc.getElementById("prvstop").click(); await tick();
      const txt = doc.getElementById("app").textContent;
      if (!g.state.proverka.closed) bad("[проверка] «Закончить проверку» не закончила её");
      if (!/часть кода вставлена/.test(txt) || /Уверенно сам: 1/.test(txt))
        bad("[проверка] ступень со вставленным кодом засчитана как «сам»");
    }

    /* 13г.9. Слияние двух устройств: та же проверка — побеждает ушедшая дальше. */
    const m = g.mergeProgress({ savedAt:2, proverka:{ v:1, seed:5, at:10, i:3, closed:0, rungs:[] } },
                              { savedAt:1, proverka:{ v:1, seed:5, at:10, i:1, closed:1, rungs:[] } });
    if (!m.proverka || m.proverka.closed !== 1) bad("[проверка] слияние вернуло незакрытую проверку поверх закрытой");

    /* 13г.9б. Итог доезжает до кабинета: карточка по ЛЮБОМУ снимку (у
       репетитора и родителя — чужой) и дверь «Открыть итог», которая
       открывает тот же итог по коду. */
    {
      const code = P.pack({ day: 254, seed: 4242, mins: 12,
        rungs: P.RUNGS.map((r, i) => ({ st: i < 3 ? 3 : (i === 3 ? 1 : 0), paste: 0 })) });
      const snap = { proverka: { v:1, seed:4242, at: Date.UTC(2026, 8, 12), i:4, closed:1, code,
                                 rungs: P.RUNGS.map(() => ({ st:0, paste:0 })) } };
      const html = P.cardHTML(snap);
      if (!/уверенно сам 3 из 10/.test(html) || !/Повтор/.test(html) || html.indexOf(code) < 0)
        bad("[проверка] карточка кабинета не назвала итог по снимку: " + html.replace(/<[^>]+>/g, " ").slice(0, 160));
      if (!/Проверки ещё не было/.test(P.cardHTML({})))
        bad("[проверка] карточка кабинета без проверки молчит, что её не было");
      g.state.proverka = snap.proverka;
      g.screenAdult(); await tick();
      const open = doc.querySelector("[data-prvopen]");
      if (!open) bad("[проверка] в кабинете взрослого нет карточки проверки");
      else {
        open.click(); await tick();
        const txt = doc.getElementById("app").textContent;
        if (!/Уверенно сам: 3 ступени из 10/.test(txt)) bad("[проверка] «Открыть итог» из кабинета не открыл итог");
        if (!/Назад в кабинет/.test(txt)) bad("[проверка] из итога, открытого в кабинете, нет дороги назад в кабинет");
      }
    }

    /* 13г.10. Дверь в «Тренировках». */
    g.screenTrain(); await tick();
    const card = doc.querySelector('[data-train="proverka"]');
    if (!card) bad("[проверка] в «Тренировках» нет карточки проверки");
    else { card.click(); await tick();
      if (!/Проверка|Что умеет сам/.test(doc.getElementById("app").textContent))
        bad("[проверка] карточка в «Тренировках» не открыла проверку"); }

    g.state.proverka = {};
    viewReset(g);
    if (problems.length === p0) proverkaChecked++;
  }

  /* --- 13г2. [проверка-2] вторая лестница: экзамен и HTML (js/proverka.js) ---
     Стережётся то, что отличает её от первой:
       1) лестница версии 2 заморожена слепком, ступеней ровно десять
          (раскладка кода рассчитана на десять);
       2) пулы годные: у задач экзамена — сверка вывода, ввод и скрытые наборы,
          БЕЗ запретов конструкций и бюджета шагов (их правила живут в судье
          раздела, а судья проверки — свой: пул с запретом молча перестал бы
          его проверять); заготовка ступень не решает, эталон решает;
       3) код версии 2 ходит туда и обратно, ловит опечатку и НЕ открывается
          как код первой лестницы (и наоборот);
       4) дорожки независимы: два «не решил» подряд закрывают дорожку, а не
          проверку — после проваленного экзамена HTML всё равно предлагается;
       5) вставленная страница HTML не выдаётся за «сам»;
       6) слияние устройств: побеждает ушедшая дальше; итог первой проверки
          проверкой 2 не затирается;
       7) карточка кабинета называет обе проверки, вход предлагает обе. */
  if (g.proverka && w.HW && w.ALGO && w.WEB_TASKS){
    const p0 = problems.length;
    const P = g.proverka;

    /* 13г2.1. Слепок и строение. */
    const SNAP2 = "oge-range,oge-digit-even|oge-min-even-three-digit,ege-max-remainder|" +
      "oge-pairs,ege-pairs-even,ege-grow|ege-longest-up-run,ege-max-triple-sum|" +
      "text-count,text-longest,text-after|data-avg,data-sum-col,oge-avg-round|" +
      "web-first,web-levels,web-strong|web-ul,web-ol,web-table|" +
      "web-color,web-bg,web-font|web-nav,web-flex,web-center";
    const now2 = P.RUNGS2.map(r => r.pool.join(",")).join("|");
    if (now2 !== SNAP2) bad("[проверка-2] лестница версии 2 изменена — старые коды откроют чужие задачи: " + now2);
    if (P.RUNGS2.length !== 10) bad("[проверка-2] ступеней не десять — раскладка кода рассчитана на десять");
    P.RUNGS2.forEach((r, i) => {
      if (r.kind !== (i <= 5 ? "algo" : "web"))
        bad(`[проверка-2] ступень ${i + 1}: дорожки съехали (kind=${r.kind})`);
    });

    /* 13г2.2. Пулы годные; ступень собирается на любом семени. */
    const R2 = w.Runtime.get("mini");
    const outOf = (code, stdin) => {
      const res = R2.run(code, { stdin: (stdin || []).slice() });
      return res.error ? null : (res.lines || []).join("\n");
    };
    P.RUNGS2.forEach((r, i) => r.pool.forEach(id => {
      if (r.kind === "algo"){
        const x = w.ALGO.find(t => t.id === id);
        if (!x) return bad(`[проверка-2] задачи «${id}» нет в банке экзамена`);
        if (x.check.kind !== "output") bad(`[проверка-2] «${id}»: судья проверки сверяет вывод, а тут ${x.check.kind}`);
        if ((x.ban || []).length || (x.need || []).length || x.budget)
          bad(`[проверка-2] у «${id}» запрет конструкции или бюджет — судья проверки их не проверяет`);
        if (!(x.sets || []).length) bad(`[проверка-2] у «${id}» нет скрытых наборов — print с готовым ответом пройдёт`);
        const exp = outOf(x.solution, x.stdin);
        if (exp === null) bad(`[проверка-2] эталон «${id}» не работает в движке`);
        if (outOf(x.starter, x.stdin) === exp) bad(`[проверка-2] заготовка «${id}» решает ступень сама`);
      } else {
        const x = w.WEB_TASKS.find(t => t.id === id);
        if (!x) return bad(`[проверка-2] задания «${id}» нет в разделе HTML`);
        if (!w.WEB.passed(w.WEB.judge(x, x.solution))) bad(`[проверка-2] эталон «${id}» не проходит судью`);
        if (w.WEB.passed(w.WEB.judge(x, x.starter))) bad(`[проверка-2] заготовка «${id}» проходит сама`);
      }
    }));
    for (let s = 0; s < 40; s++){
      const seed = (s * 26189 + 7) % 1048576;
      P.RUNGS2.forEach((r, i) => {
        if (!P.taskOf2(seed, i)) bad(`[проверка-2] ступень ${i + 1} не собралась на семени ${seed}`);
      });
    }

    /* 13г2.3. Код: круговорот, опечатка, версии не путаются. */
    let rnd2 = 54321;
    const next2 = () => (rnd2 = (rnd2 * 1103515245 + 12345) % 2147483648) / 2147483648;
    const ABC2 = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let lost2 = 0, cross = 0, typos2 = 0, slipped2 = 0;
    for (let k = 0; k < 150; k++){
      const res = { day: Math.floor(next2() * 4096), seed: Math.floor(next2() * 1048576),
                    mins: Math.floor(next2() * 64),
                    rungs: P.RUNGS2.map(() => ({ st: Math.floor(next2() * 4), paste: next2() < .3 ? 1 : 0 })) };
      const code = P.pack2(res);
      if (!/^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){3}$/.test(code)) bad("[проверка-2] код не того вида: " + code);
      if (JSON.stringify(P.unpack2(code)) !== JSON.stringify(res)) lost2++;
      if (P.unpack(code)) cross++;
      const flat = code.replace(/-/g, "");
      for (let pos = 0; pos < 16; pos += 5){
        const ch = flat[pos], other = ABC2[(ABC2.indexOf(ch) + 1 + Math.floor(next2() * 31)) % 32];
        typos2++;
        if (P.unpack2(flat.slice(0, pos) + other + flat.slice(pos + 1))) slipped2++;
      }
    }
    if (lost2) bad(`[проверка-2] ${lost2} кодов из 150 после разбора дали не тот итог`);
    if (cross) bad(`[проверка-2] код второй лестницы ${cross} раз открылся как код первой`);
    if (slipped2 > typos2 * 0.01)
      bad(`[проверка-2] код с опечаткой открылся ${slipped2} раз из ${typos2}`);
    const v1code = P.pack({ day: 9, seed: 9, mins: 9, rungs: P.RUNGS.map(() => ({ st: 1, paste: 0 })) });
    if (P.unpack2(v1code)) bad("[проверка-2] код ПЕРВОЙ лестницы открылся как код второй");

    /* 13г2.4. Проход нажатиями: экзаменная дорожка проваливается после двух
       нерешённых подряд, но проверка НЕ кончается — открывается дорожка HTML;
       вставленная страница отмечается; конец лестницы даёт код и отчёт по
       двум дорожкам. */
    g.state.proverka = {}; g.state.proverka2 = {};
    g.screenProverka(); await tick();
    const go2 = doc.getElementById("prvgo2");
    if (!doc.getElementById("prvgo")) bad("[проверка-2] с входа пропала кнопка первой проверки");
    if (!go2) bad("[проверка-2] на входе нет кнопки «Начать проверку 2»");
    else {
      go2.click(); await tick();
      const p = g.state.proverka2;
      if (!p || p.i !== 0 || p.closed) bad("[проверка-2] проверка 2 не началась");
      const submitAlgo = async (code) => {
        const st = studioOf();
        if (!st) return bad("[проверка-2] на ступени экзамена нет редактора");
        st.editor.setCode(code);
        st.querySelector('[data-role="check"]').click();
        await tick();
      };
      const x0 = P.taskOf2(p.seed, 0);
      /* Жульничество: печать готового ответа открытого примера. Открытый
         прогон совпадает — завалить его обязаны СКРЫТЫЕ наборы. */
      const exp0 = R2.run(x0.solution, { stdin: (x0.stdin || []).slice() }).lines;
      await submitAlgo(exp0.map(l => "print(" + JSON.stringify(String(l)) + ")").join("\n"));
      if (g.state.proverka2.rungs[0].st) bad("[проверка-2] печать готового ответа засчитана — скрытые наборы не гоняются");
      if (!/скрытых данных/i.test(msgText())) bad("[проверка-2] про скрытые наборы не сказано: " + msgText());
      await submitAlgo(x0.solution);
      if (g.state.proverka2.i !== 1 || g.state.proverka2.rungs[0].st !== 2)
        bad("[проверка-2] эталон со второй попытки не записан как «со второй»: " + JSON.stringify(g.state.proverka2.rungs[0]));
      doc.getElementById("prvskip").click(); await tick();
      if (g.state.proverka2.closed) bad("[проверка-2] проверка кончилась после ОДНОЙ нерешённой");
      doc.getElementById("prvskip").click(); await tick();
      if (g.state.proverka2.closed) bad("[проверка-2] две нерешённые в дорожке закончили ВСЮ проверку, а не дорожку");
      if (g.state.proverka2.i !== 6)
        bad("[проверка-2] после двух нерешённых подряд дорожка экзамена не закрылась: i=" + g.state.proverka2.i);
      if (!doc.getElementById("prvweb")) bad("[проверка-2] дорожка HTML не открылась после экзаменационной");
      else {
        const x6 = P.taskOf2(p.seed, 6);
        const ta6 = doc.getElementById("prvweb");
        ta6.value = x6.solution; ta6._pasted = 500;
        doc.getElementById("prvwebcheck").click(); await tick();
        if (g.state.proverka2.rungs[6].st !== 3) bad("[проверка-2] решённая страница не записана «с первой»");
        if (g.state.proverka2.rungs[6].paste !== 1) bad("[проверка-2] ВСТАВЛЕННАЯ страница не отмечена вставкой");
        const x7 = P.taskOf2(p.seed, 7);
        const ta7 = doc.getElementById("prvweb");
        ta7.value = x7.starter;
        doc.getElementById("prvwebcheck").click(); await tick();
        if (!doc.querySelector("#prvchecks li.bad"))
          bad("[проверка-2] после неудачной сдачи страницы не отмечено, чего не хватает");
        const ta7b = doc.getElementById("prvweb");
        ta7b.value = x7.solution;
        doc.getElementById("prvwebcheck").click(); await tick();
        if (g.state.proverka2.rungs[7].st !== 2 || g.state.proverka2.rungs[7].paste)
          bad("[проверка-2] набранная страница записана неверно: " + JSON.stringify(g.state.proverka2.rungs[7]));
        doc.getElementById("prvskip").click(); await tick();
        doc.getElementById("prvskip").click(); await tick();
      }
      const done = g.state.proverka2;
      if (!done.closed) bad("[проверка-2] лестница кончилась, а проверка не закрылась");
      const back = P.unpack2(done.code);
      if (!back || back.rungs.map(r => r.st).join("") !== "2110003211")
        bad("[проверка-2] код итога несёт не то: " + (back ? back.rungs.map(r => r.st).join("") : "не разобрался"));
      if (back){
        if (back.rungs[6].paste !== 1) bad("[проверка-2] вставка потерялась в коде итога");
        if (w.location.hash !== "#proverka=" + done.code) bad("[проверка-2] адрес итога не несёт код");
        const txt = doc.getElementById("app").textContent;
        if (!/Задачи экзамена: уверенно сам 1 ступень из 6/.test(txt))
          bad("[проверка-2] итог не назвал твёрдые ступени дорожки экзамена");
        if (!/HTML: твёрдых ступеней пока нет/.test(txt))
          bad("[проверка-2] вставленная страница вошла в «уверенно сам» дорожки HTML");
        if (!/решение пришло вставкой/.test(txt)) bad("[проверка-2] итог молчит о вставке");
        if (/\d+\s*балл/i.test(txt)) bad("[проверка-2] итог обещает баллы");
        if (!/С чего продолжать/.test(txt)) bad("[проверка-2] итог не сказал, с чего продолжать");

        /* 13г2.5. Тот же код на чужом устройстве — тот же итог. */
        g.state.proverka2 = {};
        w.location.hash = "#proverka=" + done.code.toLowerCase(); await tick(40);
        if (!/Задачи экзамена: уверенно сам 1 ступень из 6/.test(doc.getElementById("app").textContent))
          bad("[проверка-2] по ссылке с кодом на пустом устройстве итог не открылся");

        /* 13г2.6. Сравнение: два кода проверки 2 дают «было → стало», а код
           первой проверки в этом поле честно отвергается. */
        const later2 = P.pack2({ day: back.day + 30, seed: 99, mins: 20,
          rungs: P.RUNGS2.map(() => ({ st: 3, paste: 0 })) });
        P.screenReport(later2, done.code); await tick();
        const txt3 = doc.getElementById("app").textContent;
        if (!/не решил → сам, с первой попытки/.test(txt3)) bad("[проверка-2] сравнение не показало «было → стало»");
        if (!/Сейчас: 6 из 6/.test(txt3)) bad("[проверка-2] сравнение не назвало оба числа дорожки");
        const pf = doc.getElementById("prvprev");
        pf.value = v1code;
        doc.getElementById("prvcmp").click(); await tick();
        if (!/код первой проверки/.test(doc.getElementById("prvcmpmsg").textContent))
          bad("[проверка-2] код первой лестницы в сравнении не отвергнут словами");
      }
    }

    /* 13г2.7. Слияние: побеждает ушедшая дальше; итог первой не затирается. */
    const m2 = g.mergeProgress({ savedAt:2, proverka2:{ v:2, seed:5, at:10, i:3, closed:0, rungs:[] } },
                               { savedAt:1, proverka2:{ v:2, seed:5, at:10, i:1, closed:1, rungs:[] } });
    if (!m2.proverka2 || m2.proverka2.closed !== 1)
      bad("[проверка-2] слияние вернуло незакрытую проверку 2 поверх закрытой");
    const m3 = g.mergeProgress(
      { savedAt:2, proverka:{ v:1, seed:7, at:9, i:10, closed:1, rungs:[] },
        proverka2:{ v:2, seed:5, at:10, i:3, closed:0, rungs:[] } },
      { savedAt:1 });
    if (!m3.proverka || m3.proverka.closed !== 1) bad("[проверка-2] проверка 2 затёрла итог первой при слиянии");

    /* 13г2.8. Карточка кабинета называет ОБЕ проверки по снимку. */
    {
      const code1 = P.pack({ day: 254, seed: 4242, mins: 12,
        rungs: P.RUNGS.map((r, i) => ({ st: i < 3 ? 3 : (i === 3 ? 1 : 0), paste: 0 })) });
      const code2 = P.pack2({ day: 256, seed: 777, mins: 15,
        rungs: P.RUNGS2.map((r, i) => ({ st: i < 2 ? 3 : (i === 2 ? 1 : 0), paste: 0 })) });
      const snap = {
        proverka:  { v:1, seed:4242, at: Date.UTC(2026, 8, 12), i:10, closed:1, code: code1,
                     rungs: P.RUNGS.map(() => ({ st:0, paste:0 })) },
        proverka2: { v:2, seed:777, at: Date.UTC(2026, 8, 14), i:10, closed:1, code: code2,
                     rungs: P.RUNGS2.map(() => ({ st:0, paste:0 })) } };
      const html = P.cardHTML(snap);
      if (!/уверенно сам 3 из 10/.test(html)) bad("[проверка-2] карточка кабинета потеряла итог первой проверки");
      if (!/Проверка 2/.test(html) || html.indexOf(code2) < 0)
        bad("[проверка-2] карточка кабинета молчит о проверке 2");
      if (!/Задачи экзамена — 2 из 6/.test(html) || !/HTML — 0 из 4/.test(html))
        bad("[проверка-2] карточка кабинета не назвала итог по дорожкам: " + html.replace(/<[^>]+>/g, " ").slice(0, 300));
    }

    g.state.proverka = {}; g.state.proverka2 = {};
    viewReset(g);
    if (problems.length === p0) proverka2Checked++;
  }

  /* --- 13д. [защита-кода] вопросы по своей программе (js/screens-zashchita.js) ---
     Обещания, на которых стоит экран:
       1) у эталонов всех 11 проектов и 20 уроков, взятых вслепую, хоть один
          посчитанный вопрос — механизм не молчит на длинном выводе и input()
          (правило § 4.30: соседний myPredRun молчал бы);
       2) ответ совпадает с независимым прогоном — считаем его здесь ЗАНОВО,
          не через модуль: другое число вставляем сами, цикл считаем шагами,
          переменную печатаем вставленной строкой;
       3) неисполнимая программа получает честное «почему», а не пустоту;
       4) ребёнку ответы спрятаны, взрослому видны; слова «доказал» и
          «списал» нет, а «не доказательство, а повод поговорить» — есть. */
  if (g.zashchita && w.MiniPy){
    const p0 = problems.length;
    const Z = g.zashchita, R = w.Runtime.get("mini"), MP = w.MiniPy;
    const runOut = (code, stdin) => {
      const r = R.run(code, { stdin: (stdin || []).slice() });
      return r.error || r.awaitingInput ? null : String(r.output || "").replace(/\n+$/, "");
    };
    /* ответ вопроса — заново, своим способом */
    const recount = (code, stdin, q) => {
      if (q.kind === "mut"){
        if (code.slice(q.at, q.at + String(q.from).length) !== String(q.from)) return { bad: "число не на своём месте" };
        const was = runOut(code, stdin), out = runOut(code.slice(0, q.at) + q.to + code.slice(q.at + String(q.from).length), stdin);
        if (out === null) return { bad: "изменённая программа не работает" };
        if (out === was) return { bad: "изменённая программа печатает то же самое — вопрос ничего не проверяет" };
        return { a: q.row !== undefined ? out.split("\n")[q.row] : out };
      }
      if (q.kind === "loop"){
        /* счётчик вставлен в саму программу перед первой строкой тела: шаги
           движка тут не годятся — lambda в той же строке даёт лишние шаги */
        const ls = code.split("\n"), ind = (ls[q.bodyLine - 1].match(/^[ \t]*/) || [""])[0];
        ls.splice(q.bodyLine - 1, 0, ind + "ZQN[0] += 1");
        const out = runOut("ZQN = [0]\n" + ls.join("\n") + "\nprint(\"@@zq\", ZQN[0])", stdin);
        const m = out === null ? null : /@@zq (\d+)\s*$/.exec(out);
        return m ? { a: m[1] } : { bad: "не удалось вставить счётчик цикла" };
      }
      if (q.kind === "var"){
        const ls = code.split("\n"), ind = (ls[q.line - 1].match(/^[ \t]*/) || [""])[0];
        ls.splice(q.line, 0, ind + 'print("@@zq", repr(' + q.name + '))');
        const out = runOut(ls.join("\n"), stdin);
        if (out === null) return { bad: "не удалось вставить печать переменной" };
        /* подсказка input() печатается без перевода строки — метку ищем внутри строки */
        const hits = out.split("\n").filter(x => x.indexOf("@@zq ") >= 0).map(x => x.slice(x.indexOf("@@zq ") + 5));
        if (hits.length !== q.times) return { bad: "строка выполнилась " + hits.length + " раз, а в вопросе " + q.times };
        return { a: hits[hits.length - 1] };
      }
      return { bad: "неизвестный вид вопроса " + q.kind };
    };
    const verify = (label, code, stdin) => {
      const m = Z.make(code, (stdin || []).join("\n"));
      if (!m.ok){ bad("[защита-кода] у «" + label + "» ни одного вопроса: " + m.title + " — " + m.text); return 0; }
      m.qs.forEach(q => {
        if (q.kind === "var" && q.a.charAt(0) === "<")
          bad("[защита-кода] «" + label + "»: спрошен объект — у python3 в его записи адрес памяти: " + q.a);
        const r = recount(code, stdin, q);
        if (r.bad) bad("[защита-кода] «" + label + "», вопрос «" + q.q + "»: " + r.bad);
        else if (r.a !== q.a) bad("[защита-кода] «" + label + "», вопрос «" + q.q + "»: ответ " + JSON.stringify(q.a) +
                                  ", а прогон даёт " + JSON.stringify(r.a));
      });
      return m.qs.length;
    };

    /* 13д.1. все проекты */
    const PR = w.PROJECTS || [];
    if (PR.length !== 11) bad("[защита-кода] проектов не 11: " + PR.length);
    PR.forEach(p => { const l = p.steps[p.steps.length - 1]; verify("проект " + p.title, l.solution, l.stdin || []); });

    /* 13д.2. двадцать уроков вслепую. Предусловие не зависит от модуля:
       эталон работает, не случаен (семена 1 и 2 дают одно), и в нём есть то,
       о чём спрашивают, — целое число в коде или цикл. Выбор — сдвигом от
       фиксированного семени, чтобы прогон не мигал. */
    const pool = [];
    Object.keys(CONTENT).forEach(wk => Object.keys(CONTENT[wk]).forEach(id => {
      const t = (CONTENT[wk][id] || {}).task;
      if (!t || !t.solution || (t.files || []).length) return;
      const stdin = t.stdin || [];
      const o1 = R.run(t.solution, { stdin: stdin.slice(), seed: 1 }), o2 = R.run(t.solution, { stdin: stdin.slice(), seed: 2 });
      if (o1.error || o1.awaitingInput || o1.output !== o2.output) return;
      if (/(^|[^A-Za-z_0-9.])(random|randint|choice|shuffle)(?![A-Za-z_0-9])/.test(t.solution)) return;
      /* число спрашивается только через вывод: у рисунка черепашки чисел много, а печатать нечего */
      const hasNum = String(o1.output || "").trim() && /(^|[^A-Za-z_0-9.])\d+/.test(g.codeSkeleton(t.solution));
      if (!hasNum && !/(^|\n)[ \t]*(for|while)[ \t(]/.test(t.solution)) return;
      pool.push({ id, code: t.solution, stdin });
    }));
    let seed = 20260913;
    const pick = pool.map(x => { seed = (seed * 1103515245 + 12345) % 2147483648; return { x, k: seed }; })
                     .sort((a, b) => a.k - b.k).slice(0, 20).map(y => y.x);
    if (pick.length < 20) bad("[защита-кода] годных уроков для выборки меньше 20: " + pick.length);
    pick.forEach(x => verify("урок " + x.id, x.code, x.stdin));

    /* 13д.3. неисполнимое — честно и по делу */
    [["ввод без ответов", "name = input()\nprint(name * 2)", /ввод/i],
     ["случайность", "import random\nprint(random.randint(1, 6))", /случайн/i],
     ["ошибка", "x = 10\nprint(x / 0)", /ошибк/i],
     ["не разобрал", "x = = 1\nprint(x)", /не разобрал/i],
     ["файл", "f = open(\"оценки.txt\")\nprint(f.read())", /файл/i],
     ["нечего спросить", "print(\"привет\")", /нечего/i],
     ["пусто", "   ", /нет/i]].forEach(([k, code, re]) => {
      const m = Z.make(code, "");
      if (m.ok) bad("[защита-кода] «" + k + "»: неисполнимая программа получила вопросы");
      else if (!re.test(m.title + " " + m.text) || String(m.text).trim().length < 20)
        bad("[защита-кода] «" + k + "»: отказ не объясняет причину: " + m.title + " — " + m.text);
    });
    /* 13д.3а. три ловушки, найденные этой же проверкой 13.09.2026 */
    { /* lambda в строке тела: движок даёт шаг на каждый её вызов */
      const c1 = "nums = [5, 2, 8]\nfor i in range(3):\n    top = sorted(nums, key=lambda v: -v)[0]\nprint(top + i)";
      const m1 = Z.make(c1, "");
      const lq = m1.ok && m1.qs.find(q => q.kind === "loop");
      if (!lq || lq.a !== "3") bad("[защита-кода] lambda в теле цикла сбила счёт: " + (lq ? lq.a : "вопроса нет"));
      verify("lambda в цикле", c1, []);
      /* try: строка могла начаться и не закончиться */
      const c2 = "total = 0\nfor a in [\"1\", \"x\", \"2\", \"y\"]:\n    try:\n        total += int(a)\n    except ValueError:\n        pass\nprint(total)";
      const m2 = Z.make(c2, "");
      if (m2.ok && m2.qs.some(q => q.kind === "var" && q.line === 4)) bad("[защита-кода] спрошена переменная внутри try — там строка прерывается исключением");
      verify("try в цикле", c2, []);
      /* объект: адрес памяти вместо ответа */
      const c3 = "class T:\n    pass\nt = T()\nx = 5 + 2\nprint(x)";
      const m3 = Z.make(c3, "");
      if (m3.ok && m3.qs.some(q => q.kind === "var" && q.name === "t")) bad("[защита-кода] спрошен объект — ответить на это нечем");
    }
    /* ответы на input() из поля — считаются */
    { const m = Z.make("n = int(input())\nfor i in range(n):\n    print(i * 3)", "4");
      if (!m.ok || !m.qs.some(q => q.kind === "loop" && q.a === "4")) bad("[защита-кода] ответы на input() из поля не учтены"); }

    /* 13д.4. экран: ученик */
    const kidCode = "total = 0\nfor i in range(5):\n    total += i * 2\nprint(total)";
    g.screenZashchita({ mode: "kid", code: kidCode, stdin: [] }); await tick();
    const app = () => doc.getElementById("app");
    if (w.location.hash !== "#zashchita") bad("[защита-кода] у экрана нет своего адреса: «" + w.location.hash + "»");
    const kidM = Z.make(kidCode, "");
    const inputs = [...doc.querySelectorAll("[data-zqa]")];
    if (!kidM.ok || inputs.length !== kidM.qs.length) bad("[защита-кода] у ученика полей ответа " + inputs.length + ", а вопросов " + (kidM.qs || []).length);
    if (doc.querySelector("#zqout .docans")) bad("[защита-кода] ребёнку ответы видны до проверки");
    const ckb = doc.getElementById("zqcheck");
    if (!ckb) bad("[защита-кода] у ученика нет кнопки «Проверить ответы»");
    else {
      inputs.forEach((el, i) => { el.value = kidM.qs[i].a; });
      ckb.click(); await tick();
      if (!/Понял свою программу/.test(app().textContent)) bad("[защита-кода] верные ответы не дали «Понял свою программу»");
      doc.querySelectorAll("[data-zqa]").forEach(el => { el.value = "не знаю"; });
      doc.getElementById("zqcheck").click(); await tick();
      if (!/Стоит разобрать/.test(app().textContent)) bad("[защита-кода] неверные ответы не дали «Стоит разобрать»");
      if (doc.querySelector("#zqout .docans")) bad("[защита-кода] после проверки ответы показаны без просьбы");
      const rv = doc.getElementById("zqreveal");
      if (!rv) bad("[защита-кода] после проверки нельзя посмотреть ответы");
      else { rv.click(); await tick();
        if (doc.querySelectorAll("#zqout .docans").length !== kidM.qs.length) bad("[защита-кода] «Показать ответы» показал не все ответы"); }
    }
    const kt = app().textContent;
    if (!/не доказательство/.test(kt) || !/повод поговорить/.test(kt)) bad("[защита-кода] на экране не сказано «не доказательство, а повод поговорить»");
    if (/списал|доказал/i.test(kt)) bad("[защита-кода] на экране слово «списал» или «доказал»");
    if (!/не весь Python/.test(kt)) bad("[защита-кода] экран не говорит, что движок исполняет не весь Python");

    /* 13д.5. экран: взрослый видит ответы и печатает */
    doc.querySelector('[data-zqmode="adult"]').click(); await tick();
    if (doc.querySelectorAll("#zqout .docans").length !== kidM.qs.length) bad("[защита-кода] взрослому видны не все ответы");
    const prb = doc.getElementById("zqprint");
    if (!prb) bad("[защита-кода] у взрослого нет листа на печать");
    else { prb.click(); await tick();
      const box = doc.getElementById("docbox"), lay = doc.getElementById("doc");
      if (!box || box.innerHTML.indexOf("docpage") < 0 || (lay && lay.hidden)) bad("[защита-кода] лист на печать не открылся");
      else if ((box.innerHTML.match(/class="docans"/g) || []).length !== kidM.qs.length) bad("[защита-кода] на листе не все ответы");
      if (lay) lay.hidden = true; }

    /* 13д.5а. заголовок называет настоящее число вопросов (§ 4.35): у
       программы без целых чисел вопроса «замени число» нет, и «три вопроса»
       было бы обещанием, которого нет */
    { const c2 = "names = [\"Аня\", \"Боря\", \"Вера\"]\nlongest = \"\"\nfor name in names:\n    if len(name) > len(longest):\n        longest = name\nprint(longest)";
      const m2 = Z.make(c2, "");
      g.screenZashchita({ mode: "kid", code: c2, stdin: [] }); await tick();
      const h3 = (doc.querySelector("#zqout h3") || {}).textContent || "";
      if (!m2.ok || m2.qs.length === 3 || h3.indexOf(String(m2.qs.length) + " вопрос") < 0)
        bad("[защита-кода] заголовок не называет настоящее число вопросов: «" + h3 + "», вопросов " + (m2.qs || []).length); }

    /* 13д.6. неисполнимая программа на экране — сообщение, а не пустота */
    g.screenZashchita({ mode: "kid", code: "name = input()\nprint(name)", stdin: [] }); await tick();
    const why = doc.querySelector("#zqout .zqwhy");
    if (!why || why.textContent.trim().length < 30) bad("[защита-кода] неисполнимая программа на экране — пустое место");

    /* 13д.7. двери */
    g.screenTrain(); await tick();
    const tc = doc.querySelector('[data-train="zashchita"]');
    if (!tc) bad("[защита-кода] в «Тренировках» нет карточки");
    else { tc.click(); await tick();
      if (!doc.getElementById("zqcode")) bad("[защита-кода] карточка «Тренировок» не открыла экран"); }
    g.screenAdult(); await tick();
    const ad = doc.querySelector("[data-zqopen]");
    if (!ad) bad("[защита-кода] в кабинете взрослого нет карточки");
    else { ad.click(); await tick();
      if (!doc.querySelector('[data-zqmode="adult"].on')) bad("[защита-кода] дверь из кабинета открыла не режим взрослого"); }
    const rep = fs.readFileSync(path.join(__dirname, "..", "repetitoru", "index.html"), "utf8");
    if (!/href="\.\.\/#zashchita"/.test(rep)) bad("[защита-кода] на /repetitoru/ нет двери в защиту");

    /* 13д.8. собранный проект — в списке «взять из проекта», с ответами на input() */
    { const projБыл = JSON.parse(JSON.stringify(g.state.projects || {}));
      const pg = PR.find(p => (p.steps[p.steps.length - 1].stdin || []).length);
      g.state.projects[pg.id] = { step: pg.steps.length, done: 1, doneAt: 5000, code: pg.steps[pg.steps.length - 1].solution };
      const src = g.zqSources().find(x => x.from.indexOf(pg.title) >= 0);
      if (!src) bad("[защита-кода] собранного проекта нет среди программ «взять из проекта»");
      else if (!src.stdin.length || !Z.make(src.code, src.stdin.join("\n")).ok) bad("[защита-кода] проект из списка пришёл без ответов на input()");
      g.state.projects = projБыл; }

    viewReset(g);
    if (problems.length === p0) zqChecked++;
  }

  /* --- 14. чему движок научился --- */
  if (w.MiniPy){
    const p0 = problems.length;
    const MP = w.MiniPy;
    const ok = (code) => { const r = MP.run(code, { stdin: [] }); return r.error ? null : r.output.trim(); };

    /* ⚠️ Это не дубль сверки с python3 (та живёт в tests/engine-vs-python.js и
       гоняет настоящий интерпретатор). Здесь — страховка от того, что кто-то
       выкинет возможность движка, на которой держится раздел курса: сборка
       соберётся, тесты уроков пройдут, а половина заданий тихо умрёт. */
    const need = [
      ["системы счисления", 'print(int("ff", 16), bin(5), oct(8), hex(255))', "255 0b101 0o10 0xff"],
      ["divmod и pow", "print(divmod(7, 2), pow(2, 10))", "(3, 1) 1024"],
      ["partition", 'print("a=b".partition("="))', "('a', '=', 'b')"],
      ["for ... else", "for x in [1]:\n    pass\nelse:\n    print('прошли')", "прошли"],
      ["for ... else с break", "for x in [1]:\n    break\nelse:\n    print('сюда нельзя')\nprint('после')", "после"],
      ["nonlocal", "def o():\n    n = 1\n    def i():\n        nonlocal n\n        n = 2\n    i()\n    return n\nprint(o())", "2"],
      ["property", "class T:\n    @property\n    def x(self): return 5\nprint(T().x)", "5"],
      ["staticmethod", "class T:\n    @staticmethod\n    def g(a): return a + 1\nprint(T.g(1))", "2"],
      ["classmethod", "class T:\n    n = 7\n    @classmethod\n    def g(cls): return cls.n\nprint(T.g())", "7"],
      ["__add__", "class M:\n    def __init__(s, v): s.v = v\n    def __add__(s, o): return M(s.v + o.v)\nprint((M(1) + M(2)).v)", "3"],
      ["__len__", "class B:\n    def __len__(s): return 3\nprint(len(B()))", "3"],
      ["__getitem__", "class R:\n    def __getitem__(s, i): return i * 2\nprint(R()[4])", "8"],
      ["__contains__", "class G:\n    def __contains__(s, v): return v == 1\nprint(1 in G(), 2 in G())", "True False"],
      ["распаковка со звездой", "a, *rest = [1, 2, 3]\nprint(a, rest)", "1 [2, 3]"]
    ];
    need.forEach(([name, code, want]) => {
      const got = ok(code);
      if (got === null) bad("[движок] «" + name + "» перестало работать вовсе");
      else if (got !== want)
        bad("[движок] «" + name + "» отвечает «" + got + "» вместо «" + want + "»");
    });

    /* ⚠️ И обратное: чего движок НЕ умеет, он обязан честно об этом сказать,
       а не сделать «примерно». Множественное наследование сюда и не бралось:
       порядок разрешения методов молча разошёлся бы с настоящим Python. */
    const mustFail = [
      ["множественное наследование",
       "class A:\n    def hi(s): return 1\nclass B:\n    def bye(s): return 2\nclass C(A, B):\n    pass\nprint(C().bye())"],
      ["две звёздочки в присваивании", "a, *b, *c = [1, 2, 3]\nprint(a)"],
      ["одинокая звёздочка", "*a = [1, 2]\nprint(a)"]
    ];
    mustFail.forEach(([name, code]) => {
      if (MP.run(code, { stdin: [] }).error === null || MP.run(code, { stdin: [] }).error === undefined)
        bad("[движок] «" + name + "» молча сработало, хотя движок этого не умеет");
    });

    if (problems.length === p0) engineChecked++;
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
  console.log(`вход: сначала урок, имя после победы: ${entryChecked ? "да" : "нет"}`);
  console.log(`HTML из вывода — страницей, в запертой рамке: ${pageChecked ? "да" : "нет"}`);
  console.log(`раздел «HTML и CSS»: эталоны, заготовки, примеры, экран: ${webChecked ? "да" : "нет"}`);
  console.log(`пакет к защите: 5 документов × все проекты, даты шагов, слияние, без ПДн: ${defChecked ? "да" : "нет"}`);
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
  console.log(`домашка от репетитора: ${hwChecked ? "да" : "нет"}`);
  console.log(`отчёт родителю текстом и вопросы: ${reportChecked ? "да" : "нет"}`);
  console.log(`лестница выхода из затыка: ${ladderChecked ? "да" : "нет"}`);
  console.log(`заметка репетитора к уроку: ${noteChecked ? "да" : "нет"}`);
  console.log(`кабинеты: место отдельно от роли: ${roomChecked ? "да" : "нет"}`);
  console.log(`кабинет на вкладках: панель, карточка ученика, без дублей: ${dashChecked ? "да" : "нет"}`);
  console.log(`возвращаемость: метрики и крючки: ${returnChecked ? "да" : "нет"}`);
  console.log(`присутствие и живое занятие: ${liveChecked ? "да" : "нет"}`);
  console.log(`клавиатура планшета: ${kbChecked ? "да" : "нет"}`);
  console.log(`время в минутах и секундах: ${timeFmtChecked ? "да" : "нет"}`);
  console.log(`«домой» по роли: ${homeChecked ? "да" : "нет"}`);
  console.log(`игра по ссылке: ${playChecked ? "да" : "нет"}`);
  console.log(`самоизмерение длины занятия: ${statChecked ? "да" : "нет"}`);
  console.log(`перерыв и потолок дня: ${breakChecked ? "да" : "нет"}`);
  console.log(`запись авторства («как шла работа»): ${authorChecked ? "да" : "нет"}`);
  console.log(`проверка понимания на своём коде: ${myPredChecked ? "да" : "нет"}`);
  console.log(`экзамен по своей программе: ${myExamChecked ? "да" : "нет"}`);
  console.log(`мастерская (полка деталей и верстак): ${shopChecked ? "да" : "нет"}`);
  console.log(`обратное направление (задача взрослому): ${backChecked ? "да" : "нет"}`);
  console.log(`витрина «что создают ученики»: ${showChecked ? "да" : "нет"}`);
  console.log(`группа (рабочее место репетитора): ${groupChecked ? "да" : "нет"}`);
  console.log(`нотация приёмки: ${specChecked ? "да" : "нет"}`);
  console.log(`упаковка раздела «Ты и ИИ»: ${aiPackChecked ? "да" : "нет"}`);
  console.log(`витрина проектов: ${showcaseChecked ? "да" : "нет"}`);
  console.log(`карта пути: ${pathChecked ? "да" : "нет"}`);
  console.log(`выпускной мира: ${gradChecked ? "да" : "нет"}`);
  console.log(`свой проект с именем: ${workChecked ? "да" : "нет"}`);
  console.log(`двери в «Моё» и из него жмутся: ${foldoorsChecked ? "да" : "нет"}`);
  console.log(`двери на вывеску жмутся: ${aboutdoorsChecked ? "да" : "нет"}`);
  console.log(`двери экзамена жмутся: ${examdoorsChecked ? "да" : "нет"}`);
  console.log(`двери приёмки жмутся: ${specdoorsChecked ? "да" : "нет"}`);
  console.log(`двери проекта жмутся: ${projdoorsChecked ? "да" : "нет"}`);
  console.log(`логотип ведёт на страницу сайта: ${logoChecked ? "да" : "нет"}`);
  console.log(`алгоритмы и формат ОГЭ: ${algoChecked ? "да" : "нет"}`);
  console.log(`пробный вариант экзамена: ${variantChecked ? "да" : "нет"}`);
  console.log(`проверка «что умеет сам»: ${proverkaChecked ? "да" : "нет"}`);
  console.log(`проверка 2 (экзамен и HTML): ${proverka2Checked ? "да" : "нет"}`);
  console.log(`защита своего кода: ${zqChecked ? "да" : "нет"}`);
  console.log(`возможности движка на месте: ${engineChecked ? "да" : "нет"}`);
  console.log(`адрес следует за экраном (кругооборот): ${routeChecked ? "да" : "нет"}`);
  console.log(`страницы сайта: ссылки и карта сайта: ${pagesChecked ? "да" : "нет"}`);
  console.log(`список переезда на домен полон: ${pereezdChecked ? "да" : "нет"}`);
  console.log(`числа на страницах сверены с продуктом: ${siteNumsChecked ? "да" : "нет"}`);
  console.log(`ряд карточек без дыры справа: ${cardRowChecked ? "да" : "нет"}`);
  console.log(`сетка номеров экзамена совпадает с продуктом: ${setkaChecked ? "да" : "нет"}`);
  console.log(`лента «Что нового» сверена с git: ${lentaChecked ? "да" : "нет"}`);
  console.log(`калькулятор баллов ОГЭ сверен со шкалой: ${kalkChecked ? "да" : "нет"}`);
  console.log(`блок канала для репетиторов сверен: ${kanalChecked ? "да" : "нет"}`);
  console.log(`контракты экранов без undefined: ${contractsChecked ? "да" : "нет"}`);
  /* ================= [сборка] снятие комментариев ничего не съело =========
     ⚠️ Однофайловая сборка идёт без комментариев (build.js, 525 КБ экономии),
     а значит каждый файл проходит через разборщик. Разборщик, съевший строку
     кода или пустую строку ВНУТРИ программы на Python, ломает не сборку —
     ломает урок, и узнаём мы об этом от ребёнка. Уже случилось однажды:
     схлопывание пустых строк по всему тексту залезло в шаблонную строку и
     сдвинуло программу разминки «предскажи память» на строку вверх.
     Проверяем прямо: каждый файл банка грузим дважды — как есть и обрезанным —
     и сверяем всё, что он положил в window, вместе с текстами функций. */
  {
    const vm = require("vm");
    const { stripComments, bundled } = require(path.join(root, "build.js"));
    /* ⚠️ Функции сравниваем ТОЖЕ обрезанными — с обеих сторон. Иначе проверка
       ловила бы сама себя: комментарий внутри функции честно исчез, тексты
       разошлись, и «сломано» кричало бы на каждой правке. Значение имеет то,
       что осталось от кода, а не то, что мы сами и убирали. */
    const fnText = f => stripComments("(" + String(f) + ")", "функция");
    const load = src => {
      const ctx = { window:{}, console };
      ctx.globalThis = ctx; ctx.self = ctx;
      vm.createContext(ctx);
      try { vm.runInContext(src, ctx); } catch(e){ return null; }
      try {
        return JSON.stringify(ctx.window, (k, v) => typeof v === "function" ? fnText(v) : v);
      } catch(e){ return null; }
    };
    let same = 0, skipped = [];
    bundled.forEach(f => {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      const was = load(src);
      if (was === null || was === "{}") return void skipped.push(f);  /* без DOM не грузится */
      const now = load(stripComments(src, f));
      if (now === was) same++;
      else bad(`[сборка] после снятия комментариев ${f} отдаёт другое содержимое`);
    });
    if (same < 8)
      bad(`[сборка] сверено всего ${same} файлов из ${bundled.length} — проверка ничего не значит ` +
          `(не грузятся: ${skipped.join(", ")})`);
    console.log(`файлов сверено после снятия комментариев: ${same} из ${bundled.length}`);

    /* ⚠️ Сверка выше берёт ЖИВЫЕ файлы, и потому видит только те ловушки, в
       которые мы уже наступили. Эти подстроены нарочно: регулярка с двумя
       слэшами внутри, стоящая после ключевого слова (`return /^https:\/\//`).
       Такая запись читалась разборщиком как деление, `//` внутри неё
       принимался за начало комментария, и хвост строки съедался. Чем это
       кончается — зависит от строки: обычно сборка падает на своей же проверке
       разбора (и тогда наполнение стоит, пока никто не поймёт, почему), а если
       огрызок случайно остался верным JS — портится молча, и ломается ровно
       однофайловая сборка, та самая, которую скачивает школа.
       В js/ таких мест уже девять, просто ни в одном пока нет двух слэшей
       подряд. Найдено ревизией 18.09.2026 — до выстрела. */
    {
      const ловушки = [
        ['return /^https:\\/\\//.test(u)', "регулярка с // после return"],
        ['switch(x){ case 1: return /a\\/\\/b/.test(s); }', "регулярка с // после case"],
        ['var t = typeof /\\/\\//', "регулярка с // после typeof"],
        ['var d = 10 / 2 / 5', "обычное деление"],
      ];
      const голый = t => t.replace(/\s+/g, "");
      ловушки.forEach(([код, что]) => {
        let после;
        try { после = stripComments("function f(u, s, x){ " + код + "; }", "ловушка.js"); }
        catch(e){
          return bad(`[сборка] снятие комментариев спотыкается на «${что}» (${код}): ` +
                     `${e.message} — сборка одним файлом на таком коде не соберётся`);
        }
        if (голый(после).indexOf(голый(код)) < 0)
          bad(`[сборка] снятие комментариев испортило «${что}»: было «${код}», ` +
              `стало «${после.trim()}» — в однофайловой сборке этот код будет другим`);
      });
    }
  }

  console.log(`вызовов рисования на холсте: ${drawCalls.n}`);
  console.log(`запросов к серверу в тесте: ${calls}`);
  console.log(`ошибок JavaScript: ${jsErrors.length}`);
  jsErrors.slice(0, 10).forEach(e => console.log("   " + e));
  if (problems.length){
    console.log("\nПРОБЛЕМ: " + problems.length);
    problems.forEach(p => console.log("   " + p));
  }
  /* ⚠️ Ошибка JavaScript — тоже провал, и слово «пройдена» при ней врёт:
     17.09.2026 мёртвая дверь к Роботу печатала «Uncaught TypeError» и тут же
     «сквозная проверка пройдена» (код выхода был верный, текст — нет). */
  else if (jsErrors.length) console.log("\nсквозная проверка НЕ пройдена: ошибки JavaScript");
  else console.log("сквозная проверка пройдена");

  process.exit(problems.length || jsErrors.length ? 1 : 0);
})();
