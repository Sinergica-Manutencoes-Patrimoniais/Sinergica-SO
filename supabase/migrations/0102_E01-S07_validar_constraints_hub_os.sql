-- 0102_E01-S07_validar_constraints_hub_os.sql — Sinérgica SO
-- Valida as constraints NOT VALID de 0101 (padrão split da casa — evita lock longo na migration que
-- adiciona a constraint; VALIDATE roda separado, sem bloquear escrita durante o scan).
--
-- Reverso: (constraints voltam a NOT VALID; sem efeito prático — não há "desvalidar" no Postgres)
--   -- nada a fazer; dropar a constraint via reverso de 0101 já cobre o rollback completo.

alter table pcm.ordens_servico validate constraint ordens_servico_tipo_os_check;
alter table pcm.ordens_servico validate constraint ordens_servico_pmoc_schedule_id_fkey;
