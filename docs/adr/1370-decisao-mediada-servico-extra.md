# ADR-1370 — Declaração e decisão mediadas de serviço extra

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Adicionar entradas autenticadas para os comandos privados já existentes de declaração e decisão de serviço extra. A escrita exige gate mediado independente, gate de serviço e gate de coordenação de quantidades ligados, trava de autorização, capacidades atuais e rechecagem após comando. A coordenação é obrigatória para impedir o retorno ao caminho legado que não agrega quantidades de linhas. Reaproveitar identidade de pedido, auditoria, separação de autores e validações dos núcleos. Nenhum comando produz faturável, cobrança ou recebível.

## Limites

O gate inicia desligado. Validar todas as fontes e seus gates, travas, versionamento, integridade da proposta, concorrência com material, idempotência, segregação de funções, RLS/FORCE e revisão adversarial antes de ativar. A declaração e a decisão não provam execução física ou exclusividade financeira.
