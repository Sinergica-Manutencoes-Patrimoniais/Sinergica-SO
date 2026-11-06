# Research — E01-S186

## Decision

especificar e validar expand/backfill/conferência/reversão lógica em lote com mapping comprovado e compatibilidade legada; montar matriz executável e runbook de seis ondas com evidências/aceites e gates de integração/segurança.

## Evidence and Reuse

- `docs/entregas/2026-10-14/README.md`
- `Definition-of-Done.md`
- `supabase/migrations/0171_E01-S129_uma_os_por_chamado.sql`
- `supabase/migrations/0224_E01-S53_preventivas_pcm.sql`

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

Dependências E01-S165, E01-S166, E01-S167, E01-S168, E01-S169, E01-S170, E01-S171, E01-S172, E01-S173, E01-S174, E01-S175, E01-S176, E01-S177, E01-S178, E01-S179, E01-S180, E01-S181, E01-S182, E01-S183, E01-S184, E01-S185 precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.
