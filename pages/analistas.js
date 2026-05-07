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
      const cargoColor = {
        'Analista Junior' : 'var(--text2)',
        'Analista Pleno'  : 'var(--accent2)',
        'Analista Sênior' : 'var(--navy)',
      };

      const renderAnaRow = a => {
        const count = chamCount[a.nome] || 0;
        const ativo = a.ativo !== false;
        return `<tr style="${!ativo ? 'opacity:.55' : ''}">
          <td>
            <span style="font-family:var(--mono);font-size:11px;font-weight:700;
              color:var(--accent2);background:rgba(15,155,148,.08);
              padding:2px 7px;border-radius:4px;border:1px solid rgba(15,155,148,.2)">
              ${a.id}
            </span>
          </td>
          <td>
            <strong style="color:var(--navy)">${a.nome}</strong>
            ${!ativo ? '<span style="font-size:10px;color:var(--text3);margin-left:6px">Inativo</span>' : ''}
          </td>
          <td>
            <span style="font-size:11px;font-weight:600;
              color:${cargoColor[a.cargo] || 'var(--text2)'};
              padding:2px 8px;background:rgba(0,0,0,.04);border-radius:10px">
              ${a.cargo || '—'}
            </span>
          </td>
          <td style="color:var(--text2)">${a.email || '—'}</td>
          <td><span class="badge rep">${count} chamados</span></td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn sm secondary" data-view-ana="${a.id}">Ver</button>
              ${editable ? `<button class="btn sm secondary" data-edit-ana="${a.id}">Editar</button>` : ''}
              ${(count === 0 && editable)
                ? `<button class="btn sm danger" data-del-ana="${a.id}">Excluir</button>`
                : ''}
            </div>
          </td>
        </tr>`;
      };

      tbody.innerHTML = filtered.length === 0
        ? `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text3)">
             Nenhum analista cadastrado. Clique em "+ Novo Analista" para adicionar.
           </td></tr>`
        : filtered.map(renderAnaRow).join('');

      const thead = tbody.closest('table')?.querySelector('thead');
      if (thead) makeSortable(thead, tbody, filtered, [
        { getValue: a => a.id },
        { getValue: a => a.nome },
        { getValue: a => a.cargo || '' },
        { getValue: a => a.email || '' },
        { getValue: a => chamCount[a.nome] || 0 },
      ], renderAnaRow);

      /* ── Botão VER ── chama openAnalistaViewModal definida neste módulo */
      tbody.querySelectorAll('[data-view-ana]').forEach(btn => {
        btn.addEventListener('click', () => openAnalistaViewModal(btn.dataset.viewAna));
      });

      /* ── Botão EDITAR ── resolve chave string/numérica legada */
      tbody.querySelectorAll('[data-edit-ana]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const keyStr = btn.dataset.editAna;
          const keyNum = Number(keyStr);
          let resolvedKey = keyStr;
          try {
            const r = await dbGet('analistas', keyStr);
            if (!r && !isNaN(keyNum)) resolvedKey = keyNum;
          } catch (_) {
            if (!isNaN(keyNum)) resolvedKey = keyNum;
          }
          openAnalistaModal(resolvedKey, renderAnalistas, search);
        });
      });

      /* ── Botão EXCLUIR ── */
      tbody.querySelectorAll('[data-del-ana]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Excluir este analista?')) return;
          const keyStr = btn.dataset.delAna;
          const keyNum = Number(keyStr);
          try {
            let record = null;
            try { record = await dbGet('analistas', keyStr); } catch (_) {}
            if (!record && !isNaN(keyNum)) {
              try { record = await dbGet('analistas', keyNum); } catch (_) {}
              if (record) await dbDelete('analistas', keyNum);
              else        await dbDelete('analistas', keyStr);
            } else {
              await dbDelete('analistas', keyStr);
            }
            toast('Analista excluído.', 'info');
            renderAnalistas(document.getElementById('ana-search')?.value || '');
          } catch (err) {
            toast('Erro ao excluir: ' + (err.message || err), 'error');
          }
        });
      });
    };

    document.getElementById('content').innerHTML = `
      <div class="toolbar" style="gap:10px;align-items:center">
        <div class="search-wrap" style="flex:1">
          <span class="search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61
                       0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5
                       11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </span>
          <input type="text" placeholder="Buscar por ID, nome ou cargo..." id="ana-search">
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;
                      color:var(--text2);white-space:nowrap;cursor:pointer">
          <input type="checkbox" id="ana-show-inativos">
          Exibir inativos
        </label>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th data-sort="0">ID</th>
              <th data-sort="1">Nome</th>
              <th data-sort="2">Cargo</th>
              <th data-sort="3">E-mail</th>
              <th data-sort="4">Chamados</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="ana-list"></tbody>
        </table>
      </div>
    `;

    await renderAnalistas();
    document.getElementById('ana-search').addEventListener('input', e => renderAnalistas(e.target.value));
    document.getElementById('ana-show-inativos').addEventListener('change', () =>
      renderAnalistas(document.getElementById('ana-search').value)
    );
    document.getElementById('new-ana-btn').addEventListener('click', () =>
      openAnalistaModal(null, renderAnalistas)
    );
  };

  // ===================== CONSTANTES =====================
  const CARGOS_ANALISTA = ['Analista Junior', 'Analista Pleno', 'Analista Sênior'];

  const CARGO_COLOR = {
    'Analista Junior' : 'var(--text2)',
    'Analista Pleno'  : 'var(--accent2)',
    'Analista Sênior' : 'var(--navy)',
  };

  // ===================== MODAL VER ANALISTA =====================
  /**
   * Exibe o modal de performance do analista.
   * Movido de sistemas.js para cá (§3 — decisão arquitetural).
   * Busca sistemas internamente: módulo autossuficiente.
   */
  async function openAnalistaViewModal(anaId) {
    /* Resolve chave — suporta string (novo) e número (legado) */
    let ana = null;
    try { ana = await dbGet('analistas', anaId); } catch (_) {}
    if (!ana && !isNaN(Number(anaId))) {
      try { ana = await dbGet('analistas', Number(anaId)); } catch (_) {}
    }
    if (!ana) {
      toast('Analista não encontrado.', 'error');
      return;
    }

    const [chamados, clientes] = await Promise.all([
      dbAll('chamados'),
      dbAll('clientes'),
    ]);

    const clienteByCode = {};
    for (const c of clientes) clienteByCode[c.Codigo] = c;

    /* Chamados deste analista — mantém apenas o mais recente por cliente */
    const meusChamados = chamados.filter(ch => ch.analista === ana.nome);

    const ultimoPorCliente = {};
    for (const ch of meusChamados) {
      const cod = ch.fk_cliente;
      if (!cod) continue;
      const prev   = ultimoPorCliente[cod];
      const dtCh   = ch.dataSolicitacao || '';
      const dtPrev = prev?.dataSolicitacao || '';
      if (!prev || dtCh > dtPrev) ultimoPorCliente[cod] = ch;
    }

    /* Classifica por status do chamado mais recente de cada cliente */
    const integrados  = [];
    const implantacao = [];
    const inativados  = [];

    for (const ch of Object.values(ultimoPorCliente)) {
      const cli  = clienteByCode[ch.fk_cliente];
      const nome = cli
        ? (cli.NomeFantasia || cli.RazaoSocial || `Cód. ${ch.fk_cliente}`)
        : `Cód. ${ch.fk_cliente}`;
      const item = {
        nome,
        codigo  : ch.fk_cliente,
        chamado : ch.numeroChamado || ch.id,
        data    : ch.dataSolicitacao,
      };

      if (ch.integracaoAtiva)       integrados.push(item);
      else if (ch.dataFinalizacao)  inativados.push(item);
      else                          implantacao.push(item);
    }

    /* Tabela por seção */
    const secao = (titulo, cor, lista) => {
      if (!lista.length) return '';
      return `
        <div style="margin-top:14px">
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;
                      text-transform:uppercase;color:${cor};margin-bottom:6px">
            ${titulo} (${lista.length})
          </div>
          <div style="max-height:180px;overflow-y:auto;
                      border:1px solid var(--border);border-radius:var(--r)">
            <table style="width:100%;font-size:12px">
              <thead>
                <tr style="background:var(--bg2)">
                  <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text3)">Cód.</th>
                  <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text3)">Cliente</th>
                  <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text3)">Chamado</th>
                  <th style="padding:5px 8px;text-align:left;font-weight:600;color:var(--text3)">Data</th>
                </tr>
              </thead>
              <tbody>
                ${lista.map(it => `
                  <tr style="border-top:1px solid var(--border)">
                    <td style="padding:5px 8px;font-family:var(--mono);color:var(--text3)">${it.codigo}</td>
                    <td style="padding:5px 8px;font-weight:500;color:var(--navy)">${it.nome}</td>
                    <td style="padding:5px 8px;color:var(--text2)">${it.chamado}</td>
                    <td style="padding:5px 8px;color:var(--text3)">
                      ${it.data ? it.data.slice(0, 10) : '—'}
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    };

    openModal(`
      <div class="modal-header">
        <div class="modal-title">
          <span style="font-family:var(--mono);font-size:11px;
                       color:var(--accent2);margin-right:8px">[${ana.id}]</span>
          ${ana.nome}
        </div>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">

        <!-- Cargo + status ativo/inativo -->
        <div style="display:flex;gap:12px;align-items:center;padding:10px;
                    background:var(--bg3);border-radius:var(--r);margin-bottom:12px">
          <span style="font-size:12px;font-weight:700;
                       color:${CARGO_COLOR[ana.cargo] || 'var(--text2)'};
                       padding:2px 10px;background:rgba(0,0,0,.05);border-radius:10px">
            ${ana.cargo || '—'}
          </span>
          ${ana.ativo === false
            ? '<span style="font-size:11px;color:var(--text3)">· Inativo</span>'
            : '<span style="font-size:11px;color:var(--accent2)">· Ativo</span>'}
          ${ana.email
            ? `<a href="mailto:${ana.email}"
                  style="font-size:12px;color:var(--accent2);margin-left:auto">
                 ${ana.email}
               </a>`
            : ''}
        </div>

        <!-- Cards de resumo -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:4px">
          <div style="padding:10px;background:rgba(15,155,148,.07);border-radius:var(--r);
                      text-align:center;border:1px solid rgba(15,155,148,.2)">
            <div style="font-size:22px;font-weight:700;color:var(--accent2)">${integrados.length}</div>
            <div style="font-size:11px;color:var(--text3)">Integrados</div>
          </div>
          <div style="padding:10px;background:rgba(196,155,60,.07);border-radius:var(--r);
                      text-align:center;border:1px solid rgba(196,155,60,.25)">
            <div style="font-size:22px;font-weight:700;color:var(--gold)">${implantacao.length}</div>
            <div style="font-size:11px;color:var(--text3)">Em Implantação</div>
          </div>
          <div style="padding:10px;background:rgba(232,88,88,.07);border-radius:var(--r);
                      text-align:center;border:1px solid rgba(232,88,88,.2)">
            <div style="font-size:22px;font-weight:700;color:var(--red)">${inativados.length}</div>
            <div style="font-size:11px;color:var(--text3)">Inativados</div>
          </div>
        </div>

        ${secao('Integrados',      'var(--accent2)', integrados)}
        ${secao('Em Implantação',  'var(--gold)',    implantacao)}
        ${secao('Inativados',      'var(--red)',     inativados)}

      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal()">Fechar</button>
      </div>
    `);
  }

  // ===================== MODAL NOVO / EDITAR ANALISTA =====================
  function openAnalistaModal(id, refresh, search = '') {
    Promise.resolve(
      id !== null && id !== undefined
        ? (async () => {
            let rec = null;
            try { rec = await dbGet('analistas', id); } catch (_) {}
            if (!rec && !isNaN(Number(id))) {
              try { rec = await dbGet('analistas', Number(id)); } catch (_) {}
            }
            return rec;
          })()
        : Promise.resolve(null)
    ).then(async ana => {
      const isNew = !ana;
      ana = ana || { id: '', nome: '', cargo: 'Analista Pleno', email: '', ativo: true };

      const overlay = openModal(`
        <div class="modal-header">
          <div class="modal-title">${isNew ? 'Novo Analista' : 'Editar Analista'}</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="two-col">
            <div class="field-group">
              <div class="field-label">
                ID *
                <span style="font-size:10px;color:var(--text3);font-weight:400;
                             text-transform:none;letter-spacing:0">
                  (único, imutável após salvar)
                </span>
              </div>
              <input type="text" id="ana-id"
                value="${isNew ? '' : ana.id}"
                ${!isNew ? 'readonly style="opacity:.6;background:var(--bg3)"' : ''}
                placeholder="Ex: ANA-01">
            </div>
            <div class="field-group">
              <div class="field-label">Nome *</div>
              <input type="text" id="ana-nome"
                value="${ana.nome}"
                placeholder="Nome completo">
            </div>
          </div>

          <div class="two-col">
            <div class="field-group">
              <div class="field-label">Cargo *</div>
              <select id="ana-cargo">
                ${CARGOS_ANALISTA.map(c =>
                  `<option value="${c}" ${c === ana.cargo ? 'selected' : ''}>${c}</option>`
                ).join('')}
              </select>
            </div>
            <div class="field-group">
              <div class="field-label">E-mail</div>
              <input type="email" id="ana-email"
                value="${ana.email || ''}"
                placeholder="email@exemplo.com">
            </div>
          </div>

          <div class="checkbox-row" style="margin-top:6px">
            <input type="checkbox" id="ana-ativo" ${ana.ativo !== false ? 'checked' : ''}>
            <label for="ana-ativo" style="font-size:13px;cursor:pointer">
              Analista ativo
              <span style="font-size:11px;color:var(--text3)">
                (desmarque para inativar sem excluir)
              </span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn secondary" onclick="closeModal()">Cancelar</button>
          <button class="btn" id="save-ana">Salvar</button>
        </div>
      `);

      overlay.querySelector('#save-ana').addEventListener('click', async () => {
        const anaId = overlay.querySelector('#ana-id').value.trim();
        const nome  = overlay.querySelector('#ana-nome').value.trim();
        const cargo = overlay.querySelector('#ana-cargo').value;
        const email = overlay.querySelector('#ana-email').value.trim();
        const ativo = overlay.querySelector('#ana-ativo').checked;

        if (!anaId) { toast('ID obrigatório.', 'error'); return; }
        if (!nome)  { toast('Nome obrigatório.', 'error'); return; }

        /* Unicidade de ID — apenas para novos registros */
        if (isNew) {
          try {
            const existing = await dbGet('analistas', anaId);
            if (existing) {
              toast(`ID "${anaId}" já está em uso. Escolha outro.`, 'error');
              return;
            }
          } catch (_) { /* ID não existe → ok */ }
        }

        const data = { id: anaId, nome, cargo, email, ativo };
        await dbPut('analistas', data);
        await auditLog(
          isNew ? 'Criou analista' : 'Editou analista',
          `[${anaId}] ${nome} · ${cargo}`
        );
        toast(isNew ? 'Analista criado.' : 'Analista atualizado.', 'success');
        closeModal();
        refresh(search);
      });
    });
  }

  /* ── Exports globais ──────────────────────────────────────────────────────
   * openAnalistaViewModal e openAnalistaModal são funções locais ao IIFE.
   * Precisam ser expostas em window.* para que chamadas via onclick-string
   * geradas por innerHTML (em outras páginas ou no próprio modal) as encontrem
   * em tempo de execução sem lançar ReferenceError.
   * -------------------------------------------------------------------------*/
  global.openAnalistaViewModal = openAnalistaViewModal;
  global.openAnalistaModal     = openAnalistaModal;

})(window);
