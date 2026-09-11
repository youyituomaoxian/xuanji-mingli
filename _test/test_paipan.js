global.window = global;
require('I:/workbuddy/公司分析/玄学工作台/js/ganzhi.js');
require('I:/workbuddy/公司分析/玄学工作台/js/astro.js');
require('I:/workbuddy/公司分析/玄学工作台/js/paipan.js');
const P = global.PAIPAN;

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = String(got) === String(want);
  if (ok) pass++; else fail++;
  console.log((ok ? '  PASS ' : '  FAIL ') + label + ' → 得到「' + got + '」期望「' + want + '」');
}

console.log('=== 锚点 1：1990-05-15 12:00 男（应为 庚午 / 辛巳 / 庚辰 / 壬午，顺排，7岁3个月起运） ===');
let r = P.compute({ year: 1990, month: 5, day: 15, hour: 12, minute: 0, sex: '男' });
eq('年柱', r.pillars.year.gan + r.pillars.year.zhi, '庚午');
eq('月柱', r.pillars.month.gan + r.pillars.month.zhi, '辛巳');
eq('日柱', r.pillars.day.gan + r.pillars.day.zhi, '庚辰');
eq('时柱', r.pillars.hour.gan + r.pillars.hour.zhi, '壬午');
eq('日干十神格', r.pillars.day.shishen, '—');
eq('年柱十神', r.pillars.year.shishen, '比肩');
eq('月柱十神', r.pillars.month.shishen, '劫财');
eq('时柱十神', r.pillars.hour.shishen, '食神');
eq('大运方向', r.dayunForward ? '顺排' : '逆排', '顺排');
eq('起运', r.qiyun.years + '岁' + r.qiyun.months + '个月', '7岁3个月');
eq('大运1', r.dayun.find(x => x.seq === '1').gz, '壬午');
eq('大运2', r.dayun.find(x => x.seq === '2').gz, '癸未');
eq('大运3', r.dayun.find(x => x.seq === '3').gz, '甲申');
eq('农历', r.input.lunar.year + '年' + r.input.lunar.month + '月' + r.input.lunar.day + '日', '1990年4月21日');
eq('生肖', r.zodiac, '马');

console.log('\n=== 锚点 2：1990-02-03 10:00 男（年柱必须为己巳，不是庚午） ===');
let r2 = P.compute({ year: 1990, month: 2, day: 3, hour: 10, minute: 0, sex: '男' });
eq('年柱', r2.pillars.year.gan + r2.pillars.year.zhi, '己巳');
eq('月柱', r2.pillars.month.gan + r2.pillars.month.zhi, '丁丑');
eq('日柱', r2.pillars.day.gan + r2.pillars.day.zhi, '己亥');

console.log('\n=== 锚点 3：时柱五鼠遁元（庚日午时=壬午） ===');
eq('庚日午时', P.resolveHourPillar(6, '午').gan + P.resolveHourPillar(6, '午').zhi, '壬午');
eq('甲日子时', P.resolveHourPillar(0, '子').gan + P.resolveHourPillar(0, '子').zhi, '甲子');
eq('戊癸日子时', P.resolveHourPillar(4, '子').gan + P.resolveHourPillar(4, '子').zhi, '壬子');

console.log('\n=== 锚点 4：子时跨日（23:00 起用次日日柱） ===');
let r3 = P.compute({ year: 1990, month: 5, day: 15, hour: 23, minute: 30, sex: '男' });
eq('夜子时标记', r3.input.ziShi, '夜子时');
eq('日柱应为次日(1990-05-16)庚辰→辛巳', r3.pillars.day.gan + r3.pillars.day.zhi, '辛巳');
let r4 = P.compute({ year: 1990, month: 5, day: 15, hour: 0, minute: 30, sex: '男' });
eq('早子时标记', r4.input.ziShi, '早子时');
eq('日柱应为当日庚辰', r4.pillars.day.gan + r4.pillars.day.zhi, '庚辰');

console.log('\n=== 锚点 5：十神推导 ===');
// 庚(6)为日主，甲(0)为偏财(阴阳同? 庚阳 甲阳 → 同→我克→偏财)
eq('庚见甲', P.shishenOf(6, 0), '偏财');
eq('庚见乙', P.shishenOf(6, 1), '正财');
eq('庚见丙', P.shishenOf(6, 2), '偏官');
eq('庚见丁', P.shishenOf(6, 3), '正官');
eq('庚见戊', P.shishenOf(6, 4), '偏印');
eq('庚见己', P.shishenOf(6, 5), '正印');
eq('庚见辛', P.shishenOf(6, 7), '劫财');
eq('庚见壬', P.shishenOf(6, 8), '食神');
eq('庚见癸', P.shishenOf(6, 9), '伤官');

console.log('\n=== 锚点 6：时辰映射 ===');
eq('00:30→子', P.hourToShichen(0, 30), '子');
eq('01:30→丑', P.hourToShichen(1, 30), '丑');
eq('12:00→午', P.hourToShichen(12, 0), '午');
eq('23:30→子', P.hourToShichen(23, 30), '子');
eq('22:30→亥', P.hourToShichen(22, 30), '亥');

console.log('\n=== 五行/旺衰/喜用/格局（结构输出） ===');
const r5 = P.compute({ year: 1990, month: 5, day: 15, hour: 12, minute: 0, sex: '男' });
console.log('  五行占比:', Object.entries(r5.wuxing.percent).map(([k, v]) => k + v.toFixed(1) + '%').join(' '));
console.log('  旺衰:', r5.strength.level, '得分', r5.strength.score, '得令', r5.strength.deLing, '月令长生', r5.strength.changsheng);
console.log('  喜用:', r5.yongshen.xiyong.join('/'), '忌神:', r5.yongshen.jishen.join('/'), '调候:', r5.yongshen.tiaohou);
console.log('  格局:', r5.geju.name, r5.geju.type);
console.log('  神煞:', r5.shensha.map(s => s.name + '(' + s.positions.join(',') + ')').join(' '));

console.log('\n总计 pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
