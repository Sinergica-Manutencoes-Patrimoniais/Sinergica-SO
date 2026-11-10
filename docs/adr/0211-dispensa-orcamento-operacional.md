---
name: "docs-adr-0211-dispensa-orcamento-operacional-md"
description: "Documento Sinérgica SO: ADR-0211 — Dispensa de documento de orçamento"
alwaysApply: false
---

# ADR-0211 — Dispensa de documento de orçamento

**Estado:** proposta preparatória, não homologada nem implantada.

Operador com capacidade específica pode declarar dispensa de documento para lista/OS de uma Conta, com motivo obrigatório, revisão da lista, autor, data e pedido idempotente. O motivo descreve a regra ou razão avaliada; não se presume que texto seja comprovação contratual automatizada. A decisão é registro operacional imutável independente da proposta Comercial: não define valor zero, não cancela proposta, não aprova fornecimento e não elimina item faturável. Não envia mensagem, cria OS, lançamento ou cobrança.

Só uma declaração por lista é admitida nesta fatia; revogação/substituição exige fluxo versionado próprio e não pode apagar histórico. Capacidade nasce sem concessões, gate inicia fechado e RPCs não recebem grant. Antes de habilitar, validar vínculo contratual e permissão de dispensa, concorrência com propostas/itens faturáveis, histórico e revogação, autorização por Conta, UI/Portal, testes integrados e revisão adversarial. Consumidores operacionais ainda não usam a dispensa como autorização para prosseguir.
