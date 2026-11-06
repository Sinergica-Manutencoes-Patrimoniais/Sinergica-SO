---
name: "docs-adr-0908-atestado-matriz-xlsx-md"
description: "Documento Sinérgica SO: ADR-0908 — Atestado da matriz derivada do XLSX"
alwaysApply: false
---

# ADR-0908 — Atestado da matriz derivada do XLSX

Data: 2026-10-30 · Status: preparação, não implantado.

## Decisão

Preparar atestado HMAC-SHA-256 produzido exclusivamente pelo processamento confiável. A mensagem versionada vincula identificadores de ator, Cliente, pedido e lote, fonte codificada em UTF-8 hexadecimal, hash do XLSX, hash dos bytes UTF-8 da matriz JSON e expiração Unix. Campos são separados por LF e não terminam em LF. A chave é específica desta finalidade e não é enviada ao navegador nem registrada em logs. A função de assinatura é preparação isolada: não autentica usuário nem permite gravação.

## Antes de ativar

Implementar verificador no banco com segredo protegido e rotação, validar assinatura e expiração, recalcular ambos os hashes, exigir `auth.uid()` igual ao ator e revalidar capacidade por Cliente na transação. Tratar idempotência, replay, limites e locks; provar interoperabilidade binária, concorrência e falhas em banco real. Seguir ADR-0905 e manter RPC direta revogada e gates fechados. HMAC não comprova que o conteúdo foi corretamente extraído caso a própria fronteira assinadora seja comprometida. Sem deploy nem envio Auvo.
