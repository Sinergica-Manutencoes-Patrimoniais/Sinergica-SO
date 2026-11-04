create table pcm.sso_validar_localizacao_importada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_validar_localizacao_importada_gate(id,habilitado) values(true,false);
alter table pcm.sso_validar_localizacao_importada_gate enable row level security;
alter table pcm.sso_validar_localizacao_importada_gate force row level security;
revoke all on pcm.sso_validar_localizacao_importada_gate from public,anon,authenticated,service_role;
create function pcm.sso_validar_localizacao_importada() returns trigger language plpgsql security definer set search_path='' as $$
declare v_atributos jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_validar_localizacao_importada_gate where id),false) or new.tipo not in ('area','local','sublocal') then return new;end if;
 select l.atributos into v_atributos from pcm.sso_levantamento_linhas l where l.lote_id=new.lote_id and l.chave=new.linha_chave;
 if not found or jsonb_typeof(v_atributos) is distinct from 'object' then raise exception 'linha_indisponivel' using errcode='23514';end if;
 if nullif(btrim(v_atributos->>'quantidade'),'') is not null then raise exception 'quantidade_nao_aplicavel_localizacao' using errcode='23514';end if;
 if nullif(btrim(v_atributos->>'codigoInformado'),'') is not null then raise exception 'codigo_localizacao_nao_suportado' using errcode='23514';end if;
 if exists(select 1 from jsonb_each(v_atributos) x where x.key not in ('nome','referenciaPai','codigoInformado','quantidade') and x.value<>'null'::jsonb and x.value<>'""'::jsonb) then raise exception 'atributo_localizacao_nao_suportado' using errcode='23514';end if;
 return new;
end;$$;
revoke all on function pcm.sso_validar_localizacao_importada() from public,anon,authenticated,service_role;
create trigger sso_validar_localizacao_importada before insert on pcm.sso_levantamento_incorporacoes for each row execute function pcm.sso_validar_localizacao_importada();
create trigger sso_validar_localizacao_importada before insert on pcm.sso_atualizacoes_localizacao for each row execute function pcm.sso_validar_localizacao_importada();
