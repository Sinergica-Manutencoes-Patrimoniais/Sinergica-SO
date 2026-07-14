---
name: product
description: PRD — módulo Financeiro completo (E04, 6 stories). Visão de produto, telas, personas e decisões do PO. Leia antes de implementar qualquer story E04.
alwaysApply: false
---

# Product — Módulo Financeiro (épico E04)

> **Tier:** arquitetural (novo bounded context) · **Status:** aprovado pelo PO (Lucas, 2026-07-13)
> Este PRD cobre o **módulo inteiro** (E04-S01 a E04-S06). Cada story tem `spec.md`/`tasks.md`
> próprios e **auto-contidos** — qualquer sessão/LLM pega uma story e implementa sem depender da
> conversa que originou este documento.

## Problema (dor L2/L6 do `docs/ESCOPO-MESTRE.md`)
A Sinérgica não sabe se cada contrato é lucrativo — o custo real (mão de obra + materiais +
deslocamento) é desconhecido. O faturamento é manual, não há fluxo de caixa nem controle de
inadimplência. O contrato do projeto (ESCOPO-MESTRE §6.5) pede: contas a receber, faturamento,
contas a pagar, fluxo de caixa, conciliação e custo & rentabilidade.

## Para quem
- **Time financeiro (colaborador/supervisor com módulo `financeiro`):** inputa lançamentos,
  classifica extrato importado, cadastra contratos/fornecedores/custos de pessoal, dá baixa.
- **Dono/gestão (superadmin):** vê posição de caixa hoje e projetada, entradas × saídas, gasto por
  categoria, margem por cliente/contrato, inadimplência, custo da hora técnica.
- **Síndico (cliente):** NÃO acessa nada neste épico — visão financeira do portal é E09 (decisão
  D5 do ESCOPO-MESTRE; apenas não bloquear a criação futura de views dedicadas).

## Decisões do PO (Lucas, 2026-07-13) — vinculantes
1. **Caixa primeiro.** Ordem de entrega: lançamentos + OFX + dashboard (leva 1) → previsto/
   vencimentos (leva 2) → rentabilidade (leva 3).
2. **Custo/hora por funcionário.** O financeiro cadastra custo mensal (salário + encargos +
   benefícios) por funcionário; o sistema deriva R$/hora. Nem taxa única global, nem por cargo.
3. **Receita = contrato mensal cadastrado + entradas avulsas** classificadas por cliente. Cobre
   recorrente e extra-contratual.
4. **Previsto + realizado no V1.** Vencimentos, alertas de atraso (D+3/D+7/D+15) e projeção de
   caixa 30/60/90 fazem parte do escopo — não é só registro do passado.

## Decisões herdadas do projeto (não rediscutir)
- **Conciliação por importação OFX** (upload manual do arquivo do banco). **Sem Open Finance /
  integração bancária direta no V1** (ESCOPO-MESTRE §11 D3).
- **NF-e é integração futura**, nunca reconstrução (D8). Fora deste épico.
- **Financeiro do Auvo foi descartado** (decisão jul/2026 registrada no ESCOPO-MESTRE §7): o ciclo
  financeiro vive no Sinérgica SO. Do Auvo só entram **custos** (despesas de campo, horas).
- **Módulo Comercial (E03) ainda não existe.** O cadastro de contratos nasce no Financeiro como
  fonte de receita recorrente; quando o E03 nascer, ele vira a origem e o Financeiro passa a
  referenciá-lo (registrado como risco no `design.md`).

## Protótipo navegável (mockup, sem backend)
`apps/web/src/features/financeiro/mock/` — integrado dentro do próprio Sinérgica SO: clique na aba
"Financeiro" do app real (mesma sidebar/topbar/tema/autenticação) e navega pelas 10 telas abaixo
com dados fictícios (`mock-data.ts`, hardcoded, zero leitura de banco). Banner fixo "dados
fictícios" no topo de toda tela do módulo. Feito pra Lucas/Fabrício/Aline navegarem e darem
feedback de produto antes de qualquer implementação real — **não é código de referência pra
copiar quando a E04 for implementada de verdade** (sem hexagonal, sem tipos de domínio, é só
front estático plugado no roteamento por `useState` de `HomePage.tsx`, mesmo padrão do PCM/
Atendimento). Substitui a versão anterior como página estática em `apps/web/public/mockups/` —
removida em favor da experiência integrada.

## As 10 telas do módulo

| # | Tela | O que faz | Story |
|---|------|-----------|-------|
| 1 | **Dashboard Financeiro** | KPIs (posição de caixa, entradas/saídas do mês, resultado, a receber/pagar 30d) + gráficos (fluxo mensal 12m, gasto por categoria, evolução de saldo, previsto × realizado) | S03 (+S05 projeção) |
| 2 | **Lançamentos** | Lista com filtros (período, tipo, categoria, conta, cliente, status) + criar/editar entrada/saída. Ciclo: `previsto → realizado → conciliado` | S01 |
| 3 | **Categorias (plano de contas)** | Árvore de 2 níveis, tipo entrada/saída, seed inicial do ramo de manutenção predial, editável | S01 |
| 4 | **Contas bancárias** | Cadastro (nome, banco), saldo inicial, saldo atual calculado | S01 |
| 5 | **Importar extrato (OFX)** | Upload → prévia → dedupe (FITID) → classificação sugerida por regras → conciliar com lançamento previsto ou criar lançamento | S02 |
| 6 | **Contas a receber** | Recebíveis do contrato (recorrentes) + avulsos; baixa manual ou via conciliação; aging D+3/7/15 | S04 |
| 7 | **Contratos** | Por cliente: valor mensal, vigência, dia de vencimento, status; gera previsão de receita recorrente | S04 |
| 8 | **Contas a pagar** | Fornecedores, vencimentos, recorrência de despesa fixa, baixa | S05 |
| 9 | **Rentabilidade por cliente** | Receita − custo real (horas Auvo × R$/h + despesas de campo), margem %, alerta de 2 meses negativos, drill-down por OS | S06 |
| 10 | **Custos de pessoal** | Custo mensal + horas-base por funcionário → R$/h derivado, com histórico de vigência | S06 |

## Stories e dependências

```
Leva 1 (caixa):        S01 fundação ──► S02 import OFX ──► S03 dashboard
Leva 2 (previsto):     S04 contratos+receber (dep. S01) ──► S05 pagar+projeção (dep. S01, S03)
Leva 3 (margem):       S06 rentabilidade (dep. S01, S04)
```

| Story | Diretório | Tier |
|-------|-----------|------|
| E04-S01 Fundação caixa (schema + lançamentos + categorias + contas) | `specs/E04-S01-fundacao-financeiro/` | Arquitetural |
| E04-S02 Import OFX + regras de classificação + conciliação | `specs/E04-S02-import-ofx/` | Pequeno |
| E04-S03 Dashboard de caixa (KPIs + gráficos) | `specs/E04-S03-dashboard-caixa/` | Pequeno |
| E04-S04 Contratos + contas a receber + inadimplência | `specs/E04-S04-contratos-contas-receber/` | Médio |
| E04-S05 Contas a pagar + projeção de caixa | `specs/E04-S05-contas-pagar-projecao/` | Pequeno |
| E04-S06 Rentabilidade por cliente/contrato + custo/hora | `specs/E04-S06-rentabilidade-cliente/` | Médio |

## Resultado esperado / métricas de sucesso
- Time financeiro registra 100% das entradas/saídas no sistema (hoje: 0% — não existe sistema).
- Extrato bancário conciliado mensalmente com < 30 min de trabalho manual (import OFX + regras).
- Margem por cliente/contrato visível por mês — indicador que "muda o jogo" (D3) — com alerta de
  margem negativa 2 meses consecutivos.
- Dono responde "como fecha o mês?" olhando a projeção de caixa, sem planilha paralela.

## Non-goals do épico (vinculante)
- Emissão de NF-e (D8 — integração futura, story própria quando priorizada).
- Open Finance / conexão bancária automática (D3).
- Portal do síndico — situação financeira (D5, épico E09).
- Folha de pagamento (só o custo mensal consolidado por funcionário, para custo/hora).
- Enforcement do bloqueio de novas OS por inadimplência (a flag existe no contrato; o bloqueio no
  fluxo de OS é story futura do PCM, decidida com o PO).
- Espelhar Financeiro/Orçamentos do Auvo (descartado jul/2026; ver também E01-S17 bloqueada).

## Riscos / premissas
- Premissa: horas reais por OS vêm de `pcm.ordens_servico.auvo_detalhes` (populado desde
  E01-S38/S44 — 2.177 OS com duração em produção). Confirmar chaves reais do jsonb na S06.
- Premissa: despesas de campo vêm de `pcm.despesas` (E01-S54, migration `0079`). O endpoint
  `/expenses` do Auvo respondia 500 server-side em 2026-07-11 (chamado com o suporte Auvo
  pendente) — a rentabilidade funciona sem, e soma automaticamente quando o pull destravar.
- Risco: contratos cadastrados no Financeiro podem divergir do futuro módulo Comercial (E03) —
  mitigação no `design.md` (tabela pensada para virar referência do E03).
