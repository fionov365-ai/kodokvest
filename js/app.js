/* ============================================================
   Кодоквест — игровая оболочка.
   Экраны: миры → мир → урок, плюс песочница.
   Интерпретатор дёргается только через Runtime.
   ============================================================ */
(function(){
"use strict";

var app = document.getElementById("app");

var BADGES = [
  { id:"first",   em:"🚀", name:"Первый запуск",  desc:"запустил код" },
  { id:"fixer",   em:"🔧", name:"Отладчик",       desc:"исправил ошибку" },
  { id:"artist",  em:"🎨", name:"Художник",       desc:"3 рисунка" },
  { id:"sniper",  em:"🎯", name:"Снайпер",        desc:"3 урока с первой попытки" },
  { id:"ten",     em:"⚡", name:"Первый десяток", desc:"10 уроков пройдено" },
  { id:"perfect", em:"💎", name:"Перфекционист",  desc:"5 раз по три звезды" },
  { id:"explorer",em:"🧪", name:"Исследователь",  desc:"10 запусков в песочнице" },
  { id:"world1",  em:"🌱", name:"Мир пройден",    desc:"все уроки одного мира" }
];
var RANKS = [
  [0,"Новичок"], [150,"Ученик"], [400,"Кодер"], [700,"Инженер"],
  [1200,"Хакер"], [1800,"Мастер"], [2600,"Легенда"], [3600,"Гуру"]
];
var STAR_XP = [0, 25, 60, 100];

/* ================= сохранение ================= */
var KEY = "kodokvest_v2";
var S = { v:2, xp:0, stars:{}, badges:[], sandbox:null, sandboxRuns:0,
          drawDone:{}, firstTry:0, perfect:0 };
try {
  var raw = localStorage.getItem(KEY);
  if (raw) S = Object.assign(S, JSON.parse(raw));
  else {
    var old = localStorage.getItem("kodokvest_v1");
    if (old){
      var o = JSON.parse(old);
      S.xp = o.xp || 0; S.badges = o.badges || []; S.sandbox = o.sandbox || null;
      S.sandboxRuns = o.sandboxRuns || 0;
      Object.keys(o.stars || {}).forEach(function(i){
        var id = LEGACY_ORDER[+i];
        if (id) S.stars[id] = o.stars[i];
      });
    }
  }
} catch(e){}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} }

function starsOf(id){ return S.stars[id] || 0; }
function solved(id){ return S.stars[id] !== undefined; }
function totalStars(){ var n = 0; for (var k in S.stars) n += S.stars[k]; return n; }
function rankName(){
  var r = RANKS[0][1];
  for (var i = 0; i < RANKS.length; i++) if (S.xp >= RANKS[i][0]) r = RANKS[i][1];
  return r;
}
function nextRankXp(){
  for (var i = 0; i < RANKS.length; i++) if (S.xp < RANKS[i][0]) return RANKS[i][0];
  return RANKS[RANKS.length-1][0];
}
function award(id){
  if (S.badges.indexOf(id) >= 0) return;
  S.badges.push(id); save(); toast(id);
}
function toast(id){
  var b = BADGES.filter(function(x){ return x.id === id; })[0];
  if (!b) return;
  var el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = '<span class="em">' + b.em + '</span><span><b>Новый бейдж</b><span>' + b.name + '</span></span>';
  document.body.appendChild(el);
  setTimeout(function(){ el.classList.add("out"); }, 3000);
  setTimeout(function(){ el.remove(); }, 3600);
}
function refreshTop(){
  document.getElementById("rank").textContent = rankName();
  document.getElementById("xptext").textContent = S.xp + " XP";
  document.getElementById("xpfill").style.width = Math.min(100, S.xp / nextRankXp() * 100) + "%";
  var done = Object.keys(S.stars).length;
  document.getElementById("stars").textContent = "★ " + totalStars() + " · " + done + "/" + CURRICULUM.total;
}

/* ================= контент ================= */
window.CONTENT = window.CONTENT || {};
function worldContent(n){
  var key = "world" + n;
  if (CONTENT[key]) return Promise.resolve(CONTENT[key]);
  if (window.__SINGLE_FILE__) return Promise.resolve(null);
  return new Promise(function(res){
    var s = document.createElement("script");
    s.src = "content/" + key + ".js";
    s.onload = function(){ res(CONTENT[key] || null); };
    s.onerror = function(){ res(null); };
    document.head.appendChild(s);
  });
}
function lessonBody(l){
  var c = CONTENT["world" + l.world];
  return c ? c[l.id] : null;
}
function worldReadyLessons(w){
  var c = CONTENT["world" + w.n] || {};
  return w.lessons.filter(function(l){ return !!c[l.id]; });
}
function lessonOpen(l){
  var w = CURRICULUM.world(l.world);
  var ready = worldReadyLessons(w);
  var i = ready.indexOf(l);
  if (i < 0) return false;
  if (i === 0) return true;
  return solved(ready[i-1].id) || solved(l.id);
}

/* ================= подсветка ================= */
var KW = "and|or|not|in|is|if|elif|else|while|for|def|return|break|continue|pass|True|False|None|import|from|as|global|lambda|class|try|except|finally|with|yield";
var BI = "print|len|range|str|int|float|bool|list|tuple|set|dict|sum|min|max|abs|round|sorted|reversed|enumerate|zip|type|forward|back|right|left|penup|pendown|color|width|goto|home|dot|circle|speed|sqrt|randint|choice|append|pop|insert|remove|sort|reverse|split|join|upper|lower|strip|replace|startswith|endswith|count|index|keys|values|items|get";
var HLRE = new RegExp(
  "(#[^\\n]*)" +
  "|(f?\"(?:\\\\.|[^\"\\\\])*\"|f?'(?:\\\\.|[^'\\\\])*')" +
  "|(\\b\\d+\\.?\\d*\\b)" +
  "|\\b(" + KW + ")\\b" +
  "|\\b(" + BI + ")\\b", "g");
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function hl(code){
  return esc(code).replace(HLRE, function(m, c, s, n, k, b){
    if (c) return '<span class="t-c">' + c + '</span>';
    if (s) return '<span class="t-s">' + s + '</span>';
    if (n) return '<span class="t-n">' + n + '</span>';
    if (k) return '<span class="t-k">' + k + '</span>';
    if (b) return '<span class="t-f">' + b + '</span>';
    return m;
  });
}

/* ================= холст ================= */
function drawTurtle(canvas, turtle, progress){
  if (!canvas || !turtle) return;
  canvas._lastTurtle = turtle;
  var ctx = canvas.getContext && canvas.getContext("2d");
  if (!ctx) return;
  var W = canvas.clientWidth || (canvas.parentNode && canvas.parentNode.clientWidth) || 600;
  var H = Math.round(W * 0.72);
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(W*dpr)){
    canvas.width = Math.round(W*dpr); canvas.height = Math.round(H*dpr);
    canvas.style.height = H + "px";
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "#070a16"; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = "rgba(60,72,130,.28)"; ctx.lineWidth = 1;
  for (var gx = 0; gx <= W; gx += 40){ ctx.beginPath(); ctx.moveTo(gx+.5,0); ctx.lineTo(gx+.5,H); ctx.stroke(); }
  for (var gy = 0; gy <= H; gy += 40){ ctx.beginPath(); ctx.moveTo(0,gy+.5); ctx.lineTo(W,gy+.5); ctx.stroke(); }

  var segs = turtle.segs || [], dots = turtle.dots || [];
  var minX = 0, maxX = 0, minY = 0, maxY = 0;
  function acc(x,y){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
  segs.forEach(function(s){ acc(s.x1,s.y1); acc(s.x2,s.y2); });
  dots.forEach(function(d){ acc(d.x,d.y); });
  var scale = Math.min(1, Math.min(W / Math.max(80,(maxX-minX)+60), H / Math.max(80,(maxY-minY)+60)));
  var cx = W/2 - (minX+maxX)/2*scale, cy = H/2 + (minY+maxY)/2*scale;
  function px(x){ return cx + x*scale; }
  function py(y){ return cy - y*scale; }

  var upto = progress === undefined ? segs.length : Math.floor(segs.length * progress);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (var i = 0; i < upto; i++){
    var s = segs[i];
    ctx.strokeStyle = s.c; ctx.lineWidth = Math.max(1, s.w*scale);
    ctx.beginPath(); ctx.moveTo(px(s.x1),py(s.y1)); ctx.lineTo(px(s.x2),py(s.y2)); ctx.stroke();
  }
  dots.forEach(function(d){ ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(px(d.x),py(d.y),Math.max(1.5,d.r*scale),0,7); ctx.fill(); });
  var tx, ty, ta;
  if (upto > 0 && upto < segs.length){
    var last = segs[upto-1];
    tx = last.x2; ty = last.y2; ta = Math.atan2(last.y2-last.y1, last.x2-last.x1);
  } else { tx = turtle.x; ty = turtle.y; ta = (turtle.angle||0)*Math.PI/180; }
  ctx.save(); ctx.translate(px(tx),py(ty)); ctx.rotate(-ta);
  ctx.fillStyle = "#3ddc84";
  ctx.beginPath(); ctx.moveTo(9,0); ctx.lineTo(-6,6); ctx.lineTo(-3,0); ctx.lineTo(-6,-6); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function reduced(){ return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
function animateTurtle(canvas, turtle){
  if (!canvas || !turtle) return;
  if (!turtle.segs || !turtle.segs.length || reduced()){ drawTurtle(canvas, turtle); return; }
  var dur = Math.min(1100, 90 + turtle.segs.length*14), t0 = performance.now();
  if (canvas._raf) cancelAnimationFrame(canvas._raf);
  (function frame(now){
    var p = Math.min(1, (now-t0)/dur);
    drawTurtle(canvas, turtle, p);
    if (p < 1) canvas._raf = requestAnimationFrame(frame);
  })(t0);
}

/* ================= ошибки ================= */
var KIND_RU = {
  SyntaxError:"Опечатка в записи", IndentationError:"Проблема с отступами",
  NameError:"Неизвестное имя", TypeError:"Несовместимые типы",
  IndexError:"Номер за пределами", KeyError:"Нет такого ключа",
  ValueError:"Неподходящее значение", ZeroDivisionError:"Деление на ноль",
  AttributeError:"Нет такой команды", RuntimeError:"Программа не остановилась",
  NotSupported:"Здесь так нельзя"
};
function errHTML(e){
  return '<b>' + (KIND_RU[e.kind] || e.kind) + (e.line ? ' — строка ' + e.line : '') + '</b>' + esc(e.msg);
}

/* ================= редактор ================= */
function makeEditor(initial){
  var box = document.createElement("div");
  box.className = "editorbox";
  box.innerHTML =
    '<div class="ehead"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="lbl">твой код</span></div>' +
    '<div class="edit-area"><div class="gutter"></div><div class="edit-scroll">' +
      '<pre class="hl"></pre><textarea spellcheck="false" autocapitalize="off" autocorrect="off"></textarea>' +
    '</div></div><div class="runbar"></div>';
  var ta = box.querySelector("textarea"), pre = box.querySelector("pre.hl"), gut = box.querySelector(".gutter");
  ta.value = initial || "";
  function sync(){
    pre.innerHTML = hl(ta.value) + "\n";
    ta.style.height = "auto";
    ta.style.height = Math.max(190, ta.scrollHeight) + "px";
    var n = ta.value.split("\n").length, g = "";
    for (var i = 1; i <= n; i++)
      g += '<i class="' + (i === box._errLine ? "err" : (i === box._curLine ? "cur" : "")) + '">' + i + '</i>';
    gut.innerHTML = g;
  }
  ta.addEventListener("input", function(){ box._errLine = 0; box._curLine = 0; sync(); });
  ta.addEventListener("keydown", function(e){
    if (e.key === "Tab"){
      e.preventDefault();
      var s = ta.selectionStart;
      ta.value = ta.value.slice(0,s) + "    " + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + 4; sync(); return;
    }
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey){
      var pos = ta.selectionStart, before = ta.value.slice(0,pos);
      var line = before.slice(before.lastIndexOf("\n") + 1);
      var ind = (line.match(/^[ ]*/) || [""])[0];
      if (/:\s*$/.test(line)) ind += "    ";
      e.preventDefault();
      ta.value = before + "\n" + ind + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = pos + 1 + ind.length; sync(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter"){
      e.preventDefault();
      var rb = box.querySelector('[data-role="run"]'); if (rb) rb.click();
    }
  });
  box.setLine = function(n){ box._curLine = n; box._errLine = 0; sync(); };
  box.setError = function(n){ box._errLine = n; box._curLine = 0; sync(); };
  box.getCode = function(){ return ta.value; };
  box.setCode = function(v){ ta.value = v; box._errLine = 0; box._curLine = 0; sync(); };
  box.focusEditor = function(){ ta.focus(); };
  setTimeout(sync, 0);
  return box;
}

/* ================= рабочая станция ================= */
function makeStudio(cfg){
  cfg = cfg || {};
  var eng = Runtime.get(cfg.engine || "mini");
  var wrap = document.createElement("div");
  wrap.className = "studio" + (cfg.draw ? " split" : "");

  var ed = makeEditor(cfg.code || "");
  ed.querySelector(".runbar").innerHTML =
    '<button class="rbtn" data-role="run">▶ Запустить</button>' +
    (eng.supportsStep ? '<button class="rbtn sec" data-role="step">⏭ Шаг</button>' : "") +
    '<button class="rbtn sec" data-role="reset">↺ Сброс</button>' +
    (cfg.check ? '<button class="rbtn check" data-role="check">✓ Проверить</button>' : "") +
    '<span class="sp"></span><span class="tip"><span class="kbd">Ctrl</span>+<span class="kbd">Enter</span></span>';

  var side = document.createElement("div"); side.className = "side";
  var canvas = null;
  if (cfg.draw && eng.supportsTurtle){
    var cp = document.createElement("div"); cp.className = "pane";
    cp.innerHTML = '<div class="ph">холст</div><canvas class="stage"></canvas>';
    side.appendChild(cp); canvas = cp.querySelector("canvas");
  }
  var conPane = document.createElement("div"); conPane.className = "pane";
  conPane.innerHTML = '<div class="ph">вывод программы</div><div class="console"><span class="empty">пока пусто — нажми «Запустить»</span></div>';
  var varsPane = document.createElement("div"); varsPane.className = "pane"; varsPane.style.display = "none";
  varsPane.innerHTML = '<div class="ph">переменные сейчас</div><div class="pb"><div class="varlist"></div></div>';

  var left = document.createElement("div");
  left.appendChild(ed);
  var msg = document.createElement("div"); msg.className = "msg";
  left.appendChild(msg);

  if (canvas){ side.appendChild(conPane); side.appendChild(varsPane); wrap.appendChild(left); wrap.appendChild(side); }
  else { left.appendChild(conPane); left.appendChild(varsPane); wrap.appendChild(left); }

  var con = conPane.querySelector(".console");
  var stepper = null;

  function showMsg(cls, html){ msg.className = "msg show " + cls; msg.innerHTML = html; }
  function hideMsg(){ msg.className = "msg"; }
  function setConsole(text){
    con.innerHTML = text ? esc(text) : '<span class="empty">программа ничего не вывела</span>';
  }

  function doRun(){
    hideMsg(); ed.setError(0); stepper = null; varsPane.style.display = "none";
    var t = eng.newTurtle ? eng.newTurtle() : null;
    var res = eng.run(ed.getCode(), { turtle: t });
    setConsole(res.output);
    if (canvas) animateTurtle(canvas, res.turtle || t);
    if (res.error){
      ed.setError(res.error.line);
      showMsg("bad", errHTML(res.error));
      wrap._hadError = true;
    } else if (wrap._hadError){ award("fixer"); wrap._hadError = false; }
    award("first");
    if (cfg.onRun) cfg.onRun(res);
    return res;
  }

  function doStep(){
    hideMsg();
    if (!stepper){
      try {
        var t = eng.newTurtle ? eng.newTurtle() : null;
        stepper = { s: eng.stepper(ed.getCode(), { turtle: t }), t: t };
      } catch(e){
        if (!e.pyKind) throw e;
        ed.setError(e.pyLine);
        showMsg("bad", errHTML({ kind:e.pyKind, msg:e.pyMsg, line:e.pyLine }));
        stepper = null; return;
      }
      varsPane.style.display = "";
    }
    var st = stepper.s.next();
    setConsole(st.output);
    if (canvas) drawTurtle(canvas, stepper.t);
    if (st.error){ ed.setError(st.error.line); showMsg("bad", errHTML(st.error)); stepper = null; return; }
    if (st.done){
      ed.setLine(0);
      showMsg("warn", "<b>Программа закончилась</b>Нажми «Сброс», чтобы пройти шагами ещё раз.");
      stepper = null; return;
    }
    ed.setLine(st.line);
    var vars = eng.snapshotVars ? eng.snapshotVars(st.env, stepper.s.interp.builtinNames) : [];
    varsPane.querySelector(".varlist").innerHTML = vars.length
      ? vars.map(function(v){ return '<div class="varrow"><b>' + esc(v.name) + '</b><span>' + esc(v.value) + '</span><em>' + v.type + '</em></div>'; }).join("")
      : '<span class="empty">переменных пока нет</span>';
  }

  function doReset(){
    stepper = null; ed.setLine(0); hideMsg();
    varsPane.style.display = "none";
    con.innerHTML = '<span class="empty">пока пусто — нажми «Запустить»</span>';
    if (canvas && eng.newTurtle) drawTurtle(canvas, eng.newTurtle());
  }

  ed.querySelector(".runbar").addEventListener("click", function(e){
    var b = e.target.closest("button"); if (!b) return;
    var r = b.getAttribute("data-role");
    if (r === "run") doRun();
    else if (r === "step") doStep();
    else if (r === "reset") doReset();
    else if (r === "check") cfg.check(ed, showMsg, canvas);
  });

  wrap.editor = ed; wrap.showMsg = showMsg; wrap.canvas = canvas; wrap.engine = eng;
  if (canvas && eng.newTurtle) setTimeout(function(){ drawTurtle(canvas, eng.newTurtle()); }, 30);
  return wrap;
}

/* ================= проверка ================= */
function normSeg(s){
  var a = [Math.round(s.x1), Math.round(s.y1)], b = [Math.round(s.x2), Math.round(s.y2)];
  if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])){ var t = a; a = b; b = t; }
  return a[0] + "," + a[1] + "|" + b[0] + "," + b[1];
}
function sameDrawing(u, r){
  if (!u.length) return false;
  var A = u.map(normSeg).sort(), B = r.map(normSeg).sort();
  if (A.length !== B.length) return false;
  for (var i = 0; i < A.length; i++) if (A[i] !== B[i]) return false;
  return true;
}
var CUSTOM = {
  card: function(res){
    var L = res.lines;
    if (L.length < 3) return "Нужно три строки, а получилось " + L.length + ". Каждая строка — отдельная команда print.";
    if (!L[0].trim() || !L[1].trim()) return "Первые две строки не должны быть пустыми.";
    if (!/^\d+$/.test(L[2].trim())) return "Третья строка должна быть просто числом — например print(12), без кавычек. Сейчас там: «" + L[2] + "».";
    return null;
  }
};
function diffBlock(exp, got){
  var n = Math.max(exp.length, got.length), bad = -1;
  for (var i = 0; i < n; i++) if ((exp[i] || "") !== (got[i] || "")){ bad = i; break; }
  var head = bad < 0 ? "Строк должно быть " + exp.length + ", а получилось " + got.length + "."
                     : "Первое расхождение в строке " + (bad+1) + " вывода.";
  return head + '<div class="cmp"><div><u>должно быть</u>' + esc(exp.slice(0,8).join("\n") || "(пусто)") +
    (exp.length > 8 ? "\n…" : "") + '</div><div><u>получилось</u>' + esc(got.slice(0,8).join("\n") || "(пусто)") +
    (got.length > 8 ? "\n…" : "") + '</div></div>';
}

/* ================= экран: миры ================= */
function screenWorlds(){
  var doneTotal = Object.keys(S.stars).length;
  var h = '<div class="hero">' +
    '<h1>Кодоквест</h1>' +
    '<p>Настоящий Python прямо в браузере: код выполняется, рисует и объясняет ошибки понятными словами. Путь из ста уроков — от первой команды до собственного проекта.</p>' +
    '<div class="row">' +
      '<button class="bigbtn" id="go-next">' + (doneTotal ? "Продолжить" : "Начать путь") + '</button>' +
      '<button class="bigbtn ghost" id="go-sand">Свободное рисование</button>' +
    '</div></div>';

  h += '<div class="sect"><h2>Пять миров</h2><div class="line"></div><span class="cnt">' + doneTotal + ' из ' + CURRICULUM.total + '</span></div><div class="worlds">';
  CURRICULUM.forEach(function(w){
    var ready = worldReadyLessons(w);
    var done = ready.filter(function(l){ return solved(l.id); }).length;
    var pct = w.lessons.length ? Math.round(done / w.lessons.length * 100) : 0;
    var status = ready.length === 0 ? "в работе"
      : done === w.lessons.length ? "пройден"
      : done + " из " + w.lessons.length;
    h += '<button class="world' + (ready.length ? "" : " soon") + '" data-w="' + w.n + '">' +
      '<div class="wtop"><span class="wicon">' + w.icon + '</span>' +
        '<div><div class="widx">Мир ' + w.n + ' · уроки ' + ((w.n-1)*20+1) + '–' + (w.n*20) + '</div>' +
        '<h3>' + w.title + '</h3></div>' +
        '<span class="wstat">' + status + '</span></div>' +
      '<p>' + w.desc + '</p>' +
      '<div class="wbar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="wfoot"><span>' + ready.length + ' уроков готово</span>' +
        '<span class="tag' + (w.engine === "pyodide" ? " pro" : "") + '">' +
          (w.engine === "mini" ? "быстрый движок" : w.engine === "mixed" ? "смешанный" : "настоящий Python") + '</span></div>' +
      '</button>';
  });
  h += '</div>';

  h += '<div class="sect"><h2>Достижения</h2><div class="line"></div></div><div class="badges">';
  BADGES.forEach(function(b){
    h += '<div class="badge' + (S.badges.indexOf(b.id) >= 0 ? " got" : "") + '">' +
      '<span class="em">' + b.em + '</span><span><b>' + b.name + '</b><span>' + b.desc + '</span></span></div>';
  });
  h += '</div>';

  app.innerHTML = h;
  document.getElementById("go-next").onclick = function(){
    var next = null;
    CURRICULUM.forEach(function(w){
      if (next) return;
      var ready = worldReadyLessons(w);
      for (var i = 0; i < ready.length; i++) if (!solved(ready[i].id)){ next = ready[i]; return; }
    });
    if (next) openLesson(next.id); else screenWorld(1);
  };
  document.getElementById("go-sand").onclick = screenSandbox;
  app.querySelectorAll(".world").forEach(function(b){
    b.onclick = function(){ screenWorld(+b.getAttribute("data-w")); };
  });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= экран: мир ================= */
function screenWorld(n){
  var w = CURRICULUM.world(n);
  worldContent(n).then(function(){
    var ready = worldReadyLessons(w);
    var h = '<div class="lvlhead"><div><div class="idx">Мир ' + w.n + ' из 5</div>' +
      '<h1>' + w.icon + ' ' + w.title + '</h1></div></div>' +
      '<p class="lede">' + w.desc + '</p>';

    if (!ready.length)
      h += '<div class="note"><b>Этот мир ещё пишется</b>Ниже — план уроков, чтобы было видно дорогу. Уроки появятся волнами по десять.</div>';

    h += '<div class="lessons">';
    w.lessons.forEach(function(l){
      var has = !!lessonBody(l), open = has && lessonOpen(l), st = starsOf(l.id);
      var stars = "";
      for (var k = 0; k < 3; k++) stars += (k < st) ? "<b>★</b>" : "★";
      var cls = !has ? "soon" : (open ? "" : "locked");
      h += '<button class="lesson ' + cls + '" data-id="' + l.id + '"' + (open ? "" : " disabled") + '>' +
        '<span class="lnum">' + l.num + '</span>' +
        '<span class="lbody"><b>' + l.title + (l.boss ? ' <span class="bosstag">босс</span>' : '') + '</b>' +
        '<span>' + l.sub + '</span></span>' +
        '<span class="lright">' + (has ? '<span class="stars">' + stars + '</span>' : '<span class="soontag">скоро</span>') + '</span>' +
        '</button>';
    });
    h += '</div><div class="pager"><button class="bigbtn ghost" id="tomap">← Ко всем мирам</button><span class="sp"></span>' +
      (n < 5 ? '<button class="bigbtn ghost" id="wnext">Мир ' + (n+1) + ' →</button>' : '') + '</div>';

    app.innerHTML = h;
    app.querySelectorAll(".lesson").forEach(function(b){
      b.onclick = function(){ if (!b.disabled) openLesson(b.getAttribute("data-id")); };
    });
    document.getElementById("tomap").onclick = screenWorlds;
    var wn = document.getElementById("wnext");
    if (wn) wn.onclick = function(){ screenWorld(n+1); };
    refreshTop();
    window.scrollTo({ top:0, behavior:"smooth" });
  });
}

/* ================= экран: урок ================= */
var session = null;

function openLesson(id){
  var l = CURRICULUM.byId(id);
  if (!l) return screenWorlds();
  worldContent(l.world).then(function(){
    var body = lessonBody(l);
    if (!body) return screenWorld(l.world);
    session = { id:id, attempts:0, hints:0, shown:false };
    var w = CURRICULUM.world(l.world);
    var ready = worldReadyLessons(w);
    var pos = ready.indexOf(l);

    var head = '<div class="crumbs"><span data-go="worlds">Миры</span> › <span data-go="world">' + w.icon + ' ' + w.title + '</span></div>' +
      '<div class="lvlhead"><div><div class="idx">' + (l.boss ? "Босс мира " + w.n : "Урок " + l.num + " из 100") + '</div>' +
      '<h1>' + l.title + '</h1></div><div class="right">' +
      '<span class="tag">' + l.sub + '</span>' + (body.draw ? '<span class="tag draw">рисование</span>' : '') + '</div></div>' +
      '<p class="lede">' + body.lede + '</p>';

    var theory = body.theory.map(function(t, i){
      return '<div class="card theory"><h3>' + t.h + '</h3><p>' + t.p + '</p>' +
        '<div class="demo" data-demo="' + i + '"><pre><code>' + hl(t.demo) + '</code></pre>' +
        '<div class="bar"><button class="minibtn" data-run="' + i + '">▶ Запустить пример</button>' +
        '<button class="minibtn" data-copy="' + i + '">→ В редактор</button>' +
        '<span class="hintx">можно менять и запускать снова</span></div><div class="res"></div></div></div>';
    }).join("");

    var goal = '<div class="goal"><h3>🎯 Твоя задача</h3><p>' + body.task.goal + '</p><ul>' +
      body.task.list.map(function(x){ return "<li>" + x + "</li>"; }).join("") + '</ul></div>';

    var hints = '<div class="hintbox">' +
      '<button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
      '<button class="rbtn sec" id="solbtn">Показать решение</button>' +
      '<span class="tip">за подсказку теряется одна звезда</span></div><div class="hintout" id="hintout"></div>';

    var prev = pos > 0 ? ready[pos-1] : null, next = pos < ready.length-1 ? ready[pos+1] : null;
    var pager = '<div class="pager"><button class="bigbtn ghost" data-go="world">← К списку уроков</button><span class="sp"></span>' +
      (prev ? '<button class="bigbtn ghost" data-open="' + prev.id + '">Назад</button>' : '') +
      (next ? '<button class="bigbtn ghost" data-open="' + next.id + '">Дальше →</button>' : '') + '</div>';

    app.innerHTML = head + theory + goal + '<div id="studio"></div>' + hints + pager;

    var studio = makeStudio({
      engine: l.engine, draw: body.draw, code: body.task.starter,
      check: function(ed, showMsg, canvas){ runCheck(l, body, ed, showMsg, canvas); }
    });
    document.getElementById("studio").appendChild(studio);
    session.studio = studio;

    app.querySelectorAll(".demo").forEach(function(d){
      var i = +d.getAttribute("data-demo"), res = d.querySelector(".res");
      d.querySelector("[data-run]").onclick = function(){
        var eng = studio.engine;
        var t = eng.newTurtle ? eng.newTurtle() : null;
        var r = eng.run(body.theory[i].demo, { turtle:t });
        res.className = "res show";
        res.textContent = r.error
          ? ("⚠ " + (KIND_RU[r.error.kind] || r.error.kind) + (r.error.line ? " (строка " + r.error.line + ")" : "") + ": " + r.error.msg)
          : (r.output || "(эта программа ничего не печатает — смотри на холст)");
        if (studio.canvas && t && t.segs.length) animateTurtle(studio.canvas, t);
        award("first");
      };
      d.querySelector("[data-copy]").onclick = function(){
        studio.editor.setCode(body.theory[i].demo);
        studio.editor.focusEditor();
        studio.scrollIntoView({ behavior:"smooth", block:"center" });
      };
    });

    document.getElementById("hintbtn").onclick = function(){
      var hs = body.task.hints;
      if (session.hints >= hs.length) return;
      session.hints++;
      var out = document.getElementById("hintout");
      out.className = "hintout show";
      out.innerHTML = hs.slice(0, session.hints).map(function(x, i){
        return '<div class="step"><b>' + (i+1) + '.</b> ' + esc(x) + '</div>';
      }).join("");
      if (session.hints >= hs.length) this.textContent = "Подсказки кончились";
    };
    document.getElementById("solbtn").onclick = function(){
      session.shown = true;
      studio.editor.setCode(body.task.solution);
      studio.showMsg("warn", "<b>Вот рабочее решение</b>Прочитай его строчку за строчкой, запусти, а потом поменяй числа и посмотри, что изменится. За урок будет одна звезда.");
    };
    app.querySelectorAll("[data-go]").forEach(function(b){
      b.onclick = function(){
        var g = b.getAttribute("data-go");
        if (g === "worlds") screenWorlds(); else screenWorld(l.world);
      };
    });
    app.querySelectorAll("[data-open]").forEach(function(b){
      b.onclick = function(){ openLesson(b.getAttribute("data-open")); };
    });

    refreshTop();
    window.scrollTo({ top:0, behavior:"smooth" });
  });
}

function runCheck(l, body, ed, showMsg, canvas){
  session.attempts++;
  var chk = body.task.check, code = ed.getCode(), eng = Runtime.get(l.engine);

  if (chk.needCode){
    for (var i = 0; i < chk.needCode.length; i++){
      if (!new RegExp("\\b" + chk.needCode[i] + "\\b").test(code)){
        showMsg("warn", "<b>Почти</b>" + chk.needMsg);
        return;
      }
    }
  }

  var t = eng.newTurtle ? eng.newTurtle() : null;
  var res = eng.run(code, { turtle:t });
  if (canvas) animateTurtle(canvas, t);
  if (res.error){ ed.setError(res.error.line); showMsg("bad", errHTML(res.error)); return; }

  var problem = null;
  if (chk.kind === "custom"){
    problem = (CUSTOM[chk.fn] || function(){ return null; })(res);
  } else if (chk.kind === "output"){
    var exp = chk.lines || eng.run(body.task.solution, {}).lines;
    var got = res.lines;
    if (!(exp.length === got.length && exp.every(function(x, i){ return x === got[i]; })))
      problem = diffBlock(exp, got);
  } else if (chk.kind === "turtle"){
    var ref = eng.run(body.task.solution, { turtle: eng.newTurtle() }).turtle;
    if (!sameDrawing(t.segs, ref.segs)){
      problem = t.segs.length === 0
        ? "Черепашка не нарисовала ни одной линии. Проверь, что вызываешь forward(...) — и что карандаш опущен."
        : t.segs.length === ref.segs.length
          ? "Линий столько, сколько нужно (" + ref.segs.length + "), но рисунок другой. Значит, дело в длине стороны или в угле поворота."
          : "Линий должно быть " + ref.segs.length + ", а у тебя " + t.segs.length + ". Проверь, сколько раз повторяется цикл и сколько команд внутри него.";
    }
  }

  if (problem){ showMsg("bad", "<b>Ещё не то</b>" + problem); return; }
  winLesson(l, body);
}

/* ================= победа ================= */
function winLesson(l, body){
  var stars = session.shown ? 1 : (session.hints > 0 || session.attempts > 1 ? 2 : 3);
  var prev = starsOf(l.id), gained = 0;
  if (stars > prev){ gained = STAR_XP[stars] - STAR_XP[prev]; S.xp += gained; S.stars[l.id] = stars; }

  if (stars === 3 && session.attempts === 1 && !session.shown && !session.hints){
    S.firstTry = (S.firstTry || 0) + 1;
    if (S.firstTry >= 3) award("sniper");
  } else S.firstTry = 0;
  if (stars === 3){ S.perfect = (S.perfect || 0) + 1; if (S.perfect >= 5) award("perfect"); }
  if (body.draw){ S.drawDone[l.id] = 1; if (Object.keys(S.drawDone).length >= 3) award("artist"); }
  if (Object.keys(S.stars).length >= 10) award("ten");
  var w = CURRICULUM.world(l.world);
  if (worldReadyLessons(w).length === w.lessons.length &&
      w.lessons.every(function(x){ return solved(x.id); })) award("world1");
  save(); refreshTop();

  var ready = worldReadyLessons(w), pos = ready.indexOf(l);
  var next = pos < ready.length - 1 ? ready[pos+1] : null;
  var starStr = "";
  for (var k = 0; k < 3; k++) starStr += k < stars ? "<b>★</b>" : "★";

  document.getElementById("wincard").innerHTML =
    '<div class="big">' + (stars === 3 ? "🏆" : stars === 2 ? "🎉" : "✅") + '</div>' +
    '<h2>' + (stars === 3 ? "Идеально!" : "Урок пройден") + '</h2>' +
    '<div class="winstars">' + starStr + '</div>' +
    '<p>' + (stars === 3 ? "С первой попытки и без подсказок."
          : stars === 2 ? "Работает. Три звезды дают за решение с первого раза без подсказок."
          : "Решение было показано — звезда одна. Попробуй пройти урок заново сам.") + '</p>' +
    '<div class="winxp">+' + gained + ' XP</div><div class="winrow">' +
      (next ? '<button class="bigbtn" id="wnext">Дальше →</button>'
            : '<button class="bigbtn" id="wlist">К списку уроков</button>') +
      '<button class="bigbtn ghost" id="wstay">Остаться здесь</button></div>';
  document.getElementById("win").classList.add("show");
  confetti(stars);
  var wn = document.getElementById("wnext");
  if (wn) wn.onclick = function(){ closeWin(); openLesson(next.id); };
  var wl = document.getElementById("wlist");
  if (wl) wl.onclick = function(){ closeWin(); screenWorld(l.world); };
  document.getElementById("wstay").onclick = closeWin;
}
function closeWin(){ document.getElementById("win").classList.remove("show"); }

function confetti(n){
  var c = document.getElementById("confetti");
  var ctx = c.getContext && c.getContext("2d");
  if (!ctx || reduced()) return;
  c.style.display = "block";
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth*dpr; c.height = innerHeight*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  var cols = ["#7c5cff","#00e0b8","#ffc53d","#ff6b6b","#3ddc84"], ps = [];
  for (var i = 0; i < 40*n; i++)
    ps.push({ x: innerWidth/2 + (Math.random()-.5)*260, y: innerHeight/2 - 60,
      vx:(Math.random()-.5)*9, vy:-Math.random()*11-3, s:4+Math.random()*6,
      c:cols[i%cols.length], r:Math.random()*6 });
  var t0 = performance.now();
  (function frame(now){
    ctx.clearRect(0,0,innerWidth,innerHeight);
    ps.forEach(function(p){
      p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += .12;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6); ctx.restore();
    });
    if (now - t0 < 2600) requestAnimationFrame(frame);
    else { ctx.clearRect(0,0,innerWidth,innerHeight); c.style.display = "none"; }
  })(t0);
}

/* ================= песочница ================= */
var SANDBOX_START = 'color("cyan")\nwidth(3)\n\nfor i in range(36):\n    forward(120)\n    right(100)\n\nprint("Готово! Меняй числа и смотри, что будет.")\n';
function screenSandbox(){
  session = { id:null, attempts:0, hints:0, shown:false };
  var ref = ["forward(100)","back(50)","right(90)","left(90)",'color("red")',"width(5)","penup()","pendown()",
             "goto(0, 0)","dot(10)","circle(60)","print(x)","range(10)","len(s)","sum(xs)","randint(1, 6)","sqrt(16)"];
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">свободный режим</div><h1>Песочница</h1></div></div>' +
    '<p class="lede">Никаких заданий и проверок. Пиши что угодно, запускай, ломай и чини. Код сохраняется между заходами.</p>' +
    '<div class="card"><h3>Что можно позвать</h3><div class="ref">' +
      ref.map(function(x){ return "<span>" + esc(x) + "</span>"; }).join("") +
    '</div><p class="dim">Нажми на команду — она вставится в конец кода.</p></div>' +
    '<div id="studio"></div><div class="pager"><button class="bigbtn ghost" id="tomap">← Ко всем мирам</button></div>';

  var studio = makeStudio({
    engine:"mini", draw:true, code: S.sandbox || SANDBOX_START,
    onRun: function(){
      S.sandboxRuns = (S.sandboxRuns || 0) + 1;
      S.sandbox = studio.editor.getCode();
      if (S.sandboxRuns >= 10) award("explorer");
      save();
    }
  });
  document.getElementById("studio").appendChild(studio);
  app.querySelectorAll(".ref span").forEach(function(sp){
    sp.onclick = function(){
      var c = studio.editor.getCode();
      studio.editor.setCode(c + (!c || /\n$/.test(c) ? "" : "\n") + sp.textContent + "\n");
      studio.editor.focusEditor();
    };
  });
  document.getElementById("tomap").onclick = function(){ S.sandbox = studio.editor.getCode(); save(); screenWorlds(); };
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= старт ================= */
document.getElementById("btn-map").onclick = screenWorlds;
document.getElementById("logo").onclick = screenWorlds;
document.getElementById("btn-sand").onclick = screenSandbox;
document.getElementById("btn-focus").onclick = function(){
  document.body.classList.toggle("focus");
  this.classList.toggle("on");
};
document.getElementById("win").onclick = function(e){ if (e.target === this) closeWin(); };
window.addEventListener("keydown", function(e){ if (e.key === "Escape") closeWin(); });
window.addEventListener("resize", function(){
  document.querySelectorAll("canvas.stage").forEach(function(c){
    if (c._lastTurtle) drawTurtle(c, c._lastTurtle);
  });
});

worldContent(1).then(screenWorlds);

window.__game = {
  screenWorlds: screenWorlds, screenWorld: screenWorld, openLesson: openLesson,
  screenSandbox: screenSandbox, state: S, save: save, CUSTOM: CUSTOM, sameDrawing: sameDrawing
};
})();
