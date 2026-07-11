---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

**Atualização:** 2026-07-11 (sessão Lucas/Claude) — **PR #49 (E01-S60) deixado redondo antes da
aprovação: tooling versionado + pendência de CORS verificada e fechada.**

1. **Os 6 arquivos de tooling que ficavam eternamente "uncommitted" em toda sessão anterior foram
   resolvidos, não mais adiados.** `.claude/settings.json`/`.codex/hooks.json` tinham hooks do
   graphify com path absoluto (`/Users/lucasazevedo/.local/bin/graphify`) — quebraria em qualquer
   outra máquina/CI; trocado para `graphify` puro (confirmado que resolve via PATH).
   `AGENTS.md`/`CLAUDE.md` ganharam a seção graphify (instruções condicionais, sem path pessoal) —
   commitados. `graphify-out/`/`apps/web/graphify-out/` (114MB de cache gerado) entraram no
   `.gitignore` em vez de aparecer como untracked toda sessão. Working tree 100% limpo depois disso
   (`git status --porcelain` vazio). 2 commits novos na branch `feat/E01-S60-acabamento-visual-v1`:
   `chore(E00-S00): versiona skills SDD locais (.agents/skills)` e
   `chore(E00-S00): versiona tooling do graphify e ignora o cache gerado`.
2. **Pendência de CORS (E01-S48) verificada e fechada — não era mais pendência, só faltava
   confirmar.** Rodei `SUPABASE_PROJECT_ID=nudannsrfvjggoergvyn node scripts/smoke-edge-functions.mjs`
   contra o projeto real: as 26 funções respondem, e o probe de CORS embutido (contra
   `pcm-auvo-tickets-referencia`) confirmou `Access-Control-Allow-Origin:
   https://so-sinergica.netlify.app` ecoado corretamente pro Origin de produção. Fiz também um
   `curl -X OPTIONS` direto contra `atendimento-metrics` (a função por trás do dashboard de
   Atendimento, que tinha o erro relatado na E01-S60) com o mesmo Origin — mesmo resultado, header
   ecoado certo. **`CORS_ALLOWED_ORIGINS` já inclui o domínio de produção; não há ação pendente.**
   O erro visto em `localhost` durante o QA da E01-S60 é esperado e correto (localhost não deve
   estar na allowlist de produção).
3. PR #49 fica pronto para aprovação — sem pendências de código ou infra conhecidas.

---


> Memória de trabalho **entre sessões** (humanos e agentes). É **volátil**: atualizada o tempo
> todo. Diferente do **ADR** (decisão durável e imutável). Decisão estrutural → ADR; estado do
> trabalho → aqui. Atualize ao **pausar/encerrar**; leia ao **retomar**. Use a skill `/handoff`.

**Atualização:** 2026-07-11 (sessão Lucas/Claude) — **E01-S60 verificada e fechada; SEC-001
corrigido (estava desatualizado).**

Codex chegou ao fim dos gates e passou a bola. Reexecutei os gates eu mesma (não confiei só no
relato): `typecheck`, `test` (288 pass/9 skip), `build`, `arch:check` (0 violações),
`check:edge-functions` (26 funções), `lint:migrations` (83 migrations + Squawk),
`pnpm audit --prod --audit-level=high` (0 vulnerabilidades) — todos verdes de forma independente.
`lint` full-tree deu OOM (mesmo problema documentado há várias sessões, pressão de memória da
máquina, não do código) — rodei `biome check` só nos 42 arquivos tocados por esta story: limpo.
`audit:esteira` segue vermelho só pelos 6 arquivos pré-existentes de `.agents/skills/*` sem
`alwaysApply` — tooling não relacionado a esta story, mesmo achado de sessões anteriores.

Spot-check adversarial no ponto mais arriscado (o bug de drawer que a revisão do Codex já tinha
achado e corrigido): `sidebarCompacta = sidebarCollapsed && !mobileSidebarOpen` em `HomePage.tsx`
força o drawer mobile a abrir sempre expandido, independente do estado "recolhida" do desktop —
correto. Shell é `h-screen overflow-hidden` (scroll só no conteúdo interno), então não há o bug
clássico de body-scroll atrás do drawer.

**Ressalva do dashboard de Atendimento não conectar via localhost: investigada e confirmada como
config, não bug.** `_shared/cors.ts` só ecoa `Access-Control-Allow-Origin` para origem presente em
`CORS_ALLOWED_ORIGINS` (secret do Supabase) — mesma causa documentada na E01-S48 (Tickets).
`localhost` normalmente não está na allowlist de produção; o browser bloqueia a resposta e o
`supabase-js` devolve "Failed to send a request", que a UI já trata com mensagem amigável
(`mensagemErroDashboard`, coberto por `visual-v1.test.ts`). Nada a corrigir em código — validar no
domínio publicado, como já indicado.

**SEC-001 corrigido:** estava desatualizado dizendo "Supabase não provisionado" — o projeto está
em produção desde E00-S05, com 2.357+ OS sincronizadas do Auvo e 83 migrations aplicadas. Rebaixado
de P0/"aberto" pra P1/"reavaliar", com a query SQL exata pra reconfirmar RLS FORCE em produção
quando alguém tiver acesso ao dashboard.

**Não commitado.** Branch atual é `codex/fix-auvo-funcionarios-pull` (nome não segue a convenção
`feat/E01-S60-...` — tem 1 commit já ahead de main, `bb8890e fix(E01-S47)`, não relacionado a esta
story, mais todo o trabalho visual desta story ainda em working tree). Por instrução permanente do
projeto, commit só acontece quando pedido explicitamente — aguardando confirmação do Lucas antes de
commitar/abrir branch própria e nunca fazendo push direto pra main.

---

**Atualização anterior:** 2026-07-11 (Codex) — **E01-S60, acabamento visual transversal da V1,
implementada localmente com QA autenticado.** Foi criada uma camada de primitives CSS para botões,
superfícies, estados, modais, foco e densidade. Login ganhou composição institucional responsiva;
Home ganhou cartões mais compactos; a sidebar virou drawer móvel com overlay e fechamento após
navegação; o conteúdo usa 100% da largura em viewport estreita. Cadastros, tabelas, detalhes e
modais PCM foram compactados; Configurações ganhou estados vazios orientativos; Atendimento ganhou
KPIs/cards densos, abas compactas e Inbox que alterna lista/chat no mobile. Erros técnicos de rede
do dashboard de Atendimento agora viram mensagem amigável. Smoke real com a conta fornecida pelo
Lucas cobriu Home, dashboard PCM, Clientes, Configurações, Inbox e Config Atendimento em 1280 px e
390×844: `body overflow = 0`, main = 390 px, drawer = 256 px; tema escuro também validado. Sinais
Auvo apareceram com dados reais (2.185 execuções, 268 anexos, 22 relatos, 2.150 assinaturas e 2.182
com horas). Nenhuma biblioteca nova foi adicionada; bundle JS permaneceu praticamente estável.
Testes web: 288 pass, 9 skip. A revisão adversarial encontrou e corrigiu o drawer móvel herdando a
sidebar recolhida do desktop; teste estrutural e smoke desktop→mobile cobrem a regressão. Ressalvas:
dashboard Atendimento não conecta à Edge Function a partir
de localhost (mensagem tratada) e a config parcial registrou dois erros no console; verificar no
domínio publicado. CI real/publicação ainda pendentes.

**Atualização:** 2026-07-11 (Codex) — **E01-S59, refino de densidade operacional PCM,
implementada localmente.** Shell, inputs, botões, filtros e cartões foram compactados; a lista de OS
agora ocupa a coluna inteira, tem título/contagem e seleção explícita; o resumo lateral elimina o
vazio e mostra descrição, cliente e técnico. Top Backlog e Ordens Recentes ganharam contexto na
linha e tooltip. O bloco “Sinais de campo Auvo” deixou de depender apenas da tabela de webhook:
consolida por OS `pcm.auvo_task_snapshots` e evidências já trazidas pelo pull em
`pcm.ordens_servico.auvo_detalhes` (execução, anexos, relatos, assinaturas, peças e horas), sem
duplicar a mesma OS. Consulta read-only em produção confirmou snapshots vazios, mas 2.349 OS com
detalhes, 268 com anexos, 2.177 com duração e 2.181 com checkout — portanto os zeros eram um bug de
fonte, não ausência de execução. Testes web (282 pass, 9 skip), build, typecheck, lint, arquitetura e
fidelidade verdes. O `ci:local` só ficou vermelho no `audit:esteira`: seis skills preexistentes em
`.agents/skills/` não têm `alwaysApply`; esses arquivos não fazem parte da E01-S59 e foram
preservados. QA visual local autenticado não foi possível porque o browser abriu na tela de login;
validar a aparência final na sessão autenticada de produção após publicação.

**Atualização:** 2026-07-11 (Codex) — **E01-S47 retomada após teste de contrato vivo executado pelo
Lucas.** Aprovados e habilitados no registry: clientes, equipamentos, grupos de clientes, categorias
de equipamento, segmentos, palavras-chave, tipos de tarefa e ferramentas. O push agora extrai o ID
aninhado de `/customergroups`; ferramenta omite preço em POST (a API gravou ×10) e o envia apenas em
PATCH; tipo de tarefa tem `supportsUpdate:false` porque PATCH retornou 200 sem aplicar alteração;
categoria de equipamento usa delete local porque DELETE 204 não a removeu no GET. Banners de
ferramentas/catálogos aprovados foram removidos; a 360 de cliente passou a informar escrita real.
Não habilitados: funcionários (limite de licença; PATCH no-op), tickets sem registros, serviços e
produto-categorias (404). Limpeza adicional: DELETE do grupo de teste `170491` retornou 204; GET
individual não é aceito (405). Categoria de teste `56029` segue retornando após DELETE 204, conforme
limitação documentada. Gates Node/TS verdes; Deno/CI ainda pendentes.

**Última atualização:** 2026-07-11 (sessão Lucas/Claude) — **Revisão do handoff Codex (E01-S52..S58) +
diagnóstico dos endpoints com a API real + 4 correções.**

1. **Diagnóstico com credencial real (probes read-only, curl):** `GET /gps` = **500 em todas as
   variações de filtro** (sem filtro, `getLastKnowPosition`, datas, `userId`+datas) — não é o nosso
   filtro, é server-side; `/expenses` = **500** (não 404) com e sem filtro, enquanto
   `/expensetypes` = **200 com dado real** (shape confirmado); `/satisfactionsurveys` = **500 até com
   `taskId` real e válido** (sem filtro dá 400 "paramFilter.TaskId — Task not found", ou seja o
   endpoint existe e valida input, mas quebra na consulta); `/questionnaires` = **200 com dado real**
   (shape raiz confirmado: `id`/`description`/`header`/`footer`/`questions[]`; **não existe campo
   `active`** — o `ativo` local fica sempre true, inofensivo). **Ação humana (Lucas): abrir chamado
   no suporte Auvo** para gps/expenses/satisfactionsurveys citando os 500 — três recursos do plano
   com API quebrada server-side.
2. **Bug real corrigido:** os 4 testes Deno existentes de `pcm-auvo-sync-all/index.test.ts`
   quebrariam no CI — o Codex adicionou 5 etapas novas ao `runSyncAll` e as asserções ainda
   esperavam 3/4 steps e a lista antiga de chamadas. Testes reescritos para o contrato novo
   (+1 teste de falha isolada das etapas novas).
3. **Correções de revisão:** `PainelDadosOperacionaisAuvo` distinguia... nada — erro real de banco
   também virava "aguardando sincronização" (mesmo fallback perigoso vetado pelo @qa na E01-S12);
   agora tem estado de erro próprio no padrão visual de erro do repo. Soma de despesas ganhou janela
   de 31 dias (mesma do pull) em vez de baixar a tabela inteira (anti-padrão que a E01-S44 acabou de
   eliminar). `pcm-auvo-support-pull` (satisfactions) ganhou limite 20 OS + orçamento de 45s por
   rodada — laço de 1 GET/OS contra API que responde ~11s/página estouraria o teto de 150s do worker
   (lição do E01-S37). Testes Deno novos para `extractDeletedTaskIds` e `mapGps`.
4. **Revisão das migrations 0077–0081: aprovadas.** `0077` substitui a trigger function de status de
   forma aditiva (origem/metadata via `set_config`, mesmo corpo do 0020 no resto); exclusão de
   regressão cobre todos os status terminais reais (não existe `faturado` no domínio). RLS
   FORCE/grants no padrão do repo nas 4 tabelas novas. Purge de GPS roda dentro do próprio pull.
5. Gates locais verdes após as correções: typecheck, 280 web tests, build, `arch:check`,
   `check:edge-functions` (26 funções). Deno/pgTAP seguem dependentes do CI (sem Deno CLI/Docker
   nesta máquina). Nada commitado (branch `feat/E01-S47-escrita-real-auvo`).
6. **Ressalva registrada (não corrigível sem endpoint):** formato/timezone de `positionDate` do GPS
   não observável enquanto o endpoint devolve 500 — se vier sem timezone (hora local BR), a
   conversão atual desloca 3h; confirmar no primeiro payload real.

---

**Handoff:** 2026-07-11 (Codex → Claude) — trabalho na branch local
`feat/E01-S47-escrita-real-auvo`, sem commit/push. **Backend/migrations já criados no worktree por
Codex, mas precisam de revisão Deno/DB antes de aplicar:** `0077_E01-S58_reconciliacao_tarefas_excluidas.sql`
(RPC que cancela OS de task excluída e evento `auvo_deleted_task`), `0078_E01-S52_gps_posicoes.sql`,
`0079_E01-S54_despesas_auvo.sql`, `0080_E01-S55_satisfacao_auvo.sql`,
`0081_E01-S56_questionarios_auvo.sql`; e Edge Functions `pcm-auvo-deleted-tasks-sync`,
`pcm-auvo-gps-pull`, `pcm-auvo-support-pull`, declaradas em `supabase/config.toml` e chamadas pelo
`pcm-auvo-sync-all`. **Frontend entregue:** `PainelDadosOperacionaisAuvo.tsx`, plugado no dashboard
PCM; lê as quatro novas tabelas, mostra dados quando houver e aviso honesto enquanto migration/pull
não estiver ativo. Ainda faltam UI detalhada em OS/Cliente-360, preventivo e tarefa rica.

**Verificações:** `lint:migrations` (81 migrations), `check:edge-functions`, typecheck e web tests
(280 pass/9 skip) verdes; Deno continua ausente. `graphify update .` executado em 2026-07-11.

**Contratos/bloqueios reais:** autenticação Auvo funciona. `GET /tasks/GetDeletedTasks` funcionou
com `paramFilter.startDate/endDate` e confirmou `taskID`. `GET /gps` retorna 500, `/expenses` 404,
e `/satisfactionsurveys` 500 mesmo com `taskId` real; investigar entitlement/bug com Auvo antes de
declarar os pulls aceitos. E01-S47 segue sem `writeEnabled:true`: `POST /users` falha com
`errorCode:56` (limite de licenças) e o OpenAPI exige `PUT /users` completo (login/senha não são
persistidos pelo PCM). E01-S53 tem `design.md` + ADR-0008 escolhendo service orders recorrentes,
mas não tem migration/write path por faltar teste de contrato; E01-S57 só tem gerador puro de
contexto/produtos em `contexto-tarefa-auvo.ts` + teste.

**Próximo passo para Claude:** revisar/rodar Deno e pgTAP das Functions/migrations novas, validar os
curls com o Auvo/suporte, aplicar migrations em ambiente apropriado e então conectar UI detalhada de
despesas/satisfação/questionários e a correlação real de preventivo/tarefa rica. Não habilitar
`writeEnabled` sem teste controlado/reversível por entidade.

**Atualização:** 2026-07-10 (Codex, continuação) — a pedido do Lucas, iniciada implementação sem
teste de escrita do E01-S47 (a conta Auvo não tem licença para o usuário temporário). Entregue no
worktree: migrations `0077`–`0081`; Edge Functions `pcm-auvo-deleted-tasks-sync`,
`pcm-auvo-gps-pull` e `pcm-auvo-support-pull`; novas etapas isoladas no `pcm-auvo-sync-all`; e
gerador/teste de contexto da tarefa rica. `lint:migrations`, `check:edge-functions`, `typecheck`
e o teste unitário novo passaram. **Não declarar concluído ainda:** o ambiente segue sem Deno, GPS
retorna 500, despesas 404 e satisfação 500 pela API real da conta; as telas/consultas de UI ainda
não foram conectadas; E01-S47 continua sem `writeEnabled:true` porque o contrato de update de
usuário exige `PUT /users` completo e o PCM não persiste login/senha. E01-S53 recebeu design +
ADR-0008 (PCM dono do plano; service order recorrente), mas migration/write path aguardam teste de
contrato para não inventar a correlação da recorrência.

**Atualização:** 2026-07-10 (Codex) — **E01-S47 bloqueada externamente ao executar o primeiro teste
de contrato real.** As credenciais em `.env.local` autenticam (`GET /login` e `GET /users` = 200) e
confirmaram a estrutura de usuários (`result.entityList`, `userID`, `smartPhoneNumber`,
`jobPosition`, `unavailableForTasks`). Porém `POST /users` para um registro temporário reversível
retornou `400`, `errorCode: 56`, "The account has reached it's maximum users limit". Nenhum usuário
foi criado, logo não há limpeza pendente. O OpenAPI oficial também confirmou que atualização de
usuário é `PUT /users` com `id` e payload completo, não `PATCH /users/{id}` — adaptar o motor é
pré-requisito depois que houver teste viável. **Não flipar `writeEnabled` nem avançar para outra
entidade:** liberar uma licença temporária no Auvo ou indicar um usuário de teste existente,
expressamente autorizado para edição → GET → reversão. E01-S47 agora tem `spec.md` e `tasks.md`
para manter o bloqueio rastreável. Branch local: `feat/E01-S47-escrita-real-auvo`; nada commitado
nem enviado.

**Última atualização:** 2026-07-10 (sessão Lucas) — **Auditoria API Auvo × PCM + ESCOPO-MESTRE v1.2 +
7 stories novas (E01-S52..S58). Só artefatos SDD/docs — nenhum código de feature.**

1. **ESCOPO-MESTRE.md v1.2:** estado real de entrega marcado (§5 maturidade, §6.1/§6.2 status,
   §7 estado real da integração, §10 fases) + nova §14 com 7 propostas para o dia a dia do
   Fabrício (F1 briefing diário, F2 radar de execução, F3 carteira de laudos→receita, F4 fila de
   revisão do RT, F5 esforço real por tipo, F6 auditoria por amostragem, F7 semáforo de clientes).
2. **Auditoria Auvo (`docs/AUDITORIA-AUVO-API.md`):** inventário dos 142 endpoints do OpenAPI
   oficial (`developer.auvo.com.br/_spec/openapi/api-reference.yaml`) cruzado com o registry (13
   descriptors + tasks) + navegação autenticada na conta real (Playwright headless, read-only,
   login de UI fornecido pelo Lucas). Achados-chave: **GPS ativo** (5 técnicos, alta precisão,
   relatório Monitoramento) e não consumido; **Ordens de Serviço/"Projetos" e Orçamentos vazios**
   (0 registros — módulos existem, nunca usados: PCM pode nascer dono do preventivo via
   `/serviceorders` com recorrência nativa; orçamento nasce no OS/E03, não espelhar);
   **pesquisa de satisfação nunca ativada** (0 respostas); despesas (`/expenses`) e questionários
   (`/questionnaires`) sem espelho; km rodado/apontamento de horas **sem endpoint público** (só
   relatório de UI). "Serviços" existe na UI da conta — o 404 da API pode ser permissão do token,
   reverificar.
3. **Stories criadas (spec.md+tasks.md, owner livre):** E01-S52 GPS · E01-S53 preventivo
   recorrente (tier arquitetural, design antes) · E01-S54 despesas/custo real · E01-S55
   satisfação · E01-S56 questionários · E01-S57 criação de tarefa rica · E01-S58 reconciliação de
   tarefas excluídas. **Pré-requisito transversal: credencial de API Auvo**
   (`AUVO_API_KEY`/`AUVO_USER_TOKEN`) para verificar contrato real antes de qualquer migration —
   mesma lição do `taskID`/`smartPhoneNumber`.
4. Nada commitado nesta sessão (docs + specs no working tree; commit/branch/PR a pedido do Lucas).

---

**Atualização anterior:** 2026-07-09 (sessão Lucas) — **Lote de 12 stories (E01-S39 a S51, exceto S44)
respondendo ao feedback de teste manual do Lucas sobre Kanban/Timeline/Calendário/cliente-360.**

Lucas testou a UI manualmente e mandou 8 pontos de feedback (tipos de tarefa incompletos, sem
tooltip, sem filtro/lote em OS, dúvida sobre `CH-XXXX`, ferramenta/categoria/funcionário não
refletem no Auvo, erro de CORS em Tickets, itens do cliente-360 não clicáveis, sem edição de
cliente pela 360, pedido de proposta pra 360 mais rica). Plano completo em
`~/.claude/plans/foi-entregue-uma-serie-generic-owl.md`. Implementadas 11 stories (S39-S43, S45-S51;
S44 documentada e adiada por escolha técnica — volume ainda não justifica paginação server-side):
- **S39/S40**: modal de Nova OS lê `pcm.tipos_tarefa` real (não mais 15 strings hardcoded);
  `tipo_tarefa_id` estruturado (migrations `0073`/`0074`, ainda não aplicadas em produção) +
  `pcm-auvo-create-task` resolve `taskTypeId` real com fallback de categoria.
- **S41**: `Tooltip` reutilizável (`components/ui/Tooltip.tsx`) nas 4 telas de OS; achado de bônus —
  `OrdemServicoOperacional.descricao` nunca tinha sido exposta à UI, apesar de existir na tabela
  desde sempre.
- **S42/S43**: filtros (técnico/categoria/data, KPIs recalculam sobre filtrado — decisão do Lucas) +
  seleção múltipla/ação em lote de status.
- **S45**: funcionário — bug já corrigido em sessão anterior (commit `6408b3a`), só fechamento.
- **S46/S47**: banner de transparência onde `writeEnabled:false`; **tentativa de habilitar escrita
  real bloqueada** — esta sessão não tinha `AUVO_API_KEY`/`AUVO_USER_TOKEN` no ambiente nem acesso
  ao dashboard Supabase pra testar PATCH real sem risco à conta de produção do cliente. Fez auditoria
  cruzada em vez de teste ao vivo e achou 1 bug real: `funcionarios.ts` `toAuvo()` mandava
  `phoneNumber`, mas o endpoint de criação que já roda em produção usa `smartPhoneNumber` (campo
  confirmado em sessão anterior) — corrigido. `writeEnabled` continua `false` em todas as entidades.
- **S48**: `smoke-edge-functions.mjs` ganhou checagem de CORS contra `pcm-auvo-tickets-referencia`;
  `cors.ts` loga Origin desconhecido. Lucas precisa confirmar `CORS_ALLOWED_ORIGINS` no dashboard.
- **S49/S50**: deep-link cliente-360→OS (Backlog/Histórico/Timeline clicáveis); edição de cliente
  direto na 360 (`ClienteFormModal` extraído de `ListaClientesPage.tsx`).
- **S51**: `pcm.clientes.detalhes jsonb` (migration `0075`, não aplicada ainda) + cards
  Contatos/Grupos na 360 + aba Financeiro honesta (status comercial + OS por categoria). **Escopo
  cortado** — mesma causa da S47: sem acesso à API real, não populou cidade/estado/cep/coordenadas
  (nome de campo Auvo não confirmado) pra não inventar.

Gates locais verdes: typecheck (5 pacotes), 287 testes web (278 pass, 9 skip — 2 novos testes de
`obterVisaoCliente`/grupos, mais os das novas stories), build, `arch:check` (0 violações),
`lint:migrations` (75 migrations, Squawk limpo), `check:edge-functions` (23 funções, 8 invokes).
Biome full-tree deu OOM local (mesmo problema documentado em sessões anteriores, pressão de memória
do sistema, não do código) — não bloqueante, pre-commit hook corrige formatação nos arquivos
staged automaticamente no commit.

**Adendo (mesma sessão, pedido explícito do Lucas):** implementada a E01-S44 (agregação server-side
de OS), que tinha ficado só documentada/adiada no lote acima. Migration `0076` (RPC
`fn_kpis_ordens_servico`, `security invoker`) substitui o `reduce()` em JS pelos 6 KPIs; filtros de
status/técnico/categoria/data agora vão pro `WHERE` da query em vez de baixar tudo e filtrar depois
(busca livre por nome de cliente continua client-side, de propósito — só existe após o JOIN em
memória). Achado durante a implementação: os dois efeitos de carga de `OrdensServicoPage.tsx`
duplicariam o fetch a cada troca de filtro (já que `carregar` passou a mudar de identidade a cada
filtro novo) — corrigido com uma ref detectando mudança real de `refreshKey` antes de disparar.
Gates verdes (typecheck, 109 testes pcm, build, arch:check, lint:migrations 76 migrations,
check:edge-functions).

**Pendências não-codificáveis desta rodada (Lucas):**
1. Aplicar migrations `0073`/`0074`/`0075`/`0076` em produção antes/junto do deploy.
2. Confirmar `CORS_ALLOWED_ORIGINS` inclui o domínio Netlify de produção (S48).
3. Decidir se/quando destravar acesso à API Auvo real (chave em ambiente de outra sessão, ou testar
   ao vivo com o Lucas presente) pra completar S47 (flipar `writeEnabled`) e S51 (cidade/estado/cep,
   coordenadas).
4. Reprodução manual em browser real de todas as 11 stories antes de considerar 100% fechado — só
   gates de código rodaram nesta sessão, sem Playwright contra dev server desta vez.

---

**Atualização anterior:** 2026-07-09 (sessão Lucas) — **E01-S34/S35/S37 verificadas em produção com
dados reais — sync Auvo→PCM funciona de ponta a ponta.**

Testando o botão "Sincronizar Auvo" com credenciais reais (não só gates locais), achei e corrigi 5
bugs em cadeia (PRs #34-#39, todos mergeados e deployados, smoke-test verde a cada merge):
1. `/tickets`/`/tasks` exigem `paramFilter` de data — sem ele, 400 real do Auvo.
2. `pull:equipes` 500 — `fn_upsert_auvo_sync` gravava `NULL` em coluna `NOT NULL` pra array vazio
   (migration `0069`) + `teamUsers`/`teamManagers` reais são nomes, não ids.
3. Criar funcionário — chave errada (`phoneNumber`→`smartPhoneNumber`) + faltava exigir
   cargo/telefone/email (contrato real obrigatório do Auvo).
4. `pcm-auvo-sync-all` estourava o teto de 150s do Supabase (`WORKER_RESOURCE_LIMIT`/
   `IDLE_TIMEOUT`) — pulls agora rodam em paralelo, `tasks-import` resolve cliente/numeração/autoria
   em lote (não 1 query por tarefa), e a janela recorrente de `tasks-import` caiu de 180 pra 14 dias
   (é rede de segurança do webhook, não backfill — a conta tem ~2362 tarefas em 240 dias e o Auvo
   leva ~11s por página de busca, então uma janela larga rodando todo dia sempre estouraria o teto).
5. **Causa raiz real do problema original** ("tarefas do Auvo nunca viram OS"): o campo do id da
   tarefa na API real é `taskID` (maiúsculo) — nunca `id`/`taskId` como o código assumia desde
   sempre. `extractTaskId` devolvia `null` pra 100% das tarefas, então nenhuma OS jamais tinha sido
   criada a partir de uma tarefa do Auvo, em nenhuma sync anterior a este fix.

Backfill histórico rodado uma única vez (script pontual, fatias de 30 dias via `pcm-auvo-sync-all`
com `skipPulls`+`tasksImportRange`, sem timeout). Confirmado por query direta:
`pcm.ordens_servico` foi de 7 linhas (0 via Auvo) para 2364 (2357 via Auvo), 175 abertas.
Confirmado visualmente no dashboard e na tela de Ordens de Serviço (screenshots).

**Pendências conhecidas, não são bugs:** `produto_categorias`/`servicos` seguem 404 real (provável
módulo não habilitado no plano Auvo — decisão de negócio do Lucas). Ferramenta/equipamento/outras
entidades continuam com `writeEnabled:false` (E01-S36 — mapeamento de campo ainda não verificado
contra a API real pra essas, ver task pendente lá). Um Personal Access Token do Supabase foi
colado no chat durante esta sessão para debug de logs/SQL direto — **recomendo fortemente
revogar/rotacionar em Settings → Access Tokens da conta Supabase**, já que não deveria ter sido
compartilhado em texto.

Reconciliação AC→implementação concluída. Além de S19–S21, foram ligados ao runtime: métricas/CSAT
server-side e painel completo (S10–S12), identidade/janela e regras operacionais do agente
(S13–S14), RAG real (S15), canais/webhook/envio Meta e templates (S16), automações IG + opt-outs
(S17) e scoring/clusters persistidos no lead (S18). E00-S11 agora inclui saúde de pull/push, badge
PCM, cron observável, pgTAP e gate sem allowlist; a Edge Function ausente
`importar-relatorio-pdf` também foi implementada.

Gates locais verdes: lint, typecheck, 268 testes web, build, arquitetura, auditoria SDD,
67 migrations/Squawk, consistência de 23 Edge Functions, typecheck Deno de todas as funções e
90 testes Deno. O teste Deno achou e permitiu corrigir um bug pré-existente no sync de
equipamentos: uma variável local sombreava a função de resolução do cliente. O pgTAP completo
depende do job Docker do GitHub Actions porque esta máquina não possui Docker.

Pendências externas que código não consegue inventar:
- Meta está pronto para deploy, mas a conta ainda não forneceu `META_ACCESS_TOKEN` e
  `META_APP_SECRET`; o workflow de secrets agora preserva valores remotos quando um GitHub secret
  estiver ausente.
- E01-S36 continua em dry-run para writes genéricos Auvo. Leitura real confirmou vários endpoints,
  mas `/productcategories` e `/services` não existem no contrato v2 usado pela conta e `/tickets`
  exige filtro. Nenhum `writeEnabled` foi ligado contra dados reais sem um sandbox/registro de
  teste autorizado.
- UAT real de Evolution/Meta e formatos de mídia continua após deploy.

---

**Atualização anterior:** 2026-07-08 (sessão Lucas/Codex, continuação) — **E02-S20 e E02-S21
implementadas localmente.**

E02-S20: `FlowBuilderCanvas` agora cria/remove arestas ramificadas, o domínio bloqueia ciclos e nós
órfãos, fluxos lineares antigos continuam implícitos por `ordem`, recipes são copiadas (sem
referência viva), e `pcm-ze-agent` inclui condições/ramificações no prompt e grava
`atendimento.fluxo_logs` por conversa. Migration `0062` cria recipes/logs e RLS.

E02-S21: mensagens ganharam tipos áudio/mídia/template/interativa e payload estruturado; bucket
privado `atendimento-midias`; gravação via MediaRecorder com fallback para anexo; envio rico passa
pela Edge Function autenticada e pelos endpoints Evolution; timeline mostra áudio/imagem/anexo,
templates e botões. O webhook extrai respostas de botão/lista. Badge de canal e edição de tags
foram incorporados ao chat.

Gates de código: lint/typecheck/test/build/arquitetura/migrations/esteira. PgTAP foi escrito em
`atendimento_fluxos_grafo.test.sql` e `atendimento_inbox_rico.test.sql`, mas depende do Supabase
local/CI. UAT com a versão real da Evolution continua obrigatório para confirmar os formatos
`sendMedia`, `sendTemplate` e `sendButtons`.

---

**Última atualização:** 2026-07-08 (sessão Lucas/Codex) — **Claude parou no início da E02-S19;
E02-S19 concluída localmente até o limite do ambiente.**

Retomada reconstruída pelo worktree: a E02-S19 tinha somente `spec.md`, `tasks.md` e as migrations
`0060/0061` iniciadas; aplicação, integração, UI, testes e handoff ainda não existiam. Foi
implementada a aba **Evolution** com criação de instância, QR transitório, consulta de status real,
número vinculado, reconexão e logout. A nova Edge Function autenticada
`atendimento-evolution` é a única que acessa `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`; o segredo
nunca chega ao browser. O front ganhou domínio/use-cases/gateway/adapter e `EvolutionTab`.
`atendimento.canais_externos` foi reutilizada com `tipo='evolution'`, `numero_vinculado` e índice
único parcial por Instance ID ativa.

O roteamento não foi migrado nem reescrito: `atendimento.instancias_agente` continua sendo o vínculo
Instance ID→persona e `config_ze.group_jid/bot_jid` continua sendo a configuração por cliente.
O pgTAP `atendimento_evolution_rls.test.sql` prova a RLS, unicidade e compatibilidade desse vínculo,
mas não rodou: o Postgres local do Supabase não está ativo em `127.0.0.1:54322`. Deno CLI também
segue ausente, então a Edge Function/QR não foram exercitados contra uma Evolution real.

Gates verdes executados individualmente: `lint`, `typecheck`, `test` (263 pass/9 skip), `build`,
`arch:check`, `audit:esteira`, `eval:spec`, `lint:migrations`, `check:edge-functions`. O
`ci:local` foi invocado, mas o hook pre-push pulou jobs porque as mudanças ainda não estão em
commits; por isso os comandos foram rodados diretamente. Próximo passo obrigatório antes de
declarar os AC totalmente aceitos: subir Supabase local/CI para pgTAP e fazer UAT com secrets
Evolution válidos (criar → ler QR → conectar → conferir número → desconectar/reconectar).

Observação de retomada: o mesmo worktree contém implementação não commitada de E02-S10..S18 feita
antes da interrupção do Claude, mas os `tasks.md`/ROADMAP dessas stories ainda dizem `todo`/
“não implementada”. Não foram declaradas concluídas nesta sessão sem uma reconciliação AC por AC.

---

**Última atualização:** 2026-07-08 (sessão Lucas/Claude, parte 2) — **Frente A (Auvo-sync) implementada:
E00-S11 + E01-S35 + E01-S36 (parcial) + E01-S37.**

Branch `docs/E00-stories-auvo-atendimento-fixes` (mesma da parte 1, ver entrada anterior — ainda não commitado).

**O que mudou de verdade nesta parte:**
- **E00-S11 (guarda-corpos):** `scripts/check-edge-functions.mjs` — gate que falha se uma pasta em
  `supabase/functions/` não estiver declarada em `config.toml`, ou se um `functions.invoke("literal")`
  do front apontar pra função inexistente/não declarada. Ligado em `ci:local`/lefthook/`ci.yml`. **Achou
  um bug real pré-existente, não relacionado a Auvo:** `importar-relatorio-pdf` (Laudos SPDA, E01-S19) é
  invocada pela UI mas a Edge Function nunca foi criada — mesmo padrão de 404 silencioso, feature
  diferente. Documentado como gap conhecido no próprio script (visível, não escondido); precisa de story
  própria, não foi corrigido aqui (fora de escopo, exigiria inventar lógica de geração de PDF sem contexto).
  Migration `0050`: tabela `pcm.auvo_entity_status` + view `pcm.auvo_sync_health` (saúde de sync por
  entidade — write_enabled, último push ok/erro); `pcm-auvo-push` agora grava nela a cada drain.
- **E01-S35 (deploy):** raiz do 404 confirmada — `supabase/config.toml` não declarava NENHUMA função.
  Todas as 18 funções reais agora declaradas com `verify_jwt` correto (só os 2 webhooks externos — Auvo,
  WhatsApp — são `false`, validam por HMAC próprio). Novo workflow `smoke-edge-functions.yml` +
  `scripts/smoke-edge-functions.mjs`: pinga cada função pós-push em `main`, retry com backoff, falha o CI
  se alguma responder 404. Runbook `runbooks/deploy-edge-functions.md` com o mecanismo canônico (native
  Supabase↔GitHub integration) e a lista de secrets. **Continua exigindo ação manual do Lucas:** confirmar
  a integração nativa está ligada no dashboard, setar `SUPABASE_PROJECT_ID` nos secrets do Actions, rodar
  `pcm-auvo-webhooks-register` uma vez pós-deploy.
- **E01-S36 (write instantâneo) — PARCIAL, decisão consciente:** migration `0051` faz a trigger
  `fn_auvo_enqueue()` disparar `pcm-auvo-push` via `pg_net` IMEDIATAMENTE após cada enqueue (mesmo padrão
  `pg_net`+Vault de `0011`/`0037`/`0038`, sem secret novo) — Opção B do design, não a A recomendada
  originalmente (SPEC_DEVIATION registrado: cobre toda escrita, não só a do front, com uma mudança
  central). Cron de 1 min vira só fallback. **`writeEnabled` NÃO foi flipado para nenhuma das 13
  entidades** — verificar o mapeamento de campos contra a API Auvo real é pré-requisito da spec (AC-4) e
  esta sessão não tinha credenciais/acesso pra isso (só um login de UI do Auvo, dado pelo Lucas, que não
  serve pra validar contrato de API). Flipar sem verificar arriscaria gravar dado malformado na conta de
  produção real (condomínios/funcionários reais) — ação externa de alto risco. Ficou documentado como
  bloqueio explícito em `tasks.md`, não como silêncio. **Efeito prático:** o cadastro de funcionário
  (CREATE) já propagava por um caminho síncrono separado (`pcm-auvo-users-create`, não afetado por
  `writeEnabled`) — isso deve voltar a funcionar assim que E01-S35 for ativado em produção. Edit/desativar
  de funcionário e as outras 12 entidades continuam em dry-run até alguém com acesso à API Auvo real
  verificar e flipar.
- **E01-S37 (botão sync):** nova Edge Function `pcm-auvo-sync-all` (orquestra pull de cada entidade do
  registry + `pcm-auvo-tasks-import`, erro isolado por etapa — uma entidade falhando não aborta as
  demais). Botão "Sincronizar Auvo" em `PcmDashboardPage.tsx`, ao lado do "Atualizar" já existente (que
  continua só relendo cache local, sem chamar o Auvo). Mostra progresso e "sincronizado às HH:mm" ou a
  lista de etapas que falharam.

**Gates locais rodados e verdes nesta parte:** `lint:migrations` (51 migrations + Squawk), `typecheck`
(web), `test` (216 pass/9 skip), `build` (web), `arch:check` (0 violações), `audit:esteira` (241 docs),
`eval:spec`, `validate-mermaid`, `check:edge-functions` (novo). **Não executado:** `biome`/lint (binário
quebrado neste ambiente — `biome --version` já falha com "Linter process terminated abnormally", parece
problema de ambiente, não do código; sinalizar para o CI real confirmar). Deno/pgTAP — mesma ressalva de
sempre (sem Deno CLI/Docker aqui).

**Próximo passo:** Frente B (Atendimento, E02-S10+) ainda não implementada, só especificada (ver entrada
anterior). Nesta Frente A: falta a verificação de mapeamento Auvo real (E01-S36 task 2) e as ações manuais
de E01-S35 (secrets, ativar integração, registrar webhooks) antes de qualquer teste end-to-end em
staging/dev real.

---

**Última atualização anterior:** 2026-07-08 (sessão Lucas/Claude) — **Diagnóstico de runtime + 16 stories novas
escritas (spec+tasks) para correção Auvo-sync e paridade total do Atendimento com o heziomos.**

Branch `docs/E00-stories-auvo-atendimento-fixes`. Nenhum código de feature implementado — só artefatos
SDD, para outro modelo executar segundo o plano `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md`.

**Diagnóstico (por leitura de código, sem testar prod — memória proíbe testar Netlify público):**
1. **Auvo↔PCM quebrado em runtime.** Nenhuma Edge Function deployada — `supabase/config.toml` não
   declara nenhuma `[functions.*]` e o trigger de push do `.github/workflows/deploy.yml` está
   comentado → toda `functions.invoke` da UI dá 404 (`pcm-auvo-tickets-referencia` na tela Tickets,
   `pcm-auvo-users-create` no cadastro de funcionário). Write path genérico é dry-run permanente
   (`writeEnabled:false` em todos os descriptors de `_shared/auvo/registry/*.ts`). Botão "Atualizar"
   (`PcmDashboardPage.tsx`) só relê tabelas cache `pcm.*`, nunca puxa do Auvo. Reconciliação
   Auvo→PCM (E01-S34) só roda em cron 05:00 + webhook, não alcançável pela UI.
2. **Atendimento longe do heziomos.** 5 abas de config (Canal/Tags/Personas/Agentes/Fluxos) vs 15;
   painel ~3 widgets vs painel operacional completo. Heziomos (`features/crm/`) calcula métricas
   server-side (edge `crm-atendimento-metrics`, foge do cap de 1000 linhas).

**Decisões do Lucas:** frentes A (Auvo) e B (Atendimento) em paralelo, owners distintos; paridade
**total idêntica** com o heziomos; botão global "Sincronizar Auvo" (pull on-demand) + writes instantâneos.

**Stories criadas (owner `—`, disponíveis para pegar; nenhuma implementada):**
- **Frente A (E01, sessão A):** `E01-S35` deploy edge functions+secrets+smoke-test (⚠️ bloqueia tudo)
  → `E01-S36` write path instantâneo → `E01-S37` botão global Sincronizar Auvo.
- **Frente C anti-regressão (E00):** `E00-S11` gate CI de consistência de edge functions + view
  `pcm.auvo_sync_health` (fecha o buraco do "deploy via git que nunca rodava"; feita junto de E01-S35).
- **Frente B (E02, sessão B):** `E02-S10` métricas server-side → `E02-S11` painel completo → `E02-S12`
  widgets avançados; `E02-S13..S21` = 9 stories das abas de config faltantes (IA, Operação, Conhecimento/RAG,
  canais Meta, Coment.IG/Opt-outs, Scoring/Clusters, Evolution, Fluxos node-graph, Inbox rico).

**Próximo passo:** outro modelo pega uma story (marca owner no ROADMAP), cria `design.md`/ADR onde o tier
pedir (E01-S35/S36, E02-S10), implementa. **Pré-requisitos manuais do Lucas (não codificáveis):** setar
secrets Auvo (`AUVO_API_KEY`/`AUVO_USER_TOKEN`, Vault `auvo_trigger_*`) + tokens Meta; validar o mapeamento
de campos da API Auvo contra a API real antes de ligar `writeEnabled` (aviso em `client.ts`).

**Fora de commit hoje (não-feature):** tooling (`.claude/settings.json`, `AGENTS.md`, `CLAUDE.md`,
`biome.json`, `audit-esteira.mjs`, `.codex/hooks.json`) + `graphify-out/` (cache gerado → deve entrar no
`.gitignore`). Toda a feature E01-S22→E02-S08 já está commitada/mergeada em `main`.

---

**Última atualização anterior:** 2026-07-08 (sessão Codex) — **E02-S08 (Base única de Contatos e Timeline)
implementada localmente como pré-requisito do agente comercial.**
Lucas aprovou aproveitar a parte de CRM do HeziomOS que realmente importa agora: uma base única de
contatos/clientes/leads com histórico. Criei `specs/E02-S08-relacionamento-contatos/` (`product`,
`domain`, `design`, `spec`, `tasks`) e ADR `docs/adr/0007-base-unica-contatos-relacionamento.md`.
Decisão: `relacionamento.contatos` é pessoa/canal; `pcm.clientes` continua sendo condomínio/cliente
operacional; `comercial.leads` continua sendo oportunidade; `atendimento.conversas` continua sendo
o histórico de chat.

Implementação: migrations `0047`/`0048` criam schema `relacionamento`, tabelas
`contatos`/`identidades_contato`/`vinculos`, RLS por módulo (`pcm`/`atendimento`/`comercial`),
`atendimento.conversas.contato_id`, `atendimento.conversas.lead_id`,
`comercial.leads.contato_id`, RPC `relacionamento.fn_upsert_contato_whatsapp` e RPC
`relacionamento.get_timeline_contato`. A RPC existente
`atendimento.fn_registrar_mensagem_entrada` foi substituída de forma compatível para resolver/criar
contato por WhatsApp automaticamente. `pcm-ze-agent` agora grava `contato_id` no lead comercial,
atualiza `conversas.lead_id` e cria vínculo `contato -> comercial_lead`. `supabase/config.toml`
expõe o schema `relacionamento` localmente. pgTAP novo:
`supabase/tests/relacionamento_contatos_timeline.test.sql`.

Gates locais verdes: `ci:local` completo (216 pass/9 skip), `lint:migrations` (48 migrations +
Squawk), `lint`, `typecheck`, teste focado de Atendimento (57 pass), `build`, `arch:check`,
`audit:esteira` (205 docs), `eval:spec`. PgTAP real (`relacionamento_contatos_timeline.test.sql`)
ainda depende de Docker/CI.

---

**Última atualização anterior:** 2026-07-08 (sessão Codex) — **E02-S04 (Inbox multi-canal humano)
implementada localmente para fechar o intervalo E02-S01..S07 com artefatos SDD.**
Lucas pediu "mete marcha" no épico E02-S01 até E02-S07. Auditoria inicial: S01/S02/S03/S05/S06/S07
já tinham artefatos e código local; S04 estava no ROADMAP sem `product.md`/`spec.md`/`tasks.md`.
S04 criada como tier Pequeno: `specs/E02-S04-atendimento-multicanal/`. Decisão preservada do
ROADMAP: Instagram/Messenger entram no Inbox humano, **sem IA**.

Implementação S04: migrations `0044_E02-S04_atendimento_multicanal.sql` e
`0046_E02-S04_validar_constraint_multicanal.sql` expandem e validam o check de
`atendimento.conversas.canal` de
`whatsapp` para `whatsapp|instagram|messenger` no padrão anti-lock do repo (`NOT VALID` + validação
separada). `domain/conversas.ts` ganhou `labelCanal` e `canalSuportaIa` com testes; UI do Inbox
passa a exibir badge de canal e esconde "Responder com IA agora"/"Devolver ao Zé" fora do WhatsApp;
`supabase-atendimento-adapter` também bloqueia `acionarZeAgora` se `canal!='whatsapp'`. Integração
real Meta Graph API/webhook/envio ficou explicitamente fora de escopo para não fingir um canal
operacional sem contrato/credenciais. Como `lint:migrations` varre todas as migrations, também
ajustei `0043_E02-S08_agente_comercial.sql` para usar `NOT VALID` e criei
`0045_E02-S08_validar_constraints_agente_comercial.sql`.

Gates locais verdes: `ci:local` completo (216 pass/9 skip), `lint:migrations` (46 migrations +
Squawk), `lint`, `typecheck`, teste focado de Atendimento (57 pass), `build`, `arch:check`,
`audit:esteira` (199 docs), `eval:spec`. Teste manual em browser com dado real multi-canal segue
pendente, como nas demais stories E02.

---

**Última atualização anterior:** 2026-07-07 (sessão Claude) — **E02-S05 (Config: canais + tags) implementada
localmente, seguindo o ciclo formal de agentes Triviaiox (@pm→@sm→@dev→@qa→@devops) a pedido do
Lucas.**
Depois de fechar S01+S02, Lucas pediu para prosseguir o épico E02 pelos agentes especialistas; como
várias stories restantes (S04/S06/S07/S08) tinham decisão de produto em aberto, perguntei por onde
começar — Lucas escolheu S05 (menor ambiguidade). @pm resolveu 2 decisões de escopo antes de
qualquer código (registradas em `product.md`): (1) tags viram catálogo próprio
(`atendimento.tags`, nome+ativo, unique case-insensitive — mesmo padrão de
`pcm.segmentos`/`palavras_chave`), não string livre, pra evitar duplicidade por digitação; (2)
"templates" (do título original da story no ROADMAP) saiu de escopo — é conceito da API oficial
WhatsApp Business/Meta, não se aplica ao Evolution API usado hoje; volta a fazer sentido só quando
`E02-S04` (Instagram/Messenger via Meta) existir. Story renomeada para "Config: canais + tags".

Migration `0040_E02-S05_atendimento_tags.sql`: tabela `atendimento.tags` com RLS FORCE (mesmo
padrão módulo `atendimento`), sem coluna de cor (YAGNI — nada no requisito justifica), sem `DELETE`
(só `ativo=false`, pra não quebrar histórico de conversas que já usam uma tag desativada). Form de
canal usa `atendimento.config_ze` já existente desde `E00-S00` — sem migration nova, só
insert-ou-update explícito por `client_id` no adapter (evitei `upsert()` puro porque sobrescreveria
`created_by NOT NULL` do registro original a cada edição). Feature nova dentro de
`features/atendimento/`: `domain/{tags,config-canal}.ts`, `application/config-gateway.ts` + 6 casos
de uso, `infrastructure/supabase-config-adapter.ts`, `components/{TagsList,ConfigCanalForm}.tsx`,
`pages/AtendimentoConfigPage.tsx` (2 abas). `HomePage.tsx` ganhou o item "Config" em
`ATENDIMENTO_NAV` (`AtendimentoView` agora `"inbox" | "config"`).

Gates locais verdes: `lint:migrations` (40 migrations), `lint`, `typecheck`, `test` (186 pass/9
skip), `build`, `arch:check`, `audit:esteira` (187 docs), `eval:spec`, `pnpm run ci:local` (mirror
completo do lefthook pre-push, todas as 9 checagens passando). Sem Edge Function nova nesta story
(CRUD direto via RLS) — não há gap de Deno CLI/Docker aqui, só o pgTAP (`atendimento_tags_rls.
test.sql`) que segue não executado por falta de Docker, mesma ressalva de sempre. Teste manual em
browser ainda pendente.

**Commitado, NÃO pushado** — mesma instrução permanente do Lucas nesta sessão: push só com
confirmação explícita separada.

**Próximo passo:** pedir confirmação para `git push`; depois, seguir o épico E02 pelos agentes
especialistas nas próximas stories que Lucas priorizar (S06 tem decisão de produto pendente — 1
persona vs. múltiplas; S04 precisa perguntar se o Zé deve responder Instagram/Messenger; S03
depende de S01+S02 em produção com dado real).

---

**Última atualização anterior:** 2026-07-07 (sessão Claude) — **Nova épica E02 aberta: Atendimento (Inbox +
Zé multi-agente). E02-S01 (fundação) + E02-S02 (Inbox) implementadas localmente.**
Lucas pediu para portar o módulo de Atendimento pronto de um projeto irmão (`heziomos-main`) para
o Sinérgica-SO, adaptado ao design system. Investigação (Plan Mode) mostrou que não é uma tela —
são 3 áreas grandes (Dashboard/Inbox/Config, ~15.700 linhas na origem, schema `crm` dedicado).
Lucas confirmou querer as 3 áreas e todos os canais (WhatsApp+Instagram+Messenger), com o Agente
Zé (já em produção, `E01-S02`) virando "um agente dentro da estrutura de atendimento" em vez de um
fluxo paralelo. Dado o tamanho, especifiquei o épico inteiro (8 stories, plano completo salvo em
`~/.claude/plans/nesse-projeto-tem-o-lively-creek.md`) mas só implementei as 2 primeiras agora —
S03 a S08 ficam no ROADMAP como "Planejado", com decisões de produto pendentes documentadas story a
story (ex.: S04 multi-canal precisa perguntar se o Zé deve responder Instagram/Messenger; S07/S08
podem nem ser escopo de Atendimento, e sim de Comercial).

**E02-S01 (fundação):** migration `0039_E02-S01_atendimento_conversas_mensagens.sql` cria
`atendimento.conversas`/`atendimento.mensagens` (não reaproveita `wa_messages`/`wa_queue` — ciclo
de vida diferente, aquelas são log bruto/fila efêmera) com RLS FORCE módulo `atendimento` e RPC
`atendimento.fn_registrar_mensagem_entrada` (upsert de conversa + insert idempotente de mensagem +
incremento de `nao_lidas`, tudo atômico — evitar isso numa RPC única criaria dupla contagem em
toda reentrega de rede do Evolution, já que o dedupe por `wa_message_id` só existe dentro dela).
`_shared/evolution.ts` extrai `responderEvolution` de `pcm-ze-agent` (reuso). `pcm-whatsapp-
webhook` ganhou uma chamada aditiva a essa RPC logo após o upsert existente em `wa_messages` (zero
mudança no caminho antigo). `pcm-ze-agent` ganhou: checagem de `conversas.modo` (pausa o Zé numa
conversa específica sem mexer em `config_ze`, que é por condomínio inteiro), espelho de toda
resposta em `mensagens` (`remetente_tipo='ze'`), link de `ordem_servico_id` após criar a OS, e
campo `forcar?: boolean` no `InputSchema` (aciona o Zé fora da janela normal de debounce — usado
pelo botão "Responder com IA agora" do Inbox). Edge Function nova `atendimento-whatsapp-envio`
(`enviar`/`assumir`/`devolver`, via `userClient` — anon key + JWT do chamador, RLS decide
autorização) grava e envia mensagem humana, marcando `status_entrega` real do Evolution sem
derrubar a função em caso de falha de envio. pgTAP: `atendimento_conversas_rls.test.sql`,
`atendimento_mensagens_rls.test.sql`, `atendimento_registrar_mensagem_rpc.test.sql` (prova
idempotência explicitamente).

**E02-S02 (Inbox):** feature nova `apps/web/src/features/atendimento/` completa (domain/
application/infrastructure/components/pages, DDD por feature igual a `features/pcm`). Layout 3
colunas (lista/chat/perfil) com os tokens já existentes do design system (sem shadcn/Radix — não
existe lib de componentes compartilhada neste projeto). Polling manual (`useEffect`+
`setInterval`, sem React Query): lista a cada 5s, mensagens da conversa aberta a cada 3s, pausado
via `document.visibilitychange`. Toggle IA/humano (assumir/devolver) e "Responder com IA agora"
chamam a Edge Function/`pcm-ze-agent` de S01. `HomePage.tsx` ganhou `AtendimentoView`/
`ATENDIMENTO_NAV` (1 item, "Inbox") — módulo `atendimento` já existia em `MODULOS`/gate de
permissão desde antes, só caía no fallback `EmConstrucao`.

Gates locais verdes: `lint:migrations` (39 migrations), `lint`, `typecheck`, `test` (175 pass/9
skip), `build`, `arch:check`, `audit:esteira` (184 docs), `eval:spec`. Deno CLI/Docker ausentes —
mesma ressalva de toda a integração Auvo/Zé desde `E01-S09`: os testes Deno das Edge Functions
novas/editadas não foram executados, e nenhum teste manual em browser com mensagem real via
Evolution foi feito ainda (pendente, marcado como "pendente" em `specs/E02-S02.../tasks.md`).
Divergências de spec documentadas (não silenciosas) em `specs/E02-S01-atendimento-fundacao/
tasks.md`: a RPC de S01 e a consolidação de `enviar`/`assumir`/`devolver` numa única Edge Function
não estavam no design original, ambas por razões técnicas explicadas ali.

**Commitado, NÃO pushado** — por instrução explícita do Lucas nesta sessão: "o commit se você já
testou pode seguir, só o push que precisa confirmar se vou querer outras coisas". Aguardando
confirmação separada antes de `git push` (mesma branch `feat/E01-S22-motor-sync-auvo-write`, que já
está `ahead 1` do remoto por `E01-S34`).

**Bloqueio de processo (não resolvido, herdado de sessões anteriores):** os mesmos 5 arquivos de
infra do `graphify` (`.claude/settings.json`, `biome.json`, `scripts/audit-esteira.mjs`,
`AGENTS.md`, `CLAUDE.md`) seguem modificados e não commitados, e agora também `.codex/hooks.json`
(novo, não rastreado) e `graphify-out/` inteiro (cache/relatórios gerados, centenas de arquivos) —
nenhum desses é do escopo de E02-S01/S02, não foram tocados nem staged.

**Próximo passo:** pedir ao Lucas confirmação para `git push` desta branch; depois do push, rodar
`pnpm run ci:local` real no CI (Deno/pgTAP); testar em browser com `.env.local` + mensagem real via
Evolution (dev server local, nunca contra o Netlify de produção). Se aprovado, seguir para
`E02-S03` (Dashboard) só depois de S01+S02 estarem em produção com dado real (métricas vazias não
validam nada).

---

**Última atualização anterior:** 2026-07-07 (sessão Claude) — **PR #30 aberto, CI verde, e E01-S34
(Reconciliação Auvo→PCM) aberta e implementada localmente em cima dele.**
Lucas testou o PR #30 num deploy preview e achou 4 problemas: (1) criar funcionário deu "Failed to
send a request to the Edge Function", (2) Tickets deu o mesmo erro, (3) OS abertas direto no Auvo
não aparecem no PCM, (4) o Dashboard reflete essa mesma falta de dado. Investigação: (1)/(2) eram
esperados — `pcm-auvo-users-create`/`pcm-auvo-tickets-referencia` são funções novas desta PR, só
vão pro Supabase real no merge (integração nativa Supabase↔GitHub, confirmado via curl → 404 nas
duas). (3)/(4) revelaram um achado bem maior: **9 dos 12 descriptors do motor genérico declaravam
`cronSchedule`, mas nenhuma migration desde `E01-S23` jamais criou o `pg_cron` que chama
`pcm-auvo-pull`** — metadado morto, zero sincronização Auvo→PCM real para essas 9 entidades (nem
webhook, que a maioria não suporta, nem cron, que nunca foi ligado). E o webhook de OS/Task (desde
`E01-S10`) só faz `UPDATE` numa OS já existente por `auvo_task_id`, nunca `INSERT` — tarefa nova
criada direto no Auvo nunca vira OS no PCM.

Aberta `E01-S34` (tier arquitetural, `product.md`/`design.md`/`spec.md`/`tasks.md` completos) pra
fechar isso: migration `0037` liga 3 `pg_cron` reais (diário 6 entidades de catálogo, 6h 3
entidades operacionais, horário Tickets) chamando `pcm.fn_invoke_auvo_pull` (nova RPC, espaça as
chamadas com `pg_sleep(2)` pra não rajar o Auvo); `_shared/auvo/os-from-task.ts` (novo, compartilhado)
resolve `client_id` via `pcm.clientes.auvo_id` e cria a OS (`origem='auvo'`, `categoria='corretiva'`
AUTO-DECISION, `numero` via mesma lógica de `pcm-ze-agent`); `pcm-auvo-webhook` passa a criar OS no
branch `if (!os)` em vez de só ignorar (zero mudança no caminho de OS já conhecida — só
reindentação, revisão manual linha a linha feita); nova Edge Function `pcm-auvo-tasks-import`
(migration `0038`, cron diário 05:00 UTC) faz backfill de tarefas antigas sem soft-delete (OS é
dado operacional, não se apaga sozinho). Limitação consciente documentada: o primeiro evento de uma
tarefa genuinamente nova com `taskStatus=1`("Aberta") sozinho não cria OS em tempo real — a ordem de
checagem existente no webhook (`targetStatus==null` ignora antes de resolver a OS) não foi
reordenada pra não arriscar regressão em código de produção ativo desde `E01-S10`; fica coberto pelo
import diário, não é lacuna sem cobertura. Gates locais verdes: `lint:migrations` (38 migrations),
`lint`/`typecheck`/`build`/`arch:check` (cobrem só `apps/web` — `supabase/functions/**` está fora
do escopo do biome/tsc deste monorepo), `test` (164 pass/9 skip), `audit:esteira` (176 docs),
`eval:spec`. Deno CLI/Docker ausentes — os testes Deno novos (`os-from-task.test.ts`,
`pcm-auvo-tasks-import/index.test.ts`, `tickets.test.ts` atualizado) foram escritos mas não
executados; confirmar no CI antes do merge.

**Sobre o PR #30 em si:** commitado e pusheado (5 commits), CI 100% verde
(`qualidade`/`migrations`/`db-tests` todos `pass`) — achado e corrigido nesse processo um `GRANT`
faltante no pgTAP de outbox (`E01-S22`, nunca tinha rodado de verdade antes, primeira vez que o
pgTAP roda contra Postgres real via CI nesta épica inteira). Também ajustado, a pedido do Lucas, o
hook `.claude/hooks/enforce-git-push-authority.sh`: era `deny` incondicional (criado numa sessão
anterior porque um agente fazia push a cada commit sem perguntar); virou `ask` — sempre pede
confirmação explícita antes de qualquer `git push`, nunca bloqueia nem libera sozinho.

**Bloqueio de processo (não resolvido, herdado da atualização anterior):** 5 arquivos de infra do
`graphify` (`.claude/settings.json`, `biome.json`, `scripts/audit-esteira.mjs`, `AGENTS.md`,
`CLAUDE.md`) seguem modificados e não commitados — o classificador de auto-modo bloqueou esse
commit por ser "auto-modificação de config não pedida explicitamente". Revisar/commitar manualmente
se for intencional.

**Próximo passo:** commitar e pushear E01-S34 em cima do PR #30 (mesma branch); aguardar CI;
depois do merge, confirmar manualmente que `pcm-auvo-tasks-import`/`pcm-auvo-tickets-referencia`/
`pcm-auvo-users-create` foram deployadas e que os 3 `pg_cron` novos aparecem em
`select * from cron.job where jobname like 'pcm_auvo%'`; testar em browser de novo com dado real.

---

**Última atualização anterior:** 2026-07-07 (sessão Claude) — **Revisão adversarial de E01-S22 a S32 +
correções + E01-S33 (Tickets) implementada localmente. Épica E01-S22..S33 fecha aqui.**
Usuário pediu revisão completa de qualidade/conformidade do que o Codex implementou nas retomadas
anteriores (S22-S32). Rodei os gates eu mesma (não confiei no que STATE.md alegava) e 3 revisões
adversariais paralelas (migrations/segurança, Edge Functions/registry, features web). Achado mais
urgente não era de código: **nada de S23 a S32 estava commitado** (129 arquivos só no working
tree) — commitado agora (`feat(E01-S23): ...`, bundle único das 10 stories, mesmo padrão de PR
bundle já usado neste projeto para stories sequenciais revisadas juntas). Achados de código,
todos com fix aplicado nesta sessão (detalhe completo na seção "Revisão adversarial" do `tasks.md`
de cada story afetada):
- **C1 (crítico, perda de dado):** editar cliente pela lista (`ListaClientesPage`) apagava
  `observacoes` silenciosamente — `observacoes` nunca era selecionada em `listarClientes()` nem
  usada como valor inicial do form. Corrigido (S27).
- **C2 (crítico, anti-loop quebrado):** 4 Edge Functions legadas de `E01-S09`/`E01-S11`/`E01-S13`
  (`pcm-auvo-customers-sync`, `-customers-import`, `pcm-auvo-users-sync`, `pcm-auvo-equipment-sync`,
  todas ainda ativas via `pg_cron`) escreviam em `pcm.clientes`/`funcionarios`/`equipamentos` sem
  passar pela RPC anti-loop — o trigger `fn_auvo_enqueue` anexado por `E01-S27`/`S28`/`S29`
  enfileiraria eco de escrita pro Auvo assim que `writeEnabled` for ligado. Corrigido: as 4 usam
  `fn_upsert_auvo_sync`/`fn_apply_auvo_sync` agora.
- **C3 (crítico):** `pcm.fn_upsert_auvo_sync` (migration `0026`, `E01-S23`) quebrava em qualquer
  patch com coluna array (`malformed array literal`) — `equipesDescriptor.fromAuvo` popula
  `participantes_auvo_ids`/`gestores_auvo_ids` (`bigint[]`). Corrigido na RPC.
- **C4 (crítico):** `created_by NOT NULL` sem default em 6 tabelas (`tipos_tarefa`, `segmentos`,
  `palavras_chave`, `produto_categorias`, `equipamento_categorias`, `cliente_grupos`) — a RPC
  inbound genérica nunca preenche essa coluna, primeiro registro novo via pull/webhook estouraria
  `NOT NULL violation`. Corrigido: coluna nullable, mesmo padrão já usado a partir de `E01-S28`.
- Achados médios/baixos não corrigidos (documentados como follow-up no `tasks.md` de cada story:
  race condition em alocação de ferramenta sem lock no banco, violação de camada em
  `EquipamentosPage`, `client_id`/arrays de `cliente_grupos` nunca populados no sentido Auvo→PCM,
  mitigação "match-by-description" prometida no design nunca implementada, falha parcial no drain
  pode duplicar criação no Auvo em cenário raro de retry manual).

Depois das correções, implementei **E01-S33 (Tickets)** — só tinha `spec.md`/`tasks.md`, sem
código. Migration `0036_E01-S33_tickets.sql` cria `pcm.tickets` com `cliente_auvo_id`/
`equipe_auvo_id` denormalizados (mesmo padrão de `pcm.cliente_grupos.clientes_auvo_ids` — o
descriptor não pode fazer join, é função pura). Descriptor `tickets` (`/tickets`,
`webhookEntity:62`, `deleteStrategy:'unsupported'`, `writeEnabled:false`) com teste Deno.
**Mudança de contrato aditiva em `AuvoEntityDescriptor`:** novo campo opcional
`toAuvoUpdate?(row)` — Tickets é a primeira entidade cujo PATCH só documenta um subconjunto de
campos (`statusId`); `pcm-auvo-push` usa esse payload restrito no PATCH quando presente, cai para
`toAuvo()` completo quando ausente (zero mudança de comportamento para as outras 12 entidades).
Edge Function nova `pcm-auvo-tickets-referencia` (proxy autenticado para `GET /tickets/request-
type` e `GET /tickets/status`, listas de referência não sincronizadas pelo motor genérico). Web:
slice `tickets` (domain/application/infrastructure/página) + item "Tickets" em PCM > OPERAÇÃO.
pgTAP `tickets_rls.test.sql` escrito. Gates verdes: `lint:migrations` (36 migrations), `lint`,
`typecheck`, `test` (164 pass/9 skip), `build`, `arch:check`, `audit:esteira`, `eval:spec`. Deno
CLI e Docker seguem ausentes; testes Deno e `supabase test db` não foram executados. Nenhum dado
real foi criado/usado; teste manual em browser não executado.

**Bloqueio de processo (não resolvido nesta sessão):** o classificador de auto-modo bloqueou o
commit de infra do `graphify` (`.claude/settings.json`, `biome.json`, `scripts/audit-esteira.mjs`,
`AGENTS.md`, `CLAUDE.md`) por ser "auto-modificação de config não pedida explicitamente nesta
sessão" — esses 5 arquivos seguem modificados e não commitados (mudança de tooling, não do épico
Auvo; instalada em algum momento desta sessão/ambiente, não pelo Codex). Revisar e commitar
manualmente se for intencional.

**Próximo passo:** push da branch + abrir PR (fora do alcance desta sessão — `@devops`, decisão
humana). Antes de mergear: (1) confirmar Deno/pgTAP no CI `db-tests`; (2) revisar/commitar (ou
descartar) os 5 arquivos de infra do graphify; (3) decidir se os achados médios/baixos documentados
viram tasks de follow-up antes ou depois do merge — nenhum bloqueia, mas C2-C4 eram reais e só
foram pegos porque alguém pediu revisão adversarial explícita, o que reforça o valor de sempre
pedir essa revisão antes de fechar uma leva grande de stories.

**Última atualização anterior:** 2026-07-07 (retomada Codex) — **E01-S32 Equipes implementada localmente.**
Código novo: migration `0035_E01-S32_equipes.sql` cria `pcm.equipes` com
`participantes_auvo_ids bigint[]`, `gestores_auvo_ids bigint[]`, RLS FORCE com escrita por
`pcm:escrita` e trigger `fn_auvo_enqueue('equipes')`. Descriptor `equipes` registrado
(`/teams`, cron `0 */6 * * *`, `supportsUpdate:false`, `deleteStrategy:'unsupported'`,
`writeEnabled:false`) com teste Deno escrito. Web: novo slice `equipes` e `EquipesPage` em PCM >
CADASTROS, com seletor de técnicos sincronizados (`auvo_user_id`) e aviso permanente de que
editar/desativar equipes já sincronizadas não propaga ao Auvo. pgTAP `equipes_rls.test.sql`
escrito. Gates verdes: `lint:migrations`, `lint`, `typecheck`, `test` (158 pass/9 skip), `build`,
`arch:check`, `audit:esteira`, `eval:spec`, `git diff --check` e `pnpm run ci:local`. Deno CLI e
Docker seguem ausentes; testes Deno e `supabase test db` não foram executados. Nenhum dado real foi
criado/usado.

**Próximo passo:** seguir `E01-S33` (Tickets).

**Última atualização anterior:** 2026-07-07 (retomada Codex) — **E01-S31 Serviços implementada localmente.**
Código novo: migration `0034_E01-S31_servicos.sql` cria `pcm.servicos` com `auvo_id text`
(GUID/string), `preco_centavos int`, RLS FORCE com escrita por `pcm:escrita` e trigger
`fn_auvo_enqueue('servicos')`. Descriptor `servicos` registrado (`/services`, cron `0 */6 * * *`,
`externalIdField:'externalCode'`, `deleteStrategy:'soft-patch'`, `writeEnabled:false`) com teste
Deno escrito cobrindo conversão centavos↔decimal. Web: novo slice `servicos` e `ServicosPage` em
PCM > CADASTROS, mantendo `auvoId: string | null` na stack e preço em centavos no domínio. pgTAP
`servicos_rls.test.sql` escrito, incluindo checagem de `auvo_id` como `text`. Gates verdes:
`lint:migrations`, `lint`, `typecheck`, `test` (156 pass/9 skip), `build`, `arch:check`,
`audit:esteira`, `eval:spec`, `git diff --check` e `pnpm run ci:local`. Deno CLI e Docker seguem
ausentes; testes Deno e `supabase test db` não foram executados. Nenhum dado real foi criado/usado.

**Última atualização anterior:** 2026-07-07 (retomada Codex) — **E01-S30 Ferramentas/Kits implementada localmente.**
Código novo: migration `0033_E01-S30_ferramentas.sql` cria `pcm.ferramentas` e
`pcm.ferramenta_alocacoes`, com RLS FORCE, escrita por `pcm:escrita`, trigger
`fn_auvo_enqueue('ferramentas')` e RPC `fn_reconcile_ferramenta_alocacoes` para reconciliar
`employeesStock`. Descriptor `ferramentas` registrado (`/products`, cron `0 */6 * * *`,
`deleteStrategy:'soft-patch'`, `writeEnabled:false`) com teste Deno escrito. `pcm-auvo-pull` foi
ajustado para permitir leitura/poller mesmo com `writeEnabled:false` (o gate segue protegendo
apenas o drain de escrita) e reconcilia `employeesStock` em `pcm.ferramenta_alocacoes`. Edge
Function dedicada `pcm-auvo-ferramenta-alocacao` chama
`PUT /products/employee-product-stock` e grava a alocação local, fora do outbox genérico. Web:
novo slice `ferramentas`, páginas `FerramentasPage` e `FerramentasPorTecnicoPage`, ligadas em PCM
> CADASTROS e PCM > OPERAÇÃO. pgTAP `ferramentas_rls.test.sql` e
`ferramenta_alocacoes_rls.test.sql` escritos. Gates verdes: `lint:migrations`, `lint`,
`typecheck`, `test` (153 pass/9 skip), `build`, `arch:check`, `audit:esteira`, `eval:spec`,
`git diff --check` e `pnpm run ci:local`. Deno CLI e Docker seguem ausentes; testes Deno e
`supabase test db` não foram executados. Nenhum dado real foi criado/usado.

**Última atualização anterior:** 2026-07-07 (retomada Codex) — **E01-S29 Equipamentos implementada localmente.**
Código novo: migration `0032_E01-S29_equipamentos.sql` cria a tabela promovida
`pcm.equipamentos`, migra dados de `pcm.equipamentos_cache`, mantém a cache legada para
compatibilidade, adiciona colunas cadastrais/sync, RLS FORCE com escrita por `pcm:escrita` e
trigger `fn_auvo_enqueue('equipamentos')` com referência a `ADR-0006`. Descriptor `equipamentos`
registrado (`/equipments`, webhook `Equipment=27`, `deleteStrategy:'soft-patch'`,
`writeEnabled:false`), teste Deno escrito, e `pcm-auvo-equipment-sync` agora upserta
`pcm.equipamentos` com vínculo opcional a `pcm.clientes`. Web: novo slice `equipamentos` e
`EquipamentosPage` em PCM > CADASTROS, com listar/criar/editar/desativar, status de sync, gate de
permissão e confirmação conservadora quando há vínculo OS ↔ equipamento. Consumidores que liam
`pcm.equipamentos_cache` (Visão 360, Dashboard PCM, PMOC) foram movidos para a fonte promovida.
pgTAP `equipamentos_rls.test.sql` escrito. Gates rodados e verdes até aqui: `lint:migrations`,
`lint`, `typecheck`, `test` (150 pass/9 skip), `build`, `arch:check`, `audit:esteira`,
`eval:spec` e `git diff --check`. Deno CLI e Docker seguem ausentes; testes Deno e
`supabase test db` não foram executados. Nenhum dado real foi criado/usado.

**Última atualização anterior:** 2026-07-07 (retomada Codex) — **E01-S28 Funcionários implementada localmente.**
Código novo: migration `0031_E01-S28_funcionarios.sql` cria `pcm.funcionarios` a partir de
`pcm.tecnicos_cache` (mantém o cache antigo/deprecated para não quebrar contrato read-only),
adiciona colunas de cargo/contato/tipo/culture/sync, RLS FORCE com escrita por `pcm:escrita`,
trigger `fn_auvo_enqueue('funcionarios')` e RPC `fn_insert_funcionario_auvo_sync` para inserção com
anti-loop. Descriptor `funcionarios` registrado (`/users`, webhook `User=1`,
`deactivatePatch:{unavailableForTasks:true}`, `writeEnabled:false`); `pcm-auvo-users-sync` agora
upserta `pcm.funcionarios`. Criação com senha ficou fora do outbox genérico por segurança:
`pcm-auvo-users-create` recebe `password` em memória, cria no Auvo, e grava a linha local via RPC
sem persistir senha. Web: novo slice `funcionarios` e `FuncionariosPage` em PCM > CADASTROS, com
aviso de acesso real ao app Auvo, criar/editar/desativar e gate de permissão. pgTAP
`funcionarios_rls.test.sql` e teste Deno do descriptor escritos. Gates rodados e verdes:
`lint:migrations`, `lint`, `typecheck`, `test` (148 pass/9 skip), `build`, `arch:check`,
`audit:esteira`, `eval:spec` e `pnpm run ci:local`. Deno CLI e Docker seguem ausentes; testes
Deno e `supabase test db` não foram executados. Nenhum dado real foi criado/usado.

**Última atualização anterior:** 2026-07-07 (retomada Codex) — **E01-S27 Clientes CRUD + Grupos de Clientes implementada localmente.**
Código novo: migration `0030_E01-S27_clientes_grupos.sql` adiciona colunas de sync e trigger
`fn_auvo_enqueue('clientes')` em `pcm.clientes`, cria `pcm.cliente_grupos` com RLS FORCE,
`cliente_ids uuid[]` + `clientes_auvo_ids bigint[]` (decisão para o descriptor montar
`clientsId[]` sem join), trigger de outbox; descriptors `clientes` (`/customers`, webhook
`Customer=7`) e `cliente_grupos` (`/customergroups`, `deleteStrategy:'hard-delete'`,
`supportsUpdate:false`, cron diário) registrados no entity registry, com testes Deno escritos.
Web: `ListaClientesPage` ganhou criar/editar/excluir com gate `podeAcessar('pcm','escrita')` e
bloqueio de exclusão quando há OS aberta; novo slice `cliente-grupos` (domain/application/adapter/
page) com aviso de que renomear/alterar composição é local porque Auvo não documenta PATCH; item
“Grupos de Clientes” ligado em PCM > CADASTROS. Testes pgTAP escritos:
`clientes_crud_rls.test.sql` e `cliente_grupos_rls.test.sql`. Gates rodados e verdes:
`lint:migrations`, `lint`, `typecheck`, `test` (146 pass/9 skip), `build`, `arch:check`,
`audit:esteira`, `eval:spec` e `pnpm run ci:local`. Deno CLI e Docker seguem ausentes; testes Deno
e `supabase test db` não foram executados. Nenhum dado real foi criado/usado.

**Última atualização anterior:** 2026-07-07 (retomada Codex) — **E01-S26 Categorias implementada localmente.**
Código novo: migration `0029_E01-S26_categorias.sql` (`pcm.produto_categorias` e
`pcm.equipamento_categorias`, RLS FORCE módulo `pcm`, triggers do outbox); descriptors em
`_shared/auvo/registry/categorias.ts` com `deleteStrategy:'hard-delete'` e `writeEnabled:false`;
slice web `catalogos-simples` estendido para usar `nome` nas categorias, reaproveitando UI e
adapter; páginas `ProdutoCategoriasPage` e `EquipamentoCategoriasPage` ligadas em `HomePage` >
PCM > CADASTROS. Gates rodados e verdes: `lint:migrations`, `lint`, `typecheck`, `test` (139
pass/9 skip), `build`, `arch:check`. Deno CLI e Docker seguem ausentes; Deno/pgTAP/browser real
pendentes. Ajuste de infra: `biome.json` agora ignora `.claude/**` e `graphify-out/**`, porque
Graphify gerou JSON grande e `.claude/settings.json` estava modificado fora do escopo.

**Última atualização anterior:** 2026-07-07 (retomada Codex) — **E01-S25 Segmentos + Palavras-chave implementada localmente.**
Código novo: migration `0028_E01-S25_segmentos_palavras_chave.sql` (`pcm.segmentos` e
`pcm.palavras_chave`, RLS FORCE módulo `pcm`, triggers do outbox); descriptors compartilhados em
`_shared/auvo/registry/catalogos-simples.ts` com `deleteStrategy:'hard-delete'` e
`writeEnabled:false`; domínio/use cases/adapter/páginas compartilhados em `catalogos-simples`;
`SegmentosPage` e `PalavrasChavePage` ligados em `HomePage` > PCM > CADASTROS. Gates rodados e
verdes: `lint:migrations`, `lint`, `typecheck`, `test` (138 pass/9 skip), `build`,
`audit:esteira`, `arch:check`. Deno CLI e Docker seguem ausentes, então testes Deno e pgTAP não
foram executados; teste manual com dado reversível também não foi feito.

**Última atualização anterior:** 2026-07-07 (retomada Codex) — **E01-S24 Tipos de Tarefa implementada localmente.**
Código novo: migration `0027_E01-S24_tipos_tarefa.sql` (`pcm.tipos_tarefa`, RLS FORCE módulo
`pcm`, trigger `fn_auvo_enqueue('tipos_tarefa')`); descriptor
`_shared/auvo/registry/tipos-tarefa.ts` registrado em `registry/index.ts` com `writeEnabled:false`
e teste Deno de mapeamento; domínio/use cases/adapter Supabase (`tipos-tarefa*`); página
`TiposTarefaPage` ligada em `HomePage` > PCM > CADASTROS. Gates rodados e verdes:
`lint:migrations`, `lint`, `typecheck`, `test` (132 pass/9 skip), `build`, `audit:esteira`,
`eval:spec`, `arch:check`. Deno CLI e Docker seguem ausentes: testes Deno e pgTAP/`supabase test
db` não executados. Teste manual com usuário real não foi feito porque exigiria aplicar migration e
criar dado; se fizer depois, usar registro descartável e excluir/reverter no fim, como Lucas pediu.

**Última atualização anterior:** 2026-07-07 (retomada Codex) — **E01-S23 read path implementada localmente.**
Código novo: registry com `byWebhookEntity`/`cronEnabled`; função pura
`_shared/auvo/webhook-dispatch.ts` + teste; `pcm-auvo-webhook` agora tenta dispatcher genérico para
entidades registradas antes do caminho legado de `Task` (sem mexer no handler antigo); novas Edge
Functions `pcm-auvo-pull` (poller genérico) e `pcm-auvo-webhooks-register` (one-shot pós-deploy);
migration `0026_E01-S23_auvo_sync_upsert_rpc.sql` com `fn_upsert_auvo_sync` e
`fn_soft_delete_missing_auvo_sync`, ambas com GUC `app.auvo_sync_write=true` para anti-loop. Gates
rodados e verdes: `lint:migrations`, `lint`, `typecheck`, `test` (126 pass/9 skip), `build`,
`audit:esteira`, `eval:spec`, `arch:check`. Deno CLI e Docker continuam ausentes, então testes
Deno novos e pgTAP/`supabase test db` ainda precisam rodar no CI antes do merge.

**Última atualização anterior:** 2026-07-07 (retomada Codex) — **Decisões PO resolvidas para E01-S28/E01-S29.**
`E01-S28` agora permite criar funcionário novo pelo PCM, mesmo provisionando credencial real no
Auvo (`login`/`password` no `POST /users/`); a spec/tasks exigem que senha não seja persistida nem
logada e que credenciais nunca entrem em PATCH comum. `E01-S29` saiu de bloqueio: Equipamentos
seguem o padrão da OS (`ADR-0001`) formalizado em `ADR-0006` — PCM origina cadastro/comandos e
movimenta o Auvo; Auvo segue autoridade operacional/de campo e devolve estado por webhook
`Equipment`. ROADMAP atualizado; nenhuma implementação/código além de docs/ADR nesta retomada.

**Última atualização anterior:** 2026-07-07 (2ª sessão do dia) — **Todas as specs de E01-S23 a E01-S33
escritas** (o Lucas pediu para escrever tudo até o limite de contexto, "se esgotar o Codex
continua"), na mesma branch `feat/E01-S22-motor-sync-auvo-write` (ainda sem push — só dá push ao
fechar a épica inteira). Cada story ganhou `spec.md`+`tasks.md` (S23 também `product.md`, reusa
`design.md`/`domain.md` de S22, mesmo padrão de S10/S11 sobre S09).

**Mapeamento do catálogo real da API Auvo (Apiary/blueprint público) revelou 4 divergências reais
do motor genérico de `E01-S22`, todas corrigidas no código ANTES de escrever as specs seguintes
(nunca deixadas como "descobrir depois em produção"):**
1. **PATCH da Auvo v2 é JSON Patch** (`[{op:"replace",path,value}]`), não objeto flat — `pcm-auvo-push`
   enviava o objeto flat direto; teria quebrado o primeiro PATCH real. Corrigido com
   `_shared/auvo/json-patch.ts` (`toAuvoJsonPatch`), aplicado nas 2 chamadas `auvoPatch` do drain.
2. **Nem todo recurso tem `active`/`PATCH`/`externalId`** — `Segments`/`Keywords`/`Categorias`/
   `Customer Groups` sem `active` (só DELETE físico); `Customer Groups`/`Teams` sem `PATCH`;
   `Users` usa `unavailableForTasks` em vez de `active`; `Task Types`/`Segments`/`Keywords`/
   `Customer Groups`/`Teams` sem `externalId` no POST. `AuvoEntityDescriptor` ganhou 3 campos
   aditivos: `deleteStrategy` (`'soft-patch'`\|`'hard-delete'`\|`'unsupported'`),
   `deactivatePatch`, `supportsUpdate`.
3. **`Services` usa `externalCode`** (não `externalId`) e `id` GUID (não bigint) — campo aditivo
   `externalIdField` no descriptor, `pcm-auvo-push` nunca mais hardcoda o nome do campo.
4. Todos os 3 pontos acima já têm teste Deno cobrindo o caso novo em
   `pcm-auvo-push/index.test.ts` (não executado aqui — sem Deno CLI — mas escrito).

**Achado que foi registrado como bloqueio real naquela sessão e resolvido em 2026-07-07 (retomada
Codex):** `E01-S28` (Funcionários) tinha decisão de produto pendente sobre criar funcionário novo
pelo PCM; Lucas confirmou que pode criar. `E01-S29` (Equipamentos) estava bloqueada por possível
reversão de `E01-S16`; Lucas confirmou que o Auvo segue dono operacional, mas o registro/comando
deve partir do PCM e movimentar o Auvo, como OS. Ver topo deste STATE e `ADR-0006`.

**Próximo passo:** implementar `E01-S23` (read path) e depois as entidades em ordem de
dependência (`S24`→`S25`→`S26`→`S27`→`S28`→`S29`→`S30`→`S31`→`S32`→`S33`). Se o Codex continuar a
partir daqui, ler `E01-S22/design.md` inteiro primeiro (tem todos os achados de API documentados)
antes de implementar qualquer entidade — evita redescobrir os mesmos 4 problemas por tentativa e
erro.

---

**Última atualização anterior:** 2026-07-07 — **Nova épica aberta: "PCM como front-end completo do Auvo"**
(plano completo em `~/.claude/plans/auvo-a-plataforma-ethereal-bonbon.md`, mapeando todo o catálogo
da API Auvo v2 — clientes, funcionários, produtos/ferramentas, serviços, equipamentos, categorias,
equipes, tickets — para CRUD dentro do PCM, com Financeiro descartado pelo usuário e Produtos
reformulado como "ferramentas/kits de técnico"). Decisões do usuário: delete no PCM = soft-delete →
`PATCH active:false` no Auvo (nunca DELETE físico); Produtos vira Ferramentas (schema `pcm`, usa
`employee-product-stock` do Auvo para saber quem está com qual ferramenta).

**Antes de implementar, revisão adversarial dos commits recentes de Codex** (`dfb1077`
"enriquece PCM com Auvo e inspeções", `42367ac` "integra PMOC aos sinais do Auvo", PR #29 aberto
"tolera busca indisponível de task Auvo") — achou **1 bug crítico real já em produção**:
`pcm-auvo-equipment-sync/index.ts` linha 114 declarava `let auvoCustomerId` sombreando a função de
mesmo nome usada na linha seguinte — `TypeError`, sync de equipamentos quebrado desde o merge de
`dfb1077` (~2 dias). **Corrigido e commitado isoladamente** na branch `fix/E01-S11-equipment-sync-
shadowing` (renomeada a variável local para `resolvedCustomerId`), **aguardando push/PR** (ver
Bloqueios). Achados não-bloqueantes registrados para acompanhar depois: PR #29 (400-tolerance na
busca de task) pode mascarar um `paramFilter` sistematicamente errado e permitir tasks duplicadas
no Auvo se o formato do filtro nunca tiver sido validado contra produção — não é um bug óbvio, é um
risco a monitorar; migration `0023` (PMOC) não tem policy de `DELETE` em nenhuma das 7 tabelas
novas (default-deny, não é falha de segurança, só inconsistência com o padrão do projeto); e
`E01-S03` (PMOC) foi implementada com `design.md` mas **sem `spec.md`/`tasks.md`** — mesma classe de
gap de processo já registrada como aprendizado em `.claude/memory/feedback-processo-stories.md`,
sinalizada no ROADMAP (linha `E01-S03b`) para reconciliar depois.

**E01-S22 (motor de sync Auvo, write path) implementada localmente** na branch
`feat/E01-S22-motor-sync-auvo-write` (a partir de `origin/main`, isolada do hotfix acima). Fundação
da épica: `docs/adr/0005-outbox-sync-auvo.md`, `specs/E01-S22-motor-sync-auvo-write/*` (product/
design/domain/spec/tasks), migrations `0024` (`pcm.auvo_sync_outbox`, `fn_auvo_enqueue`,
`fn_apply_auvo_sync`, `fn_claim_auvo_outbox_batch`) e `0025` (`pg_cron` de 1 min, reusa secrets do
Vault de `0011`/`0013`), `auvoPatch`/`auvoDelete` em `_shared/auvo/client.ts`, scaffold do entity
registry (`_shared/auvo/registry/`, vazio até `E01-S24`), Edge Function `pcm-auvo-push` (drain com
idempotência por `externalId`, nunca trava o lote por 1 linha com falha) e pgTAP
`auvo_sync_outbox_rls.test.sql`. **2 refinamentos de design feitos durante a implementação, spec
atualizada ANTES de codar (não SPEC_DEVIATION silencioso)**: (1) o "sentinela `updated_by`" do
design original foi trocado por um GUC transacional (`app.auvo_sync_write`) + RPC
`fn_apply_auvo_sync`, porque `updated_by` tem `references auth.users` e um sentinela exigiria linha
falsa na tabela do Supabase Auth; (2) adicionado o estado `'processing'` + RPC
`fn_claim_auvo_outbox_batch` para a reivindicação atômica de lote (`FOR UPDATE SKIP LOCKED` não é
exposto pelo PostgREST a um `SELECT` solto do cliente). Gates Node rodados e verdes nesta sessão:
`lint:migrations` (27 migrations), `lint`, `typecheck`, `test` (126 pass/9 skip), `build`,
`audit:esteira` (148 docs), `eval:spec`, `arch:check`. **Gap conhecido, mesma ressalva de toda a
integração Auvo desde E01-S09:** sem Deno CLI/Docker neste ambiente, os 3 `*.test.ts` Deno novos
(`client.test.ts`, `registry/index.test.ts`, `pcm-auvo-push/index.test.ts`) e o pgTAP novo não foram
executados — confirmar no CI `db-tests` antes do merge.

**Bloqueio novo: hook `enforce-git-push-authority.sh` bloqueia TODO `git push` nesta sessão**,
incondicionalmente (não checa qual "agente" está ativo — isso é só texto de persona do
`TRIVIAIOX/agents/devops.md`, sem efeito real no hook). Duas branches commitadas localmente
aguardando push humano: `fix/E01-S11-equipment-sync-shadowing` (1 commit) e
`feat/E01-S22-motor-sync-auvo-write` (2 commits). Ver Bloqueios.

**Próximo passo:** push das 2 branches acima + abrir PRs (fora do alcance desta sessão); depois,
seguir a épica com `E01-S23` (read path — dispatcher de webhook genérico + `pcm-auvo-pull` +
auto-registro de webhook), mesmo `design.md` de `E01-S22`.

---

**Última atualização anterior:** 2026-07-04 — **Revisão @qa (Claude) do handoff Codex → Claude concluída.**
Gates locais rerodados e verdes (`lint:migrations` 20 migrations, `lint`, `typecheck`, `test`
114/9skip, `build`, `audit:esteira` 142 docs, `eval:spec`). Migrations `0016`-`0020` e Edge
Functions (`pcm-auvo-webhook`, `pcm-whatsapp-webhook`, `pcm-ze-agent`, `pcm-auvo-customers-import`)
revisadas linha a linha — RLS/grants/HMAC corretos, sem achado bloqueante nelas. **1 bug crítico
real corrigido:** `supabase-qualidade-adapter.ts` gravava `ordem: Date.now()` (ms) numa coluna
`int` (int4) — estourava `integer out of range` em todo insert de item de inspeção; trocado para
segundos desde epoch. Decisão do Lucas: publicar as 7 stories (E01-S02 parcial/S15/S16/S18/S19/
S20/S21, já commitadas em cima de E01-S13) num PR único, mesmo padrão do PR #9; merge final fica
para aprovação humana no GitHub (não automático). Próximo passo: commit, push da branch, abrir PR.
Ressalvas que seguem no PR: numeração sequencial via `count()` tem race condition sob concorrência
real (débito conhecido); fluxo Zé (E01-S02) não foi validado contra Evolution/OpenRouter reais —
não configurar os secrets em produção antes de testar end-to-end.

**Última atualização anterior:** 2026-07-04 — **E01-S21 implementada localmente** (Dashboard PCM
sem mocks internos, usando OS/inspeções reais), após E01-S15/S16/S18/S19/S20 e Fluxo A parcial do
Zé. Ainda sem push/PR; `@devops` deve ser acionado só no fim.

**Sessão Codex 2026-07-04 — E01-S13 aberta e implementada.** Import inicial de clientes Auvo →
PCM, branch `feat/E01-S13-import-inicial-clientes-auvo`. Usuário testou a Visão 360 (E01-S12, já em
produção) e viu PCM/Clientes vazio — investigado: não é bug, `docs/blueprint/integracoes/auvo.md`
já definia "Clientes: dono PCM, fluxo PCM→Auvo" (E01-S09 só empurra, nunca importa) e não existe
CRUD de cliente no PCM ainda. Usuário decidiu: import inicial em massa Auvo→PCM (não quis CRUD
agora). Implementado sem os subagentes `triviaiox-*` (ficaram intermitentemente indisponíveis nesta
sessão — usuário confirmou que é por rodar o Codex em paralelo na mesma pasta, disputando os arquivos
não-versionados de `.claude/agents/`; resolvido continuando o processo diretamente, mesmo rigor):
migration `0014` (GRANT `service_role` em `pcm.clientes` — faltava desde sempre, mesma classe de bug
já corrigida 2x neste projeto) + `0015` (pg_cron diário, reusa secrets de `0011`/`0013`); Edge
Function `pcm-auvo-customers-import` (paginação + upsert por `auvo_id` + soft-delete guardado,
mesmo padrão de `E01-S11`). Gates Node verdes. **Gap real sinalizado**: nenhum teste Deno dedicado
escrito para a function (diferente de `E01-S11`, que testou `paginate.ts`) — sem lógica nova além de
orquestrar helpers já testados, mas vale revisão antes do merge. Ainda sem push/PR.

**Sessão Codex 2026-07-04 — Frente 1 priorizada pelo Lucas.** `E01-S15` e `E01-S16`
implementadas localmente seguindo SDD (spec/tasks antes de código; owner Codex no ROADMAP).
`E01-S15`: adicionada migration `0016_E01-S15_auvo_task_snapshots.sql` com
`pcm.auvo_task_snapshots` para snapshot rico do webhook Auvo (payload bruto + relato/anexos/
checklist/peças/horas/timeline), e `pcm-auvo-webhook` passou a fazer upsert idempotente depois de
validar HMAC e resolver a OS. **Sem Supabase Storage**: anexos/fotos ficam como JSON/URL/referência
do Auvo, conforme orientação do Lucas. `E01-S16`: adicionada migration
`0017_E01-S16_os_equipamentos_auvo.sql` com `pcm.os_equipamentos_auvo` (relacionamento OS ↔
`auvo_equipment_id`, sem duplicar identificador/categoria/garantia), webhook faz upsert quando o
payload traz equipamento, e a Visão 360 foi corrigida para filtrar `equipamentos_cache` pela coluna
real `auvo_customer_id` de E01-S11. `E01-S17`: investigada e **bloqueada/não implementada** — há
evidência pública de módulos Auvo de Financeiro/Central/Tickets/Orçamentos, mas não endpoint API v2
confirmado para leitura por cliente; sem contrato confirmado, não foi criado painel/schema/adapter.
Gates verdes: `lint:migrations` (17 migrations + Squawk), `lint`, `typecheck`, `test` (93 pass/9
skip), `build` (warning conhecido de chunk >500k), `audit:esteira`, `eval:spec` (com ressalva
conhecida: não avalia pastas `E01-*`). Não verificado: Deno/Edge Functions e payload real do Auvo.

**Sessão Codex 2026-07-04 — Frente 2 iniciada.** `E01-S02` (Fluxo A) implementada localmente de
forma parcial: domínio de detecção determinística de menção (`apps/web/src/features/atendimento/`)
com 5 testes, `OrdemServicoInput` em `packages/shared`, migration
`0018_E01-S02_ze_fluxo_a_operacional.sql` (grants para `service_role`, cron fallback minutely com
secrets Vault `ze_agent_project_url`/`ze_agent_service_role_key`) e Edge Functions
`pcm-whatsapp-webhook`/`pcm-ze-agent`. O agent cria OS direta com `origem='ze'`,
`status='solicitacao'`, responde via Evolution e pergunta dado faltante quando o OpenRouter retorna
`pronto=false`. Gates verdes após correções: `lint:migrations` (18 migrations + Squawk), `lint`,
`typecheck`, `test` (98 pass/9 skip), `build`. **Ressalvas/SPEC_DEVIATION em tasks.md:** Edge
Functions Deno e integração real Evolution/OpenRouter/Supabase local não executadas; `ze_active`
não existe no schema (usa `modo`/ausência de config como SKIP); geração `CH-XXX` por contagem é MVP
e deve virar sequence/RPC se houver colisão concorrente. `E01-S14`: criado apenas
`specs/E01-S14-fluxo-b-orcamento/design.md` e **parado antes de código**, com recomendação
arquitetural de entidade pré-OS + orçamento; bloqueado pelas duas perguntas de negócio do Lucas.

**Sessão Codex 2026-07-04 — E01-S18 abertura manual de OS.** A partir das telas do PCM antigo
enviadas pelo Lucas, criada story pequena `E01-S18` com spec/tasks e implementação local: botão
"Nova OS" no dashboard PCM (visível só para `podeAcessar('pcm','escrita')`), modal de abertura
manual com cliente, solicitante, título, descrição, categoria, origem, prioridade, fatores GUT,
tipo Auvo sugerido, técnico, localização e data prevista. Inteligência adicionada: categoria sugere
tipo Auvo; GUT calcula score e sugere prioridade, permitindo sobrescrita. Adapter cria
`pcm.ordens_servico` em `status='solicitacao'`. Sem migration nova; `tipoAuvo`/técnico/data prevista
ficam na `descricao` até existir schema próprio do Hub de OS/despacho. Gates verdes: `lint`,
`typecheck`, `test` (103 pass/9 skip), `build` (warning conhecido de chunk >500k).

**Sessão Codex 2026-07-04 — E01-S19 Inspeções + Laudos SPDA.** A pedido do Lucas, implementado o
transplante funcional das telas do PCM antigo (`pcm-sinergica-v2/src`) para o SO: criada story
arquitetural com `spec.md`/`design.md`/`tasks.md`; migration
`0019_E01-S19_inspecoes_laudos_spda.sql` com `pcm.inspecoes`, `pcm.inspecao_itens`,
`pcm.laudos_spda`, `pcm.laudo_spda_pontos`, RLS por `user_modulos.pcm`, grants e trigger de totais
de inspeção; domínio/application/adapter em `features/pcm`; abas navegáveis `Inspeções` e
`Laudo SPDA` na Home. Decisão desta entrega: **sem Storage** — fotos ficam como `foto_url`/link Auvo
ou referência externa em tempo de consulta. Gates verdes: `lint:migrations`, `lint`, `typecheck`,
`test` (108 pass/9 skip), `build` (warning conhecido de chunk >500k), `audit:esteira`, `eval:spec`.
Revisão adversarial @qa registrada em `tasks.md`; gap residual: número do laudo por contagem deve
virar sequence/RPC se houver criação concorrente real. Falta validação manual em browser/DB real.

**Sessão Codex 2026-07-04 — E01-S20 OS + Backlog GUT operacionais.** Continuação do desenvolvimento
do PCM como ferramenta primária: criada story pequena `E01-S20` com spec/tasks antes de código.
Implementado com migration `0020_E01-S20_os_backlog_operacional.sql`, que cria
`pcm.os_status_eventos` e trigger append-only para criação/mudança de status em
`pcm.ordens_servico`. Também adicionados domínio `ordens-servico`, application/gateway/adapter
Supabase, páginas `Ordens de Serviço` e `Backlog GUT`, navegação real na sidebar e ação de planejar
OS (`status='planejamento'`). A tela de OS mostra KPIs, filtros, detalhe, erro de sync Auvo quando
existir e permite alterar status com gate de escrita; a tela de Backlog ordena OS abertas por
`score_pcm desc` e mostra G/U/T. Reaproveita o trigger Auvo de `0011` quando a OS entra em
planejamento. Gates verdes: `lint:migrations`, `lint`, `typecheck`, `test` (113 pass/9 skip),
`build` (warning conhecido de chunk >500k), `audit:esteira`. Gap residual: regras finas de
transição/kanban completo permanecem para E01-S07. Falta validação manual em browser/DB real.

**Sessão Codex 2026-07-04 — E01-S21 Dashboard PCM real.** A pedido do Lucas, revisado o dashboard
para identificar informação mockada. Removidos os arrays mockados internos do dashboard PCM
(`KPIS`, `OS_RECENTES`, `BACKLOG_TOP`) e criada `PcmDashboardPage` com domínio `dashboard-pcm`.
Agora os KPIs, OS recentes e Top Backlog GUT vêm de `pcm.ordens_servico` e `pcm.inspecoes` via
`supabaseHubOsAdapter`/`supabaseQualidadeAdapter`. Métricas sem fonte real no schema atual (SLA real,
técnicos em campo, tempo médio com data de conclusão contratual) foram substituídas por métricas do
alvo já disponível: OS com Auvo, falhas Auvo, preventivas abertas e inspeções no mês. Os cards do
dashboard geral de módulos ainda não construídos continuam placeholders. Gates verdes: `lint`,
`typecheck`, `test` (114 pass/9 skip), `build` (warning conhecido de chunk >500k). Falta validação
manual em browser/DB real.

## Plano — PCM como ferramenta primária do escritório + funil de chamado (2026-07-04)

Usuário mandou 5 telas do Auvo (cliente, tarefa, lista de clientes, calendário, equipamentos) e
pediu um plano de execução (vai rodar via Codex, não nesta sessão) para duas frentes. Registrando
aqui em detalhe porque as duas envolvem tier arquitetural e não devem ser codadas sem `@architect`.

### Frente 1 — Espelhamento rico do Auvo (aprofundar o que já existe)
Hoje o PCM só reflete o mínimo: cliente (nome/cnpj/auvo_id/ativo — E01-S09/E01-S13), técnicos/
equipamentos (cache raso, nome/equipe — E01-S11), OS (só status — E01-S10, sem o payload rico de
conclusão). As telas do Auvo mostram muito mais já disponível na API:
- **Tarefa**: Relato do usuário, Anexos, Questionários (checklist), Pendências, Controle de horas,
  Envios, Valores, timeline (Recebida/Visualizada/Check-in/Check-out).
- **Equipamento**: Identificador, Associação (cliente), Categoria, Garantia até, Status.
- **Cliente** (no Auvo): stats agregadas de tarefas (total, tempo médio, atraso médio, satisfação),
  abas de Financeiro/Tickets/Orçamentos.

Candidatas (`E01-S15`/`E01-S16`/`E01-S17` no ROADMAP, todas **Planejado**, sem owner):
- **E01-S15** — Enriquecer webhook de OS (estende E01-S10): capturar o payload completo na
  conclusão (fotos/anexos, checklist preenchido, peças consumidas, controle de horas, timeline).
  Avaliar tier na hora: se envolver Storage de anexos/fotos, sobe de Pequeno pra Arquitetural
  (bucket, políticas de acesso, ADR).
- **E01-S16** — **Decisão do usuário (2026-07-04): Auvo continua dono dos dados de equipamento —
  NÃO duplicar no PCM.** Regra geral dada pelo Lucas: "o que for sobre o Auvo precisa ficar no
  Auvo, isso evita dados duplicados; só fica no PCM aquilo que não tem no Auvo — no PCM é feito o
  relacionamento entre o Auvo e outras informações do PCM." Ou seja: **NÃO** adicionar
  `identificador`/`categoria`/`garantia_até` ao `pcm.equipamentos_cache` (isso replicaria atributo
  que já é do Auvo). O cache continua mínimo (só o suficiente pra exibir nome/vínculo sem chamar o
  Auvo a cada render, como já é hoje em E01-S11). Se a UI precisar mostrar
  identificador/categoria/garantia, é **leitura sob demanda direto do Auvo** (chamada de API), não
  um campo espelhado. O que o PCM efetivamente armazena sobre um equipamento é só o que **não
  existe no Auvo** e o **relacionamento** (ex.: qual OS/PMOC está vinculado a qual `auvo_equipment_id`
  — isso sim é dado do domínio PCM, não duplicação). Esta decisão MUDA a proposta original do
  ROADMAP para `E01-S16` — reescrever a linha/descrição antes de abrir a story pra não sugerir
  duplicação de dado.
- **E01-S17** — Painel financeiro/tickets/orçamentos do cliente na Visão 360 (já previsto como
  "fase 2" em `E01-S12` §4) — depende de mapear se existe endpoint Auvo equivalente pra esses dados
  (não confirmado nesta sessão).

### Frente 2 — Funil de chamado → (orçamento) → OS
Usuário descreveu 2 fluxos:
- **Fluxo A** (direto): chamado (Área do Cliente/WhatsApp, tratamento humano hoje, IA no futuro) →
  **gera OS diretamente** → OS contém tarefas. **Isso já é EXATAMENTE `E01-S02`** (Abertura de
  chamado via Agente Zé, `specs/0002-abertura-chamado-ze/spec.md`) — spec já aprovada, tier
  arquitetural, **nunca implementada** (status "Spec aprovada", sem owner desde sempre). AC-1 já
  diz literalmente: OS criada com `status='solicitacao'`, `origem='ze'`. Não precisa reescrever a
  spec, só implementar.
- **Fluxo B** (com orçamento): chamado → tratamento humano/IA → **requisição de serviço** → gera
  **orçamento** → aceite do cliente → **então** vira OS → OS contém tarefas. **Isso é conceito
  NOVO, não existe em nenhum schema hoje** — confirmei: `comercial` (schema já existe desde
  `0001_E00-S00`) só tem `comercial.leads`; não há tabela de orçamento/proposta em lugar nenhum.
  Registrado como **E01-S14**, tier arquitetural — **precisa de `design.md` do `@architect` antes
  de qualquer código**, porque a modelagem tem pelo menos 2 caminhos plausíveis e são decisões
  irreversíveis de schema:

  **Escopo esclarecido pelo usuário (2026-07-04) — responde a pergunta 1 abaixo**: o Fluxo B
  **NÃO é para lead** (`comercial.leads`, prospect novo). É para um **cliente já existente**
  (`pcm.clientes`, já tem contrato ativo) pedindo **algo extra-contratual** — fora do que o
  contrato de manutenção já cobre. É esse caráter "extra-contratual" que decide se o chamado cai
  no Fluxo B em vez do Fluxo A (não é por categoria/valor estimado — é por estar ou não coberto
  pelo contrato vigente do cliente). O fluxo de `comercial.leads` (prospect novo) **também** vai
  precisar gerar orçamento no futuro, mas isso é uma story **separada**, do épico Comercial (E03),
  fora do escopo de `E01-S14` — não misturar os dois.
  1. Novos estados dentro de `pcm.ordens_servico.status` (ex.: inserir
     `aguardando_orcamento`/`orcamento_enviado`/`aguardando_aceite` entre `solicitacao` e
     `planejamento`) — mais simples, mas OS "existe" antes de ter valor aprovado (pode confundir
     backlog GUT/Visão 360 com OS que ainda nem foram aceitas).
  2. Entidade nova (`comercial.orcamentos` ou `pcm.requisicoes_servico` + `comercial.orcamentos`)
     que só vira uma linha em `pcm.ordens_servico` DEPOIS do aceite — mais fiel ao fluxo real
     descrito pelo usuário, mas mais schema novo.

  **Perguntas de negócio ainda em aberto** (o @architect deve levantar formalmente com o
  Lucas/Fabrício, não decidir sozinho):
  1. ~~Quem decide se um chamado vai pelo Fluxo A ou B~~ — **RESPONDIDA acima**: é por ser
     extra-contratual ou não, não por categoria/valor estimado.
  2. Orçamento recusado pelo cliente — o quê acontece com o chamado? Arquiva? Cliente pode pedir
     revisão/segunda proposta?
  3. Onde a Área do Cliente (E09, ainda não construída) entra nesse funil — o MVP usa só
     WhatsApp/atendimento humano primeiro, e a Área do Cliente vem depois?

### Sequenciamento sugerido — REPRIORIZADO pelo usuário em 2026-07-04
Decisão do Lucas: **Frente 1 primeiro** (`E01-S15`/`E01-S16`/`E01-S17`) — entrega valor visível pro
Fabrício rapidamente (ele já acessa o SO e vê coisa útil de verdade), sem esperar a arquitetura do
funil de chamado (Frente 2) ficar pronta. Ordem:
1. **`E01-S15`** (webhook de OS rico — relato, anexos/fotos, checklist, peças, controle de horas,
   timeline recebida/visualizada/check-in/check-out). Avaliar tier na hora: se envolver Storage de
   anexos, sobe de Pequeno pra Arquitetural.
2. **`E01-S16`** (relacionamento equipamento Auvo↔PCM — decisão já tomada, ver acima: Auvo continua
   dono, PCM não duplica identificador/categoria/garantia, só guarda o relacionamento).
3. **`E01-S17`** (painel financeiro/tickets/orçamentos do cliente na Visão 360, fase 2 de E01-S12).
4. **Frente 2** (`E01-S02` Fluxo A, depois `E01-S14` Fluxo B com `design.md` antes de codar) segue
   em paralelo ou depois — continua sendo o maior valor de negócio de médio prazo (gera as OS de
   verdade), mas não é mais o que entra primeiro nesta leva.

**Sessão anterior — Reconciliação final pós-merge.** **E01-S11 (PR #12)**, **E01-S12 (PR #14)**,
**fix(E00-S05) loading/erro de sessão (PR #15)** e o chore **`audit-esteira` (PR #13)**
estão todos **mergeados em `main`**. Ordem real do merge: #13 → #12 → #14 → #15 → #16 (docs) — os
PRs #12/#14 exigiram resolver conflito de docs (`STATE.md`/`ROADMAP.md`) contra a `main` avançada
pelo anterior; sem conflito de código. Ver blocos abaixo, um por story, para o histórico detalhado
de cada revisão `@qa`.

**E01-S12 — Task 18 (lista mínima de clientes)
implementada; OPEN-QUESTION #3 RESOLVIDA pelo PO**). Decisão de produto do Lucas: entregar a lista
mínima de clientes no MESMO PR (não esperar o Hub de OS/E01-S07). Implementado (escopo enxuto, sem
`react-router`): `listarClientes()` + read-model `ClienteResumo` adicionados ao gateway/adapter
existentes (`cliente-360-gateway.ts` / `supabase-cliente-360-adapter.ts` — `select id,nome,cnpj,ativo`
de `pcm.clientes`, `order('nome')` no servidor, MESMA RLS de `buscarCliente`, sem permissão nova);
caso de uso `listar-clientes.ts` (+3 testes, passthrough estilo `listarGrupos`); `ListaClientesPage.tsx`
(gate AC-1 `podeAcessar('pcm','leitura')`, estados carregando/erro/vazio, cada linha clicável →
`onSelecionar(id)`, read-only); wiring em `HomePage.tsx` com `useState` local (`pcmView` +
`clienteSelecionado`, item "Clientes" no `PCM_NAV`/grupo CADASTROS, botão "Voltar" = re-navegação na
HomePage, `VisaoClientePage` intacta → AC-7 preservado). Gates verdes rodados nesta sessão: lint (91
arquivos), typecheck (4 pacotes), test **93 pass/9 skip** (+3 `listar-clientes`), build (vite 1877
módulos), `audit-esteira` (124 docs), `eval-spec-fidelity` (exit 0). Pendente: validação humana em
browser + push (@devops). Nome de coluna de `equipamentos_cache` reconciliado depois em E01-S16
(`auvo_customer_id`).
Commit local `feat(E01-S12): lista mínima de clientes para navegação até a Visão 360 (Task 18)`.

**Contexto anterior (revisão @qa aplicada):** E01-S12 Visão 360 v1 na branch
`feat/E01-S12-visao-360-cliente`, worktree isolado, **ainda não mergeada** — aguarda review final +
@devops. **@qa deu CONCERNS; achado C1 (média) corrigido:**
`obter-visao-cliente` agora isola a falha do painel de equipamentos (qualquer erro, não só o
PGRST205 já tratado no adapter) num helper `carregarEquipamentos` com try/catch → "indisponivel",
para que um erro inesperado (ex.: E01-S11 mergear com coluna diferente → 42703/PGRST204) degrade só
o próprio painel e NÃO derrube cabeçalho/backlog/histórico junto (AC-6 real); +2 testes
(erro inesperado isola; erro em backlog/conteúdo central continua propagando). test agora 90 pass.
Feature hexagonal nova em `apps/web/src/features/pcm/` (domain `cliente-360.ts` +
application `obter-visao-cliente` + infrastructure `supabase-cliente-360-adapter` + 5 componentes +
`VisaoClientePage`, recebe `clienteId` por prop). AC-1 a AC-8 cobertas; **0 SPEC_DEVIATION**. Gates
locais **verdes**: lint, typecheck, test (90 pass/9 skip), build, `audit:esteira`, `eval:spec`.
Pendências reportadas: **(1) AC-6 caminho real** (retorno `"indisponivel"`/PGRST205 do PostgREST)
**NÃO executado localmente** (sem Docker) — fica no CI `db-tests`; **(2) Task 18 (navegação até a
Visão 360) — RESOLVIDA nesta sessão** (ver bloco "Última atualização" no topo): lista mínima de
clientes implementada no mesmo PR por decisão do PO; **(3) assunção de acoplamento** do nome da
coluna de vínculo em `pcm.equipamentos_cache`, reconciliada depois em E01-S16 para
`auvo_customer_id`. Contexto anterior: PR #9/#10/#11 (E00-S09/S10,
E01-S09/S10) mergeados em `main`; E01-S11 e E01-S02 seguem "Planejado", sem owner)

**QA gate (@qa Quinn, 2026-07-03): CONCERNS** (passa com reservas documentadas — não bloqueia).
Revisão adversarial linha a linha do diff `a3a9e0b`; gates reexecutados neste worktree (lint,
typecheck, test 88 pass/9 skip, build, `audit:esteira` 124 OK — **todos verdes**). AC-1 a AC-8 OK
nos caminhos existentes; **read-only confirmado** (grep: zero `insert/update/delete/upsert/rpc`; o
único botão é "Tentar novamente" = re-leitura). AC-1 é gate real (o `useEffect` só chama `carregar()`
com `temAcesso`, não busca dados sem permissão) + RLS de banco. O fallback perigoso do E01-S09
(mascarar erro real como estado "ok") **NÃO se repete**: o adapter só devolve `"indisponivel"` em
`PGRST205`/`42P01` e **relança** qualquer outro erro. Reservas p/ @dev/PO: **(C1, MÉDIA)** erro
inesperado da query de equipamentos (ex.: coluna divergente quando E01-S11 mergear) é relançado
dentro do `Promise.all` → rejeita o caso de uso → **página inteira cai no estado de erro**,
contrariando a intenção de AC-6 de que o cache ausente não bloqueia o resto; falha alto (bom), mas
mais amplo que o ideal — recomendação: isolar a falha do painel de equipamentos (não deixar derrubar
cabeçalho/backlog/histórico) e reconciliar a coluna de vínculo quando E01-S11 fechar (feito depois
em E01-S16: `auvo_customer_id`).
**(C2, BAIXA-MÉDIA)** retorno real PGRST205 não verificado empiricamente (sem Docker) — validar no CI
`db-tests` antes do merge. **(C3, produto)** navegação até a tela adiada (Task 18/OPEN-QUESTION #3) —
feature não exercitável por humano até o PO decidir a lista/entrada. Não conserto bugs — reportado ao
@dev/PO)

**Resolução @dev (2026-07-03, commit de fix após `a3a9e0b`):** **C1 CORRIGIDO** — `obter-visao-cliente`
isola a query de equipamentos num helper `carregarEquipamentos` com `try/catch` → `"indisponivel"`,
para que QUALQUER erro (não só `PGRST205`/`42P01`) degrade só o painel e não derrube
cabeçalho/backlog/histórico (AC-6). Backlog/histórico (conteúdo central) **continuam propagando** erro
de propósito. +2 testes (`obter-visao-cliente.test.ts`: erro inesperado isola; erro em backlog
propaga). test agora **90 pass/9 skip**. **C2** (PGRST205 empírico) e **C3** (navegação/OPEN-QUESTION
#3) permanecem abertos por design — C2 fica no CI `db-tests`, C3 é decisão de produto do PO.

**E01-S11 — @dev (Dex) — blocker do @qa CORRIGIDO.** O único blocker
da revisão @qa (pgTAP `tecnicos_equipamentos_cache_rls.test.sql` falharia no `db-tests` da CI: os
4 blocos UPDATE/DELETE de `authenticated` esperavam filtro silencioso, mas sem `GRANT UPDATE/DELETE`
o Postgres nega no nível de ACL — `42501` — e aborta a transação) foi resolvido: os 4 blocos agora
usam `throws_ok(..., '42501', ...)`, mesmo padrão dos INSERT. `lint:migrations` segue verde. Falta
só a CI (`db-tests`, precisa de Docker) confirmar o pgTAP verde — não roda neste ambiente. A
OPEN-QUESTION ao lead (pular soft-delete quando o Auvo devolve 0 registros) segue aberta, não
bloqueante. Revisão @qa abaixo preservada.

**Revisão anterior (@qa Quinn):** revisão adversarial de `E01-S11`.
**Veredito: CONCERNS — NÃO liberar para @devops/merge ainda.** O código-fonte (migrations
`0012`/`0013`, Edge Functions, `paginate.ts`) e o schema implementam AC-1..AC-5 corretamente;
revisei o diff `c9a6bcf` linha a linha e rerodei os gates Node (lint:migrations, typecheck, test,
build) — todos verdes; `audit:esteira` vermelho é 100% pré-existente/fora de escopo (só
`.claude/agents/*.md` + `.claude/agent-memory/*` não rastreados, nada da story). Concern #2
(vínculo de equipamento a cliente errado) **não** se confirmou: a resolução de `auvo_customer_id`
é match exato em lote contra `pcm.clientes.auvo_id`, ou `null` — nunca "primeiro resultado às
cegas". Guarda de soft-delete (AC-4) correta por construção (`auvoPaginate` propaga erro → `catch`
antes de qualquer escrita). Secrets de `0013` reusam exatamente `auvo_trigger_project_url`/
`auvo_trigger_service_role_key` de `0011`. **1 blocker real:** o pgTAP
`tecnicos_equipamentos_cache_rls.test.sql` vai falhar no job `db-tests` da CI — as tabelas de
cache dão a `authenticated` só `GRANT SELECT`, então `UPDATE`/`DELETE` fora de `throws_ok`
(linhas 51/57/65/70) levantam `42501 permission denied` e abortam a transação, em vez de
"filtrar 0 linhas" como o teste assume (modelo copiado de `pcm.clientes`, que tem grant de
update). AC-3 continua satisfeito (authenticated realmente não escreve — até mais estrito), mas
o teste, como está, não passa. → **@dev**: envolver os UPDATE/DELETE em `throws_ok(..., '42501')`
e confirmar `db-tests` verde. **1 OPEN-QUESTION ao lead** (já sinalizada por @dev): pular
reconciliação de soft-delete quando o Auvo devolve 0 registros — fronteira produto/implementação.
Não verificado aqui (sem Deno/Docker): type-check Deno, testes de integração, execução real do
pgTAP. Detalhe abaixo (bloco @dev preservado).

**Atualização anterior (@dev, Dex):** **E01-S11 (sync técnicos/equipes/equipamentos
Auvo → PCM) implementada** na branch `feat/E01-S11-integracao-auvo-sync-tecnicos-equipamentos`,
commit local (sem push — push bloqueado nesta sessão, @devops abre o PR depois). Entregue: migrations
`0012` (cache `pcm.tecnicos_cache`/`pcm.equipamentos_cache`, RLS FORCE, `grant usage on schema pcm to
service_role` que faltava) e `0013` (pg_cron diário 06:00 UTC reusando secrets do Vault de `0011`);
Edge Functions `pcm-auvo-users-sync`/`pcm-auvo-equipment-sync`; `_shared/auvo/paginate.ts` (+ teste
Deno); pgTAP RLS (AC-3). **Gates Node verdes** (lint:migrations, lint, typecheck, test, build).
`audit:esteira` vermelho por causa pré-existente e fora de escopo (14 `.claude/agents/*.md` sem
`alwaysApply`). Ressalvas reais: sem Deno CLI aqui → Edge Functions/`paginate.ts` não type-checked
nem testadas (biome/turbo ignoram `supabase/functions/**`); sem Supabase local/Docker → pgTAP não
rodado; `eval:spec` não cobre pastas `E01-S11` (rastreabilidade conferida à mão). Pendências
operacionais: habilitar extensão `pg_cron` no Dashboard (task 8), validar `cron.job`/chamada sob
demanda pós-deploy. Nenhum SPEC_DEVIATION; 1 [AUTO-DECISION] a confirmar com o lead (pular
reconciliação de soft-delete quando o Auvo devolve 0 registros — para não desativar o cache em massa).
Anteriormente: PR #9/#10/#11 mergeados; `E01-S10` AC-7 deferido (PMOC não construído). E01-S02 segue
"Spec aprovada", sem owner.

## Status geral
**Fase:** Casca concluída (E00-S04) + E00-S05 (Auth/RBAC) + E00-S06 (sync Padrão OS) + E00-S07
(hardening v3.4.0) + E00-S08 (rename de papéis) **mergeadas em `main` e aplicadas em produção**
(PRs #4/#5/#6/#7/#8). E00-S09 (grupos/permissões por módulo, fundação) implementada na branch
`feat/E00-S09-grupos-permissao-modulo` — parte foi rascunhada por outro agente (Codex) na mesma
branch antes desta sessão retomar; revisei tudo linha a linha (não confiar às cegas) e achei um
bug de segurança real (ver Decisões). Repo `Sinergica-Manutencoes-Patrimoniais/Sinergica-SO`.
Supabase **reprovisionado** (`nudannsrfvjggoergvyn`) — schemas, migrations, GRANTs, Custom Access
Token Hook e Data API expostos, confirmados via query direta/Management API.
**Gates locais rodados nesta sessão:** `lint:migrations` ✅ (9 migrations, Squawk limpo) ·
`audit:esteira` ✅ · `lint` (Biome) ✅ · `typecheck` ✅. **Não rodado:** `supabase test db`
(pgTAP) — Docker indisponível localmente nesta sessão; job `db-tests` do CI é o gate real,
**checar antes do merge**.

E00-S10 (UI administrativa — grupos, usuários, gating de sidebar) implementada em
`apps/web/src/features/config/` (domain/application/infrastructure/pages/components, seguindo o
mesmo padrão hexagonal de `features/auth/`), `apps/web/src/app/permissoes-context.tsx`
(`PermissoesProvider`/`usePermissoes`) e alterações em `HomePage.tsx`/`App.tsx`. **Gates rodados
e verdes nesta sessão:** `pnpm run lint`, `pnpm run typecheck`, `pnpm test` (75 passed, 5
skipped), `pnpm run build`, `pnpm run arch:check`, `node scripts/audit-esteira.mjs`. **Não
verificado:** teste manual em browser (login real por papel, criar/editar grupo e usuário,
confirmar sidebar filtrada) — sem ambiente Supabase logável nesta sessão; e o teste de integração
do novo adapter (`supabase-config-adapter.integration.test.ts`, escrito mas self-skip sem
`SUPABASE_LOCAL`/Docker). Ambos ficam como validação humana/@qa pendente antes do merge. Detalhes
de escopo (o que ficou de fora e por quê) em
`specs/E00-S10-grupos-permissao-ui/tasks.md` → "Decisões de escopo". O gap de GRANT/DELETE em
`config.grupos`/`grupo_modulos` achado durante esta implementação já está corrigido (migration
`0010`, ver "Entrega em volume" abaixo).

**E01-S10** (webhook Auvo — status/conclusão de OS) implementada sobre a fundação `E01-S09` já
mergeada: `supabase/functions/_shared/auvo/verify-signature.ts` (validação HMAC-SHA256 do header
`X-Auvo-Signature`, com teste unitário de 12 casos) + `supabase/functions/pcm-auvo-webhook/
index.ts` (Edge Function chamada pelo Auvo — auth por assinatura, não `requireServiceRole`, já
que não é chamada interna). AC-1 a AC-6 implementados; AC-7 (registro PMOC na conclusão de
preventiva) **deferido** via SPEC_DEVIATION — `pcm.pmoc_records` não existe (PMOC ainda
"Planejado" no ROADMAP). Segunda SPEC_DEVIATION: o mapeamento de "task Cancelada" (AC-4) não tem
`taskStatus` documentado no mapeamento Auvo consultado — inferido como `action=3 (Exclusão)` da
task, a confirmar contra webhook real antes de produção. Nenhuma migration nova (o índice
`idx_os_auvo_task` de `0001_E00-S00` já cobre a busca por `auvo_task_id`, e `status` é coluna
`text` livre, sem `CHECK` a alterar). `.github/workflows/sync-secrets.yml` ganhou
`AUVO_WEBHOOK_SECRET` na lista (wiring de placeholder — valor real é provisionamento manual, fora
do alcance deste agente). **Não verificado, mesma ressalva de E01-S09:** sem Deno CLI neste
ambiente, nada foi type-checked/executado contra o Auvo real.

## Incidentes resolvidos nesta sessão
- **Login do superadmin "credenciais inválidas"**: investigado — a senha/usuário estão corretos
  (confirmado testando `POST /auth/v1/token?grant_type=password` direto na API, retornou token
  válido). A causa real é o deploy do Netlify estar quebrado (ver item abaixo) — o site em
  produção está servindo um build antigo/stale, possivelmente com env vars do Supabase antigo.
  **Ação do usuário**: depois que o Netlify voltar a buildar (fix já commitado), confirmar em
  Site settings → Environment variables que `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` apontam
  pro projeto atual (`nudannsrfvjggoergvyn`) — não consigo checar isso eu mesmo (Netlify CLI
  local não está autenticado).
- **Build do Netlify falhando** (`core.hooksPath is set locally to '.husky/_'`, Lefthook recusa
  instalar): `scripts/prepare-hooks.mjs` novo (pula `lefthook install` quando `CI`/`NETLIFY`/
  `GITHUB_ACTIONS` estão setados — hooks de git não servem pra nada em CI/build) +
  `package.json` `prepare` aponta pra ele. Revisado, correto e seguro (CI já roda os gates
  direto, nunca dependeu dos hooks instalados).
- **GitHub Actions `deploy.yml`/`sync-secrets.yml` falhando** ("Invalid access token format"):
  o secret `SUPABASE_ACCESS_TOKEN` no GitHub não estava no formato `sbp_...` esperado pelo
  Supabase CLI, mesmo o `.env.local` local estando correto — re-sincronizado via `gh secret set`
  para descartar corrupção do upload em lote de sessão anterior. `sync-secrets.yml` teve o
  gatilho automático (`push`) desligado por precaução até confirmar que o secret está certo —
  rodar manualmente (`workflow_dispatch`) antes de reativar o automático.

## Entrega em volume — 3 stories via agentes paralelos (2026-07-03)
Usuário pediu para não parar em E00-S09/E00-S10 — "veja o que tem planejado e pendente e use todo
o fluxo de desenvolvimento com os agentes triviaiox", visando um PR com volume grande de entrega.
Rodei 2 agentes `@dev` em paralelo, cada um num worktree git isolado (evita conflito de working
tree), depois revisei cada resultado como `@qa` (ler o diff inteiro, não só o relatório do
agente) antes de aceitar:

- **E00-S10** (UI de grupos/permissões), worktree em cima da branch de E00-S09 — telas de Grupos
  e Usuários, `PermissoesProvider` novo, sidebar/tab-bar/dashboard filtrados por permissão
  real (capacidade que não existia antes: hoje todo mundo via todos os 10 módulos). 75 testes
  verdes, lint/typecheck/build/arch:check verdes.
- **E01-S09** (fundação Auvo), worktree/branch nova baseada em `main` — cliente HTTP Auvo
  compartilhado, `pcm-auvo-customers-sync`/`pcm-auvo-create-task` (Edge Functions), trigger
  `pg_net` assíncrono em `pcm.ordens_servico`. Gates de código (lint:migrations/audit-esteira/
  eval-spec-fidelity) verdes; Edge Functions (Deno) não puderam ser type-checked nem executadas
  nesta sessão — sem Deno CLI disponível — e o formato exato de resposta da API Auvo (paramFilter,
  campos do envelope `result`) segue a descrição do design.md, não uma chamada real confirmada.

**2 bugs reais achados na revisão (nenhum dos dois pego pelos gates automáticos, só por leitura
cética do diff):**
1. `pcm-auvo-customers-sync`/`pcm-auvo-create-task`: fallback `?? search.result[0]` quando a
   busca por `externalId` não achava match — se o `paramFilter` do Auvo não filtrar como
   documentado (incerteza já sinalizada pelo próprio código), isso vincularia um cliente/task
   Auvo **errado** ao registro do PCM, silenciosamente. Corrigido: tratar "sem match" como
   "não encontrado", nunca pegar o primeiro resultado às cegas.
2. `config.grupos`/`config.grupo_modulos` (migration `0006`) nunca ganharam GRANT/policy de
   `DELETE` — só apareceu como bug real quando o agente de E00-S10 tentou consumir o backend
   (`editarGrupo()` precisa apagar+reinserir `grupo_modulos`; `criarGrupo()` faz rollback
   apagando o grupo se a gravação de permissões falhar). Corrigido em nova migration `0010`,
   rebaseada no topo de E00-S10 também.

**Mais 2 bugs achados só depois de abrir o PR #9 e o `db-tests` rodar de verdade no CI (Docker) —
nenhuma leitura estática, nem a revisão acima, pegou estes dois:**
3. `custom_access_token_hook`: `to_jsonb(v_papel)` quando `v_papel` é `NULL` em SQL (usuário sem
   perfil ativo/inativo) retorna `NULL` de SQL, não o literal JSON `null` (`to_jsonb()` é
   `STRICT`). `jsonb_set(..., NULL)` também é `STRICT` e retorna `NULL` — então **todo** o
   `v_claims` virava `NULL`, e a função inteira devolvia `event = NULL` em vez de um evento
   válido. Esse bug já existia desde a versão original do hook em `0002_E00-S05` (nunca pego
   porque nenhum teste chamava o hook de verdade para um usuário sem perfil/inativo) — ou seja,
   **já estava ao vivo em produção**. Corrigido com `coalesce(to_jsonb(v_papel), 'null'::jsonb)`.
4. Minha própria correção anterior (`current_user` → `session_user`, achado #1 acima) também
   estava errada: `session_user` não muda dentro de `SECURITY DEFINER` (certo), mas **também não
   muda com `SET LOCAL ROLE`** — e é assim que o PostgREST (e os testes pgTAP que simulam
   PostgREST) trocam de papel numa conexão já aberta. `session_user` continha sempre o role da
   conexão física (`postgres`), nunca `'authenticated'` — a guarda nunca disparava pra chamada de
   usuário comum. Achado pelo teste `"colaborador NAO resolve permissoes de outro usuario"`
   falhando de verdade no `db-tests`. Fix real: usar o claim padrão `role` do JWT
   (`auth.jwt() ->> 'role'`), não introspecção de role do Postgres — sempre presente num JWT real
   do PostgREST, ausente só quando não há contexto de request (chamada interna confiável).

**Nenhuma das 3 branches foi pusheada** — commits locais, aguardando decisão do usuário.

## Em andamento / próximo passo
- **Branch atual:** `feat/E00-S09-grupos-permissao-modulo` — usuário pediu um sistema de grupos
  de permissão por módulo (`superadmin`/`supervisor` criam grupos com leitura/escrita por
  módulo, atribuem usuário a grupo OU permissão individual, nunca os dois). Plano completo
  aprovado em plan mode (ver `docs/adr/0004-permissoes-por-modulo-grupos.md` e
  `specs/E00-S09-grupos-permissao-modulo/design.md`). Implementado: migrations `0006`-`0009`
  (schema `grupos`/`grupo_modulos`/`usuario_modulos`, resolver + hook JWT `user_modulos`, RLS de
  domínio por módulo, `feature_flags` superadmin-only), Edge Function
  `config-gerenciar-usuario` (cria usuário Auth + papel + permissão inicial numa chamada), pgTAP
  (28 asserções), ADR-0004, glossário, `db/rls.template.sql`, runbook. **E00-S10** (UI
  administrativa + gating de sidebar) é a próxima story, depende desta mergeada.
- **Revisão de segurança nesta sessão** (parte do trabalho tinha sido rascunhada por outro
  agente/Codex antes de eu retomar — usuário pediu revisão cética, não confiar às cegas):
  achei e corrigi um bug real — `config.resolver_permissoes_modulo` e
  `config.definir_permissao_usuario` usavam `current_user` pra reconhecer chamadas
  internas/privilegiadas, mas `current_user` dentro de uma função `SECURITY DEFINER` é sempre o
  **dono** da função, nunca quem chamou — a guarda nunca disparava, então qualquer
  `authenticated` conseguiria ler a permissão de qualquer usuário e reatribuir grupo/permissão
  de qualquer um. Corrigido pra `session_user`. Achei também `plan(34)` no pgTAP quando só havia
  28 asserções reais — corrigido. Nenhum dos dois bugs tinha sido pego porque o código nunca foi
  rodado de verdade (sem `supabase test db`) antes desta revisão.
- **Pendente (SPEC_DEVIATION, aguardando aprovação do usuário):** (1) criar de fato
  `.claude/skills/revisao-adversarial/SKILL.md` — o classificador de auto-modo bloqueou por ser
  arquivo novo de comportamento padrão, mandato geral não foi específico o suficiente; conteúdo
  já está pronto (copiado do scaffold, genérico, sem adaptação necessária). (2) `.gitleaks.toml`:
  não trouxe os `regexes` de allowlist extra do scaffold (EXAMPLE/your-api-key-here/
  VITE_SUPABASE_ANON_KEY) pelo mesmo motivo — só o path `.triviaiox/` foi adicionado (mesma
  categoria já aprovada de `.triviaiox-core/`).
- **Ainda manual (não coberto por CI/API):** login no browser para validar AC-1,2,4-7 do E00-S05
  fim a fim (agora com o superadmin já provisionado, dá pra testar de verdade); rotacionar o JWT
  secret legado do projeto Supabase (exposto sem querer num diagnóstico de sessão anterior) —
  ver Bloqueios.
- **Integração Auvo — estudo e specs concluídos** (pedido explícito do usuário: "veja aonde
  acoplar as informações do Auvo... gere as specs para desenvolver na sequência" — só estudo e
  planejamento, sem implementar código). Cruzei `docs/ARCHITECTURE.md`, ADR-0001,
  `docs/blueprint/integracoes/auvo.md` (já continha boa parte do design técnico) e o mapeamento
  completo da API Auvo (vault) com o schema real (`0001_E00-S00`, colunas `auvo_*` já existiam
  mas sem código nenhum as usando). Resultado: 3 stories novas no ROADMAP, todas tier
  arquitetural/pequeno, nenhuma implementada ainda —
  - `E01-S09` (**arquitetural**, tem `design.md`): fundação — cliente HTTP Auvo compartilhado,
    sync de cliente PCM→Auvo, criação de task Auvo quando OS entra em `planejamento`.
  - `E01-S10` (pequeno, consome o design de S09): webhook Auvo → atualização de status da OS
    (execução/conclusão/cancelamento) + gatilho de `pcm.pmoc_records`.
  - `E01-S11` (pequeno, consome o design de S09): sync Auvo→PCM de técnicos/equipes/equipamentos
    (cache read-only local, `pcm.tecnicos_cache`/`pcm.equipamentos_cache` — tabelas novas, ainda
    sem migration).
  Duas questões de produto ficaram em aberto (ver `E01-S09/design.md` → Questões em aberto):
  `taskTypeId` de `levantamento`/`emergencial` e mapeamento GUT→`priority` Auvo — bloqueiam só
  `AC-7` de `E01-S09`, não o resto. Próximo passo real: `@dev` pega `E01-S09` (tasks.md já tem
  13 tasks ordenadas) quando alguém marcar o owner.
- **Outros próximos passos possíveis** (não iniciados): `specs/0002` (abertura de chamado via
  Zé, spec já aprovada) ou telas de operação do PCM com dados reais.
- **Branches anteriores ainda pendentes de PR:** `docs/E01-S03-pmoc-spec` (PMOC spec + rename
  OS→SO + design system).

## Specs implementadas / artefatos prontos
| Spec | Status | Gate |
|------|--------|------|
| `0001-priorizacao-backlog-gut` | implementado, todos os ACs verdes | pnpm test |
| `0002-abertura-chamado-ze` | aprovado (aguarda implementação — Mês 2) | — |
| `E00-S03-dashboard-geral` | implementado, todos os ACs verdes | typecheck ✅ · lint ✅ |
| `E00-S04-sidebar-logo` | implementado, todos os ACs verdes | typecheck ✅ · lint ✅ |
| `E00-S05-autenticacao-autorizacao` | **implementado**, todos os ACs verdes (`db-tests` no CI) | typecheck ✅ · lint ✅ · test ✅ · `supabase test db` ✅ (29/29, via CI/Docker) |
| `E00-S06-sync-padrao-os-v3` | implementado, todos os ACs verdes | audit-esteira ✅ · eval:spec ✅ · typecheck ✅ · lint ✅ · test ✅ · arch:check ✅ |
| `E00-S07-hardening-padrao-v3.2.0` | **implementado e mergeado** (PR #7) | `pnpm run ci:local` ✅ (esteira/fidelidade/mermaid/migrations/lint/typecheck/arch/build/test) |
| `E00-S08-renomear-papeis-rbac` | implementado, usuário superadmin já provisionado | aguardando `ci:local`/PR |
| `specs/E01-S03-pmoc-schema/design.md` | design arquitetural criado (tier arquitetural) | revisão humana |
| `E01-S09-integracao-auvo-fundacao` | **implementado e mergeado** (PR #10) — cliente HTTP, task/priority-map, 2 Edge Functions, migration do trigger; 6 SPEC_DEVIATION abertos (ver tasks.md) | `lint:migrations` ✅ · `audit-esteira` ✅ · `eval-spec-fidelity` ✅ · Deno type-check/testes: não executado (sem Deno CLI) |
| `E01-S10-integracao-auvo-webhook-status` | **implementado e mergeado** (PR #11) — AC-1 a AC-6 (`_shared/auvo/verify-signature.ts` + `pcm-auvo-webhook`), AC-7 deferido (SPEC_DEVIATION — PMOC não existe); 2 SPEC_DEVIATION abertos (ver tasks.md) | `lint:migrations` n/a (sem migration nova) · `audit-esteira` ✅ · `eval-spec-fidelity` ✅ · Deno type-check/testes: não executado (sem Deno CLI) |
| `E01-S11-integracao-auvo-sync-tecnicos-equipamentos` | **implementado e mergeado** (PR #12) — migrations `0012`/`0013`, Edge Functions `pcm-auvo-users-sync`/`pcm-auvo-equipment-sync`, pg_cron; `@qa` achou 1 bug real no pgTAP, corrigido; task 8 (habilitar `pg_cron` no Dashboard) pendência operacional | `db-tests` ✅ na CI |
| `E01-S12-visao-360-cliente` | **implementado — PR #14 aberto** (tier Pequeno) — 8 ACs cobertas (gating PCM, cabeçalho, backlog GUT, histórico Auvo, estado vazio, painel condicional S11 já reconciliado, read-only, cliente não encontrado) + Task 18 (navegação). `@qa` achou C1 (média), corrigido | leitura/agregação — sem migration nova; falta validação humana em browser

## Decisões recentes
- 2026-07-03: `@sm` (River) preparou `specs/E01-S11-integracao-auvo-sync-tecnicos-equipamentos/
  tasks.md` (12 tasks) na branch `feat/E01-S11-integracao-auvo-sync-tecnicos-equipamentos` —
  nenhum código tocado, só decomposição. Reaproveita 100% da fundação de `E01-S09` (cliente HTTP,
  `requireServiceRole`, secrets do Vault `auvo_trigger_project_url`/`auvo_trigger_service_role_key`
  já criados em `0011`) — nenhum secret novo, nenhuma auth nova. Decisões técnicas registradas como
  `[AUTO-DECISION]` em `tasks.md` (não sobem a nível de SPEC_DEVIATION): FK de
  `pcm.equipamentos_cache` para `pcm.clientes` via `auvo_id` (não `id` interno, coluna nullable com
  soft-fail se o cliente ainda não estiver sincronizado), horário do cron (`06:00 UTC`/`03:00 BRT`),
  filtro `userType = 1` client-side em `pcm-auvo-users-sync`, guarda para o soft-delete do AC-4
  nunca rodar se a paginação falhar no meio. Achado relevante para o time (não é bug desta story):
  `scripts/eval-spec-fidelity.mjs` só varre `specs/NNNN-*/` (regex `^\d{4}-`) — silenciosamente
  ignora todas as pastas `E0N-S0N-*` (`E01-S09`, `E01-S10`, este `E01-S11`), então o gate "verde"
  não garante rastreabilidade AC↔task nessas stories; mitigado à mão nesta sessão (cada AC citado
  na tabela de tasks), mas o script continua sem cobrir o padrão real do projeto até alguém abrir
  uma chore para ele. Nenhuma migration criada ainda (`0012`/`0013` são só o plano, descritas em
  `tasks.md`) — próxima sessão de `@dev` implementa a partir daqui.
- 2026-07-03: `E01-S09` (fundação Auvo) implementada em branch própria
  (`feat/E01-S09-integracao-auvo-fundacao`, a partir de `main`/`origin/main`, sem misturar com o
  trabalho paralelo de RBAC/grupos de outra sessão). Entregue: `_shared/auth.ts` ganhou
  `requireServiceRole` (chamada interna sistema→sistema via `SUPABASE_SERVICE_ROLE_KEY` como
  Bearer, comparação em tempo constante — `requireAuth`/`auth.getUser()` não serve para JWT de
  `service_role`, sem `sub`); `_shared/auvo/client.ts` (login cacheado 30min−120s, retry 401 1x,
  backoff 429 1x, log `X-Request-Id`+UTC); `_shared/auvo/task-type-map.ts` +
  `_shared/auvo/priority-map.ts` (+ testes Deno); Edge Functions `pcm-auvo-customers-sync` e
  `pcm-auvo-create-task`; migration `0011_E01-S09_trigger_auvo_planejamento.sql` (trigger
  `pg_net` assíncrono, `exception when others` nunca propaga, secrets via Vault
  `auvo_trigger_project_url`/`auvo_trigger_service_role_key`, não commitados). **Não construído**
  nesta sessão (fora do escopo explícito passado ao `@dev`): port `AuvoGatewayPort` na
  `application` da feature PCM e o `NullAuvoGateway` de `design.md` §Infra — as Edge Functions
  chamam o cliente Auvo direto. **6 SPEC_DEVIATION registrados** em `tasks.md` (porta não
  construída, coluna `clientes.endereco` inexistente, mapeamento de prioridade provisório,
  mecanismo de auth interna não estava em `design.md`, contrato exato da API Auvo não verificável
  neste ambiente, Deno CLI ausente — nenhum `.ts` foi type-checked/executado). Gates Node
  rodaram e passaram (`lint:migrations`, `audit-esteira`, `eval-spec-fidelity`); Squawk não
  instalado localmente (best-effort, CI é quem bloqueia de verdade). Sem git push (hook bloqueia
  por design) — trabalho commitado localmente na branch, aguardando push/PR por um devops humano
  ou sessão com permissão. Nota operacional: no início desta sessão, comandos de git exploratórios
  (`checkout`/`pull`/`branch -b`) foram rodados por engano no checkout compartilhado
  `~/Documents/GitHub/Sinergica/Sinergica-SO` (usado por outra sessão em paralelo) antes de eu
  perceber que meu trabalho real deveria ficar isolado no worktree
  `.claude/worktrees/agent-ae59de4e0ebc9048e` — nenhum comando destrutivo foi executado lá (só
  checkout/pull/criação de branch), mas vale registrar caso a outra sessão note o branch mudado.
- 2026-07-02: Papéis RBAC renomeados (E00-S08) — `admin→superadmin`, `escritorio→supervisor`,
  `tecnico→colaborador`; `cliente-sindico` inalterado (ator externo, fora da hierarquia de
  colaborador). Confirmado com o usuário: rename 1:1, mesma matriz de permissão de E00-S05, sem
  nova regra. Migration `0004` usa `alter policy` (não `drop`+`create`) nas ~19 policies de
  `0002_E00-S05_perfis_rbac.sql`, e remapeia dados existentes automaticamente (drop constraint →
  update → add constraint nova, nessa ordem — senão o remap violaria a constraint antiga).
  `docs/adr/0003` não foi editado (mecanismo JWT-claim/`config.usuarios` não mudou, só o
  vocabulário — não justifica ADR novo).
- 2026-07-02: Integração Auvo decomposta em 3 stories sequenciais em vez de uma só — `E01-S09`
  (fundação: cliente HTTP + sync cliente + criação de task, tier arquitetural, único com
  `design.md`) → `E01-S10` (webhook de status, consome o design de S09) → `E01-S11` (sync
  técnicos/equipamentos, direção invertida Auvo→PCM, consome o design de S09). Motivo: cada uma
  é entregável/testável isoladamente, e `docs/blueprint/integracoes/auvo.md` já apontava para 6
  Edge Functions com direções de dados diferentes — uma spec só ficaria grande demais para AC
  rastreáveis. Trigger de disparo escolhido para S09 é `pg_net` assíncrono (não bloqueante),
  não trigger síncrono — para a falha do Auvo nunca travar o *system of record* do PCM (ver
  `E01-S09/design.md` → Alternativas consideradas).
- 2026-07-02: Padrão OS evoluiu de v3.2.0 para v3.3.0/v3.3.1/v3.4.0 **durante** a story E00-S07 —
  husky+lint-staged+`ci-local.mjs` (task-runner caseiro) substituídos por **Lefthook**
  (`lefthook.yml` único, paralelo) + **Squawk** (segurança de migration: locks/breaking-change).
  `pnpm run ci:local` agora É `lefthook run pre-push` (hook e comando manual = mesma definição).
  Nova skill `/revisao-adversarial` (@qa+@security, tenta quebrar cada AC antes do PASS) — arquivo
  da skill em si não foi criado (bloqueado pelo classificador, ver Bloqueios), mas já está
  referenciado em `/validar`/`/revisar-pr`/DoD/matriz/AGENTS.md.
- 2026-07-02: Squawk achou 8 avisos reais (timeout settings, prefer-bigint) só em migrations
  `0001`/`0002`, já aplicadas em produção (nunca editadas) — excluídos em `.squawk.toml` com
  critério de reavaliação. Achado: `excluded_rules` precisa ser **top-level** no `.squawk.toml`,
  não dentro de `[default]` (como o próprio exemplo do scaffold sugeria) — silenciosamente
  ignorado se aninhado. `--assume-in-transaction` (real para Supabase) elimina os falsos
  positivos de "sem transação" sem precisar excluir a regra.
- 2026-07-02: "Padrão SO v2" (stale — a versão real é v3 há muito) corrigido em `CLAUDE.md`×2,
  `README.md`, `package.json` — mesma classe de bug que o próprio v3.3.1 do vault corrigiu.
- 2026-07-02: Custom Access Token Hook e schemas expostos (`pcm`/`atendimento`/`comercial`/
  `config`) registrados no projeto **hospedado** via Management API (`PATCH config/auth` e
  `PATCH postgrest`), não pelo Dashboard manualmente — mais rápido e auditável no histórico da
  conversa; confirmado por leitura de volta da config após aplicar.
- 2026-07-02: migration `0002_E00-S05_perfis_rbac.sql` não tinha `GRANT USAGE`/`SELECT`/`INSERT`/
  `UPDATE` para `authenticated` nos schemas de domínio — as RLS policies existiam mas o Postgres
  nega no nível de privilégio *antes* de avaliar RLS. Só apareceu rodando `supabase test db` de
  verdade (job `db-tests`, CI) — teria quebrado em produção do mesmo jeito. Grant adicionado à
  própria migration (ainda não aplicada a nenhum ambiente real).
- 2026-07-02: pgTAP não lança `42501` numa `UPDATE` filtrada pela `USING` da RLS — só em `INSERT`
  (violação de `WITH CHECK`). Teste corrigido para comparar valor antes/depois em vez de
  `throws_ok`.
- 2026-07-02: CI em Node 20 não roda `dependency-cruiser` 18 (exige `^22||^24||>=26`) — CI e
  `engines` do `package.json` raiz bumpados para Node ≥22.
- 2026-07-02: `vite` (via `@tailwindcss/vite`) tinha vuln HIGH (`GHSA-fx2h-pf6j-xcff`, sem patch na
  linha 5.x) — bump coordenado vite 6.4.3 + vitest 3.2.6 + `@vitejs/plugin-react` 4.7.0.
- 2026-07-02: `pnpm/action-setup@v4` recusa `with: version` quando o `package.json` já fixa
  `packageManager` — removido do `ci.yml` (só apareceu no 1º CI run real deste repo).
- 2026-07-02: `arch:check` (dependency-cruiser) roda sobre `apps/web/src` com `tsConfig.fileName`
  **absoluto** (`require("node:path").join(__dirname, ...)`) — passar caminho relativo causa bug
  de resolução do `extends` do `tsconfig.json` em monorepo (dependency-cruiser 18.0.0).
- 2026-07-02: RBAC via claim `user_role` no JWT (Custom Access Token Hook) + tabela `config.usuarios`, não subquery por policy — [ADR-0003](adr/0003-rbac-jwt-claim-config-usuarios.md).
- 2026-07-02: Provisionamento de usuário é manual em 2 passos (sem trigger automático em `auth.users` — não há como inferir o papel correto) — ver `runbooks/provisionar-usuario.md`.
- 2026-07-01: Renomeação produto "Sinérgica OS" → "Sinérgica SO" para eliminar ambiguidade com OS (Ordem de Serviço). "OS" = Ordem de Serviço; "SO" = Sistema Operacional.
- 2026-07-01: Tabelas PMOC (`pmoc_*`) vivem no schema `pcm` — PMOC é sub-módulo do PCM, não contexto autônomo.
- 2026-07-01: Checklists PMOC canônicos são constantes TypeScript em `packages/shared` (não no banco).
- 2026-07-01: OS Hub (E01-S07) decisão postergada — nova tabela vs refatoração da OS existente → design.md de E01-S07.
- 2026-06-25: PCM como origin of truth; Auvo recebe `externalId` idempotente — [ADR-0001](adr/0001-pcm-origin-truth-externalid.md)
- 2026-06-25: Detecção determinística de menção ao Zé antes de chamar o LLM — [ADR-0002](adr/0002-deteccao-deterministica-ze.md)
- 2026-06-25: Monorepo app único (`apps/web`) com features por bounded context — sem apps separados

## Bloqueios
- [ ] **`git push` bloqueado incondicionalmente por `.claude/hooks/enforce-git-push-authority.sh`
      nesta sessão** (2026-07-07) — o hook casa qualquer comando Bash com `/\bgit\s+push\b/` e nega,
      sem checar de fato qual "agente" está ativo (o texto de `TRIVIAIOX/agents/devops.md` descreve
      uma variável de ambiente `TRIVIAIOX_ACTIVE_AGENT` que o hook real não lê). Não há como uma
      sessão Claude Code contornar isso — é fail-closed por design. **Duas branches prontas,
      aguardando push humano:** `fix/E01-S11-equipment-sync-shadowing` (hotfix crítico, 1 commit) e
      `feat/E01-S22-motor-sync-auvo-write` (motor de sync, 2 commits). Quem destrava: Lucas (`git
      push -u origin <branch>` + `gh pr create` de cada uma).
- [x] ~~Git push bloqueado~~ ✅ Resolvido — novo repo `Sinergica-Manutencoes-Patrimoniais/Sinergica-SO`, Lucas é owner.
- [x] ~~Supabase não provisionado~~ ✅ Resolvido, depois **reprovisionado** — projeto atual:
      `nudannsrfvjggoergvyn.supabase.co`. `.env.local` atualizado (URL, publishable key,
      service_role, `SUPABASE_DB_PASSWORD`) — todos do projeto novo.
- [x] ~~E00-S05 precisa de Docker local~~ ✅ Resolvido — job `db-tests` no CI roda `supabase start`
      + `supabase test db` via Docker do runner do GitHub Actions. Achou e permitiu corrigir o bug
      real do GRANT ausente (ver Decisões). 29/29 pgTAP verdes.
- [x] ~~Migrations não aplicadas no projeto novo hospedado~~ ✅ Resolvido — GitHub Integration
      nativa ativada por Lucas (Settings → Integrations → GitHub, "Deploy to production" ON,
      production branch = `main`); aplicou `0001`+`0002` automaticamente. Confirmado por query
      direta em `supabase_migrations.schema_migrations` + existência dos 10 schemas + GRANTs
      corretos em `pcm.*` para `authenticated`.
- [x] ~~Ativar GitHub Integration nativa~~ ✅ Resolvido (mesmo item acima).
- [x] ~~Registro do Custom Access Token Hook em produção~~ ✅ Resolvido via Management API
      (`PATCH /v1/projects/{ref}/config/auth`) — `hook_custom_access_token_enabled: true`,
      apontando para `config.custom_access_token_hook`. Sem isso o JWT não carregava
      `user_role` e toda RLS negaria por padrão (AC-9) mesmo com login funcionando.
- [x] ~~Exposição dos schemas de domínio na Data API em produção~~ ✅ Resolvido via Management API
      (`PATCH /v1/projects/{ref}/postgrest`) — `db_schema` passou de `public,graphql_public` para
      incluir `pcm,atendimento,comercial,config`, espelhando `supabase/config.toml` local.
- [ ] **Rotacionar o JWT secret legado do projeto** — exposto sem querer no output de um comando
      de diagnóstico durante esta sessão (Dashboard → Settings → API → JWT Settings). Não é
      catastrófico (Supabase migrando desse esquema legado), mas é boa prática rotacionar algo que
      apareceu em texto puro numa conversa. Quem destrava: @devops/Lucas.
- [ ] Evolution API: instância existe na Cloudfy mas webhook não apontado para Supabase Edge Function ainda. Quem destrava: @devops/Lucas.
- [ ] **Criar `.claude/skills/revisao-adversarial/SKILL.md`** — bloqueado pelo classificador de
      auto-modo (arquivo novo de comportamento padrão; mandato geral "ajuste tudo" não foi
      específico o suficiente). Conteúdo pronto, é só aprovar. Quem destrava: Lucas, com um pedido
      direto ("crie a skill de revisão adversarial").
- [ ] **Decidir sobre os `regexes` de allowlist extra do `.gitleaks.toml`** (`EXAMPLE`,
      `your-api-key-here`, `VITE_SUPABASE_ANON_KEY`) do scaffold v3.2.0 — não trazidos por padrão
      (enfraqueceriam o gate de secret scanning sem pedido específico). Quem destrava: Lucas.
- [x] ~~Push/PR da branch `chore/E00-S07-hardening-padrao-v3.2.0`~~ ✅ Resolvido — PR #7 mergeado
      em `main`.
- [ ] **Definir `taskTypeId` Auvo de `levantamento`/`emergencial` e mapeamento GUT→`priority`**
      (decisão de produto do Fabrício) — bloqueia só `AC-7` de `E01-S09`, resto da story pode ser
      implementado sem isso. Ver `specs/E01-S09-integracao-auvo-fundacao/design.md` → Questões em
      aberto.
- [x] ~~`AUVO_API_KEY`/`AUVO_USER_TOKEN` só em `.env.local`~~ ✅ Resolvido — todas as vars de
      `.env.local` (Auvo, Supabase, Evolution API, OpenRouter, CORS) subidas como GitHub Actions
      secrets no repo (`gh secret list`, 14 secrets) a pedido do usuário ("vamos manter elas no
      github para você usar em tempo de deploy"). Novo workflow
      `.github/workflows/sync-secrets.yml` (gatilho: push em `supabase/functions/**` na `main`,
      ou `workflow_dispatch` manual) roda `supabase secrets set` para as que são runtime de Edge
      Function (Auvo, Evolution, OpenRouter, CORS — não as `SUPABASE_*`, que são reservadas/
      auto-injetadas pelo runtime). Falta só disparar o workflow uma vez quando `E01-S09` for
      implementada de verdade (hoje não há Edge Function nenhuma ainda, path do gatilho não
      dispara vazio).
- [ ] **Merge da PR de `E00-S08`** — só depois disso a migration `0004` aplica em produção via
      GitHub Integration nativa e a linha de `sinergicaengenharia@gmail.com` em
      `config.usuarios` remapeia de `admin` para `superadmin` automaticamente (o login já
      funciona hoje com acesso total, só o *label* do papel muda no merge). Quem destrava: Lucas.

## Ideias adiadas / backlog técnico
- Evals de laudo SPDA (comparação de saída LLM com laudos validados por engenheiro) → gatilho: primeira geração de laudo em produção
- Repriorização por IA no backlog GUT → gatilho: 3 meses de histórico de priorização
- Modo de Zé por número de técnico (DM direto) → gatilho: pedido explícito da Sinérgica

## Todos soltos
- [ ] Configurar CODEOWNERS (`.github/CODEOWNERS`) quando o time de desenvolvimento estiver definido
- [ ] Atualizar `docs/ENVIRONMENTS.md` quando URLs reais de staging/produção existirem
- [ ] Executar `pnpm run audit:deps` após provisionar e instalar dependências reais em CI
