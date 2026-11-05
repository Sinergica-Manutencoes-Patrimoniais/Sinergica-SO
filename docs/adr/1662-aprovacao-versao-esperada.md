---
name: "adr-1662-aprovacao-versao-esperada"
description: "Versão esperada na aprovação de Plano"
alwaysApply: false
---

# ADR-1662 — Versão esperada na aprovação de Plano

## Estado

Proposta E01-S165. Não aplicada nem homologada; requer revisão adversarial e ensaios de concorrência antes de habilitação.

## Decisão

Uma nova borda de aprovação associa ao pedido a identidade da versão de rascunho esperada. O servidor confere ator, Cliente, revisão e versão sob as travas existentes antes de qualquer efeito e delega à aprovação atual. A leitura de preparação exige READ COMMITTED, trava compartilhada de autorização, gate e Plano/versão bloqueados para leitura, e revalida a autorização antes de devolver; a escrita revalida ambos.

O recibo original permanece no mesmo formato e o payload gravado pelas funções anteriores não é alterado. No replay, o servidor identifica primeiro o comando persistido, valida ator, Cliente e payload original, compara a versão solicitada à do recibo e retorna pelo caminho original, sem exigir que a versão ainda esteja em rascunho. Pedido anterior, salvo sem versão esperada, continua pelo contrato legado; a versão atual não é atribuída retroativamente a ele.

A borda nova tem gate desativado por padrão. Não substitui a revisão e os gates de aprovação e impacto existentes, tampouco autoriza deploy ou geração operacional.

## Limites e validação

O cliente persiste a versão esperada antes do envio e preserva o envelope após resposta incerta ou sessão alterada. A ordem de travas difere entre aprovação inicial e revisão mediada; disputas devem falhar sem deadlock nem contornar autorização, gates ou revalidação. Testar as duas ordens, revogação, mudança de rascunho, recibo divergente, replay novo e legado, migração entre versões do cliente e isolamento entre Clientes. O gate só poderá ser habilitado depois dessas provas.
