/* 轮询线上 components.css 直到 v10（移动端段落）上线 */
const https = require('https');
function fetchCss() {
  return new Promise(resolve => {
    https.get({ hostname: 'xuanji-mingli.pages.dev', path: '/css/components.css?v=' + Date.now(), rejectUnauthorized: false, headers: { 'User-Agent': 'deploy-check' } }, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    }).on('error', () => resolve(''));
  });
}
(async () => {
  for (let i = 0; i < 12; i++) {
    const t = await fetchCss();
    if (t.indexOf('v10 · 移动端适配') >= 0) { console.log('DEPLOYED 第' + (i + 1) + '次探测'); process.exit(0); }
    console.log('第' + (i + 1) + '次探测: 未上线');
    await new Promise(r => setTimeout(r, 20000));
  }
  console.log('TIMEOUT');
  process.exit(1);
})();
