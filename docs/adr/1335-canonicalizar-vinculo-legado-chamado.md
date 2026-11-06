---
name: "docs-adr-1335-canonicalizar-vinculo-legado-chamado-md"
description: "Documento Sinérgica SO: ADR-1335 — Canonicalização explícita do vínculo legado de Chamado"
alwaysApply: false
---

# ADR-1335 — Canonicalização explícita do vínculo legado de Chamado

**Estado:** proposta; não aplicada nem homologada.

## Contexto

O modelo 1:N usa `ordens_servico.chamado_id`, mas registros antigos podem ter somente `chamados.ordem_servico_id`. A migração deve preservar identificadores e números e não escolher entre referências conflitantes.

## Decisão

Preparar comando transacional individual, com revisão esperada, motivo, autorização, recibo idempotente e auditoria. O comando só preenche o Chamado canônico de uma OS ativa quando o vínculo singular aponta para ela, ambos pertencem ao mesmo Cliente e nenhuma outra referência ativa é ambígua. Não altera número, status ou vínculo singular. Uma operação já concluída pode ser repetida com o mesmo pedido e ator; outro conteúdo é recusado.

Para não decidir sobre uma fotografia concorrente, enquanto existirem escritores legados sem protocolo comum o comando adquire, sem esperar, travas de escrita nas duas tabelas. É uma medida de transição, de impacto potencial global, não uma solução de alto volume. O gate inicia fechado e deve ser aberto apenas após planejar janela e compatibilidade. Não inferir ou corrigir conflitos automaticamente.

## Limites

A mudança não remove a restrição de uma OS nem migra automaticamente os dados. A função é concedida ao papel autenticado, mas continua inacessível para escrita enquanto o gate estiver fechado; o comando também confere capacidade e Cliente. Conferir permissões, serialização de revogação, triggers e efeitos Auvo, isolamento, contenção, replays, integridade de auditoria e carga antes da ativação; revisão adversarial e testes integrados continuam obrigatórios. Não executar contra dados oficiais antes do rollout coordenado.
