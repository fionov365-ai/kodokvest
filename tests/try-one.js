/* Быстрая сверка одного файла: node tests/try-one.js файл.py
   Печатает вывод настоящего python3 и вывод движка рядом.
   Служебный инструмент для разработки, в npm test не входит. */
const fs = require('fs');
const { execFileSync } = require('child_process');
require('../js/engine-mini.js');

const file = process.argv[2];
const raw = fs.readFileSync(file, 'utf8');
/* строки «#!stdin: текст» в начале файла — ответы для input() */
const stdin = [];
const data = {};
const code = raw.split('\n').filter(l => {
  const m = /^#!stdin: ?(.*)$/.exec(l);
  if (m) { stdin.push(m[1]); return false; }
  /* «#!data: имя.csv» — файл рядом с программой кладём и на диск python3,
     и в память движка: так сверяются уроки с файлами данных */
  const d = /^#!data: ?(.+)$/.exec(l);
  if (d) { data[d[1].trim()] = fs.readFileSync(require('path').join(require('path').dirname(file), d[1].trim()), 'utf8'); return false; }
  return true;
}).join('\n');
fs.writeFileSync(file + '.run.py', code);

let exp;
try { exp = execFileSync('python3', [file + '.run.py'], { encoding: 'utf8',
  input: stdin.length ? stdin.join('\n') + '\n' : '' }); }
catch (e) { exp = '<<PYTHON ERROR>>' + (e.stderr || ''); }

const r = MiniPy.run(code, { stdin: stdin, files: data });
const got = r.error
  ? '<<ERR ' + r.error.kind + ': ' + r.error.msg + ' (строка ' + r.error.line + ')>>'
  : r.output;

if (got === exp) { console.log('СОВПАЛО\n' + got); process.exit(0); }
console.log('--- python3 ---\n' + exp);
console.log('--- движок ---\n' + got);
const a = exp.split('\n'), b = got.split('\n');
for (let i = 0; i < Math.max(a.length, b.length); i++)
  if (a[i] !== b[i]) console.log('строка ' + (i + 1) + ':\n  python3: ' + JSON.stringify(a[i]) + '\n  движок : ' + JSON.stringify(b[i]));
process.exit(1);
