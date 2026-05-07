# DB Lab Manager — Documentação do Projeto

> **Versão atual:** index.html (shell mínimo) + core/ (4 módulos IIFE clássicos) + components/ (5 Web Components: sidebar, topbar, login, toast, modal) + pages/ (15 módulos de páginas extraídos) + import/ (3 engines de importação) — **FASE 1 ✅ · FASE 2 ✅ · FASE 3 ✅ · FASE 4 ✅ (revisão final concluída) · FASE 5 e 6 pendentes**

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

Definidos no código como constantes globais (em `import/import-envio.js`):
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

Calculado pela função `getIntStatus(chamados[])` (em `core/utils.js`) com base nos chamados registrados:

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

Renderizado pela função `programaBadge(categoria)` em `core/utils.js`.

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
O filtro é aplicado pela função `applyDataFilter(clientes, reps)` em `core/auth.js` em todas as páginas que listam clientes.

---

### 2.7 Sistema de Permissões por Perfil (ACL)

Dois níveis de controle:
1. **Página** — visibilidade no menu e acesso à rota
2. **Botão** — visibilidade de ações específicas (ex: `laboratorios::edit-btn`)

Perfis padrão: `Supervisor` (fullAccess), `Representante`, `Analistas`, `Analistas Sênior`, `Estagiário`, `Financeiro`.

Funções de verificação (em `core/auth.js`):
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

### 5.1 Extração do Sidebar — Web Component (V25) ✅

A primeira etapa de modularização extraiu o componente **Sidebar** do `index_V24.html` (monolítico, ~6.100 linhas) para um **Web Component nativo** (`<db-sidebar>`), criando a base da arquitetura modular.

**Arquivos gerados:**

```
db-lab-manager/
├── index.html              ← documento host (shell mínimo)
└── components/
    └── db-sidebar.js       ← Web Component: <db-sidebar>
```

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
CSS Custom Properties dentro do Shadow DOM NÃO devem ser redeclaradas com `--navy: var(--navy, fallback)` — isso cria referência circular. O correto é usar diretamente `background: var(--navy, #003761)`, aproveitando a herança natural das CSS Custom Properties através da fronteira do Shadow DOM.

---

### 5.2 Fase 1 — Extração de Utilitários e Infraestrutura (V26) ✅ CONCLUÍDO

**Arquivos gerados:**

```
db-lab-manager/
└── core/
    ├── db.js               ← IndexedDB: initDB, dbAll/Get/Put/Add/Delete/Clear,
    │                          dbAddLogged, dbPutLogged, dbDeleteLogged, setAuditHook
    ├── auth.js             ← Sessão: currentUser, doLogin, doLogout, auditLog,
    │                          applyDataFilter, rlsBanner, canAccess, canBtn,
    │                          applyNavPermissions, initDefaultAdmin
    ├── router.js           ← Roteador: pages, navigate, currentPage, NO_BANNER_PAGES
    └── utils.js            ← Utilitários: toast, openModal, closeModal, makeSortable,
                               generateReport, normalizeSupervisor, programaBadge,
                               getIntStatus, getIntStatusLabel, renderIntStatusBadge,
                               updateTopbar, downloadModeloCSV, downloadModeloEnvioCSV
```

**Padrão IIFE:** Todos os módulos `core/` usam o padrão IIFE clássico com `defer` (não ES Modules), registrando símbolos em `window.*` para compatibilidade com o script inline das páginas.

**Decisão técnica — quebra de ciclo db ↔ auth:**
`db.js` expõe `setAuditHook(fn)` e `auth.js` o chama após definir `auditLog`, injetando a função via dependency injection. Mantém `db.js` sem dependências e `auth.js` como único importador de `db.js`.

**Estratégia de compatibilidade retroativa:**
- `router.js` reutiliza `window.pages` existente: `var pages = global.pages || {};` — garantindo que o `navigate()` interno e o script inline compartilhem exatamente o mesmo objeto.
- BOOT envolto em `DOMContentLoaded` para garantir que os `defer` já executaram antes de chamar `initDB()`.

---

### 5.3 Debug Fase 1 — Correção do Isolamento de Escopo ES Module (V26 → V26 rev3) ✅

Quatro bugs críticos foram identificados e corrigidos durante a Fase 1:

**Bug 1** — Escopo das funções de página: o `<script>` inline usava `pages`, `dbAll` etc. diretamente, que só existem no escopo do módulo ES.

**Bug 2** — Referência primitiva de `currentUser`: módulos ES exportam o valor no momento da importação, nunca vendo reatribuições feitas por `doLogin()`.

**Bug 3** — Tempo de execução: `<script type="module">` executa como `defer` em escopo separado; código clássico poderia rodar antes.

**Bug 4** — `pages is not defined`: script inline atribui `pages.X` imediatamente ao ser parseado, antes de qualquer `defer` executar. Solução: `var pages = {};` no topo do script inline + `router.js` reutiliza `global.pages || {}`.

**Solução adotada:** IIFEs clássicos com `defer` + `window.*` explícito. Módulos ES descartados para os arquivos `core/`.

---

### 5.4 Fase 2 — Extração de Motores de Importação (V27) ✅ CONCLUÍDO

**Arquivos gerados:**

```
db-lab-manager/
└── import/
    ├── import-g5.js          ← processImport(), IGNORE_REP, downloadModeloCSV()
    ├── import-envio.js       ← processEnvioImport(), processEnvioImportStreaming(),
    │                            ENVIO_SEM_INT, ENVIO_CONV, ENVIO_WS, getTipoIntExpected()
    └── import-esmeralda.js   ← processEsmeraldaImport(), mapCategoriaEsmeralda()
```

Todos expostos via `window.*` para compatibilidade com código de página.

---

### 5.5 Fase 3 — Web Components de Estrutura ✅ CONCLUÍDO

**Arquivos gerados:**

```
db-lab-manager/
└── components/
    ├── db-sidebar.js    ← ✅ (V25)
    ├── db-topbar.js     ← ✅ Topbar com slot "actions", eventos db-topbar-action
    ├── db-login.js      ← ✅ Formulário de login, eventos db-login-submit,
    │                        métodos getCredentials(), setError(), reset(), focus()
    ├── db-toast.js      ← ✅ Notificações toast, método show(msg, type, duration),
    │                        compatibilidade via window.toast()
    └── db-modal.js      ← ✅ Modal declarativo, métodos open(html, onClose) e close(),
                             compatibilidade via window.openModal() e window.closeModal()
```

**Observação sobre `openModal` / `closeModal`:** Existe duplicação de implementação. `core/utils.js` ainda define `openModal()` e `closeModal()` apontando para `#modal-container` (elemento que não existe mais no HTML). A implementação canônica e ativa é a de `components/db-modal.js`, que registra as funções globais e delega ao `<db-modal id="modal">`. **A implementação em `utils.js` é código morto e deve ser removida na Fase 5.**

**`updateTopbar()` adicionada em `utils.js`:** Função helper que atualiza `title`, `subtitle` e o slot `actions` do `<db-topbar>`, usada por todas as páginas extraídas. Não foi prevista originalmente na documentação — emergiu durante a extração das páginas.

---

### 5.6 Fase 4 — Extração de Páginas ✅ CONCLUÍDO (com ressalvas — ver bugs conhecidos)

**Arquivos gerados:**

```
db-lab-manager/
└── pages/
    ├── dashboard.js              ← ✅ Dashboard Integração
    ├── dashboard_comercial.js    ← ✅ Dashboard Comercial (heatmap SVG, gráficos)
    ├── dashboard_financeiro.js   ← ✅ Dashboard Financeiro
    ├── laboratorios.js           ← ✅ Laboratórios (tabela, filtros, chamados inline)
    ├── representantes.js         ← ✅ CRUD Representantes
    ├── assessores.js             ← ✅ Visualização Esmeralda/Chivor
    ├── supervisores.js           ← ✅ CRUD Supervisores
    ├── analistas.js              ← ✅ CRUD Analistas + modal de performance
    ├── sistemas.js               ← ✅ CRUD Sistemas (inclui openAnalistaViewModal)
    ├── grupos_matrizes.js        ← ✅ Consulta hierárquica
    ├── divergencias.js           ← ✅ Motor de divergências + filtros + accordion
    ├── propostas.js              ← ✅ CRUD Propostas
    ├── pacotes.js                ← ✅ CRUD Pacotes + registros
    ├── importacao.js             ← ✅ Upload + progresso + histórico
    └── perfis_acesso.js          ← ⚠️ CONCLUÍDO COM BUG — ver abaixo
```

**Padrão de todos os módulos de página:**
```js
(function (global) {
  'use strict';
  var pages = global.pages || {};
  global.pages = pages;
  pages.nome_da_pagina = async function() { ... };
})(window);
```

**⚠️ Bug conhecido — `pages/perfis_acesso.js`:**  
O arquivo contém um erro de sintaxe no final do arquivo — a palavra isolada `as` após o comentário `// ===================== USER MODAL =====================`. Isso causa `SyntaxError` em runtime quando o script é carregado. A função `openUserModal` definida no `index.html` inline é a que está em uso; a do módulo nunca foi completada. **Correção pendente: remover o fragmento inválido `as` e, se desejado, migrar `openUserModal` do inline para este módulo.**

**Inconsistência de nomenclatura:**  
A FASE 5 da documentação anterior mencionava `dashboard-comercial.js` e `dashboard-financeiro.js` (com hífen), mas os arquivos reais usam underscore (`dashboard_comercial.js`, `dashboard_financeiro.js`), consistente com as chaves de rota usadas em `pages.dashboard_comercial` e `pages.dashboard_financeiro`. A documentação estava incorreta; os arquivos reais estão corretos.

**`openAnalistaViewModal` em `sistemas.js`:**  
Esta função foi incluída em `pages/sistemas.js` em vez de `pages/analistas.js`. É um resíduo do processo de extração incremental. Functionally não há quebra (a função é acessível), mas semanticamente pertence ao módulo de analistas. Refatoração recomendada na Fase 5.

---

## 6. Estado Atual da Estrutura de Arquivos

```
db-lab-manager/
├── index.html                      ← Shell: <db-login>, <db-sidebar>, <db-topbar>,
│                                      <db-modal>, <db-toast>, boot em DOMContentLoaded
│                                      Ainda contém inline: ACL_STRUCTURE, PERFIS_DEFAULT,
│                                      buildDefaultPerms(), openUserModal(), toggleAcc()
│
├── core/
│   ├── db.js                       ← ✅ IIFE, window.*, setAuditHook
│   ├── auth.js                     ← ✅ IIFE, window.*, RLS, ACL
│   ├── router.js                   ← ✅ IIFE, window.navigate, window.pages
│   └── utils.js                    ← ✅ IIFE, window.* — contém openModal/closeModal
│                                      duplicados (código morto, ver §5.5)
│
├── components/
│   ├── db-sidebar.js               ← ✅ Custom Element, Shadow DOM
│   ├── db-topbar.js                ← ✅ Custom Element, Shadow DOM, slot "actions"
│   ├── db-login.js                 ← ✅ Custom Element, Shadow DOM
│   ├── db-toast.js                 ← ✅ Custom Element, Shadow DOM
│   └── db-modal.js                 ← ✅ Custom Element, Shadow DOM
│
├── import/
│   ├── import-g5.js                ← ✅ processImport, IGNORE_REP
│   ├── import-envio.js             ← ✅ processEnvioImport, streaming, constantes
│   └── import-esmeralda.js         ← ✅ processEsmeraldaImport, mapCategoriaEsmeralda
│
├── pages/
│   ├── dashboard.js                ← ✅
│   ├── dashboard_comercial.js      ← ✅
│   ├── dashboard_financeiro.js     ← ✅
│   ├── laboratorios.js             ← ✅
│   ├── representantes.js           ← ✅
│   ├── assessores.js               ← ✅
│   ├── supervisores.js             ← ✅
│   ├── analistas.js                ← ✅
│   ├── sistemas.js                 ← ✅ (contém openAnalistaViewModal — ver §5.6)
│   ├── grupos_matrizes.js          ← ✅
│   ├── divergencias.js             ← ✅
│   ├── propostas.js                ← ✅
│   ├── pacotes.js                  ← ✅
│   ├── importacao.js               ← ✅
│   └── perfis_acesso.js            ← ✅ SyntaxError `as` corrigido
│
└── DB_LAB_MANAGER_PROJECT.md       ← esta documentação
```

---

## 7. Etapas de Modularização — Status Completo

### FASE 1 — Extração de utilitários e infraestrutura ✅ CONCLUÍDO (V26)

- [x] `core/db.js`
- [x] `core/auth.js`
- [x] `core/router.js`
- [x] `core/utils.js`

---

### FASE 2 — Extração de motores de importação ✅ CONCLUÍDO (V27)

- [x] `import/import-g5.js`
- [x] `import/import-envio.js`
- [x] `import/import-esmeralda.js`
- [x] Constantes de classificação: `ENVIO_SEM_INT`, `ENVIO_CONV`, `ENVIO_WS`, `getTipoIntExpected()`

---

### FASE 3 — Web Components de estrutura ✅ CONCLUÍDO

- [x] `components/db-topbar.js`
- [x] `components/db-login.js`
- [x] `components/db-toast.js`
- [x] `components/db-modal.js`

---

### FASE 4 — Extração de páginas ✅ CONCLUÍDO (revisão final)

- [x] `pages/dashboard.js`
- [x] `pages/dashboard_comercial.js`
- [x] `pages/dashboard_financeiro.js`
- [x] `pages/laboratorios.js`
- [x] `pages/representantes.js`
- [x] `pages/assessores.js`
- [x] `pages/supervisores.js`
- [x] `pages/analistas.js`
- [x] `pages/sistemas.js`
- [x] `pages/grupos_matrizes.js`
- [x] `pages/divergencias.js`
- [x] `pages/propostas.js`
- [x] `pages/pacotes.js`
- [x] `pages/importacao.js`
- [x] `pages/perfis_acesso.js` ✅ — SyntaxError (`as` isolado) removido

**Correções da revisão final da Fase 4:**
- [x] Corrigido SyntaxError em `pages/perfis_acesso.js` (token `as` isolado removido)
- [x] `openAnalistaViewModal()` migrada de `pages/sistemas.js` para `pages/analistas.js` + exportada como `window.openAnalistaViewModal`
- [x] `openAnalistaModal()` exportada como `window.openAnalistaModal` (necessário para chamadas via onclick-string em innerHTML)
- [x] `openSysViewModal()` e `openSysModal()` exportadas como `window.*` em `pages/sistemas.js` (linha de modal-footer usa `onclick="openSysModal(...)"` — string avaliada no escopo global)
- [ ] Migrar `openUserModal()` do `index.html` inline para `pages/perfis_acesso.js` *(requer acesso ao index.html — pendente para Fase 5)*
- [ ] Remover `openModal()` / `closeModal()` duplicados de `core/utils.js` *(requer acesso ao utils.js — pendente para Fase 5)*
- [ ] Confirmar acessibilidade global de `switchImportTab` em `pages/importacao.js` *(requer acesso ao arquivo — pendente)*

---

### FASE 5 — Estrutura final do projeto 🔲 PENDENTE

Objetivo: `index.html` como shell verdadeiramente mínimo, sem nenhum código de aplicação inline.

**Itens pendentes:**

- [ ] Extrair `ACL_STRUCTURE` do inline do `index.html` para um módulo (ex: `core/acl.js` ou `pages/perfis_acesso.js`)
- [ ] Extrair `PERFIS_DEFAULT` e `buildDefaultPerms()` do inline para `core/auth.js` ou `core/acl.js`
- [ ] Extrair `openUserModal()` do inline para `pages/perfis_acesso.js`
- [ ] Extrair `toggleAcc()` / `window.toggleAcc` do inline (já existe `window._divToggleAcc` em `divergencias.js` — apenas o proxy global pode ficar)
- [ ] Criar `app.js` — módulo de boot: `initDB → initDefaultAdmin → seedPerfis → focus no login`
- [ ] Remover `openModal()` / `closeModal()` de `core/utils.js` (implementação canônica está em `db-modal.js`)
- [ ] Avaliar migração de `Shadow DOM mode: 'open'` para `'closed'` nos componentes estabilizados
- [ ] Padronizar nomenclatura: `dashboard_comercial` vs `dashboard-comercial` (usar underscore, que é o padrão atual dos arquivos)

---

### FASE 6 — Melhorias técnicas pós-modularização 🔲 PENDENTE

- [ ] Substituir `innerHTML` por `DocumentFragment` nas páginas de alta frequência de atualização (`laboratorios.js`, `divergencias.js` como prioridade)
- [ ] Separar o CSS global em `styles/theme.css` (variáveis `:root`) e `styles/base.css` (reset + utilitários) — atualmente todo o CSS está inline no `index.html`
- [ ] Adicionar hash routing (`#dashboard`) para que o browser preserve a página ao recarregar
- [ ] Implementar paginação server-side simulada para clientes (atualmente carrega tudo na memória via `dbAll`)
- [ ] Adicionar export de dados (JSON backup / restore do IndexedDB)
- [ ] Implementar feriados nacionais no cálculo de dias úteis dos analistas
- [ ] Migrar `core/*.js` e `pages/*.js` de IIFE para `import/export` nativos (ES Modules) — viável somente após todas as páginas estarem extraídas e o script inline do `index.html` eliminado

---

## 8. Decisões de Arquitetura

| Decisão | Justificativa |
|---|---|
| **Web Components nativos** (sem React/Vue) | O projeto já usa JS puro sem build step. Introduzir um framework criaria segunda camada de runtime sem ganho. |
| **Shadow DOM `mode: 'open'`** | Permite inspeção via `element.shadowRoot` durante a migração incremental. Mudança para `closed` fica para a Fase 5. |
| **CSS Custom Properties para theming** | Único mecanismo que herda através da fronteira do Shadow DOM. Garante que `--navy`, `--accent` etc. do `:root` funcionem dentro dos componentes. |
| **IIFE + `window.*` para módulos `core/` e `pages/`** | `<script type="module">` isola o escopo — `window.X` atribuído dentro de um módulo não é visível para scripts clássicos em tempo de execução. IIFE com `defer` garante ordem de carregamento e escopo global compartilhado. Migração para `import/export` nativo fica para a Fase 6 (após eliminar o inline). |
| **`CustomEvent` com `composed: true`** | Eventos dentro do Shadow DOM ficam presos. `composed: true` faz o evento cruzar a fronteira e ser capturado no `document` do host. |
| **IndexedDB sem biblioteca** | Mantém zero dependências externas além de XLSX.js e Chart.js. |
| **Migração incremental** | Cada fase mantém o sistema funcionando. Não há "big bang rewrite". O `index.html` ancora as fases sem quebrar funcionalidade. A cada fase, menos código inline e mais módulos. |
| **`updateTopbar()` em `utils.js`** | Helper emergiu durante a extração das páginas para evitar repetição do padrão `topbar.title = X; topbar.subtitle = Y; topbar.appendChild(...)` em todos os 15 módulos de página. |
| **Dependency injection via `setAuditHook`** | Evita ciclo de importação `db ← auth`. `db.js` não importa `auth.js`; `auth.js` injeta `auditLog` via setter após inicializar. |

---

## 9. Bugs Conhecidos e Dívidas Técnicas

| Arquivo | Tipo | Descrição | Prioridade |
|---|---|---|---|
| `pages/perfis_acesso.js` | ~~Bug crítico~~ **Resolvido** | `SyntaxError`: token `as` isolado removido | ✅ |
| `pages/analistas.js` | ~~Acoplamento~~ **Resolvido** | `openAnalistaViewModal()` migrada de `sistemas.js` + exportada como `window.*` | ✅ |
| `pages/sistemas.js` | ~~Bug latente~~ **Resolvido** | `openSysViewModal()` e `openSysModal()` exportadas como `window.*` (exigido por onclick-string no modal-footer) | ✅ |
| `core/utils.js` | Código morto | `openModal()` e `closeModal()` apontam para `#modal-container` que não existe; implementação real está em `db-modal.js` | 🟡 Média |
| `index.html` | Inline remanescente | `ACL_STRUCTURE`, `PERFIS_DEFAULT`, `buildDefaultPerms()`, `openUserModal()` ainda no script inline | 🟡 Média |
| `pages/importacao.js` | Possível bug | `switchImportTab()` é chamado via `onclick` no HTML mas definida dentro do escopo de `pages.importacao` — verificar se está acessível globalmente | 🟡 Média |
| Todos os `pages/*.js` | Performance | Uso extensivo de `innerHTML` para renderização — sem virtualização ou `DocumentFragment` | 🟢 Baixa |
| `core/*.js` e `pages/*.js` | Arquitetura | IIFEs deverão ser migrados para ES Modules nativos após eliminação do script inline | 🟢 Baixa |

---

*Documento atualizado em: maio de 2026 — Fases 1–4 concluídas (revisão final da Fase 4 aplicada: exports window.*, SyntaxError corrigido, openAnalistaViewModal migrada) · DB Lab Manager — Diagnósticos do Brasil*
