/* ============================================================
   Фионика — задание 15 ОГЭ (Робот) так, как его оценивает эксперт ФИПИ.

   Пара к js/fipi16.js: там программа на Python, здесь алгоритм для
   исполнителя. Задание 15 в 2025 году выполнили 23,63% участников
   Красноярского края (docs/rynok-i-rov-2026-09-12.md § 5.7).

   ⚠️ ИСТОЧНИК (правило § 4.44 RAZVITIE) — методические материалы ФИПИ для
   предметных комиссий, ОГЭ-2026, информатика, раздел 2.4, скачан и прочитан
   13.09.2026:
     с. 41 — 2 балла: алгоритм правильно работает при всех допустимых исходных
             данных; 1 балл: при всех допустимых данных алгоритм завершается,
             Робот не разбивается, закрашено не более 10 лишних клеток и не
             закрашено не более 10 нужных; 0 — иначе;
     с. 42 — решение только для частного случая с рисунка — 0;
     с. 43 — поле бесконечное: решение, которое останавливается у внешней
             стены поля, не завершается; синтаксические ошибки НЕ учитываются;
     с. 44 — лишние клетки считают «при очень больших длинах стен и
             проходов»; незавершение и аварийный останов — 0;
     с. 49 — три лишние клетки под проходом — 0: проход может быть длиннее 10.
   Слепок — `[фипи-15]` в tests/full-run.js.

   ⚠️ КАК «ПРИ ВСЕХ ДОПУСТИМЫХ ДАННЫХ» СТАНОВИТСЯ ПРОВЕРКОЙ. Все данные
   перебрать нельзя. Поэтому у каждой задачи формата ОГЭ есть скрытые поля с
   проходами у самых концов стен и одно поле «очень больших длин» — стены
   длиннее 25 клеток и проходы длиннее 10 (js/robot-tasks.js). Ошибка, которая растёт
   с длиной, на нём перерастает порог 10 — как у эксперта в примере 2.

   ⚠️ ЧЕГО МЫ НЕ ДЕЛАЕМ, И ЭТО СКАЗАНО НА ЭКРАНЕ. Эксперт не снижает балл за
   ошибки записи — он читает алгоритм глазами. Мы глазами не читаем: алгоритм,
   который не разобрался, мы не можем запустить и балла не называем вовсе.
   ============================================================ */
window.FIPI15 = (function(){

  var DOC = {
    title: "методические материалы ФИПИ для экспертов ОГЭ-2026 по информатике",
    pages: "с. 41–44",
    url: "https://doc.fipi.ru/oge/dlya-predmetnyh-komissiy-subektov-rf/2026/mr_oge_informatika_2026.pdf"
  };
  var MAX = 2;       /* с. 41 */
  var LIMIT = 10;    /* «не более 10 лишних» и «не более 10 незакрашенных», с. 41 */

  function applies(t){ return !!(t && t.fipi); }

  function fieldsOf(t){ return [t.field].concat(t.more || []); }

  function diff(a, b){
    var n = 0;
    Object.keys(a).forEach(function(k){ if (!b[k]) n++; });
    return n;
  }

  /* Балл по уже посчитанным числам — отдельно, чтобы шкала была видна одной
     строкой и проверялась тестом без Робота. */
  function scoreOf(broken, maxExtra, maxMissed){
    if (broken) return 0;
    if (!maxExtra && !maxMissed) return 2;
    return (maxExtra <= LIMIT && maxMissed <= LIMIT) ? 1 : 0;
  }

  /* R — js/robot.js. Возвращает:
       score      0, 1, 2 или null (запись не разобралась — балла не называем)
       parse      ошибка разбора, если была
       broke      { why: "away"|"loop"|"crash", field, line, msg } — первое
                  поле, где алгоритм не завершился или Робот разбился
       maxExtra   больше всего лишних клеток на одном поле
       maxMissed  больше всего незакрашенных нужных на одном поле
       total      сколько полей, big — самая длинная сторона поля */
  function grade(R, text, t){
    try { R.parse(text); }
    catch(e){ return { score: null, max: MAX, parse: e }; }
    var all = fieldsOf(t), maxExtra = 0, maxMissed = 0, broke = null, big = 0;
    all.forEach(function(rows, i){
      big = Math.max(big, rows.length, rows[0].length);
      if (broke) return;
      var got = R.run(text, R.parseField(rows, t.inf));
      var want = R.run(t.solution, R.parseField(rows, t.inf));
      if (got.error){
        broke = { why: got.error.away ? "away" : got.error.loop ? "loop" : "crash",
                  field: i, line: got.error.line, msg: got.error.msg };
        return;
      }
      maxExtra = Math.max(maxExtra, diff(got.field.painted, want.field.painted));
      maxMissed = Math.max(maxMissed, diff(want.field.painted, got.field.painted));
    });
    return { score: scoreOf(broke, maxExtra, maxMissed), max: MAX, broke: broke,
             maxExtra: maxExtra, maxMissed: maxMissed, total: all.length, big: big };
  }

  function esc(s){
    return String(s).replace(/[&<>"]/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c];
    });
  }
  function kl(n){
    var a = n % 10, b = n % 100;
    return (a === 1 && b !== 11) ? "клетка" : (a >= 2 && a <= 4 && (b < 12 || b > 14)) ? "клетки" : "клеток";
  }

  var BROKE_WHY = {
    away:  "Алгоритм держится за край поля. На экзамене поле бесконечное, и такой цикл не " +
           "кончается — эксперт ставит 0.",
    loop:  "Алгоритм не завершается: один из циклов никогда не кончается. Это 0 баллов.",
    crash: "Робот разбивается о стену. Аварийный останов — 0 баллов."
  };

  /* Почему такой балл — одной-двумя фразами. Общий кусок для экрана задачи
     и итога варианта, иначе они однажды объяснят один балл по-разному. */
  function reasonHTML(g){
    if (g.broke) return BROKE_WHY[g.broke.why] +
      (g.broke.field ? " Так вышло на скрытом поле №" + g.broke.field + "." : "");
    if (g.score === 2) return "На всех " + g.total + " полях закрашено ровно нужное — " +
      "и на поле с очень длинными стенами и проходами.";
    var h = "Алгоритм завершается и Робот цел. Больше всего ошибок на одном поле: " +
      "лишних — " + g.maxExtra + " " + kl(g.maxExtra) + ", пропущено — " + g.maxMissed + " " + kl(g.maxMissed) + ". ";
    return h + (g.score === 1
      ? "Это не больше 10 — на 1 балл."
      : "Больше 10 — это 0: эксперт считает ошибку при очень длинных стенах и проходах, " +
        "а на нашем поле с очень длинными стенами она уже переросла порог.");
  }

  function verdictHTML(g){
    if (g.score === null)
      return '<div class="stepnote fipi16"><b>📝 Балл за экзамен здесь не назвать</b>' +
        '<p>Эксперт ФИПИ не снижает балл за ошибки записи — он читает алгоритм глазами ' +
        '(с. 43–44). Мы глазами не читаем: сначала исправь запись, и проверка скажет, ' +
        'сколько было бы.</p></div>';
    return '<div class="stepnote fipi16"><b>📝 На ОГЭ за этот алгоритм было бы ' +
      g.score + ' из ' + g.max + ' баллов</b><p>' + esc(reasonHTML(g)) + '</p>' +
      '<p>2 балла — верно при любых длинах стен и проходов; 1 — алгоритм завершается, ' +
      'Робот цел, лишних и пропущенных клеток не больше 10; 0 — иначе.</p>' +
      '<p class="dim">Правила — ' + esc(DOC.title) + ', ' + DOC.pages + '.</p></div>';
  }

  function pack(g){
    return { s: g.score, e: g.maxExtra || 0, m: g.maxMissed || 0, t: g.total || 0,
             b: g.broke ? { why: g.broke.why, field: g.broke.field } : null, at: Date.now() };
  }
  function unpack(r){
    return { score: r.s, max: MAX, maxExtra: r.e, maxMissed: r.m, total: r.t, broke: r.b };
  }

  return { DOC: DOC, MAX: MAX, LIMIT: LIMIT, applies: applies, scoreOf: scoreOf,
           grade: grade, verdictHTML: verdictHTML, reasonHTML: reasonHTML,
           pack: pack, unpack: unpack };
})();
