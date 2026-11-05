# Research — E01-S170

## Decision

compor perfis/grupos existentes com capacidades e escopos, checar servidor com concessões atuais e refletir UI sem bypass por token antigo; aplicar gestão individual de Plano e autoaprovação aprovada, validação específica e trilha append-only de concessão/decisão.

O modelo complementar e a preservação do grupo legado exclusivo foram definidos em [ADR-0029](../../docs/adr/0029-capacidades-sso-e-perfis-acumulaveis.md). Nenhuma capacidade crítica é inferida do módulo existente.

A elegibilidade de uma ação a mais de um módulo está definida no [ADR-0030](../../docs/adr/0030-capacidades-modulos-alternativos.md); `custo.ler` pode depender de Comercial ou Financeiro, sempre com concessão explícita.

## Evidence and Reuse

- `apps/web/src/features/config/domain/permissao.ts`
- `apps/web/src/features/config/application/definir-permissao-usuario.ts`
- `apps/web/src/features/config/application/editar-grupo.ts`
- `apps/web/src/app/permissoes-context.tsx`
- `supabase/migrations/0006_E00-S09_grupos_permissoes_modulo.sql`

A análise desta conversa verificou código/migrations da branch baseada em 22aca391. Referências legadas não são prova de implantação em produção. Reler os trechos tocados antes do teste que falha; não reconstruir relatórios de 14/10.

## Rationale

As definições posteriores do Fabrício prevalecem: Plano amplo/Rotina alvo único, modos por calendário/Visita, tolerâncias explícitas, alias administrativo e staging aprovado. Proteger os IDs e cadastros atuais reduz migração e preserva histórico.

## Alternatives considered

- Recriar módulo/cadastro com nova identidade: rejeitado; há base funcional reutilizável.
- Adaptar operação aprovada ao limite atual do código: rejeitado; limite deve evoluir por migration compatível.
- Antecipar Auvo, deploy ou Copiloto completo: fora de escopo; interfaces de recepção e doubles bastam para preparar esta fatia.

## Technical gates

Dependências existentes precisam contrato estável antes da integração. APIs Auvo não comprovadas permanecem fechadas; testar depois em ambiente autorizado, com fixture até lá. P01/P02/P03 não estão abertas. Não há decisão funcional pendente nesta story; unknown de contrato real vira gate de liberação e SPEC_DEVIATION se contradizer design.
