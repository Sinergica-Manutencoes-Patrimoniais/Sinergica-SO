---
name: blueprint-atendimento-ze
description: Requirements do módulo Atendimento (Agente Zé / IA). Puxe ao planejar specs de WhatsApp, fila ou abertura de chamado via LLM.
alwaysApply: false
---

# Blueprint — Atendimento (Agente Zé / IA)

> Schema Postgres: `atendimento` · Feature: `apps/web/src/features/atendimento/`
> Spec âncora: `specs/0002-abertura-chamado-ze/`

## Problema
Síndicos e zeladores abrem chamados via WhatsApp de forma desestruturada — sem registro formal,
sem confirmação, sem rastreio. O Zé fecha esse gap: é a porta de entrada padrão para chamados,
24/7, sem depender de operador humano disponível.

## Personas
- **Síndico/Zelador**: manda mensagem no grupo do condomínio ou em DM.
- **Gestor**: configura modos do Zé (off/monitor/active) por condomínio.
- **Admin**: gerencia instâncias, prompts, modelos.

## Fluxo principal
```
Mensagem no grupo WhatsApp do condomínio
  → Webhook Evolution API recebe (messages.upsert)
  → Persiste em wa_messages
  → Enfileira em wa_queue com delay 3s (agrupa rajadas do mesmo grupo/DM)
  → Cron (fallback, 1/min) ou waitUntil dispara pcm-ze-agent
  → LLM Gemini 2.5 Flash analisa contexto (20 msgs recentes)
  → Detecta menção → coleta problema + local + urgência
  → Chama tool criar_chamado / atualizar_chamado / consultar
  → OS criada no PCM (origem = 'ze', status = 'solicitacao')
  → Zé responde no grupo: "Chamado aberto ✅ OS-XXXX" (E01-S88: mensagem usa "Chamado" como
    linguagem amigável ao cliente, mas o Zé continua criando uma OS diretamente — o vínculo com a
    entidade `pcm.chamados` de verdade é E01-S89, fora de escopo aqui)
```

## Regras de negócio

### Detecção de menção (determinística — antes do LLM)
- Regex: `\bz[eé]\b` (case-insensitive) OU `@<bot_id>`.
- Se mencionado pelo nome → Zé SEMPRE responde (não pula).
- Referência a problema/manutenção sem menção → responde se modo `active`.
- Off-topic sem menção → SKIP.

### Modos de operação (por condomínio)
| Modo | Comportamento |
|------|--------------|
| `off` | Zé não responde (só registra) |
| `monitor` | Só responde se mencionado pelo nome |
| `active` | Responde a qualquer referência a serviço/manutenção |

### Abertura de chamado
- Zé só cria OS após confirmar **3 pontos**: problema · local · urgência.
- Se faltarem dados, Zé pergunta (até 5 iterações do loop tool-calling).
- OS criada com `origem = 'ze'`, `origem_ref_id = chat_id`, `solicitante = nome_no_grupo`.
- Idempotência: Zé não abre segunda OS pelo mesmo chat se já há uma `em_aberto` recente.

### Fila e agrupamento
- Mensagens do mesmo `queue_key` (grupo+instância) são agrupadas em 3s antes de processar.
- Fallback cron a cada 1 min (se `waitUntil` falhar ou cair).
- Latência alvo: <10s do recebimento à resposta.

### DMs vs Grupos
- Grupos: vinculados ao cliente por `whatsapp_group_jid`.
- DMs: só para usuários em `wa_admins` com `active = true`.

## Tools disponíveis para o LLM
| Tool | Descrição |
|------|-----------|
| `criar_chamado` | Abre nova OS no PCM |
| `atualizar_chamado` | Atualiza status ou informações de OS existente |
| `consultar_chamados` | Lista OS abertas do condomínio |
| `consultar_backlog` | Resume backlog do condomínio |

## Integrações
- **Evolution API / WhatsApp**: webhook de entrada + envio de resposta.
- **PCM**: cria/consulta `ordens_servico` (Shared Kernel).
- **OpenRouter (Gemini 2.5 Flash)**: LLM principal do Zé.

## Configuração do Zé (por condomínio)
- `ze_active`: bool — Zé habilitado?
- `ze_mode`: off/monitor/active
- `ze_model`: modelo LLM (default: `google/gemini-2.5-flash`)
- `ze_prompt_custom`: instrução adicional específica do cliente
- `whatsapp_group_jid`: ID do grupo vinculado ao condomínio

## Métricas
| Métrica | Alvo |
|---------|------|
| Latência de resposta | <10s (p95) |
| Taxa de abertura completa | OS aberta com 3 pontos / total de tentativas |
| Rejeição (fora de escopo) | % mensagens ignoradas indevidamente |
