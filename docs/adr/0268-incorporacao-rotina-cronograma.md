---
name: "docs-adr-0268-incorporacao-rotina-cronograma-md"
description: "Documento Sinérgica SO: ADR-0268 — Incorporação de linha aprovada ao Plano rascunho"
alwaysApply: false
---

# ADR-0268 — Incorporação de linha aprovada ao Plano rascunho

Status: proposta, não homologada.

Transação preparada cria uma única Rotina em Plano rascunho via comando canônico, conserva vínculo imutável com identidade declarada, linha, lote e aprovação, e rejeita identidade já vinculada. Lote e Plano devem ser do mesmo Cliente e suas revisões devem estar atuais; todas as declarações da linha devem anteceder a conferência concluída, rejeitadas e em revisão são bloqueadas, alvo deve continuar válido e tolerância é a declarada no mapeamento vigente ou zero. O vínculo e a criação são atômicos; retry é idempotente. A transação não atualiza Rotina importada existente, aprova Plano nem cria ocorrência ou OS.

Identidade é declaração humana e exige revisão para reprocessamentos; deduplicação não garante equivalência de fontes. Nenhuma tolerância legal é inferida. Gate próprio nasce fechado, gates de staging e aprovação também são exigidos e EXECUTE revogado. Ativação exige testes, revisão adversarial, política operacional e validação de capacidade/permissões. Rollback operacional é manter gates fechados, preservando histórico; não excluir vínculos ou Rotinas criadas.
