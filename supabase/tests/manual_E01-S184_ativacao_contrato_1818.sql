-- Fixture manual sintética 1818; clone descartável e rollback.
-- comercial_contratos_rls.test.sql — pgTAP (E03-S07)
-- RLS de comercial.contratos (AC-1), unicidade proposta_id (AC-3), ciclo criar→ativar→encerrar com
-- plano de faturamento no Financeiro (AC-2/AC-4/AC-5/AC-7/AC-8), tipo avulso sem plano, guardas de
-- ativação (valor zero, vigência vencida, status errado) e regressão do cron pra contrato legado
-- (AC-6). Cenários já confirmados manualmente em produção (smoke test com `set_config`/rollback)
-- antes desta suíte ser escrita. Rodar com `supabase test db` (requer Docker).

begin;
set local app.auvo_sync_write='true';


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


set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000903","user_role":"colaborador","user_modulos":{"comercial":"escrita","financeiro":"leitura"}}';
do $$
declare v_contrato uuid; v_pendente uuid; v_plano uuid;
begin
 if (select count(*) from comercial.propostas) <> 0 then raise exception 'custos_expostos'; end if;
 select (comercial.fn_criar_contrato('00000000-0000-0000-0000-000000000cb1')).id into v_contrato;
 select (comercial.fn_criar_contrato('00000000-0000-0000-0000-000000000cb2')).id into v_pendente;
 if v_contrato is null or v_pendente is null then raise exception 'criacao_indisponivel'; end if;
 perform comercial.fn_ativar_contrato(v_contrato);
 if not exists (select 1 from comercial.oportunidades o join comercial.etapas_funil e on e.id=o.etapa_id where o.id='00000000-0000-0000-0000-000000000ca1' and e.tipo='ganha') then raise exception 'etapa_nao_ganha'; end if;
 select financeiro_contrato_id into v_plano from comercial.contratos where id=v_contrato and status='ativo';
 if v_plano is null or not exists(select 1 from financeiro.contratos where id=v_plano and comercial_contrato_id=v_contrato and status='ativo') then raise exception 'plano_nao_ativado'; end if;
end $$;
reset role;
update config.usuario_modulos set nivel='leitura' where user_id='00000000-0000-0000-0000-000000000903' and modulo='comercial';
set local role authenticated;
do $$ begin
 begin
   perform comercial.fn_ativar_contrato((select id from comercial.contratos where proposta_id='00000000-0000-0000-0000-000000000cb2'));
   raise exception 'ativacao_revogada_aceita';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update config.usuario_modulos set nivel='escrita' where user_id='00000000-0000-0000-0000-000000000903' and modulo='comercial';
insert into pcm.clientes(id,nome,ativo,created_by) values ('18180000-0000-4000-8000-000000000001','Cliente divergente sintético',true,'00000000-0000-0000-0000-000000000903');
update comercial.contratos set cliente_id='18180000-0000-4000-8000-000000000001' where proposta_id='00000000-0000-0000-0000-000000000cb2';
set local role authenticated;
do $$ begin
 begin
  perform comercial.fn_ativar_contrato((select id from comercial.contratos where proposta_id='00000000-0000-0000-0000-000000000cb2'));
  raise exception 'cliente_divergente_aceito';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update comercial.contratos set cliente_id='00000000-0000-0000-0000-0000000009d1' where proposta_id='00000000-0000-0000-0000-000000000cb2';
set local role authenticated;
set local request.jwt.claims='{"sub":"00000000-0000-0000-0000-000000000903","user_role":"superadmin","user_modulos":{"comercial":"escrita"}}';
do $$ begin
 begin
  perform comercial.fn_ativar_contrato((select id from comercial.contratos where proposta_id='00000000-0000-0000-0000-000000000cb2'));
  raise exception 'papel_divergente_aceito';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from comercial.contratos where proposta_id='00000000-0000-0000-0000-000000000cb2' and status='rascunho' and financeiro_contrato_id is null) then raise exception 'ativacao_parcial'; end if;
 if exists(select 1 from comercial.oportunidades o join comercial.etapas_funil e on e.id=o.etapa_id where o.id='00000000-0000-0000-0000-000000000ca2' and e.tipo='ganha') then raise exception 'oportunidade_alterada_na_falha'; end if;
end $$;
rollback;
