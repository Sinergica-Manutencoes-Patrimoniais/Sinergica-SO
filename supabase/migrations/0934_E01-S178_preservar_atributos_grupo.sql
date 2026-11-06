create table pcm.sso_validar_atributos_grupo_importado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_validar_atributos_grupo_importado_gate(id,habilitado) values(true,false);
alter table pcm.sso_validar_atributos_grupo_importado_gate enable row level security;
alter table pcm.sso_validar_atributos_grupo_importado_gate force row level security;
revoke all on pcm.sso_validar_atributos_grupo_importado_gate from public,anon,authenticated,service_role;

create function pcm.sso_validar_atributos_grupo_importado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_atributos jsonb;
begin
 if new.tipo <> 'grupo_quantitativo' then return new; end if;
 if not coalesce((select habilitado from pcm.sso_validar_atributos_grupo_importado_gate where id),false) then raise exception 'validacao_grupo_desabilitada' using errcode='55000'; end if;
 select l.atributos into v_atributos from pcm.sso_levantamento_linhas l where l.lote_id=new.lote_id and l.chave=new.linha_chave and l.tipo='grupo_quantitativo';
 if not found or jsonb_typeof(v_atributos) is distinct from 'object' then raise exception 'linha_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from jsonb_each(v_atributos) x where x.key not in ('nome','referenciaPai','codigoInformado','quantidade') and x.value<>'null'::jsonb and x.value<>'""'::jsonb) then raise exception 'atributo_grupo_nao_suportado' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_validar_atributos_grupo_importado() from public,anon,authenticated,service_role;
create trigger sso_validar_atributos_grupo_importado before insert on pcm.sso_levantamento_incorporacoes for each row execute function pcm.sso_validar_atributos_grupo_importado();
