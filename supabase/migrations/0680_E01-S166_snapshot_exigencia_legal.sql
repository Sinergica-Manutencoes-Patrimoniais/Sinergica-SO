-- ADR-0454: somente novas aprovações; histórico anterior nunca é reescrito.
create table pcm.sso_snapshot_exigencia_legal_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_snapshot_exigencia_legal_gate enable row level security;
alter table pcm.sso_snapshot_exigencia_legal_gate force row level security;
revoke all on pcm.sso_snapshot_exigencia_legal_gate from public,anon,authenticated,service_role;
insert into pcm.sso_snapshot_exigencia_legal_gate(id,habilitado) values(true,false);

create function pcm.sso_congelar_exigencias_rotina() returns trigger language plpgsql security definer set search_path='' as $$
declare v_rotina jsonb;v_declaracao pcm.sso_declaracoes_exigencia_rotina%rowtype;v_saida jsonb:='[]'::jsonb;v_id uuid;
begin
 if old.estado<>'rascunho' or new.estado<>'aprovado' or not coalesce((select habilitado from pcm.sso_snapshot_exigencia_legal_gate where id),false) then return new; end if;
 if jsonb_typeof(new.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_invalido' using errcode='23514'; end if;
 for v_rotina in select value from jsonb_array_elements(new.snapshot->'rotinas') loop
  v_id:=(v_rotina->>'id')::uuid;
  if v_id is null then raise exception 'rotina_snapshot_invalida' using errcode='23514'; end if;
  select * into v_declaracao from pcm.sso_declaracoes_exigencia_rotina where plano_id=new.plano_id and versao_id=new.id and rotina_id=v_id order by revisao desc limit 1;
  if found and ((v_declaracao.resultado->>'modo') is distinct from (v_rotina->>'modo') or (v_declaracao.resultado->>'toleranciaAntes') is distinct from (v_rotina->>'tolerancia_antes') or (v_declaracao.resultado->>'toleranciaDepois') is distinct from (v_rotina->>'tolerancia_depois')) then raise exception 'exigencia_exige_reconferencia' using errcode='23514'; end if;
  v_saida:=v_saida||jsonb_build_array(case when v_declaracao.request_id is null then jsonb_build_object('rotinaId',v_id,'classificacao','indeterminada','toleranciaValidada',false) else jsonb_build_object('rotinaId',v_id,'classificacao',v_declaracao.classificacao,'referencia',v_declaracao.referencia,'justificativa',v_declaracao.justificativa,'declaracaoRequestId',v_declaracao.request_id,'revisao',v_declaracao.revisao,'atorId',v_declaracao.ator_id,'declaradaEm',v_declaracao.criado_em,'toleranciaValidada',false) end);
 end loop;
 new.snapshot:=jsonb_set(new.snapshot,'{exigencias_rotinas}',v_saida,true);return new;
end; $$;
revoke all on function pcm.sso_congelar_exigencias_rotina() from public,anon,authenticated,service_role;
create trigger sso_congelar_exigencias_rotina before update of estado on pcm.plano_versoes for each row execute function pcm.sso_congelar_exigencias_rotina();

create function pcm.sso_historico_exigencia_rotina(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_antes integer default null,p_limite integer default 20)
returns table(request_id uuid,revisao integer,classificacao text,referencia text,justificativa text,ator_id uuid,criado_em timestamptz,modo text,tolerancia_antes integer,tolerancia_depois integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_exigencia_legal_gate where id),false) then raise exception 'exigencia_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 50 or (p_antes is not null and p_antes<1) then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query select d.request_id,d.revisao,d.classificacao,d.referencia,d.justificativa,d.ator_id,d.criado_em,d.resultado->>'modo',(d.resultado->>'toleranciaAntes')::integer,(d.resultado->>'toleranciaDepois')::integer from pcm.sso_declaracoes_exigencia_rotina d where d.cliente_id=p_cliente_id and d.plano_id=p_plano_id and d.versao_id=p_versao_id and d.rotina_id=p_rotina_id and (p_antes is null or d.revisao<p_antes) order by d.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_exigencia_rotina(uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
