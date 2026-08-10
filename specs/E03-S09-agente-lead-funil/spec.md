---
name: spec
description: Contrato — o agente comercial de WhatsApp passa a criar oportunidade no funil em vez de gravar em comercial.leads.
alwaysApply: true
---

# Spec — E03-S09 · Agente comercial entrega o lead no funil

> **Fonte da verdade.** Status: pronto para implementar · Tier: **pequeno**
> Depende de **E03-S01/S02**. Bloqueia a **S10** (só depois desta o drop de `comercial.leads` é
> seguro). Toca Edge Function em produção — ler `design.md` §4.3 antes.

## Resumo
Fecha o ciclo que está pela metade em produção: a E02-S09 deixou o agente comercial gravando em
`comercial.leads`, uma tabela **sem nenhuma tela que a consuma**. Aqui ele passa a criar
**oportunidade no funil**, com score, resumo, tier e cluster — e o time finalmente vê o lead que o
WhatsApp qualificou.

## Critérios de aceite

### AC-1: RPC é a interface de entrada
- **Dado** o agente qualificando um contato novo
- **Quando** decide registrar o lead
- **Então** chama `comercial.fn_registrar_oportunidade(...)` — `security definer` com
  `requireServiceRole`; o Atendimento **não** insere direto em tabela do Comercial (R1/R2 do
  ADR-0019)

### AC-2: Conta é reusada, nunca duplicada
- **Dado** um contato que já tem vínculo com uma Conta (`relacionamento.vinculos`)
- **Quando** o agente registra o lead
- **Então** a oportunidade é criada **na Conta existente**; só quando não há vínculo é que uma
  Conta nova nasce (com `auvo_id` nulo — lead não vai para o Auvo)

### AC-3: Nenhum dado do agente se perde
- **Dado** o lead qualificado
- **Quando** a oportunidade é criada
- **Então** carrega `score`, `resumo`, `origem='whatsapp'`, `origem_ref` (o `remote_jid`),
  `lead_tier`, `cluster_nome`, `conversa_id` e `contato_id` — os mesmos campos que hoje vão para
  `comercial.leads` (18 colunas, `design.md` §4.3)

### AC-4: Etapa de entrada é configurável
- **Dado** as etapas do funil
- **Quando** o agente cria a oportunidade
- **Então** ela entra na etapa marcada como **entrada do agente** (configurável; por padrão a
  primeira `aberta`) — não numa etapa fixa no código

### AC-5: Conversa fica ligada à oportunidade
- **Dado** a conversa de WhatsApp que originou o lead
- **Quando** a oportunidade é criada
- **Então** a conversa passa a apontar para ela, e a aba Comercial da Visão 360 permite abrir a
  conversa — o time vê o que o cliente disse antes de ligar

### AC-6: Idempotência por conversa
- **Dado** uma conversa que já gerou oportunidade
- **Quando** o agente qualifica de novo (cliente volta a escrever, retry, reprocessamento)
- **Então** **não** cria segunda oportunidade: atualiza score/resumo da existente enquanto ela
  estiver aberta; se a anterior estiver fechada (`ganha`/`perdida`), cria uma nova

### AC-7: Falha no registro não derruba o atendimento
- **Dado** uma falha ao criar a oportunidade (RLS, indisponibilidade, dado inválido)
- **Quando** o agente está em conversa com o cliente
- **Então** o erro é logado e a conversa **continua normalmente** — o cliente nunca fica sem
  resposta porque o CRM falhou

### AC-8: Escrita legada desligada
- **Dado** esta story implantada
- **Quando** o agente registra um lead
- **Então** ele **não escreve mais** em `comercial.leads`; a tabela permanece existindo (o drop é
  a S10), mas sem receber linha nova

## Casos de borda e erros
- **Contato sem nome** → Conta criada com o identificador disponível (telefone), nunca vazia.
- **Contato vinculado a Conta inativa** → reusa a Conta e cria oportunidade; o funil mostra a
  situação da Conta (é reativação, caso legítimo de venda).
- **Dois leads simultâneos do mesmo contato** → o `unique` da idempotência (AC-6) resolve no banco.
- **Funil sem nenhuma etapa `aberta`** → o registro falha de forma explícita e logada; a conversa
  continua (AC-7).
- **Score fora de 0–100** → recusado pelo check da coluna; agente loga e segue.

## Fora de escopo
- **Dropar `comercial.leads`** ou mexer em `atendimento.conversas.lead_id` — é a **S10**, e nunca
  antes desta story estar em produção validada.
- **Mudar o prompt ou o roteiro de qualificação** do agente (E02-S06/S07).
- **UAT do WhatsApp real** — depende de instância conectada; esta story entrega o caminho, a
  validação com WhatsApp real é operação (mesma ressalva pendente da E02-S09).
- **Notificação ao time quando chega lead** — pode virar story própria.

## Rastreabilidade
- Épico: `../E03-S01-fundacao-comercial/design.md` §4.3 (por que `comercial.leads` ainda vive)
- ADRs: [ADR-0019](../../docs/adr/0019-propriedade-de-dados-r1-r2-r3.md) (R1) ·
  [ADR-0020](../../docs/adr/0020-conta-unica-funil-no-comercial.md)
- Código afetado: `supabase/functions/pcm-ze-agent/index.ts` (~L543)
- Origem: E02-S09 (agente comercial), E02-S18 (scoring/cluster)
