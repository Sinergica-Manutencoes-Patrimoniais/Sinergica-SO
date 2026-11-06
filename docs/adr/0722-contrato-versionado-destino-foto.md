---
name: "docs-adr-0722-contrato-versionado-destino-foto-md"
description: "Documento Sinérgica SO: ADR 0722 — Contrato versionado para destino de foto"
alwaysApply: false
---

# ADR 0722 — Contrato versionado para destino de foto

## Decisão

O mediador original volta ao contrato JSON da migration 0944; a projeção com situação atual da 0946 fica disponível em função `v2` independente. Ambas preservam gate e autorização de Cliente. A interface nova usa apenas v2 e falha fechada se o banco ainda não a disponibilizar: não interpreta ausência dos campos como elegibilidade.

Aplicar migrations antes de publicar a interface; consumidores antigos continuam com o contrato original após 0947. Não há compatibilidade retroativa durante eventual intervalo entre aplicação isolada de 0946 e 0947; executar a sequência de migrations como implantação coordenada. Não há alteração dos vínculos, tentativas ou gates. Testes integrados e revisão permanecem necessários.
