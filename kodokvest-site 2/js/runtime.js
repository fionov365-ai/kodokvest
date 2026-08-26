/* ============================================================
   Слой движка. Игра НЕ обращается к интерпретатору напрямую —
   только через Runtime. Это нужно, чтобы уроки 71+ смогли
   переключиться на настоящий CPython (Pyodide) без переписывания
   всего остального.

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

  function load(name){
    var a = get(name);
    if (loaded[a.name]) return Promise.resolve(a);
    return Promise.resolve(a.load ? a.load() : null).then(function(){
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
     Пока заглушка. Чтобы включить, нужно:
       1. положить файлы Pyodide в папку vendor/pyodide/
       2. в load() подгрузить vendor/pyodide/pyodide.js
       3. реализовать run() поверх pyodide.runPython с перехватом stdout
     В артефакте claude.ai это не заработает (внешние файлы запрещены),
     поэтому уроки с engine:"pyodide" открываются только на своём хостинге.
  ------------------------------------------------------------- */
  register({
    name: "pyodide",
    title: "Настоящий Python",
    note: "Полноценный CPython в браузере со стандартной библиотекой и пакетами. Загружается один раз, около 10 МБ.",
    supportsTurtle: false,
    supportsStep: false,
    available: false,
    load: function(){
      return Promise.reject(new Error("Настоящий Python пока не подключён к этой сборке."));
    },
    run: function(){
      return { output: "", lines: [], turtle: null, steps: 0,
        error: { kind:"NotSupported", line:0,
          msg:"Этот урок работает на настоящем Python, который в текущей сборке ещё не подключён." } };
    },
    stepper: function(){ return null; }
  });

  return { register: register, get: get, load: load,
           has: function(n){ return !!adapters[n]; },
           isReady: function(n){ return !!loaded[n] || n === "mini"; } };
})();
