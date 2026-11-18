# ADR-1695 — API de domínio como fachada versionada sobre o staging existente (E01-S198)

**Status:** aceita · **Data:** 2026-11-18 · **Story:** E01-S198 · **Tier:** arquitetural (integração externa) · **P2**

## Contexto

O staging existe e é robusto: 27 migrations entre E01-S169/176/177/178. O que não existe é
**contrato**: hoje ~80 Edge Functions de propósito específico, sem versionamento nem superfície
única pro Módulo de Campo/MCP. O pacote marca BL 014 como P2 "desenhar agora, implementar por
etapas" e proíbe duas coisas: gravação direta na estrutura oficial sem staging, e SQL genérico
exposto.

## Decisão

- **Fachada, não reescrita.** `pcm-api-dominio` é uma Edge Function única com envelope
  versionado (`{versao, acao, requestId?, clienteId, payload}`) que mapeia AÇÕES NOMEADAS 1:1 pra
  RPCs de domínio JÁ EXISTENTES — nunca reimplementa a lógica de staging, autorização ou
  auditoria, que continuam vivendo exclusivamente nas RPCs (`config.sso_autorizar_acao`,
  `audit.events`). FR-007: não cria um segundo mecanismo de staging.
- **Etapa 1 (esta story): só `levantamento.*`** (E01-S178, `0315`/`0318`) — `criar_lote` e
  `consultar_previa`. Prova o padrão de principal valor (contrato versionado, cinco camadas,
  zero SQL genérico) sem tentar absorver as 80 funções de uma vez.
- **Client no contexto do usuário** (anon key + Authorization repassado), nunca `service_role` —
  é o que faz a autorização e a auditoria da RPC chamada serem do ATOR real, não do sistema.
  Mesmo padrão já estabelecido em `pcm-auvo-open-task` (E01-S196).
- **Guard de CI** (`scripts/check-api-dominio-cinco-camadas.mjs`, SC-004): falha o build se o
  arquivo da API ganhar chamada de RPC com nome dinâmico, padrão de SQL genérico, ou uso de
  `service_role` — trava estrutural contra a API virar túnel pro banco (AC-8), não só revisão
  humana.

## SPEC_DEVIATION — registrado, não corrigido nesta etapa

**`levantamento.aprovar`/`rejeitar` (AC-5/AC-6/AC-7) não entraram nesta etapa.** A RPC real
(`sso_aprovar_linhas_parcialmente`, `0883`) está com `EXECUTE` **revogado** de `authenticated` e
atrás de dois gates fechados (`sso_aprovacao_parcial_gate`, `sso_incorporacao_aprovacao_gate`).
Expor aprovação pela API exigiria decidir a reabertura desses gates primeiro — uma decisão de
"ir ao ar" com sign-off humano separado (mesmo padrão de outras stories desta sessão), não um
commit de dev. Fica registrado como próxima etapa explícita, não um buraco silencioso.

AC-3 ("erro por linha/item, itens válidos não são perdidos") é parcialmente literal: a RPC
`sso_receber_levantamento` valida o lote inteiro antes de gravar qualquer linha (tudo-ou-nada na
entrada) — não existe gravação parcial de linhas válidas dentro de um lote rejeitado. Isso
satisfaz a garantia mais importante ("nada inválido chega ao oficial"), mas não o "erro granular
por item numa única resposta" que a redação sugere. Mudar esse comportamento é mexer na RPC já
testada (0315), fora do escopo desta story (FR-007: reusar, não reescrever).

## Consequências

- Positiva: primeira superfície de contrato real, versionada, auditável por grep estático
  (guard de CI), sem duplicar nenhuma regra de domínio.
- Negativa/aceita: só 2 das ~6 ações do contrato completo estão nesta etapa; aprovação/rejeição
  aguardam decisão de ativação de gate.
- Reversível: nenhuma migration nova; remover a Edge Function não afeta as RPCs que ela chama.

## Referências

`supabase/functions/pcm-api-dominio/index.ts` · `scripts/check-api-dominio-cinco-camadas.mjs` ·
`specs/E01-S198-api-dominio-staging/` · `0315`/`0318`/`0883_E01-S178_*` · ADR-1694 (mesmo padrão
de client no contexto do usuário).
