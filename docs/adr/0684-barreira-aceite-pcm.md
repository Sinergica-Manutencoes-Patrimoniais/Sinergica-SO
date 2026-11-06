---
name: "docs-adr-0684-barreira-aceite-pcm-md"
description: "Documento Sinérgica SO: ADR-0684 — Barreira de distinção do aceite PCM"
alwaysApply: false
---

# ADR-0684 — Barreira de distinção do aceite PCM

Auditoria estática encontrou consumidores que tratam `propostas.status='aceita'` como aprovação suficiente: modo de faturamento (0539/0542), vínculos de materiais (0523/0535), candidato por linha (0545), complementos (0791/0793/0795) e projeções públicas (0576). Parte exige comando de Portal, mas não todos. Logo, o comando PCM 0908 não pode alterar status canônico sem permitir que outro fluxo confunda decisão PCM com aceite direto do Cliente.

Até existir origem de decisão canônica e todos os consumidores verificarem explicitamente a autoridade e evidência exigidas, o wrapper 0909 bloqueia toda decisão PCM 0908, mesmo se o gate for habilitado. A implementação anterior é privada e revogada; aceites legítimos pelo Portal não são alterados. Não se afirma que esta lista esgota todos os consumidores: revisar triggers, funções e interfaces após alterações concorrentes. Tests, autorização, migrações e revisão adversarial são obrigatórios antes de remover a barreira.
