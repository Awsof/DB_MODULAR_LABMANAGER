// pages/dashboard.js — Página Dashboard Integração da Fase 4
// Define pages.dashboard como função assíncrona.
(function (global) {
  'use strict';

  var pages = global.pages || {};
  global.pages = pages;

  pages.dashboard = async function() {
    updateTopbar('Dashboard Integração', 'Visão gerencial de clientes e integrações', `<button class="btn-report" id="dash-int-report">📄 Gerar Relatório</button>`);

    const [_clientesRaw, reps, sistemas, chamados, envios] = await Promise.all([
      dbAll('clientes'), dbAll('representantes'), dbAll('sistemas'), dbAll('chamados'), dbAll('envios')
    ]);

    const clientes = applyDataFilter(_clientesRaw, reps);
    const repById = {}; for (const r of reps) repById[r.id] = r;
    const sysById = {}; for (const s of sistemas) sysById[s.id] = s;
    const chamadosByCliente = {};
    for (const ch of chamados) { if (!chamadosByCliente[ch.fk_cliente]) chamadosByCliente[ch.fk_cliente] = []; chamadosByCliente[ch.fk_cliente].push(ch); }
    const enviosByCliente = {};
    for (const ev of envios) { if (!enviosByCliente[ev.fk_cliente]) enviosByCliente[ev.fk_cliente] = {}; enviosByCliente[ev.fk_cliente][ev.tipoEnvio] = (enviosByCliente[ev.fk_cliente][ev.tipoEnvio] || 0) + ev.qntEnvio; }

    const _ENVIO_CONV = new Set(['INTEGRACAO','E-DB INTEGRACAO']);
    const _ENVIO_WS = new Set(['ETIQUETA PRIMARIA']);
    const _envByC = {};
    for (const ev of envios) {
      if (!_envByC[ev.fk_cliente]) _envByC[ev.fk_cliente] = { tipos: new Set() };
      _envByC[ev.fk_cliente].tipos.add(ev.tipoEnvio.toUpperCase());
    }

    const div1 = [], div2 = [], div3 = [], div4 = [];
    for (const c of clientes) {
      const cod = String(c.Codigo);
      const chs = chamadosByCliente[cod] || [];
      const envTipos = _envByC[cod] ? [..._envByC[cod].tipos] : [];
      const tipoIntExp = getTipoIntExpected(chs);
      const temInt = tipoIntExp !== 'SEM_INT';
      const envInt = envTipos.some(t => _ENVIO_CONV.has(t) || _ENVIO_WS.has(t));
      const envQ = envTipos.length > 0;
      const sys = sysById[c.fk_sistema];
      if (temInt && !envQ) div1.push(c);
      if (!temInt && envInt) div2.push(c);
      if (temInt && envQ) {
        const te = envTipos.filter(t => _ENVIO_CONV.has(t) || _ENVIO_WS.has(t));
        if (te.length > 0) {
          let d = false;
          if (tipoIntExp === 'CONVENCIONAL' && te.some(t => _ENVIO_WS.has(t))) d = true;
          if (tipoIntExp === 'WEBSERVICE' && te.some(t => _ENVIO_CONV.has(t))) d = true;
          if (d) div3.push(c);
        }
      }
      if (sys && sys.mensalidadeHabilitada && !envQ) div4.push(c);
    }

    const STATUS_LABELS = { none: 'Sem Integração', inactive: 'Integração Inativada', active: 'Integrado', impl: 'Em Implantação' };
    const ufCount = {}, repCount = {}, sysCount = {}, statusCount = { none: 0, inactive: 0, active: 0, impl: 0 }, envioTipoCount = {};
    for (const c of clientes) {
      if (c.UF) ufCount[c.UF] = (ufCount[c.UF] || 0) + 1;
      if (c.fk_representante) repCount[c.fk_representante] = (repCount[c.fk_representante] || 0) + 1;
      if (c.fk_sistema) sysCount[c.fk_sistema] = (sysCount[c.fk_sistema] || 0) + 1;
      const st = getIntStatus(chamadosByCliente[c.Codigo] || []);
      statusCount[st] = (statusCount[st] || 0) + 1;
    }
    for (const ev of envios) { envioTipoCount[ev.tipoEnvio] = (envioTipoCount[ev.tipoEnvio] || 0) + ev.qntEnvio; }

    const PALETTE = ['#003761','#0F9B94','#C49B3C','#6c5ce7','#00b894','#d63031','#0984e3','#00cec9','#e17055','#a29bfe','#fd79a8','#55efc4'];
    const intDateState = { ini: '', fim: '' };

    const DATASETS = {
      'integrados_uf': { label:'Integrados por UF (Top 10)', type:'bar', horiz:true, data:()=>{ const e = Object.entries((() => { const m={}; for (const c of clientes) { if (c.UF && getIntStatus(chamadosByCliente[c.Codigo] || []) === 'active') m[c.UF] = (m[c.UF] || 0) + 1; } return m; })()).sort((a,b)=>b[1]-a[1]).slice(0,10); return { labels:e.map(x=>x[0]), vals:e.map(x=>x[1]), colors:e.map((_,i)=>PALETTE[i%PALETTE.length]) }; } },
      'div_status':    { label:'Resumo de Divergências', type:'doughnut', horiz:false, data:()=>{ const [aI,sI,dT,mS] = [div1.length,div2.length,div3.length,div4.length]; return { labels:['Int. Ativa sem Envio','Sem Int. enviando','Tipo Divergente','Mens. sem Envio'], vals:[aI,sI,dT,mS], colors:['#d63031','#C49B3C','#6c5ce7','#0984e3'] }; } },
      'clientes_sys':  { label:'Clientes por Sistema', type:'doughnut', horiz:false, data:()=>{ const e = Object.entries(sysCount).sort((a,b)=>b[1]-a[1]).slice(0,10); return { labels:e.map(x=>sysById[x[0]]?.nome||x[0]), vals:e.map(x=>x[1]), colors:e.map((_,i)=>PALETTE[i%PALETTE.length]) }; } },
      'status_int':    { label:'Status de Integração', type:'doughnut', horiz:false, data:()=>{ const e = Object.entries(statusCount).filter(x=>x[1]>0); return { labels:e.map(x=>STATUS_LABELS[x[0]]), vals:e.map(x=>x[1]), colors:['#8a96a8','#d63031','#0F9B94','#C49B3C'] }; } },
      'envio_tipo':    { label:'Volume por Tipo de Envio', type:'bar', horiz:false, data:()=>{ const e = Object.entries(envioTipoCount).sort((a,b)=>b[1]-a[1]); return { labels:e.map(x=>x[0]), vals:e.map(x=>x[1]), colors:e.map((_,i)=>PALETTE[i%PALETTE.length]) }; } },
      'status_mes':    { label:'Status Integrações por Mês', type:'bar', horiz:false, hasDateRange:true, data:()=>{
        const mesCount={}; const ini=intDateState.ini; const fim=intDateState.fim;
        for (const ch of chamados) {
          const m = (ch.dataFinalizacao||'').slice(0,7); if (!m) continue;
          if (ini && m < ini.slice(0,7)) continue;
          if (fim && m > fim.slice(0,7)) continue;
          if (!mesCount[m]) mesCount[m] = { active:0, inactive:0, impl:0 };
          const st = getIntStatus(chamadosByCliente[ch.fk_cliente] || []);
          if (mesCount[m][st] !== undefined) mesCount[m][st]++;
        }
        const ms = Object.keys(mesCount).sort();
        return { labels: ms, multiDatasets: [
          { label:'Integrado', data: ms.map(m=>mesCount[m].active), color:'#0F9B94' },
          { label:'Implantação', data: ms.map(m=>mesCount[m].impl), color:'#C49B3C' },
          { label:'Inativado', data: ms.map(m=>mesCount[m].inactive), color:'#d63031' },
        ] };
      } },
      'status_analista': { label:'Status por Analista', type:'bar', horiz:true, hasDateRange:true, data:()=>{
        const ini=intDateState.ini; const fim=intDateState.fim;
        const anaCount={};
        for (const ch of chamados) {
          const ana = ch.analista || '(sem analista)';
          const mFin = (ch.dataFinalizacao||'').slice(0,7);
          if (ini && mFin && mFin < ini.slice(0,7)) continue;
          if (fim && mFin && mFin > fim.slice(0,7)) continue;
          if (!anaCount[ana]) anaCount[ana] = { active:0, inactive:0, impl:0 };
          const st = getIntStatus(chamadosByCliente[ch.fk_cliente] || []);
          if (anaCount[ana][st] !== undefined) anaCount[ana][st]++;
        }
        const anas = Object.keys(anaCount).sort((a,b)=>{
          const ta = Object.values(anaCount[a]).reduce((s,v)=>s+v,0);
          const tb = Object.values(anaCount[b]).reduce((s,v)=>s+v,0);
          return tb-ta;
        }).slice(0,10);
        return { labels: anas, multiDatasets: [
          { label:'Integrado', data: anas.map(a=>anaCount[a].active), color:'#0F9B94' },
          { label:'Implantação', data: anas.map(a=>anaCount[a].impl), color:'#C49B3C' },
          { label:'Inativado', data: anas.map(a=>anaCount[a].inactive), color:'#d63031' },
        ] };
      } },
      'prazo_analista': { label:'Prazo (Dias Úteis) por Analista', type:'bar', horiz:true, hasDateRange:true, data:()=>{
        function bizDays(d1, d2) {
          if (!d1 || !d2) return null;
          const start = new Date(d1), end = new Date(d2);
          if (isNaN(start) || isNaN(end) || end < start) return null;
          let count = 0, cur = new Date(start);
          while (cur <= end) {
            const day = cur.getDay();
            if (day !== 0 && day !== 6) count++;
            cur.setDate(cur.getDate() + 1);
          }
          return Math.max(count - 1, 0);
        }
        const ini = intDateState.ini; const fim = intDateState.fim;
        const anaDays = {}; const anaQty = {};
        for (const ch of chamados) {
          if (!ch.dataFinalizacao) continue;
          const mFin = (ch.dataFinalizacao||'').slice(0,7);
          if (ini && mFin < ini.slice(0,7)) continue;
          if (fim && mFin > fim.slice(0,7)) continue;
          const d = bizDays(ch.dataSolicitacao, ch.dataFinalizacao);
          if (d === null) continue;
          const ana = ch.analista || '(sem analista)';
          anaDays[ana] = (anaDays[ana] || 0) + d;
          anaQty[ana] = (anaQty[ana] || 0) + 1;
        }
        const anas = Object.keys(anaDays).sort((a,b)=>(anaDays[b]/anaQty[b])-(anaDays[a]/anaQty[a])).slice(0,10);
        return { labels: anas.map(a=>`${a} (${anaQty[a]})`), vals: anas.map(a=>parseFloat((anaDays[a]/anaQty[a]).toFixed(1))), colors: anas.map((_,i)=>PALETTE[i%PALETTE.length]) };
      } },
    };

    const CHART_IDS = ['dci-0','dci-1','dci-2','dci-3'];
    const chartInstances = {};
    const chartChoices = { 'dci-0':'integrados_uf', 'dci-1':'div_status', 'dci-2':'clientes_sys', 'dci-3':'status_mes' };

    function buildSelect(id) {
      const dateRange = `<div id="range-${id}" style="display:none;gap:4px;align-items:center;margin-top:6px">
        <span style="font-size:10px;color:var(--text3)">De:</span>
        <input type="month" style="font-size:11px;padding:2px 5px;border:1px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);outline:none" oninput="window._intDateChange('${id}','ini',this.value)">
        <span style="font-size:10px;color:var(--text3)">Até:</span>
        <input type="month" style="font-size:11px;padding:2px 5px;border:1px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);outline:none" oninput="window._intDateChange('${id}','fim',this.value)">
      </div>`;
      return `<div><select class="dyn-chart-select" data-chart-id="${id}" onchange="window._intDashChange(this)">
        ${Object.entries(DATASETS).map(([k,v])=>`<option value="${k}" ${chartChoices[id]===k?'selected':''}>${v.label}</option>`).join('')}
      </select>${dateRange}</div>`;
    }

    function renderChart(id) {
      const key = chartChoices[id];
      const ds = DATASETS[key];
      const d = ds.data();
      if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
      const ctx = document.getElementById(`canvas-${id}`);
      if (!ctx) return;
      const isDonut = ds.type === 'doughnut';

      const rangeWrap = document.getElementById(`range-${id}`);
      if (rangeWrap) rangeWrap.style.display = ds.hasDateRange ? 'flex' : 'none';

      if (d.multiDatasets) {
        chartInstances[id] = new Chart(ctx, {
          type: 'bar',
          data: { labels: d.labels, datasets: d.multiDatasets.map(md => ({ label: md.label, data: md.data, backgroundColor: md.color + 'aa', borderColor: md.color, borderWidth: 1, borderRadius: 3 })) },
          options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{color:'#8a96a8',font:{size:10},boxWidth:10} } }, scales:{ x:{ticks:{color:'#8a96a8',font:{size:10}},grid:{color:'#e4e8ef'}}, y:{ticks:{color:'#8a96a8',font:{size:10}},grid:{color:'#e4e8ef'}} } }
        });
      } else {
        chartInstances[id] = new Chart(ctx, {
          type: ds.type,
          data: { labels: d.labels, datasets:[{ data: d.vals, backgroundColor: d.colors.map(c=>c+'cc'), borderColor: d.colors, borderWidth:1, borderRadius: isDonut?0:3, hoverOffset:isDonut?6:0 }] },
          options: { indexAxis: ds.horiz?'y':'x', responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:isDonut, position:'right', labels:{color:'#8a96a8',font:{size:10},boxWidth:10} } }, scales: isDonut ? {} : { x:{ticks:{color:'#8a96a8',font:{size:10}},grid:{color:'#e4e8ef'}}, y:{ticks:{color:'#8a96a8',font:{size:10}},grid:{color:'#e4e8ef'}} } }
        });
      }
    }

    window._intDashChange = function(sel) {
      const id = sel.dataset.chartId;
      chartChoices[id] = sel.value;
      renderChart(id);
    };
    window._intDateChange = function(id, field, val) {
      intDateState[field] = val;
      renderChart(id);
    };

    document.getElementById('content').innerHTML = `
      <div class="metrics" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
        <div class="metric accent"><div class="metric-label">Total Clientes</div><div class="metric-val">${clientes.length.toLocaleString('pt-BR')}</div><div class="metric-sub">Laboratórios</div></div>
        <div class="metric green"><div class="metric-label">Integrados</div><div class="metric-val">${statusCount.active.toLocaleString('pt-BR')}</div><div class="metric-sub">${((statusCount.active/Math.max(clientes.length,1))*100).toFixed(1)}% do total</div></div>
        <div class="metric amber"><div class="metric-label">Em Implantação</div><div class="metric-val">${statusCount.impl.toLocaleString('pt-BR')}</div><div class="metric-sub">Chamados em aberto</div></div>
        <div class="metric purple"><div class="metric-label">Sem Integração</div><div class="metric-val">${statusCount.none.toLocaleString('pt-BR')}</div><div class="metric-sub">Sem chamados</div></div>
      </div>
      <div class="dyn-chart-grid">
        ${CHART_IDS.map(id=>`
          <div class="dyn-chart-card">
            <div class="dyn-chart-header">
              <span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text3)">Gráfico</span>
              ${buildSelect(id)}
            </div>
            <div class="dyn-chart-wrap"><canvas id="canvas-${id}"></canvas></div>
          </div>`).join('')}
      </div>
    `;

    CHART_IDS.forEach(id => renderChart(id));

    document.getElementById('dash-int-report')?.addEventListener('click', async () => {
      const SL = { none:'Sem Integração', inactive:'Integração Inativada', active:'Integrado', impl:'Em Implantação' };
      const rows = clientes.map(c => [c.Codigo, c.NomeFantasia || c.RazaoSocial, c.UF, repById[c.fk_representante]?.nome || '—', sysById[c.fk_sistema]?.nome || '—', SL[getIntStatus(chamadosByCliente[c.Codigo] || [])] || '—']);
      generateReport('Dashboard Integração', 'Status de Integração', [{ heading: `Laboratórios (${rows.length})`, headers: ['Código','Nome','UF','Representante','Sistema','Status'], rows }]);
    });
  };

}(window));
