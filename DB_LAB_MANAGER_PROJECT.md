# DB Lab Manager — Documentação do Projeto

> **Versão atual:** index.html + core/ (4 módulos IIFE clássicos) + components/ (4 Web Components: topbar, login, toast, modal) + pages/ (dashboard, laboratórios, representantes, assessores, supervisores, analistas, sistemas, grupos_matrizes, dashboard_financeiro, dashboard_comercial, importacao, divergencias, propostas, pacotes, perfis_acesso extraídos) + import/ (3 módulos de engines) — **FASE 3 concluída, FASE 4 em progresso**

---

## 1. Visão Geral do Sistema

O DB Lab Manager é uma aplicação web **single-file** (monolítica em transição para modular) que gerencia o relacionamento comercial e técnico entre o **Grupo DB — Diagnósticos do Brasil** e seus laboratórios clientes. Opera 100% no browser, sem backend, usando IndexedDB como banco de dados local.

### Fluxo principal

```
Importação de planilhas → Cadastro de laboratórios → Registro de chamados de integração
       ↓
Cruzamento com Base de Envio → Divergências → Dashboards gerenciais → Propostas / Pacotes
```

---

## 2. Regras de Negócio Embutidas no Código

### 2.1 Tipos de Envio e sua Classificação

Os tipos de envio são classificados em três grupos semânticos usados em toda a aplicação:

| Grupo | Tipos | Significado |
|---|---|---|
| **Sem integração** | `DB FACIL`, `E-DB MANUAL`, `TOXICOLOGICO` | Envio manual — não requer chamado de integração |
| **Convencional (XML)** | `INTEGRACAO`, `E-DB INTEGRACAO` | Integração via arquivo XML/convencional |
| **Webservice (WS)** | `ETIQUETA PRIMARIA` | Integração via Webservice / etiqueta primária |

Definidos no código como constantes globais:
```js
const ENVIO_SEM_INT = new Set(['DB FACIL', 'E-DB MANUAL', 'TOXICOLOGICO']);
const ENVIO_CONV    = new Set(['INTEGRACAO', 'E-DB INTEGRACAO']);
const ENVIO_WS      = new Set(['ETIQUETA PRIMARIA']);
```

Na visualização (chips de cor), cada grupo tem cor distinta:
- **Convencional** → verde-água (`var(--accent2)`)
- **Webservice** → roxo (`var(--purple)`)
- **Demais** → cinza neutro

---

### 2.2 Status de Integração de um Laboratório

Calculado pela função `getIntStatus(chamados[])` com base nos chamados registrados:

| Status | Código | Condição |
|---|---|---|
| **Sem Integração** | `none` | Nenhum chamado registrado |
| **Em Implantação** | `impl` | Tem chamados, mas nenhum com `dataFinalizacao` preenchida |
| **Integração Inativada** | `inactive` | Tem chamados finalizados, mas nenhum com `integracaoAtiva = true` |
| **Integrado** | `active` | Pelo menos um chamado com `integracaoAtiva = true` |

A prioridade é: `active > impl > inactive > none`.

---

### 2.3 Regras de Divergência (Cruzamento Integração × Envio)

A página **Divergências** cruza os chamados de integração com a Base de Envio importada e identifica 4 categorias:

| # | Nome | Condição | Cor |
|---|---|---|---|
| DIV-1 | **Integração Ativa sem Envio** | `temIntAtiva = true` AND `enviandoQualquer = false` | Vermelho |
| DIV-2 | **Sem Integração enviando por Integração** | `temIntAtiva = false` AND `enviandoInt = true` | Âmbar |
| DIV-3 | **Divergência de Tipo** | `temIntAtiva = true` AND tipo do envio ≠ tipo do chamado ativo | Roxo |
| DIV-4 | **Mensalidade Ativa sem Envio** | `sistema.mensalidadeHabilitada = true` AND `enviandoQualquer = false` | Teal |

**DIV-3 em detalhe:**
- Chamado `CONVENCIONAL (XML)` + enviando `ETIQUETA PRIMARIA` → diverge
- Chamado `WEBSERVICE` + enviando `INTEGRACAO` ou `E-DB INTEGRACAO` → diverge

---

### 2.4 Regras de Importação

#### Base G5 (Clientes) — Frequência: Semanal
- **Chave primária:** campo `Código` (imutável)
- Representantes com nome vazio, `A DEFINIR` ou `COMERCIAL A DEFINIR` são ignorados
- Supervisores no formato `"REGIÃO - NOME"` são normalizados: apenas o nome, em Title Case
- **Processamento em dois passos:** primeiro as matrizes (sem `Cód. Matriz`), depois as filiais
- Campos editados manualmente no sistema (`_manual_*`) não são sobrescritos pela planilha
- Campos da planilha sempre atualizam os dados existentes nos demais campos

#### Base de Envio — Frequência: Quinzenal/Mensal
- **Separador:** ponto-e-vírgula (`;`), detectado automaticamente
- **Chave de agregação:** `DataInicial~DataFinal | Código | TipoEnvio`
- Quantidades somadas por cliente/tipo dentro do mesmo período
- Nova importação **apaga e substitui** inteiramente o período anterior (sem merge)
- Processamento em chunks de 50.000 linhas com `setTimeout(0)` para não bloquear a UI

#### Lista Esmeralda — Frequência: Mensal
- Cruzamento por `Código` com cadastro G5 existente (não cria clientes novos)
- `CATEGORIA`: `KAGEM` ou `BELMONT` → `Esmeralda` · `CHIVOR` → `Chivor`
- Assessores são criados automaticamente se não existirem na store
- Nunca sobrescreve dados da Base G5 (RazãoSocial, UF, Representante)

---

### 2.5 Programas Especiais: Esmeralda e Chivor

Clientes podem pertencer a programas especiais (campo `categoria_especial`):
- **Esmeralda** — badge verde-água com borda · fundo `rgba(15,155,148,.13)`
- **Chivor** — badge roxo com borda · fundo `rgba(108,92,231,.14)`

Renderizado pela função `programaBadge(categoria)`.

---

### 2.6 Visualização Personalizada por Perfil (RLS)

O sistema aplica **Row-Level Security** no frontend, filtrando os dados exibidos conforme o vínculo do usuário logado:

| Tipo de Usuário | Visualiza |
|---|---|
| `fullAccess` (Supervisor) | Todos os clientes — sem filtro |
| `representante` | Apenas clientes com `fk_representante === entityId` |
| `assessor` | Apenas clientes com `assessor === entityNome` |
| `supervisor` | Clientes cujo representante tem `supervisor === entityNome` |

Um banner visual aparece no topo de cada página quando filtro está ativo.  
O filtro é aplicado pela função `applyDataFilter(clientes, reps)` em todas as páginas que listam clientes.

---

### 2.7 Sistema de Permissões por Perfil (ACL)

Dois níveis de controle:
1. **Página** — visibilidade no menu e acesso à rota
2. **Botão** — visibilidade de ações específicas (ex: `laboratorios::edit-btn`)

Perfis padrão: `Supervisor` (fullAccess), `Representante`, `Analistas`, `Analistas Sênior`, `Estagiário`, `Financeiro`.

Funções de verificação:
```js
canAccess(pageKey)           // retorna boolean
canBtn(pageKey, btnKey)      // retorna boolean
```

---

### 2.8 Regras de Chamados de Integração

Cada laboratório pode ter múltiplos chamados. Regras aplicadas:
- Múltiplos sistemas ativos → aviso ao registrar novo chamado com sistema diferente
- Ao ativar integração, o `fk_sistema` do cliente é atualizado automaticamente (flag `_manual_fk_sistema = true`)
- Chamados sem `dataFinalizacao` = em implantação
- Chamados com `dataFinalizacao` mas `integracaoAtiva = false` = inativada
- O chamado mais recente por cliente define o status do analista no modal de visualização

---

### 2.9 Analistas: Cálculo de Prazo em Dias Úteis

No Dashboard de Integração (gráfico `prazo_analista`), o prazo é calculado entre `dataSolicitacao` e `dataFinalizacao` em **dias úteis** (segunda a sexta, sem considerar feriados), com média por analista.

---

### 2.10 Budget Anual Financeiro

- Definido por ano (`budget.ano`)
- Consumo = Propostas aprovadas (valor único) + Mensalidades × 12 + Pacotes aprovados no ano
- Barra de progresso muda de cor: verde → âmbar (>70%) → vermelho (>90%)

---

## 3. Estrutura do Banco de Dados (IndexedDB)

**Nome:** `dblabmanager` · **Versão:** 9

| Store | Chave | Índices | Descrição |
|---|---|---|---|
| `clientes` | `Codigo` (string) | UF, fk_representante, fk_sistema, assessor, categoria_especial | Laboratórios clientes |
| `representantes` | `id` (autoIncrement) | nome (unique) | Representantes comerciais |
| `assessores` | `id` (autoIncrement) | nome (unique) | Assessores do programa Esmeralda/Chivor |
| `supervisores` | `id` (autoIncrement) | nome (unique) | Supervisores comerciais |
| `analistas` | `id` (string, manual) | — | Analistas de implantação |
| `sistemas` | `id` (autoIncrement) | — | Sistemas laboratoriais integráveis |
| `chamados` | `id` (autoIncrement) | fk_cliente, analista, dataSolicitacao | Chamados de integração |
| `envios` | `id` (autoIncrement) | fk_cliente, tipoEnvio, periodo | Base de envio importada |
| `propostas` | `id` (autoIncrement) | fk_cliente, status | Propostas comerciais |
| `pacotes` | `id` (autoIncrement) | nome | Pacotes de implantação |
| `pacote_registros` | `id` (autoIncrement) | fk_pacote, fk_cliente | Laboratórios em cada pacote |
| `budget` | `ano` | — | Budget anual por exercício |
| `perfis_acesso` | `id` (string) | — | Perfis e suas permissões |
| `usuarios` | `login` (string) | perfilId, entityType | Usuários do sistema |
| `logs` | `id` (autoIncrement) | — | Histórico de importações G5 |
| `audit_log` | `id` (autoIncrement) | ts, usuario | Log de auditoria de ações |

---

## 4. Páginas e Funcionalidades

| Página | Rota (`data-page`) | RLS | Descrição |
|---|---|---|---|
| Dashboard Integração | `dashboard` | ✓ | Métricas + 4 gráficos dinâmicos (integração, UF, sistema, analista) |
| Dashboard Comercial | `dashboard_comercial` | ✓ | Gráficos + heatmap SVG do Brasil por UF |
| Dashboard Financeiro | `dashboard_financeiro` | — | Budget, propostas, mensalidades, pacotes |
| Laboratórios | `laboratorios` | ✓ | Tabela + filtros + modal edição + chamados inline |
| Representantes | `representantes` | — | CRUD de representantes |
| Assessores | `assessores` | — | Visualização Esmeralda/Chivor por assessor |
| Supervisores | `supervisores` | — | CRUD de supervisores |
| Analistas | `analistas` | — | CRUD com cargo, ID custom, modal de performance |
| Sistemas | `sistemas` | — | CRUD com tipo, configuração, métodos, financeiro |
| Grupos e Matrizes | `grupos_matrizes` | — | Consulta por grupo ou hierarquia matriz/filial |
| Divergências | `divergencias` | ✓ | Cruzamento integração × envio com 4 categorias |
| Propostas | `propostas` | — | CRUD de propostas com status e datas |
| Pacotes | `pacotes` | — | Pacotes de implantação com laboratórios vinculados |
| Importação | `importacao` | — | Upload G5, Envio, Esmeralda + histórico |
| Perfis de Acesso | `perfis_acesso` | — | ACL por perfil + gestão de usuários + audit log |

---

## 5. Modularização Realizada

### 5.1 Extração do Sidebar — Web Component (V25)

A primeira etapa de modularização extraiu o componente **Sidebar** do `index_V24.html` (monolítico, ~6.100 linhas) para um **Web Component nativo** (`<db-sidebar>`), criando a base da arquitetura modular.

**Arquivos gerados:**

```
db-lab-manager/
├── index_V25.html          ← documento host (monolítico, em processo de desmonte)
└── components/
    └── db-sidebar.js       ← Web Component: <db-sidebar>
```

**Mudanças no `index_V25.html`:**
- Removido o bloco `<aside id="sidebar">` (87 linhas de HTML)
- Removidos os blocos CSS `/* SIDEBAR */` e `/* SIDEBAR USER PILL */`
- `<script src="./components/db-sidebar.js" defer>` adicionado no `<head>`
- `<db-sidebar id="sidebar">` no lugar do `<aside>`
- `doLogin()` → usa `sidebar.setUser({ nome, perfil })` em vez de `getElementById` internos
- `applyNavPermissions()` → usa `sidebar.hidePages([...])` em vez de `querySelectorAll('.nav-item')`
- BOOT → `document.addEventListener('db-navigate')` em vez de `querySelectorAll('.nav-item').forEach`
- Logout → `document.addEventListener('db-logout')` em vez de `getElementById('btn-logout')`

**API pública do `<db-sidebar>`:**

| Método / Atributo | Descrição |
|---|---|
| `active-page="dashboard"` | Atributo HTML — página ativa inicial |
| `user-name="Nome"` | Atributo HTML — nome do usuário |
| `user-perfil="Supervisor"` | Atributo HTML — perfil do usuário |
| `sidebar.setUser({ nome, perfil })` | Atualiza o pill de usuário |
| `sidebar.hidePages([...keys])` | Oculta itens de menu por ACL |
| `sidebar.activePage = 'labs'` | Setter — muda página ativa |
| Evento `db-navigate` | CustomEvent `{ detail: { page } }` — `composed: true` |
| Evento `db-logout` | CustomEvent `{ detail: { user } }` — `composed: true` |

**Lição aprendida (bug corrigido):**  
CSS Custom Properties dentro do Shadow DOM NÃO devem ser redeclaradas com `--navy: var(--navy, fallback)` — isso cria referência circular e o browser descarta a variável. O correto é usar diretamente `background: var(--navy, #003761)`, aproveitando a herança natural das CSS Custom Properties através da fronteira do Shadow DOM.

### 5.2 Fase 1 — Extração de Utilitários e Infraestrutura (V26) ✅ CONCLUÍDO

A segunda etapa extraiu toda a infraestrutura de suporte do `index_V25.html` para **4 módulos ES nativos** no diretório `core/`, eliminando 556 linhas do arquivo host.

**Arquivos gerados:**

```
db-lab-manager/
├── index_V26.html          ← documento host (5.451 linhas; ↓556 em relação ao V25)
└── core/
    ├── db.js               ← IndexedDB: initDB, dbAll/Get/Put/Add/Delete/Clear, dbAddLogged, dbPutLogged, dbDeleteLogged, setAuditHook
    ├── auth.js             ← Sessão: currentUser, doLogin, doLogout, auditLog, applyDataFilter, rlsBanner, canAccess, canBtn, applyNavPermissions, initDefaultAdmin
    ├── router.js           ← Roteador: pages, navigate, currentPage, NO_BANNER_PAGES
    └── utils.js            ← Utilitários: toast, openModal, closeModal, makeSortable, generateReport, normalizeSupervisor, programaBadge, getIntStatus, getIntStatusLabel, renderIntStatusBadge
```

**Mudanças no `index_V26.html`:**
- Adicionado `<script type="module">` que importa os 4 módulos antes do script inline
- Removidos os blocos DB, AUTH, utils e navigate do script inline
- BOOT refatorado: usa `initDB`, `doLogin`, `doLogout`, `canAccess`, `navigate` dos módulos
- Todos os símbolos dos módulos reexpostos via `window.*` para compatibilidade com código inline das páginas ainda não modularizadas
- `PERFIS_DEFAULT`, `buildDefaultPerms`, `ACL_STRUCTURE` e todas as `pages.*` permanecem inline (serão extraídos nas Fases 2 e 4)

**Estratégia de compatibilidade retroativa:**
- Módulos exportam via ES `export` E via `window.*` simultaneamente
- Isso garante zero quebra no código inline das páginas durante a migração incremental
- `router.js` expõe `window.navigate` e `window.pages` para que as páginas inline continuem registrando e navegando normalmente
- `auth.js` usa `window.navigate('dashboard')` no `doLogin()` para evitar dependência circular `auth → router`
- `db.js` aceita hook de auditoria via `setAuditHook(fn)` evitando dependência circular `db ← auth`

**Decisão técnica — quebra de ciclo db ↔ auth:**
`db.js` não pode importar `auth.js` (ciclo proibido em ES Modules síncronos). A solução adotada foi o padrão **dependency injection via setter**: `db.js` expõe `setAuditHook(fn)` e `auth.js` o chama logo após definir `auditLog`, injetando a função. Isso mantém `db.js` sem dependências e `auth.js` como único importador de `db.js`.

**Métricas (após correção de escopo — ver §5.3):**

| Arquivo | Linhas | Tamanho | Padrão |
|---|---|---|---|
| `core/db.js` | 227 | 9,7 KB | IIFE clássico |
| `core/auth.js` | 207 | 9,8 KB | IIFE clássico |
| `core/router.js` | 58 | 2,3 KB | IIFE clássico |
| `core/utils.js` | 205 | 10,1 KB | IIFE clássico |
| `index_V26.html` | 5.498 | 338 KB | host (rev3) |

---

### 5.3 Debug Fase 1 — Correção do Isolamento de Escopo ES Module (V26 → V26 rev2)

Após a entrega inicial da Fase 1 (V26), foi identificado que todas as páginas renderizavam em branco após o login. Análise do console apontou três bugs críticos interligados, todos com a mesma causa-raiz.

**Causa-raiz: isolamento de escopo do `<script type="module">`**

O padrão ES Module cria um escopo completamente isolado do escopo global da página. Mesmo atribuindo `window.X = fn` dentro de um módulo, o `<script>` clássico que precede ou executa em paralelo não encontra as funções porque:

1. **Bug 1 — Escopo das funções de página:** O `<script>` inline usa `pages`, `dbAll`, `dbGet`, `currentUser`, etc. diretamente pelo nome — variáveis que só existem no escopo do módulo ES. `window.pages` é atribuído, mas o script inline usa `pages` (sem `window.`).

2. **Bug 2 — Referência primitiva de `currentUser`:** ES Modules exportam o *valor* de `let currentUser` no momento da importação (`null`). Funções importadas como `canAccess` e `applyDataFilter` capturam esse `null` e nunca veem a reatribuição feita por `doLogin()`. O objeto `currentUser` do módulo e o `window.currentUser` ficam dessincronizados.

3. **Bug 3 — Tempo de execução:** O `<script type="module">` executa como `defer` automático (após o HTML ser parseado), mas em escopo separado. O `<script>` clássico inline executa no escopo global, podendo rodar antes do módulo ser resolvido e não encontrar as funções mesmo via `window.*`.

**Bug 4 — `pages is not defined` após migração para IIFE (V26 rev2 → rev3):**
Após a correção dos bugs 1–3, o console apontou `Uncaught ReferenceError: pages is not defined`. O `<script>` inline atribui `pages.dashboard = async function(){...}` no escopo top-level, que executa **imediatamente ao ser parseado** — antes que qualquer script `defer` (incluindo o `router.js`) execute. Dois erros encadeados:

1. O script inline não tinha `var pages = {}` — o `router.js` criava o objeto, mas chegava tarde (após o parse do inline)
2. O `router.js` criava seu próprio `pages = {}` local e o atribuía a `window.pages` — um objeto **diferente** do que o `navigate()` interno usava. Mesmo que chegasse a tempo, as funções de página estariam no `window.pages` e o `navigate()` chamaria um `pages` vazio.

**Solução adotada — IIFE + bridging + reutilização de window.pages**

Aplicadas em duas etapas:

*Etapa 1 (bugs 1–3):* Módulos reescritos como IIFE clássicos com `defer`.

*Etapa 2 (bug 4):* Duas correções cirúrgicas adicionais:
- Adicionado `var pages = {};` e `var currentPage = '';` no **topo do `<script>` inline**, antes de qualquer `pages.X = async function()`. Isso garante que o parse do script inline nunca falhe, mesmo sem os defer executados.
- `router.js` corrigido para **reutilizar** o `window.pages` existente: `var pages = global.pages || {};` seguido de `global.pages = pages;`. Isso garante que o `navigate()` interno e o script inline compartilhem **exatamente o mesmo objeto**.

**Solução adotada — IIFE com auto-registro `window.*`**

Os 4 módulos foram reescritos como **scripts clássicos IIFE** (`Immediately Invoked Function Expression`), carregados com `<script src defer>`, que:

- Executam no escopo global após o DOM estar pronto (graças a `defer`)
- Registram *todas* as funções e variáveis em `window.*` explicitamente
- Mantêm `currentUser` numa variável local de closure — todas as funções do módulo a acessam corretamente via closure, não por referência exportada
- Sincronizam `window.currentUser` manualmente em `doLogin()` e `doLogout()` para o código inline que lê a referência global

**Padrão de carregamento resultante no `index_V26.html`:**

```html
<head>
  <!-- Bibliotecas externas (síncronas) -->
  <script src="xlsx.full.min.js"></script>
  <script src="chart.umd.min.js"></script>
  <!-- Web Component -->
  <script src="./components/db-sidebar.js" defer></script>
  <!-- Módulos core — IIFE, carregados com defer em ordem -->
  <script src="./core/db.js"     defer></script>
  <script src="./core/auth.js"   defer></script>
  <script src="./core/router.js" defer></script>
  <script src="./core/utils.js"  defer></script>
</head>
<body>
  <!-- ... HTML ... -->
  <script>
    // Script inline das páginas — acessa window.* populado pelos módulos defer
    pages.dashboard = async function() { ... }
    // ...
    // BOOT — envolto em DOMContentLoaded para garantir que os defer já executaram
    document.addEventListener('DOMContentLoaded', function () {
      initDB().then(...);
    });
  </script>
</body>
```

**Lição documentada para fases seguintes:**

> Módulos ES (`type="module"`) e scripts clássicos (`<script>`) não compartilham escopo global. Para a Fase 1, onde as páginas ainda residem em script clássico inline, a abordagem IIFE com `window.*` é a única compatível sem reescrever todas as páginas. Quando as páginas forem extraídas para módulos próprios na Fase 4, a migração para `import/export` nativo poderá ser retomada.

---

---

## 6. Etapas de Modularização — To-Do List

### FASE 1 — Extração de utilitários e infraestrutura ✅ CONCLUÍDO (V26)

- [x] **`core/db.js`** — `initDB`, `dbAll`, `dbGet`, `dbPut`, `dbAdd`, `dbDelete`, `dbClear`, `dbAddLogged`, `dbPutLogged`, `dbDeleteLogged`, `setAuditHook`. Exportado como módulo ES. **Sem mudança de comportamento.**
- [x] **`core/auth.js`** — `currentUser`, `doLogin`, `doLogout`, `auditLog`, `applyDataFilter`, `rlsBanner`, `canAccess`, `canBtn`, `applyNavPermissions`, `initDefaultAdmin`. Depende de `core/db.js`.
- [x] **`core/router.js`** — `pages`, `navigate()`, `currentPage`, `NO_BANNER_PAGES`. Depende de `core/auth.js`. Expõe `window.navigate` e `window.pages` para compatibilidade retroativa.
- [x] **`core/utils.js`** — `toast()`, `openModal()`, `closeModal()`, `makeSortable()`, `generateReport()`, `normalizeSupervisor()`, `programaBadge()`, `getIntStatus()`, `getIntStatusLabel()`, `renderIntStatusBadge()`. Expõe todos via `window.*`.

---

### FASE 2 — Extração de motores de importação ✅ CONCLUÍDO (V27)

- [x] **`import-g5.js`** — `processImport()`, `IGNORE_REP`, `normalizeSupervisor()`, `downloadModeloCSV()`
- [x] **`import-envio.js`** — `processEnvioImport()`, `processEnvioImportStreaming()`, `downloadModeloEnvioCSV()`
- [x] **`import-esmeralda.js`** — `processEsmeraldaImport()`, `mapCategoriaEsmeralda()`
- [x] Constantes de classificação de envio: `ENVIO_SEM_INT`, `ENVIO_CONV`, `ENVIO_WS`, `getTipoIntExpected()`

**Alterações realizadas:**
- Criada pasta `import/` com 3 módulos JS (defer).
- Removidos ~323 linhas do script inline (blocos de engines + constantes).
- Adicionados scripts no `<head>`: `import-g5.js`, `import-envio.js`, `import-esmeralda.js`.
- Funções expostas via `window.*` para compatibilidade com chamadas no inline.
- Ordem de carregamento defer garante dependências (`db.js`, `utils.js`, `auth.js` antes dos imports).

---

### FASE 3 — Web Components de estrutura

**Análise das alterações necessárias:**

- [x] **`db-topbar.js`** — Extrair `<div class="topbar">`: título da página, subtítulo, botões de ação (`#topbar-actions`). Evento `db-topbar-action`.
  - **Estrutura atual:** HTML estático no index.html, manipulado via `document.getElementById('page-title').textContent`, `document.getElementById('page-sub').textContent`, `document.getElementById('topbar-actions').innerHTML`.
  - **Alterações:** Criar Web Component `<db-topbar>` que encapsula o HTML e expõe propriedades `title`, `subtitle`, `actions` (innerHTML). Disparar evento customizado `db-topbar-action` quando botões são clicados.
  - **Benefício:** Centraliza lógica de UI da topbar, facilita manutenção e reutilização.

- [x] **`db-login.js`** — Extrair `<div id="login-screen">` com lógica de login, validação e erro.
  - **Estrutura atual:** HTML estático no index.html, lógica de login em `core/auth.js` (funções `showLogin()`, `hideLogin()`, `login()`).
  - **Alterações:** Criar Web Component `<db-login>` que encapsula o HTML do formulário e a lógica de autenticação. Usar propriedades para estado (visível/oculto, erro) e eventos para comunicação (login-success, login-error).
  - **Benefício:** Separa completamente a UI de login do core de autenticação, permitindo testes isolados e reutilização.

- [x] **`db-toast.js`** — Extrair `<div id="toast">` e a função `toast()`.
  - **Estrutura atual:** HTML estático (`<div id="toast"></div>`), função `toast()` em `core/utils.js`.
  - **Alterações:** Criar Web Component `<db-toast>` que gerencia sua própria lista de toasts internamente. Expor método `show(msg, type, duration)` via propriedade ou evento. Remover `toast()` de utils.js.
  - **Benefício:** Encapsula estado e lógica dos toasts, evita manipulação direta do DOM global.

- [x] **`db-modal.js`** — Extrair `openModal()` / `closeModal()` como componente controlado.
  - **Estrutura atual:** Funções `openModal()` e `closeModal()` em `core/utils.js`, criam elementos dinamicamente no `#modal-container`.
  - **Alterações:** Criar Web Component `<db-modal>` que seja controlado por propriedades (open: boolean, content: string). Remover funções de utils.js, usar o componente diretamente no código.
  - **Benefício:** Torna modais declarativos e reutilizáveis, facilita testes e manutenção.

**Alterações no index.html:**
- ✅ Substituir `<div class="topbar">` por `<db-topbar id="topbar"></db-topbar>`.
- ✅ Substituir `<div id="login-screen">` por `<db-login id="login"></db-login>`.
- ✅ Substituir `<div id="toast"></div>` por `<db-toast id="toast"></db-toast>`.
- ✅ Substituir `<div id="modal-container"></div>` por `<db-modal id="modal"></db-modal>`.
- ✅ Remover estilos de `.modal-overlay`, `.modal`, `.modal-*` (agora em Shadow DOM).

- Adicionar scripts: `<script src="./components/db-topbar.js" defer></script>`, etc.

**Impacto:** Refatora UI para componentes Web, melhorando separação de responsabilidades. Código das páginas precisará ser ajustado para usar APIs dos componentes em vez de manipulação direta do DOM.

---

### FASE 4 — Extração de páginas (maior impacto, fazer uma por vez)

A estratégia será retirar uma página por vez, começando pela página de dashboard principal.

Cada página deve se tornar um módulo `pages/[nome].js` exportando uma função `async render(container)`.

- [x] **`pages/dashboard.js`** — Dashboard Integração (gráficos dinâmicos, métricas, relatório)
- [x] **`pages/dashboard-comercial.js`** — Dashboard Comercial (heatmap SVG, gráficos, filtro de período)
- [x] **`pages/dashboard-financeiro.js`** — Dashboard Financeiro (budget, propostas, gráficos)
- [x] **`pages/laboratorios.js`** — Lista + filtros + modal edição + chamados inline
- [x] **`pages/representantes.js`** — CRUD de representantes
- [x] **`pages/assessores.js`** — Visualização Esmeralda/Chivor
- [x] **`pages/supervisores.js`** — CRUD de supervisores
- [x] **`pages/analistas.js`** — CRUD + modal de performance
- [x] **`pages/sistemas.js`** — CRUD de sistemas
- [x] **`pages/grupos_matrizes.js`** — Consulta hierárquica
- [x] **`pages/divergencias.js`** — Motor de divergências + filtros
- [x] **`pages/propostas.js`** — CRUD de propostas
- [x] **`pages/pacotes.js`** — CRUD de pacotes + registros
- [x] **`pages/importacao.js`** — Upload + progresso + histórico
- [x] **`pages/perfis_acesso.js`** — ACL + usuários + audit log

---

### FASE 5 — Estrutura final do projeto

```
db-lab-manager/
├── index.html                     ← shell mínimo: <db-sidebar>, <db-topbar>, <main>
├── app.js                         ← boot: initDB → doLogin → navigate
│
├── core/                          ← módulos core (IIFE clássicos)
│   ├── db.js                      ← IndexedDB: dbAll, dbGet, dbPut, dbAdd, dbDelete
│   ├── auth.js                    ← login/logout, currentUser, auditLog
│   ├── router.js                  ← navigate(), pages object
│   └── utils.js                   ← makeSortable, generateReport, normalizeSupervisor, etc.
│
├── components/                    ← Web Components (Custom Elements)
│   ├── db-sidebar.js              ← navegação lateral
│   ├── db-topbar.js               ← ✅ Concluído (FASE 3)
│   ├── db-login.js                ← ✅ Concluído (FASE 3)
│   ├── db-toast.js                ← ✅ Concluído (FASE 3)
│   └── db-modal.js                ← ✅ Concluído (FASE 3)
│
├── import/                        ← engines de importação (IIFE clássicos)
│   ├── import-g5.js               ← processImport()
│   ├── import-envio.js            ← processEnvioImport(), processEnvioImportStreaming()
│   └── import-esmeralda.js        ← processEsmeraldaImport()
│
├── pages/                         ← módulos de páginas (ES modules)
│   ├── dashboard.js
│   ├── dashboard-comercial.js
│   ├── dashboard-financeiro.js
│   ├── laboratorios.js
│   ├── representantes.js
│   ├── assessores.js
│   ├── supervisores.js
│   ├── analistas.js
│   ├── sistemas.js
│   ├── grupos-matrizes.js
│   ├── divergencias.js
│   ├── propostas.js
│   ├── pacotes.js
│   ├── importacao.js
│   └── perfis_acesso.js
│
└── DB_LAB_MANAGER_PROJECT.md       ← esta documentação
```
    ├── propostas.js               ← (Fase 4)
    ├── pacotes.js                 ← (Fase 4)
    ├── importacao.js              ← (Fase 4)
    └── perfis_acesso.js           ← (Fase 4)
```

---

### FASE 6 — Melhorias técnicas pós-modularização

- [x] Adicionar `type="module"` nos scripts (ES Modules nativos) — ✅ Concluído na Fase 1 (V26)
- [ ] Substituir `innerHTML` por `DocumentFragment` nas páginas de alta frequência de atualização (laboratorios, divergencias)
- [ ] Separar o CSS global em `styles/theme.css` (variáveis `:root`) e `styles/base.css` (reset + utilitários)
- [ ] Adicionar hash routing (`#dashboard`) para que o browser preserve a página ao recarregar
- [ ] Implementar paginação server-side simulada para clientes (atualmente carrega tudo na memória)
- [ ] Adicionar export de dados (JSON backup / restore do IndexedDB)
- [ ] Implementar feriados nacionais no cálculo de dias úteis dos analistas

---

## 7. Decisões de Arquitetura

| Decisão | Justificativa |
|---|---|
| **Web Components nativos** (sem React/Vue) | O projeto já usa JS puro sem build step. Introduzir um framework criaria segunda camada de runtime sem ganho. |
| **Shadow DOM `mode: 'open'`** | Permite inspeção via `element.shadowRoot` durante a migração incremental. Mudança para `closed` fica para a Fase 5. |
| **CSS Custom Properties para theming** | Único mecanismo que herda através da fronteira do Shadow DOM. Garante que `--navy`, `--accent` etc. do `:root` funcionem dentro dos componentes. |
| **IIFE + `window.*` para módulos da Fase 1** | `<script type="module">` isola o escopo — `window.X` atribuído dentro de um módulo não é visível para scripts clássicos em tempo de execução. IIFE com `defer` garante ordem de carregamento e escopo global compartilhado, sem quebrar o código inline das páginas ainda não modularizadas. |
| **`CustomEvent` com `composed: true`** | Eventos dentro do Shadow DOM ficam presos. `composed: true` faz o evento cruzar a fronteira e ser capturado no `document` do host. |
| **IndexedDB sem biblioteca** | Mantém zero dependências externas além de XLSX.js e Chart.js. |
| **Migração incremental** | Cada fase mantém o sistema funcionando. Não há "big bang rewrite". O `index_V26.html` ancora as Fases 1–4 sem quebrar funcionalidade. A cada fase, menos código inline e mais módulos. |

---

*Documento atualizado em: maio de 2026 — Fase 1 concluída + debug completo (§5.3, 4 bugs) · DB Lab Manager — Diagnósticos do Brasil*
