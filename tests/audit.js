/* ============================================================
   Редакторский аудит курса. Запуск:  node tests/audit.js
   В npm test НЕ входит: часть находок требует глаз, а не порога.

   Проверяет то, чего не проверяет ни один другой тест: не «работает ли
   код», а «честен ли урок». Четыре независимые проверки, каждая печатает
   свой раздел. Ноль находок — не повод расслабляться, повод дописать
   проверку; каждая из них родилась из настоящего дефекта.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

global.window = {};
let CONTENT = {};
eval(read("js/engine-mini.js"));
eval(read("js/curriculum.js"));
["content/world1.js","content/world2.js","content/world3.js","content/world4.js","content/world5.js"]
  .forEach(f => eval(read(f)));
eval(read("js/cheatsheet.js"));

const MP = global.MiniPy || window.MiniPy;
const noTags = x => String(x || "").replace(/<[^>]*>/g, " ");
const lessonById = id => {
  for (const w of CURRICULUM) { const b = (CONTENT["world" + w.n] || {})[id]; if (b) return { w, b }; }
  return null;
};
let total = 0;
const section = t => console.log("\n\n═══ " + t + " ═══");
const hit = m => { total++; console.log("  • " + m); };
const clean = n => console.log("  (чисто: " + n + ")");

/* ---------- 1. Шпаргалка обещает урок, в котором команды нет ----------
   У каждой записи есть lesson — «урок, где это объясняли». Если в этом уроке
   команда нигде не встречается, справочник врёт ребёнку про его же прогресс:
   запись показана как пройденная, а он её не видел. Именно так `.lower()`
   числился за уроком 7, не появляясь там ни разу. */
section("1. Шпаргалка ссылается на урок, где команды нет");
{
  let ok = 0;
  window.CHEATSHEET.forEach(g => g.items.forEach(it => {
    const found = lessonById(it.lesson);
    if (!found) return hit(`${it.id}: урока «${it.lesson}» вообще нет`);
    const { b } = found;
    const all = [
      (b.theory || []).map(t => [t.demo, t.show, noTags(t.p), noTags(t.h)].join("\n")).join("\n"),
      noTags(b.lede), b.task ? [b.task.solution, b.task.starter, noTags(b.task.goal),
        noTags((b.task.list || []).join(" "))].join("\n") : ""
    ].join("\n");
    /* берём из сигнатуры её опознаваемое ядро: имя функции или метода */
    const m = /\.?([A-Za-z_][A-Za-z_0-9]*)\s*\(/.exec(it.sig);
    const token = m ? m[1] : null;
    if (!token) { ok++; return; }
    if (all.indexOf(token) < 0)
      hit(`${it.id} («${it.sig}») числится за уроком «${it.lesson}», но «${token}» там не встречается`);
    else ok++;
  }));
  if (total === 0) clean(ok + " записей подтверждены");
}

/* ---------- 2. Требование в условии, которое ничем не проверяется ----------
   Грабля 14: «Требование, которое не проверяется, — обман». Проверка вывода
   ловит требование только если его нарушение МЕНЯЕТ вывод. Требование вида
   «сделай через такую-то конструкцию» держится исключительно на needCode.
   Ищем в условии слова-приказы и смотрим, есть ли needCode/noCode/needText. */
section("2. «Сделай через …» в условии без needCode");
{
  const before = total;
  const ORDERS = [
    [/\bчерез (цикл|for|while)\b/i, "for"], [/\bциклом\b/i, "for"],
    [/\bчерез функцию\b/i, "def "], [/\bфункцией\b/i, "def "],
    [/\bf-строк/i, 'f"'], [/\bчерез включени/i, " for "],
    [/\bчерез словарь\b/i, "{"], [/\bиспользуй\b/i, null],
    [/\bне переписывая\b/i, null], [/\bобязательно\b/i, null]
  ];
  CURRICULUM.forEach(w => w.lessons.forEach(l => {
    const b = (CONTENT["world" + w.n] || {})[l.id];
    if (!b || !b.task) return;
    const t = b.task, chk = t.check || {};
    /* Требования читаются ИЗ check — именно оттуда их берёт runCheck. Сам этот
       инструмент сначала смотрел на уровень task и потому врал: урок 6 уже был
       защищён, а проверка продолжала на него ругаться. */
    if (chk.needCode || chk.noCode || chk.needText) return;
    if (chk.kind && chk.kind !== "output") return;             /* скрытые тесты и своя проверка */
    const words = noTags(t.goal) + " " + noTags((t.list || []).join(" "));
    ORDERS.forEach(([re]) => {
      if (re.test(words))
        hit(`урок ${l.num} ${l.id}: условие требует «${(re.exec(words) || [""])[0]}», а needCode нет`);
    });
  }));
  if (total === before) clean("все требования подкреплены");
}

/* ---------- 3. Первая подсказка выдаёт готовый ответ ----------
   Подсказки идут по нарастающей и стоят звезду. Если ПЕРВАЯ содержит целую
   строку решения, платить приходится сразу за всё, и ступенек нет. */
section("3. Первая подсказка содержит готовую строку решения");
{
  const before = total;
  CURRICULUM.forEach(w => w.lessons.forEach(l => {
    const b = (CONTENT["world" + w.n] || {})[l.id];
    if (!b || !b.task || !(b.task.hints || []).length) return;
    const first = String(b.task.hints[0]);
    const lines = String(b.task.solution || "").split("\n")
      .map(x => x.trim()).filter(x => x.length > 12 && !x.startsWith("#"));
    const leaked = lines.filter(x => first.indexOf(x) >= 0);
    /* Одна выданная строка из длинного решения — нормальный первый толчок.
       Важна ДОЛЯ: если первая подсказка выдаёт половину работы, ступенек нет
       и звезда снимается сразу за всё. */
    const share = lines.length ? leaked.length / lines.length : 0;
    if (share >= 0.34)
      hit(`урок ${l.num} ${l.id}: первая подсказка выдаёт ${leaked.length} из ${lines.length} строк решения — «${leaked[0].slice(0, 46)}»`);
  }));
  if (total === before) clean("первые подсказки никого не выдают");
}

/* ---------- 4. Пример в теории, который ничего не печатает ----------
   Карточка с примером, который молчит, читается как сломанная: ребёнок жмёт
   «Запустить пример» и не видит ничего. Исключение — рисование черепашкой
   и примеры, помеченные err:true (они и должны падать). */
section("4. Пример теории без вывода");
{
  const before = total;
  CURRICULUM.forEach(w => w.lessons.forEach(l => {
    const b = (CONTENT["world" + w.n] || {})[l.id];
    if (!b || b.draw) return;
    (b.theory || []).forEach((t, i) => {
      if (!t.demo || t.err) return;
      const r = MP.run(t.demo, { turtle: new MP.Turtle(), sources: t.files || {},
                                 files: t.data || {}, stdin: t.stdin || [] });
      if (!r.error && (!r.output || !r.output.trim()))
        hit(`урок ${l.num} ${l.id}, пример ${i + 1} «${t.h}»: ничего не печатает`);
    });
  }));
  if (total === before) clean("все примеры что-то печатают");
}

/* ---------- 5. Строка вывода, обещанная в условии, расходится с эталоном ----------
   Условие обещает «Слов: 12», а эталон печатает «Слов: 11» — и все проверки
   зелёные, потому что вывод ребёнка сверяется с ЭТАЛОНОМ, а не с текстом
   условия. Ребёнок пишет правильную программу, видит другое число и решает,
   что ошибся он. Найдено ровно так в уроке 39.

   Сравниваем только то, что урок обещает ДОСЛОВНО, — куски в <code>. Это и
   есть граница между «вот такая строка напечатается» и «напечатай строк: и
   число строк»: второе — описание, а не обещание, и сверять его не с чем.
   Первая версия проверки этой границы не знала и выдала полсотни пустых
   находок на нормальных уроках.

   Уроки со случайностью пропускаем: там пример в условии заведомо не равен
   тому, что напечатается, и об этом в самом условии написано. */
section("5. Условие обещает не то, что печатает эталон");
{
  const before = total;
  const СЛУЧАЙ = /randint|choice|shuffle|sample|random/;
  CURRICULUM.forEach(w => w.lessons.forEach(l => {
    const b = (CONTENT["world" + w.n] || {})[l.id];
    if (!b || !b.task || b.draw) return;
    const код = [b.task.solution, (b.task.files || []).map(f => f.solution || f.starter).join("\n")].join("\n");
    if (СЛУЧАЙ.test(код)) return;
    let вывод = "";
    try {
      const r = MP.run(b.task.solution, { turtle: new MP.Turtle(), sources: b.task.files || {},
                                          files: b.task.data || {}, stdin: b.task.stdin || [] });
      if (r.error) return;
      вывод = r.output || "";
    } catch(e){ return; }
    const строки = вывод.split("\n").map(x => x.trim()).filter(Boolean);
    const сырое = [b.task.goal].concat(b.task.list || []).join(" ⟂ ");
    /* Пробелы внутри <code> НЕ схлопываем: с 1.36.5 стили их сохраняют
       (white-space:pre-wrap), и теперь выравнивание в условии — это обещание
       ровно тех пробелов, что напечатает программа. */
    const обещания = (сырое.match(/<code>([\s\S]*?)<\/code>/g) || [])
      .map(x => x.replace(/<[^>]*>/g, "").replace(/^\n+|\n+$/g, "").trim());
    обещания.forEach(o => {
      /* Отдельная ловушка — ПРОБЕЛЫ. Урок 40 обещал «Вика␣␣␣␣9», а программа
         печатает «Вика␣␣␣␣␣9»: имя дополнено до ширины 8, и ещё один пробел
         стоит между именем и числом. Пока стили схлопывали пробелы, разницы
         не было видно вообще; теперь они сохраняются, и промах виден глазом.
         Ловим по схлопнутому сравнению: строка та же, а пробелы другие. */
      const сжать = x => x.replace(/\s+/g, " ").trim();
      const почти = строки.filter(x => сжать(x) === сжать(o) && x.trim() !== o.trim());
      if (почти.length && строки.every(x => x.trim() !== o.trim()))
        return hit(`урок ${l.num} ${l.id}: условие показывает «${o.replace(/ /g, "␣")}», ` +
                   `а печатается «${почти[0].trim().replace(/ /g, "␣")}» — не те пробелы`);
      const m = /^(.{2,40}?):\s*(\S.*)$/.exec(o);
      if (!m) return;
      const ключ = m[1].trim(), обещано = m[2].trim();
      const свои = строки.filter(x => x.indexOf(ключ + ":") === 0);
      if (!свои.length) return;             /* про такую строку эталон молчит */
      if (свои.some(x => x.slice(ключ.length + 1).trim() === обещано)) return;
      hit(`урок ${l.num} ${l.id}: условие обещает «${o}», а эталон печатает ` +
          свои.slice(0, 2).map(x => `«${x}»`).join(" и "));
    });
  }));
  if (total === before) clean("обещанные строки совпадают с выводом эталонов");
}

/* ---------- 6. Задание списано с примера того же урока ----------
   Если эталон решения слово в слово повторяет пример из теории, ребёнок
   не решает задачу, а переписывает её сверху вниз.

   Задания «починить» тут не считаются: у них эталон И ОБЯЗАН быть похож на
   правильный пример — чинят как раз до него. Первая версия проверки этого
   не знала и ругалась на урок 28, где всё в порядке. */
section("6. Решение задания повторяет пример из теории");
{
  const before = total;
  const норм = c => String(c || "").replace(/#[^\n]*/g, "").replace(/\s+/g, " ").trim();
  CURRICULUM.forEach(w => w.lessons.forEach(l => {
    const b = (CONTENT["world" + w.n] || {})[l.id];
    if (!b || !b.task || b.task.type === "fix") return;
    const реш = норм(b.task.solution);
    if (реш.length < 20) return;
    (b.theory || []).forEach((t, i) => {
      /* Вместе с примером урок иногда возит ФАЙЛЫ модуля (t.files) — и ответ
         на задание может лежать там, а не в самом примере. Так вышло с уроком
         48: теория показывала tools.py с готовой clean(), а задание просило
         написать ровно её. Поэтому смотрим и demo, и файлы примера. */
      const исходник = [String(t.demo || t.show || "")]
        .concat(Object.keys(t.files || {}).map(k => t.files[k])).join("\n");
      const пример = норм(исходник);
      if (!пример) return;
      if (пример === реш)
        return hit(`урок ${l.num} ${l.id}: решение слово в слово повторяет пример ${i + 1} «${t.h}»`);
      const a1 = реш.split(" "), a2 = пример.split(" ");
      if (Math.abs(a1.length - a2.length) <= 3){
        const общие = a1.filter(x => a2.indexOf(x) >= 0).length;
        if (a1.length >= 8 && общие / a1.length > 0.92)
          return hit(`урок ${l.num} ${l.id}: решение почти совпадает с примером ${i + 1} «${t.h}» — задание списано`);
      }
      /* И третий случай, которого первые две ветки не видят: задание просит
         НАПИСАТЬ функцию, а она уже написана в примере той же теории — с тем
         же именем И тем же телом. Так вышло с боссом мира 1: урок показывал
         def square(size) целиком, а потом просил её написать.

         Требуем совпадения ТЕЛА, а не только имени. По одному имени шума
         больше, чем смысла: __init__, __repr__, main и inner повторяются в
         каждом втором уроке про классы и декораторы — и это нормально,
         там переписывают их заново, а не копируют. */
      const блоки = [];
      const строки = исходник.split("\n");
      for (let k = 0; k < строки.length; k++){
        const шапка = /^(\s*)(?:def|class)\s+([\w А-Яа-яЁё]+)/.exec(строки[k]);
        if (!шапка) continue;
        const отступ = шапка[1].length;
        let до = k + 1;
        while (до < строки.length &&
               (!строки[до].trim() || строки[до].search(/\S/) > отступ)) до++;
        while (до > k + 1 && !строки[до - 1].trim()) до--;
        блоки.push({ имя: шапка[2].trim(), код: строки.slice(k, до).join("\n") });
      }
      /* И сравнивать надо не только с main.py: у многофайлового задания
         ответ лежит в его собственных файлах (task.files[].solution). */
      const весьОтвет = [String(b.task.solution)]
        .concat((b.task.files || []).map(f => f.solution || "")).join("\n");
      /* А то, что уже лежит в ЗАГОТОВКЕ, ребёнок и не пишет: класс Fighter
         в уроке 59 выдан готовым, задание — про Knight и fight. Повторять
         выданное в теории не только можно, но и нужно. */
      const выдано = [String(b.task.starter || "")]
        .concat((b.task.files || []).map(f => f.starter || "")).join("\n");
      /* Условие задания словами: если оно ПРЯМО называет функцию («напиши
         clean(text)»), то хватит и двух строк совпадения — это ответ, лежащий
         на виду. Если не называет, требуем трёх: короткие безымянные куски
         вроде __init__ из трёх присваиваний переиспользуются законно. */
      const условиеСловами = noTags([b.task.goal].concat(b.task.list || []).join(" "));
      блоки.forEach(бл => {
        const названа = new RegExp("(^|[^\\wА-Яа-яЁё])" +
          бл.имя.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(").test(условиеСловами);
        if (бл.код.split("\n").length < (названа ? 2 : 3)) return;
        if (весьОтвет.indexOf(бл.код) < 0) return;
        if (выдано.indexOf(бл.код) >= 0) return;
        hit(`урок ${l.num} ${l.id}: «${бл.имя}» в примере ${i + 1} «${t.h}» ` +
            `и в решении — один и тот же код слово в слово` +
            (названа ? ", а условие прямо просит её написать" : "") +
            ` — писать ребёнку нечего`);
      });
    });
  }));
  if (total === before) clean("задания не списаны с примеров");
}

console.log("\n\nвсего находок: " + total + (total ? "  — смотреть глазами, порога тут нет" : ""));
