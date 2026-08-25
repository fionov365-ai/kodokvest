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
  return this.module ? this.module + "." + this.name : this.name;
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

/* ---------- модуль ---------- */
function PyModule(name){ this.name = name; this.vars = new Map(); }

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
defType("IndentationError", TYPES.Exception);
defType("SyntaxError", TYPES.Exception);
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
var KW_STMT = ["if","elif","else","while","for","def","return","break","continue","pass","import","from","class","try","except","finally","with","global","raise","del","assert"];

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
    return this.parseTernary();
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
            args.push(this.parseExpr());
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
function pyRepr(v){
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (isNum(v)) return fmtNum(v);
  if (typeof v === "string") return "'" + v.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  if (v instanceof PyType) return "<class '" + v.fullName() + "'>";
  if (v instanceof PyModule) return "<module '" + v.name + "'>";
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
  if (o.cls.isExc)
    return o.cls.name + "(" + (o.excArgs || []).map(pyRepr).join(", ") + ")";
  /* Настоящий Python пишет здесь адрес в памяти — его повторить нельзя.
     Поэтому в уроках у классов всегда определяется __repr__. */
  return "<" + o.cls.fullName() + " object>";
}
function pyStr(v){
  if (typeof v === "string") return v;
  if (v instanceof PyObj){
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
  if (v instanceof PyObj) return v.cls.name;
  if (v instanceof PyType) return "type";
  if (v instanceof PyModule) return "module";
  if (v instanceof Bound) return "method";
  if (v instanceof SuperProxy) return "super";
  if (v instanceof PyFunc || typeof v === "function") return "function";
  return "object";
}
function pyEq(a, b){
  if (isNum(a) && isNum(b)) return nv(a) === nv(b);
  /* У объекта может быть свой __eq__ — тогда решает он. Так работает dataclass. */
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
  this.modules = {};     // уже подключённые модули
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
  def("bool", function(args){ return truthy(args[0]); });
  def("list", function(args, kw, line){ return args.length ? I.iterate(args[0], line).slice() : []; });
  def("tuple", function(args, kw, line){ return Tup(args.length ? I.iterate(args[0], line) : []); });
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
    var arr = I.iterate(args[0], line), st = args.length > 1 ? Math.trunc(nv(args[1])) : 0;
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
  def("input", function(args, kw, line){
    raise("NotSupported", "input() здесь не работает — в тренажёре нет клавиатурного ввода. Задай значение переменной прямо в коде.", line);
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
  EXC_NAMES.forEach(function(n){ g.set(n, TYPES[n]); });

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
    v.forEach(function(pair){ out.push(_repr(pair[0]) + ": " + _repr(pair[1])); });
    return "{" + out.join(", ") + "}";
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
      var seq = this.iterate(yield* this.eval(st.iter, env), st.line);
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
    var ast;
    try { ast = parse(src); }
    catch (e){
      raise(e.pyKind || "SyntaxError", "В модуле «" + name + ".py» ошибка: " + (e.pyMsg || e.message) +
            " (строка " + (e.pyLine || 0) + " в файле " + name + ".py)", line);
    }
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

  raise("ImportError", "Модуля «" + name + "» нет. Доступны: math, random, dataclasses" +
        (Object.keys(this.sources).length ? " и файлы этого урока" : "") + ".", line,
        { pymsg: "No module named '" + name + "'" });
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
        s += applySpec(v, p.spec, e.line);
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
      var acc = e.kind === "list" ? [] : e.kind === "set" ? new PySet() : dictNew();
      /* переменная включения живёт в своём окружении и не портит внешнюю —
         как в Python 3, где [x for x in ...] не затирает внешний x */
      yield* this.runComp(e, 0, new Env(env), acc);
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
    if (++this.depth > 220){
      this.depth--;
      raise("RecursionError", "Функция вызывает саму себя слишком глубоко — не хватает условия остановки.", line,
            { pymsg: "maximum recursion depth exceeded" });
    }
    var r;
    try { r = yield* this.runBlock(fn.body, env); }
    finally { this.depth--; }
    return r && r.kind === "return" ? r.value : null;
  }
  raise("TypeError", "«" + (nameHint || pyRepr(fn)) + "» — не функция, её нельзя вызвать со скобками.", line,
        { pymsg: "'" + typeName(fn) + "' object is not callable" });
};

Interp.prototype.binop = function(op, a, b, line){
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
    if (!dictHas(obj, idx)) raise("KeyError", "В словаре нет ключа " + pyRepr(idx) + ".", line, { pymsg: idx });
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
  }
};

/* ---------- методы ---------- */
Interp.prototype.bindMethod = function(obj, name, line){
  var I = this;

  if (obj instanceof PyType){
    if (name === "__name__") return obj.name;
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
    raise("AttributeError", "В модуле «" + obj.name + "» нет «" + name + "».", line,
          { pymsg: "module '" + obj.name + "' has no attribute '" + name + "'" });
  }

  if (obj instanceof PyObj){
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
      split: function(a){
        if (!a || !a.length) return obj.trim().length ? obj.trim().split(/\s+/) : [];
        return obj.split(pyStr(a[0]));
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
      format: function(a){ var i = 0; return obj.replace(/\{\}/g, function(){ return pyStr(a[i++]); }); }
    };
    if (!S[name]) raise("AttributeError", "У строки нет метода «" + name + "».", line,
                        { pymsg: "'str' object has no attribute '" + name + "'" });
    return function(args){ return S[name](args); };
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
      update: function(a){
        if (a[0] instanceof Map){ a[0].forEach(function(pair){ dictSet(obj, pair[0], pair[1]); }); return null; }
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
  var I = new Interp({ turtle: turtle, maxSteps: opts.maxSteps, sources: opts.sources });
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
    result.error = { kind: e.pyKind, msg: e.pyMsg, line: e.pyLine || 0 };
  }
  result.output = I.out.join("");
  result.lines = result.output.length ? result.output.replace(/\n$/, "").split("\n") : [];
  result.steps = I.steps;
  CUR = PREV;
  return result;
}

/* пошаговый режим */
function stepper(src, opts){
  opts = opts || {};
  var turtle = opts.turtle || new Turtle();
  var I = new Interp({ turtle: turtle, maxSteps: opts.maxSteps, sources: opts.sources });
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
        return { done: false, line: s.value.line, env: s.value.env, output: I.out.join("") };
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
      if (skip && skip.indexOf(k) >= 0) return;
      seen[k] = 1;
      out.push({ name: k, value: pyRepr(v), type: typeName(v) });
    });
    e = e.parent;
  }
  return out;
}

global.MiniPy = {
  run: run, stepper: stepper, parse: parse, lex: lex,
  Turtle: Turtle, pyRepr: pyRepr, pyStr: pyStr, snapshotVars: snapshotVars,
  COLORS: COLORS
};

})(typeof window !== "undefined" ? window : globalThis);
