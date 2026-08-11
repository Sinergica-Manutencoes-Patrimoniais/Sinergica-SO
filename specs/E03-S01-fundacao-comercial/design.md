---
name: design
description: Design arquitetural do épico E03 (Comercial/CRM) — schema, fronteiras de domínio, motor de precificação, plano de migração da Conta única e correção do passivo. Leia antes de codar qualquer story E03.
alwaysApply: false
---

# Design — Módulo Comercial / CRM (épico E03)

> **Tier:** arquitetural (novo bounded context) · **Status:** aprovado (Lucas, 2026-08-10)
> **Pare aqui antes de codar.** Este documento cobre o épico inteiro; cada story tem `spec.md` e
> `tasks.md` próprios com os AC.
> Decisões de produto em `product.md` (mesma pasta). Decisões de fronteira em
> [ADR-0019](../../docs/adr/0019-propriedade-de-dados-r1-r2-r3.md) e
> [ADR-0020](../../docs/adr/0020-conta-unica-funil-no-comercial.md).

## 1. Fronteira do contexto

O Comercial é **supporting**, e tem duas relações distintas com o PCM:

| Relação | Com quem | O quê |
|---------|----------|-------|
| **Shared Kernel** | `pcm.clientes` (a Conta) | identidade compartilhada; o Comercial **lê** pela view `relacionamento.contas` e **nunca** adiciona coluna |
| **Enriquecimento (R3)** | `comercial.oportunidades` | o funil é dado do Comercial, no schema do Comercial, com FK `cliente_id` |
| **Customer/Supplier** | PCM é supplier | contrato assinado → PCM cria plano preventivo e passa a executar |
| **Supplier** | Financeiro é customer | contrato assinado → `financeiro.contratos` (plano de faturamento) |
| **Conformist** | lê `financeiro.custos_funcionario` e `financeiro.config_impostos` | por RPC do Financeiro, nunca `select` direto (R2) |

```
                    relacionamento.contas (view)
                              ▲ leitura (R2)
                              │
  pcm.clientes ──────── comercial.oportunidades ──── comercial.propostas
   (Conta,               (funil: etapa, score,        (4 tipos, versões,
    Shared Kernel)        origem, motivo perda)        preço calculado)
        ▲                                                     │ aceite
        │ contrato ativo                                      ▼
        │ cria plano preventivo              ┌──── comercial.contratos ────┐
        └────────────────────────────────────┤                             │
                                             ▼                             ▼
                                  pcm.pmoc_contracts          financeiro.contratos
                                     (execução)               (plano de faturamento)
```

**O que o Comercial NÃO faz:** não cria OS, não emite cobrança, não executa preventivo, não escreve
em `pcm.*` nem em `financeiro.*` por `insert` direto — só por RPC publicada pelo dono.

## 2. Schema `comercial`

Todas as tabelas: RLS **FORCE**, colunas de auditoria (`created_at`, `created_by`, `updated_at`,
`updated_by`, `deleted_at`), policies no padrão do projeto —
`auth.jwt() ->> 'user_role' = 'superadmin'` **ou** `auth.jwt() -> 'user_modulos' ->> 'comercial'`
em `('leitura','escrita')` para SELECT e `= 'escrita'` para INSERT/UPDATE/DELETE.

### 2.1 Funil

```sql
comercial.etapas_funil        -- configurável (padrão E01-S84)
  id, nome, ordem, cor,
  tipo text check (tipo in ('aberta','ganha','perdida')),  -- métrica não quebra com rename
  ativo boolean

comercial.motivos_perda
  id, nome, ativo

comercial.oportunidades       -- ENRIQUECIMENTO da Conta (R3)
  id,
  cliente_id      uuid not null references pcm.clientes,   -- FK: referência, não leitura
  etapa_id        uuid not null references comercial.etapas_funil,
  titulo, descricao,
  valor_estimado_centavos bigint,          -- centavos, padrão do Financeiro
  score           int check (score between 0 and 100),  -- ← comercial.leads
  resumo          text,                                 -- ← comercial.leads
  origem          text,                                 -- ← comercial.leads.origem
  origem_ref      text,                                 -- ← comercial.leads
  lead_tier       text check (lead_tier in ('A','B','C','D')),  -- ← comercial.leads (E02-S18)
  cluster_nome    text,                                 -- ← comercial.leads (E02-S18)
  conversa_id     uuid references atendimento.conversas, -- ← comercial.leads
  contato_id      uuid references relacionamento.contatos,
  responsavel_id  uuid references auth.users,
  motivo_perda_id uuid references comercial.motivos_perda,
  fechada_em      timestamptz

comercial.oportunidade_eventos  -- append-only: mudança de etapa (base do ciclo de venda)
  id, oportunidade_id, etapa_de, etapa_para, ocorrido_em, ator_id
```

> **`motivo_perda_id` obrigatório ao entrar em etapa `tipo='perdida'`** — validado por trigger, não
> só na UI (o dado de win/loss é a métrica principal do módulo).
> **`fechada_em` e `oportunidade_eventos` são a fonte do ciclo de venda** — sem eles a métrica
> vira estimativa.

### 2.2 Precificação

```sql
comercial.parametros_preco       -- singleton (id=1 travado por check, padrão de config_impostos)
  margem_alvo_pct, overhead_pct, veiculo_mensal_centavos,
  beneficios_pct, suporte_pct, markup_material_padrao_pct,
  mo_inclui_inss_patronal boolean  -- ver §3: CPP fica fora do DAS no Anexo IV

comercial.niveis_tecnico         -- precifica por PERFIL, não por pessoa
  id, nome, custo_mensal_referencia_centavos, ativo

comercial.materiais              -- catálogo com preço de referência
  id, nome, unidade, custo_referencia_centavos, markup_pct, ativo
```

### 2.3 Proposta

```sql
comercial.propostas
  id,
  oportunidade_id uuid not null references comercial.oportunidades,
  tipo text check (tipo in ('levantamento','volante','residente','simples')),
  status text check (status in
    ('rascunho','em_revisao','aprovada','enviada','aceita','recusada','cancelada')),
  assessment_id   uuid,        -- FK para o Assessment do PCM (tipo levantamento)
  escopo, observacoes,
  custo_total_centavos, piso_centavos, preco_centavos, desconto_pct,
  valido_ate date, versao_atual int

comercial.proposta_versoes       -- snapshot append-only a cada alteração
  id, proposta_id, versao, payload jsonb, criado_em, criado_por

comercial.proposta_itens         -- composição (MO por nível, materiais, veículo…)
  id, proposta_id, tipo, descricao, nivel_id, material_id,
  quantidade, custo_unitario_centavos, total_centavos
```

**Status seguem o blueprint** (`docs/blueprint/03-comercial.md`), que já os define — não inventar
nomes novos.

### 2.4 Contrato

```sql
comercial.contratos
  id,
  proposta_id uuid not null references comercial.propostas,
  cliente_id  uuid not null references pcm.clientes,
  tipo text check (tipo in ('residente','volante','avulso')),
  valor_mensal_centavos, vigencia_inicio, vigencia_fim,
  reajuste_indice, reajuste_mes,
  escopo jsonb,                 -- sistemas cobertos, periodicidades
  status text check (status in ('ativo','suspenso','encerrado'))
```

Ao ativar: RPC do Financeiro cria a linha em `financeiro.contratos` com
`comercial_contrato_id` (coluna nova, FK opcional — contratos legados ficam sem origem). O cron
`fn_gerar_recorrencias` (E04-S04) **não muda**.

### 2.5 Views publicadas (interface R2)

| View | Para quem | Conteúdo |
|------|-----------|----------|
| `relacionamento.contas` | todos os contextos | leitura da Conta (`pcm.clientes`) — a interface pública do Shared Kernel |
| `comercial.portal_propostas` | Área do Cliente (E09) | proposta enviada, restrita por RLS ao cliente do usuário — mesmo padrão de `financeiro.portal_faturas` |

## 3. Motor de precificação

Fórmula (ESCOPO-MESTRE §6.3, decisão 4 do PO):

```
Custo Total = MO + Benefícios + Material + Veículo + Suporte + Overhead
Preço       = Custo Total × (1 + Margem) ÷ (1 − Alíquota)
Piso        = Custo Total ÷ (1 − Alíquota)        -- custo com gross-up de imposto
Desconto máx = 1 − (Piso ÷ Preço)
```

**Onde cada entrada nasce:**

| Entrada | Fonte | Como é lida |
|---------|-------|-------------|
| **MO** | `financeiro.custos_funcionario` (E04-S06) | RPC do Financeiro (R2). Nível de técnico usa a **média** dos funcionários do nível; sem dado → `comercial.niveis_tecnico.custo_mensal_referencia_centavos` |
| Benefícios, Veículo, Suporte, Overhead, Margem | `comercial.parametros_preco` | direto (é do Comercial) |
| Material | `comercial.materiais` × markup | direto |
| **Alíquota** | `financeiro.config_impostos` (E04-S10) | RPC do Financeiro — **fonte única** com a provisão de DAS |

**Cálculo é domínio puro** — `features/comercial/domain/precificacao.ts`, sem I/O, testável por
unidade. O adapter só busca os números.

### 3.1 Alíquota: configuração, nunca constante no código (decisão 12)

`financeiro.config_impostos` já é configurável desde a E04-S10 — `tipo ∈ ('fixa','faixa_rbt12')`
mais `faixas jsonb` editável na tela de Impostos. **Trocar de Anexo III para IV é digitar as faixas
na UI, sem migration.** O motor de preço nunca embute alíquota; sempre lê de lá.

Obrigações da UI de proposta:
- exibir a **alíquota efetiva aplicada** e sua origem (fixa ou faixa de RBT12);
- **avisar quando as faixas ainda estiverem no seed padrão** (nunca editadas) — o seed da E04-S10 é
  sugestão do Anexo III, não confirmação do contador. Aviso honesto, nunca bloqueio.

⚠️ **CPP no Anexo IV (risco R7).** No Anexo IV o INSS patronal fica **fora** do DAS (recolhido à
parte); no Anexo III está dentro. O custo de MO vem de `financeiro.custos_funcionario`, descrito
como "salário + encargos + benefícios". Se a empresa for Anexo III e os encargos cadastrados já
incluírem INSS patronal, ele entra **duas vezes** — no custo e no DAS.
Por isso `comercial.parametros_preco.mo_inclui_inss_patronal`: declara o que o custo cadastrado
representa, e o domínio ajusta. **Conferência única na S03**, não a cada proposta.

Regra de negócio: **a UI bloqueia preço abaixo do piso.** Desconto acima do máximo exige
`superadmin` e grava evento.

## 4. Migração da Conta única — **não há dado para migrar** (verificado em produção)

> Consulta read-only em produção (`supabase db query --linked`, 2026-08-10). Este parágrafo
> substitui o plano de 5 passos que este design continha antes de o dado ser verificado, e
> **rebaixa o risco R1 do `product.md`**: não existe migração de dados nesta story.

| Fonte | Linhas em produção |
|-------|--------------------|
| `comercial.leads` | **0** |
| `pcm.clientes` com `tipo='lead'` | **0** |
| `pcm.clientes` com `status_comercial='prospecto'` | **0** |
| `relacionamento.vinculos` com `entidade_tipo='comercial_lead'` | **0** |
| `pcm.clientes` com `marcacao_id` preenchido | **1** (de 105) |
| **Total de Contas** | **105** — 47 ativas · 51 inativas · 6 inconsistentes |

Nenhuma combinação de `tipo`/`status_comercial` além de `tipo='cliente'` com
`status_comercial ∈ ('ativo','inativo')` jamais foi usada. O agente comercial (E02-S09) está em
produção mas nunca passou pelo UAT de WhatsApp, então nunca gravou um lead.

**O que a S01 faz, então:**

1. **Criar o schema** `comercial.*` (etapas, motivos, oportunidades, eventos) + seed das etapas
   padrão do funil do blueprint: `Lead → Qualificado → Proposta enviada → Negociação →
   Ganho (tipo ganha) | Perdido (tipo perdida)` + seed dos motivos de perda.
2. **Criar a view** `relacionamento.contas` sobre `pcm.clientes`.
3. **Depreciar `pcm.clientes.tipo` e `status_comercial`** — `comment on column` apontando o
   ADR-0020, sem backfill (não há o que preencher). Drop só depois de um ciclo com a UI nova
   em produção, em migration própria.
4. **`comercial.leads` NÃO é tocada nesta story.** Ver §4.3 — o drop depende da S09/S10.

**Conferência antes de dar por pronta:** reexecutar as contagens acima e confirmar que continuam
zeradas (alguém pode ter feito UAT do agente no meio do caminho). Se aparecer lead, o plano de
5 passos volta a valer — está preservado no histórico do git deste arquivo.

### 4.3 Por que `comercial.leads` sobrevive à S01 (e ao check de `vinculos`)

A tabela está **vazia**, mas **não está morta**: a Edge Function `pcm-ze-agent` está deployada em
produção e insere nela (`index.ts:543`), depois grava `atendimento.conversas.lead_id` e faz upsert
em `relacionamento.vinculos` com `entidade_tipo='comercial_lead'`. Zero linhas significa apenas que
o UAT de WhatsApp da E02-S09 nunca rodou — no dia em que a instância for conectada, esse caminho
executa.

Consequências para o sequenciamento:

- **A S01 não dropa `comercial.leads` nem remove `'comercial_lead'` do check de
  `relacionamento.vinculos`.** Fazer isso agora deixaria uma falha armada esperando o primeiro
  lead real.
- O drop pertence à **S10**, e só depois da **S09** (agente passa a chamar
  `comercial.fn_registrar_oportunidade`). A S10 também precisa tratar
  `atendimento.conversas.lead_id`, que é FK para a tabela.
- Enquanto isso, as duas convivem: `comercial.leads` como caminho legado do agente,
  `comercial.oportunidades` como o funil de verdade. Convivência **curta e declarada**, não dívida.

**Colunas reais de `comercial.leads`** (18, verificadas em produção — o design inicial listava 14):
`id, nome, email, telefone, origem, status, created_at, created_by, updated_at, updated_by,
deleted_at, score, resumo, conversa_id, origem_ref, contato_id, lead_tier, cluster_nome`.
`lead_tier` e `cluster_nome` vieram do scoring da E02-S18 e estão refletidas em
`comercial.oportunidades` (§2.1) — sem elas a S09 perderia dado na transição.

### 4.1 Achado colateral: `status_comercial` × `ativo` divergem em 6 Contas
Existem 6 Contas com `ativo=false` mas `status_comercial='ativo'`, todas sem `auvo_id` (provável
cadastro manual). Os dois campos deveriam concordar — é a evidência de que `status_comercial` é
redundante com `ativo` e deve mesmo sair. **Não corrigir os 6 nesta story**: `ativo` é a coluna
que fica e já está correta; a divergência morre com o drop da coluna deprecada.

### 4.2 Regra a valer daqui pra frente (decisão de produto, não de migração)
**Conta ativa não tem oportunidade aberta.** Quem já tem contrato não está em funil; pedido de
serviço extra é **Orçamento** no PCM (decisão 10 do `product.md`). Oportunidade nasce para Conta
sem contrato, ou para renovação/expansão de contrato existente — este segundo caso fica para a
S07 (contratos), não para a S01.

## 5. Correção do passivo de fronteira (decisão 11 do PO)

Stories próprias, paralelizáveis, cada uma com migration reversível e Playwright antes/depois:

| Story | Passivo | Correção |
|-------|---------|----------|
| S10 | `comercial.leads` escrita pelo Atendimento (viola R1) | o agente passa a chamar RPC `comercial.fn_registrar_oportunidade` — o Comercial vira dono de fato |
| S11 | **Duas tabelas de satisfação sobre a mesma OS** | **desativar a do Auvo**, manter a do portal como fonte única — ver §5.2 |
| S12 | `pcm.requisicoes_servico`/`orcamentos_servico`/`orcamento_decisoes` sem dono documentado | **ficam no PCM** (decisão 10: Orçamento extra-contratual é do PCM) — documenta o dono, publica view para o portal e fecha a E01-S14 |
| S13 | `atendimento.historico_chamado_snapshots` criada pelo PCM (viola R1) | move para `pcm.*` ou publica RPC do Atendimento — decidir na story, com o uso real na mão |

### 5.1 O que **não** vamos fazer: mover as tabelas do portal (decisão 13)

A análise inicial desta sessão classificou 7 tabelas em `pcm.*` criadas pela E09 como violação de
R1, e propunha um schema `portal` para onde migrá-las. **A premissa não se sustenta** e a proposta
foi descartada:

- `pcm.chamados_interacoes` e `pcm.os_notas` têm `autor_tipo ∈ ('cliente','interno')` — são dados
  **sobre entidades do PCM** (Chamado, OS), com o portal como **um dos dois canais** de escrita.
  Pelo próprio R1 (dono = quem governa o ciclo de vida da entidade), o PCM é dono legítimo.
- `pcm.requisicoes_servico`/`orcamentos_servico`/`orcamento_decisoes` idem — são o Fluxo B da
  operação, não do portal (decisão 10).
- Mover para `portal.*` criaria FKs de volta para `pcm.chamados`/`pcm.ordens_servico`, com todo o
  custo de renomear tabela, refazer RLS e reapontar código — **sem ganho de fronteira**.

**Correção:** o `ARCHITECTURE.md` passa a registrar essas tabelas como do PCM, com o portal
declarado como canal de escrita. A violação some por nomear certo, não por migrar.

### 5.2 Satisfação: o portal é a fonte única; a do Auvo é desativada (decisão do PO, 2026-08-10)

Existem duas tabelas medindo satisfação do cliente com uma OS:

| Tabela | Origem | Uso real (verificado no código) |
|--------|--------|--------------------------------|
| `pcm.satisfacao_respostas` (E01-S55) | pesquisa do Auvo, via `pcm-auvo-support-pull` | **nenhum** — só uma contagem no painel de diagnóstico de sync (`PainelDadosOperacionaisAuvo.tsx:49`) |
| `pcm.portal_satisfacao` (E09) | CSAT/NPS respondido pelo síndico no portal | **é a que vale** — lida por `features/area-cliente` |

**A Sinérgica não usa a pesquisa de satisfação do Auvo** (o PO confirmou; bate com a auditoria de
2026-07-10, que já registrava "pesquisa de satisfação nunca ativada"). Decisão: **desativar**, não
unificar.

O que a S11 faz:
1. **Desativa só o recurso `satisfactions`** da Edge Function `pcm-auvo-support-pull` — ela atende
   três (`questionnaires`, `expenses`, `satisfactions`); os outros dois continuam. Bônus: era o
   mais caro dos três (**1 GET por OS finalizada**, 20 por execução), então alivia a cota da API.
2. **`pcm.satisfacao_respostas` fica como espelho inativo** — dado histórico preservado, sem novas
   escritas. Não dropar: é espelho de sistema externo, e reativar é mudar uma flag.
3. **`pcm.portal_satisfacao` é declarada fonte canônica** de CSAT/NPS no `ARCHITECTURE.md` e no
   glossário. Qualquer indicador de satisfação (Visão 360, dashboards futuros, E08/Cockpit) lê dela.
4. Remove ou marca como inativa a contagem do painel de diagnóstico, para não parecer sync quebrado.

> Correção de uma afirmação anterior desta sessão: eu havia escrito que "o dashboard de qualidade
> reporta número diferente conforme a tela". Não procede — `satisfacao_respostas` não alimenta
> nenhum dashboard. O problema era menor do que descrito; a decisão de desativar continua válida.

> S13 mexe em produção que funciona. Se o custo se mostrar alto na spec, **reduzir escopo é decisão
> do PO** — não do agente que implementa.

## 6. Feature `apps/web/src/features/comercial/`

Hexagonal, igual ao Financeiro (E04) — não copiar o padrão de mock do protótipo:

```
domain/          precificacao.ts (fórmula pura), funil.ts (transição de etapa,
                 obrigatoriedade de motivo), proposta.ts (versionamento, status)
application/     comercial-gateway.ts (porta), casos de uso
infrastructure/  supabase-comercial-adapter.ts
pages/           FunilPage, ContasPage, PropostaEditorPage, ContratosPage,
                 ParametrosPrecoPage, DashboardComercialPage
```

**Regra de dependência:** `domain/` não importa nada de framework, I/O ou de outro contexto.
A Visão 360 é **reusada** — o Comercial não reimplementa a agregação do PCM; consome pela camada
publicada e acrescenta a própria aba.

## 7. Segurança

- RLS FORCE em toda tabela nova; `service_role` **não** escapa nas tabelas de negócio.
- Nada de `service_role` no client. Escrita cross-schema só por RPC `security definer` **com guarda
  manual de permissão** (mesmo padrão de `fn_rentabilidade_cliente_mes`, E04-S06).
- `comercial.portal_propostas` restrita por `config.usuario_cliente` — o síndico só vê a própria.
- Desconto abaixo do piso: exige `superadmin` **no banco** (não só na UI) e grava evento.
- Toda dívida de segurança que sobrar → `docs/SECURITY_DEBT.md`.

## 8. Perguntas em aberto (não bloqueiam a S01)

1. **`mo_inclui_inss_patronal`** — conferir uma vez, na S03, o que os encargos de
   `financeiro.custos_funcionario` já incluem (risco R7). A alíquota em si não é pergunta aberta:
   é configuração na tela do Financeiro (§3.1).
2. **Reajuste de contrato** — índice fixo (IGPM/IPCA) escolhido por contrato, ou tabela de índices
   com histórico? Decidir na S07.
3. **Proposta recusada** — a oportunidade volta para "Negociação" com nova versão, ou fecha como
   perdida? Decidir na S04 (afeta a métrica de conversão).

## Ver também
- `product.md` (mesma pasta) — decisões do PO, telas, non-goals
- `specs/E01-S14-fluxo-b-orcamento/design.md` — o Fluxo B, resolvido pela E09-S09 em `pcm.*`
- `specs/E04-S01-fundacao-financeiro/design.md` — molde deste documento
