# ADR-0135 — Declaração explícita de repasse de despesa

**Estado:** proposta preparatória, sem homologação ou implantação.

A despesa de Visita registra realizado, mas não possui decisão contratual de repasse. Realizado não é elegibilidade. Para preparar E01-S182, uma pessoa autorizada tanto a gerir a despesa quanto a efetivar faturáveis pode declarar explicitamente, com referência à regra contratual e justificativa, que a despesa realizada é repassável. O comando servidor lê Cliente, Visita, valor e revisão da origem, trava a origem, rejeita revisão obsoleta e grava declaração e item pendente na mesma transação. A competência é informada explicitamente, não inferida da data da despesa. Nenhum recebível, cobrança ou documento é criado.

A identidade da origem é a despesa individual; a unicidade preexistente impede outra base para a mesma despesa. Repetição idêntica retorna resultado prévio; declaração divergente exige tratamento explícito e não sobrescreve o item. A declaração preserva valor, revisão, responsável, justificativa e referência contratual; não comprova que a referência existe ou que cobre o valor, exigindo revisão humana posterior. Não resolve despesas parciais/rateadas, fornecimento de materiais, parcelas de serviço ou demais origens.

O comando permanece revogado para papéis da aplicação e não pode ser ativado até revisão de competências, permissões efetivas e segregação de funções, regras de repasse, mudanças posteriores na origem, RLS/FORCE, auditoria, concorrência, testes e reconciliação dos demais caminhos. A implementação não substitui a integração PCM/Financeiro por outbox prevista no ADR-0027, que permanece requisito antes de produção.
