# ADR-0210 — Observações imutáveis de exceção de materiais

## Decisão

Preparar registro e consulta paginada de observações explícitas ligadas a um evento real de exceção, com capacidade atual por Cliente, revisão da lista, retry e auditoria. A observação não muda estado da exceção ou da OS e não declara solução, disponibilidade física, compra ou faturamento. Gate fechado, funções revogadas.

## Limites

Não implementa fechamento ou resolução de exceções: a spec não define sua condição técnica. Anexos seguem política própria e integração com campo depende de contrato confiável. Validar concorrência, autorização e retenção antes de ativação. Sem teste/aplicação.
