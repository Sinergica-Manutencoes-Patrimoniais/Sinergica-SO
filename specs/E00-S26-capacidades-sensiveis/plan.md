---
name: plan
description: Detalhe técnico de E00-S26 — reaproveita fundação de E01-S170, migration mínima. Puxe ao implementar.
alwaysApply: false
---

# Plan — E00-S26 · Capacidades sensíveis ponta a ponta

Ver `docs/adr/1690-capacidades-sensiveis-reaproveita-e01-s170.md` para a decisão completa.

## O que já existe (não reconstruir)

- `config.sso_acoes`/`sso_perfis`/`sso_usuario_perfis`/`sso_concessoes` — schema completo (`0239`).
- `config.sso_autorizar_acao(acao, cliente_id)` — único ponto de decisão, já chamado por toda RPC sensível do repo.
- `config.sso_definir_perfil`, `config.sso_definir_concessao`, `config.sso_definir_vinculo_perfil` — RPCs CQRS de administração, idempotentes, auditadas (`0240`-`0242`).
- `apps/web/src/features/pcm/interfaces/capacidades-sso/Workspace.tsx` — UI completa (742 linhas), montada em `HomePage.tsx`, aba "Capacidades", gate `papel=superadmin`.

## Migration

`1854_E00-S26_capacidades_sensiveis.sql` — `update config.sso_acoes set exige_concessao_individual=true` em 4 códigos: `cadastro.aprovar`, `chamado.encerrar`, `custo.ler`, `visita.cancelar`. `execucao.validar` fica de fora (SPEC_DEVIATION documentado na ADR). Sem tabela nova, sem RPC nova.

## pgTAP

`E00-S26_capacidades_sensiveis.test.sql`, 15 assertions — matriz positiva e negativa via `config.sso_autorizar_acao` direto (é o ponto único de decisão; testar ali cobre toda RPC que delega pra ele):

| AC | Provado como |
|---|---|
| AC-1 | escrita de módulo sozinha não aprova; concessão individual por Cliente aprova, não vaza pro Cliente B |
| AC-2 | mesmo padrão em `custo.ler` |
| AC-3 | `chamado.encerrar` aceito com concessão; RPC real (`1832`) audita ator+ação+momento (conferido por leitura, não reescrito) |
| AC-4 | grupo "Financeiro" (só módulo `financeiro`) nunca tem `pcm` em `resolver_permissoes_modulo` |
| AC-5 | `cliente-sindico` só tem `area-cliente`, nunca `pcm` |
| AC-6 | mesma pessoa tem `cadastro.gerir` (coleta) mas não `cadastro.aprovar` (oficial) |
| AC-7 | `sso_autorizar_acao` não tem e-mail/id fixo embutido (prova estrutural) |
| AC-8 | grupo criado em runtime (sem migration) já vale nos testes acima |

## Alcance no front (AC-F1 a AC-F5)

- **Caminho nomeado:** já existe — Configurações → Capacidades → (gerenciar perfis, concessões, vínculos). Não é story nova de front; é a tela que já está no ar pra superadmin.
- **AC-F2:** nenhuma flag `VITE_SSO_*` nova — `CapacidadesWorkspace` não lê nenhuma (gate é só `papel`).
- **AC-F3:** não aplicável — não há `return null` silencioso introduzido; tela sempre renderiza pra quem tem o papel certo.
- **AC-F4:** não há gate de banco novo — é ajuste de flag existente (`exige_concessao_individual`), sem tabela de gate.
- **AC-F5:** jornada já utilizável hoje — qualquer superadmin pode abrir Capacidades e criar a primeira concessão individual agora, sem deploy adicional.

## Riscos

- Qualquer teste futuro que assuma herança-por-perfil nos 4 códigos flipados quebra de propósito — é o objetivo da story. Documentado na ADR.
