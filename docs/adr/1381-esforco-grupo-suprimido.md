# ADR-1381 — Esforço de Grupo em Visita suprimida

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Manter a função de esforço existente privada e envolver sua leitura: após a autorização existente, recusar estimativa quando a ocorrência de Grupo pertence a Visita com supressão registrada por feriado. Não devolver zero nem classificar como demanda incompleta. Ocorrências de calendário e de Visitas não suprimidas preservam o contrato anterior.

## Limites

A consulta é uma fotografia sem travas, não substitui exclusão anterior à paginação em listas e indicadores. Não libera supressão de Grupo. Antes de habilitar, verificar todos os consumidores, sessão, isolamento, concorrência, ACL/RLS/FORCE e revisão adversarial; testar compatibilidade das funções estáveis que chamam o núcleo. Migration não aplicada nem testada.
