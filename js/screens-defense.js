/* ============================================================
   Фионика — пакет к защите индивидуального проекта.

   Решение фаундера 11.09.2026 (1.142.0), строка § 2.3 «Проект под защиту».
   Две причины делать именно это: на /individualnyi-proekt/ стояло прямое
   обещание «паспорт, презентация, речь — пока нет, это следующее, что мы
   делаем», а в плане монетизации (§ 6) разовая покупка с дедлайном стоит
   впереди подписки.

   Что в пакете — пять документов, все на печать или в PDF:
     паспорт проекта, пояснительная записка, презентация, речь на защиту,
     протокол работы.
   Все пять собираются из ОДНОЙ выборки фактов (facts): шаги проекта, даты
   их сдачи, программа, её вывод, пересказ словами и запись работы. Иначе
   паспорт и записка разошлись бы в датах с первой же правки.

   ⚠️⚠️ МЫ НЕ ПИШЕМ ЗА РЕБЁНКА. Тема, актуальность, вывод и «что улучшить» —
   его слова, четыре поля на экране. Пустое поле в документе становится
   строчками для руки, а не сочинённым абзацем. Продукт, который доказывает,
   что работу делал ребёнок (запись работы, § 3 форсайта), не может сам
   писать за него защиту — это была бы та самая «работа под ключ», против
   которой написана страница про индивидуальный проект.

   ⚠️ ПЕРСОНАЛЬНЫЕ ДАННЫЕ. Школу, класс и руководителя тренажёр НЕ спрашивает
   и не хранит — в документах для них пустые строки, вписать от руки. В
   S.defense лежат только четыре текста ребёнка и время правки. Имя берётся
   из профиля на устройстве; на сервер оно не уходит (CLOUD_SKIP).
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.defense = function(A){

var DOCS = [
  { id:"passport", em:"🪪", title:"Паспорт проекта",
    what:"Одна страница: тема, цель, задачи, этапы с датами и что получилось." },
  { id:"note",     em:"📄", title:"Пояснительная записка",
    what:"Титульный лист, введение, ход работы по шагам, описание программы и вывод." },
  { id:"slides",   em:"🖥", title:"Презентация",
    what:"Восемь слайдов, по листу на слайд: от темы до вывода." },
  { id:"speech",   em:"🎤", title:"Речь на защиту",
    what:"План на три минуты и вопросы, к которым стоит готовиться; где программа позволяет — с ответами, посчитанными по ней." },
  { id:"protocol", em:"🧾", title:"Протокол работы",
    what:"Как шла работа по шагам: даты, набор с клавиатуры, вставки, подсказки." }
];
var FIELDS = [
  { k:"topic", label:"Тема проекта", rows:2,
    hint:"Как ты назовёшь проект на защите. Пусто — возьмём название из тренажёра." },
  { k:"actual", label:"Актуальность — почему это важно", rows:4,
    hint:"Своими словами: зачем такая программа тебе и другим людям. Этого за тебя не напишет никто." },
  { k:"conclusion", label:"Вывод — что получилось и чему ты научился", rows:4,
    hint:"Что умеет программа, что было трудно и как ты с этим справился." },
  { k:"next", label:"Что можно улучшить", rows:3,
    hint:"Одно-два улучшения, которые ты сделал бы в следующей версии." }
];
var MAX_OUT_LINES = 18, MAX_CODE_SLIDE = 16, MAX_STORY = 10;
var saveTimer = null;

function words(pid){
  var S = A.S();
  return (S.defense && S.defense[pid]) || {};
}
function setWord(pid, k, v){
  var S = A.S();
  S.defense = S.defense || {};
  var d = S.defense[pid] || {};
  d[k] = v; d.at = Date.now();
  S.defense[pid] = d;
}

/* ---- факты: одна выборка на все пять документов ---- */
function facts(pid){
  var p = A.projectById(pid);
  if (!p) return null;
  var st = A.projectState(pid);
  var last = p.steps[p.steps.length - 1];
  var code = st.code || last.solution;
  /* Ответы на input() — те же, что у проверки последнего шага: игра-проект
     без них остановилась бы на первом ходе, и «что получилось» было бы пустым. */
  var stdin = (last.stdin || []).slice(), out = "", story = [];
  try {
    var r = Runtime.get("mini").run(code, { stdin: stdin.slice() });
    out = String(r.output || "").replace(/\n+$/, "");
  } catch(e){}
  try {
    var so = A.storyOf(code, { stdin: stdin.slice() });
    if (so && so.lines) story = so.lines.filter(function(x){ return !x.depth; })
                                       .map(function(x){ return x.text; });
  } catch(e){}
  var at = Array.isArray(st.stepsAt) ? st.stepsAt : [], tr = Array.isArray(st.tr) ? st.tr : [];
  var steps = p.steps.map(function(s, i){
    return { title: s.title, brief: s.brief || "", list: s.list || [], at: at[i] || 0, tr: tr[i] || null };
  });
  var dated = steps.filter(function(s){ return s.at; }).map(function(s){ return s.at; });
  return {
    p: p, st: st, code: code, stdin: stdin, out: out, story: story, steps: steps,
    start: dated.length ? Math.min.apply(null, dated) : 0, end: st.doneAt || 0,
    lines: code.replace(/\n+$/, "").split("\n").length,
    name: A.myName() || "", d: words(pid), year: new Date().getFullYear()
  };
}

/* ---- кирпичи документов ---- */
function esc(s){ return A.esc(String(s == null ? "" : s)); }
function page(cls, inner){ return '<section class="docpage' + (cls ? " " + cls : "") + '">' + inner + '</section>'; }
function blank(n){ var h = ""; for (var i = 0; i < (n || 1); i++) h += '<span class="docblank"></span>'; return h; }
function inlineBlank(short){ return '<span class="docinline' + (short ? " short" : "") + '"></span>'; }
/* Слова ребёнка — или строчки для руки. Сочинять за него нельзя (шапка файла). */
function own(f, k, n){
  var v = String(f.d[k] || "").trim();
  return v ? '<p>' + esc(v).replace(/\n/g, "<br>") + '</p>'
           : blank(n) + '<p class="docnote">впишите своими словами</p>';
}
function topic(f){ return String(f.d.topic || "").trim() || f.p.title; }
function author(f){ return f.name ? esc(f.name) : inlineBlank(); }
function goal(f){ return "Создать программу «" + f.p.title + "» на языке Python: " + f.p.tagline + "."; }
function li(s){ return '<li>' + esc(s) + '</li>'; }
function tasksList(f){
  return '<ol>' + f.steps.map(function(s){
    return '<li><b>' + esc(s.title) + '.</b> ' + esc(s.brief) + '</li>'; }).join("") + '</ol>';
}
function stepsDates(f){
  var miss = f.steps.some(function(s){ return !s.at; });
  return '<ol>' + f.steps.map(function(s){
      return '<li>' + esc(s.title) + ' — ' + (s.at ? A.fmtDay(s.at) : "дата не записана") + '</li>';
    }).join("") + '</ol>' +
    (f.end ? '<p>Проект собран ' + A.fmtDay(f.end) + '.</p>' : '') +
    (miss ? '<p class="docnote">Даты шагов тренажёр записывает с версии 1.142.0; у шагов, ' +
            'сданных раньше, их нет.</p>' : '');
}
function outBlock(f){
  if (!f.out) return '<p class="docnote">Программа ничего не печатает: она рисует или ждёт ввода.</p>';
  var ls = f.out.split("\n");
  return '<pre>' + esc(ls.slice(0, MAX_OUT_LINES).join("\n") + (ls.length > MAX_OUT_LINES ? "\n…" : "")) + '</pre>';
}
function row(k, v){ return '<tr><th>' + k + '</th><td>' + v + '</td></tr>'; }

/* ---- документы ---- */
function passportHTML(f){
  return page("", '<div class="dockicker">индивидуальный проект · паспорт</div>' +
    '<h1>Паспорт проекта</h1><table>' +
      row("Тема", esc(topic(f))) +
      row("Автор", author(f) + ', класс ' + inlineBlank(true)) +
      row("Руководитель", inlineBlank()) +
      row("Тип проекта", "Программный продукт: программа на языке Python") +
      row("Цель", esc(goal(f))) +
      row("Задачи", tasksList(f)) +
      row("Актуальность", own(f, "actual", 3)) +
      row("Продукт", "Программа на Python, " + f.lines + " " + A.plural(f.lines, "строка", "строки", "строк") +
          (f.story.length ? ". При запуске она: " + esc(f.story.slice(0, 2).join("; ")) : "") + ".") +
      row("Этапы и сроки", stepsDates(f)) +
      row("Где выполнен", "Тренажёр по информатике «Фионика», в браузере: программа запускалась и проверялась на каждом шаге") +
    '</table><p class="docnote">Требования к паспорту у школ разные — сверьте с памяткой своей школы.</p>');
}
function noteHTML(f){
  var title = page("doctitle",
    '<div class="docschool">' + blank(1) + '<span class="docnote">полное название школы</span></div>' +
    '<div class="doccenter"><div class="dockicker">индивидуальный проект</div>' +
      '<h1>' + esc(topic(f)) + '</h1><p>Программный продукт на языке Python</p></div>' +
    '<div class="docright"><p>Выполнил(а): ' + author(f) + '<br>класс ' + inlineBlank(true) + '</p>' +
      '<p>Руководитель: ' + inlineBlank() + '</p></div>' +
    '<p class="doccenter">' + f.year + '</p>');
  var intro = page("", '<h1>Пояснительная записка</h1>' +
    '<h2>Введение</h2><p><b>Актуальность.</b></p>' + own(f, "actual", 4) +
    '<p><b>Цель проекта:</b> ' + esc(goal(f)) + '</p><p><b>Задачи:</b></p>' + tasksList(f) +
    '<h2>Ход работы</h2>' + f.steps.map(function(s, i){
      return '<p><b>Этап ' + (i + 1) + '. ' + esc(s.title) + '</b>' +
        (s.at ? ' (' + A.fmtDay(s.at) + ')' : '') + '. ' + esc(s.brief) + '</p>' +
        /* пункты требований — HTML с сущностями, как их пишет js/projects.js:
           экранировать второй раз нельзя, иначе в записке будет «&lt;h1&gt;» */
        (s.list.length ? '<ul>' + s.list.map(function(x){ return '<li>' + x + '</li>'; }).join("") + '</ul>' : '');
    }).join(""));
  var prog = page("", '<h2>Описание программы</h2>' +
    (f.story.length
      ? '<p>Что программа делает при запуске — пересказ, собранный тренажёром по настоящему прогону:</p>' +
        '<ol>' + f.story.slice(0, MAX_STORY).map(li).join("") + '</ol>'
      : '') +
    '<p>Текст программы (' + f.lines + ' ' + A.plural(f.lines, "строка", "строки", "строк") + '):</p>' +
    '<pre>' + esc(f.code.replace(/\n+$/, "")) + '</pre>' +
    '<h2>Результат</h2><p>Так программа отвечает при запуске:</p>' + outBlock(f) +
    '<h2>Вывод</h2>' + own(f, "conclusion", 5) +
    '<h2>Что можно улучшить</h2>' + own(f, "next", 3) +
    '<h2>Источники</h2><ol><li>Тренажёр по информатике «Фионика»: уроки и проект «' + esc(f.p.title) + '».</li>' +
    '<li>Документация языка Python: docs.python.org/3</li></ol>');
  return title + intro + prog;
}
function slidesHTML(f){
  var ls = f.code.replace(/\n+$/, "").split("\n");
  var head = ls.slice(0, MAX_CODE_SLIDE).join("\n") + (ls.length > MAX_CODE_SLIDE ? "\n…" : "");
  var sl = function(inner){ return page("docslide", inner); };
  return [
    sl('<div class="dockicker">индивидуальный проект</div><h1>' + esc(topic(f)) + '</h1>' +
       '<p>' + author(f) + ' · ' + f.year + '</p>'),
    sl('<h1>Цель и задачи</h1><p>' + esc(goal(f)) + '</p>' + tasksList(f)),
    sl('<h1>Почему это важно</h1>' + own(f, "actual", 4)),
    sl('<h1>Как устроена программа</h1>' + (f.story.length
      ? '<ol>' + f.story.slice(0, 6).map(li).join("") + '</ol>' : '<p>' + esc(f.p.intro) + '</p>')),
    sl('<h1>Фрагмент кода</h1><pre>' + esc(head) + '</pre>'),
    sl('<h1>Что получилось</h1>' + outBlock(f)),
    sl('<h1>Как шла работа</h1>' + stepsDates(f)),
    sl('<h1>Вывод</h1>' + own(f, "conclusion", 4) + '<p class="docthanks">Спасибо! Готов ответить на вопросы.</p>')
  ].join("");
}
/* Вывод программы на ответах последнего шага; null — упала или молчит. */
function runOut(code, stdin){
  try {
    var r = Runtime.get("mini").run(code, { stdin: (stdin || []).slice() });
    if (r.error) return null;
    var out = String(r.output || "").replace(/\n+$/, "");
    return out.trim() ? out : null;
  } catch(e){ return null; }
}
/* ⚠️ Вопросы комиссии с ПОСЧИТАННЫМ ответом. Механизм «Спросите вслух»
   (myPredRun/myPredictMake) здесь не годится: он рассчитан на программу
   урока в несколько строк и молчит на длинном выводе и на input(). Замер
   11.09.2026: из 11 проектов он не дал ответа НИ ОДНОМУ — обещание на
   экране было пустым. Поэтому свой расчёт, с ответами на input() из
   последнего шага (игры тоже считаются):
     1) короткий вывод — «что напечатает»; длинный — первая строка и сколько
        всего строк;
     2) число в коде меняем по скелету (внутри строк текста — нельзя) и
        отвечаем, какая строка вывода станет другой.
   Программа со случайностью — два прогона разошлись — ответа не получает:
   посчитанный однажды, он был бы враньём при следующем запуске. */
function computedQs(f){
  var qs = [], out = runOut(f.code, f.stdin);
  if (!out || runOut(f.code, f.stdin) !== out) return qs;
  var ls = out.split("\n");
  qs.push(ls.length <= 8
    ? { q:"Что напечатает программа, если её запустить?", a: out,
        why:"Комиссия проверяет, понимаешь ли ты свой код, а не только умеешь его запустить." }
    : { q:"Что программа напечатает первой строкой — и сколько всего строк?",
        a: ls[0] + "\n… всего " + ls.length + " " + A.plural(ls.length, "строка", "строки", "строк"),
        why:"Всю длинную распечатку наизусть не помнят, а вот как она начинается и сколько её — должен знать автор." });
  var k = A.codeSkeleton(f.code), re = /(^|[^A-Za-z_0-9.А-Яа-яЁё])(\d+)(?![.\dA-Za-z_])/g, m, spots = 0;
  while ((m = re.exec(k)) !== null && spots < 14){
    spots++;
    var at = m.index + m[1].length, v = parseInt(m[2], 10), cands = [v + 1, v * 2, v + 2, v - 1];
    for (var j = 0; j < cands.length; j++){
      var nv = cands[j];
      if (nv < 0 || nv === v || nv > 9999) continue;
      var o2 = runOut(f.code.slice(0, at) + nv + f.code.slice(at + m[2].length), f.stdin);
      if (!o2 || o2 === out) continue;
      var l2 = o2.split("\n"), i = 0;
      while (i < ls.length && i < l2.length && ls[i] === l2[i]) i++;
      qs.push({ q:"А если в строке " + f.code.slice(0, at).split("\n").length + " поменять " + v + " на " + nv +
                  ", — что изменится в выводе?",
        a: (i < ls.length ? "было: " + ls[i] : "(такой строки не было)") + "\n" +
           (i < l2.length ? "станет: " + l2[i] : "(строка пропадёт)") +
           (l2.length !== ls.length ? "\n…и строк станет " + l2.length + " вместо " + ls.length : ""),
        why:"Проверяет, понимаешь ли ты, за что отвечает это число. В ответе — первая строка вывода, которая станет другой." });
      return qs;
    }
  }
  return qs;
}
/* Вопросы комиссии: посчитанные (выше) и три без ответа — нарочно: по ним
   видно, кто делал работу. */
function questions(f){
  var qs = computedQs(f);
  var fn = /(^|\n)def\s+([^\s(]+)\s*\(/.exec(f.code);
  if (fn) qs.push({ q:"Что делает функция «" + fn[2] + "» и зачем она вынесена отдельно?", a:null,
    why:"Наизусть тут ничего не выучишь: объясни, ЧТО она делает, а не пересказывай строки." });
  qs.push({ q:"Что было самым трудным и как ты с этим справился?", a:null,
    why:"Любимый вопрос комиссии: по ответу видно, кто делал работу." });
  qs.push({ q:"Что бы ты добавил в следующей версии?", a:null,
    why:"Здесь пригодится поле «Что можно улучшить»." });
  return qs;
}
function speechHTML(f){
  var titles = f.steps.map(function(s){ return s.title.toLowerCase(); }).join(", ");
  var plan = [
    ["0:00–0:20", "Здравствуйте. Меня зовут " + (f.name ? esc(f.name) : inlineBlank()) +
      ". Тема моего проекта — «" + esc(topic(f)) + "»."],
    ["0:20–0:50", f.d.actual ? esc(f.d.actual) : "<i>Почему это важно — своими словами, из поля «Актуальность».</i>"],
    ["0:50–1:30", "Цель проекта — " + esc(goal(f).charAt(0).toLowerCase() + goal(f).slice(1)) +
      " Я делал его по шагам: " + esc(titles) + "."],
    ["1:30–2:20", "Показываю программу: запускаю и объясняю, что она делает." +
      (f.story.length ? " " + esc(f.story.slice(0, 2).join("; ")) + "." : "")],
    ["2:20–3:00", (f.d.conclusion ? esc(f.d.conclusion) : "<i>Вывод — из поля «Вывод».</i>") +
      " Спасибо, готов ответить на вопросы."]
  ];
  return page("", '<h1>Речь на защиту</h1>' +
    '<p class="docnote">План на три минуты. Не читай с листа — перескажи своими словами, лист нужен, чтобы не сбиться.</p>' +
    '<table>' + plan.map(function(r){ return row(r[0], r[1]); }).join("") + '</table>' +
    '<h2>Вопросы, к которым стоит готовиться</h2><ol class="docqs">' +
    questions(f).map(function(q){
      return '<li><b>' + esc(q.q) + '</b>' +
        (q.a !== null ? '<div class="docans">Правильный ответ:<pre>' + esc(q.a) + '</pre></div>' : '') +
        '<div class="docnote">' + esc(q.why) + '</div></li>';
    }).join("") + '</ol>');
}
function protocolHTML(f){
  var rows = f.steps.map(function(s, i){
    var t = s.tr;
    return '<tr><td>' + (i + 1) + '. ' + esc(s.title) + '</td><td>' + (s.at ? A.fmtDay(s.at) : "—") + '</td>' +
      (t ? '<td>' + (t.typed || 0) + '</td><td>' + (t.pasted || 0) + '</td><td>' + (t.shown ? "да" : "нет") +
           '</td><td>' + (t.hints || 0) + '</td>'
         : '<td colspan="4" class="docnote">запись не велась: шаг сдан до версии 1.142.0</td>') + '</tr>';
  });
  return page("", '<h1>Протокол работы</h1>' +
    '<p>Проект «' + esc(f.p.title) + '»' + (f.name ? ', автор — ' + esc(f.name) : '') + '.</p>' +
    '<table><tr><th>Шаг</th><th>Сдан</th><th>Набрано с клавиатуры, знаков</th><th>Вставлено, знаков</th>' +
      '<th>Открывал решение</th><th>Подсказок</th></tr>' + rows.join("") + '</table>' +
    '<p class="docnote">Это факты, а не оценка. Тренажёр записывает, как код появлялся в редакторе: ' +
    'набором с клавиатуры или вставкой. Вставка — не нарушение: так переносят пример из подсказки. ' +
    'Запись о шаге делается один раз — при первой сдаче, и повторная сдача её не переписывает.</p>');
}
var BUILD = { passport: passportHTML, note: noteHTML, slides: slidesHTML, speech: speechHTML, protocol: protocolHTML };
function docHTML(kind, pid){
  if (!BUILD[kind] || !A.projectDone(pid)) return "";
  var f = facts(pid);
  return f ? BUILD[kind](f) : "";
}

/* ---- слой печати: как сертификат, но листов несколько ---- */
function openDoc(kind, pid){
  var el = document.getElementById("doc"), box = document.getElementById("docbox");
  if (!el || !box) return;
  box.innerHTML = docHTML(kind, pid);
  el.hidden = false;
  el.scrollTop = 0;
}
function closeDoc(){ var el = document.getElementById("doc"); if (el) el.hidden = true; }
(function(){
  var pr = document.getElementById("docprint"), cl = document.getElementById("docclose");
  if (pr) pr.onclick = function(){ try { window.print(); } catch(e){} };
  if (cl) cl.onclick = closeDoc;
  document.addEventListener("keydown", function(e){
    var el = document.getElementById("doc");
    if (e.key === "Escape" && el && !el.hidden) closeDoc();
  });
})();

/* ---- экран пакета ---- */
function screenDefense(pid){
  var p = A.projectById(pid);
  if (!p) return A.screenFolio();
  A.enterScreen("mine", "defense");
  /* Адрес с параметром, как у урока: пакет открывается по ссылке сразу */
  A.setRoute("#defense=" + p.id, "Пакет к защите: «" + p.title + "»");
  var done = A.projectDone(p.id);
  var h = '<div class="lvlhead"><div><div class="idx">пакет к защите · ' + A.esc(A.projectWhere(p)) + '</div>' +
    '<h1>📁 ' + p.emoji + ' ' + A.esc(p.title) + '</h1></div>' +
    (done ? '<div class="right"><span class="tag">проект собран ✓</span></div>' : '') + '</div>';

  if (!done){
    A.app.innerHTML = h +
      '<div class="note"><b>Пакет собирается из готового проекта</b>Документы к защите описывают ' +
      'программу, которая уже работает: шаги, даты, код и то, что она печатает. Собери проект — ' +
      'и пакет появится здесь.</div>' +
      '<div class="pager"><button class="bigbtn" id="dfopen">Собрать проект →</button>' +
      '<button class="bigbtn ghost" id="dffolio">🎒 Все мои работы</button></div>';
    document.getElementById("dfopen").onclick = function(){ A.openProject(p.id); };
    document.getElementById("dffolio").onclick = A.screenFolio;
    A.refreshTop();
    return;
  }

  var d = words(p.id);
  h += '<p class="lede">Всё, что обычно просят на защите индивидуального проекта. Шаги, даты, программа ' +
    'и запись работы — из того, что ты действительно сделал; тема, актуальность и вывод — твои слова.</p>' +
    '<div class="card"><h3>⚖️ Честно про пакет</h3><ul class="trrules">' +
      '<li><b>Мы не пишем за тебя.</b> Тема, актуальность и вывод — твои слова. Всё остальное собрано ' +
      'из сделанного: шаги проекта, даты, программа и то, как шла работа.</li>' +
      '<li><b>Требования у школ разные:</b> шрифт, поля, титульный лист, объём. Здесь каркас, а не ' +
      'бланк твоей школы — сверь с её памяткой.</li>' +
      '<li><b>Школу, класс и руководителя тренажёр не спрашивает и не хранит.</b> В документах для них ' +
      'пустые строки — впиши от руки.</li>' +
      '<li><b>Даты шагов и запись работы ведутся с версии 1.142.0.</b> У шагов, сданных раньше, их нет, ' +
      'и в документах так и написано.</li>' +
    '</ul></div>' +
    '<div class="card"><h3>✍️ Твои слова</h3><p class="dim">Сохраняются сами, пока пишешь, и сразу ' +
      'попадают во все документы. Пустое поле станет в документе строчками — вписать от руки.</p>' +
      FIELDS.map(function(fl){
        return '<label class="deffield"><b>' + A.esc(fl.label) + '</b><span class="dim">' + A.esc(fl.hint) + '</span>' +
          '<textarea data-def="' + fl.k + '" rows="' + fl.rows + '"' +
          (fl.k === "topic" ? ' placeholder="' + A.esc(p.title) + '"' : '') + '>' +
          A.esc(d[fl.k] || "") + '</textarea></label>';
      }).join("") + '</div>' +
    '<div class="sect"><h2>Документы</h2><div class="line"></div><span class="cnt">' + DOCS.length + '</span></div>' +
    '<div class="defdocs">' + DOCS.map(function(x){
      return '<div class="card defdoc"><div><h3>' + x.em + ' ' + A.esc(x.title) + '</h3>' +
        '<p class="dim">' + A.esc(x.what) + '</p></div>' +
        '<button class="rbtn" data-doc="' + x.id + '">Открыть и распечатать →</button></div>';
    }).join("") + '</div>' +
    '<div class="pager"><button class="bigbtn ghost" id="dfback">← К проекту</button>' +
    '<button class="bigbtn ghost" id="dffolio">🎒 Все мои работы</button></div>';
  A.app.innerHTML = h;

  A.app.querySelectorAll("[data-def]").forEach(function(ta){
    ta.addEventListener("input", function(){
      setWord(p.id, ta.getAttribute("data-def"), ta.value);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(A.save, 400);
    });
    ta.addEventListener("blur", function(){ A.save(); });
  });
  A.app.querySelectorAll("[data-doc]").forEach(function(b){
    b.onclick = function(){ openDoc(b.getAttribute("data-doc"), p.id); };
  });
  document.getElementById("dfback").onclick = function(){ A.screenProjectDone(p.id); };
  document.getElementById("dffolio").onclick = A.screenFolio;
  A.refreshTop();
}

return { screenDefense: screenDefense, docHTML: docHTML, DOCS: DOCS, openDoc: openDoc, closeDoc: closeDoc };
};
