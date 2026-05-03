/**
 * core/auth.js — Autenticação, Sessão, RLS e Controle de Acesso (ACL)
 *
 * Responsabilidades:
 *  - Gerenciar a sessão do usuário (currentUser)
 *  - Executar login / logout
 *  - Aplicar Row-Level Security (applyDataFilter, rlsBanner)
 *  - Verificar permissões de página e botão (canAccess, canBtn)
 *  - Registrar entradas no audit_log (auditLog)
 *  - Criar o usuário administrador padrão (initDefaultAdmin)
 *
 * Padrão de exportação: ES Module (export nomeado)
 *
 * Dependências:
 *  - core/db.js  → dbGet, dbAdd, dbPut, setAuditHook
 *
 * Regra de dependência circular:
 *  db.js expõe setAuditHook() para receber a função auditLog deste módulo.
 *  Isso evita que db.js importe auth.js diretamente (ciclo proibido em
 *  módulos ES síncronos sem dynamic import).
 *
 * Referências:
 *  - Row-Level Security pattern: DB_LAB_MANAGER_PROJECT.md §2.6
 *  - ACL pattern:                DB_LAB_MANAGER_PROJECT.md §2.7
 */

import {
  dbGet, dbAdd, dbPut, setAuditHook,
} from './db.js';

// ── Estado de sessão ─────────────────────────────────────────────────────────

/**
 * Usuário atualmente logado.
 * Shape: {
 *   login, nome, perfilId, perfilNome,
 *   fullAccess, permissoes, isAdmin,
 *   entityType, entityId, entityNome
 * }
 * @type {object|null}
 */
export let currentUser = null;

// Exposição global para compatibilidade com script inline
window.currentUser = currentUser;

// ── auditLog ─────────────────────────────────────────────────────────────────

/**
 * Registra uma ação no audit_log.
 * Non-blocking: erros são silenciados para não interromper o fluxo principal.
 * @param {string} acao    — Ação realizada (ex: 'login', 'Editou laboratório')
 * @param {string} [detalhe=''] — Detalhes adicionais (truncado em 300 chars)
 */
export async function auditLog(acao, detalhe = '') {
  const entry = {
    ts:      new Date().toISOString(),
    usuario: currentUser?.login || 'sistema',
    acao,
    detalhe: detalhe.slice(0, 300),
  };
  try { await dbAdd('audit_log', entry); } catch (_) { /* non-blocking */ }
}

// Registra o hook de auditoria no módulo db.js para que dbAddLogged,
// dbPutLogged e dbDeleteLogged possam chamar auditLog sem importar auth.js.
setAuditHook(auditLog);

// ── RLS — Row-Level Security ─────────────────────────────────────────────────

/**
 * Filtra a lista de clientes de acordo com o vínculo de entidade do usuário logado.
 *
 * Regras:
 *  - fullAccess (Supervisor)  → sem filtro, retorna todos
 *  - sem vínculo (entityType null) → retorna todos (acesso global)
 *  - entityType 'representante'    → clientes com fk_representante === entityId
 *  - entityType 'assessor'         → clientes com assessor === entityNome
 *  - entityType 'supervisor'       → clientes cujos representantes têm supervisor === entityNome
 *
 * @param {object[]} clientes — Array completo de clientes da store
 * @param {object[]} [reps=[]] — Array de representantes (necessário para filtro supervisor)
 * @returns {object[]}
 */
export function applyDataFilter(clientes, reps = []) {
  if (!currentUser || currentUser.fullAccess) return clientes;
  const { entityType, entityId, entityNome } = currentUser;
  if (!entityType || !entityId) return clientes; // sem vínculo → acesso global

  if (entityType === 'representante') {
    return clientes.filter(c => String(c.fk_representante) === String(entityId));
  }
  if (entityType === 'assessor') {
    return clientes.filter(c => c.assessor === entityNome);
  }
  if (entityType === 'supervisor') {
    // Supervisor vê todos os clientes dos representantes que ele supervisiona
    const repIds = new Set(
      reps.filter(r => r.supervisor === entityNome).map(r => String(r.id))
    );
    return clientes.filter(c => repIds.has(String(c.fk_representante)));
  }
  return clientes;
}

/**
 * Gera o HTML do banner de contexto RLS exibido no topo das páginas quando
 * o usuário tem visão filtrada.
 * Retorna string vazia quando o filtro não está ativo.
 * @returns {string}
 */
export function rlsBanner() {
  if (!currentUser || currentUser.fullAccess || !currentUser.entityType) return '';
  const labels = {
    representante: 'Representante',
    supervisor:    'Supervisor',
    assessor:      'Assessor',
  };
  return `<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;background:rgba(15,155,148,.08);
    border:1px solid rgba(15,155,148,.25);border-radius:var(--r);margin-bottom:14px;font-size:12px">
    <span style="color:var(--accent2)">🔒</span>
    <span style="color:var(--text2)">Visão filtrada — <strong style="color:var(--accent2)">${labels[currentUser.entityType]}: ${currentUser.entityNome || currentUser.entityId}</strong>.
    Apenas dados vinculados a esta entidade são exibidos.</span>
  </div>`;
}

// ── ACL — Controle de Acesso ─────────────────────────────────────────────────

/**
 * Verifica se o usuário atual tem permissão de acesso a uma página.
 * @param {string} pageKey — Chave da página (ex: 'laboratorios')
 * @returns {boolean}
 */
export function canAccess(pageKey) {
  if (!currentUser) return false;
  if (currentUser.fullAccess) return true;
  return currentUser.permissoes[pageKey] !== false;
}

/**
 * Verifica se o usuário atual tem permissão para um botão específico.
 * A chave composta é `${pageKey}::${btnKey}`.
 * @param {string} pageKey — Chave da página (ex: 'laboratorios')
 * @param {string} btnKey  — Chave do botão (ex: 'edit-btn')
 * @returns {boolean}
 */
export function canBtn(pageKey, btnKey) {
  if (!currentUser) return false;
  if (currentUser.fullAccess) return true;
  const key = `${pageKey}::${btnKey}`;
  return currentUser.permissoes?.[key] !== false;
}

// ── Login / Logout ────────────────────────────────────────────────────────────

/**
 * Aplica as permissões de navegação ao componente <db-sidebar>.
 * Perfis com fullAccess veem todo o menu; os demais têm páginas ocultadas.
 * Depende de o sidebar já estar no DOM.
 */
export function applyNavPermissions() {
  if (!currentUser) return;
  if (currentUser.fullAccess) return; // fullAccess → sem restrições
  const hidden = Object.entries(currentUser.permissoes)
    .filter(([k, v]) => !k.includes('::') && v === false)
    .map(([k]) => k);
  document.getElementById('sidebar')?.hidePages(hidden);
}

/**
 * Executa o fluxo de login:
 *  1. Lê credenciais do formulário
 *  2. Valida contra a store 'usuarios'
 *  3. Carrega o perfil e monta currentUser
 *  4. Atualiza a UI (sidebar, visibilidade da tela de login)
 *  5. Navega para o dashboard
 *
 * Depende de funções globais: navigate() (router.js), applyNavPermissions()
 */
export async function doLogin() {
  const login = document.getElementById('login-user').value.trim().toLowerCase();
  const senha = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  if (!login || !senha) { errEl.textContent = 'Preencha login e senha.'; return; }

  const user = await dbGet('usuarios', login);
  if (!user || user.senha !== senha) {
    errEl.textContent = 'Login ou senha incorretos.';
    return;
  }

  // Carrega o perfil de acesso para obter as permissões
  const perfil = await dbGet('perfis_acesso', user.perfilId);

  currentUser = {
    login:      user.login,
    nome:       user.nome || user.login,
    perfilId:   user.perfilId,
    perfilNome: user.perfilNome || user.perfilId,
    fullAccess: perfil?.fullAccess ?? (user.perfilId === 'supervisor'),
    permissoes: perfil?.permissoes || {},
    isAdmin:    user.isAdmin || false,
    // RLS — vínculo de entidade
    entityType: user.entityType || null,
    entityId:   user.entityId   || null,
    entityNome: user.entityNome || null,
  };

  // Atualiza exposição global
  window.currentUser = currentUser;

  // Atualiza o pill de usuário no Web Component <db-sidebar>
  const sidebarEl = document.getElementById('sidebar');
  sidebarEl?.setUser({ nome: currentUser.nome, perfil: currentUser.perfilNome });

  // Aplica visibilidade do menu conforme ACL
  applyNavPermissions();

  // Exibe o app, oculta a tela de login
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main').style.display = '';
  if (sidebarEl) sidebarEl.style.display = '';

  await auditLog('login', `Acesso realizado pelo perfil ${currentUser.perfilNome}`);

  // navigate é declarado em router.js e exposto globalmente — chamado aqui
  // para não introduzir dependência circular auth → router.
  if (typeof window.navigate === 'function') window.navigate('dashboard');
}

/**
 * Executa o fluxo de logout:
 *  1. Registra a ação no audit_log
 *  2. Limpa currentUser
 *  3. Limpa o formulário de login
 *  4. Oculta o app, exibe a tela de login
 */
export function doLogout() {
  if (currentUser) auditLog('logout', 'Sessão encerrada');
  currentUser = null;

  // Atualiza exposição global
  window.currentUser = null;

  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').textContent = '';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('main').style.display    = 'none';

  const sidebarEl = document.getElementById('sidebar');
  if (sidebarEl) {
    sidebarEl.style.display = 'none';
    sidebarEl.setUser({ nome: '—', perfil: '—' });
  }
}

// ── Seed de dados iniciais ────────────────────────────────────────────────────

/**
 * Garante que o usuário administrador padrão exista no banco.
 * Chamado durante o boot, após initDB().
 * Credenciais padrão: login=admin / senha=qwerty@DB
 */
export async function initDefaultAdmin() {
  const existing = await dbGet('usuarios', 'admin');
  if (!existing) {
    await dbAdd('usuarios', {
      login:      'admin',
      nome:       'Administrador',
      senha:      'qwerty@DB',
      perfilId:   'supervisor',
      perfilNome: 'Supervisor',
      isAdmin:    true,
    });
  }
}
