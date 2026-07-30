---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Nav: "Backlog GUT" e "Ordens de Serviço" viram submenu de "Chamados"

> **Fonte da verdade.** Status: rascunho
> Origem: feedback do Lucas testando localmente (2026-07-29). Itens 11 e 12. Reflete o mesmo tema
> de unificação da E01-S99/S101: Chamado é a entidade ponta a ponta, Backlog e OS são fases dela.

## Resumo
No menu OPERAÇÃO do PCM, "Ordens de Serviço" e "Backlog GUT" deixam de ser itens de primeiro nível
e viram subitens dentro de "Chamados" — reflete o fluxo real (Chamado → GUT/Backlog → OS).

## Critérios de aceite

### AC-1: Estrutura de submenu
- **Dado** o menu OPERAÇÃO do PCM
- **Quando** o operador olha a navegação
- **Então** "Chamados" aparece como item expansível, com "Ordens de Serviço" e "Backlog GUT" como
  subitens dentro dele (mesmo padrão visual de outros grupos existentes, se houver submenu na
  sidebar — senão, definir um padrão simples de indentação/expand-collapse).

### AC-2: Navegação direta preservada
- **Dado** um subitem (ex.: "Backlog GUT")
- **Quando** o operador clica
- **Então** navega pra `pcmView === "backlog"` exatamente como hoje — só a posição no menu muda,
  nenhuma rota/view é renomeada.

### AC-3: Estado do menu (expandido/colapsado) é previsível
- **Dado** o operador em `pcmView === "ordens"` ou `"backlog"`
- **Quando** a página carrega
- **Então** o submenu "Chamados" já aparece expandido (contexto ativo visível, sem precisar clicar
  pra achar onde está).

## Fora de escopo
- Mudar `PcmView`/nomes internos de rota.
- Adicionar sub-navegação em outros grupos do menu (Cadastros, Configurações, etc.) — só o grupo
  Chamados/Backlog/OS.

## Rastreabilidade
- Código: `PCM_NAV` em `HomePage.tsx` (hoje é lista plana de `NavItem`; precisa suportar item com
  filhos).
- ADRs relacionados: —
