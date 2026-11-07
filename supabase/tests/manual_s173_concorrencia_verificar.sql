-- Após COMMIT das duas sessões; coexistência 1/1 reproduz a falha e NÃO é PASS de segurança.
select (select count(*) from pcm.retorno_os_preparado where id='17390000-0000-4000-8000-000000000015') as retornos,
       (select count(*) from pcm.sso_vinculos_os_grupo where request_id='17390000-0000-4000-8000-000000000016') as vinculos,
       (select habilitado from pcm.sso_vinculo_os_grupo_gate where id) as gate_aberto;
