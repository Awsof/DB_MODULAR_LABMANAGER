// pages/divergencias.js — extraído da fase 4
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
    // ── RLS: filtrar clientes pelo vínculo do usuário ──
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

    // Build lookup indexes
    const repById = {}; for (const r of reps) repById[r.id] = r;
    const sysById = {}; for (const s of sistemas) sysById[s.id] = s;

    // Per client: group chamados
    const chamadosByCliente = {};
    for (const ch of chamados) {
      if (!chamadosByCliente[ch.fk_cliente]) chamadosByCliente[ch.fk_cliente] = [];
      chamadosByCliente[ch.fk_cliente].push(ch);
    }

    // Per client: group envios — unique tipoEnvio set + total qty
    const enviosByCliente = {};
    for (const ev of envios) {
      if (!enviosByCliente[ev.fk_cliente]) enviosByCliente[ev.fk_cliente] = { tipos: new Set(), total: 0, nomeCliente: ev.nomeCliente };
      enviosByCliente[ev.fk_cliente].tipos.add(ev.tipoEnvio.toUpperCase());
      enviosByCliente[ev.fk_cliente].total += ev.qntEnvio;
    }

    // Get period label
    const periodo = envios[0]?.periodo?.replace('~',' → ') || '';

    // Período available clientes codes (from envio base)
    const envioClienteCodes = new Set(Object.keys(enviosByCliente));

    // Build divergence lists
    const div1 = []; // Integração ativa + não enviando
    const div2 = []; // Sem integração ativa + enviando por integração
    const div3 = []; // Tipo de envio diverge do tipo de chamado ativo
    const div4 = []; // Mensalidade ativa + não enviando

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

      // DIV 1: tem integração ativa + não está enviando nada no período
      if (temIntAtiva && !enviandoQualquer) div1.push(row);

      // DIV 2: sem integração ativa + está enviando por tipo de integração
      if (!temIntAtiva && enviandoInt) div2.push(row);

      // DIV 3: tipo de envio diverge do tipo de chamado ativo
      if (temIntAtiva && enviandoQualquer) {
        const tiposIntEnvio = tiposEnvio.filter(t => ENVIO_CONV.has(t) || ENVIO_WS.has(t));
        if (tiposIntEnvio.length > 0) {
          let diverge = false;
          if (tipoIntExpected === 'CONVENCIONAL' && tiposIntEnvio.some(t => ENVIO_WS.has(t))) diverge = true;
          if (tipoIntExpected === 'WEBSERVICE'   && tiposIntEnvio.some(t => ENVIO_CONV.has(t))) diverge = true;
          if (diverge) div3.push(row);
        }
      }

      // DIV 4: mensalidade ativa no sistema + não enviando
      if (sys && (Array.isArray(sys.id ? [sys] : []) || true)) {
        // Check sistema mensalidade
        const sysObj = sysById[c.fk_sistema];
        if (sysObj?.mensalidadeHabilitada && !enviandoQualquer) div4.push(row);
      }
    }

    // Collect all analistas from chamados for filter
    const analistaSet = [...new Set(chamados.map(ch=>ch.analista).filter(Boolean))].sort();
    const ufSet       = [...new Set(clientes.map(c=>c.UF).filter(Boolean))].sort();
    const tiposEnvioSet = [...new Set(envios.map(e=>e.tipoEnvio).filter(Boolean))].sort();

    // STATE
    let divFilters = { codigo:'', nome:'', rep:'', analista:'', sistema:'', uf:'', tipoEnvio:'', tipoChamado:'' };

    function matchRow(row) {
      const { c, chs, tiposEnvio, rep, sys } = row;
      const f = divFilters;
      if (f.codigo   && !String(c.Codigo).includes(f.codigo)) return false;
      if (f.nome     && !(c.NomeFantasia||c.RazaoSocial||'').toLowerCase().includes(f.nome.toLowerCase())) return false;
      if (f.rep      && String(c.fk_representante) !== f.rep) return false;
      if (f.uf       && c.UF !== f.uf) return false;
      if (f.sistema  && String(c.fk_sistema) !== f.sistema) return false;
      if (f.analista && !chs.some(ch => ch.analista === f.analista)) return false;
      if (f.tipoEnvio && !tiposEnvio.includes(f.tipoEnvio)) return false;
      if (f.tipoChamado) {
        const ativos = chs.filter(ch=>ch.integracaoAtiva);
        if (!ativos.some(ch=>(ch.tipoIntegracao||'').toLowerCase().includes(f.tipoChamado.toLowerCase()))) return false;
      }
      return true;
    }

    function renderEnvioChips(tipos) {
      return tipos.map(t => {
        let cls = 'div-badge noint';
        if (ENVIO_CONV.has(t)) cls = 'div-badge conv';
        else if (ENVIO_WS.has(t)) cls = 'div-badge ws';
        return `<span class="${cls}">${t}</span>`;
      }).join(' ');
    }

    function renderIntBadge(tipo) {
      if (tipo === 'CONVENCIONAL') return `<span class="div-badge conv">Convencional</span>`;
      if (tipo === 'WEBSERVICE')   return `<span class="div-badge ws">Webservice</span>`;
      return `<span class="div-badge noint">Sem Integração</span>`;
    }

    // All unique envio types across current dataset
    const ALL_ENVIO_TYPES = [...new Set(envios.map(e=>e.tipoEnvio))].sort();

    function renderRows(list) {
      const filtered = list.filter(matchRow);
      if (!filtered.length) return `<tr><td colspan="100" style="text-align:center;padding:20px;color:var(--text3)">Nenhuma divergência nesta categoria com os filtros aplicados.</td></tr>`;
      return filtered.map(({ c, chs, tiposEnvio, rep, sys, tipoIntExpected, envInfo }) => {
        // per-tipo qty map
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
          <td style="min-width:180px"><strong style="color:var(--text)">${c.NomeFantasia||c.RazaoSocial||'—'}</strong></td>
          <td><span class="badge uf">${c.UF||'?'}</span></td>
          <td style="font-size:12px">${rep?.nome||'—'}</td>
          <td style="font-size:12px">${sys?.nome||'—'}</td>
          <td>${renderIntBadge(tipoIntExpected)}</td>
          ${tipoCols}
        </tr>`;
      }).join('');
    }

    const TYPE_HEADERS = ALL_ENVIO_TYPES.map(t=>`<th style="text-align:right;white-space:nowrap;min-width:90px">${t}</th>`).join('');
    const COL_HEADERS = `
      <th>Código</th><th>Nome</th><th>UF</th><th>Representante</th>
      <th>Sistema</th><th>Int. Chamado</th>${TYPE_HEADERS}`;

    let accState = { d1:false, d2:false, d3:false, d4:false };

    function toggleAcc(key) {
      accState[key] = !accState[key];
      renderPage();
    }
    window._divToggleAcc = toggleAcc;

    function accSection(key, colorClass, icon, label, list) {
      const count = list.filter(matchRow).length;
      const isOpen = accState[key];
      return `
        <div class="accordion-section">
          <div class="accordion-header div-section-title ${colorClass} ${isOpen?'':'collapsed'}" onclick="toggleAcc('${key}')">
            <span class="acc-title">${icon} ${label} (${count})</span>
            <span class="accordion-chevron">›</span>
          </div>
          <div class="accordion-body ${isOpen?'open':''}" style="${isOpen?'':'display:none'}">
            <div class="div-table-wrap">
              <table style="width:100%;min-width:900px;table-layout:auto">
                <thead><tr>${COL_HEADERS}</tr></thead>
                <tbody>${renderRows(list)}</tbody>
              </table>
            </div>
          </div>
        </div>`;
    }

    function renderPage() {
      document.getElementById('div-content').innerHTML =
        accSection('d1','red',   '⚠', 'Integração Ativa sem Envio no Período', div1) +
        accSection('d2','amber', '⚠', 'Sem Integração Ativa enviando por Integração', div2) +
        accSection('d3','purple','⚠', 'Divergência entre Tipo de Chamado e Tipo de Envio', div3) +
        accSection('d4','teal',  '⚠', 'Mensalidade Ativa sem Envio no Período', div4);
    }

    document.getElementById('content').innerHTML = `
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px">
        Período da base de envio: <strong style="color:var(--text2)">${periodo}</strong>
        · <span style="color:var(--text3)">${envioClienteCodes.size.toLocaleString('pt-BR')} clientes com envio registrado</span>
      </div>

      <!-- FILTERS -->
      <div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:20px">
        <div class="search-wrap no-icon" style="flex:1;min-width:90px">
          <input type="text" id="df-codigo" placeholder="Código..." value="${divFilters.codigo}">
        </div>
        <div class="search-wrap" style="flex:2;min-width:160px">
          <span class="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></span>
          <input type="text" id="df-nome" placeholder="Nome do cliente..." value="${divFilters.nome}">
        </div>
        <select id="df-uf" style="flex:0 0 auto">
          <option value="">Todas as UFs</option>
          ${ufSet.map(u=>`<option value="${u}" ${u===divFilters.uf?'selected':''}>${u}</option>`).join('')}
        </select>
        <select id="df-rep" style="flex:0 0 auto">
          <option value="">Todos os representantes</option>
          ${[...reps].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(r=>`<option value="${r.id}" ${String(r.id)===divFilters.rep?'selected':''}>${r.nome}</option>`).join('')}
        </select>
        <select id="df-sistema" style="flex:0 0 auto">
          <option value="">Todos os sistemas</option>
          ${sistemas.map(s=>`<option value="${s.id}" ${String(s.id)===divFilters.sistema?'selected':''}>${s.nome}</option>`).join('')}
        </select>
        <select id="df-analista" style="flex:0 0 auto">
          <option value="">Todos os analistas</option>
          ${analistaSet.map(a=>`<option value="${a}" ${a===divFilters.analista?'selected':''}>${a}</option>`).join('')}
        </select>
        <select id="df-tipo-envio" style="flex:0 0 auto">
          <option value="">Todos tipos de envio</option>
          ${tiposEnvioSet.map(t=>`<option value="${t}" ${t===divFilters.tipoEnvio?'selected':''}>${t}</option>`).join('')}
        </select>
        <select id="df-tipo-chamado" style="flex:0 0 auto">
          <option value="">Todos tipos de chamado</option>
          <option value="Convencional" ${divFilters.tipoChamado==='Convencional'?'selected':''}>Convencional (XML)</option>
          <option value="Webservice" ${divFilters.tipoChamado==='Webservice'?'selected':''}>Webservice</option>
        </select>
        <button class="btn secondary" id="df-clear">Limpar filtros</button>
      </div>

      <div id="div-content"></div>
    `;

    renderPage();

    // Wire filters
    const wire = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', e => {
        divFilters[key] = e.target.value;
        renderPage();
      });
    };
    wire('df-codigo',      'codigo');
    wire('df-nome',        'nome');
    wire('df-rep',         'rep');
    wire('df-uf',          'uf');
    wire('df-sistema',     'sistema');
    wire('df-analista',    'analista');
    wire('df-tipo-envio',  'tipoEnvio');
    wire('df-tipo-chamado','tipoChamado');

    document.getElementById('df-clear').addEventListener('click', () => {
      divFilters = { codigo:'', nome:'', rep:'', analista:'', sistema:'', uf:'', tipoEnvio:'', tipoChamado:'' };
      ['df-codigo','df-nome','df-rep','df-uf','df-sistema','df-analista','df-tipo-envio','df-tipo-chamado'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      renderPage();
    });
  };

})(window);
