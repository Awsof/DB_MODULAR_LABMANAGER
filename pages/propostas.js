// pages/propostas.js — extraído da fase 4
(function (global) {
  'use strict';
  var pages = global.pages || {};
  global.pages = pages;

// ===================== PAGE: PROPOSTAS =====================
  pages.propostas = async function() {
    updateTopbar('Propostas', 'Gestão de propostas comerciais', `<button class="btn" id="new-prop-btn">+ Nova Proposta</button>`);

    const [propostas, clientes, sistemas, chamados] = await Promise.all([
      dbAll('propostas'), dbAll('clientes'), dbAll('sistemas'), dbAll('chamados')
    ]);
    const clienteByCode = {}; for (const c of clientes) clienteByCode[c.Codigo] = c;
    const sysById = {}; for (const s of sistemas) sysById[s.id] = s;
    const analistaSet = [...new Set(chamados.map(ch=>ch.analista).filter(Boolean))].sort();

    let pSearch = '', pStatus = '', pSistema = '';

    function getStatusLabel(s) {
      return {pendente:'Pendente', aprovada:'Aprovada', paga:'Paga', cancelada:'Cancelada'}[s] || s;
    }

    async function renderPropostas() {
      // Re-fetch propostas from DB for immediate state update after create/edit/delete
      const propostas = await dbAll('propostas');
      let filtered = propostas.filter(p => {
        const c = clienteByCode[p.fk_cliente];
        const nome = c ? (c.NomeFantasia||c.RazaoSocial||'') : '';
        const ok = !pSearch || String(p.fk_cliente).includes(pSearch) || nome.toLowerCase().includes(pSearch.toLowerCase()) || String(p.numeroChamado||'').includes(pSearch);
        const stOk = !pStatus || p.status === pStatus;
        const sysOk = !pSistema || String(p.fk_sistema) === pSistema;
        return ok && stOk && sysOk;
      }).sort((a,b) => (b.dataLancamento||'').localeCompare(a.dataLancamento||''));

      const container = document.getElementById('prop-list');
      if (!container) return;
      if (!filtered.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-title">Nenhuma proposta encontrada</div></div>`;
        return;
      }
      container.innerHTML = filtered.map(p => {
        const c = clienteByCode[p.fk_cliente];
        const sys = sysById[p.fk_sistema];
        const nome = c ? (c.NomeFantasia||c.RazaoSocial) : `Cód. ${p.fk_cliente}`;
        return `<div class="table-wrap" style="margin-bottom:8px">
          <table style="width:100%"><tbody>
            <tr style="background:var(--bg2)">
              <td style="padding:12px 16px;width:120px">
                <span style="font-family:var(--mono);font-size:11px;color:var(--text3)">#${p.fk_cliente}</span><br>
                <strong style="font-size:13px;color:var(--navy)">${nome}</strong>
              </td>
              <td style="padding:12px 16px">
                <div style="font-size:11px;color:var(--text3)">Chamado</div>
                <div style="font-size:13px">${p.numeroChamado||'—'}</div>
              </td>
              <td style="padding:12px 16px">
                <div style="font-size:11px;color:var(--text3)">Sistema</div>
                <div style="font-size:13px">${sys?.nome||'—'}</div>
              </td>
              <td style="padding:12px 16px">
                <div style="font-size:11px;color:var(--text3)">Analista</div>
                <div style="font-size:13px">${p.analista||'—'}</div>
              </td>
              <td style="padding:12px 16px;text-align:right">
                <div style="font-size:11px;color:var(--text3)">Proposta</div>
                <div style="font-size:14px;font-weight:700;color:var(--navy)">R$ ${Number(p.valorProposta||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
                ${p.valorMensalidade ? `<div style="font-size:11px;color:var(--text3)">Mens. R$ ${Number(p.valorMensalidade).toLocaleString('pt-BR',{minimumFractionDigits:2})} × ${p.numeroParcelas||1}</div>` : ''}
              </td>
              <td style="padding:12px 16px;text-align:center">
                <span class="prop-status ${p.status||'pendente'}">${getStatusLabel(p.status||'pendente')}</span>
              </td>
              <td style="padding:12px 16px">
                <div style="font-size:10px;color:var(--text3)">Lançamento: ${p.dataLancamento||'—'}</div>
                ${p.dataAprovacao ? `<div style="font-size:10px;color:var(--text3)">Aprovação: ${p.dataAprovacao}</div>` : ''}
                ${p.dataPagamento ? `<div style="font-size:10px;color:var(--text3)">Pagamento: ${p.dataPagamento}</div>` : ''}
                ${p.chaveNF ? `<div style="font-size:10px;color:var(--accent2)">NF: ${p.chaveNF}</div>` : ''}
              </td>
              <td style="padding:12px 16px;text-align:right;white-space:nowrap">
                <button class="btn sm secondary" data-edit-prop="${p.id}">Editar</button>
              </td>
            </tr>
          </tbody></table>
        </div>`;
      }).join('');

      container.querySelectorAll('[data-edit-prop]').forEach(btn => {
        btn.addEventListener('click', () => openPropostaModal(parseInt(btn.dataset.editProp), sistemas, analistaSet, clienteByCode, renderPropostas));
      });
    }

    document.getElementById('content').innerHTML = `
      <div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:16px">
        <div class="search-wrap" style="flex:2;min-width:200px">
          <span class="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></span>
          <input type="text" placeholder="Código, nome ou chamado..." id="prop-search">
        </div>
        <select id="prop-status">
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="aprovada">Aprovada</option>
          <option value="paga">Paga</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select id="prop-sistema">
          <option value="">Todos os sistemas</option>
          ${sistemas.map(s=>`<option value="${s.id}">${s.nome}</option>`).join('')}
        </select>
      </div>
      <div id="prop-list"></div>
    `;

    renderPropostas();
    document.getElementById('prop-search').addEventListener('input', e => { pSearch=e.target.value; renderPropostas().catch(console.error); });
    document.getElementById('prop-status').addEventListener('change', e => { pStatus=e.target.value; renderPropostas().catch(console.error); });
    document.getElementById('prop-sistema').addEventListener('change', e => { pSistema=e.target.value; renderPropostas().catch(console.error); });
    document.getElementById('new-prop-btn').addEventListener('click', () => openPropostaModal(null, sistemas, analistaSet, clienteByCode, renderPropostas));
  };

  function openPropostaModal(id, sistemas, analistaSet, clienteByCode, refresh) {
    Promise.resolve(id ? dbGet('propostas', id) : null).then(p => {
      const isNew = !p;
      p = p || { fk_cliente:'', numeroChamado:'', fk_sistema:'', analista:'', valorProposta:0, valorMensalidade:0, numeroParcelas:1, dataLancamento:'', dataAprovacao:'', dataPagamento:'', chaveNF:'', status:'pendente' };
      const overlay = openModal(`
        <div class="modal-header">
          <div class="modal-title">${isNew?'Nova Proposta':'Editar Proposta'}</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="two-col">
            <div class="field-group"><div class="field-label">Código do Laboratório *</div><input type="text" id="p-cod" value="${p.fk_cliente}"></div>
            <div class="field-group"><div class="field-label">Número do Chamado</div><input type="text" id="p-ch" value="${p.numeroChamado||''}"></div>
          </div>
          <div class="two-col">
            <div class="field-group"><div class="field-label">Sistema</div>
              <select id="p-sys"><option value="">— Nenhum —</option>${sistemas.map(s=>`<option value="${s.id}" ${s.id==p.fk_sistema?'selected':''}>${s.nome}</option>`).join('')}</select>
            </div>
            <div class="field-group"><div class="field-label">Analista</div>
              <input type="text" id="p-ana" list="p-ana-list" value="${p.analista||''}">
              <datalist id="p-ana-list">${analistaSet.map(a=>`<option value="${a}">`).join('')}</datalist>
            </div>
          </div>
          <div class="two-col">
            <div class="field-group"><div class="field-label">Valor da Proposta (R$)</div><input type="number" id="p-val" value="${p.valorProposta||0}" min="0" step="0.01"></div>
            <div class="field-group"><div class="field-label">Mensalidade (R$)</div><input type="number" id="p-mens" value="${p.valorMensalidade||0}" min="0" step="0.01"></div>
          </div>
          <div class="two-col">
            <div class="field-group"><div class="field-label">Nº de Parcelas</div><input type="number" id="p-parc" value="${p.numeroParcelas||1}" min="1" step="1"></div>
            <div class="field-group"><div class="field-label">Status</div>
              <select id="p-status">
                <option value="pendente"  ${p.status==='pendente' ?'selected':''}>Pendente</option>
                <option value="aprovada"  ${p.status==='aprovada' ?'selected':''}>Aprovada</option>
                <option value="paga"      ${p.status==='paga'     ?'selected':''}>Paga</option>
                <option value="cancelada" ${p.status==='cancelada'?'selected':''}>Cancelada</option>
              </select>
            </div>
          </div>
          <div class="section-divider">Datas</div>
          <div class="two-col">
            <div class="field-group"><div class="field-label">Data de Lançamento</div><input type="date" id="p-dt-lanc" value="${p.dataLancamento||''}"></div>
            <div class="field-group"><div class="field-label">Data de Aprovação</div><input type="date" id="p-dt-aprov" value="${p.dataAprovacao||''}"></div>
          </div>
          <div class="two-col">
            <div class="field-group"><div class="field-label">Data de Pagamento</div><input type="date" id="p-dt-pag" value="${p.dataPagamento||''}"></div>
            <div class="field-group"><div class="field-label">Chave da NF</div><input type="text" id="p-nf" value="${p.chaveNF||''}"></div>
          </div>
        </div>
        <div class="modal-footer">
          ${!isNew ? `<button class="btn danger" id="del-prop">Excluir</button>` : ''}
          <button class="btn secondary" onclick="closeModal()">Cancelar</button>
          <button class="btn" id="save-prop">Salvar</button>
        </div>
      `);
      if (!isNew) overlay.querySelector('#del-prop')?.addEventListener('click', async () => {
        if (!confirm('Excluir esta proposta?')) return;
        await dbDelete('propostas', id); toast('Proposta excluída.','info'); closeModal(); refresh();
      });
      overlay.querySelector('#save-prop').addEventListener('click', async () => {
        const fk_cliente = overlay.querySelector('#p-cod').value.trim();
        if (!fk_cliente) { toast('Código do laboratório obrigatório.','error'); return; }
        const data = {
          fk_cliente, numeroChamado: overlay.querySelector('#p-ch').value.trim(),
          fk_sistema: parseInt(overlay.querySelector('#p-sys').value)||null,
          analista: overlay.querySelector('#p-ana').value.trim(),
          valorProposta: parseFloat(overlay.querySelector('#p-val').value)||0,
          valorMensalidade: parseFloat(overlay.querySelector('#p-mens').value)||0,
          numeroParcelas: parseInt(overlay.querySelector('#p-parc').value)||1,
          status: overlay.querySelector('#p-status').value,
          dataLancamento: overlay.querySelector('#p-dt-lanc').value,
          dataAprovacao: overlay.querySelector('#p-dt-aprov').value,
          dataPagamento: overlay.querySelector('#p-dt-pag').value,
          chaveNF: overlay.querySelector('#p-nf').value.trim(),
        };
        if (!isNew) data.id = id;
        await (isNew ? dbAdd : dbPut)('propostas', data);
        await auditLog(isNew?'Criou proposta':'Editou proposta', `Lab ${data.fk_cliente} · R$ ${data.valorProposta}`);
        toast(isNew?'Proposta criada.':'Proposta atualizada.','success');
        closeModal(); refresh();
      });
    });
  }

})(window);
