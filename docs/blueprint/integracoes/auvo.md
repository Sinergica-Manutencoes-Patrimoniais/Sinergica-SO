---
name: blueprint-integracao-auvo
description: Blueprint da integração Auvo — divisão de trabalho, idempotência, webhooks. Puxe ao planejar specs de sync com o Auvo.
alwaysApply: false
---

# Blueprint — Integração Auvo

> Referência técnica: 141 endpoints mapeados; ~15% usados no PCM v2 (ponto de partida).

## Divisão de responsabilidades
| Domínio | Dono | Fluxo |
|---------|------|-------|
| Clientes/condomínios | PCM | PCM → Auvo via API (cria/atualiza com `externalId`) |
| Equipamentos/ativos | PCM | PCM define hierarquia (Torre > Sistema > Equip); Auvo é o espelho de campo |
| Técnicos/equipes | Auvo | Auvo é a fonte; PCM espelha via API (`pcm.tecnicos_cache`) |
| OS (decisão) | PCM | PCM cria, atribui, prioriza → envia ao Auvo quando status = `planejamento` |
| Execução em campo | Auvo | GPS, fotos, checklist, assinatura, peças — Auvo exclusivo |
| Resultado de OS | Auvo → PCM | Webhook retorna: status, fotos, checklist preenchido, peças consumidas |
| Financeiro | PCM | Consolida custo com dado do Auvo |
| Preventivo | PCM | PCM planeja; Auvo executa via Service Orders recorrentes |

## Idempotência (regra crítica)
- PCM envia ao Auvo `externalId = <id_da_os>`.
- Reenviar a mesma OS não cria task duplicada.
- Auvo retorna `auvo_task_id` → persiste em `pcm.ordens_servico.auvo_task_id`.

## Edge Functions envolvidas
| Função | Direção | O que faz |
|--------|---------|-----------|
| `pcm-auvo-create-task` | PCM → Auvo | Cria task quando OS entra em `planejamento` |
| `pcm-auvo-customers-sync` | PCM ↔ Auvo | Sincroniza clientes |
| `pcm-auvo-customers-import` | Auvo → PCM | Import inicial/diário de clientes já cadastrados no Auvo (bootstrap, E01-S13) |
| `pcm-auvo-equipment-sync` | Auvo → PCM | Espelha equipamentos (cache) |
| `pcm-auvo-users-sync` | Auvo → PCM | Espelha técnicos |
| `pcm-auvo-patch-task-orientation` | PCM → Auvo | Atualiza descrição/orientação da task |
| `pcm-auvo-webhook` | Auvo → PCM | Recebe eventos (status, conclusão) |

## Mapeamento de status
| Status Auvo | Status OS no PCM |
|-------------|-----------------|
| Aberta | planejamento |
| Em execução | em_execucao |
| Concluída | finalizado |
| Cancelada | cancelado |

## Campos de integração em `ordens_servico`
| Campo | Descrição |
|-------|-----------|
| `auvo_task_id` | ID da task no Auvo (retornado pelo Auvo) |
| `auvo_task_url` | URL direta da task no painel Auvo |
| `auvo_sync_status` | `pending` / `synced` / `failed` / `in_conflict` |
| `auvo_synced_at` | Timestamp do último sync bem-sucedido |
| `auvo_sync_error` | Mensagem de erro do último sync falhado |

## Tipos de OS no Auvo (IDs da API)
| Categoria PCM | ID Auvo |
|---------------|---------|
| corretiva | 228714 |
| preventiva | 139989 |
| inspecao | 179776 |
| levantamento | a definir |
| emergencial | a definir |

## Riscos conhecidos (herdados do PCM v2)
- Webhook sem deduplicação → risco de OS corretivas duplicadas ao reprocessar evento.
- Reconciliação de fallback ausente: se webhook falhar, divergência permanece até sync manual.
- `priority` e `taskTypeId` precisam de validação com a API atual do Auvo.
