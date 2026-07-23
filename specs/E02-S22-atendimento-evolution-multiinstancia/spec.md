---
name: spec
description: Contrato do Atendimento pronto para múltiplas instâncias no mesmo Evolution.
alwaysApply: true
---

# Spec — Atendimento Evolution multi-instância operacional

> **Fonte da verdade.** Status: implementado em produção; UAT com instâncias reais pendente

## Resumo
Cada instância do servidor Evolution usa sua própria persona, conhecimento e regras, com handoff
humano e vínculo auditável ao Cliente PCM.

## Critérios de aceite

### AC-1: Duas instâncias no mesmo servidor
- **Dado** um único `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` e duas instâncias ativas
- **Quando** ambas são conectadas/configuradas
- **Então** cada uma recebe webhook próprio e mantém status/número sem cruzamento

### AC-2: Roteamento por instância
- **Dado** instância A ligada à persona A e instância B à persona B
- **Quando** mensagens chegam simultaneamente
- **Então** cada fila usa somente a persona correspondente; fallback legado ocorre apenas sem vínculo

### AC-3: Configuração efetiva por persona
- **Dado** personas com prompt, modelo, RAG, conhecimento, janela e regras diferentes
- **Quando** seus agentes respondem
- **Então** runtime usa configuração da persona efetiva, incluindo `transferir_apos_n_respostas`

### AC-4: Handoff automático e manual
- **Dado** palavra-gatilho, limite de respostas, limite diário ou ação humana
- **Quando** condição ocorre
- **Então** conversa fica `pausado/pendente`, agente não responde, motivo e evento são persistidos

### AC-5: Retorno controlado à IA
- **Dado** conversa assumida por humano
- **Quando** humano devolve ou solicita uma resposta pontual da IA
- **Então** chamada autorizada ocorre pelo servidor; browser nunca recebe `service_role`

### AC-6: Vínculo com Cliente PCM
- **Dado** conversa com contato e usuário com `atendimento:escrita`
- **Quando** seleciona Cliente PCM
- **Então** conversa e `relacionamento.vinculos` mudam atomicamente e evento append-only registra ator

### AC-7: Webhook seguro e idempotente
- **Dado** webhook Evolution
- **Quando** assinatura/token é inválido, limite excede ou `fromMe=true`
- **Então** requisição forjada é negada e mensagem própria é ignorada; reentrega não duplica mensagem

### AC-8: Contrato de envio Evolution
- **Dado** envio de texto pelo agente ou humano
- **Quando** chama Evolution
- **Então** payload segue contrato adotado (`number` + `textMessage.text`) e erro remoto fica observável

### AC-9: Compatibilidade operacional
- **Dado** condomínio legado com `config_ze` e sem vínculo de instância
- **Quando** recebe mensagem
- **Então** persona ativa de chamados continua funcionando até migração explícita

## Matriz de decisão
| Vínculo instância | Persona | Cliente | Resultado | AC |
|---|---|---|---|---|
| sim | chamados | sim | agente de chamados da instância | AC-2, AC-3 |
| sim | chamados | não | handoff por cliente ausente | AC-4, AC-6 |
| sim | comercial | não/sim | agente comercial da instância | AC-2, AC-3 |
| não | — | config_ze presente | fallback chamados | AC-9 |
| não | — | ausente | skip seguro | AC-7 |

## Casos de borda e erros
- Mensagem `fromMe`, status broadcast ou evento diferente de `messages.upsert` é ignorado.
- Evolution indisponível marca envio como erro sem registrar entrega falsa.
- Persona desativada não recebe novas mensagens.
- Vínculo a cliente inexistente ou sem permissão falha sem mudança parcial.
- Handoff concorrente gera eventos idempotentes por transição.

## Fora de escopo
- Mais de um servidor Evolution.
- Criar Cliente PCM pelo Inbox.
- Responder automaticamente depois do handoff.

## Rastreabilidade
- Product: [product.md](./product.md) · Design: [design.md](./design.md) · Domínio: [domain.md](./domain.md)
- ADR: [ADR-0013](../../docs/adr/0013-roteamento-atendimento-por-instancia-evolution.md)
- Segurança: [threat-model.md](./threat-model.md)
