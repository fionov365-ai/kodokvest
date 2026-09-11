/* ============================================================
   Фионика — раздел «Ты и ИИ»: экран раздела, задания и победная карточка.

   ⚠️ Отрезан от js/app.js в 1.145.0 — пункт D.13 архитектурного долга
   (docs/RAZVITIE.md § 2.5): «домашка и „Ты и ИИ“ — два разреза, а не один».
   В app.js они лежали одним участком исторически, а связаны не были вовсе:
   замер 11.09.2026 не нашёл ни одного имени, которое одна половина брала бы
   у другой. Домашка режется отдельно.

   Договор — тот же, что в шапке js/screens-showcase.js:
     - всё чужое приходит объектом A; из области видимости app.js файл не
       берёт ничего;
     - общего состояния файл не пишет. Сданное задание отмечает
       A.ailabMark(id), а переменную session заменяет A.newSession(v): чужую
       переменную из другого файла не присвоить. Поля ТЕКУЩЕЙ сессии
       (attempts, studio, shown) меняются через A.session() — это тот же
       объект, что у всего тренажёра, а не снятая копия (правило § 4.5);
     - наружу уходит ровно то, что зовут снаружи: экран раздела и задание
       (маршруты, «Тренировки», проект раздела), ступени (тест и карта
       раздела) и четыре функции судьи, которые тест гоняет напрямую.

   Замер 11.09.2026: внутрь приходит 35 имён, наружу уходит 8.
   ⚠️ Список заданий и «пройдено ли» (ailabList, ailabDone, ailabMark)
   остались в app.js: их читают ещё портфолио, сертификаты и Главное.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.ailab = function(A){

/* ===== ступени раздела «Ты и ИИ» =====
   Ставка Б из docs/foresight-2027.md § 3, названная там «самой быстрой к
   продаже»: продукт есть, спрос назван рынком. Не хватало упаковки — раздел
   лежал плоским списком из девятнадцати заданий, и по нему нельзя было
   понять, чему он учит и в каком порядке.

   ⚠️ Отличие, ради которого всё и делается, обязано стоять на экране прямым
   текстом: рынок платит за ИИ-курсы 8–71 тыс. ₽, и все они про «как
   попросить». Наше — **как принять работу**. Это разные умения, и второму
   не учит никто.

   Ступени строятся из поля tag самих заданий, а не пишутся списком: появится
   задание с новой меткой — оно встанет в «Остальное» и будет мозолить глаза,
   а не потеряется молча. Проверка на это есть в tests/full-run.js. */
var AI_STAGES = [
  { id:"ask",  em:"🎯", title:"Поставить задачу",
    why:"Машина понимает буквально. Размытая просьба даёт мусор — и виноват в этом не ИИ.",
    tags:["ставим задачу"] },
  { id:"read", em:"📖", title:"Прочитать ответ",
    why:"Прежде чем судить, надо понять, что прислали, и предсказать, что оно напечатает.",
    tags:["читаем код", "проверяем вывод"] },
  { id:"judge",em:"⚖️", title:"Вынести вердикт",
    why:"Работает или нет — решаешь ты, а не уверенный тон ответа. И чинишь то, что сломано.",
    tags:["выносим вердикт", "проверяем и чиним"] },
  { id:"catch",em:"🔍", title:"Доказать, что ошибся",
    why:"Мнения мало: пишешь проверку, которая ловит ошибку, и запускает её движок.",
    tags:["ловим ИИ"] },
  { id:"boss", em:"🤝", title:"Ответить за результат",
    why:"Ты тимлид, ИИ — джун. Он пишет быстро и уверенно, а отвечаешь за работу ты.",
    tags:["финальный проект"] }
];
function aiStageOf(x){
  for (var i = 0; i < AI_STAGES.length; i++)
    if (AI_STAGES[i].tags.indexOf(x.tag) >= 0) return AI_STAGES[i].id;
  return "";
}

function screenAILab(){
  A.enterScreen("train", "ai");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  var xs = A.ailabList();
  var done = xs.filter(function(x){ return A.ailabDone(x.id); }).length;
  var specs = A.specsList(), specsOk = specs.filter(function(x){ return A.specDone(x.id); }).length;

  var h = '<div class="lvlhead"><div><div class="idx">командуй, не подчиняйся</div><h1>🤖 Ты и ИИ</h1></div>' +
    '<div class="right"><span class="tag">пройдено ' + done + ' из ' + xs.length + '</span></div></div>' +
    '<p class="lede">Код всё чаще пишет машина — и тем дороже то, чего она не забирает: ' +
    'точно поставить задачу, прочитать чужой код и <b>принять работу</b>. ' +
    'Здесь этому учат по шагам, а судья правды — движок: он запускает ответ ИИ и показывает, где тот врёт. ' +
    'Звёзд тут не дают.</p>';

  /* ⚠️ Обещание раздела написано отдельным блоком и первым. Без него это
     просто ещё одна пачка заданий, а с ним — единственный курс, который учит
     не просить, а принимать. */
  h += '<div class="card"><h3>Чему тут учат — и чем это отличается</h3>' +
    '<div class="aidiff">' +
    '<div><b>Курсы про нейросети</b><span>как попросить: формулы промптов, списки заклинаний, ' +
    '«скажи модели, что она эксперт».</span></div>' +
    '<div><b>Здесь</b><span>как <b>принять работу</b>: прочитать ответ, найти, где машина ' +
    'уверенно врёт, написать проверку и вернуть на доработку.</span></div>' +
    '</div>' +
    '<p class="dim">⚠️ Живого ИИ здесь нет намеренно. «Ответ ИИ» — заранее написанный код, ' +
    'и это не экономия: модель, которая пишет за ребёнка, несовместима с разделом, ' +
    'который учит её проверять. Судит движок, а не мнение, — поэтому себя не обманешь.</p></div>';

  /* ---------- путь по ступеням ---------- */
  var used = {};
  AI_STAGES.forEach(function(st){
    var items = xs.filter(function(x){ return aiStageOf(x) === st.id; });
    items.forEach(function(x){ used[x.id] = 1; });
    if (!items.length) return;
    var d = items.filter(function(x){ return A.ailabDone(x.id); }).length;
    h += '<div class="sect"><h2>' + st.em + ' ' + A.esc(st.title) + '</h2><div class="line"></div>' +
      '<span class="cnt">' + d + ' из ' + items.length + '</span></div>' +
      '<p class="dim">' + A.esc(st.why) + '</p>' +
      '<div class="gamegrid">';
    items.forEach(function(x){
      h += '<button class="gamecard" data-id="' + x.id + '">' +
        '<span class="gemoji">' + x.emoji + '</span>' +
        '<b>' + A.esc(x.title) + (x.boss ? ' <span class="wtag">финал</span>' : '') +
        (A.ailabDone(x.id) ? ' <span class="edittag done">пройдено ✓</span>' : '') + '</b>' +
        '<span>' + A.esc(x.intro) + '</span>' +
        '<span class="wtag">' + A.esc(x.tag) + '</span></button>';
    });
    h += '</div>';
  });
  /* Задание с незнакомой меткой не должно исчезнуть с экрана: пусть лучше
     стоит в «Остальном» и мозолит глаза, чем пропадёт молча. */
  var rest = xs.filter(function(x){ return !used[x.id]; });
  if (rest.length){
    h += '<div class="sect"><h2>Остальное</h2><div class="line"></div>' +
      '<span class="cnt">' + rest.length + '</span></div><div class="gamegrid">';
    rest.forEach(function(x){
      h += '<button class="gamecard" data-id="' + x.id + '">' +
        '<span class="gemoji">' + x.emoji + '</span><b>' + A.esc(x.title) + '</b>' +
        '<span>' + A.esc(x.intro) + '</span>' +
        '<span class="wtag">' + A.esc(x.tag) + '</span></button>';
    });
    h += '</div>';
  }

  /* ---------- приёмка: та же дисциплина, вынесенная в свой жанр ---------- */
  h += '<div class="projcard' + (specsOk ? " done" : "") + '"><span class="pjemoji">📋</span>' +
    '<span class="pjbody"><span class="pjkicker">Ступень 6 · приёмка работы</span>' +
    '<b>Пиши правила, а не код</b>' +
    '<span>напарник присылает программу, а ты записываешь, что должно быть верно, — ' +
    'и движок судит его код по твоим правилам</span>' +
    '<span class="pjnote">' + (specs.length
      ? "Работ принято: " + specsOk + " из " + specs.length + ". Каждая твоя строка — настоящий Python."
      : "Работы появятся вместе с разделом.") + '</span></span>' +
    '<button class="bigbtn' + (specsOk ? "" : " ghost") + '" id="toaispecs">Открыть приёмку</button>' +
    '</div>';

  /* Проект раздела: тот же вид карточки, что у проектов миров, — только
     открывается он не по уроками мира, а по заданиям этого раздела. */
  var aproj = A.projectOfWorld(0);
  if (aproj){
    var apopen = A.projectOpen(aproj), apdone = A.projectDone(aproj.id), apst = A.projectState(aproj.id);
    h += '<div class="projcard' + (apopen ? "" : " locked") + (apdone ? " done" : "") + '">' +
      '<span class="pjemoji">' + aproj.emoji + '</span>' +
      '<span class="pjbody"><span class="pjkicker">Проект раздела · звёзд не даёт</span>' +
      '<b>' + A.esc(aproj.title) + (apdone ? ' <span class="edittag done">собран ✓</span>' : '') + '</b>' +
      '<span>' + A.esc(aproj.tagline) + '</span>' +
      '<span class="pjnote">' + A.esc(apdone
        ? "Собран целиком. Можно открыть, запустить и забрать код себе."
        : (apopen
            ? (apst.step > 0 ? "Начат: пройдено шагов " + apst.step + " из " + aproj.steps.length + "."
                             : "Все задания раздела пройдены — можно браться за проект.")
            : "Откроется, когда пройдёшь все задания этого раздела.")) + '</span></span>' +
      (apopen ? '<button class="bigbtn" id="openaiproj">' +
                  (apdone ? "Открыть" : (apst.step > 0 ? "Продолжить" : "Собрать проект")) + '</button>'
              : '<span class="soontag">закрыт</span>') +
    '</div>';
  }

  h += '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  A.app.innerHTML = h;
  var tas = document.getElementById("toaispecs");
  if (tas) tas.onclick = A.screenSpecs;
  A.app.querySelectorAll(".gamecard").forEach(function(b){
    b.onclick = function(){ openAILesson(b.getAttribute("data-id")); };
  });
  var aop = document.getElementById("openaiproj");
  if (aop) aop.onclick = function(){
    if (A.projectDone(aproj.id)) A.screenProjectDone(aproj.id); else A.openProject(aproj.id);
  };
  document.getElementById("tomap").onclick = A.goHome;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function openAILesson(id){
  var xs = A.ailabList();
  var x = xs.filter(function(e){ return e.id === id; })[0];
  if (!x) return screenAILab();
  /* Жёсткий потолок дня меряет ВСЁ время в тренажёре, а не только уроки, —
     значит и сюда новая работа после предела не пускает. */
  if (A.capHard()) return A.screenCapReached();
  A.enterScreen("train", "ailesson");
  A.newSession({ id:id, attempts:0, hints:0, shown:false });
  var pos = xs.indexOf(x);
  var next = pos < xs.length - 1 ? xs[pos+1] : null;
  var prev = pos > 0 ? xs[pos-1] : null;

  var isPredict = x.type === "predict";
  var isFix = x.type === "fix";
  var isReview = x.type === "review";
  var isCatch = x.type === "catch";
  var kindLabel = isPredict ? "угадай вывод"
                : isFix ? "почини код ИИ"
                : isReview ? "вынеси вердикт"
                : isCatch ? "докажи ошибку" : "напиши код";

  var head = '<div class="crumbs"><span data-go="back">🤖 Ты и ИИ</span> › ' + x.emoji + ' ' + A.esc(x.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">' + (x.boss ? "финал раздела" : kindLabel) + '</div><h1>' + x.emoji + ' ' + A.esc(x.title) + '</h1></div>' +
    '<div class="right"><span class="tag">' + A.esc(x.tag) + '</span></div></div>' +
    '<p class="lede">' + A.esc(x.intro) + '</p>';

  var goal = '<div class="goal"><h3>' + (isFix ? "🔧 Задача: проверь и почини"
                                       : isReview ? "⚖️ Задача: вынеси вердикт"
                                       : isCatch ? "🕵️ Задача: докажи, что код неправ" : "🎯 Твоя задача") + '</h3><p>' + A.esc(x.brief) + '</p>' +
    (x.list ? '<ul>' + x.list.map(function(s){ return '<li>' + A.esc(s) + '</li>'; }).join("") + '</ul>' : '') + '</div>';

  var bug = isFix
    ? '<div class="bugcard"><h3>🐞 Что сейчас не так</h3><p>' + A.esc(x.symptom) + '</p>' +
      '<span class="bugtip">Код ниже нужно проверить и починить, а не переписать заново. Кнопка «↩ Вернуть как было» вернёт исходный вариант от ИИ.</span></div>'
    : isReview
    ? '<div class="claimcard"><h3>🤖 ИИ уверяет</h3><p>«' + A.esc(x.claim) + '»</p>' +
      '<span class="claimtip">Никто не сказал тебе заранее, правда это или нет — в этом и задание. Код можно запускать и менять как угодно: дописывай свои проверки, подставляй свои данные. Вердикт ниже.</span></div>'
    : isCatch
    ? '<div class="claimcard"><h3>🤖 ИИ уверяет</h3><p>«' + A.esc(x.claim) + '»</p>' +
      '<span class="claimtip">На своём примере код отвечает верно — иначе задания бы не было. Твоё дело найти ДРУГИЕ данные, на которых обещание перестаёт сбываться. Строки кода ИИ менять нельзя, дописывай свои снизу.</span></div>'
    : "";

  var hints = '<div class="hintbox">' +
    '<button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
    (isPredict || isReview ? '' : '<button class="rbtn sec" id="solbtn">' + (isCatch ? "Показать готовую проверку" : "Показать решение") + '</button>') +
    '<span class="tip">это раздел без звёзд — подсказки ничего не отнимают</span></div>' +
    '<div class="hintout" id="hintout"></div>';

  var pager = '<div class="pager"><button class="bigbtn ghost" data-go="back">← Ко всем заданиям</button><span class="sp"></span>' +
    (prev ? '<button class="bigbtn ghost" data-prev="' + prev.id + '">Назад</button>' : '') +
    (next ? '<button class="bigbtn ghost" data-next="' + next.id + '">Дальше →</button>' : '') + '</div>';

  A.app.innerHTML = head + goal + bug + '<div id="studio"></div>' +
    (isReview ? reviewPanelHTML() : "") + hints + pager;

  var studio;
  if (isPredict){
    studio = A.makePredictStudio({ code: x.code, check: function(ed, showMsg){ runAIPredict(x, ed, showMsg); } });
  } else if (isReview){
    /* Кнопки «Проверить» тут нет намеренно: проверка — это вердикт ниже, а
       студия нужна как лаборатория. Ребёнок вправе дописывать свои строки и
       ломать код как угодно — «Вернуть как было» вернёт вариант от ИИ. */
    studio = A.makeStudio({
      engine: "mini", code: x.code,
      label: "код от ИИ — читай, запускай, пробуй свои данные",
      restore: x.code
    });
  } else if (isCatch){
    /* Код ИИ и проверка ребёнка живут в ОДНОМ редакторе, и это не лень.
       Иначе «Запустить» ничего бы не запустило: проверка без функции — это
       не программа. А чтобы код ИИ остался нетронутым, проверка при сдаче
       сверяет первые строки с оригиналом и отказывает, если их правили. */
    studio = A.makeStudio({
      engine: "mini", code: catchStart(x),
      label: "код от ИИ — не трогай его, дописывай проверку снизу",
      restore: catchStart(x),
      check: function(ed, showMsg){ runAICatch(x, ed, showMsg); }
    });
  } else {
    studio = A.makeStudio({
      engine: "mini", code: x.starter,
      label: isFix ? "код от ИИ — проверь и почини" : "твой код",
      restore: isFix ? x.starter : null,
      check: function(ed, showMsg){ runAICheck(x, ed, showMsg); }
    });
  }
  document.getElementById("studio").appendChild(studio);
  A.session().studio = studio;

  if (isReview) wireReview(x);
  A.wireHint(x.hints);
  var solb = document.getElementById("solbtn");
  if (solb) solb.onclick = function(){
    A.session().shown = true;
    studio.editor.setCode(isCatch ? (catchStart(x) + x.probe) : x.solution);
    studio.showMsg("warn", isCatch
      ? "<b>Вот проверка, которая ловит ошибку</b>Запусти и сравни с обещанием ИИ. Своя проверка, если она тоже разводит две версии, засчитывается ничуть не хуже — эта просто одна из возможных."
      : "<b>Вот рабочее решение</b>Прочитай его строчку за строчкой и запусти. Звёзд в разделе нет — смотреть решение можно без потерь, но сначала попробуй сам.");
  };
  A.app.querySelectorAll("[data-go]").forEach(function(b){ b.onclick = function(){ screenAILab(); }; });
  A.app.querySelectorAll("[data-next]").forEach(function(b){ b.onclick = function(){ openAILesson(b.getAttribute("data-next")); }; });
  A.app.querySelectorAll("[data-prev]").forEach(function(b){ b.onclick = function(){ openAILesson(b.getAttribute("data-prev")); }; });
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* predict: правильный ответ — это вывод программы w.code (как в разминке) */
function runAIPredict(x, ed, showMsg){
  A.session().attempts++;
  var eng = Runtime.get("mini");
  var res = eng.run(x.code, {});
  if (res.error){ showMsg("bad", A.errHTML(res.error)); return; }
  A.session().studio.reveal(res.output);
  if (A.normPred(res.output) === A.normPred(ed.getCode())){
    winAI(x);
  } else {
    showMsg("bad", "<b>Ещё не совпало</b>" + A.predictDiff(res.output, ed.getCode()) +
      "Смотри на настоящий вывод справа, найди, где разошлось, и попробуй снова.");
  }
}

/* code/fix: вывод должен совпасть с выводом эталона; у fix ещё бюджет правок */
function runAICheck(x, ed, showMsg){
  A.session().attempts++;
  var eng = Runtime.get("mini"), code = ed.getCode();
  if (x.needCode){
    for (var i = 0; i < x.needCode.length; i++){
      if (!A.codeHas(code, x.needCode[i])){ showMsg("warn", "<b>Почти</b>" + (x.needMsg || "Не хватает нужной конструкции.")); return; }
    }
  }
  var res = eng.run(code, {});
  if (res.error){ ed.setError(res.error.line); showMsg("bad", A.errHTML(res.error)); return; }
  var exp = eng.run(x.solution, {}).lines, got = res.lines;
  if (!(exp.length === got.length && exp.every(function(v, i){ return v === got[i]; }))){
    showMsg("bad", "<b>Ещё не то</b>" + A.diffBlock(exp, got));
    return;
  }
  if (x.type === "fix"){
    var budget = x.fixBudget || (A.editUnits(x.starter, x.solution) + 1);
    if (A.editUnits(x.starter, code) > budget){
      showMsg("warn", "<b>Работает, но это не починка</b>Вывод правильный — только строк изменено больше, чем нужно. " +
        "Смысл в другом: найти поломку и тронуть только её. Нажми «↩ Вернуть как было» и попробуй ещё раз.");
      return;
    }
  }
  winAI(x);
}

/* ===== catch: докажи, что код ИИ неправ =====
   Самый непохожий на остальные тип: у задания НЕТ единственного правильного
   ответа. Ребёнок пишет свою проверку, а засчитывает её не сверка с эталоном,
   а факт: на его данных код ИИ и правильная версия отвечают по-разному.
   Проверок, которые годятся, бесконечно много — и это ровно то, чему тут учат.
   Судит по-прежнему движок, без сети и без живого ИИ.

   Что должно быть у записи: claim, code (баг СПРЯТАН — на своём примере код
   отвечает верно), truth (правильная версия с тем же интерфейсом) и probe —
   эталонная проверка. Она нужна не для сверки ответа, а для двух вещей:
   кнопки «Показать готовую проверку» и теста, который убеждается, что поймать
   ошибку вообще возможно. */
function catchStart(x){
  return String(x.code).replace(/\n+$/, "") +
    "\n\n# ↓ ниже пиши свою проверку: вызови функцию своими данными и напечатай ответ\n";
}
function catchRun(src){
  var res = Runtime.get("mini").run(src, {});
  return res.error ? "!" + res.error.kind + ": " + res.error.msg : res.output;
}
/* Проверка ребёнка — это всё, что он дописал НИЖЕ кода ИИ. Сравниваем построчно
   и без хвостовых пробелов: невидимый пробел в конце строки не повод отказать. */
function catchProbe(x, code){
  var base = String(x.code).replace(/\n+$/, "").split("\n");
  var cur = String(code).split("\n");
  if (cur.length < base.length) return null;
  for (var i = 0; i < base.length; i++)
    if (cur[i].replace(/\s+$/, "") !== base[i].replace(/\s+$/, "")) return null;
  return cur.slice(base.length).join("\n");
}
function catchProof(x, probe){
  var got  = catchRun(x.code  + "\n" + probe).split("\n");
  var want = catchRun(x.truth + "\n" + probe).split("\n");
  while (got.length  && got[got.length-1]  === "") got.pop();
  while (want.length && want[want.length-1] === "") want.pop();
  return '<div class="proof"><u>Вот твоё доказательство</u>' + A.diffBlock(want, got) + '</div>';
}
function runAICatch(x, ed, showMsg){
  A.session().attempts++;
  var probe = catchProbe(x, ed.getCode());
  if (probe === null){
    showMsg("warn", "<b>Код ИИ изменён</b>Чинить его не надо — надо доказать, что он неправ. " +
      "Нажми «↩ Вернуть как было» и дописывай свои строки СНИЗУ, ничего не трогая выше.");
    return;
  }
  var body = probe.split("\n").filter(function(l){
    var t = l.trim(); return t !== "" && t[0] !== "#";
  }).join("\n");
  if (!body){
    showMsg("warn", "<b>Проверки пока нет</b>Внизу только комментарий. Допиши хотя бы одну строку: " +
      "вызови функцию своими данными и напечатай, что она вернула.");
    return;
  }
  var mine = catchRun(x.code + "\n" + probe);
  var right = catchRun(x.truth + "\n" + probe);
  /* Второй прогон — страховка от недетерминированности. Генератор случайных
     чисел у нас засевается одинаково на каждый запуск, поэтому random обе
     версии получат одинаковый и расхождения не дадут; а вот time.time()
     между двумя запусками может перевалить через миллисекунду — и тогда
     «расхождение» доказывало бы только то, что время идёт. */
  if (mine !== catchRun(x.code + "\n" + probe) || right !== catchRun(x.truth + "\n" + probe)){
    showMsg("warn", "<b>Так доказать нельзя</b>Твоя проверка при каждом запуске печатает разное " +
      "(случайность или время). Тогда расхождение ничего не значит: оно было бы и у двух одинаковых программ. " +
      "Возьми конкретные данные, которые ты выбрал сам.");
    return;
  }
  if (right.charAt(0) === "!"){
    showMsg("bad", "<b>Проверка сама не работает</b>На ПРАВИЛЬНОЙ версии функции твои строки падают: " +
      A.esc(right.slice(1)) + ". Значит дело не в коде ИИ, а в самой проверке — почини её и попробуй снова.");
    return;
  }
  if (mine === right){
    showMsg("bad", "<b>Не поймала</b>На твоих данных код ИИ отвечает ровно то же, что и правильная версия — " +
      "значит эти данные больное место не задевают. Ищи другие: думай, при каких значениях обещание " +
      "«" + A.esc(x.claim) + "» может не сбыться.");
    return;
  }
  winAI(x, catchProof(x, probe));
}

/* ===== review: вердикт вместо починки =====
   Единственный тип в разделе, где ребёнку НЕ говорят заранее, сломан ли код.
   Три ответа, а не два: «врёт сразу» и «работает, но не всегда» — разные
   вещи, и вторая как раз про код от ИИ, который сходится на примере автора
   и разъезжается на любом другом. Угадать с трёх попыток трудно, а после
   верного вердикта «врёт» надо ещё ткнуть в строку — там вариантов ещё
   больше. Что верно на самом деле, знает не текст задания, а движок: см.
   reviewTruth() и вычисление вердикта в tests/lessons.js. */
var VERDICTS = [
  { v:"ok",     label:"Работает верно",           sub:"делает обещанное на любых данных" },
  { v:"partly", label:"Работает, но не всегда",   sub:"на своём примере верно, на других врёт" },
  { v:"wrong",  label:"Врёт сразу",               sub:"расходится с обещанием на своём же примере" }
];

function reviewPanelHTML(){
  return '<div class="verdict" id="verdict"><h3>⚖️ Твой вердикт</h3>' +
    '<p>Прочитал, запустил, попробовал свои данные — теперь решай. Ответ «работает верно» тут такой же настоящий, как и остальные.</p>' +
    '<div class="vbtns">' +
    VERDICTS.map(function(o){
      return '<button class="vbtn" data-v="' + o.v + '"><b>' + o.label + '</b><span>' + o.sub + '</span></button>';
    }).join("") +
    '</div><div class="msg" id="vmsg"></div><div class="vpick" id="vpick"></div></div>';
}

/* Что происходит на самом деле: гоняем код ИИ и правильную версию на одних и
   тех же данных. Своим примером ИИ считается вывод code без probe, чужими —
   с probe. Ошибку тоже считаем ответом: код, который падает, обещания не
   исполняет. */
function reviewRun(src){
  var res = Runtime.get("mini").run(src, {});
  return res.error ? "!" + res.error.kind + ": " + res.error.msg : res.output;
}
function reviewTruth(x){
  var own  = reviewRun(x.code)                  !== reviewRun(x.truth);
  var wide = reviewRun(x.code + "\n" + x.probe) !== reviewRun(x.truth + "\n" + x.probe);
  return own ? "wrong" : (wide ? "partly" : "ok");
}

/* Доказательство для победной карточки: на чём именно код разошёлся с
   обещанием. Для «работает верно» показывать нечего — там и не разошёлся. */
function reviewProof(x, real){
  if (real === "ok") return "";
  var suffix = real === "wrong" ? "" : "\n" + x.probe;
  var got  = reviewRun(x.code  + suffix).split("\n");
  var want = reviewRun(x.truth + suffix).split("\n");
  while (got.length  && got[got.length-1]  === "") got.pop();
  while (want.length && want[want.length-1] === "") want.pop();
  return '<div class="proof"><u>' +
    (real === "wrong" ? "Вот на его же примере" : "Вот на других данных") +
    '</u>' + A.diffBlock(want, got) + '</div>';
}

function vmsg(cls, html){
  var m = document.getElementById("vmsg");
  if (!m) return;
  m.className = "msg show " + cls;
  m.innerHTML = html;
}

/* Почему ответ не подошёл — по возможности объясняем причину, а не просто
   «неверно»: намёк должен двигать к проверке, а не к перебору кнопок. */
function verdictNudge(said, real){
  if (said === "ok")
    return "<b>Не так быстро</b>Ты решил, что всё в порядке. Возьми свои данные, а не авторские: допиши в код свою строку с вызовом и запусти. Если хоть на одном примере вывод расходится с обещанием — вердикт другой.";
  if (real === "ok")
    return "<b>Тут подозрение напрасно</b>Ты решил, что код где-то врёт. Тогда покажи это себе: найди данные, на которых он расходится с обещанием. Не находится ни одних — значит вердикт другой.";
  if (said === "wrong" && real === "partly")
    return "<b>Почти, но нет</b>«Врёт сразу» значит, что ошибка видна на том самом примере, который показал автор. Запусти код как есть: на его примере ответ верный. Значит врёт он не сразу.";
  return "<b>Почти, но нет</b>«Работает, но не всегда» значит, что на примере автора всё сходится. Запусти код как есть и сравни вывод с обещанием — сходится ли?";
}

function wireReview(x){
  var panel = document.getElementById("verdict");
  if (!panel) return;
  /* Правильный ответ СЧИТАЕМ движком, а не берём из x.verdict. Поле в
     содержании остаётся, но служит страховкой: tests/lessons.js сверяет его
     с этим же вычислением и падает, если они разошлись. Так «правильный
     ответ» невозможно записать неверно — его определяет запуск кода. */
  var real = reviewTruth(x);
  panel.querySelectorAll(".vbtn").forEach(function(b){
    b.onclick = function(){
      A.session().attempts++;
      var said = b.getAttribute("data-v");
      panel.querySelectorAll(".vbtn").forEach(function(o){ o.classList.toggle("on", o === b); });
      if (said !== real){
        document.getElementById("vpick").innerHTML = "";
        vmsg("bad", verdictNudge(said, real));
        return;
      }
      if (real === "ok"){ winAI(x, reviewProof(x, real)); return; }
      vmsg("ok", "<b>Вердикт верный</b>Осталось показать, где именно поломка: ткни в строку кода от ИИ.");
      showLinePicker(x, real);
    };
  });
}

/* Строки берём из x.code, а не из редактора: ребёнок мог там всё переписать,
   пока проверял, и номера бы разъехались. Пустые строки не кликаются. */
function showLinePicker(x, real){
  var box = document.getElementById("vpick");
  var lines = String(x.code).replace(/\n+$/, "").split("\n");
  box.innerHTML = '<div class="lines">' +
    lines.map(function(t, i){
      var empty = t.trim() === "";
      return '<button class="lrow' + (empty ? " off" : "") + '"' + (empty ? " disabled" : "") +
        ' data-line="' + (i+1) + '"><span class="ln">' + (i+1) + '</span><code>' + (A.hl(t) || "&nbsp;") + '</code></button>';
    }).join("") + '</div>';
  box.querySelectorAll(".lrow").forEach(function(b){
    b.onclick = function(){
      A.session().attempts++;
      var n = +b.getAttribute("data-line");
      box.querySelectorAll(".lrow").forEach(function(o){ o.classList.toggle("on", o === b); });
      if (n === x.badLine){ winAI(x, reviewProof(x, real)); return; }
      vmsg("bad", "<b>Строка не та</b>Эта строка делает своё дело правильно. Ищи ту, из-за которой ответ расходится с обещанием: сравни, что в ней написано, с тем, что должно получиться.");
    };
  });
}

function winAI(x, extra){
  A.ailabMark(x.id);
  A.markActiveToday();                 /* задание раздела держит дневной стрик живым */
  A.save();
  var xs = A.ailabList(), pos = xs.indexOf(x);
  var next = (pos >= 0 && pos < xs.length - 1) ? xs[pos+1] : null;
  var firstTry = A.session().attempts === 1 && A.session().hints === 0 && !A.session().shown;
  var big = x.boss ? "🏆" : (firstTry ? "🎯" : "🤖");
  var h2 = x.boss ? "Проект готов!" : (firstTry ? "Верно, с первого раза!" : "Верно!");
  var buttons = (next
      ? '<button class="bigbtn" id="wnext">Следующее →</button>'
      : '<button class="bigbtn" id="wlist">Ко всем заданиям</button>') +
    '<button class="bigbtn ghost" id="wstay">Остаться здесь</button>';
  document.getElementById("wincard").innerHTML =
    '<div class="big">' + big + '</div><h2>' + h2 + '</h2>' +
    '<p>' + A.esc(x.note || "Ты справился с заданием.") + '</p>' + (extra || "") +
    '<div class="winrow">' + buttons + '</div>';
  document.getElementById("win").classList.add("show");
  A.confetti(x.boss ? 3 : 2);
  var wn = document.getElementById("wnext");
  if (wn) wn.onclick = function(){ A.closeWin(); openAILesson(next.id); };
  var wl = document.getElementById("wlist");
  if (wl) wl.onclick = function(){ A.closeWin(); screenAILab(); };
  document.getElementById("wstay").onclick = A.closeWin;
}

return {
  AI_STAGES: AI_STAGES,
  aiStageOf: aiStageOf,
  screenAILab: screenAILab,
  openAILesson: openAILesson,
  reviewTruth: reviewTruth,
  catchProbe: catchProbe,
  catchRun: catchRun,
  catchStart: catchStart
};
};
