---
name: "supabase-manual-tests-e01-s168-inventario-fontes-origem-md"
description: "Documento Sinérgica SO: Inventário de fontes da origem S168/S173"
alwaysApply: false
---

# Inventário de fontes da origem S168/S173

Análise e ensaios em clone sintético de schema `sso_s168_plano_race`, sem dados reais, cron ou rede externa. Gates abertos apenas nesse clone; clone removido depois.

* `pcm.planos_preventivos`: `fn_plano_preventivo_validar_alvo` impede mudança de cliente, sistema e equipamento após existir ocorrência. Como `authenticated` superadmin e com classificação em outra transação, alteração de sistema foi rejeitada imediatamente. A política de leitura da ocorrência cobre superadmin e escrita PCM; o CHECK exige `origem = 'legado'`. O teste automatizado confirma bloqueio e preserva alteração de nome e no-op.
* `pcm.plano_versoes`: trigger de versão aprovada impede alteração do snapshot e exclusão; teste incluiu execução como owner. Fecha vigência futura continua sendo operação distinta e não foi testada em concorrência.
* `pcm.ocorrencias_rotina_vinculos`: papéis `authenticated` e `service_role` não têm UPDATE direto. Busca nas migrations encontrou inserção por `sso_vincular_ocorrencia_preparada`, chamado por `sso_integrar_ciclo_legado_existente`; este exige gates, autorização, relação declarada e ocorrência sem OS. A ponte de visita possui função própria, exige ocorrência sem OS e bloqueia atualização/exclusão. Constraints de unicidade impedem segunda ponte do mesmo tipo; inserção de calendário trava ocorrência e verifica ponte de visita.
* Ensaio da função privada de calendário, chamada diretamente como owner com identidade sintética (não representa chamada pública completa): classificação tomou primeiro lock da ocorrência e permaneceu aberta. Tentativa de inserir outro vínculo para mesma ocorrência esperou; após commit da classificação, falhou por unicidade `ocorrencias_rotina_vinculos_ocorrencia_legada_id_key`. Não é prova de operação pública, nem de ordem inversa. Para provar ambas as ordens e o caminho mediado falta fixture legítima com declaração e gates necessários; não declarar proteção total da ponte.

Teste pgTAP em transação revertida:

```sh
(head -n 2 supabase/tests/E01-S168_plano_legado_origem_guardada.test.sql; cat supabase/tests/E01-S173_retorno_aprovado_fixture.sql; tail -n +4 supabase/tests/E01-S168_plano_legado_origem_guardada.test.sql) | docker exec -i sso_diagnostico_reconstrucao psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres
```

Resultado 7/7. Fixture mista usada apenas para testar guardiões, não como prova de origem válida. Verificar saída pgTAP: `psql` pode terminar com sucesso mesmo com `not ok`.
