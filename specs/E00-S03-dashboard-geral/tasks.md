---
name: tasks-E00-S03-dashboard-geral
description: Tasks de implementação da story E00-S03
story: E00-S03
alwaysApply: false
---

# Tasks — E00-S03: Auth bypass dev + Dashboard Geral inicial

## T1 — auth-context.tsx: credencial única de bypass
**AC:** AC-1  
**Arquivo:** `apps/web/src/app/auth-context.tsx`

- [ ] Adicionar constante `DEV_EMAIL = "trivia@triviastudio.com.br"` com comentário `// DEV-ONLY`
- [ ] Alterar `login()` para comparar `email.toLowerCase()` e `password`; lançar `Error("Usuário ou senha inválidos")` se não bater
- [ ] Remover o parâmetro `_password` ignorado — agora password é usado
- [ ] Usuário criado com `name: "Trívia Studio"`, `email: DEV_EMAIL`, `role: "admin"`
- [ ] Verificar que LoginPage.tsx captura o throw (já tem try/catch) — sem mudança nele

## T2 — HomePage.tsx: tipo ModuloId + aba Início
**AC:** AC-2, AC-4  
**Arquivo:** `apps/web/src/app/HomePage.tsx`

- [ ] Adicionar `"inicio"` ao tipo `ModuloId`
- [ ] Adicionar import `Home` do lucide-react
- [ ] Adicionar entrada `{ id: "inicio", label: "Início", icon: Home, descricao: "..." }` no índice 0 de `MODULOS`
- [ ] Alterar `useState<ModuloId>("pcm")` → `useState<ModuloId>("inicio")`
- [ ] Atualizar greeting: quando `"inicio"` → `"Sinérgica Manutenções · Visão Geral"`

## T3 — HomePage.tsx: dados mock DASHBOARD_GERAL
**AC:** AC-3  
**Arquivo:** `apps/web/src/app/HomePage.tsx`

- [ ] Adicionar constante `DASHBOARD_GERAL` com 9 entradas (uma por módulo):
  - PCM: OS Abertas 12, SLA 87%, Backlog 23 itens
  - Atendimento: Chamados hoje 8, Pendentes 3
  - Comercial: Leads ativos 5, Contratos 3
  - Financeiro: Recebido R$ 48,5k, Inadimplentes 1 — alerta: "1 contrato"
  - Operação: Itens críticos 2, Pedidos pend. 4 — alerta: "2 itens"
  - Marketing: Publicações/sem. 3, Alcance 1.2k
  - Growth: Leads (mês) 12, Conversão 18%
  - Gestão: Alertas 0, Score geral 94
  - Área do Cliente: Portais ativos 15, OS via portal 2

## T4 — HomePage.tsx: componente DashboardGeral
**AC:** AC-3, AC-4  
**Arquivo:** `apps/web/src/app/HomePage.tsx`

- [ ] Definir `function DashboardGeral({ onSelect }: { onSelect: (id: ModuloId) => void })`
- [ ] Grid `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4`
- [ ] Cada card estruturado em 3 partes:
  - Header `bg-navy rounded-t-[10px] px-4 py-3`: ícone branco + nome branco + badge âmbar se `alerta`
  - Body `px-4 py-3 flex flex-col gap-2`: lista de KPIs (label xs ink-3 + valor xl bold font-brand ink)
  - Footer `px-4 pb-4`: botão "Ver módulo →" cor orange, chama `onSelect(moduloId)`
- [ ] Card container: `bg-card rounded-[10px] border border-line overflow-hidden`

## T5 — HomePage.tsx: sidebar para "inicio"
**AC:** AC-5, AC-6  
**Arquivo:** `apps/web/src/app/HomePage.tsx`

- [ ] Transformar o ternário `activeModulo === "pcm" ? ... : ...` em ternário triplo:
  ```
  inicio → lista de módulos
  pcm    → PCM_NAV (preservado)
  outros → "Navegação disponível..."
  ```
- [ ] Sidebar "inicio": título de seção "MÓDULOS", listar os 9 módulos (filtrar `"inicio"`) com ícone + label, cada um clicável via `setActiveModulo`

## T6 — HomePage.tsx: content switch
**AC:** AC-2, AC-4  
**Arquivo:** `apps/web/src/app/HomePage.tsx`

- [ ] Atualizar o bloco de render do conteúdo:
  ```tsx
  inicio → <DashboardGeral onSelect={setActiveModulo} />
  pcm    → <PcmDashboard />
  outros → <EmConstrucao modulo={modulo} />
  ```

## T7 — Gates de qualidade
**AC:** AC-8

- [ ] `pnpm run typecheck` → verde
- [ ] `pnpm exec biome check apps/web/src/` → verde (auto-fix se necessário)
- [ ] Testar no browser: AC-1 a AC-7 verificados manualmente

## T8 — Atualizar docs + commit
**AC:** todos

- [ ] Atualizar `docs/epics/ROADMAP.md` — E00-S03 status "Implementado", AC verdes ✅
- [ ] Atualizar `docs/STATE.md` — feature ativa, gates passando
- [ ] Branch `feat/E00-S03-dashboard-geral` → commit `feat(E00-S03): auth bypass dev + dashboard geral inicial` → push → PR
