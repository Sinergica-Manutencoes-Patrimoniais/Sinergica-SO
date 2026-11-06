-- ADR-0810: fontes adicionais da avaliação 0775 e do preflight 0770.
create trigger sso_guardar_impacto_decisao_ocorrencia
  before insert on pcm.sso_decisoes_impacto_ocorrencia
  for each statement execute function pcm.sso_guardar_escrita_impacto_global();

create trigger sso_guardar_impacto_fuso_plano
  before insert on pcm.sso_fusos_plano_declarados
  for each statement execute function pcm.sso_guardar_escrita_impacto_global();
