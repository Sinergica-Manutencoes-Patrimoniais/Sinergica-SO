---
name: "docs-adr-1379-mudanca-dia-grupo-sem-efeitos-md"
description: "Documento Sinérgica SO: ADR-1379 — Mudança de dia com ocorrência de Grupo sem efeitos"
alwaysApply: false
---

# ADR-1379 — Mudança de dia com ocorrência de Grupo sem efeitos

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Permitir, sob gate próprio desligado, movimentar uma Visita futura não confirmada que possui ocorrência de Grupo quando a identidade de Grupo corresponde à ocorrência e não há OS, intenção, atestado, foto, decisão, quantidade declarada ou pendência vinculada. A fotografia de quantidade aprovada pode permanecer: não é alterada. O histórico de movimento existente preserva vencimento original, Visita, ocorrência e Grupo; somente a programação da Visita muda. Feriado continua exigindo reconciliação para Grupo.

Travas de leitura nas tabelas verificadas impedem que uma dependência conhecida seja criada concorrentemente. A alteração da função instalada é aplicada apenas se o trecho esperado ocorrer exatamente uma vez; caso contrário a migration falha sem substituição.

## Limites

Não altera tarefa Auvo, OS ou cadastros, nem prova ausência de referências fora do inventário conhecido. Antes de habilitar, inventariar todos os vínculos e consumidores, verificar supressões, snapshots, quantidade, RLS/FORCE, locks, concorrência, replay e revisão adversarial; testar ambos os sentidos de corrida e preservação histórica. Não libera feriados ou casos com efeitos.
