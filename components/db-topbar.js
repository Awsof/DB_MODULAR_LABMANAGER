(function() {
  'use strict';

  class DBTopbar extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();
      this.setupEventListeners();
    }

    static get observedAttributes() {
      return ['title', 'subtitle'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue !== newValue) {
        this.render();
      }
    }

    get title() {
      return this.getAttribute('title') || '';
    }

    set title(value) {
      this.setAttribute('title', value);
    }

    get subtitle() {
      return this.getAttribute('subtitle') || '';
    }

    set subtitle(value) {
      this.setAttribute('subtitle', value);
    }

    render() {
      const title = this.title;
      const subtitle = this.subtitle;

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            background: var(--bg2, #ffffff);
            border-bottom: 1px solid var(--border, #d4dbe6);
            padding: 14px 28px;
            box-shadow: 0 1px 4px rgba(0,55,97,.06);
          }

          .topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .topbar-left {
            display: flex;
            flex-direction: column;
          }

          .page-title {
            font-size: 18px;
            font-weight: 700;
            color: var(--navy, #003761);
          }

          .page-sub {
            font-size: 12px;
            color: var(--text3, #8a96a8);
            margin-top: 2px;
          }

          .topbar-right {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .topbar-right ::slotted(*) {
            /* Estilos para elementos slotted */
          }
        </style>

        <div class="topbar">
          <div class="topbar-left">
            <div class="page-title">${title}</div>
            <div class="page-sub">${subtitle}</div>
          </div>
          <div class="topbar-right">
            <slot name="actions"></slot>
          </div>
        </div>
      `;
    }

    setupEventListeners() {
      // Delegar eventos de clique nos botões para o componente pai
      this.addEventListener('click', (e) => {
        const target = e.target;
        const button = target.closest('button');
        if (button && button.id) {
          this.dispatchEvent(new CustomEvent('db-topbar-action', {
            detail: { action: button.id, element: button },
            bubbles: true,
            composed: true
          }));
        }
      });
    }
  }

  // Registrar o componente
  customElements.define('db-topbar', DBTopbar);

  // Expor globalmente para compatibilidade
  window.DBTopbar = DBTopbar;

})();