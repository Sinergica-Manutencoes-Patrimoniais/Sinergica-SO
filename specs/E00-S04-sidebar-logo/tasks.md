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

- [x] Substituir `data:image/svg+xml,...⚙️...` por `<link rel="icon" href="/logos/favicon.png" />`

## T3 — HomePage.tsx: state + imports
**AC:** AC-1, AC-2, AC-3

- [x] Adicionar import `ChevronLeft, ChevronRight` do lucide-react
- [x] Adicionar `const [sidebarCollapsed, setSidebarCollapsed] = useState(false)`
- [x] Remover import `Settings` (não será mais usado após remover o ícone genérico da brand area)

## T4 — HomePage.tsx: `<aside>` largura dinâmica
**AC:** AC-1

- [x] `<aside className={...sidebarCollapsed ? "w-14" : "w-56"...transition-[width] duration-200...}>`

## T5 — HomePage.tsx: brand area com logo
**AC:** AC-4

- [x] Remover `<div>` com `<Settings>` icon + texto "Sinérgica SO" + role
- [x] Condicional: collapsed → `<img logo-simbolo-laranja.png w-8 h-8 />`; expanded → `<img logo-horizontal-branco.png h-7 />`
- [x] Brand area com flex centralizado quando collapsed

## T6 — HomePage.tsx: nav items com label condicional
**AC:** AC-2, AC-3

- [x] Sidebar "inicio": cada `<button>` com `title={m.label}`, span condicional
- [x] Sidebar PCM: idem — `title={item.label}`, span condicional
- [x] Sidebar "outros": parágrafo só aparece `{!sidebarCollapsed && ...}`
- [x] Section titles (MÓDULOS, OPERAÇÃO, etc.): `{!sidebarCollapsed && <p ...>}`

## T7 — HomePage.tsx: footer com toggle + labels condicionais
**AC:** AC-1, AC-2

- [x] Botão toggle antes dos botões de Configurações/Sair
- [x] Botão Configurações: `title="Configurações"`, span condicional
- [x] Botão Sair: `title="Sair"`, span condicional

## T8 — LoginPage.tsx: logo oficial
**AC:** AC-5

- [x] Remover bloco com gear SVG + `<h1>Sinérgica SO</h1>`
- [x] Inserir `<img src="/logos/logo-horizontal-positivo.png" className="mx-auto h-14 object-contain mb-2" />`
- [x] Subtítulo ajustado para `"Sistema Operacional"`

## T9 — Gates de qualidade
**AC:** AC-7

- [x] `pnpm run typecheck` → verde
- [x] `pnpm exec biome check apps/web/src/` → verde
- [x] Assets /logos/* respondem 200 no dev server (http://localhost:5174)
