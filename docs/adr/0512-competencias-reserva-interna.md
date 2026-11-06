# ADR-0512 — competências na liberação e conversão

Status: proposto; não aplicado nem homologado. A seleção, documento, alocação, estorno e correções financeiras existentes usam verificação de competência com bloqueio de `fechamentos_mensais`. A revisão de 0722 encontrou lacuna: liberação só verificava a competência gravada no documento, mesmo se a competência atual do item divergir. A migration 0737 bloqueia liberação e conversão se qualquer uma das duas estiver fechada; conversão também rejeita mudança de competência ou origem desde o documento. Retry de um comando já concluído permanece leitura idempotente, não nova alteração.

A correção do modo de proposta 0542 é decisão pré-faturável, não retificação de lançamento; não se presume cobertura de todas as demais rotas por esta mudança. Locks, fechamento concorrente, recuperação idempotente e correções financeiras continuam exigindo testes e revisão adversarial. Gates fechados, sem cobrança ou lançamento novo.
