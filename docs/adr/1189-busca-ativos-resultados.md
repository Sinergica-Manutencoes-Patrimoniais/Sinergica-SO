# ADR-1189 — Busca de ativos para resultados de campo

**Status:** proposta local; não homologada.

## Contexto

A consulta de resultados aceita Sistema, Componente ou Grupo Quantitativo, mas a seleção na tela dependia das Pendências carregadas. Um ativo com apenas respostas Corrigido ou Não aplicável podia ficar inacessível sem seu identificador.

## Decisão

Preparar consulta paginada por tipo, Cliente e nome no cadastro existente, inclusive ativos inativos não excluídos. Exigir identidade atual, `cadastro.ler`, `execucao.validar` e os gates de resultados e busca. A consulta retorna apenas identificador, nome e estado ativo; não afirma existir resultado nem cria registros. A tela usa seleção explícita e mantém consulta por identificador como alternativa.

## Limites e rollout

Migration aditiva com gate novo fechado. Não aplicar ou ativar antes de validar autorização e revogação, isolamento entre Clientes, RLS/FORCE, ordenação, busca literal, paginação concorrente, volume, índices, acessibilidade e revisão adversarial. A consulta de resultados continua independente e a cobertura de retornos permanece parcial. Nenhum dado é migrado ou removido.
