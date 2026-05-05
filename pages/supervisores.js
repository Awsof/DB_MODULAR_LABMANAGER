// pages/supervisores.js — Página Supervisores da Fase 4
(function (global) {
  "use strict";

  var pages = global.pages || {};
  global.pages = pages;

  // ===================== PAGE: SUPERVISORES =====================
  pages.supervisores = async function() {
    updateTopbar('Supervisores', 'Gestão de supervisores comerciais', `<button class="btn" id="new-sup-btn">+ Novo Supervisor</button>`);

    const renderSupervisores = async (search = '') => {
      const [supervisores, reps] = await Promise.all([dbAll('supervisores'), dbAll('representantes')]);

      // Contar representantes vinculados por supervisor (por nome, compatível com campo texto)
      const repCount = {};
      for (const r of reps) {
        if (r.supervisor) repCount[r.supervisor] = (repCount[r.supervisor] || 0) + 1;
      }

      let filtered = supervisores.filter(s =>
        !search || s.nome.toLowerCase().includes(search.toLowerCase())
      );

      const tbody = document.getElementById('sup-list');
      if (!tbody) return;

      const editable = canBtn('supervisores', 'edit-btn');
      const renderSupRow = s => {
        const count = repCount[s.nome] || 0;
        return `<tr>
          <td><span style="font-family:var(--mono);font-size:11px;color:var(--text3)">#${s.id}</span></td>
          <td><strong>${s.nome}</strong></td>
          <td>${s.uf || '—'}</td>
          <td>${s.email || '—'}</td>
          <td><span class="badge rep">${count} representantes</span></td>
          <td><div style="display:flex;gap:6px">
            ${editable ? `<button class="btn sm secondary" data-edit-sup="${s.id}">Editar</button>` : ''}
            ${(count === 0 && editable) ? `<button class="btn sm danger" data-del-sup="${s.id}">Excluir</button>` : ''}
          </div></td>
        </tr>`;
      };

      tbody.innerHTML = filtered.length === 0
        ? `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text3)">Nenhum supervisor encontrado</td></tr>`
        : filtered.map(renderSupRow).join('');

      const thead = tbody.closest('table')?.querySelector('thead');
      if (thead) makeSortable(thead, tbody, filtered, [
        { getValue: s => s.id },
        { getValue: s => s.nome },
        { getValue: s => s.uf || '' },
        { getValue: s => s.email || '' },
        { getValue: s => repCount[s.nome] || 0 },
      ], renderSupRow);

      tbody.querySelectorAll('[data-edit-sup]').forEach(btn => {
        btn.addEventListener('click', () => openSupModal(parseInt(btn.dataset.editSup), renderSupervisores, search));
      });
      tbody.querySelectorAll('[data-del-sup]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm('Excluir este supervisor?')) {
            await dbDelete('supervisores', parseInt(btn.dataset.delSup));
            toast('Supervisor excluído.', 'info');
            renderSupervisores(search);
          }
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
          <thead><tr><th data-sort="0">ID</th><th data-sort="1">Nome</th><th data-sort="2">UF</th><th data-sort="3">E-mail</th><th data-sort="4">Representantes</th><th>Ações</th></tr></thead>
          <tbody id="sup-list"></tbody>
        </table>
      </div>
    `;

    await renderSupervisores();
    document.getElementById('sup-search').addEventListener('input', e => renderSupervisores(e.target.value));
    document.getElementById('new-sup-btn').addEventListener('click', () => openSupModal(null, renderSupervisores));
  };

  function openSupModal(id, refresh, search = '') {
    Promise.resolve(id ? dbGet('supervisores', id) : null).then(sup => {
      const isNew = !sup;
      sup = sup || { nome:'', uf:'', email:'' };
      const overlay = openModal(`
        <div class="modal-header">
          <div class="modal-title">${isNew ? 'Novo Supervisor' : 'Editar Supervisor'}</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="field-group"><div class="field-label">Nome *</div><input type="text" id="sup-nome" value="${sup.nome}"></div>
          <div class="two-col">
            <div class="field-group"><div class="field-label">UF</div><input type="text" id="sup-uf" value="${sup.uf||''}" maxlength="2"></div>
            <div class="field-group"><div class="field-label">E-mail</div><input type="email" id="sup-email" value="${sup.email||''}"></div>
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
        const data = {
          nome,
          uf:    overlay.querySelector('#sup-uf').value.trim().toUpperCase(),
          email: overlay.querySelector('#sup-email').value.trim(),
        };
        if (!isNew) data.id = id;
        await (isNew ? dbAdd : dbPut)('supervisores', data);
        await auditLog(isNew?'Criou supervisor':'Editou supervisor', data.nome);
        toast(isNew ? 'Supervisor criado.' : 'Supervisor atualizado.', 'success');
        closeModal();
        refresh(search);
      });
    });
  }


})(window);
