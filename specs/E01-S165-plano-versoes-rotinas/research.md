# Research — E01-S165

## Decision

validar escopo multialvo do Plano e alvo exclusivo por versão de Rotina, rascunho, instrução/checklist obrigatório e tempo pendente; aprovar por capacidade atual, versionar e congelar Rotinas/questionário aplicado, preservar histórico e produzir prévia de revisão/retirada/suspensão.

## Evidence and Reuse

- `apps/web/src/features/pcm/domain/preventivas.ts`
- `apps/web/src/features/pcm/application/preventivas-gateway.ts`
- `apps/web/src/features/pcm/infrastructure/supabase-preventivas-adapter.ts`
- `apps/web/src/features/pcm/components/PreventivasWorkspace.tsx`
- `supabase/migrations/0224_E01-S53_preventivas_pcm.sql`

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

Dependências E01-S170, E01-S176 precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.

## Revalidação ao iniciar (2026-10-27)

`pcm.planos_preventivos` da 0224 exige exatamente um alvo por plano e gera ocorrências próprias, portanto não representa Plano amplo com Rotinas versionadas. Preservar tabelas, ocorrências, OS e IDs legados sem conversão automática; nova fundação segue ADR-0026, com pontes apenas quando houver origem comprovada. `preventivas.ts` calcula calendário ancorado e é referência para recorrência futura, não autorização para materializar ocorrências ao salvar rascunho. E01-S170 e S176 estão em implementação local, não homologadas; testes de S165 usam fixtures e não declaram integração completa.
