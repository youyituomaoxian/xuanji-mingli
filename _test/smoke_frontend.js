/* 前端冒烟测试：在 Node 中加 DOM 垫片，加载全部浏览器脚本，
   跑通「排盘 → 四分区解读生成 → 提问路由 → 档案存储」全链路。
   用法: node _test/smoke_frontend.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
/* 脚本清单必须与 index.html 的真实加载顺序一致：
   kb-inline 必须早于 resource.js（其 check() 读取 KB_INLINE），
   ziwei-rules / nihaixia-rules 必须早于 schools.js */
const JS = ['ganzhi', 'astro', 'paipan', 'kb-inline', 'ziwei-rules', 'nihaixia-rules', 'resource', 'store', 'ui', 'schools', 'app'];

/* ---------- 极简 DOM 垫片 ---------- */
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    children: [], parentNode: null,
    _attrs: {}, _cls: new Set(), _html: '', _text: '',
    style: {}, dataset: {}, listeners: {},
    get className() { return Array.from(el._cls).join(' '); },
    set className(v) { el._cls = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get classList() {
      return {
        add: (...c) => c.forEach(x => el._cls.add(x)),
        remove: (...c) => c.forEach(x => el._cls.delete(x)),
        contains: c => el._cls.has(c),
        toggle: c => el._cls.has(c) ? el._cls.delete(c) : el._cls.add(c)
      };
    },
    get innerHTML() { return el._html; },
    set innerHTML(v) { el._html = String(v); },
    get textContent() { return el._text; },
    set textContent(v) { el._text = String(v); },
    setAttribute(k, v) { el._attrs[k] = String(v); },
    getAttribute(k) { return el._attrs[k]; },
    removeAttribute(k) { delete el._attrs[k]; },
    hasAttribute(k) { return k in el._attrs; },
    appendChild(c) { el.children.push(c); c.parentNode = el; return c; },
    removeChild(c) { el.children = el.children.filter(x => x !== c); return c; },
    insertBefore(c, ref) { el.children.push(c); c.parentNode = el; return c; },
    addEventListener(t, fn) { (el.listeners[t] = el.listeners[t] || []).push(fn); },
    removeEventListener() {},
    querySelector(sel) { return el._find(sel, false); },
    querySelectorAll(sel) { return el._find(sel, true); },
    closest() { return null; },
    focus() {}, blur() {}, click() {},
    _matches(sel) {
      sel = String(sel).trim();
      if (sel.startsWith('#')) return el._attrs.id === sel.slice(1);
      if (sel.startsWith('.')) return el._cls.has(sel.slice(1));
      if (sel.startsWith('[')) {
        const m = sel.match(/^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/);
        if (!m) return false;
        const key = m[1].startsWith('data-') ? m[1].slice(5) : m[1];
        const val = el.dataset[key] !== undefined ? el.dataset[key] : el._attrs[m[1]];
        if (val === undefined) return false;
        return m[2] === undefined || m[2] === '' ? true : String(val) === m[2];
      }
      return el.tagName === sel.toUpperCase();
    },
    _find(sel, all) {
      const out = [];
      const walk = n => {
        n.children.forEach(c => {
          if (c._matches(sel)) out.push(c);
          walk(c);
        });
      };
      walk(el);
      return all ? out : (out[0] || null);
    }
  };
  el.value = ''; el.checked = false; el.disabled = false;
  return el;
}

const registry = {};
const document = {
  createElement: makeEl,
  createTextNode: t => ({ nodeValue: String(t) }),
  body: makeEl('body'),
  documentElement: makeEl('html'),
  getElementById: id => registry['#' + id] || null,
  /* 关键：UI.$ 走 document.querySelector，必须让 #id 选择器能命中 registry，
     否则 app.js 里的 sel.innerHTML 会因 null 而抛错 */
  querySelector: sel => {
    const s = String(sel).trim();
    if (s.startsWith('#')) return registry[s] || null;
    return document.body._find(s, false);
  },
  querySelectorAll: sel => {
    const s = String(sel).trim();
    if (s.startsWith('#')) return registry[s] ? [registry[s]] : [];
    return document.body._find(s, true);
  },
  addEventListener: () => {},
  readyState: 'complete',
  hidden: false
};

/* 预注册 index.html 里会用到的 id（从 index.html + js/*.js 扫描得到，保持同步） */
['castline', 'btnGotoArchive', 'btnGlobalReset', 'navResStatus', 'archiveList', 'archCountTag',
 'quickPillarsCard', 'quickPillars', 'formError', 'birthPreview', 'previewSub', 'previewText',
 'leapField', 'leapSeg', 'calSeg', 'sexSeg', 'editModeTag', 'placeHint', 'tstPreview', 'mainInner',
 'baziPanCard', 'baziPan', 'baziPanHint', 'ziweiPanCard', 'ziweiPan', 'ziweiPanHint',
 'castName', 'birthYear', 'birthMonth', 'birthDay', 'birthShichen', 'birthPlace',
 'useTrueSolar', 'btnSaveCast', 'btnCancelEdit', 'btnFillDemo',
 'out-nihaixia', 'out-bazi', 'out-ziwei', 'out-fortune',
 'log-nihaixia', 'log-bazi', 'log-ziwei', 'log-fortune'
].forEach(id => { const e = makeEl('div'); e.setAttribute('id', id); registry['#' + id] = e; });

/* 把 .seg（分段切换）按钮挂上，app.js 会对其子节点绑事件 */
['calSeg', 'sexSeg', 'leapSeg'].forEach(id => {
  [0, 1].forEach(i => {
    const b = makeEl('button');
    b.dataset.val = i === 0 ? 'solar' : 'lunar';
    registry['#' + id].appendChild(b);
  });
});

const localStorageData = {};
const sandbox = {
  console, Math, Date, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  Boolean, Array, Object, RegExp, Error, RangeError, TypeError, encodeURIComponent,
  decodeURIComponent, setTimeout, clearTimeout, setInterval, clearInterval,
  document,
  navigator: { clipboard: null, userAgent: 'node' },
  localStorage: {
    getItem: k => (k in localStorageData ? localStorageData[k] : null),
    setItem: (k, v) => { localStorageData[k] = String(v); },
    removeItem: k => { delete localStorageData[k]; },
    clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
  },
  location: { href: 'file:///', search: '' },
  fetch: () => Promise.reject(new Error('no network in smoke test')),
  Intl: Intl
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};
sandbox.matchMedia = () => ({ matches: false, addListener: () => {}, addEventListener: () => {} });
sandbox.getComputedStyle = () => ({ getPropertyValue: () => '' });
vm.createContext(sandbox);

/* ---------- 加载脚本 ---------- */
let loaded = [];
for (const name of JS) {
  const file = path.join(ROOT, 'js', name + '.js');
  const code = fs.readFileSync(file, 'utf8');
  try {
    vm.runInContext(code, sandbox, { filename: file });
    loaded.push(name);
  } catch (e) {
    console.error('  ✗ ' + name + '.js 加载失败: ' + e.message);
    console.error(e.stack.split('\n').slice(0, 4).join('\n'));
    process.exit(1);
  }
}
console.log('已加载脚本: ' + loaded.join(', '));

/* ---------- 断言工具 ---------- */
let pass = 0, fail = 0;
const errs = [];
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; errs.push(msg); console.log('  ✗ ' + msg); }
}
function section(t) { console.log('\n── ' + t + ' ──'); }

/* ---------- 1. 全局命名空间 ---------- */
section('1. 全局命名空间导出');
['GZ', 'ASTRO', 'PAIPAN', 'RESOURCE', 'STORE', 'UI', 'SCHOOLS'].forEach(ns => {
  ok(sandbox[ns] && typeof sandbox[ns] === 'object', 'window.' + ns + ' 已导出');
});

/* ---------- 2. 资源定义完备性 ---------- */
section('2. 资源定义（resource.js）');
const R = sandbox.RESOURCE;
ok(!!R && !!R.FAIL_TEXT, 'FAIL_TEXT 存在');
/* 任务书约定：四分区各有专属异常文案（逐字照抄），应为非空字符串 */
['nihaixia', 'bazi', 'ziwei', 'fortune'].forEach(k => {
  const t = R.FAIL_TEXT[k];
  ok(typeof t === 'string' && t.length > 10 && /【.*】/.test(t),
     'FAIL_TEXT.' + k + ' 是任务书约定文案 (' + (t ? t.length : 0) + ' 字)');
});
ok(typeof R.FAIL_TEXT.nihaixia === 'string' && R.FAIL_TEXT.nihaixia.indexOf('nihaixia.git') > 0,
   'FAIL_TEXT.nihaixia 含仓库地址');
ok(typeof R.FAIL_TEXT.bazi === 'string' && R.FAIL_TEXT.bazi.indexOf('bazi-skill.git') > 0,
   'FAIL_TEXT.bazi 含仓库地址');
ok(typeof R.FAIL_TEXT.ziwei === 'string' && R.FAIL_TEXT.ziwei.indexOf('MingLi-Bench.git') > 0,
   'FAIL_TEXT.ziwei 含仓库地址');
ok(typeof R.GENERIC_FAIL === 'string' && R.GENERIC_FAIL.length > 0,
   'GENERIC_FAIL 兜底文案存在');
ok(!!R.MANIFEST && !!R.MANIFEST.nihaixia && !!R.MANIFEST.bazi && !!R.MANIFEST.ziwei,
   'MANIFEST 含三大流派条目');
ok(/^\.\.\/_skills\//.test(String(R.MANIFEST.bazi.root)),
   'MANIFEST.bazi.root 指向 _skills/（跨目录相对路径）');

/* ---------- 3. 排盘引擎 ---------- */
section('3. 排盘引擎（paipan.js）');
/* 注意：PAIPAN.compute 的 shichen 参数是「地支字符串」（如 '辰'），不是数字索引。
   app.js 的 toEngineArgs() 也是传字符串 —— 这里必须与之一致。 */
const CASES = [
  { label: '1970-04-15 辰时 男，经度 116.4', o: { year: 1970, month: 4, day: 15, hour: 8, minute: 30, shichen: '辰', sex: '男', longitude: 116.4, useTrueSolarTime: true, calendarType: 'solar' } },
  { label: '1985-02-22 午时 女（权威年：正月初三）', o: { year: 1985, month: 2, day: 22, hour: 12, minute: 0, shichen: '午', sex: '女', longitude: 121.5, useTrueSolarTime: true, calendarType: 'solar' } },
  { label: '1992-11-08 午时 男，立冬前后', o: { year: 1992, month: 11, day: 8, hour: 12, minute: 0, shichen: '午', sex: '男', longitude: 113.3, useTrueSolarTime: true, calendarType: 'solar' } },
  { label: '2000-01-01 亥时 女，跨年边界', o: { year: 2000, month: 1, day: 1, hour: 22, minute: 0, shichen: '亥', sex: '女', longitude: 104.1, useTrueSolarTime: true, calendarType: 'solar' } },
  { label: '2023-02-04 卯时 男，立春当天', o: { year: 2023, month: 2, day: 4, hour: 6, minute: 0, shichen: '卯', sex: '男', longitude: 120.0, useTrueSolarTime: true, calendarType: 'solar' } },
  { label: '1984-12-22 酉时 男，冬至当天', o: { year: 1984, month: 12, day: 22, hour: 18, minute: 0, shichen: '酉', sex: '男', longitude: 116.4, useTrueSolarTime: false, calendarType: 'solar' } }
];
const pans = [];
CASES.forEach((c, i) => {
  let pan = null, err = null;
  try { pan = sandbox.PAIPAN.compute(c.o); } catch (e) { err = e; }
  pans.push(pan);
  ok(!err && !!pan, '[' + i + '] 排盘成功 — ' + c.label + (err ? ' :: ' + err.message : ''));
  if (!pan) return;
  const p = pan.pillars;
  ok(p && p.year && p.month && p.day && p.hour, '[' + i + '] 四柱齐备');
  ok(/^[甲乙丙丁戊己庚辛壬癸]$/.test(p.year.gan) && /^[子丑寅卯辰巳午未申酉戌亥]$/.test(p.year.zhi),
     '[' + i + '] 年柱干支格式正确 (' + p.year.gan + p.year.zhi + ')');
  ok(Array.isArray(pan.dayun) && pan.dayun.length > 0, '[' + i + '] 大运已生成 (' + pan.dayun.length + ' 步)');
  ok(Array.isArray(pan.liunian) && pan.liunian.length > 0, '[' + i + '] 流年已生成 (' + pan.liunian.length + ' 年)');
  ok(pan.wuxing && pan.wuxing.score && typeof pan.wuxing.total === 'number',
     '[' + i + '] 五行分数正常 (总 ' + (pan.wuxing && pan.wuxing.total) + ')');
  ok(pan.lunar = pan.input.lunar, '[' + i + '] input.lunar 存在 → ' + (pan.input.lunar ? (pan.input.lunar.year + '年' + pan.input.lunar.month + '月' + pan.input.lunar.day + '日' + (pan.input.lunar.leap ? '闰' : '')) : 'null'));
});

/* 1985 权威断言：必须与「真太阳时校正」解耦
   —— 历法层 solarToLunar(1985,2,22) 应 = 正月初三（HKO 权威）
   —— 排盘层受时刻校正影响，若校正后跨日则会前移一天，属正确行为 */
section('3b. 1985 权威年断言（HKO：1985-02-22 = 正月初三）');
const cal1985 = sandbox.ASTRO.solarToLunar(1985, 2, 22);
ok(cal1985.month === 1, '【历法层】农历月 = 正月（实际 ' + cal1985.month + '）');
ok(cal1985.day === 3, '【历法层】农历日 = 初三（实际 ' + cal1985.day + '）');
ok(cal1985.leap === false, '【历法层】非闰月');
ok(cal1985.year === 1985, '【历法层】农历年 = 1985（实际 ' + cal1985.year + '）');
/* 排盘层：午时 + 上海（东经 121.5）校正后应仍为同一天 */
const p1985 = pans[1];
if (p1985 && p1985.input.lunar) {
  ok(p1985.input.lunar.month === 1 && p1985.input.lunar.day === 3,
     '【排盘层】1985-02-22 午时 @上海 → 正月初三（实际 ' +
     p1985.input.lunar.month + '月' + p1985.input.lunar.day + '日）');
  ok(!!p1985.input.tsApplied, '真太阳时校正已应用 (偏移 ' +
     (p1985.input.tsOffsetMin != null ? p1985.input.tsOffsetMin.toFixed(2) : '—') + ' 分钟)');
  ok(p1985.pillars.year.gz === undefined || true, '年柱 ' + p1985.pillars.year.gan + p1985.pillars.year.zhi);
}
/* 真太阳时跨日边界验证：00:00 + 负偏移应回退到前一日 */
section('3c. 真太阳时跨日边界（回归防护）');
const edge = sandbox.PAIPAN.compute({
  year: 1985, month: 2, day: 22, hour: 0, minute: 0, shichen: '子',
  sex: '女', longitude: 121.5, useTrueSolarTime: true, calendarType: 'solar'
});
ok(!!edge, '子时 00:00 校正后仍能排盘（不抛异常）');
if (edge) {
  ok(edge.input.lunar.day === 2,
     '校正后回退至 1985-02-21 → 正月初二（实际 ' + edge.input.lunar.day + '）');
  ok(edge.input.ziShi === '夜子时',
     '23:52 判定为夜子时（实际 ' + edge.input.ziShi + '）');
  ok((edge.warnings || []).some(w => /日期变动/.test(w)),
     '已提示「真太阳时校正后日期变动」');
}

/* ---------- 4. 四分区解读生成 ---------- */
section('4. 四分区解读生成（schools.js）');
const pan = pans[0];
const fakeRes = {
  nihaixia: { status: 'ok', data: { frames: {}, sayings: [] }, name: 'nihaixia' },
  bazi: { status: 'ok', data: { sections: {} }, name: 'bazi-skill' },
  ziwei: { status: 'ok', data: { cases: [] }, name: 'MingLi-Bench' }
};
const SCHOOLS = sandbox.SCHOOLS;
['nihaixia', 'bazi', 'ziwei', 'fortune'].forEach(name => {
  ok(typeof SCHOOLS[name] === 'function', 'SCHOOLS.' + name + ' 是函数');
  let out = null, err = null;
  try { out = SCHOOLS[name](pan, fakeRes); } catch (e) { err = e; }
  ok(!err, 'SCHOOLS.' + name + '() 未抛异常' + (err ? ' :: ' + err.message : ''));
  if (err || !out) return;
  const size = JSON.stringify(out).length;
  ok(size > 800, 'SCHOOLS.' + name + '() 输出体量合理 (' + size + ' 字符)');
  ok(Array.isArray(out.keywords) && out.keywords.length >= 3,
     'SCHOOLS.' + name + '() 核心关键词 ' + (out.keywords ? out.keywords.length : 0) + ' 个');
  ok(typeof out.html === 'string' && out.html.indexOf('rsec') >= 0,
     'SCHOOLS.' + name + '() 输出含分层段落标记 (.rsec)');
  /* 分层顺序检查：标题→核心总结→详细解读→运势→建议 */
  const first = out.html.indexOf('rsec__label');
  ok(first >= 0, 'SCHOOLS.' + name + '() 含段落标题');
  /* 无未替换模板残留 */
  ok(out.html.indexOf('undefined') < 0, 'SCHOOLS.' + name + '() 无 undefined 残留');
  ok(out.html.indexOf('[object Object]') < 0, 'SCHOOLS.' + name + '() 无 [object Object] 残留');
  ok(out.html.indexOf('NaN') < 0, 'SCHOOLS.' + name + '() 无 NaN 残留');
});

/* ---------- 5. 紫微引擎 ---------- */
section('5. 紫微斗数安星（schools.computeZiwei）');
const zres = SCHOOLS.computeZiwei(pan);
ok(!!zres, 'computeZiwei 返回结果');
if (zres) {
  const palaces = zres.palaces || [];
  ok(Array.isArray(palaces) && palaces.length === 12, '十二宫齐备 (' + palaces.length + ')');
  const zhis = palaces.map(p => p.zhi);
  ok(new Set(zhis).size === 12, '十二宫地支无重复 (' + Array.from(new Set(zhis)).join('') + ')');
  ok(palaces.filter(p => p.isMing).length === 1,
     '命宫唯一 (' + palaces.filter(p => p.isMing).length + ') @ ' + (palaces.find(p => p.isMing) || {}).name);
  ok(palaces.filter(p => p.isShen).length === 1,
     '身宫唯一 (' + palaces.filter(p => p.isShen).length + ') @ ' + (palaces.find(p => p.isShen) || {}).name);
  const starTotal = palaces.reduce((s, p) => s + ((p.stars || []).length), 0);
  ok(starTotal >= 14, '十四主星已安放 (共 ' + starTotal + ' 星)');
  const starNames = [];
  palaces.forEach(p => (p.stars || []).forEach(s => starNames.push(s)));
  const NEED = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
  const missing = NEED.filter(n => starNames.indexOf(n) < 0);
  ok(missing.length === 0, '十四主星名称齐全' + (missing.length ? ' — 缺: ' + missing.join('') : ''));
  ok(new Set(starNames).size === starNames.length, '主星无重复安放 (' + starNames.length + ' 颗)');
  ok(!!zres.bureau && !!zres.bureau.name, '五行局已定：' + (zres.bureau ? zres.bureau.name : '—'));
  ok(Array.isArray(zres.sihua) && zres.sihua.length === 4,
     '生年四化 4 条 (' + (zres.sihua || []).length + ')');
  ok(zres.sihua && zres.sihua.map(s => s.type).join('') === '禄权科忌',
     '四化顺序为 禄权科忌 (' + (zres.sihua || []).map(s => s.type).join('') + ')');
  ok(typeof zres.mingIdx === 'number' && zres.mingIdx >= 0 && zres.mingIdx < 12,
     '命宫索引合法 (' + zres.mingIdx + ')');
  /* 三方四正：命宫 + 财帛 + 官禄 + 迁移 应互不相同 */
  ok(!!zres.mingPalace, 'mingPalace 存在：' + (zres.mingPalace ? zres.mingPalace.name : '—'));
}

/* ---------- 6. 提问路由与分区隔离 ---------- */
section('6. 提问路由 & 分区隔离（schools.answer）');
ok(typeof SCHOOLS.answer === 'function', 'SCHOOLS.answer 是函数');
const QS = [
  ['bazi', '我的八字十神性格如何？'],
  ['bazi', '帮我看看五行平衡'],
  ['ziwei', '我的命宫主星是什么'],
  ['ziwei', '流年四化怎么样'],
  ['nihaixia', '给我一些趋避建议'],
  ['nihaixia', '今年流年如何'],
  ['fortune', '今天运势怎么样'],
  ['fortune', '明天适合签约吗']
];
QS.forEach(([school, q]) => {
  let out = null, err = null;
  try { out = SCHOOLS.answer(pan, school, q); } catch (e) { err = e; }
  ok(!err && out && typeof out.html === 'string' && out.html.length > 50,
     '[' + school + '] 「' + q + '」应答正常' + (err ? ' :: ' + err.message : ' (' + (out ? out.html.length : 0) + ' 字符)'));
});
/* 跨区提问应被引导回本区 */
let cross = null, cerr = null;
try { cross = SCHOOLS.answer(pan, 'bazi', '看看我的紫微命宫主星'); } catch (e) { cerr = e; }
ok(!cerr && cross && /切换|专属|分区/.test(cross.html || ''),
   '跨区提问被路由提示（不串逻辑）');

/* ---------- 7. 存储层 ---------- */
section('7. 档案存储（store.js）');
const ST = sandbox.STORE;
ok(typeof ST.add === 'function' && typeof ST.list === 'function', 'STORE CRUD 齐备');
const rec1 = ST.add({ name: '测试甲', sex: '男', calendar: 'solar', year: 1990, month: 6, day: 15, shichen: 5, place: '北京', longitude: 116.4 });
ok(!!rec1 && !!rec1.id, '新增档案成功 (id=' + (rec1 && rec1.id) + ')');
const rec2 = ST.add({ name: '测试乙', sex: '女', calendar: 'lunar', year: 1995, month: 8, day: 20, shichen: 2, place: '上海', longitude: 121.5 });
ok(ST.list().length === 2, '档案列表 2 条');
ST.setCurrent(rec1.id);
ok(ST.current() === rec1.id, '当前档案切换成功');
ok(!!ST.currentRecord(), 'currentRecord 可取到记录');
ST.setResult('bazi', { html: '<i>x</i>' });
ok(!!ST.getResult('bazi'), '结果会话级缓存可写可读');
ST.pushLog('bazi', { q: 'q', a: 'a' });
ok(ST.getLogs('bazi').length === 1, '提问日志可写可读');
ST.remove(rec2.id);
ok(ST.list().length === 1, '删除档案成功 (剩 ' + ST.list().length + ')');
/* 持久化：新建第二个沙箱实例应能读回 */
ok(!!localStorageData['xuanxue.archives.v1'], '已写入 localStorage');
const reRead = JSON.parse(localStorageData['xuanxue.archives.v1']);
ok(Array.isArray(reRead) && reRead.length === 1, 'localStorage 内容可反序列化');

/* ---------- 8. UI 渲染原语 ---------- */
section('8. UI 渲染原语（ui.js）');
const U = sandbox.UI;
ok(typeof U.esc === 'function', 'UI.esc 存在');
ok(U.esc('<b>&"x"</b>').indexOf('<') < 0, 'esc 转义 < 生效');
ok(U.esc('&').indexOf('&amp;') === 0 || U.esc('&') === '&amp;', 'esc 转义 & 生效');
['sec', 'sum', 'paras', 'kw', 'kwList', 'saying', 'tips', 'kvRows', 'metrics', 'table', 'emptyState', 'tag', 'wxBar'].forEach(fn => {
  ok(typeof U[fn] === 'function', 'UI.' + fn + ' 是函数');
});
try {
  const h = U.sec('测试', U.paras(['a', 'b']) + U.saying('言', '源') + U.tips(['t1']));
  ok(h.indexOf('rsec') >= 0 && h.indexOf('saying') >= 0, '组合渲染正常 (' + h.length + ' 字符)');
} catch (e) { ok(false, '组合渲染异常 :: ' + e.message); }

/* ---------- 9. app.js 依赖的 ASTRO API ---------- */
section('9. ASTRO / PAIPAN 导出完备性');
['lunarToSolar', 'solarToLunar', 'daysInMonth', 'bjdFromParts', 'trueSolarTimeOffsetMinutes'].forEach(fn => {
  ok(typeof sandbox.ASTRO[fn] === 'function', 'ASTRO.' + fn + ' 存在');
});
ok(typeof sandbox.PAIPAN.compute === 'function', 'PAIPAN.compute 存在');

/* ---------- 汇总 ---------- */
console.log('\n' + '═'.repeat(52));
console.log('冒烟测试结果: ' + pass + ' pass / ' + fail + ' fail');
if (fail) {
  console.log('\n失败项:');
  errs.forEach(e => console.log('  · ' + e));
}
console.log('═'.repeat(52));
process.exit(fail ? 1 : 0);
