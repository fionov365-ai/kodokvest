/* ============================================================
   Фионика — сертификаты: когда лист выдан, чего не хватает, текст листа
   и оверлей для печати.

   Отрезаны из app.js 15.09.2026 (архитектурный долг, § 2.5 RAZVITIE) вместе
   с экраном портфолио — но ОТДЕЛЬНЫМ файлом. Замер по именам (§ 4.54):
   сертификаты — 278 строк и 16 имён внутрь, экран портфолио — 287 строк и
   44 имени, из них 36 нужны только ему. Одним модулем договор был бы на 52
   имени и прятал бы чистую часть внутри перекрёстка; двумя — у сертификатов
   свой узкий договор. Их независимо от портфолио зовут выпускной мира
   (certWorldReady, openCert), печать и клавиша Esc (closeCert, certIsOpen)
   и Главное (certList).

   ⚠️ СОСТОЯНИЕ. Читается журнал уроков (S.log) — через A.S() в момент
   обращения. Пишется ОДНО своё поле: S.certAt — дата выдачи листа за раздел,
   ставится один раз (почему — в комментарии у certSectionAt).

   Не уехали, хотя стояли под тем же баннером: fmtDay (общий формат даты,
   им пользуется и пакет к защите) и карточка доступа (её зовут Главное,
   профиль и кабинеты — к сертификатам она попала соседством: печатается тем
   же оверлеем, но это не сертификат).

   Шапка, какой она была в app.js:
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.certs = function(A){

/*    Проектов шесть, и каждый — законченная программа, написанная ребёнком.
   По отдельности они разбросаны по мирам; здесь собраны в одном месте
   вместе со сводкой и сертификатами. Это единственный экран, сделанный
   не для занятий, а для ПОКАЗА: родителям, учителю, кому угодно.

   Про сертификат важно одно: он выдаётся не за «прошёл уроки», а за уроки
   ПЛЮС собранный проект мира. Сертификат без сделанной вещи — бумажка,
   и ребёнок это чувствует раньше взрослых.

   Своего прогресса раздел не заводит: и сводка, и сертификаты считаются
   из S.stars, S.log и S.projects. Единственная добавка — projects[id].doneAt,
   дата сборки проекта: без неё дата на сертификате менялась бы при каждом
   открытии, а такому «документу» грош цена.
   ============================================================ */

function worldSolvedCount(n){
  var w = CURRICULUM.world(n), c = 0;
  if (w) w.lessons.forEach(function(l){ if (A.solved(l.id)) c++; });
  return c;
}
function worldStars(n){
  var w = CURRICULUM.world(n), s = 0;
  if (w) w.lessons.forEach(function(l){ s += A.starsOf(l.id); });
  return s;
}
function worldWhole(n){
  var w = CURRICULUM.world(n);
  return !!w && w.lessons.length > 0 && worldSolvedCount(n) === w.lessons.length;
}

/* сертификат мира: все уроки мира пройдены И проект мира собран */
function certWorldReady(n){
  var p = A.projectOfWorld(n);
  return worldWhole(n) && !!p && A.projectDone(p.id);
}
function certCourseReady(){
  if (!CURRICULUM.length) return false;
  for (var i = 0; i < CURRICULUM.length; i++)
    if (!certWorldReady(CURRICULUM[i].n)) return false;
  return true;
}
/* дата выдачи: самое позднее из «последний урок мира пройден» и «проект собран».
   Дату берём из журнала, а не из текущего дня — иначе сертификат «переписывался»
   бы при каждом открытии. */
function certWorldAt(n){
  var w = CURRICULUM.world(n), t = 0;
  if (!w) return 0;
  w.lessons.forEach(function(l){
    var g = A.S().log[l.id] || {};
    if ((g.solvedAt || 0) > t) t = g.solvedAt;
  });
  var p = A.projectOfWorld(n);
  if (p){ var d = A.projectState(p.id).doneAt || 0; if (d > t) t = d; }
  return t;
}
function certCourseAt(){
  var t = 0;
  CURRICULUM.forEach(function(w){ var x = certWorldAt(w.n); if (x > t) t = x; });
  return t;
}
/* чего не хватает до сертификата — словами, без «выполнено 60%» */
function certWorldNeed(n){
  var w = CURRICULUM.world(n), p = A.projectOfWorld(n), bits = [];
  var left = w ? w.lessons.length - worldSolvedCount(n) : 0;
  if (left > 0) bits.push(left + " " + A.plural(left, "урок", "урока", "уроков"));
  if (p && !A.projectDone(p.id)) bits.push("проект «" + p.title + "»");
  return bits.length ? "Осталось: " + bits.join(" и ") + "." : "";
}
function certCourseNeed(){
  var left = 0;
  CURRICULUM.forEach(function(w){ if (!certWorldReady(w.n)) left++; });
  return left ? ("Осталось миров: " + left + " из " + CURRICULUM.length + ".") : "";
}

/* ---- сертификаты за разделы вне сотни ----
   Устроены как у миров: задания раздела ПЛЮС его проект, если он есть.
   Отличие одно, и оно в дате. У урока есть solvedAt в журнале, а разминка и
   задание «Ты и ИИ» отмечались единицей, без времени, — восстановить задним
   числом нечего. Поэтому дату выдачи ЗАПОМИНАЕМ в S.certAt в тот момент,
   когда раздел закрылся, и больше не трогаем: сертификат, распечатанный
   сегодня и через месяц, обязан быть одним и тем же листом. */
var WARM_KIND = { predict:"угадай вывод", blocks:"собери из блоков", memory:"предскажи память" };
var SECTION_CERTS = [
  { id:"warmups", icon:"🧩", title:"Разминка пройдена целиком",
    what:"Разминка",
    all: function(){ return A.warmupsList().length; },
    done: function(){
      return A.warmupsList().filter(function(x){ return A.warmupDone(x.id); }).length;
    },
    unit: ["разминка", "разминки", "разминок"],
    line: function(d, t){
      /* Перечень механик считаем по самим разминкам, а не пишем строкой:
         добавится шестой тип — лист соврёт, и заметить это будет некому. */
      var seen = [], ok = 1;
      A.warmupsList().forEach(function(x){
        var nm = WARM_KIND[x.type];
        if (!nm){ ok = 0; return; }
        if (seen.indexOf(nm) < 0) seen.push(nm);
      });
      var tail = (ok && seen.length)
        ? ' — ' + seen.map(function(n){ return '«' + n + '»'; }).join(", ") + '.'
        : '.';
      return 'Раздел «Разминка» пройден целиком: <b>' + d + ' из ' + t + '</b> ' +
        A.plural(t, "упражнения", "упражнений", "упражнений") + tail;
    } },
  { id:"ailab", icon:"🤖", title:"Раздел «Ты и ИИ» пройден",
    what:"Ты и ИИ",
    all: function(){ return A.ailabList().length; },
    done: function(){
      return A.ailabList().filter(function(x){ return A.ailabDone(x.id); }).length;
    },
    unit: ["задание", "задания", "заданий"],
    project: 0,
    line: function(d, t){
      var p = A.projectOfWorld(0);
      return 'Раздел «Ты и ИИ» пройден полностью: <b>' + d + ' из ' + t + '</b> ' +
        A.plural(t, "задание", "задания", "заданий") +
        (p ? ', проект «' + A.esc(p.title) + '» собран' : '') +
        '. Проверялось не умение писать код, а умение спорить с ИИ и находить его ошибки.';
    } },
  { id:"web", icon:"🌐", title:"Раздел «HTML и CSS» пройден",
    what:"HTML и CSS",
    all: function(){ return (window.WEB_TASKS || []).length; },
    done: function(){
      return (window.WEB_TASKS || []).filter(function(x){ return A.algoDone(x.id); }).length;
    },
    unit: ["задание", "задания", "заданий"],
    line: function(d, t){
      return 'Раздел «HTML и CSS» пройден целиком: <b>' + d + ' из ' + t + '</b> ' +
        A.plural(t, "задания", "заданий", "заданий") +
        ' — от первого тега до страницы с раскладкой. Каждую страницу проверял браузер.';
    } }
];
function sectionCert(id){
  for (var i = 0; i < SECTION_CERTS.length; i++)
    if (SECTION_CERTS[i].id === id) return SECTION_CERTS[i];
  return null;
}
function certSectionReady(id){
  var c = sectionCert(id);
  if (!c || !c.all()) return false;
  if (c.done() !== c.all()) return false;
  if (c.project !== undefined){
    var p = A.projectOfWorld(c.project);
    if (!p || !A.projectDone(p.id)) return false;
  }
  return true;
}
/* Дата выдачи. Ставится один раз — в момент, когда раздел закрылся. Если
   раздел закрыли ДО того, как сертификаты появились, ставим сейчас: это
   честно, лист и правда выдан сегодня, а выдумывать прошлую дату нельзя. */
function certSectionAt(id){
  if (!certSectionReady(id)) return 0;
  A.S().certAt = A.S().certAt || {};
  if (!A.S().certAt[id]){ A.S().certAt[id] = Date.now(); A.save(); }
  return A.S().certAt[id];
}
function certSectionNeed(id){
  var c = sectionCert(id);
  if (!c) return "";
  var bits = [], left = c.all() - c.done();
  if (left > 0) bits.push(left + " " + A.plural(left, c.unit[0], c.unit[1], c.unit[2]));
  if (c.project !== undefined){
    var p = A.projectOfWorld(c.project);
    if (p && !A.projectDone(p.id)) bits.push("проект «" + p.title + "»");
  }
  return bits.length ? "Осталось: " + bits.join(" и ") + "." : "";
}

function certList(){
  var out = [];
  CURRICULUM.forEach(function(w){
    out.push({
      id: "world" + w.n, kind: w.n, icon: w.icon,
      title: "Мир " + w.n + ": " + w.title,
      ready: certWorldReady(w.n), at: certWorldAt(w.n), need: certWorldNeed(w.n)
    });
  });
  SECTION_CERTS.forEach(function(c){
    out.push({
      id: c.id, kind: c.id, icon: c.icon, title: c.title, section: 1,
      ready: certSectionReady(c.id), at: certSectionAt(c.id), need: certSectionNeed(c.id)
    });
  });
  /* «Курс целиком» стоит последним намеренно: это главный лист, и он не должен
     теряться между сертификатами за разделы. */
  out.push({
    id: "course", kind: "course", icon: "🏆", title: "Путь пройден целиком",
    ready: certCourseReady(), at: certCourseAt(), need: certCourseNeed()
  });
  return out;
}


/* Текст сертификата написан безлично («пройден», а не «прошёл»): курс учат
   и мальчики, и девочки, а угадывать род по имени — плохая идея. */
function certBodyHTML(kind){
  var sect = sectionCert(kind);
  var course = kind === "course";
  var w = (course || sect) ? null : CURRICULUM.world(kind);
  var p = (course || sect) ? null : A.projectOfWorld(kind);
  var at = sect ? certSectionAt(kind) : (course ? certCourseAt() : certWorldAt(kind));
  var stars = 0, top = 0, what = "";

  if (sect){
    what = sect.line(sect.done(), sect.all());
  } else if (course){
    CURRICULUM.forEach(function(x){ stars += worldStars(x.n); });
    top = CURRICULUM.total * 3;
    var names = [];
    CURRICULUM.forEach(function(x){
      var pr = A.projectOfWorld(x.n);
      if (pr) names.push("«" + pr.title + "»");
    });
    what = 'Путь по «Фионике» пройден целиком: <b>' + CURRICULUM.total + " " +
      A.plural(CURRICULUM.total, "урок", "урока", "уроков") + '</b> и <b>' + names.length + " " +
      A.plural(names.length, "собранный проект", "собранных проекта", "собранных проектов") + '</b>.' +
      (names.length ? '<span class="certlist">' + A.esc(names.join(", ")) + '</span>' : '');
  } else {
    stars = worldStars(kind);
    top = (w ? w.lessons.length : 0) * 3;
    what = 'Мир ' + kind + ' «' + A.esc(w ? w.title : "") + '» пройден полностью: <b>' +
      (w ? w.lessons.length : 0) + " из " + (w ? w.lessons.length : 0) + '</b> ' +
      A.plural(w ? w.lessons.length : 0, "урок", "урока", "уроков") +
      (p ? ', проект «' + A.esc(p.title) + '» собран' : '') + '.';
  }

  var name = A.myName();
  /* Звёзд в разделах вне сотни нет — и рисовать «★ 0 из 0» на листе нельзя.
     Вместо счёта звёзд у раздела стоит счёт сделанного. */
  var tally = sect
    ? '<div class="certstars">' + sect.icon + ' ' + sect.done() + ' из ' + sect.all() + '</div>'
    : '<div class="certstars">★ ' + stars + ' из ' + top + '</div>';
  /* ⚠️ Лист за весь путь называется «Путь пройден» (решение фаундера
     13.09.2026; с 11.09.2026 было «Курс пройден», до того — «Сертификат об
     окончании курса»). «Курс» ушёл вслед за «окончанием»: слово ближе к
     «образовательной программе», а её мы не реализуем — на этом и стоит
     «лицензия не нужна» (docs/licenziya-proverka-2026-09-13.md). Старая надпись была единственной
     строкой продукта, которая сама объявляла себя документом об обучении, —
     а лицензия нам не нужна ровно потому, что мы даём доступ к программе, а не
     обучение с документом на выходе. Отсюда же мелкая строка внизу листа.
     Разбор: vitrina-litsenziya-napravleniya-2026-09-09.md § 1.3. */
  return '<div class="certsheet">' +
    '<div class="certmark">🐍 Фионика</div>' +
    '<div class="certkind">' + (course ? "Путь пройден" : "Сертификат") + '</div>' +
    '<div class="certname">' + A.esc(name || "Ученик Фионики") + '</div>' +
    '<div class="certrule"></div>' +
    '<div class="certwhat">' + what + '</div>' +
    tally +
    '<div class="certfoot"><span>Выдан ' + A.fmtDay(at) + '</span>' +
    '<span>Python с нуля · без установки · в браузере</span></div>' +
    '<div class="certlegal">Не является документом об образовании</div>' +
  '</div>';
}

/* Сертификат живёт ОВЕРЛЕЕМ, как шпаргалка: его печатают, а печать берёт
   документ целиком. В @media print всё, кроме листа, скрыто. */
function openCert(kind){
  var el = document.getElementById("cert"), box = document.getElementById("certbox");
  if (!el || !box) return;
  box.innerHTML = certBodyHTML(kind);
  el.hidden = false;
}
function closeCert(){
  var el = document.getElementById("cert");
  if (el) el.hidden = true;
}
function certIsOpen(){
  var el = document.getElementById("cert");
  return !!el && !el.hidden;
}

return { certList: certList, certWorldReady: certWorldReady,
         openCert: openCert, closeCert: closeCert, certIsOpen: certIsOpen,
         SECTION_CERTS: SECTION_CERTS, certBodyHTML: certBodyHTML,
         certCourseAt: certCourseAt, certCourseNeed: certCourseNeed, certCourseReady: certCourseReady,
         certSectionAt: certSectionAt, certSectionNeed: certSectionNeed, certSectionReady: certSectionReady,
         certWorldAt: certWorldAt, certWorldNeed: certWorldNeed,
         worldSolvedCount: worldSolvedCount, worldStars: worldStars, worldWhole: worldWhole };
};
