---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Agenda do Técnico: visão timeline por técnico

> **Fonte da verdade.** Origem: Lucas (2026-08-10, print da Agenda do Técnico). "Na agenda do
> técnico crie visão de timeline por técnico."

## Contexto de código
- `pages/AgendaTecnicoPage.tsx` (E01-S104/S112): hoje só tem a visão em **board por dia** — colunas
  seg-sáb, cada coluna lista as alocações (técnico+cliente+horário) daquele dia.
- `domain/agenda-tecnico.ts`: `AlocacaoTecnico` (funcionarioId, funcionarioNome, clienteId,
  clienteNome, data ISO, horaInicio/horaFim), `agruparPorDia` (agrupa por dia), `diasDaSemana`,
  `corDoTecnico` (cor estável por técnico, já usada nos cards do board).
- `application/agenda-tecnico.ts`: `listarSemanaAgenda`, `listarOpcoesAgenda`, `criarAlocacao`,
  `editarAlocacao`, `removerAlocacao` — reusados sem mudança (mesma fonte de dados da semana).
- Padrão de referência para "agrupar por técnico": `domain/ordens-servico.ts` `agruparPorTecnico`
  (Kanban de OS, E01-S38) — "Sem técnico" sempre por último, demais em ordem alfabética.

## Resumo
A visão atual responde "quem está em que cliente **neste dia**". A nova visão timeline responde
"onde o **técnico X** está **ao longo da semana**" — uma linha por técnico, uma coluna por dia
(seg-sáb), útil pra ver de vez a semana inteira de uma pessoa e achar buracos/conflitos. As duas
visões coexistem: um toggle no topo da página alterna entre "Por dia" (atual, vira o default) e
"Por técnico" (nova). Mesma semana, mesmos dados, mesmas ações (criar/editar/remover alocação) —
só muda o agrupamento visual.

## Critérios de aceite

### AC-1: Toggle entre as duas visões
- **Dado** a página Agenda do Técnico
- **Quando** o operador abre a tela
- **Então** vê um controle (toggle/abas) "Por dia" / "Por técnico"; "Por dia" é o estado inicial
  (comportamento atual preservado).

### AC-2: Timeline — uma linha por técnico
- **Dado** a visão "Por técnico" ativa, com alocações na semana carregada
- **Então** cada técnico com pelo menos uma alocação na semana vira uma linha; cada linha tem 6
  colunas (seg-sáb, mesmos dias da visão por dia); cada célula lista as alocações daquele
  técnico naquele dia (cliente + horário, quando houver).
- Técnicos sem nenhuma alocação na semana **não** aparecem na timeline (lista só quem tem
  trabalho alocado — evita linha vazia pra cada funcionário cadastrado).
- Ordenação das linhas: alfabética pelo nome do técnico.

### AC-3: Célula vazia
- **Dado** um técnico com alocação em alguns dias da semana mas não em todos
- **Então** as células dos dias sem alocação mostram um estado vazio claro (ex.: "—" ou "Sem
  alocação"), sem quebrar o grid.

### AC-4: Cor por técnico consistente entre as duas visões
- **Dado** a mesma semana vista em "Por dia" e em "Por técnico"
- **Então** a cor associada a cada técnico é a mesma nas duas visões (reusa `corDoTecnico`).

### AC-5: Ações preservadas
- **Dado** a visão "Por técnico"
- **Quando** o operador clica numa alocação existente ou no "+" de uma célula vazia
- **Então** abre o mesmo modal de criar/editar alocação já usado na visão "Por dia" (mesmas
  permissões: só quem tem escrita em `pcm` vê os controles de edição).

### AC-6: Navegação de semana preservada
- **Dado** a visão "Por técnico" ativa
- **Quando** o operador navega para semana anterior/seguinte/hoje
- **Então** a timeline recarrega pra nova semana, mesmo comportamento de navegação da visão atual.

## Casos de borda e erros
- Semana sem nenhuma alocação: timeline mostra estado vazio (mensagem, sem tabela quebrada) — igual
  ao vazio da visão por dia.
- Alocação sem `horaInicio`/`horaFim` (permitido hoje): célula mostra só o nome do cliente, sem
  horário — mesmo comportamento do card na visão por dia.
- Muitos técnicos (linhas) ou tela estreita: grid com scroll horizontal/vertical próprio, sem
  quebrar o layout da página (ver `overflow-x-auto` já usado em outras telas do PCM).

## Fora de escopo
- Granularidade por hora (timeline tipo calendário com eixo de horas) — é célula por dia, não por
  hora. Se precisar depois, é story nova.
- Alocação automática ou checagem de conflito de horário — herdado do "fora de escopo" de E01-S104,
  continua valendo.
- Mudar a fonte de dados ou o modelo de `AlocacaoTecnico` — é só uma segunda visão dos mesmos dados.

## Rastreabilidade
- Código: `pages/AgendaTecnicoPage.tsx`, `domain/agenda-tecnico.ts` (nova função de agrupamento por
  técnico), `application/agenda-tecnico.ts` (sem mudança).
- Reusa: E01-S104 (board por dia, dados e modal), E01-S112 (horaInicio/horaFim).
- ADRs relacionados: —
