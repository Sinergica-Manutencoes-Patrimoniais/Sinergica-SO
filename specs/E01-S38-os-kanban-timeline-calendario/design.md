---
name: design
description: Arquitetura — enriquece pcm.ordens_servico com dados reais da tarefa Auvo (técnico, data agendada, check-in/check-out) e adiciona 3 visões novas (Kanban, timeline por técnico, calendário) à tela de Ordens de Serviço.
alwaysApply: false
---

# Design — Kanban/Timeline/Calendário de Ordens de Serviço

## Contexto

Depois do backfill (E01-S34, 2026-07-09), `pcm.ordens_servico` tem 2364 linhas reais vindas de
tarefas do Auvo. Hoje só gravamos `cliente`, `título` (tipo de tarefa), `status`, `auvo_task_id`.
O Auvo manda muito mais por tarefa (confirmado direto na API real, `GET /tasks`):

```jsonc
{
  "taskID": 76019145,
  "idUserTo": 153005, "userToName": "Davi Guedes",       // técnico responsável
  "taskDate": "2026-06-25T08:00:00",                       // data/hora agendada
  "checkInDate": "2026-06-25T07:49:38",
  "checkOutDate": "2026-06-25T07:54:48",
  "address": "Avenida Doutor Manoel Afonso Ferreira, ...", // endereço da visita
  "latitude": -22.90857, "longitude": -47.03647,
  "taskTypeDescription": "INÍCIO VISITA",
  "taskStatus": 5
  // ... produtos/serviços/anexos/assinatura, fora de escopo aqui (ver Non-goals)
}
```

Nenhum desses campos existe hoje em `pcm.ordens_servico` (migration `0001`). Sem eles, timeline por
técnico e calendário não têm dado pra mostrar — ficariam vazios ou fingindo funcionar com
`created_at`, que é a data em que a linha entrou no NOSSO banco, não a data real da tarefa (todo o
backfill de 2026-07-09 tem `created_at` = hoje, mesmo pra tarefa Auvo de janeiro).

**Tier arquitetural**: schema change em tabela com 2364 linhas de produção reais. Requer aprovação
antes de migrar (CLAUDE.md).

## Decisão

**Padrão (definido com Lucas 2026-07-09): colunas próprias só pro que filtra/ordena/agrupa nas 3
visões; todo o resto (dado rico da tarefa que só é EXIBIDO, nunca usado em `WHERE`/`ORDER BY`/
`GROUP BY`) vai num `jsonb` único.** Evita migration nova cada vez que alguém quiser mostrar mais um
campo do Auvo no card — só ajusta o parse no frontend.

### Colunas novas em `pcm.ordens_servico` (filtro/ordenação/agrupamento)

| Coluna | Tipo | Origem Auvo | Uso |
|---|---|---|---|
| `tecnico_auvo_user_id` | `bigint` | `idUserTo` | rastreio bruto, funciona mesmo se funcionário ainda não sincronizado |
| `tecnico_funcionario_id` | `uuid references pcm.funcionarios` | resolvido via `auvo_user_id` (mesmo padrão de `resolverClienteIdsPorAuvoIds`) | timeline **agrupa** por aqui |
| `data_agendada` | `timestamptz` | `taskDate` | calendário **posiciona** por aqui |
| `check_in_at` | `timestamptz` | `checkInDate` | timeline **posiciona** a barra (início) |
| `check_out_at` | `timestamptz` | `checkOutDate` | timeline **posiciona** a barra (fim) |

Todas nullable — OS manual (não vinda do Auvo) simplesmente não preenche.

### `auvo_detalhes jsonb` — todo o resto, só exibição

Um campo só, guarda `address`, `latitude`, `longitude`, `priority` (escala 0-3 do Auvo). Implementado
via `montarDetalhes()` (tasks-import) e `extractDetalhes()` (webhook) — só inclui chaves presentes
no payload real, nunca inventa default. Frontend lê (`OrdemServicoOperacional.detalhes`) e decide
o que exibir; campo novo do Auvo amanhã não pede migration.

`NOT VALID` não se aplica às colunas simples (são colunas novas, não constraints em coluna
existente); a FK de `tecnico_funcionario_id` usa `NOT VALID` + `VALIDATE CONSTRAINT` em migration
separada (`0070`/`0071`) — Squawk trava até FK em coluna nova (`ADD COLUMN ... REFERENCES` sozinho
já pede lock de validação).

### Resolução do técnico

Mesmo padrão já usado em `os-from-task.ts` pra cliente: `pcm-auvo-tasks-import` e `pcm-auvo-webhook`
passam a resolver `idUserTo` → `pcm.funcionarios.id` via `auvo_user_id` (coluna que já existe,
migration `0028`-ish). Se o funcionário ainda não sincronizado, grava só `tecnico_auvo_user_id` e
deixa `tecnico_funcionario_id` null — reconciliação futura NÃO reprocessa (mesma assimetria já
documentada pra `client_id`: não há re-tentativa automática hoje; aceito como estava).

### Migração dos dados já existentes (2364 linhas)

As 2364 OS já importadas ficam com essas colunas `NULL` — não há re-fetch retroativo automático
nesta story (custaria outra rodada de paginação Auvo, ~4min, mesmo custo do backfill original).
Um script de backfill pontual (mesmo padrão do script usado em E01-S34, chamado manualmente uma vez
fora do CI) fica documentado como follow-up, não bloqueia esta story: Kanban funciona com o que
tem (status), timeline/calendário mostram "sem data" pras 2364 antigas até rodar o backfill.

### As 3 visões novas (`OrdensServicoPage.tsx`)

Abas dentro da página existente (`Lista` já existe, viram `Lista | Kanban | Timeline | Calendário`):

- **Kanban**: coluna por `status` (as 6 de `STATUS_OS`), card arrastável muda status via
  `alterarStatus` (já existe). Usa a lista já paginada/corrigida (E01-S37 fix); sem paginação
  virtual ainda (2364 itens em 6 colunas — se ficar pesado, adiciona virtualização depois, não
  bloqueia o MVP).
- **Timeline por técnico**: linha por `tecnico_funcionario_id` (nome via join local), barras por
  OS posicionadas em `check_in_at`→`check_out_at` (fallback `data_agendada` se check-in ausente).
  OS sem técnico resolvido cai numa linha "Sem técnico".
- **Calendário**: mês/semana, evento por `data_agendada`. OS sem `data_agendada` não aparece no
  calendário (aparece nas outras abas normalmente).

## Non-goals (fora de escopo desta story)

- Mapa com lat/long — endereço em texto já cobre o card; mapa é evolução futura se pedido.
- Produtos/serviços usados na tarefa, assinatura do cliente, fotos/anexos — dado rico, mas não
  necessário pras 3 visões pedidas; guardaria em tabela própria (`pcm.ordens_servico_detalhes_auvo`
  ou similar), decisão separada se/quando vier pedido de "ficha completa da visita".
- Backfill retroativo das 2364 OS já existentes — documentado como follow-up manual, não bloqueia.
- `writeEnabled` pra tarefas (escrita PCM→Auvo de tarefa) — sem mudança, seguem só leitura.

## Migração

`0070_E01-S38_enriquece_ordens_servico_auvo.sql` (colunas + FK `NOT VALID`) +
`0071_E01-S38_validar_fk_tecnico_ordens_servico.sql` (`VALIDATE CONSTRAINT`, mesmo padrão de
0004/0005, 0006/0007, 0043/0045).
