-- ADR-0649: estimativa, nunca execução comprovada nem reserva de capacidade.
create table pcm.sso_esforco_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_esforco_grupo_gate enable row level security;
alter table pcm.sso_esforco_grupo_gate force row level security;
revoke all on pcm.sso_esforco_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_esforco_grupo_gate(id,habilitado) values(true,false);
create function pcm.sso_prever_esforco_grupo(p_cliente_id uuid,p_ocorrencia_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_oc pcm.sso_ocorrencias_grupo%rowtype;v_origem pcm.sso_origens_quantidade_grupo%rowtype;v_snapshot jsonb;v_rotina jsonb;v_n integer;v_tempo text;v_total numeric;
begin
 if not coalesce((select habilitado from pcm.sso_esforco_grupo_gate where id),false) then raise exception 'esforco_grupo_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_oc from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 select * into v_origem from pcm.sso_origens_quantidade_grupo where ocorrencia_id=v_oc.id;
 if not found or v_origem.quantidade_aprovada is distinct from v_oc.quantidade_snapshot or v_origem.revisao_aprovada is distinct from v_oc.grupo_revisao then return jsonb_build_object('ocorrenciaId',v_oc.id,'estado','tempo_a_validar','motivo','quantidade_aprovada_indeterminada','esforcoMinutos',null,'capacidadeReservada',false); end if;
 select snapshot into v_snapshot from pcm.plano_versoes where id=v_oc.versao_id and plano_id=v_oc.plano_id and estado='aprovado';
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then return jsonb_build_object('ocorrenciaId',v_oc.id,'estado','tempo_a_validar','motivo','snapshot_indisponivel','esforcoMinutos',null,'capacidadeReservada',false); end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') x(item) where item->>'id'=v_oc.rotina_id::text and item->>'alvo_tipo'='grupo' and item->>'grupo_id'=v_oc.grupo_id::text;
 v_tempo:=v_rotina->>'tempo_minutos';
 if v_n<>1 or v_rotina->>'tipo_tempo' is distinct from 'por_unidade' or coalesce(v_tempo,'') !~ '^[1-9][0-9]{0,9}$' then return jsonb_build_object('ocorrenciaId',v_oc.id,'estado','tempo_a_validar','motivo','tempo_por_unidade_indeterminado','esforcoMinutos',null,'capacidadeReservada',false); end if;
 if v_tempo::numeric>2147483647 then return jsonb_build_object('ocorrenciaId',v_oc.id,'estado','tempo_a_validar','motivo','tempo_por_unidade_indeterminado','esforcoMinutos',null,'capacidadeReservada',false); end if;
 v_total:=v_origem.quantidade_aprovada::numeric*v_tempo::numeric;
 return jsonb_build_object('ocorrenciaId',v_oc.id,'estado','estimativa','quantidadeAprovada',v_origem.quantidade_aprovada::text,'tempoPorUnidadeMinutos',v_tempo,'esforcoMinutos',v_total::text,'capacidadeReservada',false,'execucaoComprovada',false);
end; $$;
revoke all on function pcm.sso_prever_esforco_grupo(uuid,uuid) from public,anon,authenticated,service_role;
