-- ADR-1360: preparação de candidata local; sem efeito externo.
create table pcm.sso_t24_emergencial_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_t24_emergencial_gate(id,habilitado) values(true,false);
create table pcm.sso_t24_categoria_reparo(
  tentativa_id uuid primary key references pcm.sso_t24_tentativas(id),
  categoria text not null check(categoria in ('corretiva','emergencial')),
  criado_em timestamptz not null default now()
);
alter table pcm.sso_t24_emergencial_gate enable row level security;
alter table pcm.sso_t24_emergencial_gate force row level security;
alter table pcm.sso_t24_categoria_reparo enable row level security;
alter table pcm.sso_t24_categoria_reparo force row level security;
revoke all on pcm.sso_t24_emergencial_gate,pcm.sso_t24_categoria_reparo from public,anon,authenticated,service_role;
create trigger sso_t24_categoria_reparo_imutavel before update or delete on pcm.sso_t24_categoria_reparo
  for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function pcm.sso_t24_categoria_reparo_permitida(p_categoria text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare v_habilitado boolean;
begin
  if p_categoria='corretiva' then return true; end if;
  if p_categoria is distinct from 'emergencial' then return false; end if;
  select habilitado into v_habilitado from pcm.sso_t24_emergencial_gate where id for share;
  return coalesce(v_habilitado,false);
end; $$;
revoke all on function pcm.sso_t24_categoria_reparo_permitida(text) from public,anon,authenticated,service_role;

do $migration$
declare
  v_produtor regprocedure := 'pcm.sso_t24_produzir_corretiva(uuid,uuid,uuid,integer)'::regprocedure;
  v_fontes regprocedure := 'pcm.sso_t24_fontes_corretivas_atuais(uuid)'::regprocedure;
  v_def text; v_antes text; v_depois text;
begin
  v_def:=pg_catalog.pg_get_functiondef(v_produtor);
  v_antes:=$texto$and categoria='corretiva' for share;$texto$;
  v_depois:=$texto$and pcm.sso_t24_categoria_reparo_permitida(categoria) for share;$texto$;
  if length(v_def)-length(replace(v_def,v_antes,''))<>length(v_antes) then raise exception 'produtor_incompativel' using errcode='55000'; end if;
  v_def:=replace(v_def,v_antes,v_depois);
  v_antes:=$texto$insert into pcm.sso_t24_tentativa_eventos(tentativa_id,sequencia,fence,estado,motivo)$texto$;
  v_depois:=$texto$insert into pcm.sso_t24_categoria_reparo(tentativa_id,categoria) values(tentativa,o.categoria);
 insert into pcm.sso_t24_tentativa_eventos(tentativa_id,sequencia,fence,estado,motivo)$texto$;
  if length(v_def)-length(replace(v_def,v_antes,''))<>length(v_antes) then raise exception 'produtor_incompativel' using errcode='55000'; end if;
  execute replace(v_def,v_antes,v_depois);

  v_def:=pg_catalog.pg_get_functiondef(v_fontes);
  v_antes:=$texto$and categoria='corretiva' and deleted_at is null for share nowait;$texto$;
  v_depois:=$texto$and pcm.sso_t24_categoria_reparo_permitida(categoria) and deleted_at is null for share nowait;$texto$;
  if length(v_def)-length(replace(v_def,v_antes,''))<>length(v_antes) then raise exception 'revalidacao_incompativel' using errcode='55000'; end if;
  v_def:=replace(v_def,v_antes,v_depois);
  v_antes:=$texto$if not found or o.status in ('finalizado','cancelado') or (o.sistema_id is null)=(o.equipamento_id is null) then return false; end if;$texto$;
  v_depois:=$texto$if not found or o.status in ('finalizado','cancelado') or (o.sistema_id is null)=(o.equipamento_id is null) then return false; end if;
 if exists(select 1 from pcm.sso_t24_categoria_reparo c where c.tentativa_id=t.id and c.categoria is distinct from o.categoria)
   or (o.categoria='emergencial' and not exists(select 1 from pcm.sso_t24_categoria_reparo c where c.tentativa_id=t.id and c.categoria='emergencial')) then return false; end if;$texto$;
  if length(v_def)-length(replace(v_def,v_antes,''))<>length(v_antes) then raise exception 'revalidacao_incompativel' using errcode='55000'; end if;
  execute replace(v_def,v_antes,v_depois);
end;
$migration$;
