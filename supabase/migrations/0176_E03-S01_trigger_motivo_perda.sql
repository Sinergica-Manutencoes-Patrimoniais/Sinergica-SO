-- 0176_E03-S01_trigger_motivo_perda.sql — Sinérgica SO
-- Story E03-S01, AC-6. Motivo de perda obrigatório NO BANCO, não só na UI.
--
-- Por quê no banco: win/loss por motivo é a métrica que justifica o épico (E03-S08). Se der para
-- gravar perda sem motivo por qualquer caminho — script, RPC futura, agente, import —, o dado do
-- dashboard vira estimativa. A UI valida para dar boa mensagem; o banco valida para o dado existir.
--
-- O mesmo trigger cuida de `fechada_em`, porque a regra é a mesma regra: entrar em etapa terminal
-- fecha, voltar para etapa aberta reabre. Separar em dois lugares deixaria os dois dessincronizados.
--
-- Rollback:
--   drop trigger if exists trg_oportunidades_fechamento on comercial.oportunidades;
--   drop function if exists comercial.fn_oportunidade_fechamento();

create or replace function comercial.fn_oportunidade_fechamento()
returns trigger
language plpgsql
security invoker
set search_path = comercial, pg_temp
as $$
declare
  v_tipo text;
begin
  select tipo into v_tipo from comercial.etapas_funil where id = new.etapa_id;

  if v_tipo is null then
    raise exception 'Etapa % não encontrada', new.etapa_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_tipo = 'perdida' and new.motivo_perda_id is null then
    raise exception 'Motivo de perda é obrigatório para mover a oportunidade para uma etapa de perda'
      using errcode = 'check_violation';
  end if;

  -- Etapa terminal fecha; etapa aberta reabre (limpa fechamento e motivo).
  if v_tipo in ('ganha', 'perdida') then
    if new.fechada_em is null then
      new.fechada_em := now();
    end if;
  else
    new.fechada_em := null;
    new.motivo_perda_id := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_oportunidades_fechamento
  before insert or update on comercial.oportunidades
  for each row
  execute function comercial.fn_oportunidade_fechamento();

comment on function comercial.fn_oportunidade_fechamento() is
  'E03-S01 AC-6: motivo de perda obrigatório e fechada_em derivado do tipo da etapa. '
  'Regra no banco porque o win/loss do dashboard (E03-S08) depende dela.';
