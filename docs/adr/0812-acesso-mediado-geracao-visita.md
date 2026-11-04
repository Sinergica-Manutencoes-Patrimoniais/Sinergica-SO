# ADR 0812 — Acesso mediado à geração contratual de Visita

Status: preparado, sem homologação ou ativação.

A jornada já utiliza as regras e o gerador contratual da ADR 0467, mas ambos os núcleos permanecem privados e a interface não consegue executá-los. Uma fronteira mediada própria, desligada por padrão, expõe listagem e geração somente a `authenticated`, exigindo as duas concessões atuais `plano.gerir` e `visita.confirmar` no Cliente informado. Os núcleos e as tabelas continuam privados; os gates e validações existentes continuam obrigatórios. A geração delega ao comando original, preservando requestId, origem comprovada, supressão de feriado declarado e auditoria transacional.

A listagem privada é substituída sem alteração de ACL para qualificar a coluna do gate: `id` também é coluna de saída e, sem qualificação, causava erro de referência ambígua ao ser executada.

Não se afirma cobertura oficial de feriados, reconciliação automática, segurança sob revogação concorrente ou cobertura de escritores legados. A ativação depende de inventário/reconciliação, revisão adversarial, ensaios concorrentes, validação da dupla concessão e homologação de toda a cadeia. Nenhuma OS ou tarefa Auvo é criada pelo contrato original. Não ativar este gate ou os existentes por esta migration.
