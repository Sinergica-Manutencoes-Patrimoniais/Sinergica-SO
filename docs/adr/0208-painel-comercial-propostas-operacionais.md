---
name: "docs-adr-0208-painel-comercial-propostas-operacionais-md"
description: "Documento Sinérgica SO: ADR-0208 — Painel Comercial de propostas operacionais"
alwaysApply: false
---

# ADR-0208 — Painel Comercial de propostas operacionais

**Estado:** preparação fechada, sem homologação nem implantação.

O dashboard Comercial recebe consulta paginada de propostas operacionais, incluindo origem sem oportunidade somente quando o gate correspondente permitir. Cada linha deriva Cliente de OS e lista coerentes; quando existe oportunidade, sua Conta deve coincidir. Consulta verifica usuário ativo, acesso atual ao Comercial e nova capacidade de leitura por Cliente. Capacidade nasce sem concessões automáticas. A projeção expõe somente IDs, nome da Conta, número de OS, situação, versão, data e presença de oportunidade; não expõe custo, margem, itens internos, preço, documento ou comprovante.

Gate próprio e RPC ficam fechados, interface atrás de flag. Não muda, cria, envia ou publica proposta. Antes de ativar: conceder capacidade de forma revisada, verificar escopo por Conta e revogação, paginação, concorrência e consistência da origem, volume, fuga de dados, testes integrados e revisão adversarial. Outras telas e relatórios legados não passam a incluir origem operacional automaticamente.
