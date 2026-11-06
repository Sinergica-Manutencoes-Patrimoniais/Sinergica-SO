# Concorrência de escolha da mesma Visita — S165, migration 1707

Este roteiro escreve dados e faz commit: use **somente banco descartável**. Não aponte para desenvolvimento compartilhado ou produção. Crie um clone isolado da base anterior a 1614, aplique em ordem as migrations 1614 a 1709 e execute:

```sh
rtk proxy python3 supabase/tests/manual_E01-S165_escolha_visita_1707_concorrencia.py --container NOME_DO_CONTAINER --database sso_NOME_DO_CLONE
```

O banco deve estar vazio dos UUIDs sintéticos da fixture; o operador é responsável por removê-lo após o ensaio. O script exige prefixo `sso_` no nome, mas isso **não comprova** que o banco é descartável. Requer Docker, Python 3, psql no contêiner e a role `supabase_admin`; não contém credenciais reais. Não executa deploy, chamadas de rede ao Auvo nem altera a guarda 1045.

O setup cria duas Visitas antigas para a mesma Rotina e as prepara pelo comando canônico antes de iniciar a revisão. A candidata futura é sintética; a montagem de seu vínculo usa `session_replication_role=replica` em transação local. As duas comparações autenticadas são capturadas antes da disputa. A sessão A escolhe e mantém a transação aberta; B tenta a mesma candidata em outra preparada e deve receber `lock_not_available`. Após commit de A, o retry de B deve receber `candidata_ja_escolhida`, enquanto o replay do pedido A é aceito; deve existir somente uma escolha. A sincronização observa a espera `PgSleep` de A, com prazo limitado; falha de infraestrutura ou demora excessiva gera erro, não PASS.

Este ensaio cobre uma interleaving específica e não prova todas as corridas, aprovação operacional ou efeitos de OS. O ensaio original passou em clone com migrations até 1709; esta versão salva organiza o roteiro e a sincronização e não foi reexecutada após sua gravação.
