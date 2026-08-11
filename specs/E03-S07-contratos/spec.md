---
name: spec
description: Contrato — comercial.contratos gerado da proposta aceita, alimentando o plano de faturamento do Financeiro e o preventivo do PCM.
alwaysApply: true
---

# Spec — E03-S07 · Contratos

> **Fonte da verdade.** Status: pronto para implementar · Tier: **arquitetural**
> (cruza três contextos: Comercial → Financeiro e Comercial → PCM)
> Depende de **E03-S04/S06**. Decisão 9 do PO: **Comercial é dono do contrato**; o Financeiro
> consome. ADR-0019 (R1/R2) rege as fronteiras.

## Resumo
Cria `comercial.contratos` — o **acordo** fechado a partir da proposta aceita (tipo, vigência,
reajuste, escopo, sistemas cobertos). Ao ser ativado, ele cria o **plano de faturamento** no
Financeiro e sinaliza o PCM para iniciar o preventivo. É o ponto em que o funil vira operação.

## Critérios de aceite

### AC-1: Schema com RLS FORCE
- **Dado** a migration aplicada (`comercial.contratos` — contrato de colunas em `design.md` §2.4)
- **Quando** um usuário sem `comercial` consulta
- **Então** zero linhas; `leitura` lê; `escrita`/superadmin faz CRUD — provado por pgTAP

### AC-2: Contrato nasce da proposta aceita
- **Dado** uma proposta com status `aceita`
- **Quando** o usuário com `escrita` gera o contrato
- **Então** o contrato é criado com `proposta_id`, `cliente_id`, tipo
  (`residente`/`volante`/`avulso`), valor mensal, vigência e escopo pré-preenchidos a partir da
  proposta — todos editáveis antes de ativar

### AC-3: Uma proposta gera no máximo um contrato
- **Dado** uma proposta que já gerou contrato
- **Quando** alguém tenta gerar outro
- **Então** é bloqueado no banco (`unique` em `proposta_id`), com mensagem que aponta o contrato
  existente

### AC-4: Ativar cria o plano de faturamento no Financeiro
- **Dado** um contrato em rascunho com valor mensal e vigência
- **Quando** é **ativado**
- **Então** uma linha nasce em `financeiro.contratos` com `comercial_contrato_id` preenchido, e o
  cron de recebíveis (`fn_gerar_recorrencias`, E04-S04) passa a gerar as parcelas **sem nenhuma
  alteração no cron**

### AC-5: A escrita no Financeiro é por RPC publicada
- **Dado** que `financeiro.contratos` pertence ao Financeiro (R1)
- **Quando** o Comercial cria o plano de faturamento
- **Então** chama RPC `security definer` **publicada pelo Financeiro**, com guarda de permissão —
  nunca `insert` direto cross-schema

### AC-6: Contratos legados continuam válidos
- **Dado** os contratos já cadastrados direto no Financeiro antes do E03
- **Quando** a migration roda
- **Então** eles permanecem com `comercial_contrato_id` **nulo** (legado sem origem comercial),
  continuam gerando recebíveis, e nenhuma tela do Financeiro quebra

### AC-7: Ativar o contrato fecha a oportunidade
- **Dado** um contrato ativado
- **Quando** a ativação conclui
- **Então** a oportunidade correspondente está em etapa `tipo='ganha'` (se a S06 já não a moveu
  pelo aceite) — o funil nunca fica com oportunidade aberta de contrato já ativo

### AC-8: Encerrar contrato não apaga histórico
- **Dado** um contrato `ativo`
- **Quando** é encerrado (com data e motivo)
- **Então** o status vira `encerrado`, o plano de faturamento no Financeiro para de gerar novas
  parcelas, e **as parcelas já geradas permanecem** — encerrar contrato não mexe em recebível
  existente

### AC-9: Reajuste é registrado, não aplicado sozinho
- **Dado** um contrato com índice e mês de reajuste configurados
- **Quando** o mês chega
- **Então** o sistema **sinaliza** que o reajuste é devido; a aplicação do novo valor é ação humana
  explícita, que gera registro — nada é reajustado automaticamente no V1

## Casos de borda e erros
- **Contrato sem vigência final** (indeterminado) → permitido; `vigencia_fim` nulo.
- **Ativar contrato com vigência já vencida** → recusado com mensagem.
- **Valor mensal zero** → recusado (contrato `avulso` sem recorrência usa outro caminho: não gera
  plano de faturamento).
- **Falha ao criar o plano no Financeiro** → a ativação **inteira** falha (operação atômica); nunca
  contrato ativo sem faturamento.
- **Cliente já com contrato ativo** → permitido (pode ter mais de um escopo), mas a tela avisa.
- **Encerrar contrato com parcela vencida em aberto** → permitido; a cobrança segue seu curso na
  régua (E04-S08).

## Fora de escopo
- **Criar o plano preventivo no PCM automaticamente** — nesta story o contrato **sinaliza**
  (evento/flag) e o PCM cria pelo fluxo dele; automação completa é story do E01.
- **Assinatura eletrônica.**
- **Aplicar reajuste automático** (AC-9).
- **Faturamento, NF-e, cobrança** — são do Financeiro (E04-S09 já cobre boleto/PIX).
- **Migrar contratos legados do Financeiro para o Comercial** (AC-6 os mantém como estão).

## Rastreabilidade
- Épico: `../E03-S01-fundacao-comercial/product.md` (decisão 9) · `design.md` §2.4
- ADRs: [ADR-0019](../../docs/adr/0019-propriedade-de-dados-r1-r2-r3.md)
- Glossário: **Contrato (Comercial)** × **Contrato (Financeiro)** × **Contrato PMOC**
- Reuso: E04-S04 (`financeiro.contratos`, `fn_gerar_recorrencias`, cron)
