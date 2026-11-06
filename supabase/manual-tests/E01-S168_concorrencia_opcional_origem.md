---
name: "supabase-manual-tests-e01-s168-concorrencia-opcional-origem-md"
description: "Documento Sinérgica SO: S168 — Aprovação e origem concorrentes"
alwaysApply: false
---

# S168 — Aprovação e origem concorrentes

Experimento em clone de schema descartável `sso_s168_opcional_concorrencia`, sem dados reais nem schemas/serviços cron e net. Fixture `E01-S168_opcional_concorrencia_fixture.sql` classificou retorno com pergunta opcional não inspecionada e obrigatória Não OK, e registrou conferência sintética. Migrations 1031/1033 foram usadas apenas no clone.

- Duas sessões chamaram a atestação PCM privada com o mesmo request. A segunda aguardou `Lock/advisory` até o commit da primeira e retornou o mesmo resultado. Consultas posteriores encontraram uma atestação, uma decisão, uma Pendência e OS `em_execucao`. Isso não prova acesso autenticado direto ao núcleo privado ou casos com requests diferentes.
- Antes da guarda 1036, UPDATE privilegiado da origem da OS aguardou `Lock/transactionid` a aprovação, mas foi aceito após seu commit. Em rollback, role `authenticated` com JWT superadmin e RLS ativa também conseguiu alterar a ocorrência. O ensaio não identifica qual tela ou RPC realiza a alteração.
- Com 1036 e seu gate habilitado **somente no clone**, outra OS sintética foi classificada pela RPC 0402 em uma transação. Um UPDATE autenticado da origem aguardou `Lock/transactionid`; após commit da classificação, recebeu `os_com_retorno_origem_imutavel` (23514).
- Na ordem inversa, fixture `E01-S168_origem_inversa_fixture.sql` criou outra OS sem retorno. UPDATE autenticado removeu sua ocorrência e ficou pendente; a RPC 0402 aguardou `Lock/transactionid`. Após commit do UPDATE, a classificação recusou `vinculo_ocorrencia_nao_comprovado` (23514), sem criar retorno. Outros produtores e fontes de origem não foram ensaiados.

O clone foi removido. As provas são locais e parciais; não demonstram integração real, acesso Auvo, imutabilidade de todas as fontes ou homologação. Gates reais não foram abertos.

## Identidade externa e Cliente

Em novo clone sintético `sso_s168_identidade_race`, com 1036 ampliada e gate ligado somente ali, a classificação 0402 manteve a OS `...0074` em transação aberta. Duas sessões autenticadas tentaram alterar `auvo_task_id` e `client_id`; aguardaram `Lock/transactionid` e `Lock/tuple` e, após commit da classificação, ambas receberam `os_com_retorno_origem_imutavel`. A OS manteve Cliente original, task ID 168910004 e um retorno. A ordem inversa para esses dois campos não foi testada. A criação do Cliente sintético gerou uma intenção local de sincronização; não havia cron nem schema net e o clone foi removido sem despachá-la.

## Sistema e Equipamento

No clone sintético `sso_s168_alvo_race`, a 1036 ampliada foi habilitada somente ali. Com classificação em andamento, alterações autenticadas de `sistema_id` e `equipamento_id` aguardaram os locks; após commit, ambas foram recusadas com `os_com_retorno_origem_imutavel`. Na ordem inversa, uma OS sem retorno recebeu Sistema e Equipamento em transação não confirmada; a classificação aguardou e foi aceita após commit. A RPC classifica pela origem e Rotina versionada e não compara os dois campos da OS com o alvo da Rotina. Este ensaio não determina se a combinação anterior à classificação é válida no negócio e não comprova consistência de alvo; a decisão exige investigação antes de rollout. O clone foi removido.
