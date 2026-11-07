---
name: "docs-adr-0905-processamento-xlsx-servidor-md"
description: "Documento Sinérgica SO: ADR-0905 — Preparação do processamento XLSX no servidor"
alwaysApply: false
---

# ADR-0905 — Preparação do processamento XLSX no servidor

Data: 2026-10-30 · Status: preparação; sem endpoint ou rollout.

## Decisão

A futura recepção deve derivar matriz e digest dos mesmos bytes recebidos pelo servidor, não confiar na matriz apresentada pelo navegador. Reutilizar o extrator limitado e os leitores OOXML, passando parser XML estrito por chamada. Fórmulas e erros não viram valores operacionais; campos necessários com fórmulas bloqueiam a matriz. A função de preparação não grava, não autoriza e não aprova dados.

## Limites e implantação

O experimento Deno usa dependências fixadas, sem parser global. Executar leitura não equivale a autenticar ou persistir: para operação faltam isolamento com limite real de tempo e memória, autenticação anterior à leitura, restrição de corpo e concorrência, vínculo transacional da matriz obtida à origem, impedimento de desvio por RPC direta e revisão adversarial. Manter gates existentes fechados; não alterar fluxos CSV. Rollback: não ativar futuro endpoint, preservar dados existentes.
