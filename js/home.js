/* ============================================================
   Фионика — Главный экран и поиск по урокам.

   ⚠️ СЕДЬМОЕ И САМОЕ СВЯЗАННОЕ ОТРЕЗАНИЕ по договору из
   js/screens-showcase.js. Наружу торчат два имени — lessonSearch и
   screenWorlds; внутрь нужны СОРОК СЕМЬ. Такого длинного списка A в продукте
   больше нет, и это не изъян разреза, а измеренный факт: Главный экран по
   устройству и есть перекрёсток — он собирает на одну страницу всё, что в
   продукте вообще происходит, и потому знает про всё.

   ⚠️ Этот список — не бухгалтерия ради бухгалтерии, а ПЛАН РАБОТ. Пока он
   был невидим, «Главный знает про всё» звучало как впечатление. Теперь это
   сорок семь строк, и по ним видно, что резать дальше: экран сам просится
   разложиться на карточки, каждая из которых знает про своё.

   ⚠️ Ловушки, на которых можно было споткнуться, и обе уже знакомы:
     — «name» выглядит зависимостью, а это местная переменная урока
       («var name = myName()»). Заменить её на A.name значило бы сломать
       приветствие по имени молча;
     — замена идёт ТОЛЬКО вне строк и комментариев: иначе слова вроде «solved»
       и «open» поехали бы внутри разметки.
   Правило про чужое изменяемое состояние соблюдено: session читается через
   A.session(), пишется единственным входом A.newSession.

   ⚠️ ЕЩЁ ОДНА ЛОВУШКА, и она в моём же скрипте замера: он отбрасывал имена
   короче двух букв (фильтр против чисел-однобуквенников) и потому МОЛЧА
   выбросил «S» — сам прогресс ученика. Сборка прошла, разрез выглядел
   готовым, и только тест упал с «S is not defined». Мораль та же, что и с
   makeEditor: замер подсказывает, но проверяет сборка и тест.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.home = function(A){


/* ================= экран сложен из КАРТОЧЕК =================
   ⚠️ Зачем это так. Замер 09.09.2026: Главный экран знал про 62 чужие вещи —
   больше всех в продукте, и это не чинилось ещё одним отрезанием в отдельный
   файл (его уже отрезали в 1.119.0, и число только выросло). Чинится это
   разложением: экран — не одна функция на четыреста строк, а список карточек,
   и каждая знает ТОЛЬКО своё.

   Тот же замер показал, где проходит граница: из 62 имён 52 нужны РОВНО
   одной карточке, и общих остаётся девять — esc, plural, qm, myName, myCode,
   solved, openLesson, trainCards и S. То есть экран и не был единым целым:
   он был девятью независимыми кусками, слепленными одной функцией и одним
   хвостом привязок на 28 имён.

   Карточка — это четыре поля:
     id     имя, по нему её находит проверка и держится порядок на экране;
     needs  что карточка знает про остальной продукт. ⚠️ Это НЕ комментарий:
            карточке отдаётся только названное здесь (см. pick), и обращение
            к чему-то ещё падает на первом же показе экрана, а не через месяц
            в чужой сессии;
     html   разметка. Возвращает строку и ничего не трогает снаружи;
     wire   свои кнопки, и только свои. Чужие тут не привязываются никогда —
            хвост, который привязывал всё подряд, и был главной бедой.

   ⚠️ Внутри html и wire узкий доступ приходит доводом с именем A и затеняет
   широкий A модуля. Поэтому разметка переносилась сюда ДОСЛОВНО: заменять
   «A.» на другое имя не понадобилось, а вместе с заменой исчез и риск попасть
   ею внутрь строки или комментария — ошибка, оплаченная 08.09.2026.

   Факты экрана (сколько уроков сдано, какой урок следующий, сколько долгов)
   считаются ОДИН раз в screenWorlds и приходят вторым доводом v. Считать их
   в каждой карточке значило бы считать одно и то же по пять раз и однажды
   разойтись в числах между соседними блоками одного экрана.
   ============================================================ */

/* Узкий доступ: объект ровно из названных имён. Обычная копия, без Proxy, —
   это код, который выполняется у ребёнка в браузере, и экзотика тут не нужна.
   Имя, которого нет в договоре модуля, поймается сразу: положить в узкий
   доступ нечего, и первое же обращение упрётся в undefined. */
function pick(names){
  var o = {};
  names.forEach(function(n){ o[n] = A[n]; });
  return o;
}

/* ================= поиск по урокам =================
   Сто уроков разложены по пяти мирам, и пока помнишь номер — всё хорошо.
   А «где было про словари» раньше искалось только глазами по пяти экранам.
   Ищем по названию, подзаголовку, теме мира и номеру.

   Закрытые уроки из выдачи НЕ прячем, но и открыть их отсюда нельзя:
   спрятать — значит соврать («такого урока нет»), а пустить — сломать
   порядок, на котором держится весь курс. Поэтому строка видна и помечена
   замком: «есть, но позже».
   ============================================================ */
function lessonSearch(q){
  q = String(q || "").toLowerCase().trim();
  if (q.length < 2) return [];
  var out = [];
  CURRICULUM.forEach(function(w){
    w.lessons.forEach(function(l){
      var hay = (l.title + " " + l.sub + " " + w.title + " " + l.num).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push(l);
    });
  });
  return out.slice(0, 8);
}


var CARDS = [
{
  id: "now",
  needs: ["esc", "plural", "worldCountdown", "welcomeBackHTML", "screenPath", "openLesson", "screenWorld", "screenToday", "screenReview", "screenHW", "screenWarmups"],
  html: function(A, v){
  var doneTotal = v.doneTotal, name = v.name, next = v.next,
      dues = v.dues, dailyOk = v.dailyOk, hwLeft = v.hwLeft;
  var h = "";
  /* ===== блок «Сейчас»: одна главная кнопка и три подсказки рядом ===== */
  var h = '<div class="hero now">' +
    '<div class="nowtop"><div>' +
      '<div class="nowkicker">' + (doneTotal ? "продолжаем" : "с чего начать") + '</div>' +
      /* Без имени фраза начинает предложение, с именем — продолжает его.
         «привет!» с маленькой буквы после ничего читается как опечатка, и
         первое, что видит новичок, не должно выглядеть сломанным. */
      '<h1>' + (name ? A.esc(name) + ", " : "") +
        (doneTotal
          ? (next ? "дальше — урок " + next.num : "все готовые уроки пройдены")
          : (name ? "привет! Это тренажёр по информатике"
                  : "Привет! Это тренажёр по информатике")) + '</h1>' +
      '<p>' + (doneTotal
        ? (next ? A.esc(next.title) + " — " + A.esc(next.sub) + "." : "Осталось повторение и проекты.")
        : "Программирование на Python: пишешь код — он тут же работает, считает, рисует " +
          "и объясняет ошибки понятными словами. Сто уроков по порядку, " +
          "от первой команды до своего проекта.") + '</p>' +
    '</div></div>' +
    '<div class="row">' +
      (next ? '<button class="bigbtn" id="go-next">▶ ' + (doneTotal ? "Продолжить" : "Начать первый урок") + '</button>'
            : '<button class="bigbtn" id="go-next">К списку уроков</button>') +
      /* Тоже без числа серии — см. refreshTop и план, п. 4.4. */
      '<button class="bigbtn ghost" id="go-today">🔥 Сегодня</button>' +
      (dues ? '<button class="bigbtn ghost" id="go-again">🔁 Повторить · ' + dues + '</button>' : '') +
      (hwLeft ? '<button class="bigbtn ghost" id="go-hw">📮 Домашка · ' + hwLeft + '</button>' : '') +
    '</div>' +
    '<div class="nowhints">' +
      (function(){
        /* до конца текущего мира — в занятиях: расстояние, которое ребёнок
           чувствует. Проценты не говорят ничего, дни — не его единица */
        var cd = next ? A.worldCountdown(next.world) : null;
        return cd ? '<span>· до конца мира ' + next.world + ' — примерно ' + cd.zan + ' ' +
          A.plural(cd.zan, "занятие", "занятия", "занятий") + '</span>' : '';
      })() +
      (hwLeft ? '<span>· домашка от репетитора: ' + hwLeft + ' ' +
                A.plural(hwLeft, "задача", "задачи", "задач") + '</span>' : '') +
      '<span>' + (dailyOk ? "✓ задача дня сделана" : "· задача дня ещё ждёт") + '</span>' +
      '<span>' + (dues ? "· " + dues + " " + A.plural(dues, "урок ждёт", "урока ждут", "уроков ждут") + " повтора"
                       : "· долгов по повторению нет") + '</span>' +
      '<span>· шпаргалка 📖 наверху открывается прямо посреди урока</span>' +
      '<span>· не понял, что за экран, — жми <b>?</b> в правом верхнем углу</span>' +
    '</div></div>';

  /* карточка возвращения — сразу под «Сейчас», выше всего остального:
     вернувшемуся важнее всего услышать «всё цело», а не увидеть список миров */
  h += A.welcomeBackHTML();

  return h;
  },
  wire: function(A, v){
    var pathBtn = document.getElementById("go-path");
    if (pathBtn) pathBtn.onclick = A.screenPath;
    var goNext = document.getElementById("go-next");
    if (goNext) goNext.onclick = function(){
      if (v.next) A.openLesson(v.next.id); else A.screenWorld(1);
    };
    document.getElementById("go-today").onclick = A.screenToday;
    var ga = document.getElementById("go-again");
    if (ga) ga.onclick = A.screenReview;
    var gh = document.getElementById("go-hw");
    if (gh) gh.onclick = A.screenHW;
    var cbw = document.getElementById("cbwarm");
    if (cbw) cbw.onclick = A.screenWarmups;
    var cbg = document.getElementById("cbgo");
    if (cbg) cbg.onclick = function(){ if (v.next) A.openLesson(v.next.id); };
  }
},
{
  id: "codesave",
  needs: ["esc", "serverOn", "myCode", "codeSaved", "myName", "copyText", "markCodeSaved", "openAccessCard"],
  html: function(A, v){
  var doneTotal = v.doneTotal;
  var h = "";
  /* ===== запиши код: одна карточка, и только тому, кто остался =====
     ⚠️ Новичку этого блока НЕ показываем, и это не забывчивость. Правило
     оплачено ошибкой: первое, что видит новичок, — самое дорогое место
     экрана, а ребёнок пришёл писать код, а не заниматься сохранностью
     доступа. Поэтому карточка появляется после ПЕРВОГО сданного урока — то
     есть тому, кому уже есть что терять, — и гаснет навсегда, как только код
     унесён из браузера: скопирован, распечатан или записан своей рукой.
     Почему вообще напоминаем: аккаунта в продукте нет, восстановить код
     нечем — ни почты, ни телефона мы не спрашиваем. Значит, единственная
     защита от потери — вынести код наружу, и сказать об этом надо один раз,
     но вовремя. */
  if (doneTotal && A.serverOn() && A.myCode() && !A.codeSaved()){
    h += '<div class="card codesave"><h3>🔑 Запиши свой код</h3>' +
      '<p>Первый урок сдан — теперь есть что терять. Весь вход в твои занятия — вот этот код, ' +
      'и другого нет: ни почты, ни телефона тренажёр не спрашивает, а значит и восстановить ' +
      'код нечем.</p>' +
      '<div class="codebox"><code id="hmcode">' + A.esc(A.myCode()) + '</code>' +
      '<button class="rbtn sec" id="hmcopy">Скопировать</button>' +
      '<button class="rbtn sec" id="hmprint">🖨 Карточка</button></div>' +
      '<div class="winrow" style="margin-top:12px">' +
      '<button class="bigbtn ghost" id="hmdone">Записал, больше не напоминай</button></div>' +
      '<p class="dim">Карточка — лист с именем, кодом и ссылкой: распечатать, сохранить в PDF ' +
      'или отдать родителю. Если ты занимаешься с репетитором, код есть и у него.</p></div>';
  }

  return h;
  },
  wire: function(A, v){
    /* Любое из трёх действий гасит карточку навсегда, потому что все три
       означают одно — код вышел из браузера. */
    var cp = document.getElementById("hmcopy"), pr = document.getElementById("hmprint"),
        dn = document.getElementById("hmdone");
    if (cp) cp.onclick = function(){ A.copyText(A.myCode(), cp); A.markCodeSaved(); };
    if (pr) pr.onclick = function(){ A.markCodeSaved(); A.openAccessCard(A.myCode(), A.myName()); };
    if (dn) dn.onclick = function(){ A.markCodeSaved(); screenWorlds(); };
  }
},
{
  id: "howto",
  needs: ["screenGuide"],
  html: function(A, v){
  var doneTotal = v.doneTotal;
  var h = "";
  /* ===== как это работает: только пока ни один урок не пройден ===== */
  if (!doneTotal){
    h += '<div class="howto"><h3>Как устроен урок</h3><ol>' +
      '<li><b>Читаешь примеры сверху.</b> У каждого есть кнопка «▶ Запустить пример» — код выполнится тут же, ' +
      'а «→ В редактор» перенесёт его вниз, чтобы поменять и попробовать своё.</li>' +
      '<li><b>Смотришь задачу</b> — она в рамке «🎯 Твоя задача», списком требований.</li>' +
      '<li><b>Пишешь код в редакторе</b> и жмёшь «▶ Запустить»: видно, что программа напечатала, ' +
      'а рядом со строками — что каждая сделала.</li>' +
      '<li><b>Жмёшь «✓ Проверить».</b> Если что-то не так, тренажёр покажет, чем твой ответ отличается от нужного.</li>' +
      '</ol><p class="dim">Три звезды дают за урок, пройденный с первой попытки и без подсказок. ' +
      'Подсказки есть всегда — они стоят одну звезду, и это не страшно.</p>' +
      '<div class="helprow"><button class="rbtn sec" id="go-guide">📕 Полная инструкция</button>' +
      '<button class="rbtn sec" data-help="tools">🧰 Что за кнопки наверху</button></div></div>';
  }

  return h;
  },
  wire: function(A, v){
    var gg = document.getElementById("go-guide");
    if (gg) gg.onclick = A.screenGuide;
  }
},
{
  id: "lessons",
  needs: ["qm", "solved", "worldReadyLessons", "esc", "starsOf", "lessonOpen", "openLesson", "screenWorld"],
  html: function(A, v){
  var doneTotal = v.doneTotal;
  var h = "";
  /* ===== уроки ===== */
  h += '<div class="sect"><h2>Уроки</h2>' + A.qm("worlds", "Как устроен курс") +
    '<div class="line"></div><span class="cnt">' +
    doneTotal + ' из ' + CURRICULUM.total + '</span></div>' +
    '<p class="dim">Это главное в тренажёре: сто уроков по порядку, пять миров по двадцать. ' +
    'Уроки открываются один за другим — сдал, открылся следующий. В конце каждого мира ' +
    'свой проект и сертификат.</p>' +
    /* Куда это ведёт. Раньше на главной было видно, ЧТО внутри (пять миров с
       описаниями), но не было сказано, ЧЕМ дело кончится. Родителю нужно
       именно это: он платит и решает не за «списки и словари», а за результат.
       Все три обещания опираются на то, что в тренажёре уже есть, — шесть
       собранных проектов, сертификаты и раздел «Ты и ИИ» с разбором чужих
       ответов. Обещать больше нельзя: проверяется первым же прохождением. */
    '<p class="path">🏁 <b>К концу пути</b> ребёнок пишет свои программы на Python, ' +
    'разбирает чужой код и умеет находить ошибку в ответе нейросети. ' +
    'На руках остаются шесть собранных проектов и сертификаты — то, что можно показать.</p>' +
    /* Поиск по урокам. Сто уроков лежат в пяти мирах, и «где было про словари»
       раньше искалось только глазами по пяти экранам подряд. */
    /* Дорога целиком — отдельным экраном, а не здесь: пять карточек ниже
       отвечают «что внутри мира», а карта — «где я и сколько до вехи».
       Складывать сто кружков на Главное значило бы удлинить его вдвое. */
    '<div class="pathlink"><button class="rbtn" id="go-path">🗺 Показать всю дорогу</button>' +
    '<span class="tip">сто уроков одной картой: где ты стоишь, что впереди и сколько занятий до проекта</span></div>' +
    '<div class="lsearch"><input type="search" id="lq" autocomplete="off" spellcheck="false" ' +
    'placeholder="Найти урок: словари, черепашка, цикл, 42…"></div>' +
    '<div class="lsfound" id="lsfound" hidden></div>' +
    '<div class="worlds">';
  CURRICULUM.forEach(function(w){
    var ready = A.worldReadyLessons(w);
    var done = ready.filter(function(l){ return A.solved(l.id); }).length;
    var pct = w.lessons.length ? Math.round(done / w.lessons.length * 100) : 0;
    var status = ready.length === 0 ? "в работе"
      : done === w.lessons.length ? "пройден"
      : done + " из " + w.lessons.length;
    h += '<button class="world' + (ready.length ? "" : " soon") + '" data-w="' + w.n + '">' +
      '<div class="wtop"><span class="wicon">' + w.icon + '</span>' +
        '<div><div class="widx">Мир ' + w.n + ' · уроки ' + ((w.n-1)*20+1) + '–' + (w.n*20) + '</div>' +
        '<h3>' + w.title + '</h3></div>' +
        '<span class="wstat">' + status + '</span></div>' +
      '<p>' + w.desc + '</p>' +
      '<div class="wbar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="wfoot"><span>' + ready.length + ' уроков готово</span>' +
        '<span class="tag' + (w.engine === "pyodide" ? " pro" : "") + '">' +
          (w.engine === "mini" ? "быстрый движок" : w.engine === "mixed" ? "смешанный" : "настоящий Python") + '</span></div>' +
      '</button>';
  });
  h += '</div>';

  return h;
  },
  wire: function(A, v){
    /* ⚠️ Поиск по урокам живёт ЗДЕСЬ, а не отдельной функцией модуля, и это
       не про уборку. Пока он был снаружи, карточка объявляла в needs имена,
       которых сама не трогает, — их трогал он. Проверка это и поймала:
       объявленное расходилось с делом, а узкий доступ, выданный «на всякий
       случай», ничем не отличается от широкого. Что отдано карточке, то
       карточка и должна тратить сама. */
  var inp = document.getElementById("lq");
  var box = document.getElementById("lsfound");
  if (!inp || !box) return;
  var draw = function(){
    var q = String(inp.value || "").trim();
    if (q.length < 2){ box.hidden = true; box.innerHTML = ""; return; }
    var found = lessonSearch(q);
    box.hidden = false;
    if (!found.length){
      box.innerHTML = '<p class="lsnone">Ничего не нашлось. Попробуй одно слово: ' +
        '«список», «цикл», «функция», «черепашка» — или номер урока.</p>';
      return;
    }
    box.innerHTML = found.map(function(l){
      var open = A.lessonOpen(l);
      var st = A.solved(l.id)
        ? new Array(A.starsOf(l.id) + 1).join("★")
        : (open ? "" : "🔒 позже");
      return '<button class="lsrow' + (open ? "" : " lock") + '"' +
        (open ? ' data-open="' + l.id + '"' : "") + '>' +
        '<span class="lsnum">' + l.num + '</span>' +
        '<span class="lstitle">' + A.esc(l.title) + '</span>' +
        '<span class="lssub">' + A.esc(l.sub) + '</span>' +
        '<span class="lsnum">' + st + '</span></button>';
    }).join("");
    box.querySelectorAll("[data-open]").forEach(function(b){
      b.onclick = function(){ A.openLesson(b.getAttribute("data-open")); };
    });
  };
  inp.oninput = draw;
  inp.onkeydown = function(e){
    if (e.key === "Escape"){ inp.value = ""; draw(); return; }
    /* Enter открывает первый найденный урок: искал — значит уже решил, куда идти */
    if (e.key === "Enter"){
      var first = box.querySelector("[data-open]");
      if (first) first.click();
    }
  };
    document.querySelectorAll(".world").forEach(function(b){
      b.onclick = function(){ A.screenWorld(+b.getAttribute("data-w")); };
    });
  }
},
{
  id: "exams",
  needs: ["esc", "examTally", "variantStat", "openExamMap", "screenVariant", "screenRobot"],
  html: function(A, v){
  var h = "";
  /* ===== экзамены: ОГЭ и ЕГЭ =====
     ⚠️ Заведено 08.09.2026 по жалобе фаундера: «на сайте сложно найти про ЕГЭ
     и ОГЭ, спрятано». Так и было — экзамен лежал двумя карточками в ряду
     «Тренировки», а над тем рядом написано «без звёзд, по желанию» и «куда
     заходят, когда хочется». То есть единственное, за что родитель платит
     деньгами, стояло под вывеской «необязательное развлечение».
     Теперь это свой раздел, и стоит он ВЫШЕ тренировок. Ниже уроков он стоит
     тоже сознательно: курс — по-прежнему главное, а экзамен — вторая дверь,
     а не замена первой.
     ⚠️ Числа приходят из карты экзаменов (A.examTally), а не пишутся здесь:
     «27 из 27» обязано перестать быть правдой в ту же секунду, когда
     перестанет. */
  var exE = A.examTally("ege"), exO = A.examTally("oge");
  if (exE && exO){
    h += '<div class="sect"><h2>Экзамены</h2>' +
      '<div class="line"></div><span class="cnt">ОГЭ и ЕГЭ по номерам</span></div>' +
      '<p class="dim">Здесь экзамен не «немного алгоритмов», а полный список заданий: ' +
      'против каждого номера написано, есть у нас задача или ещё нет. Баллы не считаем — ' +
      'шкала перевода меняется каждый год.</p>' +
      '<div class="hubgrid">' +
      [exE, exO].map(function(x){
        return '<button class="hubcard" data-exam="' + x.id + '">' +
          '<span class="hubem">' + x.em + '</span>' +
          '<b>' + A.esc(x.full) + '</b>' +
          '<span class="hubwhy">Карта всех ' + x.total + ' заданий по номерам.</span>' +
          '<span class="hubstat">задачи есть на ' + x.есть + ' из ' + x.total + '</span>' +
          '</button>';
      }).join("") +
      '<button class="hubcard" data-exam="variant"><span class="hubem">📝</span>' +
        '<b>Пробный вариант</b>' +
        '<span class="hubwhy">Весь экзамен подряд, как в мае.</span>' +
        (A.variantStat() ? '<span class="hubstat">' + A.esc(A.variantStat()) + '</span>' : '') +
        '</button>' +
      '<button class="hubcard" data-exam="robot"><span class="hubem">🤖</span>' +
        '<b>Робот</b>' +
        '<span class="hubwhy">Второе задание ОГЭ по выбору: русские команды вместо Python.</span>' +
        '</button>' +
      '</div>';
  }

  return h;
  },
  wire: function(A, v){
    document.querySelectorAll("[data-exam]").forEach(function(b){
      var k = b.getAttribute("data-exam");
      b.onclick = function(){
        if (k === "variant") return A.screenVariant();
        if (k === "robot") return A.screenRobot();
        A.openExamMap(k);
      };
    });
  }
},
{
  id: "train",
  needs: ["esc", "qm", "trainCards", "screenTrain"],
  html: function(A, v){
  var h = "";
  /* ===== тренировки: короткий ряд, подробности на своём экране ===== */
  h += '<div class="sect"><h2>Тренировки</h2>' + A.qm("train", "Что такое тренировки") +
    '<div class="line"></div>' +
    '<span class="cnt">без звёзд, по желанию</span></div>' +
    '<p class="dim">Это не обязательная программа, а то, куда заходят, когда хочется. ' +
    'Звёзд они не дают, но день занятий засчитывают.</p>' +
    '<div class="hubgrid">' +
    /* ⚠️ Экзамен и вариант отсюда убраны нарочно: они стоят выше своим
       разделом. Одна и та же дверь в двух местах одного экрана — это не
       «заметнее», а «выбирай, какая настоящая». */
    A.trainCards().filter(function(c){
      return c.id !== "algo" && c.id !== "variant" && c.id !== "robot";
    }).map(function(c){
      return '<button class="hubcard" data-train="' + c.id + '">' +
        '<span class="hubem">' + c.em + '</span>' +
        '<b>' + A.esc(c.title) + '</b>' +
        '<span class="hubwhy">' + A.esc(c.when) + '</span>' +
        (c.stat ? '<span class="hubstat">' + A.esc(c.stat) + '</span>' : '') +
        '</button>';
    }).join("") +
    '<button class="hubcard more" id="go-train"><span class="hubem">→</span>' +
    '<b>Все тренировки</b><span class="hubwhy">С объяснением, что зачем.</span></button>' +
    '</div>';

  return h;
  },
  wire: function(A, v){
    document.getElementById("go-train").onclick = A.screenTrain;
    /* ⚠️ Список карточек берётся ЖИВЫМ вызовом на каждой привязке, а не
       запоминается модулем: он считается из прогресса, и запомненный
       однажды повёл бы не туда после первого же сданного урока. */
    var cards = A.trainCards();
    document.querySelectorAll("[data-train]").forEach(function(b){
      var id = b.getAttribute("data-train");
      b.onclick = function(){
        for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i].go();
      };
    });
  }
},
{
  id: "mine",
  needs: ["plural", "qm", "solvedCount", "certList", "partsList", "buildsList", "galleryList", "myTasksList", "projectsList", "projectDone", "screenFolio", "screenMyTasks", "screenShowcase", "screenShop"],
  html: function(A, v){
  var h = "";
  /* ===== моё ===== */
  var pjAll = A.projectsList(), pjDone = 0;
  pjAll.forEach(function(p){ if (A.projectDone(p.id)) pjDone++; });
  var ctAll = A.certList(), ctDone = 0;
  ctAll.forEach(function(c){ if (c.ready) ctDone++; });
  var pics = A.galleryList().length, mine = A.myTasksList().length;
  var shelfN = A.partsList().length, madeN = A.buildsList().length;
  h += '<div class="sect"><h2>Моё</h2>' + A.qm("folio", "Что лежит в «Моём»") +
    '<div class="line"></div>' +
    '<span class="cnt">' + (pjDone + pics + mine) + ' ' +
    A.plural(pjDone + pics + mine, "работа", "работы", "работ") + '</span></div>' +
    /* ⚠️ Обратное направление стоит ПЕРВЫМ в разделе, раньше портфолио.
       Задания раздают ребёнку везде и всегда; место, где раздаёт он, —
       единственное в продукте, и прятать его вниз значит терять ровно ту
       механику, которая даёт интерес, а не контроль. */
    '<div class="projcard' + (mine ? " done" : "") + '">' +
    '<span class="pjemoji">✍️</span>' +
    '<span class="pjbody"><span class="pjkicker">обычно задают тебе — а тут ты</span>' +
    '<b>Задай задачу взрослому</b>' +
    '<span>придумай задачу сам и отправь ссылкой маме, папе или другу — решать будут они, ' +
    'а проверит тренажёр</span>' +
    '<span class="pjnote">' + (A.solvedCount()
      ? "Твои задачи решали: " + A.solvedCount() + " " + A.plural(A.solvedCount(), "раз", "раза", "раз") +
        " · своих заданий: " + mine
      : (mine
        ? "Своих заданий: " + mine + ". Когда решат, тебе пришлют ссылку обратно."
        : "Составить задание труднее, чем решить: придётся объяснить задачу словами.")) +
    '</span></span>' +
    '<button class="bigbtn' + (mine ? "" : " ghost") + '" id="gomine">Задать задачу</button>' +
    '</div>' +
    '<div class="projcard' + (pjDone || pics ? " done" : "") + '">' +
    '<span class="pjemoji">🎒</span>' +
    '<span class="pjbody"><span class="pjkicker">сделано своими руками</span>' +
    '<b>Портфолио</b>' +
    '<span>программы из проектов, рисунки и сертификаты — всё в одном месте, можно показать и распечатать</span>' +
    '<span class="pjnote">' + (pjDone || pics
      ? "Программ: " + pjDone + " из " + pjAll.length + " · рисунков: " + pics +
        " · сертификатов: " + ctDone + " из " + ctAll.length
      : "Пока пусто: первая программа появится, когда будет собран проект первого мира.") +
    '</span></span>' +
    '<button class="bigbtn' + (pjDone || pics ? "" : " ghost") + '" id="gofolio">Открыть портфолио</button>' +
    '</div>' +
    /* Витрина стоит и здесь, не только в кабинете: её показывают взрослому,
       а открывает её чаще всего ребёнок — «смотри, что тут собирают». */
    '<div class="projcard"><span class="pjemoji">🏗</span>' +
    '<span class="pjbody"><span class="pjkicker">что тут собирают</span>' +
    '<b>Что ты соберёшь</b>' +
    '<span>шесть программ, рисунки и игры — можно нажать и посмотреть, ' +
    'что они делают, ещё до того, как дойдёшь до них</span>' +
    '<span class="pjnote">Эту страницу удобно показать родителям, если спросят, чем ты тут занят.</span></span>' +
    '<button class="bigbtn ghost" id="goworks">Посмотреть</button>' +
    '</div>' +
    /* Мастерская жила только внутри портфолио: про полку ребёнок узнавал из
       окна победы урока и, если пропустил, не узнавал больше нигде.
       Накопление, которого не видно, не удерживает. */
    '<div class="projcard' + (shelfN ? " done" : "") + '"><span class="pjemoji">🔧</span>' +
    '<span class="pjbody"><span class="pjkicker">полка деталей</span>' +
    '<b>Мастерская</b>' +
    '<span>функции, которые ты написал сам, остаются на полке — из них потом ' +
    'собирается своя программа</span>' +
    '<span class="pjnote">' + (shelfN
      ? "На полке " + shelfN + " " + A.plural(shelfN, "деталь", "детали", "деталей") +
        (madeN ? ", собрано вещей: " + madeN : "")
      : "Полка наполнится сама: детали появляются с уроков про функции.") + '</span></span>' +
    '<button class="bigbtn' + (shelfN ? "" : " ghost") + '" id="goshop">Открыть мастерскую</button>' +
    '</div>';

  return h;
  },
  wire: function(A, v){
    document.getElementById("gofolio").onclick = A.screenFolio;
    document.getElementById("gomine").onclick = function(){ A.screenMyTasks(); };
    var gw = document.getElementById("goworks");
    if (gw) gw.onclick = A.screenShowcase;
    var gs = document.getElementById("goshop");
    if (gs) gs.onclick = A.screenShop;
  }
},
{
  id: "badges",
  needs: ["qm", "S", "BADGES"],
  html: function(A, v){
  var h = "";
  /* ===== достижения ===== */
  h += '<div class="sect"><h2>Достижения</h2>' + A.qm("stars", "Откуда берутся звёзды и опыт") +
    '<div class="line"></div>' +
    '<span class="cnt">' + A.S().badges.length + ' из ' + A.BADGES.length + '</span></div><div class="badges">';
  A.BADGES.forEach(function(b){
    h += '<div class="badge' + (A.S().badges.indexOf(b.id) >= 0 ? " got" : "") + '">' +
      '<span class="em">' + b.em + '</span><span><b>' + b.name + '</b><span>' + b.desc + '</span></span></div>';
  });
  h += '</div>';
  return h;
  }
},
{
  id: "foot",
  needs: ["app", "aboutFootHTML", "wireAboutFoot"],
  html: function(A, v){
  var h = "";
  /* ⚠️ Подвал — для ВЗРОСЛОГО, который взял устройство ребёнка. Жалоба
     фаундера 06.09.2026: «нажимаю на логотип и остаюсь в профиле ученика».
     Логотип исправен — он ведёт домой, а дома человек уже стоял. Дыра была
     в том, что у вывески не было двери изнутри: адрес #about знает только
     тот, кто его написал. Ставим ссылку туда, где на любом сайте её и ищут —
     в самый низ, дим-строкой. Ребёнку она не мешает: он до неё не долистает
     и ничего не теряет, а взрослый ищет именно внизу. */
  h += A.aboutFootHTML();
  return h;
  },
  wire: function(A, v){
    A.wireAboutFoot(A.app);
  }
}
];

/* ================= сам экран =================
   Осталась рама: не пустить взрослого на детскую карту, догрузить содержание,
   посчитать факты один раз, сложить карточки по порядку и раздать им их
   кнопки. Ни одной чужой кнопки эта функция больше не знает. */
function screenWorlds(){
  /* ⚠️ Устройство взрослого не показывает детскую карту миров ВООБЩЕ. Иначе
     «← На главную» из кабинета приводило на неё, а там всплывал остаточный
     детский профиль этого устройства (имя, что стояло до превращения в кабинет).
     Для взрослого «главная» — это кабинет, а не уроки. Одна страховка закрывает
     все пути: и кнопку назад, и загрузку. */
  if (A.isAdminDevice()) return A.screenAdminHome();
  A.enterScreen("home", "home");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  /* Страховка: если содержание каких-то миров ещё не подгрузилось (это бывает
     только на сайте с раздельными файлами), догружаем всё и перерисовываем —
     иначе готовые миры показались бы как «в работе». */
  if (!window.__SINGLE_FILE__ && CURRICULUM.some(function(w){ return !CONTENT["world" + w.n]; })){
    A.allWorldsContent().then(function(){
      if (document.querySelector(".worlds")) screenWorlds();
    });
  }
  var doneTotal = Object.keys(A.S().stars).length;
  var name = A.myName();
  var next = A.nextLesson();
  var dues = A.reviewDue().length;
  var dailyOk = A.dailyDone(A.dayKey());
  /* Домашка стоит рядом с «Продолжить», а не в отдельной вкладке: её задал
     человек, и ждёт ответа тоже человек. Спрятанное обязательство перед
     человеком перестаёт быть обязательством. */
  var hwLeft = A.hwPending().length;

  var v = { doneTotal: doneTotal, name: name, next: next, dues: dues,
            dailyOk: dailyOk, hwLeft: hwLeft };

  /* ⚠️ Узкий доступ строится ЗДЕСЬ и заново на каждый показ: карточка не
     хранит его у себя между отрисовками. Копия ссылки на чужое состояние
     однажды начинает читать позапрошлое — правило оплачено 08.09.2026. */
  var box = CARDS.map(function(c){ return { c: c, a: pick(c.needs) }; });
  var h = box.map(function(x){ return x.c.html(x.a, v); }).join("");

  A.app.innerHTML = A.installTipHTML() + h;
  A.wireInstallTip(A.app);
  box.forEach(function(x){ if (x.c.wire) x.c.wire(x.a, v); });
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

return { lessonSearch: lessonSearch, screenWorlds: screenWorlds, CARDS: CARDS };
};
