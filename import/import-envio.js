// ===================== STREAMING ENVIO IMPORT =====================
// Processes CSV text in 50k-line chunks, yielding to the UI thread between chunks.
// This prevents the browser from freezing on 1M+ row files.
async function processEnvioImportStreaming(text, sep, headers, onProgress) {
  const COL_ENVIO   = headers.indexOf('Envio');
  const COL_QTY     = ['Soma','Qnt Envio','QntEnvio'].map(c => headers.indexOf(c)).find(i => i >= 0) ?? -1;
  const COL_CODIGO  = ['Código','Codigo'].map(c => headers.indexOf(c)).find(i => i >= 0) ?? -1;
  const COL_NOME    = headers.indexOf('Nome do Cliente');
  const COL_DINI    = headers.indexOf('Data_Inicial');
  const COL_DFIN    = headers.indexOf('Data_Final');

  const agg = {};
  const CHUNK = 50000;

  // Split once — but work through lines lazily using index offsets
  // Find the first newline (end of header row)
  let lineStart = text.indexOf('\n') + 1;
  const totalLen = text.length;
  let linesProcessed = 0;
  let chunkLines = 0;

  const tick = () => new Promise(resolve => setTimeout(resolve, 0));

  while (lineStart < totalLen) {
    // Process one chunk
    let chunkEnd = lineStart;
    for (let i = 0; i < CHUNK && chunkEnd < totalLen; i++) {
      const nl = text.indexOf('\n', chunkEnd);
      chunkEnd = nl >= 0 ? nl + 1 : totalLen;
    }
    const chunk = text.slice(lineStart, chunkEnd);
    const lines = chunk.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const vals = trimmed.split(sep);
      const codigo    = COL_CODIGO >= 0 ? String(vals[COL_CODIGO]||'').trim() : '';
      const tipoEnvio = COL_ENVIO  >= 0 ? String(vals[COL_ENVIO] ||'').trim().toUpperCase() : '';
      const qnt       = COL_QTY    >= 0 ? parseFloat(String(vals[COL_QTY]||'0').replace(',','.')) || 0 : 0;
      const dtIni     = COL_DINI   >= 0 ? String(vals[COL_DINI]||'').trim().split(' ')[0] : '';
      const dtFin     = COL_DFIN   >= 0 ? String(vals[COL_DFIN]||'').trim().split(' ')[0] : '';
      const nome      = COL_NOME   >= 0 ? String(vals[COL_NOME]||'').trim() : '';

      if (!codigo || !tipoEnvio) continue;

      const key = `${dtIni}~${dtFin}|${codigo}|${tipoEnvio}`;
      if (!agg[key]) agg[key] = { fk_cliente: codigo, tipoEnvio, qntEnvio: 0, dataInicial: dtIni, dataFinal: dtFin, nomeCliente: nome, periodo: `${dtIni}~${dtFin}` };
      agg[key].qntEnvio += qnt;
      linesProcessed++;
    }

    lineStart = chunkEnd;
    chunkLines++;

    // Yield to UI thread + update progress
    const pct = Math.min(15 + Math.round((lineStart / totalLen) * 70), 85);
    if (onProgress) onProgress(pct, `Processando... ${linesProcessed.toLocaleString('pt-BR')} linhas`);
    await tick();
  }

  if (onProgress) onProgress(88, 'Salvando no banco de dados...');
  await tick();

  const records = Object.values(agg);
  const periodo = records[0]?.periodo || '';

  // Clear existing records for same period
  const existing = await dbAll('envios');
  const toDelete = existing.filter(e => e.periodo === periodo);
  for (const e of toDelete) await dbDelete('envios', e.id);

  // Insert in batches of 500 to keep DB transaction size manageable
  const BATCH = 500;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    await Promise.all(batch.map(rec => dbAdd('envios', rec)));
    const pct = 88 + Math.round(((i + BATCH) / records.length) * 11);
    if (onProgress) onProgress(Math.min(pct, 99), `Salvando registros ${Math.min(i+BATCH, records.length).toLocaleString('pt-BR')} / ${records.length.toLocaleString('pt-BR')}...`);
    await tick();
  }

  const clientesUnicos = new Set(records.map(r => r.fk_cliente)).size;
  return { total: records.length, clientes: clientesUnicos, periodo };
}

// ===================== IMPORT ENGINE — BASE DE ENVIO =====================
async function processEnvioImport(rows) {
  // Aggregate: per (periodo, Código, tipoEnvio) sum QntEnvio
  // periodo = "DataInicial~DataFinal" normalized
  const agg = {};

  for (const row of rows) {
    const codigo     = String(row['Código'] || row['Codigo'] || '').trim();
    const tipoEnvio  = String(row['Envio'] || '').trim().toUpperCase();
    const qnt        = parseFloat(String(row['Qnt Envio'] || row['QntEnvio'] || row['Soma'] || '0').replace(',','.')) || 0;
    const dtIni      = String(row['Data_Inicial'] || '').trim().split(' ')[0];  // drop time
    const dtFin      = String(row['Data_Final']   || '').trim().split(' ')[0];
    const nomeCliente= String(row['Nome do Cliente'] || '').trim();
    if (!codigo || !tipoEnvio) continue;

    const key = `${dtIni}~${dtFin}|${codigo}|${tipoEnvio}`;
    if (!agg[key]) agg[key] = { fk_cliente: codigo, tipoEnvio, qntEnvio: 0, dataInicial: dtIni, dataFinal: dtFin, nomeCliente, periodo: `${dtIni}~${dtFin}` };
    agg[key].qntEnvio += qnt;
  }

  const records = Object.values(agg);
  const periodo = records[0]?.periodo || '';

  // Clear existing records for the same period to avoid duplicates
  const existing = await dbAll('envios');
  const toDelete = existing.filter(e => e.periodo === periodo);
  for (const e of toDelete) await dbDelete('envios', e.id);

  // Insert aggregated records
  for (const rec of records) await dbAdd('envios', rec);

  const clientesUnicos = new Set(records.map(r => r.fk_cliente)).size;
  return { total: records.length, clientes: clientesUnicos, periodo };
}

// Mapping rules: tipo de envio → categoria de integração esperada
const ENVIO_SEM_INT   = new Set(['DB FACIL', 'E-DB MANUAL', 'TOXICOLOGICO']);
const ENVIO_CONV      = new Set(['INTEGRACAO', 'E-DB INTEGRACAO']);
const ENVIO_WS        = new Set(['ETIQUETA PRIMARIA']);

function getTipoIntExpected(chamados) {
  // Determine integration status from chamados array
  const ativos = chamados.filter(ch => ch.integracaoAtiva);
  if (!ativos.length) return 'SEM_INT';
  const tipos = new Set(ativos.map(ch => (ch.tipoIntegracao||'').toUpperCase()));
  if (tipos.has('WEBSERVICE')) return 'WEBSERVICE';
  if (tipos.has('CONVENCIONAL (XML)')) return 'CONVENCIONAL';
  return 'SEM_INT';
}

// Expose to global scope
window.processEnvioImportStreaming = processEnvioImportStreaming;
window.processEnvioImport = processEnvioImport;
window.ENVIO_SEM_INT = ENVIO_SEM_INT;
window.ENVIO_CONV = ENVIO_CONV;
window.ENVIO_WS = ENVIO_WS;
window.getTipoIntExpected = getTipoIntExpected;