// pages/pacotes.js — extraído da fase 4
(function (global) {
  'use strict';
  var pages = global.pages || {};
  global.pages = pages;

// ===================== PAGE: PACOTES =====================
  pages.pacotes = async function() {
    updateTopbar('Pacotes', 'Gestão de pacotes de implantação', `<button class="btn" id="new-pac-btn">+ Novo Pacote</button>`);

    const [pacotes, registros, clientes, sistemas, chamados] = await Promise.all([
      dbAll('pacotes'), dbAll('pacote_registros'), dbAll('clientes'), dbAll('sistemas'), dbAll('chamados')
    ]);
    const clienteByCode = {}; for (const c of clientes) clienteByCode[c.Codigo] = c;
    const sysById = {}; for (const s of sistemas) sysById[s.id] = s;
    const analistaSet = [...new Set(chamados.map(ch=>ch.analista).filter(Boolean))].sort();

    async function renderPacotes() {
      // Re-fetch from DB for immediate post-save state update
      const [pacotes, _regs] = await Promise.all([dbAll('pacotes'), dbAll('pacote_registros')]);
      const pacoteIds = new Set(pacotes.map(pk => pk.id));
      const registros = _regs.filter(r => pacoteIds.has(r.fk_pacote));
      const container = document.getElementById('pac-list');
      if (!container) return;
      if (!pacotes.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-title">Nenhum pacote cadastrado</div></div>`;
        return;
      }
      container.innerHTML = pacotes.map(pk => {
        const regs = registros.filter(r => r.fk_pacote === pk.id);
        const sys = sysById[pk.fk_sistema];
        return `<div class="pacote-card">
          <div class="pacote-header">
            <div>
              <div class="pacote-nome">${pk.nome}</div>
              <div class="pacote-meta">${sys?.nome||'—'} · ${pk.qtdPacotes||0} pacote(s) · R$ ${Number(pk.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <span style="font-size:12px;color:rgba(255,255,255,.6)">${regs.length} lab(s) registrado(s)</span>
              ${pk.dataAprovacao ? `<span style="font-size:11px;color:rgba(255,255,255,.5)">Aprovado: ${pk.dataAprovacao}</span>` : ''}
              <button class="btn sm secondary" data-edit-pac="${pk.id}" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);color:white">Editar</button>
              <button class="btn sm" data-add-reg="${pk.id}">+ Lab</button>
            </div>
          </div>
          <div class="pacote-body">
            ${regs.length === 0 ? `<div style="font-size:12px;color:var(--text3)">Nenhum laboratório registrado neste pacote.</div>` :
              `<table style="width:100%;font-size:12px"><thead><tr>
                <th>Código</th><th>Laboratório</th><th>Chamado</th><th>Analista</th><th>Data Registro</th><th></th>
              </tr></thead><tbody>
                ${regs.map(r => {
                  const c = clienteByCode[r.fk_cliente];
                  return `<tr>
                    <td style="font-family:var(--mono);color:var(--text3)">${r.fk_cliente}</td>
                    <td>${c?(c.NomeFantasia||c.RazaoSocial):'—'}</td>
                    <td>${r.numeroChamado||'—'}</td>
                    <td>${r.analista||'—'}</td>
                    <td>${r.dataRegistro||'—'}</td>
                    <td><button class="btn sm secondary" style="font-size:10px;padding:3px 7px" data-del-reg="${r.id}">×</button></td>
                  </tr>`;
                }).join('')}
              </tbody></table>`}
          </div>
        </div>`;
      }).join('');

      container.querySelectorAll('[data-edit-pac]').forEach(btn => {
        btn.addEventListener('click', () => openPacoteModal(parseInt(btn.dataset.editPac), sistemas, () => renderPacotes().catch(console.error)));
      });
      container.querySelectorAll('[data-add-reg]').forEach(btn => {
        btn.addEventListener('click', () => openPacoteRegModal(parseInt(btn.dataset.addReg), clientes, chamados, analistaSet, () => renderPacotes().catch(console.error)));
      });
      container.querySelectorAll('[data-del-reg]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Remover este laboratório do pacote?')) return;
          await dbDelete('pacote_registros', parseInt(btn.dataset.delReg));
          toast('Removido.','info'); renderPacotes().catch(console.error);
        });
      });
    }

    document.getElementById('content').innerHTML = `<div id="pac-list"></div>`;
    renderPacotes();
    document.getElementById('new-pac-btn').addEventListener('click', () => openPacoteModal(null, sistemas, () => renderPacotes().catch(console.error)));
  };

  function openPacoteModal(id, sistemas, refresh) {
    Promise.resolve(id ? dbGet('pacotes', id) : null).then(pk => {
      const isNew = !pk;
      pk = pk || { nome:'', fk_sistema:'', valor:0, qtdPacotes:1, dataAprovacao:'' };
      const overlay = openModal(`
        <div class="modal-header">
          <div class="modal-title">${isNew?'Novo Pacote':'Editar Pacote'}</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="field-group"><div class="field-label">Nome do Pacote *</div><input type="text" id="pk-nome" value="${pk.nome||''}"></div>
          <div class="two-col">
            <div class="field-group"><div class="field-label">Sistema</div>
              <select id="pk-sys"><option value="">— Nenhum —</option>${sistemas.map(s=>`<option value="${s.id}" ${s.id==pk.fk_sistema?'selected':''}>${s.nome}</option>`).join('')}</select>
            </div>
            <div class="field-group"><div class="field-label">Data de Aprovação</div><input type="date" id="pk-dt" value="${pk.dataAprovacao||''}"></div>
          </div>
          <div class="two-col">
            <div class="field-group"><div class="field-label">Valor (R$)</div><input type="number" id="pk-val" value="${pk.valor||0}" min="0" step="0.01"></div>
            <div class="field-group"><div class="field-label">Quantidade de Pacotes</div><input type="number" id="pk-qtd" value="${pk.qtdPacotes||1}" min="1" step="1"></div>
          </div>
        </div>
        <div class="modal-footer">
          ${!isNew?`<button class="btn danger" id="del-pac">Excluir</button>`:''}
          <button class="btn secondary" onclick="closeModal()">Cancelar</button>
          <button class="btn" id="save-pac">Salvar</button>
        </div>
      `);
      if (!isNew) overlay.querySelector('#del-pac')?.addEventListener('click', async () => {
        if (!confirm('Excluir este pacote?')) return;
        await dbDelete('pacotes', id); toast('Pacote excluído.','info'); closeModal(); refresh();
      });
      overlay.querySelector('#save-pac').addEventListener('click', async () => {
        const nome = overlay.querySelector('#pk-nome').value.trim();
        if (!nome) { toast('Nome obrigatório.','error'); return; }
        const data = {
          nome,
          fk_sistema: parseInt(overlay.querySelector('#pk-sys').value)||null,
          valor: parseFloat(overlay.querySelector('#pk-val').value)||0,
          qtdPacotes: parseInt(overlay.querySelector('#pk-qtd').value)||1,
          dataAprovacao: overlay.querySelector('#pk-dt').value,
        };
        if (!isNew) data.id = id;
        await (isNew ? dbAdd : dbPut)('pacotes', data);
        await auditLog(isNew?'Criou pacote':'Editou pacote', data.nome);
        toast(isNew?'Pacote criado.':'Pacote atualizado.','success');
        closeModal(); refresh();
      });
    });
  }

  function openPacoteRegModal(fk_pacote, clientes, chamados, analistaSet, refresh) {
    const overlay = openModal(`
      <div class="modal-header">
        <div class="modal-title">Registrar Laboratório no Pacote</div>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="two-col">
          <div class="field-group"><div class="field-label">Código do Laboratório *</div><input type="text" id="reg-cod" placeholder="Ex: 12345"></div>
          <div class="field-group"><div class="field-label">Número do Chamado</div><input type="text" id="reg-ch" placeholder="Ex: INC-0042"></div>
        </div>
        <div class="two-col">
          <div class="field-group"><div class="field-label">Analista</div>
            <input type="text" id="reg-ana" list="reg-ana-list" placeholder="Nome do analista">
            <datalist id="reg-ana-list">${analistaSet.map(a=>`<option value="${a}">`).join('')}</datalist>
          </div>
          <div class="field-group"><div class="field-label">Data do Registro</div><input type="date" id="reg-dt"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn" id="save-reg">Registrar</button>
      </div>
    `);
    overlay.querySelector('#save-reg').addEventListener('click', async () => {
      const fk_cliente = overlay.querySelector('#reg-cod').value.trim();
      if (!fk_cliente) { toast('Código do laboratório obrigatório.','error'); return; }
      await dbAdd('pacote_registros', {
        fk_pacote, fk_cliente,
        numeroChamado: overlay.querySelector('#reg-ch').value.trim(),
        analista: overlay.querySelector('#reg-ana').value.trim(),
        dataRegistro: overlay.querySelector('#reg-dt').value,
      });
      toast('Laboratório registrado no pacote.','success');
      closeModal(); refresh();
    });
  }

})(window);
