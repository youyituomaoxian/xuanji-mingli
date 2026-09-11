#!/usr/bin/env node
/* similarity_check.js — 解读雷同度诊断：两份差异极大的命盘，算生成文本的重复行占比 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
['kb-inline','ganzhi','astro','paipan','resource','store','ui','ziwei-rules','nihaixia-rules','schools']
  .forEach(n => require(path.join(ROOT, 'js', n + '.js')));

function gen(o) {
  const pan = global.PAIPAN.compute(Object.assign({ shichen: null, longitude: null, useTrueSolarTime: false, calendarType: 'solar', now: new Date(2026, 0, 1) }, o));
  return global.SCHOOLS.ziwei(pan, global.RESOURCE.get());
}
function lines(html) {
  return html.replace(/<[^>]+>/g, '\n').split('\n').map(s => s.replace(/\s+/g, '').trim()).filter(s => s.length >= 8);
}
const A = gen({ year: 1974, month: 4, day: 28, hour: 16, minute: 40, sex: 'male' });
const B = gen({ year: 1996, month: 11, day: 3, hour: 6, minute: 15, sex: 'female' });
const a = lines(A.html), b = lines(B.html);
const setB = new Set(b);
const dup = a.filter(l => setB.has(l));
console.log('盘A（1974 男 甲寅）', A.keywords.join('/'));
console.log('盘B（1996 女 丙子）', B.keywords.join('/'));
console.log('盘A 行数 ' + a.length + ' | 盘B 行数 ' + b.length + ' | 完全相同行 ' + dup.length + ' → 雷同率 ' + (dup.length / Math.min(a.length, b.length) * 100).toFixed(1) + '%');
console.log('\n雷同样例（前 8 条）：');
dup.slice(0, 8).forEach(l => console.log('  · ' + l.slice(0, 52)));
