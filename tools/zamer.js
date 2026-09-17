/* Замер связей разделов js/app.js перед разрезом (RAZVITIE § 2.5, § 4.54).
   Заведён 17.09.2026 разрезом вывески (1.187.0).

   node tools/zamer.js               — все баннеры «/* =====», по числу строк:
                                       объявлено / наружу / внутрь
   node tools/zamer.js 100 200 [..]  — куски строк (пары «от до») как ОДИН
                                       раздел: какие имена объявлены, кто их
                                       зовёт снаружи (номера строк) и что
                                       раздел берёт из app.js

   ⚠️ Баннер — не граница раздела (§ 4.54): сперва таблица, потом поиск
   всех объявлений раздела по именам, потом замер кусками.
   Разбор грубый: имена вне строк и комментариев, объявления верхнего
   уровня (function и var, включая «var a = …, b = …»). Свойства после
   точки и ключи объектов не считаются. SRC=путь — замерить другой файл. */
const fs = require("fs");
const src = fs.readFileSync(process.env.SRC || "js/app.js", "utf8");
const toks = []; // {t:'id'|'p', v, line, depth}
let i = 0, line = 1, depth = 0, lastSig = "";
const tmplStack = []; // brace depth at which template ${ opened
function regexAllowed() {
  if (!lastSig) return true;
  if (/^[A-Za-z_$][\w$]*$/.test(lastSig)) return ["return","typeof","case","do","else","in","of","new","delete","void","throw","instanceof"].includes(lastSig);
  if (/^[0-9]/.test(lastSig)) return false;
  return !(lastSig === ")" || lastSig === "]" || lastSig === "}");
}
function readTemplate() { // i at char after ` or after }
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") { i += 2; continue; }
    if (c === "\n") line++;
    if (c === "`") { i++; lastSig = "str"; return; }
    if (c === "$" && src[i+1] === "{") { i += 2; tmplStack.push(depth); depth++; lastSig = "{"; return; }
    i++;
  }
}
while (i < src.length) {
  const c = src[i];
  if (c === "\n") { line++; i++; continue; }
  if (/\s/.test(c)) { i++; continue; }
  if (c === "/" && src[i+1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
  if (c === "/" && src[i+1] === "*") { const e = src.indexOf("*/", i+2); line += (src.slice(i, e).match(/\n/g)||[]).length; i = e + 2; continue; }
  if (c === "'" || c === '"') { i++; while (src[i] !== c) { if (src[i] === "\\") i++; i++; } i++; lastSig = "str"; continue; }
  if (c === "`") { i++; readTemplate(); continue; }
  if (c === "/" && regexAllowed()) {
    i++; let cls = false;
    while (i < src.length) { const d = src[i]; if (d === "\\") { i += 2; continue; } if (d === "[") cls = true; else if (d === "]") cls = false; else if (d === "/" && !cls) break; i++; }
    i++; while (/[a-z]/.test(src[i])) i++; lastSig = "re"; continue;
  }
  if (/[A-Za-z_$]/.test(c)) {
    let j = i; while (j < src.length && /[\w$]/.test(src[j])) j++;
    const v = src.slice(i, j);
    const prev = toks[toks.length-1];
    toks.push({ t:"id", v, line, depth, pos: i, dot: prev && prev.t === "p" && prev.v === "." , prop: /^\s*:/.test(src.slice(j, j+3)) && prev && prev.t==="p" && (prev.v === "{" || prev.v === ",") });
    lastSig = v; i = j; continue;
  }
  if (/[0-9]/.test(c)) { let j = i; while (/[\w.]/.test(src[j])) j++; lastSig = "0"; i = j; continue; }
  if (c === "{") depth++;
  if (c === "}") {
    if (tmplStack.length && tmplStack[tmplStack.length-1] === depth-1) { tmplStack.pop(); depth--; i++; readTemplate(); continue; }
    depth--;
  }
  toks.push({ t:"p", v:c, line, depth }); lastSig = c; i++;
}
// объявления верхнего уровня (depth 1 внутри IIFE)
const decl = new Map();
for (let k = 0; k < toks.length; k++) {
  const a = toks[k], b = toks[k+1];
  if (a.t === "id" && (a.v === "function" || a.v === "var") && a.depth === 1 && b && b.t === "id") {
    if (!decl.has(b.v)) decl.set(b.v, b.line);
    if (a.v === "var") {
      let par = 0;
      for (let m = k+2; m < toks.length; m++) {
        const x = toks[m];
        if (x.t === "p") {
          if ("([".includes(x.v)) par++;
          else if (")]".includes(x.v)) par--;
          else if (x.v === ";" && par === 0 && x.depth === 1) break;
          else if (x.v === "," && par === 0 && x.depth === 1) {
            const y = toks[m+1], z = toks[m+2];
            if (y && y.t === "id" && z && ((z.t === "p" && (z.v === "=" || z.v === "," || z.v === ";")))) { if (!decl.has(y.v)) decl.set(y.v, y.line); }
          }
        } else if (x.v === "function" || x.v === "var") { if (x.depth === 1 && x.v==="var") break; }
      }
    }
  }
}
function byRanges(a){
const R = [];
for (let k=0;k<a.length;k+=2) R.push([a[k],a[k+1]]);
const inR = l => R.some(([f,t]) => l>=f && l<=t);
const inside = [...decl].filter(([n,l]) => inR(l));
const inSet = new Set(inside.map(x=>x[0]));
const out = {}, inn = {};
for (const t of toks) {
  if (t.t!=="id" || t.dot || t.prop) continue;
  const here = inR(t.line);
  if (!here && inSet.has(t.v)) (out[t.v] = out[t.v]||[]).push(t.line);
  if (here && decl.has(t.v) && !inSet.has(t.v)) (inn[t.v] = inn[t.v]||0, inn[t.v]++);
}
console.log("ОБЪЯВЛЕНО", inside.length, inside.map(x=>x[0]+"@"+x[1]).join(" "));
console.log("НАРУЖУ", Object.keys(out).length);
for (const k in out) console.log("  ", k, out[k].slice(0,12).join(","));
console.log("ВНУТРЬ", Object.keys(inn).length, Object.keys(inn).join(" "));
}
const main = () => {
  const banners = [];
  src.split("\n").forEach((l, n) => { if (/^\/\* =====/.test(l)) banners.push([n+1, l.replace(/=+/g,"").replace("/*","").trim()]); });
  const total = line;
  const rows = [];
  banners.forEach((b, k) => {
    const from = b[0], to = k+1 < banners.length ? banners[k+1][0]-1 : total;
    const inside = [...decl].filter(([n, l]) => l >= from && l <= to).map(x => x[0]);
    const inSet = new Set(inside);
    const out = new Set(), inn = new Set();
    for (const t of toks) {
      if (t.t !== "id" || t.dot || t.prop) continue;
      const here = t.line >= from && t.line <= to;
      if (!here && inSet.has(t.v)) out.add(t.v);
      if (here && decl.has(t.v) && !inSet.has(t.v)) inn.add(t.v);
    }
    rows.push({ from, lines: to-from+1, name: b[1].slice(0,50), decl: inside.length, out: out.size, inn: inn.size });
  });
  rows.sort((a,b)=>b.lines-a.lines);
  for (const r of rows.slice(0, +process.env.TOP || 60)) console.log(String(r.from).padStart(6), String(r.lines).padStart(5), "decl", String(r.decl).padStart(3), "out", String(r.out).padStart(3), "in", String(r.inn).padStart(3), r.name);
  console.log("decl total", decl.size, "lines", total);
};
const ranges = process.argv.slice(2).map(Number);
if (ranges.length < 2) main(); else byRanges(ranges);
