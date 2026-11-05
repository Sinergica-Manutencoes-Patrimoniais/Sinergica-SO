---
name: autorizacao-revisao-concorrencia-1773
description: Ensaio transacional de início e submissão de revisão contra revogação.
alwaysApply: false
---

# Autorização concorrente da revisão

Executar apenas em clones descartáveis com migrations até 1773. O setup sintético deriva de `manual_E01-S165_impacto_calendario_nativo_1704.sql`. Para iniciar revisão, executar o setup até antes de `sso_iniciar_revisao_plano`, deixando Plano aprovado na revisão 1; para submissão, executar o setup completo, deixando rascunho na revisão 2. Nenhum dado real ou serviço externo é usado.

1. Em A, iniciar transação e revogar a concessão individual `plano.gerir`, sem concluir. Em B, sob claims do usuário sintético, tentar iniciar revisão ou submeter o rascunho. Espera-se `55P03 autorizacao_em_alteracao`, sem mutação. Reverter A.
2. Em A, iniciar transação autenticada e executar início ou submissão com revisão válida, mantendo-a aberta. Em B, tentar revogar a concessão. Espera-se `55P03 autorizacao_em_alteracao`; reverter ambas.
3. Sem disputa, executar e repetir o mesmo request; comparar recibos. Revogar a concessão e repetir: esperar 42501, sem devolver recibo.
4. Sob REPEATABLE READ, a operação deve recusar com 25001 antes da autorização ou mutação.

O teste não substitui homologação nem demonstra operação no Auvo.
