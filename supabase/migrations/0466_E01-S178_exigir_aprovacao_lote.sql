-- ADR-0240: falha fechada até gate próprio e demais gates serem habilitados de forma coordenada.
create table pcm.sso_incorporacao_aprovacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_incorporacao_aprovacao_gate(id,habilitado) values(true,false);
create table pcm.sso_conferencia_lote_codigos(lote_id uuid not null,conferencia_revision integer not null,linha_chave text not null,codigo_revision integer not null check(codigo_revision>=0),
  primary key(lote_id,conferencia_revision,linha_chave),foreign key(lote_id,conferencia_revision) references pcm.sso_conferencia_lotes(lote_id,revisao),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave));
alter table pcm.sso_incorporacao_aprovacao_gate enable row level security;alter table pcm.sso_incorporacao_aprovacao_gate force row level security;
alter table pcm.sso_conferencia_lote_codigos enable row level security;alter table pcm.sso_conferencia_lote_codigos force row level security;
revoke all on pcm.sso_incorporacao_aprovacao_gate,pcm.sso_conferencia_lote_codigos from public,anon,authenticated,service_role;
-- Sem reabertura versionada, não se pode mudar candidato após conferência da linha.
create function pcm.sso_impedir_codigo_apos_conferencia() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=new.lote_id and c.linha_chave=new.linha_chave) then raise exception 'linha_ja_conferida' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_impedir_codigo_apos_conferencia() from public,anon,authenticated,service_role;
create trigger sso_impedir_codigo_apos_conferencia before insert or update on pcm.sso_codigo_staging for each row execute function pcm.sso_impedir_codigo_apos_conferencia();
-- Mudança do candidato invalida a conferência anterior também na revisão visível do lote.
create function pcm.sso_codigo_staging_revisar_lote() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update pcm.sso_levantamentos set revisao=revisao+1 where id=new.lote_id;
  if not found then raise exception 'lote_indisponivel' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_codigo_staging_revisar_lote() from public,anon,authenticated,service_role;
create trigger sso_codigo_staging_revisar_lote after insert or update on pcm.sso_codigo_staging for each row execute function pcm.sso_codigo_staging_revisar_lote();
create function pcm.sso_congelar_codigos_conferencia_lote() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into pcm.sso_conferencia_lote_codigos(lote_id,conferencia_revision,linha_chave,codigo_revision)
    select new.lote_id,new.revisao,l.chave,coalesce(c.revisao,0) from pcm.sso_levantamento_linhas l
      left join pcm.sso_codigo_staging c on c.lote_id=l.lote_id and c.linha_chave=l.chave where l.lote_id=new.lote_id;
  return new;
end;
$$;
revoke all on function pcm.sso_congelar_codigos_conferencia_lote() from public,anon,authenticated,service_role;
create trigger sso_congelar_codigos_conferencia_lote after insert on pcm.sso_conferencia_lotes for each row execute function pcm.sso_congelar_codigos_conferencia_lote();

create function pcm.sso_exigir_lote_conferido() returns trigger language plpgsql security definer set search_path='' as $$
declare v_aprovacao integer;v_atributos jsonb;v_codigo integer;v_congelado integer;
begin
  if not coalesce((select habilitado from pcm.sso_incorporacao_aprovacao_gate where id),false) then raise exception 'incorporacao_bloqueada_por_aprovacao' using errcode='55000'; end if;
  perform 1 from pcm.sso_levantamentos where id=new.lote_id for update;
  if not found then raise exception 'lote_indisponivel' using errcode='23514'; end if;
  select max(revisao) into v_aprovacao from pcm.sso_conferencia_lotes where lote_id=new.lote_id;
  select atributos into v_atributos from pcm.sso_levantamento_linhas where lote_id=new.lote_id and chave=new.linha_chave;
  if v_aprovacao is null or v_atributos is null or not exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=new.lote_id and c.linha_chave=new.linha_chave and c.revisao<v_aprovacao and c.atributos=v_atributos) then raise exception 'linha_ou_lote_nao_conferido' using errcode='23514'; end if;
  select codigo_revision into v_congelado from pcm.sso_conferencia_lote_codigos where lote_id=new.lote_id and conferencia_revision=v_aprovacao and linha_chave=new.linha_chave;
  select revisao into v_codigo from pcm.sso_codigo_staging where lote_id=new.lote_id and linha_chave=new.linha_chave;
  if v_congelado is null or v_congelado<>coalesce(v_codigo,0) then raise exception 'codigo_apos_conferencia' using errcode='40001'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_exigir_lote_conferido() from public,anon,authenticated,service_role;
create trigger sso_incorporacao_exige_lote_conferido before insert on pcm.sso_levantamento_incorporacoes for each row execute function pcm.sso_exigir_lote_conferido();
