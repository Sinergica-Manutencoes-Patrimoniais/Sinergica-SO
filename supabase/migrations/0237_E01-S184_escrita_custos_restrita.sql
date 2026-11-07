-- E01-S184: escrita direta de dados internos exige administrador ativo.
-- Reverso: remover as policies s184_escrita_custos_restrita; isso volta a permitir
-- gravações de custo por qualquer usuário com escrita no módulo.
create policy s184_escrita_custos_restrita on comercial.propostas as restrictive
  for all to authenticated using (config.s184_pode_ver_custos()) with check (config.s184_pode_ver_custos());
create policy s184_escrita_custos_restrita on comercial.proposta_itens as restrictive
  for all to authenticated using (config.s184_pode_ver_custos()) with check (config.s184_pode_ver_custos());
create policy s184_escrita_custos_restrita on comercial.proposta_versoes as restrictive
  for all to authenticated using (config.s184_pode_ver_custos()) with check (config.s184_pode_ver_custos());
create policy s184_escrita_custos_restrita on pcm.orcamentos_servico as restrictive
  for all to authenticated using (config.s184_pode_ver_custos()) with check (config.s184_pode_ver_custos());
