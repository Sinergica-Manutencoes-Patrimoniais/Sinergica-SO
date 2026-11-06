---
name: "docs-adr-0953-processamento-servidor-xlsx-estrutura-md"
description: "Documento Sinérgica SO: ADR-0953 — Processamento de estrutura XLSX no servidor"
alwaysApply: false
---

# ADR-0953 — Processamento de estrutura XLSX no servidor

Status: preparação isolada; sem endpoint, persistência ou autorização operacional.

## Decisão

Preparar processamento em worker no servidor a partir de uma cópia única dos bytes, reutilizando extração limitada e as regras de conferência da estrutura. A aba deve ser visível e escolhida explicitamente; digest, nome da aba e diagnóstico são derivados da mesma cópia. O chamador encerra worker em cancelamento ou prazo. Não aceitar matriz enviada pelo navegador como prova da origem e não gravar na estrutura oficial.

## Limites

O resultado é apenas diagnóstico, não prova autenticada de proveniência nem lote recebido. O hash não é assinatura. Faltam fronteira HTTP autenticada, controles de recursos e concorrência, atestado verificável por transação de staging, reconciliação idempotente e tratamento de linhas rejeitadas. Imports compartilhados, suporte a worker/ZIP no runtime e limites de memória/CPU exigem ensaio real e revisão adversarial; não conectar a arquivos de usuários ou criar rota até essas provas. Nenhuma capacidade ou gate é concedido.
