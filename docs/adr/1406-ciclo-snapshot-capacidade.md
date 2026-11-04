# ADR-1406 — Identidade canônica no resumo de capacidade

O snapshot por semana programada pode acrescentar o ciclo canônico às ocorrências de calendário presentes em cada fonte. O vínculo é consultado no servidor para o mesmo Cliente; ausência fica nula e mais de um ciclo distinto interrompe a consulta. A interface considera o ciclo entre identidades para detectar duas OS ou uma OS e ocorrência que representam a mesma obrigação.

Fonte continua parcial, não transacional e sem garantir cobertura ou saldo operacional. Gate novo e opção de interface começam desligados. Validar versões, vínculos legados, Cliente, concorrência, limites, fuso, RLS/FORCE e revisão adversarial antes de habilitar.
