---
name: "docs-adr-0813-avaliacao-fotografia-ocorrencia-md"
description: "Documento Sinérgica SO: ADR-0813 — Avaliação de decisão comparada à ocorrência fotografada"
alwaysApply: false
---

# ADR-0813 — Avaliação de decisão comparada à ocorrência fotografada

Status: preparado, não homologado. A decisão 0773 guarda fotografia integral da ocorrência preparada; a avaliação 0775 verificava revisão, ponte e OS, mas não comparava a ocorrência atual com a fotografia. Em teste sintético, mudar tolerância por escrita privilegiada preservou equivocadamente `decisoesObsoletas=0`.

A migration 1008 substitui a avaliação 0775 para comparar os campos operacionais de `fotografia.preparada` com os atuais: identificadores de ocorrência, Plano, versão, Rotina e identidade lógica, alvo, ciclo, vencimento original e tolerâncias. Diferença ou ausência de qualquer campo torna a decisão obsoleta; não substitui nem apaga a decisão, ocorrência ou OS, e não libera aprovação. Metadados como data de criação não invalidam a decisão. Novas colunas de significado operacional exigem revisão explícita desta projeção. Permanecem as demais verificações e os contratos de autorização/gates/ACL existentes.

Teste usa fixtures sintéticas em base descartável, construídas com gatilhos desativados somente durante preparação e reativados antes da mutação e avaliação. Não comprova que a alteração seja permitida a usuário comum, nem conclui inventário de escritores. Validar schema e função instalados, snapshots legados, normalização JSON, impacto de novas colunas, concorrência e revisão adversarial antes da ativação. Rollback: restaurar função 0775; não remover dados.

O teste `supabase/manual-tests/E01-S165_avaliacao_fotografia_ocorrencia.sql` falhou antes da alteração ao não detectar tolerância modificada. Com a migration na mesma transação, fotografia inicial e mudança apenas em `created_at` permaneceram atuais, enquanto tolerância alterada gerou uma decisão obsoleta. Migration, fixtures e gates revertidos; não há prova de reconciliação ou aprovação operacional.
