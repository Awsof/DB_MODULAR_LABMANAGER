# DB Lab Manager — Documentação do Projeto

> **Versão atual:** index.html (shell mínimo sem código de aplicação inline) + core/ (5 módulos IIFE clássicos) + components/ (5 Web Components) + pages/ (17 módulos de páginas) + import/ (3 engines de importação) — **FASE 1 ✅ · FASE 2 ✅ · FASE 3 ✅ · FASE 4 ✅ · FASE 5 ✅ · FASE 6 ✅ · FASE 7 ✅ (7A · 7B · 7C · 7D · 7F concluídas; 7E e 7G adiadas)**

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

> **Pendência (Etapa 6B):** implementar lista de feriados nacionais brasileiros fixos e móveis para cálculo preciso.

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

> **Decisão 2B — risco aceito:** O campo `gerente` em supervisores é texto livre (nome), não FK. Se um gerente for renomeado em `pages/gerentes.js`, o campo ficará órfão nos supervisores vinculados. Não há cascade update. Mitigação: a Etapa 7E (ES Modules) permitirá implementar um hook de rename com propagação. Até lá, o rename deve ser feito com cautela.

---

### 2.12 Sanitização de Dados e Segurança XSS

> **Decisão de segurança (adicionada na revisão de maio/2026):**

Atualmente, dados lidos das planilhas via `XLSX.utils.sheet_to_json` são persistidos no IndexedDB sem sanitização. Na renderização, `pages/*.js` usa `innerHTML` com template literals, o que expõe o sistema a XSS caso um campo como "Razão Social" ou "Observação" contenha scripts maliciosos.

Os dados são tratados como **confiáveis por procedência** (planilhas internas), mas isso é uma falha de segurança formal.

**Correção planejada na Etapa 7B:** implementar `escapeHtml(str)` em `core/utils.js` e aplicá-la em todas as interpolações de `innerHTML` nas páginas de alta frequência (`laboratorios.js`, `divergencias.js` primeiro, demais em sequência).

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

**Nota sobre `representantes.fk_supervisor`:** Campo numérico sem índice IDB. O filtro RLS do supervisor/gerente usa `allowedRepIds` em memória (já pré-calculado). Índice seria custo sem benefício neste modelo de acesso.

**Nota sobre backup/restore (Etapa 7D):** Todas as stores usam `autoIncrement`. O restore é **destrutivo** (clear-and-load): apaga e recarrega o banco integralmente. Merge entre instalações não é viável sem UUID como chave primária, pois exigiria remapear todas as FKs em runtime.

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

### 5.7 Fase 6 — Hierarquia Comercial e Melhorias ⚠️ PARCIALMENTE CONCLUÍDO

#### Itens concluídos:

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

#### Etapas pendentes da Fase 6:

---

#### ETAPA 6A — Corrigir bug de duplicação no sidebar 🔴 ALTA PRIORIDADE

**Problema:** O template HTML interno de `components/db-sidebar.js` contém o bloco `<div class="nav-section">Financeiro</div>` com os itens `propostas` e `pacotes` duplicados — o segundo bloco deve ser removido.

**Impacto:** Bug visual ativo; usuários veem dois grupos "Financeiro" no menu.

**Arquivo a enviar:**
- `components/db-sidebar.js` (versão corrigida — apenas remoção do segundo bloco duplicado)

**Critério de conclusão:** menu lateral exibe cada seção uma única vez.

---

#### ETAPA 6B — Feriados nacionais no cálculo de dias úteis 🟢 BAIXA PRIORIDADE

**Problema:** `pages/analistas.js` calcula dias úteis contando apenas dias de segunda a sexta, sem excluir feriados nacionais brasileiros.

**Implementação:**
1. Criar função `getFeriadosNacionais(ano)` em `core/utils.js` que retorna um `Set` de strings `"YYYY-MM-DD"` com feriados fixos e móveis (Carnaval, Páscoa, Corpus Christi calculados via algoritmo de Meeus/Jones/Butcher).
2. Atualizar a função de cálculo de dias úteis em `pages/analistas.js` para receber o Set e excluir feriados.

**Arquivos a enviar:**
- `core/utils.js` (adicionar `getFeriadosNacionais`)
- `pages/analistas.js` (atualizar cálculo de dias úteis)

**Critério de conclusão:** prazo médio por analista exclui feriados nacionais brasileiros corretamente.

---

### 5.8 Fase 7 — Melhorias Técnicas Pós-Modularização 🔲 PENDENTE

Objetivo: qualidade técnica, performance, segurança e experiência do usuário.
Subdividida em **7 etapas independentes**, executáveis em qualquer ordem após a Fase 6.

---

#### ETAPA 7A — Hash Routing 🟡 MÉDIA PRIORIDADE

**Problema:** Ao recarregar o browser, o sistema sempre cai na tela de login e navega para o dashboard, perdendo o contexto de navegação do usuário.

**Implementação:**
1. Em `core/router.js`, ao chamar `navigate(page)`, atualizar `window.location.hash = page`.
2. No boot (`index.html` ou `core/router.js`), após login bem-sucedido, ler `window.location.hash` e navegar para a página correspondente (se o usuário tiver acesso via `canAccess`).
3. Adicionar `hashchange` listener para tratar navegação pelo botão Voltar do browser.

**Arquivos a enviar:**
- `core/router.js` (hash read/write + listener)
- `index.html` (leitura do hash no boot, após doLogin)

**Critério de conclusão:** recarregar o browser com `#laboratorios` na URL abre a página de Laboratórios após login.

---

#### ETAPA 7B — Sanitização XSS e escapeHtml 🟡 MÉDIA PRIORIDADE

**Problema:** Dados do IndexedDB (originados de planilhas) são interpolados diretamente em `innerHTML` sem escape. Um campo "Razão Social" contendo `<script>alert(1)</script>` seria executado.

**Implementação:**
1. Adicionar helper em `core/utils.js`:
```js
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;
```
2. Aplicar `escapeHtml()` em todas as interpolações de campos de dados (não de HTML estrutural) nas páginas, priorizando:
   - `pages/laboratorios.js` (maior volume de campos)
   - `pages/divergencias.js`
   - `pages/chamados.js`
   - demais `pages/*.js`

**Nota:** campos que recebem HTML intencional (badges, chips de cor) **não** devem usar `escapeHtml` — apenas campos de texto de negócio (Razão Social, Observações, nomes).

**Arquivos a enviar (em sub-lotes):**
- Sub-lote B1: `core/utils.js` + `pages/laboratorios.js` + `pages/divergencias.js`
- Sub-lote B2: `pages/chamados.js` + `pages/representantes.js` + `pages/supervisores.js` + `pages/gerentes.js`
- Sub-lote B3: demais `pages/*.js` restantes

**Critério de conclusão:** nenhum campo de texto de negócio é injetado em `innerHTML` sem passar por `escapeHtml`.

---

#### ETAPA 7C — Separação do CSS 🟢 BAIXA PRIORIDADE

**Problema:** Todo o CSS da aplicação está em um único bloco `<style>` no `index.html`, dificultando manutenção e impossibilitando cache independente dos estilos.

**Implementação:**
1. Criar diretório `styles/`.
2. Extrair do `<style>` do `index.html`:
   - `styles/theme.css` — variáveis `:root` (`--navy`, `--accent`, `--purple`, etc.) e tokens de design
   - `styles/base.css` — reset, tipografia, componentes reutilizáveis (`.btn`, `.badge`, `.table-wrap`, `.form-group`, etc.)
   - `styles/pages.css` — estilos específicos de páginas (`proposta-card`, `div-section`, `.heatmap-*`, etc.)
3. Substituir o `<style>` inline por três `<link rel="stylesheet">` no `index.html`.

**Arquivos a enviar:**
- `styles/theme.css` (novo)
- `styles/base.css` (novo)
- `styles/pages.css` (novo)
- `index.html` (remover `<style>`, adicionar `<link>`s)

**Critério de conclusão:** `index.html` não contém nenhum bloco `<style>` de aplicação; visual idêntico ao anterior.

---

#### ETAPA 7D — Export/Import de Dados (Backup JSON) 🟡 MÉDIA PRIORIDADE

**Problema:** Não há mecanismo de backup ou migração de dados entre dispositivos/browsers. Uma falha no IndexedDB local resulta em perda total dos dados.

**Decisão de restore:** O restore é **destrutivo** (clear-and-load). Merge não é viável com `autoIncrement` sem remapeamento de FKs. Isso deve ser comunicado ao usuário com alerta explícito.

**Implementação:**
1. Em `pages/importacao.js`, adicionar seção "Backup e Restauração" com dois botões:
   - **Exportar backup (JSON):** lê todas as stores via `dbAll()`, serializa em JSON com metadados (`{"version": DB_VERSION, "exportedAt": ISO, "stores": {...}}`), dispara download do arquivo `dblabmanager-backup-YYYY-MM-DD.json`.
   - **Restaurar backup (JSON):** lê o arquivo JSON, valida o campo `version`, exibe alerta de confirmação ("Esta ação apagará todos os dados atuais e não pode ser desfeita"), executa `dbClear()` em cada store na ordem correta (dependências primeiro) e recarrega com `dbAdd()` em lote.
2. A ordem de restore deve respeitar dependências: `gerentes → supervisores → representantes → assessores → analistas → sistemas → clientes → chamados → envios → propostas → pacotes → pacote_registros → budget → perfis_acesso → usuarios → logs → audit_log`.

**Arquivos a enviar:**
- `pages/importacao.js` (adicionar seção de backup/restore)
- `core/db.js` (adicionar helper `dbClear(storeName)` se não existir)

**Critério de conclusão:** exportar gera JSON válido; restaurar a partir do JSON reconstrói o banco com todos os dados e relações intactos.

---

#### ETAPA 7E — Migração IIFE → ES Modules 🟢 BAIXA PRIORIDADE

**Problema:** Os módulos `core/*.js` e `pages/*.js` usam IIFE com `window.*`, impedindo tree-shaking e tornando dependências implícitas (qualquer módulo pode chamar qualquer `window.X` sem declaração).

**Estratégia de migração incremental (bottom-up com bridge):**

1. **Sub-etapa E1 — `core/*.js`** (menos dependências externas):
   - Converter `core/db.js`, `core/utils.js`, `core/acl.js`, `core/router.js`, `core/auth.js` para `export` nomeados
   - Criar `core/globals.js` como bridge temporário: importa tudo dos módulos ESM e re-expõe em `window.*` para os `pages/*.js` ainda em IIFE
   - Alterar `<script defer>` para `<script type="module">` apenas nos arquivos `core/`

2. **Sub-etapa E2 — `import/*.js`**:
   - Converter `import/import-g5.js`, `import/import-envio.js`, `import/import-esmeralda.js`
   - Atualizar imports nos módulos `core/` que os referenciam

3. **Sub-etapa E3 — `pages/*.js` em lotes**:
   - Lote 1: `pages/gerentes.js`, `pages/supervisores.js`, `pages/representantes.js`
   - Lote 2: `pages/laboratorios.js`, `pages/chamados.js`, `pages/divergencias.js`
   - Lote 3: demais páginas
   - Remover `window.*` atribuídos internamente; usar `export` + import no `app.js`

4. **Sub-etapa E4 — `app.js` como entry point**:
   - Criar `app.js` que importa todos os módulos e executa o boot
   - Remover `core/globals.js` (bridge não mais necessário)
   - `index.html` passa a carregar apenas `<script type="module" src="app.js">`

**Arquivos a enviar por sub-etapa:**
- E1: `core/db.js`, `core/utils.js`, `core/acl.js`, `core/router.js`, `core/auth.js`, `core/globals.js` (bridge), `index.html`
- E2: `import/import-g5.js`, `import/import-envio.js`, `import/import-esmeralda.js`
- E3 Lote 1: `pages/gerentes.js`, `pages/supervisores.js`, `pages/representantes.js`
- E3 Lote 2: `pages/laboratorios.js`, `pages/chamados.js`, `pages/divergencias.js`
- E3 Lote 3: demais `pages/*.js`
- E4: `app.js` (novo), `index.html` (atualizado), remoção de `core/globals.js`

**Critério de conclusão:** nenhum `window.*` atribuído nos módulos; todas as dependências declaradas via `import/export`.

---

#### ETAPA 7F — DocumentFragment nas Listagens Pesadas 🟡 MÉDIA PRIORIDADE

**Problema:** `laboratorios.js` e `divergencias.js` fazem `tbody.innerHTML = rows.map(renderRow).join('')`, destruindo e reconstruindo todo o DOM a cada filtro. Em listas com >500 registros causa reflow visível e travamento da UI.

**Implementação:**
1. Substituir o padrão `tbody.innerHTML = html` pelo padrão:
```js
function renderList(tbody, rows, renderRow) {
  const frag = document.createDocumentFragment();
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = renderRow(row); // escapeHtml já aplicado (Etapa 7B)
    frag.appendChild(tr);
  });
  tbody.replaceChildren(frag);
}
```
2. Aplicar em `pages/laboratorios.js` e `pages/divergencias.js` primeiro (maior impacto).
3. Após validação, aplicar nos demais `pages/*.js` com tabelas.

**Nota:** esta etapa deve ser executada **após a Etapa 7B** para garantir que `escapeHtml` já esteja aplicado nos `renderRow`.

**Arquivos a enviar:**
- `pages/laboratorios.js`
- `pages/divergencias.js`
- (fase 2) demais `pages/*.js` com tabelas

**Critério de conclusão:** filtros em listas grandes não causam reflow perceptível; DevTools Performance não registra layout thrashing.

---

#### ETAPA 7G — Paginação Cursor-Based no IndexedDB 🟢 BAIXA PRIORIDADE

**Problema:** `dbAll('clientes')` carrega todos os registros na memória antes de qualquer filtro. Em instalações com muitos clientes (>2.000), o tempo de carregamento inicial é significativo.

**Implementação:**
1. Adicionar em `core/db.js` a função:
```js
function dbPage(storeName, { page = 1, pageSize = 100, indexName, keyRange } = {})
```
usando `IDBObjectStore.openCursor()` com `advance()` para pular registros já vistos.
2. Atualizar `pages/laboratorios.js` para usar `dbPage` com controles de paginação (botões Anterior/Próximo + indicador "Página X de Y").
3. Os filtros de busca por texto continuam sendo aplicados em memória no lote carregado; filtros por índice (UF, representante) podem usar `IDBKeyRange` diretamente.

**Dependência:** esta etapa é mais simples após a Etapa 7E (ES Modules), pois `dbPage` pode ser exportada limpa sem `window.*`.

**Arquivos a enviar:**
- `core/db.js` (adicionar `dbPage`)
- `pages/laboratorios.js` (integrar paginação)

**Critério de conclusão:** página de Laboratórios carrega em <200ms independente do volume total de clientes.

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
│   ├── db-sidebar.js               ← ⚠️ Bug ativo — seção Financeiro duplicada (Etapa 6A)
│   ├── db-topbar.js                ← ✅ Custom Element, Shadow DOM, slot "actions"
│   ├── db-login.js                 ← ✅ Custom Element, Shadow DOM
│   ├── db-toast.js                 ← ✅ Custom Element, Shadow DOM
│   └── db-modal.js                 ← ✅ Custom Element, Light DOM + Shadow DOM híbrido
│
├── import/
│   ├── import-g5.js                ← ✅ processImport, IGNORE_REP, upsert supervisores
│   ├── import-envio.js             ← ✅ processEnvioImport, streaming, constantes
│   └── import-esmeralda.js         ← ✅ processEsmeraldaImport, mapCategoriaEsmeralda
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
│   ├── analistas.js                ← ⚠️ dias úteis sem feriados (Etapa 6B)
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

**Estrutura futura após Fases 7C e 7E:**
```
db-lab-manager/
├── app.js                          ← (Etapa 7E) entry point ES Module
├── styles/
│   ├── theme.css                   ← (Etapa 7C) variáveis :root
│   ├── base.css                    ← (Etapa 7C) reset + utilitários
│   └── pages.css                   ← (Etapa 7C) estilos específicos de páginas
└── ... (demais arquivos inalterados)
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

### FASE 6 — Hierarquia Comercial e Melhorias ✅ CONCLUÍDO

- [x] `DB_VERSION` 9 → 10: store `gerentes`, campo `fk_supervisor`, campo `gerente`
- [x] RLS hierárquico: gerente → supervisor → representante
- [x] `pages/gerentes.js` — CRUD completo
- [x] `pages/chamados.js` — CRUD standalone
- [x] `pages/representantes.js` — dropdown supervisor + FK
- [x] `pages/supervisores.js` — campo gerente
- [x] `pages/laboratorios.js` — criação de chamado desacoplada
- [x] `core/acl.js` — novos perfis e páginas na ACL_STRUCTURE
- [x] `db-sidebar.js` — itens `chamados` e `gerentes`
- [x] **ETAPA 6A** — Corrigir duplicação de seções no sidebar (`db-sidebar.js`)
- [x] **ETAPA 6B** — Feriados nacionais no cálculo de dias úteis (`core/utils.js` + `pages/analistas.js`)

---

### FASE 7 — Melhorias Técnicas Pós-Modularização ✅ CONCLUÍDO (parcial)

| Etapa | Descrição | Status |
|---|---|---|
| **7A** | Hash routing (`router.js` + `auth.js`) | ✅ Concluído |
| **7B** | Sanitização XSS (`escapeHtml`) em `utils.js` + páginas principais | ✅ Concluído |
| **7C** | Separação do CSS em `styles/theme.css`, `base.css`, `pages.css` | ✅ Concluído |
| **7D** | Export/Import de dados (backup JSON) em `pages/importacao.js` | ✅ Concluído |
| **7E** | Migração IIFE → ES Modules | ⏭ Adiado (risco/complexidade) |
| **7F** | DocumentFragment nas listagens (`laboratorios.js`, `divergencias.js`) | ✅ Concluído |
| **7G** | Paginação cursor-based IndexedDB | ⏭ Adiado (depende de 7E) |

**Notas:**
- 7E (ES Modules) adiada por risco de regressão em toda a base de código sem build step
- 7G (cursor-based pagination) adiada por dependência de 7E para exportação limpa de `dbPage`

---

## 8. Decisões de Arquitetura

| Decisão | Justificativa |
|---|---|
| **Web Components nativos** (sem React/Vue) | O projeto já usa JS puro sem build step. Introduzir um framework criaria segunda camada de runtime sem ganho. |
| **Shadow DOM `mode: 'open'`** | Permite inspeção via `element.shadowRoot` durante a migração incremental. Mudança para `closed` fica para depois da Etapa 7E. |
| **CSS Custom Properties para theming** | Único mecanismo que herda através da fronteira do Shadow DOM. Garante que `--navy`, `--accent` etc. do `:root` funcionem dentro dos componentes. |
| **IIFE + `window.*` para módulos `core/` e `pages/`** | `<script type="module">` isola o escopo. IIFE com `defer` garante ordem de carregamento e escopo global compartilhado. Migração para `import/export` nativo na Etapa 7E. |
| **`CustomEvent` com `composed: true`** | Eventos dentro do Shadow DOM ficam presos. `composed: true` faz o evento cruzar a fronteira e ser capturado no `document` do host. |
| **IndexedDB sem biblioteca** | Mantém zero dependências externas além de XLSX.js e Chart.js. |
| **Migração incremental** | Cada fase mantém o sistema funcionando. Não há "big bang rewrite". |
| **`updateTopbar()` em `utils.js`** | Helper emergiu durante a extração das páginas para evitar repetição do padrão em todos os módulos. |
| **Dependency injection via `setAuditHook`** | Evita ciclo de importação `db ← auth`. `db.js` não importa `auth.js`; `auth.js` injeta `auditLog` via setter após inicializar. |
| **`allowedRepIds` pré-calculado no login (decisão 5B)** | Mantém `applyDataFilter()` síncrona em todas as páginas. O custo ocorre uma única vez no login. |
| **`fk_supervisor` sem índice IDB** | O filtro RLS usa `allowedRepIds` em memória (já pré-calculado). Criar índice seria custo de escrita sem benefício de leitura. |
| **Campo texto `gerente` em supervisores (decisão 2B)** | Espelha o padrão legado de `representantes.supervisor`. Evita FK adicional. Risco de orphan aceito — mitigação via rename manual cuidadoso. |
| **Light DOM + Shadow DOM híbrido no `db-modal`** | Shadow DOM gerencia apenas estrutura e estilos do shell; conteúdo das páginas fica no Light DOM e recebe CSS global normalmente. |
| **Restore de backup destrutivo (decisão 7D)** | Merge entre instalações não é viável com `autoIncrement` sem remapeamento de FKs em runtime. Clear-and-load é a estratégia segura. |

---

## 9. Bugs Conhecidos e Dívidas Técnicas

| Arquivo | Tipo | Descrição | Prioridade | Etapa |
|---|---|---|---|---|
| `components/db-sidebar.js` | ~~Bug ativo~~ **Resolvido** | Seção "Financeiro" duplicada — corrigida na Etapa 6A. | — | **6A ✅** |
| Todos os `pages/*.js` | ~~Segurança~~ **Resolvido** | `escapeHtml` implementado e aplicado nas páginas principais (7B). | — | **7B ✅** |
| Geral | Qualidade | Ausência de testes automatizados. Toda regressão é detectada manualmente. | 🟡 Média | pós-7E |
| `core/*.js` e `pages/*.js` | Arquitetura | IIFEs a migrar para ES Modules nativos. Pré-requisito satisfeito. | 🟢 Baixa | **7E** ⏭ |
| `pages/analistas.js` | ~~Cálculo~~ **Resolvido** | Dias úteis agora incluem feriados nacionais brasileiros (6B). | — | **6B ✅** |
| `core/utils.js` | Código morto residual | `openModal()` / `closeModal()` como proxies — removíveis após 7E. | 🟢 Baixa | pós-7E |

---

## 10. Ordem de Execução Recomendada

```
CONCLUÍDO ✅
  ├─► ETAPA 6A — Corrigir sidebar duplicado
  ├─► ETAPA 6B — Feriados nacionais
  ├─► ETAPA 7A — Hash routing
  ├─► ETAPA 7B — escapeHtml
  ├─► ETAPA 7C — Separação CSS
  ├─► ETAPA 7D — Backup/Restore JSON
  └─► ETAPA 7F — DocumentFragment

ADIADO ⏭
  ├─► ETAPA 7E — ES Modules (risco alto, zero build step)
  └─► ETAPA 7G — Paginação cursor-based (depende de 7E)

FUTURO
  └─► Testes de regressão automatizados (Playwright/Cypress)
      Avaliação de Shadow DOM mode: 'closed'
      Remoção de openModal/closeModal proxies de utils.js
```

---

*Documento atualizado em: maio de 2026 — Fases 1–7 concluídas (7E e 7G adiadas por complexidade) · DB Lab Manager — Diagnósticos do Brasil*
