// pages/divergencias.js — Corrigido: Fechamento de bloco adicionado
(function (global) {
  'use strict';
  var pages = global.pages || {};
  global.pages = pages;

// ===================== PAGE: DIVERGÊNCIAS =====================
  pages.divergencias = async function() {
    updateTopbar('Divergências', 'Cruzamento entre integração e base de envio', '');

    const [_clientesDiv, reps, sistemas, chamados, envios] = await Promise.all([
      dbAll('clientes'), dbAll('representantes'), dbAll('sistemas'),
      dbAll('chamados'), dbAll('envios')
    ]);
    
    const clientes = applyDataFilter(_clientesDiv, reps);

    if (envios.length === 0) {
      document.getElementById('content').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-title">Nenhuma base de envio importada</div>
          <div class="empty-state-sub">Importe a Base de Envio na tela de Importação para visualizar as divergências.</div>
        </div>`;
      return;
    }

    const repById = {}; for (const r of reps) repById[r.id] = r;
    const sysById = {}; for (const s of sistemas) sysById[s.id] = s;

    const chamadosByCliente = {};
    for (const ch of chamados) {
      if (!chamadosByCliente[ch.fk_cliente]) chamadosByCliente[ch.fk_cliente] = [];
      chamadosByCliente[ch.fk_cliente].push(ch);
    }

    const enviosByCliente = {};
    for (const ev of envios) {
      if (!enviosByCliente[ev.fk_cliente]) enviosByCliente[ev.fk_cliente] = { tipos: new Set(), total: 0, nomeCliente: ev.nomeCliente };
      enviosByCliente[ev.fk_cliente].tipos.add(ev.tipoEnvio.toUpperCase());
      enviosByCliente[ev.fk_cliente].total += ev.qntEnvio;
    }

    const envioClienteCodes = new Set(Object.keys(enviosByCliente));
    const div1 = []; const div2 = []; const div3 = []; const div4 = []; 

    for (const c of clientes) {
      const cod = String(c.Codigo);
      const chs = chamadosByCliente[cod] || [];
      const envInfo = enviosByCliente[cod];
      const tiposEnvio = envInfo ? [...envInfo.tipos] : [];
      const rep = repById[c.fk_representante];
      const sys = sysById[c.fk_sistema];
      const tipoIntExpected = getTipoIntExpected(chs);
      const temIntAtiva = tipoIntExpected !== 'SEM_INT';
      const enviandoInt = tiposEnvio.some(t => ENVIO_CONV.has(t) || ENVIO_WS.has(t));
      const enviandoQualquer = tiposEnvio.length > 0;

      const row = { c, chs, tiposEnvio, rep, sys, tipoIntExpected, envInfo };

      if (temIntAtiva && !enviandoQualquer) div1.push(row);
      if (!temIntAtiva && enviandoInt) div2.push(row);
      if (temIntAtiva && enviandoQualquer) {
        const tiposIntEnvio = tiposEnvio.filter(t => ENVIO_CONV.has(t) || ENVIO_WS.has(t));
        if (tiposIntEnvio.length > 0) {
          let diverge = false;
          if (tipoIntExpected === 'CONVENCIONAL' && tiposIntEnvio.some(t => ENVIO_WS.has(t))) diverge = true;
          if (tipoIntExpected === 'WEBSERVICE'   && tiposIntEnvio.some(t => ENVIO_CONV.has(t))) diverge = true;
          if (diverge) div3.push(row);
        }
      }
      if (sys) {
        const sysObj = sysById[c.fk_sistema];
        if (sysObj?.mensalidadeHabilitada && !enviandoQualquer) div4.push(row);
      }
    }

    const analistaSet = [...new Set(chamados.map(ch=>ch.analista).filter(Boolean))].sort();
    const ufSet       = [...new Set(clientes.map(c=>c.UF).filter(Boolean))].sort();
    const ALL_ENVIO_TYPES = [...new Set(envios.map(e=>e.tipoEnvio))].sort();

    let divFilters = { codigo:'', nome:'', rep:'', analista:'', uf:'' };
    let accState = { d1:false, d2:false, d3:false, d4:false };

    window._divToggleAcc = (key) => {
      accState[key] = !accState[key];
      renderPage();
    };

    function matchRow(row) {
      const { c, chs } = row;
      const f = divFilters;
      if (f.codigo   && !String(c.Codigo).includes(f.codigo)) return false;
      if (f.nome     && !(c.NomeFantasia||c.RazaoSocial||'').toLowerCase().includes(f.nome.toLowerCase())) return false;
      if (f.rep      && String(c.fk_representante) !== f.rep) return false;
      if (f.uf       && c.UF !== f.uf) return false;
      if (f.analista && !chs.some(ch => ch.analista === f.analista)) return false;
      return true;
    }

    function renderRows(list) {
      const filtered = list.filter(matchRow);
      if (!filtered.length) return `<tr><td colspan="100" style="text-align:center;padding:20px;color:var(--text3)">Nenhuma divergência encontrada.</td></tr>`;
      return filtered.map(({ c, chs, tiposEnvio, rep, sys, tipoIntExpected, envInfo }) => {
        const qtyByTipo = {};
        if (envInfo) {
          const evs = envios.filter(ev => ev.fk_cliente === String(c.Codigo));
          for (const ev of evs) qtyByTipo[ev.tipoEnvio] = (qtyByTipo[ev.tipoEnvio]||0) + ev.qntEnvio;
        }
        const tipoCols = ALL_ENVIO_TYPES.map(t => {
          const q = qtyByTipo[t];
          return `<td style="font-size:11px;text-align:right;color:${q?'var(--navy)':'var(--border2)'};">${q?q.toLocaleString('pt-BR'):'—'}</td>`;
        }).join('');
        return `<tr>
          <td><span style="font-family:var(--mono);font-size:11px;color:var(--text3)">${c.Codigo}</span></td>
          <td style="min-width:180px"><strong>${c.NomeFantasia||c.RazaoSocial||'—'}</strong></td>
          <td><span class="badge uf">${c.UF||'?'}</span></td>
          <td style="font-size:12px">${rep?.nome||'—'}</td>
          <td style="font-size:12px">${sys?.nome||'—'}</td>
          <td>${tipoIntExpected === 'WEBSERVICE' ? '<span class="div-badge ws">Webservice</span>' : tipoIntExpected === 'CONVENCIONAL' ? '<span class="div-badge conv">Convencional</span>' : '<span class="div-badge noint">Sem Int.</span>'}</td>
          ${tipoCols}
        </tr>`;
      }).join('');
    }

    const TYPE_HEADERS = ALL_ENVIO_TYPES.map(t=>`<th style="text-align:right;white-space:nowrap;min-width:90px">${t}</th>`).join('');
    const COL_HEADERS = `<th>Código</th><th>Nome</th><th>UF</th><th>Representante</th><th>Sistema</th><th>Int. Chamado</th>${TYPE_HEADERS}`;

    function accSection(key, colorClass, icon, label, list) {
      const count = list.filter(matchRow).length;
      const isOpen = accState[key];
      return `
        <div class="accordion-section">
          <div class="accordion-header div-section-title ${colorClass} ${isOpen?'':'collapsed'}" onclick="window._divToggleAcc('${key}')">
            <span class="acc-title">${icon} ${label} (${count})</span>
            <span class="accordion-chevron">›</span>
          </div>
          <div class="accordion-body ${isOpen?'open':''}" style="${isOpen?'':'display:none'}">
            <div class="div-table-wrap">
              <table style="width:100%;min-width:900px">
                <thead><tr>${COL_HEADERS}</tr></thead>
                <tbody>${renderRows(list)}</tbody>
              </table>
            </div>
          </div>
        </div>`;
    }

    function renderPage() {
      const periodoLabel = envios[0]?.periodo?.replace('~',' → ') || 'Período não identificado';
      document.getElementById('content').innerHTML = `
        <div style="font-size:12px;color:var(--text3);margin-bottom:16px">
          Período da base de envio: <strong style="color:var(--text2)">${periodoLabel}</strong>
          · <span>${envioClienteCodes.size.toLocaleString('pt-BR')} clientes com envio</span>
        </div>
        <div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:20px">
          <input type="text" id="df-codigo" placeholder="Cód..." value="${divFilters.codigo}" style="width:80px">
          <input type="text" id="df-nome" placeholder="Nome..." value="${divFilters.nome}" style="flex:1">
          <select id="df-uf"><option value="">UF</option>${ufSet.map(u=>`<option value="${u}" ${u===divFilters.uf?'selected':''}>${u}</option>`).join('')}</select>
          <select id="df-rep"><option value="">Rep</option>${reps.map(r=>`<option value="${r.id}" ${String(r.id)===divFilters.rep?'selected':''}>${r.nome}</option>`).join('')}</select>
          <button class="btn secondary sm" id="df-clear">Limpar</button>
        </div>
        <div id="div-sections-container">
          ${accSection('d1','red',   '⚠', 'Integração Ativa sem Envio', div1)}
          ${accSection('d2','amber', '⚠', 'Sem Int. enviando por Integração', div2)}
          ${accSection('d3','purple','⚠', 'Divergência de Tipo de Envio', div3)}
          ${accSection('d4','teal',  '⚠', 'Mensalidade Ativa sem Envio', div4)}
        </div>`;

      document.getElementById('df-codigo').oninput = e => { divFilters.codigo = e.target.value; renderPage(); };
      document.getElementById('df-nome').oninput = e => { divFilters.nome = e.target.value; renderPage(); };
      document.getElementById('df-uf').onchange = e => { divFilters.uf = e.target.value; renderPage(); };
      document.getElementById('df-clear').onclick = () => { divFilters = { codigo:'', nome:'', rep:'', analista:'', uf:'' }; renderPage(); };
    }
    renderPage();
  };

})(window); // ESTA LINHA FECHA A FUNÇÃO E RESOLVE O ERRO DE INPUT
