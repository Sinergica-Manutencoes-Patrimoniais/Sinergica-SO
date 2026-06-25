---
name: spec-0002-abertura-chamado-ze
description: Contrato da feature de abertura de chamado via Agente Zé (AC testáveis). Fonte da verdade do gate de testes.
alwaysApply: false
---

# Spec — Abertura de Chamado via Agente Zé

> Status: **aprovado (aguarda implementação — Mês 2)** · Tier: arquitetural

## Resumo
O Agente Zé, integrado via WhatsApp, recebe mensagens de síndicos/zeladores, detecta solicitações
de manutenção e abre Ordens de Serviço estruturadas no PCM — sem intervenção humana, com
confirmação ao solicitante e latência < 10s.

## Critérios de aceite (AC)

### AC-1: Abertura de OS com os 3 pontos confirmados
- Dado um síndico que enviou mensagem no grupo WhatsApp descrevendo problema, local e urgência
- Quando o Zé processar a mensagem (modo `active` ou após menção)
- Então uma OS é criada no PCM com `origem = 'ze'`, `status = 'solicitacao'`, número CH-XXX atribuído, e o Zé responde no grupo confirmando com o número do chamado

### AC-2: Coleta de informações faltantes antes de abrir
- Dado um síndico que enviou mensagem com problema mas sem local ou urgência
- Quando o Zé processar a mensagem
- Então o Zé pergunta o dado faltante (no máximo 5 iterações de tool-calling); somente após ter os 3 pontos abre a OS

### AC-3: Detecção determinística de menção — sempre responde quando mencionado
- Dado uma mensagem que contém "Zé" (com ou sem acento) ou @bot_id
- Quando o sistema processar a mensagem, independente do modo configurado
- Então o Zé responde (não pula a mensagem)

### AC-4: Respeitar o modo de operação quando não mencionado
- Dado uma mensagem de serviço no grupo sem mencionar o Zé
- Quando o modo do condomínio for `monitor`
- Então o Zé não responde (SKIP)

- Dado uma mensagem de serviço no grupo sem mencionar o Zé
- Quando o modo do condomínio for `off`
- Então o Zé não responde (SKIP)

- Dado uma mensagem de serviço no grupo sem mencionar o Zé
- Quando o modo do condomínio for `active`
- Então o Zé responde e abre o chamado

### AC-5: Idempotência — não abre OS duplicada
- Dado um síndico que enviou múltiplas mensagens sobre o mesmo problema em rajada (dentro de 3s)
- Quando o Zé processar a fila agrupada
- Então somente uma OS é criada (não duplica por rajada de mensagens)

### AC-6: Fallback — fila não fica parada indefinidamente
- Dado um item de `wa_queue` com `wait_until` expirado há mais de 60s e que ainda não foi processado
- Quando o cron de fallback executar (máx 1 min de atraso)
- Então o item é processado e a fila avança (sem ficar parada por falha de `waitUntil`)

## Casos de borda e erros
- Mensagem off-topic sem menção ao Zé → SKIP (não responde).
- LLM indisponível (timeout) → log de erro em `wa_queue.error_message`; cron reprocessa na próxima janela.
- Condomínio sem `ze_active = true` → SKIP em qualquer modo.
- DM para o número do Zé de usuário que não está em `wa_admins` → SKIP.

## Fora de escopo (VINCULANTE)
- Análise de fotos ou áudios enviados pelo síndico.
- Fechamento ou atualização de OS existente (feature separada).
- Despacho para o Auvo (acontece na transição de status — feature separada).
- Geração de relatórios via Zé (feature separada).

## Rastreabilidade
- Product: [product.md](product.md)
- Domain: [domain.md](domain.md)
- Design: [design.md](design.md)
- Tasks: [tasks.md](tasks.md)
- ADR: [0001](../../docs/adr/0001-pcm-origin-truth-externalid.md) · [0002](../../docs/adr/0002-deteccao-deterministica-ze.md)
