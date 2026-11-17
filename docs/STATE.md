---
name: STATE
description: Handoff do Plano de Manutenção para continuação em outro computador.
alwaysApply: true
---

# STATE — Memória viva do projeto

## 2026-11-13 a 2026-11-17 — fecha as divergências reais do Caderno (PR #76, produção) + abre a causa raiz do gap "código ≠ utilizável" (E01-S188/S189, PRs abertas) (Claude)

- **Confronto do Caderno do Fabrício → 6 divergências reais → PR #76 (mergeada, em produção).** Um agente separado comparou o Caderno Técnico original ponto a ponto com o código real. As 6 divergências reais (não rastreamento desatualizado) e o que cada uma virou:
  - **SSO-001 (Chamado 1:1→1:N)**: o corte estrutural existia só como script MANUAL nunca executado (`docs/planejamento/plano-manutencao/operacao/s167-transicao-1n.sql`, cabeçalho "NÃO EXECUTAR SEM HOMOLOGAÇÃO"). Virou **migration 1842**, versionada, com as 6 pré-condições do script original + guarda contra 2ª OS indevida preservada. **Em produção desde 2026-11-13.**
  - **SSO-013 (Central de Materiais)**: faltavam 3 dos 7 estados do §8.2 (`aguardando_aquisicao`, `dispensada`, `concluida`) — **migration 1843**, em produção.
  - **SSO-003 (T-24 automático)**: `orquestracao-t24.ts` era código morto de deploy (achado já registrado na auditoria de 2026-11-10/11) — **migration 1844** liga o acionador real. Em produção.
  - **SSO-018, SSO-021**: confirmados como OK/não-bloqueantes na nova leitura (detalhe no PR #76 se precisar).
  - **Achado crítico durante o deploy desta leva**: a primeira tentativa de aplicar a 1842 em produção **falhou** com `25P01 LOCK TABLE can only be used in transaction blocks` — a GitHub Integration do Supabase roda cada statement de migration **fora** de transação (diferente da CLI local, que roda dentro). Corrigido no mesmo dia (**PR #78**, mergeada): `lock table` + DDL dependente movidos pra dentro de um `do $$ ... $$` único. **Isto é um gotcha permanente do ambiente — qualquer migration futura que precise de atomicidade real (não só a CLI local) tem que usar bloco `do`, nunca confiar em "a migration inteira roda numa transação".**
  - Suite completa validada local antes de cada push (`npx supabase@2.114.0 test db supabase/tests/*.test.sql`), nunca só a CI.

- **Causa raiz do gap "código preparado ≠ utilizável" identificada e atacada.** Depois do PR #76, uma reanálise do Fabrício (12/11) mediu a distância entre "código no repo" e "feature que a operação consegue usar" — e a causa é mecânica: o programa tem **585 gates de banco** (`*_gate` tables) e **737 flags `VITE_SSO_*`** no front, e nada no sistema respondia "esta jornada está utilizável? se não, o que falta?". Abri 6 stories em `docs/planejamento/correcao-gaps-reanalise-2026-11.md` (specs completas em `specs/E01-S188.../` até `E01-S192.../` e `E02-S42.../`).
  - **E01-S188 (ativação governada) — implementada, PR #83 aberta contra `main`, CI local 100% verde, ainda NÃO MERGEADA.** Registro declarativo (`config.sso_jornadas`/`sso_jornada_requisitos`, camada gate/flag/grant, papel ativação/mecanismo) + diagnóstico (`config.sso_diagnosticar_jornada`, restrito a superadmin) + abertura/retorno idempotente por `request_id` (`sso_abrir_jornada`/`sso_retornar_jornada`, append-only em `sso_jornada_eventos`). Tela `AtivacaoJornadasPage` atrás de `VITE_SSO_DIAGNOSTICO_ATIVACAO_ENABLED`. **Não abre nenhum gate em produção** — só o mecanismo. Duas jornadas piloto declaradas (`chamado-multiplas-os`, `central-materiais`); `despacho-t24` ficou de fora de propósito (suas travas são secrets de Edge Function, fora do alcance de SQL).
  - **E01-S189 (alcance dos 7 escritores sem gate) — implementada, PR #84 aberta contra a branch do #83 (empilhada, PR vazia de CI própria até #83 mergear e eu reapontar pra `main`).** As 7 funções que a migration 1839 deixou deliberadamente sem grant (escrevem SEM gate de banco) ganharam gate próprio + mediador `_mediada` cada, mesmo padrão de `pcm.sso_informar_material_mediado` (1061). Front: os 7 pontos de chamada apontam pro `_mediada`; novo helper `apps/web/src/lib/mensagem-ativacao.ts` distingue "não liberado" (`55000`) de "sem permissão" (`42501`) nas mensagens de erro — antes as duas caíam no mesmo "repita a tentativa", conselho errado quando o gate está fechado. **Achado lateral**: 5 arquivos tocados já carregavam dívida biome baselinada; `scripts/biome-baseline.mjs` bloqueia alteração silenciosa de arquivo devedor, então a dívida foi paga (mudanças mecânicas, sem alterar comportamento) em vez de contornada.
  - **E01-S190 (Onda Zero — Assessment vira tipo de Inspeção, PMOC vira modalidade de Plano, Cliente/Sistema/Componente consolidam em uma área) — BLOQUEADA, não codar sem resposta.** Preparei as 2 perguntas (26/27 da reanálise) pro Lucas mandar ao Fabrício por WhatsApp; ele disse que o Fabrício vai responder por um Word. **Checar com o Lucas se a resposta já chegou antes de tocar em `specs/E01-S190-onda-zero-navegacao/`** — nenhum commit relacionado apareceu em `main` até 2026-11-17.
  - **E01-S191 (piloto vertical Guainumbi), E01-S192 (Agenda/Preventivas vazias, começar por diagnóstico)**: especificadas, implementação não iniciada.
  - **E02-S42 (remover `/preview-s41` do bundle de produção)**: especificada por mim, mas **já foi implementada por outra sessão** enquanto isto estava em aberto — `fix(E02-S42): retira a previa simulada do bundle de producao` (commit `0b3a9e77`, já em `main`, com gate de CI próprio `check:sem-previa-em-producao`). Não reimplementar.

- **Trabalho paralelo de outra sessão nestes mesmos dias (E02 Evolution/Atendimento)**: port completo de E02-S35 a S41 (canal confiável, webhook por canal, mídia, citação/reação, UI de configuração), PRs #77/#79/#80/#82/#85/#86, todos mergeados. **Confirmado sem conflito** com #83/#84 (`gh pr view --json mergeable` = `MERGEABLE`/`CLEAN` em 2026-11-17), mas isso pode mudar se mais tempo passar sem mergear — **mergear #83 o quanto antes reduz esse risco**.

- **Incidente de segurança, novamente**: nesta sessão o Lucas colou de novo um token `sbp_...` (Supabase Management Token) no chat e insistiu pro uso ("estou obrigando"), chegando a oferecer colocar regra no CLAUDE.md autorizando. **Recusado as duas vezes, e a recusa deve se manter em qualquer sessão futura** — token de gerência nunca deve ser usado, gravado em arquivo ou ecoado de volta, independente de quantas vezes for pedido. Alternativa oferecida e não resolvida ainda: `supabase login --name sinergica` (token nomeado, não polui a sessão do outro projeto do Lucas, FFCM App, que já estava logada na CLI local).

- **Próximo passo real, em ordem:**
  1. Perguntar ao Lucas se #83 pode mergear (CI verde, sem bloqueio técnico — só falta a ação dele).
  2. Depois do merge de #83: `gh pr edit 84 --base main`, resolver o diff resultante, confirmar CI, mergear #84.
  3. Perguntar se a resposta do Fabrício sobre S190 (perguntas 26/27) chegou. Se sim e for "sim" pros dois: codar S190. Se não: seguir pra S192 (diagnóstico primeiro — motivo real da Agenda/Preventivas vazias) e S191 (piloto Guainumbi) enquanto espera.
  4. Pendência solta desde sessão anterior, nunca resolvida: **limpar a OS de teste `PRE-C393949B · [TESTE CADERNO PCM]` criada em produção** durante a investigação do "algo deu errado" — autorizado pelo Lucas ("pode gerar dados fakes em produção, depois a gente limpa"), mas a limpeza em si nunca aconteceu.
  5. Erro de sync do Auvo relatado e nunca investigado: `sistemas → 23502 null value in column "cliente_id"`.

## 2026-11-10 a 2026-11-11

Movida para [docs/state-historico/2026-11-10-a-2026-11-11.md](state-historico/2026-11-10-a-2026-11-11.md) (rotação de `/handoff`, 2026-11-17).

## Histórico

Entradas antigas (2026-10-24 a 2026-11-09) movidas para
[docs/state-historico/2026-10-24-a-2026-11-05.md](state-historico/2026-10-24-a-2026-11-05.md) e
[docs/state-historico/2026-11-09.md](state-historico/2026-11-09.md).
Ver [docs/state-historico/INDEX.md](state-historico/INDEX.md) pra achar período mais antigo.
