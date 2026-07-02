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
Aplicar neste repositório as correções identificadas em duas rodadas de sincronização com o
Padrão OS (v3.0.0 → v3.1.1, vault) e o Triviaiox (commits `ad48746`, `e05d8d0` de 2026-07-01):
nome de agente morto `@github-devops`, hook de autoridade de push ausente, gate de arquitetura
por máquina ausente, `gitleaks-action` pago, e o caminho de CD (que trocou de Action com token
para GitHub Integration nativa do Supabase entre v3.1.0 e v3.1.1, mesmo dia).

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
- **Dado** o novo `.github/workflows/deploy.yml` (baseado no scaffold do Padrão OS v3.1.0)
- **Quando** há push em `main` ou `develop` que toca `supabase/**`
- **Então** o workflow roda `supabase db push` + `supabase functions deploy` no ambiente
  correspondente (`production`/`staging`), condicionado a secrets (`SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`) configurados por **environment** no GitHub —
  sem eles, falha visivelmente no step de link (não deploya silenciosamente). Deploy manual pela
  CLI vira exceção de emergência (`runbooks/rollback-deploy.md`). `docs/ENVIRONMENTS.md` e
  `PADRAO-DE-QUALIDADE.md` (item 7a) documentam o novo caminho.
  > **Superado pelo AC-6** (Padrão OS v3.1.1, mesmo dia): o token `SUPABASE_ACCESS_TOKEN` é de
  > **conta inteira** — não existe token nativo restrito a 1 projeto/org no Supabase
  > ([supabase/supabase#18584](https://github.com/supabase/supabase/issues/18584)). Preocupação
  > legítima de não expor esse escopo num secret do GitHub. O workflow continua existindo (AC-6
  > o rebaixa a fallback), mas deixou de ser o caminho canônico.

### AC-6: CD via GitHub Integration nativa do Supabase (Padrão OS v3.1.1)
- **Dado** que o Supabase oferece integração nativa projeto↔repositório (Dashboard → Settings →
  Integrations → GitHub → "Deploy to production"), sem token de conta necessário
- **Quando** o `production branch` da integração (`main`) recebe um merge
- **Então** a integração aplica migrations de `supabase/migrations/` e, se declarados em
  `supabase/config.toml` (`[functions.<nome>]`/`[storage.buckets.<nome>]`), Edge Functions e
  Storage buckets — automaticamente, sem Action/secret nenhum no GitHub.
- **E** o `.github/workflows/deploy.yml` (AC-5) fica **rebaixado a fallback**: gatilho `on: push`
  desligado (só `workflow_dispatch`), documentado em `docs/ENVIRONMENTS.md` só para o caso de
  monorepo com mais de um projeto Supabase no mesmo repo (não é o caso deste repo hoje) — se um
  dia for ativado, exige desligar a integração nativa antes (evita aplicar a mesma migration 2x)
  e gerar o token a partir de uma **conta de automação**, nunca a conta pessoal.
- **E** `PADRAO-DE-QUALIDADE.md` (item 7a) e `docs/STATE.md` refletem o novo caminho canônico e
  os pendentes de ativação manual (fora do meu alcance: ativar a integração no dashboard do
  Supabase; ver `docs/STATE.md` → Bloqueios).

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
- Origem: conversa de sync com `Padrão OS v3` (`CHANGELOG.md` v3.0.0/v3.1.0/v3.1.1, notas 00-09)
  e Triviaiox (commits `ad48746`, `e05d8d0`, `c91255d` — 2026-07-01).
- ADRs relacionados: nenhum (correção mecânica, não é decisão nova de domínio deste projeto —
  segue decisão já tomada a montante no padrão).
