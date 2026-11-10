-- ADR-0516: permitir atualizações posteriores sem permitir segunda criação.
create table pcm.sso_reuso_cadastro_lote_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_reuso_cadastro_lote_gate(id,habilitado) values(true,false);
create table pcm.sso_criacoes_levantamento(tipo text not null,entidade_id uuid not null,lote_id uuid not null,linha_chave text not null,request_id uuid not null unique,primary key(tipo,entidade_id),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_incorporacoes(lote_id,linha_chave));
create table pcm.sso_primeiro_vinculo_levantamento(tipo text not null,entidade_id uuid not null,lote_id uuid not null,linha_chave text not null,primary key(tipo,entidade_id),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_incorporacoes(lote_id,linha_chave));
alter table pcm.sso_reuso_cadastro_lote_gate enable row level security;alter table pcm.sso_reuso_cadastro_lote_gate force row level security;
alter table pcm.sso_criacoes_levantamento enable row level security;alter table pcm.sso_criacoes_levantamento force row level security;
alter table pcm.sso_primeiro_vinculo_levantamento enable row level security;alter table pcm.sso_primeiro_vinculo_levantamento force row level security;
revoke all on pcm.sso_reuso_cadastro_lote_gate,pcm.sso_criacoes_levantamento,pcm.sso_primeiro_vinculo_levantamento from public,anon,authenticated,service_role;
-- Na dúvida histórica, preservar a reserva de criação.
insert into pcm.sso_criacoes_levantamento(tipo,entidade_id,lote_id,linha_chave,request_id)
select i.tipo,i.entidade_id,i.lote_id,i.linha_chave,i.request_id from pcm.sso_levantamento_incorporacoes i left join pcm.sso_levantamento_comandos c on c.request_id=i.request_id
where c.request_id is null or jsonb_typeof(c.resultado->'created') is distinct from 'boolean' or c.resultado->'created'='true'::jsonb;
insert into pcm.sso_primeiro_vinculo_levantamento(tipo,entidade_id,lote_id,linha_chave) select i.tipo,i.entidade_id,i.lote_id,i.linha_chave from pcm.sso_levantamento_incorporacoes i;
alter table pcm.sso_levantamento_incorporacoes drop constraint sso_levantamento_incorporacoes_tipo_entidade_id_key;
alter table pcm.sso_levantamento_incorporacoes add constraint sso_levantamento_incorporacoes_entidade_por_lote_key unique(lote_id,tipo,entidade_id);
create function pcm.sso_guardar_reuso_cadastro_lote() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_reuso_cadastro_lote_gate where id),false) and exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.tipo=new.tipo and i.entidade_id=new.entidade_id) then raise exception 'cadastro_ja_registrado_em_outro_lote' using errcode='23505'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_reuso_cadastro_lote() from public,anon,authenticated,service_role;
create trigger sso_guardar_reuso_cadastro_lote before insert on pcm.sso_levantamento_incorporacoes for each row execute function pcm.sso_guardar_reuso_cadastro_lote();
create function pcm.sso_reservar_criacao_levantamento() returns trigger language plpgsql security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 select c.resultado into v_resultado from pcm.sso_levantamento_comandos c where c.request_id=new.request_id;
 if jsonb_typeof(v_resultado->'created') is distinct from 'boolean' or v_resultado->>'aggregateId' is distinct from new.lote_id::text or v_resultado->'linkedIds'->>'entidadeId' is distinct from new.entidade_id::text or v_resultado->'linkedIds'->>'tipo' is distinct from new.tipo then raise exception 'comando_incorporacao_nao_reconciliado' using errcode='23514'; end if;
 if coalesce((select habilitado from pcm.sso_reuso_cadastro_lote_gate where id),false) then
   insert into pcm.sso_primeiro_vinculo_levantamento(tipo,entidade_id,lote_id,linha_chave) values(new.tipo,new.entidade_id,new.lote_id,new.linha_chave) on conflict(tipo,entidade_id) do nothing;
 else
   insert into pcm.sso_primeiro_vinculo_levantamento(tipo,entidade_id,lote_id,linha_chave) values(new.tipo,new.entidade_id,new.lote_id,new.linha_chave);
 end if;
 if v_resultado->'created'='true'::jsonb then insert into pcm.sso_criacoes_levantamento(tipo,entidade_id,lote_id,linha_chave,request_id) values(new.tipo,new.entidade_id,new.lote_id,new.linha_chave,new.request_id); end if;
 return null;
end; $$;
revoke all on function pcm.sso_reservar_criacao_levantamento() from public,anon,authenticated,service_role;
create constraint trigger sso_reservar_criacao_levantamento after insert on pcm.sso_levantamento_incorporacoes deferrable initially deferred for each row execute function pcm.sso_reservar_criacao_levantamento();
create trigger sso_criacoes_levantamento_imutaveis before update or delete on pcm.sso_criacoes_levantamento for each row execute function pcm.sso_proteger_incorporacao_levantamento();
create trigger sso_primeiro_vinculo_levantamento_imutavel before update or delete on pcm.sso_primeiro_vinculo_levantamento for each row execute function pcm.sso_proteger_incorporacao_levantamento();
