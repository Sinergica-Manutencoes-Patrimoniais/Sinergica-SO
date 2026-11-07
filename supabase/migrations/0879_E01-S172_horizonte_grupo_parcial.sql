-- ADR-0654: integração parcial, não converte fontes incompletas em capacidade consolidada.
create table pcm.sso_horizonte_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_horizonte_grupo_gate enable row level security;
alter table pcm.sso_horizonte_grupo_gate force row level security;
revoke all on pcm.sso_horizonte_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_horizonte_grupo_gate(id,habilitado) values(true,false);
create function pcm.sso_horizonte_capacidade_grupo(p_cliente_id uuid,p_semana_inicio date,p_quantidade integer)
returns table(semana_inicio date,visitas bigint,declaracoes bigint,grupos_lidos integer,grupos_sem_tempo integer,grupos_com_sobreposicao integer,subtotal_grupo_sem_os_minutos text,fonte_truncada boolean,demanda_completa boolean,disponibilidade_completa boolean,saldo_minutos text)
language plpgsql stable security definer set search_path='' as $$
declare v_semana record;v_fonte record;v_cursor uuid;v_lidos integer;v_contagem integer;v_sem_tempo integer;v_sobrepostos integer;v_subtotal numeric;v_truncada boolean;
begin
 if not coalesce((select habilitado from pcm.sso_horizonte_grupo_gate where id),false) then raise exception 'horizonte_grupo_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_semana_inicio is null or not isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio)<>1 or p_quantidade is null or p_quantidade not between 1 and 12 then raise exception 'periodo_invalido' using errcode='22023'; end if;
 for v_semana in select * from pcm.sso_horizonte_capacidade_preparado(p_cliente_id,p_semana_inicio,p_quantidade) loop
   v_cursor:=null;v_contagem:=0;v_sem_tempo:=0;v_sobrepostos:=0;v_subtotal:=0;v_truncada:=false;
   loop
     v_lidos:=0;
     for v_fonte in select * from pcm.sso_listar_demanda_grupo_visita(p_cliente_id,v_semana.semana_inicio,v_cursor,100) loop
       v_cursor:=v_fonte.ocorrencia_id;v_lidos:=v_lidos+1;v_contagem:=v_contagem+1;
       if v_fonte.esforco_minutos is null then v_sem_tempo:=v_sem_tempo+1;
       elsif v_fonte.estimativa_os_minutos is not null then v_sobrepostos:=v_sobrepostos+1;
       elsif v_fonte.esforco_minutos ~ '^[0-9]+$' then v_subtotal:=v_subtotal+v_fonte.esforco_minutos::numeric;
       else v_sem_tempo:=v_sem_tempo+1; end if;
     end loop;
     if v_lidos<100 then exit; end if;
     if v_contagem>=10000 then v_truncada:=true;exit; end if;
   end loop;
   return query select v_semana.semana_inicio,v_semana.visitas,v_semana.declaracoes,v_contagem,v_sem_tempo,v_sobrepostos,v_subtotal::text,v_truncada,false,false,null::text;
 end loop;
end; $$;
revoke all on function pcm.sso_horizonte_capacidade_grupo(uuid,date,integer) from public,anon,authenticated,service_role;
