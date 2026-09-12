/* ============================================================
   Фионика — «Проверка: что умеет сам».

   ЗАЧЕМ. Замер конкурентов 12.09.2026 (docs/market-research.md, «Замер от
   12.09.2026») нашёл дыру, которую никто из них не может закрыть своей же
   моделью: родитель платит школе программирования или репетитору 5–9 тыс. ₽
   в месяц, а узнать, что ребёнок умеет САМ, может только у того же, кому
   платит. Школа оценивает себя сама. Яндексу и Stepik нужен аккаунт ребёнка,
   КомпЕГЭ сверяет число в ответе, а не программу, у Stepik нет родителя.
   Независимой проверки нет ни у кого — и у продающего курс её не будет
   никогда: это конфликт интересов, а не недосмотр.

   ЧТО ЭТО. Десять ступеней по нарастающей, на каждой одна задача-близнец из
   банка домашки (js/homework.js): условие словами, ответ считает эталон,
   сверяется напечатанное. Подсказок нет, попыток три, «Не знаю — дальше» —
   честный ответ. После двух нерешённых ступеней подряд проверка кончается
   сама: дальше она мерила бы не умение, а терпение.

   ⚠️ ИТОГ ЖИВЁТ В КОДЕ, А НЕ НА СЕРВЕРЕ. Шестнадцать знаков несут всё: день,
   семя задач, минуты и по три бита на ступень (решено ли, с какой попытки,
   вставлен ли код). Ребёнок диктует код или шлёт ссылку `#proverka=КОД` —
   и итог открывается на телефоне взрослого без регистрации, без сети после
   первой загрузки и без единого байта о ребёнке у нас. Это то самое, чего
   аккаунтные платформы повторить не могут.

   ⚠️ ТАБЛИЦА СТУПЕНЕЙ ЗАМОРОЖЕНА ВЕРСИЕЙ. Код, выданный сегодня, обязан
   открываться через год тем же итогом. Поэтому ступени, их порядок и состав
   задач — версия 1, и тест сверяет их с записанным слепком. Нужна другая
   лестница — заводи версию 2 рядом, а не правь эту: старые коды иначе
   молча покажут чужие задачи.

   ⚠️ ЧЕГО ЗДЕСЬ НЕТ: баллов и отметок. Школьной оценки из десяти задач не
   вывести, и выдумать её — ровно то враньё, от которого эта проверка и
   должна защищать. Итог говорит проверяемое: какие ступени сам, какие нет.

   Договор — тот же, что в шапке js/screens-showcase.js: всё чужое приходит
   объектом A; общее состояние файл пишет только через A.proverkaSet.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.proverka = function(A){

var VER = 1;
var TRIES = 3;         /* попыток на ступень: одна опечатка не должна стоить ступени */
var STOP_AFTER = 2;    /* нерешённых подряд — и проверка кончается сама */

/* ---- лестница, версия 1 (заморожена, см. шапку) ----
   what — умение словами для взрослого, который Python не знает.
   pool — задачи-близнецы; семя проверки выбирает одну. */
var RUNGS = [
  { t:"Счёт",      em:"🔢", what:"считает программой: переменные, умножение, деление с остатком",
    pool:["hw-klass", "hw-konfety"] },
  { t:"Текст",     em:"🔤", what:"работает с текстом: собирает строку из слов и чисел, меняет буквы",
    pool:["hw-chek", "hw-slovo"] },
  { t:"Условие",   em:"🚦", what:"программа сама выбирает, что делать: if, elif, else",
    pool:["hw-bilet"] },
  { t:"Повтор",    em:"🔁", what:"повторяет действие нужное число раз: цикл for",
    pool:["hw-summa-do", "hw-tablica", "hw-lesenka"] },
  { t:"Цикл до события", em:"⏳", what:"крутит цикл, пока не случится нужное: while и break",
    pool:["hw-kopilka", "hw-pervoe"] },
  { t:"Списки",    em:"📋", what:"хранит много значений в списке, обходит и сортирует их",
    pool:["hw-ocenki", "hw-spisok-rastet", "hw-top"] },
  { t:"Функции",   em:"🧩", what:"пишет свою функцию с параметрами и return",
    pool:["hw-funkciya", "hw-fn-skidka"] },
  { t:"Словари",   em:"📒", what:"находит значение по ключу и считает по словарю",
    pool:["hw-dnevnik", "hw-korzina", "hw-glasnye"] },
  { t:"Ошибки",    em:"🛟", what:"программа не падает на плохих данных: try, except, raise",
    pool:["hw-try", "hw-raise"] },
  { t:"Классы",    em:"🏗", what:"описывает свой тип объекта: class и методы",
    pool:["hw-score", "hw-class"] }
];

/* ---- задачи ступеней ---- */
function taskOf(seed, i){
  var r = RUNGS[i];
  if (!r || !window.HW) return null;
  var id = r.pool[HW.hash("proverka|" + seed + "|" + i) % r.pool.length];
  var item = HW.byId(id);
  if (!item) return null;
  var b = HW.build(item, seed, A.hwRunner);
  return (b && !b.error) ? b : null;
}
/* Урок курса, где умение ступени объясняется: самый ранний из уроков её задач. */
function lessonOf(i){
  var best = null;
  RUNGS[i].pool.forEach(function(id){
    var item = window.HW && HW.byId(id);
    var l = item && CURRICULUM.byId(item.after);
    if (l && (!best || l.num < best.num)) best = l;
  });
  return best;
}
function worldOfLesson(id){
  for (var i = 0; i < CURRICULUM.length; i++)
    for (var j = 0; j < CURRICULUM[i].lessons.length; j++)
      if (CURRICULUM[i].lessons[j].id === id) return CURRICULUM[i];
  return null;
}

/* ---- код результата ----
   80 бит = 16 знаков по 5 бит из азбуки кода варианта (без 0/O и 1/I: код
   диктуют голосом и переписывают от руки).
     версия 3 · день от 01.01.2026 12 · семя 20 · минуты 6 ·
     10 ступеней × (итог 2 + вставка 1) · контрольная сумма 9
   Итог ступени: 0 — не дошли, 1 — не решил, 2 — решил со 2–3 попытки,
   3 — с первой. ⚠️ Контрольная сумма нужна не для красоты: переписанный с
   ошибкой код без неё открыл бы ЧУЖОЙ итог, и взрослый поверил бы ему. */
var ABC = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
var DAY0 = Date.UTC(2026, 0, 1);
function clamp(n, lo, hi){ n = Math.floor(Number(n) || 0); return n < lo ? lo : (n > hi ? hi : n); }
function bitsPush(b, n, w){ for (var i = w - 1; i >= 0; i--) b.push(Math.floor(n / Math.pow(2, i)) % 2); }
function bitsTake(b, pos, w){ var n = 0; for (var i = 0; i < w; i++) n = n * 2 + b[pos + i]; return n; }
/* ⚠️ Хэш с перемешиванием, а не «h*33 ^ бит»: у того опечатка в одном знаке
   проскакивала в 1,7% случаев (замер тестом), а должна — примерно в одном из
   пятисот, как и положено девяти битам. */
function bitsSum(b, len){
  var h = 2166136261;
  for (var i = 0; i < len; i++){ h ^= b[i] + 1; h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return (h >>> 0) % 512;
}
function pack(res){
  var b = [];
  bitsPush(b, VER, 3);
  bitsPush(b, clamp(res.day, 0, 4095), 12);
  bitsPush(b, clamp(res.seed, 0, 1048575), 20);
  bitsPush(b, clamp(res.mins, 0, 63), 6);
  for (var i = 0; i < RUNGS.length; i++){
    var r = res.rungs[i] || {};
    bitsPush(b, clamp(r.st, 0, 3), 2);
    bitsPush(b, r.paste ? 1 : 0, 1);
  }
  bitsPush(b, bitsSum(b, b.length), 9);
  var s = "";
  for (var k = 0; k < 16; k++){
    if (k && k % 4 === 0) s += "-";
    s += ABC.charAt(bitsTake(b, k * 5, 5));
  }
  return s;
}
function unpack(raw){
  var t = String(raw == null ? "" : raw).toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (t.length !== 16) return null;
  var b = [];
  for (var k = 0; k < 16; k++){
    var n = ABC.indexOf(t.charAt(k));
    if (n < 0) return null;
    bitsPush(b, n, 5);
  }
  if (bitsTake(b, 71, 9) !== bitsSum(b, 71)) return null;
  if (bitsTake(b, 0, 3) !== VER) return null;
  var res = { day: bitsTake(b, 3, 12), seed: bitsTake(b, 15, 20), mins: bitsTake(b, 35, 6), rungs: [] };
  for (var i = 0; i < RUNGS.length; i++)
    res.rungs.push({ st: bitsTake(b, 41 + i * 3, 2), paste: bitsTake(b, 43 + i * 3, 1) });
  return res;
}
function dayOf(ts){ return clamp((ts - DAY0) / 864e5, 0, 4095); }
function dateText(day){
  var d = new Date(DAY0 + day * 864e5), p = function(x){ return (x < 10 ? "0" : "") + x; };
  return p(d.getUTCDate()) + "." + p(d.getUTCMonth() + 1) + "." + d.getUTCFullYear();
}

/* ---- свод по итогу ----
   «Твёрдо» — решено САМ: без вставленного кода. Считается подряд с первой
   ступени, потому что лестница по нарастающей: классы без циклов — не
   умение, а удача. Решённое выше дыры называется отдельно, не пропадает. */
function solid(r){ return r.st >= 2 && !r.paste; }
function tallyOf(res){
  var t = { firm: 0, above: [], pasted: 0, reached: 0, shaky: -1 };
  var gap = false;
  res.rungs.forEach(function(r, i){
    if (r.st) t.reached++;
    if (r.paste && r.st >= 2) t.pasted++;
    if (!gap && solid(r)) t.firm++;
    else {
      if (!gap) t.shaky = i;
      gap = true;
      if (solid(r)) t.above.push(i);
    }
  });
  return t;
}

/* ---- живая проверка ---- */
function cur(){
  var p = A.proverkaGet();
  return (p && p.v === VER && Array.isArray(p.rungs) && p.rungs.length === RUNGS.length) ? p : null;
}
function live(){ var p = cur(); return p && !p.closed ? p : null; }
function start(){
  var p = { v: VER, seed: Math.floor(Math.random() * 1048576), at: Date.now(), i: 0,
            closed: 0, code: "", t0: 0,
            rungs: RUNGS.map(function(){ return { st: 0, paste: 0, tries: 0, ms: 0 }; }) };
  A.proverkaSet(p);
  return p;
}
function resultOf(p){
  var ms = 0;
  p.rungs.forEach(function(r){ ms += r.ms || 0; });
  return { day: dayOf(p.at), seed: p.seed, mins: Math.round(ms / 60000),
           rungs: p.rungs.map(function(r){ return { st: r.st, paste: r.paste }; }) };
}
function close(p){
  p.closed = 1;
  p.code = pack(resultOf(p));
  A.proverkaSet(p);
  return p;
}
/* Ступень кончилась: записать итог и решить, идём ли дальше.
   ⚠️ Время на ступень — с потолком в полчаса: вкладка, забытая открытой на
   ночь, не должна превращать проверку в «заняла девять часов». */
var flash = "";
function finishRung(p, st, paste){
  var r = p.rungs[p.i];
  r.st = st; r.paste = paste ? 1 : 0;
  r.ms = Math.min(30 * 60000, Math.max(0, Date.now() - (p.t0 || Date.now())));
  flash = (st >= 2 ? "✓ Ступень «" + RUNGS[p.i].t + "» засчитана" : "Ступень «" + RUNGS[p.i].t + "» не засчитана — идём дальше");
  /* Последние STOP_AFTER ступеней подряд — «не решил»? Тогда хватит. */
  var stop = p.i + 1 >= STOP_AFTER;
  for (var k = 0; stop && k < STOP_AFTER; k++) stop = p.rungs[p.i - k].st === 1;
  p.i++; p.t0 = 0;
  if (stop || p.i >= RUNGS.length){ close(p); flash = ""; return screenReport(p.code, "", true); }
  A.proverkaSet(p);
  screenRung();
}

/* ===== экран: вход ===== */
function screenProverka(){
  if (live()) return screenRung();
  screenIntro();
}
function screenIntro(msg){
  A.enterScreen("train", "proverka");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  var last = cur();
  var h = '<div class="lvlhead"><div><div class="idx">без регистрации · без баллов</div>' +
    '<h1>🔎 Проверка: что умеет сам</h1></div>' +
    '<div class="right">' + A.qm("proverka", "Что такое проверка") + '</div></div>' +
    '<p class="lede">Десять ступеней по нарастающей — от счёта до классов. На каждой одна задача: ' +
    'написать программу. После двух нерешённых подряд проверка кончается сама.</p>';

  h += '<div class="vexams">' +
    '<div class="card"><h3>🧒 Для того, кто проходит</h3><ul class="trrules">' +
    '<li><b>Подсказок нет.</b> Это проверка, а не урок: она узнаёт, что ты умеешь сейчас.</li>' +
    '<li><b>На задачу три попытки.</b> Запускать свою программу можно сколько угодно — попыткой считается только «Сдать».</li>' +
    '<li><b>«Не знаю — дальше» — честный ответ.</b> Угадывать не надо: пропущенная ступень скажет взрослому больше, чем списанная.</li>' +
    '</ul></div>' +
    '<div class="card"><h3>🧑 Для взрослого</h3><ul class="trrules">' +
    '<li><b>Неважно, где ребёнок учится</b> — у нас, в школе программирования или с репетитором. Задачи не привязаны к нашим урокам.</li>' +
    '<li><b>Сядьте рядом и не подсказывайте.</b> Начинающий закончит минут за десять, уверенный — за сорок.</li>' +
    '<li><b>В конце будет код.</b> По нему итог откроется на вашем телефоне. О ребёнке мы не храним ничего: весь итог — в самом коде.</li>' +
    '</ul></div></div>';

  h += '<div class="pager"><button class="bigbtn" id="prvgo">Начать проверку →</button></div>';

  if (last && last.closed && last.code)
    h += '<div class="card"><h3>Прошлая проверка на этом устройстве</h3>' +
      '<p>От ' + dateText(dayOf(last.at)) + ', код <b class="prvinline">' + A.esc(last.code) + '</b>.</p>' +
      '<div class="admrow"><button class="bigbtn ghost" id="prvlast">Открыть итог</button></div></div>';

  h += '<div class="card"><h3>🔤 У меня есть код результата</h3>' +
    '<p class="dim">Ребёнок прошёл проверку на своём устройстве и продиктовал код — впишите его, ' +
    'и откроется тот же итог. Регистрация не нужна.</p>' +
    '<div class="admrow"><input id="prvcode" class="prvinput" maxlength="19" ' +
    'placeholder="ABCD-EFGH-JKLM-NPQR" autocomplete="off" spellcheck="false">' +
    '<button class="bigbtn ghost" id="prvopen">Показать итог</button></div>' +
    '<div class="msg' + (msg ? ' show bad' : '') + '" id="prvmsg">' + (msg || "") + '</div></div>';

  h += '<div class="pager"><button class="bigbtn ghost" id="tovtrain">← К тренировкам</button></div>';
  A.app.innerHTML = h;

  document.getElementById("prvgo").onclick = function(){ start(); flash = ""; screenRung(); };
  var lb = document.getElementById("prvlast");
  if (lb) lb.onclick = function(){ screenReport(last.code, "", true); };
  var inp = document.getElementById("prvcode");
  var open = function(){
    if (unpack(inp.value)) return screenReport(inp.value, "");
    var m = document.getElementById("prvmsg");
    m.className = "msg show bad";
    m.innerHTML = badCodeHTML(inp.value);
  };
  document.getElementById("prvopen").onclick = open;
  inp.addEventListener("keydown", function(e){ if (e.key === "Enter") open(); });
  document.getElementById("tovtrain").onclick = A.screenTrain;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}
function badCodeHTML(raw){
  return "<b>Код не открылся</b>Нужно шестнадцать знаков: цифры 2–9 и заглавные латинские буквы " +
    "(нуля, единицы, букв O и I в коде не бывает). Скорее всего, одна буква переписана с ошибкой — " +
    "мы это видим по контрольной сумме и потому не показываем чужой итог. Набрано: <code>" +
    A.esc(String(raw || "")) + "</code>.";
}

/* ===== экран: ступень ===== */
function ladderHTML(p){
  return '<div class="prvladder">' + RUNGS.map(function(r, i){
    var cls = i === p.i ? "now" : (i < p.i ? (p.rungs[i].st >= 2 ? "ok" : "miss") : "");
    return '<span class="' + cls + '" title="' + A.esc(r.t) + '">' + (i + 1) + '</span>';
  }).join("") + '</div>';
}
function screenRung(){
  var p = live();
  if (!p) return screenIntro();
  var task = taskOf(p.seed, p.i);
  /* Задачи ступени не собралось — такое возможно только после поломки банка.
     Ступень не выбрасываем молча: считаем её «не дошли» и идём дальше. */
  if (!task){ p.i++; if (p.i >= RUNGS.length){ close(p); return screenReport(p.code, "", true); }
              A.proverkaSet(p); return screenRung(); }
  if (!p.t0){ p.t0 = Date.now(); A.proverkaSet(p); }
  A.enterScreen("train", "proverka");
  var rung = RUNGS[p.i], r = p.rungs[p.i];
  var left = TRIES - (r.tries || 0);

  var h = '<div class="lvlhead"><div><div class="idx">проверка · ступень ' + (p.i + 1) + ' из ' + RUNGS.length + '</div>' +
    '<h1>' + rung.em + ' ' + A.esc(rung.t) + '</h1></div>' +
    '<div class="right"><span class="tag" id="prvleft">' + left + ' ' +
      A.plural(left, "попытка", "попытки", "попыток") + '</span>' +
      A.qm("proverka", "Что такое проверка") + '</div></div>' +
    ladderHTML(p) +
    (flash ? '<div class="note prvflash">' + A.esc(flash) + '</div>' : '') +
    '<div class="goal"><h3>🎯 ' + A.esc(task.title) + '</h3><p>' + A.esc(task.goal) + '</p><ul>' +
    (task.list || []).map(function(x){ return "<li>" + A.esc(x) + "</li>"; }).join("") +
    '</ul></div><div id="studio"></div>' +
    '<div class="pager"><button class="bigbtn ghost" id="prvskip">Не знаю — дальше</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="prvstop">Закончить проверку</button></div>';
  flash = "";
  A.app.innerHTML = h;

  A.newSession({ id:null, attempts: r.tries || 0, hints:0, shown:false });
  var studio = A.makeStudio({
    engine: "mini", code: task.starter, label: "твоя программа", checkLabel: "✓ Сдать ответ",
    check: function(ed, showMsg){ check(p, task, ed, showMsg, studio); }
  });
  document.getElementById("studio").appendChild(studio);
  /* Что вставлять законно: заготовка и само условие. Остальная вставка —
     сигнал «код пришёл готовым», тот же, что у записи работы в уроках. */
  studio.editor.knownText = task.starter + "\n" + task.goal;
  var sess = A.session();
  sess.studio = studio;
  sess.lesson = "proverka-" + p.seed + "-" + p.i;
  sess.starter = [{ name:"main.py", code: task.starter }];
  var d = A.draftGet(sess.lesson);
  if (d) A.draftApply(studio.editor, d.files);
  studio.editor.onEdit = A.draftSchedule;

  document.getElementById("prvskip").onclick = function(){
    var yes = true;
    try { yes = confirm("Пропустить ступень «" + rung.t + "»? Вернуться к ней в этой проверке будет нельзя."); } catch(e){}
    if (yes) finishRung(p, 1, 0);
  };
  document.getElementById("prvstop").onclick = function(){
    var yes = true;
    try { yes = confirm("Закончить проверку сейчас? Итог покажет пройденные ступени, остальные будут «не дошли»."); } catch(e){}
    if (!yes) return;
    close(p);
    screenReport(p.code, "", true);
  };
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* Судья ступени.
   ⚠️ Он МОЛЧИТ о правильном выводе: показать, что нужно было напечатать, —
   значит решить за ребёнка. Но одно он говорит, и это честно: если числа
   совпали, а оформление нет, ступень не должна сгорать на запятой — ребёнок
   из другой школы привык печатать «Ответ: 90», а умение у него есть. */
function numbersIn(lines){
  var m = lines.join("\n").match(/-?\d+(\.\d+)?/g);
  return m ? m.join(" ") : "";
}
function check(p, task, ed, showMsg, studio){
  var code = ed.getCode();
  var i;
  for (i = 0; i < (task.need || []).length; i++)
    if (!A.codeHas(code, task.need[i])){
      showMsg("warn", "<b>Попытка не засчитана</b>" + A.esc(task.needMsg ||
        "В условии сказано, какой конструкцией решать, — в программе её пока нет."));
      return;
    }
  for (i = 0; i < (task.ban || []).length; i++)
    if (A.codeHas(code, task.ban[i])){
      showMsg("warn", "<b>Попытка не засчитана</b>" + A.esc(task.banMsg || "Эта конструкция в задаче запрещена."));
      return;
    }
  var r = p.rungs[p.i];
  r.tries = (r.tries || 0) + 1;
  A.proverkaSet(p);
  var res = A.hwRunner(code), got = res.lines || [], exp = task.lines;
  var ok = !res.error && exp.length === got.length && exp.every(function(x, k){ return x === got[k]; });
  if (ok){
    var paste = (studio.editor.trace && studio.editor.trace.pasted || 0) >= A.pasteMin();
    A.markActiveToday();
    return finishRung(p, r.tries === 1 ? 3 : 2, paste);
  }
  var left = TRIES - r.tries;
  if (left <= 0) return finishRung(p, 1, 0);
  var el = document.getElementById("prvleft");
  if (el) el.textContent = left + " " + A.plural(left, "попытка", "попытки", "попыток");
  if (res.error){ ed.setError(res.error.line); showMsg("bad", A.errHTML(res.error) +
    '<p class="dim">Осталось попыток: ' + left + '.</p>'); return; }
  var nums = numbersIn(exp) && numbersIn(exp) === numbersIn(got);
  showMsg("bad", nums
    ? "<b>Числа верные, оформление — нет</b>Перечитай условие: сколько строк и в каком виде печатать. Осталось попыток: " + left + "."
    : "<b>Не сошлось</b>Программа напечатала не то, что просили. Запусти её и сравни с условием. Осталось попыток: " + left + ".");
}

/* ===== экран: итог ===== */
function resultLabel(r){
  if (r.st >= 2 && r.paste) return { cls:"part", text:"решено, но часть кода вставлена" };
  if (r.st === 3) return { cls:"yes", text:"сам, с первой попытки" };
  if (r.st === 2) return { cls:"yes", text:"сам, не с первой попытки" };
  if (r.st === 1) return { cls:"miss", text:"не решил" };
  return { cls:"no", text:"не дошли" };
}
function screenReport(rawCode, rawPrev, mine){
  var res = unpack(rawCode);
  if (!res) return screenIntro(badCodeHTML(rawCode));
  var code = pack(res);
  var prev = rawPrev ? unpack(rawPrev) : null;
  A.enterScreen("train", "proverka");
  A.setRoute("#proverka=" + code, "Итог проверки от " + dateText(res.day));
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  var t = tallyOf(res), n = RUNGS.length;
  var pt = prev ? tallyOf(prev) : null;

  var h = '<div class="lvlhead"><div><div class="idx">итог проверки от ' + dateText(res.day) + '</div>' +
    '<h1>🔎 Что умеет сам</h1></div>' +
    '<div class="right">' + A.qm("proverka", "Что такое проверка") + '</div></div>';

  h += '<div class="card"><h3>Код результата</h3>' +
    '<div class="prvcode">' + A.esc(code) + '</div>' +
    '<p class="dim">По этому коду тот же итог откроется на любом устройстве: «Тренировки» → «Проверка» → ' +
    '«У меня есть код». Или отправьте ссылкой. Сервер для этого не нужен — всё в самих знаках.</p>' +
    '<div class="admrow"><button class="bigbtn ghost" id="prvcopy">Скопировать ссылку на итог</button></div></div>';

  h += '<div class="card"><h3>' + (t.firm
      ? 'Уверенно сам: ' + t.firm + ' ' + A.plural(t.firm, "ступень", "ступени", "ступеней") + ' из ' + n + ' подряд'
      : 'Твёрдых ступеней пока нет') + '</h3>' +
    (t.firm
      ? '<p>Последняя твёрдая — «' + A.esc(RUNGS[t.firm - 1].t) + '»: ' + A.esc(RUNGS[t.firm - 1].what) + '.</p>'
      : '<p>Это тоже ответ, и полезный: начинать стоит с первой ступени, а не с середины курса.</p>') +
    (t.above.length
      ? '<p>Выше первой шаткой ступени решено ещё: ' + t.above.map(function(i){ return "«" + A.esc(RUNGS[i].t) + "»"; }).join(", ") +
        '. Такое бывает, когда тему проходили, а основание под ней не закрепили.</p>' : '') +
    (t.pasted
      ? '<p>⚠️ На ' + t.pasted + ' ' + A.plural(t.pasted, "ступени", "ступенях", "ступенях") +
        ' код пришёл вставкой, а не был набран. Такие ступени в «уверенно сам» не входят.</p>' : '') +
    (pt
      ? '<p>📈 <b>Прошлая проверка от ' + dateText(prev.day) + ': ' + pt.firm + ' из ' + n + '. Сейчас: ' + t.firm + ' из ' + n + '.</b></p>' : '') +
    '<p class="dim">Проверка заняла ' + (res.mins ? res.mins + ' ' + A.plural(res.mins, "минуту", "минуты", "минут") : 'меньше минуты') +
    '; пройдено ступеней: ' + t.reached + ' из ' + n + '.</p></div>';

  h += '<div class="exmap">';
  RUNGS.forEach(function(rg, i){
    var lb = resultLabel(res.rungs[i]);
    var was = prev ? resultLabel(prev.rungs[i]) : null;
    h += '<div class="exrow prv-' + lb.cls + '"><span class="exn">' + (i + 1) + '</span>' +
      '<span class="ext">' + rg.em + ' ' + A.esc(rg.t) + '<span class="vartask">' + A.esc(rg.what) + '</span></span>' +
      '<span class="exact"><span class="excnt">' + (was ? A.esc(was.text) + ' → ' : '') + '<b>' + A.esc(lb.text) + '</b></span></span></div>';
  });
  h += '</div>';

  if (t.shaky >= 0){
    var l = lessonOf(t.shaky), w = l ? worldOfLesson(l.id) : null;
    h += '<div class="card"><h3>С чего продолжать</h3>' +
      '<p>Первая шаткая ступень — <b>«' + A.esc(RUNGS[t.shaky].t) + '»</b>: ' + A.esc(RUNGS[t.shaky].what) + '.</p>' +
      (l && w ? '<p>В курсе Фионики это умение разбирается в уроке «' + A.esc(l.title) + '» — урок ' + l.num +
        ' из 100, мир ' + w.n + ' «' + A.esc(w.title) + '».</p>' : '') +
      '<p class="dim">Если ребёнок занимается с репетитором или в школе программирования — покажите им этот итог: ' +
      'по нему видно, с какой темы продолжать. А через месяц пройдите проверку снова и сравните два кода.</p>' +
      (w ? '<div class="admrow"><button class="bigbtn ghost" id="prvworld">Открыть мир ' + w.n + '</button></div>' : '') +
      '</div>';
  } else {
    h += '<div class="card"><h3>Все ступени — сам</h3>' +
      '<p>Дальше этой проверки — проекты и задачи экзамена: там программы длиннее и умения собираются вместе.</p></div>';
  }

  h += '<div class="card"><h3>⚖️ Что этот итог говорит и чего не говорит</h3><ul class="trrules">' +
    '<li><b>Это не оценка и не баллы.</b> Школьной отметки из десяти задач не вывести, и выдумывать её мы не будем.</li>' +
    '<li><b>Проверяется одно:</b> может ли ребёнок сам написать программу на Python. Теории информатики и офисных программ здесь нет.</li>' +
    '<li><b>«Часть кода вставлена»</b> значит: код пришёл вставкой, а не набран руками. Это не приговор, а повод спросить, откуда он.</li>' +
    '<li><b>Числа в задачах у каждой проверки свои.</b> Пройти заново — значит решить новые задачи, а не вспомнить старые ответы.</li>' +
    '<li><b>О ребёнке мы не храним ничего.</b> Ни имени, ни почты: весь итог записан в шестнадцати знаках кода.</li>' +
    '</ul></div>';

  h += '<div class="card"><h3>📈 Сравнить с прошлой проверкой</h3>' +
    '<p class="dim">Впишите код прошлой проверки — у каждой ступени появится «было → стало».</p>' +
    '<div class="admrow"><input id="prvprev" class="prvinput" maxlength="19" placeholder="код прошлой проверки" ' +
    'autocomplete="off" spellcheck="false" value="' + (prev ? A.esc(pack(prev)) : "") + '">' +
    '<button class="bigbtn ghost" id="prvcmp">Сравнить</button></div>' +
    '<div class="msg" id="prvcmpmsg"></div></div>';

  var fromCab = backFromReport;
  backFromReport = false;
  h += '<div class="pager">' +
    (mine ? '<button class="bigbtn" id="prvagain">Пройти проверку заново</button><span class="sp"></span>' : '') +
    '<button class="bigbtn ghost" id="prvhome">' +
      (fromCab ? '← Назад в кабинет' : mine ? '← К тренировкам' : 'Пройти проверку самому') + '</button></div>';
  A.app.innerHTML = h;

  document.getElementById("prvcopy").onclick = function(){
    var url = location.href.split("#")[0] + "#proverka=" + code;
    A.copyText(url, this);
  };
  var wb = document.getElementById("prvworld");
  if (wb){
    var lw = worldOfLesson((lessonOf(t.shaky) || {}).id);
    wb.onclick = function(){ A.screenWorld(lw.n); };
  }
  var cmp = function(){
    var v = document.getElementById("prvprev").value;
    if (unpack(v)) return screenReport(code, v, mine);
    var m = document.getElementById("prvcmpmsg");
    m.className = "msg show bad"; m.innerHTML = badCodeHTML(v);
  };
  document.getElementById("prvcmp").onclick = cmp;
  document.getElementById("prvprev").addEventListener("keydown", function(e){ if (e.key === "Enter") cmp(); });
  var ag = document.getElementById("prvagain");
  if (ag) ag.onclick = function(){ start(); flash = ""; screenRung(); };
  document.getElementById("prvhome").onclick = fromCab ? function(){ history.back(); }
    : mine ? A.screenTrain : function(){ screenIntro(); };
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ===== карточка для кабинета взрослого =====
   Снимок ЛЮБОГО ученика (репетитору и родителю — чужой прогресс, ребёнку —
   свой), поэтому состояние берётся из довода, а не из A.proverkaGet (§ 4.5).
   ⚠️ Итог открывается по коду, а не по снимку: код и есть итог, и взрослый
   видит ровно то же, что увидел бы по продиктованному коду. */
function cardHTML(st){
  var p = st && st.proverka;
  var ok = p && p.v === VER && Array.isArray(p.rungs) && p.rungs.length === RUNGS.length;
  var h = '<div class="card"><h3>🔎 Проверка «что умеет сам»</h3>';
  if (ok && p.closed && unpack(p.code)){
    var t = tallyOf(unpack(p.code));
    h += '<p>Последняя — от ' + dateText(dayOf(p.at)) + ': <b>уверенно сам ' + t.firm + ' из ' + RUNGS.length +
      '</b> ступеней подряд' + (t.shaky >= 0 ? ', первая шаткая — «' + A.esc(RUNGS[t.shaky].t) + '»' : ', все ступени — сам') + '.</p>' +
      (t.pasted ? '<p class="dim">⚠️ На ' + t.pasted + ' ' + A.plural(t.pasted, "ступени", "ступенях", "ступенях") +
        ' код пришёл вставкой.</p>' : '') +
      '<p class="dim">Код итога: <b class="prvinline">' + A.esc(p.code) + '</b>. Сохраните его: через месяц ' +
      'по двум кодам будет видно «было → стало».</p>' +
      '<div class="admrow"><button class="rbtn check" data-prvopen="' + A.esc(p.code) + '">Открыть итог</button></div>';
  } else if (ok && !p.closed){
    h += '<p>Идёт проверка: ступень <b>' + (p.i + 1) + '</b> из ' + RUNGS.length + '. Итог появится здесь, когда она закончится.</p>';
  } else {
    h += '<p>Проверки ещё не было. Десять задач по нарастающей, без подсказок: так видно, что ученик умеет сам, ' +
      'а не с чьей-то помощью.</p><p class="dim">Попросите пройти её: «Тренировки» → «Проверка: что умеет сам». ' +
      'Начинающему хватит десяти минут.</p>';
  }
  return h + '</div>';
}
/* Одна дверь на весь продукт: карточка рисуется в разных кабинетах, и вешать
   обработчик в каждом значило бы однажды забыть один. Назад из итога —
   история браузера: итог пишет свой адрес, и «назад» возвращает в кабинет. */
document.addEventListener("click", function(e){
  var b = e.target && e.target.closest ? e.target.closest("[data-prvopen]") : null;
  if (!b) return;
  backFromReport = true;
  screenReport(b.getAttribute("data-prvopen"), "");
});
var backFromReport = false;

/* Короткая строка для карточки в «Тренировках». */
function proverkaStat(){
  var p = cur();
  if (!p) return "";
  if (!p.closed) return "идёт проверка: ступень " + (p.i + 1) + " из " + RUNGS.length;
  var t = tallyOf(resultOf(p));
  return "последняя: уверенно " + t.firm + " из " + RUNGS.length;
}

return { screenProverka: screenProverka, screenReport: screenReport, proverkaStat: proverkaStat,
         cardHTML: cardHTML,
         pack: pack, unpack: unpack, taskOf: taskOf, tallyOf: tallyOf, RUNGS: RUNGS };
};
