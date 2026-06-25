---
name: domain-0002-abertura-chamado-ze
description: Modelo DDD do Agente Zé — bounded context Atendimento, entidades, eventos, relações. Puxe ao modelar ou nomear entidades.
alwaysApply: false
---

# Domain Model (DDD) — Abertura de Chamado via Agente Zé

## Bounded Context
**Atendimento**. Subdomínio: **core** (porta de entrada da operação).

## Linguagem ubíqua
| Termo | Definição | NÃO confundir com |
|-------|-----------|-------------------|
| **Zé** | Agente de IA no WhatsApp que recebe e estrutura chamados | Técnico (humano de campo) |
| **Fila WA** | Buffer de mensagens WhatsApp aguardando processamento (delay 3s) | Mensagem processada |
| **QueueKey** | Identificador único de fila = instância + grupo/DM | Chat ID (interno do WhatsApp) |
| **Modo Zé** | Nível de ativação do agente por condomínio: off / monitor / active | Status da OS |
| **Menção** | Referência explícita ao Zé ("Zé", @bot_id) detectada deterministicamente | Referência implícita a serviço |
| **Tool Calling** | Mecanismo pelo qual o LLM chama funções estruturadas (`criar_chamado`, etc.) | Prompt simples |
| **Origem** | Campo na OS que indica como foi criada: `'ze'` / `'manual'` / `'portal'` | Status da OS |

## Entidades
| Entidade | Descrição |
|----------|-----------|
| `WaMensagem` | Mensagem recebida via WhatsApp (remetente, conteúdo, grupo/DM, timestamp) |
| `WaFilaItem` | Item na fila de processamento (queue_key, waitUntil, status) |
| `ConfigZe` | Configuração do Zé por condomínio (modo, modelo, prompt_custom, group_jid) |

## Eventos de domínio
| Evento | Disparado quando | Quem reage |
|--------|-----------------|-----------|
| `MensagemRecebida` | Webhook Evolution chega | Persiste WaMensagem + enfileira WaFilaItem |
| `FilaProcessada` | WaFilaItem com delay vencido | Agente Zé analisa contexto + tool-calling |
| `ChamadoAberto` | Zé chama `criar_chamado` com sucesso | OS criada no PCM (Atendimento → PCM via ACL) |

## Regras de detecção de menção
1. Regex `\bz[eé]\b` (case-insensitive) na mensagem.
2. OU `@<bot_id>` (onde bot_id é o número da instância Evolution).
3. Executada **antes** do LLM — determinística, sem custo de token.
4. Se mencionado → Zé SEMPRE responde independente do modo.
5. Se não mencionado e modo `active` → Zé responde a referências a serviço/manutenção.
6. Se não mencionado e modo `monitor` → SKIP.
7. Se modo `off` → SKIP sempre.

## Relações com outros contextos
- **PCM** (Customer/Supplier): Atendimento cria OS no schema `pcm` via ACL (sem acesso direto às entidades de domínio do PCM — usa Edge Function `pcm-ze-agent` como anti-corruption layer).
- **Shared Kernel**: tipo `OrdemServicoInput` compartilhado em `packages/shared/` para a criação de OS.
