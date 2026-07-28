---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Zé abre chamado a partir do contexto da conversa (WhatsApp)

> **Fonte da verdade.** Status: rascunho
> Origem: reunião Fabrício × Lucas (2026-07-27). Itens 1 e 7 da lista de alinhamento.

## Resumo
Quando um representante do cliente pede ao Zé (mencionando/chamando ele) para abrir um chamado no
WhatsApp, o Zé lê o contexto das últimas mensagens da janela, identifica **cada solicitação
distinta** como um chamado separado, confirma com o solicitante e só então grava os chamados no
PCM (`origem = "whatsapp"`).

## Decisões travadas (reunião)
- Zé **não** monitora a conversa toda proativamente para abrir chamado — só age quando **chamado/
  mencionado** (ex.: "@Zé abre o chamado"). O comportamento reativo é o MVP.
- **Uma ação = um chamado.** Mensagem com dois pedidos ("trocar a lâmpada do hall e o registro do
  3º andar") gera **dois** chamados, pois cada um pode virar uma OS independente.
- Informação essencial do chamado: **solicitação (texto livre)** + **local** + cliente/solicitante.
- Confirmação é **síncrona**: o Zé resume o que entendeu e pede "confirma?" antes de gravar.

## Parâmetro a definir
- `X` = tamanho da janela de contexto lida ao ser acionado. **Default proposto: últimas 20
  mensagens OU 24h da janela atual, o que vier primeiro.** Confirmar com Lucas antes de implementar.

## Critérios de aceite

### AC-1: Acionamento explícito
- **Dado** uma conversa de WhatsApp com o cliente e o Zé configurado no fluxo
- **Quando** o solicitante menciona/chama o Zé pedindo para abrir chamado
- **Então** o Zé lê as últimas `X` mensagens da janela como contexto e inicia o fluxo de abertura;
  **e** sem esse acionamento explícito o Zé não abre chamado por conta própria.

### AC-2: Uma solicitação distinta = um chamado
- **Dado** uma mensagem (ou trecho do contexto) com duas ou mais solicitações distinguíveis
- **Quando** o Zé processa o pedido de abertura
- **Então** ele propõe **um chamado por solicitação distinta**, cada um com sua solicitação e local,
  nunca aglutinando pedidos diferentes num só chamado.

### AC-3: Extração de solicitação e local
- **Dado** um pedido de abertura com texto livre
- **Quando** o Zé monta a proposta de chamado
- **Então** cada chamado proposto tem: título (gerado a partir da solicitação), descrição
  (solicitação em texto livre) e local quando presente no contexto; **e** se o local não foi
  informado, o campo local fica vazio (não bloqueia a abertura — o técnico descobre em campo).

### AC-4: Confirmação síncrona antes de gravar
- **Dado** um conjunto de chamados propostos pelo Zé
- **Quando** o Zé apresenta o resumo ("vou abrir N chamados: …")
- **Então** ele só grava no PCM após confirmação afirmativa do solicitante; **e** se o solicitante
  corrige ou nega, o Zé ajusta a proposta e reconfirma, sem gravar nada até o "confirma".

### AC-5: Persistência no PCM
- **Dado** a confirmação do solicitante
- **Quando** o Zé grava
- **Então** cada chamado é criado em `pcm.chamados` com `origem = "whatsapp"`, `clienteId`
  resolvido pela instância/grupo de origem, `solicitante` preenchido, status inicial `aberto`, e o
  número `CH-XXXX` é devolvido na confirmação ao solicitante.

## Casos de borda e erros
- Contexto ambíguo (não dá pra separar as solicitações) → Zé pergunta em vez de adivinhar.
- Cliente não resolvido a partir do grupo/instância → Zé sinaliza que não conseguiu identificar o
  cliente e não grava (não cria chamado órfão).
- Solicitante não é representante autorizado do cliente → fora de escopo desta story (ver E02-S24
  memória/alma e a definição de "representante do cliente").
- Falha ao gravar (rede/DB) → Zé informa o erro e não confirma número; não grava parcial.

## Fora de escopo
- Monitoramento proativo / resposta automática por trigger (é a E02-S25).
- Memória de longo prazo e "alma" por cliente (é a E02-S24).
- Definir quem é "representante autorizado" do cliente (depende de E02-S24 / cadastro responsável).
- Geração de OS a partir do chamado (fluxo já existente — E01-S88 e seguintes).

## Rastreabilidade
- Domínio: `apps/web/src/features/pcm/domain/chamados.ts` (`origem = "whatsapp"` já existe).
- Edge Function: `supabase/functions/pcm-ze-agent/index.ts`.
- Feature de IA/LLM → trilha `ia/` (prompt versionado, evals, injection) com `@prompt-engineer`.
- ADRs relacionados: —
