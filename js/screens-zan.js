/* ============================================================
   Фионика — экран занятия и его итог.

   Отрезан из app.js 24.09.2026 (архитектурный долг, § 2.5 RAZVITIE) по
   договору из шапки js/screens-showcase.js: всё чужое приходит объектом A.

   ЗАМЕР ПЕРЕД РАЗРЕЗОМ (правило § 4.2, tools/zamer.js 7400 7611 7692 7737):
   два куска — экран занятия (план, перерыв, «проверь понимание», конец) и
   его итог. Между ними в app.js ОСТАЛИСЬ «в следующий раз», «до конца мира»
   и «возвращение после паузы»: ими пользуются Главное и кабинет, унести их
   сюда значило бы отдавать наружу втрое больше имён.
   Наружу три имени, продукту нужно ОДНО — screenZan (десять дверей: «назад»
   в шапке, Главное, разминка, «Сегодня», конец урока, проверка понимания,
   адрес #zan и тест); screenZanDone и zanOpenBlock зовёт только тест.
   Внутрь 46 имён — почти все функции слоя занятия (план, сжатие, перерыв,
   отчёт), они поднимаются и отдаются значением. Исключения: S — вызовом
   (§ 4, пункт 5); screenMyTasks присваивается НИЖЕ договора — обёрткой
   (§ 4.40). Замена имён — токенизатором вне строк, комментариев и
   регулярных выражений (§ 4.3): в куске есть регулярка с кавычками внутри.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.zan = function(A){

/* ================= экран занятия =================
   Ребёнок видит ПОЛОСУ занятия, а не обратный отсчёт: часы, отсчитывающие
   время до конца, торопят, а весь продукт построен на том, что за медленность
   не наказывают. Время здесь ничего не обрывает — оно только разрешает
   закончить. */
function zanBlockLabel(b){
  if (b.k === "warm") return "Разминка";
  if (b.k === "lesson") return "Урок";
  if (b.k === "review") return "Повторение";
  return "Проверка понимания";
}
function zanBlockEmoji(b){
  return b.k === "warm" ? "🧩" : b.k === "lesson" ? "📘" : b.k === "review" ? "🔁" : "🔮";
}
function zanOpenBlock(b){
  /* Проверка понимания: если сегодня ребёнок написал программу, из которой
     получается честный вопрос, спрашиваем про НЕЁ, а не про чужую разминку.
     Не получилось — разминка, как и раньше. Молча: обещать «спросим про твой
     код» и не спросить хуже, чем не обещать. */
  if (b.k === "predict"){
    var mine = A.myPredictPick();
    if (mine) return A.openMyPredict(mine, b.id);
    /* id «mine» — это блок, заведённый ради своей программы, и разминки за
       ним нет вовсе. Такое возможно, если программа успела вытесниться из
       списка занятия: тогда честнее вернуть в занятие, чем высадить ребёнка
       в чужом разделе. */
    if (b.id === "mine") return screenZan();
  }
  if (b.k === "warm" || b.k === "predict") A.openWarmup(b.id, {});
  else A.openLesson(b.id);
}
function screenZan(){
  A.enterScreen(undefined, "zan");
  var rec = A.zanOpen();
  var planned = A.frameOn();

  if (!rec){
    var plan = A.zanPlanFor(A.dayKey());
    var f = A.frame();
    var listHTML = plan.length
      ? '<ol class="zanplan">' + plan.map(function(b){
          return '<li><span class="zi">' + zanBlockEmoji(b) + '</span>' +
            '<b>' + zanBlockLabel(b) + '</b> · ' + A.esc(b.title || b.id) + '</li>';
        }).join("") + '</ol>'
      : '<p class="dim">План пока пустой: не открыто ни одного урока. Пройди первый урок Мира 1 — и занятие соберётся само.</p>';
    A.app.innerHTML =
      '<div class="lvlhead"><div><div class="idx">' + (planned ? "занятие по расписанию" : "занятие") + '</div>' +
        '<h1>⏱ Занятие на ' + f.len + ' минут</h1></div>' +
        '<div class="right"><span class="tag">' + plan.length + ' ' + A.plural(plan.length, "шаг", "шага", "шагов") + '</span></div></div>' +
      '<p class="lede">Занятие — это не «сколько успеешь», а понятный кусок: вот столько минут, вот эти шаги, и всё. ' +
      'Урок посередине не обрывается: время только разрешает закончить, а не подгоняет.</p>' +
      '<div class="card"><h3>Что сегодня в занятии</h3>' + listHTML +
        (A.zanAfterPause() ? '<p class="dim">👋 Сегодня занятие короче обычного: ты возвращаешься ' +
          'после перерыва, и вход идёт со знакомого. Полный план вернётся, как только занятия ' +
          'пойдут подряд.</p>' : '') + '</div>' +
      '<div class="winrow"><button class="bigbtn" id="zgo"' + (plan.length ? "" : " disabled") + '>Начать занятие</button>' +
      '<button class="bigbtn ghost" id="zback">← На «Сегодня»</button></div>';
    var zg = document.getElementById("zgo");
    if (zg && plan.length) zg.onclick = function(){ A.zanStart(); screenZan(); };
    document.getElementById("zback").onclick = A.screenToday;
    A.refreshTop();
    return;
  }

  /* сжатие проверяется при каждом возврате на экран: время могло выйти, пока
     ребёнок сидел в уроке */
  var squeezed = A.zanSqueeze(rec);
  rec = A.zanOpen() || rec;

  var doneSet = {};
  (rec.done || []).forEach(function(x){ doneSet[x] = 1; });
  var rest = A.zanRemaining(rec);
  var next = rest[0] || null;
  var mins = A.zanMins(rec), pause = A.zanPauseMins(rec);
  var closed = A.zanClosedCount(rec);
  var pct = Math.min(100, Math.round((closed / Math.max(1, rec.plan.length)) * 100));

  /* ⚠️ Спрашиваем ТОЛЬКО между шагами — урок посередине не режется ни при
     каких обстоятельствах. Экран занятия и есть это «между», потому что
     попасть сюда можно только закончив шаг или уйдя из него самому.
     rec.ask помнит, на каком месте ребёнок сказал «ещё один урок»: пока он его
     не СДЕЛАЛ, вопрос не повторяется. Считаем именно сделанные шаги, а не
     закрытые: перенос по сжатию — не работа ребёнка, и засчитывать его за
     обещанный урок было бы обманом в свою пользу. */
  var askNow = A.zanTimeUp(rec) && rest.length && (rec.done || []).length >= (rec.ask || 0);
  var restLessons = rest.filter(function(b){ return b.k === "lesson" || b.k === "review"; });
  var hasCheck = rest.some(function(b){ return b.k === "predict"; });

  /* идёт перерыв — экран занятия превращается в экран перерыва и ничего
     больше не предлагает: смысл перерыва в том, чтобы отойти */
  if (A.zanOnBreak(rec)){
    var left = Math.max(1, Math.ceil((rec.breakUntil - Date.now()) / 60000));
    A.app.innerHTML =
      '<div class="lvlhead"><div><div class="idx">занятие на паузе</div>' +
        '<h1>☕ Перерыв</h1></div></div>' +
      '<div class="card"><p class="asktext">Отойди от экрана: попей воды, разомнись, посмотри в окно. ' +
      'Вернись примерно через <b>' + left + ' ' + A.plural(left, "минуту", "минуты", "минут") + '</b>.</p>' +
      '<p class="dim">Это время не считается работой — оно и не должно.</p>' +
      '<div class="winrow"><button class="bigbtn" id="zback2">Я вернулся</button></div></div>';
    document.getElementById("zback2").onclick = function(){
      var r = A.zanAll()[rec.key];
      A.zanBreakEnd(r);
      A.actMark();
      screenZan();
    };
    A.refreshTop();
    return;
  }

  var head = '<div class="lvlhead"><div><div class="idx">идёт занятие</div>' +
      '<h1>⏱ Занятие на ' + rec.len + ' минут</h1></div>' +
      '<div class="right"><span class="tag">' + closed + ' из ' + rec.plan.length + '</span></div></div>' +
    '<div class="zanbar"><i style="width:' + pct + '%"></i></div>' +
    '<p class="zanmeta">Работы: <b>' + mins + ' ' + A.plural(mins, "минута", "минуты", "минут") + '</b>' +
      (pause >= 2 ? ' · перерыв: <b>' + pause + '</b>' : '') + '</p>';

  var capNote = A.capNoteHTML();
  /* мягкое предложение перерыва: длинное занятие, половина позади */
  var breakNote = A.zanBreakDue(rec)
    ? '<div class="daybanner rest">☕ <b>Работаешь уже ' + mins + ' ' +
      A.plural(mins, "минуту", "минуты", "минут") + '.</b> Самое время сделать перерыв — ' +
      'после него дальше пойдёт легче.</div>'
    : "";

  /* видимая пометка о сжатии: молча сокращать план нельзя */
  var cutNote = "";
  if (squeezed)
    cutNote = '<div class="daybanner rest">📌 <b>Сегодня идёт тяжелее обычного.</b> ' +
      'Последний шаг перенесли на следующее занятие, чтобы ты успел дойти до конца. ' +
      'Он не пропал — вернётся сам.</div>';

  var plan = '<div class="card"><h3>Шаги занятия</h3><ol class="zanplan">' +
      rec.plan.map(function(b){
        var isDone = !!doneSet[b.k + ":" + b.id];
        var isCut = A.zanIsCut(rec, b);
        var cur = !isDone && !isCut && next && next.id === b.id && next.k === b.k;
        return '<li class="' + (isDone ? "done" : (isCut ? "cut" : (cur ? "cur" : ""))) + '">' +
          '<span class="zi">' + (isDone ? "✓" : (isCut ? "📌" : zanBlockEmoji(b))) + '</span>' +
          '<b>' + zanBlockLabel(b) + '</b> · ' + A.esc(b.title || b.id) +
          (isCut ? ' <span class="dim">перенесли на следующий раз</span>' : '') +
          (cur && !askNow ? ' <button class="rbtn check zopen" data-zk="' + b.k + '" data-zi="' + A.esc(b.id) + '">Открыть</button>' : '') +
        '</li>';
      }).join("") + '</ol></div>';

  /* ---------- выбор, когда время вышло ----------
     Три кнопки, а не две. Средняя — это СОГЛАСОВАННЫЙ объём: ребёнок сам
     называет, сколько ещё сделает, вместо открытой двери «продолжай сколько
     хочешь». Хвалить за продолжение нельзя ни словом: «молодец, что не
     остановился» превращает занятие в гонку. */
  var tail;
  if (askNow){
    tail = '<div class="card zanask"><h3>⏱ ' + rec.len + ' минут прошло</h3>' +
      '<p>Занятие можно закрывать — ты своё отработал. Или сделать ещё шаг, если сегодня идёт хорошо. ' +
      'Решай сам.</p><div class="winrow">' +
        '<button class="bigbtn" id="zstop">Закончить занятие</button>' +
        (restLessons.length ? '<button class="bigbtn ghost" id="zone">Ещё один урок</button>' : '') +
        (hasCheck && restLessons.length ? '<button class="bigbtn ghost" id="zcheck">Только проверку и всё</button>' : '') +
      '</div><p class="dim">Что не успели — не пропадёт: перенесётся на следующее занятие.</p></div>';
  } else {
    tail = '<div class="winrow">' +
      (next ? '<button class="bigbtn" id="zgo2">Продолжить занятие</button>' : '') +
      '<button class="bigbtn ghost" id="zend">Закончить занятие</button></div>' +
      '<p class="dim">Закончить можно в любой момент — даже если сегодня не пошло. ' +
      'Занятие всё равно засчитается: важнее, что ты сел, чем сколько успел.</p>';
  }

  /* ⚠️ Жёсткий потолок не обрывает начатое: кнопки «открыть» просто нет, а
     занятие можно закрыть. Резать посередине нельзя ни таймеру, ни потолку. */
  if (A.capHard() && !askNow){
    tail = '<div class="card"><h3>🌙 На сегодня всё</h3>' +
      '<p>Дневной предел, о котором вы договорились со взрослым, уже пройден. ' +
      'Новые шаги откроются завтра — занятие можно закрыть.</p>' +
      '<div class="winrow"><button class="bigbtn" id="zend">Закончить занятие</button></div></div>';
    plan = plan.replace(/<button class="rbtn check zopen"[^<]*<\/button>/g, "");
  }

  var breakBtn = (!askNow && !A.capHard() && next)
    ? '<div class="winrow"><button class="bigbtn ghost" id="zbreak">☕ Перерыв ' + A.ZAN_BREAK + ' минут</button></div>'
    : "";

  A.app.innerHTML = head + capNote + breakNote + cutNote + plan + tail + breakBtn + A.liveRowHTML();
  A.bindLiveRow(screenZan);

  A.app.querySelectorAll(".zopen").forEach(function(b){
    b.onclick = function(){ zanOpenBlock({ k:b.getAttribute("data-zk"), id:b.getAttribute("data-zi") }); };
  });
  var zg2 = document.getElementById("zgo2");
  if (zg2 && next) zg2.onclick = function(){ zanOpenBlock(next); };
  var zend = document.getElementById("zend");
  if (zend) zend.onclick = function(){ screenZanDone(A.zanFinish("hand") || rec); };
  var zbr = document.getElementById("zbreak");
  if (zbr) zbr.onclick = function(){ A.zanBreakStart(A.zanAll()[rec.key]); screenZan(); };
  var zstop = document.getElementById("zstop");
  if (zstop) zstop.onclick = function(){ screenZanDone(A.zanFinish("time") || rec); };
  var zone = document.getElementById("zone");
  if (zone) zone.onclick = function(){
    var r = A.zanAll()[rec.key];
    if (r){ r.ask = (r.done || []).length + 1; A.save(); }
    var step = A.zanRemaining(r || rec)[0];
    if (step) zanOpenBlock(step); else screenZan();
  };
  var zcheck = document.getElementById("zcheck");
  if (zcheck) zcheck.onclick = function(){
    var r = A.zanAll()[rec.key];
    if (!r) return screenZan();
    A.zanCutToCheck(r);
    var step = A.zanRemaining(r)[0];
    if (step) zanOpenBlock(step);
    else screenZanDone(A.zanFinish("choice") || r);
  };
  A.refreshTop();
}

/* ================= итог занятия ================= */
function screenZanDone(rec){
  A.enterScreen(undefined, "zan");
  /* занятие закончилось — трансляция гаснет сама: обещание «выключается по
     концу занятия» держит код, а не память ребёнка */
  A.liveOffNow();
  var r = A.zanReport(rec, A.S());
  A.markActiveToday();
  A.app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">занятие закрыто</div>' +
      '<h1>' + (r.full ? "🏁 Занятие пройдено" : "🏁 Занятие закончено") + '</h1></div></div>' +
    '<div class="card zandone">' +
      '<p class="zanwas"><b>' + A.esc(r.was) + '.</b></p>' +
      (r.full ? '<p>Весь план сделан.</p>'
              : '<p>План сделан не весь — и это нормально: занятие засчитано, потому что ты сел и работал.</p>') +
      (r.cutN ? '<p class="dim">📌 Перенесли на следующее занятие: ' + r.cutN + ' ' +
        A.plural(r.cutN, "шаг", "шага", "шагов") + '. Они не пропали.</p>' : '') +
      '<p class="dim">' + A.esc(r.got) + '</p>' +
    '</div>' +
    '<div class="card"><h3>Что увидит взрослый</h3>' +
      '<p class="dim">Ровно эти строки — ничего сверх них мы никому не показываем.</p>' +
      '<ul class="zanrep"><li>' + A.esc(r.was) + '</li><li>Похвалить: ' + A.esc(r.praise) + '</li>' +
      (r.cut ? '<li>' + A.esc(r.cut) + '</li>' : '') +
      '<li>' + A.esc(r.got) + '</li><li>' + A.esc(r.ask) + '</li></ul></div>' +
    /* ⚠️ Обратное направление стоит ЗДЕСЬ, в конце занятия, и это не украшение.
       Взрослый задаёт ребёнку — это контроль, и контролем одним подписку не
       удержать. Ребёнок задаёт взрослому — это интерес: у работы появляется
       зритель, а у ребёнка роль старшего (docs/foresight-2027.md § 16.4,
       механика 3). Конец занятия — единственная точка, где оба только что
       были рядом и оба свободны. */
    '<div class="card"><h3>✍️ Задай задачу взрослому</h3>' +
      '<p>Придумай задачу, отправь ссылкой маме, папе или другу — и посмотри, ' +
      'решат ли. Проверять будет тренажёр, а не ты: сойтись должен вывод.</p>' +
      '<p class="dim">Составить задачу труднее, чем решить: придётся объяснить её словами так, ' +
      'чтобы человек понял без твоей программы.</p>' +
      '<div class="admrow"><button class="rbtn check" id="zask">Задать задачу →</button></div></div>' +
    A.nextTimeHTML() +
    '<div class="winrow"><button class="bigbtn" id="ztoday">← На «Сегодня»</button>' +
      '<button class="bigbtn ghost" id="zmap">К урокам</button></div>';
  document.getElementById("ztoday").onclick = A.screenToday;
  document.getElementById("zmap").onclick = A.goHome;
  var za = document.getElementById("zask");
  if (za) za.onclick = function(){ A.screenMyTasks(); };
  A.sfx("win");
  A.refreshTop();
}

return { screenZan: screenZan, screenZanDone: screenZanDone, zanOpenBlock: zanOpenBlock };
};
