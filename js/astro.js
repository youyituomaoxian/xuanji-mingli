/* =========================================================================
 * astro.js — 天文历算：儒略日 / 节气（太阳视黄经）/ 定朔 / 农历 / 真太阳时
 * 真源：_skills/bazi-skill/scripts/pai_pan.py（Meeus 简式，等价于寿星定气）
 * 覆盖 1900-2100，精度到小时以上
 * ====================================================================== */
(function (global) {
  'use strict';

  var RAD = Math.PI / 180;

  /* ---------- 儒略日 ---------- */
  /* JDN：公历 → 儒略日数（整数，含 0.5 偏移校正） */
  function jdn(y, m, d) {
    var a = Math.floor((14 - m) / 12);
    var yy = y + 4800 - a;
    var mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }

  /* 公历日期时间（UTC）→ JD */
  function jdFromDateTimeUTC(y, mo, d, h, mi, s) {
    var dayFrac = (h + mi / 60 + s / 3600) / 24;
    return jdn(y, mo, d) - 0.5 + dayFrac;
  }

  /* ΔT（TT - UT1）近似，单位秒。Espenak & Meeus 多项式 */
  function deltaTSeconds(year) {
    var t, u;
    if (year >= 1900 && year < 1920) {
      t = year - 1900;
      return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * Math.pow(t, 3) - 0.000197 * Math.pow(t, 4);
    }
    if (year >= 1920 && year < 1941) {
      t = year - 1920;
      return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * Math.pow(t, 3);
    }
    if (year >= 1941 && year < 1961) {
      t = year - 1950;
      return 29.07 + 0.407 * t - Math.pow(t, 2) / 233 + Math.pow(t, 3) / 2547;
    }
    if (year >= 1961 && year < 1986) {
      t = year - 1975;
      return 45.45 + 1.067 * t - Math.pow(t, 2) / 260 - Math.pow(t, 3) / 718;
    }
    if (year >= 1986 && year < 2005) {
      t = year - 2000;
      return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * Math.pow(t, 3) + 0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5);
    }
    if (year >= 2005 && year < 2050) {
      t = year - 2000;
      return 62.92 + 0.32217 * t + 0.005589 * t * t;
    }
    if (year >= 2050 && year < 2150) {
      u = (year - 1820) / 100;
      return -20 + 32 * u * u - 0.5628 * (2150 - year);
    }
    u = (year - 1820) / 100;
    return -20 + 32 * u * u;
  }

  /* ---------- 太阳视黄经（Meeus 简式） ---------- */
  function sunApparentLongitude(jdTT) {
    var T = (jdTT - 2451545.0) / 36525;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    var M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    var Mr = M * RAD;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
      + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
      + 0.000289 * Math.sin(3 * Mr);
    var trueLong = L0 + C;
    var omega = 125.04 - 1934.136 * T;
    var lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
    return ((lambda % 360) + 360) % 360;
  }

  /* 角度最短差 */
  function lonDelta(actual, target) {
    var d = actual - target;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  }

  /* 求某年太阳视黄经 = longitude(度) 的 JD（TT，同坐标系儒略日）
     算法：以「年内第 n 个节气在 12 个月内的固定顺序」为约束做区间二分，
     不依赖固定点迭代（后者在 |Δlon| 接近 180° 时步长失控会发散）。
     方法：在该年 1/1 0h 起，按天推进找 Δlon 变号点，再二分收敛到 1e-9 天。
     节气顺序在年内单调：小寒 285°(1月) → 立春 315°(2月) → … → 冬至 270°(12月末)，
     故以「从 year-1 年 12 月起的一年窗口」扫描可保证唯一命中。 */
  function solarTermJD(year, longitude) {
    /* 搜索窗口：覆盖该年内该黄经的所有出现（最晚为冬至，在 12/21-12/23；
       最早为小寒，在 1/5-1/7）。窗口取前一年 12/1 ~ 该年 12/31。 */
    var lo = jdn(year - 1, 12, 1) - 0.5;
    var hi = jdn(year, 12, 31) - 0.5 + 1;

    /* 角差函数：返回「当前黄经 − 目标黄经」的连续化差值。
       为避免 ±180° 处 wrap 造成的伪变号，把差值按 [-360,0) 域平移到
       「上一个目标点之后」的连续分支。 */
    function rawDiff(jd) {
      var d = sunApparentLongitude(jd) - longitude;
      d = ((d + 180) % 360 + 360) % 360 - 180;   /* (-180, 180] */
      /* 目标黄经 > 180（如冬至 270°、小寒 285°）时，伪零点会落在 0° 附近；
         统一把区间移到 [-360, 0) 处理：只有当 d 由负转正才是真正的过零点 */
      return d;
    }

    /* 找真正的过零点：要求在过零处黄经对时间单调递增且 |Δlon| 小。
       做法：粗扫 0.5 天，记录所有符号变化点，再逐个用「邻近黄经差 < 5°」筛选。 */
    var step = 0.5;
    var prevJD = lo, prevD = rawDiff(lo);
    var results = [];
    for (var jd = lo + step; jd <= hi; jd += step) {
      var d = rawDiff(jd);
      if (prevD < 0 && d >= 0) {
        /* 真过零 */
        var a = prevJD, b = jd, da = prevD;
        for (var it = 0; it < 70; it++) {
          var mid = (a + b) / 2;
          var dm = rawDiff(mid);
          if (Math.abs(dm) < 1e-11 || (b - a) < 1e-9) { a = mid; break; }
          if (dm >= 0) { b = mid; } else { a = mid; }
        }
        var sol = (a + b) / 2;
        /* 校验：该点黄经必须接近目标（筛选掉 wrap 伪根） */
        var lonAt = sunApparentLongitude(sol);
        var chk = Math.abs(((lonAt - longitude + 180) % 360 + 360) % 360 - 180);
        if (chk < 1) {
          var bj = bjdToBeijing(sol + BJ_OFFSET);  /* sol 为 TT → bjd */
          results.push({ jd: sol, year: bj.y });
          if (bj.y === year) return sol;
        }
      }
      prevJD = jd; prevD = d;
    }
    /* 兜底：该年没找到时，取任意一个落在该年的近似解 */
    for (var i = 0; i < results.length; i++) if (results[i].year === year) return results[i].jd;
    return results.length ? results[0].jd : null;
  }

  var BJ_OFFSET = 8 / 24; /* 北京时间 = UTC+8 */

  /* ---------- 统一坐标约定 ----------
   * 「北京 JD」(简称 bjd)：以北京时间为基准的连续时间轴。
   *   bjd = JDN(y,m,d) − 0.5 + (当日已过小时数)/24
   *   即 1990-05-15 00:00 (北京) → JDN(1990,5,15) − 0.5
   * 所有节气、朔望、出生时刻一律用 bjd 表示，比较与相减都在同一坐标系内，
   * 避免 UTC/北京双重偏移的经典坑。
   * 数值转换到公历用 bjdToBeijing()。
   * --------------------------------- */
  function bjdFromParts(y, m, d, h, mi, s) {
    return jdn(y, m, d) - 0.5 + ((h || 0) * 3600 + (mi || 0) * 60 + (s || 0)) / 86400;
  }

  /* bjd → 北京公历 {y,m,d,h,mi,s} */
  function bjdToBeijing(bjd) {
    var z = Math.floor(bjd + 0.5);
    var f = bjd + 0.5 - z;
    var a = z;
    if (z >= 2299161) {
      var alpha = Math.floor((z - 1867216.25) / 36524.25);
      a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    var b = a + 1524;
    var c = Math.floor((b - 122.1) / 365.25);
    var dd = Math.floor(365.25 * c);
    var e = Math.floor((b - dd) / 30.6001);
    var dayF = b - dd - Math.floor(30.6001 * e) + f;
    var day = Math.floor(dayF);
    var frac = dayF - day;
    var month = (e < 14) ? e - 1 : e - 13;
    var year = (month > 2) ? c - 4716 : c - 4715;
    var hours = frac * 24;
    var hh = Math.floor(hours);
    var minutes = (hours - hh) * 60;
    var mm = Math.floor(minutes);
    var ss = Math.round((minutes - mm) * 60);
    if (ss >= 60) { ss -= 60; mm += 1; }
    if (mm >= 60) { mm -= 60; hh += 1; }
    if (hh >= 24) {
      hh -= 24; day += 1;
      var dim = daysInMonth(year, month);
      if (day > dim) { day = 1; month += 1; if (month > 12) { month = 1; year += 1; } }
    }
    return { y: year, m: month, d: day, h: hh, mi: mm, s: ss };
  }

  /* TT 儒略日 → 北京 JD（bjd） */
  function jdTTtoBJD(jdTT, year) {
    return jdTT - deltaTSeconds(year) / 86400 + BJ_OFFSET;
  }

  /* 节气时刻（北京 JD / bjd） */
  function solarTermBeijing(year, longitude) {
    var jdTT = solarTermJD(year, longitude);
    return jdTT - deltaTSeconds(year) / 86400 + BJ_OFFSET;
  }

  /* 旧名兼容：输入为 bjd，等同于 bjdToBeijing */
  function beijingFromJD(jd) {
    return bjdToBeijing(jd);
  }
  function _legacyBejingFromJD(jd) {
    var z = Math.floor(jd + 0.5);
    var f = jd + 0.5 - z;
    var a = z;
    if (z >= 2299161) {
      var alpha = Math.floor((z - 1867216.25) / 36524.25);
      a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    var b = a + 1524;
    var c = Math.floor((b - 122.1) / 365.25);
    var d = Math.floor(365.25 * c);
    var e = Math.floor((b - d) / 30.6001);
    var dayF = b - d - Math.floor(30.6001 * e) + f;
    var day = Math.floor(dayF);
    var frac = dayF - day;
    var month = (e < 14) ? e - 1 : e - 13;
    var year = (month > 2) ? c - 4716 : c - 4715;
    var hours = frac * 24;
    var h = Math.floor(hours);
    var minutes = (hours - h) * 60;
    var mi = Math.floor(minutes);
    var s = Math.round((minutes - mi) * 60);
    if (s >= 60) { s -= 60; mi += 1; }
    if (mi >= 60) { mi -= 60; h += 1; }
    if (h >= 24) { h -= 24; day += 1;
      /* 简单日期进位 */
      var dim = daysInMonth(year, month);
      if (day > dim) { day = 1; month += 1; if (month > 12) { month = 1; year += 1; } }
    }
    return { y: year, m: month, d: day, h: h, mi: mi, s: s };
  }

  function daysInMonth(y, m) {
    return [31, (isLeapYear(y) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  }
  function isLeapYear(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

  /* 出生时刻（北京 JD / bjd） */
  function dateToJD_BJ(y, m, d, h, mi) {
    return bjdFromParts(y, m, d, h, mi, 0);
  }

  /* 十二节（月之始）及对应黄经 */
  var JIE = [
    { name: '小寒', lon: 285, zhi: '丑' }, { name: '立春', lon: 315, zhi: '寅' },
    { name: '惊蛰', lon: 345, zhi: '卯' }, { name: '清明', lon: 15, zhi: '辰' },
    { name: '立夏', lon: 45, zhi: '巳' }, { name: '芒种', lon: 75, zhi: '午' },
    { name: '小暑', lon: 105, zhi: '未' }, { name: '立秋', lon: 135, zhi: '申' },
    { name: '白露', lon: 165, zhi: '酉' }, { name: '寒露', lon: 195, zhi: '戌' },
    { name: '立冬', lon: 225, zhi: '亥' }, { name: '大雪', lon: 255, zhi: '子' }
  ];
  var ZHONGQI_LON = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]; /* 春分0 起 */

  /* 列出某公历年附近所有节（含前后一年，用于边界查找） */
  function jieEventsAround(year) {
    var out = [];
    for (var y = year - 1; y <= year + 1; y++) {
      for (var i = 0; i < JIE.length; i++) {
        var jd = solarTermBeijing(y, JIE[i].lon);
        out.push({ jd: jd, name: JIE[i].name, lon: JIE[i].lon, zhi: JIE[i].zhi, year: y });
      }
    }
    out.sort(function (a, b) { return a.jd - b.jd; });
    return out;
  }

  /* 中气（用于农历置闰判定）：冬至在 12 月，lon=270 */
  function zhongqiJD(year, lon) { return solarTermBeijing(year, lon); }

  /* ---------- 定朔（New Moon，Meeus 第 49 章简化） ---------- */
  function newMoonJDE(k) {
    var T = k / 1236.85;
    var T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    var jde = 2451550.09766 + 29.530588861 * k
      + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;
    var E = 1 - 0.002516 * T - 0.0000074 * T2;
    var M = 2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3;
    var Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;
    var F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
    var Om = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;
    var Mr = M * RAD, Mpr = Mp * RAD, Fr = F * RAD, Omr = Om * RAD;

    var corr = -0.40720 * Math.sin(Mpr)
      + 0.17241 * E * Math.sin(Mr)
      + 0.01608 * Math.sin(2 * Mpr)
      + 0.01039 * Math.sin(2 * Fr)
      + 0.00739 * E * Math.sin(Mpr - Mr)
      - 0.00514 * E * Math.sin(Mpr + Mr)
      + 0.00208 * E * E * Math.sin(2 * Mr)
      - 0.00111 * Math.sin(Mpr - 2 * Fr)
      - 0.00057 * Math.sin(Mpr + 2 * Fr)
      + 0.00056 * E * Math.sin(2 * Mpr + Mr)
      - 0.00042 * Math.sin(3 * Mpr)
      + 0.00042 * E * Math.sin(Mr + 2 * Fr)
      + 0.00038 * E * Math.sin(Mr - 2 * Fr)
      - 0.00024 * E * Math.sin(2 * Mpr - Mr)
      - 0.00017 * Math.sin(Omr)
      - 0.00007 * Math.sin(Mpr + 2 * Mr)
      + 0.00004 * Math.sin(2 * Mpr - 2 * Fr)
      + 0.00004 * Math.sin(3 * Mr)
      + 0.00003 * Math.sin(Mpr + Mr - 2 * Fr)
      + 0.00003 * Math.sin(2 * Mpr + 2 * Fr)
      - 0.00003 * Math.sin(Mpr + Mr + 2 * Fr)
      + 0.00003 * Math.sin(Mpr - Mr + 2 * Fr)
      - 0.00002 * Math.sin(Mpr - Mr - 2 * Fr)
      - 0.00002 * Math.sin(3 * Mpr + Mr)
      + 0.00002 * Math.sin(4 * Mpr);

    var A1 = 299.77 + 0.107408 * k - 0.009173 * T2;
    var corr2 = 0.000325 * Math.sin(A1 * RAD)
      + 0.000165 * Math.sin((251.88 + 0.016321 * k) * RAD)
      + 0.000164 * Math.sin((251.83 + 26.651886 * k) * RAD)
      + 0.000126 * Math.sin((349.42 + 36.412478 * k) * RAD)
      + 0.000110 * Math.sin((84.66 + 18.206239 * k) * RAD)
      + 0.000062 * Math.sin((141.74 + 53.303771 * k) * RAD)
      + 0.000060 * Math.sin((207.14 + 2.453732 * k) * RAD)
      + 0.000056 * Math.sin((154.84 + 7.306860 * k) * RAD)
      + 0.000047 * Math.sin((34.52 + 27.261239 * k) * RAD)
      + 0.000042 * Math.sin((207.19 + 0.121824 * k) * RAD)
      + 0.000040 * Math.sin((291.34 + 1.844379 * k) * RAD)
      + 0.000037 * Math.sin((161.72 + 24.198154 * k) * RAD)
      + 0.000035 * Math.sin((239.56 + 25.513099 * k) * RAD)
      + 0.000023 * Math.sin((331.55 + 3.592518 * k) * RAD);

    return jde + corr + corr2;
  }

  function jdeToJDBJ(jde, year) {
    return jde - deltaTSeconds(year) / 86400 + BJ_OFFSET;
  }

  /* 找到 jd 之前（含）最近的新月 k */
  function lastNewMoonKOnOrBefore(jdTT) {
    var k = Math.floor((jdTT - 2451550.09766) / 29.530588861);
    while (newMoonJDE(k + 1) <= jdTT) k++;
    while (newMoonJDE(k) > jdTT) k--;
    return k;
  }

  /* ---------- 农历（定气定朔：冬至所在月为十一月，无中气之月为闰月） ---------- */
  /* 核心：以「冬至月首」为锚，向前后各铺 14 个月，逐月判定闰月后编号 */

  /* 取某年冬至（北京 JD） */
  function dongzhiJD(year) { return solarTermBeijing(year, 270); }

  /* 取指定农历年（冬至年）的月序骨架。
     返回 months: [{ startJD, endJD, month, leap, hasZhongqi }]，按时间升序。
     anchorDongzhiYear 为冬至所在公历年（十一月所在年）。 */
  function lunarMonthsFor(anchorDongzhiYear) {
    var dzJD = dongzhiJD(anchorDongzhiYear);
    /* 十一月 = 含冬至的那个农历月。
       ★ 关键（1985 类边界 bug 的根因）：
       不能简单用「冬至时刻之前最近的朔」——当冬至时刻落在朔日当天但晚于 0h 时，
       上一个月的朔会被取到，导致锚点月整体前移一个月，
       进而把「十二月」错编成「正月」、把真正月错编成「闰正月」。
       正确做法：以「冬至所在北京日的 JDN」为界，
       取「月首日 ≤ 冬至日」的最后一个朔，保证冬至确实落在该月区间内。 */
    var dzDay = Math.floor(dzJD + 0.5);            /* 冬至所属北京日的 JDN */
    var k11 = lastNewMoonKOnOrBefore(dzJD);        /* 先粗取 */
    /* 校验：若该月首日晚于冬至日，则回退一个朔 */
    while (Math.floor(jdeToJDBJ(newMoonJDE(k11), anchorDongzhiYear) + 0.5) > dzDay) k11--;
    /* 再校验：冬至必须落在 [朔, 下朔) 内（防取到上一个朔） */
    while (Math.floor(jdeToJDBJ(newMoonJDE(k11 + 1), anchorDongzhiYear) + 0.5) <= dzDay) k11++;
    var starts = [];
    for (var i = 0; i < 15; i++) {
      var kk = k11 + i;
      var jd = jdeToJDBJ(newMoonJDE(kk), anchorDongzhiYear + Math.floor(i / 12.5));
      starts.push(jd);
    }
    /* 按「月首日（北京日 0h 的 JDN）」对齐，避免小数误差 */
    var dayStarts = starts.map(function (x) { return Math.floor(x + 0.5); });

    var months = [];
    for (var j = 0; j < dayStarts.length - 1; j++) {
      var s = dayStarts[j], e = dayStarts[j + 1];
      months.push({ start: s, end: e, hasZhongqi: false });
    }
    /* 判定每月是否含中气，并记录「本月内的中气个数」与「首个中气的黄经」
       国标 GB/T 33661-2017 需要一个冬至月内可能含 2 个中气的情形（如 1984 冬月含冬至+大寒），
       因此不能只记布尔值，必须记个数。 */
    for (var mi = 0; mi < months.length; mi++) {
      var m = months[mi];
      m.zqCount = 0;
      m.zqFirstLon = null;
      for (var zi = 0; zi < 12; zi++) {
        var lon = ZHONGQI_LON[zi];
        var zq = zhongqiBetween(m.start, m.end, lon);
        if (zq !== null) {
          m.zqCount++;
          if (m.zqFirstLon === null) m.zqFirstLon = lon;
        }
      }
      m.hasZhongqi = m.zqCount > 0;
    }

    /* 编号规则（国标 GB/T 33661-2017 严格实现）：
       --------------------------------------------------------------
       条款 3：含节气冬至的农历月 = 十一月（由锚点选取保证）。
       条款 4：若从「某个十一月」到「下一个十一月（不含）」之间有 13 个农历月，
               则取其中**最先出现的一个不包含中气的月**为闰月；
               若只有 12 个月 → 平年，**不置闰**（无论有无无中气月）。
       条款 5：十一月之后第 2 个（不计闰月）的农历月 = 农历年起始月（正月）。

       ★ 这正是 1985 年（乙丑）「正月无中气却不置闰」的真正原因：
         1984-12-22（十一月）到 1985-12-12（下一个十一月）之间只有 12 个月 → 平年不置闰，
         故 2月20日那个无中气月按序直接成为正月。
         而 2033 年该区间有 13 个月 → 置闰 → 首个无中气月（12月22日起）为闰十一月。

       实现要点：
         先向上游统计「本月首 → 下一个含冬至月的月首」之间的月数，
         仅当月数 === 13 时才启用置闰逻辑（且只闰第一个无中气月）。 */
    var isLeapYear = (months.length >= 13) && Math.abs(months[12].zqCount) >= 0;
    /* 精确判定：从 months[0]（十一月）起到下一个「含冬至的月」之前，跨几个月。
       骨架共 15 个月，其中「下一个十一月」为 months 中再次含冬至(270°)的月。 */
    var nextDongzhiIdx = -1;
    for (var nd = 1; nd < months.length; nd++) {
      if (zhongqiBetween(months[nd].start, months[nd].end, 270) !== null) { nextDongzhiIdx = nd; break; }
    }
    /* 条款 4 的月数 = 本十一月月首 到 下一个十一月月首 之间的完整月数 = nextDongzhiIdx */
    var monthsInYear = (nextDongzhiIdx > 0) ? nextDongzhiIdx : 12;
    var needLeap = (monthsInYear === 13);

    var num = 11;
    var leapUsed = false;
    for (var q = 0; q < months.length; q++) {
      if (q === 0) {
        months[q].month = 11;
        months[q].leap = false;
        continue;
      }
      /* 越过下一个十一月后，编号继续循环，且不再置闰（新骨架负责） */
      var withinYear = (nextDongzhiIdx < 0) || (q < nextDongzhiIdx);
      if (withinYear && needLeap && !leapUsed && months[q].zqCount === 0) {
        /* 条款 4：本冬至年内首个无中气月 → 闰月（月号沿用上月，不推号） */
        months[q].month = months[q - 1].month;
        months[q].leap = true;
        leapUsed = true;
      } else {
        months[q].month = (months[q - 1].month % 12) + 1;
        months[q].leap = false;
      }
    }
    return months;
  }

  /* 判断 [sJD, eJD) 区间内是否有黄经为 lon 的中气
     区间为「北京日界 JDN」闭开区间。中气时刻为 bjd，其所属北京日 = floor(bjd + 0.5)。
     注意：必须精确枚举目标年前后各 1 年的同名中气，逐个判断是否落入区间，
     不能用「最近的一个」——闰月判定要求严格为空。 */
  function zhongqiBetween(sJD, eJD, lon) {
    var bj = bjdToBeijing(sJD - 0.5);
    var yr = bj.y;
    for (var y = yr - 1; y <= yr + 2; y++) {
      var zq = solarTermBeijing(y, lon);
      if (zq == null) continue;
      var zqDay = Math.floor(zq + 0.5);
      if (zqDay >= sJD && zqDay < eJD) return zq;
    }
    return null;
  }

  /* 【共用】判定某农历月所属的「农历年」。
     口径（唯一真源，solarToLunar / lunarToSolar 必须共用，否则往返不一致）：
       农历年 = 该农历年「正月」所在的公历年份。
       正月总在公历 2 月附近，故：
         - 正月 ~ 十月（month 1..10）→ 冬至年 + 1
         - 十一月 / 十二月（month 11..12）→ 取该月起始公历日期所在年；
           若起始日期已跨到次年 1 月，则该农历年为上一年。 */
  function lunarYearOf(mo, anchorYear) {
    var startBj = bjdToBeijing(mo.start - 0.5);
    if (mo.month >= 11) {
      return (startBj.m === 1) ? startBj.y - 1 : startBj.y;
    }
    return anchorYear + 1;
  }

  /* 公历 → 农历 */
  function solarToLunar(y, m, d) {
    var jd = jdn(y, m, d);           /* 目标日的 JDN（整数） */
    /* 确定冬至年：该日早于本年冬至则归上一冬至年骨架 */
    var anchor = y;
    var dzThis = solarTermBeijing(y, 270);
    if (jd < Math.floor(dzThis + 0.5)) anchor = y - 1;

    var months = lunarMonthsFor(anchor);
    for (var i = 0; i < months.length; i++) {
      var mo = months[i];
      if (jd >= mo.start && jd < mo.end) {
        return {
          year: lunarYearOf(mo, anchor),
          month: mo.month,
          day: jd - mo.start + 1,
          leap: !!mo.leap
        };
      }
    }
    return null;
  }

  /* 农历 → 公历（返回 {y,m,d}，日首） */
  function lunarToSolar(ly, lm, ld, leap) {
    for (var dy = ly; dy >= ly - 1; dy--) {
      var months;
      try { months = lunarMonthsFor(dy); } catch (e) { continue; }
      for (var i = 0; i < months.length; i++) {
        var mo = months[i];
        if (lunarYearOf(mo, dy) === ly && mo.month === lm && !!mo.leap === !!leap) {
          var target = mo.start + (ld - 1);
          if (target >= mo.end) return null; /* 该月无此日 */
          /* mo.start 是「北京日 0h」的 JDN 整数：
             bjd = JDN − 0.5，故目标日 0h 的 bjd = target − 0.5 */
          return bjdToBeijing(target - 0.5);
        }
      }
    }
    return null;
  }

  /* ---------- 真太阳时校正 ---------- */
  /* 经度校正 + 均时差（Equation of Time） */
  function equationOfTime(jdTT) {
    var T = (jdTT - 2451545.0) / 36525;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    var M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    var e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
    var Mr = M * RAD;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
      + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
      + 0.000289 * Math.sin(3 * Mr);
    var trueLong = L0 + C;
    var omega = 125.04 - 1934.136 * T;
    var lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);

    /* 均时差（分钟）：EoT = 4*(L0 - 0.0057183 - λ + 0.0430*sin(2*ε*...)) 简化式 */
    var epsilon = 23.439291 - 0.0130042 * T;
    var yv = Math.tan(epsilon / 2 * RAD);
    yv = yv * yv;
    var L0r = L0 * RAD, lr = lambda * RAD, er = epsilon * RAD;
    var E = yv * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) + 4 * e * yv * Math.sin(Mr) * Math.cos(2 * L0r)
      - 0.5 * yv * yv * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr);
    return E * 4 / RAD; /* 转为分钟 */
  }

  /* 真太阳时校正：返回校正小时数（可负），精确到分钟 */
  function trueSolarTimeOffsetMinutes(y, m, d, h, mi, longitude) {
    var jd = dateToJD_BJ(y, m, d, h, mi);
    var jdTT = jd - BJ_OFFSET + deltaTSeconds(y) / 86400;  /* bjd → TT */
    /* 经度差：北京时间基准 120°E */
    var lonMin = (longitude - 120) * 4;
    var eotMin = equationOfTime(jdTT);
    return lonMin + eotMin;
  }

  global.ASTRO = {
    jdn: jdn,
    jdFromDateTimeUTC: jdFromDateTimeUTC,
    deltaTSeconds: deltaTSeconds,
    sunApparentLongitude: sunApparentLongitude,
    solarTermJD: solarTermJD,
    solarTermBeijing: solarTermBeijing,
    beijingFromJD: beijingFromJD,
    bjdFromParts: bjdFromParts,
    bjdToBeijing: bjdToBeijing,
    jdTTtoBJD: jdTTtoBJD,
    lunarMonthsFor: lunarMonthsFor,
    zhongqiBetween: zhongqiBetween,
    dateToJD_BJ: dateToJD_BJ,
    daysInMonth: daysInMonth,
    isLeapYear: isLeapYear,
    JIE: JIE,
    jieEventsAround: jieEventsAround,
    newMoonJDE: newMoonJDE,
    jdeToJDBJ: jdeToJDBJ,
    lastNewMoonKOnOrBefore: lastNewMoonKOnOrBefore,
    solarToLunar: solarToLunar,
    lunarToSolar: lunarToSolar,
    equationOfTime: equationOfTime,
    trueSolarTimeOffsetMinutes: trueSolarTimeOffsetMinutes
  };
})(window);
