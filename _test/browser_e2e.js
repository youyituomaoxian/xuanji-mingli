#!/usr/bin/env node
/* =========================================================================
 * browser_e2e.js — 浏览器端到端验证（问题1/2/3 三项收口）
 *
 * 验证点：
 *   ① 三种打开方式下左下角资源状态均「正常」（问题3）
 *   ② 紫微分区生成结果含「单宫详解 / 星性组合解读 / 流年四化」（问题1）
 *   ③ 倪海厦分区生成结果含「天机道 / 人间道 / 地脉道」（问题2）
 * 运行：NODE_PATH=<node_modules> node _test/browser_e2e.js
 * ====================================================================== */
const { chromium } = require('playwright');

const ROOT = 'I:/workbuddy/公司分析';
const PAGE = encodeURIComponent('玄学工作台') + '/index.html';
const CASES = [
  { label: '① file:// 直接打开', url: 'file:///' + ROOT.replace(/\\/g, '/') + '/' + PAGE },
  { label: '② 服务器根=公司分析（正确）', url: 'http://127.0.0.1:8124/' + PAGE },
  { label: '③ 服务器根=玄学工作台（误用）', url: 'http://127.0.0.1:8125/index.html' }
];

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; failures.push(label + (detail ? ' → ' + detail : '')); console.log('  ✗ ' + label + (detail ? ' → ' + detail : '')); }
}

(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });

  for (const c of CASES) {
    console.log('\n' + c.label);
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await ctx.newPage();
    try {
      await p.goto(c.url, { waitUntil: 'load', timeout: 15000 });
      await p.waitForTimeout(2500);

      /* ① 资源状态 */
      const snap = await p.evaluate(() => window.RESOURCE && window.RESOURCE.get());
      ok(!!snap, 'RESOURCE 已加载');
      ['nihaixia', 'bazi', 'ziwei', 'fortune'].forEach(k => {
        ok(snap[k] && snap[k].status === 'ok', k + ' 状态正常（' + (snap[k] ? snap[k].origin : '—') + '）',
          snap[k] ? snap[k].detail.slice(0, 60) : 'missing');
      });
      const navTxt = ((await p.textContent('#navResStatus')) || '').replace(/\s+/g, '');
      ok(navTxt.indexOf('失败') < 0, '左下角无「失败」字样');

      /* 建档（generate() 依赖「命盘档案」中的记录）→ 生成 */
      await p.click('#btnFillDemo').catch(() => {});
      await p.waitForTimeout(300);
      await p.fill('#castName', 'E2E测试');
      await p.click('#btnSaveCast');
      await p.waitForTimeout(600);
      await p.click('[data-view="ziwei"]');
      await p.click('[data-generate="ziwei"]');
      await p.waitForTimeout(1200);
      const zwHtml = await p.evaluate(() => (document.querySelector('[data-view="ziwei"] .result') || document.querySelector('[data-view="ziwei"]')).innerHTML);
      const zwTxt = zwHtml.replace(/<[^>]+>/g, '');
      /* ② 紫微新增解析模块 */
      ok(zwTxt.indexOf('单宫详解') >= 0, '紫微：含「单宫详解」');
      ok(zwTxt.indexOf('星性组合解读') >= 0, '紫微：含「星性组合解读」');
      ok(zwTxt.indexOf('流年四化') >= 0, '紫微：含「流年四化」');
      ok(zwTxt.indexOf('大限') >= 0 && zwTxt.indexOf('岁') >= 0, '紫微：含大限区间');
      ok(zwHtml.indexOf('undefined') < 0, '紫微：无 undefined 残留');
      ok(zwHtml.indexOf('NaN') < 0, '紫微：无 NaN 残留');

      /* ③ 倪海厦天纪三层 */
      await p.click('[data-view="nihaixia"]');
      await p.click('[data-generate="nihaixia"]');
      await p.waitForTimeout(1200);
      const nhHtml = await p.evaluate(() => (document.querySelector('[data-view="nihaixia"] .result') || document.querySelector('[data-view="nihaixia"]')).innerHTML);
      const nhTxt = nhHtml.replace(/<[^>]+>/g, '');
      ['天机道 · 紫微斗数', '人间道 · 断事取卦', '地脉道', '天纪 · 三层总纲'].forEach(k => {
        ok(nhTxt.indexOf(k) >= 0, '倪海厦：含「' + k + '」');
      });
      ok(nhTxt.indexOf('梅花易数时间起卦法') >= 0, '倪海厦：起卦法来源已标注');
      ok(nhHtml.indexOf('undefined') < 0, '倪海厦：无 undefined 残留');
    } catch (e) {
      ok(false, c.label + ' 流程执行', e.message.slice(0, 80));
    }
    await p.close(); await ctx.close();
  }
  await b.close();

  console.log('\n' + '='.repeat(56));
  if (fail) {
    console.log(`✗ 浏览器端到端未通过：${pass} passed / ${fail} failed`);
    failures.forEach(f => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log(`✓ 浏览器端到端全部通过：${pass} passed / 0 failed`);
  process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
