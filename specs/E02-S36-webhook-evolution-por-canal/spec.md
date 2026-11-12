---
name: E02-S36-webhook-evolution-por-canal
description: Webhook Evolution autenticado por segredo próprio de cada canal, com canal no caminho, idempotência por (canal, evento, id) e classificação total do payload
alwaysApply: true
---

# Spec — E02-S36 · Webhook Evolution por canal

> **Fonte da verdade.** Status: rascunho
> Tier: **arquitetural** (integração externa, endpoint que escreve PII, schema em produção).

## Resumo

O recebimento de mensagens da Evolution passa a ter um endpoint por canal, autenticado por um segredo
aleatório exclusivo daquele canal comparado em tempo constante **antes de o corpo ser lido**, com
idempotência escopada em `(canal, evento, id remoto)` e um classificador total que nunca deixa um tipo
desconhecido virar fala do cliente.

## Contexto

Hoje `supabase/functions/pcm-whatsapp-webhook` valida **um token global**
(`EVOLUTION_WEBHOOK_TOKEN`) para todas as instâncias, numa rota fixa, e resolve a instância pelo
**corpo** do evento (`payload.instance`). O corpo é do terceiro: quem conhece o token de um número
escreve PII na conversa de qualquer outro número, e um evento forjado escolhe a instância.
A idempotência é um `unique` global em `mensagens.wa_message_id`, não escopada por canal.

Base: `docs/planejamento/port-evolution-triviatende.md`, seção (c.1) e (c.2).

## Critérios de aceite

### AC-1: Canal vem do caminho, nunca do corpo
- **Dado** o endpoint `POST /functions/v1/atendimento-evolution-webhook/{canalId}`
- **Quando** chega um evento cujo corpo declara uma instância **diferente** da do canal da rota
- **Então** o evento é recusado com `409 canal_divergente` e **nada é persistido**

### AC-2: Autenticação antes de ler o corpo
- **Dado** um canal com segredo de webhook instalado
- **Quando** chega requisição sem o cabeçalho `x-sinergica-evolution-webhook`, com valor errado, ou para
  um canal sem segredo
- **Então** responde `401 recusado`, o corpo **não é parseado**, e nenhum campo de PII aparece em log

### AC-3: Comparação em tempo constante
- **Dado** dois segredos de mesmo comprimento que diferem só no último byte
- **Quando** a comparação roda
- **Então** ela percorre todos os bytes (implementação sem curto-circuito), e tamanhos diferentes
  retornam falso sem comparar conteúdo

### AC-4: Canal desconhecido não cria canal
- **Dado** um `canalId` que não existe ou está inativo
- **Quando** chega um evento
- **Então** responde `404 canal_nao_identificado`; **nenhum canal é criado** e o evento **não** cai num
  canal padrão

### AC-5: Idempotência por canal
- **Dado** o mesmo `(canalId, event_type, remote_message_id)` entregue duas vezes
- **Quando** o segundo evento chega
- **Então** a conversa continua com **uma só** mensagem, e a resposta é `200 { duplicado: true }`
- **E dado** o **mesmo** `remote_message_id` em **dois canais diferentes**
- **Então** as duas mensagens são gravadas, cada uma na sua conversa

### AC-6: Teto de tamanho e formato
- **Dado** um corpo maior que 256 KB → **Então** `413 payload_excede_tamanho`
- **Dado** um `content-type` que não é JSON → **Então** `415 formato_invalido`
- **Dado** um JSON inválido → **Então** `400 payload_invalido`
- **Em todos os casos**, depois da autenticação e sem persistir nada

### AC-7: Classificador total
- **Dado** qualquer payload de `MESSAGES_UPSERT`
- **Quando** é classificado
- **Então** o resultado é exatamente um de: `texto`, `audio`, `midia`, `aviso`, `reacao`, `aparelho`,
  `ignorar` — **o classificador nunca lança exceção** e **nenhum tipo desconhecido vira texto por
  default**

### AC-8: Ignorados explícitos
- **Dado** evento diferente de `MESSAGES_UPSERT`, ou `remoteJid` terminando em `@g.us` (grupo) ou
  `@broadcast`, ou `protocolMessage`, ou payload sem `key`/`message`/`remoteJid`/`id`
- **Então** responde `200` com o motivo, sem criar conversa nem mensagem

### AC-9: Desembrulho de mensagens embrulhadas
- **Dado** um `ephemeralMessage`, `viewOnceMessage`, `viewOnceMessageV2`,
  `viewOnceMessageV2Extension` ou `documentWithCaptionMessage`, aninhado até 3 níveis
- **Quando** é classificado
- **Então** o conteúdo interno é alcançado e classificado pelo tipo real

### AC-10: Segredo por canal instalado pelo produto
- **Dado** a instalação do webhook (E02-S35)
- **Quando** o backend monta a configuração
- **Então** gera um segredo aleatório **por canal**, guarda no Vault sob referência opaca, envia a URL
  com o canal no caminho e o segredo em **cabeçalho customizado**; segredo em query string é recusado
  pelo próprio código

### AC-11: Compatibilidade durante a transição
- **Dado** o endpoint antigo `pcm-whatsapp-webhook` ainda instalado em algum canal
- **Quando** ele recebe evento
- **Então** continua funcionando como hoje, e a tela de canais mostra "recebimento legado — reinstalar"
  para aquele canal

### AC-12: Rate limit por canal
- **Dado** mais de 120 eventos em 60 s para o mesmo canal
- **Então** responde `429`, sem persistir o excedente, e a saúde do canal é degradada

## Casos de borda e erros

- Dois eventos concorrentes com a mesma chave de idempotência → a reserva é atômica; um grava, o outro
  responde duplicado. Sem linha órfã.
- Evento chegando para canal `desconectado` → é recebido e persistido (o histórico não se perde); a
  saúde continua degradada.
- `remoteJid` com `@lid` (identificador interno, sem telefone) → classificado, mas a conversa é
  resolvida pelo `remote_jid` cru, como hoje.
- Segredo rotacionado: enquanto o webhook remoto não é reinstalado, o canal responde `401` e a tela
  mostra "recebimento interrompido — reinstalar recebimento".

## Fora de escopo

> Vinculante.
- Guardar mídia, citação, reação e foto (S37, S38, S40) — nesta story o classificador **identifica**
  esses tipos, mas só texto e áudio são persistidos como hoje; os demais respondem `200 { ignorado }`.
- Mensagem do aparelho (S39) — `fromMe` continua indo para `fn_registrar_mensagem_celular`.
- Visão de conversa (S41).
- Remover `pcm-whatsapp-webhook` — sai só quando todos os canais estiverem migrados.

## Rastreabilidade

- Análise: `docs/planejamento/port-evolution-triviatende.md` (c.1, c.2, e.2)
- ADR a criar: `docs/adr/1687-webhook-evolution-por-canal.md`
- Depende de: `E02-S35`
- Referência (somente leitura): `rosefish` ADR-0033 (roteamento de entrada), ADR-0034 (§5);
  `supabase/functions/evolution-webhook/index.ts` (`classificar`, `iguaisEmTempoConstante`,
  `canalIdDaUrl`, `lerPayloadLimitado`); migration `20260916100500`
