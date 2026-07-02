---
name: spec-E00-S04-sidebar-logo
description: Sidebar colapsável com toggle + logo real da Sinérgica na sidebar e tela de login.
story: E00-S04
tier: pequeno
status: aprovado
alwaysApply: false
---

# Spec — E00-S04: Sidebar colapsável + Logo Sinérgica

> **Épico:** E00 — Shell & Infra · **Tier:** Pequeno

## Problema
A sidebar ocupa 224px fixos sem opção de recolher, reduzindo a área de conteúdo. A identidade visual usa um ícone de engrenagem genérico (lucide Settings) em vez do logo real da Sinérgica 2026.

## Solução
1. Botão toggle que recolhe a sidebar para `w-14` (somente ícones) ou expande para `w-56` (completo).
2. Logo horizontal branco na sidebar expandida; símbolo laranja na sidebar recolhida.
3. Logo horizontal colorido (positivo) na tela de login, substituindo o SVG genérico.
4. Favicon atualizado para o ícone oficial da Sinérgica.

## Acceptance Criteria

### AC-1 — Botão toggle na sidebar
**Given** a sidebar está visível  
**When** o usuário clica no botão toggle (ChevronLeft/ChevronRight)  
**Then** a sidebar alterna entre recolhida (`w-14`) e expandida (`w-56`) com transição suave

### AC-2 — Estado recolhido: somente ícones
**Given** a sidebar está recolhida  
**When** o usuário observa o menu  
**Then** apenas ícones são visíveis; labels, títulos de seção e texto "Recolher" estão ocultos; ícones têm atributo `title` para tooltip de acessibilidade

### AC-3 — Estado expandido preservado
**Given** a sidebar foi recolhida e depois expandida  
**When** o usuário observa o menu  
**Then** labels, títulos de seção e botão "Recolher" reaparecem; nenhum item de navegação é perdido

### AC-4 — Logo correto por estado
**Given** qualquer estado da sidebar  
**When** o usuário observa a área da marca  
**Then** expandida → `logo-horizontal-branco.png`; recolhida → `logo-simbolo-laranja.png` (sem Settings icon genérico)

### AC-5 — Login com logo oficial
**Given** a tela de login está aberta  
**When** o usuário observa o cabeçalho  
**Then** `logo-horizontal-positivo.png` é exibido (sem o SVG de engrenagem genérico)

### AC-6 — Favicon atualizado
**Given** o app está aberto no browser  
**When** o usuário observa a aba do browser  
**Then** o favicon é o ícone oficial da Sinérgica (não o gear emoji ⚙️)

### AC-7 — Gates de qualidade
**Given** a implementação está completa  
**When** os scripts rodam  
**Then** `pnpm run typecheck` e `pnpm exec biome check apps/web/src/` passam sem erros

## Fora de escopo
- Persistência do estado collapsed em localStorage (futuro)
- Tooltip visível ao hover em collapsed (futuro — por ora `title` nativo do browser é suficiente)
- Responsividade mobile (sidebar overlay) — futuro
