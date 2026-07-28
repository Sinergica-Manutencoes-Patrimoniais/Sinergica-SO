---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Tela de abertura de chamado com os campos da OS + descrição completa

> **Fonte da verdade.** Status: rascunho
> Origem: reunião Fabrício × Lucas (2026-07-27). Itens 11 e 6.

## Resumo
A tela de abertura de chamado já nasce com **os mesmos campos necessários para abrir uma OS**,
porque o chamado é tratado e depois vira OS — não deve existir um segundo formulário para
"completar" campos. Inclui as **três datas** do ciclo (abertura, planejada, execução) e a
visualização da **descrição completa** (Solicitação + Local) ao clicar no chamado.

## Decisões travadas (reunião)
- Campos essenciais para abrir chamado: **solicitação (texto livre)**, **local**, **cliente**,
  **solicitante**, **data de abertura**, **data de planejamento**.
- **Três datas** (confirmado):
  - **Data de abertura** — quando o cliente abriu/interagiu. **Conta o SLA.**
  - **Data planejada** — quando pretende-se enviar o técnico. **Pode ser replanejada várias vezes;
    NÃO conta SLA.** Contar quantas vezes foi replanejada é desejável (métrica).
  - **Data de execução (real)** — quando foi de fato executado. Conta o SLA (abertura → execução).
- Ao clicar no chamado, ver a descrição completa: **Solicitação** e **Local** (item 6).
- Ter data e técnico definidos é o que transforma o chamado em OS (regra do fluxo — E01-S99/S88).

## Critérios de aceite

### AC-1: Formulário de abertura com campos da OS
- **Dado** o operador abrindo um novo chamado
- **Quando** o formulário é exibido
- **Então** ele contém: cliente, solicitante, solicitação (texto livre), local, data de abertura e
  data de planejamento — os mesmos campos necessários para a futura OS, num único formulário.

### AC-2: Data de abertura registrada e imutável para SLA
- **Dado** um chamado sendo criado
- **Quando** ele é salvo
- **Então** a data de abertura é a data/hora da interação do cliente e é a âncora do SLA; **e** ela
  não muda em replanejamentos.

### AC-3: Data planejada replanejável, sem afetar SLA
- **Dado** um chamado com data planejada
- **Quando** a data planejada é alterada
- **Então** o SLA (abertura → execução) não é afetado; **e** o sistema registra o número de
  replanejamentos (contador incrementa a cada alteração da data planejada).

### AC-4: Data de execução separada
- **Dado** um chamado/OS executado
- **Quando** a execução é registrada
- **Então** a data de execução (real) é gravada distintamente da planejada, e o SLA é medido como
  diferença entre abertura e execução.

### AC-5: Ver descrição completa ao clicar no chamado
- **Dado** um chamado na lista/board
- **Quando** o operador clica nele
- **Então** o detalhe mostra a **Solicitação** (texto livre) e o **Local** de forma legível
  (não truncado), além dos demais campos.

### AC-6: Persistência entre abas do modal
- **Dado** o modal de chamado com abas
- **Quando** o operador troca de aba e volta
- **Então** os dados preenchidos permanecem (não somem) — corrige a regressão observada na reunião
  (item 8 da lista).

## Casos de borda e erros
- Local não informado → permitido (não bloqueia; técnico descobre em campo — coerente com E02-S23).
- Data planejada anterior à abertura → validar e avisar (não é erro fatal, mas sinalizar).
- Data de execução antes da abertura → bloquear (inconsistente).

## Fora de escopo
- Conversão em OS e integração Auvo (E01-S99).
- Cálculo detalhado de SLA emergencial (E01-S100).
- GUT / priorização (já existe — E01-S82/S94).

## Rastreabilidade
- Código: `apps/web/src/features/pcm/pages/ChamadosPage.tsx`, domínio `chamados.ts`.
- Depende de E01-S99 (chamado como ID ponta a ponta) para semântica das datas.
- ADRs relacionados: —
