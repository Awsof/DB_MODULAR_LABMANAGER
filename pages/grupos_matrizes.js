// pages/grupos_matrizes.js — Página Grupos Matrizes da Fase 4
(function (global) {
  "use strict";

  var pages = global.pages || {};
  global.pages = pages;

  // ===================== PAGE: GRUPOS E MATRIZES =====================
  pages.grupos_matrizes = async function() {
    updateTopbar('Grupos e Matrizes', 'Consulta por grupo, matriz e filiais vinculadas', '');

    const [clientes, reps, sistemas] = await Promise.all([dbAll('clientes'), dbAll('representantes'), dbAll('sistemas')]);
    const repById = {}; for(const r of reps) repById[r.id] = r;
    const sysById = {}; for(const s of sistemas) sysById[s.id] = s;

    let gmSearch = '', gmGrupo = '', gmTab = 'grupos'; // 'grupos' or 'matrizes'

    // Build grupos: aggregate all labs with same Grupo
    const gruposMap = {};
    for (const c of clientes) {
      const g = c.Grupo || '(Sem Grupo)';
      if (!gruposMap[g]) gruposMap[g] = [];
      gruposMap[g].push(c);
    }

    // Build matrizes: only labs without CodMatriz; attach their filiais
    const matrizMap = {};
    const matrizClientes = clientes.filter(c => !c.CodMatriz);
    for (const m of matrizClientes) matrizMap[m.Codigo] = { matriz: m, filiais: [] };
    for (const f of clientes.filter(c => c.CodMatriz)) {
      if (matrizMap[f.CodMatriz]) matrizMap[f.CodMatriz].filiais.push(f);
    }

    const allGrupos  = Object.keys(gruposMap).sort();
    const allMatrizes = matrizClientes.map(m=>m.Codigo);

    function renderGrupos() {
      let filtered = allGrupos.filter(g => {
        if (gmGrupo && g !== gmGrupo) return false;
        if (gmSearch) {
          const labs = gruposMap[g];
          return g.toLowerCase().includes(gmSearch.toLowerCase()) ||
            labs.some(c => (c.NomeFantasia||c.RazaoSocial||'').toLowerCase().includes(gmSearch.toLowerCase()) || String(c.Codigo).includes(gmSearch));
        }
        return true;
      });
      const tbody = document.getElementById('gm-body');
      if (!tbody) return;
      if (!filtered.length) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3)">Nenhum grupo encontrado.</td></tr>`; return; }
      tbody.innerHTML = filtered.map(g => {
        const labs = gruposMap[g];
        const ufs  = [...new Set(labs.map(c=>c.UF).filter(Boolean))].sort().join(', ');
        const repIds = [...new Set(labs.map(c=>c.fk_representante).filter(Boolean))];
        const repNomes = repIds.slice(0,3).map(id=>repById[id]?.nome?.split(' ')[0]||id).join(', ') + (repIds.length>3?` +${repIds.length-3}`:'');
        const sysIds = [...new Set(labs.map(c=>c.fk_sistema).filter(Boolean))];
        const sysNomes = sysIds.slice(0,3).map(id=>sysById[id]?.nome||id).join(', ') + (sysIds.length>3?` +${sysIds.length-3}`:'');
        return `<tr>
          <td><strong style="color:var(--navy)">${g}</strong></td>
          <td style="text-align:center"><span class="badge rep">${labs.length}</span></td>
          <td style="font-size:11px;color:var(--text2)">${ufs||'—'}</td>
          <td style="font-size:11px;color:var(--text2)">${repNomes||'—'}</td>
          <td style="font-size:11px">${sysNomes ? `<span class="badge sys" style="font-size:10px">${sysNomes}</span>` : '—'}</td>
          <td><button class="btn sm secondary" style="font-size:11px;padding:3px 8px" onclick="toggleGrupoDetail('${encodeURIComponent(g)}')">Ver labs</button></td>
        </tr>
        <tr id="gd-${encodeURIComponent(g)}" style="display:none;background:var(--bg3)">
          <td colspan="6" style="padding:8px 16px">
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Laboratórios do grupo:</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${labs.map(c=>`<span style="background:var(--bg4);border:1px solid var(--border);border-radius:4px;padding:2px 7px;font-size:11px;color:var(--navy);font-family:var(--mono)">${c.Codigo} — ${c.NomeFantasia||c.RazaoSocial}</span>`).join('')}
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    function renderMatrizes() {
      const entries = Object.values(matrizMap).filter(({matriz, filiais}) => {
        if (!gmSearch) return true;
        return String(matriz.Codigo).includes(gmSearch) ||
          (matriz.NomeFantasia||matriz.RazaoSocial||'').toLowerCase().includes(gmSearch.toLowerCase()) ||
          filiais.some(f=>(f.NomeFantasia||f.RazaoSocial||'').toLowerCase().includes(gmSearch.toLowerCase()));
      }).sort((a,b)=>Number(a.matriz.Codigo)-Number(b.matriz.Codigo));

      const tbody = document.getElementById('gm-body');
      if (!tbody) return;
      if (!entries.length) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text3)">Nenhuma matriz encontrada.</td></tr>`; return; }
      tbody.innerHTML = entries.map(({matriz:m, filiais}) => {
        const rep = repById[m.fk_representante];
        const sys = sysById[m.fk_sistema];
        return `<tr>
          <td><strong style="font-family:var(--mono);color:var(--text3)">${m.Codigo}</strong></td>
          <td><strong style="color:var(--navy)">${m.NomeFantasia||m.RazaoSocial||'—'}</strong><div style="font-size:10px;color:var(--text3)">${m.CNPJ||''}</div></td>
          <td><span class="badge uf">${m.UF||'?'}</span></td>
          <td style="font-size:12px">${rep?.nome||'—'}</td>
          <td>${sys?`<span class="badge sys" style="font-size:10px">${sys.nome}</span>`:'—'}</td>
          <td style="text-align:center"><span class="badge rep">${filiais.length}</span></td>
          <td><button class="btn sm secondary" style="font-size:11px;padding:3px 8px" onclick="toggleMatrizDetail('${m.Codigo}')">Ver filiais</button></td>
        </tr>
        ${filiais.length ? `<tr id="md-${m.Codigo}" style="display:none;background:var(--bg3)">
          <td colspan="7" style="padding:8px 16px">
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Filiais:</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${filiais.map(f=>`<span style="background:var(--bg4);border:1px solid var(--border);border-radius:4px;padding:2px 7px;font-size:11px;color:var(--text2);font-family:var(--mono)">${f.Codigo} — ${f.NomeFantasia||f.RazaoSocial}</span>`).join('')}
            </div>
          </td>
        </tr>` : ''}`;
      }).join('');
    }

    function renderTable() {
      const headersGrupo = ['Grupo','Labs','UFs','Representantes','Sistemas',''];
      const headersMatriz = ['Código','Nome / CNPJ','UF','Representante','Sistema','Filiais',''];
      const headers = gmTab === 'grupos' ? headersGrupo : headersMatriz;
      document.getElementById('gm-thead').innerHTML = `<tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>`;
      if (gmTab === 'grupos') renderGrupos(); else renderMatrizes();
    }

    document.getElementById('content').innerHTML = `
      <div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-bottom:14px">
        <div class="search-wrap" style="flex:2;min-width:200px">
          <span class="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></span>
          <input type="text" placeholder="Buscar por nome ou código..." id="gm-search">
        </div>
        ${gmTab==='grupos'?`<select id="gm-grupo-filter"><option value="">Todos os grupos</option>${allGrupos.map(g=>`<option value="${g}">${g}</option>`).join('')}</select>`:''}
        <div style="display:flex;gap:6px">
          <button class="btn ${gmTab==='grupos'?'':'secondary'}" id="tab-grupos">Grupos (${allGrupos.length})</button>
          <button class="btn ${gmTab==='matrizes'?'':'secondary'}" id="tab-matrizes">Matrizes (${matrizClientes.length})</button>
        </div>
      </div>
      <div class="table-wrap">
        <table style="width:100%">
          <thead id="gm-thead"></thead>
          <tbody id="gm-body"></tbody>
        </table>
      </div>
    `;

    renderTable();

    document.getElementById('gm-search').addEventListener('input', e => { gmSearch=e.target.value; renderTable(); });
    document.getElementById('tab-grupos').addEventListener('click', () => { gmTab='grupos'; pages.grupos_matrizes(); });
    document.getElementById('tab-matrizes').addEventListener('click', () => { gmTab='matrizes'; pages.grupos_matrizes(); });
    document.getElementById('gm-grupo-filter')?.addEventListener('change', e => { gmGrupo=e.target.value; renderTable(); });

    window.toggleGrupoDetail = (g) => {
      const row = document.getElementById(`gd-${g}`);
      if (row) row.style.display = row.style.display==='none'?'table-row':'none';
    };
    window.toggleMatrizDetail = (cod) => {
      const row = document.getElementById(`md-${cod}`);
      if (row) row.style.display = row.style.display==='none'?'table-row':'none';
    };
  };


})(window);
