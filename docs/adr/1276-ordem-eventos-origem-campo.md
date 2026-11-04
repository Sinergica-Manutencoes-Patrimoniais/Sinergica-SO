# ADR-1276 — Ordem de eventos de origem de campo

Status: proposta local; não aplicada nem homologada.

Uma tarefa pode ser entregue por webhook e polling em ordens diferentes. Preparar histórico append-only com sequência externa explícita e monotônica, prevista em contrato versionado. Um evento inicial sem sequência confiável permanece pendente; não usar data de recebimento como substituto. Mesmo número e mesma projeção é repetição; mesmo número com conteúdo diferente é conflito. Eventos anteriores ficam registrados como atrasados, sem sobrescrever o atual. Estado posterior que aparentemente regride execução é registrado como conflito, não aplicado silenciosamente.

A operação somente registra estado de campo e evidência normalizada; não fecha OS, altera dados corrigidos pelo PCM, importa fotos ou encerra Chamado. Atualização dos dados oficiais, reabertura justificada e sincronização com validação PCM continuam dependências próprias. Antes de habilitar, comprovar que a sequência do fornecedor é realmente monotônica e estável para cada tarefa, validar concorrência, transições, privacidade, RLS/FORCE e revisão adversarial. Gates permanecem fechados.
