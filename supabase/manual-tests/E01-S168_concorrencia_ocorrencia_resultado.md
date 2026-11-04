# Concorrência da ocorrência de calendário — S168

Teste manual em clone isolado descartável `sso_s168_fonte_race`, schema do banco local reconstruído sem extensões cron/net e sem serviços externos; somente fixtures sintéticas. Clone removido após o teste. Os gates de origem foram ligados somente no clone.

Antes de 1044, classificação iniciada em uma sessão e UPDATE do vencimento por `service_role` em outra produziram dois commits; a origem deixou de corresponder. Após 1044:

- Classificação da OS sintética 084 primeiro: UPDATE da ocorrência 081 esperou o commit; depois foi rejeitado com `ocorrencia_com_retorno_origem_imutavel`.
- UPDATE da ocorrência 091 primeiro: classificação da OS 094 esperou o commit e então falhou com `origem_incompativel`; nenhum retorno foi classificado a partir da origem divergente.

As ocorrências foram derivadas de `E01-S168_origem_inversa_fixture.sql`, com identificadores, ciclos e datas distintos. Este resultado cobre somente a identidade e vencimento da ocorrência legada; não prova concorrência sobre plano, versão ou ponte de origem.

Teste transacional do guardião, sem persistência, executado no banco reconstruído local:

```sh
(head -n 2 supabase/tests/E01-S168_ocorrencia_retorno_imutavel.test.sql; cat supabase/migrations/1041_E01-S168_integridade_origem_calendario.sql supabase/migrations/1044_E01-S168_concorrencia_ocorrencia_retorno.sql supabase/tests/E01-S173_retorno_aprovado_fixture.sql; tail -n +4 supabase/tests/E01-S168_ocorrencia_retorno_imutavel.test.sql) | docker exec -i sso_diagnostico_reconstrucao psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres
```

Resultado: 4/4. A fixture mista testa apenas o gatilho, não uma origem válida. A jornada positiva com origem válida e migrações 1031/1033/1041/1044 teve 13/13; ambos os testes revertem tudo. Conferir saída pgTAP, pois o psql pode terminar com sucesso mesmo se um teste reportar `not ok`.
