-- 0133_E01-S88_renumerar_os_sequence.sql — Sinérgica SO
-- Story E01-S88. O prefixo "CH-" passa a pertencer ao Chamado (pcm.chamados, migration seguinte) —
-- decisão do PO: Chamado é o item pré-OS que o cliente/técnico usa no dia a dia, então herda "CH".
-- OS passa a nascer com prefixo "OS-XXXX", numeração atômica via sequence (corrige o débito de
-- race condition de `count()` já documentado em E01-S02/os-from-task.ts, presente em 3 pontos de
-- código duplicados: web, import de tarefas Auvo, Zé/WhatsApp — todos passam a chamar esta função).
-- OS antigas mantêm o número histórico "CH-XXX" (sem backfill/renomeação retroativa).

create sequence pcm.seq_ordens_servico_numero;

grant usage on sequence pcm.seq_ordens_servico_numero to authenticated, service_role;

create or replace function pcm.fn_proximo_numero_os()
returns text
language sql
as $$
  select 'OS-' || lpad(nextval('pcm.seq_ordens_servico_numero')::text, 4, '0');
$$;

-- E01-S02 (pcm-auvo-tasks-import): importa um lote de tarefas Auvo como OS de uma vez só — precisa
-- de N números atomicamente reservados numa chamada só, não N round-trips.
create or replace function pcm.fn_proximos_numeros_os(p_quantidade int)
returns text[]
language sql
as $$
  select coalesce(
    array_agg('OS-' || lpad(nextval('pcm.seq_ordens_servico_numero')::text, 4, '0')),
    array[]::text[]
  )
  from generate_series(1, greatest(p_quantidade, 0));
$$;

grant execute on function pcm.fn_proximo_numero_os() to authenticated, service_role;
grant execute on function pcm.fn_proximos_numeros_os(int) to authenticated, service_role;
