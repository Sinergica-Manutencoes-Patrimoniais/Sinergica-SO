---
name: "docs-adr-0977-atribuicao-ciclo-posterior-md"
description: "Documento Sinérgica SO: ADR-0977 — Atribuição de parcela de ciclo posterior"
alwaysApply: false
---

# ADR-0977 — Atribuição de parcela de ciclo posterior

Status: preparação privada, não homologada.

O comando legado de atribuição exige vínculo permanente em `sso_backlog_parcelas`, que não pode ser substituído sem perder histórico. Preparar comando separado para parcela de ciclo posterior criado pela promoção de retorno. Sob gates e capacidade existentes, ele valida ator, Cliente, ciclo ativo, recibo de promoção, revisão do Chamado e escopo, estado da parcela e identidade/estado da OS; grava na tabela e auditoria de atribuições já existentes. A repetição usa a mesma chave e o mesmo formato de payload do comando legado. Não cria OS, não envia ao Auvo e não comprova execução.

Gates e EXECUTE permanecem fechados. Antes de liberar, adaptar seleção e declaração de interrupção, cobrir outros consumidores que exigem vínculo legado, validar RLS/FORCE, política de revogação, locks e concorrência, execução remota, isolamento entre Clientes, migração e revisão adversarial. Não aplicar em produção.
