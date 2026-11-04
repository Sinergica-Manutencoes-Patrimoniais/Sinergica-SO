# ADR-0733 — Bloqueio da proposta na ativação de contrato

**Status:** incremento em diagnóstico; não homologado nem implantado.

O teste em duas sessões com fixture sintética reproduziu que, durante ativação ainda não confirmada, outra transação consegue excluir logicamente a proposta. A ativação pode então concluir com origem desatualizada. A oportunidade já é bloqueada, mas a proposta era lida sem bloqueio.

## Decisão

Revalidar e bloquear a linha da proposta com `FOR SHARE` antes de criar o plano. A consulta privilegiada deve ler apenas o identificador da oportunidade, manter a checagem de usuário e módulo atuais e aplicar os mesmos predicados de proposta aceita e não excluída da projeção sem custos. Nenhum custo, piso ou composição é retornado ao usuário. A oportunidade continua bloqueada e validada antes de qualquer plano. A mudança não proíbe exclusão posterior à conclusão da ativação e não estabelece regras gerais sobre edição.

Preservar o contrato da função, ACL e dados. Testar com duas sessões, autorização e regressão do fluxo, com transações revertidas; verificar locks, deadlocks, concorrência entre edição/ativação e a consistência dos dados históricos. Concessões herdadas, owner, transações Financeiro e service role continuam sujeitos a revisão adversarial. Rollout e homologação dependem de CI/db-tests e reconciliação das migrations anteriores. Não apagar contratos ou planos na reversão.
