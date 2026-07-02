---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Hardening pós-primeira-pipeline-real (Padrão OS v3.2.0)

> **Fonte da verdade.** Status: aprovado
> Tier: Pequeno (mecânico, sem decisão nova de domínio — traz mecanismos já decididos no vault,
> reconciliando com correções manuais já aplicadas em sessões anteriores). Sem `design.md`.

## Resumo
Trazer os mecanismos novos do Padrão OS v3.2.0 (`ci:local` espelhando a CI no pre-push, lint de
migrations que exige GRANT para toda `CREATE POLICY`, gates de QA que checam o CI real) para este
repositório, reconciliando com o que já foi corrigido manualmente nas stories E00-S05/E00-S06
(Node 22, bump de vite/vitest, allowlist do gitleaks) sem duplicar nem desfazer.

## Critérios de aceite

### AC-1: `ci:local` espelha a CI real deste repo
- **Dado** `scripts/ci-local.mjs` adaptado a pnpm/turbo e à sequência real de `.github/workflows/ci.yml`
- **Quando** rodamos `pnpm run ci:local`
- **Então** roda, na ordem, os mesmos gates que a CI roda (esteira, fidelidade, Mermaid, lint de
  migrations, lint, typecheck, arch:check, build, test — `build`/`test:e2e` entram automaticamente
  se declarados em `package.json`), parando no primeiro vermelho (fail-fast).
- **E** `.husky/pre-push` roda `pnpm run ci:local` em vez de só `typecheck && test`.

### AC-2: Lint de migrations exige GRANT para toda `CREATE POLICY`
- **Dado** `scripts/lint-migrations.mjs` (consolida o check de DROP-sem-reverso já existente com o
  check novo de GRANT)
- **Quando** rodamos `pnpm run lint:migrations`
- **Então** falha se alguma migration tiver `CREATE POLICY` sem `GRANT` correspondente na tabela,
  ou sem `GRANT USAGE ON SCHEMA` para schema customizado — e passa limpo nas duas migrations reais
  deste repo (`0001_E00-S00_schemas_dominio.sql`, `0002_E00-S05_perfis_rbac.sql`), corrigidas se o
  lint acusar algo real.
- **E** o job `migrations` do `ci.yml` passa a rodar esse script em vez do grep inline anterior.

### AC-3: Config anti-ruído reconciliada (sem duplicar o que já existe)
- **Dado** o estado atual de `biome.json`, `.gitignore`, `.gitleaks.toml` (já corrigidos em
  E00-S05/E00-S06)
- **Quando** comparados ao scaffold v3.2.0
- **Então** os itens que já existem são mantidos como estão; só os genuinamente ausentes são
  adicionados (ex.: `sbom.json`/binário `gitleaks` no `.gitignore`, allowlist de exemplos/
  placeholders no `.gitleaks.toml`).

### AC-4: Gates de QA exigem CI real, não só local
- **Dado** as skills `.claude/skills/validar/SKILL.md` e `.claude/skills/revisar-pr/SKILL.md`, e
  `Definition-of-Done.md`
- **Quando** atualizadas pelo padrão v3.2.0
- **Então** documentam explicitamente que `gh pr checks` verde (sem check obrigatório "skipped")
  é parte do veredito PASS/aprovação — não só `ci:local` verde localmente.
- **E** `db/rls.template.sql` ganha o passo de `GRANT` obrigatório (hoje ausente) e
  `db/rls-test.md` documenta a pegadinha do `throws_ok` (INSERT lança `42501`;
  SELECT/UPDATE/DELETE filtrados pela `USING` não lançam, afetam 0 linhas).

### AC-5: Tooling alinhado, sem regressão
- **Dado** `engines.node` (`>=22`), Node da CI (`22`), `dependency-cruiser`/`vitest` já em versão
  compatível (corrigidos em E00-S06)
- **Quando** revisados nesta story
- **Então** confirmados consistentes (não reaplicados); `pnpm-lock.yaml` commitado e atualizado
  após qualquer `pnpm install`.

### AC-6: `ci:local` roda verde de ponta a ponta neste repositório
- **Dado** todos os itens acima aplicados
- **Quando** rodamos `pnpm install && pnpm run ci:local`
- **Então** termina verde (exceto avisos best-effort documentados, ex.: gitleaks local se o
  binário não estiver instalado — a CI cobre esse gate de verdade).

## Casos de borda e erros
- `lint-migrations.mjs` não deve acusar falso positivo em `GRANT` que lista múltiplos schemas
  numa única instrução (`grant usage on schema a, b, c to role`) — se acusar, a migration é
  reescrita com um `GRANT USAGE` por schema (mais claro e compatível com o lint mecânico).
- `ci-local.mjs` não deve travar quem não tem `gitleaks` instalado localmente (esse gate é
  best-effort local; o bloqueante de verdade é o da CI).

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Push, PR ou merge — trabalho fica em commits locais; `@devops` (usuário) decide quando abrir PR.
- Registrar `test:coverage`/thresholds novos além do que já existe em `apps/web/vitest.config.ts`.
- Qualquer mudança em `.triviaiox-core/` (vendorizado, nunca editado).

## Rastreabilidade
- Origem: instrução direta do usuário citando `CHANGELOG.md` v3.2.0 do Padrão OS (vault) e os 10
  bugs encontrados nas stories E00-S05/E00-S06 desta mesma sessão.
- ADRs relacionados: nenhum (mecânico, decisão já tomada a montante no padrão).
