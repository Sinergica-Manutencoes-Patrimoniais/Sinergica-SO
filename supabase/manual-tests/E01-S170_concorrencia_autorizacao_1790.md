# S170: disputa entre administração e revogação

Roteiro preparado, **não executado**. Usar somente banco descartável isolado, com migrations aplicadas em ordem até pelo menos 1790 e pgTAP disponível. Nenhum gate precisa ser ativado e nenhuma guarda deve ser desabilitada. Não usar banco de desenvolvimento ou produção. Os dois terminais precisam estar conectados ao mesmo clone com READ COMMITTED.

## Preparação no clone

Executar como owner do banco descartável. Os identificadores e o usuário são exclusivamente sintéticos. Se já existirem, interromper e criar outro clone; não sobrescrever dados.

```sql
insert into auth.users (id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('17900000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','admin-concorrencia-1790@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo)
values ('17900000-0000-0000-0000-000000000001','superadmin','Admin sintético 1790',true);
```

Confirmar a preparação no clone antes de abrir as duas sessões. O ambiente deve estar sem conexões externas e ser descartado ao final. Em cada bloco executar os comandos na ordem indicada; não prosseguir após erro inesperado.

## Revogação primeiro

Sessão A, como owner:

```sql
begin;
set local lock_timeout = '2s';
update config.usuarios set ativo=false where user_id='17900000-0000-0000-0000-000000000001';
-- Manter aberta até a sessão B responder.
```

Sessão B, enquanto A está aberta:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"17900000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
select config.sso_definir_perfil('17900000-0000-0000-0000-000000000101',0,
 '17900000-0000-0000-0000-000000000010','Perfil sintético',true,'Ensaio');
```

Esperado: B falha com `55P03/autorizacao_em_alteracao` sem registrar perfil ou recibo. Executar `rollback` em B. Confirmar A com `commit`; repetir B em nova transação: esperado `42501`, pois o administrador foi desativado. Reverter B. No clone, reativar o administrador como owner antes do próximo cenário.

## Comando primeiro

Sessão A:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"17900000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
select config.sso_definir_perfil('17900000-0000-0000-0000-000000000102',0,
 '17900000-0000-0000-0000-000000000010','Perfil sintético',true,'Ensaio');
-- Manter aberta até a sessão B responder.
```

Sessão B, como owner:

```sql
begin;
set local lock_timeout = '2s';
update config.usuarios set ativo=false where user_id='17900000-0000-0000-0000-000000000001';
```

Esperado: B falha com `55P03/autorizacao_em_alteracao`: a migration 1099 tornou a trava do escritor não bloqueante. Executar `rollback` em B. Confirmar A com `commit`; executar novamente a desativação em B e confirmá-la. Na sessão autenticada, repetir exatamente o request `...0102` e o payload acima: esperado `42501`, sem retornar recibo após revogação. Conferir como owner um único perfil e um único comando para o request, sem imprimir dados de outros usuários.

Repetir a primeira ordem com `sso_definir_concessao` e `sso_definir_vinculo_perfil` usando fixtures sintéticas próprias antes de alegar cobertura dos três comandos. Testar também payload divergente, Cliente distinto e nível de isolamento não suportado. Descartar o clone inteiro depois; não transportar fixtures, credenciais ou gates para outro ambiente. O roteiro não comprova comportamento HTTP nem a concorrência da movimentação 1799.
