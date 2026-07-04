---
name: tasks
description: Decomposição e gates da Visão 360 do Cliente (v1 — cabeçalho + backlog GUT + histórico de OS + painel condicional de equipamentos). Puxe ao implementar.
alwaysApply: false
---

# Tasks — Visão 360 do Cliente (v1, sub-tela read-only do PCM)

> Nenhuma task executada ainda — resultado de planejamento (`@sm`). Sem migration nova (RLS de
> `pcm.clientes`/`pcm.ordens_servico` já existe — `SELECT` gated por módulo `pcm` desde
> `0002_E00-S05_perfis_rbac.sql`, ajustada por `0009_E00-S09_rls_modulos.sql` para o claim
> `user_modulos`; confirmado por leitura direta das migrations, não suposição). `E01-S11`
> (`pcm.tecnicos_cache`/`pcm.equipamentos_cache`) **não está implementada nesta build** — confirmado:
> não existe migration `0012` (ou qualquer outra) que crie essas tabelas em `supabase/migrations/`,
> e o ROADMAP marca `E01-S11` como "Planejado, sem owner". O painel condicional (AC-6) portanto
> **vai exercitar o caminho de degradação de verdade** nesta build — não é só teste teórico.

## Estrutura de arquivos da feature (hexagonal, mesmo padrão de `features/config/`)

```
apps/web/src/features/pcm/
  domain/
    cliente-360.ts                              # NOVO — classificação pura (aberto/histórico, placeholders)
    cliente-360.test.ts                          # NOVO
    priorizacao-backlog.ts                       # existente — REAPROVEITAR classificarPrioridade()
  application/
    cliente-360-gateway.ts                       # NOVO — porta (interface) [+ listarClientes/ClienteResumo, Task 18]
    obter-visao-cliente.ts                       # NOVO — caso de uso principal
    obter-visao-cliente.test.ts                  # NOVO
    listar-clientes.ts                           # NOVO — caso de uso da lista mínima (Task 18)
    listar-clientes.test.ts                      # NOVO
  infrastructure/
    supabase-cliente-360-adapter.ts               # NOVO — implementa a porta
    supabase-cliente-360-adapter.integration.test.ts  # NOVO
  pages/
    VisaoClientePage.tsx                          # NOVO — orquestra estado + gating
    ListaClientesPage.tsx                         # NOVO — lista mínima de clientes (Task 18)
  components/                                     # pasta nova em pcm/ (hoje só existe domain/)
    CabecalhoCliente.tsx                           # NOVO — AC-2
    PainelBacklog.tsx                              # NOVO — AC-3, AC-5
    PainelHistorico.tsx                            # NOVO — AC-4, AC-5
    PainelEquipamentos.tsx                         # NOVO — AC-6
    ClienteNaoEncontrado.tsx                       # NOVO — AC-8
apps/web/src/app/
  HomePage.tsx                                    # TOCAR — wiring mínimo de entrada (ver Task 15)
docs/glossary.md                                   # TOCAR — termo "Visão 360 do Cliente" (ver DoD)
```

## Plano

| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|-----------------|--------|
| 1  | Criar `apps/web/src/features/pcm/components/` (pasta nova — hoje `pcm/` só tem `domain/`) | — (setup) | — | `ls` confirma pasta | **done** |
| 2  | `domain/cliente-360.ts`: `ehStatusHistorico(status)` / `ehStatusEmAberto(status)` (fonte única da regra `status IN ('finalizado','cancelado')` — as duas funções devem ser complementares e usadas tanto pelo backlog quanto pelo histórico, para nenhuma OS "sumir" entre os painéis, ver AUTO-DECISION #1 da spec) + `rotuloOuPlaceholder(valor, textoVazio)` (AC-2: `cnpj`/`auvo_id` nulos → rótulo neutro, ex. "—") | AC-2, AC-3, AC-4 | 1 | `pnpm test -- cliente-360` | **done** (exporta `STATUS_HISTORICO`, reusado pelo adapter como fonte única) |
| 3  | `domain/cliente-360.test.ts` — casos: status em cada bucket (`solicitacao`,`planejamento`,`em_execucao` → aberto; `finalizado`,`cancelado` → histórico), placeholder com valor nulo/vazio/presente `[P]` | AC-2, AC-3, AC-4 | 2 | `pnpm test` | **done** (7 testes verdes) |
| 4  | `application/cliente-360-gateway.ts` — porta com 4 métodos: `buscarCliente(id): Promise<ClienteHeader \| null>`, `listarBacklogCliente(id): Promise<OrdemServicoResumo[]>`, `listarHistoricoCliente(id): Promise<OrdemServicoResumo[]>`, `listarEquipamentosCliente(clienteId, auvoId): Promise<EquipamentoResumo[] \| "indisponivel">` — `"indisponivel"` é um terceiro estado explícito (distinto de `[]` vazio) para o gateway sinalizar "tabela/cache não existe ou não pôde ser consultado" sem lançar exceção até a application (AC-6) | AC-1..AC-8 (contrato) | — | `pnpm run typecheck` | **done** (tipo `ResultadoEquipamentos = EquipamentoResumo[] \| "indisponivel"`) |
| 5  | `application/obter-visao-cliente.ts` — caso de uso: chama `buscarCliente`; se `null` → retorna `{ tipo: "nao_encontrado" }` (AC-8) sem chamar as demais queries; senão `Promise.all` de backlog/histórico/equipamentos e retorna `{ tipo: "ok", cliente, backlog, historico, equipamentos }` | AC-2, AC-3, AC-4, AC-5, AC-6, AC-8 | 2, 4 | `pnpm test -- obter-visao-cliente` | **done** |
| 6  | `application/obter-visao-cliente.test.ts` (gateway mock, mesmo padrão de `listar-grupos.test.ts`) — casos: cliente não encontrado (AC-8) · cliente sem nenhuma OS → backlog e histórico vazios, sem erro (AC-5) · equipamentos `"indisponivel"` não derruba o restante (AC-6) · equipamentos com lista real é repassada como está `[P]` | AC-2, AC-3, AC-4, AC-5, AC-6, AC-8 | 5 | `pnpm test` | **done** (6 testes verdes) |
| 7  | `infrastructure/supabase-cliente-360-adapter.ts` — `buscarCliente`: `.schema('pcm').from('clientes').select('id,nome,cnpj,auvo_id,ativo').eq('id', id).is('deleted_at', null).maybeSingle()` (usar `maybeSingle()`, não `single()` — `single()` lança erro em 0 linhas, o que quebraria AC-8 em vez de sinalizar "não encontrado" via retorno `null`) | AC-2, AC-8 | 4 | `pnpm run typecheck` | **done** |
| 8  | `supabase-cliente-360-adapter.ts` — `listarBacklogCliente`: `.from('ordens_servico').select('id,numero,titulo,categoria,status,score_pcm,gravidade,urgencia,tendencia,created_at').eq('client_id', id).is('deleted_at', null).not('status', 'in', '(finalizado,cancelado)').order('score_pcm', { ascending: false }).order('created_at', { ascending: false })` — ordenação **inteiramente no servidor** (reaproveita `idx_os_score_desc`), sem recálculo/sort no client (AC-3, mesma verdade do backlog GUT de E01-S01) | AC-3 | 7 | `pnpm run typecheck` | **done** (filtro NOT IN derivado de `STATUS_HISTORICO` do domínio) |
| 9  | `supabase-cliente-360-adapter.ts` — `listarHistoricoCliente`: `.eq('client_id', id).is('deleted_at', null).in('status', ['finalizado','cancelado']).order('auvo_synced_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(50)` — `.order()` encadeado gera `ORDER BY auvo_synced_at DESC NULLS LAST, created_at DESC` no Postgres, cobrindo o fallback pedido em AC-4 sem `coalesce` manual. [AUTO-DECISION] limite de 50 registros — spec permite paginar o histórico (Casos de borda) desde que o backlog nunca seja cortado; 50 é um valor de partida arbitrário e seguro para não estourar payload, `@dev` pode ajustar; não é decisão de produto | AC-4 | 7 | `pnpm run typecheck` | **done** |
| 10 | `supabase-cliente-360-adapter.ts` — `listarEquipamentosCliente(clienteId, auvoId)`: se `auvoId === null`, retorna `[]` direto (sem query — AC-6, Casos de borda "cliente com `auvo_id IS NULL`"); senão tenta `.schema('pcm').from('equipamentos_cache').select(...).eq(<coluna de vínculo>, auvoId).eq('ativo', true)` dentro de `try/catch`: se `error.code === 'PGRST205'` (tabela fora do schema cache do PostgREST — é o erro esperado quando `E01-S11` ainda não foi mergeada) **ou** `error.code === '42P01'` (relation does not exist, caso a tabela exista mas não esteja exposta), retorna `"indisponivel"`; qualquer outro erro é relançado (não pode virar degradação silenciosa de um bug real) | AC-6 | 7 | `pnpm run typecheck` + teste manual: rodar contra o Supabase local desta build (sem `equipamentos_cache`) e confirmar que retorna `"indisponivel"`, não exceção | **done (parcial — ver ASSUNÇÃO abaixo)**. Implementado com checagem de `error.code` (idioma do supabase-js, que retorna `{data,error}` em vez de lançar — não usei `try/catch` por isso; erro real ainda é relançado). **Teste manual contra Docker NÃO rodado** (sem Docker neste ambiente); o retorno `"indisponivel"` real do PostgREST fica coberto por `supabase-cliente-360-adapter.integration.test.ts` (self-skip) + o job `db-tests` do CI. Verificado por: unit da application (repasse de `"indisponivel"`) + revisão de código. |
| 11 | `infrastructure/supabase-cliente-360-adapter.integration.test.ts` — mesmo padrão self-skip de `supabase-config-adapter.integration.test.ts` (roda só com `SUPABASE_LOCAL`/Docker disponível) | AC-2, AC-3, AC-4, AC-6, AC-8 | 7, 8, 9, 10 | `pnpm test` (self-skip sem Docker; gate real é `db-tests` do CI) | **done** (4 casos, self-skip sem `SUPABASE_LOCAL`) |
| 12 | `components/CabecalhoCliente.tsx` — `nome`, `cnpj`, `auvo_id` (via `rotuloOuPlaceholder`), indicador `ativo`/inativo `[P]` | AC-2 | 2 | `pnpm run typecheck` | **done** |
| 13 | `components/PainelBacklog.tsx` — lista o array já ordenado do adapter (não reordena); badge de prioridade **reaproveitando `classificarPrioridade(score_pcm)`** de `domain/priorizacao-backlog.ts` (não duplicar a lógica de faixas); estado vazio explícito "Nenhuma OS em aberto" quando array vazio (AC-5) `[P]` | AC-3, AC-5 | 2, 8 | `pnpm run typecheck` | **done** (reusa `classificarPrioridade`; guarda `faixaSegura` evita crash com score fora de faixa) |
| 14 | `components/PainelHistorico.tsx` — exibe `status` (refletindo `auvo_sync_status`/sincronização), estado vazio "Nenhum histórico ainda" (AC-5) `[P]` | AC-4, AC-5 | 2, 9 | `pnpm run typecheck` | **done** |
| 15 | `components/PainelEquipamentos.tsx` — 3 estados possíveis do resultado (`"indisponivel"` → placeholder "Integração de campo indisponível"; `[]` → "Sem equipamentos vinculados"; lista → renderiza) — **nenhum dos dois estados vazios lança erro** (AC-6) `[P]` | AC-6 | 2, 10 | `pnpm run typecheck` | **done** |
| 16 | `components/ClienteNaoEncontrado.tsx` — estado "cliente não encontrado" sem detalhe de implementação vazado (AC-8) `[P]` | AC-8 | — | `pnpm run typecheck` | **done** |
| 17 | `pages/VisaoClientePage.tsx` — recebe `clienteId: string` via prop; gate **AC-1**: `usePermissoes().podeAcessar('pcm', 'leitura')` — se falso, não renderiza nada do conteúdo (mesmo padrão de `podeVerModulo` em `HomePage.tsx`); orquestra `obterVisaoCliente(supabaseCliente360Adapter, clienteId)` e roteia entre `nao_encontrado` / `ok` (que por sua vez compõe os 4 componentes de painel); **nenhum elemento de escrita/ação de mutação em nenhum estado** (AC-7 — revisão explícita antes do PASS: nenhum botão de editar/repriorizar/mudar status/criar OS/disparar sync) | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 | 5, 12, 13, 14, 15, 16 | `pnpm run typecheck` + `pnpm run build` | **done** (AC-7 confirmado por scan: único `onClick`/`<button>` é "Tentar novamente" = re-leitura, não mutação) |
| 18 | Wiring de entrada em `HomePage.tsx` — lista mínima de clientes no PCM que navega até a Visão 360. **DECIDIDO pelo PO (Lucas): lista mínima no mesmo PR** (não esperar o Hub de OS/E01-S07 — OPEN-QUESTION #3 resolvida). Item "Clientes" no `PCM_NAV` (grupo CADASTROS) → `ListaClientesPage` (`nome`/`cnpj`/`ativo` de `pcm.clientes`, ordenado `nome` asc no servidor, mesma RLS de `buscarCliente`, sem permissão nova) → clique numa linha abre `VisaoClientePage`. Navegação por `useState` local (`pcmView` + `clienteSelecionado`), MESMO padrão de abas do app — sem `react-router` (over-engineering p/ escopo "lista mínima"). Sem filtro/busca/paginação nesta v1 (fora de escopo). | (nenhuma AC formal cobre isto — navegação) | 17 | `pnpm run lint`+`typecheck`+`test`+`build` (unit da listagem) + inspeção manual | **done** — ver observação "Task 18 — lista mínima de clientes" abaixo. |
| 19 | `docs/glossary.md` — adicionar termo "Visão 360 do Cliente" (não existe hoje — confirmado via grep) | — | 17 | inspeção | **done** |
| 20 | `docs/epics/ROADMAP.md` + `docs/STATE.md` — marcar `E01-S12` implementado, AC verdes/parciais conforme o que passou | — | 1-19 | inspeção | **done** |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual (exceto onde marcado
> "inspeção"/"teste manual"). `[P]` = pode ser feita em paralelo com as tasks adjacentes do mesmo
> bloco (mesma convenção de `E01-S11`/`E01-S10`).

## Observações / decisões (registradas nesta sessão de planejamento)

### [AUTO-DECISION] Ordenação do histórico via `.order()` encadeado, sem `coalesce` manual
A spec pede `auvo_synced_at desc` com fallback `created_at desc`. PostgREST aceita múltiplos
`.order()` como `ORDER BY` composto — `nullsFirst: false` já empurra os `NULL` de `auvo_synced_at`
para o fim, e o segundo `.order('created_at', ...)` desempata. Evita reimplementar em SQL bruto ou
recalcular no client. Razão: é a forma idiomática do adapter já usado em `config/` (nunca usa RPC
para leitura simples), reduz superfície de erro.

### [AUTO-DECISION] Limite de 50 no histórico (Task 9)
Detalhe de implementação explicitamente delegado ao `@dev` pela spec ("Casos de borda" — tamanho/
estratégia de paginação é detalhe de implementação). Escolhido 50 como ponto de partida seguro; não
é decisão de produto, pode mudar sem reabrir a spec.

### [AUTO-DECISION] Detecção de tabela ausente por `error.code` (Task 10)
`equipamentos_cache`/`tecnicos_cache` (E01-S11) não existem nesta build. A forma correta de
detectar "tabela não exposta" via `@supabase/supabase-js` é o código de erro do PostgREST
(`PGRST205`) — decisão técnica de implementação, não de produto; documentada para o `@dev` não
precisar redescobrir isso por tentativa e erro.

### Task 18 — lista mínima de clientes (RESOLVE OPEN-QUESTION #3, decisão de produto do Lucas)
O PO (Lucas) decidiu entregar a **lista mínima de clientes no mesmo PR** (opção (b) da
OPEN-QUESTION #3 abaixo). Implementação (escopo enxuto, nada além do pedido):
- **`application/cliente-360-gateway.ts`**: adicionado `listarClientes(): Promise<ClienteResumo[]>`
  ao gateway existente (NÃO um gateway paralelo) + novo read-model `ClienteResumo`
  (`id`/`nome`/`cnpj`/`ativo` — sem `auvoId`, que a lista não usa).
- **`infrastructure/supabase-cliente-360-adapter.ts`**: `listarClientes` = `select id,nome,cnpj,ativo`
  de `pcm.clientes`, `deleted_at IS NULL`, `order('nome', asc)` **no servidor**. Mesma tabela/RLS de
  `buscarCliente` (SELECT gated por módulo `pcm`, `0009_E00-S09_rls_modulos.sql`) — **sem permissão
  nova**.
- **`application/listar-clientes.ts`** (+ `.test.ts`, 3 casos): passthrough fino sobre o gateway,
  mesmo estilo de `listarGrupos`.
- **`pages/ListaClientesPage.tsx`**: lista read-only, cada linha clicável → `onSelecionar(id)`. Mesmo
  gate AC-1 (`podeAcessar('pcm','leitura')`) e estados carregando/erro(retry)/vazio da
  `VisaoClientePage`. Nenhuma ação de mutação (só navegação).
- **`app/HomePage.tsx`**: item "Clientes" no `PCM_NAV` (grupo CADASTROS) + estado local
  `pcmView`/`clienteSelecionado` (MESMO padrão `useState` de abas — **sem lib de rotas**). Botão
  "Voltar para clientes" (re-navegação, não mutação) mora na HomePage, **não** dentro da
  `VisaoClientePage` — que permanece read-only intacta (AC-7 preservado).
- **Fora de escopo (não feito, de propósito):** busca/filtro/paginação, novo painel de produto,
  edição de cliente, `react-router`.
- **Gates rodados nesta sessão:** `pnpm run lint` ✅ · `typecheck` ✅ · `test` ✅ (93 pass/9 skip;
  +3 de `listar-clientes.test.ts`) · `build` ✅ · `audit-esteira` ✅ · `eval-spec-fidelity` ✅.
- Não é `SPEC_DEVIATION`: é a resposta a uma decisão de produto explícita (a spec era silente sobre
  navegação); documentado aqui a pedido do lead.

### [OPEN-QUESTION #3 — RESOLVIDA] Como o usuário chega numa Visão 360 de um cliente específico?
**Resolução (2026-07-03):** PO escolheu a opção (b) — lista mínima de clientes no mesmo PR (Task 18
acima, `done`). Registro original mantido abaixo para contexto.
`product.md` §6.2 diz que a tela é "acessada a partir do cliente/OS" — mas **investigação confirmou
que isso não existe hoje**: `apps/web/src/app/HomePage.tsx` não usa nenhuma lib de rotas (sem
`react-router`/similar no `package.json`), navega só por `useState` de abas dentro da própria
página, e **não há nenhuma tela de lista de clientes nem qualquer tela que referencie
`client_id`/`clientId` no código atual** (grep confirmado, zero resultados). O "Hub de OS" (E01-S07,
que seria o ponto de entrada mais natural por OS) está "Planejado", não construído.
*Opções consideradas:* (a) esta story entrega só o componente `VisaoClientePage` parametrizado por
`clienteId`, testável isoladamente (unit/integration), e a navegação até ele fica para quando
`E01-S07` (Hub de OS) ou uma tela de lista de clientes existir — **mais fiel ao escopo estrito da
spec** (nenhuma AC testa navegação); (b) esta story inclui uma lista mínima de clientes como
wiring de entrada (Task 18 acima) — **recomendação do @sm**, porque sem isso a v1 não é
exercitável por um humano em produção, e o custo é baixo (reaproveita a mesma query de cabeçalho).
**Impacto se não resolvida:** Task 18 já está marcada como não-bloqueante — o `@dev` pode entregar
Tasks 1-17 e 19-20 (todas as 8 AC) sem decidir isto, e a navegação final é um ajuste de UI que não
muda contrato nenhum. Reportado para Lucas/PO decidir se quer a lista mínima no mesmo PR ou depois.

### Nota de segurança (não é gap, é confirmação) — AC-1 tem dois níveis, ambos já existentes
`usePermissoes().podeAcessar('pcm','leitura')` (gate de UI) e a RLS `ordens_servico_select`/
`clientes_select` (`0009_E00-S09_rls_modulos.sql`, gate real de banco via claim `user_modulos` do
JWT) já concordam: os dois checam "leitura ou escrita no módulo `pcm`, ou superadmin". Nenhuma
policy nova é necessária — confirmado lendo a migration, não assumido.

## Plano de teste
- **Unidade** (`domain/`): `cliente-360.test.ts` — bucketing de status (aberto vs. histórico, todos
  os valores do ciclo E01-S09/S10) e `rotuloOuPlaceholder` com valor nulo/vazio/presente.
- **Unidade** (`application/`): `obter-visao-cliente.test.ts` com gateway mockado (mesmo padrão de
  `listarGrupos.test.ts`) — cliente não encontrado (AC-8), cliente sem OS (AC-5), equipamentos
  `"indisponivel"` não derruba o resto (AC-6), caminho feliz completo.
- **Integração** (`infrastructure/`): `supabase-cliente-360-adapter.integration.test.ts`, self-skip
  sem `SUPABASE_LOCAL`/Docker (mesma ressalva de `E00-S10`/`E01-S09`/`E01-S10` nesta sessão — sem
  Docker disponível neste ambiente para rodar de verdade). Gate real: `db-tests` do CI quando o PR
  abrir.
- **Componentes/páginas**: sem teste de render automatizado — mesma convenção já em uso em
  `features/config/` (`GruposPage.tsx`/`UsuariosPage.tsx` não têm `.test.tsx`; só `domain`/
  `application` são testados). Validação de página fica para `typecheck` + `build` + revisão manual
  em browser (mesmo gap documentado em `docs/STATE.md` para E00-S10 — validação humana pendente
  antes do merge).
- **Aceite**: 1 teste (unidade ou integração) por AC, exceto AC-1 e AC-7, que são verificados por
  leitura de código + `typecheck`/`build` (gate de "nenhuma ação de escrita" é uma ausência a
  confirmar por revisão, não algo que um teste automatizado prova sozinho sem inventariar toda a
  UI) — sinalizar isso explicitamente na revisão adversarial antes do PASS.

## Divergências (SPEC_DEVIATION)
- **Nenhum SPEC_DEVIATION** — a implementação segue a spec e o schema existentes sem desviar.

### Correção pós-revisão @qa (achado C1, média — corrigida)
A revisão do @qa apontou que o `Promise.all` em `obter-visao-cliente.ts` relançava QUALQUER erro
inesperado de `listarEquipamentosCliente` (além do `PGRST205`/`42P01` já tratado no adapter — ex.:
E01-S11 mergear com nome de coluna diferente do assumido → `42703`/`PGRST204`), derrubando a página
inteira e contrariando o espírito de AC-6 ("a ausência do cache não é bloqueante para o restante").
**Corrigido**: a query de equipamentos passou a ser isolada num helper `carregarEquipamentos` com
`try/catch` → `"indisponivel"`; assim a falha degrada só o painel e não some com
cabeçalho/backlog/histórico. Backlog/histórico (conteúdo central) **continuam propagando** erro de
propósito (não é isolado). +2 testes em `obter-visao-cliente.test.ts` (erro inesperado isola; erro
em backlog propaga). Gates reexecutados: typecheck ✅, test **90 pass/9 skip** ✅.

### Assunções / incertezas registradas (não são SPEC_DEVIATION — a spec não fala do assunto)

- **[RESOLVIDO EM E01-S16] Nome da coluna de vínculo em `pcm.equipamentos_cache`.**
  A versão original desta story assumiu `cliente_auvo_id` enquanto E01-S11 ainda estava em paralelo.
  Depois de E01-S11 mergear, E01-S16 reconciliou o adapter para usar a coluna real
  `auvo_customer_id` (FK para `pcm.clientes.auvo_id`). O campo de exibição segue `nome`.

- **[VERIFICAÇÃO NÃO EXECUTADA — AC-6 caminho real] Degradação PGRST205 não rodada contra banco.**
  O teste manual pedido na Task 10 (rodar contra Supabase local sem `equipamentos_cache` e confirmar
  retorno `"indisponivel"`) **não pôde ser executado** — sem Docker/Supabase local neste ambiente
  (mesma ressalva de E00-S10/E01-S09/S10). O caminho está coberto por: (a) unit da application
  (`"indisponivel"` é repassado sem derrubar o resto — verde), (b) o teste de integração self-skip
  (`supabase-cliente-360-adapter.integration.test.ts`, roda no job `db-tests` do CI), e (c) revisão
  de código da lógica de `error.code`. **A execução real do retorno PGRST205 fica pendente do CI
  `db-tests` / validação humana antes do merge.**

- **[DESVIO TÉCNICO menor vs. Task 10] `error.code` em vez de `try/catch`.**
  A Task 10 descreve `try/catch`; o `@supabase/supabase-js` **não lança** em erro de query — retorna
  `{ data, error }`. Portanto a detecção correta é inspecionar `error.code` (idioma já usado no
  `supabase-config-adapter.ts`), não `try/catch`. Erros que não sejam PGRST205/42P01 continuam sendo
  relançados (`throw error`), preservando a intenção da task (não mascarar bug real). Detalhe de
  implementação, não muda contrato.

> (Ver também OPEN-QUESTION #3 acima — navegação até a Visão 360 adiada como decisão de produto,
> reportada ao Lucas/PO; Task 18 **não** foi implementada. Não é SPEC_DEVIATION: a spec não afirma
> nada sobre navegação.)

## Gates finais (rodar antes de considerar a story pronta para PR)
| Gate | Comando |
|------|---------|
| Lint | `pnpm run lint` |
| Typecheck | `pnpm run typecheck` |
| Testes | `pnpm test` |
| Build | `pnpm run build` |
| Esteira (audit) | `node scripts/audit-esteira.mjs` |
| Fidelidade da spec | `node scripts/eval-spec-fidelity.mjs` |

## Checklist de Definition of Done
- [x] AC-1 a AC-8 verdes **pelo gate executável** (unidade verde; AC-1/AC-7 por revisão de código
      explícita; AC-6 caminho real PGRST205 pendente de `db-tests` do CI — ver Assunções)
- [x] Nenhum `SPEC_DEVIATION` pendente (0 SPEC_DEVIATION; assunções/verificações pendentes
      registradas na seção Divergências)
- [x] Glossário atualizado — "Visão 360 do Cliente" adicionado a `docs/glossary.md` (Task 19)
- [x] Spec reflete o que foi construído (nenhuma mudança em `spec.md`; detecção de tabela ausente
      via `error.code` conforme AC-6, sem necessidade de ajustar a spec)
- [x] `docs/STATE.md` atualizado
- [x] OPEN-QUESTION #3 (navegação até a Visão 360) — **RESOLVIDA** pelo PO (Lucas): lista mínima de
      clientes no mesmo PR. Task 18 implementada (`ListaClientesPage` + wiring `useState` na
      `HomePage`), gates verdes. Ver observação "Task 18 — lista mínima de clientes".
- [x] Revisão adversarial rodada antes do PASS — AC-6 (degradação sem `equipamentos_cache`: caminho
      real nesta build, coberto por unit da application + revisão de código; execução real do
      PGRST205 pendente do CI) e AC-7 (scan confirmou zero botões de mutação nos 4 painéis; único
      `onClick` é re-leitura "Tentar novamente")

### Gates executados nesta sessão (rodados pelo @dev, não assumidos)
| Gate | Comando | Resultado |
|------|---------|-----------|
| Lint | `pnpm run lint` (Biome) | ✅ verde (88 arquivos) |
| Typecheck | `pnpm run typecheck` | ✅ verde (4 pacotes) |
| Testes | `pnpm test` | ✅ 93 passed, 9 skipped (integração self-skip sem Docker) — inclui 7 (domain) + 6 (application Visão 360) + 3 (`listar-clientes`, Task 18) |
| Build | `pnpm run build` | ✅ verde (vite, 1877 módulos) |
| Esteira | `node scripts/audit-esteira.mjs` | ✅ verde (124 docs OK) — sem o vermelho pré-existente de `.claude/agents/*.md` (esses arquivos não estão neste worktree) |
| Fidelidade spec | `node scripts/eval-spec-fidelity.mjs` | ✅ exit 0 (só avalia specs `NNNN-*`; ignora `E0N-S0N-*` por design — E01-S12 não é avaliada, comportamento conhecido) |

> **Task 18 (lista mínima de clientes) — gates re-rodados nesta sessão:** `pnpm run lint` ✅ (91
> arquivos) · `typecheck` ✅ (4 pacotes) · `pnpm test` ✅ (93 pass/9 skip) · `pnpm run build` ✅ (vite,
> 1877 módulos) · `audit-esteira` ✅ · `eval-spec-fidelity` ✅.

**Não executado (sem ambiente):** teste manual da Task 10 contra Supabase local (sem Docker) e
validação humana em browser das páginas/componentes (mesma convenção de `features/config/`, que não
tem teste de render). Ambos ficam para o CI `db-tests` + revisão humana antes do merge.
