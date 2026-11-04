# Research — E01-S179

## Decision

persistir lista/texto original e parser determinístico com editor opcional de linhas e Central filtrável; registrar transições e exceção por lista/linha, suspensão da mesma OS e contrato de aquisição sem duplicar execução.

## Evidence and Reuse

- `apps/web/src/features/comercial/domain/importacao-levantamento.ts`
- `apps/web/src/features/pcm/components/ChamadoPainel.tsx`
- `apps/web/src/features/pcm/pages/VisaoClientePage.tsx`

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

### Revalidação local (2026-10-27)

- `comercial/domain/importacao-levantamento.ts` importa itens de assessment para propostas e atribui quantidade 1; não interpreta texto e não pode ser reutilizado como parser de materiais sem inventar quantidade. Não importar features de outro domínio diretamente.
- `ChamadoPainel.tsx` e `VisaoClientePage.tsx` existem, mas não comprovam uma Central de Materiais. Integração com Chamado/Cliente360 continua dependente dos contratos das stories indicadas.
- A prévia local do parser conserva texto e trechos originais; não persiste lista, aprova, adquire, informa disponibilidade nem integra OS. Conversão é conservadora e linhas devem ser revisadas. Não substitui autorização, auditoria ou testes de banco.

Dependências E01-S167, E01-S171, E01-S170 precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.
