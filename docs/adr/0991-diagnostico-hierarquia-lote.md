---
name: "docs-adr-0991-diagnostico-hierarquia-lote-md"
description: "Documento Sinérgica SO: ADR-0991 — Diagnóstico de hierarquia do lote"
alwaysApply: false
---

# ADR-0991 — Diagnóstico de hierarquia do lote

Status: preparação privada, não homologada.

Preparar consulta paginada de linhas do lote para indicar referência de pai, tipo de pai presente no lote, ciclos e cadeias extensas, além de combinações de tipos incompatíveis conhecidas pelos incorporadores. Uma referência ausente no lote é sinalizada como indeterminada, pois pode representar cadastro externo a conferir; não supor sua existência nem incorporá-la. Retornar revisão do lote e recusar cursor com revisão diferente. A consulta não aprova ou altera dados.

Gate e EXECUTE fechados. Paginação não constitui fotografia transacional se houver escritores que não incrementam revisão; validar cobertura de escritores, revogação, RLS/FORCE, privacidade, limites e custo da recursão, tipos de pai, fontes oficiais e revisão adversarial antes de ativar. Sem aplicação em produção.
