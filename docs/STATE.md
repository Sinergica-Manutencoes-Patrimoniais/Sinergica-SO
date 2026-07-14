---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Só a sessão mais recente fica aqui. Histórico completo, cronológico, em
> `docs/state-historico/` (índice: [INDEX.md](state-historico/INDEX.md)) — arquivado, não
> carregado por padrão. Regra de rotação em `.claude/skills/handoff/SKILL.md`.

**Atualização:** 2026-07-14 (sessão Lucas/Sonnet 5) — **E01-S71 (imagem/anexos de equipamentos)
implementada localmente, todos os gates Node verdes.** Segue a E01-S68 (fix crítico de sync, já
commitada como `e9f58ec` e pushada pro PR #52). Ainda não commitada.

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
