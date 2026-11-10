---
name: "docs-adr-0233-historico-publico-orcamento-operacional-md"
description: "Documento Sinérgica SO: ADR-0233 — Histórico de versões públicas operacionais"
alwaysApply: false
---

# ADR-0233 — Histórico de versões públicas operacionais

**Estado:** proposta preparatória, sem homologação nem implantação.

O Portal pode consultar versões que tenham snapshot público explicitamente publicado, para propostas com ou sem oportunidade, sem acessar versões privadas. Cada solicitação confere contato ativo, Conta, OS e lista coerentes, proposta visível e gates. O histórico lista somente número e data da publicação; detalhe e PDF carregam a versão escolhida por consulta autorizada e projeção pública restrita. O cliente revalida a mesma versão antes do download local; não há URLs assinadas, publicação automática ou cobrança.

Somente snapshots explicitamente publicados no modelo novo são incluídos; versões legadas sem comprovação não são inferidas nem convertidas. Propostas canceladas ou indisponíveis não são retornadas. Gate de exportação e RPCs fechados. Antes de abrir, revisar revogação concorrente, exclusão/alteração de objetos e Conta, texto público, política de retenção e exposição de versões recusadas, permissão dos contatos, PDF, cache e testes integrados e revisão adversarial.
