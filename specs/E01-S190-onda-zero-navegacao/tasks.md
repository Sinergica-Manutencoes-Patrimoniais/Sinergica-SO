---
name: tasks
description: Decomposição e gates de E01-S190. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E01-S190 · Onda Zero, navegação consolidada

Detalhe técnico em `plan.md`. Desbloqueada em 17/11/2026 pelas respostas 26/27 do Fabrício.

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | `scripts/inventariar-navegacao.mjs` — ações alcançáveis por perfil (linha de base ANTES) | AC-7 | — | `node scripts/inventariar-navegacao.mjs > /tmp/nav-antes.txt` | **done** |
| 2 | Extrair a árvore de `HomePage.tsx` para `navegacao-sso.ts` **sem mudar rótulo nenhum** | — | — | `cd apps/web && pnpm vitest run src/app/navegacao-sso.test.ts` + inventário idêntico ao da task 1 | **done** — inventário byte a byte idêntico |
| 3 | `navegacaoVisivel` pura — ocultar por permissão/capacidade, nunca lista fixa por papel | AC-6 | 2 | `cd apps/web && pnpm vitest run src/app/navegacao-sso.test.ts` | **done** |
| 4 | Reorganizar em Trabalho / Gestão / Administração conforme a tabela do `plan.md` | AC-4, AC-5 | 3 | `cd apps/web && pnpm vitest run src/app` | **done** — atrás de `VITE_SSO_NAVEGACAO_POR_FUNCAO_ENABLED`, desligada |
| 5 | `rotas-legadas.ts` + teste de tabela cobrindo toda view do inventário | AC-3 | 2 | `cd apps/web && pnpm vitest run src/app/rotas-legadas.test.ts` | **done** |
| 6 | Migration aditiva: tipo de Inspeção `diagnostico_inicial_cliente` + classificação dos Assessments existentes | AC-1 | — | `npx supabase@2.114.0 test db supabase/tests/E01-S190_*.test.sql` | **done** — `1868_E01-S190_diagnostico_inicial_cliente.sql`, ADR-1697 |
| 7 | Migration aditiva: `modalidade='pmoc'` no Plano de Manutenção + visão filtrada | AC-2 | — | pgTAP da task 6 | **parcial** — `1869_E01-S190_modalidade_pmoc_plano.sql`: coluna, CHECK, view `pcm.planos_pmoc` e classificação dos Planos já declarados PMOC. Converter `pcm.pmoc_contracts` em Plano **não foi feito** — ver Achados |
| 8 | pgTAP: identidade, histórico e evidência preservados na classificação (permitido e negado, RLS FORCE) | AC-1, AC-2 | 6, 7 | `npx supabase@2.114.0 test db supabase/tests/E01-S190_*.test.sql` | **done** — 35/35 em `E01-S190_classificacao_diagnostico_e_pmoc.test.sql` |
| 9 | Retirar Assessment e PMOC do menu; Inspeções e Planos passam a contê-los | AC-1, AC-2, AC-4 | 4, 6, 7 | `cd apps/web && pnpm vitest run src/app` | **parcial** — Assessment saiu das duas árvores (flag `VITE_SSO_ASSESSMENT_COMO_INSPECAO_ENABLED`, `false`); **PMOC continua**, ver Achados |
| 10 | Absorver Agenda do Técnico em "Planejamento e Visitas"; unificar Ferramentas em "Equipes e Recursos" | AC-4 | 4 | inventário antes/depois sem perda | **done** |
| 11 | `PesquisaGlobalEstrutura.tsx` — resultado identifica o tipo de cada entidade | AC-9 | 4 | `cd apps/web && pnpm vitest run src/features/pcm/interfaces/estrutura` | todo — fatia seguinte |
| 12 | Jornada Visão 360 → Área → Local → Sistema → Equipamento → Componente/Grupo, cada nível na tela da sua entidade | AC-10 | 11 | teste de componente da jornada | todo — fatia seguinte |
| 13 | Catálogos administrativos (tipos, categorias, segmentos, palavras-chave) para Administração, com guarda de rota | AC-5, AC-6 | 4 | `cd apps/web && pnpm vitest run src/app` + acesso por URL negado | **done** |
| 14 | Glossário: "Diagnóstico Inicial do Cliente" e "PMOC (modalidade)" — já escritos em 17/11; conferir sinônimo histórico | AC-8 | 6, 7 | revisão humana | **done** — entrada **PMOC** da tabela principal corrigida (não é mais "sub-módulo") e **Assessment** criada como sinônimo histórico |
| 15 | Inventário DEPOIS + diff no corpo do PR; qualquer ação sumida vira decisão registrada | AC-7 | 9–13 | `diff /tmp/nav-antes.txt /tmp/nav-depois.txt` anexado ao PR | **done** para a fatia de front (ver Diff de alcance) |
| 16 | `/revisao-adversarial` — tier arquitetural por tocar classificação de dado em produção | — | 8, 15 | achado reproduzido vira teste | **done** — 3 achados, todos reproduzidos e travados em teste (28–32) |

## Fatia entregue (front, reversível) — 2026-11-24

Só a parte de navegação, que não toca dado de produção. Tudo atrás de
`VITE_SSO_NAVEGACAO_POR_FUNCAO_ENABLED` (declarada em `.env.example` e `netlify.toml` com `false`
explícito): **com a flag desligada a navegação é exatamente a de hoje**, e o inventário prova.

Arquivos: `scripts/inventariar-navegacao.mjs`, `apps/web/src/app/navegacao-sso.ts`,
`apps/web/src/app/rotas-legadas.ts`, os dois testes ao lado deles, e `HomePage.tsx` (que passou a
consumir a árvore em vez de declará-la).

### Diff de alcance (AC-7)

`node scripts/inventariar-navegacao.mjs` antes × depois: **idêntico**, byte a byte — a extração da
task 2 não mexeu em rótulo nenhum.

`--nova` (árvore ligada) × vigente, só as entradas do PCM:

| Perfil simulado | Vigente | Nova | Mudança |
|---|---|---|---|
| superadmin · supervisor · operador-pcm (pcm escrita) | 27 | 27 | nenhuma perda; 2 renomeações |
| pcm-leitura (pcm só leitura) | 27 | 19 | −8 entradas de Administração (**decisão**, AC-5) |
| financeiro · cliente-síndico | 0 | 0 | sem acesso a PCM nos dois casos |

Renomeações deliberadas, conforme a tabela do `plan.md`: "Agenda do Técnico" → **"Planejamento e
Visitas"** (mesma view, `agenda-tecnico`) e "Relatório" → **"Relatório de Planejamento"** (mesma
view, `relatorio-planejamento`, agora dentro da central de Relatórios).

As 8 entradas que somem para quem só tem leitura são exatamente os catálogos administrativos
(Tipos de Tarefa, Tipos de Inspeção, Categorias Equip., Segmentos, Palavras-chave, Grupos de
Clientes, Marcações de Cliente, Grupos de Usuário). É o AC-5 funcionando, não regressão — e o
acesso por URL direta a essas views também é barrado (`bloqueioDeAdministracao`), que é o AC
explícito do Fabrício ("rotas ocultas também são bloqueadas").

### Decisões registradas nesta fatia

1. **Assessment e PMOC continuam no menu.** Saem só com as tasks 6–8. Removê-los antes da
   classificação deixaria os registros existentes sem caminho de entrada — perda de alcance, que é
   o que o AC-7 proíbe. — *Superado para **Assessment** pela fatia de classificação, abaixo. Para
   **PMOC** continua valendo, agora com o motivo exato escrito (ADR-1697 §3).*
2. **Sistemas e Componentes continuam visíveis**, agora dentro do grupo "Clientes e Estrutura". O
   `plan.md` os tira do menu principal porque a jornada da Visão 360 passaria a alcançá-los; essa
   jornada é a task 12 e não está feita. Tirar agora é perder alcance.
3. **Administração autoriza por `podeAcessar('pcm','escrita')`, não por capacidade.**
   `config.sso_autorizar_acao(p_acao, p_cliente_id)` exige um cliente real (`join pcm.clientes`) e
   não responde "este usuário administra catálogos globais?". O campo `capacidade` já existe em
   `EntradaNav` e `navegacaoVisivel` já o respeita — quando `E00-S26` entregar a verificação sem
   cliente, a troca é de dado, não de código. **Não é lista fixa por papel**: é o nível resolvido
   pelo servidor em `config.minhas_permissoes`.
4. **`EntradaNav` ganhou `grupo`, `icone` e `exigeNivel`** além do desenho do `plan.md`. Sem
   `grupo`/`icone` a sidebar perderia subtítulo e ícone que já existem — regressão visual sem
   decisão. `exigeNivel` é o que torna a decisão 3 possível sem `if` por papel.
5. **Deep-link `?view=` só responde com a flag ligada.** Hoje nenhuma rota de PCM existe na URL, então
   não há favorito a proteger; ligar o deep-link com a flag desligada seria mudar a navegação de
   hoje, que é justamente o que a flag promete não fazer.

### Achados que contradizem a spec

- **Task 14 parte de uma premissa parcialmente falsa — corrigida.** Os termos "Diagnóstico Inicial
  do Cliente" e "PMOC (modalidade)" **existiam** na tabela do Pacote Consolidado (fim do
  `glossary.md`), mas a entrada **PMOC** da tabela principal ainda dizia "Sub-módulo do PCM no
  Sinérgica SO" — o contrário da resposta 26 — e não havia entrada **Assessment** nenhuma, então
  quem procurasse pelo termo antigo não achava nada. As duas foram corrigidas nesta fatia.
- **O `plan.md` coloca "Central de Pendências" entre as áreas de Trabalho**, mas não existe view de
  pendências no front (`PcmView` não tem nenhuma). A área entra quando `E01-S197` existir; não foi
  criada entrada vazia de menu.

## Fatia de classificação de dado (tasks 6–9, 14, 16) — 2026-11-24

Migrations `1868` e `1869`, pgTAP `E01-S190_classificacao_diagnostico_e_pmoc.test.sql` (35/35),
ADR-1697. Inventário completo das tabelas no `plan.md`.

### O que ficou pronto

- **Task 6 — completa.** Assessment nunca foi tabela: desde `0137_E01-S90` é uma linha de
  `pcm.inspecoes` com `e_assessment = true`, e o campo de tipo (`tipo_inspecao_id`, de `0091`) já
  existia e estava nulo. A classificação é literalmente preencher esse nulo — nenhum registro
  criado, movido ou apagado, identidade intacta, nenhum vínculo religado. Um trigger mantém a
  equivalência daí em diante, nos dois sentidos, e audita cada classificação.
- **Task 7 — parcial, com o motivo escrito.** A modalidade (`pcm.planos_manutencao.modalidade`),
  o CHECK, a visão filtrada (`pcm.planos_pmoc`, `security_invoker`) e a classificação dos Planos
  que o PCM **já declarou** PMOC estão feitos e testados.
- **Task 8 — completa.** 35 asserções, permitido e negado, RLS FORCE conferida nas 5 tabelas.
- **Task 9 — parcial.** Assessment saiu das duas árvores. PMOC não saiu.
- **Task 14 — completa.** Ver acima.

### O que NÃO foi feito, e a pergunta que falta

**`pcm.pmoc_contracts` existentes não viraram `pcm.planos_manutencao`.** Não há uma única FK entre
o schema PMOC (`0023_E01-S03`) e o Plano (`0260_E01-S165`); o PMOC é ancorado em
`pmoc_properties.client_id` e o Plano em `planos_manutencao.cliente_id`. Converter um Contrato
PMOC — com imóvel, ART, CREA, inventário de AR e 12 visitas emitidas — num Plano seria **criar
registro**, não classificar: exatamente o que o AC-2 proíbe ("mantendo rotinas, ocorrências geradas
e documentos emitidos") e o caminho para a fusão de entidades vetada pela resposta 27.

> **Pergunta para o Fabrício:** para um Contrato PMOC que já existe, o Plano de Manutenção
> correspondente deve ser **(a)** criado por migração de conteúdo, com uma Rotina por equipamento e
> tipo de visita; **(b)** criado pelo PCM manualmente, caso a caso, pelo fluxo de Plano que já
> existe; ou **(c)** não criado — o Contrato PMOC segue sendo a execução legal e o Plano o escopo
> contratual, ligados só por `pcm.sso_vinculos_ciclo_pmoc`?

Enquanto não houver resposta, **PMOC fica no menu**: tirá-lo deixaria imóveis, ARTs, laudos e
análises microbiológicas de produção sem porta de entrada (AC-7). Está travado por teste
(`navegacao-sso.test.ts`, "PMOC CONTINUA no menu, e isso é decisão registrada").

### Diff de alcance desta fatia (AC-7)

| Jornada | Antes | Depois (flag ligada) |
|---|---|---|
| Ver um Diagnóstico Inicial | menu "Assessment" | menu "Inspeções" (o adapter nunca filtrou `e_assessment`) |
| Criar um Diagnóstico Inicial | "Assessment → Novo" | "Inspeções → Nova", escolhendo o tipo; o trigger marca `e_assessment` |
| Importar questionário do Auvo | "Assessment" | botão "Diagnóstico Inicial do Cliente" dentro de Inspeções (`onAbrirDiagnosticoInicial`) |
| Favorito `?view=assessment` | abria Assessment | redireciona para Inspeções (`ROTAS_LEGADAS`) |
| PMOC | menu "PMOC" | **inalterado** |

Nenhuma ação sumiu. A única mudança de caminho é a importação do questionário, que trocou de
entrada de menu para botão dentro de Inspeções — decisão registrada, não perda.

### `/revisao-adversarial` — 3 achados, todos reproduzidos e travados em teste

1. **O reverso de `1868` apagaria escolha de gente.** O trigger grava evento em dois casos:
   preencheu o TIPO (`tipo_anterior` nulo) ou preencheu o MARCADOR de uma inspeção cujo tipo um
   humano escolheu na tela (`tipo_anterior` preenchido). Um reverso que varresse os eventos sem
   distinguir zeraria o tipo escolhido pela pessoa. Corrigido no cabeçalho com
   `(payload ->> 'tipo_anterior') is null`; testes 28, 30 e 31.
2. **A regra desfaz quem tenta desmarcar.** Com o tipo Diagnóstico Inicial presente, gravar
   `e_assessment = false` é revertido. É consequência de os dois campos serem o mesmo fato, mas
   vira comportamento nomeado e testado (teste 32) em vez de efeito colateral: para deixar de ser
   Diagnóstico Inicial muda-se o TIPO, que é o campo canônico desde esta story.
3. **O reverso não reverte se a ordem for trocada.** Zerar o tipo com o trigger de pé faz a regra
   repor a classificação na mesma transação. O cabeçalho já mandava derrubar o trigger primeiro;
   o teste 29 prova que a ordem é obrigatória, não estilo.

## Definition of Done

- Menu do Operador PCM cabe sem rolagem e nenhuma entrada é catálogo administrativo (SC-001).
- Nenhum Assessment ou PMOC perde identidade, histórico ou evidência (SC-002).
- Toda rota antiga responde redirecionada, nunca quebrada (SC-003).
- Diff de ações alcançáveis por perfil sem perda não decidida (SC-004).
- **Nenhuma tabela de estrutura fundida** — conferido no diff de migration.
- CI verde, `db-tests` não pulado.
