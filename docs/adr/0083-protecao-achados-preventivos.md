---
name: "docs-adr-0083-protecao-achados-preventivos-md"
description: "Documento Sinérgica SO: ADR-0083 — Proteção faseada dos achados preventivos"
alwaysApply: false
---

# ADR-0083 — Proteção faseada dos achados preventivos

## Decisão

Enquanto o fluxo novo permanece bloqueado, gravações legadas de achados exigem que a avaliação e a Ocorrência associada pertençam à origem legada, inclusive para `service_role`. Em alterações de vínculo verificar origem anterior e nova, para impedir reclassificação de registros. O mesmo princípio é aplicado à guarda de avaliações do ADR-0082. As linhas referenciadas são bloqueadas durante a verificação; vínculos inexistentes continuam sujeitos às foreign keys.

A proteção não valida autorização por Cliente, não cobre efeitos externos anteriores à gravação nem substitui segregação das Edge Functions. A futura origem terá comando próprio e exigirá alteração deliberada da guarda e testes adversariais. Avaliar ordenação de locks, deadlocks e custo de importação antes de rollout. Aplicar após 0304 e 0306; recuo só é seguro enquanto origem nova continuar bloqueada.
