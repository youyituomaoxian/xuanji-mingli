/* 轮询线上 app.js 指纹，直到新版本（含 makeZip）上线或超时 */
const https = require('https');
function fetchLen() {
  return new Promise(resolve => {
    https.get({ hostname: 'xuanji-mingli.pages.dev', path: '/js/app.js?v=' + Date.now(), rejectUnauthorized: false, headers: { 'User-Agent': 'deploy-check' } }, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    }).on('error', () => resolve(''));
  });
}
(async () => {
  for (let i = 0; i < 10; i++) {
    const t = await fetchLen();
    const okDeployed = t.indexOf('makeZip') >= 0;
    console.log('第' + (i + 1) + '次探测: len=' + t.length + ' makeZip=' + okDeployed);
    if (okDeployed) { console.log('DEPLOYED'); process.exit(0); }
    await new Promise(r => setTimeout(r, 20000));
  }
  console.log('TIMEOUT');
  process.exit(1);
})();
