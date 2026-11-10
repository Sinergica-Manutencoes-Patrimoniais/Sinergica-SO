# Research — E01-S177

## Decision

persistir marcos de uso, guarda de edição e reserva única de código atual/alias preservando legado; substituir código com alias pesquisável/QR compatível e política explícita de sync por categoria sem perda de vínculo remoto.

## Evidence and Reuse

- `apps/web/src/features/pcm/application/identificador-ativo.ts`
- `apps/web/src/features/pcm/domain/identificador-ativo.ts`
- `apps/web/src/features/pcm/components/CampoIdentificador.tsx`
- `supabase/migrations/0221_E01-S157_siglas_identificador_ativo.sql`
- `supabase/functions/_shared/auvo/registry/equipamentos.ts`
- `supabase/functions/_shared/auvo/registry/sistemas.ts`

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

Dependências E01-S176, E01-S170 precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.
