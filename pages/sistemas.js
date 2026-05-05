// pages/sistemas.js — Página Sistemas da Fase 4
(function (global) {
  "use strict";

  var pages = global.pages || {};
  global.pages = pages;

  // ===================== PAGE: SISTEMAS =====================
  pages.sistemas = async function() {
    updateTopbar('Sistemas Laboratoriais', 'Gestão de sistemas integrados', `<button class="btn" id="new-sys-btn">+ Novo Sistema</button>`);

    const renderSistemas = async (search = '', filterTipo = '') => {
      const [sistemas, clientes] = await Promise.all([dbAll('sistemas'), dbAll('clientes')]);

      const sysClientCount = {};
      for (const c of clientes) {
        if (c.fk_sistema) sysClientCount[c.fk_sistema] = (sysClientCount[c.fk_sistema] || 0) + 1;
      }

      let filtered = sistemas.filter(s => {
        const ok = !search || s.nome.toLowerCase().includes(search.toLowerCase()) || (s.empresa||'').toLowerCase().includes(search.toLowerCase());
        const tiposArr = Array.isArray(s.tipoIntegracao) ? s.tipoIntegracao : (s.tipoIntegracao ? [s.tipoIntegracao] : []);
        const tipoOk = !filterTipo || tiposArr.includes(filterTipo);
        return ok && tipoOk;
      });

      const tbody = document.getElementById('sys-table-body');
      if (!tbody) return;

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text3)">Nenhum sistema cadastrado. Clique em "+ Novo Sistema" para adicionar.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered.map(s => {
        const tiposArr = Array.isArray(s.tipoIntegracao) ? s.tipoIntegracao : (s.tipoIntegracao ? [s.tipoIntegracao] : []);
        const configArr = Array.isArray(s.configuracao)  ? s.configuracao  : (s.configuracao  ? [s.configuracao]  : []);
        const vinculados = sysClientCount[s.id] || 0;
        const contatos = Array.isArray(s.contatos) ? s.contatos : (s.contatoNome ? [{nome:s.contatoNome, telefone:s.contatoTelefone||''}] : []);
        const ct = contatos[0];
        const obs = s.observacoes ? (s.observacoes.length > 50 ? s.observacoes.slice(0,50)+'…' : s.observacoes) : '';
        return `<tr>
          <td>
            <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--accent2);background:rgba(15,155,148,.08);padding:2px 7px;border-radius:4px;border:1px solid rgba(15,155,148,.2)">
              ${s.codigoSistema || '—'}
            </span>
          </td>
          <td>
            <div style="font-weight:700;color:var(--navy);font-size:13px">${s.nome}</div>
            <div style="font-size:11px;color:var(--text3)">${s.empresa||'—'}</div>
          </td>
          <td>
            <div style="display:flex;flex-wrap:wrap;gap:3px">
              ${tiposArr.map(t=>`<span class="badge sys" style="font-size:10px">${t}</span>`).join('')}
            </div>
          </td>
          <td>
            <div style="display:flex;flex-wrap:wrap;gap:3px">
              ${configArr.map(c=>`<span class="badge tag" style="font-size:10px">${c}</span>`).join('')}
            </div>
          </td>
          <td style="font-size:11px">${s.metodos?.length ? s.metodos.slice(0,3).map(m=>`<span class="badge tag" style="font-size:9px">${m}</span>`).join(' ') + (s.metodos.length>3?` <span style="color:var(--text3)">+${s.metodos.length-3}</span>`:'') : '—'}</td>
          <td style="text-align:center"><span class="sys-linked-badge">🔗 ${vinculados}</span></td>
          <td style="font-size:12px">
            ${ct ? `<div style="font-weight:500;color:var(--navy)">${ct.nome}</div><div style="font-size:10px;color:var(--text3)">${ct.telefone||ct.email||''}</div>` : '<span style="color:var(--text3)">—</span>'}
            ${contatos.length > 1 ? `<div style="font-size:10px;color:var(--text3)">+${contatos.length-1} contato(s)</div>` : ''}
          </td>
          <td style="font-size:11px;color:var(--text3);max-width:160px">${obs||'—'}</td>
          <td style="white-space:nowrap">
            <div style="display:flex;gap:5px">
              <button class="btn sm secondary" data-view-sys="${s.id}" style="font-size:11px;padding:4px 8px">Ver</button>
              ${canBtn('sistemas','edit-btn') ? `<button class="btn sm secondary" data-edit-sys="${s.id}" style="font-size:11px;padding:4px 8px">Editar</button>` : ''}
              ${canBtn('sistemas','edit-btn') ? `<button class="btn sm danger" data-del-sys="${s.id}" style="font-size:11px;padding:4px 8px">×</button>` : ''}
            </div>
          </td>
        </tr>`;
      }).join('');

      // Sortable on sistemas table
      const sysTheadEl = tbody.closest('table')?.querySelector('thead');
      if (sysTheadEl) makeSortable(sysTheadEl, tbody, filtered, [
        { getValue: s => s.codigoSistema || '' },
        { getValue: s => s.nome },
        { getValue: s => s.empresa || '' },
        { getValue: s => (Array.isArray(s.tipoIntegracao) ? s.tipoIntegracao : [s.tipoIntegracao||'']).join(',') },
        { getValue: s => (Array.isArray(s.configuracao) ? s.configuracao : [s.configuracao||'']).join(',') },
        { getValue: s => sysClientCount[s.id] || 0 },
      ], s => {
        const tiposArr2 = Array.isArray(s.tipoIntegracao) ? s.tipoIntegracao : (s.tipoIntegracao ? [s.tipoIntegracao] : []);
        const configArr2 = Array.isArray(s.configuracao)  ? s.configuracao  : (s.configuracao  ? [s.configuracao]  : []);
        const vinc2 = sysClientCount[s.id] || 0;
        const contatos2 = Array.isArray(s.contatos) ? s.contatos : (s.contatoNome ? [{nome:s.contatoNome}] : []);
        const ct2 = contatos2[0];
        const obs2 = s.observacoes ? (s.observacoes.length>50?s.observacoes.slice(0,50)+'…':s.observacoes) : '';
        return `<tr>
          <td><span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--accent2);background:rgba(15,155,148,.08);padding:2px 7px;border-radius:4px;border:1px solid rgba(15,155,148,.2)">${s.codigoSistema||'—'}</span></td>
          <td><div style="font-weight:700;color:var(--navy);font-size:13px">${s.nome}</div><div style="font-size:11px;color:var(--text3)">${s.empresa||'—'}</div></td>
          <td><div style="display:flex;flex-wrap:wrap;gap:3px">${tiposArr2.map(t=>`<span class="badge sys" style="font-size:10px">${t}</span>`).join('')}</div></td>
          <td><div style="display:flex;flex-wrap:wrap;gap:3px">${configArr2.map(c=>`<span class="badge tag" style="font-size:10px">${c}</span>`).join('')}</div></td>
          <td style="font-size:11px">${s.metodos?.length?s.metodos.slice(0,3).map(m=>`<span class="badge tag" style="font-size:9px">${m}</span>`).join(' ')+(s.metodos.length>3?` <span style="color:var(--text3)">+${s.metodos.length-3}</span>`:''):'—'}</td>
          <td style="text-align:center"><span class="sys-linked-badge">🔗 ${vinc2}</span></td>
          <td style="font-size:12px">${ct2?`<div style="font-weight:500;color:var(--navy)">${ct2.nome}</div>`:'<span style="color:var(--text3)">—</span>'}${contatos2.length>1?`<div style="font-size:10px;color:var(--text3)">+${contatos2.length-1} contato(s)</div>`:''}</td>
          <td style="font-size:11px;color:var(--text3);max-width:160px">${obs2||'—'}</td>
          <td style="white-space:nowrap"><div style="display:flex;gap:5px">
            <button class="btn sm secondary" data-view-sys="${s.id}" style="font-size:11px;padding:4px 8px">Ver</button>
            ${canBtn('sistemas','edit-btn')?`<button class="btn sm secondary" data-edit-sys="${s.id}" style="font-size:11px;padding:4px 8px">Editar</button>`:''}
            ${canBtn('sistemas','edit-btn')?`<button class="btn sm danger" data-del-sys="${s.id}" style="font-size:11px;padding:4px 8px">×</button>`:''}
          </div></td>
        </tr>`;
      });

      tbody.querySelectorAll('[data-view-sys]').forEach(btn => {
        btn.addEventListener('click', () => openSysViewModal(parseInt(btn.dataset.viewSys), sysClientCount));
      });

      tbody.querySelectorAll('[data-edit-sys]').forEach(btn => {
        btn.addEventListener('click', () => openSysModal(parseInt(btn.dataset.editSys), renderSistemas, search, filterTipo));
      });
      tbody.querySelectorAll('[data-del-sys]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm('Excluir este sistema?')) {
            await dbDelete('sistemas', parseInt(btn.dataset.delSys));
            toast('Sistema excluído.', 'info');
            renderSistemas(search, filterTipo);
          }
        });
      });
    };

    document.getElementById('content').innerHTML = `
      <div class="toolbar">
        <div class="search-wrap" style="flex:2;min-width:200px">
          <span class="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></span>
          <input type="text" placeholder="Buscar por nome ou empresa..." id="sys-search">
        </div>
        <select id="sys-tipo">
          <option value="">Todos os tipos</option>
          <option>Convencional</option><option>Webservice</option><option>Etiqueta Primária</option>
        </select>
      </div>
      <div class="table-wrap">
        <table style="width:100%">
          <thead><tr>
            <th style="width:90px" data-sort="0">Cód. Sistema</th>
            <th data-sort="1">Sistema</th>
            <th data-sort="2">Tipo Integração</th>
            <th data-sort="3">Configuração</th>
            <th>Métodos</th>
            <th style="width:80px;text-align:center" data-sort="5">Vinculados</th>
            <th>Contato Principal</th>
            <th>Observações</th>
            <th style="width:100px">Ações</th>
          </tr></thead>
          <tbody id="sys-table-body"></tbody>
        </table>
      </div>
    `;

    await renderSistemas();
    document.getElementById('sys-search').addEventListener('input', e => renderSistemas(e.target.value, document.getElementById('sys-tipo').value));
    document.getElementById('sys-tipo').addEventListener('change', e => renderSistemas(document.getElementById('sys-search').value, e.target.value));
    document.getElementById('new-sys-btn').addEventListener('click', () => openSysModal(null, renderSistemas));
  };

  // ===================== SISTEMA — MODAL VER =====================
  async function openSysViewModal(id, sysClientCount) {
    const [sys, allClientes, chamados] = await Promise.all([
      dbGet('sistemas', id), dbAll('clientes'), dbAll('chamados')
    ]);
    if (!sys) return;

    const tiposArr  = Array.isArray(sys.tipoIntegracao) ? sys.tipoIntegracao : (sys.tipoIntegracao ? [sys.tipoIntegracao] : []);
    const configArr = Array.isArray(sys.configuracao)   ? sys.configuracao   : (sys.configuracao   ? [sys.configuracao]   : []);
    const contatos  = Array.isArray(sys.contatos)       ? sys.contatos       : (sys.contatoNome ? [{nome:sys.contatoNome, cargo:sys.contatoCargo||'', telefone:sys.contatoTelefone||'', email:sys.contatoEmail||''}] : []);

    const vinculados = allClientes.filter(c => c.fk_sistema === id);
    const vinc = sysClientCount?.[id] ?? vinculados.length;

    const row = (l, v) => `<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">
      <span style="color:var(--text3);min-width:130px;font-weight:500">${l}</span>
      <span style="color:var(--text)">${v}</span>
    </div>`;

    openModal(`
      <div class="modal-header">
        <div class="modal-title">
          <span style="font-family:var(--mono);font-size:12px;color:var(--accent2);margin-right:8px">${sys.codigoSistema||''}</span>
          ${sys.nome}
        </div>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        ${row('Empresa', sys.empresa || '—')}
        ${row('Tipo Integração', tiposArr.length ? tiposArr.map(t=>`<span class="badge sys" style="font-size:11px">${t}</span>`).join(' ') : '—')}
        ${row('Configuração', configArr.length ? configArr.map(c=>`<span class="badge tag" style="font-size:11px">${c}</span>`).join(' ') : '—')}
        ${row('Métodos', sys.metodos?.length ? sys.metodos.map(m=>`<span class="badge tag" style="font-size:11px">${m}</span>`).join(' ') : '—')}
        ${row('Laboratórios vinculados', `<strong style="color:var(--accent2)">${vinc}</strong>`)}
        ${sys.propostaHabilitada ? row('Proposta', `R$ ${Number(sys.valorProposta||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`) : ''}
        ${sys.mensalidadeHabilitada ? row('Mensalidade', `R$ ${Number(sys.valorMensalidade||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}/mês`) : ''}
        ${sys.observacoes ? row('Observações', `<span style="color:var(--text2)">${sys.observacoes}</span>`) : ''}

        ${contatos.length ? `
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin:14px 0 8px">Contatos</div>
          ${contatos.map(ct => `
            <div style="padding:8px;background:var(--bg2);border-radius:var(--r);margin-bottom:6px;font-size:12px">
              <div style="font-weight:600;color:var(--navy)">${ct.nome}${ct.cargo?` <span style="font-weight:400;color:var(--text3)">· ${ct.cargo}</span>`:''}</div>
              ${ct.telefone?`<div style="color:var(--text2)">${ct.telefone}</div>`:''}
              ${ct.email?`<div style="color:var(--text2)">${ct.email}</div>`:''}
            </div>`).join('')}` : ''}
      </div>
      <div class="modal-footer">
        ${canBtn('sistemas','edit-btn') ? `<button class="btn secondary" onclick="closeModal();openSysModal(${id},()=>navigate('sistemas'))">Editar</button>` : ''}
        <button class="btn" onclick="closeModal()">Fechar</button>
      </div>
    `);
  }

  // ===================== ANALISTA — MODAL VER =====================
  async function openAnalistaViewModal(anaId) {
    // Resolve chave (string ou numérica legada)
    let ana = null;
    try { ana = await dbGet('analistas', anaId); } catch(_) {}
    if (!ana && !isNaN(Number(anaId))) {
      try { ana = await dbGet('analistas', Number(anaId)); } catch(_) {}
    }
    if (!ana) return;

    const [chamados, clientes] = await Promise.all([dbAll('chamados'), dbAll('clientes')]);
    const clienteByCode = {}; for (const c of clientes) clienteByCode[c.Codigo] = c;

    // Chamados deste analista — considera apenas o chamado mais recente por cliente
    const meusChamados = chamados.filter(ch => ch.analista === ana.nome);

    // Para cada cliente, pega apenas o chamado com data de solicitação mais recente
    const ultimoPorCliente = {};
    for (const ch of meusChamados) {
      const cod = ch.fk_cliente;
      if (!cod) continue;
      const prev = ultimoPorCliente[cod];
      const dtCh  = ch.dataSolicitacao || '';
      const dtPrev = prev?.dataSolicitacao || '';
      if (!prev || dtCh > dtPrev) ultimoPorCliente[cod] = ch;
    }

    // Classifica por status do chamado mais recente de cada cliente
    const integrados   = [];
    const implantacao  = [];
    const inativados   = [];

    for (const ch of Object.values(ultimoPorCliente)) {
      const cli = clienteByCode[ch.fk_cliente];
      const nome = cli ? (cli.NomeFantasia || cli.RazaoSocial || `Cód. ${ch.fk_cliente}`) : `Cód. ${ch.fk_cliente}`;
      const item = { nome, codigo: ch.fk_cliente, chamado: ch.numeroChamado || ch.id, data: ch.dataSolicitacao };

      if (ch.integracaoAtiva) integrados.push(item);
      else if (ch.dataFinalizacao) inativados.push(item);
      else implantacao.push(item);
    }

    const secao = (titulo, cor, lista) => lista.length === 0 ? '' : `
      <div style="margin-top:14px">
        <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${cor};margin-bottom:6px">${titulo} (${lista.length})</div>
        <div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r)">
          <table style="width:100%;font-size:12px">
            <thead><tr style="background:var(--bg2)">
              <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text3)">Cód.</th>
              <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text3)">Cliente</th>
              <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text3)">Chamado</th>
              <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text3)">Data</th>
            </tr></thead>
            <tbody>
              ${lista.map(it => `<tr style="border-top:1px solid var(--border)">
                <td style="padding:5px 8px;font-family:var(--mono);color:var(--text3)">${it.codigo}</td>
                <td style="padding:5px 8px;font-weight:500;color:var(--navy)">${it.nome}</td>
                <td style="padding:5px 8px;color:var(--text2)">${it.chamado}</td>
                <td style="padding:5px 8px;color:var(--text3)">${it.data ? it.data.slice(0,10) : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    const cargoColor = { 'Analista Junior':'var(--text2)', 'Analista Pleno':'var(--accent2)', 'Analista Sênior':'var(--navy)' };

    openModal(`
      <div class="modal-header">
        <div class="modal-title">
          <span style="font-family:var(--mono);font-size:11px;color:var(--accent2);margin-right:8px">[${ana.id}]</span>
          ${ana.nome}
        </div>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:12px;align-items:center;padding:10px;background:var(--bg2);border-radius:var(--r);margin-bottom:4px">
          <div>
            <span style="font-size:12px;font-weight:700;color:${cargoColor[ana.cargo]||'var(--text2)'};padding:2px 10px;background:rgba(0,0,0,.05);border-radius:10px">${ana.cargo||'—'}</span>
            ${ana.ativo===false ? '<span style="font-size:11px;color:var(--text3);margin-left:8px">· Inativo</span>' : '<span style="font-size:11px;color:var(--accent2);margin-left:8px">· Ativo</span>'}
          </div>
          ${ana.email ? `<a href="mailto:${ana.email}" style="font-size:12px;color:var(--accent2)">${ana.email}</a>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0">
          <div style="padding:10px;background:rgba(15,155,148,.07);border-radius:var(--r);text-align:center;border:1px solid rgba(15,155,148,.2)">
            <div style="font-size:22px;font-weight:700;color:var(--accent2)">${integrados.length}</div>
            <div style="font-size:11px;color:var(--text3)">Integrados</div>
          </div>
          <div style="padding:10px;background:rgba(196,155,60,.07);border-radius:var(--r);text-align:center;border:1px solid rgba(196,155,60,.25)">
            <div style="font-size:22px;font-weight:700;color:var(--gold)">${implantacao.length}</div>
            <div style="font-size:11px;color:var(--text3)">Em Implantação</div>
          </div>
          <div style="padding:10px;background:rgba(232,88,88,.07);border-radius:var(--r);text-align:center;border:1px solid rgba(232,88,88,.2)">
            <div style="font-size:22px;font-weight:700;color:var(--red)">${inativados.length}</div>
            <div style="font-size:11px;color:var(--text3)">Inativados</div>
          </div>
        </div>

        ${secao('Integrados', 'var(--accent2)', integrados)}
        ${secao('Em Implantação', 'var(--gold)', implantacao)}
        ${secao('Inativados', 'var(--red)', inativados)}
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal()">Fechar</button>
      </div>
    `);
  }

  // ===================== SISTEMA — MODAL EDITAR =====================
  function openSysModal(id, refresh, search = '', filterTipo = '') {
    Promise.resolve(id ? dbGet('sistemas', id) : null).then(sys => {
      const isNew = !sys;

      sys = sys || {};
      const defTipos   = Array.isArray(sys.tipoIntegracao) ? sys.tipoIntegracao : (sys.tipoIntegracao ? [sys.tipoIntegracao] : []);
      const defConfigs = Array.isArray(sys.configuracao)   ? sys.configuracao   : (sys.configuracao   ? [sys.configuracao]   : []);
      // Coerce contatos to array (backward compat with single-contato records)
      let contatos = Array.isArray(sys.contatos) ? [...sys.contatos]
        : (sys.contatoNome ? [{ nome: sys.contatoNome, cargo: sys.contatoCargo||'', telefone: sys.contatoTelefone||'', email: sys.contatoEmail||'' }] : []);

      const TIPOS_OPTS  = ['Convencional', 'Webservice', 'Etiqueta Primária'];
      const CONFIG_OPTS = ['Softhouse', 'Grupo DB', 'Treinamento Cliente'];

      const renderChecks = (opts, selected, prefix) =>
        opts.map(o => `
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);cursor:pointer;padding:4px 0">
            <input type="checkbox" name="${prefix}" value="${o}" ${selected.includes(o)?'checked':''} style="width:14px;height:14px;accent-color:var(--accent)">
            ${o}
          </label>`).join('');

      function renderContatosList(container) {
        if (!container) return;
        container.innerHTML = contatos.length === 0
          ? `<div style="font-size:12px;color:var(--text3);padding:4px 0">Nenhum contato cadastrado.</div>`
          : contatos.map((ct, i) => `
            <div class="contato-item">
              <div class="contato-info">
                <div class="contato-nome">${ct.nome || '—'}${ct.cargo ? ' · <span style="font-weight:400;color:var(--text2)">' + ct.cargo + '</span>' : ''}</div>
                <div class="contato-meta">${[ct.telefone, ct.email].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <button class="contato-del" data-del-ct="${i}" title="Remover contato">×</button>
            </div>`).join('');

        container.querySelectorAll('[data-del-ct]').forEach(btn => {
          btn.addEventListener('click', () => {
            contatos.splice(parseInt(btn.dataset.delCt), 1);
            renderContatosList(container);
          });
        });
      }

      const overlay = openModal(`
        <div class="modal-header">
          <div class="modal-title">${isNew ? 'Novo Sistema' : 'Editar Sistema'}</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="two-col">
            <div class="field-group">
              <div class="field-label">Código do Sistema *
                <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text3)">
                  ${isNew ? '(único, imutável após salvar)' : '(não pode ser alterado)'}
                </span>
              </div>
              <input type="text" id="sys-codigo"
                value="${sys.codigoSistema||''}"
                ${!isNew ? 'readonly style="opacity:.6;font-family:var(--mono)"' : 'placeholder="Ex: LIS-001, TOTVS-02..."'}
                style="font-family:var(--mono);font-weight:600">
            </div>
            <div class="field-group"><div class="field-label">Nome do Sistema *</div><input type="text" id="sys-nome" value="${sys.nome||''}"></div>
          </div>
          <div class="two-col">
            <div class="field-group"><div class="field-label">Empresa</div><input type="text" id="sys-empresa" value="${sys.empresa||''}"></div>
          </div>
          <div class="two-col">
            <div class="field-group">
              <div class="field-label">Tipo de Integração <span style="color:var(--text3);font-weight:400;text-transform:none;letter-spacing:0">(múltipla escolha)</span></div>
              <div class="multi-check-group" id="tipos-wrap">${renderChecks(TIPOS_OPTS, defTipos, 'tipo-int')}</div>
            </div>
            <div class="field-group">
              <div class="field-label">Configuração <span style="color:var(--text3);font-weight:400;text-transform:none;letter-spacing:0">(múltipla escolha)</span></div>
              <div class="multi-check-group" id="configs-wrap">${renderChecks(CONFIG_OPTS, defConfigs, 'config-opt')}</div>
            </div>
          </div>

          <div class="section-divider">Contatos</div>
          <div id="sys-contatos-list" style="margin-bottom:8px"></div>
          <div class="contato-add-form">
            <div class="field-label" style="margin-bottom:8px">Adicionar Contato</div>
            <div class="two-col" style="margin-bottom:8px">
              <div class="field-group" style="margin:0"><div class="field-label">Nome</div><input type="text" id="ct-nome" placeholder="Nome completo"></div>
              <div class="field-group" style="margin:0"><div class="field-label">Cargo</div><input type="text" id="ct-cargo" placeholder="Cargo / função"></div>
            </div>
            <div class="two-col" style="margin-bottom:8px">
              <div class="field-group" style="margin:0"><div class="field-label">Telefone</div><input type="tel" id="ct-tel" placeholder="(00) 00000-0000"></div>
              <div class="field-group" style="margin:0"><div class="field-label">E-mail</div><input type="email" id="ct-email" placeholder="email@exemplo.com"></div>
            </div>
            <button class="btn secondary" id="add-ct-btn" style="width:100%">+ Adicionar Contato</button>
          </div>

          <div class="section-divider">Métodos Desenvolvidos</div>
          <div class="field-group">
            <div class="tags-wrap" id="metodos-tags">${(sys.metodos||[]).map(m=>`<span class="badge tag" data-m="${m}">${m} <span style="cursor:pointer;margin-left:4px" onclick="this.parentElement.remove()">×</span></span>`).join('')}</div>
            <div class="tag-input-wrap">
              <input type="text" id="metodo-input" placeholder="Digitar método e pressionar Enter...">
              <button class="btn secondary" id="add-metodo-btn">Add</button>
            </div>
          </div>

          <div class="section-divider">Observações</div>
          <div class="field-group">
            <textarea id="sys-obs" rows="3" placeholder="Observações livres sobre o sistema...">${sys.observacoes||''}</textarea>
          </div>

          <div class="section-divider">Financeiro</div>
          <div class="checkbox-row">
            <input type="checkbox" id="prop-check" ${sys.propostaHabilitada?'checked':''}>
            <label for="prop-check" style="font-size:13px;cursor:pointer">Habilitar Proposta</label>
          </div>
          <div id="prop-val-wrap" class="${sys.propostaHabilitada?'':'hidden'}" style="margin-bottom:12px">
            <div class="field-label">Valor da Proposta (R$)</div>
            <input type="number" id="sys-prop-val" value="${sys.valorProposta||0}" min="0" step="0.01">
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="mens-check" ${sys.mensalidadeHabilitada?'checked':''}>
            <label for="mens-check" style="font-size:13px;cursor:pointer">Habilitar Mensalidade</label>
          </div>
          <div id="mens-val-wrap" class="${sys.mensalidadeHabilitada?'':'hidden'}">
            <div class="field-label">Valor da Mensalidade (R$)</div>
            <input type="number" id="sys-mens-val" value="${sys.valorMensalidade||0}" min="0" step="0.01">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn secondary" onclick="closeModal()">Cancelar</button>
          <button class="btn" id="save-sys">Salvar</button>
        </div>
      `);

      renderContatosList(overlay.querySelector('#sys-contatos-list'));

      overlay.querySelector('#add-ct-btn').addEventListener('click', () => {
        const nome = overlay.querySelector('#ct-nome').value.trim();
        if (!nome) { toast('Informe ao menos o nome do contato.', 'error'); return; }
        contatos.push({
          nome,
          cargo:    overlay.querySelector('#ct-cargo').value.trim(),
          telefone: overlay.querySelector('#ct-tel').value.trim(),
          email:    overlay.querySelector('#ct-email').value.trim(),
        });
        renderContatosList(overlay.querySelector('#sys-contatos-list'));
        overlay.querySelector('#ct-nome').value = '';
        overlay.querySelector('#ct-cargo').value = '';
        overlay.querySelector('#ct-tel').value = '';
        overlay.querySelector('#ct-email').value = '';
        overlay.querySelector('#ct-nome').focus();
      });

      const addMetodo = () => {
        const inp = overlay.querySelector('#metodo-input');
        const val = inp.value.trim();
        if (!val) return;
        const tag = document.createElement('span');
        tag.className = 'badge tag';
        tag.dataset.m = val;
        tag.innerHTML = `${val} <span style="cursor:pointer;margin-left:4px">×</span>`;
        tag.querySelector('span').onclick = () => tag.remove();
        overlay.querySelector('#metodos-tags').appendChild(tag);
        inp.value = '';
        inp.focus();
      };
      overlay.querySelector('#metodo-input').addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); addMetodo(); } });
      overlay.querySelector('#add-metodo-btn').addEventListener('click', addMetodo);
      overlay.querySelector('#prop-check').addEventListener('change', e => overlay.querySelector('#prop-val-wrap').classList.toggle('hidden', !e.target.checked));
      overlay.querySelector('#mens-check').addEventListener('change', e => overlay.querySelector('#mens-val-wrap').classList.toggle('hidden', !e.target.checked));

      overlay.querySelector('#save-sys').addEventListener('click', async () => {
        const codigoSistema = overlay.querySelector('#sys-codigo').value.trim().toUpperCase();
        const nome = overlay.querySelector('#sys-nome').value.trim();

        if (!codigoSistema) { toast('Código do Sistema obrigatório.', 'error'); return; }
        if (!nome)          { toast('Nome obrigatório.', 'error'); return; }

        // Validação de unicidade do código — só para registros novos
        if (isNew) {
          const todosSistemas = await dbAll('sistemas');
          const duplicado = todosSistemas.some(s => (s.codigoSistema||'').toUpperCase() === codigoSistema);
          if (duplicado) {
            toast(`Código "${codigoSistema}" já está em uso por outro sistema.`, 'error');
            return;
          }
        }

        const tipoIntegracao = [...overlay.querySelectorAll('input[name="tipo-int"]:checked')].map(el => el.value);
        const configuracao   = [...overlay.querySelectorAll('input[name="config-opt"]:checked')].map(el => el.value);
        const metodos        = [...overlay.querySelectorAll('#metodos-tags [data-m]')].map(el => el.dataset.m);

        const data = {
          codigoSistema,                                               // Imutável após criação
          nome,
          empresa:              overlay.querySelector('#sys-empresa').value.trim(),
          tipoIntegracao,
          configuracao,
          metodos,
          contatos,
          observacoes:          overlay.querySelector('#sys-obs').value.trim(),
          propostaHabilitada:   overlay.querySelector('#prop-check').checked,
          valorProposta:        parseFloat(overlay.querySelector('#sys-prop-val').value) || 0,
          mensalidadeHabilitada: overlay.querySelector('#mens-check').checked,
          valorMensalidade:     parseFloat(overlay.querySelector('#sys-mens-val').value) || 0,
        };
        if (!isNew) data.id = id;
        await (isNew ? dbAdd : dbPut)('sistemas', data);
        await auditLog(isNew?'Criou sistema':'Editou sistema', `${data.codigoSistema} · ${data.nome}`);
        toast(isNew ? 'Sistema criado.' : 'Sistema atualizado.', 'success');
        closeModal();
        refresh(search, filterTipo);
      });
    });
  }

  })(window);
