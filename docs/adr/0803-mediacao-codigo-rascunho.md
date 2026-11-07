---
name: "docs-adr-0803-mediacao-codigo-rascunho-md"
description: "Documento Sinérgica SO: ADR 0803 — Mediação da edição de código de rascunho"
alwaysApply: false
---

# ADR 0803 — Mediação da edição de código de rascunho

A interface chamava funções privadas sem privilégio. A mediação aditiva expõe somente consulta e comando próprios, subordinados a gate novo desligado e à autorização atual `cadastro.gerir` do Cliente do ciclo. O comando requer também gates de rascunho, supressão de sync e observação de marcos; usa o wrapper 0995, com READ COMMITTED, e preserva revisão, replay, unicidade e auditoria do núcleo. Nenhuma concessão direta é adicionada ao núcleo ou ao wrapper privado.

Não habilitar: a prova de etiquetagem real e a cobertura concorrente de todos os escritores ainda estão incompletas. O gate dos marcos deve permanecer ligado enquanto esta mediação estiver em uso, e seu desligamento precisa ser coordenado com sessões em curso antes de eventual implantação. Não há sincronização Auvo por esta operação.

Reversão: desligar gate mediador; preservar função, comandos e histórico. A habilitação depende de revisão adversarial e homologação integrada.
