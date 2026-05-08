// pages/supervisores.js — Fase 6
// Mudanças em relação à Fase 4:
//   - Campo texto `gerente` adicionado ao schema e ao modal (decisão 2B).
//     O campo é usado pelo RLS do gerente via getScopeForGerente() em auth.js.
//   - Dropdown de gerentes no modal (carregado de dbAll('gerentes')).
//   - Coluna "Gerente" na tabela.
//   - Exclusão sem auditoria substituída por dbDeleteLogged para consistência.
(function (global) {
  "use strict";

  var pages = global.pages || {};
  global.pages = pages;

  // ===================== PAGE: SUPERVISORES =====================
  pages.supervisores = async function () {
    updateTopbar('Supervisores', 'Gestão de supervisores comerciais', `<button class="btn" id="new-sup-btn">+ Novo Supervisor</button>`);

    const renderSupervisores = async (search = '') => {
      const [supervisores, reps, gerentes] = await Promise.all([
        dbAll('supervisores'), dbAll('representantes'), dbAll('gerentes')
      ]);

      // Mapa nome → id para exibição
      const gerenteByNome = {};
      for (const g of gerentes) gerenteByNome[g.nome] = g;

      // Contar representantes vinculados por supervisor (campo texto + fk_supervisor)
      const repCount = {};
      for (const r of reps) {
        // Prioridade: fk_supervisor (FK numérica); fallback: campo texto `supervisor`
        const supKey = r.fk_supervisor
          ? supervisores.find(s => s.id === r.fk_supervisor)?.nome
          : r.supervisor;
        if (supKey) repCount[supKey] = (repCount[supKey] || 0) + 1;
      }

      let filtered = supervisores.filter(s =>
        !search || s.nome.toLowerCase().includes(search.toLowerCase())
      );

      const tbody = document.getElementById('sup-list');
      if (!tbody) return;

      const editable = canBtn('supervisores', 'edit-btn');

      const renderSupRow = s => {
        const count       = repCount[s.nome] || 0;
        const gerenteInfo = s.gerente || '—';
        return `<tr>
          <td><span style="font-family:var(--mono);font-size:11px;color:var(--text3)">#${s.id}</span></td>
          <td><strong>${s.nome}</strong></td>
          <td>${s.uf || '—'}</td>
          <td>${s.email || '—'}</td>
          <td style="font-size:12px;color:var(--text2)">${gerenteInfo}</td>
          <td><span class="badge rep">${count} representante${count !== 1 ? 's' : ''}</span></td>
          <td><div style="display:flex;gap:6px">
            ${editable ? `<button class="btn sm secondary" data-edit-sup="${s.id}">Editar</button>` : ''}
            ${(count === 0 && editable) ? `<button class="btn sm danger" data-del-sup="${s.id}">Excluir</button>` : ''}
          </div></td>
        </tr>`;
      };

      tbody.innerHTML = filtered.length === 0
        ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text3)">Nenhum supervisor encontrado</td></tr>`
        : filtered.map(renderSupRow).join('');

      const thead = tbody.closest('table')?.querySelector('thead');
      if (thead) makeSortable(thead, tbody, filtered, [
        { getValue: s => s.id },
        { getValue: s => s.nome },
        { getValue: s => s.uf || '' },
        { getValue: s => s.email || '' },
        { getValue: s => s.gerente || '' },
        { getValue: s => repCount[s.nome] || 0 },
      ], renderSupRow);

      tbody.querySelectorAll('[data-edit-sup]').forEach(btn => {
        btn.addEventListener('click', () => openSupModal(parseInt(btn.dataset.editSup), renderSupervisores, search));
      });
      tbody.querySelectorAll('[data-del-sup]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Excluir este supervisor?')) return;
          const id = parseInt(btn.dataset.delSup);
          await dbDelete('supervisores', id);
          await auditLog('Excluiu supervisor', String(id));
          toast('Supervisor excluído.', 'info');
          renderSupervisores(search);
        });
      });
    };

    document.getElementById('content').innerHTML = `
      <div class="toolbar">
        <div class="search-wrap">
          <span class="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></span>
          <input type="text" placeholder="Buscar por nome..." id="sup-search">
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th data-sort="0">ID</th>
              <th data-sort="1">Nome</th>
              <th data-sort="2">UF</th>
              <th data-sort="3">E-mail</th>
              <th data-sort="4">Gerente</th>
              <th data-sort="5">Representantes</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="sup-list"></tbody>
        </table>
      </div>
    `;

    await renderSupervisores();
    document.getElementById('sup-search').addEventListener('input', e => renderSupervisores(e.target.value));
    document.getElementById('new-sup-btn').addEventListener('click', () => openSupModal(null, renderSupervisores));
  };

  // ── openSupModal ──────────────────────────────────────────────────────────────
  async function openSupModal(id, refresh, search = '') {
    const [sup, gerentes] = await Promise.all([
      id ? dbGet('supervisores', id) : Promise.resolve(null),
      dbAll('gerentes'),
    ]);

    const isNew = !sup;
    const data  = sup || { nome: '', uf: '', email: '', gerente: '' };

    const gerentesOpts = `<option value="">— Nenhum —</option>` +
      gerentes
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map(g => `<option value="${g.nome}" ${data.gerente === g.nome ? 'selected' : ''}>${g.nome}</option>`)
        .join('');

    const overlay = openModal(`
      <div class="modal-header">
        <div class="modal-title">${isNew ? 'Novo Supervisor' : 'Editar Supervisor'}</div>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="field-group">
          <div class="field-label">Nome *</div>
          <input type="text" id="sup-nome" value="${data.nome}">
        </div>
        <div class="two-col">
          <div class="field-group">
            <div class="field-label">UF</div>
            <input type="text" id="sup-uf" value="${data.uf || ''}" maxlength="2">
          </div>
          <div class="field-group">
            <div class="field-label">E-mail</div>
            <input type="email" id="sup-email" value="${data.email || ''}">
          </div>
        </div>
        <div class="field-group">
          <div class="field-label">Gerente Responsável</div>
          <select id="sup-gerente">${gerentesOpts}</select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn" id="save-sup">Salvar</button>
      </div>
    `);

    overlay.querySelector('#save-sup').addEventListener('click', async () => {
      const nome = overlay.querySelector('#sup-nome').value.trim();
      if (!nome) { toast('Nome obrigatório.', 'error'); return; }

      const record = {
        nome,
        uf:      overlay.querySelector('#sup-uf').value.trim().toUpperCase(),
        email:   overlay.querySelector('#sup-email').value.trim(),
        gerente: overlay.querySelector('#sup-gerente').value || null,
      };
      if (!isNew) record.id = id;

      await (isNew ? dbAdd : dbPut)('supervisores', record);
      await auditLog(isNew ? 'Criou supervisor' : 'Editou supervisor', record.nome);
      toast(isNew ? 'Supervisor criado.' : 'Supervisor atualizado.', 'success');
      closeModal();
      refresh(search);
    });
  }

})(window);
