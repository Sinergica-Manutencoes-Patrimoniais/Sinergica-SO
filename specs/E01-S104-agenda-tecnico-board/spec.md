---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Board semanal de agenda do técnico (cronograma de campo)

> **Fonte da verdade.** Status: rascunho
> Origem: reunião Fabrício × Lucas (2026-07-27). Item 13. Referência visual enviada pelo Fabrício.

## Resumo
Tela onde o operador cadastra **em que dia cada técnico vai a cada cliente**, com uma visão de
**board semanal**: colunas = dias da semana; dentro de cada dia, um card por técnico com o local
(cliente) que ele visita. **Primeira fase é apenas visual/manual** — não há alocação automática nem
motor de otimização.

## Referência visual (foto da reunião)
Board com 6 colunas (SEG 27/07 … SÁB 1/08), cada coluna com botão "+" no topo. Dentro de cada
coluna, uma lista de técnicos com marcador colorido por técnico e o local abaixo do nome. Exemplo:
coluna SEG mostra "Weslei Costa — I Home", "Davi Guedes — Living Elegance", "Dhiego Silva — Portal
Encantos de Parma", "Gabriel Aureliano — Portal Encantos de Parma". O mesmo técnico aparece em
todos os dias, cada dia com seu local.

## Decisões travadas (reunião)
- **Primeiro momento: só visual** ("no primeiro momento algo visual apenas"). Cadastro manual.
- É uma visão **sobre o técnico/funcionário**, distinta da Timeline do chamado (a Timeline é sobre
  o chamado). As duas cruzam informação, mas são telas diferentes.
- Localização vive em Colaboradores/Operação (não é a aba Timeline).

## Critérios de aceite

### AC-1: Visão semanal em colunas por dia
- **Dado** a tela de cronograma
- **Quando** exibida
- **Então** mostra a semana em colunas (uma por dia, seg–sáb), cada coluna com sua data no topo.

### AC-2: Cadastrar alocação técnico × dia × cliente
- **Dado** uma coluna de dia
- **Quando** o operador clica no "+" e escolhe técnico, cliente/local e hora
- **Então** um card aparece naquele dia com o técnico (marcador colorido) e o local; **e** a
  alocação é persistida.

### AC-3: Card por técnico com identidade visual
- **Dado** técnicos cadastrados
- **Quando** exibidos no board
- **Então** cada técnico tem cor/marcador consistente entre os dias, e o card mostra nome + local.

### AC-4: Editar/remover alocação
- **Dado** um card existente
- **Quando** o operador edita (troca cliente/hora) ou remove
- **Então** a alteração é persistida e refletida no board.

### AC-5: Navegar entre semanas
- **Dado** o board na semana atual
- **Quando** o operador avança/volta a semana
- **Então** o board mostra as alocações da semana selecionada.

## Casos de borda e erros
- Mesmo técnico com duas alocações no mesmo dia → **permitido** nesta fase (só visual; sem checagem
  de conflito). Ordenar por hora.
- Dia sem alocação → coluna vazia com "+" disponível.
- Técnico ou cliente inativo → não aparece no seletor de nova alocação.

## Fora de escopo
- Alocação automática / motor de "dias preventivos" por técnico (feature futura — já sinalizada como
  fora de escopo em E01-S07).
- Detecção/bloqueio de conflito de agenda.
- Sincronização automática com a data planejada do chamado/OS (pode vir depois; aqui é manual).
- App mobile / visão do técnico em campo.

## Rastreabilidade
- Código: Operação/Colaboradores em `apps/web/src/features/pcm/` (funcionários = técnicos).
- Cruza com data planejada do chamado (E01-S101) — leitura futura, não obrigatória no MVP.
- ADRs relacionados: —
