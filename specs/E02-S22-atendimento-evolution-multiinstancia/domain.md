---
name: domain
description: Modelo de domínio do roteamento e handoff multi-instância.
alwaysApply: false
---

# Domain Model (DDD) — Atendimento Evolution multi-instância

## Bounded Context
**Atendimento**, subdomínio core. Integra Evolution, agentes e operação humana sem assumir a
propriedade de Cliente PCM ou Lead Comercial.

## Linguagem ubíqua
| Termo | Definição | NÃO confundir com |
|---|---|---|
| Instância Evolution | conexão de um número WhatsApp no servidor Evolution único | servidor Evolution |
| Vínculo de agente | associação ativa entre `instance_id` e uma persona | vínculo CRM |
| Persona efetiva | persona resolvida para a instância que recebeu a mensagem | primeira persona do tipo |
| Handoff | pausa automática do agente e entrega da conversa à fila humana | encerramento |
| Vínculo CRM | associação auditável entre contato/conversa e Cliente PCM | lead comercial |

## Agregados, entidades e value objects
- **Agregado Conversa** (raiz: `atendimento.conversas`)
  - Entidades: mensagens, eventos de handoff, eventos de vínculo.
  - Value objects: `instance_id`, `remote_jid`, modo, motivo do handoff.
  - Invariantes: conversa pausada não recebe resposta automática; vínculo de cliente registra evento.
- **Agregado Persona** (raiz: `atendimento.personas`)
  - Entidade associativa: `instancias_agente`.
  - Invariantes: uma instância ativa resolve no máximo uma persona; configuração efetiva é da persona.

## Eventos de domínio
| Evento | Disparado quando | Quem reage |
|---|---|---|
| `ConversaTransferidaParaHumano` | regra ou falta de contexto pausa agente | Inbox humano |
| `ConversaVinculadaAoCliente` | atendente escolhe Cliente PCM | Atendimento/Relacionamento |

## Relações com outros contextos
Atendimento é Conformist de Evolution para eventos. `relacionamento` é Shared Kernel de identidade.
PCM é upstream de Cliente; Comercial recebe leads qualificados.

