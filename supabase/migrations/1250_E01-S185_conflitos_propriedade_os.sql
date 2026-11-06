-- ADR-1102: quarentena privada; não transfere observações ou altera a OS.
create table pcm.sso_conflitos_propriedade_os(
 os_id uuid primary key references pcm.ordens_servico(id),cliente_observacao_id uuid not null references pcm.clientes(id),
 cliente_atual_id uuid not null references pcm.clientes(id),revisao integer not null check(revisao>0),
 atualizado_em timestamptz not null default now(),check(cliente_observacao_id<>cliente_atual_id)
);
create table pcm.sso_conflitos_propriedade_os_eventos(
 os_id uuid not null references pcm.sso_conflitos_propriedade_os(os_id),revisao integer not null check(revisao>0),
 request_id uuid not null,cliente_observacao_id uuid not null references pcm.clientes(id),cliente_atual_id uuid not null references pcm.clientes(id),
 criado_em timestamptz not null default now(),primary key(os_id,revisao),unique(os_id,request_id),
 check(cliente_observacao_id<>cliente_atual_id)
);
alter table pcm.sso_conflitos_propriedade_os enable row level security;alter table pcm.sso_conflitos_propriedade_os force row level security;
alter table pcm.sso_conflitos_propriedade_os_eventos enable row level security;alter table pcm.sso_conflitos_propriedade_os_eventos force row level security;
revoke all on pcm.sso_conflitos_propriedade_os,pcm.sso_conflitos_propriedade_os_eventos from public,anon,authenticated,service_role;
create trigger sso_conflitos_propriedade_os_eventos_imutaveis before update or delete on pcm.sso_conflitos_propriedade_os_eventos
 for each row execute function pcm.sso_proteger_nota_reconciliacao();
