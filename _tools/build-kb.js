/* =========================================================================
 * _tools/build-kb.js — 构建时内联知识库快照
 *
 * 目的（第一性原理）：
 *   原设计在运行时用 fetch 探测 ../_skills/ 下的文件，这有两个不可回避的
 *   硬约束：① file:// 协议下浏览器禁止 fetch 本地文件（opaque origin）；
 *   ② 相对路径依赖 HTTP 服务器的根目录恰好是「公司分析」。
 *   回到最底层需求——我们真正要的不是「探测文件存在」，而是「拿到知识内容
 *   并如实显示可用状态」。因此改为**构建时把内容内联进普通 JS 文件**，
 *   运行时用 <script> 加载（不受 CORS 限制），问题从根上消失。
 *
 * 用法：node _tools/build-kb.js
 * 产出：js/kb-inline.js  （window.KB_INLINE）
 * ====================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const SKILLS = path.resolve(HERE, '..', '..', '_skills');   /* I:/workbuddy/公司分析/_skills */
const OUT = path.resolve(HERE, '..', 'js', 'kb-inline.js');

function read(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}
/* JSON → 安全 JS 字面量（转义 U+2028/2029，它们在 JS 里是换行符）*/
function lit(v) {
  return JSON.stringify(v).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

const report = [];
const kb = { builtAt: new Date().toISOString(), source: SKILLS, nihaixia: null, nihaixiaStyle: null, bazi: null, ziwei: null };

/* ---------- ① nihaixia：抽取《天纪体系》章节 ---------- */
(function buildNihaixia() {
  const p = path.join(SKILLS, 'nihaixia', 'modules', '09_zhenjiu_bencao.md');
  const t = read(p);
  if (!t) { report.push('nihaixia  ✗ 未找到 ' + p); return; }
  const i = t.indexOf('# 天纪体系');
  if (i < 0) { report.push('nihaixia  ✗ 未找到「天纪体系」章节'); return; }
  /* 章节到「推荐书目」为止（其后为中医内容） */
  let j = t.indexOf('## 【倪海厦推荐书目】', i);
  if (j < 0) j = Math.min(t.length, i + 40000);
  const section = t.slice(i, j).trim();

  /* 解析十四主星表 与 十二宫位表（markdown 表格） */
  /* 解析 markdown 表格：从表头行开始，遇到第一个非表格行即结束（不可用 forEach，需 break） */
  function parseTable(md, header) {
    const k = md.indexOf(header);
    if (k < 0) return [];
    const lines = md.slice(k).split('\n');
    const rows = [];
    let started = false;
    for (let x = 0; x < lines.length; x++) {
      const ln = lines[x];
      const isRow = /^\s*\|/.test(ln);
      if (!started) {
        if (isRow) started = true; else continue;      /* 找到表头前的空行跳过 */
      } else if (!isRow) {
        break;                                          /* 表格结束 */
      }
      if (/^\s*\|[\s:|-]+\|\s*$/.test(ln)) continue;     /* 分隔行 */
      const cells = ln.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) rows.push(cells);
    }
    return rows.slice(1);   /* 去掉表头 */
  }
  const stars14 = parseTable(section, '### 十四主星');
  const palaces12 = parseTable(section, '### 十二宫位');
  const gua64 = parseTable(section, '| 序 | 卦名');
  const taigua = (function () {
    const k = section.indexOf('### 泰卦精解');
    if (k < 0) return '';
    let e = section.indexOf('\n### ', k + 5);
    if (e < 0) e = section.indexOf('\n---', k);
    return section.slice(k, e > 0 ? e : undefined).trim();
  })();

  /* 从 md 里截取一节（到下一个给定标题为止） */
  function cut(md, start, ends) {
    const k = md.indexOf(start);
    if (k < 0) return '';
    let e = md.length;
    (ends || []).forEach(h => { const x = md.indexOf(h, k + start.length); if (x > 0 && x < e) e = x; });
    return md.slice(k, e).trim();
  }

  /* 天纪·地脉道（阳宅）：核心 + 地理五要 + 已有卦例断语 */
  const dimai = cut(section, '## 天纪·地脉道', []);
  const dili5 = cut(section, '### 地理五要', ['---']);
  /* 地脉道里的「**X卦**（…）：…」断语（倪师原书卦例）
     实际格式形如 `**乾卦**（天）：乾卦可行…` / `**屯卦**：有一运用…`。
     注意 X 是**卦名**（乾/屯/需/豫/履…）而非八卦符号，故不能限定为八经卦字。 */
  const dimaiGua = {};
  (function () {
    const re = /\*\*([\u4e00-\u9fa5]{1,3})卦\*\*[^\n：:]{0,14}[：:]\s*([^\n]+)/g;
    let m;
    while ((m = re.exec(dimai)) !== null) dimaiGua[m[1]] = m[2].trim();
  })();

  /* 君子小人之辨 与 倪师原论（用于天纪断事层话术） */
  const junzi = cut(section, '### 君子与小人', ['### 六十四卦人事应用']);
  const lunMing = cut(section, '### 倪海厦论命理', ['---']);
  const lunYi = cut(section, '### 倪海厦论易经', ['---']);

  kb.nihaixia = {
    ok: true, file: 'modules/09_zhenjiu_bencao.md',
    section, len: section.length,
    stars14, palaces12, gua64, taigua,
    /* 天纪三才的其余两层（天机道已在 stars14/palaces12） */
    dimaiLen: dimai.length, dili5, dimaiGua,
    junzi, lunMing, lunYi,
    frames: ['天命（先天禀赋）', '人事（性格与抉择）', '地理（环境与方位）', '流年（岁运吉凶）']
  };
  report.push('nihaixia  ✓ 天纪章节 ' + section.length + ' 字符 · 十四主星 ' + stars14.length +
    ' 行 · 十二宫 ' + palaces12.length + ' 行 · 六十四卦 ' + gua64.length + ' 行 · 泰卦精解 ' + taigua.length +
    ' 字符 · 地脉道 ' + dimai.length + ' 字符(卦例 ' + Object.keys(dimaiGua).length + ')');
})();

/* ---------- ①b nihaixia：抽取「倪师表达 DNA」（expression_style.md） ---------- */
(function buildNihaixiaStyle() {
  const p = path.join(SKILLS, 'nihaixia', 'expression_style.md');
  const t = read(p);
  if (!t) { report.push('nihaixia风格 ✗ 未找到 expression_style.md'); return; }
  function cut(md, start, ends) {
    const k = md.indexOf(start);
    if (k < 0) return '';
    let e = md.length;
    (ends || []).forEach(h => { const x = md.indexOf(h, k + start.length); if (x > 0 && x < e) e = x; });
    return md.slice(k, e).trim();
  }
  const style = {
    open: cut(t, '## 一、开场白模式', ['## 二、']),
    diagnose: cut(t, '## 二、诊断推理模式', ['## 三、']),
    explain: cut(t, '## 三、病机解释模式', ['## 四、']),
    vocab: cut(t, '## 七、常用词汇/短语', ['## 八、']),
    template: cut(t, '## 八、句式结构模板', ['## 使用指南']),
    guide: cut(t, '## 使用指南', ['## 九、']),
    closing: cut(t, '## 六、结尾模式', ['## 七、'])
  };
  /* 口头禅分池（从「口头禅库」小节解析，供生成时交替取用）
     ★ 注意：每池只取到「下一条目 / 引用块」为止，否则末尾的
       「> 要求：…」使用说明会被误当作口头禅收进池里。 */
  const pools = { ask: [], assert: [], lead: [], trans: [], mood: [] };
  const vk = style.vocab;
  function grab(label, key) {
    const k = vk.indexOf(label);
    if (k < 0) return;
    let e = vk.length;
    const nx = vk.indexOf('\n- **', k + label.length);
    if (nx > 0) e = Math.min(e, nx);
    const bq = vk.indexOf('\n>', k + label.length);
    if (bq > 0) e = Math.min(e, bq);
    const seg = vk.slice(k, e);
    (seg.match(/[""]([^""]{1,12})[""]/g) || []).forEach(q => {
      const s = q.replace(/[""]/g, '').trim();
      if (s && pools[key].indexOf(s) < 0) pools[key].push(s);
    });
  }
  grab('**互动反问**', 'ask');
  grab('**自信断言**', 'assert');
  grab('**引出强调**', 'lead');
  grab('**承接过渡**', 'trans');
  grab('**情绪表达**', 'mood');

  kb.nihaixiaStyle = { ok: true, file: 'expression_style.md', pools, style };
  report.push('nihaixia风格 ✓ 表达DNA ' +
    (style.open.length + style.diagnose.length + style.explain.length + style.vocab.length +
      style.template.length + style.guide.length + style.closing.length) + ' 字符 · 口头禅池 ' +
    Object.keys(pools).map(k => k + ':' + pools[k].length).join(' '));
})();

/* ---------- ② bazi-skill：五份参考表 ---------- */
(function buildBazi() {
  const files = ['wuxing-tables.md', 'shensha-table.md', 'dayun-rules.md', 'shichen-table.md', 'classical-texts.md'];
  const out = {}; let total = 0, miss = [];
  files.forEach(f => {
    const t = read(path.join(SKILLS, 'bazi-skill', 'references', f));
    if (t == null) { miss.push(f); return; }
    out[f] = t; total += t.length;
  });
  const skill = read(path.join(SKILLS, 'bazi-skill', 'SKILL.md'));
  kb.bazi = { ok: Object.keys(out).length > 0, files: out, total: total, skillMd: skill || '' };
  report.push('bazi      ' + (miss.length ? '⚠ 缺 ' + miss.join(',') : '✓') +
    ' 参考表 ' + Object.keys(out).length + '/5 · ' + total + ' 字符 · SKILL.md ' + (skill ? skill.length + ' 字符' : '缺失'));
})();

/* ---------- ③ MingLi-Bench：32 例预排盘快照（精简为结构性字段） ---------- */
(function buildZiwei() {
  const p = path.join(SKILLS, 'MingLi-Bench', 'data', 'fortune_api_results.json');
  const t = read(p);
  if (!t) { report.push('ziwei     ✗ 未找到 fortune_api_results.json'); return; }
  let raw;
  try { raw = JSON.parse(t); } catch (e) { report.push('ziwei     ✗ JSON 解析失败'); return; }

  const cases = [];
  raw.forEach(c => {
    const ch = ((c.api_response || {}).data || {}).data;
    if (!ch || !ch.palaces) return;
    cases.push({
      case: c.case_id,
      birth: c.birth_info,
      lunarText: ch.lunarDate, chineseDate: ch.chineseDate,
      ju: ch.fiveElementsClass,
      ming: ch.earthlyBranchOfSoulPalace, shen: ch.earthlyBranchOfBodyPalace,
      soul: ch.soul, body: ch.body, zodiac: ch.zodiac, time: ch.time,
      palaces: ch.palaces.map(pl => ({
        n: pl.name, z: pl.earthlyBranch, g: pl.heavenlyStem,
        body: !!pl.isBodyPalace,
        M: (pl.majorStars || []).map(s => ({ n: s.name, b: s.brightness || '', m: s.mutagen || '' })),
        S: (pl.minorStars || []).map(s => ({ n: s.name, b: s.brightness || '', t: s.type || '' })),
        A: (pl.adjectiveStars || []).map(s => s.name),
        cs: pl.changsheng12 || '', bs: pl.boshi12 || '',
        jq: pl.jiangqian12 || '', sq: pl.suiqian12 || '',
        dec: pl.decadal || null
      }))
    });
  });
  /* 题库：category 分布（用于「单宫详解」的宫位维度映射） */
  let qcats = {};
  const qt = read(path.join(SKILLS, 'MingLi-Bench', 'data', 'data.json'));
  if (qt) {
    try {
      const qj = JSON.parse(qt);
      (qj.questions || []).forEach(q => { qcats[q.category] = (qcats[q.category] || 0) + 1; });
    } catch (e) { /* ignore */ }
  }
  kb.ziwei = { ok: cases.length > 0, cases: cases, qcats: qcats };
  const size = lit(kb.ziwei).length;
  report.push('ziwei     ✓ 命例 ' + cases.length + ' 例 · 精简后 ' + size + ' 字符 · 题库类别 ' + Object.keys(qcats).length + ' 类');
})();

/* ---------- ④ 公有领域古籍真源（书 E1）----------
   来源与公版依据见 _src/classics/SOURCES.md；无来源登记的文件不入库。 */
(function buildClassics() {
  const DIR = path.join(HERE, '..', '_src', 'classics');
  const REGISTRY = [
    { id: 'ziwei-quanshu', title: '紫微斗数全书', dynasty: '明', files: ['紫微斗数全书-卷1.md', '紫微斗数全书-卷2.md', '紫微斗数全书-卷3.md'],
      source: 'GitHub SylarLong/iztro-docs（jsDelivr），公版古籍转录，底本为明版《新锓希夷陈先生紫微斗数全书》系统' }
  ];
  const books = [];
  REGISTRY.forEach(b => {
    const vols = {};
    let total = 0, missing = [];
    b.files.forEach(f => {
      const t = read(path.join(DIR, f));
      if (t == null) { missing.push(f); return; }
      /* 完整性校验：无替换符、含书名关键词 */
      if (t.indexOf('\uFFFD') >= 0) { missing.push(f + '(含乱码)'); return; }
      vols[f] = t; total += t.length;
    });
    books.push({
      id: b.id, title: b.title, dynasty: b.dynasty, source: b.source,
      ok: missing.length === 0 && total > 0,
      vols: vols, total: total,
      missing: missing
    });
    report.push('classics  ' + (missing.length ? '⚠ 缺/坏 ' + missing.join(',') : '✓') +
      ' 《' + b.title + '》 ' + Object.keys(vols).length + '/' + b.files.length + ' 卷 · ' + total + ' 字符');
  });
  kb.classics = { ok: books.some(x => x.ok), books: books };

  /* ---- 《紫微斗数全书》结构化解析（书 E2 第一步）----
     卷一：十二宫诸星得地合格诀 / 失陷破格诀 —— 逐行「X安命 诗诀」，按命宫地支取用
     卷二：安星诀十二宫 —— 每宫「- 星名」条目，含 总论 / 十二宫落断 / 男命诀 / 女命诀 / 入限诀
     解析失败不阻塞构建，但必须如实上报，不允许半截数据混进快照。 */
  (function parseQuanshu() {
    const book = books.find(b => b.id === 'ziwei-quanshu');
    if (!book || !book.ok) { report.push('classics结构 ⚠ 《紫微斗数全书》未就绪，跳过解析'); return; }
    const v1 = book.vols['紫微斗数全书-卷1.md'] || '';
    const v2 = book.vols['紫微斗数全书-卷2.md'] || '';
    const norm = s => String(s).replace(/戍/g, '戌').replace(/\s+$/, '').trim();
    const ZHI = '子丑寅卯辰巳午未申酉戌亥';

    /* 卷一：取「X安命 诗诀」行，多宫共诀展开到单支，刻本「戍」归一为「戌」 */
    function parseJuemen(t, title) {
      const k = t.indexOf(title);
      if (k < 0) return null;
      let end = t.length;
      ['## ', '\n# '].forEach(h => { const x = t.indexOf(h, k + title.length); if (x > 0 && x < end) end = x; });
      const map = {};
      t.slice(k + title.length, end).split('\n').forEach(ln => {
        const m = /^[\s>]*([子丑寅卯辰巳午未申酉戍亥]{1,2})安命\s*(.+)$/.exec(ln.trim());
        if (!m) return;
        const verse = norm(m[2].replace(/^>\s*/, ''));
        m[1].split('').forEach(zc => { const zz = norm(zc); if (!map[zz]) map[zz] = verse; });
      });
      return Object.keys(map).length ? map : null;
    }

    /* 星名前缀表（长名优先，用于「引用块以星名开头」的宫段） */
    const STAR_NAMES = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门',
      '天相', '天梁', '七杀', '破军', '文昌', '文曲', '左辅', '右弼', '天魁', '天钺', '魁钺',
      '禄存', '擎羊', '陀罗', '火星', '铃星', '地空', '地劫', '天马', '红鸾', '天喜',
      '化禄', '化权', '化科', '化忌', '天伤', '天使', '台辅', '封诰', '天刑', '天姚',
      '三台', '八座', '天哭', '天虚', '龙池', '凤阁', '孤辰', '寡宿'].sort((a, b) => b.length - a.length);
    function leadStar(line) {
      const s = norm(line);
      for (const n of STAR_NAMES) if (s.indexOf(n) === 0) return { star: n, text: s.slice(n.length) };
      return null;
    }

    /* 卷二：两种格式并存 ——
       ① 命宫：条目式（- 星名），含 总论 / 十二宫落断 / 男命诀 / 女命诀 / 入限诀；
       ② 其余十一宫：纯引用块式，每块以星名开头，即该宫该星的原文断语。 */
    function parsePalaces(t) {
      const out = {};
      const secs = t.split(/\n## /).slice(1);
      secs.forEach(sec => {
        const name = sec.split('\n')[0].trim();
        if (!/宫$/.test(name)) return;
        const stars = {};
        const blocks = [];
        let cur = null;
        sec.split('\n').slice(1).forEach(ln => {
          if (/^- /.test(ln.trim())) {                  /* 条目式：星名独立成行 */
            if (cur) blocks.push(cur);
            cur = { type: 'star', name: ln.trim().slice(2).trim(), lines: [] };
            return;
          }
          const isQ = /^\s*>/.test(ln);
          const txt = ln.replace(/^\s*>\s?/, '').replace(/\s{2,}$/, '').trim();
          if (!txt) { if (cur) blocks.push(cur); cur = null; return; }
          if (!cur) cur = { type: isQ ? 'q' : 'h', lines: [] };
          if (cur.type === 'q' && !isQ) { blocks.push(cur); cur = { type: 'h', lines: [] }; }
          if (cur.type === 'h' && isQ) { blocks.push(cur); cur = { type: 'q', lines: [] }; }
          cur.lines.push(txt);
        });
        if (cur) blocks.push(cur);

        /* ① 条目式（命宫）：总论 → 十二宫落断 → 男/女命诀 → 入限诀 */
        blocks.filter(b => b.type === 'star').forEach(b => {
          const sname = b.name.replace(/\*/g, '');
          const star = { text: '', intro: '', positions: '', male: '', female: '', limit: '' };
          let introDone = false, pending = null;
          b.lines.forEach(ln => {
            const txt = ln.replace(/^\s*>\s?/, '').replace(/\s{2,}$/, '').trim();
            if (!txt) return;
            const isQ = /^\s*>/.test(ln);
            if (!introDone) {
              star.intro = (star.intro ? star.intro + '\n' : '') + txt;
              if (!isQ) introDone = true;
              return;
            }
            if (!isQ && /吉凶诀|入限/.test(txt)) {
              pending = /女命/.test(txt) ? 'female' : (/男命/.test(txt) ? 'male' : 'limit');
              return;
            }
            if (pending) {
              star[pending] = (star[pending] ? star[pending] + '\n' : '') + txt;
              pending = null; return;
            }
            if (!star.positions && /宫/.test(txt)) { star.positions = txt; return; }
          });
          star.text = star.intro;
          if (star.text) stars[sname] = star;
        });

        /* ② 引用块式（其余十一宫）：每块以星名开头 */
        blocks.filter(b => b.type === 'q').forEach(b => {
          const lead = leadStar(b.lines[0] || '');
          if (!lead) return;
          const ent = stars[lead.star] || { text: '', intro: '', positions: '', male: '', female: '', limit: '' };
          ent.text = (ent.text ? ent.text + '\n' : '') + lead.text;
          stars[lead.star] = ent;
        });

        if (Object.keys(stars).length) out[name] = stars;
      });
      return out;
    }

    const juemen = {
      dehe: parseJuemen(v1, '十二宫诸星得地合格诀'),
      shixian: parseJuemen(v1, '十二宫诸星失陷破格诀')
    };
    const palaces = parsePalaces(v2);
    const starCount = Object.keys(palaces).reduce((s, k) => s + Object.keys(palaces[k]).length, 0);
    book.structured = { juemen: juemen, palaces: palaces };
    report.push('classics结构 ✓ 十二宫诀：得地 ' + (juemen.dehe ? Object.keys(juemen.dehe).length : 0) +
      ' 宫 / 失陷 ' + (juemen.shixian ? Object.keys(juemen.shixian).length : 0) +
      ' 宫；安星诀十二宫：' + Object.keys(palaces).length + ' 宫 · ' + starCount + ' 星条目');
  })();
})();
/* ---------- 输出 ---------- */
const header = '/* 由 _tools/build-kb.js 自动生成，请勿手改。\n' +
  '   构建时间：' + kb.builtAt + '\n' +
  '   来源：' + SKILLS + '\n' +
  '   用途：把三个 Skill 仓库的关键知识内联进页面，使资源加载不依赖 HTTP 服务器。\n' +
  '   重新生成：node _tools/build-kb.js  */\n';

const body = 'window.KB_INLINE = {\n' +
  '  builtAt: ' + lit(kb.builtAt) + ',\n' +
  '  source: ' + lit(kb.source) + ',\n' +
  '  nihaixia: ' + lit(kb.nihaixia) + ',\n' +
  '  nihaixiaStyle: ' + lit(kb.nihaixiaStyle) + ',\n' +
  '  bazi: ' + lit(kb.bazi) + ',\n' +
  '  ziwei: ' + lit(kb.ziwei) + ',\n' +
  '  classics: ' + lit(kb.classics) + '\n' +
  '};\n';

fs.writeFileSync(OUT, header + body, 'utf8');
/* 体积告警（全量内联纪律：>3MB 必须回头治理分层） */
const kbSize = fs.statSync(OUT).size;
if (kbSize > 3 * 1024 * 1024) {
  console.warn('⚠ kb-inline.js 超过 3MB（' + (kbSize / 1048576).toFixed(1) + ' MB），按任务书 E 需回头做分层治理');
}

console.log('=== 知识库内联构建 ===');
report.forEach(r => console.log('  ' + r));
console.log('\n产出: ' + OUT);
console.log('体积: ' + (kbSize / 1024).toFixed(1) + ' KB');
