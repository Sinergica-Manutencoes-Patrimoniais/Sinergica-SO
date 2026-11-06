# ADR-1655 — Guardas sobre Cliente final após normalização

## Estado

Proposta E01-S176; não aplicada nem homologada.

## Decisão

A normalização de posição pode preencher Cliente mesmo quando o comando não lista essa coluna no UPDATE. O trigger de hierarquia passa a observar todo UPDATE após normalização, mantendo saída antecipada para mudanças irrelevantes. A mesma regra existente de hierarquia exige READ COMMITTED e usa try-lock ordenado por Cliente. As guardas inversas de Sistema–item passam a observar Cliente final em AFTER UPDATE. Guardas adicionais AFTER reutilizam regras existentes de Rotinas, Grupos e aliases quando o Cliente efetivamente muda, inclusive por posição.

Não há modificação de dados existentes. DELETE, reparação pela retirada de vínculo e UPDATE sem mudança relevante continuam permitidos. A rotina de reserva 0892 verifica troca de código, não mudança de Cliente; não se deve afirmar que ela valida essa alteração.

## Limites

Revisar compatibilidade de clientes que utilizam outro isolamento; as alterações relevantes falham com 25001. Try-lock reduz espera consultiva, mas não garante ausência de deadlocks com outros locks adquiridos antes dos triggers; clientes devem tratar falha e repetir após reconciliação. O histórico de dados inválidos não é consertado. Outras regras de Cliente, como sincronização e histórico de código, e mudanças concorrentes em referências exigem auditoria. Inventariar produção, provar isolamento/autorização e concorrência entre todos escritores e executar revisão adversarial antes de aplicação.
