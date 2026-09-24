/* ============================================================
   Сетка номеров ОГЭ и ЕГЭ на витрине — собирается из данных продукта.

   Запуск:  node tools/setka-ekzamena.js
   Переписывает в vitrina/index.html кусок между метками
   <!-- setka:start --> и <!-- setka:end -->.

   ⚠️ Руками этот кусок не править. Состояние номера («есть», «наполовину»,
   «судить нечем», «пока нет») считает та же функция EXAMS.state, что рисует
   карту экзамена в приложении (js/screens-algo.js), — иначе витрина и
   тренажёр разойдутся в первый же день, когда группа задач наполнится.
   Сторож [сетка-экзамена] в tests/full-run.js собирает сетку заново и
   сравнивает с витриной: разошлись — сборка красная, лечится этим запуском.

   Зачем сетка: разбор сайтов конкурентов 24.09.2026
   (docs/konkurenty-sajty-2026-09-24.md) — у Neuronis, Яндекса и kompege
   первый ход посетителя — нажать свой номер. Ссылка стоит только на номере,
   где правда есть задачи; остальные серые, и написано почему.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const DATA = ["js/algo.js", "js/algo-exam.js", "js/algo-ege.js", "js/algo-oge.js",
              "js/algo-thin.js", "js/robot-tasks.js", "js/exams.js"];

function load(root){
  const vm = require("vm");
  const box = vm.createContext({});
  box.window = box;
  DATA.forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), box, { filename: f }));
  return box;
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function render(root){
  const w = load(root);
  const EXAMS = w.EXAMS, ALGO = w.ALGO || [];
  const countIn = g => ALGO.filter(x => g.indexOf(x.group) >= 0).length;
  const out = [];
  ["oge", "ege"].forEach(id => {
    const ex = EXAMS[id];
    const t = EXAMS.tally(ex, countIn);
    const has = t.yes + t.part;
    const nums = ex.tasks.map(x => {
      const st = EXAMS.state(x, countIn);
      const name = x.n + " · " + x.t;
      if (st === "yes" || st === "part")
        return '<a class="num ' + st + '" href="../#exam=' + id + "-" + x.n + '" title="' + esc(name) +
          (st === "part" ? " — наполовину" : "") + '">' + x.n + "</a>";
      return '<span class="num ' + st + '" title="' + esc(name) + " — " +
        (st === "no" ? "судить нечем" : "пока нет задач") + '">' + x.n + "</span>";
    }).join("");
    /* Чего нет и почему — строкой под сеткой, а не только во всплывающей
       подсказке: на телефоне её не увидеть. */
    const why = ex.tasks.map(x => {
      const st = EXAMS.state(x, countIn);
      if (st === "part") return x.n + " — наполовину, кроме: " + x.off;
      if (st === "no") return x.n + " — судить нечем: " + x.off;
      if (st === "soon") return x.n + " — пока нет";
      return "";
    }).filter(Boolean);
    out.push(
      '    <div class="exam">\n' +
      "      <h3>" + esc(ex.full) + "</h3>\n" +
      '      <p class="fine">Номера по демоверсии ' + ex.year + " года · есть " + has + " из " + ex.total + "</p>\n" +
      '      <div class="nums">' + nums + "</div>\n" +
      (why.length ? '      <p class="fine">' + esc(why.join(". ")) + ".</p>\n"
                  : '      <p class="fine">Закрыты все номера — каждый решается программой.</p>\n') +
      "    </div>");
  });
  return '<!-- setka:start -->\n  <div class="exams">\n' + out.join("\n") + "\n  </div>\n  <!-- setka:end -->";
}

const RX = /<!-- setka:start -->[\s\S]*?<!-- setka:end -->/;

module.exports = { render, RX };

if (require.main === module){
  const root = path.join(__dirname, "..");
  const f = path.join(root, "vitrina/index.html");
  const html = fs.readFileSync(f, "utf8");
  if (!RX.test(html)) { console.error("В vitrina/index.html нет меток setka:start / setka:end"); process.exit(1); }
  fs.writeFileSync(f, html.replace(RX, render(root)));
  console.log("Сетка номеров обновлена в vitrina/index.html");
}
