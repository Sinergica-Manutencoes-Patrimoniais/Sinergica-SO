# Ensaio isolado S170 — preparação incompleta

`fixture.py` e `capacidades-sso.spec.ts` são preparações; não constituem um ensaio executável nem evidência de aprovação. Ainda falta conectar app e navegador ao banco, Auth e API do mesmo clone descartável, com rede interna e limpeza em caso de falha. Nenhuma credencial deve ser gerada até essa identidade e o isolamento serem verificados pelo bootstrap.

O teste usa exclusivamente a configuração `playwright.s170-isolado.config.ts`; não usar a configuração Playwright padrão nem arquivos de ambiente locais. A URL de retorno deve abrir a aplicação sintética; a seleção do Cliente e da aba ocorre pela interface. O histórico apresentado não comprova imutabilidade no banco ou concorrência.

Antes da execução, o bootstrap deve comprovar que o proxy local do navegador encaminha somente aos serviços do clone, sem portas publicadas, cron ou acesso externo, configurar as flags e gates necessários apenas no clone e destruir todos os recursos próprios em `finally`. O teste e os seletores ainda não foram executados. Não utilizar dados reais nem acionar o Auvo.

O cenário de retorno requer clone próprio, separado da jornada AC5, pois ambas usam a mesma identidade sintética e esta última modifica o retorno. A verificação de `plano.gerir` nos Clientes A e B foi preparada no pgTAP, com papel e claims sintéticos, sem chamar `config` pelo PostgREST; ainda não foi executada. Não expor `config` no PostgREST para viabilizar o teste. Até essa substituição e a conexão do bootstrap, não criar workflow que apresente este roteiro como pronto.
