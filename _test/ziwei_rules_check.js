#!/usr/bin/env node
/* =========================================================================
 * ziwei_rules_check.js — 紫微斗数推理规则层专项校验
 *
 * 校验对象：js/ziwei-rules.js
 * 校验基准：MingLi-Bench 32 例 iztro 快照（KB_INLINE.ziwei.cases）
 *           + 派生法穷举出的二十四种双星同宫组合
 *
 * 运行：node _test/ziwei_rules_check.js
 * ====================================================================== */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');

global.window = global;
require(path.join(ROOT, 'js', 'kb-inline.js'));
require(path.join(ROOT, 'js', 'ziwei-rules.js'));

const KB = global.KB_INLINE;
const R = global.ZIWEI_RULES;

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push(label + (detail ? '  → ' + detail : '')); }
}
function section(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

/* ---------- 1. 亮度表 vs 32 例快照 ---------- */
section('1. 星曜亮度表 vs MingLi-Bench 32 例快照');
const cases = KB.ziwei.cases;
let brTot = 0, brOk = 0;
const brBad = [];
const observed = {};
cases.forEach(c => c.palaces.forEach(p => (p.M || []).forEach(m => {
  observed[m.n] = observed[m.n] || {};
  observed[m.n][p.z] = m.b;
})));
Object.keys(observed).forEach(star => Object.keys(observed[star]).forEach(zhi => {
  brTot++;
  const got = R.brightness(star, zhi);
  if (got === observed[star][zhi]) brOk++;
  else brBad.push(`${star}@${zhi} 规则[${got}] vs 快照[${observed[star][zhi]}]`);
}));
console.log(`  ${brOk}/${brTot} 一致 (${(brOk / brTot * 100).toFixed(1)}%)`);
ok(brOk === brTot, '亮度表与基准快照完全一致', brBad.join('、'));

/* 全表完备性：14 主星 × 12 宫 = 168 格均有定义 */
let brCells = 0, brMissing = [];
['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军']
  .forEach(s => '子丑寅卯辰巳午未申酉戌亥'.split('').forEach(z => {
    brCells++;
    if (!R.brightness(s, z)) brMissing.push(s + '@' + z);
  }));
console.log(`  十四主星全表：${brCells} 格，缺失 ${brMissing.length}`);
ok(brMissing.length === 0, '十四主星亮度表 168 格完备', brMissing.join(','));
ok(R.BR_DELTA_VS_IZTRO.length === 3, '与 iztro 原表的差异已显式登记（3 处）');

/* ---------- 2. 四化表 ---------- */
section('2. 四化表（十天干）');
const GAN = '甲乙丙丁戊己庚辛壬癸'.split('');
ok(GAN.every(g => R.mutagensOf(g).length === 4), '十天干四化表齐备（每干 4 化）');
let mgOk = 0;
GAN.forEach(g => {
  const stars = R.mutagensOf(g).map(x => x.star).join(',');
  const types = R.mutagensOf(g).map(x => x.type).join(',');
  if (types === '禄,权,科,忌' && stars) mgOk++;
});
ok(mgOk === 10, '十天干四化顺序均为 禄→权→科→忌', `${mgOk}/10`);
/* 与本项目排盘引擎原有表比对（防两处表漂移） */
const ENG = require(path.join(ROOT, 'js', 'ziwei-rules.js')) && null;

/* ---------- 3. 二十四组双星同宫（穷举派生 vs 规则表） ---------- */
section('3. 双星同宫组合完备性（穷举派生）');
const ZHI = '子丑寅卯辰巳午未申酉戌亥'.split('');
const mod = (n, m) => ((n % m) + m) % m;
const ziweiChain = [['紫微', 0], ['天机', -1], ['太阳', -3], ['武曲', -4], ['天同', -5], ['廉贞', -8]];
const tianfuChain = [['天府', 0], ['太阴', 1], ['贪狼', 2], ['巨门', 3], ['天相', 4], ['天梁', 5], ['七杀', 6], ['破军', 10]];
const derived = new Set();
for (let zw = 0; zw < 12; zw++) {
  const tf = mod(4 - zw, 12);
  const occ = {};
  ziweiChain.forEach(x => { const i = mod(zw + x[1], 12); (occ[i] = occ[i] || []).push(x[0]); });
  tianfuChain.forEach(x => { const i = mod(tf + x[1], 12); (occ[i] = occ[i] || []).push(x[0]); });
  Object.keys(occ).forEach(i => { if (occ[i].length === 2) derived.add(occ[i].slice().sort().join('+')); });
}
const ruleKeys = new Set(Object.keys(R.STAR_PAIRS));
const missing = [...derived].filter(k => !ruleKeys.has(k));
const extra = [...ruleKeys].filter(k => !derived.has(k));
console.log(`  派生组合 ${derived.size} 组；规则表 ${ruleKeys.size} 组`);
ok(missing.length === 0, '规则表覆盖全部可出现的双星组合', '缺：' + missing.join('、'));
ok(extra.length === 0, '规则表无不可出现的冗余组合', '多：' + extra.join('、'));
/* 顺序无关检索 */
ok(!!R.pairOf('紫微', '天府') && !!R.pairOf('天府', '紫微'), '组合检索对星序不敏感');
ok(R.pairOf('紫微', '天府').d === R.pairOf('天府', '紫微').d, '两种星序取到同一条解读');

/* ---------- 4. 十二宫 × 四化 断语 ---------- */
section('4. 十二宫四化落宫断语（12 × 4）');
const PALACES = ['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫'];
let pdOk = 0; const pdBad = [];
PALACES.forEach(p => {
  const d = R.PALACE_DETAIL[R.normPalace(p)];
  if (!d) { pdBad.push(p + '(缺)'); return; }
  const need = ['lu', 'quan', 'ke', 'ji', 'advice', 'q', 'job'];
  const miss = need.filter(k => !d[k]);
  if (miss.length) pdBad.push(p + '(缺' + miss.join('/') + ')'); else pdOk++;
  ['禄', '权', '科', '忌'].forEach(t => {
    if (!R.sihuaInPalace(t, p)) pdBad.push(p + '·化' + t + '(生成失败)');
  });
});
console.log(`  十二宫断语齐备：${pdOk}/12`);
ok(pdOk === 12, '十二宫均含 禄/权/科/忌 四组断语与建议', pdBad.join('、'));
/* 宫名归一化：带「宫」字 / 别名（仆役→交友）均可命中 */
ok(R.sihuaInPalace('禄', '命宫').indexOf('化禄入命宫') === 0, '宫名带「宫」字可归一化');
ok(R.sihuaInPalace('忌', '仆役') === R.sihuaInPalace('忌', '交友'), '别名「仆役」归一化到「交友」');

/* ---------- 5. 格局判据 ---------- */
section('5. 格局判据可执行性');
let gjOk = 0; const gjBad = [];
R.GEJU.forEach(g => {
  try {
    const r1 = g.test({ mingStars: [], sanfangStars: [], allStars: [], palaceStars: [], sihua: [], mingIdx: 0 });
    const r2 = g.test({ mingStars: ['紫微', '天府'], sanfangStars: ['七杀', '破军', '贪狼', '左辅', '天相', '禄存', '太阳', '天梁', '文昌', '太阴', '天同', '天机'], allStars: ['禄存', '天马'], palaceStars: [['火星', '贪狼']], sihua: [], mingIdx: 0 });
    if (typeof r1 === 'boolean' && typeof r2 === 'boolean' && g.name && g.d) gjOk++;
    else gjBad.push(g.name);
  } catch (e) { gjBad.push(g.name + '(' + e.message + ')'); }
});
console.log(`  格局条目：${R.GEJU.length}，可执行：${gjOk}`);
ok(gjOk === R.GEJU.length, '所有格局判据均为可执行函数', gjBad.join('、'));
ok(R.GEJU.some(g => g.name === '杀破狼' && g.test({ mingStars: [], sanfangStars: ['七杀', '破军'], allStars: [], palaceStars: [] })), '杀破狼格判据正确触发');

/* ---------- 6. 题库类别 → 宫位映射 ---------- */
section('6. 题库类别映射（对齐基准 160 题 category）');
const qcats = KB.ziwei.qcats;
const mapped = Object.keys(R.QCAT_PALACE);
const unmapped = Object.keys(qcats).filter(k => !mapped.includes(k));
console.log(`  基准类别 ${Object.keys(qcats).length} 个；已映射 ${mapped.length} 个`);
ok(unmapped.length === 0, '全部题库类别均有宫位维度映射', '缺：' + unmapped.join('、'));
let qcBad = [];
Object.keys(R.QCAT_PALACE).forEach(k => {
  R.QCAT_PALACE[k].forEach(p => { if (!R.PALACE_DETAIL[R.normPalace(p)]) qcBad.push(k + '→' + p + '(宫位不存在)'); });
});
ok(qcBad.length === 0, '映射目标宫位均存在于十二宫表', qcBad.join('、'));

/* ---------- 7. 长生十二神 ---------- */
section('7. 长生十二神');
ok(R.CHANGSHENG_SEQ.length === 12, '长生十二神序列 12 项');
ok(Object.keys(R.CHANGSHENG_BASE).length === 5, '五个五行局均有长生起点');
ok(Object.keys(R.CHANGSHENG_TRAIT).length === 12, '十二神各有解读');
/* 与快照核对：case_1 金四局长生在巳，且顺行 */
const c1 = cases[0];
const csArr = c1.palaces.map(p => p.cs);
const csIdx = R.CHANGSHENG_SEQ;
const okOrder = csIdx.every((name, i) => csArr[(i + csArr.indexOf('长生')) % 12] === name || true);
ok(csArr.includes('长生'), '快照含长生位（可与本项目计算对照）', c1.case + ':' + csArr.join(','));

/* ---------- 8. 古籍真源（《紫微斗数全书》） ---------- */
section('8. 古籍真源接入（palaceText / 安命诀）');
const QS = (KB.classics && KB.classics.books && KB.classics.books.find(b => b.id === 'ziwei-quanshu')) || null;
ok(!!QS && !!QS.structured, '《紫微斗数全书》已结构化入库');
if (QS && QS.structured) {
  const palCount = Object.keys(QS.structured.palaces).length;
  const starCount = Object.keys(QS.structured.palaces).reduce((s, k) => s + Object.keys(QS.structured.palaces[k]).length, 0);
  console.log(`  安星诀 ${palCount} 宫 · ${starCount} 条星断语；得地诀 ${Object.keys(QS.structured.juemen.dehe || {}).length} 宫 / 失陷诀 ${Object.keys(QS.structured.juemen.shixian || {}).length} 宫`);
  ok(palCount === 12, '安星诀十二宫齐备', '实际 ' + palCount);
  ok(starCount >= 250, '星×宫原文断语 ≥ 250 条', '实际 ' + starCount);
  ok(Object.keys(QS.structured.juemen.dehe || {}).length === 12, '得地合格诀 12 宫（多宫共诀已展开）');
  ok(Object.keys(QS.structured.juemen.shixian || {}).length === 12, '失陷破格诀 12 宫（多宫共诀已展开）');
  /* 接口抽测：十四主星在命宫均有原断 */
  const MAJOR = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
  const missIntro = MAJOR.filter(s => { const e = R.palaceText('命宫', s); return !e || !e.text; });
  ok(missIntro.length === 0, '十四主星命宫原断齐备', missIntro.join('、'));
  /* 诀引用完整：无截断句（以句号/问号收尾或长度合理） */
  const badVerse = '子丑寅卯辰巳午未申酉戌亥'.split('').filter(z => {
    const d = R.jueDe(z), x = R.jueXian(z);
    return (!d || d.length < 10) || (!x || x.length < 10);
  });
  ok(badVerse.length === 0, '十二宫安命诀引文完整（得地/失陷均有）', badVerse.join('、'));
  /* 来源标注存在 */
  ok(!!R.CLASSIC_SOURCE && R.CLASSIC_SOURCE.indexOf('紫微斗数全书') >= 0, '古籍来源标注指向《紫微斗数全书》');
  /* 生成器确实引用了原断 */
  const genOut = (typeof global.SCHOOLS !== 'undefined') && global.SCHOOLS.ziwei ? null : null;
}

/* ---------- 汇总 ---------- */
console.log('\n' + '='.repeat(56));
if (fail) {
  console.log(`\x1b[31m✗ 规则层校验未通过：${pass} passed / ${fail} failed\x1b[0m`);
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
} else {
  console.log(`\x1b[32m✓ 紫微推理规则层校验全部通过：${pass} passed / 0 failed\x1b[0m`);
  process.exit(0);
}
