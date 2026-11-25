-- Arquivamento reversível dos exemplos; mantém evidência e tabelas append-only.
-- Não cancela tarefa no Auvo nem altera gates. Executar como postgres.
do $aposentar$
declare v_cliente constant uuid := cast('741a283b-8e23-449f-83c7-668f35c98f20' as uuid);
 v_sync text := current_setting('app.auvo_sync_write',true);
begin
 perform pg_advisory_xact_lock(hashtextextended('sso-homologacao-escritorio-20261125',0));
 if exists(select 1 from pcm.visitas where id='02819000-0000-4000-8000-000000000040'
   and (cliente_id<>v_cliente or estado not in ('planejada','rascunho','cancelada'))) then
  raise exception 'visita_ja_operada_nao_aposentar_automaticamente'; end if;
 if exists(select 1 from pcm.ordens_servico where id in ('02819000-0000-4000-8000-000000000030','02819000-0000-4000-8000-000000000031')
   and (client_id<>v_cliente or titulo not like '[TESTE HOMOLOGAÇÃO]%')) then
  raise exception 'identificador_de_teste_ocupado'; end if;
 if exists(select 1 from pcm.ordens_servico where id in ('02819000-0000-4000-8000-000000000030','02819000-0000-4000-8000-000000000031')
  and deleted_at is null and (status<>'planejamento'
   or (id='02819000-0000-4000-8000-000000000030' and (chamado_id is distinct from '02819000-0000-4000-8000-000000000020'::uuid or auvo_task_id is distinct from 890000000190001::bigint))
   or (id='02819000-0000-4000-8000-000000000031' and (chamado_id is distinct from '02819000-0000-4000-8000-000000000021'::uuid or auvo_task_id is not null))))
  or exists(select 1 from pcm.sso_t24_tentativas where os_id in ('02819000-0000-4000-8000-000000000030','02819000-0000-4000-8000-000000000031'))
  or exists(select 1 from pcm.auvo_sync_outbox where row_id in ('02819000-0000-4000-8000-000000000030','02819000-0000-4000-8000-000000000031'))
  or exists(select 1 from pcm.visitas where responsavel_id='02819000-0000-4000-8000-000000000050'
   and id<>'02819000-0000-4000-8000-000000000040' and estado not in ('cancelada','concluida','reprogramada')) then
  raise exception 'exemplo_ja_operado_nao_aposentar_automaticamente'; end if;
 perform set_config('app.auvo_sync_write','true',true);
 update pcm.visitas set estado='cancelada',updated_at=now()
  where id='02819000-0000-4000-8000-000000000040' and cliente_id=v_cliente and estado in ('planejada','rascunho');
 update pcm.ordens_servico set deleted_at=now()
  where id in ('02819000-0000-4000-8000-000000000030','02819000-0000-4000-8000-000000000031')
    and client_id=v_cliente and deleted_at is null;
 update pcm.chamados set deleted_at=now()
  where id in ('02819000-0000-4000-8000-000000000020','02819000-0000-4000-8000-000000000021')
    and cliente_id=v_cliente and deleted_at is null and titulo like '[TESTE HOMOLOGAÇÃO]%';
 update pcm.funcionarios set ativo=false where id='02819000-0000-4000-8000-000000000050'
  and nome='[TESTE HOMOLOGAÇÃO] Técnico sem vínculo Auvo';
 perform set_config('app.auvo_sync_write',coalesce(v_sync,'false'),true);
end $aposentar$;

