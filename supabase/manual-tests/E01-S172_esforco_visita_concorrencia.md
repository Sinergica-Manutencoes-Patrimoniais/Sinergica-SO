# Concorrência de declaração por Visita — S172

Executar apenas em clone isolado com migration 1051. O teste `E01-S172_esforco_visita_fks_reais.sql` carrega dados reais com rollback. Para esta prova específica, executar seu conteúdo no clone trocando somente o último `rollback` por `commit`; isso persiste dados e gates sintéticos exclusivamente no clone, que deve ser apagado ao final. Nunca fazer isso em banco compartilhado ou real.

Em duas sessões SQL autenticadas pelo mesmo usuário sintético, configurar:

```sql
set request.jwt.claims='{"sub":"17252000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
```

Sessão A: abrir transação e declarar revisão esperada 1; manter aberta.

```sql
begin;
select pcm.sso_declarar_esforco_ocorrencia_visita('17252000-0000-4000-8000-000000000020','17252000-0000-4000-8000-000000000002','17252000-0000-4000-8000-000000000015',1,70,120,30,'Concorrência');
```

Sessão B: executar outro request com mesma revisão; deve esperar A.

```sql
select pcm.sso_declarar_esforco_ocorrencia_visita('17252000-0000-4000-8000-000000000021','17252000-0000-4000-8000-000000000002','17252000-0000-4000-8000-000000000015',1,80,120,30,'Concorrência');
```

Confirmar `commit` em A: B deve retornar `revisao_obsoleta`. Em transação separada, registrar revisão esperada 2 e executar `rollback`; conferir ausência do request e do evento de auditoria. Resultado observado: espera e recusa em B; rollback preservou zero declaração e zero evento para o request revertido. Esta prova não cobre outras fontes ou alterações de permissão concorrentes.
