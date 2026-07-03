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
    cliente-360-gateway.ts                       # NOVO — porta (interface)
    obter-visao-cliente.ts                       # NOVO — caso de uso principal
    obter-visao-cliente.test.ts                  # NOVO
  infrastructure/
    supabase-cliente-360-adapter.ts               # NOVO — implementa a porta
    supabase-cliente-360-adapter.integration.test.ts  # NOVO
  pages/
    VisaoClientePage.tsx                          # NOVO — orquestra estado + gating
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
| 1  | Criar `apps/web/src/features/pcm/components/` (pasta nova — hoje `pcm/` só tem `domain/`) | — (setup) | — | `ls` confirma pasta | todo |
| 2  | `domain/cliente-360.ts`: `ehStatusHistorico(status)` / `ehStatusEmAberto(status)` (fonte única da regra `status IN ('finalizado','cancelado')` — as duas funções devem ser complementares e usadas tanto pelo backlog quanto pelo histórico, para nenhuma OS "sumir" entre os painéis, ver AUTO-DECISION #1 da spec) + `rotuloOuPlaceholder(valor, textoVazio)` (AC-2: `cnpj`/`auvo_id` nulos → rótulo neutro, ex. "—") | AC-2, AC-3, AC-4 | 1 | `pnpm test -- cliente-360` | todo |
| 3  | `domain/cliente-360.test.ts` — casos: status em cada bucket (`solicitacao`,`planejamento`,`em_execucao` → aberto; `finalizado`,`cancelado` → histórico), placeholder com valor nulo/vazio/presente `[P]` | AC-2, AC-3, AC-4 | 2 | `pnpm test` | todo |
| 4  | `application/cliente-360-gateway.ts` — porta com 4 métodos: `buscarCliente(id): Promise<ClienteHeader \| null>`, `listarBacklogCliente(id): Promise<OrdemServicoResumo[]>`, `listarHistoricoCliente(id): Promise<OrdemServicoResumo[]>`, `listarEquipamentosCliente(clienteId, auvoId): Promise<EquipamentoResumo[] \| "indisponivel">` — `"indisponivel"` é um terceiro estado explícito (distinto de `[]` vazio) para o gateway sinalizar "tabela/cache não existe ou não pôde ser consultado" sem lançar exceção até a application (AC-6) | AC-1..AC-8 (contrato) | — | `pnpm run typecheck` | todo |
| 5  | `application/obter-visao-cliente.ts` — caso de uso: chama `buscarCliente`; se `null` → retorna `{ tipo: "nao_encontrado" }` (AC-8) sem chamar as demais queries; senão `Promise.all` de backlog/histórico/equipamentos e retorna `{ tipo: "ok", cliente, backlog, historico, equipamentos }` | AC-2, AC-3, AC-4, AC-5, AC-6, AC-8 | 2, 4 | `pnpm test -- obter-visao-cliente` | todo |
| 6  | `application/obter-visao-cliente.test.ts` (gateway mock, mesmo padrão de `listar-grupos.test.ts`) — casos: cliente não encontrado (AC-8) · cliente sem nenhuma OS → backlog e histórico vazios, sem erro (AC-5) · equipamentos `"indisponivel"` não derruba o restante (AC-6) · equipamentos com lista real é repassada como está `[P]` | AC-2, AC-3, AC-4, AC-5, AC-6, AC-8 | 5 | `pnpm test` | todo |
| 7  | `infrastructure/supabase-cliente-360-adapter.ts` — `buscarCliente`: `.schema('pcm').from('clientes').select('id,nome,cnpj,auvo_id,ativo').eq('id', id).is('deleted_at', null).maybeSingle()` (usar `maybeSingle()`, não `single()` — `single()` lança erro em 0 linhas, o que quebraria AC-8 em vez de sinalizar "não encontrado" via retorno `null`) | AC-2, AC-8 | 4 | `pnpm run typecheck` | todo |
| 8  | `supabase-cliente-360-adapter.ts` — `listarBacklogCliente`: `.from('ordens_servico').select('id,numero,titulo,categoria,status,score_pcm,gravidade,urgencia,tendencia,created_at').eq('client_id', id).is('deleted_at', null).not('status', 'in', '(finalizado,cancelado)').order('score_pcm', { ascending: false }).order('created_at', { ascending: false })` — ordenação **inteiramente no servidor** (reaproveita `idx_os_score_desc`), sem recálculo/sort no client (AC-3, mesma verdade do backlog GUT de E01-S01) | AC-3 | 7 | `pnpm run typecheck` | todo |
| 9  | `supabase-cliente-360-adapter.ts` — `listarHistoricoCliente`: `.eq('client_id', id).is('deleted_at', null).in('status', ['finalizado','cancelado']).order('auvo_synced_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(50)` — `.order()` encadeado gera `ORDER BY auvo_synced_at DESC NULLS LAST, created_at DESC` no Postgres, cobrindo o fallback pedido em AC-4 sem `coalesce` manual. [AUTO-DECISION] limite de 50 registros — spec permite paginar o histórico (Casos de borda) desde que o backlog nunca seja cortado; 50 é um valor de partida arbitrário e seguro para não estourar payload, `@dev` pode ajustar; não é decisão de produto | AC-4 | 7 | `pnpm run typecheck` | todo |
| 10 | `supabase-cliente-360-adapter.ts` — `listarEquipamentosCliente(clienteId, auvoId)`: se `auvoId === null`, retorna `[]` direto (sem query — AC-6, Casos de borda "cliente com `auvo_id IS NULL`"); senão tenta `.schema('pcm').from('equipamentos_cache').select(...).eq(<coluna de vínculo>, auvoId).eq('ativo', true)` dentro de `try/catch`: se `error.code === 'PGRST205'` (tabela fora do schema cache do PostgREST — é o erro esperado quando `E01-S11` ainda não foi mergeada) **ou** `error.code === '42P01'` (relation does not exist, caso a tabela exista mas não esteja exposta), retorna `"indisponivel"`; qualquer outro erro é relançado (não pode virar degradação silenciosa de um bug real) | AC-6 | 7 | `pnpm run typecheck` + teste manual: rodar contra o Supabase local desta build (sem `equipamentos_cache`) e confirmar que retorna `"indisponivel"`, não exceção | todo |
| 11 | `infrastructure/supabase-cliente-360-adapter.integration.test.ts` — mesmo padrão self-skip de `supabase-config-adapter.integration.test.ts` (roda só com `SUPABASE_LOCAL`/Docker disponível) | AC-2, AC-3, AC-4, AC-6, AC-8 | 7, 8, 9, 10 | `pnpm test` (self-skip sem Docker; gate real é `db-tests` do CI) | todo |
| 12 | `components/CabecalhoCliente.tsx` — `nome`, `cnpj`, `auvo_id` (via `rotuloOuPlaceholder`), indicador `ativo`/inativo `[P]` | AC-2 | 2 | `pnpm run typecheck` | todo |
| 13 | `components/PainelBacklog.tsx` — lista o array já ordenado do adapter (não reordena); badge de prioridade **reaproveitando `classificarPrioridade(score_pcm)`** de `domain/priorizacao-backlog.ts` (não duplicar a lógica de faixas); estado vazio explícito "Nenhuma OS em aberto" quando array vazio (AC-5) `[P]` | AC-3, AC-5 | 2, 8 | `pnpm run typecheck` | todo |
| 14 | `components/PainelHistorico.tsx` — exibe `status` (refletindo `auvo_sync_status`/sincronização), estado vazio "Nenhum histórico ainda" (AC-5) `[P]` | AC-4, AC-5 | 2, 9 | `pnpm run typecheck` | todo |
| 15 | `components/PainelEquipamentos.tsx` — 3 estados possíveis do resultado (`"indisponivel"` → placeholder "Integração de campo indisponível"; `[]` → "Sem equipamentos vinculados"; lista → renderiza) — **nenhum dos dois estados vazios lança erro** (AC-6) `[P]` | AC-6 | 2, 10 | `pnpm run typecheck` | todo |
| 16 | `components/ClienteNaoEncontrado.tsx` — estado "cliente não encontrado" sem detalhe de implementação vazado (AC-8) `[P]` | AC-8 | — | `pnpm run typecheck` | todo |
| 17 | `pages/VisaoClientePage.tsx` — recebe `clienteId: string` via prop; gate **AC-1**: `usePermissoes().podeAcessar('pcm', 'leitura')` — se falso, não renderiza nada do conteúdo (mesmo padrão de `podeVerModulo` em `HomePage.tsx`); orquestra `obterVisaoCliente(supabaseCliente360Adapter, clienteId)` e roteia entre `nao_encontrado` / `ok` (que por sua vez compõe os 4 componentes de painel); **nenhum elemento de escrita/ação de mutação em nenhum estado** (AC-7 — revisão explícita antes do PASS: nenhum botão de editar/repriorizar/mudar status/criar OS/disparar sync) | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 | 5, 12, 13, 14, 15, 16 | `pnpm run typecheck` + `pnpm run build` | todo |
| 18 | Wiring de entrada em `HomePage.tsx` — **ver observação/decisão abaixo antes de codar** (não há hoje nenhuma tela de lista de clientes nem roteamento por id no app; este é o gap real de navegação, não uma trivialidade). [AUTO-DECISION] adicionar item "Clientes" ao `PCM_NAV`, com uma lista mínima (`nome`/`cnpj`/`ativo` de `pcm.clientes`, mesma query já usada pelo cabeçalho) que abre `VisaoClientePage` ao clicar numa linha — é wiring de navegação, não um novo painel de produto (reaproveita dado já buscado, não introduz feature nova). **Não bloqueia o DoD** desta story se ficar incompleto — as ACs testam o conteúdo da página dado um `clienteId`, não a navegação até ela (ver OPEN-QUESTION #3) | (nenhuma AC formal cobre isto) | 17 | inspeção manual (clicar no fluxo) | todo — condicional, não bloqueia DoD |
| 19 | `docs/glossary.md` — adicionar termo "Visão 360 do Cliente" (não existe hoje — confirmado via grep) | — | 17 | inspeção | todo |
| 20 | `docs/epics/ROADMAP.md` + `docs/STATE.md` — marcar `E01-S12` implementado, AC verdes/parciais conforme o que passou | — | 1-19 | inspeção | todo |

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

### [OPEN-QUESTION #3] Como o usuário chega numa Visão 360 de um cliente específico?
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
- Nenhuma — story ainda não implementada. (Ver OPEN-QUESTION #3 acima — não é SPEC_DEVIATION porque
  a spec não afirma nada sobre navegação; é lacuna de produto não coberta por nenhum AC.)

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
- [ ] AC-1 a AC-8 verdes **pelo gate executável** (unidade + integração onde aplicável; AC-1/AC-7
      por revisão de código explícita, ver Plano de teste)
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Glossário atualizado — "Visão 360 do Cliente" adicionado a `docs/glossary.md` (Task 19)
- [ ] Spec reflete o que foi construído (nenhuma mudança esperada em `spec.md`; se AC-6 revelar
      necessidade real de ajuste na detecção de tabela ausente, registrar como SPEC_DEVIATION aqui)
- [ ] `docs/STATE.md` atualizado
- [ ] OPEN-QUESTION #3 (navegação até a Visão 360) respondida por Lucas/PO ou explicitamente
      adiada com registro de decisão
- [ ] Revisão adversarial (`/revisao-adversarial`) rodada antes do PASS final — em especial AC-6
      (degradação sem `equipamentos_cache`, que é o caminho real nesta build, não hipotético) e
      AC-7 (garantir que nenhum botão de mutação foi introduzido em nenhum dos 4 painéis)
