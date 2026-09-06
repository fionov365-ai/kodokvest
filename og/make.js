/* ============================================================
   Картинка для ссылки (og:image) — 1200×630.
   Запуск:  node og/make.js
   Результат: og/card.html (разметка) и og/og.png (то, что видит мессенджер).

   Зачем генератор, а не картинка, нарисованная руками. Эту картинку видит
   каждый, кому кинули ссылку в Телеграм, ВК или родительский чат, — то есть
   для большинства она и есть первое впечатление о продукте. Числа на ней
   («сто уроков», «двадцать задач ОГЭ и ЕГЭ») — обещание, и нарисованное
   руками обещание устаревает молча: список задач вырос, а картинка врёт, и
   заметить это некому. Поэтому числа читаются ОТСЮДА ЖЕ, из настоящих
   js/curriculum.js и js/algo.js, ровно как их читает сама вывеска
   (aboutCounts в js/app.js).

   ⚠️ После правки курса картинку надо пересобрать этой командой и закоммитить
   заново — иначе разойдутся сайт и превью ссылки.

   Рисует headless Chrome: он и так стоит на маке, а тащить ради одной
   картинки зависимость в package.json незачем — проверкам она не нужна.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");

/* Настоящие данные курса, а не их пересказ */
const sb = { console };
sb.window = sb;
vm.createContext(sb);
["js/curriculum.js", "js/algo.js", "js/ailab.js", "js/projects.js"].forEach(f => {
  vm.runInContext(read(f), sb);
});
const N = {
  lessons:  sb.CURRICULUM.total,
  worlds:   sb.CURRICULUM.length,
  projects: sb.PROJECTS.length,
  ai:       sb.AILAB.length,
  oge:      sb.ALGO.filter(a => a.group === "oge").length,
  ege:      sb.ALGO.filter(a => a.group === "ege").length
};
N.exam = N.oge + N.ege;

/* Шрифты вшиваем в data:, а не тянем относительной ссылкой: Chrome под
   file:// блокирует шрифт как посторонний источник, и заголовок молча
   отрисовывается системным — то есть не так, как выглядит сайт. */
const font = f => "data:font/woff2;base64," +
  fs.readFileSync(path.join(root, "fonts", f)).toString("base64");

/* Цвета взяты из css/style.css (светлая тема) — картинка обязана выглядеть
   продолжением сайта, а не соседним продуктом. */
const card = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<style>
@font-face{font-family:'Inter';font-weight:400 800;src:url('${font("inter-cyrillic.woff2")}') format('woff2');
  unicode-range:U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116}
@font-face{font-family:'Inter';font-weight:400 800;src:url('${font("inter-latin.woff2")}') format('woff2')}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;font-family:'Inter',sans-serif;color:#1a1f3d;
  background:
    radial-gradient(900px 500px at 10% -20%, #e7e9ff 0%, transparent 62%),
    radial-gradient(760px 460px at 96% 4%, #ddf1ee 0%, transparent 58%),
    #f1f4fc;
  padding:60px 68px;display:flex;flex-direction:column;justify-content:space-between}
.kick{font-size:21px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:#00806c}
h1{font-size:82px;line-height:1.02;letter-spacing:-.015em;margin:20px 0 0;font-weight:700}
.sub{font-size:29px;line-height:1.42;color:#4a5372;margin-top:22px;max-width:1000px}
.nums{display:flex;gap:14px;margin-top:auto}
.num{background:#fff;border:1px solid #dde3f1;border-radius:18px;padding:16px 22px;
  box-shadow:0 1px 2px rgba(28,35,80,.05)}
.num b{display:block;font-size:44px;line-height:1;color:#5a41e0;font-weight:800}
.num span{display:block;font-size:18px;color:#4a5372;margin-top:5px}
.foot{display:flex;align-items:center;gap:12px;margin-top:26px;font-size:23px;color:#666e88}
.foot b{color:#1a1f3d;font-size:26px}
.dot{width:6px;height:6px;border-radius:50%;background:#ccd3e7}
</style></head><body>
<div>
  <div class="kick">информатика · 5–11 класс · ОГЭ и ЕГЭ</div>
  <h1>Информатика<br>без репетитора</h1>
  <div class="sub">${N.lessons} уроков программирования на Python прямо в браузере.
    Код запускается сразу, ошибки объясняются словами.</div>
</div>
<div>
  <div class="nums">
    <div class="num"><b>${N.lessons}</b><span>уроков</span></div>
    <div class="num"><b>${N.worlds}</b><span>миров</span></div>
    <div class="num"><b>${N.exam}</b><span>задач ОГЭ и ЕГЭ</span></div>
    <div class="num"><b>${N.projects}</b><span>проектов</span></div>
    <div class="num"><b>${N.ai}</b><span>упражнений про ИИ</span></div>
  </div>
  <div class="foot"><b>🐍 Кодоквест</b><span class="dot"></span>
    <span>ничего не надо устанавливать</span></div>
</div>
</body></html>`;

fs.writeFileSync(path.join(__dirname, "card.html"), card);

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(chrome)){
  console.log("Chrome не найден — разметка собрана (og/card.html), картинку нарисовать нечем.");
  process.exit(1);
}
execFileSync(chrome, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--force-device-scale-factor=1", "--window-size=1200,630",
  "--screenshot=" + path.join(__dirname, "og.png"),
  "file://" + path.join(__dirname, "card.html")
], { stdio: "ignore" });

const size = fs.statSync(path.join(__dirname, "og.png")).size;
console.log("og/og.png собран — " + Math.round(size / 1024) + " КБ");
console.log("числа с курса: " + N.lessons + " уроков, " + N.worlds + " миров, " +
  N.oge + " ОГЭ + " + N.ege + " ЕГЭ, " + N.projects + " проектов, " + N.ai + " про ИИ");
