/**
 * core/router.js — Roteador de páginas (SPA client-side)
 *
 * PADRÃO: Script clássico carregado via <script src="core/router.js" defer>.
 * Depende de core/auth.js (deve ser carregado antes).
 * Registra navigate() e pages em window.*.
 *
 * O objeto `pages` é o mesmo registrado em window.pages — o script inline
 * do index.html escreve nele diretamente (pages.dashboard = ...) e o
 * navigate() o acessa para chamar a função correta.
 *
 * Dependências: window.rlsBanner, window.currentUser (de auth.js)
 */
(function (global) {
  'use strict';

  // ── Registro de páginas ────────────────────────────────────────────────────
  // O mesmo objeto é compartilhado por window.pages e pelo navigate() abaixo.
  // O script inline atribui a este objeto: pages.dashboard = async function(){...}
  var pages = {};

  // Página atualmente ativa
  var currentPage = '';

  // Páginas sem banner RLS (sem dados de cliente filtráveis)
  var NO_BANNER_PAGES = new Set([
    'importacao', 'perfis_acesso', 'sistemas',
    'analistas', 'supervisores', 'grupos_matrizes',
  ]);

  // ── navigate ────────────────────────────────────────────────────────────────
  function navigate(page) {
    // Atualiza o item ativo no sidebar via API pública do Web Component
    var sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) sidebarEl.activePage = page;

    currentPage = page;

    // Injeta ou limpa o banner RLS
    var bannerEl = document.getElementById('rls-global-banner');
    if (bannerEl) {
      bannerEl.innerHTML = NO_BANNER_PAGES.has(page)
        ? ''
        : (typeof global.rlsBanner === 'function' ? global.rlsBanner() : '');
    }

    // Chama a função de renderização da página
    if (typeof pages[page] === 'function') {
      pages[page]();
    }
  }

  // ── Registro em window ──────────────────────────────────────────────────────
  global.pages       = pages;
  global.navigate    = navigate;
  global.currentPage = currentPage;

}(window));
