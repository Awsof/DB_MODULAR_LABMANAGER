// ===================== ESMERALDA IMPORT ENGINE =====================
// Mapeia CATEGORIA → categoria_especial canônica
function mapCategoriaEsmeralda(raw) {
  const v = (raw || '').trim().toUpperCase();
  if (v === 'KAGEM' || v === 'BELMONT') return 'Esmeralda';
  if (v === 'CHIVOR') return 'Chivor';
  return null; // ignora linhas sem categoria válida
}

async function processEsmeraldaImport(rows, onProgress) {
  const result = { atualizados: 0, semCadastro: 0, assessoresNovos: 0, erros: [] };

  // 1. Construir mapa de assessores existentes (nome → id)
  const assessoresDB = await dbAll('assessores');
  const assessoresByNome = {};
  for (const a of assessoresDB) assessoresByNome[a.nome] = a;

  // 2. Coletar assessores únicos válidos da planilha e upsert
  const assessoresNovos = new Set();
  for (const r of rows) {
    const nome = (r['Assessor'] || '').trim();
    if (nome && !assessoresByNome[nome]) assessoresNovos.add(nome);
  }
  for (const nome of assessoresNovos) {
    const id = await dbAdd('assessores', { nome, email: '', telefone: '' });
    assessoresByNome[nome] = { id, nome };
    result.assessoresNovos++;
  }

  // 3. Processar cada linha — upsert APENAS assessor e categoria_especial no cliente existente
  const total = rows.length;
  let processed = 0;
  for (const r of rows) {
    try {
      const codigo = String(r['Código'] || '').trim();
      if (!codigo || isNaN(Number(codigo))) continue;

      const categoriaRaw  = r['CATEGORIA'] || '';
      const categoria_especial = mapCategoriaEsmeralda(categoriaRaw);
      if (!categoria_especial) continue; // linha sem categoria válida ignorada

      const assessorNome  = (r['Assessor'] || '').trim();

      const existing = await dbGet('clientes', codigo);
      if (!existing) {
        result.semCadastro++;
      } else {
        const updated = {
          ...existing,
          assessor:          assessorNome || null,
          categoria_especial,
        };
        await dbPut('clientes', updated);
        result.atualizados++;
      }
    } catch (err) {
      result.erros.push(`${r['Código']}: ${err.message}`);
    }
    processed++;
    if (processed % 100 === 0 && onProgress) {
      const pct = 40 + Math.round((processed / total) * 55);
      onProgress(pct, `Processando ${processed}/${total}...`);
      await new Promise(r => setTimeout(r, 0)); // yield para não bloquear UI
    }
  }

  await auditLog('importEsmeralda',
    `Lista Esmeralda: ${result.atualizados} atualizados, ${result.semCadastro} sem cadastro G5, ${result.assessoresNovos} assessores novos`);
  return result;
}

// Expose to global scope
window.mapCategoriaEsmeralda = mapCategoriaEsmeralda;
window.processEsmeraldaImport = processEsmeraldaImport;