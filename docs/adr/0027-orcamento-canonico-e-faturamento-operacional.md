# ADR-0027 — Orçamento canônico, despesas e faturáveis

**Status:** Proposta técnica especificada. **Data:** 2026-10-26.

## Decisão e motivo

Evoluir comercial.propostas/proposta_versoes para orçamento operacional originado em OS/lista de materiais. Não criar comercial.orcamentos_operacionais como terceiro modelo. pcm.orcamentos_servico permanece legado com ponte identificada e decisão compatível sem criar outra OS quando a origem já existe. financeiro.orcamentos é orçamento gerencial, não cotação ao cliente.

Material fornecido é venda; despesa é gasto da Visita, registrado PCM, com rateio opcional OS. Materiais não entram como despesas da Visita. Retirada exclusiva de compra pertence à formação do preço de aquisição. Custos internos, markup e margem ficam restritos no banco, respostas e PDFs; Portal recebe projeção comercial permitida, nunca snapshot interno bruto.

PCM cria item A Faturar com chave estável tipo+origem e request_id único. Financeiro recebe DTO transacional/idempotente por contrato e efetiva documento/nota, data e competência. Retry não duplica cobrança. Alteração após liberação usa complemento/estorno explícito com vínculo ao original; não sobrescrever valor faturado. Integração entre contextos usa outbox existente e contratos em packages.

## Alternativas e consequências

Persistência proposta do A Faturar: `financeiro.itens_faturaveis` e suas alocações/documentos são canônicas; PCM emite origem operacional pelo contrato e consulta projeção, sem tabela `pcm.itens_faturaveis` concorrente. Esta escolha técnica substitui o nome de tabela sugerido no caderno, preservando integralmente a regra operacional e a fila apresentada no SO.

Rejeitados: duplicar orçamento em novo schema, usar despesa Auvo como fonte oficial e faturar automaticamente ao concluir tarefa. Preservar recebíveis/contratos existentes. Migração de legado requer origem comprovada; registro ambíguo permanece pendente. E01-S184 protege custos antes de ampliar Portal; E01-S181/182/183 dependem desta fronteira. RLS, pgTAP, autorização servidor e teste de duplicidade financeira antes de PASS.
