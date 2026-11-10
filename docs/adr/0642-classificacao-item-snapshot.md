---
name: "docs-adr-0642-classificacao-item-snapshot-md"
description: "Documento Sinérgica SO: ADR-0642 — Classificação explícita de linha existente"
alwaysApply: false
---

# ADR-0642 — Classificação explícita de linha existente

Snapshots publicados de 0526 são imutáveis e seu formato validado não permite novos campos. Portanto a classificação é anexo interno imutável, identificado por proposta, versão e linha, com tipo serviço/material declarado pelo Comercial e revisão independente pelo PCM. Preserva snapshots, versões e preços; não altera o conteúdo mostrado ao Cliente nem afirma que ele aceitou essa classificação posteriormente.

Essa revisão não prova execução, exclusividade ou autorização de faturamento. Mudanças de classificação exigem uma nova versão/procedimento futuro; o registro não é restaurado ou sobrescrito. Gate fechado, sem concessões. Revisar alçadas, decisão sobre aceitação do Cliente, locks e migrações, testar concorrência e compatibilidade antes de ativar.
