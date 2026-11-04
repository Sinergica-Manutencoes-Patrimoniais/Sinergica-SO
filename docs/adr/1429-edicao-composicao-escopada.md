# ADR-1429 — Edição de composição por concessão

Para E01-S170/S184, preparar comando de composição para usuário Comercial autorizado por Cliente com `custo.ler` e `orcamento.emitir`. A operação serializa a proposta, exige versão e pedido idempotente, recalcula custos, piso e preço sugerido no banco com os parâmetros e alíquota existentes e reutiliza a rotina transacional legada para gravar itens e versão. Preço abaixo do piso continua recusado; exceção permanece em seu fluxo próprio. Eventos registram ator, versão e motivo sem copiar itens ou custos para auditoria.

Gate próprio nasce fechado; não altera acesso direto, não envia proposta e não grava operação real. Antes de ativar: validar arredondamento e parâmetros tributários, escopo Cliente, privilégios do executor, limites, ordem de travas, reprocessamento, RLS/FORCE, compatibilidade da rotina legada e revisão adversarial.
