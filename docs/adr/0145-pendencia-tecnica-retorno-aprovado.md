# ADR-0145 — Fundação de pendência a partir de retorno aprovado

## Contexto

S173 exige constatações atômicas ligadas a origem e alvo; o retorno preparado de S168 ainda não tem ingestão operacional nem evidências completas comprovadas.

## Decisão

Preparar comando privado e gate fechado que registra uma única pendência para resposta explicitamente `nao_ok` de retorno cuja última decisão seja aprovação, com referência à resposta, OS, ocorrência, Rotina e alvo. Não interpretar texto ou criar Chamado, OS ou Backlog. A origem é única e o retry do comando é idempotente. Decisões com justificativa preservam origem em eventos separados.

## Limites

A fundação não é substituta da conclusão de S168: falta ingestão verificada, vínculo oficial robusto, fotos, executor, data de execução, Local/Sistema históricos e norma. Resolução e promoção ficam fora deste incremento; não inferir solução. O uso provisório de `execucao.validar` precisa revisão de governança. Não conceder execução ou habilitar gate sem revisão adversarial, banco, concorrência, autorização e integração completos.
