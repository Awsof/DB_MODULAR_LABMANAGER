/**
 * core/router.js — Roteador de páginas (SPA client-side)
 *
 * Responsabilidades:
 *  - Manter o registro de páginas disponíveis (objeto `pages`)
 *  - Executar a navegação (navigate), incluindo banner RLS e atualização do sidebar
 *  - Expor navigate() como window.navigate para compatibilidade com chamadas
 *    em linha (onclick="navigate('...')") existentes nas páginas ainda não modularizadas
 *
 * Padrão de exportação: ES Module (export nomeado) + window.navigate (global)
 *
 * Dependências:
 *  - core/auth.js → canAccess, rlsBanner
 *
 * Nota sobre `pages`:
 *  O objeto pages é preenchido em cada arquivo de página (pages/*.js) com
 *  a sintaxe:  import { pages } from '../core/router.js'; pages.dashboard = async () => {...}
 *  Durante a FASE 1, as funções de página ainda residem no index.html e atribuem
 *  ao mesmo objeto após importá-lo via window.pages (compatibilidade).
 *
 * Referência de arquitetura: DB_LAB_MANAGER_PROJECT.md §4
 */

import { canAccess, rlsBanner } from './auth.js';

// ── Registro de páginas ───────────────────────────────────────────────────────

/**
 * Mapa de páginas disponíveis.
 * Chave: string igual ao atributo data-page do nav-item.
 * Valor: função async () => void que renderiza a página em #content.
 * @type {Record<string, Function>}
 */
export const pages = {};

/** Página atualmente ativa. */
export let currentPage = '';

// ── Páginas que NÃO exibem o banner RLS ──────────────────────────────────────
// Páginas sem dados de cliente filtráveis não precisam do banner de contexto RLS.
const NO_BANNER_PAGES = new Set([
  'importacao',
  'perfis_acesso',
  'sistemas',
  'analistas',
  'supervisores',
  'grupos_matrizes',
]);

// ── navigate ─────────────────────────────────────────────────────────────────

/**
 * Navega para uma página registrada.
 *
 * Fluxo:
 *  1. Delega a atualização do item ativo ao Web Component <db-sidebar>
 *  2. Injeta (ou limpa) o banner RLS em #rls-global-banner
 *  3. Chama a função de renderização pages[page]()
 *
 * @param {string} page — Chave da página (ex: 'dashboard', 'laboratorios')
 */
export function navigate(page) {
  // Atualiza o item ativo no sidebar via API pública do Web Component
  const sidebarEl = document.getElementById('sidebar');
  if (sidebarEl) sidebarEl.activePage = page;

  currentPage = page;

  if (pages[page]) {
    // Injeta o banner RLS antes de renderizar a página
    const bannerEl = document.getElementById('rls-global-banner');
    if (bannerEl) {
      bannerEl.innerHTML = NO_BANNER_PAGES.has(page) ? '' : rlsBanner();
    }
    pages[page]();
  }
}

// ── Exposição global para compatibilidade ─────────────────────────────────────
// Funções de página que ainda residem no index.html chamam navigate() de forma
// direta ou por onclick inline. Ao expor via window, garantimos que essas
// chamadas continuem funcionando sem modificar cada página individualmente.
window.navigate = navigate;

// Também expõe pages para que o bloco <script> do index.html possa continuar
// registrando páginas na FASE 1 sem precisar importar este módulo.
window.pages = pages;
