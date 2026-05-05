/**
 * components/db-modal.js — Web Component para modais
 *
 * FIX CRÍTICO (botões não funcionavam):
 *   A versão anterior injetava o HTML no Shadow DOM via innerHTML do #content
 *   interno. As páginas (laboratorios.js, representantes.js etc.) fazem:
 *
 *       const overlay = openModal(`...html com #save-lab, #rep-nome...`);
 *       overlay.querySelector('#save-lab').addEventListener(...)
 *
 *   querySelector em Shadow DOM não é visível de fora. A solução correta é:
 *   - O HTML passado por openModal() vai para um container NO LIGHT DOM
 *     (filho direto do <db-modal>), chamado this._lightContainer.
 *   - O Shadow DOM gerencia apenas o overlay/backdrop visual.
 *   - overlay.querySelector('#save-lab') funciona porque está no light DOM.
 *
 * API pública (inalterada):
 *   window.openModal(html, onClose)  → retorna o lightContainer (querySelector funciona)
 *   window.closeModal()              → fecha o modal
 *   modal.open(html, title?, onClose?)
 *   modal.close()
 */
(function () {
  'use strict';

  class DBModal extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._isOpen   = false;
      this._onClose  = null;
      // Container no light DOM onde as páginas injetam seu HTML
      this._lightContainer = null;
    }

    connectedCallback() {
      this._renderShell();
      this._buildLightContainer();
    }

    /* ── Shadow DOM: apenas o backdrop + wrapper visual ── */
    _renderShell() {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: none;
          }
          :host([open]) {
            display: contents;
          }

          /* Overlay escurecido */
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

          /* Janela branca que envolve o slot (light DOM) */
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

          /* Slot projeta o light DOM (o HTML das páginas) */
          ::slotted(*) {
            display: block;
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

      /* Fechar ao clicar no fundo */
      this.shadowRoot.getElementById('overlay').addEventListener('click', (e) => {
        if (e.target === this.shadowRoot.getElementById('overlay')) {
          this.close();
        }
      });
    }

    /* ── Light DOM container: onde o HTML das páginas vai ── */
    _buildLightContainer() {
      if (this._lightContainer) return;
      const div = document.createElement('div');
      div.className = 'modal-light-content';
      div.style.cssText = 'display:contents';
      this.appendChild(div);
      this._lightContainer = div;
    }

    /* ─────────────────────────────────────────────────────
     * open(html, title?, onClose?)
     * ─────────────────────────────────────────────────────
     * `html` pode ser:
     *   - string de HTML completo (com .modal-header, .modal-body, etc.)
     *   - string sem título (compatível com openModal(html, onClose))
     * `title` é ignorado quando o HTML já tem .modal-header embutido.
     */
    open(html, title, onClose) {
      if (!this._lightContainer) this._buildLightContainer();

      /* Normaliza argumentos: open(html, onCloseFn) */
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
    }

    /* Fecha o modal e limpa o conteúdo */
    close() {
      this.removeAttribute('open');
      this._isOpen = false;
      if (this._lightContainer) this._lightContainer.innerHTML = '';
      if (typeof this._onClose === 'function') {
        const cb = this._onClose;
        this._onClose = null;
        cb();
      }
    }

    get isOpen() { return this._isOpen; }
  }

  customElements.define('db-modal', DBModal);

  /* ══════════════════════════════════════════════════════
   * COMPATIBILIDADE GLOBAL
   *
   * window.openModal(html, onClose)
   *   → chama modal.open(html, onClose)
   *   → retorna this._lightContainer  ← querySelector FUNCIONA aqui
   *
   * window.closeModal()
   *   → chama modal.close()
   * ══════════════════════════════════════════════════════ */
  window.openModal = function (html, onClose) {
    var modal = document.getElementById('modal');
    if (!modal) { console.error('openModal: <db-modal id="modal"> não encontrado'); return document.body; }
    modal.open(html, onClose);
    /* Retorna o light container — as páginas fazem overlay.querySelector('#save-lab') */
    return modal._lightContainer;
  };

  window.closeModal = function () {
    var modal = document.getElementById('modal');
    if (modal && typeof modal.close === 'function') modal.close();
  };

})();
