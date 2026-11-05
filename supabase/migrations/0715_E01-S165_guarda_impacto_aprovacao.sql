-- ADR-0489: fail-closed quando proteção opt-in habilitada; nunca autoriza com impacto indeterminado.
create table pcm.sso_guardar_impacto_aprovacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_guardar_impacto_aprovacao_gate enable row level security;
alter table pcm.sso_guardar_impacto_aprovacao_gate force row level security;
revoke all on pcm.sso_guardar_impacto_aprovacao_gate from public,anon,authenticated,service_role;
insert into pcm.sso_guardar_impacto_aprovacao_gate(id,habilitado) values(true,false);

create function pcm.sso_preflight_aprovacao_revisao(p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_vigencia date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_ant pcm.plano_versoes%rowtype;v_rasc pcm.plano_versoes%rowtype;v_aprovadas integer;v_snap boolean;
begin
 if not coalesce((select habilitado from pcm.sso_guardar_impacto_aprovacao_gate where id),false) then raise exception 'preflight_aprovacao_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id;
 if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
 if p_expected_revision is null or v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if p_vigencia is null or not isfinite(p_vigencia) then raise exception 'vigencia_invalida' using errcode='22023'; end if;
 select * into v_ant from pcm.plano_versoes where plano_id=p_plano_id and estado='aprovado' order by numero desc limit 1;
 select * into v_rasc from pcm.plano_versoes where plano_id=p_plano_id and estado='rascunho';
 select count(*) into v_aprovadas from pcm.plano_versoes where plano_id=p_plano_id and estado='aprovado' and (vigencia_inicio is null or vigencia_fim is null or daterange(vigencia_inicio,vigencia_fim,'[]') && daterange(p_vigencia,null,'[)'));
 v_snap:=v_ant.id is not null and jsonb_typeof(v_ant.snapshot->'rotinas')='array';
 return jsonb_build_object('revisao',v_plano.revisao,'estadoPlano',v_plano.estado,'versaoAnteriorId',v_ant.id,'rascunhoId',v_rasc.id,'snapshotAnteriorDisponivel',coalesce(v_snap,false),'vigenciaAnteriorInicio',v_ant.vigencia_inicio,'vigenciaAnteriorFim',v_ant.vigencia_fim,'vigenciaProposta',p_vigencia,'aprovadasPotencialmenteConflitantes',v_aprovadas,'impactoCompletoComprovado',false,'fusoPlanoDefinido',false,'aprovacaoAutorizada',false,'motivoBloqueio','impactos_e_fuso_nao_comprovados');
end; $$;
revoke all on function pcm.sso_preflight_aprovacao_revisao(uuid,uuid,integer,date) from public,anon,authenticated,service_role;

create function pcm.sso_bloquear_aprovacao_impacto_indeterminado() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce((select habilitado from pcm.sso_guardar_impacto_aprovacao_gate where id),false) then raise exception 'aprovacao_bloqueada_impacto_e_fuso_nao_comprovados' using errcode='23514';end if;
 return new;
end; $$;
revoke all on function pcm.sso_bloquear_aprovacao_impacto_indeterminado() from public,anon,authenticated,service_role;
create trigger sso_bloquear_aprovacao_impacto_indeterminado before insert on pcm.aprovacao_revisao_tokens for each row execute function pcm.sso_bloquear_aprovacao_impacto_indeterminado();
