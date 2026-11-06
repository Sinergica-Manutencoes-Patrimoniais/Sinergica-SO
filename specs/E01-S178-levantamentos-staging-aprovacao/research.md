# Research — E01-S178

## Decision

criar recepção versionada em staging para arquivo/Auvo/futuro Campo com evidências privadas e preview de diferenças/erros; aprovar por linha/lote com controle de versão, validação de hierarquia/matches e incorporação transacional com reversão lógica controlada.

## Evidence and Reuse

- `specs/E01-S161-importacao-excel-estrutura/spec.md`
- `apps/web/src/features/pcm/pages/EstruturaClientePage.tsx`
- `supabase/functions/_shared/auvo/webhook-dispatch.ts`

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

### Revalidação do importador legado (2026-10-27)

- `planejarImportacao` gera prévia local; `executarPlanoEstrutura` executa gravações nas estruturas oficiais pelos gateways existentes. Isso não é staging persistido nem aprovação transacional por lote; não reaproveitar o executor como recepção de levantamento.
- O importador legado passou a identificar dependências e resultados por aba e número de linha, bloqueando também descendentes de linhas puladas; teste com prévia e executor cobre falha transitiva e linhas homônimas entre abas. Isso corrige apenas o executor atual: não cria staging nem resolve AC-5 da nova story.
- Reuso potencial: leitura e validação puras da planilha e identificação de erros podem informar a prévia de staging, desde que sejam adaptadas para identidade estável por aba/linha e não invoquem o executor legado. Dependências S170/S176/S177 ainda exigem validação integrada.

Dependências E01-S176, E01-S177, E01-S170 precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.
