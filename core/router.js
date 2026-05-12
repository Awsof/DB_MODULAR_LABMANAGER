/**
 * core/router.js — Roteador de páginas (SPA client-side)
 *
 * PADRÃO: Script clássico carregado via <script src="core/router.js" defer>.
 * Depende de core/auth.js (deve ser carregado antes).
 *
 * ESTRATÉGIA DE COMPATIBILIDADE:
 *  O <script> inline do index.html declara `var pages = {}` no topo para
 *  evitar ReferenceError durante o parse. As funções de página são atribuídas
 *  a esse objeto: pages.dashboard = async function() {...}
 *
 *  Este módulo (defer) executa DEPOIS do script inline ter sido parseado.
 *  Portanto window.pages já existe e já contém todas as funções de página.
 *  Reutilizamos o objeto existente — não criamos um novo — para que o
 *  navigate() enxergue as funções registradas pelo inline.
 *
 * Dependências: window.rlsBanner (auth.js)
 */
(function (global) {
  'use strict';

  // ── Reutiliza o objeto pages do script inline (já populado) ───────────────
  // Se window.pages já existe (declarado pelo inline), usamos ele.
  // Caso contrário, criamos (safety net para outros contextos de uso).
  var pages = global.pages || {};
  global.pages = pages;   // garante que window.pages aponta para o mesmo objeto

  // Páginas sem banner RLS
  var NO_BANNER_PAGES = new Set([
    'importacao', 'perfis_acesso', 'sistemas',
    'analistas', 'supervisores', 'grupos_matrizes',
  ]);

  // ── navigate ────────────────────────────────────────────────────────────────
  function navigate(page) {
    var sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) sidebarEl.activePage = page;

    // Set currentPage BEFORE updating hash to prevent hashchange loop
    global.currentPage = page;

    // 7A: persist navigation in URL hash
    if (global.location && global.location.hash.slice(1) !== page) {
      global.location.hash = page;
    }

    var bannerEl = document.getElementById('rls-global-banner');
    if (bannerEl) {
      bannerEl.innerHTML = NO_BANNER_PAGES.has(page)
        ? ''
        : (typeof global.rlsBanner === 'function' ? global.rlsBanner() : '');
    }

    if (typeof pages[page] === 'function') {
      pages[page]();
    }
  }

  // 7A: restore navigation on browser back/forward
  global.addEventListener('hashchange', function () {
    var page = global.location.hash.slice(1);
    if (!page || page === global.currentPage) return;
    if (typeof global.canAccess === 'function' && !global.canAccess(page)) return;
    if (typeof pages[page] !== 'function') return;
    navigate(page);
  });

  // ── Registro em window ──────────────────────────────────────────────────────
  global.navigate    = navigate;
  global.currentPage = global.currentPage || '';

}(window));
