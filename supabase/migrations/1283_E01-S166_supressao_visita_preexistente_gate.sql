-- ADR-1125: capacidade preparada; permanece fechada até consumidores e provas.
create table pcm.sso_supressao_visita_preexistente_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_supressao_visita_preexistente_gate(id,habilitado) values(true,false);
alter table pcm.sso_supressao_visita_preexistente_gate enable row level security;
alter table pcm.sso_supressao_visita_preexistente_gate force row level security;
revoke all on pcm.sso_supressao_visita_preexistente_gate from public,anon,authenticated,service_role;
create table pcm.sso_visitas_suprimidas_feriado(
 visita_id uuid primary key references pcm.visitas(id),supressao_id uuid not null unique references pcm.sso_supressoes_semana_feriado(id),
 cliente_id uuid not null references pcm.clientes(id),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
alter table pcm.sso_visitas_suprimidas_feriado enable row level security;
alter table pcm.sso_visitas_suprimidas_feriado force row level security;
revoke all on pcm.sso_visitas_suprimidas_feriado from public,anon,authenticated,service_role;
create trigger sso_visitas_suprimidas_feriado_imutaveis before update or delete on pcm.sso_visitas_suprimidas_feriado
 for each row execute function pcm.sso_proteger_supressao_semana();
