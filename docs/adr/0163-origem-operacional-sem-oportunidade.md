---
name: "docs-adr-0163-origem-operacional-sem-oportunidade-md"
description: "Documento Sinérgica SO: ADR-0163 — Origem operacional sem oportunidade fictícia"
alwaysApply: false
---

# ADR-0163 — Origem operacional sem oportunidade fictícia

**Estado:** preparação bloqueada, não homologada nem implantada.

Propostas continuam no cadastro canônico Comercial. Uma proposta operacional poderá não ter oportunidade quando sua origem oficial for uma OS e lista do mesmo Cliente; propostas comerciais legadas continuam vinculadas à oportunidade existente. Não criar oportunidade artificial. A alteração de nulabilidade vem acompanhada de gate privado inicialmente fechado e constraint trigger adiada que exige origem íntegra no commit. O novo comando insere proposta, snapshot inicial e vínculo numa transação, com revisão da lista e idempotência; não envia nem gera cobrança.

A habilitação continua proibida: os consumidores legados presumem oportunidade obrigatória. A consulta operacional precisa resolver Cliente pela origem; composição, decisão, projeção pública, emissão, contratos, RLS, exportações e integrações precisam da mesma transição e não podem converter silenciosamente dados legados. Com gate fechado não devem existir propostas sem oportunidade; a reversão de nulabilidade só é segura após prova de ausência de tais propostas. Antes de liberar, revisar edição e decisão, políticas de segurança e concorrência, integridade dos vínculos históricos, clientes com múltiplas contas e executar testes integrados e revisão adversarial. Não ativar partes isoladamente.
