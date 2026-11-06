---
name: "docs-adr-0167-composicao-decisao-sem-oportunidade-md"
description: "Documento Sinérgica SO: ADR-0167 — Composição e decisão de origem operacional"
alwaysApply: false
---

# ADR-0167 — Composição e decisão de origem operacional

**Estado:** proposta preparatória; comandos revogados e gate de origem desligado.

A composição usa o Cliente da lista/OS vinculada quando a proposta não possui oportunidade; propostas legadas continuam usando a oportunidade. A consulta no Portal usa a mesma origem para verificar a Conta e aplica a projeção pública já existente, sem custos. A decisão versionada da origem operacional registra decisão no Comercial e altera somente o estado da proposta, sem tentar movimentar funil inexistente, criar OS ou gerar cobrança. As decisões de propostas com oportunidade continuam delegadas ao comando legado.

O gate permanece fechado. Antes de abrir: validar corridas e ordem de locks, vínculo e revogação de contatos, exclusividade de propostas, integridade inversa de OS/lista, efeitos de triggers legados, versão e autoria na decisão, duplicação idempotente, projeções sem custo, compatibilidade de contratos e relatórios, revisão adversarial e testes reais em ambiente isolado. As demais rotas legadas de decisão e o modelo de contrato continuam sem suporte à origem sem oportunidade. Não habilitar parcialmente.
