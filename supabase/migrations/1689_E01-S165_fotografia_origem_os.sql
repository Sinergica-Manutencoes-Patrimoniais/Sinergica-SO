-- ADR-1546: cada OS nova conserva a versão operacional usada na criação.
create table pcm.sso_origens_os_preventiva (
 os_id uuid primary key references pcm.ordens_servico(id), cliente_id uuid not null references pcm.clientes(id),
 plano_id uuid not null references pcm.planos_manutencao(id), preparada_id uuid not null, tipo text not null check(tipo in ('calendario','visita')),
 versao_id uuid not null references pcm.plano_versoes(id), rotina_id uuid not null, snapshot jsonb not null,
 criado_em timestamptz not null default clock_timestamp()
);
alter table pcm.sso_origens_os_preventiva enable row level security;
alter table pcm.sso_origens_os_preventiva force row level security;
revoke all on pcm.sso_origens_os_preventiva from public,anon,authenticated,service_role;
create trigger sso_origens_os_preventiva_imutavel before update or delete on pcm.sso_origens_os_preventiva for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Os dois modos de origem preservam também a identidade da preparada.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_guardar_os_chamado_preventivo()'::regprocedure);
 a text:=$antes$'logica',o.rotina_logica_id,'alvoTipo',o.alvo_tipo,'alvo',o.alvo_id,'modo',$antes$;
 b text:=$depois$'preparada',o.id,'logica',o.rotina_logica_id,'alvoTipo',o.alvo_tipo,'alvo',o.alvo_id,'modo',$depois$;
 c text:=' v_origem:=v_origens->0;';
 e text:=$novo$ v_origem:=v_origens->0;
 if tg_op='INSERT' then
  lock table pcm.sso_versoes_operacionais_ciclo,pcm.plano_versoes in share mode nowait;
  v_efetiva:=pcm.sso_versao_operacional_ciclo((v_origem->>'cliente')::uuid,(v_origem->>'plano')::uuid,(v_origem->>'preparada')::uuid,v_origem->>'modo');
  v_origem:=v_origem||jsonb_build_object('versao',v_efetiva->>'versaoId','rotina',v_efetiva->>'rotinaId');
 else
  select * into v_foto_os from pcm.sso_origens_os_preventiva where os_id=new.id;
  if found then
   if v_foto_os.cliente_id is distinct from new.client_id or v_foto_os.plano_id is distinct from (v_origem->>'plano')::uuid
    or v_foto_os.preparada_id is distinct from (v_origem->>'preparada')::uuid or v_foto_os.tipo is distinct from v_origem->>'modo' then
    raise exception 'origem_os_preventiva_divergente' using errcode='23514';end if;
   v_origem:=v_origem||jsonb_build_object('versao',v_foto_os.versao_id,'rotina',v_foto_os.rotina_id);
  end if;
 end if;$novo$;
 old_map text:=$antes$ if new.chamado_id is null then return new; end if;
 select jsonb_agg(x.origem) into v_origens$antes$;
 new_map text:=$novo$ if new.chamado_id is null then return new; end if;
 if tg_op='INSERT' then lock table pcm.sso_chamados_ciclo_preventivo,pcm.sso_chamados_ciclo_visita in share mode nowait;end if;
 select jsonb_agg(x.origem) into v_origens$novo$;
 old_snapshot text:=$antes$ select v.snapshot into v_snapshot from pcm.plano_versoes v join pcm.planos_manutencao p on p.id=v.plano_id$antes$;
 new_snapshot text:=$novo$ select case when tg_op='UPDATE' and v_foto_os.os_id is not null then v_foto_os.snapshot else v.snapshot end into v_snapshot from pcm.plano_versoes v join pcm.planos_manutencao p on p.id=v.plano_id$novo$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>2 or (length(d)-length(replace(d,c,'')))/length(c)<>1
  or (length(d)-length(replace(d,old_snapshot,'')))/length(old_snapshot)<>1 or (length(d)-length(replace(d,old_map,'')))/length(old_map)<>1 then raise exception 'definicao_origem_os_incompativel' using errcode='55000';end if;
 d:=replace(d,'v_alvo uuid;v_tipo text;v_tipo_tarefa uuid;v_questionario uuid;','v_alvo uuid;v_tipo text;v_tipo_tarefa uuid;v_questionario uuid;v_efetiva jsonb;v_foto_os pcm.sso_origens_os_preventiva%rowtype;');
 if position('v_foto_os pcm.sso_origens_os_preventiva%rowtype;' in d)=0 then raise exception 'declaracao_origem_os_incompativel' using errcode='55000';end if;
 execute replace(replace(replace(replace(d,a,b),c,e),old_snapshot,new_snapshot),old_map,new_map);
end; $migracao$;

create function pcm.sso_fotografar_origem_os_preventiva() returns trigger language plpgsql volatile security definer set search_path='' as $$
declare v_origens jsonb;v_origem jsonb;v_efetiva jsonb;v_snapshot jsonb;
begin
 if new.chamado_id is null then return new;end if;
 select jsonb_agg(x.origem) into v_origens from (
  select jsonb_build_object('cliente',m.cliente_id,'plano',m.plano_id,'preparada',m.preparada_id,'tipo','calendario') origem from pcm.sso_chamados_ciclo_preventivo m where m.chamado_id=new.chamado_id
  union all select jsonb_build_object('cliente',m.cliente_id,'plano',m.plano_id,'preparada',m.preparada_id,'tipo','visita') from pcm.sso_chamados_ciclo_visita m where m.chamado_id=new.chamado_id
 ) x;
 if v_origens is null then return new;end if;
 if jsonb_array_length(v_origens)<>1 then raise exception 'origem_preventiva_ambigua' using errcode='23514';end if;
 v_origem:=v_origens->0;
 if v_origem->>'cliente' is distinct from new.client_id::text then raise exception 'origem_preventiva_incompativel' using errcode='23514';end if;
 v_efetiva:=pcm.sso_versao_operacional_ciclo(new.client_id,(v_origem->>'plano')::uuid,(v_origem->>'preparada')::uuid,v_origem->>'tipo');
 select snapshot into v_snapshot from pcm.plano_versoes where id=(v_efetiva->>'versaoId')::uuid and plano_id=(v_origem->>'plano')::uuid and estado='aprovado' for share;
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;
 insert into pcm.sso_origens_os_preventiva(os_id,cliente_id,plano_id,preparada_id,tipo,versao_id,rotina_id,snapshot)
 values(new.id,new.client_id,(v_origem->>'plano')::uuid,(v_origem->>'preparada')::uuid,v_origem->>'tipo',(v_efetiva->>'versaoId')::uuid,(v_efetiva->>'rotinaId')::uuid,v_snapshot);
 return new;
end; $$;
revoke all on function pcm.sso_fotografar_origem_os_preventiva() from public,anon,authenticated,service_role;
create trigger sso_fotografar_origem_os_preventiva after insert on pcm.ordens_servico for each row execute function pcm.sso_fotografar_origem_os_preventiva();
