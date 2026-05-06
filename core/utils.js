/**
 * core/utils.js — Utilitários compartilhados
 *
 * FIXES aplicados:
 *  1. openModal() e closeModal() em utils.js não devem chamar openModal
 *     diretamente — elas SÃO a implementação legada. Como db-modal.js
 *     sobrescreve window.openModal após utils.js, as funções abaixo nunca
 *     são chamadas em runtime. Mantidas apenas como fallback seguro.
 *  2. updateTopbar() exposta via window.* para que pages/*.js a encontrem.
 *  3. toast() delegada para window.toast (que db-toast.js sobrescreve).
 *     A definição local é apenas fallback — db-toast.js sempre vence por
 *     ordem de carregamento.
 */
(function (global) {
  'use strict';

  // ── Toast ─────────────────────────────────────────────────────────────────
  // Definição fallback — db-toast.js sobrescreve window.toast após este arquivo.
  function toast(msg, type, duration) {
    type     = type     || 'info';
    duration = duration || 4000;
    var toastEl = document.getElementById('toast');
    if (toastEl && typeof toastEl.show === 'function') {
      // db-toast Web Component já disponível
      toastEl.show(msg, type, duration);
      return;
    }
    // Fallback visual simples caso o componente não esteja pronto
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;' +
      'background:#fff;border:1px solid #d4dbe6;border-radius:6px;' +
      'padding:12px 16px;font-size:13px;box-shadow:0 8px 32px rgba(0,55,97,.15);' +
      'border-left:3px solid ' + (type==='success'?'#0F9B94':type==='error'?'#d63031':'#004a80');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, duration);
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  // Implementação fallback — db-modal.js sobrescreve window.openModal/closeModal.
  // Esta versão só seria chamada se db-modal.js não estiver no DOM.
  function openModal(html, onClose) {
    var modalComp = document.getElementById('modal');
    if (modalComp && typeof modalComp.open === 'function') {
      modalComp.open(html, onClose);
      return modalComp._lightContainer || modalComp;
    }
    // Fallback legado (sem db-modal.js no DOM)
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,55,97,.48);' +
      'z-index:200;display:flex;align-items:center;justify-content:center;padding:24px';
    var win = document.createElement('div');
    win.style.cssText = 'background:#fff;border-radius:10px;width:100%;max-width:680px;' +
      'max-height:88vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,55,97,.22)';
    win.innerHTML = html;
    overlay.appendChild(win);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) { overlay.remove(); if (onClose) onClose(); }
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeModal() {
    var modalComp = document.getElementById('modal');
    if (modalComp && typeof modalComp.close === 'function') {
      modalComp.close();
      return;
    }
    var el = document.querySelector('.modal-overlay');
    if (el) el.remove();
  }

  // ── makeSortable ──────────────────────────────────────────────────────────
  var _sortState = {};

  function makeSortable(thead, tbody, rows, columns, renderFn) {
    var ths = thead.querySelectorAll('th[data-sort]');
    ths.forEach(function (th) {
      th.style.cursor     = 'pointer';
      th.style.userSelect = 'none';
      th.title            = 'Clique para ordenar';
      th.addEventListener('click', function () {
        var colIdx = parseInt(th.dataset.sort);
        var col    = columns[colIdx];
        if (!col) return;
        var id   = tbody.id || 'tbl';
        var prev = _sortState[id];
        var asc  = (prev && prev.colIdx === colIdx) ? !prev.asc : true;
        _sortState[id] = { colIdx: colIdx, asc: asc };
        ths.forEach(function (t) { t.dataset.sortDir = ''; });
        th.dataset.sortDir = asc ? 'asc' : 'desc';
        var sorted = Array.from(rows).sort(function (a, b) {
          var va = col.getValue(a);
          var vb = col.getValue(b);
          if (va == null) va = '';
          if (vb == null) vb = '';
          var cmp = (typeof va === 'number' && typeof vb === 'number')
            ? va - vb
            : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });
          return asc ? cmp : -cmp;
        });
        tbody.innerHTML = sorted.map(renderFn).join('');
      });
    });
  }

  // ── generateReport ────────────────────────────────────────────────────────
  function generateReport(title, subtitle, sections) {
    var now = new Date().toLocaleString('pt-BR');
    var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
      '<title>' + title + '</title><style>' +
      'body{font-family:"Segoe UI",sans-serif;margin:0;padding:32px;color:#1a2433;background:#f4f6f8}' +
      'h1{color:#003761;font-size:22px;margin-bottom:4px}' +
      '.sub{font-size:13px;color:#8a96a8;margin-bottom:28px}' +
      '.section{margin-bottom:32px;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,55,97,.08)}' +
      '.section-head{background:#003761;color:white;padding:10px 16px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase}' +
      'table{width:100%;border-collapse:collapse}' +
      'thead th{background:#eef1f5;color:#4a5568;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:8px 14px;text-align:left;border-bottom:2px solid #d4dbe6}' +
      'tbody tr:nth-child(even){background:#f9fafb}' +
      'tbody td{padding:8px 14px;font-size:12px;color:#4a5568;border-bottom:1px solid #e4e8ef}' +
      'tbody td strong{color:#1a2433}' +
      '.footer{font-size:11px;color:#8a96a8;margin-top:24px;text-align:center}' +
      '@media print{body{background:white}.section{box-shadow:none}}' +
      '</style></head><body>' +
      '<h1>' + title + '</h1>' +
      '<div class="sub">' + subtitle + ' — Gerado em ' + now + '</div>';

    sections.forEach(function (sec) {
      html += '<div class="section"><div class="section-head">' + sec.heading + '</div>' +
        '<table><thead><tr>' + sec.headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead>' +
        '<tbody>' + sec.rows.map(function (row) {
          return '<tr>' + row.map(function (cell) {
            return '<td>' + (cell != null ? cell : '—') + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
    });

    html += '<div class="footer">DB Lab Manager · Diagnósticos do Brasil · ' + now + '</div></body></html>';

    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var win  = window.open(url, '_blank');
    if (win) win.focus();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  // ── normalizeSupervisor ───────────────────────────────────────────────────
  function normalizeSupervisor(raw) {
    if (!raw) return '';
    var cleaned = raw.includes(' - ') ? raw.split(' - ').pop().trim() : raw.trim();
    return cleaned.replace(/\w\S*/g, function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
  }

  // ── programaBadge ─────────────────────────────────────────────────────────
  function programaBadge(cat) {
    if (!cat) return '';
    if (cat === 'Esmeralda') {
      return '<span style="font-size:11px;padding:2px 9px;border-radius:10px;font-weight:700;' +
        'background:rgba(15,155,148,.13);color:var(--accent2);border:1px solid rgba(15,155,148,.3);' +
        'letter-spacing:.3px">Esmeralda</span>';
    }
    return '<span style="font-size:11px;padding:2px 9px;border-radius:10px;font-weight:700;' +
      'background:rgba(108,92,231,.14);color:#7c3aed;border:1px solid rgba(108,92,231,.35);' +
      'letter-spacing:.3px">Chivor</span>';
  }

  // ── getIntStatus ──────────────────────────────────────────────────────────
  function getIntStatus(chs) {
    if (!chs || chs.length === 0) return 'none';
    var ativos = chs.filter(function (ch) { return ch.integracaoAtiva; });
    if (ativos.length > 0) return 'active';
    var semFim = chs.filter(function (ch) { return !ch.dataFinalizacao; });
    if (semFim.length > 0) return 'impl';
    return 'inactive';
  }

  function getIntStatusLabel(status) {
    var labels = {
      none:     'Sem Integração',
      inactive: 'Integração Inativada',
      active:   'Integrado',
      impl:     'Em Implantação',
    };
    return labels[status] || '—';
  }

  function renderIntStatusBadge(status) {
    return '<span class="int-status ' + status + '">' +
      '<span class="int-status-dot"></span>' +
      getIntStatusLabel(status) + '</span>';
  }

  // ── downloadModeloCSV / downloadModeloEnvioCSV ────────────────────────────
  function downloadModeloCSV() {
    var header  = 'Código,Razão Social,Nome Fantasia,CNPJ,UF,Representante,Nome Supervisor,Cód. Matriz,Matriz,Grupo';
    var example = '10001,Lab Exemplo Ltda,Lab Exemplo,12.345.678/0001-99,SP,João Silva,SP/INTERIOR - Maria Souza,,, Rede Saúde';
    var blob = new Blob([header + '\n' + example], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'modelo_importacao.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadModeloEnvioCSV() {
    var header  = 'Data_Inicial;Data_Final;Envio;Qnt Envio;Código;Nome do Cliente';
    var example = '01/04/2026 00:00:00;30/04/2026 00:00:00;DB FACIL;150;12436;LABORATORIO EXEMPLO';
    var blob = new Blob([header + '\n' + example], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'modelo_base_envio.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ── updateTopbar ──────────────────────────────────────────────────────────
  // Exposta via window.* para que pages/*.js a encontrem em runtime.
  function updateTopbar(title, subtitle, actions) {
    var topbar = document.getElementById('topbar');
    if (!topbar) return;
    if (title    !== undefined) topbar.title    = title;
    if (subtitle !== undefined) topbar.subtitle = subtitle;
    if (actions  !== undefined) {
      // Remove slot de actions anterior
      var existing = topbar.querySelector('[slot="actions"]');
      if (existing) existing.remove();
      if (actions) {
        var container = document.createElement('div');
        container.setAttribute('slot', 'actions');
        container.innerHTML = actions;
        topbar.appendChild(container);
      }
    }
  }

  // ── Registro em window.* ──────────────────────────────────────────────────
  global.toast                  = toast;
  global.openModal              = openModal;
  global.closeModal             = closeModal;
  global.makeSortable           = makeSortable;
  global.generateReport         = generateReport;
  global.normalizeSupervisor    = normalizeSupervisor;
  global.programaBadge          = programaBadge;
  global.getIntStatus           = getIntStatus;
  global.getIntStatusLabel      = getIntStatusLabel;
  global.renderIntStatusBadge   = renderIntStatusBadge;
  global.downloadModeloCSV      = downloadModeloCSV;
  global.downloadModeloEnvioCSV = downloadModeloEnvioCSV;
  global.updateTopbar           = updateTopbar;

}(window));
