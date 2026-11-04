# S167 — três comandos de OS concorrentes

Em clone descartável de schema sem cron/net, com gates da criação e da mediação ligados apenas no clone, índice singular e trigger de número removidos apenas no clone e 1056 aplicada, a fixture `E01-S167_tripla_os_setup.sql` criou um Chamado sintético na revisão 1. O dump foi restaurado com `--no-acl`; grants de fixture foram concedidos explicitamente. Os testes não comprovam ACL de produção.

Uma sessão segurou `pcm.chamados` com `FOR UPDATE` enquanto três sessões `authenticated` iniciaram `E01-S167_tripla_os_comando.sql`, cada uma com `request_id`, `os_id` e título diferentes, todas com `revision=1`. Após liberar a linha, uma criou OS e retornou revisão 2; duas falharam com `40001 revisao_obsoleta`. Repetir o mesmo pedido obsoleto também falhou; uma nova tentativa, após revisão para 2 e novos IDs, criou outra OS e retornou revisão 3. Repetir essa nova tentativa retornou o mesmo resultado: duas OS, dois números e dois comandos no clone.

Resultado contradiz o teste independente de S167 que exige três comandos concorrentes distintos: o bloqueio otimista atual só aceita uma operação na revisão inicial. A correção de interface para revisão explícita melhora recuperação, mas não satisfaz criação concorrente automática e não deve ser tratada como solução do AC. Preservar conferência, autorização, requestId, histórico e detecção de alterações reais ao desenhar uma solução; não simplesmente ignorar revisão obsoleta.

Não foram testados browser/HTTP, efeitos Auvo, ACLs completas, integração com composição de escopo ou implantação. O clone deve ser removido após o ensaio; gate e índice na base principal permanecem inalterados.

## Ensaio após 1057

Em novo clone com as mesmas condições, migrations 1056 e 1057 e mesma barreira de linha, as três sessões com revisão 1 retornaram sucesso, com revisões resultantes 2, 3 e 4. Uma repetição idêntica devolveu o mesmo resultado; consulta após retry encontrou três OS, três IDs, três números, três títulos e três comandos. Depois, uma atualização concorrente do título do Chamado foi confirmada antes de outro pedido, que recusou `revisao_obsoleta`. Na base diagnóstica, 32 verificações transacionais passaram, incluindo revisão futura, trigger de revisão desligado, lacuna no histórico e alteração substantiva, todos rejeitados. Essas provas não demonstram todas as fontes de alteração, concorrência com mudança do escopo/OS, ACLs reais, HTTP ou rollout. A exceção restrita de revisão é `SPEC_DEVIATION` na ADR-0870 e aguarda reconciliação do contrato; não habilitar gates.
