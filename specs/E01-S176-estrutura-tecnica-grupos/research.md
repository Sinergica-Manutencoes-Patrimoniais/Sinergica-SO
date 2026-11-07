# Research — E01-S176

## Decision

estender parent_item_id com invariantes servidor e criar Grupo Quantitativo por Local sem recriar cadastros; compor read-models de Local/Sistema/ativo 360 com contexto físico/funcional sem inferir histórico inexistente.

A proteção incremental da hierarquia existente e sua estratégia de concorrência estão registradas em [ADR-0031](../../docs/adr/0031-integridade-hierarquia-componentes.md). Ela não substitui a integração com E01-S170 nem o histórico de movimentos.

O agregado de Grupo Quantitativo e suas ações distintas de leitura/gestão de cadastro foram definidos em [ADR-0032](../../docs/adr/0032-grupo-quantitativo-no-pcm.md). Não há geração individual nem sincronização Auvo implícita.

## Evidence and Reuse

- `supabase/migrations/0095_E01-S76_hierarquia_localizacao_ativos.sql`
- `supabase/migrations/0216_E01-S154_sistema_itens_item_unico.sql`
- `apps/web/src/features/pcm/domain/equipamentos.ts`
- `apps/web/src/features/pcm/application/equipamentos.ts`
- `apps/web/src/features/pcm/components/ComposicaoSistema.tsx`
- `apps/web/src/features/pcm/pages/EstruturaClientePage.tsx`

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

Dependências E01-S170 precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.
