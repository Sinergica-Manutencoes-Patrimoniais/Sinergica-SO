-- ADR-1168: consulta privada; não habilita worker ou rede.
create function pcm.sso_t24_autorizar_ator_atual(p_tentativa_id uuid)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_ator uuid;v_cliente uuid;v_permitido boolean;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.role() is distinct from 'service_role' or p_tentativa_id is null then raise exception 'servico_nao_autorizado' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 select r.ator_id,r.cliente_id into v_ator,v_cliente from pcm.sso_t24_produtor_recibos r
  join pcm.sso_t24_tentativas t on t.id=r.tentativa_id and t.cliente_id=r.cliente_id and t.visita_id=r.visita_id and t.os_id=r.os_id and t.revisao_visita=r.revisao
  where r.tentativa_id=p_tentativa_id;
 if v_ator is null or v_cliente is null then return false; end if;
 select exists(select 1 from config.usuarios u join config.sso_acoes a on a.codigo='visita.confirmar'
  join pcm.clientes c on c.id=v_cliente and c.ativo and c.deleted_at is null
  where u.user_id=v_ator and u.ativo and u.papel<>'cliente-sindico'
   and (u.papel='superadmin' or exists(select 1 from config.sso_acao_modulos am
    join config.resolver_permissoes_modulo(u.user_id) m on m.modulo=am.modulo
    where am.acao=a.codigo and (m.nivel='escrita' or am.nivel='leitura')))
   and exists(select 1 from config.sso_concessoes g where g.ativa and g.acao=a.codigo and (g.cliente_id is null or g.cliente_id=c.id)
    and (g.usuario_id=u.user_id or (not a.exige_concessao_individual and g.perfil_id is not null and exists(
     select 1 from config.sso_usuario_perfis up join config.sso_perfis p on p.id=up.perfil_id and p.ativo
      where up.usuario_id=u.user_id and up.perfil_id=g.perfil_id and up.ativo))))) into v_permitido;
 return coalesce(v_permitido,false);
end; $$;
revoke all on function pcm.sso_t24_autorizar_ator_atual(uuid) from public,anon,authenticated,service_role;
