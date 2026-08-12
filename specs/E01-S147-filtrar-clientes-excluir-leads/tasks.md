---
name: E01-S147-filtrar-clientes-excluir-leads-tasks
description: Tasks da story E01-S147
---

# Tasks — E01-S147

1. **Adapter** (`supabase-cliente-360-adapter.ts::listarClientes`): filtro server-side `.neq("tipo", "lead")` na query de `pcm.clientes`. ✅
2. **UI** (`ListaClientesPage.tsx`): removido o filtro "Tipo" (Cliente/Lead) — não faz mais sentido, lead nunca aparece. ✅
3. Typecheck/lint/build verdes. ✅ (`pnpm run typecheck`, `biome check`, `pnpm vite build`)

## Validação
- `ci:local` (parcial, escopo PCM): 464 testes PCM verdes, 0 falha.
- Lista de clientes do PCM não traz mais `tipo='lead'` — confirmado por leitura da query (filtro server-side, não cliente-side).

## Nota
Sem migration — filtro é WHERE na query existente, não schema novo.
