# Ensaio isolado S170 — preparação incompleta

`fixture.py` e `capacidades-sso.spec.ts` são preparações; não constituem um ensaio executável nem evidência de aprovação. Ainda falta conectar app e navegador ao banco, Auth e API do mesmo clone descartável, com rede interna e limpeza em caso de falha. Nenhuma credencial deve ser gerada até essa identidade e o isolamento serem verificados pelo bootstrap.

O teste usa exclusivamente a configuração `playwright.s170-isolado.config.ts`; não usar a configuração Playwright padrão nem arquivos de ambiente locais. A URL de retorno deve abrir a aplicação sintética; a seleção do Cliente e da aba ocorre pela interface. O histórico apresentado não comprova imutabilidade no banco ou concorrência.

Antes da execução, o bootstrap deve comprovar que o proxy local do navegador encaminha somente aos serviços do clone, sem portas publicadas, cron ou acesso externo, configurar as flags e gates necessários apenas no clone e destruir todos os recursos próprios em `finally`. O teste e os seletores ainda não foram executados. Não utilizar dados reais nem acionar o Auvo.
