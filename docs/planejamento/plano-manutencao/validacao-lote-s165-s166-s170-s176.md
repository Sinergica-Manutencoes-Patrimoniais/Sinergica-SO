---
name: "docs-planejamento-plano-manutencao-validacao-lote-s165-s166-s170-s176-md"
description: "Documento Sinérgica SO: Validação integrada — lote E01-S165, S166, S170 e S176"
alwaysApply: false
---

# Validação integrada — lote E01-S165, S166, S170 e S176

**Data:** 2026-11-06  
**Branch:** `codex/handoff-plano-manutencao`  
**Estado:** implementação do lote escrita; suíte SQL automatizada local completa passou e revisões adversariais locais não encontraram achados reproduzidos; workflow GitHub, E2E visual, medição de capacidade S166, aprovação formal dos ADRs e homologação ainda bloqueiam merge.

## Atualização após correções integradas — 2026-11-06

- O banco local foi recriado do zero com Supabase CLI 2.114.0 e aplicou todas as migrations até 1824. Em seguida, a seleção automatizada completa `supabase/tests/*.test.sql` passou: **225 arquivos, 2.892 assertions, resultado PASS**. Nenhum teste individual por story foi executado nesta rodada.
- A suíte revelou que o recibo S165 consultava `snapshot` da versão em rascunho, que só existe depois da aprovação. A migration 1823 agora lê as rotinas canônicas da versão rascunho. Os testes de suspensão do gerador legado e transição também foram corrigidos para usar assertions SQL válidas e o SQLSTATE P0011 já estabelecido.
- Cinco scripts S182 com guarda de banco descartável foram movidos de `supabase/tests/` para `supabase/manual-tests/`; são ensaios manuais, não testes pgTAP automatizados. O job oficial agora seleciona todos os `*.test.sql`, sem os incluir por engano. O workflow fixa temporariamente Supabase CLI 2.114.0, que aplicou a cadeia local completa; a atualização deve ocorrer após a regressão do `LOCK TABLE` ser corrigida upstream ([Supabase CLI issue #6347](https://github.com/supabase/cli/issues/6347)).
- Este PASS cobre a suíte SQL automatizada em banco local descartável; não substitui a execução do workflow GitHub, E2E visual, medição de capacidade, aprovação formal dos ADRs ou homologação.
- Revisão adversarial read-only independente das quatro stories concluída nesta data: nenhum achado reproduzido de severidade alta ou média. A aprovação formal dos ADRs e a homologação continuam pendentes; T016 permanece aberto nas quatro stories.
- Auditoria remota anterior da PR #71 parou no `audit:esteira` por oito ADRs 1662–1669 sem frontmatter; os documentos novos da branch tinham o mesmo problema. Frontmatter SDD foi acrescentado mecanicamente, preservando o conteúdo, e `pnpm run audit:esteira` agora passa com **2.596 documentos**.
- O `db-tests` da PR #71 usava CLI `latest` e parou no `supabase start`; aquela execução é anterior à pinagem 2.114.0 desta branch. A validação local limpa com 2.114.0 passou a seleção SQL completa. A execução GitHub do candidato atual ainda não ocorreu.
- Os hashes do overlay S165 foram atualizados após a correção da migration 1823 e dos testes de reconciliação; isso remove a divergência que bloquearia o runner isolado antes do ensaio.
- Na rodada seguinte, S165 passou no run `42243112927` (`6a63ce06`). S166 (`42243611673`), S170 (`42243612812`) e S176 (`42243614669`) concluíram migrations no clone isolado, mas falharam nos E2E visuais.
- O diagnóstico S176 confirmou que a tela desmontava o formulário de Grupo durante o refetch, antes de localizar `Local`. A UI agora mantém o formulário montado e desabilita o envio durante fetch/erro; falta repetir o fluxo isolado.
- S166 chegou à selagem das 501 Visitas, mas não registrou a RPC de confirmação nem o recibo esperado. O E2E agora coleta o texto final e o corpo resumido da RPC para localizar a condição de bloqueio.
- S170 confirmou HTTP 200 na aprovação e na leitura do histórico, sem exibir a justificativa recém-gravada; a revogação excedeu o timeout. O E2E agora preserva as justificativas retornadas e marca etapas da jornada para identificar o ponto preciso.
- A rodada integrada final foi disparada no commit `05a74eb1`; os resultados por story estão registrados abaixo. Nenhuma falha atual autoriza merge ou homologação.
- Resultado do commit `05a74eb1`: S165 passou (`42245888788`); S166 falhou na confirmação de 501 itens com SQLSTATE `57014` (`42245889029`); S170 confirmou a justificativa correta na resposta RPC, mas o Playwright não a encontrou no DOM, e o ensaio de permissão expirou durante criação do Plano (`42245889674`); S176 ainda não encontra o campo Local após abrir o formulário (`42245889141`). S176 continua bloqueada; a primeira correção visual não resolveu a causa.
- O hook pre-push executou localmente a suíte web completa apesar da preferência de adiá-la: typecheck passou, mas o Vitest terminou com 3 falhas entre 2.748 testes (7 arquivos falharam). Uma falha conhecida é a expectativa antiga de desmontar o formulário durante atualização/erro da lista; duas expectativas foram atualizadas sem nova execução local. As outras falhas ainda precisam ser classificadas antes do gate final.
- Diagnóstico posterior S170: a resposta HTTP do histórico contém uma linha e a justificativa exata; portanto, a falha ocorre entre parse/refetch e renderização, sem evidência de falha de gravação. A jornada longa expirou no timeout padrão de 45 s antes de validar a revogação; o próximo runner usa 120 s e marcadores por etapa.
- Diagnóstico posterior S176: o formulário também era desmontado durante revalidação da permissão (`permissao.isFetching`), independente da consulta de grupos. A UI agora mantém o formulário aberto e desabilitado enquanto confirma a permissão, oculta a lista e protege a mutação no handler. O E2E registra o texto/seletores/permissões se a falha persistir.
- Diagnóstico posterior S166: `57014` confirma cancelamento da consulta, mas a causa exata ainda não foi capturada. O E2E agora mede a duração e guarda `message/details/hint`; limite operacional permanece fechado até medição pelo caminho PostgREST.

## Atualização dos E2E isolados — 2026-11-06

- S165 passou no run `42236840424`, no commit `052f6fc9`; ainda não há repetição sobre o commit mais recente.
- S166 falhou no run `42239496722` antes de iniciar a alteração: a tela não exibiu a regra do contrato sintético esperada pelo seletor. O resumo anterior não registrou o estado da lista nem a resposta da RPC.
- S170 falhou no run `42239496782` depois da aprovação: as RPCs de aprovação e leitura responderam 200, mas a justificativa não apareceu no histórico; cenário de revogação também excedeu o timeout.
- S176 falhou no run `42239496845` depois de abrir o formulário de Grupo Quantitativo. O último marco foi `formulário de grupo aberto`; logs não identificam qual interação de campo parou.
- Foram adicionados diagnósticos de UI/API a S166, S170 e S176, com pins de hash atualizados nos runners. A validação conjunta ainda aguarda execução; nenhum teste foi reexecutado nesta etapa.
- O primeiro push diagnóstico iniciou as quatro filas em paralelo. S165 avançou para o clone isolado; S166, S170 e S176 foram interrompidas pelo pin antigo dos scripts de bootstrap dentro de `E01-S176_recorte_do_zero.py`, antes de executar Playwright. Os pins centrais foram corrigidos; esses três fluxos precisam ser reenviados para a mesma rodada final.
- As quatro stories mantêm T016 aberto. Corrigir os fluxos com base nos próximos diagnósticos e validar o lote em conjunto antes de avançar ao merge.

## Evidência executada

- Auditoria estática das quatro stories: não encontrou tarefas de código T001–T015 pendentes. Nesta rodada foi corrigido o setup E2E S170 (proxy/config/fixture ausentes; operador sem permissão inicial) e adicionada a jornada visual do criador autoaprovar o próprio Plano após concessão individual; execução do E2E permanece pendente. Superfícies S176 continuam atrás dos gates previstos. S166 V2 passou a validação integrada de 501 visitas; medição de capacidade ainda pendente.
- Bateria focada final do lote, executada em conjunto após as correções: **32 arquivos; 201 testes passaram e 4 foram ignorados**. Abrangeu domínios, aplicações, adapters e interfaces das quatro stories, incluindo o novo caso de recibo S165 com 21 ocorrências. A seleção não substitui a cobertura completa dos critérios de aceite.
- Após as alterações desta rodada, a suíte web completa passou com configuração Supabase sintética apenas para inicialização dos módulos: **490 arquivos; 2.753 testes passaram e 20 foram ignorados**. Inclui 4 testes de `AlterarDiaComVisitasV2.test.tsx`. Não houve conexão a projeto Supabase real.
- Execução pgTAP integrada final em clone descartável: **S170 12, S176 10, S165 183, S166 recorrência 7, S166 mudança de dia V2 36 e S176 isolamento 11 assertions aprovadas (259 no total)**. Incluiu o overlay S165 1822–1824. A fixture V2 cobre snapshot paginado, retomada, rollback, retry/replay e 501 visitas usando o produtor canônico. Também passaram as fixtures auxiliares 1804 (aprovação inicial e revisão), 1805 (token de versão), 1806 (compatibilidade), 1807 (revisão concorrente) e 1808 (consulta). O clone descartável aplicou 228 migrations da base e 701 candidatas; recursos exclusivos foram removidos ao final. Essa seleção direcionada não cobre toda a seleção SQL nem equivale à CI completa.
- `pnpm --filter @sinergica/web run typecheck`: passou.
- `git diff --check`: passou.
- Validação web consolidada executada novamente após as correções recentes: a primeira execução sem variáveis de ambiente terminou com 6 arquivos sem inicializar por ausência de `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; repetida com valores sintéticos locais, passou em **490 arquivos, 2.753 testes**, com 20 ignorados. Não acessou Supabase real. Typecheck e `git diff --check` passaram neste estado.
- A fixture e os pins estáticos da jornada visual S170 conferem (`capacidades-sso.spec.ts`, config Playwright e fixture). Essa checagem não executa o Playwright; o ensaio visual continua aguardando runner GitHub com `HEAD` limpo e rastreado.
- Pins do overlay S165: 12 verificados, 0 divergências.
- `graphify update .`: concluído, com aviso de 27 arquivos não relacionados ao código sem nós no grafo.
- `pnpm run eval:spec`: passou com rastreabilidade AC→task; o comando também informou 14 `SPEC_DEVIATION` abertos em outras áreas, ainda sem classificação para este lote.
- Nova tentativa de `pnpm run ci:local`: não concluiu. Os gates globais apontaram 81 ocorrências de reticências, 4 de primitivas, 2.395 itens da auditoria da esteira, falhas de lint/migrations e endpoints Edge não declarados. A execução avançou até a suíte web e build, mas foi interrompida; não constitui resultado final de CI.
- Tentativa anterior do runner com rotas documentais/fotos parou antes do clone por ausência de `apps/web/e2e/s178-documento-isolado/jornada_fotos.py` (S178, fora do escopo). A tentativa posterior sem Edge foi concluída com as fixtures pgTAP listadas acima; as rotas HTTP ainda não foram ensaiadas.
- Uma rodada final de `pnpm run ci:local` terminou com falha: `typecheck` e `build` passaram; falharam os gates globais de reticências (83 achados), primitivas (4), auditoria da esteira (1.673), lint, migrations, Edge Functions (54) e testes. No teste web inicial, um caso S176 revelou que uma resposta de autenticação atrasada ainda disparava RPC após troca de Grupo. A mutação agora cancela antes da RPC quando o componente foi desmontado; a suíte web completa passou depois com variáveis Supabase sintéticas. As demais falhas globais ainda não foram classificadas por story nem reavaliadas.
- A revisão adversarial encontrou um bloqueio transitório incorretamente persistente após paginação do recibo S165. O componente foi corrigido para usar o resumo da última página; o caso de UI com 21 ocorrências passou na bateria focada final.
- A revisão levantou hipótese não reproduzida de mutação das fontes entre páginas. O identificador de versões é conferido; a confirmação final também usa validações transacionais no servidor. O runner de banco segue necessário para provar o comportamento sob concorrência.
- A revisão adversarial confirmou que a rota de aprovação aceitava um booleano do cliente para escolher entre aprovação inicial e revisão, sem revalidar o recibo ADR-1681 no servidor. A migration 1824 deriva essa escolha do histórico, exige reavaliação paginada completa no servidor e preserva o token transacional 1805 e o replay idempotente; dois casos pgTAP cobrem os bypasses e passaram na rodada integrada.
- A revisão S176 encontrou as superfícies de Sistemas distribuídos e Planos por ativo escondidas por flags e gates fechados. Os valores de produção permanecem `false`; o clone E2E agora habilita os flags/gates sintéticos, concede as capacidades necessárias e verifica as superfícies de leitura e o estado vazio explícito. O fixture e o runner estão pinados por hash; essa jornada ainda não foi executada.
- A revisão S170 confirmou o default-deny sem concessões. A spec agora documenta que um superadmin existente faz a concessão inicial explícita, sem backfill automático de permissões legadas.
- A checagem de Edge Functions identificou endpoints de fotos de Grupo S176 sem declaração no `supabase/config.toml`. Os quatro endpoints de cadastro, ingestão, staging e leitura verificada foram declarados com `verify_jwt = true`; suas flags de execução continuam desligadas até habilitação explícita. A checagem deixou de apontá-los.
- O endpoint legado `pcm-foto-grupo-segura`, para leitura de foto de Grupo (migration `0850_E01-S166_leitura_foto_grupo.sql`), permanece fora do `config.toml` por comentário explícito no próprio handler: não implantar antes da revisão de segurança e Storage. É distinto da rota de staging S176 e segue como bloqueio de entrega dessa superfície. A verificação também acusa `pcm-documento-staging-ativo-seguro` sem declaração e uma chamada dinâmica de foto de ativo; precisam ser classificados antes do gate global.
- S166 grande volume: a UI V1 bloqueia mais de 500 candidatas, mas o protocolo V2 pagina e confirma até o orçamento configurado. A fixture pgTAP passou com 501 itens e gate sintético de 600, cobrindo rollback/replay. O teto operacional permanece 500 e gates fechados até medição de capacidade. A UI V2 mostra explicitamente **Em andamento** durante a montagem e retomada da fotografia.
- O runner pgTAP conjunto inclui a fixture S166 V2 de 36 assertions (501 visitas); fixture e runner têm hashes conferidos. A seleção direcionada do lote passou no clone descartável, mas não equivale à seleção CI completa.
- O manifesto do **runner manual isolado** fixa 80 arquivos; ele é independente da seleção oficial do workflow. Os cinco ensaios manuais S182 foram separados da pasta `supabase/tests/`. O job `db-tests` usa CLI 2.114.0 e executa `supabase test db supabase/tests/*.test.sql`; a mesma seleção passou localmente após reset, conforme registro acima. Ainda falta o resultado do workflow GitHub no candidato rastreado.

## Banco e E2E ainda pendentes

- `supabase start` foi tentado localmente nas portas 55320–55327. Parou antes de iniciar o job pgTAP ao aplicar `1273_E01-S185_propriedade_evento_observacao.sql`: `LOCK TABLE can only be used in transaction blocks` (SQLSTATE 25P01), fora do escopo destas quatro stories. O Supabase parou os serviços desta tentativa; conferência posterior encontrou somente o container isolado anterior, sem volumes ou containers locais novos. As imagens de serviço foram baixadas e permanecem no Colima.
- O runner isolado exige 8 GiB livres no host. A limpeza autorizada do Colima recuperou 16,6 GiB. A rodada integrada final aplicou 228 migrations da base e 701 candidatas, aprovou as fixtures listadas acima e removeu os recursos exclusivos; não recriou `supabase_db_Sinergica-SO` nem usou banco compartilhado.
- Os cenários de UI isolada S165/S166/S170/S176 do runner exigem runner GitHub dedicado e marcadores efêmeros; não foram executados neste Mac.
- Nenhum teste conectado a Auvo real, deploy ou operação de produção foi executado.

## Pendências para fechar T016 e homologação

1. Corrigir as falhas UI identificadas e executar E2E visual em runner GitHub dedicado em lote; obter também o job oficial `db-tests` verde no candidato rastreado. Reconciliar o manifesto separado do runner manual isolado se esse runner for usado para conferir toda a seleção do candidato.
2. Corrigir ou classificar as falhas restantes do `ci:local` e obter uma rodada final verde com `db-tests` habilitado. A suíte web passou com ambiente sintético, mas CI não concluiu; gates globais incluem funções não declaradas fora do escopo deste lote e `pcm-foto-grupo-segura` deliberadamente retida para revisão.
3. Registrar a revisão adversarial local no PR e obter aprovação formal dos ADRs 1676–1681.
4. Homologar os critérios de aceite antes de qualquer merge.

Os quatro checklists mantêm T016 aberto. Implementação escrita e testes focados verdes não equivalem a homologação.
