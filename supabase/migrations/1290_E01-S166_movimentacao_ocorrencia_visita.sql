-- ADR-1128: histórico de programação sem alterar vencimento original.
create table pcm.sso_mudanca_dia_ocorrencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_mudanca_dia_ocorrencia_gate(id,habilitado) values(true,false);
create table pcm.sso_movimentos_ocorrencias_dia(
 request_id uuid not null,ocorrencia_id uuid not null references pcm.ocorrencias_visita_preparadas(id),
 visita_id uuid not null references pcm.visitas(id),cliente_id uuid not null references pcm.clientes(id),
 vencimento_original date not null check(isfinite(vencimento_original)),inicio_anterior timestamptz not null check(isfinite(inicio_anterior)),
 inicio_novo timestamptz not null check(isfinite(inicio_novo)),revisao_visita integer not null check(revisao_visita>1),
 ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),primary key(request_id,ocorrencia_id),unique(ocorrencia_id,revisao_visita)
);
alter table pcm.sso_mudanca_dia_ocorrencia_gate enable row level security;
alter table pcm.sso_mudanca_dia_ocorrencia_gate force row level security;
alter table pcm.sso_movimentos_ocorrencias_dia enable row level security;
alter table pcm.sso_movimentos_ocorrencias_dia force row level security;
revoke all on pcm.sso_mudanca_dia_ocorrencia_gate,pcm.sso_movimentos_ocorrencias_dia from public,anon,authenticated,service_role;
create trigger sso_movimentos_ocorrencias_dia_imutaveis before update or delete on pcm.sso_movimentos_ocorrencias_dia
 for each row execute function pcm.sso_proteger_supressao_semana();
