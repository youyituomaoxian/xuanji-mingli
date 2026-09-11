#!/usr/bin/env node
/* =========================================================================
 * ziwei_ext_cross.js — 紫微引擎「扩展盘面」交叉校验
 *
 * 校验对象（本轮新增/修正的算法）：
 *   ① 十四辅星 / 六煞星安星   与快照 S 数组比对       14 星 × 32 例 = 448 点
 *   ② 大限起运与区间          与快照 dec.range 比对   12 宫 × 32 例 = 384 点
 *   ③ 长生十二神              与快照 cs 比对          12 宫 × 32 例 = 384 点
 *   ④ 基础盘面（命宫/身宫/五行局/十四主星）回归
 *
 * 基准：MingLi-Bench 32 例 iztro 权威快照（经 kb-inline 内联）。
 * 运行：node _test/ziwei_ext_cross.js
 * ====================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 沙箱加载引擎（与浏览器同样的脚本顺序） ---------- */
const sb = {
  console, Math, Date, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  Boolean, Array, Object, RegExp, Error, TypeError, RangeError,
  encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout,
  document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
  navigator: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { href: 'file:///' }, fetch: () => Promise.reject(new Error('none'))
};
sb.window = sb;
vm.createContext(sb);
['ganzhi', 'astro', 'paipan', 'kb-inline', 'ziwei-rules', 'resource', 'store', 'ui', 'schools']
  .forEach(n => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', n + '.js'), 'utf8'), sb, { filename: n + '.js' }));

const { PAIPAN, SCHOOLS, GZ } = sb;
if (!sb.KB_INLINE) { console.error('缺少 kb-inline.js，请先运行 node _tools/build-kb.js'); process.exit(2); }

const cases = sb.KB_INLINE.ziwei.cases;
const AUX_NAMES = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '天马', '擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];

const tally = {
  aux: { ok: 0, tot: 0 }, dec: { ok: 0, tot: 0 }, cs: { ok: 0, tot: 0 },
  ming: { ok: 0, tot: 0 }, shen: { ok: 0, tot: 0 }, ju: { ok: 0, tot: 0 }, major: { ok: 0, tot: 0 }
};
const detail = [];
const diffs = { aux: [], dec: [], cs: [], major: [] };

cases.forEach(c => {
  const b = c.birth;
  let pan, z;
  try {
    pan = PAIPAN.compute({
      year: b.year, month: b.month, day: b.day, hour: b.hour, minute: b.minute,
      shichen: null, sex: b.gender, place: b.location || '', longitude: null,
      useTrueSolarTime: false, calendarType: 'calendar_type' in b ? b.calendar_type : 'solar',
      now: new Date(2000, 0, 1)
    });
    z = SCHOOLS.computeZiwei(pan);
  } catch (e) {
    detail.push({ case: c.case, err: e.message });
    ['aux', 'dec', 'cs', 'ming', 'shen', 'ju', 'major'].forEach(k => tally[k].tot++);
    return;
  }

  /* 我方：地支 → 数据 */
  const ours = {}, oursAux = {}, oursDec = {}, oursCs = {}, oursMajor = {};
  z.palaces.forEach(p => {
    ours[p.zhi] = p;
    oursAux[p.zhi] = (p.aux || []).map(a => a.name).sort();
    oursDec[p.zhi] = p.dec ? p.dec.range.join('-') : '';
    oursCs[p.zhi] = p.cs || '';
    oursMajor[p.zhi] = p.stars.slice().sort();
  });

  const row = { case: c.case, birth: `${b.year}-${b.month}-${b.day} ${b.hour}:${b.minute}`, ju: z.bureau.name };
  const bad = [];

  c.palaces.forEach(sp => {
    const zhi = sp.z;

    /* ① 辅星 */
    tally.aux.tot++;
    const izAux = (sp.S || []).map(s => s.n).sort();
    if (oursAux[zhi] && oursAux[zhi].join(',') === izAux.join(',')) tally.aux.ok++;
    else { bad.push(`辅星@${zhi} 我[${(oursAux[zhi] || []).join('/')}] iztro[${izAux.join('/')}]`); diffs.aux.push({ case: c.case, zhi, our: oursAux[zhi] || [], iz: izAux }); }

    /* ② 大限 */
    tally.dec.tot++;
    const izDec = (sp.dec && sp.dec.range) ? sp.dec.range.join('-') : '';
    if (oursDec[zhi] === izDec) tally.dec.ok++;
    else { bad.push(`大限@${zhi} 我[${oursDec[zhi]}] iztro[${izDec}]`); diffs.dec.push({ case: c.case, zhi, our: oursDec[zhi], iz: izDec }); }

    /* ③ 长生十二神 */
    tally.cs.tot++;
    if (oursCs[zhi] === (sp.cs || '')) tally.cs.ok++;
    else { bad.push(`长生@${zhi} 我[${oursCs[zhi]}] iztro[${sp.cs}]`); diffs.cs.push({ case: c.case, zhi, our: oursCs[zhi], iz: sp.cs }); }

    /* ④ 主星 */
    tally.major.tot++;
    const izMajor = (sp.M || []).map(s => s.n).sort();
    if ((oursMajor[zhi] || []).join(',') === izMajor.join(',')) tally.major.ok++;
    else { bad.push(`主星@${zhi} 我[${(oursMajor[zhi] || []).join('/')}] iztro[${izMajor.join('/')}]`); diffs.major.push({ case: c.case, zhi, our: oursMajor[zhi] || [], iz: izMajor }); }
  });

  /* 命宫 / 身宫 / 五行局 */
  tally.ming.tot++; tally.shen.tot++; tally.ju.tot++;
  const ourMing = GZ.ZHI[z.mingIdx], ourShen = GZ.ZHI[z.shenIdx];
  if (ourMing === c.ming) tally.ming.ok++; else bad.push(`命宫 我[${ourMing}] iztro[${c.ming}]`);
  if (ourShen === c.shen) tally.shen.ok++; else bad.push(`身宫 我[${ourShen}] iztro[${c.shen}]`);
  if (z.bureau.name === c.ju) tally.ju.ok++; else bad.push(`五行局 我[${z.bureau.name}] iztro[${c.ju}]`);

  if (bad.length) row.bad = bad;
  detail.push(row);
});

/* ---------- 报告 ---------- */
function line(label, t, unit) {
  const pct = t.tot ? (t.ok / t.tot * 100).toFixed(1) : '0.0';
  const mark = t.ok === t.tot ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${mark} ${label.padEnd(18, '　')} ${String(t.ok).padStart(4)}/${String(t.tot).padEnd(4)}  (${pct}%)  ${unit}`);
  return t.ok === t.tot;
}
console.log('\n\x1b[1m紫微引擎扩展盘面交叉校验 —— 基准：MingLi-Bench 32 例 iztro 快照\x1b[0m');
console.log(`样本：${cases.length} 例（排盘异常 ${detail.filter(d => d.err).length}）\n`);
const allOk = [
  line('十四辅星/煞星', tally.aux, '14 星 × 32 例'),
  line('大限区间', tally.dec, '12 宫 × 32 例'),
  line('长生十二神', tally.cs, '12 宫 × 32 例'),
  line('十四主星', tally.major, '12 宫 × 32 例'),
  line('命宫地支', tally.ming, '32 例'),
  line('身宫地支', tally.shen, '32 例'),
  line('五行局', tally.ju, '32 例')
].every(Boolean);

/* 差异样本（最多各 3 条，便于定位） */
Object.keys(diffs).forEach(k => {
  if (diffs[k].length) {
    console.log(`\n  ${k} 差异样本（共 ${diffs[k].length}）:`);
    diffs[k].slice(0, 3).forEach(d => console.log(`    ${d.case} @${d.zhi} 我[${Array.isArray(d.our) ? d.our.join('/') : d.our}] iztro[${Array.isArray(d.iz) ? d.iz.join('/') : d.iz}]`));
  }
});

const totalOk = Object.keys(tally).reduce((s, k) => s + tally[k].ok, 0);
const totalTot = Object.keys(tally).reduce((s, k) => s + tally[k].tot, 0);
console.log('\n' + '='.repeat(60));
console.log(`总计 pass=${totalOk} fail=${totalTot - totalOk}`);
fs.writeFileSync(path.join(__dirname, 'ziwei_ext_cross.json'), JSON.stringify({ tally, detail }, null, 1), 'utf8');
console.log('明细已写入 _test/ziwei_ext_cross.json');
process.exit(allOk ? 0 : 1);
