/* ==========================================================================
 * markdown.js — 迷你 Markdown 渲染器（日志页渲染 README 用）
 * 先整体转义 HTML，再按块级规则转换，避免 XSS。
 * 支持：标题 / 代码块 / 行内代码 / 粗体 / 斜体 / 链接 / 图片 /
 *       无序·有序列表 / 表格 / 引用 / 分隔线
 * ========================================================================== */
(function () {
  'use strict';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }

  function renderTable(lines) {
    const rows = lines.map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
    const [head, sep, ...body] = rows;
    if (!sep || !sep.length || !sep.every(c => /^:?-{2,}:?$/.test(c))) return null;
    let html = '<table><thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
    for (const r of body) {
      html += '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
    }
    return html + '</tbody></table>';
  }

  function render(src) {
    const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let i = 0;
    let listStack = []; // {tag, tight}

    const closeLists = (depth) => {
      while (listStack.length > depth) {
        html += '</' + listStack.pop() + '>';
      }
    };

    while (i < lines.length) {
      const line = lines[i];

      // 代码块
      const fence = line.match(/^```(.*)$/);
      if (fence) {
        closeLists(0);
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++; // 跳过结束围栏
        html += '<pre><code>' + esc(buf.join('\n')) + '</code></pre>';
        continue;
      }

      // 空行
      if (/^\s*$/.test(line)) { i++; continue; }

      // 表格（连续两行：表头 + 分隔行）
      if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
        closeLists(0);
        const block = [line, lines[i + 1]];
        i += 2;
        while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) { block.push(lines[i]); i++; }
        const table = renderTable(block);
        if (table) html += table;
        continue;
      }

      // 标题
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        closeLists(0);
        const level = h[1].length;
        html += `<h${level}>${inline(h[2])}</h${level}>`;
        i++; continue;
      }

      // 分隔线
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
        closeLists(0);
        html += '<hr>'; i++; continue;
      }

      // 引用
      if (/^\s*>\s?/.test(line)) {
        closeLists(0);
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        html += '<blockquote>' + buf.map(inline).join('<br>') + '</blockquote>';
        continue;
      }

      // 无序 / 有序列表
      const ul = line.match(/^\s*[-*+]\s+(.*)$/);
      const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ul || ol) {
        const tag = ul ? 'ul' : 'ol';
        if (!listStack.length) { html += `<${tag}>`; listStack.push(tag); }
        else if (listStack[listStack.length - 1] !== tag) { html += `</${listStack.pop()}><${tag}>`; listStack.push(tag); }
        html += `<li>${inline((ul || ol)[1])}</li>`;
        i++;
        while (i < lines.length && /^\s*$/.test(lines[i])) i++; // 略过列表内空行
        continue;
      }
      closeLists(0);

      // 普通段落（合并连续行）
      const buf = [line];
      i++;
      while (i < lines.length && !/^\s*$/.test(lines[i])
        && !/^(#{1,4})\s/.test(lines[i]) && !/^```/.test(lines[i])
        && !/^\s*[-*+]\s/.test(lines[i]) && !/^\s*\d+[.)]\s/.test(lines[i])
        && !/^\s*>\s?/.test(lines[i]) && !/^\s*(-{3,}|\*{3,})\s*$/.test(lines[i])) {
        buf.push(lines[i]); i++;
      }
      html += '<p>' + buf.map(inline).join('<br>') + '</p>';
    }
    closeLists(0);
    return html;
  }

  window.PFXMarkdown = { render };
})();
