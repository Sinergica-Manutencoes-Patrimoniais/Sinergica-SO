-- ADR-1535: revalida OS conhecidas conferidas pelo PCM no ato da aprovação.
create function pcm.sso_fotografia_os_comparacao_aprovacao(p_cliente uuid,p_plano uuid,p_preparada uuid,p_tipo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_foto jsonb;v_legada uuid;v_os jsonb;v_count bigint;v_outros bigint;
begin
 lock table pcm.ocorrencias_rotina_vinculos,pcm.sso_vinculos_visita_legado in share mode nowait;
 perform pcm.sso_travar_fontes_impacto_grupo();
 v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente,p_plano,p_preparada,p_tipo);
 if p_tipo='calendario' then
  select ocorrencia_legada_id into v_legada from pcm.ocorrencias_rotina_vinculos where ocorrencia_preparada_id=p_preparada;
 elsif p_tipo='visita' then
  select ocorrencia_legada_id into v_legada from pcm.sso_vinculos_visita_legado where ocorrencia_visita_id=p_preparada and cliente_id=p_cliente;
 else raise exception 'tipo_invalido' using errcode='22023';end if;
 with ids as (
  select (j.item->>'id')::uuid id from jsonb_array_elements(v_foto->'os') j(item)
  union select os.id from pcm.ordens_servico os where os.ocorrencia_preventiva_id=v_legada and os.deleted_at is null
 ), os as (
  select o.id,o.status,o.updated_at,o.client_id from ids join pcm.ordens_servico o on o.id=ids.id where o.deleted_at is null
 )
 select count(*) filter(where client_id=p_cliente),count(*) filter(where client_id is distinct from p_cliente),
  coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'atualizadaEm',updated_at) order by id) filter(where client_id=p_cliente),'[]'::jsonb)
 into v_count,v_outros,v_os from os;
 if v_count>100 then raise exception 'os_excedem_limite_reconciliacao' using errcode='23514';end if;
 return jsonb_build_object('osImpacto',v_os,'osOutroCliente',v_outros>0);
end; $$;
revoke all on function pcm.sso_fotografia_os_comparacao_aprovacao(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_exigir_comparacao_questionario_aprovacao()'::regprocedure);
 a text:=$antes$  if v_item.comparacao->'questionarioComparacao' is distinct from v_atual then raise exception 'comparacao_questionario_obsoleta' using errcode='23514';end if;$antes$;
 b text:=$depois$  if v_item.comparacao->'questionarioComparacao' is distinct from v_atual then raise exception 'comparacao_questionario_obsoleta' using errcode='23514';end if;
  v_atual:=pcm.sso_fotografia_os_comparacao_aprovacao(v_plano.cliente_id,new.plano_id,v_item.preparada_id,v_item.tipo);
  if jsonb_typeof(v_item.comparacao->'osImpacto') is distinct from 'array' or jsonb_typeof(v_item.comparacao->'osOutroCliente') is distinct from 'boolean'
   or v_item.comparacao->'osImpacto' is distinct from v_atual->'osImpacto'
   or v_item.comparacao->'osOutroCliente' is distinct from v_atual->'osOutroCliente' then
   raise exception 'comparacao_os_obsoleta' using errcode='23514';end if;$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_aprovacao_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
