/* ============================================================
   Проверка серверной функции без облака.
   Вместо смонтированного бакета подставляем обычную временную папку
   через переменную DATA_DIR — код функции об этом не знает.
   Запуск: node tests/cloud-function.js
   ============================================================ */
const fs = require("fs");
const os = require("os");
const path = require("path");

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "kq-cloud-"));
process.env.DATA_DIR = DIR;
delete process.env.ADMIN_KEY;

const { handler } = require("../cloud/index.js");

let bad = 0;
function check(name, cond, extra){
  if (!cond){ bad++; console.log("НЕ ТАК: " + name + (extra ? "\n    " + extra : "")); }
}
const call = (ev) => handler(ev);
const json = (r) => JSON.parse(r.body);
const get = (q) => ({ httpMethod:"GET", queryStringParameters:q });
const post = (q, body) => ({ httpMethod:"POST", queryStringParameters:q, body:body });

const progress = { v:2, xp:160, name:"Миша", stars:{ "print-first":3, "vars":2 }, badges:["first"],
                   log:{ "print-first":{ attempts:2, hints:0, timeMs:180000, last:1000 } },
                   savedAt: 1234567890 };

(async function(){
  /* ---------- ping ---------- */
  let r = await call(get({ op:"ping" }));
  check("ping отвечает 200", r.statusCode === 200, "код " + r.statusCode + " " + r.body);
  check("ping говорит, что папка доступна на запись", json(r).ok === true);
  check("ping не оставил после себя файлов", fs.readdirSync(DIR).length === 0,
        "осталось: " + fs.readdirSync(DIR).join(", "));
  check("ping сообщает, задан ли ключ наставника", json(r).adminKeySet === false);

  /* ---------- CORS ---------- */
  r = await call({ httpMethod:"OPTIONS", queryStringParameters:{} });
  check("OPTIONS отвечает 200", r.statusCode === 200);
  check("во всех ответах есть заголовок CORS", r.headers["Access-Control-Allow-Origin"] === "*");

  /* ---------- запись и чтение ---------- */
  r = await call(post({ op:"save", code:"misha-7f3a" }, JSON.stringify(progress)));
  check("сохранение отвечает 200", r.statusCode === 200, r.body);
  check("сервер вернул время записи", typeof json(r).serverAt === "number");
  check("в сводке верное число решённых", json(r).summary.solved === 2, r.body);
  check("в сводке верная сумма звёзд", json(r).summary.stars === 5, r.body);

  r = await call(get({ op:"load", code:"misha-7f3a" }));
  check("чтение отвечает 200", r.statusCode === 200);
  check("прогресс нашёлся", json(r).found === true);
  check("прогресс совпадает с записанным",
        JSON.stringify(json(r).data) === JSON.stringify(progress), r.body.slice(0, 200));

  r = await call(get({ op:"load", code:"MISHA-7F3A" }));
  check("код читается без учёта регистра", json(r).found === true);

  r = await call(get({ op:"load", code:"nikogo-tut-net" }));
  check("неизвестный код — не ошибка, а «нет данных»",
        r.statusCode === 200 && json(r).found === false, r.body);

  /* ---------- защита от обхода пути ---------- */
  const outside = path.join(DIR, "..", "kq-vzlom.json");
  const attacks = ["../kq-vzlom", "../../etc/passwd", "/etc/passwd", "..%2Fkq", "a/b", "a.b", "ab", "", "  ",
                   "ПРИВЕТ", "a".repeat(40), "Misha Petrov"];
  let blocked = 0;
  for (const a of attacks){
    const rr = await call(post({ op:"save", code:a }, JSON.stringify(progress)));
    if (rr.statusCode === 400) blocked++;
    else console.log("    пропущен опасный код: " + JSON.stringify(a) + " → " + rr.statusCode);
  }
  check("все негодные коды отклонены (" + blocked + " из " + attacks.length + ")", blocked === attacks.length);
  check("наружу файлов не записано", !fs.existsSync(outside));
  check("в папке ровно один файл ученика", fs.readdirSync(DIR).length === 1,
        "есть: " + fs.readdirSync(DIR).join(", "));

  /* ---------- негодные тела запроса ---------- */
  r = await call(post({ op:"save", code:"misha-7f3a" }, "это не json"));
  check("не-JSON отклонён", r.statusCode === 400);
  r = await call(post({ op:"save", code:"misha-7f3a" }, JSON.stringify({ hello:"world" })));
  check("посторонний JSON отклонён", r.statusCode === 400, r.body);
  r = await call(post({ op:"save", code:"misha-7f3a" }, ""));
  check("пустое тело отклонено", r.statusCode === 400);
  r = await call(post({ op:"save", code:"misha-7f3a" },
        JSON.stringify({ xp:0, stars:{}, junk:"x".repeat(250 * 1024) })));
  check("слишком большой прогресс отклонён", r.statusCode === 413, "код " + r.statusCode);
  r = await call(get({ op:"save", code:"misha-7f3a" }));
  check("запись через GET отклонена", r.statusCode === 405);
  r = await call(get({ op:"чтотопопало", code:"misha-7f3a" }));
  check("неизвестная операция отклонена", r.statusCode === 400);

  /* ---------- прогресс не испортился после всех атак ---------- */
  r = await call(get({ op:"load", code:"misha-7f3a" }));
  check("прогресс на месте и цел",
        json(r).found === true && json(r).data.xp === 160, r.body.slice(0, 160));

  /* ---------- список учеников ---------- */
  r = await call(get({ op:"list" }));
  check("без ADMIN_KEY список закрыт", r.statusCode === 403, r.body);

  process.env.ADMIN_KEY = "kluch-nastavnika";
  r = await call(get({ op:"list", key:"не тот" }));
  check("с неверным ключом список закрыт", r.statusCode === 403);
  r = await call(get({ op:"list", key:"kluch-nastavnika" }));
  check("с верным ключом список открыт", r.statusCode === 200, r.body);
  const st = json(r).students;
  check("в списке один ученик", st && st.length === 1, JSON.stringify(st));
  check("в списке верный код", st && st[0].code === "misha-7f3a");
  check("в списке верный опыт", st && st[0].xp === 160);
  check("в списке посчитано время", st && st[0].timeMs === 180000);
  /* без имени наставник видит только коды, а две Ани по кодам не различаются */
  check("в списке есть имя ученика", st && st[0].name === "Миша", JSON.stringify(st && st[0]));

  /* ---------- второй ученик и порядок в списке ---------- */
  await call(post({ op:"save", code:"anya_2" }, JSON.stringify({ xp:25, stars:{ "print-first":1 } })));
  r = await call(get({ op:"list", key:"kluch-nastavnika" }));
  check("в списке стало два ученика", json(r).students.length === 2);
  /* старые записи имени не знают — там должна быть пустая строка, а не «undefined» */
  const anya = json(r).students.filter(s => s.code === "anya_2")[0];
  check("у записи без имени имя пустое, а не мусор", anya && anya.name === "",
        JSON.stringify(anya));

  /* ---------- испорченный файл не валит список ---------- */
  fs.writeFileSync(path.join(DIR, "slomannyi.json"), "{ это не json");
  r = await call(get({ op:"list", key:"kluch-nastavnika" }));
  check("испорченный файл не ломает список", r.statusCode === 200, r.body);
  check("испорченный файл помечен", json(r).students.some(s => s.broken === true), r.body);

  try { fs.rmSync(DIR, { recursive:true, force:true }); } catch(e){}
  console.log(bad ? "\nПРОБЛЕМ: " + bad : "\nсерверная функция в порядке");
  process.exit(bad ? 1 : 0);
})();
