-- ADR-0412: consulta conservadora, sem afirmar impacto ou ausência de impacto.
create table pcm.sso_impacto_revisao_os_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_impacto_revisao_os_gate enable row level security;
alter table pcm.sso_impacto_revisao_os_gate force row level security;
revoke all on pcm.sso_impacto_revisao_os_gate from public,anon,authenticated,service_role;
insert into pcm.sso_impacto_revisao_os_gate(id,habilitado) values(true,false);

create function pcm.sso_diagnosticar_os_revisao_plano(p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_revisao integer; v_ocorrencias integer; v_sem_ponte integer; v_os integer; v_os_abertas integer; v_os_cliente_divergente integer;
begin
 if not coalesce((select habilitado from pcm.sso_impacto_revisao_os_gate where id),false) then raise exception 'impacto_revisao_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select p.revisao into v_revisao from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id;
 if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
 if p_expected_revision is null or v_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 select count(*),count(*) filter(where v.ocorrencia_legada_id is null) into v_ocorrencias,v_sem_ponte
 from pcm.ocorrencias_rotina_preparadas o left join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_preparada_id=o.id where o.plano_id=p_plano_id;
 select count(distinct os.id) filter(where os.client_id=p_cliente_id and os.deleted_at is null),
 count(distinct os.id) filter(where os.client_id=p_cliente_id and os.deleted_at is null and os.status not in ('finalizado','cancelado')),
 count(distinct os.id) filter(where os.client_id is distinct from p_cliente_id and os.deleted_at is null)
 into v_os,v_os_abertas,v_os_cliente_divergente from pcm.ocorrencias_rotina_preparadas o
 join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_preparada_id=o.id and v.ocorrencia_legada_id is not null
 join pcm.ordens_servico os on os.ocorrencia_preventiva_id=v.ocorrencia_legada_id where o.plano_id=p_plano_id;
 return jsonb_build_object('revisao',v_revisao,'ocorrenciasCalendarioPreparadas',v_ocorrencias,'ocorrenciasSemPonte',v_sem_ponte,
 'osVinculadasMesmoCliente',v_os,'osAbertasMesmoCliente',v_os_abertas,'osClienteDivergente',v_os_cliente_divergente,
 'fontesIncompletas',true,'impactoOperacionalCalculado',false,'ausenciaDeImpactoComprovada',false,'consultaInformativa',true);
end; $$;
revoke all on function pcm.sso_diagnosticar_os_revisao_plano(uuid,uuid,integer) from public,anon,authenticated,service_role;
