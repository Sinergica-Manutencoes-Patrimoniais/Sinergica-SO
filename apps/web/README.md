r# apps/web — aplicação principal (perfil OS)

Frontend feature-based, **um diretório por bounded context**:

```
src/
  features/<dominio>/{pages,components,hooks,types}   ← ex.: features/crm, features/comercial
  app/            ← rotas globais, providers, App
  lib/            ← supabase client, query-client, utils
  config/env.ts   ← variáveis de ambiente tipadas e validadas
```

Regras (ver `base/CLAUDE.md` e `docs/ARCHITECTURE.md`):
- Features de domínios diferentes **não se importam** — compartilhe via `packages/`.
- Lógica em hooks, não em JSX. Componente < 300 linhas. Lazy load em rotas.
- 3 estados em dado assíncrono: loading (skeleton), error (com retry), sucesso.
