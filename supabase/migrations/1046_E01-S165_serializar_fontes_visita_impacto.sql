-- ADR-0859: somente com protocolo 0787 habilitado, não autoriza aprovação.
create trigger sso_guardar_impacto_ciclo_visita
  before insert on pcm.sso_ciclos_visita_canonicos
  for each statement execute function pcm.sso_guardar_escrita_impacto_global();
create trigger sso_guardar_impacto_identidade_visita
  before insert on pcm.sso_ciclo_visita_versoes
  for each statement execute function pcm.sso_guardar_escrita_impacto_global();
create trigger sso_guardar_impacto_decisao_visita
  before insert on pcm.sso_decisoes_impacto_visita
  for each statement execute function pcm.sso_guardar_escrita_impacto_global();
