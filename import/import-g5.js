// ===================== IMPORT ENGINE =====================
const IGNORE_REP = v => !v || v.trim() === '' || v.toUpperCase().startsWith('A DEFINIR') || v.toUpperCase().startsWith('COMERCIAL A DEFINIR');
async function processImport(rows) {
  const log = { data: new Date().toISOString(), novos: [], alterados: [], erros: [] };

  // 1. Coletar representantes válidos únicos
  const repMap = {};
  for (const r of rows) {
    const repNome = (r['Representante'] || '').trim();
    const rawSup  = (r['Nome Supervisor'] || '').trim();
    // Normaliza "REGIAO - NOME" → "Nome" using shared helper
    const supNome = normalizeSupervisor(rawSup);
    if (!IGNORE_REP(repNome) && !repMap[repNome]) repMap[repNome] = supNome;
  }
  // Upsert representantes
  const repsDB = await dbAll('representantes');
  const repsByName = {};
  for (const rep of repsDB) repsByName[rep.nome] = rep;

  // ── NOVO: Upsert supervisores na store (by nome, de-duplicado) ──
  const supNomesUnicos = [...new Set(Object.values(repMap).filter(Boolean))];
  const supsDB = await dbAll('supervisores');
  const supsByNome = {};
  for (const s of supsDB) supsByNome[s.nome] = s;
  for (const nome of supNomesUnicos) {
    if (!supsByNome[nome]) {
      const id = await dbAdd('supervisores', { nome, uf: '', email: '' });
      supsByNome[nome] = { id, nome };
    }
  }

  for (const [nome, supervisor] of Object.entries(repMap)) {
    if (!repsByName[nome]) {
      // Representante novo: inserir com supervisor já normalizado
      const id = await dbAdd('representantes', { nome, supervisor, uf: '', telefone: '', email: '' });
      repsByName[nome] = { id, nome, supervisor };
    } else {
      // Representante existente: atualizar supervisor se ainda estiver no formato antigo
      const existing = repsByName[nome];
      if (existing.supervisor !== supervisor) {
        const updated = { ...existing, supervisor };
        await dbPut('representantes', updated);
        repsByName[nome] = updated;
      }
    }
  }

  // 2. Primeiro passe: processar MATRIZES (sem Cód. Matriz)
  // Segundo passe: filiais
  const passos = [
    rows.filter(r => !r['Cód. Matriz'] || r['Cód. Matriz'].trim() === ''),
    rows.filter(r => r['Cód. Matriz'] && r['Cód. Matriz'].trim() !== '')
  ];

  for (const batch of passos) {
    for (const row of batch) {
      try {
        const codigo = String(row['Código'] || '').trim();
        if (!codigo) continue;
        const uf = (row['UF'] || '').trim().toUpperCase();
        const repNome = (row['Representante'] || '').trim();
        const fk_rep = IGNORE_REP(repNome) ? null : (repsByName[repNome]?.id || null);
        const codMatriz = row['Cód. Matriz'] ? String(row['Cód. Matriz']).trim() : null;

        const existing = await dbGet('clientes', codigo);

        const planilhaData = {
          Codigo: codigo,
          Grupo: row['Grupo'] || null,
          RazaoSocial: row['Razão Social'] || null,
          NomeFantasia: row['Nome Fantasia'] || null,
          CNPJ: row['CNPJ'] || null,
          CodMatriz: codMatriz,
          NomeMatriz: row['Matriz'] || null,
          UF: uf,
          Representante: IGNORE_REP(repNome) ? null : repNome,
          fk_representante: fk_rep,
        };

        if (!existing) {
          await dbPut('clientes', {
            ...planilhaData,
            fk_sistema: null,
            NomeContato: null,
            Telefone: null,
            // manual edit flags
            _manual_NomeContato: false,
            _manual_Telefone: false,
            _manual_fk_sistema: false,
          });
          log.novos.push({ codigo, nome: planilhaData.NomeFantasia || planilhaData.RazaoSocial, uf, representante: planilhaData.Representante });
        } else {
          // Campos da planilha sempre atualizam, EXCETO campos editados manualmente
          const updated = { ...existing };
          const planilhaCampos = ['Grupo','RazaoSocial','NomeFantasia','CNPJ','CodMatriz','NomeMatriz','UF','Representante','fk_representante'];
          let changed = false;
          for (const campo of planilhaCampos) {
            if (updated[campo] !== planilhaData[campo]) { updated[campo] = planilhaData[campo]; changed = true; }
          }
          // Campos manuais: só atualizar se NÃO tiver flag de edição manual
          // (já preservados pela estrutura do objeto existing)
          if (changed) {
            await dbPut('clientes', updated);
            log.alterados.push({ codigo, nome: planilhaData.NomeFantasia || planilhaData.RazaoSocial, uf, representante: planilhaData.Representante });
          }
        }
      } catch (err) {
        log.erros.push(String(row['Código']) + ': ' + err.message);
      }
    }
  }

  await dbAdd('logs', log);
  return log;
}

// Expose to global scope
window.processImport = processImport;
