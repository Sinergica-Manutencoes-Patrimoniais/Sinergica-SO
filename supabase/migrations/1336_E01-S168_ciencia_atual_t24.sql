-- ADR-1169: precondição privada, não concede execução nem envia tarefa.
create function pcm.sso_t24_ciencia_atual(p_tentativa_id uuid) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare t pcm.sso_t24_tentativas%rowtype; v pcm.visitas%rowtype; c pcm.visita_confirmacoes%rowtype;
 p pcm.politicas_ciencia_visita%rowtype; modo text; origem text;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.role() is distinct from 'service_role' or p_tentativa_id is null then raise exception 'servico_nao_autorizado' using errcode='42501'; end if;
 select * into t from pcm.sso_t24_tentativas where id=p_tentativa_id;
 if not found then return false; end if;
 select * into v from pcm.visitas where id=t.visita_id and cliente_id=t.cliente_id;
 if not found then return false; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('ciencia-scope:'||v.cliente_id::text||':-:-',0)) then return false; end if;
 if v.contrato_id is not null and not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('ciencia-scope:'||v.cliente_id::text||':'||v.contrato_id::text||':-',0)) then return false; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('ciencia-scope:'||v.cliente_id::text||':-:'||v.id::text,0)) then return false; end if;
 perform 1 from pcm.visitas atual where atual.id=v.id and atual.cliente_id=v.cliente_id and atual.contrato_id is not distinct from v.contrato_id
  and atual.revisao=t.revisao_visita and atual.estado='confirmada' for share nowait;
 if not found then return false; end if;
 select * into c from pcm.visita_confirmacoes where visita_id=v.id and cliente_id=v.cliente_id and revisao=t.revisao_visita;
 if not found then return false; end if;
 select x.* into p from pcm.politicas_ciencia_visita x where x.cliente_id=v.cliente_id and
  (x.visita_id=v.id or (x.visita_id is null and x.contrato_id=v.contrato_id and v.contrato_id is not null) or (x.visita_id is null and x.contrato_id is null))
  order by case when x.visita_id is not null then 1 when x.contrato_id is not null then 2 else 3 end limit 1;
 if found then modo:=p.modo;origem:=case when p.visita_id is not null then 'visita' when p.contrato_id is not null then 'contrato' else 'cliente' end;
 else modo:='sem_controle';origem:='padrao';end if;
 if c.politica_modo is distinct from modo or c.politica_origem is distinct from origem or c.politica_id is distinct from p.id or c.politica_revisao is distinct from p.revisao then return false; end if;
 if modo='obrigatoria' then
  if not coalesce((select habilitado from pcm.portal_confirmacao_cliente_gate where id),false) or not coalesce((select habilitado from pcm.portal_visita_gate where id),false) then return false; end if;
  perform pub.id from pcm.portal_confirmacoes_cliente x join pcm.portal_visita_publicacoes pub on pub.id=x.publicacao_id
   join pcm.visita_ordens_servico vo on vo.visita_id=pub.visita_id and vo.os_id=pub.os_id and vo.cliente_id=pub.cliente_id and vo.encerrado_em is null
   join pcm.ordens_servico os on os.id=vo.os_id and os.client_id=vo.cliente_id and os.deleted_at is null
   where x.confirmacao_pcm_id=c.id and pub.visita_id=v.id and pub.os_id=t.os_id and pub.cliente_id=v.cliente_id and pub.revisao_visita=v.revisao and pub.revogado_em is null
   for share of pub,vo,os nowait;
  if not found then return false; end if;
 end if;
 return true;
exception when lock_not_available then return false;
end; $$;
revoke all on function pcm.sso_t24_ciencia_atual(uuid) from public,anon,authenticated,service_role;
