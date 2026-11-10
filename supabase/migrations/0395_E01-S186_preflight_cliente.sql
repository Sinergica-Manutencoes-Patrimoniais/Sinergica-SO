-- ADR-0169: somente leitura agregada; não executa prévia de migração nem altera registros.
create table pcm.migracao_preflight_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.migracao_preflight_gate enable row level security;
alter table pcm.migracao_preflight_gate force row level security;
revoke all on pcm.migracao_preflight_gate from public,anon,authenticated,service_role;
insert into pcm.migracao_preflight_gate(id,habilitado) values(true,false);

create function pcm.sso_diagnosticar_migracao_cliente(p_cliente_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.migracao_preflight_gate where id),false) then raise exception 'diagnostico_bloqueado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or not exists(select 1 from config.usuarios u
    where u.user_id=auth.uid() and u.ativo and u.papel='superadmin')
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  with codigos as materialized (
    select e.identificador as codigo from pcm.equipamentos e where e.client_id=p_cliente_id and e.deleted_at is null
    union all select s.codigo from pcm.sistemas s where s.cliente_id=p_cliente_id and s.deleted_at is null
  ), grupos as (
    select pg_catalog.upper(pg_catalog.btrim(c.codigo)) as chave from codigos c
    where c.codigo is not null and pg_catalog.btrim(c.codigo)<>'' group by 1 having count(*)>1
  )
  select jsonb_build_object(
    'clienteId',p_cliente_id,
    'chamadosAtivos',(select count(*) from pcm.chamados c where c.cliente_id=p_cliente_id and c.deleted_at is null),
    'osAtivas',(select count(*) from pcm.ordens_servico o where o.client_id=p_cliente_id and o.deleted_at is null),
    'osChamadoAusente',(select count(*) from pcm.ordens_servico o left join pcm.chamados c on c.id=o.chamado_id
      where o.client_id=p_cliente_id and o.deleted_at is null and o.chamado_id is not null and (c.id is null or c.deleted_at is not null)),
    'osChamadoClienteDivergente',(select count(*) from pcm.ordens_servico o join pcm.chamados c on c.id=o.chamado_id
      where o.client_id=p_cliente_id and o.deleted_at is null and c.deleted_at is null and c.cliente_id is distinct from p_cliente_id),
    'chamadoOsLegadaAusente',(select count(*) from pcm.chamados c left join pcm.ordens_servico o on o.id=c.ordem_servico_id
      where c.cliente_id=p_cliente_id and c.deleted_at is null and c.ordem_servico_id is not null and (o.id is null or o.deleted_at is not null)),
    'chamadoOsLegadaDivergente',(select count(*) from pcm.chamados c join pcm.ordens_servico o on o.id=c.ordem_servico_id
      where c.cliente_id=p_cliente_id and c.deleted_at is null and o.deleted_at is null
      and (o.client_id is distinct from p_cliente_id or o.chamado_id is distinct from c.id)),
    'osLegadaMultiplosChamados',(select count(*) from (select c.ordem_servico_id from pcm.chamados c
      where c.cliente_id=p_cliente_id and c.deleted_at is null and c.ordem_servico_id is not null group by c.ordem_servico_id having count(*)>1) d),
    'codigosVazios',(select count(*) from codigos where codigo is null or btrim(codigo)=''),
    'possiveisCodigosDuplicadosCliente',(select count(*) from grupos),
    'planosPreventivosAlvoInvalido',(select count(*) from pcm.planos_preventivos p
      left join pcm.sistemas s on s.id=p.sistema_id left join pcm.equipamentos e on e.id=p.equipamento_id
      where p.cliente_id=p_cliente_id and ((p.sistema_id is not null and (s.id is null or s.deleted_at is not null or s.cliente_id is distinct from p_cliente_id))
        or (p.equipamento_id is not null and (e.id is null or e.deleted_at is not null or e.client_id is distinct from p_cliente_id)))),
    'abrangencia','parcial_por_cliente', 'unicidadeGlobalNaoVerificada',true,
    'visitasInferidas',false, 'executaMigracao',false
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_diagnosticar_migracao_cliente(uuid) from public,anon,authenticated,service_role;
