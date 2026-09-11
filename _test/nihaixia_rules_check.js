#!/usr/bin/env node
/* =========================================================================
 * nihaixia_rules_check.js — 倪海厦「天纪」规则层专项校验
 *
 * 校验对象：js/nihaixia-rules.js + KB_INLINE.nihaixia / nihaixiaStyle
 * 校验基准：nihaixia 仓库《天纪体系》一节 + expression_style.md（经内联）
 * 运行：node _test/nihaixia_rules_check.js
 * ====================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

global.window = global;
require(path.join(ROOT, 'js', 'kb-inline.js'));
require(path.join(ROOT, 'js', 'nihaixia-rules.js'));
require(path.join(ROOT, 'js', 'ganzhi.js'));
require(path.join(ROOT, 'js', 'astro.js'));
require(path.join(ROOT, 'js', 'paipan.js'));
require(path.join(ROOT, 'js', 'resource.js'));
require(path.join(ROOT, 'js', 'store.js'));
require(path.join(ROOT, 'js', 'ui.js'));
require(path.join(ROOT, 'js', 'ziwei-rules.js'));
require(path.join(ROOT, 'js', 'schools.js'));

const KB = global.KB_INLINE;
const N = global.NIHAIXIA_RULES;

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label, detail) {
  if (cond) pass++;
  else { fail++; failures.push(label + (detail ? '  → ' + detail : '')); }
}
function section(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

/* ---------- 1. 六十四卦索引 ---------- */
section('1. 六十四卦人事应用索引（由仓库卦表派生）');
const idx = N.guaIndex();
const keys = Object.keys(idx);
console.log(`  索引条目 ${keys.length}`);
ok(keys.length === 64, '六十四卦索引齐全（64 条）', '实际 ' + keys.length);
const noStar = keys.filter(k => /\*/.test(idx[k].name + idx[k].text));
ok(noStar.length === 0, '卦名与断语无 markdown 粗体残留', noStar.join('、'));
const bad = keys.filter(k => !idx[k].name || !idx[k].text);
ok(bad.length === 0, '每条均有卦名与人事应用断语', bad.join('、'));
ok(!!N.guaByName('地天泰'), '按卦名检索可用（地天泰）');
ok(N.guaByName('泰') === N.guaByName('地天泰'), '卦名模糊检索与全名等价');

/* ---------- 2. 起卦（梅花易数时间起卦法） ---------- */
section('2. 起卦确定性与完备性');
let nulls = 0, tot = 0; const seen = new Set();
for (let y = 0; y < 12; y++) for (let t = 0; t < 12; t++) {
  const g = N.qiGua({ yearZhiIdx: y, month: 4, day: 7, shichenIdx: t });
  tot++;
  if (!g.gua) nulls++; else seen.add(g.gua.name);
}
console.log(`  144 组年支×时辰组合 → 未匹配 ${nulls}，覆盖 ${seen.size} 种卦`);
ok(nulls === 0, '全部组合均可得卦', nulls + ' 组未匹配');
ok(seen.size === 64, '覆盖全部六十四卦', '实际 ' + seen.size);
/* 同参复算一致（确定性） */
const g1 = N.qiGua({ yearZhiIdx: 2, month: 4, day: 7, shichenIdx: 8 });
const g2 = N.qiGua({ yearZhiIdx: 2, month: 4, day: 7, shichenIdx: 8 });
ok(g1.name === g2.name && g1.moving === g2.moving, '同参复算结果一致（可复现）');
console.log('  样例（寅年四月初七申时）: ' + g1.name + '，动爻 ' + g1.moving);

/* ---------- 3. 天机道：十四主星 / 十二宫表 ---------- */
section('3. 天机道 · 十四主星与十二宫主管表');
const nkb = KB.nihaixia || {};
ok((nkb.stars14 || []).length === 14, '十四主星表 14 行', '实际 ' + (nkb.stars14 || []).length);
ok((nkb.palaces12 || []).length === 12, '十二宫主管表 12 行', '实际 ' + (nkb.palaces12 || []).length);
const STARS = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
const missStar = STARS.filter(s => !N.starTraitTianji(s));
ok(missStar.length === 0, '十四主星均可按名查到倪师定性', missStar.join('、'));
const PALS = ['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫'];
const missPal = PALS.filter(p => !N.palaceDutyTianji(p));
ok(missPal.length === 0, '十二宫均可查到天纪主管', missPal.join('、'));

/* ---------- 4. 地脉道 ---------- */
section('4. 地脉道 · 地理五要与原书卦例');
ok((N.DILI5 || []).length === 5, '地理五要齐备（龙穴砂水向）', '实际 ' + (N.DILI5 || []).length);
const dm = nkb.dimaiGua || {};
const dmKeys = Object.keys(dm);
console.log('  原书卦例 ' + dmKeys.length + ' 条: ' + dmKeys.map(k => k + '卦').join('、'));
ok(dmKeys.length === 5, '地脉道原书卦例 5 条（乾屯需豫履）', '实际 ' + dmKeys.length);
ok(!!N.dimaiGuaOf('需'), '卦例可按卦名取用');

/* ---------- 5. 倪师话术（口述 DNA） ---------- */
section('5. 倪师话术池（expression_style.md）');
const st = KB.nihaixiaStyle || {};
const pools = st.pools || {};
const poolNames = Object.keys(pools);
console.log('  池: ' + poolNames.map(k => k + ':' + pools[k].length).join(' '));
ok(poolNames.length >= 5, '口头禅分池齐备（反问/断言/引出/承接/情绪）', '实际 ' + poolNames.length);
ok(poolNames.every(k => pools[k].length > 0), '每池非空');
/* 池应忠实反映原文（原文自信断言里本就含「一剂就好」，属医疗语境专用），
   真正的约束是 voice() 在命理语境下必须过滤 —— 见下一断言 */
const med = ['一剂就好', '气死人'];
const inPool = poolNames.filter(k => pools[k].some(x => med.includes(x)));
console.log('  池中含医疗类口头禅的池（原文如此，由 voice() 过滤）: ' + (inPool.join('、') || '无'));
ok(poolNames.every(k => Array.isArray(pools[k])), '口头禅池结构完整（数组）');
/* voice() 对命理语境的过滤 */
let badVoice = 0;
for (let i = 0; i < 40; i++) {
  const v = N.voice('s' + i);
  if (med.includes(v.lead) || med.includes(v.ask) || med.includes(v.assert) || med.includes(v.mood)) badVoice++;
}
ok(badVoice === 0, 'voice() 命理语境不取医疗类口头禅', badVoice + ' 次命中');
const v1 = N.voice('seedX'), v2 = N.voice('seedX');
ok(v1.lead === v2.lead && v1.assert === v2.assert, 'voice() 确定性（同参同果）');

/* ---------- 6. 分区生成器端到端 ---------- */
section('6. nihaixia() 分区生成端到端');
let pan, out;
try {
  pan = global.PAIPAN.compute({
    year: 1974, month: 4, day: 28, hour: 16, minute: 40,
    shichen: null, sex: 'male', place: '', longitude: null,
    useTrueSolarTime: false, calendarType: 'solar', now: new Date(2026, 0, 1)
  });
  out = global.SCHOOLS.nihaixia(pan, global.RESOURCE.get());
} catch (e) {
  ok(false, 'nihaixia() 生成不抛错', e.message);
  console.log('\n' + (fail ? '✗ 未通过' : '✓ 通过'));
  process.exit(fail ? 1 : 0);
}
const labels = (out.html.match(/<div class="rsec__label">([\s\S]*?)<\/div>/g) || []).map(s => s.replace(/<[^>]+>/g, '').trim());
console.log('  章节 ' + labels.length + ': ' + labels.join(' | '));
const need = ['天纪 · 三层总纲', '天命 · 先天禀赋', '天机道 · 紫微斗数', '人事 · 性格与抉择',
  '人间道 · 断事取卦', '地理 · 环境与方位', '流年 · ', '命格核心关键词'];
const missSec = need.filter(k => !labels.some(l => l.indexOf(k) >= 0));
ok(missSec.length === 0, '天纪三层结构 + 原有四层框架齐备', '缺: ' + missSec.join('、'));
['天机道', '人间道', '地脉道'].forEach(k => {
  if (out.html.indexOf(k) < 0) ok(false, '含「' + k + '」内容', '未出现');
  else ok(true, '含「' + k + '」内容');
});
ok(out.html.indexOf('梅花易数时间起卦法') >= 0, '起卦法来源已如实标注');
ok(out.html.indexOf('属本项目的桥接实现') >= 0, '「倪氏八字/断事为桥接而非原书」的诚实边界已标注');
ok(out.html.indexOf('</div>') === -1 || out.html.indexOf('&lt;/div&gt;') < 0, '无未闭合标签泄漏',
  '出现位置 ' + out.html.indexOf('</div>'));

/* ---------- 汇总 ---------- */
console.log('\n' + '='.repeat(56));
if (fail) {
  console.log(`\x1b[31m✗ 天纪规则层校验未通过：${pass} passed / ${fail} failed\x1b[0m`);
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
} else {
  console.log(`\x1b[32m✓ 倪海厦天纪规则层校验全部通过：${pass} passed / 0 failed\x1b[0m`);
  process.exit(0);
}
