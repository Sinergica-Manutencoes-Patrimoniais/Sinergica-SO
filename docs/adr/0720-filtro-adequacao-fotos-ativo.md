---
name: "docs-adr-0720-filtro-adequacao-fotos-ativo-md"
description: "Documento Sinérgica SO: ADR 0720 — Adequação antes da paginação de fotos"
alwaysApply: false
---

# ADR 0720 — Adequação antes da paginação de fotos

## Decisão

A listagem temporária de fotos de Sistema ou Componente exclui fotos cuja decisão de adequação vigente seja `inadequada` antes da ordenação e do limite. Usa a mesma função de decisão do acesso mediado ao arquivo: ausência de decisão e `reavaliada` não são tratadas como inadequadas, sem afirmar segurança da imagem.

A consulta mantém os gates, a verificação de Cliente e de `cadastro.ler` ou `cadastro.gerir`, o cursor e os privilégios anteriores. A mediação 0943 permanece única entrada autenticada; a função interna continua revogada. A alteração não afeta armazenamento nem histórico. Testes e revisão são necessários antes da habilitação.
