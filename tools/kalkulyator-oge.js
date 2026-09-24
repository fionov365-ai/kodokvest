/* ============================================================
   Калькулятор баллов ОГЭ по информатике — список заданий и шкала.

   Запуск:  node tools/kalkulyator-oge.js
   Переписывает в baza/kalkulyator-ballov-oge-informatika/index.html кусок
   между метками <!-- kalk:start --> и <!-- kalk:end -->.

   ⚠️ ОФИЦИАЛЬНЫЕ ЧИСЛА ЛЕЖАТ ТОЛЬКО ЗДЕСЬ (объект OFFICIAL ниже) и каждое —
   с источником и датой сверки. Меняется шкала или разбалловка в новом году —
   правится этот объект и запускается скрипт; руками страницу не трогать.
   Сторож [калькулятор-огэ] в tests/full-run.js собирает кусок заново и
   сравнивает, а ещё проверяет, что баллы заданий складываются в максимум
   и шкала покрывает его без дыр.

   Названия заданий и «где потренировать» берутся из js/exams.js той же
   функцией EXAMS.state, что у карты экзамена и сетки на витрине: ссылка
   стоит только там, где у нас правда есть задачи.

   Зачем: разбор сайтов конкурентов 24.09.2026 — калькулятор баллов у
   Neuronis даёт вход из поиска (docs/konkurenty-sajty-2026-09-24.md).
   ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const OFFICIAL = {
  year: 2026,
  checked: "2026-09-24",
  /* Спецификация КИМ ОГЭ 2026 (ФИПИ), раздел «Система оценивания»: задания
     1–12 — по 1 баллу, 13, 15 и 16 — от 0 до 2, 14 — от 0 до 3; максимум 21.
     «Изменения структуры и содержания КИМ отсутствуют» против 2025 года. */
  specUrl: "https://doc.fipi.ru/oge/demoversii-specifikacii-kodifikatory/2026/inf_9_2026.zip",
  max: { 13: 2, 14: 3, 15: 2, 16: 2 },           /* остальные — по 1 */
  total: 21,
  /* Письмо Рособрнадзора от 18.02.2026 № 04-44, приложение, раздел
     «10. Информатика», таблица 11. Шкала рекомендательная: регион вправе
     уточнить границы. */
  letter: "письмо Рособрнадзора от 18.02.2026 № 04-44",
  letterUrl: "https://doc.fipi.ru/oge/normativno-pravovye-dokumenty/04-44_18.02.2026.pdf",
  scale: [ { mark: 2, from: 0, to: 4 }, { mark: 3, from: 5, to: 10 },
           { mark: 4, from: 11, to: 16 }, { mark: 5, from: 17, to: 21 } ],
  profile: 15
};

const DATA = ["js/algo.js", "js/algo-exam.js", "js/algo-ege.js", "js/algo-oge.js",
              "js/algo-thin.js", "js/robot-tasks.js", "js/exams.js"];

function load(root){
  const box = vm.createContext({});
  box.window = box;
  DATA.forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), box, { filename: f }));
  return box;
}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const maxOf = n => OFFICIAL.max[n] || 1;

function render(root){
  const w = load(root);
  const EXAMS = w.EXAMS, ALGO = w.ALGO || [];
  const countIn = g => ALGO.filter(x => g.indexOf(x.group) >= 0).length;
  const rows = EXAMS.oge.tasks.map(x => {
    const m = maxOf(x.n), st = EXAMS.state(x, countIn);
    let ctrl;
    if (m === 1)
      ctrl = '<label class="tick"><input type="checkbox" data-n="' + x.n + '" value="1"> решено</label>';
    else {
      ctrl = '<span class="pts" role="radiogroup" aria-label="Баллы за задание ' + x.n + '">';
      for (let v = 0; v <= m; v++)
        ctrl += '<label><input type="radio" name="t' + x.n + '" data-n="' + x.n + '" value="' + v + '"' +
          (v === 0 ? ' checked' : '') + '><span>' + v + '</span></label>';
      ctrl += '</span>';
    }
    let train;
    if (st === "yes" || st === "part")
      train = '<a href="../../#exam=oge-' + x.n + '">потренировать&nbsp;→</a>' +
        (st === "part" ? ' <span class="dim">(кроме: ' + esc(x.off) + ')</span>' : '');
    else if (st === "no") train = '<span class="dim">в тренажёре нет: ' + esc(x.off) + '</span>';
    else train = '<span class="dim">задач пока нет</span>';
    return '      <li><b class="kn">' + x.n + '</b><span class="kt">' + esc(x.t) +
      ' <span class="dim">· до ' + m + ' ' + (m === 1 ? 'балла' : 'баллов') + '</span><br>' + train +
      '</span><span class="kc">' + ctrl + '</span></li>';
  });
  const scaleRows = OFFICIAL.scale.map(s =>
    '        <tr><td>' + s.from + '–' + s.to + '</td><td>«' + s.mark + '»</td></tr>').join("\n");
  const data = { total: OFFICIAL.total, scale: OFFICIAL.scale, profile: OFFICIAL.profile };
  return '<!-- kalk:start -->\n' +
    '    <ol class="calc" id="calc">\n' + rows.join("\n") + '\n    </ol>\n' +
    '    <script type="application/json" id="shkala">' + JSON.stringify(data) + '</script>\n' +
    '  </section>\n\n' +
    '  <section id="shkala-2026">\n' +
    '    <h2>Шкала ' + OFFICIAL.year + ' года</h2>\n' +
    '    <p class="sub">Максимум — ' + OFFICIAL.total + ' первичный балл. Для профильного класса рекомендуют от ' +
      OFFICIAL.profile + '.</p>\n' +
    '    <div class="tablewrap">\n    <table>\n      <thead><tr><th scope="col">Первичный балл</th>' +
      '<th scope="col">Отметка</th></tr></thead>\n      <tbody>\n' + scaleRows + '\n      </tbody>\n    </table>\n    </div>\n' +
    '    <p class="fine gap">Источники: шкала — <a href="' + OFFICIAL.letterUrl + '">' + esc(OFFICIAL.letter) +
      '</a>, таблица 11; баллы за задания — <a href="' + OFFICIAL.specUrl + '">спецификация КИМ ОГЭ ' +
      OFFICIAL.year + ' (ФИПИ)</a>. Сверено ' + OFFICIAL.checked.split("-").reverse().join(".") + '.</p>\n' +
    '    <!-- kalk:end -->';
}

const RX = /<!-- kalk:start -->[\s\S]*?<!-- kalk:end -->/;
const FILE = "baza/kalkulyator-ballov-oge-informatika/index.html";

module.exports = { render, RX, FILE, OFFICIAL, maxOf };

if (require.main === module){
  const root = path.join(__dirname, "..");
  const f = path.join(root, FILE);
  const html = fs.readFileSync(f, "utf8");
  if (!RX.test(html)) { console.error("В " + FILE + " нет меток kalk:start / kalk:end"); process.exit(1); }
  fs.writeFileSync(f, html.replace(RX, render(root)));
  console.log("Калькулятор ОГЭ обновлён в " + FILE);
}
