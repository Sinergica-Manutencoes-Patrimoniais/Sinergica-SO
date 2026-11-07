-- ADR-0538: configuração explícita congelada apenas em novas versões aprovadas.
create table pcm.sso_snapshot_fuso_plano_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_snapshot_fuso_plano_gate enable row level security;alter table pcm.sso_snapshot_fuso_plano_gate force row level security;
revoke all on pcm.sso_snapshot_fuso_plano_gate from public,anon,authenticated,service_role;
insert into pcm.sso_snapshot_fuso_plano_gate(id,habilitado) values(true,false);

create function pcm.sso_congelar_fuso_plano() returns trigger language plpgsql security definer set search_path='' as $$
declare v_fuso pcm.sso_fusos_plano_declarados%rowtype;
begin
 if old.estado<>'rascunho' or new.estado<>'aprovado' or not coalesce((select habilitado from pcm.sso_snapshot_fuso_plano_gate where id),false) then return new;end if;
 if new.vigencia_inicio is null or not isfinite(new.vigencia_inicio) or jsonb_typeof(new.snapshot) is distinct from 'object' then raise exception 'vigencia_ou_snapshot_indisponivel' using errcode='23514';end if;
 select * into v_fuso from pcm.sso_fusos_plano_declarados where plano_id=new.plano_id order by revisao desc limit 1;
 if not found or not exists(select 1 from pg_catalog.pg_timezone_names where name=v_fuso.fuso) then raise exception 'fuso_explicito_ausente' using errcode='23514';end if;
 new.snapshot:=jsonb_set(new.snapshot,'{fuso_plano}',jsonb_build_object('fuso',v_fuso.fuso,'declaracaoRequestId',v_fuso.request_id,'revisao',v_fuso.revisao,'fonteDeclarada',v_fuso.fonte,'contratoReferenciaId',v_fuso.contrato_referencia_id,'atorId',v_fuso.ator_id,'declaradoEm',v_fuso.criado_em,'fonteValidada',false,'vigenciaInicio',new.vigencia_inicio),true);
 return new;
end; $$;
revoke all on function pcm.sso_congelar_fuso_plano() from public,anon,authenticated,service_role;
create trigger sso_congelar_fuso_plano before update of estado on pcm.plano_versoes for each row execute function pcm.sso_congelar_fuso_plano();
