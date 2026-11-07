-- ADR-0274: consulta operacional; não representa aprovação nem pagamento.
create table pcm.conferencia_despesa_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.conferencia_despesa_gate(id,habilitado) values(true,false);
alter table pcm.conferencia_despesa_gate enable row level security;
alter table pcm.conferencia_despesa_gate force row level security;
revoke all on pcm.conferencia_despesa_gate from public,anon,authenticated,service_role;
create function pcm.sso_conferir_despesa_visita(p_cliente_id uuid,p_visita_id uuid,p_despesa_id uuid)
returns table(revisao integer,comprovante text,rateio text,parcelas integer,base text,valor_base_centavos text,total_rateado_centavos text)
language plpgsql stable security definer set search_path='' as $$
declare d pcm.despesas_visita%rowtype; v_objeto uuid; v_caminho text; v_rateio integer; v_total numeric; v_parcelas integer; v_encerrados integer; v_incompletos integer;
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null or p_despesa_id is null
    or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into d from pcm.despesas_visita where id=p_despesa_id and cliente_id=p_cliente_id and visita_id=p_visita_id;
  if not found then raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from pcm.conferencia_despesa_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  select h.objeto,h.caminho into v_objeto,v_caminho from (
    select r.revisao,r.comprovante_objeto_id as objeto,r.comprovante_caminho as caminho from pcm.despesa_visita_realizacoes r where r.despesa_id=d.id
    union all select c.revisao,c.objeto_novo,c.caminho_novo from pcm.despesa_visita_correcoes_realizacao c where c.despesa_id=d.id
  ) h order by h.revisao desc limit 1;
  select max(r.revisao) into v_rateio from pcm.despesa_visita_rateios r where r.despesa_id=d.id;
  select count(*)::integer,coalesce(sum(p.valor_centavos),0),count(*) filter(where vo.id is not null and (vo.encerrado_em is not null or vo.cliente_id<>d.cliente_id or vo.visita_id<>d.visita_id))::integer,
    count(*) filter(where vo.id is null)::integer
    into v_parcelas,v_total,v_encerrados,v_incompletos from pcm.despesa_visita_rateio_parcelas p left join pcm.visita_ordens_servico vo on vo.id=p.vinculo_id
    where p.despesa_id=d.id and p.revisao=v_rateio;
  return query select d.revisao,
    case when d.realizado_centavos is null then 'nao_realizada'
      when v_objeto is null or not exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id and b.public is false
        where o.id=v_objeto and o.name=v_caminho and o.bucket_id='sso-despesas-visita') then 'indisponivel' else 'objeto_privado_existe' end,
    case when v_parcelas=0 then 'sem_rateio' when v_incompletos>0 then 'vinculo_incompleto' when v_encerrados>0 then 'vinculo_encerrado'
      when v_total<>coalesce(d.realizado_centavos,d.previsto_centavos) then 'total_divergente' else 'total_confere' end, v_parcelas,
    case when d.realizado_centavos is null then 'previsto' else 'realizado' end,
    coalesce(d.realizado_centavos,d.previsto_centavos)::text, v_total::text;
end $$;
revoke all on function pcm.sso_conferir_despesa_visita(uuid,uuid,uuid) from public,anon,authenticated,service_role;
