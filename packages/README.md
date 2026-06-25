# packages/ — pacotes compartilhados do monorepo

Compartilhamento entre apps acontece **só** por aqui (features de domínios diferentes não se
importam diretamente — ver `docs/ARCHITECTURE.md`).

| Pacote | Papel |
|--------|-------|
| `config` | Configs compartilhadas: `biome.json`, `tsconfig` base (strict, noUncheckedIndexedAccess). |
| `database` | Tipos gerados do Postgre (`supabase gen types typescript`). Não editar à mão. |
| `shared` | Schemas Zod e tipos de domínio reutilizados por frontend e Edge Functions. |
| `ui` | Componentes base (shadcn) compartilhados. |

Cada pacote é publicado no workspace como `@trivia/<nome>` e consumido via `pnpm-workspace.yaml`.
