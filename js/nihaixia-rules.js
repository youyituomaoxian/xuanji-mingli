/* =========================================================================
 * nihaixia-rules.js — 倪海厦「天纪」推理规则层
 *
 * 【为什么需要这一层】
 *   核验 nihaixia 仓库后的事实（第一性原理）：
 *     · 全库 grep：天纪 51 处 / 紫微 14 处 / 八字 6 处 / 四柱 4 处 /
 *       **流年 0 处、断事 0 处** —— 该仓库主体是中医经方（伤寒/金匮/针灸/
 *       本草/1257 例医案），命理只占《天纪体系》一节（5784 字符）。
 *     · 因此「倪氏八字」与「断事逻辑」**在仓库里没有现成规则**，不能靠检索得到。
 *   天纪本身的结构是明确的（三层），这才是可依据的事实：
 *     · 天机道 —— 以紫微斗数为体，逐星逐宫论命（仓库有十四主星表 + 十二宫表）
 *     · 人间道 —— 以易经六十四卦断人事（仓库有 64 条人事应用表 + 君子/小人之辨）
 *     · 地脉道 —— 以卦象配阳宅地理（仓库有地理五要 + 5 条卦例断语）
 *   本层的职责就是把这三层「规则化」，使其可被生成式解析调用：
 *     ① 紫微层：把本项目紫微引擎的结果，用天纪十四主星表与十二宫表重新表述
 *     ② 断事层：定卦 → 查六十四卦人事应用 → 出君子/小人之辨与处世告诫
 *     ③ 地理层：地理五要与地脉道卦例
 *     ④ 话术层：倪师口述 DNA（口头禅池、结构模板），使输出带倪氏语感
 *
 * 【诚实边界（必须写清，不可含糊）】
 *   · 「倪氏八字」并不存在于天纪体系（天纪以紫微为体）。本项目八字层是
 *     「子平排盘（本项目引擎）× 天纪三才术语框架」的**桥接**，非倪师原法，
 *     已在输出中标注。
 *   · 仓库未载起卦法。断事层采用**梅花易数时间起卦法**（传统通行法，确定性
 *     可复现），属本项目的桥接实现，亦已在输出中标注来源。
 * ====================================================================== */
(function (global) {
  'use strict';

  function kb() { return global.KB_INLINE || null; }
  function nk() { var k = kb(); return (k && k.nihaixia) || null; }
  function style() { var k = kb(); return (k && k.nihaixiaStyle) || null; }

  /* ======================= 1. 八卦基础 ======================= */
  /* 先天八卦数：乾1 兑2 离3 震4 巽5 坎6 艮7 坤8 */
  var TRIGRAMS = {
    '乾': { num: 1, sym: '☰', nature: '天', trait: '刚健中正，自强不息' },
    '兑': { num: 2, sym: '☱', nature: '泽', trait: '和悦柔顺，以说为先' },
    '离': { num: 3, sym: '☲', nature: '火', trait: '光明附丽，柔丽乎中正' },
    '震': { num: 4, sym: '☳', nature: '雷', trait: '动而奋起，震惊百里' },
    '巽': { num: 5, sym: '☴', nature: '风', trait: '入而顺行，随风而行' },
    '坎': { num: 6, sym: '☵', nature: '水', trait: '险中守正，习坎有孚' },
    '艮': { num: 7, sym: '☶', nature: '山', trait: '止而不迁，时止则止' },
    '坤': { num: 8, sym: '☷', nature: '地', trait: '厚德载物，柔顺承天' }
  };
  var NUM2TRI = { 1: '乾', 2: '兑', 3: '离', 4: '震', 5: '巽', 6: '坎', 7: '艮', 8: '坤' };
  var SYM2TRI = (function () {
    var m = {};
    Object.keys(TRIGRAMS).forEach(function (k) { m[TRIGRAMS[k].sym] = k; });
    return m;
  })();

  /* ======================= 2. 六十四卦索引（由仓库卦表派生） ======================= */
  /* 卦表的「卦象」列形如「☰上☰下」→ 可据此派生 (上卦, 下卦) → 卦条目 的完备索引，
     无需另建映射表，保证与本仓库数据永不漂移。 */
  var _index = null;
  function guaIndex() {
    if (_index) return _index;
    _index = {};
    var n = nk();
    var list = (n && n.gua64) || [];
    list.forEach(function (row) {
      if (!row || row.length < 4) return;
      var m = /^(.)上(.)下$/.exec(String(row[2]).trim());
      if (!m) return;
      var up = SYM2TRI[m[1]], lo = SYM2TRI[m[2]];
      if (!up || !lo) return;
      /* 卦表里部分条目带 markdown 粗体标记（如「**地天泰**」），统一剥离 */
      _index[up + '+' + lo] = {
        no: String(row[0]).replace(/\*/g, ''),
        name: String(row[1]).replace(/\*/g, ''),
        symbol: row[2],
        text: String(row[3]).replace(/\*/g, '')
      };
    });
    return _index;
  }
  function guaOf(upper, lower) { return guaIndex()[upper + '+' + lower] || null; }
  /* 按卦名检索（支持「水雷屯」全名或「屯」单字） */
  function guaByName(name) {
    var idx = guaIndex(), keys = Object.keys(idx);
    for (var i = 0; i < keys.length; i++) {
      var g = idx[keys[i]];
      if (g.name === name) return g;
      if (g.name.indexOf(name) >= 0) return g;
    }
    return null;
  }

  /* ======================= 3. 起卦（梅花易数时间起卦法） ======================= */
  /* 上卦数 = (年支序 + 农历月 + 农历日) mod 8（0 取 8）
     下卦数 = (年支序 + 农历月 + 农历日 + 时支序) mod 8（0 取 8）
     动爻   = (年支序 + 农历月 + 农历日 + 时支序) mod 6（0 取 6）
     年支序 子1…亥12；时支序 子1…亥12 */
  function qiGua(o) {
    var yz = mod12(o.yearZhiIdx) + 1;              /* 0..11 → 1..12 */
    var m = o.month, d = o.day;
    var t = mod12(o.shichenIdx) + 1;               /* 0..11 → 1..12 */
    var s1 = yz + m + d;
    var s2 = s1 + t;
    var up = s1 % 8; if (up === 0) up = 8;
    var lo = s2 % 8; if (lo === 0) lo = 8;
    var mv = s2 % 6; if (mv === 0) mv = 6;
    var upper = NUM2TRI[up], lower = NUM2TRI[lo];
    var gua = guaOf(upper, lower);
    return {
      upper: upper, lower: lower, moving: mv,
      upperNum: up, lowerNum: lo,
      sums: { upper: s1, lower: s2 },
      trigramUpper: TRIGRAMS[upper], trigramLower: TRIGRAMS[lower],
      gua: gua,
      /* 卦名可否给出 · 六爻结构（自下而上：下卦三爻 + 上卦三爻） */
      name: gua ? gua.name : (upper + lower),
      text: gua ? gua.text : ''
    };
  }
  function mod12(n) { return ((n % 12) + 12) % 12; }

  /* ======================= 4. 天纪三层结构 ======================= */
  var FRAMES = {
    tianji: { key: 'tianji', name: '天机道', sub: '紫微斗数', d: '以紫微斗数为体，逐星逐宫论天命格局。' },
    renjian: { key: 'renjian', name: '人间道', sub: '易经人事', d: '以易经六十四卦断人事，教人如何做君子、避小人。' },
    dimai: { key: 'dimai', name: '地脉道', sub: '阳宅风水', d: '以卦象配地理形势，论阳宅对居者的影响。' }
  };
  var SANCAI = ['天命（先天禀赋）', '人事（性格与抉择）', '地理（环境与方位）', '流年（岁运吉凶）'];

  /* 君子 / 小人之道（倪师人间道贯穿的主轴） */
  var JUNZI = {
    junzi: '自强、厚德、诚信、谦逊、中正',
    xiaoren: '自私、贪婪、欺诈、骄傲、偏激',
    howto: '易经不是用来算命的，是用来教人如何做君子、避小人的。每一卦都从君子与小人两个角度解读。'
  };

  /* 地理五要（地脉道） */
  var DILI5 = [
    { k: '龙', d: '山脉走势，主贵贱' },
    { k: '穴', d: '聚气之处，主吉凶' },
    { k: '砂', d: '周围山势，主护持' },
    { k: '水', d: '水流方向，主财运' },
    { k: '向', d: '坐向方位，主纳气' }
  ];

  /* 地脉道原书卦例（仓库实有 5 条，按卦名取用） */
  function dimaiGuaOf(name) {
    var n = nk();
    var g = (n && n.dimaiGua) || {};
    if (!name) return '';
    if (g[name]) return g[name];
    var keys = Object.keys(g);
    for (var i = 0; i < keys.length; i++) if (String(name).indexOf(keys[i]) >= 0) return g[keys[i]];
    return '';
  }

  /* 十二宫主管（天纪原表，用于紫微层重新表述） */
  function palaceDutyTianji(name) {
    var n = nk();
    var rows = (n && n.palaces12) || [];
    var key = String(name).replace(/宫$/, '');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var k = String(r[0]).replace(/\*/g, '').replace(/宫$/, '');
      if (k === key) return String(r[1] || '').replace(/\*/g, '');
    }
    return '';
  }
  /* 十四主星的天纪定性（倪师一句话） */
  function starTraitTianji(star) {
    var n = nk();
    var rows = (n && n.stars14) || [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var k = String(r[0]).replace(/\*/g, '');
      if (k === star) return { wx: String(r[1] || ''), d: String(r[2] || '').replace(/\*/g, '') };
    }
    return null;
  }

  /* ======================= 5. 倪师口述 DNA ======================= */
  /* 确定性取用：同一命盘每次渲染取到同一口头禅（不用随机，保证可复现） */
  function pick(pool, seed) {
    var p = pool || [];
    if (!p.length) return '';
    var h = 0, s = String(seed || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
    return p[h % p.length];
  }
  /* 语气三件套：口头禅 ≥1 + 反问 ≥1 + 断言收束 —— 按场景从不同池取，避免单一重复 */
  /* 命理语境下剔除「医疗/西医批评」专有的口头禅（如「一剂就好」「气死人」），
     否则出现在命盘解读里会显得错位 */
  var NOT_FOR_DIVINATION = ['一剂就好', '气死人', '西医三部曲', '害人匪浅'];
  function pickCiv(pool, seed) {
    var p = (pool || []).filter(function (x) { return NOT_FOR_DIVINATION.indexOf(x) < 0; });
    return pick(p.length ? p : pool, seed);
  }
  function voice(seed) {
    var st = style();
    var pools = (st && st.pools) || {};
    return {
      lead: pickCiv(pools.lead, seed + 'L'),
      ask: pickCiv(pools.ask, seed + 'A'),
      assert: pickCiv(pools.assert, seed + 'S'),
      mood: pickCiv(pools.mood, seed + 'M'),
      trans: pickCiv(pools.trans, seed + 'T'),
      hasStyle: !!(pools.ask && pools.ask.length)
    };
  }
  function styleGuide() {
    var st = style();
    return (st && st.style) || null;
  }

  global.NIHAIXIA_RULES = {
    TRIGRAMS: TRIGRAMS, NUM2TRI: NUM2TRI,
    guaIndex: guaIndex, guaOf: guaOf, guaByName: guaByName,
    qiGua: qiGua,
    FRAMES: FRAMES, SANCAI: SANCAI, JUNZI: JUNZI, DILI5: DILI5,
    dimaiGuaOf: dimaiGuaOf,
    palaceDutyTianji: palaceDutyTianji,
    starTraitTianji: starTraitTianji,
    pick: pick, voice: voice, styleGuide: styleGuide
  };
})(typeof window !== 'undefined' ? window : globalThis);
