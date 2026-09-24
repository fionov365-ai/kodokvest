/* ============================================================
   Аватар и обложка канала для репетиторов (VK, MAX).
   Запуск:  node og/kanal/make.js
   Результат: og/kanal/avatar.png (512×512) и og/kanal/cover.png (1920×768 —
   размер обложки сообщества ВКонтакте).

   ⚠️ Чисел на картинках нет нарочно: обложку не пересобирают при каждом
   новом уроке, а число на ней устарело бы молча (см. шапку og/make.js).
   Рисует тот же headless Chrome, что и og/og.png. Шрифт — наш Inter.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const font = "@font-face{font-family:Inter;font-weight:400 800;src:url('../../fonts/inter-cyrillic.woff2') format('woff2');unicode-range:U+0400-04FF}" +
  "@font-face{font-family:Inter;font-weight:400 800;src:url('../../fonts/inter-latin.woff2') format('woff2')}";
const base = "*{margin:0;box-sizing:border-box}html,body{width:100%;height:100%}" +
  "body{font-family:Inter,system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,#5a41e0 0%,#7c5cff 55%,#00a68c 130%);overflow:hidden}";

/* ⚠️ Без эмодзи-змейки: в картинку она вшилась бы рисунком Apple, а это
   чужая графика. В значке сайта эмодзи рисует устройство посетителя — это
   другое дело. Здесь только наше: буква и окошко кода. */
const avatar = "<!doctype html><meta charset=utf-8><style>" + font + base +
  "body{display:flex;align-items:center;justify-content:center}" +
  ".s{font-size:330px;font-weight:800;line-height:1;letter-spacing:-.04em;text-shadow:0 18px 40px rgba(0,0,0,.25)}</style><div class=s>Ф</div>";

/* ⚠️ Всё важное — в центральных ~1200 px: на телефоне ВКонтакте режет
   обложку по бокам. Поэтому по центру и без окошка кода сбоку. */
const cover = "<!doctype html><meta charset=utf-8><style>" + font + base +
  "body{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}" +
  ".k{font-size:32px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.85}" +
  "h1{font-size:118px;font-weight:800;letter-spacing:-.02em;margin:12px 0 30px}" +
  ".r{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;width:1100px}.r span{font-size:34px;font-weight:600;" +
  "background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.35);border-radius:999px;padding:12px 28px}</style>" +
  "<div class=k>Фионика · информатика на Python</div><h1>Для репетиторов</h1>" +
  "<div class=r><span>проверка кода запуском</span><span>диагностика нового ученика</span><span>вариант ЕГЭ одним кодом</span></div>";

function shot(name, html, w, h){
  const f = path.join(__dirname, name + ".html");
  fs.writeFileSync(f, html);
  execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=" + w + "," + h, "--screenshot=" + path.join(__dirname, name + ".png"), "file://" + f], { stdio: "ignore" });
  fs.unlinkSync(f);
  console.log("og/kanal/" + name + ".png — " + w + "×" + h + ", " + Math.round(fs.statSync(path.join(__dirname, name + ".png")).size / 1024) + " КБ");
}
if (!fs.existsSync(chrome)){ console.log("Chrome не найден — рисовать нечем"); process.exit(1); }
shot("avatar", avatar, 512, 512);
shot("cover", cover, 1920, 768);
