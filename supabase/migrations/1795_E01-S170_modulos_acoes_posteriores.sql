-- ADR-1653: apenas mapeamentos expressos nas ações de origem; não cria concessões.
do $migration$
declare
  item record;
begin
  for item in
    select * from (values
      ('orcamento.operacional.ler', 'comercial', 'leitura', false),
      ('orcamento.dispensar', 'comercial', 'escrita', true),
      ('orcamento.excecao_preco', 'comercial', 'escrita', true),
      ('anexo_os.publicar', 'pcm', 'escrita', true)
    ) as esperado(acao, modulo, nivel, individual)
  loop
    if not exists (
      select 1 from config.sso_acoes a
      where a.codigo = item.acao and a.modulo = item.modulo and a.nivel = item.nivel
        and a.exige_concessao_individual = item.individual
    ) then
      raise exception 'catalogo_capacidade_divergente: %', item.acao using errcode = '55000';
    end if;
    if exists (
      select 1 from config.sso_acao_modulos m
      where m.acao = item.acao and m.modulo = item.modulo and m.nivel <> item.nivel
    ) then
      raise exception 'modulo_capacidade_divergente: %', item.acao using errcode = '55000';
    end if;
    insert into config.sso_acao_modulos (acao, modulo, nivel)
      values (item.acao, item.modulo, item.nivel)
      on conflict (acao, modulo) do nothing;
  end loop;
end;
$migration$;
