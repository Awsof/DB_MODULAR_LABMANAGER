// pages/representantes.js — Fase 6
// Mudanças em relação à Fase 4:
//   - Campo `fk_supervisor` (number|null) adicionado ao schema e ao modal.
//     É o elo que torna o RLS de supervisor e gerente funcional (decisão 3B / 5B).
//   - O campo texto `supervisor` (legado) é mantido em paralelo para compatibilidade
//     com dados existentes e fallback no auth.js. Ambos são gravados simultaneamente
//     ao salvar (fk_supervisor do select + supervisor como nome para fallback).
//   - Coluna "Supervisor" na tabela exibe nome (resolvido via fk ou campo texto).
//   - Dropdown de supervisores no modal em vez de input livre.
(function (global) {
  "use strict";

  var pages = global.pages || {};
  global.pages = pages;

  // ===================== PAGE: REPRESENTANTES =====================
  pages.representantes = async function () {
    updateTopbar('Representantes', 'Gestão de representantes comerciais', `<button class="btn" id="new-rep-btn">+ Novo Representante</button>`);

    const renderPage = async (search = '', filterSup = '') => {
      const [reps, clientes, supervisores] = await Promise.all([
        dbAll('representantes'), dbAll('clientes'), dbAll('supervisores')
      ]);

      const supById   = {}; for (const s of supervisores) supById[s.id] = s;
      const supNomes  = [...new Set(reps.map(r => resolveSupNome(r, supById)).filter(Boolean))].sort();

      const repCount  = {};
      for (const c of clientes) if (c.fk_representante) repCount[c.fk_representante] = (repCount[c.fk_representante] || 0) + 1;

      let filtered = reps.filter(r => {
        const nome   = resolveSupNome(r, supById) || '';
        const ok     = !search    || r.nome.toLowerCase().includes(search.toLowerCase());
        const supOk  = !filterSup || nome === filterSup;
        return ok && supOk;
      });

      const repContainer = document.getElementById('rep-list');
      if (!repContainer) return;

      const editable = canBtn('representantes', 'edit-btn');

      const renderRepRow = r => {
        const count   = repCount[r.id] || 0;
        const supNome = resolveSupNome(r, supById) || '—';
        return `<tr>
          <td><strong>${r.nome}</strong></td>
          <td style="font-size:12px;color:var(--text2)">${supNome}</td>
          <td>${r.uf || '—'}</td>
          <td>${r.telefone || '—'}</td>
          <td>${r.email || '—'}</td>
          <td><span class="badge rep">${count} cliente${count !== 1 ? 's' : ''}</span></td>
          <td><div style="display:flex;gap:6px">
            ${editable ? `<button class="btn sm secondary" data-edit-rep="${r.id}">Editar</button>` : ''}
            ${(count === 0 && editable) ? `<button class="btn sm danger" data-del-rep="${r.id}">Excluir</button>` : ''}
          </div></td>
        </tr>`;
      };

      repContainer.innerHTML = filtered.length === 0
        ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text3)">Nenhum representante encontrado</td></tr>`
        : filtered.map(renderRepRow).join('');

      const thead = repContainer.closest('table')?.querySelector('thead');
      if (thead) makeSortable(thead, repContainer, filtered, [
        { getValue: r => r.nome },
        { getValue: r => resolveSupNome(r, supById) || '' },
        { getValue: r => r.uf || '' },
        { getValue: r => r.telefone || '' },
        { getValue: r => r.email || '' },
        { getValue: r => repCount[r.id] || 0 },
      ], renderRepRow);

      repContainer.querySelectorAll('[data-edit-rep]').forEach(btn => {
        btn.addEventListener('click', () => openRepModal(parseInt(btn.dataset.editRep), renderPage, search, filterSup));
      });
      repContainer.querySelectorAll('[data-del-rep]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Excluir este representante?')) return;
          await dbDelete('representantes', parseInt(btn.dataset.delRep));
          await auditLog('Excluiu representante', btn.dataset.delRep);
          toast('Representante excluído.', 'info');
          renderPage(search, filterSup);
        });
      });
    };

    document.getElementById('content').innerHTML = `
      <div class="toolbar">
        <div class="search-wrap">
          <span class="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></span>
          <input type="text" placeholder="Buscar por nome..." id="rep-search">
        </div>
        <select id="rep-sup-filter"><option value="">Todos os supervisores</option></select>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th data-sort="0">Nome</th>
              <th data-sort="1">Supervisor</th>
              <th data-sort="2">UF</th>
              <th data-sort="3">Telefone</th>
              <th data-sort="4">E-mail</th>
              <th data-sort="5">Clientes</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="rep-list"></tbody>
        </table>
      </div>
    `;

    await renderPage();

    // Popula filtro de supervisores com os nomes únicos dos reps
    const repsAll = await dbAll('representantes');
    const supsAll = await dbAll('supervisores');
    const supById = {}; for (const s of supsAll) supById[s.id] = s;
    const supNomesUniq = [...new Set(repsAll.map(r => resolveSupNome(r, supById)).filter(Boolean))].sort();
    const supSel = document.getElementById('rep-sup-filter');
    supNomesUniq.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      supSel.appendChild(o);
    });

    document.getElementById('rep-search').addEventListener('input', e => renderPage(e.target.value, supSel.value));
    supSel.addEventListener('change', () => renderPage(document.getElementById('rep-search').value, supSel.value));
    document.getElementById('new-rep-btn').addEventListener('click', () => openRepModal(null, renderPage));
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  /**
   * Resolve o nome do supervisor de um representante.
   * Prioridade: fk_supervisor (busca pelo id na store) → campo texto `supervisor` (legado).
   */
  function resolveSupNome(r, supById) {
    if (r.fk_supervisor && supById[r.fk_supervisor]) return supById[r.fk_supervisor].nome;
    return r.supervisor || null;
  }

  // ── openRepModal ──────────────────────────────────────────────────────────────
  async function openRepModal(id, refresh, search = '', filterSup = '') {
    const [rep, supervisores] = await Promise.all([
      id ? dbGet('representantes', id) : Promise.resolve(null),
      dbAll('supervisores'),
    ]);

    const isNew = !rep;
    const data  = rep || { nome: '', fk_supervisor: null, supervisor: '', uf: '', telefone: '', email: '' };

    // Constrói dropdown de supervisores
    // Pré-seleciona por fk_supervisor se existir; fallback por nome para registros legados
    const supervisoresOpts = `<option value="">— Nenhum —</option>` +
      supervisores
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map(s => {
          const selected = data.fk_supervisor
            ? s.id === data.fk_supervisor
            : s.nome === data.supervisor;
          return `<option value="${s.id}" data-nome="${s.nome}" ${selected ? 'selected' : ''}>${s.nome}${s.uf ? ' · ' + s.uf : ''}</option>`;
        })
        .join('');

    const overlay = openModal(`
      <div class="modal-header">
        <div class="modal-title">${isNew ? 'Novo Representante' : 'Editar Representante'}</div>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="field-group">
          <div class="field-label">Nome *</div>
          <input type="text" id="rep-nome" value="${data.nome}">
        </div>
        <div class="field-group">
          <div class="field-label">Supervisor</div>
          <select id="rep-sup">${supervisoresOpts}</select>
        </div>
        <div class="two-col">
          <div class="field-group">
            <div class="field-label">UF</div>
            <input type="text" id="rep-uf" value="${data.uf || ''}" maxlength="2">
          </div>
          <div class="field-group">
            <div class="field-label">Telefone</div>
            <input type="tel" id="rep-tel" value="${data.telefone || ''}">
          </div>
        </div>
        <div class="field-group">
          <div class="field-label">E-mail</div>
          <input type="email" id="rep-email" value="${data.email || ''}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn" id="save-rep">Salvar</button>
      </div>
    `);

    overlay.querySelector('#save-rep').addEventListener('click', async () => {
      const nome = overlay.querySelector('#rep-nome').value.trim();
      if (!nome) { toast('Nome obrigatório.', 'error'); return; }

      const supSel     = overlay.querySelector('#rep-sup');
      const supId      = supSel.value ? parseInt(supSel.value) : null;
      const supNome    = supSel.value
        ? (supSel.options[supSel.selectedIndex]?.dataset.nome || '')
        : '';

      const record = {
        nome,
        fk_supervisor: supId,    // FK numérica — base do RLS (Fase 6)
        supervisor:    normalizeSupervisor(supNome), // campo texto — fallback legado
        uf:       overlay.querySelector('#rep-uf').value.trim().toUpperCase(),
        telefone: overlay.querySelector('#rep-tel').value.trim(),
        email:    overlay.querySelector('#rep-email').value.trim(),
      };
      if (!isNew) record.id = id;

      await (isNew ? dbAdd : dbPut)('representantes', record);
      await auditLog(isNew ? 'Criou representante' : 'Editou representante', record.nome);
      toast(isNew ? 'Representante criado.' : 'Representante atualizado.', 'success');
      closeModal();
      refresh(search, filterSup);
    });
  }

})(window);
