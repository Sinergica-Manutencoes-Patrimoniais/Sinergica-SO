-- ADR-1434: coluna aditiva; preserva snapshots já aprovados.
alter table pcm.rotinas_manutencao add column if not exists tipo_tarefa_id uuid references pcm.tipos_tarefa(id);

create function pcm.sso_aplicar_tipo_tarefa_legada() returns trigger language plpgsql security definer set search_path='' as $$
declare v_rotina pcm.rotinas_manutencao%rowtype;v_plano pcm.planos_manutencao%rowtype;
begin
 select * into v_plano from pcm.planos_manutencao where id=new.plano_legado_id and cliente_id=new.cliente_id for update;
 if not found or v_plano.estado<>'rascunho' or v_plano.revisao is distinct from (new.payload->>'expectedRevision')::integer then raise exception 'rascunho_alterado' using errcode='40001'; end if;
 select * into v_rotina from pcm.rotinas_manutencao where id=new.rotina_id and plano_id=v_plano.id and versao_id=new.versao_id for update;
 if not found or (v_rotina.tipo_tarefa_id is not null and v_rotina.tipo_tarefa_id is distinct from new.tipo_tarefa_id) then raise exception 'rotina_alterada' using errcode='40001'; end if;
 if not exists(select 1 from pcm.plano_versoes where id=new.versao_id and plano_id=v_plano.id and estado='rascunho') then raise exception 'versao_indisponivel' using errcode='23514'; end if;
 update pcm.rotinas_manutencao set tipo_tarefa_id=new.tipo_tarefa_id where id=v_rotina.id;
 update pcm.planos_manutencao set revisao=revisao+1,updated_at=now(),updated_by=new.ator_id where id=v_plano.id;
 return new;
end; $$;
revoke all on function pcm.sso_aplicar_tipo_tarefa_legada() from public,anon,authenticated,service_role;
create trigger sso_aplicar_tipo_tarefa_legada after insert on pcm.sso_referencias_tarefa_legada for each row execute function pcm.sso_aplicar_tipo_tarefa_legada();
