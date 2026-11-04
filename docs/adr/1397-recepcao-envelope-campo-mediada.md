# ADR-1397 — Recepção manual de envelope de campo mediada

A recepção manual e a consulta de recibo usam entradas autenticadas separadas, protegidas por `cadastro.gerir`, identidade do ator e gates fechados. O núcleo privado valida Cliente, OS, tarefa, conteúdo estruturado e repetição, criando somente lote pendente para revisão. Não interpreta texto corrido, importa fotos nem incorpora cadastros.

Antes de liberar: validar fonte e vínculos, integridade, concorrência com retificação, replay, revogação, ACL/RLS/FORCE, limites, Storage e revisão adversarial. A identificação manual não comprova autenticidade do conteúdo ou da origem.
