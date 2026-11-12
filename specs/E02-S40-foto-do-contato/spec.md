---
name: E02-S40-foto-do-contato
description: Foto de perfil do WhatsApp do contato aparece na lista de conversas, no cabeçalho e no perfil, guardada em bucket privado e atualizada a cada 7 dias
alwaysApply: true
---

# Spec — E02-S40 · Foto do WhatsApp do contato

> **Fonte da verdade.** Status: rascunho
> Tier: feature (schema aditivo, Storage privado, dado pessoal comum).

## Resumo

Quem escreve pelo WhatsApp conectado pela Evolution passa a aparecer com a foto de perfil do WhatsApp
na lista de conversas, no cabeçalho da conversa e no perfil — guardada em bucket privado, aberta só por
quem pode ler a conversa, e reconsultada no máximo a cada 7 dias.

## Contexto

Hoje todo avatar do atendimento mostra as iniciais. A equipe quer reconhecer a pessoa de relance. A
Evolution consegue informar a foto de perfil de um número, mas o endereço que ela devolve **expira em
alguns dias** — por isso o arquivo precisa ser guardado, não linkado.

Base: `docs/planejamento/port-evolution-triviatende.md`, seções (b.6), (b.7), (c.6).

## Critérios de aceite

### AC-1: A foto aparece em até 1 minuto
- **Dado** um canal WhatsApp conectado pela Evolution
- **Quando** um contato com foto pública manda a primeira mensagem
- **Então** em até **1 minuto** a foto aparece no item da lista de conversas, no cabeçalho da conversa
  e no perfil do contato

### AC-2: A busca nunca atrasa a mensagem
- **Dado** a mesma situação
- **Quando** a mensagem entra
- **Então** ela aparece na conversa e chega ao Zé **no mesmo tempo de antes**; a busca da foto acontece
  depois, em segundo plano, e **falha na busca nunca afeta a mensagem**

### AC-3: Foto guardada, não linkada
- **Dado** uma foto obtida da Evolution
- **Então** ela é **baixada e guardada em bucket privado próprio**; a tela **nunca** mostra a foto pelo
  endereço do WhatsApp
- **E** dias depois, com o endereço original já expirado, a foto continua aparecendo

### AC-4: Conferência do arquivo
- **Dado** o arquivo devolvido pela consulta
- **Quando** é avaliado
- **Então** só é aceito se vier de endereço do WhatsApp, tiver no máximo **1 MB**, e for **de fato**
  JPEG, PNG ou WebP — conferido **pelo conteúdo** (assinatura do arquivo), não só pelo tipo declarado
- Qualquer outra coisa é recusada e ficam as iniciais

### AC-5: Sem foto, ficam as iniciais
- **Dado** um contato com a foto oculta pela privacidade, ou um canal que não é Evolution, ou uma falha
  na busca
- **Então** a lista, o cabeçalho e o perfil mostram as **iniciais**, sem ícone de imagem quebrada e sem
  espaço vazio
- **E dado** uma foto guardada que deixa de abrir por qualquer motivo → **Então** aparecem as iniciais
  no lugar

### AC-6: Conversas sem foto não pedem imagem
- **Dado** uma conversa cujo contato não tem foto
- **Então** a tela **não gera requisição de imagem** que volte vazia

### AC-7: Reconsulta a cada 7 dias
- **Dado** uma foto consultada há **mais de 7 dias**
- **Quando** o contato manda mensagem → **Então** o sistema consulta de novo, e a foto nova aparece se
  mudou
- **Dado** uma consulta feita há **menos de 7 dias** → **Então** o sistema **não** consulta de novo,
  nem com várias mensagens seguidas

### AC-8: Foto removida volta às iniciais
- **Dado** uma foto guardada e uma nova consulta que não encontra foto
- **Então** a foto guardada é **apagada** e a tela volta às iniciais

### AC-9: Troca de foto não fica presa em cache
- **Dado** uma foto que mudou
- **Então** a tela mostra a nova na próxima vez que a lista ou a conversa carregar — a URL carrega uma
  versão (o hash) que muda junto

### AC-10: Acesso restrito
- **Dado** uma pessoa sem acesso àquela conversa
- **Quando** tenta abrir a foto, mesmo com o link de quem tem
- **Então** recebe a **mesma resposta de "não encontrado"** de uma foto que não existe

### AC-11: Nada sensível em log
- **Dado** qualquer consulta de foto
- **Então** o endereço da foto no WhatsApp, a foto e o número consultado **nunca** aparecem em log

### AC-12: Usa a conexão que já existe
- **Dado** a busca da foto
- **Então** ela usa a instância e o token do canal que já existem — **sem chave nova e sem serviço de
  terceiros**

### AC-13: Preenchimento inicial sob demanda
- **Dado** conversas ativas de canais Evolution já existentes
- **Quando** o superadmin aciona o preenchimento inicial
- **Então** cada contato com foto pública passa a ter foto e os demais ficam com iniciais; a execução
  respeita o intervalo de 7 dias por contato, tem **teto de quantidade por execução** e pode ser
  repetida **sem duplicar nada**

### AC-14: Mensagem do aparelho não dispara consulta
- **Dado** uma mensagem enviada pelo próprio aparelho da operação (E02-S39)
- **Então** nenhuma consulta de foto é disparada

## Casos de borda e erros

- **Várias mensagens seguidas do mesmo contato:** uma consulta só, não uma por mensagem.
- **Mensagem duplicada** (idempotência do webhook): não dispara segunda consulta.
- **Contato sem telefone**, identificado só pelo `@lid`: a consulta usa o identificador que a Evolution
  aceita; sem foto, ficam as iniciais.
- **Conversa encerrada:** a foto continua aparecendo para quem pode ler a conversa.
- **Evolution fora do ar ou timeout:** registra `falhou`; nova tentativa só depois de 7 dias.
- **Arquivo que é imagem válida mas tem 2 MB:** recusado (AC-4).

## Fora de escopo

> Vinculante.
- Foto na lista e no perfil de **clientes** do PCM.
- Foto de quem escreve pelo Instagram ou pelo WhatsApp Cloud API (segue com iniciais).
- Foto de grupos.
- Fluxo de exclusão de dados a pedido do titular — não existe no sistema; fica registrado em
  `docs/SECURITY_DEBT.md` com a obrigação de apagar também as fotos guardadas quando existir.

## Rastreabilidade

- Análise: `docs/planejamento/port-evolution-triviatende.md` (b.6, b.7, c.6, e.2)
- Depende de: `E02-S36`
- Referência (somente leitura): `rosefish` spec `025-foto-do-contato/`;
  `supabase/functions/_shared/foto-do-contato.ts`, `preencher-fotos-evolution/index.ts`;
  `docs/runbooks/preencher-fotos-evolution.md`; migration `20261109140000`
