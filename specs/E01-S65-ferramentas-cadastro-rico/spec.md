---
name: spec
description: Contrato — cadastro de ferramenta mais fácil e completo, com imagem (via campo imageUrl já existente na API Auvo, sem Storage novo).
alwaysApply: true
---

# Spec — E01-S65 · Cadastro rico de ferramenta (mais fácil, com imagem)

> **Fonte da verdade.** Status: pronto para implementar · Tier: pequeno
> Origem: feedback Fabrício 2026-07-13 — "tela de cadastro de ferramenta para o técnico precisa
> ser mais fácil, com mais opções, se possível ver imagem, se possível cadastrar imagem na hora
> do cadastro (armazenamento no Auvo)".

## Achado técnico (verificado contra a API real em 2026-07-13)
`GET /products` do Auvo **já devolve** `imageUrl` (string, hoje vazia nas ferramentas cadastradas)
e `uriAttachments` (array). O campo existe no contrato de leitura. **Não confirmado**: se
`POST`/`PATCH /products` aceitam `imageUrl` para escrita (não documentado na auditoria existente,
`docs/AUDITORIA-AUVO-API.md`) — precisa de teste de contrato real antes de codar (mesma disciplina
das demais entidades do motor de sync, lição do `taskID`).

**Decisão do PO (2026-07-13):** não assumir custo/complexidade de Supabase Storage agora.
Se `imageUrl` aceitar escrita via API → PCM manda a URL (upload em si continua fora do PCM: o
técnico/escritório hospeda a imagem em algum lugar e cola a URL, ou usa o cadastro complementar
do Auvo). Se não aceitar escrita → V1 só **exibe** `imageUrl` quando o Auvo já tiver (cadastrado
pela equipe direto no Auvo), sem tentar escrever; cadastro de imagem fica documentado como
"complementar no Auvo" até haver decisão de Storage.

## Resumo
Reformula o formulário de ferramenta (hoje: nome, descrição, categoria, quantidade total,
mínima — `FerramentaFormData` em `domain/ferramentas.ts`) com campos que já existem no Auvo mas
não são expostos na tela (`code`, `unitaryValue`/`unitaryCost` já mapeados no descriptor mas sem
UI de edição — conferir `ferramentas.ts` do registry), preview de imagem, e UX mais guiada
(categoria com busca, validação inline, menos cliques).

## Critérios de aceite

### AC-1: Verificar contrato de escrita de imagem
- **Dado** acesso à API Auvo real
- **Quando** testado `PATCH /products/{id}` com `imageUrl` num produto de teste reversível
- **Então** o resultado (aceita ou não) fica documentado nesta pasta antes de decidir o caminho da AC-2

### AC-2: Campo de imagem no formulário
- **Dado** o resultado da AC-1
- **Quando** o formulário de ferramenta é renderizado
- **Então**: se escrita aceita → campo de URL de imagem editável, com preview; se não aceita →
  campo somente leitura mostrando `imageUrl` do Auvo (quando houver) com aviso "cadastre a foto
  direto no Auvo" e link

### AC-3: Formulário mais completo
- **Dado** o usuário cadastrando/editando uma ferramenta
- **Quando** abre o formulário
- **Então** vê também valor unitário, custo unitário e código Auvo (`code`) quando sincronizada —
  hoje mapeados no descriptor mas invisíveis na UI

### AC-4: UX mais fácil
- **Dado** o formulário atual (modal simples)
- **Quando** reformulado
- **Então** categoria ganha busca/autocomplete (lista pode crescer), validação aparece inline sem
  precisar submeter, e o preview da imagem (se houver) aparece na lista de ferramentas também

## Fora de escopo
> Vinculante.
- Upload de arquivo binário / Supabase Storage — decisão adiada pelo PO.
- Reconhecimento de imagem / IA sobre a foto.
- Múltiplas imagens por ferramenta (`uriAttachments` fica só leitura, se existir, sem gestão).

## Rastreabilidade
- Origem: feedback Fabrício 2026-07-13 + decisão do PO (sem Storage agora).
- Contrato Auvo: `GET /products` confirmado com `imageUrl`/`uriAttachments`/`code` em 2026-07-13
  (curl direto, ver task 1) — escrita não confirmada.
- Arquivos-âncora: `apps/web/src/features/pcm/domain/ferramentas.ts` (`FerramentaFormData`),
  `pages/FerramentasPage.tsx`, `supabase/functions/_shared/auvo/registry/ferramentas.ts`
  (`AuvoProduct` já tem os campos de valor; adicionar `imageUrl`/`code` ao tipo).
