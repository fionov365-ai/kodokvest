/* ============================================================
   Фионика — экраны раздела «Алгоритмы, ОГЭ и ЕГЭ»: карта экзаменов по
   номерам, задача, судья, победа и «Задача по своей программе».

   Отрезаны из app.js 17.09.2026 (архитектурный долг, § 2.5 RAZVITIE) по
   договору из шапки js/screens-showcase.js.

   ЗАМЕР ПЕРЕД РАЗРЕЗОМ (§ 4.54, tools/zamer.js). Раздел жил тремя кусками:
   вкладки (algoTab, ALGO_TABS) над слоем данных, экраны и «своя программа»
   под ним и дверь openExamMap на 4 600 строк ниже, рядом с вывеской.
     целиком со слоем данных — наружу 11 имён, и в том числе ИЗМЕНЯЕМОЕ
       состояние (algoBack читает «Назад» в app.js, algoMark пишут вариант и
       проверка);
     только экраны — наружу продукту 5 дверей (screenAlgo, openAlgo,
       openExamMap, openMyExam, myExamSources), внутрь 43 имени.
   Уехали ЭКРАНЫ. Остался в app.js СЛОЙ ДАННЫХ — список задач, «решено»,
   счёт по группам (algoList, algoById, algoDone, algoMark, algoCountIn/
   DoneIn/NextIn, ALGO_GROUPS) и контекст «откуда пришли» (algoBack,
   setAlgoBack): их читают Главное, свод экзаменов, вариант, проверка «что
   умеет сам» и дорога назад. Тот же вывод, что у домашки (1.146.0).

   ⚠️ СОСТОЯНИЕ. Вкладка карты (algoTab) — своя: её меняют только экран и
   дверь openExamMap, обе здесь. Задача «по своей программе» (myExamCur) —
   тоже своя; адрес #myexam открывает её входом openMyExam, а не чужим
   присваиванием. Контекст «откуда пришли» читается вызовом A.algoBack() —
   его ставит вариант, и снятая копия соврала бы (§ 4.5). Прогресс — A.S(),
   сессия — A.session() и A.newSession(v): сессия задачи — ОБЪЕКТ, в него
   экран пишет studio, lesson, attempts, и это тот же объект, что видит
   app.js.
   ⚠️ ДВЕРИ. Главное брало openExamMap ЗНАЧЕНИЕМ до договора — теперь
   обёрткой (§ 4.40). Робот, вариант и визуализатор — модули НИЖЕ договора,
   и сюда они едут обёртками по той же причине.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.algo = function(A){

/* ---- вкладки «Темы / ОГЭ / ЕГЭ» ----
   Решение 08.09.2026 (docs/arhitektura-2026-09-08.md § 2 и § 8): вкладка —
   это ЭКЗАМЕН, а не кусок списка. Резать 52 задачи по группам нельзя: группы
   «oge» и «ege» — это только формат заданий, а девять тем из одиннадцати
   (логика, графы, кодирование, системы счисления, исполнители, рекурсия,
   поиск, сортировка, цена) работают на оба экзамена сразу. Поэтому общая
   тема честно стоит в обеих вкладках, а не выбирает себе одну.
   ⚠️ Вкладка экзамена показывает ВСЕ его задания по номерам, включая те,
   которых у нас нет. Пустая строка в полном списке — это план работ на виду;
   выкинутая строка — враньё умолчанием. Номера и их год лежат в js/exams.js,
   там же разобрано, почему прежнее правило «номер не называем» уточнено, а
   не отменено. */
var algoTab = "all";
var ALGO_TABS = [["all","🧮 Темы"], ["oge","📄 ОГЭ"], ["ege","🎓 ЕГЭ"]];

function examMapHTML(ex){
  var t = EXAMS.tally(ex, A.algoCountIn);
  var h = '<p class="lede">Все <b>' + ex.total + '</b> заданий ' + A.esc(ex.title) +
    ' по номерам. Против каждого честно написано, что у нас есть, а чего нет.</p>' +
    '<p class="dim">Нумерация снята с демоверсии <b>' + ex.year + '</b> года и между ' +
    'годами меняется — сверяйтесь с демоверсией своего года. На экзамене принимают: ' +
    A.esc(ex.langs) + '.</p>' +
    '<div class="extally">' +
      '<span class="exok">✓ есть задачи: ' + t.yes + '</span>' +
      '<span class="expart">◐ наполовину: ' + t.part + '</span>' +
      '<span class="exsoon">◻ пока нет: ' + t.soon + '</span>' +
      '<span class="exno">— судить нечем: ' + t.no + '</span></div>' +
    '<div class="exmap">';
  ex.tasks.forEach(function(x){
    var st = EXAMS.state(x, A.algoCountIn);
    var right;
    if (st === "yes" && x.robot){
      var rxs = window.ROBOT_TASKS || [];
      right = '<span class="excnt">' + rxs.filter(function(r){ return A.algoDone(r.id); }).length +
        ' из ' + rxs.length + '</span>' +
        '<button class="rbtn sec" data-exrobot="1">Решать</button>';
    } else if (st === "yes"){
      var n = A.algoCountIn(x.g), d = A.algoDoneIn(x.g);
      right = '<span class="excnt">' + d + ' из ' + n + '</span>' +
        '<button class="rbtn sec" data-exgo="' + A.esc(x.g.join(",")) + '">Решать</button>';
    } else if (st === "part"){
      /* Половина задания наша, половина нет — и написано, какая именно.
         Свалить это в «есть задачи» значило бы обещать лишнее, а в «судить
         нечем» — отдать то, что мы правда закрываем. */
      right = '<span class="excnt">' + A.algoDoneIn(x.g) + ' из ' + A.algoCountIn(x.g) + '</span>' +
        '<span class="exwhy">кроме: ' + A.esc(x.off) + '</span>' +
        '<button class="rbtn sec" data-exgo="' + A.esc(x.g.join(",")) + '">Решать</button>';
    } else if (st === "no"){
      /* ⚠️ Причина ставится ПОСЛЕ двоеточия, а не после «нужен»: причины разного
         рода и числа («электронные таблицы», «файлы на диске», «текстовый
         редактор»), и любое согласование ломается на первой же строке —
         «нужен файлы на диске». Двоеточие согласования не требует. */
      right = '<span class="exwhy">судить нечем: ' + A.esc(x.off) + '</span>';
    } else {
      right = '<span class="exwhy">пока нет задач</span>';
    }
    h += '<div class="exrow ' + st + '"><span class="exn">' + x.n + '</span>' +
      '<span class="ext">' + A.esc(x.t) + '</span>' +
      '<span class="exact">' + right + '</span></div>';
  });
  h += '</div>' +
    /* ⚠️ Дверь в пробный вариант стоит именно здесь, под полным списком
       номеров: человек, который дочитал карту до конца, уже спросил себя
       «а как это выглядит целиком» — и до 1.120.0 ответа на этот вопрос в
       продукте не было вовсе. */
    '<div class="note"><b>Пройти весь экзамен подряд</b>' +
    'Карта показывает темы по номерам, а вариант собирает из них то, что бывает в мае: ' +
    'по одной задаче на каждый номер и по порядку. В конце видно, что закрыто, а что просело.' +
    '<div class="admrow"><button class="rbtn check" data-exvariant="' + A.esc(ex.id) + '">' +
    '📝 Собрать пробный вариант</button></div></div>' +
    (ex.id === "oge"
      ? '<div class="note"><b>Задания 15 и 16 — оба обязательны</b>' +
        '15 — алгоритм для исполнителя «Робот», у него свой язык и свой раздел. 16 — обычная ' +
        'программа, она в темах выше. До 2025 года это было одно задание на выбор; теперь ' +
        'на экзамене есть оба, и за каждое до двух баллов.' +
        '<div class="admrow"><button class="rbtn sec" data-exrobot="1">🤖 Открыть Робота</button></div></div>'
      : '') +
    '<div class="note"><b>Почему «судить нечем» — это не отговорка</b>' +
    'Наш судья запускает программу и сверяет вывод. Создать презентацию, построить ' +
    'диаграмму, найти файл на диске или сходить в поисковик он не может, и обещать ' +
    'это мы не будем. Всё остальное решается программой — даже там, где на экзамене ' +
    'принято брать таблицу: мы даём те же данные текстом, а решение остаётся ' +
    'программой. Поэтому «пока нет задач» — это план работ, а не граница.</div>';
  return h;
}
function screenAlgo(){
  A.enterScreen("train", "algo");
  A.setAlgoBack(null);
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  var xs = A.algoList(), done = xs.filter(function(x){ return A.algoDone(x.id); }).length;

  var h = '<div class="lvlhead"><div><div class="idx">информатика: алгоритмы и экзамен</div>' +
    '<h1>🧮 Алгоритмы, ОГЭ и ЕГЭ</h1></div>' +
    '<div class="right"><span class="tag">' + done + ' из ' + xs.length + '</span></div></div>' +
    '<div class="roomnav extabs">' + ALGO_TABS.map(function(t){
      return '<button' + (t[0] === algoTab ? ' class="on"' : '') +
        ' data-algotab="' + t[0] + '">' + t[1] + '</button>';
    }).join("") + '</div>';

  /* Вкладка экзамена — вместо тем, а не вдобавок к ним: это тот же материал,
     разложенный по номерам заданий. Своя задача и «что обещаем» остаются на
     вкладке «Темы»: там они к месту, а в карте экзамена только мешали бы
     смотреть на список. */
  if (algoTab !== "all"){
    h += examMapHTML(EXAMS[algoTab]) +
      '<div class="pager"><button class="bigbtn ghost" id="tomap">← К тренировкам</button></div>';
    A.app.innerHTML = h;
    A.app.querySelectorAll("[data-algotab]").forEach(function(b){
      b.onclick = function(){ algoTab = b.getAttribute("data-algotab"); screenAlgo(); };
    });
    /* «Решать» ведёт к первой НЕрешённой задаче темы, а не в начало списка. */
    A.app.querySelectorAll("[data-exrobot]").forEach(function(rb){
      rb.onclick = function(){ A.screenRobot(); };
    });
    var vb = A.app.querySelector("[data-exvariant]");
    if (vb) vb.onclick = function(){ A.variantOpenFor(vb.getAttribute("data-exvariant")); };
    A.app.querySelectorAll("[data-exgo]").forEach(function(b){
      b.onclick = function(){
        var t = A.algoNextIn(b.getAttribute("data-exgo").split(","));
        if (t) openAlgo(t.id);
      };
    });
    document.getElementById("tomap").onclick = A.screenTrain;
    A.refreshTop();
    window.scrollTo({ top:0, behavior:"smooth" });
    return;
  }

  h += '<p class="lede">Тот же Python и тот же судья, но задачи здесь школьные: поиск, ' +
    'сортировка, цена алгоритма, кодирование информации, логика, графы, исполнители, ' +
    'рекурсия и перебор — и типовые задания экзамена. Заходить можно с любого места курса — ' +
    'всё, что нужно, объясняется прямо в задании.</p>';

  /* ⚠️ Граница обещания стоит ДО заданий, а не мелким шрифтом внизу. */
  h += '<div class="card"><h3>⚖️ Что мы обещаем, а что нет</h3><ul class="trrules">' +
    '<li><b>Закрываем ту часть, где надо написать программу</b> (в кодификаторе — КЭС 3.2) ' +
    'и алгоритмику. Каркас заданий снят с открытого банка ФИПИ: формулировки наши, структура их.</li>' +
    '<li><b>Не закрываем экзамен целиком.</b> Кодирование информации, логика и графы ' +
    'добавлены в 1.77.0, исполнители и перебор — в 1.81.0: их тут решают программой, и наш ' +
    'судья их проверяет. Чего по-прежнему нет: <b>электронные таблицы</b>. Их проверять нечем — ' +
    'движок умеет запускать Python, а не считать формулы Excel.</li>' +
    /* ⚠️ Строка переписана 08.09.2026. Раньше здесь стояло «номер задания не
       называем»: нумерацию было нечем сверить. Теперь есть вкладки ОГЭ и ЕГЭ,
       где номера стоят, — и оговорка обязана говорить правду о том, что
       человек видит на соседней вкладке, иначе она ловится на вранье. */
    '<li><b>Номера заданий — только на вкладках экзаменов.</b> Нумерация между ' +
    'годами меняется, поэтому там написан год, с которого она снята, а сами номера ' +
    'лежат в одном месте и правятся одной таблицей. В названиях задач номеров нет: ' +
    'задача про графы остаётся задачей про графы, в каком бы году её ни спросили.</li>' +
    '<li><b>Типы ЕГЭ — свои формулировки по духу экзамена.</b> Мы берём те типы, ' +
    'где ответ считает программа; электронные таблицы — не наши. ' +
    'На настоящем экзамене — настоящий Python: то, что ты пишешь здесь, там работает так же.</li>' +
    '<li><b>Проверка гоняет программу и на скрытых данных.</b> Совпасть должен способ, ' +
    'а не один напечатанный ответ — ровно как на экзамене.</li>' +
    '<li><b>Цену алгоритма здесь считает движок.</b> Не «двоичный поиск быстрее», а ' +
    '«1000 шагов против 10» — числом на экране.</li>' +
    '</ul></div>';

  /* ⚠️ Карточка стоит ПЕРЕД группами, а не в конце списка: это единственная
     задача раздела, которой до сегодняшнего дня не существовало — её ещё
     предстоит собрать из кода самого ребёнка. Сама сборка идёт по нажатию:
     она стоит сотен прогонов движка, и делать их на каждом заходе в раздел
     нечестно к телефону. */
  h += '<div class="card"><h3>🧾 Задача по твоей программе</h3>' +
    '<p>Все задачи ниже написаны нами и одинаковы для всех. Эта — нет: она ' +
    'собирается из программы, которую написал ты. В ней закрывается одно число, ' +
    'и по напечатанному нужно понять, какое. Запускать нельзя — как на экзамене.</p>' +
    (myExamHasSource()
      ? '<div class="admrow"><button class="rbtn check" id="myexam">Собрать задачу</button>' +
        (A.algoDone("myexam") ? '<span class="dim">уже решал — задача будет другая</span>' : '') + '</div>'
      : '<p class="dim">Пока не из чего собрать: нужна твоя программа — сданный урок ' +
        'или сохранённая в «Моё» из песочницы.</p>') +
    '</div>';

  A.ALGO_GROUPS.forEach(function(g){
    var items = xs.filter(function(x){ return x.group === g.id; });
    if (!items.length) return;
    var d = items.filter(function(x){ return A.algoDone(x.id); }).length;
    h += '<div class="sect"><h2>' + g.em + ' ' + A.esc(g.title) + '</h2><div class="line"></div>' +
      '<span class="cnt">' + d + ' из ' + items.length + '</span></div>' +
      '<p class="dim">' + A.esc(g.why) + '</p><div class="gamegrid">';
    items.forEach(function(x){
      h += '<button class="gamecard" data-algo="' + A.esc(x.id) + '">' +
        '<span class="gemoji">' + x.emoji + '</span>' +
        '<b>' + A.esc(x.title) + (A.algoDone(x.id) ? ' <span class="edittag done">пройдено ✓</span>' : '') + '</b>' +
        '<span>' + A.esc(x.intro) + '</span>' +
        '<span class="wtag">' + A.esc(x.tag) + '</span></button>';
    });
    h += '</div>';
  });

  h += '<div class="pager"><button class="bigbtn ghost" id="tomap">← К тренировкам</button></div>';
  A.app.innerHTML = h;
  A.app.querySelectorAll("[data-algo]").forEach(function(b){
    b.onclick = function(){ openAlgo(b.getAttribute("data-algo")); };
  });
  A.app.querySelectorAll("[data-algotab]").forEach(function(b){
    b.onclick = function(){ algoTab = b.getAttribute("data-algotab"); screenAlgo(); };
  });
  document.getElementById("tomap").onclick = A.screenTrain;
  var me = document.getElementById("myexam");
  if (me) me.onclick = function(){
    me.disabled = true;
    me.textContent = "Собираю…";
    /* сборка блокирует поток на пару сотен прогонов — даём кнопке
       перерисоваться, иначе ребёнок жмёт второй раз по мёртвому экрану */
    setTimeout(function(){ myExamCur = myExamPick(); screenMyExam(); }, 30);
  };
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function openAlgo(id){
  var x = A.algoById(id);
  if (!x) return screenAlgo();
  /* Жёсткий потолок дня меряет ВСЁ время в тренажёре, а не только уроки, —
     значит и сюда новая работа после предела не пускает. */
  if (A.capHard()) return A.screenCapReached();
  A.enterScreen("train", "algoone");
  A.newSession({ id:id, attempts:0, hints:0, shown:false, algo:true });
  /* ⚠️ Режим экзамена приходит ОТТУДА, ОТКУДА ПРИШЛИ, а не из самой задачи:
     задача одна и та же, экзаменационным её делает вариант (js/variant.js).
     Читаем живым вызовом контекста, а не запоминаем: пока задача открыта,
     время могло выйти. */
  var exam = !!(A.algoBack() && A.algoBack().exam);

  var h = '<div class="crumbs"><span data-go="back">' +
    A.esc(A.algoBack() ? A.algoBack().crumb : "Алгоритмы") + '</span> › ' + x.emoji + ' ' + A.esc(x.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">' + A.esc(x.tag) + '</div>' +
    '<h1>' + x.emoji + ' ' + A.esc(x.title) + '</h1></div>' +
    (exam
      ? '<div class="right"><span class="examclock" id="examclock">⏱</span></div></div>'
      : '<div class="right"><span class="tag">звёзд не даёт</span></div></div>') +
    '<p class="lede">' + A.esc(x.intro) + '</p>' +
    '<div class="goal"><h3>🎯 Задача</h3><p>' + A.esc(x.goal) + '</p><ul>' +
    x.list.map(function(t){ return "<li>" + A.esc(t) + "</li>"; }).join("") + '</ul>' +
    /* Таблица «Пример работы программы» — часть каркаса ОГЭ, а не украшение:
       по ней школьник понимает формат ввода быстрее, чем по любому описанию. */
    (x.sample
      ? '<div class="ogesample"><div><b>Входные данные</b><pre>' +
        A.esc(x.sample.in.join("\n")) + '</pre></div>' +
        '<div><b>Выходные данные</b><pre>' + A.esc(x.sample.out) + '</pre></div></div>'
      : '') +
    /* Правило эксперта — до решения, а не только в вердикте: «данные
       константами — 0» полезно знать раньше, чем написал print(3). */
    (window.FIPI16 && FIPI16.applies(x)
      ? '<p class="dim">📝 На ОГЭ такую программу проверяет эксперт: запускает её на ' +
        'тестах, которых ученик не видит, и ставит 2, 1 или 0 баллов. Программа без ' +
        'ввода данных получает 0. ' + (exam ? 'Сколько вышло бы — скажет итог варианта.'
                                          : 'После проверки здесь будет написано, сколько вышло бы.') + '</p>'
      : '') + '</div>';

  h += '<div id="studio"></div>' +
    /* ⚠️ В режиме экзамена кнопки подсказки НЕ существует — она не спрятана
       и не отключена. Отключённая кнопка на экране экзамена читается как
       «подсказка есть, но её зажали», и ребёнок будет на неё давить. */
    (exam
      ? '<div class="hintbox"><span class="tip">режим экзамена: подсказок нет, ' +
        'а верно ли решено — скажет итог варианта, а не эта страница</span></div>'
      : '<div class="hintbox"><button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
        '<span class="tip">подсказки тут ничего не стоят — звёзд в этом разделе нет</span></div>') +
    '<div class="hintout" id="hintout"></div>' +
    '<div class="pager"><button class="bigbtn ghost" data-go="back">← ' +
      A.esc(A.algoBack() ? A.algoBack().backLabel : "Ко всем задачам") + '</button></div>';
  A.app.innerHTML = h;

  var studio = A.makeStudio({
    engine: "mini", code: x.starter, lint: true,
    stdin: x.stdin || null,
    label: "твоя программа",
    viz: function(o){
      A.screenViz({ code: o.code, env: o.env,
        backTo: { label: "← Вернуться к задаче", go: function(){ openAlgo(id); } } });
    },
    check: function(ed, showMsg){ runAlgoCheck(x, ed, showMsg); }
  });
  document.getElementById("studio").appendChild(studio);
  A.session().studio = studio;
  A.session().lesson = "algo-" + id;
  A.session().starter = [{ name:"main.py", code: x.starter }];
  var d = A.draftGet(A.session().lesson);
  if (d) A.draftApply(studio.editor, d.files);
  studio.editor.onEdit = A.draftSchedule;

  if (!exam) A.wireHint(x.hints);
  /* ---- часы экзамена ----
     ⚠️ Часы обязаны идти и ВНУТРИ задачи, а не только на экране варианта.
     Без них время выходит незаметно: ребёнок дописывает программу, сдаёт её
     и узнаёт, что вариант закрылся десять минут назад. Сколько осталось,
     спрашиваем живым вызовом у того, кто привёл (clock): конец времени знает
     вариант, задача о нём знать не должна.
     Таймер гасит себя сам по признаку «моего элемента больше нет на
     странице» — приём тот же, что у плеера визуализатора, и он переживает
     любой уход с экрана, включая тот, о котором мы не подумали. */
  var clk = document.getElementById("examclock");
  if (clk && A.algoBack() && A.algoBack().clock){
    var tickClock = function(){
      if (!document.body.contains(clk)) return clearInterval(clockId);
      var c = (A.algoBack() && A.algoBack().clock) ? A.algoBack().clock() : null;
      if (!c) return clearInterval(clockId);
      clk.textContent = "⏱ " + c.text;
      clk.classList.toggle("soon", !!c.soon);
      if (c.over){ clearInterval(clockId); A.algoBack().go(); }
    };
    var clockId = setInterval(tickClock, 1000);
    tickClock();
  }
  /* ⚠️ Дорога назад берётся у контекста ЖИВЫМ вызовом, а не запоминается
     сейчас: пока задача открыта, ребёнок мог уйти и вернуться другим путём. */
  A.app.querySelectorAll("[data-go]").forEach(function(b){
    b.onclick = function(){ return A.algoBack() ? A.algoBack().go() : screenAlgo(); };
  });
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ---- ответ, сданный в режиме экзамена ----
   ⚠️ Сообщение здесь ОДНО И ТО ЖЕ при верном и при неверном ответе, и класс
   у него один. Иначе режим экзамена противоречит сам себе: ребёнок сдаёт что
   попало и читает вердикт по цвету рамки — а вся ценность режима ровно в том,
   что до конца никто не говорит, попал ты или нет. По этой же причине здесь
   нет ни карточки победы, ни отметки в общем списке решённых: и то и другое
   рассказало бы правду раньше времени. Отметку ставит вариант, когда
   закрывается (js/variant.js, closeExam).
   ⚠️ А вот ошибку в самой программе прячь не смей: NameError и опечатку
   показывает и настоящий Python на настоящем экзамене. Это не вердикт. */
function examSend(ok, fg){
  /* fg — оценка эксперта ФИПИ (js/fipi16.js), если она к задаче применима.
     Вариант прячет её до итога так же, как и сам вердикт. */
  if (A.algoBack() && A.algoBack().onSend) A.algoBack().onSend(!!ok, fg || null);
  A.markActiveToday(); A.save(); A.refreshTop();
}
var EXAM_SENT_MSG = "<b>Ответ записан</b>Верно или нет — скажет итог варианта, " +
  "когда выйдет время или ты нажмёшь «Завершить». Здесь этого не говорят: " +
  "на экзамене тоже не говорят. Переписать и сдать заново, пока идёт время, можно — " +
  "считается последний ответ.";

function runAlgoCheck(x, ed, showMsg){
  A.session().attempts++;
  var exam = !!(A.algoBack() && A.algoBack().exam);
  var eng = Runtime.get("mini"), code = ed.getCode();
  var stdin = (A.session().studio && A.session().studio.getStdin) ? A.session().studio.getStdin() : (x.stdin || []);

  /* Запрет на готовое решение пишется в требованиях словами, и проверяется
     здесь: без него «напиши поиск сам» закрывается одной строкой .index(). */
  if (x.check.kind === "tests" || x.check.kind === "output"){
    var banned = { "find-linear":[".index("], "sort-bubble":["sorted(", ".sort("],
                   "find-binary":[".index("], "oge-max-base":["max("],
                   "digit-sum":["str(", "list("],
                   "base-convert":["bin(", "oct(", "hex("],
                   "oge-min-even":["min(", "sorted("],
                   "oge-two-even":["max(", "sorted(", ".sort("],
                   "ege-sub":[".count("],
                   "ege-maxsum":["max("],
                   /* Тонкие темы, 09.09.2026. ⚠️ Правило простое: запрет,
                      написанный в условии словами, обязан стоять и здесь.
                      Иначе условие врёт, и ребёнок узнаёт об этом сам —
                      сдав сортировку подсчётом одной строкой sorted(). */
                   "sort-count":["sorted(", ".sort("],
                   "cost-bubble":["sorted(", ".sort("],
                   "cost-divisors":["sqrt", "**"],
                   /* ⚠️ Запрет тут — на ДРОБНОЕ деление, как и сказано в
                      условии («дробями не пользоваться»). Стояла подстрока
                      "/", и она резала заодно целочисленное `//`, которое
                      дробей не даёт: честное `s2 * 100 // s1` получало
                      «Так нельзя… Требование стоит в условии», а в условии
                      такого требования нет. Найдено ревизией 18.09.2026. */
                   "cost-double":[/(^|[^\/])\/([^\/]|$)/] };
    var ban = banned[x.id] || [];
    /* ⚠️ Проверяем код БЕЗ комментариев: слово в пояснении ребёнка — не
       использование. Иначе строка «# sorted() тут нельзя» закрывала задачу. */
    var bare = code.replace(/(^|[^\\"'])#[^\n]*/g, "$1");
    for (var b = 0; b < ban.length; b++){
      var hit = (ban[b] instanceof RegExp) ? ban[b].test(bare) : bare.indexOf(ban[b]) >= 0;
      if (hit){
        var имя = (ban[b] instanceof RegExp) ? "дробным делением /" : ban[b];
        showMsg("warn", "<b>Так нельзя</b>В этой задаче нельзя пользоваться <code>" +
          A.esc(имя) + "</code> — иначе она решается одной строкой, и учиться нечему. " +
          "Требование стоит в условии.");
        return;
      }
    }
  }

  /* ===== оценка эксперта ФИПИ =====
     Задача-программа из тем задания ОГЭ получает, кроме вердикта, балл так,
     как его поставил бы эксперт: 2, 1 или 0 по скрытым наборам (js/fipi16.js,
     там же — страницы документа ФИПИ). Считается ДО всех ранних выходов: балл
     нужен и ребёнку, чья программа упала, и итогу варианта.
     ⚠️ Приглашение input("Введите…") у таких задач не печатается ни в одном
     прогоне: сверяется ответ, а о тексте приглашения говорит предупреждение. */
  var fipi = !!(window.FIPI16 && FIPI16.applies(x));
  var fg = fipi ? FIPI16.grade(eng, code, x) : null;
  var fgHTML = (fg && !exam) ? FIPI16.verdictHTML(fg) : "";
  var runOpts = function(din){ return { stdin: din, quietPrompt: fipi }; };

  var res = eng.run(code, runOpts(stdin.slice()));
  /* ⚠️ Ошибку в самой программе показываем и на экзамене: опечатку и NameError
     настоящий Python тоже показывает, это не вердикт. Но ответ при этом всё
     равно считается сданным — иначе «сдал программу с ошибкой» не попало бы в
     итог вовсе, и вариант посчитал бы номер просто неоткрытым. */
  if (res.error){
    if (exam) examSend(false, fg);
    ed.setError(res.error.line); showMsg("bad", A.errHTML(res.error) + fgHTML); return;
  }

  /* ⚠️ Нет ввода или нет вывода — 0 баллов у эксперта, даже если число
     совпало (МР ФИПИ ОГЭ-2026, с. 54). Значит, и у нас это не победа:
     программа print(3) с совпавшим числом ничему не научилась. */
  if (fg && (fg.zero === "input" || fg.zero === "output")){
    if (exam){ examSend(false, fg); showMsg("info", EXAM_SENT_MSG); return; }
    showMsg("bad", "<b>" + (fg.zero === "input" ? "Программа не читает входные данные"
                                                : "Программа ничего не печатает") + "</b>" + fgHTML);
    return;
  }

  var problem = null;
  if (x.check.kind === "tests"){
    problem = A.runHiddenTests(eng, x.check.calls, code, {}, x.solution, {}, {}, stdin.slice());
  } else {
    var exp = eng.run(x.solution, runOpts(stdin.slice())).lines, got = res.lines;
    if (!(exp.length === got.length && exp.every(function(v, i){ return v === got[i]; })))
      problem = A.diffBlock(exp, got);
  }
  if (problem){
    if (exam){ examSend(false, fg); showMsg("info", EXAM_SENT_MSG); return; }
    showMsg("bad", "<b>Ещё не то</b>" + problem + fgHTML); return;
  }

  /* ===== скрытые наборы данных =====
     Без них задачу «сколько подходящих» можно сдать строкой print(3): вывод
     на открытом примере совпадёт. Совпасть должен СПОСОБ, а не один ответ —
     поэтому программа гоняется ещё и на наборах, которых нет на экране.
     ⚠️ Мы учим, а не экзаменуем: набор, на котором разошлось, показывается
     целиком. Спрятанная причина провала ничему не учит. */
  if (x.sets && x.sets.length){
    for (var si = 0; si < x.sets.length; si++){
      var din = x.sets[si].slice();
      var hres = eng.run(code, runOpts(din.slice()));
      if (hres.error){
        if (exam){ examSend(false, fg); showMsg("info", EXAM_SENT_MSG); return; }
        ed.setError(hres.error.line);
        showMsg("bad", "<b>Падает на скрытых данных</b>На открытом примере программа отработала, " +
          "а на другом наборе упала. Вход был:<pre>" + A.esc(din.join("\n")) + "</pre>" +
          A.errHTML(hres.error) + fgHTML);
        return;
      }
      var hexp = eng.run(x.solution, runOpts(din.slice())).lines, hgot = hres.lines;
      if (!(hexp.length === hgot.length && hexp.every(function(v, i){ return v === hgot[i]; }))){
        if (exam){ examSend(false, fg); showMsg("info", EXAM_SENT_MSG); return; }
        showMsg("bad", "<b>На скрытых данных — не то</b>На открытом примере вывод совпал, " +
          "но проверка гоняет программу и на других наборах. Вот на этом разошлось. " +
          "Вход:<pre>" + A.esc(din.join("\n")) + "</pre>" + A.diffBlock(hexp, hgot) + fgHTML);
        return;
      }
    }
  }

  /* ⚠️ Бюджет шагов — наш козырь, и проверяется он ПОСЛЕ правильности:
     сначала должно работать, и только потом «сколько это стоило». */
  if (x.budget){
    var cost = res.steps || 0;
    if (cost > x.budget){
      if (exam){ examSend(false, fg); showMsg("info", EXAM_SENT_MSG); return; }
      showMsg("warn", "<b>Работает, но дорого</b>Программа верна, а шагов ушло <b>" + cost +
        "</b> при разрешённых " + x.budget + ". В условии сказано, во сколько надо уложиться: " +
        "дело не в скорости компьютера, а в плане работы." + fgHTML);
      return;
    }
  }
  if (exam){ examSend(true, fg); showMsg("info", EXAM_SENT_MSG); return; }
  winAlgo(x, res, fg);
}

function winAlgo(x, res, fg){
  var first = !A.algoDone(x.id);
  A.algoMark(x.id);
  A.markActiveToday();
  /* Тот, кто привёл сюда, узнаёт о победе ПЕРВЫМ и до отрисовки: вариант
     считает закрытые номера сам, и его счёт обязан сойтись с тем, что
     ребёнок сейчас прочитает на карточке победы. */
  if (A.algoBack() && A.algoBack().onWin) A.algoBack().onWin(x);
  A.save(); A.refreshTop();
  document.getElementById("wincard").innerHTML =
    '<div class="big">' + (A.session().attempts === 1 ? "🎯" : "✅") + '</div>' +
    '<h2>' + (A.session().attempts === 1 ? "Решено с первой попытки" : "Задача решена") + '</h2>' +
    '<p>Проверял движок: он запустил твою программу на скрытых данных, ' +
    'а не сверил буквы кода.</p>' +
    '<div class="stepnote"><b>Что тут было.</b> ' + A.esc(x.note) + '</div>' +
    (fg && window.FIPI16 ? FIPI16.verdictHTML(fg) : '') +
    (res && res.steps
      ? '<div class="stepnote">⚙️ Твоя программа обошлась в <b>' + res.steps + '</b> ' +
        A.plural(res.steps, "шаг", "шага", "шагов") + '. Это не оценка — это цена, ' +
        'и её всегда можно попробовать сбить.</div>'
      : '') +
    '<div class="winrow"><button class="bigbtn" id="walgo">' +
    A.esc(A.algoBack() ? A.algoBack().winLabel : "Ко всем задачам") + '</button>' +
    '<button class="bigbtn ghost" id="wstay">Остаться здесь</button></div>';
  document.getElementById("win").classList.add("show");
  A.confetti(first ? 2 : 1);
  document.getElementById("walgo").onclick = function(){
    var back = A.algoBack();
    A.closeWin();
    return back ? back.go() : screenAlgo();
  };
  document.getElementById("wstay").onclick = A.closeWin;
}


/* ================= экзамен по своей программе =================
   Остаток пункта 1.1б. Все задачи мира «Алгоритмы, ОГЭ и ЕГЭ» написаны нами
   и одинаковы для всех. Здесь — задача, которой не существовало до того, как
   ребёнок написал свою программу: она собирается ИЗ ЕГО КОДА.

   ⚠️ Тип взят экзаменационный и ровно один: ОБРАТНАЯ задача. Не «что
   напечатает программа» — так уже спрашивает проверка понимания в конце
   занятия (myPredictMake), — а «программа напечатала вот это; какое число
   стояло в закрытой клетке». Разница не в оформлении: прямую задачу можно
   сдать, вспомнив свой прошлый вывод, обратную — нельзя, её приходится
   выполнять в голове. Это и есть школьный тип «найдите число, при котором».

   ⚠️ Верный ответ обязан быть ОДИН. Мы не спрашиваем «какое число подходит»:
   движок прогоняет ВЕСЬ диапазон и берёт только то значение, чей вывод не
   повторился ни у одного другого. Задача с двумя верными ответами ломается
   не у нас в тестах, а у ребёнка, который решил правильно.

   ⚠️ Задача собирается ПО КНОПКЕ, а не при отрисовке экрана: на неё уходит
   до нескольких сотен прогонов движка, и делать их каждый раз, когда ребёнок
   просто зашёл в раздел, нечестно к его телефону.

   ⚠️ Чужой код в источники не идёт. Берём то, что ребёнок назвал сам
   («Мои программы»), и черновики сданных уроков, где решение НЕ открывалось,
   — то же правило, по которому попадают детали на полку мастерской. */
var MYEXAM_LO = 1;            /* в каком диапазоне ищем закрытое число */
var MYEXAM_HI = 30;
var MYEXAM_SPOTS = 3;         /* столько мест в программе пробуем */
var MYEXAM_SRC = 4;           /* столько программ пробуем */
var MYEXAM_BOX = "⬜";

function myExamSources(){
  var out = [];
  A.myWorksList().forEach(function(x){
    out.push({ code: x.code, from: "твоя программа «" + x.title + "»" });
  });
  var d = A.draftsAll();
  var ids = Object.keys(d).filter(function(id){
    var g = (A.S().log || {})[id] || {};
    return A.solved(id) && !g.shown && !!CURRICULUM.byId(id);
  });
  ids.sort(function(a, b){
    return (((A.S().log || {})[b] || {}).solvedAt || 0) - (((A.S().log || {})[a] || {}).solvedAt || 0);
  });
  ids.forEach(function(id){
    var dr = A.draftGet(id);
    if (!dr || dr.files.length !== 1) return;   /* вопрос про одну страницу кода */
    var l = CURRICULUM.byId(id);
    out.push({ code: dr.files[0].code, id: id,
               from: "твоя программа из урока " + l.num + " «" + l.title + "»" });
  });
  return out;
}
/* Есть ли из чего собирать. Дёшево: ничего не запускает — нужно карточке,
   которая рисуется на каждом заходе в раздел. */
function myExamHasSource(){ return myExamSources().length > 0; }

function myExamMake(code){
  if (!A.myPredSafe(code)) return null;
  if (!A.myPredRun(code)) return null;
  var k = A.codeSkeleton(code);
  var re = /(^|[^A-Za-z_0-9.А-Яа-яЁё])(\d+)(?![.\dA-Za-z_])/g, m, spots = [];
  while ((m = re.exec(k)) !== null && spots.length < MYEXAM_SPOTS)
    spots.push({ at: m.index + m[1].length, txt: m[2] });
  for (var i = 0; i < spots.length; i++){
    var at = spots[i].at, len = spots[i].txt.length;
    var was = parseInt(spots[i].txt, 10);
    var outs = {}, seen = {}, v, o;
    for (v = MYEXAM_LO; v <= MYEXAM_HI; v++){
      o = A.myPredRun(code.slice(0, at) + String(v) + code.slice(at + len));
      outs[v] = o;
      if (o) seen[o] = (seen[o] || 0) + 1;
    }
    /* ⚠️ Идём по диапазону не с начала, а со сдвига, посчитанного из самого
       кода. Иначе годным первым почти всегда оказывается наименьшее значение,
       и ответ «1» начинает угадываться без единой мысли — а угаданная задача
       не проверяет ничего. Сдвиг считается из кода, поэтому у одной и той же
       программы задача одна и та же. */
    var span = MYEXAM_HI - MYEXAM_LO + 1;
    var shift = 0;
    for (var c = 0; c < code.length; c++) shift = (shift * 31 + code.charCodeAt(c)) % span;
    for (var t = 0; t < span; t++){
      v = MYEXAM_LO + ((shift + t) % span);
      o = outs[v];
      if (!o || seen[o] !== 1) continue;      /* вывод повторяется — ответов два */
      if (v === was) continue;                /* своё число ребёнок помнит */
      return { code: code.slice(0, at) + MYEXAM_BOX + code.slice(at + len),
               out: o, ans: v, lo: MYEXAM_LO, hi: MYEXAM_HI };
    }
  }
  return null;
}
/* Собрать задачу из первой годной программы. null — значит не из чего:
   придумывать задачу из ничего нельзя, ровно как в проверке понимания. */
function myExamPick(){
  var src = myExamSources();
  for (var i = 0; i < src.length && i < MYEXAM_SRC; i++){
    var made = myExamMake(src[i].code);
    if (made){ made.from = src[i].from; return made; }
  }
  return null;
}

var myExamCur = null;         /* собранная задача живёт до следующей сборки */

function screenMyExam(){
  if (A.capHard()) return A.screenCapReached();
  A.enterScreen("train", "myexam");
  A.newSession({ id:null, attempts:0, hints:0, shown:false, myexam:true });
  var made = myExamCur;

  var head = '<div class="crumbs"><button class="backbtn" data-go="algo">← К задачам</button>' +
    '<span data-go="algo">Алгоритмы, ОГЭ и ЕГЭ</span> › 🧾 Задача по твоей программе</div>' +
    '<div class="lvlhead"><div><div class="idx">экзамен по своему коду</div>' +
    '<h1>🧾 Какое число закрыто?</h1></div>' +
    '<div class="right"><span class="tag">твой код</span></div></div>';

  if (!made){
    A.app.innerHTML = head +
      '<div class="card"><h3>Пока не из чего собрать</h3>' +
      '<p>Задача собирается из программы, которую написал ты сам: из сданного урока ' +
      'или из того, что ты сохранил в «Моё» из песочницы. Нужна программа, которая ' +
      'что-то печатает и печатает это всегда одинаково — без ввода с клавиатуры, ' +
      'без случайных чисел и без черепашки.</p>' +
      '<p class="dim">Урок, где ты открывал решение, сюда не идёт: это не твой код.</p>' +
      '<div class="winrow"><button class="bigbtn ghost" data-go="algo">← К задачам</button>' +
      '<button class="bigbtn ghost" id="me-sand">Открыть песочницу</button></div></div>';
    A.app.querySelectorAll("[data-go]").forEach(function(b){ b.onclick = screenAlgo; });
    var sb = document.getElementById("me-sand");
    if (sb) sb.onclick = A.screenSandbox;
    A.refreshTop();
    return;
  }

  A.app.innerHTML = head +
    '<p class="lede">Это ' + A.esc(made.from) + '. Одно число в ней ' +
    'закрыто клеткой ' + MYEXAM_BOX + '. Известно только то, что она напечатала. ' +
    'Запускать нельзя: реши в голове, как на экзамене.</p>' +
    '<div class="goal"><h3>🎯 Твоя задача</h3>' +
    '<p>Программа напечатала:</p><pre><code>' + A.esc(made.out) + '</code></pre>' +
    '<p>Какое целое число от ' + made.lo + ' до ' + made.hi + ' стоит вместо ' + MYEXAM_BOX +
    '? Оно ровно одно: при любом другом программа напечатала бы не это.</p></div>' +
    '<div id="studio"></div>' +
    '<div class="pager"><button class="bigbtn ghost" data-go="algo">← К задачам</button></div>';

  var studio = A.makePredictStudio({
    code: made.code,
    ask: "какое число закрыто клеткой " + MYEXAM_BOX + "?",
    place: "число",
    hint: "Одно целое число от " + made.lo + " до " + made.hi + ". Потом нажми «Проверить».",
    rows: 2,
    outHead: "верное число",
    check: function(ed, showMsg){
      A.session().attempts++;
      var got = String(ed.getCode()).trim().replace(",", ".");
      if (!/^-?\d+$/.test(got))
        return showMsg("warn", "<b>Нужно число</b>Одно целое число от " + made.lo +
          " до " + made.hi + " — без слов и без пробелов.");
      if (parseInt(got, 10) === made.ans) return winMyExam(made);
      /* ⚠️ Верное число не показываем: задача решается перебором в голове, и
         показанный ответ убивает вторую попытку насовсем. Вместо ответа —
         направление: больше или меньше. */
      showMsg("bad", "<b>Не оно</b>При " + A.esc(got) + " программа напечатала бы другое. " +
        (parseInt(got, 10) < made.ans ? "Загаданное число больше." : "Загаданное число меньше.") +
        " Пройди программу по строчкам ещё раз.");
    }
  });
  document.getElementById("studio").appendChild(studio);
  A.session().studio = studio;
  A.app.querySelectorAll("[data-go]").forEach(function(b){ b.onclick = screenAlgo; });
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function winMyExam(made){
  var first = A.session().attempts === 1;
  A.algoMark("myexam");
  A.markActiveToday();
  A.save(); A.refreshTop();
  document.getElementById("wincard").innerHTML =
    '<div class="big">' + (first ? "🧾" : "✅") + '</div>' +
    '<h2>' + (first ? "Сошлось с первой попытки" : "Число найдено") + '</h2>' +
    '<p>Закрыто было <b>' + made.ans + '</b>. Ты решил это, не запуская программу, — ' +
    'а значит выполнил её в голове. Именно этого и просит экзамен.</p>' +
    '<div class="stepnote"><b>Что тут было.</b> Задача не написана нами: она собрана ' +
    'из твоего же кода. Другой ребёнок такой задачи не увидит — у него другая программа.</div>' +
    '<div class="winrow"><button class="bigbtn" id="me-more">Ещё одну</button>' +
    '<button class="bigbtn ghost" id="walgo">Ко всем задачам</button></div>';
  document.getElementById("win").classList.add("show");
  A.confetti(first ? 2 : 1);
  document.getElementById("walgo").onclick = function(){ A.closeWin(); screenAlgo(); };
  document.getElementById("me-more").onclick = function(){
    A.closeWin();
    myExamCur = myExamPick();
    screenMyExam();
  };
}

/* Открыть карту экзамена сразу на нужной вкладке. Без этого любая дверь с
   вывески приводила бы на «Темы», и человек, пришедший за ЕГЭ, снова искал
   бы его глазами. */
function openExamMap(id){
  algoTab = (id === "oge" || id === "ege") ? id : "all";
  screenAlgo();
}
/* Адрес #myexam: задача по своей программе, собранная раньше, или новая. */
function openMyExam(){
  myExamCur = myExamCur || myExamPick();
  screenMyExam();
}

return {
  screenAlgo: screenAlgo, openAlgo: openAlgo, openExamMap: openExamMap,
  openMyExam: openMyExam, screenMyExam: screenMyExam,
  /* источники программ читает и «Защита своего кода» */
  myExamSources: myExamSources,
  /* дальше — только для теста (window.__game) */
  myExamMake: myExamMake, myExamPick: myExamPick, myExamHasSource: myExamHasSource,
  MYEXAM_LO: MYEXAM_LO, MYEXAM_HI: MYEXAM_HI, MYEXAM_BOX: MYEXAM_BOX
};
};
