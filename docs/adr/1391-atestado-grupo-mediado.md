---
name: "docs-adr-1391-atestado-grupo-mediado-md"
description: "Documento Sinérgica SO: ADR-1391 — Atestado declarado de Grupo mediado"
alwaysApply: false
---

# ADR-1391 — Atestado declarado de Grupo mediado

A entrada autenticada de escrita exige `execucao.validar`, READ COMMITTED, autorização coordenada e gate próprio desligado. O núcleo idempotente permanece privado. A interface utiliza a leitura mediada do ADR-1390 e preserva a tentativa até confirmar o resultado e a sessão. O atestado é declaração humana; não autentica evidência nem comprova execução, encerramento ou tarefa Auvo.

Antes de habilitar: aplicar migrations coordenadas, testar ACL/RLS/FORCE, sessão, revogação, concorrência, replay, supressão de Visita e executar revisão adversarial.
