/* ============================================================
   Фионика — экран «Моё»: портфолио.

   Отрезан из app.js 15.09.2026 (архитектурный долг, § 2.5 RAZVITIE). Логика
   сертификатов — отдельным файлом js/certs.js: почему два файла, а не один, —
   в шапке того файла.

   ⚠️ ЭТО ПЕРЕКРЁСТОК, как Главное (js/home.js). Экран собирает на одну
   страницу проекты, программы, рисунки, свои задания, полку мастерской и
   сертификаты — поэтому внутрь приходит 44 имени. Это не небрежность разреза,
   а измеренный факт: 36 из них нужны только этому экрану. Если его когда-то
   делить дальше, то как Главное — по карточкам, у каждой свой список needs.

   ⚠️ СОСТОЯНИЕ. Читается одно поле прогресса — сколько уроков сдано (S.stars),
   через A.S() в момент обращения. В ЧУЖИЕ слоты экран не пишет: «→ В
   песочницу» у рисунка и программы раньше писал S.sandbox прямо отсюда, теперь
   это вход A.openInSandbox(code) — слот принадлежит песочнице (§ 4.5).
   Сессия — A.newSession(v).
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.folio = function(A){

function folioStat(value, label){
  return '<div class="fstat"><b>' + value + '</b><span>' + label + '</span></div>';
}
function projectGate(p){ return p.world === 0 ? "раздел «Ты и ИИ»" : "Мир " + p.world; }

function screenFolio(){
  A.enterScreen("mine", "folio");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });

  var projects = A.projectsList();
  var built = 0;
  projects.forEach(function(p){ if (A.projectDone(p.id)) built++; });
  var certs = A.certList(), gotCerts = 0;
  certs.forEach(function(c){ if (c.ready) gotCerts++; });
  var lessonsDone = Object.keys(A.S().stars).length;
  var name = A.myName();

  var h = '<div class="lvlhead"><div><div class="idx">портфолио</div>' +
    '<h1>🎒 ' + (name ? A.esc(name) + ": мои работы" : "Моё") + '</h1></div>' +
    '<div class="right"><span class="tag">твои работы</span></div></div>' +
    '<p class="lede">Здесь собрано всё сделанное своими руками: программы из проектов, рисунки, ' +
    'свои задания для друзей и сертификаты. Эту страницу можно показать кому угодно — ' +
    'родителям, учителю, друзьям.</p>';

  h += '<div class="fstats">' +
    folioStat(lessonsDone + ' <i>из ' + CURRICULUM.total + '</i>', "уроков пройдено") +
    folioStat("★ " + A.totalStars(), "звёзд собрано") +
    folioStat(built + ' <i>из ' + projects.length + '</i>', "программ готово") +
    folioStat(gotCerts + ' <i>из ' + certs.length + '</i>', "сертификатов") +
    '</div>';

  /* Мастерская стоит ПЕРЕД готовыми программами: проекты показывают, что
     ребёнок прошёл курс, а полка — что он сделал сам и что из этого осталось.
     Для накопления важно, чтобы оно попадалось на глаза первым. */
  var shelfN = A.partsList().length, madeN = A.buildsList().length;
  h += '<div class="card shopcard"><h3>🔧 Мастерская</h3>' +
    (shelfN
      ? '<p>На полке <b>' + shelfN + '</b> ' + A.plural(shelfN, "деталь", "детали", "деталей") +
        ' — функции, которые ты написал сам' +
        (madeN ? ', и собрано вещей: <b>' + madeN + '</b>' : '') + '.</p>'
      : '<p class="dim">Полка пока пустая. Деталью становится функция, которую ты написал сам, — ' +
        'они начинаются в уроке про <code>def</code>.</p>') +
    '<div class="admrow"><button class="rbtn check" id="toshop">Открыть мастерскую →</button></div></div>';

  h += '<div class="sect"><h2>Готовые программы</h2><div class="line"></div>' +
    '<span class="cnt">' + built + ' из ' + projects.length + '</span></div>';

  if (!projects.length){
    h += '<div class="note"><b>Программ пока нет</b>Они появятся, когда будет собран первый проект.</div>';
  } else {
    h += '<p class="dim">Кнопка «Скачать .py» отдаёт готовый файл: сохрани его и набери ' +
      'в терминале <code>python3 имя.py</code> — программа пойдёт в настоящем Python. ' +
      'Рисующей программе тренажёр допишет первую строку <code>from turtle import *</code> ' +
      'и последнюю <code>done()</code>: в тренажёре команды черепашки встроены, ' +
      'а в настоящем Python их надо подключить.</p>';
  }
  projects.forEach(function(p){
    var st = A.projectState(p.id), done = A.projectDone(p.id), open = A.projectOpen(p);
    var where = A.projectWhere(p);
    var stat = done ? "собрана ✓"
             : (st.step > 0 ? "шагов " + st.step + " из " + p.steps.length
                            : (open ? "можно собирать" : "закрыта"));
    h += '<div class="fproj' + (done ? " done" : (open ? "" : " locked")) + '">' +
      '<div class="fptop"><span class="pjemoji">' + p.emoji + '</span>' +
      '<div class="fpttl"><span class="pjkicker">' + A.esc(where) + '</span>' +
      '<b>' + A.esc(p.title) + '</b>' +
      '<span class="fpsub">' + A.esc(p.tagline) + '</span></div>' +
      '<span class="fpstat' + (done ? " ok" : "") + '">' + stat + '</span></div>';
    if (done){
      var code = st.code || p.steps[p.steps.length - 1].solution;
      var n = code.replace(/\n+$/, "").split("\n").length;
      h += '<pre class="fpcode">' + A.esc(code) + '</pre>' +
        '<div class="fpbtns"><button class="rbtn" data-open="' + p.id + '">Открыть и запустить</button>' +
        '<button class="rbtn sec" data-copy="' + p.id + '">Скопировать код</button>' +
        '<button class="rbtn sec" data-py="' + p.id + '">⬇ Скачать .py</button>' +
        '<button class="rbtn sec" data-todef="' + p.id + '">📁 К защите</button>' +
        '<span class="fplen">' + n + " " + A.plural(n, "строка", "строки", "строк") + '</span></div>';
    } else {
      h += '<div class="fpbtns">' + (open
        ? '<button class="rbtn" data-open="' + p.id + '">' +
            (st.step > 0 ? "Продолжить" : "Собрать") + '</button>'
        : '<span class="soontag">откроется, когда будет пройден ' + A.esc(projectGate(p)) + '</span>') +
        '</div>';
    }
    h += '</div>';
  });

  /* ===== мои программы =====
     Стоит ПЕРЕД рисунками: рисунок — это тоже программа, но названная нами,
     а здесь лежит то, что ребёнок назвал сам. Своё имя важнее нашего. */
  var works = A.myWorksList();
  h += '<div class="sect"><h2>Мои программы</h2><div class="line"></div>' +
    '<span class="cnt">' + works.length + '</span></div>';
  if (!works.length){
    h += '<div class="note"><b>Пока пусто</b>Напиши что-нибудь в песочнице и нажми там ' +
      '«Назвать и сохранить в «Моё»». Название и описание придумываешь ты сам — ' +
      'и по ссылке друг откроет программу и запустит её, не видя кода.' +
      '<button class="rbtn" id="folio-sand">Открыть песочницу</button></div>';
  } else {
    h += '<div class="hubgrid">' + works.map(function(x){
      var n = x.code.replace(/\n+$/, "").split("\n").length;
      return '<div class="hubcard"><span class="hubem">🛠</span>' +
        '<b>' + A.esc(x.title) + '</b>' +
        '<span class="hubwhy">' + A.esc(x.about || "без описания") + '</span>' +
        '<span class="hubstat">' + A.fmtDay(x.at) + ' · ' + n + ' ' +
          A.plural(n, "строка", "строки", "строк") + '</span>' +
        '<div class="picbtns">' +
          '<button class="rbtn sec" data-worklink="' + x.id + '">🔗 Ссылка</button>' +
          '<button class="rbtn sec" data-workopen="' + x.id + '">→ В песочницу</button>' +
          '<button class="rbtn sec" data-workdel="' + x.id + '">Удалить</button>' +
        '</div></div>';
    }).join("") + '</div>' +
    '<p class="dim">Программа целиком лежит внутри ссылки, сервер для этого не нужен. ' +
    'Тот, кто её откроет, увидит работающую программу и кнопку «Заглянуть в код» — ' +
    'но только если сам захочет.</p>';
  }

  /* ===== мои рисунки ===== */
  var pics = A.galleryList();
  h += '<div class="sect"><h2>Мои рисунки</h2><div class="line"></div>' +
    '<span class="cnt">' + pics.length + '</span></div>';
  if (!pics.length){
    h += '<div class="note"><b>Рисунков пока нет</b>Нарисуй что-нибудь в песочнице ' +
      'и нажми там «Сохранить рисунок в галерею». Хранится программа, а не картинка, ' +
      'поэтому рисунок можно открыть и переделать в любой момент.</div>';
  } else {
    h += '<div class="pics">' + pics.map(function(x){
      var n = x.code.replace(/\n+$/, "").split("\n").length;
      return '<div class="pic" data-pic="' + x.id + '">' +
        '<canvas class="picart"></canvas>' +
        '<div class="picbody"><b>' + A.esc(x.title) + '</b>' +
        '<span class="picsub">' + A.fmtDay(x.at) + ' · ' + n + ' ' +
          A.plural(n, "строка", "строки", "строк") + '</span>' +
        '<div class="picbtns">' +
          '<button class="rbtn sec" data-png="' + x.id + '">⬇ PNG</button>' +
          '<button class="rbtn sec" data-picopen="' + x.id + '">→ В песочницу</button>' +
          '<button class="rbtn sec" data-picdel="' + x.id + '">Удалить</button>' +
        '</div></div></div>';
    }).join("") + '</div>';
  }

  /* ===== свои задания ===== */
  var tasks = A.myTasksList();
  h += '<div class="sect"><h2>Свои задания</h2><div class="line"></div>' +
    '<span class="cnt">' + tasks.length + '</span></div>';
  if (!tasks.length){
    h += '<div class="note"><b>Заданий пока нет</b>Придумать задачу труднее, чем решить: ' +
      'придётся объяснить её словами тому, кто твоего кода не видит. ' +
      '<button class="rbtn" id="folio-mine">Составить задание</button></div>';
  } else {
    h += '<div class="hubgrid">' + tasks.map(function(t){
      return '<div class="hubcard"><span class="hubem">✍️</span>' +
        '<b>' + A.esc(t.title) + '</b>' +
        '<span class="hubwhy">' + A.esc(t.goal) + '</span>' +
        '<span class="hubstat">' + A.fmtDay(t.at) + ' · ответ из ' + t.lines.length + ' ' +
          A.plural(t.lines.length, "строки", "строк", "строк") + '</span>' +
        '<div class="picbtns"><button class="rbtn sec" data-tasklink="' + t.id + '">Скопировать ссылку</button>' +
        '<button class="rbtn sec" data-taskopen="' + t.id + '">Открыть</button></div></div>';
    }).join("") + '</div>' +
    '<p class="dim">Ссылку можно отправить кому угодно: задание целиком лежит внутри неё, ' +
    'сервер для этого не нужен. Составить ещё одно — на экране «Своё задание».</p>';
  }

  h += '<div class="sect"><h2>Сертификаты</h2><div class="line"></div>' +
    '<span class="cnt">' + gotCerts + ' из ' + certs.length + '</span></div>' +
    '<p class="dim">Сертификат даётся не за прочитанные уроки, а за уроки плюс собранный ' +
    'проект мира. Отдельно — за разделы вне сотни: всю «Разминку» и весь «Ты и ИИ». ' +
    'Любой можно распечатать или сохранить в PDF.</p><div class="certs">';
  certs.forEach(function(c){
    h += '<div class="certcard' + (c.ready ? " got" : "") + '">' +
      '<span class="cticon">' + c.icon + '</span>' +
      '<span class="ctbody"><b>' + A.esc(c.title) + '</b>' +
      '<span>' + (c.ready ? "Выдан " + A.fmtDay(c.at) : A.esc(c.need)) + '</span></span>' +
      (c.ready ? '<button class="rbtn" data-cert="' + c.id + '">Показать</button>'
               : '<span class="soontag">пока нет</span>') +
      '</div>';
  });
  h += '</div>';

  h += '<div class="pager"><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';

  A.app.innerHTML = h;
  var tsh = document.getElementById("toshop");
  if (tsh) tsh.onclick = A.screenShop;
  A.app.querySelectorAll("[data-open]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-open");
      if (A.projectDone(id)) A.screenProjectDone(id); else A.openProject(id);
    };
  });
  /* Рисунки считаются заново: в прогрессе лежит программа, а не картинка.
     Прогон честный, тем же движком, — значит и рисунок тот же самый. */
  A.app.querySelectorAll(".pic").forEach(function(card){
    var x = A.galleryAll()[card.getAttribute("data-pic")];
    if (!x) return;
    var res = A.galleryDrawing(x.code);
    var cv = card.querySelector("canvas");
    if (res && res.turtle) A.drawTurtle(cv, res.turtle);
    else card.classList.add("broken");
  });
  A.app.querySelectorAll("[data-png]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-png");
      var card = A.app.querySelector('.pic[data-pic="' + id + '"]');
      var cv = card && card.querySelector("canvas");
      var x = A.galleryAll()[id];
      if (!cv || !x) return;
      try { A.downloadDataURL(A.pyFileName(x.title).replace(/\.py$/, "") + ".png",
                            cv.toDataURL("image/png"), b); } catch(e){}
    };
  });
  A.app.querySelectorAll("[data-picopen]").forEach(function(b){
    b.onclick = function(){
      var x = A.galleryAll()[b.getAttribute("data-picopen")];
      if (!x) return;
      A.openInSandbox(x.code);
    };
  });
  A.app.querySelectorAll("[data-picdel]").forEach(function(b){
    b.onclick = function(){ A.galleryDrop(b.getAttribute("data-picdel")); screenFolio(); };
  });
  A.app.querySelectorAll("[data-worklink]").forEach(function(b){
    b.onclick = function(){
      var x = A.myWorkById(b.getAttribute("data-worklink"));
      if (x) A.copyText(A.myWorkLink(x), b);
    };
  });
  A.app.querySelectorAll("[data-workopen]").forEach(function(b){
    b.onclick = function(){
      var x = A.myWorkById(b.getAttribute("data-workopen"));
      if (!x) return;
      A.openInSandbox(x.code);
    };
  });
  A.app.querySelectorAll("[data-workdel]").forEach(function(b){
    b.onclick = function(){
      var x = A.myWorkById(b.getAttribute("data-workdel"));
      var yes = true;
      try { yes = confirm("Удалить «" + ((x && x.title) || "программу") + "»? Вернуть будет нельзя."); }
      catch(e){}
      if (!yes) return;
      A.myWorkDrop(b.getAttribute("data-workdel"));
      screenFolio();
    };
  });
  var fs2 = document.getElementById("folio-sand");
  if (fs2) fs2.onclick = A.screenSandbox;
  var fm = document.getElementById("folio-mine");
  if (fm) fm.onclick = function(){ A.screenMyTasks(); };
  A.app.querySelectorAll("[data-tasklink]").forEach(function(b){
    b.onclick = function(){
      var t = A.myTasksAll()[b.getAttribute("data-tasklink")];
      if (t) A.copyText(A.taskLink(t), b);
    };
  });
  A.app.querySelectorAll("[data-taskopen]").forEach(function(b){
    b.onclick = function(){
      var id = b.getAttribute("data-taskopen"), t = A.myTasksAll()[id];
      if (t) A.openFriendTask(t, { own:true, id:id });
    };
  });
  A.app.querySelectorAll("[data-py]").forEach(function(b){
    b.onclick = function(){
      var p = A.projectById(b.getAttribute("data-py"));
      if (!p) return;
      var st = A.projectState(p.id);
      var code = st.code || p.steps[p.steps.length - 1].solution;
      A.downloadText(A.pyFileName(p.title), A.pyFileText(p.title, code), b);
    };
  });
  A.app.querySelectorAll("[data-copy]").forEach(function(b){
    b.onclick = function(){
      var p = A.projectById(b.getAttribute("data-copy"));
      if (!p) return;
      var st = A.projectState(p.id);
      A.copyText(st.code || p.steps[p.steps.length - 1].solution, b);
    };
  });
  A.app.querySelectorAll("[data-todef]").forEach(function(b){
    b.onclick = function(){ A.screenDefense(b.getAttribute("data-todef")); };
  });
  A.app.querySelectorAll("[data-cert]").forEach(function(b){
    b.onclick = function(){
      var v = b.getAttribute("data-cert");
      A.openCert(v === "course" ? "course" : +v.replace("world", ""));
    };
  });
  document.getElementById("tomap").onclick = A.goHome;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

return { screenFolio: screenFolio };
};
