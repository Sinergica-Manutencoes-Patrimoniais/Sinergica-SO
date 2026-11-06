---
name: "docs-adr-0525-decisao-feriado-calendario-md"
description: "Documento Sinérgica SO: ADR-0525 — Registro PCM de feriado em ciclo por calendário"
alwaysApply: false
---

# ADR-0525 — Registro PCM de feriado em ciclo por calendário

Status: preparado, gate fechado, não aplicado nem homologado. O PCM pode registrar decisão de manter para tratamento uma ocorrência preparada cujo vencimento coincide com feriado geral ativo declarado do Cliente, com revisão, motivo e referência à revisão do feriado. Isso não confirma fonte oficial nem presume que a execução esteja pendente.

O comando não cancela, dispensa, reprograma ou altera estado, âncora, ocorrência, OS ou Auvo. Feriados de contrato não são aceitos sem vínculo contratual comprovado; a fonte é incompleta. Fila operacional, efeitos posteriores, testes e revisão adversarial seguem pendentes.
