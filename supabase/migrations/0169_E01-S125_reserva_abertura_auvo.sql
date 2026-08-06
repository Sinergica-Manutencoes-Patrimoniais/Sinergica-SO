-- E01-S125 — serializa confirmação humana de abertura Auvo. Sem reserva, dois cliques concorrentes
-- poderiam ambos passar pela busca remota por externalId antes de qualquer um gravar auvo_task_id.
-- `opening` expira após 5min: queda da Edge não deixa a OS presa; o próximo clique pode retentar.

create or replace function pcm.fn_iniciar_abertura_auvo(p_os_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_afetadas integer;
begin
  update pcm.ordens_servico
     set auvo_sync_status = 'opening',
         auvo_sync_error = null,
         updated_at = now()
   where id = p_os_id
     and deleted_at is null
     and auvo_task_id is null
     and (
       auvo_sync_status is distinct from 'opening'
       or updated_at < now() - interval '5 minutes'
     );
  get diagnostics v_afetadas = row_count;
  return v_afetadas = 1;
end;
$$;

revoke all on function pcm.fn_iniciar_abertura_auvo(uuid) from public;
grant execute on function pcm.fn_iniciar_abertura_auvo(uuid) to service_role;

comment on function pcm.fn_iniciar_abertura_auvo(uuid) is
  'E01-S125: reserva atomica de abertura Auvo; opening vence em 5 minutos para permitir retry apos falha.';
