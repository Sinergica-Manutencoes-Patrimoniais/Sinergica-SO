# S176 — disputa de leitura, gate e revogação (1809/1810)

Roteiro preparado, **não executado**. Usar somente clone sintético descartável, sem rede externa, com migrations até 1810 e duas conexões READ COMMITTED. Não usar ambiente real; descartar o clone ao final. Os COMMITs servem apenas para tornar dados sintéticos visíveis entre sessões. Não desativar triggers nem alterar funções. Parar na primeira divergência.

## Preparação no clone

Como owner, conferir que os IDs abaixo não existem; se houver colisão, abortar e criar outro clone. A supressão do enqueue de sincronização vale somente para a transação de setup sintético.

```sql
select exists(select 1 from auth.users where id='18110000-0000-4000-8000-000000000001')
    or exists(select 1 from pcm.clientes where id='18110000-0000-4000-8000-000000000002'); -- deve ser false
begin;
set local app.auvo_sync_write = 'true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('18110000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','concorrencia-1810@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('18110000-0000-4000-8000-000000000001','colaborador','Ator sintético',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('18110000-0000-4000-8000-000000000001','pcm','leitura');
insert into pcm.clientes(id,nome,ativo,created_by) values ('18110000-0000-4000-8000-000000000002','Cliente sintético',true,'18110000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('18110000-0000-4000-8000-000000000001','cadastro.ler','18110000-0000-4000-8000-000000000002');
insert into pcm.sistemas(id,cliente_id,nome) values ('18110000-0000-4000-8000-000000000003','18110000-0000-4000-8000-000000000002','Sistema sintético');
update config.sso_estrutura_cliente_leitura_gate set habilitado=true where id;
commit;
```

Em cada sessão autenticada abaixo, executar primeiro:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"18110000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
```

A leitura a usar é sempre:

```sql
select jsonb_array_length(pcm.sso_listar_composicao_estrutura_176('18110000-0000-4000-8000-000000000001','18110000-0000-4000-8000-000000000002','sistemas',null,null,false,0));
```

## Gate: duas ordens

1. Sessão A como owner: `begin; update config.sso_estrutura_cliente_leitura_gate set habilitado=false where id;` e manter aberta. Sessão B autenticada executa a leitura: deve falhar `55P03` (linha do gate ocupada). Fazer rollback em B; confirmar A. Nova leitura em B deve falhar `55000/isolamento_desabilitado`; rollback. Reativar o gate somente no clone.
2. Sessão A autenticada executa leitura: deve retornar `1`; manter transação aberta. Sessão B owner: `begin; set local lock_timeout='2s'; update config.sso_estrutura_cliente_leitura_gate set habilitado=false where id;` deve falhar `55P03` por timeout. Rollback B; commit A. Repetir atualização e commit B. Nova leitura deve falhar `55000`; rollback e reativar gate no clone.

## Revogação: duas ordens

1. Sessão A owner: `begin; update config.sso_concessoes set ativa=false where usuario_id='18110000-0000-4000-8000-000000000001' and cliente_id='18110000-0000-4000-8000-000000000002' and acao='cadastro.ler';` Manter aberta. Sessão B autenticada executa leitura: deve falhar `55P03/autorizacao_em_alteracao`; rollback B, commit A. Nova leitura deve falhar `42501/sem_acesso`; rollback. Reativar concessão somente no clone.
2. Sessão A autenticada lê `1` e mantém transação aberta. Sessão B owner tenta a mesma revogação em `begin`: deve falhar `55P03/autorizacao_em_alteracao`; rollback B. Commit A; revogar e confirmar B; nova leitura deve falhar `42501/sem_acesso`.

Após cada falha, rollback da transação abortada antes de prosseguir. Como owner, conferir que existe exatamente um Sistema sintético, que não surgiram outros objetos ou mutações operacionais e que a concessão está revogada no último cenário; não imprimir dados reais. O clone inteiro deve ser descartado, incluindo gate e dados sintéticos. Não há HTTP, Auvo, Storage ou efeito externo neste roteiro. A prova cobre fonte `sistemas` e estas duas ordens, não paginação, outros leitores, movimentação de vínculos ou integridade do ambiente real.
