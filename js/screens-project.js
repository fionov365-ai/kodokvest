/* ============================================================
   Фионика — экраны проекта: сборка проекта по шагам, судья шага, победа
   шага и экран «проект собран».

   Отрезаны из app.js 18.09.2026 (архитектурный долг, § 2.5 RAZVITIE) по
   договору из шапки js/screens-showcase.js.

   ЗАМЕР ПЕРЕД РАЗРЕЗОМ (§ 4.54, tools/zamer.js). Под баннером «проекты в
   конце мира» жили ДВЕ вещи: слой данных (projectsList, projectById,
   projectOfWorld, projectState, projectDone, projectOpen, projectDraftId,
   projectStartCode) и экраны.
     целиком — наружу 10 имён: слой данных читают Главное, карта мира,
       урок, портфолио, витрина, «Моё», кабинет и разбор адресов;
     только экраны — наружу ДВА (openProject, screenProjectDone), внутрь 40.
   Уехали экраны. Тот же вывод, что у домашки (1.146.0) и экзамена (1.188.0):
   слой данных общий, экран — нет.

   ⚠️ СОСТОЯНИЕ. Прогресс проекта пишет слой данных в app.js (projectOpen);
   отсюда он только читается — A.projectState(). Сессия — A.session() и
   A.newSession(v) (§ 4.5): шаг проекта живёт в ней (session.project,
   session.pstep), и это ТОТ ЖЕ объект, что видит app.js.
   ⚠️ ДВЕРИ. «Ты и ИИ» (js/screens-ailab.js) берёт openProject и
   screenProjectDone: его договор стоит на сотню строк выше — обёртками
   (§ 4.40). Портфолио, «Моё», защита и песочница объявлены НИЖЕ договора —
   они тоже приходят сюда обёртками.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.project = function(A){

function openProject(id, forceStep){
  var p = A.projectById(id);
  if (!p) return A.screenWorlds();
  var seq = A.claimScreen();
  A.worldContent(p.world).then(function(){
    if (A.screenStale(seq)) return;          /* ушли на другой экран, пока грузился мир */
    if (!A.projectOpen(p)) return A.screenWorld(p.world);
    var st = A.projectState(p.id);
    var i = (typeof forceStep === "number") ? forceStep : st.step;
    if (i >= p.steps.length) return screenProjectDone(p.id);
    var step = p.steps[i];
    A.enterScreen(undefined, "project");
    /* ⚠️ Адрес проекта routeHash читал с самого начала (`#project-w3`), а вот
       писать его было некому — то есть ссылка работала только у того, кто её
       набрал руками. Теперь обе половины на месте. */
    A.setRoute("#" + p.id, "Проект «" + p.title + "»");
    /* Черновик шага проекта — тем же механизмом, что у уроков: ключ шага
       вместо id урока. До этого код шага сохранялся ТОЛЬКО на победе, и уход
       за подсказкой в шпаргалку стирал написанное. */
    var draftId = A.projectDraftId(p.id, i);
    var startCode = A.projectStartCode(p, i);
    A.newSession({ id:null, attempts:0, hints:0, shown:false, project:p.id, pstep:i,
                lesson:draftId, starter:[{ name:"main.py", code:startCode }] });

    var dots = p.steps.map(function(s, k){
      var cls = k < st.step ? "done" : (k === i ? "now" : "");
      return '<span class="pdot ' + cls + '" title="' + A.esc(s.title) + '">' + (k + 1) + '</span>';
    }).join("");

    var where = p.world === 0 ? "🤖 Ты и ИИ" : "Мир " + p.world;
    var kicker = p.world === 0 ? "Проект раздела «Ты и ИИ»" : "Проект мира " + p.world;
    var head = '<div class="crumbs"><span data-go="world">' + A.esc(where) + '</span> › ' +
        p.emoji + ' ' + A.esc(p.title) + '</div>' +
      '<div class="lvlhead"><div><div class="idx">' + kicker +
        ' · шаг ' + (i + 1) + ' из ' + p.steps.length + '</div>' +
      '<h1>' + p.emoji + ' ' + A.esc(p.title) + '</h1></div>' +
      '<div class="right"><span class="tag">звёзд не даёт</span></div></div>' +
      '<p class="lede">' + A.esc(p.intro) + '</p>' +
      '<div class="pstepbar">' + dots + '</div>';

    var goal = '<div class="goal"><h3>🎯 Шаг ' + (i + 1) + ': ' + A.esc(step.title) + '</h3>' +
      '<p>' + A.esc(step.brief) + '</p>' +
      /* ⚠️ Пункты требований — HTML, как у уроков: так их пишут в
         js/projects.js, и tests/lessons.js [разметка] требует записывать
         показываемые теги сущностями (&lt;h1&gt;). До 1.142.0 здесь стоял
         esc(x) — сущность экранировалась второй раз, и ребёнок в проекте
         «Свой сайт» видел буквально «&lt;h1&gt;» вместо «<h1>». */
      (step.list ? '<ul>' + step.list.map(function(x){ return '<li>' + x + '</li>'; }).join("") + '</ul>' : '') +
      (i > 0 ? '<span class="bugtip">' + (step.starter !== undefined
          ? 'В редакторе — НОВАЯ редакция от напарника, а не твой код. Он что-то добавил и мог заодно сломать сделанное раньше: сравни с тем, что было, и почини.'
          : 'В редакторе — твой код с прошлого шага. Дописывай в него, а не начинай с нуля.') + '</span>' : '') +
      '</div>';

    var hints = '<div class="hintbox">' +
      '<button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
      '<button class="rbtn sec" id="solbtn">Показать решение шага</button>' +
      '<span class="tip">проект без звёзд — подсказки ничего не отнимают</span></div>' +
      '<div class="hintout" id="hintout"></div>';

    var pager = '<div class="pager"><button class="bigbtn ghost" data-go="world">← ' +
      (p.world === 0 ? "Ко всем заданиям" : "К миру " + p.world) + '</button></div>';

    A.app.innerHTML = head + goal +
      '<div class="draftnote" id="draftnote" hidden></div>' +
      '<div id="studio"></div>' + hints + pager;

    var studio = A.makeStudio({
      engine: "mini",
      code: startCode,
      label: "твоя программа",
      stdin: step.stdin || null,
      check: function(ed, showMsg){ runProjectCheck(p, i, ed, showMsg); }
    });
    document.getElementById("studio").appendChild(studio);
    A.session().studio = studio;

    var pdraft = A.draftGet(draftId);
    if (pdraft){
      A.draftApply(studio.editor, pdraft.files);
      var pnote = document.getElementById("draftnote");
      pnote.hidden = false;
      pnote.innerHTML = '<span>\u{1F4DD} В редакторе код с прошлого раза, а не то, с чего шаг начинался.</span>' +
        '<button class="rbtn sec" id="draftfresh">Начать шаг заново</button>';
      document.getElementById("draftfresh").onclick = function(){
        A.draftDrop(draftId);
        studio.editor.setCode(startCode);
        pnote.hidden = true;
        studio.editor.focusEditor();
      };
    }
    studio.editor.onEdit = A.draftSchedule;

    A.wireHint(step.hints);
    document.getElementById("solbtn").onclick = function(){
      A.session().shown = true;
      studio.editor.setCode(step.solution);
      studio.showMsg("warn", "<b>Вот программа на конец этого шага</b>Прочитай её и запусти. Звёзд в проекте нет — смотреть можно без потерь, но сначала попробуй сам.");
    };
    A.app.querySelectorAll('[data-go="world"]').forEach(function(b){
      b.onclick = function(){ if (p.world === 0) A.screenAILab(); else A.screenWorld(p.world); };
    });
    A.refreshTop();
    window.scrollTo({ top:0, behavior:"smooth" });
  });
}

/* проверка шага: вывод должен совпасть с выводом эталона этого шага */
function runProjectCheck(p, i, ed, showMsg){
  A.session().attempts++;
  var step = p.steps[i];
  var eng = Runtime.get("mini"), code = ed.getCode();
  if (step.needCode){
    for (var k = 0; k < step.needCode.length; k++){
      if (!A.codeHas(code, step.needCode[k])){
        showMsg("warn", "<b>Почти</b>" + (step.needMsg || "Не хватает нужной конструкции."));
        return;
      }
    }
  }
  /* Ответы на input() — из шага, одинаковые для кода ребёнка и эталона:
     без этого шаг с игрой (а игра ЖДЁТ хода) было бы не проверить вовсе. */
  var answers = (step.stdin || []).slice();
  var res = eng.run(code, { stdin: answers.slice() });
  if (res.error){ ed.setError(res.error.line); showMsg("bad", A.errHTML(res.error)); return; }
  var exp = eng.run(step.solution, { stdin: answers.slice() }).lines, got = res.lines;
  if (!(exp.length === got.length && exp.every(function(v, n){ return v === got[n]; }))){
    showMsg("bad", "<b>Ещё не то</b>" + A.diffBlock(exp, got));
    return;
  }
  winProjectStep(p, i, code);
}

function winProjectStep(p, i, code){
  var st = A.projectState(p.id);
  st.code = code;
  /* Дата шага и запись работы по шагу — для пакета к защите (1.142.0).
     Пишутся ОДИН раз, на первой сдаче, по тому же правилу, что запись
     авторства урока (lg.tr): повторная сдача не переписывает ни дату, ни то,
     как шаг был сделан впервые. Иначе достаточно пройти шаг ещё раз. */
  if (!st.stepsAt[i]) st.stepsAt[i] = Date.now();
  var ped = A.session() && A.session().studio && A.session().studio.editor;
  if (!st.tr[i] && ped && ped.trace){
    st.tr[i] = { at: Date.now(), typed: ped.trace.typed || 0, pasted: ped.trace.pasted || 0,
                 edits: ped.trace.edits || 0, shown: A.session().shown ? 1 : 0, hints: A.session().hints || 0 };
  }
  /* Шаг сдан — код уехал в st.code, черновик шага больше не нужен. Заготовку
     сессии подменяем на сданный код: иначе draftFlush при уходе на следующий
     шаг заведёт черновик заново, и он останется висеть навсегда. */
  A.draftDrop(A.projectDraftId(p.id, i));
  if (A.session() && A.session().project === p.id && A.session().pstep === i){
    A.session().starter = [{ name:"main.py", code: code }];
  }
  if (i + 1 > st.step) st.step = i + 1;
  var last = st.step >= p.steps.length;
  /* doneAt ставится ОДИН раз: это дата на сертификате, и она не должна
     переписываться, если проект потом откроют заново. */
  if (last && !st.done){ st.done = 1; st.doneAt = st.doneAt || Date.now(); A.award("builder"); }
  A.markActiveToday();          /* шаг проекта держит дневной стрик живым */
  A.save();

  var firstTry = A.session().attempts === 1 && A.session().hints === 0 && !A.session().shown;
  document.getElementById("wincard").innerHTML = last
    ? '<div class="big">🏆</div><h2>Проект собран!</h2>' +
      '<p>' + A.esc(p.finale) + '</p>' +
      '<div class="winrow"><button class="bigbtn" id="pfin">Посмотреть, что получилось</button>' +
      /* ⚠️ Проект мира — это и конец мира. Раньше в этот момент ребёнку
         показывали собранную программу и всё; на вопрос «что я теперь умею»
         не отвечал никто. Кнопка стоит второй, а не первой: сначала он хочет
         увидеть свою вещь, и отнимать у него эту минуту нельзя. */
      (A.worldGraduated(p.world)
        ? '<button class="bigbtn ghost" id="pgrad">🎓 Что я теперь умею</button>' : '') +
      '</div>'
    : '<div class="big">' + (firstTry ? "🎯" : "🧱") + '</div>' +
      '<h2>Шаг ' + (i + 1) + ' из ' + p.steps.length + ' готов</h2>' +
      '<p>' + A.esc(p.steps[i + 1].brief) + '</p>' +
      '<div class="winrow"><button class="bigbtn" id="pnext">Следующий шаг →</button>' +
      '<button class="bigbtn ghost" id="wstay">Остаться здесь</button></div>';
  document.getElementById("win").classList.add("show");
  A.confetti(last ? 3 : 1);
  var pn = document.getElementById("pnext");
  if (pn) pn.onclick = function(){ A.closeWin(); openProject(p.id, i + 1); };
  var pf = document.getElementById("pfin");
  if (pf) pf.onclick = function(){ A.closeWin(); screenProjectDone(p.id); };
  var pg = document.getElementById("pgrad");
  if (pg) pg.onclick = function(){ A.closeWin(); A.screenWorldDone(p.world); };
  var ws = document.getElementById("wstay");
  if (ws) ws.onclick = A.closeWin;
}

/* финал проекта: вся программа целиком, её можно запустить и забрать себе */
function screenProjectDone(id){
  var p = A.projectById(id);
  if (!p) return A.screenWorlds();
  A.enterScreen(undefined, "projectdone");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  var st = A.projectState(p.id);
  var code = st.code || p.steps[p.steps.length - 1].solution;

  var where2 = p.world === 0 ? "🤖 Ты и ИИ" : "Мир " + p.world;
  A.app.innerHTML =
    '<div class="crumbs"><span data-go="world">' + A.esc(where2) + '</span> › ' + p.emoji + ' ' + A.esc(p.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">' +
    (p.world === 0 ? "проект раздела «Ты и ИИ» собран" : "проект мира " + p.world + " собран") + '</div>' +
    '<h1>' + p.emoji + ' ' + A.esc(p.title) + '</h1></div>' +
    '<div class="right"><span class="tag">готово ✓</span></div></div>' +
    '<p class="lede">' + A.esc(p.finale) + '</p>' +
    '<div id="studio"></div>' +
    '<div class="pager"><button class="bigbtn" id="tosand">Забрать в песочницу</button>' +
    (p.kind === "game" ? '<button class="bigbtn" id="pshare">🔗 Отправить игру другу</button>' : '') +
    '<button class="bigbtn ghost" id="pdef">📁 Пакет к защите</button>' +
    '<button class="bigbtn ghost" id="pfolio">🎒 Все мои работы</button>' +
    '<button class="bigbtn ghost" id="pagain">Пройти заново</button><span class="sp"></span>' +
    '<button class="bigbtn ghost" data-go="world">← ' +
    (p.world === 0 ? "Ко всем заданиям" : "К миру " + p.world) + '</button></div>';

  /* Игра-проект на финале ИГРАЕТСЯ, а не просто показывается: у неё внутри
     input(), и кнопка «Запустить» без игрового режима падала бы на первом же
     ходе. Правишь код — «Новая игра» играет твою версию. */
  var studio = A.makeStudio({ engine: "mini", code: code, play: p.kind === "game",
                            label: "твоя программа целиком" });
  document.getElementById("studio").appendChild(studio);
  A.session().studio = studio;

  document.getElementById("tosand").onclick = function(){
    A.S().sandbox = studio.editor.getCode(); A.save(); A.screenSandbox();
  };
  var psh = document.getElementById("pshare");
  if (psh) psh.onclick = function(){
    /* уезжает ТЕКУЩИЙ код: поменял секретное слово — друг играет твою версию */
    A.copyText(A.playLink({ title: p.title, code: studio.editor.getCode(),
                        author: A.myName() || "", emoji: p.emoji }), psh);
  };
  document.getElementById("pfolio").onclick = A.screenFolio;
  document.getElementById("pdef").onclick = function(){ A.screenDefense(p.id); };
  document.getElementById("pagain").onclick = function(){
    var yes = true;
    try { yes = confirm("Начать проект заново? Пройденные шаги обнулятся, но код останется в редакторе."); } catch(e){}
    if (!yes) return;
    var s2 = A.projectState(p.id);
    s2.step = 0; s2.done = 0; s2.aiAt = -1;   /* редакции напарника подставятся заново */
    A.save(); openProject(p.id, 0);
  };
  A.app.querySelectorAll('[data-go="world"]').forEach(function(b){
    b.onclick = function(){ if (p.world === 0) A.screenAILab(); else A.screenWorld(p.world); };
  });
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}
return { openProject: openProject, screenProjectDone: screenProjectDone };
};
