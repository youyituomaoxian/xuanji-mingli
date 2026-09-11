global.window = global;
require('I:/workbuddy/公司分析/玄学工作台/js/astro.js');
const A = global.ASTRO;
const names = {285:'小寒',315:'立春',345:'惊蛰',15:'清明',45:'立夏',75:'芒种',105:'小暑',135:'立秋',165:'白露',195:'寒露',225:'立冬',255:'大雪',270:'冬至',0:'春分',180:'秋分',90:'夏至'};
for (const y of [1990, 2000, 2024, 2025, 2026]) {
  let s = y + ': ';
  for (const lon of [315, 45, 270, 0]) {
    const jd = A.solarTermBeijing(y, lon);
    const b = A.beijingFromJD(jd);
    s += names[lon] + '=' + b.m + '/' + b.d + ' ' + String(b.h).padStart(2,'0') + ':' + String(b.mi).padStart(2,'0') + '  ';
  }
  console.log(s);
}
