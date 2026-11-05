-- ADR-1449: permite apenas a recepção declarada de Grupo sob coordenação explícita.
create or replace function pcm.sso_bloquear_consumidor_visita_nao_integrado() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_os_id uuid;v_grupo boolean;v_visita boolean;v_retorno pcm.retorno_os_preparado%rowtype;
begin
 if tg_table_name='decisoes_validacao_os' then select os_id into v_os_id from pcm.retorno_os_preparado where id=new.retorno_id;
 else v_os_id:=new.os_id; end if;
 if v_os_id is null then return new; end if;
 perform pcm.sso_tentar_coordenar_os_grupo(v_os_id);
 select exists(select 1 from pcm.ordens_servico os join pcm.sso_vinculos_visita_legado v on v.ocorrencia_legada_id=os.ocorrencia_preventiva_id where os.id=v_os_id and os.client_id=v.cliente_id),
   exists(select 1 from pcm.ordens_servico os join pcm.sso_vinculos_os_grupo v on v.os_id=os.id and v.cliente_id=os.client_id where os.id=v_os_id)
 into v_visita,v_grupo;
 if not v_visita and not v_grupo then return new; end if;
 if v_visita or not v_grupo or tg_table_name not in ('retorno_os_preparado','decisoes_validacao_os','sso_pendencias_tecnicas','sso_finalizacoes_os_validadas') or tg_op<>'INSERT' then
   raise exception 'origem_consumidores_nao_integrados' using errcode='55000'; end if;
 perform 1 from pcm.sso_coordenacao_grupo_retorno_gate where id and habilitado for share;
 if not found then raise exception 'origem_consumidores_nao_integrados' using errcode='55000'; end if;
 if tg_table_name='retorno_os_preparado' then
   v_retorno:=new;
   if v_retorno.origem is distinct from 'manual_declarado' or v_retorno.cobertura_comprovada is distinct from false then
     raise exception 'retorno_grupo_nao_autorizado' using errcode='42501'; end if;
 elsif tg_table_name='decisoes_validacao_os' then
   select * into v_retorno from pcm.retorno_os_preparado where id=new.retorno_id for share;
   if not found or new.actor_id is distinct from auth.uid() then raise exception 'retorno_grupo_nao_autorizado' using errcode='42501'; end if;
 elsif tg_table_name='sso_pendencias_tecnicas' then
   select * into v_retorno from pcm.retorno_os_preparado where id=new.retorno_id and os_id=new.os_id and cliente_id=new.cliente_id for share;
   if not found or new.ocorrencia_id is not null or new.ocorrencia_grupo_id is null
     or new.rotina_id is distinct from v_retorno.rotina_id or new.alvo_tipo is distinct from 'grupo'
     or not exists(select 1 from pcm.respostas_os_preparadas resposta where resposta.id=new.resposta_id and resposta.retorno_id=v_retorno.id and resposta.resultado='nao_ok')
     or not exists(select 1 from pcm.sso_vinculos_os_grupo vg join pcm.sso_ocorrencias_grupo og on og.id=vg.ocorrencia_grupo_id and og.cliente_id=vg.cliente_id
       where vg.os_id=new.os_id and vg.cliente_id=new.cliente_id and og.id=new.ocorrencia_grupo_id and og.grupo_id=new.alvo_id) then
     raise exception 'pendencia_grupo_incompativel' using errcode='23514'; end if;
 else
   select * into v_retorno from pcm.retorno_os_preparado where id=new.retorno_id and os_id=new.os_id for share;
   if not found or new.ator_id is distinct from auth.uid() or not exists(
     select 1 from pcm.sso_atestacoes_pcm_retorno a join pcm.sso_revisoes_validacao_os revisao
       on revisao.retorno_id=a.retorno_id and revisao.decisao_id=a.decisao_id and revisao.revisao=a.revisao_decisao
       join pcm.decisoes_validacao_os decisao on decisao.id=revisao.decisao_id and decisao.retorno_id=revisao.retorno_id
     where a.request_id=new.atestacao_request_id and a.retorno_id=v_retorno.id and a.revisao_decisao=new.revisao_decisao
       and decisao.decisao='aprovar' and not exists(select 1 from pcm.sso_revisoes_validacao_os posterior where posterior.retorno_id=a.retorno_id and posterior.revisao>a.revisao_decisao)
   ) or not exists(select 1 from pcm.ordens_servico os where os.id=new.os_id and os.client_id=v_retorno.cliente_id and os.status='finalizado')
     or exists(select 1 from pcm.respostas_os_preparadas resposta where resposta.retorno_id=v_retorno.id and resposta.resultado='nao_ok'
       and not exists(select 1 from pcm.sso_pendencias_tecnicas pendencia where pendencia.resposta_id=resposta.id and pendencia.retorno_id=v_retorno.id)) then
     raise exception 'finalizacao_grupo_incompativel' using errcode='23514'; end if;
 end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',v_retorno.cliente_id) is distinct from true then
   raise exception 'retorno_grupo_nao_autorizado' using errcode='42501'; end if;
 perform os.id from pcm.ordens_servico os join pcm.sso_vinculos_os_grupo vg on vg.os_id=os.id and vg.cliente_id=os.client_id
   join pcm.sso_ocorrencias_grupo og on og.id=vg.ocorrencia_grupo_id and og.cliente_id=vg.cliente_id
   join pcm.planos_manutencao p on p.id=og.plano_id and p.cliente_id=og.cliente_id
   join pcm.plano_versoes v on v.id=og.versao_id and v.plano_id=p.id and v.estado='aprovado'
   where os.id=v_os_id and os.client_id=v_retorno.cliente_id and os.deleted_at is null and os.ocorrencia_preventiva_id is null
     and (os.chamado_id is null or os.chamado_id=pcm.sso_chamado_ciclo_grupo(v_retorno.cliente_id,og.id))
     and og.versao_id=v_retorno.versao_id and og.rotina_id=v_retorno.rotina_id and jsonb_typeof(v.snapshot->'rotinas')='array'
     and (select count(*) from jsonb_array_elements(case when jsonb_typeof(v.snapshot->'rotinas')='array' then v.snapshot->'rotinas' else '[]'::jsonb end) r
       where r->>'id'=og.rotina_id::text and r->>'alvo_tipo'='grupo' and r->>'grupo_id'=og.grupo_id::text)=1
     and (select count(*) from jsonb_array_elements(case when jsonb_typeof(v.snapshot->'rotinas')='array' then v.snapshot->'rotinas' else '[]'::jsonb end) r where r->>'id'=og.rotina_id::text)=1
   for share of os,vg,og,p,v;
 if not found then raise exception 'origem_grupo_indisponivel' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_bloquear_consumidor_visita_nao_integrado() from public,anon,authenticated,service_role;
