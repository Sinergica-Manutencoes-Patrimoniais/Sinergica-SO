-- 0009_E00-S09_rls_modulos.sql — Sinérgica SO
-- Story E00-S09. Reescreve RLS de domínio para usar `user_modulos` no JWT e torna
-- `config.feature_flags` exclusivo de superadmin.
--
-- Reverso: reverter cada `alter policy` abaixo para a matriz de papéis da migration 0004.

-- pcm.clientes — módulo `pcm`: leitura lê, escrita escreve; superadmin bypassa.
alter policy "clientes_select" on pcm.clientes
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

alter policy "clientes_insert" on pcm.clientes
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

alter policy "clientes_update" on pcm.clientes
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- pcm.ordens_servico — módulo `pcm`.
alter policy "ordens_servico_select" on pcm.ordens_servico
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

alter policy "ordens_servico_insert" on pcm.ordens_servico
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

alter policy "ordens_servico_update" on pcm.ordens_servico
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- atendimento.* — módulo `atendimento`.
alter policy "config_ze_select" on atendimento.config_ze
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

alter policy "config_ze_insert" on atendimento.config_ze
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

alter policy "config_ze_update" on atendimento.config_ze
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

alter policy "wa_messages_select" on atendimento.wa_messages
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

alter policy "wa_messages_insert" on atendimento.wa_messages
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

alter policy "wa_messages_update" on atendimento.wa_messages
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

alter policy "wa_queue_select" on atendimento.wa_queue
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

alter policy "wa_queue_insert" on atendimento.wa_queue
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

alter policy "wa_queue_update" on atendimento.wa_queue
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

-- comercial.leads — módulo `comercial`.
alter policy "leads_select" on comercial.leads
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
  );

alter policy "leads_insert" on comercial.leads
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  );

alter policy "leads_update" on comercial.leads
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  );

-- config.feature_flags — fora dos 9 módulos; governança superadmin-only.
alter policy "feature_flags_select" on config.feature_flags
  using (auth.jwt() ->> 'user_role' = 'superadmin');

alter policy "feature_flags_insert" on config.feature_flags
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

alter policy "feature_flags_update" on config.feature_flags
  using (auth.jwt() ->> 'user_role' = 'superadmin')
  with check (auth.jwt() ->> 'user_role' = 'superadmin');
