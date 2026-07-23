---
name: spec-E01-S80-config-so-modulos
description: Contrato — arquitetura de Configurações do SO (área global + seção por módulo), consolida os cadastros do PCM em Configurações e remove "categoria de produto".
alwaysApply: true
tier: pequeno
---

# Spec — Configurações do SO (área global + por módulo)

> **Fonte da verdade.** Status: aprovado
> Origem: reunião Lucas × Fabrício (2026-07-16). "Tudo que é configuração do SO como um todo deve
> morar numa área, e cada módulo (PCM, Atendimento, Marketing) deve ter a sua própria também."

## Resumo
O SO passa a ter uma **área de Configurações em dois níveis**: (1) config global do SO (superadmin —
integrações, IA, papéis/grupos, marcações) e (2) uma **seção de Configurações dentro de cada módulo**
(PCM, Atendimento, Marketing…), agregando os cadastros/parametrizações que hoje aparecem soltos na
sidebar. No PCM, a seção reúne Ferramentas, Equipes, Funcionários, Grupos de Clientes, Tipos de
Inspeção, Categoria de Equipamento, Segmento, Grupos de Usuário e Tag/Palavra-chave. "Categoria de
produto" é removida da UI.

## Contexto atual (AS-IS)
- Config global já existe embrionária em `apps/web/src/features/config/pages/` (`IntegracoesPage`,
  `GruposPage`, `UsuariosPage`) — E00-S09/S10/S12.
- Cadastros do PCM hoje são itens soltos de sidebar: `FerramentasPage`, `EquipesPage`,
  `FuncionariosPage`, `ClienteGruposPage`, `TiposTarefaPage`, `CatalogoSimplesPage`
  (segmentos/palavras-chave/categorias) — E01-S24…S32.

## Critérios de aceite

### AC-1: Config global do SO (superadmin)
- **Dado** um usuário `superadmin`
- **Quando** abre "Configurações" no nível do SO
- **Então** vê as sub-seções globais (Integrações, IA, Papéis/Grupos de usuário, Usuários,
  Marcações de cliente) num único hub, cada uma gated por `superadmin`; usuário sem `superadmin` não
  vê o hub global.

### AC-2: Seção "Configurações" dentro do módulo PCM
- **Dado** um usuário com acesso ao PCM
- **Quando** abre "Configurações" dentro do PCM
- **Então** encontra num único lugar: Ferramentas, Equipes, Funcionários, Grupos de Clientes, Tipos
  de Inspeção, Categoria de Equipamento, Segmento, Grupos de Usuário, Tag/Palavra-chave — cada
  sub-item reusa a página/componente já existente, sem reescrever o CRUD.

### AC-3: Sidebar do PCM enxuta
- **Dado** a sidebar do PCM
- **Quando** renderiza
- **Então** os itens que viraram configuração **não** aparecem mais como itens de primeiro nível na
  sidebar operacional — ficam sob "Configurações". Itens operacionais (Dashboard, Ordens de Serviço,
  Backlog, Inspeções, Ativos, Visão Cliente…) permanecem.

### AC-4: Categoria de produto removida
- **Dado** a UI do PCM
- **Quando** o usuário navega Configurações e cadastros
- **Então** não há nenhum ponto de acesso a "Categoria de produto" (Fabrício não usa). O descriptor
  de sync `produto_categorias` (E01-S26) **não é removido do banco/motor** — só sai da navegação.

### AC-5: Extensibilidade por módulo
- **Dado** o padrão de "Configurações do módulo"
- **Quando** um novo módulo (Atendimento, Marketing) precisa de config própria
- **Então** existe um padrão reutilizável (rota/registro de seção de config por módulo) para pendurar
  as configs daquele módulo sem duplicar o shell. Atendimento já tem `AtendimentoConfigPage` — deve
  encaixar no mesmo padrão de navegação, sem migrar seu conteúdo nesta story.

## Fora de escopo (vinculante)
- Reescrever qualquer CRUD de cadastro — só reorganiza navegação/agrupamento.
- Migrar o conteúdo do `AtendimentoConfigPage` (só garantir que o padrão comporta).
- Remover as tabelas/descriptors de `produto_categorias` do banco ou do motor de sync.
- Config de IA/OpenRouter (é E01-S81), GUTD (E01-S82), marcações de cliente (E01-S91) — esta story só
  **abre o lugar** onde elas moram; o conteúdo é das respectivas stories.

## Rastreabilidade
- `apps/web/src/features/config/pages/` (hub global), `apps/web/src/app/HomePage.tsx` (navegação/sidebar)
- Páginas PCM movidas: `FerramentasPage.tsx`, `EquipesPage.tsx`, `FuncionariosPage.tsx`,
  `ClienteGruposPage.tsx`, `TiposTarefaPage.tsx`, `CatalogoSimplesPage.tsx`
- Product: `./product.md` (n/a) · Design: n/a (tier pequeno — navegação)
