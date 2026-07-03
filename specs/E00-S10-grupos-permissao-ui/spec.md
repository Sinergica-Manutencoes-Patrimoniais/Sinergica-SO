---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Grupos e Permissões por Módulo: UI Administrativa e Gating de Sidebar

> **Fonte da verdade.** Status: aprovado (aguarda `E00-S09` mergeada para iniciar)
> Tier: Pequeno — reaproveita o design/backend de `E00-S09` (schema, resolver, hook, Edge
> Function já existem); aqui é só consumo via UI. Sem `design.md` próprio.

## Resumo
A área "Configurações" (hoje um botão morto na sidebar) ganha telas de gestão de usuários e
grupos, visíveis só para `superadmin`/`supervisor`. A sidebar passa a esconder módulos que o
usuário logado não tem permissão de acessar — capacidade que não existe hoje (todo mundo vê
todos os 10 módulos).

## Critérios de aceite

### AC-1: Botão "Configurações" abre a área administrativa, só para quem pode gerenciar
- **Dado** um usuário autenticado com `papel` `superadmin` ou `supervisor`
- **Quando** ele acessa a Home
- **Então** vê o botão "Configurações" ativo (hoje é decorativo, sem `onClick`) e, ao clicar,
  entra na área com as telas de Usuários e Grupos.
- **E** um usuário com `papel` `colaborador` ou `cliente-sindico` não vê o botão (ou vê
  desabilitado, com uma explicação — decisão de UI na implementação).

### AC-2: Tela de Grupos — listar, criar, editar
- **Dado** a tela de Grupos aberta por um `superadmin`/`supervisor`
- **Quando** ele cria um grupo novo, escolhendo nome, descrição, e um nível (nenhum/leitura/
  escrita) para cada um dos 9 módulos
- **Então** o grupo é criado (`config.grupos`+`grupo_modulos`) e aparece na lista.
- **E** editar um grupo existente atualiza as permissões dele — refletindo nos usuários
  vinculados a ele no próximo login/refresh (mesmo trade-off do `ADR-0003`/`ADR-0004`).

### AC-3: Tela de Usuários — listar, criar, editar, atribuir grupo ou permissão individual
- **Dado** a tela de Usuários aberta por um `superadmin`/`supervisor`
- **Quando** ele cria um usuário novo (email, senha, nome, papel) escolhendo o modo de permissão
  (grupo pré-criado OU grid individual de 9 módulos)
- **Então** a Edge Function `config-gerenciar-usuario` (de `E00-S09`) é chamada e o usuário passa
  a existir, já pronto para logar com a permissão certa.
- **E** editar um usuário existente permite trocar de modo (grupo↔individual) via
  `config.definir_permissao_usuario` — a UI nunca deixa o usuário num estado intermediário
  inválido (ex.: mostrar simultaneamente um grupo selecionado E um grid individual editável).

### AC-4: Sidebar esconde módulos sem permissão
- **Dado** um usuário autenticado cujo `user_modulos` (claim JWT) só contém `pcm: leitura`
- **Quando** a Home carrega
- **Então** a sidebar/tab-bar mostra só "Início" e "PCM" — os outros 8 módulos ficam ocultos.
- **E** um `superadmin` sempre vê todos os módulos, independente do claim `user_modulos`
  (que vem vazio para ele — a UI trata `papel === 'superadmin'` como bypass, igual à RLS).

## Casos de borda e erros
- Usuário sem `config.usuarios` (perfil ausente, caso já tratado por `E00-S05`/`ContaSemPerfilError`):
  sidebar não chega a renderizar módulo nenhum — o fluxo de login já bloqueia antes.
- Grid de permissão individual com todos os módulos "nenhum acesso": estado válido (usuário
  autenticado mas sem acesso a nenhum módulo de negócio) — não é erro, só não mostra nada além
  de "Início".

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Qualquer mudança de schema/RLS/hook — já feito em `E00-S09`, esta story só consome.
- Tela de "esqueci minha senha" ou fluxo de convite por e-mail — fora de escopo, mesmo non-goal
  de `E00-S05`.
- Granularidade menor que módulo inteiro na UI.

## Rastreabilidade
- Design técnico: `../E00-S09-grupos-permissao-modulo/design.md` (schema, resolver, hook, Edge
  Function — reaproveitados aqui)
- ADRs relacionados: `docs/adr/0004-permissoes-por-modulo-grupos.md`
