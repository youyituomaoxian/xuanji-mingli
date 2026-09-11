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
      var mk = originMark(s.origin);
      lines.push('<div title="' + U.esc(s.detail || '') + '" style="display:flex;align-items:center;gap:6px;padding:2px 0">' +
        '<span style="width:5px;height:5px;border-radius:50%;background:' + color + ';flex:none"></span>' +
        '<span style="flex:1">' + x[1] +
          (mk ? ' <span style="font-size:9px;color:var(--tx-tertiary)">' + mk + '</span>' : '') + '</span>' +
        '<span style="font-family:var(--ff-mono);font-size:10px;color:' + color + '">' +
        U.esc(s.status === 'ok' ? '正常' : (s.status === 'fail' ? '失败' : (s.status === 'parse' ? '异常' : '检测'))) + '</span>' +
        '</div>');
    });
    /* 数据来源脚注：证明资源不依赖 HTTP 服务器 */
    var bt = RES.builtAt();
    if (bt) {
      var d = new Date(bt);
      lines.push('<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(128,128,128,.28);' +
        'font-size:9px;color:var(--tx-tertiary);line-height:1.5">' +
        '内置快照 ' + d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
        ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) +
        '<br>三流派知识已内联，无需 HTTP 服务</div>');
    }
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
    U.$$('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () { copySchool(b.getAttribute('data-copy')); });
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

  /* 复制全文 */
  function copySchool(school) {
    var out = U.$('#out-' + school);
    if (!out || !out.textContent.trim()) { U.toast('本分区还没有可复制的内容', 'fail'); return; }
    var rec = STORE.currentRecord();
    var header = '【' + (SCH.name[school] || '') + '】' + (rec ? rec.name + ' · ' + rec.year + '-' + U.pad2(rec.month) + '-' + U.pad2(rec.day) + ' ' + rec.shichen + '时' : '') +
      '\n生成时间：' + new Date().toLocaleString('zh-CN') + '\n' + '─'.repeat(40) + '\n\n';
    var logs = STORE.getLogs(school);
    var logText = '';
    if (logs.length) {
      logText = '\n\n' + '─'.repeat(40) + '\n【本分区问答记录】\n' +
        logs.map(function (t, i) {
          return (i + 1) + '. 问：' + t.q + '\n   答：' + t.aText;
        }).join('\n\n');
    }
    U.copyText(header + U.htmlToText(out) + logText, '本分区内容已复制');
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
  function bindTopbar() {
    U.$('#btnGotoArchive').addEventListener('click', function () { go('archive'); });
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
