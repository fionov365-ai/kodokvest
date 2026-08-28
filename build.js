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
head = head.replace(cssLink, "<style>\n" + css + "\n</style>");
if (head.indexOf('<meta charset="utf-8">') < 0) throw new Error("в <head> нет <meta charset=\"utf-8\">");

const bodyStart = index.indexOf("<body>") + "<body>".length;
const scriptStart = index.indexOf("<script src=");
const markup = index.slice(bodyStart, scriptStart).trim();

/* порядок важен: движок → рантайм → программа → контент → приложение */
const scripts = ["js/engine-mini.js", "js/runtime.js", "js/curriculum.js",
                 "js/games.js", "js/warmups.js", "js/ailab.js", "js/projects.js",
                 "js/cheatsheet.js", "js/cloud-config.js", "js/cloud.js"];

const contentDir = path.join(root, "content");
const contentFiles = fs.readdirSync(contentDir)
  .filter(f => /^world\d+\.js$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
  .map(f => "content/" + f);

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
  ...scripts.map(f => wrap(read(f))),
  ...contentFiles.map(f => wrap(read(f))),
  wrap(read("js/app.js")),
  "</body>",
  "</html>"
].join("\n\n");

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/kodokvest.html"), out);

const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log("dist/kodokvest.html собран — " + kb + " КБ");
console.log("миров с контентом: " + contentFiles.length);
