---
name: E02-S38-citacao-e-reacao
description: Resposta citando uma mensagem mostra o trecho citado; reação do cliente aparece na mensagem reagida sem acionar o Zé
alwaysApply: true
---

# Spec — E02-S38 · Citação e reação na conversa

> **Fonte da verdade.** Status: rascunho
> Tier: feature (schema aditivo pequeno, sem decisão irreversível).

## Resumo

Quando o cliente responde citando uma mensagem, a conversa mostra o bloco "em resposta a" com o autor e
o trecho citado — e o Zé recebe a mesma informação. Quando ele reage com um emoji, o emoji aparece na
mensagem reagida, sem criar mensagem nova e sem acionar o Zé.

## Contexto

Hoje citação e reação são descartadas pelo webhook. Sem a citação, resposta curta ("esse", "sim",
"esse horário") perde o sentido para a equipe e para o Zé. A reação, se tratada como mensagem, faria o
Zé responder a um 👍 e consumir IA à toa.

Base: `docs/planejamento/port-evolution-triviatende.md`, seções (b.4), (b.5), (c.2).

## Critérios de aceite

### AC-1: Resposta citando mostra o que foi citado
- **Dado** uma mensagem que existe na conversa
- **Quando** o cliente responde citando essa mensagem
- **Então** a conversa mostra a resposta com um bloco "em resposta a" contendo o **autor** e um
  **trecho** da mensagem citada, e clicar no bloco leva até a mensagem citada

### AC-2: Citação de mensagem que não está no sistema
- **Dado** uma citação de mensagem anterior ao sistema
- **Quando** a resposta chega
- **Então** a conversa mostra o trecho que veio junto da resposta, ou **"mensagem anterior"** quando não
  veio nenhum — a mensagem nunca aparece sem o bloco

### AC-3: Citação de mídia
- **Dado** uma citação de imagem, vídeo, documento, áudio ou figurinha
- **Então** o bloco "em resposta a" mostra o tipo (`[imagem]`, `[documento] laudo.pdf`, `[áudio]`,
  `[figurinha]`) e a legenda ou transcrição, quando houver

### AC-4: O Zé recebe a citação
- **Dado** o Zé ativo
- **Quando** o cliente responde citando uma mensagem
- **Então** o Zé recebe a resposta **junto com** o trecho citado e a indicação de quem o escreveu
  (cliente, Zé ou equipe)

### AC-5: Só o primeiro nível
- **Dado** uma citação de uma mensagem que já era citação
- **Então** só o primeiro nível é mostrado

### AC-6: Reação aparece na mensagem reagida
- **Dado** uma mensagem que existe na conversa
- **Quando** o cliente reage com um emoji
- **Então** o emoji aparece junto da mensagem reagida, a conversa **não ganha mensagem nova**, e a
  **prévia e a ordem na lista de conversas não mudam**

### AC-7: Trocar e remover reação
- **Dado** uma reação já mostrada
- **Quando** o cliente troca o emoji → **Então** aparece só o emoji novo
- **Quando** o cliente remove a reação (emoji vazio) → **Então** o emoji some da mensagem

### AC-8: Reação não aciona o Zé
- **Dado** o Zé ativo
- **Quando** chega uma reação
- **Então** o Zé **não é acionado**, nenhum consumo de IA é registrado, e conversa encerrada **não
  reabre**

### AC-9: Reação órfã é ignorada sem erro
- **Dado** uma reação a uma mensagem que não está no sistema (ordem de entrega, histórico anterior)
- **Então** é ignorada, responde `200`, e **nenhum erro** é registrado

### AC-10: Uma reação por mensagem
- **Dado** a tabela de reações
- **Então** existe no máximo **uma** linha por mensagem reagida, escrita só pela RPC; nenhum papel do
  app escreve direto

### AC-11: Leitura restrita
- **Dado** um usuário sem acesso à conversa
- **Quando** consulta reações pelo PostgREST
- **Então** não vê nenhuma linha daquela conversa (RLS, teste permitido e negado)

### AC-12: Citação é campo do cliente
- **Dado** um atendente gravando mensagem pela tabela
- **Quando** tenta preencher `citada_*`
- **Então** o CHECK recusa: citação só vale para mensagem de entrada do cliente

## Casos de borda e erros

- Reação a uma mensagem do **próprio cliente**: aparece igual, na mensagem dele.
- Reação chegando **antes** da mensagem reagida: ignorada sem erro (AC-9).
- Conversa **encerrada** recebendo reação: a reação aparece na mensagem e **não reabre** a conversa.
- Emoji com mais de 32 caracteres ou `remote_id` com mais de 256: ignorado sem erro.
- Trecho citado acima de 500 caracteres: cortado com reticência.
- Citação cujo `stanzaId` existe mas a mensagem foi apagada do sistema: cai no caso AC-2.

## Fora de escopo

> Vinculante.
- Reagir **a partir** do sistema (a equipe reagir a uma mensagem).
- Responder citando **a partir** do sistema.
- Reações de outros autores que não o cliente.
- Canais Meta.

## Rastreabilidade

- Análise: `docs/planejamento/port-evolution-triviatende.md` (b.4, b.5, c.2)
- Depende de: `E02-S37`
- Referência (somente leitura): `rosefish` spec `024-midia-recebida-evolution/` (US3, US4);
  `supabase/functions/evolution-webhook/midia.ts` (`citacaoDaMensagem`, `reacaoDaMensagem`);
  `interfaces/TimelineDaConversa.tsx`; migration `20261108130000`
