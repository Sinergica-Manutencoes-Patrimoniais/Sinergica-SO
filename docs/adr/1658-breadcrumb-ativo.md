# ADR-1658 — Breadcrumb físico de Componente e Equipamento

## Estado

Proposta E01-S176; não aplicada nem homologada.

## Decisão

Preparar consulta própria para o caminho físico Cliente/Área/Local e ancestrais, sem reinterpretar Sistema como Local. O servidor valida ator, Cliente e Local esperado, capacidade atual e gate fechado. Caminho vem de uma única consulta recursiva, limitada a 64 níveis, e retorna estados explícitos para posição ausente, referência inválida, ciclo ou limite. A consulta também suporta posição direta em Área e cadastro sem posição, sem inventar níveis. Uma trava compartilhada de autorização protege contra escritores participantes do protocolo 0319; a consulta não altera dados.

## Limites

A consulta representa um snapshot de leitura, não mantém o caminho atual depois da resposta; concorrência de mudanças estruturais, políticas/grants, isolamento, limites e ciclos exigem testes integrados. O gate e a flag permanecem desligados até revisão adversarial. O breadcrumb físico não representa composição funcional e não corrige registros históricos inconsistentes.
