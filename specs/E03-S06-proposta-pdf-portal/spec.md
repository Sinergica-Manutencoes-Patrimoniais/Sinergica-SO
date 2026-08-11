---
name: spec
description: Contrato — proposta em PDF com identidade visual, publicação no portal do síndico e aceite/recusa que move a oportunidade.
alwaysApply: true
---

# Spec — E03-S06 · Proposta: PDF + aprovação no portal

> **Fonte da verdade.** Status: pronto para implementar · Tier: **pequeno**
> Depende de **E03-S04** (proposta). Reusa o pipeline de PDF (E01-S135/S139) e o fluxo de
> aprovação do portal (E09-S09). Decisão 8 do PO: **PDF, não DOCX**.

## Resumo
Fecha o ciclo da proposta: gera PDF com a identidade visual da Sinérgica, publica para o síndico no
portal do cliente e registra aceite/recusa como **evento no sistema** — que move a oportunidade
sozinha, sem alguém ter que lembrar de atualizar o funil.

## Critérios de aceite

### AC-1: PDF com identidade visual
- **Dado** uma proposta em status `aprovada`
- **Quando** o usuário gera o PDF
- **Então** o arquivo sai com a identidade visual já usada nos relatórios (E01-S139) e contém:
  Conta, escopo, composição, valor, validade e número da versão — reusando o pipeline existente,
  sem biblioteca nova

### AC-2: PDF reflete a versão, não o "agora"
- **Dado** uma proposta na versão N
- **Quando** o PDF é gerado
- **Então** o conteúdo vem do **snapshot** daquela versão (`proposta_versoes`), não de uma nova
  leitura das tabelas — o PDF enviado e o registro batem sempre

### AC-3: Enviar publica no portal
- **Dado** uma proposta `aprovada` e uma Conta com usuário de portal (`config.usuario_cliente`)
- **Quando** o usuário com `escrita` envia
- **Então** o status vira `enviada` e a proposta aparece no portal do síndico daquela Conta —
  via **view `comercial.portal_propostas`**, restrita por RLS (padrão de `financeiro.portal_faturas`)

### AC-4: Síndico só vê a própria
- **Dado** dois síndicos de Contas diferentes
- **Quando** consultam `comercial.portal_propostas`
- **Então** cada um vê **apenas** as propostas da sua Conta; nenhuma proposta em `rascunho`,
  `em_revisao` ou `cancelada` aparece — provado por pgTAP

### AC-5: Aceite move a oportunidade sozinho
- **Dado** uma proposta `enviada` visível no portal
- **Quando** o síndico aceita
- **Então** o status vira `aceita`, um registro de decisão é gravado (quem, quando, de qual IP/
  usuário) e a **oportunidade move para a etapa `tipo='ganha'`** automaticamente, com evento em
  `oportunidade_eventos`

### AC-6: Recusa exige motivo e fecha o funil
- **Dado** uma proposta `enviada`
- **Quando** o síndico recusa
- **Então** informa um motivo, o status vira `recusada`, e a oportunidade move para etapa
  `tipo='perdida'` com `motivo_perda_id` correspondente — satisfazendo o AC-6 da S01 sem exceção

### AC-7: Proposta expirada não pode ser aceita
- **Dado** uma proposta com `valido_ate` no passado
- **Quando** o síndico tenta aceitar
- **Então** a ação é recusada **no banco** com mensagem de validade vencida (mesma guarda do
  `pcm.orcamentos_servico`, E09-S09), e a proposta aparece marcada como expirada no portal

### AC-8: Decisão é idempotente
- **Dado** uma proposta já `aceita` ou `recusada`
- **Quando** chega uma segunda decisão (duplo clique, reenvio, aba aberta duas vezes)
- **Então** a segunda é ignorada sem erro para o usuário e sem alterar o estado — a oportunidade
  não é movida duas vezes

## Casos de borda e erros
- **Conta sem usuário de portal** → o envio avisa que não há para quem publicar e sugere gerar o
  PDF para envio manual; não bloqueia a mudança de status.
- **Proposta reenviada após nova versão** → publica a versão nova; a decisão anterior (se houver)
  permanece no histórico.
- **Falha ao gerar PDF** → o status **não** muda; erro explícito, sem proposta "enviada" sem peça.
- **Síndico sem nenhuma proposta** → estado vazio limpo no portal, nunca erro.
- **Etapa `ganha`/`perdida` inexistente** (usuário desativou todas) → a decisão é gravada e a
  oportunidade fica onde está, com aviso ao time — a decisão do cliente nunca se perde por
  configuração de funil.

## Fora de escopo
- **DOCX** (non-goal do épico).
- **Assinatura eletrônica** — o aceite no portal é o registro; integração com assinatura digital
  não entra.
- **Envio por e-mail/WhatsApp automático** — o canal é o portal; disparo ativo pode virar story
  própria reusando o padrão da régua de cobrança (E04-S08).
- **Negociação/contraproposta pelo portal** — o síndico aceita ou recusa.

## Rastreabilidade
- Épico: `../E03-S01-fundacao-comercial/product.md` (decisão 8) · `design.md` §2.5
- Reuso: E01-S135/S139 (PDF), E09-S09 (aprovação de orçamento no portal),
  E04-S04 (`portal_faturas` como padrão de view restrita)
