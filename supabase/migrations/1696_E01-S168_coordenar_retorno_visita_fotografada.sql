-- ADR-1552: Visita nativa fotografada segue verificações explícitas por transição.
-- Preserva Grupo, legado, gates existentes e guarda 1045.
do $migration$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_bloquear_consumidor_visita_nao_integrado()'::regprocedure);
 decl text:=$a$declare v_os_id uuid;v_grupo boolean;v_visita boolean;v_retorno pcm.retorno_os_preparado%rowtype;$a$;
 decl_novo text:=$b$declare v_os_id uuid;v_grupo boolean;v_visita boolean;v_retorno pcm.retorno_os_preparado%rowtype;v_foto pcm.sso_origens_os_preventiva%rowtype;v_prep pcm.ocorrencias_visita_preparadas%rowtype;$b$;
 a text:=$a$ if v_visita or not v_grupo or tg_table_name not in ('retorno_os_preparado','decisoes_validacao_os','sso_pendencias_tecnicas','sso_finalizacoes_os_validadas') or tg_op<>'INSERT' then$a$;
 b text:=$b$ if v_visita and not v_grupo and exists(select 1 from pcm.sso_origens_os_preventiva f where f.os_id=v_os_id and f.tipo='visita') then
   if tg_op<>'INSERT' or tg_table_name not in ('retorno_os_preparado','decisoes_validacao_os','sso_pendencias_tecnicas','sso_finalizacoes_os_validadas') then raise exception 'origem_consumidores_nao_integrados' using errcode='55000';end if;
   select f.* into v_foto from pcm.sso_origens_os_preventiva f join pcm.ordens_servico os on os.id=f.os_id and os.client_id=f.cliente_id and os.deleted_at is null
    where f.os_id=v_os_id and f.tipo='visita' for share of os;
   if not found or auth.uid() is null or config.sso_autorizar_acao('execucao.validar',v_foto.cliente_id) is distinct from true then raise exception 'retorno_visita_nao_autorizado' using errcode='42501';end if;
   perform 1 from pcm.validacao_os_gate where id and habilitado for share;
   if not found then raise exception 'origem_consumidores_nao_integrados' using errcode='55000';end if;
   select o.* into v_prep from pcm.ocorrencias_visita_preparadas o where o.id=v_foto.preparada_id and o.plano_id=v_foto.plano_id;
   if not found or jsonb_typeof(v_foto.snapshot->'rotinas') is distinct from 'array' or
    (select count(*) from jsonb_array_elements(v_foto.snapshot->'rotinas') r(item) where r.item->>'id'=v_foto.rotina_id::text and r.item->>'rotina_logica_id'=v_prep.rotina_logica_id::text and r.item->>'modo'='visita' and r.item->>'alvo_tipo'=v_prep.alvo_tipo and coalesce(r.item->>'sistema_id',r.item->>'equipamento_id',r.item->>'grupo_id')=v_prep.alvo_id::text)<>1 then raise exception 'origem_os_preventiva_divergente' using errcode='23514';end if;
   if tg_table_name='retorno_os_preparado' then
     v_retorno:=new;
     if v_retorno.origem is distinct from 'manual_declarado' or v_retorno.cobertura_comprovada is distinct from false then raise exception 'retorno_visita_nao_autorizado' using errcode='42501';end if;
   else
     select * into v_retorno from pcm.retorno_os_preparado where id=new.retorno_id for share;
     if not found then raise exception 'retorno_visita_nao_autorizado' using errcode='42501';end if;
   end if;
   if v_retorno.os_id is distinct from v_foto.os_id or v_retorno.cliente_id is distinct from v_foto.cliente_id or v_retorno.versao_id is distinct from v_foto.versao_id or v_retorno.rotina_id is distinct from v_foto.rotina_id then raise exception 'origem_os_preventiva_divergente' using errcode='23514';end if;
   if tg_table_name='decisoes_validacao_os' then
     if new.actor_id is distinct from auth.uid() then raise exception 'retorno_visita_nao_autorizado' using errcode='42501';end if;
   end if;
   if tg_table_name='sso_pendencias_tecnicas' then
     if new.os_id is distinct from v_foto.os_id or new.cliente_id is distinct from v_foto.cliente_id or new.ocorrencia_visita_preparada_id is distinct from v_foto.preparada_id or new.rotina_id is distinct from v_foto.rotina_id or new.alvo_tipo is distinct from v_prep.alvo_tipo or new.alvo_id is distinct from v_prep.alvo_id or not exists(select 1 from pcm.respostas_os_preparadas r where r.id=new.resposta_id and r.retorno_id=v_retorno.id and r.resultado='nao_ok') then raise exception 'pendencia_visita_incompativel' using errcode='23514';end if;
   elsif tg_table_name='sso_finalizacoes_os_validadas' then
     if new.os_id is distinct from v_foto.os_id or new.ator_id is distinct from auth.uid() or not exists(select 1 from pcm.sso_atestacoes_pcm_retorno a join pcm.sso_revisoes_validacao_os revisao on revisao.retorno_id=a.retorno_id and revisao.decisao_id=a.decisao_id and revisao.revisao=a.revisao_decisao join pcm.decisoes_validacao_os decisao on decisao.id=revisao.decisao_id and decisao.retorno_id=revisao.retorno_id where a.request_id=new.atestacao_request_id and a.retorno_id=v_retorno.id and a.revisao_decisao=new.revisao_decisao and decisao.decisao='aprovar' and not exists(select 1 from pcm.sso_revisoes_validacao_os posterior where posterior.retorno_id=a.retorno_id and posterior.revisao>a.revisao_decisao)) or not exists(select 1 from pcm.ordens_servico os where os.id=new.os_id and os.client_id=v_foto.cliente_id and os.status='finalizado') or exists(select 1 from pcm.respostas_os_preparadas r where r.retorno_id=v_retorno.id and r.resultado='nao_ok' and not exists(select 1 from pcm.sso_pendencias_tecnicas p where p.resposta_id=r.id and p.retorno_id=r.retorno_id)) then raise exception 'finalizacao_visita_incompativel' using errcode='23514';end if;
   end if;
   return new;
 end if;
 if v_visita or not v_grupo or tg_table_name not in ('retorno_os_preparado','decisoes_validacao_os','sso_pendencias_tecnicas','sso_finalizacoes_os_validadas') or tg_op<>'INSERT' then$b$;
begin
 if (length(d)-length(replace(d,decl,'')))/length(decl)<>1 or (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'coordenacao_visita_incompativel' using errcode='55000';end if;
 execute replace(replace(d,decl,decl_novo),a,b);
end; $migration$;
revoke all on function pcm.sso_bloquear_consumidor_visita_nao_integrado() from public,anon,authenticated,service_role;
