---
name: "docs-adr-0954-atestado-recepcao-estrutura-xlsx-md"
description: "Documento Sinérgica SO: ADR-0954 — Atestado para recepção de estrutura XLSX"
alwaysApply: false
---

# ADR-0954 — Atestado para recepção de estrutura XLSX

Status: preparação privada, sem operação habilitada.

## Decisão

O serviço confiável processa cópia única do arquivo, vincula por HMAC versão, ator, Cliente, requestId, origem, aba, destino, SHA-256 dos bytes, SHA-256 do JSON e expiração. O banco valida assinatura, autorização atual, gates, limites e idempotência na transação. Os bytes são usados para validar digest, mas não são guardados; o recibo preserva digest e contexto sem alegar arquivamento do original. Nenhum cadastro oficial é alterado.

Se todas as linhas forem estruturalmente aptas, o caminho recebe lote manual com origem declarada planilha. Havendo rejeição, todas as linhas não vazias vão para quarentena existente, incluindo aptas e rejeitadas; nunca descartar silenciosamente linhas inválidas. As validações de vínculos, códigos e duplicidades oficiais seguem com o PCM. O atestado comprova somente que o serviço confiável assinou esses bytes e esse resultado, não que o arquivo represente a realidade.

## Limites

Segredo próprio versionado no Vault não é criado por migration. RPC e gate permanecem privados/fechados; sem endpoint ou concessão. Revisar limites, diferenças de serialização JSON, rotação do segredo, assinatura, identidade, RLS do definer, concorrência, replay, provenance e compatibilidade de ambas as funções legadas. É necessário implementar serviço de borda, autenticação e rate limit e comprovar segurança do worker/ZIP antes de receber arquivos reais. Não homologar, habilitar nem implantar sem testes integrados e revisão adversarial.
