-- ADR-0088: instalação somente depois de rota e cliente compatíveis estarem disponíveis.
create policy s184_comprovante_somente_rota on storage.objects as restrictive
  for select to authenticated using (bucket_id <> 'financeiro-comprovantes');
