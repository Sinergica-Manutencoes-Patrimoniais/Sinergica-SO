# Research — E01-S173

## Decision

normalizar resultados explícitos por pergunta e upsert atômico de Pendência com origem/evidências, mantendo validação separada; agrupar cartões por alvo, filtrar e registrar decisões parciais com estado/origem preservados e contrato de promoção.

## Evidence and Reuse

- `supabase/migrations/0224_E01-S53_preventivas_pcm.sql`
- `supabase/migrations/0226_E01-S53_upsert_avaliacoes_preventivas.sql`
- `supabase/migrations/0228_E01-S53_resultado_preventivo_historico.sql`
- `supabase/functions/pcm-preventivas-enviar-backlog/index.ts`

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

Dependências E01-S165, E01-S166, E01-S168 precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.
