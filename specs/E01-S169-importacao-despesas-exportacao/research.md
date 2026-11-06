# Research — E01-S169

## Decision

mapear planilhas para staging aprovado de Plano/Rotina com periodicidade/duração explícitas e pendências de tempo, sem efeito operacional; exportar snapshot e filtros idênticos nos formatos PDF/XLSX com capacidade opcional e indicação de tempo pendente.

## Evidence and Reuse

- `specs/E01-S161-importacao-excel-estrutura/spec.md`
- `docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx`
- `docs/planejamento/plano-manutencao/fontes/plano-i-home-2026.xlsx`

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

Dependências E01-S165, E01-S166, E01-S178 precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.
