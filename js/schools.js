/* =========================================================================
 * schools.js — 四大分区解读生成器
 *
 * 分区隔离原则（任务书 §四.1）：
 *   每个分区只调用自己的知识库与话术体系，不混判、不串逻辑。
 *   nihaixia → 天纪体系（天命—人事—地理—流年）
 *   bazi     → 子平体系（十神格局、大运流年、喜用神）
 *   ziwei    → 紫微体系（十二宫、十四主星、四化）
 *   fortune  → 综合参考（周期运势），不绑单一流派
 *
 * 免责原则（任务书 §五.2）：杜绝夸张恐吓、绝对化凶断、负面诱导。
 *   所有断语改为「倾向 / 参考 / 宜留意」，正向指引为主。
 * ====================================================================== */
(function (global) {
  'use strict';

  var U = global.UI;
  var GZ = global.GANZHI || global.GZ;
  var R = global.RESOURCE;
  var A = global.ASTRO;   /* 紫微「晚子时生日顺延」需用农历换算 */
  /* 紫微斗数推理规则层（global.ZIWEI_RULES）由下方 ZR() 惰性读取，
     避免与局部函数名冲突，也便于规则层缺失时优雅退化 */

  /* ===================== 通用工具 ===================== */

  function pillarsStr(p) {
    return p.year.gan + p.year.zhi + ' ' + p.month.gan + p.month.zhi + ' ' +
           p.day.gan + p.day.zhi + ' ' + p.hour.gan + p.hour.zhi;
  }
  function nowYear() { return new Date().getFullYear(); }

  /* 十神 → 性格关键词（子平口径，唯一真源） */
  var SHISHEN_TRAIT = {
    '比肩': { t: '自立、有主见', d: '习惯靠自己解决问题，不太依赖他人，做事有自己的节奏。' },
    '劫财': { t: '行动力强、讲义气', d: '重朋友、敢冲敢拼，但也容易在人际上破费精力。' },
    '食神': { t: '温和、有生活情趣', d: '审美与口福都不错，表达从容，适合做需要耐心与品味的事。' },
    '伤官': { t: '聪明、锋芒外露', d: '思路快、有创意，不喜欢被条条框框约束，说话直。' },
    '偏财': { t: '机敏、善抓机会', d: '对机会敏感，擅长整合资源，收入多来自主动出击。' },
    '正财': { t: '务实、稳健踏实', d: '重视积累与规划，赚钱靠一步步打基础，不喜冒进。' },
    '偏官': { t: '有魄力、能扛压', d: '在压力下反而更能出成绩，适合有挑战与竞争的环境。' },
    '正官': { t: '守规矩、责任心强', d: '重视规则与承诺，在体制或规范环境中容易获得信任。' },
    '偏印': { t: '思维独特、内省', d: '想法偏小众，喜欢钻研冷门领域，需要空间不被打扰。' },
    '正印': { t: '温和、有学习力', d: '愿意接受教诲，学习吸收快，长辈缘分通常不错。' }
  };

  /* 十神 → 六亲/领域（用于总盘解读分段） */
  var SHISHEN_FIELD = {
    '比肩': '同辈、合作、竞争', '劫财': '朋友、合伙、支出',
    '食神': '才华、享受、子女', '伤官': '表达、创新、突破',
    '偏财': '灵活财源、人际经营', '正财': '稳定收入、家庭责任',
    '偏官': '事业压力、权威挑战', '正官': '职位、名誉、约束',
    '偏印': '偏门学问、独特灵感', '正印': '学习、长辈、庇荫'
  };

  /* 五行 → 性格与领域（通用口径） */
  var WX_TRAIT = {
    '木': { t: '生长、仁厚、有规划', d: '偏重成长性事务，为人讲道理、重原则，适合长期经营。', c: '#5f8b6b' },
    '火': { t: '热情、外显、行动快', d: '做事有冲劲，适合与人打交道、需要表现力的场景。', c: '#a8443a' },
    '土': { t: '稳厚、包容、重结果', d: '踏实可靠，适合做承接与整合的角色，但节奏偏慢。', c: '#b8935a' },
    '金': { t: '果断、条理、重效率', d: '原则性强，做需要精确与决断的事务更顺手。', c: '#9aa3a8' },
    '水': { t: '灵活、善思、随机应变', d: '思路活、适应力强，适合流动性与信息密集型工作。', c: '#2f4f5f' }
  };

  /* 五行 → 生活化开运建议（通用口径，避免绝对化） */
  var WX_LIFE = {
    '木': { color: '青绿、薄荷绿', dir: '东方', season: '春季', num: '3、8', habit: '多接触绿植与户外、保持规律作息' },
    '火': { color: '暖红、橘调', dir: '南方', season: '夏季', num: '2、7', habit: '适度运动出汗、保持表达与社交' },
    '土': { color: '米黄、咖褐', dir: '中部、西南', season: '四季末', num: '5、0', habit: '规律饮食、避免久坐积压、整理居住空间' },
    '金': { color: '月白、银灰', dir: '西方', season: '秋季', num: '4、9', habit: '保持作息清爽、做减法式收纳' },
    '水': { color: '黛青、玄黑', dir: '北方', season: '冬季', num: '1、6', habit: '多补水、保持安静独处与深度思考时间' }
  };

  /* 紫微十四主星（性格与格局倾向）—— 术语框架对齐 nihaixia 天纪体系名词表 */
  var ZIWEI_STARS = {
    '紫微': { t: '尊贵、主导、要面子', d: '自尊心强，习惯承担中心角色，需要被尊重；落在命宫主有格局与担当。' },
    '天机': { t: '机敏、善谋、多思', d: '擅长计划与推演，脑子转得快，但容易想太多而犹豫。' },
    '太阳': { t: '光明、博爱、外向', d: '乐于付出、有服务精神，适合做对外与需要影响力的工作。' },
    '武曲': { t: '刚毅、务实、重财', d: '执行力强、对钱财有天赋，性格偏硬，需留意人际柔和度。' },
    '天同': { t: '温和、随和、享福', d: '性情和缓、人缘好，但进取心需外部推动，宜找有节奏的环境。' },
    '廉贞': { t: '刚柔并济、执着', d: '有个性与原则，感情投入深，做事能做到极致。' },
    '天府': { t: '稳重、包容、掌库', d: '善于经营与守成，理财与统筹能力强，适合管理型角色。' },
    '太阴': { t: '细腻、内敛、重情', d: '感性体贴，适合需要耐心与细腻度的工作，独处时状态最佳。' },
    '贪狼': { t: '多才、善交际、欲望强', d: '兴趣广、社交能力好，善于把握机会，但需专注避免分散。' },
    '巨门': { t: '善辩、分析、敏感', d: '口才与分析力好，适合研究、评论、谈判类工作。' },
    '天相': { t: '辅佐、公正、重衣禄', d: '有服务与协作精神，适合做辅佐、协调、专业支持的角色。' },
    '天梁': { t: '清高、荫庇、老成', d: '有长者缘与保护他人的特质，宜从事教育、顾问、评审类工作。' },
    '七杀': { t: '果断、胆识、开创', d: '行动力与抗压力强，适合从无到有的开创型事务。' },
    '破军': { t: '革新、破立、不耐旧', d: '敢于打破与重建，适合变革与改善型场景，但需留意稳定度。' }
  };

  /* 紫微十二宫主管（术语对齐） */
  var ZIWEI_PALACES = [
    ['命宫', '本性、气质与人生主轴'],
    ['兄弟宫', '平辈关系、合作与协助'],
    ['夫妻宫', '感情模式与婚姻状态'],
    ['子女宫', '晚辈缘分、创造力与合伙'],
    ['财帛宫', '收入方式与理财倾向'],
    ['疾厄宫', '体质倾向与压力反应'],
    ['迁移宫', '外出发展与环境适应'],
    ['交友宫', '友朋与人事往来'],
    ['官禄宫', '事业形态与发展路径'],
    ['田宅宫', '不动产与生活根基'],
    ['福德宫', '精神享受与内在满足'],
    ['父母宫', '长辈缘分与上级关系']
  ];

  /* 四化星（生年四化 / 流年四化表） */
  var SIHUA_TABLE = {
    '甲': ['廉贞', '破军', '武曲', '太阳'],
    '乙': ['天机', '天梁', '紫微', '太阴'],
    '丙': ['天同', '天机', '文昌', '廉贞'],
    '丁': ['太阴', '天同', '天机', '巨门'],
    '戊': ['贪狼', '太阴', '右弼', '天机'],
    '己': ['武曲', '贪狼', '天梁', '文曲'],
    '庚': ['太阳', '武曲', '太阴', '天同'],
    '辛': ['巨门', '太阳', '文曲', '文昌'],
    '壬': ['天梁', '紫微', '左辅', '武曲'],
    '癸': ['破军', '巨门', '太阴', '贪狼']
  };
  var SIHUA_NAME = ['禄', '权', '科', '忌'];
  var SIHUA_DESC = {
    '禄': '主收获与机会，相关领域容易顺遂、有实际好处',
    '权': '主掌控与推动，相关领域有主导欲与执行力',
    '科': '主名声与条理，相关领域容易获得认可与好评',
    '忌': '主牵挂与阻碍，相关领域需要多花心思经营'
  };

  /* ===================== 排盘渲染 ===================== */

  function renderPillars(pan) {
    var p = pan.pillars;
    function col(key, label) {
      var x = p[key];
      var wu = GZ.WUXING ? GZ.WUXING : null;
      var gw = GZ.GAN_WUXING ? GZ.GAN_WUXING[x.gan] : '';
      var zw = GZ.ZHI_WUXING ? GZ.ZHI_WUXING[x.zhi] : '';
      return '<div class="pillar' + (key === 'day' ? ' pillar--day' : '') + '">' +
        '<div class="pillar__label">' + label + '</div>' +
        '<div class="pillar__gan">' + U.esc(x.gan) + '</div>' +
        '<div class="pillar__wuxing">' + U.esc(gw) + '</div>' +
        '<div class="pillar__zhi">' + U.esc(x.zhi) + '</div>' +
        '<div class="pillar__wuxing">' + U.esc(zw) + '</div>' +
        '<div class="pillar__shishen">' + U.esc(x.shishen) + '</div>' +
        '<div class="pillar__cang">' + U.esc(x.canggan) + '</div>' +
        '</div>';
    }
    return '<div class="pillars">' +
      col('year', '年柱') + col('month', '月柱') + col('day', '日柱') +
      col('hour', '时柱') + '</div>';
  }

  function renderWuxing(pan) {
    var wx = pan.wuxing;
    var max = 0;
    Object.keys(wx.score).forEach(function (k) { if (wx.score[k] > max) max = wx.score[k]; });
    var order = ['木', '火', '土', '金', '水'];
    var bars = order.map(function (k) {
      return U.wxBar(k, Math.round(wx.score[k] * 10) / 10, Math.round(max * 10) / 10, WX_TRAIT[k].c);
    }).join('');
    var missing = pan.yongshen.missing || [];
    var note = missing.length
      ? '本局' + missing.join('、') + '偏弱（原局天干地支中力量最少），日常可多用该属性对应的色系与方位做平衡。'
      : '五行分布相对完整，无明显缺失，能量流转较为均衡。';
    return '<div class="wuxing-bars">' + bars + '</div>' +
      '<div class="rsec__body" style="margin-top:var(--sp-4);font-size:var(--fs-12);color:var(--tx-secondary)">' + U.esc(note) + '</div>';
  }

  /* ===================== 分区一：倪海厦命理 ===================== */

  /* 天纪规则层（global.NIHAIXIA_RULES）惰性读取 */
  function NR() { return global.NIHAIXIA_RULES || null; }

  /* ---------- 天纪 · 三层总纲（天机道 / 人间道 / 地脉道）---------- */
  function sanCaiIntro() {
    var N = NR();
    if (!N) return '';
    var rows = Object.keys(N.FRAMES).map(function (k) {
      var f = N.FRAMES[k];
      return [U.kw(f.name), U.esc(f.sub), U.esc(f.d)];
    });
    var nk = (global.KB_INLINE && global.KB_INLINE.nihaixia) || {};
    /* 倪师原论：剥掉标题行与 markdown 引用符 */
    function cleanQuote(md) {
      if (!md) return '';
      return String(md).split('\n')
        .filter(function (ln) { return ln.trim() && ln.indexOf('### ') !== 0; })
        .map(function (ln) { return ln.replace(/^\s*>\s?/, '').trim(); })
        .filter(Boolean).join(' ');
    }
    var q1 = cleanQuote(nk.lunMing);
    var q2 = cleanQuote(nk.lunYi);
    return U.paras([
      '天纪分三层：<strong>天机道</strong>（以紫微斗数论天命）、<strong>人间道</strong>（以六十四卦断人事）、' +
      '<strong>地脉道</strong>（以卦象配阳宅地理）。三层之上统于一句话——天、人、地三才一体，' +
      '天命、人事、地理相互影响，缺一层都断不准。'
    ]) +
      U.table(['层次', '体系', '所论'], rows) +
      (q1 ? '<div style="margin-top:var(--sp-4)">' + U.saying(q1, '倪海厦《天纪》· 论命理') + '</div>' : '') +
      (q2 ? U.saying(q2, '倪海厦《天纪》· 论易经') : '');
  }

  /* ---------- 天纪 · 天机道（紫微斗数层）----------
     天纪以紫微斗数为体；本层把本项目紫微引擎的结果，用仓库里的
     十四主星表与十二宫主管表重新表述，使「倪氏紫微」可独立成段。 */
  function tianjiBlock(pan) {
    var N = NR();
    if (!N) return '';
    var zw;
    try { zw = computeZiwei(pan); } catch (e) { return ''; }
    var mingStars = zw.mingPalace.stars;
    var out = [];

    out.push(U.paras([
      '天纪以「天机道」为体——倪师论命先立一盘，看星落何宫、宫主何事。本命' +
      U.kw(GZ.ZHI[zw.mingIdx] + '宫') + '立命，' + U.kw(zw.bureau.name) + '起局，身宫落' +
      U.kw(GZ.ZHI[zw.shenIdx] + '宫') + '。'
    ]));

    /* 命宫主星 → 倪师天纪定性 */
    if (mingStars.length) {
      out.push(U.table(['命宫主星', '五行', '倪师天纪定性'],
        mingStars.map(function (s) {
          var t = N.starTraitTianji(s) || { wx: '—', d: '—' };
          return [U.kw(s), U.esc(t.wx), U.esc(t.d)];
        })));
    } else {
      out.push(U.paras(['命宫无十四主星坐守，天纪谓之「命无正曜」，须借对宫 ' +
        U.kw(palaceNameAt(zw, mod(zw.mingIdx + 6, 12)) + '宫') + ' 之力定向。']));
    }

    /* 十二宫 × 天纪主管 */
    out.push('<div style="margin-top:var(--sp-5)">' +
      U.table(['宫位', '天纪主管', '本宫星曜'], zw.palaces.map(function (p) {
        var duty = N.palaceDutyTianji(p.name) || palaceDuty(p.name);
        return [
          U.esc(palaceLabel(p.name)) + ' <span class="num">' + U.esc(p.gan + p.zhi) + '</span>',
          U.esc(duty),
          p.stars.length
            ? p.stars.map(function (s) { return starBr(s, p.zhi); }).join('　')
            : '<span style="color:var(--tx-tertiary)">（无正曜）</span>'
        ];
      })) + '</div>');

    out.push('<div class="rsec__body" style="margin-top:var(--sp-4);font-size:var(--fs-12);color:var(--tx-tertiary)">' +
      '读法：天机道看「星落何宫」——同一颗星落不同宫，倪师的断法不同；' +
      '本表把天纪原表的主管与主星落宫并列，便于逐宫核对。</div>');
    return out.join('');
  }

  /* ---------- 天纪 · 人间道（断事取卦层）----------
     仓库未载起卦法，此处采用梅花易数时间起卦法（确定性），
     得卦后取「六十四卦人事应用」原文作为断事依据。 */
  function renjianBlock(pan, liunianZhi) {
    var N = NR();
    if (!N) return '';
    var lunar = pan.input.lunar;
    var shichenIdx = zhiIndexOfShichen(pan.input.shichen);
    var yearZhiIdx = (liunianZhi != null)
      ? GZ.ZHI.indexOf(liunianZhi)
      : GZ.ZHI.indexOf(pan.pillars.year.zhi);
    if (yearZhiIdx < 0) yearZhiIdx = 0;

    var g = N.qiGua({
      yearZhiIdx: yearZhiIdx,
      month: lunar.month,
      day: lunar.day,
      shichenIdx: shichenIdx
    });
    if (!g || !g.gua) return '';

    var tU = g.trigramUpper, tL = g.trigramLower;
    var dm = N.dimaiGuaOf(g.name);
    var rows = [
      ['起卦', '年支序 ' + (yearZhiIdx + 1) + ' + 农历' + U.cnMonth(lunar.month) + '月 + ' + U.cnDay(lunar.day) +
        ' = ' + g.sums.upper + '，取 8 余数 ' + g.upperNum + ' → 上卦 ' + g.upper + tU.sym + '（' + tU.nature + '）'],
      ['', '再加时支序 ' + (shichenIdx + 1) + ' = ' + g.sums.lower + '，取 8 余数 ' + g.lowerNum +
        ' → 下卦 ' + g.lower + tL.sym + '（' + tL.nature + '）；动爻取 6 余数 ' + g.moving],
      ['得卦', U.kw(g.name) + '（第 ' + U.esc(g.gua.no) + ' 卦 · ' + U.esc(g.gua.symbol) + '）'],
      ['卦象', '上' + g.upper + '（' + tU.trait + '）／下' + g.lower + '（' + tL.trait + '）'],
      ['人事应用', U.esc(g.text || '—')],
      ['君子之道', U.esc(N.JUNZI.junzi)],
      ['小人之道', U.esc(N.JUNZI.xiaoren)]
    ];
    if (dm) rows.push(['地脉道卦例（倪师原书）', U.esc(dm)]);

    return U.paras([
      '倪师说，易经不是用来算命的，是用来教人怎么当君子、怎么避小人的——' +
      '这一层就按人间道的规矩来：先起卦，再照卦辞论人事。'
    ]) +
      '<div style="margin-top:var(--sp-4)">' + U.table(['项', '内容'], rows) + '</div>' +
      U.paras([
        '<strong>断事落点：</strong>' + U.esc(g.text || '') +
        '　——落到本人身上，就是把这条处世原则用在当前处境：' +
        (g.moving ? '第 ' + g.moving + ' 爻为动爻，' : '') + '变在细处，不必急着求结果。',
        '起卦法说明：天纪原书未载起卦法，此处采用<strong>梅花易数时间起卦法</strong>（以农历月日与时辰定上下卦），' +
        '属本项目的桥接实现，确定性可复现；卦辞则取仓库《天纪·人间道》六十四卦人事应用原文。'
      ]);
  }

  /* ---------- 天纪 · 地脉道（地理层）---------- */
  function dimaiBlock() {
    var N = NR();
    if (!N) return '';
    return U.paras([
      '地脉道讲的是「住哪里、怎么坐向」，倪师谓阳宅方位会直接影响居者的运、健康与婚姻。'
    ]) + U.table(['地理五要', '所主'], N.DILI5.map(function (x) {
      return [U.kw(x.k), U.esc(x.d)];
    })) +
      '<div class="rsec__body" style="margin-top:var(--sp-4);font-size:var(--fs-12);color:var(--tx-tertiary)">' +
      '注：本工具不采集住宅坐向数据，故此层仅列天纪原法纲要，不作个人化断语——' +
      '缺条件就不硬断，这是本工具的取舍。</div>';
  }

  function nihaixia(pan, res) {
    var U2 = U;
    var p = pan.pillars;
    var dayGan = pan.dayGan;
    var dayWu = pan.yongshen.dayWu;
    var strength = pan.strength;
    var yong = pan.yongshen;
    var zc = pan.zodiac;
    var sexCn = pan.input.sex === 'male' ? '男' : '女';
    var now = nowYear();
    var ln = pan.currentLiunian;

    /* 天纪框架：天命（先天禀赋）→ 人事（性格与抉择）→ 地理（环境方位）→ 流年（岁运） */
    var coreWu = WX_TRAIT[dayWu];

    /* 核心命格定性 */
    var gejuText = pan.geju.name + '（' + pan.geju.type + '）';
    var strengthCn = strength.level;
    var coreKeywords = [];
    coreKeywords.push(dayWu + '命日主');
    coreKeywords.push(strength.level);
    if (pan.geju.mainShishen) coreKeywords.push(pan.geju.mainShishen + '当令');
    if (yong.tiaohou) coreKeywords.push('调候取' + yong.tiaohou);
    if (pan.shensha.some(function (s) { return s.name === '天乙贵人' && s.ji === '吉'; })) coreKeywords.push('带天乙贵人');
    if (pan.shensha.some(function (s) { return s.name === '华盖'; })) coreKeywords.push('带华盖');
    coreKeywords = coreKeywords.slice(0, 5);

    /* --- 总盘解析 --- */
    var tianming = [
      '本命日主为 ' + U.kw(dayGan + '（' + dayWu + '）') + '，生于 ' + U.esc(pan.input.lunar.year + '年' +
        U.cnMonth(pan.input.lunar.month) + '月' + U.cnDay(pan.input.lunar.day)) + '（' + sexCn + '命，生肖' + zc + '）。' +
      '四柱为 ' + U.kw(pillarsStr(p)) + '，' + U.kw(strengthCn) + '之局。',
      '按天纪「天命」一层看，日主属' + dayWu + '，其气' + coreWu.t + '。' + coreWu.d +
      '月令在' + (GZ.ZHI_WUXING ? GZ.ZHI_WUXING[p.month.zhi] : '') + '，' +
      (strength.deLing ? '得月令之助，先天根基较厚。' : '未得月令之助，先天更适合靠后天积累起势。') +
      (strength.deDi ? '日支有根，遇事能站得住。' : '日支根气偏薄，做事需更多外部支撑。')
    ];

    var renshi = [
      '「人事」一层看性格与抉择：' + U.kw(p.day.shishen === '—' ? '日主自坐' + (GZ.ZHI_WUXING ? GZ.ZHI_WUXING[p.day.zhi] : '') : p.day.shishen) +
      '，性格上' + (p.day.shishen !== '—' && SHISHEN_TRAIT[p.day.shishen] ? SHISHEN_TRAIT[p.day.shishen].t : '自主、务实') + '。' +
      '月柱' + p.month.gan + p.month.zhi + '为' + p.month.shishen + '，代表' + (SHISHEN_FIELD[p.month.shishen] || '事业与人际') +
      '方面是你较早发力、也较早遇到课题的领域。',
      '年柱' + p.year.gan + p.year.zhi + '（' + p.year.shishen + '）主早年环境与家族印迹；' +
      '时柱' + p.hour.gan + p.hour.zhi + '（' + p.hour.shishen + '）主晚景与成果落点。' +
      '整体看，' + (strength.level.indexOf('旺') >= 0
        ? '身强之人宜「泄」与「耗」——把力气用在做事与产出上，比一味硬扛更容易出成绩。'
        : '身弱之人宜「帮」与「生」——借力、结盟、稳住基本盘，比单打独斗更顺。')
    ];

    var dili = [
      '「地理」一层看环境与方位：喜用之气为 ' + U.kw(yong.xiyong.join('、')) + '，' +
      '宜多往这些属性对应的方位、城市、场所活动。',
      '具体到生活层面：' + yong.xiyong.map(function (w) {
        var L = WX_LIFE[w];
        return w + '——方位' + L.dir + '、色调' + L.color + '、宜' + L.habit;
      }).join('；') + '。'
    ];

    var duanyu = [];
    if (pan.shensha.some(function (s) { return s.name === '天乙贵人'; })) {
      duanyu.push({ text: '天乙贵人临命，遇难有援手，逢事常得贵人点拨。', src: '《三命通会》· 天乙贵人条' });
    }
    if (pan.shensha.some(function (s) { return s.name === '华盖'; })) {
      duanyu.push({ text: '华盖入命，性喜清静，于玄学、艺术、哲思一道易有天分。', src: '《三命通会》· 华盖条' });
    }
    if (pan.geju.name.indexOf('建禄') >= 0 || pan.geju.name.indexOf('羊刃') >= 0) {
      duanyu.push({ text: '禄刃当权，自立门户，不喜受人牵制。', src: '《渊海子平》· 禄刃格' });
    }
    if (!duanyu.length) {
      duanyu.push({ text: '命局平正，宜循序而进，积小胜为大胜。', src: '传统子平通义' });
    }

    /* --- 流年专项 --- */
    var liunianText = [
      '当前为 ' + U.kw(now + ' 年 ' + ln.gz) + '（' + ln.gan + ln.zhi + '）。' +
      '本年天干' + ln.gan + '为日主之' + shishenOf(pan, ln.gan) + '，地支' + ln.zhi + '为日主之' + shishenOf(pan, ln.zhi, true) + '。',
      '事业层面：' + liunianFieldAdvice(pan, ln, '事业'),
      '财运层面：' + liunianFieldAdvice(pan, ln, '财运'),
      '人际感情：' + liunianFieldAdvice(pan, ln, '人际'),
      '健康提示：' + liunianFieldAdvice(pan, ln, '健康')
    ];

    /* --- 趋避建议 --- */
    var tipsArr = [
      { t: '顺势方向', d: '把主要精力投向' + yong.xiyong.slice(0, 2).join('、') + '属性相关的行业与事务——' +
          yong.xiyong.slice(0, 2).map(function (w) { return w + '（' + WX_TRAIT[w].t + '）'; }).join('、') + '。' },
      { t: '宜留意', d: '忌神之气为' + yong.jishen.join('、') + '，对应' +
          yong.jishen.map(function (w) { return w + '（' + (WX_LIFE[w] ? WX_LIFE[w].habit : '') + '）'; }).join('；') +
          '。并非不能接触，而是不必过度投入。' },
      { t: '行事节奏', d: strength.level.indexOf('旺') >= 0
          ? '身强者宜主动出击、以产出取胜，避免把能量空耗在纠结上。'
          : '身弱者宜先结盟借力、稳住基本盘，再逐步扩张。' },
      { t: '忌讳行为', d: '避免在情绪高点做大额或不可逆的决定；避免长期透支作息——' +
          '日主' + dayWu + '对应身体' + (GZ.WUXING_ADVICE && GZ.WUXING_ADVICE[dayWu] ? GZ.WUXING_ADVICE[dayWu].organ : '相关脏腑') + '，宜规律养护。' }
    ];

    /* 倪师口吻（确定性取用：同一命盘每次渲染一致；医疗类口头禅已在规则层剔除） */
    var vc = NR() ? NR().voice(String(dayGan) + pan.pillars.year.zhi + pan.input.shichen) : null;

    /* 流年卦（人间道 · 以流年支起卦） */
    var lnGua = (function () {
      var N = NR();
      if (!N) return '';
      var g = N.qiGua({
        yearZhiIdx: GZ.ZHI.indexOf(ln.zhi),
        month: pan.input.lunar.month,
        day: pan.input.lunar.day,
        shichenIdx: zhiIndexOfShichen(pan.input.shichen)
      });
      if (!g || !g.gua) return '';
      return '<div style="margin-top:var(--sp-5)">' +
        U.table(['流年卦（人间道 · 断事）', '内容'], [
          ['得卦', U.kw(g.name) + '（第 ' + U.esc(g.gua.no) + ' 卦 · ' + U.esc(g.gua.symbol) + ' · 动爻 ' + g.moving + '）'],
          ['人事应用', U.esc(g.text || '—')],
          ['君子 / 小人', '君子之道：' + U.esc(N.JUNZI.junzi) + '；小人之道：' + U.esc(N.JUNZI.xiaoren)]
        ]) + '</div>';
    })();

    return {
      school: 'nihaixia',
      title: '倪海厦天纪体系 · 命盘总解',
      keywords: coreKeywords,
      html:
        U.sum('本命日主 ' + U.kw(dayGan) + '（' + dayWu + '），' + U.kw(strengthCn) + '，成 ' + U.kw(gejuText) +
          '。天纪四层框架下：天命偏' + coreWu.t + '，人事宜' + (strength.level.indexOf('旺') >= 0 ? '主动产出' : '借力稳步') +
          '，喜用之气为 ' + U.kw(yong.xiyong.join('、')) + '。' +
          (vc && vc.lead ? '　' + U.esc(vc.lead) + '，天纪讲命，讲的是天、人、地三才一体，不是单看一个八字就完事。' : '')) +

        U.sec('一、天纪 · 三层总纲', sanCaiIntro()) +
        U.sec('二、天命 · 先天禀赋', U.paras(tianming)) +
        U.sec('三、天机道 · 紫微斗数', tianjiBlock(pan)) +
        U.sec('四、人事 · 性格与抉择', U.paras(renshi)) +
        U.sec('五、人间道 · 断事取卦', renjianBlock(pan)) +
        U.sec('六、地理 · 环境与方位', U.paras(dili) + dimaiBlock()) +
        U.sec('七、流年 · ' + now + ' 年岁运', U.paras(liunianText) + lnGua +
          (vc && vc.lead ? '<div class="rsec__body" style="margin-top:var(--sp-4);font-size:var(--fs-12);color:var(--tx-tertiary)">' +
            U.esc(vc.lead + '，断事归断事，路还是自己走出来的，' + vc.ask) + '</div>' : '')) +
        U.sec('八、专属趋避建议', U.tips(tipsArr)) +
        U.sec('九、经典断语对照', duanyu.map(function (d) { return U.saying(d.text, d.src); }).join('') +
          (vc && vc.assert ? U.saying('天纪的道理就这一条——先认命，再改命。', '倪海厦《天纪》') : '')) +
        U.sec('十、命格核心关键词', U.kwList(coreKeywords))
    };
  }

  /* 十神（含地支按藏干主气取） */
  function shishenOf(pan, gan, isZhi) {
    try {
      if (isZhi) {
        var cg = GZ.CANGGAN ? GZ.CANGGAN[gan] : null;
        if (cg && cg.length) return pan.pillars.month ? shishenByGan(pan.dayGan, cg[0]) : '—';
        return '—';
      }
      return shishenByGan(pan.dayGan, gan);
    } catch (e) { return '—'; }
  }
  function shishenByGan(dayGan, other) {
    var di = GZ.GAN.indexOf(dayGan), oi = GZ.GAN.indexOf(other);
    if (di < 0 || oi < 0) return '—';
    var diff = ((oi - di) % 10 + 10) % 10;
    var same = (di % 2) === (oi % 2);
    var SAME = ['比肩', '食神', '偏财', '偏官', '偏印'];
    var DIFF = ['劫财', '伤官', '正财', '正官', '正印'];
    return (same ? SAME : DIFF)[diff % 5];
  }

  function liunianFieldAdvice(pan, ln, field) {
    var yong = pan.yongshen.xiyong;
    var lnWu = GZ.GAN_WUXING ? GZ.GAN_WUXING[ln.gan] : '';
    var ok = yong.indexOf(lnWu) >= 0;
    var map = {
      '事业': ok ? '本年' + lnWu + '气为喜用，事业上主动争取、承接新任务的成功率偏高，适合推进搁置已久的计划。'
                 : '本年' + lnWu + '气非喜用，事业宜守成与补足短板，不宜大动作换轨，把精力放在把手上事做扎实。',
      '财运': ok ? '财路相对通畅，正财稳、偏财有机会，可适度拓展但要设好止盈线。'
                 : '财运以稳为主，避免高波动投入；重点关注现金流而非收益率。',
      '人际': ok ? '人际运较顺，适合拓展圈子、修复关系，合作类事项容易谈成。'
                 : '人际上易有摩擦，沟通宜慢半拍，重要约定落成文字，避免口头承诺。',
      '健康': '留意' + (GZ.WUXING_ADVICE && GZ.WUXING_ADVICE[lnWu] ? GZ.WUXING_ADVICE[lnWu].organ : '作息') +
              '相关的信号，规律作息、适度运动即可，无需过度担忧。'
    };
    return map[field] || '';
  }

  /* ===================== 分区二：四柱八字 ===================== */

  function bazi(pan, res) {
    var p = pan.pillars, yong = pan.yongshen, strength = pan.strength;
    var now = nowYear();
    var ln = pan.currentLiunian;

    /* 大运：找当前大运 */
    var curDayun = null;
    pan.dayun.forEach(function (d) {
      if (!d.isPre && (pan.ageNow == null || true) && d.startAge != null) {
        /* 用当前年份与起运年推算 */
        var qyYear = pan.input.solar.y + pan.qiyun.years;
        var age = now - qyYear;
        if (d.startAge <= age + pan.qiyun.years && age + pan.qiyun.years <= (d.endAge || 999)) curDayun = d;
      }
    });
    if (!curDayun) {
      var qyYear2 = pan.input.solar.y + pan.qiyun.years;
      var ageNow = now - pan.input.solar.y;
      pan.dayun.forEach(function (d) {
        if (!d.isPre && ageNow >= d.startAge && ageNow <= d.endAge) curDayun = d;
      });
      if (!curDayun && pan.dayun.length > 1) curDayun = pan.dayun[1];
    }

    /* 喜用神适配 */
    var xiLife = yong.xiyong.map(function (w) {
      var L = WX_LIFE[w];
      return { w: w, color: L.color, dir: L.dir, industry: (GZ.WUXING_ADVICE && GZ.WUXING_ADVICE[w] ? GZ.WUXING_ADVICE[w].industry : '') };
    });

    /* 十神分布统计 */
    var ssCount = {};
    ['year', 'month', 'hour'].forEach(function (k) {
      var s = p[k].shishen;
      ssCount[s] = (ssCount[s] || 0) + 1;
    });
    var ssRows = Object.keys(ssCount).map(function (s) {
      var info = SHISHEN_TRAIT[s] || { t: '—', d: '' };
      return ['<strong>' + U.esc(s) + '</strong>（' + ssCount[s] + '）', U.esc(info.t), U.esc(SHISHEN_FIELD[s] || '')];
    });

    var coreKeywords = [];
    coreKeywords.push(pan.dayGan + dayWuLabel(pan) + '日主');
    coreKeywords.push(strength.level);
    coreKeywords.push(yong.xiyong[0] + '为用');
    if (pan.geju.name) coreKeywords.push(pan.geju.name.split(' / ')[0]);
    if (pan.yongshen.missing.length) coreKeywords.push('缺' + pan.yongshen.missing.join(''));

    var tipsArr = [
      { t: '颜色', d: '宜多用 ' + xiLife.map(function (x) { return x.color + '（' + x.w + '）'; }).join('、') + '；' +
          '忌神' + yong.jishen.join('、') + '对应的色系可减少大面积使用。' },
      { t: '方位', d: '宜向 ' + xiLife.map(function (x) { return x.dir + '（' + x.w + '）'; }).join('、') +
          ' 方向发展或旅行；办公座位、居住朝向可优先考虑。' },
      { t: '行业', d: xiLife.filter(function (x) { return x.industry; }).map(function (x) {
            return x.w + '——' + x.industry;
          }).join('；') + '（仅供参考，最终以个人兴趣与能力为准）。' },
      { t: '作息与习惯', d: yong.xiyong.map(function (w) { return w + '：' + WX_LIFE[w].habit; }).join('；') + '。' },
      { t: '大运规避要点', d: curDayun
          ? '当前走 ' + curDayun.gz + ' 运（' + curDayun.range + '）。' +
            (yong.xiyong.indexOf(GZ.GAN_WUXING[curDayun.gan]) >= 0
              ? '大运天干为喜用，是可用力推进的十年，宜主动布局。'
              : '大运天干非喜用，宜稳守积累、补足短板，把这段当作打基础的阶段。')
          : '尚未起运，可先按原局喜用调养。' }
    ];

    /* 大运表 */
    var dayunRows = pan.dayun.filter(function (d) { return !d.isPre; }).map(function (d) {
      var gw = GZ.GAN_WUXING[d.gan];
      var isXi = yong.xiyong.indexOf(gw) >= 0;
      return [
        U.esc(d.seq),
        '<span class="num">' + U.esc(d.range) + '</span>',
        '<strong>' + U.esc(d.gz) + '</strong>',
        U.esc(gw),
        U.esc(shishenByGan(pan.dayGan, d.gan)),
        U.tag(isXi ? '喜用' : '平常', isXi ? 'ok' : 'idle')
      ];
    });

    /* 关键年份提醒：未来 10 年流年中干支为喜用者 */
    var keyYears = (pan.liunian || []).filter(function (l) { return l.year >= now && l.year <= now + 9; })
      .map(function (l) {
        var gw = GZ.GAN_WUXING[l.gan];
        var isXi = yong.xiyong.indexOf(gw) >= 0;
        return { year: l.year, gz: l.gz, isXi: isXi };
      });

    return {
      school: 'bazi',
      title: '四柱八字 · 全局解读',
      keywords: coreKeywords,
      html:
        U.sum('四柱 ' + U.kw(pillarsStr(p)) + '，日主 ' + U.kw(pan.dayGan + '（' + dayWuLabel(pan) + '）') + '，' +
          U.kw(strength.level) + '。成 ' + U.kw(pan.geju.name) + '，喜用神取 ' + U.kw(yong.xiyong.join('、')) +
          '，忌神为 ' + U.kw(yong.jishen.join('、')) + '。') +

        U.sec('一、八字完整排盘',
          U.paras([
            '四柱：' + U.kw(pillarsStr(p)) + '　|　生肖 ' + U.esc(pan.zodiac) + '　|　' +
            U.esc(pan.input.sex === 'male' ? '乾造（男）' : '坤造（女）'),
            '起运：出生后 ' + pan.qiyun.years + ' 年 ' + pan.qiyun.months + ' 个月起运，大运' +
            U.kw(pan.dayunForward ? '顺行' : '逆行') + '。'
          ]) +
          '<div style="margin-top:var(--sp-4)">' + renderPillars(pan) + '</div>' +
          '<div style="margin-top:var(--sp-4)">' + U.kvRows([
            ['日主', U.kw(pan.dayGan) + '（' + dayWuLabel(pan) + '）'],
            ['旺衰', U.kw(strength.level) + '（评分 ' + strength.score + '/100）'],
            ['得令', strength.deLing ? '是 — 月令生扶' : '否 — 月令未助'],
            ['得地', strength.deDi ? '是 — 日支有根' : '否 — 日支根薄'],
            ['得势', strength.deShi ? '是 — 天干有助' : '否 — 天干无助'],
            ['格局', U.kw(pan.geju.name) + '（' + pan.geju.type + '，' + pan.geju.purity + '）'],
            ['调候', yong.tiaohou ? U.kw(yong.tiaohou) : '—']
          ]) + '</div>'
        ) +

        U.sec('二、五行平衡分析', renderWuxing(pan)) +

        U.sec('三、喜用神判定',
          U.paras(yong.reasons.map(function (r) { return U.esc(r); }).concat([
            '喜用：' + yong.xiyong.map(function (w) { return U.kw(w, 'good'); }).join('、') +
            '　忌神：' + yong.jishen.map(function (w) { return U.kw(w, 'xiong'); }).join('、')
          ]))
        ) +

        U.sec('四、十神性格详解',
          ssRows.length
            ? U.table(['十神', '性格倾向', '主管领域'], ssRows) +
              '<div class="rsec__body" style="margin-top:var(--sp-4);font-size:var(--fs-13)">' +
              U.esc(pan.geju.desc || '') + '</div>'
            : '<div class="rsec__body">十神分布均衡。</div>'
        ) +

        U.sec('五、总盘全局解读',
          U.paras([
            '<strong>本命性格：</strong>日主 ' + pan.dayGan + ' 属' + dayWuLabel(pan) + '，' + WX_TRAIT[dayWuLabel(pan)].t + '。' +
            WX_TRAIT[dayWuLabel(pan)].d + '结合' + strength.level + '之势，' +
            (strength.level.indexOf('旺') >= 0
              ? '为人主见强、能扛事，做事习惯自己拿主意。'
              : '为人相对温和、善于配合，在团队中容易成为稳定器。'),
            '<strong>事业天赋：</strong>喜用在 ' + yong.xiyong.join('、') + '，' +
            '对应 ' + yong.xiyong.map(function (w) { return WX_TRAIT[w].t; }).join('；') +
            '。' + (pan.geju.desc || ''),
            '<strong>财运格局：</strong>' + wealthAdvice(pan),
            '<strong>感情婚姻：</strong>' + marriageAdvice(pan),
            '<strong>健康倾向：</strong>日主' + dayWuLabel(pan) + '对应' +
            (GZ.WUXING_ADVICE && GZ.WUXING_ADVICE[dayWuLabel(pan)] ? GZ.WUXING_ADVICE[dayWuLabel(pan)].organ : '相关系统') +
            '，' + (yong.missing.length ? '原局' + yong.missing.join('、') + '偏弱，宜留意相关系统的日常养护。' : '五行较均衡，保持规律作息即可。'),
            '<strong>贵人运势：</strong>' + guirenAdvice(pan)
          ])
        ) +

        U.sec('六、十年大运走势', U.table(['序', '年龄段', '大运', '五行', '十神', '喜忌'], dayunRows) +
          (curDayun ? '<div class="rsec__body" style="margin-top:var(--sp-4)">当前大运：' + U.kw(curDayun.gz + '（' + curDayun.range + '）') +
            '。' + U.esc(tipsArr[4].d) + '</div>' : '')
        ) +

        U.sec('七、' + now + ' 年流年解析',
          U.paras([
            '流年 ' + U.kw(ln.gz) + '。天干 ' + ln.gan + '（' + (GZ.GAN_WUXING ? GZ.GAN_WUXING[ln.gan] : '') + '）' +
            (yong.xiyong.indexOf(GZ.GAN_WUXING[ln.gan]) >= 0 ? '属喜用，' : '非喜用，') +
            '地支 ' + ln.zhi + '（' + (GZ.ZHI_WUXING ? GZ.ZHI_WUXING[ln.zhi] : '') + '）。',
            '事业：' + liunianFieldAdvice(pan, ln, '事业'),
            '财运：' + liunianFieldAdvice(pan, ln, '财运'),
            '人际：' + liunianFieldAdvice(pan, ln, '人际'),
            '健康：' + liunianFieldAdvice(pan, ln, '健康')
          ])
        ) +

        U.sec('八、大运关键年份提醒',
          '<div class="stack-sm">' + keyYears.map(function (k) {
            return '<div class="tip"><span class="tip__mark">' + (k.isXi ? '吉' : '平') + '</span>' +
              '<div><div class="tip__title">' + k.year + ' 年 ' + U.esc(k.gz) + '</div>' +
              '<div class="tip__desc">' + (k.isXi
                ? '干支为喜用之气，是可主动争取的窗口年，适合推进重要计划。'
                : '干支非喜用，宜稳守积累、避免大动作，把基础打牢。') + '</div></div></div>';
          }).join('') + '</div>'
        ) +

        U.sec('九、八字专属建议', U.tips(tipsArr)) +

        U.sec('十、命格核心关键词', U.kwList(coreKeywords))
    };
  }

  function dayWuLabel(pan) { return pan.yongshen.dayWu; }

  function wealthAdvice(pan) {
    var yong = pan.yongshen;
    var hasCai = ['正财', '偏财'].some(function (s) {
      return [pan.pillars.year.shishen, pan.pillars.month.shishen, pan.pillars.hour.shishen].indexOf(s) >= 0;
    });
    if (hasCai && yong.xiyong.indexOf(yong.woKe) >= 0) return '财星透出且为我所用，属「身财两停」之象，赚钱靠主动经营，宜稳步放大。';
    if (hasCai) return '财星现于命局，赚钱机会不少，但需注意量力而行，避免在非喜用年份做大额投入。';
    return '原局财星不显，财运更依赖' + yong.xiyong.join('、') + '之气的积累——把主业做深、把专业变成稀缺，财自来。';
  }
  function marriageAdvice(pan) {
    var p = pan.pillars;
    var sex = pan.input.sex;
    var spousePalace = GZ.ZHI_WUXING ? GZ.ZHI_WUXING[p.day.zhi] : '';
    var isXi = pan.yongshen.xiyong.indexOf(spousePalace) >= 0;
    var base = '日支（夫妻宫）为 ' + p.day.zhi + '（' + spousePalace + '），' +
      (isXi ? '为喜用之气，配偶多能成为助力，相处中容易获得支持。' : '非喜用之气，感情中需要更多磨合与体谅，不宜急于推进。');
    var guan = sex === 'female' ? '正官/偏官' : '正财/偏财';
    var hasGuan = [p.year.shishen, p.month.shishen, p.hour.shishen].some(function (s) {
      return s === '正官' || s === '偏官' || s === '正财' || s === '偏财';
    });
    return base + (hasGuan ? '命局中' + guan + '有力，感情线相对清晰，适合在运势顺遂年（喜用流年）推进。'
      : '命局中' + guan + '不显，感情上更宜顺其自然，重在经营日常相处的质量。');
  }
  function guirenAdvice(pan) {
    var gui = pan.shensha.filter(function (s) { return s.ji === '吉'; }).map(function (s) { return s.name; });
    if (!gui.length) return '命局吉星不显，贵人更多来自你自身的可靠度——把事情做到位，自然会有人愿意帮你。';
    return '命中吉星：' + gui.map(function (g) { return U.kw(g); }).join('、') + '。' +
      '其中天乙贵人主遇难得助、月德主逢凶化吉，说明关键节点上常有人愿意搭一把手。';
  }

  /* ===================== 分区三：紫微斗数 ===================== */

  /* 紫微安星（简化确定性版本，供本工具内部使用）
     —— 说明：MingLi-Bench 提供的是预排盘快照（iztro），
        本项目排盘采用「命宫→五行局→紫微星位→十四主星顺逆布星」标准流程。
     流派差异点（如四化表取法）已在 resource 中标注。 */
  function computeZiwei(pan) {
    var lunar = pan.input.lunar;
    var m = lunar.month, d = lunar.day;
    var leap = !!lunar.leap;
    var shichenIdx = zhiIndexOfShichen(pan.input.shichen);
    var sex = pan.input.sex;

    /* ===== 紫微斗数与四柱八字（子平）的三大流派差异 =====
       均以 MingLi-Bench 的 32 例 iztro 权威快照校准（_test/ziwei_cross.js）。

       ① 年干支以「农历正月初一」为界，而非立春。
          —— 八字（子平）用立春分界；紫微斗数建基于农历，故用农历年。
          证据：case_31（1988-02-15，农历丁卯年腊月廿八）若按立春取戊辰年得「土五局」，
                按农历年取丁卯年得「火六局」，与 iztro 一致。

       ② 闰月按「下一月」计（闰十月 → 十一月）。
          证据：case_7（1984-12-09 闰十月十七）闰月按十月算得命宫寅，
                iztro 得卯，即按十一月计。

       ③ 晚子时（23:00-24:00）「生日」顺延一日（时辰仍为子时）。
          证据：case_9（农历九月初五 23:15）按初五得紫微在寅；
                iztro 在卯 → 按初六（木三局 D=6）推得卯，一致。
                case_28（农历三月十七 23:34）按十七得寅；iztro 在未 → 按十八（土五局 D=18）推得未，一致。
    */
    if (pan.input.ziShi === '夜子时' && pan.birthJD != null && A && A.bjdToBeijing && A.solarToLunar) {
      var nx = A.bjdToBeijing(pan.birthJD + 1);
      var nl = A.solarToLunar(nx.y, nx.m, nx.d);
      if (nl) { d = nl.day; m = nl.month; leap = !!nl.leap; }
    }
    /* 差异②：闰月按「下一月」计 —— 但仅下半月（农历日 > 15）。
       ★ 修正记录（2026-09-11）：原实现为 `if (leap) m = m % 12 + 1;`（无条件顺延）。
         iztro 的 fixLunarMonthIndex 实为 `isLeap && lunarDay > 15 && timeIndex !== 12`，
         即闰月**上半月仍算本月**。基准 32 例中唯一的闰月命例（case_7）为十月十七（>15），
         故两种写法在该例上都对，原 bug 未被暴露；此处按 iztro 规则收紧，
         避免闰月初一~十五的命盘命宫算错。 */
    if (leap && d > 15) m = m % 12 + 1;

    /* 差异①：年干支取农历年（正月初一为界） */
    var lyIdx = mod((lunar.year != null ? lunar.year : pan.yearNum) - 4, 60);
    var yearGan = GZ.GAN[lyIdx % 10];
    var yearZhi = GZ.ZHI[lyIdx % 12];

    /* --- 定命宫：寅起正月，顺数至生月，再逆数至生时 --- */
    var yinIdx = 2;                             /* 地支索引：子0 丑1 寅2 */
    var mingIdx = mod(yinIdx + (m - 1) - shichenIdx, 12);
    /* 身宫：寅起正月顺数至生月，再顺数至生时 */
    var shenIdx = mod(yinIdx + (m - 1) + shichenIdx, 12);

    /* --- 五行局：由命宫干支纳音定 --- */
    var mingGan = ganOfPalace(mingIdx, yearGan);
    var bureau = wuxingJu(mingGan, GZ.ZHI[mingIdx]);

    /* --- 紫微星定位（标准口诀算法） --- */
    var juNum = bureau.num;
    var ziweiIdx = locateZiwei(juNum, d);

    /* --- 十四主星布列 --- */
    var major = {};
    function put(idx, star) {
      idx = mod(idx, 12);
      (major[idx] = major[idx] || []).push(star);
    }
    /* 紫微系（逆布） */
    var ziweiChain = [['紫微', 0], ['天机', -1], ['太阳', -3], ['武曲', -4], ['天同', -5], ['廉贞', -8]];
    ziweiChain.forEach(function (x) { put(ziweiIdx + x[1], x[0]); });
    /* 天府系（顺布）：天府与紫微关于「寅—申」轴对称 → 天府 = (4 − 紫微) mod 12
       ★ 修正记录（2026-09-11）：原实现为两行赋值，第一行被第二行覆盖（死代码），
         且第二行公式 `mod(12 - ((ziweiIdx-4+12)%12) + 4, 12)` 有误（紫微在寅时算出午宫）。
         经 32 例 iztro 快照验证，正确公式为 (4 - 紫微) mod 12：
           紫微寅→天府寅、紫微卯→天府丑、紫微申→天府申、紫微子→天府辰（12 位全对） */
    var tianfuIdx = mod(4 - ziweiIdx, 12);
    var tianfuChain = [['天府', 0], ['太阴', 1], ['贪狼', 2], ['巨门', 3], ['天相', 4], ['天梁', 5], ['七杀', 6], ['破军', 10]];
    tianfuChain.forEach(function (x) { put(tianfuIdx + x[1], x[0]); });

    /* --- 十四辅星 / 六煞星安星 --- */
    var aux = computeAuxStars(m, shichenIdx, yearGan, yearZhi);

    /* --- 长生十二神：依五行局定起点，阳男阴女顺行 / 阴男阳女逆行 --- */
    var zr = ZR();   /* 规则层（可能为 null，向下逐处判空） */
    var csSeq = (zr && zr.CHANGSHENG_SEQ) || ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
    var csBaseMap = (zr && zr.CHANGSHENG_BASE) || { '水二局': 8, '木三局': 11, '金四局': 5, '土五局': 8, '火六局': 2 };
    var csBase = csBaseMap[bureau.name] != null ? csBaseMap[bureau.name] : 8;
    var yangGan = '甲丙戊庚壬'.indexOf(yearGan) >= 0;
    /* 顺逆同源：阳男 / 阴女 顺行；阴男 / 阳女 逆行
       优先取排盘层归一化后的布尔量 sexMale（见 paipan.js normSex） */
    var sexMale = (pan.input.sexMale != null) ? !!pan.input.sexMale : (sex === 'male');
    var forward = (sexMale === yangGan);
    var csAt = {};
    for (var cs = 0; cs < 12; cs++) csAt[mod(csBase + (forward ? cs : -cs), 12)] = csSeq[cs];

    /* --- 大限：起运年 = 五行局数，与长生同向，每宫十年 --- */
    var decAt = {};
    var startAge = bureau.num;
    for (var dq = 0; dq < 12; dq++) {
      var di = mod(mingIdx + (forward ? dq : -dq), 12);
      decAt[di] = { start: startAge + dq * 10, end: startAge + dq * 10 + 9 };
    }

    /* --- 十二宫名 --- */
    var palaceNames = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '官禄', '田宅', '福德', '父母'];
    var palaces = [];
    for (var i = 0; i < 12; i++) {
      var zhiIdx = mod(mingIdx - i, 12);
      var stars = (major[zhiIdx] || []).slice();
      var ax = (aux[zhiIdx] || []).slice();
      var dec = decAt[zhiIdx];
      palaces.push({
        idx: zhiIdx,
        zhi: GZ.ZHI[zhiIdx],
        gan: ganOfPalace(zhiIdx, yearGan),
        name: palaceNames[i],
        isMing: zhiIdx === mingIdx,
        isShen: zhiIdx === shenIdx,
        stars: stars,
        starInfo: stars.map(function (s) { return { name: s, info: ZIWEI_STARS[s] || null }; }),
        /* 辅星/煞星（含 kind：soft 吉 / tough 煞 / lucun / tianma） */
        aux: ax,
        auxInfo: ax.map(function (a) {
          var info = (zr && zr.AUX_STARS) ? zr.AUX_STARS[a.name] : null;
          return { name: a.name, kind: a.kind, brightness: (zr ? zr.brightness(a.name, GZ.ZHI[zhiIdx]) : ''), info: info };
        }),
        cs: csAt[zhiIdx] || '',
        dec: dec ? { start: dec.start, end: dec.end, range: [dec.start, dec.end], gan: ganOfPalace(zhiIdx, yearGan), zhi: GZ.ZHI[zhiIdx] } : null
      });
    }
    /* 当前大限宫（以今年年龄落入的区间为准） */
    var ageNow = null;
    try { ageNow = nowYear() - (pan.input.lunar ? pan.input.lunar.year : pan.yearNum) + 1; } catch (e) { ageNow = null; }
    var curDec = null;
    if (ageNow != null) {
      palaces.forEach(function (p) {
        if (p.dec && ageNow >= p.dec.start && ageNow <= p.dec.end) curDec = p;
      });
    }

    /* --- 生年四化 --- */
    var sihua = SIHUA_TABLE[yearGan] || [];
    var sihuaList = sihua.map(function (star, i) {
      return {
        star: star, type: SIHUA_NAME[i], desc: SIHUA_DESC[SIHUA_NAME[i]],
        palace: findPalaceOfStar(palaces, star),
        /* 四化同时落在哪个地支宫（用于取辅星/亮度） */
        zhi: palaceZhiOfStar(palaces, star)
      };
    });

    /* --- 命宫主星 --- */
    var mingPalace = palaces[0];
    return {
      mingIdx: mingIdx, shenIdx: shenIdx, bureau: bureau,
      palaces: palaces, mingPalace: mingPalace,
      sihua: sihuaList, yearGan: yearGan, yearZhi: yearZhi,
      forward: forward, ageNow: ageNow, curDec: curDec,
      lunarMonthEff: m, lunarDayEff: d, leapEff: leap, shichenIdx: shichenIdx
    };
  }

  /* ---------- 辅星 / 煞星安星（十四颗）----------
     规则逐条对齐 iztro 2.6.1《minorStar.js + location.js》，全部换算到本项目的「子 = 0」空间：
       左辅  辰上顺数生月      右弼  戌上逆数生月
       文曲  辰上顺数生时      文昌  戌上逆数生时
       天魁天钺（年干）甲戊庚丑未 · 乙己子申 · 辛午寅 · 丙丁亥酉 · 壬癸卯巳
       禄存（年干）甲寅 乙卯 丙戊巳 丁己午 庚申 辛酉 壬亥 癸子；擎羊 = 禄存 +1，陀罗 = 禄存 −1
       天马  寅午戌→申 · 申子辰→寅 · 巳酉丑→亥 · 亥卯未→巳
       火星铃星（年支起子时位，顺数生时）寅午戌起丑卯 · 申子辰起寅戌 · 巳酉丑起卯戌 · 亥卯未起酉戌
       地劫  亥上顺数生时      地空  亥上逆数生时
     ★ 校验：_test/ziwei_ext_cross.js 与基准 32 例快照的 S 数组比对（14 星 × 32 例 = 448 点）。 */
  var LUCUN_BY_GAN = { '甲': 2, '乙': 3, '丙': 5, '戊': 5, '丁': 6, '己': 6, '庚': 8, '辛': 9, '壬': 11, '癸': 0 };
  var KUIYUE_BY_GAN = {
    '甲': [1, 7], '戊': [1, 7], '庚': [1, 7],
    '乙': [0, 8], '己': [0, 8],
    '辛': [6, 2],
    '丙': [11, 9], '丁': [11, 9],
    '壬': [3, 5], '癸': [3, 5]
  };
  var MA_BY_ZHI = { '寅': 8, '午': 8, '戌': 8, '申': 2, '子': 2, '辰': 2, '巳': 11, '酉': 11, '丑': 11, '亥': 5, '卯': 5, '未': 5 };
  var HUOLING_BY_ZHI = {
    '寅': [1, 3], '午': [1, 3], '戌': [1, 3],
    '申': [2, 10], '子': [2, 10], '辰': [2, 10],
    '巳': [3, 10], '酉': [3, 10], '丑': [3, 10],
    '亥': [9, 10], '卯': [9, 10], '未': [9, 10]
  };
  function computeAuxStars(mLunar, t, yearGan, yearZhi) {
    var out = {};
    function put(idx, name, kind) {
      var i = mod(idx, 12);
      (out[i] = out[i] || []).push({ name: name, kind: kind });
    }
    put(4 + (mLunar - 1), '左辅', 'soft');   /* 辰(4) 顺数生月 */
    put(10 - (mLunar - 1), '右弼', 'soft');  /* 戌(10) 逆数生月 */
    put(4 + t, '文曲', 'soft');              /* 辰(4) 顺数生时 */
    put(10 - t, '文昌', 'soft');             /* 戌(10) 逆数生时 */
    var ky = KUIYUE_BY_GAN[yearGan] || [1, 7];
    put(ky[0], '天魁', 'soft');
    put(ky[1], '天钺', 'soft');
    var lu = LUCUN_BY_GAN[yearGan];
    if (lu == null) lu = 2;
    put(lu, '禄存', 'lucun');
    put(lu + 1, '擎羊', 'tough');
    put(lu - 1, '陀罗', 'tough');
    put(MA_BY_ZHI[yearZhi] != null ? MA_BY_ZHI[yearZhi] : 8, '天马', 'tianma');
    var hl = HUOLING_BY_ZHI[yearZhi] || [2, 10];
    put(hl[0] + t, '火星', 'tough');
    put(hl[1] + t, '铃星', 'tough');
    put(11 + t, '地劫', 'tough');            /* 亥(11) 顺数生时 */
    put(11 - t, '地空', 'tough');            /* 亥(11) 逆数生时 */
    return out;
  }
  /* 取某星所在宫的地支（供四化取亮度用） */
  function palaceZhiOfStar(palaces, star) {
    for (var i = 0; i < palaces.length; i++) {
      if (palaces[i].stars.indexOf(star) >= 0 || (palaces[i].aux || []).some(function (a) { return a.name === star; })) {
        return palaces[i].zhi;
      }
    }
    return '';
  }

  function mod(n, m) { return ((n % m) + m) % m; }
  function zhiIndexOfShichen(shichen) {
    var ZHI = GZ.ZHI;
    /* 子时归 0（本项目按「早子时/晚子时」统一取子 = 0） */
    for (var i = 0; i < ZHI.length; i++) if (ZHI[i] === shichen) return i;
    return 0;
  }
  /* 五虎遁：由年干起寅宫天干 */
  var WUHU = { '甲': '丙', '己': '丙', '乙': '戊', '庚': '戊', '丙': '庚', '辛': '庚', '丁': '壬', '壬': '壬', '戊': '甲', '癸': '甲' };
  function ganOfPalace(zhiIdx, yearGan) {
    var yinGan = WUHU[yearGan] || '丙';
    var yinGanIdx = GZ.GAN.indexOf(yinGan);
    if (yinGanIdx < 0) yinGanIdx = 2;
    var step = mod(zhiIdx - 2, 12);
    return GZ.GAN[mod(yinGanIdx + step, 10)];
  }
  /* 五行局：由命宫干支的「六十甲子纳音」决定
     —— 水二局 / 木三局 / 金四局 / 土五局 / 火六局
     ★ 修正记录（2026-09-11）：原实现用「命宫地支五行 + 天干五行的合化倾向」自创简化规则，
       经 MingLi-Bench 32 例 iztro 权威快照交叉校验，一致率仅 12.5%，并连带导致紫微星定位
       错误、十四主星全盘错位（0%）。正确算法为纳音五行，修正后一致率见 _test/ziwei_cross.js */
  var JU_BY_WUXING = {
    '水': { name: '水二局', num: 2 },
    '木': { name: '木三局', num: 3 },
    '金': { name: '金四局', num: 4 },
    '土': { name: '土五局', num: 5 },
    '火': { name: '火六局', num: 6 }
  };
  function wuxingJu(gan, zhi) {
    var w = (GZ.nayinWuxing ? GZ.nayinWuxing(gan, zhi) : null);
    return JU_BY_WUXING[w] || JU_BY_WUXING['土'];
  }
  /* 紫微星定位：以五行局数与生日查表法（标准「紫微星安星表」的算法化） */
  function locateZiwei(juNum, day) {
    /* 逐局推：找出满足 (day + x) 能被 juNum 整除的最小非负 x */
    var x = 0;
    while ((day + x) % juNum !== 0) x++;
    var q = (day + x) / juNum;
    var base = mod(2 + q - 1, 12);          /* 从寅宫起，顺行 q-1 位 */
    if (x % 2 === 1) base = mod(base - x, 12);  /* 奇数补位则退 x 位 */
    else base = mod(base + x, 12);              /* 偶数补位则进 x 位 */
    return base;
  }
  /* ★ 修正记录（2026-09-11）：原实现只搜十四主星，导致「文昌/文曲/左辅/右弼」为化星时
     （丙年文昌化科、戊年右弼化科、己年文曲化忌、辛年文曲/文昌、壬年左辅化科…）
     一律返回「不在四正宫（借对宫）」。现同时检索辅星位置。 */
  function findPalaceOfStar(palaces, star) {
    for (var i = 0; i < palaces.length; i++) {
      if (palaces[i].stars.indexOf(star) >= 0) return palaces[i].name;
      var ax = palaces[i].aux || [];
      for (var j = 0; j < ax.length; j++) if (ax[j].name === star) return palaces[i].name;
    }
    return '不在四正宫（借对宫）';
  }

  /* 宫名显示：统一补「宫」字（内部数据里「命宫」已带宫、「兄弟」不带，风格不一） */
  function palaceLabel(name) { return /宫$/.test(name) ? name : name + '宫'; }

  /* ===================== 紫微推理规则层接入（生成式解析支撑） ===================== */
  /* 规则层缺失时整体优雅退化，不影响基础排盘展示 */
  function ZR() { return global.ZIWEI_RULES || null; }

  /* 「紫微（旺·次亮）」——主星带亮度 */
  function starBr(star, zhi) {
    var z = ZR();
    if (!z) return '<strong>' + U.esc(star) + '</strong>';
    var b = z.brightness(star, zhi);
    var lv = b ? z.brLevel(b) : null;
    return '<strong>' + U.esc(star) + '</strong>' +
      (b ? ' <span class="num" style="font-size:var(--fs-11);color:' +
        (lv.lv >= 3 ? 'var(--c-ok)' : (lv.lv >= 1 ? 'var(--tx-secondary)' : 'var(--c-ji)')) + '">' + b + '·' + lv.t + '</span>' : '');
  }
  /* 主星在该宫的实际表现（庙旺走正面 / 落陷走需留意面） */
  function starTone(star, zhi) {
    var z = ZR();
    if (!z) return '';
    var attr = z.STAR_ATTR[star];
    if (!attr) return '';
    var b = z.brightness(star, zhi);
    var lv = b ? z.brLevel(b) : null;
    return (lv && lv.lv >= 3 ? attr.good : attr.bad);
  }
  /* 命宫双星组合解读 */
  function mingPairReading(mingStars) {
    var z = ZR();
    if (!z || mingStars.length !== 2) return null;
    return z.pairOf(mingStars[0], mingStars[1]);
  }
  /* 格局匹配（三方四正口径） */
  function matchGeju(zw) {
    var z = ZR();
    if (!z || !z.GEJU) return [];
    var mingStars = zw.mingPalace.stars.slice();
    var sfIdx = [zw.mingIdx, mod(zw.mingIdx + 4, 12), mod(zw.mingIdx + 6, 12), mod(zw.mingIdx + 8, 12)];
    var sfStarList = [], allStarList = [], palaceStarList = [];
    zw.palaces.forEach(function (p) {
      var names = p.stars.concat((p.aux || []).map(function (a) { return a.name; }));
      allStarList = allStarList.concat(names);
      palaceStarList.push(names);
      if (sfIdx.indexOf(p.idx) >= 0) sfStarList = sfStarList.concat(names);
    });
    var ctx = {
      mingStars: mingStars, sanfangStars: sfStarList,
      allStars: allStarList, palaceStars: palaceStarList,
      sihua: zw.sihua, mingIdx: zw.mingIdx, bureau: zw.bureau
    };
    return z.GEJU.filter(function (g) { try { return g.test(ctx); } catch (e) { return false; } });
  }
  /* 生年四化落在指定宫的条目 */
  function sihuaAtPalace(zw, palaceName) {
    return zw.sihua.filter(function (s) { return s.palace === palaceName; });
  }

  /* ---------- 古籍原文对照（《紫微斗数全书》，书 E2）----------
     引用纪律：只引原文，不改写；每处都带书名出处。
     数据经 KB_INLINE.classics 结构化解析（_src/classics/），非人工转述。 */
  function classicStarBlock(star, palaceName, sexMale) {
    var z = ZR();
    if (!z) return '';
    var e = z.palaceText(palaceName, star);
    if (!e || !e.text) return '';
    var poem = sexMale ? e.male : e.female;
    var rows = [['本宫原断', U.esc(e.text)]];
    if (poem) rows.push([sexMale ? '入男命吉凶诀' : '入女命吉凶诀', U.esc(poem)]);
    return '<div style="margin-top:var(--sp-4)">' +
      U.table(['原典 · ' + z.CLASSIC_SOURCE + ' · ' + U.esc(star) + '入' + U.esc(palaceLabel(palaceName)), '原文'], rows) + '</div>';
  }
  function classicJueBlock(zhi) {
    var z = ZR();
    if (!z) return '';
    var de = z.jueDe(zhi), xian = z.jueXian(zhi);
    if (!de && !xian) return '';
    var rows = [];
    if (de) rows.push(['得地合格诀', U.esc(de)]);
    if (xian) rows.push(['失陷破格诀', U.esc(xian)]);
    return '<div style="margin-top:var(--sp-4)">' +
      U.table(['原典 · 十二宫诸星诀（命宫安于' + U.esc(zhi) + '）', '原文'], rows) + '</div>';
  }

  /* ---------- 单宫详解：十二宫逐宫 ---------- */
  function ziweiPalaceRows(zw) {
    var z = ZR();
    return zw.palaces.map(function (p) {
      var duty = palaceDuty(p.name);

      /* 主星（带亮度）或无正曜 */
      var starCell;
      if (p.stars.length) {
        starCell = p.stars.map(function (s) { return starBr(s, p.zhi); }).join('　');
      } else {
        var opp = palaceNameAt(zw, mod(p.idx + 6, 12));
        starCell = '<span style="color:var(--tx-tertiary)">无十四主星（借对宫 ' + U.esc(opp) + '）</span>';
      }

      /* 辅星 / 四化 */
      var auxCell = [];
      if (p.aux && p.aux.length) {
        auxCell.push(p.aux.map(function (a) {
          var info = (z && z.AUX_STARS[a.name]) || null;
          var kind = a.kind === 'tough' ? 'var(--c-ji)' : (a.kind === 'soft' ? 'var(--c-ok)' : 'var(--c-warn)');
          return '<span style="color:' + kind + '">' + U.esc(a.name) + '</span>' +
            (info ? '<span style="color:var(--tx-tertiary);font-size:var(--fs-11)">·' + U.esc(info.t) + '</span>' : '');
        }).join('　'));
      } else {
        auxCell.push('<span style="color:var(--tx-tertiary)">—</span>');
      }
      var here = sihuaAtPalace(zw, p.name);
      if (here.length) {
        auxCell.push(here.map(function (s) {
          return U.tag(s.star + '化' + s.type, s.type === '忌' ? 'warn' : (s.type === '禄' ? 'ok' : 'gold'));
        }).join(' '));
      }

      /* 本宫解读：宫位主管 + 主星落实表现 + 古籍原断 */
      var reading = [];
      if (p.stars.length) {
        reading.push(p.stars.map(function (s) { return starTone(s, p.zhi); }).join(' '));
      } else {
        reading.push('本宫力量来自对宫，' + U.esc(opp) + '的星曜决定此领域的主要走向。');
      }
      /* 《紫微斗数全书》该宫该星原断（有则引，无则不加——不编造） */
      var zq = ZR();
      if (zq && p.stars.length) {
        var quotes = [];
        p.stars.forEach(function (s) {
          var e = zq.palaceText(p.name, s);
          if (e && e.text) quotes.push(U.esc(s) + '——' + U.esc(e.text));
        });
        if (quotes.length) reading.push('原断：' + quotes.join(' ') + '。（' + U.esc(zq.CLASSIC_SOURCE) + '）');
      }
      var pd = (z && z.PALACE_DETAIL[z.normPalace(p.name)]) || null;
      if (pd) reading.push('主管' + pd.job + '。' + pd.advice);

      /* 大限 / 长生 */
      var meta = '<span class="num">' + U.esc(p.gan + p.zhi) + '</span>';
      if (p.dec) meta += '<br><span style="font-size:var(--fs-11);color:var(--tx-tertiary)">大限 ' + p.dec.start + '–' + p.dec.end + ' 岁</span>';
      if (p.cs) meta += '<br><span style="font-size:var(--fs-11);color:var(--tx-tertiary)">' + U.esc(p.cs) + '</span>';

      var marks = [];
      /* 「命宫」由宫位名本身表意，不再重复打标签；身宫与他宫重合时才需要标注 */
      if (p.isShen) marks.push(U.tag('身宫', 'plain'));

      return [
        '<strong>' + U.esc(palaceLabel(p.name)) + '</strong> ' + marks.join(' ') +
          '<br><span style="font-size:var(--fs-11);color:var(--tx-tertiary)">' + U.esc(duty) + '</span>',
        meta,
        starCell,
        auxCell.join('<br>'),
        U.esc(reading.join(' '))
      ];
    });
  }

  /* ---------- 星性组合解读 ---------- */
  function ziweiComboBlock(zw, pan) {
    var z = ZR();
    if (!z) return '';
    var mingStars = zw.mingPalace.stars;
    var out = [];

    /* 1. 命宫双星组合 */
    var pair = mingPairReading(mingStars);
    if (pair) {
      out.push(U.paras([
        '<strong>命宫双星组合 —— ' + U.esc(mingStars.join('＋')) + '（' + U.esc(pair.t) + '）</strong>'
      ]) + U.table(['维度', '解读'], [
        ['组合特质', U.esc(pair.d)],
        ['事业倾向', U.esc(pair.career)],
        ['感情相处', U.esc(pair.love)]
      ]));
    } else if (mingStars.length === 1) {
      var attr = z.STAR_ATTR[mingStars[0]] || {};
      out.push(U.paras([
        '<strong>命宫单星坐守 —— ' + U.esc(mingStars[0]) + '（化气为' + U.esc(attr.qi || '—') + '，五行属' + U.esc(attr.wx || '—') + '）</strong>' +
        '单星坐命性格主线清晰，格局中平——专一深耕比广撒网更容易出成绩。'
      ]) + U.table(['维度', '解读'], [
        ['庙旺表现', U.esc(attr.good || '—')],
        ['需留意面', U.esc(attr.bad || '—')],
        ['本宫落点', U.esc((function () {
          var b = z.brightness(mingStars[0], GZ.ZHI[zw.mingIdx]);
          var lv = b ? z.brLevel(b) : null;
          return mingStars[0] + '在' + GZ.ZHI[zw.mingIdx] + '宫为「' + b + '」（' + (lv ? lv.t : '—') + '）：' + (lv ? lv.d : '');
        })())]
      ]));
    } else {
      out.push(U.paras(['命宫无十四主星（命无正曜），主体性偏灵活可塑，需借对宫 ' +
        U.esc(palaceNameAt(zw, mod(zw.mingIdx + 6, 12))) + ' 的主星定向。']));
    }

    /* 2. 命宫辅星组合 */
    var mingAux = zw.mingPalace.aux || [];
    if (mingAux.length) {
      out.push('<div style="margin-top:var(--sp-5)">' +
        U.table(['命宫辅星', '性质', '解读'], mingAux.map(function (a) {
          var info = z.AUX_STARS[a.name] || {};
          return [U.esc(a.name), info.kind === 'tough' ? U.tag('煞', 'warn') : U.tag('吉', 'ok'), U.esc(info.d || '')];
        })) + '</div>');
    }

    /* 3. 格局 */
    var gj = matchGeju(zw);
    if (gj.length) {
      out.push('<div style="margin-top:var(--sp-5)">' +
        U.table(['格局', '性质', '解读'], gj.map(function (g) {
          return [U.kw(g.name), U.tag(g.level, g.level.indexOf('贵') >= 0 || g.level.indexOf('富') >= 0 ? 'gold' : 'plain'), U.esc(g.d)];
        })) + '</div>');
    } else {
      out.push('<div style="margin-top:var(--sp-5)">' +
        U.table(['格局', '解读'], [['常规格局', '未构成特定专格，以命宫主星与三方四正的组合力量为准，属可塑性较强的常规盘。']]) + '</div>');
    }

    /* 4. 古籍原文对照（命宫主星，《紫微斗数全书》卷二安星诀） */
    var vcSex = pan.input.sexMale != null ? !!pan.input.sexMale : (pan.input.sex === 'male');
    mingStars.forEach(function (s) {
      var blk = classicStarBlock(s, '命宫', vcSex);
      if (blk) out.push(blk);
    });
    if (!mingStars.length) {
      out.push('<div class="rsec__body" style="margin-top:var(--sp-4);font-size:var(--fs-12);color:var(--tx-tertiary)">' +
        '命宫无正曜，故不引主星原断——原书按「星入某宫」立论，借宫断语见单宫详解部分。</div>');
    }

    return out.join('');
  }

  /* ---------- 流年四化（含落宫断语） ---------- */
  function ziweiYearSihua(zw, ln) {
    var z = ZR();
    var arr = SIHUA_TABLE[ln.gan] || [];
    if (!arr.length) return [];
    return arr.map(function (star, i) {
      var type = SIHUA_NAME[i];
      var palace = findPalaceOfStar(zw.palaces, star);
      var zhi = palaceZhiOfStar(zw.palaces, star);
      var b = (z && zhi) ? z.brightness(star, zhi) : '';
      return {
        star: star, type: type, palace: palace, zhi: zhi, brightness: b,
        /* 规则层缺失时也要给出完整 core，避免下游取 .t 得 undefined */
        core: (z && z.SIHUA_CORE[type]) ? z.SIHUA_CORE[type] : { t: SIHUA_DESC[type], d: SIHUA_DESC[type] },
        reading: (z ? z.sihuaInPalace(type, palace) : '')
      };
    });
  }

  function ziwei(pan, res) {
    var zw = computeZiwei(pan);
    var now = nowYear();
    var ln = pan.currentLiunian;

    var mingStars = zw.mingPalace.stars;
    var mingText = mingStars.length
      ? mingStars.map(function (s) {
          var info = ZIWEI_STARS[s] || { t: '—', d: '' };
          return U.kw(s) + '——' + info.t + '。' + info.d;
        }).join(' ')
      : '命宫无主星（属「命无正曜」），需借对宫之力量来看，主体性上偏灵活、可塑性强，人生取向受后天环境影响较大。';

    /* 十二宫表 */
    var palRows = zw.palaces.map(function (p) {
      var stars = p.stars.length
        ? p.stars.map(function (s) { return starBr(s, p.zhi); }).join('　')
        : '<span style="color:var(--tx-tertiary)">（无主星）</span>';
      var marks = [];
      if (p.isShen) marks.push(U.tag('身宫', 'plain'));
      var auxTxt = (p.aux && p.aux.length)
        ? p.aux.map(function (a) {
            return '<span style="color:' + (a.kind === 'tough' ? 'var(--c-ji)' : 'var(--c-ok)') + '">' + U.esc(a.name) + '</span>';
          }).join(' ')
        : '<span style="color:var(--tx-tertiary)">—</span>';
      return [
        '<strong>' + U.esc(palaceLabel(p.name)) + '</strong> ' + marks.join(' '),
        '<span class="num">' + U.esc(p.gan + p.zhi) + '</span>' +
          (p.dec ? '<br><span style="font-size:var(--fs-11);color:var(--tx-tertiary)">' + p.dec.start + '–' + p.dec.end + ' 岁</span>' : '') +
          (p.cs ? '<br><span style="font-size:var(--fs-11);color:var(--tx-tertiary)">' + U.esc(p.cs) + '</span>' : ''),
        stars,
        auxTxt,
        U.esc(palaceDuty(p.name))
      ];
    });

    /* 四化表（★ 增强：补「落宫断语」与化星亮度，见 ZIWEI_RULES.sihuaInPalace） */
    var sihuaRows = zw.sihua.map(function (s) {
      var b = (ZR() && s.zhi) ? ZR().brightness(s.star, s.zhi) : '';
      var zr = ZR();
      var reading = zr ? zr.sihuaInPalace(s.type, s.palace) : '';
      var tail = reading ? reading.replace(/^化.入[^：]*：/, '') : '';
      return [
        U.esc(zw.yearGan) + '干',
        '<strong>' + U.esc(s.star) + '</strong>' + (b ? '<br><span style="font-size:var(--fs-11);color:var(--tx-tertiary)">宫位亮度 ' + b + '</span>' : ''),
        U.tag('化' + s.type, s.type === '忌' ? 'warn' : (s.type === '禄' ? 'ok' : 'gold')),
        U.esc(s.desc) + (tail ? '<br>' + U.esc(tail) : ''),
        U.esc(s.palace) + (zr && zr.PALACE_DETAIL[zr.normPalace(s.palace)]
          ? '<br><span style="font-size:var(--fs-11);color:var(--tx-tertiary)">' + U.esc(zr.PALACE_DETAIL[zr.normPalace(s.palace)].advice) + '</span>' : '')
      ];
    });

    /* 煞星（本项目以「化忌 + 命宫无主星 + 夫妻宫/官禄宫落陷」等综合表述，不做绝对凶断） */
    var shaNotes = [];
    var jiStar = zw.sihua.filter(function (s) { return s.type === '忌'; });
    if (jiStar.length) {
      shaNotes.push({ t: '化忌所在：' + jiStar[0].star + '（' + jiStar[0].palace + '）',
        d: '化忌主牵挂与磨炼，落在哪一宫，哪一宫就是你此生需要多花心思经营的地方。这不是阻碍，而是成长的着力点。' });
    }
    if (!mingStars.length) {
      shaNotes.push({ t: '命无正曜', d: '命宫无主星者，性格弹性大、适应力强，但也容易在不同方向之间摇摆。建议尽早确定一条主线，借对宫主星之力定向。' });
    }
    if (!shaNotes.length) {
      shaNotes.push({ t: '格局相对完整', d: '命宫有主星坐守，人生方向感较明确，按自己的节奏走即可。' });
    }

    /* 贵人/助力星 */
    var guiStars = [];
    zw.palaces.forEach(function (p) {
      p.stars.forEach(function (s) {
        if (s === '天梁' || s === '天相' || s === '太阳' || s === '天同') {
          guiStars.push(s + '（' + p.name + '）');
        }
      });
    });

    /* 格局高低（正向表述） */
    var gejuLevel = '';
    if (mingStars.indexOf('紫微') >= 0 || mingStars.indexOf('天府') >= 0) {
      gejuLevel = '命宫坐' + mingStars.join('') + '，属「帝星/库星临命」之象，格局偏中上——主有担当、能统筹，适合承担核心角色。';
    } else if (mingStars.length >= 2) {
      gejuLevel = '命宫双星同宫（' + mingStars.join('、') + '），双星组合通常带来更丰富的性格层次与更多元的路径选择，格局中平偏上。';
    } else if (mingStars.length === 1) {
      gejuLevel = '命宫单星坐守（' + mingStars[0] + '），性格主线清晰，格局中平——专一深耕比广撒网更容易出成绩。';
    } else {
      gejuLevel = '命无正曜，格局需借对宫与三方四正综合判断，属「后天可塑」型，早年方向感可能偏弱，中年后逐渐清晰。';
    }

    /* 三方四正 */
    var sanfang = sanfangStars(zw);

    var coreKeywords = [];
    coreKeywords.push(zw.bureau.name);
    if (mingStars.length) coreKeywords.push('命宫' + mingStars.join(''));
    else coreKeywords.push('命无正曜');
    coreKeywords.push('身宫在' + GZ.ZHI[zw.shenIdx]);
    zw.sihua.forEach(function (s) { if (s.type === '禄' || s.type === '权') coreKeywords.push(s.star + '化' + s.type); });
    coreKeywords = coreKeywords.slice(0, 5);

    /* ---------- 小白友好层（书 E5 · 解读雷同修复 + 术语翻译） ---------- */
    var zf = ZR();
    var openHtml = '';
    if (zf) {
      /* 三句话看懂：白话、无术语、每盘不同（由命盘数据驱动） */
      var ps = zf.plainSummary(zw, pan);
      openHtml += '<div class="plainbox">' + ps.map(function (s, i) {
        return '<p class="plainline"><span class="plainno">' + (i + 1) + '</span>' + U.esc(s) + '</p>';
      }).join('') + '</div>';

      /* 显著特征：数据驱动提取 3~6 条本盘独有特征（不同命盘 → 不同特征组合） */
      var feats = zf.highlightFeatures(zw);
      if (feats.length) {
        openHtml += '<div class="featgrid">' + feats.map(function (f) {
          return '<div class="featcard">' +
            '<div class="featcard__t">' + U.esc(f.t) + '</div>' +
            '<div class="featcard__ev">依据：' + U.esc(f.ev || '—') + '</div>' +
            '<div class="featcard__d">' + U.esc(f.d) + '</div></div>';
        }).join('') + '</div>';
      }
    }

    /* 总览句式变体：按命局指纹确定性选取（同盘恒定、异盘换句式） */
    var fp = zf ? zf.chartFingerprint(zw, pan) : 0;
    var sumHead = [
      '命宫在 ' + U.kw(GZ.ZHI[zw.mingIdx]) + '，' + U.kw(zw.bureau.name) + '，身宫在 ' + U.kw(GZ.ZHI[zw.shenIdx]) + '。',
      '立命于' + U.kw(GZ.ZHI[zw.mingIdx]) + '位，以' + U.kw(zw.bureau.name) + '行限，身宫落在' + U.kw(GZ.ZHI[zw.shenIdx]) + '。',
      '此盘' + U.kw(zw.bureau.name) + '起局，命宫安' + U.kw(GZ.ZHI[zw.mingIdx]) + '，身宫系于' + U.kw(GZ.ZHI[zw.shenIdx]) + '。'
    ][fp % 3];
    var sumBody = '命宫主星：' + U.kw(mingStars.length ? mingStars.join('、') : '无正曜') + '。' +
      '生年四化：' + U.kw(zw.sihua.map(function (s) { return s.star + '化' + s.type; }).join('、')) + '。';

    /* 术语速查：列出本盘解读中实际出现的术语（白话解释） */
    var termsUsed = ['命宫', '三方四正', '庙旺利陷', '五行局', '身宫'];
    var jiStar2 = zw.sihua.filter(function (s) { return s.type === '忌'; });
    if (zw.sihua.length) termsUsed = termsUsed.concat(['化禄', '化权', '化科', '化忌']);
    if (zw.curDec) termsUsed.push('大限');
    var hasTough = zw.palaces.some(function (p) { return (p.aux || []).some(function (a) { return a.kind === 'tough'; }); });
    if (hasTough) termsUsed.push('煞星', '辅星');
    if (mingStars.indexOf('贪狼') >= 0 || mingStars.indexOf('廉贞') >= 0) termsUsed.push('桃花星');
    if (!mingStars.length) termsUsed.push('对宫');
    var gejuMatched = matchGeju(zw);
    if (gejuMatched.length) termsUsed.push('格局');
    var termRows = termsUsed.filter(function (k, i) { return termsUsed.indexOf(k) === i; })
      .map(function (k) { return [U.kw(k), U.esc(zf ? zf.termOf(k) : '')]; });

    return {
      school: 'ziwei',
      title: '紫微斗数 · 全局解读',
      keywords: coreKeywords,
      html:
        U.sum(sumHead + sumBody) +

        U.sec('开篇 · 先读这里', openHtml) +

        U.sec('一、紫微完整排盘',
          U.kvRows([
            ['农历', U.esc(pan.input.lunar.year + '年' + U.cnMonth(pan.input.lunar.month) + '月' + U.cnDay(pan.input.lunar.day) + (pan.input.lunar.leap ? '（闰）' : ''))],
            ['时辰', U.esc(pan.input.shichen + '时（' + pan.input.shichenRange + '）')],
            ['性别', pan.input.sex === 'male' ? '男' : '女'],
            ['命宫', U.kw(GZ.ZHI[zw.mingIdx]) + '（' + zw.mingPalace.gan + GZ.ZHI[zw.mingIdx] + '）'],
            ['身宫', U.kw(GZ.ZHI[zw.shenIdx])],
            ['五行局', U.kw(zw.bureau.name)],
            ['生年干支', U.esc(zw.yearGan + zw.yearZhi)]
          ]) +
          '<div style="margin-top:var(--sp-5)">' +
          U.table(['宫位', '干支 · 大限', '主星（亮度）', '辅星', '主管'], palRows) + '</div>' +
          '<div class="rsec__body" style="margin-top:var(--sp-4);font-size:var(--fs-12);color:var(--tx-tertiary)">' +
          /* 亮度解读说明改为数据驱动：本盘主星庙陷分布统计（不同盘 → 不同文字） */
          (function () {
            var cnt = { strong: [], weak: [] };
            zw.palaces.forEach(function (p) {
              p.stars.forEach(function (s) {
                var z2 = ZR();
                if (!z2) return;
                var b = z2.brightness(s, p.zhi);
                var lv = b && z2.brLevel(b) ? z2.brLevel(b).lv : null;
                if (lv === null) return;
                if (lv >= 4) cnt.strong.push(s + '（' + p.name + '·' + b + '）');
                else if (lv <= 0) cnt.weak.push(s + '（' + p.name + '·' + b + '）');
              });
            });
            return '本盘十四主星：庙旺 ' + cnt.strong.length + ' 颗' +
              (cnt.strong.length ? '（' + cnt.strong.join('、') + '）——这些是你的强项星' : '') +
              '；落陷 ' + cnt.weak.length + ' 颗' +
              (cnt.weak.length ? '（' + cnt.weak.join('、') + '）——这些星要多花心思打磨' : '') +
              '。辅星中绿色为吉星、红色为煞星。';
          })() + '</div>'
        ) +

        U.sec('二、命宫身宫 · 核心性格',
          U.paras([
            '<strong>命宫（' + GZ.ZHI[zw.mingIdx] + '）：</strong>' + mingText,
            '<strong>身宫（' + GZ.ZHI[zw.shenIdx] + '）：</strong>身宫代表后天发展与实际行动力的落点。' +
            '身宫在' + GZ.ZHI[zw.shenIdx] + '，说明你的人生重心会随着' + palaceDutyOfZhi(zw, zw.shenIdx) + '相关的事务展开。'
          ])
        ) +

        U.sec('三、星性组合解读', ziweiComboBlock(zw, pan)) +

        U.sec('四、单宫详解 · 十二宫逐宫',
          U.table(['宫位 / 主管', '干支 · 大限 · 长生', '主星（亮度）', '辅星 · 四化', '本宫解读与建议'], ziweiPalaceRows(zw))
        ) +

        U.sec('五、三方四正 · 格局高低',
          U.paras([
            '<strong>三方四正：</strong>' + sanfang.desc,
            '<strong>格局高低：</strong>' + gejuLevel
          ]) +
          '<div style="margin-top:var(--sp-4)">' + U.table(['宫位', '地支', '星曜'], sanfang.rows) + '</div>' +
          classicJueBlock(GZ.ZHI[zw.mingIdx]) +
          (function () {
            /* 十二宫强弱推演：纯数据推导（评分 = 主星亮度 ± 辅星吉煞），结论可回溯 */
            if (!zf || !zf.palaceStrength) return '';
            var rows = zf.palaceStrength(zw);
            if (!rows.length) return '';
            var top = rows[0], bottom = rows[rows.length - 1];
            var maxAbs = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.score); }).concat([1]));
            var bars = rows.map(function (r) {
              var w = Math.round(Math.abs(r.score) / (maxAbs * 1.15) * 100);
              var color = r.score >= 0 ? 'var(--c-daiqing)' : 'var(--c-ji)';
              var val = (r.score > 0 ? '+' : '') + r.score;
              return '<div class="wxbar">' +
                '<div class="wxbar__name">' + U.esc(r.name + '宫') + '</div>' +
                '<div class="wxbar__track"><div class="wxbar__fill" style="width:' + w + '%;background:' + color + '"></div></div>' +
                '<div class="wxbar__val">' + val + '</div></div>' +
                '<div style="font-size:var(--fs-11);color:var(--tx-tertiary);margin:-2px 0 var(--sp-2) ' +
                'calc(6em + var(--sp-3))">依据：' + U.esc(r.ev) + '</div>';
            }).join('');
            return '<div style="margin-top:var(--sp-5)">' +
              U.paras([
                '<strong>十二宫强弱推演：</strong>评分＝主星亮度之和 ± 辅星吉煞加减——每一个分数都能回溯到盘面，换一张盘，排序与结论随之改变。',
                '<strong>最强宫：' + top.name + '宫（' + top.score + ' 分）。</strong>' +
                  (top.duty ? top.duty : '该宫') + '是你当前配置最厚的领域，发挥最稳，适合作为主赛道。',
                '<strong>最弱宫：' + bottom.name + '宫（' + bottom.score + ' 分）。</strong>' +
                  '这里宜借对宫之力、以专业补足，不必硬拼。'
              ]) +
              '<div class="strengthbars">' + bars + '</div></div>';
          })()
        ) +

        U.sec('六、生年四化',
          U.table(['年干', '星曜', '四化', '含义', '落宫'], sihuaRows) +
          '<div class="rsec__body" style="margin-top:var(--sp-4);font-size:var(--fs-12)">' +
          '四化是紫微斗数的动态核心：化禄主机会与收获、化权主掌控与推动、化科主名声与条理、化忌主牵挂与磨炼。' +
          '四化落在哪一宫，就点亮或触动了该宫对应的人生领域。</div>'
        ) +

        U.sec('七、总盘全局解读',
          U.paras([
            '<strong>本命核心特质：</strong>' + (mingStars.length ? mingStars.map(function (s) {
              return (ZIWEI_STARS[s] || {}).t || ''; }).join('；') : '灵活、可塑、适应力强') + '。',
            '<strong>天赋能力：</strong>' + talentByPalace(zw),
            '<strong>事业发展趋势：</strong>' + careerByPalace(zw),
            '<strong>财运模式：</strong>' + wealthByPalace(zw),
            '<strong>感情婚姻特质：</strong>' + loveByPalace(zw),
            '<strong>健康隐患：</strong>疾厄宫在 ' + GZ.ZHI[mod(zw.mingIdx - 5, 12)] + '，' +
            '星曜组合' + (starsAt(zw, mod(zw.mingIdx - 5, 12)) || '无主星') + '。' +
            '日常留意作息规律与情绪压力的累积，定期体检即可，无需过度担忧。',
            '<strong>一生整体走势：</strong>' + zw.bureau.name + '起局，' +
            '命宫在' + GZ.ZHI[zw.mingIdx] + '、身宫在' + GZ.ZHI[zw.shenIdx] + '，' +
            '主体路径是「先' + (mingStars.length ? '立定方向' : '摸索方向') + '、再' + (zw.shenIdx === zw.mingIdx ? '一以贯之' : '在实践中定型') + '」。'
          ])
        ) +

        U.sec('八、' + now + ' 年流年四化 · 大限',
          U.paras([
            '流年 ' + U.kw(ln.gz) + '（' + ln.gan + ln.zhi + '）。' +
            (zw.curDec ? '本命当前走 ' + U.kw(zw.curDec.name + '宫大限（' + zw.curDec.dec.start + '–' + zw.curDec.dec.end +
              ' 岁，' + zw.curDec.dec.gan + zw.curDec.dec.zhi + '）') + '，流年四化需叠在大限之上合看。' : ''),
            '<strong>流年四化（按流年天干 ' + ln.gan + ' 推）：</strong>' +
            ziweiYearSihua(zw, ln).map(function (x) {
              return U.kw(x.star + '化' + x.type) + '（' + x.core.t + '）入' + U.kw(x.palace);
            }).join('；') + '。'
          ]) +
          '<div style="margin-top:var(--sp-4)">' +
          U.table(['流年四化', '落宫', '主事', '当年落宫断语'], ziweiYearSihua(zw, ln).map(function (x) {
            /* 断语去掉结尾的括号注解（与「主事」列重复） */
            var txt = x.reading.replace(/^化.入[^：]*：/, '').replace(/（[^）]*）\s*$/, '');
            return [
              U.tag('化' + x.type, x.type === '忌' ? 'warn' : (x.type === '禄' ? 'ok' : 'gold')) + ' <strong>' + U.esc(x.star) + '</strong>' +
                (x.brightness ? '<br><span style="font-size:var(--fs-11);color:var(--tx-tertiary)">宫位亮度 ' + U.esc(x.brightness) + '</span>' : ''),
              '<strong>' + U.esc(palaceLabel(x.palace)) + '</strong>',
              U.esc(x.core.t),
              U.esc(txt)
            ];
          })) + '</div>' +
          U.paras([
            '当年机遇：化禄与化权所落领域是主动出击的方向，适合推进与' +
            (SIHUA_TABLE[ln.gan] && findPalaceOfStar(zw.palaces, SIHUA_TABLE[ln.gan][0]) || '事业') + '相关的事项。',
            '变动提示：流年引动往往带来环境或心境的调整，属正常节律，顺其自然比强行阻拦更有效。',
            '吉凶参考：本年整体以' + (ziweiYearTone(pan, ln)) + '为主基调，具体事项仍需结合个人实际判断。'
          ])
        ) +

        U.sec('九、核心煞星化解提示', U.tips(shaNotes)) +

        U.sec('十、贵人星 / 助力星总结',
          guiStars.length
            ? U.paras(['命盘中具有助力特质的星曜：' + guiStars.map(function (g) { return U.kw(g); }).join('、') + '。',
                '这些星曜所在宫位对应的人生领域，是你容易获得他人帮助、也适合主动求助的方向。',
                '此外，' + zw.bureau.name + '格局本身就说明：' + (zw.bureau.num <= 3
                  ? '起局数偏小，属「先难后易」型，早年积累的每一步都会在后半程兑现，属于越走越开的路。'
                  : '起局数偏大，属「早发」型，年轻时即有较快的起势，需注意后续的持续性与稳定性。')])
            : U.paras(['命盘中直接助力星不显，贵人多来自你自身的可靠度与专业度——把事情做到位，自然会有人愿意合作。'])
        ) +

        U.sec('十一、紫微专属建议', U.tips([
          { t: '事业选择', d: careerByPalace(zw) },
          { t: '人际相处', d: '交友宫在' + GZ.ZHI[mod(zw.mingIdx - 7, 12)] + '，' + starsAt(zw, mod(zw.mingIdx - 7, 12)) +
              '。以诚待人、少做无效社交，把精力留给真正能长期同行的人。' },
          { t: '感情经营', d: loveByPalace(zw) },
          { t: '健康养护', d: '疾厄宫提示留意' + (starsAt(zw, mod(zw.mingIdx - 5, 12)) ?
              '该宫星曜对应的系统（多为神经系统与消化系统的压力反应）' : '作息与情绪压力') + '，规律作息是最有效的养护。' },
          { t: '风险规避', d: '化忌所在领域（' + (jiStar[0] ? jiStar[0].palace : '—') + '）避免过度投入与情绪化决策，慢一步往往更稳。' }
        ])) +

        U.sec('十二、命格核心关键词', U.kwList(coreKeywords)) +

        U.sec('附 · 名词速查（白话版）',
          U.paras(['看命理最怕术语劝退——这里把本盘解读中出现的术语全部翻译成白话，读正文卡住时随时回来查。']) +
          U.table(['术语', '白话解释'], termRows))
    };
  }

  function palaceDuty(name) {
    for (var i = 0; i < ZIWEI_PALACES.length; i++) {
      if (ZIWEI_PALACES[i][0].indexOf(name) >= 0 || name.indexOf(ZIWEI_PALACES[i][0]) >= 0) return ZIWEI_PALACES[i][1];
    }
    return '—';
  }
  function starsAt(zw, zhiIdx) {
    for (var i = 0; i < zw.palaces.length; i++) {
      if (zw.palaces[i].idx === zhiIdx) return zw.palaces[i].stars.join('、');
    }
    return '';
  }
  function palaceNameAt(zw, zhiIdx) {
    for (var i = 0; i < zw.palaces.length; i++) {
      if (zw.palaces[i].idx === zhiIdx) return zw.palaces[i].name;
    }
    return '';
  }
  function palaceDutyOfZhi(zw, zhiIdx) {
    var n = palaceNameAt(zw, zhiIdx);
    return palaceDuty(n) || '该宫';
  }
  function sanfangStars(zw) {
    var ming = zw.mingIdx;
    var idxs = [ming, mod(ming + 4, 12), mod(ming + 6, 12), mod(ming + 8, 12)];
    var rows = idxs.map(function (i) {
      var s = starsAt(zw, i);
      return ['<strong>' + U.esc(palaceNameAt(zw, i)) + '</strong> ' + U.esc(GZ.ZHI[i]), s ? U.esc(s) : '（无主星）'];
    });
    var desc = '以命宫为基准，' + palaceNameAt(zw, ming) + '（' + GZ.ZHI[ming] + '）为本宫，' +
      palaceNameAt(zw, mod(ming + 4, 12)) + '、' + palaceNameAt(zw, mod(ming + 8, 12)) + '为三方，' +
      palaceNameAt(zw, mod(ming + 6, 12)) + '为对宫。三者合看，' +
      '决定命宫力量的厚薄与人生舞台的大小。';
    return { rows: rows, desc: desc };
  }
  function talentByPalace(zw) {
    var g = starsAt(zw, mod(zw.mingIdx - 8, 12));
    var ming = zw.mingPalace.stars;
    var base = ming.length ? ming.map(function (s) { return (ZIWEI_STARS[s] || {}).t || s; }).join('、') : '灵活应变';
    return '命宫主星' + (ming.length ? '（' + ming.join('、') + '）' : '（无正曜，借对宫）') +
      '决定基础能力偏向：' + base + '。官禄宫' + (g ? '坐' + g + '，' : '无主星，') +
      '说明事业上的天赋更偏向' + (g ? '该星曜对应的专业方向，可重点培养。' : '后天实践中逐步显形，宜多尝试再聚焦。');
  }
  function careerByPalace(zw) {
    var g = starsAt(zw, mod(zw.mingIdx - 8, 12));
    if (!g) return '官禄宫无主星，事业路径属「后天开拓」型——不必急于定型，多在实践中试错，30 岁前后方向会自然清晰。';
    return '官禄宫坐 ' + g + '，' +
      '适合' + (g.indexOf('天机') >= 0 ? '策划、研究、技术类' :
                g.indexOf('太阳') >= 0 ? '对外、传播、教育类' :
                g.indexOf('武曲') >= 0 ? '金融、实业、执行管理类' :
                g.indexOf('天同') >= 0 ? '服务、文化、生活美学类' :
                g.indexOf('廉贞') >= 0 ? '专业深耕、需要极致的领域' :
                g.indexOf('天府') >= 0 ? '管理、统筹、资产运营类' :
                g.indexOf('太阴') >= 0 ? '设计、财务、细腻度要求高的领域' :
                g.indexOf('贪狼') >= 0 ? '市场、公关、多元经营类' :
                g.indexOf('巨门') >= 0 ? '研究、评论、谈判沟通类' :
                g.indexOf('天相') >= 0 ? '辅助、协调、专业支持类' :
                g.indexOf('天梁') >= 0 ? '教育、顾问、评审类' :
                g.indexOf('七杀') >= 0 ? '开创、销售、需要胆识的领域' :
                g.indexOf('破军') >= 0 ? '变革、改善、新业务开拓类' :
                g.indexOf('紫微') >= 0 ? '需要主导与决策的角色' : '综合管理方向') + '。';
  }
  function wealthByPalace(zw) {
    var c = starsAt(zw, mod(zw.mingIdx - 4, 12));
    if (!c) return '财帛宫无主星，收入方式偏多元与流动，属于「多路进财」型，重点是把一条线做扎实。';
    return '财帛宫坐 ' + c + '，' +
      (c.indexOf('武曲') >= 0 || c.indexOf('天府') >= 0 || c.indexOf('太阴') >= 0
        ? '理财与守财能力强，属稳健积累型，适合长期资产配置。'
        : c.indexOf('贪狼') >= 0 || c.indexOf('七杀') >= 0 || c.indexOf('破军') >= 0
          ? '赚取方式偏主动出击，机会型收入多，需设好止盈与风险线。'
          : '财路平稳，靠专业与稳定输出累积，不喜高波动。');
  }
  function loveByPalace(zw) {
    var s = starsAt(zw, mod(zw.mingIdx - 2, 12));
    if (!s) return '夫妻宫无主星，感情模式偏随缘，重在相处质量而非形式，宜多沟通少假设。';
    return '夫妻宫坐 ' + s + '，' +
      (s.indexOf('天同') >= 0 || s.indexOf('太阴') >= 0 ? '感情中重感觉与陪伴，适合温和体贴的相处方式。' :
       s.indexOf('太阳') >= 0 || s.indexOf('天梁') >= 0 ? '感情中偏照顾者角色，需留意对方的独立空间。' :
       s.indexOf('贪狼') >= 0 ? '感情丰富、吸引力强，宜专一经营避免分散。' :
       s.indexOf('七杀') >= 0 || s.indexOf('破军') >= 0 ? '感情来得快、投入深，需留意节奏与磨合。' :
       '感情观务实，重视共同成长与责任分担。');
  }
  function ziweiYearTone(pan, ln) {
    var gw = GZ.GAN_WUXING ? GZ.GAN_WUXING[ln.gan] : '';
    return (pan.yongshen.xiyong.indexOf(gw) >= 0) ? '顺中带机、可主动推进' : '稳中求进、宜守成积蓄';
  }

  /* ===================== 分区四：通用运势 ===================== */

  /* 每日寄语池（fortune 分区与悬浮卡快照共用） */
  var DAILY_JIYU = [
    '今日宜把注意力放回自己身上——外界的噪音再多，也不如一个清晰的小目标有用。',
    '慢一点没关系，方向对了，时间会替你加速。',
    '把一件小事做完整，比同时开始五件事更有力量。',
    '今天适合把纠结已久的问题写下来，写出来的瞬间，答案往往已经浮现。',
    '运势是参考，选择才是主角。今天做的每一个小决定，都在悄悄改变轨迹。',
    '给自己留一点空白，不填满，反而更容易接住意外的好机会。',
    '与其等一个完美的时机，不如把手上的事做到今天的最好。'
  ];

  /* ---------- 悬浮卡当日快照（数据同源：全部由命盘 + 当日干支推导，无新增玄学逻辑） ----------
     悬浮卡程序（PowerShell/WPF）只读本快照做展示，自身不做任何排盘与推理（任务书·算力边界）。 */
  function dailySnapshot(pan) {
    var now = new Date();
    var today = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
    var yong = pan.yongshen;
    var todayGZ = dayGZOf(today.y, today.m, today.d);
    var todayWu = GZ.GAN_WUXING[todayGZ.gan];
    var todayXi = yong.xiyong.indexOf(todayWu) >= 0;
    var todayJi = yong.jishen.indexOf(todayWu) >= 0;
    var luckyWu = yong.xiyong[0];
    var lucky = WX_LIFE[luckyWu] || { color: '—', dir: '—', habit: '' };
    var jiyuIdx = (today.y * 372 + today.m * 31 + today.d) % DAILY_JIYU.length;
    var weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];

    /* 评级：日干支五行 喜→吉 / 忌→慎 / 中性→平（数据推导，非随机） */
    var tone = todayXi ? '吉' : (todayJi ? '慎' : '平');
    var toneNote = todayXi ? '今日之气为命主喜用，做事顺势。'
      : (todayJi ? '今日之气为命主忌神，宜守不宜攻。' : '今日之气中性，稳扎稳打即可。');

    /* 三流派一句话摘要（各派数据驱动，无新增玄学逻辑） */
    var schBazi = '今日' + todayGZ.gz + '（' + todayWu + '），对日主为' +
      (todayXi ? '喜用之气，宜进' : (todayJi ? '忌神之气，宜守' : '中性之气，宜稳')) +
      '；喜用' + yong.xiyong.join('、') + '。';
    var zw = null;
    try { zw = computeZiwei(pan); } catch (e) { zw = null; }
    var schZiwei = '';
    if (zw) {
      var zhiIdx = GZ.ZHI.indexOf(todayGZ.zhi);
      var palace = null;
      zw.palaces.forEach(function (p) { if (p.idx === zhiIdx) palace = p; });
      if (palace) {
        var duty = (ZR() && ZR().PALACE_DETAIL[ZR().normPalace(palace.name)]) ? ZR().PALACE_DETAIL[ZR().normPalace(palace.name)].job : '';
        schZiwei = '流日行至' + palace.name + '宫（' + palace.gan + palace.zhi + '），引动' + duty +
          (palace.stars.length ? '；主星 ' + palace.stars.join('、') + '。' : '；宫内无主星，借对宫之力。');
      }
    }
    var schNihai = '天机道今日：' + (todayXi ? '气顺宜进' : (todayJi ? '气滞宜守' : '气平宜稳')) +
      '，' + (WX_LIFE[luckyWu] ? luckyWu + '气来扶，' : '') + '顺天时者逸。';

    var rec = pan.input || {};
    return {
      v: 1,
      generatedAt: now.toISOString(),
      date: today.y + '-' + String(today.m).padStart(2, '0') + '-' + String(today.d).padStart(2, '0'),
      weekday: '周' + weekday,
      profile: {
        name: rec.name || pan._profileName || '未命名',
        sex: rec.sex === 'female' ? '女' : '男',
        solar: (rec.solar ? rec.solar.y + '-' + rec.solar.m + '-' + rec.solar.d : ''),
        shichen: rec.shichenName || '',
        place: rec.place || ''
      },
      daily: {
        gz: todayGZ.gz, wuxing: todayWu,
        tone: tone, toneNote: toneNote,
        four: [
          { k: '事业', v: dayFieldText('事业', todayXi, todayWu) },
          { k: '财运', v: dayFieldText('财运', todayXi, todayWu) },
          { k: '感情', v: dayFieldText('感情', todayXi, todayWu) },
          { k: '健康', v: dayFieldText('健康', todayXi, todayWu) }
        ],
        yi: todayXi ? '推进沟通、签约、拜访、整理收尾；决策可适度提速。' : '整理、复盘、学习、做减法；把基础工作做扎实。',
        ji: todayXi ? '忌过度自信、忌一次铺太开；顺境留三分余地。' : '忌大额投入、忌情绪化表态；重要决定放到更顺的日子再定。',
        warn: '留意' + (todayXi ? '因顺而松懈' : '因急而失据') + '——情绪稳住了，今天就不会出大问题。',
        luckyColor: lucky.color.split('、')[0],
        luckyDir: lucky.dir,
        quote: DAILY_JIYU[jiyuIdx]
      },
      schools: { nihaixia: schNihai, bazi: schBazi, ziwei: schZiwei }
    };
  }

  function fortune(pan, res) {
    var now = new Date();
    var today = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
    var ln = pan.currentLiunian;
    var yong = pan.yongshen;

    /* 当日干支 */
    var todayGZ = dayGZOf(today.y, today.m, today.d);

    var todayWu = GZ.GAN_WUXING[todayGZ.gan];
    var todayXi = yong.xiyong.indexOf(todayWu) >= 0;

    /* 当日吉凶倾向（不做绝对断言） */
    var dayTone = todayXi ? '顺' : '平';

    /* 幸运色 / 方位 */
    var luckyWu = yong.xiyong[0];
    var lucky = WX_LIFE[luckyWu];

    /* 本周关键天：取未来 7 天中干支为喜用的日子 */
    var weekDays = [];
    for (var i = 0; i < 7; i++) {
      var dt = new Date(now.getTime() + i * 86400000);
      var d = { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
      var gz = dayGZOf(d.y, d.m, d.d);
      var wu = GZ.GAN_WUXING[gz.gan];
      weekDays.push({
        date: d, gz: gz, wu: wu,
        isXi: yong.xiyong.indexOf(wu) >= 0,
        weekday: ['日', '一', '二', '三', '四', '五', '六'][dt.getDay()]
      });
    }
    var goodDays = weekDays.filter(function (x) { return x.isXi; });

    /* 月度：本月干支由年干五虎遁定 */
    var monthGZ = monthGZOf(today.y, today.m, pan.pillars.year.gan);

    /* 年度关键节点：按十二节划分（用 pan 已有 jieContext 思路，列出本年十二节气近似日） */
    var yearNodes = [];
    if (global.ASTRO && global.ASTRO.JIE) {
      Object.keys(global.ASTRO.JIE).forEach(function (name) {
        try {
          var jd = global.ASTRO.solarTermBeijing(today.y, global.ASTRO.JIE[name]);
          if (jd != null) {
            var bj = global.ASTRO.bjdToBeijing(jd);
            yearNodes.push({ name: name, m: bj.m, d: bj.d });
          }
        } catch (e) { /* 忽略单点失败 */ }
      });
    }
    yearNodes.sort(function (a, b) { return (a.m * 100 + a.d) - (b.m * 100 + b.d); });

    var jiyuIdx = (today.y * 372 + today.m * 31 + today.d) % DAILY_JIYU.length;

    var coreKeywords = [];
    coreKeywords.push('今日' + todayGZ.gz);
    coreKeywords.push(todayWu + '气' + (todayXi ? '得力' : '平顺'));
    coreKeywords.push('幸运色' + lucky.color.split('、')[0]);
    coreKeywords.push('宜' + lucky.dir);
    coreKeywords.push(ln.gz + '年');

    return {
      school: 'fortune',
      title: '通用运势 · 周期参考',
      keywords: coreKeywords,
      html:
        U.sum('今日 ' + U.kw(today.y + '-' + U.pad2(today.m) + '-' + U.pad2(today.d)) + '，日干支 ' + U.kw(todayGZ.gz) +
          '（' + todayWu + '），对命主而言' + U.kw(todayXi ? '为喜用之气，整体偏顺' : '非喜用，整体平稳') +
          '。本年 ' + U.kw(ln.gz) + '，本月 ' + U.kw(monthGZ.gz) + '。') +

        U.sec('一、日运势 · ' + today.y + '年' + today.m + '月' + today.d + '日',
          U.metrics([
            { k: '日干支', v: todayGZ.gz, sub: todayWu + '日' },
            { k: '综合倾向', v: dayTone, sub: todayXi ? '喜用得力' : '平顺为主' },
            { k: '幸运色', v: lucky.color.split('、')[0], sub: lucky.color },
            { k: '幸运方位', v: lucky.dir, sub: '宜出行 / 洽谈' }
          ]) +
          '<div style="margin-top:var(--sp-5)">' + U.kvRows([
            ['事业', dayFieldText('事业', todayXi, todayWu)],
            ['财运', dayFieldText('财运', todayXi, todayWu)],
            ['感情', dayFieldText('感情', todayXi, todayWu)],
            ['健康', dayFieldText('健康', todayXi, todayWu)],
            ['人际', dayFieldText('人际', todayXi, todayWu)]
          ]) + '</div>' +
          '<div style="margin-top:var(--sp-5)">' + U.tips([
            { t: '今日宜', d: todayXi ? '推进沟通、签约、拜访、整理收尾类事务；决策可适度提速。'
                : '整理、复盘、学习、做减法；把基础工作做扎实。' },
            { t: '今日忌', d: todayXi ? '忌过度自信、忌一次铺太开；顺境里留三分余地。'
                : '忌大额投入、忌情绪化表态；重要决定放到更顺的日子再定。' },
            { t: '避雷提醒', d: '留意' + (todayXi ? '因顺而松懈' : '因急而失据') + '——情绪稳住了，今天就不会出大问题。' }
          ]) + '</div>'
        ) +

        U.sec('二、每日小寄语',
          U.saying(DAILY_JIYU[jiyuIdx], '通用运势 · 每日一言')
        ) +

        U.sec('三、周运势 · 未来 7 天',
          U.paras([
            '本周整体以 ' + U.kw(goodDays.length >= 3 ? '顺遂为主' : '平稳为主') + ' 为基调。' +
            '未来 7 天中，干支为喜用之气（对你更顺）的日子有 ' + U.kw(goodDays.length + ' 天') + '。',
            '关键天数提醒：' + (goodDays.length
              ? goodDays.map(function (x) { return U.kw(x.date.m + '/' + x.date.d) + '（' + x.gz.gz + '，' + x.wu + '）'; }).join('、') +
                '——这几天适合安排重要事项、会议、面谈或需要好状态的任务。'
              : '本周喜用日较少，属积蓄期。把重点放在整理、学习与关系维护上，不必强求推进。')
          ]) +
          '<div style="margin-top:var(--sp-5)">' +
          U.table(['日期', '星期', '干支', '五行', '倾向'],
            weekDays.map(function (x) {
              return [
                U.pad2(x.date.m) + '-' + U.pad2(x.date.d),
                '周' + x.weekday,
                '<strong>' + U.esc(x.gz.gz) + '</strong>',
                U.esc(x.wu),
                U.tag(x.isXi ? '得力' : '平顺', x.isXi ? 'ok' : 'idle')
              ];
            })) + '</div>' +
          '<div style="margin-top:var(--sp-5)">' + U.tips([
            { t: '本周机遇', d: goodDays.length ? '顺遂日集中在本周中段，适合把最重要的一件事安排在这些日子。'
                : '机会藏在积累里，本周适合把之前拖延的基础工作清空，为下一波顺遂日腾出空间。' },
            { t: '本周风险', d: '避免在情绪波动时做决定；涉及他人协作的事项，提前把预期说清楚。' },
            { t: '行事优先级', d: '① 先做不可逆或时间敏感的事；② 再做需要协作的事；③ 最后处理可延后的琐事。' }
          ]) + '</div>'
        ) +

        U.sec('四、月运势 · ' + today.y + '年' + today.m + '月',
          U.paras([
            '本月月柱 ' + U.kw(monthGZ.gz) + '（' + monthGZ.gan + '干' + monthGZ.zhi + '支）。',
            U.esc(monthGZ.meta) + '。',
            '<strong>事业进度：</strong>' + (yong.xiyong.indexOf(GZ.GAN_WUXING[monthGZ.gan]) >= 0
              ? '本月气机偏顺，适合推进计划、争取资源，重要节点可安排在中上旬。'
              : '本月气机偏平，适合内部整理、补齐细节，避免对外做重大承诺。'),
            '<strong>财运收支：</strong>以稳健为主，' + (yong.xiyong.indexOf(GZ.GAN_WUXING[monthGZ.gan]) >= 0
              ? '有机会获得阶段性回报，但需注意支出同步放大。'
              : '宜控制非必要开支，把资金留在确定性更高的用途上。'),
            '<strong>感情状态：</strong>' + (yong.xiyong.indexOf(GZ.GAN_WUXING[monthGZ.gan]) >= 0
              ? '相处氛围较轻松，适合安排共同活动增进关系。'
              : '易因琐事起摩擦，多倾听、少评判，把话说清楚比争对错更重要。'),
            '<strong>月度避坑重点：</strong>' + WX_LIFE[yong.jishen[0]].habit + '——' +
            '忌神之气对应的习惯在这段时间容易累积问题，刻意调整即可。'
          ])
        ) +

        U.sec('五、月度开运指南',
          U.tips([
            { t: '颜色', d: '主色调用 ' + lucky.color + '；重要场合可用' + lucky.color.split('、')[0] + '系点缀。' },
            { t: '方位', d: '宜向 ' + lucky.dir + ' 方向活动；办公座位、居家书桌朝向可优先考虑。' },
            { t: '数字', d: '参考幸运数字 ' + lucky.num + '（如日期、座号选择等，仅供参考）。' },
            { t: '习惯', d: lucky.habit + '。' },
            { t: '心态', d: '把「运势」当作提醒而非约束——它提示你哪里值得多花心思，而不是替你做决定。' }
          ])
        ) +

        U.sec('六、年度流年运势 · ' + today.y,
          U.paras([
            '全年干支 ' + U.kw(ln.gz) + '。' + U.esc(ziweiYearTone(pan, ln)) + '为本年主基调。',
            '<strong>全年大方向：</strong>' + (yong.xiyong.indexOf(GZ.GAN_WUXING[ln.gan]) >= 0
              ? '天干' + ln.gan + '属喜用，是适合主动出击、把计划落地的一年；把资源集中在最有把握的一两件事上，收益会最明显。'
              : '天干' + ln.gan + '非喜用，属稳守积累之年；与其追逐新机会，不如把现有的事做深做透，为下一轮顺遂年蓄力。'),
            '<strong>关键月份：</strong>可重点关注节气交界的月份（下方节点日历），这些时间点是运势转换的自然节律。',
            '<strong>机遇窗口：</strong>' + goodDays.length + ' 类「喜用日」集中出现的月份，通常是这一年里状态最好的阶段。',
            '<strong>需谨慎的阶段：</strong>节气交替前后各一周，环境与心境都容易起伏，重大决定宜避开这些窗口。',
            '<strong>全年成长建议：</strong>把注意力放在「可积累」的事情上——技能、关系、健康，这三样的复利最稳。'
          ])
        ) +

        U.sec('七、年度关键节点日历',
          yearNodes.length
            ? '<div class="stack-sm">' + yearNodes.map(function (n) {
                return '<div class="tip"><span class="tip__mark">节</span>' +
                  '<div><div class="tip__title">' + n.name + ' · ' + n.m + '月' + n.d + '日</div>' +
                  '<div class="tip__desc">节气交界，运势节律的自然转换点，适合做阶段性复盘与调整。</div></div></div>';
              }).join('') + '</div>'
            : U.emptyState('节', '节点数据加载中', '节气数据依赖天文历算模块。')
        ) +

        U.sec('八、本期核心关键词', U.kwList(coreKeywords))
    };
  }

  function dayFieldText(field, xi, wu) {
    var map = {
      '事业': xi ? '状态在线，适合处理需要判断力的事务。' : '宜处理流程性与整理类工作，重决策可缓一缓。',
      '财运': xi ? '有小额进项的倾向，适合做正向的财务安排。' : '以守为主，避免冲动消费与高波动投入。',
      '感情': xi ? '沟通氛围好，适合表达心意或安排共同活动。' : '易有小摩擦，多一分耐心，少一分评判。',
      '健康': '留意' + (GZ.WUXING_ADVICE && GZ.WUXING_ADVICE[wu] ? GZ.WUXING_ADVICE[wu].organ : '作息') + '，规律作息即可。',
      '人际': xi ? '易遇到愿意帮忙的人，主动开口更容易成事。' : '交往以礼相待即可，不必刻意外拓。'
    };
    return U.esc(map[field] || '');
  }

  /* 日干支（JDN 法，与排盘引擎同口径） */
  function dayGZOf(y, m, d) {
    var idx = ((global.ASTRO ? global.ASTRO.jdn(y, m, d) : 0) + 49) % 60;
    idx = ((idx % 60) + 60) % 60;
    return { gan: GZ.GAN[idx % 10], zhi: GZ.ZHI[idx % 12], gz: GZ.GAN[idx % 10] + GZ.ZHI[idx % 12] };
  }
  /* 月干支（五虎遁 + 节气换月近似：用当前月所在节气段判断，简化为按公历月节气近似） */
  function monthGZOf(y, m, yearGan) {
    /* 十二月建：立春起寅月。简化：1月取丑月，2月立春后取寅月，逐月顺推 */
    var zhiIdx = (m === 1) ? 1 : (m === 12 ? 0 : m - 1);   /* 2月→寅(2) 3月→卯(3) ... */
    if (m === 2) zhiIdx = 2;
    var yinGan = WUHU[yearGan] || '丙';
    var yinGanIdx = GZ.GAN.indexOf(yinGan);
    var step = mod(zhiIdx - 2, 12);
    var gan = GZ.GAN[mod(yinGanIdx + step, 10)];
    void y;
    return {
      gan: gan, zhi: GZ.ZHI[zhiIdx], gz: gan + GZ.ZHI[zhiIdx],
      meta: '月柱由年干五虎遁推得，节气换月'
    };
  }

  /* ===================== 提问回答（分区隔离） ===================== */

  function answer(pan, school, q) {
    var text = String(q || '').trim();
    if (!text) return { html: '<p>请先输入你想问的问题。</p>' };

    /* 分区关键词路由：命中其他分区关键词时，提示不串区（任务书 §四.1） */
    var KW = {
      nihaixia: ['倪海厦', '天纪', '天命', '人事', '地理', '人纪', '地脉', '人间道'],
      bazi: ['八字', '四柱', '日主', '十神', '喜用', '忌神', '大运', '格局', '旺衰', '五行', '用神', '食神', '伤官', '正财', '偏财', '正官', '偏官', '比肩', '劫财', '正印', '偏印', '排盘', '起运', '流年干支'],
      ziwei: ['紫微', '斗数', '命宫', '身宫', '主星', '辅星', '四化', '化禄', '化权', '化科', '化忌', '十二宫', '官禄宫', '财帛宫', '夫妻宫', '迁移宫', '疾厄宫', '田宅宫', '福德宫', '武将', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军', '煞星', '贵人星'],
      fortune: ['今天', '今日', '明天', '本周', '这周', '本月', '这个月', '今年', '运势', '宜忌', '择时', '幸运色', '幸运方位', '开运', '吉日', '短期', '抉择']
    };
    var hitOther = null;
    Object.keys(KW).forEach(function (s) {
      if (s === school) return;
      for (var i = 0; i < KW[s].length; i++) {
        if (text.indexOf(KW[s][i]) >= 0) { hitOther = s; return; }
      }
    });
    var schoolName = { nihaixia: '倪海厦命理', bazi: '四柱八字', ziwei: '紫微斗数', fortune: '通用运势' };
    if (hitOther) {
      return {
        html: '<p>这个问题更贴近 <strong>' + schoolName[hitOther] + '专区</strong> 的体系。' +
          '为保证流派专业性，各分区严格独立响应——建议切换到「' + schoolName[hitOther] +
          '」分区提问，那边会给出更贴合该体系的解答。</p>',
        crossed: true
      };
    }

    /* 分区专属应答 */
    var gen = { nihaixia: nihaixia, bazi: bazi, ziwei: ziwei, fortune: fortune }[school];
    if (!gen) return { html: '<p>未知分区。</p>' };
    var full = gen(pan, global.RESOURCE ? global.RESOURCE.get() : {});
    /* 从完整解读中挑选与问题相关的段落 */
    var picked = pickSections(full, text, school);
    return {
      html: U.sum('针对你的问题：' + U.esc(text)) + picked +
        '<div style="margin-top:var(--sp-4)">' + U.sec('补充提示',
          '<p>以上内容基于本分区体系（' + schoolName[school] + '）的排盘与推演，' +
          '仅供参考。如果想进一步展开某个方向，可以继续追问，或点击上方建议问题。</p>') + '</div>'
    };
  }

  /* 从完整解读 HTML 中按关键词挑段落 */
  function pickSections(full, q, school) {
    var secs = String(full.html).split('<div class="rsec">');
    var labels = secs.map(function (s) {
      var m = /rsec__label">([^<]+)</.exec(s);
      return { label: m ? m[1] : '', html: s };
    }).slice(1);
    /* 关键词 → 相关段落标签 */
    var RULES = [
      { k: ['事业', '工作', '职业', '择业', '行业', '发展'], tags: ['事业', '天赋', '官禄', '大运', '事业选择'] },
      { k: ['财', '收入', '钱', '理财', '投资'], tags: ['财', '财运', '财帛'] },
      { k: ['感情', '婚姻', '恋爱', '夫妻', '对象', '结婚'], tags: ['感情', '婚姻', '夫妻'] },
      { k: ['健康', '身体', '疾病', '病'], tags: ['健康', '疾厄', '养护'] },
      { k: ['性格', '特质', '脾气', '个性'], tags: ['性格', '人事', '命宫', '核心'] },
      { k: ['贵人', '人际', '朋友', '合作'], tags: ['贵人', '人际', '助力', '交友'] },
      { k: ['流年', '今年', '运势', '大运', '运程'], tags: ['流年', '运势', '大运'] },
      { k: ['喜用', '用神', '五行', '平衡', '缺'], tags: ['五行', '喜用', '平衡'] },
      { k: ['格局', '命格'], tags: ['格局', '星性', '命格'] },
      { k: ['建议', '怎么办', '如何', '怎么', '改善'], tags: ['建议', '专属', '趋避', '提醒'] },
      { k: ['断语', '经典', '古', '典'], tags: ['断语', '经典'] },
      { k: ['煞', '化解', '凶'], tags: ['煞星', '化解', '格局'] }
    ];
    var want = [];
    RULES.forEach(function (r) {
      for (var i = 0; i < r.k.length; i++) {
        if (q.indexOf(r.k[i]) >= 0) { want = want.concat(r.tags); break; }
      }
    });
    if (!want.length) {
      /* 没命中 → 给核心总结 + 前两段 */
      return secs.slice(0, 1).concat(labels.slice(0, 2).map(function (l) { return '<div class="rsec">' + l.html; })).join('');
    }
    var out = [];
    labels.forEach(function (l) {
      for (var i = 0; i < want.length; i++) {
        if (l.label.indexOf(want[i]) >= 0) { out.push('<div class="rsec">' + l.html); return; }
      }
    });
    if (!out.length) return secs.slice(0, 1).concat(labels.slice(0, 2).map(function (l) { return '<div class="rsec">' + l.html; })).join('');
    return out.join('');
  }

  /* ===================== 导出 ===================== */
  global.SCHOOLS = {
    nihaixia: nihaixia,
    bazi: bazi,
    ziwei: ziwei,
    fortune: fortune,
    dailySnapshot: dailySnapshot,
    answer: answer,
    renderPillars: renderPillars,
    computeZiwei: computeZiwei,
    name: { nihaixia: '倪海厦命理', bazi: '四柱八字', ziwei: '紫微斗数', fortune: '通用运势' }
  };
})(window);
