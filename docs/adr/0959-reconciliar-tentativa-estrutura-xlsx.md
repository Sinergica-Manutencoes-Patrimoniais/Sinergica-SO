---
name: "docs-adr-0959-reconciliar-tentativa-estrutura-xlsx-md"
description: "Documento Sinérgica SO: ADR-0959 — Reconciliação explícita de tentativa XLSX de estrutura"
alwaysApply: false
---

# ADR-0959 — Reconciliação explícita de tentativa XLSX de estrutura

Status: preparação desconectada; não homologada.

Quando outro dispositivo confirmar a mesma origem antes de uma tentativa local, uma ação separada consulta o recibo sob autorização e Web Lock, compara Cliente, ator, origem, aba e SHA-256 e substitui a identidade local apenas se corresponder exatamente. Os requestIds anteriores ficam no registro local até a tentativa reconciliada ser confirmada. A ação não transmite o arquivo, não aprova o lote e não apaga tentativas sem prova; resultado ausente, divergente ou ambíguo bloqueia.

A compatibilidade de conteúdo além do hash, origem de recibos legados, alterações posteriores e retenção dos IDs exigem testes integrados. O armazenamento não é auditoria permanente; não prova concorrência entre dispositivos ou integridade de um lote alterado. Não conectar antes da validação da recepção e revisão adversarial.
