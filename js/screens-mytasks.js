/* ============================================================
   Фионика — экраны раздела «Своё задание».

   Отрезаны из app.js 15.09.2026 (архитектурный долг, § 2.5 RAZVITIE) по
   договору из шапки js/screens-showcase.js.

   ЗАМЕР ПЕРЕД РАЗРЕЗОМ (§ 4.54, по именам). Раздел сплошной, 532 строки,
   но у него два слоя, и снаружи ими пользуются по-разному:
     целиком     — внутрь 23 имени, наружу 11 (кроме теста);
     только экраны — внутрь 33, наружу 4.
   Уехали ЭКРАНЫ: «Задай задачу взрослому», решение чужого задания и победа,
   «Твою задачу решили», «Ссылка не открылась». Остался в app.js СЛОЙ
   ФОРМАТА — упаковка задания и квитанции в ссылку (taskPack/Unpack/Link,
   solvedPack/Unpack/Link), ключ задания, сборка задания движком (taskBuild)
   и хранилище своих заданий и квитанций. Это не экран, а общий слой: на нём
   стоят и «Своё задание» ребёнка, и задача ребёнку из кабинета взрослого
   (та тоже собирается taskBuild и уезжает taskLink), его читают портфолио,
   Главное, витрина и разбор ссылок #task= и #solved= при загрузке. Тот же
   вывод, что у домашки (1.146.0) и разминки (1.183.0).

   ⚠️ СОСТОЯНИЕ. Свои слоты — черновик задания (S.mytaskDraft) и отметку
   «чужое задание уже решал» (S.friendTasks) — экраны читают через A.S().
   Опыт за чужое задание — ОБЩИЙ счётчик, поэтому его начисляет вход
   A.friendTaskWin(key) в app.js, а не модуль (§ 4.5). Сессия — A.session()
   и A.newSession(v): черновик задания при уходе с экрана сохраняет draftFlush
   по метке mytask и функции mytaskStash в сессии.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.mytasks = function(A){

/* Экран автора: его задачу решили. Открывается по присланной обратно ссылке.
   ⚠️ Хвалим РЕШИВШЕГО, а не автора за сложность: «взрослый не смог с первой
   попытки» — это повод для гордости, но не для злорадства, и разница между
   ними целиком в словах. */
function screenSolved(r){
  A.enterScreen("mine", "solved");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  A.solvedAdd(r);
  var mine = A.myTasksList().filter(function(t){ return A.taskKey(t) === r.key; })[0];
  var title = (mine && mine.title) || r.title || "твоя задача";
  var n = r.tries;

  A.app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">ответ на твою задачу</div>' +
    '<h1>🎉 Твою задачу решили</h1></div>' +
    '<div class="right"><span class="tag">роль автора</span></div></div>' +
    '<p class="lede">Задачу «<b>' + A.esc(title) + '</b>» прошли' +
    (n === 1 ? ' <b>с первой попытки</b>' : ' с <b>' + n + '-й</b> попытки') + '. ' +
    'Сверял вывод тренажёр, а не человек, — значит условие ты написал понятно.</p>' +
    '<div class="card"><h3>' + (n === 1
      ? "С первой попытки — условие было понятным"
      : "Не с первой попытки — и это нормально") + '</h3>' +
    '<p>' + (n === 1
      ? "Написать условие так, чтобы по нему получилось решить с первого раза, труднее, чем решить самому: " +
        "приходится объяснить задачу словами, ничего не пропустив."
      : "Попыток было " + n + ". Спроси, что оказалось непонятным в условии, — это и есть самая " +
        "полезная часть: так учатся писать условия, а не только программы.") + '</p>' +
    '<p class="dim">Ни имени, ни программы решавшего в ссылке нет — только какая задача ' +
    'и с какой попытки. Мы про людей ничего не собираем.</p></div>' +
    '<div class="pager"><button class="bigbtn" id="tomine">✍️ Задать ещё одну</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';
  document.getElementById("tomine").onclick = function(){
    try { history.replaceState(null, "", location.pathname + location.search); } catch(e){}
    screenMyTasks();
  };
  document.getElementById("tomap").onclick = function(){
    try { history.replaceState(null, "", location.pathname + location.search); } catch(e){}
    A.screenWorlds();
  };
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ===== экран: мои задания ===== */
function screenMyTasks(edit){
  A.enterScreen("mine", "mytasks");
  var list = A.myTasksList();
  var draft = (A.S().mytaskDraft && typeof A.S().mytaskDraft === "object") ? A.S().mytaskDraft : null;
  var start = edit || draft || { title:"", goal:"", code:"" };

  var got = A.solvedCount();
  var h = '<div class="lvlhead"><div><div class="idx">без звёзд, по желанию</div>' +
    '<h1>✍️ Задай задачу взрослому</h1></div>' +
    '<div class="right"><span class="tag">взрослому или другу</span></div></div>' +
    '<p class="lede">Обычно задания раздают тебе. Здесь наоборот: задачу придумываешь ты, ' +
    'а решает мама, папа, брат или друг — прямо в браузере, за пару минут. ' +
    'Ты пишешь программу, тренажёр сам считает, что она печатает, и это становится правильным ответом. ' +
    'Твоего кода в ссылке нет: решать придётся своей головой, сойтись должен вывод.</p>' +
    (got ? '<p class="lede">🎉 Твои задачи уже решали: <b>' + got + '</b> ' +
           A.plural(got, "раз", "раза", "раз") + '.</p>' : '');

  h += '<div class="card"><h3>Как это работает</h3>' +
    '<ol class="tsteps"><li>Пишешь программу — такую, какой сам решил бы задачу.</li>' +
    '<li>Пишешь условие словами: решающий не увидит кода, только эти слова.</li>' +
    '<li>Жмёшь «Собрать задание» — движок прогоняет программу и запоминает ответ.</li>' +
    '<li>Копируешь ссылку и отправляешь. Открывший будет решать.</li>' +
    '<li>Когда решат, тебе пришлют ссылку обратно — и ты увидишь, с какой попытки.</li></ol>' +
    '<p class="dim">Правило одно: без случайных чисел и без input(). У решающего случайное выпало бы другое, ' +
    'и проверить было бы нечего.</p>' +
    '<p class="dim">⚠️ Взрослому не нужно ничего устанавливать и уметь: он открывает ссылку, ' +
    'пишет программу и жмёт «Проверить». Судит тренажёр, а не ты, — спорить не о чем.</p></div>';

  h += '<div class="card"><h3>Задание</h3>' +
    /* Значения полей ставятся из JS, а не подставляются в разметку: esc()
       экранирует только &, < и >, поэтому кавычка в названии вырвалась бы
       из атрибута value и сломала форму. */
    '<label class="reglbl">Название' +
    '<input type="text" id="tttl" maxlength="60" autocomplete="off" placeholder="Например, Считалка до десяти"></label>' +
    '<label class="reglbl">Условие — что должна делать программа' +
    '<textarea id="tgoal" rows="3" maxlength="600" spellcheck="false" placeholder="Напечатай числа от 1 до 10, каждое с новой строки, а в конце их сумму."></textarea></label>' +
    '</div>' +
    /* Сообщения об ошибках показывает сама студия (её showMsg приходит в
       check), поэтому отдельного места под них тут нет — только под готовую
       ссылку. */
    '<div id="studio"></div><div id="tout"></div>';

  h += '<div class="sect"><h2>Мои задания</h2><div class="line"></div>' +
    '<span class="cnt">' + list.length + '</span></div>';
  if (!list.length){
    h += '<div class="note"><b>Пока ни одного</b>Собери первое — оно появится здесь, и ссылку можно будет выдать снова в любой момент.</div>';
  }
  list.forEach(function(t){
    var n = t.lines.length;
    var got = A.solvedFor(A.taskKey(t));
    h += '<div class="fproj done"><div class="fptop"><span class="pjemoji">✍️</span>' +
      '<div class="fpttl"><span class="pjkicker">' + A.fmtDay(t.at) + '</span>' +
      '<b>' + A.esc(t.title) + '</b>' +
      '<span class="fpsub">' + A.esc(t.goal) + '</span>' +
      (got.length
        ? '<span class="fpsub solvedline">🎉 Решили: ' + got.length + ' ' +
          A.plural(got.length, "раз", "раза", "раз") + ' · лучшая попытка — ' +
          Math.min.apply(null, got.map(function(x){ return x.n; })) + '-я</span>'
        : '') +
      '</div>' +
      '<span class="fpstat ok">' + n + " " + A.plural(n, "строка", "строки", "строк") + ' ответа</span></div>' +
      '<div class="fpbtns"><button class="rbtn" data-tlink="' + t.id + '">Скопировать ссылку</button>' +
      '<button class="rbtn sec" data-topen="' + t.id + '">Открыть как друг</button>' +
      '<button class="rbtn sec" data-tedit="' + t.id + '">Переделать</button>' +
      '<button class="rbtn sec" data-tdel="' + t.id + '">Удалить</button></div></div>';
  });
  h += '<div class="pager"><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';
  A.app.innerHTML = h;

  var studio = A.makeStudio({
    engine: "mini",
    code: start.code || '# программа-ответ: как ты сам решил бы свою задачу\nprint("привет")\n',
    label: "твоя программа — с неё считается правильный ответ",
    checkLabel: "📦 Собрать задание",
    check: function(ed, showMsg){ taskPublish(ed, showMsg); }
  });
  document.getElementById("studio").appendChild(studio);

  var ttl = document.getElementById("tttl"), tgoal = document.getElementById("tgoal");
  ttl.value = start.title || "";
  tgoal.value = start.goal || "";
  function read(){
    return { title: ttl.value, goal: tgoal.value, code: studio.editor.getCode() };
  }
  /* Уход с экрана не должен стирать начатое задание — ровно та же беда, что
     когда-то была у песочницы и у уроков. Метка mytask говорит draftFlush,
     что тут есть что сохранить, а stash отдаёт ему все три поля разом. */
  A.newSession({ id:null, attempts:0, hints:0, shown:false, mytask:true, studio:studio,
    mytaskStash: function(){
      var v = read();
      A.S().mytaskDraft = (v.title.trim() || v.goal.trim()) ? v : null;
    } });
  studio.editor.onEdit = A.draftSchedule;
  ttl.addEventListener("input", A.draftSchedule);
  tgoal.addEventListener("input", A.draftSchedule);

  function taskPublish(ed, showMsg){
    var v = read();
    var built = A.taskBuild(v.title, v.goal, v.code);
    if (built.problem){ showMsg("warn", "<b>Пока не задание</b>" + built.problem); return; }
    if (built.error){
      ed.setError(built.error.line);
      showMsg("bad", "<b>Программа падает</b>Задание не может падать: сначала починим её.<br>" + A.errHTML(built.error));
      return;
    }
    var id = A.myTaskSave(built.task);
    A.S().mytaskDraft = null;
    A.award("author");
    A.markActiveToday();       /* составить задание — это занятие, стрик живёт */
    A.save();
    showMsg("ok", "<b>Задание готово</b>Правильный ответ посчитан движком — вот он. " +
      "Ссылка ниже: отправь её тому, кого хочешь озадачить.");
    var link = A.taskLink(built.task);
    document.getElementById("tout").innerHTML =
      '<div class="card"><h3>Правильный ответ (его посчитал движок)</h3>' +
      '<pre class="fpcode">' + A.esc(built.task.lines.join("\n")) + '</pre>' +
      '<h3>Ссылка для друга</h3><div class="codebox"><code id="tlink">' + A.esc(link) + '</code>' +
      '<button class="rbtn sec" id="tcopy">Скопировать</button></div>' +
      '<p class="dim">Ссылка длинная, потому что задание целиком лежит внутри неё — ни сервера, ни интернета для этого не нужно. ' +
      'Твоей программы в ссылке нет.</p>' +
      '<div class="fpbtns"><button class="rbtn" id="tselfcheck">Открыть как друг</button></div></div>';
    document.getElementById("tcopy").onclick = function(){ A.copyText(link, this); };
    document.getElementById("tselfcheck").onclick = function(){
      openFriendTask(built.task, { own:true, id:id });
    };
    A.refreshTop();
  }

  A.app.querySelectorAll("[data-tlink]").forEach(function(b){
    b.onclick = function(){
      var t = A.myTasksAll()[b.getAttribute("data-tlink")];
      if (t) A.copyText(A.taskLink(t), b);
    };
  });
  A.app.querySelectorAll("[data-topen]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-topen"), t = A.myTasksAll()[id];
      if (t) openFriendTask(t, { own:true, id:id });
    };
  });
  A.app.querySelectorAll("[data-tedit]").forEach(function(b){
    b.onclick = function(){
      var t = A.myTasksAll()[b.getAttribute("data-tedit")];
      if (t) screenMyTasks({ title:t.title, goal:t.goal, code:t.code });
    };
  });
  A.app.querySelectorAll("[data-tdel]").forEach(function(b){
    b.onclick = function(){
      A.myTaskDrop(b.getAttribute("data-tdel"));
      screenMyTasks();
    };
  });
  document.getElementById("tomap").onclick = A.goHome;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ===== экран: решаем чужое задание =====
   opts.own — это своё же задание, открытое «глазами друга»: проверка та же,
   но опыт за него не даётся (иначе задания составлялись бы ради XP). */
function openFriendTask(t, opts){
  A.enterScreen("mine", "friendtask");
  opts = opts || {};
  var key = A.taskKey(t);
  var already = !!(A.S().friendTasks && A.S().friendTasks[key]);
  /* Имя автора показываем как есть, без склонения: «задание от Аня» звучит
     ломано, а склонять русские имена в коде — верный способ ошибиться. */
  var who = t.author ? "автор — " + A.esc(t.author) : "задание от друга";

  var h = '<div class="lvlhead"><div><div class="idx">' +
    (opts.own ? "твоё задание глазами друга" : who) + '</div>' +
    '<h1>✍️ ' + A.esc(t.title) + '</h1></div>' +
    '<div class="right"><span class="tag">звёзд не даёт</span></div></div>' +
    '<p class="lede">' + (opts.own
      ? 'Так задание видит тот, кому ты отправил ссылку: условие есть, а твоей программы нет. Попробуй решить сам — заодно проверишь, всё ли понятно из условия.'
      : 'Это задание придумал человек, а не тренажёр. Твоя задача — написать программу, которая печатает то же самое. ' +
        'Правильный ответ уже посчитан у автора: сойтись должен вывод, а не буквы кода.') + '</p>';

  h += '<div class="goal"><h3>🎯 Условие</h3><p>' + A.esc(t.goal) + '</p>' +
    '<ul><li>Проверяется напечатанное: строк должно быть столько же и слово в слово.</li>' +
    '<li>Как ты это сделаешь — твоё дело: у автора своя программа, у тебя может быть другая.</li></ul></div>';

  /* Ссылку часто открывает ВЗРОСЛЫЙ, и открывает он её впервые. Ему надо
     сказать три вещи и не больше: устанавливать ничего не нужно, судит
     тренажёр, и зачем это вообще. Третье — не реклама: пока взрослый не
     понимает, что происходит, он закроет вкладку. */
  if (!opts.own)
    h += '<div class="card"><h3>Если вы взрослый и открыли это впервые</h3>' +
      '<p>Устанавливать ничего не нужно: пишете программу прямо здесь и жмёте «Проверить». ' +
      'Совпадение вывода сверяет тренажёр, а не автор задачи, — спорить не о чем.</p>' +
      '<p class="dim">Задачу придумал ребёнок, и это сложнее, чем решить: ему пришлось объяснить её ' +
      'словами так, чтобы вы поняли без его программы. Объяснить может только тот, кто понял, — ' +
      'поэтому пара минут здесь говорит о его понимании больше любого отчёта.</p></div>';

  h += '<div id="studio"></div>' +
    '<div class="pager"><button class="bigbtn ghost" id="tomine">✍️ Составить своё</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';
  A.app.innerHTML = h;

  /* Код решателя сохраняется тем же механизмом, что черновики уроков: ключ
     задания вместо id урока. Ушёл посмотреть шпаргалку — код на месте. */
  var draftId = "task-" + key;
  var starter = "# твоя программа\n";
  var studio = A.makeStudio({
    engine: "mini", code: starter, label: "твоя программа",
    check: function(ed, showMsg){ friendCheck(ed, showMsg); }
  });
  document.getElementById("studio").appendChild(studio);
  A.newSession({ id:null, attempts:0, hints:0, shown:false, studio:studio,
              lesson:draftId, starter:[{ name:"main.py", code:starter }] });
  var d = A.draftGet(draftId);
  if (d) A.draftApply(studio.editor, d.files);
  studio.editor.onEdit = A.draftSchedule;

  function friendCheck(ed, showMsg){
    A.session().attempts++;
    var res = Runtime.get("mini").run(ed.getCode(), {});
    if (res.error){ ed.setError(res.error.line); showMsg("bad", A.errHTML(res.error)); return; }
    var got = res.lines, exp = t.lines;
    if (!(exp.length === got.length && exp.every(function(x, i){ return x === got[i]; }))){
      showMsg("bad", "<b>Ещё не то</b>" + A.diffBlock(exp, got));
      return;
    }
    winFriendTask(t, key, already, opts);
  }

  document.getElementById("tomine").onclick = function(){ screenMyTasks(); };
  document.getElementById("tomap").onclick = A.goHome;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* Опыт за чужое задание и отметку «уже решал» ставит вход в app.js: общий
   счётчик опыта модуль не пишет сам (§ 4.5). Своё задание, открытое глазами
   друга, и повторное решение опыта не дают. */
function winFriendTask(t, key, already, opts){
  var gained = (!opts.own && !already) ? A.friendTaskWin(key) : 0;
  A.markActiveToday();
  A.save(); A.refreshTop();

  var first = A.session().attempts === 1;
  document.getElementById("wincard").innerHTML =
    '<div class="big">' + (first ? "🎯" : "🤝") + '</div>' +
    '<h2>' + (opts.own ? "Своё задание проходится" : "Задание пройдено") + '</h2>' +
    '<p>' + (opts.own
      ? "Вывод сошёлся — значит условие понятное и задание решаемо. Можно отправлять."
      : "Вывод сошёлся с ответом автора" + (t.author ? " (" + A.esc(t.author) + ")" : "") +
        ". Программа у тебя своя, а результат тот же — так и работают настоящие задачи.") + '</p>' +
    (gained ? '<div class="winxp">+' + gained + ' XP</div>' : '') +
    /* ⚠️ Обратная ссылка — главная кнопка, а не приписка снизу. Без неё автор
       никогда не узнает, решили его задачу или нет, и «зритель», ради которого
       вся механика затевалась, остаётся немым. Своё же задание, открытое
       глазами друга, отправлять некому — там кнопки нет. */
    (opts.own ? '' : '<div class="winrow"><button class="bigbtn" id="fback">🔗 Отправить результат автору</button></div>' +
      '<div class="msg" id="fbackmsg"></div>') +
    '<div class="winrow"><button class="bigbtn' + (opts.own ? '' : ' ghost') + '" id="fmine">✍️ Составить своё</button>' +
    '<button class="bigbtn ghost" id="wstay">Остаться здесь</button></div>';
  document.getElementById("win").classList.add("show");
  A.confetti(first ? 3 : 1);
  var fb = document.getElementById("fback");
  if (fb) fb.onclick = function(){
    var link = A.solvedLink({ key: key, tries: A.session().attempts, title: t.title });
    var box = document.getElementById("fbackmsg");
    box.className = "msg show ok";
    box.innerHTML = '<b>Ссылка с результатом</b>Отправьте её автору тем же мессенджером. ' +
      'Ни имени, ни программы в ней нет — только какая задача и с какой попытки.' +
      '<div class="admrow"><button class="rbtn check" id="fbackcopy">Скопировать</button></div>' +
      '<p class="dim brk">' + A.esc(link) + '</p>';
    var cb = document.getElementById("fbackcopy");
    if (cb) cb.onclick = function(){ A.copyText(link, cb); };
  };
  document.getElementById("fmine").onclick = function(){ A.closeWin(); screenMyTasks(); };
  document.getElementById("wstay").onclick = A.closeWin;
}

/* Ссылка не открылась. Молча уводить на карту миров нельзя: ребёнок нажал
   на присланную ссылку и должен понять, что случилось, а не решить, что
   тренажёр сломался. */
function screenTaskBroken(){
  A.enterScreen("mine", "friendtask");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  A.app.innerHTML = '<div class="lvlhead"><div><div class="idx">ссылка не открылась</div>' +
    '<h1>✍️ Задание не прочиталось</h1></div></div>' +
    '<div class="note"><b>Скорее всего, ссылку обрезали</b>Мессенджеры иногда режут длинные адреса. ' +
    'Попроси прислать её ещё раз — целиком, лучше файлом или обычным текстом.</div>' +
    '<div class="pager"><button class="bigbtn" id="tomine">✍️ Составить своё задание</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';
  document.getElementById("tomine").onclick = function(){ screenMyTasks(); };
  document.getElementById("tomap").onclick = A.goHome;
  A.refreshTop();
}

return { screenMyTasks: screenMyTasks, openFriendTask: openFriendTask,
         screenSolved: screenSolved, screenTaskBroken: screenTaskBroken };
};
