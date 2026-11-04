# ADR-1252 — Incorporação individual de Grupo com código

**Status:** proposta local, não homologada. Complementa ADR-1244/1251.

Preparar alteração aditiva do núcleo privado de incorporação existente para aceitar código de Grupo somente com gate específico aberto. O Grupo e seu código são criados na mesma transação, reaproveitando validação de Cliente, linha, revisão, autorização, duplicidade, código e auditoria; uma falha desfaz ambos. O código informado pela origem ou conferido no staging não pode ser descartado silenciosamente. A via sem código e os demais tipos preservam o contrato anterior.

Não abrir gate nem disponibilizar UI até validar a definição efetiva do núcleo após todas migrations, reserva/colisão com todos os escritores, ordenação de locks, autorização/revogação, replay, falha parcial, lote e RLS/FORCE, mais revisão adversarial. A criação de vários Grupos em lote continua bloqueada para códigos; não presumir cobertura dessa via. Não dispara Auvo.
