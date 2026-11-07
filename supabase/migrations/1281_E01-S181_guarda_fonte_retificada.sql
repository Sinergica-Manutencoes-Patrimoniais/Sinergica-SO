-- ADR-1123: defesa nas transições da proposta, sem alterar versões já publicadas.
create table comercial.sso_guarda_fonte_retificada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_guarda_fonte_retificada_gate(id,habilitado) values(true,false);
alter table comercial.sso_guarda_fonte_retificada_gate enable row level security;
alter table comercial.sso_guarda_fonte_retificada_gate force row level security;
revoke all on comercial.sso_guarda_fonte_retificada_gate from public,anon,authenticated,service_role;

create function comercial.sso_guardar_transicao_fonte_retificada() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_habilitado boolean;v_id uuid;
begin
 if new.status is not distinct from old.status or new.status::text not in ('em_revisao','aprovada','enviada') then return new; end if;
 select habilitado into v_habilitado from comercial.sso_guarda_fonte_retificada_gate where id for share;
 if v_habilitado is distinct from true then return new; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 -- Um uso conhecido sem fotografia corrente não pode ser tratado como
 -- composição conferida; não inferir que fontes ausentes permanecem válidas.
 if exists(select 1 from comercial.sso_usos_fonte_aquisicao u where u.proposta_id=new.id)
  and not exists(select 1 from comercial.sso_composicao_mista_comandos c
   where c.payload->>'propostaId'=new.id::text and c.resultado->>'revision'=new.versao_atual::text) then
  raise exception 'fonte_sem_fotografia_exige_recomposicao' using errcode='23514';
 end if;
 for v_id in select distinct (f->>'fonteId')::uuid from comercial.sso_composicao_mista_comandos c
  cross join lateral jsonb_array_elements(c.aquisicoes_validadas) f
  where c.payload->>'propostaId'=new.id::text and c.resultado->>'revision'=new.versao_atual::text
  order by (f->>'fonteId')::uuid loop
   if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('uso-fonte-aquisicao:'||v_id::text,0)) then
    raise exception 'fonte_em_alteracao' using errcode='55P03'; end if;
 end loop;
 if exists(select 1 from comercial.sso_composicao_mista_comandos c cross join lateral jsonb_array_elements(c.aquisicoes_validadas) f
  join comercial.sso_retificacoes_fonte_aquisicao r on r.fonte_anterior_id=(f->>'fonteId')::uuid
  where c.payload->>'propostaId'=new.id::text and c.resultado->>'revision'=new.versao_atual::text) then
  raise exception 'fonte_retificada_exige_recomposicao' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function comercial.sso_guardar_transicao_fonte_retificada() from public,anon,authenticated,service_role;
create trigger sso_guardar_transicao_fonte_retificada before update of status on comercial.propostas
 for each row execute function comercial.sso_guardar_transicao_fonte_retificada();
