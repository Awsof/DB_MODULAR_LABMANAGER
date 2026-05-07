/**
 * components/db-modal.js — Web Component para modais
 *
 * ARQUITETURA (decisão §4 — Light DOM com slot):
 *   - Shadow DOM gerencia APENAS o backdrop/overlay e a janela externa (.modal-window).
 *   - O conteúdo HTML das páginas (.modal-header, .modal-body, .modal-footer) é
 *     injetado no LIGHT DOM via this._lightContainer, projetado pelo <slot>.
 *   - Isso permite que o CSS global do index.html (.two-col, .field-group, .btn etc.)
 *     alcance o conteúdo do modal normalmente — sem barreira de Shadow DOM.
 *
 * ESTILOS DO MODAL (§4):
 *   Os estilos de .modal-header, .modal-body, .modal-footer, .modal-title e
 *   .modal-close são injetados como um <style> global no <head> do documento
 *   (uma única vez, na primeira instância do componente). Isso garante que o
 *   CSS global do index.html e o CSS dos modais coexistam no mesmo escopo.
 *
 * API pública (§5 — compatibilidade retroativa):
 *   window.openModal(html, onClose?)
 *     → retorna this._lightContainer  ← overlay.querySelector('#save-ana') FUNCIONA
 *   window.closeModal()
 *     → fecha o modal
 *   modal.open(html, title?, onClose?)
 *   modal.close()
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════
   * ESTILOS GLOBAIS — injetados uma única vez no <head>
   * Cobrem: .modal-header, .modal-title, .modal-close,
   *         .modal-body, .modal-footer
   * O CSS global do index.html já define: .field-group, .field-label,
   * .two-col, .btn, .section-divider, inputs etc.
   * ══════════════════════════════════════════════════════════════════ */
  var MODAL_STYLE_ID = 'db-modal-global-styles';

  function injectModalStyles() {
    if (document.getElementById(MODAL_STYLE_ID)) return; // já injetado
    var style = document.createElement('style');
    style.id = MODAL_STYLE_ID;
    style.textContent = `
      /* ── Estrutura interna dos modais (light DOM) ── */
      .modal-header {
        padding: 16px 20px 14px;
        border-bottom: 2px solid var(--accent, #0F9B94);
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        background: var(--bg2, #ffffff);
        z-index: 1;
        border-radius: var(--r2, 10px) var(--r2, 10px) 0 0;
      }

      .modal-title {
        font-size: 15px;
        font-weight: 700;
        color: var(--navy, #003761);
        line-height: 1.3;
      }

      .modal-close {
        background: none;
        border: none;
        color: var(--text3, #8a96a8);
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        padding: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: color 0.15s, background 0.15s;
        flex-shrink: 0;
      }

      .modal-close:hover {
        color: var(--red, #d63031);
        background: rgba(214, 48, 49, 0.08);
      }

      .modal-body {
        padding: 20px;
        font-family: var(--font, 'Segoe UI', system-ui, sans-serif);
        font-size: 14px;
        color: var(--text, #1a2433);
      }

      .modal-footer {
        padding: 14px 20px;
        border-top: 1px solid var(--border, #d4dbe6);
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        border-radius: 0 0 var(--r2, 10px) var(--r2, 10px);
      }

      /* Conteúdo projectado via slot herda o fundo da janela */
      .modal-light-content {
        display: contents;
      }
    `;
    document.head.appendChild(style);
  }

  /* ══════════════════════════════════════════════════════════════════
   * WEB COMPONENT
   * ══════════════════════════════════════════════════════════════════ */
  class DBModal extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._isOpen         = false;
      this._onClose        = null;
      this._lightContainer = null;
    }

    connectedCallback() {
      injectModalStyles();   // garante CSS global dos modais
      this._renderShell();
      this._buildLightContainer();
    }

    /* ── Shadow DOM: backdrop + janela externa + <slot> ── */
    _renderShell() {
      this.shadowRoot.innerHTML = `
        <style>
          /* O host controla visibilidade via atributo [open] */
          :host {
            display: none;
          }
          :host([open]) {
            display: contents;
          }

          /* Fundo escurecido */
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 55, 97, 0.48);
            z-index: 200;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            animation: fadeIn 0.15s ease;
          }

          /* Janela branca que envolve o slot (light DOM projetado) */
          .modal-window {
            background: var(--bg2, #ffffff);
            border: 1px solid var(--border, #d4dbe6);
            border-radius: var(--r2, 10px);
            width: 100%;
            max-width: 680px;
            max-height: 88vh;
            overflow-y: auto;
            box-shadow: 0 24px 60px rgba(0, 55, 97, 0.22);
            animation: slideUp 0.2s ease;
            position: relative;
          }

          /* ::slotted projeta o light DOM sem estilo extra */
          ::slotted(.modal-light-content) {
            display: contents;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to   { transform: none; opacity: 1; }
          }
        </style>

        <div class="modal-overlay" id="overlay">
          <div class="modal-window">
            <slot></slot>
          </div>
        </div>
      `;

      /* Fechar ao clicar no backdrop */
      this.shadowRoot.getElementById('overlay').addEventListener('click', (e) => {
        if (e.target === this.shadowRoot.getElementById('overlay')) {
          this.close();
        }
      });

      /* Fechar com Escape */
      this._escHandler = (e) => {
        if (e.key === 'Escape' && this._isOpen) this.close();
      };
      document.addEventListener('keydown', this._escHandler);
    }

    /* ── Light DOM container — querySelector das páginas funciona aqui ── */
    _buildLightContainer() {
      if (this._lightContainer) return;
      var div = document.createElement('div');
      div.className = 'modal-light-content';
      this.appendChild(div);
      this._lightContainer = div;
    }

    /* ────────────────────────────────────────────────────────────────
     * open(html, title?, onClose?)
     *
     * Aceita três padrões de chamada:
     *   open(html)
     *   open(html, onCloseFn)           ← pages antigas
     *   open(html, 'Título', onCloseFn) ← API nova
     *
     * Quando o HTML já contém .modal-header embutido (padrão atual de
     * todas as páginas), o parâmetro `title` é ignorado silenciosamente.
     * ──────────────────────────────────────────────────────────────── */
    open(html, title, onClose) {
      if (!this._lightContainer) this._buildLightContainer();

      /* Normaliza: open(html, onCloseFn) */
      if (typeof title === 'function') {
        onClose = title;
        title   = null;
      }

      /* Injeta o HTML no light DOM */
      if (typeof html === 'string') {
        this._lightContainer.innerHTML = html;
      }

      this._onClose = typeof onClose === 'function' ? onClose : null;
      this.setAttribute('open', '');
      this._isOpen = true;

      /* Foca o primeiro input ou botão para acessibilidade */
      requestAnimationFrame(() => {
        var firstInput = this._lightContainer.querySelector(
          'input:not([type="hidden"]):not([readonly]), select, textarea'
        );
        if (firstInput) firstInput.focus();
      });
    }

    /* Fecha o modal e limpa o light DOM */
    close() {
      this.removeAttribute('open');
      this._isOpen = false;

      /* Limpa conteúdo após a animação de saída (150 ms) */
      setTimeout(() => {
        if (this._lightContainer) this._lightContainer.innerHTML = '';
      }, 150);

      if (typeof this._onClose === 'function') {
        var cb = this._onClose;
        this._onClose = null;
        cb();
      }
    }

    disconnectedCallback() {
      if (this._escHandler) {
        document.removeEventListener('keydown', this._escHandler);
      }
    }

    get isOpen() { return this._isOpen; }
  }

  if (!customElements.get('db-modal')) {
    customElements.define('db-modal', DBModal);
  }

  /* ══════════════════════════════════════════════════════════════════
   * COMPATIBILIDADE GLOBAL (§5 — decisão arquitetural)
   *
   * window.openModal(html, onClose?)
   *   → modal.open(html, onClose)
   *   → retorna this._lightContainer
   *      As páginas fazem: const overlay = openModal(...);
   *                        overlay.querySelector('#save-ana')  ✓
   *
   * window.closeModal()
   *   → modal.close()
   * ══════════════════════════════════════════════════════════════════ */
  window.openModal = function (html, onClose) {
    var modal = document.getElementById('modal');
    if (!modal) {
      console.error('[db-modal] <db-modal id="modal"> não encontrado no DOM.');
      return document.body;
    }
    modal.open(html, onClose);
    return modal._lightContainer;
  };

  window.closeModal = function () {
    var modal = document.getElementById('modal');
    if (modal && typeof modal.close === 'function') modal.close();
  };

})();
