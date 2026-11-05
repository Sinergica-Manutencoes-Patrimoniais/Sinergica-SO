-- ADR-0804: reutiliza protocolo 0787; não autoriza aprovação.
create trigger sso_guardar_impacto_plano_legado
  before insert or update or delete on pcm.planos_preventivos
  for each statement execute function pcm.sso_guardar_escrita_impacto_global();

create trigger sso_guardar_impacto_declaracao_plano_legado
  before insert or update or delete on pcm.sso_declaracoes_planos_legados
  for each statement execute function pcm.sso_guardar_escrita_impacto_global();
