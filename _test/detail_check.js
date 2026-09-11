/* 细节功能验证：复制文本质量 / 关键词高亮 / 单分区刷新 / 全局重置 / 多档案切换 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8123/' + encodeURIComponent('玄学工作台');
const OUT = path.join(__dirname, 'shots');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 200)); });

  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const log = [];
  const ok = (c, m) => log.push((c ? '  ✓ ' : '  ✗ ') + m);

  /* ---- 建档 ---- */
  await page.fill('#castName', '甲'); await page.fill('#birthYear', '1970');
  await page.fill('#birthMonth', '4'); await page.fill('#birthDay', '15');
  await page.click('#btnSaveCast'); await page.waitForTimeout(500);
  /* 第二个档案 */
  await page.fill('#castName', '乙'); await page.fill('#birthYear', '1992');
  await page.fill('#birthMonth', '11'); await page.fill('#birthDay', '8');
  await page.click('#btnSaveCast'); await page.waitForTimeout(500);
  const archCount = await page.$$eval('.archive__item', els => els.length).catch(() => 0);
  ok(archCount >= 2, '多档案建档 ' + archCount + ' 条');

  /* ---- 复制全文：验证纯文本质量 ---- */
  await page.click('.nav__item[data-view="bazi"]');
  await page.waitForTimeout(1500);
  await page.click('[data-copy="bazi"]').catch(async () => {
    await page.click('button:has-text("复制全文")');
  });
  await page.waitForTimeout(800);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(clip.length > 2000, '复制全文长度 ' + clip.length + ' 字符');
  ok(!/<[a-z][\s\S]*>/i.test(clip), '复制内容为纯文本（无残留 HTML 标签）');
  ok(/【.*】/.test(clip), '复制内容含【段落标题】结构化标记');
  ok(clip.indexOf('undefined') < 0, '复制内容无 undefined');
  /* 段落顺序：标题→核心总结→详细解读→…→建议 */
  /* 分层顺序：总盘全局解读 应早于 专属建议（标题为「N、总盘全局解读」「N、八字专属建议」） */
  const idxSum = clip.indexOf('总盘全局解读'), idxAdv = clip.indexOf('专属建议');
  ok(idxSum >= 0 && idxAdv > idxSum, '分层顺序正确（总盘全局解读 在 专属建议 之前）');
  /* 内联高亮不得割裂句子：不应出现「戊（土）」这类被孤立成行的短片段 */
  const orphanLines = clip.split(/\r?\n/).filter(l => l.trim().length > 0 && l.trim().length <= 3).length;
  ok(orphanLines <= 2, '无大量被高亮 span 割裂的孤立短行（孤立行 ' + orphanLines + '）');
  fs.writeFileSync(path.join(OUT, 'clip-bazi.txt'), clip, 'utf8');

  /* ---- 关键词高亮 ---- */
  const kwCount = await page.$$eval('.kw', els => els.length).catch(() => 0);
  ok(kwCount > 0, '关键词高亮元素 ' + kwCount + ' 个');
  const kwKind = await page.$$eval('.kw', els => [...new Set(els.map(e => e.className))].join(' | ')).catch(() => '');
  ok(/kw--/.test(kwKind), '高亮语义类名: ' + kwKind.slice(0, 80));

  /* ---- 单分区刷新 ---- */
  const before = await page.$eval('#out-bazi', e => e.innerHTML.length);
  await page.click('[data-refresh="bazi"]');
  await page.waitForTimeout(2500);
  const after = await page.$eval('#out-bazi', e => e.innerHTML.length);
  ok(after > 1500, '单分区刷新后输出仍完整 (' + before + ' → ' + after + ')');

  /* ---- 其他分区不受影响（分区隔离） ---- */
  await page.click('.nav__item[data-view="fortune"]');
  await page.waitForTimeout(2000);
  const ftLen = await page.$eval('#out-fortune', e => e.innerHTML.length);
  ok(ftLen > 1500, '通用运势分区独立渲染 ' + ftLen + ' 字符');

  /* ---- 全局重置 ---- */
  page.on('dialog', d => d.accept());
  await page.click('#btnGlobalReset');
  await page.waitForTimeout(1200);
  const afterReset = await page.evaluate(() => ({
    bazi: document.getElementById('out-bazi').innerHTML.length,
    fortune: document.getElementById('out-fortune').innerHTML.length,
    archives: document.querySelectorAll('.archive__item').length
  }));
  /* 重置后 renderOut() 会写入「尚未生成」空态占位，故判定「已回到空态」而非「长度=0」 */
  const emptyFlag = await page.evaluate(() => ({
    bazi: /尚未生成/.test(document.getElementById('out-bazi').textContent),
    fortune: /尚未生成/.test(document.getElementById('out-fortune').textContent)
  }));
  ok(afterReset.bazi < 400 && emptyFlag.bazi && emptyFlag.fortune,
     '全局重置已回到空态 (' + JSON.stringify(afterReset) + ' empty=' + JSON.stringify(emptyFlag) + ')');
  ok(afterReset.archives >= 2, '全局重置保留档案 ' + afterReset.archives + ' 条');

  /* ---- 档案切换 ---- */
  const switched = await page.evaluate(() => {
    const items = document.querySelectorAll('.archive__item');
    if (items.length < 2) return null;
    items[1].click();
    return true;
  });
  await page.waitForTimeout(1200);
  const line = ((await page.textContent('#castline')) || '').trim().replace(/\s+/g, ' ');
  ok(switched && /乙|1992/.test(line), '档案切换生效: ' + line.slice(0, 50));

  await page.screenshot({ path: path.join(OUT, '05-detail.png'), fullPage: true });

  console.log(log.join('\n'));
  console.log('\n异常 ' + errors.length + ' 条:');
  errors.slice(0, 15).forEach(e => console.log('  ' + e));
  console.log('\n复制文本前 300 字:\n' + clip.slice(0, 300).replace(/\n/g, ' ⏎ '));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
