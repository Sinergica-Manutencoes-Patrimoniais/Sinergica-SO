---
name: "docs-adr-0554-relatorio-alocacao-estorno-pagamento-md"
description: "Documento Sinérgica SO: ADR-0554 — alocação, estorno e lançamento por competência"
alwaysApply: false
---

# ADR-0554 — alocação, estorno e lançamento por competência

Status: proposto; não aplicado nem homologado. O relatório parte de alocações dos itens de Cliente e competência, apresenta total bruto e estornado separadamente e conta cada documento uma vez. O lançamento é considerado marcado como realizado com data de pagamento apenas quando os dois campos existem; isso é estado local, não confirmação bancária. O valor somado é o valor integral do lançamento por documento, podendo incluir outros itens e competências: não é valor pago atribuível ao recorte e não deve ser somado a alocações. Documentos/lançamentos indisponíveis permanecem desconhecidos. Segurança, competência e prevenção de dupla contagem exigem testes e revisão financeira.
