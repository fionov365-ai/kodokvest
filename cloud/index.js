/* ============================================================
   Фионика — хранилище прогресса. Yandex Cloud Function.
   Один файл, без внешних библиотек: бакет монтируется к функции
   как обычная папка, поэтому работаем через fs.

   Настройки функции (переменные окружения):
     MOUNT_POINT  точка монтирования бакета, по умолчанию "progress"
     ADMIN_KEY    ключ для op=list; если не задан, список отключён
     DATA_DIR     только для тестов: папка вместо смонтированного бакета

   Запросы (все на один и тот же адрес функции):
     GET  ?op=ping                        проверка: доступен ли бакет на запись
     GET  ?op=load&code=КОД               прочитать прогресс ученика
     POST ?op=save&code=КОД   тело=JSON   записать прогресс ученика
     GET  ?op=list&key=КЛЮЧ               список всех учеников (кратко)
     GET  ?op=stats&key=КЛЮЧ              метрики возвращаемости и затыков
     POST ?op=live_set&code=КОД тело=JSON  ребёнок транслирует экран (код+вывод)
     GET  ?op=live_get&code=КОД            взрослый смотрит трансляцию

   Кто что может: кто знает код ученика — читает и пишет его прогресс.
   Список всех учеников доступен только по ADMIN_KEY.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

const MAX_BODY = 200 * 1024;          /* 200 КБ на одного ученика — с запасом */
const CODE_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/;

function dataDir(){
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  return "/function/storage/" + (process.env.MOUNT_POINT || "progress");
}

function reply(statusCode, obj){
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(obj)
  };
}

/* код ученика — часть имени файла, поэтому проверяем строго:
   никаких точек, слешей и заглавных, иначе можно уйти вверх по дереву */
function cleanCode(raw){
  const c = String(raw || "").trim().toLowerCase();
  return CODE_RE.test(c) ? c : null;
}
function fileOf(code){ return path.join(dataDir(), code + ".json"); }
/* Файл живой трансляции лежит рядом с прогрессом, но учеником не является.
   Точка в имени кода запрещена (CODE_RE), поэтому «misha.live.json» не может
   оказаться чьим-то прогрессом — а вот в списках его надо пропускать. */
function liveFileOf(code){ return path.join(dataDir(), code + ".live.json"); }
function isStudentFile(f){ return /\.json$/.test(f) && !/\.live\.json$/.test(f); }

function readBody(event){
  let b = event && event.body ? event.body : "";
  if (event && event.isBase64Encoded) b = Buffer.from(b, "base64").toString("utf8");
  return b;
}

function summarize(rec){
  const data = (rec && rec.data) || {};
  const stars = data.stars || {};
  let sum = 0, n = 0;
  Object.keys(stars).forEach(function(k){ sum += stars[k] || 0; n++; });
  let timeMs = 0, attempts = 0, last = 0;
  const log = data.log || {};
  Object.keys(log).forEach(function(k){
    const g = log[k] || {};
    timeMs += g.timeMs || 0;
    attempts += g.attempts || 0;
    if ((g.last || 0) > last) last = g.last;
  });
  /* Имя ребёнок вводит сам при входе и оно едет вместе с прогрессом. В списке
     репетитора без него видны только коды, а две Ани по кодам не различаются. */
  return { name: String(data.name || "").slice(0, 40),
           xp: data.xp || 0, solved: n, stars: sum, badges: (data.badges || []).length,
           timeMs: timeMs, attempts: attempts, lastLesson: last,
           savedAt: rec ? rec.savedAt : 0, serverAt: rec ? rec.serverAt : 0 };
}

module.exports.handler = async function(event){
  const method = ((event && event.httpMethod) || "GET").toUpperCase();
  if (method === "OPTIONS") return reply(200, { ok: true });

  const q = (event && event.queryStringParameters) || {};
  const op = String(q.op || "").toLowerCase();
  const dir = dataDir();

  try {
    /* ---------- проверка настройки ---------- */
    if (op === "ping"){
      const probe = path.join(dir, "_ping.txt");
      let canWrite = false, why = "";
      try {
        fs.writeFileSync(probe, new Date().toISOString());
        fs.readFileSync(probe, "utf8");
        canWrite = true;
        try { fs.unlinkSync(probe); } catch(e){}
      } catch(e){ why = e.code ? e.code + ": " + e.message : String(e.message || e); }
      let files = [];
      try { files = fs.readdirSync(dir).filter(isStudentFile); }
      catch(e){ why = why || ("папка не читается — " + (e.message || e)); }
      return reply(canWrite ? 200 : 500, {
        ok: canWrite, dir: dir, students: files.length,
        adminKeySet: !!process.env.ADMIN_KEY,
        hint: canWrite
          ? "Бакет смонтирован и доступен на запись — всё готово."
          : "Бакет не доступен на запись. Проверь точку монтирования и роль storage.uploader у сервисного аккаунта.",
        error: why || null
      });
    }

    /* ---------- список учеников ---------- */
    if (op === "list"){
      const key = process.env.ADMIN_KEY;
      if (!key) return reply(403, { ok:false, error:"Список отключён: в настройках функции не задан ADMIN_KEY." });
      if (String(q.key || "") !== key) return reply(403, { ok:false, error:"Ключ репетитора не подошёл." });
      let files = [];
      try { files = fs.readdirSync(dir).filter(isStudentFile); }
      catch(e){ return reply(500, { ok:false, error:"Папка прогресса не читается: " + (e.message || e) }); }
      const out = [];
      files.forEach(function(f){
        try {
          const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
          const s = summarize(rec);
          s.code = f.replace(/\.json$/, "");
          out.push(s);
        } catch(e){ out.push({ code: f.replace(/\.json$/, ""), broken: true }); }
      });
      out.sort(function(a, b){ return (b.serverAt || 0) - (a.serverAt || 0); });
      return reply(200, { ok:true, students: out });
    }

    /* ---------- метрики возвращаемости ----------
       Две цифры, ради которых это построено (docs/razvitie-2026-09-05.md,
       корзина 4): доля вернувшихся в первую неделю после первого занятия и
       доля дошедших до конца каждого мира. Плюс медиана уроков за 4 недели.
       Считается по уже хранимым снимкам — никаких новых данных о ребёнке.
       Доступ — по тому же ADMIN_KEY, что и список: это цифры репетитора.
       Плюс топ уроков, где застревают: это цифра не про детей, а про нас. */
    if (op === "stats"){
      const key = process.env.ADMIN_KEY;
      if (!key) return reply(403, { ok:false, error:"Метрики отключены: в настройках функции не задан ADMIN_KEY." });
      if (String(q.key || "") !== key) return reply(403, { ok:false, error:"Ключ репетитора не подошёл." });
      let files = [];
      try { files = fs.readdirSync(dir).filter(isStudentFile); }
      catch(e){ return reply(500, { ok:false, error:"Папка прогресса не читается: " + (e.message || e) }); }

      const DAY = 864e5;
      const now = Date.now();
      /* день из строки «ГГГГ-ММ-ДД». Полдень UTC, чтобы разница дней не
         прыгала от часовых поясов: нам нужны разности, а не моменты */
      const dayMs = k => Date.parse(k + "T12:00:00Z");

      /* ---------- где застревают: единственная цифра здесь про НАС ----------
         Все остальные метрики этого ответа — про детей. Эта одна — про урок.
         Если урок взяли десять, сдали двое, а восемь сидят на нём с попытками
         и без решения, дело не в детях: непонятное условие, недостающий шаг в
         теории, слишком большой прыжок. Считается по тем же снимкам — новых
         данных о ребёнке не появляется.
         ⚠️ Формула цены урока и порог затыка — КОПИЯ из js/app.js
         (lessonPrice и STUCK_PRICE). Копия, потому что функция живёт в облаке
         отдельным файлом и ничего из игры не видит. Расхождение стережёт тест
         [затыки]: он читает оба файла и сверяет число. */
      const STUCK_PRICE = 6;
      const priceOf = g => ((g && g.attempts) || 0) + ((g && g.hints) || 0) * 2 + ((g && g.shown) ? 5 : 0);
      const byLesson = {};
      function lessonRec(id){
        if (!byLesson[id]) byLesson[id] = { lesson: id, tried:0, solved:0, stuck:0, attemptsSum:0 };
        return byLesson[id];
      }

      let students = 0, started = 0;
      let weekEligible = 0, weekReturned = 0;
      /* курс строго последовательный (замки), поэтому «пройдено N уроков» и
         «дошёл до N-го урока» — одно и то же. Пороги — концы пяти миров. */
      const REACH = [20, 40, 60, 80, 100];
      const reached = REACH.map(() => 0);
      let active4w = 0;
      const recent = [];

      files.forEach(function(f){
        let rec;
        try { rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); }
        catch(e){ return; }
        const data = (rec && rec.data) || {};
        students++;

        /* затыки считаем ДО проверки «занимался ли»: урок с попытками и без
           решения — место, где ребёнок стоит, а не событие недели. Идём по
           объединению журнала и звёзд: в старых снимках сданный урок мог
           остаться без записи в журнале, и без него знаменатель врал бы. */
        const lg = data.log || {}, sm = data.stars || {}, seen = {};
        Object.keys(lg).forEach(function(k){ seen[k] = 1; });
        Object.keys(sm).forEach(function(k){ seen[k] = 1; });
        Object.keys(seen).forEach(function(id){
          const g = lg[id] || {};
          const done = sm[id] !== undefined;
          if (!done && !(g.attempts > 0)) return;   /* открыл и закрыл — не брался */
          const it = lessonRec(id);
          it.tried++;
          if (done) return void it.solved++;
          if (priceOf(g) < STUCK_PRICE) return;     /* три попытки — это работа, а не затык */
          it.stuck++;
          it.attemptsSum += (g.attempts || 0);
        });

        const days = Object.keys(data.days || {}).sort();
        if (!days.length) return;          /* завёл код, но не занимался */
        started++;

        /* вернулся ли в первую неделю: есть день занятий на 1–7 сутки после
           первого. Считаем только тех, у кого окно уже закрылось, — иначе
           вчерашний новичок портил бы долю, не успев вернуться */
        const first = dayMs(days[0]);
        if (now - first >= 8 * DAY){
          weekEligible++;
          const came = days.some(function(k){
            const d = (dayMs(k) - first) / DAY;
            return d >= 1 && d <= 7;
          });
          if (came) weekReturned++;
        }

        const solved = Object.keys(data.stars || {}).length;
        REACH.forEach(function(n, i){ if (solved >= n) reached[i]++; });

        /* уроки за последние 4 недели — по времени решения из журнала */
        let lessons28 = 0;
        const log = data.log || {};
        Object.keys(log).forEach(function(k){
          const g = log[k] || {};
          if (g.solvedAt && now - g.solvedAt <= 28 * DAY) lessons28++;
        });
        const activeRecently = days.some(function(k){ return now - dayMs(k) <= 28 * DAY; });
        if (activeRecently){ active4w++; recent.push(lessons28); }
      });

      /* наверх — уроки, где застрявших больше всего; при равенстве тот, за
         который бралось больше детей. Порядок обязан быть определённым:
         иначе один и тот же ответ меняется от порядка файлов в бакете. */
      const stuck = Object.keys(byLesson).map(function(k){ return byLesson[k]; })
        .filter(function(it){ return it.stuck > 0; })
        .sort(function(a, b){
          return (b.stuck - a.stuck) || (b.tried - a.tried) ||
                 (a.lesson < b.lesson ? -1 : a.lesson > b.lesson ? 1 : 0);
        })
        .slice(0, 12)
        .map(function(it){
          return { lesson: it.lesson, tried: it.tried, solved: it.solved, stuck: it.stuck,
                   avgAttempts: Math.round(it.attemptsSum / it.stuck) };
        });

      recent.sort(function(a, b){ return a - b; });
      const median = recent.length
        ? (recent.length % 2 ? recent[(recent.length - 1) / 2]
           : (recent[recent.length / 2 - 1] + recent[recent.length / 2]) / 2)
        : 0;

      return reply(200, { ok:true, generatedAt: now,
        students: students, started: started,
        week: { eligible: weekEligible, returned: weekReturned },
        reach: REACH.map(function(n, i){ return { lessons: n, students: reached[i] }; }),
        month: { active: active4w, medianLessons: median },
        stuck: stuck });
    }

    /* ---------- дальше нужен код ученика ---------- */
    const code = cleanCode(q.code);
    if (!code) return reply(400, { ok:false, error:
      "Нужен код ученика: от 3 до 32 знаков, только маленькие латинские буквы, цифры, дефис и подчёркивание." });

    if (op === "load"){
      let raw;
      try { raw = fs.readFileSync(fileOf(code), "utf8"); }
      catch(e){
        if (e.code === "ENOENT") return reply(200, { ok:true, found:false, data:null });
        return reply(500, { ok:false, error:"Не удалось прочитать прогресс: " + (e.message || e) });
      }
      let rec;
      try { rec = JSON.parse(raw); }
      catch(e){ return reply(500, { ok:false, error:"Файл прогресса испорчен и не разбирается." }); }
      return reply(200, { ok:true, found:true, data: rec.data || null,
                          savedAt: rec.savedAt || 0, serverAt: rec.serverAt || 0 });
    }

    /* ---------- живое занятие ----------
       Ребёнок сам включает трансляцию кнопкой, и его код с выводом начинают
       ложиться в отдельный файл; взрослый читает его по коду ученика — та же
       модель доверия, что у прогресса: кто знает код, тот и смотрит.
       ⚠️ Скрытого режима нет по построению: писать сюда умеет только
       устройство ребёнка, и оно же рисует плашку «репетитор видит твой код».
       Файл маленький и живёт недолго: выключение трансляции его удаляет,
       а зритель считает трансляцию законченной, если запись не свежее 20 секунд. */
    if (op === "live_set"){
      if (method !== "POST") return reply(405, { ok:false, error:"Трансляция пишется методом POST." });
      const body = readBody(event);
      if (!body) return reply(400, { ok:false, error:"Пустое тело запроса." });
      if (Buffer.byteLength(body, "utf8") > 40 * 1024)
        return reply(413, { ok:false, error:"Слишком большой кадр трансляции." });
      let data;
      try { data = JSON.parse(body); }
      catch(e){ return reply(400, { ok:false, error:"Тело запроса — не JSON." }); }
      /* ⚠️ Выключение НЕ полагается на удаление файла. В смонтированном
         бакете unlink молча не срабатывает (проверено на бою 05.09.2026:
         после «off» кадр продолжал читаться), а мы при этом отвечали ok —
         то есть врали. Поэтому кладём «надгробие»: запись с флагом off,
         которую live_get отдаёт как «трансляции нет». Удалить всё равно
         пробуем: там, где это работает, файл не копится. */
      if (data && data.off){
        var gone = false;
        try { fs.unlinkSync(liveFileOf(code)); gone = true; } catch(e){}
        if (!gone){
          try { fs.writeFileSync(liveFileOf(code), JSON.stringify({ off:true, serverAt: Date.now() })); }
          catch(e){ return reply(500, { ok:false, error:"Не удалось выключить трансляцию: " + (e.message || e) }); }
        }
        return reply(200, { ok:true, off:true });
      }
      if (!data || typeof data !== "object" || typeof data.code !== "string")
        return reply(400, { ok:false, error:"Это не похоже на кадр трансляции: нужно поле code." });
      const rec = { at: Number(data.at) || 0, place: String(data.place || "").slice(0, 40),
                    title: String(data.title || "").slice(0, 120),
                    code: String(data.code).slice(0, 20000),
                    output: String(data.output || "").slice(0, 8000),
                    serverAt: Date.now() };
      try { fs.writeFileSync(liveFileOf(code), JSON.stringify(rec)); }
      catch(e){ return reply(500, { ok:false, error:"Не удалось записать кадр: " + (e.message || e) }); }
      return reply(200, { ok:true, serverAt: rec.serverAt });
    }

    if (op === "live_get"){
      let raw;
      try { raw = fs.readFileSync(liveFileOf(code), "utf8"); }
      catch(e){
        if (e.code === "ENOENT") return reply(200, { ok:true, found:false });
        return reply(500, { ok:false, error:"Не удалось прочитать трансляцию: " + (e.message || e) });
      }
      let rec;
      try { rec = JSON.parse(raw); }
      catch(e){ return reply(200, { ok:true, found:false }); }
      /* ⚠️ Надгробие отдаём КАК ЕСТЬ, с его временем, а не как «ничего нет».
         Причина выяснилась на бою 05.09.2026: у смонтированного бакета свой
         кэш В КАЖДОМ экземпляре функции, и соседние запросы отвечают разным —
         то надгробием, то старым кадром, и так больше десяти секунд. Если
         сервер будет говорить «нет трансляции», зритель начнёт мигать между
         «идёт» и «не идёт». Решение переносится на клиент: он помнит самое
         свежее serverAt и просто не откатывается назад. */
      rec.ok = true; rec.found = true; rec.now = Date.now();
      return reply(200, rec);
    }

    if (op === "save"){
      if (method !== "POST") return reply(405, { ok:false, error:"Запись делается методом POST." });
      const body = readBody(event);
      if (!body) return reply(400, { ok:false, error:"Пустое тело запроса." });
      if (Buffer.byteLength(body, "utf8") > MAX_BODY)
        return reply(413, { ok:false, error:"Слишком большой прогресс: больше " + (MAX_BODY/1024) + " КБ." });
      let data;
      try { data = JSON.parse(body); }
      catch(e){ return reply(400, { ok:false, error:"Тело запроса — не JSON." }); }
      if (!data || typeof data !== "object" || typeof data.xp !== "number" ||
          !data.stars || typeof data.stars !== "object")
        return reply(400, { ok:false, error:"Это не похоже на прогресс: нужны поля xp и stars." });

      const rec = { code: code, data: data,
                    savedAt: Number(data.savedAt) || 0, serverAt: Date.now() };
      try { fs.writeFileSync(fileOf(code), JSON.stringify(rec)); }
      catch(e){ return reply(500, { ok:false, error:"Не удалось записать: " + (e.message || e) +
        ". Проверь роль storage.uploader у сервисного аккаунта." }); }
      return reply(200, { ok:true, serverAt: rec.serverAt, summary: summarize(rec) });
    }

    return reply(400, { ok:false, error:"Неизвестная операция. Бывают: ping, load, save, list, stats, live_set, live_get." });
  } catch(e){
    return reply(500, { ok:false, error:"Внутренняя ошибка функции: " + (e && e.message ? e.message : String(e)) });
  }
};
