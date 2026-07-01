---
name: tasks-E00-S04-sidebar-logo
description: Tasks de implementação da story E00-S04
story: E00-S04
alwaysApply: false
---

# Tasks — E00-S04: Sidebar colapsável + Logo Sinérgica

## T1 — Copiar logos para public/logos/
**AC:** AC-4, AC-5, AC-6

- [x] `apps/web/public/logos/logo-horizontal-branco.png`
- [x] `apps/web/public/logos/logo-horizontal-positivo.png`
- [x] `apps/web/public/logos/logo-simbolo-laranja.png`
- [x] `apps/web/public/logos/favicon.png`

## T2 — Favicon (`apps/web/index.html`)
**AC:** AC-6

- [ ] Substituir `data:image/svg+xml,...⚙️...` por `<link rel="icon" href="/logos/favicon.png" />`

## T3 — HomePage.tsx: state + imports
**AC:** AC-1, AC-2, AC-3

- [ ] Adicionar import `ChevronLeft, ChevronRight` do lucide-react
- [ ] Adicionar `const [sidebarCollapsed, setSidebarCollapsed] = useState(false)`
- [ ] Remover import `Settings` (não será mais usado após remover o ícone genérico da brand area)

## T4 — HomePage.tsx: `<aside>` largura dinâmica
**AC:** AC-1

- [ ] `<aside className={...sidebarCollapsed ? "w-14" : "w-56"...transition-[width] duration-200...}>`

## T5 — HomePage.tsx: brand area com logo
**AC:** AC-4

- [ ] Remover `<div>` com `<Settings>` icon + texto "Sinérgica SO" + role
- [ ] Condicional: collapsed → `<img src="/logos/logo-simbolo-laranja.png" className="w-8 h-8 object-contain" />`; expanded → `<img src="/logos/logo-horizontal-branco.png" className="h-7 object-contain" />`
- [ ] Brand area mantém `px-4 py-4 border-b border-navy-line`; flex centralizado quando collapsed

## T6 — HomePage.tsx: nav items com label condicional
**AC:** AC-2, AC-3

- [ ] Sidebar "inicio" (lista de módulos): cada `<button>` → adicionar `title={m.label}`, wrapper do span com `{!sidebarCollapsed && <span>}`
- [ ] Sidebar PCM (PCM_NAV items): idem — `title={item.label}`, span condicional
- [ ] Sidebar "outros": parágrafo de "Navegação disponível..." só aparece `{!sidebarCollapsed && ...}`
- [ ] Section titles (MÓDULOS, OPERAÇÃO, etc.): `{!sidebarCollapsed && <p ...>}`

## T7 — HomePage.tsx: footer com toggle + labels condicionais
**AC:** AC-1, AC-2

- [ ] Botão toggle antes dos botões de Configurações/Sair:
  - `onClick={() => setSidebarCollapsed(!sidebarCollapsed)}`
  - icon: `sidebarCollapsed ? <ChevronRight> : <ChevronLeft>`
  - label: `{!sidebarCollapsed && <span>Recolher</span>}`
- [ ] Botão Configurações: adicionar `title="Configurações"`, span condicional
- [ ] Botão Sair: adicionar `title="Sair"`, span condicional

## T8 — LoginPage.tsx: logo oficial
**AC:** AC-5

- [ ] Remover bloco `<div className="inline-flex..."> <svg gear ... /></div>`
- [ ] Remover `<h1 className="text-2xl ...">Sinérgica SO</h1>`
- [ ] Inserir `<img src="/logos/logo-horizontal-positivo.png" alt="Sinérgica" className="mx-auto h-14 object-contain mb-6" />`
- [ ] Ajustar `<p>` de subtítulo para `"Sistema Operacional"` (o logo já traz "Manutenções Patrimoniais")

## T9 — Gates de qualidade
**AC:** AC-7

- [ ] `pnpm run typecheck` → verde
- [ ] `pnpm exec biome check apps/web/src/` → verde
- [ ] Testar no browser: AC-1 a AC-6 verificados manualmente
