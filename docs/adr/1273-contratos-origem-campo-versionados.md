# ADR-1273 — Contratos versionados de origem de campo

Status: proposta local; não aplicada nem homologada.

O mapeamento da tarefa deve ser lido de registro privado versionado, nunca fornecido por evento ou usuário do processamento. Cadastro administrativo cria versão desabilitada e imutável, com motivo e referência de evidência declarada. Habilitar ou desabilitar exige operação administrativa separada e auditada; declaração humana não comprova contrato de integração por si só. Payload e contrato são lidos pelo serviço com ambos os gates fechados por padrão.

O contrato contém somente nomes de campos, estados e fuso; nenhum segredo. A decisão de habilitação não autoriza deploy, envio Auvo, processamento automático ou conclusão PCM. Antes da liberação validar evidências do fornecedor, exclusividade e origem da projeção, concorrência com alteração de contrato e gates, permissão e revogação, RLS/FORCE, payload sensível, rate limit, rollback e revisão adversarial. O registro administrativo e suas concessões também permanecem bloqueados.
