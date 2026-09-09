/* ============================================================
   Фионика — экран профиля ученика: имя, код, ссылка на другое устройство,
   тема, звук, озвучка, наборы оформления и выход.

   ⚠️ ШЕСТОЕ ОТРЕЗАНИЕ ПО ДОГОВОРУ из js/screens-showcase.js. Наружу торчат
   два имени — screenAccount и copyText (второе живёт здесь исторически и
   нужно ещё нескольким экранам).

   ⚠️ ЗДЕСЬ ЖЕ ЗАПИСАНА ЛОВУШКА, НА КОТОРУЮ ЧУТЬ НЕ НАСТУПИЛ. Замер связанности
   назвал зависимостями «data», «name» и «sfx» — а их тут нет вовсе:
     data и sfx нашлись внутри разметки, в атрибутах data-theme-set и
       data-sfx-set;
     name — обычная местная переменная урока.
   Слепая замена по слову превратила бы «data-sfx-set» в «data-A.sfx-set» и
   тихо сломала бы все переключатели: разметка собралась бы, кнопки перестали
   бы отвечать. Поэтому замена делается ТОЛЬКО вне строк и комментариев, а
   список зависимостей глазами вычитывается ДО правки, а не после.

   Правило про чужое изменяемое состояние соблюдено: session читается через
   A.session(), а пишется единственным входом A.newSession.

   ⚠️ И ЕЩЁ ОДНА, ПОЙМАННАЯ ТОЛЬКО БРАУЗЕРОМ. Отбрасывая «sfx» как кусок
   разметки, я отбросил его целиком — а один настоящий вызов, sfx("badge"),
   в блоке был: он даёт услышать звук сразу при включении, иначе выбор
   проверяется только следующей победой. Тесты этого не увидели: ошибка живёт
   в обработчике кнопки и случается только по клику. Правило отсюда: если имя
   исключается из зависимостей, исключать надо КАЖДОЕ вхождение по отдельности,
   а не слово целиком — и щёлкать по кнопкам руками.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.account = function(A){

/* ================= экран: профиль ученика =================
   Показывает имя, код ученика и ссылку-вход для другого устройства, даёт выйти.
   ============================================================ */
/* Копирование в буфер. Раньше отказ современного способа (а браузер отказывает
   легко: нет разрешения, страница во фрейме, нет жеста) приводил к тишине —
   ребёнок жал кнопку, и не менялось ничего. Теперь отказ ПАДАЕТ на старый способ
   через невидимое поле, и надпись на кнопке меняется в обоих случаях. */
function copyText(text, btn){
  var done = function(){ if (btn){ var t = btn.textContent; btn.textContent = "Скопировано ✓"; setTimeout(function(){ btn.textContent = t; }, 1500); } };
  var oldWay = function(){
    try {
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove(); done();
    } catch(e2){}
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done, oldWay);
      return;
    }
  } catch(e){}
  oldWay();
}
function screenAccount(){
  A.enterScreen(null, "account");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  var code = A.myCode(), name = A.myName();
  var link = "";
  try { link = location.origin + location.pathname + "?kid=" + encodeURIComponent(code); } catch(e){}
  var h = '<div class="lvlhead"><div><div class="idx">твой профиль</div><h1>👤 ' +
    (name ? A.esc(name) : "Профиль") + '</h1></div></div>';
  if (A.serverOn() && code){
    h += '<div class="card"><h3>Твой код ученика</h3>' +
      '<p class="dim">По нему можно открыть свой прогресс на другом устройстве. Никому лишнему ' +
      'не показывай: кто знает код, тот видит прогресс.</p>' +
      '<div class="codebox"><code id="mycode">' + A.esc(code) + '</code>' +
      '<button class="rbtn sec" id="copycode">Скопировать код</button></div>' +
      '<p class="dim" style="margin-top:12px">Ссылка-вход для другого устройства:</p>' +
      '<div class="codebox"><code id="mylink">' + A.esc(link) + '</code>' +
      '<button class="rbtn sec" id="copylink">Скопировать ссылку</button></div>' +
      /* ⚠️ Бумага здесь не архаизм. Код живёт в браузере, а браузер чистят,
         меняют и теряют вместе с устройством; восстановить код нечем — ни
         почты, ни телефона мы не спрашиваем. Единственный способ не потерять
         доступ — вынести код ИЗ браузера, и лист бумаги делает это надёжнее
         всего остального. */
      '<div class="winrow" style="margin-top:14px">' +
      '<button class="bigbtn ghost" id="printcard">🖨 Карточка доступа</button></div>' +
      '<p class="dim">Лист с именем, кодом и ссылкой — распечатать или сохранить в PDF. ' +
      'Положить в дневник или отдать родителю.</p></div>';
  } else {
    h += '<div class="card"><p class="lede">Сервер не подключён — прогресс хранится только ' +
      'на этом устройстве, кода нет.</p></div>';
  }
  /* ⚠️ Честность к ребёнку: что именно видят взрослые — написано ЕМУ, в его
     профиле, а не спрятано в кабинете взрослого. Правило продукта: ребёнок
     всегда видит, когда его видят. */
  if (A.serverOn() && code){
    h += '<div class="card"><h3>Что видят репетитор и родитель</h3>' +
      '<ul class="trrules">' +
      '<li><b>Когда ты занимаешься и какой урок открыт</b> — по твоему коду ученика. ' +
      'Сам экран и то, что ты печатаешь, им не видно.</li>' +
      '<li><b>Твой код и вывод</b> — только если ты сам нажмёшь «Показать экран репетитору». ' +
      'Пока показ включён, у тебя горит плашка, и выключить его можешь только ты.</li>' +
      '</ul>' + A.liveRowHTML() + '</div>';
  }
  /* ⚠️ Выход — единственное место в продукте, где доступ теряется НАСОВСЕМ и
     по нажатию одной кнопки: код забывается, а восстановить его нечем.
     Поэтому здесь он написан прямо в предупреждении — чтобы последнее, что
     ребёнок видит перед выходом, был сам код, а не слово «выйти». */
  h += '<div class="card"><h3>Сменить ученика</h3>' +
    '<p class="dim">Выйти — забыть код на этом устройстве и войти под другим именем или кодом. ' +
    'Прогресс на сервере при этом не удаляется.</p>' +
    (code
      ? '<div class="note"><b>Перед выходом запиши код: ' + A.esc(code) + '</b>' +
        'Без него вернуться к своим занятиям будет нечем: ни почты, ни телефона тренажёр ' +
        'не спрашивает, и найти твой прогресс по имени нельзя. Если код знает репетитор или ' +
        'родитель — спросишь у них.</div>'
      : '') +
    '<div class="winrow"><button class="bigbtn ghost" id="logout">Выйти / сменить</button></div></div>' +
    /* Дверь к другим кабинетам — здесь, в профиле, а не на главном экране:
       ребёнку она в глаза не бросается, а взрослый, взявший его устройство,
       находит её там, где ищут настройки. Сами кабинеты всё равно под замком. */
    '<div class="card"><h3>Это не мой кабинет</h3>' +
    '<p class="dim">Если за устройство сел родитель или репетитор — можно перейти в свой кабинет ' +
    'без набора адресов.</p>' +
    '<div class="winrow"><button class="bigbtn ghost" id="gorole">⇄ Сменить роль</button></div></div>' +
    '<div class="card"><h3>Что это за тренажёр</h3>' +
    '<p class="dim">Витрина: чему тут учат, сколько это уроков, что видит взрослый и чего ' +
    'здесь нет. Её же показывают тому, кто открыл ссылку впервые.</p>' +
    '<div class="winrow"><button class="bigbtn ghost" id="goabout">🐍 О тренажёре</button></div></div>' +
    '<div class="card"><h3>Портфолио</h3>' +
    '<p class="dim">Готовые программы и сертификаты в одном месте — то, что можно показать.</p>' +
    '<div class="winrow"><button class="bigbtn ghost" id="gofolio">🎒 Открыть портфолио</button></div></div>' +
    /* Оформление стоит в профиле, а не только в помощи: настройку ищут там,
       где настройки, а не там, где подсказки. Дублирование тут дешевле
       ненайденной кнопки. */
    '<div class="card"><h3>Оформление</h3>' +
    '<p class="dim">Светлая тема стоит по умолчанию — тёмный фон тяжело читать днём. ' +
    'Выбор запоминается на этом устройстве и на другие не переезжает.</p>' +
    '<div class="themepick" id="acctheme">' +
      '<button data-theme-set="light">☀️ Светлая</button>' +
      '<button data-theme-set="dark">🌙 Тёмная</button>' +
    '</div>' +
    '<p class="dim">Набор — цвет тренажёра и твой значок в панели. Каждый открывается ' +
    'за выпускной мира: все уроки мира и его проект. Открытый набор не сгорает.</p>' +
    A.skinPickHTML() + '</div>' +
    /* Звук стоит рядом с оформлением по той же причине: настройку ищут там,
       где настройки. Про «этом устройстве» сказано прямо — иначе родитель
       выключит дома и удивится, что в кружке снова звенит. */
    '<div class="card"><h3>Звук</h3>' +
    '<p class="dim">Короткие сигналы на победу, новый бейдж и ошибку. Выбор запоминается ' +
    'на этом устройстве и на другие не переезжает: дома можно со звуком, за общим столом — без.</p>' +
    '<div class="themepick" id="accsfx">' +
      '<button data-sfx-set="on">🔔 Со звуком</button>' +
      '<button data-sfx-set="off">🔕 Тихо</button>' +
    '</div>' +
    (A.voiceSupported()
      ? '<p class="dim" style="margin-top:14px">Кнопка 🔊 на карточках урока читает текст вслух ' +
        'по нажатию — она работает всегда. Здесь включается только автоматическое чтение: ' +
        'объяснение ошибки проговаривается само. Полезно младшим и тем, кому тяжело читать с экрана.</p>' +
        '<div class="themepick" id="accvoice">' +
          '<button data-voice-set="on">🗣 Читать ошибки</button>' +
          '<button data-voice-set="off">Не читать</button>' +
        '</div>'
      : '<p class="dim" style="margin-top:14px">Чтение вслух этот браузер не умеет — кнопок ' +
        '🔊 не будет. Сигналы событий при этом работают.</p>') +
    '</div>' +
    (A.installPossible()
      ? '<div class="card"><h3>Приложение на домашнем экране</h3>' +
        '<p class="dim">Иконка вместо вкладки: открывается сразу на уроке, без адресной строки, ' +
        'и работает без интернета. На iPhone напоминания о занятии возможны только так.</p>' +
        A.installTipHTML(true) + '</div>'
      : '') +
    '<div class="card"><h3>Как пользоваться</h3>' +
    '<p class="dim">Полная инструкция: устройство сайта, из чего состоит урок, откуда берутся ' +
    'звёзды и что делать, когда не получается. Есть кусок для родителя.</p>' +
    '<div class="winrow"><button class="bigbtn ghost" id="goguide">❓ Открыть инструкцию</button></div></div>' +
    '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  A.app.innerHTML = h;

  A.bindLiveRow(screenAccount);
  /* ⚠️ Любое из трёх действий — скопировал код, скопировал ссылку, напечатал
     карточку — значит «код унесён из браузера», и напоминание на Главном
     гаснет. Отметку ставит ДЕЙСТВИЕ, а не показ экрана: решить за ребёнка,
     что он запомнил увиденное, — это и есть способ потерять доступ. */
  var cc = document.getElementById("copycode");
  if (cc) cc.onclick = function(){ copyText(code, cc); A.markCodeSaved(); };
  var cl = document.getElementById("copylink");
  if (cl) cl.onclick = function(){ copyText(link, cl); A.markCodeSaved(); };
  var pc = document.getElementById("printcard");
  if (pc) pc.onclick = function(){ A.markCodeSaved(); A.openAccessCard(code, A.myName()); };
  A.wireInstallTip(A.app);
  document.getElementById("goabout").onclick = A.screenAbout;
  document.getElementById("gofolio").onclick = A.screenFolio;
  document.getElementById("goguide").onclick = A.screenGuide;
  var paintTheme = function(){
    A.app.querySelectorAll("#acctheme button").forEach(function(b){
      b.classList.toggle("on", b.getAttribute("data-theme-set") === A.themeGet());
    });
  };
  A.app.querySelectorAll("#acctheme button").forEach(function(b){
    b.onclick = function(){ A.themeSet(b.getAttribute("data-theme-set")); paintTheme(); };
  });
  paintTheme();
  /* Плитку набора перерисовываем целиком: выбранный набор отмечается рамкой,
     а закрытые могли открыться, пока экран был открыт. */
  A.bindSkinPick(screenAccount);
  var paintSound = function(){
    A.app.querySelectorAll("#accsfx button").forEach(function(b){
      b.classList.toggle("on", (b.getAttribute("data-sfx-set") === "on") === A.sfxOn());
    });
    A.app.querySelectorAll("#accvoice button").forEach(function(b){
      b.classList.toggle("on", (b.getAttribute("data-voice-set") === "on") === A.voiceAuto());
    });
  };
  A.app.querySelectorAll("#accsfx button").forEach(function(b){
    b.onclick = function(){
      var on = b.getAttribute("data-sfx-set") === "on";
      A.sfxSet(on); paintSound();
      /* Дать услышать сразу: иначе выбор проверяется только следующей
         победой, то есть через целый урок. */
      if (on) A.sfx("badge");
    };
  });
  A.app.querySelectorAll("#accvoice button").forEach(function(b){
    b.onclick = function(){
      var on = b.getAttribute("data-voice-set") === "on";
      A.voiceAutoSet(on); paintSound();
      if (on) A.speak("Чтение вслух включено.");
    };
  });
  paintSound();
  (function(){ var r = document.getElementById("gorole"); if (r) r.onclick = A.screenRoles; })();
  document.getElementById("logout").onclick = function(){
    var yes = true;
    /* ⚠️ Обещать «на сервере останется» можно только когда сервер и правда есть.
       Раньше эта фраза говорилась всегда, в том числе при пустом коде ученика, —
       то есть ребёнку обещали возврат прогресса, которого нигде нет. */
    var back = (typeof Cloud !== "undefined" && Cloud.configured())
      ? "На сервере он останется — его можно вернуть по коду " + Cloud.myCode() + "."
      : "ВЕРНУТЬ ЕГО БУДЕТ НЕЧЕМ: копии на сервере нет, прогресс есть только здесь.";
    try { yes = confirm("Выйти и очистить прогресс на этом устройстве?\n\n" + back); } catch(e){}
    if (yes) A.doLogout();
  };
  document.getElementById("tomap").onclick = A.goHome;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}


return { screenAccount: screenAccount, copyText: copyText };
};
