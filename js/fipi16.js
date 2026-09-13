/* ============================================================
   Фионика — судья задания 16 ОГЭ так, как его оценивает эксперт ФИПИ.

   ЗАЧЕМ. Задание 16 ОГЭ (программа) в 2025 году выполнили 3,72% участников
   Красноярского края (разбор — docs/rynok-i-rov-2026-09-12.md § 5.7), а
   оценивается оно ровно тем, что уже умеет наш судья: запуском программы на
   тестах, которых ученик не видит. Не хватало одного — говорить результат
   на языке экзамена: «на ОГЭ за это было бы N из 2 баллов».

   ⚠️ ИСТОЧНИК ОДИН, И ОН ОТКРЫТ (правило § 4.44 RAZVITIE). Методические
   материалы ФИПИ для предметных комиссий, ОГЭ-2026, информатика
   (doc.fipi.ru/…/mr_oge_informatika_2026.pdf, скачан и прочитан 13.09.2026):
     с. 53   — эксперт запускает программу на тестах из критериев; 2 балла —
               верно на всех; 1 — неверный ответ не более чем на одном; 0 —
               иначе. Программа с синтаксической ошибкой — 0;
     с. 54   — программа без ввода данных (данные константами в коде) или
               без вывода ответа — 0. Зацикливание и аварийное завершение —
               тест не засчитан;
     с. 55   — те же 2/1/0 словами.
   Слепок этих чисел стоит в tests/full-run.js ([фипи-16]).

   ⚠️ ЧЕГО В ДОКУМЕНТЕ НЕТ — и мы этого не выдаём за правило:
     — про приглашение к вводу (input("Введите…")) и лишний текст в выводе
       критерии молчат. Поэтому мы ответ засчитываем, а про риск говорим:
       эксперт видит весь вывод, а условие просит напечатать одно число;
     — про версию Python тоже нет ни слова. Есть только рекомендация ставить
       экспертам те же версии программ, что были у учащихся (с. 5 и 10).
       Совпадут ли они — не гарантировано, а незапустившаяся программа
       получает 0. Поэтому о новых конструкциях предупреждаем, балл не снижаем.

   ⚠️ ТЕСТЫ ЭКСПЕРТА — ЭТО СКРЫТЫЕ НАБОРЫ (sets), А НЕ ПРИМЕР. Пример ребёнок
   видит на экране, а тесты эксперта — нет. В образцах ФИПИ тестов три
   (с. 53, 56), поэтому у каждой задачи, к которой применяется оценка, скрытых
   наборов не меньше трёх: при двух «неверно не более чем на одном» давало бы
   балл за половину.

   Только механика: зовут её судья задач (js/app.js, runAlgoCheck) и итог
   пробного варианта (js/variant.js). Номер задания отсюда не называется — он
   живёт в одном месте, js/exams.js.
   ============================================================ */
window.FIPI16 = (function(){

  var DOC = {
    title: "методические материалы ФИПИ для экспертов ОГЭ-2026 по информатике",
    pages: "с. 53–55",
    url: "https://doc.fipi.ru/oge/dlya-predmetnyh-komissiy-subektov-rf/2026/mr_oge_informatika_2026.pdf"
  };
  var MAX = 2;          /* максимальный балл за задание, с. 53 */
  var MIN_TESTS = 3;    /* столько тестов в образцах критериев, с. 53 и 56 */

  function esc(s){
    return String(s).replace(/[&<>"]/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c];
    });
  }

  /* Строка карты ОГЭ, где стоит программа. Ищем по группе «oge», а не по
     номеру: номер живёт в js/exams.js и может смениться с годом. */
  function examTask(){
    var ex = (window.EXAMS || {}).oge;
    if (!ex) return null;
    for (var i = 0; i < ex.tasks.length; i++)
      if ((ex.tasks[i].g || []).indexOf("oge") >= 0) return ex.tasks[i];
    return null;
  }

  /* Оценка применима к задаче, если это ПРОГРАММА С ВВОДОМ из тем этого
     номера и у неё есть скрытые наборы. Задачи-функции (поиск и сортировка
     с проверкой вызовами) стоят в тех же темах, но ввода у них нет — эксперт
     ФИПИ такую работу оценил бы в 0 за отсутствие ввода, и называть это
     «баллом» было бы нечестно к ребёнку, который решил её верно. */
  function applies(x){
    var t = examTask();
    return !!(t && x && x.check && x.check.kind === "output" &&
              Array.isArray(x.stdin) && Array.isArray(x.sets) && x.sets.length &&
              (t.g || []).indexOf(x.group) >= 0);
  }

  function scoreOf(failed){ return failed === 0 ? 2 : failed === 1 ? 1 : 0; }

  function same(a, b){
    return a.length === b.length && a.every(function(v, i){ return v === b[i]; });
  }

  /* ---- конструкции новее Python 3.7 ----
     Разбираем код без строк и комментариев: «match» в тексте задачи или в
     комментарии — не конструкция. Тела f-строк собираем отдельно: «{x=}»
     живёт именно там. */
  function splitCode(src){
    var code = "", fbodies = [], i = 0, n = src.length;
    while (i < n){
      var c = src.charAt(i);
      if (c === "#"){
        while (i < n && src.charAt(i) !== "\n") i++;
        continue;
      }
      if (c === "'" || c === '"'){
        var j = code.length - 1, pre = "";
        while (j >= 0 && /[a-zA-Z]/.test(code.charAt(j)) && pre.length < 2){ pre = code.charAt(j) + pre; j--; }
        var isF = /f/i.test(pre) && (j < 0 || !/\w/.test(code.charAt(j)));
        var triple = src.substr(i, 3) === c + c + c;
        var q = triple ? c + c + c : c, k = i + q.length, body = "", torn = false;
        while (k < n && src.substr(k, q.length) !== q){
          if (src.charAt(k) === "\\"){ body += src.substr(k, 2); k += 2; continue; }
          if (!triple && src.charAt(k) === "\n"){ torn = true; break; }
          body += src.charAt(k); k++;
        }
        if (isF) fbodies.push({ body: body, line: code.split("\n").length });
        /* переводы строк внутри строки сохраняем — иначе поедут номера строк */
        code += '""' + body.replace(/[^\n]/g, "");
        /* незакрытая строка кончается на переводе строки — его не съедаем */
        i = torn ? k : k + q.length;
        continue;
      }
      code += c; i++;
    }
    return { code: code, fbodies: fbodies };
  }

  var NEWER = [
    { re: /^[ \t]*match[ \t]+[^=\n]*:[ \t]*$/m, what: "match … case", ver: "3.10",
      need: /^[ \t]*case[ \t]+[^\n]*:[ \t]*$/m },
    { re: /:=/, what: "оператор «:=»", ver: "3.8" },
    { re: /\bdef\s+\w+\s*\([^)]*(,|\()\s*\/\s*[,)]/, what: "параметры до «/» в def", ver: "3.8" },
    { re: /\bmath\.(isqrt|prod|comb|perm|dist)\b|\bfrom\s+math\s+import\b[^\n]*\b(isqrt|prod|comb|perm|dist)\b/,
      what: "math.isqrt, math.prod, math.comb", ver: "3.8" },
    { re: /\.(removeprefix|removesuffix)\s*\(/, what: "removeprefix и removesuffix", ver: "3.9" },
    { re: /\bmath\.lcm\b|\bfrom\s+math\s+import\b[^\n]*\blcm\b/, what: "math.lcm", ver: "3.9" },
    { re: /(:|->)\s*(list|dict|tuple|set)\[/, what: "list[int] и dict[…] в подсказках типов", ver: "3.9" },
    { re: /\.bit_count\s*\(/, what: "bit_count()", ver: "3.10" },
    { re: /\bitertools\.pairwise\b|\bfrom\s+itertools\s+import\b[^\n]*\bpairwise\b/, what: "itertools.pairwise", ver: "3.10" },
    { re: /\bzip\s*\([^\n]*\bstrict\s*=/, what: "zip(…, strict=…)", ver: "3.10" },
    { re: /\bexcept\s*\*/, what: "except*", ver: "3.11" }
  ];

  function lineOf(text, idx){ return text.slice(0, idx).split("\n").length; }

  function newerSyntax(src){
    var sp = splitCode(String(src || "")), out = [];
    NEWER.forEach(function(r){
      var m = r.re.exec(sp.code);
      if (!m || (r.need && !r.need.test(sp.code))) return;
      out.push({ what: r.what, ver: r.ver, line: lineOf(sp.code, m.index) });
    });
    for (var i = 0; i < sp.fbodies.length; i++){
      if (/\{[^{}]*[^=!<>{]=\s*(![rsa])?(:[^{}]*)?\}/.test(sp.fbodies[i].body)){
        out.push({ what: "f-строка вида {x=}", ver: "3.8", line: sp.fbodies[i].line });
        break;
      }
    }
    return out;
  }

  /* ---- оценка ----
     eng — движок с run(code, opts). Эталон и программа ребёнка гоняются на
     каждом скрытом наборе; приглашения input() не печатаются ни там, ни там.
     Возвращает:
       score   0, 1 или 2
       total   сколько тестов, passed — сколько пройдено, marks — [true/false]
       zero    почему 0 не зависимо от тестов: "syntax" | "input" | "output" | null
       prompts было ли непустое приглашение к вводу
       newer   конструкции новее 3.7 */
  function grade(eng, code, x){
    var marks = [], anyOk = false, readAny = false, printedAny = false,
        syntax = false, prompts = false;
    x.sets.forEach(function(din){
      var r = eng.run(code, { stdin: din.slice(), quietPrompt: true });
      var e = eng.run(x.solution, { stdin: din.slice(), quietPrompt: true });
      var it = r.interp || {};
      if (r.error && r.error.kind === "SyntaxError") syntax = true;
      if (!r.error) anyOk = true;
      if ((it.stdinPos || 0) > 0) readAny = true;
      if (it.prompts) prompts = true;
      if (r.lines.length) printedAny = true;
      marks.push(!r.error && same(e.lines, r.lines));
    });
    var failed = marks.filter(function(m){ return !m; }).length;
    /* ⚠️ «Нет ввода» ставим, только если программа хоть раз ДОРАБОТАЛА и не
       прочла ни строки. Упавшая на первой строке программа тоже ничего не
       прочла, но её беда другая, и называть её «нет ввода» — врать. */
    var zero = syntax ? "syntax"
             : (anyOk && !readAny) ? "input"
             : (anyOk && !printedAny) ? "output"
             : null;
    return { score: zero ? 0 : scoreOf(failed), max: MAX, total: marks.length,
             passed: marks.length - failed, marks: marks, zero: zero,
             prompts: prompts, newer: newerSyntax(code) };
  }

  /* «N из 2 баллов»: после «из двух» слово стоит во множественном числе при
     любом N — «1 из 2 балла» и «2 из 2 балла» звучат как опечатка. */

  var ZERO_WHY = {
    syntax: "Программа не запускается. На экзамене такая получает 0 баллов, " +
            "даже если мысль в ней верная.",
    input:  "Программа не читает входные данные: числа стоят прямо в коде. " +
            "Эксперт ставит за это 0 баллов, даже если напечатанное число совпало.",
    output: "Программа ничего не печатает. Без вывода ответа эксперт ставит 0 баллов."
  };

  /* Предупреждения — отдельно от балла: они его не снижают, но на экзамене
     могут стоить задания. */
  function warnHTML(g){
    var h = "";
    if (g.prompts)
      h += '<p>⚠️ <b>Текст в input("…")</b> здесь не мешает — ответ мы засчитали. ' +
        'Но эксперт видит всё, что напечатала программа, а условие просит вывести ' +
        '<b>только одно число</b>. В правилах ФИПИ про приглашение к вводу ничего не ' +
        'сказано, так что это риск: надёжнее писать <code>input()</code> без текста.</p>';
    if (g.newer && g.newer.length){
      var v = g.newer[0];
      h += '<p>⚠️ <b>' + esc(v.what) + '</b> (строка ' + v.line + ') есть только в Python ' +
        esc(v.ver) + ' и новее' +
        (g.newer.length > 1 ? ', и таких мест в программе ' + g.newer.length : '') + '. ' +
        'ФИПИ лишь рекомендует ставить экспертам ту же версию, что была на экзамене ' +
        '(с. 5 и 10), — если там окажется старый Python, программа не запустится и ' +
        'получит 0. Надёжнее обойтись без этого.</p>';
    }
    return h;
  }

  /* Блок под вердиктом судьи в тренировке. */
  function verdictHTML(g){
    var h = '<div class="stepnote fipi16"><b>📝 На ОГЭ за эту программу было бы ' +
      g.score + ' из ' + g.max + ' баллов</b>';
    /* ⚠️ Синтаксическая ошибка рядом с новой конструкцией — почти всегда сама
       эта конструкция: наш движок её не разбирает, как не разобрал бы и старый
       Python. Назвать это «опечаткой» значило бы спрятать настоящую причину. */
    if (g.zero === "syntax" && g.newer && g.newer.length)
      h += '<p>Программа не запустилась: в ней ' + esc(g.newer[0].what) + ' из Python ' +
        esc(g.newer[0].ver) + '. Наш тренажёр такого не разбирает — как не разберёт и старая ' +
        'версия Python. На экзамене незапустившаяся программа получает 0 баллов.</p>';
    else if (g.zero) h += '<p>' + ZERO_WHY[g.zero] + '</p>';
    else h += '<p>Эксперт запускает программу на тестах, которых ученик не видит. ' +
      'Здесь их ' + g.total + ': ' +
      g.marks.map(function(m, i){ return "тест " + (i + 1) + " " + (m ? "✓" : "✗"); }).join(", ") +
      '. 2 балла — верно на всех, 1 — неверно не больше чем на одном, 0 — иначе.</p>';
    h += warnHTML(g);
    h += '<p class="dim">Правила — ' + esc(DOC.title) + ', ' + DOC.pages + '.</p></div>';
    return h;
  }

  /* Короткая запись для варианта: хранится в прогрессе, поэтому без лишнего.
     Обратно в предупреждение её превращает unpack. */
  function pack(g){
    return { s: g.score, t: g.total, p: g.passed, z: g.zero || "",
             pr: g.prompts ? 1 : 0, nw: (g.newer || []).slice(0, 3), at: Date.now() };
  }

  return { DOC: DOC, MAX: MAX, MIN_TESTS: MIN_TESTS, examTask: examTask,
           applies: applies, scoreOf: scoreOf, grade: grade, newerSyntax: newerSyntax,
           verdictHTML: verdictHTML, warnHTML: warnHTML, pack: pack,
           unpackWarnHTML: function(r){ return warnHTML({ prompts: !!(r && r.pr), newer: (r && r.nw) || [] }); },
           zeroWhy: function(z){ return ZERO_WHY[z] || ""; } };
})();
