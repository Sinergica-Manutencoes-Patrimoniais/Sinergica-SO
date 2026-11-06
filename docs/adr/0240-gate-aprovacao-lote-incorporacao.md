# ADR-0240 — Aprovação do lote antes de incorporar

## Decisão

Preparar guarda transacional única sobre a tabela de decisões de incorporação/vínculo, cobrindo comandos de localização, criação e vínculo/atualização de ativos. A guarda falha fechada enquanto o gate não estiver habilitado; depois exige conferência consolidada prévia, revisão explícita da linha e atributos idênticos, além da versão do candidato de código congelada no ato da conferência. Conferência e rejeição não são bloqueadas. Inserções e guarda estão na mesma transação e qualquer falha reverte o cadastro criado.

## Limites

O snapshot de candidatos só existe para aprovações posteriores a esta migration; aprovações anteriores precisam ser refeitas. Por ausência de reabertura versionada, candidato não pode ser alterado após conferência da linha; deve ser escolhido antes, e correção posterior precisa de fluxo auditado próprio. A guarda não identifica escritores que alterem diretamente cadastros sem registrar incorporação e não substitui checagens de duplicidade, vínculo ou autorização no comando. Linha já incorporada antes da aplicação não é revertida. Seguem gates e RPCs fechados; revisar locks, histórico, migração e todos os consumidores, e testar antes do rollout.
