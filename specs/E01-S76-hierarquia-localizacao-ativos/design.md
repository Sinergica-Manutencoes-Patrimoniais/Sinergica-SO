---
name: design-E01-S76-hierarquia-localizacao-ativos
description: Technical Design Doc — schema, RLS, camadas DDD, integração Auvo (Sistema como Equipment).
alwaysApply: false
tier: arquitetural
---

# Design — Hierarquia de localização de ativos + Sistemas

## Decisões-chave
- **D1 — Estender `pcm.equipamentos` em vez de criar `pcm.itens`.** A tabela já sincroniza com Auvo
  (descriptor `pcmTable:'equipamentos'`, triggers de outbox) e tem 2000+ linhas de produção. Colunas
  aditivas nullable/default são seguras; tabela nova exigiria migrar dados + refazer o pipeline Auvo.
  O **conceito** vira "Item" na UI/domínio; o nome físico da tabela permanece. (→ ADR-0009)
- **D2 — Sistema vai ao Auvo como Equipment (`/equipments`), push-only e `writeEnabled:false`.** Decisão
  do PO: Sistema é um ativo associado ao cliente, deve aparecer no seletor de equipamento da tarefa no
  campo; o "código" é o `identifier`/id Auvo. Reusa o motor genérico `pcm-auvo-push`. Sem `webhookEntity`
  nem `cronSchedule` (PCM é dono do Sistema; evita colisão com o inbound Equipment(27)).
- **D3 — Local em árvore** (`parent_id` self-ref) com `area_id` denormalizado + trigger de validação.
- **D4 — Área sempre presente**; `item.local_id` nullable (backfill gradual).

## Schema — migration `supabase/migrations/0095_E01-S76_hierarquia_localizacao_ativos.sql`
Padrão da casa (ver `0032_E01-S29_equipamentos.sql`): schema `pcm`, colunas de auditoria
(`created_at/by, updated_at/by, deleted_at`), `enable`+`force row level security`, **GRANT obrigatório**,
políticas por claim JWT, DDL idempotente, bloco `-- Reverso:`.

```sql
-- pcm.areas
create table if not exists pcm.areas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references pcm.clientes(id),
  nome text not null,
  descricao text,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid references auth.users,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users,
  deleted_at timestamptz
);
create unique index if not exists uq_areas_cliente_nome
  on pcm.areas (cliente_id, lower(nome)) where deleted_at is null;
create index if not exists idx_areas_cliente on pcm.areas (cliente_id) where deleted_at is null;

-- pcm.locais (árvore)
create table if not exists pcm.locais (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references pcm.areas(id),
  parent_id uuid references pcm.locais(id),
  nome text not null,
  tipo text,                       -- livre/nullable: 'andar'|'sala'|'ambiente'|...
  descricao text,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid references auth.users,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users,
  deleted_at timestamptz
);
create index if not exists idx_locais_area on pcm.locais (area_id) where deleted_at is null;
create index if not exists idx_locais_parent on pcm.locais (parent_id) where deleted_at is null;

-- Trigger: valida consistência de área + ausência de ciclo (INV 1 e 2)
create or replace function pcm.fn_locais_valida_hierarquia() returns trigger
language plpgsql as $$
declare v_area uuid; v_cursor uuid; v_guard int := 0;
begin
  if new.parent_id is not null then
    select area_id into v_area from pcm.locais where id = new.parent_id;
    if v_area is null or v_area <> new.area_id then
      raise exception 'Local pai deve pertencer à mesma Área';
    end if;
    v_cursor := new.parent_id;
    while v_cursor is not null loop
      if v_cursor = new.id then raise exception 'Ciclo de Local detectado'; end if;
      v_guard := v_guard + 1; if v_guard > 100 then raise exception 'Profundidade excessiva'; end if;
      select parent_id into v_cursor from pcm.locais where id = v_cursor;
    end loop;
  end if;
  return new;
end $$;
create trigger trg_locais_valida_hierarquia
  before insert or update on pcm.locais
  for each row execute function pcm.fn_locais_valida_hierarquia();

-- pcm.sistemas (com colunas de sync Auvo — espelha equipamentos)
create table if not exists pcm.sistemas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references pcm.clientes(id),
  area_id uuid references pcm.areas(id),        -- escopo opcional a uma Área
  nome text not null,
  tipo text,                                     -- classificação opcional (hidrante/incêndio/spda/...)
  descricao text,
  ativo boolean not null default true,
  auvo_id bigint unique,
  auvo_equipment_id bigint unique,
  codigo text,                                   -- identifier recebido do Auvo
  auvo_sync_status text not null default 'pending',
  auvo_sync_error text,
  auvo_synced_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid references auth.users,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users,
  deleted_at timestamptz
);
create index if not exists idx_sistemas_cliente on pcm.sistemas (cliente_id) where deleted_at is null;
create trigger trg_sistemas_auvo_enqueue
  after insert or update or delete on pcm.sistemas
  for each row execute function pcm.fn_auvo_enqueue('sistemas');

-- pcm.sistema_itens (N:N)
create table if not exists pcm.sistema_itens (
  id uuid primary key default gen_random_uuid(),
  sistema_id uuid not null references pcm.sistemas(id),
  item_id uuid not null references pcm.equipamentos(id),
  created_at timestamptz not null default now(), created_by uuid references auth.users
);
create unique index if not exists uq_sistema_item on pcm.sistema_itens (sistema_id, item_id);
create index if not exists idx_sistema_itens_item on pcm.sistema_itens (item_id);

-- Extensão de pcm.equipamentos (aditivo, seguro em produção)
alter table pcm.equipamentos add column if not exists local_id uuid;
alter table pcm.equipamentos add column if not exists tipo text not null default 'equipamento';
alter table pcm.equipamentos add column if not exists parent_item_id uuid;
alter table pcm.equipamentos
  add constraint chk_equipamentos_tipo check (tipo in ('equipamento','componente')) not valid;
alter table pcm.equipamentos
  add constraint fk_equipamentos_local foreign key (local_id) references pcm.locais(id) not valid;
alter table pcm.equipamentos
  add constraint fk_equipamentos_parent foreign key (parent_item_id) references pcm.equipamentos(id) not valid;
create index if not exists idx_equipamentos_local on pcm.equipamentos (local_id) where deleted_at is null;
```

**RLS** (todas as tabelas novas + `sistema_itens`): `enable`+`force`, `grant usage on schema pcm`,
`grant select,insert,update on <tabela> to authenticated`, `grant ... delete to service_role`. Políticas:
- SELECT: `user_role='superadmin' or user_modulos->>'pcm' in ('leitura','escrita')`.
- INSERT/UPDATE/DELETE: `user_role='superadmin' or user_modulos->>'pcm' = 'escrita'` (UPDATE com `using`+`with check`).

**Migration `0096_E01-S76_validate_constraints.sql`** — `validate constraint` das 3 constraints NOT VALID
(padrão split da casa 0070/0071). Reverso documentado.

## Camadas — `apps/web/src/features/pcm/` (espelhar fatia `qualidade`)
- **domain/** `hierarquia.ts` (Area, Local árvore, `montarArvore`, validadores INV 1/2/7) · `sistemas.ts`
  (Sistema, validadores INV 5/6) · estender `equipamentos.ts` (add `localId, tipo, parentItemId`; tipo
  `ItemContexto` = caminho de instalação + sistemas). Cada um com `*.test.ts` (Vitest).
- **application/** `hierarquia-gateway.ts` (porta) + `hierarquia.ts` (use-cases: `listarAreas`, `criarArea`,
  `criarLocal`, `moverLocal`, `arvoreDoCliente`) · `sistemas-gateway.ts` + `sistemas.ts` (CRUD, `adicionarItem`,
  `removerItem`, `listarItensDoSistema`) · estender equipamentos com `obterContextoItem(itemId)`.
- **infrastructure/** `supabase-hierarquia-adapter.ts` · `supabase-sistemas-adapter.ts` · estender
  `supabase-equipamentos-adapter.ts` (novas colunas + join `sistema_itens` + breadcrumb `locais`→`areas`→`clientes`).
  Tipos `*Row` manuais + mappers (não há geração de tipos ativa). Cliente único de `lib/supabase-client.ts`.

## UI — `HomePage.tsx` (router-por-`useState`)
Para cada tela nova: add literal em `PcmView`, item em `PCM_NAV`, branch no render, gate `podeAcessar('pcm','leitura')`.
- **Estrutura do cliente** — árvore Área>Local com CRUD (aba em `VisaoClientePage.tsx` ou página dedicada). Criação customizável.
- **Detalhe do Item** — breadcrumb **Cliente > Área > Local** + chips **"faz parte de: <sistemas>"**; componentes filhos listados sob o equipamento pai.
- **Sistemas** — CRUD + seletor de itens membros + exibe `codigo`/status de sync.
- **`EquipamentosPage.tsx`** — filtro por `tipo`, atribuição de `local_id`, `parent_item_id` para componente.

## Auvo — descriptor Sistema
`supabase/functions/_shared/auvo/registry/sistemas.ts` (espelhar `ferramentas.ts`):
`key:'sistemas'`, `auvoBasePath:'/equipments'`, `pcmTable:'sistemas'`, `deleteStrategy:'soft-patch'`
(`active:false`), **`writeEnabled:false`**, `toAuvo`: `name=nome`, `associatedCustomerId=<auvo_id do cliente>`,
`identifier=codigo`. Sem `webhookEntity`/`cronSchedule`. Registrar em `registry/index.ts`. `codigo` volta no POST/pull.

**Risco a resolver antes do flip `writeEnabled:true` (follow-up):** o Sistema empurrado como Equipment volta
no pull/webhook de Equipment(27) e o descriptor `equipamentos` criaria linha-fantasma em `pcm.equipamentos`.
Mitigação: no upsert de equipment, excluir `auvo_equipment_id` presentes em `pcm.sistemas`. Pré-condição documentada.

## Alternativas consideradas
- Tabela `pcm.itens` nova (rejeitada — migração + refazer pipeline Auvo, D1).
- Sistema como Product `/products` (rejeitado — não associa cliente nem aparece na tarefa; PO escolheu Equipment, D2).
- Local plano 1-nível (rejeitado — PO escolheu árvore, D3).
