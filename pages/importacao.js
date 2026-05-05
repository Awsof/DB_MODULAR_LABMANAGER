// pages/importacao.js — extraído da fase 4
(function (global) {
  'use strict';
  var pages = global.pages || {};
  global.pages = pages;

// ===================== PAGE: IMPORTAÇÃO =====================
  pages.importacao = async function() {
    updateTopbar('Importação & Relatórios', 'Sincronização semanal da planilha', `<button class="btn danger" id="clear-data-btn">🗑 Limpar Todos os Dados</button>`);

    document.getElementById('clear-data-btn').addEventListener('click', async () => {
      if (!confirm('⚠️ ATENÇÃO: Isso irá apagar TODOS os dados importados (clientes, representantes, sistemas, chamados e logs). Esta ação é irreversível.\n\nDeseja continuar?')) return;
      if (!confirm('Confirme novamente: todos os dados serão permanentemente removidos. Tem certeza?')) return;
      await Promise.all([
        dbClear('clientes'),
        dbClear('representantes'),
        dbClear('sistemas'),
        dbClear('chamados'),
        dbClear('envios'),
        dbClear('logs'),
        // Note: budget is NOT cleared on data reset — it's a configuration, not imported data
      ]);
      await auditLog('Limpeza geral', 'Todos os dados foram removidos do sistema');
      toast('Todos os dados foram removidos com sucesso.', 'info', 6000);
      pages.importacao();
    });

    const logs = (await dbAll('logs')).reverse();

    document.getElementById('content').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div>
          <div class="chart-card" style="margin-bottom:0">
            <div class="chart-title">Nova Importação</div>
            <div style="display:flex;gap:8px;margin-bottom:12px">
              <span class="import-tab active" id="tab-g5" onclick="switchImportTab('g5')">Base G5 (Clientes)</span>
              <span class="import-tab" id="tab-envio" onclick="switchImportTab('envio')">Base de Envio</span>
              <span class="import-tab" id="tab-esmeralda" onclick="switchImportTab('esmeralda')">Lista Esmeralda</span>
            </div>
            <div id="drop-area" class="drop-zone" style="margin-top:0">
              <div class="drop-zone-icon" id="drop-icon">📂</div>
              <div class="drop-zone-title" id="drop-title">Arraste a planilha aqui</div>
              <div class="drop-zone-sub" id="drop-sub">Formatos: .xls, .xlsx, .csv</div>
              <div style="margin-top:16px">
                <button class="btn secondary" onclick="document.getElementById('file-input').click()">Selecionar arquivo</button>
                <input type="file" id="file-input" accept=".xls,.xlsx,.csv" class="hidden">
              </div>
            </div>
            <div id="import-progress" class="hidden" style="margin-top:16px">
              <div id="import-status" style="font-size:13px;color:var(--text2);margin-bottom:6px">Processando...</div>
              <div class="progress-bar"><div class="progress-fill" id="prog-fill" style="width:0%"></div></div>
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="chart-card" style="flex:1">
            <div class="chart-title">Regras de Importação</div>
            <div style="font-size:12px;color:var(--text2);line-height:1.9">
              <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--navy);margin-bottom:6px;text-transform:uppercase">📋 Base G5 — Frequência: Semanal</div>
              ✓ <strong style="color:var(--text)">Código</strong> é a chave primária (imutável)<br>
              ✓ CNPJ exibido apenas quando presente na unidade<br>
              ✓ Representantes "A DEFINIR" ou nulos são ignorados<br>
              ✓ Matrizes processadas antes das filiais<br>
              ✓ Campos editados manualmente nunca são sobrescritos<br>
              ✓ Campos da planilha sempre atualizam os dados do banco
            </div>
            <div style="height:1px;background:var(--border);margin:10px 0"></div>
            <div style="font-size:12px;color:var(--text2);line-height:1.9">
              <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gold);margin-bottom:6px;text-transform:uppercase">💎 Lista Esmeralda — Frequência: Mensal</div>
              ✓ <strong style="color:var(--text)">Código</strong> cruza com o cadastro G5 existente<br>
              ✓ <strong style="color:var(--text)">CATEGORIA</strong>: Kagem ou Belmont → Esmeralda · Chivor → Chivor<br>
              ✓ Cria <strong style="color:var(--text)">Assessores</strong> automaticamente se não existirem<br>
              ✓ Nunca sobrescreve dados da Base G5 (Razão Social, UF, Representante)<br>
              ✓ Clientes sem cadastro G5 são contabilizados mas não criados
            </div>
              ✓ Agrupada por <strong style="color:var(--text)">Código + Tipo de Envio</strong> por período<br>
              ✓ Nova importação <strong style="color:var(--red)">apaga e substitui</strong> o período anterior inteiro<br>
              ✓ Detectada automaticamente pelas colunas (separador <strong style="color:var(--text)">ponto-e-vírgula</strong>)<br>
              ✓ Quantidade somada por código e tipo no mesmo período
            </div>
          </div>
        </div>
      </div>

      <!-- MODELO DAS BASES -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:20px">
        <div class="chart-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div class="chart-title" style="margin:0">📋 Modelo — Base G5 (Clientes)</div>
            <button class="btn secondary" style="font-size:11px;padding:4px 10px" onclick="downloadModeloCSV()">⬇ Baixar .csv</button>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Separador: vírgula · Atualização: semanal</div>
          <div style="overflow-x:auto">
            <table style="width:100%;font-size:11px;border-collapse:collapse">
              <thead><tr>
                <th style="padding:5px 8px;background:var(--navy);color:rgba(255,255,255,.8);text-align:left;white-space:nowrap">Coluna</th>
                <th style="padding:5px 8px;background:var(--navy);color:rgba(255,255,255,.8);text-align:left">Descrição</th>
                <th style="padding:5px 8px;background:var(--navy);color:rgba(255,255,255,.8);text-align:center;white-space:nowrap">Obrig.</th>
              </tr></thead>
              <tbody>
                ${[
                  ['Código','Identificador único do laboratório (chave primária)','✓'],
                  ['Razão Social','Razão social completa da empresa','✓'],
                  ['Nome Fantasia','Nome comercial / fantasia','✓'],
                  ['CNPJ','CNPJ da unidade (apenas para matrizes)',''],
                  ['UF','Sigla do estado (ex: SP, BA, RJ)','✓'],
                  ['Representante','Nome completo do representante comercial','✓'],
                  ['Nome Supervisor','Supervisor do representante (aceita formato "REGIÃO - NOME")',''],
                  ['Cód. Matriz','Código da matriz (preencher apenas para filiais)',''],
                  ['Matriz','Nome da unidade matriz',''],
                  ['Grupo','Grupo ou rede laboratorial',''],
                ].map(([col,desc,req])=>`<tr>
                  <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--accent2);font-family:var(--mono);white-space:nowrap">${col}</td>
                  <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text2)">${desc}</td>
                  <td style="padding:4px 8px;border-bottom:1px solid var(--border);text-align:center;color:var(--accent2);font-weight:700">${req}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="chart-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div class="chart-title" style="margin:0">📊 Modelo — Base de Envio</div>
            <button class="btn secondary" style="font-size:11px;padding:4px 10px" onclick="downloadModeloEnvioCSV()">⬇ Baixar .csv</button>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Separador: ponto-e-vírgula · Atualização: 15 dias ou mensal</div>
          <div style="overflow-x:auto">
            <table style="width:100%;font-size:11px;border-collapse:collapse">
              <thead><tr>
                <th style="padding:5px 8px;background:var(--accent2);color:white;text-align:left;white-space:nowrap">Coluna</th>
                <th style="padding:5px 8px;background:var(--accent2);color:white;text-align:left">Descrição</th>
                <th style="padding:5px 8px;background:var(--accent2);color:white;text-align:center;white-space:nowrap">Obrig.</th>
              </tr></thead>
              <tbody>
                ${[
                  ['Data_Inicial','Data inicial do período (dd/mm/aaaa hh:mm:ss)','✓'],
                  ['Data_Final','Data final do período (dd/mm/aaaa hh:mm:ss)','✓'],
                  ['Envio','Tipo de envio: DB FACIL · E-DB MANUAL · TOXICOLOGICO · INTEGRACAO · E-DB INTEGRACAO · ETIQUETA PRIMARIA','✓'],
                  ['Qnt Envio','Quantidade de exames enviados naquele tipo','✓'],
                  ['Código','Código do laboratório (igual ao da Base G5)','✓'],
                  ['Nome do Cliente','Nome do laboratório (apenas referência — chave é o Código)',''],
                ].map(([col,desc,req])=>`<tr>
                  <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--navy);font-family:var(--mono);white-space:nowrap">${col}</td>
                  <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text2)">${desc}</td>
                  <td style="padding:4px 8px;border-bottom:1px solid var(--border);text-align:center;color:var(--accent2);font-weight:700">${req}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:10px;padding:8px;background:rgba(214,48,49,.06);border:1px solid rgba(214,48,49,.2);border-radius:var(--r);font-size:11px;color:var(--red)">
            ⚠ Ao importar uma nova Base de Envio, os dados do período anterior são <strong>completamente substituídos</strong>. Certifique-se de que a base está completa antes de importar.
          </div>
        </div>

        <!-- Modelo Lista Esmeralda -->
        <div class="chart-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div class="chart-title" style="margin:0">💎 Modelo — Lista Esmeralda</div>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Formato: .xlsx · Aba principal com colunas abaixo</div>
          <div style="overflow-x:auto">
            <table style="width:100%;font-size:11px;border-collapse:collapse">
              <thead><tr>
                <th style="padding:5px 8px;background:var(--gold);color:white;text-align:left;white-space:nowrap">Coluna</th>
                <th style="padding:5px 8px;background:var(--gold);color:white;text-align:left">Descrição</th>
                <th style="padding:5px 8px;background:var(--gold);color:white;text-align:center;white-space:nowrap">Obrig.</th>
              </tr></thead>
              <tbody>
                ${[
                  ['Código',    'Código do laboratório — chave de cruzamento com G5', '✓'],
                  ['CATEGORIA', 'KAGEM ou BELMONT → Esmeralda · CHIVOR → Chivor',    '✓'],
                  ['Assessor',  'Nome completo do assessor responsável',              '✓'],
                  ['CódigoMatriz', 'Código da matriz (referência — não importado)',   ''],
                  ['PostodeColeta','Posto de coleta vinculado (referência)',           ''],
                ].map(([col,desc,req])=>`<tr>
                  <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--gold);font-family:var(--mono);white-space:nowrap">${col}</td>
                  <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text2)">${desc}</td>
                  <td style="padding:4px 8px;border-bottom:1px solid var(--border);text-align:center;color:var(--gold);font-weight:700">${req}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:10px;padding:8px;background:rgba(196,155,60,.06);border:1px solid rgba(196,155,60,.25);border-radius:var(--r);font-size:11px;color:var(--gold)">
            ✓ Clientes sem cadastro na Base G5 são contabilizados mas <strong>não criados</strong>. Importe o G5 primeiro.
          </div>
        </div>
      </div>

      <div class="chart-title" style="margin-bottom:12px">Histórico de Importações (${logs.length})</div>
      ${logs.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Nenhuma importação realizada</div></div>` : ''}
      <div id="logs-list">
        ${logs.map(l => `
          <div class="report-card">
            <div class="report-header">
              <div class="report-title">Importação ${new Date(l.data).toLocaleString('pt-BR')}</div>
              <div style="display:flex;gap:8px">
                <span class="badge new">+${l.novos.length} novos</span>
                <span class="badge alt">~${l.alterados.length} alterados</span>
                ${l.erros.length ? `<span class="badge" style="background:rgba(232,88,88,.15);color:var(--red)">${l.erros.length} erros</span>` : ''}
              </div>
            </div>
            ${l.novos.length > 0 ? `
              <div style="margin-bottom:10px">
                <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-bottom:6px">Clientes Novos (${l.novos.length})</div>
                <div style="max-height:160px;overflow-y:auto">
                  <table style="width:100%;font-size:12px">
                    <thead><tr><th style="text-align:left;color:var(--text3);padding:4px 8px;font-weight:600">Código</th><th style="text-align:left;color:var(--text3);padding:4px 8px;font-weight:600">Nome</th><th style="text-align:left;color:var(--text3);padding:4px 8px;font-weight:600">UF</th><th style="text-align:left;color:var(--text3);padding:4px 8px;font-weight:600">Representante</th></tr></thead>
                    <tbody>${l.novos.map(n=>`<tr><td style="padding:3px 8px;color:var(--text3);font-family:var(--mono)">${n.codigo}</td><td style="padding:3px 8px;color:var(--text)">${n.nome||'—'}</td><td style="padding:3px 8px"><span class="badge uf">${n.uf||'?'}</span></td><td style="padding:3px 8px;color:var(--text2)">${n.representante||'—'}</td></tr>`).join('')}</tbody>
                  </table>
                </div>
              </div>
            ` : ''}
            ${l.alterados.length > 0 ? `
              <div>
                <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-bottom:6px">Clientes Alterados (${l.alterados.length})</div>
                <div style="max-height:120px;overflow-y:auto">
                  <table style="width:100%;font-size:12px">
                    <tbody>${l.alterados.map(n=>`<tr><td style="padding:3px 8px;color:var(--text3);font-family:var(--mono)">${n.codigo}</td><td style="padding:3px 8px;color:var(--text)">${n.nome||'—'}</td><td style="padding:3px 8px"><span class="badge uf">${n.uf||'?'}</span></td></tr>`).join('')}</tbody>
                  </table>
                </div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;

    // Drag & drop
    const dropArea = document.getElementById('drop-area');
    dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('drag-over'); });
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
    dropArea.addEventListener('drop', e => { e.preventDefault(); dropArea.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); });
    document.getElementById('file-input').addEventListener('change', e => handleFile(e.target.files[0]));

    let currentImportTab = 'g5';

    function switchImportTab(tab) {
      currentImportTab = tab;
      document.getElementById('tab-g5').classList.toggle('active', tab === 'g5');
      document.getElementById('tab-envio').classList.toggle('active', tab === 'envio');
      document.getElementById('tab-esmeralda').classList.toggle('active', tab === 'esmeralda');
      const titles = {
        g5:        'Arraste a planilha aqui',
        envio:     'Arraste a Base de Envio aqui',
        esmeralda: 'Arraste a Lista Esmeralda aqui',
      };
      const subs = {
        g5:        'Formatos: .xls, .xlsx, .csv — Base G5',
        envio:     'Formatos: .csv — Colunas: Data_Inicial; Data_Final; Envio; Qnt Envio; Código; Nome do Cliente',
        esmeralda: 'Formatos: .xls, .xlsx — Colunas: Código · CATEGORIA · Assessor',
      };
      const icons = { g5:'📂', envio:'📊', esmeralda:'💎' };
      document.getElementById('drop-title').textContent = titles[tab];
      document.getElementById('drop-sub').textContent   = subs[tab];
      document.getElementById('drop-icon').textContent  = icons[tab];
    }

    async function handleFile(file) {
      if (!file) return;
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['xls','xlsx','csv'].includes(ext)) { toast('Formato inválido. Use .xls, .xlsx ou .csv', 'error'); return; }

      document.getElementById('import-progress').classList.remove('hidden');
      document.getElementById('import-status').textContent = 'Lendo arquivo...';
      document.getElementById('prog-fill').style.width = '10%';

      try {
        const buf = await file.arrayBuffer();

        // ---- STREAMING CSV PARSER — chunks to avoid UI freeze on 1M+ row files ----
        if (ext === 'csv') {
          const text = new TextDecoder('utf-8').decode(buf);
          const nlIdx = text.indexOf('\n');
          const firstLine = nlIdx >= 0 ? text.slice(0, nlIdx) : text;
          const sep = firstLine.includes(';') ? ';' : ',';
          const headers = firstLine.split(sep).map(h => h.trim().replace(/^"|"$/g,''));

          const isEnvioBase = headers.includes('Envio') &&
            (headers.includes('Soma') || headers.includes('Qnt Envio') || headers.includes('QntEnvio'));

          document.getElementById('import-status').textContent = isEnvioBase
            ? 'Detectada Base de Envio — agregando...'
            : 'Detectada Base G5 — processando...';
          document.getElementById('prog-fill').style.width = '15%';

          if (currentImportTab === 'envio' || isEnvioBase) {
            // STREAMING aggregate — never allocate full row array
            const result = await processEnvioImportStreaming(text, sep, headers,
              (pct, msg) => {
                document.getElementById('prog-fill').style.width = pct + '%';
                document.getElementById('import-status').textContent = msg;
              });
            document.getElementById('prog-fill').style.width = '100%';
            document.getElementById('import-status').textContent =
              `Concluído! ${result.total} registros · ${result.clientes} clientes · período ${result.periodo}`;
            await auditLog('import', `Base de Envio: ${result.total} registros, ${result.clientes} clientes`);
            toast(`Base de envio importada: ${result.total} registros de ${result.clientes} clientes.`, 'success', 6000);
            setTimeout(() => pages.importacao(), 1500);
          } else {
            // G5 CSV — typically small, parse normally
            const lines = text.split('\n');
            const rows = [];
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i].trim(); if (!line) continue;
              const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g,''));
              const obj = {}; headers.forEach((h, j) => { obj[h] = vals[j] ?? ''; }); rows.push(obj);
            }
            document.getElementById('import-status').textContent = `${rows.length} linhas encontradas. Processando...`;
            document.getElementById('prog-fill').style.width = '50%';
            const normalized = rows.map(r => {
              const n = {};
              for (const [k, v] of Object.entries(r)) n[k.trim()] = String(v).trim() === '' ? null : String(v).trim();
              return n;
            });
            const log = await processImport(normalized);
            document.getElementById('prog-fill').style.width = '100%';
            document.getElementById('import-status').textContent = `Concluído! ${log.novos.length} novos · ${log.alterados.length} alterados`;
            await auditLog('import', `Base G5 (CSV): ${log.novos.length} novos, ${log.alterados.length} alterados`);
            toast(`Importação concluída: ${log.novos.length} novos, ${log.alterados.length} atualizados.`, 'success', 6000);
            setTimeout(() => pages.importacao(), 1500);
          }
        } else {
          // XLS/XLSX
          const wb = XLSX.read(buf, { type: 'array' });

          // ── Detecção automática da Lista Esmeralda ──
          // A planilha tem header na linha 0 como dados (Unnamed) ou pode ter nome de aba específico.
          // Usa a primeira aba que contém as colunas canônicas após normalização.
          let esmeraldaRows = null;
          for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            const raw = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
            if (!raw.length) continue;
            // Encontrar linha de cabeçalho real (pode estar na linha 0 ou 1)
            let headerRowIdx = -1;
            for (let i = 0; i < Math.min(raw.length, 4); i++) {
              const row = raw[i].map(c => String(c||'').trim());
              if (row.some(c => c === 'Código' || c === 'CATEGORIA' || c === 'Assessor')) {
                headerRowIdx = i; break;
              }
            }
            if (headerRowIdx === -1) continue;
            const headers = raw[headerRowIdx].map(c => String(c||'').trim());
            const hasCodigo    = headers.includes('Código');
            const hasCategoria = headers.includes('CATEGORIA');
            const hasAssessor  = headers.includes('Assessor');
            if (hasCodigo && hasCategoria && hasAssessor) {
              esmeraldaRows = raw.slice(headerRowIdx + 1)
                .map(r => {
                  const obj = {};
                  headers.forEach((h, j) => { obj[h] = String(r[j]||'').trim() || null; });
                  return obj;
                })
                .filter(r => r['Código'] && r['Código'] !== 'Código');
              break;
            }
          }

          if (currentImportTab === 'esmeralda' || esmeraldaRows) {
            if (!esmeraldaRows || !esmeraldaRows.length) {
              throw new Error('Nenhuma linha válida encontrada. Certifique-se de que a planilha tem as colunas: Código, CATEGORIA, Assessor.');
            }
            document.getElementById('import-status').textContent = `${esmeraldaRows.length} linhas encontradas — processando Esmeralda...`;
            document.getElementById('prog-fill').style.width = '40%';
            const result = await processEsmeraldaImport(esmeraldaRows,
              (pct, msg) => {
                document.getElementById('prog-fill').style.width = pct + '%';
                document.getElementById('import-status').textContent = msg;
              });
            document.getElementById('prog-fill').style.width = '100%';
            document.getElementById('import-status').textContent =
              `Concluído! ${result.atualizados} clientes atualizados · ${result.semCadastro} sem cadastro G5`;
            await auditLog('import', `Lista Esmeralda: ${result.atualizados} atualizados, ${result.assessoresNovos} assessores criados`);
            toast(`Esmeralda importada: ${result.atualizados} clientes atualizados, ${result.assessoresNovos} assessores criados.`, 'success', 6000);
          } else {
            // Fluxo G5 XLSX original
            const ws = wb.Sheets[wb.SheetNames[0]];
            let rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
            rows = rows.map(r => {
              const n = {};
              for (const [k,v] of Object.entries(r)) n[k.trim()] = String(v).trim() === '' ? null : String(v).trim();
              return n;
            });
            document.getElementById('import-status').textContent = `${rows.length} linhas encontradas. Processando...`;
            document.getElementById('prog-fill').style.width = '40%';
            const firstRow = rows[0] || {};
            const isEnvioBase = 'Envio' in firstRow && ('Qnt Envio' in firstRow || 'Soma' in firstRow);
            if (currentImportTab === 'envio' || isEnvioBase) {
              const result = await processEnvioImport(rows);
              document.getElementById('prog-fill').style.width = '100%';
              document.getElementById('import-status').textContent = `Concluído! ${result.total} registros · ${result.clientes} clientes`;
              await auditLog('import', `Base de Envio (XLSX): ${result.total} registros`);
              toast(`Base de envio importada: ${result.total} registros de ${result.clientes} clientes.`, 'success', 6000);
            } else {
              const log = await processImport(rows);
              document.getElementById('prog-fill').style.width = '100%';
              document.getElementById('import-status').textContent = `Concluído! ${log.novos.length} novos · ${log.alterados.length} alterados`;
              await auditLog('import', `Base G5 (XLSX): ${log.novos.length} novos, ${log.alterados.length} alterados`);
              toast(`Importação concluída: ${log.novos.length} novos, ${log.alterados.length} atualizados.`, 'success', 6000);
            }
          }
          setTimeout(() => pages.importacao(), 1500);
        }
      } catch (err) {
        console.error(err);
        toast('Erro ao processar o arquivo: ' + err.message, 'error');
        document.getElementById('import-status').textContent = 'Erro: ' + err.message;
      }
    }
  };

})(window);
