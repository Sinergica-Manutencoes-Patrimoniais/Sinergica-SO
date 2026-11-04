-- Somente banco sso_s180_fontes_prova, clone sintético isolado preparado conforme
-- E01-S180_diagnostico_policies_upload.md. Requer dblink e candidate conectado
-- exclusivamente por wrappers de teste; nunca executar em produção.
\set ON_ERROR_STOP on
begin;
set local lock_timeout='100ms';
set local search_path=public,extensions;
select plan(32);
select extensions.dblink_connect('s180_concorrencia',
 'host=/var/run/postgresql dbname=sso_s180_fontes_prova user=supabase_admin');
create function pg_temp.testar_fonte(p_bucket text,p_caminho text,p_mutacao text,p_nome text)
returns setof text language plpgsql as $test$
declare resultado text; estado text;
begin
 perform extensions.dblink_exec('s180_concorrencia','begin');
 perform extensions.dblink_exec('s180_concorrencia',
   $$set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}'$$);
 perform extensions.dblink_exec('s180_concorrencia','set local role authenticated');
 perform extensions.dblink_exec('s180_concorrencia',format(
  'insert into storage.objects(bucket_id,name,owner_id) values (%L,%L,%L)',
  p_bucket,p_caminho,'16891000-0000-4000-8000-000000000001'));
 begin
  execute p_mutacao;
  raise exception using errcode='P0001',message='mutação não bloqueou';
 exception when others then estado:=sqlstate;
 end;
 return next extensions.is(estado,'55P03',p_nome);
 perform extensions.dblink_exec('s180_concorrencia','rollback');
 perform extensions.dblink_exec('s180_concorrencia','begin');
 perform extensions.dblink_exec('s180_concorrencia',p_mutacao);
 perform set_config('request.jwt.claims','{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
 execute 'set local role authenticated';
 begin
  execute format('insert into storage.objects(bucket_id,name,owner_id) values (%L,%L,%L)',
   p_bucket,p_caminho,'16891000-0000-4000-8000-000000000001');
  raise exception using errcode='P0001',message='inserção não bloqueou';
 exception when others then estado:=sqlstate;
 end;
 execute 'reset role';
 return next extensions.is(estado,'42501','ordem inversa negada: '||p_nome);
 perform extensions.dblink_exec('s180_concorrencia','rollback');
 return;
end $test$;

select pg_temp.testar_fonte(bucket,caminho,mutacao,'gate bloqueado: '||bucket)
from (values
 ('sso-grupos-fotos','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000006/16891000-0000-4000-8000-000000000097','update pcm.sso_grupo_fotos_gate set habilitado=false where id'),
 ('sso-material-evidencias','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000051/2/16891000-0000-4000-8000-000000000097','update pcm.sso_material_evidencia_gate set habilitado=false where id'),
 ('sso-levantamento-fotos','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000097','update pcm.sso_fotos_levantamento_gate set habilitado=false where id'),
 ('sso-levantamento-documentos','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000097','update pcm.sso_documentos_levantamento_gate set habilitado=false where id'),
 ('sso-retorno-evidencias','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000097','update pcm.sso_upload_evidencia_resposta_gate set habilitado=false where id'),
 ('sso-despesas-visita','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000054/16891000-0000-4000-8000-000000000097','update pcm.sso_upload_comprovante_gate set habilitado=false where id')
) t(bucket,caminho,mutacao);

select pg_temp.testar_fonte(bucket,caminho,mutacao,'entidade bloqueada: '||bucket)
from (values
 ('sso-grupos-fotos','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000006/16891000-0000-4000-8000-000000000098',$q$update pcm.grupos_quantitativos set ativo=false where id='16891000-0000-4000-8000-000000000006'$q$),
 ('sso-material-evidencias','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000051/2/16891000-0000-4000-8000-000000000098',$q$update pcm.listas_materiais set texto_original='alterado' where id='16891000-0000-4000-8000-000000000051'$q$),
 ('sso-levantamento-fotos','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000098',$q$update pcm.sso_levantamentos set chave_origem='alterada' where id='16891000-0000-4000-8000-000000000050'$q$),
 ('sso-levantamento-documentos','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000050/16891000-0000-4000-8000-000000000098',$q$update pcm.sso_levantamentos set chave_origem='alterada' where id='16891000-0000-4000-8000-000000000050'$q$),
 ('sso-retorno-evidencias','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000098',$q$update pcm.ordens_servico set deleted_at=now() where id='16891000-0000-4000-8000-000000000017'$q$),
 ('sso-despesas-visita','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000054/16891000-0000-4000-8000-000000000098',$q$update pcm.despesas_visita set status='cancelada' where id='16891000-0000-4000-8000-000000000054'$q$)
) t(bucket,caminho,mutacao);
select pg_temp.testar_fonte(bucket,caminho,mutacao,'fonte adicional bloqueada: '||fonte)
from (values
 ('sso-retorno-evidencias','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000099',
  'update pcm.validacao_os_gate set habilitado=false where id','gate de validação'),
 ('sso-retorno-evidencias','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000099',
  $q$update storage.buckets set public=true where id='sso-retorno-evidencias'$q$,'configuração do bucket'),
 ('sso-retorno-evidencias','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000018/16891000-0000-4000-8000-000000000099',
  $q$update pcm.retorno_os_preparado set chave_evento='mudanca-sintetica' where id='16891000-0000-4000-8000-000000000018'$q$,'retorno'),
 ('sso-material-evidencias','16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000051/2/16891000-0000-4000-8000-000000000099',
  $q$update pcm.ordens_servico set deleted_at=now() where id='16891000-0000-4000-8000-000000000017'$q$,'OS de materiais')
) t(bucket,caminho,mutacao,fonte);
select extensions.dblink_disconnect('s180_concorrencia');
select * from finish();
rollback;
