-- ADR-1384: composição de fontes, não fotografia transacional nem saldo.
create table pcm.sso_snapshot_capacidade_referencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_snapshot_capacidade_referencia_gate(id,habilitado) values(true,false);
alter table pcm.sso_snapshot_capacidade_referencia_gate enable row level security;
alter table pcm.sso_snapshot_capacidade_referencia_gate force row level security;
revoke all on pcm.sso_snapshot_capacidade_referencia_gate from public,anon,authenticated,service_role;

create function pcm.sso_snapshot_capacidade_referencia(p_cliente_id uuid,p_semana_inicio date)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_snapshot jsonb; v_ocorrencias jsonb; v_total integer;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_snapshot_capacidade_referencia_gate where id and habilitado for share;
 if not found then raise exception 'snapshot_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_snapshot:=pcm.sso_snapshot_capacidade_autorizado(p_cliente_id,p_semana_inicio,5);
 select count(*),coalesce(jsonb_agg(to_jsonb(o) order by o.tipo,o.ocorrencia_id),'[]'::jsonb) into v_total,v_ocorrencias
   from pcm.sso_ocorrencias_sem_os_referencia(p_cliente_id,p_semana_inicio,null,null,100) o;
 if config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_snapshot || jsonb_build_object('ocorrenciasSemOs',v_ocorrencias,'limiteOcorrenciasAtingido',v_total=100,
   'referenciaVisita','programacao_ou_vencimento','fotografiaTransacional',false);
end; $$;
revoke all on function pcm.sso_snapshot_capacidade_referencia(uuid,date) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_snapshot_capacidade_referencia(uuid,date) to authenticated;
