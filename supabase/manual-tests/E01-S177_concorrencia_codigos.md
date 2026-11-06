# S177 — concorrência de código de rascunho

Somente banco descartável em rede interna, cron desativado, sem integração externa. Execute como administrador do banco usando duas conexões; não habilite gates fora das transações indicadas. Dados sintéticos `17799500-*` são criados por `E01-S177_snapshot_fixture.sql`; os casos abaixo usam também Componente `...0014`, Cliente `...000a`, usuário `...0001`, código `S177-COMP-OLD-0995` e ciclo de revisão 1 criados exclusivamente no diagnóstico. O caso inverso confirma identificador Auvo **fictício** no Componente sintético; não executar em dados reais.

## Edição em disputa com marcação de sync

Sessão A:

```sql
begin;
set local app.auvo_sync_write = 'true';
select pg_advisory_xact_lock(hashtextextended('sso-codigos-publicos', 0));
```

Enquanto A mantém a transação aberta, sessão B:

```sql
begin;
set local app.auvo_sync_write = 'true';
update pcm.sso_codigo_marcos_gate set habilitado=true where chave;
update pcm.equipamentos set auvo_equipment_id=1995995
 where id='17799500-0000-0000-0000-000000000014';
-- Esperado: codigo_concorrente_tente_novamente; transação deve ser revertida.
rollback;
```

Sessão A: `rollback;`. Espera-se nenhuma atualização do equipamento nem marco confirmado. A trava manual simula a trava já adquirida no início do núcleo 0363; o teste não demonstra todos os caminhos de edição.

## Sync confirma enquanto edição aguarda

Em fixture fresca (revisão 1, sem identificador externo), sessão B primeiro:

```sql
begin;
set local app.auvo_sync_write = 'true';
update pcm.sso_codigo_marcos_gate set habilitado=true where chave;
update pcm.equipamentos set auvo_equipment_id=1995995
 where id='17799500-0000-0000-0000-000000000014';
```

Sessão A, com B aberta:

```sql
begin;
set local app.auvo_sync_write = 'true';
set local request.jwt.claims = '{"sub":"17799500-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
update pcm.sso_codigo_rascunho_gate set habilitado=true where chave;
select pcm.sso_editar_codigo_rascunho_base_0876(
 '17799500-0000-0000-0000-000000000036','componente',
 '17799500-0000-0000-0000-000000000014',1,'S177-COMP-OLD-0995','S177-COMP-NEW-0995');
-- Deve aguardar enquanto B permanece aberta.
```

Sessão B: `update pcm.sso_codigo_marcos_gate set habilitado=false where chave; commit;`. A deverá falhar com `revisao_obsoleta`; em A execute `rollback`. B confirma apenas dado sintético e volta gate ao estado fechado. O marco e o identificador fictício persistem na fixture; não reutilizar essa fixture como se fosse fresca.

Ambas as ordens foram observadas em 2026-10-30 na 55522 isolada. Não demonstram integração Auvo, etiquetagem, todos os escritores ou segurança com gate de marcos desligado. O núcleo chamado é privado; o gate de rascunho permanece fechado após rollback.
