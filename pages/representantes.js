// pages/representantes.js — Página Representantes da Fase 4
(function (global) {
  "use strict";

  var pages = global.pages || {};
  global.pages = pages;

  // ===================== PAGE: REPRESENTANTES =====================
  pages.representantes = async function() {
    updateTopbar('Representantes', 'Gestão de representantes comerciais', `<button class="btn" id="new-rep-btn">+ Novo Representante</button>`);

    const renderPage = async (search = '', filterSup = '') => {
      const [reps, clientes] = await Promise.all([dbAll('representantes'), dbAll('clientes')]);
      const sups = [...new Set(reps.map(r => r.supervisor).filter(Boolean))].sort();

      const repCount = {};
      for (const c of clientes) if (c.fk_representante) repCount[c.fk_representante] = (repCount[c.fk_representante] || 0) + 1;

      let filtered = reps.filter(r => {
        const ok = !search || r.nome.toLowerCase().includes(search.toLowerCase());
        const supOk = !filterSup || r.supervisor === filterSup;
        return ok && supOk;
      });

      const repContainer = document.getElementById('rep-list');
      if (!repContainer) return;

      const editable = canBtn('representantes', 'edit-btn');
      const renderRepRow = r => {
        const count = repCount[r.id] || 0;
        return `<tr>
          <td><strong>${r.nome}</strong></td>
          <td>${r.supervisor || '—'}</td>
          <td>${r.uf || '—'}</td>
          <td>${r.telefone || '—'}</td>
          <td>${r.email || '—'}</td>
          <td><span class="badge rep">${count} clientes</span></td>
          <td><div style="display:flex;gap:6px">
            ${editable ? `<button class="btn sm secondary" data-edit-rep="${r.id}">Editar</button>` : ''}
            ${(count === 0 && editable) ? `<button class="btn sm danger" data-del-rep="${r.id}">Excluir</button>` : ''}
          </div></td>
        </tr>`;
      };

      repContainer.innerHTML = filtered.length === 0
        ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text3)">Nenhum representante encontrado</td></tr>`
        : filtered.map(renderRepRow).join('');

      // Sortable
      const thead = repContainer.closest('table')?.querySelector('thead');
      if (thead) makeSortable(thead, repContainer, filtered, [
        { getValue: r => r.nome },
        { getValue: r => r.supervisor || '' },
        { getValue: r => r.uf || '' },
        { getValue: r => r.telefone || '' },
        { getValue: r => r.email || '' },
        { getValue: r => repCount[r.id] || 0 },
      ], renderRepRow);

      // rebind events
      repContainer.querySelectorAll('[data-edit-rep]').forEach(btn => {
        btn.addEventListener('click', () => openRepModal(parseInt(btn.dataset.editRep), renderPage, search, filterSup));
      });
      repContainer.querySelectorAll('[data-del-rep]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm('Excluir este representante?')) {
            await dbDelete('representantes', parseInt(btn.dataset.delRep));
            toast('Representante excluído.', 'info');
            renderPage(search, filterSup);
          }
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
          <thead><tr><th data-sort="0">Nome</th><th data-sort="1">Supervisor</th><th data-sort="2">UF</th><th data-sort="3">Telefone</th><th data-sort="4">E-mail</th><th data-sort="5">Clientes</th><th>Ações</th></tr></thead>
          <tbody id="rep-list"></tbody>
        </table>
      </div>
    `;

    await renderPage();

    const reps = await dbAll('representantes');
    const sups = [...new Set(reps.map(r => r.supervisor).filter(Boolean))].sort();
    const supSel = document.getElementById('rep-sup-filter');
    sups.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; supSel.appendChild(o); });

    document.getElementById('rep-search').addEventListener('input', e => renderPage(e.target.value, supSel.value));
    supSel.addEventListener('change', () => renderPage(document.getElementById('rep-search').value, supSel.value));
    document.getElementById('new-rep-btn').addEventListener('click', () => openRepModal(null, renderPage));
  };

  function openRepModal(id, refresh, search = '', filterSup = '') {
    dbGet('representantes', id).then(rep => {
      const isNew = !rep;
      rep = rep || { nome: '', supervisor: '', uf: '', telefone: '', email: '' };
      const overlay = openModal(`
        <div class="modal-header">
          <div class="modal-title">${isNew ? 'Novo Representante' : 'Editar Representante'}</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="field-group"><div class="field-label">Nome *</div><input type="text" id="rep-nome" value="${rep.nome}"></div>
          <div class="field-group"><div class="field-label">Supervisor</div><input type="text" id="rep-sup" value="${rep.supervisor || ''}"></div>
          <div class="two-col">
            <div class="field-group"><div class="field-label">UF</div><input type="text" id="rep-uf" value="${rep.uf || ''}" maxlength="2"></div>
            <div class="field-group"><div class="field-label">Telefone</div><input type="tel" id="rep-tel" value="${rep.telefone || ''}"></div>
          </div>
          <div class="field-group"><div class="field-label">E-mail</div><input type="email" id="rep-email" value="${rep.email || ''}"></div>
        </div>
        <div class="modal-footer">
          <button class="btn secondary" onclick="closeModal()">Cancelar</button>
          <button class="btn" id="save-rep">Salvar</button>
        </div>
      `);
      overlay.querySelector('#save-rep').addEventListener('click', async () => {
        const nome = overlay.querySelector('#rep-nome').value.trim();
        if (!nome) { toast('Nome obrigatório.', 'error'); return; }
        const data = {
          nome,
          supervisor: normalizeSupervisor(overlay.querySelector('#rep-sup').value.trim()),
          uf: overlay.querySelector('#rep-uf').value.trim().toUpperCase(),
          telefone: overlay.querySelector('#rep-tel').value.trim(),
          email: overlay.querySelector('#rep-email').value.trim(),
        };
        if (!isNew) data.id = id;
        await (isNew ? dbAdd : dbPut)('representantes', data);
        await auditLog(isNew?'Criou representante':'Editou representante', data.nome);
        toast(isNew ? 'Representante criado.' : 'Representante atualizado.', 'success');
        closeModal();
        refresh(search, filterSup);
      });
    });
  }


})(window);
