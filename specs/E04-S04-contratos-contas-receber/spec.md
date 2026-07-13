---
name: spec
description: Contrato — cadastro de contratos por cliente, geração idempotente de recebíveis recorrentes, avulsos, baixa e aging/alertas de inadimplência.
alwaysApply: true
---

# Spec — E04-S04 · Contratos + contas a receber + inadimplência

> **Fonte da verdade.** Status: pronto para implementar · Tier: médio
> **Depende de: E04-S01.** Design do épico: `specs/E04-S01-fundacao-financeiro/design.md`
> (§S04 contrato das tabelas; D-4 recorrência; D-5 contratos nascem no Financeiro).
> Decisão do PO (2026-07-13): receita = **contrato mensal cadastrado + avulsos**; V1 controla
> **previsto + realizado** (vencimentos e alertas fazem parte do escopo).

## Resumo
Cadastro de contratos por cliente (valor mensal, vigência, dia de vencimento) que gera os
recebíveis do mês como lançamentos previstos — idempotente (rodar duas vezes não duplica), por
RPC chamável do botão da UI e do pg_cron do dia 1. Tela de Contas a Receber com aging
(D+3/D+7/D+15) e baixa manual (a conciliação OFX da S02 também baixa). O módulo Comercial (E03)
não existe; quando nascer, assume a origem do contrato (design D-5 — registrar ADR se divergir).

## Critérios de aceite

### AC-1: Cadastro de contrato
- **Dado** um usuário com `financeiro='escrita'`
- **Quando** cadastra um contrato (cliente de `pcm.clientes`, valor mensal em centavos, dia de
  vencimento 1–28, início, fim opcional, status)
- **Então** o contrato aparece na tela de Contratos com a receita mensal prevista somada no rodapé

### AC-2: Geração idempotente de recebíveis
- **Dado** contratos ativos numa competência
- **Quando** `financeiro.fn_gerar_recorrencias(competencia)` roda (pelo botão "Gerar previstos do
  mês" ou pelo pg_cron do dia 1)
- **Então** cada contrato ativo ganha exatamente 1 lançamento de entrada `previsto`
  (origem `recorrencia`, vencimento no dia do contrato, cliente/contrato preenchidos); rodar de
  novo não duplica (unique parcial `contrato_id, data_competencia`); contrato suspenso/encerrado
  não gera

### AC-3: Recebível avulso
- **Dado** um serviço extra-contratual (laudo, obra)
- **Quando** o usuário cria um lançamento de entrada `previsto` com cliente e vencimento
  (fluxo da S01)
- **Então** ele aparece em Contas a Receber junto dos recorrentes, sem precisar de contrato

### AC-4: Baixa e aging
- **Dado** recebíveis com vencimento
- **Quando** a tela Contas a Receber carrega
- **Então** agrupa: a vencer · vencido 1–3d · 4–7d · 8–15d · +15d (view/RPC
  `financeiro.aging_recebiveis`), com badge de alerta a partir de D+3 e ação de baixa
  (data de pagamento) por linha

### AC-5: Inadimplência por cliente
- **Dado** clientes com recebíveis vencidos
- **Quando** o usuário agrupa por cliente
- **Então** vê total em atraso, dias do mais antigo e % da carteira em atraso
  (indicador de inadimplência do ESCOPO-MESTRE §6.5); o dashboard (S03) passa a mostrar o KPI de
  inadimplência quando esta story fechar

### AC-6: Flag de bloqueio preparada
- **Dado** um contrato com `bloqueia_os_em_atraso=true` e recebível vencido
- **Quando** qualquer tela do Financeiro mostra esse contrato/cliente
- **Então** exibe aviso visual de "cliente em atraso com bloqueio contratual" — **sem** impedir
  nada no PCM (enforcement é story futura do PCM, fora deste épico)

## Fora de escopo
> Vinculante.
- Enforcement do bloqueio de OS no PCM (só a flag + aviso visual).
- Emissão de fatura/NF-e, boleto, cobrança automática por WhatsApp/e-mail (evoluções; alertas do
  V1 são visuais, dentro do sistema).
- Reajuste automático de contrato (campo/ação manual de editar valor resolve o V1).
- Multa/juros sobre atraso.

## Rastreabilidade
- Origem: ESCOPO-MESTRE §6.5 (Contas a Receber, alertas D+3/7/15, bloqueio opcional) + blueprint
  `docs/blueprint/04-financeiro.md` (inadimplência) + decisões do PO em `product.md` do épico.
- Tabelas/RPC: `financeiro.contratos`, unique parcial em `lancamentos`, `fn_gerar_recorrencias`,
  view `aging_recebiveis` — contrato em `specs/E04-S01-fundacao-financeiro/design.md` §S04/D-4.
- pg_cron: mesmo padrão de `0011`/`0013` (Vault) — ativar exige `pg_cron` habilitado no projeto
  (pendência operacional conhecida, já rastreada desde E01-S11).
- Arquivos-âncora: `pages/ContratosPage.tsx`, `pages/ContasReceberPage.tsx`, migration nova.
