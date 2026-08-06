-- E01-S129 adversarial: uma conversão Chamado→OS não pode duplicar em retry/concorrrência.
create unique index if not exists uq_ordens_servico_chamado
  on pcm.ordens_servico (chamado_id)
  where chamado_id is not null and deleted_at is null;
