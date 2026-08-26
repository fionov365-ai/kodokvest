const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

/* своя папка под временные .py — /tmp может быть занят чужими файлами */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kodokvest-'));
require('../js/engine-mini.js');
const MiniPy = globalThis.MiniPy;

const raw = fs.readFileSync(__dirname + '/programs.txt', 'utf8');
const cases = [];
let cur = null;
for (const line of raw.split('\n')) {
  const m = /^### (.+)$/.exec(line);
  if (m) { cur = { name: m[1], code: [] }; cases.push(cur); continue; }
  if (cur) cur.code.push(line);
}
cases.forEach(c => c.code = c.code.join('\n').replace(/\n+$/, '') + '\n');

let pass = 0, fail = 0;
for (const c of cases) {
  for (const n of fs.readdirSync(TMP))
    try { fs.rmSync(path.join(TMP, n), { recursive: true, force: true }); } catch(e){}
  const f = path.join(TMP, 't_' + c.name + '.py');
  fs.writeFileSync(f, c.code);
  let expected;
  try {
    /* cwd — временная папка: программы, которые создают файлы, не мусорят в проекте */
    expected = execFileSync('python3', [f], { encoding: 'utf8', cwd: TMP });
  } catch (e) {
    expected = '<<PYTHON ERROR>>' + (e.stderr || '');
  }
  const r = MiniPy.run(c.code);
  /* файлы, созданные программой, живут только внутри своего запуска */
  const got = r.error ? '<<ERR ' + r.error.kind + ': ' + r.error.msg + ' (строка ' + r.error.line + ')>>' : r.output;
  if (got === expected) { pass++; }
  else {
    fail++;
    console.log('--- FAIL: ' + c.name);
    console.log('  ожидалось: ' + JSON.stringify(expected));
    console.log('  получено : ' + JSON.stringify(got));
  }
}
console.log('\npass ' + pass + ' / fail ' + fail);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch(e){}
process.exit(fail ? 1 : 0);
