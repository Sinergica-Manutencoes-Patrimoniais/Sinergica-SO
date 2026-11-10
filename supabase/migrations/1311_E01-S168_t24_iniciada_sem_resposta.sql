-- ADR-1143: observação local conservadora; não agenda e não reenvia tarefas.
alter table pcm.sso_t24_tentativas add column efeito_iniciado_em timestamptz check(efeito_iniciado_em is null or isfinite(efeito_iniciado_em));
create table pcm.sso_t24_varredura_incerta_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_t24_varredura_incerta_gate(id,habilitado) values(true,false);
create table pcm.sso_t24_varredura_incerta_recibos(
 request_id uuid primary key,cursor_entrada uuid,limite integer not null check(limite between 1 and 50),
 atraso_segundos integer not null check(atraso_segundos between 60 and 604800),resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_t24_varredura_incerta_gate enable row level security;
alter table pcm.sso_t24_varredura_incerta_gate force row level security;
alter table pcm.sso_t24_varredura_incerta_recibos enable row level security;
alter table pcm.sso_t24_varredura_incerta_recibos force row level security;
revoke all on pcm.sso_t24_varredura_incerta_gate,pcm.sso_t24_varredura_incerta_recibos from public,anon,authenticated,service_role;
create trigger sso_t24_varredura_incerta_recibos_imutaveis before update or delete on pcm.sso_t24_varredura_incerta_recibos
 for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_t24_varrer_iniciadas(p_request_id uuid,p_cursor uuid,p_limite integer,p_atraso_segundos integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_t24_varredura_incerta_recibos%rowtype;v pcm.sso_t24_tentativas%rowtype;v_id uuid;v_cursor uuid:=p_cursor;
 v_total integer:=0;v_alterados integer:=0;v_seq bigint;v_resultado jsonb;v_agora timestamptz:=clock_timestamp();
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'servico_nao_autorizado' using errcode='42501'; end if;
 if p_request_id is null or p_limite is null or p_limite not between 1 and 50 or p_atraso_segundos is null or p_atraso_segundos not between 60 and 604800 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_t24_varredura_incerta_gate where id and habilitado for share;
 if not found then raise exception 'varredura_desabilitada' using errcode='55000'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-t24-varredura:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_t24_varredura_incerta_recibos where request_id=p_request_id;
 if found then
  if v_ant.cursor_entrada is distinct from p_cursor or v_ant.limite is distinct from p_limite or v_ant.atraso_segundos is distinct from p_atraso_segundos then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return v_ant.resultado;
 end if;
 for v_id in select t.id from pcm.sso_t24_tentativas t where (p_cursor is null or t.id>p_cursor) and t.estado='iniciado'
   and t.efeito_iniciado_em is not null and t.efeito_iniciado_em<=v_agora-make_interval(secs=>p_atraso_segundos)
   order by t.id limit p_limite loop
  v_cursor:=v_id;v_total:=v_total+1;
  select * into v from pcm.sso_t24_tentativas where id=v_id for update;
  if not found or v.estado<>'iniciado' or v.efeito_iniciado_em is null or v.efeito_iniciado_em>v_agora-make_interval(secs=>p_atraso_segundos) then continue; end if;
  update pcm.sso_t24_tentativas set estado='incerto',reservado_ate=null,atualizado_em=v_agora where id=v.id;
  select coalesce(max(sequencia),0)+1 into v_seq from pcm.sso_t24_tentativa_eventos where tentativa_id=v.id;
  insert into pcm.sso_t24_tentativa_eventos(tentativa_id,sequencia,fence,estado,motivo) values(v.id,v_seq,v.fence,'incerto','efeito_sem_resposta');
  v_alterados:=v_alterados+1;
 end loop;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'considerados',v_total,'marcadosIncertos',v_alterados,
  'proximoCursor',case when v_total=p_limite then v_cursor else null end,'efeitoRemotoComprovado',false);
 insert into pcm.sso_t24_varredura_incerta_recibos(request_id,cursor_entrada,limite,atraso_segundos,resultado) values(p_request_id,p_cursor,p_limite,p_atraso_segundos,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(null,'integracao.t24_varredura_incerta','sso_t24_varredura_incerta_recibos',p_request_id,jsonb_build_object('considerados',v_total,'marcadosIncertos',v_alterados));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_t24_varrer_iniciadas(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
