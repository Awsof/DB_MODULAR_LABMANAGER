// pages/analistas.js — Página Analistas da Fase 4
(function (global) {
  "use strict";

  var pages = global.pages || {};
  global.pages = pages;

  // ===================== PAGE: ANALISTAS =====================
  pages.analistas = async function() {
    updateTopbar('Analistas', 'Gestão de analistas de implantação', `<button class="btn" id="new-ana-btn">+ Novo Analista</button>`);

    const renderAnalistas = async (search = '') => {
      const [analistas, chamados] = await Promise.all([dbAll('analistas'), dbAll('chamados')]);

      const chamCount = {};
      for (const ch of chamados) {
        if (ch.analista) chamCount[ch.analista] = (chamCount[ch.analista] || 0) + 1;
      }

      const showInativos = document.getElementById('ana-show-inativos')?.checked ?? false;
      let filtered = analistas.filter(a => {
        const matchSearch = !search || a.nome.toLowerCase().includes(search.toLowerCase()) ||
          (a.cargo || '').toLowerCase().includes(search.toLowerCase()) ||
          String(a.id || '').toLowerCase().includes(search.toLowerCase());
        const matchAtivo = showInativos || a.ativo !== false;
        return matchSearch && matchAtivo;
      });

      const tbody = document.getElementById('ana-list');
      if (!tbody) return;

      const editable = canBtn('analistas', 'edit-btn');
      const cargoColor = { 'Analista Junior':'var(--text2)', 'Analista Pleno':'var(--accent2)', 'Analista Sênior':'var(--navy)' };
      const renderAnaRow = a => {
        const count = chamCount[a.nome] || 0;
        const ativo = a.ativo !== false;
        return `<tr style="${!ativo ? 'opacity:.55' : ''}">
          <td><span style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--accent2);background:rgba(15,155,148,.08);padding:2px 7px;border-radius:4px;border:1px solid rgba(15,155,148,.2)">${a.id}</span></td>
          <td>
            <strong style="color:var(--navy)">${a.nome}</strong>
            ${!ativo ? '<span style="font-size:10px;color:var(--text3);margin-left:6px">Inativo</span>' : ''}
          </td>
          <td><span style="font-size:11px;font-weight:600;color:${cargoColor[a.cargo]||'var(--text2)'};padding:2px 8px;background:rgba(0,0,0,.04);border-radius:10px">${a.cargo || '—'}</span></td>
          <td style="color:var(--text2)">${a.email || '—'}</td>
          <td><span class="badge rep">${count} chamados</span></td>
          <td><div style="display:flex;gap:6px">
            <button class="btn sm secondary" data-view-ana="${a.id}">Ver</button>
            ${editable ? `<button class="btn sm secondary" data-edit-ana="${a.id}">Editar</button>` : ''}
            ${(count === 0 && editable) ? `<button class="btn sm danger" data-del-ana="${a.id}">Excluir</button>` : ''}
          </div></td>
        </tr>`;
      };

      tbody.innerHTML = filtered.length === 0
        ? `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text3)">Nenhum analista cadastrado. Clique em "+ Novo Analista" para adicionar.</td></tr>`
        : filtered.map(renderAnaRow).join('');

      const thead = tbody.closest('table')?.querySelector('thead');
      if (thead) makeSortable(thead, tbody, filtered, [
        { getValue: a => a.id },
        { getValue: a => a.nome },
        { getValue: a => a.cargo || '' },
        { getValue: a => a.email || '' },
        { getValue: a => chamCount[a.nome] || 0 },
      ], renderAnaRow);

      tbody.querySelectorAll('[data-view-ana]').forEach(btn => {
        btn.addEventListener('click', () => openAnalistaViewModal(btn.dataset.viewAna));
      });
      tbody.querySelectorAll('[data-edit-ana]').forEach(btn => {
        btn.addEventListener('click', async () => {
          // Resolve a chave correta (string nova ou numérica legada)
          const keyStr = btn.dataset.editAna;
          const keyNum = Number(keyStr);
          let resolvedKey = keyStr;
          try {
            const r = await dbGet('analistas', keyStr);
            if (!r && !isNaN(keyNum)) resolvedKey = keyNum;
          } catch(_) {
            if (!isNaN(keyNum)) resolvedKey = keyNum;
          }
          openAnalistaModal(resolvedKey, renderAnalistas, search);
        });
      });
      tbody.querySelectorAll('[data-del-ana]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Excluir este analista?')) return;
          // Tenta a chave como veio no dataset (string ou número legado)
          const keyStr = btn.dataset.delAna;
          const keyNum = Number(keyStr);
          try {
            // Verifica qual chave realmente existe no banco
            let record = null;
            try { record = await dbGet('analistas', keyStr); } catch(_) {}
            if (!record && !isNaN(keyNum)) {
              try { record = await dbGet('analistas', keyNum); } catch(_) {}
              if (record) await dbDelete('analistas', keyNum);
              else await dbDelete('analistas', keyStr);
            } else {
              await dbDelete('analistas', keyStr);
            }
            toast('Analista excluído.', 'info');
            renderAnalistas(document.getElementById('ana-search')?.value || '');
          } catch(err) {
            toast('Erro ao excluir: ' + (err.message || err), 'error');
          }
        });
      });
    };

    document.getElementById('content').innerHTML = `
      <div class="toolbar" style="gap:10px;align-items:center">
        <div class="search-wrap" style="flex:1">
          <span class="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></span>
          <input type="text" placeholder="Buscar por ID, nome ou cargo..." id="ana-search">
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);white-space:nowrap;cursor:pointer">
          <input type="checkbox" id="ana-show-inativos">
          Exibir inativos
        </label>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th data-sort="0">ID</th><th data-sort="1">Nome</th><th data-sort="2">Cargo</th><th data-sort="3">E-mail</th><th data-sort="4">Chamados</th><th>Ações</th></tr></thead>
          <tbody id="ana-list"></tbody>
        </table>
      </div>
    `;

    await renderAnalistas();
    document.getElementById('ana-search').addEventListener('input', e => renderAnalistas(e.target.value));
    document.getElementById('ana-show-inativos').addEventListener('change', () => renderAnalistas(document.getElementById('ana-search').value));
    document.getElementById('new-ana-btn').addEventListener('click', () => openAnalistaModal(null, renderAnalistas));
  };

  const CARGOS_ANALISTA = ['Analista Junior', 'Analista Pleno', 'Analista Sênior'];

  function openAnalistaModal(id, refresh, search = '') {
    Promise.resolve(id !== null && id !== undefined ? (async () => {
      let rec = null;
      try { rec = await dbGet('analistas', id); } catch(_) {}
      // Fallback: se veio string mas o registro tem chave numérica (legado)
      if (!rec && !isNaN(Number(id))) {
        try { rec = await dbGet('analistas', Number(id)); } catch(_) {}
      }
      return rec;
    })() : Promise.resolve(null)).then(async ana => {
      const isNew = !ana;
      ana = ana || { id:'', nome:'', cargo:'Analista Pleno', email:'', ativo: true };

      const overlay = openModal(`
        <div class="modal-header">
          <div class="modal-title">${isNew ? 'Novo Analista' : 'Editar Analista'}</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="two-col">
            <div class="field-group">
              <div class="field-label">ID * <span style="font-size:10px;color:var(--text3);font-weight:400">(único, imutável após salvar)</span></div>
              <input type="text" id="ana-id" value="${isNew ? '' : ana.id}"
                ${!isNew ? 'readonly style="opacity:.6;background:var(--bg2)"' : ''}
                placeholder="Ex: ANA-01">
            </div>
            <div class="field-group">
              <div class="field-label">Nome *</div>
              <input type="text" id="ana-nome" value="${ana.nome}" placeholder="Nome completo">
            </div>
          </div>
          <div class="two-col">
            <div class="field-group">
              <div class="field-label">Cargo *</div>
              <select id="ana-cargo">
                ${CARGOS_ANALISTA.map(c => `<option value="${c}" ${c === ana.cargo ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="field-group">
              <div class="field-label">E-mail</div>
              <input type="email" id="ana-email" value="${ana.email || ''}" placeholder="email@exemplo.com">
            </div>
          </div>
          <div class="checkbox-row" style="margin-top:6px">
            <input type="checkbox" id="ana-ativo" ${ana.ativo !== false ? 'checked' : ''}>
            <label for="ana-ativo" style="font-size:13px;cursor:pointer">
              Analista ativo <span style="font-size:11px;color:var(--text3)">(desmarque para inativar sem excluir)</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn secondary" onclick="closeModal()">Cancelar</button>
          <button class="btn" id="save-ana">Salvar</button>
        </div>
      `);

      overlay.querySelector('#save-ana').addEventListener('click', async () => {
        const anaId   = overlay.querySelector('#ana-id').value.trim();
        const nome    = overlay.querySelector('#ana-nome').value.trim();
        const cargo   = overlay.querySelector('#ana-cargo').value;
        const email   = overlay.querySelector('#ana-email').value.trim();
        const ativo   = overlay.querySelector('#ana-ativo').checked;

        if (!anaId) { toast('ID obrigatório.', 'error'); return; }
        if (!nome)  { toast('Nome obrigatório.', 'error'); return; }

        // Verificar unicidade do ID apenas em novos registros
        if (isNew) {
          try {
            const existing = await dbGet('analistas', anaId);
            if (existing) { toast(`ID "${anaId}" já está em uso. Escolha outro.`, 'error'); return; }
          } catch(_) {} // ID não existe → ok
        }

        const data = { id: anaId, nome, cargo, email, ativo };
        await dbPut('analistas', data);
        await auditLog(isNew ? 'Criou analista' : 'Editou analista', `[${anaId}] ${nome} · ${cargo}`);
        toast(isNew ? 'Analista criado.' : 'Analista atualizado.', 'success');
        closeModal();
        refresh(search);
      });
    });
  }


})(window);
