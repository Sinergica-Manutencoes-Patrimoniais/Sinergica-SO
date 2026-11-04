-- ADR-0081: somente a origem legada pode usar as políticas legadas.
alter policy ocorrencias_preventivas_read on pcm.ocorrencias_preventivas
  using (origem = 'legado' and (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  ));
alter policy avaliacoes_preventivas_read on pcm.avaliacoes_preventivas
  using ((auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita'))
    and exists (select 1 from pcm.ocorrencias_preventivas o
      where o.id = avaliacoes_preventivas.ocorrencia_id and o.origem = 'legado'));
alter policy achados_preventivos_read on pcm.achados_preventivos
  using ((auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita'))
    and exists (select 1 from pcm.avaliacoes_preventivas a
      join pcm.ocorrencias_preventivas o on o.id = a.ocorrencia_id
      where a.id = achados_preventivos.avaliacao_id and o.origem = 'legado'));
