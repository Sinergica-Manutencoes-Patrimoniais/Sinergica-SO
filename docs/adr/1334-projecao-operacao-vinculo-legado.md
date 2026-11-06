# ADR-1334 — Vínculo legado na projeção operacional

**Estado:** proposta; não aplicada nem homologada.

## Contexto

A projeção `pcm.operacao_itens` apresenta OS e Chamados abertos ainda sem OS. O vínculo histórico pode estar somente em `chamados.ordem_servico_id`; a projeção existente verifica apenas `ordens_servico.chamado_id`. Nesse caso, pode apresentar simultaneamente a OS e um cartão sintético de Chamado aberto.

## Decisão

Manter a projeção existente e seu contrato, inclusive `security_invoker`, e considerar também a OS ativa identificada pelo vínculo histórico, desde que pertença ao mesmo Cliente e ainda não possua Chamado canônico. Preservar o comportamento existente para o vínculo em `ordens_servico.chamado_id`. Uma referência histórica a OS já vinculada a outro Chamado não suprime o cartão; a inconsistência exige reconciliação. Não atualizar cadastros, inferir vínculos ou alterar status. OS excluída continua sem suprimir o Chamado.

## Limites e implantação

Esta mudança não implementa cardinalidade 1:N, reconciliação de vínculos divergentes ou autorização adicional. A visibilidade da subconsulta continua sujeita às políticas das tabelas invocadas. Antes de aplicar, comparar a definição efetivamente instalada com a migration 0208, inventariar relações inconsistentes, avaliar a política RLS e planos de consulta e testar os dois vínculos, múltiplas OS, clientes distintos, OS excluída e permissões diferentes. Revisão adversarial e implantação coordenada continuam necessárias; a migration não foi aplicada ou testada.
