/* ============================================================
   Мини-Python: лексер, парсер, интерпретатор (пошаговый).
   Без внешних зависимостей. Работает офлайн.
   ============================================================ */
(function(global){
"use strict";

/* ---------- ошибки ---------- */
function PyErr(kind, msg, line){
  var e = new Error(msg);
  e.pyKind = kind; e.pyMsg = msg; e.pyLine = line;
  return e;
}
function raise(kind, msg, line){ throw PyErr(kind, msg, line); }

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

/* ---------- функция пользователя ---------- */
function PyFunc(name, params, defaults, body, closure){
  this.name = name; this.params = params; this.defaults = defaults;
  this.body = body; this.closure = closure;
}

/* ============================================================
   ЛЕКСЕР
   ============================================================ */
var OPS3 = ["**=", "//=", "..."];
var OPS2 = ["**","//","==","!=","<=",">=","+=","-=","*=","/=","%=","->"];
var OPS1 = "+-*/%()[]{}:,.<>=".split("");

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
var KW_STMT = ["if","elif","else","while","for","def","return","break","continue","pass","import","from","class","try","except","finally","with","global","raise","del"];

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
        case "import": case "from":
          raise("NotSupported", "Здесь нельзя подключать модули — все нужные команды уже доступны.", tk.line);
        case "class":
          raise("NotSupported", "Классы в этом тренажёре пока не поддерживаются.", tk.line);
        case "try": case "except":
          raise("NotSupported", "try/except в этом тренажёре пока не поддерживаются.", tk.line);
      }
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
        if (!this.at("NEWLINE") && !this.at("EOF")) val = this.parseExpr();
        return { type:"Return", value: val, line: line };
      }
      if (tk.v === "break"){ this.next(); return { type:"Break", line: line }; }
      if (tk.v === "continue"){ this.next(); return { type:"Continue", line: line }; }
      if (tk.v === "pass"){ this.next(); return { type:"Pass", line: line }; }
      if (tk.v === "global"){
        this.next(); var names = [this.expectName()];
        while (this.atOp(",")){ this.next(); names.push(this.expectName()); }
        return { type:"Global", names: names, line: line };
      }
      if (tk.v === "print" && this.peek(1) && this.peek(1).t !== "OP")
        raise("SyntaxError", "В Python 3 print — это функция. Нужны скобки: print(...)", line);
    }

    var target = this.parseExprList();

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
    var params = [], defaults = [];
    while (!this.atOp(")")){
      if (this.atOp("*")){ this.next(); }
      var pn = this.expectName();
      var dflt = null;
      if (this.atOp("=")){ this.next(); dflt = this.parseExpr(); }
      params.push(pn); defaults.push(dflt);
      if (this.atOp(",")) this.next();
      else break;
    }
    this.expectOp(")", "Не закрыта скобка в объявлении функции.");
    var body = this.parseBlock("def " + name + "(...)");
    return { type:"FuncDef", name: name, params: params, defaults: defaults, body: body, line: line };
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

  parseExpr: function(){ return this.parseTernary(); },

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
  parseCompare: function(){
    var l = this.parseAdd();
    var CMP = ["==","!=","<",">","<=",">="];
    for (;;){
      var op = null;
      for (var k = 0; k < CMP.length; k++) if (this.atOp(CMP[k])){ op = CMP[k]; break; }
      if (op){ this.next(); l = { type:"Compare", op:op, left:l, right:this.parseAdd(), line:l.line }; continue; }
      if (this.atKw("in")){ this.next(); l = { type:"Compare", op:"in", left:l, right:this.parseAdd(), line:l.line }; continue; }
      if (this.atKw("not") && this.peek(1).t === "NAME" && this.peek(1).v === "in"){
        this.next(); this.next();
        l = { type:"Compare", op:"not in", left:l, right:this.parseAdd(), line:l.line }; continue;
      }
      if (this.atKw("is")){
        this.next();
        var neg = false;
        if (this.atKw("not")){ this.next(); neg = true; }
        l = { type:"Compare", op: neg ? "is not" : "is", left:l, right:this.parseAdd(), line:l.line }; continue;
      }
      return l;
    }
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
        var args = [], kwargs = {};
        while (!this.atOp(")")){
          if (this.at("NAME") && this.peek(1) && this.peek(1).t === "OP" && this.peek(1).v === "=" &&
              !(this.peek(2) && this.peek(2).t === "OP" && this.peek(2).v === "=")){
            var kn = this.next().v; this.next();
            kwargs[kn] = this.parseExpr();
          } else {
            args.push(this.parseExpr());
          }
          if (this.atOp(",")) this.next(); else break;
        }
        this.expectOp(")", "Не закрыта круглая скобка у вызова.");
        node = { type:"Call", func:node, args:args, kwargs:kwargs, line:node.line };
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
      var items = [];
      while (!this.atOp("]")){
        items.push(this.parseExpr());
        if (this.atOp(",")) this.next(); else break;
      }
      this.expectOp("]", "Не закрыта квадратная скобка у списка.");
      return { type:"List", elts:items, line:line };
    }
    if (this.atOp("{")){
      this.next();
      var keys = [], vals = [];
      while (!this.atOp("}")){
        var k = this.parseExpr();
        this.expectOp(":", "В словаре после ключа нужно двоеточие.");
        keys.push(k); vals.push(this.parseExpr());
        if (this.atOp(",")) this.next(); else break;
      }
      this.expectOp("}", "Не закрыта фигурная скобка.");
      return { type:"Dict", keys:keys, values:vals, line:line };
    }
    if (tk.t === "NEWLINE") raise("SyntaxError", "Строка обрывается — не хватает выражения.", line);
    raise("SyntaxError", "Непонятное место рядом с «" + (tk.v !== undefined ? tk.v : tk.t) + "».", line);
  }
};

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
      var spec = "";
      var ci = code.lastIndexOf(":");
      if (ci > 0 && code.indexOf("[") === -1){ spec = code.slice(ci+1); code = code.slice(0, ci); }
      parts.push({ code: code.trim(), spec: spec.trim(), line: line });
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
function pyStr(v){
  if (typeof v === "string") return v;
  return pyRepr(v);
}
function truthy(v){
  if (v === null || v === undefined || v === false) return false;
  if (v === true) return true;
  if (isNum(v)) return nv(v) !== 0;
  if (typeof v === "string") return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (v instanceof Map) return v.size > 0;
  return true;
}
function typeName(v){
  if (v === null || v === undefined) return "NoneType";
  if (v === true || v === false) return "bool";
  if (isNum(v)) return isFloat(v) ? "float" : "int";
  if (typeof v === "string") return "str";
  if (isTup(v)) return "tuple";
  if (Array.isArray(v)) return "list";
  if (v instanceof Map) return "dict";
  if (v instanceof PyFunc || typeof v === "function") return "function";
  return "object";
}
function pyEq(a, b){
  if (isNum(a) && isNum(b)) return nv(a) === nv(b);
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
  raise("TypeError", "Такое значение нельзя использовать как ключ словаря.", 0);
}

/* ============================================================
   ОКРУЖЕНИЕ
   ============================================================ */
function Env(parent){ this.vars = new Map(); this.parent = parent || null; this.globals = []; }
Env.prototype.get = function(name, line){
  var e = this;
  while (e){ if (e.vars.has(name)) return e.vars.get(name); e = e.parent; }
  raise("NameError", "Имя «" + name + "» не определено. Может быть, опечатка, или переменную ещё не создали?", line);
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
  this.global = new Env(null);
  this.installBuiltins();
}

Interp.prototype.write = function(s){
  this.out.push(s);
  if (this.out.length > 4000) raise("RuntimeError", "Слишком много вывода — похоже на бесконечный цикл.", 0);
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
    if (v instanceof Map) return v.size;
    raise("TypeError", "len() не работает с типом " + typeName(v) + ".", line);
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
  def("str", function(args){ return args.length ? pyStr(args[0]) : ""; });
  def("int", function(args, kw, line){
    var v = args[0];
    if (isNum(v)) return Math.trunc(nv(v));
    if (v === true) return 1;
    if (v === false) return 0;
    if (typeof v === "string"){
      var t = v.trim();
      if (!/^[+-]?\d+$/.test(t))
        raise("ValueError", "Строку «" + v + "» нельзя превратить в целое число.", line);
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
        raise("ValueError", "Строку «" + v + "» нельзя превратить в число.", line);
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
  def("min", function(args, kw, line){ return I.minmax(args, line, -1); });
  def("max", function(args, kw, line){ return I.minmax(args, line, 1); });
  def("abs", function(args, kw, line){
    if (!isNum(args[0])) raise("TypeError", "abs() работает только с числами.", line);
    return num(Math.abs(nv(args[0])), isFloat(args[0]));
  });
  def("round", function(args, kw, line){
    var v = nv(args[0]), d = args.length > 1 ? Math.trunc(nv(args[1])) : 0;
    var m = Math.pow(10, d);
    var r = Math.round(v * m) / m;
    return d > 0 ? mkFloat(r) : r;
  });
  def("sorted", function(args, kw, line){
    var arr = I.iterate(args[0], line).slice();
    var rev = kw && truthy(kw.reverse);
    arr.sort(function(a, b){ return I.cmp(a, b, line); });
    if (rev) arr.reverse();
    return arr;
  });
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
  def("type", function(args){ return typeName(args[0]); });
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

Interp.prototype.iterate = function(v, line){
  if (typeof v === "string") return v.split("");
  if (Array.isArray(v)) return v;
  if (v instanceof Map) return Array.from(v.values()).map(function(p){ return p[0]; });
  raise("TypeError", "По значению типа " + typeName(v) + " нельзя пройти циклом for.", line);
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
    raise("RuntimeError", "Программа выполняется слишком долго. Скорее всего, цикл никогда не заканчивается — проверь условие в while.", line);
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

    case "FuncDef":
      env.set(st.name, new PyFunc(st.name, st.params, st.defaults, st.body, env));
      return null;

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
      var args = [], kw = {};
      var fn;
      if (e.func.type === "Attribute"){
        var recv = yield* this.eval(e.func.value, env);
        fn = this.bindMethod(recv, e.func.attr, e.line);
      } else {
        fn = yield* this.eval(e.func, env);
      }
      for (var ai = 0; ai < e.args.length; ai++) args.push(yield* this.eval(e.args[ai], env));
      for (var kn in e.kwargs) kw[kn] = yield* this.eval(e.kwargs[kn], env);
      return yield* this.call(fn, args, kw, e.line, e.func.type === "Name" ? e.func.id : null);
    }
  }
  raise("RuntimeError", "Неизвестное выражение.", e.line);
};

Interp.prototype.call = function*(fn, args, kw, line, nameHint){
  if (typeof fn === "function") return fn(args, kw, line);
  if (fn instanceof PyFunc){
    var env = new Env(fn.closure);
    if (args.length > fn.params.length)
      raise("TypeError", "Функция «" + fn.name + "» ждёт " + fn.params.length + " аргумент(ов), а получила " + args.length + ".", line);
    for (var i = 0; i < fn.params.length; i++){
      var p = fn.params[i];
      if (i < args.length) env.vars.set(p, args[i]);
      else if (kw && kw[p] !== undefined) env.vars.set(p, kw[p]);
      else if (fn.defaults[i]) env.vars.set(p, yield* this.eval(fn.defaults[i], fn.closure));
      else raise("TypeError", "Функции «" + fn.name + "» не хватает аргумента «" + p + "».", line);
    }
    var r = yield* this.runBlock(fn.body, env);
    return r && r.kind === "return" ? r.value : null;
  }
  raise("TypeError", "«" + (nameHint || pyRepr(fn)) + "» — не функция, её нельзя вызвать со скобками.", line);
};

Interp.prototype.binop = function(op, a, b, line){
  if (op === "+"){
    if (isNum(a) && isNum(b)) return num(nv(a) + nv(b), isFloat(a) || isFloat(b));
    if (typeof a === "string" && typeof b === "string") return a + b;
    if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
    if (typeof a === "string" && isNum(b))
      raise("TypeError", "Нельзя сложить текст и число. Преврати число в текст: str(" + fmtNum(b) + ") — или используй f-строку.", line);
    if (isNum(a) && typeof b === "string")
      raise("TypeError", "Нельзя сложить число и текст. Преврати текст в число: int(\"" + b + "\") — если это цифры.", line);
    raise("TypeError", "Нельзя сложить " + typeName(a) + " и " + typeName(b) + ".", line);
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
  if (!isNum(a) || !isNum(b))
    raise("TypeError", "Операция «" + op + "» не работает с типами " + typeName(a) + " и " + typeName(b) + ".", line);
  var x = nv(a), y = nv(b), f = isFloat(a) || isFloat(b);
  switch (op){
    case "-": return num(x - y, f);
    case "/":
      if (y === 0) raise("ZeroDivisionError", "Делить на ноль нельзя.", line);
      return mkFloat(x / y);
    case "//":
      if (y === 0) raise("ZeroDivisionError", "Делить на ноль нельзя.", line);
      return num(Math.floor(x / y), f);
    case "%":
      if (y === 0) raise("ZeroDivisionError", "Остаток от деления на ноль не существует.", line);
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
        " элемент(ов), нумерация с 0, а ты просишь номер " + Math.trunc(nv(idx)) + ".", line);
    return obj[n];
  }
  if (obj instanceof Map){
    if (!dictHas(obj, idx)) raise("KeyError", "В словаре нет ключа " + pyRepr(idx) + ".", line);
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

/* ---------- методы ---------- */
Interp.prototype.bindMethod = function(obj, name, line){
  var I = this;
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
      isalpha: function(){ return obj.length > 0 && /^[^\W\d_]+$/u.test(obj); },
      format: function(a){ var i = 0; return obj.replace(/\{\}/g, function(){ return pyStr(a[i++]); }); }
    };
    if (!S[name]) raise("AttributeError", "У строки нет метода «" + name + "».", line);
    return function(args){ return S[name](args); };
  }
  if (Array.isArray(obj)){
    var A = {
      append: function(a){ if (isTup(obj)) raise("TypeError", "Кортеж нельзя менять.", line); obj.push(a[0]); return null; },
      extend: function(a){ I.iterate(a[0], line).forEach(function(x){ obj.push(x); }); return null; },
      insert: function(a){ obj.splice(Math.trunc(nv(a[0])), 0, a[1]); return null; },
      pop: function(a){
        if (!obj.length) raise("IndexError", "Список пустой — из него нечего доставать.", line);
        var i = a && a.length ? Math.trunc(nv(a[0])) : obj.length - 1;
        if (i < 0) i += obj.length;
        if (i < 0 || i >= obj.length) raise("IndexError", "Нет элемента с таким номером.", line);
        return obj.splice(i, 1)[0];
      },
      remove: function(a){
        for (var i = 0; i < obj.length; i++) if (pyEq(obj[i], a[0])){ obj.splice(i, 1); return null; }
        raise("ValueError", "Значения " + pyRepr(a[0]) + " нет в списке.", line);
      },
      index: function(a){
        for (var i = 0; i < obj.length; i++) if (pyEq(obj[i], a[0])) return i;
        raise("ValueError", "Значения " + pyRepr(a[0]) + " нет в списке.", line);
      },
      count: function(a){ return obj.filter(function(x){ return pyEq(x, a[0]); }).length; },
      sort: function(a, kw){ obj.sort(function(x, y){ return I.cmp(x, y, line); }); if (kw && truthy(kw.reverse)) obj.reverse(); return null; },
      reverse: function(){ obj.reverse(); return null; },
      clear: function(){ obj.length = 0; return null; },
      copy: function(){ return obj.slice(); }
    };
    if (!A[name]) raise("AttributeError", "У списка нет метода «" + name + "».", line);
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
      clear: function(){ obj.clear(); return null; }
    };
    if (!D[name]) raise("AttributeError", "У словаря нет метода «" + name + "».", line);
    return function(args){ return D[name](args); };
  }
  raise("AttributeError", "У значения типа " + typeName(obj) + " нет метода «" + name + "».", line);
};

function trimChars(s, chars){
  var a = 0, b = s.length;
  while (a < b && chars.indexOf(s[a]) >= 0) a++;
  while (b > a && chars.indexOf(s[b-1]) >= 0) b--;
  return s.slice(a, b);
}

function applySpec(v, spec, line){
  if (!spec) return pyStr(v);
  var m = /^([<>^]?)(\d*)(?:\.(\d+))?([fds%]?)$/.exec(spec);
  if (!m) return pyStr(v);
  var align = m[1], width = m[2] ? parseInt(m[2], 10) : 0, prec = m[3], kind = m[4];
  var s;
  if (kind === "%"){ s = (nv(v) * 100).toFixed(prec === undefined ? 6 : +prec) + "%"; }
  else if (kind === "f" || prec !== undefined){
    if (!isNum(v)) raise("TypeError", "Формат «." + prec + "f» работает только с числами.", line);
    s = nv(v).toFixed(prec === undefined ? 6 : +prec);
  }
  else s = pyStr(v);
  if (width > s.length){
    var pad = " ".repeat(width - s.length);
    if (align === "<") s = s + pad;
    else if (align === "^"){
      var l = Math.floor((width - s.length) / 2);
      s = " ".repeat(l) + s + " ".repeat(width - s.length - l);
    }
    else s = pad + s;
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
  var I = new Interp({ turtle: turtle, maxSteps: opts.maxSteps });
  var result = { output: "", lines: [], turtle: turtle, error: null, steps: 0, interp: I };
  var ast;
  try {
    ast = parse(src);
  } catch (e){
    result.error = { kind: e.pyKind || "SyntaxError", msg: e.pyMsg || e.message, line: e.pyLine || 0 };
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
  return result;
}

/* пошаговый режим */
function stepper(src, opts){
  opts = opts || {};
  var turtle = opts.turtle || new Turtle();
  var I = new Interp({ turtle: turtle, maxSteps: opts.maxSteps });
  var ast = parse(src);
  var it = I.runBlock(ast.body, I.global);
  return {
    interp: I, turtle: turtle,
    next: function(){
      try {
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
