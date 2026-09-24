/* ============================================================
   Фионика — экран «Сегодня»: дни подряд, неделя, задача дня, занятие,
   своё расписание и задания от взрослого.

   Отрезан из app.js 24.09.2026 (архитектурный долг, § 2.5 RAZVITIE) по
   договору из шапки js/screens-showcase.js: всё чужое приходит объектом A.

   ЗАМЕР ПЕРЕД РАЗРЕЗОМ (правило § 4.2, tools/zamer.js 6534 6772): раздел
   объявляет четыре имени — weekStripHTML, zanCardHTML, ptaskCardHTML и
   screenToday — и наружу из них нужно ОДНО, screenToday (десять дверей:
   «назад» из занятия, Главное, разминка, экран занятия, итог занятия, два
   выхода из задания взрослого, адрес #today, кнопка «Сегодня» в шапке и
   тест). Самый слабо связанный раздел из оставшихся: следующий за ним,
   экран занятия, отдаёт наружу два имени и зовёт «Сегодня» сам — потому и
   режется отдельно, а не вместе.
   Внутрь 49 имён — почти все функции слоя данных (стрик, рамка, расписание,
   занятие, задания взрослого), они поднимаются и отдаются значением.
   ⚠️ Три исключения: S и session — чужое изменяемое состояние (читается
   A.S(), пишется A.newSession — правило § 4, пункт 5); openWarmup и
   screenWarmups присваиваются в app.js НИЖЕ договора — едут обёртками
   (§ 4.40). Замена имён сделана только вне строк и комментариев (§ 4.3).
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.today = function(A){

/* ================= экран: Сегодня (стрик + задача дня) =================
   Показывает, сколько дней подряд ребёнок занимался, рекорд, полоску за
   неделю и одну «задачу дня» — детерминированно выбранную по дате разминку.
   Вне сотни уроков, звёзд не даёт. Смысл — привычка заходить каждый день.
   ============================================================ */
function weekStripHTML(){
  var today = A.dayKey();
  var cells = "";
  for (var i = 6; i >= 0; i--){
    var key = A.shiftDay(today, -i);
    var d = new Date(key + "T12:00:00");
    var on = A.activeOn(key);
    var sh = !on && A.shieldedOn(key);
    var isToday = key === today;
    var study = A.isStudyDay(key);
    var cls = "wkcell" + (on ? " on" : "") + (sh ? " shielded" : "") +
      (isToday ? " today" : "") + (study ? " study" : "");
    cells += '<div class="' + cls + '"><span class="wkd">' + A.WD_SHORT[d.getDay()] + '</span>' +
      '<span class="wkdot">' + (on ? "🔥" : (sh ? "🛡️" : (study ? "📌" : "·"))) + '</span></div>';
  }
  return '<div class="weekstrip">' + cells + '</div>';
}

/* запас щитов на экране «Сегодня»: сколько на руках и что они делают */
/* ⚠️ Блока «Щиты» на экране БОЛЬШЕ НЕТ, и это план, п. 4.4: щит работает
   молча. Сам механизм цел — пропущенный день закрывается сам, когда ребёнок
   вернётся (useShield в markActiveToday). А рассказывать про запас щитов
   значит заводить разговор о том, что серия может оборваться, — то есть
   ровно тот страх, который мы объявили красной линией. Молчание тут не
   умолчание: ребёнку нечего с этим делать, тратить щит руками нельзя. */

/* карточка занятия на экране «Сегодня»: главная кнопка дня */
function zanCardHTML(){
  var open = A.zanOpen(), f = A.frame();
  var doneToday = A.zanOfDay(A.dayKey()).filter(function(z){ return z.end; }).length;
  var restDay = A.frameOn() && !A.frameStudyDay(A.dayKey());
  if (open){
    var closed = A.zanClosedCount(open);
    var pct = Math.min(100, Math.round((closed / Math.max(1, open.plan.length)) * 100));
    return '<div class="card zancard on"><h3>⏱ Занятие идёт</h3>' +
      '<div class="zanbar"><i style="width:' + pct + '%"></i></div>' +
      '<p>Сделано ' + open.done.length + ' из ' + open.plan.length +
      ((open.cut || []).length ? ', перенесено ' + open.cut.length : '') + '. Работы: ' +
      A.zanMins(open) + ' ' + A.plural(A.zanMins(open), "минута", "минуты", "минут") + '.</p>' +
      '<div class="winrow"><button class="bigbtn" id="zancont">Продолжить занятие</button></div></div>';
  }
  if (doneToday){
    return '<div class="card zancard done"><h3>🏁 Занятие сегодня пройдено</h3>' +
      '<p>' + (doneToday > 1 ? "Занятий сегодня: " + doneToday + "." : "Одно занятие закрыто.") +
      ' Можно заниматься дальше просто так — это ничего не меняет и ни на что не влияет.</p>' +
      '<div class="winrow"><button class="bigbtn ghost" id="zanmore">Открыть ещё занятие</button></div></div>';
  }
  if (A.capHard())
    return '<div class="card zancard"><h3>🌙 На сегодня всё</h3>' +
      '<p>Сегодня за тренажёром уже ' + A.todayMinutes() + ' ' +
      A.plural(A.todayMinutes(), "минута", "минуты", "минут") +
      ' — столько вы договорились со взрослым. Новое занятие откроется завтра.</p></div>';
  return '<div class="card zancard"><h3>⏱ Занятие на ' + f.len + ' минут</h3>' +
    '<p>' + (restDay
      ? "Сегодня по расписанию день отдыха — но если хочется, занятие можно провести."
      : "Разминка, уроки и проверка в конце. Ты заранее знаешь, сколько это займёт и когда конец.") + '</p>' +
    '<div class="winrow"><button class="bigbtn" id="zanstart">Начать занятие</button></div></div>';
}
/* задания от взрослого: показываем только невыполненные */
function ptaskCardHTML(){
  var list = A.ptaskPending();
  if (!list.length) return "";
  return '<div class="card ptcard"><h3>✉️ Задание от взрослого</h3>' +
    list.slice(0, 3).map(function(x){
      var l = x.ref ? CURRICULUM.byId(x.ref) : null;
      return '<div class="ptrow"><span>' + A.esc(x.text) + '</span>' +
        (x.t === "ask"
          ? '<button class="rbtn check" data-ptdone="' + x.key + '">Рассказал</button>'
          : '<button class="rbtn check" data-ptopen="' + x.key + '" data-ptref="' + A.esc(x.ref) + '">' +
            /* ⚠️ Стояло (l ? "Открыть" : "Открыть") — обе ветки одинаковы, то есть
               проверка урока не делала ничего. Задумано было назвать урок: ребёнок
               видит просьбу взрослого и сразу знает, куда она ведёт. 18.09.2026. */
            (l ? "Открыть урок «" + A.esc(l.title) + "»" : "Открыть") + '</button>') + '</div>';
    }).join("") +
    '<p class="dim">Звёзд за это не даётся: это просьба взрослого, а не урок из сотни.</p></div>';
}

function screenToday(){
  A.enterScreen(undefined, "today");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  var doneToday = A.activeOn(A.dayKey());
  var pick = A.dailyPick();
  var taskDone = A.dailyDone();
  var due = A.studyDue();
  var days = A.agreedDays();        /* рамка взрослого сильнее своего расписания */

  /* ⚠️ ОГОНЁК СТАЛ УГОВОРОМ (план, п. 4.4). Раньше здесь стояло число дней
     подряд, рекорд и запас щитов — то есть три способа сказать «тебе есть
     что терять». Красная линия продукта звучит ровно наоборот: «страх
     потерять серию» — то, чего мы не делаем.

     Что осталось: уговор (какие дни недели условлены), сегодняшний день и
     календарь занятий. Календарь — единственная честная вещь во всём блоке:
     он показывает, как было, и ничего не требует.

     ⚠️ Щит никуда не делся, он работает МОЛЧА: пропущенный день закрывается
     сам, когда ребёнок вернётся. Рассказывать про запас щитов — значит снова
     заводить разговор о том, что серия может оборваться. */
  var уговор = days.length
    ? "Уговор: " + days.length + " " + A.plural(days.length, "день", "дня", "дней") + " в неделю"
    : "Уговор пока не назначен";
  var часЗанятия = A.frameOn() ? A.frameTime() : "";
  var сегодня = doneToday
    ? "Сегодня уже занимался."
    : (due
        ? "Сегодня по уговору учебный день." + (часЗанятия ? " Занятие в " + часЗанятия + "." : "")
        : "Сегодня можно отдыхать — это не учебный день.");

  var hero = '<div class="streakhero">' +
    '<div class="flame' + (doneToday ? " lit" : "") + '">🔥</div>' +
    '<div class="streaknum">' + A.esc(уговор) + '</div>' +
    '<div class="streaksub">' + A.esc(сегодня) +
      (doneToday ? "" : " Один урок или одна разминка — и день засчитан.") + '</div>' +
    weekStripHTML() +
  '</div>';

  /* Сколько сегодня работал — ребёнку тоже: он спрашивает «сколько я уже
     позанимался?» ровно так же, как взрослый. Число честное: чистая работа
     без пауз, из карты часов. */
  var todayMs = A.dayMs(A.S(), A.dayKey());
  var timeCard = todayMs
    ? '<div class="card"><h3>⏱ Сегодня за тренажёром</h3>' +
      '<p class="lede"><b>' + A.fmtDur(todayMs) + '</b> чистой работы.</p>' +
      '<p class="dim">Это только то время, когда ты действительно работал: ' +
      'открытая вкладка, пока тебя нет за столом, сюда не считается.</p></div>'
    : "";

  var taskCard;
  if (!pick){
    /* Ноль открытых разминок — это нормальное начало пути, а не поломка */
    taskCard = '<div class="card"><h3>🔥 Задача дня появится совсем скоро</h3>' +
      '<p>Она берётся из разминок, а разминка открывается после урока, на котором ' +
      'её можно прочитать. Пройди первые уроки Мира 1 — и задача дня появится тут сама.</p></div>';
  } else {
    var isBlocks = pick.type === "blocks";
    var typeLbl = isBlocks ? "собери из блоков" : "угадай вывод";
    taskCard = '<div class="dailycard' + (taskDone ? " done" : "") + '">' +
      '<div class="dctop"><span class="dcemoji">' + pick.emoji + '</span>' +
        '<div class="dcttl"><div class="dckicker">🔥 Задача дня · ' + typeLbl + '</div>' +
        '<b>' + A.esc(pick.title) + '</b></div>' +
        '<span class="tag">' + A.esc(pick.tag) + '</span></div>' +
      '<p class="dcintro">' + A.esc(pick.intro) + '</p>' +
      (taskDone
        ? '<div class="dcstatus done">✓ Выполнена сегодня. Новая задача — завтра.</div>' +
          '<div class="winrow"><button class="bigbtn ghost" id="dopen">Пройти ещё раз</button>' +
          '<button class="bigbtn ghost" id="dwarm">Ещё размяться</button></div>'
        : '<div class="winrow"><button class="bigbtn" id="dopen">Открыть задачу дня</button></div>') +
    '</div>';
  }

  /* «щит спас серию» — показываем один раз, сразу после спасения */
  var saved = A.takeShieldNote();

  /* напоминание по расписанию — только внутри сайта */
  var banner = "";
  if (A.agreedOn()){
    if (A.studyDue())
      banner = '<div class="daybanner due">🔔 <b>Сегодня учебный день' +
        (часЗанятия ? ", занятие в " + A.esc(часЗанятия) : "") + '.</b> ' +
        'Начни занятие, чтобы не пропустить.</div>';
    else if (A.agreedStudyDay(A.dayKey()))
      banner = '<div class="daybanner ok">✓ <b>Учебный день выполнен.</b> Сегодня ты уже занимался — молодец!</div>';
    else
      banner = '<div class="daybanner rest">Сегодня по расписанию день отдыха. Заглянуть можно и так — по желанию.</div>';
  }

  /* редактор дней занятий: понедельник … воскресенье.
     Если рамку задал взрослый — показываем её и НЕ даём двигать: рамка это
     уговор двоих, а не настройка ребёнка. Своё расписание при этом никуда не
     девается и вернётся, если рамку снимут. */
  var schedBox;
  if (A.frameOn()){
    var fd = A.frame().days.slice().sort(function(a,b){ return A.WD_ORDER.indexOf(a) - A.WD_ORDER.indexOf(b); })
      .map(function(n){ return A.WD_SHORT[n]; }).join(", ");
    schedBox = '<div class="card schedcard"><h3>📅 Дни занятий</h3>' +
      '<p>Занятия по ' + fd + ', по ' + A.frame().len + ' минут. Это назначил взрослый.</p>' +
      (A.isBreakDay(A.dayKey()) ? '<p class="dim">Сегодня каникулы — пропуск запланирован, это не прогул.</p>' : '') +
      '</div>';
  } else {
    var chips = A.WD_ORDER.map(function(n){
      var sel = A.scheduleDays().indexOf(n) >= 0;
      return '<button class="wdchip' + (sel ? " sel" : "") + '" data-wd="' + n + '">' + A.WD_SHORT[n] + '</button>';
    }).join("");
    schedBox = '<div class="card schedcard"><h3>📅 Дни занятий</h3>' +
      '<p class="dim">Отметь дни недели, когда планируешь заниматься. В такие дни на этом экране и на кнопке 🔥 появится напоминание. ' +
      'Если не выбрано ничего — напоминаний нет.</p>' +
      '<div class="wdrow">' + chips + '</div>' +
      (A.hasSchedule() ? '<p class="dim">Учебные дни: ' +
        A.scheduleDays().slice().sort(function(a,b){ return A.WD_ORDER.indexOf(a) - A.WD_ORDER.indexOf(b); })
          .map(function(n){ return A.WD_SHORT[n]; }).join(", ") + '.</p>' : '') +
      '</div>';
  }

  A.app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">уговор и задача дня</div><h1>🔥 Сегодня</h1></div>' +
      '<div class="right"><span class="tag">' + (doneToday ? "сегодня сделано" : due ? "сегодня учебный день" : "сегодня свободно") + '</span></div></div>' +
    /* ⚠️ Ни слова про «серию, которую жалко прерывать» — раньше это стояло
       прямо здесь и было честной формулировкой красной линии, только с той
       стороны, с которой её быть не должно. */
    '<p class="lede">Здесь уговор: в какие дни вы договорились заниматься, и что уже сделано. ' +
    'Пропущенный день ничего не сжигает — календарь просто покажет, как было. ' +
    'Звёзды тут не начисляются: важна не серия, а возвращение.</p>' +
    A.installTipHTML() + saved + banner + A.capNoteHTML() + zanCardHTML() + ptaskCardHTML() + hero + timeCard + taskCard + schedBox +
    '<div class="pager"><button class="bigbtn ghost" id="tomap" data-home="1">← На главную</button></div>';

  A.wireInstallTip(A.app);
  var dopen = document.getElementById("dopen");
  if (dopen && pick) dopen.onclick = function(){ A.openWarmup(pick.id, { daily:true }); };
  var dwarm = document.getElementById("dwarm");
  if (dwarm) dwarm.onclick = A.screenWarmups;
  A.app.querySelectorAll("[data-wd]").forEach(function(b){
    b.onclick = function(){ A.toggleStudyDay(+b.getAttribute("data-wd")); screenToday(); };
  });
  var zs = document.getElementById("zanstart");
  if (zs) zs.onclick = function(){ A.zanStart(); A.screenZan(); };
  var zc = document.getElementById("zancont");
  if (zc) zc.onclick = A.screenZan;
  var zm = document.getElementById("zanmore");
  if (zm) zm.onclick = function(){ A.zanStart(); A.screenZan(); };
  A.app.querySelectorAll("[data-ptdone]").forEach(function(b){
    b.onclick = function(){ A.ptaskMarkDone(b.getAttribute("data-ptdone")); screenToday(); };
  });
  A.app.querySelectorAll("[data-ptopen]").forEach(function(b){
    b.onclick = function(){
      A.ptaskMarkDone(b.getAttribute("data-ptopen"));
      var ref = b.getAttribute("data-ptref");
      if (ref) A.openLesson(ref); else A.screenWorlds();
    };
  });
  document.getElementById("tomap").onclick = A.goHome;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

return { screenToday: screenToday };
};
