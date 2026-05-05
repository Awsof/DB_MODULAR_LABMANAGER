// pages/dashboard_comercial.js — Página Dashboard Comercial da Fase 4
(function (global) {
  "use strict";

  var pages = global.pages || {};
  global.pages = pages;

  pages.dashboard_comercial = async function() {
    updateTopbar('Dashboard Comercial', 'Visão gerencial de clientes, UFs, representantes e grupos', `<button class="btn-report" id="dash-com-report">📄 Gerar Relatório</button>`);
    document.getElementById('content').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;gap:12px;color:var(--text3)"><div class="spinner"></div> Carregando dados...</div>`;

    const [_clientesRaw2, reps, sistemas, _allChamados, _allEnvios] = await Promise.all([
      dbAll('clientes'), dbAll('representantes'), dbAll('sistemas'),
      dbAll('chamados'), dbAll('envios')
    ]);
    // ── RLS: filtrar clientes pelo vínculo do usuário ──
    const clientes = applyDataFilter(_clientesRaw2, reps);

    const repById = {}; for(const r of reps) repById[r.id] = r;
    const sysById = {}; for(const s of sistemas) sysById[s.id] = s;

    // ── Lookup maps O(n) ──
    const _chByC = {};
    for(const ch of _allChamados){
      if(!_chByC[ch.fk_cliente]) _chByC[ch.fk_cliente] = [];
      _chByC[ch.fk_cliente].push(ch);
    }
    const clienteIntStatus = {};
    for(const c of clientes) clienteIntStatus[c.Codigo] = getIntStatus(_chByC[c.Codigo] || []);

    const _evByC = {};
    for(const ev of _allEnvios){
      _evByC[ev.fk_cliente] = (_evByC[ev.fk_cliente]||0) + ev.qntEnvio;
    }

    // ── Aggregation O(n) ──
    const ufCount={}, repCount={}, grupoCount={}, ufFilialCount={};
    const repIntCount={}, repSysCount={}, repEnvioCount={};
    // Heatmap 1: chamados de integração por UF e clientes integrados por UF
    const chamadosByUF={}, clientesIntByUF={};
    // Heatmap 2: Esmeralda/Chivor por UF
    const esmeraldaByUF={}, chivorByUF={};

    for(const c of clientes){
      const rk  = c.fk_representante;
      const uf  = c.UF || '';
      const cod = String(c.Codigo);

      if(uf)    ufCount[uf]        = (ufCount[uf]       ||0) + 1;
      if(rk)    repCount[rk]       = (repCount[rk]      ||0) + 1;
      if(c.Grupo) grupoCount[c.Grupo] = (grupoCount[c.Grupo]||0) + 1;
      if(c.CodMatriz && uf) ufFilialCount[uf] = (ufFilialCount[uf]||0) + 1;

      // Heatmap 1A: chamados de integração por UF
      if(uf && _chByC[cod]) {
        const intChs = _chByC[cod].filter(ch => ch.tipoIntegracao || ch.tipoEnvio);
        if(intChs.length) chamadosByUF[uf] = (chamadosByUF[uf]||0) + intChs.length;
      }
      // Heatmap 1B: clientes integrados ativos por UF
      if(uf && clienteIntStatus[cod] === 'active')
        clientesIntByUF[uf] = (clientesIntByUF[uf]||0) + 1;

      // Heatmap 2: categorias especiais por UF
      if(uf && c.categoria_especial === 'Esmeralda') esmeraldaByUF[uf] = (esmeraldaByUF[uf]||0) + 1;
      if(uf && c.categoria_especial === 'Chivor')    chivorByUF[uf]    = (chivorByUF[uf]   ||0) + 1;

      if(rk){
        if(clienteIntStatus[cod] === 'active') repIntCount[rk] = (repIntCount[rk]||0) + 1;
        if(c.fk_sistema){
          if(!repSysCount[rk]) repSysCount[rk] = {};
          const sn = sysById[c.fk_sistema]?.nome || '?';
          repSysCount[rk][sn] = (repSysCount[rk][sn]||0) + 1;
        }
        repEnvioCount[rk] = (repEnvioCount[rk]||0) + (_evByC[cod]||0);
      }
    }

    const totalMatrizes = clientes.filter(c=>!c.CodMatriz||String(c.CodMatriz).trim()==='').length;
    const totalFiliais  = clientes.length - totalMatrizes;
    const PALETTE = ['#003761','#0F9B94','#C49B3C','#6c5ce7','#00b894','#d63031','#0984e3','#00cec9','#e17055','#a29bfe','#fd79a8','#55efc4'];
    const repLabel = rk => (repById[rk]?.nome || String(rk)).split(' ').slice(0,2).join(' ');

    const DATASETS = {
      'uf_clientes':  { label:'Clientes por UF (Top 12)',               type:'bar', horiz:true,  data:()=>{ const e=Object.entries(ufCount).sort((a,b)=>b[1]-a[1]).slice(0,12); return {labels:e.map(x=>x[0]),vals:e.map(x=>x[1]),colors:e.map((_,i)=>PALETTE[i%PALETTE.length])}; }},
      'rep_clientes': { label:'Clientes por Representante (Top 10)',     type:'bar', horiz:false, data:()=>{ const e=Object.entries(repCount).sort((a,b)=>b[1]-a[1]).slice(0,10); return {labels:e.map(x=>repLabel(x[0])),vals:e.map(x=>x[1]),colors:e.map((_,i)=>PALETTE[i%PALETTE.length])}; }},
      'grupo_dist':   { label:'Distribuição por Grupo (Top 10)',         type:'doughnut', horiz:false, data:()=>{ const e=Object.entries(grupoCount).sort((a,b)=>b[1]-a[1]).slice(0,10); return {labels:e.map(x=>x[0]),vals:e.map(x=>x[1]),colors:e.map((_,i)=>PALETTE[i%PALETTE.length])}; }},
      'int_rep':      { label:'Integração Ativa por Representante (Top 10)', type:'bar', horiz:true, data:()=>{ const e=Object.entries(repIntCount).sort((a,b)=>b[1]-a[1]).slice(0,10); return {labels:e.map(x=>repLabel(x[0])),vals:e.map(x=>x[1]),colors:e.map((_,i)=>PALETTE[i%PALETTE.length])}; }},
      'sys_rep':      { label:'Sistema por Representante (Top 10)',      type:'bar', horiz:true,  data:()=>{ const e=Object.entries(repSysCount).sort((a,b)=>Object.values(b[1]).reduce((s,v)=>s+v,0)-Object.values(a[1]).reduce((s,v)=>s+v,0)).slice(0,10); return {labels:e.map(x=>repLabel(x[0])),vals:e.map(x=>Object.values(x[1]).reduce((s,v)=>s+v,0)),colors:e.map((_,i)=>PALETTE[i%PALETTE.length])}; }},
      'envio_rep':    { label:'Volume de Envio por Representante (Top 10)', type:'bar', horiz:true, data:()=>{ const e=Object.entries(repEnvioCount).sort((a,b)=>b[1]-a[1]).slice(0,10); return {labels:e.map(x=>repLabel(x[0])),vals:e.map(x=>x[1]),colors:e.map((_,i)=>PALETTE[i%PALETTE.length])}; }},
      'mf_ratio':     { label:'Matrizes vs Filiais',                    type:'doughnut', horiz:false, data:()=>({ labels:['Matrizes','Filiais'], vals:[totalMatrizes,totalFiliais], colors:['#003761','#0F9B94'] })},
      'uf_filiais':   { label:'Filiais por UF (Top 12)',                 type:'bar', horiz:true,  data:()=>{ const e=Object.entries(ufFilialCount).sort((a,b)=>b[1]-a[1]).slice(0,12); return {labels:e.map(x=>x[0]),vals:e.map(x=>x[1]),colors:e.map((_,i)=>PALETTE[i%PALETTE.length])}; }},
    };

    const CHART_IDS = ['dcc-0','dcc-1','dcc-2','dcc-3'];
    const chartInstances = {};
    const chartChoices = { 'dcc-0':'uf_clientes', 'dcc-1':'rep_clientes', 'dcc-2':'int_rep', 'dcc-3':'sys_rep' };

    function buildSelect(id){
      return `<select class="dyn-chart-select" data-chart-id="${id}" onchange="window._comDashChange(this)">
        ${Object.entries(DATASETS).map(([k,v])=>`<option value="${k}" ${chartChoices[id]===k?'selected':''}>${v.label}</option>`).join('')}
      </select>`;
    }

    function renderChart(id){
      const key=chartChoices[id]; const ds=DATASETS[key]; const d=ds.data();
      if(chartInstances[id]){chartInstances[id].destroy();delete chartInstances[id];}
      const ctx=document.getElementById(`canvas-${id}`); if(!ctx) return;
      const isDonut=ds.type==='doughnut';
      chartInstances[id]=new Chart(ctx,{
        type:ds.type,
        data:{labels:d.labels,datasets:[{data:d.vals,backgroundColor:d.colors.map(c=>c+'cc'),borderColor:d.colors,borderWidth:1,borderRadius:isDonut?0:3,hoverOffset:isDonut?6:0}]},
        options:{indexAxis:ds.horiz?'y':'x',responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:isDonut,position:'right',labels:{color:'#8a96a8',font:{size:10},boxWidth:10}},
            tooltip:{callbacks:{label:ctx2=>{const t=d.vals.reduce((s,v)=>s+v,0);const pct=t>0?((ctx2.raw/t)*100).toFixed(1):'0.0';return ` ${ctx2.raw.toLocaleString('pt-BR')} (${pct}%)`;}}}},
          scales:isDonut?{}:{x:{ticks:{color:'#8a96a8',font:{size:10}},grid:{color:'#e4e8ef'}},y:{ticks:{color:'#8a96a8',font:{size:10},maxTicksLimit:12},grid:{color:'#e4e8ef'}}}}
      });
    }

    window._comDashChange=function(sel){chartChoices[sel.dataset.chartId]=sel.value;renderChart(sel.dataset.chartId);};

    document.getElementById('content').innerHTML = `
      <div class="metrics" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
        <div class="metric accent"><div class="metric-label">Total Clientes</div><div class="metric-val">${clientes.length.toLocaleString('pt-BR')}</div><div class="metric-sub">Cadastrados</div></div>
        <div class="metric green"><div class="metric-label">Matrizes</div><div class="metric-val">${totalMatrizes.toLocaleString('pt-BR')}</div><div class="metric-sub">Unidades sede</div></div>
        <div class="metric amber"><div class="metric-label">Grupos</div><div class="metric-val">${Object.keys(grupoCount).length.toLocaleString('pt-BR')}</div><div class="metric-sub">Distintos</div></div>
        <div class="metric purple"><div class="metric-label">💎 Especiais</div><div class="metric-val">${(Object.values(esmeraldaByUF).reduce((s,v)=>s+v,0)+Object.values(chivorByUF).reduce((s,v)=>s+v,0)).toLocaleString('pt-BR')}</div><div class="metric-sub">Esmeralda + Chivor</div></div>
      </div>

      <!-- Gráficos dinâmicos -->
      <div class="dyn-chart-grid" style="margin-bottom:24px">
        ${CHART_IDS.map(id=>`
          <div class="dyn-chart-card">
            <div class="dyn-chart-header">
              <span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text3)">Gráfico</span>
              ${buildSelect(id)}
            </div>
            <div class="dyn-chart-wrap"><canvas id="canvas-${id}"></canvas></div>
          </div>`).join('')}
      </div>

      <!-- ══ HEATMAPS GEOGRÁFICOS ══ -->
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:12px;padding-left:2px">
        🗺 Distribuição Geográfica por UF
      </div>

      <!-- Filtro de Período -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;padding:10px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r)">
        <span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">📅 Período</span>
        <div style="display:flex;align-items:center;gap:6px;flex:1;flex-wrap:wrap">
          <label style="font-size:11px;color:var(--text3)">De</label>
          <input type="date" id="hm-dt-ini" style="font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text2)">
          <label style="font-size:11px;color:var(--text3)">Até</label>
          <input type="date" id="hm-dt-fim" style="font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text2)">
          <button id="hm-filter-btn" style="font-size:11px;padding:4px 12px;border-radius:var(--r);border:1px solid var(--navy);background:var(--navy);color:#fff;cursor:pointer;font-weight:600">Filtrar</button>
          <button id="hm-clear-btn"  style="font-size:11px;padding:4px 10px;border-radius:var(--r);border:1px solid var(--border);background:var(--bg3);color:var(--text3);cursor:pointer">✕ Limpar</button>
          <span id="hm-period-label" style="font-size:10px;color:var(--accent2);margin-left:4px"></span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

        <!-- Heatmap 1: Operacional & Integração -->
        <div class="chart-card" style="padding:0;overflow:visible">
          <div style="padding:14px 16px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div style="font-size:12px;font-weight:700;color:var(--navy)">Operacional &amp; Integração</div>
            <div style="display:flex;gap:4px">
              <button id="hm1-btn-ch"  onclick="window._hm1Switch('chamados')"   style="font-size:10px;padding:3px 10px;border-radius:var(--r);border:1px solid var(--navy);background:var(--navy);color:#fff;cursor:pointer;transition:.15s">Volume de Chamados</button>
              <button id="hm1-btn-int" onclick="window._hm1Switch('integrados')" style="font-size:10px;padding:3px 10px;border-radius:var(--r);border:1px solid var(--border);background:var(--bg2);color:var(--text2);cursor:pointer;transition:.15s">Clientes Integrados</button>
            </div>
          </div>
          <div style="padding:10px 16px 14px;position:relative">
            <svg id="hm-svg-1" viewBox="0 0 500 570" style="width:100%;height:auto;display:block"></svg>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;font-size:10px;color:var(--text3)">
              <span>Menos</span>
              <div id="hm1-grad" style="flex:1;height:7px;border-radius:4px"></div>
              <span>Mais</span>
              <span id="hm1-max" style="font-weight:700;color:var(--navy);margin-left:4px"></span>
            </div>
          </div>
        </div>

        <!-- Heatmap 2: Segmentação Especial -->
        <div class="chart-card" style="padding:0;overflow:visible">
          <div style="padding:14px 16px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div style="font-size:12px;font-weight:700;color:var(--navy)">Segmentação Especial</div>
            <div style="display:flex;gap:4px">
              <button id="hm2-btn-esm"  onclick="window._hm2Switch('esmeralda')" style="font-size:10px;padding:3px 10px;border-radius:var(--r);border:1px solid var(--accent2);background:var(--accent2);color:#fff;cursor:pointer;transition:.15s">💎 Esmeralda</button>
              <button id="hm2-btn-chiv" onclick="window._hm2Switch('chivor')"    style="font-size:10px;padding:3px 10px;border-radius:var(--r);border:1px solid var(--border);background:var(--bg2);color:var(--text2);cursor:pointer;transition:.15s">💜 Chivor</button>
            </div>
          </div>
          <div style="padding:10px 16px 14px;position:relative">
            <svg id="hm-svg-2" viewBox="0 0 500 570" style="width:100%;height:auto;display:block"></svg>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;font-size:10px;color:var(--text3)">
              <span>Menos</span>
              <div id="hm2-grad" style="flex:1;height:7px;border-radius:4px"></div>
              <span>Mais</span>
              <span id="hm2-max" style="font-weight:700;color:var(--accent2);margin-left:4px"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tooltip compartilhado — posicionamento via JS -->
      <div id="hm-tooltip-shared" style="
        display:none;position:fixed;z-index:9999;pointer-events:none;
        background:rgba(0,18,40,.95);color:#fff;
        border-radius:8px;padding:10px 14px;
        box-shadow:0 6px 24px rgba(0,0,0,.4);
        font-size:12px;line-height:1.7;min-width:160px;
        border:1px solid rgba(255,255,255,.08)
      "></div>
    `;

    CHART_IDS.forEach(id=>renderChart(id));

    // ══════════════════════════════════════════════════════════════════
    //  ENGINE SVG — Heatmap Interativo do Brasil  (zero dependência)
    //  Features: filtro por período, tooltip multi-métrica, toggle ativo
    // ══════════════════════════════════════════════════════════════════

    const BR = {
      AC:{n:"Acre",            d:"M 6.5,181.5 L 16.3,216.9 L 42.4,233.9 L 63.0,235.3 L 72.8,226.8 L 71.7,205.6 L 53.3,187.1 L 42.4,177.2 Z"},
      AM:{n:"Amazonas",        d:"M 7.6,181.5 L 14.1,216.9 L 43.5,233.9 L 70.7,233.9 L 92.4,219.7 L 109.8,207.0 L 144.6,208.4 L 157.6,174.4 L 158.7,137.5 L 150.0,107.7 L 157.6,70.9 L 165.2,52.5 L 50.0,53.9 L 48.9,78.0 L 22.8,109.2 Z"},
      RR:{n:"Roraima",         d:"M 110.9,18.4 L 125.0,22.7 L 159.8,2.8 L 160.9,21.3 L 141.3,49.6 L 154.3,68.1 L 158.7,82.2 L 153.3,106.3 L 120.7,96.4 L 105.4,75.1 Z"},
      PA:{n:"Pará",            d:"M 157.6,174.4 L 178.3,161.6 L 209.8,155.9 L 239.1,134.7 L 258.7,103.5 L 282.6,80.8 L 288.0,70.9 L 255.4,18.4 L 241.3,21.3 L 253.3,35.4 L 244.6,49.6 L 225.0,52.5 L 165.2,52.5 L 157.6,70.9 L 150.0,107.7 L 158.7,137.5 Z"},
      AP:{n:"Amapá",           d:"M 255.4,18.4 L 250.0,35.4 L 244.6,49.6 L 239.1,49.6 L 229.3,42.5 L 222.8,52.5 L 217.4,42.5 L 220.7,21.3 L 241.3,21.3 Z"},
      TO:{n:"Tocantins",       d:"M 258.7,103.5 L 282.6,80.8 L 288.0,70.9 L 295.7,78.0 L 302.2,163.0 L 293.5,191.4 L 284.8,219.7 L 273.9,259.4 L 265.2,265.1 L 242.4,236.8 L 239.1,134.7 Z"},
      MA:{n:"Maranhão",        d:"M 305.4,114.8 L 325.0,99.2 L 339.1,113.4 L 353.3,113.4 L 358.7,119.1 L 354.3,137.5 L 344.6,155.9 L 333.7,170.1 L 322.8,174.4 L 314.1,177.2 L 298.9,170.1 L 295.7,148.9 L 295.7,78.0 L 288.0,70.9 Z"},
      PI:{n:"Piauí",           d:"M 358.7,119.1 L 371.7,123.3 L 369.6,141.8 L 364.1,170.1 L 351.1,188.6 L 326.1,205.6 L 315.2,212.7 L 314.1,177.2 L 322.8,174.4 L 333.7,170.1 L 344.6,155.9 L 354.3,137.5 Z"},
      CE:{n:"Ceará",           d:"M 371.7,123.3 L 405.4,120.5 L 429.3,155.9 L 413.0,170.1 L 402.2,188.6 L 391.3,184.3 L 369.6,181.5 L 369.6,141.8 Z"},
      RN:{n:"Rio Grande do Norte", d:"M 405.4,120.5 L 429.3,155.9 L 431.5,177.2 L 421.7,184.3 L 413.0,170.1 Z"},
      PB:{n:"Paraíba",         d:"M 402.2,188.6 L 413.0,170.1 L 431.5,177.2 L 431.5,197.1 L 423.9,198.5 L 413.0,194.2 L 396.7,191.4 Z"},
      PE:{n:"Pernambuco",      d:"M 402.2,188.6 L 396.7,191.4 L 413.0,194.2 L 423.9,198.5 L 431.5,197.1 L 427.2,212.7 L 413.0,212.7 L 391.3,205.6 L 380.4,205.6 L 369.6,212.7 L 362.0,219.7 L 362.0,198.5 L 369.6,181.5 L 391.3,184.3 Z"},
      AL:{n:"Alagoas",         d:"M 423.9,198.5 L 427.2,212.7 L 413.0,212.7 L 402.2,226.8 L 407.6,222.6 L 418.5,215.5 Z"},
      SE:{n:"Sergipe",         d:"M 407.6,222.6 L 416.3,229.7 L 407.6,241.0 L 396.7,233.9 L 396.7,219.7 L 402.2,226.8 Z"},
      BA:{n:"Bahia",           d:"M 402.2,226.8 L 407.6,241.0 L 391.3,259.4 L 385.9,276.5 L 391.3,290.6 L 385.9,302.0 L 377.2,326.1 L 364.1,337.4 L 344.6,319.0 L 334.8,297.7 L 315.2,290.6 L 309.8,276.5 L 315.2,255.2 L 305.4,241.0 L 293.5,191.4 L 302.2,163.0 L 326.1,205.6 L 351.1,188.6 L 364.1,170.1 L 362.0,198.5 L 362.0,219.7 L 369.6,212.7 L 380.4,205.6 L 391.3,205.6 L 413.0,212.7 Z"},
      MG:{n:"Minas Gerais",    d:"M 385.9,276.5 L 377.2,326.1 L 364.1,337.4 L 355.4,354.4 L 347.8,365.8 L 331.5,372.9 L 315.2,375.7 L 298.9,368.6 L 290.2,347.3 L 277.2,340.3 L 265.2,265.1 L 273.9,259.4 L 284.8,219.7 L 293.5,191.4 L 305.4,241.0 L 315.2,255.2 L 309.8,276.5 L 315.2,290.6 L 334.8,297.7 L 344.6,319.0 L 364.1,337.4 Z"},
      ES:{n:"Espírito Santo",  d:"M 377.2,326.1 L 385.9,302.0 L 391.3,290.6 L 385.9,276.5 L 369.6,340.3 L 364.1,337.4 Z"},
      RJ:{n:"Rio de Janeiro",  d:"M 364.1,368.6 L 347.8,365.8 L 331.5,372.9 L 326.1,382.8 L 340.2,402.6 L 353.3,402.6 L 364.1,397.0 L 369.6,382.8 Z"},
      SP:{n:"São Paulo",       d:"M 331.5,372.9 L 298.9,368.6 L 290.2,347.3 L 277.2,340.3 L 255.4,340.3 L 228.3,382.8 L 225.0,411.1 L 233.7,418.2 L 250.0,425.3 L 266.3,418.2 L 282.6,411.1 L 304.3,418.2 L 326.1,411.1 L 331.5,397.0 L 326.1,382.8 Z"},
      PR:{n:"Paraná",          d:"M 282.6,411.1 L 266.3,418.2 L 250.0,425.3 L 233.7,418.2 L 225.0,411.1 L 228.3,382.8 L 228.3,418.2 L 222.8,446.6 L 217.4,453.7 L 228.3,453.7 L 244.6,446.6 L 266.3,453.7 L 282.6,446.6 L 288.0,432.4 Z"},
      SC:{n:"Santa Catarina",  d:"M 282.6,446.6 L 266.3,453.7 L 244.6,446.6 L 228.3,453.7 L 228.3,467.8 L 239.1,474.9 L 260.9,482.0 L 282.6,474.9 Z"},
      RS:{n:"Rio Grande do Sul",d:"M 260.9,482.0 L 239.1,474.9 L 228.3,467.8 L 228.3,453.7 L 217.4,453.7 L 212.0,474.9 L 201.1,503.3 L 228.3,545.8 L 239.1,557.2 L 255.4,552.9 L 266.3,531.6 Z"},
      MS:{n:"Mato Grosso do Sul",d:"M 255.4,340.3 L 244.6,333.2 L 190.2,326.1 L 179.3,340.3 L 173.9,361.5 L 184.8,382.8 L 206.5,389.9 L 222.8,418.2 L 228.3,418.2 L 228.3,382.8 Z"},
      MT:{n:"Mato Grosso",     d:"M 242.4,236.8 L 255.4,276.5 L 244.6,333.2 L 190.2,326.1 L 157.6,304.8 L 141.3,262.3 L 152.2,233.9 L 157.6,174.4 L 178.3,161.6 L 209.8,155.9 L 239.1,134.7 Z"},
      GO:{n:"Goiás",           d:"M 293.5,191.4 L 305.4,241.0 L 315.2,255.2 L 309.8,276.5 L 315.2,290.6 L 293.5,290.6 L 282.6,297.7 L 265.2,265.1 L 277.2,340.3 L 290.2,347.3 L 298.9,368.6 L 293.5,191.4 Z"},
      DF:{n:"Distrito Federal", d:"M 293.5,290.6 L 282.6,297.7 L 285.9,304.8 L 293.5,304.8 Z"},
      RO:{n:"Rondônia",        d:"M 109.8,207.0 L 144.6,208.4 L 157.6,174.4 L 152.2,233.9 L 141.3,262.3 L 119.6,255.2 L 97.8,226.8 Z"},
    };

    const CENTROIDS = {
      AM:[88,149],PA:[215,128],MT:[194,278],BA:[355,238],MG:[318,308],
      GO:[278,268],MS:[208,368],SP:[273,388],PR:[250,432],RS:[236,508],
      MA:[318,146],PI:[346,166],TO:[268,183],CE:[396,156],RO:[133,226],
      RR:[146,68],AC:[40,208],AP:[235,38],RN:[422,150],PE:[390,198],
      PB:[416,191],AL:[413,216],SE:[406,229],ES:[380,314],RJ:[350,386],
      SC:[253,460],DF:[289,296],
    };

    // ── Interpolação de cor (gamma .5 = melhor spread perceptual) ──
    function lerpColor(hexA, hexB, t) {
      t = Math.pow(Math.max(0, Math.min(1, t)), 0.5);
      const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
      const [ar,ag,ab] = p(hexA), [br,bg,bb] = p(hexB);
      return `rgb(${Math.round(ar+(br-ar)*t)},${Math.round(ag+(bg-ag)*t)},${Math.round(ab+(bb-ab)*t)})`;
    }

    // ── Tooltip compartilhado (multi-métrica) ──
    const _hmTT = document.getElementById('hm-tooltip-shared');

    function showHMTooltip(e, uf, name) {
      if (!_hmTT) return;
      const ch  = _hmChamadosByUF[uf]    || 0;
      const int = _hmClientesIntByUF[uf] || 0;
      const esm = _hmEsmeraldaByUF[uf]   || 0;
      const chv = _hmChivorByUF[uf]      || 0;
      const tot = _hmUfCount[uf]          || 0;

      _hmTT.innerHTML = `
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,.15);padding-bottom:5px">${name} <span style="font-size:10px;opacity:.6;font-weight:400">${uf}</span></div>
        <div style="display:grid;grid-template-columns:auto auto;gap:2px 14px">
          <span style="opacity:.7">Clientes totais</span>    <span style="font-weight:700;text-align:right">${tot.toLocaleString('pt-BR')}</span>
          <span style="opacity:.7">Chamados integ.</span>    <span style="font-weight:700;text-align:right;color:#93c5fd">${ch.toLocaleString('pt-BR')}</span>
          <span style="opacity:.7">Integrados ativos</span> <span style="font-weight:700;text-align:right;color:#6ee7b7">${int.toLocaleString('pt-BR')}</span>
          ${esm>0||chv>0 ? `<span style="opacity:.7">💎 Esmeralda</span>   <span style="font-weight:700;text-align:right;color:#5eead4">${esm.toLocaleString('pt-BR')}</span>
          <span style="opacity:.7">💜 Chivor</span>         <span style="font-weight:700;text-align:right;color:#c4b5fd">${chv.toLocaleString('pt-BR')}</span>` : ''}
        </div>`;
      _hmTT.style.display = 'block';
      moveHMTooltip(e);
    }

    function moveHMTooltip(e) {
      if (!_hmTT) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const tw = _hmTT.offsetWidth  || 200;
      const th = _hmTT.offsetHeight || 120;
      let lx = e.clientX + 16, ly = e.clientY - 20;
      if (lx + tw > vw - 8)  lx = e.clientX - tw - 10;
      if (ly + th > vh - 8)  ly = e.clientY - th - 10;
      if (ly < 8) ly = 8;
      _hmTT.style.left = lx + 'px';
      _hmTT.style.top  = ly + 'px';
    }

    function hideHMTooltip() { if (_hmTT) _hmTT.style.display = 'none'; }

    // ── Dados reativs ao período (recalculados ao filtrar) ──
    let _hmChamadosByUF    = { ...chamadosByUF };
    let _hmClientesIntByUF = { ...clientesIntByUF };
    let _hmEsmeraldaByUF   = { ...esmeraldaByUF };
    let _hmChivorByUF      = { ...chivorByUF };
    let _hmUfCount         = { ...ufCount };

    // ── Recalcula chamados por UF filtrado por período ──
    function recalcHMData(dtIni, dtFim) {
      const newCh = {}, newInt = {};
      // Clientes totais e integrados nunca mudam por período (são estados do cadastro)
      // Apenas chamados são filtrados por dataSolicitacao
      for (const c of clientes) {
        const uf  = c.UF || '';
        const cod = String(c.Codigo);
        if (!uf) continue;
        newInt[uf] = newInt[uf] || 0;
        if (clienteIntStatus[cod] === 'active') newInt[uf]++;

        const chs = _chByC[cod] || [];
        for (const ch of chs) {
          if (!ch.tipoIntegracao && !ch.tipoEnvio) continue;
          // Filtro de período por dataSolicitacao
          if (dtIni || dtFim) {
            const ds = (ch.dataSolicitacao || '').slice(0,10);
            if (!ds) continue;
            if (dtIni && ds < dtIni) continue;
            if (dtFim && ds > dtFim) continue;
          }
          newCh[uf] = (newCh[uf] || 0) + 1;
        }
      }
      _hmChamadosByUF    = newCh;
      _hmClientesIntByUF = newInt;
      // Esmeralda/Chivor são atributos do cliente — não filtram por período
      _hmEsmeraldaByUF   = { ...esmeraldaByUF };
      _hmChivorByUF      = { ...chivorByUF };
      _hmUfCount         = { ...ufCount };
    }

    // ── drawHeatmap: desenha um SVG com paths coloridos por dataMap ──
    function drawHeatmap(svgId, gradId, maxId, dataMap, colorLow, colorHigh, unitLabel) {
      const svg = document.getElementById(svgId);
      if (!svg) return;
      const vals = Object.values(dataMap).filter(v => v > 0);
      const maxV = vals.length ? Math.max(...vals) : 1;

      // Legenda
      const grad  = document.getElementById(gradId);
      const maxEl = document.getElementById(maxId);
      if (grad)  grad.style.background = `linear-gradient(to right,${colorLow},${colorHigh})`;
      if (maxEl) maxEl.textContent = maxV.toLocaleString('pt-BR') + ' ' + unitLabel;

      // Paths
      const pathsSVG = Object.entries(BR).map(([uf, {n, d}]) => {
        const val    = dataMap[uf] || 0;
        const fill   = val === 0 ? '#e8edf3' : lerpColor(colorLow, colorHigh, val / maxV);
        const isZero = val === 0;
        return `<path id="hm-path-${svgId}-${uf}"
          data-uf="${uf}" data-name="${n}"
          d="${d}" fill="${fill}" stroke="#fff" stroke-width="${isZero?'.8':'1.1'}"
          style="cursor:${isZero?'default':'pointer'};transition:filter .12s,fill .25s"
          class="hm-path"/>`;
      }).join('');

      // Labels de UF
      const labelsSVG = Object.entries(CENTROIDS).map(([uf, [x, y]]) => {
        const val  = dataMap[uf] || 0;
        const t    = maxV > 0 ? val / maxV : 0;
        const col  = (t > 0.45) ? '#ffffff' : '#3d4a5c';
        return `<text x="${x}" y="${y}" font-size="7" font-family="system-ui,sans-serif"
          font-weight="700" text-anchor="middle" fill="${col}" pointer-events="none"
          style="user-select:none">${uf}</text>`;
      }).join('');

      svg.innerHTML = pathsSVG + labelsSVG;

      // Eventos do tooltip compartilhado
      svg.querySelectorAll('.hm-path').forEach(path => {
        path.addEventListener('mouseenter', e => {
          path.style.filter = 'brightness(1.14) drop-shadow(0 1px 4px rgba(0,0,0,.3))';
          showHMTooltip(e, path.dataset.uf, path.dataset.name);
        });
        path.addEventListener('mousemove', moveHMTooltip);
        path.addEventListener('mouseleave', () => {
          path.style.filter = '';
          hideHMTooltip();
        });
      });
    }

    // ── Estado dos toggles ──
    let hm1Mode = 'chamados', hm2Mode = 'esmeralda';

    function applyBtnState(btns, activeKey) {
      Object.entries(btns).forEach(([k, {el, on, off, onTxt, offTxt, border}]) => {
        const btn = document.getElementById(el); if (!btn) return;
        const isOn = k === activeKey;
        btn.style.background  = isOn ? on : off;
        btn.style.color       = isOn ? onTxt : offTxt;
        btn.style.borderColor = isOn ? border : 'var(--border)';
      });
    }

    const HM1_BTNS = {
      chamados:   {el:'hm1-btn-ch',  on:'var(--navy)', off:'var(--bg2)', onTxt:'#fff', offTxt:'var(--text2)', border:'var(--navy)'},
      integrados: {el:'hm1-btn-int', on:'var(--navy)', off:'var(--bg2)', onTxt:'#fff', offTxt:'var(--text2)', border:'var(--navy)'},
    };
    const HM2_BTNS = {
      esmeralda: {el:'hm2-btn-esm', on:'var(--accent2)', off:'var(--bg2)', onTxt:'#fff', offTxt:'var(--text2)', border:'var(--accent2)'},
      chivor:    {el:'hm2-btn-chiv',on:'#6c5ce7',        off:'var(--bg2)', onTxt:'#fff', offTxt:'var(--text2)', border:'#6c5ce7'},
    };

    function paintHM1() {
      const data  = hm1Mode === 'chamados' ? _hmChamadosByUF : _hmClientesIntByUF;
      const label = hm1Mode === 'chamados' ? 'chamados' : 'integrados';
      drawHeatmap('hm-svg-1', 'hm1-grad', 'hm1-max', data, '#dbeafe', '#003761', label);
      applyBtnState(HM1_BTNS, hm1Mode);
    }

    function paintHM2() {
      const data    = hm2Mode === 'esmeralda' ? _hmEsmeraldaByUF : _hmChivorByUF;
      const label   = hm2Mode === 'esmeralda' ? 'Esmeralda' : 'Chivor';
      const hiColor = hm2Mode === 'esmeralda' ? '#0F9B94' : '#6c5ce7';
      const loColor = hm2Mode === 'esmeralda' ? '#ccfaf8' : '#ede9fe';
      drawHeatmap('hm-svg-2', 'hm2-grad', 'hm2-max', data, loColor, hiColor, label);
      applyBtnState(HM2_BTNS, hm2Mode);
    }

    function repaintAll() { paintHM1(); paintHM2(); }

    window._hm1Switch = function(mode) { hm1Mode = mode; paintHM1(); };
    window._hm2Switch = function(mode) { hm2Mode = mode; paintHM2(); };

    // ── Filtro de Período ──
    function applyPeriodFilter() {
      const dtIni = document.getElementById('hm-dt-ini')?.value || '';
      const dtFim = document.getElementById('hm-dt-fim')?.value || '';
      recalcHMData(dtIni, dtFim);
      repaintAll();
      // Label visual
      const lbl = document.getElementById('hm-period-label');
      if (lbl) {
        if (dtIni || dtFim) {
          const fmt = d => d ? d.split('-').reverse().join('/') : '…';
          lbl.textContent = `Exibindo: ${fmt(dtIni)} → ${fmt(dtFim)}`;
        } else {
          lbl.textContent = '';
        }
      }
    }

    document.getElementById('hm-filter-btn')?.addEventListener('click', applyPeriodFilter);
    document.getElementById('hm-dt-fim')?.addEventListener('change', e => {
      const ini = document.getElementById('hm-dt-ini')?.value;
      if (ini && e.target.value) applyPeriodFilter(); // auto-apply when both dates set
    });
    document.getElementById('hm-clear-btn')?.addEventListener('click', () => {
      const ini = document.getElementById('hm-dt-ini');
      const fim = document.getElementById('hm-dt-fim');
      if (ini) ini.value = '';
      if (fim) fim.value = '';
      recalcHMData('', ''); // reset to full dataset
      repaintAll();
      const lbl = document.getElementById('hm-period-label');
      if (lbl) lbl.textContent = '';
    });

    // Render inicial
    repaintAll();

    document.getElementById('dash-com-report')?.addEventListener('click', ()=>{
      const ufRows  = Object.entries(ufCount).sort((a,b)=>b[1]-a[1]).map(([uf,n])=>[uf, n, `${((n/clientes.length)*100).toFixed(1)}%`]);
      const repRows = Object.entries(repCount).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([id,n])=>[(repById[id]?.nome||id),n]);
      const grRows  = Object.entries(grupoCount).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([g,n])=>[g,n]);
      const hmRows  = Object.entries(chamadosByUF).sort((a,b)=>b[1]-a[1]).map(([uf,n])=>[uf,n,(esmeraldaByUF[uf]||0),(chivorByUF[uf]||0)]);
      generateReport('Dashboard Comercial','Relatório Comercial',[
        {heading:'Clientes por UF',headers:['UF','Total','%'],rows:ufRows},
        {heading:'Clientes por Representante',headers:['Representante','Total'],rows:repRows},
        {heading:'Top Grupos',headers:['Grupo','Total'],rows:grRows},
        {heading:'Distribuição Geográfica (Chamados/Esmeralda/Chivor)',headers:['UF','Chamados Int.','Esmeralda','Chivor'],rows:hmRows},
        {heading:'Resumo',headers:['Indicador','Valor'],rows:[
          ['Total Clientes',clientes.length],['Matrizes',totalMatrizes],['Filiais',totalFiliais],
          ['Grupos',Object.keys(grupoCount).length],
          ['Esmeralda',Object.values(esmeraldaByUF).reduce((s,v)=>s+v,0)],
          ['Chivor',Object.values(chivorByUF).reduce((s,v)=>s+v,0)]
        ]}
      ]);
    });
  };


})(window);
