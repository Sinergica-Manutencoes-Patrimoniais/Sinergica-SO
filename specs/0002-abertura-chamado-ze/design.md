---
name: design-0002-abertura-chamado-ze
description: Technical Design Doc da abertura de chamado via Zé — 5 eixos, fluxo completo, dependências. Puxe ao implementar esta feature.
alwaysApply: false
---

# Technical Design Doc — Abertura de Chamado via Agente Zé

> Tier: arquitetural · Status: aprovado (aguarda implementação — Mês 2)
> Autor: @architect · Revisores: @pm, @data-engineer

## Contexto
Síndicos abrem chamados via WhatsApp. O Zé é a porta única automatizada. A feature envolve
webhook externo (Evolution API), fila com estado no Postgres, LLM com tool-calling, e criação de
OS em contexto diferente (PCM). Tier arquitetural por integração externa + novo bounded context.

## Goals / Non-goals
Goals: receber, enfileirar, processar com LLM, abrir OS no PCM, responder ao síndico. <br>
Non-goals: análise de fotos, fechamento de OS, integração com Auvo.

## Design proposto

### Fluxo de dados (sequência)
```
Síndico → WhatsApp → Evolution API
  → POST /pcm-whatsapp-webhook (Supabase Edge Function)
      → INSERT atendimento.wa_messages
      → INSERT atendimento.wa_queue (queue_key, wait_until = now+3s)
      → waitUntil: chamar pcm-ze-agent após 3s (agrupa rajadas)
  → pcm-ze-agent (Supabase Edge Function)
      → SELECT atendimento.wa_queue WHERE queue_key AND status='pending'
      → SELECT últimas 20 mensagens do grupo (contexto)
      → Detecção determinística de menção (regex, antes do LLM)
      → Se SKIP: marca queue como 'skipped', retorna
      → LLM: POST api.openrouter.ai (Gemini 2.5 Flash) com tools
          → Tool criar_chamado → INSERT pcm.ordens_servico (origem='ze')
      → Evolution API: POST /message/sendText (resposta ao grupo)
  → Fallback cron (1/min): reprocessa wa_queue com wait_until expirado
```

### Contrato de criação de OS pelo Zé
```typescript
// packages/shared/src/index.ts
interface OrdemServicoInput {
  client_id: string;
  titulo: string;
  descricao: string;
  categoria: 'corretiva' | 'preventiva' | 'emergencial';
  prioridade: 'baixa' | 'normal' | 'media' | 'alta' | 'critica';
  local_descricao: string;
  origem: 'ze';
  origem_ref_id: string; // chat_id
  solicitante?: string;  // nome no grupo
}
```

## Cobertura dos 5 eixos

### 1. Tech stack
- Edge Functions Deno (Supabase) — sem mudança de stack.
- OpenRouter (Gemini 2.5 Flash) — ADR-0002 justifica escolha de modelo para o Zé.
- Evolution API — webhook + REST (instância existente na Cloudfy).
- `@sinergica/shared`: tipo `OrdemServicoInput` (novo, compartilhado).

### 2. Arquitetura base
- Novo bounded context `atendimento` — schema Postgres separado.
- Anti-Corruption Layer: `pcm-ze-agent` (Edge Function) acessa `pcm.ordens_servico` diretamente via `service_role` — não via domínio TypeScript do PCM.
- Fila no Postgres (sem Redis/SQS): simples e auditável; suficiente para o volume atual.

### 3. Infra
- Tabelas: `atendimento.wa_messages`, `atendimento.wa_queue` (novo schema `atendimento`).
- Cron no Supabase: `process_wa_queue` a cada 1 min (fallback para `waitUntil`).
- Sem custo adicional de infra além do Supabase (já contratado).

### 4. Qualidade
- Domínio de detecção determinística: teste unitário (regex).
- Tool-calling: mock do OpenRouter em teste de integração.
- AC cobertos por testes na implementação (ver tasks.md).

### 5. Observabilidade
- Latência: log de `received_at` e `replied_at` em `wa_messages`.
- Erros: `wa_queue.error_message` + log estruturado com `reqId = queue_id`.
- Alerta: Evolution API desconectada → `connection.update` dispara notificação para admin.

## Mapa de dependências
| Dependência | Tipo | Descrição |
|-------------|------|-----------|
| Evolution API | Externa | Webhook de entrada + envio de resposta |
| OpenRouter | Externa | LLM (Gemini 2.5 Flash) |
| `pcm.ordens_servico` | Interna (PCM) | Tabela onde a OS é criada |
| `packages/shared` | Interna | Tipo `OrdemServicoInput` |

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que não escolhida |
|-------------|------|---------|----------------------|
| Fila em memória (sem Postgres) | Mais rápida | Perde mensagens no restart; sem auditoria | Auditabilidade é requisito de negócio |
| Redis/BullMQ | Robusto para volume alto | Custo extra; complexidade | Volume atual (<100 msgs/dia) não justifica |
| Processar no webhook sem fila | Mais simples | Sem agrupamento de rajadas; risco de LLM duplo | Agrupamento é regra de negócio do Zé |

## Riscos
| Risco | Prob × Impacto | Mitigação |
|-------|---------------|-----------|
| Evolution desconectar | Médio × Alto | Cron verifica `connection.update`; alerta para admin |
| LLM timeout (>10s) | Baixo × Médio | `waitUntil` com timeout; fallback cron reprocessa |
| Prompt injection por síndico | Baixo × Alto | Sanitização de input + instrução de sistema defensiva |

## ADRs relacionados
- [ADR-0001 — PCM como origin of truth + externalId idempotente](../../docs/adr/0001-pcm-origin-truth-externalid.md)
- [ADR-0002 — Detecção determinística de menção ao Zé antes do LLM](../../docs/adr/0002-deteccao-deterministica-ze.md)
