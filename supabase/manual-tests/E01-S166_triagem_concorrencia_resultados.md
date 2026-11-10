---
name: "supabase-manual-tests-e01-s166-triagem-concorrencia-resultados-md"
description: "Documento Sinérgica SO: S166 — autorização da triagem de atraso"
alwaysApply: false
---

# S166 — autorização da triagem de atraso

Em banco sintético `sso_s166_triagem_prova`, restaurado do diagnóstico
condicionado e com fixture `E01-S168_finalizacao_fixture_real.sql`, concessão
`plano.gerir` e gate abertos exclusivamente no clone, o roteiro
`E01-S166_triagem_concorrencia.sql` reproduziu 4/4 falhas no código anterior:
revogação e fechamento do gate não eram serializados em qualquer das ordens.

Após aplicar 1038 somente no clone, 4/4 passaram em duas sessões; a triagem
foi revertida. Em outro clone sem fixture persistente, os nove testes
`E01-S166_triagem_atraso.test.sql` passaram em rollback. Um comando direto
em REPEATABLE READ recusou a triagem com `isolamento_nao_suportado`.

As provas não cobrem alteração concorrente de Plano/Cliente, todas as fontes
de ocorrência, replay com commit entre sessões ou JWT revogado externamente.
Avaliar contenção e executar revisão adversarial antes de homologar. Não
houve deploy nem mudança de gate do banco compartilhado.
