/**
 * core/auth.js — Autenticação, Sessão, RLS e ACL
 *
 * FASE 6 — Mudanças:
 *
 * 1. RLS hierárquico completo (decisão 5B):
 *    `applyDataFilter` permanece SÍNCRONA.
 *    O cálculo de `allowedRepIds` é feito UMA VEZ em `doLogin`, de forma assíncrona,
 *    e armazenado em `currentUser.allowedRepIds` (Set de strings).
 *    Todas as páginas continuam chamando `applyDataFilter(clientes, reps)` sem await.
 *
 * 2. Níveis de filtro suportados:
 *    - fullAccess          → sem filtro
 *    - representante       → clientes onde fk_representante === entityId
 *    - supervisor          → clientes cujos representantes têm fk_supervisor === entityId
 *    - gerente             → clientes cujos supervisores têm gerente === entityNome,
 *                            descendo até os representantes vinculados
 *    - assessor            → clientes onde assessor === entityNome
 *
 * 3. getScopeForGerente(gerenteNome, supervisores, representantes):
 *    Helper puro (síncrono, dados já carregados) que retorna Set<string> de repIds.
 *
 * 4. rlsBanner() atualizado para exibir label correto para 'gerente'.
 */
(function (global) {
  'use strict';

  var currentUser = null;

  // ── auditLog ─────────────────────────────────────────────────────────────────
  function auditLog(acao, detalhe) {
    detalhe = detalhe || '';
    var entry = {
      ts:      new Date().toISOString(),
      usuario: currentUser ? currentUser.login : 'sistema',
      acao:    acao,
      detalhe: detalhe.slice(0, 300)
    };
    try {
      if (global.dbAdd) global.dbAdd('audit_log', entry);
    } catch (e) {
      // non-blocking
    }
  }

  if (typeof global.setAuditHook === 'function') {
    global.setAuditHook(auditLog);
  }

  // ── getScopeForGerente ────────────────────────────────────────────────────────
  /**
   * Retorna um Set<string> com os IDs (como string) de todos os representantes
   * vinculados ao gerente pelo campo texto `supervisor.gerente === gerenteNome`.
   *
   * Segue o mesmo padrão do campo texto `representante.supervisor` (decisão 2B):
   * supervisores têm campo `gerente: string` com o nome do gerente.
   *
   * @param {string}   gerenteNome   - entityNome do usuário logado como gerente
   * @param {Array}    supervisores  - todos os registros da store 'supervisores'
   * @param {Array}    representantes - todos os registros da store 'representantes'
   * @returns {Set<string>}
   */
  function getScopeForGerente(gerenteNome, supervisores, representantes) {
    // 1. Nomes dos supervisores vinculados a este gerente
    var supNomes = new Set(
      supervisores
        .filter(function (s) { return s.gerente === gerenteNome; })
        .map(function (s) { return s.nome; })
    );

    // 2. IDs dos representantes cujo campo texto `supervisor` está nesse conjunto
    var repIds = new Set();
    representantes.forEach(function (r) {
      // Suporte dual: campo texto `supervisor` (legado) e FK numérica `fk_supervisor`
      // Prioridade: fk_supervisor se existir; fallback para campo texto
      if (r.fk_supervisor) {
        // Busca o nome do supervisor pelo id para comparar com supNomes
        var sup = supervisores.find(function (s) { return s.id === r.fk_supervisor; });
        if (sup && supNomes.has(sup.nome)) repIds.add(String(r.id));
      } else if (r.supervisor && supNomes.has(r.supervisor)) {
        repIds.add(String(r.id));
      }
    });

    return repIds;
  }

  // ── applyDataFilter ───────────────────────────────────────────────────────────
  /**
   * Filtra a lista de clientes de acordo com o perfil do usuário logado.
   * SÍNCRONA — os dados para o filtro (allowedRepIds) são pré-calculados no doLogin.
   *
   * @param {Array}  clientes  - todos os registros da store 'clientes'
   * @param {Array}  reps      - todos os registros da store 'representantes' (unused post-Fase6, mantido por compatibilidade)
   * @returns {Array}
   */
  function applyDataFilter(clientes, reps) {
    if (!currentUser || currentUser.fullAccess) return clientes;

    var entityType  = currentUser.entityType;
    var entityId    = currentUser.entityId;
    var entityNome  = currentUser.entityNome;

    if (!entityType || !entityId) return clientes;

    // Representante: filtro direto por FK
    if (entityType === 'representante') {
      return clientes.filter(function (c) {
        return String(c.fk_representante) === String(entityId);
      });
    }

    // Assessor: filtro por nome (campo texto)
    if (entityType === 'assessor') {
      return clientes.filter(function (c) {
        return c.assessor === entityNome;
      });
    }

    // Supervisor e Gerente: usam allowedRepIds pré-calculado no doLogin
    if (entityType === 'supervisor' || entityType === 'gerente') {
      var allowed = currentUser.allowedRepIds; // Set<string> | null
      if (!allowed) return clientes; // fallback seguro: acesso global se Set não calculado
      return clientes.filter(function (c) {
        return allowed.has(String(c.fk_representante));
      });
    }

    return clientes;
  }

  // ── rlsBanner ─────────────────────────────────────────────────────────────────
  function rlsBanner() {
    if (!currentUser || currentUser.fullAccess || !currentUser.entityType) return '';
    var labels = {
      representante: 'Representante',
      supervisor:    'Supervisor',
      assessor:      'Assessor',
      gerente:       'Gerente'
    };
    var label = labels[currentUser.entityType] || currentUser.entityType;
    var info  = currentUser.entityNome || currentUser.entityId;
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;background:rgba(15,155,148,.08);border:1px solid rgba(15,155,148,.25);border-radius:var(--r);margin-bottom:14px;font-size:12px">'
      + '<span style="color:var(--accent2)">L</span>'
      + '<span style="color:var(--text2)">Visão filtrada - <strong style="color:var(--accent2)">'
      + label + ': ' + info
      + '</strong>. Apenas dados vinculados.</span></div>';
  }

  // ── canAccess / canBtn ────────────────────────────────────────────────────────
  function canAccess(pageKey) {
    if (!currentUser) return false;
    if (currentUser.fullAccess) return true;
    return currentUser.permissoes[pageKey] !== false;
  }

  function canBtn(pageKey, btnKey) {
    if (!currentUser) return false;
    if (currentUser.fullAccess) return true;
    var key = pageKey + '::' + btnKey;
    return currentUser.permissoes ? currentUser.permissoes[key] !== false : true;
  }

  // ── applyNavPermissions ───────────────────────────────────────────────────────
  function applyNavPermissions() {
    if (!currentUser) return;
    if (currentUser.fullAccess) return;
    var hidden = Object.entries(currentUser.permissoes)
      .filter(function (e) { return !e[0].includes('::') && e[1] === false; })
      .map(function (e) { return e[0]; });
    var sidebarEl = document.getElementById('sidebar');
    if (sidebarEl && typeof sidebarEl.hidePages === 'function') {
      sidebarEl.hidePages(hidden);
    }
  }

  // ── doLogin ───────────────────────────────────────────────────────────────────
  async function doLogin(providedLogin, providedPassword) {
    var loginComp  = document.getElementById('login');
    var credentials = {
      login:    providedLogin || '',
      password: providedPassword || ''
    };

    if (!providedLogin && loginComp && typeof loginComp.getCredentials === 'function') {
      credentials = loginComp.getCredentials();
    }

    var login = (credentials.login || '').trim().toLowerCase();
    var senha = credentials.password || '';

    var setError = function (message) {
      if (loginComp && typeof loginComp.setError === 'function') {
        loginComp.setError(message);
      }
    };

    setError('');

    if (!login || !senha) {
      setError('Preencha login e senha.');
      return false;
    }

    try {
      if (global.dbReady && typeof global.dbReady.then === 'function') {
        await global.dbReady;
      }

      var user = await global.dbGet('usuarios', login);
      if (!user || user.senha !== senha) {
        setError('Login ou senha incorretos.');
        return false;
      }

      var perfil = await global.dbGet('perfis_acesso', user.perfilId);

      // ── Pré-calculo de allowedRepIds (decisão 5B) ─────────────────────────
      // Carregado UMA VEZ aqui para manter applyDataFilter síncrona em todas as páginas.
      var allowedRepIds = null;
      var entityType = user.entityType || null;
      var entityId   = user.entityId   || null;
      var entityNome = user.entityNome || null;
      var isFullAccess = perfil ? (perfil.fullAccess || false) : (user.perfilId === 'supervisor');

      if (!isFullAccess && entityType && entityId) {
        if (entityType === 'supervisor') {
          // Todos os representantes cujo campo fk_supervisor === entityId
          // com fallback para campo texto supervisor === entityNome
          var allReps  = await global.dbAll('representantes');
          var allSups  = await global.dbAll('supervisores');
          allowedRepIds = new Set();
          allReps.forEach(function (r) {
            if (r.fk_supervisor && r.fk_supervisor === entityId) {
              allowedRepIds.add(String(r.id));
            } else if (!r.fk_supervisor && r.supervisor && r.supervisor === entityNome) {
              allowedRepIds.add(String(r.id));
            }
          });
        }

        if (entityType === 'gerente') {
          var allReps2 = await global.dbAll('representantes');
          var allSups2 = await global.dbAll('supervisores');
          allowedRepIds = getScopeForGerente(entityNome, allSups2, allReps2);
        }
      }

      currentUser = {
        login:         user.login,
        nome:          user.nome || user.login,
        perfilId:      user.perfilId,
        perfilNome:    user.perfilNome || user.perfilId,
        fullAccess:    isFullAccess,
        permissoes:    perfil ? (perfil.permissoes || {}) : {},
        isAdmin:       user.isAdmin || false,
        entityType:    entityType,
        entityId:      entityId,
        entityNome:    entityNome,
        allowedRepIds: allowedRepIds,   // Set<string> | null
      };

      global.currentUser = currentUser;

      var sidebarEl = document.getElementById('sidebar');
      if (sidebarEl && typeof sidebarEl.setUser === 'function') {
        sidebarEl.setUser({ nome: currentUser.nome, perfil: currentUser.perfilNome });
      }

      applyNavPermissions();

      if (loginComp) loginComp.style.display = 'none';
      var mainEl = document.getElementById('main');
      if (mainEl) mainEl.style.display = '';
      if (sidebarEl) sidebarEl.style.display = '';

      auditLog('login', 'Acesso realizado pelo perfil ' + currentUser.perfilNome);

      if (typeof global.navigate === 'function') {
        global.navigate('dashboard');
      }

      return true;
    } catch (err) {
      console.error('Erro no login:', err);
      setError('Erro ao conectar ao banco de dados.');
      return false;
    }
  }

  // ── doLogout ──────────────────────────────────────────────────────────────────
  function doLogout() {
    if (currentUser) {
      auditLog('logout', 'Sessao encerrada');
    }
    currentUser = null;
    global.currentUser = null;

    var loginComp = document.getElementById('login');
    if (loginComp && typeof loginComp.reset === 'function') {
      loginComp.reset();
      loginComp.style.display = 'flex';
    }

    var mainEl = document.getElementById('main');
    if (mainEl) mainEl.style.display = 'none';

    var sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) {
      sidebarEl.style.display = 'none';
      if (typeof sidebarEl.setUser === 'function') {
        sidebarEl.setUser({ nome: '-', perfil: '-' });
      }
    }
  }

  // ── initDefaultAdmin ──────────────────────────────────────────────────────────
  async function initDefaultAdmin() {
    try {
      var existing = await global.dbGet('usuarios', 'admin');
      if (!existing) {
        await global.dbAdd('usuarios', {
          login:      'admin',
          nome:       'Administrador',
          senha:      'qwerty@DB',
          perfilId:   'supervisor',
          perfilNome: 'Supervisor',
          isAdmin:    true
        });
      }
    } catch (err) {
      console.error('Erro ao inicializar admin:', err);
    }
  }

  // ── Exports globais ───────────────────────────────────────────────────────────
  global.currentUser          = currentUser;
  global.auditLog             = auditLog;
  global.applyDataFilter      = applyDataFilter;
  global.getScopeForGerente   = getScopeForGerente;
  global.rlsBanner            = rlsBanner;
  global.canAccess            = canAccess;
  global.canBtn               = canBtn;
  global.applyNavPermissions  = applyNavPermissions;
  global.doLogin              = doLogin;
  global.doLogout             = doLogout;
  global.initDefaultAdmin     = initDefaultAdmin;

}(window));
