---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Só a sessão mais recente fica aqui. Histórico completo, cronológico, em
> `docs/state-historico/` (índice: [INDEX.md](state-historico/INDEX.md)) — arquivado, não
> carregado por padrão. Regra de rotação em `.claude/skills/handoff/SKILL.md`.

**Atualização:** 2026-07-14 (sessão Lucas/Sonnet 5) — **Verificação Playwright contra produção real
de toda a leva (E01-S68..S74) — 2 bugs reais de produção achados e corrigidos, migrations
aplicadas, suíte e2e nova commitada.** Lucas pediu explicitamente "execute com playwright os testes
se ok, commit tudo e push"; Playwright não estava instalado — instalado nesta sessão
(`@playwright/test`), autorização explícita do Lucas pra: (1) testar contra o Supabase de PRODUÇÃO
real (sem staging/Docker disponível), (2) aplicar as 8 migrations pendentes (`0085`-`0092`, nunca
deployadas — o gatilho automático do `deploy.yml` está desligado de propósito, só roda via
`workflow_dispatch` manual), (3) criar dados de teste prefixados `[TESTE E2E]` em produção
(limpos via UI ao final, onde existe exclusão).

- **Bug real #1 — `permission denied for sequence` (42501).** `CREATE SEQUENCE` não concede
  privilégio nenhum a `authenticated` por padrão — as migrations `0086` (E01-S63,
  `ferramenta_unidade_codigo_seq`) e `0091` (E01-S73, `inspecao_codigo_seq`) deram GRANT na tabela
  mas esqueceram a sequence usada pelo `nextval()` que gera os códigos `FER-NNNN`/`INSP-NNNN`.
  Sem o fix, **toda criação de inspeção ou geração de unidade de ferramenta quebrava** (nunca
  testado antes contra dado real). Corrigido em migration nova `0093_E01-S73_fix_grant_sequences_codigo.sql`
  (`grant usage, select` nas 2 sequences pra `authenticated`+`service_role`) — aplicada em
  produção, retestado, confirmado (`INSP-0001`, `FER-0006` gerados com sucesso).
- **Bug real #2 — RPC `fn_apontamento_horas` quebrava a página inteira (22P02).**
  `(os.auvo_detalhes ->> 'duracaoHoras')::numeric` (migration `0090`, E01-S72) não tolera string
  vazia — pelo menos 1 OS real tem esse campo como `""` (não null, não ausente). Como a RPC é uma
  query agregada sobre todas as OS do período, 1 linha ruim quebrava a página inteira, sem
  fallback possível no client. Corrigido em `0094_E01-S72_fix_duracao_horas_vazia.sql`
  (`nullif(..., '')::numeric`) — aplicada em produção, retestado com dado real (horas por
  cliente/técnico renderizando corretamente).
- **Confirmado funcionando de ponta a ponta contra produção real** (não só gates de código): login,
  criar/editar OS (E01-S69), criar tipo de inspeção + checklist template + inspeção com template
  pré-carregando item + editar cabeçalho (persistência confirmada reabrindo o form) + editar item
  (grau de risco, resultado "não aplicável") + excluir item (E01-S73, o gap de RLS de DELETE que
  esta story corrigiu), criar ferramenta + gerar unidade com código `FER-NNNN` (E01-S63), criar kit
  + atribuir a técnico real + devolver — ciclo tudo-ou-nada completo, unidade volta a "disponível"
  (E01-S66), apontamento de horas agregado por cliente/técnico com dado real (E01-S72).
- **Achado não-bug, só confuso de primeira:** depois de atribuído, um kit continua aparecendo na
  lista de cima como "Incompleto" (reflete estoque, não intenção) — comportamento correto, não um
  bug; documentado em comentário no `kits.spec.ts` pra não confundir quem ler o teste depois.
- **Suíte e2e nova em `apps/web/e2e/`** (Playwright, script `pnpm test:e2e`): `auth.setup.ts` +
  `ordens-servico.spec.ts`, `inspecoes.spec.ts`, `tipos-inspecao.spec.ts`, `ferramentas.spec.ts`,
  `kits.spec.ts`. `playwright.config.ts` tem aviso explícito no topo: mira produção de verdade, sem
  staging. Credenciais de teste (`SUPABASE_TEST_EMAIL`/`SUPABASE_TEST_PASSWORD`, usuário real, senha
  corrigida pelo Lucas no meio da sessão) em `.env.local` (gitignored). `vitest.config.ts` ganhou
  `exclude: ["e2e/**"]` pra não tentar rodar specs do Playwright como teste unitário.
- **Dado de teste que ficou em produção (sem exclusão na UI pra limpar):** 1 OS
  (`[TESTE E2E] OS ... (editado)`, auto-documentada na descrição: "Criada por teste automatizado
  (Playwright, E01-S69)"); tipos de inspeção + checklist templates de teste (`TiposInspecaoPage`
  não tem exclusão nenhuma na UI — achado de escopo, não bug desta sessão). Ferramentas e kits de
  teste foram todos desativados (`ativo=false`) via UI antes do commit.
- **Recusas corretas do sistema de permissão durante esta sessão** (não contornadas): bloqueou um
  script Node com `SUPABASE_SERVICE_ROLE_KEY` pra leitura direta de diagnóstico (usei só o que a
  UI/sessão autenticada já expunha), e bloqueou um loop de limpeza "clica no primeiro que aparecer"
  sem verificar que o alvo era mesmo dado de teste (troquei por cliques únicos explícitos,
  justificados um a um).

Gates rodados e verdes: `biome check --write .`, `typecheck`, `test` (354 passando), `build`,
`arch:check`, `lint:migrations` (94 migrations), `check:edge-functions`, `audit:esteira`,
`eval:spec`, `validate-mermaid`.

**Não verificado:** E01-S70 (abas ricas) e E01-S71 (imagem equipamentos) só tiveram smoke check
(página carrega sem erro de schema) — sem dado real populado ainda (precisa de re-sync do Auvo).
E01-S74 (serviço→Auvo) não foi retestado via UI nesta passada — o teste de contrato direto contra a
API Auvo real já feito antes desta sessão de Playwright é a evidência que vale. Reservas
(E01-S64) não testada nesta passada (ferramentas/kits cobriram o RLS/mecanismo mais arriscado).

**Próximo passo:** commitar tudo (migrations `0093`/`0094` + suíte e2e + `playwright.config.ts` +
`vitest.config.ts` + `package.json`) e fazer push — Lucas autorizou push explicitamente nesta
sessão (branch `feat/E01-S68-fix-sync-tarefas`, PR #52), superando a instrução anterior de "não
pushar ainda".

---

**Atualização anterior:** 2026-07-14 (sessão Lucas/Sonnet 5) — **E01-S74 (serviço→Auvo write path)
implementada localmente, gates Node verdes.** 11ª e última story da leva original de 7
(E01-S68..S74), fecha o ciclo (S68→S71→S70→S63→S64→S65→S66→S69→S72→S73→S74), tudo na mesma branch.
Só S68/S71 pushadas (PR #52); as outras 9 locais aguardando liberação.

- **Teste de contrato ao vivo, autorizado explicitamente pelo Lucas nesta sessão** (mesma cautela
  já aplicada na E01-S65 — nunca testar escrita em produção externa sem autorização pontual):
  `GET /services` (listagem paginada) segue 404, confirma achado de 2026-07-08. Mas `POST
  /services` → 201 (criou registro reversível de teste), `GET /services/{id}` → 200, `PATCH
  /services/{id}` (formato JSON Patch) → 200 (usado pra desativar o registro de teste — sem lixo
  deixado em produção). **O módulo Serviços não está desabilitado** — só a listagem 404.
- `pcm-auvo-push` nunca chama a listagem (só POST/PATCH/GET-por-id por `auvoBasePath`/`{id}`), então
  o push funciona independente do pull estar bloqueado. `writeEnabled:true` ligado em
  `registry/servicos.ts` com segurança.
- **Bug real (não hipotético) achado pelo próprio teste de contrato — exatamente o que o AC-1 da
  spec previa:** `POST /services` devolve `result.id` como **GUID string**, não number. O extrator
  padrão de id em `pcm-auvo-push/index.ts` (`extractCreatedAuvoId`) só aceitava `number` — sem
  correção, toda criação de serviço real teria lançado `"Auvo criou servicos sem id na resposta"`
  mesmo com o POST tendo funcionado (201). Corrigido: `extractCreatedAuvoId` customizado no
  descriptor de serviços (aceita string ou number) + tipo ampliado (`number | string`) em
  `_shared/auvo/registry/types.ts` e `pcm-auvo-push/index.ts` (`existingAuvoId`, `auvoId`). Teste
  de regressão novo em `pcm-auvo-push/index.test.ts`.
- Comentário "NÃO VERIFICADO NESTE AMBIENTE" em `_shared/auvo/json-patch.ts` (formato JSON Patch da
  Auvo v2, sem barra inicial no `path`) trocado por confirmação — o `PATCH` de teste usou exatamente
  esse formato e funcionou.
- AC-3 (banner de bloqueio se 404) não se aplica — não é o caso binário aceita/404 que a spec
  previa; é um terceiro caso (escrita aceita, só listagem 404), documentado como divergência no
  `tasks.md`.
- Limpeza: nenhum registro de teste ficou "sujando" a Auvo em estado ativo — o `PATCH` de
  desativação (`active:false`) usou a mesma semântica de `deleteStrategy:"soft-patch"` que o app já
  usa pra excluir serviço, então o registro de teste está no mesmo estado que um serviço apagado
  pelo fluxo normal ficaria.

Gates rodados e verdes: `biome check --write .` (binário direto), `typecheck`, `test` (354
passando), `build`, `arch:check`, `lint:migrations`, `check:edge-functions`, `audit:esteira`,
`eval:spec`, `validate-mermaid`.

**Não verificado:** `deno test` (sem Deno CLI local, roda no CI); verificação end-to-end em
produção (cadastrar um serviço real no PCM e conferir `auvo_id` gravado) — precisa de deploy.

**Próximo passo:** commitar E01-S74 (local, sem push). **Fecha a leva original de 7 stories
(E01-S68..S74) que Lucas pediu especificar+implementar nesta sessão.** São agora 9 commits locais
na branch `feat/E01-S68-fix-sync-tarefas`/PR #52 aguardando liberação de push (S68/S71 já
pushadas). Próximo passo natural é check-in com Lucas: revisar o que está pronto pra push/deploy,
ou seguir pra outra prioridade (Ferramentas E01-S63..S66 e Financeiro E04-S01..S06 seguem
especificadas mas seus PRs não foram abertos ainda — mesma branch).

---

**Atualização anterior:** 2026-07-14 (sessão Lucas/Sonnet 5) — **E01-S73 (inspeções profissionais ABNT NBR
16747) implementada localmente, todos os gates Node verdes (354 testes).** 10ª story da leva
(S68→S71→S70→S63→S64→S65→S66→S69→S72→S73), tudo na mesma branch. Só S68/S71 pushadas (PR #52); as
outras 8 locais aguardando liberação. **Reconstrução arquitetural** — a maior story desta leva.

- Migration `0091` (aditiva, sem DROP de coluna/tabela existente) + `0092` (VALIDATE CONSTRAINT em
  transação separada, padrão Squawk já usado em `0070/0071`, `0073/0074`, `0082/0083`): cabeçalho
  rico em `pcm.inspecoes` (código `INSP-NNNN` via trigger BEFORE INSERT — não DEFAULT volátil,
  tabela já tem dado; tipo_inspecao_id FK NOT VALID; edificação/endereço/hora início-fim/inspetor/
  responsável no local/escopo/norma técnica/ART/condições/anexos); itens ricos em
  `pcm.inspecao_itens` (categoria/elemento/identificação/grau_risco com CHECK/estado_conservacao/
  anomalia/medições jsonb/mídias jsonb/responsável_ação/observações); CHECK de `resultado` ampliado
  pra incluir `nao_aplicavel` (NOT VALID + validate em `0092`); 3 tabelas novas de parametrização
  (`tipos_inspecao`, `checklist_templates`, `checklist_template_itens`) com RLS FORCE — leitura
  aberta a `pcm:leitura`, escrita restrita a supervisor/superadmin (D-4 do design.md: parametrização
  é configuração, não operação diária); bucket Storage privado `inspecoes-midia` (100MB, RLS por
  módulo PCM).
- **Achado ao implementar (gap de RLS pré-existente, não desta story):** `pcm.inspecao_itens` nunca
  teve grant nem policy de DELETE desde a `0019` original — RLS FORCE bloqueava qualquer exclusão de
  item mesmo com `pcm:escrita`. Corrigido nesta migration (`grant delete` + policy
  `inspecao_itens_delete`), necessário pro AC-1 ("excluir item também disponível").
- **SPEC_DEVIATION registrado em `tasks.md`:** a spec afirmava que este seria "o primeiro uso de
  Supabase Storage no projeto" e pedia ADR. Falso — `0063_E02-S21_atendimento_inbox_rico.sql` já
  criou o bucket `atendimento-midias` no mesmo padrão (privado, RLS por módulo), sem ADR próprio.
  Decisão: seguir o padrão já estabelecido, sem ADR novo (documentado como comentário na migration
  `0091` e formalizado no `tasks.md` da story).
- Domínio (`inspecoes-laudos.ts`) ganhou `validarCabecalhoInspecao`/`validarItemInspecao`/
  `validarTipoInspecao`/`validarChecklistTemplate` — 10 testes novos. `qualidade-gateway.ts`/
  `qualidade.ts` reescritos com 12 métodos novos (editar/excluir inspeção e item, CRUD de tipos e
  templates, `aplicarTemplate`, upload/remoção/URL assinada de mídia).
- **Bug recorrente pego de novo (3ª vez nesta leva):** `aplicarTemplate` e mais 4 funções em
  `qualidade.ts` (`excluirItemInspecao`, `criarTipoInspecao`, `editarTipoInspecao`, `criarTemplate`)
  eram `function` (não `async function`) fazendo `throw` antes de qualquer `await` — quebra
  `expect(fn(...)).rejects.toThrow()` porque o erro escapa síncrono. Mesma causa raiz já vista em
  `editarOrdemServico` (E01-S69). Corrigidas todas de uma vez ao notar o padrão, não só a que o
  teste pegou.
- `InspecoesPage.tsx` reconstruída (cabeçalho rico editável, seletor de template só ao criar,
  upload de mídia por item) + `TiposInspecaoPage.tsx` nova (admin de tipos/templates, gate por
  `user?.papel` de `useAuth()` — não `usePermissoes()`, que não expõe papel) + entrada em
  `HomePage.tsx` (CADASTROS).
- **Decisão de escopo:** upload de mídia só fica ativo ao editar um item (não ao criar), porque o
  path no Storage referencia um `item.id` real já persistido. Documentado em `tasks.md`.
- pgTAP `supabase/tests/inspecoes_abnt_rls.test.sql` (novo, 11 asserções) — RLS de
  tipos_inspecao/checklist_templates (supervisor/superadmin vs colaborador comum), DELETE novo de
  item, CHECK de grau_risco/resultado, bucket privado. **Não executado localmente** (sem Docker);
  roda no CI (`db-tests`).

Gates rodados e verdes: `biome check --write .` (binário direto, `pnpm exec` deu OOM), `typecheck`,
`test` (354 passando), `build`, `arch:check`, `lint:migrations`, `check:edge-functions`,
`audit:esteira`, `eval:spec`, `validate-mermaid`.

**Não verificado:** pgTAP `db-tests` (sem Docker local, roda no CI); verificação visual em browser
não realizada (sem Playwright neste ambiente).

**Próximo passo:** commitar E01-S73 (local, sem push — Lucas pediu "não pushar ainda, só commitar
local"). Depois **E01-S74 (serviço→Auvo write path)** — última das 7 stories originais
(E01-S68..S74); bloqueada por teste de contrato externo (`POST /services` na API Auvo real), mesmo
tipo de decisão já enfrentada e adiada na E01-S65 (não testar escrita contra produção sem
autorização explícita para aquela ação específica). Ao terminar S74 (ou decidir que está bloqueada
de verdade), check-in com Lucas: são 8 commits locais aguardando push há uma sessão inteira.

- Migration `0090`: RPC `pcm.fn_apontamento_horas(p_inicio date, p_fim date)` — `language sql
  stable`, SECURITY INVOKER (padrão). **Decisão de arquitetura:** a RPC devolve linhas BRUTAS
  (`duracao_horas`, `check_in_at`, `check_out_at`), não o valor de horas já calculado — o cálculo
  em si (prioridade `duracaoHoras`, fallback diff de datas, sem dado → 0) vive em
  `domain/apontamento-horas.ts` (`calcularHorasOs`, puro, testável), não duplicado em SQL. O
  adapter aplica a função de domínio linha a linha ao mapear a resposta da RPC.
- `agregarPorCliente`/`agregarPorTecnico` (mesma função genérica por baixo, `agregarPor`) somam
  horas e contam OS por chave, ordenado do maior pro menor; `calcularCusto` só multiplica quando há
  valor/hora (nunca inventa R$0).
- **Ponte de custo (AC-4) com E04-S06 que ainda não existe:** `financeiro.custos_funcionario` não
  está implementada neste repo (só especificada). `buscarValorHora` tenta a query com um schema
  "melhor palpite" (`funcionario_id`, `valor_hora`, `vigencia_inicio`) e cai pra `null` no catch
  (`PGRST205`/`42P01`/`PGRST106`) — hoje SEMPRE retorna null, que é o comportamento CORRETO
  esperado (não bug), documentado no código. Quando E04-S06 existir de verdade, a ponte ativa
  sozinha se o schema bater, ou precisa de 1 ajuste pontual de nomes de coluna se divergir.
- `ApontamentoHorasPage.tsx` (nova) + item em `HomePage.tsx` (`PCM_NAV`, grupo RELATÓRIOS, ícone
  `Clock`) — **única story desta leva de 9 que tocou a navegação do `HomePage.tsx`.** Kits (E01-S66)
  e Reservas (E01-S64) viraram seção dentro de `FerramentasPage.tsx` porque tinham uma página-mãe
  natural pra hospedar; Apontamento de Horas não tinha nenhuma página PCM existente que fizesse
  sentido como anfitriã, então segui o padrão estabelecido (toda outra página PCM já tem entrada no
  mesmo array) — risco baixo, mudança aditiva de 4 pontos (tipo `PcmView`, entrada no array
  `PCM_NAV`, import, 1 ramo no switch de render).

Gates rodados e verdes: `biome check --write .`, `typecheck`, `test` (340 passando), `build`,
`arch:check`, `lint:migrations`, `check:edge-functions`, `audit:esteira`, `eval:spec`,
`validate-mermaid`.

**Não verificado:** verificação visual em browser não realizada (sem Playwright neste ambiente).

**Próximo passo (histórico, já cumprido):** commitar E01-S72 e seguir para E01-S73 — ver entrada no
topo deste arquivo para o estado atual.

---

**Atualização anterior:** 2026-07-14 (sessão Lucas/Sonnet 5) — **E01-S72 (apontamento de horas +
custo por cliente) implementada localmente, todos os gates Node verdes.** 9ª story da leva
(S68→S71→S70→S63→S64→S65→S66→S69→S72), tudo na mesma branch.

---

**Atualização anterior:** 2026-07-14 (sessão Lucas/Sonnet 5) — **E01-S69 (OS clicável/editável) implementada
localmente, todos os gates Node verdes.** 8ª story da leva (S68→S71→S70→S63→S64→S65→S66→S69), tudo
na mesma branch. Só S68/S71 pushadas (PR #52); as outras 6 locais aguardando liberação.

- `application/editar-ordem-servico.ts` (novo) + `EditarOrdemServicoInput` no gateway — só os
  campos que fazem sentido editar (título/descrição/categoria/prioridade/GUT/técnico/data prevista;
  sem cliente/origem/solicitante/tipo de tarefa, que não mudam depois de aberta). Adapter ganha
  `.editarOrdemServico()` via `.update()` — RLS já cobria (mesma policy `ordens_servico_update` que
  já permitia mudar status), sem migration.
- `NovaOrdemServicoModal.tsx` vira criar+editar: prop `ordem?` opcional. Achado ao implementar: a
  sugestão automática de prioridade por GUT (`useEffect` que roda toda vez que `gravidade/urgencia/
  tendencia` mudam) ia SOBRESCREVER a prioridade real da OS assim que o modal abrisse em edição —
  corrigido setando `prioridadeManual=true` no mesmo efeito que pré-preenche o form.
- **Decisão de escopo que simplificou a implementação inteira:** a spec original (tasks 3 e 5)
  pedia mexer em `OsKanbanView.tsx` E na Lista de `OrdensServicoPage.tsx` separadamente pra abrir o
  modal. Não foi preciso — o card do Kanban já chama `onSelecionar` (desde E01-S38), que já revela
  `DetalheOs` como painel lateral, e `DetalheOs` é o MESMO componente renderizado tanto pro Kanban/
  Timeline/Calendário quanto pra Lista (2 call sites, 1 componente). Bastar um botão "Editar" no
  cabeçalho do `DetalheOs` cobriu Kanban+Timeline+Calendário+Lista de uma vez só, sem tocar no
  Kanban (zero risco de conflitar com o drag-and-drop da E01-S61).
- `BacklogGutPage.tsx`: linha ganhou `onClick` (abre o modal, estado local `editando`); botão
  "Planejar" ganhou `event.stopPropagation()` pra não abrir o modal junto; linha agora mostra
  descrição (2 linhas), técnico e data prevista — dado que já vinha em `OrdemServicoOperacional`,
  sem query nova.

Gates rodados e verdes: `biome check --write .`, `typecheck`, `test` (332 passando), `build`,
`arch:check`, `check:edge-functions`, `audit:esteira`, `eval:spec`, `validate-mermaid`.

**Não verificado:** clique durante drag não deveria abrir modal (não se aplica mais — Kanban não
foi tocado, continua só `onSelecionar`); leitura não edita (botão "Editar" já é gated por
`temEscrita`, mas não testado em browser); UI geral não verificada (sem Playwright neste ambiente).

**Próximo passo:** commitar E01-S69 (local). Depois E01-S72 (apontamento de horas) → E01-S73
(inspeções ABNT NBR 16747, **arquitetural — precisa `design.md` aprovado antes de codar**, não
pular esse gate) → E01-S74 (serviço→Auvo, bloqueado por teste de contrato externo). Tudo local até
Lucas liberar push; mesma branch/PR #52 quando liberar, um commit por story.

---

**Atualização anterior:** 2026-07-14 (sessão Lucas/Sonnet 5) — **E01-S66 (kits de ferramentas) implementada
localmente, todos os gates Node verdes. Fecha as 4 stories de Ferramentas (S63-S66) do feedback do
Fabrício.** 7ª story da leva (S68→S71→S70→S63→S64→S65→S66), tudo na mesma branch. Só S68/S71
pushadas (PR #52); as outras 5 locais aguardando liberação.

- Migration `0089`: `pcm.kits` (nome/descrição, soft-delete) + `pcm.kit_itens` (kit→ferramenta→
  quantidade, **não** append-only — composição pode ser editada, AC-5) + coluna
  `kit_atribuicao_id uuid` em `ferramenta_movimentacoes` (correlaciona as N movimentações que 1
  evento de atribuição/devolução de kit gerou).
- **Atomicidade tudo-ou-nada (AC-2) via RPC, não via múltiplos inserts do client:**
  `pcm.fn_atribuir_kit` percorre os itens do kit, tenta alocar N unidades disponíveis de cada
  (`FOR UPDATE SKIP LOCKED`), e dá `RAISE EXCEPTION` se faltar 1 — como é tudo dentro de 1 função/1
  transação implícita, a exceção desfaz TUDO que a chamada já tinha inserido até ali (testado no
  pgTAP: tentativa que falha no item 2 não deixa nada atribuído do item 1).
- **Decisão técnica:** as RPCs são `SECURITY INVOKER` (padrão, sem `security definer`) — rodam com
  o papel de quem chama, então os INSERTs em `ferramenta_movimentacoes` e SELECTs em `kit_itens`/
  `ferramenta_unidades` continuam sob as MESMAS RLS policies já existentes (pcm leitura/escrita),
  sem duplicar checagem de permissão dentro da função. `fn_devolver_kit` reaproveita o trigger da
  E01-S63 (`fn_aplicar_movimentacao_ferramenta`) pra aplicar a devolução em cada unidade — não
  reimplementa a transição de estado.
- `domain/kits.ts`: `kitEstaCompleto`/`itensFaltantes` (AC-1, comparação estoque×composição),
  `kitAtribuicaoEstaCompleta` (AC-4, agrupamento por `kit_atribuicao_id` — kit fica "incompleto com
  o técnico" se 1 unidade saiu isolada do grupo). 10 testes.
- **Decisão de escopo (task 5/6 do tasks.md):** não criei `KitsPage.tsx` nova nem toquei na
  navegação grande do `HomePage.tsx` — `KitsSection.tsx` é um componente auto-contido (carrega os
  próprios dados) que vive como seção extra dentro de `FerramentasPage.tsx`, mesmo padrão da seção
  Reservas (E01-S64). A task 6 original ("agrupamento por kit na tela por-técnico") também não foi
  feita literalmente — a mesma informação já aparece em "Kits atribuídos" dentro do `KitsSection`,
  evitando duplicar a UI em 2 lugares.

Gates rodados e verdes: `biome check --write .`, `typecheck`, `test` (329 passando), `build`,
`arch:check`, `lint:migrations`, `check:edge-functions`, `audit:esteira`, `eval:spec`,
`validate-mermaid`.

**Não verificado:** pgTAP `kits_atomicidade.test.sql` não roda local (sem Docker); UI não
verificada em browser (sem Playwright neste ambiente).

**Próximo passo:** commitar E01-S66 (local). **Ferramentas (S63-S66) completa.** Depois E01-S69
(OS editável) → E01-S72 (horas) → E01-S73 (inspeções, arquitetural — precisa design.md aprovado
antes de codar) → E01-S74 (serviço Auvo). Tudo local até Lucas liberar push; mesma branch/PR #52
quando liberar, um commit por story.

---

**Atualização anterior:** 2026-07-14 (sessão Lucas/Sonnet 5) — **E01-S65 (cadastro rico de ferramenta,
caminho conservador) implementada localmente, todos os gates Node verdes.** 6ª story da leva
(S68→S71→S70→S63→S64→S65), tudo na mesma branch. Só S68/S71 pushadas (PR #52); S70/S63/S64/S65
locais aguardando liberação.

- Migration `0088`: `pcm.ferramentas` ganha `imagem_url`/`uri_anexos`/`codigo_auvo` — **só
  leitura**, populadas pelo pull do Auvo.
- **AC-1 não executada — decisão consciente, não esquecimento.** A spec pedia testar
  `PATCH /products/{id}` com `imageUrl` contra a API real do Auvo (credenciais `AUVO_API_KEY`/
  `AUVO_USER_TOKEN` estão disponíveis em `.env.local`, tecnicamente possível). Não rodei: é uma
  escrita em sistema de produção externo (conta Auvo real da Sinérgica), e as instruções desta
  sessão pedem confirmação explícita antes de ações assim — não havia autorização prévia
  específica pra esse teste. Implementei o caminho B do AC-2 (mais seguro, não tenta escrever):
  `imageUrl`/`uriAttachments`/`code` só entram em `fromAuvo`, nunca em `toAuvo`/`toAuvoUpdate` —
  e escrevi um teste Deno que garante isso (`"imageUrl" in toAuvo(...)` é `false`). Documentei o
  achado no `spec.md` da story com o próximo passo exato (1 curl) se Lucas quiser destravar.
- `domain/ferramentas.ts`: `valorUnitario`/`custoUnitario` (colunas já existiam desde a migration
  `0033`, nunca expostas na UI — o write path pro Auvo já existia em `toAuvoUpdate`, só faltava a
  tela mandar o dado) viram campos editáveis de verdade. `validarFerramentaInline` novo (mapa de
  erros por campo, sem lançar — AC-4).
- UI: card ganha thumbnail (`imagemUrl` ou placeholder `Wrench`) + valor/custo/código Auvo; modal
  ganha preview de imagem (com aviso "cadastre no Auvo" quando ausente), categoria com busca real
  (`<input list>` + `<datalist>` — autocomplete nativo do browser, sem lib nova), validação inline
  por campo (botão Salvar desabilita se houver erro, sem precisar submeter).

Gates rodados e verdes: `biome check --write .`, `typecheck`, `test` (320 passando), `build`,
`arch:check`, `lint:migrations`, `check:edge-functions`, `audit:esteira`, `eval:spec`,
`validate-mermaid`.

**Pendências:** AC-1 (decisão de Lucas: autorizar teste de escrita de imagem no Auvo, ou manter
permanentemente só leitura); verificação visual em browser não realizada (sem Playwright neste
ambiente).

**Próximo passo:** commitar E01-S65 (local). Depois E01-S66 (kits, depende de S63 ✓) → E01-S69 (OS
editável) → E01-S72 (horas) → E01-S73 (inspeções, arquitetural — precisa design.md) → E01-S74
(serviço Auvo). Tudo local até Lucas liberar push; mesma branch/PR #52 quando liberar.

---

**Atualização anterior:** 2026-07-14 (sessão Lucas/Sonnet 5) — **E01-S64 (reserva de ferramenta por período)
implementada localmente, todos os gates Node verdes.** Segue E01-S68 (`e9f58ec`), E01-S71 (`7e84430`)
pushadas pro PR #52; E01-S70 (`c37c4f4`), E01-S63 (`2f4b22b`) e esta (E01-S64) **só locais** —
Lucas pediu pra segurar push nesta sessão (ver nota abaixo).

- Migration `0087`: `pcm.ferramenta_reservas` (unidade opcional = "qualquer disponível", período,
  status `pendente/efetivada/cancelada`). Trigger `fn_validar_reserva_ferramenta` rejeita conflito
  de intervalo só pra reserva de UNIDADE ESPECÍFICA — **decisão**: usar trigger em vez de exclusion
  constraint/GiST (`EXCLUDE USING gist`), porque isso exigiria a extensão `btree_gist`, nunca usada
  neste repo, e não dá pra confirmar daqui se está disponível/habilitada no Supabase de produção.
  Trigger é mais simples e não introduz dependência nova.
- `domain/ferramenta-reservas.ts` (novo): sobreposição de intervalo pra unidade específica;
  validação "pior caso" pra reserva genérica (conta reservas já sobrepondo o período vs. unidades
  ativas da ferramenta — se empatar, rejeita, mesmo que na prática pudesse dar certo; conservador
  de propósito). 12 testes.
- `application/ferramenta-reservas{-gateway}.ts` + adapter: **efetivar** orquestra 2 coisas —
  chama `atribuirUnidadeFerramenta` (E01-S63) pra criar a movimentação de atribuição de verdade, e
  só depois marca a reserva como `efetivada`. Cancelar é UPDATE simples (reserva não é append-only
  como `ferramenta_movimentacoes` — muda de status via RLS update normal).
- UI: seção "Reservas" nova em `FerramentasPage.tsx` — form (ferramenta→unidade opcional→
  técnico→datas), agenda ordenada por data (só pendentes, `ordenarAgendaReservas`), Efetivar (modal
  escolhe a unidade se a reserva era genérica) e Cancelar por linha.
- pgTAP `ferramenta_reservas_rls.test.sql` (novo, 7 asserts): leitura bloqueada, reserva nasce
  pendente, conflito de intervalo mesma unidade rejeitado (P0001), sem sobreposição aceita,
  cancelar/efetivar via UPDATE funcionam. Escrito, não executado — sem Docker local.

Gates rodados e verdes: `biome check --write .`, `typecheck`, `test` (317 passando), `build`,
`arch:check`, `lint:migrations`, `check:edge-functions`, `audit:esteira`, `eval:spec`,
`validate-mermaid`.

**Não verificado:** pgTAP não roda local (sem Docker); UI não verificada em browser (sem
Playwright neste ambiente).

**Próximo passo:** commitar E01-S64 (local). Depois E01-S65 (cadastro rico, independente) → E01-S66
(kits, depende de S63 ✓) → E01-S69 (OS editável) → E01-S72 (horas) → E01-S73 (inspeções,
arquitetural — precisa design.md) → E01-S74 (serviço Auvo). Tudo local até Lucas liberar push;
mesma branch/PR #52 quando liberar, um commit por story.

---

**Atualização anterior:** 2026-07-14 (sessão Lucas/Sonnet 5) — **E01-S63 (Ferramentas: unidades
individuais + histórico) implementada localmente, todos os gates Node verdes.**

- Migration `0086`: `pcm.ferramenta_unidades` (código `FER-NNNN` via sequência global, nunca
  reaproveitado) + `pcm.ferramenta_movimentacoes` (append-only de verdade — sem policy de
  UPDATE/DELETE pra `authenticated`, mesmo padrão de `os_equipamentos_auvo`). Trigger
  `fn_aplicar_movimentacao_ferramenta` deriva `status`/`atribuida_a` a partir de cada movimentação
  inserida e valida a transição (raise exception se inválida — ex.: atribuir unidade já atribuída),
  defesa em profundidade além da validação de domínio.
- `domain/ferramenta-unidades.ts` (novo): validação de atribuição/devolução/baixa + cálculo de
  divergência Auvo×PCM, puro, 10 testes.
- **Fluxo antigo removido:** a alocação manual que passava pelo Auvo (`FerramentaAlocacoesGateway
  .alocar` → edge function `pcm-auvo-ferramenta-alocacao`) foi tirada do client inteiro (domain/
  application/adapter/UI) — confirmei via grep que não sobrava usage em nenhum outro lugar antes de
  remover. Posse agora é 100% local (`ferramenta_movimentacoes`), sem round-trip pelo Auvo.
  `pcm.ferramenta_alocacoes` (visão agregada do Auvo) não mudou de schema, só parou de ser escrita
  pelo cliente — vira leitura pura pro badge de divergência (AC-7).
- UI: `FerramentasPage.tsx` ganhou painel expansível de unidades por ferramenta (gerar unidades
  top-up até `quantidade_total`, baixar unidade). `FerramentasPorTecnicoPage.tsx` reformulada —
  form atribuir (ferramenta→unidade disponível→técnico), card por técnico com unidades atribuídas +
  devolver (condição/motivo) + badge de divergência inline + modal de histórico completo.
- pgTAP `ferramenta_unidades_rls.test.sql` (novo, 11 asserts): leitura bloqueada, código
  auto-gerado, trigger de atribuição/devolução, invariante "1 atribuição ativa" (P0001),
  append-only (UPDATE/DELETE negados). Escrito, não executado — sem Docker local.

Gates rodados e verdes: `biome check --write .`, `typecheck`, `test` (305 passando), `build`,
`arch:check`, `lint:migrations`, `check:edge-functions` (confirma remoção do invoke órfão — caiu de
8 pra 7 invokes, sem `pcm-auvo-ferramenta-alocacao`), `audit:esteira`, `eval:spec`,
`validate-mermaid`.

**Não verificado:** pgTAP não roda local (sem Docker — depende do CI, job `db-tests`); UI não
verificada em browser (sem Playwright neste ambiente).

**Nota de processo:** pedi push da E01-S70 e o usuário negou o `git push` (permissão do harness) —
perguntei como seguir e Lucas escolheu "não pushar ainda, só commitar local". Continuei
implementando e commitando localmente (E01-S70 → `c37c4f4`, E01-S63 → commit desta entrada) sem
push, aguardando liberação.

**Próximo passo:** commitar E01-S63 (local). Depois seguir pra E01-S64 (reserva por
período, depende de S63 ✓ agora disponível) → E01-S65 (cadastro rico, independente) → E01-S66 (kits,
depende de S63 ✓) → E01-S69 (OS editável) → E01-S72 (horas) → E01-S73 (inspeções, arquitetural —
precisa design.md) → E01-S74 (serviço Auvo). Tudo local até Lucas liberar push; todas na mesma
branch/PR #52 quando liberar, um commit por story.

---

**Atualização anterior:** 2026-07-14 (sessão Lucas/Sonnet 5) — **E01-S70 (abas ricas do Auvo) implementada
localmente, todos os gates Node verdes.** Segue E01-S68 (`e9f58ec`) e E01-S71 (`7e84430`), ambas já
pushadas pro PR #52. Ainda não commitada.

- `pcm-auvo-tasks-import/index.ts`: `AuvoTask` ganha `questionnaires`/`keyWords`/
  `keyWordsDescriptions`/`timeControl`/`financialCategory`; `montarDetalhes` captura tudo (nova
  função pura `achatarQuestionarios` achata `questionnaires[].answers[]` em lista
  pergunta/resposta/data). 5 testes Deno novos.
- `DetalhesTarefaAuvo.tsx` (novo, `components/`): extraído da função interna de
  `OrdensServicoPage.tsx` (~150 linhas removidas de lá), agora com 7 abas (Relato, Anexos/Fotos,
  Questionários, Equipamentos, Pendências, Horas, Valores). Fotos renderizam `<img>` de verdade
  (grid de thumbnail, `onError` cai pra link — payload real de `attachments[]` não está documentado
  no repo, extração de URL tenta várias chaves comuns, a confirmar contra dado real). Questionários
  mostra pergunta→resposta→data, não mais contagem. Produtos/serviços/custos agora é LISTA
  (`descreverItem`), não contagem.
- **Aba Equipamentos ficou com estado vazio fixo, decisão consciente:** `pcm.os_equipamentos_auvo`
  (E01-S16) só é populada pelo webhook e nunca foi exposta ao frontend — wire completo seria escopo
  maior que o resto da story; registrado pra story futura se Lucas confirmar prioridade.
- Domain `ordens-servico.ts` **não** ganhou interface estrita pra `questionarios`/`palavrasChave`/
  `controleHoras` — decisão consciente de manter `detalhes: Record<string, unknown>` genérico (jsonb
  solto desde E01-S38); o componente de apresentação faz o cast pontual só onde precisa.

Gates rodados e verdes: `biome check --write .`, `typecheck`, `test` (296 passando), `build`,
`arch:check`, `check:edge-functions`, `audit:esteira`, `eval:spec`, `validate-mermaid`. Deno CLI
ausente — os 5 testes novos de `montarDetalhes`/`achatarQuestionarios` rodam no CI.

**Não verificado (sem Playwright/browser tool neste ambiente):** as 7 abas renderizando de verdade
no browser. `questionarios`/fotos só populam em OS re-sincronizadas após o próximo pull (cron ou
re-sync manual, mesma dependência da E01-S68/S71).

**Próximo passo:** commitar E01-S70, seguir pra E01-S63..S66 (Ferramentas, specs já prontas) →
E01-S69 (OS editável) → E01-S72 (horas) → E01-S73 (inspeções) → E01-S74 (serviço Auvo), tudo na
mesma branch/PR #52, um commit por story.

---

**Atualização anterior:** 2026-07-14 (sessão Lucas/Sonnet 5) — **E01-S71 (imagem/anexos de equipamentos)
implementada localmente, todos os gates Node verdes.** Segue a E01-S68 (fix crítico de sync, já
commitada como `e9f58ec` e pushada pro PR #52).

- Migration `0085_E01-S71_equipamentos_imagem.sql`: `pcm.equipamentos` ganha `url_imagem text` e
  `uri_anexos jsonb default '[]'` (aditivo, sem RLS/grant novo).
- `registry/equipamentos.ts`: `AuvoEquipment` ganha `urlImage`/`uriAnexos` (confirmado contra a API
  real 2026-07-14); `fromAuvo` mapeia pra `url_imagem`/`uri_anexos`. 3 testes Deno novos/ajustados.
- UI: `EquipamentosPage.tsx` (card com thumbnail 14×14, lightbox ao clicar, placeholder `Wrench`
  quando ausente) e `PainelEquipamentos.tsx` (usado no cliente-360, miniatura 8×8) — ambos leem da
  mesma tabela `pcm.equipamentos`. `EquipamentoItem` (domain), `EquipamentoResumo`
  (`cliente-360-gateway.ts`) e os 2 adapters (`supabase-equipamentos-adapter.ts`,
  `supabase-cliente-360-adapter.ts`) expõem os novos campos.

Gates rodados e verdes: `biome check --write .` (1 fix de formatação aplicado), `typecheck`,
`test` (296 passando), `build`, `arch:check`, `lint:migrations`, `check:edge-functions`,
`audit:esteira`, `eval:spec`, `validate-mermaid`. Deno CLI ausente — teste do `fromAuvo` roda no CI.
**Nota operacional:** `pnpm exec biome` (via wrapper) deu OOM repetido nesta sessão por pressão de
memória do host (SO com ~100-300MB livres, CapCut consumindo CPU); rodar o binário direto
(`./node_modules/.bin/biome`) contornou — sem relação com o código desta story.

**Não verificado (sem Playwright/browser tool neste ambiente):** renderização visual do thumbnail/
lightbox no browser. `url_imagem` só populará em produção após o próximo pull de equipamentos do
Auvo (cron horário ou re-sync manual) — hoje a coluna existe mas está vazia pra todo mundo.

**Próximo passo:** commitar E01-S71, seguir pra E01-S70 (abas ricas do Auvo) → E01-S63..S66
(Ferramentas, specs já prontas) → E01-S69 (OS editável) → E01-S72 (horas) → E01-S73 (inspeções) →
E01-S74 (serviço Auvo), tudo na mesma branch/PR #52, um commit por story. E01-S68 segue com tasks
6-8 pendentes (deploy + backfill + verificação em produção), bloqueadas em paralelo por Lucas
confirmar se o Auvo assina webhook (`AUVO_WEBHOOK_SECRET`).

---

**Atualização anterior:** 2026-07-14 (sessão Lucas/Sonnet 5) — **E01-S68 (fix crítico de sync)
implementada localmente — as 3 causas corrigidas no código.** PR #52 aberto
(`feat/E01-S68-fix-sync-tarefas`), commit `e9f58ec` pushado.

- `_shared/auvo/datetime.ts` (novo): `auvoNaiveToUtc` trata datetime naive do Auvo como Brasília
  (-03:00). Aplicado no import (`pcm-auvo-tasks-import`) e no webhook (`firstIsoString`).
- `pcm-auvo-tasks-import`: cursor da E01-S67 removido, `calcularJanelaRolante` pura no lugar
  (-21d/+60d a partir de "agora", nunca depende do banco).
- `pcm-auvo-webhooks-register`: reescrito — deleta webhook com URL divergente, registra o que
  falta (incluindo **Task**, entity=4, hardcoded — não tem descriptor no registry genérico, valor
  documentado em `registry/types.ts`). **Achado bônus:** o contrato real de `GET /webHooks` não
  batia com o código — campo é `urlResponse` (não `targetUrl`), `entity` vem como string tipo
  `"Customer"` (não o número do nosso registry) — corrigido, com funções puras testáveis extraídas.

Gates Node verdes (typecheck, build, arch:check, check:edge-functions, audit:esteira). Deno CLI
ausente — testes escritos (datetime 6 casos, tasks-import janela rolante, webhooks-register 9
casos), não executados aqui, rodam no CI.

**Pendente (não codificável, depende de deploy):** rodar `pcm-auvo-webhooks-register` em produção
uma vez; backfill do histórico (datas 3h erradas); verificação real (OS de hoje aparecem, horário
correto). Lucas está ajustando o lado Auvo manualmente em paralelo (perguntou sobre campo de
"chave secreta"/assinatura na tela de webhook do Auvo — `AUVO_WEBHOOK_SECRET` não está configurado
nem localmente, e os 6 webhooks mostravam `hasAuthorization:false`; se o Auvo não assinar,
`pcm-auvo-webhook` vai rejeitar tudo com 401 mesmo com a URL certa — aguardando resposta dele sobre
esse campo antes de decidir se ajusta o código pra aceitar sem assinatura).

---

**Atualização anterior:** 2026-07-14 (sessão Lucas/Opus 4.8) — **PR #51 mergeado; teste de produção achou 9
problemas; diagnóstico + 7 specs de correção (E01-S68..S74) criadas, prontas pra Sonnet 5
implementar.** Só artefatos SDD — nenhum código de feature nesta sessão.

Lucas mergeou o PR #51 (E01-S62/S67 + specs E04/Ferramentas + Guia do SO) e testou em produção.
Diagnóstico com queries read-only (produção `nudannsrfvjggoergvyn`) + API Auvo real + 3 Explore
agents. **Achados críticos:**
- **#1 OS de hoje não aparecem — 2 causas:** (a) os 6 webhooks Auvo apontam pro projeto Supabase
  **antigo** (`sfprfvltby…`, não `nudann…`) → tempo real morto desde o reprovisionamento; (b) o
  cursor `MAX(data_agendada)` da E01-S67 pula pro futuro (preventiva agendada 22/07) e exclui as
  tarefas de hoje. Regressão minha da E01-S67. `tasks-import` puxou só 1 tarefa na última run.
- **#2 timezone:** Auvo devolve datetime naive Brasília (`08:00`), gravamos como UTC nos 2 caminhos
  (import verbatim; webhook `new Date().toISOString()` com TZ=UTC) → −3h em data_agendada/check-in/out.
- **#7 questionários VÊM no GET /tasks** (confirmado na API), só não capturamos; `DetalhesTarefaAuvo`
  existe mas preso na página de OS e mostra produtos/anexos só como contagem, sem fotos.
- **#9 equipamento tem `urlImage`/`uriAnexos`** no Auvo, descriptor/tabela não capturam.
- **#3/#4** OS não abre/edita no Kanban/Backlog (só status). **#5** inspeção não edita, schema
  enxuto sem parametrização/Storage. **#6** serviço tem infra outbound mas `writeEnabled:false`.
- **#8** sem endpoint Auvo de horas, mas check-in/out/duração vêm no GET /tasks (derivável).

**Decisões do PO (2026-07-14):** inspeções adotam Supabase Storage agora; reconstruir inspeção
(ABNT NBR 16747); tela de admin de templates de checklist já; **fixes de sync primeiro** na
implementação.

**Criadas 7 stories (specs/E01-S68..S74/):** S68 fix sync (webhook+cursor+timezone, prioridade
máxima), S69 OS clicável/editável, S70 abas ricas do Auvo (questionários/fotos), S71 imagem de
equipamentos, S72 apontamento de horas+custo, S73 inspeções ABNT NBR 16747 (arquitetural,
product+design), S74 serviço→Auvo. ROADMAP atualizado (S62/S67 marcadas mergeadas PR #51; nota que
o cursor S67 foi superseded por S68). Glossário +3 termos (ABNT NBR 16747, Apontamento de horas,
Template de checklist / Tipo de Inspeção). Gates de artefato verdes: `audit:esteira` 350 docs,
`eval:spec`.

**Handoff para Sonnet 5** (Lucas troca o modelo): (1) commit/push das specs + PR; (2) implementar
na ordem — **E01-S68 primeiro** (crítico), depois S71/S70, S63-S66 (Ferramentas, specs já existem),
S69/S72, S73/S74. Detalhes técnicos com âncoras file:line em cada `spec.md`/`tasks.md` e no plano
`~/.claude/plans/preciso-que-fa-a-o-toasty-hellman.md`. Nada commitado ainda (regra: commit só
quando pedido; Lucas pediu commit/push via Sonnet).

---

**Atualização anterior:** 2026-07-13 (sessão Lucas/Claude) — **Rotação do próprio STATE.md** (este
arquivo tinha crescido pra 1860 linhas/41 sessões acumuladas desde o início do projeto,
`alwaysApply: true`, carregado inteiro em toda sessão nova — Lucas sinalizou que estava difícil
de achar informação). Histórico movido pra `docs/state-historico/` em 2 arquivos por período (ver
índice); a skill `/handoff` ganhou uma regra de rotação (abaixo) pra isso não voltar a acontecer.

**Resto da sessão (2026-07-13), com detalhe:**

**1. Épico E04 Financeiro especificado por completo** (6 stories, `specs/E04-S01..S06/`, product+
design+domain+spec+tasks na S01, spec+tasks nas demais — auto-contidas, feitas pra outra
sessão/LLM implementar sem depender desta conversa). Pedido original: entrada/saída, classificação
de gastos, import OFX, ganho por cliente (horas × valor recebido), gráficos, visão de dono. Perguntei
4 decisões ao Lucas antes de especificar (todas registradas em `product.md`): **caixa primeiro**
(lançamentos+OFX+dashboard antes de receber/rentabilidade); **custo/hora por funcionário** (custo
mensal cadastrado ÷ horas-base, não taxa única nem por cargo); **receita = contrato mensal
cadastrado + entradas avulsas** por cliente; **previsto + realizado no V1** (vencimentos, alertas
D+3/7/15, projeção 30/60/90). `design.md` fecha 6 decisões técnicas: parser OFX próprio
client-side (sem lib — OFX é SGML/XML, arquivo pequeno), gráficos SVG próprios (sem lib nova, repo
não tem nenhuma), RPCs `security invoker` pra agregação (nunca baixar tabela inteira pro browser,
antipadrão já eliminado na E01-S44), recorrência via RPC idempotente + pg_cron + botão manual,
contratos nascem no Financeiro até o módulo Comercial (E03) existir, zero Edge Function nova (tudo
supabase-js + RPC SQL). Depois criei um **protótipo navegável** (Artifact HTML, dados fictícios,
sem banco/backend) com as 10 telas do módulo pra Lucas/Fabrício/Aline visualizarem e darem ideia
antes de qualquer linha de código real — link enviado na resposta daquele turno.

**2. Evolução de Ferramentas especificada** (E01-S63–S66), a partir de 5 pontos de feedback do
Fabrício testando o PCM: histórico de quem ficou com cada ferramenta + atribuição por código
(hoje impossível — `pcm.ferramenta_alocacoes`, migration `0033`, é um snapshot agregado por tipo,
sobrescrito a cada sync do Auvo via `fn_reconcile_ferramenta_alocacoes`; não existe unidade física
individual nem no PCM nem no Auvo); reserva por data/período; cadastro mais fácil com imagem;
criação de kits; "evoluir muito essa parte, está rasa". 3 decisões do PO antes de especificar:
**código de unidade gerado pelo PCM** (não existe patrimônio físico prévio pra reaproveitar);
**PCM vira dono da posse/histórico** (o agregado do Auvo passa a ser só alerta de divergência, não
sobrescreve mais o histórico); **sem Supabase Storage agora** pra imagem — verifiquei contra a API
real do Auvo (`GET /products`) e o campo `imageUrl`/`uriAttachments`/`code` já existe no contrato
de leitura (hoje vazio nas ferramentas cadastradas); escrita não confirmada, vira task 1 da S65.
`E01-S63` (fundação: `ferramenta_unidades` + `ferramenta_movimentacoes` append-only) → `E01-S64`
(reserva, depende de S63) → `E01-S65` (cadastro rico, independente) → `E01-S66` (kits, conceito
PCM-only — Auvo não tem bundle/kit em nenhum endpoint auditado, cada item do kit continua sendo
seu próprio produto sincronizado individualmente).

**3. Bug real diagnosticado e corrigido em produção (E01-S62):** Lucas reportou que cadastrou OS
no Auvo e o botão "Sincronizar Auvo" não trouxe. Diagnostiquei contra produção (leitura):
`pcm.auvo_entity_status` mostrava os pulls terminando 18:58 UTC e `tickets` só às 19:00:27; API
real confirmou 31 tarefas na janela do dia, zero viraram OS. Causa raiz: `pull:tickets` usa janela
fixa de 180 dias passado + 60 dias futuro (~24 páginas do Auvo), leva ~150s — o `Promise.all` dos
pulls em `runSyncAll` esperava por ele inteiro antes de chamar `tasks-import`, estourando o
`WORKER_RESOURCE_LIMIT` (150s) do próprio worker do `sync-all`. Fix em
`supabase/functions/pcm-auvo-sync-all/index.ts`: `pull:clientes` roda sozinho primeiro (é a única
dependência real do `tasks-import`, resolução de cliente em lote); todo o resto — demais pulls,
tasks-import, deleted-tasks, gps, support — roda em paralelo com **orçamento de tempo por etapa**
(`AbortController`+timeout em `makeSupabaseCaller`); etapa que estoura vira falha isolada e
nomeada no resultado agregado, nunca mais trava as demais até o teto do worker. `tasks-import`
ganhou 90s de orçamento próprio (chega sempre, mesmo se `tickets` estourar). Testes reescritos em
`index.test.ts` (ordem clientes-primeiro, orçamento por etapa, abort real com fetch stub).

**4. Melhoria de sync por ideia do Lucas, mesmo dia (E01-S67):** ele propôs — cron/pull deveriam
consultar a última data de dado já sincronizado e puxar só dali pra frente (o passado já
sincronizado é mantido pelo webhook em tempo real, não precisa reprocessar); tudo em lote (já
era); sync roda em background com progresso visível, sobrevivendo a sair da página; cron pode
subir de diário pra horário se o custo permitir. Especifiquei (`specs/E01-S67-sync-incremental-
background/`, tier arquitetural por mudar o motor de sync já em produção com dado real) e
implementei de ponta a ponta:
   - **Cursor incremental em `pcm-auvo-tasks-import`:** `StartDate = MAX(data_agendada)` das OS já
     sincronizadas do Auvo, menos 3 dias de overlap de segurança (cobre tarefa retroagendada/
     lançada com atraso pelo técnico). Fallback pra janela fixa antiga (-14 dias) só no bootstrap
     (tabela vazia). Função pura `calcularInicioJanelaDeCursor` — 3 casos de teste Deno escritos.
   - **`tickets` NÃO ganhou cursor** — decisão consciente, não esquecimento: `pcm.tickets` só
     guarda `auvo_synced_at` (metadado de QUANDO NÓS sincronizamos), não a data do ticket em si no
     Auvo. Usar esse campo como `StartDate` filtraria "desde quando sincronizamos" em vez de
     "desde quando o ticket aconteceu" — mesmo tipo de erro de contrato-não-verificado que já
     causou bug real neste projeto (`taskID` vs `id`, E01-S34). Fica registrado como próximo passo
     em `product.md`; o orçamento de tempo do fix E01-S62 continua sendo a mitigação pra `tickets`.
   - **Botão "Sincronizar Auvo" responde imediato:** migration `0084` cria `pcm.auvo_sync_runs`
     (RLS FORCE, leitura por módulo PCM, escrita só service_role) e sobe o cron de `tasks-import`
     de `0 5 * * *` (diário) pra `0 * * * *` (horário) — seguro agora que cada rodada ficou barata.
     `pcm-auvo-sync-all` cria a run, responde 202 com `{runId}` e continua via
     `EdgeRuntime.waitUntil` (mesmo padrão já usado em `pcm-whatsapp-webhook`) — sair da página não
     mata mais o sync no meio (antes, o fetch síncrono do browser ERA o lifecycle da requisição).
   - **UI com polling:** `sincronizar-auvo-gateway.ts` ganhou `iniciar`/`consultarRun`/
     `buscarUltimaRun`; `PcmDashboardPage.tsx` faz polling de 3s em `auvo_sync_runs` (select direto
     sob RLS, sem função nova) e, ao montar, retoma o acompanhamento se já houver uma run
     `running` há menos de 10 min (`deveRetomarAcompanhamento`, pura, 6 casos testados incluindo a
     borda exata dos 10 min e o caso de run "travada" que não deve retomar).

**5. `docs/Apontamentos/Apontamentos-Fabricio-Aline.md` criado** — Lucas pediu um lugar pro
Fabrício e a Aline documentarem pontos achados testando o sistema, sem ser exaustivo. Template:
bloco copiável (data/quem/tipo/o que encontrei/imagem), 1 exemplo pra guiar. Prints vão na mesma
pasta `docs/Apontamentos/`, referenciados pelo nome do arquivo no texto.

**Gates Node verdes:** `lint:migrations` (84), `typecheck`, `test` (296 pass/9 skip),
`build`, `check:edge-functions`, `arch:check`, `audit:esteira`, `eval:spec`. Biome full-tree deu
OOM (mesmo problema de ambiente de sempre, não é o código).

**Pendências reais, não codificáveis aqui:** Deno CLI ausente — testes do cursor incremental
escritos, não executados; pgTAP de `auvo_sync_runs` não escrito ainda; validação manual em browser
autenticado (sync, drag-and-drop do Kanban da E01-S61) não feita; arquivo OFX real do banco pra
fixture da E04-S02 — pedir ao Lucas; confirmar chaves de `auvo_detalhes` antes da E04-S06.

Nada commitado (aguardando pedido explícito, regra permanente). **Próximo passo para outra
sessão/LLM:** marcar owner das stories especificadas hoje (E04-S01, E01-S63, E01-S62/S67 — estas
duas últimas já implementadas, prontas pra revisão/push) no ROADMAP e seguir os `tasks.md`.

## Bloqueios abertos
> Só os que seguem sem sinal de resolução até esta sessão. Bloqueios antigos (pré-07/11), muitos
> já resolvidos, ficaram no arquivo histórico — não repetidos aqui pra não arriscar informação
> stale.
- [ ] **`.claude/skills/revisao-adversarial/SKILL.md` nunca foi criada** — referenciada em
  `AGENTS.md`/`Definition-of-Done.md` desde 2026-07-02, conteúdo nunca materializado como skill de
  verdade (não aparece na lista de skills disponíveis desta sessão). Quem destrava: Lucas, com
  pedido direto.
- [ ] **Rotacionar o JWT secret legado do projeto Supabase** — exposto sem querer num diagnóstico
  de sessão em 2026-07-02. Não catastrófico, mas é boa prática. Quem destrava: @devops/Lucas.
