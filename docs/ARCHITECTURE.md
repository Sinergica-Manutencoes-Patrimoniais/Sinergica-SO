---
name: ARCHITECTURE
description: Arquitetura viva do Sinérgica SO — bounded contexts, context-map, schemas. Puxe ao tocar fronteira de domínio ou ao criar migration.
alwaysApply: false
---

# ARCHITECTURE — Sinérgica SO

> Documento **vivo** — atualize quando a fronteira mudar. Decisão estrutural → ADR em `docs/adr/`.

## Visão geral
Sistema operacional multi-domínio da Sinérgica Manutenções: 9 bounded contexts num único
monorepo, com um app web (`apps/web`) feature-based, banco Postgres particionado por schema,
Edge Functions Deno no Supabase, e integração bidirecional com o Auvo (campo).

**PCM é o system of record** da operação técnica.
**Auvo é o braço de campo** — execução insubstituível (GPS, fotos, checklist, assinatura offline).

## Bounded contexts — context-map
| Contexto | Subdomínio | Schema(s) Postgres | Feature `apps/web` | Relação com outros |
|----------|------------|--------------------|--------------------|-------------------|
| **PCM / Operação** | core | `pcm` | `features/pcm` | Supplier de todos os outros (dados de OS, backlog, visitas) |
| **Atendimento (IA/Zé)** | core | `atendimento` | `features/atendimento` | Customer do PCM (abre OS); usa Shared Kernel `pcm.ordens_servico` |
| **Comercial** | supporting | `comercial` | `features/comercial` | Customer do PCM (levantamento → proposta → contrato → OS); **enriquece** a Conta com o funil (R3) |
| **Financeiro** | supporting | `financeiro` | `features/financeiro` | Customer do PCM (OS finalizada → custo → faturamento) |
| **Operação & Estoque** | supporting | `estoque` | `features/operacao` | Shared Kernel com PCM (catálogo de materiais) |
| **Marketing** | generic | `marketing` | `features/marketing` | Standalone |
| **Growth** | generic | `growth` | `features/growth` | Standalone |
| **Gestão (Cockpit)** | supporting | (views) | `features/gestao` | Conformist — lê `pcm`, `financeiro`, `comercial` via views |
| **Área do Cliente** | supporting | (views `pcm`) | `features/area-cliente` | Conformist — lê `pcm`/`financeiro` via views restritas por RLS; escreve em `pcm.*` como **canal** (nota/interação/satisfação do cliente), sem ser dono das entidades |

> Relações DDD: Customer/Supplier (PCM fornece dados), Shared Kernel (tipos partilhados via
> `packages/shared`), Conformist (contextos que lêem via views sem modificar).

## Estrutura do monorepo
```
apps/web/src/
  features/<dominio>/     ← um diretório por bounded context
    domain/               ← regras puras (sem I/O, sem framework)
    application/          ← casos de uso
    infrastructure/       ← adapters (Supabase, Auvo, Evolution...)
    pages/ components/ hooks/ types/
  lib/                    ← helpers genéricos (log, problem, supabase client)
  config/env.ts           ← variáveis tipadas e validadas no boot (fail-fast)
  app/App.tsx             ← shell + roteamento
packages/
  config/                 ← tsconfig base
  shared/                 ← schemas Zod e tipos de domínio cross-contexto
  ui/                     ← componentes base (shadcn/ui)
  database/               ← tipos gerados (supabase gen types typescript)
supabase/
  migrations/             ← schemas por domínio + RLS FORCE + audit columns
  functions/              ← Edge Functions Deno
```

**Regra de fronteira**: features de domínios diferentes **não se importam** — compartilhe só via `packages/`.
Quando uma tela precisa montar conteúdo de outro contexto (ex.: a aba Comercial dentro da Visão 360
do PCM), quem compõe é o **shell** (`app/`), passando o nó pronto por prop — nunca um import
cruzado entre features.

**Data fetching**: dado de servidor passa por **TanStack Query** (decisão do PO, 2026-08-10,
E01-S145). Hooks em `application/<dominio>-queries.ts`, chaves num objeto `<dominio>QueryKeys`,
`queryClient` único em `app/query-client.ts`. Escrita invalida chave — nunca recarrega à mão.
`useState` fica para estado local de UI. Ver `CLAUDE.md` § Data fetching.

## Camadas DDD (por feature)
```
interfaces (pages/components/hooks) → application → domain ← infrastructure
```
`domain/` não importa NADA de framework, I/O ou de outro contexto.

## Propriedade de dados — as 3 regras (ADR-0019)

Antes de criar qualquer tabela, responda "quem é o dono?" pelas regras abaixo. Elas valem para
código novo; o passivo herdado está listado em "Dívida de fronteira" no fim desta seção.

**R1 — Dono é quem tem autoridade de escrita do ciclo de vida.**
Dono = o contexto que **cria** a entidade e **muda o estado** dela. Não é quem lê mais, nem quem
escreveu a migration. Se dois contextos escrevem o mesmo estado, a fronteira está errada.

**R2 — Consumidor lê por view ou RPC do dono, nunca `select` direto em tabela de outro schema.**
FK cross-schema serve para **referenciar** (guardar a chave), não para ler atributos. A view é o
contrato: o dono pode mudar a tabela por trás sem quebrar o consumidor.

**R3 — Enriquecimento mora no schema de quem enriquece.**
Precisa de atributo novo sobre entidade alheia? **Crie tabela própria com FK** para a entidade do
dono. Nunca adicione coluna na tabela do outro contexto. Ex.: o funil comercial sobre uma Conta é
`comercial.oportunidades (cliente_id)` — não uma coluna `status_comercial` em `pcm.clientes`.

## Dados — schemas Postgres (mapa real)

> Estado verificado no `supabase/migrations/` em 2026-08-10 — **132 tabelas**. Este mapa é derivado
> do schema, não da intenção. Ao criar tabela, atualize aqui **no mesmo PR**.

### Classificação
| Classe | O que é | Quem escreve |
|--------|---------|--------------|
| **Core** | Entidade que o contexto cria e cujo estado ele governa | o dono |
| **Shared Kernel** | Entidade transversal referenciada por vários contextos; mudança é decisão cross-módulo | dono nominal, com acordo |
| **Espelho** (`*_cache`, `auvo_*`) | Réplica de sistema externo | só o job de sync; app é read-only |
| **Enriquecimento** | Estende entidade de outro contexto via FK (R3) | quem enriquece |
| **Transversal** | Identidade/governança usada por todos | dono declarado do schema |
| **View de consumo** | Interface de leitura publicada pelo dono (R2) | ninguém (é leitura) |

### `pcm` — PCM/Operação · 76 tabelas · **system of record da operação**
| Grupo | Tabelas | Classe |
|-------|---------|--------|
| **Conta** | `clientes` ⭐, `cliente_grupos`, `cliente_responsaveis`, `marcacoes_cliente` | **Shared Kernel** |
| OS & chamado | `ordens_servico`, `os_status_eventos`, `os_notas`, `chamados`, `chamados_eventos`, `chamados_anotacoes`, `chamados_interacoes` | Core |
| Pré-OS (Fluxo B) | `requisicoes_servico`, `orcamentos_servico`, `orcamento_decisoes` | Core ⚠️ criadas pela E09 |
| Ativos & local | `equipamentos`, `equipamento_categorias`, `sistemas`, `sistema_itens`, `locais`, `local_tipos`, `areas`, `pcm_equipment` | Core |
| PMOC | `pmoc_properties`, `pmoc_contracts`, `pmoc_equipment`, `pmoc_records`, `pmoc_schedules`, `pmoc_microbio_analysis`, `pmoc_nonconformity_log` | Core |
| Inspeção & laudo | `inspecoes`, `inspecao_itens`, `tipos_inspecao`, `checklist_templates`, `checklist_template_itens`, `laudos_spda`, `laudo_spda_pontos`, `questionarios` | Core |
| Pessoas & equipe | `funcionarios`, `equipes`, `agenda_tecnico` | Core |
| Ferramentas | `ferramentas`, `ferramenta_unidades`, `ferramenta_alocacoes`, `ferramenta_alocacoes_cliente`, `ferramenta_movimentacoes`, `ferramenta_reservas`, `kits`, `kit_itens` | Core |
| Catálogos | `servicos`, `tipos_tarefa`, `segmentos`, `palavras_chave`, `produto_categorias`, `despesa_tipos` | Core |
| Custo & qualidade | `despesas`, `tickets` | Core |
| Satisfação | `portal_satisfacao` (**fonte canônica** de CSAT/NPS) · `satisfacao_respostas` (espelho Auvo **inativo** — não usar) | Core · Espelho inativo |
| Espelho Auvo | `tecnicos_cache`, `equipamentos_cache`, `auvo_task_snapshots`, `os_equipamentos_auvo`, `auvo_entity_status`, `auvo_sync_outbox`, `auvo_sync_runs`, `gps_posicoes` | **Espelho** |
| Escrito pelo portal (E09) | `portal_notificacoes`, `portal_satisfacao`, `chamados_interacoes`, `os_notas`, `relatorios_cliente_publicados` | Core do PCM — portal é **canal de escrita**, não dono |
| Views | `auvo_sync_health`, `auvo_sync_error_details` | View de consumo |

⭐ `pcm.clientes` recebe **35 FKs de 4 contextos** — é Shared Kernel, não propriedade exclusiva do
PCM (ADR-0019). Interface pública de leitura: view `relacionamento.contas`.

### `atendimento` — Atendimento/IA · 26 tabelas
`conversas`, `mensagens`, `tags`, `canais_externos`, `instancias_agente`, `personas`,
`persona_especialistas`, `persona_licoes`, `config_ze`, `conhecimento_entradas`, `fluxos`,
`fluxo_recipes`, `fluxo_logs`, `cluster_regras`, `lead_scoring_config`, `opt_outs`,
`ig_comment_automations`, `wa_templates`, `wa_messages`, `wa_queue`, `webhook_rate_limits`,
`csat_respostas`, `handoff_eventos`, `conversa_cliente_eventos`, `cliente_alma`,
`cliente_memoria_resumo`, `entrevista_sessao`, `roteiro_entrevista`, `historico_chamado_snapshots`
— todas **Core do Atendimento**. A última foi criada pela E01-S89 (épico do PCM) mas guarda
conversa de WhatsApp anexada a um Chamado: o Atendimento produz o dado, logo é dono (R1). O PCM lê
sob RLS própria — leitura cruzada aceita, sem import de código entre features.

### `financeiro` — Financeiro · 22 tabelas · **Conformist do `pcm`**
`lancamentos`, `lancamentos_eventos`, `categorias`, `contas_bancarias`, `fornecedores`,
`transferencias`, `recorrencias`, `regras_classificacao`, `extrato_transacoes`, `contratos`,
`custos_funcionario`, `cobrancas`, `cobrancas_eventos`, `regua_pontos`, `regua_envios`,
`config_impostos`, `provisoes_imposto`, `orcamentos` (**orçamento anual/budget** — não confundir
com `pcm.orcamentos_servico`), `fechamentos_mensais`, `fechamentos_eventos` — Core.
Views de consumo: `aging_recebiveis`, `aging_pagaveis`, `portal_faturas`, `portal_cobrancas`.

`financeiro.contratos` é **plano de faturamento** (valor mensal, vigência, vencimento), não o
contrato comercial. Quando o E03 entregar `comercial.contratos`, esta tabela passa a ser
alimentada por ele via FK `comercial_contrato_id` (ADR-0020).

### `comercial` — Comercial · 1 tabela (épico E03 não iniciado)
`leads` — ⚠️ **escrita pelo Atendimento** (agente comercial, E02-S09), nunca pelo Comercial.
O E03 a absorve em `comercial.oportunidades` (ADR-0020).

### `relacionamento` — Transversal · 3 tabelas
`contatos`, `identidades_contato`, `vinculos` — identidade relacional comum a Atendimento,
Comercial e PCM ([ADR-0007](adr/0007-base-unica-contatos-relacionamento.md)).

### `config` · `audit` — Governança
`config`: `usuarios`, `grupos`, `grupo_modulos`, `usuario_modulos`, `usuario_cliente`,
`integracoes`, `feature_flags`, `priorizacao_gutd`, `parametros_apontamento_horas`,
`preferencia_colunas_kanban_os`, `preferencia_localizacao_auvo` · view `minhas_permissoes`.
`audit`: `events` (append-only).

### Schemas criados e ainda vazios
`estoque` (E05) · `marketing` (E06) · `growth` (E07) · `lgpd` (governança LGPD).
Gestão/Cockpit (E08) e Área do Cliente (E09) **não têm schema próprio** — são Conformist por
definição e devem consumir por view.

### Matriz dono × consumidor (relações reais)
| Dado | Dono | Consumidores | Como consomem hoje |
|------|------|--------------|--------------------|
| Conta (`pcm.clientes`) | Shared Kernel (custódia PCM) | Financeiro, Atendimento, Comercial, Portal, Auvo | FK direta (35×) |
| OS (`pcm.ordens_servico`) | PCM | Financeiro (custo), Atendimento (abre), Portal | FK + RPC `security definer` |
| Funcionário/despesa | PCM | Financeiro (rentabilidade E04-S06) | RPC `security definer` com guarda de módulo |
| Contato (`relacionamento.*`) | Transversal | Atendimento, Comercial | FK direta |
| Lead (`comercial.leads`) | ⚠️ Atendimento (de facto) | ninguém (sem UI) | — |
| Fatura/cobrança | Financeiro | Portal | **view** `portal_faturas`/`portal_cobrancas` ✅ |

### Dívida de fronteira (passivo herdado — corrigir no E03)
1. **Colunas comerciais em `pcm.clientes`** — `tipo`, `status_comercial` (E01-S12) violam R3.
   Migram para `comercial.oportunidades` (E03-S01).
2. **Satisfação duplicada** — `pcm.satisfacao_respostas` (pesquisa do Auvo, E01-S55) e
   `pcm.portal_satisfacao` (CSAT/NPS do portal, E09) medem o mesmo conceito sobre a mesma OS.
   **Resolvido por decisão do PO (2026-08-10): a Sinérgica não usa a pesquisa do Auvo.**
   `pcm.portal_satisfacao` é a **fonte canônica** de satisfação; `pcm.satisfacao_respostas` vira
   espelho **inativo** (histórico preservado, sem novas escritas) e o recurso `satisfactions` da
   Edge Function `pcm-auvo-support-pull` é desligado — os recursos `questionnaires` e `expenses`
   da mesma function continuam ativos (E03-S11).
3. **`comercial.leads` escrita pelo Atendimento** — viola R1. Regularizada em E03-S09/S10.
   ⚠️ A tabela está **vazia mas viva**: `pcm-ze-agent` está deployada e insere nela. O drop só é
   seguro depois que a E03-S09 estiver em produção.

**Não é dívida — caso 2** (reclassificado em 2026-08-10, E03-S13):
`atendimento.historico_chamado_snapshots`. Foi criada pela E01-S89 (épico do PCM), mas o snapshot
**é conversa de WhatsApp** — dado produzido pelo Atendimento e anexado a um Chamado. A migration de
origem já declarava a escolha: *"tabela vive no schema de quem PRODUZ o dado"*. Por R1 o Atendimento
é dono e o schema está certo. **Épico de origem da story não determina propriedade** (ADR-0019).

**Não é dívida — caso 1** (avaliado e descartado em 2026-08-10): as tabelas que a E09 criou dentro de
`pcm.*` — `chamados_interacoes`, `os_notas`, `portal_notificacoes`, `portal_satisfacao`,
`requisicoes_servico`, `orcamentos_servico`, `orcamento_decisoes`. Elas têm
`autor_tipo ∈ ('cliente','interno')` e descrevem **entidades do PCM** (Chamado, OS, Fluxo B), com o
portal como **um dos dois canais de escrita** — não como dono. Por R1 o PCM governa o ciclo de vida
dessas entidades, então o schema está certo. Mover para um schema `portal` criaria FKs de volta
para `pcm.chamados`/`pcm.ordens_servico` sem ganho de fronteira.

**Governança de banco:**
- RLS FORCE em toda tabela (nem service_role escapa nas tabelas de negócio).
- Colunas de auditoria em toda tabela: `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`.
- `audit.*` append-only: policies negam UPDATE/DELETE para todos.
- Espelhos (`*_cache`): o app só lê; sync externo escreve (ex.: `pcm.equipamentos_cache` ← Auvo).
- Idempotência em escritas críticas: `externalId unique` no Auvo, `numero_os serial` no PCM.

## Integração Auvo — divisão de trabalho
| Domínio | Dono | Fluxo |
|---------|------|-------|
| Clientes/condomínios | PCM | PCM → Auvo (cria/atualiza via API) |
| Equipamentos/ativos | PCM | PCM → Auvo (cache: Auvo → PCM espelho) |
| Técnicos | Auvo | Auvo → PCM (espelho via API) |
| OS (decisão) | PCM | PCM cria, atribui, prioriza → Auvo executa |
| Execução em campo | Auvo | GPS, fotos, checklist, assinatura (Auvo exclusivo) |
| Resultado de OS | Auvo → PCM | Webhook status + fotos + checklist + peças consumidas |
| Financeiro | PCM | PCM consolida (dado de execução vem do Auvo) |

## Decisões estruturais (ADRs)
- [ADR-0001 — PCM como origin of truth + externalId idempotente no Auvo](adr/0001-pcm-origin-truth-externalid.md)
- [ADR-0002 — Detecção determinística de menção ao Zé antes do LLM](adr/0002-deteccao-deterministica-ze.md)
- [ADR-0003 — RBAC via claim `user_role` no JWT + tabela `config.usuarios`](adr/0003-rbac-jwt-claim-config-usuarios.md)
- [ADR-0019 — Propriedade de dados: R1/R2/R3 e `pcm.clientes` como Shared Kernel](adr/0019-propriedade-de-dados-r1-r2-r3.md)
- [ADR-0020 — Conta única: identidade no PCM, funil no Comercial](adr/0020-conta-unica-funil-no-comercial.md)

> Lista parcial — o diretório [`adr/`](adr/) tem o conjunto completo.
