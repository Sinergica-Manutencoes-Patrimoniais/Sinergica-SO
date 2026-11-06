# ADR-1407 — Recuperação da reserva de criação de Visita

## Contexto e decisão

A reserva anterior gerava um identificador diferente a cada chamada. A perda da resposta poderia impedir a recuperação segura. A entrada passa a serializar por ID de Visita e devolve a reserva existente apenas ao mesmo ator, Cliente e payload. Reservas antigas ambíguas ou divergentes são recusadas e exigem reconciliação; não são removidas. O cliente guarda os dados antes da reserva e repete a mesma identidade.

## Limites

A migration e a interface não foram testadas ou aplicadas. Validar escritores legados e concorrência, escopo da trava, RLS/FORCE, índices e volume, revogação de permissão, retenção, dados duplicados anteriores, perda de resposta e revisão adversarial antes de habilitar. A reserva não cria Visita nem tarefa Auvo.
