/* =========================================================================
 * app.js — 应用主控：视图路由 / 生辰录入 / 档案 / 分区生成 / 提问 / 重置
 *   · 数据输入统一入口，一次录入四分区同步（任务书 §二.2）
 *   · 分区隔离，资源异常仅影响本分区（任务书 §四.1 / §四.5）
 * ====================================================================== */
(function (global) {
  'use strict';

  var U = global.UI, D = global.document;
  var STORE = global.STORE, RES = global.RESOURCE, SCH = global.SCHOOLS;

  /* ---------- 运行时表单态 ---------- */
  var form = {
    cal: 'solar',        /* solar | lunar */
    sex: 'male',
    leap: 0,
    shichen: '午',
    place: '北京',
    useTrueSolar: true,
    editingId: null
  };

  var SCHOOLS_LIST = ['nihaixia', 'bazi', 'ziwei', 'fortune'];

  /* ===================== 初始化 ===================== */
  function init() {
    buildShichenOptions();
    buildPlaceOptions();
    bindNav();
    bindForm();
    bindTabs();
    bindSchoolActions();
    bindTopbar();
    bindUrlImport();

    renderArchive();
    updateCastline();
    checkResources();
    updatePlaceHint();
    updateTstPreview();

    STORE.on(function () { renderArchive(); updateCastline(); });
    window.addEventListener('resize', function () { /* 布局自适应由 CSS 负责 */ });
  }

  /* ---------- 时辰下拉 ---------- */
  function buildShichenOptions() {
    var sel = U.$('#birthShichen');
    var html = '';
    var ranges = {
      '子': '23:00-01:00', '丑': '01:00-03:00', '寅': '03:00-05:00', '卯': '05:00-07:00',
      '辰': '07:00-09:00', '巳': '09:00-11:00', '午': '11:00-13:00', '未': '13:00-15:00',
      '申': '15:00-17:00', '酉': '17:00-19:00', '戌': '19:00-21:00', '亥': '21:00-23:00'
    };
    ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].forEach(function (z) {
      var names = { 子: '夜半', 丑: '鸡鸣', 寅: '平旦', 卯: '日出', 辰: '食时', 巳: '隅中',
                    午: '日中', 未: '日昳', 申: '哺时', 酉: '日入', 戌: '黄昏', 亥: '人定' };
      html += '<option value="' + z + '"' + (z === '午' ? ' selected' : '') + '>' +
        z + '时 · ' + names[z] + '（' + ranges[z] + '）</option>';
    });
    sel.innerHTML = html;
  }

  /* ---------- 地区下拉 ---------- */
  function buildPlaceOptions() {
    var sel = U.$('#birthPlace');
    var byProv = {};
    STORE.PLACES.forEach(function (p) {
      (byProv[p.p] = byProv[p.p] || []).push(p);
    });
    var html = '';
    Object.keys(byProv).forEach(function (prov) {
      html += '<optgroup label="' + prov + '">';
      byProv[prov].forEach(function (p) {
        html += '<option value="' + p.n + '">' + p.n + '（东经 ' + p.lon + '°）</option>';
      });
      html += '</optgroup>';
    });
    sel.innerHTML = html;
    sel.value = '北京';
  }

  /* ---------- 导航 ---------- */
  function bindNav() {
    U.$$('.nav__item').forEach(function (btn) {
      btn.addEventListener('click', function () { go(btn.getAttribute('data-view')); });
    });
  }

  function go(view) {
    U.$$('.nav__item').forEach(function (b) {
      if (b.getAttribute('data-view') === view) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
      b.classList.toggle('is-active', b.getAttribute('data-view') === view);
    });
    U.$$('.view').forEach(function (v) {
      v.classList.toggle('is-active', v.getAttribute('data-view') === view);
    });
    U.$('.main').scrollTop = 0;
    /* 进入命理分区时，若已有命盘则自动生成 */
    if (SCHOOLS_LIST.indexOf(view) >= 0) {
      var rec = STORE.currentRecord();
      if (rec && !STORE.getResult(view)) generate(view);
      if (rec) renderPanFor(view, rec);
    }
  }

  /* ===================== 表单 ===================== */
  function bindForm() {
    /* 历法切换 */
    U.$$('#calSeg .seg__btn').forEach(function (b) {
      b.addEventListener('click', function () {
        form.cal = b.getAttribute('data-cal');
        U.$$('#calSeg .seg__btn').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        U.$('#leapField').style.display = form.cal === 'lunar' ? '' : 'none';
        updateFormPlaceholders();
        updatePreview();
      });
    });
    /* 闰月 */
    U.$$('#leapSeg .seg__btn').forEach(function (b) {
      b.addEventListener('click', function () {
        form.leap = Number(b.getAttribute('data-leap'));
        U.$$('#leapSeg .seg__btn').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        updatePreview();
      });
    });
    /* 性别 */
    U.$$('#sexSeg .seg__btn').forEach(function (b) {
      b.addEventListener('click', function () {
        form.sex = b.getAttribute('data-sex');
        U.$$('#sexSeg .seg__btn').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        updatePreview();
      });
    });
    /* 日期 / 时辰 / 地区 */
    ['birthYear', 'birthMonth', 'birthDay'].forEach(function (id) {
      U.$('#' + id).addEventListener('input', function () { updatePreview(); });
    });
    U.$('#birthShichen').addEventListener('change', function () {
      form.shichen = this.value; updatePreview();
    });
    U.$('#birthPlace').addEventListener('change', function () {
      form.place = this.value; updatePlaceHint(); updateTstPreview(); updatePreview();
    });
    U.$('#useTrueSolar').addEventListener('change', function () {
      form.useTrueSolar = this.checked; updateTstPreview(); updatePreview();
    });

    U.$('#btnSaveCast').addEventListener('click', saveCast);
    U.$('#btnCancelEdit').addEventListener('click', function () { resetForm(); });
    U.$('#btnFillDemo').addEventListener('click', fillDemo);
  }

  function updateFormPlaceholders() {
    var lunar = form.cal === 'lunar';
    U.$('#birthYear').placeholder = lunar ? '农历年' : '公历年';
    U.$('#birthMonth').placeholder = lunar ? '农历月' : '月';
    U.$('#birthDay').placeholder = lunar ? '农历日' : '日';
  }

  function updatePlaceHint() {
    var p = STORE.placeByName(form.place);
    var hint = U.$('#placeHint');
    if (p) hint.textContent = '经度 ' + p.lon + '°E · 用于真太阳时校正';
    else hint.textContent = '用于真太阳时校正';
  }

  function updateTstPreview() {
    var el = U.$('#tstPreview');
    if (!form.useTrueSolar) { el.textContent = '已关闭（按北京时间直接排盘）'; return; }
    var p = STORE.placeByName(form.place);
    if (!p) { el.textContent = '按出生地经度 + 均时差校正'; return; }
    var lonMin = (p.lon - 120) * 4;
    el.textContent = '经度校正 ' + (lonMin >= 0 ? '+' : '') + lonMin.toFixed(1) + ' 分钟（相对 120°E）';
  }

  /* 读取表单 → 生辰对象 */
  function readForm() {
    var y = Number(U.$('#birthYear').value);
    var m = Number(U.$('#birthMonth').value);
    var d = Number(U.$('#birthDay').value);
    if (!y || !m || !d) return { error: '请填写完整的出生年月日' };
    if (y < 1900 || y > 2100) return { error: '年份请填 1900 - 2100 之间' };
    if (m < 1 || m > 12) return { error: '月份请填 1 - 12' };
    if (d < 1 || d > 31) return { error: '日期请填 1 - 31' };

    /* 农历 → 公历换算 */
    var solar = { y: y, m: m, d: d };
    if (form.cal === 'lunar') {
      var conv = global.ASTRO.lunarToSolar(y, m, d, form.leap === 1);
      if (!conv) return { error: '农历 ' + y + '年' + (form.leap ? '闰' : '') + m + '月' + d + '日 不存在，请检查（可能该年无此闰月或该月无此日）' };
      solar = { y: conv.y, m: conv.m, d: conv.d };
    } else {
      /* 校验公历日期有效性 */
      var dim = global.ASTRO.daysInMonth(y, m);
      if (d > dim) return { error: y + '年' + m + '月只有 ' + dim + ' 天' };
    }
    return {
      year: solar.y, month: solar.m, day: solar.d,
      shichen: form.shichen,
      sex: form.sex,
      place: form.place,
      useTrueSolarTime: form.useTrueSolar,
      calendarType: form.cal,
      lunarInput: form.cal === 'lunar' ? { year: y, month: m, day: d, leap: form.leap === 1 } : null
    };
  }

  /* 由时辰名取代表小时 */
  function hourOfShichen(z) {
    var MAP = { '子': 0, '丑': 2, '寅': 4, '卯': 6, '辰': 8, '巳': 10, '午': 12, '未': 14, '申': 16, '酉': 18, '戌': 20, '亥': 22 };
    return MAP[z] != null ? MAP[z] : 12;
  }

  /* 构造引擎参数 */
  function toEngineArgs(rec) {
    var p = STORE.placeByName(rec.place);
    return {
      year: rec.year, month: rec.month, day: rec.day,
      hour: hourOfShichen(rec.shichen), minute: 0,
      shichen: rec.shichen,
      sex: rec.sex,
      place: rec.place,
      longitude: p ? p.lon : 120,
      useTrueSolarTime: !!rec.useTrueSolarTime,
      calendarType: rec.calendarType || 'solar'
    };
  }

  /* 预览 */
  function updatePreview() {
    var box = U.$('#birthPreview');
    var err = U.$('#formError');
    var r = readForm();
    if (r.error) { box.style.display = 'none'; return; }
    err.style.display = 'none';
    var pan;
    try { pan = global.PAIPAN.compute(toEngineArgs(r)); }
    catch (e) { box.style.display = 'none'; return; }
    if (!pan || !pan.pillars) { box.style.display = 'none'; return; }

    box.style.display = '';
    var s = pan.input.solar, so = pan.input.solarOriginal;
    U.$('#previewText').textContent = pan.pillars.year.gan + pan.pillars.year.zhi + ' ' +
      pan.pillars.month.gan + pan.pillars.month.zhi + ' ' +
      pan.pillars.day.gan + pan.pillars.day.zhi + ' ' +
      pan.pillars.hour.gan + pan.pillars.hour.zhi;
    var parts = [];
    if (form.cal === 'lunar') {
      parts.push('农历 ' + so.y + '年' + U.cnMonth(so.m) + '月' + U.cnDay(so.d) + ' → 公历 ' + s.y + '-' + U.pad2(s.m) + '-' + U.pad2(s.d));
    } else {
      parts.push('公历 ' + s.y + '-' + U.pad2(s.m) + '-' + U.pad2(s.d));
    }
    parts.push('农历 ' + pan.input.lunar.year + '年' + (pan.input.lunar.leap ? '闰' : '') + U.cnMonth(pan.input.lunar.month) + '月' + U.cnDay(pan.input.lunar.day));
    if (pan.input.tsApplied) {
      parts.push('真太阳时校正 ' + (pan.input.tsOffsetMin >= 0 ? '+' : '') + pan.input.tsOffsetMin.toFixed(1) + ' 分钟 → ' + U.pad2(s.h) + ':' + U.pad2(s.mi));
    }
    parts.push(pan.input.shichen + '时（' + pan.input.shichenRange + '）');
    U.$('#previewSub').textContent = parts.join(' · ');
  }

  /* ---------- 保存档案 ---------- */
  function saveCast() {
    var err = U.$('#formError');
    var name = U.$('#castName').value.trim();
    if (!name) { showError('请填写档案名称'); U.$('#castName').focus(); return; }
    var r = readForm();
    if (r.error) { showError(r.error); return; }

    var rec = {
      name: name,
      year: r.year, month: r.month, day: r.day,
      shichen: r.shichen,
      sex: r.sex,
      place: r.place,
      useTrueSolarTime: r.useTrueSolarTime,
      calendarType: r.calendarType,
      lunarInput: r.lunarInput
    };

    if (form.editingId) {
      STORE.update(form.editingId, rec);
      U.toast('命盘已更新', 'ok');
      resetForm();
      STORE.setCurrent(form.editingId);
    } else {
      var saved = STORE.add(rec);
      STORE.setCurrent(saved.id);
      U.toast('命盘已保存', 'ok');
      resetForm();
    }
    renderArchive();
    updateCastline();
    /* 清空各分区结果，等待重新生成 */
    SCHOOLS_LIST.forEach(function (s) { STORE.clearResult(s); renderOut(s); });
  }

  function showError(msg) {
    var err = U.$('#formError');
    err.textContent = msg;
    err.style.display = '';
  }

  function resetForm() {
    form.editingId = null;
    U.$('#castName').value = '';
    U.$('#editModeTag').style.display = 'none';
    U.$('#btnCancelEdit').style.display = 'none';
    U.$('#btnSaveCast').textContent = '保存命盘';
    U.$('#formError').style.display = 'none';
    U.$('#birthPreview').style.display = 'none';
    ['birthYear', 'birthMonth', 'birthDay'].forEach(function (id) { U.$('#' + id).value = ''; });
  }

  function fillDemo() {
    form.cal = 'solar';
    U.$$('#calSeg .seg__btn').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x.getAttribute('data-cal') === 'solar'));
    });
    U.$('#leapField').style.display = 'none';
    U.$('#castName').value = '示例命盘';
    U.$('#birthYear').value = '1990';
    U.$('#birthMonth').value = '5';
    U.$('#birthDay').value = '15';
    U.$('#birthShichen').value = '午';
    form.shichen = '午';
    U.$('#birthPlace').value = '上海';
    form.place = '上海';
    updatePlaceHint(); updateTstPreview();
    updatePreview();
    U.toast('已填入示例：1990-05-15 午时 · 上海');
  }

  /* ===================== 档案列表 ===================== */
  function renderArchive() {
    var box = U.$('#archiveList');
    var list = STORE.list();
    var cur = STORE.current();
    U.$('#archCountTag').textContent = list.length + ' 个命盘';

    if (!list.length) {
      box.innerHTML = U.emptyState('简', '还没有命盘档案',
        '在左侧填写生辰信息，点击「保存命盘」即可创建。保存后四个命理分区会自动同步使用该命盘。');
      U.$('#quickPillarsCard').style.display = 'none';
      return;
    }

    box.innerHTML = list.map(function (c) {
      var p = STORE.placeByName(c.place);
      var meta = c.year + '-' + U.pad2(c.month) + '-' + U.pad2(c.day) + ' ' + c.shichen + '时 · ' +
        (c.sex === 'male' ? '男' : '女') + ' · ' + (c.place || '未填地区');
      return '<div class="archive__item' + (c.id === cur ? ' is-active' : '') + '" data-id="' + c.id + '">' +
        '<div class="archive__avatar">' + U.esc(c.name.slice(0, 1)) + '</div>' +
        '<div class="archive__body">' +
          '<div class="archive__name">' + U.esc(c.name) + '</div>' +
          '<div class="archive__meta">' + U.esc(meta) + '</div>' +
        '</div>' +
        '<div class="archive__act">' +
          '<button class="btn btn--text btn--sm" data-act="edit" data-id="' + c.id + '">编辑</button>' +
          '<button class="btn btn--text btn--sm btn--danger" data-act="del" data-id="' + c.id + '">删除</button>' +
        '</div>' +
        '</div>';
    }).join('');

    U.$$('.archive__item', box).forEach(function (item) {
      item.addEventListener('click', function (e) {
        var act = e.target.getAttribute && e.target.getAttribute('data-act');
        var id = e.target.getAttribute && e.target.getAttribute('data-id');
        if (act === 'edit') { e.stopPropagation(); editCast(id); return; }
        if (act === 'del') { e.stopPropagation(); delCast(id); return; }
        chooseCast(item.getAttribute('data-id'));
      });
    });

    renderQuickPillars();
  }

  function chooseCast(id) {
    STORE.setCurrent(id);
    SCHOOLS_LIST.forEach(function (s) { STORE.clearResult(s); STORE.clearLogs(s); renderOut(s); renderLog(s); });
    updateCastline();
    renderArchive();
    U.toast('已切换命盘');
    var cur = STORE.currentRecord();
    if (cur) {
      ['nihaixia', 'bazi', 'ziwei', 'fortune'].forEach(function (s) { renderPanFor(s, cur); });
    }
  }

  function editCast(id) {
    var c = STORE.byId(id);
    if (!c) return;
    form.editingId = id;
    U.$('#castName').value = c.name;
    U.$('#birthYear').value = c.year;
    U.$('#birthMonth').value = c.month;
    U.$('#birthDay').value = c.day;
    form.shichen = c.shichen; U.$('#birthShichen').value = c.shichen;
    form.sex = c.sex;
    U.$$('#sexSeg .seg__btn').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x.getAttribute('data-sex') === c.sex));
    });
    form.place = c.place; U.$('#birthPlace').value = c.place;
    form.useTrueSolar = !!c.useTrueSolarTime;
    U.$('#useTrueSolar').checked = form.useTrueSolar;
    form.cal = c.calendarType || 'solar';
    U.$$('#calSeg .seg__btn').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x.getAttribute('data-cal') === form.cal));
    });
    U.$('#leapField').style.display = form.cal === 'lunar' ? '' : 'none';
    U.$('#editModeTag').style.display = '';
    U.$('#btnCancelEdit').style.display = '';
    U.$('#btnSaveCast').textContent = '保存修改';
    updatePlaceHint(); updateTstPreview(); updatePreview();
    U.$('#castName').focus();
    U.toast('编辑模式：修改后点击「保存修改」');
  }

  function delCast(id) {
    var c = STORE.byId(id);
    if (!c) return;
    if (!global.confirm('确定删除命盘「' + c.name + '」？此操作不可撤销。')) return;
    STORE.remove(id);
    renderArchive(); updateCastline();
    SCHOOLS_LIST.forEach(function (s) { STORE.clearResult(s); STORE.clearLogs(s); renderOut(s); renderLog(s); });
    U.toast('已删除该命盘');
  }

  /* ---------- 顶栏摘要 ---------- */
  function updateCastline() {
    var el = U.$('#castline');
    var c = STORE.currentRecord();
    if (!c) {
      el.innerHTML = '<span class="castline__empty">尚未录入生辰 — 请先在「命盘档案」中新建</span>';
      return;
    }
    var pan = null;
    try { pan = global.PAIPAN.compute(toEngineArgs(c)); } catch (e) { /* ignore */ }
    var gz = pan ? (pan.pillars.year.gan + pan.pillars.year.zhi + ' ' + pan.pillars.month.gan + pan.pillars.month.zhi + ' ' +
      pan.pillars.day.gan + pan.pillars.day.zhi + ' ' + pan.pillars.hour.gan + pan.pillars.hour.zhi) : '';
    el.innerHTML =
      '<span class="castline__name">' + U.esc(c.name) + '</span>' +
      '<span class="castline__sep">|</span>' +
      '<span class="castline__meta">' + c.year + '-' + U.pad2(c.month) + '-' + U.pad2(c.day) + ' ' + c.shichen + '时 · ' +
        (c.sex === 'male' ? '男' : '女') + ' · ' + U.esc(c.place || '') + '</span>' +
      (gz ? '<span class="castline__sep">|</span><span class="castline__meta" style="font-family:var(--ff-mono)">' + gz + '</span>' : '');
  }

  /* ---------- 排盘速览（档案页） ---------- */
  function renderQuickPillars() {
    var c = STORE.currentRecord();
    var card = U.$('#quickPillarsCard');
    if (!c) { card.style.display = 'none'; return; }
    var pan;
    try { pan = global.PAIPAN.compute(toEngineArgs(c)); } catch (e) { card.style.display = 'none'; return; }
    if (!pan) { card.style.display = 'none'; return; }
    card.style.display = '';
    U.$('#quickPillars').innerHTML =
      SCH.renderPillars(pan) +
      '<div style="margin-top:var(--sp-4)">' + U.kvRows([
        ['农历', U.esc(pan.input.lunar.year + '年' + (pan.input.lunar.leap ? '闰' : '') + U.cnMonth(pan.input.lunar.month) + '月' + U.cnDay(pan.input.lunar.day))],
        ['生肖', U.esc(pan.zodiac)],
        ['日主', U.kw(pan.dayGan + '（' + pan.yongshen.dayWu + '）')],
        ['旺衰', U.kw(pan.strength.level)],
        ['格局', U.kw(pan.geju.name)],
        ['喜用神', U.kw(pan.yongshen.xiyong.join('、'))],
        ['忌神', U.esc(pan.yongshen.jishen.join('、'))],
        ['起运', U.esc(pan.qiyun.years + ' 年 ' + pan.qiyun.months + ' 个月，大运' + (pan.dayunForward ? '顺行' : '逆行'))]
      ]) + '</div>';
  }

  /* ===================== Tab 切换 ===================== */
  function bindTabs() {
    U.$$('.tabs__btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-tab');
        var school = key.split(':')[0];
        U.$$('.tabs__btn', btn.parentNode).forEach(function (x) {
          x.setAttribute('aria-selected', String(x === btn));
        });
        U.$$('[data-pane]', btn.closest('.card')).forEach(function (p) {
          p.classList.toggle('is-active', p.getAttribute('data-pane') === key);
        });
        void school;
      });
    });
  }

  /* ===================== 资源检测 ===================== */
  function checkResources() {
    RES.checkAll().then(function () {
      renderResourceStatus();
      SCHOOLS_LIST.forEach(function (s) { renderResTag(s); });
    });
    RES.on(function () {
      renderResourceStatus();
      SCHOOLS_LIST.forEach(function (s) { renderResTag(s); });
    });
  }

  function statusKind(st) {
    if (st === 'ok') return { tag: 'ok', dot: '' };
    if (st === 'fail') return { tag: 'fail', dot: '' };
    if (st === 'parse') return { tag: 'warn', dot: '' };
    if (st === 'warn') return { tag: 'warn', dot: '' };
    if (st === 'checking') return { tag: 'idle', dot: '' };
    return { tag: 'idle', dot: '' };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* 资源状态的来源标记：'inline' = 构建时内联快照，'live' = 本地仓库实时读取
     —— 加这一层是为了让"为什么显示正常"可追溯（问题3 的收口证据） */
  function originMark(origin) {
    if (origin === 'inline') return '内置';
    if (origin === 'live') return '本地';
    return '';
  }

  function renderResourceStatus() {
    var snap = RES.get();
    var box = U.$('#navResStatus');
    var lines = [];
    [['nihaixia', '倪海厦'], ['bazi', '八字'], ['ziwei', '紫微']].forEach(function (x) {
      var s = snap[x[0]];
      var k = statusKind(s.status).tag;
      var color = k === 'ok' ? 'var(--c-ok)' : (k === 'fail' ? 'var(--c-ji)' : (k === 'warn' ? 'var(--c-warn)' : 'var(--tx-tertiary)'));
      var statusCn = s.status === 'ok' ? '正常' : (s.status === 'fail' ? '失败' : (s.status === 'parse' ? '异常' : '检测'));
      /* 悬浮卡横条空间有限：chip = 色点 + 名称 + 来源标记；状态语义由色点与悬停明细承载 */
      var mk = originMark(s.origin);
      lines.push('<div title="' + U.esc((statusCn === '正常' ? '状态正常' : statusCn) + '：' + (s.detail || '')) + '"' +
        ' style="display:flex;align-items:center;gap:5px;padding:2px 0">' +
        '<span style="width:6px;height:6px;border-radius:50%;background:' + color + ';box-shadow:0 0 5px ' + color + ';flex:none"></span>' +
        '<span>' + x[1] + '</span>' +
        (mk ? '<span style="font-size:10px;color:var(--tx-tertiary)">' + mk + '</span>' : '') +
        '</div>');
    });
    box.innerHTML = lines.join('');
  }

  function renderResTag(school) {
    var el = U.$('[data-res-tag="' + school + '"]');
    var noticeEl = U.$('[data-res-notice="' + school + '"]');
    if (!el) return;
    var s = RES.get()[school];
    if (!s) return;
    var k = statusKind(s.status);
    var label = s.status === 'ok' ? '资源正常' : (s.status === 'checking' ? '检测中' : s.text);
    el.className = 'tag tag--' + k.tag;
    el.innerHTML = '<span class="tag__dot"></span>' + U.esc(label);

    /* 正常时在标签旁补一个「来源」小字（内置快照 / 本地实时），鼠标悬停可看明细 */
    var side = el.parentNode;
    if (side) {
      var prov = side.querySelector('[data-res-prov="' + school + '"]');
      if (!prov && side.classList && side.classList.contains('pagehead__side')) {
        prov = document.createElement('span');
        prov.setAttribute('data-res-prov', school);
        prov.style.cssText = 'font-size:var(--fs-11);color:var(--tx-tertiary);white-space:nowrap';
        side.appendChild(prov);
      }
      if (prov) {
        if (s.status === 'ok' && s.origin) {
          prov.style.display = '';
          prov.textContent = s.origin === 'inline' ? '内置快照' : '本地实时';
          prov.title = s.detail || '';
        } else {
          prov.style.display = 'none';
        }
      }
    }

    /* 异常时展示报错条（仅本分区，不阻塞其他分区） */
    if (noticeEl) {
      if (s.status === 'ok' || s.status === 'checking') {
        noticeEl.style.display = 'none';
      } else {
        noticeEl.style.display = '';
        noticeEl.innerHTML =
          '<span class="notice__icon">⚠</span>' +
          '<div><strong>' + U.esc(s.text) + '</strong><br>' +
          U.esc(RES.failText(school)) +
          (s.detail ? '<br><span style="color:var(--tx-tertiary);font-size:var(--fs-11)">检测详情：' + U.esc(s.detail) + '</span>' : '') +
          '</div>';
      }
    }
  }

  /* ===================== 分区操作 ===================== */
  function bindSchoolActions() {
    U.$$('[data-generate]').forEach(function (b) {
      b.addEventListener('click', function () { generate(b.getAttribute('data-generate')); });
    });
    U.$$('[data-refresh]').forEach(function (b) {
      b.addEventListener('click', function () { refreshSchool(b.getAttribute('data-refresh')); });
    });
    U.$$('[data-export]').forEach(function (b) {
      b.addEventListener('click', function () {
        var school = b.getAttribute('data-school');
        if (b.getAttribute('data-export') === 'pdf') exportPdf(school);
        else exportMd(school);
      });
    });
    U.$$('[data-ask-send]').forEach(function (b) {
      b.addEventListener('click', function () { ask(b.getAttribute('data-ask-send')); });
    });
    U.$$('[data-ask-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        var parts = b.getAttribute('data-ask-preset').split('|');
        var school = parts[0], q = parts[1];
        var input = U.$('[data-ask-input="' + school + '"]');
        if (input) input.value = q;
        ask(school);
      });
    });
    /* 提问框：Enter 提交，Shift+Enter 换行 */
    U.$$('[data-ask-input]').forEach(function (ta) {
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          ask(ta.getAttribute('data-ask-input'));
        }
      });
    });
  }

  /* 生成某分区结果 */
  function generate(school) {
    var rec = STORE.currentRecord();
    var out = U.$('#out-' + school);
    if (!rec) {
      out.innerHTML = U.emptyState('简', '尚未录入生辰',
        '请先到「命盘档案」新建一个命盘，四个分区会自动同步数据。');
      return;
    }
    /* 资源异常 → 本分区只报错，不影响其他分区 */
    var st = RES.get()[school];
    if (st && (st.status === 'fail' || st.status === 'parse') && school !== 'fortune') {
      out.innerHTML = '<div class="notice" style="border-color:rgba(168,68,58,0.24);background:rgba(168,68,58,0.05)">' +
        '<span class="notice__icon" style="color:var(--c-ji)">⚠</span>' +
        '<div><strong>' + U.esc(st.text) + '</strong><br>' + U.esc(RES.failText(school)) + '</div></div>';
      return;
    }

    var pan;
    try { pan = global.PAIPAN.compute(toEngineArgs(rec)); }
    catch (e) {
      out.innerHTML = '<div class="notice"><span class="notice__icon">⚠</span><div>排盘计算出现异常：' +
        U.esc(String(e && e.message || e)) + '<br>请检查生辰信息是否完整、日期是否有效。</div></div>';
      return;
    }
    if (!pan || !pan.pillars) {
      out.innerHTML = '<div class="notice"><span class="notice__icon">⚠</span><div>排盘失败，请检查生辰信息。</div></div>';
      return;
    }

    var res;
    try { res = SCH[school](pan, RES.get()); }
    catch (e) {
      out.innerHTML = '<div class="notice"><span class="notice__icon">⚠</span><div>本分区解读生成异常：' +
        U.esc(String(e && e.message || e)) + '<br>该异常仅影响本分区，其他分区可正常使用。</div></div>';
      return;
    }

    out.innerHTML = '<div class="result" data-school="' + school + '">' + res.html + '</div>' +
      '<div style="margin-top:var(--sp-6);padding-top:var(--sp-4);border-top:1px solid var(--line-hair);' +
      'font-size:var(--fs-11);color:var(--tx-tertiary);line-height:var(--lh-base)">' +
      '以上内容基于「' + (SCH.name[school] || '') + '」体系生成，仅供个人娱乐参考，不构成任何决策依据。</div>';

    /* 天机缓缓显现：结果逐段浮现（克制淡入，尊重系统减弱动效偏好） */
    var reduce = false;
    try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
    if (!reduce) {
      var segs = out.querySelectorAll('.rsum, .rsec');
      Array.prototype.forEach.call(segs, function (el, i) {
        el.classList.add('rise');
        el.style.animationDelay = Math.min(i * 90, 1400) + 'ms';
      });
    }

    STORE.setResult(school, { pan: pan, res: res, at: Date.now() });
    renderPanFor(school, rec);
  }

  /* 排盘可视化（bazi / ziwei 分区） */
  function renderPanFor(school, rec) {
    if (school === 'bazi') {
      var card = U.$('#baziPanCard');
      var pan;
      try { pan = global.PAIPAN.compute(toEngineArgs(rec)); } catch (e) { card.style.display = 'none'; return; }
      card.style.display = '';
      U.$('#baziPanHint').textContent = rec.name + ' · ' + pan.input.shichen + '时';
      U.$('#baziPan').innerHTML = SCH.renderPillars(pan) +
        '<div style="margin-top:var(--sp-4)">' + U.kvRows([
          ['农历', U.esc(pan.input.lunar.year + '年' + (pan.input.lunar.leap ? '闰' : '') + U.cnMonth(pan.input.lunar.month) + '月' + U.cnDay(pan.input.lunar.day))],
          ['真太阳时', pan.input.tsApplied ? U.esc((pan.input.tsOffsetMin >= 0 ? '+' : '') + pan.input.tsOffsetMin.toFixed(1) + ' 分钟') : '未启用'],
          ['日主旺衰', U.kw(pan.strength.level + '（' + pan.strength.score + '/100）')],
          ['格局', U.kw(pan.geju.name)],
          ['喜用神', U.kw(pan.yongshen.xiyong.join('、'))],
          ['忌神', U.esc(pan.yongshen.jishen.join('、'))],
          ['起运', U.esc(pan.qiyun.years + ' 年 ' + pan.qiyun.months + ' 个月 · 大运' + (pan.dayunForward ? '顺行' : '逆行'))]
        ]) + '</div>';
    }
    if (school === 'ziwei') {
      var zcard = U.$('#ziweiPanCard');
      var z;
      try {
        var p2 = global.PAIPAN.compute(toEngineArgs(rec));
        z = SCH.computeZiwei(p2);
      } catch (e) { zcard.style.display = 'none'; return; }
      zcard.style.display = '';
      U.$('#ziweiPanHint').textContent = rec.name + ' · ' + z.bureau.name;
      /* 4×3 宫位网格 */
      var cells = z.palaces.map(function (p) {
        var stars = p.stars.length
          ? '<div style="font-family:var(--ff-serif);font-size:var(--fs-14);color:var(--c-xuanhei);margin-top:2px">' + U.esc(p.stars.join(' ')) + '</div>'
          : '<div style="font-size:var(--fs-11);color:var(--tx-tertiary);margin-top:2px">无主星</div>';
        var marks = (p.isMing ? U.tag('命', 'gold') : '') + (p.isShen ? U.tag('身', 'plain') : '');
        return '<div class="pillar" style="text-align:left;gap:2px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:4px">' +
            '<span style="font-size:var(--fs-12);color:var(--tx-secondary)">' + U.esc(p.name) + '</span>' + marks +
          '</div>' + stars +
          '<div style="font-family:var(--ff-mono);font-size:var(--fs-10);color:var(--tx-tertiary)">' + U.esc(p.gan + p.zhi) + '</div>' +
          '</div>';
      }).join('');
      U.$('#ziweiPan').innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--sp-2)">' + cells + '</div>' +
        '<div style="margin-top:var(--sp-4)">' + U.kvRows([
          ['五行局', U.kw(z.bureau.name)],
          ['命宫', U.kw(ZHI_OF(z.mingIdx))],
          ['身宫', U.kw(ZHI_OF(z.shenIdx))],
          ['生年四化', U.esc(z.sihua.map(function (s) { return s.star + '化' + s.type; }).join('、'))]
        ]) + '</div>';
    }
    /* 宫位索引 → 地支名（注意：命名空间是 global.GZ，不是 global.GANZHI；
       且此处不可用 GZ 做函数名，会与本文件顶层引用的 GZ 混淆） */
    function ZHI_OF(idx) {
      return global.GZ.ZHI[idx];
    }
  }

  /* 单分区刷新 */
  function refreshSchool(school) {
    U.toast('正在刷新本分区…');
    RES.clear && RES.clear();
    var target = school === 'fortune' ? ['nihaixia', 'bazi', 'ziwei'] : [school];
    Promise.all(target.map(function (s) { return RES.check(s); })).then(function () {
      renderResourceStatus();
      SCHOOLS_LIST.forEach(function (s) { renderResTag(s); });
      generate(school);
      U.toast('本分区已刷新', 'ok');
    });
  }

  /* ===================== 导出（MD / PDF，替代原「复制全文」） ===================== */
  function exportHeader(school) {
    var rec = STORE.currentRecord();
    var name = SCH.name[school] || '';
    var who = rec ? rec.name + ' · ' + rec.year + '-' + U.pad2(rec.month) + '-' + U.pad2(rec.day) + ' ' + rec.shichen + '时' : '未命名命盘';
    return { name: name, who: who, when: new Date().toLocaleString('zh-CN') };
  }
  function domainText() {
    try {
      if (location.protocol === 'file:') return '本机离线版（file:// 直接打开）';
      return location.host || '本机离线版';
    } catch (e) { return '本机离线版'; }
  }
  var DISCLAIMER = '免责声明：本工具生成内容基于传统命理体系的结构化推演，仅供个人娱乐与文化参考，不构成任何医疗、投资、法律或其他决策依据。';
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* DOM → Markdown：只处理本工具已知产出结构，未识别节点回退纯文本 */
  function domToMd(root) {
    var lines = [];
    function inline(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
    function tableMd(tb) {
      var rows = [].slice.call(tb.querySelectorAll('tr'));
      if (!rows.length) return '';
      function cells(tr) {
        return [].slice.call(tr.children).map(function (td) { return inline(td).replace(/\|/g, '／') || ' '; });
      }
      var outp = ['| ' + cells(rows[0]).join(' | ') + ' |',
        '|' + rows[0].children.length.toString() + ' |'];
      outp[1] = '|' + cells(rows[0]).map(function () { return ' --- '; }).join('|') + '|';
      rows.slice(1).forEach(function (tr) { outp.push('| ' + cells(tr).join(' | ') + ' |'); });
      return outp.join('\n');
    }
    function walkBody(body) {
      [].slice.call(body.children).forEach(function (c) {
        if (c.tagName === 'P') { var t = inline(c); if (t) lines.push('', t); }
        else if (c.tagName === 'TABLE' || c.classList.contains('table')) { lines.push('', tableMd(c), ''); }
        else if (c.classList && c.classList.contains('kv')) {
          [].slice.call(c.querySelectorAll('.kv__row')).forEach(function (r) {
            var k = r.querySelector('.kv__k'), v = r.querySelector('.kv__v');
            if (k && v) lines.push('- **' + inline(k) + '**：' + inline(v));
          });
        }
        else if (c.classList && c.classList.contains('tips')) {
          [].slice.call(c.querySelectorAll('.tip')).forEach(function (tp) {
            var t1 = tp.querySelector('.tip__title'), d = tp.querySelector('.tip__desc');
            lines.push('- **' + (t1 ? inline(t1) : '') + '**：' + (d ? inline(d) : ''));
          });
        }
        else if (c.classList && c.classList.contains('saying')) { lines.push('> ' + inline(c)); }
        else if (c.tagName === 'DIV') {
          var directTable = c.querySelector(':scope > table, :scope > div > table');
          if (directTable) { lines.push('', tableMd(directTable), ''); }
          [].slice.call(c.children).filter(function (x) { return x.tagName === 'P'; })
            .forEach(function (pp) { var t2 = inline(pp); if (t2) lines.push('', t2); });
          [].slice.call(c.querySelectorAll('.tips')).forEach(function (tps) {
            [].slice.call(tps.querySelectorAll('.tip')).forEach(function (tp) {
              var t1 = tp.querySelector('.tip__title'), d = tp.querySelector('.tip__desc');
              lines.push('- **' + (t1 ? inline(t1) : '') + '**：' + (d ? inline(d) : ''));
            });
          });
        }
      });
    }
    [].slice.call(root.children).forEach(function (el) {
      if (el.classList.contains('rsum')) { lines.push('', '> **总览** ' + inline(el)); return; }
      if (el.classList.contains('rsec')) {
        var label = el.querySelector('.rsec__label');
        var body = el.querySelector('.rsec__body');
        lines.push('', '## ' + (label ? inline(label) : '段落'));
        if (body) walkBody(body);
        return;
      }
      var rest = inline(el);
      if (rest) lines.push('', rest);
    });
    return lines.join('\n');
  }

  function exportMd(school) {
    var out = U.$('#out-' + school);
    if (!out || !out.textContent.trim()) { U.toast('本分区还没有可导出的内容', 'fail'); return; }
    var h = exportHeader(school);
    var md = '# ' + h.name + ' · ' + h.who + '\n\n' +
      '- 生成时间：' + h.when + '\n' +
      '- 来源：' + domainText() + '\n\n' +
      '> ' + DISCLAIMER + '\n' +
      domToMd(out.querySelector('.result') || out);
    var logs = STORE.getLogs(school);
    if (logs.length) {
      md += '\n\n## 本分区问答记录\n\n' + logs.map(function (t, i) {
        return (i + 1) + '. **问：**' + t.q + '\n\n   **答：**' + t.aText;
      }).join('\n\n');
    }
    md += '\n\n---\n\n' + DISCLAIMER + '\n';
    U.download('玄机命理-' + h.name + '.md', md);
    U.toast('已导出 Markdown 文件', 'ok');
  }

  /* PDF：排版化打印视图（浏览器「另存为 PDF」），含来源域名与免责声明 */
  var PRINT_CSS = [
    ':root{--sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:20px;--sp-6:24px;--sp-8:32px;',
    '--fs-11:11px;--fs-12:12px;--fs-13:13px;--fs-14:14px;--fs-16:16px;--fs-18:18px;',
    '--tx-primary:#1c2530;--tx-secondary:#42505e;--tx-tertiary:#6d7a86;',
    '--c-ok:#3a7d5c;--c-ji:#a8443a;--c-warn:#a8823b;--c-liujin:#8a6d2a;--c-youxuan-bright:#2A70B8;',
    '--ff-mono:Consolas,monospace;--ff-serif:"Kaiti SC","STKaiti","KaiTi",serif;',
    '--lh-base:1.7;--line-hair:rgba(42,112,184,.14);--r-md:8px;}',
    '*{box-sizing:border-box}',
    'body{margin:0;padding:28px 34px;font:14px/1.7 "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif;color:#1c2530;background:#fff;}',
    '@page{margin:18mm 16mm;}',
    '.dochead{border-bottom:2px solid #2A70B8;padding-bottom:12px;margin-bottom:20px;}',
    '.dochead .dom{font-size:11px;color:#6d7a86;letter-spacing:.08em;margin-bottom:4px;}',
    '.dochead h1{margin:0 0 6px;font-family:var(--ff-serif);font-weight:600;font-size:24px;color:#14202b;}',
    '.dochead .meta{font-size:12px;color:#6d7a86;}',
    '.rsec{margin:0 0 18px;padding:0 0 6px 14px;border-left:2px solid rgba(42,112,184,.25);page-break-inside:avoid;}',
    '.rsec__label{font-family:var(--ff-serif);font-weight:600;font-size:15px;color:#2A70B8;margin-bottom:8px;letter-spacing:.06em;}',
    '.rsec__body{font-size:13px;}',
    '.rsec__body p{margin:0 0 8px;}',
    '.rsum{background:#f2f6fa;border:1px solid rgba(42,112,184,.2);border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:13px;}',
    'table{width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:12px;page-break-inside:avoid;}',
    'th{background:#eef3f8;text-align:left;padding:6px 8px;border:1px solid #d8e2ec;font-weight:600;}',
    'td{padding:6px 8px;border:1px solid #e3eaf1;vertical-align:top;}',
    '.kw{color:#2A70B8;font-weight:600;}',
    '.kw--good,.kw--ji{color:#8a6d2a;font-weight:600;}',
    '.kw--xiong{color:#a8443a;font-weight:600;}',
    '.tag{display:inline-block;border:1px solid #d8e2ec;border-radius:999px;padding:0 8px;font-size:11px;color:#42505e;}',
    '.tag--ok{color:#3a7d5c;border-color:#9ec9b4;}.tag--warn{color:#a8823b;border-color:#dcc794;}',
    '.tag--fail{color:#a8443a;border-color:#d8a49e;}.tag--gold{color:#8a6d2a;border-color:#d8c9a0;}',
    '.num{font-family:var(--ff-mono);}',
    '.saying{border-left:2px solid #c9b070;padding:2px 0 2px 10px;margin:8px 0;color:#42505e;}',
    '.saying__src{font-size:11px;color:#6d7a86;}',
    '.tip{border:1px solid #e3eaf1;border-radius:6px;padding:8px 12px;margin-bottom:8px;page-break-inside:avoid;}',
    '.tip__title{font-weight:600;color:#2A70B8;}',
    '.qa{margin-bottom:10px;page-break-inside:avoid;}',
    '.qa .q{font-weight:600;margin:0 0 2px;}',
    '.qa .a{margin:0;color:#42505e;}',
    'h2{font-size:17px;color:#14202b;border-bottom:1px solid #d8e2ec;padding-bottom:6px;}',
    '.docfoot{margin-top:26px;padding-top:10px;border-top:1px solid #d8e2ec;font-size:11px;color:#6d7a86;line-height:1.7;}'
  ].join('');

  function exportPdf(school) {
    var out = U.$('#out-' + school);
    if (!out || !out.textContent.trim()) { U.toast('本分区还没有可导出的内容', 'fail'); return; }
    var h = exportHeader(school);
    var contentHtml = (out.querySelector('.result') || out).innerHTML;
    var logs = STORE.getLogs(school);
    var logsHtml = logs.length
      ? '<h2 style="margin-top:22px;">本分区问答记录</h2>' +
        logs.map(function (t, i) {
          return '<div class="qa"><p class="q">' + (i + 1) + '. 问：' + escHtml(t.q) + '</p><p class="a">答：' + escHtml(t.aText) + '</p></div>';
        }).join('')
      : '';
    var w = window.open('', '_blank', 'width=920,height=1000');
    if (!w) { U.toast('浏览器拦截了导出窗口，请允许本站弹窗后重试', 'fail'); return; }
    w.document.write('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
      '<title>' + escHtml(h.name + ' · ' + h.who) + '</title><style>' + PRINT_CSS + '</style></head><body>' +
      '<header class="dochead">' +
        '<div class="dom">来源：' + escHtml(domainText()) + '</div>' +
        '<h1>' + escHtml(h.name) + '</h1>' +
        '<div class="meta">' + escHtml(h.who) + ' · 生成时间 ' + escHtml(h.when) + '</div>' +
      '</header>' +
      contentHtml + logsHtml +
      '<footer class="docfoot">' + escHtml(DISCLAIMER) + '<br>来源：' + escHtml(domainText()) + ' · 生成时间 ' + escHtml(h.when) + '</footer>' +
      '<' + 'script>setTimeout(function(){window.print();},450);<' + '/script>' +
      '</body></html>');
    w.document.close();
  }

  /* ===================== 提问 ===================== */
  function ask(school) {
    var input = U.$('[data-ask-input="' + school + '"]');
    var q = input.value.trim();
    if (!q) { U.toast('请先输入问题', 'fail'); return; }
    var rec = STORE.currentRecord();
    var log = U.$('#log-' + school);
    if (!rec) {
      log.innerHTML = U.emptyState('简', '尚未录入生辰', '请先到「命盘档案」新建命盘后再提问。');
      return;
    }

    /* 追加「问」 */
    var turn = U.el('div', 'ask__turn');
    turn.innerHTML = '<div class="ask__who">你问</div><div class="ask__q">' + U.esc(q) + '</div>';
    log.appendChild(turn);
    input.value = '';

    /* 生成「答」 */
    var pan;
    try { pan = global.PAIPAN.compute(toEngineArgs(rec)); }
    catch (e) {
      turn.insertAdjacentHTML('beforeend', '<div class="ask__a" style="border-color:rgba(168,68,58,0.24)">排盘计算异常，无法回答。</div>');
      return;
    }
    var ans;
    try { ans = SCH.answer(pan, school, q); }
    catch (e) {
      ans = { html: '<p>本分区解答生成异常：' + U.esc(String(e && e.message || e)) + '。该异常仅影响本分区。</p>' };
    }
    var ansBox = U.el('div', 'ask__turn');
    ansBox.innerHTML = '<div class="ask__who">' + (SCH.name[school] || '') + ' · 解答</div>' +
      '<div class="ask__a">' + ans.html + '</div>';
    log.appendChild(ansBox);
    log.scrollIntoView({ behavior: 'smooth', block: 'end' });

    /* 存日志（供复制） */
    STORE.pushLog(school, {
      q: q,
      aText: U.htmlToText(ansBox.querySelector('.ask__a')) || '',
      ts: Date.now()
    });
  }

  function renderLog(school) {
    var log = U.$('#log-' + school);
    if (!log) return;
    log.innerHTML = '';
  }

  /* ===================== 顶栏操作 ===================== */
  /* ===================== 桌面悬浮卡（任务书·追加模块） =====================
     架构（第一性原理裁决）：
       · 悬浮卡 = PowerShell + WPF（Windows 自带 .NET，零依赖、几 KB）——
         Topmost / 无边框 / 拖动 / 半透明全部原生支持，Electron 体量不合法
       · 数据同源：悬浮卡不内置任何排盘/推理，只读网页导出的当日快照
         xuanji-data.json（由 SCHOOLS.dailySnapshot 数据驱动生成）
       · 每日更新：60s 定时器检测快照文件修改时间与日期翻转，过期显示提示条
       · 档案互通：悬浮卡跳转网页走 URL 参数（auto=1&…），网页自动建档带入 */

  function buildSnapshotJson() {
    var rec = STORE.currentRecord();
    if (!rec) return null;
    var pan;
    try { pan = PAIPAN.compute(toEngineArgs(rec)); } catch (e) { return null; }
    if (!pan || !pan.pillars) return null;
    var snap = SCHOOLS.dailySnapshot(pan);
    snap.profile.name = rec.name;
    return JSON.stringify({
      v: 1,
      source: domainText(),
      generatedAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
      snapshot: snap
    }, null, 2);
  }

  var FLOAT_README = [
    '玄机命理 · 桌面运势悬浮卡 — 使用说明',
    '==================================================',
    '',
    '【运行方式】',
    '1. 把本文件夹内的「玄机运势卡.ps1」「xuanji-data.json」放在同一目录；',
    '2. 右键「玄机运势卡.ps1」→ 使用 PowerShell 运行（如被策略拦截，',
    '   以管理员 PowerShell 执行：',
    '   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned） ；',
    '3. 悬浮卡默认出现在屏幕右上角，可按住拖动到任意位置，位置自动记忆；',
    '4. 开机自启：卡片内勾选「开机自启」，即写入启动项快捷方式。',
    '',
    '【命盘档案互通】',
    '· 悬浮卡的运势数据 = 网页端「通用运势」当日快照（xuanji-data.json），',
    '  对应导出时网页选中的命盘档案；',
    '· 每天打开网页工作台 → 选中档案 → 生成通用运势 → 重新下载快照覆盖，',
    '  悬浮卡一分钟内自动换新（也可等待卡片自动检测）；',
    '· 卡片内可新建/切换多套档案（与网页字段一致），点「查看完整命盘」',
    '  会自动打开网页版并把该档案带入，无需重复录入。',
    '',
    '【跨端跳转】',
    '悬浮卡 → 查看完整命盘：通过 URL 参数自动带入档案到网页端。',
    '',
    '【免责声明】',
    '本工具生成内容基于传统命理体系的结构化推演，仅供个人娱乐与文化参考，',
    '不构成任何医疗、投资、法律或其他决策依据。非商业用途。'
  ].join('\n');

  var FLOAT_PS1 = [
    '# 玄机命理 · 桌面运势悬浮卡（PowerShell + WPF，零依赖）',
    '# 数据同源：只读网页导出的 xuanji-data.json，自身不做任何排盘与推理',
    'param([string]$DataPath = "")',
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Windows.Forms | Out-Null",
    "$dir = Split-Path -Parent $MyInvocation.MyCommand.Path",
    'if ($DataPath -eq "") { $DataPath = Join-Path $dir "xuanji-data.json" }',
    '$cardsPath = Join-Path $dir "float-cards.json"',
    '$posPath   = Join-Path $dir "float-pos.txt"',
    '$offline = "天机算力离线，请打开网页工作台获取最新运势"',
    'function Read-JsonFile($p) {',
    '  if (Test-Path $p) { try { return (Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null } }',
    '  return $null',
    '}',
    '$script:data = Read-JsonFile $DataPath',
    '$script:cards = Read-JsonFile $cardsPath',
    'if (-not $script:cards) { $script:cards = [pscustomobject]@{ cards = @(); current = 0 } }',
    '[xml]$xaml = @"',
    '<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"',
    '        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"',
    '        Title="玄机命理·运势悬浮卡" Width="340" Height="470"',
    '        WindowStyle="None" AllowsTransparency="True" Background="Transparent"',
    '        Topmost="True" ShowInTaskbar="False" StartPosition="Manual">',
    '  <Border x:Name="Root" Background="#F016242E" CornerRadius="14" BorderBrush="#80C9A961" BorderThickness="1">',
    '    <Grid>',
    '      <Grid.RowDefinitions>',
    '        <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="*"/>',
    '        <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/>',
    '      </Grid.RowDefinitions>',
    '      <Border Grid.Row="0" x:Name="StaleBar" Background="#5C8C2C2C" Padding="8,4" Visibility="Collapsed">',
    '        <TextBlock x:Name="StaleText" Foreground="#F0D9C9C9" FontSize="11" TextWrapping="Wrap"/>',
    '      </Border>',
    '      <Grid Grid.Row="1" Margin="14,10,14,4">',
    '        <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>',
    '        <StackPanel Orientation="Horizontal" Grid.Column="0">',
    '          <TextBlock Text="☯" Foreground="#C9A961" FontSize="15" VerticalAlignment="Center" Margin="0,0,6,0"/>',
    '          <TextBlock Text="玄机命理 · 今日运势" Foreground="#E8EDF4" FontSize="13" FontWeight="SemiBold" VerticalAlignment="Center"/>',
    '        </StackPanel>',
    '        <Button x:Name="BtnEdit"  Content="档案" Grid.Column="1" Style="{x:Null}" Background="Transparent" Foreground="#C9A961" BorderThickness="0" FontSize="12" Cursor="Hand" Margin="0,0,8,0"/>',
    '        <Button x:Name="BtnMini"  Content="—"  Grid.Column="2" Background="Transparent" Foreground="#949BA8" BorderThickness="0" FontSize="12" Cursor="Hand" Margin="0,0,8,0"/>',
    '        <Button x:Name="BtnClose" Content="×"  Grid.Column="3" Background="Transparent" Foreground="#949BA8" BorderThickness="0" FontSize="13" Cursor="Hand"/>',
    '      </Grid>',
    '      <ScrollViewer Grid.Row="2" VerticalScrollBarVisibility="Auto" Padding="14,4,14,0">',
    '        <StackPanel x:Name="MainPane">',
    '          <Grid x:Name="EditGrid" Visibility="Collapsed" Margin="0,0,0,8">',
    '            <Grid.RowDefinitions><RowDefinition/><RowDefinition/><RowDefinition/><RowDefinition/><RowDefinition/><RowDefinition/></Grid.RowDefinitions>',
    '            <Grid.ColumnDefinitions><ColumnDefinition Width="52"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>',
    '            <TextBlock Text="名称" Foreground="#949BA8" FontSize="12" Grid.Row="0" VerticalAlignment="Center"/>',
    '            <TextBox x:Name="InName" Grid.Row="0" Grid.Column="1" Margin="0,2"/>',
    '            <TextBlock Text="性别" Foreground="#949BA8" FontSize="12" Grid.Row="1" VerticalAlignment="Center"/>',
    '            <ComboBox x:Name="InSex" Grid.Row="1" Grid.Column="1" Margin="0,2"><ComboBoxItem Content="男"/><ComboBoxItem Content="女"/></ComboBox>',
    '            <TextBlock Text="年月日" Foreground="#949BA8" FontSize="12" Grid.Row="2" VerticalAlignment="Center"/>',
    '            <TextBox x:Name="InDate" Grid.Row="2" Grid.Column="1" Margin="0,2" ToolTip="格式：1990-5-15（公历）"/>',
    '            <TextBlock Text="时辰" Foreground="#949BA8" FontSize="12" Grid.Row="3" VerticalAlignment="Center"/>',
    '            <TextBox x:Name="InShichen" Grid.Row="3" Grid.Column="1" Margin="0,2" ToolTip="如：午"/>',
    '            <TextBlock Text="地区" Foreground="#949BA8" FontSize="12" Grid.Row="4" VerticalAlignment="Center"/>',
    '            <TextBox x:Name="InPlace" Grid.Row="4" Grid.Column="1" Margin="0,2"/>',
    '            <Button x:Name="BtnSaveCard" Content="保存档案" Grid.Row="5" Grid.Column="1" Background="#2A70B8" Foreground="White" BorderThickness="0" Margin="0,6,0,2" Cursor="Hand"/>',
    '          </Grid>',
    '          <StackPanel x:Name="ViewPane">',
    '            <TextBlock x:Name="TxtTone" FontSize="30" FontWeight="Bold" Foreground="#C9A961"/>',
    '            <TextBlock x:Name="TxtToneNote" Foreground="#949BA8" FontSize="11" TextWrapping="Wrap" Margin="0,2,0,8"/>',
    '            <TextBlock x:Name="TxtFour" Foreground="#E8EDF4" FontSize="12" TextWrapping="Wrap" Margin="0,0,0,8"/>',
    '            <TextBlock x:Name="TxtYi"   Foreground="#949BA8" FontSize="11" TextWrapping="Wrap" Margin="0,0,0,4"/>',
    '            <TextBlock x:Name="TxtJi"   Foreground="#949BA8" FontSize="11" TextWrapping="Wrap" Margin="0,0,0,4"/>',
    '            <TextBlock x:Name="TxtWarn" Foreground="#C9A961" FontSize="11" TextWrapping="Wrap" Margin="0,0,0,8"/>',
    '            <TextBlock x:Name="TxtLucky" Foreground="#E8EDF4" FontSize="11" Margin="0,0,0,8"/>',
    '            <Border Background="#22242E" CornerRadius="8" Padding="10,8" Margin="0,0,0,8">',
    '              <TextBlock x:Name="TxtQuote" Foreground="#C9D4DC" FontSize="11" TextWrapping="Wrap"/>',
    '            </Border>',
    '            <TextBlock Text="── 三派天机简析 ──" Foreground="#6B7280" FontSize="10" TextAlignment="Center" Margin="0,0,0,6"/>',
    '            <TextBlock x:Name="TxtSchools" Foreground="#949BA8" FontSize="11" TextWrapping="Wrap"/>',
    '          </StackPanel>',
    '        </StackPanel>',
    '      </ScrollViewer>',
    '      <Separator Grid.Row="3" Background="#33C9A961" Margin="14,6"/>',
    '      <Grid Grid.Row="4" Margin="14,0,14,12">',
    '        <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>',
    '        <CheckBox x:Name="ChkAuto" Content="开机自启" Foreground="#949BA8" FontSize="11" VerticalAlignment="Center"/>',
    '        <Button x:Name="BtnOpen" Content="查看完整命盘 →" Grid.Column="1" Background="#2A70B8" Foreground="White" BorderThickness="0" Padding="10,5" Cursor="Hand"/>',
    '      </Grid>',
    '    </Grid>',
    '  </Border>',
    '</Window>',
    '"@',
    '$reader = New-Object System.Xml.XmlNodeReader $xaml',
    '$window = [Windows.Markup.XamlReader]::Load($reader)',
    'function Find($n) { return $window.FindName($n) }',
    '$root = Find "Root"; $staleBar = Find "StaleBar"; $staleText = Find "StaleText"',
    '$txtTone = Find "TxtTone"; $txtToneNote = Find "TxtToneNote"; $txtFour = Find "TxtFour"',
    '$txtYi = Find "TxtYi"; $txtJi = Find "TxtJi"; $txtWarn = Find "TxtWarn"',
    '$txtLucky = Find "TxtLucky"; $txtQuote = Find "TxtQuote"; $txtSchools = Find "TxtSchools"',
    '$editGrid = Find "EditGrid"; $viewPane = Find "ViewPane"',
    'function Show-Offline($why) {',
    '  $txtTone.Text = "—"; $txtTone.Text = "离线"; $txtTone.Foreground = "#949BA8"',
    '  $txtToneNote.Text = $offline',
    '  $txtFour.Text = ""; $txtYi.Text = ""; $txtJi.Text = ""; $txtWarn.Text = ""',
    '  $txtLucky.Text = ""; $txtQuote.Text = ""; $txtSchools.Text = ""',
    '  $staleBar.Visibility = "Visible"; $staleText.Text = $why',
    '}',
    'function Render-Data($d) {',
    '  $s = $d.snapshot',
    '  $staleBar.Visibility = "Collapsed"',
    '  $txtTone.Foreground = "#C9A961"',
    '  $txtTone.Text = $s.daily.tone',
    '  $txtToneNote.Text = $s.daily.toneNote',
    '  $txtFour.Text = (($s.daily.four | ForEach-Object { $_.k + "：" + $_.v }) -join "`n")',
    '  $txtYi.Text   = "宜：" + $s.daily.yi',
    '  $txtJi.Text   = "忌：" + $s.daily.ji',
    '  $txtWarn.Text = $s.daily.warn',
    '  $txtLucky.Text = "幸运色：" + $s.daily.luckyColor + "　幸运方位：" + $s.daily.luckyDir',
    '  $txtQuote.Text = "「" + $s.daily.quote + "」"',
    '  $sc = $s.schools',
    '  $txtSchools.Text = "【天机道】" + $sc.nihaixia + "`n【四柱】" + $sc.bazi + "`n【紫微】" + $sc.ziwei',
    '}',
    'function Render-All {',
    '  if (-not $script:data) { Show-Offline "未找到 xuanji-data.json——请从网页端「悬浮卡」下载并放在本目录"; return }',
    '  if (-not $script:data.snapshot) { Show-Offline "快照格式不正确，请重新从网页端导出"; return }',
    '  Render-Data $script:data',
    '  $today = Get-Date -Format "yyyy-MM-dd"',
    '  if ($script:data.snapshot.date -ne $today) {',
    '    $staleBar.Visibility = "Visible"',
    '    $staleText.Text = "以上是 " + $script:data.snapshot.date + " 的快照——悬浮卡不内置算力，请打开网页重新导出今日运势"',
    '  }',
    '}',
    'Render-All',
    '$timer = New-Object System.Windows.Threading.DispatcherTimer',
    '$timer.Interval = [TimeSpan]::FromSeconds(60)',
    '$timer.Add_Tick({',
    '  if (Test-Path $DataPath) {',
    '    $mt = (Get-Item $DataPath).LastWriteTime',
    '    if (-not $script:lastMt -or $mt -ne $script:lastMt) { $script:lastMt = $mt; $script:data = Read-JsonFile $DataPath; Render-All }',
    '  }',
    '})',
    '$script:lastMt = if (Test-Path $DataPath) { (Get-Item $DataPath).LastWriteTime } else { $null }',
    '$timer.Start()',
    '# 位置记忆',
    'if (Test-Path $posPath) {',
    '  $pv = (Get-Content $posPath -Raw).Split(",")',
    '  if ($pv.Count -ge 2) { $window.WindowStartupLocation = "Manual"; $window.Left = [double]$pv[0]; $window.Top = [double]$pv[1] }',
    '} else {',
    '  $window.WindowStartupLocation = "Manual"',
    '  $wa = [System.Windows.SystemParameters]::WorkArea',
    '  $window.Left = $wa.Right - $window.Width - 24; $window.Top = $wa.Top + 24',
    '}',
    '$window.Add_MouseLeftButtonDown({ $window.DragMove() })',
    '$window.Add_Closing({',
    '  ($window.Left.ToString() + "," + $window.Top.ToString()) | Out-File $posPath -Encoding ASCII',
    '})',
    '(Find "BtnClose").Add_Click({ $window.Close() })',
    '(Find "BtnMini").Add_Click({',
    '  if ($window.Height -gt 100) { $script:prevH = $window.Height; $window.Height = 64 }',
    '  else { $window.Height = $script:prevH }',
    '})',
    '(Find "BtnEdit").Add_Click({',
    '  $show = $editGrid.Visibility -eq "Collapsed"',
    '  $editGrid.Visibility = if ($show) { "Visible" } else { "Collapsed" }',
    '})',
    '(Find "BtnSaveCard").Add_Click({',
    '  $c = [pscustomobject]@{',
    '    name = (Find "InName").Text; sex = if ((Find "InSex").Text -eq "女") { "female" } else { "male" };',
    '    cal = "solar"; year = 0; month = 0; day = 0; shichen = (Find "InShichen").Text; place = (Find "InPlace").Text',
    '  }',
    '  $dp = (Find "InDate").Text.Split("-")',
    '  if ($dp.Count -ge 3) { $c.year = [int]$dp[0]; $c.month = [int]$dp[1]; $c.day = [int]$dp[2] }',
    '  $list = @($script:cards.cards)',
    '  $list += $c',
    '  $script:cards = [pscustomobject]@{ cards = $list; current = $list.Count - 1 }',
    '  ($script:cards | ConvertTo-Json -Depth 4) | Out-File $cardsPath -Encoding UTF8',
    '  $editGrid.Visibility = "Collapsed"',
    '  [System.Windows.MessageBox]::Show("档案已保存（悬浮卡本地）", "玄机命理")',
    '})',
    '$autoPath = Join-Path ([Environment]::GetFolderPath("Startup")) "玄机运势卡.lnk"',
    '$chk = Find "ChkAuto"',
    '$chk.IsChecked = Test-Path $autoPath',
    '$chk.Add_Click({',
    '  if ($chk.IsChecked -eq $true) {',
    '    $ws = New-Object -ComObject WScript.Shell',
    '    $sc = $ws.CreateShortcut($autoPath)',
    '    $sc.TargetPath = "powershell.exe"',
    '    $sc.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"" + $MyInvocation.MyCommand.Path + "`""',
    '    $sc.Save()',
    '  } elseif (Test-Path $autoPath) { Remove-Item $autoPath -Force }',
    '})',
    '(Find "BtnOpen").Add_Click({',
    '  $idx = Join-Path $dir "index.html"',
    '  if (-not (Test-Path $idx)) { [System.Windows.MessageBox]::Show("未找到 index.html（请把悬浮卡放在网页工作台目录）"); return }',
    '  $c = $null',
    '  if ($script:cards -and $script:cards.cards.Count -gt 0) { $i = [Math]::Min($script:cards.current, $script:cards.cards.Count-1); $c = $script:cards.cards[$i] }',
    '  $q = "auto=1"',
    '  if ($c) {',
    '    $q += "&name=" + [Uri]::EscapeDataString($c.name) + "&sex=" + $c.sex + "&cal=" + $c.cal +',
    '          "&y=" + $c.year + "&m=" + $c.month + "&d=" + $c.day +',
    '          "&shichen=" + [Uri]::EscapeDataString($c.shichen) + "&place=" + [Uri]::EscapeDataString($c.place)',
    '  }',
    '  Start-Process ("file:///" + ($idx -replace "\\\\", "/") + "?" + $q)',
    '  $window.WindowState = "Minimized"',
    '})',
    '[System.Windows.Application]::new().Run($window)'
  ].join('\n');

  var FLOAT_README_FILENAME = '使用说明.txt';

  function bindFloatCard() {
    var btn = U.$('#btnFloatCard');
    var panel = U.$('#floatPanel');
    if (!btn || !panel) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.style.display = panel.style.display === 'none' ? '' : 'none';
    });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { panel.style.display = 'none'; });

    var rec = STORE.currentRecord();
    var name = rec ? rec.name : '未选择档案';

    U.$('#btnDlPs1').addEventListener('click', function () {
      U.download('玄机运势卡.ps1', '\uFEFF' + FLOAT_PS1);
      U.toast('已下载悬浮卡程序（与数据文件放同一目录后运行）', 'ok');
    });
    U.$('#btnDlJson').addEventListener('click', function () {
      var json = buildSnapshotJson();
      if (!json) { U.toast('当前没有命盘档案——请先在「命盘档案」新建并生成运势', 'fail'); return; }
      U.download('xuanji-data.json', json);
      U.toast('已导出当日运势快照（' + name + '）', 'ok');
    });
    U.$('#btnDlTxt').addEventListener('click', function () {
      U.download(FLOAT_README_FILENAME, FLOAT_README);
      U.toast('已下载使用说明', 'ok');
    });
  }

  /* URL 参数自动带入（悬浮卡 → 网页，任务书·核心联动）
     手写解析而非 URLSearchParams：file:// 双击与老内核环境更稳（smoke 沙箱亦无此 API） */
  function getQueryParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search || '');
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  }
  function bindUrlImport() {
    if (getQueryParam('auto') !== '1' || !getQueryParam('y')) return;
    var rec = {
      name: getQueryParam('name') || '悬浮卡档案',
      sex: getQueryParam('sex') === 'female' ? 'female' : 'male',
      cal: getQueryParam('cal') === 'lunar' ? 'lunar' : 'solar',
      year: parseInt(getQueryParam('y'), 10),
      month: parseInt(getQueryParam('m'), 10),
      day: parseInt(getQueryParam('d'), 10),
      shichen: getQueryParam('shichen') || '子',
      place: getQueryParam('place') || '',
      useTrueSolarTime: false
    };
    if (!rec.year || !rec.month || !rec.day) return;
    var added = STORE.add(rec);
    STORE.setCurrent(added.id);
    renderArchive(); updateCastline();
    U.toast('已自动带入悬浮卡命盘档案：' + rec.name, 'ok');
    go('archive');
  }


  function bindTopbar() {
    U.$('#btnGotoArchive').addEventListener('click', function () { go('archive'); });
    bindFloatCard();
    U.$('#btnGlobalReset').addEventListener('click', function () {
      if (!global.confirm('确定重置？将清空四个分区的解析结果与问答记录（命盘档案保留）。')) return;
      SCHOOLS_LIST.forEach(function (s) {
        STORE.clearResult(s); STORE.clearLogs(s);
        renderOut(s); renderLog(s);
      });
      U.$('#baziPanCard').style.display = 'none';
      U.$('#ziweiPanCard').style.display = 'none';
      U.toast('已重置所有解析记录', 'ok');
    });
  }

  function renderOut(school) {
    var out = U.$('#out-' + school);
    if (!out) return;
    out.innerHTML = U.emptyState('简', '尚未生成',
      '点击上方「生成' + (school === 'fortune' ? '运势' : '解读') + '」按钮，将基于当前命盘自动生成「' +
      (SCH.name[school] || '') + '」分区的完整内容。');
  }

  /* 初始渲染各分区空态 */
  SCHOOLS_LIST.forEach(function (s) { renderOut(s); });

  /* ---------- 启动 ---------- */
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init);
  else init();

})(window);
