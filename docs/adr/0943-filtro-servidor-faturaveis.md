# ADR-0943 — Consulta filtrada e paginada de faturáveis

**Status:** preparação, não homologada.

Adicionar consulta por Cliente, situação e trecho do tipo de origem antes da paginação por ID. Manter contrato anterior sem alteração; nova interface usa flag desligada. Gate próprio nasce fechado. A RPC exige sessão, capacidade `faturavel.efetivar` por Cliente, read committed e trava de autorização; não emite, confere nem cancela itens.

As páginas são consultas separadas, não snapshot consistente. Antes de habilitar, comprovar todas as fontes/escritores de autorização e locks, RLS, isolamento entre Clientes, revogação, concorrência, resultado paginado e índices com volume representativo; executar revisão adversarial e plano de rollout. Valores financeiros permanecem restritos à permissão no servidor.
