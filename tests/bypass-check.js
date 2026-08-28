/* ============================================================
   «А можно просто напечатать ответ?» Запуск:
       node build.js && node tests/bypass-check.js
   В npm test НЕ входит: часть находок законна и требует глаз.

   Что делает: для каждого урока берёт вывод эталонного решения и подсовывает
   проверке программу, которая этот вывод просто печатает построчно, ничего
   не вычисляя. Если урок такое засчитывает — значит его требование держится
   только на выводе, и ребёнок может пройти урок, не поняв ни строчки.

   Находка НЕ равна дефекту. В уроке 1 «напечатай три строки» напечатать три
   строки — это и есть задание, и засчитать его обязаны. Дефект — когда урок
   про цикл, словарь или функцию проходится списком print'ов. Лекарство от
   этого одно и записано в грабле 14: needCode.

   Уроки с рисованием пропускаем: там сверяется рисунок, а не вывод.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require("jsdom")); }
catch (e){ console.log("Нужен jsdom:  npm install jsdom"); process.exit(2); }

const file = path.join(root, "dist/kodokvest.html");
if (!fs.existsSync(file)){ console.log("Сначала собери один файл:  node build.js"); process.exit(1); }

const vc = new VirtualConsole();
const dom = new JSDOM(fs.readFileSync(file, "utf8"),
  { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    url: "https://example.invalid/kodokvest/" });
const w = dom.window, doc = w.document;
w.scrollTo = function(){};
w.confirm = function(){ return true; };
w.requestAnimationFrame = function(){ return 0; };
w.cancelAnimationFrame = function(){};
w.HTMLCanvasElement.prototype.getContext = function(){
  if (this.__ctx) return this.__ctx;
  const noop = function(){};
  this.__ctx = { fillStyle:"", strokeStyle:"", lineWidth:1, lineCap:"", lineJoin:"", font:"",
    setTransform:noop, clearRect:noop, fillRect:noop, strokeRect:noop, beginPath:noop,
    closePath:noop, moveTo:noop, lineTo:noop, arc:noop, stroke:noop, fill:noop, save:noop,
    restore:noop, translate:noop, rotate:noop, scale:noop, fillText:noop,
    measureText:function(){ return { width:0 }; } };
  return this.__ctx;
};
try { w.localStorage.setItem("kodokvest_code", "audit-kid"); } catch(e){}

const tick = (ms) => new Promise(r => setTimeout(r, ms || 12));
const won = () => doc.getElementById("win").classList.contains("show");
const closeWin = () => {
  const b = doc.getElementById("wstay");
  if (b) b.click(); else doc.getElementById("win").classList.remove("show");
};

/* программа-обманка: печатает готовые строки и ничего не считает */
function fakeOf(lines){
  return lines.map(l => "print(" + JSON.stringify(String(l)) + ")").join("\n");
}

(async function(){
  await tick(60);
  const g = w.__game;
  if (!g){ console.log("Игра не запустилась"); process.exit(1); }
  const CUR = w.CURRICULUM, CONTENT = w.CONTENT, MP = w.MiniPy;
  g.state.admin.unlockAll = true;

  const passed = [], skipped = [];
  let checked = 0;

  for (const world of CUR){
    const c = CONTENT["world" + world.n];
    if (!c) continue;
    for (const l of world.lessons){
      const body = c[l.id];
      if (!body) continue;
      const t = body.task;
      if (body.draw){ skipped.push(l.id + " (рисование)"); continue; }
      if (t.files && t.files.length){ skipped.push(l.id + " (много файлов)"); continue; }

      /* эталонный вывод считаем тем же движком, каким его считает проверка */
      const ref = MP.run(t.solution, { stdin: t.stdin || [], files: {} });
      if (ref.error || !ref.output || !ref.output.trim()){ skipped.push(l.id + " (нет вывода)"); continue; }
      const lines = ref.output.replace(/\n+$/, "").split("\n");
      if (lines.length > 40){ skipped.push(l.id + " (вывод длиннее 40 строк)"); continue; }

      checked++;
      g.openLesson(l.id);
      await tick();
      const s = w.__game.getSession();
      const studio = s && s.studio;
      if (!studio){ skipped.push(l.id + " (не открылся)"); continue; }
      studio.editor.setCode(fakeOf(lines));
      const btn = studio.querySelector('[data-role="check"]');
      if (!btn){ skipped.push(l.id + " (нет кнопки)"); continue; }
      btn.click();
      await tick();
      if (won()){
        passed.push({ id: l.id, num: l.num, title: l.title, sub: l.sub,
                      guard: !!(t.needCode || t.noCode || t.needText) });
        closeWin();
      }
    }
  }

  console.log("Уроки, которые засчитывают программу «просто напечатай ответ»:\n");
  passed.forEach(p => console.log(
    `  урок ${String(p.num).padStart(3)}  ${p.id.padEnd(14)} ${p.title} — ${p.sub}`));
  console.log(`\nпроверено уроков: ${checked}, проходится печатью ответа: ${passed.length}`);
  console.log(`пропущено: ${skipped.length} (рисование, многофайловые, без вывода)`);
  console.log("\nСмотреть глазами: для урока про print это норма, для урока про цикл — дыра.");
  process.exit(0);
})();
