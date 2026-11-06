---
name: "supabase-tests-manual-e01-s166-leitura-excecao-autorizacao-1734-md"
description: "Documento Sinérgica SO: Leitura de exceção e revogação concorrentes"
alwaysApply: false
---

# Leitura de exceção e revogação concorrentes

Usar clone descartável isolado com migrations até 1734. Preparar os dados de `manual_E01-S166_excecao_aprovada_1732.sql`, habilitar o gate apenas no clone e confirmar uma exceção sintética. As duas permissões `plano.gerir` e `visita.confirmar` devem estar ativas para o ator da fixture.

Na sessão A, revogar `plano.gerir` em `config.sso_concessoes` e manter a transação aberta. Na sessão B, autenticada como o ator, consultar `pcm.sso_consultar_excecao_visita`: deve receber `55P03` com `autorizacao_em_alteracao`. Confirmar a revogação; a consulta seguinte deve ser negada por permissão.

Restaurar a concessão somente no clone e inverter: consultar o histórico na sessão A, manter transação aberta e tentar revogação em B. A revogação deve receber `55P03` com `autorizacao_em_alteracao`. Reverter A, confirmar a revogação e conferir que a consulta é negada. Repetir consulta em `REPEATABLE READ`: deve receber `25001` com `isolamento_nao_suportado`. Descartar o clone.

Antes da 1734, o primeiro cenário retornou o histórico durante a revogação em curso. Após a 1734, ambas as ordens e a verificação de isolamento passaram. Não houve integração externa ou tarefa Auvo.

Teste complementar em clone: aprovação e consulta recusaram uma Visita pertencente a outro Cliente, mesmo com o Cliente autorizado informado na chamada; consulta também recusou ator divergente do JWT. Após aprovar exceção e revogar `visita.confirmar`, tanto o replay quanto a consulta foram negados. Os dados do segundo Cliente eram sintéticos; não prova ACL global do projeto.
