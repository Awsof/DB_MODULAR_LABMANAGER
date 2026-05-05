// pages/dashboard_financeiro.js — Página Dashboard Financeiro da Fase 4
(function (global) {
  "use strict";

  var pages = global.pages || {};
  global.pages = pages;

  // ===================== PAGE: DASHBOARD FINANCEIRO =====================
  pages.dashboard_financeiro = async function() {
    updateTopbar('Dashboard Financeiro', 'Visão gerencial de propostas, pacotes e budget', `<button class="btn-report" id="dash-fin-report">📄 Gerar Relatório</button>`);

    const [propostas, pacotes, _allRegistros, sistemas, budgetRecs] = await Promise.all([
      dbAll('propostas'), dbAll('pacotes'), dbAll('pacote_registros'), dbAll('sistemas'), dbAll('budget')
    ]);
    // Exclude registros whose pacote was deleted (orphaned records)
    const pacoteIds = new Set(pacotes.map(pk => pk.id));
    const pacote_registros = _allRegistros.filter(r => pacoteIds.has(r.fk_pacote));
    const sysById={}; for(const s of sistemas) sysById[s.id]=s;

    const anoAtual = new Date().getFullYear();
    const budgetRec = budgetRecs.find(b=>b.ano===anoAtual) || {ano:anoAtual, valorBudget:0};

    // Budget calculations
    const propAnuais = propostas.filter(p=>(p.dataAprovacao||'').startsWith(String(anoAtual)) && (p.status==='aprovada'||p.status==='paga'));
    const totalPropAprov = propAnuais.reduce((s,p)=>s+(p.valorProposta||0),0);
    const totalMensAprov  = propAnuais.reduce((s,p)=>s+(p.valorMensalidade||0),0) * 12; // annual mensalidade
    // Include paid pacotes in budget consumption (pacotes approved/paid this year)
    const pacotesAnuais = pacotes.filter(pk=>(pk.dataAprovacao||'').startsWith(String(anoAtual)));
    const totalPacotes  = pacotesAnuais.reduce((s,pk)=>s+((pk.valor||0)*(pk.qtdPacotes||1)),0);
    const totalConsumido  = totalPropAprov + totalMensAprov + totalPacotes;
    const budgetRestante  = budgetRec.valorBudget - totalConsumido;
    const pctUsado = budgetRec.valorBudget > 0 ? Math.min((totalConsumido / budgetRec.valorBudget)*100, 100) : 0;
    const barColor = pctUsado > 90 ? '#d63031' : pctUsado > 70 ? '#C49B3C' : '#0F9B94';

    // Chart datasets
    const byMonth={}; for(const p of propostas){const m=(p.dataLancamento||'').slice(0,7);if(!m)continue;if(!byMonth[m])byMonth[m]={total:0,aprovado:0,pago:0};byMonth[m].total++;if(p.status==='aprovada')byMonth[m].aprovado++;if(p.status==='paga')byMonth[m].pago++;}
    const months=Object.keys(byMonth).sort().slice(-12);
    const statusData=[{label:'Pendente',val:propostas.filter(p=>p.status==='pendente').length,color:'#C49B3C'},{label:'Aprovada',val:propostas.filter(p=>p.status==='aprovada').length,color:'#0F9B94'},{label:'Paga',val:propostas.filter(p=>p.status==='paga').length,color:'#003761'},{label:'Cancelada',val:propostas.filter(p=>p.status==='cancelada').length,color:'#d63031'}].filter(x=>x.val>0);
    const sysCount={}; for(const p of propostas){if(!p.fk_sistema)continue;const n=sysById[p.fk_sistema]?.nome||String(p.fk_sistema);sysCount[n]=(sysCount[n]||0)+1;}
    const topSys=Object.entries(sysCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const PALETTE=['#003761','#0F9B94','#C49B3C','#6c5ce7','#00b894','#d63031','#0984e3','#00cec9'];

    const valorByMonth={}; for(const p of propostas){const m=(p.dataAprovacao||'').slice(0,7);if(!m||(p.status!=='aprovada'&&p.status!=='paga'))continue;if(!valorByMonth[m])valorByMonth[m]=0;valorByMonth[m]+=(p.valorProposta||0);}
    const valMonths=Object.keys(valorByMonth).sort().slice(-12);

    // Date range state for financial charts
    const finDateState = { prop_ini:'', prop_fim:'', mens_ini:'', mens_fim:'' };

    // Mensalidades by month (grouped by dataAprovacao of approved/paid proposals)
    const mensByMonth={};
    for(const p of propostas){
      const m=(p.dataAprovacao||'').slice(0,7);
      if(!m||(p.status!=='aprovada'&&p.status!=='paga')) continue;
      if(!mensByMonth[m]) mensByMonth[m]=0;
      mensByMonth[m]+=(p.valorMensalidade||0);
    }

    const DATASETS={
      'prop_mes':    {label:'Propostas por Mês',        type:'bar', multi:true,  hasDateRange:'prop',
        data:(ini,fim)=>{
          const mf=months.filter(m=>(!ini||m>=ini.slice(0,7))&&(!fim||m<=fim.slice(0,7)));
          return {labels:mf,multiDatasets:[
            {label:'Total',data:mf.map(m=>byMonth[m]?.total||0),color:'#003761'},
            {label:'Aprovada',data:mf.map(m=>byMonth[m]?.aprovado||0),color:'#0F9B94'},
            {label:'Paga',data:mf.map(m=>byMonth[m]?.pago||0),color:'#C49B3C'},
          ]};
        }},
      'prop_status': {label:'Status das Propostas',     type:'doughnut', multi:false, data:()=>({labels:statusData.map(x=>x.label),vals:statusData.map(x=>x.val),colors:statusData.map(x=>x.color)})},
      'sys_prop':    {label:'Sistemas por Propostas',   type:'bar',      multi:false, data:()=>({labels:topSys.map(x=>x[0]),vals:topSys.map(x=>x[1]),colors:PALETTE})},
      'mens_mes':    {label:'Mensalidades por Mês',     type:'bar',      multi:false, hasDateRange:'mens',
        data:(ini,fim)=>{
          const ms=Object.keys(mensByMonth).sort().filter(m=>(!ini||m>=ini.slice(0,7))&&(!fim||m<=fim.slice(0,7)));
          return {labels:ms,vals:ms.map(m=>mensByMonth[m]),colors:ms.map((_,i)=>PALETTE[i%PALETTE.length])};
        }},
      'pac_val':     {label:'Valor por Pacote',         type:'bar', multi:false, data:()=>{const p=[...pacotes].sort((a,b)=>((b.valor||0)*(b.qtdPacotes||1))-((a.valor||0)*(a.qtdPacotes||1))).slice(0,8);return{labels:p.map(x=>x.nome.slice(0,18)),vals:p.map(x=>(x.valor||0)*(x.qtdPacotes||1)),colors:PALETTE};}},
      'budget_pie':  {label:'Budget Anual (Uso)',       type:'doughnut', multi:false, data:()=>({labels:['Propostas','Mensalidades','Pacotes','Disponível'],vals:[Math.max(totalPropAprov,0),Math.max(totalMensAprov,0),Math.max(totalPacotes,0),Math.max(budgetRestante,0)],colors:['#003761','#0F9B94','#C49B3C','#e4e8ef']})},
    };

    const CHART_IDS=['dcf-0','dcf-1','dcf-2','dcf-3'];
    const chartInstances={};
    const chartChoices={'dcf-0':'prop_mes','dcf-1':'prop_status','dcf-2':'sys_prop','dcf-3':'mens_mes'};

    function buildSelect(id){
      const dateRangeHtml=`<div id="frange-${id}" style="display:none;gap:4px;align-items:center;margin-top:6px;flex-wrap:wrap">
        <span style="font-size:10px;color:var(--text3)">De:</span>
        <input type="month" style="font-size:11px;padding:2px 5px;border:1px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);outline:none" oninput="window._finDateChange('${id}',DATASETS[chartChoices['${id}']]?.hasDateRange,'ini',this.value)">
        <span style="font-size:10px;color:var(--text3)">Até:</span>
        <input type="month" style="font-size:11px;padding:2px 5px;border:1px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text);outline:none" oninput="window._finDateChange('${id}',DATASETS[chartChoices['${id}']]?.hasDateRange,'fim',this.value)">
      </div>`;
      return `<div><select class="dyn-chart-select" data-chart-id="${id}" onchange="window._finDashChange(this)">
        ${Object.entries(DATASETS).map(([k,v])=>`<option value="${k}" ${chartChoices[id]===k?'selected':''}>${v.label}</option>`).join('')}
      </select>${dateRangeHtml}</div>`;
    }

    function renderChart(id){
      const key=chartChoices[id]; const ds=DATASETS[key];
      if(chartInstances[id]){chartInstances[id].destroy();delete chartInstances[id];}
      const ctx=document.getElementById(`canvas-${id}`);if(!ctx)return;
      const isDonut=ds.type==='doughnut';

      // Show/hide date range for this chart
      const rangeWrap=document.getElementById(`frange-${id}`);
      if(rangeWrap) rangeWrap.style.display=ds.hasDateRange?'flex':'none';

      // Call data() with date range if supported
      const ini = ds.hasDateRange==='prop' ? finDateState.prop_ini : ds.hasDateRange==='mens' ? finDateState.mens_ini : '';
      const fim = ds.hasDateRange==='prop' ? finDateState.prop_fim : ds.hasDateRange==='mens' ? finDateState.mens_fim : '';
      const d = ds.hasDateRange ? ds.data(ini,fim) : ds.data();

      if(d.multiDatasets){
        chartInstances[id]=new Chart(ctx,{type:'bar',data:{labels:d.labels,datasets:d.multiDatasets.map(md=>({label:md.label,data:md.data,backgroundColor:md.color+'aa',borderColor:md.color,borderWidth:1,borderRadius:3}))},
          options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#8a96a8',font:{size:10},boxWidth:10}}},scales:{x:{ticks:{color:'#8a96a8',font:{size:10}},grid:{color:'#e4e8ef'}},y:{ticks:{color:'#8a96a8',font:{size:10}},grid:{color:'#e4e8ef'}}}}});
      } else {
        chartInstances[id]=new Chart(ctx,{type:ds.type,
          data:{labels:d.labels,datasets:[{data:d.vals,backgroundColor:d.colors.slice(0,d.vals.length).map(c=>c+'cc'),borderColor:d.colors.slice(0,d.vals.length),borderWidth:1,borderRadius:isDonut?0:3,hoverOffset:isDonut?6:0}]},
          options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:isDonut,position:'right',labels:{color:'#8a96a8',font:{size:10},boxWidth:10}}},
            scales:isDonut?{}:{x:{ticks:{color:'#8a96a8',font:{size:10}},grid:{color:'#e4e8ef'}},y:{ticks:{color:'#8a96a8',font:{size:10}},grid:{color:'#e4e8ef'}}}}
        });
      }
    }

    window._finDashChange=function(sel){chartChoices[sel.dataset.chartId]=sel.value;renderChart(sel.dataset.chartId);};
    window._finDateChange=function(id,rk,field,val){finDateState[rk+'_'+field]=val;renderChart(id);};

    document.getElementById('content').innerHTML = `
      <!-- BUDGET SECTION -->
      <div class="budget-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:4px">Budget Anual ${anoAtual}</div>
            <div style="font-size:22px;font-weight:700;color:var(--navy)">R$ ${Number(budgetRec.valorBudget).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
          </div>
          <div class="budget-set-form">
            <input type="number" id="budget-input" value="${budgetRec.valorBudget||''}" placeholder="Definir budget anual..." min="0" step="1000" style="width:200px;padding:7px 10px;font-size:13px">
            <button class="btn" id="budget-save" style="padding:7px 14px">Salvar Budget</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:12px">
          <div style="text-align:center">
            <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text3)">Propostas Aprovadas</div>
            <div style="font-size:18px;font-weight:700;color:var(--navy)">R$ ${totalPropAprov.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
            <div style="font-size:11px;color:var(--text3)">Valor único + Pacotes: R$ ${totalPacotes.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text3)">Mensalidades (×12)</div>
            <div style="font-size:18px;font-weight:700;color:var(--accent2)">R$ ${totalMensAprov.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
            <div style="font-size:11px;color:var(--text3)">Recorrência anualizada</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text3)">Saldo Disponível</div>
            <div style="font-size:18px;font-weight:700;color:${budgetRestante<0?'var(--red)':budgetRestante<budgetRec.valorBudget*0.1?'var(--gold)':'var(--accent2)'}">
              R$ ${budgetRestante.toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </div>
            <div style="font-size:11px;color:var(--text3)">${pctUsado.toFixed(1)}% consumido</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Consumo do Budget (${pctUsado.toFixed(1)}%)</div>
        <div class="budget-bar-wrap"><div class="budget-bar-fill" style="width:${pctUsado}%;background:${barColor}"></div></div>
      </div>

      <!-- METRICS -->
      <div class="metrics" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
        <div class="metric accent"><div class="metric-label">Total Propostas</div><div class="metric-val">${propostas.length}</div><div class="metric-sub">${propostas.filter(p=>p.status==='pendente').length} pendente(s)</div></div>
        <div class="metric green"><div class="metric-label">Valor Aprovado</div><div class="metric-val">R$ ${totalPropAprov.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class="metric-sub">${propAnuais.length} proposta(s)</div></div>
        <div class="metric amber"><div class="metric-label">Mensalidade/mês</div><div class="metric-val">R$ ${(totalMensAprov/12).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><div class="metric-sub">Recorrente</div></div>
        <div class="metric purple"><div class="metric-label">Pacotes</div><div class="metric-val">${pacotes.length}</div><div class="metric-sub">${pacote_registros.length} labs</div></div>
      </div>

      <!-- DYNAMIC CHARTS -->
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

    CHART_IDS.forEach(id=>renderChart(id));

    // Budget save handler
    document.getElementById('budget-save').addEventListener('click', async () => {
      const val = parseFloat(document.getElementById('budget-input').value) || 0;
      await dbPut('budget', {ano: anoAtual, valorBudget: val});
      toast(`Budget ${anoAtual} definido: R$ ${val.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, 'success');
      pages.dashboard_financeiro(); // re-render to update bars
    });

    document.getElementById('dash-fin-report')?.addEventListener('click', async ()=>{
      const SL={pendente:'Pendente',aprovada:'Aprovada',paga:'Paga',cancelada:'Cancelada'};
      const pRows=propostas.map(p=>[p.fk_cliente,p.numeroChamado||'—',sysById[p.fk_sistema]?.nome||'—',p.analista||'—',`R$ ${Number(p.valorProposta||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`,`R$ ${Number(p.valorMensalidade||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`,SL[p.status]||p.status,p.dataLancamento||'—',p.dataAprovacao||'—',p.dataPagamento||'—']);
      generateReport('Dashboard Financeiro','Relatório Financeiro',[
        {heading:'Budget',headers:['Indicador','Valor'],rows:[['Budget Anual',`R$ ${Number(budgetRec.valorBudget).toLocaleString('pt-BR',{minimumFractionDigits:2})}`],['Consumido',`R$ ${totalConsumido.toLocaleString('pt-BR',{minimumFractionDigits:2})}`],['Disponível',`R$ ${budgetRestante.toLocaleString('pt-BR',{minimumFractionDigits:2})}`],[`% Usado`,`${pctUsado.toFixed(1)}%`]]},
        {heading:`Propostas (${pRows.length})`,headers:['Lab','Chamado','Sistema','Analista','Proposta','Mensalidade','Status','Lançamento','Aprovação','Pagamento'],rows:pRows}
      ]);
    });
  };



})(window);
