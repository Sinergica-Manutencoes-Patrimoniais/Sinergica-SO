---
name: design-E09-S11-portal-deploy-separado
description: Design — extrair o Portal do Cliente da app interna para um deploy Netlify próprio (subdomínio), de modo que o build do cliente não contenha código/rotas internas do SO.
alwaysApply: false
---

# Design — Deploy separado do Portal do Cliente (fase 2)

> **Tier arquitetural (infra/segurança).** Aprovar antes de codar. Vem depois de E09-S01..S10 estáveis.

## Problema
Na fase 1 (E09-S01) o portal é uma shell isolada **dentro da mesma app/deploy** do SO — bom para
iterar rápido, mas o bundle entregue ao cliente ainda contém o código das telas internas. Decisão do
PO: mover para **deploy separado** para o cliente jamais alcançar informação interna do SO
(defesa-em-profundidade). O controle primário continua sendo a RLS por `cliente_id` (E09-S01/ADR-0011);
o deploy separado reduz a superfície do frontend.

## Contexto atual (AS-IS)
- App única: `apps/web` (Vite), deploy Netlify. Roteamento por papel (E09-S01) escolhe PortalShell vs
  HomePage no mesmo build.
- Read-models reusados pelo portal vivem em `features/pcm/application/*` — precisam ser compartilháveis
  sem arrastar telas internas.

## Decisões
### D1 — Entry/build separado para o portal
Um build dedicado do portal (app própria em `apps/portal` ou entry Vite separado) que importa **só** a
feature `area-cliente/` + os contratos/read-models compartilhados (via `packages/`), nunca as telas do
SO. Deploy Netlify próprio (subdomínio, ex.: `portal.<dominio>`).

### D2 — Compartilhar contrato, não tela
O que o portal reusa (read-models, tipos, cliente Supabase, componentes neutros) migra para
`packages/` compartilhado; código de UI interna do SO fica fora do grafo de import do portal. Gate de
build que falha se o bundle do portal referenciar módulo interno.

### D3 — RLS continua sendo o controle primário
O deploy separado é camada extra; a garantia de isolamento é a RLS por `cliente_id`. Nada de relaxar
RLS por causa da separação.

### D4 — Mesma auth/Supabase
Mesmo projeto Supabase e auth local; muda só o frontend hospedado. Config de env/URLs por deploy.

## Alternativas descartadas
- **Manter tudo na mesma app** (fase 1 permanente) — cliente recebe bundle com código interno; PO quer
  separar.
- **Backend/projeto Supabase separado** — duplicaria dado; desnecessário (RLS já isola).

## Impacto
- Estrutura de monorepo: `apps/portal` (ou entry separado) + `packages/` compartilhado; CI/CD Netlify
  do portal; envs.
- Refactor de imports das telas do portal para não depender de `features/pcm/pages` internas.

## Riscos
- Vazamento por import acidental de código interno → gate de build (D2) que quebra a CI.
- Divergência de versão entre os dois deploys → compartilhar via `packages/` versionado no monorepo.
