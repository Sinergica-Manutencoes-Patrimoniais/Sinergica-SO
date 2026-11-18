# Plano técnico — E01-S197

## Achado prévio (antes de codar) — a story já estava quase inteira implementada

Investigação direta do código (E01-S173/174, antes de escrever qualquer linha nova):

- **AC-1/AC-3 (agrupamento por ativo, sem duplicar achado)**: `PendenciasTecnicasWorkspace.tsx`
  JÁ agrupa a lista flat de `sso_listar_pendencias_por_ativo`/`sso_listar_pendencias_contexto_mediado`
  num `Map` por `(alvo_tipo, alvo_id)`, renderizado como `<section aria-label="Pendências de
  {grupo.nome}">` — um cartão por ativo, com todas as pendências daquele ativo dentro. Funciona
  pros três `alvo_tipo` (`sistema`/`componente`/`grupo`) pela mesma lógica, sem código extra —
  cobre a troca de eixo sem duplicar, porque cada pendência só pertence a UM alvo.
- **AC-2/AC-8 (seleção parcial sem efeito colateral)**: a seleção é por pendência individual
  (checkbox), e `sso_compor_backlog_pendencias` **não altera `estado`** da pendência ao compor —
  só cria uma linha de LINK em `sso_backlog_pendencias`. "Conservar a situação anterior" é
  literal: nada muda no registro da pendência, composta ou não.
- **AC-4/AC-5/AC-6 (Não OK gera pendência, sem Chamado/OS, outros resultados não geram)**:
  `pcm.sso_registrar_pendencia_retorno` (`0371_E01-S173`) só aceita
  `v_resposta.resultado = 'nao_ok'` — qualquer outro valor (`ok`/`nao_aplicavel`/
  `nao_inspecionado`/`corrigido`, enum de `0348_E01-S168`) é recusado com `resultado_nao_elegivel`.
  A função só grava em `sso_pendencias_tecnicas`/`audit.events` — nenhuma OS ou Chamado.
- **AC-7 (rastreabilidade)**: `sso_pendencias_tecnicas` já carrega `resposta_id`, `retorno_id`,
  `os_id`, `ocorrencia_id`, `rotina_id`, `alvo_tipo`, `alvo_id` — rastreabilidade completa por
  desenho de schema, não por código novo.
- **AC-9 (reabertura não duplica)**: `resposta_id uuid not null unique` + `on conflict(resposta_id)
  do nothing returning id` — reenviar o mesmo achado sempre devolve a mesma pendência.

**O que faltava**: a prova automatizada do cenário LITERAL que o Fabrício escreveu como AC
(SC-001: "7 achados, 2 ao Backlog, 5 conservadas") não existia num teste próprio — a cobertura
existente (`E01-S173_origem_pendencia_divergente.test.sql` e os `manual_*`) testa origem e
divergência, não esse cenário específico ponta a ponta.

## O que foi feito nesta story

`supabase/tests/E01-S197_pendencias_agrupadas_ativo.test.sql` (20 assertions, **nenhuma
migration nova** — "nenhuma entidade nova", confirmando o próprio Key Entities da spec):
reusa a fixture `E01-S173_retorno_aprovado_fixture.sql` (1 resposta `nao_ok` já aprovada, alvo
= Grupo quantitativo — cobre de graça o Edge Case "sem TAG individual") e acrescenta mais 6
respostas no mesmo retorno (mesmo "quadro"), sendo 5 `nao_ok` + 1 `ok` (prova negativa do AC-6 no
mesmo lote). Prova: 6 pendências reais no mesmo alvo (AC-1/AC-3), rastreabilidade (AC-7), dedup
(AC-9), zero OS/Chamado novo (AC-5), composição de 2 das 6 sem alterar o estado das outras 4
(AC-2/AC-8), e que recompor uma pendência já composta é recusado.

## Alcance no front (AC-F1/AC-F2)

- **Caminho de navegação (AC-F1)**: tela de Pendências Técnicas (`PendenciasTecnicasWorkspace.tsx`,
  montada onde o Cliente 360/Capacidade expõe "Pendências técnicas") → lista já agrupada por
  ativo → checkbox de seleção por pendência → "Compor Backlog".
- **Flags (AC-F2)**: `VITE_SSO_PENDENCIAS_TECNICAS_ENABLED`, `VITE_SSO_PENDENCIAS_FILTRO_ATIVO_ENABLED`,
  `VITE_SSO_BACKLOG_COMPOSICAO_ENABLED` — já usadas em código existente (E01-S173/174), nunca
  declaradas em `.env.example`; declaradas agora (achado do mesmo tipo que motivou a regra
  "alcance no front"). `netlify.toml` não alterado — nenhuma das três tem valor real conhecido em
  produção pra declarar com segurança ali (diferente de E01-S195, que introduziu uma flag nova
  com decisão própria).
- **AC-F5 (linha de ativação)**: nenhum código novo de backend/frontend — se a jornada já está
  visível em produção, é porque os gates de banco (`sso_pendencias_gate`,
  `sso_backlog_composicao_gate`, etc., todos pré-existentes) e as 3 flags acima já foram abertos
  antes desta story; não verificado aqui (fora do alcance de uma sessão sem acesso a produção).

## Fora de escopo (confirmado, não tocado)

Redefinição de Equipamento/Componente/Grupo quantitativo (anexo em validação); publicação pro
Portal (E01-S183); priorização GUT (E01-S193/191).
