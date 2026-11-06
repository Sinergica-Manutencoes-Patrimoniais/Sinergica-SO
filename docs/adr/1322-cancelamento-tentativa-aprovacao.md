---
name: "docs-adr-1322-cancelamento-tentativa-aprovacao-md"
description: "Documento Sinérgica SO: ADR-1322 — Encerrar tentativa de aprovação parcial sem apagar histórico"
alwaysApply: false
---

# ADR-1322 — Encerrar tentativa de aprovação parcial sem apagar histórico

Estado: preparação local; gate fechado, sem autorização para implantação.

Uma resposta incerta ou uma recusa de revisão pode deixar a tentativa local presa. Apenas apagar essa tentativa permite que um pedido anterior, ainda em trânsito, seja aplicado depois de o operador iniciar outro.

Preparar cancelamento específico da tentativa de aprovação parcial: o servidor revalida usuário, Cliente e capacidade, usa a mesma trava de requestId da aprovação e verifica o registro de comando. Se já houver confirmação compatível, devolve somente `confirmado`; não cancela nem apaga nada. Caso contrário, grava cancelamento imutável e auditado para requestId, ator e lote. A aprovação antiga consulta esse registro sob a mesma trava e recusa execução. Repetição do cancelamento deve ser idempotente. Apenas depois de resposta `cancelado`, com a mesma sessão e tentativa local, a interface pode limpar a tentativa e pedir nova seleção. Uma confirmação, divergência ou resposta incerta preserva a tentativa.

O mecanismo não cancela aprovações já realizadas, não reverte incorporações e não modifica outras operações de levantamento. A migration mantém o novo gate fechado e não abre permissões do núcleo. Antes de habilitar, é necessário drenar aprovações iniciadas com a versão anterior da função, pois elas podem continuar executando sem a nova guarda. Validar duas ordens de concorrência, replay, troca de ator/Cliente, revogação, conflitos de requestId, RLS/FORCE, rollback e revisão adversarial antes de habilitar. Para rollback, primeiro desligar a interface/gate e preservar os cancelamentos: sua guarda deve permanecer enquanto existirem pedidos antigos que possam chegar; não apagar registros para reativar pedidos.
