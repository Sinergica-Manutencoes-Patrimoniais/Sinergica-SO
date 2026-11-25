# Implementation Plan: Marketing — indicadores da Meta e rastreio até a venda

**Branch**: `feat/E06-S01-marketing-indicadores-meta` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/E06-S01-indicadores-meta-rastreio/spec.md` · ADR: [ADR-1699](../../docs/adr/1699-marketing-indicadores-meta-atribuicao.md)

## Summary

Dar ao módulo Marketing dado próprio: schema `marketing` com a hierarquia de anúncios da Meta e
métrica diária por anúncio, uma Edge Function idempotente que preenche essas tabelas (com
fixtures enquanto a Meta não está conectada), uma tela de indicadores com drilldown
campanha → conjunto → anúncio por período, e o rastreio anúncio → lead → oportunidade → contrato
para responder qual campanha gerou receita. Escrita na API da Meta está fora de escopo (FR-017).

Porte híbrido do produto irmão (TriviAtende): **a lógica e as fórmulas vêm de lá**, o schema, a
arquitetura e a segurança são daqui.

## Technical Context

**Language/Version**: TypeScript 5 (React 19 + Vite no front), Deno (Edge Functions), PL/pgSQL.

**Primary Dependencies**: Supabase (Postgres 15+, Edge Functions, Vault), TanStack Query,
Tailwind, `@sinergica/ui`, Zod (borda das functions), pgTAP, Vitest.

**Storage**: Postgres — schema de domínio `marketing` (já declarado em `0001_E00-S00`, ainda sem
tabela). Dinheiro em centavos inteiros (ADR-0001).

**Testing**: Vitest (`domain/`, `application/`), pgTAP (`supabase/tests/`, permitido **e** negado).

**Target Platform**: web (Netlify) + Supabase.

**Project Type**: web app em monorepo, DDD tático por feature.

**Performance Goals**: tela de indicadores de 90 dias de uma conta com ~200 anúncios responde em
uma consulta só; agregação por hierarquia acontece no cliente sobre o grão anúncio-dia.

**Constraints**: período máximo 366 dias (recusado na borda); `service_role` nunca no client;
credencial só no Vault; migrations aditivas na faixa reservada **1900–1919**.

**Scale/Scope**: 1 conta de anúncios, dezenas de campanhas, centenas de anúncios, ~1 linha de
métrica por anúncio e dia. 2 telas novas, 1 Edge Function, 1 migration, 2 flags.

## Constitution Check

| Princípio | Como esta story cumpre |
|---|---|
| I — `enable` + `force row level security` em schema do domínio | As 8 tabelas nascem com `enable` + `force`, GRANT explícito e policy chamando `config.sso_acesso_atual` (releitura ao vivo, E00-S27). |
| I — pgTAP com permitido **e** negado | `supabase/tests/marketing_indicadores_rls.test.sql` cobre leitura/escrita permitida, negada por falta de módulo, negada por só-leitura, e a negativa de `fn_receita_por_campanha` sem Comercial. |
| I — segredo no Vault, nunca no client | Token em `vault` sob nome fixo `marketing_meta_access_token`; leitura só por `marketing.fn_token_meta()`, `grant execute` apenas a `service_role`. Nenhuma resposta da função devolve o token nem seu indício. |
| I — Edge Function: CORS → auth → Zod → lógica → resposta sem stack | `marketing-sincronizar-meta` segue `_template/index.ts` literalmente; erro em `problem+json` com `reqId`. |
| I — permissão no servidor | Sincronizar/gerar link/vincular passam por RPC `security definer` que relê o claim; a UI é só conveniência. |
| II — migration aditiva, sequência sem pular | `1900_E06-S01_marketing_indicadores_meta.sql`, único arquivo, só `create`, reverso documentado no topo. |
| II — idempotência | `unique (anuncio_id, dia)` + `on conflict do update`; hierarquia por id externo. |
| II — dinheiro em centavos inteiros | `gasto_centavos bigint`; o transporte converte `spend` (string decimal da Meta) para centavos uma vez, na borda. |
| III — DDD por feature, domínios não se importam | `features/marketing/{domain,application,infrastructure,interfaces}`. Zero import de `features/comercial`. O encontro dos dois contextos é uma RPC só. |
| III — TanStack Query obrigatório | `application/marketing-queries.ts`, chaves em `marketingQueryKeys`, `placeholderData: keepPreviousData` no filtro de período. Nenhum `useEffect` buscando servidor. |
| III — ADR antes de implementar | ADR-1699, escrito antes desta `plan.md`. |
| IV — AC-N e task citando AC | `tasks.md` cita AC-1..AC-20; `eval:spec` cobre. |
| IV — fora de escopo vinculante | `MetaAdsPort` não declara nenhuma operação de escrita; nem método morto, nem botão desligado. |
| V — teste onde há regra | Toda fórmula de indicador e o link rastreado vivem em `domain/`, puros, com teste unitário. |

**Resultado**: sem violação. Sem linha em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/E06-S01-indicadores-meta-rastreio/
├── spec.md
├── plan.md               # este arquivo
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rpc-marketing.md
│   └── edge-marketing-sincronizar-meta.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/1900_E06-S01_marketing_indicadores_meta.sql
├── tests/marketing_indicadores_rls.test.sql
└── functions/
    ├── _shared/marketing/
    │   ├── meta-ads.ts                # porta + implementação HTTP + implementação fixture
    │   ├── meta-ads.test.ts
    │   └── fixtures/conta-demonstracao.json
    └── marketing-sincronizar-meta/index.ts

apps/web/src/
├── app/
│   ├── HomePage.tsx                   # ramo activeModulo === "marketing"
│   └── navegacao-sso.ts               # MarketingView + MARKETING_NAV
├── config/flags-sso.data.json         # 2 flags novas declaradas
└── features/marketing/
    ├── domain/
    │   ├── indicadores.ts  + .test.ts      # fórmulas, soma, árvore, ordenação
    │   ├── periodo.ts      + .test.ts      # atalhos, validação, período anterior
    │   ├── link-rastreado.ts + .test.ts    # montar/interpretar
    │   └── receita-campanha.ts + .test.ts  # linhas de receita, ordenação, campanha sem receita
    ├── application/
    │   ├── marketing-gateway.ts            # portas (interfaces)
    │   └── marketing-queries.ts + .test.ts # TanStack Query + marketingQueryKeys
    ├── infrastructure/
    │   └── marketing-supabase.ts           # adapter: RPCs e Edge Function
    └── interfaces/
        ├── IndicadoresMetaPage.tsx
        ├── ReceitaPorCampanhaPage.tsx
        └── componentes/{FiltroDePeriodo,CartaoIndicador,TabelaHierarquia}.tsx

netlify.toml · .env.example            # VITE_SSO_MARKETING_* declaradas
```

**Structure Decision**: DDD tático por feature como manda o `CLAUDE.md`. A estrutura
`modules/` + `surfaces/` do repositório de referência **não** vem junto; o que vem é a regra de
`domain/indicadores.ts` e `domain/link-rastreado.ts`.

---

## Detalhe técnico (o que `tasks.md` não repete)

### 1. Migration `1900_E06-S01_marketing_indicadores_meta.sql`

Tabelas (todas `enable` + `force row level security`, `revoke all from public, anon`, GRANT
explícito a `authenticated` e `service_role`):

```sql
marketing.contas_anuncio(
  id uuid pk, plataforma text not null default 'meta' check (plataforma = 'meta'),
  conta_externa_id text not null check (conta_externa_id ~ '^[0-9]{1,32}$'),
  nome text not null, moeda text not null default 'BRL' check (moeda ~ '^[A-Z]{3}$'),
  fuso text not null default 'America/Sao_Paulo', ativa boolean not null default true,
  sincronizada_em timestamptz, criado_em, atualizado_em,
  unique (plataforma, conta_externa_id))

marketing.campanhas(id, conta_id fk→contas_anuncio on delete cascade,
  campanha_externa_id text not null, nome text not null, objetivo text, situacao text,
  unique (conta_id, campanha_externa_id))

marketing.conjuntos(id, campanha_id fk→campanhas on delete cascade,
  conjunto_externo_id text not null, nome text not null, situacao text,
  unique (campanha_id, conjunto_externo_id))

marketing.anuncios(id, conjunto_id fk→conjuntos on delete cascade,
  anuncio_externo_id text not null, nome text not null, situacao text,
  unique (anuncio_externo_id))      -- global: o ad id da Meta é único na plataforma

marketing.metricas_anuncio_dia(
  anuncio_id uuid fk→anuncios on delete cascade, dia date not null,
  gasto_centavos bigint not null default 0 check (gasto_centavos >= 0),
  alcance bigint not null default 0 check (alcance >= 0),
  impressoes bigint not null default 0 check (impressoes >= 0),
  cliques bigint not null default 0 check (cliques >= 0),
  leads bigint not null default 0 check (leads >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (anuncio_id, dia),
  check (dia between date '2015-01-01' and current_date + 1))

marketing.links_rastreados(id, anuncio_id fk→anuncios on delete cascade,
  token text not null unique check (token ~ '^[a-z0-9]{12}$'),
  url_destino text not null check (url_destino ~ '^https://'),
  rotulo text, ativo boolean not null default true, criado_em, criado_por uuid→auth.users)

marketing.entradas_anuncio(id,
  anuncio_id uuid references marketing.anuncios(id),          -- null = sem origem (AC-14)
  link_id uuid references marketing.links_rastreados(id),
  token_recebido text,
  nome text, email text, telefone text,
  oportunidade_id uuid unique references comercial.oportunidades(id),  -- AC-15, ADR-1699 §2
  ocorrido_em timestamptz not null default now(), criado_em, criado_por)

marketing.sincronizacoes(id, conta_id fk→contas_anuncio,
  janela_de date not null, janela_ate date not null check (janela_ate >= janela_de),
  origem text not null check (origem in ('meta','demonstracao')),
  resultado text not null check (resultado in ('sucesso','falha')),
  campanhas int, conjuntos int, anuncios int, metricas int, detalhe text,
  concluida_em timestamptz not null default now())            -- append-only: só select+insert

marketing.sso_indicadores_meta_gate(id boolean pk default true check (id),
  habilitado boolean not null default false)
insert ... values (true, true)     -- gate ABERTO nesta migration (autorização do Lucas)
```

Índices: `metricas_anuncio_dia(dia)`, `campanhas(conta_id)`, `conjuntos(campanha_id)`,
`anuncios(conjunto_id)`, `entradas_anuncio(anuncio_id, ocorrido_em)`,
`entradas_anuncio(oportunidade_id) where oportunidade_id is not null`.

Policies: **releitura ao vivo**, não o claim do token —
`config.sso_acesso_atual('marketing', 'leitura' | 'escrita')` (E00-S27/ADR-1691, cobrado por
`scripts/check-revogacao-coberta.mjs`). Uma policy que lê `user_modulos` do JWT fica cega à
revogação até o token expirar: quem foi desligado continuaria lendo gasto de campanha com o token
que já tem no bolso. `delete` é só `superadmin`, e mesmo ele passa pela releitura.
`sincronizacoes` é append-only: GRANT só `select, insert` (nem superadmin reescreve histórico).
`sso_indicadores_meta_gate`: GRANT `select` a `authenticated`, nenhuma escrita.

RPCs:

| Função | Segurança | Autorização | Papel |
|---|---|---|---|
| `marketing.fn_metricas_periodo(p_de date, p_ate date)` | `stable` (invoker) | RLS das tabelas (releitura ao vivo) | devolve o grão anúncio-dia agregado por anúncio com a hierarquia resolvida (campanha/conjunto/anúncio id+nome+situação). Recusa `p_ate < p_de` e janela > 366 dias com `22023`. |
| `marketing.fn_receita_por_campanha(p_de date, p_ate date)` | `security definer` | `sso_acesso_atual` em `marketing` **e** `comercial`, senão `42501` | por campanha: gasto, leads, oportunidades, contratos, receita em centavos. Única travessia Marketing↔Comercial (ADR-1699 §2). |
| `marketing.fn_registrar_entrada_anuncio(p_token, p_nome, p_email, p_telefone, p_ocorrido_em)` | `security definer` | `sso_acesso_atual('marketing','escrita')` | resolve token → anúncio; token ausente/desconhecido grava `anuncio_id` nulo (AC-14). |
| `marketing.fn_vincular_oportunidade(p_entrada_id, p_oportunidade_id)` | `security definer` | `sso_acesso_atual` em `marketing`:escrita **e** `comercial`:leitura | grava o vínculo; `unique` do banco garante AC-15. |
| `marketing.fn_token_meta()` | `security definer` | `grant execute` só a `service_role` | lê `vault.decrypted_secrets` com **nome fixo**, nunca por parâmetro. |

`fn_metricas_periodo` devolve **uma linha por anúncio** com as somas do período (não o grão
diário): a hierarquia e os derivados são montados no `domain/` do front, onde dá para testar.

### 2. Fórmulas (`domain/indicadores.ts`) — porte literal da regra do produto irmão

Dois princípios atravessam tudo, e são a diferença entre um relatório que mente e um que não:

1. **Zero confirmado ≠ indisponível.** Indicador sem base de cálculo é `null` e a tela mostra
   `—`, nunca `0`. Daí `temNumeros` existir separado de `gastoCentavos === 0`.
2. **Alcance não se deduplica para trás.** A Meta devolve alcance por dia; somar dias conta a
   mesma pessoa várias vezes. A coluna existe, a soma é exibida **rotulada** como
   "Alcance (soma diária)" com a explicação ao lado — nunca apresentada como pessoas distintas do
   período.

```ts
const INDISPONIVEL = null;
function dividir(num: number | null, den: number): number | null {
  return num === null || den <= 0 ? null : num / den;
}
function custo(gastoCentavos: number, quantidade: number): number | null {
  return gastoCentavos > 0 && quantidade > 0 ? gastoCentavos / quantidade : null;
}

indicadores(somas) = {
  ...somas,
  cpmCentavos:   somas.gastoCentavos > 0 && somas.impressoes > 0
                   ? (somas.gastoCentavos / somas.impressoes) * 1000 : null,
  ctr:           dividir(somas.cliques, somas.impressoes),
  cpcCentavos:   custo(somas.gastoCentavos, somas.cliques),
  custoPorLeadCentavos: custo(somas.gastoCentavos, somas.leads),   // AC-5
}
```

Diferença deliberada entre os dois ajudantes: **taxa** só exige denominador > 0 (numerador zero é
`0`, resultado legítimo); **custo** exige gasto > 0 **e** quantidade > 0 (custo por lead sem gasto
não é "R$ 0,00", é desconhecido).

`somar(linhas)` acumula campo a campo e faz `temNumeros` por OR.
`arvoreDoRelatorio(linhas)` agrupa `campanha → conjunto → anúncio` com `Map` preservando a ordem
de chegada (a RPC já ordena por nome), e em cada nó calcula `indicadores(somar(filhos))` — é isso
que faz AC-2 ser verdade por construção.
`ordenarPor(itens, indicador, sentido)` joga `null` sempre para o fim nos dois sentidos, com
desempate por nome em `pt-BR`; `MENOR_E_MELHOR = {custoPorLead, cpc, cpm}`.

`domain/periodo.ts`: datas de calendário `AAAA-MM-DD`, sem hora e sem fuso (comparação por
string); `ultimosDias(n)`, `mesAtual()`, `periodoAnterior(p)`,
`problemaDoPeriodo(p, maximoDias = 366)` → `'Escolha as duas datas.'` |
`'A data final vem depois da inicial.'` | `` `O período vai até ${n} dias.` ``.

### 3. Link rastreado (`domain/link-rastreado.ts`)

- `token`: 12 caracteres `[a-z0-9]`, gerado no servidor (`gen_random_uuid()` em hex, cortado).
- `montarLinkRastreado(origem, token)` → `` `${origem.replace(/\/+$/, "")}/e/${token}` ``.
- `interpretarLinkRastreado(url)` → `token | null`. Aceita o token tanto no caminho `/e/<token>`
  quanto no parâmetro `?rastreio=<token>`; qualquer outra coisa devolve `null` — **nunca** chuta
  anúncio (AC-14).
- `MODELO_DE_PARAMETROS_META` documenta o que colar no campo "parâmetros de URL" da Meta:
  `utm_source=meta&utm_medium=pago&campanha_id={{campaign.id}}&conjunto_id={{adset.id}}&anuncio_id={{ad.id}}`.
  Nesta entrega esses parâmetros são exibidos para cópia; consumi-los automaticamente depende do
  endpoint público de clique, que é a story seguinte.

### 4. Edge Function `marketing-sincronizar-meta`

Ordem: CORS → `requireAuth` → Zod → autorização → lógica → resposta. Corpo:
`{ contaId: uuid, janelaDias?: 1..90 (padrão 7) }`.

```ts
export interface MetaAdsPort {            // SÓ LEITURA — FR-017/SC-006
  hierarquia(contaExternaId: string): Promise<HierarquiaLida>;
  numerosDiarios(contaExternaId: string, de: string, ate: string): Promise<NumeroDoDia[]>;
}
```

- `MetaAdsHttp` — `GET https://graph.facebook.com/<versao>/act_<id>/ads` e
  `.../insights?level=ad&time_increment=1&time_range={since,until}`.
  Campos: `id,name,effective_status,adset{id,name,effective_status},campaign{id,name,effective_status,objective}`
  e `ad_id,spend,impressions,reach,inline_link_clicks,actions`.
  `filtering=[{field:'ad.effective_status',operator:'IN',value:[ACTIVE,PAUSED,ARCHIVED,DELETED,
  CAMPAIGN_PAUSED,ADSET_PAUSED,PENDING_REVIEW,DISAPPROVED,IN_PROCESS,WITH_ISSUES]}]` —
  **sem isso, anúncio arquivado some e o gasto fica menor que o Gerenciador da Meta**.
  Leads = soma dos `actions` com `action_type` em `{lead, onsite_conversion.lead_grouped,
  offsite_conversion.fb_pixel_lead}`. `spend` vem como string decimal → centavos com
  `Math.round(Number(spend) * 100)`. Token sempre em `Authorization: Bearer`, **nunca** na URL,
  nunca em log. `AbortSignal.timeout(9_000)`, `redirect: "error"`.
- `MetaAdsFixture` — lê `fixtures/conta-demonstracao.json`, determinístico, com datas relativas a
  um "hoje" recebido por parâmetro para o teste não envelhecer.
- Escolha: `const token = await fnTokenMeta(); const porta = token ? http(token) : fixture();`
  A resposta sempre carrega `origem: "meta" | "demonstracao"` (AC-10), e o mesmo valor é gravado
  em `marketing.sincronizacoes` (AC-11).
- **Janela**: `[hoje - (janelaDias - 1), hoje]`, padrão 7. Reprocessar é o normal, não a exceção —
  a Meta revisa números retroativamente (atribuição tardia, remoção de fraude).
- **Idempotência**: upsert da hierarquia por id externo com `coalesce(excluded.X, atual.X)`
  (valor ausente não apaga o que já existe) e das métricas por `(anuncio_id, dia)`.
- Falha: grava `resultado = 'falha'` com `detalhe` (código, nunca corpo da resposta da Meta nem
  token) e devolve `problem+json` com `reqId`.

### 5. Front

- `marketingQueryKeys = { raiz: ["marketing"], indicadores: (de, ate) => [...], receita: (de, ate) => [...], sincronizacoes: () => [...] }`.
- `useIndicadores(de, ate)` com `placeholderData: keepPreviousData` — AC-7, resultado antigo nunca
  sobrescreve o período novo. Após `useSincronizar()`, invalidar `marketingQueryKeys.raiz`.
- `IndicadoresMetaPage`: faixa de atalhos de período (7 / 30 / 90 / livre, padrão 30), cartões
  (Gasto, Impressões, Cliques, CTR, CPC, Leads, Custo por lead, Alcance (soma diária)), tabela
  hierárquica colapsável com a primeira coluna `sticky left-0`, e uma tarja declarando
  `origem === "demonstracao"` quando for o caso.
- Estados: carregando (skeleton `aria-busy`), vazio (AC-4, texto "Nenhuma veiculação no período"),
  erro (AC-6, mensagem + "Tentar de novo"), período inválido (mensagem de `problemaDoPeriodo`).
- `ReceitaPorCampanhaPage`: tabela por campanha com Gasto, Leads, Oportunidades, Contratos,
  Receita, ordenável por receita; campanha sem atribuição aparece com receita zero (AC-18); erro
  `42501` da RPC vira "Você precisa de acesso ao Comercial para ver receita por campanha" (AC-17).
- `HomePage.tsx`: ramo `activeModulo === "marketing"` com `marketingView`; com a flag desligada,
  `<RecursoNaoAtivado recurso="Marketing · Indicadores da Meta" />` — a área não some (AC-20).
- `navegacao-sso.ts`: `export type MarketingView = "indicadores" | "receita-campanha"` e
  `MARKETING_NAV` com os dois itens nomeados (AC-19).
- Flags: `VITE_SSO_MARKETING_INDICADORES_ENABLED` e
  `VITE_SSO_MARKETING_RECEITA_CAMPANHA_ENABLED`, declaradas em `flags-sso.data.json`
  (jornada `outra`, gate `marketing.sso_indicadores_meta_gate`), `.env.example` e `netlify.toml`
  com `"true"`.

### 6. O que falta para ligar a Meta de verdade

Um **token de sistema da Meta com escopo `ads_read`** (não `ads_management` — não vamos escrever),
gravado no Vault sob o nome exato `marketing_meta_access_token`, via
`config.fn_definir_segredo_integracao('marketing_meta_access_token', '<token>')` executada por um
superadmin. Mais a linha em `marketing.contas_anuncio` com o `conta_externa_id` (os dígitos de
`act_<id>`). Com os dois presentes, a próxima sincronização sai sozinha do modo demonstração;
nenhum código muda.

## Complexity Tracking

Sem violação da constituição. Nada a justificar.
