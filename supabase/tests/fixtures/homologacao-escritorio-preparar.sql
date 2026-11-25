-- E00-S28: exemplos restritos a Sinérgica–Escritório; não é migration.
-- Executar como postgres no SQL Editor ou psql. Um único DO = escrita atômica.
-- Repetir mantém os mesmos IDs e não reabre exemplos aposentados.
do $homologacao$
declare
 v_cliente constant uuid := cast('741a283b-8e23-449f-83c7-668f35c98f20' as uuid);
 v_ator uuid; v_claims text := current_setting('request.jwt.claims',true);
 v_sync text := current_setting('app.auvo_sync_write',true);
 v_inicio timestamptz := now()+interval '2 hours';
 v_ids uuid[] := array[
  '02819000-0000-4000-8000-000000000020'::uuid,
  '02819000-0000-4000-8000-000000000021'::uuid,
  '02819000-0000-4000-8000-000000000030'::uuid,
  '02819000-0000-4000-8000-000000000031'::uuid,
  '02819000-0000-4000-8000-000000000040'::uuid,
  '02819000-0000-4000-8000-000000000050'::uuid];
begin
 if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'conexao_administrativa_necessaria'; end if;
 perform pg_advisory_xact_lock(hashtextextended('sso-homologacao-escritorio-20261125',0));
 if not exists(select 1 from pcm.clientes where id=v_cliente and ativo and deleted_at is null
   and nome in ('Sinérgica - Escritório','Sinérgica – Escritório')) then
  raise exception 'cliente_de_homologacao_nao_conferido'; end if;
 select u.user_id into v_ator from config.usuarios u join auth.users a on a.id=u.user_id
  where lower(a.email)='sinergicaengenharia+gestorpcm@gmail.com' and u.ativo;
 if v_ator is null then raise exception 'conta_gestor_pcm_de_homologacao_ausente'; end if;
 if exists(select 1 from pcm.chamados where id=any(v_ids) and (cliente_id<>v_cliente or titulo not like '[TESTE HOMOLOGAÇÃO]%'))
  or exists(select 1 from pcm.ordens_servico where id=any(v_ids) and (client_id<>v_cliente or titulo not like '[TESTE HOMOLOGAÇÃO]%')) then
  raise exception 'identificador_de_teste_ocupado'; end if;
 if exists(select 1 from pcm.funcionarios where id='02819000-0000-4000-8000-000000000050' and nome<>'[TESTE HOMOLOGAÇÃO] Técnico sem vínculo Auvo')
  or exists(select 1 from pcm.visitas where id='02819000-0000-4000-8000-000000000040' and cliente_id<>v_cliente)
  or exists(select 1 from pcm.sso_contratos_origem_campo where id='02819000-0000-4000-8000-000000000060'
    and (versao<>'homologacao-escritorio-20261125' or habilitado))
  or exists(select 1 from pcm.origem_campo_inbox where id='02819000-0000-4000-8000-000000000061'
    and (task_id<>890000000190001 or chave_evento<>'homologacao-escritorio-20261125')) then
  raise exception 'identificador_de_teste_ocupado'; end if;
 if exists(select 1 from pcm.sso_origem_campo_processamentos where integracao='auvo' and task_id=890000000190001
  and (cliente_id<>v_cliente or os_id<>'02819000-0000-4000-8000-000000000030' or contrato_id<>'02819000-0000-4000-8000-000000000060')) then
  raise exception 'identificador_de_teste_ocupado'; end if;
 -- Anti-loop da própria integração. Afeta somente esta transação e não altera trigger/gate.
 perform set_config('app.auvo_sync_write','true',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_ator,'role','service_role')::text,true);
 insert into pcm.funcionarios(id,nome,ativo,created_by) values
  ('02819000-0000-4000-8000-000000000050','[TESTE HOMOLOGAÇÃO] Técnico sem vínculo Auvo',true,v_ator)
 on conflict(id) do nothing;
 insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values
  ('02819000-0000-4000-8000-000000000020','CH-HOMOLOG-PCM-01',v_cliente,'[TESTE HOMOLOGAÇÃO] Campo a conciliar',v_ator),
  ('02819000-0000-4000-8000-000000000021','CH-HOMOLOG-PCM-02',v_cliente,'[TESTE HOMOLOGAÇÃO] Visita planejada sem envio',v_ator)
 on conflict(id) do nothing;
 insert into pcm.ordens_servico(id,client_id,chamado_id,numero,titulo,categoria,status,auvo_task_id,created_by) values
  ('02819000-0000-4000-8000-000000000030',v_cliente,'02819000-0000-4000-8000-000000000020',
   'OS-HOMOLOG-PCM-01','[TESTE HOMOLOGAÇÃO] Campo a conciliar — ID externo simulado','corretiva','planejamento',890000000190001,v_ator),
  ('02819000-0000-4000-8000-000000000031',v_cliente,'02819000-0000-4000-8000-000000000021',
   'OS-HOMOLOG-PCM-02','[TESTE HOMOLOGAÇÃO] Visita não confirmada T−24','preventiva','planejamento',null,v_ator)
 on conflict(id) do nothing;
 -- Contrato de exemplo DESABILITADO: não muda o contrato de integração operacional.
 insert into pcm.sso_contratos_origem_campo(id,integracao,versao,habilitado,definicao) values
  ('02819000-0000-4000-8000-000000000060','auvo','homologacao-escritorio-20261125',false,'{"campos":{"taskId":"taskId","clienteId":"clienteId","titulo":"titulo","status":"status","ordem":"ordem","descricao":"descricao","osExternaId":"osExternaId","chamadoId":"chamadoId","tecnicoId":"tecnicoId","dataAgendada":"dataAgendada","checkIn":"checkIn","checkOut":"checkOut","detalhes":"detalhes"},"estados":{"aberta":"aberta"},"fuso":"America/Sao_Paulo"}')
 on conflict(id) do nothing;
 insert into pcm.origem_campo_inbox(id,integracao,task_id,chave_evento,cliente_externo_id,payload) values
  ('02819000-0000-4000-8000-000000000061','auvo',890000000190001,'homologacao-escritorio-20261125',
   v_cliente::text,jsonb_build_object('homologacao',true,'taskId','890000000190001','clienteId',v_cliente::text,'titulo','[TESTE HOMOLOGAÇÃO] Campo a conciliar','status','aberta','ordem','1'))
 on conflict(id) do nothing;
 -- A guarda exige contrato habilitado no INSERT. Nenhuma outra transação enxerga este true:
 -- o MESMO bloco atômico volta a false antes de confirmar; erro reverte tudo.
 update pcm.sso_contratos_origem_campo set habilitado=true where id='02819000-0000-4000-8000-000000000060';
 insert into pcm.sso_origem_campo_processamentos(integracao,task_id,envelope_id,contrato_id,cliente_id,chamado_id,os_id,provisorio,motivo,projecao,resultado) values
  ('auvo',890000000190001,'02819000-0000-4000-8000-000000000061','02819000-0000-4000-8000-000000000060',v_cliente,
   '02819000-0000-4000-8000-000000000020','02819000-0000-4000-8000-000000000030',true,'referencia_ausente',
   '{"titulo":"[TESTE HOMOLOGAÇÃO] Campo a conciliar","statusCampo":"aberta","ordemExterna":"1","referenciaInvalida":false}',
   '{"homologacao":true,"envioAuvo":false}')
 on conflict(integracao,task_id) do nothing;
 update pcm.sso_contratos_origem_campo set habilitado=false where id='02819000-0000-4000-8000-000000000060';
 insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,estado,responsavel_id,created_by) values
  ('02819000-0000-4000-8000-000000000040',v_cliente,v_inicio,v_inicio+interval '2 hours',
   'America/Sao_Paulo','regular','planejada','02819000-0000-4000-8000-000000000050',v_ator)
 on conflict(id) do nothing;
 insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,created_by) values
  ('02819000-0000-4000-8000-000000000041','02819000-0000-4000-8000-000000000040','02819000-0000-4000-8000-000000000031',v_cliente,1,v_ator)
 on conflict(id) do nothing;
 if exists(select 1 from pcm.auvo_sync_outbox where row_id=any(v_ids))
  or exists(select 1 from pcm.sso_t24_tentativas where os_id=any(v_ids)) then
  raise exception 'exemplo_gerou_fila_ou_tentativa_auvo'; end if;
 perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
 perform set_config('app.auvo_sync_write',coalesce(v_sync,'false'),true);
 raise notice 'Exemplos preparados no Escritório. Visita planejada em %. Nenhuma fila/tentativa Auvo.',v_inicio;
end $homologacao$;

