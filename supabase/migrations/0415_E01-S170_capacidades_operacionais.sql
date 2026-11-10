-- ADR-0189: catálogo e elegibilidade somente; nenhuma concessão automática.
insert into config.sso_acoes(codigo,modulo,nivel,exige_concessao_individual) values
  ('chamado.os.criar','pcm','escrita',false),
  ('chamado.escopo.gerir','pcm','escrita',false),
  ('chamado.continuacao.sugerir','pcm','escrita',false)
on conflict (codigo) do nothing;
insert into config.sso_acao_modulos(acao,modulo,nivel) values
  ('chamado.os.criar','pcm','escrita'),
  ('chamado.escopo.gerir','pcm','escrita'),
  ('chamado.continuacao.sugerir','pcm','escrita'),
  ('capacidade.gerir','pcm','escrita'),
  ('despesa_visita.gerir','pcm','escrita'),
  ('visita.cancelar','pcm','escrita')
on conflict (acao,modulo) do nothing;
