---
name: capacidades-sso-2026-11-24
description: As 25 capacidades do catálogo config.sso_acoes, quais exigem concessão individual, e a proposta de concessão por grupo para os cinco perfis pedidos pelo Fabrício.
alwaysApply: false
---

# Capacidades do SSO — catálogo completo e proposta de concessão

Resposta ao pedido de 24/11/2026: *"Enviar a lista das 25 capacidades com a indicação das 10
exclusivamente individuais, o escopo por cliente e uma proposta de concessão por grupo."*

A lista abaixo **não é uma proposta**: é o catálogo real de `config.sso_acoes` reconstruído
migration por migration, da `0239_E01-S170` até a `1863_E01-S196`, já com o efeito da
`1857_E00-S26`. São exatamente 25 códigos; 10 têm `exige_concessao_individual = true`.

## Como o SSO decide (`config.sso_autorizar_acao`, migration 0239)

Uma ação é autorizada quando **todas** as condições valem ao mesmo tempo:

1. o usuário está ativo e o papel do JWT bate com o papel cadastrado;
2. o papel é `superadmin` **ou** o usuário tem o módulo da ação com nível compatível
   (`escrita` cobre tudo; `leitura` só cobre ação de leitura);
3. existe linha em `config.sso_concessoes` que alcança aquele usuário **naquele cliente**.

A terceira condição é a que surpreende: **ser `superadmin` não dispensa concessão.** Foi por isso
que as 25 capacidades precisaram ser concedidas ao administrador em 24/11 — sem isso a tela recusa
por falta de permissão, mesmo com a flag ligada e o gate aberto.

O **escopo é sempre por cliente**: `sso_autorizar_acao(acao, cliente_id)` resolve o cliente na
chamada, e `pcm.clientes` precisa estar ativo e não excluído. Não existe concessão "para todos os
clientes" implícita — cada cliente é uma linha de concessão.

Quando `exige_concessao_individual = true`, a concessão por **perfil** deixa de valer: só conta a
linha nominal, com `usuario_id` preenchido. É o que torna essas 10 "exclusivamente individuais".

## As 25 capacidades

| # | Código | Módulo | Nível | Individual | O que destrava | Origem |
|---|---|---|---|---|---|---|
| 1 | `anexo_os.publicar` | pcm | escrita | **sim** | Publicar anexo da OS para o cliente | 0465 E01-S183 |
| 2 | `backlog.promover` | pcm | escrita | **sim** | Promover item do Backlog a Chamado | 0890 E01-S174 |
| 3 | `cadastro.aprovar` | pcm | escrita | **sim** | Aprovar cadastro | 0239 + **1857** |
| 4 | `cadastro.gerir` | pcm | escrita | não | Manter cadastros da Estrutura | 0248 E01-S176 |
| 5 | `cadastro.ler` | pcm | leitura | não | Consultar cadastros | 0248 E01-S176 |
| 6 | `capacidade.gerir` | pcm | escrita | não | Disponibilidade semanal / capacidade de agenda | 0334 E01-S172 |
| 7 | `chamado.continuacao.sugerir` | pcm | escrita | não | Sugerir continuação de escopo | 0415 E01-S170 |
| 8 | `chamado.encerrar` | pcm | escrita | **sim** | Encerrar Chamado (cancelar) | 0239 + **1857** |
| 9 | `chamado.escopo.gerir` | pcm | escrita | não | Gerir escopo do Chamado | 0415 E01-S170 |
| 10 | `chamado.os.criar` | pcm | escrita | não | Criar OS adicional no Chamado | 0415 E01-S170 |
| 11 | `codigo.substituir` | pcm | escrita | não | Substituir código de item | 0239 E01-S170 |
| 12 | `custo.ler` | comercial + financeiro | leitura | **sim** | Ver valores internos de custo | 0239 + 0246 + **1857** |
| 13 | `despesa_visita.gerir` | pcm | escrita | não | Lançar despesa de Visita | 0323 E01-S180 |
| 14 | `execucao.contingencia_auvo` | pcm | escrita | **sim** | Operar em contingência quando o Auvo cai | 1863 E01-S196 |
| 15 | `execucao.validar` | pcm | escrita | não | **Validação PCM** da execução | 0239 E01-S170 |
| 16 | `faturavel.efetivar` | financeiro | escrita | não | Efetivar faturável | 0239 E01-S170 |
| 17 | `integracao.reconciliar` | pcm | escrita | não | Conciliar OS de campo / Auvo | 0239 E01-S170 |
| 18 | `material.gerir` | pcm | escrita | não | Registrar materiais | 0239 E01-S170 |
| 19 | `orcamento.dispensar` | comercial | escrita | **sim** | Dispensar orçamento | 0437 E01-S181 |
| 20 | `orcamento.emitir` | comercial | escrita | não | Emitir orçamento/proposta | 0239 E01-S170 |
| 21 | `orcamento.excecao_preco` | comercial | escrita | **sim** | Exceção de preço | 0445 E01-S181 |
| 22 | `orcamento.operacional.ler` | comercial | leitura | não | Painel operacional de propostas | 0434 E01-S181 |
| 23 | `plano.gerir` | pcm | escrita | **sim** | Criar/alterar/suspender Plano de Manutenção (inclui o Plano PMOC) | 0239 E01-S170 |
| 24 | `visita.cancelar` | pcm | escrita | **sim** | Cancelar Visita | 0413 + **1857** |
| 25 | `visita.confirmar` | pcm | escrita | não | Confirmar Visita (dispara a tarefa no Auvo) | 0239 E01-S170 |

**As 10 exclusivamente individuais:** `anexo_os.publicar`, `backlog.promover`, `cadastro.aprovar`,
`chamado.encerrar`, `custo.ler`, `execucao.contingencia_auvo`, `orcamento.dispensar`,
`orcamento.excecao_preco`, `plano.gerir`, `visita.cancelar`.

Quatro delas (3, 8, 12, 24) viraram individuais na `1857_E00-S26`, exatamente por causa do achado
do Fabrício: *"quem tem escrita no módulo aprova, cancela, exporta e vê custo"*. Antes, essas
quatro eram herdáveis por perfil.

### Uma divergência consciente: `execucao.validar`

`execucao.validar` (Validação PCM) **não** é individual, e isso é decisão de desenho anterior,
testada de propósito em `E01-S170_perfis_acumulaveis.test.sql` ("usuário acumula capacidades dos
dois perfis"). Está registrada como SPEC_DEVIATION na `1857`, não como descuido. Se a Engenharia
Sinérgica quiser a Validação PCM também nominal, é uma decisão nova — e quebra contrato testado.
**Esse é um ponto que pedimos resposta expressa.**

## Proposta de concessão por grupo

Os cinco perfis abaixo são a proposta funcional do Fabrício mapeada nas capacidades que existem.
Coluna **perfil** = concessão herdável, criada uma vez e aplicada ao grupo. Coluna **nominal** =
precisa de linha por pessoa e por cliente.

### Gestor PCM
- **Por perfil:** `cadastro.ler`, `cadastro.gerir`, `capacidade.gerir`, `chamado.escopo.gerir`,
  `chamado.continuacao.sugerir`, `chamado.os.criar`, `codigo.substituir`,
  `integracao.reconciliar`, `material.gerir`, `despesa_visita.gerir`, `visita.confirmar`,
  `execucao.validar`.
- **Nominal (nomear quem recebe, em quais clientes):** `plano.gerir` (aprovar/suspender plano),
  `chamado.encerrar` (autorizar cancelamento), `visita.cancelar`,
  `execucao.contingencia_auvo` (contingência Auvo), `cadastro.aprovar`, `backlog.promover`.

### Operador PCM
- **Por perfil:** `cadastro.ler`, `chamado.escopo.gerir`, `chamado.continuacao.sugerir`,
  `chamado.os.criar`, `integracao.reconciliar`, `material.gerir`, `despesa_visita.gerir`,
  `visita.confirmar`, `capacidade.gerir`.
- **Nominal, só quando a atribuição definir:** `execucao.validar` fica herdável pelo catálogo —
  então, se a intenção é restringir a Validação PCM a pessoas específicas, o caminho hoje é **não
  colocar `execucao.validar` no perfil do Operador** e conceder por perfil separado. Ver a
  divergência acima.
- **Nunca por perfil:** `chamado.encerrar`, `visita.cancelar`, `plano.gerir`, `custo.ler`.

### Inspetor
- **Por perfil:** `cadastro.ler`, `material.gerir`, `despesa_visita.gerir`.
- **Nominal:** `anexo_os.publicar` (publicar evidência para o cliente).
- O Inspetor executa inspeção e registra evidência; o encaminhamento do achado ao PCM não consome
  capacidade própria — é transição de estado da Inspeção.

### Financeiro
- **Por perfil:** `faturavel.efetivar`, `orcamento.operacional.ler`.
- **Nominal:** `custo.ler` (módulo `financeiro`, nível leitura — já mapeado na `0246`).
- **Nunca:** qualquer capacidade de módulo `pcm` com nível escrita. É o que atende
  *"limitar a alteração da operação ao perfil responsável"*.

### Comercial
- **Por perfil:** `orcamento.emitir`, `orcamento.operacional.ler`, `cadastro.ler`.
- **Nominal:** `custo.ler`, `orcamento.dispensar`, `orcamento.excecao_preco`.
- `custo.ler` nominal é exatamente *"definir acesso a custos internos por atribuição e
  necessidade"*.

## O que precisamos de volta para executar

1. **Nomes por concessão nominal.** Cada uma das 10 precisa de pessoa + cliente. Sem o nome, a
   capacidade fica sem ninguém — a tela recusa, e isso é o comportamento correto.
2. **Decisão sobre `execucao.validar`** (herdável hoje; tornar nominal quebra teste existente).
3. **Lista de clientes do escopo da homologação.** Hoje: `Sinérgica – Escritório`. O Guainumbi
   entra como segundo escopo quando os dados estiverem prontos.
