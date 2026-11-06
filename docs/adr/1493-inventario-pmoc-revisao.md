# ADR-1493 — Inventário explícito de agendamentos PMOC na revisão

## Contexto
Agendamentos PMOC pertencem a imóvel e contrato, sem alvo funcional identificável pelo banco. Um inventário apenas de vínculos declarados deixa agendamentos não mapeados fora da análise de revisão.

## Decisão
Preparar inventário paginado de todos os agendamentos PMOC dos imóveis do Cliente, com classificação PCM por Plano e rascunho: relacionado, não relacionado ou histórico preservado. Cada decisão registra motivo, evidência e fotografia da cadeia. A interface mostra imóvel, contrato, período e evidência anterior; o servidor compara a fotografia confirmada com a atual sob trava antes de registrar a decisão. Relacionado exige vínculo atual ao Plano; histórico só é admissível na aprovação para vencimento anterior à vigência ou agenda cancelada. Mudança na cadeia invalida classificação. Ao aprovar, sob gate de continuidade, o inventário deve estar classificado e consistente na mesma transação; agendamentos novos tornam a cobertura pendente. Não alterar PMOC, OS ou tarefas.

## Limites
A classificação é ato humano auditado, não valida automaticamente documento externo ou todos os sistemas de origem. Inventário por Cliente pode ser volumoso e requer revisão operacional/performance; fontes legadas, fuso e demais consumidores continuam com guardas próprias. Testar permissões, concorrência, decisão obsoleta, históricos e rollback antes de habilitar; revisão adversarial e guarda 1045 permanecem obrigatórias. Sem deploy ou Auvo.
