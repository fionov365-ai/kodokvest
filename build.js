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

/* размётка берётся из index.html — один источник правды */
const index = read("index.html");
const bodyStart = index.indexOf("<body>") + "<body>".length;
const scriptStart = index.indexOf("<script src=");
const markup = index.slice(bodyStart, scriptStart).trim();

/* порядок важен: движок → рантайм → программа → контент → приложение */
const scripts = ["js/engine-mini.js", "js/runtime.js", "js/curriculum.js"];

const contentDir = path.join(root, "content");
const contentFiles = fs.readdirSync(contentDir)
  .filter(f => /^world\d+\.js$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
  .map(f => "content/" + f);

const wrap = code => "<script>\n" + code + "\n</" + "script>";

const out = [
  "<title>Кодоквест</title>",
  "<style>\n" + css + "\n</style>",
  markup,
  wrap("window.__SINGLE_FILE__ = true;"),
  ...scripts.map(f => wrap(read(f))),
  ...contentFiles.map(f => wrap(read(f))),
  wrap(read("js/app.js"))
].join("\n\n");

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/kodokvest.html"), out);

const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log("dist/kodokvest.html собран — " + kb + " КБ");
console.log("миров с контентом: " + contentFiles.length);
