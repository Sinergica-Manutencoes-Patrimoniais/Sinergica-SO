---
name: "docs-adr-0982-retorno-parcial-continuacao-md"
description: "Documento Sinérgica SO: ADR-0982 — Retorno parcial por continuidade vinculada"
alwaysApply: false
---

# ADR-0982 — Retorno parcial por continuidade vinculada

Status: preparação privada, não homologada.

Quando há execução parcial, a Pendência integral não pode ser devolvida como se nada tivesse sido feito. Preparar um registro próprio de retorno parcial com descrição e minutos da proposta de continuidade explicitamente vinculada à parcela, fotografia da proposta, revisão humana da parcela, OS anterior, suspensão e interrupção declaradas. A mesma transação encerra o ciclo anterior e cria um retorno aguardando, mantendo a parcela, a OS e os registros anteriores. O item parcial tem identidade própria e não modifica a descrição original da Pendência.

O primeiro caminho exige proposta pendente ainda sem OS de continuidade, vínculo declarado para a fotografia atual, última revisão humana não atendida associada à mesma OS, OS terminal e mesmas revisões de suspensão/interrupção. Esses sinais são declarações administrativas: não demonstram a exatidão do restante nem parada remota. Uma Pendência não pode ter outro ciclo ativo ou retorno aguardando por qualquer caminho; essas condições devem ser validadas com locks e constraints compatíveis antes de ativar. Retornos parciais ainda não entram no ranking ou em promoção e não resolvem quantidades, desdobramentos múltiplos ou todos os casos de continuidade.

Gate e EXECUTE fechados. Antes de liberar, concluir promoção somente do restante, reconciliação e bloqueio de todos os escritores legados e Auvo, atualizar consumidores, revisar lock global, múltiplas parcelas/propostas, estados, revisão de fonte, RLS/FORCE e autorização; testar atomicidade, repetição, concorrência, integridade e realizar revisão adversarial. Não aplicar em produção ou disparar execução externa.
