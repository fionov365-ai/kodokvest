/* ============================================================
   Сборка одного файла из проекта.
   Запуск:  node build.js
   Результат: dist/kodokvest.html — всё внутри, ничего не грузится извне.
   Нужен, чтобы открывать игру одним файлом и публиковать как артефакт.
   Обычный сайт (GitHub Pages) работает с index.html напрямую.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const root = __dirname;

const read = p => fs.readFileSync(path.join(root, p), "utf8");

const css = read("css/style.css");

/* Шрифты в однофайловую сборку вшиваются как data:, а не ссылкой: рядом с
   dist/kodokvest.html нет папки fonts, и относительный путь оттуда никуда не
   ведёт. Плюс это делает правдой обещание из шапки — «ничего не грузится
   извне». Файла нет — readFileSync упадёт, и это правильно: молча собранный
   файл без шрифтов хуже несобранного. */
const cssInlined = css.replace(/url\('\.\.\/fonts\/([^']+)'\)/g, (m, file) => {
  const b64 = fs.readFileSync(path.join(root, "fonts", file)).toString("base64");
  return "url('data:font/woff2;base64," + b64 + "')";
});

/* и размётка, и «голова» страницы берутся из index.html — один источник правды.
   Голова обязательна: без <meta charset="utf-8"> браузер, открывающий файл
   с диска (file://), читает его в однобайтовой кодировке и весь русский текст
   превращается в «РљРѕРґРѕРєРІРµСЃС‚». На сервере кодировку сообщает сам сервер,
   поэтому такую поломку легко не заметить. */
const index = read("index.html");

const headStart = index.indexOf("<head>") + "<head>".length;
const headEnd = index.indexOf("</head>");
if (headStart < 6 || headEnd < 0) throw new Error("в index.html не найден <head>");
let head = index.slice(headStart, headEnd).trim();

/* Ссылки на манифест и иконку из одного файла убираем: dist обещает
   «всё внутри, ничего не грузится извне», а рядом с ним никакого
   manifest.webmanifest нет — браузер сходил бы за ним впустую. Сам service
   worker в одном файле и не регистрируется (проверка в js/app.js). */
head = head.replace(/^[ \t]*<link rel="manifest"[^>]*>\n?/m, "")
           .replace(/^[ \t]*<link rel="apple-touch-icon"[^>]*>\n?/m, "");

const cssLink = '<link rel="stylesheet" href="css/style.css">';
if (head.indexOf(cssLink) < 0) throw new Error("в <head> не найдена ссылка на css/style.css");
head = head.replace(cssLink, "<style>\n" + cssInlined + "\n</style>");
if (head.indexOf('<meta charset="utf-8">') < 0) throw new Error("в <head> нет <meta charset=\"utf-8\">");

const bodyStart = index.indexOf("<body>") + "<body>".length;
const scriptStart = index.indexOf("<script src=");
const markup = index.slice(bodyStart, scriptStart).trim();

/* порядок важен: движок → рантайм → программа → контент → приложение */
const scripts = ["js/engine-mini.js", "js/runtime.js", "js/curriculum.js",
                 "js/games.js", "js/warmups.js", "js/ailab.js", "js/projects.js",
                 "js/cheatsheet.js", "js/specs.js", "js/algo.js", "js/algo-exam.js", "js/algo-ege.js", "js/algo-oge.js", "js/robot.js", "js/robot-tasks.js", "js/exams.js", "js/parent.js", "js/homework.js",
                 "js/cloud-config.js", "js/cloud.js", "js/editor.js", "js/story.js", "js/screens-robot.js", "js/screens-showcase.js"];

const contentDir = path.join(root, "content");
const contentFiles = fs.readdirSync(contentDir)
  .filter(f => /^world\d+\.js$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
  .map(f => "content/" + f);

/* ============================================================
   ПОЧЕМУ ОДНОФАЙЛОВАЯ СБОРКА ИДЁТ БЕЗ КОММЕНТАРИЕВ

   ⚠️ Поймано тестом `[два контура]` 07.09.2026: файл перевалил за 3 МБ, и
   обещание «лёгкий продукт» перестало быть правдой. Порог не поднимали —
   искали вес. Он нашёлся сразу: 547 КБ, то есть каждый пятый байт сборки, —
   это комментарии. В исходниках они и есть половина ценности проекта, а в
   артефакте, который открывают одним файлом, они не значат ничего.

   Комментарии снимаются ТОЛЬКО в сборке. Исходники не трогаются: там они
   объясняют, почему код такой, и это единственная память проекта.

   ⚠️ Наивно (по началу строки) резать нельзя. В js/ailab.js лежат
   многострочные шаблонные строки с кодом, а по всему коду — регулярки, внутри
   которых встречаются и знаки комментария, и знак его конца. Кстати, об этом
   же споткнулся и сам этот комментарий: знак конца, набранный в тексте,
   закрывает блок посреди фразы. Поэтому здесь разбор посимвольный: он
   различает строки трёх видов, шаблоны и регулярные выражения — а начало
   регулярки узнаёт по предыдущему значащему знаку, как это делают все
   разборщики JS.

   ⚠️ Каждый обрезанный файл проверяется на разбор (`new vm.Script`). Не
   разобрался — сборка ПАДАЕТ, а не собирается молча: сборка, тихо потерявшая
   строку кода, хуже несобранной. */
const vm = require("vm");
function stripComments(src, name){
  let out = "", i = 0;
  const n = src.length;
  /* последний значащий знак: по нему отличают деление от начала регулярки */
  let prev = "";
  while (i < n){
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/"){
      while (i < n && src[i] !== "\n") i++;
      continue;                                  /* перевод строки оставляем */
    }
    if (c === "/" && d === "*"){
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      out += " ";                                /* вместо блока — пробел */
      continue;
    }
    if (c === "'" || c === '"' || c === "`"){
      const q = c; out += c; i++;
      while (i < n){
        if (src[i] === "\\"){ out += src[i] + (src[i + 1] || ""); i += 2; continue; }
        out += src[i];
        if (src[i] === q){ i++; break; }
        i++;
      }
      prev = q;
      continue;
    }
    if (c === "/" && /[(,=:[!&|?{};+\-*%~^<>]/.test(prev)){
      /* регулярное выражение: идём до незакрытого слэша, помня про [...] */
      out += c; i++;
      let inClass = false;
      while (i < n){
        if (src[i] === "\\"){ out += src[i] + (src[i + 1] || ""); i += 2; continue; }
        if (src[i] === "[") inClass = true;
        else if (src[i] === "]") inClass = false;
        out += src[i];
        if (src[i] === "/" && !inClass){ i++; break; }
        i++;
      }
      prev = "/";
      continue;
    }
    /* ⚠️ Пустые строки, оставшиеся от снятых комментариев, схлопываем ЗДЕСЬ,
       в разборе, а не заменой по всему файлу потом. Поймано тестом
       `[разминки]`: замена `\n{3,}` по всему тексту залезла ВНУТРЬ шаблонной
       строки с программой на Python, выкинула из неё пустую строку — и
       разминка «предскажи память», которая останавливается на строке номер
       шесть, стала спрашивать про другую строку. Здесь строк нет по
       устройству: они уже скопированы своей веткой целиком. */
    if (c === "\n" && /\n\s*\n$/.test(out)){ i++; continue; }
    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  try { new vm.Script(out, { filename: name }); }
  catch(e){
    throw new Error("после снятия комментариев " + name + " перестал разбираться: " + e.message);
  }
  return out;
}

const wrap = code => "<script>\n" + code + "\n</" + "script>";

const out = [
  "<!doctype html>",
  '<html lang="ru">',
  "<head>",
  head,
  "</head>",
  "<body>",
  markup,
  wrap("window.__SINGLE_FILE__ = true;"),
  ...scripts.map(f => wrap(stripComments(read(f), f))),
  ...contentFiles.map(f => wrap(stripComments(read(f), f))),
  wrap(stripComments(read("js/app.js"), "js/app.js")),
  "</body>",
  "</html>"
].join("\n\n");

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/kodokvest.html"), out);

const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log("dist/kodokvest.html собран — " + kb + " КБ");
console.log("миров с контентом: " + contentFiles.length);

/* Наружу отдаём и снятие комментариев, и список файлов: тест `[сборка]`
   грузит каждый файл дважды — как есть и обрезанным — и сверяет то, что из
   него получилось. Иначе разборщик однажды съест строку кода, и узнаем мы об
   этом от ребёнка. */
module.exports = { stripComments: stripComments, bundled: scripts.concat(contentFiles) };
