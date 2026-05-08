// pages/chamados.js — NOVO · Fase 6
// Página gerencial standalone de chamados de integração.
// Centraliza criação, visualização e edição de chamados, desacoplada do modal de laboratório.
// RLS: filtra chamados pelos clientes visíveis ao usuário via applyDataFilter.
(function (global) {
  "use strict";

  var pages = global.pages || {};
  global.pages = pages;

  // ===================== PAGE: CHAMADOS =====================
  pages.chamados = async function () {
    updateTopbar('Chamados', 'Chamados de integração', `<button class="btn" id="new-ch-btn">+ Novo Chamado</button>`);

    const render = async (filters = {}) => {
      const { search = '', filterStatus = '', filterAnalista = '', filterSistema = '' } = filters;

      const [_clientes, reps, sistemas, analistas, allChamados] = await Promise.all([
        dbAll('clientes'), dbAll('representantes'), dbAll('sistemas'),
        dbAll('analistas'), dbAll('chamados')
      ]);

      // RLS
      const clientesVisiveis = applyDataFilter(_clientes, reps);
      const codigosVisiveis  = new Set(clientesVisiveis.map(c => c.Codigo));

      const clienteById = {}; for (const c of clientesVisiveis) clienteById[c.Codigo] = c;
      const sysById     = {}; for (const s of sistemas)          sysById[s.id]         = s;

      // Filtra chamados pelos clientes visíveis + filtros aplicados
      let chamados = allChamados.filter(ch => codigosVisiveis.has(ch.fk_cliente));

      if (search) {
        const q = search.toLowerCase();
        chamados = chamados.filter(ch => {
          const lab = clienteById[ch.fk_cliente];
          return (ch.numeroChamado || '').toLowerCase().includes(q)
            || (lab?.NomeFantasia || '').toLowerCase().includes(q)
            || (lab?.RazaoSocial  || '').toLowerCase().includes(q)
            || (ch.analista || '').toLowerCase().includes(q);
        });
      }
      if (filterStatus)   chamados = chamados.filter(ch => resolveStatusChamado(ch) === filterStatus);
      if (filterAnalista) chamados = chamados.filter(ch => ch.analista === filterAnalista);
      if (filterSistema)  chamados = chamados.filter(ch => String(ch.fk_sistema) === filterSistema);

      // Ordena por dataSolicitacao desc (mais recente primeiro)
      chamados.sort((a, b) => (b.dataSolicitacao || '').localeCompare(a.dataSolicitacao || ''));

      const analistaSet = [...new Set(allChamados.map(ch => ch.analista).filter(Boolean))].sort();

      const tbody = document.getElementById('ch-table-body');
      if (!tbody) return;

      const renderRow = ch => {
        const lab       = clienteById[ch.fk_cliente];
        const labNome   = lab ? (lab.NomeFantasia || lab.RazaoSocial || '#' + lab.Codigo) : `Lab #${ch.fk_cliente}`;
        const sys       = sysById[ch.fk_sistema];
        const status    = resolveStatusChamado(ch);
        const statusBadge = renderChamadoStatusBadge(status);
        const canEdit   = canBtn('chamados', 'edit-btn');
        return `<tr>
          <td style="font-family:var(--mono);font-size:11px;color:var(--text3);white-space:nowrap">${ch.numeroChamado || '—'}</td>
          <td>
            <div style="font-weight:600;color:var(--navy);font-size:13px">${labNome}</div>
            ${lab?.CNPJ ? `<div style="font-size:10px;color:var(--text3)">${lab.CNPJ}</div>` : ''}
          </td>
          <td style="font-size:12px">${sys ? `<span class="badge sys">${sys.nome}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
          <td style="font-size:12px;color:var(--text2)">${ch.analista || '—'}</td>
          <td>${statusBadge}</td>
          <td style="font-size:12px;color:var(--text3)">${ch.dataSolicitacao || '—'}</td>
          <td style="font-size:12px">${ch.tipoIntegracao ? `<span class="badge tag" style="font-size:10px">${ch.tipoIntegracao}</span>` : '—'}</td>
          <td style="white-space:nowrap">
            <div style="display:flex;gap:5px">
              ${canEdit ? `<button class="btn sm secondary" data-edit-ch="${ch.id}" style="font-size:11px;padding:4px 8px">Editar</button>` : ''}
              ${canEdit ? `<button class="btn sm danger" data-del-ch="${ch.id}" style="font-size:11px;padding:4px 8px">Excluir</button>` : ''}
            </div>
          </td>
        </tr>`;
      };

      tbody.innerHTML = chamados.length === 0
        ? `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text3)">Nenhum chamado encontrado.</td></tr>`
        : chamados.map(renderRow).join('');

      // Atualiza contador no topbar
      const infoEl = document.getElementById('ch-count');
      if (infoEl) infoEl.textContent = `${chamados.length} chamado${chamados.length !== 1 ? 's' : ''}`;

      // Bind editar
      tbody.querySelectorAll('[data-edit-ch]').forEach(btn => {
        btn.addEventListener('click', () => openChamadoModal(parseInt(btn.dataset.editCh), clientesVisiveis, sistemas, analistas, () => render(currentFilters)));
      });

      // Bind excluir
      tbody.querySelectorAll('[data-del-ch]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Excluir este chamado?')) return;
          await dbDelete('chamados', parseInt(btn.dataset.delCh));
          await auditLog('Excluiu chamado', btn.dataset.delCh);
          toast('Chamado excluído.', 'info');
          render(currentFilters);
        });
      });

      // Atualiza dropdowns de filtro (sem perder seleção)
      const anaEl = document.getElementById('ch-filter-analista');
      if (anaEl) {
        const prev = anaEl.value;
        anaEl.innerHTML = `<option value="">Todos os analistas</option>` +
          analistaSet.map(a => `<option value="${a}" ${a === prev ? 'selected' : ''}>${a}</option>`).join('');
      }
      const sysEl = document.getElementById('ch-filter-sistema');
      if (sysEl) {
        const prev = sysEl.value;
        sysEl.innerHTML = `<option value="">Todos os sistemas</option>` +
          sistemas.map(s => `<option value="${s.id}" ${String(s.id) === prev ? 'selected' : ''}>${s.nome}</option>`).join('');
      }
    };

    // Estado de filtros atual (closure para callbacks de botões)
    let currentFilters = {};

    document.getElementById('content').innerHTML = `
      ${rlsBanner()}
      <div class="toolbar" style="flex-wrap:wrap;gap:8px">
        <div class="search-wrap" style="flex:2;min-width:200px">
          <span class="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></span>
          <input type="text" placeholder="Buscar por nº chamado, laboratório ou analista..." id="ch-search">
        </div>
        <select id="ch-filter-status">
          <option value="">Todos os status</option>
          <option value="aberto">Em Implantação</option>
          <option value="finalizado_ativo">Integração Ativa</option>
          <option value="finalizado_inativo">Finalizado sem Ativação</option>
        </select>
        <select id="ch-filter-analista"><option value="">Todos os analistas</option></select>
        <select id="ch-filter-sistema"><option value="">Todos os sistemas</option></select>
        <span id="ch-count" style="font-size:12px;color:var(--text3);white-space:nowrap;align-self:center"></span>
      </div>
      <div class="table-wrap">
        <table style="width:100%">
          <thead>
            <tr>
              <th style="width:120px">Nº Chamado</th>
              <th>Laboratório</th>
              <th>Sistema</th>
              <th>Analista</th>
              <th style="width:160px">Status</th>
              <th style="width:110px">Data Sol.</th>
              <th>Tipo</th>
              <th style="width:110px">Ações</th>
            </tr>
          </thead>
          <tbody id="ch-table-body"></tbody>
        </table>
      </div>
    `;

    // Renderização inicial
    await render(currentFilters);

    // Bind filtros
    const getFilters = () => ({
      search:         document.getElementById('ch-search')?.value           || '',
      filterStatus:   document.getElementById('ch-filter-status')?.value    || '',
      filterAnalista: document.getElementById('ch-filter-analista')?.value  || '',
      filterSistema:  document.getElementById('ch-filter-sistema')?.value   || '',
    });

    ['input', 'change'].forEach(() => {}); // noop; listeners abaixo
    document.getElementById('ch-search').addEventListener('input',           () => { currentFilters = getFilters(); render(currentFilters); });
    document.getElementById('ch-filter-status').addEventListener('change',   () => { currentFilters = getFilters(); render(currentFilters); });
    document.getElementById('ch-filter-analista').addEventListener('change', () => { currentFilters = getFilters(); render(currentFilters); });
    document.getElementById('ch-filter-sistema').addEventListener('change',  () => { currentFilters = getFilters(); render(currentFilters); });

    // Botão Novo Chamado
    document.getElementById('new-ch-btn').addEventListener('click', async () => {
      const [clientes, reps, sistemas, analistas] = await Promise.all([
        dbAll('clientes'), dbAll('representantes'), dbAll('sistemas'), dbAll('analistas')
      ]);
      const clientesVisiveis = applyDataFilter(clientes, reps);
      openChamadoModal(null, clientesVisiveis, sistemas, analistas, () => render(currentFilters));
    });
  };

  // ── Helpers de status ─────────────────────────────────────────────────────────
  /**
   * Resolve o status semântico de um chamado.
   * | Valor               | Condição                                              |
   * |---------------------|-------------------------------------------------------|
   * | aberto              | dataFinalizacao ausente                               |
   * | finalizado_ativo    | dataFinalizacao preenchida + integracaoAtiva = true   |
   * | finalizado_inativo  | dataFinalizacao preenchida + integracaoAtiva = false  |
   */
  function resolveStatusChamado(ch) {
    if (!ch.dataFinalizacao) return 'aberto';
    return ch.integracaoAtiva ? 'finalizado_ativo' : 'finalizado_inativo';
  }

  /**
   * Renderiza badge visual para o status de um chamado.
   * Usa as mesmas cores e classes do renderIntStatusBadge de utils.js para consistência.
   */
  function renderChamadoStatusBadge(status) {
    if (status === 'finalizado_ativo')   return `<span class="chamado-status-on"   style="font-size:11px">✓ Integração Ativa</span>`;
    if (status === 'finalizado_inativo') return `<span class="chamado-status-off"  style="font-size:11px">✗ Finalizado s/ Ativação</span>`;
    return `<span class="chamado-status-impl" style="font-size:11px">⏳ Em Implantação</span>`;
  }

  // ── openChamadoModal ──────────────────────────────────────────────────────────
  /**
   * Modal único para criação e edição de chamados.
   * @param {number|null} id              - null = novo chamado
   * @param {Array}       clientesVisiveis - clientes já filtrados por RLS
   * @param {Array}       sistemas
   * @param {Array}       analistas
   * @param {Function}    onSave          - callback de refresh
   */
  async function openChamadoModal(id, clientesVisiveis, sistemas, analistas, onSave) {
    const ch     = id ? await dbGet('chamados', id) : null;
    const isNew  = !ch;
    const data   = ch || {
      fk_cliente: null, numeroChamado: '', analista: '',
      dataSolicitacao: '', dataFinalizacao: null,
      fk_sistema: null, tipoIntegracao: '', integracaoAtiva: false,
    };

    const analistasAtivos = analistas.filter(a => a.ativo !== false);

    const clientesOpts = `<option value="">— Selecione o laboratório —</option>` +
      [...clientesVisiveis]
        .sort((a, b) => (a.NomeFantasia || a.RazaoSocial || '').localeCompare(b.NomeFantasia || b.RazaoSocial || '', 'pt-BR'))
        .map(c => {
          const label = `${c.NomeFantasia || c.RazaoSocial || '#' + c.Codigo} · #${c.Codigo}`;
          return `<option value="${c.Codigo}" ${c.Codigo === data.fk_cliente ? 'selected' : ''}>${label}</option>`;
        })
        .join('');

    const sistemasOpts = `<option value="">— Nenhum —</option>` +
      sistemas.map(s =>
        `<option value="${s.id}" ${s.id === data.fk_sistema ? 'selected' : ''}>${s.nome}${s.empresa ? ' · ' + s.empresa : ''}</option>`
      ).join('');

    const analistasOpts = `<option value="">— Selecione —</option>` +
      analistasAtivos.map(a =>
        `<option value="${a.nome}" ${a.nome === data.analista ? 'selected' : ''}>[${a.id}] ${a.nome} · ${a.cargo}</option>`
      ).join('');

    const overlay = openModal(`
      <div class="modal-header">
        <div class="modal-title">${isNew ? 'Novo Chamado' : 'Editar Chamado'}</div>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="field-group">
          <div class="field-label">Laboratório *</div>
          <select id="ch-m-lab" ${!isNew ? 'disabled style="opacity:.6"' : ''}>${clientesOpts}</select>
        </div>
        <div class="two-col">
          <div class="field-group">
            <div class="field-label">Nº do Chamado *</div>
            <input type="text" id="ch-m-num" value="${data.numeroChamado}" placeholder="Ex: INC-0042">
          </div>
          <div class="field-group">
            <div class="field-label">Analista</div>
            <select id="ch-m-analista">${analistasOpts}</select>
          </div>
        </div>
        <div class="two-col">
          <div class="field-group">
            <div class="field-label">Data de Solicitação *</div>
            <input type="date" id="ch-m-data-sol" value="${data.dataSolicitacao || ''}">
          </div>
          <div class="field-group">
            <div class="field-label">Data de Finalização</div>
            <input type="date" id="ch-m-data-fin" value="${data.dataFinalizacao || ''}">
          </div>
        </div>
        <div class="field-group">
          <div class="field-label">Sistema</div>
          <select id="ch-m-sistema">${sistemasOpts}</select>
        </div>
        <div class="field-group">
          <div class="field-label">Tipo de Integração</div>
          <select id="ch-m-tipo">
            <option value="">— Selecione —</option>
            <option value="Convencional (XML)" ${data.tipoIntegracao === 'Convencional (XML)' ? 'selected' : ''}>Convencional (XML)</option>
            <option value="Webservice"         ${data.tipoIntegracao === 'Webservice'         ? 'selected' : ''}>Webservice</option>
          </select>
        </div>
        <div class="checkbox-row">
          <input type="checkbox" id="ch-m-int-ativa" ${data.integracaoAtiva ? 'checked' : ''}>
          <label for="ch-m-int-ativa" style="font-size:13px;cursor:pointer">Integração Ativa</label>
        </div>
        <div style="margin-top:10px;padding:9px 12px;background:rgba(15,155,148,.06);border:1px solid rgba(15,155,148,.2);border-radius:var(--r);font-size:11px;color:var(--text3)">
          ℹ️ Ao marcar "Integração Ativa", o sistema será vinculado automaticamente ao laboratório.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn" id="save-ch-m">Salvar</button>
      </div>
    `);

    overlay.querySelector('#save-ch-m').addEventListener('click', async () => {
      const btn = overlay.querySelector('#save-ch-m');
      btn.disabled = true; btn.textContent = 'Salvando...';
      try {
        const fk_cliente    = isNew ? overlay.querySelector('#ch-m-lab').value : data.fk_cliente;
        const numeroChamado = overlay.querySelector('#ch-m-num').value.trim();
        const analista      = overlay.querySelector('#ch-m-analista').value.trim();
        const dataSol       = overlay.querySelector('#ch-m-data-sol').value;
        const dataFin       = overlay.querySelector('#ch-m-data-fin').value;
        const fk_sistema    = parseInt(overlay.querySelector('#ch-m-sistema').value) || null;
        const tipoIntegracao = overlay.querySelector('#ch-m-tipo').value;
        const integracaoAtiva = overlay.querySelector('#ch-m-int-ativa').checked;

        if (!fk_cliente)    { toast('Selecione o laboratório.', 'error'); btn.disabled = false; btn.textContent = 'Salvar'; return; }
        if (!numeroChamado) { toast('Informe o número do chamado.', 'error'); btn.disabled = false; btn.textContent = 'Salvar'; return; }
        if (!dataSol)       { toast('Informe a data de solicitação.', 'error'); btn.disabled = false; btn.textContent = 'Salvar'; return; }
        if (integracaoAtiva && !tipoIntegracao) { toast('Selecione o Tipo de Integração.', 'error'); btn.disabled = false; btn.textContent = 'Salvar'; return; }

        const record = {
          fk_cliente,
          numeroChamado,
          analista,
          dataSolicitacao: dataSol,
          dataFinalizacao: dataFin || null,
          fk_sistema,
          tipoIntegracao,
          integracaoAtiva,
        };
        if (!isNew) record.id = id;

        await (isNew ? dbAdd : dbPut)('chamados', record);

        // Atualiza fk_sistema no cliente se integração ativa
        if (integracaoAtiva && fk_sistema) {
          const freshCliente = await dbGet('clientes', fk_cliente);
          if (freshCliente) await dbPut('clientes', { ...freshCliente, fk_sistema, _manual_fk_sistema: true });
        }

        await auditLog(isNew ? 'Criou chamado' : 'Editou chamado', `${numeroChamado} · Lab #${fk_cliente}`);
        toast(isNew ? 'Chamado criado.' : 'Chamado atualizado.', 'success');
        closeModal();
        if (onSave) onSave();
      } catch (err) {
        console.error('Erro ao salvar chamado:', err);
        toast('Erro ao salvar: ' + (err.message || err), 'error');
        btn.disabled = false; btn.textContent = 'Salvar';
      }
    });
  }

})(window);
