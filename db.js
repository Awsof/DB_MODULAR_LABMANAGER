/**
 * core/db.js — Camada de acesso ao IndexedDB
 *
 * Responsabilidades:
 *  - Abrir e migrar o banco de dados (initDB)
 *  - Expor helpers CRUD simples (dbAll, dbGet, dbPut, dbAdd, dbDelete, dbClear)
 *  - Expor variantes com audit-log automático (dbAddLogged, dbPutLogged, dbDeleteLogged)
 *
 * Padrão de exportação: ES Module (export nomeado)
 * Dependências externas: nenhuma
 * Dependência interna: auth.js importa { auditLog } — injetada via setter para
 *   evitar dependência circular (db ← auth ← db).
 *
 * Referências:
 *  - IndexedDB spec: https://www.w3.org/TR/IndexedDB/
 *  - MDN IDB guide:  https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
 *  - Versionamento:  https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/upgradeneeded_event
 */

// ── Constantes do banco ─────────────────────────────────────────────────────
export const DB_NAME    = 'dblabmanager';
export const DB_VERSION = 9;

/** Instância global do IDBDatabase — preenchida por initDB() */
let db = null;

/**
 * Hook de auditoria — injetado por auth.js após sua própria inicialização,
 * quebrando a dependência circular db ↔ auth.
 * Assinatura esperada: async (acao: string, detalhe?: string) => void
 */
let _auditHook = null;
export function setAuditHook(fn) { _auditHook = fn; }

// ── initDB ──────────────────────────────────────────────────────────────────

/**
 * Abre (ou cria/migra) o banco IndexedDB.
 * Deve ser aguardada antes de qualquer outra operação de banco.
 * @returns {Promise<IDBDatabase>}
 */
export function initDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const d  = e.target.result;
      const tx = e.target.transaction; // reutilizado nas migrações incrementais

      // ── clientes ──────────────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('clientes')) {
        const s = d.createObjectStore('clientes', { keyPath: 'Codigo' });
        s.createIndex('UF',               'UF');
        s.createIndex('fk_representante', 'fk_representante');
        s.createIndex('fk_sistema',       'fk_sistema');
        s.createIndex('assessor',         'assessor');
        s.createIndex('categoria_especial','categoria_especial');
      } else {
        // Migração incremental v8→v9: adiciona índices ausentes
        const s = tx.objectStore('clientes');
        if (!s.indexNames.contains('assessor'))
          s.createIndex('assessor', 'assessor');
        if (!s.indexNames.contains('categoria_especial'))
          s.createIndex('categoria_especial', 'categoria_especial');
      }

      // ── representantes ────────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('representantes')) {
        const s = d.createObjectStore('representantes', { keyPath: 'id', autoIncrement: true });
        s.createIndex('nome', 'nome', { unique: true });
      }

      // ── assessores ────────────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('assessores')) {
        const as = d.createObjectStore('assessores', { keyPath: 'id', autoIncrement: true });
        as.createIndex('nome', 'nome', { unique: true });
      }

      // ── supervisores (v9) ─────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('supervisores')) {
        const sv = d.createObjectStore('supervisores', { keyPath: 'id', autoIncrement: true });
        sv.createIndex('nome', 'nome', { unique: true });
      }

      // ── analistas (v9) ────────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('analistas')) {
        const an = d.createObjectStore('analistas', { keyPath: 'id', autoIncrement: true });
        an.createIndex('nome', 'nome', { unique: true });
      }

      // ── sistemas ──────────────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('sistemas')) {
        d.createObjectStore('sistemas', { keyPath: 'id', autoIncrement: true });
      }

      // ── logs ──────────────────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('logs')) {
        d.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
      }

      // ── chamados ──────────────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('chamados')) {
        const ch = d.createObjectStore('chamados', { keyPath: 'id', autoIncrement: true });
        ch.createIndex('fk_cliente',      'fk_cliente');
        ch.createIndex('analista',        'analista');
        ch.createIndex('dataSolicitacao', 'dataSolicitacao');
      }

      // ── envios ────────────────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('envios')) {
        const ev = d.createObjectStore('envios', { keyPath: 'id', autoIncrement: true });
        ev.createIndex('fk_cliente', 'fk_cliente');
        ev.createIndex('tipoEnvio',  'tipoEnvio');
        ev.createIndex('periodo',    'periodo');
      }

      // ── propostas ─────────────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('propostas')) {
        const pr = d.createObjectStore('propostas', { keyPath: 'id', autoIncrement: true });
        pr.createIndex('fk_cliente', 'fk_cliente');
        pr.createIndex('status',     'status');
      }

      // ── pacotes ───────────────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('pacotes')) {
        const pk = d.createObjectStore('pacotes', { keyPath: 'id', autoIncrement: true });
        pk.createIndex('nome', 'nome');
      }

      // ── pacote_registros ──────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('pacote_registros')) {
        const pkr = d.createObjectStore('pacote_registros', { keyPath: 'id', autoIncrement: true });
        pkr.createIndex('fk_pacote',  'fk_pacote');
        pkr.createIndex('fk_cliente', 'fk_cliente');
      }

      // ── budget ────────────────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('budget')) {
        d.createObjectStore('budget', { keyPath: 'ano' });
      }

      // ── perfis_acesso ─────────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('perfis_acesso')) {
        d.createObjectStore('perfis_acesso', { keyPath: 'id' });
      }

      // ── usuarios (v9: índice entityType para RLS) ─────────────────────────
      if (!d.objectStoreNames.contains('usuarios')) {
        const usr = d.createObjectStore('usuarios', { keyPath: 'login' });
        usr.createIndex('perfilId',   'perfilId');
        usr.createIndex('entityType', 'entityType');
      } else {
        // Migração incremental: adicionar índice entityType se ausente
        const usr = tx.objectStore('usuarios');
        if (!usr.indexNames.contains('entityType'))
          usr.createIndex('entityType', 'entityType');
      }

      // ── audit_log ─────────────────────────────────────────────────────────
      if (!d.objectStoreNames.contains('audit_log')) {
        const al = d.createObjectStore('audit_log', { keyPath: 'id', autoIncrement: true });
        al.createIndex('ts',      'ts');
        al.createIndex('usuario', 'usuario');
      }
    };

    req.onsuccess = e => { db = e.target.result; res(db); };
    req.onerror   = ()  => rej(req.error);
  });
}

// ── Helpers CRUD ─────────────────────────────────────────────────────────────

/**
 * Retorna todos os registros de uma store.
 * @param {string} store
 * @returns {Promise<any[]>}
 */
export function dbAll(store) {
  return new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

/**
 * Retorna um único registro por chave primária.
 * @param {string} store
 * @param {*} key
 * @returns {Promise<any|undefined>}
 */
export function dbGet(store, key) {
  return new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

/**
 * Insere ou atualiza (upsert) um registro.
 * Se o objeto tiver a chave primária, atualiza; senão, cria.
 * @param {string} store
 * @param {object} data
 * @returns {Promise<IDBValidKey>}
 */
export function dbPut(store, data) {
  return new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

/**
 * Insere um novo registro (lança erro se a chave já existir).
 * @param {string} store
 * @param {object} data
 * @returns {Promise<IDBValidKey>}
 */
export function dbAdd(store, data) {
  return new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(data);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

/**
 * Remove um registro pela chave primária.
 * @param {string} store
 * @param {*} key
 * @returns {Promise<void>}
 */
export function dbDelete(store, key) {
  return new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

/**
 * Remove todos os registros de uma store.
 * @param {string} store
 * @returns {Promise<void>}
 */
export function dbClear(store) {
  return new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

// ── Variantes com auditoria automática ───────────────────────────────────────
// Cada função executa a operação CRUD numa transação independente e, em seguida,
// chama o hook de auditoria (quando disponível) em outra transação separada.
// Isso garante que a falha no log não reverte a operação principal.

/**
 * dbAdd + registro automático de auditoria.
 * @param {string} store
 * @param {object} data
 * @param {string} [acao]
 * @returns {Promise<IDBValidKey>}
 */
export async function dbAddLogged(store, data, acao) {
  const r = await dbAdd(store, data);
  if (_auditHook) await _auditHook(acao || `Criou em ${store}`, JSON.stringify(data).slice(0, 120));
  return r;
}

/**
 * dbPut + registro automático de auditoria.
 * @param {string} store
 * @param {object} data
 * @param {string} [acao]
 * @returns {Promise<IDBValidKey>}
 */
export async function dbPutLogged(store, data, acao) {
  const r = await dbPut(store, data);
  if (_auditHook) await _auditHook(acao || `Editou em ${store}`, JSON.stringify(data).slice(0, 120));
  return r;
}

/**
 * dbDelete + registro automático de auditoria.
 * @param {string} store
 * @param {*} key
 * @param {string} [acao]
 * @returns {Promise<void>}
 */
export async function dbDeleteLogged(store, key, acao) {
  const r = await dbDelete(store, key);
  if (_auditHook) await _auditHook(acao || `Excluiu de ${store}`, String(key));
  return r;
}
