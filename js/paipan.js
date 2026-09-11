/* =========================================================================
 * paipan.js — 四柱八字排盘引擎
 * 真源：_skills/bazi-skill/scripts/pai_pan.py（算法逐段对齐）
 * 依赖：ganzhi.js（干支常量）、astro.js（节气/农历/真太阳时）
 *
 * 算法锚点（必须通过 _test/test_paipan.js 校验）
 *  1. 日柱：JDN → 六十甲子，gz_index = (JDN + 49) % 60；1990-05-15 = 庚辰
 *     日界按早晚子时：23:00 前用当日日柱；23:00 起（含）用次日日柱
 *  2. 年柱：以立春精确时刻分界；年份干支 (year-4)%60；时刻 < 立春则用 year-1
 *     锚点：1990-02-03 10:00 年柱必须为己巳
 *  3. 月柱：以十二「节」时刻分界；天干用年上起月
 *     锚点：1990-05-15（立夏后、芒种前）= 辛巳月
 *  4. 时柱：五鼠遁元；锚点：庚日午时 = 壬午
 * ====================================================================== */
(function (global) {
  'use strict';

  var GZ = global.GZ;
  var A = global.ASTRO;

  function mod(n, m) { return ((n % m) + m) % m; }

  /* 年柱索引：1984 = 甲子（0） */
  function yearGZIndex(year) { return mod(year - 4, 60); }

  /* 日柱索引：JDN → 六十甲子 */
  function dayGZIndex(y, m, d) {
    return mod(A.jdn(y, m, d) + 49, 60);
  }

  /* 时柱：五鼠遁元 */
  function resolveHourPillar(dayGanIdx, shichen) {
    var zhiIdx = GZ.ZHI.indexOf(shichen);
    var ganIdx = mod(GZ.ZI_SHI_GAN[dayGanIdx] + zhiIdx, 10);
    return { gan: GZ.GAN[ganIdx], zhi: GZ.ZHI[zhiIdx] };
  }

  /* 十神 */
  function shishenOf(dayGanIdx, otherGanIdx) {
    var dg = GZ.GAN_WUXING[GZ.GAN[dayGanIdx]];
    var og = GZ.GAN_WUXING[GZ.GAN[otherGanIdx]];
    var di = GZ.WUXING.indexOf(dg), oi = GZ.WUXING.indexOf(og);
    var rel = mod(oi - di, 5);
    var same = (dayGanIdx % 2) === (otherGanIdx % 2);
    return same ? GZ.SHISHEN_SAME[rel] : GZ.SHISHEN_DIFF[rel];
  }

  /* 钟点 → 时辰地支（子 23:00-01:00） */
  function hourToShichen(hour, minute) {
    var t = hour * 60 + (minute || 0);
    if (t >= 23 * 60 || t < 60) return '子';
    var idx = Math.floor((t - 60) / 120) + 1; /* 丑=1... */
    return GZ.ZHI[idx];
  }

  /* 是否贴近时辰边界（±15 分钟） */
  function nearShichenBoundary(hour, minute) {
    var t = hour * 60 + (minute || 0);
    var marks = [60, 180, 300, 420, 540, 660, 780, 900, 1020, 1140, 1260, 1380];
    for (var i = 0; i < marks.length; i++) {
      if (Math.abs(t - marks[i]) <= 15) return true;
      if (Math.abs(t - (marks[i] - 1440)) <= 15) return true;
    }
    return false;
  }

  /* 藏干字符串（本气、中气、余气） */
  function formatCanggan(zhi) {
    return GZ.CANGGAN[zhi].map(function (x) { return x[0] + x[1]; }).join('、');
  }

  /* ---------------- 核心排盘 ---------------- */
  /* opts: {year, month, day, hour, minute, shichen, sex, place, longitude,
            useTrueSolarTime, calendarType}
     日历一律按「校正后的公历日期时间」计算 */

  /* 性别归一化（唯一真源）
     ★ 修正记录（2026-09-11）：页面表单传的是 'male'/'female'（index.html 的
       data-sex 属性），但本文件原先用 `opts.sex === '男'` 判断，两者永不相等 ——
       导致「大运顺逆」与「元辰」两个依赖性别阴阳的推算**恒定取错分支**
       （阳男被算成逆行、阴女被算成顺行）。此处把取值统一收敛到 'male'/'female'，
       并向下游提供布尔量 sexMale，避免同类字符串比较再次散落各处。
       校验：_test/ziwei_ext_cross.js（长生/大限方向 384 点）。 */
  function normSex(s) {
    if (s === 'male' || s === '男' || s === true || s === 'M' || s === 'm') return 'male';
    if (s === 'female' || s === '女' || s === false || s === 'F' || s === 'f') return 'female';
    return 'male';   /* 缺省按男命（与页面首选项一致） */
  }

  function compute(opts) {
    var warnings = [];
    var year = opts.year, month = opts.month, day = opts.day;
    var sex = normSex(opts.sex);
    var sexMale = (sex === 'male');
    var clockKnown = (opts.hour !== null && opts.hour !== undefined);
    var shichen = opts.shichen || null;

    /* 真太阳时校正 */
    var tsOffsetMin = 0, tsApplied = false;
    var h = opts.hour, mi = opts.minute || 0;
    if (opts.useTrueSolarTime && clockKnown && opts.longitude != null) {
      tsOffsetMin = A.trueSolarTimeOffsetMinutes(year, month, day, h, mi, opts.longitude);
      tsApplied = true;
      var total = h * 60 + mi + tsOffsetMin;
      /* 跨日处理 */
      var dayShift = Math.floor(total / 1440);
      total = mod(total, 1440);
      h = Math.floor(total / 60);
      mi = Math.round(total % 60);
      if (mi >= 60) { mi -= 60; h += 1; }
      if (dayShift !== 0) {
        var bj = A.bjdToBeijing(A.bjdFromParts(year, month, day, 12, 0, 0) + dayShift);
        year = bj.y; month = bj.m; day = bj.d;
        warnings.push('真太阳时校正后日期变动 ' + (dayShift > 0 ? '+' : '') + dayShift + ' 天');
      }
    }

    /* 时辰判定 */
    var hourUnknown = false;
    if (clockKnown) {
      shichen = hourToShichen(h, mi);
    } else if (shichen) {
      var mid = GZ.SHICHEN_MID[shichen];
      h = mid[0]; mi = mid[1];
      if (shichen === '子') warnings.push('未提供具体时刻，子时按早子时（当日日柱）处理');
    } else {
      h = 12; mi = 0;
      hourUnknown = true;
      warnings.push('时辰未知');
    }

    /* 出生时刻（北京 JD） */
    var birthJD = A.dateToJD_BJ(year, month, day, h, mi);

    /* 节气事件：用于年柱/月柱/起运 */
    var jieEvents = A.jieEventsAround(year);

    /* ---- 年柱：立春分界 ---- */
    var lichunJD = A.solarTermBeijing(year, 315);
    var yearNum = year;
    if (birthJD < lichunJD) yearNum = year - 1;
    var yIdx = yearGZIndex(yearNum);
    var yearGan = GZ.GAN[yIdx % 10], yearZhi = GZ.ZHI[yIdx % 12];

    /* ---- 月柱：十二「节」分界 ---- */
    /* 找出生时刻之前最近的一个「节」 */
    var prevJie = null, nextJie = null;
    for (var i = 0; i < jieEvents.length; i++) {
      if (jieEvents[i].jd <= birthJD) prevJie = jieEvents[i];
      else { nextJie = jieEvents[i]; break; }
    }
    if (!prevJie) prevJie = jieEvents[0];
    if (!nextJie) nextJie = jieEvents[jieEvents.length - 1];
    var monthZhi = prevJie.zhi;
    var monthZhiIdx = GZ.ZHI.indexOf(monthZhi);
    /* 年上起月：甲己丙作首、乙庚戊为头、丙辛庚上、丁壬壬寅、戊癸甲寅
       寅月天干 = (年干 index % 5) * 2 + 2 */
    var ygIdx = GZ.GAN.indexOf(yearGan);
    var yinGanIdx = mod((ygIdx % 5) * 2 + 2, 10);
    var monthOffset = mod(monthZhiIdx - 2, 12); /* 寅=0 */
    var monthGanIdx = mod(yinGanIdx + monthOffset, 10);
    var monthGan = GZ.GAN[monthGanIdx];

    /* ---- 日柱：23:00 起算次日 ---- */
    var dayUsed = { y: year, m: month, d: day };
    var ziShi = '无';
    var dIdx;
    if (clockKnown || shichen) {
      var tmin = h * 60 + mi;
      if (shichen === '子' && tmin >= 23 * 60) {
        /* 夜子时：用次日日柱 */
        var nb = A.bjdToBeijing(A.bjdFromParts(year, month, day, 12, 0, 0) + 1);
        dayUsed = { y: nb.y, m: nb.m, d: nb.d };
        ziShi = '夜子时';
      } else if (shichen === '子') {
        ziShi = '早子时';
      }
    }
    dIdx = dayGZIndex(dayUsed.y, dayUsed.m, dayUsed.d);
    var dayGan = GZ.GAN[dIdx % 10], dayZhi = GZ.ZHI[dIdx % 12];

    /* ---- 时柱 ---- */
    var hourGan = null, hourZhi = null;
    if (!hourUnknown) {
      var hp = resolveHourPillar(dIdx % 10, shichen);
      hourGan = hp.gan; hourZhi = hp.zhi;
    }

    /* ---- 十神 ---- */
    var dgi = dIdx % 10;
    var pillars = {
      year: { gan: yearGan, zhi: yearZhi, shishen: shishenOf(dgi, GZ.GAN.indexOf(yearGan)), canggan: formatCanggan(yearZhi), ganIdx: GZ.GAN.indexOf(yearGan) },
      month: { gan: monthGan, zhi: monthZhi, shishen: shishenOf(dgi, monthGanIdx), canggan: formatCanggan(monthZhi), ganIdx: monthGanIdx },
      day: { gan: dayGan, zhi: dayZhi, shishen: '—', canggan: formatCanggan(dayZhi), ganIdx: dgi },
      hour: hourUnknown
        ? { gan: '未知', zhi: '未知', shishen: '未知', canggan: '未知', ganIdx: -1 }
        : { gan: hourGan, zhi: hourZhi, shishen: shishenOf(dgi, GZ.GAN.indexOf(hourGan)), canggan: formatCanggan(hourZhi), ganIdx: GZ.GAN.indexOf(hourGan) }
    };

    /* ---- 大运 ---- */
    var yangYear = (ygIdx % 2 === 0);
    /* 阳男阴女顺行、阴男阳女逆行（sex 已归一化为 'male'/'female'） */
    var forward = sexMale ? yangYear : !yangYear;
    var jieForQiyun = forward ? nextJie : prevJie;
    var qiyunDays = Math.abs((jieForQiyun.jd - birthJD));
    var qy = qiyunFromDays(qiyunDays);
    var dayun = buildDayun(monthGan, monthZhi, forward, qy.years, qy.months);

    /* ---- 流年 ---- */
    var now = opts.now || new Date();
    var currentYear = now.getFullYear();
    var birthYear = year;
    var liunianYears = [];
    for (var yy = birthYear; yy <= currentYear; yy++) liunianYears.push(yy);

    /* ---- 神煞 ---- */
    var shensha = computeShensha({
      yearGan: yearGan, yearZhi: yearZhi,
      monthGan: monthGan, monthZhi: monthZhi,
      dayGan: dayGan, dayZhi: dayZhi,
      hourGan: hourGan, hourZhi: hourZhi,
      hourKnown: !hourUnknown,
      sex: sex, sexMale: sexMale, yangYear: yangYear
    });

    /* ---- 五行统计 / 旺衰 / 喜用忌 ---- */
    var wuxing = computeWuxing(pillars, hourUnknown);
    var strength = computeStrength(pillars, dgi, monthZhi, hourUnknown);
    var yongshen = computeYongshen(wuxing, strength, dgi, monthZhi);

    /* ---- 格局 ---- */
    var geju = computeGeju(pillars, dgi, monthZhi, hourUnknown);

    /* ---- 警告（节气交界 / 立春前后） ---- */
    if (Math.abs(birthJD - nextJie.jd) <= 1) warnings.push('节气交界');
    if (Math.abs(birthJD - prevJie.jd) <= 1 && warnings.indexOf('节气交界') < 0) warnings.push('节气交界');
    if (Math.abs(birthJD - lichunJD) <= 1) warnings.push('立春前后');
    if (opts.place && clockKnown && nearShichenBoundary(h, mi)) warnings.push('校正后可能跨时辰');

    /* ---- 农历显示 ---- */
    var lunar = A.solarToLunar(year, month, day);

    return {
      input: {
        solar: { y: year, m: month, d: day, h: h, mi: mi },
        solarOriginal: { y: opts.year, m: opts.month, d: opts.day, h: opts.hour, mi: opts.minute },
        lunar: lunar,
        shichen: shichen,
        shichenName: GZ.SHICHEN_NAME[shichen],
        shichenRange: GZ.SHICHEN_RANGE[shichen],
        sex: sex,
        sexMale: sexMale,
        place: opts.place || '',
        longitude: opts.longitude,
        tsOffsetMin: tsApplied ? tsOffsetMin : null,
        tsApplied: tsApplied,
        ziShi: ziShi,
        hourUnknown: hourUnknown
      },
      pillars: pillars,
      dayGan: dayGan, dayZhi: dayZhi, dayGanIdx: dgi,
      yearNum: yearNum,
      zodiac: GZ.ZHI_SHENGXIAO[yearZhi],
      shengxiao: GZ.ZHI_SHENGXIAO[yearZhi],
      dayun: dayun,
      qiyun: qy,
      dayunForward: forward,
      liunian: liunianYears.map(function (v) {
        var idx = yearGZIndex(v);
        return { year: v, gan: GZ.GAN[idx % 10], zhi: GZ.ZHI[idx % 12], gz: GZ.gzFromIndex(idx), isCurrent: v === currentYear };
      }),
      currentLiunian: (function () { var ix = yearGZIndex(currentYear); return { year: currentYear, gan: GZ.GAN[ix % 10], zhi: GZ.ZHI[ix % 12], gz: GZ.gzFromIndex(ix) }; })(),
      shensha: shensha,
      wuxing: wuxing,
      strength: strength,
      yongshen: yongshen,
      geju: geju,
      warnings: warnings,
      jieContext: { prevJie: prevJie.name, nextJie: nextJie.name },
      birthJD: birthJD
    };
  }

  /* 起运：天数 ÷ 3 = 岁；余 1 天≈4 个月，余 2 天≈8 个月 */
  function qiyunFromDays(days) {
    days = Math.abs(days);
    var whole = Math.floor(days);
    var frac = days - whole;
    var years = Math.floor(whole / 3);
    var rem = whole % 3;
    var months = rem * 4 + Math.round(frac * 4);
    if (months >= 12) { years += Math.floor(months / 12); months = months % 12; }
    return { years: years, months: months };
  }

  /* 大运：从月柱下一柱（顺）或上一柱（逆）起排 */
  function buildDayun(monthGan, monthZhi, forward, qiyunYears, qiyunMonths, steps) {
    steps = steps || 8;
    var gi = GZ.GAN.indexOf(monthGan);
    var zi = GZ.ZHI.indexOf(monthZhi);
    var delta = forward ? 1 : -1;
    var rows = [];
    if (qiyunYears > 0 || qiyunMonths > 0) {
      var preEnd = qiyunMonths === 0 ? qiyunYears + '岁' : qiyunYears + '岁' + qiyunMonths + '个月';
      rows.push({ seq: '起运前', range: '0岁-' + preEnd, gz: monthGan + monthZhi, gan: monthGan, zhi: monthZhi, isPre: true, startAge: 0 });
    }
    for (var n = 1; n <= steps; n++) {
      gi = mod(gi + delta, 10);
      zi = mod(zi + delta, 12);
      var a0 = qiyunYears + (n - 1) * 10;
      var a1 = a0 + 9;
      rows.push({ seq: String(n), range: a0 + '-' + a1 + '岁', gz: GZ.GAN[gi] + GZ.ZHI[zi], gan: GZ.GAN[gi], zhi: GZ.ZHI[zi], isPre: false, startAge: a0, endAge: a1 });
    }
    return rows;
  }

  /* ---------------- 神煞 ---------------- */
  function computeShensha(ctx) {
    var zhis = [ctx.yearZhi, ctx.monthZhi, ctx.dayZhi];
    var zhiLabels = ['年支', '月支', '日支'];
    var gans = [ctx.yearGan, ctx.monthGan, ctx.dayGan];
    var ganLabels = ['年干', '月干', '日干'];
    if (ctx.hourKnown) {
      zhis.push(ctx.hourZhi); zhiLabels.push('时支');
      gans.push(ctx.hourGan); ganLabels.push('时干');
    }
    var out = [];

    function posOf(needles, values, labels) {
      var res = [];
      needles.forEach(function (nd) {
        for (var i = 0; i < values.length; i++) if (values[i] === nd) res.push(labels[i]);
      });
      return res;
    }

    /* 按年干/日干查地支 */
    [['天乙贵人'], ['文昌'], ['学堂'], ['词馆'], ['禄神'], ['金舆'], ['羊刃']].forEach(function (item) {
      var name = item[0];
      var tbl = GZ.SHENSHA[name];
      if (!tbl || !tbl.by) return;
      var needles = [];
      var fromGan = (tbl.method.indexOf('年干') >= 0) ? [ctx.yearGan] : [ctx.dayGan];
      if (name === '天乙贵人' || name === '文昌') fromGan = [ctx.yearGan, ctx.dayGan];
      fromGan.forEach(function (g) { if (tbl.by[g]) needles = needles.concat(tbl.by[g]); });
      needles = needles.filter(function (v, i, a) { return a.indexOf(v) === i; });
      var pos = posOf(needles, zhis, zhiLabels);
      if (pos.length) out.push({ name: name, ji: tbl.ji, positions: pos, method: tbl.method });
    });

    /* 三合类（按年支或日支起） */
    Object.keys(GZ.SANHE_SHENSHA).forEach(function (name) {
      var group = GZ.SANHE_SHENSHA[name];
      var needles = [];
      [ctx.yearZhi, ctx.dayZhi].forEach(function (z) { if (group.table[z]) needles.push(group.table[z]); });
      needles = needles.filter(function (v, i, a) { return a.indexOf(v) === i; });
      var pos = posOf(needles, zhis, zhiLabels);
      if (pos.length) out.push({ name: name, ji: group.ji, positions: pos, method: '年支/日支三合' });
    });

    /* 月支起神煞 */
    Object.keys(GZ.MONTH_SHENSHA).forEach(function (name) {
      var g = GZ.MONTH_SHENSHA[name];
      var pos = [];
      if (g.gan && g.gan[ctx.monthZhi]) {
        var needleG = g.gan[ctx.monthZhi];
        for (var i = 0; i < gans.length; i++) if (gans[i] === needleG) pos.push(ganLabels[i]);
      }
      if (g.zhi && g.zhi[ctx.monthZhi]) {
        var needleZ = g.zhi[ctx.monthZhi];
        for (var j = 0; j < zhis.length; j++) if (zhis[j] === needleZ) pos.push(zhiLabels[j]);
      }
      if (pos.length) out.push({ name: name, ji: g.ji, positions: pos, method: '月支起' });
    });

    /* 年支起神煞 */
    Object.keys(GZ.YEAR_SHENSHA).forEach(function (name) {
      var g = GZ.YEAR_SHENSHA[name];
      var needle = g.table[ctx.yearZhi];
      var pos = posOf([needle], zhis, zhiLabels);
      if (pos.length) out.push({ name: name, ji: g.ji, positions: pos, method: '年支起' });
    });

    /* 空亡（旬空）：日柱所在旬的两个空亡地支
       算法（与 pai_pan.py kongwang_zhi 同口径）：
         start = (日支索引 − 日干索引) % 12
         空亡 = ZHI[start−2], ZHI[start−1]  */
    var dgiS = GZ.GAN.indexOf(ctx.dayGan);
    var dziS = GZ.ZHI.indexOf(ctx.dayZhi);
    var kstart = mod(dziS - dgiS, 12);
    var kongPair = [GZ.ZHI[mod(kstart - 2, 12)], GZ.ZHI[mod(kstart - 1, 12)]];
    var kpos = posOf(kongPair, zhis, zhiLabels);
    if (kpos.length) out.push({ name: '空亡', ji: '中', positions: kpos, method: '日柱旬空' });

    /* 元辰 */
    var ycTable = ((ctx.sexMale != null ? ctx.sexMale : ctx.sex === 'male') ? ctx.yangYear : !ctx.yangYear) ? GZ.YUANCHEN.a : GZ.YUANCHEN.b;
    var ycNeedle = ycTable[ctx.yearZhi];
    if (ycNeedle) {
      var ycZhis = [ctx.monthZhi, ctx.dayZhi];
      var ycLabels = ['月支', '日支'];
      if (ctx.hourKnown) { ycZhis.push(ctx.hourZhi); ycLabels.push('时支'); }
      var ypos = posOf([ycNeedle], ycZhis, ycLabels);
      if (ypos.length) out.push({ name: '元辰', ji: '凶', positions: ypos, method: '年支+阴阳' });
    }

    return out;
  }

  /* ---------------- 五行统计 ---------------- */
  function computeWuxing(pillars, hourUnknown) {
    var score = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    var detail = { 木: [], 火: [], 土: [], 金: [], 水: [] };
    var list = ['year', 'month', 'day', 'hour'];
    var labels = { year: '年', month: '月', day: '日', hour: '时' };

    list.forEach(function (k) {
      var p = pillars[k];
      if (k === 'hour' && hourUnknown) return;
      /* 天干权重 1.0 */
      var gw = GZ.GAN_WUXING[p.gan];
      if (gw) { score[gw] += 1.0; detail[gw].push(labels[k] + '干' + p.gan); }
      /* 地支藏干：本气 60% / 中气 30% / 余气 10% */
      var cg = GZ.CANGGAN[p.zhi];
      cg.forEach(function (item, i) {
        var w = GZ.CANGGAN_WEIGHT[i] || 0.1;
        score[item[1]] += w;
        detail[item[1]].push(labels[k] + '支' + p.zhi + '藏' + item[0] + '(' + Math.round(w * 100) + '%)');
      });
    });

    /* 归一化到百分比 */
    var total = 0;
    Object.keys(score).forEach(function (k) { total += score[k]; });
    var percent = {};
    Object.keys(score).forEach(function (k) { percent[k] = total ? (score[k] / total) * 100 : 0; });

    return { score: score, percent: percent, total: total, detail: detail };
  }

  /* ---------------- 日主旺衰 ---------------- */
  function computeStrength(pillars, dayGanIdx, monthZhi, hourUnknown) {
    var dayWu = GZ.GAN_WUXING[GZ.GAN[dayGanIdx]];
    var monthWu = GZ.ZHI_WUXING[monthZhi];
    var elements = ['木', '火', '土', '金', '水'];

    /* 得令：月令对日主是同类或生我 */
    var shengWo = null;
    elements.forEach(function (e) { if (GZ.SHENG[e] === dayWu) shengWo = e; });
    var deLing = (monthWu === dayWu) || (monthWu === shengWo);

    /* 月令对日主的十二长生状态 */
    var startZhi = GZ.CHANGSHENG_START[GZ.GAN[dayGanIdx]];
    var yang = (dayGanIdx % 2 === 0);
    var stages = GZ.CHANGSHENG_STAGE;
    var si = GZ.ZHI.indexOf(startZhi), mi = GZ.ZHI.indexOf(monthZhi);
    var step = yang ? mod(mi - si, 12) : mod(si - mi, 12);
    var changsheng = stages[step];

    /* 得地：其他地支有无根 */
    var dayZhi = pillars.day.zhi;
    var roots = [];
    ['year', 'month', 'day', 'hour'].forEach(function (k) {
      if (k === 'hour' && hourUnknown) return;
      var z = pillars[k].zhi;
      GZ.CANGGAN[z].forEach(function (item, i) {
        if (item[1] === dayWu || item[1] === shengWo) roots.push(k + '支' + z);
      });
    });
    var deDi = roots.length > 0;

    /* 得势：天干比劫印星 */
    var helpers = 0, total = 0;
    ['year', 'month', 'hour'].forEach(function (k) {
      if (k === 'hour' && hourUnknown) return;
      total++;
      var w = GZ.GAN_WUXING[pillars[k].gan];
      if (w === dayWu || w === shengWo) helpers++;
    });
    var deShi = total > 0 && helpers > 0;

    /* 综合评分（0-100） */
    var sc = 0;
    if (deLing) sc += 40;
    if (changsheng === '帝旺' || changsheng === '临官') sc += 15;
    else if (changsheng === '长生' || changsheng === '冠带') sc += 8;
    else if (changsheng === '墓' || changsheng === '绝' || changsheng === '死') sc -= 8;
    sc += Math.min(roots.length * 7, 21);
    sc += helpers * 8;
    sc = Math.max(0, Math.min(100, sc + 20));

    var level;
    if (sc >= 72) level = '身旺';
    else if (sc >= 56) level = '偏旺';
    else if (sc >= 44) level = '中和';
    else if (sc >= 28) level = '偏弱';
    else level = '身弱';

    return {
      level: level, score: sc, dayWu: dayWu, monthWu: monthWu,
      deLing: deLing, deDi: deDi, deShi: deShi,
      changsheng: changsheng, roots: roots, helpGanCount: helpers, shengWo: shengWo
    };
  }

  /* ---------------- 喜用神 ---------------- */
  function computeYongshen(wuxing, strength, dayGanIdx, monthZhi) {
    var dayWu = GZ.GAN_WUXING[GZ.GAN[dayGanIdx]];
    var weak = (strength.level === '身弱' || strength.level === '偏弱');
    var strong = (strength.level === '身旺' || strength.level === '偏旺');

    /* 生我者（印）、同我者（比劫）= 扶身 */
    var shengWo = null, woSheng = GZ.SHENG[dayWu], woKe = GZ.KE[dayWu];
    var keWo = null;
    GZ.WUXING.forEach(function (e) { if (GZ.SHENG[e] === dayWu) shengWo = e; if (GZ.KE[e] === dayWu) keWo = e; });

    var xiyong = [], jishen = [], reasons = [];

    if (weak) {
      xiyong = [shengWo, dayWu].filter(Boolean);
      jishen = [keWo, woKe, woSheng].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i && xiyong.indexOf(v) < 0; });
      reasons.push('日主' + GZ.GAN[dayGanIdx] + '（' + dayWu + '）' + strength.level + '，宜扶抑——取印星（' + shengWo + '）生身、比劫（' + dayWu + '）帮身。');
    } else if (strong) {
      xiyong = [woSheng, woKe, keWo].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
      jishen = [shengWo, dayWu].filter(Boolean);
      reasons.push('日主' + GZ.GAN[dayGanIdx] + '（' + dayWu + '）' + strength.level + '，宜克泄耗——取食伤（' + woSheng + '）泄秀、财星（' + woKe + '）耗身、官杀（' + keWo + '）制身。');
    } else {
      /* 中和：以调候 + 流通为主 */
      xiyong = [woSheng, woKe].filter(Boolean);
      jishen = [keWo].filter(Boolean);
      reasons.push('日主' + GZ.GAN[dayGanIdx] + '（' + dayWu + '）中和，喜流通——取食伤（' + woSheng + '）、财星（' + woKe + '）顺其气势，忌官杀（' + keWo + '）直克。');
    }

    /* 调候修正：冬生（亥子丑月）喜火，夏生（巳午未月）喜水 */
    var tiaohou = null;
    if (['亥', '子', '丑'].indexOf(monthZhi) >= 0) tiaohou = '火';
    else if (['巳', '午', '未'].indexOf(monthZhi) >= 0) tiaohou = '水';
    if (tiaohou) {
      reasons.push('月令' + monthZhi + '（' + GZ.ZHI_WUXING[monthZhi] + '旺之季），' +
        (tiaohou === '火' ? '寒气偏重，需火调候暖局' : '燥气偏重，需水调候润局') + '——调候用神取' + tiaohou + '。');
      if (xiyong.indexOf(tiaohou) < 0 && weak === (tiaohou === (tiaohou === '火' ? '水' : '火'))) {
        xiyong.unshift(tiaohou);
      } else if (xiyong.indexOf(tiaohou) < 0) {
        xiyong.push(tiaohou);
      }
    }

    /* 缺失五行标记 */
    var missing = [];
    GZ.WUXING.forEach(function (e) { if (wuxing.score[e] < 0.35) missing.push(e); });

    xiyong = xiyong.filter(function (v, i, a) { return a.indexOf(v) === i; });

    return {
      xiyong: xiyong, jishen: jishen.filter(function (v, i, a) { return a.indexOf(v) === i && xiyong.indexOf(v) < 0; }),
      tiaohou: tiaohou, reasons: reasons, missing: missing,
      dayWu: dayWu, shengWo: shengWo, woSheng: woSheng, woKe: woKe, keWo: keWo
    };
  }

  /* ---------------- 格局判定 ---------------- */
  function computeGeju(pillars, dayGanIdx, monthZhi, hourUnknown) {
    var monthGanIdx = pillars.month.ganIdx;
    var dgi = dayGanIdx;
    var mainShishen = shishenOf(dgi, monthGanIdx);
    /* 月支本气十神 */
    var benqi = GZ.CANGGAN[monthZhi][0][0];
    var benqiShishen = shishenOf(dgi, GZ.GAN.indexOf(benqi));
    /* 若月支本气未透，看月支中气/余气透干 */
    var touShishen = null;
    var cg = GZ.CANGGAN[monthZhi];
    var gansIdx = [GZ.GAN.indexOf(pillars.year.gan), GZ.GAN.indexOf(pillars.month.gan)];
    if (!hourUnknown) gansIdx.push(GZ.GAN.indexOf(pillars.hour.gan));
    for (var i = 0; i < cg.length; i++) {
      var gi = GZ.GAN.indexOf(cg[i][0]);
      if (gansIdx.indexOf(gi) >= 0) { touShishen = shishenOf(dgi, gi); break; }
    }

    var geName, geType, desc;
    var base = mainShishen;
    if (base === '比肩' || base === '劫财') {
      var isLing = (GZ.GAN_WUXING[pillars.month.gan] === GZ.GAN_WUXING[pillars.day.gan]);
      geName = isLing ? '建禄格 / 羊刃格' : '比劫格';
      geType = '特殊格';
      desc = '月令为比劫之根，日主自坐强根，主自立自强、不喜受人约束。';
    } else {
      geName = base.replace('偏官', '七杀') + '格';
      geType = '正格';
      desc = '以月令为纲，月令主气透于天干，取为格局。';
    }
    /* 阳刃特判：月支为日干的帝旺之支 */
    var startZhi = GZ.CHANGSHENG_START[GZ.GAN[dgi]];
    var yang = (dgi % 2 === 0);
    var stepTo = yang ? mod(GZ.ZHI.indexOf(monthZhi) - GZ.ZHI.indexOf(startZhi), 12) : mod(GZ.ZHI.indexOf(startZhi) - GZ.ZHI.indexOf(monthZhi), 12);
    if (GZ.CHANGSHENG_STAGE[stepTo] === '帝旺' && ['比肩', '劫财'].indexOf(base) >= 0) {
      geName = '羊刃格'; geType = '特殊格';
      desc = '月令恰为日主帝旺之地（羊刃），主性格刚烈、行动力强，喜官杀制刃或食伤泄秀。';
    }

    /* 格局高低：用神是否得力 */
    var high = benqiShishen === base ? '格局清纯' : '格局略杂';
    return {
      name: geName, type: geType, mainShishen: mainShishen,
      benqiShishen: benqiShishen, touShishen: touShishen,
      desc: desc, purity: high
    };
  }

  global.PAIPAN = {
    compute: compute,
    qiyunFromDays: qiyunFromDays,
    buildDayun: buildDayun,
    shishenOf: shishenOf,
    resolveHourPillar: resolveHourPillar,
    hourToShichen: hourToShichen,
    computeWuxing: computeWuxing,
    computeStrength: computeStrength,
    computeYongshen: computeYongshen,
    computeGeju: computeGeju
  };
})(window);
