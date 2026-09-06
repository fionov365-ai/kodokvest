/* ============================================================
   Слой движка. Игра НЕ обращается к интерпретатору напрямую —
   только через Runtime. Дверь открыта намеренно: у слоя два адаптера,
   и второй — настоящий CPython.

   ⚠️ Курс, уроки, экзамен, разминки и все сверки с python3 живут и будут
   жить на «mini». Тяжёлый движок включается ЧЕЛОВЕКОМ и только в песочнице
   (docs/golos-i-produkty-2026-09-06.md § 3.7а): иначе у нас два набора
   уроков и вдвое больше проверок.

   Контракт адаптера:
     name            строка
     title           как показывать человеку
     supportsTurtle  можно ли рисовать
     supportsStep    можно ли идти по шагам
     load()          Promise — подготовить движок
     run(code, o)    { output, lines, turtle, error, steps }
     stepper(code,o) { interp, turtle, next() } либо null
   ============================================================ */
var Runtime = (function(){
  var adapters = {};
  var loaded = {};

  function register(a){ adapters[a.name] = a; }

  function get(name){ return adapters[name] || adapters.mini; }

  /* onProgress необязателен: тяжёлый движок сообщает им проценты загрузки,
     лёгкому сообщать нечего — он готов сразу. */
  function load(name, onProgress){
    var a = get(name);
    if (loaded[a.name]) return Promise.resolve(a);
    return Promise.resolve(a.load ? a.load(onProgress) : null).then(function(){
      loaded[a.name] = true;
      return a;
    });
  }

  /* ---------- адаптер 1: встроенный мини-Python ---------- */
  register({
    name: "mini",
    title: "Быстрый Python",
    note: "Встроенный интерпретатор: запускается мгновенно и работает без интернета. Понимает всё, что нужно до 70-го урока.",
    supportsTurtle: true,
    supportsStep: true,
    load: function(){ return null; },
    newTurtle: function(){ return new MiniPy.Turtle(); },
    run: function(code, o){ return MiniPy.run(code, o); },
    stepper: function(code, o){ return MiniPy.stepper(code, o); },
    snapshotVars: function(env, skip){ return MiniPy.snapshotVars(env, skip); }
  });

  /* ---------- адаптер 2: настоящий CPython (Pyodide) ----------
     Тяжёлый контур. Правило про него записано в
     docs/golos-i-produkty-2026-09-06.md § 3.7 и коротко звучит так:

       • лёгкий контур — это продукт: 1,7 МБ, офлайн, старт мгновенный;
       • тяжёлое включает ЧЕЛОВЕК, а не мы, и только в песочнице;
       • тяжёлое не попадает ни в SHELL в sw.js, ни в однофайловую сборку;
       • пока кнопку не нажали, не грузится ни один байт.

     Поэтому здесь нет ни одного обращения к сети до вызова load(), а сам
     load() зовётся только из кнопки в песочнице (screenSandbox в js/app.js).

     Файлы лежат СВОИ, в vendor/pyodide/ — решение фаундера 06.09.2026.
     Версия 314.0.6, то есть CPython 3.14 — та же ветка, что у python3, которым
     сверяется весь курс. Выбрана не из любви к свежему: гит не забывает, и
     переложить версию потом стоило бы ещё шести мегабайт в истории навсегда.
     Своя копия честнее по обещанию «ничего не грузится извне», не зависит от
     доступности jsdelivr из России и — главное — даёт офлайн бесплатно:
     sw.js кэширует всё со своего домена, а чужие адреса не трогает вовсе.
     Ценой 11,7 МБ на диске и около 5 МБ в гите; по сети едет ещё меньше.
  ------------------------------------------------------------- */

  /* Путь относительный: сайт живёт и в корне, и в /kodokvest/, и оба раза
     это «рядом со страницей». Ровно так же подключены js/ и content/. */
  var PY_BASE = "vendor/pyodide/";

  /* Сколько байт распаковано приезжает — чтобы показать честный процент.
     Считаем только два тяжёлых файла: остальное на их фоне незаметно, а
     asm.js Pyodide может забрать не через fetch, и процент бы застрял. */
  var PY_WEIGH = { "pyodide.asm.wasm": 9598218, "python_stdlib.zip": 2545564 };

  var py = null;        /* сам движок, когда загружен */
  var pyBusy = null;    /* обещание загрузки, чтобы не начать её дважды */

  /* Русские имена типов — они попадают внутрь объяснений ошибок. */
  var PY_TYPE_RU = { str:"строки", int:"числа", float:"числа", list:"списка",
    dict:"словаря", tuple:"кортежа", set:"множества", bool:"логического значения",
    NoneType:"пустого значения None", "function":"функции", range:"range" };
  function typeRu(t){ return PY_TYPE_RU[t] || "значения типа " + t; }

  /* Настоящий Python говорит по-английски. Здесь — перевод того, обо что
     ребёнок спотыкается чаще всего; остальное остаётся как сказал Python:
     заголовок ошибки всё равно русский (KIND_RU в js/app.js). */
  var PY_RU = [
    [/^name '(.+)' is not defined$/, function(m){
      return "Имя «" + m[1] + "» не определено. Может быть, опечатка, или переменную ещё не создали?"; }],
    [/^(division by zero|integer division or modulo by zero|float division by zero|float modulo)$/,
      function(){ return "Делить на ноль нельзя."; }],
    [/^list index out of range$/, function(){
      return "Номер за пределами списка: столько элементов в нём нет. Помни, что счёт идёт с нуля."; }],
    [/^string index out of range$/, function(){
      return "Номер за пределами строки: столько знаков в ней нет. Помни, что счёт идёт с нуля."; }],
    [/^tuple index out of range$/, function(){
      return "Номер за пределами кортежа: столько элементов в нём нет."; }],
    [/^No module named '(.+)'$/, function(m){
      return "Модуля «" + m[1] + "» здесь нет. Скачано ядро Python со стандартной библиотекой — " +
             "math, random, json, re, csv, datetime и остальные работают."; }],
    [/^can only concatenate str \(not "(.+)"\) to str$/, function(m){
      return "Плюсом к строке можно прибавить только строку, а тут " + typeRu(m[1]) + ". " +
             "Переведи в строку: str(значение)."; }],
    [/^unsupported operand type\(s\) for (.+?): '(.+)' and '(.+)'$/, function(m){
      return "Знак " + m[1] + " не умеет работать с парой «" + typeRu(m[2]) + " и " + typeRu(m[3]) + "»."; }],
    [/^invalid literal for int\(\) with base 10: (.+)$/, function(m){
      return "int() не смог превратить " + m[1] + " в число: там не только цифры."; }],
    [/^could not convert string to float: (.+)$/, function(m){
      return "float() не смог превратить " + m[1] + " в число."; }],
    [/^'(.+)' object has no attribute '(.+)'$/, function(m){
      return "У " + typeRu(m[1]) + " нет команды «" + m[2] + "». Проверь написание."; }],
    [/^'(.+)' object is not subscriptable$/, function(m){
      return "У " + typeRu(m[1]) + " нельзя взять элемент квадратными скобками."; }],
    [/^'(.+)' object is not callable$/, function(m){
      return "Это не функция — круглые скобки после " + typeRu(m[1]) + " ничего не вызывают."; }],
    [/^'(.+)' object is not iterable$/, function(m){
      return "По " + typeRu(m[1]) + " нельзя пройти циклом for."; }],
    [/^'(.+)' object cannot be interpreted as an integer$/, function(m){
      return "Здесь нужно целое число, а не " + typeRu(m[1]) + "."; }],
    [/^object of type '(.+)' has no len\(\)$/, function(m){
      return "У " + typeRu(m[1]) + " нет длины: len() тут не работает."; }],
    [/^not enough values to unpack \(expected (\d+), got (\d+)\)$/, function(m){
      return "Слева стоит " + m[1] + " имени, а справа значений только " + m[2] + "."; }],
    [/^too many values to unpack \(expected (\d+)\)$/, function(m){
      return "Слева стоит " + m[1] + " имени, а справа значений больше."; }],
    [/^EOF when reading a line$/, function(){
      return "Ответы для input() кончились: программа спросила больше, чем ей заготовили."; }],
    [/^invalid syntax\.?$/, function(){
      return "Python не понял эту строку. Проверь скобки, кавычки и двоеточие."; }],
    [/^expected ':'$/, function(){ return "Не хватает двоеточия в конце строки."; }],
    [/^'(.)' was never closed$/, function(m){
      return "Скобка «" + m[1] + "» открыта, а закрыть её забыли."; }],
    [/^unterminated string literal/, function(){
      return "Кавычка открыта, а закрыть её забыли."; }],
    [/^unmatched '(.)'$/, function(m){
      return "Закрывающая скобка «" + m[1] + "» есть, а открывающей к ней нет."; }],
    [/^cannot assign to (.+) here.*$/, function(){
      return "Слева от знака = должно стоять имя переменной."; }],
    [/^unexpected indent$/, function(){ return "Лишний отступ в начале строки."; }],
    [/^unindent does not match any outer indentation level$/, function(){
      return "Отступ не совпал ни с одним из тех, что выше."; }],
    [/^expected an indented block/, function(){
      return "После двоеточия строка обязана быть с отступом."; }],
    [/^maximum recursion depth exceeded/, function(){
      return "Функция вызывает сама себя без конца — не хватает условия остановки."; }]
  ];

  function pyMsgRu(kind, msg){
    msg = String(msg == null ? "" : msg);
    for (var i = 0; i < PY_RU.length; i++){
      var m = msg.match(PY_RU[i][0]);
      if (m) return PY_RU[i][1](m);
    }
    if (kind === "KeyError") return "Ключа " + msg + " в словаре нет.";
    return msg;
  }

  /* Прогресс загрузки. Pyodide качает файлы сам, поэтому на время загрузки
     подменяем fetch и считаем прочитанные байты своих файлов. Ответ
     пересобираем из потока — заголовок content-type сохраняем, иначе
     WebAssembly.instantiateStreaming откажется его читать. */
  function pyWithProgress(onPct, work){
    var g = (typeof window !== "undefined") ? window : null;
    if (!g || typeof g.fetch !== "function" || typeof ReadableStream === "undefined")
      return work();
    var orig = g.fetch, total = 0, seen = 0;
    Object.keys(PY_WEIGH).forEach(function(k){ total += PY_WEIGH[k]; });

    function counted(url){
      for (var name in PY_WEIGH) if (url.indexOf(name) >= 0) return true;
      return false;
    }
    g.fetch = function(input){
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var p = orig.apply(this, arguments);
      if (!counted(url)) return p;
      return p.then(function(res){
        if (!res || !res.ok || !res.body) return res;
        var reader = res.body.getReader();
        var stream = new ReadableStream({ start: function(c){
          (function pump(){
            reader.read().then(function(r){
              if (r.done){ c.close(); return; }
              seen += r.value.byteLength;
              try { onPct(Math.min(99, Math.floor(seen / total * 100))); } catch(e){}
              c.enqueue(r.value);
              pump();
            }, function(e){ c.error(e); });
          })();
        }});
        var h = new Headers();
        var ct = res.headers.get("content-type");
        if (ct) h.set("content-type", ct);
        return new Response(stream, { status: res.status, statusText: res.statusText, headers: h });
      });
    };
    function restore(){ g.fetch = orig; }
    return work().then(function(v){ restore(); return v; },
                       function(e){ restore(); throw e; });
  }

  function pyScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement("script");
      s.src = src;
      s.onload = function(){ res(); };
      s.onerror = function(){ rej(new Error("не удалось загрузить " + src)); };
      document.head.appendChild(s);
    });
  }

  /* Обвязка на стороне Python. Она делает три вещи, и все три нужны, чтобы
     настоящий CPython вёл себя как наш движок:
       1. ловит вывод в буфер — иначе print уходил бы в консоль браузера;
       2. переводит падение в наш вид { kind, line, msg } с номером строки
          в программе РЕБЁНКА, а не во внутренностях Python;
       3. держит время: без этого «while True:» вешает вкладку насмерть и
          ребёнок теряет написанный код. Мини-движок так и устроен (maxSteps),
          и текст сообщения здесь тот же самый. */
  var PY_SETUP = [
    "import sys, io, json, time, builtins",
    "class __KoStop(BaseException): pass",
    "__KO_SEC = 10.0",
    "__KO_MAXOUT = 200000",
    "def __ko_line(e):",
    "    if isinstance(e, SyntaxError): return e.lineno or 0",
    "    n, tb = 0, e.__traceback__",
    "    while tb is not None:",
    "        if tb.tb_frame.f_code.co_filename == '<program>': n = tb.tb_lineno",
    "        tb = tb.tb_next",
    "    return n",
    "def __ko_run(src):",
    "    buf = io.StringIO()",
    "    out, err = sys.stdout, sys.stderr",
    "    res = {}",
    "    try:",
    "        code = compile(src, '<program>', 'exec')",
    "    except SyntaxError as e:",
    "        return json.dumps({'out': '', 'kind': type(e).__name__,",
    "                           'line': e.lineno or 0, 'msg': str(e.msg)})",
    "    stop = time.time() + __KO_SEC",
    "    seen = [0]",
    "    def watch(frame, event, arg):",
    "        seen[0] += 1",
    "        if seen[0] % 2000 == 0 and time.time() > stop: raise __KoStop()",
    "        return watch",
    "    bad = None",
    "    sys.stdout = sys.stderr = buf",
    "    try:",
    "        sys.settrace(watch)",
    "        exec(code, {'__name__': '__main__', '__builtins__': builtins})",
    "    except __KoStop:",
    "        bad = ('RuntimeError', 0, '__timeout__')",
    "    except SystemExit:",
    "        pass",
    "    except BaseException as e:",
    "        bad = (type(e).__name__, __ko_line(e), str(e))",
    "    finally:",
    "        sys.settrace(None)",
    "        sys.stdout, sys.stderr = out, err",
    "    text = buf.getvalue()",
    "    if len(text) > __KO_MAXOUT:",
    "        text = text[:__KO_MAXOUT]",
    "        res['cut'] = True",
    "    res['out'] = text",
    "    if bad: res['kind'], res['line'], res['msg'] = bad",
    "    return json.dumps(res)"
  ].join("\n");

  register({
    name: "pyodide",
    title: "Настоящий Python",
    note: "Тот самый CPython, что стоит на компьютерах взрослых, целиком в браузере. " +
          "Загружается один раз по кнопке, дальше работает и без интернета.",
    supportsTurtle: false,
    supportsStep: false,
    available: true,

    /* Грузится ТОЛЬКО отсюда и ТОЛЬКО по кнопке. onProgress — необязательный:
       песочница передаёт в него отрисовку полоски. */
    load: function(onProgress){
      if (py) return Promise.resolve(py);
      if (pyBusy) return pyBusy;
      if (typeof window === "undefined" || typeof document === "undefined")
        return Promise.reject(new Error("Настоящий Python работает только в браузере."));
      /* Однофайловая сборка обещает «всё внутри, ничего не грузится извне»,
         и рядом с ней никакой папки vendor нет. Проверка, а не надежда. */
      if (window.__SINGLE_FILE__)
        return Promise.reject(new Error(
          "В сборке одним файлом настоящего Python нет: он живёт отдельной папкой рядом с сайтом."));
      var pct = typeof onProgress === "function" ? onProgress : function(){};
      pyBusy = pyWithProgress(pct, function(){
        return pyScript(PY_BASE + "pyodide.js").then(function(){
          if (typeof window.loadPyodide !== "function")
            throw new Error("файл pyodide.js загрузился, но движка в нём не оказалось");
          return window.loadPyodide({ indexURL: PY_BASE });
        });
      }).then(function(engine){
        engine.runPython(PY_SETUP);
        py = engine;
        pyBusy = null;
        pct(100);
        return py;
      }, function(e){
        pyBusy = null;
        throw e;
      });
      return pyBusy;
    },

    run: function(code, o){
      o = o || {};
      var res = { output:"", lines:[], turtle:null, error:null, steps:0 };
      if (!py){
        res.error = { kind:"NotSupported", line:0,
          msg:"Настоящий Python ещё не загружен. Нажми кнопку в песочнице — он скачается один раз." };
        return res;
      }
      /* input() читает заготовленные ответы, как и в мини-движке.
         Кончились — Python сам бросит EOFError, а мы переведём его. */
      var feed = (o.stdin || []).slice();
      try {
        py.setStdin({ isatty: false, stdin: function(){ return feed.length ? feed.shift() : null; } });
      } catch(e){}
      var raw;
      try {
        py.globals.set("__ko_src", String(code || ""));
        raw = py.runPython("__ko_run(__ko_src)");
      } catch(e){
        res.error = { kind:"RuntimeError", line:0,
          msg:"Настоящий Python не смог запустить программу: " + (e && e.message ? e.message : e) };
        return res;
      }
      var got = null;
      try { got = JSON.parse(raw); } catch(e){}
      if (!got){
        res.error = { kind:"RuntimeError", line:0, msg:"Ответ движка не разобрать." };
        return res;
      }
      res.output = got.out || "";
      if (got.cut) res.output += "\n… вывод обрезан: слишком много строк.";
      res.lines = res.output.length ? res.output.replace(/\n$/, "").split("\n") : [];
      if (got.kind){
        res.error = { kind: got.kind, line: got.line || 0,
          msg: got.msg === "__timeout__"
            ? "Программа выполняется слишком долго. Скорее всего, цикл никогда не заканчивается — проверь условие в while."
            : pyMsgRu(got.kind, got.msg) };
      }
      return res;
    },

    stepper: function(){ return null; }
  });

  return { register: register, get: get, load: load,
           has: function(n){ return !!adapters[n]; },
           isReady: function(n){ return !!loaded[n] || n === "mini"; } };
})();
