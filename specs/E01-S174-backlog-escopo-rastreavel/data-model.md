# Data Model — E01-S174

## Aggregates and Constraints

pcm.backlog_itens é fila com origem, Cliente, escopo e GUTD; composição liga várias Pendências e parcelas sem apagar fonte. Ligação Backlog/Chamado registra promoção, atendimento e retorno do restante. Estados Aguardando/Priorizado/Selecionado/Chamado aberto, com decisões risco/dispensa/cancelamento auditadas. Registros PRE/OS legados migram com mapping, não por título.

## State and history

### US1 — Priorizar escopo selecionado sem criar execução

- AC-1: Dadas Pendências selecionadas, quando compor Backlog, então agrupamento é objeto próprio com links às fontes, sem OS/Chamado ainda; seleção concorrente/retry não duplica mesma parcela ativa.
- AC-2: Dado backlog, quando priorizar/filtrar, então mantém ranking GUTD existente, filtros por Cliente e escopo; Pendência não selecionada não polui fila.
- AC-3: Dado risco aceito ou dispensa, quando decidir com permissão/motivo, então preserva registro/origem e histórico sem marcar execução ou apagar Pendência.

### US2 — Promover e devolver somente restante

- AC-4: Dado escopo selecionado, quando promover ao Chamado, então preserva IDs/origens e só cria contêiner escolhido; uma requisição repetida retorna mesmo Chamado.
- AC-5: Dado Chamado suspenso, quando devolver, então retorna apenas parcela não resolvida à fila ligada, sem perder OS executadas ou duplicar escopo já em tratamento.
- AC-6: Dado Kanban ou Cliente 360, quando abrir painel lateral de Backlog, então usa mesmo conjunto Cliente/ranking, mantém contexto/foco e não duplica card de Chamado com OS.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
