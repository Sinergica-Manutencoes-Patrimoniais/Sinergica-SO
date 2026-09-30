---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Só a sessão mais recente fica aqui. Histórico completo, cronológico, em
> `docs/state-historico/` (índice: [INDEX.md](state-historico/INDEX.md)) — arquivado, não
> carregado por padrão. Regra de rotação em `.claude/skills/handoff/SKILL.md`.

## 2026-09-29 — Specs da iniciativa "Cadastro de ativos v2" (E01-S154..S161) (Claude)

Lucas mandou o diagrama "Cliente: Guainumbí" (estrutura + Sistemas amarelos + Componentes
laranjas) e 6 regras. Comparei com o código de `main` e fechamos as decisões em conversa (não
precisa re-perguntar):
- **Componente** = nome de UI de `pcm.equipamentos`. "Equipamento" é o nome do Auvo. O código
  **não** é renomeado (ADR-0022).
- Componente em **no máximo 1** Sistema. O vínculo **não** vai ao Auvo; lá os dois são Equipment.
- Componente e Sistema em qualquer nível (Cliente/Área/Local). Cliente obrigatório no SO.
- Categoria = catálogo `equipamento_categorias` (já espelhado com o Auvo), mais as 6 novas
  (ELE/HID/TRV/CLI/SEG/PCI), que **convivem** com as atuais. Lucas higieniza depois.
- Sigla de **3** caracteres por bloco, sugerida automaticamente e editável. Identificador
  `GUA-TOA-A02-SHA-ELE-QDC-01`, só para itens **novos criados pelo SO**, **fixo** depois;
  alteração manual com aviso de QR Code. Número no fim do nome ("Ar Condicionado 01") vira o `NN`.
- Descrição no Auvo = nome completo. Ferramentas são da Sinérgica: na 360, só alocar/devolver.
- Visão em árvore na 360 (v1 lista recolhível; diagrama em caixas fica para depois).

**Artefatos (branch `docs/E01-S154-S161-cadastro-ativos`):** product + design compartilhados em
`specs/E01-S155-posicao-flexivel-ativos/`, ADR-0022, spec+tasks de S154..S161, planilha de exemplo
em `specs/E01-S161-importacao-excel-estrutura/exemplo-planilha.xlsx`, e as linhas no ROADMAP.
Specs escritas para o Sonnet executar: paths, migrations, nomes de trigger (a ordem alfabética
importa), mensagens literais e gates.

**Incidente de ambiente:** o checkout local estava corrompido (`.git` com 0 bytes, `supabase/` e
`specs/` vazios; Lucas tinha movido a pasta). Reclonado em `/Users/lucasazevedo/GitHub/Sinergica/Sinergica-SO`.
O antigo ficou em `Sinergica-SO.quebrado-2026-09-29`. A única diferença eram 2 linhas S154/S155 do
ROADMAP (2026-09-25), nunca pushadas e sem spec escrita, **substituídas** por esta iniciativa.

## 2026-09-30 — Onda 1 concluída localmente: E01-S154 + S155 + S156 (Codex)

- **E01-S156 completa, 11/11 tasks:** domínio de siglas, catálogo com `sigla`, `categoria_id`
  em Componentes/Sistemas, seletor com criação inline, tela de catálogo, adapters e hooks.
- Migrations `0219`/`0220` já estavam aplicadas: auditoria pela Management API confirmou 5
  colunas, 3 constraints validadas, 6 seeds e 2 triggers. Outbox confirma 6 creates de categoria
  e nenhum update de Componentes desde o início da onda.
- `pcm-auvo-push`, `pcm-auvo-pull`, `pcm-auvo-sync-all`, `pcm-auvo-webhook` e
  `pcm-auvo-webhooks-register` foram redeployadas pela Management API; todas respondem 401 sem
  credenciais, nunca 500. Vitest focado, Deno e typecheck verdes; pgTAP novo aguarda `db-tests`
  no CI, pois esta máquina não tem Docker.
- Próximo passo: CI e validação humana em browser; depois, **E01-S157** (onda 2).

## 2026-09-30 — Implementação Onda 1: E01-S154 + S155 (histórico)

Continuação da sessão de 2026-09-29 (acima). Lucas pediu pra implementar as 4 ondas ponta a ponta
(frontend+backend+banco). Decisões de processo tomadas nesta sessão:
- Branch **por onda** (não por story nem uma única): `feat/onda1-componente-posicao-categoria`
  cobre E01-S154+S155+S156, a partir de `docs/E01-S154-S161-cadastro-ativos`.
- Migrations e Edge Functions são **aplicadas de verdade** durante a implementação (não só
  escritas) — Lucas passou um `SUPABASE_ACCESS_TOKEN` (`sbp_...`) pra isso.
- **Sem `supabase` CLI** (Lucas não tem instalado / pediu pra não depender dele — ficava pedindo
  senha de banco e travava). Uso a **API de gerência do Supabase direto via `curl`**
  (`POST https://api.supabase.com/v1/projects/nudannsrfvjggoergvyn/database/query`, header
  `Authorization: Bearer <token>`) — é o mesmo backend que `supabase db query --linked` chama.
  Token vive só em `<scratchpad>/.sb-token` (fora do repo, nunca commitado) + helper
  `<scratchpad>/sbquery.sh`. Cada migration é smoke-testada com `begin; ...; rollback;` antes de
  aplicar de verdade (mesmo padrão já usado em E03-S05).
- **Sem Docker** nesta máquina — pgTAP é escrito (roda no CI `db-tests`) mas não executado local.
  **Sem `SUPABASE_TEST_EMAIL`/`PASSWORD`** — E2E é escrito e validado só por `playwright test
  --list` (parse/estrutura), não executado de ponta a ponta.

**Achado de ambiente, início da sessão:** o checkout local (`Sinergica-SO`) estava corrompido
(`.git` 0 bytes, `supabase/`/`specs/` vazios — Lucas tinha movido a pasta). Reclonado do zero em
`/Users/lucasazevedo/GitHub/Sinergica/Sinergica-SO`; o antigo virou
`Sinergica-SO.quebrado-2026-09-29` (não apagado). Único conteúdo que não estava no GitHub: as 2
linhas velhas de ROADMAP da E01-S154/S155 (2026-09-25), já substituídas pela iniciativa nova.

**E01-S154 (Componente + Sistema 1:N) — completa, 10/10 tasks:**
- Migration `0216` (índice único `sistema_itens(item_id)`) aplicada em produção — pré-checagem
  read-only confirmou 0 duplicatas antes. Achado de ambiente: `0211` existia no remoto mas não
  local (mismatch pré-existente) — resolvido com `migration repair --status reverted 0211` antes
  do primeiro push (só mexe na tabela de histórico, não em schema).
- `validarMembroSemOutroSistema` (domínio) + `SistemaItemOpcao.sistemaId/sistemaNome` (gateway) +
  `listarItensDisponiveis` resolvendo pertencimento atual (adapter) + seletor de composição
  desabilitando item de outro Sistema com "em «Nome»".
- Modal perde os campos Tipo/Equipamento pai (dado legado preservado, só some da UI).
- UI renomeada ponta a ponta pra "Componente" (nav, modal, Nova OS, badges, mensagens de erro,
  glossário) — exceções PMOC/laudos/Auvo tempo-real preservadas (ADR-0022).
- **SPEC_DEVIATION registrado** (em `specs/E01-S154-.../tasks.md`): o filtro "Equipamento/
  Componente" e os badges por item em `EquipamentosPage`/`BoardAtivos`/`DrawerDetalheAtivo` não
  estavam na spec e colidiriam com o nome novo da entidade — renomeados pra "Principal"/
  "Subcomponente (legado)".
- 506 testes de `features/pcm` verdes, `ci:local` (biome+tsc) verde. 8 commits.

**E01-S155 (posição flexível) — completa, 11/11 tasks:**
- Migrations `0217`/`0218` aplicadas em produção após smoke test transacional com rollback; nenhuma fez `UPDATE` em massa em `pcm.equipamentos`/`pcm.sistemas`/`pcm.equipamento_categorias` e não houve enqueue Auvo em massa.
- `SeletorPosicao` entra em Componente e Sistema; trocar cliente limpa Área/Local; o cliente do Componente não oferece mais "Sem vínculo". Painel da 360 e move no Board usam `atualizarPosicaoComponente`, portanto movem legado sem exigir os campos do cadastro completo.
- E2E de Componente só na Área e Sistema no Local foi escrito em `hierarquia-sistemas.spec.ts` e listado pelo Playwright; não executado sem `SUPABASE_TEST_EMAIL`/`SUPABASE_TEST_PASSWORD`. `tsc --noEmit`, testes do seletor/modal e suite PCM anterior verdes; pgTAP fica para CI (`db-tests`) porque não há Docker.
- Glossário ganhou Posição e Área efetiva; Instalação aponta para Posição. Sem SPEC_DEVIATION.

**Próximo passo histórico:** E01-S156 (categoria como catálogo) — concluída acima.

## Em andamento / próximo passo
- Iniciativa Cadastro de ativos v2 — **branch `feat/onda1-componente-posicao-categoria`** (local,
  não pushada ainda). Onda 1 (E01-S154/S155/S156) completa localmente. Próximo: validação CI e
  humana; depois **E01-S157**. S157 (onda 2) tem uma verificação real no Auvo (AC-10) que pode
  mandar parar.
- (Resolvido) As 3 branches da sessão de 2026-08-19 viraram os PRs #61, #62 e #63, todos mergeados.

## Bloqueios abertos
> Carregados da rotação desta sessão — confirmados como ainda abertos, não copiados às cegas.
- [ ] **`.claude/skills/revisao-adversarial/SKILL.md` nunca foi criada** — referenciada em
  `AGENTS.md`/`Definition-of-Done.md` desde 2026-07-02, conteúdo nunca materializado como skill de
  verdade. Quem destrava: Lucas, com pedido direto.
- [ ] **Rotacionar o JWT secret legado do projeto Supabase** — exposto sem querer num diagnóstico
  de sessão em 2026-07-02. Não catastrófico, mas é boa prática. Quem destrava: @devops/Lucas.
- [ ] **Lote visual E00-S14..S23 (S20 AC-4/5/6, S21, S23) sem navegador pra validar visualmente**
  — decisão de pular mantida por 2 sessões seguidas. Quem destrava: sessão com Playwright/
  `claude-in-chrome` disponível, ou revisão humana do Lucas.
- [ ] **`SUPABASE_TEST_EMAIL`/`SUPABASE_TEST_PASSWORD` ausentes em `.env.local` da raiz** —
  bloqueou verificação visual real em pelo menos 4 sessões seguidas agora (E00-S24, as 4 mudanças
  de 2026-08-19, e a Onda 1 de 2026-09-30). `e2e/auth.setup.ts` falha rápido sem eles. Quem
  destrava: Lucas, com as credenciais reais de teste — ou aceitar que verificação visual continua
  sendo feita só por ele, manualmente, depois do merge.
- [ ] **Docker não existe mais nesta máquina** (confirmado por Lucas, 2026-09-30) — todo pgTAP da
  Onda 1 em diante é escrito mas roda só no CI `db-tests`, nunca localmente. Não é regressão, é a
  realidade do ambiente agora; pare de tentar `supabase test db` local.
