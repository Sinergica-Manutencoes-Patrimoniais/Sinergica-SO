-- ADR-0341: somente nova aprovação, sem reescrever snapshot histórico.
create table pcm.sso_snapshot_contrato_pergunta_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_snapshot_contrato_pergunta_gate enable row level security;
alter table pcm.sso_snapshot_contrato_pergunta_gate force row level security;
revoke all on pcm.sso_snapshot_contrato_pergunta_gate from public,anon,authenticated,service_role;
insert into pcm.sso_snapshot_contrato_pergunta_gate(id,habilitado) values(true,false);

create function pcm.sso_congelar_contratos_pergunta() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_rotina jsonb;v_pergunta jsonb;v_questoes jsonb;v_contrato pcm.sso_contratos_pergunta_rascunho%rowtype;v_saida jsonb:='[]'::jsonb;v_rotina_id uuid;v_questionario_id uuid;
begin
 if old.estado<>'rascunho' or new.estado<>'aprovado' or not coalesce((select habilitado from pcm.sso_snapshot_contrato_pergunta_gate where id),false) then return new; end if;
 if jsonb_typeof(new.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_invalido' using errcode='23514'; end if;
 for v_rotina in select value from jsonb_array_elements(new.snapshot->'rotinas') loop
  if v_rotina->>'questionario_id' is null then continue; end if;
  v_rotina_id:=(v_rotina->>'id')::uuid;v_questionario_id:=(v_rotina->>'questionario_id')::uuid;
  if jsonb_typeof(v_rotina->'questionario') is distinct from 'object' or v_rotina->'questionario'->>'id' is distinct from v_rotina->>'questionario_id' then raise exception 'questionario_invalido' using errcode='23514'; end if;
  v_questoes:=v_rotina->'questionario'->'perguntas';
  if jsonb_typeof(v_questoes) is distinct from 'array' or jsonb_array_length(v_questoes)=0 then raise exception 'perguntas_indisponiveis' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(v_questoes) x(item) where jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') not in ('string','number') or nullif(btrim(item->>'id'),'') is null) or exists(select 1 from jsonb_array_elements(v_questoes) x(item) group by item->>'id' having count(*)>1) then raise exception 'perguntas_invalidas' using errcode='23514'; end if;
  for v_pergunta in select value from jsonb_array_elements(v_questoes) loop
   select * into v_contrato from pcm.sso_contratos_pergunta_rascunho c where c.plano_id=new.plano_id and c.versao_id=new.id and c.rotina_id=v_rotina_id and c.pergunta_id=v_pergunta->>'id' order by c.revisao_plano desc limit 1;
   if not found or v_contrato.questionario_id is distinct from v_questionario_id or v_contrato.pergunta_fonte is distinct from v_pergunta then raise exception 'contrato_pergunta_ausente_ou_obsoleto' using errcode='23514'; end if;
   v_saida:=v_saida||jsonb_build_array(jsonb_build_object('rotinaId',v_rotina_id,'questionarioId',v_questionario_id,'perguntaId',v_pergunta->>'id','obrigatoria',v_contrato.obrigatoria,'contratoId',v_contrato.id));
  end loop;
 end loop;
 new.snapshot:=jsonb_set(new.snapshot,'{contratos_perguntas}',v_saida,true);
 return new;
end; $$;
revoke all on function pcm.sso_congelar_contratos_pergunta() from public,anon,authenticated,service_role;
create trigger sso_congelar_contratos_pergunta before update of estado on pcm.plano_versoes for each row execute function pcm.sso_congelar_contratos_pergunta();
