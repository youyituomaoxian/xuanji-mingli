/* =========================================================================
 * store.js — 命盘档案存储 + 出生地区数据
 *   · 档案（命盘）仅存会话级（sessionStorage）——关闭页面即销毁，不留任何跨会话痕迹
 *   · 每次打开自动清除浏览器残留的旧版 localStorage 档案，杜绝上一个人的命盘泄漏
 *   · 云端零后端零上报：生辰数据只在当前浏览器会话内存在
 *   · 出生地区 → 经度表（真太阳时校正真源，非隐私数据）
 * ====================================================================== */
(function (global) {
  'use strict';

  /* 隐私优先（用户明确要求：每次打开都必须清除，不允许记录上一个人的命盘信息）：
     档案只落 sessionStorage（关标签/关浏览器即清空），不再跨会话持久化。 */
  var LS_KEY = 'xuanxue.archives.v1';  // 旧版 localStorage 键——启动时立即清除残留
  var LS_CUR = 'xuanxue.current.v1';   // 旧版 localStorage 键——启动时立即清除残留
  var SS_KEY = 'xuanxue.archives.s1';  // 会话级档案（sessionStorage，关页即销毁）
  var SS_CUR = 'xuanxue.current.s1';   // 会话级当前档案

  /* ---------- 存储介质选择（仅 sessionStorage；不可用则纯内存） ----------
     隐私要求：每次打开必须干净，绝不跨会话保留。
     · sessionStorage：随标签页/浏览器关闭即销毁 —— 首选；
     · 不可用（隐私模式禁用）→ 退回纯内存（_store = null），刷新即清；
     · 绝不回退 localStorage —— 那正是本模块要消灭的旧版泄漏面。 */
  var _store = (function () {
    try {
      if (global.sessionStorage) {
        global.sessionStorage.setItem('__t', '1');
        global.sessionStorage.removeItem('__t');
        return global.sessionStorage;
      }
    } catch (e) {}
    return null;
  })();

  /* ---------- 启动时清除旧版 localStorage 残留（上一版本曾把档案持久化到 localStorage） ----------
     只要检测到旧键，立即删除，确保「每次打开都是干净会话」，绝不把上一个人的命盘带给下一个人。 */
  (function purgeLegacy() {
    try {
      if (global.localStorage) {
        if (global.localStorage.getItem(LS_KEY)) global.localStorage.removeItem(LS_KEY);
        if (global.localStorage.getItem(LS_CUR)) global.localStorage.removeItem(LS_CUR);
      }
    } catch (e) { /* 隐私模式忽略 */ }
  })();

  /* ---------- 出生地区经度表（东经为正，单位：度） ----------
     覆盖主要城市 + 港澳台；其余按省份代表城市。
     真源：国家地理标准城市中心经度。 */
  var PLACES = [
    /* 直辖市 */
    { n: '北京',       lon: 116.41, p: '北京' },
    { n: '上海',       lon: 121.47, p: '上海' },
    { n: '天津',       lon: 117.19, p: '天津' },
    { n: '重庆',       lon: 106.55, p: '重庆' },
    /* 华北 */
    { n: '石家庄',     lon: 114.51, p: '河北' },
    { n: '唐山',       lon: 118.18, p: '河北' },
    { n: '太原',       lon: 112.55, p: '山西' },
    { n: '大同',       lon: 113.30, p: '山西' },
    { n: '呼和浩特',   lon: 111.75, p: '内蒙古' },
    { n: '包头',       lon: 109.84, p: '内蒙古' },
    /* 东北 */
    { n: '沈阳',       lon: 123.43, p: '辽宁' },
    { n: '大连',       lon: 121.61, p: '辽宁' },
    { n: '长春',       lon: 125.32, p: '吉林' },
    { n: '哈尔滨',     lon: 126.53, p: '黑龙江' },
    { n: '齐齐哈尔',   lon: 123.92, p: '黑龙江' },
    /* 华东 */
    { n: '南京',       lon: 118.80, p: '江苏' },
    { n: '苏州',       lon: 120.62, p: '江苏' },
    { n: '徐州',       lon: 117.28, p: '江苏' },
    { n: '杭州',       lon: 120.15, p: '浙江' },
    { n: '宁波',       lon: 121.55, p: '浙江' },
    { n: '温州',       lon: 120.70, p: '浙江' },
    { n: '合肥',       lon: 117.23, p: '安徽' },
    { n: '福州',       lon: 119.30, p: '福建' },
    { n: '厦门',       lon: 118.09, p: '福建' },
    { n: '泉州',       lon: 118.59, p: '福建' },
    { n: '南昌',       lon: 115.89, p: '江西' },
    { n: '济南',       lon: 117.00, p: '山东' },
    { n: '青岛',       lon: 120.38, p: '山东' },
    { n: '烟台',       lon: 121.39, p: '山东' },
    /* 华中 */
    { n: '郑州',       lon: 113.62, p: '河南' },
    { n: '洛阳',       lon: 112.45, p: '河南' },
    { n: '武汉',       lon: 114.30, p: '湖北' },
    { n: '宜昌',       lon: 111.29, p: '湖北' },
    { n: '长沙',       lon: 112.94, p: '湖南' },
    { n: '株洲',       lon: 113.13, p: '湖南' },
    /* 华南 */
    { n: '广州',       lon: 113.26, p: '广东' },
    { n: '深圳',       lon: 114.06, p: '广东' },
    { n: '东莞',       lon: 113.75, p: '广东' },
    { n: '佛山',       lon: 113.12, p: '广东' },
    { n: '汕头',       lon: 116.68, p: '广东' },
    { n: '南宁',       lon: 108.37, p: '广西' },
    { n: '桂林',       lon: 110.29, p: '广西' },
    { n: '海口',       lon: 110.20, p: '海南' },
    { n: '三亚',       lon: 109.51, p: '海南' },
    /* 西南 */
    { n: '成都',       lon: 104.07, p: '四川' },
    { n: '绵阳',       lon: 104.68, p: '四川' },
    { n: '贵阳',       lon: 106.63, p: '贵州' },
    { n: '昆明',       lon: 102.83, p: '云南' },
    { n: '大理',       lon: 100.23, p: '云南' },
    { n: '拉萨',       lon: 91.14,  p: '西藏' },
    /* 西北 */
    { n: '西安',       lon: 108.94, p: '陕西' },
    { n: '宝鸡',       lon: 107.14, p: '陕西' },
    { n: '兰州',       lon: 103.83, p: '甘肃' },
    { n: '西宁',       lon: 101.78, p: '青海' },
    { n: '银川',       lon: 106.23, p: '宁夏' },
    { n: '乌鲁木齐',   lon: 87.62,  p: '新疆' },
    { n: '喀什',       lon: 75.99,  p: '新疆' },
    /* 港澳台（中国） */
    { n: '中国香港',   lon: 114.17, p: '中国香港' },
    { n: '中国澳门',   lon: 113.55, p: '中国澳门' },
    { n: '中国台湾·台北', lon: 121.56, p: '中国台湾' },
    { n: '中国台湾·高雄', lon: 120.31, p: '中国台湾' },
    /* 其他 */
    { n: '海外（新加坡）', lon: 103.85, p: '海外' },
    { n: '海外（吉隆坡）', lon: 101.69, p: '海外' },
    { n: '海外（东京）',   lon: 139.69, p: '海外' },
    { n: '海外（首尔）',   lon: 126.98, p: '海外' },
    { n: '海外（洛杉矶）', lon: -118.24, p: '海外' },
    { n: '海外（纽约）',   lon: -74.01,  p: '海外' },
    { n: '海外（伦敦）',   lon: -0.13,   p: '海外' }
  ];

  function placeByName(n) {
    for (var i = 0; i < PLACES.length; i++) if (PLACES[i].n === n) return PLACES[i];
    return null;
  }

  /* ---------- 档案 CRUD ---------- */
  var _cache = null;

  function loadAll() {
    if (_cache) return _cache;
    var raw = null;
    try { raw = _store ? _store.getItem(SS_KEY) : null; } catch (e) { raw = null; }
    var arr = [];
    if (raw) { try { arr = JSON.parse(raw) || []; } catch (e) { arr = []; } }
    if (!Array.isArray(arr)) arr = [];
    _cache = arr;
    return _cache;
  }

  function persist() {
    try { if (_store) _store.setItem(SS_KEY, JSON.stringify(_cache || [])); } catch (e) { /* 隐私模式忽略 */ }
  }

  function genId() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function list() { return loadAll().slice(); }

  function add(rec) {
    var all = loadAll();
    rec.id = rec.id || genId();
    rec.createdAt = rec.createdAt || Date.now();
    rec.updatedAt = Date.now();
    all.push(rec);
    persist();
    return rec;
  }

  function update(id, patch) {
    var all = loadAll();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        Object.keys(patch).forEach(function (k) { all[i][k] = patch[k]; });
        all[i].updatedAt = Date.now();
        persist();
        return all[i];
      }
    }
    return null;
  }

  function remove(id) {
    var all = loadAll();
    var next = all.filter(function (x) { return x.id !== id; });
    _cache = next;
    persist();
    if (current() === id) setCurrent(next.length ? next[0].id : null);
    return next.length !== all.length;
  }

  function byId(id) {
    var all = loadAll();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  /* ---------- 当前选中命盘（会话级，关页即清） ---------- */
  function current() {
    var v = null;
    try { v = _store ? _store.getItem(SS_CUR) : null; } catch (e) { v = null; }
    if (v && byId(v)) return v;
    /* 兜底：取第一个 */
    var all = loadAll();
    if (all.length) { setCurrent(all[0].id); return all[0].id; }
    return null;
  }
  function setCurrent(id) {
    try {
      if (_store) {
        if (id) _store.setItem(SS_CUR, id);
        else _store.removeItem(SS_CUR);
      }
    } catch (e) { /* ignore */ }
    emit();
  }
  function currentRecord() {
    var id = current();
    return id ? byId(id) : null;
  }

  /* ---------- 会话级缓存（各分区生成结果） ---------- */
  var results = {};   // { [school]: {...} }
  var logs = {};      // { [school]: [{q,a,ts}] }

  function setResult(school, r) { results[school] = r; emit(); }
  function getResult(school) { return results[school] || null; }
  function clearResult(school) { if (school) delete results[school]; else results = {}; emit(); }

  function pushLog(school, turn) {
    logs[school] = logs[school] || [];
    logs[school].push(turn);
    emit();
  }
  function getLogs(school) { return (logs[school] || []).slice(); }
  function clearLogs(school) { if (school) delete logs[school]; else logs = {}; emit(); }

  /* ---------- 订阅 ---------- */
  var listeners = [];
  function on(fn) { listeners.push(fn); }
  function emit() {
    var snap = { archives: list(), current: current(), currentRecord: currentRecord() };
    listeners.forEach(function (fn) { try { fn(snap); } catch (e) { /* ignore */ } });
  }

  /* ---------- 导入 / 导出（备份用） ---------- */
  function exportJSON() {
    return JSON.stringify({ v: 1, archives: list() }, null, 2);
  }
  function importJSON(text) {
    var j = JSON.parse(text);
    var arr = Array.isArray(j) ? j : (j && j.archives);
    if (!Array.isArray(arr)) throw new Error('数据格式无法识别');
    var all = loadAll();
    var added = 0;
    arr.forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      if (!r.name || !r.year) return;
      r.id = genId();
      r.createdAt = r.createdAt || Date.now();
      all.push(r);
      added++;
    });
    persist();
    emit();
    return added;
  }

  global.STORE = {
    PLACES: PLACES,
    placeByName: placeByName,
    list: list, add: add, update: update, remove: remove, byId: byId,
    current: current, setCurrent: setCurrent, currentRecord: currentRecord,
    setResult: setResult, getResult: getResult, clearResult: clearResult,
    pushLog: pushLog, getLogs: getLogs, clearLogs: clearLogs,
    on: on, emit: emit,
    exportJSON: exportJSON, importJSON: importJSON
  };
})(window);
