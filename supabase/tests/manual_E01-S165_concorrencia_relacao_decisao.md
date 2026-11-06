# Relação legada e decisão de impacto concorrentes

Executar exclusivamente em clone descartável com migrations 1614–1683 aplicadas, nunca em banco compartilhado ou produtivo. A fixture usa dados sintéticos e não substitui aprovação nem libera a guarda 1045. O banco deve ter as migrations anteriores e extensões necessárias já instaladas. Não cria OS nem tarefa Auvo.

## Preparação em transação no clone

No `psql`, a partir deste diretório, executar:

```sql
\set ON_ERROR_STOP on
begin;
\ir manual_E01-S165_S166_ponte_legada_mediada.sql
update config.sso_concessoes set ativa=true
 where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
commit;
```

A fixture é exclusivamente sintética e usa privilégios administrativos para preparar dados e gates no clone; os dois comandos sob teste são executados como `authenticated`. Abra duas sessões `psql` no clone, ambas com `ON_ERROR_STOP` e em isolamento READ COMMITTED. Em cada sessão execute:

```sql
set request.jwt.claims='{"sub":"16630000-1111-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
set role authenticated;
```

## Sessão A — mudança da relação

```sql
begin;
select pcm.sso_declarar_relacao_legada_mediada(
 '16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000405',
 '16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',
 '16630000-1111-4000-8000-000000000097',1,'retirar','Teste concorrente');
-- Não confirme ainda; inicie a sessão B e só depois execute COMMIT.
```

## Sessão B — decisão comparada

Inicie enquanto A permanece aberta. A chamada deve esperar a liberação da transação A; após `commit` em A, B deve concluir:

```sql
do $$ declare p uuid; f jsonb; begin
 select preparada_id into p from pcm.sso_listar_decisoes_calendario_mediada(
  '16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a',
  '16630000-1111-4000-8000-000000000011',2,null,20) limit 1;
 f:=pcm.sso_comparar_rotina_impacto_v3(
  '16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a',
  '16630000-1111-4000-8000-000000000011',2,'16630000-1111-4000-8000-000000000022',p,'calendario');
 perform pcm.sso_decidir_impacto_comparado(
  '16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000406',
  '16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',
  '16630000-1111-4000-8000-000000000022',p,2,1,'manter_sem_alterar',
  'Teste concorrente','calendario',f);
end $$;
```

Conferir como administrador do clone: última decisão da relação legada é `retirar`; há exatamente uma decisão com request ID `16630000-1111-4000-8000-000000000406`; não existem OS para o Cliente sintético. Descartar o clone inteiro ao final. O ensaio realizado observou espera de 2,73 s e sucesso após confirmação de A. Este roteiro não testa alteração real de OS, criação física de ponte ou integração Auvo, nem demonstra cobertura integral dos escritores.
