-- ADR-1106: fontes e usos rastreáveis; função transacional vem em migration posterior.
create table comercial.sso_composicao_mista_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_composicao_mista_gate(id,habilitado) values(true,false);
create table comercial.sso_usos_fonte_aquisicao(
 fonte_id uuid primary key references comercial.sso_fontes_custo_aquisicao(id),proposta_id uuid not null references comercial.propostas(id),
 cliente_id uuid not null references pcm.clientes(id),request_id uuid not null,criado_em timestamptz not null default now()
);
create table comercial.sso_composicao_mista_comandos(
 request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
 payload jsonb not null,fontes_validadas jsonb not null,aquisicoes_validadas jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table comercial.sso_composicao_mista_gate enable row level security;alter table comercial.sso_composicao_mista_gate force row level security;
alter table comercial.sso_usos_fonte_aquisicao enable row level security;alter table comercial.sso_usos_fonte_aquisicao force row level security;
alter table comercial.sso_composicao_mista_comandos enable row level security;alter table comercial.sso_composicao_mista_comandos force row level security;
revoke all on comercial.sso_composicao_mista_gate,comercial.sso_usos_fonte_aquisicao,comercial.sso_composicao_mista_comandos from public,anon,authenticated,service_role;
create trigger sso_usos_fonte_aquisicao_imutaveis before update or delete on comercial.sso_usos_fonte_aquisicao for each row execute function pcm.sso_proteger_nota_reconciliacao();
create trigger sso_composicao_mista_comandos_imutaveis before update or delete on comercial.sso_composicao_mista_comandos for each row execute function pcm.sso_proteger_nota_reconciliacao();
