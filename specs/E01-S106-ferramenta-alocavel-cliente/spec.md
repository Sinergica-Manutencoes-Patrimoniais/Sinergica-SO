---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Ferramenta alocável em um cliente

> **Fonte da verdade.** Status: rascunho
> Origem: reunião Fabrício × Lucas (2026-07-27). Item 16.

## Resumo
Permitir que uma **ferramenta** (item do inventário da Sinérgica) seja **alocada a um cliente** —
registrando que aquela ferramenta está no local do cliente (emprestada/em uso naquele condomínio).

## Contexto
- Reutiliza a estrutura de cadastro de itens/equipamentos já existente (Board de Ativos —
  E01-S76/S77/S78/S79, `EquipamentoModal` compartilhado).
- Distinção: equipamento **do cliente** (ativo do condomínio) vs. **ferramenta da Sinérgica**
  alocada temporariamente a um cliente. Esta story trata da segunda.

## Critérios de aceite

### AC-1: Alocar ferramenta a um cliente
- **Dado** uma ferramenta cadastrada no inventário
- **Quando** o operador aloca a ferramenta a um cliente
- **Então** o vínculo ferramenta↔cliente é persistido, com data de alocação.

### AC-2: Ver ferramentas alocadas por cliente
- **Dado** um cliente com ferramentas alocadas
- **Quando** o operador abre o cliente
- **Então** vê a lista de ferramentas atualmente alocadas a ele.

### AC-3: Desalocar / devolver
- **Dado** uma ferramenta alocada
- **Quando** o operador registra a devolução
- **Então** o vínculo é encerrado (com data de devolução), e a ferramenta fica disponível de novo.

### AC-4: Uma ferramenta em um cliente por vez
- **Dado** uma ferramenta já alocada a um cliente
- **Quando** o operador tenta alocá-la a outro cliente sem devolver
- **Então** o sistema impede ou exige a devolução antes (não fica alocada a dois clientes ao mesmo tempo).

## Casos de borda e erros
- Ferramenta inexistente/inativa → não aparece no seletor de alocação.
- Histórico de alocações → manter registro (auditável) das alocações passadas.

## Fora de escopo
- Controle de manutenção/calibração da ferramenta.
- Gestão de estoque/quantidade (E05 — Operação · Estoque).

## Rastreabilidade
- Código: cadastro de ativos/equipamentos em `apps/web/src/features/pcm/` (Board de Ativos).
- ADRs relacionados: —
