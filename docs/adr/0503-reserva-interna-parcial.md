---
name: "docs-adr-0503-reserva-interna-parcial-md"
description: "Documento Sinérgica SO: ADR-0503 — reserva interna parcial de faturável"
alwaysApply: false
---

# ADR-0503 — reserva interna parcial de faturável

Status: proposto; gates fechados, não aplicado nem homologado. O AC-4 exige faturamento parcial e parcelas identificáveis, mas não determina obrigatoriedade de vários candidatos em um único documento. Esta fatia prepara documento interno com valor parcial positivo escolhido pelo operador, limitado pelo saldo oficial revalidado, preservando origem, revisão, idempotência e proibição de cobrança externa. Conversão mantém o comando canônico existente.

Limitação importante: a tabela 0720 ainda admite apenas um documento interno por item, inclusive depois de liberado ou convertido. Portanto esta fatia **não implementa o ciclo completo de múltiplas parcelas**, nem distribuição de vários itens em um documento. Resolver isso exige identidade de parcela, liberação histórica e proteção global de saldo coordenada entre todos os escritores; não ativar o gate até implementação, revisão financeira adversarial e testes de concorrência. Não é emissão fiscal nem pagamento.
