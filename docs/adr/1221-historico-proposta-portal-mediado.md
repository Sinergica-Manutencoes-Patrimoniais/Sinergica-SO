# ADR-1221 — Histórico de proposta operacional no Portal

## Decisão

Preparar entradas autenticadas para listar versões publicadas de proposta operacional e consultar uma versão pública. Exigem ator atual, acesso ao Cliente, OS e proposta conforme contrato existente e o gate de exportação; os núcleos privados permanecem responsáveis por projeção pública e visibilidade da versão.

As consultas não publicam, aprovam ou alteram propostas e não retornam deliberadamente custos internos. Não assumem fotografia única entre páginas, itens e PDF; a interface reconsulta antes da entrega.

## Gates

Manter flag e gates fechados até ensaios de RLS/FORCE, projeção de payloads legados, retirada simultânea, revogação, locks, acesso cruzado e revisão adversarial. A trava de autorização não comprova cobertura de todos os escritores.
