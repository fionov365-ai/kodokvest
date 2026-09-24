/* ============================================================
   Лента «Что нового» на витрине — собирается из content/novoe.json.

   Запуск:  node tools/lenta.js
   Переписывает в vitrina/index.html кусок между метками
   <!-- lenta:start --> и <!-- lenta:end -->.

   ⚠️ Руками этот кусок не править — только content/novoe.json и запуск.
   Сторож [лента] в tests/full-run.js собирает ленту заново и сравнивает с
   витриной, а дату каждой записи сверяет с датой коммита её версии в git:
   «число с датой» — правило проекта, и дата здесь не пишется от руки на
   веру, а проверяется.

   Зачем лента: разбор сайтов конкурентов 24.09.2026
   (docs/konkurenty-sajty-2026-09-24.md) — у kompege лента обновлений с
   датами показывает, что продукт живой. Первые ВИДНО пять, остальное под
   «Раньше»: страница не растёт с каждой записью (правила сайта, § 1).
   ============================================================ */
const fs = require("fs");
const path = require("path");

const SHOWN = 5;

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ru = d => d.split("-").reverse().join(".");

function items(root){
  return JSON.parse(fs.readFileSync(path.join(root, "content/novoe.json"), "utf8")).items;
}

function li(x){
  return '      <li><time datetime="' + esc(x.d) + '">' + ru(x.d) + '</time>' +
    '<span>' + esc(x.t) + ' <small>версия ' + esc(x.v) + '</small></span></li>';
}

function render(root){
  const xs = items(root);
  const top = xs.slice(0, SHOWN), rest = xs.slice(SHOWN);
  return '<!-- lenta:start -->\n' +
    '    <ol class="feed">\n' + top.map(li).join("\n") + '\n    </ol>\n' +
    (rest.length
      ? '    <details class="feedmore"><summary>Раньше</summary>\n    <ol class="feed">\n' +
        rest.map(li).join("\n") + '\n    </ol>\n    </details>\n'
      : '') +
    '    <!-- lenta:end -->';
}

const RX = /<!-- lenta:start -->[\s\S]*?<!-- lenta:end -->/;

module.exports = { render, RX, items };

if (require.main === module){
  const root = path.join(__dirname, "..");
  const f = path.join(root, "vitrina/index.html");
  const html = fs.readFileSync(f, "utf8");
  if (!RX.test(html)) { console.error("В vitrina/index.html нет меток lenta:start / lenta:end"); process.exit(1); }
  fs.writeFileSync(f, html.replace(RX, render(root)));
  console.log("Лента «Что нового» обновлена в vitrina/index.html");
}
