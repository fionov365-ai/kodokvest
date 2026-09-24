/* Отчёт готовности к платному запуску. Считается из репозитория, а не из
   записей: число без даты не число, а список, набранный руками, стареет
   молча (RAZVITIE § 2.9, § 4.14).

   node tools/zapusk.js

   Показывает: версию и запас до потолка сборки, все файлы с прошитым адресом
   площадки и полноту списка переезда, наличие правовых страниц и признаков
   оплаты в коде, все места, где сказано «бесплатно», и где напечатана почта.
   Ничего не правит и никуда не ходит — только читает файлы. */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const ПОТОЛОК = 4194304;                      /* 4 МиБ, тот же, что в тесте [два контура]; поднят с 3 МиБ 24.09.2026 */
const АДРЕС = "fionov365-ai.github.io";
const ходовые = /\.(html|xml|txt|js|json|css|webmanifest)$/;
const читать = p => fs.readFileSync(path.join(root, p), "utf8");
const есть = p => fs.existsSync(path.join(root, p));

/* обход продукта: без документов, сборки, зависимостей и служебных папок */
function обход(){
  const out = [];
  (function walk(dir, rel){
    fs.readdirSync(dir, { withFileTypes:true }).forEach(e => {
      /* ⚠️ tools/ пропускаем: инструменты не выкладываются, а этот файл
         держит и адрес площадки, и слово «ЮKassa» — без пропуска отчёт
         нашёл бы сам себя и соврал дважды (поймано первым прогоном
         20.09.2026). Тот же пропуск — в стороже [переезд]. */
      if (e.name === "node_modules" || e.name === "dist" || e.name === "docs" ||
          e.name === "tools" || e.name.charAt(0) === ".") return;
      const full = path.join(dir, e.name), r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) return walk(full, r);
      if (ходовые.test(e.name)) out.push(r);
    });
  })(root, "");
  return out;
}
const файлы = обход();
const строки = {};
файлы.forEach(f => { строки[f] = читать(f).split("\n"); });
function где(re, только){
  const out = [];
  файлы.forEach(f => {
    if (только && !только.test(f)) return;
    строки[f].forEach((s, i) => { if (re.test(s)) out.push(f + ":" + (i + 1)); });
  });
  return out;
}
const заголовок = t => console.log("\n" + t + "\n" + "─".repeat(t.length));

/* --- 1. версия и вес --- */
заголовок("Версия и вес");
const ver = JSON.parse(читать("package.json")).version;
const кеш = (читать("sw.js").match(/var CACHE = "kodokvest-([\d.]+)"/) || [])[1];
console.log("версия package.json: " + ver + (кеш === ver ? "" : "  ⚠️ в sw.js — " + кеш));
if (есть("dist/kodokvest.html")) {
  const вес = fs.statSync(path.join(root, "dist/kodokvest.html")).size;
  const запас = ПОТОЛОК - вес;
  console.log("сборка одним файлом: " + вес.toLocaleString("ru") + " байт из " +
              ПОТОЛОК.toLocaleString("ru") + ", запас " + Math.round(запас / 1024) + " КБ" +
              (запас < 51200 ? "  ⚠️ экраны оплаты этот запас съедят" : ""));
} else console.log("сборки нет — соберите: node build.js");

/* --- 2. адрес площадки --- */
заголовок("Переезд на свой домен");
const сАдресом = файлы.filter(f => строки[f].some(s => s.indexOf(АДРЕС) >= 0));
const карта = читать("docs/pereezd-na-domen.md");
const забыты = сАдресом.filter(f => карта.indexOf("`" + f + "`") < 0);
console.log("файлов с прошитым адресом: " + сАдресом.length);
console.log("CNAME в корне: " + (есть("CNAME") ? "есть" : "нет — домен не привязан"));
console.log(забыты.length
  ? "⚠️ НЕ названы в docs/pereezd-na-domen.md: " + забыты.join(", ")
  : "все они названы в docs/pereezd-na-domen.md (сторожит тест [переезд])");

/* --- 3. оплата --- */
заголовок("Оплата");
const признаки = где(/ЮKassa|yookassa|YooKassa|create_payment|payment_webhook|оплатить доступ/i);
console.log("признаки платёжного кода: " + (признаки.length ? признаки.join(", ") : "нет ни одного"));
console.log("страница оферты pravo/oferta/: " + (есть("pravo/oferta/index.html") ? "есть" : "нет"));
const политика = есть("pravo/politika/index.html") ? читать("pravo/politika/index.html") : "";
console.log("политика ПДн описывает расчёты: " +
            (/расч[её]т[а-я]* за доступ|кассовый чек|ЮKassa/i.test(политика)
              ? "да" : "нет — сегодня она обещает обновиться ДО первого платежа"));
console.log("замок по оплате в продукте: нет — «замок» в js/ это порядок уроков, а не деньги");

/* --- 4. где сказано «бесплатно» --- */
заголовок("Места про цену — переписываются в день включения оплаты");
const бесплатно = где(/бесплатн|оплата не подключена|доступ бесплатный/i, /\.html$/)
  .concat(где(/Сейчас бесплатно|доступ бесплатный|бесплатный вход/, /^js\//));
const вФайлах = new Set(бесплатно.map(m => m.split(":")[0])).size;
console.log(бесплатно.length + " строк в " + вФайлах + " файлах:");
бесплатно.forEach(m => console.log("  " + m));

/* --- 5. почта --- */
заголовок("Почта");
const почта = где(/fionika\.help@yandex\.ru/);
console.log("напечатана в " + почта.length + " местах: " + почта.join(", "));
console.log("⚠️ ящик заводит фаундер — до этого письмо покупателя уходит в никуда");

console.log("\nПодробности и порядок дня — docs/den-zapuska.md, RAZVITIE.md § 2.9\n");
