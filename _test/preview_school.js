#!/usr/bin/env node
/* =========================================================================
 * preview_school.js — 分区解读「纯文本预览」（QA 用）
 *
 * 用途：不开浏览器，直接把某个流派生成的解读渲染成纯文本，
 *       便于校对章节完整性、文案质量与新增解析模块是否生效。
 *
 * 运行：
 *   node _test/preview_school.js                  # 默认 ziwei + 内置样例（1974-04-28 16:40 男）
 *   node _test/preview_school.js nihaixia
 *   node _test/preview_school.js ziwei 1988 2 15 10 30 female
 *   node _test/preview_school.js ziwei --sections  # 仅列章节
 * ====================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

const argv = process.argv.slice(2);
const school = argv[0] || 'ziwei';
const nums = argv.slice(1).filter(a => /^\d+$/.test(a)).map(Number);
const rest = argv.slice(1).filter(a => !/^\d+$/.test(a));
const sexArg = rest.find(a => /male|female|男|女/.test(a));
const opts = {
  year: nums[0] || 1974, month: nums[1] || 4, day: nums[2] || 28,
  hour: nums[3] != null ? nums[3] : 16, minute: nums[4] != null ? nums[4] : 40
};
const onlySections = rest.includes('--sections');

const sb = {
  console, Math, Date, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  Boolean, Array, Object, RegExp, Error, TypeError, RangeError,
  encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout,
  document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
  navigator: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { href: 'file:///' }, fetch: () => Promise.reject(new Error('none'))
};
sb.window = sb; vm.createContext(sb);
['ganzhi', 'astro', 'paipan', 'kb-inline', 'ziwei-rules', 'nihaixia-rules', 'resource', 'store', 'ui', 'schools'].forEach(n =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', n + '.js'), 'utf8'), sb, { filename: n + '.js' }));

const pan = sb.PAIPAN.compute({
  year: opts.year, month: opts.month, day: opts.day, hour: opts.hour, minute: opts.minute,
  shichen: null, sex: sexArg === 'female' || sexArg === '女' ? 'female' : 'male',
  place: '', longitude: null, useTrueSolarTime: false, calendarType: 'solar', now: new Date(2026, 0, 1)
});
const res = sb.RESOURCE.get();
const out = sb.SCHOOLS[school](pan, res);

console.log(`\n【${out.title}】  ${opts.year}-${opts.month}-${opts.day} ${opts.hour}:${String(opts.minute).padStart(2, '0')} ${sexArg === 'female' ? '女' : '男'}`);
console.log('关键词：' + out.keywords.join(' / '));
console.log('HTML 长度：' + out.html.length + ' 字符');

/* 章节清单 */
const labels = (out.html.match(/<div class="rsec__label">([\s\S]*?)<\/div>/g) || [])
  .map(s => s.replace(/<[^>]+>/g, '').trim());
console.log('\n章节清单（' + labels.length + '）：');
labels.forEach((l, i) => console.log(`  ${String(i + 1).padStart(2)}. ${l}`));
if (onlySections) process.exit(0);

/* 纯文本正文 */
function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<\/tr>/g, '\n')
    .replace(/<\/t[dh]>/g, ' │ ')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .split('\n').map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s && s !== '│')
    .join('\n');
}
console.log('\n' + '─'.repeat(72) + '\n');
console.log(toText(out.html));
