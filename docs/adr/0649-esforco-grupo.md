---
name: "docs-adr-0649-esforco-grupo-md"
description: "Documento Sinérgica SO: ADR-0649 — Estimativa de esforço de Grupo"
alwaysApply: false
---

# ADR-0649 — Estimativa de esforço de Grupo

Consulta autorizada multiplica quantidade congelada na aprovação por tempo positivo explicitamente classificado por unidade no snapshot histórico da mesma Rotina. Valores retornam em texto com cálculo numérico sem overflow de inteiro. Sem proveniência da quantidade, snapshot ou tempo por unidade válido, informa `tempo_a_validar`; não usa cadastro atual ou presume tempo total como unitário.

Resultado é estimativa, não reserva de capacidade, prova de execução ou encerramento. Gate e permissões permanecem fechados; revisão, testes e homologação pendentes.
