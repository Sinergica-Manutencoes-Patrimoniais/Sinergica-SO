---
name: spec
description: Contrato — Guia do SO deixa de tratar o Comercial como módulo planejado e passa a documentar cada tela real do CRM.
alwaysApply: true
---

# Spec — E03-S14 · Guia do SO: módulo Comercial

> **Fonte da verdade.** Status: pronto para implementar · Tier: **pequeno**
> **Última story do épico** — depende das telas que ela documenta estarem entregues.
> O Guia do SO é um módulo do próprio app (`apps/web/src/features/guia/`), não um documento à parte.

## Resumo
Hoje o Comercial aparece no Guia como **módulo planejado** (`PlanejadosGuia.tsx`), com uma
descrição de intenção que não corresponde ao que o E03 entregou. Esta story cria o
`ComercialGuia.tsx` real, no padrão do `FinanceiroGuia`, documentando cada opção da navegação — com
o teste que **impede o guia de envelhecer em silêncio**.

## Critérios de aceite

### AC-1: Comercial sai de "planejados"
- **Dado** o Guia do SO
- **Quando** o usuário abre a página do Comercial
- **Então** vê o guia real (`ComercialGuia.tsx` próprio), não o `PaginaPlanejada`; a função
  `ComercialGuia` sai de `PlanejadosGuia.tsx` e o import de `GuiaRouter.tsx` passa a apontar para
  o arquivo novo

### AC-2: Toda opção da navegação está documentada
- **Dado** os itens do módulo Comercial na sidebar
- **Quando** o guia é lido
- **Então** **cada** um tem entrada com `nome`, `paraQueServe`, `comoUsar` e `resultado` —
  no mesmo formato de `FinanceiroGuia.tsx`

### AC-3: Teste impede o guia de envelhecer
- **Dado** `ComercialGuia.test.ts` (padrão de `FinanceiroGuia.test.ts`)
- **Quando** o CI roda
- **Então** ele falha se qualquer opção da navegação do Comercial não estiver documentada — quem
  adicionar tela nova sem documentar quebra o build

### AC-4: Os conceitos que confundem estão explicados
- **Dado** o vocabulário novo do módulo
- **Quando** o usuário lê o guia
- **Então** encontra explicado, em linguagem de negócio:
  - **Conta** — lead, prospecto, cliente ativo e antigo são o mesmo cadastro
  - **Proposta × Orçamento de Serviço** — pré-venda que vira contrato × extra-contratual que vira OS
  - **Piso e desconto máximo** — por que o sistema recusa preço abaixo de um valor
  - **Etapas configuráveis** — e por que o motivo de perda é obrigatório

### AC-5: Visão geral atualizada
- **Dado** `VisaoGeralGuia.tsx`, que hoje lista o Comercial entre os "módulos planejados"
- **Quando** esta story conclui
- **Então** o Comercial aparece entre os que **já trabalham com dados reais**, junto de PCM,
  Atendimento, Financeiro e Área do Cliente

### AC-6: Integrações descritas do ponto de vista do usuário
- **Dado** que o Comercial conversa com outros módulos
- **Quando** o guia explica as conexões
- **Então** descreve, sem jargão de schema: lead do WhatsApp caindo no funil (Atendimento),
  levantamento reusando a inspeção do PCM, proposta aprovada pelo síndico no portal, e contrato
  ativado virando receita recorrente no Financeiro

### AC-7: Status honesto do que não entrou
- **Dado** os non-goals do épico (DOCX, assinatura eletrônica, geração de proposta por IA)
- **Quando** o usuário procura por eles
- **Então** o guia diz claramente que não existem — em vez de silenciar. O `AtendimentoGuia`
  (linha ~52) menciona que o lead vai "para o módulo Comercial": conferir e atualizar essa
  referência para o comportamento real

## Casos de borda e erros
- **Story do épico não implementada** (ex.: dashboard ficou para depois) → o guia documenta só o
  que existe; nada de descrever tela inexistente.
- **Usuário sem o módulo `comercial`** → o guia continua acessível (é documentação), mas indica que
  o acesso depende de permissão — comportamento já existente do Guia.

## Fora de escopo
- Reescrever os guias de outros módulos.
- Vídeo, tour guiado ou onboarding interativo.
- Documentação técnica (essa vive em `docs/`, `specs/` e ADRs — o Guia é para o usuário final).

## Rastreabilidade
- Épico: `../E03-S01-fundacao-comercial/product.md`
- Padrão: `apps/web/src/features/guia/FinanceiroGuia.tsx` + `FinanceiroGuia.test.ts`
- Arquivos afetados: `ComercialGuia.tsx` (novo), `PlanejadosGuia.tsx`, `GuiaRouter.tsx`,
  `VisaoGeralGuia.tsx`, `AtendimentoGuia.tsx`
- Origem do Guia: E01-S127
