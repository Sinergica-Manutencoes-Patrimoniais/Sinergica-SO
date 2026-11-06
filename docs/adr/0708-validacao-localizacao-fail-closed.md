# ADR-0708 — Validação obrigatória ao incorporar Localização

A validação da ADR-0604 torna-se obrigatória para novas incorporações ou atualizações de Área, Local e Sublocal originadas em levantamento. Se o gate de validação estiver desligado, a inserção do fato de incorporação/atualização falha e a transação reverte integralmente. Os atributos em staging e o histórico permanecem intactos; a operação não é silenciosamente parcial.

A guarda continua restrita aos fatos de levantamento e não altera cadastros legados fora dessa trilha. Repetições já registradas seguem pelo resultado idempotente antes de tentar nova inserção, desde que os gates e a autorização da chamada continuem válidos. Ativação exige revisão de segurança e testes de concorrência, reprocessamento e preservação de atributos.
