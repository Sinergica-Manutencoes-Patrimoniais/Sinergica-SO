---
name: "docs-adr-0131-demanda-capacidade-fontes-oficiais-md"
description: "Documento Sinérgica SO: ADR-0131 — Projeção de demanda de capacidade pelas fontes oficiais"
alwaysApply: false
---

# ADR-0131 — Projeção de demanda de capacidade pelas fontes oficiais

**Estado:** proposta não aplicada nem homologada. Complementa ADR-0113.

## Decisão

Preparar leitura paginada a partir de vínculos vigentes Visita–OS, com Cliente e semana no fuso da Visita. A projeção inclui identificadores de OS, ocorrência vinculada, versão preparada quando existir, estimativa de minutos da OS, quantidade de participantes e deslocamento da Visita. Cada OS aparece no máximo uma vez pelo vínculo vigente; a ocorrência é referência, não segunda linha de demanda. Não somar deslocamento em cada OS.

As estimativas são apresentadas como dados de origem, não como esforço restante ou HH calculado: não há garantia registrada de unidade, distribuição por técnico, natureza interna/terceirizada, execução parcial ou correspondência integral com o escopo. O campo de completude permanece `desconhecida`. A ausência de vínculo entre ocorrência e OS ou outras demandas fora da Visita impede chamar o conjunto de demanda consolidada.

## Segurança e limites

A leitura exige autorização de capacidade por Cliente, gate próprio fechado e execução revogada. Não publicar como saldo real nem usar para decidir disponibilidade. Ainda faltam fontes canônicas de trabalho restante, especialidades, simultaneidade, reservas/ausências em intervalos e de deslocamento por equipe, projeção de ocorrências sem OS, deduplicação comprovada entre versões e integração da tela. Verificar concorrência, timezone, RLS e escala antes de ativar. Reversão antes de exposição: revogar e remover função/gate após conferir dependências, sem apagar dados operacionais.
