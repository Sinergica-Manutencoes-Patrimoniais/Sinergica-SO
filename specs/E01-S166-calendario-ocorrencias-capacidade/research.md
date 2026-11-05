# Research — E01-S166

## Decision

projetar frequência/dia/vigência e exceções por modo, preservar extras e reprogramações e apresentar impacto antes de efetivar mudança contratual; materializar transacionalmente ciclos estáveis, tratar decisão de vencidos/cancelamento e tolerâncias sem duplicação entre versões.

## Evidence and Reuse

- `apps/web/src/features/pcm/domain/preventivas.ts`
- `supabase/migrations/0224_E01-S53_preventivas_pcm.sql`
- `apps/web/src/features/pcm/components/PreventivasCalendarioView.tsx`

Revalidação local 2026-10-27: `preventivas.ts` já calcula semanas e meses ancorados para o
modelo legado, mas não representa dias/anos, Visita ou feriado contratual; não substituir esse
modelo nem modificar ocorrências existentes. `PreventivasCalendarioView` apenas apresenta
ocorrências recebidas, não é motor contratual. `0224` mantém os vínculos legados. E01-S165
está parcialmente implementada e E01-S171 ainda não foi homologada; prévias isoladas não
constituem integração nem autorizam geração operacional.

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

Dependências E01-S165, E01-S171 precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.
