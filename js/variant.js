/* ============================================================
   Кодоквест — пробный вариант экзамена целиком.

   ЗАЧЕМ. До 08.09.2026 задачи лежали только по темам, и пройти «весь экзамен
   подряд, как в мае» нельзя было ни одним способом. А ищут родители именно
   это: тренажёров «по темам» много, а «пройди вариант и увидь, где просело» —
   то, ради чего подготовку вообще покупают. Собрать вариант стало можно ровно
   в тот день, когда карта ЕГЭ закрылась целиком (27 заданий из 27), и это не
   совпадение: вариант — не новые задачи, а СБОРКА из уже готовых, и до
   закрытия карты в нём зияли бы дыры на каждом третьем номере.

   ⚠️ ЧЕГО ЗДЕСЬ НЕТ И НЕ БУДЕТ: первичного балла и перевода в экзаменационные
   баллы. Шкала перевода меняется каждый год, и наврать в ней — то же самое,
   что наврать в нумерации заданий: родитель узнает об этом в мае. Поэтому
   итог говорит только проверяемое — какие номера закрыты, а какие нет.

   КАК СОБИРАЕТСЯ. Идём по заданиям экзамена в их порядке (js/exams.js) и на
   каждый номер берём одну нашу задачу из тех групп, которыми этот номер
   закрыт. Правила ровно три:
     1. одна задача — на один номер: повторов внутри варианта избегаем;
     2. если незанятых задач в группах не осталось — берём занятую и честно
        помечаем строку. Это и есть встроенный замер наполнения: повтор в
        варианте значит «в этой теме задач меньше, чем номеров»;
     3. номер, которого мы не закрываем, из варианта НЕ выбрасывается. Он
        стоит на своём месте с той же причиной, что и на карте экзамена:
        выкинутая строка — враньё умолчанием, а на настоящем экзамене этот
        номер всё равно будет.

   ⚠️ ПРО СЕМЯ (seed) — оно здесь не украшение. Сборка — чистая функция от
   (экзамен, семя): по одному и тому же коду на любом устройстве соберётся
   один и тот же вариант. Это заготовка под следующий шаг списка — «вариант,
   назначенный репетитором всей группе»: репетитору хватит продиктовать код,
   и никакой пересылки заданий не понадобится. Именно поэтому сборка НЕ
   смотрит, что ребёнок уже решал: вариант обязан быть одинаковым для всех,
   как на экзамене.

   ⚠️ ПРО ЗАЧЁТ. Номер считается закрытым, только если задача решена ВНУТРИ
   этого варианта. Засчитывать заранее решённое было бы удобно и бесполезно:
   вариант нужен, чтобы измерить сегодняшнее состояние, а не пересказать
   историю. Поэтому S.algo (общий список решённых) здесь не спрашивается
   вовсе — он живёт своей жизнью и пополняется как обычно.

   Договор с app.js — в шапке js/screens-showcase.js. Отсюда наружу торчит
   один экран и одна справка о его состоянии.
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.variant = function(A){

/* Буквы кода варианта: без похожих друг на друга (0/O, 1/I), потому что код
   диктуют голосом и переписывают от руки. */
var CODE_ABC = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function newSeed(){
  var s = "";
  for (var i = 0; i < 6; i++)
    s += CODE_ABC.charAt(Math.floor(Math.random() * CODE_ABC.length));
  return s;
}
/* Поток чисел из кода. Годится любой воспроизводимый: важно только, чтобы
   одно семя всегда давало одну последовательность — на этом держится
   обещание «по коду соберётся тот же вариант». */
function rngFrom(seed){
  var h = 2166136261;
  for (var i = 0; i < seed.length; i++){
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function(){
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h |= 0;
    return (h >>> 0) / 4294967296;
  };
}

function examById(id){ return (window.EXAMS || {})[id] || null; }
/* Наши задачи перечисленных групп, в устойчивом порядке. Порядок обязан быть
   устойчивым, иначе одно и то же семя собирало бы разные варианты после
   любой правки списка задач. */
function tasksIn(groups){
  return A.algoList().filter(function(x){ return groups.indexOf(x.group) >= 0; })
                     .map(function(x){ return x.id; }).sort();
}

/* ---- сборка ----
   Возвращает список строк варианта: по одной на каждое задание экзамена.
   id === null значит «этого мы не даём», и рядом лежит причина. */
function buildItems(exId, seed){
  var ex = examById(exId);
  if (!ex) return [];
  var rnd = rngFrom(String(seed || "") + ":" + exId), used = {};
  return ex.tasks.map(function(t){
    var pool = (t.g && t.g.length) ? tasksIn(t.g) : [];
    if (!pool.length)
      return { n: t.n, t: t.t, id: null, dup: 0,
               why: t.off ? ("судить нечем: " + t.off) : "задач по этой теме пока нет" };
    var free = pool.filter(function(id){ return !used[id]; });
    var dup = free.length ? 0 : 1;
    var from = free.length ? free : pool;
    var id = from[Math.floor(rnd() * from.length) % from.length];
    used[id] = 1;
    /* off вместе с задачами — то самое четвёртое состояние карты (ОГЭ 14):
       половину задания мы закрываем, половину нет, и молчать об этом нельзя. */
    return { n: t.n, t: t.t, id: id, dup: dup, why: t.off ? ("кроме: " + t.off) : "" };
  });
}

function makeVariant(exId){
  var seed = newSeed();
  return { ex: exId, seed: seed, at: Date.now(), endAt: 0,
           items: buildItems(exId, seed), done: {}, seen: {} };
}
/* Живой вариант из сохранения. Пустой объект (так поле выглядит у нового
   ученика) — это «варианта нет», а не сломанный вариант. */
function cur(){
  var v = A.variantGet();
  if (!v || !v.ex || !Array.isArray(v.items) || !v.items.length) return null;
  if (!examById(v.ex)) return null;
  return v;
}
/* Свод по варианту. Считается, а не хранится, — по той же причине, по которой
   считается свод карты экзамена: хранимое число разойдётся с делом в первый
   же день. */
function tally(v){
  var t = { total: v.items.length, able: 0, done: 0, tried: 0, left: 0, dup: 0, weak: [] };
  v.items.forEach(function(x){
    if (x.dup) t.dup++;
    if (!x.id) return;
    t.able++;
    if (v.done[x.n]) { t.done++; return; }
    if (v.seen[x.n]) { t.tried++; t.weak.push(x.n); }
    else t.left++;
  });
  return t;
}
function itemOf(v, n){
  for (var i = 0; i < v.items.length; i++) if (v.items[i].n === n) return v.items[i];
  return null;
}
/* Список номеров словами: «24 и 25», «17, 24 и 25». Запятая перед последним
   номером читается как ещё один номер, поэтому там «и». */
function numsRu(list){
  if (!list.length) return "";
  if (list.length === 1) return String(list[0]);
  return list.slice(0, -1).join(", ") + " и " + list[list.length - 1];
}

/* ---- строка варианта ---- */
function rowHTML(v, x, task){
  var st, right;
  if (!x.id){
    st = "no";
    right = '<span class="exwhy">' + A.esc(x.why) + '</span>';
  } else if (v.done[x.n]){
    st = "yes";
    right = '<span class="excnt">решено ✓</span>' +
      '<button class="rbtn sec" data-vgo="' + x.n + '">Открыть снова</button>';
  } else {
    st = v.seen[x.n] ? "part" : "soon";
    right = (v.seen[x.n] ? '<span class="excnt">начато</span>' : "") +
      (x.why ? '<span class="exwhy">' + A.esc(x.why) + '</span>' : "") +
      '<button class="rbtn ' + (v.seen[x.n] ? "sec" : "check") + '" data-vgo="' + x.n + '">Решать</button>';
  }
  return '<div class="exrow ' + st + '"><span class="exn">' + x.n + '</span>' +
    '<span class="ext">' + A.esc(x.t) +
      (task ? '<span class="vartask">' + task.emoji + " " + A.esc(task.title) +
              (x.dup ? ' · <b>повтор темы</b>' : "") + '</span>' : "") +
    '</span>' +
    '<span class="exact">' + right + '</span></div>';
}

/* Собрать новый вариант и открыть его. ⚠️ Единственное место, где вариант
   заводится: спросить «а не потеряется ли начатое» надо один раз и здесь,
   иначе кнопка на карте экзамена молча стёрла бы работу, начатую вчера. */
function startVariant(exId){
  var v = cur();
  if (v){
    var t = tally(v);
    if (t.done + t.tried > 0){
      var ex = examById(v.ex), yes = true;
      /* Спрашиваем через try: окна подтверждения нет ни в проверках, ни в
         некоторых встроенных браузерах, и падать на этом сборке нельзя. */
      try {
        yes = confirm("Сейчас идёт вариант " + ex.title + " № " + v.seed + ": решено " +
          t.done + " из " + t.able + ". Собрать новый? Этот не сохранится — сами задачи " +
          "останутся решёнными в разделе «Алгоритмы».");
      } catch(e){}
      if (!yes) return screenVariant();
    }
  }
  A.variantSet(makeVariant(exId));
  screenVariant();
}
/* Дверь с карты экзамена: свой вариант этого экзамена открываем, чужой или
   отсутствующий — собираем (со всеми вопросами, что задаёт startVariant). */
function openFor(exId){
  var v = cur();
  if (v && v.ex === exId) return screenVariant();
  startVariant(exId);
}

/* ---- экран: выбрать экзамен ---- */
function screenPick(){
  A.enterScreen("train", "variant");
  A.setAlgoBack(null);
  var h = '<div class="lvlhead"><div><div class="idx">пробный вариант</div>' +
    '<h1>📝 Вариант целиком</h1></div>' +
    '<div class="right">' + A.qm("variant", "Что такое пробный вариант") + '</div></div>' +
    '<p class="lede">Задачи в разделе «Алгоритмы, ОГЭ и ЕГЭ» разложены по темам — это удобно, ' +
    'когда учишь одну тему. Экзамен так не устроен: там задания идут подряд, по номерам, и ' +
    'каждое про своё. Вариант собирает такой же порядок из наших задач: по одной на каждый номер.</p>';

  h += '<div class="card"><h3>Как это устроено</h3><ul class="trrules">' +
    '<li><b>Один номер — одна задача.</b> Порядок как на экзамене, с первого номера до последнего.</li>' +
    '<li><b>Решать можно с любого места и в любой день.</b> Вариант никуда не денется: ' +
    'закрыл вкладку — он останется на месте вместе с решённым.</li>' +
    '<li><b>Номера, которых мы не даём, из варианта не выкинуты.</b> Против каждого написано ' +
    'почему: на экзамене этот номер всё равно будет.</li>' +
    '<li><b>Баллов здесь нет.</b> Шкала перевода в экзаменационные баллы меняется каждый год, ' +
    'и обещать её мы не будем. Итог говорит проверяемое: какие номера закрыты, а какие нет.</li>' +
    '</ul></div>';

  h += '<div class="vexams">';
  ["ege", "oge"].forEach(function(id){
    var ex = examById(id);
    if (!ex) return;
    var able = buildItems(id, "PROBE").filter(function(x){ return x.id; }).length;
    h += '<div class="card"><h3>' + ex.em + " " + A.esc(ex.full) + '</h3>' +
      '<p class="dim">' + ex.total + ' заданий по нумерации ' + ex.year + ' года. ' +
      'Задачи у нас есть на <b>' + able + '</b> из них.</p>' +
      '<div class="admrow"><button class="bigbtn" data-vnew="' + id + '">Собрать вариант</button></div></div>';
  });
  h += '</div>';

  h += '<div class="pager"><button class="bigbtn ghost" id="tovtrain">← К тренировкам</button></div>';
  A.app.innerHTML = h;
  A.app.querySelectorAll("[data-vnew]").forEach(function(b){
    b.onclick = function(){ startVariant(b.getAttribute("data-vnew")); };
  });
  document.getElementById("tovtrain").onclick = A.screenTrain;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ---- экран: сам вариант ---- */
function screenVariant(){
  var v = cur();
  if (!v) return screenPick();
  A.enterScreen("train", "variant");
  A.setAlgoBack(null);
  var ex = examById(v.ex), t = tally(v);

  var h = '<div class="lvlhead"><div><div class="idx">пробный вариант · ' + A.esc(ex.full) + '</div>' +
    '<h1>📝 Вариант № ' + A.esc(v.seed) + '</h1></div>' +
    '<div class="right"><span class="tag">' + t.done + ' из ' + t.able + '</span>' +
    A.qm("variant", "Что такое пробный вариант") + '</div></div>' +
    '<p class="lede">Задания идут по номерам, как на экзамене. Решать можно в любом порядке ' +
    'и в любой день — сделанное сохраняется. Подсказки и проверка работают как обычно: ' +
    'это тренировка, а не контрольная.</p>' +
    '<div class="extally">' +
      '<span class="exok">✓ решено: ' + t.done + '</span>' +
      '<span class="expart">◐ начато: ' + t.tried + '</span>' +
      '<span class="exsoon">◻ не открывал: ' + t.left + '</span>' +
      '<span class="exno">— не даём: ' + (t.total - t.able) + '</span></div>';

  h += '<div class="exmap">';
  v.items.forEach(function(x){ h += rowHTML(v, x, x.id ? A.algoById(x.id) : null); });
  h += '</div>';

  /* ⚠️ Та же оговорка, что на карте ОГЭ, и здесь она нужнее: в варианте
     номер 15 стоит один, а на экзамене он даётся ПО ВЫБОРУ — программой
     (15.2) или «Роботом» (15.1). Промолчать значит показать половину
     задания как всё задание. */
  if (v.ex === "oge")
    h += '<div class="note"><b>Задание 15 — это две задачи по выбору</b>' +
      'В варианте стоит 15.2 — обычная программа. Второй вариант того же номера, 15.1, ' +
      'решается исполнителем «Робот» с русскими командами: у него свой язык и свой раздел ' +
      'в «Тренировках». Выбирают на экзамене одно из двух.</div>';

  if (t.dup)
    h += '<div class="note"><b>Повторы в варианте — это про нас, а не про тебя</b>' +
      'В ' + t.dup + ' ' + A.plural(t.dup, "номере", "номерах", "номерах") + ' стоит задача, ' +
      'которая в этом варианте уже встречалась: задач по этой теме у нас пока меньше, чем ' +
      'номеров. Так и должно быть видно — это наш список дел, а не твоя ошибка.</div>';

  h += '<div class="pager"><button class="bigbtn" id="vdone">Показать итог</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="vnew">Собрать другой вариант</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="tovtrain">← К тренировкам</button></div>';
  A.app.innerHTML = h;

  A.app.querySelectorAll("[data-vgo]").forEach(function(b){
    b.onclick = function(){ openItem(parseInt(b.getAttribute("data-vgo"), 10)); };
  });
  document.getElementById("vdone").onclick = screenVariantDone;
  /* ⚠️ Пересборка спрашивает подтверждения: она стирает сделанное в этом
     варианте, а кнопка стоит рядом с «Показать итог». Разница между ними на
     вид в одно слово, а по последствиям — во всё. */
  document.getElementById("vnew").onclick = function(){ startVariant(v.ex); };
  document.getElementById("tovtrain").onclick = A.screenTrain;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ---- задача из варианта ----
   Открывается обычным экраном задачи: другой экран для того же задания значил
   бы вторую проверку и вторую подсказку, а расходиться им нельзя. Меняется
   только дорога назад — она ведёт в вариант, а не в общий список. */
function openItem(n){
  var v = cur();
  if (!v) return screenPick();
  var x = itemOf(v, n);
  if (!x || !x.id) return screenVariant();
  v.seen[n] = 1;
  A.variantSet(v);
  A.setAlgoBack({
    crumb: "Вариант № " + v.seed,
    backLabel: "В вариант",
    winLabel: "← Вернуться в вариант",
    go: screenVariant,
    onWin: function(){
      var w = cur();
      if (!w) return;
      w.done[n] = Date.now();
      A.variantSet(w);
    }
  });
  A.openAlgo(x.id);
}

/* ---- экран: итог ---- */
function screenVariantDone(){
  var v = cur();
  if (!v) return screenPick();
  A.enterScreen("train", "variant");
  A.setAlgoBack(null);
  var ex = examById(v.ex), t = tally(v);
  var notOpened = v.items.filter(function(x){ return x.id && !v.done[x.n] && !v.seen[x.n]; })
                         .map(function(x){ return x.n; });

  var h = '<div class="lvlhead"><div><div class="idx">итог варианта № ' + A.esc(v.seed) + '</div>' +
    '<h1>' + ex.em + ' ' + A.esc(ex.title) + ': что закрыто</h1></div>' +
    '<div class="right">' + A.qm("variant", "Что такое пробный вариант") + '</div></div>';

  h += '<div class="card"><h3>Закрыто ' + t.done + ' ' +
    A.plural(t.done, "задание", "задания", "заданий") + ' из ' + ex.total + '</h3>' +
    /* Второе число нужно только тогда, когда оно ДРУГОЕ: у ЕГЭ мы даём все
       27 номеров, и «закрыто 1 из 27, а из наших — 1 из 27» читается как
       ошибка счёта. У ОГЭ разница настоящая, и там она обязана стоять. */
    (t.able < t.total
      ? '<p>Это все номера экзамена, включая те, которых мы не даём. Из тех, что у нас есть, ' +
        'закрыто <b>' + t.done + '</b> из <b>' + t.able + '</b>.</p>'
      : '<p>Это все номера экзамена: задачи у нас есть на каждый.</p>') +
    (t.weak.length
      ? '<p>⚠️ <b>Просело на ' + numsRu(t.weak) + '</b> — эти задания ты открывал, но не сдал. ' +
        'С них и стоит начать в следующий раз.</p>'
      : (t.done ? '<p>Сдано всё, что открывал. ✓</p>' : "")) +
    /* ⚠️ Длинный список номеров не читается: двадцать шесть цифр подряд — это
       шум, в котором тонет и то, что закрыто. Перечисляем, пока перечисление
       ещё что-то говорит; дальше честнее одно число. */
    (notOpened.length
      ? '<p class="dim">' + (notOpened.length > 6
          ? "Не открывал ещё " + notOpened.length + " " +
            A.plural(notOpened.length, "номер", "номера", "номеров") + "."
          : "Не открывал: " + numsRu(notOpened) + ".") + '</p>'
      : "") +
    '</div>';

  /* ⚠️ Эта карточка стоит не для красоты и убирать её нельзя. Ровно здесь
     родитель ждёт число «сколько баллов», и ровно здесь любой тренажёр это
     число выдумывает. Мы не выдумываем — и говорим, почему. */
  h += '<div class="card"><h3>⚖️ Почему тут нет баллов</h3>' +
    '<p>Шкала перевода в экзаменационные баллы меняется каждый год, и она не наша: ' +
    'её объявляет тот, кто проводит экзамен. Назвать число, которого мы не знаем, ' +
    'значит соврать в единственном месте, где враньё выяснится в мае.</p>' +
    '<p class="dim">Поэтому итог здесь такой, каким мы можем за него отвечать: какие номера ' +
    'закрыты, какие просели, какие ты ещё не открывал. Настоящие баллы за такой вариант ' +
    'скажет только демоверсия своего года.</p></div>';

  var weakRows = v.items.filter(function(x){ return x.id && !v.done[x.n]; });
  if (weakRows.length){
    h += '<div class="sect"><h2>Что осталось</h2><div class="line"></div>' +
      '<span class="cnt">' + weakRows.length + '</span></div><div class="exmap">';
    weakRows.forEach(function(x){ h += rowHTML(v, x, A.algoById(x.id)); });
    h += '</div>';
  }

  h += '<div class="pager"><button class="bigbtn" id="vback">← Вернуться в вариант</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="tovtrain">К тренировкам</button></div>';
  A.app.innerHTML = h;
  A.app.querySelectorAll("[data-vgo]").forEach(function(b){
    b.onclick = function(){ openItem(parseInt(b.getAttribute("data-vgo"), 10)); };
  });
  document.getElementById("vback").onclick = screenVariant;
  document.getElementById("tovtrain").onclick = A.screenTrain;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* Короткая справка для карточки в «Тренировках»: вариант либо идёт, либо его
   нет. Считается из того же свода, что и экран, — второго счёта не заводим. */
function variantStat(){
  var v = cur();
  if (!v) return "";
  var ex = examById(v.ex), t = tally(v);
  return ex.title + ": решено " + t.done + " из " + t.able;
}

return { screenVariant: screenVariant, screenVariantDone: screenVariantDone,
         variantStat: variantStat, variantOpenFor: openFor,
         buildItems: buildItems, makeVariant: makeVariant };
};
