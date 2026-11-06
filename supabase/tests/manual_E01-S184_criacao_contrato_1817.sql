-- Fixture manual sintética S184/1817 em clone descartável; termina com rollback.
-- Testa colaborador, custos ocultos, unicidade, revogação, papel e ACL.
begin;


insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sem-modulo-s07@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leitura-s07@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'escrita-s07@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- S184 exige usuários ativos e permissões atuais além das claims sintéticas.
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('00000000-0000-0000-0000-000000000901','colaborador','Sem módulo S07',true),
 ('00000000-0000-0000-0000-000000000902','colaborador','Leitura S07',true),
 ('00000000-0000-0000-0000-000000000903','colaborador','Escrita S07',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values
 ('00000000-0000-0000-0000-000000000902','comercial','leitura'),
 ('00000000-0000-0000-0000-000000000903','comercial','escrita'),
 ('00000000-0000-0000-0000-000000000903','financeiro','leitura');

insert into pcm.clientes (id, nome, ativo, created_by)
values ('00000000-0000-0000-0000-0000000009d1', 'Condomínio Teste E03-S07', true, '00000000-0000-0000-0000-000000000901')
on conflict (id) do nothing;

insert into comercial.etapas_funil (id, nome, ordem, cor, tipo)
values
  ('00000000-0000-0000-0000-0000000009f1', 'Etapa Aberta Teste S07', 981, '#000000', 'aberta'),
  ('00000000-0000-0000-0000-0000000009f2', 'Etapa Ganha Teste S07', 982, '#00ff00', 'ganha')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000903","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';

insert into comercial.oportunidades (id, cliente_id, etapa_id, titulo)
values
  ('00000000-0000-0000-0000-000000000ca1', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Oportunidade residente — S07'),
  ('00000000-0000-0000-0000-000000000ca2', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Oportunidade avulso — S07'),
  ('00000000-0000-0000-0000-000000000ca3', '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009f1', 'Oportunidade valor zero — S07');

insert into comercial.propostas (id, oportunidade_id, tipo, status, custo_total_centavos, piso_centavos, preco_sugerido_centavos, preco_centavos)
values
  ('00000000-0000-0000-0000-000000000cb1', '00000000-0000-0000-0000-000000000ca1', 'residente', 'aceita', 10000, 10638, 12766, 50000),
  ('00000000-0000-0000-0000-000000000cb2', '00000000-0000-0000-0000-000000000ca2', 'simples', 'aceita', 10000, 10638, 12766, 12766),
  ('00000000-0000-0000-0000-000000000cb3', '00000000-0000-0000-0000-000000000ca3', 'volante', 'aceita', 0, 0, 0, 0);

-- Teste funcional sintético: 1817 mantém custos privados e exige escrita atual.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000903","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
do $$
declare v_id uuid;
begin
 if (select count(*) from comercial.propostas) <> 0 then raise exception 'custos_expostos'; end if;
 if (select count(*) from comercial.propostas_sem_custos where id in ('00000000-0000-0000-0000-000000000cb1','00000000-0000-0000-0000-000000000cb2')) <> 2 then raise exception 'view_inacessivel'; end if;
 select (comercial.fn_criar_contrato('00000000-0000-0000-0000-000000000cb1')).id into v_id;
 if v_id is null then raise exception 'criacao_sem_id'; end if;
 begin
   perform comercial.fn_criar_contrato('00000000-0000-0000-0000-000000000cb1');
   raise exception 'duplicata_aceita';
 exception when unique_violation then null; end;
end $$;
reset role;
update config.usuario_modulos set nivel='leitura' where user_id='00000000-0000-0000-0000-000000000903' and modulo='comercial';
set local role authenticated;
do $$ begin
 begin
  perform comercial.fn_criar_contrato('00000000-0000-0000-0000-000000000cb2');
  raise exception 'escrita_revogada_aceita';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update config.usuario_modulos set nivel='escrita' where user_id='00000000-0000-0000-0000-000000000903' and modulo='comercial';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000903","user_role":"superadmin","user_modulos":{"comercial":"escrita"}}';
do $$ begin
 begin
  perform comercial.fn_criar_contrato('00000000-0000-0000-0000-000000000cb2');
  raise exception 'papel_divergente_aceito';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','comercial.fn_criar_contrato(uuid)','execute') then raise exception 'anon_pode_criar'; end if;
 if (select count(*) from comercial.contratos where proposta_id='00000000-0000-0000-0000-000000000cb1') <> 1 then raise exception 'duplicata_ou_ausencia'; end if;
 if exists(select 1 from comercial.contratos where proposta_id='00000000-0000-0000-0000-000000000cb2') then raise exception 'contrato_indevido'; end if;
end $$;
rollback;
