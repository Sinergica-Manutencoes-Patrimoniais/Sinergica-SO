---
name: "docs-adr-1690-capacidades-sensiveis-reaproveita-e01-s170-md"
description: "Documento Sinérgica SO: ADR-1690 — E00-S26 reaproveita a fundação de capacidades de E01-S170"
alwaysApply: false
---

# ADR-1690 — E00-S26 reaproveita a fundação de capacidades de E01-S170, não reescreve

**Status:** decidida (17/11/2026).

## Contexto

O Pacote Consolidado (BL 005) nomeia sete capacidades sensíveis: planejar, validar, aprovar,
cancelar, exportar, visualizar valores internos, administrar. O achado do Fabrício: "quem tem
escrita num módulo pode aprovar, cancelar, exportar e ver custo interno."

Inventário antes de codar: `E01-S170` (`0239`-`0242` e descendentes) já construiu a fundação
inteira — `config.sso_acoes` (com `nivel` e `exige_concessao_individual`), `sso_perfis`,
`sso_usuario_perfis`, `sso_concessoes`, a função única `config.sso_autorizar_acao(acao,
cliente_id)` que TODA RPC sensível do repo já chama, e uma UI administrativa completa
(`CapacidadesWorkspace`, 742 linhas, montada em `HomePage.tsx`, gate `papel=superadmin`).

Achado estrutural, confirmado por teste (`E01-S170_capacidades_sso.test.sql`): **toda** ação em
`sso_acoes` exige uma linha própria em `sso_concessoes` (individual ou por perfil) — módulo
(`config.grupo_modulos`→`resolver_permissoes_modulo`) é condição NECESSÁRIA mas nunca SUFICIENTE.
E não existe, em nenhuma migration, uma linha real de `sso_concessoes` com `perfil_id` preenchido
fora de teste — ou seja, hoje, na prática, **nenhum perfil concede nada a ninguém**, e toda
capacidade granular só funciona via concessão individual, criada pela UI que já existe.

## Decisão

1. **Nenhuma tabela, RPC ou UI nova.** O gap real não é "construir capacidades" — é "apertar o
   parafuso frouxo": das ações que correspondem às sete capacidades nomeadas, só `plano.gerir`
   nasceu com `exige_concessao_individual=true`. Migration `1854_E00-S26_capacidades_sensiveis.sql`
   flipa pra `true`: `cadastro.aprovar` (aprovar), `chamado.encerrar` (cancelar), `custo.ler`
   (visualizar valores internos), `visita.cancelar` (cancelar).
2. **`execucao.validar` (validar) fica de fora, por decisão consciente — SPEC_DEVIATION.**
   `E01-S170_perfis_acumulaveis.test.sql` já prova, com nome no teste ("usuário acumula
   capacidades dos dois perfis"), que herança por perfil nesta ação específica é design
   intencional de uma story anterior, não descuido. Reescrever isso quebraria contrato já
   testado sem pedido explícito de reversão. Fica registrado aqui, não escondido.
3. **"Exportar" e "administrar" não ganham ação genérica nova.** Não há hoje um caminho de export
   (relatório/PDF/CSV) que vaze sem checar módulo — os RPCs de relatório (`relatorio_cliente_
   mediado`, `relatorio_os_mediado` etc.) já checam módulo PCM; criar uma ação `relatorio.exportar`
   sem um caso concreto de vazamento seria capacidade de papel, não resposta a um achado real.
   "Administrar" (usuários/configurações) já é restrito por `papel='superadmin'` hardcoded nas
   próprias RPCs de `sso_definir_perfil`/`sso_definir_concessao` — mais restrito que uma
   capacidade nomeada teria sido. Nenhum dos dois entra nesta migration; ambos registrados como
   "já atendido por outro mecanismo", não como pendência.
4. **Perfis nomeados ("Financeiro", "Cliente", "Inspetor") não existem como `papel` nem como
   `sso_perfis` administrados hoje — e não precisam.** `papel` tem só 4 valores
   (`superadmin/supervisor/colaborador/cliente-sindico`); "Financeiro" e "Inspetor" do pacote
   mapeiam pra combinações de `papel=colaborador` + grupo/módulo, já suficientes pra provar AC-4 e
   AC-6 estruturalmente (pgTAP, `E00-S26_capacidades_sensiveis.test.sql`). "Cliente" mapeia pro
   `papel=cliente-sindico` já existente, isolado por `config.usuario_cliente` + RLS.

## Consequências

- Migration aditiva, comportamento idêntico em produção hoje (nenhuma concessão real existente é
  afetada — confirmado antes de aplicar).
- A partir de agora, conceder `cadastro.aprovar`/`chamado.encerrar`/`custo.ler`/`visita.cancelar`
  por PERFIL deixa de funcionar — só concessão individual (já é assim que a `CapacidadesWorkspace`
  é usada hoje, sem nenhum perfil real criado).
- `/revisao-adversarial` desta story cobre só o que mudou (a migration + o teste); a função
  `sso_autorizar_acao` em si já passou pela revisão da própria `E01-S170`.

## Referências

- `0239_E01-S170_capacidades_sso.sql`, `0240`–`0242` (fundação).
- `E01-S170_capacidades_sso.test.sql`, `E01-S170_perfis_acumulaveis.test.sql` (contrato pré-existente).
- `apps/web/src/features/pcm/interfaces/capacidades-sso/Workspace.tsx` (UI já montada).
