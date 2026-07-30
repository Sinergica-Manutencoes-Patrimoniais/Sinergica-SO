---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Fix: modal perde dados ao trocar de aba/tela do PCM

> **Fonte da verdade.** Status: rascunho
> Origem: feedback do Lucas testando localmente (2026-07-29). Item 2. Reabre a investigação de
> E01-S101 AC-6 (lá eu não tinha reproduzido — investiguei só o modal errado).

## Causa raiz confirmada
`HomePage.tsx` troca de página inteira conforme `pcmView` (ex.: `pcmView === "chamados" ? <ChamadosPage /> : ...`).
Qualquer modal aberto **dentro** de uma página do PCM (ex.: `NovoChamadoModal`/`GerarOsModal` em
`ChamadosPage.tsx`, `ClienteFormModal`/`ResponsavelModal`/`AlocarFerramentaModal` em
`VisaoClientePage.tsx`) é filho dessa página — ao trocar `pcmView` (clicar em outro item do menu
PCM), a página antiga desmonta e o modal (com tudo que o operador digitou) é destruído junto.
`NovaOrdemServicoModal` **não** tem esse problema porque é renderizado fora do switch, direto em
`HomePage.tsx` (por isso não reproduzi da primeira vez — testei só esse).

## Resumo
Antes de trocar de `pcmView` (ou de aba dentro de uma página, se aplicável) com um modal aberto e
com conteúdo digitado, o sistema avisa e pede confirmação — nunca descarta silenciosamente.

## Critérios de aceite

### AC-1: Aviso ao trocar de página com modal aberto e sujo
- **Dado** um modal aberto dentro de uma página do PCM (Chamados, Visão do Cliente, etc.) com pelo
  menos um campo alterado em relação ao estado inicial
- **Quando** o operador clica em outro item do menu PCM (mudando `pcmView`)
- **Então** aparece uma confirmação ("Você tem alterações não salvas. Sair mesmo assim?") antes de
  navegar; cancelar mantém o operador na tela com o modal e os dados intactos.

### AC-2: Sem alterações, navega direto
- **Dado** um modal aberto mas sem nenhuma alteração (formulário no estado inicial)
- **Quando** o operador troca de página
- **Então** navega sem perguntar nada (não incomoda à toa).

### AC-3: Confirmando a saída, descarta de propósito
- **Dado** o aviso de AC-1
- **Quando** o operador confirma que quer sair
- **Então** a navegação ocorre normalmente e o modal/dados são descartados (era a intenção).

## Casos de borda e erros
- Modal de confirmação de ação destrutiva já aberto (ex.: "Cancelar Chamado") em cima de outro modal
  — fora de escopo aprofundar, cobre só o caso comum de 1 modal por vez.
- Fechar o modal pelo X/Cancelar continua sem aviso — o aviso é só pra navegação que destrói sem o
  operador ter clicado em fechar/cancelar explicitamente.

## Fora de escopo
- Persistir rascunho do formulário (ex.: localStorage) pra recuperar depois — só evita a perda por
  navegação acidental, não guarda pra sempre.
- Mudar a arquitetura de `pcmView` pra manter páginas montadas em background (custo maior, não
  necessário pra resolver o problema relatado).

## Rastreabilidade
- Código: `HomePage.tsx` (troca de `pcmView`), modais afetados em `ChamadosPage.tsx`,
  `VisaoClientePage.tsx` e outras páginas do PCM com modal interno.
- ADRs relacionados: —
