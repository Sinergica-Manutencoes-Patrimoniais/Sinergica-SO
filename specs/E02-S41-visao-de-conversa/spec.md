---
name: E02-S41-visao-de-conversa
description: Workspace de atendimento em três colunas — fila com escopo, timeline tipada, contexto do cliente e ações de handoff — sobre os dados existentes da Sinérgica
alwaysApply: true
---

# Spec — E02-S41 · Visão de conversa nova

> **Fonte da verdade.** Status: rascunho
> Tier: **arquitetural** (substitui a superfície inteira do Atendimento e troca o contrato do
> repositório). Desenho visual e de sistema em `./design.md`, **antes** do código.

## Resumo

O atendimento ganha o workspace de três colunas — fila à esquerda, conversa no centro, contexto do
cliente à direita —, com a fila filtrável por escopo e contador de "aguardando humano", a timeline
renderizando cada tipo de conteúdo como ele é, rascunho preservado por conversa e ações de assumir,
devolver, transferir e encerrar com confirmação.

## Contexto

Hoje `ConversaChat.tsx` (10 KB) faz cabeçalho, mensagens, composer, tags, IA e histórico num componente
só; `ConversaLista.tsx` não tem escopo nem contador; `ConversaPerfil.tsx` é raso. Com S37–S39 a
mensagem passou a ter tipos (mídia, aviso, citação, reação, aparelho) que a bolha atual não sabe
mostrar.

Esta story **não muda schema** — é a camada de interface sobre o que S35–S40 construíram, com o
contrato de porta explícito do TriviAtende.

Base: `docs/planejamento/port-evolution-triviatende.md`, seção (d).

## Critérios de aceite

### AC-1: Workspace de três colunas
- **Dado** a rota `/atendimento`
- **Então** a tela mostra fila, conversa e contexto; em tela estreita, a coluna de contexto vira
  painel sobreposto e a fila vira lista de nível anterior
- **E** a rota `/atendimento/conversas/:id` abre direto naquela conversa

### AC-2: Fila com escopo
- **Dado** a fila
- **Quando** o atendente escolhe o escopo `ativas` / `encerradas` / `todas`
- **Então** a lista reflete o escopo, com busca por cliente, contato e prévia, sem diferenciar
  maiúsculas nem acentos

### AC-3: Contador conta quem aguarda humano
- **Dado** a fila com conversas em `auto`, com atendente e aguardando humano
- **Então** o badge conta **só as que aguardam humano**, não o total

### AC-4: Timeline tipada
- **Dado** uma conversa com texto, imagem, vídeo, documento, figurinha, áudio com transcrição, aviso,
  citação e reação
- **Então** cada uma é renderizada como o seu tipo, na ordem de chegada, com o rótulo do autor correto:
  "Agente Zé", "Você", "Pelo celular", "Mensagem automática do WhatsApp"

### AC-5: Rascunho preservado por conversa
- **Dado** um texto digitado e não enviado
- **Quando** o atendente troca de conversa e volta
- **Então** o rascunho **continua lá**, e as ações de devolver, transferir e encerrar avisam que há
  rascunho antes de executar

### AC-6: Quem age nunca vem do browser
- **Dado** qualquer ação de assumir, devolver, transferir ou encerrar
- **Então** o ator **não** é enviado pelo cliente — é resolvido no servidor a partir da sessão
  (`auth.uid()`); um corpo que tente informar outro ator é ignorado

### AC-7: Permissão vem do servidor
- **Dado** a conversa aberta
- **Então** se o atendente pode ou não responder é um **sinal calculado no servidor**, não uma
  comparação de ID feita no browser; sem permissão, o compositor fica desabilitado com o motivo

### AC-8: Conflito de versão é tratado
- **Dado** uma conversa alterada em outra sessão
- **Quando** o atendente tenta assumir, transferir ou encerrar
- **Então** a tela mostra "Esta conversa mudou em outra sessão. Recarregue antes de tentar novamente",
  e **nada é sobrescrito**

### AC-9: Envio idempotente
- **Dado** um envio que falhou por rede e é repetido
- **Então** o mesmo `operacaoId` é reusado e o banco **não duplica** a mensagem

### AC-10: Contexto do cliente
- **Dado** a coluna de contexto
- **Então** mostra nome, foto ou iniciais, telefone, cliente vinculado, tags, chamados e OS
  relacionados, e a última interação — com os campos que o papel do usuário pode ver
- **E** a preferência de coluna aberta/fechada é lembrada entre visitas, degradando em silêncio quando
  o armazenamento do navegador não está disponível

### AC-11: Dados de servidor via TanStack Query
- **Dado** qualquer dado de servidor nesta tela
- **Então** ele passa por TanStack Query com chaves em `atendimentoQueryKeys`, `keepPreviousData` nos
  filtros, cancelamento de requisição antiga, e invalidação da chave após cada escrita
- **Nenhum** `useState` + `useEffect` + `carregar()` para dado de servidor

### AC-12: Sem regressão funcional
- **Dado** o que o `ConversaChat` atual faz — enviar texto, enviar mensagem rica, emoji, templates,
  tags, acionar o Zé, devolver ao Zé, enviar histórico do chamado, custo de IA por mensagem e total
- **Então** tudo continua acessível na tela nova

### AC-13: Acessibilidade e movimento
- **Dado** a navegação por teclado
- **Então** fila, conversa e ações são alcançáveis, com foco visível e `aria-label` nas ações
- **E** com `prefers-reduced-motion`, nenhuma animação de entrada roda

### AC-14: Tudo por token semântico
- **Dado** qualquer componente desta tela
- **Então** não existe cor, raio, sombra, duração ou degrau tipográfico **hardcoded**: tudo vem dos
  tokens do E00-S14/S18/S19/S20
- **E** o laranja (`--color-orange`) aparece **só** em CTA, estado ativo e prioridade — **não** como
  fundo de bolha de mensagem (ver `design.md`, "Bolha de mensagem")

### AC-15: Estados desenhados, não improvisados
- **Dado** fila vazia por filtro, fila vazia de verdade, conversa não selecionada, carregando,
  enviando, falha de envio, sem permissão e conflito de versão
- **Então** cada um tem a forma descrita em `design.md`, com texto que diz o que aconteceu e qual é a
  saída — nenhuma tela em branco e nenhum spinner genérico
- **E** o skeleton tem a **mesma métrica** do conteúdo real (72 px por item de fila), sem salto de
  layout quando o dado chega

### AC-16: Contraste nos dois temas
- **Dado** o tema claro e o escuro (E00-S22)
- **Então** texto e ícone atingem contraste AA em todas as variantes de bolha, selo e estado
- **E** imagem e vídeo reservam `aspect-ratio` antes do byte chegar, sem salto de layout

## Casos de borda e erros

- Conversa sem mensagens: estado vazio explicativo, não tela em branco.
- Conversa encerrada: timeline em leitura, compositor desabilitado com o motivo, reação ainda aparece.
- Mensagem sendo enviada (`status_entrega='enviando'`): aparece otimista com indicador; falha mostra
  "não enviada" com "tentar de novo" que reusa o `operacaoId`.
- Lista longa: paginação por offset com `keepPreviousData` — filtro novo nunca é sobrescrito por
  resultado antigo.
- Anexo cujo arquivo não abre: cai para o cartão com nome e aviso, sem imagem quebrada.

## Fora de escopo

> Vinculante.
- Mudar schema (tudo veio de S35–S40).
- Resumo da conversa por IA e sinal comercial (são do TriviAtende, não se aplicam).
- Transferência entre grupos com escopo (a Sinérgica usa `atribuido_a` simples).
- Flow builder, personas, conhecimento e demais abas de configuração.
- Canais Meta.

## Rastreabilidade

- Desenho: `./design.md` (layout, densidade, anatomia da bolha, estados, movimento, riscos)
- Análise: `docs/planejamento/port-evolution-triviatende.md` (d, e.3)
- Linguagem visual de referência: `rosefish/DESIGN.md` — **método portado, paleta não**: a Sinérgica
  mantém navy + laranja + papel quente do E00-S14
- Depende de: `E02-S37`, `E02-S38`
- Referência (somente leitura): `rosefish`
  `apps/web/src/modules/atendimento/interfaces/` (`WorkspaceDeAtendimento`, `FilaDeConversas`,
  `PainelDaConversa`, `TimelineDaConversa`, `CompositorDeResposta`, `PainelDeContextoDoCliente`,
  `AcaoDeHandoff`, `AcaoDeEncerrar`, `estado-do-workspace`, `contador-da-fila`,
  `preferencia-do-contexto`) e `application/portas.ts`
- Convenções internas: `CLAUDE.md` (TanStack Query obrigatório), `docs/epics/` do E00 para tokens e
  primitivas de UI
