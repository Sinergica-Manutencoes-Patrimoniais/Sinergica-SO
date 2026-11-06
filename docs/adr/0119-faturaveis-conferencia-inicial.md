# ADR-0119 — Fila A Faturar com conferência separada de cobrança

## Estado

Proposta para E01-S182, ainda sem homologação ou autorização de implantação.

## Decisão

Criar agregado no Financeiro para fato granular, não para OS genérica, com unicidade por Cliente/tipo/ID de origem. Modelo não gera recebíveis automaticamente e não permite substituir origem ou valor original. Cada conferência de item pendente registra valor final, motivo quando alterado, ator, revisão e evento de auditoria. Cancelamento somente antes de faturamento exige motivo. Comandos serializam request e item; repetição idêntica retorna o resultado anterior. Leituras são filtradas por Cliente e autorização efetiva.

A fundação preparada mantém EXECUTE revogado para papéis da aplicação. Nenhuma entrada será fabricada: publicação de origens depende de contratos de fornecimento, despesa e execução realmente elegíveis, ainda não comprovados. Efetivação, documentos, parcelas, complementos e estorno ficam fechados até integrar os lançamentos e o bloqueio transacional de competência existentes; não representam um item conferido como faturado.

## Gates

Antes de qualquer grant/aplicação: pgTAP com dois Clientes, permissões e revogação concorrente, requestId, integridade, concorrência sobre origem e transições, verificação de competência, integração com origens e lançamentos, RLS/segurança, CI e revisão adversarial. Retenção de payloads e o uso de memória/sessão na interface dependem de revisão de privacidade.
