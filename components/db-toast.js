/**
 * components/db-toast.js — Web Component para notificações toast
 *
 * FIX: a versão anterior e utils.js competiam pelo window.toast.
 * utils.js fazia document.getElementById('toast').appendChild(el) no light DOM,
 * mas os estilos .toast-item estão no Shadow DOM e não se aplicam ao light DOM.
 *
 * Solução:
 *   - show() appenda o elemento diretamente no shadowRoot (correto).
 *   - window.toast é redefinido AQUI (carregado por último na ordem do index.html).
 *   - utils.js define window.toast antes, mas db-toast.js sobrescreve após.
 *   - O index.html deve declarar db-toast.js DEPOIS de utils.js (já é o caso).
 */
(function () {
  'use strict';

  class DBToast extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
          }

          .toast-item {
            background: var(--bg2, #ffffff);
            border: 1px solid var(--border, #d4dbe6);
            border-radius: var(--r, 6px);
            padding: 12px 16px;
            font-size: 13px;
            color: var(--text, #1a2433);
            min-width: 240px;
            max-width: 360px;
            box-shadow: 0 8px 32px rgba(0, 55, 97, 0.15);
            animation: slideIn 0.22s ease;
            pointer-events: auto;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            line-height: 1.4;
          }

          .toast-item.success { border-left: 3px solid var(--accent, #0F9B94); }
          .toast-item.error   { border-left: 3px solid var(--red, #d63031); }
          .toast-item.info    { border-left: 3px solid var(--navy3, #004a80); }

          @keyframes slideIn {
            from { transform: translateX(50px); opacity: 0; }
            to   { transform: none; opacity: 1; }
          }
          @keyframes slideOut {
            from { transform: none; opacity: 1; }
            to   { transform: translateX(50px); opacity: 0; }
          }
        </style>
      `;
    }

    /**
     * Exibe um toast
     * @param {string} msg       - Mensagem a exibir
     * @param {string} type      - 'success' | 'error' | 'info'
     * @param {number} duration  - ms (padrão 4000)
     */
    show(msg, type, duration) {
      type     = type     || 'info';
      duration = duration || 4000;

      var el = document.createElement('div');
      el.className   = 'toast-item ' + type;
      el.textContent = msg;

      this.shadowRoot.appendChild(el);

      setTimeout(function () {
        if (el && el.parentNode) el.remove();
      }, duration);
    }
  }

  customElements.define('db-toast', DBToast);

  /* ── Redefine window.toast para usar o show() do componente ──
   * Esta atribuição acontece depois de utils.js (que também define window.toast),
   * garantindo que a versão correta (Shadow DOM) sempre vença.
   * A ordem no index.html deve ser: utils.js → db-toast.js
   */
  window.toast = function (msg, type, duration) {
    var el = document.getElementById('toast');
    if (el && typeof el.show === 'function') {
      el.show(msg, type, duration);
    } else {
      /* Fallback emergencial caso o componente não esteja no DOM */
      console.warn('toast:', msg);
    }
  };

})();
