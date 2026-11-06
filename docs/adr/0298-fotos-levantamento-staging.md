---
name: "docs-adr-0298-fotos-levantamento-staging-md"
description: "Documento Sinérgica SO: ADR-0298 — Fotos privadas de levantamento"
alwaysApply: false
---

# ADR-0298 — Fotos privadas de levantamento

Prepara-se bucket privado e vínculo auditado de objeto próprio a uma linha de levantamento do mesmo Cliente, sem incorporar foto a cadastro oficial. O caminho de upload contém somente Cliente, lote e identificador aleatório; não inclui dados textuais da linha. Leituras, alterações e exclusões diretas no bucket são bloqueadas. A resolução de leitura verifica autorização vigente e bucket privado.

Gate e execução permanecem fechados. O fluxo exige endpoint mediador autenticado, controles de conteúdo, limitação de taxa, revisão de metadados/malware, testes de Storage e tratamento de uploads órfãos antes de ativação. Não se supõe que MIME declarado prove conteúdo seguro.
