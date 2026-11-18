# Plano técnico — E01-S194

## Achado prévio (antes de codar)

`pcm.fn_operacao_alterar_status_lote` (0178) — usada pelo dropdown de status, pelo drag do
Kanban e pela ação em lote — só validava que o status alvo era um dos 7 conhecidos. **Não
validava a transição nem exigia nenhuma capacidade.** Qualquer usuário com escrita em `pcm`
conseguia mover qualquer OS direto pra `finalizado`, sem nunca passar pela decisão do PCM — o
mesmo padrão de achado da E00-S26/E00-S27 (capacidade sensível sem gate), só que no domínio de
Operação em vez de SSO.

Segundo achado: a própria migration `1854` (E01-S193) deixou documentado que Chamado em
`'demanda'` virava dead-end — `pcm.sso_criar_os_chamado` só aceitava `'aberto'/'convertido_os'`.
Sem fechar isso, a coluna "Demanda" do Kanban aprovado nunca teria caminho pra OS.

## O que foi corrigido (migration `1855`)

- **AC-8** — `pcm-auvo-webhook`/`pcm-auvo-tasks-import`: tarefa finalizada no Auvo (`taskStatus=5`)
  agora mapeia pra `'validacao_pcm'`, não `'finalizado'` direto. Side-effects de captura de campo
  (resultado de preventiva, resync de assessment, registro de visita PMOC) passam a disparar em
  `'validacao_pcm'` **também** (helper `chegouAoCampo`) — descrevem o que aconteceu no campo, não
  a decisão do PCM, então não devem esperar por ela.
- **AC-10** — `pcm.fn_operacao_alterar_status_lote`: entrar em `'finalizado'` agora exige
  `config.sso_autorizar_acao('execucao.validar', cliente_id)` — a mesma capacidade que já guarda
  toda a família de validação/finalização (0348/0375/0560/0607). Erro nomeado `sem_acesso`, sem
  deixar estado parcial.
- **AC-4/AC-9** — `pcm.sso_criar_os_chamado`: aceita Chamado em `'demanda'`; a OS nasce direto em
  `'planejamento'` (não `'solicitacao'` — o Chamado já passou da triagem). Caminho `'aberto'`
  original intocado. **Corrigido via cirurgia de texto sobre `pg_get_functiondef`** (mesmo padrão
  de `1475`/`1499`) — um `create or replace` ingênuo com o corpo "limpo" apagaria os dois remendos
  anteriores dessa função (concorrência/escopo de `1475`, token de guarda de múltiplas OS de
  `1499`); confirmado reproduzindo o achado: quebrava
  `E01-S167_ensaio_multiplas_os.test.sql` com `novo_vinculo_exige_comando_chamado_os` antes da
  correção.
- **AC-1/AC-4** — `pcm.operacao_itens`: estende o branch sintético (`chamado-aberto:`, 1509) pra
  incluir `status in ('aberto', 'demanda')` com `status` dinâmico (era fixo em `'solicitacao'`) —
  Chamado em Demanda sem OS ainda aparece no Kanban, mesmo padrão já usado pra Chamado recém-aberto.
- Os 3 agregados de "etapas mistas" (`sso_resumir_chamados_lote`, `sso_listar_chamados_gerenciais`,
  `sso_listar_chamados_gerenciais_v2`) ganham `'validacao_pcm'` na whitelist — sem isso, um
  Chamado com alguma OS nessa etapa nunca seria sinalizado como misto (falso negativo silencioso).

## Frontend

- `StatusOrdemServico`/`STATUS_OS` ganham `'validacao_pcm'` ("Validação PCM").
- `kanban-colunas.ts`: `COLUNAS_KANBAN_PADRAO` vira exatamente
  `Solicitações · Preventivas · Demanda · Planejamento · Em execução · Validação PCM · Finalizado`
  (AC-1). `backlog` sai (painel lateral já existente, `PainelLateralBacklog.tsx` — manter como
  coluna duplicaria o cartão, proibido por AC-3). `cancelado` sai (filtro de status já existente
  cobre AC-2). `corretiva` sai — confirmado por grep que nunca foi escrito como `status` real de
  OS nesta base (é a `categoria`, campo diferente); remover a coluna não perde dado.
  `normalizarColunasKanban` já reconcilia preferência salva antiga sem ressuscitar coluna extinta
  (comportamento pré-existente, só testado de novo contra o novo conjunto).
- "Demanda" é coluna virtual do ponto de vista de `ColunaKanbanId` (mesmo padrão de "preventiva")
  — mostra cartão sintético quando o Chamado em `demanda` ainda não tem OS.

## SPEC_DEVIATION — registrado, não corrigido nesta story

1. **AC-5, "Campo a conciliar"**: não virou coluna. A fonte real (E01-S175,
   `pcm.sso_origem_campo_processamentos.provisorio` + `pcm.chamados`/`ordens_servico` provisórios
   de `1428`/`1429`) não foi mapeada a tempo pra virar uma 3ª coluna virtual confiável — uma
   coluna sempre vazia por falta de wiring seria pior que a ausência documentada. Story de
   continuação: replicar o padrão desta story (branch adicional no `operacao_itens` ou consulta
   separada) sobre a tabela de triagem do E01-S175.
2. **AC-7, matriz de transição completa**: só a transição de maior risco (entrar em `finalizado`)
   ganhou gate nesta story. O dropdown de status no drawer do Kanban ainda permite qualquer outro
   salto entre os status restantes — inventariar todos os chamadores (lote, drag, automação,
   `ConversaoIntegral.tsx`) antes de fechar o resto é trabalho de story dedicada; fechar sem esse
   inventário arriscava quebrar caminho legítimo não mapeado.
3. **Fluxo de drag "Demanda → conversão em OS" não verificado ponta a ponta nesta story**: o
   drawer intercepta drag de cartão sintético (`ehCardChamadoAberto`) num fluxo de "conversão"
   próprio (`ConversaoIntegral.tsx`/`sso_converter_chamado_integral`, também remendada
   cirurgicamente em `1475`) que não foi rastreado até o fim. O que está provado e testado: a OS
   nasce correta quando `sso_criar_os_chamado`/`sso_criar_os_chamado_autorizado` é chamado
   diretamente com um Chamado em `demanda` (pgTAP). O caminho de UI "arrastar o cartão sintético
   de Demanda pro Kanban" não foi exercitado — verificar antes de homologar a jornada completa.
4. **AC-F1–AC-F5 (alcance no front)**: nenhuma flag `VITE_SSO_*` nova foi introduzida nesta story
   (`fn_operacao_alterar_status_lote`/`sso_criar_os_chamado` já eram chamados pelo código
   existente; a mudança é só na validação dentro deles). Os dois gates que a jornada completa
   depende (`pcm.chamado_os_gate`, `pcm.sso_criacao_os_mediada_gate`) já existiam antes desta
   story e continuam fechados por padrão — abri-los é decisão de "ir ao ar" com sign-off humano
   separado (mesmo padrão da E01-S193 task 6/18), não um commit de dev.

## Achados fechados sem código (confirmados, não reimplementados)

- Validação PCM "já tem mecânica" (0348/0375/0560) — reusada, não recriada; esta story só
  introduz o status de **OS** que faltava pra essa mecânica ter onde pousar no Kanban.
- "Campo a conciliar" já tem base (1428/1429, E01-S175) — não reimplementada; só não virou coluna
  (SPEC_DEVIATION acima).
