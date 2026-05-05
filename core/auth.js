/**
 * core/auth.js - Autenticacao, Sessao, RLS e ACL
 */
(function (global) {
  'use strict';

  var currentUser = null;

  function auditLog(acao, detalhe) {
    detalhe = detalhe || '';
    var entry = {
      ts: new Date().toISOString(),
      usuario: currentUser ? currentUser.login : 'sistema',
      acao: acao,
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

  function applyDataFilter(clientes, reps) {
    if (!currentUser || currentUser.fullAccess) return clientes;
    var entityType = currentUser.entityType;
    var entityId = currentUser.entityId;
    var entityNome = currentUser.entityNome;
    if (!entityType || !entityId) return clientes;

    if (entityType === 'representante') {
      return clientes.filter(function (c) {
        return String(c.fk_representante) === String(entityId);
      });
    }
    if (entityType === 'assessor') {
      return clientes.filter(function (c) {
        return c.assessor === entityNome;
      });
    }
    if (entityType === 'supervisor') {
      var repIds = new Set((reps || []).filter(function (r) {
        return r.supervisor === entityNome;
      }).map(function (r) {
        return String(r.id);
      }));
      return clientes.filter(function (c) {
        return repIds.has(String(c.fk_representante));
      });
    }
    return clientes;
  }

  function rlsBanner() {
    if (!currentUser || currentUser.fullAccess || !currentUser.entityType) return '';
    var labels = { representante: 'Representante', supervisor: 'Supervisor', assessor: 'Assessor' };
    var label = labels[currentUser.entityType] || currentUser.entityType;
    var info = currentUser.entityNome || currentUser.entityId;
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;background:rgba(15,155,148,.08);border:1px solid rgba(15,155,148,.25);border-radius:var(--r);margin-bottom:14px;font-size:12px"><span style="color:var(--accent2)">L</span><span style="color:var(--text2)">Viso filtrada - <strong style="color:var(--accent2)">' + label + ': ' + info + '</strong>. Apenas dados vinculados.</span></div>';
  }

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

  function applyNavPermissions() {
    if (!currentUser) return;
    if (currentUser.fullAccess) return;
    var hidden = Object.entries(currentUser.permissoes).filter(function (e) {
      return !e[0].includes('::') && e[1] === false;
    }).map(function (e) {
      return e[0];
    });
    var sidebarEl = document.getElementById('sidebar');
    if (sidebarEl && typeof sidebarEl.hidePages === 'function') {
      sidebarEl.hidePages(hidden);
    }
  }

  async function doLogin(providedLogin, providedPassword) {
    var loginComp = document.getElementById('login');
    var credentials = {
      login: providedLogin || '',
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

      currentUser = {
        login: user.login,
        nome: user.nome || user.login,
        perfilId: user.perfilId,
        perfilNome: user.perfilNome || user.perfilId,
        fullAccess: perfil ? (perfil.fullAccess || false) : (user.perfilId === 'supervisor'),
        permissoes: perfil ? (perfil.permissoes || {}) : {},
        isAdmin: user.isAdmin || false,
        entityType: user.entityType || null,
        entityId: user.entityId || null,
        entityNome: user.entityNome || null
      };

      global.currentUser = currentUser;

      var sidebarEl = document.getElementById('sidebar');
      if (sidebarEl && typeof sidebarEl.setUser === 'function') {
        sidebarEl.setUser({ nome: currentUser.nome, perfil: currentUser.perfilNome });
      }

      applyNavPermissions();

      if (loginComp) {
        loginComp.style.display = 'none';
      }
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

  async function initDefaultAdmin() {
    try {
      var existing = await global.dbGet('usuarios', 'admin');
      if (!existing) {
        await global.dbAdd('usuarios', {
          login: 'admin',
          nome: 'Administrador',
          senha: 'qwerty@DB',
          perfilId: 'supervisor',
          perfilNome: 'Supervisor',
          isAdmin: true
        });
      }
    } catch (err) {
      console.error('Erro ao inicializar admin:', err);
    }
  }

  global.currentUser = currentUser;
  global.auditLog = auditLog;
  global.applyDataFilter = applyDataFilter;
  global.rlsBanner = rlsBanner;
  global.canAccess = canAccess;
  global.canBtn = canBtn;
  global.applyNavPermissions = applyNavPermissions;
  global.doLogin = doLogin;
  global.doLogout = doLogout;
  global.initDefaultAdmin = initDefaultAdmin;

}(window));
