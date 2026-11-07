-- ADR-1554: fotografia por OS tem precedência e preserva fontes antigas sem fotografia.
create or replace function pcm.sso_listar_envelopes_classificaveis(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(envelope_id uuid,resolucao_id uuid,os_id uuid,task_id text,ocorrido_em timestamptz,recebido_em timestamptz,perguntas jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false)
   or not coalesce((select habilitado from pcm.validacao_os_gate where id),false) then raise exception 'retorno_campo_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query
 with fontes as (
   select os.id os_id, f.plano_id,f.versao_id,f.rotina_id,o.alvo_tipo,o.alvo_id,f.snapshot foto_snapshot
     from pcm.ordens_servico os join pcm.sso_origens_os_preventiva f on f.os_id=os.id and f.cliente_id=os.client_id and f.tipo='calendario'
     join pcm.ocorrencias_rotina_preparadas o on o.id=f.preparada_id and o.plano_id=f.plano_id
     where os.client_id=p_cliente_id
   union all
   select os.id, f.plano_id,f.versao_id,f.rotina_id,o.alvo_tipo,o.alvo_id,f.snapshot
     from pcm.ordens_servico os join pcm.sso_origens_os_preventiva f on f.os_id=os.id and f.cliente_id=os.client_id and f.tipo='visita'
     join pcm.ocorrencias_visita_preparadas o on o.id=f.preparada_id and o.plano_id=f.plano_id
     where os.client_id=p_cliente_id
   union all
   select os.id os_id,oc.plano_id,oc.versao_id,oc.rotina_id,oc.alvo_tipo,oc.alvo_id,null::jsonb
     from pcm.ordens_servico os join pcm.ocorrencias_rotina_vinculos ponte on ponte.ocorrencia_legada_id=os.ocorrencia_preventiva_id
     join pcm.ocorrencias_rotina_preparadas oc on oc.id=ponte.ocorrencia_preparada_id where os.client_id=p_cliente_id and not exists(select 1 from pcm.sso_origens_os_preventiva f where f.os_id=os.id)
   union all
   select os.id,oc.plano_id,oc.versao_id,oc.rotina_id,oc.alvo_tipo,oc.alvo_id,null::jsonb
     from pcm.ordens_servico os join pcm.sso_vinculos_visita_legado ponte on ponte.ocorrencia_legada_id=os.ocorrencia_preventiva_id and ponte.cliente_id=os.client_id
     join pcm.ocorrencias_visita_preparadas oc on oc.id=ponte.ocorrencia_visita_id where os.client_id=p_cliente_id and not exists(select 1 from pcm.sso_origens_os_preventiva f where f.os_id=os.id)
   union all
   select os.id,g.plano_id,g.versao_id,g.rotina_id,'grupo'::text,g.grupo_id,null::jsonb
     from pcm.ordens_servico os join pcm.sso_vinculos_os_grupo ponte on ponte.os_id=os.id and ponte.cliente_id=os.client_id
     join pcm.sso_ocorrencias_grupo g on g.id=ponte.ocorrencia_grupo_id and g.cliente_id=ponte.cliente_id
     where os.client_id=p_cliente_id and not exists(select 1 from pcm.sso_origens_os_preventiva f where f.os_id=os.id) and os.ocorrencia_preventiva_id is null
       and (os.chamado_id is null or os.chamado_id=pcm.sso_chamado_ciclo_grupo(p_cliente_id,g.id))
 ), unicas as (
   select f.* from fontes f where (select count(*) from fontes outras where outras.os_id=f.os_id)=1
 )
 select i.id,r.id,os.id,i.task_id::text,i.ocorrido_em,i.recebido_em,
   coalesce((select jsonb_agg(jsonb_build_object('id',q.item->>'id','texto',
     case when jsonb_typeof(q.item->'texto')='string' then left(q.item->>'texto',2000) else null end) order by q.ord)
     from jsonb_array_elements(case when jsonb_typeof(rot.item->'questionario'->'perguntas')='array'
       then rot.item->'questionario'->'perguntas' else '[]'::jsonb end) with ordinality q(item,ord)),'[]'::jsonb)
 from pcm.origem_campo_inbox i
 join lateral (select rr.* from pcm.origem_campo_resolucoes rr where rr.envelope_id=i.id order by rr.criada_em desc,rr.id desc limit 1) r
   on r.resultado='os_identificada' and r.cliente_id=p_cliente_id
 join pcm.clientes c on c.id=p_cliente_id and c.deleted_at is null and c.auvo_id::text=i.cliente_externo_id
 join pcm.ordens_servico os on os.id=r.os_id and os.client_id=p_cliente_id and os.deleted_at is null and os.auvo_task_id=i.task_id
 join unicas f on f.os_id=os.id
 join pcm.planos_manutencao p on p.id=f.plano_id and p.cliente_id=p_cliente_id
 left join pcm.plano_versoes v on v.id=f.versao_id and v.plano_id=p.id and v.estado='aprovado'
 join lateral (select coalesce(f.foto_snapshot,v.snapshot) snapshot) snap on snap.snapshot is not null
 join lateral jsonb_array_elements(case when jsonb_typeof(snap.snapshot->'rotinas')='array' then snap.snapshot->'rotinas' else '[]'::jsonb end) rot(item)
   on rot.item->>'id'=f.rotina_id::text and rot.item->>'alvo_tipo'=f.alvo_tipo
   and (case f.alvo_tipo when 'sistema' then rot.item->>'sistema_id' when 'componente' then rot.item->>'equipamento_id' when 'grupo' then rot.item->>'grupo_id' end)=f.alvo_id::text
 where i.integracao='auvo' and (p_apos is null or i.id>p_apos)
   and not exists(select 1 from pcm.retorno_campo_classificacoes classificacao where classificacao.envelope_id=i.id)
   and (select count(*) from jsonb_array_elements(case when jsonb_typeof(snap.snapshot->'rotinas')='array' then snap.snapshot->'rotinas' else '[]'::jsonb end) x(item) where x.item->>'id'=f.rotina_id::text)=1
 order by i.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_envelopes_classificaveis(uuid,uuid,integer) from public,anon,authenticated,service_role;
