---
name: spec
description: Contrato — documentar o PCM como dono do Orçamento de Serviço, publicar view para o portal e fechar formalmente a E01-S14.
alwaysApply: true
---

# Spec — E03-S12 · Dono do Orçamento de Serviço + fechamento da E01-S14

> **Fonte da verdade.** Status: pronto para implementar · Tier: **pequeno**
> Independente das demais stories E03. Story majoritariamente de **documentação e fronteira** —
> quase sem código novo, mas fecha um buraco de rastreio real.

## Resumo
A E09-S09 implementou o "Fluxo B" (`pcm.requisicoes_servico`, `orcamentos_servico`,
`orcamento_decisoes` + RPC de aceite que gera OS) sem que o ROADMAP registrasse — a E01-S14 ficou
marcada como "bloqueada" por mais de um mês enquanto o código já rodava em produção. Esta story
documenta o dono, publica a interface de leitura para o portal (R2) e fecha a E01-S14.

## Critérios de aceite

### AC-1: Dono documentado
- **Dado** `pcm.requisicoes_servico`, `pcm.orcamentos_servico` e `pcm.orcamento_decisoes`
- **Quando** a documentação é atualizada
- **Então** `ARCHITECTURE.md` registra o **PCM como dono** (o portal é canal de escrita, não dono —
  corolário do ADR-0019) e o `comment on table` de cada uma aponta a story de origem (E09-S09) e a
  decisão 10 do épico E03

### AC-2: Orçamento ≠ Proposta no glossário
- **Dado** os dois conceitos
- **Quando** alguém consulta o glossário
- **Então** encontra **Orçamento de Serviço** (extra-contratual, cliente ativo, gera OS, mora no
  PCM) claramente distinto de **Proposta** (pré-venda, gera contrato, mora no Comercial) e de
  **Orçamento (anual)** (budget do Financeiro) — os três já redigidos nesta sessão, esta story
  confirma que batem com o código

### AC-3: Portal lê por view
- **Dado** que o portal hoje acessa as tabelas do Fluxo B
- **Quando** esta story roda
- **Então** existe view de consumo publicada pelo PCM (padrão `financeiro.portal_faturas`), com
  `security_invoker` e **`grant select` explícito**, e o portal passa a usá-la — sem alterar o
  comportamento visível ao síndico

### AC-4: E01-S14 formalmente encerrada
- **Dado** a linha da E01-S14 no ROADMAP
- **Quando** esta story conclui
- **Então** ela está marcada como resolvida pela E09-S09, com a alternativa arquitetural escolhida
  registrada (`pcm.orcamentos_servico`, não `comercial.orcamentos`), e o `design.md` da E01-S14
  ganha nota de fechamento apontando para cá — nenhuma das duas perguntas de negócio que a
  bloqueavam continua "aberta" num documento vivo

### AC-5: Nenhuma mudança de comportamento
- **Dado** o fluxo de orçamento em produção
- **Quando** esta story é aplicada
- **Então** o síndico continua vendo, aprovando e recusando exatamente como antes; a RPC de
  decisão e a geração de OS não são tocadas

## Casos de borda e erros
- **View divergindo da tabela** → a view é derivada, sem regra própria; qualquer filtro nela
  precisa espelhar o que o portal já aplicava.
- **Portal quebrar por falta de `grant`** → é o bug real da E04-S04 (migration `0110`); o
  `grant select` explícito é obrigatório.

## Fora de escopo
- **Mover as tabelas para outro schema** — a análise da §5.1 do design descartou.
- **Unificar Orçamento de Serviço com Proposta** — decisão 10: são duas entidades.
- **Alterar a RPC de decisão ou a geração de OS** (AC-5).

## Rastreabilidade
- Épico: `../E03-S01-fundacao-comercial/product.md` (decisão 10) · `design.md` §5.1
- Fecha: `../E01-S14-fluxo-b-orcamento/design.md`
- Implementação existente: `supabase/migrations/0144_E09-S09_portal_orcamentos.sql`
