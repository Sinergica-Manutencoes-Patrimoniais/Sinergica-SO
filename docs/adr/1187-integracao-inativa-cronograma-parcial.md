---
name: "docs-adr-1187-integracao-inativa-cronograma-parcial-md"
description: "Documento Sinérgica SO: ADR-1187 — Integração inativa do cronograma parcial"
alwaysApply: false
---

# ADR-1187 — Integração inativa do cronograma parcial

Status: proposta local; não homologada.

Substitui apenas a restrição temporal de ligação da interface na ADR-0888: a tela pode ser preparada antes dos testes, por solicitação de desenvolvimento em lote, desde que a opção específica permaneça desligada e os gates de banco continuem fechados. A habilitação continua proibida até testes integrados, revisão de autorização, consistência e revisão adversarial.

No detalhe do Plano, somente versão aprovada e disponível pode montar o componente; o contexto inclui usuário, Cliente, Plano e versão. A exportação permanece expressamente parcial, com cobertura desconhecida, sem afirmar execução, capacidade ou feriados oficiais. Mudança de contexto desmonta o componente e cancela a entrega local; não prova cancelamento do processamento nem autorização transacional.

Antes de habilitar: validar isolamentos, revogações, concorrência, fontes legadas, paginação, acesso e geração de PDF/XLSX. Reversão: desligar flag e manter gates de banco fechados; não alterar dados ou habilitar chamadas externas.
