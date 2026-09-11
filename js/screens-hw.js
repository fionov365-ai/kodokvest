/* ============================================================
   Фионика — домашка у ребёнка: список заданного, одна задача, проверка
   и победная карточка.

   ⚠️ Отрезан от js/app.js в 1.146.0 — вторая половина пункта D.13
   архитектурного долга (docs/RAZVITIE.md § 2.5). Первая половина — раздел
   «Ты и ИИ» (js/screens-ailab.js, 1.145.0); в app.js они лежали рядом
   исторически и не делили ни одного имени.

   ⚠️ Уехали ТОЛЬКО ЭКРАНЫ РЕБЁНКА. Слой данных домашки (hwRecords, hwBuild,
   hwSeed, hwMark, hwPending и остальные) остался в app.js, и это решение, а
   не недоделка: его читают ещё кабинет репетитора, экран группы, сводка
   присутствия и Главное. Унеси его сюда — и наружу пришлось бы отдавать
   шестнадцать имён; мера связанности из договора (чем короче список
   возвращаемого, тем удачнее разрез) сказала бы, что резали не там.

   Договор — тот же, что в шапке js/screens-showcase.js: всё чужое приходит
   объектом A, общего состояния файл не пишет (сданное отмечает A.hwMark,
   переменную session заменяет A.newSession(v), поля текущей сессии —
   через A.session()), наружу — только два экрана.

   Замер 11.09.2026: внутрь приходит 31 имён, наружу уходит 2.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.hw = function(A){

/* ===== экран ребёнка: список домашки ===== */
function screenHW(){
  A.enterScreen("home", "hw");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  var pend = A.hwPending(), done = A.hwDoneRecs();

  var h = '<div class="lvlhead"><div><div class="idx">задал репетитор</div>' +
    '<h1>📮 Домашка</h1></div>' +
    '<div class="right"><span class="tag">' +
      (pend.length ? pend.length + " " + A.plural(pend.length, "задача", "задачи", "задач") : "всё сдано") +
    '</span></div></div>';

  if (!pend.length && !done.length){
    h += '<p class="lede">Здесь появляются задачи, которые задаёт взрослый — репетитор или родитель — ' +
      'между занятиями. Пока не задано ничего, и это не значит, что ты что-то пропустил.</p>' +
      '<div class="card"><h3>Как это устроено</h3>' +
      '<p>Домашка — это не пройденный урок заново. Это задача на то же умение, но с другими ' +
      'числами: решение из урока к ней не подойдёт.</p>' +
      '<p class="dim">Звёзд домашка не даёт и на прогресс по курсу не влияет. ' +
      'Проверяет её тренажёр: сверяется то, что напечатала твоя программа.</p></div>';
  } else {
    h += '<p class="lede">Задачи на то же умение, что и уроки, но с другими числами — ' +
      'своё решение из урока сюда не подойдёт. Проверяет тренажёр: сверяется напечатанное. ' +
      'Звёзд домашка не даёт.</p>';
  }

  if (pend.length){
    h += '<div class="sect"><h2>Сделать</h2><div class="line"></div></div><div class="gamegrid">';
    pend.forEach(function(r){
      var b = A.hwBuild(r);
      if (!b) return;
      var late = A.hwDaysLeft(r);
      h += '<button class="gamecard" data-hw="' + A.esc(r.key) + '">' +
        '<span class="gemoji">' + b.emoji + '</span>' +
        '<b>' + A.esc(b.title) + '</b>' +
        '<span>' + A.esc(b.goal.slice(0, 110)) + (b.goal.length > 110 ? "…" : "") + '</span>' +
        '<span class="wtag">' + A.esc(b.tag) + ' · ' + A.esc(A.hwDueText(r)) +
        (late !== null && late < 0 ? " · сделать всё равно стоит" : "") + '</span></button>';
    });
    h += '</div>';
  }
  if (done.length){
    h += '<div class="sect"><h2>Сдано</h2><div class="line"></div>' +
      '<span class="cnt">' + done.length + '</span></div><div class="gamegrid">';
    done.forEach(function(r){
      var b = A.hwBuild(r);
      if (!b) return;
      h += '<button class="gamecard" data-hw="' + A.esc(r.key) + '">' +
        '<span class="gemoji">' + b.emoji + '</span>' +
        '<b>' + A.esc(b.title) + ' <span class="edittag done">сдано ✓</span></b>' +
        '<span>' + A.esc(b.tag) + '</span>' +
        '<span class="wtag">попыток: ' + (r.tries || 1) + '</span></button>';
    });
    h += '</div>';
  }

  h += '<div class="pager"><button class="bigbtn ghost" id="tomap">← На главную</button></div>';
  A.app.innerHTML = h;
  A.app.querySelectorAll("[data-hw]").forEach(function(b){
    b.onclick = function(){ openHW(b.getAttribute("data-hw")); };
  });
  document.getElementById("tomap").onclick = A.goHome;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ===== экран ребёнка: решаем одну задачу домашки ===== */
function openHW(key){
  var rec = A.hwMine().filter(function(x){ return x.key === key; })[0];
  if (!rec) return screenHW();
  var t = A.hwBuild(rec);
  if (!t){
    /* Задача из ссылки есть, а в банке её больше нет — такое бывает только
       после обновления сайта. Молчать нельзя: ребёнок будет думать, что
       домашку он потерял. */
    A.enterScreen("home", "hw");
    A.app.innerHTML = '<div class="lvlhead"><div><h1>📮 Домашка</h1></div></div>' +
      '<div class="note"><b>Эту задачу открыть не получилось</b>' +
      'Похоже, она из старой версии тренажёра. Скажи репетитору — он задаст её заново. ' +
      'Твой прогресс от этого не пострадал.</div>' +
      '<div class="pager"><button class="bigbtn ghost" id="tohw">← Ко всей домашке</button></div>';
    document.getElementById("tohw").onclick = screenHW;
    A.refreshTop();
    return;
  }
  if (A.capHard()) return A.screenCapReached();
  A.enterScreen("home", "hwone");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });

  var already = !!rec.done;
  var h = '<div class="crumbs"><span data-go="back">Домашка</span> › ' + t.emoji + ' ' + A.esc(t.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">' + A.esc(t.tag) +
      (t.by ? " · задал " + A.esc(t.by) : "") + '</div>' +
    '<h1>' + t.emoji + ' ' + A.esc(t.title) + '</h1></div>' +
    '<div class="right"><span class="tag">' + A.esc(A.hwDueText(rec)) + '</span></div></div>' +
    '<p class="lede">' + (already
      ? 'Эта задача уже сдана. Можно решить её ещё раз — на «сдано» это не повлияет.'
      : 'Задача на то же умение, что и в уроке, но числа другие: решение из урока не подойдёт. ' +
        'Сверяется то, что напечатает твоя программа.') + '</p>';

  h += '<div class="goal"><h3>🎯 Задача</h3><p>' + A.esc(t.goal) + '</p><ul>' +
    (t.list || []).map(function(x){ return "<li>" + A.esc(x) + "</li>"; }).join("") +
    '</ul></div>';

  h += '<div id="studio"></div>' +
    '<div class="hintbox"><button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
    '<span class="tip">подсказки тут ничего не стоят — звёзд в домашке нет</span></div>' +
    '<div class="hintout" id="hintout"></div>' +
    '<div class="pager"><button class="bigbtn ghost" data-go="back">← Ко всей домашке</button></div>';
  A.app.innerHTML = h;

  var studio = A.makeStudio({
    engine: "mini", code: t.starter, lint: true, label: "твоя программа",
    viz: function(o){
      A.screenViz({ code: o.code, env: o.env,
        backTo: { label: "← Вернуться к задаче", go: function(){ openHW(key); } } });
    },
    check: function(ed, showMsg){ hwCheck(t, rec, ed, showMsg); }
  });
  document.getElementById("studio").appendChild(studio);
  A.session().studio = studio;
  A.session().lesson = "hw-" + key;
  A.session().starter = [{ name:"main.py", code: t.starter }];
  var d = A.draftGet(A.session().lesson);
  if (d) A.draftApply(studio.editor, d.files);
  studio.editor.onEdit = A.draftSchedule;

  A.wireHint(t.hints);
  A.app.querySelectorAll("[data-go]").forEach(function(b){ b.onclick = screenHW; });
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function hwCheck(t, rec, ed, showMsg){
  A.session().attempts++;
  var code = ed.getCode();

  /* Требования конструкции — до запуска: «напиши функцию» нельзя закрыть
     тремя print с готовыми числами, и сказать об этом надо раньше, чем
     ребёнок обрадуется совпавшему выводу. */
  for (var i = 0; i < (t.need || []).length; i++){
    if (!A.codeHas(code, t.need[i])){
      showMsg("warn", "<b>Почти</b>" + A.esc(t.needMsg || "Не хватает нужной конструкции."));
      return;
    }
  }
  for (var j = 0; j < (t.ban || []).length; j++){
    if (A.codeHas(code, t.ban[j])){
      showMsg("warn", "<b>Так нельзя</b>" + A.esc(t.banMsg || "Эта конструкция в задаче запрещена."));
      return;
    }
  }

  var res = A.hwRunner(code);
  if (res.error){ ed.setError(res.error.line); showMsg("bad", A.errHTML(res.error)); return; }
  var got = res.lines, exp = t.lines;
  if (!(exp.length === got.length && exp.every(function(x, k){ return x === got[k]; }))){
    showMsg("bad", "<b>Ещё не то</b>" + A.diffBlock(exp, got));
    return;
  }
  winHW(t, rec);
}

function winHW(t, rec){
  var first = !rec.done;
  A.hwMark(rec.key, A.session().attempts);
  A.markActiveToday();
  A.save(); A.refreshTop();
  var left = A.hwPending().length;
  document.getElementById("wincard").innerHTML =
    '<div class="big">' + (A.session().attempts === 1 ? "🎯" : "✅") + '</div>' +
    '<h2>' + (first ? "Домашка сдана" : "Решено ещё раз") + '</h2>' +
    '<p>Вывод сошёлся: программа делает ровно то, что просили. ' +
    'Репетитор увидит, что задача сдана, при следующем открытии тренажёра.</p>' +
    (A.session().attempts === 1
      ? '<div class="stepnote">С первой попытки — значит умение из урока держится и на других числах.</div>'
      : '') +
    '<div class="stepnote">' + (left
      ? "Осталось задач: <b>" + left + "</b>."
      : "Это была последняя задача из заданных. Домашка закрыта.") + '</div>' +
    '<div class="winrow"><button class="bigbtn" id="whw">' +
      (left ? "К остальным задачам" : "Ко всей домашке") + '</button>' +
    '<button class="bigbtn ghost" id="wstay">Остаться здесь</button></div>';
  document.getElementById("win").classList.add("show");
  A.confetti(first ? 2 : 1);
  document.getElementById("whw").onclick = function(){ A.closeWin(); screenHW(); };
  document.getElementById("wstay").onclick = A.closeWin;
}

return {
  screenHW: screenHW,
  openHW: openHW
};
};
