---
name: "supabase-manual-tests-e01-s176-legado-pre-guarda-md"
description: "Documento Sinérgica SO: E01-S176 — fixture legada anterior às guards"
alwaysApply: false
---

# E01-S176 — fixture legada anterior às guards

**Roteiro preparado, não executado.** Usar clone **somente de schema**, descartável e isolado,
sem dados pessoais, credenciais ou integração Auvo/Storage. Não usar dump com dados reais, banco
compartilhado, produção ou desenvolvimento em uso. Não desativar triggers, RLS ou constraints.
As instruções pressupõem migrations até 1795 já instaladas, mas 1796/1797 ainda ausentes.

## Conferência antes da fixture

No banco descartável, confirmar pelo histórico de migrations que 1796 e 1797 ainda não estão
instaladas. Conferir também que estes IDs não existem e que o gate legado está desligado:

```sql
select id, habilitado from config.sso_capacidade_cadastros_legados_gate where id;
select id from pcm.clientes where id in
 ('176b0000-0000-0000-0000-00000000000a','176b0000-0000-0000-0000-00000000000b');
select id from pcm.sistemas where id='176b0000-0000-0000-0000-000000000051';
select id from pcm.equipamentos where id='176b0000-0000-0000-0000-000000000011';
```

O gate deve existir e retornar `false`; as consultas de IDs devem retornar zero linhas. Se não
ocorrer, parar. Não alterar gate para fabricar o cenário. Confirmar que a configuração local de
supressão Auvo impede enqueue remoto; se não estiver operacional, parar.

## Criar inconsistência sintética com regras anteriores

Somente nesse clone, usar uma sessão privilegiada de testes, sem role de produção. O vínculo é
permitido antes de 1796 pelo índice único de item e pela guarda 1304 desligada; se algum outro
controle da versão instalada o recusar, registrar e parar, sem contorná-lo. IDs são exclusivos da
fixture e a transação precisa ser confirmada para sobreviver à instalação das migrations:

```sql
begin;
set local app.auvo_sync_write = 'true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('176b0000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','legado-s176@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('176b0000-0000-0000-0000-00000000000a','Cliente sintético A',true,'176b0000-0000-0000-0000-000000000001'),
 ('176b0000-0000-0000-0000-00000000000b','Cliente sintético B',true,'176b0000-0000-0000-0000-000000000001');
insert into pcm.sistemas(id,cliente_id,nome) values
 ('176b0000-0000-0000-0000-000000000051','176b0000-0000-0000-0000-00000000000a','Sistema sintético A');
insert into pcm.equipamentos(id,nome,client_id) values
 ('176b0000-0000-0000-0000-000000000011','Item sintético B','176b0000-0000-0000-0000-00000000000b');
insert into pcm.sistema_itens(sistema_id,item_id) values
 ('176b0000-0000-0000-0000-000000000051','176b0000-0000-0000-0000-000000000011');
commit;
```

Se qualquer comando falhar, usar `ROLLBACK` da transação e registrar o erro. Confirmar com SELECT
que o vínculo existe uma vez e que os Clientes divergem. Confirmar ausência de intenções remotas.

## Instalar e conferir

Usar o mecanismo habitual de migrations **apontado explicitamente ao clone descartável** para
instalar 1796 e 1797. Registrar versão/schema e resultado; não aplicar em outro banco. Depois:

```sql
select s.cliente_id, e.client_id, v.sistema_id, v.item_id
from pcm.sistema_itens v
join pcm.sistemas s on s.id=v.sistema_id
join pcm.equipamentos e on e.id=v.item_id
where v.sistema_id='176b0000-0000-0000-0000-000000000051'
  and v.item_id='176b0000-0000-0000-0000-000000000011';
```

Esperado: a linha original ainda existe, Clientes continuam distintos e nenhum registro foi
substituído ou removido. Em transação separada, uma tentativa de **novo** vínculo incompatível deve
ser rejeitada com `23514`; usar outro item sintético para evitar que o índice único seja o motivo
do erro. Registrar também a integridade de Cliente em mudanças indiretas pela posição.

## Conferir correção recuperável

No clone, em READ COMMITTED e com supressão local, apagar apenas o vínculo sintético dentro de
transação e conferir que a exclusão é aceita; fazer ROLLBACK e confirmar que a linha reaparece:

```sql
begin;
set local app.auvo_sync_write = 'true';
delete from pcm.sistema_itens
where sistema_id='176b0000-0000-0000-0000-000000000051'
  and item_id='176b0000-0000-0000-0000-000000000011';
select count(*) from pcm.sistema_itens
where sistema_id='176b0000-0000-0000-0000-000000000051'
  and item_id='176b0000-0000-0000-0000-000000000011';
rollback;
```

Esperado: contagem zero dentro da transação, uma após rollback. Investigar erros ou efeitos
colaterais; isso não valida concorrência, RLS, autorização ou todas as regras de normalização.
Encerrar conexões e descartar o clone pelo procedimento autorizado: não apagar auditoria, não
desabilitar triggers e não executar limpeza destrutiva neste roteiro.
