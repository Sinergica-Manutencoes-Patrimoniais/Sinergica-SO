---
name: E02-S37-midia-recebida-evolution
description: Imagem, vídeo, documento, figurinha e avisos recebidos pelo WhatsApp aparecem na conversa, com proxy de anexo autenticado e transcrição de áudio numa única mensagem
alwaysApply: true
---

# Spec — E02-S37 · Mídia recebida pela Evolution

> **Fonte da verdade.** Status: rascunho
> Tier: **arquitetural** (dado não confiável vindo de fora, Storage privado, schema em produção).

## Resumo

Toda mensagem que o cliente manda pelo WhatsApp passa a aparecer na conversa como ele mandou — imagem,
vídeo, documento e figurinha guardados e visíveis, com a legenda; tipos sem tela própria viram aviso em
vez de sumir; o anexo só abre por rota autenticada; e o Zé recebe uma descrição segura, nunca o conteúdo
do arquivo.

## Contexto

Hoje `extractEvolutionMessage` só extrai texto. Uma foto de comprovante, um laudo em PDF ou um vídeo
chegam com `conteudo = ""` — a mensagem fica vazia na conversa ou nem aparece. Com o Zé ativo, quem
manda só uma foto não recebe resposta e ninguém da equipe fica sabendo.

Além disso, a transcrição de áudio hoje aparece **duas vezes**: o áudio com a transcrição e, de novo,
como uma segunda mensagem de texto do cliente.

Base: `docs/planejamento/port-evolution-triviatende.md`, seções (b.4), (b.6), (c.3), (c.4).

## Critérios de aceite

### AC-1: Imagem, vídeo, documento e figurinha aparecem
- **Dado** um canal WhatsApp conectado pela Evolution
- **Quando** o cliente manda uma imagem com legenda
- **Então** a conversa mostra a imagem e a legenda **numa mesma mensagem** do cliente, e a imagem abre
  em tamanho maior ao clicar
- **Quando** manda um vídeo → **Então** a conversa mostra o vídeo com player e a legenda, quando houver
- **Quando** manda um documento → **Então** a conversa mostra nome, tipo e tamanho, com opção de abrir
  ou baixar
- **Quando** manda uma figurinha → **Então** a conversa mostra a figurinha como imagem pequena,
  **sem nenhum texto de instrução**

### AC-2: Limites e tipos aceitos
- **Dado** os limites imagem/figurinha 10 MB, vídeo 16 MB, documento 25 MB
- **Quando** o arquivo está acima do limite, ou é de tipo não aceito (executável, script, compactado,
  `html`, `svg`), ou tem extensão perigosa
- **Então** a mensagem aparece como texto com nome, tipo, tamanho e o aviso correspondente
  (`[imagem acima do limite] legenda: …`), **sem o arquivo**, e a mensagem **nunca some**
- Tipos aceitos: imagem `jpeg png webp gif heic heif`; vídeo `mp4 3gp mov`; documento `pdf`, texto
  simples, `csv`, Office e LibreOffice

### AC-3: Conferência depois do download, não só pelo declarado
- **Dado** um `fileLength` declarado dentro do limite mas um arquivo real acima dele, ou um mime
  declarado aceito e um real recusado
- **Quando** o arquivo é baixado
- **Então** o estado vira `acima_do_limite` ou `tipo_nao_aceito` pelo **arquivo real**, e nada é salvo
  no bucket

### AC-4: Nome saneado e caminho gerado pelo sistema
- **Dado** um documento com nome contendo caminho (`../../etc/passwd`), caracteres de controle, ou 400
  caracteres
- **Quando** a mensagem é gravada
- **Então** o nome **mostrado** é saneado (sem diretório, sem controle, ≤120 chars, com extensão) e o
  arquivo é guardado com caminho **gerado pelo sistema**, em ASCII seguro

### AC-5: Mídia nunca é aberta no servidor
- **Dado** qualquer arquivo recebido
- **Quando** o sistema o processa
- **Então** ele **não é executado, descomprimido, renderizado nem pré-processado** — só conferido por
  tipo, extensão e tamanho, e gravado em bucket privado

### AC-6: Anexo só abre para quem pode ler a conversa
- **Dado** um anexo guardado
- **Quando** uma pessoa **sem** acesso àquela conversa pede o anexo, mesmo com o link de quem tem
- **Então** recebe exatamente a mesma resposta de "não encontrado" de um anexo inexistente
- **E** a resposta de quem tem acesso vem com `Content-Type` confinado à lista,
  `X-Content-Type-Options: nosniff`, `Content-Disposition: attachment` para documento e
  `Cache-Control: private, no-store`

### AC-7: Idempotência de mídia
- **Dado** a mesma mídia entregue duas vezes pelo WhatsApp
- **Quando** a segunda entrega chega
- **Então** a conversa continua com **uma só** mensagem e **um só** arquivo guardado

### AC-8: Transcrição aparece uma vez só
- **Dado** um áudio recebido e transcrito
- **Quando** a equipe abre a conversa
- **Então** vê **uma única** mensagem do cliente: o áudio, com a transcrição abaixo
- **Dado** uma transcrição que falhou → **Então** vê o áudio com o aviso "Transcrição indisponível"

### AC-9: Nenhuma instrução interna aparece como fala do cliente
- **Dado** qualquer mensagem recebida
- **Quando** a equipe abre a conversa
- **Então** nenhum texto destinado ao Zé (ex.: "[Cliente enviou uma figurinha sem texto. Peça que
  explique…]") aparece como se o cliente tivesse escrito

### AC-10: O que o Zé lê
- **Dado** o Zé ativo e uma mídia **com** legenda
- **Então** ele recebe `[imagem] legenda: paguei a avaliação` (ou `[documento: laudo.pdf] legenda: …`)
  e responde **à legenda**, sem descrever nem presumir o conteúdo do anexo
- **Dado** imagem, vídeo ou documento **sem** legenda
- **Então** a conversa passa para a equipe com o motivo "cliente enviou mídia sem texto" e o Zé
  **não responde**
- **Dado** uma figurinha sem texto → **Então** o Zé recebe `[figurinha]` e segue a conversa
- **Em nenhum caso** o conteúdo do arquivo entra no que o Zé lê

### AC-11: Nenhuma mensagem some sem registro
- **Dado** uma localização, um cartão de contato ou uma enquete
- **Então** a conversa mostra um aviso com o tipo (`[localização]`), **sem o conteúdo**, e passa para a
  equipe quando há Zé ativo

### AC-12: Falha ao baixar não perde a mensagem
- **Dado** uma mídia indisponível ou expirada na Evolution
- **Então** a mensagem aparece com o aviso "anexo indisponível" e a legenda, quando houver

### AC-13: Conteúdo não vaza em log
- **Dado** qualquer mídia processada
- **Então** o log registra só canal, tipo, tamanho e resultado — **nunca** o conteúdo, a legenda, o nome
  original, o telefone completo nem a `apikey`

### AC-14: A equipe não pode apontar anexo alheio
- **Dado** um atendente escrevendo mensagem pela tabela (PostgREST)
- **Quando** tenta gravar `anexo_bucket`/`anexo_path`/`legenda`/`conteudo_recebido` numa mensagem de
  saída
- **Então** o CHECK do banco **recusa**: esses campos só valem para mensagem de entrada do cliente

### AC-15: Nada do que já funciona regride
- **Dado** texto, emoji e áudio com transcrição
- **Então** continuam exatamente como hoje para a equipe e para o Zé

## Matriz de decisão — estado do anexo

| Extensão perigosa | Mime declarado | Tamanho declarado | Download | Arquivo real | Resultado | AC |
|---|---|---|---|---|---|---|
| sim | — | — | não tentado | — | `tipo_nao_aceito` | AC-2 |
| não | fora da lista | — | não tentado | — | `tipo_nao_aceito` | AC-2 |
| não | aceito | > limite | não tentado | — | `acima_do_limite` | AC-2 |
| não | aceito | ok | falhou | — | `indisponivel` | AC-12 |
| não | aceito | ok | ok | 0 bytes | `indisponivel` | AC-3 |
| não | aceito | ok | ok | > limite | `acima_do_limite` | AC-3 |
| não | aceito | ok | ok | mime fora da lista | `tipo_nao_aceito` | AC-3 |
| não | aceito | ok | ok | válido | `guardado` | AC-1 |

## Casos de borda e erros

- **Álbum** (várias mídias em sequência): cada uma vira uma mensagem, na ordem de chegada.
- **Legenda muito longa**: aparece inteira para a equipe (até 4096); o Zé recebe dentro do limite de
  texto (4000).
- **GIF do WhatsApp**: chega como vídeo com `gifPlayback`; segue como vídeo.
- **Conversa encerrada recebendo mídia**: reabre como uma mensagem de texto reabriria hoje.
- **Mensagens já gravadas antes da mudança** ficam como estão; transcrição duplicada antiga pode
  continuar visível no histórico.
- **Bucket indisponível**: vira `indisponivel`, a mensagem entra assim mesmo.

## Fora de escopo

> Vinculante.
- Envio de mídia **pelo** sistema (o `RichComposer` já faz; não muda).
- Leitura do conteúdo de imagem, vídeo ou documento por IA (OCR, visão).
- Citação e reação (é `E02-S38`).
- Foto do contato (`E02-S40`).
- Mídia enviada pelo aparelho da operação (`E02-S39`), que entra como marcador de texto.
- Canais Meta (WhatsApp Cloud API, Instagram), que seguem como estão.
- Mensagens de grupo; mensagens apagadas ou editadas pelo cliente.

## Rastreabilidade

- Análise: `docs/planejamento/port-evolution-triviatende.md` (b.4, b.6, c.3, c.4, e.1)
- Depende de: `E02-S36`
- Referência (somente leitura): `rosefish` spec `024-midia-recebida-evolution/` (US1, US2, US5);
  `supabase/functions/evolution-webhook/midia.ts`, `atendimento-anexo/index.ts`;
  migration `20261108130000`
- Molde interno do proxy: `supabase/functions/pcm-evidencia-material-segura/index.ts`
