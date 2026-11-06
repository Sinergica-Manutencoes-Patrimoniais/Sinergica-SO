---
name: "docs-adr-1360-candidata-t24-emergencial-md"
description: "Documento Sinérgica SO: ADR 1360 — Candidata T−24 para OS emergencial"
alwaysApply: false
---

# ADR 1360 — Candidata T−24 para OS emergencial

## Contexto

O produtor de reparos aceita OS corretiva, mas não emergencial. Ambas podem exigir agendamento, e a categoria de negócio não deve ser alterada para contornar essa limitação. O contrato efetivo com Auvo para emergências ainda precisa ser comprovado.

## Decisão

Preparar atendimento de OS `emergencial` pelo produtor técnico de reparos existente somente sob gate próprio, além dos gates já exigidos para corretiva e T−24. A categoria original é fotografada em tabela imutável por tentativa e conferida antes de qualquer efeito; mudança de categoria invalida a tentativa. O identificador técnico de protocolo existente continua `corretiva`, sem mudar a categoria da OS. Tentativas antigas sem fotografia permanecem elegíveis apenas se a OS continuar corretiva.

## Consequências

O código prepara candidata local e não chama Auvo. O gate emergencial inicia fechado e não constitui prova de que prazo T−24 ou contrato de tarefa sejam adequados para emergências. Validar regras operacionais, contrato, fotografia, revalidação, sessão, concorrência, RLS/FORCE e revisão adversarial antes de habilitar. Não alterar a prioridade ou reclassificar OS antigas.
