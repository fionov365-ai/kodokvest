/* Быстрая сверка одного файла: node tests/try-one.js файл.py
   Печатает вывод настоящего python3 и вывод движка рядом.
   Служебный инструмент для разработки, в npm test не входит. */
const fs = require('fs');
const { execFileSync } = require('child_process');
require('../js/engine-mini.js');

const file = process.argv[2];
const code = fs.readFileSync(file, 'utf8');

let exp;
try { exp = execFileSync('python3', [file], { encoding: 'utf8' }); }
catch (e) { exp = '<<PYTHON ERROR>>' + (e.stderr || ''); }

const r = MiniPy.run(code);
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
