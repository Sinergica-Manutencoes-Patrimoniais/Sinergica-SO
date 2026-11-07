---
name: "adr-1671-mudanca-dia-grande-volume"
description: "Desenho para mudança de dia contratual acima de 500 visitas"
alwaysApply: false
---

# ADR-1671 — Mudança de dia contratual acima de 500 visitas

## Estado

Proposta de desenho, não implementada nem homologada. A operação atual permanece limitada a 500 candidatas. Este documento não autoriza abrir gates nem alterar o limite.

## Contexto

A prévia já é paginada, mas a confirmação atual fotografa todas as candidatas, persiste o pedido para repetição e executa a mudança da regra e das visitas em uma transação. A migration 1233 limita o JSON a 500 entradas; o processamento atual procura cada visita no JSON e acumula resultados no mesmo JSON. Aumentar apenas esse limite amplia trabalho, memória, WAL, duração de travas e risco de timeout sem orçamento comprovado. Executar lotes com commits independentes não preservaria a atomicidade atual.

## Direção proposta

Uma borda versionada, separada e com gate inicialmente fechado deve permitir montar uma fotografia paginada, vinculada ao ator, Cliente, série, revisão da regra, vigência, dia e parâmetros de impacto. A confirmação explícita deve identificar exatamente essa fotografia completa, inclusive ausência de páginas e itens repetidos. O protocolo deve preservar o pedido antigo e permitir recuperar o recibo idêntico após resultado incerto, sem iniciar outra operação nem exigir o novo gate para repetir o protocolo antigo.

Na transação final, validar autorização atual, gate, integridade e completude da fotografia sob o protocolo de concorrência existente; bloquear série, regra e visitas em ordem compatível; comparar o conjunto efetivo e todas as revisões e impactos em operações de conjunto. Só então efetivar regra, alterações, supressões, histórico e recibo em uma transação. Divergência, contenção ou erro deve reverter tudo. Preservar visitas confirmadas, extras, reprogramadas e exceções aprovadas e as verificações existentes de feriados, ocorrências e ordens de serviço. Não criar equivalência automática nem efeitos externos.

A prévia deve ter paginação limitada, armazenamento e expiração definidos, proteção por Cliente e ator, e invalidação contra alterações concorrentes. O pedido persistido pela interface deve distinguir versões de protocolo e manter tentativas antigas recuperáveis. Payloads, recibos, uso de armazenamento e limpeza de fotografias incompletas precisam de limites e autorização explícitos; nenhum tamanho é adotado por esta proposta.

## Condições antes de implementar ou habilitar

- Revisar corpos efetivos e ordem de travas das migrations posteriores à 1233, bem como todos os escritores de Visita, feriado, ocorrência e exceção; provar que mudanças durante a montagem e a confirmação não escapam da comparação.
- Especificar limites de itens, bytes, retenção, timeout e concorrência a partir de medições representativas de memória, CPU, WAL, duração de travas e capacidade da borda e do armazenamento do navegador; rejeitar limites excedidos sem alterações parciais.
- Preparar e executar em clone isolado testes de escala, duas ordens de concorrência, falha no meio, rollback, alteração de fonte entre páginas, revogação, replay após timeout e manutenção dos pedidos legados.
- Registrar ADR de implementação e migration aditiva, mantendo os contratos existentes, gates fechados e privilégios mínimos. Validar rollout e reversão operacional antes de qualquer habilitação.

Sem essas evidências, não há fundamento para escolher um teto maior nem para declarar segura a operação acima de 500 candidatas.
