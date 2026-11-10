---
name: autorizacao-rotina-concorrencia-1771
description: Ensaio de duas sessões para revogação e mutações de Rotina.
alwaysApply: false
---

# Concorrência de autorização de Rotina

Executar exclusivamente em clone descartável com migrations até 1771. Preparar e confirmar dados sintéticos de `manual_E01-S165_impacto_calendario_nativo_1704.sql` no clone; coletar o ID da Rotina de rascunho da versão `16630000-1111-4000-8000-000000000022`. Não usar Cliente ou credenciais reais.

1. Na sessão A, `BEGIN`, revogar `plano.gerir` da concessão do usuário sintético e manter a transação aberta. Na sessão B, autenticada como esse usuário, executar `sso_editar_rotina_rascunho_v2` no Plano e Rotina sintéticos com revisão 2. Espera-se `55P03 autorizacao_em_alteracao`, nenhuma edição. Encerrar A com `ROLLBACK`.
2. Na sessão A, autenticada e em `BEGIN`, editar a Rotina com revisão 2 e manter a transação aberta. Na sessão B, tentar revogar a concessão. Espera-se contenção da revogação; somente após término de A ela pode prosseguir. Reverter ambas.
3. Repetir o primeiro sentido para `sso_adicionar_rotina_rascunho_v2` e `sso_retirar_rotina_rascunho` com dados válidos; confirmar `55P03` antes de qualquer mutação. Sem disputa, confirmar inclusão/edição/retirada e repetir o mesmo request para conferir replay.
4. Repetir uma chamada sob REPEATABLE READ: espera-se `25001 isolamento_nao_suportado`.

A fixture e as transações são sintéticas; o ensaio não valida Auvo nem substitui CI/homologação.
