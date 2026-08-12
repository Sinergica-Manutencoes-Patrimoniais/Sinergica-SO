---
name: E01-S148-editar-cliente-status-tasks
description: Tasks da story E01-S148
---

# Tasks — E01-S148

## Achado real (causa raiz)
`mapearClienteCommand` em `supabase-cliente-360-adapter.ts` hardcodava `tipo: "cliente"`,
`status_comercial: "ativo"`, `ativo: true` em **todo** save — criação E edição. Editar um cliente
sempre resetava esses 3 campos pro valor "novo", mesmo que o usuário tentasse mudar `ativo` pra
`false`. A UI (`ClienteFormModal.tsx`) também nunca expunha esses campos no formulário.

## Tasks
1. `ClienteFormData`/`EditarClienteCommand` (`cliente-360-gateway.ts`) ganham `ativo?`, `tipo?`,
   `statusComercial?`. ✅
2. Adapter split em `mapearClienteCriacao` (sempre cliente/ativo — sem mudança) e
   `mapearClienteEdicao` (respeita o que foi enviado, `undefined` preserva o valor atual). ✅
3. `validarClienteForm` (domínio) passa os 3 campos adiante — antes descartava por reconstruir o
   objeto sem eles. ✅
4. `ClienteFormModal.tsx`: campos "Status" (select ativo/inativo/prospecto) e "Cliente ativo"
   (checkbox) — só aparecem na edição (`ehEdicao`), criação continua fixa em cliente/ativo. ✅
5. Testes: `clientes-crud.test.ts` cobre preservação de `ativo`/`statusComercial`. ✅

## Validação
- `pnpm run typecheck` verde.
- `biome check` verde.
- `vitest run src/features/pcm` — 464 passed, 0 failed.
- `pnpm vite build` verde.
- Playwright manual não rodado pro modal em si (fora do escopo desta sessão) — lógica coberta por
  unit test + revisão de código; recomenda-se smoke visual antes de considerar 100% fechado.
