# S176: movimentação e revogação concorrentes

Roteiro preparado, **não executado**. Usar exclusivamente clone descartável sem rede externa, com migrations aplicadas em ordem até 1799 ou posterior. Não desabilitar guardas nem copiar dados do clone. O formato das entidades segue `supabase/tests/E01-S176_estrutura_tecnica.test.sql`, mas a preparação abaixo é independente: aquela fixture termina em rollback e não pode ser compartilhada diretamente entre sessões.

## Preparação

Como owner, numa transação no clone, inserir os dados sintéticos abaixo e confirmar. `app.auvo_sync_write` é local e evita enfileiramento durante este ensaio; isso não demonstra comportamento de integração externa.

```sql
begin;
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('17990000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s176-1799@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values('17990000-0000-0000-0000-000000000001','superadmin','Ator sintético',true);
insert into pcm.clientes(id,nome,ativo,created_by) values('17990000-0000-0000-0000-00000000000a','Cliente sintético',true,'17990000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('17990000-0000-0000-0000-000000000001','cadastro.gerir','17990000-0000-0000-0000-00000000000a');
insert into pcm.areas(id,cliente_id,nome) values('17990000-0000-0000-0000-000000000021','17990000-0000-0000-0000-00000000000a','Área sintética');
insert into pcm.locais(id,area_id,nome) values('17990000-0000-0000-0000-000000000031','17990000-0000-0000-0000-000000000021','Local sintético');
insert into pcm.equipamentos(id,nome,client_id,ativo) values('17990000-0000-0000-0000-000000000011','Componente sintético','17990000-0000-0000-0000-00000000000a',true);
commit;
```

Se a preparação falhar ou os IDs já existirem, interromper e recriar o clone. Confirmar por consulta que a revisão inicial `estrutura_revisao` do item é 1; se não for, interromper e investigar, sem alterar a expectativa artificialmente.

## Revogação primeiro

Sessão A, como owner:

```sql
begin;
update config.sso_concessoes set ativa=false where usuario_id='17990000-0000-0000-0000-000000000001' and acao='cadastro.gerir' and cliente_id='17990000-0000-0000-0000-00000000000a';
-- Manter aberta até B responder.
```

Sessão B:

```sql
begin;
set local app.auvo_sync_write='true';
set local role authenticated;
set local request.jwt.claims='{"sub":"17990000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
select pcm.sso_mover_componente('17990000-0000-0000-0000-000000000101',1,'17990000-0000-0000-0000-000000000011','17990000-0000-0000-0000-000000000021','17990000-0000-0000-0000-000000000031',null);
```

Esperado: `55P03/autorizacao_em_alteracao`; executar rollback em B. Confirmar A. Repetir B em nova transação: esperado `42501`, sem alteração nem recibo. Reverter B. Reativar a concessão como owner no clone antes do cenário seguinte.

## Movimento primeiro

Na sessão A, repetir o bloco autenticado de B com request `17990000-0000-0000-0000-000000000102`; manter a transação aberta após sucesso. Na sessão B, como owner, iniciar transação com `set local lock_timeout='2s'` e tentar o mesmo UPDATE de revogação acima. Esperado: erro imediato `55P03/autorizacao_em_alteracao`, pois a migration 1099 tornou a trava do escritor não bloqueante. Reverter B e confirmar A.

Antes da revogação, repetir o request `...0102` e payload idêntico: o recibo deve ser idêntico, sem segunda alteração. Confirmar a revogação numa nova transação owner e repetir o mesmo request autenticado: esperado `42501`. Como owner, verificar apenas a revisão e o Local do item sintético e a unicidade do request em `pcm.estrutura_comandos`; descartar todo o clone ao final.

O ensaio não prova todas as ordens possíveis com hierarquia/gate, mudança de Cliente, outras operações de cadastro ou entrega externa. Nenhum resultado deve ser declarado antes da execução real.
