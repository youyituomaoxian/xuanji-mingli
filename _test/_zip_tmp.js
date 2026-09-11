const fs = require('fs');
const src = fs.readFileSync('js/app.js', 'utf8');
function grab(name) {
  const re = new RegExp('(var |function )' + name + '\\b[\\s\\S]*?\\n  \\}');
  const m = src.match(re);
  if (!m) throw new Error('未找到 ' + name);
  return m[0];
}
const code = [
  grab('ZIP_CRC_TABLE'), grab('zipCrc32'), grab('makeZip'),
  'function strBytes(s) { return new TextEncoder().encode(s); }',
  'var FLOAT_PS1 = "PS1CONTENT";',
  'var FLOAT_BAT = "@echo off\\r\\npowershell -File float-card.ps1";',
  'var json = JSON.stringify({ ok: 1, date: "2026-09-11" });',
  'var zip = makeZip([',
  '  { name: "start-float-card.bat", data: strBytes(FLOAT_BAT) },',
  '  { name: "float-card.ps1", data: strBytes("\\uFEFF" + FLOAT_PS1) },',
  '  { name: "xuanji-data.json", data: strBytes(json) },',
  '  { name: "README-使用说明.txt", data: strBytes("\\uFEFF说明") }',
  ']);',
  'fs.writeFileSync(process.argv[2], Buffer.from(zip));',
  'console.log("zip bytes:", zip.length);'
].join('\n');
const run = new Function('fs', 'path', 'window', 'global', code);
run(fs, path, global, global);
