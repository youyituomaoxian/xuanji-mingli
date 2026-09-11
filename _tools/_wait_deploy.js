/* 轮询线上 components.css 指纹直到 v9.4（不透明顶栏）上线 */
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
    const deployed = t.indexOf('#1e3540 0%, #16242e 100%') >= 0 && t.indexOf('mode-home .topbar') >= 0;
    console.log('第' + (i + 1) + '次探测: v9.4=' + deployed);
    if (deployed) { console.log('DEPLOYED'); process.exit(0); }
    await new Promise(r => setTimeout(r, 20000));
  }
  console.log('TIMEOUT');
  process.exit(1);
})();
