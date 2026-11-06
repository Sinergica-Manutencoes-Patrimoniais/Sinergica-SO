# Data Model — E01-S186

## Aggregates and Constraints

Lote de migração tem versão, origem, contagens antes/depois, mapping de UUIDs/referências, itens ambíguos e trilha de reversão lógica. Evidência CT contém versão, ambiente, executor/data, IDs, resultado, captura/log sanitizado e ressalva. Aceite de onda e liberação operacional são registros explícitos, não inferidos de testes.

## State and history

### US1 — Migrar por prévia e lotes reexecutáveis

- AC-1: Dados legados, quando simular, então relatório separa novos/alterados/duplicidades/erros/ambíguos com contagens e mapping; nenhuma OS é vinculada a Visita só por proximidade temporal.
- AC-2: Dado aceite da prévia, quando migrar em teste, então preserva UUIDs/códigos/IDs Auvo/histórico, converte plano simples em versão1 sem reescrever ocorrência passada e remove dependência singular somente após leitores/escritores compatíveis.
- AC-3: Dado mesmo lote repetido, quando reexecutar, então contagens são iguais e não duplica; rollback lógico identifica dependência posterior e mantém pendência de reconciliação em vez de apagar execução/financeiro.

### US2 — Homologar ondas sem declarar entrega antecipada

- AC-4: Dadas ondas Guainumbí estrutura e depois Chamado/Visita/T24, quando homologar, então exige árvore/busca sem duplicidade e CT001–011 com evidências; Rimini/I Home comprovam Plano/versionamento/calendário e tempos pendentes explícitos.
- AC-5: Dadas ondas Pendência/Backlog/campo, Materiais/orçamento e A Faturar/Portal/permissões, quando avaliar, então CT016–030 e segurança/duplicidade são registrados; cliente adicional e geração real dependem liberação Fabrício.
- AC-6: Dada matriz CT completa e gates CI, quando registrar conclusão, então inclui versão/ambiente/executor/data/IDs/resultados/capturas/logs e aceite funcional/ressalvas; planilhas só saem após equivalência/estabilidade/aceite formal.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
