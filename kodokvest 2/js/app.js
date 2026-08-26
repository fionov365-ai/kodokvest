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

/* ===== код входа в панель наставника =====
   Панель открывается адресом сайта с #admin на конце, например
     https://fionov365-ai.github.io/kodokvest/#admin
   Чтобы сменить код — поменяй строку ниже и перезалей сайт.
   Честно: сайт публичный, и этот код видно в исходнике страницы.
   Это защита от случайного нажатия, а не настоящий пароль. */
var ADMIN_CODE = "kodokvest-2026";

/* ================= сохранение ================= */
var KEY = "kodokvest_v2";
var S = { v:2, xp:0, stars:{}, badges:[], sandbox:null, sandboxRuns:0,
          drawDone:{}, firstTry:0, perfect:0, log:{}, warmups:{}, admin:{ unlockAll:false } };
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
if (!S.log || typeof S.log !== "object") S.log = {};
if (!S.warmups || typeof S.warmups !== "object") S.warmups = {};
if (!S.admin || typeof S.admin !== "object") S.admin = { unlockAll:false };
function saveLocal(){
  S.savedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){}
}
function save(){ saveLocal(); schedulePush(); }

/* ===== журнал занятий: попытки, подсказки, время по каждому уроку ===== */
function logOf(id){
  if (!S.log[id]) S.log[id] = { attempts:0, hints:0, shown:0, runs:0, timeMs:0,
                                first:null, last:null, solvedAt:null, stars:0 };
  return S.log[id];
}
function touchLog(id){
  var g = logOf(id), now = Date.now();
  if (!g.first) g.first = now;
  g.last = now; save();
}
var timeTick = null;
function startTimer(id){
  stopTimer();
  timeTick = setInterval(function(){
    var g = logOf(id); g.timeMs += 10000; g.last = Date.now(); save();
  }, 10000);
}
function stopTimer(){ if (timeTick){ clearInterval(timeTick); timeTick = null; } }
/* поставить или снять звёзды вручную, честно пересчитав XP */
function setStars(id, k){
  var prev = S.stars[id] === undefined ? 0 : S.stars[id];
  if (k <= 0){ delete S.stars[id]; S.xp = Math.max(0, S.xp - STAR_XP[prev]); }
  else { S.stars[id] = k; S.xp = Math.max(0, S.xp + STAR_XP[k] - STAR_XP[prev]); }
  var g = logOf(id);
  g.stars = k > 0 ? k : 0;
  g.solvedAt = k > 0 ? (g.solvedAt || Date.now()) : null;
  save();
}

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

/* ============================================================
   СИНХРОНИЗАЦИЯ С СЕРВЕРОМ
   Прогресс не «перезаписывается», а СЛИВАЕТСЯ: по каждому уроку берётся
   лучший результат из двух копий. Так ничего не теряется, даже если
   ребёнок занимался с двух устройств по очереди.

   Почему время и попытки берутся по максимуму, а не складываются:
   после первой же синхронизации обе копии становятся одинаковыми, и
   сложение удваивало бы цифры при каждом следующем обмене.

   Поле admin (снятые замки) намеренно НЕ синхронизируется: это настройка
   конкретного устройства, а не результат ученика.
   ============================================================ */
var cloudState = { busy:false, lastSync:0, lastError:null, lastPush:0, timer:null };

function maxN(a, b){ a = a || 0; b = b || 0; return a > b ? a : b; }

function mergeProgress(a, b){
  a = a || {}; b = b || {};
  var out = { v:2, stars:{}, badges:[], log:{} };

  [a.stars || {}, b.stars || {}].forEach(function(src){
    Object.keys(src).forEach(function(k){ out.stars[k] = maxN(out.stars[k], src[k]); });
  });

  /* опыт: наибольшее из трёх — двух копий и суммы по звёздам. Так и ручная
     выдача XP в панели не пропадёт, и опыт не разойдётся со звёздами. */
  var byStars = 0;
  Object.keys(out.stars).forEach(function(k){ byStars += STAR_XP[out.stars[k]] || 0; });
  out.xp = Math.max(maxN(a.xp, b.xp), byStars);

  (a.badges || []).concat(b.badges || []).forEach(function(x){
    if (out.badges.indexOf(x) < 0) out.badges.push(x);
  });

  out.drawDone = {};
  [a.drawDone || {}, b.drawDone || {}].forEach(function(src){
    Object.keys(src).forEach(function(k){ out.drawDone[k] = 1; });
  });

  out.firstTry = maxN(a.firstTry, b.firstTry);
  out.perfect = maxN(a.perfect, b.perfect);
  out.sandboxRuns = maxN(a.sandboxRuns, b.sandboxRuns);

  /* разгаданные разминки: объединяем — разгаданное на любом устройстве
     остаётся разгаданным. Это не звёзды и не входит в сотню уроков. */
  out.warmups = {};
  [a.warmups || {}, b.warmups || {}].forEach(function(src){
    Object.keys(src).forEach(function(k){ if (src[k]) out.warmups[k] = 1; });
  });

  /* код в песочнице сложить нельзя — берём из более свежего сохранения */
  var fresher = (b.savedAt || 0) > (a.savedAt || 0) ? b : a;
  var older = fresher === b ? a : b;
  out.sandbox = fresher.sandbox || older.sandbox || null;

  var ids = {};
  Object.keys(a.log || {}).forEach(function(k){ ids[k] = 1; });
  Object.keys(b.log || {}).forEach(function(k){ ids[k] = 1; });
  Object.keys(ids).forEach(function(k){
    var x = (a.log || {})[k] || {}, y = (b.log || {})[k] || {};
    out.log[k] = {
      attempts: maxN(x.attempts, y.attempts),
      hints:    maxN(x.hints, y.hints),
      shown:    maxN(x.shown, y.shown),
      runs:     maxN(x.runs, y.runs),
      timeMs:   maxN(x.timeMs, y.timeMs),
      first:    (x.first && y.first) ? Math.min(x.first, y.first) : (x.first || y.first || null),
      last:     maxN(x.last, y.last) || null,
      solvedAt: maxN(x.solvedAt, y.solvedAt) || null,
      stars:    maxN(x.stars, y.stars)
    };
  });

  out.savedAt = maxN(a.savedAt, b.savedAt);
  return out;
}

/* то, что уходит на сервер: всё, кроме настроек устройства */
function cloudSnapshot(){
  var o = {};
  Object.keys(S).forEach(function(k){ if (k !== "admin") o[k] = S[k]; });
  return JSON.parse(JSON.stringify(o));
}

function applyProgress(data){
  var merged = mergeProgress(cloudSnapshot(), data);
  Object.keys(merged).forEach(function(k){ S[k] = merged[k]; });
  saveLocal();
}

function cloudEnabled(){
  return typeof Cloud !== "undefined" && Cloud.configured();
}

/* забрать с сервера и слить с тем, что уже есть здесь */
function cloudPull(){
  if (!cloudEnabled()) return Promise.resolve(false);
  cloudState.busy = true;
  return Cloud.load().then(function(res){
    cloudState.busy = false; cloudState.lastError = null; cloudState.lastSync = Date.now();
    if (!res.found || !res.data) return false;
    var before = JSON.stringify(cloudSnapshot());
    applyProgress(res.data);
    return JSON.stringify(cloudSnapshot()) !== before;
  }, function(err){
    cloudState.busy = false; cloudState.lastError = err.message || String(err);
    throw err;
  });
}

/* отправить на сервер */
function cloudPush(){
  if (!cloudEnabled()) return Promise.resolve(false);
  cloudState.busy = true;
  return Cloud.save(cloudSnapshot()).then(function(){
    cloudState.busy = false; cloudState.lastError = null;
    cloudState.lastSync = Date.now(); cloudState.lastPush = Date.now();
    return true;
  }, function(err){
    cloudState.busy = false; cloudState.lastError = err.message || String(err);
    throw err;
  });
}

/* Отправка не чаще раза в 25 секунд: локальное сохранение случается
   каждые 10 секунд, пока открыт урок, и гонять сеть так часто незачем. */
function schedulePush(){
  if (!cloudEnabled()) return;
  if (cloudState.timer) return;
  var wait = Math.max(2000, 25000 - (Date.now() - cloudState.lastPush));
  cloudState.timer = setTimeout(function(){
    cloudState.timer = null;
    cloudPush().catch(function(){});
  }, wait);
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
/* Подгрузить содержание всех миров. На сайте (index.html) миры грузятся
   по отдельным файлам, и без этого экран миров на первой отрисовке показывал
   миры 2–5 как «в работе», пока их контент ещё не приехал. */
function allWorldsContent(){
  return Promise.all(CURRICULUM.map(function(w){ return worldContent(w.n); }));
}
function worldReadyLessons(w){
  var c = CONTENT["world" + w.n] || {};
  return w.lessons.filter(function(l){ return !!c[l.id]; });
}
function lessonOpen(l){
  if (S.admin && S.admin.unlockAll) return !!lessonBody(l);
  var w = CURRICULUM.world(l.world);
  var ready = worldReadyLessons(w);
  var i = ready.indexOf(l);
  if (i < 0) return false;
  if (i === 0) return true;
  return solved(ready[i-1].id) || solved(l.id);
}

/* ================= подсветка ================= */
var KW = "and|or|not|in|is|if|elif|else|while|for|def|return|break|continue|pass|True|False|None|import|from|as|global|lambda|class|try|except|finally|with|yield";
var BI = "print|len|range|str|int|float|bool|list|tuple|set|dict|sum|min|max|abs|round|sorted|reversed|enumerate|zip|type|forward|back|right|left|penup|pendown|color|width|goto|home|dot|circle|speed|sqrt|randint|choice|random|shuffle|sample|append|pop|insert|remove|sort|reverse|split|join|upper|lower|strip|replace|startswith|endswith|count|index|keys|values|items|get|add|discard|update|union|intersection|difference|issubset|issuperset|isdisjoint|copy|clear|extend|setdefault|isdigit|isalpha|title|capitalize|find|key";
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
  NotSupported:"Здесь так нельзя",
  AssertionError:"Проверка не прошла", ImportError:"Не удалось подключить модуль",
  RecursionError:"Слишком глубокая рекурсия", StopIteration:"Значения закончились",
  NotImplementedError:"Ещё не написано", ArithmeticError:"Ошибка в вычислении",
  LookupError:"Ничего не найдено", Exception:"Ошибка", BaseException:"Ошибка"
};
function errHTML(e){
  return '<b>' + (KIND_RU[e.kind] || e.kind) + (e.line ? ' — строка ' + e.line : '') + '</b>' + esc(e.msg);
}

/* ================= редактор ================= */
/* files — список файлов урока: [{ name:"main.py", code:"..." }, ...].
   Настоящих файлов в браузере нет, но для ученика всё выглядит как в жизни:
   вкладки сверху, import между файлами работает. */
function makeEditor(initial, label, files){
  var box = document.createElement("div");
  var many = files && files.length > 1;
  box.className = "editorbox";
  var tabs = many
    ? '<div class="ftabs">' + files.map(function(f, i){
        return '<button class="ftab' + (i === 0 ? " on" : "") + '" data-file="' + i + '">' + esc(f.name) + '</button>';
      }).join("") + '</div>'
    : "";
  box.innerHTML =
    '<div class="ehead"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="lbl">' +
      esc(many ? files[0].name : (label || "твой код")) + '</span></div>' + tabs +
    '<div class="edit-area"><div class="gutter"></div><div class="edit-scroll">' +
      '<pre class="hl"></pre><textarea spellcheck="false" autocapitalize="off" autocorrect="off"></textarea>' +
    '</div></div><div class="runbar"></div>';
  var ta = box.querySelector("textarea"), pre = box.querySelector("pre.hl"), gut = box.querySelector(".gutter");
  var fileList = files && files.length ? files.map(function(f){ return { name:f.name, code:f.code || "" }; })
                                       : [{ name:"main.py", code: initial || "" }];
  var active = 0;
  ta.value = fileList[0].code;
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
  function stash(){ fileList[active].code = ta.value; }
  function openFile(i){
    stash();
    active = i;
    ta.value = fileList[i].code;
    box._errLine = 0; box._curLine = 0;
    box.querySelector(".lbl").textContent = fileList[i].name;
    box.querySelectorAll(".ftab").forEach(function(b, k){ b.className = "ftab" + (k === i ? " on" : ""); });
    sync();
  }
  if (many) box.querySelector(".ftabs").addEventListener("click", function(e){
    var b = e.target.closest(".ftab"); if (!b) return;
    openFile(+b.getAttribute("data-file"));
  });

  box.setLine = function(n){ box._curLine = n; box._errLine = 0; sync(); };
  box.setError = function(n){ box._errLine = n; box._curLine = 0; sync(); };
  box.getCode = function(){ stash(); return fileList[0].code; };
  box.setCode = function(v){ ta.value = v; fileList[active].code = v; box._errLine = 0; box._curLine = 0; sync(); };
  /* Все файлы, кроме главного: именно они уходят в движок как модули. */
  box.getSources = function(){
    stash();
    var out = {};
    for (var i = 1; i < fileList.length; i++) out[fileList[i].name] = fileList[i].code;
    return out;
  };
  box.getFiles = function(){ stash(); return fileList.map(function(f){ return { name:f.name, code:f.code }; }); };
  box.setFiles = function(list){
    for (var i = 0; i < fileList.length && i < list.length; i++) fileList[i].code = list[i].code;
    ta.value = fileList[active].code;
    box._errLine = 0; box._curLine = 0; sync();
  };
  box.fileCount = fileList.length;
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

  var ed = makeEditor(cfg.code || "", cfg.label, cfg.files);
  ed.querySelector(".runbar").innerHTML =
    '<button class="rbtn" data-role="run">' + (cfg.play ? "▶ Новая игра" : "▶ Запустить") + '</button>' +
    (eng.supportsStep && !cfg.play ? '<button class="rbtn sec" data-role="step">⏭ Шаг</button>' : "") +
    '<button class="rbtn sec" data-role="reset">↺ Сброс</button>' +
    (cfg.restore ? '<button class="rbtn sec" data-role="restore">↩ Вернуть как было</button>' : "") +
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
  /* Урокам про файлы нужно видеть, что лежит «на диске» до и после запуска. */
  var hasData = cfg.data && Object.keys(cfg.data).length;
  var diskPane = document.createElement("div"); diskPane.className = "pane";
  diskPane.style.display = hasData ? "" : "none";
  diskPane.innerHTML = '<div class="ph">файлы на диске</div><div class="pb"><div class="disklist"></div></div>';

  /* Клавиатуры у программы в тренажёре нет, поэтому ответы на input()
     записаны заранее — по одному в строке. Их можно менять и запускать снова:
     для кода это неотличимо от живого человека за клавиатурой. */
  var hasStdin = !!(cfg.stdin && cfg.stdin.length);
  var stdinPane = document.createElement("div"); stdinPane.className = "pane";
  stdinPane.style.display = hasStdin ? "" : "none";
  stdinPane.innerHTML = '<div class="ph">ответы для input()</div><div class="pb">' +
    '<textarea class="stdinbox" spellcheck="false" rows="6"></textarea>' +
    '<div class="stdinhint">По одному ответу в строке. Меняй и запускай снова — программа прочитает их сверху вниз.</div></div>';
  var stdinBox = stdinPane.querySelector(".stdinbox");
  stdinBox.value = hasStdin ? cfg.stdin.join("\n") : "";

  var left = document.createElement("div");
  left.appendChild(ed);
  var msg = document.createElement("div"); msg.className = "msg";
  left.appendChild(msg);

  /* Игровое поле ввода: появляется, когда игра ждёт хода игрока.
     Игры устроены на перезапуске (replay) — движок гоняет программу заново
     с накопленными ходами и фиксированным seed, поэтому «замысел» не плывёт. */
  var playPane = null, playInput = null;
  if (cfg.play){
    playPane = document.createElement("div"); playPane.className = "playbar";
    playPane.style.display = "none";
    playPane.innerHTML =
      '<span class="playq"></span>' +
      '<input class="playin" type="text" autocomplete="off" spellcheck="false" placeholder="твой ход и Enter">' +
      '<button class="rbtn play" data-role="move">Ход ↵</button>';
    playInput = playPane.querySelector(".playin");
  }

  if (canvas){ side.appendChild(conPane); if (playPane) side.appendChild(playPane); side.appendChild(varsPane); side.appendChild(stdinPane); side.appendChild(diskPane); wrap.appendChild(left); wrap.appendChild(side); }
  else { left.appendChild(conPane); if (playPane) left.appendChild(playPane); left.appendChild(varsPane); left.appendChild(stdinPane); left.appendChild(diskPane); wrap.appendChild(left); }

  /* Что сейчас в панели ответов. Пустой хвост убираем: перевод строки в конце
     текста — это не лишний пустой ответ, ровно как при вводе с клавиатуры. */
  wrap.getStdin = function(){
    if (!hasStdin) return [];
    var a = stdinBox.value.split("\n");
    while (a.length && a[a.length - 1] === "") a.pop();
    return a;
  };

  var con = conPane.querySelector(".console");
  var stepper = null;

  function showDisk(files){
    if (!files || !Object.keys(files).length){
      if (!hasData) return;
      files = dataFiles(cfg.data);
    }
    diskPane.style.display = "";
    var names = Object.keys(files).sort();
    diskPane.querySelector(".disklist").innerHTML = names.map(function(n){
      var text = files[n];
      var short = text.length > 400 ? text.slice(0, 400) + "\n…" : text;
      return '<div class="diskfile"><b>' + esc(n) + '</b><span>' +
             (text.length ? text.split("\n").length + " строк, " + text.length + " знаков" : "пусто") +
             '</span><pre>' + esc(short) + '</pre></div>';
    }).join("");
  }
  function showMsg(cls, html){ msg.className = "msg show " + cls; msg.innerHTML = html; }
  function hideMsg(){ msg.className = "msg"; }
  function setConsole(text){
    con.innerHTML = text ? esc(text) : '<span class="empty">программа ничего не вывела</span>';
  }

  function doRun(){
    hideMsg(); ed.setError(0); stepper = null; varsPane.style.display = "none";
    var t = eng.newTurtle ? eng.newTurtle() : null;
    var res = eng.run(ed.getCode(), { turtle: t, sources: ed.getSources(), files: dataFiles(cfg.data), stdin: wrap.getStdin() });
    setConsole(res.output);
    if (res.files) showDisk(res.files);
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
        stepper = { s: eng.stepper(ed.getCode(), { turtle: t, sources: ed.getSources(), files: dataFiles(cfg.data), stdin: wrap.getStdin() }), t: t };
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
    if (playPane) playPane.style.display = "none";
    con.innerHTML = '<span class="empty">пока пусто — нажми «Запустить»</span>';
    if (canvas && eng.newTurtle) drawTurtle(canvas, eng.newTurtle());
  }

  /* ===== игровой режим: партия через перезапуск с накопленными ходами ===== */
  var playAnswers = [], playSeed = 0;

  function playRender(){
    hideMsg(); ed.setError(0);
    var t = eng.newTurtle ? eng.newTurtle() : null;
    var res = eng.run(ed.getCode(), { turtle: t, sources: ed.getSources(),
      files: dataFiles(cfg.data), stdin: playAnswers, interactive: true, seed: playSeed });
    setConsole(res.output);
    if (res.files) showDisk(res.files);
    if (canvas) animateTurtle(canvas, res.turtle || t);
    award("first");
    if (res.error){
      ed.setError(res.error.line);
      showMsg("bad", errHTML(res.error));
      playPane.style.display = "none";
      return;
    }
    if (res.awaitingInput){
      /* последняя строка вывода — это приглашение input(); показываем его у поля */
      var lines = res.output.split("\n");
      var q = lines[lines.length - 1] || "твой ход:";
      playPane.querySelector(".playq").textContent = q;
      playPane.style.display = "";
      playInput.value = "";
      setTimeout(function(){ playInput.focus(); }, 0);
    } else {
      playPane.style.display = "none";
      showMsg("ok", "<b>Игра окончена</b>Нажми «Новая игра», чтобы сыграть ещё раз, или поменяй код — и играй свою версию.");
    }
    if (cfg.onRun) cfg.onRun(res);
  }
  function playStart(){
    playAnswers = [];
    playSeed = Math.floor(Math.random() * 2000000000) + 1;
    con.innerHTML = "";
    playRender();
  }
  function playMove(){
    if (!playPane || playPane.style.display === "none") return;
    playAnswers.push(playInput.value);
    playRender();
  }
  if (playPane){
    playPane.querySelector('[data-role="move"]').onclick = playMove;
    playInput.addEventListener("keydown", function(e){
      if (e.key === "Enter"){ e.preventDefault(); playMove(); }
    });
  }

  ed.querySelector(".runbar").addEventListener("click", function(e){
    var b = e.target.closest("button"); if (!b) return;
    var r = b.getAttribute("data-role");
    if (r === "run") cfg.play ? playStart() : doRun();
    else if (r === "move") playMove();
    else if (r === "step") doStep();
    else if (r === "reset") doReset();
    else if (r === "restore"){
      if (cfg.restoreFiles) ed.setFiles(cfg.restoreFiles); else ed.setCode(cfg.restore);
      doReset();
    }
    else if (r === "check") cfg.check(ed, showMsg, canvas);
  });

  if (hasData) showDisk(null);
  wrap.editor = ed; wrap.showMsg = showMsg; wrap.canvas = canvas; wrap.engine = eng;
  if (canvas && eng.newTurtle) setTimeout(function(){ drawTurtle(canvas, eng.newTurtle()); }, 30);
  return wrap;
}

/* ================= проверка ================= */
function normSeg(s, pen){
  var a = [Math.round(s.x1), Math.round(s.y1)], b = [Math.round(s.x2), Math.round(s.y2)];
  if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])){ var t = a; a = b; b = t; }
  var key = a[0] + "," + a[1] + "|" + b[0] + "," + b[1];
  return pen ? key + "|" + s.c + "|" + Math.round(s.w) : key;
}
function sameDrawing(u, r, pen){
  if (!u.length) return false;
  var A = u.map(function(s){ return normSeg(s, pen); }).sort();
  var B = r.map(function(s){ return normSeg(s, pen); }).sort();
  if (A.length !== B.length) return false;
  for (var i = 0; i < A.length; i++) if (A[i] !== B[i]) return false;
  return true;
}

/* ===== задание «найди ошибку»: считаем, сколько строк тронул ученик =====
   Смысл задания — найти одну поломку, а не написать программу заново.
   Пустые строки и комментарии не считаем: их правка ничего не меняет.
   Единица измерения — «строка»: одна переписанная строка это 2 единицы
   (одну убрали, другую добавили). */
function codeLines(src){
  return String(src === null || src === undefined ? "" : src).split("\n")
    .map(function(s){ return s.replace(/\s+$/, ""); })
    .filter(function(s){ var t = s.trim(); return t !== "" && t.charAt(0) !== "#"; });
}
function lcsLen(A, B){
  var prev = [], cur, i, j;
  for (j = 0; j <= B.length; j++) prev[j] = 0;
  for (i = 1; i <= A.length; i++){
    cur = [0];
    for (j = 1; j <= B.length; j++)
      cur[j] = A[i-1] === B[j-1] ? prev[j-1] + 1 : Math.max(prev[j], cur[j-1]);
    prev = cur;
  }
  return prev[B.length];
}
function editUnits(a, b){
  var A = codeLines(a), B = codeLines(b);
  return A.length + B.length - 2 * lcsLen(A, B);
}
var CUSTOM = {
  /* Задания со случайностью нельзя проверять сравнением вывода — числа каждый раз
     другие. Поэтому проверяем форму: строки нужного вида и сходящиеся итоги. */
  dice: function(res){
    var L = res.lines, sum = 0;
    if (L.length !== 11)
      return "Нужно 11 строк: десять бросков и итог. Сейчас их " + L.length + ".";
    for (var i = 0; i < 10; i++){
      var m = /^Бросок (\d+): (\d+)$/.exec(L[i]);
      if (!m) return "Строка " + (i+1) + " должна выглядеть так: «Бросок 1: 4». Сейчас там «" + L[i] + "».";
      if (+m[1] !== i + 1) return "В строке " + (i+1) + " номер броска " + m[1] + ", а ожидался " + (i+1) + ". Проверь range.";
      var v = +m[2];
      if (v < 1 || v > 6) return "Кубик выдал " + v + ", а у кубика бывает только от 1 до 6. Проверь randint(1, 6).";
      sum += v;
    }
    var t = /^Всего: (\d+)$/.exec(L[10]);
    if (!t) return "Последняя строка должна быть «Всего: N». Сейчас там «" + L[10] + "».";
    if (+t[1] !== sum)
      return "Сумма не сходится: броски в строках дают " + sum + ", а написано " + t[1] +
             ". Скорее всего, randint вызывается дважды — и в строку попадает одно число, а в сумму другое.";
    return null;
  },
  password: function(res){
    var L = res.lines;
    if (L.length !== 3)
      return "Нужно ровно три строки: сам пароль, длина, число цифр. Сейчас их " + L.length + ".";
    var pw = L[0];
    if (pw.length !== 10) return "Пароль должен быть из 10 знаков, а в нём " + pw.length + ".";
    if (!/^[a-zA-Z0-9]+$/.test(pw))
      return "В пароле должны быть только латинские буквы и цифры из заданного алфавита. Сейчас: «" + pw + "».";
    var digits = (pw.match(/[0-9]/g) || []).length;
    var m1 = /^Длина: (\d+)$/.exec(L[1]);
    if (!m1) return "Вторая строка должна быть «Длина: 10». Сейчас «" + L[1] + "».";
    if (+m1[1] !== pw.length)
      return "Во второй строке написано " + m1[1] + ", а в пароле " + pw.length + " знаков. Считай длину через len(pw).";
    var m2 = /^Цифр: (\d+)$/.exec(L[2]);
    if (!m2) return "Третья строка должна быть «Цифр: N». Сейчас «" + L[2] + "».";
    if (+m2[1] !== digits)
      return "Цифр в пароле " + digits + ", а написано " + m2[1] + ". Считай их по самому паролю, а не заранее.";
    return null;
  },
  /* Урок про PEP 8 нельзя проверить по выводу: вывод и так правильный.
     Поэтому смотрим на сам код — но только то, что можно проверить надёжно. */
  pep8style: function(res, code){
    /* сначала вывод должен остаться прежним, потом смотрим на стиль */
    var want = ["360", "аня: 18/100"];
    if (res.lines.length !== want.length || res.lines[0] !== want[0] || res.lines[1] !== want[1])
      return diffBlock(want, res.lines);
    /* camelCase ищем только у имён с маленькой буквы: HeroCard — это класс, так и надо */
    if (/\b[a-z][A-Za-z0-9_]*[A-Z]/.test(String(code).replace(/#.*$/gm, "")))
      return "В коде остались имена вида calcTotal или heroCard — по PEP 8 их пишут через подчёркивание, а класс с большой буквы.";
    if (String(code).indexOf("MAX_HP") < 0)
      return "Число 100 встречается дважды — по условию его надо вынести в постоянную MAX_HP.";
    return CUSTOM.pep8(res, code);
  },
  pep8: function(res, code){
    var lines = String(code || "").split("\n");
    var inString = /(['"]).*\1/;
    for (var i = 0; i < lines.length; i++){
      var raw = lines[i];
      var line = raw.replace(/#.*$/, "");
      if (inString.test(line)) line = line.replace(/(['"]).*?\1/g, "STR");
      var no = i + 1;
      if (/,\S/.test(line))
        return "Строка " + no + ": после запятой нужен пробел.<div class=\"cmp\"><div><u>строка " + no + "</u>" + esc(raw.trim()) + "</div></div>";
      if (/[A-Za-zА-Яа-я0-9_)\]]\s*(\*|\+|-|\/)\s*[A-Za-zА-Яа-я0-9_(\[]/.test(line)){
        var m = /([A-Za-zА-Яа-я0-9_)\]])(\*|\+|-|\/)([A-Za-zА-Яа-я0-9_(\[])/.exec(line);
        if (m)
          return "Строка " + no + ": вокруг знака «" + m[2] + "» нужны пробелы.<div class=\"cmp\"><div><u>строка " + no + "</u>" + esc(raw.trim()) + "</div></div>";
      }
      if (/^\s*(def|class)\s/.test(raw) && /=[^\s=]/.test(line) === false && /\S=\S/.test(line.replace(/\(.*\)/, "")))
        return "Строка " + no + ": вокруг «=» нужны пробелы (кроме значений по умолчанию в скобках).";
      if (/[^\s,(=]=[^\s=]/.test(line) && !/^\s*(def|class)\s/.test(raw) && line.indexOf("(") < 0)
        return "Строка " + no + ": вокруг «=» нужны пробелы.<div class=\"cmp\"><div><u>строка " + no + "</u>" + esc(raw.trim()) + "</div></div>";
      if (raw.length > 79)
        return "Строка " + no + " длиннее 79 знаков — PEP 8 просит короче.";
      var indent = (raw.match(/^ */) || [""])[0].length;
      if (raw.trim() && indent % 4 !== 0)
        return "Строка " + no + ": отступ " + indent + " пробелов, а PEP 8 требует кратный четырём.";
    }
    return null;
  },
  card: function(res){
    var L = res.lines;
    if (L.length < 3) return "Нужно три строки, а получилось " + L.length + ". Каждая строка — отдельная команда print.";
    if (!L[0].trim() || !L[1].trim()) return "Первые две строки не должны быть пустыми.";
    if (!/^\d+$/.test(L[2].trim())) return "Третья строка должна быть просто числом — например print(12), без кавычек. Сейчас там: «" + L[2] + "».";
    return null;
  }
};
/* Файлы с данными: у каждого запуска своя копия, чтобы прошлый запуск
   не влиял на следующий. Ученик их видит в панели «файлы на диске». */
function dataFiles(src){
  var out = {};
  if (src) for (var k in src) out[k] = src[k];
  return out;
}

/* Файлы урока для эталонного решения: {"tools.py": "…"} */
function solutionSources(body){
  var out = {};
  (body.task.files || []).forEach(function(f){ out[f.name] = f.solution !== undefined ? f.solution : f.starter; });
  return out;
}

/* ===== проверка скрытыми тестами =====
   Ученик пишет функции по описанию и не видит проверок — как на работе.
   Каждый вызов из chk.calls дописывается к его коду отдельной программой,
   результат сравнивается с тем же вызовом на эталонном решении. */
/* Есть ли в коде такой кусок. Спецсимволы экранируем — иначе «max(» рушит
   регулярное выражение, а «\b» приклеиваем только к латинским краям: в
   JavaScript \w — это латиница, и после русской буквы граница слова не ловится. */
function codeHas(code, needle){
  var esc = String(needle).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var pre = /^[A-Za-z0-9_]/.test(needle) ? "\\b" : "";
  var post = /[A-Za-z0-9_]$/.test(needle) ? "\\b" : "";
  return new RegExp(pre + esc + post).test(code);
}

function runHiddenTests(eng, calls, code, srcs, solution, refSrcs, data, stdin){
  for (var i = 0; i < calls.length; i++){
    var call = calls[i];
    var probe = "\nprint(repr(" + call + "))\n";
    var want = eng.run(solution + probe, { sources: refSrcs, files: data, stdin: stdin || [] });
    var got = eng.run(code + probe, { sources: srcs, files: data, stdin: stdin || [] });
    if (got.error)
      return "Проверка вызвала <code>" + esc(call) + "</code> — и программа упала: " +
             (KIND_RU[got.error.kind] || got.error.kind) + ", " + esc(got.error.msg);
    var w = want.lines[want.lines.length - 1], g = got.lines[got.lines.length - 1];
    if (w !== g)
      return "Проверка вызвала <code>" + esc(call) + "</code>." +
             '<div class="cmp"><div><u>должно вернуть</u>' + esc(String(w)) +
             '</div><div><u>вернулось</u>' + esc(String(g === undefined ? "(ничего)" : g)) + '</div></div>' +
             "Всего скрытых проверок: " + calls.length + ". Эта — номер " + (i + 1) + ".";
  }
  return null;
}

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
  stopTimer(); clearAdminHash();
  /* Страховка: если содержание каких-то миров ещё не подгрузилось (это бывает
     только на сайте с раздельными файлами), догружаем всё и перерисовываем —
     иначе готовые миры показались бы как «в работе». */
  if (!window.__SINGLE_FILE__ && CURRICULUM.some(function(w){ return !CONTENT["world" + w.n]; })){
    allWorldsContent().then(function(){
      if (document.querySelector(".worlds")) screenWorlds();
    });
  }
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
  stopTimer(); clearAdminHash();
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
    touchLog(id); startTimer(id);
    var w = CURRICULUM.world(l.world);
    var ready = worldReadyLessons(w);
    var pos = ready.indexOf(l);

    var head = '<div class="crumbs"><span data-go="worlds">Миры</span> › <span data-go="world">' + w.icon + ' ' + w.title + '</span></div>' +
      '<div class="lvlhead"><div><div class="idx">' + (l.boss ? "Босс мира " + w.n : "Урок " + l.num + " из 100") + '</div>' +
      '<h1>' + l.title + '</h1></div><div class="right">' +
      '<span class="tag">' + l.sub + '</span>' + (body.draw ? '<span class="tag draw">рисование</span>' : '') + '</div></div>' +
      '<p class="lede">' + body.lede + '</p>';

    var theory = body.theory.map(function(t, i){
      /* t.show — код, который в тренажёре не запускается: настоящий Flask,
         команды терминала, чужие библиотеки. Показываем как есть и честно
         пишем, где он работает. t.demo при этом может и быть, и не быть. */
      var shown = t.show
        ? '<div class="showcode"><pre><code>' + hl(t.show) + '</code></pre>' +
          '<span class="shownote">' + (t.showNote || "этот код работает на настоящем компьютере, а не в тренажёре") + '</span></div>'
        : "";
      var demo = t.demo
        ? '<div class="demo" data-demo="' + i + '"><pre><code>' + hl(t.demo) + '</code></pre>' +
          '<div class="bar"><button class="minibtn" data-run="' + i + '">▶ Запустить пример</button>' +
          '<button class="minibtn" data-copy="' + i + '">→ В редактор</button>' +
          '<span class="hintx' + (t.err ? " errx" : "") + '">' +
          (t.err ? "этот пример падает с ошибкой — так и задумано" : "можно менять и запускать снова") +
          '</span></div><div class="res"></div></div>'
        : "";
      return '<div class="card theory"><h3>' + t.h + '</h3><p>' + t.p + '</p>' + shown + demo + '</div>';
    }).join("");

    var isFix = body.task.type === "fix";
    var goal = '<div class="goal"><h3>' + (isFix ? "🔧 Задача: починить" : "🎯 Твоя задача") + '</h3><p>' +
      body.task.goal + '</p><ul>' +
      body.task.list.map(function(x){ return "<li>" + x + "</li>"; }).join("") + '</ul></div>';
    var bug = isFix
      ? '<div class="bugcard"><h3>🐞 Что сейчас не так</h3><p>' + body.task.symptom + '</p>' +
        '<span class="bugtip">Код ниже нужно починить, а не заменить своим. Если запутался, ' +
        'кнопка «↩ Вернуть как было» вернёт исходный сломанный вариант.</span></div>'
      : "";

    var hints = '<div class="hintbox">' +
      '<button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
      '<button class="rbtn sec" id="solbtn">Показать решение</button>' +
      '<span class="tip">за подсказку теряется одна звезда</span></div><div class="hintout" id="hintout"></div>';

    var prev = pos > 0 ? ready[pos-1] : null, next = pos < ready.length-1 ? ready[pos+1] : null;
    var pager = '<div class="pager"><button class="bigbtn ghost" data-go="world">← К списку уроков</button><span class="sp"></span>' +
      (prev ? '<button class="bigbtn ghost" data-open="' + prev.id + '">Назад</button>' : '') +
      (next ? '<button class="bigbtn ghost" data-open="' + next.id + '">Дальше →</button>' : '') + '</div>';

    app.innerHTML = head + theory + goal + bug + '<div id="studio"></div>' + hints + pager;

    /* Задание может состоять из нескольких файлов: главный плюс модули. */
    var taskFiles = body.task.files
      ? [{ name: body.task.mainName || "main.py", code: body.task.starter }].concat(
          body.task.files.map(function(f){ return { name:f.name, code:f.starter }; }))
      : null;
    var solutionFiles = body.task.files
      ? [{ name: body.task.mainName || "main.py", code: body.task.solution }].concat(
          body.task.files.map(function(f){ return { name:f.name, code: f.solution !== undefined ? f.solution : f.starter }; }))
      : null;

    var studio = makeStudio({
      engine: l.engine, draw: body.draw, code: body.task.starter, data: body.task.data,
      stdin: body.task.stdin,
      label: isFix ? "сломанный код — почини его" : "твой код",
      files: taskFiles,
      restore: isFix ? body.task.starter : null,
      restoreFiles: isFix ? taskFiles : null,
      onRun: function(){ logOf(l.id).runs++; save(); },
      check: function(ed, showMsg, canvas){ runCheck(l, body, ed, showMsg, canvas); }
    });
    document.getElementById("studio").appendChild(studio);
    session.studio = studio;

    app.querySelectorAll(".demo[data-demo]").forEach(function(d){
      var i = +d.getAttribute("data-demo"), res = d.querySelector(".res");
      d.querySelector("[data-run]").onclick = function(){
        var eng = studio.engine;
        var t = eng.newTurtle ? eng.newTurtle() : null;
        var r = eng.run(body.theory[i].demo, { turtle:t, sources: body.theory[i].files || {}, files: dataFiles(body.theory[i].data), stdin: body.theory[i].stdin || [] });
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
      logOf(l.id).hints++; save();
      var out = document.getElementById("hintout");
      out.className = "hintout show";
      out.innerHTML = hs.slice(0, session.hints).map(function(x, i){
        return '<div class="step"><b>' + (i+1) + '.</b> ' + esc(x) + '</div>';
      }).join("");
      if (session.hints >= hs.length) this.textContent = "Подсказки кончились";
    };
    document.getElementById("solbtn").onclick = function(){
      session.shown = true;
      logOf(l.id).shown++; save();
      if (solutionFiles && studio.editor.setFiles) studio.editor.setFiles(solutionFiles);
      else studio.editor.setCode(body.task.solution);
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
  logOf(l.id).attempts++; touchLog(l.id);
  var chk = body.task.check, code = ed.getCode(), eng = Runtime.get(l.engine);

  /* Требования проверяем по ВСЕМ файлам задания, а не только по главному:
     в многофайловом уроке нужная строчка законно живёт в подключённом файле. */
  var srcsForCheck = ed.getSources ? ed.getSources() : {};
  var весьКод = code;
  for (var fk in srcsForCheck) весьКод += "\n" + srcsForCheck[fk];

  if (chk.needCode){
    for (var i = 0; i < chk.needCode.length; i++){
      if (!codeHas(весьКод, chk.needCode[i])){
        showMsg("warn", "<b>Почти</b>" + chk.needMsg);
        return;
      }
    }
  }
  /* needText — проверка по подстроке: нужна там, где искать «по словам»
     нельзя, например для «-> str» или для тройных кавычек. */
  if (chk.needText){
    for (var t2 = 0; t2 < chk.needText.length; t2++){
      if (весьКод.indexOf(chk.needText[t2]) < 0){
        showMsg("warn", "<b>Почти</b>" + chk.needMsg);
        return;
      }
    }
  }
  /* Запрещённые конструкции: например урок про рекурсию должен решаться
     рекурсией, а не циклом — иначе смысл урока теряется. */
  if (chk.noCode){
    for (var j = 0; j < chk.noCode.length; j++){
      if (codeHas(весьКод, chk.noCode[j])){
        showMsg("warn", "<b>Так нельзя</b>" + (chk.noMsg || ("В этом задании нельзя использовать «" + chk.noCode[j] + "».")));
        return;
      }
    }
  }

  var srcs = ed.getSources ? ed.getSources() : {};
  var refSrcs = solutionSources(body);
  var t = eng.newTurtle ? eng.newTurtle() : null;
  /* Ответы для input() берём те, что сейчас в панели: эталон считается
     на них же, иначе сравнивать вывод было бы нечестно. */
  var stdin = (session.studio && session.studio.getStdin) ? session.studio.getStdin() : (body.task.stdin || []);
  var res = eng.run(code, { turtle:t, sources: srcs, files: dataFiles(body.task.data), stdin: stdin });
  if (canvas) animateTurtle(canvas, t);
  if (res.error){ ed.setError(res.error.line); showMsg("bad", errHTML(res.error)); return; }

  var problem = null;
  if (chk.kind === "custom"){
    problem = (CUSTOM[chk.fn] || function(){ return null; })(res, code);
  } else if (chk.kind === "tests"){
    problem = runHiddenTests(eng, chk.calls, code, srcs, body.task.solution, refSrcs, dataFiles(body.task.data), stdin);
  } else if (chk.kind === "output"){
    var exp = chk.lines || eng.run(body.task.solution, { sources: refSrcs, files: dataFiles(body.task.data), stdin: stdin }).lines;
    var got = res.lines;
    if (!(exp.length === got.length && exp.every(function(x, i){ return x === got[i]; })))
      problem = diffBlock(exp, got);
  } else if (chk.kind === "turtle"){
    var ref = eng.run(body.task.solution, { turtle: eng.newTurtle(), sources: refSrcs, files: dataFiles(body.task.data), stdin: stdin }).turtle;
    if (!sameDrawing(t.segs, ref.segs)){
      problem = t.segs.length === 0
        ? "Черепашка не нарисовала ни одной линии. Проверь, что вызываешь forward(...) — и что карандаш опущен."
        : t.segs.length === ref.segs.length
          ? "Линий столько, сколько нужно (" + ref.segs.length + "), но рисунок другой. Значит, дело в длине стороны или в угле поворота."
          : "Линий должно быть " + ref.segs.length + ", а у тебя " + t.segs.length + ". Проверь, сколько раз повторяется цикл и сколько команд внутри него.";
    } else if (chk.pen && !sameDrawing(t.segs, ref.segs, true)){
      problem = "Форма правильная, а вот цвет или толщина не те. Проверь, что перед каждой линией стоит нужный color(...) и что width(...) задан там, где нужно.";
    }
  }

  if (problem){ showMsg("bad", "<b>Ещё не то</b>" + problem); return; }

  /* «найди ошибку»: вывод верный — но код починен или написан заново? */
  if (body.task.type === "fix"){
    var budget = chk.fixBudget || (editUnits(body.task.starter, body.task.solution) + 1);
    if (editUnits(body.task.starter, code) > budget){
      showMsg("warn", "<b>Работает, но это не починка</b>Вывод правильный — только строк изменено больше, чем нужно: " +
        "похоже, программа написана заново. Смысл задания в другом: найти одну поломку и тронуть только её. " +
        "Нажми «↩ Вернуть как было» и попробуй ещё раз.");
      return;
    }
  }
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
  var lg = logOf(l.id);
  lg.stars = Math.max(lg.stars || 0, stars);
  if (!lg.solvedAt) lg.solvedAt = Date.now();
  lg.last = Date.now();
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
  stopTimer(); clearAdminHash();
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

/* ================= экран: игры =================
   Готовые маленькие игры. Код виден и его можно менять прямо здесь:
   поправил — нажал «Новая игра» — играешь свою версию. Изменения
   сохраняются между заходами, а кнопка «Вернуть оригинал» их сбрасывает. */
function gamesList(){ return (window.GAMES || []); }
function gameCode(g){ return (S.games && S.games[g.id]) || g.code; }

function screenGames(){
  stopTimer(); clearAdminHash();
  session = { id:null, attempts:0, hints:0, shown:false };
  var gs = gamesList();
  var h = '<div class="lvlhead"><div><div class="idx">поиграй и загляни внутрь</div><h1>🎮 Игры</h1></div></div>' +
    '<p class="lede">Настоящие маленькие игры на Python. В каждой виден код — меняй его и смотри, что получится: сделай подсказку добрее, добавь свой вопрос в викторину, поменяй ответы дракона. Это самый быстрый способ понять, как код превращается в игру.</p>' +
    '<div class="gamegrid">';
  gs.forEach(function(g){
    var edited = !!(S.games && S.games[g.id]);
    h += '<button class="gamecard" data-id="' + g.id + '">' +
      '<span class="gemoji">' + g.emoji + '</span>' +
      '<b>' + esc(g.title) + (edited ? ' <span class="edittag">твоя версия</span>' : '') + '</b>' +
      '<span>' + esc(g.desc) + '</span></button>';
  });
  h += '</div><div class="pager"><button class="bigbtn ghost" id="tomap">← Ко всем мирам</button></div>';
  app.innerHTML = h;
  app.querySelectorAll(".gamecard").forEach(function(b){
    b.onclick = function(){ openGame(b.getAttribute("data-id")); };
  });
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function openGame(id){
  var g = gamesList().filter(function(x){ return x.id === id; })[0];
  if (!g) return screenGames();
  stopTimer(); clearAdminHash();
  session = { id:null, attempts:0, hints:0, shown:false };
  var head = '<div class="crumbs"><span data-go="games">Игры</span> › ' + g.emoji + ' ' + esc(g.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">игра</div><h1>' + g.emoji + ' ' + esc(g.title) + '</h1></div></div>' +
    '<p class="lede">' + esc(g.desc) + '</p>' +
    '<div class="note"><b>Как играть</b>Нажми «Новая игра», потом пиши ходы в поле снизу и жми Enter. Хочешь изменить игру — правь код слева и снова жми «Новая игра».</div>';
  app.innerHTML = head + '<div id="studio"></div>' +
    '<div class="pager"><button class="bigbtn ghost" data-go="games">← Ко всем играм</button>' +
    '<span class="sp"></span><button class="bigbtn ghost" id="greset">↩ Вернуть оригинал</button></div>';

  var studio = makeStudio({
    engine: "mini", draw: !!g.draw, play: true, code: gameCode(g), label: g.title,
    onRun: function(){
      S.games = S.games || {};
      S.games[g.id] = studio.editor.getCode();
      S.gamesPlayed = S.gamesPlayed || {};
      S.gamesPlayed[g.id] = 1;
      save();
    }
  });
  document.getElementById("studio").appendChild(studio);
  session.studio = studio;
  document.getElementById("greset").onclick = function(){
    if (S.games) delete S.games[g.id];
    save();
    openGame(id);
  };
  app.querySelectorAll("[data-go]").forEach(function(b){
    b.onclick = function(){ screenGames(); };
  });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= экран: разминка (predict) =================
   Отдельный раздел рядом с «Играми». Ребёнок читает готовую программу
   и ДО запуска пишет, что она напечатает. Потом сверка.
   Прогресс хранится в S.warmups и не влияет на звёзды и сотню уроков.
   ============================================================ */
function warmupsList(){ return (window.WARMUPS || []); }
function warmupDone(id){ return !!(S.warmups && S.warmups[id]); }

/* Сравнение предсказания с настоящим выводом. Хвостовые пробелы в каждой
   строке и пустые строки в конце не считаем — их ребёнок мог не набрать,
   а на смысл они не влияют. Внутренние пустые строки важны и остаются. */
function normPred(s){
  return String(s == null ? "" : s)
    .replace(/\r/g, "")
    .split("\n")
    .map(function(x){ return x.replace(/[ \t]+$/, ""); })
    .join("\n")
    .replace(/\n+$/, "");
}

/* Где вывод впервые разошёлся с ожидаемым. Подписи колонок можно задать:
   для «угадай вывод» это «на самом деле / ты предсказал», для «собери из
   блоков» — «нужный вывод / твой вывод». */
function predictDiff(want, got, wantLabel, gotLabel){
  wantLabel = wantLabel || "на самом деле";
  gotLabel = gotLabel || "ты предсказал";
  var W = normPred(want).split("\n"), G = normPred(got).split("\n");
  var n = Math.max(W.length, G.length), bad = -1;
  for (var i = 0; i < n; i++) if ((W[i] || "") !== (G[i] || "")){ bad = i; break; }
  var head = bad < 0
    ? "Строк должно быть " + W.length + ", а получилось " + G.length + "."
    : "Первое расхождение в строке " + (bad + 1) + ".";
  return head + '<div class="cmp"><div><u>' + wantLabel + '</u>' +
    esc(W.slice(0, 10).join("\n") || "(пусто)") + (W.length > 10 ? "\n…" : "") +
    '</div><div><u>' + gotLabel + '</u>' +
    esc(G.slice(0, 10).join("\n") || "(пусто)") + (G.length > 10 ? "\n…" : "") +
    '</div></div>';
}

/* Рабочая станция разминки: слева программа только для чтения, снизу
   поле для предсказания. Устроена так, чтобы сквозной тест мог с ней
   работать теми же ручками, что и с обычным редактором: editor.setCode /
   editor.getCode задают и читают предсказание, а кнопка «Проверить»
   помечена data-role="check". */
function makePredictStudio(cfg){
  cfg = cfg || {};
  var wrap = document.createElement("div");
  wrap.className = "predict";

  var codeBox = document.createElement("div");
  codeBox.className = "pcode";
  codeBox.innerHTML = '<div class="ehead"><span class="dot"></span><span class="dot"></span>' +
    '<span class="dot"></span><span class="lbl">программа — только читаем</span></div>' +
    '<pre><code>' + hl(cfg.code || "") + '</code></pre>';

  var ansBox = document.createElement("div");
  ansBox.className = "pane pans";
  ansBox.innerHTML = '<div class="ph">что напечатает программа?</div><div class="pb">' +
    '<textarea class="stdinbox predin" spellcheck="false" autocapitalize="off" autocorrect="off" rows="6" ' +
    'placeholder="Запиши вывод по строкам — так, как его напечатает программа"></textarea>' +
    '<div class="stdinhint">По строке на каждый print. Потом нажми «Проверить».</div></div>';
  var ta = ansBox.querySelector("textarea");

  var runbar = document.createElement("div");
  runbar.className = "runbar";
  runbar.innerHTML = '<button class="rbtn check" data-role="check">✓ Проверить</button>' +
    '<button class="rbtn sec" data-role="clear">↺ Очистить</button>' +
    '<span class="sp"></span><span class="tip">сначала подумай, потом проверь</span>';

  var msg = document.createElement("div"); msg.className = "msg";

  var outPane = document.createElement("div"); outPane.className = "pane pout"; outPane.style.display = "none";
  outPane.innerHTML = '<div class="ph">настоящий вывод программы</div><div class="console"></div>';
  var con = outPane.querySelector(".console");

  wrap.appendChild(codeBox);
  wrap.appendChild(ansBox);
  wrap.appendChild(runbar);
  wrap.appendChild(msg);
  wrap.appendChild(outPane);

  function showMsg(cls, html){ msg.className = "msg show " + cls; msg.innerHTML = html; }
  function hideMsg(){ msg.className = "msg"; }

  wrap.editor = {
    getCode: function(){ return ta.value; },
    setCode: function(v){ ta.value = v; },
    focusEditor: function(){ ta.focus(); }
  };
  wrap.showMsg = showMsg;
  wrap.reveal = function(text){
    outPane.style.display = "";
    con.innerHTML = text ? esc(text) : '<span class="empty">программа ничего не печатает</span>';
  };
  wrap.hideOut = function(){ outPane.style.display = "none"; };

  runbar.addEventListener("click", function(e){
    var b = e.target.closest("button"); if (!b) return;
    var r = b.getAttribute("data-role");
    if (r === "check") cfg.check(wrap.editor, showMsg);
    else if (r === "clear"){ ta.value = ""; hideMsg(); wrap.hideOut(); ta.focus(); }
  });
  ta.addEventListener("keydown", function(e){
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter"){ e.preventDefault(); cfg.check(wrap.editor, showMsg); }
  });

  return wrap;
}

/* Рабочая станция «собери из блоков»: перемешанные строки, которые
   переставляют перетаскиванием или кнопками ▲▼. Как и у predict,
   editor.setCode / editor.getCode работают со сборкой (нужны тесту):
   getCode возвращает собранную программу, setCode раскладывает блоки
   в порядок переданного текста. */
function makeBlocksStudio(cfg){
  cfg = cfg || {};
  var wrap = document.createElement("div");
  wrap.className = "predict blocks";

  /* строки-блоки: без пустых, отступы сохраняем — они и есть подсказка о вложенности */
  var blocks = String(cfg.code || "").replace(/\r/g, "").split("\n")
    .filter(function(l){ return l.trim() !== ""; });

  /* стартовый порядок — перемешанный и заведомо не равный правильному */
  var order = blocks.map(function(_, i){ return i; });
  (function shuffle(){
    for (var i = order.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var t = order[i]; order[i] = order[j]; order[j] = t;
    }
    var same = order.every(function(v, i){ return v === i; });
    if (same && order.length > 1) order.push(order.shift());
  })();

  var head = document.createElement("div");
  head.className = "ehead";
  head.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>' +
    '<span class="lbl">переставь строки по порядку — тяни за ⠿ или жми ▲ ▼</span>';

  var list = document.createElement("div");
  list.className = "blocklist";

  function render(){
    list.innerHTML = order.map(function(bi, pos){
      return '<div class="block" draggable="true" data-pos="' + pos + '">' +
        '<span class="bgrip" title="перетащи">⠿</span>' +
        '<pre class="bcode"><code>' + hl(blocks[bi]) + '</code></pre>' +
        '<span class="bmove"><button class="bbtn" data-up title="выше">▲</button>' +
        '<button class="bbtn" data-down title="ниже">▼</button></span>' +
        '</div>';
    }).join("");
  }
  render();

  function move(from, to){
    if (to < 0 || to >= order.length || from === to) return;
    var v = order.splice(from, 1)[0];
    order.splice(to, 0, v);
    render();
  }

  /* кнопки ▲ ▼ — работают и на телефоне, где перетаскивать неудобно */
  list.addEventListener("click", function(e){
    var b = e.target.closest("button.bbtn"); if (!b) return;
    var row = b.closest(".block"); if (!row) return;
    var pos = +row.getAttribute("data-pos");
    move(pos, b.hasAttribute("data-up") ? pos - 1 : pos + 1);
  });

  /* перетаскивание мышью */
  var dragFrom = -1;
  list.addEventListener("dragstart", function(e){
    var row = e.target.closest(".block"); if (!row) return;
    dragFrom = +row.getAttribute("data-pos");
    row.classList.add("dragging");
    if (e.dataTransfer){ e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", ""); } catch(_){} }
  });
  list.addEventListener("dragover", function(e){
    e.preventDefault();
    var row = e.target.closest(".block"); if (!row) return;
    list.querySelectorAll(".block.over").forEach(function(x){ x.classList.remove("over"); });
    row.classList.add("over");
  });
  list.addEventListener("drop", function(e){
    e.preventDefault();
    var row = e.target.closest(".block"); if (!row || dragFrom < 0) return;
    move(dragFrom, +row.getAttribute("data-pos"));
    dragFrom = -1;
  });
  list.addEventListener("dragend", function(){
    dragFrom = -1;
    list.querySelectorAll(".dragging,.over").forEach(function(x){ x.classList.remove("dragging","over"); });
  });

  var runbar = document.createElement("div");
  runbar.className = "runbar";
  runbar.innerHTML = '<button class="rbtn check" data-role="check">✓ Проверить</button>' +
    '<button class="rbtn sec" data-role="shuffle">🔀 Перемешать заново</button>' +
    '<span class="sp"></span><span class="tip">строки читаются сверху вниз</span>';

  var msg = document.createElement("div"); msg.className = "msg";

  var outPane = document.createElement("div"); outPane.className = "pane pout"; outPane.style.display = "none";
  outPane.innerHTML = '<div class="ph">что напечатала твоя сборка</div><div class="console"></div>';
  var con = outPane.querySelector(".console");

  wrap.appendChild(head);
  wrap.appendChild(list);
  wrap.appendChild(runbar);
  wrap.appendChild(msg);
  wrap.appendChild(outPane);

  function showMsg(cls, html){ msg.className = "msg show " + cls; msg.innerHTML = html; }

  wrap.editor = {
    getCode: function(){ return order.map(function(bi){ return blocks[bi]; }).join("\n"); },
    setCode: function(text){
      var target = String(text || "").replace(/\r/g, "").split("\n")
        .filter(function(l){ return l.trim() !== ""; });
      var used = {}, newOrder = [];
      target.forEach(function(line){
        for (var i = 0; i < blocks.length; i++){
          if (!used[i] && blocks[i] === line){ used[i] = 1; newOrder.push(i); break; }
        }
      });
      for (var i = 0; i < blocks.length; i++) if (!used[i]) newOrder.push(i);
      order = newOrder; render();
    },
    focusEditor: function(){}
  };
  wrap.showMsg = showMsg;
  wrap.reveal = function(text){
    outPane.style.display = "";
    con.innerHTML = text ? esc(text) : '<span class="empty">программа ничего не напечатала</span>';
  };
  wrap.hideOut = function(){ outPane.style.display = "none"; };

  runbar.addEventListener("click", function(e){
    var b = e.target.closest("button"); if (!b) return;
    var r = b.getAttribute("data-role");
    if (r === "check") cfg.check(wrap.editor, showMsg);
    else if (r === "shuffle"){
      msg.className = "msg"; wrap.hideOut();
      for (var i = order.length - 1; i > 0; i--){
        var j = Math.floor(Math.random() * (i + 1));
        var t = order[i]; order[i] = order[j]; order[j] = t;
      }
      render();
    }
  });

  return wrap;
}

function runBlocksCheck(w, ed, showMsg){
  session.attempts++;
  var eng = Runtime.get("mini");
  var got = eng.run(ed.getCode(), {});
  if (got.error){
    session.studio.hideOut();
    showMsg("bad", "<b>Пока не запускается</b>" + errHTML(got.error) +
      "<br>Скорее всего, какая-то строка стоит не на своём месте или не на своём отступе. Переставь и попробуй снова.");
    return;
  }
  var ref = eng.run(w.code, {});
  session.studio.reveal(got.output);
  if (got.output === ref.output){
    winWarmup(w);
  } else {
    showMsg("bad", "<b>Запускается, но вывод не тот</b>" +
      predictDiff(ref.output, got.output, "нужный вывод", "твой вывод") +
      "Порядок строк меняет и вывод — переставь и попробуй снова.");
  }
}

function screenWarmups(){
  stopTimer(); clearAdminHash();
  session = { id:null, attempts:0, hints:0, shown:false };
  var ws = warmupsList();
  var done = ws.filter(function(w){ return warmupDone(w.id); }).length;
  var h = '<div class="lvlhead"><div><div class="idx">думай, потом проверяй</div><h1>🔮 Разминка</h1></div>' +
    '<div class="right"><span class="tag">разгадано ' + done + ' из ' + ws.length + '</span></div></div>' +
    '<p class="lede">Короткие загадки «угадай вывод». Прочитай программу и запиши, что она напечатает, — до запуска. ' +
    'Это тренирует главное умение программиста: держать ход программы в голове. Звёзды тут не начисляются, ошибаться можно сколько угодно.</p>' +
    '<div class="gamegrid">';
  ws.forEach(function(w){
    h += '<button class="gamecard" data-id="' + w.id + '">' +
      '<span class="gemoji">' + w.emoji + '</span>' +
      '<b>' + esc(w.title) + (warmupDone(w.id) ? ' <span class="edittag done">разгадано ✓</span>' : '') + '</b>' +
      '<span>' + esc(w.intro) + '</span>' +
      '<span class="wtag">' + esc(w.tag) + '</span></button>';
  });
  h += '</div><div class="pager"><button class="bigbtn ghost" id="tomap">← Ко всем мирам</button></div>';
  app.innerHTML = h;
  app.querySelectorAll(".gamecard").forEach(function(b){
    b.onclick = function(){ openWarmup(b.getAttribute("data-id")); };
  });
  document.getElementById("tomap").onclick = screenWorlds;
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function openWarmup(id){
  var ws = warmupsList();
  var w = ws.filter(function(x){ return x.id === id; })[0];
  if (!w) return screenWarmups();
  stopTimer(); clearAdminHash();
  session = { id:id, attempts:0, hints:0, shown:false };
  var pos = ws.indexOf(w);
  var next = pos < ws.length - 1 ? ws[pos+1] : null;
  var prev = pos > 0 ? ws[pos-1] : null;

  var isBlocks = w.type === "blocks";
  var head = '<div class="crumbs"><span data-go="warmups">Разминка</span> › ' + w.emoji + ' ' + esc(w.title) + '</div>' +
    '<div class="lvlhead"><div><div class="idx">' + (isBlocks ? "собери из блоков" : "угадай вывод") + '</div><h1>' + w.emoji + ' ' + esc(w.title) + '</h1></div>' +
    '<div class="right"><span class="tag">' + esc(w.tag) + '</span></div></div>' +
    '<p class="lede">' + esc(w.intro) + '</p>' +
    '<div class="goal"><h3>🎯 Твоя задача</h3><p>' + esc(w.brief) + '</p></div>';

  var hints = '<div class="hintbox">' +
    '<button class="rbtn sec" id="hintbtn">💡 Подсказка</button>' +
    '<span class="tip">подсказки не отнимают ничего — это разминка</span></div>' +
    '<div class="hintout" id="hintout"></div>';

  var pager = '<div class="pager"><button class="bigbtn ghost" data-go="warmups">← Ко всем разминкам</button><span class="sp"></span>' +
    (prev ? '<button class="bigbtn ghost" data-prev="' + prev.id + '">Назад</button>' : '') +
    (next ? '<button class="bigbtn ghost" data-next="' + next.id + '">Дальше →</button>' : '') + '</div>';

  app.innerHTML = head + '<div id="studio"></div>' + hints + pager;

  var studio = isBlocks
    ? makeBlocksStudio({ code: w.code, check: function(ed, showMsg){ runBlocksCheck(w, ed, showMsg); } })
    : makePredictStudio({ code: w.code, check: function(ed, showMsg){ runPredictCheck(w, ed, showMsg); } });
  document.getElementById("studio").appendChild(studio);
  session.studio = studio;

  document.getElementById("hintbtn").onclick = function(){
    var hs = w.hints || [];
    if (!hs.length){ this.disabled = true; this.textContent = "Подсказок нет"; return; }
    if (session.hints >= hs.length) return;
    session.hints++;
    var out = document.getElementById("hintout");
    out.className = "hintout show";
    out.innerHTML = hs.slice(0, session.hints).map(function(x, i){
      return '<div class="step"><b>' + (i+1) + '.</b> ' + esc(x) + '</div>';
    }).join("");
    if (session.hints >= hs.length) this.textContent = "Подсказки кончились";
  };
  app.querySelectorAll("[data-go]").forEach(function(b){
    b.onclick = function(){ screenWarmups(); };
  });
  app.querySelectorAll("[data-next]").forEach(function(b){
    b.onclick = function(){ openWarmup(b.getAttribute("data-next")); };
  });
  app.querySelectorAll("[data-prev]").forEach(function(b){
    b.onclick = function(){ openWarmup(b.getAttribute("data-prev")); };
  });
  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function runPredictCheck(w, ed, showMsg){
  session.attempts++;
  var eng = Runtime.get("mini");
  var res = eng.run(w.code, {});
  if (res.error){ showMsg("bad", errHTML(res.error)); return; }
  var want = res.output, got = ed.getCode();
  if (normPred(want) === normPred(got)){
    session.studio.reveal(res.output);
    winWarmup(w);
  } else {
    session.studio.reveal(res.output);
    showMsg("bad", "<b>Ещё не совпало</b>" + predictDiff(want, got) +
      "Смотри на настоящий вывод справа, найди, где разошлось, и попробуй снова.");
  }
}

function winWarmup(w){
  S.warmups = S.warmups || {};
  S.warmups[w.id] = 1; save();
  var ws = warmupsList(), pos = ws.indexOf(w);
  var next = pos >= 0 && pos < ws.length - 1 ? ws[pos+1] : null;
  var firstTry = session.attempts === 1 && session.hints === 0;
  var isBlocks = w.type === "blocks";
  var big = firstTry ? "🎯" : (isBlocks ? "🧩" : "🔮");
  var h2 = firstTry
    ? (isBlocks ? "Собрал с первой попытки!" : "Точно, с первой попытки!")
    : (isBlocks ? "Собрал!" : "Угадал!");
  document.getElementById("wincard").innerHTML =
    '<div class="big">' + big + '</div>' +
    '<h2>' + h2 + '</h2>' +
    '<p>' + esc(w.note || (isBlocks ? "Ты собрал программу в правильном порядке." : "Ты правильно предсказал, что напечатает программа.")) + '</p>' +
    '<div class="winrow">' +
      (next ? '<button class="bigbtn" id="wnext">Следующая →</button>'
            : '<button class="bigbtn" id="wlist">Ко всем разминкам</button>') +
      '<button class="bigbtn ghost" id="wstay">Остаться здесь</button></div>';
  document.getElementById("win").classList.add("show");
  confetti(2);
  var wn = document.getElementById("wnext");
  if (wn) wn.onclick = function(){ closeWin(); openWarmup(next.id); };
  var wl = document.getElementById("wlist");
  if (wl) wl.onclick = function(){ closeWin(); screenWarmups(); };
  document.getElementById("wstay").onclick = closeWin;
}

/* ================= экран: панель наставника =================
   Закрыт кодом (см. ADMIN_CODE наверху файла). Открывается адресом
   с #admin на конце. Показывает прогресс, позволяет открывать и
   зачитывать уроки, обмениваться данными с сервером и смотреть
   прогресс другого ученика по его коду.
   ============================================================ */
function clearAdminHash(){
  try {
    if ((location.hash || "").toLowerCase() === "#admin" && history.replaceState)
      history.replaceState(null, "", location.pathname + location.search);
  } catch(e){}
}
function adminUnlocked(){
  try { return sessionStorage.getItem("kodokvest_admin") === "1"; } catch(e){ return !!window.__adminOk; }
}
function adminUnlock(){
  window.__adminOk = true;
  try { sessionStorage.setItem("kodokvest_admin", "1"); } catch(e){}
}
function adminLock(){
  window.__adminOk = false;
  try { sessionStorage.removeItem("kodokvest_admin"); } catch(e){}
}
function routeHash(){
  if ((location.hash || "").toLowerCase() === "#admin"){ screenAdmin(); return true; }
  if ((location.hash || "").toLowerCase() === "#games"){ screenGames(); return true; }
  if ((location.hash || "").toLowerCase() === "#warmup"){ screenWarmups(); return true; }
  return false;
}
function fmtMins(ms){
  var m = Math.round((ms || 0) / 60000);
  if (m < 1) return "—";
  if (m < 60) return m + " мин";
  return Math.floor(m / 60) + " ч " + (m % 60) + " мин";
}
function fmtWhen(ts){
  if (!ts) return "—";
  var d = new Date(ts), p = function(x){ return (x < 10 ? "0" : "") + x; };
  return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() +
         " " + p(d.getHours()) + ":" + p(d.getMinutes());
}
function progressJSON(){ return JSON.stringify(S, null, 2); }
function statBox(k, v){
  return '<div class="admstat"><span>' + k + '</span><b>' + v + '</b></div>';
}
function rankOf(xp){
  var r = RANKS[0][1];
  for (var i = 0; i < RANKS.length; i++) if (xp >= RANKS[i][0]) r = RANKS[i][1];
  return r;
}
function adminKeySaved(){
  try { return sessionStorage.getItem("kodokvest_srvkey") || ""; } catch(e){ return window.__srvKey || ""; }
}
function adminKeyRemember(v){
  window.__srvKey = v;
  try { sessionStorage.setItem("kodokvest_srvkey", v); } catch(e){}
}

/* Когда смотрим чужой прогресс, viewState держит его копию.
   Локальные данные при этом не трогаются вообще. */
var viewState = null;

function adminGate(){
  app.innerHTML =
    '<div class="lvlhead"><div><div class="idx">служебный экран</div><h1>🔐 Панель наставника</h1></div></div>' +
    '<p class="lede">Здесь видно, как идут занятия, и можно открывать уроки. Введи код доступа.</p>' +
    '<div class="card"><div class="admgate">' +
      '<input type="password" id="admcode" placeholder="код доступа" autocomplete="off" spellcheck="false">' +
      '<button class="rbtn check" id="admgo">Войти</button>' +
    '</div><div class="msg" id="admgatemsg"></div></div>' +
    '<div class="pager"><button class="bigbtn ghost" id="admback">← Ко всем мирам</button></div>';
  var inp = document.getElementById("admcode");
  var msg = document.getElementById("admgatemsg");
  function tryIn(){
    if (inp.value === ADMIN_CODE){ adminUnlock(); screenAdmin(); return; }
    msg.className = "msg show bad";
    msg.innerHTML = "<b>Код не подошёл</b>Проверь раскладку клавиатуры и большие буквы.";
    inp.value = ""; inp.focus();
  }
  document.getElementById("admgo").onclick = tryIn;
  inp.addEventListener("keydown", function(e){ if (e.key === "Enter") tryIn(); });
  document.getElementById("admback").onclick = screenWorlds;
  inp.focus();
  refreshTop();
}

/* ---------- сводка по любому набору данных ---------- */
function statsGridHTML(st){
  var readyTotal = 0;
  CURRICULUM.forEach(function(w){ readyTotal += worldReadyLessons(w).length; });
  var stars = 0, solved = 0;
  var sm = st.stars || {};
  Object.keys(sm).forEach(function(k){ stars += sm[k] || 0; solved++; });
  var timeMs = 0, attempts = 0, hints = 0, last = 0;
  var lg = st.log || {};
  Object.keys(lg).forEach(function(k){
    var g = lg[k] || {};
    timeMs += g.timeMs || 0;
    attempts += g.attempts || 0;
    hints += g.hints || 0;
    if ((g.last || 0) > last) last = g.last;
  });
  return '<div class="admstats">' +
    statBox("Пройдено уроков", solved + " из " + CURRICULUM.total) +
    statBox("Уроков готово", String(readyTotal)) +
    statBox("Звёзды", stars + " из " + (readyTotal * 3)) +
    statBox("Опыт", (st.xp || 0) + " XP") +
    statBox("Ранг", rankOf(st.xp || 0)) +
    statBox("Попыток всего", String(attempts)) +
    statBox("Подсказок взято", String(hints)) +
    statBox("Время за тренажёром", fmtMins(timeMs)) +
    statBox("Последнее занятие", fmtWhen(last)) +
    statBox("Бейджи", (st.badges || []).length + " из " + BADGES.length) +
    '</div>';
}

/* ---------- таблица уроков по любому набору данных ---------- */
function lessonTableHTML(st, withActions){
  var h = "";
  var sm = st.stars || {}, lg = st.log || {};
  CURRICULUM.forEach(function(w){
    var c = CONTENT["world" + w.n] || {};
    h += '<div class="sect"><h2>' + w.icon + ' Мир ' + w.n + ' · ' + w.title + '</h2>' +
      '<div class="line"></div><span class="cnt">' + worldReadyLessons(w).length + ' с контентом</span></div>';
    h += '<div class="admtable"><div class="admwide"><div class="admhead">' +
      '<span>№</span><span>урок</span><span>звёзды</span><span>попыток</span><span>подсказок</span>' +
      '<span>решение</span><span>время</span><span>когда</span><span></span></div>';
    w.lessons.forEach(function(l){
      var has = !!c[l.id], g = lg[l.id] || {};
      var stn = sm[l.id] === undefined ? -1 : sm[l.id], stars = "";
      for (var k = 0; k < 3; k++) stars += (k < stn) ? "<b>★</b>" : "★";
      h += '<div class="admrowl' + (has ? "" : " soon") + '">' +
        '<span class="n">' + l.num + '</span>' +
        '<span class="t">' + l.title + (l.boss ? ' <em>босс</em>' : '') + (has ? '' : ' <em>скоро</em>') + '</span>' +
        '<span class="stars">' + (stn >= 0 ? stars : "—") + '</span>' +
        '<span>' + (g.attempts || "—") + '</span>' +
        '<span>' + (g.hints || "—") + '</span>' +
        '<span>' + (g.shown ? "смотрел" : "—") + '</span>' +
        '<span>' + fmtMins(g.timeMs) + '</span>' +
        '<span>' + fmtWhen(g.solvedAt || g.last) + '</span>' +
        '<span class="acts">' + (has && withActions
          ? '<button class="minibtn" data-act="go" data-id="' + l.id + '">открыть</button>' +
            '<button class="minibtn" data-act="pass" data-id="' + l.id + '">зачесть</button>' +
            '<button class="minibtn" data-act="clear" data-id="' + l.id + '">сбросить</button>'
          : '') + '</span></div>';
    });
    h += '</div></div>';
  });
  return h;
}

/* ---------- карточка сервера ---------- */
function serverCardHTML(){
  if (typeof Cloud === "undefined" || !Cloud.hasUrl()){
    return '<div class="card"><h3>Сервер</h3>' +
      '<p class="dim">Сервер не подключён: прогресс хранится только в этом браузере, ' +
      'и посмотреть его с другого устройства нельзя. Чтобы подключить, нужно вписать адрес функции ' +
      'в файл <code>js/cloud-config.js</code> — по шагам это описано в <code>cloud/README.md</code>.</p></div>';
  }
  var code = Cloud.myCode();
  var state = cloudState.busy ? "обмен…" : (cloudState.lastError ? "была ошибка" : "в порядке");
  return '<div class="card"><h3>Сервер</h3>' +
    '<div class="admstats">' +
      statBox("Код этого устройства", code ? esc(code) : "не задан") +
      statBox("Последний обмен", cloudState.lastSync ? fmtWhen(cloudState.lastSync) : "ещё не было") +
      statBox("Состояние", code ? state : "ждёт код") +
    '</div>' +
    (code ? '' : '<div class="msg show warn"><b>Код ученика не задан</b>Пока его нет, прогресс ' +
      'не уходит на сервер. Придумайте код — латинские буквы, цифры и дефис, от 3 до 32 знаков ' +
      '(например <code>misha-7f3a</code>) — и впишите ниже. У каждого ребёнка код свой. ' +
      'Не делайте его угадываемым: кто знает код, тот видит прогресс.</div>') +
    '<div class="admrow">' +
      '<label class="admlbl">код ученика <input type="text" id="devcode" value="' + esc(code) +
        '" placeholder="misha-7f3a" autocomplete="off" spellcheck="false"></label>' +
      '<button class="rbtn ' + (code ? 'sec' : 'check') + '" data-act="setcode">Записать код</button>' +
    '</div>' +
    '<p class="dim">Код относится только к этому браузеру, в файлах сайта он не хранится. ' +
    'Тот же код можно задать ссылкой: добавьте к адресу <code>?kid=ваш-код</code> и откройте её один раз ' +
    'на устройстве ребёнка.</p>' +
    (cloudState.lastError
      ? '<div class="msg show bad"><b>Последняя ошибка</b>' + esc(cloudState.lastError) + '</div>' : '') +
    '<div class="admrow">' +
      '<button class="rbtn sec" data-act="push">↑ Отправить сейчас</button>' +
      '<button class="rbtn sec" data-act="pull">↓ Забрать с сервера</button>' +
      '<button class="rbtn sec" data-act="ping">Проверить настройку</button>' +
    '</div>' +
    '<p class="dim">При обмене прогресс не перезаписывается, а сливается: по каждому уроку ' +
    'остаётся лучший результат из двух копий. Поэтому «Забрать» ничего не портит.</p>' +
    '<h3 style="margin-top:20px">Прогресс другого ученика</h3>' +
    '<div class="admrow">' +
      '<label class="admlbl">код <input type="text" id="othercode" placeholder="misha-7f3a" ' +
        'autocomplete="off" spellcheck="false"></label>' +
      '<button class="rbtn sec" data-act="viewother">Посмотреть</button>' +
    '</div>' +
    '<div class="admrow">' +
      '<label class="admlbl">ключ наставника <input type="password" id="adminkey" ' +
        'value="' + esc(adminKeySaved()) + '" autocomplete="off"></label>' +
      '<button class="rbtn sec" data-act="listall">Список всех учеников</button>' +
    '</div>' +
    '<p class="dim">Чужой прогресс только показывается — на этом устройстве ничего не меняется.</p>' +
    '<div id="srvout"></div></div>';
}

function screenAdmin(){
  stopTimer();
  if (!adminUnlocked()) return adminGate();

  var h = "";

  if (viewState){
    /* ---------- режим просмотра чужого прогресса ---------- */
    h += '<div class="lvlhead"><div><div class="idx">только чтение</div>' +
      '<h1>👀 Ученик: ' + esc(viewState.code) + '</h1></div>' +
      '<div class="right"><span class="tag">данные с сервера</span></div></div>' +
      '<p class="lede">Это копия с сервера на момент ' + fmtWhen(viewState.serverAt) +
      '. Изменить здесь ничего нельзя, и на ваш собственный прогресс это не влияет.</p>' +
      '<div class="admrow"><button class="rbtn check" data-act="myown">← Вернуться к своему прогрессу</button></div>';
    h += statsGridHTML(viewState.data);
    h += lessonTableHTML(viewState.data, false);
    h += '<div class="pager"><button class="bigbtn ghost" data-act="myown">← Свой прогресс</button>' +
      '<span class="sp"></span><button class="bigbtn ghost" data-act="tomap">Ко всем мирам</button></div>';
  } else {
    /* ---------- обычный режим ---------- */
    h += '<div class="lvlhead"><div><div class="idx">служебный экран</div>' +
      '<h1>🔐 Панель наставника</h1></div><div class="right"><span class="tag">код принят</span></div></div>' +
      '<p class="lede">' + (cloudEnabled()
        ? 'Прогресс синхронизируется с сервером — его видно с любого устройства.'
        : 'Прогресс лежит в памяти <b>этого</b> браузера. Чтобы видеть его с другого устройства, ' +
          'подключите сервер или выгрузите файл в самом низу страницы.') + '</p>';

    h += statsGridHTML(S);
    h += serverCardHTML();

    h += '<div class="card"><h3>Быстрые действия</h3><div class="admrow">' +
      '<button class="rbtn ' + (S.admin.unlockAll ? "check" : "sec") + '" data-act="unlockall">' +
        (S.admin.unlockAll ? "✓ Все уроки открыты" : "Открыть все уроки") + '</button>' +
      '<button class="rbtn sec" data-act="passready">Зачесть все готовые на 3★</button>' +
      '<button class="rbtn sec" data-act="resetall">Сбросить весь прогресс</button>' +
      '</div><p class="dim">«Открыть все уроки» только снимает замки — звёзды не ставит. ' +
      'Ребёнок сможет зайти в любой урок и решить его сам, порядок перестанет быть обязательным. ' +
      'Эта настройка относится только к текущему устройству и на сервер не уходит.</p></div>';

    h += '<div class="card"><h3>Опыт и бейджи</h3><div class="admrow">' +
      '<label class="admlbl">XP <input type="number" id="xpin" value="' + S.xp + '" min="0" step="25"></label>' +
      '<button class="rbtn sec" data-act="setxp">Записать</button></div>' +
      '<div class="admbadges">' +
      BADGES.map(function(b){
        var got = S.badges.indexOf(b.id) >= 0;
        return '<button class="admbadge' + (got ? " got" : "") + '" data-act="badge" data-id="' + b.id + '">' +
          '<span class="em">' + b.em + '</span><span>' + b.name + '</span></button>';
      }).join("") +
      '</div><p class="dim">Нажатие на бейдж выдаёт его или отбирает.</p></div>';

    h += lessonTableHTML(S, true);

    h += '<div class="card"><h3>Перенос прогресса файлом</h3>' +
      '<div class="admrow">' +
        '<button class="rbtn sec" data-act="download">↓ Скачать файл прогресса</button>' +
        '<button class="rbtn sec" data-act="copy">Скопировать текст</button>' +
      '</div>' +
      '<p class="dim">Способ без сервера: здесь скачал файл — на другом устройстве открыл эту же ' +
      'панель, вставил содержимое в поле ниже и нажал «Загрузить». В отличие от обмена с сервером, ' +
      'загрузка файла <b>заменяет</b> прогресс целиком, а не сливает его.</p>' +
      '<textarea class="admjson" id="admjson" spellcheck="false">' + esc(progressJSON()) + '</textarea>' +
      '<div class="admrow"><button class="rbtn sec" data-act="import">Загрузить из этого поля</button></div>' +
      '<div class="msg" id="admmsg"></div></div>';

    h += '<div class="pager"><button class="bigbtn ghost" data-act="tomap">← Ко всем мирам</button>' +
      '<span class="sp"></span><button class="bigbtn ghost" data-act="lock">Выйти из панели</button></div>';
  }

  /* контейнер создаётся заново при каждой отрисовке — обработчик не копится */
  app.innerHTML = '<div id="adm"></div>';
  var box = document.getElementById("adm");
  box.innerHTML = h;

  function say(cls, html){
    var m = document.getElementById("admmsg");
    if (m){ m.className = "msg show " + cls; m.innerHTML = html; }
  }
  function srv(cls, html){
    var m = document.getElementById("srvout");
    if (m) m.innerHTML = '<div class="msg show ' + cls + '">' + html + '</div>';
  }

  box.addEventListener("click", function(e){
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");

    if (act === "tomap"){ viewState = null; screenWorlds(); }
    else if (act === "myown"){ viewState = null; screenAdmin(); }
    else if (act === "lock"){ viewState = null; adminLock(); screenWorlds(); }
    else if (act === "unlockall"){ S.admin.unlockAll = !S.admin.unlockAll; saveLocal(); screenAdmin(); }
    else if (act === "passready"){
      CURRICULUM.forEach(function(w){
        worldReadyLessons(w).forEach(function(l){ setStars(l.id, 3); });
      });
      refreshTop(); screenAdmin();
    }
    else if (act === "resetall"){
      var yes = true;
      try { yes = confirm("Стереть весь прогресс: звёзды, XP, бейджи и статистику? Отменить будет нельзя."); } catch(e2){}
      if (!yes) return;
      S.xp = 0; S.stars = {}; S.badges = []; S.log = {}; S.drawDone = {};
      S.firstTry = 0; S.perfect = 0;
      save(); refreshTop(); screenAdmin();
    }
    else if (act === "go"){ openLesson(id); }
    else if (act === "pass"){ setStars(id, 3); refreshTop(); screenAdmin(); }
    else if (act === "clear"){ setStars(id, 0); delete S.log[id]; save(); refreshTop(); screenAdmin(); }
    else if (act === "badge"){
      var i = S.badges.indexOf(id);
      if (i >= 0) S.badges.splice(i, 1); else S.badges.push(id);
      save(); screenAdmin();
    }
    else if (act === "setxp"){
      var v = parseInt(document.getElementById("xpin").value, 10);
      if (isNaN(v) || v < 0){ say("bad", "<b>Не подходит</b>XP должен быть целым числом не меньше нуля."); return; }
      S.xp = v; save(); refreshTop(); screenAdmin();
    }

    /* ---------- сервер ---------- */
    else if (act === "setcode"){
      var raw = (document.getElementById("devcode").value || "").trim();
      if (!Cloud.setCode(raw)){
        srv("bad", "<b>Код не подходит</b>Нужно от 3 до 32 знаков: латинские буквы, цифры, " +
          "дефис и подчёркивание. Первый знак — буква или цифра. Заглавные буквы можно, они сами " +
          "станут маленькими. Русские буквы, пробелы и точки нельзя.");
        return;
      }
      screenAdmin();
      srv("ok", "<b>Код записан</b>Теперь можно отправить прогресс на сервер.");
    }
    else if (act === "push"){
      srv("warn", "<b>Отправляю…</b>");
      cloudPush().then(function(){ screenAdmin(); srv("ok", "<b>Отправлено</b>Прогресс лежит на сервере."); },
                       function(err){ srv("bad", "<b>Не отправилось</b>" + esc(err.message || err)); });
    }
    else if (act === "pull"){
      srv("warn", "<b>Забираю…</b>");
      cloudPull().then(function(changed){
        refreshTop(); screenAdmin();
        srv(changed ? "ok" : "warn", changed
          ? "<b>Забрано и слито</b>Прогресс с сервера добавлен к тому, что было здесь."
          : "<b>Уже одинаково</b>На сервере нет ничего нового.");
      }, function(err){ srv("bad", "<b>Не получилось</b>" + esc(err.message || err)); });
    }
    else if (act === "ping"){
      srv("warn", "<b>Проверяю…</b>");
      Cloud.ping().then(function(r){
        srv("ok", "<b>Сервер настроен верно</b>Папка: " + esc(r.dir) + ". Учеников в ней: " + r.students +
          ". Ключ наставника " + (r.adminKeySet ? "задан" : "не задан — список учеников будет закрыт") + ".");
      }, function(err){ srv("bad", "<b>Проверка не прошла</b>" + esc(err.message || err)); });
    }
    else if (act === "viewother"){
      var code = (document.getElementById("othercode").value || "").trim().toLowerCase();
      if (!code){ srv("bad", "<b>Пусто</b>Введите код ученика."); return; }
      srv("warn", "<b>Загружаю…</b>");
      Cloud.load(code).then(function(r){
        if (!r.found || !r.data){ srv("warn", "<b>Ничего нет</b>Под кодом «" + esc(code) +
          "» на сервере пока нет прогресса. Проверьте код."); return; }
        viewState = { code: code, data: r.data, serverAt: r.serverAt || 0 };
        screenAdmin();
      }, function(err){ srv("bad", "<b>Не получилось</b>" + esc(err.message || err)); });
    }
    else if (act === "listall"){
      var key = (document.getElementById("adminkey").value || "").trim();
      if (!key){ srv("bad", "<b>Пусто</b>Нужен ключ наставника — тот, что задан в настройках функции как ADMIN_KEY."); return; }
      adminKeyRemember(key);
      srv("warn", "<b>Загружаю…</b>");
      Cloud.list(key).then(function(r){
        var st = r.students || [];
        if (!st.length){ srv("warn", "<b>Пока никого</b>На сервере нет ни одного ученика."); return; }
        srv("ok", "<b>Учеников на сервере: " + st.length + "</b>" +
          '<div class="admlist">' + st.map(function(s){
            return s.broken
              ? '<div class="admlrow"><b>' + esc(s.code) + '</b><span>файл испорчен</span></div>'
              : '<div class="admlrow"><b>' + esc(s.code) + '</b>' +
                '<span>' + s.solved + ' уроков · ' + s.stars + '★ · ' + s.xp + ' XP · ' +
                fmtMins(s.timeMs) + ' · ' + fmtWhen(s.serverAt) + '</span>' +
                '<button class="minibtn" data-act="viewcode" data-id="' + esc(s.code) + '">открыть</button></div>';
          }).join("") + '</div>');
      }, function(err){ srv("bad", "<b>Не получилось</b>" + esc(err.message || err)); });
    }
    else if (act === "viewcode"){
      srv("warn", "<b>Загружаю…</b>");
      Cloud.load(id).then(function(r){
        if (!r.found || !r.data){ srv("warn", "<b>Ничего нет</b>Прогресс пуст."); return; }
        viewState = { code: id, data: r.data, serverAt: r.serverAt || 0 };
        screenAdmin();
      }, function(err){ srv("bad", "<b>Не получилось</b>" + esc(err.message || err)); });
    }

    /* ---------- файл ---------- */
    else if (act === "download"){
      try {
        var blob = new Blob([progressJSON()], { type:"application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = "kodokvest-progress.json";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
        say("ok", "<b>Файл сохранён</b>Ищи kodokvest-progress.json в папке загрузок.");
      } catch(e3){
        say("warn", "<b>Скачать не получилось</b>Скопируй текст из поля ниже вручную.");
      }
    }
    else if (act === "copy"){
      var ta = document.getElementById("admjson"), done = false;
      try { ta.focus(); ta.select(); done = document.execCommand("copy"); } catch(e4){}
      if (!done && navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(progressJSON()).then(
          function(){ say("ok", "<b>Скопировано</b>Прогресс в буфере обмена."); },
          function(){ say("warn", "<b>Не вышло</b>Выдели текст в поле и скопируй сам."); });
        return;
      }
      say(done ? "ok" : "warn", done
        ? "<b>Скопировано</b>Прогресс в буфере обмена."
        : "<b>Не вышло</b>Выдели текст в поле и скопируй сам.");
    }
    else if (act === "import"){
      var txt = document.getElementById("admjson").value, obj = null;
      try { obj = JSON.parse(txt); } catch(e5){
        say("bad", "<b>Это не файл прогресса</b>Текст не разбирается как JSON. Скопируй содержимое файла целиком, вместе с фигурными скобками.");
        return;
      }
      if (!obj || typeof obj !== "object" || typeof obj.xp !== "number" || typeof obj.stars !== "object"){
        say("bad", "<b>Не тот файл</b>Внутри должны быть поля xp и stars. Похоже, это что-то другое.");
        return;
      }
      var ok = true;
      try { ok = confirm("Заменить прогресс на этом устройстве загруженным? Нынешний будет стёрт."); } catch(e6){}
      if (!ok) return;
      Object.keys(S).forEach(function(k){ delete S[k]; });
      S.v = 2; S.xp = 0; S.stars = {}; S.badges = []; S.sandbox = null; S.sandboxRuns = 0;
      S.drawDone = {}; S.firstTry = 0; S.perfect = 0; S.log = {}; S.admin = { unlockAll:false };
      Object.keys(obj).forEach(function(k){ S[k] = obj[k]; });
      if (!S.log || typeof S.log !== "object") S.log = {};
      if (!S.admin || typeof S.admin !== "object") S.admin = { unlockAll:false };
      save(); refreshTop(); screenAdmin();
      say("ok", "<b>Прогресс загружен</b>Данные заменены.");
    }
  });

  refreshTop();
  window.scrollTo({ top:0, behavior:"smooth" });
}

/* ================= старт ================= */
document.getElementById("btn-map").onclick = screenWorlds;
document.getElementById("logo").onclick = screenWorlds;
document.getElementById("btn-sand").onclick = screenSandbox;
(function(){ var b = document.getElementById("btn-games"); if (b) b.onclick = screenGames; })();
(function(){ var b = document.getElementById("btn-warm"); if (b) b.onclick = screenWarmups; })();
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

/* Ссылка вида .../kodokvest/?kid=misha-7f3a один раз задаёт код ученика
   на этом устройстве. Дальше он живёт в памяти браузера, а из адреса
   убирается — чтобы не болтался на виду и не попал в закладку. */
(function(){
  if (typeof Cloud === "undefined") return;
  var m = /[?&]kid=([^&]+)/.exec(location.search || "");
  if (!m) return;
  var set = Cloud.setCode(decodeURIComponent(m[1]));
  try {
    if (set && history.replaceState)
      history.replaceState(null, "", location.pathname + location.hash);
  } catch(e){}
})();

/* грузим содержание всех миров до первой отрисовки — иначе на сайте
   миры 2–5 мигают как «в работе», пока их файлы не приедут */
allWorldsContent().then(function(){
  if (!routeHash()) screenWorlds();
  /* сервер подключаем в фоне: игра должна открываться сразу и работать без сети */
  if (cloudEnabled()){
    cloudPull().then(function(changed){
      refreshTop();
      /* перерисовываем только карту миров — не выдёргиваем ученика из урока */
      if (changed && document.querySelector(".worlds")) screenWorlds();
      return cloudPush();
    }).catch(function(){ refreshTop(); });
  }
});
window.addEventListener("hashchange", function(){ if (!routeHash()) screenWorlds(); });

window.__game = {
  screenWorlds: screenWorlds, screenWorld: screenWorld, openLesson: openLesson,
  screenSandbox: screenSandbox, screenAdmin: screenAdmin, screenGames: screenGames,
  openGame: openGame, screenWarmups: screenWarmups, openWarmup: openWarmup, state: S, save: save,
  CUSTOM: CUSTOM, sameDrawing: sameDrawing, editUnits: editUnits, setStars: setStars,
  stopTimer: stopTimer, adminUnlock: adminUnlock, ADMIN_CODE: ADMIN_CODE,
  getSession: function(){ return session; },
  mergeProgress: mergeProgress, cloudSnapshot: cloudSnapshot, applyProgress: applyProgress,
  cloudPull: cloudPull, cloudPush: cloudPush, cloudState: cloudState
};
})();
