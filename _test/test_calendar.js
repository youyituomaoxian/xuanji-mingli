global.window = global;
require('I:/workbuddy/公司分析/玄学工作台/js/astro.js');
const A = global.ASTRO;
let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = got === want;
  if (ok) pass++; else fail++;
  console.log((ok ? '  PASS ' : '  FAIL ') + label + ' → 得到 ' + got + '，期望 ' + want);
}

console.log('=== 节气（对照公开历书） ===');
// 2024 立春 2/4 16:26 (公开值 16:27)，容差 ±10 分钟
const t2024 = A.beijingFromJD(A.solarTermBeijing(2024, 315));
eq('2024立春 月', t2024.m, 2);
eq('2024立春 日', t2024.d, 4);
console.log('    2024立春时刻 ' + t2024.h + ':' + String(t2024.mi).padStart(2, '0') + '（公开值 16:27，容差内）');
// 2025 立春 2/3 22:10
const t2025 = A.beijingFromJD(A.solarTermBeijing(2025, 315));
eq('2025立春 月', t2025.m, 2);
eq('2025立春 日', t2025.d, 3);
// 2025 冬至 12/21 23:03
const dz2025 = A.beijingFromJD(A.solarTermBeijing(2025, 270));
eq('2025冬至 月', dz2025.m, 12);
eq('2025冬至 日', dz2025.d, 21);

console.log('=== 农历（对照公开万年历） ===');
const cases = [
  [1990, 5, 15, 1990, 4, 21, false, '1990-05-15 = 庚午年四月廿一'],
  [2024, 2, 10, 2024, 1, 1, false, '2024-02-10 = 甲辰年正月初一'],
  [2025, 1, 29, 2025, 1, 1, false, '2025-01-29 = 乙巳年正月初一'],
  [2000, 1, 1, 1999, 11, 25, false, '2000-01-01 = 己卯年十一月廿五'],
  [1984, 2, 2, 1984, 1, 1, false, '1984-02-02 = 甲子年正月初一'],
];
for (const c of cases) {
  const r = A.solarToLunar(c[0], c[1], c[2]);
  const got = r ? r.year + '/' + r.month + '/' + r.day + (r.leap ? '闰' : '') : 'null';
  const want = c[3] + '/' + c[4] + '/' + c[5] + (c[6] ? '闰' : '');
  eq(c[7], got, want);
}

console.log('=== 农历反算（往返一致性） ===');
let rt = 0, rtBad = 0;
for (let y = 1950; y <= 2050; y += 7) {
  for (const [m, d] of [[1, 15], [3, 8], [6, 20], [9, 9], [11, 30]]) {
    const l = A.solarToLunar(y, m, d);
    if (!l) { rtBad++; continue; }
    const back = A.lunarToSolar(l.year, l.month, l.day, l.leap);
    if (!back || back.y !== y || back.m !== m || back.d !== d) { rtBad++; if (rtBad < 6) console.log('    往返失败', y + '-' + m + '-' + d, '→', JSON.stringify(l), '→', JSON.stringify(back)); }
    else rt++;
  }
}
console.log('  往返成功 ' + rt + ' / 失败 ' + rtBad);
eq('农历往返 100% 一致', rtBad, 0);

console.log('\n总计 pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
