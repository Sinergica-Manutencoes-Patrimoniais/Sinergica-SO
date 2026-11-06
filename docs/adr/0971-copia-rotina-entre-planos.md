# ADR-0971 — Cópia identificada de Rotina entre Planos

Status: preparação privada; não homologada.

Uma Rotina da fotografia aprovada pode ser proposta como cópia em outro Plano em rascunho, inclusive de outro Cliente. Exigir capacidade atual de gestão nos dois Clientes, revisão observada de origem e destino, escolha explícita de alvo do mesmo tipo no Cliente de destino e novos IDs. Reutilizar o comando completo de cadastro existente para validar alvo ativo, questionário, auditoria e incremento de revisão; nenhuma execução é criada. A fonte aprovada não é alterada.

O recibo registra a origem, resumo da fotografia e vínculo com a nova Rotina, com repetição idêntica. A fotografia do questionário permanece na origem: o destino referencia o cadastro atual e exige conferência. Recorrência, data-base, tolerância e instrução são sugestões copiadas, não validação contratual ou normativa. Classificações e contratos auxiliares não são automaticamente confirmados. O comando não constitui biblioteca de modelos, publicação Auvo ou transferência de cadastros.

Gate e EXECUTE fechados. Antes de liberar: revisar ordem de locks com todos os escritores de Plano, RLS/FORCE e privilégio do proprietário, revogação, Cliente/contrato, proveniência e confidencialidade da fonte, identidade do questionário e referências legais, repetição e concorrência; executar testes integrados e revisão adversarial. Não aplicar em produção nem abrir gates sem rollout coordenado.

A consulta de procedência exige gestão do Cliente e vínculo no destino. Se a capacidade na origem não estiver disponível, informa apenas que existe uma cópia e que a origem está restrita, sem revelar os identificadores da origem. A consulta não registra nem comprova conferência; a revogação deve ser testada sob as mesmas travas das fontes de autorização.
