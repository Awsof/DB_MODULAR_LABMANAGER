/**
 * <db-sidebar> — Web Component (Custom Element v1 / Shadow DOM)
 *
 * Referências oficiais utilizadas:
 *  - Custom Elements: https://html.spec.whatwg.org/multipage/custom-elements.html
 *  - Shadow DOM:      https://dom.spec.whatwg.org/#shadow-trees
 *  - MDN Custom Elements Guide: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements
 *  - MDN Shadow DOM:  https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM
 *  - CSS Custom Properties (herança cross-shadow): https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties
 *
 * Uso:
 *   <db-sidebar active-page="dashboard"></db-sidebar>
 *
 * Eventos despachados (CustomEvent, bubbles + composed para cruzar o Shadow DOM):
 *   'db-navigate'  → detail: { page: String }
 *   'db-logout'    → detail: { user: String }
 *
 * Atributos observados (observedAttributes):
 *   active-page   — página ativa no menu (ex: "dashboard")
 *   user-name     — nome do usuário logado
 *   user-perfil   — perfil do usuário (ex: "Supervisor")
 *
 * API pública (métodos / propriedades):
 *   sidebar.activePage = 'laboratorios'  → atualiza o item ativo
 *   sidebar.setUser({ nome, perfil })    → atualiza o pill de usuário
 *   sidebar.hidePages([...keys])         → oculta nav-items por ACL
 */

class DbSidebar extends HTMLElement {

  // ── 1. Ciclo de vida: observedAttributes ──────────────────────────────────
  // A spec exige um getter estático para declarar quais atributos disparam
  // attributeChangedCallback. Sem isso, mudanças de atributo são ignoradas.
  // Ref: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#responding_to_attribute_changes
  static get observedAttributes() {
    return ['active-page', 'user-name', 'user-perfil'];
  }

  constructor() {
    // ── 2. super() obrigatório antes de qualquer acesso a `this` ──────────
    // Ref: https://html.spec.whatwg.org/multipage/custom-elements.html#custom-element-conformance
    super();

    // ── 3. Criação do Shadow Root (modo 'open') ───────────────────────────
    // 'open'  → shadow root acessível via element.shadowRoot (depuração, testes)
    // 'closed'→ encapsulamento hermético (inacessível externamente)
    // Escolhemos 'open' para permitir que o código legado do index.html
    // ainda possa inspecionar o componente durante a migração incremental.
    // Ref: https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow
    this._shadow = this.attachShadow({ mode: 'open' });

    // Estado interno
    this._activePage = '';
    this._hiddenPages = new Set();
  }

  // ── 4. Ciclo de vida: connectedCallback ───────────────────────────────────
  // Disparado quando o elemento é inserido no DOM. É aqui que fazemos
  // o primeiro render, equivalente a componentDidMount no React.
  // Ref: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#using_the_lifecycle_callbacks
  connectedCallback() {
    this._activePage = this.getAttribute('active-page') || 'dashboard';
    this._render();
    this._bindEvents();
  }

  // ── 5. Ciclo de vida: attributeChangedCallback ────────────────────────────
  // Chamado sempre que um dos atributos declarados em observedAttributes muda.
  // oldValue e newValue permitem diff reativo sem re-render completo.
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'active-page':
        this._activePage = newValue || 'dashboard';
        this._updateActiveItem();
        break;
      case 'user-name':
        this._updateUserPill();
        break;
      case 'user-perfil':
        this._updateUserPill();
        break;
    }
  }

  // ── 6. disconnectedCallback ───────────────────────────────────────────────
  // Limpeza de event listeners adicionados externamente ao Shadow Root.
  // Essencial para evitar memory leaks em SPAs.
  disconnectedCallback() {
    // Listeners internos ao Shadow DOM são coletados automaticamente
    // pelo GC junto com o elemento. Esta etapa é para listeners externos.
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  API PÚBLICA
  // ══════════════════════════════════════════════════════════════════════════

  set activePage(val) {
    this.setAttribute('active-page', val);
  }
  get activePage() {
    return this._activePage;
  }

  setUser({ nome, perfil }) {
    if (nome    !== undefined) this.setAttribute('user-name',   nome);
    if (perfil  !== undefined) this.setAttribute('user-perfil', perfil);
  }

  /** Oculta nav-items por ACL: sidebar.hidePages(['propostas', 'pacotes']) */
  hidePages(pageKeys = []) {
    this._hiddenPages = new Set(pageKeys);
    this._applyHiddenPages();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER INTERNO
  // ══════════════════════════════════════════════════════════════════════════

  _render() {
    // ── 7. CSS dentro do Shadow DOM ───────────────────────────────────────
    // Estilos definidos aqui são COMPLETAMENTE isolados do documento host.
    // O Shadow DOM cria um "scoping boundary":
    //   → Seletores externos NÃO vazam para dentro
    //   → Seletores internos NÃO vazam para fora
    // EXCETO: CSS Custom Properties (--var) herdam através da fronteira,
    // permitindo theming controlado pelo documento host.
    // Ref: https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties#inheritance_of_custom_properties
    //
    // :host → seleciona o próprio elemento customizado (<db-sidebar>)
    // Ref: https://developer.mozilla.org/en-US/docs/Web/CSS/:host
    this._shadow.innerHTML = `
      <style>
        /* ── :host define o box model do elemento customizado ── */
        :host {
          display: flex;
          flex-direction: column;
          width: 230px;
          min-width: 230px;
          height: 100vh;
          overflow: hidden;

          /* CSS Custom Properties são herdadas do :root do documento host
           * através da fronteira do Shadow DOM — sem redeclaração.
           * Os fallbacks abaixo garantem funcionamento standalone. */
          background: var(--navy, #003761);
          box-shadow: 2px 0 12px rgba(0,55,97,.18);
          font-family: var(--font, 'Segoe UI', system-ui, sans-serif);
          color: white;
        }

        /* ── LOGO ── */
        .logo {
          padding: 20px 18px 16px;
          border-bottom: 1px solid rgba(255,255,255,.1);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          flex-shrink: 0;
        }
        .logo-img {
          height: 34px;
          max-width: 170px;
          object-fit: contain;
          display: block;
        }
        .logo-text {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(255,255,255,.45);
          line-height: 1.3;
          padding-left: 2px;
        }

        /* ── NAV ── */
        nav {
          flex: 1;
          padding: 10px 0;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,.15) transparent;
        }
        nav::-webkit-scrollbar { width: 4px; }
        nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 2px; }

        .nav-section {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 2px;
          color: rgba(255,255,255,.35);
          padding: 14px 18px 5px;
          text-transform: uppercase;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 18px;
          color: rgba(255,255,255,.65);
          cursor: pointer;
          transition: background .15s, border-left-color .15s, color .15s;
          font-size: 13px;
          border-left: 3px solid transparent;
          margin: 1px 0;
          user-select: none;
        }
        .nav-item:hover {
          background: rgba(255,255,255,.08);
          color: white;
          border-left-color: rgba(15,155,148,.5);
        }
        .nav-item.active {
          background: rgba(15,155,148,.18);
          color: white;
          border-left-color: var(--accent);
        }
        .nav-item svg {
          width: 15px;
          height: 15px;
          flex-shrink: 0;
          opacity: .8;
          fill: currentColor;
        }
        .nav-item.active svg { opacity: 1; }
        .nav-item[hidden] { display: none !important; }

        /* ── USER PILL ── */
        .sidebar-user-pill {
          padding: 12px 18px;
          border-top: 1px solid rgba(255,255,255,.1);
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-shrink: 0;
        }
        .sidebar-user-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sidebar-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(255,255,255,.15);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .sidebar-user-name   { font-size: 12px; font-weight: 600; color: white; }
        .sidebar-user-perfil { font-size: 10px; color: rgba(255,255,255,.5); }

        .db-badge {
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.15);
          border-radius: var(--r, 6px);
          padding: 7px 10px;
          font-size: 11px;
          color: rgba(255,255,255,.5);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .db-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          flex-shrink: 0;
        }

        .btn-logout {
          width: 100%;
          padding: 6px;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.15);
          border-radius: var(--r, 6px);
          color: rgba(255,255,255,.7);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: background .15s, border-color .15s, color .15s;
          text-align: center;
          font-family: var(--font);
        }
        .btn-logout:hover {
          background: rgba(214,48,49,.3);
          border-color: rgba(214,48,49,.4);
          color: white;
        }
      </style>

      <!-- ── LOGO ── -->
      <div class="logo">
        <img class="logo-img" alt="Grupo DB" src="${DbSidebar._LOGO_BASE64}">
        <div class="logo-text">Lab Manager</div>
      </div>

      <!-- ── NAVEGAÇÃO ── -->
      <nav>
        <div class="nav-section">Visão Geral</div>

        <div class="nav-item" data-page="dashboard">
          <svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
          Dashboard Integração
        </div>
        <div class="nav-item" data-page="dashboard_comercial">
          <svg viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
          Dashboard Comercial
        </div>
        <div class="nav-item" data-page="dashboard_financeiro">
          <svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
          Dashboard Financeiro
        </div>

      <!-- ── NAVEGAÇÃO ── -->
      <nav>
        <div class="nav-section">Visão Geral</div>

        <div class="nav-item" data-page="dashboard">
          <svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
          Dashboard Integração
        </div>
        <div class="nav-item" data-page="dashboard_comercial">
          <svg viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
          Dashboard Comercial
        </div>
        <div class="nav-item" data-page="dashboard_financeiro">
          <svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
          Dashboard Financeiro
        </div>

        <div class="nav-section">Ecossistema Técnico</div>

        <div class="nav-item" data-page="laboratorios">
          <svg viewBox="0 0 24 24"><path d="M19.8 18.4L14 10.67V6h1c.55 0 1-.45 1-1s-.45-1-1-1H9c-.55 0-1 .45-1 1s.45 1 1 1h1v4.67L4.2 18.4C3.71 19.06 4.18 20 5 20h14c.82 0 1.29-.94.8-1.6z"/></svg>
          Laboratórios
        </div>
        <div class="nav-item" data-page="sistemas">
          <svg viewBox="0 0 24 24"><path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/></svg>
          Sistemas
        </div>
        <div class="nav-item" data-page="chamados">
          <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"/></svg>
		Chamados
		</div>
        <div class="nav-item" data-page="grupos_matrizes">
          <svg viewBox="0 0 24 24"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
          Grupos e Matrizes
        </div>

        <div class="nav-section">Equipe DB</div>

        <div class="nav-item" data-page="analistas">
          <svg viewBox="0 0 24 24"><path d="M9 11.75A1.25 1.25 0 1 0 9 14.25 1.25 1.25 0 0 0 9 11.75zm6 0A1.25 1.25 0 1 0 15 14.25 1.25 1.25 0 0 0 15 11.75zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-.29.02-.58.05-.86 2.36-1.05 4.23-2.98 5.21-5.37a9.974 9.974 0 0 0 7.42 3.26c.02.32.04.64.04.97 0 4.41-3.59 8-8 8z"/></svg>
          Analistas
        </div>
        <div class="nav-item" data-page="representantes">
          <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          Representantes
        </div>
        <div class="nav-item" data-page="assessores">
          <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1.5c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5V18c0-2.66-5.33-4-8-4z"/></svg>
          Assessores
        </div>
        <div class="nav-item" data-page="supervisores">
          <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93C9.33 17.79 7 14.5 7 11V7.18L12 5z"/></svg>
          Supervisores
        </div>
        <div class="nav-item" data-page="gerentes">
          <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
		Gerentes
        </div>

        <div class="nav-section">Análise</div>

        <div class="nav-item" data-page="divergencias">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          Divergências
        </div>

        <div class="nav-section">Financeiro</div>

        <div class="nav-item" data-page="propostas">
          <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
          Propostas
        </div>
        <div class="nav-item" data-page="pacotes">
          <svg viewBox="0 0 24 24"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
          Pacotes
        </div>

        <div class="nav-section">Análise</div>

        <div class="nav-item" data-page="divergencias">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          Divergências
        </div>

        <div class="nav-section">Financeiro</div>

        <div class="nav-item" data-page="propostas">
          <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
          Propostas
        </div>
        <div class="nav-item" data-page="pacotes">
          <svg viewBox="0 0 24 24"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
          Pacotes
        </div>

        <div class="nav-section">Operações</div>

        <div class="nav-item" data-page="importacao">
          <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          Importação
        </div>
        <div class="nav-item" data-page="perfis_acesso">
          <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
          Perfis de acesso e usuários
        </div>
      </nav>

      <!-- ── USER PILL ── -->
      <div class="sidebar-user-pill">
        <div class="sidebar-user-info">
          <div class="sidebar-avatar" id="sb-avatar">?</div>
          <div>
            <div class="sidebar-user-name"   id="sb-user-name">—</div>
            <div class="sidebar-user-perfil" id="sb-user-perfil">—</div>
          </div>
        </div>
        <div class="db-badge">
          <div class="db-dot"></div>
          <span>IndexedDB local</span>
        </div>
        <button class="btn-logout" id="sb-logout">⏻ Sair</button>
      </div>
    `;

    // Aplica estado inicial
    this._updateActiveItem();
    this._updateUserPill();
    this._applyHiddenPages();
  }

  // ── 8. Delegação de eventos dentro do Shadow DOM ──────────────────────────
  // Um único listener no <nav> captura todos os cliques nos .nav-item via
  // event bubbling. Esta técnica é idêntica à usada fora do Shadow DOM, mas
  // eventos NÃO saem do Shadow DOM automaticamente — apenas eventos compostos
  // (composed: true) cruzam a fronteira.
  // Ref: https://developer.mozilla.org/en-US/docs/Web/API/Event/composed
  _bindEvents() {
    const nav = this._shadow.querySelector('nav');
    nav.addEventListener('click', (e) => {
      const item = e.target.closest('[data-page]');
      if (!item) return;

      const page = item.dataset.page;

      // Despacha CustomEvent com composed: true para cruzar o Shadow DOM
      // e ser capturado pelo document/window do host.
      // Ref: https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent
      this.dispatchEvent(new CustomEvent('db-navigate', {
        detail: { page },
        bubbles:  true,   // sobe pelo DOM de shadow hosts
        composed: true,   // cruza a fronteira do Shadow DOM
      }));

      // Atualiza o item ativo via atributo (attributeChangedCallback cuida do resto)
      this.setAttribute('active-page', page);
    });

    this._shadow.getElementById('sb-logout').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('db-logout', {
        detail: { user: this.getAttribute('user-name') },
        bubbles:  true,
        composed: true,
      }));
    });
  }

  // ── Helpers de atualização parcial (sem re-render completo) ───────────────

  _updateActiveItem() {
    this._shadow.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === this._activePage);
    });
  }

  _updateUserPill() {
    const nome   = this.getAttribute('user-name')   || '—';
    const perfil = this.getAttribute('user-perfil') || '—';

    const avatarEl  = this._shadow.getElementById('sb-avatar');
    const nameEl    = this._shadow.getElementById('sb-user-name');
    const perfilEl  = this._shadow.getElementById('sb-user-perfil');

    if (avatarEl)  avatarEl.textContent  = nome !== '—' ? nome.charAt(0).toUpperCase() : '?';
    if (nameEl)    nameEl.textContent    = nome;
    if (perfilEl)  perfilEl.textContent  = perfil;
  }

  _applyHiddenPages() {
    this._shadow.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.hidden = this._hiddenPages.has(el.dataset.page);
    });
  }

  // ── Lazy-load: logo em Base64 (memoizado como propriedade estática) ───────
  // Evita duplicação da string longa a cada instância.
}

// ── 9. Registra o Custom Element ──────────────────────────────────────────────
// O nome DEVE conter um hífen (requisito da spec para evitar colisão com tags HTML nativas).
// Ref: https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
//
// customElements.define é idempotente apenas se o nome não foi registrado antes.
// O guard abaixo evita erros em ambientes com HMR (Hot Module Replacement).
if (!customElements.get('db-sidebar')) {
  // ── Logo DB (Base64 PNG inline — sem dependência de arquivo externo) ──────
  // Armazenado como propriedade estática da classe para ser compartilhado
  // entre todas as instâncias sem duplicação de memória.
  DbSidebar._LOGO_BASE64 = 'data:image/png;base64,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';

  customElements.define('db-sidebar', DbSidebar);
}
