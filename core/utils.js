/**
 * core/utils.js — Utilitários compartilhados
 *
 * Responsabilidades:
 *  - Sistema de notificações toast
 *  - Gerenciamento de modais (openModal / closeModal)
 *  - Ordenação de tabelas por coluna (makeSortable)
 *  - Geração de relatórios HTML em nova aba (generateReport)
 *  - Helpers de domínio sem dependência de banco: normalizeSupervisor,
 *    programaBadge, getIntStatus, getIntStatusLabel, renderIntStatusBadge
 *
 * Padrão de exportação: ES Module (export nomeado) + exposição window.*
 *   para compatibilidade com chamadas inline nas páginas ainda não modularizadas.
 *
 * Dependências externas: nenhuma (zero imports)
 *
 * Referências de regras de negócio: DB_LAB_MANAGER_PROJECT.md §2.2, §2.5
 */

// ── Toast ─────────────────────────────────────────────────────────────────────

/**
 * Exibe uma notificação flutuante no canto inferior direito.
 * @param {string} msg        — Mensagem a exibir
 * @param {'info'|'success'|'error'} [type='info'] — Tipo visual
 * @param {number} [duration=4000] — Duração em ms
 */
export function toast(msg, type = 'info', duration = 4000) {
  const el = document.createElement('div');
  el.className   = `toast-item ${type}`;
  el.textContent = msg;
  document.getElementById('toast').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

/**
 * Abre um modal centralizado com o HTML fornecido.
 * Clicar no overlay (fora do modal) o fecha automaticamente.
 *
 * @param {string}   html      — Conteúdo HTML interno do modal
 * @param {Function} [onClose] — Callback chamado ao fechar pelo overlay
 * @returns {HTMLElement} overlay — Elemento do overlay (útil para buscar inputs internos)
 */
export function openModal(html, onClose) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { overlay.remove(); if (onClose) onClose(); }
  });
  document.getElementById('modal-container').appendChild(overlay);
  return overlay;
}

/**
 * Fecha o modal atualmente aberto (o mais recente no DOM).
 */
export function closeModal() {
  document.querySelector('.modal-overlay')?.remove();
}

// ── makeSortable ──────────────────────────────────────────────────────────────

// Estado interno de ordenação por tbody: { [tbodyId]: { colIdx, asc } }
const _sortState = {};

/**
 * Torna os cabeçalhos de uma tabela clicáveis para ordenação.
 *
 * Uso:
 *   makeSortable(theadEl, tbodyEl, rows, columns, renderRowFn)
 *
 * @param {HTMLElement}  thead    — Elemento <thead>
 * @param {HTMLElement}  tbody    — Elemento <tbody> (com id único recomendado)
 * @param {any[]}        rows     — Array de dados originais
 * @param {Array<{getValue: Function}>} columns — Mapeamento colIdx → getValue(row)
 * @param {Function}     renderFn — row => string HTML de uma <tr>
 */
export function makeSortable(thead, tbody, rows, columns, renderFn) {
  const ths = thead.querySelectorAll('th[data-sort]');
  ths.forEach(th => {
    th.style.cursor     = 'pointer';
    th.style.userSelect = 'none';
    th.title            = 'Clique para ordenar';
    th.addEventListener('click', () => {
      const colIdx = parseInt(th.dataset.sort);
      const col    = columns[colIdx];
      if (!col) return;

      const id   = tbody.id || 'tbl';
      const prev = _sortState[id];
      const asc  = (prev?.colIdx === colIdx) ? !prev.asc : true;
      _sortState[id] = { colIdx, asc };

      // Atualiza indicadores visuais nos cabeçalhos
      ths.forEach(t => { t.dataset.sortDir = ''; });
      th.dataset.sortDir = asc ? 'asc' : 'desc';

      // Ordena e re-renderiza
      const sorted = [...rows].sort((a, b) => {
        const va = col.getValue(a) ?? '';
        const vb = col.getValue(b) ?? '';
        const cmp = (typeof va === 'number' && typeof vb === 'number')
          ? va - vb
          : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });
        return asc ? cmp : -cmp;
      });
      tbody.innerHTML = sorted.map(renderFn).join('');
    });
  });
}

// ── generateReport ────────────────────────────────────────────────────────────

/**
 * Gera um relatório HTML completo e o abre em uma nova aba do navegador.
 * A URL do Blob é revogada automaticamente após 30 segundos.
 *
 * @param {string} title    — Título do relatório
 * @param {string} subtitle — Subtítulo / descrição
 * @param {Array<{heading: string, headers: string[], rows: any[][]}>} sections
 */
export function generateReport(title, subtitle, sections) {
  const now = new Date().toLocaleString('pt-BR');

  let html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 32px; color: #1a2433; background: #f4f6f8; }
    h1   { color: #003761; font-size: 22px; margin-bottom: 4px; }
    .sub { font-size: 13px; color: #8a96a8; margin-bottom: 28px; }
    .section       { margin-bottom: 32px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,55,97,.08); }
    .section-head  { background: #003761; color: white; padding: 10px 16px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    table          { width: 100%; border-collapse: collapse; }
    thead th       { background: #eef1f5; color: #4a5568; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 8px 14px; text-align: left; border-bottom: 2px solid #d4dbe6; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    tbody td       { padding: 8px 14px; font-size: 12px; color: #4a5568; border-bottom: 1px solid #e4e8ef; }
    tbody td strong{ color: #1a2433; }
    .footer        { font-size: 11px; color: #8a96a8; margin-top: 24px; text-align: center; }
    @media print   { body { background: white; } .section { box-shadow: none; } }
  </style></head><body>
  <h1>${title}</h1>
  <div class="sub">${subtitle} — Gerado em ${now}</div>`;

  for (const sec of sections) {
    html += `<div class="section">
      <div class="section-head">${sec.heading}</div>
      <table>
        <thead><tr>${sec.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${sec.rows.map(row =>
          `<tr>${row.map(cell => `<td>${cell ?? '—'}</td>`).join('')}</tr>`
        ).join('')}</tbody>
      </table>
    </div>`;
  }

  html += `<div class="footer">DB Lab Manager · Diagnósticos do Brasil · ${now}</div></body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) win.focus();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// ── normalizeSupervisor ───────────────────────────────────────────────────────

/**
 * Normaliza o nome do supervisor removendo o prefixo de região.
 *
 * Entrada:  "SP/INTERIOR - Maria Souza"  ou  "RAFAELLA AOKI"
 * Saída:    "Maria Souza"                ou  "Rafaella Aoki"
 *
 * Regra: se houver " - " no string, usa apenas o trecho após o último " - ".
 * Em seguida converte para Title Case.
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeSupervisor(raw) {
  if (!raw) return '';
  const cleaned = raw.includes(' - ')
    ? raw.split(' - ').pop().trim()
    : raw.trim();
  // Title Case
  return cleaned.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ── programaBadge ─────────────────────────────────────────────────────────────

/**
 * Gera o HTML do badge visual para os programas especiais Esmeralda e Chivor.
 *
 * - Esmeralda → badge verde-água
 * - Chivor    → badge roxo
 *
 * Ref: DB_LAB_MANAGER_PROJECT.md §2.5
 *
 * @param {string|null} cat — 'Esmeralda' | 'Chivor' | null
 * @returns {string} HTML do badge ou string vazia
 */
export function programaBadge(cat) {
  if (!cat) return '';
  if (cat === 'Esmeralda') {
    return `<span style="font-size:11px;padding:2px 9px;border-radius:10px;font-weight:700;
      background:rgba(15,155,148,.13);color:var(--accent2);border:1px solid rgba(15,155,148,.3);
      letter-spacing:.3px">Esmeralda</span>`;
  }
  // Chivor — roxo bem distinto
  return `<span style="font-size:11px;padding:2px 9px;border-radius:10px;font-weight:700;
    background:rgba(108,92,231,.14);color:#7c3aed;border:1px solid rgba(108,92,231,.35);
    letter-spacing:.3px">Chivor</span>`;
}

// ── getIntStatus / getIntStatusLabel / renderIntStatusBadge ───────────────────

/**
 * Calcula o status de integração de um laboratório com base em seus chamados.
 *
 * Regras (em ordem de prioridade):
 *  - 'none'     → Nenhum chamado registrado
 *  - 'active'   → Pelo menos um chamado com integracaoAtiva = true
 *  - 'impl'     → Chamados existem, mas nenhum com dataFinalizacao preenchida
 *  - 'inactive' → Todos os chamados estão finalizados e integracaoAtiva = false
 *
 * Ref: DB_LAB_MANAGER_PROJECT.md §2.2
 *
 * @param {object[]} chs — Array de chamados do laboratório
 * @returns {'none'|'active'|'impl'|'inactive'}
 */
export function getIntStatus(chs) {
  if (!chs || chs.length === 0) return 'none';
  const ativos = chs.filter(ch => ch.integracaoAtiva);
  if (ativos.length > 0) return 'active';
  const semFim = chs.filter(ch => !ch.dataFinalizacao);
  if (semFim.length > 0) return 'impl';
  return 'inactive';
}

/**
 * Retorna o rótulo legível em português para um status de integração.
 * @param {'none'|'active'|'impl'|'inactive'} status
 * @returns {string}
 */
export function getIntStatusLabel(status) {
  return {
    none:     'Sem Integração',
    inactive: 'Integração Inativada',
    active:   'Integrado',
    impl:     'Em Implantação',
  }[status] || '—';
}

/**
 * Gera o HTML do badge visual de status de integração.
 * Usa as classes CSS `.int-status` + modificador definidas no CSS global.
 *
 * @param {'none'|'active'|'impl'|'inactive'} status
 * @returns {string}
 */
export function renderIntStatusBadge(status) {
  return `<span class="int-status ${status}"><span class="int-status-dot"></span>${getIntStatusLabel(status)}</span>`;
}

// ── Exposição global para compatibilidade ─────────────────────────────────────
// As páginas ainda no index.html chamam estas funções diretamente no escopo
// global. Ao expor via window, garantimos que continuem funcionando durante
// a migração incremental sem alterar o código de cada página.
window.toast                  = toast;
window.openModal              = openModal;
window.closeModal             = closeModal;
window.makeSortable           = makeSortable;
window.generateReport         = generateReport;
window.normalizeSupervisor    = normalizeSupervisor;
window.programaBadge          = programaBadge;
window.getIntStatus           = getIntStatus;
window.getIntStatusLabel      = getIntStatusLabel;
window.renderIntStatusBadge   = renderIntStatusBadge;
