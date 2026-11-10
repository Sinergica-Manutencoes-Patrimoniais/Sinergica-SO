---
name: "adr-1682-mudanca-dia-grande-volume-implementacao"
description: "Implementação controlada do fluxo S166 para mudança de dia acima de 500 Visitas"
alwaysApply: false
---

# ADR-1682 — Implementação controlada da mudança de dia acima de 500 Visitas

## Estado

Aceito como decisão de implementação na branch de trabalho. Não abre gate, não define teto acima de 500 e não autoriza homologação, merge ou deploy. A inspeção estática encontrou o fluxo V2 paginado e uma fixture de 501 itens com orçamento sintético 600 já preparados; esta ADR confirma seu uso e ajusta a ordem: código pode ser preparado sob gates fechados e medido no lote final integrado. A ADR-1671 continua válida para limites, escala e condições de habilitação.

## Contexto

A S166 precisa suportar mudanças de dia contratual acima de 500 Visitas. Fabrício definiu que operações demoradas devem aparecer como **Em andamento**. A UI V1 e o gate atual limitam a 500. A UI e o protocolo V2 já preparam uma fotografia persistida e paginada, com estados `montando`, `pronta`, `aplicada`, `invalidada` e `expirada`; a confirmação existente percorre as Visitas e suas transições numa transação única. A capacidade máxima segura ainda não foi medida.

## Decisão

- Usar o fluxo V2 existente como caminho de grande volume: fotografia paginada por Cliente/ator/série/revisão, retomada após interrupção, conferência de todas as páginas e confirmação explícita do conjunto completo. Não duplicar o protocolo nem criar nova migration sem achado integrado que a exija.
- Apresentar o estado persistido `montando` na interface como **Em andamento**. O texto não declara sucesso nem execução parcial.
- Preservar confirmação atômica, requestId idempotente, verificações de autorização/revogação, ordem de locks, transições e auditoria. Não dividir aplicação operacional em commits independentes.
- Manter `max_itens=500`, `max_bytes`, expiração e gates desligados até a rodada integrada medir duração, locks, WAL, memória e concorrência com dados sintéticos representativos. Após medir, escolher e registrar teto explícito em alteração aditiva, sujeita à revisão adversarial. Volume ilimitado não é aceito.
- Desenvolver e revisar o código antes dessa rodada; executar todos os testes de lote apenas depois de fechar as implementações S165/S166/S170/S176, conforme a ordem solicitada pelo usuário. Se a medição não provar capacidade acima de 500, manter a operação bloqueada e registrar o limite observado.

## Consequências

O estado visual de andamento pode ser concluído sem habilitar operação. O fluxo só aceitará mais de 500 quando o gate persistido, o orçamento de itens/bytes e a medição aprovarem o teto. O gate de produção permanece fechado; nenhum fluxo dispara OS ou tarefa real no Auvo. Otimizações set-based só podem substituir transições existentes se preservarem integralmente invariantes, locks, auditoria e replay, demonstrados na revisão.

## Evidência e revisão

Ver [ADR-1671](1671-mudanca-dia-grande-volume.md), [E01-S166 spec](../../specs/E01-S166-calendario-ocorrencias-capacidade/spec.md) e [registro do lote](../planejamento/plano-manutencao/validacao-lote-s165-s166-s170-s176.md). A revisão adversarial e a medição integrada continuam obrigatórias antes de PASS ou de qualquer habilitação.
