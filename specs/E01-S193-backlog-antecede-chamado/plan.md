---
name: plan
description: Detalhe técnico de E01-S193 — transição do Backlog legado, schema e RPCs. Puxe ao implementar.
alwaysApply: false
---

# Plan — E01-S193 · Backlog antecede Chamado e OS

## Os dois Backlogs, com endereço

| | Legado | Aprovado |
|---|---|---|
| O que é | **status da OS** | **escopo validado**, antes de existir OS |
| Onde vive | `pcm.ordens_servico.status='backlog'`; histórico em `0020_E01-S20_os_backlog_operacional.sql` | `pcm.sso_backlog_parcelas` com coluna `origem` (`1218`, `1219`, `1830`) |
| Quem consome | `STATUS_OS` em `apps/web/src/features/pcm/domain/ordens-servico.ts:127`, coluna do Kanban em `domain/kanban-colunas.ts`, tela "Backlog GUT" | `sso_criar_os_parcela_backlog`, `sso_consultar_parcelas_backlog`, `sso_devolver_parcela_chamado_backlog` |

`pcm.ordens_servico.status` é `text` **sem CHECK** (`0001_E00-S00_schemas_dominio.sql:68`). Isso
significa que nada no banco impede hoje um valor novo — e nada impede o valor legado voltar. A
guarda tem que ser **explícita**, em trigger/função, nunca presumida pelo tipo.

## Ordem da transição (o padrão que já funcionou na 1842)

1. Construir o caminho novo **aditivo**, com gate fechado por padrão.
2. Classificar o legado por decisão explícita, auditada, **sem apagar**.
3. Só então recusar o caminho antigo, pelo gate.

A `1842` fez exatamente isso para Chamado 1:N e é a referência de estilo, inclusive no cabeçalho
explicando o porquê de ser migration e não script manual.

## Schema

Nada de tabela nova se `pcm.sso_backlog_parcelas` servir — confirmar no início da implementação. O
que a story precisa garantir:

- **item de Backlog agrupado** referencia N pendências sem apagar a fonte (`0375_E01-S174_composicao_pendencias.sql`
  já tem a composição; reusar);
- **GUT no item**, não na OS (hoje há 7 migrations com `gut`; inventariar antes de criar a oitava);
- **origem e histórico** preservados na liberação parcial;
- **concorrência otimista** por `revisao`, no padrão já usado em `1842`/`1830`.

```sql
-- Assinaturas esperadas (nomes finais a confirmar contra o que já existe)
pcm.sso_enviar_pendencias_backlog(
  p_request_id uuid, p_cliente_id uuid, p_pendencia_ids uuid[], p_motivo text
) returns uuid                      -- AC-1, AC-2: cria UM item agrupado, zero OS/Chamado

pcm.sso_priorizar_item_backlog(
  p_request_id uuid, p_item_id uuid, p_gut jsonb, p_revisao integer
) returns integer                   -- AC-3

pcm.sso_liberar_escopo_backlog(
  p_request_id uuid, p_item_id uuid, p_parcela_ids uuid[], p_revisao integer
) returns uuid                      -- AC-4, AC-5: cria Chamado em 'demanda'; resto fica
```

Todas: `security definer set search_path=''`, `revoke all ... from public, anon, authenticated,
service_role` e `grant execute ... to authenticated` **no mesmo arquivo** — é o erro que gerou
`E01-S189` (sete escritores sem grant) e não pode se repetir aqui.

**Atomicidade:** a GitHub Integration do Supabase roda migration **fora de transação** (diferente da
CLI local — lição da PR #78). Qualquer passo que precise de atomicidade vai em `do $$ ... $$`.

## Estado `demanda` do Chamado

O Chamado nasce em **Demanda** na liberação (AC-4). `E01-S194` consome esse estado no Kanban; esta
story o **cria** e prova. Guarda explícita de transição, pelo motivo do `text` sem CHECK acima.

## Transição do legado — AC-7, AC-8

- Relatório **antes**: `scripts/inventariar-backlog-legado.mjs` conta OS em `status='backlog'`, por
  cliente, com e sem `auvo_task_id`.
- Classificação: cada OS legada vira item de Backlog **ou** permanece OS com estado próprio, por
  decisão registrada em `audit.*`. **Nunca deletar.**
- **Bloqueio obrigatório:** OS legada com `auvo_task_id`/`auvo_sync_status` **não pode** ser
  reclassificada sem reconciliação — mesmo padrão de `E01-S171` e de `1832`
  (`efeito_remoto_exige_reconciliacao`).
- Gate `pcm.sso_backlog_pre_chamado_gate`, `default false`.

### Procedimento de abertura e de retorno — AC-F4

- **Abertura:** (1) aplicar migrations; (2) rodar o inventário e revisar o relatório com o PCM;
  (3) classificar o legado; (4) `update ... habilitado = true` no gate, por migration aditiva;
  (5) declarar a flag do front em `FLAGS_SSO` e republicar.
- **Retorno:** fechar o gate (o caminho novo passa a recusar com `55000`), desligar a flag e
  republicar. A classificação já feita **permanece** — ela é aditiva e auditada, não destrutiva.
  Reverter classificação é operação à parte, por RPC de correção, nunca `delete`.

## Front

```
features/pcm/
  application/backlog-queries.ts          (novo)  TanStack Query + backlogQueryKeys
  interfaces/backlog/EnviarPendenciasBacklog.tsx  (novo)  AC-1, AC-2
  interfaces/backlog/PriorizarItemBacklog.tsx     (novo)  AC-3
  interfaces/backlog/LiberarEscopoBacklog.tsx     (novo)  AC-4, AC-5
  domain/ordens-servico.ts                (altera) `backlog` sai de STATUS_OS ao fim da transição
```

Dado de servidor **só** por TanStack Query, chaves em `backlogQueryKeys`, invalidação após escrita —
`useEffect` buscando dado de servidor é recusado no review.

### Alcance no front — AC-F1 a AC-F5

- **Caminho nomeado:** Trabalho → Central de Pendências → selecionar → "Enviar ao Backlog";
  Trabalho → Backlog (painel lateral do Kanban) → priorizar → "Liberar escopo".
- **Flag:** `VITE_SSO_BACKLOG_PRE_CHAMADO_ENABLED`, declarada em `FLAGS_SSO` (`E00-S28`) no mesmo
  PR, padrão `false`, com `gate: 'pcm.sso_backlog_pre_chamado_gate'` preenchido.
- **Desligado se anuncia:** usar `RecursoNaoAtivado` (`E00-S28`); `return null` é recusado no review.
- **AC-F5:** o PR declara em uma linha o que falta para a jornada ficar utilizável.

## Riscos

- Criar a oitava migration de GUT sem inventariar as sete existentes.
- Criar tabela nova quando `sso_backlog_parcelas` já serve — repetiria o erro registrado em
  `docs/STATE.md` (2026-11-11), onde uma migration duplicava sistema existente e foi apagada antes de aplicar.
- Mexer em `STATUS_OS` antes da classificação do legado terminar: quebra tela em produção.
