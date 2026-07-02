---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Sincronizar correções do Padrão OS v3 / Triviaiox

> **Fonte da verdade.** Status: aprovado
> Tier: Pequeno (mecânico, sem decisão nova de domínio — aplica correções já decididas a montante
> no Padrão OS v3.0.0 e no Triviaiox `e05d8d0`/`ad48746`). Sem `design.md`.

## Resumo
Aplicar neste repositório as 3 correções relevantes identificadas na sincronização com Padrão OS
v3.0.0 (vault) e Triviaiox (commits `ad48746`, `e05d8d0` de 2026-07-01): nome de agente morto
`@github-devops`, hook de autoridade de push ausente, e gate de arquitetura por máquina ausente.

## Critérios de aceite

### AC-1: Sem referência a agente morto `@github-devops`
- **Dado** os wrappers de subagente em `.claude/commands/TRIVIAIOX/agents/`
- **Quando** buscamos pela string `github-devops` como referência de agente (`@github-devops` ou
  `agent != "github-devops"`)
- **Então** nenhuma ocorrência resta nos arquivos `architect.md`, `qa.md`, `sm.md`, `dev.md`,
  `triviaiox-master.md`, `devops.md` — todas apontam para `@devops`. Nomes de arquivo reais do
  core (`.triviaiox-core/development/tasks/github-devops-*.md`) **não são tocados** (não são
  referência de persona, são nome de arquivo do framework vendorizado).

### AC-2: Hook de autoridade de push instalado e wired
- **Dado** o squad `trivia-os` (`squads/trivia-os/claude/hooks/enforce-git-push-authority.sh`)
- **Quando** o hook é copiado para `.claude/hooks/` e o `.claude/settings.json` é mesclado com o
  `PreToolUse` do squad (matcher `Bash`)
- **Então** um comando `git push` (em qualquer forma) chamado via Bash é bloqueado
  (`permissionDecision: deny`) — validável rodando o hook manualmente com um payload de teste. O
  hook existente (`Edit|Write` → `check-story.mjs`) continua funcionando (merge, não substituição).

### AC-3: Gate de arquitetura por máquina (`arch:check`)
- **Dado** o `.dependency-cruiser.cjs` de referência do Padrão OS v3 (regra
  `interfaces → application → domain ← infrastructure`, adaptado para a estrutura real deste
  monorepo: `apps/web/src/features/<domínio>/{domain,application,infrastructure}`)
- **Quando** rodamos `pnpm run arch:check`
- **Então** o comando executa `depcruise` sobre `apps/web/src` e **falha** se `domain/` importar
  `application/`, `infrastructure/` ou pacote de `node_modules`; se `application/` importar
  `infrastructure/`; ou se houver dependência circular. Está listado em `package.json` (raiz), no
  workflow `.github/workflows/ci.yml`, e o item 11 da matriz em `PADRAO-DE-QUALIDADE.md` passa de
  `📖 Guia` para `🟢 Gate CI`. `Definition-of-Done.md` ganha a linha do gate.

### AC-4: `gitleaks-action` pago → CLI grátis no CI
- **Dado** que este repo é da organização `Sinergica-Manutencoes-Patrimoniais` no GitHub
- **Quando** o job `qualidade` do `.github/workflows/ci.yml` roda o step de secret scanning
- **Então** ele usa o binário `gitleaks` via `curl` (MIT, sem licença), não mais
  `gitleaks/gitleaks-action@v2` (que exige `GITLEAKS_LICENSE` em repositórios de organização e
  falhava o job de qualidade inteiro — provável causa real de "CI não rodava" na PR anterior).

### AC-5: Deploy de banco/Edge Functions automatizado via CI
- **Dado** o novo `.github/workflows/deploy.yml` (baseado no scaffold do Padrão OS v3)
- **Quando** há push em `main` ou `develop` que toca `supabase/**`
- **Então** o workflow roda `supabase db push` + `supabase functions deploy` no ambiente
  correspondente (`production`/`staging`), condicionado a secrets (`SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`) configurados por **environment** no GitHub —
  sem eles, falha visivelmente no step de link (não deploya silenciosamente). Deploy manual pela
  CLI vira exceção de emergência (`runbooks/rollback-deploy.md`). `docs/ENVIRONMENTS.md` e
  `PADRAO-DE-QUALIDADE.md` (item 7a) documentam o novo caminho.

## Casos de borda e erros
- `arch:check` não deve falhar por causa de features ainda vazias (`comercial/`, `financeiro/`
  etc. sem `domain/`) — `depcruise` simplesmente não encontra nada para verificar nelas.
- O hook de push deve **fail-closed**: se o parsing do JSON de entrada falhar, bloqueia (não
  libera por engano).

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Dedup de comandos (`*threat-model`/`*capacity-plan` no `@architect`, `*code-review` no
  `@security`) e a correção do CodeRabbit platform-aware (WSL vs macOS/Linux) — fazem parte do
  mesmo commit `e05d8d0` upstream, mas não foram reportados como gap ao usuário nesta rodada; ficam
  para uma story futura se o usuário confirmar que quer aplicar.
- Skills novas do Triviaiox para Codex (`c91255d`) — não há `.codex/skills/` desatualizado
  detectado como bloqueante neste repo.
- Skill `/iniciar-projeto` nova do Padrão OS v3 — este projeto já passou do kickoff.
- Qualquer mudança no core do Triviaiox (`.triviaiox-core/`) — nunca editado (regra do `AGENTS.md`).

## Rastreabilidade
- Origem: conversa de sync com `Padrão OS v3` (`CHANGELOG.md`, notas 00-09) e Triviaiox
  (commits `ad48746`, `e05d8d0`, `c91255d` — 2026-07-01).
- ADRs relacionados: nenhum (correção mecânica, não é decisão nova).
