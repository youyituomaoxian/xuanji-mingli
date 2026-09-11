/* =========================================================================
 * resource.js — Skill 资源绑定与状态检测
 *
 * 三个开源仓库（已本地克隆）：
 *   nihaixia     → ../_skills/nihaixia                  → 倪海厦命理专区
 *   bazi-skill   → ../_skills/bazi-skill                → 四柱八字专区
 *   MingLi-Bench → ../_skills/MingLi-Bench              → 紫微斗数专区
 *
 * 状态：ok（正常） / fail（获取失败） / parse（解析异常）
 * 报错文案严格遵循任务书约定。
 *
 * 注意：本模块只负责「探测 + 加载可读内容 + 报告状态」。
 * 纯静态页无法读取任意本地目录，因此采用「清单探测」：
 *   对已知关键文件路径逐一 fetch，全成功 = ok；关键文件缺失 = fail；
 *   文件在但结构无法解析 = parse。
 * ====================================================================== */
(function (global) {
  'use strict';

  /* ---------- 任务书约定的报错文案（唯一真源） ---------- */
  var FAIL_TEXT = {
    nihaixia: '【倪海厦Skill资源获取/解析失败，请检查本地已克隆：https://github.com/jangviktor-web/nihaixia.git】',
    bazi:     '【四柱八字Skill资源获取/解析失败，请检查本地已克隆：https://github.com/jinchenma94/bazi-skill.git】',
    ziwei:    '【MingLi-Bench基准数据集获取/解析失败，请检查本地已克隆：https://github.com/DestinyLinker/MingLi-Bench.git】',
    fortune:  '【部分命理Skill资源异常，周期运势参考结果可能存在偏差】'
  };
  var GENERIC_FAIL = 'Skill资源获取/解析失败，请检查Git仓库链接、网络环境，确认本地已完整克隆对应开源仓库文件';

  /* ---------- 资源清单（每项含必须命中的关键文件） ---------- */
  var MANIFEST = {
    nihaixia: {
      id: 'nihaixia',
      name: '倪海厦天纪体系',
      repo: 'https://github.com/jangviktor-web/nihaixia.git',
      root: '../_skills/nihaixia/',
      keyFiles: ['README.md', 'modules/09_zhenjiu_bencao.md'],
      /* 天纪命理正文在 09_zhenjiu_bencao.md 的《天纪体系》一节 */
      knowledgeFile: 'modules/09_zhenjiu_bencao.md',
      note: '该库主体为中医典籍，天纪命理内容集中于《天纪体系》一节。'
    },
    bazi: {
      id: 'bazi',
      name: '四柱八字（子平体系）',
      repo: 'https://github.com/jinchenma94/bazi-skill.git',
      root: '../_skills/bazi-skill/',
      keyFiles: ['SKILL.md', 'scripts/pai_pan.py', 'references/wuxing-tables.md'],
      knowledgeFiles: [
        'references/wuxing-tables.md',
        'references/shensha-table.md',
        'references/dayun-rules.md',
        'references/shichen-table.md',
        'references/classical-texts.md'
      ],
      note: '含零依赖排盘引擎 pai_pan.py 与五份参考表，为本项目排盘真源之一。'
    },
    ziwei: {
      id: 'ziwei',
      name: 'MingLi-Bench 基准数据集',
      repo: 'https://github.com/DestinyLinker/MingLi-Bench.git',
      root: '../_skills/MingLi-Bench/',
      keyFiles: ['data/data.json'],
      knowledgeFile: 'data/fortune_api_results.json',
      note: '评测题库 + 32 例预排盘快照，用于交叉校验紫微安星结果。'
    }
  };

  /* ---------- 运行时状态表 ---------- */
  var state = {
    nihaixia: { id: 'nihaixia', status: 'idle', text: '检测中', detail: '', data: null, checkedAt: 0 },
    bazi:     { id: 'bazi',     status: 'idle', text: '检测中', detail: '', data: null, checkedAt: 0 },
    ziwei:    { id: 'ziwei',    status: 'idle', text: '检测中', detail: '', data: null, checkedAt: 0 },
    fortune:  { id: 'fortune',  status: 'idle', text: '检测中', detail: '', data: null, checkedAt: 0 }
  };

  function setState(id, status, text, detail, data) {
    var s = state[id];
    s.status = status; s.text = text; s.detail = detail || ''; s.data = data || null;
    s.checkedAt = Date.now();
    emit();
  }

  var listeners = [];
  function on(fn) { listeners.push(fn); }
  function emit() {
    var snapshot = get();
    listeners.forEach(function (fn) { try { fn(snapshot); } catch (e) { /* 单个监听器异常不影响其他 */ } });
  }
  function get() {
    var o = {};
    Object.keys(state).forEach(function (k) {
      o[k] = { id: state[k].id, status: state[k].status, text: state[k].text,
               detail: state[k].detail, hasData: !!state[k].data,
               origin: origin[k] || '',
               builtAt: (k !== 'fortune' && global.KB_INLINE && global.KB_INLINE.builtAt) || '',
               note: (MANIFEST[k] || {}).note || '' };
    });
    return o;
  }

  /* ---------- 单个文件探测 ---------- */
  function probe(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) return { ok: false, code: r.status };
      return r.text().then(function (t) { return { ok: true, text: t }; });
    }).catch(function (e) {
      return { ok: false, code: 'NET', err: String(e && e.message || e) };
    });
  }

  /* ---------- 数据来源标记：'inline'（构建时内联快照）| 'live'（本地仓库实时读取） ---------- */
  var origin = { nihaixia: '', bazi: '', ziwei: '', fortune: '' };

  /* 针对不同失败原因给出「可操作」的指引（原实现只报 code，用户无法自行解决） */
  function hintFor(code) {
    if (code === 'NET') {
      return '原因：浏览器禁止 file:// 页面读取本地文件（CORS/opaque origin）。' +
             '解决办法（任选其一）：① 用本地 HTTP 服务打开本页；② 重新生成内联快照 node _tools/build-kb.js。';
    }
    if (code === 404) {
      return '原因：HTTP 服务的根目录不对。解决办法：把服务根目录设为「公司分析」' +
             '（即 _skills 的上级目录），而不是「玄学工作台」本身。';
    }
    if (typeof code === 'number') return 'HTTP ' + code + '（无权限或路径错误）';
    return '未知错误';
  }

  /* 内联快照的摘要文案 */
  function summarize(id, inline) {
    if (!inline) return '已就绪';
    if (id === 'nihaixia') {
      return '天纪正文 ' + (inline.len || 0) + ' 字符 · 十四主星 ' + ((inline.stars14 || []).length) +
             ' · 十二宫 ' + ((inline.palaces12 || []).length) + ' · 六十四卦 ' + ((inline.gua64 || []).length);
    }
    if (id === 'bazi') {
      return '参考表 ' + Object.keys(inline.files || {}).length + ' 份 · ' + (inline.total || 0) + ' 字符';
    }
    if (id === 'ziwei') return '权威命例 ' + ((inline.cases || []).length) + ' 例（含亮度/四化/辅星）';
    return '已就绪';
  }

  /* 部署环境识别（★ 书 E0-1）
     实时探测本地仓库只在本机开发时成立（localhost / 127.0.0.1 / file://）。
     一旦部署到 GitHub Pages / Cloudflare Pages 等公网域名，../_skills/ 必然 404，
     若仍走「实时优先 → 失败降级」，状态明细会显示一串误导性的
     「本地仓库未同步：xxx(404)」——部署环境根本没有本地仓库，这不是异常。
     故：非本机环境直接走内联快照，origin 标记为 inline，不发起注定失败的探测。 */
  function isLocalHost() {
    if (typeof location === 'undefined') return false;
    var h = (location.hostname || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' ||
           /^127\./.test(h) || /^192\.168\./.test(h) || /^10\./.test(h);
  }
  var canLiveProbe = (typeof location !== 'undefined' && /^https?:$/.test(location.protocol || '')) && isLocalHost();

  /* ---------- 检测一个资源 ---------- */
  function check(id) {
    var m = MANIFEST[id];
    if (!m) return Promise.resolve(null);
    setState(id, 'checking', '检测中', '', null);

    var inline = (global.KB_INLINE || {})[id];
    var hasInline = !!(inline && inline.ok !== false);

    /* 使用内联快照收口 */
    function useInline(why) {
      origin[id] = 'inline';
      setState(id, 'ok', '正常',
        '内置快照' + (why ? '（本地仓库未同步：' + why + '）' : ' · ' + summarize(id, inline)),
        inline);
      return { id: id, status: 'ok', origin: 'inline' };
    }

    /* file:// 或无 HTTP 环境：fetch 必然失败，直接用内联快照 */
    if (!canLiveProbe) {
      if (hasInline) return Promise.resolve(useInline(''));
      setState(id, 'fail', '获取失败', '未找到内置快照。' + hintFor('NET'), null);
      return Promise.resolve({ id: id, status: 'fail' });
    }

    /* HTTP 环境：优先实时读取本地仓库，失败则降级到内联快照 */
    var files = m.keyFiles.slice();
    return Promise.all(files.map(function (f) {
      return probe(m.root + f).then(function (r) { return { file: f, r: r }; });
    })).then(function (results) {
      var missing = results.filter(function (x) { return !x.r.ok; });

      if (missing.length > 0) {
        var why = missing.map(function (x) { return x.file + '(' + x.r.code + ')'; }).join('、');
        if (hasInline) return useInline(why);          /* 内联兜底，状态仍为「正常」 */
        setState(id, 'fail', '获取失败', '缺失关键文件：' + why + ' ' + hintFor(missing[0].r.code), null);
        return { id: id, status: 'fail' };
      }

      var kn = m.knowledgeFile || (m.knowledgeFiles && m.knowledgeFiles[0]);
      if (!kn) {
        origin[id] = 'live';
        setState(id, 'ok', '正常', '本地仓库已同步 · 关键文件齐备', inline || { files: files.length });
        return { id: id, status: 'ok', origin: 'live' };
      }
      return probe(m.root + kn).then(function (r) {
        if (!r.ok) {
          if (hasInline) return useInline('知识正文不可读：' + kn + '(' + r.code + ')');
          setState(id, 'parse', '解析异常', '知识正文不可读：' + kn + ' ' + hintFor(r.code), null);
          return { id: id, status: 'parse' };
        }
        var parsed = parseKnowledge(id, r.text, kn);
        if (!parsed || parsed.ok === false) {
          if (hasInline) return useInline((parsed && parsed.why) || '结构不符');
          setState(id, 'parse', '解析异常', (parsed && parsed.why) || '知识正文结构不符合预期', null);
          return { id: id, status: 'parse' };
        }
        origin[id] = 'live';
        setState(id, 'ok', '正常', '本地仓库已同步 · ' + (parsed.summary || '资源就绪'), parsed.data);
        return { id: id, status: 'ok', origin: 'live' };
      });
    }).catch(function (e) {
      if (hasInline) return useInline(String(e && e.message || e));
      setState(id, 'fail', '获取失败', String(e && e.message || e) + ' ' + hintFor('NET'), null);
      return { id: id, status: 'fail' };
    });
  }

  /* ---------- 知识正文解析（按仓库分支） ---------- */
  function parseKnowledge(id, text, file) {
    if (id === 'nihaixia') {
      /* 抽取《天纪体系》一节：从"天纪"标题起，到下一个同级/更高级标题止 */
      var i = text.indexOf('天纪');
      if (i < 0) return { ok: false, why: '未在 ' + file + ' 中找到「天纪」章节' };
      var tail = text.slice(i, i + 12000);
      /* 截到下一个二级/一级标题（排除自身标题行） */
      var cut = tail.search(/\n#{1,2}\s+(?!.*天纪)/);
      var section = cut > 0 ? tail.slice(0, cut) : tail;
      return {
        ok: true,
        summary: '天纪体系正文 ' + section.split('\n').length + ' 行',
        data: {
          kind: 'nihaixia',
          section: section,
          /* 四大框架，供 schools.js 组织话术 */
          frames: ['天命（先天禀赋）', '人事（性格与抉择）', '地理（环境与方位）', '流年（岁运吉凶）'],
          stars14: extractTable(section, '紫微'),
          palaces12: extractTable(section, '命宫')
        }
      };
    }
    if (id === 'bazi') {
      /* 参考表：解析成 { 标题: 内容 } 便于检索 */
      var map = {};
      var lines = text.split('\n');
      var cur = '概述';
      lines.forEach(function (ln) {
        var h = /^#{1,4}\s+(.+)/.exec(ln);
        if (h) { cur = h[1].trim(); map[cur] = map[cur] || []; return; }
        if (!map[cur]) map[cur] = [];
        if (ln.trim()) map[cur].push(ln);
      });
      return {
        ok: true,
        summary: '参考表 ' + Object.keys(map).length + ' 节',
        data: { kind: 'bazi', sections: map, raw: text }
      };
    }
    if (id === 'ziwei') {
      var j;
      try { j = JSON.parse(text); } catch (e) { return { ok: false, why: 'fortune_api_results.json JSON 解析失败' }; }
      var arr = Array.isArray(j) ? j : (j.results || j.data || []);
      if (!Array.isArray(arr)) return { ok: false, why: '数据集顶层结构既非数组也无 results/data 数组' };
      return {
        ok: true,
        summary: '预排盘命例 ' + arr.length + ' 例',
        data: { kind: 'ziwei', cases: arr }
      };
    }
    return { ok: true, summary: '已加载' };
  }

  /* 从 markdown 表格里粗提关键行（用于星曜/宫位名词表） */
  function extractTable(section, keyword) {
    var out = [];
    section.split('\n').forEach(function (ln) {
      if (ln.indexOf('|') < 0) return;
      if (ln.indexOf('---') >= 0) return;
      var cells = ln.split('|').map(function (c) { return c.trim(); }).filter(Boolean);
      if (cells.length >= 2 && out.length < 24) out.push(cells);
    });
    return out;
  }

  /* ---------- 批量检测 ---------- */
  function checkAll() {
    return Promise.all(['nihaixia', 'bazi', 'ziwei'].map(check)).then(function (rs) {
      /* 通用运势分区的状态派生自三大分区 */
      var bad = rs.filter(function (r) { return r && r.status !== 'ok'; });
      if (bad.length === 0) setState('fortune', 'ok', '正常', '上游三流派资源就绪', null);
      else setState('fortune', 'warn', '降级参考', bad.length + ' 个上游资源异常', null);
      return get();
    });
  }

  function failText(id) { return FAIL_TEXT[id] || GENERIC_FAIL; }

  global.RESOURCE = {
    MANIFEST: MANIFEST,
    FAIL_TEXT: FAIL_TEXT,
    GENERIC_FAIL: GENERIC_FAIL,
    check: check,
    checkAll: checkAll,
    get: get,
    on: on,
    failText: failText,
    isOk: function (id) { return state[id] && state[id].status === 'ok'; },
    /* 数据优先取内联快照（file:// 下唯一可用来源），否则取实时解析结果 */
    data: function (id) {
      if (origin[id] === 'inline') {
        var k = (global.KB_INLINE || {})[id];
        if (k) return k;
      }
      return state[id] ? state[id].data : null;
    },
    origin: function (id) { return origin[id] || ''; },
    hasInline: function () { return !!global.KB_INLINE; },
    builtAt: function () { return (global.KB_INLINE && global.KB_INLINE.builtAt) || ''; },
    hintFor: hintFor
  };
})(window);
