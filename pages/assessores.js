// pages/assessores.js — Página Assessores da Fase 4
(function (global) {
  "use strict";

  var pages = global.pages || {};
  global.pages = pages;

  // ===================== PAGE: ASSESSORES =====================
  pages.assessores = async function() {
    updateTopbar('Assessores', 'Gestão de assessores do Programa Esmeralda e Chivor', '');

    const [assessoresDB, clientes] = await Promise.all([dbAll('assessores'), dbAll('clientes')]);

    // Contagem de clientes e categorias por assessor (nome como chave)
    const assCount  = {}; // total
    const assEsm    = {}; // Esmeralda
    const assChivor = {}; // Chivor
    for (const c of clientes) {
      const a = c.assessor;
      if (!a) continue;
      assCount[a]  = (assCount[a]  || 0) + 1;
      if (c.categoria_especial === 'Esmeralda') assEsm[a]   = (assEsm[a]   || 0) + 1;
      if (c.categoria_especial === 'Chivor')    assChivor[a] = (assChivor[a] || 0) + 1;
    }

    // União: assessores na store + nomes que aparecem em clientes mas ainda não na store
    const nomesNaStore     = new Set(assessoresDB.map(a => a.nome));
    const nomesEmClientes  = [...new Set(clientes.map(c => c.assessor).filter(Boolean))];
    const todosNomes       = [...new Set([...nomesNaStore, ...nomesEmClientes])].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    let selectedAssessor = null;

    document.getElementById('content').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">

        <!-- Lista de assessores -->
        <div>
          <div class="toolbar" style="margin-bottom:10px">
            <div class="search-wrap">
              <span class="search-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              </span>
              <input type="text" placeholder="Buscar assessor..." id="ass-search">
            </div>
            <select id="ass-cat-filter" style="font-size:12px;padding:5px 10px;border:1px solid var(--border);border-radius:var(--r);background:var(--bg2)">
              <option value="">Todos os programas</option>
              <option value="Esmeralda">💎 Esmeralda</option>
              <option value="Chivor">💜 Chivor</option>
            </select>
          </div>

          <div class="metrics" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
            <div class="metric accent">
              <div class="metric-label">Assessores</div>
              <div class="metric-val">${todosNomes.length}</div>
              <div class="metric-sub">Cadastrados</div>
            </div>
            <div class="metric green">
              <div class="metric-label">💎 Esmeralda</div>
              <div class="metric-val">${Object.values(assEsm).reduce((s,v)=>s+v,0)}</div>
              <div class="metric-sub">Clientes</div>
            </div>
            <div class="metric purple">
              <div class="metric-label">💜 Chivor</div>
              <div class="metric-val">${Object.values(assChivor).reduce((s,v)=>s+v,0)}</div>
              <div class="metric-sub">Clientes</div>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Assessor</th>
                  <th style="text-align:center">Total</th>
                  <th style="text-align:center">Esmeralda</th>
                  <th style="text-align:center">Chivor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="ass-list"></tbody>
            </table>
          </div>
        </div>

        <!-- Painel de detalhe do assessor selecionado -->
        <div id="ass-detail-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div class="chart-title" id="ass-detail-title" style="margin:0">Selecione um assessor</div>
            <div id="ass-cat-toggle" style="display:none;display:flex;gap:6px">
              <button class="btn sm secondary active" id="ass-cat-all"  onclick="window._assFilter('all')">Todos</button>
              <button class="btn sm secondary"        id="ass-cat-esm"  onclick="window._assFilter('Esmeralda')">💎 Esmeralda</button>
              <button class="btn sm secondary"        id="ass-cat-chiv" onclick="window._assFilter('Chivor')">💜 Chivor</button>
            </div>
          </div>

          <div class="table-wrap">
            <table style="width:100%">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>UF</th>
                  <th>Programa</th>
                </tr>
              </thead>
              <tbody id="ass-detail">
                <tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text3)">—</td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    // ── Render da lista de assessores ──
    function renderList() {
      const search  = (document.getElementById('ass-search')?.value  || '').toLowerCase();
      const catFilter = document.getElementById('ass-cat-filter')?.value || '';

      const filtered = todosNomes.filter(nome => {
        if (search && !nome.toLowerCase().includes(search)) return false;
        if (catFilter === 'Esmeralda' && !(assEsm[nome]   > 0)) return false;
        if (catFilter === 'Chivor'    && !(assChivor[nome] > 0)) return false;
        return true;
      });

      const tbody = document.getElementById('ass-list');
      if (!tbody) return;

      tbody.innerHTML = filtered.length === 0
        ? `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text3)">Nenhum assessor encontrado</td></tr>`
        : filtered.map(nome => {
            const tot  = assCount[nome]  || 0;
            const esm  = assEsm[nome]    || 0;
            const chiv = assChivor[nome] || 0;
            const isActive = selectedAssessor === nome;
            return `<tr style="${isActive ? 'background:rgba(15,155,148,.07);' : ''}cursor:pointer">
              <td><strong style="color:var(--text)">${nome}</strong></td>
              <td style="text-align:center">
                <span class="badge rep">${tot}</span>
              </td>
              <td style="text-align:center">
                <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(15,155,148,.1);color:var(--accent2);font-weight:600">${esm || '—'}</span>
              </td>
              <td style="text-align:center">
                <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(108,92,231,.1);color:var(--purple);font-weight:600">${chiv || '—'}</span>
              </td>
              <td>
                <button class="btn sm secondary" data-view-ass="${nome}">Ver clientes</button>
              </td>
            </tr>`;
          }).join('');

      tbody.querySelectorAll('[data-view-ass]').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedAssessor = btn.dataset.viewAss;
          renderList(); // re-render para highlight
          renderDetail(btn.dataset.viewAss, '');
        });
      });
    }

    // ── Render do painel de detalhe ──
    let _detailAssessor = null;
    let _detailFilter   = 'all';

    function renderDetail(nome, catFilter) {
      _detailAssessor = nome;
      _detailFilter   = catFilter || 'all';

      document.getElementById('ass-detail-title').textContent =
        `${nome} — ${assCount[nome] || 0} cliente(s)`;

      // Toggle buttons de categoria
      const toggle = document.getElementById('ass-cat-toggle');
      if (toggle) toggle.style.display = 'flex';
      ['all','Esmeralda','Chivor'].forEach(k => {
        const el = document.getElementById(`ass-cat-${k==='all'?'all':k==='Esmeralda'?'esm':'chiv'}`);
        if (el) el.classList.toggle('active', _detailFilter === k);
      });

      let lista = clientes.filter(c => c.assessor === nome);
      if (_detailFilter === 'Esmeralda') lista = lista.filter(c => c.categoria_especial === 'Esmeralda');
      if (_detailFilter === 'Chivor')    lista = lista.filter(c => c.categoria_especial === 'Chivor');
      lista = lista.sort((a, b) =>
        (a.NomeFantasia || a.RazaoSocial || '').localeCompare(b.NomeFantasia || b.RazaoSocial || '', 'pt-BR'));

      const tbody = document.getElementById('ass-detail');
      if (!tbody) return;

      tbody.innerHTML = lista.length === 0
        ? `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text3)">Nenhum cliente nesta categoria.</td></tr>`
        : lista.map(c => {
            const catColor = c.categoria_especial === 'Esmeralda'
              ? 'rgba(15,155,148,.1);color:var(--accent2);border:1px solid rgba(15,155,148,.25)'
              : 'rgba(108,92,231,.1);color:var(--purple);border:1px solid rgba(108,92,231,.25)';
            return `<tr>
              <td>
                <span style="font-family:var(--mono);font-size:11px;color:var(--text3)">${c.Codigo}</span>
              </td>
              <td>
                <strong style="color:var(--text)">${c.NomeFantasia || c.RazaoSocial || '—'}</strong>
                ${c.Grupo ? `<div style="font-size:10px;color:var(--text3)">${c.Grupo}</div>` : ''}
              </td>
              <td>
                <span class="badge uf">${c.UF || '?'}</span>
              </td>
              <td>
                ${c.categoria_especial
                  ? programaBadge(c.categoria_especial)
                  : '<span style="color:var(--text3);font-size:11px">—</span>'}
              </td>
            </tr>`;
          }).join('');
    }

    // Expõe filtro de categoria do detalhe globalmente (botões chamam window._assFilter)
    window._assFilter = function(cat) {
      if (_detailAssessor) renderDetail(_detailAssessor, cat);
    };

    // Wire eventos
    document.getElementById('ass-search').addEventListener('input', renderList);
    document.getElementById('ass-cat-filter').addEventListener('change', renderList);

    renderList();
  };


})(window);
