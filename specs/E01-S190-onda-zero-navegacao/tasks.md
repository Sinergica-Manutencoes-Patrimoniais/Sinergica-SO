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
| 6 | Migration aditiva: tipo de Inspeção `diagnostico_inicial_cliente` + classificação dos Assessments existentes | AC-1 | — | `npx supabase@2.114.0 test db supabase/tests/E01-S190_*.test.sql` | todo — **tier arquitetural**: toca classificação de dado em produção, exige ADR + `/revisao-adversarial` antes de existir. Fatia seguinte. |
| 7 | Migration aditiva: `modalidade='pmoc'` no Plano de Manutenção + visão filtrada | AC-2 | — | pgTAP da task 6 | todo — mesmo motivo da task 6 |
| 8 | pgTAP: identidade, histórico e evidência preservados na classificação (permitido e negado, RLS FORCE) | AC-1, AC-2 | 6, 7 | `npx supabase@2.114.0 test db supabase/tests/E01-S190_*.test.sql` | todo — depende de 6 e 7 |
| 9 | Retirar Assessment e PMOC do menu; Inspeções e Planos passam a contê-los | AC-1, AC-2, AC-4 | 4, 6, 7 | `cd apps/web && pnpm vitest run src/app` | todo — tirá-los do menu **antes** da classificação deixaria os registros sem porta de entrada (AC-7). Continuam em Trabalho · ROTINA. |
| 10 | Absorver Agenda do Técnico em "Planejamento e Visitas"; unificar Ferramentas em "Equipes e Recursos" | AC-4 | 4 | inventário antes/depois sem perda | **done** |
| 11 | `PesquisaGlobalEstrutura.tsx` — resultado identifica o tipo de cada entidade | AC-9 | 4 | `cd apps/web && pnpm vitest run src/features/pcm/interfaces/estrutura` | todo — fatia seguinte |
| 12 | Jornada Visão 360 → Área → Local → Sistema → Equipamento → Componente/Grupo, cada nível na tela da sua entidade | AC-10 | 11 | teste de componente da jornada | todo — fatia seguinte |
| 13 | Catálogos administrativos (tipos, categorias, segmentos, palavras-chave) para Administração, com guarda de rota | AC-5, AC-6 | 4 | `cd apps/web && pnpm vitest run src/app` + acesso por URL negado | **done** |
| 14 | Glossário: "Diagnóstico Inicial do Cliente" e "PMOC (modalidade)" — já escritos em 17/11; conferir sinônimo histórico | AC-8 | 6, 7 | revisão humana | todo — **a premissa da linha não se confirma** (ver Achados) |
| 15 | Inventário DEPOIS + diff no corpo do PR; qualquer ação sumida vira decisão registrada | AC-7 | 9–13 | `diff /tmp/nav-antes.txt /tmp/nav-depois.txt` anexado ao PR | **done** para a fatia de front (ver Diff de alcance) |
| 16 | `/revisao-adversarial` — tier arquitetural por tocar classificação de dado em produção | — | 8, 15 | achado reproduzido vira teste | todo — só faz sentido com 6–8 existindo |

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
   o que o AC-7 proíbe.
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

- **Task 14 parte de uma premissa falsa.** A linha diz que os termos "já [foram] escritos em
  17/11" no glossário. `docs/glossary.md` **não tem** "Diagnóstico Inicial do Cliente", e a entrada
  **PMOC** ainda o define como "Sub-módulo do PCM no Sinérgica SO" — exatamente o que a resposta 26
  do Fabrício desfaz ("não mantém módulo nem cadastro independentes"). O glossário continua
  descrevendo o mundo anterior à decisão. Corrigir junto com as tasks 6–7, no mesmo PR delas (AC-8).
- **O `plan.md` coloca "Central de Pendências" entre as áreas de Trabalho**, mas não existe view de
  pendências no front (`PcmView` não tem nenhuma). A área entra quando `E01-S197` existir; não foi
  criada entrada vazia de menu.

## Definition of Done

- Menu do Operador PCM cabe sem rolagem e nenhuma entrada é catálogo administrativo (SC-001).
- Nenhum Assessment ou PMOC perde identidade, histórico ou evidência (SC-002).
- Toda rota antiga responde redirecionada, nunca quebrada (SC-003).
- Diff de ações alcançáveis por perfil sem perda não decidida (SC-004).
- **Nenhuma tabela de estrutura fundida** — conferido no diff de migration.
- CI verde, `db-tests` não pulado.
