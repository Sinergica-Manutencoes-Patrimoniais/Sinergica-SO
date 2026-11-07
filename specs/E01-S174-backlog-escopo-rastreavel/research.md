# Research — E01-S174

## Decision

persistir Backlog independente e composição de parcelas, priorização GUTD e decisões de risco/dispensa; implementar promoção e devolução transacionais por parcela e painel lateral compartilhado com Kanban/360.

## Evidence and Reuse

- `apps/web/src/features/pcm/pages/BacklogGutPage.tsx`
- `apps/web/src/features/pcm/components/PainelBacklog.tsx`
- `apps/web/src/features/pcm/domain/priorizacao-backlog.ts`
- `supabase/migrations/0209_E01-S151_backlog_sem_chamado.sql`

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

Dependências E01-S173, E01-S167, E01-S170 precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.
