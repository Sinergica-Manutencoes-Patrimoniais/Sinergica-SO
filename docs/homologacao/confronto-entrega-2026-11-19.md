---
name: confronto-entrega-2026-11-19
description: Confronto entre o Pacote Consolidado do Fabrício (v1.0, 13/11/2026) e o que foi efetivamente entregue e mesclado em main na rodada de 17-19/11/2026.
alwaysApply: false
---

# Confronto — Pacote Consolidado do Fabrício × entrega mesclada em `main`

**Fonte da regra:** `docs/Apontamentos/Pacote-Consolidado-SSO-2026-11-13.txt` (v1.0, 13/11/2026) e as
respostas 26/27 de 17/11.
**Diagnóstico anterior:** `docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md`.
**Objeto deste documento:** o que mudou entre aquele diagnóstico e `main` em 19/11/2026.

**Regra de precedência aplicada:** quando o pacote diverge de tela, story ou documento antigo,
prevalece o pacote. Anexos "Em validação" não autorizam implementação definitiva — e não foram
implementados.

---

## 1. Resumo executivo — leia isto primeiro

**17 Pull Requests mesclados em `main`** (PR #83, #84, #87, #88, #91 a #103), cobrindo 14 stories.

**O que isso significa e o que NÃO significa:**

| Afirmação | Verdadeiro? |
|---|---|
| O código das regras aprovadas está escrito, testado e em `main` | **Sim** |
| Migrations aplicam do zero sem conflito e a suíte pgTAP passa | **Sim**, depois da correção de 19/11 |
| O Fabrício consegue validar tudo na tela hoje | **Não** — ver §3 |
| Alguma regra aprovada foi implementada diferente do pacote | **Não**. Eram 7 itens parciais; 1 foi fechado em 19/11, restam 6 (§4) |
| A entrega estava pronta para ir ao ar como mesclada em 18/11 | **Não** — uma migration não aplicava; corrigido em 19/11 (§6) |
| Algum item "Em validação" foi implementado sem autorização | **Não** |

**Duas lacunas, em ordem de urgência.** A primeira é técnica e já corrigida: uma migration não
aplicava e travaria o deploy (§6) — é preciso conferir em que ponto o banco de produção parou. A
segunda é de processo: **nada está ligado.** O projeto usa três camadas de trava —
*gate* de banco, *flag* de build e *grant* de permissão — e todas nascem **fechadas por desenho**.
Nenhuma foi aberta nesta rodada, porque abrir é decisão operacional com sign-off humano, não
commit de desenvolvedor. O caderno de teste (`caderno-teste-fabricio-2026-11-19.md`) lista, item a
item, o que precisa ser aberto antes de cada validação.

---

## 2. Veredito por item do Backlog executável

Legenda: **Fechado** = regra implementada, testada e alcançável · **Pronto, não ativado** = código
e teste prontos, falta abrir gate/flag/grant · **Parcial** = parte da regra entregue, parte nomeada
como pendência · **Não entregue** = nada nesta rodada.

### P0 — correções estruturais

| BL | Regra aprovada | Veredito | Evidência na entrega | O que falta |
|---|---|---|---|---|
| **BL 001** Separar Chamado e OS (1:N) | Pronto, não ativado | Corte estrutural em `1842` (rodada anterior). Nesta rodada, `1861_E01-S194` estendeu `sso_criar_os_chamado` para aceitar Chamado em `'demanda'`, por cirurgia de texto sobre `pg_get_functiondef` — preserva os remendos de `1475`/`1499` (comprovado reproduzindo a regressão antes de corrigir). | `pcm.chamado_os_gate` **continua fechado** por decisão de `1842`. Criar a 2ª OS pela tela exige abrir a jornada `chamado-multiplas-os` (procedimento pronto, §3). |
| **BL 002** Corrigir o conceito de Backlog | **Parcial** | `1860_E01-S193`: `pcm.chamados` aceita `'demanda'`; nova `sso_liberar_escopo_backlog` (wrapper atômico sobre `0890`); 16 asserções pgTAP provando zero OS/Chamado no caminho Pendência→Backlog, liberação integral (AC-4) e parcial (AC-5), pendência não selecionada intacta. `PromoverComposicao.tsx` religado à função nova. | 3 tarefas declaradas **todo** no `tasks.md`: abrir os 6 gates, classificar o Backlog legado (`status='backlog'`) e a guarda que recusa escritor novo nesse status. `backlog` ainda consta em `STATUS_OS` no front. **Achado que exige decisão do Fabrício:** `chamado_os_gate` é compartilhado com BL 001 — abri-lo pelo Backlog reativa múltiplas OS em todo o sistema (`runbooks/backlog-aprovado-ativacao.md`). |
| **BL 003** Visita como fonte oficial | **Parcial** | `1858_E01-S192`: `pcm.operacao_itens` passa a carregar `ocorrencia_preventiva_id`; nova `sso_resolver_plano_origem_os`; o drawer da OS no Kanban exibe **"Plano de origem"**. Diagnóstico nomeado: a Agenda do Técnico não tem escritor a partir de Visita/OS — é tabela própria, não projeção. | **SPEC_DEVIATION registrado (AC-3):** "Agenda do Técnico mostra as OS vinculadas" não foi implementado — exige decidir quem escreve `pcm.agenda_tecnico` a partir da Visita. Story dedicada. Até lá, a evidência que o Fabrício relatou ("Agenda vazia com dezenas de Chamados na semana") **continua reproduzível**. |
| **BL 004** Gatilho único em T−24 | Pronto, não ativado | `1863_E01-S196`: ação `execucao.contingencia_auvo`, tabela `pcm.sso_contingencias_auvo`, RPCs de autorizar/registrar/listar. `pcm-auvo-open-task` passou a exigir a capacidade, a pedir **motivo** obrigatório, a usar a identidade real de quem chama (`auth.uid()`, não service_role) e a checar capacidade **antes** de reservar. Modal da tela ganhou campo de motivo e `requestId`. | Conceder `execucao.contingencia_auvo` a quem hoje usa "Abrir no Auvo". Sem a concessão o caminho manual fica indisponível — correto por desenho (é contingência), mas precisa de decisão de quem recebe. **AC-11 parcial:** não existe monitor consolidado de exceções (Visita não confirmada, falha de envio, tarefa órfã) em lugar nenhum do sistema — achado novo, registrado. |
| **BL 005** Capacidades sensíveis | **Fechado e utilizável hoje** | `1857_E00-S26`: `exige_concessao_individual=true` nas ações de aprovar/cancelar/exportar/ver custo/administrar; 15 asserções de matriz positiva **e** negativa. `1864_E01-S189` fechou os grants que faltavam nos sete escritores sem gate (orçamento, despesas, cobrança, grupos). Tela **Configurações → Capacidades** já existe, é superadmin, sem flag nova. | Nada de código. Falta o trabalho humano de desenhar os perfis reais (Operador PCM, Gestor, Financeiro, Inspetor) e conceder. **`execucao.validar` ficou de fora do flip** — SPEC_DEVIATION registrado: há teste provando herança intencional por perfil (`E01-S170_perfis_acumulaveis.test.sql`); mudar quebraria regra existente. |
| **BL 006** Revogação imediata | **Fechado e utilizável hoje** | `1859_E00-S27`: `config.sso_acesso_atual` generaliza a releitura ao vivo de `0234`; `sso_revogar_usuario`/`sso_reativar_usuario`; 13 asserções provando que a **mesma sessão** perde e recupera acesso sem novo login. Guarda de CI nova recusa policy futura que confie só em `auth.jwt()`. UI "Revogar ou reativar usuário" em Configurações → Capacidades. `/revisao-adversarial` achou e corrigiu um bug real: autorrevogação travava a reativação. | Nada. Era o **risco de segurança aberto** do diagnóstico anterior — está fechado. |

### P1 — fluxo operacional

| BL | Regra aprovada | Veredito | Evidência na entrega | O que falta |
|---|---|---|---|---|
| **BL 007** Reorganizar o Kanban | **Fechado em 19/11** (era parcial) | `1861_E01-S194`: status `validacao_pcm` ponta a ponta (banco, 3 agregados, webhook Auvo, importador de tarefas, front). Colunas agora são `Solicitações · Preventivas · Demanda · Planejamento · Em execução · Validação PCM · Finalizado`; `corretiva`, `backlog` e `cancelado` saíram (AC-2/AC-3: Backlog é painel lateral, Cancelado é filtro). Retorno do Auvo "Finalizada" passa a cair em **Validação PCM**, não em Finalizado. Entrar em `finalizado` passou a exigir a capacidade `execucao.validar`. **Sem flag nova — visível assim que o deploy sair.** | ~~**SPEC_DEVIATION 1 (AC-5):** a coluna "Campo a conciliar" não foi criada.~~ **Fechado em 19/11 por `E01-S199`** — a coluna existe, entre Preventivas e Demanda, alimentada pela máquina de conciliação que já existia (`E01-S175`) com o recorte que faltava: provisória **e** ainda não conciliada. **SPEC_DEVIATION (AC-7):** só a transição de maior risco (entrar em Finalizado) ganhou guarda; o resto da matriz de transição continua livre. |
| **BL 008** Pendências por ativo | **Fechado no domínio, prova nova** | `E01-S197`: nenhuma migration nova — o agrupamento, a atomicidade e a dedup já existiam. O que faltava era a prova do cenário **literal do Fabrício**: 20 asserções provando 7 achados no mesmo quadro = 6 pendências reais (1 `ok` não gera), 2 compostas para o Backlog, as 4 restantes **intactas**, zero OS/Chamado criado. 3 flags que o código já lia há meses foram declaradas em `.env.example`. | Ativação das 3 flags e dos gates pré-existentes (não verificável sem acesso a produção). |
| **BL 009** Deslocamento e capacidade | Pronto, não ativado | `1862_E01-S195`: `pcm.sso_trechos_deslocamento` (imutável, revisão por dia, idempotente por `request_id`); `sso_enquadrar_trecho_deslocamento(origem,destino)` como **função pura** e coluna `enquadramento` `generated always stored` — o enquadramento nunca é editável, sempre derivado. Residência↔cliente **não computa**; escritório↔cliente, cliente↔cliente e retirada a serviço **computam**. Componente `TrechosDeslocamento.tsx` na aba de capacidade. | Abrir `pcm.sso_trechos_deslocamento_gate` e a flag `VITE_SSO_TRECHOS_DESLOCAMENTO_ENABLED`. **SPEC_DEVIATION (AC-7):** devolve o total computável e o não computável, mas não compara contra limite de jornada — **não existe jornada contratada configurada no sistema**; inventar um número seria regra nova sem aprovação. |
| **BL 010** Materiais e Aquisições enxuto | Pronto, não ativado (domínio fechado antes) | Jornada `central-materiais` registrada em `1855_E01-S188` com gate + grant + flag nomeados e procedimento de abertura/retorno auditado. | Abrir a jornada. A **área única "Materiais e Aquisições" no menu** depende de BL 013 (não entregue). |
| **BL 011** Orçamento operacional opcional | Fechado no domínio (rodada anterior) | Sem mudança nesta rodada, além dos grants de `1864_E01-S189`. | Conferir na homologação as duas regras numéricas: **fator 1,5 = 150% do custo (markup 50%)** e **tributos configuráveis, não fixos no código** — está no caderno de teste. |
| **BL 012** Origem única dos faturáveis | Fechado no schema (rodada anterior) | Sem mudança nesta rodada, além dos grants de `1864_E01-S189`. | Gap de prova conhecido (S182 com poucos pgTAP) — não endereçado nesta rodada. |
| **BL 013** Navegação por função | **Não entregue** | `specs/E01-S190-onda-zero-navegacao/` tem spec, plan e tasks escritos e **todas as 16 tasks em `todo`**. | Tudo: Trabalho/Gestão/Administração, Assessment → Inspeção "Diagnóstico Inicial do Cliente", PMOC → modalidade do Plano, absorver Agenda em Planejamento, unificar Ferramentas, pesquisa global da estrutura, bloqueio de rota por URL. **É o maior buraco desta entrega** e também segura o item 2 do playbook (Assessment/PMOC) e a área única de BL 010. |

### P2 — arquitetura assistida

| BL | Regra aprovada | Veredito | Evidência na entrega | O que falta |
|---|---|---|---|---|
| **BL 014** API de domínio sobre staging | Pronto, não ativado | Edge Function `pcm-api-dominio`: envelope versionado (`versao`, `acao`, `requestId`, `clienteId`, `payload`), 2 ações (criar lote de levantamento em staging, consultar prévia), Zod na borda, identidade **real** do chamador (`auth.uid()`), `verify_jwt=true`, erros nomeados por camada. Guarda de CI nova (`check-api-dominio-cinco-camadas.mjs`) impede SQL genérico, `service_role` e acesso direto a tabela. | Nenhum consumidor real (Módulo de Campo não existe). **SPEC_DEVIATION:** aprovar/rejeitar levantamento ficou fora — a RPC está sem grant e com 2 gates fechados; expor uma capacidade adormecida e não revisada seria pior. |
| **BL 015** MCP controlado sobre a API | Pronto, não ativado | Edge Function `pcm-mcp`: JSON-RPC 2.0 mínimo (`initialize`, `tools/list`, `tools/call`), catálogo **estático e fechado** de ferramentas, registro de uso em `pcm.sso_mcp_chamadas` (`1865_E02-S43`), identidade do usuário herdada, ferramenta fora do catálogo devolve erro nomeado. Guarda de CI nova impede acesso direto ao banco. 13 asserções pgTAP. | Depende de BL 014 homologado (regra do próprio pacote). Nenhum cliente MCP (ChatGPT/Claude) apontado para a função — configuração do lado do consumidor. **SPEC_DEVIATION:** só leitura nesta etapa, exatamente como o pacote manda ("primeira entrega em leitura"). |

---

## 3. A lacuna real: código pronto × jornada alcançável

O próprio pacote cobra isso na prática ("o operador deve enxergar primeiro o que precisa decidir
hoje"). A medição de 17/11 (`docs/Apontamentos/alcance-no-front-2026-11-17.md`) achou **694 flags
usadas e nunca declaradas** e **227 `return null` silenciosos** — regra fechada no banco e nenhum
botão na tela. Duas stories desta rodada atacam exatamente isso:

- **E00-S28** criou o registro único das **739 flags** (`apps/web/src/config/flags-sso.ts`), o
  componente `RecursoNaoAtivado` ("disponível, ainda não ativado" em vez de tela vazia) e um gate
  de CI que recusa flag nova não declarada. Zero fuga, zero flag órfã no repositório inteiro.
- **E01-S188** criou a tela **Configurações → Ativação de jornadas**: escolhe a jornada, e ela
  responde *"está utilizável? se não, qual gate/flag/grant falta?"* — e executa a abertura e o
  retorno com motivo registrado e auditado, sem SQL manual.

**Consequência prática para a homologação:** a validação de tela do Fabrício precisa de uma sessão
de ativação antes. O caderno de teste traz a lista exata por item.

---

## 4. SPEC_DEVIATION — tudo que ficou diferente do pacote, nomeado

Nenhum destes é mudança de regra: são partes da regra **não entregues**, registradas em vez de
silenciadas (exigência do próprio processo).

| # | Item do pacote | O que ficou de fora | Por quê | Onde está registrado |
|---|---|---|---|---|
| ~~1~~ | BL 007 AC — coluna "Campo a conciliar" | **RESOLVIDO em 19/11** | `E01-S199`: coluna entregue, 13 asserções pgTAP + 6 de componente. Falta só abrir o gate | `specs/E01-S199-campo-a-conciliar-kanban/` |
| 2 | BL 007 — "arrastar respeita transições permitidas" | Só entrar em Finalizado tem guarda | Inventariar todos os chamadores (lote, drag, automação, conversão integral) antes de fechar o resto | `plan.md` de E01-S194 |
| 3 | BL 003 AC — Agenda mostra as OS vinculadas | Não implementado | Exige decidir quem escreve `pcm.agenda_tecnico` a partir da Visita — decisão de produto, não unilateral | `plan.md` de E01-S192, task T8 |
| 4 | BL 009 — "excedente a validar" | Calcula computável e não computável, não compara com limite | Não existe jornada contratada configurada no sistema | `plan.md` de E01-S195, ADR-1693 |
| 5 | BL 014 — aprovar/rejeitar na API | Fora do contrato v1 | RPC sem grant + 2 gates fechados; expor capacidade adormecida sem revisão é risco | ADR-1695 |
| 6 | BL 004 AC-11 — monitor de exceções | Só contingência consolidada | Visita não confirmada / falha de envio / tarefa órfã não têm consulta consolidada em lugar nenhum — achado novo | ADR-1694 |
| 7 | BL 005 — `execucao.validar` individual | Ficou fora do flip de concessão individual | Teste existente prova herança intencional por perfil; mudar quebraria regra vigente | `tasks.md` de E00-S26, task 5 |

---

## 5. Itens "Em validação" — confirmação de que nada foi implementado

| Tema | Situação no pacote | Confirmação |
|---|---|---|
| Estrutura Técnica final (Equipamento × Componente × Grupo quantitativo) | Em validação | **Não tocado.** A resposta 27 (entidades distintas, Auvo por tipo) foi registrada como restrição dura; nenhuma migration funde estrutura. |
| Relatórios e Área do Cliente | Em validação | **Não tocado.** Portal definitivo não foi desenvolvido. |
| Cockpit e indicadores | Próxima rodada | **Não tocado.** |
| Indicador de pressão do Backlog × capacidade | Em validação (anexo) | **Não tocado.** |
| Estoque completo | Obsoleto para a fase | **Não implantado.** |
| Técnico como usuário do SSO | Obsoleto nesta fase | **Não criado.** Nenhuma área de técnico no SSO. |

---

## 6. Qualidade da entrega — o que foi verificado

| Verificação | Resultado |
|---|---|
| 12 migrations novas (`1854`–`1865`), numeração sequencial sem colisão | ✅ |
| Migrations aplicam do zero (`db reset`) | ✅ **depois da correção de 19/11** — ver bloco abaixo |
| pgTAP com caso **permitido e negado** em cada RPC nova | ✅ |
| `/revisao-adversarial` nas stories de tier arquitetural | ✅ em E00-S27 (1 bug real achado e corrigido), E01-S193 (PASS, zero achado alto/médio); **pendente em E00-S26** (task 7 em `todo`) |
| Guardas de CI novas | 3: revogação coberta (E00-S27), API de domínio em 5 camadas (E01-S198), MCP sem acesso direto ao banco (E02-S43) |
| Regressão achada e corrigida no caminho | `sso_criar_os_chamado` quase perdeu 2 remendos anteriores por `create or replace` ingênuo — reproduzida e corrigida por cirurgia de texto |
| Bugs de front achados por teste antes de publicar | 2 em `TrechosDeslocamento` (erro do Postgrest não é `instanceof Error`; `retry` mascarando a mensagem de gate fechado) |

### 🔴 Bloqueio de deploy achado e corrigido em 19/11

**A migration `1861_E01-S194_validacao_pcm_status.sql` não aplicava.** Reproduzido com
`supabase db reset` sobre `main`:

```
ERROR: cannot drop columns from view (SQLSTATE 42P16)
At statement: 14 ... create or replace view pcm.operacao_itens
```

**Causa:** duas stories tocaram a mesma view em branches paralelas. `1858` (E01-S192) acrescentou
a coluna `ocorrencia_preventiva_id`; `1861` (E01-S194) recriou a view **sem** essa coluna, e o
Postgres proíbe remover coluna de view existente. Cada branch passava sozinha; juntas, quebravam —
o CI por PR nunca testou as duas no mesmo banco.

**Efeito se não corrigido:** o deploy pararia em `1861`. Tudo de `1861` em diante — Kanban com
Validação PCM (BL 007), trechos de deslocamento (BL 009), contingência Auvo (BL 004), gates dos
sete escritores (BL 005) e registro de uso do MCP (BL 015) — **não chegaria ao banco**, enquanto
o código do front já estaria publicado.

**Correção:** `1861` passou a preservar a coluna da `1858` nos dois ramos do `UNION`. A migration
nunca aplicou com sucesso em ambiente nenhum (ela erra sempre), então corrigi-la não viola a regra
"nunca edite migration aplicada" — e uma migration nova não resolveria, porque a cadeia para em
`1861`.

**Confirmado após a correção, em 19/11, contra `main` com a correção aplicada:**

| Verificação | Resultado |
|---|---|
| `supabase db reset` — as 12 migrations da rodada (`1854`–`1865`) aplicam do zero, em sequência | ✅ sem erro |
| Suíte pgTAP completa | ✅ **283 arquivos, zero falha** |
| Suíte de front (`vitest`) | ✅ **2.900 testes passando, zero falha**, 20 pulados |
| Colunas da view `pcm.operacao_itens` | ✅ preserva `ocorrencia_preventiva_id` (E01-S192) e carrega o cartão de Demanda (E01-S194) |

Antes da correção, a mesma suíte reprovava **5 arquivos** de E01-S189 — não por defeito deles, mas
porque os gates que a `1864` cria nunca chegavam a existir, já que a cadeia parava na `1861`.

**Ação necessária:** conferir em qual migration o banco de produção parou. Se o deploy automático
rodou depois do merge de 18/11, ele falhou em `1861` e produção está em `1860`.

### Dois gates de CI vermelhos, também corrigidos em 19/11

Efeito colateral da mesma sequência de merges:

1. `VITE_SSO_TRECHOS_DESLOCAMENTO_ENABLED` e `VITE_SSO_DIAGNOSTICO_ATIVACAO_ENABLED` eram lidas
   sem estar no registro de flags → corrigido (registro agora com 739 entradas) e as duas leituras
   diretas de `import.meta.env` em `HomePage.tsx` passaram a usar `flagLigada`, como a regra de
   E00-S28 exige.
2. `docs/ativacao/flags.md` estava sem `alwaysApply` no frontmatter → corrigido.

---

## 7. Pendências que precisam de decisão do Fabrício (não de código)

1. **Abrir ou não `chamado_os_gate`.** Abrir libera múltiplas OS por Chamado (BL 001) em todo o
   sistema de uma vez, não só no caminho do Backlog. É o item com maior efeito operacional da lista.
2. **Quem recebe `execucao.contingencia_auvo`.** Sem concessão, ninguém abre OS manual no Auvo.
3. **Desenho dos perfis reais** (Operador PCM, Gestor PCM, Inspetor, Financeiro) sobre as
   capacidades de BL 005 — o mecanismo está pronto, a política não.
4. **Prioridade de E01-S190 (BL 013).** É o maior buraco: segura navegação por função, Assessment
   como Inspeção, PMOC como modalidade e a área única de Materiais.
5. **Quem escreve a Agenda do Técnico** a partir da Visita (BL 003 AC-3) — sem isso, a evidência
   original do Fabrício continua reproduzível.
