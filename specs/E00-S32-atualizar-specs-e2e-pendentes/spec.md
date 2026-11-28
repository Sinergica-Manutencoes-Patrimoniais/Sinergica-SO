# E00-S32 — Atualizar os 43 testes E2E pendentes (sem fixture de produção)

> Origem: E00-S31 (SEC-006). Status: aberta, sem owner.

## Contexto
Desde a E00-S31 a suíte E2E roda só contra o Supabase local com seed fictício
(`apps/web/e2e-infra/README.md`). Na primeira execução local, 45 testes passaram e 43
falharam. Esses 43 estão fora da suíte padrão, listados com motivo e categoria em
`apps/web/e2e-infra/pendentes.ts`:

| Categoria | Testes | O que fazer |
|---|---|---|
| `desatualizado` | 28 | a tela mudou; atualizar seletores e fluxo para a UI atual |
| `producao` | 4 | substituir o registro de produção por dado criado no teste ou no `seed-e2e.sql` |
| `dado-local` | 3 | criar o dado fictício que falta (seed ou no próprio teste) |
| `ambiente` | 1 | isolar a chamada externa (Edge Function/Auvo) ou cobrir o erro tratado |
| `a-confirmar` | 7 | apurar a causa e reclassificar |

## Critérios de aceite
- **AC-1:** cada teste corrigido sai de `pendentes.ts` e passa em
  `apps/web/e2e-infra/rodar-e2e-local.sh` contra um banco recém-resetado (`supabase db reset`).
- **AC-2:** nenhum teste usa nome, número ou id de registro de produção (cliente, OS, cargo,
  fixtures `E2E_*` de produção). Dado necessário é fictício, criado no teste ou no seed.
- **AC-3:** teste que se revelar obsoleto (funcionalidade removida) é apagado com justificativa
  no PR, em vez de corrigido.
- **AC-4:** `pendentes.ts` termina vazio (ou só com itens de `ambiente` justificados).
- **AC-5:** um defeito real do produto achado ao corrigir vira story/PR próprio, não ajuste
  silencioso no teste.

## Fora de escopo
- Rodar qualquer teste contra produção (`nudannsrfvjggoergvyn`): a trava da E00-S31 recusa.
- Specs com config isolada (`playwright.s1NN-isolado.config.ts`).
