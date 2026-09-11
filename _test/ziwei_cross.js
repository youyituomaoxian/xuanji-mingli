/* 交叉校验：自研紫微引擎 vs MingLi-Bench 的 32 例 iztro 权威快照
   对比维度：命宫地支 / 身宫地支 / 五行局 / 14 主星地支分布
   输出：_test/ziwei_cross.json （差异明细） */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SNAP = 'I:/workbuddy/公司分析/_skills/MingLi-Bench/data/fortune_api_results.json';

/* ---------- 加载引擎 ---------- */
const sb = {
  console, Math, Date, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  Boolean, Array, Object, RegExp, Error, TypeError, RangeError,
  encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout,
  document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
  navigator: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { href: 'file:///' }, fetch: () => Promise.reject(new Error('none'))
};
sb.window = sb; vm.createContext(sb);
['ganzhi', 'astro', 'paipan', 'resource', 'store', 'ui', 'schools'].forEach(n =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', n + '.js'), 'utf8'), sb, { filename: n + '.js' }));

const { PAIPAN, SCHOOLS, GZ, ASTRO } = sb;

/* iztro 宫名 → 本项目宫名 */
const IZTRO2OURS = { '仆役': '交友', '官禄': '官禄', '命宫': '命宫' };
/* 我方侧：把 palaces 里每个宫的地支 → 星名数组 */
function ourStarsByZhi(z) {
  const m = {};
  z.palaces.forEach(p => { m[p.zhi] = p.stars.slice(); });
  return m;
}
/* iztro 侧 */
function iztroStarsByZhi(ch) {
  const m = {};
  ch.palaces.forEach(p => {
    m[p.earthlyBranch] = (p.majorStars || []).map(s => s.name).filter(Boolean);
  });
  return m;
}

const raw = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
const rows = [];
let okAll = 0;

raw.forEach((c, idx) => {
  const ch = (c.api_response || {}).data && c.api_response.data.data;
  if (!ch) return;
  const bi = c.birth_info;
  let pan, z, err = null;
  try {
    pan = PAIPAN.compute({
      year: bi.year, month: bi.month, day: bi.day,
      hour: bi.hour, minute: bi.minute,
      shichen: null, sex: bi.gender,
      place: bi.location || '', longitude: null,
      useTrueSolarTime: false, calendarType: 'solar',
      now: new Date(2000, 0, 1)
    });
    z = SCHOOLS.computeZiwei(pan);
  } catch (e) { err = e.message; }

  const row = { case: c.case_id, birth: `${bi.year}-${bi.month}-${bi.day} ${bi.hour}:${String(bi.minute).padStart(2, '0')} ${bi.gender}` };

  if (err) { row.err = err; rows.push(row); return; }

  /* 我方命宫/身宫地支 */
  row.ourMing = GZ.ZHI[z.mingIdx];
  row.ourShen = GZ.ZHI[z.shenIdx];
  row.izMing = ch.earthlyBranchOfSoulPalace;
  row.izShen = ch.earthlyBranchOfBodyPalace;
  row.ourJu = z.bureau.name;
  row.izJu = ch.fiveElementsClass;
  row.ourLunar = `${pan.input.lunar.month}/${pan.input.lunar.day}${pan.input.lunar.leap ? '闰' : ''}`;
  row.izLunar = ch.lunarDate;

  /* 主星分布对比 */
  const ours = ourStarsByZhi(z), izs = iztroStarsByZhi(ch);
  const allZhi = GZ.ZHI;
  const diff = [];
  allZhi.forEach(zz => {
    const a = (ours[zz] || []).slice().sort().join(' ');
    const b = (izs[zz] || []).slice().sort().join(' ');
    if (a !== b) diff.push({ zhi: zz, our: a || '(空)', iztro: b || '(空)' });
  });
  row.starDiff = diff;
  row.mingOk = row.ourMing === row.izMing;
  row.shenOk = row.ourShen === row.izShen;
  row.juOk = row.ourJu === row.izJu;
  row.starsOk = diff.length === 0;
  if (row.mingOk && row.shenOk && row.juOk && row.starsOk) okAll++;
  rows.push(row);
});

/* ---------- 报告 ---------- */
console.log('样本数: ' + rows.length + '（排盘异常 ' + rows.filter(r => r.err).length + '）\n');
const cnt = { ming: 0, shen: 0, ju: 0, stars: 0 };
rows.forEach(r => { if (r.mingOk) cnt.ming++; if (r.shenOk) cnt.shen++; if (r.juOk) cnt.ju++; if (r.starsOk) cnt.stars++; });
const n = rows.filter(r => !r.err).length;
console.log('=== 字段一致率（分母 ' + n + '）===');
console.log('  命宫地支 : ' + cnt.ming + '/' + n + '  (' + (cnt.ming / n * 100).toFixed(1) + '%)');
console.log('  身宫地支 : ' + cnt.shen + '/' + n + '  (' + (cnt.shen / n * 100).toFixed(1) + '%)');
console.log('  五行局   : ' + cnt.ju + '/' + n + '  (' + (cnt.ju / n * 100).toFixed(1) + '%)');
console.log('  主星分布 : ' + cnt.stars + '/' + n + '  (' + (cnt.stars / n * 100).toFixed(1) + '%)');
console.log('  四项全对 : ' + okAll + '/' + n);

console.log('\n=== 前 8 例明细 ===');
rows.slice(0, 8).forEach(r => {
  if (r.err) { console.log(`  ${r.case} ERR ${r.err}`); return; }
  console.log(`  ${r.case} ${r.birth}`);
  console.log(`    命宫 我=${r.ourMing} iztro=${r.izMing} ${r.mingOk ? '✓' : '✗'} | 身宫 我=${r.ourShen} iztro=${r.izShen} ${r.shenOk ? '✓' : '✗'} | 局 我=${r.ourJu} iztro=${r.izJu} ${r.juOk ? '✓' : '✗'}`);
  console.log(`    农历 我=${r.ourLunar} iztro=${r.izLunar}`);
  if (r.starDiff.length) {
    console.log('    主星差异 ' + r.starDiff.length + ' 宫:');
    r.starDiff.slice(0, 4).forEach(d => console.log(`      ${d.zhi}: 我[${d.our}] iztro[${d.iztro}]`));
  } else console.log('    主星分布 ✓ 完全一致');
});

fs.writeFileSync(path.join(__dirname, 'ziwei_cross.json'), JSON.stringify(rows, null, 1), 'utf8');
console.log('\n明细已写入 _test/ziwei_cross.json');

/* ---------- 标准回归断言（4 字段 × N 例）---------- */
var tPass = cnt.ming + cnt.shen + cnt.ju + cnt.stars;
var tFail = 4 * n - tPass;
console.log('\n总计 pass=' + tPass + ' fail=' + tFail);
process.exit(tFail ? 1 : 0);
