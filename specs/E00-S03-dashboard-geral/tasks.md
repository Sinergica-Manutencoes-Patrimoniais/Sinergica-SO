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

- [x] Adicionar constante `DEV_EMAIL = "trivia@triviastudio.com.br"` com comentário `// DEV-ONLY`
- [x] Alterar `login()` para comparar `email.toLowerCase()` e `password`; lançar `Error("Usuário ou senha inválidos")` se não bater
- [x] Remover o parâmetro `_password` ignorado — agora password é usado
- [x] Usuário criado com `name: "Trívia Studio"`, `email: DEV_EMAIL`, `role: "admin"`
- [x] Verificar que LoginPage.tsx captura o throw (já tem try/catch) — sem mudança nele

## T2 — HomePage.tsx: tipo ModuloId + aba Início
**AC:** AC-2, AC-4  
**Arquivo:** `apps/web/src/app/HomePage.tsx`

- [x] Adicionar `"inicio"` ao tipo `ModuloId`
- [x] Adicionar import `Home` do lucide-react
- [x] Adicionar entrada `{ id: "inicio", label: "Início", icon: Home, descricao: "..." }` no índice 0 de `MODULOS`
- [x] Alterar `useState<ModuloId>("pcm")` → `useState<ModuloId>("inicio")`
- [x] Atualizar greeting: quando `"inicio"` → `"Sinérgica Manutenções · Visão Geral"`

## T3 — HomePage.tsx: dados mock DASHBOARD_GERAL
**AC:** AC-3  
**Arquivo:** `apps/web/src/app/HomePage.tsx`

- [x] Adicionar constante `DASHBOARD_GERAL` com 9 entradas (uma por módulo):
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

- [x] Definir `function DashboardGeral({ onSelect }: { onSelect: (id: ModuloId) => void })`
- [x] Grid `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4`
- [x] Cada card estruturado em 3 partes:
  - Header `bg-navy rounded-t-[10px] px-4 py-3`: ícone branco + nome branco + badge âmbar se `alerta`
  - Body `px-4 py-3 flex flex-col gap-2`: lista de KPIs (label xs ink-3 + valor xl bold font-brand ink)
  - Footer `px-4 pb-4`: botão "Ver módulo →" cor orange, chama `onSelect(moduloId)`
- [x] Card container: `bg-card rounded-[10px] border border-line overflow-hidden`

## T5 — HomePage.tsx: sidebar para "inicio"
**AC:** AC-5, AC-6  
**Arquivo:** `apps/web/src/app/HomePage.tsx`

- [x] Transformar o ternário `activeModulo === "pcm" ? ... : ...` em ternário triplo:
  ```
  inicio → lista de módulos
  pcm    → PCM_NAV (preservado)
  outros → "Navegação disponível..."
  ```
- [x] Sidebar "inicio": título de seção "MÓDULOS", listar os 9 módulos (filtrar `"inicio"`) com ícone + label, cada um clicável via `setActiveModulo`

## T6 — HomePage.tsx: content switch
**AC:** AC-2, AC-4  
**Arquivo:** `apps/web/src/app/HomePage.tsx`

- [x] Atualizar o bloco de render do conteúdo:
  ```tsx
  inicio → <DashboardGeral onSelect={setActiveModulo} />
  pcm    → <PcmDashboard />
  outros → <EmConstrucao modulo={modulo} />
  ```

## T7 — Gates de qualidade
**AC:** AC-8

- [x] `pnpm run typecheck` → verde ✅
- [x] `pnpm exec biome check apps/web/src/` → verde ✅
- [x] Testar no browser: AC-1 a AC-7 verificados via inspeção de código + dev server 200

## T8 — Atualizar docs + commit
**AC:** todos

- [x] Atualizar `docs/epics/ROADMAP.md` — E00-S03 status "Implementado", AC verdes ✅
- [x] Atualizar `docs/STATE.md` — feature ativa, gates passando
- [x] Branch `feat/E00-S03-dashboard-geral` → commit `905c37c` ✅ · push bloqueado (403 — aguarda write access ao repo)
