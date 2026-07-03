---
name: tasks
description: Decomposição e gates da fundação de integração Auvo. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Integração Auvo: Fundação

> Implementação retomada por `@dev` (sessão Claude, 2026-07-03). Status abaixo reflete o que foi
> **verificado por gate executável** vs. **escrito e revisado à mão sem poder rodar** — este
> ambiente não tem Deno CLI, então nenhum `.ts` de Edge Function foi type-checked/executado; só os
> gates Node (`lint:migrations`, `audit-esteira`, `eval-spec-fidelity`) rodaram de verdade. Ver
> Divergências abaixo para os gaps reais.

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|-----------------|--------|
| 1  | Confirmar com Fabrício `taskTypeId` de `levantamento`/`emergencial` e mapeamento `prioridade` GUT → `priority` Auvo (Questões em aberto do `design.md`) | AC-7 | — | resposta registrada em `design.md` (remove a questão em aberto) | todo — decisão de produto, fora do alcance desta sessão de dev |
| 2  | ~~`supabase secrets set AUVO_API_KEY AUVO_USER_TOKEN` manual~~ — **já resolvido**: secrets em GitHub Actions (`gh secret list`) + `.github/workflows/sync-secrets.yml` sincroniza no push a `main`/`workflow_dispatch`. Só falta rodar o workflow uma vez após o 1º deploy das Edge Functions | — | — | `gh workflow run sync-secrets.yml` + `supabase secrets list` mostra as chaves | done |
| 3  | Cliente HTTP Auvo compartilhado (`supabase/functions/_shared/auvo/client.ts`): login cacheado, retry 401, backoff 429 | AC-1 a AC-6 | — | teste unitário do cache/retry | parcial — código escrito e revisado à mão (cache 30min−120s, retry 401 1x, backoff 429 1x, log de `X-Request-Id`+UTC); SEM teste automatizado de cache/retry (exigiria mockar `fetch`+tempo em Deno, não pôde ser executado sem Deno CLI aqui) |
| 4  | `task-type-map.ts` (categoria → `taskTypeId`) `[P]` | AC-4, AC-7 | 1 | teste unitário do mapeamento | parcial — `task-type-map.ts` + `task-type-map.test.ts` escritos (7 casos, cobrem AC-7 explicitamente); teste **não executado** neste ambiente (sem Deno CLI) |
| 5  | Port `AuvoGatewayPort` na `application` da feature PCM (`syncCustomer`, `createTask`) | AC-1 a AC-7 | — | teste do caso de uso com fake do port | **todo — não construído nesta sessão** (fora do escopo explícito passado pelo orquestrador; ver Divergências) |
| 6  | Edge Function `pcm-auvo-customers-sync` (busca por `externalId`, cria ou vincula) | AC-1, AC-2, AC-3 | 3 | teste de integração com mock HTTP do Auvo | parcial — código escrito e revisado à mão; SEM teste de integração (sem Deno CLI, sem mock HTTP configurado) |
| 7  | Edge Function `pcm-auvo-create-task` (busca por `externalId`, cria, grava colunas de sync) | AC-4, AC-5, AC-7 | 3, 4, 6 | teste de integração com mock HTTP do Auvo | parcial — código escrito e revisado à mão (idempotência AC-5, fallback de sync de cliente, AC-7 explícito); SEM teste de integração |
| 8  | Trigger `pg_net` assíncrono em `pcm.ordens_servico` (dispara `pcm-auvo-create-task` no `UPDATE` para `planejamento`) — nova migration `0011_E01-S09_trigger_auvo_planejamento.sql` | AC-4, AC-6 | 7 | `pnpm run lint:migrations` limpo + teste manual de trigger (pgTAP ou script) | parcial — `pnpm run lint:migrations` **limpo** (convenções OK; Squawk não instalado localmente, best-effort — checagem real bloqueante fica na CI); teste manual do trigger contra um Postgres real **não executado** (sem ambiente Supabase local rodando aqui) |
| 9  | Tratamento de erro/`failed` não propagado ao usuário (AC-6) — garantir que o `UPDATE` de status da OS nunca espera a Edge Function | AC-6 | 8 | teste de integração: Auvo mockado como indisponível, `UPDATE` da OS ainda retorna sucesso | parcial — implementado no código (trigger com `exception when others` que nunca propaga; `pcm-auvo-create-task` com try/catch que sempre grava `failed`+`auvo_sync_error` e retorna 200, nunca lança) — SEM teste de integração executando o caminho de falha |
| 10 | Observabilidade: log estruturado com `X-Request-Id` + timestamp UTC em toda chamada Auvo `[P]` | — | 3 | inspeção de log em teste de integração | parcial — implementado em `client.ts` (`logAuvoCall`, todo `fetch` ao Auvo, sucesso e falha); sem chamada real feita para inspecionar o log de verdade |
| 11 | Feature flag `NullAuvoGateway` (no-op) em `config/env.ts`, para desligar a integração sem revert `[P]` | — | 5 | teste: flag off → nenhuma chamada HTTP sai | **todo — não construído nesta sessão** (depende da task 5, também fora do escopo explícito; ver Divergências) |
| 12 | Atualizar `docs/blueprint/integracoes/auvo.md` e `docs/ARCHITECTURE.md` se a implementação divergir do design (não deveria, mas confirmar) | — | 3-11 | `diff` conceitual design ↔ código | parcial — divergências reais encontradas e documentadas abaixo (Divergências); `docs/blueprint/integracoes/auvo.md`/`docs/ARCHITECTURE.md` não foram editados nesta sessão (nada que mude a *divisão de responsabilidades* documentada lá — só detalhes de implementação/contrato de campo) |
| 13 | `docs/epics/ROADMAP.md` + `docs/STATE.md`: marcar `E01-S09` como implementado, AC verdes | — | 1-12 | inspeção | done — ver STATE.md/ROADMAP.md (status real: implementação de código completa e revisada à mão, sem execução Deno/Postgres real; ACs não verificados por gate automatizado) |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual (exceto onde
> marcado "inspeção").

## Plano de teste
- Unidade: `task-type-map.ts` (categoria → ID, categoria sem mapeamento retorna erro
  tipado); cache/retry do cliente HTTP (token expira, 401 força novo login).
- Integração: `pcm-auvo-customers-sync` e `pcm-auvo-create-task` contra mock HTTP do Auvo (a
  decidir na task 3/6: `msw` ou stub de `fetch` — verificar se já há padrão no repo antes de
  introduzir dependência nova).
- Aceite: um teste por AC desta spec (AC-1 a AC-7) — idealmente teste de integração real da
  Edge Function via `supabase functions serve` local, ou teste E2E se o projeto já tiver esse
  runner (ver `testes/README.md`).

## Divergências (SPEC_DEVIATION)
- **Tasks 5/11 — `AuvoGatewayPort`/`NullAuvoGateway` não construídos.** O escopo de implementação
  desta sessão (definido explicitamente pelo orquestrador/@dev que retomou o story) listou 6
  entregáveis: cliente HTTP compartilhado, `task-type-map.ts`, migration do trigger, as duas Edge
  Functions e teste unitário do mapeamento — **não** incluiu o port `AuvoGatewayPort` na
  `application` da feature PCM nem o `NullAuvoGateway` de `design.md` → Infra/Reversão. As Edge
  Functions chamam o cliente Auvo (`_shared/auvo/client.ts`) diretamente, sem essa camada de
  abstração adicional. Isso significa que a "reversão sem revert" via feature flag descrita em
  `design.md` §3 não existe ainda — desligar a integração hoje exigiria remover o trigger
  (migration de reversão já documentada) ou apagar os secrets do Vault (a função vira no-op, ver
  migration). Resolução: reabrir como tasks 5/11 numa sessão futura se `@architect`/Fabrício
  confirmarem que a camada de porta é necessária antes de `E01-S10`/`E01-S11` consumirem o mesmo
  cliente HTTP.
- **`clientes.endereco` não existe.** `design.md` → Contrato dos dados trocados lista
  `clientes.endereco → address` no `POST /customers`, mas `pcm.clientes`
  (`0001_E00-S00_schemas_dominio.sql`) só tem `id, nome, cnpj, auvo_id, ativo` — sem coluna de
  endereço. `pcm-auvo-customers-sync` envia só `description` (a partir de `nome`); `address` fica
  de fora até a coluna existir (fora do escopo desta story criar coluna nova em `pcm.clientes`).
- **Mapeamento `prioridade` → `priority` Auvo implementado como provisório.** `design.md` marca
  esse mapeamento como decisão de produto pendente ("Fabrício decide"). Para o AC-4 poder enviar
  `priority` em toda criação de task, implementei a proposta do próprio `design.md` literalmente
  (`critica/alta→3, media→2, baixa→1`) com fallback defensivo (`2`) para qualquer valor fora desse
  vocabulário — inclusive o default atual da coluna (`'normal'`), que não é GUT. Ver
  `_shared/auvo/priority-map.ts`. Reavaliar quando Fabrício confirmar.
- **Mecanismo de autenticação interna (trigger→Edge Function, Edge Function→Edge Function) não
  estava especificado em `design.md`.** `design.md` só diz "dispara Edge Function via HTTP a
  partir de um trigger Postgres", sem detalhar auth. `requireAuth` (padrão do
  `_template/index.ts`) não serve aqui: chama `supabase.auth.getUser()`, que falha para o JWT da
  `service_role` (sem claim `sub` de usuário real). Decisão tomada nesta sessão: novo helper
  `requireServiceRole` em `_shared/auth.ts`, que exige o Bearer token ser exatamente a
  `SUPABASE_SERVICE_ROLE_KEY` do projeto (comparação em tempo constante via `_shared/crypto.ts`).
  O trigger passa essa mesma chave via secret do Vault (`auvo_trigger_service_role_key`, nome
  também não especificado em `design.md` — escolha desta sessão, documentada no cabeçalho da
  migration `0006`). Candidato a formalizar em `design.md`/ADR se `@architect` concordar com o
  mecanismo.
- **Contrato exato da API Auvo (shape de resposta) não verificado.** `design.md` cita
  `Auvo-API-Mapeamento-Completo.md` (vault Obsidian) como fonte do formato exato de
  request/response (`paramFilter`, envelope `result`, nomes de campo do login) — esse arquivo não
  está acessível neste ambiente de implementação. `client.ts` e as duas Edge Functions implementam
  o formato descrito em prosa por `design.md`/`docs/blueprint/integracoes/auvo.md`, com comentário
  `NÃO VERIFICADO NESTE AMBIENTE` nos pontos relevantes. Precisa confirmação contra o mapeamento
  real (ou uma chamada de teste) antes do primeiro deploy em produção — bloqueia deploy real, não
  bloqueia esta entrega de código.
- **Deno CLI indisponível neste ambiente.** Nenhum arquivo `.ts` sob `supabase/functions/` foi
  type-checked ou executado — só revisado manualmente. `deno test`/`deno check` precisam rodar
  numa sessão com Deno instalado (ou na CI, se houver job configurado) antes deste story ser
  considerado com gate de qualidade verde.

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável** — não verificado (sem Deno CLI/Postgres real
      neste ambiente; ver Divergências)
- [ ] Nenhum `SPEC_DEVIATION` pendente — **6 abertos**, ver Divergências acima
- [ ] ADR novo se a implementação real tomar decisão irreversível não coberta pelo ADR-0001 —
      avaliar se o mecanismo `requireServiceRole`/secrets do Vault (Divergências) precisa de ADR
      próprio ou se ADR-0001 já cobre (provável — é elaboração do mesmo princípio)
- [ ] Glossário atualizado se mudou — termos de `domain.md` (Porta Auvo, Cliente Auvo, Sync de
      Cliente) ainda não promovidos a `docs/glossary.md` global
- [ ] Spec reflete o que foi construído
- [x] `docs/STATE.md` atualizado
- [x] Segredos Auvo em Supabase Vault/env, nunca em código ou `.env` commitado — só referenciados
      por nome (`AUVO_API_KEY`, `AUVO_USER_TOKEN`, `auvo_trigger_project_url`,
      `auvo_trigger_service_role_key`)
