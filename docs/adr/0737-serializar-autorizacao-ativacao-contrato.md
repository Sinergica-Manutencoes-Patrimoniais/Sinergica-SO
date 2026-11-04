# ADR-0737 — Serializar autorização na ativação de contrato

**Status:** incremento preparado para diagnóstico; não homologado nem implantado.

## Evidência e decisão

A revalidação da 0959 não impede uma revogação após a última leitura. Um teste de duas sessões confirmou que a alteração de módulo concluía enquanto uma ativação não confirmada mantinha o contrato em processamento.

O resolvedor efetivo usado pelo comando depende de `config.usuarios`, `config.usuario_modulos`, `config.grupos` e `config.grupo_modulos`. A migration 0319 instala gatilhos de escrita com a mesma trava transacional exclusiva em todas essas fontes. A ativação passa a obter a trava compartilhada com `pg_try_advisory_xact_lock_shared` após bloquear contrato, proposta e oportunidade e antes da revalidação final e dos efeitos. Se a trava estiver ocupada, recusa para nova tentativa; se a ativação obtiver a trava primeiro, uma alteração dessas fontes aguardará seu commit ou rollback.

O uso não bloqueante evita esperar pela trava de permissão enquanto a ativação já detém linhas de negócio. A ordem dos demais escritores e deadlocks em operações externas ainda precisa ser testada. A migration não altera assinatura, ACL, dados, escopo global ou conteúdo exposto.

## Limites

Esta garantia depende dos gatilhos 0319 estarem instalados e ativos e de todos os escritores pertinentes respeitarem essa fronteira. Não cobre alterações externas ao conjunto de tabelas, atores privilegiados capazes de desabilitar gatilhos, mudanças no provedor de identidade ou isolamento diferente do testado. A trava é global e pode aumentar contenção; verificar impacto e compatibilidade antes de rollout. Testar as duas ordens para contratos avulso e recorrente, downgrade e usuários desativados, além de CI/db-tests e revisão adversarial. Não dispara faturamento, Auvo ou integração externa.
