/* ============================================================
   Блок «Канал для репетиторов» на /repetitoru/ — из content/kanal.json.

   Запуск:  node tools/kanal.js
   Переписывает в repetitoru/index.html кусок между метками
   <!-- kanal:start --> и <!-- kanal:end -->.

   ⚠️ Пока ни одного адреса нет — между метками пусто: ссылка на канал,
   которого нет, хуже отсутствия ссылки. Канал заводит фаундер (аккаунт с
   телефоном — не работа сессии); порядок и готовые тексты —
   docs/kanal-repetitoram.md. Сторож [канал] в tests/full-run.js сверяет
   страницу со сборкой и проверяет, что адрес — настоящий адрес площадки.

   Почему VK и MAX первыми, а Telegram последним и с оговоркой: разбор рынка
   12.09.2026 (rynok-i-rov § 6) — репетиторы информатики сидят в VK и MAX,
   а Telegram с февраля 2026 открывается только через VPN.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const FILE = "repetitoru/index.html";
const PLACES = [
  { key: "vk",  label: "Канал во ВКонтакте", rx: /^https:\/\/vk\.com\/[A-Za-z0-9_.]+$/ },
  { key: "max", label: "Канал в MAX",        rx: /^https:\/\/max\.ru\/[A-Za-z0-9_\-\/]+$/ },
  { key: "tg",  label: "Канал в Telegram",   rx: /^https:\/\/t\.me\/[A-Za-z0-9_]+$/ }
];

function conf(root){ return JSON.parse(fs.readFileSync(path.join(root, "content/kanal.json"), "utf8")); }

function render(root, given){
  const c = given || conf(root);
  const live = PLACES.filter(p => String(c[p.key] || "").trim());
  if (!live.length) return "<!-- kanal:start -->\n<!-- kanal:end -->";
  const btns = live.map((p, i) =>
    '    <a class="btn' + (i ? ' ghost' : '') + '" href="' + c[p.key].trim() + '">' + p.label + '</a>').join("\n");
  return "<!-- kanal:start -->\n" +
    '<section id="kanal">\n' +
    "  <h2>Канал для репетиторов</h2>\n" +
    '  <p class="sub">Что появилось в тренажёре и как этим пользоваться на занятиях — коротко и без рекламы.</p>\n' +
    '  <div class="btnrow">\n' + btns + "\n  </div>\n" +
    (c.tg ? '  <p class="fine">Telegram в России сейчас открывается не у всех — всё то же самое есть и в других каналах.</p>\n' : "") +
    "</section>\n" +
    "<!-- kanal:end -->";
}

const RX = /<!-- kanal:start -->[\s\S]*?<!-- kanal:end -->/;

module.exports = { render, RX, FILE, PLACES, conf };

if (require.main === module){
  const root = path.join(__dirname, "..");
  const c = conf(root);
  PLACES.forEach(p => {
    const u = String(c[p.key] || "").trim();
    if (u && !p.rx.test(u)){ console.error("Адрес «" + u + "» не похож на адрес " + p.label + ". Пример — в docs/kanal-repetitoram.md"); process.exit(1); }
  });
  const f = path.join(root, FILE);
  const html = fs.readFileSync(f, "utf8");
  if (!RX.test(html)) { console.error("В " + FILE + " нет меток kanal:start / kanal:end"); process.exit(1); }
  fs.writeFileSync(f, html.replace(RX, render(root)));
  console.log("Блок канала в " + FILE + (PLACES.some(p => String(c[p.key] || "").trim()) ? " обновлён" : " пуст — адресов пока нет"));
}
