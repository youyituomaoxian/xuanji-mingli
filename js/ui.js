/* =========================================================================
 * ui.js — DOM 工具 + 渲染原语 + 复制/提示
 * 依赖：tokens/components.css 的类名约定
 * ====================================================================== */
(function (global) {
  'use strict';

  var D = global.document;

  /* ---------- 选择 / 创建 ---------- */
  function $(sel, root) { return (root || D).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || D).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var n = D.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ---------- 转义 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- 结构原语（结果分层排版） ---------- */
  /* 分层：标题 → 核心总结 → 详细解读 → 运势分析 → 专属建议 */
  function sec(label, bodyHtml) {
    return '<div class="rsec">' +
      '<div class="rsec__label">' + esc(label) + '</div>' +
      '<div class="rsec__body">' + bodyHtml + '</div>' +
      '</div>';
  }
  function sum(bodyHtml) { return '<div class="rsum">' + bodyHtml + '</div>'; }
  function paras(arr) {
    return arr.map(function (p) { return '<p>' + p + '</p>'; }).join('');
  }
  function kw(text, kind) {
    return '<span class="kw' + (kind ? ' kw--' + kind : '') + '">' + esc(text) + '</span>';
  }
  function kwList(items) {
    return '<div class="kwlist">' + items.map(function (t) {
      return '<span class="kwlist__item">' + esc(t) + '</span>';
    }).join('') + '</div>';
  }
  function saying(text, src) {
    return '<div class="saying">' + esc(text) +
      (src ? '<span class="saying__src">—— ' + esc(src) + '</span>' : '') + '</div>';
  }
  function tips(items) {
    return '<div class="tips">' + items.map(function (t, i) {
      return '<div class="tip">' +
        '<span class="tip__mark">' + (i + 1) + '</span>' +
        '<div><div class="tip__title">' + esc(t.t) + '</div>' +
        (t.d ? '<div class="tip__desc">' + t.d + '</div>' : '') + '</div>' +
        '</div>';
    }).join('') + '</div>';
  }
  function kvRows(pairs) {
    return '<div class="kv">' + pairs.map(function (p) {
      return '<div class="kv__row"><div class="kv__k">' + esc(p[0]) + '</div>' +
        '<div class="kv__v">' + p[1] + '</div></div>';
    }).join('') + '</div>';
  }
  function metrics(items) {
    return '<div class="metrics">' + items.map(function (m) {
      return '<div class="metric">' +
        '<div class="metric__k">' + esc(m.k) + '</div>' +
        '<div class="metric__v">' + m.v + '</div>' +
        (m.sub ? '<div class="metric__sub">' + esc(m.sub) + '</div>' : '') +
        '</div>';
    }).join('') + '</div>';
  }
  function table(headers, rows) {
    return '<table class="table"><thead><tr>' +
      headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + r.map(function (c) {
          return '<td>' + (c == null ? '' : c) + '</td>';
        }).join('') + '</tr>';
      }).join('') +
      '</tbody></table>';
  }
  function emptyState(mark, text, sub) {
    return '<div class="empty">' +
      '<div class="empty__mark">' + esc(mark) + '</div>' +
      '<div class="empty__text">' + esc(text) + '</div>' +
      (sub ? '<div class="empty__sub">' + esc(sub) + '</div>' : '') +
      '</div>';
  }
  function tag(text, kind) {
    return '<span class="tag tag--' + (kind || 'plain') + '">' + esc(text) + '</span>';
  }
  function wxBar(name, val, max, color) {
    var pct = max > 0 ? Math.round(val / max * 100) : 0;
    return '<div class="wxbar">' +
      '<div class="wxbar__name">' + esc(name) + '</div>' +
      '<div class="wxbar__track"><div class="wxbar__fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '<div class="wxbar__val">' + val + '</div>' +
      '</div>';
  }

  /* ---------- 轻提示 ---------- */
  var toastBox = null;
  function toast(msg, kind) {
    if (!toastBox) {
      toastBox = el('div');
      toastBox.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none';
      D.body.appendChild(toastBox);
    }
    var t = el('div', null,
      '<span style="display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:8px;' +
      'background:' + (kind === 'fail' ? 'rgba(168,68,58,0.94)' : (kind === 'ok' ? 'rgba(74,124,89,0.94)' : 'rgba(30,53,64,0.93)')) +
      ';color:#f5f3ee;font-size:13px;box-shadow:0 6px 26px rgba(30,53,64,0.18);letter-spacing:0.01em">' +
      esc(msg) + '</span>');
    t.style.cssText = 'opacity:0;transform:translateY(8px);transition:opacity .22s,transform .22s';
    toastBox.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
    setTimeout(function () {
      t.style.opacity = '0'; t.style.transform = 'translateY(8px)';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 240);
    }, 2000);
  }

  /* ---------- 复制 ---------- */
  function copyText(text, okMsg) {
    function fallback() {
      var ta = el('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
      D.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = D.execCommand('copy'); } catch (e) { ok = false; }
      D.body.removeChild(ta);
      return ok;
    }
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      return global.navigator.clipboard.writeText(text).then(function () {
        toast(okMsg || '已复制到剪贴板', 'ok'); return true;
      }).catch(function () {
        var ok = fallback();
        toast(ok ? (okMsg || '已复制到剪贴板') : '复制失败，请手动选择文本', ok ? 'ok' : 'fail');
        return ok;
      });
    }
    var ok = fallback();
    toast(ok ? (okMsg || '已复制到剪贴板') : '复制失败，请手动选择文本', ok ? 'ok' : 'fail');
    return Promise.resolve(ok);
  }

  /* ---------- 下载 ---------- */
  function download(filename, text) {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a');
    a.href = url; a.download = filename;
    D.body.appendChild(a); a.click();
    setTimeout(function () { D.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  /* ---------- HTML 转纯文本（复制用） ---------- */
  /* 目标：把结果区的分层 HTML 转成结构清晰的纯文本。
     关键约束：
       1) 块级元素（div/p/li/tr/h1-6）换行；
       2) 内联元素（span/strong/em/b/i/a/code 等）必须**续接**到当前行，
          否则 <span class="kw">戊（土）</span> 会被拆成独立行，句子被割裂；
       3) 段落标题统一转成【标题】标记，便于粘贴后仍保留层次。 */
  var BLOCK_TAGS = /^(DIV|P|LI|UL|OL|SECTION|ARTICLE|HEADER|FOOTER|TABLE|THEAD|TBODY|TR|H[1-6]|BLOCKQUOTE|PRE|HR)$/;
  var LABEL_CLS = /rsec__label/;
  var TITLE_CLS = /card__title|pagehead__title/;
  /* 排盘四柱块：.pillars > .pillar × 4，每个 .pillar 内是多行单元格。
     纯文本里按「行标签：四柱值」转置输出，否则会被拆成单字行。 */
  var PILLAR_ROW_CLS = ['pillar__label', 'pillar__gan', 'pillar__wuxing',
                        'pillar__zhi', 'pillar__wuxing', 'pillar__shishen', 'pillar__cang'];
  var PILLAR_ROW_NAME = ['', '天干', '五行', '地支', '五行', '十神', '藏干'];

  function pillarsToLines(pillarsEl) {
    var cols = Array.prototype.slice.call(pillarsEl.querySelectorAll('.pillar'));
    if (!cols.length) return [];
    var names = cols.map(function (c) {
      var l = c.querySelector('.pillar__label');
      return l ? (l.textContent || '').trim() : '';
    });
    /* 逐「行」取值：同一行索引在每列取对应子元素文本 */
    var rowCount = PILLAR_ROW_NAME.length;
    var rows = [];
    for (var r = 1; r < rowCount; r++) {
      var vals = cols.map(function (c) {
        var kids = c.children;
        return kids[r] ? (kids[r].textContent || '').replace(/\s+/g, ' ').trim() : '';
      });
      if (vals.every(function (v) { return !v; })) continue;
      rows.push(PILLAR_ROW_NAME[r] + '：' + vals.join('  '));
    }
    return [names.filter(Boolean).join('  ')].concat(rows);
  }

  /* .kv（键值表）→ 每行「标签：值」；.metrics（指标卡）→ 每行「指标：值」 */
  function kvToLines(kvEl) {
    var rows = Array.prototype.slice.call(kvEl.querySelectorAll('.kv__row'));
    return rows.map(function (r) {
      var k = r.querySelector('.kv__k'), v = r.querySelector('.kv__v');
      var kt = k ? (k.textContent || '').trim() : '';
      var vt = v ? (v.textContent || '').replace(/\s+/g, ' ').trim() : '';
      return kt + '：' + vt;
    }).filter(function (l) { return l !== '：'; });
  }
  function metricsToLines(mEl) {
    var items = Array.prototype.slice.call(mEl.querySelectorAll('.metric'));
    return items.map(function (m) {
      var k = m.querySelector('.metric__k'), v = m.querySelector('.metric__v');
      var s = m.querySelector('.metric__sub');
      var kt = k ? (k.textContent || '').trim() : '';
      var vt = v ? (v.textContent || '').replace(/\s+/g, ' ').trim() : '';
      var st = s ? (s.textContent || '').replace(/\s+/g, ' ').trim() : '';
      return kt + '：' + vt + (st ? '（' + st + '）' : '');
    }).filter(function (l) { return l !== '：'; });
  }
  /* 五行条形图：合并成「木 0.3 / 火 0.6 / …」一行，避免竖排散列 */
  function wuxingBarsToLines(wEl) {
    var bars = Array.prototype.slice.call(wEl.querySelectorAll('.wxbar'));
    var parts = bars.map(function (b) {
      var n = b.querySelector('.wxbar__name'), v = b.querySelector('.wxbar__val');
      var nt = n ? (n.textContent || '').trim() : '';
      var vt = v ? (v.textContent || '').trim() : '';
      return nt + ' ' + vt;
    }).filter(Boolean);
    return parts.length ? ['五行力量：' + parts.join('   ')] : [];
  }
  /* tips（编号建议）：每条合并成「1. 标题——说明」 */
  function tipsToLines(tEl) {
    var tips = Array.prototype.slice.call(tEl.querySelectorAll('.tip'));
    return tips.map(function (t, i) {
      var mark = t.querySelector('.tip__mark');
      var title = t.querySelector('.tip__title');
      var desc = t.querySelector('.tip__desc');
      var mt = mark ? (mark.textContent || '').trim() : String(i + 1);
      var tt = title ? (title.textContent || '').trim() : '';
      var dt = desc ? (desc.textContent || '').replace(/\s+/g, ' ').trim() : '';
      return mt + '. ' + tt + (dt ? '——' + dt : '');
    }).filter(Boolean);
  }
  /* kwlist（关键词标签）：合并成一行，顿号分隔 */
  function kwListToLines(kEl) {
    var items = Array.prototype.slice.call(kEl.querySelectorAll('.kwlist__item'))
      .map(function (x) { return (x.textContent || '').trim(); }).filter(Boolean);
    return items.length ? [items.join('、')] : [];
  }

  function htmlToText(sel) {
    var root = typeof sel === 'string' ? $(sel) : sel;
    if (!root) return '';
    /* 用行缓冲：块级元素结束才落行，内联元素直接追加 */
    var lines = [];
    var buf = '';
    function flush() {
      var s = buf.replace(/[ \t]+/g, ' ').trim();
      if (s) lines.push(s);
      buf = '';
    }
    function textOf(n) { return (n.textContent || '').replace(/\s+/g, ' ').trim(); }
    function walk(n) {
      if (n.nodeType === 3) { buf += n.textContent.replace(/\s+/g, ' '); return; }
      if (n.nodeType !== 1) return;
      var cls = (typeof n.className === 'string' ? n.className : '') || '';

      /* 排盘四柱块：整块转置成对齐的多行，避免单字断行 */
      if (n.classList && n.classList.contains('pillars')) {
        flush();
        pillarsToLines(n).forEach(function (l) { lines.push(l); });
        return;
      }
      /* 键值表 / 指标卡：合并成「标签：值」单行 */
      if (n.classList && n.classList.contains('kv')) {
        flush();
        kvToLines(n).forEach(function (l) { lines.push(l); });
        return;
      }
      if (n.classList && n.classList.contains('metrics')) {
        flush();
        metricsToLines(n).forEach(function (l) { lines.push(l); });
        return;
      }
      if (n.classList && (n.classList.contains('wuxing-bars') || n.classList.contains('wxbar'))) {
        flush();
        wuxingBarsToLines(n).forEach(function (l) { lines.push(l); });
        return;
      }
      if (n.classList && n.classList.contains('tips')) {
        flush();
        tipsToLines(n).forEach(function (l) { lines.push(l); });
        return;
      }
      if (n.classList && n.classList.contains('kwlist')) {
        flush();
        kwListToLines(n).forEach(function (l) { lines.push(l); });
        return;
      }
      /* 段落标题：独占一行，加【】标记 */
      if (LABEL_CLS.test(cls)) { flush(); lines.push('【' + textOf(n) + '】'); return; }
      if (TITLE_CLS.test(cls) || /^H[1-6]$/.test(n.tagName)) { flush(); lines.push(textOf(n)); return; }

      /* 表格行：整行拼接，单元格用 | 分隔 */
      if (n.tagName === 'TR') {
        flush();
        var cells = Array.prototype.map.call(n.children, function (td) {
          return (td.textContent || '').replace(/\s+/g, ' ').trim();
        }).filter(Boolean);
        if (cells.length) lines.push(cells.join('  |  '));
        return;
      }
      /* 分隔线 */
      if (n.tagName === 'HR') { flush(); lines.push('─'.repeat(32)); return; }

      var isBlock = BLOCK_TAGS.test(n.tagName);
      if (isBlock) flush();
      Array.prototype.forEach.call(n.childNodes, walk);
      if (isBlock) flush();
    }
    walk(root);
    flush();
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ---------- 数字/文本格式 ---------- */
  var CN_NUM = ['零','一','二','三','四','五','六','七','八','九','十'];
  function cnMonth(m) {
    if (m === 11) return '十一';
    if (m === 12) return '十二';
    return CN_NUM[m] || String(m);
  }
  function cnDay(d) {
    if (d <= 10) return d === 10 ? '初十' : '初' + CN_NUM[d];
    if (d < 20) return '十' + CN_NUM[d - 10];
    if (d === 20) return '二十';
    if (d === 30) return '三十';
    return '廿' + CN_NUM[d - 20];
  }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function fmtDate(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }
  function fmtDateTime(dt) {
    return dt.y + '-' + pad2(dt.m) + '-' + pad2(dt.d) + ' ' + pad2(dt.h) + ':' + pad2(dt.mi);
  }

  /* ---------- 五行配色（低饱和，供条形图） ---------- */
  var WX_COLOR = {
    '木': '#5f8b6b',
    '火': '#a8443a',
    '土': '#b8935a',
    '金': '#9aa3a8',
    '水': '#2f4f5f'
  };

  global.UI = {
    $: $, $$: $$, el: el, esc: esc,
    sec: sec, sum: sum, paras: paras, kw: kw, kwList: kwList,
    saying: saying, tips: tips, kvRows: kvRows, metrics: metrics,
    table: table, emptyState: emptyState, tag: tag, wxBar: wxBar,
    toast: toast, copyText: copyText, download: download,
    htmlToText: htmlToText,
    cnMonth: cnMonth, cnDay: cnDay, pad2: pad2,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime,
    WX_COLOR: WX_COLOR
  };
})(window);
