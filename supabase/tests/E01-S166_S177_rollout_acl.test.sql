-- Os mediadores e seus núcleos ainda aguardam rollout coordenado.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(18);

select ok(not has_function_privilege(r.papel, f.assinatura, 'execute'),
  r.papel || ' não executa ' || f.assinatura)
from (values
  ('pcm.sso_pcm_gerar_visita(uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text)'),
  ('pcm.sso_pcm_gerar_visita_suprimivel(uuid,uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text)'),
  ('pcm.sso_localizar_codigo_publico(uuid,text)'),
  ('pcm.sso_localizar_codigo_publico_mediada(uuid,uuid,text)'),
  ('pcm.sso_listar_aliases_ativo(uuid,text,uuid,uuid,integer)'),
  ('pcm.sso_listar_aliases_ativo_mediada(uuid,uuid,text,uuid,uuid,integer)')
) as f(assinatura)
cross join (values ('anon'), ('authenticated'), ('service_role')) as r(papel);

select * from finish();
rollback;
