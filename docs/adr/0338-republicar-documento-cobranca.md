# ADR-0338 — Republicação de vínculo de documento

Status: proposta; gates fechados, sem testes.

Após retirada, Financeiro pode criar novo vínculo da mesma cobrança e anexo aprovado; o anterior permanece histórico. Índice parcial garante um vínculo ativo por par, e comando idempotente associa UUID do pedido, ator e dados ao resultado: retry nunca restaura ou recria vínculo retirado. Publicação e retirada serializam por par de identificadores. A retirada do vínculo não retira a publicação independente da OS. Testes de concorrência, autorização, conteúdo e revogação são obrigatórios antes de ativar.
