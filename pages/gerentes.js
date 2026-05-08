// pages/gerentes.js — NOVO · Fase 6
// Gestão de gerentes comerciais. Schema: { id, nome, regiao, telefone, email }
// O campo `regiao` é campo texto livre (ex: "Norte", "Nordeste", "Sul/Sudeste").
// O vínculo gerente ↔ supervisor é feito pelo campo texto `supervisores.gerente`
// (campo texto — decisão 2B — espelha padrão supervisor→representantes).
(function (global) {
  "use strict";

  var pages = global.pages || {};
  global.pages = pages;

  // ===================== PAGE: GERENTES =====================
  pages.gerentes = async function () {
    updateTopbar('Gerentes', 'Gestão de gerentes comerciais', `<button class="btn" id="new-ger-btn">+ Novo Gerente</button>`);

    const renderGerentes = async (search = '') => {
      const [gerentes, supervisores] = await Promise.all([
        dbAll('gerentes'), dbAll('supervisores')
      ]);

      // Contar supervisores vinculados a cada gerente (pelo campo texto `supervisor.gerente`)
      const supCount = {};
      for (const s of supervisores) {
        if (s.gerente) supCount[s.gerente] = (supCount[s.gerente] || 0) + 1;
      }

      const filtered = gerentes.filter(g =>
        !search || g.nome.toLowerCase().includes(search.toLowerCase())
      );

      const tbody = document.getElementById('ger-list');
      if (!tbody) return;

      const editable = canBtn('gerentes', 'edit-btn');

      const renderGerRow = g => {
        const count = supCount[g.nome] || 0;
        return `<tr>
          <td><span style="font-family:var(--mono);font-size:11px;color:var(--text3)">#${g.id}</span></td>
          <td><strong>${g.nome}</strong></td>
          <td style="font-size:12px;color:var(--text2)">${g.regiao || '—'}</td>
          <td style="font-size:12px">${g.telefone || '—'}</td>
          <td style="font-size:12px">${g.email || '—'}</td>
          <td><span class="badge rep">${count} supervisor${count !== 1 ? 'es' : ''}</span></td>
          <td><div style="display:flex;gap:6px">
            ${editable ? `<button class="btn sm secondary" data-edit-ger="${g.id}">Editar</button>` : ''}
            ${(count === 0 && editable) ? `<button class="btn sm danger" data-del-ger="${g.id}">Excluir</button>` : ''}
          </div></td>
        </tr>`;
      };

      tbody.innerHTML = filtered.length === 0
        ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text3)">Nenhum gerente encontrado</td></tr>`
        : filtered.map(renderGerRow).join('');

      const thead = tbody.closest('table')?.querySelector('thead');
      if (thead) makeSortable(thead, tbody, filtered, [
        { getValue: g => g.id },
        { getValue: g => g.nome },
        { getValue: g => g.regiao || '' },
        { getValue: g => g.telefone || '' },
        { getValue: g => g.email || '' },
        { getValue: g => supCount[g.nome] || 0 },
      ], renderGerRow);

      tbody.querySelectorAll('[data-edit-ger]').forEach(btn => {
        btn.addEventListener('click', () => openGerModal(parseInt(btn.dataset.editGer), renderGerentes, search));
      });
      tbody.querySelectorAll('[data-del-ger]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Excluir este gerente?')) return;
          const id = parseInt(btn.dataset.delGer);
          await dbDelete('gerentes', id);
          await auditLog('Excluiu gerente', String(id));
          toast('Gerente excluído.', 'info');
          renderGerentes(search);
        });
      });
    };

    document.getElementById('content').innerHTML = `
      <div class="toolbar">
        <div class="search-wrap">
          <span class="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></span>
          <input type="text" placeholder="Buscar por nome..." id="ger-search">
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th data-sort="0">ID</th>
              <th data-sort="1">Nome</th>
              <th data-sort="2">Região</th>
              <th data-sort="3">Telefone</th>
              <th data-sort="4">E-mail</th>
              <th data-sort="5">Supervisores</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="ger-list"></tbody>
        </table>
      </div>
    `;

    await renderGerentes();
    document.getElementById('ger-search').addEventListener('input', e => renderGerentes(e.target.value));
    document.getElementById('new-ger-btn').addEventListener('click', () => openGerModal(null, renderGerentes));
  };

  // ── openGerModal ──────────────────────────────────────────────────────────────
  async function openGerModal(id, refresh, search = '') {
    const g = id ? await dbGet('gerentes', id) : null;

    const isNew = !g;
    const data  = g || { nome: '', regiao: '', telefone: '', email: '' };

    const overlay = openModal(`
      <div class="modal-header">
        <div class="modal-title">${isNew ? 'Novo Gerente' : 'Editar Gerente'}</div>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="field-group">
          <div class="field-label">Nome *</div>
          <input type="text" id="ger-nome" value="${data.nome}" placeholder="Nome completo">
        </div>
        <div class="field-group">
          <div class="field-label">Região</div>
          <input type="text" id="ger-regiao" value="${data.regiao || ''}" placeholder="Ex: Nordeste, Sul/Sudeste">
        </div>
        <div class="two-col">
          <div class="field-group">
            <div class="field-label">Telefone</div>
            <input type="tel" id="ger-telefone" value="${data.telefone || ''}" placeholder="(00) 00000-0000">
          </div>
          <div class="field-group">
            <div class="field-label">E-mail</div>
            <input type="email" id="ger-email" value="${data.email || ''}" placeholder="email@exemplo.com">
          </div>
        </div>
        ${!isNew ? `
          <div style="margin-top:10px;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);font-size:11px;color:var(--text3)">
            ℹ️ Para vincular supervisores a este gerente, acesse a página <strong>Supervisores</strong> e edite o campo "Gerente Responsável" de cada registro.
          </div>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn" id="save-ger">Salvar</button>
      </div>
    `);

    overlay.querySelector('#save-ger').addEventListener('click', async () => {
      const nome = overlay.querySelector('#ger-nome').value.trim();
      if (!nome) { toast('Nome obrigatório.', 'error'); return; }

      const record = {
        nome,
        regiao:   overlay.querySelector('#ger-regiao').value.trim(),
        telefone: overlay.querySelector('#ger-telefone').value.trim(),
        email:    overlay.querySelector('#ger-email').value.trim(),
      };
      if (!isNew) record.id = id;

      await (isNew ? dbAdd : dbPut)('gerentes', record);
      await auditLog(isNew ? 'Criou gerente' : 'Editou gerente', record.nome);
      toast(isNew ? 'Gerente criado.' : 'Gerente atualizado.', 'success');
      closeModal();
      refresh(search);
    });
  }

})(window);
