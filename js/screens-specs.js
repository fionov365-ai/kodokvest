/* ============================================================
   Фионика — «Приёмка»: нотация приёмки, её судья и экраны раздела.

   Отрезана из app.js 18.09.2026 (архитектурный долг, § 2.5 RAZVITIE) по
   договору из шапки js/screens-showcase.js.

   ЗАМЕР ПЕРЕД РАЗРЕЗОМ (§ 4.54, tools/zamer.js). Раздел ОДНИМ куском, 431
   строка, и связан слабее всех оставшихся: внутрь 15 имён, наружу 11, из
   которых продукту нужны четыре (screenSpecs — «Ты и ИИ», Главное и дорога
   назад; specsList и specDone — два счётчика: карточка Главного и строка
   «чему он учится про ИИ» в кабинете взрослого), остальные семь — судья,
   разбор нотации и виды правил — только тесту.

   ⚠️ ДАННЫЕ УЕХАЛИ ВМЕСТЕ С ЭКРАНОМ, в отличие от домашки (1.146.0) и
   разминки (1.183.0): снаружи о приёмке спрашивают только «сколько принято
   из скольких», а сам банк заданий лежит в js/specs.js и сюда не входит.
   Судья же (specParse → specToPython → specRunAll → specVerdict) — это и
   есть раздел: нотация без судьи вырождается в «спроси у ИИ, правильно ли».

   ⚠️ СОСТОЯНИЕ. Свой слот прогресса — S.specs, пишется здесь же через
   A.S() и A.save() (это собственные данные раздела, а не общий слой).
   Сессия — A.session() и A.newSession(v) (§ 4.5).
   ⚠️ ДВЕРИ. «Ты и ИИ» (js/screens-ailab.js) брал screenSpecs, specsList и
   specDone ЗНАЧЕНИЕМ: его договор стоит на тысячу строк выше — теперь
   обёртками (§ 4.40).
   ============================================================ */
window.KVSCREENS = window.KVSCREENS || {};
KVSCREENS.specs = function(A){

/* ================= нотация приёмки =================
   Ставка из docs/foresight-2027.md § 6.3–6.5, и единственная, которая даёт
   одновременно новый жанр обучения и причину, по которой его нельзя
   скопировать: нотация без судьи вырождается в «спроси у ИИ, правильно ли», а
   судья есть только у того, у кого свой интерпретатор.

   Жанр. Ребёнок НЕ пишет реализацию. Он пишет, ЧТО ДОЛЖНО БЫТЬ ВЕРНО, код
   пишет напарник, а движок выносит вердикт: какая строка нарушена и на каких
   данных. Человек стоит на стороне заказчика и приёмщика.

   ⚠️ ГЛАВНЫЙ РИСК — СДЕЛАТЬ ИГРУШКУ. Если нотация останется красивыми русскими
   словами, ни во что не переводимыми, ребёнок выучит наш диалект и не получит
   ничего, что существует за пределами Фионики. Защита одна и жёсткая:
   **каждая строка компилируется в настоящий Python** и показывается ребёнку в
   этом виде по кнопке. Это не новый язык вместо Python, а русская надстройка
   над тем, что в Python и так есть (assert, прогон на наборе данных).

   Четыре слова, больше не нужно:
     пример   сумма([1, 2, 3]) = 6        → assert сумма([1, 2, 3]) == 6
     всегда   результат >= 0              → на КАЖДОМ примере: assert условие
     никогда  результат in числа          → на каждом примере: assert not условие
     не дороже 200 шагов                  → цена вызова по счётчику движка

   «Всегда» и «никогда» проверяются на данных из строк «пример» — и это не
   упрощение, а сама мысль: примеры дают данные, правила дают смысл. Без
   примеров правило проверять не на чем, и мы об этом честно говорим.

   ⚠️ «Не дороже N шагов» — та строка, которой нет ни у кого: у взрослых
   корректность и цена решения живут в разных инструментах, а наш интерпретатор
   считает шаги и так, ради защиты от вечного цикла.
   ============================================================ */
var SPEC_KINDS = ["пример", "всегда", "никогда", "не дороже"];

/* Разрезать «a, b, [1, 2]» по запятым ВЕРХНЕГО уровня. Наивный split(",") дал
   бы «[1» и «2]» — то есть развалил бы любой список внутри аргументов. */
function specSplitArgs(src){
  var out = [], depth = 0, cur = "", q = "";
  for (var i = 0; i < src.length; i++){
    var c = src[i];
    if (q){ cur += c; if (c === q) q = ""; continue; }
    if (c === '"' || c === "'"){ q = c; cur += c; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    if (c === ")" || c === "]" || c === "}") depth--;
    if (c === "," && depth === 0){ out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/* Разбор спецификации. Возвращает список строк с разметкой и первую ошибку
   записи: сказать «не понял третью строку» надо ДО всякого прогона. */
function specParse(text, task){
  var lines = String(text || "").split("\n");
  var out = [], problem = null;
  lines.forEach(function(raw, i){
    var t = raw.trim();
    if (!t || t.charAt(0) === "#") return;
    var low = t.toLowerCase();
    var rec = { n: i + 1, raw: t };

    if (low.indexOf("не дороже") === 0){
      var m = /^не\s+дороже\s+(\d+)\s+шаг/i.exec(t);
      if (!m){
        if (!problem) problem = { n: rec.n, why: "После «не дороже» нужно число и слово «шагов»: «не дороже 200 шагов»." };
        return;
      }
      rec.kind = "budget"; rec.budget = +m[1];
      out.push(rec); return;
    }
    if (low.indexOf("пример") === 0){
      var body = t.slice(6).trim();
      var eq = body.lastIndexOf("=");
      /* «==» в примере — частая описка: пишем как в тетради, через одно «=» */
      if (eq > 0 && body.charAt(eq - 1) === "=") eq--;
      if (eq < 0){
        if (!problem) problem = { n: rec.n, why: "В примере не хватает знака «=»: «пример " +
          task.fn + "(…) = ответ»." };
        return;
      }
      var call = body.slice(0, eq).trim(), want = body.slice(eq).replace(/^=+/, "").trim();
      var open = call.indexOf("(");
      if (open < 0 || call.charAt(call.length - 1) !== ")"){
        if (!problem) problem = { n: rec.n, why: "Слева от «=» должен стоять вызов: «" +
          task.fn + "(…)»." };
        return;
      }
      var name = call.slice(0, open).trim();
      if (name !== task.fn){
        if (!problem) problem = { n: rec.n, why: "Принимаем функцию «" + task.fn +
          "», а в примере вызвана «" + name + "»." };
        return;
      }
      if (!want){
        if (!problem) problem = { n: rec.n, why: "После «=» не написан ответ." };
        return;
      }
      rec.kind = "example";
      rec.args = specSplitArgs(call.slice(open + 1, call.length - 1));
      rec.want = want;
      if (rec.args.length !== task.params.length){
        if (!problem) problem = { n: rec.n, why: "У функции «" + task.fn + "» " +
          task.params.length + " " + A.plural(task.params.length, "аргумент", "аргумента", "аргументов") +
          " (" + task.params.join(", ") + "), а в примере " + rec.args.length + "." };
        return;
      }
      out.push(rec); return;
    }
    if (low.indexOf("всегда") === 0 || low.indexOf("никогда") === 0){
      var always = low.indexOf("всегда") === 0;
      var cond = t.slice(always ? 6 : 7).trim();
      if (!cond){
        if (!problem) problem = { n: rec.n, why: "После «" + (always ? "всегда" : "никогда") +
          "» нужно условие — например «результат >= 0»." };
        return;
      }
      rec.kind = always ? "always" : "never";
      rec.cond = cond;
      out.push(rec); return;
    }
    if (!problem) problem = { n: rec.n, why: "Строка начинается не с того слова. Их четыре: " +
      SPEC_KINDS.map(function(x){ return "«" + x + "»"; }).join(", ") + "." };
  });

  var ex = out.filter(function(r){ return r.kind === "example"; });
  var rules = out.filter(function(r){ return r.kind === "always" || r.kind === "never"; });
  if (!problem && rules.length && !ex.length)
    problem = { n: rules[0].n, why: "Правило проверять не на чем: «всегда» и «никогда» " +
      "смотрят на данные из строк «пример», а примеров нет ни одного." };
  return { rows: out, examples: ex, problem: problem };
}

/* Тот же разбор — настоящим Python. Кнопка «Показать на Python» показывает
   ровно это, и это единственная защита от того, чтобы нотация стала диалектом
   вместо навыка. */
function specToPython(spec, task){
  var out = ["# приёмка: " + task.fn + "(" + task.params.join(", ") + ")"];
  spec.rows.forEach(function(r){
    if (r.kind === "example"){
      out.push("", "# " + r.raw);
      out.push("assert " + task.fn + "(" + r.args.join(", ") + ") == " + r.want);
    } else if (r.kind === "always" || r.kind === "never"){
      out.push("", "# " + r.raw);
      spec.examples.forEach(function(e){
        task.params.forEach(function(p, i){ out.push(p + " = " + e.args[i]); });
        out.push("результат = " + task.fn + "(" + task.params.join(", ") + ")");
        out.push("assert " + (r.kind === "never" ? "not (" + r.cond + ")" : r.cond));
      });
    } else if (r.kind === "budget"){
      out.push("", "# " + r.raw + " — цену считает движок тренажёра,");
      out.push("# в обычном Python на это есть отдельные инструменты");
    }
  });
  return out.join("\n");
}

/* Прогон одной строки. Каждую проверяем отдельной программой: иначе первая же
   упавшая скрыла бы все следующие, и вердикт врал бы про то, что цело. */
function specCheckOne(row, spec, task, code){
  var eng = Runtime.get("mini");
  function run(src){
    try { return eng.run(src, {}); } catch(e){ return { error: { kind:"Ошибка", msg:String(e) } }; }
  }
  if (row.kind === "example"){
    var r = run(code + "\n\nassert " + task.fn + "(" + row.args.join(", ") + ") == " + row.want);
    if (!r.error) return { ok:true };
    if (r.error.kind === "AssertionError"){
      /* Показать, ЧТО именно вернулось: «не сошлось» без числа ничему не учит. */
      var got = run(code + "\n\nprint(" + task.fn + "(" + row.args.join(", ") + "))");
      return { ok:false, why: "ждали " + row.want +
        (got.error ? "" : ", получили " + String(got.output || "").trim()) };
    }
    return { ok:false, why: (A.KIND_RU[r.error.kind] || r.error.kind) + ": " + r.error.msg };
  }
  if (row.kind === "always" || row.kind === "never"){
    for (var i = 0; i < spec.examples.length; i++){
      var e = spec.examples[i], head = "";
      task.params.forEach(function(p, k){ head += p + " = " + e.args[k] + "\n"; });
      head += "результат = " + task.fn + "(" + task.params.join(", ") + ")\n";
      var cond = row.kind === "never" ? "not (" + row.cond + ")" : row.cond;
      var rr = run(code + "\n\n" + head + "assert " + cond);
      if (!rr.error) continue;
      var на = task.fn + "(" + e.args.join(", ") + ")";
      if (rr.error.kind === "AssertionError")
        return { ok:false, why: "нарушено на " + на };
      return { ok:false, why: "на " + на + " — " +
        (A.KIND_RU[rr.error.kind] || rr.error.kind) + ": " + rr.error.msg };
    }
    return { ok:true };
  }
  if (row.kind === "budget"){
    if (!spec.examples.length) return { ok:false, why: "не на чем мерить: нет ни одного примера" };
    var e0 = spec.examples[0];
    /* Цена ВЫЗОВА, а не всей программы: описание функции тоже стоит шагов,
       и без вычитания число врало бы тем сильнее, чем длиннее код. */
    var base = run(code);
    var full = run(code + "\n\n" + task.fn + "(" + e0.args.join(", ") + ")");
    if (base.error || full.error) return { ok:false, why: "программа не запустилась" };
    var cost = Math.max(0, (full.steps || 0) - (base.steps || 0));
    return cost <= row.budget
      ? { ok:true, note: "вышло " + cost }
      : { ok:false, why: "вышло " + cost + " при разрешённых " + row.budget };
  }
  return { ok:true };
}

function specRunAll(spec, task, code){
  var rows = spec.rows.map(function(r){
    var v = specCheckOne(r, spec, task, code);
    return { n:r.n, raw:r.raw, kind:r.kind, ok:v.ok, why:v.why || "", note:v.note || "" };
  });
  return { rows: rows, ok: rows.every(function(r){ return r.ok; }) };
}

/* Вердикт приёмки. ⚠️ Порядок обязателен и держит всю механику:
   СНАЧАЛА спецификация обязана пройти на ЭТАЛОНЕ. Без этого её можно было бы
   пройти строкой «пример f(1) = 999»: заведомая ложь, код её не проходит, и мы
   бы засчитали приёмку. Спецификация, отвергающая правильную программу, —
   плохая спецификация, и это первое, что узнаёт любой, кто пишет тесты. */
function specVerdict(spec, task, specText){
  var parsed = spec;
  if (parsed.problem)
    return { state:"parse", line: parsed.problem.n, why: parsed.problem.why };
  if (!parsed.rows.length)
    return { state:"empty", why: "Пока не написано ни одной строки." };
  if (parsed.rows.length < (task.want || 2))
    return { state:"thin", why: "Строк маловато: приёмка из " + parsed.rows.length + " " +
      A.plural(parsed.rows.length, "строки", "строк", "строк") + " ничего не доказывает. " +
      "Здесь нужно хотя бы " + task.want + "." };

  var onTruth = specRunAll(parsed, task, task.truth);
  if (!onTruth.ok){
    var bad = onTruth.rows.filter(function(r){ return !r.ok; })[0];
    return { state:"wrongspec", line: bad.n, why: bad.why, rows: onTruth.rows };
  }
  var onCode = specRunAll(parsed, task, task.code);
  if (task.broken)
    return onCode.ok
      ? { state:"missed", rows: onCode.rows }
      : { state:"caught", rows: onCode.rows };
  return onCode.ok
    ? { state:"accepted", rows: onCode.rows }
    : { state:"falsealarm", rows: onCode.rows,
        line: onCode.rows.filter(function(r){ return !r.ok; })[0].n };
}

function specsList(){ return (window.SPECS || []); }
function specDone(id){ return !!(A.S().specs && A.S().specs[id]); }
function specMark(id){ A.S().specs = A.S().specs || {}; A.S().specs[id] = 1; A.save(); }

/* ---------- экраны приёмки ---------- */
var SPEC_START = "# Напиши, что должно быть верно. Четыре слова:\n" +
  "#   пример   имя(...) = ответ\n" +
  "#   всегда   условие\n" +
  "#   никогда  условие\n" +
  "#   не дороже 200 шагов\n";

function screenSpecs(){
  A.enterScreen("train", "specs");
  A.newSession({ id:null, attempts:0, hints:0, shown:false });
  var list = specsList(), done = list.filter(function(x){ return specDone(x.id); }).length;

  var h = '<div class="lvlhead"><div><div class="idx">приёмка работы</div>' +
    '<h1>📋 Приёмка</h1></div>' +
    '<div class="right"><span class="tag">' + done + ' из ' + list.length + '</span></div></div>' +
    '<p class="lede">Здесь ты не пишешь программу. Программу написал напарник — ' +
    'а ты <b>принимаешь работу</b>: записываешь, что должно быть верно, и движок проверяет ' +
    'его код по твоим правилам. Так работают со взрослым кодом и так придётся работать с ИИ: ' +
    'он пишет быстро и уверенно, а отвечаешь за результат ты.</p>';

  h += '<div class="card"><h3>Как записывать</h3>' +
    '<p class="dim">Четыре слова, больше не нужно. Каждая строка — это настоящий Python, ' +
    'и на экране задания есть кнопка, которая покажет её в этом виде.</p>' +
    '<div class="specref">' +
    '<div><code>пример сумма([1, 2, 3]) = 6</code><span>конкретный случай и ответ к нему</span></div>' +
    '<div><code>всегда результат >= 0</code><span>правило, верное на всех примерах</span></div>' +
    '<div><code>никогда результат in числа</code><span>чего быть не должно</span></div>' +
    '<div><code>не дороже 200 шагов</code><span>цена вызова — её считает движок</span></div>' +
    '</div></div>';

  h += '<div class="gamelist">';
  list.forEach(function(x){
    h += '<button class="gamecard" data-spec="' + A.esc(x.id) + '">' +
      '<span class="gem">' + x.emoji + '</span>' +
      '<span class="gbody"><b>' + A.esc(x.title) + (specDone(x.id) ? ' ✓' : '') + '</b>' +
      '<span>' + A.esc(x.brief) + '</span></span>' +
      '<span class="wtag">' + (specDone(x.id) ? "принято" : "работа ждёт") + '</span></button>';
  });
  h += '</div><div class="pager"><button class="bigbtn ghost" id="tomap">← В «Ты и ИИ»</button></div>';

  A.app.innerHTML = h;
  A.app.querySelectorAll("[data-spec]").forEach(function(b){
    b.onclick = function(){ openSpec(b.getAttribute("data-spec")); };
  });
  document.getElementById("tomap").onclick = A.screenAILab;
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function specTaskById(id){
  return specsList().filter(function(x){ return x.id === id; })[0] || null;
}

function openSpec(id){
  var task = specTaskById(id);
  if (!task) return screenSpecs();
  A.enterScreen("train", "spec");
  A.newSession({ id:id, attempts:0, hints:0, shown:false, spec:true });

  var h = '<div class="crumbs"><span data-go="back">Приёмка</span> › ' + task.emoji + ' ' + A.esc(task.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">принимаем работу напарника</div>' +
    '<h1>' + task.emoji + ' ' + A.esc(task.title) + '</h1></div>' +
    '<div class="right"><span class="tag">' + A.esc(task.fn) + '(' + A.esc(task.params.join(", ")) + ')</span></div></div>' +
    '<div class="goal"><h3>🎯 О чём просили напарника</h3><p>' + A.esc(task.brief) + '</p>' +
    '<ul><li>Твоя задача — не переписать его код, а записать правила, по которым его судить.</li>' +
    '<li>Правила сначала проверяются на заведомо правильной программе: спецификация, ' +
    'которая отвергает верное решение, — плохая спецификация.</li></ul></div>';

  h += '<div class="card"><h3>📨 Что прислал напарник</h3>' +
    '<div class="showcode"><pre><code>' + A.hl(task.code) + '</code></pre>' +
    '<span class="shownote">менять этот код нельзя — его надо принять или вернуть</span></div></div>';

  h += '<div class="card"><h3>📋 Твоя приёмка</h3>' +
    '<textarea id="specin" class="stdinbox specin" rows="7" spellcheck="false" ' +
    'autocapitalize="off" autocorrect="off"></textarea>' +
    '<div class="admrow"><button class="rbtn check" id="specgo">✓ Принять работу</button>' +
    '<button class="rbtn sec" id="specpy">Показать на Python</button>' +
    '<button class="rbtn sec" id="specclr">↺ Очистить</button></div>' +
    '<div class="msg" id="specmsg"></div>' +
    '<div id="specpyout"></div></div>';

  h += '<div class="hintbox"><button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
    '<span class="tip">подсказки тут ничего не стоят — это тренировка</span></div>' +
    '<div class="hintout" id="hintout"></div>' +
    '<div class="pager"><button class="bigbtn ghost" data-go="back">← Ко всем работам</button></div>';

  A.app.innerHTML = h;
  var ta = document.getElementById("specin");
  ta.value = (A.S().specDrafts && A.S().specDrafts[id]) || SPEC_START;
  ta.addEventListener("input", function(){
    A.S().specDrafts = A.S().specDrafts || {};
    A.S().specDrafts[id] = ta.value;
  });

  function say(cls, html){
    var m = document.getElementById("specmsg");
    m.className = "msg show " + cls; m.innerHTML = html;
  }
  function rowsHTML(rows){
    if (!rows || !rows.length) return "";
    return '<div class="speclist">' + rows.map(function(r){
      return '<div class="specone ' + (r.ok ? "ok" : "bad") + '">' +
        '<span class="specmark">' + (r.ok ? "✓" : "✕") + '</span>' +
        '<code>' + A.esc(r.raw) + '</code>' +
        '<span>' + A.esc(r.why || r.note || (r.ok ? "выполняется" : "")) + '</span></div>';
    }).join("") + '</div>';
  }

  document.getElementById("specgo").onclick = function(){
    A.session().attempts++;
    var parsed = specParse(ta.value, task);
    var v = specVerdict(parsed, task, ta.value);
    if (v.state === "parse")
      return say("bad", "<b>Не понял строку " + v.line + "</b>" + A.esc(v.why));
    if (v.state === "empty" || v.state === "thin")
      return say("warn", "<b>Пока рано принимать</b>" + A.esc(v.why));
    if (v.state === "wrongspec")
      return say("bad", "<b>Спецификация отвергает правильную программу</b>" +
        "Строка " + v.line + " не проходит даже на заведомо верном решении" +
        (v.why ? " (" + A.esc(v.why) + ")" : "") + ". Значит дело не в напарнике, а в правиле: " +
        "оно требует того, о чём не просили." + rowsHTML(v.rows));
    if (v.state === "missed")
      return say("warn", "<b>Работа прошла приёмку — а зря</b>" +
        "Все твои правила выполняются, но в этом коде есть поломка. " +
        "Значит правила не покрывают того случая, о котором просили отдельно. " +
        "Перечитай просьбу: там есть фраза, под которую ты не написал ни одной строки." +
        rowsHTML(v.rows));
    if (v.state === "falsealarm")
      return say("bad", "<b>Ты вернул исправную работу</b>" +
        "Строка " + v.line + " не проходит, хотя код напарника верен. " +
        "Так бывает: правило оказалось строже, чем просьба." + rowsHTML(v.rows));
    /* caught и accepted — обе победа, и это важно сказать вслух */
    winSpec(task, v);
  };
  document.getElementById("specpy").onclick = function(){
    var parsed = specParse(ta.value, task);
    var box = document.getElementById("specpyout");
    if (parsed.problem)
      return say("bad", "<b>Не понял строку " + parsed.problem.n + "</b>" + A.esc(parsed.problem.why));
    box.innerHTML = '<div class="card"><h3>То же самое на Python</h3>' +
      '<div class="showcode"><pre><code>' + A.hl(specToPython(parsed, task)) + '</code></pre>' +
      '<span class="shownote">это не наш выдуманный язык: каждая твоя строка — обычный assert, ' +
      'и так проверяют код взрослые</span></div></div>';
    /* проверка на метод — не суеверие: в jsdom его нет, и без неё падал бы
       обработчик, а не прокрутка (грабля из README) */
    if (box.scrollIntoView) box.scrollIntoView({ behavior:"smooth", block:"center" });
  };
  document.getElementById("specclr").onclick = function(){
    ta.value = SPEC_START;
    A.S().specDrafts = A.S().specDrafts || {}; A.S().specDrafts[id] = ta.value; A.save();
    document.getElementById("specpyout").innerHTML = "";
    var m = document.getElementById("specmsg"); m.className = "msg";
  };
  A.wireHint(task.hints);
  A.app.querySelectorAll("[data-go]").forEach(function(b){ b.onclick = screenSpecs; });
  A.refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function winSpec(task, v){
  var first = !specDone(task.id);
  specMark(task.id);
  A.markActiveToday();
  A.save(); A.refreshTop();
  var caught = v.state === "caught";
  document.getElementById("wincard").innerHTML =
    '<div class="big">' + (caught ? "🔍" : "✅") + '</div>' +
    '<h2>' + (caught ? "Работу вернули на доработку" : "Работу приняли") + '</h2>' +
    '<p>' + (caught
      ? "Твои правила поймали поломку — и поймали её движком, а не на глаз. " +
        "Именно так принимают чужой код: не читая его целиком, а проверяя то, о чём договаривались."
      : "Правила прошли, и код им соответствует. Приёмка нужна не чтобы обязательно найти ошибку, " +
        "а чтобы знать, что её нет.") + '</p>' +
    '<div class="stepnote"><b>Что тут было.</b> ' + A.esc(task.note) + '</div>' +
    '<div class="winrow"><button class="bigbtn" id="wspecs">Ко всем работам</button>' +
    '<button class="bigbtn ghost" id="wstay">Остаться здесь</button></div>';
  document.getElementById("win").classList.add("show");
  A.confetti(first ? 2 : 1);
  document.getElementById("wspecs").onclick = function(){ A.closeWin(); screenSpecs(); };
  document.getElementById("wstay").onclick = A.closeWin;
}
return {
  screenSpecs: screenSpecs, specsList: specsList, specDone: specDone,
  /* дальше — только для теста (window.__game) */
  openSpec: openSpec, specParse: specParse, specToPython: specToPython,
  specRunAll: specRunAll, specVerdict: specVerdict, specSplitArgs: specSplitArgs,
  specTaskById: specTaskById, SPEC_KINDS: SPEC_KINDS
};
};
