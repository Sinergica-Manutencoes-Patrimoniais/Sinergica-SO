---
name: "docs-adr-0916-entrada-local-xlsx-md"
description: "Documento Sinérgica SO: ADR-0916 — Entrada local da função XLSX, fechada por padrão"
alwaysApply: false
---

# ADR-0916 — Entrada local da função XLSX, fechada por padrão

Data: 2026-10-30 · Status: preparação, não publicada. Substitui apenas a restrição de não criar o ponto de entrada em código do ADR-0910; não altera seus gates operacionais.

Criar a função no repositório com JWT obrigatório e bloqueio adicional por `SSO_XLSX_RECEPCAO_ENABLED`, que só aceita `true` explícito. Sem URL, chave pública, credencial de serviço, origens permitidas e segredo de atestado válidos, a função permanece indisponível. A chave de atestado é lida apenas no servidor e deve corresponder ao Vault. Nenhum segredo é criado no repositório. O limitador é a única utilização da credencial de serviço; a operação usa JWT do usuário e gate transacional.

A entrada no `supabase/config.toml` é necessária ao projeto e pode causar deploy automático em futuro merge pela integração GitHub. Este trabalho **não autoriza merge nem deploy**; o gate continua fechado e qualquer publicação depende de decisão e revisão explícitas. Testar a função com Edge Runtime, Auth/RLS, Vault, rate limit e concorrência reais, além de revisão adversarial. Rollback: manter a flag ausente e não publicar; não apagar dados ou segredos.
