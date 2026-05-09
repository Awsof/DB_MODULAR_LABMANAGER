# DB Lab Manager — Documentação do Projeto

> **Versão atual:** index.html (shell mínimo sem código de aplicação inline) + core/ (5 módulos IIFE clássicos) + components/ (5 Web Components) + pages/ (17 módulos de páginas) + import/ (3 engines de importação) — **FASE 1 ✅ · FASE 2 ✅ · FASE 3 ✅ · FASE 4 ✅ · FASE 5 ✅ · FASE 6 ✅ (parcial — ver status detalhado) · FASE 7 pendente**

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
- **Upsert de supervisores** na store `supervisores` ao importar (Fase 6)

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

### 2.6 Visualização Personalizada por Perfil (RLS) — Hierárquico

O sistema aplica **Row-Level Security** no frontend, filtrando os dados conforme o vínculo do usuário logado. A partir da Fase 6, o RLS suporta quatro níveis hierárquicos:

| Tipo de Usuário | Visualiza | Mecanismo |
|---|---|---|
| `fullAccess` (Supervisor do Sistema) | Todos os clientes — sem filtro | — |
| `representante` | Apenas clientes com `fk_representante === entityId` | Filtro direto por FK |
| `assessor` | Apenas clientes com `assessor === entityNome` | Filtro por campo texto |
| `supervisor` | Clientes cujos representantes têm `fk_supervisor === entityId` | `allowedRepIds` pré-calculado no login |
| `gerente` | Clientes de todos os representantes vinculados aos supervisores do gerente | `getScopeForGerente()` → `allowedRepIds` |

**Decisão de performance (5B):** O `allowedRepIds` (Set de IDs de representantes permitidos) é calculado **uma única vez** em `doLogin()`, de forma assíncrona, e armazenado em `currentUser.allowedRepIds`. Isso mantém `applyDataFilter()` síncrona em todas as páginas — sem await nas listagens.

Um banner visual aparece no topo de cada página quando filtro está ativo.

---

### 2.7 Sistema de Permissões por Perfil (ACL)

Dois níveis de controle:
1. **Página** — visibilidade no menu e acesso à rota
2. **Botão** — visibilidade de ações específicas (ex: `laboratorios::edit-btn`)

Perfis padrão (definidos em `core/acl.js`): `Supervisor (Sistema)` (fullAccess), `Gerente`, `Supervisor Comercial`, `Representante`, `Analistas`, `Analistas Sênior`, `Estagiário`, `Financeiro`.

Funções de verificação (em `core/auth.js`):
```js
canAccess(pageKey)           // retorna boolean
canBtn(pageKey, btnKey)      // retorna boolean
```

---

### 2.8 Regras de Chamados de Integração

Cada laboratório pode ter múltiplos chamados. Regras aplicadas:
- A partir da Fase 6, chamados têm **página própria** (`pages/chamados.js`) com CRUD completo
- O modal de edição de laboratórios (`pages/laboratorios.js`) mantém visualização e edição **inline** de chamados existentes, mas redireciona criação para `pages.chamados`
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

### 2.11 Hierarquia Comercial (Fase 6)

A hierarquia completa é: **Gerente → Supervisor Comercial → Representante → Laboratório**

- **Gerentes** têm store própria (`gerentes`) e página CRUD (`pages/gerentes.js`)
- **Supervisores** possuem campo texto `gerente` (nome do gerente responsável — decisão 2B)
- **Representantes** possuem `fk_supervisor` (FK numérica) + campo texto `supervisor` (fallback legado)
- O RLS de gerente usa `getScopeForGerente(gerenteNome, supervisores, representantes)` para calcular o Set de representantes permitidos

---

## 3. Estrutura do Banco de Dados (IndexedDB)

**Nome:** `dblabmanager` · **Versão:** 10 _(atualizada na Fase 6 para adicionar store `gerentes` e campo `fk_supervisor`)_

| Store | Chave | Índices | Descrição |
|---|---|---|---|
| `clientes` | `Codigo` (string) | UF, fk_representante, fk_sistema, assessor, categoria_especial | Laboratórios clientes |
| `representantes` | `id` (autoIncrement) | nome (unique) | Representantes comerciais · campo `fk_supervisor` (sem índice — filtrado em memória) |
| `assessores` | `id` (autoIncrement) | nome (unique) | Assessores do programa Esmeralda/Chivor |
| `supervisores` | `id` (autoIncrement) | nome (unique) | Supervisores comerciais · campo texto `gerente` |
| `gerentes` | `id` (autoIncrement) | nome (unique) | **NOVO (Fase 6)** — Gerentes comerciais |
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

**Nota sobre `representantes.fk_supervisor`:** Campo numérico sem índice IDB. O filtro RLS do supervisor/gerente usa `allowedRepIds` pré-calculado em `doLogin()` (decisão 5B) — busca bulk via `dbAll()` + filtro em memória. Índice seria custo sem benefício neste modelo de acesso.

---

## 4. Páginas e Funcionalidades

| Página | Rota (`data-page`) | RLS | Descrição |
|---|---|---|---|
| Dashboard Integração | `dashboard` | ✓ | Métricas + 4 gráficos dinâmicos (integração, UF, sistema, analista) |
| Dashboard Comercial | `dashboard_comercial` | ✓ | Gráficos + heatmap SVG do Brasil por UF |
| Dashboard Financeiro | `dashboard_financeiro` | — | Budget, propostas, mensalidades, pacotes |
| Laboratórios | `laboratorios` | ✓ | Tabela + filtros + modal edição + chamados inline (visualização/edição) |
| Representantes | `representantes` | — | CRUD com dropdown de supervisor (FK + fallback texto) |
| Assessores | `assessores` | — | Visualização Esmeralda/Chivor por assessor |
| Supervisores | `supervisores` | — | CRUD com campo gerente (texto) |
| Gerentes | `gerentes` | — | **NOVO (Fase 6)** — CRUD de gerentes comerciais |
| Analistas | `analistas` | — | CRUD com cargo, ID custom, modal de performance |
| Sistemas | `sistemas` | — | CRUD com tipo, configuração, métodos, financeiro |
| Chamados | `chamados` | ✓ | **NOVO (Fase 6)** — CRUD standalone de chamados de integração |
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

**Lição aprendida (bug corrigido):**
CSS Custom Properties dentro do Shadow DOM NÃO devem ser redeclaradas com `--navy: var(--navy, fallback)` — isso cria referência circular. O correto é usar diretamente `background: var(--navy, #003761)`, aproveitando a herança natural das CSS Custom Properties através da fronteira do Shadow DOM.

---

### 5.2 Fase 1 — Extração de Utilitários e Infraestrutura (V26) ✅ CONCLUÍDO

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

---

### 5.3 Fase 2 — Extração de Motores de Importação (V27) ✅ CONCLUÍDO

```
db-lab-manager/
└── import/
    ├── import-g5.js          ← processImport(), IGNORE_REP, downloadModeloCSV()
    ├── import-envio.js       ← processEnvioImport(), processEnvioImportStreaming(),
    │                            ENVIO_SEM_INT, ENVIO_CONV, ENVIO_WS, getTipoIntExpected()
    └── import-esmeralda.js   ← processEsmeraldaImport(), mapCategoriaEsmeralda()
```

---

### 5.4 Fase 3 — Web Components de Estrutura ✅ CONCLUÍDO

```
db-lab-manager/
└── components/
    ├── db-sidebar.js    ← ✅ (V25)
    ├── db-topbar.js     ← ✅ Topbar com slot "actions", eventos db-topbar-action
    ├── db-login.js      ← ✅ Formulário de login
    ├── db-toast.js      ← ✅ Notificações toast
    └── db-modal.js      ← ✅ Modal declarativo (Light DOM + Shadow DOM híbrido)
```

**Arquitetura do `db-modal` (decisão §4):** Shadow DOM gerencia backdrop e janela externa; o conteúdo HTML das páginas é injetado no Light DOM via `this._lightContainer`, projetado pelo `<slot>`. Permite que o CSS global alcance o conteúdo do modal sem barreira de Shadow DOM.

---

### 5.5 Fase 4 — Extração de Páginas ✅ CONCLUÍDO

Todos os 15 módulos de página originais extraídos para `pages/*.js`. Ver seção §6 para estrutura de arquivos atual (inclui os 2 módulos adicionados na Fase 6).

---

### 5.6 Fase 5 — Estrutura Final do index.html ✅ CONCLUÍDO

O `index.html` é agora um **shell verdadeiramente mínimo**, sem código de aplicação inline.

**Itens concluídos:**

- [x] `ACL_STRUCTURE` extraído para `core/acl.js`
- [x] `PERFIS_DEFAULT` e `buildDefaultPerms()` extraídos para `core/acl.js`
- [x] `openUserModal()` migrado para `pages/perfis_acesso.js` + exportado como `window.openUserModal`
- [x] `toggleAcc()` permanece como proxy fino no inline (`window._divToggleAcc` em `divergencias.js`)
- [x] `openModal()` / `closeModal()` duplicados removidos da lógica ativa de `core/utils.js` — redirecionam para `db-modal.js`
- [x] Script inline reduzido a: declaração de `var pages = {}`, proxy `toggleAcc`, e boot em `DOMContentLoaded`
- [x] Seed de perfis no boot usa `PERFIS_DEFAULT` e `buildDefaultPerms` de `core/acl.js`

**Nota sobre `core/utils.js`:** `openModal()` e `closeModal()` ainda existem no arquivo como proxies que delegam ao `<db-modal>` (não são mais código morto — redirecionam corretamente). `db-modal.js` continua sendo a implementação canônica.

---

### 5.7 Fase 6 — Hierarquia Comercial e Melhorias ✅ PARCIALMENTE CONCLUÍDO

**Itens concluídos:**

- [x] `DB_VERSION` 9 → 10: nova store `gerentes`, campo `fk_supervisor` em `representantes`, campo `gerente` em `supervisores`
- [x] `core/db.js` atualizado com schema da store `gerentes` e anotações de não-índice para `fk_supervisor`
- [x] `core/auth.js` — RLS hierárquico completo: `getScopeForGerente()`, cálculo de `allowedRepIds` no `doLogin`, suporte a `entityType = 'gerente'`
- [x] `pages/gerentes.js` — CRUD completo de gerentes comerciais
- [x] `pages/chamados.js` — página standalone de chamados com CRUD, filtros e modal
- [x] `pages/representantes.js` — dropdown de supervisores (FK `fk_supervisor` + fallback texto)
- [x] `pages/supervisores.js` — campo `gerente` (texto) no modal, coluna gerente na tabela
- [x] `pages/laboratorios.js` — formulário de criação de chamados removido do modal de edição; botão "Novo Chamado →" redireciona para `pages.chamados`
- [x] `core/acl.js` — perfis `gerente` e `supervisor_comercial` adicionados; páginas `chamados` e `gerentes` incluídas na `ACL_STRUCTURE`
- [x] `db-sidebar.js` — itens de menu `chamados` e `gerentes` adicionados

**Itens pendentes da Fase 6:**

- [ ] **Página `gerentes` ausente nos itens do sidebar** — o `db-sidebar.js` referencia `data-page="gerentes"` mas a seção "Equipe DB" do nav repete a seção "Financeiro" duas vezes (duplicação de `propostas` e `pacotes`), indicando que a limpeza do sidebar ainda não foi feita
- [ ] **`import-g5.js` — upsert de supervisores já implementado**, mas não atualiza o campo `gerente` dos supervisores existentes durante a importação (sem impacto imediato, pois esse campo é gerenciado manualmente)
- [ ] **Feriados nacionais** no cálculo de dias úteis dos analistas (item pendente desde a Fase 6 original)

---

## 6. Estado Atual da Estrutura de Arquivos

```
db-lab-manager/
├── index.html                      ← Shell mínimo: <db-login>, <db-sidebar>, <db-topbar>,
│                                      <db-modal>, <db-toast>, boot em DOMContentLoaded
│                                      Inline reduzido a: var pages={}, proxy toggleAcc, boot
│
├── core/
│   ├── db.js                       ← ✅ IIFE, window.*, DB_VERSION=10, store gerentes
│   ├── auth.js                     ← ✅ IIFE, window.*, RLS hierárquico, getScopeForGerente
│   ├── router.js                   ← ✅ IIFE, window.navigate, window.pages
│   ├── utils.js                    ← ✅ IIFE, window.* — openModal/closeModal como proxies
│   └── acl.js                      ← ✅ NOVO (Fase 5) — ACL_STRUCTURE, PERFIS_DEFAULT,
│                                      buildDefaultPerms, perfis gerente e supervisor_comercial
│
├── components/
│   ├── db-sidebar.js               ← ✅ Custom Element, Shadow DOM, nav atualizado (Fase 6)
│   ├── db-topbar.js                ← ✅ Custom Element, Shadow DOM, slot "actions"
│   ├── db-login.js                 ← ✅ Custom Element, Shadow DOM
│   ├── db-toast.js                 ← ✅ Custom Element, Shadow DOM
│   └── db-modal.js                 ← ✅ Custom Element, Light DOM + Shadow DOM híbrido
│
├── import/
│   ├── import-g5.js                ← ✅ processImport, IGNORE_REP, upsert supervisores
│   ├── import-envio.js             ← ✅ processEnvioImport, streaming, constantes
│   └── import-esmeralda.js        ← ✅ processEsmeraldaImport, mapCategoriaEsmeralda
│
├── pages/
│   ├── dashboard.js                ← ✅
│   ├── dashboard_comercial.js      ← ✅ heatmap SVG interativo, filtro de período
│   ├── dashboard_financeiro.js     ← ✅
│   ├── laboratorios.js             ← ✅ (Fase 6: criação de chamado → pages.chamados)
│   ├── representantes.js           ← ✅ (Fase 6: dropdown supervisor + fk_supervisor)
│   ├── assessores.js               ← ✅
│   ├── supervisores.js             ← ✅ (Fase 6: campo gerente no modal)
│   ├── gerentes.js                 ← ✅ NOVO (Fase 6) — CRUD gerentes comerciais
│   ├── analistas.js                ← ✅ openAnalistaViewModal migrada de sistemas.js
│   ├── sistemas.js                 ← ✅
│   ├── chamados.js                 ← ✅ NOVO (Fase 6) — CRUD standalone de chamados
│   ├── grupos_matrizes.js          ← ✅
│   ├── divergencias.js             ← ✅
│   ├── propostas.js                ← ✅
│   ├── pacotes.js                  ← ✅
│   ├── importacao.js               ← ✅ switchImportTab exportada como window.*
│   └── perfis_acesso.js            ← ✅ openUserModal migrada do inline + window.openUserModal
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

### FASE 4 — Extração de páginas ✅ CONCLUÍDO (revisão final aplicada)

- [x] Todos os 15 módulos de página originais extraídos
- [x] `openAnalistaViewModal()` migrada de `sistemas.js` para `analistas.js`
- [x] Exports `window.*` aplicados onde necessário (onclick-strings em innerHTML)
- [x] `switchImportTab` exportada como `window.switchImportTab`
- [x] SyntaxError em `perfis_acesso.js` (token `as` isolado) corrigido

---

### FASE 5 — Estrutura final do index.html ✅ CONCLUÍDO

- [x] `ACL_STRUCTURE`, `PERFIS_DEFAULT`, `buildDefaultPerms()` → `core/acl.js`
- [x] `openUserModal()` → `pages/perfis_acesso.js`
- [x] `toggleAcc` como proxy fino no inline
- [x] Script inline reduzido ao mínimo operacional
- [x] `openModal()` / `closeModal()` em `utils.js` convertidas para proxies do `<db-modal>`

---

### FASE 6 — Hierarquia Comercial e Melhorias ✅ PARCIALMENTE CONCLUÍDO

- [x] `DB_VERSION` 9 → 10: store `gerentes`, campo `fk_supervisor`, campo `gerente`
- [x] RLS hierárquico: gerente → supervisor → representante
- [x] `pages/gerentes.js` — CRUD completo
- [x] `pages/chamados.js` — CRUD standalone
- [x] `pages/representantes.js` — dropdown supervisor + FK
- [x] `pages/supervisores.js` — campo gerente
- [x] `pages/laboratorios.js` — criação de chamado desacoplada
- [x] `core/acl.js` — novos perfis e páginas na ACL_STRUCTURE
- [x] `db-sidebar.js` — itens `chamados` e `gerentes`
- [ ] **Corrigir duplicação de seções no sidebar** (`db-sidebar.js` repete "Financeiro" duas vezes com `propostas` e `pacotes` duplicados)
- [ ] Feriados nacionais no cálculo de dias úteis dos analistas

---

### FASE 7 — Melhorias Técnicas Pós-Modularização 🔲 PENDENTE

Objetivo: qualidade técnica, performance e experiência do usuário.

**Itens identificados:**

- [ ] **Corrigir duplicação no sidebar** — remover a segunda seção "Financeiro" repetida em `db-sidebar.js` (propostas e pacotes aparecem duas vezes no menu)
- [ ] **Substituir `innerHTML` por `DocumentFragment`** nas páginas de alta frequência de atualização (`laboratorios.js`, `divergencias.js` como prioridade)
- [ ] **Separar CSS global** em `styles/theme.css` (variáveis `:root`) e `styles/base.css` (reset + utilitários) — atualmente todo o CSS está inline no `index.html`
- [ ] **Adicionar hash routing** (`#dashboard`) para que o browser preserve a página ao recarregar
- [ ] **Implementar paginação server-side simulada** para clientes (atualmente carrega tudo na memória via `dbAll`)
- [ ] **Export/import de dados** (JSON backup / restore do IndexedDB completo)
- [ ] **Implementar feriados nacionais** no cálculo de dias úteis dos analistas
- [ ] **Migrar `core/*.js` e `pages/*.js` de IIFE para ES Modules** (`import/export` nativos) — viável agora que o script inline do `index.html` foi eliminado
- [ ] **Avaliar Shadow DOM `mode: 'closed'`** nos componentes estabilizados (atualmente todos em `'open'`)
- [ ] **Testes de regressão básicos** — ausência de testes automatizados é o maior risco técnico do projeto

---

## 8. Decisões de Arquitetura

| Decisão | Justificativa |
|---|---|
| **Web Components nativos** (sem React/Vue) | O projeto já usa JS puro sem build step. Introduzir um framework criaria segunda camada de runtime sem ganho. |
| **Shadow DOM `mode: 'open'`** | Permite inspeção via `element.shadowRoot` durante a migração incremental. Mudança para `closed` fica para a Fase 7. |
| **CSS Custom Properties para theming** | Único mecanismo que herda através da fronteira do Shadow DOM. Garante que `--navy`, `--accent` etc. do `:root` funcionem dentro dos componentes. |
| **IIFE + `window.*` para módulos `core/` e `pages/`** | `<script type="module">` isola o escopo — `window.X` atribuído dentro de um módulo não é visível para scripts clássicos em tempo de execução. IIFE com `defer` garante ordem de carregamento e escopo global compartilhado. Migração para `import/export` nativo fica para a Fase 7 (inline eliminado). |
| **`CustomEvent` com `composed: true`** | Eventos dentro do Shadow DOM ficam presos. `composed: true` faz o evento cruzar a fronteira e ser capturado no `document` do host. |
| **IndexedDB sem biblioteca** | Mantém zero dependências externas além de XLSX.js e Chart.js. |
| **Migração incremental** | Cada fase mantém o sistema funcionando. Não há "big bang rewrite". O `index.html` ancora as fases sem quebrar funcionalidade. |
| **`updateTopbar()` em `utils.js`** | Helper emergiu durante a extração das páginas para evitar repetição do padrão em todos os módulos. |
| **Dependency injection via `setAuditHook`** | Evita ciclo de importação `db ← auth`. `db.js` não importa `auth.js`; `auth.js` injeta `auditLog` via setter após inicializar. |
| **`allowedRepIds` pré-calculado no login (decisão 5B)** | Mantém `applyDataFilter()` síncrona em todas as páginas. O custo de calcular os IDs permitidos ocorre uma única vez no login, não a cada listagem. |
| **`fk_supervisor` sem índice IDB** | O filtro RLS usa `allowedRepIds` em memória (já pré-calculado). Criar índice seria custo de escrita sem benefício de leitura neste modelo bulk. |
| **Campo texto `gerente` em supervisores (decisão 2B)** | Espelha o padrão já existente de `representantes.supervisor` (campo texto legado). Evita FK adicional e mantém consistência com a estratégia de campos texto para hierarquias comerciais. |
| **Light DOM + Shadow DOM híbrido no `db-modal`** | Shadow DOM gerencia apenas estrutura e estilos do shell; o conteúdo das páginas fica no Light DOM e recebe o CSS global normalmente. Evita replicar todos os estilos de formulário dentro do Shadow. |

---

## 9. Bugs Conhecidos e Dívidas Técnicas

| Arquivo | Tipo | Descrição | Prioridade |
|---|---|---|---|
| `components/db-sidebar.js` | **Bug ativo** | Seção "Financeiro" duplicada no nav: `propostas` e `pacotes` aparecem duas vezes. O segundo bloco duplicado deve ser removido. | 🔴 Alta |
| `core/utils.js` | Código morto residual | `openModal()` e `closeModal()` ainda existem como proxies — funcionam mas podem ser removidas quando `db-modal.js` for a referência universal consolidada | 🟢 Baixa |
| Todos os `pages/*.js` | Performance | Uso extensivo de `innerHTML` para renderização — sem virtualização ou `DocumentFragment`. Risco de XSS em dados vindos do IDB se algum campo não for sanitizado. | 🟡 Média |
| `core/*.js` e `pages/*.js` | Arquitetura | IIFEs deverão ser migrados para ES Modules nativos. Pré-requisito (inline eliminado) agora satisfeito. | 🟢 Baixa |
| Geral | Qualidade | Ausência de testes automatizados. Toda regressão é detectada manualmente. | 🟡 Média |
| `pages/analistas.js` | Cálculo | Dias úteis não consideram feriados nacionais brasileiros. | 🟢 Baixa |

---

## 10. Análise das Próximas Etapas (Fase 7)

### Prioridade 1 — Correção imediata

**Duplicação do sidebar (`db-sidebar.js`):** A seção `<div class="nav-section">Financeiro</div>` com os itens `propostas` e `pacotes` aparece duas vezes no template HTML interno do componente. A segunda ocorrência (linhas seguintes à primeira) deve ser removida. É o único bug ativo com impacto visual direto no usuário.

### Prioridade 2 — Melhorias de produto

**Hash routing:** Implementar `window.location.hash` no `router.js` para persistir a página atual no URL. Ao recarregar, o boot leria `window.location.hash` e navegaria para a página correspondente após o login. Custo baixo, ganho significativo de usabilidade.

**Export/import de dados:** Adicionar na página de Importação um par de botões "Exportar backup (JSON)" e "Restaurar backup (JSON)" que serializam/deserializam todas as stores do IndexedDB. Essencial para migração entre dispositivos e recuperação de dados.

### Prioridade 3 — Arquitetura

**Migração para ES Modules:** Com o `index.html` sem inline, a migração de IIFE para `import/export` nativos se torna direta. A estratégia seria:

1. Converter `core/*.js` primeiro (menos dependências)
2. Converter `import/*.js`
3. Converter `pages/*.js` por lote
4. Criar um `app.js` como entry point que importa todos os módulos e executa o boot

O principal ganho é tree-shaking e melhor rastreamento de dependências — hoje qualquer módulo pode chamar qualquer `window.*` sem que o código declare suas dependências explicitamente.

**Separação do CSS:** Mover o bloco `<style>` do `index.html` para arquivos separados:
- `styles/theme.css` — variáveis `:root` (tokens de design)
- `styles/base.css` — reset, componentes reutilizáveis (`.btn`, `.badge`, `.table-wrap` etc.)
- `styles/pages.css` — estilos específicos de páginas (`proposta-card`, `div-section` etc.)

### Prioridade 4 — Performance

**`DocumentFragment` nas listagens pesadas:** `laboratorios.js` e `divergencias.js` fazem `tbody.innerHTML = rows.map(renderRow).join('')`, que destrói e reconstrói todo o DOM a cada filtro. A migração para `DocumentFragment` (construir fragmento → substituir apenas o `<tbody>`) reduz reflow e melhora responsividade em listas grandes (>500 registros).

**Paginação de dados:** `dbAll('clientes')` carrega todos os registros na memória. Para instalações com muitos clientes, implementar cursor-based pagination no IndexedDB evitaria o custo de carregamento inicial.

---

*Documento atualizado em: maio de 2026 — Fases 1–5 concluídas · Fase 6 parcialmente concluída (hierarquia comercial implementada, bug de sidebar pendente) · DB Lab Manager — Diagnósticos do Brasil*
