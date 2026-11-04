-- ADR-0726: políticas restritivas complementam as políticas permissivas legadas.
create policy e04_s04_financeiro_contratos_leitura_atual on financeiro.contratos as restrictive for select to authenticated
  using (config.sso_e03_s07_modulo_atual('financeiro', false));
create policy e04_s04_financeiro_contratos_insercao_atual on financeiro.contratos as restrictive for insert to authenticated
  with check (config.sso_e03_s07_modulo_atual('financeiro', true));
create policy e04_s04_financeiro_contratos_alteracao_atual on financeiro.contratos as restrictive for update to authenticated
  using (config.sso_e03_s07_modulo_atual('financeiro', true))
  with check (config.sso_e03_s07_modulo_atual('financeiro', true));
create policy e04_s04_financeiro_contratos_exclusao_atual on financeiro.contratos as restrictive for delete to authenticated
  using (config.sso_e03_s07_modulo_atual('financeiro', true));
