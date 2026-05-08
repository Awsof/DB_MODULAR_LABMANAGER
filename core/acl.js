/**
 * core/acl.js — Estrutura de controle de acesso (ACL) e perfis padrão
 *
 * FASE 5: Extraído do script inline do index.html.
 * Deve ser carregado ANTES de pages/perfis_acesso.js.
 *
 * Expõe via window.*:
 *  - ACL_STRUCTURE     : array de categorias → páginas → botões (define o que é controlável)
 *  - PERFIS_DEFAULT    : perfis pré-configurados criados na primeira execução
 *  - buildDefaultPerms : gera objeto de permissões com tudo habilitado (usado ao criar/resetar perfil)
 *
 * FASE 5 — Novos itens adicionados:
 *  - Página `chamados`  : gestão standalone de chamados de integração
 *  - Página `gerentes`  : CRUD de gerentes comerciais (Gerente > Supervisor > Representante)
 *  - Perfil `supervisor_comercial` : visualiza dados vinculados aos seus representantes
 *  - Perfil `gerente`   : visualiza dados de todos os supervisores e representantes sob sua hierarquia
 */
(function (global) {
  'use strict';

  // ── ACL_STRUCTURE ──────────────────────────────────────────────────────────
  // Define todas as páginas e botões que podem ser controlados por perfil.
  // Cada entrada { key } corresponde à rota data-page usada pelo router.js.
  // Cada botão { key } deve ter data-acl-key correspondente no HTML da página.
  global.ACL_STRUCTURE = [
    { cat: 'Visão Geral', pages: [
      { key: 'dashboard',            label: 'Dashboard Integração',  btns: [{ key: 'dash-int-report',  label: 'Gerar Relatório' }] },
      { key: 'dashboard_comercial',  label: 'Dashboard Comercial',   btns: [{ key: 'dash-com-report',  label: 'Gerar Relatório' }] },
      { key: 'dashboard_financeiro', label: 'Dashboard Financeiro',  btns: [{ key: 'dash-fin-report',  label: 'Gerar Relatório' }, { key: 'budget-save', label: 'Salvar Budget' }] },
    ]},
    { cat: 'Cadastros', pages: [
      { key: 'laboratorios',    label: 'Laboratórios',      btns: [{ key: 'edit-btn',     label: 'Botão Editar' }] },
      { key: 'representantes',  label: 'Representantes',    btns: [{ key: 'new-rep-btn',  label: 'Novo Representante' }, { key: 'edit-btn', label: 'Botão Editar' }] },
      { key: 'supervisores',    label: 'Supervisores',      btns: [{ key: 'new-sup-btn',  label: 'Novo Supervisor' },   { key: 'edit-btn', label: 'Botão Editar' }] },
      { key: 'gerentes',        label: 'Gerentes',          btns: [{ key: 'new-ger-btn',  label: 'Novo Gerente' },      { key: 'edit-btn', label: 'Botão Editar' }] },
      { key: 'assessores',      label: 'Assessores',        btns: [{ key: 'edit-btn',     label: 'Botão Editar' }] },
      { key: 'analistas',       label: 'Analistas',         btns: [{ key: 'new-ana-btn',  label: 'Novo Analista' },     { key: 'edit-btn', label: 'Botão Editar' }] },
      { key: 'sistemas',        label: 'Sistemas',          btns: [{ key: 'new-sys-btn',  label: 'Novo Sistema' },      { key: 'edit-btn', label: 'Botão Editar' }] },
      { key: 'grupos_matrizes', label: 'Grupos e Matrizes', btns: [] },
    ]},
    { cat: 'Operações', pages: [
      { key: 'chamados', label: 'Chamados', btns: [
        { key: 'new-cha-btn',    label: 'Novo Chamado' },
        { key: 'edit-btn',       label: 'Botão Editar' },
        { key: 'close-cha-btn',  label: 'Finalizar Chamado' },
      ]},
    ]},
    { cat: 'Análise', pages: [
      { key: 'divergencias', label: 'Divergências', btns: [] },
    ]},
    { cat: 'Financeiro', pages: [
      { key: 'propostas', label: 'Propostas', btns: [{ key: 'new-prop-btn', label: 'Nova Proposta' }, { key: 'edit-btn', label: 'Botão Editar' }] },
      { key: 'pacotes',   label: 'Pacotes',   btns: [{ key: 'new-pac-btn', label: 'Novo Pacote' },   { key: 'edit-btn', label: 'Botão Editar' }] },
    ]},
    { cat: 'Administração', pages: [
      { key: 'importacao',    label: 'Importação',                  btns: [{ key: 'clear-data-btn', label: 'Limpar Dados' }] },
      { key: 'perfis_acesso', label: 'Perfis de acesso e usuários', btns: [] },
    ]},
  ];

  // ── PERFIS_DEFAULT ─────────────────────────────────────────────────────────
  // Criados automaticamente na primeira execução (store `perfis_acesso` vazia).
  // fullAccess: true  → acesso irrestrito, matriz de permissões ignorada
  // fullAccess: false → acesso controlado pela matriz de permissões do perfil
  //
  // Hierarquia comercial:
  //   Gerente → Supervisor → Representante
  //   Cada nível visualiza APENAS dados vinculados à sua entidade e descendentes.
  global.PERFIS_DEFAULT = [
    // ── Acesso total (admin interno) ──
    { id: 'supervisor',        nome: 'Supervisor (Sistema)',  fullAccess: true  },

    // ── Hierarquia comercial ──
    { id: 'gerente',           nome: 'Gerente',              fullAccess: false },
    { id: 'supervisor_comercial', nome: 'Supervisor Comercial', fullAccess: false },
    { id: 'representante',     nome: 'Representante',        fullAccess: false },

    // ── Operacionais ──
    { id: 'analistas',         nome: 'Analistas',            fullAccess: false },
    { id: 'analistas_senior',  nome: 'Analistas Sênior',     fullAccess: false },
    { id: 'estagiario',        nome: 'Estagiário',           fullAccess: false },
    { id: 'financeiro',        nome: 'Financeiro',           fullAccess: false },
  ];

  // ── buildDefaultPerms ──────────────────────────────────────────────────────
  // Gera objeto { [key]: true, [pageKey::btnKey]: true } para todas as
  // entradas do ACL_STRUCTURE. Usado ao criar um novo perfil ou ao "Redefinir
  // para Total" na matriz de permissões.
  global.buildDefaultPerms = function buildDefaultPerms() {
    var p = {};
    for (var i = 0; i < global.ACL_STRUCTURE.length; i++) {
      var cat = global.ACL_STRUCTURE[i];
      for (var j = 0; j < cat.pages.length; j++) {
        var pg = cat.pages[j];
        p[pg.key] = true;
        for (var k = 0; k < pg.btns.length; k++) {
          p[pg.key + '::' + pg.btns[k].key] = true;
        }
      }
    }
    return p;
  };

})(window);
