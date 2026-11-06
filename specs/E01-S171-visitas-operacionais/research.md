# Research — E01-S171

## Decision

criar agregado Visita com equipe, composição OS de mesmo Cliente e confirmação versionada segundo ciência efetiva; versionar reprogramação/cancelamento/associações e invalidar confirmação obsoleta preservando tarefa e calendário contratual.

## Evidence and Reuse

- `apps/web/src/features/pcm/domain/agenda-tecnico.ts`
- `apps/web/src/features/pcm/pages/AgendaTecnicoPage.tsx`
- `apps/web/src/features/pcm/pages/VisaoClientePage.tsx`

Revalidação local 2026-10-27: `pcm.agenda_tecnico` registra alocação de funcionário e Cliente,
mas não possui agregado Visita nem vínculo histórico de múltiplas OS. `pcm.ordens_servico`
mantém `client_id` e `auvo_task_id` existentes e deve conservar esses identificadores. Cliente 360
e agenda são superfícies existentes, não implementação da nova Visita. E01-S167 e E01-S170
ainda não foram homologadas; fixtures locais não provam integração. ADR-0026 a 0028 e contratos
compartilhados foram conferidos; nenhuma migração de dados legados é inferida.

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

Dependências E01-S167, E01-S170 precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.
