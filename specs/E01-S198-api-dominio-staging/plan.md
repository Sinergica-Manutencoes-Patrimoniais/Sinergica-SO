# Plano técnico — E01-S198

Ver ADR-1695 pra decisão completa. "Desenhar agora, implementar por etapas" (P2) — esta etapa
cobre `levantamento.criar_lote`/`levantamento.consultar_previa`, reusando `0315`/`0318`.

## Caminho de navegação (AC-F1)

Esta story não é consumida por uma tela do PCM — é a API que o **Módulo de Campo** e o **MCP**
(E02-S43, bloqueada até esta story homologar) vão chamar via HTTP. Não há botão novo no PCM.
"Caminho de navegação" aqui é o contrato em si: `POST /functions/v1/pcm-api-dominio` com
`{versao:"v1", acao, requestId?, clienteId, payload}`.

## Flags (AC-F2)

Nenhuma `VITE_SSO_*` nova — é uma Edge Function, não um recurso de frontend gated por flag.

## "Disponível, não ativado" (AC-F3)

N/A direto — mas o comportamento equivalente existe: chamar `levantamento.criar_lote` sem a
capacidade `cadastro.gerir` concedida devolve 403 nomeado ("Sem acesso a este Cliente ou
recurso."), nunca 500 genérico nem silêncio.

## Gate novo (AC-F4)

Nenhum gate de banco novo — reusa os gates já existentes de `0315`/`0318` (abertos, já que essas
RPCs estão granted e em uso). `levantamento.aprovar`/`rejeitar` (próxima etapa) herdarão os
gates de `0883`, que continuam fechados — procedimento de abertura: ver ADR-1695, decisão humana
separada, fora desta story.

## Linha de ativação (AC-F5)

A Edge Function está pronta e tipada (`deno check` limpo); falta: (1) declarar
`pcm-api-dominio` na infra real de deploy (feito em `supabase/config.toml`, `verify_jwt=true`);
(2) o Módulo de Campo/MCP ainda não existem como consumidores reais — esta story entrega o
contrato, não um cliente que o chame; (3) `levantamento.aprovar`/`rejeitar` aguardam decisão de
reabertura de gate (ADR-1695) antes de entrar no contrato v1.

## SPEC_DEVIATION

Ver ADR-1695: aprovação/rejeição fora desta etapa (RPC ungranted + 2 gates fechados); AC-3 só
parcialmente literal (tudo-ou-nada na entrada do lote, não erro granular por item numa resposta
só) — mudar isso tocaria a RPC já testada, fora do escopo de reuso (FR-007).
