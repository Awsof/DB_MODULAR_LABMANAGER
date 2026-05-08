// pages/laboratorios.js — Página Laboratórios
// FASE 6: Formulário de criação de chamados removido do modal de edição.
// A seção "Chamados de Integração" permanece no modal de EDIÇÃO como visualização
// read-only com botão "Novo chamado" que redireciona para pages.chamados.
// A edição inline de chamados existentes é mantida (não é criação, é atualização).
(function (global) {
  "use strict";

  var pages = global.pages || {};
  global.pages = pages;

  // ── Estado de paginação e filtros (module-level, persiste entre re-renders) ──
  let labPage = 1, labSearch = '', labSearchCodigo = '', labSearchCNPJ = '';
  let labUF = '', labRep = '', labAnalista = '', labIntStatus = '';
  const LAB_TABLE_PER_PAGE = 50;

  // ===================== PAGE: LABORATÓRIOS =====================
  pages.laboratorios = async function () {
    updateTopbar('Laboratórios', 'Clientes / Laboratórios cadastrados', '');

    const [_clientesLab, reps, sistemas, allChamados, allEnvios] = await Promise.all([
      dbAll('clientes'), dbAll('representantes'), dbAll('sistemas'), dbAll('chamados'), dbAll('envios')
    ]);

    // RLS: filtrar clientes pelo vínculo do usuário
    const clientes = applyDataFilter(_clientesLab, reps);

    const repById  = {}; for (const r of reps)     repById[r.id]  = r;
    const sysById  = {}; for (const s of sistemas)  sysById[s.id]  = s;
    const ufs      = [...new Set(clientes.map(c => c.UF).filter(Boolean))].sort();

    const analistaSet = [...new Set(allChamados.map(ch => ch.analista).filter(Boolean))].sort();

    const clienteAnalistaMap = {};
    for (const ch of allChamados) {
      if (!clienteAnalistaMap[ch.fk_cliente]) clienteAnalistaMap[ch.fk_cliente] = new Set();
      if (ch.analista) clienteAnalistaMap[ch.fk_cliente].add(ch.analista);
    }

    const chamadosByCliente = {};
    for (const ch of allChamados) {
      if (!chamadosByCliente[ch.fk_cliente]) chamadosByCliente[ch.fk_cliente] = [];
      chamadosByCliente[ch.fk_cliente].push(ch);
    }

    const enviosByCliente = {};
    for (const ev of allEnvios) {
      if (!enviosByCliente[ev.fk_cliente]) enviosByCliente[ev.fk_cliente] = {};
      const t = ev.tipoEnvio;
      enviosByCliente[ev.fk_cliente][t] = (enviosByCliente[ev.fk_cliente][t] || 0) + ev.qntEnvio;
    }

    const ENVIO_CONV = new Set(['INTEGRACAO', 'E-DB INTEGRACAO']);
    const ENVIO_WS   = new Set(['ETIQUETA PRIMARIA']);
    function envChipColor(t) {
      if (ENVIO_CONV.has(t)) return 'color:var(--accent2);border-color:rgba(15,155,148,.3)';
      if (ENVIO_WS.has(t))   return 'color:var(--purple);border-color:rgba(108,92,231,.3)';
      return '';
    }

    // ── render ────────────────────────────────────────────────────────────────
    const render = () => {
      let filtered = clientes.filter(c => {
        const txtOk  = !labSearch || (c.NomeFantasia||'').toLowerCase().includes(labSearch.toLowerCase()) || (c.RazaoSocial||'').toLowerCase().includes(labSearch.toLowerCase());
        const codOk  = !labSearchCodigo || String(c.Codigo||'').toLowerCase().includes(labSearchCodigo.toLowerCase());
        const cnpjOk = !labSearchCNPJ   || String(c.CNPJ||'').replace(/\D/g,'').includes(labSearchCNPJ.replace(/\D/g,''));
        const ufOk   = !labUF           || c.UF === labUF;
        const repOk  = !labRep          || String(c.fk_representante) === labRep;
        const anaOk  = !labAnalista     || (clienteAnalistaMap[c.Codigo] && clienteAnalistaMap[c.Codigo].has(labAnalista));
        const chs    = chamadosByCliente[c.Codigo] || [];
        const intOk  = !labIntStatus    || getIntStatus(chs) === labIntStatus;
        return txtOk && codOk && cnpjOk && ufOk && repOk && anaOk && intOk;
      });

      filtered.sort((a, b) => {
        const ca = isNaN(a.Codigo) ? String(a.Codigo) : Number(a.Codigo);
        const cb = isNaN(b.Codigo) ? String(b.Codigo) : Number(b.Codigo);
        return ca < cb ? -1 : ca > cb ? 1 : 0;
      });

      const total      = filtered.length;
      const totalPages = Math.ceil(total / LAB_TABLE_PER_PAGE);
      if (labPage > totalPages) labPage = 1;
      const slice = filtered.slice((labPage - 1) * LAB_TABLE_PER_PAGE, labPage * LAB_TABLE_PER_PAGE);

      const renderRow = c => {
        const rep    = repById[c.fk_representante];
        const sys    = sysById[c.fk_sistema];
        const chs    = chamadosByCliente[c.Codigo] || [];
        const intSt  = getIntStatus(chs);
        const envMap = enviosByCliente[c.Codigo] || {};
        const envE   = Object.entries(envMap).sort((a, b) => b[1] - a[1]);
        const cts    = Array.isArray(c.contatos) && c.contatos.length ? c.contatos : (c.NomeContato ? [{ nome: c.NomeContato }] : []);
        return `<tr>
          <td style="font-family:var(--mono);font-size:11px;color:var(--text3);white-space:nowrap">${c.Codigo}</td>
          <td>
            <div style="font-weight:600;color:var(--navy);font-size:13px">${c.NomeFantasia || c.RazaoSocial || '(sem nome)'}</div>
            ${c.CNPJ ? `<div style="font-size:10px;color:var(--text3)">${c.CNPJ}</div>` : ''}
          </td>
          <td><span class="badge uf">${c.UF || '?'}</span></td>
          <td style="font-size:12px;color:var(--text2)">${rep ? rep.nome.split(' ').slice(0, 2).join(' ') : '—'}</td>
          <td style="font-size:12px">${sys ? `<span class="badge sys">${sys.nome}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
          <td>${renderIntStatusBadge(intSt)}</td>
          <td style="font-size:11px">
            ${envE.length
              ? envE.map(([t, q]) => `<span class="lab-envio-chip" style="${envChipColor(t)}">${t}<span class="chip-qty">${q.toLocaleString('pt-BR')}</span></span>`).join(' ')
              : '<span style="color:var(--text3);font-size:11px">—</span>'}
          </td>
          <td style="font-size:12px;color:var(--text2)">${cts[0]?.nome || '—'}</td>
          <td style="white-space:nowrap">
            <div style="display:flex;gap:5px">
              <button class="btn sm secondary" data-view="${c.Codigo}" style="font-size:11px;padding:4px 8px">Ver</button>
              ${canBtn('laboratorios', 'edit-btn') ? `<button class="btn sm" data-edit="${c.Codigo}" style="font-size:11px;padding:4px 8px">Editar</button>` : ''}
            </div>
          </td>
        </tr>`;
      };

      document.getElementById('lab-table-body').innerHTML = slice.length === 0
        ? `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text3)">Nenhum resultado encontrado.</td></tr>`
        : slice.map(renderRow).join('');

      // Sortable
      const labThead = document.querySelector('#lab-table-body')?.closest('table')?.querySelector('thead');
      if (labThead && filtered.length > 0) {
        makeSortable(labThead, document.getElementById('lab-table-body'), filtered, [
          { getValue: c => Number(c.Codigo) || c.Codigo },
          { getValue: c => c.NomeFantasia || c.RazaoSocial || '' },
          { getValue: c => c.UF || '' },
          { getValue: c => repById[c.fk_representante]?.nome || '' },
          { getValue: c => sysById[c.fk_sistema]?.nome || '' },
          { getValue: c => getIntStatus(chamadosByCliente[c.Codigo] || []) },
        ], renderRow);
      }

      // Pagination
      const pagEl      = document.getElementById('lab-pagination');
      if (totalPages <= 1) {
        pagEl.innerHTML = `<span class="page-info">${total} resultado${total !== 1 ? 's' : ''}</span>`;
        return;
      }
      let pHtml = `<span class="page-info">${total} resultados</span>`;
      if (labPage > 1) pHtml += `<button class="page-btn" data-p="${labPage - 1}">‹ Anterior</button>`;
      const start = Math.max(1, labPage - 2), end = Math.min(totalPages, labPage + 2);
      for (let i = start; i <= end; i++) pHtml += `<button class="page-btn ${i === labPage ? 'active' : ''}" data-p="${i}">${i}</button>`;
      if (labPage < totalPages) pHtml += `<button class="page-btn" data-p="${labPage + 1}">Próxima ›</button>`;
      pagEl.innerHTML = pHtml;
    };

    // ── HTML da página ────────────────────────────────────────────────────────
    document.getElementById('content').innerHTML = `
      <div class="toolbar" style="flex-wrap:wrap;gap:8px">
        <div class="search-wrap no-icon" style="flex:0 0 110px;min-width:90px">
          <input type="text" placeholder="Código..." id="lab-search-codigo" value="${labSearchCodigo}">
        </div>
        <div class="search-wrap" style="flex:2;min-width:180px">
          <span class="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></span>
          <input type="text" placeholder="Nome Fantasia / Razão Social..." id="lab-search" value="${labSearch}">
        </div>
        <div class="search-wrap no-icon" style="flex:1;min-width:120px">
          <input type="text" placeholder="CNPJ..." id="lab-search-cnpj" value="${labSearchCNPJ}">
        </div>
        <select id="lab-uf">
          <option value="">Todas as UFs</option>
          ${ufs.map(u => `<option value="${u}" ${u === labUF ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
        <select id="lab-rep">
          <option value="">Todos os representantes</option>
          ${[...reps].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(r => `<option value="${r.id}" ${String(r.id) === labRep ? 'selected' : ''}>${r.nome}</option>`).join('')}
        </select>
        <select id="lab-analista">
          <option value="">Todos os analistas</option>
          ${analistaSet.map(a => `<option value="${a}" ${a === labAnalista ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
        <select id="lab-int-status">
          <option value="">Todos os status</option>
          <option value="none"     ${labIntStatus === 'none'     ? 'selected' : ''}>Sem Integração</option>
          <option value="inactive" ${labIntStatus === 'inactive' ? 'selected' : ''}>Integração Inativada</option>
          <option value="active"   ${labIntStatus === 'active'   ? 'selected' : ''}>Integrado</option>
          <option value="impl"     ${labIntStatus === 'impl'     ? 'selected' : ''}>Em Implantação</option>
        </select>
      </div>
      <div class="table-wrap" style="margin-bottom:12px">
        <table style="width:100%">
          <thead>
            <tr>
              <th style="width:70px"  data-sort="0">Código</th>
              <th                     data-sort="1">Nome</th>
              <th style="width:50px"  data-sort="2">UF</th>
              <th                     data-sort="3">Representante</th>
              <th                     data-sort="4">Sistema</th>
              <th style="width:150px" data-sort="5">Status Int.</th>
              <th>Tipos de Envio</th>
              <th>Contato</th>
              <th style="width:110px">Ações</th>
            </tr>
          </thead>
          <tbody id="lab-table-body"></tbody>
        </table>
      </div>
      <div class="pagination" id="lab-pagination"></div>
    `;

    render();

    document.getElementById('lab-search').addEventListener('input',         e => { labSearch        = e.target.value; labPage = 1; render(); });
    document.getElementById('lab-search-codigo').addEventListener('input',  e => { labSearchCodigo  = e.target.value; labPage = 1; render(); });
    document.getElementById('lab-search-cnpj').addEventListener('input',    e => { labSearchCNPJ    = e.target.value; labPage = 1; render(); });
    document.getElementById('lab-uf').addEventListener('change',            e => { labUF            = e.target.value; labPage = 1; render(); });
    document.getElementById('lab-rep').addEventListener('change',           e => { labRep           = e.target.value; labPage = 1; render(); });
    document.getElementById('lab-analista').addEventListener('change',      e => { labAnalista      = e.target.value; labPage = 1; render(); });
    document.getElementById('lab-int-status').addEventListener('change',    e => { labIntStatus     = e.target.value; labPage = 1; render(); });

    document.getElementById('lab-table-body').addEventListener('click', e => {
      const editBtn = e.target.closest('[data-edit]');
      if (editBtn) { openLabModal(editBtn.dataset.edit, clientes, reps, sistemas, sysById); return; }
      const viewBtn = e.target.closest('[data-view]');
      if (viewBtn) openLabViewModal(viewBtn.dataset.view, repById, sysById, allChamados);
    });

    document.getElementById('lab-pagination').addEventListener('click', e => {
      const btn = e.target.closest('[data-p]');
      if (btn) { labPage = parseInt(btn.dataset.p); render(); window.scrollTo(0, 0); }
    });
  };

  // ── openLabViewModal — READ-ONLY — ────────────────────────────────────────────
  async function openLabViewModal(codigo, repById, sysById, allChamados) {
    const c = await dbGet('clientes', codigo);
    if (!c) return;

    const rep      = repById[c.fk_representante];
    const sys      = sysById[c.fk_sistema];
    const chamados = allChamados
      .filter(ch => ch.fk_cliente === codigo)
      .sort((a, b) => (b.dataSolicitacao || '').localeCompare(a.dataSolicitacao || ''));
    const contatos = Array.isArray(c.contatos) && c.contatos.length
      ? c.contatos
      : (c.NomeContato ? [{ nome: c.NomeContato, cargo: '', telefone: c.Telefone || '', email: '' }] : []);

    const row = (label, val) => val
      ? `<div class="view-row"><span class="view-label">${label}</span><span class="view-val">${val}</span></div>`
      : '';

    openModal(`
      <div class="modal-header">
        <div class="modal-title">${c.NomeFantasia || c.RazaoSocial || '#' + c.Codigo}</div>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
          ${row('Código', `<span style="font-family:var(--mono)">${c.Codigo}</span>`)}
          ${row('UF', `<span class="badge uf">${c.UF || '?'}</span>`)}
        </div>
        ${row('Nome Fantasia', c.NomeFantasia)}
        ${row('Razão Social', c.RazaoSocial)}
        ${row('CNPJ', c.CNPJ || (c.CodMatriz ? 'Ver Matriz #' + c.CodMatriz : null))}
        ${c.CodMatriz ? row('Matriz', `${c.NomeMatriz || ''} · #${c.CodMatriz}`) : ''}
        ${row('Grupo', c.Grupo)}
        ${row('Representante', c.Representante)}
        ${c.assessor ? row('Assessor', `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(196,155,60,.12);color:var(--gold);border:1px solid rgba(196,155,60,.3)">${c.assessor}</span>`) : ''}
        ${c.categoria_especial ? row('Programa', programaBadge(c.categoria_especial)) : ''}
        ${row('Sistema', sys ? `<span class="badge sys">${sys.nome}</span>${sys.empresa ? ' · <span style="color:var(--text3)">' + sys.empresa + '</span>' : ''}` : null)}

        ${contatos.length ? `
          <div class="section-divider">Contatos (${contatos.length})</div>
          ${contatos.map(ct => `
            <div class="contato-item" style="margin-bottom:6px">
              <div class="contato-info">
                <div class="contato-nome">${ct.nome || '—'}${ct.cargo ? ' · <span style="font-weight:400;color:var(--text2)">' + ct.cargo + '</span>' : ''}</div>
                <div class="contato-meta">${[ct.telefone, ct.email].filter(Boolean).join(' · ') || '—'}</div>
              </div>
            </div>`).join('')}
        ` : ''}

        <div class="section-divider">Chamados de Integração (${chamados.length})</div>
        ${chamados.length === 0
          ? `<div style="font-size:12px;color:var(--text3);padding:6px 0">Nenhum chamado registrado.</div>`
          : chamados.map(ch => {
              const sysName = sysById[ch.fk_sistema]?.nome || '—';
              return `<div class="chamado-item">
                <div class="chamado-header">
                  <div>
                    <span class="chamado-num">#${ch.numeroChamado || '—'}</span>
                    <span class="chamado-analista" style="margin-left:8px">${ch.analista || '—'}</span>
                  </div>
                </div>
                <div class="chamado-dates">
                  <span>Solicitação: <strong style="color:var(--text2)">${ch.dataSolicitacao || '—'}</strong></span>
                  ${ch.dataFinalizacao ? `<span>Finalização: <strong style="color:var(--text2)">${ch.dataFinalizacao}</strong></span>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style="font-size:12px;color:var(--text3)">Sistema: <strong style="color:var(--text2)">${sysName}</strong></span>
                  ${ch.tipoIntegracao ? `<span class="badge tag" style="font-size:10px">${ch.tipoIntegracao}</span>` : ''}
                  ${ch.integracaoAtiva
                    ? `<span class="chamado-status-on">✓ Integração Ativa</span>`
                    : ch.dataFinalizacao
                      ? `<span class="chamado-status-off">✗ Integração Inativada</span>`
                      : `<span class="chamado-status-impl">⏳ Em Implantação</span>`}
                </div>
              </div>`;
            }).join('')}
      </div>
      <div class="modal-footer">
        <button class="btn secondary" onclick="closeModal()">Fechar</button>
      </div>
    `);
  }

  // ── openLabModal — EDIÇÃO (sem formulário de criação de chamado) ───────────────
  async function openLabModal(codigo, clientes, reps, sistemas, sysById) {
    const [c, analistasDB] = await Promise.all([
      dbGet('clientes', codigo),
      dbAll('analistas'),
    ]);
    if (!c) return;

    const analistasAtivos = analistasDB.filter(a => a.ativo !== false);

    // Multi-contatos
    let labContatos = Array.isArray(c.contatos) ? [...c.contatos]
      : (c.NomeContato ? [{ nome: c.NomeContato, cargo: '', telefone: c.Telefone || '', email: '' }] : []);

    function renderLabContatosList() {
      const container = document.getElementById('lab-contatos-list');
      if (!container) return;
      container.innerHTML = labContatos.length === 0
        ? `<div style="font-size:12px;color:var(--text3);padding:4px 0">Nenhum contato cadastrado.</div>`
        : labContatos.map((ct, i) => `
          <div class="contato-item">
            <div class="contato-info">
              <div class="contato-nome">${ct.nome || '—'}${ct.cargo ? ' · <span style="font-weight:400;color:var(--text2)">' + ct.cargo + '</span>' : ''}</div>
              <div class="contato-meta">${[ct.telefone, ct.email].filter(Boolean).join(' · ') || '—'}</div>
            </div>
            <button class="contato-del" data-del-lct="${i}" title="Remover">×</button>
          </div>`).join('');
      container.querySelectorAll('[data-del-lct]').forEach(btn => {
        btn.addEventListener('click', () => {
          labContatos.splice(parseInt(btn.dataset.delLct), 1);
          renderLabContatosList();
        });
      });
    }

    // Chamados existentes (somente visualização + edição inline — SEM formulário de criação)
    const allChamadosDB = await dbAll('chamados');
    let chamadosCliente = allChamadosDB
      .filter(ch => ch.fk_cliente === codigo)
      .sort((a, b) => (b.dataSolicitacao || '').localeCompare(a.dataSolicitacao || ''));

    function renderChamadosList() {
      const container = document.getElementById('chamados-list');
      if (!container) return;

      if (chamadosCliente.length === 0) {
        container.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:8px 0">Nenhum chamado registrado para este laboratório.</div>`;
        return;
      }

      const TIPOS_OPTS = ['Convencional (XML)', 'Webservice'];

      container.innerHTML = chamadosCliente.map(ch => {
        const sysName = sysById[ch.fk_sistema]?.nome || '—';
        const sysOpts = sistemas.map(s =>
          `<option value="${s.id}" ${s.id === ch.fk_sistema ? 'selected' : ''}>${s.nome}${s.empresa ? ' · ' + s.empresa : ''}</option>`
        ).join('');
        const anaOpts = `<option value="">— Selecione —</option>` +
          analistasAtivos.map(a =>
            `<option value="${a.nome}" ${a.nome === ch.analista ? 'selected' : ''}>[${a.id}] ${a.nome} · ${a.cargo}</option>`
          ).join('');

        return `<div class="chamado-item" id="ch-item-${ch.id}">
          <div class="chamado-header">
            <div>
              <span class="chamado-num">#${ch.numeroChamado || '—'}</span>
              <span class="chamado-analista" style="margin-left:8px">${ch.analista || '—'}</span>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <button class="chamado-edit-btn" data-edit-ch="${ch.id}" title="Editar chamado">✎</button>
              <button class="chamado-del" data-del-ch="${ch.id}" title="Excluir chamado">×</button>
            </div>
          </div>
          <div class="chamado-dates">
            <span>Solicitação: <strong style="color:var(--text2)">${ch.dataSolicitacao || '—'}</strong></span>
            ${ch.dataFinalizacao ? `<span>${ch.integracaoAtiva ? 'Finalização' : 'Inativação'}: <strong style="color:var(--text2)">${ch.dataFinalizacao}</strong></span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:12px;color:var(--text3)">Sistema: <strong style="color:var(--text2)">${sysName}</strong></span>
            ${ch.tipoIntegracao ? `<span class="badge tag" style="font-size:10px">${ch.tipoIntegracao}</span>` : ''}
            ${ch.integracaoAtiva
              ? `<span class="chamado-status-on">✓ Integração Ativa</span>`
              : ch.dataFinalizacao
                ? `<span class="chamado-status-off">✗ Integração Inativada</span>`
                : `<span class="chamado-status-impl">⏳ Em Implantação</span>`}
          </div>
          <!-- Inline edit form (hidden by default) -->
          <div class="chamado-edit-form" id="ch-edit-form-${ch.id}">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
              <div><div class="field-label" style="font-size:10px;margin-bottom:3px">Número</div>
                <input type="text" id="ch-e-num-${ch.id}" value="${ch.numeroChamado || ''}" style="padding:5px 8px;font-size:12px"></div>
              <div><div class="field-label" style="font-size:10px;margin-bottom:3px">Analista</div>
                <select id="ch-e-ana-${ch.id}" style="padding:5px 8px;font-size:12px;width:100%">${anaOpts}</select></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
              <div><div class="field-label" style="font-size:10px;margin-bottom:3px">Solicitação</div>
                <input type="date" id="ch-e-sol-${ch.id}" value="${ch.dataSolicitacao || ''}" style="padding:5px 8px;font-size:12px"></div>
              <div><div class="field-label" style="font-size:10px;margin-bottom:3px">Finalização / Inativação</div>
                <input type="date" id="ch-e-fin-${ch.id}" value="${ch.dataFinalizacao || ''}" style="padding:5px 8px;font-size:12px"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
              <div><div class="field-label" style="font-size:10px;margin-bottom:3px">Sistema</div>
                <select id="ch-e-sys-${ch.id}" style="padding:5px 8px;font-size:12px;width:100%">
                  <option value="">— Nenhum —</option>${sysOpts}
                </select></div>
              <div><div class="field-label" style="font-size:10px;margin-bottom:3px">Tipo</div>
                <select id="ch-e-tipo-${ch.id}" style="padding:5px 8px;font-size:12px;width:100%">
                  <option value="">— Selecione —</option>
                  ${TIPOS_OPTS.map(t => `<option value="${t}" ${ch.tipoIntegracao === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select></div>
            </div>
            <div class="checkbox-row" style="margin-bottom:10px">
              <input type="checkbox" id="ch-e-int-${ch.id}" ${ch.integracaoAtiva ? 'checked' : ''}>
              <label for="ch-e-int-${ch.id}" style="font-size:12px;cursor:pointer">Integração Ativa</label>
            </div>
            <div style="display:flex;gap:6px">
              <button class="chamado-edit-btn save" data-save-ch="${ch.id}">Salvar</button>
              <button class="chamado-edit-btn" data-cancel-ch="${ch.id}">Cancelar</button>
            </div>
          </div>
        </div>`;
      }).join('');

      // Bind delete
      container.querySelectorAll('[data-del-ch]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Excluir este chamado?')) return;
          const chId = parseInt(btn.dataset.delCh);
          await dbDelete('chamados', chId);
          chamadosCliente = chamadosCliente.filter(ch => ch.id !== chId);
          renderChamadosList();
          toast('Chamado excluído.', 'info');
        });
      });

      // Bind edit toggle
      container.querySelectorAll('[data-edit-ch]').forEach(btn => {
        btn.addEventListener('click', () => {
          const chId = btn.dataset.editCh;
          const item = document.getElementById(`ch-item-${chId}`);
          const form = document.getElementById(`ch-edit-form-${chId}`);
          const isOpen = item.classList.contains('editing');
          container.querySelectorAll('.chamado-item.editing').forEach(el => el.classList.remove('editing'));
          container.querySelectorAll('.chamado-edit-form').forEach(el => { el.style.display = 'none'; });
          if (!isOpen) { item.classList.add('editing'); form.style.display = 'block'; }
        });
      });

      // Bind cancel
      container.querySelectorAll('[data-cancel-ch]').forEach(btn => {
        btn.addEventListener('click', () => {
          const chId = btn.dataset.cancelCh;
          document.getElementById(`ch-item-${chId}`)?.classList.remove('editing');
          const form = document.getElementById(`ch-edit-form-${chId}`);
          if (form) form.style.display = 'none';
        });
      });

      // Bind save (edição inline — mantida)
      container.querySelectorAll('[data-save-ch]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const chId      = parseInt(btn.dataset.saveCh);
          const numero    = document.getElementById(`ch-e-num-${chId}`)?.value.trim();
          const analista  = document.getElementById(`ch-e-ana-${chId}`)?.value.trim();
          const dataSol   = document.getElementById(`ch-e-sol-${chId}`)?.value;
          const dataFin   = document.getElementById(`ch-e-fin-${chId}`)?.value;
          const fk_sistema = parseInt(document.getElementById(`ch-e-sys-${chId}`)?.value) || null;
          const tipoInt   = document.getElementById(`ch-e-tipo-${chId}`)?.value;
          const integAtiva = document.getElementById(`ch-e-int-${chId}`)?.checked;

          if (!numero) { toast('Número do chamado obrigatório.', 'error'); return; }

          const idx = chamadosCliente.findIndex(ch => ch.id === chId);
          if (idx === -1) return;

          const updated = {
            ...chamadosCliente[idx],
            numeroChamado:  numero,
            analista,
            dataSolicitacao: dataSol || null,
            dataFinalizacao: dataFin || null,
            fk_sistema,
            tipoIntegracao:  tipoInt,
            integracaoAtiva: integAtiva,
          };
          await dbPut('chamados', updated);

          if (integAtiva && fk_sistema) {
            const freshCliente = await dbGet('clientes', codigo);
            if (freshCliente) await dbPut('clientes', { ...freshCliente, fk_sistema, _manual_fk_sistema: true });
          }

          chamadosCliente[idx] = updated;
          chamadosCliente.sort((a, b) => (b.dataSolicitacao || '').localeCompare(a.dataSolicitacao || ''));
          renderChamadosList();
          toast('Chamado atualizado.', 'success');
        });
      });
    }

    // ── HTML do modal de edição ───────────────────────────────────────────────
    const overlay = openModal(`
      <div class="modal-header">
        <div class="modal-title">Laboratório · #${c.Codigo}</div>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="lock-note" style="margin-bottom:16px;padding:8px 12px;background:var(--bg3);border-radius:var(--r);border:1px solid var(--border)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="color:var(--gold)"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
          <span>Campos da planilha são somente leitura. Campos editáveis abaixo são preservados na próxima importação.</span>
        </div>

        <div class="two-col">
          <div class="field-group"><div class="field-label">Nome Fantasia</div><div class="field-val locked">${c.NomeFantasia || '—'}</div></div>
          <div class="field-group"><div class="field-label">Código</div><div class="field-val locked">${c.Codigo}</div></div>
        </div>
        <div class="field-group"><div class="field-label">Razão Social</div><div class="field-val locked">${c.RazaoSocial || '—'}</div></div>
        <div class="two-col">
          <div class="field-group"><div class="field-label">CNPJ</div><div class="field-val locked">${c.CNPJ || (c.CodMatriz ? 'Ver Matriz #' + c.CodMatriz : '—')}</div></div>
          <div class="field-group"><div class="field-label">UF</div><div class="field-val locked">${c.UF || '—'}</div></div>
        </div>
        ${c.CodMatriz ? `<div class="field-group"><div class="field-label">Matriz</div><div class="field-val locked">${c.NomeMatriz || ''} · #${c.CodMatriz}</div></div>` : ''}
        <div class="two-col">
          <div class="field-group"><div class="field-label">Grupo</div><div class="field-val locked">${c.Grupo || '—'}</div></div>
          <div class="field-group"><div class="field-label">Representante</div><div class="field-val locked">${c.Representante || '—'}</div></div>
        </div>

        <div class="section-divider">Campos Editáveis — Contatos</div>
        <div id="lab-contatos-list" style="margin-bottom:8px"></div>
        <div class="contato-add-form">
          <div class="field-label" style="margin-bottom:8px">Adicionar Contato</div>
          <div class="two-col" style="margin-bottom:8px">
            <div class="field-group" style="margin:0"><div class="field-label">Nome</div><input type="text" id="lct-nome" placeholder="Nome do responsável"></div>
            <div class="field-group" style="margin:0"><div class="field-label">Cargo</div><input type="text" id="lct-cargo" placeholder="Cargo / função"></div>
          </div>
          <div class="two-col" style="margin-bottom:8px">
            <div class="field-group" style="margin:0"><div class="field-label">Telefone</div><input type="tel" id="lct-tel" placeholder="(00) 00000-0000"></div>
            <div class="field-group" style="margin:0"><div class="field-label">E-mail</div><input type="email" id="lct-email" placeholder="email@exemplo.com"></div>
          </div>
          <button class="btn secondary" id="add-lct-btn" style="width:100%">+ Adicionar Contato</button>
        </div>

        <div class="section-divider" style="display:flex;align-items:center;justify-content:space-between">
          <span>Chamados de Integração (${chamadosCliente.length})</span>
          ${canBtn('chamados', 'new-btn')
            ? `<button class="btn sm" id="go-chamados-btn" style="font-size:11px;padding:4px 10px">+ Novo Chamado →</button>`
            : ''}
        </div>
        <div id="chamados-list" style="margin-bottom:12px"></div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn" id="save-lab">Salvar Dados do Lab</button>
      </div>
    `);

    renderChamadosList();
    renderLabContatosList();

    // Botão "Novo Chamado →" redireciona para a página de chamados
    const goChamadosBtn = overlay.querySelector('#go-chamados-btn');
    if (goChamadosBtn) {
      goChamadosBtn.addEventListener('click', () => {
        closeModal();
        if (typeof global.navigate === 'function') global.navigate('chamados');
      });
    }

    // Add contato
    overlay.querySelector('#add-lct-btn').addEventListener('click', () => {
      const nome = overlay.querySelector('#lct-nome').value.trim();
      if (!nome) { toast('Informe ao menos o nome do contato.', 'error'); return; }
      labContatos.push({
        nome,
        cargo:    overlay.querySelector('#lct-cargo').value.trim(),
        telefone: overlay.querySelector('#lct-tel').value.trim(),
        email:    overlay.querySelector('#lct-email').value.trim(),
      });
      renderLabContatosList();
      overlay.querySelector('#lct-nome').value    = '';
      overlay.querySelector('#lct-cargo').value   = '';
      overlay.querySelector('#lct-tel').value     = '';
      overlay.querySelector('#lct-email').value   = '';
      overlay.querySelector('#lct-nome').focus();
    });

    // Save lab fields
    overlay.querySelector('#save-lab').addEventListener('click', async () => {
      const updated       = { ...c };
      updated.contatos    = labContatos;
      updated.NomeContato = labContatos[0]?.nome    || null;
      updated.Telefone    = labContatos[0]?.telefone || null;
      updated._manual_NomeContato = labContatos.length > 0;
      updated._manual_Telefone    = !!(labContatos[0]?.telefone);
      await dbPut('clientes', updated);
      await auditLog('Editou laboratório', `#${updated.Codigo} ${updated.NomeFantasia || updated.RazaoSocial || ''}`);
      toast('Laboratório atualizado com sucesso.', 'success');
      closeModal();
      pages.laboratorios();
    });
  }

})(window);
