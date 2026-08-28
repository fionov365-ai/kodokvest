/* ============================================================
   Мини-Python: лексер, парсер, интерпретатор (пошаговый).
   Без внешних зависимостей. Работает офлайн.
   ============================================================ */
(function(global){
"use strict";

/* ---------- ошибки ---------- */
/* kind — имя ошибки («ValueError»), msg — русское объяснение для карточки.
   opts.pymsg — текст, который вернёт str(e): у настоящего Python он английский
   и короткий, и в уроках про try/except важно показать именно его.
   opts.fatal — защита тренажёра (вечный цикл, слишком много вывода).
   Такую ошибку нельзя поймать никаким except, иначе защиту обойти легко. */
function PyErr(kind, msg, line, opts){
  opts = opts || {};
  var e = new Error(msg);
  e.pyKind = kind; e.pyMsg = msg; e.pyLine = line;
  e.pyExc = opts.exc || mkExc(kind, opts.pymsg !== undefined ? opts.pymsg : msg);
  if (opts.fatal) e.pyFatal = true;
  return e;
}
function raise(kind, msg, line, opts){ throw PyErr(kind, msg, line, opts); }
/* Бросить готовый объект-исключение (raise ValueError("...") у ученика). */
function raiseObj(exc, line){
  var cls = exc.cls;
  throw PyErr(cls.name, excMessage(exc) || ("Исключение " + cls.name + " не перехвачено."),
              line, { exc: exc, pymsg: excMessage(exc) });
}

/* ---------- числа: int vs float ---------- */
var FLOATTAG = "__isFloat__";
function mkFloat(v){
  var n = new Number(v); n[FLOATTAG] = true; return n;
}
function isNum(x){ return typeof x === "number" || x instanceof Number; }
function isFloat(x){
  if (x instanceof Number) return !!x[FLOATTAG] || !Number.isInteger(+x);
  return typeof x === "number" && !Number.isInteger(x);
}
function nv(x){ return +x; }
function num(v, floaty){
  if (floaty || !Number.isInteger(v)) return mkFloat(v);
  return v;
}

/* ---------- кортеж ---------- */
function Tup(arr){ var a = arr.slice(); a.__tuple__ = true; return a; }
function isTup(x){ return Array.isArray(x) && x.__tuple__ === true; }

/* ---------- множество ----------
   Храним по «ключу значения» (как словарь), чтобы 1 и 1.0 не дублировались.
   Порядок — порядок вставки. В настоящем Python у множества порядка нет вообще,
   поэтому в уроках всё, что печатается, оборачивается в sorted(). */
function PySet(items){
  this.m = new Map();
  if (items) for (var i = 0; i < items.length; i++) this.add(items[i]);
}
PySet.prototype.add = function(v){ this.m.set(keyOf(v), v); };
PySet.prototype.has = function(v){ return this.m.has(keyOf(v)); };
PySet.prototype.del = function(v){ return this.m.delete(keyOf(v)); };
PySet.prototype.values = function(){ return Array.from(this.m.values()); };
Object.defineProperty(PySet.prototype, "size", { get: function(){ return this.m.size; } });

/* ---------- функция пользователя ---------- */
function PyFunc(name, params, defaults, body, closure, extra){
  this.name = name; this.params = params; this.defaults = defaults;
  this.body = body; this.closure = closure;
  extra = extra || {};
  this.vararg = extra.vararg || null;   // имя после * — сюда попадут лишние позиционные
  this.kwarg = extra.kwarg || null;     // имя после ** — сюда попадут лишние именованные
  this.owner = null;                    // класс, если это метод
  this.doc = null;                      // строка документации, если она есть
}

/* Строка документации — первая строка в теле функции, класса или модуля.
   В Python она не выполняется, а кладётся в __doc__. */
function docOf(body){
  if (!body || !body.length) return null;
  var first = body[0];
  if (first.type === "ExprStmt" && first.value && first.value.type === "Str")
    return first.value.value;
  return null;
}

/* ---------- типы как настоящие значения ----------
   В Python type(12) — это класс int, и печатается он как <class 'int'>.
   Раньше движок возвращал строку "int", и это было расхождение.
   Теперь тип — полноценное значение: его можно печатать, сравнивать,
   вызывать (int("5")), от него можно наследоваться. */
function PyType(name, base, opts){
  opts = opts || {};
  this.name = name;
  this.base = base || null;
  this.ctor = opts.ctor || null;      // как создать значение встроенного типа
  this.module = opts.module || null;  // "__main__" у классов ученика
  this.attrs = new Map();             // методы и поля класса
  this.isExc = !!opts.isExc || (base ? base.isExc : false);
}
PyType.prototype.lookup = function(name){
  var t = this;
  while (t){ if (t.attrs.has(name)) return t.attrs.get(name); t = t.base; }
  return undefined;
};
PyType.prototype.fullName = function(){
  if (this.module && this.name.indexOf(".") === 0) return this.name;
  if (this.module && this.name.indexOf(this.module + ".") === 0) return this.name;
  return this.module ? this.module + "." + this.name : this.name;
};
PyType.prototype.shortName = function(){
  var i = this.name.lastIndexOf(".");
  return i < 0 ? this.name : this.name.slice(i + 1);
};
function isSubType(a, b){
  var t = a;
  while (t){ if (t === b) return true; t = t.base; }
  return false;
}

/* ---------- объект пользовательского класса ---------- */
function PyObj(cls){
  this.cls = cls;
  this.fields = new Map();
  this.excArgs = null;   // заполняется у исключений
}

/* ---------- генератор ----------
   Функция с yield при вызове ничего не считает: она возвращает генератор.
   Значения появляются по одному, когда их просят. Внутри — тот же пошаговый
   обход тела, только шаги отладчика мы пропускаем, а питоновские yield отдаём. */
function PyGen(name, it){
  this.name = name; this.it = it;
  this.done = false; this.started = false;
}
PyGen.prototype.next = function(sent){
  if (this.done) return { done: true };
  this.started = true;
  for (;;){
    var step = this.it.next(sent);
    sent = undefined;
    if (step.done){ this.done = true; return { done: true, value: null }; }
    if (step.value && step.value.pyYield !== undefined)
      return { done: false, value: step.value.pyYield };
    /* шаг отладчика — просто идём дальше */
  }
};

/* Генератор из обычной JS-функции-генератора значений — так устроены
   ленивые вещи из itertools: count, cycle, chain и остальные. */
function genOf(name, makeIter){
  var wrapper = (function*(){
    var it = makeIter();
    for (;;){
      var s = it.next();
      if (s.done) return;
      yield { pyYield: s.value };
    }
  })();
  return new PyGen(name, wrapper);
}

/* ---------- модуль ---------- */
function PyModule(name){ this.name = name; this.vars = new Map(); this.doc = null; }

/* ---------- файлы ----------
   Настоящего диска в браузере нет. Файлы живут в памяти запуска: что урок
   положил заранее, то и лежит; что программа записала — видно ей же.
   Для ученика это неотличимо от работы с диском: open, чтение, запись, with. */
function PyDisk(initial){
  this.files = new Map();
  if (initial) for (var k in initial) this.files.set(k, String(initial[k]));
}
PyDisk.prototype.has = function(name){ return this.files.has(name); };
PyDisk.prototype.read = function(name){ return this.files.get(name); };
PyDisk.prototype.write = function(name, text){ this.files.set(name, text); };
PyDisk.prototype.list = function(){ return Array.from(this.files.keys()).sort(); };
PyDisk.prototype.remove = function(name){ return this.files.delete(name); };

function PyFile(disk, name, mode, line, rawNewline){
  this.disk = disk; this.name = name; this.mode = mode;
  this.rawNewline = !!rawNewline;
  this.closed = false; this.pos = 0; this.buf = "";
  if (mode.indexOf("r") >= 0){
    if (!disk.has(name))
      raise("FileNotFoundError", "Файла «" + name + "» нет. Есть такие: " +
            (disk.list().length ? disk.list().join(", ") : "ни одного") + ".", line,
            { pymsg: "[Errno 2] No such file or directory: '" + name + "'" });
    /* Python при чтении текстового файла приводит концы строк к \n,
       даже если в файле лежит \r\n — так делает и csv.writer.
       Но если открыли с newline="" — оставляет как есть, и это важно для csv. */
    var raw = disk.read(name);
    this.buf = rawNewline ? raw : raw.replace(/\r\n/g, "\n");
  } else if (mode.indexOf("a") >= 0){
    this.buf = disk.has(name) ? disk.read(name) : "";
    this.pos = this.buf.length;
  } else {
    this.buf = "";
    disk.write(name, "");
  }
}
PyFile.prototype.checkOpen = function(line){
  if (this.closed)
    raise("ValueError", "Файл «" + this.name + "» уже закрыт — читать и писать в него нельзя.", line,
          { pymsg: "I/O operation on closed file." });
};
PyFile.prototype.readAll = function(){ var t = this.buf.slice(this.pos); this.pos = this.buf.length; return t; };
PyFile.prototype.lines = function(){
  var t = this.readAll();
  if (!t.length) return [];
  var parts = t.split("\n");
  var out = [];
  for (var i = 0; i < parts.length; i++){
    if (i === parts.length - 1){ if (parts[i] !== "") out.push(parts[i]); }
    else out.push(parts[i] + "\n");
  }
  return out;
};
PyFile.prototype.readLine = function(){
  if (this.pos >= this.buf.length) return "";
  var nl = this.buf.indexOf("\n", this.pos);
  var end = nl < 0 ? this.buf.length : nl + 1;
  var line = this.buf.slice(this.pos, end);
  this.pos = end;
  return line;
};
PyFile.prototype.append = function(text){ this.buf += text; this.disk.write(this.name, this.buf); };
PyFile.prototype.close = function(){
  if (!this.closed && this.mode.indexOf("r") < 0) this.disk.write(this.name, this.buf);
  this.closed = true;
};

/* ---------- метод, привязанный к объекту ----------
   dog.hello — это уже не просто функция: она помнит, у кого её взяли,
   и подставит этот объект первым аргументом (тот самый self). */
function Bound(fn, self){ this.fn = fn; this.self = self; }

/* super() внутри метода: тот же объект, но искать методы начиная с родителя. */
function SuperProxy(cls, self){ this.cls = cls; this.self = self; }

/* Текущий интерпретатор. Нужен печати: если у класса есть __repr__,
   его надо выполнить, а печать вызывается из мест, где интерпретатора под рукой нет. */
var CUR = null;
function callSync(fn, args, line){
  if (!CUR) return null;
  var it = CUR.call(fn, args || [], {}, line || 0, null);
  var s = it.next();
  while (!s.done) s = it.next();
  return s.value;
}

/* ---------- встроенные типы и иерархия исключений ---------- */
var TYPES = {};
function defType(name, base, opts){
  var t = new PyType(name, base || null, opts);
  TYPES[name] = t;
  return t;
}
defType("object", null);
defType("type", TYPES.object);
defType("int", TYPES.object);
defType("float", TYPES.object);
defType("bool", TYPES.int);
defType("str", TYPES.object);
defType("list", TYPES.object);
defType("tuple", TYPES.object);
defType("dict", TYPES.object);
defType("set", TYPES.object);
defType("NoneType", TYPES.object);
defType("function", TYPES.object);
defType("module", TYPES.object);
defType("TextIOWrapper", TYPES.object);
defType("generator", TYPES.object);
defType("datetime.date", TYPES.object, { module:"datetime" });
defType("datetime.datetime", TYPES["datetime.date"], { module:"datetime" });
defType("datetime.timedelta", TYPES.object, { module:"datetime" });
defType("pathlib.Path", TYPES.object, { module:"pathlib" });
defType("re.Match", TYPES.object, { module:"re" });
defType("csvwriter", TYPES.object);

/* Дерево исключений — как в настоящем Python, только короче.
   Порядок важен: except ловит и сам класс, и всех его наследников. */
defType("BaseException", TYPES.object, { isExc: true });
defType("Exception", TYPES.BaseException);
defType("ArithmeticError", TYPES.Exception);
defType("ZeroDivisionError", TYPES.ArithmeticError);
defType("LookupError", TYPES.Exception);
defType("IndexError", TYPES.LookupError);
defType("KeyError", TYPES.LookupError);
defType("ValueError", TYPES.Exception);
defType("TypeError", TYPES.Exception);
defType("NameError", TYPES.Exception);
defType("AttributeError", TYPES.Exception);
defType("RuntimeError", TYPES.Exception);
defType("RecursionError", TYPES.RuntimeError);
defType("AssertionError", TYPES.Exception);
defType("ImportError", TYPES.Exception);
defType("StopIteration", TYPES.Exception);
defType("NotImplementedError", TYPES.RuntimeError);
defType("UnboundLocalError", TYPES.NameError);
defType("OSError", TYPES.Exception);
defType("FileNotFoundError", TYPES.OSError);
defType("IndentationError", TYPES.Exception);
defType("SyntaxError", TYPES.Exception);
defType("EOFError", TYPES.Exception);
/* «Здесь так нельзя» — не питоновская ошибка, а сообщение тренажёра.
   Наследуем от BaseException, чтобы «except Exception» её не проглатывал. */
defType("NotSupported", TYPES.BaseException);

/* Все исключения умеют создаваться вызовом: ValueError("текст").
   Конструктор нарочно не зависит от интерпретатора — типы общие на весь движок. */
var EXC_NAMES = Object.keys(TYPES).filter(function(n){ return TYPES[n].isExc; });
EXC_NAMES.forEach(function(n){
  var t = TYPES[n];
  t.ctor = function(args){
    var o = new PyObj(t);
    o.excArgs = (args || []).slice();
    return o;
  };
});

/* json.JSONDecodeError — наследник ValueError. Заведён отдельно и уже после
   EXC_NAMES: в Python это не встроенное имя, добраться до него можно только
   через модуль (json.JSONDecodeError), и «except ValueError» его ловит. */
TYPES["JSONDecodeError"] = new PyType("JSONDecodeError", TYPES.ValueError, { module: "json" });
TYPES["JSONDecodeError"].ctor = function(args){
  var o = new PyObj(TYPES["JSONDecodeError"]);
  o.excArgs = (args || []).slice();
  return o;
};

function typeOf(v){
  if (v instanceof PyObj) return v.cls;
  if (v instanceof PyType) return TYPES.type;
  if (v instanceof PyModule) return TYPES.module;
  var n = typeName(v);
  return TYPES[n] || TYPES.object;
}

/* Собрать объект-исключение по имени вида "ValueError".
   msg — текст для str(e). */
function mkExc(kindName, msg){
  var cls = TYPES[kindName] || TYPES.RuntimeError;
  var o = new PyObj(cls);
  o.excArgs = msg === undefined || msg === null ? [] : [msg];
  return o;
}
function excMessage(o){
  if (!o.excArgs || !o.excArgs.length) return "";
  if (o.excArgs.length === 1){
    /* KeyError печатает ключ в кавычках — это его особенность */
    if (isSubType(o.cls, TYPES.KeyError) && typeof o.excArgs[0] === "string") return pyRepr(o.excArgs[0]);
    return pyStr(o.excArgs[0]);
  }
  return pyRepr(Tup(o.excArgs));
}

/* ============================================================
   ЛЕКСЕР
   ============================================================ */
var OPS3 = ["**=", "//=", "..."];
var OPS2 = ["**","//","==","!=","<=",">=","+=","-=","*=","/=","%=","->"];
var OPS1 = "+-*/%()[]{}:,.<>=|&^@".split("");

function isIdStart(c){ return /[A-Za-z_Ѐ-ӿёЁ]/.test(c); }
function isIdPart(c){ return /[A-Za-z0-9_Ѐ-ӿёЁ]/.test(c); }

function lex(src){
  src = String(src).replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  if (src.length && src[src.length-1] !== "\n") src += "\n";
  var toks = [], indents = [0], i = 0, line = 1, depth = 0, atStart = true, openStack = [];

  function push(t, v){ toks.push({t:t, v:v, line:line}); }

  while (i < src.length){
    if (atStart && depth === 0){
      var j = i, n = 0;
      while (src[j] === " "){ n++; j++; }
      if (src[j] === "\n" || src[j] === undefined || src[j] === "#"){
        while (j < src.length && src[j] !== "\n") j++;
        if (src[j] === "\n"){ j++; line++; }
        i = j; continue;
      }
      if (n > indents[indents.length-1]){ indents.push(n); push("INDENT"); }
      else if (n < indents[indents.length-1]){
        while (n < indents[indents.length-1]){ indents.pop(); push("DEDENT"); }
        if (n !== indents[indents.length-1])
          raise("IndentationError", "Отступ не совпадает ни с одним из предыдущих. Проверь, сколько пробелов в начале строки.", line);
      }
      i = j; atStart = false; continue;
    }

    var c = src[i];

    if (c === "\n"){
      i++;
      if (depth === 0){ push("NEWLINE"); atStart = true; }
      line++;
      continue;
    }
    if (c === " "){ i++; continue; }
    if (c === "#"){ while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "\\" && src[i+1] === "\n"){ i += 2; line++; continue; }

    // строки
    var pref = "";
    if ((c === "f" || c === "F" || c === "r" || c === "R") && (src[i+1] === '"' || src[i+1] === "'")){
      pref = c.toLowerCase(); i++; c = src[i];
    }
    if (c === '"' || c === "'"){
      var q = c, buf = "", start = line;
      var triple = (src[i+1] === q && src[i+2] === q);
      if (triple){
        i += 3;
        while (i < src.length && !(src[i] === q && src[i+1] === q && src[i+2] === q)){
          if (src[i] === "\n") line++;
          buf += src[i]; i++;
        }
        if (i >= src.length) raise("SyntaxError", "Не закрыты тройные кавычки.", start);
        i += 3;
      } else {
        i++;
        while (i < src.length && src[i] !== q){
          if (src[i] === "\n") raise("SyntaxError", "Кавычка открыта, но не закрыта до конца строки.", start);
          if (src[i] === "\\" && pref !== "r"){
            var e = src[i+1];
            buf += e === "n" ? "\n" : e === "t" ? "\t" : e === "\\" ? "\\" :
                   e === "'" ? "'" : e === '"' ? '"' : e === "0" ? "\0" : ("\\" + e);
            i += 2; continue;
          }
          buf += src[i]; i++;
        }
        if (i >= src.length || src[i] !== q) raise("SyntaxError", "Кавычка открыта, но не закрыта.", start);
        i++;
      }
      push(pref === "f" ? "FSTRING" : "STRING", buf);
      continue;
    }

    // числа
    if (/[0-9]/.test(c)){
      var s = "";
      while (i < src.length && /[0-9_]/.test(src[i])){ s += src[i]; i++; }
      var flt = false;
      if (src[i] === "." && /[0-9]/.test(src[i+1] || "")){
        flt = true; s += "."; i++;
        while (i < src.length && /[0-9_]/.test(src[i])){ s += src[i]; i++; }
      }
      push("NUMBER", { v: parseFloat(s.replace(/_/g, "")), f: flt });
      continue;
    }

    // имена
    if (isIdStart(c)){
      var name = "";
      while (i < src.length && isIdPart(src[i])){ name += src[i]; i++; }
      push("NAME", name);
      continue;
    }

    // операторы
    var three = src.substr(i, 3), two = src.substr(i, 2);
    if (OPS3.indexOf(three) >= 0){ push("OP", three); i += 3; continue; }
    if (OPS2.indexOf(two) >= 0){ push("OP", two); i += 2; continue; }
    if (OPS1.indexOf(c) >= 0){
      if (c === "(" || c === "[" || c === "{"){ depth++; openStack.push({ c: c, line: line }); }
      if (c === ")" || c === "]" || c === "}"){ depth--; openStack.pop(); }
      if (depth < 0) raise("SyntaxError", "Лишняя закрывающая скобка «" + c + "».", line);
      push("OP", c); i++; continue;
    }
    if (c === ";"){ push("NEWLINE"); i++; continue; }
    raise("SyntaxError", "Непонятный символ «" + c + "».", line);
  }
  if (depth > 0){
    var op = openStack[openStack.length-1] || { c: "(", line: line };
    raise("SyntaxError", "Скобка «" + op.c + "» открыта, но не закрыта.", op.line);
  }
  if (toks.length && toks[toks.length-1].t !== "NEWLINE") push("NEWLINE");
  while (indents.length > 1){ indents.pop(); push("DEDENT"); }
  push("EOF");
  return toks;
}

/* ============================================================
   ПАРСЕР
   ============================================================ */
var KW_STMT = ["if","elif","else","while","for","def","return","break","continue","pass","import","from","class","try","except","finally","with","global","raise","del","assert","yield"];

function Parser(toks){ this.toks = toks; this.p = 0; }
Parser.prototype = {
  peek: function(k){ return this.toks[this.p + (k||0)]; },
  get line(){ return (this.peek() || {line:0}).line; },
  at: function(t, v){ var x = this.peek(); return x.t === t && (v === undefined || x.v === v); },
  atOp: function(v){ return this.at("OP", v); },
  atKw: function(v){ return this.at("NAME", v); },
  next: function(){ return this.toks[this.p++]; },
  eat: function(t, v){ if (this.at(t, v)){ return this.next(); } return null; },
  expectOp: function(v, hint){
    if (this.atOp(v)) return this.next();
    raise("SyntaxError", hint || ("Ожидался символ «" + v + "»."), this.line);
  },
  expectName: function(){
    if (this.at("NAME")) return this.next().v;
    raise("SyntaxError", "Ожидалось имя.", this.line);
  },
  skipNewlines: function(){ while (this.at("NEWLINE")) this.next(); },

  parseProgram: function(){
    var body = [];
    this.skipNewlines();
    while (!this.at("EOF")){
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    return { type:"Module", body: body };
  },

  parseBlock: function(kw){
    this.expectOp(":", "После «" + kw + "» нужно двоеточие. Например: " + kw + " ... :");
    if (this.at("NEWLINE")){
      this.skipNewlines();
      if (!this.at("INDENT"))
        raise("IndentationError", "После «" + kw + ":» следующая строка должна быть с отступом (4 пробела).", this.line);
      this.next();
      var body = [];
      this.skipNewlines();
      while (!this.at("DEDENT") && !this.at("EOF")){
        body.push(this.parseStatement());
        this.skipNewlines();
      }
      this.eat("DEDENT");
      if (!body.length) raise("IndentationError", "Пустой блок после «" + kw + ":».", this.line);
      return body;
    }
    return [this.parseSimple()];
  },

  parseStatement: function(){
    var tk = this.peek();
    if (tk.t === "NAME"){
      switch (tk.v){
        case "if": return this.parseIf();
        case "while": return this.parseWhile();
        case "for": return this.parseFor();
        case "def": return this.parseDef();
        case "elif": raise("SyntaxError", "«elif» без «if» выше или с неверным отступом.", tk.line);
        case "else": raise("SyntaxError", "«else» без «if», «for» или «while» выше.", tk.line);
        case "try": return this.parseTry();
        case "with": return this.parseWith();
        case "class": return this.parseClass();
        case "import": case "from": return this.parseImport();
        case "except":
          raise("SyntaxError", "«except» без «try» выше или с неверным отступом.", tk.line);
        case "finally":
          raise("SyntaxError", "«finally» без «try» выше или с неверным отступом.", tk.line);
      }
    }
    if (tk.t === "OP" && tk.v === "@"){
      return this.parseDecorated();
    }
    if (tk.t === "INDENT")
      raise("IndentationError", "Лишний отступ в начале строки.", tk.line);
    return this.parseSimple();
  },

  parseSimple: function(){
    var tk = this.peek(), line = tk.line;
    if (tk.t === "NAME"){
      if (tk.v === "return"){
        this.next();
        var val = null;
        /* parseExprList, а не parseExpr: «return a, b» отдаёт кортеж —
           именно на этом держится возврат нескольких значений. */
        if (!this.at("NEWLINE") && !this.at("EOF")) val = this.parseExprList();
        return { type:"Return", value: val, line: line };
      }
      if (tk.v === "break"){ this.next(); return { type:"Break", line: line }; }
      if (tk.v === "continue"){ this.next(); return { type:"Continue", line: line }; }
      if (tk.v === "pass"){ this.next(); return { type:"Pass", line: line }; }
      if (tk.v === "raise"){
        this.next();
        var exc = null;
        if (!this.at("NEWLINE") && !this.at("EOF")) exc = this.parseExpr();
        if (this.atKw("from"))
          raise("NotSupported", "Запись «raise ... from ...» в тренажёре не нужна — достаточно «raise ...».", line);
        return { type:"Raise", exc: exc, line: line };
      }
      if (tk.v === "assert"){
        this.next();
        var atest = this.parseExpr();
        var amsg = null;
        if (this.atOp(",")){ this.next(); amsg = this.parseExpr(); }
        return { type:"Assert", test: atest, msg: amsg, line: line };
      }
      if (tk.v === "global"){
        this.next(); var names = [this.expectName()];
        while (this.atOp(",")){ this.next(); names.push(this.expectName()); }
        return { type:"Global", names: names, line: line };
      }
      if (tk.v === "print" && this.peek(1) && this.peek(1).t !== "OP")
        raise("SyntaxError", "В Python 3 print — это функция. Нужны скобки: print(...)", line);
    }

    var target = this.parseExprList();

    /* имя: тип  и  имя: тип = значение — подсказка типа.
       Внутри класса из таких строк собирается список полей для @dataclass. */
    if (this.atOp(":") && target.type === "Name"){
      this.next();
      var ann = this.parseExpr();
      var aval = null;
      if (this.atOp("=")){ this.next(); aval = this.parseExpr(); }
      return { type:"AnnAssign", name: target.id, annotation: ann, value: aval, line: line };
    }

    var AUG = ["+=","-=","*=","/=","//=","%=","**="];
    for (var k = 0; k < AUG.length; k++){
      if (this.atOp(AUG[k])){
        this.next();
        var rhs = this.parseExpr();
        this.assertTarget(target, line);
        return { type:"AugAssign", target: target, op: AUG[k].slice(0, -1), value: rhs, line: line };
      }
    }

    if (this.atOp("=")){
      var targets = [target];
      var value = null;
      while (this.atOp("=")){
        this.next();
        value = this.parseExprList();
        if (this.atOp("=")) targets.push(value);
      }
      targets.forEach(function(t){ this.assertTarget(t, line); }, this);
      return { type:"Assign", targets: targets, value: value, line: line };
    }

    if (target.type === "Tuple" && target.elts.length > 1 && this.at("NEWLINE")){
      // выражение-кортеж как отдельный оператор — допустимо
    }
    return { type:"ExprStmt", value: target, line: line };
  },

  assertTarget: function(t, line){
    if (t.type === "Name" || t.type === "Subscript" || t.type === "Attribute") return;
    if (t.type === "Tuple" || t.type === "List"){
      t.elts.forEach(function(e){ this.assertTarget(e, line); }, this);
      return;
    }
    raise("SyntaxError", "Слева от «=» должно стоять имя переменной.", line);
  },

  parseIf: function(){
    var line = this.line;
    this.next();
    var test = this.parseExpr();
    if (test.type === "Assign")
      raise("SyntaxError", "В условии нужно двойное равно «==», одинарное «=» — это присваивание.", line);
    var body = this.parseBlock("if");
    var orelse = [];
    this.skipNewlines();
    if (this.atKw("elif")){ orelse = [this.parseIf()]; }
    else if (this.atKw("else")){ this.next(); orelse = this.parseBlock("else"); }
    return { type:"If", test: test, body: body, orelse: orelse, line: line };
  },

  parseWhile: function(){
    var line = this.line;
    this.next();
    var test = this.parseExpr();
    var body = this.parseBlock("while");
    var orelse = [];
    this.skipNewlines();
    if (this.atKw("else")){ this.next(); orelse = this.parseBlock("else"); }
    return { type:"While", test: test, body: body, orelse: orelse, line: line };
  },

  parseFor: function(){
    var line = this.line;
    this.next();
    var target = this.parseTargetList();
    if (!this.atKw("in"))
      raise("SyntaxError", "В цикле for нужно слово «in». Например: for i in range(5):", line);
    this.next();
    var iter = this.parseExprList();
    var body = this.parseBlock("for");
    return { type:"For", target: target, iter: iter, body: body, line: line };
  },

  parseTargetList: function(){
    var first = this.parseUnary();
    if (this.atOp(",")){
      var elts = [first];
      while (this.atOp(",")){
        this.next();
        if (this.atKw("in")) break;
        elts.push(this.parseUnary());
      }
      return { type:"Tuple", elts: elts };
    }
    return first;
  },

  parseDef: function(){
    var line = this.line;
    this.next();
    var name = this.expectName();
    this.expectOp("(", "После имени функции нужны скобки.");
    var sig = this.parseParams();
    this.expectOp(")", "Не закрыта скобка в объявлении функции.");
    if (this.atOp("->")){ this.next(); this.parseExpr(); }   // подсказку типа читаем и не мешаем
    var body = this.parseBlock("def " + name + "(...)");
    return { type:"FuncDef", name: name, params: sig.params, defaults: sig.defaults,
             vararg: sig.vararg, kwarg: sig.kwarg, body: body, line: line };
  },

  /* Список параметров: обычные, со значением по умолчанию,
     *имя (сюда попадут все лишние по порядку) и **имя (все лишние по имени). */
  parseParams: function(){
    var params = [], defaults = [], vararg = null, kwarg = null;
    while (!this.atOp(")")){
      if (this.atOp("**")){
        this.next(); kwarg = this.expectName();
      } else if (this.atOp("*")){
        this.next();
        if (this.at("NAME")) vararg = this.expectName();
      } else {
        var pn = this.expectName();
        if (this.atOp(":")){ this.next(); this.parseExpr(); }   // подсказка типа
        var dflt = null;
        if (this.atOp("=")){ this.next(); dflt = this.parseExpr(); }
        params.push(pn); defaults.push(dflt);
      }
      if (this.atOp(",")) this.next(); else break;
    }
    return { params: params, defaults: defaults, vararg: vararg, kwarg: kwarg };
  },

  parseClass: function(){
    var line = this.line;
    this.next();
    var name = this.expectName();
    var bases = [];
    if (this.atOp("(")){
      this.next();
      while (!this.atOp(")")){
        bases.push(this.parseExpr());
        if (this.atOp(",")) this.next(); else break;
      }
      this.expectOp(")", "Не закрыта скобка после имени класса.");
    }
    var body = this.parseBlock("class " + name);
    return { type:"ClassDef", name: name, bases: bases, body: body, decorators: [], line: line };
  },

  /* @имя над def или class. Пишем свои декораторы в Мире 4,
     а применять готовые (например @dataclass) нужно уже здесь. */
  parseDecorated: function(){
    var decs = [];
    while (this.atOp("@")){
      var dline = this.line;
      this.next();
      decs.push(this.parseExpr());
      if (!this.at("NEWLINE"))
        raise("SyntaxError", "После @декоратора строка должна закончиться.", dline);
      this.skipNewlines();
    }
    if (this.atKw("def")){ var d = this.parseDef(); d.decorators = decs; return d; }
    if (this.atKw("class")){ var c = this.parseClass(); c.decorators = decs; return c; }
    raise("SyntaxError", "После @декоратора должна идти строка с «def» или «class».", this.line);
  },

  parseImport: function(){
    var line = this.line;
    if (this.atKw("import")){
      this.next();
      var items = [];
      for (;;){
        var nm = this.expectName();
        var as = null;
        if (this.atKw("as")){ this.next(); as = this.expectName(); }
        items.push({ name: nm, as: as });
        if (this.atOp(",")){ this.next(); continue; }
        break;
      }
      return { type:"Import", items: items, line: line };
    }
    this.next();                     // from
    var mod = this.expectName();
    if (!this.atKw("import"))
      raise("SyntaxError", "После «from имя» нужно слово «import». Например: from math import sqrt", line);
    this.next();
    if (this.atOp("*")){ this.next(); return { type:"ImportFrom", module: mod, names: "*", line: line }; }
    var open = this.atOp("(");
    if (open) this.next();
    var names = [];
    for (;;){
      var n2 = this.expectName();
      var a2 = null;
      if (this.atKw("as")){ this.next(); a2 = this.expectName(); }
      names.push({ name: n2, as: a2 });
      if (this.atOp(",")){ this.next(); continue; }
      break;
    }
    if (open) this.expectOp(")", "Не закрыта скобка в import.");
    return { type:"ImportFrom", module: mod, names: names, line: line };
  },

  /* with открывает что-то и обязательно закрывает — даже если внутри ошибка.
     Поддерживаем несколько предметов через запятую: with A as a, B as b: */
  parseWith: function(){
    var line = this.line;
    this.next();
    var items = [];
    for (;;){
      var expr = this.parseExpr();
      var name = null;
      if (this.atKw("as")){ this.next(); name = this.expectName(); }
      items.push({ expr: expr, name: name });
      if (this.atOp(",")){ this.next(); continue; }
      break;
    }
    var body = this.parseBlock("with");
    return { type:"With", items: items, body: body, line: line };
  },

  parseTry: function(){
    var line = this.line;
    this.next();
    var body = this.parseBlock("try");
    var handlers = [], orelse = [], finalbody = [];
    this.skipNewlines();
    while (this.atKw("except")){
      var hline = this.line;
      this.next();
      var typ = null, nm = null;
      if (!this.atOp(":")){
        typ = this.parseExpr();
        if (this.atKw("as")){ this.next(); nm = this.expectName(); }
      }
      handlers.push({ etype: typ, name: nm, body: this.parseBlock("except"), line: hline });
      this.skipNewlines();
    }
    if (this.atKw("else")){ this.next(); orelse = this.parseBlock("else"); this.skipNewlines(); }
    if (this.atKw("finally")){ this.next(); finalbody = this.parseBlock("finally"); }
    if (!handlers.length && !finalbody.length)
      raise("SyntaxError", "После «try:» нужен хотя бы один «except:» или «finally:».", line);
    for (var i = 0; i < handlers.length - 1; i++)
      if (!handlers[i].etype)
        raise("SyntaxError", "«except:» без имени ошибки ловит всё, поэтому должен идти последним.", handlers[i].line);
    return { type:"Try", body: body, handlers: handlers, orelse: orelse, finalbody: finalbody, line: line };
  },

  parseExprList: function(){
    var first = this.parseExpr();
    if (this.atOp(",")){
      var elts = [first];
      while (this.atOp(",")){
        this.next();
        if (this.at("NEWLINE") || this.atOp("=") || this.at("EOF")) break;
        elts.push(this.parseExpr());
      }
      return { type:"Tuple", elts: elts, line: first.line };
    }
    return first;
  },

  parseExpr: function(){
    if (this.atKw("lambda")) return this.parseLambda();
    if (this.atKw("yield")) return this.parseYield();
    return this.parseTernary();
  },

  /* yield отдаёт значение наружу и замирает до следующего запроса.
     yield from перебирает другой генератор целиком. */
  parseYield: function(){
    var line = this.line;
    this.next();
    if (this.atKw("from")){
      this.next();
      return { type:"YieldFrom", value: this.parseExpr(), line: line };
    }
    if (this.at("NEWLINE") || this.at("EOF") || this.atOp(")") || this.atOp("]") || this.atOp("}"))
      return { type:"Yield", value: null, line: line };
    return { type:"Yield", value: this.parseExprList(), line: line };
  },

  /* lambda a, b: выражение — короткая функция без имени */
  parseLambda: function(){
    var line = this.line;
    this.next();
    var params = [], defaults = [];
    while (!this.atOp(":")){
      params.push(this.expectName());
      defaults.push(null);
      if (this.atOp(",")) this.next(); else break;
    }
    this.expectOp(":", "После параметров lambda нужно двоеточие. Например: lambda x: x * 2");
    return { type:"Lambda", params:params, defaults:defaults, body:this.parseExpr(), line:line };
  },

  /* «for ... in ... if ...» внутри включения; может повторяться */
  parseCompClauses: function(){
    var clauses = [];
    while (this.atKw("for")){
      this.next();
      var target = this.parseTargetList();
      if (!this.atKw("in"))
        raise("SyntaxError", "Во включении после переменной нужно слово «in». Например: [x for x in nums]", this.line);
      this.next();
      var iter = this.parseOr();
      var ifs = [];
      while (this.atKw("if")) { this.next(); ifs.push(this.parseOr()); }
      clauses.push({ target: target, iter: iter, ifs: ifs });
    }
    return clauses;
  },

  parseTernary: function(){
    var v = this.parseOr();
    if (this.atKw("if")){
      this.next();
      var cond = this.parseOr();
      if (!this.atKw("else")) raise("SyntaxError", "В коротком if нужно «else».", this.line);
      this.next();
      var other = this.parseTernary();
      return { type:"Ternary", body: v, test: cond, orelse: other, line: v.line };
    }
    return v;
  },

  parseOr: function(){
    var l = this.parseAnd();
    while (this.atKw("or")){ this.next(); l = { type:"BoolOp", op:"or", left:l, right:this.parseAnd(), line:l.line }; }
    return l;
  },
  parseAnd: function(){
    var l = this.parseNot();
    while (this.atKw("and")){ this.next(); l = { type:"BoolOp", op:"and", left:l, right:this.parseNot(), line:l.line }; }
    return l;
  },
  parseNot: function(){
    if (this.atKw("not")){ var ln = this.line; this.next(); return { type:"Not", value:this.parseNot(), line:ln }; }
    return this.parseCompare();
  },
  /* Цепочка сравнений: 0 < x < 10 — это «0 < x and x < 10»,
     причём x вычисляется один раз, как в настоящем Python. */
  parseCompare: function(){
    var first = this.parseBitOr();
    var CMP = ["==","!=","<",">","<=",">="];
    var ops = [], rights = [];
    for (;;){
      var op = null;
      for (var k = 0; k < CMP.length; k++) if (this.atOp(CMP[k])){ op = CMP[k]; break; }
      if (op){ this.next(); ops.push(op); rights.push(this.parseBitOr()); continue; }
      if (this.atKw("in")){ this.next(); ops.push("in"); rights.push(this.parseBitOr()); continue; }
      if (this.atKw("not") && this.peek(1).t === "NAME" && this.peek(1).v === "in"){
        this.next(); this.next();
        ops.push("not in"); rights.push(this.parseBitOr()); continue;
      }
      if (this.atKw("is")){
        this.next();
        var neg = false;
        if (this.atKw("not")){ this.next(); neg = true; }
        ops.push(neg ? "is not" : "is"); rights.push(this.parseBitOr()); continue;
      }
      break;
    }
    if (!ops.length) return first;
    if (ops.length === 1)
      return { type:"Compare", op:ops[0], left:first, right:rights[0], line:first.line };
    return { type:"CompareChain", first:first, ops:ops, rights:rights, line:first.line };
  },

  parseBitOr: function(){
    var l = this.parseBitXor();
    while (this.atOp("|")){ this.next(); l = { type:"BinOp", op:"|", left:l, right:this.parseBitXor(), line:l.line }; }
    return l;
  },
  parseBitXor: function(){
    var l = this.parseBitAnd();
    while (this.atOp("^")){ this.next(); l = { type:"BinOp", op:"^", left:l, right:this.parseBitAnd(), line:l.line }; }
    return l;
  },
  parseBitAnd: function(){
    var l = this.parseAdd();
    while (this.atOp("&")){ this.next(); l = { type:"BinOp", op:"&", left:l, right:this.parseAdd(), line:l.line }; }
    return l;
  },
  parseAdd: function(){
    var l = this.parseMul();
    while (this.atOp("+") || this.atOp("-")){
      var op = this.next().v;
      l = { type:"BinOp", op:op, left:l, right:this.parseMul(), line:l.line };
    }
    return l;
  },
  parseMul: function(){
    var l = this.parseUnary();
    while (this.atOp("*") || this.atOp("/") || this.atOp("//") || this.atOp("%")){
      var op = this.next().v;
      l = { type:"BinOp", op:op, left:l, right:this.parseUnary(), line:l.line };
    }
    return l;
  },
  parseUnary: function(){
    if (this.atOp("-")){ var ln = this.line; this.next(); return { type:"Neg", value:this.parseUnary(), line:ln }; }
    if (this.atOp("+")){ this.next(); return this.parseUnary(); }
    return this.parsePower();
  },
  parsePower: function(){
    var base = this.parsePostfix();
    if (this.atOp("**")){
      this.next();
      return { type:"BinOp", op:"**", left:base, right:this.parseUnary(), line:base.line };
    }
    return base;
  },
  parsePostfix: function(){
    var node = this.parseAtom();
    for (;;){
      if (this.atOp("(")){
        this.next();
        var args = [], kwargs = {}, dstar = [];
        while (!this.atOp(")")){
          if (this.atOp("**")){                       // f(**словарь)
            this.next(); dstar.push(this.parseExpr());
          } else if (this.atOp("*")){                 // f(*список)
            this.next(); args.push({ type:"Star", value:this.parseExpr(), line:node.line });
          } else if (this.at("NAME") && this.peek(1) && this.peek(1).t === "OP" && this.peek(1).v === "=" &&
              !(this.peek(2) && this.peek(2).t === "OP" && this.peek(2).v === "=")){
            var kn = this.next().v; this.next();
            kwargs[kn] = this.parseExpr();
          } else {
            var argExpr = this.parseExpr();
            /* sum(x * 2 for x in числа) — генераторное выражение без своих
               скобок. Разрешено только когда аргумент один: так же в Python. */
            if (this.atKw("for")){
              if (args.length || Object.keys(kwargs).length || dstar.length)
                raise("SyntaxError", "Генераторное выражение можно писать без своих скобок только когда аргумент один. Возьми его в скобки.", this.line);
              var gcl = this.parseCompClauses();
              argExpr = { type:"Comp", kind:"gen", value: argExpr, clauses: gcl, line: node.line };
            }
            args.push(argExpr);
          }
          if (this.atOp(",")) this.next(); else break;
        }
        this.expectOp(")", "Не закрыта круглая скобка у вызова.");
        node = { type:"Call", func:node, args:args, kwargs:kwargs, dstar:dstar, line:node.line };
        continue;
      }
      if (this.atOp("[")){
        this.next();
        var lower = null, upper = null, step = null, isSlice = false;
        if (!this.atOp(":")) lower = this.parseExpr();
        if (this.atOp(":")){
          isSlice = true; this.next();
          if (!this.atOp("]") && !this.atOp(":")) upper = this.parseExpr();
          if (this.atOp(":")){ this.next(); if (!this.atOp("]")) step = this.parseExpr(); }
        }
        this.expectOp("]", "Не закрыта квадратная скобка.");
        node = isSlice
          ? { type:"Slice", value:node, lower:lower, upper:upper, step:step, line:node.line }
          : { type:"Subscript", value:node, index:lower, line:node.line };
        continue;
      }
      if (this.atOp(".")){
        this.next();
        var attr = this.expectName();
        node = { type:"Attribute", value:node, attr:attr, line:node.line };
        continue;
      }
      return node;
    }
  },
  parseAtom: function(){
    var tk = this.peek(), line = tk.line;
    if (tk.t === "NUMBER"){ this.next(); return { type:"Num", value:tk.v.v, isFloat:tk.v.f, line:line }; }
    if (tk.t === "STRING"){ this.next(); return { type:"Str", value:tk.v, line:line }; }
    if (tk.t === "FSTRING"){ this.next(); return { type:"FStr", parts: parseFString(tk.v, line), line:line }; }
    if (tk.t === "NAME"){
      if (tk.v === "True"){ this.next(); return { type:"Const", value:true, line:line }; }
      if (tk.v === "False"){ this.next(); return { type:"Const", value:false, line:line }; }
      if (tk.v === "None"){ this.next(); return { type:"Const", value:null, line:line }; }
      if (KW_STMT.indexOf(tk.v) >= 0)
        raise("SyntaxError", "Слово «" + tk.v + "» не может стоять здесь.", line);
      this.next();
      return { type:"Name", id:tk.v, line:line };
    }
    if (this.atOp("(")){
      this.next();
      if (this.atOp(")")){ this.next(); return { type:"Tuple", elts:[], line:line }; }
      var e = this.parseExpr();
      if (this.atKw("for")){
        var pcl = this.parseCompClauses();
        this.expectOp(")", "Не закрыта круглая скобка у генераторного выражения.");
        return { type:"Comp", kind:"gen", value:e, clauses:pcl, line:line };
      }
      if (this.atOp(",")){
        var elts = [e];
        while (this.atOp(",")){ this.next(); if (this.atOp(")")) break; elts.push(this.parseExpr()); }
        this.expectOp(")", "Не закрыта круглая скобка.");
        return { type:"Tuple", elts:elts, line:line };
      }
      this.expectOp(")", "Не закрыта круглая скобка.");
      return e;
    }
    if (this.atOp("[")){
      this.next();
      if (this.atOp("]")){ this.next(); return { type:"List", elts:[], line:line }; }
      var firstItem = this.parseExpr();
      if (this.atKw("for")){
        var lcl = this.parseCompClauses();
        this.expectOp("]", "Не закрыта квадратная скобка у включения.");
        return { type:"Comp", kind:"list", value:firstItem, clauses:lcl, line:line };
      }
      var items = [firstItem];
      if (this.atOp(",")) this.next();
      while (!this.atOp("]")){
        items.push(this.parseExpr());
        if (this.atOp(",")) this.next(); else break;
      }
      this.expectOp("]", "Не закрыта квадратная скобка у списка.");
      return { type:"List", elts:items, line:line };
    }
    if (this.atOp("{")){
      this.next();
      /* {} — это пустой словарь, а не пустое множество: так и в Python */
      if (this.atOp("}")){ this.next(); return { type:"Dict", keys:[], values:[], line:line }; }
      var k1 = this.parseExpr();
      if (this.atOp(":")){
        this.next();
        var v1 = this.parseExpr();
        if (this.atKw("for")){
          var dcl = this.parseCompClauses();
          this.expectOp("}", "Не закрыта фигурная скобка у включения.");
          return { type:"Comp", kind:"dict", key:k1, value:v1, clauses:dcl, line:line };
        }
        var keys = [k1], vals = [v1];
        if (this.atOp(",")) this.next();
        while (!this.atOp("}")){
          var kk = this.parseExpr();
          this.expectOp(":", "В словаре после ключа нужно двоеточие.");
          keys.push(kk); vals.push(this.parseExpr());
          if (this.atOp(",")) this.next(); else break;
        }
        this.expectOp("}", "Не закрыта фигурная скобка.");
        return { type:"Dict", keys:keys, values:vals, line:line };
      }
      if (this.atKw("for")){
        var scl = this.parseCompClauses();
        this.expectOp("}", "Не закрыта фигурная скобка у включения.");
        return { type:"Comp", kind:"set", value:k1, clauses:scl, line:line };
      }
      var selts = [k1];
      if (this.atOp(",")) this.next();
      while (!this.atOp("}")){
        selts.push(this.parseExpr());
        if (this.atOp(",")) this.next(); else break;
      }
      this.expectOp("}", "Не закрыта фигурная скобка у множества.");
      return { type:"SetLit", elts:selts, line:line };
    }
    if (tk.t === "NEWLINE") raise("SyntaxError", "Строка обрывается — не хватает выражения.", line);
    raise("SyntaxError", "Непонятное место рядом с «" + (tk.v !== undefined ? tk.v : tk.t) + "».", line);
  }
};

/* Где в {...} кончается выражение и начинается формат.
   Двоеточие считается разделителем только на верхнем уровне: внутри
   скобок это срез (s[1:3]), внутри кавычек — просто символ,
   а внутри фигурных — словарь. */
function splitFormatSpec(code){
  var depth = 0, quote = null;
  for (var i = 0; i < code.length; i++){
    var ch = code[i];
    if (quote){
      if (ch === "\\"){ i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"'){ quote = ch; continue; }
    if (ch === "(" || ch === "[" || ch === "{"){ depth++; continue; }
    if (ch === ")" || ch === "]" || ch === "}"){ depth--; continue; }
    if (ch === ":" && depth === 0) return { code: code.slice(0, i), spec: code.slice(i + 1) };
  }
  return { code: code, spec: "" };
}

/* "{имя} набрал {0:.2f}".format(3.5, имя="аня") — старший брат f-строки.
   Раньше движок понимал только пустые {} и молча оставлял всё остальное
   как есть: строка выглядела правильной, а внутри был шаблон. */
function formatTemplate(tmpl, args, kw, line){
  var out = "", i = 0, auto = 0;

  function lookup(field){
    field = field.trim();
    if (field === ""){
      if (auto >= args.length)
        raise("IndexError", "В format() не хватило значений для очередной пары скобок.", line,
              { pymsg: "Replacement index " + auto + " out of range for positional args tuple" });
      return args[auto++];
    }
    if (/^\d+$/.test(field)){
      var n = parseInt(field, 10);
      if (n >= args.length)
        raise("IndexError", "В format() нет значения номер " + n + ".", line,
              { pymsg: "Replacement index " + n + " out of range for positional args tuple" });
      return args[n];
    }
    if (/^[^\W\d]\w*$/.test(field) || /^[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_]*$/.test(field)){
      if (!(field in kw))
        raise("KeyError", "В format() не передали «" + field + "».", line, { pymsg: field });
      return kw[field];
    }
    raise("NotSupported", "В format() поддерживаются номер, имя или пустые скобки. Обращение вида «" + field +
      "» тренажёр не разбирает — проще написать f-строку.", line);
  }

  while (i < tmpl.length){
    var c = tmpl[i];
    if (c === "{" && tmpl[i+1] === "{"){ out += "{"; i += 2; continue; }
    if (c === "}" && tmpl[i+1] === "}"){ out += "}"; i += 2; continue; }
    if (c !== "{"){ out += c; i++; continue; }
    var depth = 1, body = "";
    i++;
    while (i < tmpl.length && depth > 0){
      if (tmpl[i] === "{") depth++;
      if (tmpl[i] === "}"){ depth--; if (!depth) break; }
      body += tmpl[i]; i++;
    }
    if (depth > 0) raise("ValueError", "В format() не закрыта фигурная скобка.", line,
                         { pymsg: "Single '{' encountered in format string" });
    i++;
    var split = splitFormatSpec(body);
    var field = split.code, spec = split.spec, conv = null;
    var cm = /^(.*)!([rsa])$/.exec(field);
    if (cm){ field = cm[1]; conv = cm[2]; }
    var v = lookup(field);
    if (conv === "r" || conv === "a") v = pyRepr(v);
    else if (conv === "s") v = pyStr(v);
    /* ширина и точность тоже могут прийти из значений: "{:{}}".format(x, 8) */
    if (spec.indexOf("{") >= 0)
      spec = spec.replace(/\{([^{}]*)\}/g, function(_, inner){ return pyStr(lookup(inner)); });
    out += applySpec(v, spec.trim(), line);
  }
  return out;
}

function parseFString(raw, line){
  var parts = [], buf = "", i = 0;
  while (i < raw.length){
    var c = raw[i];
    if (c === "{"){
      if (raw[i+1] === "{"){ buf += "{"; i += 2; continue; }
      if (buf){ parts.push({ text: buf }); buf = ""; }
      var depth = 1, code = "";
      i++;
      while (i < raw.length && depth > 0){
        if (raw[i] === "{") depth++;
        if (raw[i] === "}") { depth--; if (!depth) break; }
        code += raw[i]; i++;
      }
      if (depth > 0) raise("SyntaxError", "В f-строке не закрыта фигурная скобка.", line);
      i++;
      var split = splitFormatSpec(code);
      var body = split.code.trim(), conv = null;
      /* {x!r} — показать как repr, {x!s} — как str. В Python это «конверсия». */
      var cm = /^(.*[^!])!([rsa])$/.exec(body);
      if (cm){ body = cm[1].trim(); conv = cm[2]; }
      parts.push({ code: body, spec: split.spec.trim(), conv: conv, line: line });
      continue;
    }
    if (c === "}"){ if (raw[i+1] === "}"){ buf += "}"; i += 2; continue; } buf += "}"; i++; continue; }
    buf += c; i++;
  }
  if (buf) parts.push({ text: buf });
  return parts;
}

function parse(src){
  var p = new Parser(lex(src));
  return p.parseProgram();
}

/* ============================================================
   ЗНАЧЕНИЯ: печать и сравнение
   ============================================================ */
/* Python округляет половинки к ближайшему ЧЁТНОМУ: round(2.5) = 2, round(3.5) = 4.
   JavaScript всегда вверх, поэтому пишем своё.

   Умножать на 10^n нельзя: 2.675 * 100 в двоичной арифметике даёт ровно 267.5,
   хотя само 2.675 чуть меньше двух с половиной шестьюдесятью семью сотыми —
   и Python честно выдаёт 2.67. Поэтому работаем с полной десятичной записью
   числа как со строкой: только так видно, настоящая это половинка или нет. */
function toFixedPy(x, digits){
  digits = digits || 0;
  if (!isFinite(x)) return String(x);
  var s = x.toPrecision(20);
  if (s.indexOf("e") >= 0 || s.indexOf("E") >= 0) return x.toFixed(digits);
  var neg = s[0] === "-";
  if (neg) s = s.slice(1);
  var dot = s.indexOf(".");
  var ip = dot < 0 ? s : s.slice(0, dot);
  var fp = dot < 0 ? "" : s.slice(dot + 1);
  while (fp.length <= digits) fp += "0";
  var keep = ip + fp.slice(0, digits), rest = fp.slice(digits);
  var up;
  if (rest[0] > "5") up = true;
  else if (rest[0] < "5") up = false;
  else {
    var tail = rest.slice(1).replace(/0+$/, "");
    if (tail.length) up = true;                                  // больше половины
    else up = ((keep.charCodeAt(keep.length - 1) - 48) % 2) === 1; // ровно половина
  }
  var d = keep.split("");
  if (up){
    var i = d.length - 1;
    while (i >= 0){
      if (d[i] === "9"){ d[i] = "0"; i--; }
      else { d[i] = String(+d[i] + 1); break; }
    }
    if (i < 0) d.unshift("1");
  }
  var out = d.join("");
  var intLen = out.length - digits;
  var head = out.slice(0, intLen).replace(/^0+(?=\d)/, "");
  if (head === "") head = "0";
  var res = digits ? head + "." + out.slice(intLen) : head;
  return (neg ? "-" : "") + res;
}
function roundHalfEven(x, digits){ return parseFloat(toFixedPy(x, digits || 0)); }

function fmtNum(x){
  var v = nv(x);
  if (isFloat(x)){
    if (Number.isInteger(v) && Math.abs(v) < 1e16) return v.toFixed(1);
    return String(v);
  }
  return String(v);
}
/* repr строки, как в Python: перевод строки виден как \n, а не рвёт вывод.
   Кавычки одинарные, но если внутри есть ' и нет " — Python берёт двойные. */
function strRepr(v){
  var q = (v.indexOf("'") >= 0 && v.indexOf('"') < 0) ? '"' : "'";
  var out = "";
  for (var i = 0; i < v.length; i++){
    var c = v[i];
    if (c === "\\") out += "\\\\";
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c === "\t") out += "\\t";
    else if (c === q) out += "\\" + c;
    else out += c;
  }
  return q + out + q;
}
function pyRepr(v){
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (isNum(v)) return fmtNum(v);
  if (typeof v === "string") return strRepr(v);
  if (v instanceof PyType) return "<class '" + v.fullName() + "'>";
  if (v instanceof PyModule) return "<module '" + v.name + "'>";
  if (v instanceof PyFile) return "<файл '" + v.name + "'>";
  if (v instanceof PyGen) return "<генератор " + v.name + ">";
  if (v instanceof Bound) return "<метод " + v.fn.name + ">";
  if (v instanceof PyObj) return objRepr(v);
  if (v instanceof PySet)
    return v.size === 0 ? "set()" : "{" + v.values().map(pyRepr).join(", ") + "}";
  if (isTup(v)) return "(" + v.map(pyRepr).join(", ") + (v.length === 1 ? "," : "") + ")";
  if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
  if (v instanceof Map){
    var out = [];
    v.forEach(function(val, k){ out.push(pyRepr(k) + ": " + pyRepr(val)); });
    return "{" + out.join(", ") + "}";
  }
  if (v instanceof PyFunc) return "<функция " + v.name + ">";
  if (typeof v === "function") return "<встроенная функция>";
  return String(v);
}
/* Как объект показывает себя в repr(). Если у класса есть __repr__ — слушаем его. */
function objRepr(o){
  var r = o.cls.lookup("__repr__");
  if (r) return pyStr(callSync(new Bound(r, o), [], 0));
  if (o.cls === TYPES["datetime.date"]){
    var p = dtParts(o);
    return "datetime.date(" + p.y + ", " + p.mo + ", " + p.d + ")";
  }
  if (o.cls === TYPES["datetime.datetime"]){
    var q = dtParts(o);
    return "datetime.datetime(" + q.y + ", " + q.mo + ", " + q.d +
           (q.h || q.mi || q.s ? ", " + q.h + ", " + q.mi + (q.s ? ", " + q.s : "") : "") + ")";
  }
  if (o.cls === TYPES["datetime.timedelta"]){
    var days = Math.floor(o.tdMs / 86400000), secs = Math.floor((o.tdMs % 86400000) / 1000);
    var bits = [];
    if (days) bits.push("days=" + days);
    if (secs) bits.push("seconds=" + secs);
    return "datetime.timedelta(" + (bits.length ? bits.join(", ") : "0") + ")";
  }
  if (o.cls === TYPES["pathlib.Path"]) return "PosixPath('" + o.fields.get("__path__") + "')";
  if (o.cls === TYPES["re.Match"]){
    var m = o.reMatch;
    return "<re.Match object; span=(" + m.index + ", " + (m.index + m[0].length) + "), match=" + strRepr(m[0]) + ">";
  }
  if (o.cls.isExc)
    return o.cls.name + "(" + (o.excArgs || []).map(pyRepr).join(", ") + ")";
  /* Настоящий Python пишет здесь адрес в памяти — его повторить нельзя.
     Поэтому в уроках у классов всегда определяется __repr__. */
  return "<" + o.cls.fullName() + " object>";
}
function pyStr(v){
  if (typeof v === "string") return v;
  if (v instanceof PyObj){
    if (v.cls === TYPES["datetime.date"]){
      var p = dtParts(v);
      return p.y + "-" + two(p.mo) + "-" + two(p.d);
    }
    if (v.cls === TYPES["datetime.datetime"]){
      var q = dtParts(v);
      return q.y + "-" + two(q.mo) + "-" + two(q.d) + " " + two(q.h) + ":" + two(q.mi) + ":" + two(q.s);
    }
    if (v.cls === TYPES["pathlib.Path"]) return v.fields.get("__path__");
    if (v.cls === TYPES["datetime.timedelta"]){
      var ms = v.tdMs, dd = Math.floor(ms / 86400000), rest = Math.floor((ms % 86400000) / 1000);
      var hh = Math.floor(rest / 3600), mi2 = Math.floor((rest % 3600) / 60), ss = rest % 60;
      var head = dd ? dd + (Math.abs(dd) === 1 ? " day, " : " days, ") : "";
      return head + hh + ":" + two(mi2) + ":" + two(ss);
    }
    var s = v.cls.lookup("__str__");
    if (s) return pyStr(callSync(new Bound(s, v), [], 0));
    if (v.cls.isExc && !v.cls.lookup("__repr__")) return excMessage(v);
  }
  return pyRepr(v);
}
function truthy(v){
  if (v === null || v === undefined || v === false) return false;
  if (v === true) return true;
  if (isNum(v)) return nv(v) !== 0;
  if (typeof v === "string") return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (v instanceof PySet) return v.size > 0;
  if (v instanceof Map) return v.size > 0;
  return true;
}
function typeName(v){
  if (v === null || v === undefined) return "NoneType";
  if (v === true || v === false) return "bool";
  if (isNum(v)) return isFloat(v) ? "float" : "int";
  if (typeof v === "string") return "str";
  if (v instanceof PySet) return "set";
  if (isTup(v)) return "tuple";
  if (Array.isArray(v)) return "list";
  if (v instanceof Map) return "dict";
  if (v instanceof PyObj) return v.cls.shortName();
  if (v instanceof PyType) return "type";
  if (v instanceof PyModule) return "module";
  if (v instanceof PyFile) return "TextIOWrapper";
  if (v instanceof PyGen) return "generator";
  if (v instanceof Bound) return "method";
  if (v instanceof SuperProxy) return "super";
  if (v instanceof PyFunc || typeof v === "function") return "function";
  return "object";
}
function pyEq(a, b){
  if (isNum(a) && isNum(b)) return nv(a) === nv(b);
  /* У объекта может быть свой __eq__ — тогда решает он. Так работает dataclass. */
  if (a instanceof PyObj && b instanceof PyObj && a.cls === b.cls){
    if (a.dtMs !== undefined) return a.dtMs === b.dtMs;
    if (a.tdMs !== undefined) return a.tdMs === b.tdMs;
    if (a.cls === TYPES["pathlib.Path"]) return a.fields.get("__path__") === b.fields.get("__path__");
  }
  if (a instanceof PyObj){
    var eq = a.cls.lookup("__eq__");
    if (eq) return truthy(callSync(new Bound(eq, a), [b], 0));
    return a === b;
  }
  if (b instanceof PyObj) return pyEq(b, a);
  if (a instanceof PySet || b instanceof PySet){
    if (!(a instanceof PySet) || !(b instanceof PySet)) return false;
    if (a.size !== b.size) return false;
    var sv = a.values();
    for (var si = 0; si < sv.length; si++) if (!b.has(sv[si])) return false;
    return true;
  }
  if (typeof a !== typeof b && !(Array.isArray(a) && Array.isArray(b))) {
    if (a === null || b === null) return a === b;
  }
  if (Array.isArray(a) && Array.isArray(b)){
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (!pyEq(a[i], b[i])) return false;
    return true;
  }
  if (a instanceof Map && b instanceof Map){
    if (a.size !== b.size) return false;
    var ok = true;
    a.forEach(function(v, k){ if (!b.has(k) || !pyEq(v, b.get(k))) ok = false; });
    return ok;
  }
  return a === b;
}
function keyOf(v){
  if (typeof v === "string") return "s:" + v;
  if (isNum(v)) return "n:" + nv(v);
  if (v === true) return "b:1";
  if (v === false) return "b:0";
  if (v === null) return "none";
  if (isTup(v)) return "t:" + v.map(keyOf).join("");
  if (v instanceof PyType) return "cls:" + v.fullName();
  if (v instanceof PyObj){
    if (!v.__id__) v.__id__ = ++OBJ_ID;
    return "o:" + v.__id__;
  }
  raise("TypeError", "Такое значение нельзя использовать как ключ словаря.", 0,
        { pymsg: "unhashable type: '" + typeName(v) + "'" });
}
var OBJ_ID = 0;

/* ============================================================
   ОКРУЖЕНИЕ
   ============================================================ */
function Env(parent){ this.vars = new Map(); this.parent = parent || null; this.globals = []; }
Env.prototype.get = function(name, line){
  var e = this;
  while (e){
    if (e.vars.has(name)) return e.vars.get(name);
    /* Python решает, местная переменная или внешняя, ещё до запуска: если имени
       где-то в функции присваивают, оно местное во всей функции. Поэтому читать
       внешнюю переменную с тем же именем нельзя — это UnboundLocalError. */
    if (e.funcScope && e.declared && e.declared[name])
      raise("UnboundLocalError",
        "Переменная «" + name + "» считается местной: где-то ниже в этой функции ей присваивают значение. " +
        "Поэтому взять внешнюю переменную с тем же именем уже нельзя. Либо передай её параметром, " +
        "либо напиши global " + name + " — но лучше параметром.", line,
        { pymsg: "local variable '" + name + "' referenced before assignment" });
    e = e.parent;
  }
  raise("NameError", "Имя «" + name + "» не определено. Может быть, опечатка, или переменную ещё не создали?", line,
        { pymsg: "name '" + name + "' is not defined" });
};
Env.prototype.has = function(name){
  var e = this;
  while (e){ if (e.vars.has(name)) return true; e = e.parent; }
  return false;
};
Env.prototype.set = function(name, val){
  if (this.globals.indexOf(name) >= 0){
    var r = this; while (r.parent) r = r.parent;
    r.vars.set(name, val); return;
  }
  this.vars.set(name, val);
};

/* Есть ли в теле функции yield — тогда это функция-генератор.
   Во вложенные def не заходим: у них свой ответ на этот вопрос. */
function hasYield(node){
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)){
    for (var i = 0; i < node.length; i++) if (hasYield(node[i])) return true;
    return false;
  }
  if (node.type === "FuncDef" || node.type === "ClassDef" || node.type === "Lambda") return false;
  if (node.type === "Yield" || node.type === "YieldFrom") return true;
  for (var k in node){
    if (k === "type" || k === "line") continue;
    if (hasYield(node[k])) return true;
  }
  return false;
}

/* Какие имена функция считает своими: те, которым в её теле присваивают.
   Во вложенные def и class не заходим — у них своя область. */
function localNames(body){
  var found = {}, globals = {};
  function walkTarget(t){
    if (!t) return;
    if (t.type === "Name") found[t.id] = 1;
    else if (t.type === "Tuple" || t.type === "List") t.elts.forEach(walkTarget);
  }
  function walk(list){
    for (var i = 0; i < list.length; i++){
      var st = list[i];
      switch (st.type){
        case "Assign": st.targets.forEach(walkTarget); break;
        case "AugAssign": walkTarget(st.target); break;
        case "AnnAssign": found[st.name] = 1; break;
        case "For": walkTarget(st.target); walk(st.body); break;
        case "While": walk(st.body); if (st.orelse) walk(st.orelse); break;
        case "If": walk(st.body); if (st.orelse) walk(st.orelse); break;
        case "Try":
          walk(st.body);
          st.handlers.forEach(function(h){ if (h.name) found[h.name] = 1; walk(h.body); });
          if (st.orelse) walk(st.orelse);
          if (st.finalbody) walk(st.finalbody);
          break;
        case "FuncDef": case "ClassDef": found[st.name] = 1; break;
        case "Global": st.names.forEach(function(n){ globals[n] = 1; }); break;
        case "Import":
          st.items.forEach(function(it){ found[it.as || it.name] = 1; });
          break;
        case "ImportFrom":
          if (st.names !== "*") st.names.forEach(function(n){ found[n.as || n.name] = 1; });
          break;
      }
    }
  }
  walk(body);
  for (var g in globals) delete found[g];
  return found;
}

/* сигналы управления */
function Sig(kind, value){ this.kind = kind; this.value = value; }

/* ============================================================
   ИНТЕРПРЕТАТОР (генератор — можно шагать)
   ============================================================ */
function Interp(opts){
  opts = opts || {};
  this.out = [];
  this.turtle = opts.turtle || null;
  this.maxSteps = opts.maxSteps || 300000;
  this.steps = 0;
  this.depth = 0;        // глубина вложенных вызовов — против бесконечной рекурсии
  this.curExc = null;    // исключение, которое сейчас обрабатывается в except
  this.sources = opts.sources || {};   // «файлы» урока для import
  this.disk = new PyDisk(opts.files || {});   // файлы с данными: живут в памяти запуска
  this.stdin = (opts.stdin || []).map(String);  // заранее записанные ответы для input()
  this.stdinPos = 0;
  /* Интерактивный режим (игры): когда ответы кончились, программа не падает,
     а «замирает» на input() — раннер снаружи покажет поле ввода и запустит
     программу заново с добавленным ответом. seed фиксирует random, чтобы
     такой перезапуск давал ровно ту же игру. */
  this.interactive = !!opts.interactive;
  if (opts.seed !== undefined && opts.seed !== null) this._seed = Math.trunc(opts.seed);
  this.modules = {};     // уже подключённые модули
  /* Стек вызовов: [{name, env}], снизу вверх. Нужен визуализатору, чтобы
     показать, ГДЕ мы находимся, когда программа зашла в функцию. Счётчика
     this.depth для этого не хватает: он знает только глубину, а не имена
     и не местные переменные каждого кадра. На выполнение стек не влияет —
     это наблюдение, а не механика. */
  this.stack = [];
  this.global = new Env(null);
  this.installBuiltins();
}

Interp.prototype.write = function(s){
  this.out.push(s);
  if (this.out.length > 4000)
    raise("RuntimeError", "Слишком много вывода — похоже на бесконечный цикл.", 0, { fatal: true });
};

Interp.prototype.installBuiltins = function(){
  var I = this;
  var g = this.global.vars;

  function def(name, fn, arity){ fn.pyName = name; g.set(name, fn); }

  def("print", function(args, kw, line){
    var sep = kw && kw.sep !== undefined ? pyStr(kw.sep) : " ";
    var end = kw && kw.end !== undefined ? pyStr(kw.end) : "\n";
    I.write(args.map(pyStr).join(sep) + end);
    return null;
  });
  def("len", function(args, kw, line){
    var v = args[0];
    if (typeof v === "string" || Array.isArray(v)) return v.length;
    if (v instanceof PySet) return v.size;
    if (v instanceof Map) return v.size;
    raise("TypeError", "len() не работает с типом " + typeName(v) + ".", line,
          { pymsg: "object of type '" + typeName(v) + "' has no len()" });
  });
  def("range", function(args, kw, line){
    var a = args.map(function(x){
      if (!isNum(x)) raise("TypeError", "range() принимает только целые числа.", line);
      return Math.trunc(nv(x));
    });
    var start = 0, stop = 0, step = 1;
    if (a.length === 1) stop = a[0];
    else if (a.length === 2){ start = a[0]; stop = a[1]; }
    else if (a.length >= 3){ start = a[0]; stop = a[1]; step = a[2]; }
    else raise("TypeError", "range() нужен хотя бы один аргумент.", line);
    if (step === 0) raise("ValueError", "Шаг range() не может быть нулём.", line);
    var n = Math.max(0, Math.ceil((stop - start) / step));
    if (n > 200000) raise("RuntimeError", "range() слишком большой — браузер не выдержит.", line);
    var res = [];
    for (var i = 0; i < n; i++) res.push(start + i * step);
    return res;
  });
  /* Встроенный тип — это значение: его можно печатать (<class 'int'>),
     сравнивать (type(x) is int) и вызывать (int("5")). Поэтому имя «int»
     указывает на сам тип, а способ создания живёт в t.ctor. */
  function defTypeName(name, fn){
    TYPES[name].ctor = fn;
    g.set(name, TYPES[name]);
  }
  def("str", function(args){ return args.length ? pyStr(args[0]) : ""; });
  def("int", function(args, kw, line){
    if (!args.length) return 0;
    var v = args[0];
    if (isNum(v)) return Math.trunc(nv(v));
    if (v === true) return 1;
    if (v === false) return 0;
    if (typeof v === "string"){
      var t = v.trim();
      if (!/^[+-]?\d+$/.test(t))
        raise("ValueError", "Строку «" + v + "» нельзя превратить в целое число.", line,
              { pymsg: "invalid literal for int() with base 10: " + pyRepr(v) });
      return parseInt(t, 10);
    }
    raise("TypeError", "int() не работает с типом " + typeName(v) + ".", line);
  });
  def("float", function(args, kw, line){
    if (!args.length) return mkFloat(0);
    var v = args[0];
    if (isNum(v)) return mkFloat(nv(v));
    if (typeof v === "string"){
      var t = v.trim();
      if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t))
        raise("ValueError", "Строку «" + v + "» нельзя превратить в число.", line,
              { pymsg: "could not convert string to float: " + pyRepr(v) });
      return mkFloat(parseFloat(t));
    }
    raise("TypeError", "float() не работает с типом " + typeName(v) + ".", line);
  });
  def("bool", function(args){ return args.length ? truthy(args[0]) : false; });
  def("list", function(args, kw, line){ return args.length ? I.iterate(args[0], line).slice() : []; });
  def("tuple", function(args, kw, line){ return Tup(args.length ? I.iterate(args[0], line) : []); });
  /* any/all — «хотя бы один» и «все». Вместе с генераторным выражением это
     самый частый способ задать вопрос списку: any(x > 5 for x in числа). */
  def("any", function(args, kw, line){
    var it = I.iterate(args[0], line);
    for (var i = 0; i < it.length; i++) if (truthy(it[i])) return true;
    return false;
  });
  def("all", function(args, kw, line){
    var it = I.iterate(args[0], line);
    for (var i = 0; i < it.length; i++) if (!truthy(it[i])) return false;
    return true;
  });
  def("sum", function(args, kw, line){
    var it = I.iterate(args[0], line), acc = 0, floaty = false;
    for (var i = 0; i < it.length; i++){
      if (!isNum(it[i])) raise("TypeError", "sum() складывает только числа.", line);
      if (isFloat(it[i])) floaty = true;
      acc += nv(it[i]);
    }
    return num(acc, floaty);
  });
  /* max и min умеют key= — значит должны уметь звать функцию ученика */
  function mkMinMax(dir){
    var f = function*(args, kw, line){
      var arr = args.length === 1 ? I.iterate(args[0], line) : args;
      if (!arr.length)
        raise("ValueError", (dir > 0 ? "max()" : "min()") + " из пустой последовательности.", line,
              { pymsg: (dir > 0 ? "max()" : "min()") + " arg is an empty sequence" });
      var useKey = !!(kw && kw.key);
      var best = arr[0];
      var bestKey = useKey ? yield* I.call(kw.key, [arr[0]], {}, line) : arr[0];
      for (var i = 1; i < arr.length; i++){
        var k = useKey ? yield* I.call(kw.key, [arr[i]], {}, line) : arr[i];
        if (I.cmp(k, bestKey, line) * dir > 0){ best = arr[i]; bestKey = k; }
      }
      return best;
    };
    f.pyGen = true;
    return f;
  }
  def("min", mkMinMax(-1));
  def("max", mkMinMax(1));
  def("abs", function(args, kw, line){
    if (!isNum(args[0])) raise("TypeError", "abs() работает только с числами.", line);
    return num(Math.abs(nv(args[0])), isFloat(args[0]));
  });
  def("round", function(args, kw, line){
    if (!isNum(args[0]))
      raise("TypeError", "round() работает только с числами.", line,
            { pymsg: "type " + typeName(args[0]) + " doesn't define __round__ method" });
    var v = nv(args[0]), d = args.length > 1 ? Math.trunc(nv(args[1])) : 0;
    var r = roundHalfEven(v, d);
    /* round(x) отдаёт целое, round(x, d) — число того же вида, что пришло */
    if (args.length > 1) return isFloat(args[0]) ? mkFloat(r) : num(r, false);
    return Math.trunc(r);
  });
  var sortedFn = function*(args, kw, line){
    var arr = I.iterate(args[0], line).slice();
    var rev = kw && truthy(kw.reverse);
    /* Знак сравнения, а не переворот готового массива: в Python сортировка
       устойчива, и при reverse=True равные элементы сохраняют исходный порядок. */
    var sign = rev ? -1 : 1;
    if (kw && kw.key){
      /* считаем ключи заранее, по одному вызову на элемент — как это делает Python */
      var keys = [];
      for (var i = 0; i < arr.length; i++) keys.push(yield* I.call(kw.key, [arr[i]], {}, line));
      var order = [];
      for (var j = 0; j < arr.length; j++) order.push(j);
      order.sort(function(x, y){ return sign * I.cmp(keys[x], keys[y], line); });
      var src = arr;
      arr = order.map(function(idx){ return src[idx]; });
    } else {
      arr.sort(function(a, b){ return sign * I.cmp(a, b, line); });
    }
    return arr;
  };
  sortedFn.pyGen = true;
  def("sorted", sortedFn);
  def("reversed", function(args, kw, line){ return I.iterate(args[0], line).slice().reverse(); });
  def("enumerate", function(args, kw, line){
    var arr = I.iterate(args[0], line);
    /* start можно задать и позиционно, и по имени: enumerate(xs, start=1) */
    var st = (kw && kw.start !== undefined) ? Math.trunc(nv(kw.start))
           : args.length > 1 ? Math.trunc(nv(args[1])) : 0;
    return arr.map(function(v, i){ return Tup([i + st, v]); });
  });
  def("zip", function(args, kw, line){
    var lists = args.map(function(a){ return I.iterate(a, line); });
    var n = Math.min.apply(null, lists.map(function(l){ return l.length; }));
    var res = [];
    for (var i = 0; i < n; i++) res.push(Tup(lists.map(function(l){ return l[i]; })));
    return res;
  });
  def("set", function(args, kw, line){
    return args.length ? new PySet(I.iterate(args[0], line)) : new PySet();
  });
  /* input() читает не с клавиатуры, а из списка заранее записанных ответов
     (opts.stdin у запуска, поле «ответы» у урока). Для кода ученика разницы
     нет: на настоящем компьютере тот же код читает то, что печатает человек.
     Приглашение печатается без перевода строки, сам ответ НЕ отражается
     в выводе — ровно как у python3, когда ввод приходит по трубе. */
  def("input", function(args, kw, line){
    if (args.length > 1)
      raise("TypeError", "input() принимает не больше одного приглашения.", line,
            { pymsg: "input expected at most 1 argument, got " + args.length });
    if (args.length === 1) I.write(pyStr(args[0]));
    if (I.stdinPos >= I.stdin.length){
      if (I.interactive)
        raise("__AwaitInput__", "жду ввод игрока", line, { fatal: true });
      // сюда попадаем только в неинтерактивном режиме
      raise("EOFError", "Ответы закончились: программа спросила больше, чем ей заготовили. Добавь строку в список ответов.", line,
            { pymsg: "EOF when reading a line" });
    }
    var ответ = I.stdin[I.stdinPos++];
    /* в игре показываем, что набрал игрок: труба этого не делает, но человеку
       за экраном нужно видеть свой ввод — печатаем его как эхо с переводом строки */
    if (I.interactive) I.write(ответ + "\n");
    return ответ;
  });

  // математика
  def("sqrt", function(args, kw, line){ return mkFloat(Math.sqrt(nv(args[0]))); });
  def("randint", function(args, kw, line){
    var a = Math.trunc(nv(args[0])), b = Math.trunc(nv(args[1]));
    return a + Math.floor(I.random() * (b - a + 1));
  });
  def("choice", function(args, kw, line){
    var arr = I.iterate(args[0], line);
    if (!arr.length) raise("ValueError", "choice() из пустого списка.", line);
    return arr[Math.floor(I.random() * arr.length)];
  });
  def("random", function(){ return mkFloat(I.random()); });
  def("shuffle", function(args, kw, line){
    var arr = args[0];
    if (!Array.isArray(arr) || isTup(arr))
      raise("TypeError", "shuffle() перемешивает список на месте, а не " + typeName(arr) + ".", line);
    for (var i = arr.length - 1; i > 0; i--){
      var j = Math.floor(I.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return null;
  });
  def("sample", function(args, kw, line){
    var pool = I.iterate(args[0], line).slice();
    var k = Math.trunc(nv(args[1]));
    if (k < 0 || k > pool.length)
      raise("ValueError", "sample(): нельзя выбрать " + k + " элементов из " + pool.length + ".", line);
    var out = [];
    for (var i = 0; i < k; i++) out.push(pool.splice(Math.floor(I.random() * pool.length), 1)[0]);
    return out;
  });

  // черепашка
  var T = this.turtle;
  if (T){
    def("forward", function(args, kw, line){ T.forward(nv(args[0] === undefined ? 0 : args[0])); return null; });
    def("back",    function(args, kw, line){ T.forward(-nv(args[0] === undefined ? 0 : args[0])); return null; });
    def("right",   function(args, kw, line){ T.turn(nv(args[0] === undefined ? 90 : args[0])); return null; });
    def("left",    function(args, kw, line){ T.turn(-nv(args[0] === undefined ? 90 : args[0])); return null; });
    def("penup",   function(){ T.pen = false; return null; });
    def("pendown", function(){ T.pen = true; return null; });
    def("color",   function(args, kw, line){ T.setColor(pyStr(args[0]), line); return null; });
    def("width",   function(args){ T.width = Math.max(1, Math.min(20, nv(args[0]))); return null; });
    def("goto",    function(args, kw, line){ T.goto(nv(args[0]), nv(args[1])); return null; });
    def("home",    function(){ T.goto(0, 0); T.angle = 0; return null; });
    def("dot",     function(args){ T.dot(args.length ? nv(args[0]) : 6); return null; });
    def("circle",  function(args, kw, line){ T.circle(nv(args[0]), args.length > 1 ? nv(args[1]) : 360); return null; });
    def("speed",   function(){ return null; });
  }

  /* --- имена типов указывают на типы, а не на функции --- */
  ["str","int","float","bool","list","tuple","set"].forEach(function(n){
    var fn = g.get(n);
    if (typeof fn === "function") defTypeName(n, fn);
  });
  defTypeName("dict", function(args, kw, line){
    var d = dictNew();
    if (args.length){
      if (args[0] instanceof Map){
        var ks = dictKeys(args[0]);
        for (var i = 0; i < ks.length; i++) dictSet(d, ks[i], dictGet(args[0], ks[i]));
      } else {
        var seq = iterate(args[0], line);
        for (var j = 0; j < seq.length; j++){
          var pair = iterate(seq[j], line);
          if (pair.length !== 2) raise("ValueError", "dict() ждёт пары «ключ, значение».", line);
          dictSet(d, pair[0], pair[1]);
        }
      }
    }
    for (var k in kw) dictSet(d, k, kw[k]);
    return d;
  });
  defTypeName("type", function(args, kw, line){
    if (args.length !== 1)
      raise("TypeError", "type() принимает одно значение: type(x).", line);
    return typeOf(args[0]);
  });
  g.set("object", TYPES.object);
  /* Главная программа всегда называется "__main__" — так её видит Python.
     У подключённого файла имя другое, см. loadModule. */
  g.set("__name__", "__main__");
  EXC_NAMES.forEach(function(n){ g.set(n, TYPES[n]); });

  /* dir() — список имён у объекта.
     Настоящий Python подмешивает сюда десятки служебных имён (__class__,
     __sizeof__ и прочие), и их набор меняется от версии к версии — повторить
     его точь-в-точь нельзя. Поэтому dir() здесь работает только с тем, что
     написал сам ученик: свой класс, свой объект, свой файл-модуль.
     Правило проекта: в уроках dir() всегда фильтруется от служебных имён —
     [n for n in dir(x) if not n.startswith("_")] — и тогда результат
     совпадает с настоящим Python в точности. */
  /* getattr(объект, "имя") — то же, что объект.имя, только имя вычисляется.
     Третий аргумент — что вернуть, если такого имени нет. */
  def("getattr", function(args, kw, line){
    if (args.length < 2) raise("TypeError", "getattr() принимает объект и имя.", line);
    var nm = pyStr(args[1]);
    if (args.length > 2){
      try { return I.bindMethod(args[0], nm, line); }
      catch (e){
        if (e.pyKind === "AttributeError") return args[2];
        throw e;
      }
    }
    return I.bindMethod(args[0], nm, line);
  });
  def("hasattr", function(args, kw, line){
    if (args.length !== 2) raise("TypeError", "hasattr() принимает объект и имя.", line);
    try { I.bindMethod(args[0], pyStr(args[1]), line); return true; }
    catch (e){
      if (e.pyKind === "AttributeError") return false;
      throw e;
    }
  });
  /* callable() — «это можно вызвать?»: функция, метод, класс или встроенное. */
  def("callable", function(args, kw, line){
    var v = args[0];
    return typeof v === "function" || v instanceof PyFunc || v instanceof Bound || v instanceof PyType;
  });

  def("dir", function(args, kw, line){
    if (args.length !== 1)
      raise("TypeError", "dir() здесь принимает ровно один объект: dir(что-то).", line);
    var v = args[0], names = {};
    function addType(t){
      while (t){ t.attrs.forEach(function(_, k){ names[k] = 1; }); t = t.base; }
    }
    if (v instanceof PyModule){
      v.vars.forEach(function(_, k){ names[k] = 1; });
    } else if (v instanceof PyType){
      if (v.module !== "__main__") dirRefuse(typeName(v), line);
      addType(v);
    } else if (v instanceof PyObj){
      if (v.cls.module !== "__main__") dirRefuse(v.cls.name, line);
      addType(v.cls);
      v.fields.forEach(function(_, k){ names[k] = 1; });
    } else {
      dirRefuse(typeName(v), line);
    }
    return Object.keys(names).sort();
  });

  function dirRefuse(what, line){
    raise("NotSupported", "dir() здесь работает только с тем, что написал ты сам: своим классом, своим объектом или своим файлом-модулем. У «" + what +
      "» список имён у каждой версии Python свой, и подделывать его тренажёр не станет — посмотри его в документации.", line);
  }

  def("next", function(args, kw, line){
    var g = args[0];
    if (!(g instanceof PyGen))
      raise("TypeError", "next() работает с генератором, а не с " + typeName(g) + ".", line,
            { pymsg: "'" + typeName(g) + "' object is not an iterator" });
    var st = g.next();
    if (st.done){
      if (args.length > 1) return args[1];
      raise("StopIteration", "У генератора «" + g.name + "» больше нет значений.", line, { pymsg: "" });
    }
    return st.value;
  });
  def("open", function(args, kw, line){
    var name = pyStr(args[0]);
    var mode = args.length > 1 ? pyStr(args[1]) : (kw && kw.mode !== undefined ? pyStr(kw.mode) : "r");
    /* encoding и newline принимаем и не мешаем: в браузере кодировка всегда utf-8,
       а переводы строк движок и так приводит к \n. Зато код урока выглядит
       ровно так, как его надо писать на настоящем компьютере. */
    if (kw && kw.encoding !== undefined){
      var enc = pyStr(kw.encoding).toLowerCase().replace("-", "");
      if (enc !== "utf8")
        raise("ValueError", "В тренажёре файлы всегда в utf-8, другую кодировку задать нельзя.", line,
              { pymsg: "unknown encoding: " + pyStr(kw.encoding) });
    }
    if (!/^[rwa]\+?b?t?$/.test(mode))
      raise("ValueError", "Режим «" + mode + "» непонятен. Бывают: \"r\" читать, \"w\" писать с нуля, \"a\" дописывать.", line,
            { pymsg: "invalid mode: '" + mode + "'" });
    var rawNl = kw && kw.newline !== undefined && pyStr(kw.newline) === "";
    return new PyFile(I.disk, name, mode, line, rawNl);
  });
  def("isinstance", function(args, kw, line){
    var t = args[1];
    var list = Array.isArray(t) ? t : [t];
    for (var i = 0; i < list.length; i++){
      if (!(list[i] instanceof PyType))
        raise("TypeError", "Второй аргумент isinstance() — это тип, например int или str.", line);
      if (isSubType(typeOf(args[0]), list[i])) return true;
      /* bool в Python — разновидность int, а int не разновидность bool */
      if (list[i] === TYPES.int && args[0] === true) return true;
      if (list[i] === TYPES.int && args[0] === false) return true;
    }
    return false;
  });
  def("issubclass", function(args, kw, line){
    if (!(args[0] instanceof PyType) || !(args[1] instanceof PyType))
      raise("TypeError", "issubclass() сравнивает два типа.", line);
    return isSubType(args[0], args[1]);
  });
  def("repr", function(args){ return pyRepr(args[0]); });
  def("hasattr", function(args, kw, line){
    var o = args[0], n = pyStr(args[1]);
    if (o instanceof PyObj) return o.fields.has(n) || o.cls.lookup(n) !== undefined;
    if (o instanceof PyType) return o.lookup(n) !== undefined;
    if (o instanceof PyModule) return o.vars.has(n);
    return false;
  });

  g.set("pi", mkFloat(Math.PI));
  this.builtinNames = Array.from(g.keys());
};

Interp.prototype.random = function(){
  // детерминированный ГПСЧ, чтобы проверка заданий была честной
  this._seed = (this._seed || 12345);
  this._seed = (this._seed * 1103515245 + 12345) % 2147483648;
  return this._seed / 2147483648;
};

Interp.prototype.minmax = function(args, line, dir){
  var arr = args.length === 1 ? this.iterate(args[0], line) : args;
  if (!arr.length) raise("ValueError", (dir > 0 ? "max()" : "min()") + " из пустой последовательности.", line);
  var best = arr[0];
  for (var i = 1; i < arr.length; i++)
    if (this.cmp(arr[i], best, line) * dir > 0) best = arr[i];
  return best;
};

Interp.prototype.cmp = function(a, b, line){
  if (isNum(a) && isNum(b)) return nv(a) - nv(b);
  if (a instanceof PyObj && b instanceof PyObj){
    if (a.dtMs !== undefined && b.dtMs !== undefined) return a.dtMs - b.dtMs;
    if (a.tdMs !== undefined && b.tdMs !== undefined) return a.tdMs - b.tdMs;
  }
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "boolean" && typeof b === "boolean") return (a ? 1 : 0) - (b ? 1 : 0);
  if (Array.isArray(a) && Array.isArray(b)){
    for (var i = 0; i < Math.min(a.length, b.length); i++){
      var c = this.cmp(a[i], b[i], line);
      if (c) return c;
    }
    return a.length - b.length;
  }
  raise("TypeError", "Нельзя сравнить " + typeName(a) + " и " + typeName(b) + ".", line);
};

/* Отдельной функцией, а не методом: этим пользуются конструкторы
   встроенных типов (list, tuple, set), которые живут вне интерпретатора. */
function iterate(v, line){
  if (v instanceof PyGen){
    var out = [];
    for (;;){
      var st = v.next();
      if (st.done) break;
      out.push(st.value);
      if (out.length > 100000)
        raise("RuntimeError", "Генератор выдаёт значения без конца — в список его не собрать. " +
              "Возьми первые несколько (например через islice) или перебирай циклом с break.", line,
              { fatal: true });
    }
    return out;
  }
  if (v instanceof PyFile){ v.checkOpen(line); return v.lines(); }
  if (typeof v === "string") return v.split("");
  if (Array.isArray(v)) return v;
  if (v instanceof PySet) return v.values();
  if (v instanceof Map) return Array.from(v.values()).map(function(p){ return p[0]; });
  raise("TypeError", "По значению типа " + typeName(v) + " нельзя пройти циклом for.", line,
        { pymsg: "'" + typeName(v) + "' object is not iterable" });
}
Interp.prototype.iterate = function(v, line){ return iterate(v, line); };

/* Создание значения: встроенный тип зовёт свой конструктор,
   класс ученика — создаёт объект и запускает __init__. */
Interp.prototype.construct = function*(cls, args, kw, line){
  if (cls.ctor) return cls.ctor(args, kw, line);
  var obj = new PyObj(cls);
  if (cls.isExc) obj.excArgs = args.slice();
  var init = cls.lookup("__init__");
  if (init){
    yield* this.call(new Bound(init, obj), args, kw, line, cls.name);
  } else if (args.length && !cls.isExc){
    raise("TypeError", "Класс «" + cls.name + "» пока создаётся без аргументов: у него нет __init__.", line,
          { pymsg: cls.name + "() takes no arguments" });
  }
  return obj;
};

/* --- словарь хранится как Map key -> [pyKey, value] --- */
function dictNew(){ return new Map(); }
function dictSet(d, k, v){ d.set(keyOf(k), [k, v]); }
function dictGet(d, k){ var e = d.get(keyOf(k)); return e ? e[1] : undefined; }
function dictHas(d, k){ return d.has(keyOf(k)); }
function dictKeys(d){ return Array.from(d.values()).map(function(p){ return p[0]; }); }
function dictVals(d){ return Array.from(d.values()).map(function(p){ return p[1]; }); }

/* переопределяем печать/равенство словарей с учётом структуры */
var _repr = pyRepr;
pyRepr = function(v){
  if (v instanceof Map){
    var out = [];
    v.forEach(function(pair){ out.push(pyRepr(pair[0]) + ": " + pyRepr(pair[1])); });
    var body = "{" + out.join(", ") + "}";
    if (v.__counter__) return "Counter(" + body + ")";
    if (v.__factory__ !== undefined && v.__factory__ !== null)
      return "defaultdict(" + pyRepr(v.__factory__) + ", " + body + ")";
    return body;
  }
  return _repr(v);
};

Interp.prototype.tick = function(line){
  if (++this.steps > this.maxSteps)
    raise("RuntimeError", "Программа выполняется слишком долго. Скорее всего, цикл никогда не заканчивается — проверь условие в while.", line, { fatal: true });
};

/* ---------- выполнение ---------- */
Interp.prototype.runBlock = function*(body, env){
  for (var i = 0; i < body.length; i++){
    var r = yield* this.execStmt(body[i], env);
    if (r) return r;
  }
  return null;
};

Interp.prototype.execStmt = function*(st, env){
  this.tick(st.line);
  yield { line: st.line, env: env };

  switch (st.type){
    case "ExprStmt":
      yield* this.eval(st.value, env);
      return null;

    case "Assign": {
      var val = yield* this.eval(st.value, env);
      for (var i = 0; i < st.targets.length; i++)
        yield* this.assign(st.targets[i], val, env);
      return null;
    }

    case "AugAssign": {
      var cur = yield* this.eval(st.target, env);
      var rhs = yield* this.eval(st.value, env);
      var res = this.binop(st.op, cur, rhs, st.line);
      yield* this.assign(st.target, res, env);
      return null;
    }

    case "If": {
      var t = yield* this.eval(st.test, env);
      if (truthy(t)) return yield* this.runBlock(st.body, env);
      if (st.orelse && st.orelse.length) return yield* this.runBlock(st.orelse, env);
      return null;
    }

    case "While": {
      for (;;){
        this.tick(st.line);
        var c = yield* this.eval(st.test, env);
        if (!truthy(c)) break;
        var r = yield* this.runBlock(st.body, env);
        if (r){
          if (r.kind === "break") return null;
          if (r.kind === "continue") continue;
          return r;
        }
      }
      if (st.orelse && st.orelse.length) return yield* this.runBlock(st.orelse, env);
      return null;
    }

    case "For": {
      var src = yield* this.eval(st.iter, env);
      /* Генератор перебираем по одному значению: только так работают
         бесконечные генераторы и экономия памяти, о которой весь урок. */
      if (src instanceof PyGen){
        for (;;){
          this.tick(st.line);
          var g = src.next();
          if (g.done) break;
          yield* this.assign(st.target, g.value, env);
          var rg = yield* this.runBlock(st.body, env);
          if (rg){
            if (rg.kind === "break") return null;
            if (rg.kind === "continue") continue;
            return rg;
          }
        }
        return null;
      }
      var seq = this.iterate(src, st.line);
      for (var k = 0; k < seq.length; k++){
        this.tick(st.line);
        yield* this.assign(st.target, seq[k], env);
        var r2 = yield* this.runBlock(st.body, env);
        if (r2){
          if (r2.kind === "break") return null;
          if (r2.kind === "continue") continue;
          return r2;
        }
      }
      return null;
    }

    case "FuncDef": {
      /* Значения по умолчанию вычисляются ОДИН раз — сейчас, при создании функции.
         Именно отсюда растёт знаменитая ловушка: def f(x, acc=[]) даёт один
         список на все вызовы. Так работает настоящий Python, и урок про это есть. */
      var dv = [];
      for (var di = 0; di < st.defaults.length; di++)
        dv.push(st.defaults[di] ? yield* this.eval(st.defaults[di], env) : undefined);
      var fdef = new PyFunc(st.name, st.params, st.defaults, st.body, env,
                            { vararg: st.vararg, kwarg: st.kwarg });
      fdef.defaultVals = dv;
      fdef.doc = docOf(st.body);
      var res = fdef;
      if (st.decorators) for (var fdi = st.decorators.length - 1; fdi >= 0; fdi--){
        var dec = yield* this.eval(st.decorators[fdi], env);
        res = yield* this.call(dec, [res], {}, st.line, null);
      }
      env.set(st.name, res);
      return null;
    }

    case "AnnAssign": {
      if (st.value !== null){
        var av = yield* this.eval(st.value, env);
        env.set(st.name, av);
      }
      /* внутри класса запоминаем поле: порядок важен для @dataclass */
      if (env.annotations) env.annotations.push({ name: st.name, hasDefault: st.value !== null });
      return null;
    }

    case "ClassDef": {
      var base = TYPES.object;
      if (st.bases.length){
        var b0 = yield* this.eval(st.bases[0], env);
        if (!(b0 instanceof PyType))
          raise("TypeError", "В скобках после имени класса должен стоять другой класс.", st.line);
        base = b0;
      }
      var cls = new PyType(st.name, base, { module: "__main__" });
      cls.doc = docOf(st.body);
      var cenv = new Env(env);
      cenv.annotations = [];
      yield* this.runBlock(st.body, cenv);
      cenv.vars.forEach(function(v, k){
        /* метод должен видеть внешние имена, но не поля класса как переменные —
           поэтому его окружение переносим на уровень выше тела класса */
        if (v instanceof PyFunc && v.closure === cenv){ v.closure = env; v.owner = cls; }
        cls.attrs.set(k, v);
      });
      var inherited = (base.annotations || []).filter(function(a){
        return !cenv.annotations.some(function(b){ return b.name === a.name; });
      });
      cls.annotations = inherited.concat(cenv.annotations);
      var made = cls;
      for (var dci = st.decorators.length - 1; dci >= 0; dci--){
        var dfn = yield* this.eval(st.decorators[dci], env);
        made = yield* this.call(dfn, [made], {}, st.line, null);
      }
      env.set(st.name, made);
      return null;
    }

    case "Import": {
      for (var ii = 0; ii < st.items.length; ii++){
        var mod = yield* this.loadModule(st.items[ii].name, st.line);
        env.set(st.items[ii].as || st.items[ii].name, mod);
      }
      return null;
    }

    case "ImportFrom": {
      var fm = yield* this.loadModule(st.module, st.line);
      if (st.names === "*"){
        fm.vars.forEach(function(v, k){ if (k[0] !== "_") env.set(k, v); });
        return null;
      }
      for (var ni = 0; ni < st.names.length; ni++){
        var want = st.names[ni];
        if (!fm.vars.has(want.name))
          raise("ImportError", "В модуле «" + st.module + "» нет имени «" + want.name + "».", st.line,
                { pymsg: "cannot import name '" + want.name + "' from '" + st.module + "'" });
        env.set(want.as || want.name, fm.vars.get(want.name));
      }
      return null;
    }

    case "With": {
      var opened = [];
      var wsig = null;
      try {
        for (var wi = 0; wi < st.items.length; wi++){
          var obj = yield* this.eval(st.items[wi].expr, env);
          var enter = (obj instanceof PyObj) ? obj.cls.lookup("__enter__") : null;
          var value = enter ? yield* this.call(new Bound(enter, obj), [], {}, st.line, "__enter__")
                            : (obj instanceof PyFile ? obj : obj);
          if (!enter && !(obj instanceof PyFile))
            raise("TypeError", "После with должно стоять то, что умеет открываться и закрываться: файл или объект с __enter__.", st.line,
                  { pymsg: "'" + typeName(obj) + "' object does not support the context manager protocol" });
          opened.push(obj);
          if (st.items[wi].name) env.set(st.items[wi].name, value);
        }
        wsig = yield* this.runBlock(st.body, env);
      } catch (werr){
        for (var wc = opened.length - 1; wc >= 0; wc--) yield* this.closeCtx(opened[wc], st.line);
        throw werr;
      }
      for (var wc2 = opened.length - 1; wc2 >= 0; wc2--) yield* this.closeCtx(opened[wc2], st.line);
      return wsig;
    }

    case "Try": {
      var sig = null;
      try {
        sig = yield* this.runBlock(st.body, env);
        if (!sig && st.orelse && st.orelse.length) sig = yield* this.runBlock(st.orelse, env);
      } catch (err){
        /* pyFatal — защита тренажёра (вечный цикл, гора вывода). Её не ловит никакой except. */
        if (!err.pyKind || err.pyFatal){ yield* this.runFinal(st, env); throw err; }
        var exc = err.pyExc || mkExc(err.pyKind, err.pyMsg);
        var h = null;
        for (var hi = 0; hi < st.handlers.length; hi++){
          var hd = st.handlers[hi];
          if (!hd.etype){ h = hd; break; }
          var want = yield* this.eval(hd.etype, env);
          if (this.excMatches(exc, want, hd.line)){ h = hd; break; }
        }
        if (!h){ yield* this.runFinal(st, env); throw err; }
        var prev = this.curExc;
        this.curExc = exc;
        if (h.name) env.set(h.name, exc);
        try {
          sig = yield* this.runBlock(h.body, env);
        } catch (err2){
          this.curExc = prev;
          yield* this.runFinal(st, env);
          throw err2;
        }
        this.curExc = prev;
      }
      var fin = yield* this.runFinal(st, env);
      if (fin) sig = fin;
      return sig;
    }

    case "Raise": {
      if (!st.exc){
        if (!this.curExc)
          raise("RuntimeError", "«raise» без имени ошибки работает только внутри except.", st.line);
        raiseObj(this.curExc, st.line);
      }
      var rv = yield* this.eval(st.exc, env);
      if (rv instanceof PyType){
        if (!rv.isExc)
          raise("TypeError", "После raise должно стоять исключение, а «" + rv.name + "» — это не исключение.", st.line);
        var made = new PyObj(rv); made.excArgs = [];
        raiseObj(made, st.line);
      }
      if (!(rv instanceof PyObj) || !rv.cls.isExc)
        raise("TypeError", "После raise должно стоять исключение. Например: raise ValueError(\"текст\")", st.line);
      raiseObj(rv, st.line);
      return null;
    }

    case "Assert": {
      var ok = yield* this.eval(st.test, env);
      if (truthy(ok)) return null;
      var am = st.msg ? yield* this.eval(st.msg, env) : null;
      var aexc = new PyObj(TYPES.AssertionError);
      aexc.excArgs = am === null ? [] : [am];
      throw PyErr("AssertionError",
        am !== null ? pyStr(am) : "Проверка assert не прошла: условие оказалось ложным.",
        st.line, { exc: aexc, pymsg: am === null ? "" : pyStr(am) });
    }

    case "Return": {
      var v = st.value ? yield* this.eval(st.value, env) : null;
      return new Sig("return", v);
    }
    case "Break": return new Sig("break");
    case "Continue": return new Sig("continue");
    case "Pass": return null;
    case "Global":
      st.names.forEach(function(n){ if (env.globals.indexOf(n) < 0) env.globals.push(n); });
      return null;
  }
  raise("RuntimeError", "Неизвестная конструкция.", st.line);
};

/* ---------- модули ----------
   Настоящих файлов в браузере нет, поэтому «файлы» урока приходят
   в опциях запуска: { sources: { "tools.py": "исходник" } }.
   Для ученика разницы не видно: import tools работает как в жизни. */
Interp.prototype.loadModule = function*(name, line){
  if (this.modules[name]) return this.modules[name];

  var src = this.sources[name + ".py"] !== undefined ? this.sources[name + ".py"]
          : this.sources[name] !== undefined ? this.sources[name] : null;
  if (src !== null){
    var mod = new PyModule(name);
    this.modules[name] = mod;          // ставим сразу: спасает от кольцевых import
    var menv = new Env(this.global);
    /* Внутри подключённого файла __name__ — это имя модуля, а не "__main__".
       Отсюда и растёт «if __name__ == "__main__"»: главный файл знает,
       что он главный, а подключённый — что его подключили. */
    menv.set("__name__", name);
    var ast;
    try { ast = parse(src); }
    catch (e){
      raise(e.pyKind || "SyntaxError", "В модуле «" + name + ".py» ошибка: " + (e.pyMsg || e.message) +
            " (строка " + (e.pyLine || 0) + " в файле " + name + ".py)", line);
    }
    mod.doc = docOf(ast.body);
    yield* this.runBlock(ast.body, menv);
    menv.vars.forEach(function(v, k){ mod.vars.set(k, v); });
    return mod;
  }

  if (BUILTIN_MODULES[name]){
    var bm = new PyModule(name);
    var table = BUILTIN_MODULES[name](this);
    for (var k2 in table) bm.vars.set(k2, table[k2]);
    this.modules[name] = bm;
    return bm;
  }

  raise("ImportError", "Модуля «" + name + "» нет. Доступны: " +
        Object.keys(BUILTIN_MODULES).sort().join(", ") +
        (Object.keys(this.sources).length ? ", а ещё файлы этого урока" : "") + ".", line,
        { pymsg: "No module named '" + name + "'" });
};

Interp.prototype.closeCtx = function*(obj, line){
  if (obj instanceof PyFile){ obj.close(); return; }
  var exit = (obj instanceof PyObj) ? obj.cls.lookup("__exit__") : null;
  if (exit) yield* this.call(new Bound(exit, obj), [null, null, null], {}, line, "__exit__");
};

Interp.prototype.runFinal = function*(st, env){
  if (st.finalbody && st.finalbody.length) return yield* this.runBlock(st.finalbody, env);
  return null;
};

/* Подходит ли перехваченное исключение под то, что написано в except.
   Годится и один класс, и кортеж классов: except (ValueError, TypeError). */
Interp.prototype.excMatches = function(exc, want, line){
  if (Array.isArray(want)){
    for (var i = 0; i < want.length; i++) if (this.excMatches(exc, want[i], line)) return true;
    return false;
  }
  if (!(want instanceof PyType) || !want.isExc)
    raise("TypeError", "После except должно стоять название ошибки, например ValueError.", line);
  return isSubType(exc.cls, want);
};

/* Обход всех «for ... if ...» включения по очереди, с накоплением результата */
Interp.prototype.runComp = function*(node, ci, env, acc){
  if (ci >= node.clauses.length){
    if (node.kind === "dict"){
      var dk = yield* this.eval(node.key, env);
      dictSet(acc, dk, yield* this.eval(node.value, env));
    } else {
      var v = yield* this.eval(node.value, env);
      if (node.kind === "set") acc.add(v); else acc.push(v);
    }
    return;
  }
  var cl = node.clauses[ci];
  var seq = this.iterate(yield* this.eval(cl.iter, env), node.line);
  for (var i = 0; i < seq.length; i++){
    this.tick(node.line);
    yield* this.assign(cl.target, seq[i], env);
    var pass = true;
    for (var f = 0; f < cl.ifs.length; f++){
      if (!truthy(yield* this.eval(cl.ifs[f], env))){ pass = false; break; }
    }
    if (pass) yield* this.runComp(node, ci + 1, env, acc);
  }
};

Interp.prototype.assign = function*(target, val, env){
  if (target.type === "Name"){ env.set(target.id, val); return; }
  if (target.type === "Tuple" || target.type === "List"){
    var items = Array.isArray(val) ? val : this.iterate(val, target.line);
    if (items.length !== target.elts.length)
      raise("ValueError", "Слева " + target.elts.length + " имён, а справа " + items.length + " значений.", target.line);
    for (var i = 0; i < target.elts.length; i++) yield* this.assign(target.elts[i], items[i], env);
    return;
  }
  if (target.type === "Subscript"){
    var obj = yield* this.eval(target.value, env);
    var idx = yield* this.eval(target.index, env);
    if (isTup(obj))
      raise("TypeError", "Кортеж менять нельзя — в этом и смысл кортежа. Если нужно менять, сделай список: list(...).", target.line);
    if (Array.isArray(obj)){
      var n = Math.trunc(nv(idx));
      if (n < 0) n += obj.length;
      if (n < 0 || n >= obj.length)
        raise("IndexError", "В списке " + obj.length + " элементов, а ты обращаешься к номеру " + Math.trunc(nv(idx)) + ".", target.line);
      obj[n] = val; return;
    }
    if (obj instanceof Map){ dictSet(obj, idx, val); return; }
    raise("TypeError", "Значение типа " + typeName(obj) + " нельзя менять по индексу.", target.line);
  }
  if (target.type === "Attribute"){
    var host = yield* this.eval(target.value, env);
    if (host instanceof PyObj){ host.fields.set(target.attr, val); return; }
    if (host instanceof PyType){ host.attrs.set(target.attr, val); return; }
    raise("AttributeError", "Значению типа " + typeName(host) + " нельзя добавить поле «" + target.attr + "».", target.line,
          { pymsg: "'" + typeName(host) + "' object has no attribute '" + target.attr + "'" });
  }
  raise("SyntaxError", "Сюда нельзя присвоить значение.", target.line);
};

/* ---------- выражения ---------- */
Interp.prototype.eval = function*(e, env){
  this.tick(e.line);
  switch (e.type){
    case "Num": return e.isFloat ? mkFloat(e.value) : e.value;
    case "Str": return e.value;
    case "Const": return e.value;
    case "Name": return env.get(e.id, e.line);

    case "FStr": {
      var s = "";
      for (var i = 0; i < e.parts.length; i++){
        var p = e.parts[i];
        if (p.text !== undefined){ s += p.text; continue; }
        if (!p.ast){
          var pp = new Parser(lex(p.code));
          p.ast = pp.parseExpr();
        }
        var v = yield* this.eval(p.ast, env);
        if (p.conv === "r" || p.conv === "a") v = pyRepr(v);
        else if (p.conv === "s") v = pyStr(v);
        /* Внутри формата тоже могут стоять фигурные скобки: f"{имя:<{ширина}}".
           Ширину и точность в Python разрешено брать из переменной, поэтому
           сначала собираем сам формат, а потом уже применяем его. */
        var spec = p.spec;
        if (spec && spec.indexOf("{") >= 0){
          if (!p.specParts) p.specParts = parseFString(spec, e.line);
          var built = "";
          for (var si = 0; si < p.specParts.length; si++){
            var sp = p.specParts[si];
            if (sp.text !== undefined){ built += sp.text; continue; }
            if (!sp.ast) sp.ast = new Parser(lex(sp.code)).parseExpr();
            built += pyStr(yield* this.eval(sp.ast, env));
          }
          spec = built;
        }
        s += applySpec(v, spec, e.line);
      }
      return s;
    }

    case "List": {
      var arr = [];
      for (var j = 0; j < e.elts.length; j++) arr.push(yield* this.eval(e.elts[j], env));
      return arr;
    }
    case "Tuple": {
      var t = [];
      for (var j2 = 0; j2 < e.elts.length; j2++) t.push(yield* this.eval(e.elts[j2], env));
      return Tup(t);
    }
    case "Dict": {
      var d = dictNew();
      for (var j3 = 0; j3 < e.keys.length; j3++){
        var k = yield* this.eval(e.keys[j3], env);
        var v2 = yield* this.eval(e.values[j3], env);
        dictSet(d, k, v2);
      }
      return d;
    }

    case "BinOp": {
      var l = yield* this.eval(e.left, env);
      var r = yield* this.eval(e.right, env);
      return this.binop(e.op, l, r, e.line);
    }
    case "Neg": {
      var x = yield* this.eval(e.value, env);
      if (!isNum(x)) raise("TypeError", "Минус нельзя поставить перед значением типа " + typeName(x) + ".", e.line);
      return num(-nv(x), isFloat(x));
    }
    case "Not": return !truthy(yield* this.eval(e.value, env));
    case "Yield": {
      var yv = e.value ? yield* this.eval(e.value, env) : null;
      var sent = yield { pyYield: yv };
      return sent === undefined ? null : sent;
    }

    case "YieldFrom": {
      var src = yield* this.eval(e.value, env);
      if (src instanceof PyGen){
        for (;;){
          var st2 = src.next();
          if (st2.done) break;
          yield { pyYield: st2.value };
        }
        return null;
      }
      var seq = iterate(src, e.line);
      for (var yi = 0; yi < seq.length; yi++) yield { pyYield: seq[yi] };
      return null;
    }

    case "Lambda": {
      var lf = new PyFunc("<lambda>", e.params, e.defaults,
                          [{ type:"Return", value:e.body, line:e.line }], env);
      lf.defaultVals = e.params.map(function(){ return undefined; });
      return lf;
    }

    case "SetLit": {
      var sl = new PySet();
      for (var sli = 0; sli < e.elts.length; sli++) sl.add(yield* this.eval(e.elts[sli], env));
      return sl;
    }

    case "Comp": {
      var acc = (e.kind === "list" || e.kind === "gen") ? []
              : e.kind === "set" ? new PySet() : dictNew();
      /* переменная включения живёт в своём окружении и не портит внешнюю —
         как в Python 3, где [x for x in ...] не затирает внешний x */
      yield* this.runComp(e, 0, new Env(env), acc);
      /* Генераторное выражение отдаёт генератор: его можно перебрать один раз.
         Отличие от настоящего Python: значения считаются сразу, а не по одному.
         Для конечных данных разницы нет; на бесконечном источнике настоящий
         Python отдал бы первое значение мгновенно, а тренажёр упрётся
         в защиту от вечного цикла. Записано в HANDOFF.md. */
      if (e.kind === "gen") return genOf("<genexpr>", function(){ return acc[Symbol.iterator](); });
      return acc;
    }

    case "CompareChain": {
      var cl = yield* this.eval(e.first, env);
      for (var cci = 0; cci < e.ops.length; cci++){
        var cr = yield* this.eval(e.rights[cci], env);
        if (!truthy(this.compare(e.ops[cci], cl, cr, e.line))) return false;
        cl = cr;
      }
      return true;
    }

    case "BoolOp": {
      var a = yield* this.eval(e.left, env);
      if (e.op === "and") return truthy(a) ? yield* this.eval(e.right, env) : a;
      return truthy(a) ? a : yield* this.eval(e.right, env);
    }
    case "Compare": {
      var A = yield* this.eval(e.left, env);
      var B = yield* this.eval(e.right, env);
      return this.compare(e.op, A, B, e.line);
    }
    case "Ternary": {
      var c = yield* this.eval(e.test, env);
      return truthy(c) ? yield* this.eval(e.body, env) : yield* this.eval(e.orelse, env);
    }

    case "Subscript": {
      var obj = yield* this.eval(e.value, env);
      var idx = yield* this.eval(e.index, env);
      return this.index(obj, idx, e.line);
    }
    case "Slice": {
      var o = yield* this.eval(e.value, env);
      var lo = e.lower ? nv(yield* this.eval(e.lower, env)) : null;
      var hi = e.upper ? nv(yield* this.eval(e.upper, env)) : null;
      var stp = e.step ? nv(yield* this.eval(e.step, env)) : 1;
      return this.slice(o, lo, hi, stp, e.line);
    }
    case "Attribute": {
      var base = yield* this.eval(e.value, env);
      return this.bindMethod(base, e.attr, e.line);
    }
    case "Call": {
      if (e.func.type === "Name" && e.func.id === "super" && !e.args.length){
        if (!env.has("__class__"))
          raise("RuntimeError", "super() работает только внутри метода класса.", e.line);
        var own = env.get("__class__", e.line);
        return new SuperProxy(own.base || TYPES.object, env.has("__self__") ? env.get("__self__", e.line) : null);
      }
      var args = [], kw = {};
      var fn;
      if (e.func.type === "Attribute"){
        var recv = yield* this.eval(e.func.value, env);
        fn = this.bindMethod(recv, e.func.attr, e.line);
      } else {
        fn = yield* this.eval(e.func, env);
      }
      for (var ai = 0; ai < e.args.length; ai++){
        var an = e.args[ai];
        if (an.type === "Star"){                       // f(*список) — разложить по одному
          var sv = iterate(yield* this.eval(an.value, env), e.line);
          for (var si = 0; si < sv.length; si++) args.push(sv[si]);
        } else {
          args.push(yield* this.eval(an, env));
        }
      }
      for (var kn in e.kwargs) kw[kn] = yield* this.eval(e.kwargs[kn], env);
      if (e.dstar) for (var dsi = 0; dsi < e.dstar.length; dsi++){   // f(**словарь)
        var dv = yield* this.eval(e.dstar[dsi], env);
        if (!(dv instanceof Map))
          raise("TypeError", "После ** в вызове должен стоять словарь.", e.line);
        var dks = dictKeys(dv);
        for (var dki = 0; dki < dks.length; dki++){
          if (typeof dks[dki] !== "string")
            raise("TypeError", "Ключи в **словаре должны быть строками.", e.line);
          kw[dks[dki]] = dictGet(dv, dks[dki]);
        }
      }
      return yield* this.call(fn, args, kw, e.line, e.func.type === "Name" ? e.func.id : null);
    }
  }
  raise("RuntimeError", "Неизвестное выражение.", e.line);
};

Interp.prototype.call = function*(fn, args, kw, line, nameHint){
  /* Метод, взятый у объекта: объект встаёт первым аргументом — это и есть self. */
  if (fn instanceof Bound)
    return yield* this.call(fn.fn, [fn.self].concat(args), kw, line, nameHint);
  if (typeof fn === "function"){
    /* pyGen — встроенная функция, которой самой нужно вызывать функции ученика
       (например sorted с key=). Такие написаны генераторами. */
    if (fn.pyGen) return yield* fn.call(this, args, kw, line);
    return fn(args, kw, line);
  }
  if (fn instanceof PyType) return yield* this.construct(fn, args, kw, line);
  if (fn instanceof PyFunc){
    var np = fn.params.length;
    if (args.length > np && !fn.vararg)
      raise("TypeError", "Функция «" + fn.name + "» ждёт " + np + " аргумент(ов), а получила " + args.length + ".", line,
            { pymsg: fn.name + "() takes " + np + " positional arguments but " + args.length + " were given" });
    var env = new Env(fn.closure);
    env.funcScope = true;
    if (!fn.localSet) fn.localSet = localNames(fn.body);
    env.declared = fn.localSet;
    var taken = {};
    for (var i = 0; i < np; i++){
      var p = fn.params[i];
      if (i < args.length) env.vars.set(p, args[i]);
      else if (kw && kw[p] !== undefined){ env.vars.set(p, kw[p]); taken[p] = 1; }
      else if (fn.defaultVals && fn.defaultVals[i] !== undefined) env.vars.set(p, fn.defaultVals[i]);
      else if (fn.defaults[i]) env.vars.set(p, yield* this.eval(fn.defaults[i], fn.closure));
      else raise("TypeError", "Функции «" + fn.name + "» не хватает аргумента «" + p + "».", line,
                 { pymsg: fn.name + "() missing required positional argument: '" + p + "'" });
    }
    if (fn.owner){ env.vars.set("__class__", fn.owner); if (args.length) env.vars.set("__self__", args[0]); }
    if (fn.vararg) env.vars.set(fn.vararg, Tup(args.slice(np)));
    if (fn.kwarg){
      var extra = dictNew();
      for (var k in kw) if (!taken[k] && fn.params.indexOf(k) < 0) dictSet(extra, k, kw[k]);
      env.vars.set(fn.kwarg, extra);
    } else {
      for (var k2 in kw) if (fn.params.indexOf(k2) < 0)
        raise("TypeError", "Функция «" + fn.name + "» не знает параметра «" + k2 + "».", line,
              { pymsg: fn.name + "() got an unexpected keyword argument '" + k2 + "'" });
    }
    if (fn.isGen === undefined) fn.isGen = hasYield(fn.body);
    if (fn.isGen) return new PyGen(fn.name, this.runBlock(fn.body, env));
    if (++this.depth > 220){
      this.depth--;
      raise("RecursionError", "Функция вызывает саму себя слишком глубоко — не хватает условия остановки.", line,
            { pymsg: "maximum recursion depth exceeded" });
    }
    var r;
    this.stack.push({ name: fn.name, env: env });
    try { r = yield* this.runBlock(fn.body, env); }
    finally { this.depth--; this.stack.pop(); }
    return r && r.kind === "return" ? r.value : null;
  }
  raise("TypeError", "«" + (nameHint || pyRepr(fn)) + "» — не функция, её нельзя вызвать со скобками.", line,
        { pymsg: "'" + typeName(fn) + "' object is not callable" });
};

Interp.prototype.binop = function(op, a, b, line){
  /* дата плюс срок, дата минус дата, путь через дробь — как в Python */
  if (a instanceof PyObj || b instanceof PyObj){
    var isDate = function(x){ return x instanceof PyObj && (x.cls === TYPES["datetime.date"] || x.cls === TYPES["datetime.datetime"]); };
    var isTd = function(x){ return x instanceof PyObj && x.cls === TYPES["datetime.timedelta"]; };
    if (op === "+" && isDate(a) && isTd(b)) return mkDT(a.cls, a.dtMs + b.tdMs);
    if (op === "+" && isTd(a) && isDate(b)) return mkDT(b.cls, b.dtMs + a.tdMs);
    if (op === "-" && isDate(a) && isTd(b)) return mkDT(a.cls, a.dtMs - b.tdMs);
    if (op === "-" && isDate(a) && isDate(b)){
      var td = new PyObj(TYPES["datetime.timedelta"]);
      td.tdMs = a.dtMs - b.dtMs;
      return td;
    }
    if (op === "+" && isTd(a) && isTd(b)){
      var td2 = new PyObj(TYPES["datetime.timedelta"]);
      td2.tdMs = a.tdMs + b.tdMs;
      return td2;
    }
    if (op === "/" && a instanceof PyObj && a.cls === TYPES["pathlib.Path"])
      return mkPath(a.fields.get("__path__").replace(/\/$/, "") + "/" + pyStr(b));
  }
  if (op === "+"){
    if (isNum(a) && isNum(b)) return num(nv(a) + nv(b), isFloat(a) || isFloat(b));
    if (typeof a === "string" && typeof b === "string") return a + b;
    if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
    if (typeof a === "string" && isNum(b))
      raise("TypeError", "Нельзя сложить текст и число. Преврати число в текст: str(" + fmtNum(b) + ") — или используй f-строку.", line,
            { pymsg: 'can only concatenate str (not "' + typeName(b) + '") to str' });
    if (isNum(a) && typeof b === "string")
      raise("TypeError", "Нельзя сложить число и текст. Преврати текст в число: int(\"" + b + "\") — если это цифры.", line,
            { pymsg: "unsupported operand type(s) for +: '" + typeName(a) + "' and 'str'" });
    raise("TypeError", "Нельзя сложить " + typeName(a) + " и " + typeName(b) + ".", line,
          { pymsg: "unsupported operand type(s) for +: '" + typeName(a) + "' and '" + typeName(b) + "'" });
  }
  /* Старое форматирование: "цена: %d" % 120. В новом коде пишут f-строки,
     но в чужом эта запись встречается постоянно — читать её надо уметь. */
  if (op === "%" && typeof a === "string"){
    var vals = isTup(b) ? b.slice() : [b];
    var vi = 0;
    return a.replace(/%(?:%|(-?)(\d*)(?:\.(\d+))?([sdif]))/g, function(all, minus, width, prec, kind){
      if (all === "%%") return "%";
      if (vi >= vals.length)
        raise("TypeError", "В строке больше знаков % , чем значений справа.", line,
              { pymsg: "not enough arguments for format string" });
      var v = vals[vi++], out;
      if (kind === "d" || kind === "i"){
        if (!isNum(v)) raise("TypeError", "%d ждёт число, а получил " + typeName(v) + ".", line,
                             { pymsg: "%d format: a real number is required, not " + typeName(v) });
        out = String(Math.trunc(nv(v)));
      } else if (kind === "f"){
        out = toFixedPy(nv(v), prec === undefined ? 6 : +prec);
      } else {
        out = pyStr(v);
        if (prec !== undefined) out = out.slice(0, +prec);
      }
      var w = width ? parseInt(width, 10) : 0;
      if (w > out.length) out = minus ? out + " ".repeat(w - out.length) : " ".repeat(w - out.length) + out;
      return out;
    });
  }
  if (op === "*"){
    if (isNum(a) && isNum(b)) return num(nv(a) * nv(b), isFloat(a) || isFloat(b));
    if (typeof a === "string" && isNum(b)) return a.repeat(Math.max(0, Math.trunc(nv(b))));
    if (isNum(a) && typeof b === "string") return b.repeat(Math.max(0, Math.trunc(nv(a))));
    if (Array.isArray(a) && isNum(b)){
      var out = [];
      for (var i = 0; i < Math.max(0, Math.trunc(nv(b))); i++) out = out.concat(a);
      return out;
    }
    raise("TypeError", "Нельзя умножить " + typeName(a) + " на " + typeName(b) + ".", line);
  }
  /* разность множеств */
  if (op === "-" && a instanceof PySet && b instanceof PySet){
    var dres = new PySet(), dv = a.values();
    for (var di = 0; di < dv.length; di++) if (!b.has(dv[di])) dres.add(dv[di]);
    return dres;
  }
  /* объединение, пересечение, симметрическая разность — и то же самое для целых чисел */
  if (op === "|" || op === "&" || op === "^"){
    if (a instanceof PySet && b instanceof PySet){
      var av = a.values(), bv = b.values(), q, r;
      if (op === "|"){
        r = new PySet(av);
        for (q = 0; q < bv.length; q++) r.add(bv[q]);
        return r;
      }
      r = new PySet();
      if (op === "&"){
        for (q = 0; q < av.length; q++) if (b.has(av[q])) r.add(av[q]);
        return r;
      }
      for (q = 0; q < av.length; q++) if (!b.has(av[q])) r.add(av[q]);
      for (q = 0; q < bv.length; q++) if (!a.has(bv[q])) r.add(bv[q]);
      return r;
    }
    if (isNum(a) && isNum(b)){
      var ia = Math.trunc(nv(a)), ib = Math.trunc(nv(b));
      return op === "|" ? (ia | ib) : op === "&" ? (ia & ib) : (ia ^ ib);
    }
    raise("TypeError", "Операция «" + op + "» работает с множествами или целыми числами, а не с " +
      typeName(a) + " и " + typeName(b) + ".", line);
  }
  if (!isNum(a) || !isNum(b))
    raise("TypeError", "Операция «" + op + "» не работает с типами " + typeName(a) + " и " + typeName(b) + ".", line);
  var x = nv(a), y = nv(b), f = isFloat(a) || isFloat(b);
  switch (op){
    case "-": return num(x - y, f);
    case "/":
      if (y === 0) raise("ZeroDivisionError", "Делить на ноль нельзя.", line, { pymsg: "division by zero" });
      return mkFloat(x / y);
    case "//":
      if (y === 0) raise("ZeroDivisionError", "Делить на ноль нельзя.", line, { pymsg: "integer division or modulo by zero" });
      return num(Math.floor(x / y), f);
    case "%":
      if (y === 0) raise("ZeroDivisionError", "Остаток от деления на ноль не существует.", line, { pymsg: "integer division or modulo by zero" });
      return num(((x % y) + y) % y, f);
    case "**": return num(Math.pow(x, y), f || !Number.isInteger(Math.pow(x, y)));
  }
  raise("RuntimeError", "Неизвестная операция «" + op + "».", line);
};

Interp.prototype.compare = function(op, a, b, line){
  switch (op){
    case "==": return pyEq(a, b);
    case "!=": return !pyEq(a, b);
    case "is": return a === b || (a === null && b === null);
    case "is not": return !(a === b || (a === null && b === null));
    case "in": case "not in": {
      var res;
      if (typeof b === "string"){
        if (typeof a !== "string") raise("TypeError", "Слева от «in» для строки должна быть строка.", line);
        res = b.indexOf(a) >= 0;
      } else if (Array.isArray(b)){
        res = b.some(function(x){ return pyEq(x, a); });
      } else if (b instanceof PySet){
        res = b.has(a);
      } else if (b instanceof Map){
        res = dictHas(b, a);
      } else raise("TypeError", "«in» не работает с типом " + typeName(b) + ".", line);
      return op === "in" ? res : !res;
    }
  }
  var c = this.cmp(a, b, line);
  switch (op){
    case "<": return c < 0;
    case ">": return c > 0;
    case "<=": return c <= 0;
    case ">=": return c >= 0;
  }
  raise("RuntimeError", "Неизвестное сравнение.", line);
};

Interp.prototype.index = function(obj, idx, line){
  if (typeof obj === "string" || Array.isArray(obj)){
    if (!isNum(idx)) raise("TypeError", "Индекс должен быть целым числом, а не " + typeName(idx) + ".", line);
    var n = Math.trunc(nv(idx)), L = obj.length;
    if (n < 0) n += L;
    if (n < 0 || n >= L)
      raise("IndexError", (Array.isArray(obj) ? "В списке" : "В строке") + " всего " + L +
        " элемент(ов), нумерация с 0, а ты просишь номер " + Math.trunc(nv(idx)) + ".", line,
        { pymsg: (isTup(obj) ? "tuple" : Array.isArray(obj) ? "list" : "string") + " index out of range" });
    return obj[n];
  }
  if (obj instanceof Map){
    if (!dictHas(obj, idx)){
      /* у defaultdict отсутствующий ключ не ошибка: значение создаётся на месте */
      if (obj.__factory__ !== undefined && obj.__factory__ !== null){
        var made = callSync(obj.__factory__, [], line);
        dictSet(obj, idx, made);
        return made;
      }
      if (obj.__counter__) return 0;   /* у счётчика ненайденное — просто ноль */
      raise("KeyError", "В словаре нет ключа " + pyRepr(idx) + ".", line, { pymsg: idx });
    }
    return dictGet(obj, idx);
  }
  raise("TypeError", "У значения типа " + typeName(obj) + " нет доступа по индексу.", line);
};

Interp.prototype.slice = function(o, lo, hi, step, line){
  if (typeof o !== "string" && !Array.isArray(o))
    raise("TypeError", "Срез работает только со строками и списками.", line);
  var L = o.length;
  step = step === null || step === undefined ? 1 : Math.trunc(step);
  if (step === 0) raise("ValueError", "Шаг среза не может быть нулём.", line);
  var arr = typeof o === "string" ? o.split("") : o;
  var res = [];
  if (step > 0){
    var s = lo === null ? 0 : (lo < 0 ? Math.max(0, L + lo) : Math.min(lo, L));
    var e = hi === null ? L : (hi < 0 ? Math.max(0, L + hi) : Math.min(hi, L));
    for (var i = s; i < e; i += step) res.push(arr[i]);
  } else {
    var s2 = lo === null ? L - 1 : (lo < 0 ? L + lo : Math.min(lo, L - 1));
    var e2 = hi === null ? -1 : (hi < 0 ? L + hi : hi);
    for (var i2 = s2; i2 > e2; i2 += step) if (i2 >= 0 && i2 < L) res.push(arr[i2]);
  }
  return typeof o === "string" ? res.join("") : res;
};

/* ============================================================
   ВСТРОЕННЫЕ МОДУЛИ
   ============================================================ */
/* @dataclass: по списку полей класса дописывает __init__, __repr__ и __eq__.
   Ровно это и делает настоящий dataclasses.dataclass — поэтому вывод совпадает. */
function makeDataclass(cls, line){
  if (!(cls instanceof PyType))
    raise("TypeError", "@dataclass ставится над классом.", line);
  var fields = (cls.annotations || []).map(function(a){ return a.name; });
  var defs = {};
  fields.forEach(function(f){ if (cls.attrs.has(f)) defs[f] = cls.attrs.get(f); });

  cls.attrs.set("__init__", function(args, kw, l){
    var self = args[0], rest = args.slice(1);
    if (rest.length > fields.length)
      raise("TypeError", "Классу «" + cls.name + "» передали больше значений, чем у него полей.", l,
            { pymsg: "__init__() takes " + (fields.length + 1) + " positional arguments but " + (rest.length + 1) + " were given" });
    for (var i = 0; i < fields.length; i++){
      var f = fields[i], v;
      if (i < rest.length) v = rest[i];
      else if (kw && kw[f] !== undefined) v = kw[f];
      else if (Object.prototype.hasOwnProperty.call(defs, f)) v = defs[f];
      else raise("TypeError", "Классу «" + cls.name + "» не хватает значения для поля «" + f + "».", l,
                 { pymsg: "__init__() missing 1 required positional argument: '" + f + "'" });
      self.fields.set(f, v);
    }
    return null;
  });
  cls.attrs.set("__repr__", function(args){
    var self = args[0];
    return cls.name + "(" + fields.map(function(f){
      return f + "=" + pyRepr(self.fields.get(f));
    }).join(", ") + ")";
  });
  cls.attrs.set("__eq__", function(args){
    var self = args[0], other = args[1];
    if (!(other instanceof PyObj) || other.cls !== self.cls) return false;
    for (var i = 0; i < fields.length; i++)
      if (!pyEq(self.fields.get(fields[i]), other.fields.get(fields[i]))) return false;
    return true;
  });
  return cls;
}

/* ---------- json ----------
   Пишем сами, а не через JSON.stringify: у Python свои пробелы после
   двоеточия и запятой, и по умолчанию он прячет русские буквы в \uXXXX. */
function jsonEsc(str, ensureAscii){
  var out = '"';
  for (var i = 0; i < str.length; i++){
    var c = str[i], code = str.charCodeAt(i);
    if (c === '"') out += '\\"';
    else if (c === "\\") out += "\\\\";
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c === "\t") out += "\\t";
    else if (code < 0x20) out += "\\u" + ("0000" + code.toString(16)).slice(-4);
    else if (ensureAscii && code > 126) out += "\\u" + ("0000" + code.toString(16)).slice(-4);
    else out += c;
  }
  return out + '"';
}
function jsonDump(v, ensureAscii, indent, depth, line){
  var pad = indent ? "\n" + " ".repeat(indent * (depth + 1)) : "";
  var padEnd = indent ? "\n" + " ".repeat(indent * depth) : "";
  var comma = indent ? "," + pad : ", ";
  if (v === null || v === undefined) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (isNum(v)) return fmtNum(v);
  if (typeof v === "string") return jsonEsc(v, ensureAscii);
  if (Array.isArray(v)){
    if (!v.length) return "[]";
    var items = v.map(function(x){ return jsonDump(x, ensureAscii, indent, depth + 1, line); });
    return "[" + pad + items.join(comma) + padEnd + "]";
  }
  if (v instanceof Map){
    var keys = dictKeys(v);
    if (!keys.length) return "{}";
    var parts = keys.map(function(k){
      if (typeof k !== "string" && !isNum(k) && k !== true && k !== false && k !== null)
        raise("TypeError", "В JSON ключом может быть только строка или число.", line,
              { pymsg: "keys must be str, int, float, bool or None, not " + typeName(k) });
      var ks = typeof k === "string" ? jsonEsc(k, ensureAscii) : jsonEsc(pyStr(k), ensureAscii);
      return ks + ": " + jsonDump(dictGet(v, k), ensureAscii, indent, depth + 1, line);
    });
    return "{" + pad + parts.join(comma) + padEnd + "}";
  }
  raise("TypeError", "Значение типа " + typeName(v) + " в JSON не превратить.", line,
        { pymsg: "Object of type " + typeName(v) + " is not JSON serializable" });
}
function jsonToPy(v){
  if (v === null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return Number.isInteger(v) ? v : mkFloat(v);
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(jsonToPy);
  var d = dictNew();
  for (var k in v) dictSet(d, k, jsonToPy(v[k]));
  return d;
}

/* ---------- csv ---------- */
function csvSplitLine(line){
  var out = [], cur = "", inQ = false;
  for (var i = 0; i < line.length; i++){
    var c = line[i];
    if (inQ){
      if (c === '"' && line[i+1] === '"'){ cur += '"'; i++; continue; }
      if (c === '"'){ inQ = false; continue; }
      cur += c;
      continue;
    }
    if (c === '"'){ inQ = true; continue; }
    if (c === ","){ out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}
function csvCell(v){
  var s = pyStr(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvRows(src, line){
  var text;
  if (src instanceof PyFile){ src.checkOpen(line); text = src.readAll(); }
  else text = iterate(src, line).map(pyStr).join("");
  text = text.replace(/\r\n/g, "\n").replace(/\n$/, "");
  if (text === "") return [];
  return text.split("\n").map(csvSplitLine);
}

/* ---------- дата и время ----------
   date и datetime — обычные объекты с полями, чтобы работали сравнение,
   вычитание и strftime. Хранит внутри миллисекунды UTC: часовых поясов
   в тренажёре нет, и это честно сказано в уроке. */
var MONTH_NAMES = ["January","February","March","April","May","June","July",
                   "August","September","October","November","December"];
var DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
function two(n){ return (n < 10 ? "0" : "") + n; }
function mkDT(cls, ms){
  var o = new PyObj(cls);
  o.dtMs = ms;
  return o;
}
function dtParts(o){
  var d = new Date(o.dtMs);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(),
           h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(),
           wd: (d.getUTCDay() + 6) % 7 };
}
function dtStrftime(o, fmt){
  var p = dtParts(o);
  var map = {
    "%d": two(p.d), "%m": two(p.mo), "%Y": String(p.y), "%y": two(p.y % 100),
    "%H": two(p.h), "%M": two(p.mi), "%S": two(p.s),
    "%A": DAY_NAMES[p.wd], "%a": DAY_NAMES[p.wd].slice(0, 3),
    "%B": MONTH_NAMES[p.mo - 1], "%b": MONTH_NAMES[p.mo - 1].slice(0, 3),
    "%%": "%"
  };
  return String(fmt).replace(/%[a-zA-Z%]/g, function(m){
    return map[m] !== undefined ? map[m] : m;
  });
}

var BUILTIN_MODULES = {
  math: function(I){
    return {
      pi: mkFloat(Math.PI),
      e: mkFloat(Math.E),
      tau: mkFloat(Math.PI * 2),
      inf: mkFloat(Infinity),
      sqrt: function(args, kw, line){
        if (nv(args[0]) < 0) raise("ValueError", "Квадратного корня из отрицательного числа нет.", line,
                                   { pymsg: "math domain error" });
        return mkFloat(Math.sqrt(nv(args[0])));
      },
      floor: function(args){ return Math.floor(nv(args[0])); },
      ceil:  function(args){ return Math.ceil(nv(args[0])); },
      trunc: function(args){ return Math.trunc(nv(args[0])); },
      fabs:  function(args){ return mkFloat(Math.abs(nv(args[0]))); },
      pow:   function(args){ return mkFloat(Math.pow(nv(args[0]), nv(args[1]))); },
      hypot: function(args){ return mkFloat(Math.hypot.apply(null, args.map(nv))); },
      gcd: function(args){
        var a = Math.abs(Math.trunc(nv(args[0]))), b = Math.abs(Math.trunc(nv(args[1])));
        while (b){ var t = a % b; a = b; b = t; }
        return a;
      },
      factorial: function(args, kw, line){
        var n = Math.trunc(nv(args[0]));
        if (n < 0) raise("ValueError", "Факториала отрицательного числа не бывает.", line,
                         { pymsg: "factorial() not defined for negative values" });
        if (n > 20) raise("ValueError", "Факториал больше 20! в этом движке считается неточно — возьми число поменьше.", line,
                          { pymsg: "число слишком велико для этого движка" });
        var r = 1;
        for (var i = 2; i <= n; i++) r *= i;
        return r;
      }
    };
  },
  random: function(I){
    return {
      random: function(){ return mkFloat(I.random()); },
      randint: function(args, kw, line){
        var a = Math.trunc(nv(args[0])), b = Math.trunc(nv(args[1]));
        return a + Math.floor(I.random() * (b - a + 1));
      },
      uniform: function(args){
        var a = nv(args[0]), b = nv(args[1]);
        return mkFloat(a + I.random() * (b - a));
      },
      choice: function(args, kw, line){
        var arr = iterate(args[0], line);
        if (!arr.length) raise("ValueError", "choice() из пустого списка.", line,
                               { pymsg: "Cannot choose from an empty sequence" });
        return arr[Math.floor(I.random() * arr.length)];
      },
      shuffle: function(args, kw, line){
        var arr = args[0];
        if (!Array.isArray(arr) || isTup(arr))
          raise("TypeError", "shuffle() перемешивает список на месте.", line);
        for (var i = arr.length - 1; i > 0; i--){
          var j = Math.floor(I.random() * (i + 1));
          var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return null;
      },
      sample: function(args, kw, line){
        var pool = iterate(args[0], line).slice(), k = Math.trunc(nv(args[1]));
        if (k < 0 || k > pool.length)
          raise("ValueError", "sample(): нельзя выбрать " + k + " из " + pool.length + ".", line,
                { pymsg: "Sample larger than population or is negative" });
        var out = [];
        for (var i = 0; i < k; i++) out.push(pool.splice(Math.floor(I.random() * pool.length), 1)[0]);
        return out;
      },
      seed: function(args){ I._seed = args.length ? Math.trunc(nv(args[0])) || 1 : 12345; return null; }
    };
  },
  dataclasses: function(I){
    return {
      dataclass: function(args, kw, line){ return makeDataclass(args[0], line); }
    };
  },

  json: function(I){
    return {
      JSONDecodeError: TYPES.JSONDecodeError,
      dumps: function(args, kw, line){
        var ensure = !(kw && kw.ensure_ascii !== undefined && !truthy(kw.ensure_ascii));
        var indent = kw && kw.indent !== undefined && kw.indent !== null ? Math.trunc(nv(kw.indent)) : 0;
        return jsonDump(args[0], ensure, indent, 0, line);
      },
      loads: function(args, kw, line){
        var text = pyStr(args[0]);
        var parsed;
        try { parsed = JSON.parse(text); }
        catch (e){
          raise("JSONDecodeError", "Это не похоже на JSON: " + e.message, line,
                { pymsg: "Expecting value: line 1 column 1 (char 0)" });
        }
        return jsonToPy(parsed);
      },
      dump: function(args, kw, line){
        var f = args[1];
        if (!(f instanceof PyFile)) raise("TypeError", "json.dump() пишет в файл.", line);
        var ensure = !(kw && kw.ensure_ascii !== undefined && !truthy(kw.ensure_ascii));
        var indent = kw && kw.indent !== undefined && kw.indent !== null ? Math.trunc(nv(kw.indent)) : 0;
        f.checkOpen(line);
        f.append(jsonDump(args[0], ensure, indent, 0, line));
        return null;
      },
      load: function(args, kw, line){
        var f = args[0];
        if (!(f instanceof PyFile)) raise("TypeError", "json.load() читает из файла.", line);
        f.checkOpen(line);
        return jsonToPy(JSON.parse(f.readAll()));
      }
    };
  },

  csv: function(I){
    return {
      reader: function(args, kw, line){
        var rows = csvRows(args[0], line);
        return rows.map(function(r){ return r.slice(); });
      },
      DictReader: function(args, kw, line){
        var rows = csvRows(args[0], line);
        if (!rows.length) return [];
        var head = rows[0];
        return rows.slice(1).map(function(r){
          var d = dictNew();
          for (var i = 0; i < head.length; i++) dictSet(d, head[i], r[i] === undefined ? "" : r[i]);
          return d;
        });
      },
      writer: function(args, kw, line){
        var f = args[0];
        if (!(f instanceof PyFile)) raise("TypeError", "csv.writer() пишет в файл.", line);
        var W = new PyObj(TYPES.csvwriter);
        W.fields.set("__file__", f);
        return W;
      }
    };
  },

  collections: function(I){
    return {
      Counter: function(args, kw, line){
        var c = dictNew();
        c.__counter__ = true;
        if (args.length){
          if (args[0] instanceof Map){
            dictKeys(args[0]).forEach(function(k){ dictSet(c, k, dictGet(args[0], k)); });
          } else {
            iterate(args[0], line).forEach(function(x){
              dictSet(c, x, (dictGet(c, x) || 0) + 1);
            });
          }
        }
        return c;
      },
      defaultdict: function(args, kw, line){
        var d = dictNew();
        d.__factory__ = args.length ? args[0] : null;
        return d;
      }
    };
  },

  itertools: function(I){
    return {
      count: function(args, kw, line){
        var start = args.length ? nv(args[0]) : 0;
        var step = args.length > 1 ? nv(args[1]) : 1;
        var floaty = (args.length && isFloat(args[0])) || (args.length > 1 && isFloat(args[1]));
        return genOf("count", function*(){
          var n = start;
          for (;;){ yield num(n, floaty); n += step; }
        });
      },
      cycle: function(args, kw, line){
        var seq = iterate(args[0], line).slice();
        return genOf("cycle", function*(){
          if (!seq.length) return;
          for (;;) for (var i = 0; i < seq.length; i++) yield seq[i];
        });
      },
      repeat: function(args, kw, line){
        var v = args[0], times = args.length > 1 ? Math.trunc(nv(args[1])) : -1;
        return genOf("repeat", function*(){
          if (times < 0){ for (;;) yield v; }
          for (var i = 0; i < times; i++) yield v;
        });
      },
      chain: function(args, kw, line){
        var lists = args.map(function(a){ return iterate(a, line); });
        return genOf("chain", function*(){
          for (var i = 0; i < lists.length; i++)
            for (var j = 0; j < lists[i].length; j++) yield lists[i][j];
        });
      },
      islice: function(args, kw, line){
        var src = args[0];
        var start = 0, stop = null;
        if (args.length === 2) stop = args[1] === null ? null : Math.trunc(nv(args[1]));
        else if (args.length >= 3){
          start = Math.trunc(nv(args[1]));
          stop = args[2] === null ? null : Math.trunc(nv(args[2]));
        }
        return genOf("islice", function*(){
          var i = 0;
          if (src instanceof PyGen){
            for (;;){
              if (stop !== null && i >= stop) return;
              var st = src.next();
              if (st.done) return;
              if (i >= start) yield st.value;
              i++;
            }
          }
          var seq = iterate(src, line);
          for (i = start; i < seq.length && (stop === null || i < stop); i++) yield seq[i];
        });
      },
      product: function(args, kw, line){
        var lists = args.map(function(a){ return iterate(a, line); });
        var reps = kw && kw.repeat !== undefined ? Math.trunc(nv(kw.repeat)) : 1;
        var pools = [];
        for (var r = 0; r < reps; r++) pools = pools.concat(lists);
        return genOf("product", function*(){
          if (!pools.length){ yield Tup([]); return; }
          var idx = pools.map(function(){ return 0; });
          for (;;){
            yield Tup(pools.map(function(p, i){ return p[idx[i]]; }));
            var k = pools.length - 1;
            for (;;){
              idx[k]++;
              if (idx[k] < pools[k].length) break;
              idx[k] = 0; k--;
              if (k < 0) return;
            }
          }
        });
      },
      permutations: function(args, kw, line){
        var pool = iterate(args[0], line).slice();
        var r = args.length > 1 ? Math.trunc(nv(args[1])) : pool.length;
        return genOf("permutations", function*(){
          if (r > pool.length) return;
          var used = pool.map(function(){ return false; });
          var cur = [];
          yield* (function*walk(){
            if (cur.length === r){ yield Tup(cur.slice()); return; }
            for (var i = 0; i < pool.length; i++){
              if (used[i]) continue;
              used[i] = true; cur.push(pool[i]);
              yield* walk();
              cur.pop(); used[i] = false;
            }
          })();
        });
      },
      combinations: function(args, kw, line){
        var pool = iterate(args[0], line).slice();
        var r = Math.trunc(nv(args[1]));
        return genOf("combinations", function*(){
          if (r > pool.length || r < 0) return;
          var cur = [];
          yield* (function*walk(start){
            if (cur.length === r){ yield Tup(cur.slice()); return; }
            for (var i = start; i < pool.length; i++){
              cur.push(pool[i]);
              yield* walk(i + 1);
              cur.pop();
            }
          })(0);
        });
      }
    };
  },

  datetime: function(I){
    var dateCls = TYPES["datetime.date"], dtCls = TYPES["datetime.datetime"], tdCls = TYPES["datetime.timedelta"];
    function mkDate(args, kw, line){
      var y = Math.trunc(nv(args[0])), mo = Math.trunc(nv(args[1])), d = Math.trunc(nv(args[2]));
      if (mo < 1 || mo > 12) raise("ValueError", "Месяц бывает от 1 до 12.", line, { pymsg: "month must be in 1..12" });
      if (d < 1 || d > 31) raise("ValueError", "Такого числа в месяце нет.", line, { pymsg: "day is out of range for month" });
      return mkDT(dateCls, Date.UTC(y, mo - 1, d));
    }
    function mkDatetime(args, kw, line){
      var y = Math.trunc(nv(args[0])), mo = Math.trunc(nv(args[1])), d = Math.trunc(nv(args[2]));
      var h = args.length > 3 ? Math.trunc(nv(args[3])) : 0;
      var mi = args.length > 4 ? Math.trunc(nv(args[4])) : 0;
      var se = args.length > 5 ? Math.trunc(nv(args[5])) : 0;
      return mkDT(dtCls, Date.UTC(y, mo - 1, d, h, mi, se));
    }
    dateCls.ctor = mkDate;
    dtCls.ctor = mkDatetime;
    tdCls.ctor = function(args, kw, line){
      var days = args.length ? nv(args[0]) : 0;
      var secs = args.length > 1 ? nv(args[1]) : 0;
      if (kw){
        if (kw.days !== undefined) days = nv(kw.days);
        if (kw.seconds !== undefined) secs = nv(kw.seconds);
        if (kw.hours !== undefined) secs += nv(kw.hours) * 3600;
        if (kw.minutes !== undefined) secs += nv(kw.minutes) * 60;
        if (kw.weeks !== undefined) days += nv(kw.weeks) * 7;
      }
      var o = new PyObj(tdCls);
      o.tdMs = days * 86400000 + secs * 1000;
      return o;
    };
    dateCls.attrs.set("today", function(args, kw, line){
      var now = new Date();
      return mkDT(dateCls, Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    });
    dateCls.attrs.set("fromisoformat", function(args, kw, line){
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pyStr(args[0]));
      if (!m) raise("ValueError", "Дата должна выглядеть как 2026-08-26.", line,
                    { pymsg: "Invalid isoformat string: '" + pyStr(args[0]) + "'" });
      return mkDT(dateCls, Date.UTC(+m[1], +m[2] - 1, +m[3]));
    });
    dtCls.attrs.set("now", function(args, kw, line){
      var n = new Date();
      return mkDT(dtCls, Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(),
                                  n.getHours(), n.getMinutes(), n.getSeconds()));
    });
    return { date: dateCls, datetime: dtCls, timedelta: tdCls };
  },

  pathlib: function(I){
    return { Path: TYPES["pathlib.Path"] };
  },

  re: function(I){
    return {
      IGNORECASE: 2, I: 2, MULTILINE: 8, M: 8, DOTALL: 16, S: 16,
      search: function(args, kw, line){ return reFind(args, line, false); },
      match: function(args, kw, line){ return reFind(args, line, true); },
      fullmatch: function(args, kw, line){ return reFind(args, line, true, true); },
      findall: function(args, kw, line){
        var rx = toJsRegex(pyStr(args[0]), args[2], line, true);
        var text = pyStr(args[1]);
        var out = [], m;
        while ((m = rx.exec(text)) !== null){
          if (m.length === 1) out.push(m[0]);
          else if (m.length === 2) out.push(m[1] === undefined ? "" : m[1]);
          else out.push(Tup(m.slice(1).map(function(x){ return x === undefined ? "" : x; })));
          if (m[0] === "") rx.lastIndex++;
        }
        return out;
      },
      sub: function(args, kw, line){
        var rx = toJsRegex(pyStr(args[0]), args[3], line, true);
        var rep = pyStr(args[1]).replace(/\\(\d)/g, "$$$1");
        return pyStr(args[2]).replace(rx, rep);
      },
      split: function(args, kw, line){
        var rx = toJsRegex(pyStr(args[0]), args[2], line, true);
        return pyStr(args[1]).split(rx).map(function(x){ return x === undefined ? "" : x; });
      }
    };
  },

  time: function(I){
    return {
      time: function(){ return mkFloat(Date.now() / 1000); },
      perf_counter: function(){ return mkFloat((typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000); }
    };
  },

  statistics: function(I){
    return {
      /* mean и median в Python отдают целое, если данные целые и результат
         делится ровно: statistics.mean([4, 8, 6, 10, 2]) это 6, а не 6.0 */
      mean: function(args, kw, line){
        var xs = iterate(args[0], line);
        if (!xs.length) raise("ValueError", "Среднее пустого списка не существует.", line,
                              { pymsg: "mean requires at least one data point" });
        var sum = 0, allInt = true;
        xs.forEach(function(x){
          if (!isNum(x)) raise("TypeError", "Среднее считается только по числам.", line);
          if (isFloat(x)) allInt = false;
          sum += nv(x);
        });
        var res = sum / xs.length;
        return (allInt && Number.isInteger(res)) ? res : mkFloat(res);
      },
      median: function(args, kw, line){
        var raw = iterate(args[0], line);
        if (!raw.length) raise("ValueError", "Медианы пустого списка не существует.", line,
                              { pymsg: "no median for empty data" });
        var allInt = raw.every(function(x){ return !isFloat(x); });
        var xs = raw.map(nv).slice().sort(function(a, b){ return a - b; });
        var mid = Math.floor(xs.length / 2);
        if (xs.length % 2) return allInt ? xs[mid] : mkFloat(xs[mid]);
        var res = (xs[mid - 1] + xs[mid]) / 2;
        return (allInt && Number.isInteger(res)) ? res : mkFloat(res);
      }
    };
  }
};

/* ---------- регулярные выражения ----------
   Шаблон Python переводим в шаблон JavaScript: \w у нас должен понимать
   русские буквы, а именованные группы пишутся немного иначе. */
function toJsRegex(pattern, flagsArg, line, global){
  var f = (global ? "gu" : "u");
  var flags = flagsArg === undefined || flagsArg === null ? 0 : Math.trunc(nv(flagsArg));
  if (flags & 2) f += "i";
  if (flags & 8) f += "m";
  if (flags & 16) f += "s";
  var out = "", i = 0, inClass = false;
  while (i < pattern.length){
    var c = pattern[i];
    if (c === "\\"){
      var n = pattern[i+1];
      /* внутри [...] подставлять готовый класс нельзя — только его содержимое */
      if (n === "w"){ out += inClass ? "\\p{L}\\p{N}_" : "[\\p{L}\\p{N}_]"; i += 2; continue; }
      if (n === "W"){ out += inClass ? "\\W" : "[^\\p{L}\\p{N}_]"; i += 2; continue; }
      if (n === "d"){ out += inClass ? "0-9" : "[0-9]"; i += 2; continue; }
      if (n === "D"){ out += inClass ? "\\D" : "[^0-9]"; i += 2; continue; }
      if (n === "A" && !inClass){ out += "^"; i += 2; continue; }
      if (n === "Z" && !inClass){ out += "$"; i += 2; continue; }
      out += c + n; i += 2; continue;
    }
    if (!inClass && c === "["){ inClass = true; out += c; i++; continue; }
    if (inClass && c === "]"){ inClass = false; out += c; i++; continue; }
    if (pattern.substr(i, 4) === "(?P<"){ out += "(?<"; i += 4; continue; }
    if (pattern.substr(i, 4) === "(?P="){
      var end = pattern.indexOf(")", i);
      out += "\\k<" + pattern.slice(i + 4, end) + ">";
      i = end + 1; continue;
    }
    out += c; i++;
  }
  try { return new RegExp(out, f); }
  catch (e){
    raise("ValueError", "Непонятный шаблон: " + pattern + " (" + e.message + ")", line,
          { pymsg: "bad pattern" });
  }
}
function reFind(args, line, anchored, full){
  var src = pyStr(args[0]);
  if (anchored) src = "^(?:" + src + ")" + (full ? "$" : "");
  var rx = toJsRegex(src, args[2], line, false);
  var text = pyStr(args[1]);
  var m = rx.exec(text);
  if (!m) return null;
  var o = new PyObj(TYPES["re.Match"]);
  o.reMatch = m;
  o.reText = text;
  return o;
}

/* ---------- поведение объектов из модулей ----------
   Дата, путь, совпадение регулярки и писатель csv — обычные объекты движка.
   Их методы описаны здесь, потому что писать их на мини-Python негде. */
function moduleMethod(I, obj, name, line){
  var cls = obj.cls;

  if (cls === TYPES["datetime.date"] || cls === TYPES["datetime.datetime"]){
    var p = dtParts(obj);
    if (name === "year") return p.y;
    if (name === "month") return p.mo;
    if (name === "day") return p.d;
    if (name === "hour") return p.h;
    if (name === "minute") return p.mi;
    if (name === "second") return p.s;
    var D = {
      strftime: function(a){ return dtStrftime(obj, pyStr(a[0])); },
      isoformat: function(){
        var q = dtParts(obj);
        var d = q.y + "-" + two(q.mo) + "-" + two(q.d);
        return cls === TYPES["datetime.datetime"]
          ? d + "T" + two(q.h) + ":" + two(q.mi) + ":" + two(q.s) : d;
      },
      weekday: function(){ return dtParts(obj).wd; },
      date: function(){
        var q = dtParts(obj);
        return mkDT(TYPES["datetime.date"], Date.UTC(q.y, q.mo - 1, q.d));
      },
      replace: function(a, kw){
        var q = dtParts(obj);
        if (kw){
          if (kw.year !== undefined) q.y = Math.trunc(nv(kw.year));
          if (kw.month !== undefined) q.mo = Math.trunc(nv(kw.month));
          if (kw.day !== undefined) q.d = Math.trunc(nv(kw.day));
        }
        return mkDT(cls, Date.UTC(q.y, q.mo - 1, q.d, q.h, q.mi, q.s));
      }
    };
    if (!D[name]) return undefined;
    return function(a, kw){ return D[name](a, kw); };
  }

  if (cls === TYPES["datetime.timedelta"]){
    if (name === "days") return Math.floor(obj.tdMs / 86400000);
    if (name === "seconds") return Math.floor((obj.tdMs % 86400000) / 1000);
    if (name === "total_seconds") return function(){ return mkFloat(obj.tdMs / 1000); };
    return undefined;
  }

  if (cls === TYPES["pathlib.Path"]){
    var path = obj.fields.get("__path__");
    var base = path.slice(path.lastIndexOf("/") + 1);
    var dot = base.lastIndexOf(".");
    if (name === "name") return base;
    if (name === "suffix") return dot > 0 ? base.slice(dot) : "";
    if (name === "stem") return dot > 0 ? base.slice(0, dot) : base;
    if (name === "parent"){
      var slash = path.lastIndexOf("/");
      return mkPath(slash < 0 ? "." : (slash === 0 ? "/" : path.slice(0, slash)));
    }
    var P = {
      exists: function(){ return I.disk.has(path); },
      read_text: function(a, kw){
        if (!I.disk.has(path))
          raise("FileNotFoundError", "Файла «" + path + "» нет.", line,
                { pymsg: "[Errno 2] No such file or directory: '" + path + "'" });
        return I.disk.read(path);
      },
      write_text: function(a){
        var text = pyStr(a[0]);
        I.disk.write(path, text);
        return text.length;
      },
      unlink: function(){ I.disk.remove(path); return null; },
      with_suffix: function(a){
        var sfx = pyStr(a[0]);
        return mkPath(dot > 0 ? path.slice(0, path.length - (base.length - dot)) + sfx : path + sfx);
      },
      joinpath: function(a){ return mkPath(path.replace(/\/$/, "") + "/" + pyStr(a[0])); }
    };
    if (!P[name]) return undefined;
    return function(a, kw){ return P[name](a, kw); };
  }

  if (cls === TYPES["re.Match"]){
    var m = obj.reMatch;
    var R = {
      group: function(a){
        var i = a.length ? a[0] : 0;
        if (typeof i === "string"){
          var v = m.groups ? m.groups[i] : undefined;
          if (v === undefined)
            raise("IndexError", "Группы «" + i + "» в шаблоне нет.", line, { pymsg: "no such group" });
          return v;
        }
        var n = Math.trunc(nv(i));
        if (n >= m.length) raise("IndexError", "Группы номер " + n + " в шаблоне нет.", line, { pymsg: "no such group" });
        return m[n] === undefined ? null : m[n];
      },
      groups: function(){
        return Tup(m.slice(1).map(function(x){ return x === undefined ? null : x; }));
      },
      start: function(){ return m.index; },
      end: function(){ return m.index + m[0].length; },
      span: function(){ return Tup([m.index, m.index + m[0].length]); }
    };
    if (!R[name]) return undefined;
    return function(a){ return R[name](a); };
  }

  if (cls === TYPES.csvwriter){
    var f = obj.fields.get("__file__");
    var W = {
      writerow: function(a){
        f.checkOpen(line);
        /* Python по умолчанию заканчивает строку так же — \r\n */
        f.append(iterate(a[0], line).map(csvCell).join(",") + "\r\n");
        return null;
      },
      writerows: function(a){
        var rows = iterate(a[0], line);
        for (var i = 0; i < rows.length; i++){
          f.checkOpen(line);
          f.append(iterate(rows[i], line).map(csvCell).join(",") + "\r\n");
        }
        return null;
      }
    };
    if (!W[name]) return undefined;
    return function(a){ return W[name](a); };
  }

  return undefined;
}
function mkPath(str){
  var o = new PyObj(TYPES["pathlib.Path"]);
  o.fields.set("__path__", str);
  return o;
}
TYPES["pathlib.Path"].ctor = function(args, kw, line){
  var parts = args.map(pyStr).filter(function(x){ return x !== ""; });
  return mkPath(parts.length ? parts.join("/") : ".");
};

/* ---------- методы ---------- */
Interp.prototype.bindMethod = function(obj, name, line){
  var I = this;

  if (obj instanceof PyFile){
    var F = {
      read: function(){ obj.checkOpen(line); return obj.readAll(); },
      readline: function(){ obj.checkOpen(line); return obj.readLine(); },
      readlines: function(){ obj.checkOpen(line); return obj.lines(); },
      write: function(a){
        obj.checkOpen(line);
        if (obj.mode.indexOf("r") >= 0)
          raise("OSError", "Файл открыт только для чтения — записать в него нельзя. Нужен режим \"w\" или \"a\".", line,
                { pymsg: "not writable" });
        var text = pyStr(a[0]);
        obj.append(text);
        return text.length;
      },
      writelines: function(a){
        obj.checkOpen(line);
        var parts = iterate(a[0], line);
        for (var i = 0; i < parts.length; i++) obj.append(pyStr(parts[i]));
        return null;
      },
      close: function(){ obj.close(); return null; },
      __enter__: function(){ return obj; },
      __exit__: function(){ obj.close(); return null; }
    };
    if (name === "closed") return obj.closed;
    if (name === "name") return obj.name;
    if (name === "mode") return obj.mode;
    if (!F[name]) raise("AttributeError", "У файла нет метода «" + name + "».", line,
                        { pymsg: "'_io.TextIOWrapper' object has no attribute '" + name + "'" });
    return function(args, kw){ return F[name](args, kw); };
  }


  if (obj instanceof PyType){
    /* __name__ — короткое имя: у datetime.date это «date», как в Python */
    if (name === "__name__") return obj.shortName();
    if (name === "__doc__" && !obj.attrs.has("__doc__")) return obj.doc || null;
    var ca = obj.lookup(name);
    if (ca !== undefined) return ca;
    raise("AttributeError", "У класса «" + obj.name + "» нет «" + name + "».", line,
          { pymsg: "type object '" + obj.name + "' has no attribute '" + name + "'" });
  }

  if (obj instanceof SuperProxy){
    var sm = obj.cls.lookup(name);
    if (sm === undefined)
      raise("AttributeError", "У родительского класса нет «" + name + "».", line,
            { pymsg: "'super' object has no attribute '" + name + "'" });
    return (sm instanceof PyFunc) ? new Bound(sm, obj.self) : sm;
  }

  if (obj instanceof PyModule){
    if (obj.vars.has(name)) return obj.vars.get(name);
    if (name === "__name__") return obj.name;
    if (name === "__doc__") return obj.doc || null;
    raise("AttributeError", "В модуле «" + obj.name + "» нет «" + name + "».", line,
          { pymsg: "module '" + obj.name + "' has no attribute '" + name + "'" });
  }

  /* Метод, привязанный к объекту (к.снять), — тоже функция: у него есть
     и имя, и строка документации. Берём их у той функции, что внутри. */
  if (obj instanceof Bound){
    if (name === "__name__") return obj.fn.name;
    if (name === "__doc__") return obj.fn.doc === undefined ? null : obj.fn.doc;
    if (name === "__self__") return obj.self;
    raise("AttributeError", "У метода нет «" + name + "».", line,
          { pymsg: "'method' object has no attribute '" + name + "'" });
  }

  if (obj instanceof PyFunc){
    if (name === "__name__") return obj.name;
    if (name === "__doc__") return obj.doc === null ? null : obj.doc;
    raise("AttributeError", "У функции нет «" + name + "».", line,
          { pymsg: "'function' object has no attribute '" + name + "'" });
  }

  if (obj instanceof PyObj){
    if (name === "__doc__" && !obj.fields.has("__doc__") && obj.cls.lookup("__doc__") === undefined)
      return obj.cls.doc || null;
    var mm = moduleMethod(I, obj, name, line);
    if (mm !== undefined) return mm;
    if (obj.fields.has(name)) return obj.fields.get(name);
    var m = obj.cls.lookup(name);
    if (m !== undefined) return (m instanceof PyFunc) ? new Bound(m, obj) : m;
    if (obj.cls.isExc && name === "args") return Tup(obj.excArgs || []);
    raise("AttributeError", "У объекта класса «" + obj.cls.name + "» нет ни поля, ни метода «" + name + "».", line,
          { pymsg: "'" + obj.cls.name + "' object has no attribute '" + name + "'" });
  }

  if (typeof obj === "string"){
    var S = {
      upper: function(){ return obj.toUpperCase(); },
      lower: function(){ return obj.toLowerCase(); },
      strip: function(a){ return a && a.length ? trimChars(obj, pyStr(a[0])) : obj.trim(); },
      lstrip: function(){ return obj.replace(/^\s+/, ""); },
      rstrip: function(){ return obj.replace(/\s+$/, ""); },
      capitalize: function(){ return obj ? obj[0].toUpperCase() + obj.slice(1).toLowerCase() : obj; },
      title: function(){ return obj.replace(/\S+/g, function(w){ return w[0].toUpperCase() + w.slice(1).toLowerCase(); }); },
      /* Второй аргумент — сколько раз делить: "a=b=c".split("=", 1) даёт
         ['a', 'b=c']. Без него разбор «имя=значение» ломается на значениях,
         в которых сам знак равенства и встречается. */
      split: function(a){
        var lim = (a && a.length > 1 && a[1] !== null) ? Math.trunc(nv(a[1])) : -1;
        if (!a || !a.length || a[0] === null){
          var t = obj.trim();
          if (!t.length) return [];
          var ws = t.split(/\s+/);
          if (lim < 0 || ws.length <= lim + 1) return ws;
          var headw = ws.slice(0, lim);
          /* хвост берём из исходной строки, чтобы пробелы внутри сохранились */
          var restw = t, cut = 0;
          for (var wi = 0; wi < lim; wi++){
            var m2 = /\s+/.exec(restw.slice(cut + headw[wi].length));
            cut = cut + headw[wi].length + m2[0].length;
          }
          return headw.concat([t.slice(cut)]);
        }
        var sep = pyStr(a[0]);
        if (sep === "") raise("ValueError", "split() не умеет делить по пустой строке.", line,
                              { pymsg: "empty separator" });
        if (lim < 0) return obj.split(sep);
        var out = [], from = 0;
        while (out.length < lim){
          var at = obj.indexOf(sep, from);
          if (at < 0) break;
          out.push(obj.slice(from, at));
          from = at + sep.length;
        }
        out.push(obj.slice(from));
        return out;
      },
      /* rsplit — то же самое, но считает от конца строки */
      rsplit: function(a){
        var lim = (a && a.length > 1 && a[1] !== null) ? Math.trunc(nv(a[1])) : -1;
        if (!a || !a.length || a[0] === null){
          var t2 = obj.trim();
          if (!t2.length) return [];
          var all = t2.split(/\s+/);
          if (lim < 0 || all.length <= lim + 1) return all;
          return [all.slice(0, all.length - lim).join(" ")].concat(all.slice(all.length - lim));
        }
        var sep2 = pyStr(a[0]);
        if (sep2 === "") raise("ValueError", "rsplit() не умеет делить по пустой строке.", line,
                               { pymsg: "empty separator" });
        var parts2 = obj.split(sep2);
        if (lim < 0 || parts2.length <= lim + 1) return parts2;
        return [parts2.slice(0, parts2.length - lim).join(sep2)].concat(parts2.slice(parts2.length - lim));
      },
      join: function(a){
        var parts = I.iterate(a[0], line);
        parts.forEach(function(p){ if (typeof p !== "string") raise("TypeError", "join() склеивает только строки.", line); });
        return parts.join(obj);
      },
      replace: function(a){ return obj.split(pyStr(a[0])).join(pyStr(a[1])); },
      startswith: function(a){ return obj.indexOf(pyStr(a[0])) === 0; },
      endswith: function(a){ var s = pyStr(a[0]); return obj.slice(obj.length - s.length) === s; },
      find: function(a){ return obj.indexOf(pyStr(a[0])); },
      count: function(a){ return obj.split(pyStr(a[0])).length - 1; },
      isdigit: function(){ return obj.length > 0 && /^[0-9]+$/.test(obj); },
      /* \w в JavaScript — это только латиница, поэтому проверяем по свойствам
         символов Unicode: иначе "абв".isalpha() врёт и отвечает False. */
      isalpha: function(){ return obj.length > 0 && /^\p{L}+$/u.test(obj); },
      isalnum: function(){ return obj.length > 0 && /^[\p{L}\p{N}]+$/u.test(obj); },
      isspace: function(){ return obj.length > 0 && /^\s+$/.test(obj); },
      isupper: function(){
        return /\p{L}/u.test(obj) && obj === obj.toUpperCase() && obj !== obj.toLowerCase();
      },
      islower: function(){
        return /\p{L}/u.test(obj) && obj === obj.toLowerCase() && obj !== obj.toUpperCase();
      },
      swapcase: function(){
        return obj.replace(/\p{L}/gu, function(ch){
          return ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase();
        });
      },
      ljust: function(a){
        var w = Math.trunc(nv(a[0])), fill = a.length > 1 ? pyStr(a[1]) : " ";
        return obj.length >= w ? obj : obj + fill.repeat(w - obj.length);
      },
      rjust: function(a){
        var w = Math.trunc(nv(a[0])), fill = a.length > 1 ? pyStr(a[1]) : " ";
        return obj.length >= w ? obj : fill.repeat(w - obj.length) + obj;
      },
      center: function(a){
        var w = Math.trunc(nv(a[0])), fill = a.length > 1 ? pyStr(a[1]) : " ";
        if (obj.length >= w) return obj;
        var left = Math.floor((w - obj.length) / 2);
        return fill.repeat(left) + obj + fill.repeat(w - obj.length - left);
      },
      zfill: function(a){
        var w = Math.trunc(nv(a[0]));
        if (obj.length >= w) return obj;
        var sign = (obj[0] === "-" || obj[0] === "+") ? obj[0] : "";
        var rest = sign ? obj.slice(1) : obj;
        return sign + "0".repeat(w - obj.length) + rest;
      },
      rfind: function(a){ return obj.lastIndexOf(pyStr(a[0])); },
      index: function(a){
        var i = obj.indexOf(pyStr(a[0]));
        if (i < 0) raise("ValueError", "Подстроки " + pyRepr(a[0]) + " в строке нет.", line,
                         { pymsg: "substring not found" });
        return i;
      },
      splitlines: function(){ return obj.length ? obj.replace(/\n$/, "").split("\n") : []; },
      removeprefix: function(a){
        var pfx = pyStr(a[0]);
        return obj.indexOf(pfx) === 0 ? obj.slice(pfx.length) : obj;
      },
      removesuffix: function(a){
        var sfx = pyStr(a[0]);
        return sfx && obj.slice(obj.length - sfx.length) === sfx ? obj.slice(0, obj.length - sfx.length) : obj;
      },
      format: function(a, kw){ return formatTemplate(obj, a, kw || {}, line); }
    };
    if (!S[name]) raise("AttributeError", "У строки нет метода «" + name + "».", line,
                        { pymsg: "'str' object has no attribute '" + name + "'" });
    return function(args, kw){ return S[name](args, kw); };
  }
  if (Array.isArray(obj)){
    var A = {
      append: function(a){ if (isTup(obj)) raise("TypeError", "Кортеж нельзя менять.", line); obj.push(a[0]); return null; },
      extend: function(a){ I.iterate(a[0], line).forEach(function(x){ obj.push(x); }); return null; },
      insert: function(a){ obj.splice(Math.trunc(nv(a[0])), 0, a[1]); return null; },
      pop: function(a){
        if (!obj.length) raise("IndexError", "Список пустой — из него нечего доставать.", line,
                              { pymsg: "pop from empty list" });
        var i = a && a.length ? Math.trunc(nv(a[0])) : obj.length - 1;
        if (i < 0) i += obj.length;
        if (i < 0 || i >= obj.length) raise("IndexError", "Нет элемента с таким номером.", line,
                                           { pymsg: "pop index out of range" });
        return obj.splice(i, 1)[0];
      },
      remove: function(a){
        for (var i = 0; i < obj.length; i++) if (pyEq(obj[i], a[0])){ obj.splice(i, 1); return null; }
        raise("ValueError", "Значения " + pyRepr(a[0]) + " нет в списке.", line,
              { pymsg: "list.remove(x): x not in list" });
      },
      index: function(a){
        for (var i = 0; i < obj.length; i++) if (pyEq(obj[i], a[0])) return i;
        raise("ValueError", "Значения " + pyRepr(a[0]) + " нет в списке.", line,
              { pymsg: pyRepr(a[0]) + " is not in list" });
      },
      count: function(a){ return obj.filter(function(x){ return pyEq(x, a[0]); }).length; },
      sort: function(a, kw){ obj.sort(function(x, y){ return I.cmp(x, y, line); }); if (kw && truthy(kw.reverse)) obj.reverse(); return null; },
      reverse: function(){ obj.reverse(); return null; },
      clear: function(){ obj.length = 0; return null; },
      copy: function(){ return obj.slice(); }
    };
    if (name === "sort"){
      var sortGen = function*(args, kw){
        var sgn = (kw && truthy(kw.reverse)) ? -1 : 1;
        if (kw && kw.key){
          var keys = [];
          for (var i = 0; i < obj.length; i++) keys.push(yield* I.call(kw.key, [obj[i]], {}, line));
          var order = [];
          for (var j = 0; j < obj.length; j++) order.push(j);
          order.sort(function(x, y){ return sgn * I.cmp(keys[x], keys[y], line); });
          var copy = order.map(function(idx){ return obj[idx]; });
          for (var m = 0; m < obj.length; m++) obj[m] = copy[m];
        } else {
          obj.sort(function(x, y){ return sgn * I.cmp(x, y, line); });
        }
        return null;
      };
      sortGen.pyGen = true;
      return sortGen;
    }
    if (!A[name]) raise("AttributeError", "У списка нет метода «" + name + "».", line,
                        { pymsg: "'list' object has no attribute '" + name + "'" });
    return function(args, kw){ return A[name](args, kw); };
  }
  if (obj instanceof Map){
    var D = {
      get: function(a){ var v = dictGet(obj, a[0]); return v === undefined ? (a.length > 1 ? a[1] : null) : v; },
      keys: function(){ return dictKeys(obj); },
      values: function(){ return dictVals(obj); },
      items: function(){ return Array.from(obj.values()).map(function(p){ return Tup([p[0], p[1]]); }); },
      pop: function(a){
        if (!dictHas(obj, a[0])) raise("KeyError", "В словаре нет ключа " + pyRepr(a[0]) + ".", line);
        var v = dictGet(obj, a[0]); obj.delete(keyOf(a[0])); return v;
      },
      setdefault: function(a){
        if (!dictHas(obj, a[0])) dictSet(obj, a[0], a.length > 1 ? a[1] : null);
        return dictGet(obj, a[0]);
      },
      clear: function(){ obj.clear(); return null; },
      copy: function(){
        var c = dictNew();
        obj.forEach(function(pair){ dictSet(c, pair[0], pair[1]); });
        return c;
      },
      most_common: function(a){
        if (!obj.__counter__)
          raise("AttributeError", "most_common() есть только у Counter.", line,
                { pymsg: "'dict' object has no attribute 'most_common'" });
        var pairs = Array.from(obj.values()).map(function(pr){ return Tup([pr[0], pr[1]]); });
        var order = pairs.map(function(_, i){ return i; });
        order.sort(function(x, y){ return nv(pairs[y][1]) - nv(pairs[x][1]) || x - y; });
        var res = order.map(function(i){ return pairs[i]; });
        return a && a.length ? res.slice(0, Math.trunc(nv(a[0]))) : res;
      },
      elements: function(){
        var out = [];
        obj.forEach(function(pr){
          for (var i = 0; i < nv(pr[1]); i++) out.push(pr[0]);
        });
        return out;
      },
      update: function(a){
        if (a[0] instanceof Map){ a[0].forEach(function(pair){ dictSet(obj, pair[0], pair[1]); }); return null; }
        if (obj.__counter__){
          iterate(a[0], line).forEach(function(x){ dictSet(obj, x, (dictGet(obj, x) || 0) + 1); });
          return null;
        }
        var seq = iterate(a[0], line);
        for (var i = 0; i < seq.length; i++){
          var pr = iterate(seq[i], line);
          if (pr.length !== 2) raise("ValueError", "update() ждёт пары «ключ, значение».", line);
          dictSet(obj, pr[0], pr[1]);
        }
        return null;
      }
    };
    if (!D[name]) raise("AttributeError", "У словаря нет метода «" + name + "».", line,
                        { pymsg: "'dict' object has no attribute '" + name + "'" });
    return function(args){ return D[name](args); };
  }
  if (obj instanceof PySet){
    var other = function(a){ return a[0] instanceof PySet ? a[0] : new PySet(I.iterate(a[0], line)); };
    var SS = {
      add:      function(a){ obj.add(a[0]); return null; },
      discard:  function(a){ obj.del(a[0]); return null; },
      remove:   function(a){
        if (!obj.del(a[0])) raise("KeyError", "Значения " + pyRepr(a[0]) + " нет в множестве.", line);
        return null;
      },
      clear:    function(){ obj.m.clear(); return null; },
      copy:     function(){ return new PySet(obj.values()); },
      update:   function(a){ other(a).values().forEach(function(x){ obj.add(x); }); return null; },
      union:    function(a){
        var r = new PySet(obj.values());
        other(a).values().forEach(function(x){ r.add(x); });
        return r;
      },
      intersection: function(a){
        var o = other(a), r = new PySet();
        obj.values().forEach(function(x){ if (o.has(x)) r.add(x); });
        return r;
      },
      difference: function(a){
        var o = other(a), r = new PySet();
        obj.values().forEach(function(x){ if (!o.has(x)) r.add(x); });
        return r;
      },
      symmetric_difference: function(a){
        var o = other(a), r = new PySet();
        obj.values().forEach(function(x){ if (!o.has(x)) r.add(x); });
        o.values().forEach(function(x){ if (!obj.has(x)) r.add(x); });
        return r;
      },
      issubset:   function(a){ var o = other(a); return obj.values().every(function(x){ return o.has(x); }); },
      issuperset: function(a){ var o = other(a); return o.values().every(function(x){ return obj.has(x); }); },
      isdisjoint: function(a){ var o = other(a); return obj.values().every(function(x){ return !o.has(x); }); }
    };
    if (!SS[name]) raise("AttributeError", "У множества нет метода «" + name + "».", line,
                         { pymsg: "'set' object has no attribute '" + name + "'" });
    return function(args){ return SS[name](args); };
  }
  raise("AttributeError", "У значения типа " + typeName(obj) + " нет метода «" + name + "».", line);
};

function trimChars(s, chars){
  var a = 0, b = s.length;
  while (a < b && chars.indexOf(s[a]) >= 0) a++;
  while (b > a && chars.indexOf(s[b-1]) >= 0) b--;
  return s.slice(a, b);
}

/* Формат в f-строке: [заполнитель][< > ^][знак][0][ширина][,][.точность][тип]
   Примеры: {x:8}  {x:.2f}  {x:02d}  {x:>10}  {x:*^9}  {n:,}  {p:.1%}
   Разбираем по частям, а не одним выражением: так проще не соврать. */
function applySpec(v, spec, line){
  if (!spec) return pyStr(v);
  var rest = spec, fill = " ", align = "", sign = "", zero = false, group = false;

  if (rest.length > 1 && "<>^".indexOf(rest[1]) >= 0){ fill = rest[0]; align = rest[1]; rest = rest.slice(2); }
  else if (rest.length && "<>^".indexOf(rest[0]) >= 0){ align = rest[0]; rest = rest.slice(1); }
  if (rest.length && "+- ".indexOf(rest[0]) >= 0){ sign = rest[0]; rest = rest.slice(1); }
  if (rest[0] === "0"){ zero = true; if (!align) align = ">"; if (fill === " ") fill = "0"; rest = rest.slice(1); }

  var wm = /^(\d*)/.exec(rest);
  var width = wm[1] ? parseInt(wm[1], 10) : 0;
  rest = rest.slice(wm[1].length);
  if (rest[0] === ","){ group = true; rest = rest.slice(1); }
  var prec;
  var pm = /^\.(\d+)/.exec(rest);
  if (pm){ prec = pm[1]; rest = rest.slice(pm[0].length); }
  var kind = rest;
  if (kind.length > 1) return pyStr(v);      // непонятный формат — печатаем как есть

  var s;
  if (kind === "%"){
    s = toFixedPy(nv(v) * 100, prec === undefined ? 6 : +prec) + "%";
  } else if (kind === "f" || (prec !== undefined && kind !== "s" && isNum(v))){
    if (!isNum(v)) raise("TypeError", "Числовой формат работает только с числами, а не с " + typeName(v) + ".", line,
                         { pymsg: "Unknown format code '" + (kind || "f") + "' for object of type '" + typeName(v) + "'" });
    s = toFixedPy(nv(v), prec === undefined ? 6 : +prec);
  } else if (kind === "d"){
    if (!isNum(v)) raise("TypeError", "Формат «d» работает только с целыми числами.", line,
                         { pymsg: "Unknown format code 'd' for object of type '" + typeName(v) + "'" });
    s = String(Math.trunc(nv(v)));
  } else {
    s = pyStr(v);
    if (prec !== undefined) s = s.slice(0, +prec);
  }

  if (group && isNum(v)){
    var neg = s[0] === "-";
    var body = neg ? s.slice(1) : s;
    var dot = body.indexOf(".");
    var head = dot < 0 ? body : body.slice(0, dot);
    var tail = dot < 0 ? "" : body.slice(dot);
    head = head.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    s = (neg ? "-" : "") + head + tail;
  }
  if (sign === "+" && isNum(v) && nv(v) >= 0) s = "+" + s;
  else if (sign === " " && isNum(v) && nv(v) >= 0) s = " " + s;

  if (width > s.length){
    /* В Python выравнивание по умолчанию зависит от типа:
       числа прижимаются вправо, всё остальное — влево. */
    var side = align;
    if (!side){
      var numeric = (kind === "d" || kind === "f" || kind === "%") ? true
                  : (kind === "s") ? false : isNum(v);
      side = numeric ? ">" : "<";
    }
    var need = width - s.length;
    if (zero && isNum(v) && (s[0] === "-" || s[0] === "+"))
      s = s[0] + fill.repeat(need) + s.slice(1);      // знак остаётся впереди нулей
    else if (side === "<") s = s + fill.repeat(need);
    else if (side === "^"){
      var l = Math.floor(need / 2);
      s = fill.repeat(l) + s + fill.repeat(need - l);
    }
    else s = fill.repeat(need) + s;
  }
  return s;
}

/* ============================================================
   ЧЕРЕПАШКА
   ============================================================ */
var COLORS = {
  "red":"#ef4444","красный":"#ef4444","blue":"#3b82f6","синий":"#3b82f6",
  "green":"#22c55e","зелёный":"#22c55e","зеленый":"#22c55e","yellow":"#eab308","жёлтый":"#eab308","желтый":"#eab308",
  "orange":"#f97316","оранжевый":"#f97316","purple":"#a855f7","фиолетовый":"#a855f7",
  "pink":"#ec4899","розовый":"#ec4899","cyan":"#06b6d4","голубой":"#06b6d4",
  "white":"#ffffff","белый":"#ffffff","black":"#111827","чёрный":"#111827","черный":"#111827",
  "gray":"#9ca3af","серый":"#9ca3af","brown":"#a16207","коричневый":"#a16207"
};
function Turtle(){ this.reset(); }
Turtle.prototype.reset = function(){
  this.x = 0; this.y = 0; this.angle = 0; this.pen = true;
  this.col = "#22d3ee"; this.width = 3;
  this.segs = []; this.dots = [];
};
Turtle.prototype.setColor = function(name, line){
  var c = COLORS[String(name).toLowerCase()];
  if (!c){
    if (/^#[0-9a-fA-F]{3,6}$/.test(name)) c = name;
    else raise("ValueError", "Цвет «" + name + "» не знаю. Попробуй: red, blue, green, yellow, orange, purple, pink, cyan, white, gray.", line);
  }
  this.col = c;
};
Turtle.prototype.forward = function(d){
  var r = this.angle * Math.PI / 180;
  var nx = this.x + Math.cos(r) * d, ny = this.y + Math.sin(r) * d;
  if (this.pen) this.segs.push({ x1:this.x, y1:this.y, x2:nx, y2:ny, c:this.col, w:this.width });
  this.x = nx; this.y = ny;
  if (this.segs.length > 20000) raise("RuntimeError", "Слишком много линий — черепашка устала.", 0);
};
Turtle.prototype.turn = function(a){ this.angle = (this.angle + a) % 360; };
Turtle.prototype.goto = function(x, y){
  if (this.pen) this.segs.push({ x1:this.x, y1:this.y, x2:x, y2:y, c:this.col, w:this.width });
  this.x = x; this.y = y;
};
Turtle.prototype.dot = function(size){ this.dots.push({ x:this.x, y:this.y, r:Math.max(1, size/2), c:this.col }); };
Turtle.prototype.circle = function(r, extent){
  var steps = Math.max(8, Math.min(120, Math.abs(Math.round(extent / 5))));
  var per = extent / steps;
  var side = 2 * r * Math.sin(Math.PI * per / 360);
  for (var i = 0; i < steps; i++){ this.forward(side); this.turn(per); }
};

/* ============================================================
   ЗАПУСК
   ============================================================ */
function run(src, opts){
  opts = opts || {};
  var turtle = opts.turtle || new Turtle();
  var I = new Interp({ turtle: turtle, maxSteps: opts.maxSteps, sources: opts.sources, files: opts.files, stdin: opts.stdin, interactive: opts.interactive, seed: opts.seed });
  var PREV = CUR; CUR = I;
  var result = { output: "", lines: [], turtle: turtle, error: null, steps: 0, interp: I };
  var ast;
  try {
    ast = parse(src);
  } catch (e){
    result.error = { kind: e.pyKind || "SyntaxError", msg: e.pyMsg || e.message, line: e.pyLine || 0 };
    CUR = PREV;
    return result;
  }
  var it = I.runBlock(ast.body, I.global);
  try {
    var step = it.next();
    while (!step.done) step = it.next();
  } catch (e){
    if (!e.pyKind) throw e;
    /* программа дошла до input() без готового ответа — это не ошибка,
       а сигнал «жду ввод»: раннер добавит ответ и перезапустит */
    if (e.pyKind === "__AwaitInput__") result.awaitingInput = true;
    else result.error = { kind: e.pyKind, msg: e.pyMsg, line: e.pyLine || 0 };
  }
  result.output = I.out.join("");
  result.lines = result.output.length ? result.output.replace(/\n$/, "").split("\n") : [];
  result.steps = I.steps;
  result.files = {};
  I.disk.files.forEach(function(v, k){ result.files[k] = v; });
  CUR = PREV;
  return result;
}

/* пошаговый режим */
function stepper(src, opts){
  opts = opts || {};
  var turtle = opts.turtle || new Turtle();
  var I = new Interp({ turtle: turtle, maxSteps: opts.maxSteps, sources: opts.sources, files: opts.files, stdin: opts.stdin, interactive: opts.interactive, seed: opts.seed });
  CUR = I;
  var ast = parse(src);
  var it = I.runBlock(ast.body, I.global);
  return {
    interp: I, turtle: turtle,
    next: function(){
      try {
        CUR = I;
        var s = it.next();
        if (s.done) return { done: true, output: I.out.join("") };
        return { done: false, line: s.value.line, env: s.value.env,
                 stack: I.stack.slice(), output: I.out.join("") };
      } catch (e){
        if (!e.pyKind) throw e;
        return { done: true, output: I.out.join(""), error: { kind: e.pyKind, msg: e.pyMsg, line: e.pyLine || 0 } };
      }
    }
  };
}

function snapshotVars(env, skip){
  var seen = {}, out = [];
  var e = env;
  while (e){
    e.vars.forEach(function(v, k){
      if (seen[k]) return;
      if (typeof v === "function") return;
      if (k.indexOf("__") === 0) return;      // служебные имена вроде __name__
      if (skip && skip.indexOf(k) >= 0) return;
      seen[k] = 1;
      out.push({ name: k, value: pyRepr(v), type: typeName(v) });
    });
    e = e.parent;
  }
  return out;
}

/* ---------- снимок «кучи» для визуализатора ----------
   Возвращает неизменяемое дерево состояния для одного шага:
     vars    — [{name, cell}] видимые переменные (локальные + внешние);
     objects — {id: {kind, items|pairs}} все списки/кортежи/множества/словари.
   cell — это либо {t:"val", type, text} (скаляр или объект без раскладки),
   либо {t:"ref", id} — ссылка на объект в objects.

   Идентичность объектов держит idMap (Map: объект → id), общий на весь прогон:
   если две переменные ссылаются на ОДИН список, id совпадёт — так видно
   алиасинг (b = a) и рисуются стрелки к одной коробке. Содержимое при этом
   каждый раз сериализуется заново (копией), поэтому позднейшие изменения
   не портят уже снятые кадры.

   Четвёртый аргумент stack — стек вызовов из Interp ([{name, env}], снизу
   вверх). Если он передан, к снимку добавляется scopes: отдельный список
   переменных на КАЖДЫЙ кадр, а не одна общая свалка. Это важно именно внутри
   функции: плоский список (vars) прячет внешнюю переменную за местной с тем же
   именем, и по нему нельзя понять, что переменных две. scopes показывает обе,
   каждую в своём кадре. Куча (objects) при этом одна на весь снимок — так она
   устроена и в настоящем Python. */
function heapSnapshot(env, idMap, skip, stack){
  var objects = {};
  function cell(v){
    if (v === null || v === undefined) return { t:"val", type:"NoneType", text:"None" };
    if (v === true || v === false || isNum(v) || typeof v === "string")
      return { t:"val", type: typeName(v), text: pyRepr(v) };
    var tuple = isTup(v);
    var list = Array.isArray(v) && !tuple;
    var set = v instanceof PySet;
    var dict = v instanceof Map;
    if (list || tuple || set || dict){
      var id = idMap.get(v);
      if (id === undefined){ idMap._n = (idMap._n || 0) + 1; id = "o" + idMap._n; idMap.set(v, id); }
      if (!objects[id]){
        var node = { kind: list ? "list" : tuple ? "tuple" : set ? "set" : "dict", id: id };
        objects[id] = node;                     // ставим заранее — защита от циклов
        if (dict){
          /* словарь — это Map, где значение это пара [настоящий_ключ, значение],
             а ключ Map закодирован (keyOf). Берём настоящие ключ и значение. */
          node.pairs = [];
          v.forEach(function(pair){ node.pairs.push({ key: pyRepr(pair[0]), val: cell(pair[1]) }); });
        } else {
          var arr = set ? v.values() : v;
          node.items = arr.map(function(x){ return cell(x); });
        }
      }
      return { t:"ref", id: id };
    }
    /* классы, объекты, функции-генераторы и прочее — как значение с текстом repr */
    return { t:"val", type: typeName(v), text: pyRepr(v) };
  }
  /* какие имена показываем: не функции, не служебные, не встроенные */
  function shown(v, k){
    if (typeof v === "function" || v instanceof PyFunc) return false;   // функции — не данные
    if (k.indexOf("__") === 0) return false;                           // служебные имена
    if (skip && skip.indexOf(k) >= 0) return false;
    return true;
  }
  /* переменные ОДНОГО окружения, без родителей — это и есть кадр */
  function frameVars(e){
    var out = [];
    e.vars.forEach(function(v, k){ if (shown(v, k)) out.push({ name: k, cell: cell(v) }); });
    return out;
  }

  var seen = {}, vars = [], e = env;
  while (e){
    e.vars.forEach(function(v, k){
      if (seen[k]) return;
      if (!shown(v, k)) return;
      seen[k] = 1;
      vars.push({ name: k, cell: cell(v) });
    });
    e = e.parent;
  }

  var res = { vars: vars, objects: objects };
  if (stack){
    /* Нижний кадр — сама программа. Дальше по одному на каждый вызов.
       Порядок сохраняем как в стеке: снизу вверх, как читается «кто кого позвал». */
    res.scopes = [{ name: null, vars: frameVars(globalOf(env)) }];
    stack.forEach(function(f){ res.scopes.push({ name: f.name, vars: frameVars(f.env) }); });
  }
  return res;

  /* самое внешнее окружение цепочки — глобальное */
  function globalOf(e2){
    var g = e2;
    while (g && g.parent) g = g.parent;
    return g || e2;
  }
}

global.MiniPy = {
  run: run, stepper: stepper, parse: parse, lex: lex, PyDisk: PyDisk,
  Turtle: Turtle, pyRepr: pyRepr, pyStr: pyStr, snapshotVars: snapshotVars,
  heapSnapshot: heapSnapshot, COLORS: COLORS
};

})(typeof window !== "undefined" ? window : globalThis);
