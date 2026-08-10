---
name: spec
description: Contrato — reavaliação de atendimento.historico_chamado_snapshots à luz do R1; confirmar o Atendimento como dono e documentar, sem mover a tabela.
alwaysApply: true
---

# Spec — E03-S13 · `historico_chamado_snapshots`: confirmar dono e documentar

> **Fonte da verdade.** Status: pronto para implementar · Tier: **trivial**
> Independente das demais stories E03. **Escopo reduzido durante a especificação** — ver abaixo.

## Resumo

Esta story nasceu na auditoria de 2026-08-10 classificada como violação de R1
("`atendimento.historico_chamado_snapshots` criada pelo PCM"). **Ao ler a migration de origem, a
classificação se mostrou errada** e o escopo virou confirmação documental.

`0136_E01-S89_historico_chamado_snapshots.sql` já declara a escolha e a justifica:

> *"tabela nova vive no schema de quem **PRODUZ** o dado (atendimento), com FK direta pro schema
> pcm — nenhum import de código entre as features, só a FK no banco"*

O snapshot **é conversa de WhatsApp** — dado do Atendimento, anexado a um Chamado do PCM. Pelo R1
(dono = quem governa o ciclo de vida da entidade), o Atendimento é dono e o schema está correto. O
que induziu ao erro foi o **épico da story** (E01/PCM) ser diferente do **dono do dado** — épico de
origem não determina propriedade.

## Critérios de aceite

### AC-1: Dono confirmado e documentado
- **Dado** `atendimento.historico_chamado_snapshots`
- **Quando** a documentação é atualizada
- **Então** `ARCHITECTURE.md` registra a tabela como **Core do Atendimento** (removendo-a da lista
  de dívida de fronteira), com nota de que a story de origem pertence ao épico E01 mas o dono do
  dado é o Atendimento

### AC-2: A regra ganha o critério que faltava
- **Dado** o ADR-0019
- **Quando** alguém for classificar propriedade no futuro
- **Então** o ADR registra explicitamente que **épico de origem da story não determina o dono** —
  o teste é sempre R1 (quem produz o dado e governa seu ciclo de vida), e este caso fica
  documentado como exemplo

### AC-3: Leitura cruzada continua legítima
- **Dado** que PCM e Atendimento leem a tabela (`supabase-chamados-adapter.ts` e
  `supabase-historico-chamado-adapter.ts`)
- **Quando** a fronteira é avaliada
- **Então** a leitura do PCM é registrada como consumo cross-schema **aceito** — a RLS já permite
  quem vê o Chamado (módulo `pcm`) **ou** quem vê a conversa (módulo `atendimento`), e nenhuma
  feature importa código da outra, só compartilha a tabela pelo banco

### AC-4: Nada é movido
- **Dado** a tabela em produção
- **Quando** esta story conclui
- **Então** nenhuma migration de schema roda: sem mover, sem renomear, sem view nova — só
  `comment on table` e documentação

## Casos de borda e erros
- **Se a leitura do PCM crescer** a ponto de precisar de contrato estável, a resposta é o
  Atendimento publicar uma view (R2), não mover a tabela. Registrar como opção futura, não fazer.

## Fora de escopo
- **Mover a tabela para `pcm.*`** — a análise descartou.
- **Criar view de consumo agora** — só se a leitura direta vier a incomodar de verdade (AC-4).
- **Alterar RLS, grants ou o comportamento do anexo de histórico.**

## Rastreabilidade
- Épico: `../E03-S01-fundacao-comercial/design.md` §5
- ADR-0019 — item 4 da "Dívida de fronteira" (removido por esta story) e corolário
  "canal ≠ propriedade"
- Origem: `supabase/migrations/0136_E01-S89_historico_chamado_snapshots.sql` (E01-S89)
