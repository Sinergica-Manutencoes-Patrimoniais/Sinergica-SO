# Plano técnico — E01-S188 Ativação governada

> Detalhe técnico da story. AC referenciados vêm de `spec.md`.

## Âncoras no código existente

| O que | Onde |
|---|---|
| Padrão de gate | `create table <schema>.<nome>_gate(id boolean primary key default true check(id), habilitado boolean not null default false)` — 585 ocorrências |
| Gate que é **mecanismo**, não feature | `pcm.sso_guarda_multiplas_os_gate` (migration 1499) — deve ficar **aberto** após a 1842 |
| Flags de build | `import.meta.env.VITE_SSO_*_ENABLED` — 737 nomes distintos em `apps/web/src` |
| Verificação de CI já existente, a imitar | `scripts/lint-migrations.mjs` (DROP com reverso, CREATE POLICY com GRANT) |
| Padrão de função mediada atrás de gate | `pcm.sso_informar_material_mediado` (migration 1061) |
| Armadilha de transação | A GitHub Integration **não** roda migration em transação. O que precisa ser atômico vai num `do $$ ... $$` com DDL por `execute`. Ver cabeçalho da `1842` e `.squawk.toml` |

## Modelo de dados

Schema `config`.

```
config.sso_jornadas
  codigo text primary key           -- 'chamado-multiplas-os', 'central-materiais', 'despacho-t24'
  titulo text not null              -- nome que a operação reconhece
  descricao text not null
  ativavel boolean not null default true   -- false para jornada ainda em construção

config.sso_jornada_requisitos
  id uuid primary key
  jornada_codigo text not null references config.sso_jornadas(codigo)
  camada text not null check (camada in ('gate','flag','grant'))
  identificador text not null       -- 'pcm.chamado_os_gate' | 'VITE_SSO_X_ENABLED' | assinatura da função
  papel text not null check (papel in ('ativacao','mecanismo'))
                                    -- 'mecanismo' = deve ficar aberto; nunca entra em "fechar tudo"
  estado_alvo boolean not null      -- o que "aberto para esta jornada" significa neste item
  ordem integer not null            -- ordem de abertura; retorno é a inversa
  motivo text not null              -- por que este item existe
  retorno text not null             -- como desfazer esta etapa
  unique (jornada_codigo, camada, identificador)

config.sso_jornada_eventos        -- append-only
  id uuid primary key
  jornada_codigo text not null
  direcao text not null check (direcao in ('abrir','retornar'))
  etapa text not null
  ator_id uuid not null
  motivo text not null
  criado_em timestamptz not null default now()
```

RLS FORCE nas três. `revoke all` de `public, anon, authenticated, service_role` — o acesso é só
pelas funções mediadas abaixo. Trigger append-only em `sso_jornada_eventos` (reusar o padrão de
`pcm.sso_proteger_conferencia_levantamento`).

## Funções

**`config.sso_diagnosticar_jornada(p_codigo text) returns jsonb`** — AC-4, AC-5, AC-6.
`security definer`, exige `papel = 'superadmin'` ativo. Para cada requisito:

- `camada='gate'`: lê `habilitado` da tabela nomeada via `execute format(...)` com `to_regclass`
  conferido antes — identificador inexistente devolve `estado: 'inexistente'`, nunca erro cru.
- `camada='grant'`: `has_function_privilege('authenticated', <oid>, 'execute')`.
- `camada='flag'`: o banco **não enxerga** o build. Lê de `config.sso_flags_publicadas`
  (ver abaixo) e marca `origem: 'declarado'` quando não houver registro publicado.

Retorna `{ jornada, utilizavel: boolean, faltando: [...], itens: [...] }`.

**`config.sso_registrar_flags_publicadas(p_build text, p_flags jsonb)`** — alimenta o estado real
das flags. Chamada por um passo do build do front (Netlify) com a chave de serviço, gravando quais
`VITE_SSO_*` saíram `true` naquele build e o identificador do deploy. É isso que torna AC-6
verificável em vez de suposição.

**`config.sso_abrir_jornada(p_request_id uuid, p_codigo text, p_motivo text)`** — AC-7, AC-9.
Idempotente por `request_id`. Antes de abrir qualquer gate, chama o diagnóstico: se faltar `grant`
ou `flag`, recusa com `ativacao_incompleta` (`55000`). Abre os gates na `ordem`, dentro de um
único `do $$ ... $$`, registrando um evento por etapa.

**`config.sso_retornar_jornada(p_request_id uuid, p_codigo text, p_motivo text)`** — AC-8.
Ordem inversa; só mexe em requisitos com `papel = 'ativacao'`. **Nunca** toca em `papel =
'mecanismo'` e nunca apaga dado produzido.

Todas revogadas de `public, anon, authenticated, service_role`; grant para `authenticated` só nas
duas de leitura/abertura, com a checagem de papel dentro.

## Verificação de CI (FR-004)

Estender `scripts/lint-migrations.mjs`:

1. **Registro íntegro** (AC-2): todo `identificador` com `camada='gate'` existe como tabela no
   conjunto cumulativo de migrations; todo `grant` tem função correspondente; toda `flag` aparece
   em `apps/web/src`. Falha nomeia o item órfão.
2. **Gate novo sem jornada**: migration que cria `*_gate` sem inserir requisito correspondente —
   **aviso**, não erro, enquanto as 585 existentes não estiverem declaradas. Vira erro quando a
   declaração alcançar as jornadas ativas.

## Front

Uma tela só, em `apps/web/src/features/config/interfaces/ativacao/`, atrás de
`VITE_SSO_DIAGNOSTICO_ATIVACAO_ENABLED`. Lista as jornadas com um selo — utilizável / falta X —
e, ao abrir uma, as três camadas com o que falta em cada. TanStack Query, chave em
`config-queries.ts`, sem `useState`+`useEffect` para dado de servidor.

Botões de abrir e retornar exigem confirmação digitada com o código da jornada e motivo obrigatório.

## Testes

**pgTAP** (`supabase/tests/E01-S188_*.test.sql`):
- diagnóstico aponta exatamente a camada faltante nos três casos (só gate, só grant, só flag);
- não superadmin é recusado (AC-5);
- abrir com grant faltando é recusado com `ativacao_incompleta` (AC-9);
- abrir é idempotente por `request_id`; replay devolve o mesmo recibo;
- abrir e retornar deixa os gates no estado inicial, e **dado criado no meio sobrevive** (AC-8);
- requisito com `papel='mecanismo'` não é fechado pelo retorno;
- eventos são append-only (update e delete recusados).

**Vitest**: a tela mostra as três camadas e o que falta; confirmação exige o código digitado.

## Ordem sugerida de implementação

1. Migration do modelo + RLS + append-only.
2. `sso_diagnosticar_jornada` + pgTAP do diagnóstico.
3. `sso_registrar_flags_publicadas` + passo no build do front.
4. `sso_abrir_jornada` / `sso_retornar_jornada` + pgTAP.
5. Declaração das 3 jornadas do piloto (dados, em migration).
6. Verificação de CI.
7. Tela.

## Riscos

- **Identificador dinâmico em `execute format`**: sempre conferir com `to_regclass`/`to_regprocedure` antes, nunca interpolar direto.
- **Declarar jornada errada é pior que não declarar**: por isso AC-2 é verificação de CI, não documentação.
- **A flag publicada depende de um passo no build do front.** Se esse passo não existir, AC-6 degrada para "declarado" — aceitável na primeira entrega, desde que a tela diga isso em vez de afirmar estado que não conhece.
