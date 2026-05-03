/**
 * core/db.js — Camada de acesso ao IndexedDB
 *
 * PADRÃO: Script clássico carregado via <script src="core/db.js" defer>.
 * Registra todas as funções em window.* para acesso global pelo <script>
 * inline do index.html (páginas).
 *
 * NÃO usa import/export (ES Modules), pois o <script type="module"> cria
 * escopo isolado — window.X atribuído dentro de um módulo ES não fica
 * disponível para um <script> clássico que já começou a ser interpretado
 * antes do módulo ser resolvido e executado (Fase 1, bug V26).
 *
 * Referências:
 *  - IndexedDB spec: https://www.w3.org/TR/IndexedDB/
 *  - Script loading: https://html.spec.whatwg.org/multipage/scripting.html
 */
(function (global) {
  'use strict';

  const DB_NAME    = 'dblabmanager';
  const DB_VERSION = 9;

  let _db        = null;   // IDBDatabase instance
  let _auditHook = null;   // injetado por auth.js via setAuditHook()

  // ── initDB ──────────────────────────────────────────────────────────────────
  function initDB() {
    return new Promise(function (res, rej) {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = function (e) {
        const d  = e.target.result;
        const tx = e.target.transaction;

        // clientes
        if (!d.objectStoreNames.contains('clientes')) {
          const s = d.createObjectStore('clientes', { keyPath: 'Codigo' });
          s.createIndex('UF',                'UF');
          s.createIndex('fk_representante',  'fk_representante');
          s.createIndex('fk_sistema',        'fk_sistema');
          s.createIndex('assessor',          'assessor');
          s.createIndex('categoria_especial','categoria_especial');
        } else {
          const s = tx.objectStore('clientes');
          if (!s.indexNames.contains('assessor'))
            s.createIndex('assessor', 'assessor');
          if (!s.indexNames.contains('categoria_especial'))
            s.createIndex('categoria_especial', 'categoria_especial');
        }
        // representantes
        if (!d.objectStoreNames.contains('representantes')) {
          const s = d.createObjectStore('representantes', { keyPath: 'id', autoIncrement: true });
          s.createIndex('nome', 'nome', { unique: true });
        }
        // assessores
        if (!d.objectStoreNames.contains('assessores')) {
          const s = d.createObjectStore('assessores', { keyPath: 'id', autoIncrement: true });
          s.createIndex('nome', 'nome', { unique: true });
        }
        // supervisores
        if (!d.objectStoreNames.contains('supervisores')) {
          const s = d.createObjectStore('supervisores', { keyPath: 'id', autoIncrement: true });
          s.createIndex('nome', 'nome', { unique: true });
        }
        // analistas
        if (!d.objectStoreNames.contains('analistas')) {
          const s = d.createObjectStore('analistas', { keyPath: 'id', autoIncrement: true });
          s.createIndex('nome', 'nome', { unique: true });
        }
        // sistemas
        if (!d.objectStoreNames.contains('sistemas'))
          d.createObjectStore('sistemas', { keyPath: 'id', autoIncrement: true });
        // logs
        if (!d.objectStoreNames.contains('logs'))
          d.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
        // chamados
        if (!d.objectStoreNames.contains('chamados')) {
          const s = d.createObjectStore('chamados', { keyPath: 'id', autoIncrement: true });
          s.createIndex('fk_cliente',      'fk_cliente');
          s.createIndex('analista',        'analista');
          s.createIndex('dataSolicitacao', 'dataSolicitacao');
        }
        // envios
        if (!d.objectStoreNames.contains('envios')) {
          const s = d.createObjectStore('envios', { keyPath: 'id', autoIncrement: true });
          s.createIndex('fk_cliente', 'fk_cliente');
          s.createIndex('tipoEnvio',  'tipoEnvio');
          s.createIndex('periodo',    'periodo');
        }
        // propostas
        if (!d.objectStoreNames.contains('propostas')) {
          const s = d.createObjectStore('propostas', { keyPath: 'id', autoIncrement: true });
          s.createIndex('fk_cliente', 'fk_cliente');
          s.createIndex('status',     'status');
        }
        // pacotes
        if (!d.objectStoreNames.contains('pacotes')) {
          const s = d.createObjectStore('pacotes', { keyPath: 'id', autoIncrement: true });
          s.createIndex('nome', 'nome');
        }
        // pacote_registros
        if (!d.objectStoreNames.contains('pacote_registros')) {
          const s = d.createObjectStore('pacote_registros', { keyPath: 'id', autoIncrement: true });
          s.createIndex('fk_pacote',  'fk_pacote');
          s.createIndex('fk_cliente', 'fk_cliente');
        }
        // budget
        if (!d.objectStoreNames.contains('budget'))
          d.createObjectStore('budget', { keyPath: 'ano' });
        // perfis_acesso
        if (!d.objectStoreNames.contains('perfis_acesso'))
          d.createObjectStore('perfis_acesso', { keyPath: 'id' });
        // usuarios
        if (!d.objectStoreNames.contains('usuarios')) {
          const s = d.createObjectStore('usuarios', { keyPath: 'login' });
          s.createIndex('perfilId',   'perfilId');
          s.createIndex('entityType', 'entityType');
        } else {
          const s = tx.objectStore('usuarios');
          if (!s.indexNames.contains('entityType'))
            s.createIndex('entityType', 'entityType');
        }
        // audit_log
        if (!d.objectStoreNames.contains('audit_log')) {
          const s = d.createObjectStore('audit_log', { keyPath: 'id', autoIncrement: true });
          s.createIndex('ts',      'ts');
          s.createIndex('usuario', 'usuario');
        }
      };

      req.onsuccess = function (e) { _db = e.target.result; res(_db); };
      req.onerror   = function ()  { rej(req.error); };
    });
  }

  // ── CRUD helpers ─────────────────────────────────────────────────────────────
  function dbAll(store) {
    return new Promise(function (res, rej) {
      const tx  = _db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = function () { res(req.result); };
      req.onerror   = function () { rej(req.error); };
    });
  }

  function dbGet(store, key) {
    return new Promise(function (res, rej) {
      const tx  = _db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = function () { res(req.result); };
      req.onerror   = function () { rej(req.error); };
    });
  }

  function dbPut(store, data) {
    return new Promise(function (res, rej) {
      const tx  = _db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(data);
      req.onsuccess = function () { res(req.result); };
      req.onerror   = function () { rej(req.error); };
    });
  }

  function dbAdd(store, data) {
    return new Promise(function (res, rej) {
      const tx  = _db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).add(data);
      req.onsuccess = function () { res(req.result); };
      req.onerror   = function () { rej(req.error); };
    });
  }

  function dbDelete(store, key) {
    return new Promise(function (res, rej) {
      const tx  = _db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = function () { res(); };
      req.onerror   = function () { rej(req.error); };
    });
  }

  function dbClear(store) {
    return new Promise(function (res, rej) {
      const tx  = _db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).clear();
      req.onsuccess = function () { res(); };
      req.onerror   = function () { rej(req.error); };
    });
  }

  // ── Variantes com auditoria ───────────────────────────────────────────────────
  async function dbAddLogged(store, data, acao) {
    const r = await dbAdd(store, data);
    if (_auditHook) await _auditHook(acao || ('Criou em ' + store), JSON.stringify(data).slice(0, 120));
    return r;
  }

  async function dbPutLogged(store, data, acao) {
    const r = await dbPut(store, data);
    if (_auditHook) await _auditHook(acao || ('Editou em ' + store), JSON.stringify(data).slice(0, 120));
    return r;
  }

  async function dbDeleteLogged(store, key, acao) {
    await dbDelete(store, key);
    if (_auditHook) await _auditHook(acao || ('Excluiu de ' + store), String(key));
  }

  /** Injeta função de auditoria — chamado por auth.js */
  function setAuditHook(fn) { _auditHook = fn; }

  // ── Registro em window ────────────────────────────────────────────────────────
  global.DB_NAME        = DB_NAME;
  global.DB_VERSION     = DB_VERSION;
  global.initDB         = initDB;
  global.dbAll          = dbAll;
  global.dbGet          = dbGet;
  global.dbPut          = dbPut;
  global.dbAdd          = dbAdd;
  global.dbDelete       = dbDelete;
  global.dbClear        = dbClear;
  global.dbAddLogged    = dbAddLogged;
  global.dbPutLogged    = dbPutLogged;
  global.dbDeleteLogged = dbDeleteLogged;
  global.setAuditHook   = setAuditHook;

}(window));
