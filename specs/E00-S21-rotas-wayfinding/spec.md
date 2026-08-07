---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Rotas reais e wayfinding

> **Fonte da verdade.** Status: rascunho
> **Tier arquitetural** — exige `design.md` aprovado antes de qualquer implementação.
> Apple, *Principles of Great Design*: toda tela deve responder "onde estou, para onde posso ir,
> o que tem lá, como saio". Hoje o Sinérgica SO não responde nenhuma das quatro.

## Resumo
As 56 telas ganham URL própria, e o botão voltar do navegador, o F5 e o link compartilhado
passam a funcionar.

## Contexto medido (2026-08-07)
| Medida | Valor |
|--------|-------|
| Rotas declaradas em `App.tsx` | **3** (`/login`, `/`, `*`) |
| Telas (`*Page.tsx`) | **56** |
| Linhas de `HomePage.tsx` | **1312** |
| Imports de página dentro de `HomePage.tsx` | ~50 |
| Estados de sub-navegação por `useState` | `PcmView`, `FinanceiroView`, `AtendimentoView`, `GuiaView`, … |

Toda a navegação é `useState` dentro de um único componente de 1312 linhas. Consequências reais
hoje:

- Nenhuma tela tem endereço — impossível mandar "olha essa OS" para um colega
- O botão voltar do navegador **sai do sistema**
- F5 em qualquer tela devolve o usuário ao início
- Todo o código das 56 telas entra no mesmo bundle inicial
- Nenhum evento de analytics consegue distinguir tela

## Critérios de aceite

### AC-1: Toda tela tem URL própria e legível
- **Dado** qualquer uma das 56 telas
- **Quando** ela está aberta
- **Então** a barra de endereço mostra um caminho estável e semântico
  (`/pcm/ordens-servico`, `/financeiro/contas-receber`, `/atendimento/inbox`)
- **E** colar essa URL em outra aba, autenticado, abre exatamente a mesma tela

### AC-2: Registro selecionado também é endereçável
- **Dado** uma tela de detalhe (Visão 360 do cliente, OS, chamado, conversa)
- **Quando** um registro está aberto
- **Então** o identificador está na URL (`/pcm/clientes/:clienteId`,
  `/atendimento/inbox/:conversaId`)
- **E** recarregar reabre o mesmo registro

### AC-3: Voltar e avançar do navegador funcionam
- **Dado** o usuário navegando entre módulos e telas
- **Quando** aciona voltar
- **Então** retorna à tela anterior **dentro** do sistema, nunca sai dele
- **E** avançar refaz o caminho

### AC-4: Filtro relevante sobrevive à recarga
- **Dado** uma lista com filtros aplicados (status, período, cliente)
- **Quando** o usuário recarrega ou compartilha o link
- **Então** os filtros que mudam o que se vê estão em query string e são restaurados
- **E** estado efêmero (linha em hover, rascunho de campo) **não** vai para a URL

### AC-5: A rota respeita permissão, e o erro é claro
- **Dado** um usuário sem permissão no módulo
- **Quando** ele acessa a URL direta daquele módulo
- **Então** vê uma tela de acesso negado que **nomeia o módulo e a permissão exigida** — não uma
  tela vazia, não um redirecionamento silencioso
- **E** o gating por papel/permissão continua idêntico ao de hoje (`podeAcessar`)
- **E** URL inexistente cai numa tela 404 do produto com caminho de volta

### AC-6: Migalha e título respondem "onde estou"
- **Dado** qualquer tela
- **Então** existe migalha `Módulo › Seção › Registro` e o `document.title` acompanha
- **E** o item ativo do menu lateral é derivado da **rota**, não de `useState`

### AC-7: O bundle inicial encolhe
- **Dado** o build de produção
- **Quando** comparado ao atual
- **Então** cada módulo é carregado sob demanda (`React.lazy` por rota) e o bundle de entrada
  fica **abaixo de 60% do tamanho atual**
- **E** cada troca de módulo tem estado de carregamento (skeleton de E00-S17), nunca tela branca

### AC-8: `HomePage.tsx` deixa de ser um monólito
- **Dado** `apps/web/src/app/`
- **Quando** a story conclui
- **Então** `HomePage.tsx` tem **menos de 300 linhas** e não importa nenhuma página de feature
  diretamente — vira o layout (menu + chrome + `<Outlet />`)

## Casos de borda e erros
- Usuário `cliente-sindico` → continua indo para o `PortalShell`; o portal tem **árvore de rotas
  própria**, sem nenhum caminho interno alcançável (o gate anti-vazamento de bundle de E09-S11
  não pode regredir).
- Formulário sujo + navegação → o `nav-guard` existente precisa passar a interceptar a rota, não
  só a troca de `useState` (hoje é `nav-guard-context`).
- Sessão expira em rota profunda → após novo login, volta **para a rota que estava**, não para o
  início.
- Link antigo (sem rota) compartilhado → não existe URL antiga a preservar; nada a migrar.
- Deploy Netlify → SPA precisa de rewrite `/*  /index.html  200`, senão toda URL profunda dá 404
  no servidor.

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Renomear módulo, seção ou reorganizar o menu — o mapa de navegação atual é preservado; esta
  story só o expõe em URL.
- Renderização no servidor.
- Mudança de permissão ou de matriz de acesso.
- Rotas do portal do cliente além de garantir que continuam isoladas.

## Rastreabilidade
- Depende de: **E00-S17** (estado de carregamento das rotas preguiçosas)
- Bloqueia: transição entre rotas de E00-S19
- **Exige `design.md`** — mapa completo das 56 rotas, estratégia de code splitting, contrato do
  `nav-guard` e prova de isolamento do portal (E09-S11)
- Relacionado: E09-S11 (deploy separado do portal), `apps/web/src/app/nav-guard.ts`
